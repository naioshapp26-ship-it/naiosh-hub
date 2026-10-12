/**
 * Resumable / chunked uploads for Hub (durable session meta on disk + final file in UPLOAD_DIR).
 * Does NOT store full file bodies in PostgreSQL for large objects — disk/volume is source of truth.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const hubUploads = require('./hub-uploads');

const CHUNK_SIZE = Math.max(256 * 1024, Number(process.env.HUB_UPLOAD_CHUNK_SIZE || 4 * 1024 * 1024)); // 4MB default
const SESSION_TTL_MS = 48 * 60 * 60 * 1000;
const SESSIONS_DIR = path.join(hubUploads.UPLOAD_DIR, '.chunk-sessions');

function ensureDirs() {
  hubUploads.ensureUploadDir();
  if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

function sessionPath(uploadId) {
  return path.join(SESSIONS_DIR, `${uploadId}.json`);
}

function partsDir(uploadId) {
  return path.join(SESSIONS_DIR, uploadId);
}

function isSafeSessionId(id) {
  return /^upl-[a-z0-9]+-[a-f0-9]{12}$/i.test(String(id || ''));
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function readSession(uploadId) {
  if (!isSafeSessionId(uploadId)) return null;
  const p = sessionPath(uploadId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeSession(session) {
  ensureDirs();
  const tmp = sessionPath(session.uploadId) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(session, null, 2));
  fs.renameSync(tmp, sessionPath(session.uploadId));
  return session;
}

function purgeExpired(session) {
  if (!session) return null;
  if (Date.now() - new Date(session.updatedAt || session.createdAt).getTime() > SESSION_TTL_MS) {
    cleanupSession(session.uploadId);
    return null;
  }
  return session;
}

function cleanupSession(uploadId) {
  try {
    const dir = partsDir(uploadId);
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        fs.unlinkSync(path.join(dir, f));
      }
      fs.rmdirSync(dir);
    }
  } catch {
    /* ignore */
  }
  try {
    fs.unlinkSync(sessionPath(uploadId));
  } catch {
    /* ignore */
  }
}

function initSession({ originalName, mime, sizeBytes, ownerEmail } = {}) {
  const size = Number(sizeBytes);
  if (!Number.isFinite(size) || size < 0) throw httpError(400, 'حجم الملف غير صالح');
  if (size > hubUploads.MAX_UPLOAD_BYTES) throw httpError(413, hubUploads.sizeError());
  const name = hubUploads.safeOriginalName(originalName || 'file');
  const type = String(mime || 'application/octet-stream').split(';')[0].trim().toLowerCase();
  const ext = hubUploads.extFromNameAndMime(name, type);
  if (!ext) throw httpError(400, 'نوع الملف غير مسموح لأسباب أمنية');

  ensureDirs();
  const uploadId = `upl-${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`;
  const totalChunks = Math.max(1, Math.ceil(size / CHUNK_SIZE));
  const session = {
    uploadId,
    originalName: name,
    mime: type,
    ext,
    sizeBytes: size,
    chunkSize: CHUNK_SIZE,
    totalChunks,
    received: {},
    bytesReceived: 0,
    ownerEmail: ownerEmail ? String(ownerEmail).toLowerCase() : '',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    finalId: null,
  };
  fs.mkdirSync(partsDir(uploadId), { recursive: true });
  writeSession(session);
  return {
    uploadId,
    chunkSize: CHUNK_SIZE,
    totalChunks,
    maxBytes: hubUploads.MAX_UPLOAD_BYTES,
    maxMb: hubUploads.MAX_UPLOAD_MB,
  };
}

function statusOf(uploadId) {
  const session = purgeExpired(readSession(uploadId));
  if (!session) throw httpError(404, 'جلسة الرفع غير موجودة أو انتهت');
  const receivedIndexes = Object.keys(session.received || {})
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  return {
    uploadId: session.uploadId,
    status: session.status,
    sizeBytes: session.sizeBytes,
    chunkSize: session.chunkSize,
    totalChunks: session.totalChunks,
    bytesReceived: session.bytesReceived,
    receivedIndexes,
    missingIndexes: Array.from({ length: session.totalChunks }, (_, i) => i).filter((i) => !session.received[i]),
    finalId: session.finalId || null,
    url: session.finalId ? `${hubUploads.PUBLIC_PREFIX}/${session.finalId}` : null,
  };
}

function saveChunk(uploadId, index, buffer) {
  const session = purgeExpired(readSession(uploadId));
  if (!session) throw httpError(404, 'جلسة الرفع غير موجودة أو انتهت');
  if (session.status === 'complete' && session.finalId) {
    return statusOf(uploadId);
  }
  const idx = Number(index);
  if (!Number.isInteger(idx) || idx < 0 || idx >= session.totalChunks) {
    throw httpError(400, 'رقم الجزء غير صالح');
  }
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw httpError(400, 'جزء فارغ');
  if (buffer.length > session.chunkSize + 1024) throw httpError(400, 'حجم الجزء أكبر من المسموح');

  // Idempotent: same index rewrite allowed
  const partFile = path.join(partsDir(uploadId), `${idx}.part`);
  fs.writeFileSync(partFile, buffer);
  const prev = session.received[idx];
  session.received[idx] = { bytes: buffer.length, at: new Date().toISOString() };
  if (!prev) session.bytesReceived += buffer.length;
  else session.bytesReceived += buffer.length - (prev.bytes || 0);
  if (session.bytesReceived > hubUploads.MAX_UPLOAD_BYTES) {
    cleanupSession(uploadId);
    throw httpError(413, hubUploads.sizeError());
  }
  session.updatedAt = new Date().toISOString();
  writeSession(session);
  return statusOf(uploadId);
}

function completeSession(uploadId) {
  const session = purgeExpired(readSession(uploadId));
  if (!session) throw httpError(404, 'جلسة الرفع غير موجودة أو انتهت');
  if (session.status === 'complete' && session.finalId) {
    return {
      id: session.finalId,
      url: `${hubUploads.PUBLIC_PREFIX}/${session.finalId}`,
      name: session.originalName,
      mime: session.mime,
      size: session.sizeBytes,
      filename: session.finalId,
      resumed: true,
    };
  }

  for (let i = 0; i < session.totalChunks; i += 1) {
    if (!session.received[i]) throw httpError(409, `الجزء ${i} ناقص — أكمل الرفع قبل التجميع`);
  }

  const finalId = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}${session.ext}`;
  const dest = path.join(hubUploads.UPLOAD_DIR, finalId);
  const fd = fs.openSync(dest, 'w');
  let written = 0;
  try {
    for (let i = 0; i < session.totalChunks; i += 1) {
      const partFile = path.join(partsDir(uploadId), `${i}.part`);
      const chunk = fs.readFileSync(partFile);
      fs.writeSync(fd, chunk);
      written += chunk.length;
    }
  } finally {
    fs.closeSync(fd);
  }

  if (written !== session.sizeBytes) {
    fs.unlink(dest, () => {});
    throw httpError(409, `حجم الملف المجمّع (${written}) لا يطابق الحجم المعلن (${session.sizeBytes})`);
  }

  session.status = 'complete';
  session.finalId = finalId;
  session.updatedAt = new Date().toISOString();
  writeSession(session);

  // Persist small files to DB blobs for durability; skip large to avoid memory blow-ups
  if (written <= 10 * 1024 * 1024) {
    try {
      const buf = fs.readFileSync(dest);
      hubUploads
        .persistBlobToDb({
          storageRef: finalId,
          mime: session.mime,
          originalName: session.originalName,
          ownerEmail: session.ownerEmail,
          buffer: buf,
        })
        .catch(() => {});
    } catch {
      /* ignore */
    }
  }

  // Keep session meta for reopen/status; delete parts to free space
  try {
    const dir = partsDir(uploadId);
    for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
  } catch {
    /* ignore */
  }

  return {
    id: finalId,
    url: `${hubUploads.PUBLIC_PREFIX}/${finalId}`,
    name: session.originalName,
    mime: hubUploads.mimeForExt(session.ext) !== 'application/octet-stream' ? hubUploads.mimeForExt(session.ext) : session.mime,
    size: written,
    filename: finalId,
    resumed: false,
    chunked: true,
  };
}

function readBodyBuffer(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let received = 0;
    req.on('data', (c) => {
      received += c.length;
      if (received > maxBytes) {
        req.destroy();
        reject(httpError(413, hubUploads.sizeError()));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
    req.on('aborted', () => reject(httpError(499, 'أُلغي الرفع')));
  });
}

module.exports = {
  CHUNK_SIZE,
  initSession,
  statusOf,
  saveChunk,
  completeSession,
  readBodyBuffer,
  cleanupSession,
  isSafeSessionId,
};
