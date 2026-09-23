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
    if (existing) return { order: existing, duplicate: true };
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
    customerId: customer?.id || email,
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

  if (paymentMode === 'demo') {
    order.orderStatus = 'payment_confirmed';
  }

  store.orders.unshift(order);
  writeOrders(store.orders);
  return { order, duplicate: false };
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
  return order;
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
  getOrder,
  assertCanView,
  updateOrderStatus,
  enrichOrder,
};
