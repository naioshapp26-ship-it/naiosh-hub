/**
 * حد رفع موحّد لكل النظام: 150 ميجابايت للصور والملفات والفيديو.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_UPLOAD_MB = 150;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
const PUBLIC_PREFIX = '/uploads';

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
  'text/plain': '.txt',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-m4v': '.m4v',
  'video/x-msvideo': '.avi',
  'video/x-matroska': '.mkv',
  'video/ogg': '.ogv',
};

const ALLOWED_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.zip',
  '.mp4',
  '.webm',
  '.mov',
  '.m4v',
  '.avi',
  '.mkv',
  '.ogv',
]);

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.zip': 'application/zip',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.ogv': 'video/ogg',
};

function sizeError(bytes = MAX_UPLOAD_BYTES) {
  const mb = (bytes / 1024 / 1024).toFixed(0);
  return `حجم الملف أكبر من ${mb}MB — صغّره أو ضع رابطًا خارجيًا`;
}

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function safeOriginalName(raw) {
  const name = path.basename(String(raw || 'file').replace(/\\/g, '/')).trim() || 'file';
  return name.replace(/[^\w.\u0600-\u06FF-]+/g, '_').slice(0, 120);
}

function extFromNameAndMime(originalName, mime) {
  const fromName = path.extname(originalName || '').toLowerCase();
  if (ALLOWED_EXT.has(fromName)) return fromName;
  const fromMime = EXT_BY_MIME[String(mime || '').toLowerCase()];
  if (fromMime && ALLOWED_EXT.has(fromMime)) return fromMime;
  return '';
}

function isSafeUploadId(id) {
  return /^[a-z0-9]+-[a-f0-9]{12}\.[a-z0-9]{2,8}$/i.test(String(id || ''));
}

function resolveUploadPath(id) {
  if (!isSafeUploadId(id)) return null;
  return path.join(UPLOAD_DIR, id);
}

function mimeForExt(ext) {
  return MIME_BY_EXT[String(ext || '').toLowerCase()] || 'application/octet-stream';
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function saveRequestToFile(req) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > MAX_UPLOAD_BYTES) {
      return reject(httpError(413, sizeError()));
    }

    let originalName = 'file';
    try {
      originalName = decodeURIComponent(String(req.headers['x-file-name'] || 'file'));
    } catch {
      originalName = String(req.headers['x-file-name'] || 'file');
    }
    originalName = safeOriginalName(originalName);
    const mime = String(req.headers['x-file-type'] || req.headers['content-type'] || 'application/octet-stream')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const ext = extFromNameAndMime(originalName, mime);
    if (!ext) {
      req.resume();
      return reject(httpError(400, 'نوع الملف غير مسموح. استخدم صورة أو مستنداً أو فيديو شائعاً.'));
    }

    ensureUploadDir();
    const id = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    const dest = path.join(UPLOAD_DIR, id);
    const out = fs.createWriteStream(dest);
    let received = 0;
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      req.destroy();
      out.destroy();
      fs.unlink(dest, () => {});
      reject(err);
    };

    req.on('data', (chunk) => {
      received += chunk.length;
      if (received > MAX_UPLOAD_BYTES) {
        fail(httpError(413, sizeError()));
      }
    });
    req.pipe(out);
    out.on('finish', () => {
      if (settled) return;
      settled = true;
      resolve({
        id,
        url: `${PUBLIC_PREFIX}/${id}`,
        name: originalName,
        mime: mimeForExt(ext),
        size: received,
        filename: id,
      });
    });
    out.on('error', (err) => fail(err));
    req.on('error', (err) => fail(err));
    req.on('aborted', () => fail(httpError(499, 'أُلغي الرفع')));
  });
}

module.exports = {
  MAX_UPLOAD_MB,
  MAX_UPLOAD_BYTES,
  UPLOAD_DIR,
  PUBLIC_PREFIX,
  sizeError,
  ensureUploadDir,
  isSafeUploadId,
  resolveUploadPath,
  mimeForExt,
  saveRequestToFile,
};
