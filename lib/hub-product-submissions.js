/**
 * Store product submissions — central ledger for guest/customer product review.
 * File-backed + Postgres hub_product_submissions when DATABASE_URL is set.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDatabaseUrl } = require('../db/migrate');

const STORE_PATH = path.join(__dirname, '..', 'data', 'product-submissions.json');
const SEQ_PATH = path.join(__dirname, '..', 'data', 'product-submission-seq.json');

const STATUS_LABELS = {
  pending_review: 'بانتظار المراجعة',
  needs_changes: 'يحتاج إلى تعديل',
  approved: 'مقبول ومنشور',
  published: 'مقبول ومنشور',
  rejected: 'مرفوض',
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

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function isValidPhone(phone) {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 && /^\+?[0-9]+$/.test(raw);
}

function readStore() {
  ensureDir(STORE_PATH);
  if (!fs.existsSync(STORE_PATH)) {
    const empty = { version: 1, submissions: [] };
    fs.writeFileSync(STORE_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return { version: 1, submissions: Array.isArray(raw.submissions) ? raw.submissions : [] };
  } catch {
    return { version: 1, submissions: [] };
  }
}

function writeStore(submissions) {
  ensureDir(STORE_PATH);
  fs.writeFileSync(
    STORE_PATH,
    JSON.stringify({ version: 1, updatedAt: nowIso(), submissions }, null, 2),
    'utf8'
  );
}

function nextSeq(kind) {
  ensureDir(SEQ_PATH);
  const year = new Date().getFullYear();
  let seq = { year, request: 0, product: 0 };
  if (fs.existsSync(SEQ_PATH)) {
    try {
      seq = JSON.parse(fs.readFileSync(SEQ_PATH, 'utf8'));
    } catch {
      /* ignore */
    }
  }
  if (Number(seq.year) !== year) seq = { year, request: 0, product: 0 };
  if (kind === 'product') seq.product = Number(seq.product || 0) + 1;
  else seq.request = Number(seq.request || 0) + 1;
  fs.writeFileSync(SEQ_PATH, JSON.stringify(seq, null, 2));
  if (kind === 'product') return `PRD-${year}-${String(seq.product).padStart(5, '0')}`;
  return `PRD-REQ-${year}-${String(seq.request).padStart(5, '0')}`;
}

function persistToDb(row) {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl || !row) return Promise.resolve({ ok: false, reason: 'no-db' });
  const { Client } = require('pg');
  const ssl = /localhost|127\.0\.0\.1/.test(databaseUrl) ? false : { rejectUnauthorized: false };
  const client = new Client({ connectionString: databaseUrl, ssl });
  return client
    .connect()
    .then(() =>
      client.query(
        `INSERT INTO hub_product_submissions (
           id, request_id, product_id, owner_type, customer_id, guest_contact_id,
           owner_name, owner_email, owner_phone, owner_company, title, status, source, payload, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           payload = EXCLUDED.payload,
           updated_at = EXCLUDED.updated_at`,
        [
          row.id,
          row.requestId,
          row.productId,
          row.ownerType,
          row.customerId || null,
          row.guestContactId || null,
          row.ownerName || '',
          row.ownerEmail || '',
          row.ownerPhone || '',
          row.ownerCompany || '',
          row.title || '',
          row.status || 'pending_review',
          row.source || 'store.html',
          JSON.stringify(row),
          row.createdAt || nowIso(),
          row.updatedAt || nowIso(),
        ]
      )
    )
    .then(() => ({ ok: true }))
    .catch((err) => {
      console.error('hub_product_submissions persist failed:', err.message);
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
    const res = await client.query(`SELECT payload FROM hub_product_submissions ORDER BY created_at DESC`);
    const fromDb = (res.rows || []).map((r) => r.payload).filter((p) => p && p.id && p.requestId);
    if (!fromDb.length) return { ok: true, count: 0 };
    const file = readStore().submissions;
    const byId = new Map(file.map((o) => [o.id, o]));
    fromDb.forEach((row) => {
      const existing = byId.get(row.id);
      if (!existing || String(row.updatedAt || '') >= String(existing.updatedAt || '')) {
        byId.set(row.id, row);
      }
    });
    const merged = Array.from(byId.values()).sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    );
    writeStore(merged);
    return { ok: true, count: merged.length };
  } catch (err) {
    console.error('hub_product_submissions hydrate failed:', err.message);
    return { ok: false, error: err.message };
  } finally {
    await client.end().catch(() => {});
  }
}

function resolveOwner({ session, guestContact, claimedCustomerId }) {
  const loggedIn = Boolean(session && session.ok && session.email);
  if (loggedIn) {
    const ownerEmail = String(session.email || '').toLowerCase();
    const ownerName = String(guestContact?.name || session.name || session.fullName || ownerEmail).trim();
    const ownerPhone = String(guestContact?.phone || session.phone || session.account?.phone || '').trim();
    const ownerCompany = String(guestContact?.company || session.company || session.account?.company || '').trim();
    let customerId = '';
    try {
      const portal = require('./hub-client-portal');
      const st = portal.readStore();
      const client = portal.ensureClient(st, ownerEmail, ownerName);
      customerId = client?.clientId || '';
      portal.writeStore(st);
    } catch {
      customerId = '';
    }
    if (claimedCustomerId && claimedCustomerId !== customerId) {
      const err = new Error('لا يمكن إرسال المنتج باسم عميل آخر.');
      err.status = 403;
      err.code = 'CUSTOMER_ID_TAMPER';
      throw err;
    }
    if (!ownerName || !isValidEmail(ownerEmail) || !isValidPhone(ownerPhone)) {
      const err = new Error('بيانات صاحب المنتج غير مكتملة.');
      err.status = 400;
      throw err;
    }
    return {
      ownerType: 'Customer',
      customerId,
      guestContactId: '',
      ownerName,
      ownerEmail,
      ownerPhone,
      ownerCompany,
      isGuest: false,
    };
  }

  const ownerName = String(guestContact?.name || '').trim();
  const ownerEmail = String(guestContact?.email || '').trim().toLowerCase();
  const ownerPhone = String(guestContact?.phone || '').trim();
  const ownerCompany = String(guestContact?.company || '').trim();
  if (!ownerName) {
    const err = new Error('الاسم الكامل مطلوب.');
    err.status = 400;
    err.field = 'name';
    throw err;
  }
  if (!isValidEmail(ownerEmail)) {
    const err = new Error('البريد الإلكتروني غير صالح.');
    err.status = 400;
    err.field = 'email';
    throw err;
  }
  if (!isValidPhone(ownerPhone)) {
    const err = new Error('رقم الهاتف غير صالح.');
    err.status = 400;
    err.field = 'phone';
    throw err;
  }
  return {
    ownerType: 'Guest',
    customerId: '',
    guestContactId: uid('GUEST').toUpperCase(),
    ownerName,
    ownerEmail,
    ownerPhone,
    ownerCompany,
    isGuest: true,
  };
}

function createSubmission({
  session = null,
  guestContact = null,
  product = {},
  idempotencyKey = '',
  claimedCustomerId = '',
} = {}) {
  const owner = resolveOwner({ session, guestContact, claimedCustomerId });
  const title = String(product.title || product.productName || product.product_name || '').trim();
  const category = String(product.category || '').trim();
  const summary = String(product.summary || product.shortDesc || product.short_desc || '').trim();
  const priceUsd = Number(product.priceUsd != null ? product.priceUsd : product.price_usd || product.price);
  if (!title) {
    const err = new Error('اسم المنتج مطلوب.');
    err.status = 400;
    throw err;
  }
  if (!category) {
    const err = new Error('الفئة مطلوبة.');
    err.status = 400;
    throw err;
  }
  if (!summary) {
    const err = new Error('الوصف المختصر مطلوب.');
    err.status = 400;
    throw err;
  }
  if (!(priceUsd > 0) || !Number.isFinite(priceUsd)) {
    const err = new Error('السعر غير صالح.');
    err.status = 400;
    throw err;
  }

  const store = readStore();
  const key = String(idempotencyKey || '').trim();
  if (key) {
    const existing = store.submissions.find(
      (s) => s.idempotencyKey === key && String(s.ownerEmail || '').toLowerCase() === owner.ownerEmail
    );
    if (existing) {
      return { submission: existing, duplicate: true, persisted: persistToDb(existing) };
    }
  }

  const createdAt = nowIso();
  const productId = String(product.productId || product.id || nextSeq('product'));
  const requestId = nextSeq('request');
  const images = Array.isArray(product.images) ? product.images.slice(0, 8) : [];
  const attachments = Array.isArray(product.attachments) ? product.attachments.slice(0, 8) : [];

  const submission = {
    id: uid('prdsub'),
    requestId,
    productId,
    ownerType: owner.ownerType,
    customerId: owner.customerId || '',
    guestContactId: owner.guestContactId || '',
    ownerName: owner.ownerName,
    ownerEmail: owner.ownerEmail,
    ownerPhone: owner.ownerPhone,
    ownerCompany: owner.ownerCompany || '',
    isGuest: owner.isGuest,
    title,
    category,
    brand: String(product.brand || ''),
    sku: String(product.sku || ''),
    summary,
    description: String(product.description || product.fullDesc || summary),
    quantity: Math.max(1, Number(product.quantity) || 1),
    condition: String(product.condition || 'new'),
    priceUsd,
    currency: 'USD',
    purchaseType: product.purchaseType === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL',
    storeId: String(product.storeId || product.store_id || ''),
    storeName: String(product.storeName || product.store_name || (product.purchaseType === 'INTERNAL' ? 'NAIOSh' : '')),
    productUrl: String(product.productUrl || product.product_url || ''),
    images,
    attachments,
    imagesCount: images.length,
    attachmentsCount: attachments.length,
    status: 'pending_review',
    statusLabel: STATUS_LABELS.pending_review,
    changeRequestNote: '',
    rejectionReason: '',
    source: 'store.html',
    sourceModule: 'المتجر',
    sourcePage: 'المتجر',
    sourceUrl: 'store.html#upload',
    sourceAction: 'إضافة منتج',
    requestType: 'Product Submission',
    requestTypeLabel: 'طلب إضافة منتج',
    idempotencyKey: key || null,
    createdAt,
    updatedAt: createdAt,
    submittedAt: createdAt,
  };

  store.submissions.unshift(submission);
  writeStore(store.submissions);
  return { submission, duplicate: false, persisted: persistToDb(submission) };
}

function listSubmissions({ email = '', staff = false } = {}) {
  const all = readStore().submissions;
  if (staff) return all;
  const e = String(email || '').toLowerCase();
  if (!e) return [];
  return all.filter((s) => String(s.ownerEmail || '').toLowerCase() === e);
}

function listPublished() {
  return readStore().submissions.filter(
    (s) => s && (s.status === 'published' || s.status === 'approved')
  );
}

const CATEGORY_LABELS_AR = {
  electronics: 'إلكترونيات',
  fashion: 'أزياء',
  home: 'منزل',
  beauty: 'تجميل',
  other: 'أخرى',
};

function toStoreItem(submission) {
  if (!submission) return null;
  const images = Array.isArray(submission.images) ? submission.images : [];
  const rawCat = String(submission.category || '');
  const category = CATEGORY_LABELS_AR[rawCat] || rawCat;
  return {
    id: `pub-${submission.productId}`,
    productId: submission.productId,
    submissionId: submission.requestId,
    title: submission.title,
    name: submission.title,
    desc: submission.summary || submission.description || '',
    brand: submission.brand || 'نايوش هوب',
    category,
    price: Number(submission.priceUsd) || 0,
    currency: 'USD',
    sku: submission.sku || submission.productId,
    stock: Math.max(1, Number(submission.quantity) || 1),
    status: 'active',
    published: true,
    purchaseType: submission.purchaseType === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL',
    productUrl: submission.productUrl || '',
    storeId: submission.storeId || '',
    storeName: submission.storeName || 'NAIOSh',
    images,
    imageDataUrl: (images[0] && images[0].dataUrl) || '',
    badge: 'جديد',
    itemKind: 'منتج',
    mirrorToCatalog: true,
    source: 'product-submissions',
  };
}

function getSubmission(id) {
  const key = String(id || '');
  return (
    readStore().submissions.find(
      (s) => s.id === key || s.requestId === key || s.productId === key
    ) || null
  );
}

function assertCanView(submission, session) {
  if (!submission) {
    const err = new Error('طلب المنتج غير موجود.');
    err.status = 404;
    throw err;
  }
  const isStaff = session?.lane === 'ADMIN' || session?.lane === 'SUPER_ADMIN';
  if (isStaff) return true;
  const email = String(session?.email || '').toLowerCase();
  if (email && email === String(submission.ownerEmail || '').toLowerCase()) return true;
  const err = new Error('غير مصرح بعرض هذا الطلب.');
  err.status = 403;
  throw err;
}

function updateStatus(id, nextStatus, session, { reason = '' } = {}) {
  const isStaff = session?.lane === 'ADMIN' || session?.lane === 'SUPER_ADMIN';
  if (!isStaff) {
    const err = new Error('غير مصرح — تحديث الحالة للإدارة فقط.');
    err.status = 403;
    throw err;
  }
  const allowed = ['pending_review', 'needs_changes', 'approved', 'published', 'rejected'];
  if (!allowed.includes(nextStatus)) {
    const err = new Error('حالة غير صالحة.');
    err.status = 400;
    throw err;
  }
  if ((nextStatus === 'needs_changes' || nextStatus === 'rejected') && !String(reason || '').trim()) {
    const err = new Error('سبب التعديل أو الرفض مطلوب.');
    err.status = 400;
    throw err;
  }
  const store = readStore();
  const idx = store.submissions.findIndex(
    (s) => s.id === id || s.requestId === id || s.productId === id
  );
  if (idx < 0) {
    const err = new Error('طلب المنتج غير موجود.');
    err.status = 404;
    throw err;
  }
  const row = store.submissions[idx];
  row.status = nextStatus === 'approved' ? 'published' : nextStatus;
  row.statusLabel = STATUS_LABELS[row.status] || row.status;
  row.updatedAt = nowIso();
  if (row.status === 'needs_changes') {
    row.changeRequestNote = String(reason || '').trim();
  }
  if (row.status === 'rejected') {
    row.rejectionReason = String(reason || '').trim();
  }
  if (row.status === 'published') {
    row.publishedAt = row.updatedAt;
    row.approvedBy = session.email || session.name || 'Admin';
    row.approvedAt = row.updatedAt;
  }
  store.submissions[idx] = row;
  writeStore(store.submissions);
  persistToDb(row);
  return row;
}

function toAdminRequest(submission) {
  if (!submission) return null;
  const statusMap = {
    pending_review: 'Pending Review',
    needs_changes: 'Needs Changes',
    published: 'Approved',
    approved: 'Approved',
    rejected: 'Rejected',
  };
  return {
    id: submission.requestId,
    requestId: submission.requestId,
    requestType: 'Product Submission',
    requestTypeLabel: 'طلب إضافة منتج',
    title: `طلب إضافة منتج: ${submission.title}`,
    description: submission.summary || submission.description || '',
    status: statusMap[submission.status] || 'Pending Review',
    statusLabel: submission.statusLabel || STATUS_LABELS[submission.status] || submission.status,
    priority: 'متوسطة',
    sourceModule: 'المتجر',
    sourcePage: 'المتجر',
    sourceUrl: 'store.html#upload',
    sourceAction: 'إضافة منتج',
    referenceType: 'Product',
    referenceId: submission.productId,
    productId: submission.productId,
    ownerType: submission.ownerType,
    isGuest: submission.ownerType === 'Guest',
    customerId: submission.ownerType === 'Customer' ? submission.customerId : '',
    guestContactId: submission.guestContactId || '',
    customerName: submission.ownerName,
    email: submission.ownerEmail,
    phone: submission.ownerPhone,
    company: submission.ownerCompany || '',
    assignedTo: 'Sales Desk',
    department: 'Sales',
    channel: 'Web',
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
    approvedAt: submission.approvedAt || '',
    approvedBy: submission.approvedBy || '',
    changeRequestNote: submission.changeRequestNote || '',
    rejectionReason: submission.rejectionReason || '',
    serverSubmissionId: submission.id,
    productSnapshot: {
      productId: submission.productId,
      title: submission.title,
      category: submission.category,
      brand: submission.brand,
      sku: submission.sku,
      summary: submission.summary,
      description: submission.description,
      priceUsd: submission.priceUsd,
      currency: submission.currency,
      purchaseType: submission.purchaseType,
      storeId: submission.storeId,
      storeName: submission.storeName,
      productUrl: submission.productUrl,
      images: submission.images || [],
      attachments: submission.attachments || [],
      quantity: submission.quantity,
      condition: submission.condition,
      status: submission.status,
    },
    attachments: [
      ...(submission.images || []).map((img, i) => ({
        name: img.name || `image-${i + 1}`,
        at: submission.createdAt,
        kind: 'image',
        dataUrl: img.dataUrl || '',
      })),
      ...(submission.attachments || []).map((f, i) => ({
        name: f.name || `file-${i + 1}`,
        at: submission.createdAt,
        kind: 'file',
        dataUrl: f.dataUrl || '',
      })),
    ],
    customer: {
      name: submission.ownerName,
      email: submission.ownerEmail,
      phone: submission.ownerPhone,
      company: submission.ownerCompany || '',
      customerId: submission.ownerType === 'Customer' ? submission.customerId : '',
      ownerType: submission.ownerType,
      guestContactId: submission.guestContactId || '',
    },
  };
}

module.exports = {
  STATUS_LABELS,
  isValidEmail,
  isValidPhone,
  createSubmission,
  listSubmissions,
  listPublished,
  toStoreItem,
  getSubmission,
  assertCanView,
  updateStatus,
  toAdminRequest,
  hydrateFromDb,
  persistToDb,
  readStore,
};
