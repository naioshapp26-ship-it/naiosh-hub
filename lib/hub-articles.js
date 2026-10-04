/**
 * Articles — file-backed SoT with in-process lock.
 * Article ID ART-YYYY-##### / Request ID ART-REQ-YYYY-##### share one graph.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_PATH = path.join(__dirname, '..', 'data', 'hub-articles.json');
const META_KEY = 'hub_articles';

const PERMS = {
  view: 'articles.view',
  create: 'articles.create',
  edit: 'articles.edit',
  upload: 'articles.upload',
  review: 'articles.review',
  approve: 'articles.approve',
  publish: 'articles.publish',
  delete: 'articles.delete',
};

const STATUSES = [
  'draft',
  'pending_review',
  'under_review',
  'needs_changes',
  'approved',
  'published',
  'unpublished',
  'rejected',
  'archived',
];

const STATUS_LABEL = {
  draft: 'مسودة',
  pending_review: 'بانتظار المراجعة',
  under_review: 'تحت المراجعة',
  needs_changes: 'يحتاج تعديل',
  approved: 'تمت الموافقة',
  published: 'منشور',
  unpublished: 'موقوف',
  rejected: 'مرفوض',
  archived: 'مؤرشف',
};

const LEGACY_STATUS = {
  Draft: 'draft',
  'Pending Review': 'pending_review',
  'Under Review': 'under_review',
  'Needs Changes': 'needs_changes',
  Approved: 'approved',
  Published: 'published',
  Unpublished: 'unpublished',
  Rejected: 'rejected',
  Archived: 'archived',
};

const REQ_STATUS = {
  pending_review: 'Pending Review',
  under_review: 'Under Review',
  needs_changes: 'Needs Changes',
  approved: 'Approved',
  published: 'Published',
  unpublished: 'Unpublished',
  rejected: 'Rejected',
  archived: 'Archived',
  draft: 'Draft',
};

const TRANSITIONS = {
  draft: ['pending_review', 'rejected'],
  pending_review: ['under_review', 'approved', 'published', 'needs_changes', 'rejected'],
  under_review: ['approved', 'published', 'needs_changes', 'rejected'],
  needs_changes: ['pending_review', 'rejected'],
  approved: ['published', 'unpublished', 'rejected'],
  published: ['unpublished', 'archived', 'rejected'],
  unpublished: ['published', 'archived'],
  rejected: ['pending_review', 'draft'],
  archived: [],
};

const CATEGORIES = ['إدارة', 'تشغيل', 'تقنية', 'مالية', 'حوكمة', 'موارد بشرية', 'تسويق', 'ريادة أعمال', 'أخرى'];
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.m4v', '.ogg'];

function nowIso() {
  return new Date().toISOString();
}

function emptyStore() {
  return {
    version: 1,
    seq: { article: 0, request: 0, asset: 0 },
    articles: [],
    requests: [],
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
    if (!raw || !Array.isArray(raw.articles)) return emptyStore();
    raw.seq = raw.seq || emptyStore().seq;
    raw.requests = raw.requests || [];
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
    const { getDatabaseUrl } = require('../db/migrate');
    const databaseUrl = getDatabaseUrl();
    if (!databaseUrl) return;
    const { Client } = require('pg');
    const client = new Client({
      connectionString: databaseUrl,
      ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? false : { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query(
      `INSERT INTO hub_meta (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [META_KEY, JSON.stringify({ version: store.version, seq: store.seq, updatedAt: store.updatedAt })]
    );
    for (const a of store.articles) {
      await client.query(
        `INSERT INTO hub_article_records (id, title, status, payload, owner_email, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, COALESCE($6::timestamptz, NOW()), NOW())
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title, status = EXCLUDED.status, payload = EXCLUDED.payload,
           owner_email = EXCLUDED.owner_email, updated_at = NOW()`,
        [a.id, a.title || a.id, a.status, JSON.stringify(a), a.ownerEmail || '', a.createdAt || null]
      );
    }
    await client.end();
  } catch {
    /* optional */
  }
}

function nextCode(store, kind, prefix) {
  store.seq[kind] = Number(store.seq[kind] || 0) + 1;
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(store.seq[kind]).padStart(5, '0')}`;
}

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function actorOf(session) {
  return {
    email: session?.email || '',
    name: session?.name || session?.email || 'مستخدم',
    role: session?.role || '',
    lane: session?.lane || '',
  };
}

function isStaff(session) {
  try {
    return require('./hub-session').isStaffLane(session?.lane);
  } catch {
    return session?.lane === 'SUPER_ADMIN' || session?.lane === 'ADMIN';
  }
}

function hasPerm(session, perm) {
  const hubSession = require('./hub-session');
  return isStaff(session) && hubSession.hasPermission(session, perm);
}

function assertStaffPerm(session, perm) {
  if (!hasPerm(session, perm)) fail(403, 'ليست لديك صلاحية هذه العملية');
}

function extOf(name, mime) {
  const fromName = String(name || '').toLowerCase().match(/\.[a-z0-9]+$/);
  if (fromName) return fromName[0];
  const m = String(mime || '').toLowerCase();
  if (m.includes('jpeg')) return '.jpg';
  if (m.includes('png')) return '.png';
  if (m.includes('webp')) return '.webp';
  if (m.includes('gif')) return '.gif';
  if (m.includes('mp4')) return '.mp4';
  if (m.includes('webm')) return '.webm';
  if (m.includes('quicktime')) return '.mov';
  return '';
}

function assertImage(file) {
  if (!file || !file.url) return;
  const ext = extOf(file.name, file.mime);
  if (ext && !IMAGE_EXT.includes(ext)) fail(400, 'صيغة الصورة غير مدعومة. المسموح: JPG · PNG · WEBP · GIF');
}

function assertVideo(file) {
  if (!file || !file.url) return;
  const ext = extOf(file.name, file.mime);
  if (ext && !VIDEO_EXT.includes(ext)) fail(400, 'صيغة الفيديو غير مدعومة. المسموح: MP4 · WEBM · MOV');
  if (file.status && file.status !== 'ok' && file.status !== 'ready') fail(409, 'لم يكتمل رفع الفيديو');
}

function findArticle(store, id) {
  return store.articles.find((a) => a.id === id || a.requestId === id || a.articleId === id) || null;
}

function requireArticle(store, id) {
  const a = findArticle(store, id);
  if (!a) fail(404, 'المقال غير موجود');
  return a;
}

function canSee(session, a) {
  if (!a) return false;
  if (a.status === 'published') return true;
  if (!session) return false;
  if (isStaff(session)) return true;
  return (a.ownerEmail || '').toLowerCase() === String(session.email || '').toLowerCase();
}

function canEdit(session, a) {
  if (!session) return false;
  if (isStaff(session) && hasPerm(session, PERMS.edit)) return true;
  const own = (a.ownerEmail || '').toLowerCase() === String(session.email || '').toLowerCase();
  return own && (a.status === 'draft' || a.status === 'needs_changes');
}

function publicArticle(a, { full = false, session = null } = {}) {
  const base = {
    id: a.id,
    articleId: a.id,
    title: a.title,
    category: a.category,
    summary: a.summary,
    authorName: a.authorName,
    company: a.company,
    coverImage: a.coverImage || null,
    video: a.video || null,
    status: a.status,
    statusLabel: STATUS_LABEL[a.status] || a.status,
    requestId: a.requestId || '',
    changeRequestNote: a.changeRequestNote || '',
    rejectionReason: a.rejectionReason || '',
    ownerEmail: a.ownerEmail,
    ownerName: a.ownerName,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    submittedAt: a.submittedAt || '',
    publishedAt: a.publishedAt || '',
    reviewer: a.reviewer || '',
  };
  if (!full) return { ...base, body: a.status === 'published' || canSee(session, a) ? a.body : a.summary };
  return {
    ...base,
    body: a.body,
    attachments: a.attachments || [],
    articleFile: a.articleFile || null,
    tags: a.tags || [],
    activity: a.activity || [],
    timeline: a.timeline || [],
  };
}

function adminRequest(a) {
  return {
    id: a.requestId,
    requestId: a.requestId,
    requestType: 'Article Submission',
    requestTypeLabel: 'طلب نشر مقال',
    title: `طلب نشر مقال: ${a.title}`,
    description: a.summary || String(a.body || '').slice(0, 280),
    status: REQ_STATUS[a.status] || 'Pending Review',
    statusLabel: STATUS_LABEL[a.status],
    referenceType: 'Article',
    referenceId: a.id,
    articleId: a.id,
    sourceModule: 'المقالات',
    sourcePage: 'إرسال مقال',
    sourceUrl: `blog.html#mine/${a.id}`,
    sourceAction: 'طلب نشر مقال',
    customerName: a.ownerName || a.authorName,
    customerId: a.ownerEmail,
    email: a.ownerEmail || a.authorEmail,
    assignedTo: a.reviewer || 'Content Desk',
    department: 'Content',
    createdAt: a.submittedAt || a.createdAt,
    updatedAt: a.updatedAt,
    changeRequestNote: a.changeRequestNote || '',
    rejectionReason: a.rejectionReason || '',
    previewUrl: `blog.html#mine/${a.id}`,
    articleSnapshot: {
      articleId: a.id,
      title: a.title,
      category: a.category,
      summary: a.summary,
      authorName: a.authorName,
      body: a.body,
      coverImage: a.coverImage,
      video: a.video,
      attachments: a.attachments,
      submittedAt: a.submittedAt,
    },
  };
}

function applyPatch(a, body) {
  const fields = ['title', 'category', 'summary', 'authorName', 'authorEmail', 'company', 'body'];
  for (const f of fields) {
    if (body[f] != null) a[f] = typeof body[f] === 'string' ? String(body[f]).trim() : body[f];
  }
  if (body.tags != null) {
    a.tags = Array.isArray(body.tags)
      ? body.tags
      : String(body.tags)
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
  }
  if (body.coverImage !== undefined) {
    if (body.coverImage) {
      assertImage(body.coverImage);
      if (body.coverImage.url && !body.coverImage.status) body.coverImage.status = 'ok';
    }
    a.coverImage = body.coverImage || null;
  }
  if (body.video !== undefined) {
    if (body.video) {
      assertVideo(body.video);
      if (body.video.url && !body.video.status) body.video.status = 'ok';
    }
    a.video = body.video || null;
  }
  if (body.attachments) a.attachments = body.attachments;
  if (body.articleFile !== undefined) a.articleFile = body.articleFile || null;
  a.updatedAt = nowIso();
}

function blankArticle(id, actor) {
  return {
    id,
    articleId: id,
    title: '',
    category: '',
    summary: '',
    body: '',
    authorName: actor.name,
    authorEmail: actor.email,
    company: '',
    tags: [],
    coverImage: null,
    video: null,
    articleFile: null,
    attachments: [],
    status: 'draft',
    requestId: '',
    changeRequestNote: '',
    rejectionReason: '',
    ownerEmail: actor.email,
    ownerName: actor.name,
    reviewer: 'Content Desk',
    activity: [],
    timeline: [{ key: 'draft', label: 'مسودة', done: true, at: nowIso() }],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    submittedAt: '',
    publishedAt: '',
  };
}

function pushActivity(store, article, actor, action, detail) {
  const row = {
    id: `act-${crypto.randomBytes(4).toString('hex')}`,
    articleId: article.id,
    requestId: article.requestId || '',
    at: nowIso(),
    action,
    detail: detail || '',
    actorName: actor.name,
    actorEmail: actor.email,
  };
  store.activity.unshift(row);
  if (store.activity.length > 2000) store.activity.length = 2000;
  article.activity = article.activity || [];
  article.activity.unshift(row);
  article.updatedAt = row.at;
  return row;
}

function notify(title, body, link, meta) {
  try {
    require('../db/hub-runtime').addNotification({
      source: 'ARTICLES',
      sourceName: 'المقالات',
      title,
      body,
      level: 'info',
      category: 'articles',
      link: link || 'blog.html',
      meta: meta || null,
    });
  } catch {
    /* optional */
  }
}

function createArticle(store, body, actor, idempotencyKey) {
  if (idempotencyKey && store.idempotency[idempotencyKey]) {
    const existing = findArticle(store, store.idempotency[idempotencyKey]);
    if (existing) return existing;
  }
  const id = nextCode(store, 'article', 'ART');
  const a = blankArticle(id, actor);
  applyPatch(a, body || {});
  store.articles.unshift(a);
  if (idempotencyKey) store.idempotency[idempotencyKey] = a.id;
  pushActivity(store, a, actor, 'created', 'تم إنشاء المقال');
  return a;
}

function setStatus(store, a, next, actor, note) {
  if (a.status === next) return a;
  if (!(TRANSITIONS[a.status] || []).includes(next)) {
    fail(409, `لا يمكن نقل الحالة من ${STATUS_LABEL[a.status]} إلى ${STATUS_LABEL[next]}`);
  }
  const before = a.status;
  a.status = next;
  if (next === 'needs_changes') a.changeRequestNote = String(note || '').trim();
  if (next === 'rejected') a.rejectionReason = String(note || '').trim();
  if (next === 'pending_review') a.changeRequestNote = next === 'pending_review' ? '' : a.changeRequestNote;
  if (next === 'published' || next === 'approved') {
    a.rejectionReason = '';
    a.changeRequestNote = '';
  }
  if (next === 'published') a.publishedAt = nowIso();
  a.timeline = a.timeline || [];
  a.timeline.push({ key: next, label: STATUS_LABEL[next], done: true, at: nowIso(), comment: note || '' });
  pushActivity(store, a, actor, 'status', `الحالة: ${STATUS_LABEL[before]} ← ${STATUS_LABEL[next]}`);
  return a;
}

function ensureRequest(store, a, actor) {
  if (a.requestId) {
    let row = store.requests.find((r) => r.id === a.requestId);
    if (row) {
      Object.assign(row, adminRequest(a), { updatedAt: nowIso() });
      return row;
    }
  }
  const id = nextCode(store, 'request', 'ART-REQ');
  a.requestId = id;
  const row = { ...adminRequest(a), id, requestId: id, createdAt: nowIso(), updatedAt: nowIso() };
  store.requests.unshift(row);
  pushActivity(store, a, actor, 'request', `تم إنشاء طلب المراجعة ${id}`);
  return row;
}

function syncRequest(store, a) {
  if (!a.requestId) return;
  const row = store.requests.find((r) => r.id === a.requestId);
  if (row) Object.assign(row, adminRequest(a), { id: a.requestId, requestId: a.requestId, updatedAt: nowIso() });
}

function handleAction(store, a, action, body, actor, session) {
  const note = String(body.note || body.reason || '').trim();
  switch (action) {
    case 'submit':
    case 'send_review': {
      if (a.status === 'pending_review' && a.requestId) return a;
      if (!a.title) fail(400, 'عنوان المقال مطلوب');
      if (!a.category) fail(400, 'التصنيف مطلوب');
      if (!a.summary) fail(400, 'النبذة المختصرة مطلوبة');
      if (!String(a.body || '').trim() && !a.articleFile) fail(400, 'محتوى المقال مطلوب');
      if (a.coverImage && a.coverImage.status && !['ok', 'ready'].includes(a.coverImage.status)) {
        fail(409, 'لم يكتمل رفع صورة المقال');
      }
      if (a.video && a.video.status && !['ok', 'ready'].includes(a.video.status)) {
        fail(409, 'لم يكتمل رفع فيديو المقال');
      }
      assertImage(a.coverImage);
      assertVideo(a.video);
      setStatus(store, a, 'pending_review', actor, note);
      a.submittedAt = nowIso();
      ensureRequest(store, a, actor);
      syncRequest(store, a);
      notify('مقال بانتظار المراجعة', `${a.title} · ${a.id}`, `blog.html#mine/${a.id}`, { articleId: a.id, requestId: a.requestId });
      return a;
    }
    case 'start_review':
      assertStaffPerm(session, PERMS.review);
      setStatus(store, a, 'under_review', actor, note);
      syncRequest(store, a);
      return a;
    case 'approve':
    case 'publish': {
      if (a.status === 'published') return a;
      assertStaffPerm(session, PERMS.approve);
      if (a.status === 'pending_review' || a.status === 'under_review') setStatus(store, a, 'approved', actor, note);
      if (a.status === 'approved') setStatus(store, a, 'published', actor, note);
      else if (a.status !== 'published') setStatus(store, a, 'published', actor, note);
      ensureRequest(store, a, actor);
      syncRequest(store, a);
      notify('نُشر مقالك', `${a.title} · ${a.id}`, `blog.html#posts`, { articleId: a.id });
      return a;
    }
    case 'request_changes': {
      assertStaffPerm(session, PERMS.approve);
      if (!note) fail(400, 'سبب طلب التعديل مطلوب');
      if (a.status === 'needs_changes' && a.changeRequestNote === note) return a;
      setStatus(store, a, 'needs_changes', actor, note);
      syncRequest(store, a);
      notify('مطلوب تعديل على مقالك', note, `blog.html#mine/${a.id}`, { articleId: a.id });
      return a;
    }
    case 'reject': {
      assertStaffPerm(session, PERMS.approve);
      if (!note) fail(400, 'سبب الرفض مطلوب');
      if (a.status === 'rejected') return a;
      setStatus(store, a, 'rejected', actor, note);
      syncRequest(store, a);
      notify('رُفض مقالك', note, `blog.html#mine/${a.id}`, { articleId: a.id });
      return a;
    }
    case 'unpublish':
      assertStaffPerm(session, PERMS.publish);
      setStatus(store, a, 'unpublished', actor, note);
      syncRequest(store, a);
      return a;
    default:
      fail(400, 'إجراء غير معروف');
  }
}

function listFor(store, session, q) {
  let list = store.articles.filter((a) => canSee(session, a));
  if (q.mine === '1' && session) {
    list = list.filter((a) => (a.ownerEmail || '').toLowerCase() === String(session.email || '').toLowerCase());
  }
  if (q.published === '1') list = list.filter((a) => a.status === 'published');
  if (q.status) {
    const st = LEGACY_STATUS[q.status] || q.status;
    list = list.filter((a) => a.status === st);
  }
  if (q.q) {
    const s = String(q.q).toLowerCase();
    list = list.filter((a) => [a.id, a.title, a.authorName, a.category, a.requestId].join(' ').toLowerCase().includes(s));
  }
  return list;
}

async function handleApi(req, res, pathname, { sendJson, readBody, requireAuth }) {
  const qs = (() => {
    try {
      return Object.fromEntries(new URL(req.url, 'http://local').searchParams.entries());
    } catch {
      return {};
    }
  })();

  try {
    if (pathname === '/api/hub/articles/public' && req.method === 'GET') {
      const store = readStore();
      const items = store.articles.filter((a) => a.status === 'published').map((a) => publicArticle(a, { full: true }));
      sendJson(res, 200, { ok: true, items, count: items.length });
      return true;
    }
    if (pathname === '/api/hub/articles/meta' && req.method === 'GET') {
      const resolved = require('./hub-session').resolveSession(req);
      const session = resolved && resolved.ok ? resolved : null;
      sendJson(res, 200, {
        ok: true,
        meta: {
          statuses: STATUSES.map((id) => ({ id, label: STATUS_LABEL[id] })),
          categories: CATEGORIES,
          imageExts: IMAGE_EXT,
          videoExts: VIDEO_EXT,
        },
        me: session
          ? {
              email: session.email,
              name: session.name,
              role: session.role,
              lane: session.lane,
              staff: isStaff(session),
            }
          : { staff: false, guest: true },
      });
      return true;
    }

    const session = requireAuth(req, res);
    if (!session) return true;

    if (pathname === '/api/hub/articles/requests' && req.method === 'GET') {
      if (!isStaff(session)) fail(403, 'غير مصرح');
      const store = readStore();
      sendJson(res, 200, { ok: true, items: store.articles.filter((a) => a.requestId).map(adminRequest) });
      return true;
    }

    if (pathname === '/api/hub/articles' && req.method === 'GET') {
      const store = readStore();
      const list = listFor(store, session, qs).map((a) => publicArticle(a, { session, full: qs.full === '1' }));
      sendJson(res, 200, { ok: true, items: list, count: list.length });
      return true;
    }

    if (pathname === '/api/hub/articles' && req.method === 'POST') {
      const body = await readBody(req);
      const key = String(req.headers['idempotency-key'] || body.idempotencyKey || '').trim();
      const created = await withLock(() => {
        const store = readStore();
        const a = createArticle(store, body || {}, actorOf(session), key);
        writeStore(store);
        return a;
      });
      sendJson(res, 201, { ok: true, article: publicArticle(created, { full: true, session }) });
      return true;
    }

    const m = pathname.match(/^\/api\/hub\/articles\/([^/]+)(?:\/([^/]+))?$/);
    if (!m) {
      sendJson(res, 404, { ok: false, error: 'المسار غير موجود' });
      return true;
    }
    const articleId = decodeURIComponent(m[1]);
    const part = m[2] || '';

    if (!part && req.method === 'GET') {
      const store = readStore();
      const a = requireArticle(store, articleId);
      if (!canSee(session, a)) fail(403, 'غير مصرح');
      sendJson(res, 200, { ok: true, article: publicArticle(a, { full: true, session }) });
      return true;
    }
    if (!part && (req.method === 'PUT' || req.method === 'PATCH')) {
      const body = await readBody(req);
      const updated = await withLock(() => {
        const store = readStore();
        const a = requireArticle(store, articleId);
        if (!canEdit(session, a)) fail(403, 'لا يمكن تعديل هذا المقال في حالته الحالية');
        applyPatch(a, body || {});
        pushActivity(store, a, actorOf(session), 'updated', 'تم تعديل المقال');
        writeStore(store);
        return a;
      });
      sendJson(res, 200, { ok: true, article: publicArticle(updated, { full: true, session }) });
      return true;
    }
    if (part === 'action' && req.method === 'POST') {
      const body = await readBody(req);
      const action = String(body.action || '').trim();
      const key = String(req.headers['idempotency-key'] || body.idempotencyKey || '').trim();
      const result = await withLock(() => {
        const store = readStore();
        if (key && store.idempotency[key]) {
          const hit = findArticle(store, store.idempotency[key]);
          if (hit) return hit;
        }
        const a = requireArticle(store, articleId);
        if (action === 'submit' || action === 'send_review') {
          const own = (a.ownerEmail || '').toLowerCase() === String(session.email || '').toLowerCase();
          if (!own && !isStaff(session)) fail(403, 'غير مصرح');
        }
        const out = handleAction(store, a, action, body || {}, actorOf(session), session);
        if (key) store.idempotency[key] = out.id;
        writeStore(store);
        return out;
      });
      sendJson(res, 200, {
        ok: true,
        article: publicArticle(result, { full: true, session }),
        request: result.requestId ? adminRequest(result) : null,
      });
      return true;
    }

    sendJson(res, 404, { ok: false, error: 'المسار غير موجود' });
    return true;
  } catch (err) {
    sendJson(res, err.status || 500, { ok: false, error: err.message || 'تعذر تنفيذ العملية' });
    return true;
  }
}

module.exports = { PERMS, handleApi, readStore, publicArticle, adminRequest, STATUS_LABEL };
