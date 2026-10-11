/**
 * Unified media library shared by Marketing Campaigns Studio and Events Studio.
 * Metadata SoT: data/hub-media-library.json (+ optional hub_meta mirror).
 * Bytes live in hub-uploads / hub_upload_blobs.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_PATH = path.join(__dirname, '..', 'data', 'hub-media-library.json');
const META_KEY = 'hub_media_library';

const KINDS = ['video_long', 'video_short', 'reel', 'image', 'ad_file', 'cover', 'other'];
const STATUSES = ['uploading', 'processing', 'ready', 'failed', 'archived'];

function nowIso() {
  return new Date().toISOString();
}

function emptyStore() {
  return {
    version: 1,
    seq: { media: 0 },
    items: [],
    activity: [],
    idempotency: {},
    updatedAt: nowIso(),
  };
}

let lock = Promise.resolve();
function withLock(fn) {
  const run = lock.then(fn, fn);
  lock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function ensureDir() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readStore() {
  ensureDir();
  if (!fs.existsSync(DATA_PATH)) {
    const s = emptyStore();
    writeStore(s);
    return s;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    if (!raw || !Array.isArray(raw.items)) return emptyStore();
    raw.seq = raw.seq || { media: 0 };
    raw.activity = raw.activity || [];
    raw.idempotency = raw.idempotency || {};
    return raw;
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  ensureDir();
  store.updatedAt = nowIso();
  const tmp = DATA_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_PATH);
  mirrorMeta(store).catch(() => {});
}

async function mirrorMeta(store) {
  try {
    const { getDatabaseUrl, withClient } = require('../db/migrate');
    if (!getDatabaseUrl()) return;
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO hub_meta (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [META_KEY, JSON.stringify({ version: store.version, seq: store.seq, count: store.items.length, updatedAt: store.updatedAt })]
      );
    });
  } catch {
    /* optional */
  }
}

function nextCode(store, prefix) {
  store.seq.media = Number(store.seq.media || 0) + 1;
  return `${prefix}-${String(store.seq.media).padStart(6, '0')}`;
}

function actorOf(session) {
  return {
    email: session?.email || '',
    name: session?.name || session?.email || '',
    role: session?.role || '',
  };
}

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function inferKind(mime, name, hint) {
  if (hint && KINDS.includes(hint)) return hint;
  const m = String(mime || '').toLowerCase();
  const n = String(name || '').toLowerCase();
  if (m.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(n)) return 'image';
  if (/reel|short|clip/i.test(n) || hint === 'reel') return 'reel';
  if (m.startsWith('video/')) return hint === 'video_short' ? 'video_short' : 'video_long';
  if (/cover|thumb|poster/i.test(n)) return 'cover';
  if (/ad|banner|creative/i.test(n)) return 'ad_file';
  return 'other';
}

function registerItem(store, body, session, idempotencyKey) {
  if (idempotencyKey && store.idempotency[idempotencyKey]) {
    const existing = store.items.find((x) => x.id === store.idempotency[idempotencyKey]);
    if (existing) return { item: existing, reused: true };
  }
  const uploadId = String(body.uploadId || body.storageRef || '').trim();
  const url = String(body.url || (uploadId ? `/uploads/${uploadId}` : '')).trim();
  if (!uploadId && !url) fail(400, 'ملف الرفع أو الرابط مطلوب');
  const id = nextCode(store, 'MED');
  const actor = actorOf(session);
  const item = {
    id,
    uploadId: uploadId || '',
    url,
    kind: inferKind(body.mime, body.originalName || body.name, body.kind),
    mime: String(body.mime || '').trim(),
    originalName: String(body.originalName || body.name || '').trim(),
    sizeBytes: Number(body.sizeBytes || body.size || 0) || 0,
    durationSec: body.durationSec != null ? Number(body.durationSec) : null,
    width: body.width != null ? Number(body.width) : null,
    height: body.height != null ? Number(body.height) : null,
    coverUrl: String(body.coverUrl || '').trim(),
    ownerEmail: actor.email,
    ownerName: actor.name,
    status: STATUSES.includes(body.status) ? body.status : 'ready',
    processingError: '',
    usages: Array.isArray(body.usages) ? body.usages : [],
    tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
    sourceStudio: String(body.sourceStudio || '').trim(), // marketing | events | reel
    linkedCampaignId: String(body.campaignId || '').trim(),
    linkedEventId: String(body.eventId || '').trim(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  store.items.unshift(item);
  if (idempotencyKey) store.idempotency[idempotencyKey] = id;
  store.activity.unshift({
    at: nowIso(),
    by: actor.email,
    action: 'register',
    mediaId: id,
    detail: item.originalName || id,
  });
  return { item, reused: false };
}

function attachUsage(store, mediaId, usage) {
  const item = store.items.find((x) => x.id === mediaId);
  if (!item) fail(404, 'الملف غير موجود في المكتبة');
  const row = {
    id: `use-${crypto.randomBytes(4).toString('hex')}`,
    type: String(usage.type || ''), // campaign | event | ad | reel | content
    refId: String(usage.refId || ''),
    label: String(usage.label || ''),
    at: nowIso(),
  };
  item.usages = item.usages || [];
  if (!item.usages.some((u) => u.type === row.type && u.refId === row.refId)) {
    item.usages.push(row);
  }
  if (row.type === 'campaign') item.linkedCampaignId = item.linkedCampaignId || row.refId;
  if (row.type === 'event') item.linkedEventId = item.linkedEventId || row.refId;
  item.updatedAt = nowIso();
  return item;
}

function canAccess(item, session) {
  if (!item) return false;
  if (!session) return false;
  try {
    const hubSession = require('./hub-session');
    if (hubSession.isStaffLane?.(session.lane)) return true;
  } catch {
    /* fall through */
  }
  return String(item.ownerEmail || '').toLowerCase() === String(session.email || '').toLowerCase();
}

function listItems(store, session, q = {}) {
  let list = store.items.filter((it) => canAccess(it, session));
  if (q.kind) list = list.filter((it) => it.kind === q.kind);
  if (q.status) list = list.filter((it) => it.status === q.status);
  if (q.owner) list = list.filter((it) => (it.ownerEmail || '').includes(q.owner));
  if (q.campaignId) list = list.filter((it) => it.linkedCampaignId === q.campaignId || (it.usages || []).some((u) => u.refId === q.campaignId));
  if (q.eventId) list = list.filter((it) => it.linkedEventId === q.eventId || (it.usages || []).some((u) => u.refId === q.eventId));
  if (q.q) {
    const s = String(q.q).toLowerCase();
    list = list.filter((it) => [it.id, it.originalName, it.kind, it.ownerEmail].join(' ').toLowerCase().includes(s));
  }
  return list;
}

function softDelete(store, mediaId, session) {
  const item = store.items.find((x) => x.id === mediaId);
  if (!item) fail(404, 'الملف غير موجود');
  if (!canAccess(item, session)) fail(403, 'غير مصرح بحذف هذا الملف');
  try {
    const hubSession = require('./hub-session');
    const staff = hubSession.isStaffLane?.(session.lane);
    if (!staff && item.ownerEmail !== session.email) fail(403, 'غير مصرح');
  } catch {
    /* ignore */
  }
  item.status = 'archived';
  item.updatedAt = nowIso();
  store.activity.unshift({ at: nowIso(), by: session.email, action: 'archive', mediaId, detail: 'archived' });
  return item;
}

async function handleApi(req, res, pathname, { sendJson, readBody, requireAuth }) {
  const session = await requireAuth(req, res);
  if (!session) return true;

  const qs = (() => {
    try {
      return Object.fromEntries(new URL(req.url, 'http://local').searchParams.entries());
    } catch {
      return {};
    }
  })();

  try {
    if (pathname === '/api/hub/media' && req.method === 'GET') {
      const store = readStore();
      sendJson(res, 200, {
        ok: true,
        items: listItems(store, session, qs),
        kinds: KINDS,
        statuses: STATUSES,
      });
      return true;
    }

    if (pathname === '/api/hub/media' && req.method === 'POST') {
      const body = await readBody(req);
      const key = String(req.headers['idempotency-key'] || body.idempotencyKey || '').trim();
      const result = await withLock(async () => {
        const store = readStore();
        const out = registerItem(store, body || {}, session, key || null);
        writeStore(store);
        return out;
      });
      sendJson(res, result.reused ? 200 : 201, { ok: true, item: result.item, reused: result.reused });
      return true;
    }

    {
      const m = pathname.match(/^\/api\/hub\/media\/([^/]+)$/);
      if (m && req.method === 'GET') {
        const store = readStore();
        const item = store.items.find((x) => x.id === decodeURIComponent(m[1]));
        if (!item || !canAccess(item, session)) {
          sendJson(res, 404, { ok: false, error: 'غير موجود' });
          return true;
        }
        sendJson(res, 200, { ok: true, item });
        return true;
      }
      if (m && req.method === 'DELETE') {
        const item = await withLock(async () => {
          const store = readStore();
          const out = softDelete(store, decodeURIComponent(m[1]), session);
          writeStore(store);
          return out;
        });
        sendJson(res, 200, { ok: true, item });
        return true;
      }
    }

    {
      const m = pathname.match(/^\/api\/hub\/media\/([^/]+)\/usage$/);
      if (m && req.method === 'POST') {
        const body = await readBody(req);
        const item = await withLock(async () => {
          const store = readStore();
          const out = attachUsage(store, decodeURIComponent(m[1]), body || {});
          writeStore(store);
          return out;
        });
        sendJson(res, 200, { ok: true, item });
        return true;
      }
    }

    sendJson(res, 404, { ok: false, error: 'مسار مكتبة الوسائط غير معروف' });
  } catch (err) {
    sendJson(res, err.status || 500, { ok: false, error: err.message || 'خطأ مكتبة الوسائط' });
  }
  return true;
}

module.exports = {
  KINDS,
  STATUSES,
  readStore,
  writeStore,
  withLock,
  registerItem,
  attachUsage,
  listItems,
  softDelete,
  handleApi,
  DATA_PATH,
};
