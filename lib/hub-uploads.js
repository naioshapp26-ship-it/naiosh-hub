/**
 * حد رفع موحّد لكل النظام: 150 ميجابايت — معظم أنواع الملفات مسموحة
 * ما عدا الامتدادات الخطرة (تنفيذي / سكربت خادم).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_UPLOAD_MB = 150;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
const PUBLIC_PREFIX = '/uploads';

/** امتدادات ممنوعة لأسباب أمنية */
const BLOCKED_EXT = new Set([
  '.exe',
  '.msi',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.ps1',
  '.vbs',
  '.js',
  '.mjs',
  '.cjs',
  '.php',
  '.phtml',
  '.asp',
  '.aspx',
  '.jsp',
  '.cgi',
  '.sh',
  '.bash',
  '.dll',
  '.so',
  '.dylib',
  '.apk',
  '.ipa',
  '.jar',
  '.war',
]);

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/avif': '.avif',
  'image/vnd.adobe.photoshop': '.psd',
  'image/vnd.dwg': '.dwg',
  'image/vnd.dxf': '.dxf',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.oasis.opendocument.text': '.odt',
  'application/vnd.oasis.opendocument.spreadsheet': '.ods',
  'application/vnd.oasis.opendocument.presentation': '.odp',
  'application/rtf': '.rtf',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
  'application/x-rar-compressed': '.rar',
  'application/vnd.rar': '.rar',
  'application/x-7z-compressed': '.7z',
  'application/gzip': '.gz',
  'application/x-tar': '.tar',
  'application/json': '.json',
  'application/xml': '.xml',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'text/markdown': '.md',
  'text/html': '.html',
  'text/css': '.css',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
  'audio/flac': '.flac',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-m4v': '.m4v',
  'video/x-msvideo': '.avi',
  'video/x-matroska': '.mkv',
  'video/ogg': '.ogv',
  'video/mpeg': '.mpeg',
  'application/postscript': '.eps',
  'application/illustrator': '.ai',
  'application/dxf': '.dxf',
  'application/acad': '.dwg',
  'application/x-autocad': '.dwg',
  'application/dwg': '.dwg',
  'model/stl': '.stl',
  'application/sla': '.stl',
  'model/obj': '.obj',
  'model/gltf+json': '.gltf',
  'model/gltf-binary': '.glb',
  'font/ttf': '.ttf',
  'font/otf': '.otf',
  'font/woff': '.woff',
  'font/woff2': '.woff2',
  'application/octet-stream': '.bin',
};

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.rtf': 'application/rtf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.zip': 'application/zip',
  '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.tgz': 'application/gzip',
  '.bz2': 'application/x-bzip2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.ogv': 'video/ogg',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpeg',
  '.3gp': 'video/3gpp',
  '.ai': 'application/illustrator',
  '.eps': 'application/postscript',
  '.psd': 'image/vnd.adobe.photoshop',
  '.dwg': 'application/dwg',
  '.dxf': 'application/dxf',
  '.stl': 'model/stl',
  '.obj': 'model/obj',
  '.fbx': 'application/octet-stream',
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  '.blend': 'application/octet-stream',
  '.step': 'application/octet-stream',
  '.stp': 'application/octet-stream',
  '.kml': 'application/vnd.google-earth.kml+xml',
  '.kmz': 'application/vnd.google-earth.kmz',
  '.pages': 'application/vnd.apple.pages',
  '.numbers': 'application/vnd.apple.numbers',
  '.key': 'application/vnd.apple.keynote',
  '.eml': 'message/rfc822',
  '.msg': 'application/vnd.ms-outlook',
  '.sql': 'application/sql',
  '.log': 'text/plain',
  '.yml': 'text/yaml',
  '.yaml': 'text/yaml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.bin': 'application/octet-stream',
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

function normalizeExt(ext) {
  const e = String(ext || '').toLowerCase();
  if (!/^\.[a-z0-9]{1,12}$/.test(e)) return '';
  return e;
}

function isBlockedExt(ext) {
  return BLOCKED_EXT.has(normalizeExt(ext));
}

/**
 * قبول واسع: أي امتداد غير محظور، أو استنتاج من MIME، وإلا .bin
 */
function extFromNameAndMime(originalName, mime) {
  const fromName = normalizeExt(path.extname(originalName || ''));
  if (fromName && isBlockedExt(fromName)) return '';
  if (fromName) return fromName;

  const fromMime = normalizeExt(EXT_BY_MIME[String(mime || '').toLowerCase()]);
  if (fromMime && isBlockedExt(fromMime)) return '';
  if (fromMime) return fromMime;

  return '.bin';
}

function isAllowedUpload(filename, mime) {
  const ext = normalizeExt(path.extname(filename || ''));
  if (ext && isBlockedExt(ext)) return false;
  return !!extFromNameAndMime(filename, mime);
}

function validateUploadMeta(filename, mime, size) {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes < 0) {
    return { ok: false, error: 'invalid_size' };
  }
  if (bytes > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'file_too_large', maxBytes: MAX_UPLOAD_BYTES, maxLabel: `${MAX_UPLOAD_MB}MB` };
  }
  if (!isAllowedUpload(filename, mime)) {
    return { ok: false, error: 'file_type_blocked' };
  }
  return { ok: true, maxBytes: MAX_UPLOAD_BYTES, maxLabel: `${MAX_UPLOAD_MB}MB` };
}

function isSafeUploadId(id) {
  return /^[a-z0-9]+-[a-f0-9]{12}\.[a-z0-9]{1,12}$/i.test(String(id || ''));
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
      return reject(
        httpError(400, 'نوع الملف غير مسموح لأسباب أمنية (ملفات تنفيذية أو سكربتات خادم).')
      );
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
        mime: mimeForExt(ext) !== 'application/octet-stream' ? mimeForExt(ext) : mime || 'application/octet-stream',
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
  BLOCKED_EXT,
  sizeError,
  ensureUploadDir,
  isSafeUploadId,
  resolveUploadPath,
  mimeForExt,
  extFromNameAndMime,
  isBlockedExt,
  isAllowedUpload,
  validateUploadMeta,
  saveRequestToFile,
};
