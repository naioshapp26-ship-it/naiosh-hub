/**
 * System rentals — server ledger with per-booking owner isolation.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE_PATH = path.join(__dirname, '..', 'data', 'system-rentals.json');
const SEQ_PATH = path.join(__dirname, '..', 'data', 'system-rental-seq.json');

const RENTABLE_CODES = ['ERP', 'LAW', 'NAIS', 'FIT', 'ACADEMY', 'SMARTX', 'EDUSMARTX', 'EDUNAIOSH', 'LMS', 'CRM'];

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

function blank() {
  return { version: 1, visibility: {}, rentals: [], updatedAt: nowIso() };
}

function readStore() {
  ensureDir(STORE_PATH);
  if (!fs.existsSync(STORE_PATH)) {
    const empty = blank();
    fs.writeFileSync(STORE_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return {
      version: 1,
      visibility: raw.visibility && typeof raw.visibility === 'object' ? raw.visibility : {},
      rentals: Array.isArray(raw.rentals) ? raw.rentals : [],
      updatedAt: raw.updatedAt || nowIso(),
    };
  } catch {
    return blank();
  }
}

function writeStore(state) {
  ensureDir(STORE_PATH);
  const next = {
    version: 1,
    visibility: state.visibility || {},
    rentals: Array.isArray(state.rentals) ? state.rentals : [],
    updatedAt: nowIso(),
  };
  fs.writeFileSync(STORE_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function nextRequestId() {
  ensureDir(SEQ_PATH);
  const year = new Date().getFullYear();
  let seq = { year, request: 0 };
  if (fs.existsSync(SEQ_PATH)) {
    try {
      seq = JSON.parse(fs.readFileSync(SEQ_PATH, 'utf8'));
    } catch {
      /* ignore */
    }
  }
  if (Number(seq.year) !== year) seq = { year, request: 0 };
  seq.request = Number(seq.request || 0) + 1;
  fs.writeFileSync(SEQ_PATH, JSON.stringify(seq, null, 2));
  return `RENT-REQ-${year}-${String(seq.request).padStart(5, '0')}`;
}

function stripSecrets(rental) {
  if (!rental) return null;
  const copy = { ...rental };
  delete copy.adminPassword;
  return copy;
}

function publicCatalogState() {
  const state = readStore();
  return {
    version: 1,
    visibility: state.visibility || {},
    rentals: [],
    updatedAt: state.updatedAt,
  };
}

function listForSession(session) {
  const state = readStore();
  const staff = session?.lane === 'ADMIN' || session?.lane === 'SUPER_ADMIN';
  if (staff) {
    return {
      ...state,
      rentals: state.rentals.map(stripSecrets),
    };
  }
  const email = String(session?.email || '').toLowerCase();
  if (!email) return publicCatalogState();
  return {
    version: 1,
    visibility: state.visibility || {},
    rentals: state.rentals.filter((r) => String(r.adminEmail || '').toLowerCase() === email).map(stripSecrets),
    updatedAt: state.updatedAt,
  };
}

function isTrustedCustomerSession(session) {
  if (!session || !session.ok || !session.email) return false;
  const lane = String(session.lane || '').toUpperCase();
  if (lane === 'ADMIN' || lane === 'SUPER_ADMIN') return false;
  const role = String(session.role || '').toLowerCase();
  // Only real customer/client sessions — never tenant_admin leftovers or staff
  if (session.account) return true;
  return lane === 'CLIENT' && ['customer', 'client', 'platform_owner'].includes(role);
}

function resolveOwner({ session, contact = {}, claimedCustomerId = '' } = {}) {
  if (isTrustedCustomerSession(session)) {
    // Identity email always from trusted session — never from a tampered body field.
    const ownerEmail = String(session.email || '').toLowerCase();
    // Request contact may differ from account profile (name/phone for this booking only).
    const ownerName = String(contact.name || session.name || session.account?.fullName || session.account?.name || ownerEmail).trim();
    const ownerPhone = String(
      contact.phone || session.account?.phone || session.phone || ''
    ).trim();
    let customerId = '';
    try {
      const portal = require('./hub-client-portal');
      const st = portal.readStore();
      const client = portal.ensureClient(st, ownerEmail, ownerName);
      customerId = client?.clientId || '';
      // Do not overwrite account phone/name just because this booking used different contact.
      portal.writeStore(st);
    } catch {
      customerId = '';
    }
    if (claimedCustomerId && claimedCustomerId !== customerId) {
      const err = new Error('لا يمكن إرسال الحجز باسم عميل آخر.');
      err.status = 403;
      err.code = 'CUSTOMER_ID_TAMPER';
      throw err;
    }
    if (!ownerName || !isValidEmail(ownerEmail) || !isValidPhone(ownerPhone)) {
      const err = new Error('بيانات صاحب الحجز غير مكتملة.');
      err.status = 400;
      err.field = !isValidEmail(ownerEmail) ? 'email' : !isValidPhone(ownerPhone) ? 'phone' : 'name';
      throw err;
    }
    return {
      ownerType: 'Customer',
      customerId,
      guestContactId: '',
      ownerName,
      ownerEmail,
      ownerPhone,
      isGuest: false,
      accountEmail: ownerEmail,
      requestContactDistinct: Boolean(
        (contact.phone && String(contact.phone).trim() !== String(session.account?.phone || session.phone || '').trim()) ||
          (contact.name && String(contact.name).trim() !== String(session.name || session.account?.name || '').trim())
      ),
    };
  }

  const ownerName = String(contact.name || '').trim();
  const ownerEmail = String(contact.email || '').trim().toLowerCase();
  const ownerPhone = String(contact.phone || '').trim();
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
    isGuest: true,
  };
}

function createRental({
  session = null,
  contact = null,
  rental = {},
  idempotencyKey = '',
  claimedCustomerId = '',
} = {}) {
  const owner = resolveOwner({
    session,
    contact: contact || {
      name: rental.adminName,
      email: rental.adminEmail,
      phone: rental.adminPhone,
    },
    claimedCustomerId,
  });

  const companyName = String(rental.companyName || '').trim();
  const slug = String(rental.slug || rental.subdomain || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40);
  const systems = [...new Set((rental.systems || []).map((c) => String(c).toUpperCase()))].filter((c) =>
    RENTABLE_CODES.includes(c)
  );
  const plan = ['basic', 'pro', 'enterprise'].includes(rental.plan) ? rental.plan : 'basic';
  const payMethod = String(rental.payMethod || 'hub').trim();

  if (!companyName) {
    const err = new Error('اسم الشركة مطلوب.');
    err.status = 400;
    throw err;
  }
  if (!slug || slug.length < 2) {
    const err = new Error('النطاق الفرعي غير صالح.');
    err.status = 400;
    throw err;
  }
  if (!systems.length) {
    const err = new Error('اختر نظامًا واحدًا على الأقل.');
    err.status = 400;
    throw err;
  }

  const store = readStore();
  const key = String(idempotencyKey || '').trim();
  if (key) {
    const existing = store.rentals.find(
      (r) => r.idempotencyKey === key && String(r.adminEmail || '').toLowerCase() === owner.ownerEmail
    );
    if (existing) return { rental: stripSecrets(existing), duplicate: true };
  }

  const taken = store.rentals.some(
    (r) => r.slug === slug && ['pending', 'active', 'provisioning'].includes(r.status)
  );
  if (taken) {
    const err = new Error('النطاق الفرعي غير متاح.');
    err.status = 409;
    throw err;
  }

  const createdAt = nowIso();
  const requestId = nextRequestId();
  const row = {
    id: uid('rent'),
    requestId,
    ownerType: owner.ownerType,
    customerId: owner.customerId || '',
    guestContactId: owner.guestContactId || '',
    isGuest: owner.isGuest,
    companyName,
    slug,
    host: `${slug}.naiosh.app`,
    adminName: owner.ownerName,
    adminPhone: owner.ownerPhone,
    adminEmail: owner.ownerEmail,
    plan,
    planLabel: plan === 'basic' ? 'Basic (مجاني)' : plan === 'pro' ? 'Pro — $49/شهر' : 'Enterprise — $199/شهر',
    amount: plan === 'basic' ? 'مجاني' : plan === 'pro' ? '$49' : '$199',
    systems,
    payMethod,
    // Guest/paid plans wait for review; basic still starts as pending_review for owner clarity then can be activated by staff/auto
    status: plan === 'basic' ? 'pending' : 'pending',
    statusLabel: 'بانتظار المراجعة',
    erp: null,
    source: 'rent-systems.html',
    sourceModule: 'سجل أنظمة هوب',
    requestType: 'System Rental',
    requestTypeLabel: 'طلب استئجار نظام',
    idempotencyKey: key || null,
    createdAt,
    updatedAt: createdAt,
    submittedAt: createdAt,
  };

  store.rentals.unshift(row);
  writeStore(store);
  return { rental: stripSecrets(row), duplicate: false };
}

function updateRentalStatus(id, nextStatus, session, { reason = '' } = {}) {
  const staff = session?.lane === 'ADMIN' || session?.lane === 'SUPER_ADMIN';
  if (!staff) {
    const err = new Error('غير مصرح — تحديث الحالة للإدارة فقط.');
    err.status = 403;
    throw err;
  }
  const allowed = ['pending', 'provisioning', 'active', 'rejected'];
  if (!allowed.includes(nextStatus)) {
    const err = new Error('حالة غير صالحة.');
    err.status = 400;
    throw err;
  }
  if (nextStatus === 'rejected' && !String(reason || '').trim()) {
    const err = new Error('سبب الرفض مطلوب.');
    err.status = 400;
    throw err;
  }
  const store = readStore();
  const idx = store.rentals.findIndex(
    (r) => r.id === id || r.requestId === id || r.slug === id
  );
  if (idx < 0) {
    const err = new Error('طلب الاستئجار غير موجود.');
    err.status = 404;
    throw err;
  }
  const row = store.rentals[idx];
  row.status = nextStatus;
  row.statusLabel =
    nextStatus === 'active'
      ? 'مقبول ومفعّل'
      : nextStatus === 'rejected'
        ? 'مرفوض'
        : nextStatus === 'provisioning'
          ? 'قيد التجهيز'
          : 'بانتظار المراجعة';
  row.updatedAt = nowIso();
  if (nextStatus === 'rejected') row.rejectReason = String(reason || '').trim();
  if (nextStatus === 'active') {
    row.approvedBy = session.email || session.name || 'Admin';
    row.approvedAt = row.updatedAt;
    row.activatedAt = row.updatedAt;
  }
  store.rentals[idx] = row;
  writeStore(store);
  return stripSecrets(row);
}

function getRental(id) {
  const key = String(id || '');
  return readStore().rentals.find((r) => r.id === key || r.requestId === key) || null;
}

function assertCanView(rental, session) {
  if (!rental) {
    const err = new Error('طلب الاستئجار غير موجود.');
    err.status = 404;
    throw err;
  }
  const staff = session?.lane === 'ADMIN' || session?.lane === 'SUPER_ADMIN';
  if (staff) return true;
  const email = String(session?.email || '').toLowerCase();
  if (email && email === String(rental.adminEmail || '').toLowerCase()) return true;
  const err = new Error('غير مصرح بعرض هذا الطلب.');
  err.status = 403;
  throw err;
}

function replaceStoreForStaff(body, session) {
  const staff = session?.lane === 'ADMIN' || session?.lane === 'SUPER_ADMIN';
  if (!staff) {
    const err = new Error('غير مصرح.');
    err.status = 403;
    throw err;
  }
  return writeStore({
    visibility: body?.visibility && typeof body.visibility === 'object' ? body.visibility : {},
    rentals: Array.isArray(body?.rentals) ? body.rentals : readStore().rentals,
  });
}

module.exports = {
  RENTABLE_CODES,
  isValidEmail,
  isValidPhone,
  readStore,
  writeStore,
  publicCatalogState,
  listForSession,
  createRental,
  updateRentalStatus,
  getRental,
  assertCanView,
  replaceStoreForStaff,
  stripSecrets,
};
