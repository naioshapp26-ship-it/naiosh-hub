/**
 * مرفقات طلبات «سجل معنا» — metadata مرتبط بـ Request ID، تخزين الملفات عبر hub-uploads.
 * لا يُخزَّن محتوى الفيديو في قاعدة البيانات.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const hubUploads = require('./hub-uploads');

const STORE_PATH = path.join(__dirname, '..', 'data', 'register-attachments.json');
const GRANTS_PATH = path.join(__dirname, '..', 'data', 'platform-grants.json');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const DOC_EXTS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm']);

const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const DOC_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
]);
const VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

function blankStore() {
  return { version: 1, requests: [], attachments: [], updatedAt: new Date().toISOString() };
}

function ensureStore() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(blankStore(), null, 2), 'utf8');
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return {
      version: 1,
      requests: Array.isArray(raw.requests) ? raw.requests : [],
      attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
      updatedAt: raw.updatedAt || new Date().toISOString(),
    };
  } catch {
    return blankStore();
  }
}

function writeStore(state) {
  ensureStore();
  const next = {
    version: 1,
    requests: Array.isArray(state.requests) ? state.requests : [],
    attachments: Array.isArray(state.attachments) ? state.attachments : [],
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(STORE_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function ensureGrantsFile() {
  const dir = path.dirname(GRANTS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(GRANTS_PATH)) {
    fs.writeFileSync(GRANTS_PATH, JSON.stringify({ version: 1, grants: [] }, null, 2), 'utf8');
  }
}

function readGrants() {
  ensureGrantsFile();
  try {
    const raw = JSON.parse(fs.readFileSync(GRANTS_PATH, 'utf8'));
    return {
      version: 1,
      grants: Array.isArray(raw.grants) ? raw.grants : [],
      updatedAt: raw.updatedAt || new Date().toISOString(),
    };
  } catch {
    return { version: 1, grants: [], updatedAt: new Date().toISOString() };
  }
}

let grantsDbQueue = Promise.resolve();

function writeGrants(state, { awaitDb = false } = {}) {
  ensureGrantsFile();
  const next = {
    version: 1,
    grants: Array.isArray(state.grants) ? state.grants : [],
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(GRANTS_PATH, JSON.stringify(next, null, 2), 'utf8');
  // Durable mirror for Railway redeploys (same key as /api/hub/platform-grants)
  try {
    const { getDatabaseUrl, withClient } = require('../db/migrate');
    if (getDatabaseUrl()) {
      grantsDbQueue = grantsDbQueue
        .then(() =>
          withClient(async (client) => {
            await client.query(
              `INSERT INTO hub_meta (key, value, updated_at)
               VALUES ($1, $2::jsonb, NOW())
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
              ['platform_grants_v1', JSON.stringify(next)]
            );
          })
        )
        .catch((err) => console.warn('[register-attachments] grants db mirror failed:', err.message));
    }
  } catch (_) {}
  if (awaitDb) return grantsDbQueue.then(() => next);
  return next;
}

/**
 * Apply HA decision onto the durable grant + register request stores (file + hub_meta).
 * Must be awaited from decide() so production GET /api/hub/platform-grants sees the new status.
 */
async function setGrantStatus(grantId, status, statusLabel) {
  const id = String(grantId || '');
  if (!id) return { ok: false, error: 'missing grant id' };
  const grants = readGrants();
  let row = (grants.grants || []).find((g) => String(g.id) === id);
  if (!row) {
    // Fall back to register-attachments request mirror
    const store = readStore();
    const req = (store.requests || []).find((r) => String(r.id) === id);
    if (req) {
      row = { ...req };
      delete row.uploadToken;
      grants.grants = grants.grants || [];
      grants.grants.unshift(row);
    }
  }
  if (!row) return { ok: false, error: 'grant not found' };
  row.status = status;
  row.statusLabel = statusLabel || status;
  row.updatedAt = new Date().toISOString();
  if (status === 'active') row.approvedAt = row.updatedAt;
  if (status === 'rejected') row.rejectedAt = row.updatedAt;
  await writeGrants(grants, { awaitDb: true });

  const store = readStore();
  const req = (store.requests || []).find((r) => String(r.id) === id);
  if (req) {
    req.status = status === 'active' ? 'active' : status;
    req.statusLabel = statusLabel || req.statusLabel;
    req.updatedAt = row.updatedAt;
    if (status === 'active') req.approvedAt = row.updatedAt;
    if (status === 'rejected') req.rejectedAt = row.updatedAt;
    writeStore(store);
  }
  return { ok: true, grant: row };
}

function makePublicId() {
  const a = Date.now().toString(36).toUpperCase();
  const b = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `REG-REQ-${a}-${b}`;
}

function makeUploadToken() {
  return crypto.randomBytes(24).toString('hex');
}

function makeAttachmentId() {
  return `att-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}

function categoryOf(filename, mime) {
  const ext = path.extname(String(filename || '')).toLowerCase();
  const m = String(mime || '').toLowerCase().split(';')[0].trim();
  if (IMAGE_EXTS.has(ext) || IMAGE_MIMES.has(m)) return 'image';
  if (VIDEO_EXTS.has(ext) || VIDEO_MIMES.has(m)) return 'video';
  if (DOC_EXTS.has(ext) || DOC_MIMES.has(m)) return 'document';
  return '';
}

function validateRegisterFile(filename, mime, size, categoryHint) {
  const base = hubUploads.validateUploadMeta(filename, mime, size);
  if (!base.ok) {
    const message =
      base.error === 'file_too_large'
        ? hubUploads.sizeError(base.maxBytes || hubUploads.MAX_UPLOAD_BYTES)
        : base.error === 'file_type_blocked'
          ? 'نوع الملف غير مسموح لأسباب أمنية (ملفات تنفيذية أو سكربتات خادم).'
          : 'ملف غير مسموح';
    return { ...base, message };
  }

  const cat = categoryHint || categoryOf(filename, mime);
  if (!cat) {
    return { ok: false, error: 'file_type_not_allowed_for_register', message: 'نوع الملف غير مسموح لمرفقات التسجيل' };
  }
  if (categoryHint && cat !== categoryHint) {
    // إذا جاء تلميح فئة لكن الامتداد محظور/غير مطابق، افحص الحظر أولًا
    const ext = path.extname(String(filename || '')).toLowerCase();
    if (hubUploads.isBlockedExt(ext)) {
      return { ok: false, error: 'file_type_blocked', message: 'نوع الملف غير مسموح لأسباب أمنية (ملفات تنفيذية أو سكربتات خادم).' };
    }
    return { ok: false, error: 'category_mismatch', message: 'نوع الملف لا يطابق حقل الرفع' };
  }

  const ext = path.extname(String(filename || '')).toLowerCase();
  if (hubUploads.isBlockedExt(ext)) {
    return { ok: false, error: 'file_type_blocked', message: 'نوع الملف غير مسموح لأسباب أمنية (ملفات تنفيذية أو سكربتات خادم).' };
  }

  if (cat === 'image' && !(IMAGE_EXTS.has(ext) || IMAGE_MIMES.has(String(mime || '').toLowerCase()))) {
    return { ok: false, error: 'image_type_invalid', message: 'صيغة الصورة غير مدعومة (JPG/JPEG/PNG/WEBP)' };
  }
  if (cat === 'video' && !(VIDEO_EXTS.has(ext) || VIDEO_MIMES.has(String(mime || '').toLowerCase()))) {
    return { ok: false, error: 'video_type_invalid', message: 'صيغة الفيديو غير مدعومة (MP4/MOV/WEBM)' };
  }
  if (cat === 'document' && !(DOC_EXTS.has(ext) || DOC_MIMES.has(String(mime || '').toLowerCase()))) {
    // .exe يصل هنا فقط إذا لم يُحظر أعلاه
    return { ok: false, error: 'document_type_invalid', message: 'صيغة المستند غير مدعومة' };
  }

  return { ok: true, category: cat, maxBytes: hubUploads.MAX_UPLOAD_BYTES, maxLabel: `${hubUploads.MAX_UPLOAD_MB}MB` };
}

function publicRequest(row, { includeToken = false } = {}) {
  if (!row) return null;
  const copy = { ...row };
  if (!includeToken) delete copy.uploadToken;
  delete copy.adminPassword;
  return copy;
}

function findRequest(store, requestId) {
  return (store.requests || []).find((r) => String(r.id) === String(requestId)) || null;
}

function findAttachment(store, attachmentId) {
  return (store.attachments || []).find((a) => String(a.id) === String(attachmentId)) || null;
}

function attachmentsForRequest(store, requestId) {
  return (store.attachments || []).filter((a) => String(a.requestId) === String(requestId));
}

function summarizeAttachments(list) {
  const images = list.filter((a) => a.category === 'image' && a.uploadStatus === 'ready');
  const documents = list.filter((a) => a.category === 'document' && a.uploadStatus === 'ready');
  const videos = list.filter((a) => a.category === 'video' && a.uploadStatus === 'ready');
  return {
    images: { count: images.length, items: images },
    documents: { count: documents.length, items: documents },
    videos: { count: videos.length, items: videos },
    total: images.length + documents.length + videos.length,
  };
}

async function createRegisterRequest(payload = {}) {
  const now = new Date().toISOString();
  const id = makePublicId();
  const uploadToken = makeUploadToken();
  const request = {
    id,
    kind: 'signup',
    source: 'register',
    status: 'pending',
    statusLabel: 'بانتظار موافقة المدير الأعلى',
    companyName: String(payload.companyName || payload.platformLabel || payload.adminName || '').trim(),
    slug: String(payload.slug || payload.subdomain || '').trim().toLowerCase(),
    host: String(payload.host || '').trim(),
    adminName: String(payload.adminName || '').trim(),
    adminPhone: String(payload.adminPhone || '').trim(),
    adminEmail: String(payload.adminEmail || '').trim().toLowerCase(),
    adminPassword: String(payload.adminPassword || ''),
    country: String(payload.country || '').trim(),
    branch: String(payload.branch || '').trim(),
    branchLabel: String(payload.branchLabel || '').trim(),
    incubator: String(payload.incubator || '').trim(),
    incubatorLabel: String(payload.incubatorLabel || '').trim(),
    platform: String(payload.platform || '').trim(),
    platformLabel: String(payload.platformLabel || '').trim(),
    requestedSystem: String(payload.requestedSystem || '').trim().toUpperCase(),
    requestedSystemLabel: String(payload.requestedSystemLabel || '').trim(),
    notes: String(payload.notes || '').trim(),
    plan: 'free',
    planLabel: 'باقة مجانية',
    uploadToken,
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };

  const store = readStore();
  // Idempotency: same email+slug open request → reuse
  const existingOpen = (store.requests || []).find(
    (r) =>
      String(r.adminEmail || '').toLowerCase() === request.adminEmail &&
      String(r.slug || '') === request.slug &&
      ['pending', 'provisioning'].includes(r.status)
  );
  if (existingOpen) {
    const hubHA = require('./hub-higher-approvals');
    const approval = await hubHA.enqueuePlatformGrant(existingOpen, {
      name: existingOpen.adminName || 'عميل',
      email: existingOpen.adminEmail,
    });
    return {
      request: existingOpen,
      uploadToken: existingOpen.uploadToken || uploadToken,
      approval: approval.request,
      deduped: true,
    };
  }

  store.requests.unshift(request);
  writeStore(store);

  // Mirror into platform-grants so rent-admin / higher-approvals hydrate the same Request ID.
  const grants = readGrants();
  const grantRow = { ...request };
  delete grantRow.uploadToken;
  grants.grants = (grants.grants || []).filter((g) => String(g.id) !== id);
  grants.grants.unshift(grantRow);
  writeGrants(grants);

  // Atomic higher-approval record — fail the signup if durable approval cannot be created.
  const hubHA = require('./hub-higher-approvals');
  let approval;
  try {
    approval = await hubHA.enqueuePlatformGrant(
      grantRow,
      { name: request.adminName || 'عميل', email: request.adminEmail },
      { silent: false, flush: true }
    );
  } catch (err) {
    // Roll back request + grant so we never show "pending approval" without an inbox row.
    const rolled = readStore();
    rolled.requests = (rolled.requests || []).filter((r) => String(r.id) !== id);
    writeStore(rolled);
    const g2 = readGrants();
    g2.grants = (g2.grants || []).filter((g) => String(g.id) !== id);
    writeGrants(g2);
    const e = new Error(err.message || 'تعذر إنشاء سجل موافقة المدير الأعلى');
    e.status = err.status || 503;
    e.code = err.code || 'HIGHER_APPROVAL_CREATE_FAILED';
    throw e;
  }

  request.approvalId = approval?.request?.id || '';
  grantRow.approvalId = request.approvalId;
  // Persist approvalId on both stores
  const store2 = readStore();
  const req2 = (store2.requests || []).find((r) => String(r.id) === id);
  if (req2) {
    req2.approvalId = request.approvalId;
    writeStore(store2);
  }
  const g3 = readGrants();
  const gr3 = (g3.grants || []).find((g) => String(g.id) === id);
  if (gr3) {
    gr3.approvalId = request.approvalId;
    writeGrants(g3);
  }

  return { request, uploadToken, approval: approval.request, deduped: false };
}

function syncGrantAttachments(requestId) {
  const store = readStore();
  const req = findRequest(store, requestId);
  if (!req) return null;
  const atts = attachmentsForRequest(store, requestId).filter((a) => a.uploadStatus === 'ready');
  req.attachments = atts.map((a) => ({
    id: a.id,
    category: a.category,
    fileName: a.fileName,
    originalFileName: a.originalFileName,
    fileType: a.fileType,
    mimeType: a.mimeType,
    fileSize: a.fileSize,
    storageRef: a.storageRef,
    uploadStatus: a.uploadStatus,
    createdAt: a.createdAt,
    contentUrl: `/api/hub/register-attachments/${encodeURIComponent(a.id)}/content`,
  }));
  req.updatedAt = new Date().toISOString();
  writeStore(store);

  const grants = readGrants();
  const row = (grants.grants || []).find((g) => String(g.id) === String(requestId));
  if (row) {
    row.attachments = req.attachments.slice();
    row.updatedAt = req.updatedAt;
    row.status = req.status;
    row.statusLabel = req.statusLabel;
    writeGrants(grants);
  }
  return req;
}

function assertUploadToken(request, token) {
  if (!request) return { ok: false, status: 404, error: 'الطلب غير موجود' };
  if (!token || String(token) !== String(request.uploadToken || '')) {
    return { ok: false, status: 403, error: 'رمز رفع المرفقات غير صالح' };
  }
  return { ok: true };
}

async function saveAttachmentFromRequest(req, { requestId, uploadToken, category }) {
  const store = readStore();
  const request = findRequest(store, requestId);
  const gate = assertUploadToken(request, uploadToken);
  if (!gate.ok) {
    const err = new Error(gate.error);
    err.status = gate.status;
    throw err;
  }

  let originalName = 'file';
  try {
    originalName = decodeURIComponent(String(req.headers['x-file-name'] || 'file'));
  } catch {
    originalName = String(req.headers['x-file-name'] || 'file');
  }
  const mime = String(req.headers['x-file-type'] || req.headers['content-type'] || 'application/octet-stream')
    .split(';')[0]
    .trim()
    .toLowerCase();
  const declared = Number(req.headers['content-length'] || 0);
  const check = validateRegisterFile(originalName, mime, declared || 0, category);
  if (!check.ok) {
    try {
      req.resume();
    } catch {
      /* ignore */
    }
    const err = new Error(check.message || hubUploads.sizeError() || 'ملف غير مسموح');
    err.status = check.error === 'file_too_large' ? 413 : 400;
    err.code = check.error;
    throw err;
  }

  const saved = await hubUploads.saveRequestToFile(req);
  const recheck = validateRegisterFile(saved.name || originalName, saved.mime || mime, saved.size, category);
  if (!recheck.ok) {
    const filePath = hubUploads.resolveUploadPath(saved.id);
    if (filePath) fs.unlink(filePath, () => {});
    const err = new Error(recheck.message || 'ملف غير مسموح');
    err.status = 400;
    err.code = recheck.error;
    throw err;
  }

  const attachment = {
    id: makeAttachmentId(),
    requestId,
    applicantEmail: request.adminEmail || '',
    category: recheck.category,
    fileName: saved.id,
    originalFileName: hubUploads.safeOriginalName ? hubUploads.safeOriginalName(saved.name || originalName) : saved.name,
    fileType: path.extname(saved.id || '').replace('.', '').toLowerCase(),
    mimeType: saved.mime || mime,
    fileSize: saved.size,
    storageRef: saved.id,
    uploadStatus: 'ready',
    createdAt: new Date().toISOString(),
    private: true,
  };

  // Re-read after long upload
  const fresh = readStore();
  fresh.attachments.unshift(attachment);
  const reqRow = findRequest(fresh, requestId);
  if (reqRow) reqRow.updatedAt = new Date().toISOString();
  writeStore(fresh);
  syncGrantAttachments(requestId);

  return attachment;
}

function deleteAttachment(attachmentId, { uploadToken, staff = false } = {}) {
  const store = readStore();
  const att = findAttachment(store, attachmentId);
  if (!att) return { ok: false, status: 404, error: 'المرفق غير موجود' };
  const request = findRequest(store, att.requestId);
  if (!staff) {
    const gate = assertUploadToken(request, uploadToken);
    if (!gate.ok) return gate;
  }
  store.attachments = store.attachments.filter((a) => String(a.id) !== String(attachmentId));
  writeStore(store);
  const filePath = hubUploads.resolveUploadPath(att.storageRef);
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* best-effort orphan cleanup */
    }
  }
  syncGrantAttachments(att.requestId);
  return { ok: true, attachment: att };
}

function getRequestBundle(requestId, { uploadToken, staff = false } = {}) {
  const store = readStore();
  const request = findRequest(store, requestId);
  if (!request) return { ok: false, status: 404, error: 'الطلب غير موجود' };
  if (!staff) {
    const gate = assertUploadToken(request, uploadToken);
    if (!gate.ok) return gate;
  }
  const attachments = attachmentsForRequest(store, requestId);
  return {
    ok: true,
    request: publicRequest(request, { includeToken: false }),
    attachments,
    summary: summarizeAttachments(attachments),
  };
}

function isPrivateStorageRef(storageRef) {
  const store = readStore();
  return (store.attachments || []).some((a) => a.private && String(a.storageRef) === String(storageRef));
}

function canAccessAttachment(attachmentId, session, uploadToken) {
  const store = readStore();
  const att = findAttachment(store, attachmentId);
  if (!att) return { ok: false, status: 404, error: 'المرفق غير موجود' };
  if (session?.ok && (session.lane === 'SUPER_ADMIN' || session.lane === 'ADMIN')) {
    return { ok: true, attachment: att, request: findRequest(store, att.requestId) };
  }
  const request = findRequest(store, att.requestId);
  const gate = assertUploadToken(request, uploadToken);
  if (!gate.ok) return { ok: false, status: 403, error: 'غير مصرح بالوصول إلى هذا المرفق' };
  return { ok: true, attachment: att, request };
}

module.exports = {
  STORE_PATH,
  IMAGE_EXTS,
  DOC_EXTS,
  VIDEO_EXTS,
  readStore,
  writeStore,
  readGrants,
  writeGrants,
  setGrantStatus,
  createRegisterRequest,
  saveAttachmentFromRequest,
  deleteAttachment,
  getRequestBundle,
  syncGrantAttachments,
  findRequest,
  findAttachment,
  attachmentsForRequest,
  summarizeAttachments,
  validateRegisterFile,
  publicRequest,
  isPrivateStorageRef,
  canAccessAttachment,
  categoryOf,
  makePublicId,
};
