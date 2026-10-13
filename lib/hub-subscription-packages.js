/**
 * Subscription packages + points wallet ops for NAIOSH HUB 360.
 * - Catalog prices are server-side only (never trust browser).
 * - Paid credits require verified payment (Stripe webhook) or admin confirm.
 * - Free 300 points once per client (welcomeCredited / freePackageClaimed).
 */
'use strict';

const crypto = require('crypto');
const https = require('https');
const hubSession = require('./hub-session');
const fx = require('./hub-fx-rates');
const geo = require('./hub-countries-currencies');

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
      'Content-Type, Authorization, X-Hub-Token, X-Hub-User-Role, X-Hub-User-Name, X-Hub-User-Email, Stripe-Signature',
  });
  res.end(JSON.stringify(payload));
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

function settlementCurrencies() {
  const raw = String(process.env.HUB_PAYMENT_SETTLEMENT_CURRENCIES || 'USD').trim();
  const list = raw
    .split(/[,\s]+/)
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
  return list.length ? [...new Set(list)] : ['USD'];
}

function paymentStatusPublic() {
  const stripe = stripeConfigured();
  return {
    gateway: stripe ? 'stripe' : null,
    available: stripe,
    messageAr: stripe
      ? 'بوابة الدفع الإلكتروني مفعّلة (Stripe).'
      : 'الدفع الإلكتروني غير متاح حاليًا. يمكنك إنشاء طلب شحن للمراجعة الإدارية؛ لن تُضاف النقاط إلا بعد تأكيد موثوق.',
    settlementCurrencies: settlementCurrencies(),
    displayFxOnly: true,
  };
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

async function buildQuote({ packageId, currency, countryCode }) {
  const pkg = getPackage(packageId);
  if (!pkg) return { ok: false, error: 'الباقة غير موجودة' };
  const pay = paymentStatusPublic();
  const ratesBundle = await fx.getRates();
  const code = String(currency || 'USD').toUpperCase();
  const converted = fx.convertFromUsd(pkg.priceUsd, code, ratesBundle.rates);
  const settleList = pay.settlementCurrencies;
  const settlementCurrency = settleList.includes(code) ? code : settleList[0] || 'USD';
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
      acceptedByGateway: pay.available && settleList.includes(settlementCurrency),
      noteAr:
        code !== settlementCurrency
          ? `عملة العرض ${code} غير مقبولة للتحصيل؛ سيتم التحصيل بـ ${settlementCurrency}.`
          : pay.available
            ? `سيتم التحصيل بـ ${settlementCurrency}.`
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
  portal().writeStore(store);
  return { ok: true, duplicate: credited.duplicate, order, wallet: client.wallet };
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
    sendJson(res, 200, { ok: true, ...geo.searchCountriesCurrencies(q) });
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
      sendJson(res, 200, {
        ok: true,
        authenticated: Boolean(me),
        wallet: me ? ensureWallet(me) : null,
        freeClaimed: Boolean(me && (me.freePackageClaimed || me.welcomeCredited)),
        country: me?.country || '',
        suggestedCountryCode: suggest.countryCode,
        suggestedCurrency: suggest.currency,
        orders: me ? (me.packageOrders || []).slice(0, 20) : [],
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

      if (method === 'stripe') {
        if (!pay.available) {
          sendJson(res, 503, {
            ok: false,
            error: 'الدفع غير متاح حاليًا',
            payment: pay,
          });
          return true;
        }
        const order = createOrderRecord(store, client, pkg, quote, { method: 'stripe', status: 'awaiting_payment' });
        const appUrl = String(process.env.APP_URL || '').replace(/\/$/, '') || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
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
          portal().writeStore(store);
          sendJson(res, 200, {
            ok: true,
            order: { id: order.id, ref: order.ref, status: order.status },
            checkoutUrl: sessionStripe.url,
            settlement: quote.settlement,
            payment: pay,
          });
        } catch (err) {
          order.status = 'payment_failed';
          order.events.push({ at: new Date().toISOString(), label: `فشل إنشاء جلسة Stripe: ${err.message}`, status: 'failed' });
          portal().writeStore(store);
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
        portal().writeStore(store);
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
          ? 'اختر وسيلة الدفع: stripe أو manual_review'
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
      portal().writeStore(store);
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
      portal().writeStore(store);
      sendJson(res, 200, { ok: true, order });
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
      portal().writeStore(store);
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
      portal().writeStore(store);
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
  listPackagesPayload,
  servicePrices,
  packageOrders,
};
