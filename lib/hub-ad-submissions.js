/**
 * Ad submissions — single ledger for guest/customer ad review requests.
 * File-backed + Postgres hub_ad_submissions when DATABASE_URL is set.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDatabaseUrl } = require('../db/migrate');

const STORE_PATH = path.join(__dirname, '..', 'data', 'ad-submissions.json');
const SEQ_PATH = path.join(__dirname, '..', 'data', 'ad-submission-seq.json');

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

function nextRequestId() {
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
  if (Number(seq.year) !== year) seq = { year, n: 0 };
  seq.n = Number(seq.n || 0) + 1;
  fs.writeFileSync(SEQ_PATH, JSON.stringify(seq, null, 2));
  return `AD-REQ-${year}-${String(seq.n).padStart(5, '0')}`;
}

function nextAdCode() {
  const year = new Date().getFullYear();
  const store = readStore();
  let max = 0;
  const re = new RegExp(`^AD-${year}-(\\d+)$`);
  store.submissions.forEach((s) => {
    const m = String(s.adCode || '').match(re);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `AD-${year}-${String(max + 1).padStart(5, '0')}`;
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
        `INSERT INTO hub_ad_submissions (
           id, request_id, ad_id, ad_code, owner_type, customer_id, guest_contact_id,
           owner_name, owner_email, owner_phone, owner_company, title, status, source, payload, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           payload = EXCLUDED.payload,
           updated_at = EXCLUDED.updated_at`,
        [
          row.id,
          row.requestId,
          row.adId,
          row.adCode,
          row.ownerType,
          row.customerId || null,
          row.guestContactId || null,
          row.ownerName || '',
          row.ownerEmail || '',
          row.ownerPhone || '',
          row.ownerCompany || '',
          row.title || '',
          row.status || 'pending_review',
          row.source || 'ads.html',
          JSON.stringify(row),
          row.createdAt || nowIso(),
          row.updatedAt || nowIso(),
        ]
      )
    )
    .then(() => ({ ok: true }))
    .catch((err) => {
      console.error('hub_ad_submissions persist failed:', err.message);
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
    const res = await client.query(`SELECT payload FROM hub_ad_submissions ORDER BY created_at DESC`);
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
    console.error('hub_ad_submissions hydrate failed:', err.message);
    return { ok: false, error: err.message };
  } finally {
    await client.end().catch(() => {});
  }
}

function createSubmission({
  session = null,
  guestContact = null,
  ad = {},
  idempotencyKey = '',
  claimedCustomerId = '',
} = {}) {
  const loggedIn = Boolean(session && session.ok && session.email);
  const ownerType = loggedIn ? 'Customer' : 'Guest';

  let ownerName = '';
  let ownerEmail = '';
  let ownerPhone = '';
  let ownerCompany = '';
  let customerId = '';
  let guestContactId = '';

  if (loggedIn) {
    ownerEmail = String(session.email || '').toLowerCase();
    ownerName = String(guestContact?.name || session.name || session.fullName || ownerEmail).trim();
    ownerPhone = String(guestContact?.phone || session.phone || session.account?.phone || '').trim();
    ownerCompany = String(guestContact?.company || session.company || session.account?.company || '').trim();
    // Never trust client-claimed Customer ID — bind from session portal
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
      const err = new Error('لا يمكن إرسال الإعلان باسم عميل آخر.');
      err.status = 403;
      err.code = 'CUSTOMER_ID_TAMPER';
      throw err;
    }
  } else {
    ownerName = String(guestContact?.name || '').trim();
    ownerEmail = String(guestContact?.email || '').trim().toLowerCase();
    ownerPhone = String(guestContact?.phone || '').trim();
    ownerCompany = String(guestContact?.company || '').trim();
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
    guestContactId = uid('GUEST').toUpperCase();
  }

  if (!ownerName || !isValidEmail(ownerEmail) || !isValidPhone(ownerPhone)) {
    const err = new Error('بيانات صاحب الإعلان غير مكتملة.');
    err.status = 400;
    throw err;
  }

  const title = String(ad.title || '').trim();
  const headline = String(ad.headline || title).trim();
  if (!title || !headline) {
    const err = new Error('اسم الإعلان وعنوانه مطلوبان.');
    err.status = 400;
    throw err;
  }

  const store = readStore();
  const key = String(idempotencyKey || '').trim();
  if (key) {
    const existing = store.submissions.find(
      (s) =>
        s.idempotencyKey === key &&
        String(s.ownerEmail || '').toLowerCase() === ownerEmail
    );
    if (existing) {
      return { submission: existing, duplicate: true, persisted: persistToDb(existing) };
    }
  }

  const createdAt = nowIso();
  const adId = String(ad.id || uid('ad'));
  const adCode = String(ad.adCode || nextAdCode());
  const requestId = nextRequestId();

  const submission = {
    id: uid('adsub'),
    requestId,
    adId,
    adCode,
    ownerType,
    customerId: customerId || '',
    guestContactId: guestContactId || '',
    ownerName,
    ownerEmail,
    ownerPhone,
    ownerCompany,
    isGuest: ownerType === 'Guest',
    title,
    headline,
    desc: String(ad.desc || ad.bodyText || ''),
    bodyText: String(ad.bodyText || ad.desc || ''),
    contentType: String(ad.contentType || 'image'),
    mediaDataUrl: ad.mediaDataUrl || '',
    mediaName: ad.mediaName || '',
    mediaSize: Number(ad.mediaSize) || 0,
    thumbnailDataUrl: ad.thumbnailDataUrl || '',
    destinationUrl: ad.destinationUrl || '',
    ctaLabel: ad.ctaLabel || '',
    fileAction: ad.fileAction || 'open',
    placements: Array.isArray(ad.placements) ? ad.placements.slice() : [],
    position: ad.position || 'top',
    audience: ad.audience || 'all',
    audienceDetail: ad.audienceDetail || '',
    scheduleMode: ad.scheduleMode || 'immediate',
    adStartDate: ad.adStartDate || '',
    adStartTime: ad.adStartTime || '',
    adEndDate: ad.adEndDate || '',
    adEndTime: ad.adEndTime || '',
    status: 'pending_review',
    statusLabel: 'بانتظار المراجعة',
    source: 'ads.html',
    sourceModule: 'الإعلانات',
    sourceAction: 'نشر إعلان',
    requestType: 'Ad Submission',
    requestTypeLabel: 'طلب نشر إعلان',
    idempotencyKey: key || null,
    createdAt,
    updatedAt: createdAt,
  };

  store.submissions.unshift(submission);
  writeStore(store.submissions);
  const persisted = persistToDb(submission);
  return { submission, duplicate: false, persisted };
}

function listSubmissions({ email = '', staff = false } = {}) {
  const all = readStore().submissions;
  if (staff) return all;
  const e = String(email || '').toLowerCase();
  if (!e) return [];
  return all.filter((s) => String(s.ownerEmail || '').toLowerCase() === e);
}

function getSubmission(id) {
  const key = String(id || '');
  return (
    readStore().submissions.find(
      (s) => s.id === key || s.requestId === key || s.adId === key || s.adCode === key
    ) || null
  );
}

function assertCanView(submission, session) {
  if (!submission) {
    const err = new Error('طلب الإعلان غير موجود.');
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

function toAdminRequest(submission) {
  if (!submission) return null;
  return {
    id: submission.requestId,
    requestId: submission.requestId,
    requestType: 'Ad Submission',
    requestTypeLabel: 'طلب نشر إعلان',
    title: `طلب نشر إعلان: ${submission.title}`,
    description: submission.desc || submission.headline || '',
    status: 'Pending Review',
    statusLabel: 'بانتظار المراجعة',
    priority: 'متوسطة',
    sourceModule: 'الإعلانات',
    sourcePage: 'الإعلانات',
    sourceUrl: 'ads.html',
    sourceAction: 'نشر إعلان',
    referenceType: 'Ad',
    referenceId: submission.adId,
    ownerType: submission.ownerType,
    isGuest: submission.ownerType === 'Guest',
    customerId: submission.ownerType === 'Customer' ? submission.customerId : '',
    guestContactId: submission.guestContactId || '',
    customerName: submission.ownerName,
    email: submission.ownerEmail,
    phone: submission.ownerPhone,
    company: submission.ownerCompany || '',
    assignedTo: 'Ads Desk',
    department: 'Marketing',
    channel: 'Web',
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
    serverSubmissionId: submission.id,
    adSnapshot: {
      adId: submission.adId,
      adCode: submission.adCode,
      title: submission.title,
      headline: submission.headline,
      contentType: submission.contentType,
      desc: submission.desc,
      bodyText: submission.bodyText,
      placements: submission.placements,
      destinationUrl: submission.destinationUrl,
      ctaLabel: submission.ctaLabel,
      mediaDataUrl: submission.mediaDataUrl ? '[media]' : '',
      mediaName: submission.mediaName,
      mediaPreview: submission.mediaDataUrl || '',
      adStartDate: submission.adStartDate,
      adEndDate: submission.adEndDate,
      audience: submission.audience,
      workflowStatus: submission.status,
    },
    attachments: submission.mediaName
      ? [{ name: submission.mediaName, size: submission.mediaSize, at: submission.createdAt }]
      : [],
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
  isValidEmail,
  isValidPhone,
  createSubmission,
  listSubmissions,
  getSubmission,
  assertCanView,
  toAdminRequest,
  hydrateFromDb,
  persistToDb,
  readStore,
};
