/**
 * Subscription packages + points wallet ops for NAIOSH HUB 360.
 * - Catalog prices are server-side only (never trust browser).
 * - Paid credits require verified payment (Paymob/Stripe webhook HMAC) or admin confirm.
 * - Free 300 points once per client (welcomeCredited / freePackageClaimed).
 */
'use strict';

const crypto = require('crypto');
const https = require('https');
const hubSession = require('./hub-session');
const fx = require('./hub-fx-rates');
const geo = require('./hub-countries-currencies');
const payGateways = require('./hub-payment-gateways');
const paymob = require('./hub-paymob');

const PACKAGES = Object.freeze([
  {
    id: 'free-300',
    kind: 'free',
    nameAr: 'الباقة المجانية',
    points: 300,
    priceUsd: 0,
    descriptionAr: '300 نقطة تُمنح مرة واحدة لكل عميل مؤهل بعد التحقق من الهوية/الاعتماد.',
  },
  {
    id: 'pack-6000',
    kind: 'paid',
    nameAr: 'باقة 6,000 نقطة',
    points: 6000,
    priceUsd: 15,
    descriptionAr: 'شحن 6,000 نقطة مدفوعة إلى محفظتك لاستخدامها في خدمات نايوش هوب المسعّرة بالنقاط.',
  },
  {
    id: 'pack-16000',
    kind: 'paid',
    nameAr: 'باقة 16,000 نقطة',
    points: 16000,
    priceUsd: 35,
    descriptionAr: 'شحن 16,000 نقطة مدفوعة إلى محفظتك لاستخدامها في خدمات نايوش هوب المسعّرة بالنقاط.',
  },
]);

function portal() {
  return require('./hub-client-portal');
}
function posha() {
  return require('./hub-posha-ops');
}
function poshaOs() {
  return require('./hub-posha-os');
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Hub-Token, X-Hub-User-Role, X-Hub-User-Name, X-Hub-User-Email, Stripe-Signature, hmac',
  });
  res.end(JSON.stringify(payload));
}

async function persistPackageOrderPg(order) {
  return persistPackageOrderRow(order);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  const text = raw.toString('utf8');
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = {};
    }
  }
  return { json, raw, text };
}

function stripeConfigured() {
  return Boolean(String(process.env.STRIPE_SECRET_KEY || '').trim());
}

function paymentStatusPublic() {
  return payGateways.paymentStatusPublic();
}

async function persistPackageOrderRow(order) {
  if (!order?.id) return;
  try {
    const { getPool, getDatabaseUrl } = require('../db/migrate');
    if (!getDatabaseUrl()) return;
    const pool = getPool();
    await pool.query(
      `INSERT INTO hub_package_orders (
         id, ref, package_id, kind, points, price_usd, settlement_currency, settlement_amount,
         display_currency, display_amount, client_email, status, payment_status, method,
         credited, idempotency_key, stripe_session_id, payload, created_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,
         COALESCE($19::timestamptz, NOW()), NOW()
       )
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         payment_status = EXCLUDED.payment_status,
         credited = EXCLUDED.credited,
         stripe_session_id = COALESCE(EXCLUDED.stripe_session_id, hub_package_orders.stripe_session_id),
         payload = EXCLUDED.payload,
         updated_at = NOW()`,
      [
        order.id,
        order.ref,
        order.packageId,
        order.kind,
        order.points,
        order.priceUsd,
        order.settlementCurrency || 'USD',
        order.settlementAmount || 0,
        order.displayCurrency || null,
        order.displayAmount || null,
        order.clientEmail,
        order.status,
        order.paymentStatus,
        order.method,
        Boolean(order.credited),
        order.idempotencyKey || null,
        order.stripeSessionId || null,
        JSON.stringify(order),
        order.createdAt || null,
      ]
    );
  } catch (err) {
    console.warn('[packages] persist order:', err.message);
  }
}

async function persistWalletDurable(store, client) {
  portal().writeStore(store);
  try {
    if (typeof portal().writeStoreAndFlush === 'function') {
      await portal().writeStoreAndFlush(store);
    } else if (typeof portal().flushDurable === 'function') {
      await portal().flushDurable();
    }
  } catch (err) {
    console.warn('[packages] durable flush:', err.message);
  }
  try {
    const rel = require('./hub-customer-relational');
    if (rel.dbEnabled && rel.dbEnabled() && client) {
      await rel.upsertClientAccount(client);
    }
  } catch (err) {
    console.warn('[packages] relational wallet upsert:', err.message);
  }
}

function getPackage(id) {
  return PACKAGES.find((p) => p.id === id) || null;
}

function ensureWallet(client) {
  client.wallet = client.wallet || { paid: 0, free: 0, total: 0, ledger: [] };
  client.wallet.paid = Number(client.wallet.paid) || 0;
  client.wallet.free = Number(client.wallet.free) || 0;
  client.wallet.total = client.wallet.paid + client.wallet.free;
  client.wallet.ledger = Array.isArray(client.wallet.ledger) ? client.wallet.ledger : [];
  return client.wallet;
}

function packageOrders(store) {
  if (!store.packageOrders) store.packageOrders = [];
  return store.packageOrders;
}

function servicePrices(store) {
  if (!store.servicePointPrices) {
    // Seed from operational catalog — points cost = USD price for wallet payments (existing convention)
    const catalog = poshaOs().catalog ? poshaOs().catalog() : [];
    store.servicePointPrices = catalog
      .filter((x) => x && x.available !== false)
      .map((x) => ({
        id: x.id,
        sku: x.sku || x.id,
        nameAr: x.name,
        type: x.type,
        pointsCost: Math.round(Number(x.price) || 0),
        source: 'catalog',
        updatedAt: new Date().toISOString(),
      }));
  }
  return store.servicePointPrices;
}

function creditWalletOnce(client, { amount, bucket, note, reference, idempotencyKey }) {
  const w = ensureWallet(client);
  const key = String(idempotencyKey || reference || '');
  if (key && w.ledger.some((e) => e.idempotencyKey === key || e.reference === key)) {
    return { ok: true, duplicate: true, wallet: w };
  }
  const pts = Math.floor(Number(amount) || 0);
  if (pts <= 0) return { ok: false, error: 'مبلغ نقاط غير صالح' };
  if (bucket === 'free') w.free += pts;
  else w.paid += pts;
  w.total = w.paid + w.free;
  w.ledger.unshift({
    id: uid('led'),
    at: new Date().toISOString(),
    type: 'credit',
    bucket: bucket === 'free' ? 'free' : 'paid',
    amount: pts,
    note: note || 'شحن نقاط',
    reference: reference || null,
    idempotencyKey: key || null,
  });
  // keep ledger bounded
  if (w.ledger.length > 500) w.ledger.length = 500;
  return { ok: true, duplicate: false, wallet: w };
}

function listPackagesPayload(serviceList) {
  return {
    packages: PACKAGES.map((p) => ({
      id: p.id,
      kind: p.kind,
      nameAr: p.nameAr,
      points: p.points,
      priceUsd: p.priceUsd,
      descriptionAr: p.descriptionAr,
    })),
    servicePointPrices: (serviceList || []).slice(0, 40).map((s) => ({
      id: s.id,
      nameAr: s.nameAr,
      pointsCost: s.pointsCost,
      type: s.type,
    })),
    payment: paymentStatusPublic(),
    notesAr: [
      'الأسعار المرجعية للباقات المدفوعة بالدولار الأمريكي (USD).',
      'عرض السعر بعملة أخرى للعرض فقط، وقد تختلف عملة التحصيل الفعلية.',
      'لا تُضاف النقاط المدفوعة إلا بعد تحقق الخادم من الدفع أو تأكيد إداري موثّق.',
      'الباقة المجانية تُمنح مرة واحدة فقط لكل عميل مؤهل.',
    ],
  };
}

async function buildQuote({ packageId, currency, countryCode, preferGateway }) {
  const pkg = getPackage(packageId);
  if (!pkg) return { ok: false, error: 'الباقة غير موجودة' };
  const pay = paymentStatusPublic();
  const ratesBundle = await fx.getRates();
  const code = String(currency || 'USD').toUpperCase();
  const converted = fx.convertFromUsd(pkg.priceUsd, code, ratesBundle.rates);
  const preferred =
    (preferGateway && pay.gateways.find((g) => g.id === preferGateway && g.configured)) ||
    payGateways.preferredGatewayForCurrency(code) ||
    (pay.gateway ? pay.gateways.find((g) => g.id === pay.gateway) : null);
  const settleList =
    preferred && preferred.settlementCurrencies && preferred.settlementCurrencies.length
      ? preferred.settlementCurrencies
      : pay.settlementCurrencies;
  // Egypt-first default when Paymob is primary and display currency is not a Paymob settlement currency.
  let settlementCurrency = settleList.includes(code) ? code : settleList[0] || 'USD';
  if (preferred?.id === 'paymob' && !settleList.includes(code)) {
    settlementCurrency = paymob.settlementCurrency() || settleList[0] || 'EGP';
  }
  const settlement = fx.convertFromUsd(pkg.priceUsd, settlementCurrency, ratesBundle.rates);
  return {
    ok: true,
    package: pkg,
    display: converted || fx.convertFromUsd(pkg.priceUsd, 'USD', ratesBundle.rates),
    settlement: {
      currency: settlementCurrency,
      amount: settlement ? settlement.amount : pkg.priceUsd,
      rate: settlement ? settlement.rate : 1,
      decimals: settlement ? settlement.decimals : 2,
      gateway: preferred?.id || pay.gateway || null,
      acceptedByGateway: pay.available && settleList.includes(settlementCurrency),
      noteAr:
        code !== settlementCurrency
          ? `عملة العرض ${code} غير مقبولة للتحصيل عبر ${preferred?.nameAr || 'البوابة'}؛ سيتم التحصيل بـ ${settlementCurrency}.`
          : pay.available
            ? `سيتم التحصيل بـ ${settlementCurrency}${preferred ? ` عبر ${preferred.nameAr}` : ''}.`
            : 'بوابة الدفع غير مفعّلة — لن يُفتح تحصيل إلكتروني.',
    },
    fx: {
      base: 'USD',
      provider: ratesBundle.provider,
      updatedAt: ratesBundle.updatedAt,
      fetchedAt: ratesBundle.fetchedAt,
      stale: Boolean(ratesBundle.stale),
      rate: converted ? converted.rate : 1,
    },
    countryCode: countryCode || null,
    payment: pay,
  };
}

function createOrderRecord(store, client, pkg, quote, { method, status }) {
  const ref = uid('PKG');
  const order = {
    id: uid('pko'),
    ref,
    packageId: pkg.id,
    packageNameAr: pkg.nameAr,
    points: pkg.points,
    kind: pkg.kind,
    priceUsd: pkg.priceUsd,
    displayCurrency: quote.display?.currency || 'USD',
    displayAmount: quote.display?.amount ?? pkg.priceUsd,
    settlementCurrency: quote.settlement?.currency || 'USD',
    settlementAmount: quote.settlement?.amount ?? pkg.priceUsd,
    fxRate: quote.fx?.rate || 1,
    fxUpdatedAt: quote.fx?.updatedAt || null,
    clientEmail: client.email,
    clientName: client.name || client.email,
    country: client.country || '',
    method: method || 'none',
    status: status || 'created',
    paymentStatus: 'unpaid',
    credited: false,
    idempotencyKey: `credit:${ref}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    events: [{ at: new Date().toISOString(), label: 'إنشاء الطلب', status }],
  };
  packageOrders(store).unshift(order);
  client.packageOrders = Array.isArray(client.packageOrders) ? client.packageOrders : [];
  client.packageOrders.unshift({ id: order.id, ref: order.ref, packageId: order.packageId, status: order.status, createdAt: order.createdAt });
  return order;
}

function fulfillOrder(store, order, { actorEmail, actorRole, source }) {
  if (!order) return { ok: false, error: 'الطلب غير موجود' };
  if (order.credited) return { ok: true, duplicate: true, order };
  const client = portal().ensureClient(store, order.clientEmail);
  const bucket = order.kind === 'free' ? 'free' : 'paid';
  const credited = creditWalletOnce(client, {
    amount: order.points,
    bucket,
    note: `باقة: ${order.packageNameAr}`,
    reference: order.ref,
    idempotencyKey: order.idempotencyKey,
  });
  if (!credited.ok) return credited;
  order.credited = true;
  order.paymentStatus = order.kind === 'free' ? 'free_grant' : 'paid';
  order.status = 'fulfilled';
  order.updatedAt = new Date().toISOString();
  order.events = order.events || [];
  order.events.push({
    at: new Date().toISOString(),
    label: credited.duplicate ? 'تجاهل تكرار إضافة النقاط' : 'إضافة النقاط للمحفظة',
    status: 'fulfilled',
    source: source || 'server',
  });
  if (order.kind === 'free') {
    client.welcomeCredited = true;
    client.freePackageClaimed = true;
    client.freePackageClaimedAt = new Date().toISOString();
  }
  posha().emitEvent(store, {
    type: 'WALLET_CREDITED',
    clientEmail: client.email,
    actorId: actorEmail || 'system',
    actorRole: actorRole || 'system',
    title: `شحن باقة +${order.points}`,
    message: `${order.packageNameAr} · ${order.ref}`,
    metadata: { orderId: order.id, ref: order.ref, points: order.points, duplicate: credited.duplicate },
  });
  // Fire-and-await persistence is handled by callers that can await; sync best-effort here.
  portal().writeStore(store);
  persistWalletDurable(store, client).catch(() => {});
  persistPackageOrderPg(order).catch(() => {});
  return { ok: true, duplicate: credited.duplicate, order, wallet: client.wallet, client };
}

function reverseFulfilledOrder(store, order, { actorEmail, actorRole, source, reason }) {
  if (!order) return { ok: false, error: 'الطلب غير موجود' };
  if (!order.credited) {
    order.status = 'refunded';
    order.paymentStatus = 'refunded';
    order.updatedAt = new Date().toISOString();
    return { ok: true, skipped: true, order };
  }
  if (order.refunded || order.status === 'refunded_partial') {
    return { ok: true, duplicate: true, order, partial: order.status === 'refunded_partial' };
  }
  const client = portal().ensureClient(store, order.clientEmail);
  const w = ensureWallet(client);
  const refundKey = `refund:${order.ref}`;
  if (w.ledger.some((e) => e.idempotencyKey === refundKey)) {
    order.refunded = true;
    return { ok: true, duplicate: true, order, wallet: w, client };
  }
  const need = Math.floor(Number(order.points) || 0);
  const available = Math.floor(Number(w.total) || 0);
  const claw = Math.min(need, available);
  const shortfall = Math.max(0, need - claw);

  if (claw <= 0) {
    order.status = 'refunded_partial';
    order.paymentStatus = 'refund_shortfall';
    order.refundShortfallPoints = shortfall;
    order.refundClawedPoints = 0;
    order.updatedAt = new Date().toISOString();
    order.events = order.events || [];
    order.events.push({
      at: new Date().toISOString(),
      label: `استرداد بدون رصيد كافٍ — عجز ${shortfall} نقطة (استُخدمت مسبقًا)`,
      status: 'refund_shortfall',
      source: source || 'server',
      actor: actorEmail || null,
    });
    portal().writeStore(store);
    persistPackageOrderPg(order).catch(() => {});
    return {
      ok: true,
      partial: true,
      shortfall,
      clawed: 0,
      order,
      wallet: w,
      client,
      warningAr: 'تم تسجيل الاسترداد مع عجز نقاط لأن العميل استخدم جزءًا من الرصيد.',
    };
  }

  const debited = poshaOs().debitWallet(w, claw, reason || `استرداد باقة ${order.packageNameAr}`, order.ref);
  if (!debited.ok) {
    order.events = order.events || [];
    order.events.push({
      at: new Date().toISOString(),
      label: `تعذّر خصم الاسترداد: ${debited.error}`,
      status: 'refund_failed',
      source: source || 'server',
    });
    portal().writeStore(store);
    return { ok: false, error: debited.error || 'رصيد غير كافٍ للاسترداد', order };
  }
  if (debited.wallet.ledger[0]) {
    debited.wallet.ledger[0].idempotencyKey = refundKey;
    debited.wallet.ledger[0].type = shortfall > 0 ? 'debit_refund_partial' : 'debit_refund';
  }
  client.wallet = debited.wallet;
  order.refundClawedPoints = claw;
  order.refundShortfallPoints = shortfall;
  order.refunded = shortfall === 0;
  order.paymentStatus = shortfall > 0 ? 'refund_partial' : 'refunded';
  order.status = shortfall > 0 ? 'refunded_partial' : 'refunded';
  order.updatedAt = new Date().toISOString();
  order.events = order.events || [];
  order.events.push({
    at: new Date().toISOString(),
    label:
      shortfall > 0
        ? `استرداد جزئي: خُصم ${claw} من ${need} نقطة (عجز ${shortfall} بعد استخدام سابق)`
        : `استرداد وخصم ${need} نقطة`,
    status: order.status,
    source: source || 'server',
    actor: actorEmail || null,
  });
  posha().emitEvent(store, {
    type: 'WALLET_DEBITED',
    clientEmail: client.email,
    actorId: actorEmail || 'system',
    actorRole: actorRole || 'system',
    title: shortfall > 0 ? `استرداد جزئي −${claw}` : `استرداد باقة −${need}`,
    message: `${order.packageNameAr} · ${order.ref}`,
    metadata: { orderId: order.id, ref: order.ref, points: need, clawed: claw, shortfall },
  });
  portal().writeStore(store);
  persistWalletDurable(store, client).catch(() => {});
  persistPackageOrderPg(order).catch(() => {});
  return {
    ok: true,
    duplicate: false,
    partial: shortfall > 0,
    shortfall,
    clawed: claw,
    order,
    wallet: client.wallet,
    client,
    warningAr:
      shortfall > 0
        ? 'تم خصم المتاح فقط؛ جزء من النقاط كان قد استُخدم قبل الاسترداد.'
        : undefined,
  };
}

function findOrderByPaymob(store, transaction) {
  const orders = packageOrders(store);
  const merchantOrderId = String(transaction?.order?.merchant_order_id || transaction?.merchant_order_id || '');
  const paymobOrderId = String(transaction?.order?.id || '');
  const txId = String(transaction?.id || '');
  return (
    orders.find((o) => o.ref === merchantOrderId || o.id === merchantOrderId) ||
    orders.find((o) => o.paymobOrderId && String(o.paymobOrderId) === paymobOrderId) ||
    orders.find((o) => o.paymobTransactionId && String(o.paymobTransactionId) === txId) ||
    null
  );
}

async function processPaymobTransaction(store, transaction, { source }) {
  const order = findOrderByPaymob(store, transaction);
  if (!order) return { ok: false, status: 404, error: 'الطلب غير موجود' };

  order.paymobTransactionId = String(transaction.id || order.paymobTransactionId || '');
  order.paymobOrderId = String(transaction.order?.id || order.paymobOrderId || '');
  order.paymobRawSuccess = transaction.success;
  order.updatedAt = new Date().toISOString();
  order.events = order.events || [];

  const isRefund = String(transaction.is_refunded) === 'true' || transaction.is_refunded === true;
  const success = String(transaction.success) === 'true' || transaction.success === true;
  const pending = String(transaction.pending) === 'true' || transaction.pending === true;

  if (isRefund) {
    const reversed = reverseFulfilledOrder(store, order, {
      actorEmail: 'paymob-webhook',
      actorRole: 'system',
      source: source || 'paymob_refund',
      reason: `استرداد Paymob #${transaction.id}`,
    });
    if (reversed.ok && reversed.client) await persistWalletDurable(store, reversed.client);
    await persistPackageOrderPg(order);
    return { ok: reversed.ok, status: reversed.ok ? 200 : 409, order, duplicate: reversed.duplicate, refunded: true, error: reversed.error };
  }

  if (pending) {
    order.status = 'awaiting_payment';
    order.paymentStatus = 'pending';
    order.events.push({ at: new Date().toISOString(), label: 'دفع Paymob معلّق', status: 'pending', source });
    await persistPackageOrderPg(order);
    portal().writeStore(store);
    return { ok: true, status: 200, pending: true, order };
  }

  if (!success) {
    order.status = 'payment_failed';
    order.paymentStatus = 'failed';
    order.events.push({
      at: new Date().toISOString(),
      label: 'فشل دفع Paymob — لم تُضف نقاط',
      status: 'failed',
      source,
    });
    await persistPackageOrderPg(order);
    portal().writeStore(store);
    return { ok: true, status: 200, failed: true, credited: false, order };
  }

  // Currency + amount guards — refuse credit on mismatch
  const txCurrency = String(transaction.currency || '').toUpperCase();
  const orderCurrency = String(order.settlementCurrency || '').toUpperCase();
  if (txCurrency && orderCurrency && txCurrency !== orderCurrency) {
    order.status = 'payment_currency_mismatch';
    order.paymentStatus = 'mismatch';
    order.events.push({
      at: new Date().toISOString(),
      label: `رفض إضافة النقاط: عملة مختلفة (expected ${orderCurrency} got ${txCurrency})`,
      status: 'failed',
      source,
    });
    await persistPackageOrderPg(order);
    portal().writeStore(store);
    return { ok: false, status: 409, error: 'عملة التحصيل لا تطابق الطلب', order };
  }
  const expectedCents = Math.round(Number(order.settlementAmount || 0) * 100);
  const paidCents = Number(transaction.amount_cents);
  if (Number.isFinite(expectedCents) && expectedCents > 0 && Number.isFinite(paidCents)) {
    const drift = Math.abs(paidCents - expectedCents);
    if (drift > Math.max(2, Math.round(expectedCents * 0.02))) {
      order.status = 'payment_amount_mismatch';
      order.paymentStatus = 'mismatch';
      order.events.push({
        at: new Date().toISOString(),
        label: `رفض إضافة النقاط: مبلغ مختلف (expected ${expectedCents} got ${paidCents})`,
        status: 'failed',
        source,
      });
      await persistPackageOrderPg(order);
      portal().writeStore(store);
      return { ok: false, status: 409, error: 'مبلغ التحصيل لا يطابق الطلب', order };
    }
  }

  order.paymentStatus = 'paid';
  order.status = 'paid_pending_credit';
  order.events.push({ at: new Date().toISOString(), label: 'تحقق دفع Paymob ناجح', status: 'paid', source });
  const result = fulfillOrder(store, order, {
    actorEmail: 'paymob-webhook',
    actorRole: 'system',
    source: source || 'paymob_webhook',
  });
  if (result.ok && result.client) {
    await persistWalletDurable(store, result.client);
    await persistPackageOrderPg(order);
  }
  return {
    ok: result.ok,
    status: result.ok ? 200 : 400,
    credited: result.ok,
    duplicate: result.duplicate,
    order,
    error: result.error,
  };
}

async function stripeRequest(method, pathName, formBody) {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) throw new Error('Stripe غير مُعد');
  const body = new URLSearchParams(formBody || {}).toString();
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.stripe.com',
        path: pathName,
        method,
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 20000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = {};
          try {
            json = JSON.parse(text);
          } catch {
            json = { raw: text };
          }
          if (res.statusCode >= 400) {
            const err = new Error(json.error?.message || `Stripe HTTP ${res.statusCode}`);
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
      reject(new Error('Stripe timeout'));
    });
    req.write(body);
    req.end();
  });
}

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!secret || !signatureHeader || !rawBody) return false;
  const parts = String(signatureHeader).split(',').reduce((acc, p) => {
    const [k, v] = p.split('=');
    if (k && v) acc[k.trim()] = (acc[k.trim()] || []).concat(v.trim());
    return acc;
  }, {});
  const timestamp = parts.t && parts.t[0];
  const sigs = parts.v1 || [];
  if (!timestamp || !sigs.length) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 60 * 5) return false;
  const signed = `${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  return sigs.some((s) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(s));
    } catch {
      return false;
    }
  });
}

async function handlePackagesApi(req, res, pathname) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return true;
  }

  // Public catalog + FX
  if (pathname === '/api/hub/packages' && req.method === 'GET') {
    const store = portal().readStore();
    sendJson(res, 200, { ok: true, ...listPackagesPayload(servicePrices(store)) });
    return true;
  }

  if (pathname === '/api/hub/packages/countries' && req.method === 'GET') {
    const url = new URL(req.url, 'http://local');
    const q = url.searchParams.get('q') || '';
    const base = geo.searchCountriesCurrencies(q);
    // Merge FX-supported currencies so display picker covers all rates we can convert.
    try {
      const rates = await fx.getRates();
      const fxCodes = Object.keys(rates.rates || {}).sort();
      const byCode = new Map((base.currencies || []).map((c) => [c.code, c]));
      for (const code of fxCodes) {
        if (!byCode.has(code)) {
          const meta = geo.CURRENCY_META[code] || { nameAr: code, nameEn: code, symbol: code };
          byCode.set(code, { code, ...meta, fromFx: true });
        }
      }
      base.currencies = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
      base.fxCurrencyCount = fxCodes.length;
      base.noteAr =
        'عملة العرض للتحويل التقريبي من كل العملات المدعومة في أسعار الصرف. عملة التحصيل الفعلية تعتمد على بوابة الدفع ودولة التاجر.';
    } catch {
      base.noteAr = 'تعذّر دمج عملات الصرف؛ القائمة الأساسية متاحة.';
    }
    sendJson(res, 200, { ok: true, ...base });
    return true;
  }

  if (pathname === '/api/hub/packages/fx' && req.method === 'GET') {
    try {
      const url = new URL(req.url, 'http://local');
      const force = url.searchParams.get('refresh') === '1';
      const rates = await fx.getRates({ force });
      sendJson(res, 200, {
        ok: true,
        base: rates.base,
        provider: rates.provider,
        updatedAt: rates.updatedAt,
        fetchedAt: rates.fetchedAt,
        stale: Boolean(rates.stale),
        currencies: Object.keys(rates.rates || {}).sort(),
        sample: {
          SAR: rates.rates.SAR,
          EGP: rates.rates.EGP,
          EUR: rates.rates.EUR,
        },
      });
    } catch (err) {
      sendJson(res, 503, { ok: false, error: 'تعذّر جلب أسعار الصرف', detail: err.message });
    }
    return true;
  }

  if (pathname === '/api/hub/packages/quote' && req.method === 'POST') {
    const { json } = await readBody(req);
    const quote = await buildQuote({
      packageId: json.packageId,
      currency: json.currency,
      countryCode: json.countryCode,
    });
    if (!quote.ok) {
      sendJson(res, 400, quote);
      return true;
    }
    sendJson(res, 200, quote);
    return true;
  }

  // Paymob processed callback / webhook (no session) — HMAC required
  if (pathname === '/api/hub/packages/paymob/webhook' && req.method === 'POST') {
    const { json } = await readBody(req);
    const url = new URL(req.url, 'http://local');
    const hmac =
      url.searchParams.get('hmac') ||
      req.headers['hmac'] ||
      req.headers['x-paymob-hmac'] ||
      json?.hmac ||
      '';
    if (!paymob.configured() && !paymob.stubAllowed()) {
      sendJson(res, 503, { ok: false, error: 'Paymob غير مُعد' });
      return true;
    }
    const { transaction } = paymob.parseCallbackPayload(json);
    if (!transaction || !transaction.id) {
      sendJson(res, 400, { ok: false, error: 'حمولة Paymob غير صالحة' });
      return true;
    }
    if (!paymob.verifyTransactionHmac(transaction, hmac)) {
      sendJson(res, 400, { ok: false, error: 'توقيع HMAC غير صالح' });
      return true;
    }
    const store = portal().readStore();
    const result = await processPaymobTransaction(store, transaction, { source: 'paymob_webhook' });
    sendJson(res, result.status || 200, {
      ok: result.ok,
      received: true,
      credited: Boolean(result.credited),
      duplicate: Boolean(result.duplicate),
      failed: Boolean(result.failed),
      refunded: Boolean(result.refunded),
      pending: Boolean(result.pending),
      error: result.error || undefined,
      ref: result.order?.ref,
    });
    return true;
  }

  // Stub-only completion (sandbox). Forbidden in production via paymob.stubAllowed().
  if (pathname === '/api/hub/packages/paymob/stub-complete' && req.method === 'POST') {
    if (!paymob.stubAllowed()) {
      sendJson(res, 403, { ok: false, error: 'وضع Paymob التجريبي غير مسموح' });
      return true;
    }
    if (!paymob.configured()) {
      sendJson(res, 503, { ok: false, error: 'Paymob غير مُعد للوضع التجريبي' });
      return true;
    }
    const { json } = await readBody(req);
    const store = portal().readStore();
    const order = packageOrders(store).find((o) => o.ref === json.ref || o.id === json.id);
    if (!order) {
      sendJson(res, 404, { ok: false, error: 'الطلب غير موجود' });
      return true;
    }
    const success = json.success !== false && json.success !== 'false';
    const amountCents = Math.round(Number(order.settlementAmount || 0) * 100);
    const transaction = {
      id: json.tx || order.paymobTransactionId || `stub_tx_${Date.now()}`,
      amount_cents: amountCents,
      created_at: new Date().toISOString(),
      currency: order.settlementCurrency || 'EGP',
      error_occured: success ? 'false' : 'true',
      has_parent_transaction: 'false',
      integration_id: String(process.env.PAYMOB_INTEGRATION_ID || '0'),
      is_3d_secure: 'false',
      is_auth: 'false',
      is_capture: 'false',
      is_refunded: json.refunded ? 'true' : 'false',
      is_standalone_payment: 'true',
      is_voided: 'false',
      order: {
        id: order.paymobOrderId || `stub_order_${order.ref}`,
        merchant_order_id: order.ref,
      },
      owner: 'stub',
      pending: json.pending ? 'true' : 'false',
      source_data: { pan: 'xxxx', sub_type: 'Visa', type: 'card' },
      success: success ? 'true' : 'false',
    };
    const hmac = paymob.signTransaction(transaction);
    // Process via same path as webhook (HMAC verified)
    if (!paymob.verifyTransactionHmac(transaction, hmac)) {
      sendJson(res, 500, { ok: false, error: 'فشل توقيع الوضع التجريبي' });
      return true;
    }
    order.paymobOrderId = String(transaction.order.id);
    order.paymobTransactionId = String(transaction.id);
    const result = await processPaymobTransaction(store, transaction, { source: 'paymob_stub' });
    sendJson(res, result.status || 200, {
      ok: result.ok,
      stub: true,
      hmacOk: true,
      credited: Boolean(result.credited),
      duplicate: Boolean(result.duplicate),
      failed: Boolean(result.failed),
      refunded: Boolean(result.refunded),
      ref: order.ref,
      wallet: result.order
        ? ensureWallet(portal().ensureClient(store, order.clientEmail))
        : undefined,
      error: result.error,
    });
    return true;
  }

  // Stripe webhook (no session)
  if (pathname === '/api/hub/packages/stripe/webhook' && req.method === 'POST') {
    const { raw, json } = await readBody(req);
    const secret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
    if (secret) {
      const sig = req.headers['stripe-signature'];
      if (!verifyStripeSignature(raw, sig, secret)) {
        sendJson(res, 400, { ok: false, error: 'توقيع Stripe غير صالح' });
        return true;
      }
    } else if (!stripeConfigured()) {
      sendJson(res, 503, { ok: false, error: 'Stripe غير مُعد' });
      return true;
    }
    const event = json;
    const type = event?.type;
    const sessionObj = event?.data?.object || {};
    const ref = sessionObj.metadata?.hubOrderRef || sessionObj.client_reference_id;
    if (type === 'checkout.session.completed' && sessionObj.payment_status === 'paid' && ref) {
      const store = portal().readStore();
      const order = packageOrders(store).find((o) => o.ref === ref || o.id === ref);
      if (!order) {
        sendJson(res, 404, { ok: false, error: 'الطلب غير موجود' });
        return true;
      }
      order.stripeSessionId = sessionObj.id;
      order.stripePaymentIntent = sessionObj.payment_intent || null;
      order.paymentStatus = 'paid';
      order.status = 'paid_pending_credit';
      const result = fulfillOrder(store, order, { actorEmail: 'stripe-webhook', actorRole: 'system', source: 'stripe_webhook' });
      if (result.ok && result.client) {
        await persistWalletDurable(store, result.client);
        await persistPackageOrderPg(order);
      }
      sendJson(res, 200, { ok: true, received: true, credited: result.ok, duplicate: result.duplicate });
      return true;
    }
    sendJson(res, 200, { ok: true, received: true, ignored: true });
    return true;
  }

  // Authenticated / semi-public client routes
  if (pathname.startsWith('/api/hub/packages/')) {
    const store = portal().readStore();
    const resolved = hubSession.resolveSession(req);
    const session = resolved.ok ? resolved : null;

    if (pathname === '/api/hub/packages/me' && req.method === 'GET') {
      const email = session?.email;
      let me = null;
      if (email && (hubSession.isClientLane(session.lane) || session.customerId)) {
        me = portal().ensureClient(store, email);
      }
      const suggest = geo.suggestFromCountryText(me?.country || '');
      const w = me ? ensureWallet(me) : null;
      const fullOrders = me
        ? packageOrders(store)
            .filter((o) => o.clientEmail === me.email)
            .slice(0, 40)
            .map((o) => ({
              id: o.id,
              ref: o.ref,
              packageId: o.packageId,
              packageNameAr: o.packageNameAr,
              points: o.points,
              kind: o.kind,
              priceUsd: o.priceUsd,
              displayCurrency: o.displayCurrency,
              displayAmount: o.displayAmount,
              settlementCurrency: o.settlementCurrency,
              settlementAmount: o.settlementAmount,
              status: o.status,
              paymentStatus: o.paymentStatus,
              method: o.method,
              credited: Boolean(o.credited),
              refunded: Boolean(o.refunded),
              refundClawedPoints: o.refundClawedPoints || 0,
              refundShortfallPoints: o.refundShortfallPoints || 0,
              createdAt: o.createdAt,
              updatedAt: o.updatedAt,
              receipt: {
                titleAr: o.credited ? 'إيصال شحن نقاط' : 'حالة طلب شحن',
                lines: [
                  `المرجع: ${o.ref}`,
                  `الباقة: ${o.packageNameAr}`,
                  `النقاط: ${o.points}`,
                  o.priceUsd ? `سعر مرجعي: ${o.priceUsd} USD` : null,
                  o.settlementAmount
                    ? `التحصيل: ${o.settlementAmount} ${o.settlementCurrency || ''}`.trim()
                    : null,
                  `الحالة: ${o.status}`,
                  `الدفع: ${o.paymentStatus}`,
                ].filter(Boolean),
              },
            }))
        : [];
      sendJson(res, 200, {
        ok: true,
        authenticated: Boolean(me),
        wallet: w,
        freeClaimed: Boolean(me && (me.freePackageClaimed || me.welcomeCredited)),
        country: me?.country || '',
        suggestedCountryCode: suggest.countryCode,
        suggestedCurrency: suggest.currency,
        orders: fullOrders,
        packageOrders: fullOrders,
        ledger: w ? (w.ledger || []).slice(0, 50) : [],
        payment: paymentStatusPublic(),
        ...listPackagesPayload(servicePrices(store)),
      });
      return true;
    }

    if (pathname === '/api/hub/packages/claim-free' && req.method === 'POST') {
      if (!session?.email) {
        sendJson(res, 401, { ok: false, error: 'يلزم تسجيل الدخول', loginUrl: 'login.html?next=packages.html' });
        return true;
      }
      const client = portal().ensureClient(store, session.email);
      if (client.freePackageClaimed || client.welcomeCredited) {
        sendJson(res, 409, {
          ok: false,
          error: 'الباقة المجانية مُنحت مسبقًا لهذا الحساب',
          wallet: ensureWallet(client),
        });
        return true;
      }
      // Soft anti-abuse: same phone already claimed
      const phone = String(client.phone || '').replace(/\D/g, '');
      if (phone) {
        const dup = Object.values(store.clients || {}).find(
          (c) => c && c.email !== client.email && (c.freePackageClaimed || c.welcomeCredited) && String(c.phone || '').replace(/\D/g, '') === phone
        );
        if (dup) {
          sendJson(res, 409, { ok: false, error: 'تم منح الباقة المجانية لهوية مرتبطة مسبقًا' });
          return true;
        }
      }
      const pkg = getPackage('free-300');
      const quote = await buildQuote({ packageId: 'free-300', currency: 'USD' });
      const order = createOrderRecord(store, client, pkg, quote, { method: 'free_grant', status: 'approved' });
      const result = fulfillOrder(store, order, { actorEmail: session.email, actorRole: 'client', source: 'claim_free' });
      if (result.ok) {
        await persistWalletDurable(store, client);
        await persistPackageOrderPg(order);
      }
      sendJson(res, result.ok ? 200 : 400, {
        ok: result.ok,
        order,
        wallet: result.wallet || ensureWallet(client),
        duplicate: result.duplicate,
        error: result.error,
      });
      return true;
    }

    if (pathname === '/api/hub/packages/checkout' && req.method === 'POST') {
      if (!session?.email) {
        sendJson(res, 401, { ok: false, error: 'يلزم تسجيل الدخول', loginUrl: 'login.html?next=packages.html' });
        return true;
      }
      const { json } = await readBody(req);
      const pkg = getPackage(json.packageId);
      if (!pkg || pkg.kind !== 'paid') {
        sendJson(res, 400, { ok: false, error: 'باقة مدفوعة غير صالحة' });
        return true;
      }
      // Never trust browser price/points
      const quote = await buildQuote({
        packageId: pkg.id,
        currency: json.currency || 'USD',
        countryCode: json.countryCode,
      });
      const client = portal().ensureClient(store, session.email);
      if (json.countryCode) {
        const c = geo.listCountries().find((x) => x.code === json.countryCode);
        if (c && !client.country) client.country = c.nameAr;
      }
      const method = String(json.method || '').toLowerCase();
      const pay = paymentStatusPublic();
      const appUrl =
        String(process.env.APP_URL || '').replace(/\/$/, '') ||
        `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;

      if (method === 'paymob' || method === 'auto' || (method === '' && pay.gateway === 'paymob')) {
        const usePaymob = method === 'paymob' || method === 'auto' || method === '';
        if (usePaymob && (pay.activeGatewayIds || []).includes('paymob')) {
          if (!paymob.configured()) {
            sendJson(res, 503, { ok: false, error: 'Paymob غير مُعد', payment: pay });
            return true;
          }
          // Re-quote preferring Paymob settlement (usually EGP)
          const paymobQuote = await buildQuote({
            packageId: pkg.id,
            currency: json.currency || 'EGP',
            countryCode: json.countryCode || 'EG',
            preferGateway: 'paymob',
          });
          const order = createOrderRecord(store, client, pkg, paymobQuote, {
            method: 'paymob',
            status: 'awaiting_payment',
          });
          try {
            const hosted = await paymob.createHostedPayment({
              orderRef: order.ref,
              amountMajor: order.settlementAmount,
              currency: order.settlementCurrency,
              customerEmail: client.email,
              customerName: client.name || client.email,
              appUrl,
              points: pkg.points,
              packageId: pkg.id,
            });
            order.paymobOrderId = hosted.paymobOrderId;
            order.checkoutUrl = hosted.checkoutUrl;
            order.paymobMode = hosted.mode;
            order.updatedAt = new Date().toISOString();
            order.events.push({
              at: new Date().toISOString(),
              label: hosted.mode === 'stub' ? 'إنشاء دفع Paymob تجريبي' : 'إنشاء دفع Paymob',
              status: 'awaiting_payment',
            });
            await persistWalletDurable(store, client);
            await persistPackageOrderPg(order);
            sendJson(res, 200, {
              ok: true,
              order: { id: order.id, ref: order.ref, status: order.status, points: order.points },
              checkoutUrl: hosted.checkoutUrl,
              settlement: paymobQuote.settlement,
              payment: pay,
              gateway: 'paymob',
              mode: hosted.mode,
              noteAr: 'لن تُضاف النقاط إلا بعد إشعار Paymob الموقّع (HMAC).',
            });
          } catch (err) {
            order.status = 'payment_failed';
            order.events.push({
              at: new Date().toISOString(),
              label: `فشل إنشاء دفع Paymob: ${err.message}`,
              status: 'failed',
            });
            await persistWalletDurable(store, client);
            await persistPackageOrderPg(order);
            sendJson(res, err.status || 502, {
              ok: false,
              error: 'تعذّر فتح بوابة Paymob',
              detail: err.message,
              ref: order.ref,
              payment: pay,
            });
          }
          return true;
        }
        if (method === 'paymob') {
          sendJson(res, 503, {
            ok: false,
            error: 'Paymob غير متاح حاليًا — يلزم حساب تاجر ومفاتيح بيئة',
            payment: pay,
          });
          return true;
        }
      }

      if (method === 'stripe') {
        if (!(pay.activeGatewayIds || []).includes('stripe')) {
          sendJson(res, 503, {
            ok: false,
            error: 'الدفع عبر Stripe غير متاح حاليًا',
            payment: pay,
          });
          return true;
        }
        const order = createOrderRecord(store, client, pkg, quote, { method: 'stripe', status: 'awaiting_payment' });
        try {
          const amountMinor = Math.round(Number(order.settlementAmount) * 100);
          const sessionStripe = await stripeRequest('POST', '/v1/checkout/sessions', {
            mode: 'payment',
            success_url: `${appUrl}/packages.html?paid=1&ref=${encodeURIComponent(order.ref)}`,
            cancel_url: `${appUrl}/packages.html?cancel=1&ref=${encodeURIComponent(order.ref)}`,
            client_reference_id: order.ref,
            'metadata[hubOrderRef]': order.ref,
            'metadata[packageId]': pkg.id,
            'metadata[points]': String(pkg.points),
            'line_items[0][quantity]': '1',
            'line_items[0][price_data][currency]': String(order.settlementCurrency || 'USD').toLowerCase(),
            'line_items[0][price_data][unit_amount]': String(amountMinor),
            'line_items[0][price_data][product_data][name]': `${pkg.nameAr} (${pkg.points} نقطة)`,
          });
          order.stripeSessionId = sessionStripe.id;
          order.checkoutUrl = sessionStripe.url;
          order.updatedAt = new Date().toISOString();
          await persistWalletDurable(store, client);
          await persistPackageOrderPg(order);
          sendJson(res, 200, {
            ok: true,
            order: { id: order.id, ref: order.ref, status: order.status },
            checkoutUrl: sessionStripe.url,
            settlement: quote.settlement,
            payment: pay,
            gateway: 'stripe',
          });
        } catch (err) {
          order.status = 'payment_failed';
          order.events.push({ at: new Date().toISOString(), label: `فشل إنشاء جلسة Stripe: ${err.message}`, status: 'failed' });
          await persistWalletDurable(store, client);
          await persistPackageOrderPg(order);
          sendJson(res, 502, { ok: false, error: 'تعذّر فتح بوابة الدفع', detail: err.message, ref: order.ref });
        }
        return true;
      }

      if (method === 'manual_review' || method === 'admin_review') {
        const order = createOrderRecord(store, client, pkg, quote, { method: 'manual_review', status: 'pending_review' });
        order.paymentStatus = 'pending_review';
        posha().emitEvent(store, {
          type: 'PACKAGE_TOPUP_REQUEST',
          clientEmail: client.email,
          actorId: session.email,
          actorRole: 'client',
          title: `طلب شحن باقة ${pkg.nameAr}`,
          message: `${order.ref} · ${pkg.points} نقطة · ${order.settlementAmount} ${order.settlementCurrency}`,
          metadata: { orderId: order.id, ref: order.ref },
          forceIssue: true,
          issueSeverity: 'NORMAL',
        });
        await persistWalletDurable(store, client);
        await persistPackageOrderPg(order);
        sendJson(res, 200, {
          ok: true,
          pendingReview: true,
          messageAr: 'تم إنشاء طلب شحن بانتظار المراجعة الإدارية. لن تُضاف النقاط قبل التأكيد.',
          order: { id: order.id, ref: order.ref, status: order.status, points: order.points },
          payment: pay,
        });
        return true;
      }

      sendJson(res, 400, {
        ok: false,
        error: pay.available
          ? 'اختر وسيلة الدفع: paymob أو stripe أو manual_review'
          : 'الدفع الإلكتروني غير متاح حاليًا. استخدم طلب المراجعة الإدارية.',
        payment: pay,
      });
      return true;
    }

    if (pathname === '/api/hub/packages/order-status' && req.method === 'GET') {
      if (!session?.email) {
        sendJson(res, 401, { ok: false, error: 'يلزم تسجيل الدخول' });
        return true;
      }
      const url = new URL(req.url, 'http://local');
      const ref = url.searchParams.get('ref');
      const order = packageOrders(store).find((o) => o.ref === ref || o.id === ref);
      if (!order || order.clientEmail !== session.email) {
        sendJson(res, 404, { ok: false, error: 'الطلب غير موجود' });
        return true;
      }
      // Never credit on success-page alone
      sendJson(res, 200, {
        ok: true,
        order: {
          ref: order.ref,
          status: order.status,
          paymentStatus: order.paymentStatus,
          credited: Boolean(order.credited),
          points: order.points,
          packageNameAr: order.packageNameAr,
        },
        wallet: ensureWallet(portal().ensureClient(store, session.email)),
        noteAr: order.credited
          ? 'تمت إضافة النقاط بعد تحقق الدفع.'
          : 'لم تُضف النقاط بعد — بانتظار تحقق الدفع أو التأكيد الإداري.',
      });
      return true;
    }
  }

  // Admin APIs
  if (pathname.startsWith('/api/admin/packages')) {
    let session;
    try {
      session = hubSession.requireStaff(req);
    } catch (err) {
      sendJson(res, err.status || 403, { ok: false, error: err.message || 'صلاحيات الإدارة مطلوبة' });
      return true;
    }
    const store = portal().readStore();

    if (pathname === '/api/admin/packages/overview' && req.method === 'GET') {
      const orders = packageOrders(store);
      const clients = Object.values(store.clients || {});
      const wallets = clients.map((c) => ({
        email: c.email,
        name: c.name,
        paid: Number(c.wallet?.paid) || 0,
        free: Number(c.wallet?.free) || 0,
        total: Number(c.wallet?.total) || 0,
        freeClaimed: Boolean(c.freePackageClaimed || c.welcomeCredited),
      }));
      sendJson(res, 200, {
        ok: true,
        packages: PACKAGES,
        payment: paymentStatusPublic(),
        servicePointPrices: servicePrices(store),
        stats: {
          ordersTotal: orders.length,
          fulfilled: orders.filter((o) => o.status === 'fulfilled').length,
          pendingReview: orders.filter((o) => o.status === 'pending_review').length,
          awaitingPayment: orders.filter((o) => o.status === 'awaiting_payment').length,
          failed: orders.filter((o) => o.status === 'payment_failed').length,
          pointsSold: orders.filter((o) => o.credited && o.kind === 'paid').reduce((s, o) => s + (o.points || 0), 0),
          usdCollected: orders.filter((o) => o.credited && o.kind === 'paid').reduce((s, o) => s + (o.priceUsd || 0), 0),
        },
        orders: orders.slice(0, 100),
        wallets: wallets.sort((a, b) => b.total - a.total).slice(0, 100),
      });
      return true;
    }

    if (pathname === '/api/admin/packages/confirm' && req.method === 'POST') {
      if (!hubSession.hasPermission(session, 'wallet.adjust') && !hubSession.hasPermission(session, 'customers.manage')) {
        sendJson(res, 403, { ok: false, error: 'يلزم تفويض تعديل المحفظة' });
        return true;
      }
      const { json } = await readBody(req);
      const order = packageOrders(store).find((o) => o.ref === json.ref || o.id === json.id);
      if (!order) {
        sendJson(res, 404, { ok: false, error: 'الطلب غير موجود' });
        return true;
      }
      if (order.kind === 'free') {
        sendJson(res, 400, { ok: false, error: 'تأكيد الإداري للباقات المدفوعة فقط' });
        return true;
      }
      order.status = 'admin_approved';
      order.paymentStatus = 'admin_confirmed';
      order.adminNote = String(json.note || '').slice(0, 500);
      order.confirmedBy = session.email;
      const result = fulfillOrder(store, order, { actorEmail: session.email, actorRole: 'admin', source: 'admin_confirm' });
      // audit
      store.packageAudit = store.packageAudit || [];
      store.packageAudit.unshift({
        id: uid('aud'),
        at: new Date().toISOString(),
        actor: session.email,
        action: 'confirm_package_order',
        ref: order.ref,
        points: order.points,
        note: order.adminNote,
      });
      if (result.ok && result.client) {
        await persistWalletDurable(store, result.client);
        await persistPackageOrderPg(order);
      } else {
        await persistWalletDurable(store, portal().ensureClient(store, order.clientEmail));
        await persistPackageOrderPg(order);
      }
      sendJson(res, result.ok ? 200 : 400, result);
      return true;
    }

    if (pathname === '/api/admin/packages/reject' && req.method === 'POST') {
      if (!hubSession.hasPermission(session, 'wallet.adjust') && !hubSession.hasPermission(session, 'customers.manage')) {
        sendJson(res, 403, { ok: false, error: 'يلزم تفويض' });
        return true;
      }
      const { json } = await readBody(req);
      const order = packageOrders(store).find((o) => o.ref === json.ref || o.id === json.id);
      if (!order) {
        sendJson(res, 404, { ok: false, error: 'الطلب غير موجود' });
        return true;
      }
      if (order.credited) {
        sendJson(res, 409, { ok: false, error: 'لا يمكن رفض طلب مُضاف رصيده' });
        return true;
      }
      order.status = 'rejected';
      order.paymentStatus = 'rejected';
      order.adminNote = String(json.note || '').slice(0, 500);
      order.updatedAt = new Date().toISOString();
      store.packageAudit = store.packageAudit || [];
      store.packageAudit.unshift({
        id: uid('aud'),
        at: new Date().toISOString(),
        actor: session.email,
        action: 'reject_package_order',
        ref: order.ref,
        note: order.adminNote,
      });
      await persistWalletDurable(store, portal().ensureClient(store, order.clientEmail));
      await persistPackageOrderPg(order);
      sendJson(res, 200, { ok: true, order });
      return true;
    }

    if (pathname === '/api/admin/packages/refund' && req.method === 'POST') {
      if (!hubSession.hasPermission(session, 'wallet.adjust')) {
        sendJson(res, 403, { ok: false, error: 'يلزم تفويض wallet.adjust' });
        return true;
      }
      const { json } = await readBody(req);
      const order = packageOrders(store).find((o) => o.ref === json.ref || o.id === json.id);
      if (!order) {
        sendJson(res, 404, { ok: false, error: 'الطلب غير موجود' });
        return true;
      }
      if (!order.credited) {
        sendJson(res, 400, { ok: false, error: 'الطلب غير مُضاف رصيده' });
        return true;
      }
      let gatewayRefund = null;
      if (order.method === 'paymob' && order.paymobTransactionId && paymob.configured()) {
        try {
          const cents = Math.round(Number(order.settlementAmount || 0) * 100);
          gatewayRefund = await paymob.refundTransaction(order.paymobTransactionId, cents);
          order.paymobRefund = gatewayRefund;
        } catch (err) {
          sendJson(res, 502, { ok: false, error: 'فشل استرداد Paymob', detail: err.message });
          return true;
        }
      }
      const reversed = reverseFulfilledOrder(store, order, {
        actorEmail: session.email,
        actorRole: 'admin',
        source: 'admin_refund',
        reason: String(json.note || 'استرداد إداري').slice(0, 300),
      });
      store.packageAudit = store.packageAudit || [];
      store.packageAudit.unshift({
        id: uid('aud'),
        at: new Date().toISOString(),
        actor: session.email,
        action: 'refund_package_order',
        ref: order.ref,
        points: order.points,
        note: String(json.note || '').slice(0, 500),
      });
      if (reversed.ok && reversed.client) {
        await persistWalletDurable(store, reversed.client);
        await persistPackageOrderPg(order);
      } else {
        await persistWalletDurable(store, portal().ensureClient(store, order.clientEmail));
        await persistPackageOrderPg(order);
      }
      sendJson(res, reversed.ok ? 200 : 409, { ...reversed, gatewayRefund });
      return true;
    }

    if (pathname === '/api/admin/packages/service-prices' && req.method === 'PUT') {
      if (!hubSession.hasPermission(session, 'wallet.adjust') && !hubSession.hasPermission(session, 'settings.manage')) {
        sendJson(res, 403, { ok: false, error: 'يلزم تفويض تعديل الأسعار' });
        return true;
      }
      const { json } = await readBody(req);
      const list = Array.isArray(json.prices) ? json.prices : [];
      const next = servicePrices(store).map((row) => {
        const patch = list.find((p) => p.id === row.id);
        if (!patch) return row;
        const pts = Math.max(0, Math.floor(Number(patch.pointsCost)));
        return { ...row, pointsCost: pts, updatedAt: new Date().toISOString(), updatedBy: session.email };
      });
      store.servicePointPrices = next;
      store.packageAudit = store.packageAudit || [];
      store.packageAudit.unshift({
        id: uid('aud'),
        at: new Date().toISOString(),
        actor: session.email,
        action: 'update_service_point_prices',
        count: list.length,
      });
      await persistWalletDurable(store, null);
      sendJson(res, 200, { ok: true, servicePointPrices: next });
      return true;
    }

    if (pathname === '/api/admin/packages/adjust-wallet' && req.method === 'POST') {
      if (!hubSession.hasPermission(session, 'wallet.adjust')) {
        sendJson(res, 403, { ok: false, error: 'يلزم تفويض wallet.adjust' });
        return true;
      }
      const { json } = await readBody(req);
      const email = String(json.email || '').toLowerCase().trim();
      const amount = Math.floor(Number(json.amount) || 0);
      const direction = String(json.direction || 'credit');
      if (!email || !amount) {
        sendJson(res, 400, { ok: false, error: 'بيانات غير صالحة' });
        return true;
      }
      const client = portal().ensureClient(store, email);
      const note = String(json.note || 'تعديل إداري').slice(0, 300);
      const ref = uid('ADJ');
      if (direction === 'debit') {
        const debited = poshaOs().debitWallet(ensureWallet(client), amount, note, ref);
        if (!debited.ok) {
          sendJson(res, 400, { ok: false, error: debited.error });
          return true;
        }
        client.wallet = debited.wallet;
      } else {
        creditWalletOnce(client, {
          amount,
          bucket: json.bucket === 'free' ? 'free' : 'paid',
          note,
          reference: ref,
          idempotencyKey: `admin:${ref}`,
        });
      }
      store.packageAudit = store.packageAudit || [];
      store.packageAudit.unshift({
        id: uid('aud'),
        at: new Date().toISOString(),
        actor: session.email,
        action: `wallet_${direction}`,
        email,
        amount,
        note,
        ref,
      });
      posha().emitEvent(store, {
        type: direction === 'debit' ? 'WALLET_DEBITED' : 'WALLET_CREDITED',
        clientEmail: email,
        actorId: session.email,
        actorRole: 'admin',
        title: `تعديل محفظة إداري ${direction === 'debit' ? '-' : '+'}${amount}`,
        message: note,
        metadata: { ref },
      });
      await persistWalletDurable(store, client);
      sendJson(res, 200, { ok: true, wallet: client.wallet, ref });
      return true;
    }
  }

  return false;
}

module.exports = {
  PACKAGES,
  handlePackagesApi,
  paymentStatusPublic,
  getPackage,
  creditWalletOnce,
  fulfillOrder,
  reverseFulfilledOrder,
  listPackagesPayload,
  servicePrices,
  packageOrders,
};
