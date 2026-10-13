/**
 * Paymob Accept integration for package top-ups (Egypt-first).
 * Credits happen ONLY after verified transaction callback/webhook HMAC.
 * Stub mode (HUB_PAYMOB_STUB=1) is forbidden in production.
 */
'use strict';

const crypto = require('crypto');
const https = require('https');
const http = require('http');

const ACCEPT_HOST = process.env.PAYMOB_API_HOST || 'accept.paymob.com';

/** True on Railway/production-like hosts — stub checkout must never run here. */
function isProductionLike() {
  const flags = [
    process.env.NODE_ENV,
    process.env.APP_ENV,
    process.env.HUB_ENV,
    process.env.RAILWAY_ENVIRONMENT,
  ];
  return flags.some((v) => String(v || '').toLowerCase() === 'production');
}

/**
 * Operating mode for Paymob:
 * - stub: local HMAC self-sign only (never production-like)
 * - test: merchant Test keys — no real money (default when configured)
 * - live: real charges — requires explicit HUB_PAYMOB_LIVE=1
 */
function mode() {
  if (stubAllowed()) return 'stub';
  if (!configuredRaw()) return 'off';
  const live =
    String(process.env.HUB_PAYMOB_LIVE || '') === '1' &&
    String(process.env.HUB_PAYMOB_MODE || 'test').toLowerCase() === 'live';
  return live ? 'live' : 'test';
}

function liveChargesEnabled() {
  return mode() === 'live';
}

function stubAllowed() {
  if (isProductionLike()) return false;
  if (String(process.env.HUB_PAYMOB_STUB || '') === '1') return true;
  return false;
}

function configuredRaw() {
  const key = String(process.env.PAYMOB_API_KEY || '').trim();
  const integration = String(process.env.PAYMOB_INTEGRATION_ID || '').trim();
  const hmac = String(process.env.PAYMOB_HMAC_SECRET || '').trim();
  return Boolean(key && integration && hmac);
}

function configured() {
  if (!configuredRaw()) return false;
  if (stubAllowed()) return true;
  // Reject local placeholder stubs outside stub mode
  if (/^test_stub/i.test(String(process.env.PAYMOB_API_KEY || '').trim())) return false;
  return true;
}

function iframeId() {
  return String(process.env.PAYMOB_IFRAME_ID || '').trim();
}

function settlementCurrency() {
  return String(process.env.HUB_PAYMOB_CHARGE_CURRENCY || 'EGP').toUpperCase();
}

function publicModeStatus() {
  const m = mode();
  return {
    mode: m,
    liveChargesEnabled: liveChargesEnabled(),
    stubAllowed: stubAllowed(),
    productionLike: isProductionLike(),
    messageAr:
      m === 'live'
        ? 'Paymob Live — تحصيل حقيقي مفعّل (بموافقة صريحة).'
        : m === 'test'
          ? 'Paymob Test — مفاتيح اختبار فقط؛ لا تحصيل أموال حقيقية.'
          : m === 'stub'
            ? 'Paymob Stub محلي — للاختبار التطويري فقط.'
            : 'Paymob غير مُعد.',
  };
}

function requestJson(method, pathName, body, headers = {}) {
  const payload = body == null ? null : JSON.stringify(body);
  const isHttps = true;
  const lib = isHttps ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: ACCEPT_HOST,
        path: pathName,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
        timeout: 25000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = {};
          try {
            json = text ? JSON.parse(text) : {};
          } catch {
            json = { raw: text.slice(0, 400) };
          }
          if (res.statusCode >= 400) {
            const err = new Error(json.message || json.detail || `Paymob HTTP ${res.statusCode}`);
            err.status = res.statusCode;
            err.payload = json;
            reject(err);
            return;
          }
          resolve(json);
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Paymob timeout'));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function authToken() {
  if (stubAllowed()) return 'stub_auth_token';
  const api_key = String(process.env.PAYMOB_API_KEY || '').trim();
  const res = await requestJson('POST', '/api/auth/tokens', { api_key });
  if (!res.token) throw new Error('Paymob auth token missing');
  return res.token;
}

/**
 * Paymob callback HMAC (SHA512) over concatenated transaction fields.
 * @see Paymob Accept transaction processed callback docs
 */
function buildHmacMessage(obj) {
  const o = obj || {};
  const order = o.order || {};
  const source = o.source_data || {};
  const parts = [
    o.amount_cents,
    o.created_at,
    o.currency,
    o.error_occured,
    o.has_parent_transaction,
    o.id,
    o.integration_id,
    o.is_3d_secure,
    o.is_auth,
    o.is_capture,
    o.is_refunded,
    o.is_standalone_payment,
    o.is_voided,
    order.id,
    o.owner,
    o.pending,
    source.pan,
    source.sub_type,
    source.type,
    o.success,
  ].map((v) => (v === undefined || v === null ? '' : String(v)));
  return parts.join('');
}

function verifyTransactionHmac(transaction, hmacHeader) {
  const secret = String(process.env.PAYMOB_HMAC_SECRET || '').trim();
  if (!secret || !hmacHeader) return false;
  const msg = buildHmacMessage(transaction);
  const expected = crypto.createHmac('sha512', secret).update(msg).digest('hex');
  const a = Buffer.from(String(expected).toLowerCase());
  const b = Buffer.from(String(hmacHeader).toLowerCase());
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function signTransaction(transaction) {
  const secret = String(process.env.PAYMOB_HMAC_SECRET || '').trim();
  return crypto.createHmac('sha512', secret).update(buildHmacMessage(transaction)).digest('hex');
}

/**
 * Create Paymob hosted checkout for a package order.
 * amountMajor is in settlement currency (usually EGP).
 */
async function createHostedPayment({
  orderRef,
  amountMajor,
  currency,
  customerEmail,
  customerName,
  appUrl,
  points,
  packageId,
}) {
  if (!configured()) {
    const err = new Error('Paymob غير مُعد');
    err.status = 503;
    throw err;
  }
  const cur = String(currency || settlementCurrency()).toUpperCase();
  const amountCents = Math.round(Number(amountMajor) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    const err = new Error('مبلغ تحصيل غير صالح');
    err.status = 400;
    throw err;
  }

  if (stubAllowed()) {
    const stubTxId = `stub_tx_${Date.now()}`;
    const checkoutUrl = `${String(appUrl).replace(/\/$/, '')}/packages-paymob-return.html?stub=1&ref=${encodeURIComponent(orderRef)}&tx=${encodeURIComponent(stubTxId)}`;
    return {
      provider: 'paymob',
      mode: 'stub',
      checkoutUrl,
      paymobOrderId: `stub_order_${orderRef}`,
      paymentToken: 'stub_token',
      amountCents,
      currency: cur,
      stubTxId,
    };
  }

  const token = await authToken();
  const merchantOrderId = orderRef;
  const order = await requestJson('POST', '/api/ecommerce/orders', {
    auth_token: token,
    delivery_needed: false,
    amount_cents: amountCents,
    currency: cur,
    merchant_order_id: merchantOrderId,
    items: [
      {
        name: `NAIOSH points ${points || ''}`.trim(),
        amount_cents: amountCents,
        quantity: 1,
        description: packageId || orderRef,
      },
    ],
  });

  const billing = {
    email: customerEmail || 'customer@naiosh.local',
    first_name: String(customerName || 'NAIOSH').split(/\s+/)[0] || 'NAIOSH',
    last_name: String(customerName || 'Customer').split(/\s+/).slice(1).join(' ') || 'Customer',
    phone_number: '01000000000',
    apartment: 'NA',
    floor: 'NA',
    street: 'NA',
    building: 'NA',
    shipping_method: 'NA',
    postal_code: 'NA',
    city: 'Cairo',
    country: 'EG',
    state: 'Cairo',
  };

  const paymentKey = await requestJson('POST', '/api/acceptance/payment_keys', {
    auth_token: token,
    amount_cents: amountCents,
    expiration: 3600,
    order_id: order.id,
    billing_data: billing,
    currency: cur,
    integration_id: Number(process.env.PAYMOB_INTEGRATION_ID),
    lock_order_when_paid: true,
  });

  const iframe = iframeId();
  if (!iframe) {
    const err = new Error('PAYMOB_IFRAME_ID غير مضبوط');
    err.status = 503;
    throw err;
  }
  const checkoutUrl = `https://${ACCEPT_HOST}/api/acceptance/iframes/${iframe}?payment_token=${encodeURIComponent(paymentKey.token)}`;
  return {
    provider: 'paymob',
    mode: 'live_api',
    checkoutUrl,
    paymobOrderId: String(order.id),
    paymentToken: paymentKey.token,
    amountCents,
    currency: cur,
  };
}

async function refundTransaction(transactionId, amountCents) {
  if (stubAllowed()) {
    return { ok: true, mode: 'stub', id: `stub_refund_${transactionId}`, amount_cents: amountCents };
  }
  if (!configured()) {
    const err = new Error('Paymob غير مُعد');
    err.status = 503;
    throw err;
  }
  const token = await authToken();
  const res = await requestJson('POST', '/api/acceptance/void_refund/refund', {
    auth_token: token,
    transaction_id: transactionId,
    amount_cents: amountCents,
  });
  return res;
}

function parseCallbackPayload(json) {
  // Paymob may send { obj: transaction, type } or flat transaction
  const type = json?.type || json?.event || 'TRANSACTION';
  const tx = json?.obj || json?.transaction || json;
  return { type, transaction: tx };
}

module.exports = {
  configured,
  stubAllowed,
  isProductionLike,
  mode,
  liveChargesEnabled,
  publicModeStatus,
  settlementCurrency,
  createHostedPayment,
  verifyTransactionHmac,
  signTransaction,
  buildHmacMessage,
  parseCallbackPayload,
  refundTransaction,
  authToken,
};
