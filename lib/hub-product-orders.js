/**
 * Product catalog resolver + product orders (file-backed).
 * Server-side price authority for checkout.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const ORDERS_PATH = path.join(__dirname, '..', 'data', 'product-orders.json');
const SEQ_PATH = path.join(__dirname, '..', 'data', 'product-order-seq.json');
const { getDatabaseUrl } = require('../db/migrate');

const ORDER_STATUSES = [
  'received',
  'payment_confirmed',
  'under_review',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
];

const STATUS_LABELS = {
  received: 'تم استلام الطلب',
  payment_confirmed: 'تم تأكيد الدفع',
  under_review: 'قيد المراجعة',
  confirmed: 'تم التأكيد',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

const PAYMENT_LABELS = {
  demo_paid: 'دفع تجريبي مكتمل',
  unpaid: 'غير مدفوع',
  failed: 'فشل الدفع',
  refunded: 'مسترد',
};

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

let catalogCache = null;

function loadCatalog() {
  if (catalogCache) return catalogCache;
  const file = path.join(__dirname, '..', 'js', 'hub-marketplace-data.js');
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const list = sandbox.window?.HubMarketplaceData?.PRODUCT_CATALOG || [];
  catalogCache = list.map((p) => ({ ...p }));
  return catalogCache;
}

function findProduct(productId) {
  const id = String(productId || '').trim();
  if (!id) return null;
  const list = loadCatalog();
  return (
    list.find(
      (p) =>
        String(p.id) === id ||
        String(p.sku) === id ||
        String(p.storeItemId || '') === id
    ) || null
  );
}

function isPurchasable(product) {
  if (!product) return false;
  const status = String(product.status || '').toLowerCase();
  if (['archived', 'مؤرشف', 'disabled', 'غير متاح', 'pending_review', 'بانتظار المراجعة'].includes(status)) {
    return false;
  }
  const stock = Number(product.stock);
  if (Number.isFinite(stock) && stock <= 0) return false;
  return true;
}

function readOrders() {
  ensureDir(ORDERS_PATH);
  if (!fs.existsSync(ORDERS_PATH)) {
    const empty = { version: 1, orders: [] };
    fs.writeFileSync(ORDERS_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(ORDERS_PATH, 'utf8'));
    return { version: 1, orders: Array.isArray(raw.orders) ? raw.orders : [] };
  } catch {
    return { version: 1, orders: [] };
  }
}

function writeOrders(orders) {
  ensureDir(ORDERS_PATH);
  fs.writeFileSync(
    ORDERS_PATH,
    JSON.stringify({ version: 1, updatedAt: nowIso(), orders }, null, 2),
    'utf8'
  );
}

function invoiceNumberFor(orderNumber) {
  return String(orderNumber || '').replace(/^ORD-/, 'INV-');
}

function invoiceStatusOf(order) {
  const pay = String(order?.paymentStatus || '').toLowerCase();
  if (pay === 'demo_paid' || pay === 'paid') return 'paid';
  if (pay === 'refunded') return 'refunded';
  return 'unpaid';
}

function clientOrderStatus(order) {
  const s = String(order?.orderStatus || '').toLowerCase();
  const pay = String(order?.paymentStatus || '').toLowerCase();
  if (s === 'completed') return 'completed';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  if (s === 'in_progress' || s === 'confirmed' || s === 'under_review') return 'in_progress';
  if (s === 'payment_confirmed' || pay === 'demo_paid' || pay === 'paid') return 'approved';
  if (s === 'received') return 'pending_review';
  return s || 'pending_review';
}

function nextActionFor(order) {
  const pay = String(order?.paymentStatus || '').toLowerCase();
  const st = String(order?.orderStatus || '').toLowerCase();
  if (pay === 'unpaid') return 'أكمل الدفع لمتابعة الطلب';
  if (st === 'completed') return 'تم إكمال الطلب';
  if (st === 'cancelled' || st === 'canceled') return 'الطلب ملغي';
  if (st === 'in_progress' || st === 'confirmed') return 'جاري تنفيذ طلبك';
  if (st === 'under_review') return 'الطلب قيد المراجعة';
  if (st === 'payment_confirmed' || st === 'received') return 'تم استلام طلبك — بانتظار مراجعة التشغيل';
  return 'تابع حالة طلبك من هنا';
}

function normalizeOrder(order) {
  if (!order) return order;
  if (!order.invoiceNumber) order.invoiceNumber = invoiceNumberFor(order.number);
  if (!order.customerId) order.customerId = order.customerEmail;
  return order;
}

function toClientOrder(order) {
  const e = enrichOrder(normalizeOrder({ ...order }));
  if (!e) return null;
  return {
    id: e.id,
    number: e.number,
    service: e.productName,
    productId: e.productId,
    productSku: e.productSku,
    date: e.createdAt,
    createdAt: e.createdAt,
    amount: e.total,
    currency: e.currency || 'USD',
    qty: e.qty,
    status: clientOrderStatus(e),
    orderStatus: e.orderStatus,
    orderStatusLabel: e.orderStatusLabel,
    paymentStatus: e.paymentStatus,
    paymentStatusLabel: e.paymentStatusLabel,
    invoiceNumber: e.invoiceNumber,
    invoiceId: e.id,
    timeline: e.timeline || [],
    nextAction: nextActionFor(e),
    customerEmail: e.customerEmail,
    customerId: e.customerId,
    source: 'hub_orders',
  };
}

function toClientInvoice(order) {
  const e = enrichOrder(normalizeOrder({ ...order }));
  if (!e) return null;
  const status = invoiceStatusOf(e);
  return {
    id: e.id,
    number: e.invoiceNumber,
    orderId: e.id,
    orderNumber: e.number,
    amount: e.total,
    currency: e.currency || 'USD',
    status,
    date: e.createdAt,
    createdAt: e.createdAt,
    paidAt: status === 'paid' ? e.updatedAt || e.createdAt : null,
    service: e.productName,
    customerEmail: e.customerEmail,
    customerId: e.customerId,
    source: 'hub_orders',
  };
}

function persistOrderToDb(order) {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl || !order) return Promise.resolve({ ok: false, reason: 'no-db' });
  const { Client } = require('pg');
  const ssl = /localhost|127\.0\.0\.1/.test(databaseUrl) ? false : { rejectUnauthorized: false };
  const client = new Client({ connectionString: databaseUrl, ssl });
  const row = normalizeOrder({ ...order });
  delete row._persisted;
  return client
    .connect()
    .then(() =>
      client.query(
        `INSERT INTO hub_orders (
           id, number, customer_id, customer_email, customer_name,
           product_id, product_name, qty, unit_price, total, currency,
           payment_status, payment_mode, order_status, invoice_number, source, payload, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19)
         ON CONFLICT (id) DO UPDATE SET
           order_status = EXCLUDED.order_status,
           payment_status = EXCLUDED.payment_status,
           invoice_number = EXCLUDED.invoice_number,
           payload = EXCLUDED.payload,
           updated_at = EXCLUDED.updated_at`,
        [
          row.id,
          row.number,
          row.customerId || row.customerEmail,
          row.customerEmail,
          row.customerName || '',
          row.productId || '',
          row.productName || '',
          row.qty || 1,
          row.unitPrice || 0,
          row.total || 0,
          row.currency || 'USD',
          row.paymentStatus || 'unpaid',
          row.paymentMode || '',
          row.orderStatus || 'received',
          row.invoiceNumber,
          row.source || 'buy_now',
          JSON.stringify(row),
          row.createdAt || nowIso(),
          row.updatedAt || nowIso(),
        ]
      )
    )
    .then(() => ({ ok: true }))
    .catch((err) => {
      console.error('hub_orders persist failed:', err.message);
      return { ok: false, error: err.message };
    })
    .finally(() => client.end().catch(() => {}));
}

async function hydrateFromDb() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) return { ok: false, reason: 'no-db' };
  const { Client } = require('pg');
  const ssl = /localhost|127\.0\.0\.1/.test(databaseUrl) ? false : { rejectUnauthorized: false };
  const client = new Client({ connectionString: databaseUrl, ssl });
  try {
    await client.connect();
    const res = await client.query(`SELECT payload FROM hub_orders ORDER BY created_at DESC`);
    const fromDb = (res.rows || [])
      .map((r) => r.payload)
      .filter((p) => p && p.id && p.number);
    if (!fromDb.length) return { ok: true, count: 0 };
    const file = readOrders().orders;
    const byId = new Map(file.map((o) => [o.id, o]));
    fromDb.forEach((row) => {
      const existing = byId.get(row.id);
      if (!existing || String(row.updatedAt || '') >= String(existing.updatedAt || '')) {
        byId.set(row.id, normalizeOrder(row));
      }
    });
    const merged = Array.from(byId.values()).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    writeOrders(merged);
    return { ok: true, count: merged.length };
  } catch (err) {
    console.error('hub_orders hydrate failed:', err.message);
    return { ok: false, error: err.message };
  } finally {
    await client.end().catch(() => {});
  }
}

function nextOrderNumber() {
  ensureDir(SEQ_PATH);
  const year = new Date().getFullYear();
  let seq = { year, n: 0 };
  if (fs.existsSync(SEQ_PATH)) {
    try {
      seq = JSON.parse(fs.readFileSync(SEQ_PATH, 'utf8'));
    } catch {
      /* ignore */
    }
  }
  if (Number(seq.year) !== year) {
    seq = { year, n: 0 };
  }
  seq.n = Number(seq.n || 0) + 1;
  fs.writeFileSync(SEQ_PATH, JSON.stringify(seq, null, 2));
  return `ORD-${year}-${String(seq.n).padStart(5, '0')}`;
}

function publicProduct(product) {
  if (!product) return null;
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    category: product.category,
    platform: product.platform,
    platformCode: product.platformCode,
    price: Number(product.price) || 0,
    currency: 'USD',
    stock: product.stock,
    status: product.status,
    icon: product.icon,
    available: isPurchasable(product),
    description:
      product.description ||
      product.desc ||
      `منتج ${product.brand || 'نايوش'} ضمن تصنيف ${product.category || 'عام'} — ترخيص تشغيلي داخل منظومة هوب.`,
    includes: product.includes || [
      'ترخيص استخدام داخل نايوش',
      'تفعيل مرتبط بحساب العميل',
      'متابعة الطلب من «طلباتي»',
      'دعم تشغيلي عبر غرفة العمليات',
    ],
  };
}

function createOrder({
  productId,
  qty = 1,
  customer,
  paymentMode = 'demo',
  source = 'buy_now',
  idempotencyKey,
  clientPrice,
} = {}) {
  const product = findProduct(productId);
  if (!product || !isPurchasable(product)) {
    const err = new Error('هذا المنتج غير متاح للشراء حاليًا.');
    err.status = 400;
    throw err;
  }

  const quantity = Math.max(1, Math.min(99, Number(qty) || 1));
  const unitPrice = Number(product.price) || 0;

  // Reject client-tampered prices
  if (clientPrice != null && Number(clientPrice) !== unitPrice) {
    const err = new Error('السعر المرسل غير صالح. تم اعتماد السعر الرسمي للمنتج.');
    err.status = 400;
    err.code = 'PRICE_MISMATCH';
    err.officialPrice = unitPrice;
    throw err;
  }

  const store = readOrders();
  if (idempotencyKey) {
    const existing = store.orders.find(
      (o) =>
        o.idempotencyKey &&
        o.idempotencyKey === idempotencyKey &&
        o.customerEmail === (customer?.email || '')
    );
    if (existing) return { order: existing, duplicate: true, persisted: persistOrderToDb(existing) };
  }

  const email = String(customer?.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    const err = new Error('يرجى تسجيل الدخول لإكمال الشراء.');
    err.status = 401;
    throw err;
  }

  const total = unitPrice * quantity;
  const createdAt = nowIso();
  const order = {
    id: uid('pord'),
    number: nextOrderNumber(),
    productId: product.id,
    productSku: product.sku,
    productName: product.name,
    productCategory: product.category,
    productBrand: product.brand,
    platformCode: product.platformCode || '',
    unitPrice,
    qty: quantity,
    total,
    currency: 'USD',
    paymentStatus: paymentMode === 'demo' ? 'demo_paid' : 'unpaid',
    paymentMode: paymentMode === 'demo' ? 'demo' : 'pending',
    orderStatus: 'received',
    source: source === 'cart' ? 'cart' : 'buy_now',
    customerId: customer?.clientId || customer?.id || email,
    customerEmail: email,
    customerName: customer?.name || customer?.fullName || email,
    customerPhone: customer?.phone || '',
    customerCountry: customer?.country || '',
    customerCompany: customer?.company || '',
    idempotencyKey: idempotencyKey || null,
    createdAt,
    updatedAt: createdAt,
    timeline: [
      { key: 'received', label: STATUS_LABELS.received, at: createdAt, done: true },
      {
        key: 'payment_confirmed',
        label: STATUS_LABELS.payment_confirmed,
        at: paymentMode === 'demo' ? createdAt : null,
        done: paymentMode === 'demo',
      },
      { key: 'under_review', label: STATUS_LABELS.under_review, at: null, done: false },
      { key: 'confirmed', label: STATUS_LABELS.confirmed, at: null, done: false },
      { key: 'in_progress', label: STATUS_LABELS.in_progress, at: null, done: false },
      { key: 'completed', label: STATUS_LABELS.completed, at: null, done: false },
    ],
  };
  order.invoiceNumber = invoiceNumberFor(order.number);

  if (paymentMode === 'demo') {
    order.orderStatus = 'payment_confirmed';
  }

  store.orders.unshift(order);
  writeOrders(store.orders);
  const persisted = persistOrderToDb(order);
  return { order, duplicate: false, persisted };
}

function enrichOrder(order) {
  if (!order) return null;
  return {
    ...order,
    orderStatusLabel: STATUS_LABELS[order.orderStatus] || order.orderStatus,
    paymentStatusLabel: PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus,
  };
}

function listOrders({ email, staff = false } = {}) {
  const orders = readOrders().orders;
  if (staff) return orders;
  const e = String(email || '').toLowerCase();
  return orders.filter((o) => String(o.customerEmail || '').toLowerCase() === e);
}

function getOrder(id) {
  return readOrders().orders.find((o) => o.id === id || o.number === id) || null;
}

function assertCanView(order, session) {
  if (!order) {
    const err = new Error('الطلب غير موجود.');
    err.status = 404;
    throw err;
  }
  const isStaff = session?.lane === 'ADMIN' || session?.lane === 'SUPER_ADMIN';
  if (isStaff) return true;
  const email = String(session?.email || '').toLowerCase();
  if (email && email === String(order.customerEmail || '').toLowerCase()) return true;
  const err = new Error('غير مصرح بعرض هذا الطلب.');
  err.status = 403;
  throw err;
}

function updateOrderStatus(id, nextStatus, session) {
  const isStaff = session?.lane === 'ADMIN' || session?.lane === 'SUPER_ADMIN';
  if (!isStaff) {
    const err = new Error('غير مصرح — تحديث الحالة للإدارة فقط.');
    err.status = 403;
    throw err;
  }
  if (!ORDER_STATUSES.includes(nextStatus)) {
    const err = new Error('حالة غير صالحة.');
    err.status = 400;
    throw err;
  }
  const store = readOrders();
  const idx = store.orders.findIndex((o) => o.id === id || o.number === id);
  if (idx < 0) {
    const err = new Error('الطلب غير موجود.');
    err.status = 404;
    throw err;
  }
  const order = store.orders[idx];
  order.orderStatus = nextStatus;
  order.updatedAt = nowIso();
  const markDone = ['received', 'payment_confirmed', 'under_review', 'confirmed', 'in_progress', 'completed'];
  const stopAt = markDone.indexOf(nextStatus);
  order.timeline = (order.timeline || []).map((t) => {
    const i = markDone.indexOf(t.key);
    if (nextStatus === 'cancelled') {
      if (t.key === 'cancelled') return { ...t, done: true, at: t.at || order.updatedAt };
      return t;
    }
    if (i >= 0 && i <= stopAt) {
      return { ...t, done: true, at: t.at || order.updatedAt };
    }
    return { ...t, done: false };
  });
  if (nextStatus === 'cancelled') {
    order.timeline.push({
      key: 'cancelled',
      label: STATUS_LABELS.cancelled,
      at: order.updatedAt,
      done: true,
    });
  }
  store.orders[idx] = order;
  writeOrders(store.orders);
  persistOrderToDb(order);
  return order;
}

function listClientOrders(email) {
  return listOrders({ email, staff: false }).map((o) => toClientOrder(o)).filter(Boolean);
}

function listClientInvoices(email) {
  return listOrders({ email, staff: false }).map((o) => toClientInvoice(o)).filter(Boolean);
}

module.exports = {
  ORDER_STATUSES,
  STATUS_LABELS,
  PAYMENT_LABELS,
  loadCatalog,
  findProduct,
  isPurchasable,
  publicProduct,
  createOrder,
  listOrders,
  listClientOrders,
  listClientInvoices,
  getOrder,
  assertCanView,
  updateOrderStatus,
  enrichOrder,
  toClientOrder,
  toClientInvoice,
  hydrateFromDb,
  persistOrderToDb,
};
