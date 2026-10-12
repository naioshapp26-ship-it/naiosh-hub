/**
 * Unified entity attachments for Hub forms (employee, staff, client, identity, solution, …).
 * Bytes via hub-uploads (1500MB); metadata durable via hub_meta + optional relational refs.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const hubUploads = require('./hub-uploads');
const { createDurableMetaStore } = require('./hub-durable-meta-store');

const STORE_PATH = path.join(__dirname, '..', 'data', 'entity-attachments.json');
const META_KEY = 'hub_entity_attachments_v1';
const CATEGORIES = new Set(['image', 'file', 'video']);
const ENTITY_TYPES = new Set([
  'employee',
  'staff',
  'client',
  'identity',
  'solution',
  'product',
  'store',
  'system',
  'workplace',
  'security',
  'governance',
  'data_asset',
  'request',
  'task',
  'other',
]);

let durable = null;
function getDurable() {
  if (!durable) {
    durable = createDurableMetaStore({
      metaKey: META_KEY,
      storePath: STORE_PATH,
      label: 'hub-entity-attachments',
      blank: blankStore,
      preferDb: (dbStore, fileStore) => {
        const dbN = Array.isArray(dbStore?.attachments) ? dbStore.attachments.length : 0;
        const fileN = Array.isArray(fileStore?.attachments) ? fileStore.attachments.length : 0;
        return dbN >= fileN;
      },
    });
  }
  return durable;
}

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function blankStore() {
  return { version: 1, seq: 0, attachments: [], idempotency: {}, updatedAt: nowIso() };
}

function readStore() {
  const raw = getDurable().readStore();
  return {
    version: raw.version || 1,
    seq: Number(raw.seq || 0),
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    idempotency: raw.idempotency && typeof raw.idempotency === 'object' ? raw.idempotency : {},
    updatedAt: raw.updatedAt || nowIso(),
  };
}

function writeStore(store) {
  store.updatedAt = nowIso();
  return getDurable().writeStore({
    version: store.version || 1,
    seq: Number(store.seq || 0),
    attachments: Array.isArray(store.attachments) ? store.attachments : [],
    idempotency: store.idempotency || {},
    updatedAt: store.updatedAt,
  });
}

async function hydrateFromDb() {
  return getDurable().hydrateFromDb();
}

async function flushDurable() {
  return getDurable().flushDurable();
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

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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
    ownerEmail: att.ownerEmail,
    uploadedBy: att.uploadedBy,
    storageRef: att.storageRef,
    url: att.url || (att.storageRef ? `/uploads/${att.storageRef}` : ''),
    contentUrl: `/api/hub/entity-attachments/${encodeURIComponent(att.id)}/content`,
    createdAt: att.createdAt,
    status: att.status || 'ready',
  };
}

function findAttachment(store, id) {
  return (store.attachments || []).find((a) => String(a.id) === String(id)) || null;
}

function listForEntity(entityType, entityId) {
  const store = readStore();
  const type = String(entityType || '').toLowerCase();
  const eid = String(entityId || '').trim();
  return (store.attachments || [])
    .filter(
      (a) =>
        String(a.entityType) === type &&
        String(a.entityId) === eid &&
        a.status !== 'deleted'
    )
    .map(publicAttachment);
}

function canAccess(att, { email, staff = false } = {}) {
  if (!att || att.status === 'deleted') return { ok: false, status: 404, error: 'المرفق غير موجود' };
  if (staff) return { ok: true, attachment: att };
  const who = String(email || '').toLowerCase();
  if (who && who === String(att.ownerEmail || '').toLowerCase()) return { ok: true, attachment: att };
  return { ok: false, status: 403, error: 'ليس لديك صلاحية فتح هذا المرفق' };
}

function registerFromUpload(
  {
    entityType,
    entityId,
    category,
    uploadId,
    url,
    mime,
    originalName,
    sizeBytes,
    ownerEmail,
    sessionEmail,
    idempotencyKey,
  } = {}
) {
  const type = String(entityType || '').toLowerCase();
  if (!ENTITY_TYPES.has(type)) {
    const err = new Error('نوع السجل غير مدعوم للمرفقات');
    err.status = 400;
    throw err;
  }
  const eid = String(entityId || '').trim();
  if (!eid) {
    const err = new Error('معرّف السجل مطلوب');
    err.status = 400;
    throw err;
  }
  const owner = String(ownerEmail || sessionEmail || '').toLowerCase();
  if (!owner) {
    const err = new Error('مالك المرفق غير معروف');
    err.status = 403;
    throw err;
  }

  const store = readStore();
  const key = String(idempotencyKey || '').trim();
  if (key && store.idempotency[key]) {
    const existing = findAttachment(store, store.idempotency[key]);
    if (existing) return { item: publicAttachment(existing), reused: true };
  }

  const storageRef = String(uploadId || '')
    .replace(/^\/uploads\//, '')
    .trim();
  if (!storageRef && !url) {
    const err = new Error('ملف الرفع مطلوب');
    err.status = 400;
    throw err;
  }

  // Dedup: same storageRef already linked to this entity
  const dup = (store.attachments || []).find(
    (a) =>
      a.status !== 'deleted' &&
      String(a.entityType) === type &&
      String(a.entityId) === eid &&
      String(a.storageRef) === storageRef &&
      storageRef
  );
  if (dup) {
    if (key) {
      store.idempotency[key] = dup.id;
      writeStore(store);
    }
    return { item: publicAttachment(dup), reused: true };
  }

  store.seq = Number(store.seq || 0) + 1;
  const id = `EATT-${String(store.seq).padStart(6, '0')}`;
  const cat = normalizeCategory(category, mime, originalName);
  const attachment = {
    id,
    entityType: type,
    entityId: eid,
    ownerEmail: owner,
    uploadedBy: String(sessionEmail || owner).toLowerCase(),
    category: cat,
    originalFileName: hubUploads.safeOriginalName
      ? hubUploads.safeOriginalName(originalName || storageRef || 'file')
      : originalName || storageRef || 'file',
    mimeType: mime || 'application/octet-stream',
    fileSize: Number(sizeBytes) || 0,
    storageRef,
    url: url || (storageRef ? `/uploads/${storageRef}` : ''),
    status: 'ready',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  store.attachments.unshift(attachment);
  if (key) store.idempotency[key] = id;
  writeStore(store);
  flushDurable().catch(() => {});
  try {
    const rel = require('./hub-customer-relational');
    if (rel.dbEnabled?.()) {
      const obj = require('./hub-object-storage');
      rel.insertAttachmentRef?.({
        ...attachment,
        storageBackend: obj.backendName?.() || 'local',
      });
    }
  } catch {
    /* optional */
  }
  return { item: publicAttachment(attachment), reused: false };
}

function softDelete(attachmentId, { email, staff = false } = {}) {
  const store = readStore();
  const att = findAttachment(store, attachmentId);
  const access = canAccess(att, { email, staff });
  if (!access.ok) {
    const err = new Error(access.error);
    err.status = access.status;
    throw err;
  }
  if (!staff && String(att.uploadedBy || att.ownerEmail) !== String(email || '').toLowerCase()) {
    const err = new Error('غير مصرح بحذف هذا المرفق');
    err.status = 403;
    throw err;
  }
  att.status = 'deleted';
  att.updatedAt = nowIso();
  writeStore(store);
  flushDurable().catch(() => {});
  return publicAttachment(att);
}

function resolveContentPath(att) {
  if (!att?.storageRef) return null;
  return hubUploads.resolveUploadPath(att.storageRef);
}

async function handleApi(req, res, pathname, { sendJson, readBody, requireAuth, isStaffSession }) {
  const session = await requireAuth(req, res);
  if (!session) return true;
  const staff = !!(isStaffSession?.(session) || session.lane === 'SUPER_ADMIN' || session.lane === 'ADMIN');

  try {
    if (pathname === '/api/hub/entity-attachments' && req.method === 'GET') {
      const qs = Object.fromEntries(new URL(req.url, 'http://local').searchParams.entries());
      const type = String(qs.entityType || '').toLowerCase();
      const eid = String(qs.entityId || '').trim();
      if (!type || !eid) {
        sendJson(res, 400, { ok: false, error: 'entityType و entityId مطلوبان' });
        return true;
      }
      let items = listForEntity(type, eid);
      if (!staff) {
        const who = String(session.email || '').toLowerCase();
        items = items.filter((a) => String(a.ownerEmail || '').toLowerCase() === who);
      }
      sendJson(res, 200, { ok: true, items, categories: [...CATEGORIES], entityTypes: [...ENTITY_TYPES] });
      return true;
    }

    if (pathname === '/api/hub/entity-attachments' && req.method === 'POST') {
      const body = await readBody(req);
      const key = String(req.headers['idempotency-key'] || body.idempotencyKey || '').trim();
      const result = registerFromUpload({
        entityType: body.entityType,
        entityId: body.entityId,
        category: body.category,
        uploadId: body.uploadId || body.storageRef || body.id,
        url: body.url,
        mime: body.mime || body.mimeType,
        originalName: body.originalName || body.name,
        sizeBytes: body.sizeBytes || body.size || body.fileSize,
        ownerEmail: body.ownerEmail || session.email,
        sessionEmail: session.email,
        idempotencyKey: key || null,
      });
      // Non-staff may only attach as themselves
      if (!staff && String(result.item.ownerEmail) !== String(session.email || '').toLowerCase()) {
        sendJson(res, 403, { ok: false, error: 'غير مصرح' });
        return true;
      }
      sendJson(res, result.reused ? 200 : 201, { ok: true, item: result.item, reused: result.reused });
      return true;
    }

    {
      const m = pathname.match(/^\/api\/hub\/entity-attachments\/([^/]+)(?:\/(content))?$/);
      if (m && req.method === 'GET') {
        const store = readStore();
        const att = findAttachment(store, decodeURIComponent(m[1]));
        const access = canAccess(att, { email: session.email, staff });
        if (!access.ok) {
          sendJson(res, access.status, { ok: false, error: access.error });
          return true;
        }
        if (m[2] === 'content') {
          const filePath = resolveContentPath(att);
          if (!filePath || !fs.existsSync(filePath)) {
            sendJson(res, 404, { ok: false, error: 'ملف المرفق غير موجود على التخزين' });
            return true;
          }
          const mime = att.mimeType || 'application/octet-stream';
          res.writeHead(200, {
            'Content-Type': mime,
            'Content-Length': fs.statSync(filePath).size,
            'Cache-Control': 'private, max-age=60',
            'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(att.originalFileName || 'file')}`,
          });
          fs.createReadStream(filePath).pipe(res);
          return true;
        }
        sendJson(res, 200, { ok: true, item: publicAttachment(att) });
        return true;
      }
      if (m && req.method === 'DELETE' && !m[2]) {
        const item = softDelete(decodeURIComponent(m[1]), { email: session.email, staff });
        sendJson(res, 200, { ok: true, item });
        return true;
      }
    }

    sendJson(res, 404, { ok: false, error: 'مسار مرفقات الكيان غير معروف' });
  } catch (err) {
    sendJson(res, err.status || 500, { ok: false, error: err.message || 'خطأ مرفقات الكيان' });
  }
  return true;
}

module.exports = {
  ENTITY_TYPES,
  CATEGORIES,
  readStore,
  writeStore,
  hydrateFromDb,
  flushDurable,
  listForEntity,
  registerFromUpload,
  softDelete,
  canAccess,
  publicAttachment,
  findAttachment,
  resolveContentPath,
  handleApi,
  DATA_PATH: STORE_PATH,
};
