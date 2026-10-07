/**
 * مرفقات مركز العميل — مرتبطة بـ ticket / complaint / request.
 * التخزين عبر hub-uploads (حد 1500MB)، والوصول محصور بمالك السجل أو Staff.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const hubUploads = require('./hub-uploads');

const STORE_PATH = path.join(__dirname, '..', 'data', 'client-attachments.json');
const ENTITY_TYPES = new Set(['ticket', 'complaint', 'request']);
const CATEGORIES = new Set(['image', 'file', 'video']);

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function blankStore() {
  return { version: 1, attachments: [], updatedAt: nowIso() };
}

function ensureDir() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readStore() {
  ensureDir();
  if (!fs.existsSync(STORE_PATH)) {
    const blank = blankStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(blank, null, 2), 'utf8');
    return blank;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return {
      version: raw.version || 1,
      attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
      updatedAt: raw.updatedAt || nowIso(),
    };
  } catch {
    return blankStore();
  }
}

function writeStore(store) {
  ensureDir();
  store.updatedAt = nowIso();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  return store;
}

function normalizeCategory(raw, mime, name) {
  const c = String(raw || '').toLowerCase();
  if (CATEGORIES.has(c)) return c;
  const m = String(mime || '').toLowerCase();
  const n = String(name || '').toLowerCase();
  if (m.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|heic|avif)$/i.test(n)) return 'image';
  if (m.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(n)) return 'video';
  return 'file';
}

function publicAttachment(att) {
  if (!att) return null;
  return {
    id: att.id,
    entityType: att.entityType,
    entityId: att.entityId,
    category: att.category,
    originalFileName: att.originalFileName,
    mimeType: att.mimeType,
    fileSize: att.fileSize,
    fileSizeLabel: formatSize(att.fileSize),
    createdAt: att.createdAt,
    contentUrl: `/api/client/attachments/${encodeURIComponent(att.id)}/content`,
    adminContentUrl: `/api/admin/posha/attachments/${encodeURIComponent(att.id)}/content`,
  };
}

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function findAttachment(store, id) {
  return (store.attachments || []).find((a) => String(a.id) === String(id)) || null;
}

function listForEntity(entityType, entityId) {
  const store = readStore();
  return (store.attachments || [])
    .filter((a) => String(a.entityType) === String(entityType) && String(a.entityId) === String(entityId))
    .map(publicAttachment);
}

function attachToEntityRecords(clientPortalStore, entityType, entityId) {
  // Best-effort: mirror public attachment list onto the entity for convenience
  if (!clientPortalStore?.clients) return;
  const list = listForEntity(entityType, entityId);
  Object.values(clientPortalStore.clients).forEach((client) => {
    if (!client) return;
    if (entityType === 'ticket') {
      const t = (client.tickets || []).find((x) => x.id === entityId || x.number === entityId);
      if (t) t.attachments = list;
    } else if (entityType === 'complaint') {
      const c = (client.complaints || []).find((x) => x.id === entityId || x.number === entityId);
      if (c) c.attachments = list;
    } else if (entityType === 'request') {
      const r = (client.serviceRequests || []).find((x) => x.id === entityId || x.number === entityId);
      if (r) r.attachments = list;
    }
  });
}

function enrichEntities(list, entityType) {
  return (list || []).map((item) => ({
    ...item,
    attachments: listForEntity(entityType, item.id),
  }));
}

function resolveOwnerEntity(clientPortalStore, entityType, entityId) {
  if (!clientPortalStore?.clients) return null;
  for (const client of Object.values(clientPortalStore.clients)) {
    if (!client) continue;
    let entity = null;
    if (entityType === 'ticket') {
      entity = (client.tickets || []).find((x) => x.id === entityId || x.number === entityId) || null;
    } else if (entityType === 'complaint') {
      entity = (client.complaints || []).find((x) => x.id === entityId || x.number === entityId) || null;
    } else if (entityType === 'request') {
      entity = (client.serviceRequests || []).find((x) => x.id === entityId || x.number === entityId) || null;
    }
    if (entity) {
      return { client, entity, ownerEmail: String(client.email || '').toLowerCase() };
    }
  }
  return null;
}

async function saveAttachmentFromRequest(req, { entityType, entityId, category, ownerEmail, sessionEmail }) {
  const type = String(entityType || '').toLowerCase();
  if (!ENTITY_TYPES.has(type)) {
    const err = new Error('نوع السجل غير مدعوم للمرفقات');
    err.status = 400;
    throw err;
  }
  const eid = String(entityId || '').trim();
  if (!eid) {
    const err = new Error('معرّف الطلب مطلوب');
    err.status = 400;
    throw err;
  }
  const owner = String(ownerEmail || sessionEmail || '').toLowerCase();
  if (!owner) {
    const err = new Error('مالك المرفق غير معروف');
    err.status = 403;
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
  if (declared > hubUploads.MAX_UPLOAD_BYTES) {
    try {
      req.resume();
    } catch {
      /* ignore */
    }
    const err = new Error(hubUploads.sizeError(hubUploads.MAX_UPLOAD_BYTES));
    err.status = 413;
    throw err;
  }

  const saved = await hubUploads.saveRequestToFile(req);
  if (saved.size > hubUploads.MAX_UPLOAD_BYTES) {
    const filePath = hubUploads.resolveUploadPath(saved.id);
    if (filePath) fs.unlink(filePath, () => {});
    const err = new Error(hubUploads.sizeError(hubUploads.MAX_UPLOAD_BYTES));
    err.status = 413;
    throw err;
  }

  const cat = normalizeCategory(category, saved.mime || mime, saved.name || originalName);
  const attachment = {
    id: uid('catt'),
    entityType: type,
    entityId: eid,
    ownerEmail: owner,
    uploadedBy: String(sessionEmail || owner).toLowerCase(),
    category: cat,
    originalFileName: hubUploads.safeOriginalName
      ? hubUploads.safeOriginalName(saved.name || originalName)
      : saved.name || originalName,
    mimeType: saved.mime || mime,
    fileSize: saved.size,
    storageRef: saved.id,
    uploadStatus: 'ready',
    private: true,
    createdAt: nowIso(),
  };

  const store = readStore();
  store.attachments.unshift(attachment);
  writeStore(store);
  return publicAttachment(attachment);
}

function canAccessAttachment(attachmentId, { email, staff = false } = {}) {
  const store = readStore();
  const att = findAttachment(store, attachmentId);
  if (!att) return { ok: false, status: 404, error: 'المرفق غير موجود' };
  if (staff) return { ok: true, attachment: att };
  const who = String(email || '').toLowerCase();
  if (!who || who !== String(att.ownerEmail || '').toLowerCase()) {
    return { ok: false, status: 403, error: 'ليس لديك صلاحية فتح هذا المرفق' };
  }
  return { ok: true, attachment: att };
}

function deleteAttachment(attachmentId, { email, staff = false } = {}) {
  const access = canAccessAttachment(attachmentId, { email, staff });
  if (!access.ok) return access;
  const store = readStore();
  const att = access.attachment;
  store.attachments = store.attachments.filter((a) => String(a.id) !== String(attachmentId));
  writeStore(store);
  const filePath = hubUploads.resolveUploadPath(att.storageRef);
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* best effort */
    }
  }
  return { ok: true, attachment: publicAttachment(att) };
}

function isPrivateStorageRef(storageRef) {
  const store = readStore();
  return (store.attachments || []).some((a) => a.private && String(a.storageRef) === String(storageRef));
}

module.exports = {
  ENTITY_TYPES,
  MAX_UPLOAD_MB: hubUploads.MAX_UPLOAD_MB,
  MAX_UPLOAD_BYTES: hubUploads.MAX_UPLOAD_BYTES,
  listForEntity,
  enrichEntities,
  resolveOwnerEntity,
  saveAttachmentFromRequest,
  canAccessAttachment,
  deleteAttachment,
  publicAttachment,
  isPrivateStorageRef,
  attachToEntityRecords,
  formatSize,
};
