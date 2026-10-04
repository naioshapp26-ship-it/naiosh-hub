/**
 * Events studio — file-backed SoT with in-process lock.
 * Event ID / Request ID / Registration ID share one graph. Staff + customer.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_PATH = path.join(__dirname, '..', 'data', 'hub-events.json');
const META_KEY = 'hub_events';

const PERMS = {
  view: 'events.view',
  create: 'events.create',
  edit: 'events.edit',
  upload: 'events.upload',
  review: 'events.review',
  approve: 'events.approve',
  publish: 'events.publish',
  delete: 'events.delete',
};

const STATUSES = ['draft', 'pending_review', 'needs_changes', 'approved', 'published', 'paused', 'ended', 'rejected'];
const STATUS_LABEL = {
  draft: 'مسودة',
  pending_review: 'بانتظار المراجعة',
  needs_changes: 'تحتاج تعديل',
  approved: 'تمت الموافقة',
  published: 'منشورة',
  paused: 'موقوفة',
  ended: 'منتهية',
  rejected: 'مرفوضة',
};

const REQ_STATUS = {
  pending_review: 'Pending Review',
  needs_changes: 'Needs Changes',
  approved: 'Approved',
  published: 'Approved',
  rejected: 'Rejected',
  paused: 'Unpublished',
  ended: 'Completed',
  draft: 'Draft',
};

const TRANSITIONS = {
  draft: ['pending_review', 'rejected'],
  pending_review: ['approved', 'published', 'needs_changes', 'rejected'],
  needs_changes: ['pending_review', 'rejected'],
  approved: ['published', 'paused', 'rejected'],
  published: ['paused', 'ended', 'rejected'],
  paused: ['published', 'ended', 'rejected'],
  ended: [],
  rejected: ['pending_review', 'draft'],
};

const CATEGORIES = ['مؤتمر', 'ورشة', 'ندوة', 'دورة', 'إطلاق', 'تدريب', 'معرض', 'بث مباشر', 'أخرى'];

const CHANNELS = [
  { id: 'website', label: 'الموقع', connected: true, mode: 'internal' },
  { id: 'inapp', label: 'داخل النظام', connected: true, mode: 'internal' },
  { id: 'email', label: 'البريد الإلكتروني', connected: false, mode: 'manual' },
  { id: 'instagram', label: 'Instagram', connected: false, mode: 'manual' },
  { id: 'facebook', label: 'Facebook', connected: false, mode: 'manual' },
  { id: 'youtube', label: 'YouTube', connected: false, mode: 'manual' },
  { id: 'tiktok', label: 'TikTok', connected: false, mode: 'manual' },
  { id: 'x', label: 'X', connected: false, mode: 'manual' },
];

function nowIso() {
  return new Date().toISOString();
}

function emptyStore() {
  return {
    version: 1,
    seq: { event: 0, request: 0, registration: 0, video: 0, clip: 0, pub: 0, asset: 0 },
    events: [],
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
    if (!raw || !Array.isArray(raw.events)) return emptyStore();
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
    for (const e of store.events) {
      await client.query(
        `INSERT INTO hub_event_records (id, name, status, payload, owner_email, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, COALESCE($6::timestamptz, NOW()), NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, status = EXCLUDED.status, payload = EXCLUDED.payload,
           owner_email = EXCLUDED.owner_email, updated_at = NOW()`,
        [e.id, e.name, e.status, JSON.stringify(e), e.ownerEmail || '', e.createdAt || null]
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
    employeeNo: session?.employeeNo || session?.userId || '',
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
  if (isStaff(session) && hubSession.hasPermission(session, perm)) return true;
  return false;
}

function assertStaffPerm(session, perm) {
  if (!hasPerm(session, perm)) fail(403, 'ليست لديك صلاحية هذه العملية');
}

function pushActivity(store, event, actor, action, detail, extra = {}) {
  const row = {
    id: `act-${crypto.randomBytes(4).toString('hex')}`,
    eventId: event?.id || extra.eventId || '',
    requestId: event?.requestId || extra.requestId || '',
    at: nowIso(),
    action,
    detail: detail || '',
    actorName: actor.name,
    actorEmail: actor.email,
    employeeNo: actor.employeeNo || '',
    before: extra.before ?? null,
    after: extra.after ?? null,
  };
  store.activity.unshift(row);
  if (store.activity.length > 2000) store.activity.length = 2000;
  if (event) {
    event.activity = event.activity || [];
    event.activity.unshift(row);
    if (event.activity.length > 300) event.activity.length = 300;
    event.updatedAt = row.at;
  }
  return row;
}

function notify(title, body, link, meta) {
  try {
    require('../db/hub-runtime').addNotification({
      source: 'EVENTS',
      sourceName: 'استوديو الفعاليات',
      title,
      body,
      level: 'info',
      category: 'events',
      link: link || 'events.html',
      meta: meta || null,
    });
  } catch {
    /* optional */
  }
}

function findEvent(store, id) {
  return store.events.find((e) => e.id === id || e.requestId === id) || null;
}

function requireEvent(store, id) {
  const e = findEvent(store, id);
  if (!e) fail(404, 'الفعالية غير موجودة');
  return e;
}

function canSee(session, e) {
  if (!e) return false;
  if (e.status === 'published' || e.status === 'paused' || e.status === 'ended') return true;
  if (!session) return false;
  if (isStaff(session)) return true;
  return (e.ownerEmail || '').toLowerCase() === String(session.email || '').toLowerCase();
}

function canEdit(session, e) {
  if (!session) return false;
  if (isStaff(session) && hasPerm(session, PERMS.edit)) return true;
  const own = (e.ownerEmail || '').toLowerCase() === String(session.email || '').toLowerCase();
  return own && (e.status === 'draft' || e.status === 'needs_changes');
}

function remainingSeats(e) {
  const seats = e.seats == null ? null : Number(e.seats);
  const taken = Number(e.seatsTaken || 0);
  if (seats == null) return { seats: null, taken, left: null, full: false };
  return { seats, taken, left: Math.max(0, seats - taken), full: taken >= seats };
}

function publicEvent(e, { full = false, session = null } = {}) {
  const seats = remainingSeats(e);
  const base = {
    id: e.id,
    name: e.name,
    category: e.category,
    summary: e.summary,
    description: full ? e.description : e.summary,
    coverImage: e.coverImage,
    startDate: e.startDate,
    startTime: e.startTime,
    endDate: e.endDate,
    endTime: e.endTime,
    attendanceType: e.attendanceType,
    attendanceLabel:
      e.attendanceType === 'online' ? 'أونلاين' : e.attendanceType === 'hybrid' ? 'هجين' : 'حضوري',
    address: e.attendanceType === 'online' ? '' : e.address,
    city: e.city,
    country: e.country,
    onlineUrl: full && (isStaff(session) || (session && session.email === e.ownerEmail)) ? e.onlineUrl : e.status === 'published' && session ? e.onlineUrl : '',
    requiresRegistration: e.requiresRegistration !== false,
    pricing: e.pricing,
    priceUsd: e.pricing === 'paid' ? Number(e.priceUsd || 0) : 0,
    seats: seats.seats,
    seatsTaken: seats.taken,
    seatsLeft: seats.left,
    full: seats.full,
    registrationEnds: e.registrationEnds,
    organizerName: e.organizerName,
    status: e.status,
    statusLabel: STATUS_LABEL[e.status] || e.status,
    requestId: e.requestId || '',
    changeRequestNote: e.changeRequestNote || '',
    rejectionReason: e.rejectionReason || '',
    ownerEmail: e.ownerEmail,
    ownerName: e.ownerName,
    updatedAt: e.updatedAt,
    createdAt: e.createdAt,
    archived: !!e.archived,
    registrationsCount: (e.registrations || []).filter((r) => r.status === 'confirmed').length,
  };
  if (!full) return base;
  return {
    ...base,
    description: e.description,
    onlineUrl: e.onlineUrl,
    mapsUrl: e.mapsUrl,
    organizerEmail: e.organizerEmail,
    organizerPhone: e.organizerPhone,
    organizerWebsite: e.organizerWebsite,
    assets: e.assets || [],
    videos: e.videos || [],
    clips: e.clips || [],
    publications: e.publications || [],
    registrations: isStaff(session) || (session && session.email === e.ownerEmail) ? e.registrations || [] : [],
    activity: e.activity || [],
    request: e.request || null,
  };
}

function adminRequest(e) {
  return {
    id: e.requestId,
    requestId: e.requestId,
    requestType: 'Event Submission',
    requestTypeLabel: 'طلب نشر فعالية',
    title: `طلب نشر فعالية: ${e.name}`,
    description: e.summary || e.description || '',
    status: REQ_STATUS[e.status] || 'Pending Review',
    statusLabel: STATUS_LABEL[e.status],
    referenceType: 'Event',
    referenceId: e.id,
    eventId: e.id,
    sourceModule: 'الفعاليات',
    sourcePage: 'استوديو الفعاليات',
    sourceUrl: `events.html#event=${e.id}`,
    sourceAction: 'نشر فعالية',
    customerName: e.ownerName,
    customerId: e.ownerEmail,
    email: e.ownerEmail || e.organizerEmail,
    phone: e.organizerPhone || '',
    assignedTo: 'Events Desk',
    department: 'Marketing',
    createdAt: e.submittedAt || e.createdAt,
    updatedAt: e.updatedAt,
    category: e.category,
    date: e.startDate,
    attendanceType: e.attendanceType,
    pricing: e.pricing,
    priceUsd: e.priceUsd,
    seats: e.seats,
    changeRequestNote: e.changeRequestNote || '',
    rejectionReason: e.rejectionReason || '',
    previewUrl: `events.html#event=${e.id}`,
    eventSnapshot: {
      eventId: e.id,
      name: e.name,
      category: e.category,
      date: e.startDate,
      startTime: e.startTime,
      attendanceType: e.attendanceType,
      pricing: e.pricing,
      priceUsd: e.priceUsd,
      seats: e.seats,
    },
  };
}

function applyPatch(e, body) {
  const fields = [
    'name',
    'category',
    'summary',
    'description',
    'coverImage',
    'startDate',
    'startTime',
    'endDate',
    'endTime',
    'attendanceType',
    'address',
    'city',
    'country',
    'onlineUrl',
    'mapsUrl',
    'organizerName',
    'organizerEmail',
    'organizerPhone',
    'organizerWebsite',
    'registrationEnds',
  ];
  const before = {};
  const after = {};
  for (const f of fields) {
    if (body[f] != null) {
      before[f] = e[f];
      e[f] = typeof body[f] === 'string' ? String(body[f]).trim() : body[f];
      after[f] = e[f];
    }
  }
  if (body.requiresRegistration != null) e.requiresRegistration = !!body.requiresRegistration;
  if (body.pricing) e.pricing = body.pricing === 'paid' ? 'paid' : 'free';
  if (body.priceUsd != null) e.priceUsd = e.pricing === 'paid' ? Number(body.priceUsd) || 0 : 0;
  if (body.seats != null) e.seats = body.seats === '' || body.seats == null ? null : Number(body.seats);
  return { before, after };
}

function blankEvent(id, actor) {
  return {
    id,
    name: '',
    category: 'أخرى',
    summary: '',
    description: '',
    coverImage: '',
    startDate: '',
    startTime: '18:00',
    endDate: '',
    endTime: '',
    attendanceType: 'online',
    address: '',
    city: '',
    country: '',
    onlineUrl: '',
    mapsUrl: '',
    requiresRegistration: true,
    pricing: 'free',
    priceUsd: 0,
    seats: null,
    seatsTaken: 0,
    registrationEnds: '',
    organizerName: actor.name,
    organizerEmail: actor.email,
    organizerPhone: '',
    organizerWebsite: '',
    status: 'draft',
    requestId: '',
    changeRequestNote: '',
    rejectionReason: '',
    ownerEmail: actor.email,
    ownerName: actor.name,
    assets: [],
    videos: [],
    clips: [],
    publications: [],
    registrations: [],
    activity: [],
    archived: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    submittedAt: '',
  };
}

function createEvent(store, body, actor, idempotencyKey) {
  if (idempotencyKey && store.idempotency[idempotencyKey]) {
    const existing = findEvent(store, store.idempotency[idempotencyKey]);
    if (existing) return existing;
  }
  const name = String(body.name || '').trim();
  if (!name) fail(400, 'اسم الفعالية مطلوب');
  const id = nextCode(store, 'event', 'EVT');
  const e = blankEvent(id, actor);
  applyPatch(e, body);
  e.name = name;
  store.events.unshift(e);
  if (idempotencyKey) store.idempotency[idempotencyKey] = e.id;
  pushActivity(store, e, actor, 'created', 'تم إنشاء الفعالية');
  return e;
}

function setStatus(store, e, next, actor, note) {
  if (e.status === next) return e;
  if (!(TRANSITIONS[e.status] || []).includes(next)) {
    fail(409, `لا يمكن نقل الحالة من ${STATUS_LABEL[e.status]} إلى ${STATUS_LABEL[next]}`);
  }
  const before = e.status;
  e.status = next;
  if (next === 'needs_changes') e.changeRequestNote = String(note || '').trim();
  if (next === 'rejected') e.rejectionReason = String(note || '').trim();
  if (next === 'pending_review' || next === 'published' || next === 'approved') {
    if (next !== 'needs_changes') e.changeRequestNote = next === 'pending_review' ? e.changeRequestNote : '';
  }
  if (next === 'published' || next === 'approved') e.rejectionReason = '';
  pushActivity(store, e, actor, 'status', `الحالة: ${STATUS_LABEL[before]} ← ${STATUS_LABEL[next]}`, { before, after: next });
  return e;
}

function ensureRequest(store, e, actor) {
  if (e.requestId) {
    let row = store.requests.find((r) => r.id === e.requestId);
    if (row) {
      Object.assign(row, adminRequest(e), { updatedAt: nowIso() });
      return row;
    }
  }
  const id = nextCode(store, 'request', 'EVT-REQ');
  e.requestId = id;
  const row = { ...adminRequest(e), id, requestId: id, createdAt: nowIso(), updatedAt: nowIso() };
  store.requests.unshift(row);
  pushActivity(store, e, actor, 'request', `تم إنشاء طلب المراجعة ${id}`, { requestId: id });
  return row;
}

function syncRequest(store, e) {
  if (!e.requestId) return;
  const row = store.requests.find((r) => r.id === e.requestId);
  if (row) Object.assign(row, adminRequest(e), { id: e.requestId, requestId: e.requestId, updatedAt: nowIso() });
}

function handleAction(store, e, action, body, actor, session) {
  const note = String(body.note || body.reason || '').trim();
  switch (action) {
    case 'submit':
    case 'send_review': {
      if (!e.name) fail(400, 'اسم الفعالية مطلوب');
      if (!e.startDate) fail(400, 'تاريخ البداية مطلوب');
      if (!e.attendanceType) fail(400, 'نوع الحضور مطلوب');
      if (e.attendanceType !== 'online' && !e.address && !e.city) fail(400, 'عنوان الفعالية الحضورية مطلوب');
      if (e.attendanceType !== 'in_person' && !e.onlineUrl) fail(400, 'رابط الانضمام مطلوب للفعالية الأونلاين/الهجينة');
      if (e.pricing === 'paid' && !Number(e.priceUsd)) fail(400, 'السعر مطلوب للفعالية المدفوعة');
      setStatus(store, e, 'pending_review', actor, note);
      e.submittedAt = nowIso();
      e.changeRequestNote = '';
      ensureRequest(store, e, actor);
      syncRequest(store, e);
      notify('فعالية بانتظار المراجعة', `${e.name} · ${e.id}`, `events.html#event=${e.id}`, { eventId: e.id, requestId: e.requestId });
      return e;
    }
    case 'approve':
    case 'publish': {
      assertStaffPerm(session, PERMS.approve);
      if (e.status === 'pending_review') setStatus(store, e, 'approved', actor, note);
      if (e.status === 'approved') setStatus(store, e, 'published', actor, note);
      else if (e.status !== 'published') setStatus(store, e, 'published', actor, note);
      ensureRequest(store, e, actor);
      syncRequest(store, e);
      notify('نُشرت فعاليتك', `${e.name} · ${e.id}`, `events.html#event=${e.id}`, { eventId: e.id });
      return e;
    }
    case 'request_changes': {
      assertStaffPerm(session, PERMS.approve);
      if (!note) fail(400, 'سبب طلب التعديل مطلوب');
      setStatus(store, e, 'needs_changes', actor, note);
      syncRequest(store, e);
      notify('مطلوب تعديل على فعاليتك', note, `events.html#event=${e.id}`, { eventId: e.id });
      return e;
    }
    case 'reject': {
      assertStaffPerm(session, PERMS.approve);
      if (!note) fail(400, 'سبب الرفض مطلوب');
      setStatus(store, e, 'rejected', actor, note);
      syncRequest(store, e);
      notify('رُفضت فعاليتك', note, `events.html#event=${e.id}`, { eventId: e.id });
      return e;
    }
    case 'pause':
      assertStaffPerm(session, PERMS.publish);
      setStatus(store, e, 'paused', actor, note);
      syncRequest(store, e);
      return e;
    case 'resume':
      assertStaffPerm(session, PERMS.publish);
      setStatus(store, e, 'published', actor, note);
      syncRequest(store, e);
      return e;
    case 'end':
    case 'complete':
      setStatus(store, e, 'ended', actor, note);
      syncRequest(store, e);
      return e;
    case 'archive': {
      const own = (e.ownerEmail || '').toLowerCase() === String(actor.email || '').toLowerCase();
      if (!own && !hasPerm(session, PERMS.delete)) fail(403, 'غير مصرح');
      e.archived = true;
      if (e.status === 'published' || e.status === 'paused') setStatus(store, e, 'ended', actor, note || 'أرشفة');
      pushActivity(store, e, actor, 'archive', 'تم أرشفة الفعالية');
      syncRequest(store, e);
      return e;
    }
    case 'delete': {
      const own = (e.ownerEmail || '').toLowerCase() === String(actor.email || '').toLowerCase();
      if (e.status !== 'draft') fail(409, 'لا يُحذف إلا المسودة — استخدم الأرشفة للحالات الأخرى');
      if (!own && !hasPerm(session, PERMS.delete)) fail(403, 'غير مصرح');
      e.archived = true;
      e.deleted = true;
      pushActivity(store, e, actor, 'delete', 'حُذفت المسودة');
      return e;
    }
    default:
      fail(400, 'إجراء غير معروف');
  }
}

function registerCustomer(store, e, session, body, idempotencyKey) {
  if (e.status !== 'published') fail(409, 'لا يمكن التسجيل إلا في فعالية منشورة');
  if (e.requiresRegistration === false) fail(400, 'هذه الفعالية لا تتطلب تسجيلاً');
  const email = String(body.email || session.email || '').trim().toLowerCase();
  if (!email) fail(400, 'البريد مطلوب للتسجيل');
  const existing = (e.registrations || []).find((r) => r.email === email && r.status !== 'cancelled');
  if (existing) fail(409, 'أنت مسجّل مسبقاً في هذه الفعالية');
  if (idempotencyKey && store.idempotency[idempotencyKey]) {
    const rid = store.idempotency[idempotencyKey];
    const hit = (e.registrations || []).find((r) => r.id === rid);
    if (hit) return hit;
  }
  const seats = remainingSeats(e);
  if (seats.full) fail(409, 'اكتمل العدد');
  if (e.registrationEnds && e.registrationEnds < nowIso().slice(0, 10)) fail(409, 'انتهى موعد التسجيل');
  const paid = e.pricing === 'paid';
  const row = {
    id: nextCode(store, 'registration', 'REG'),
    eventId: e.id,
    customerId: session.email || email,
    name: body.name || session.name || email,
    email,
    phone: body.phone || '',
    status: paid ? 'pending_payment' : 'confirmed',
    pricing: e.pricing,
    priceUsd: Number(e.priceUsd || 0),
    paymentNote: paid ? 'بوابة الدفع غير متصلة — لم يُسجَّل نجاح دفع وهمي' : '',
    createdAt: nowIso(),
  };
  e.registrations = e.registrations || [];
  e.registrations.push(row);
  if (!paid) e.seatsTaken = Number(e.seatsTaken || 0) + 1;
  if (idempotencyKey) store.idempotency[idempotencyKey] = row.id;
  pushActivity(store, e, actorOf(session), 'register', `${row.id} · ${email}`);
  return row;
}

function summary(store, session) {
  const visible = store.events.filter((e) => canSee(session, e) && !e.deleted && !e.archived);
  const today = nowIso().slice(0, 10);
  const upcoming = visible.filter((e) => e.status === 'published' && e.startDate && e.startDate >= today).length;
  const pending = visible.filter((e) => e.status === 'pending_review').length;
  const drafts = visible.filter((e) => e.status === 'draft').length;
  const videos = visible.reduce((n, e) => n + (e.videos || []).length + (e.assets || []).filter((a) => a.kind === 'video').length, 0);
  const clips = visible.reduce((n, e) => n + (e.clips || []).filter((c) => c.status === 'ready').length, 0);
  const regs = visible.reduce((n, e) => n + (e.registrations || []).filter((r) => r.status === 'confirmed').length, 0);
  return {
    upcoming,
    pending,
    drafts,
    published: visible.filter((e) => e.status === 'published').length,
    videos,
    clipsReady: clips,
    registrations: regs,
    eventCount: visible.length,
  };
}

function listFor(store, session, q) {
  let list = store.events.filter((e) => canSee(session, e) && !e.deleted);
  if (q.archived !== '1') list = list.filter((e) => !e.archived);
  if (q.mine === '1' && session) {
    list = list.filter((e) => (e.ownerEmail || '').toLowerCase() === String(session.email || '').toLowerCase());
  }
  if (q.published === '1') list = list.filter((e) => e.status === 'published');
  if (q.status) list = list.filter((e) => e.status === q.status);
  if (q.q) {
    const s = String(q.q).toLowerCase();
    list = list.filter((e) => [e.id, e.name, e.ownerName, e.category, e.requestId].join(' ').toLowerCase().includes(s));
  }
  if (q.upcoming === '1') {
    const today = nowIso().slice(0, 10);
    list = list.filter((e) => e.status === 'published' && e.startDate >= today);
  }
  return list;
}

async function handleApi(req, res, pathname, { sendJson, readBody, requireStaff, requireAuth }) {
  const qs = (() => {
    try {
      return Object.fromEntries(new URL(req.url, 'http://local').searchParams.entries());
    } catch {
      return {};
    }
  })();

  try {
    if (pathname === '/api/hub/events/public' && req.method === 'GET') {
      const store = readStore();
      const today = nowIso().slice(0, 10);
      const items = store.events
        .filter((e) => e.status === 'published')
        .map((e) => publicEvent(e));
      sendJson(res, 200, { ok: true, items, count: items.length, today });
      return true;
    }

    if (pathname === '/api/hub/events/meta' && req.method === 'GET') {
      const resolved = require('./hub-session').resolveSession(req);
      const session = resolved && resolved.ok ? resolved : null;
      sendJson(res, 200, {
        ok: true,
        meta: {
          statuses: STATUSES.map((id) => ({ id, label: STATUS_LABEL[id] })),
          categories: CATEGORIES,
          channels: CHANNELS,
          permissions: PERMS,
        },
        me: session
          ? {
              email: session.email,
              name: session.name,
              role: session.role,
              lane: session.lane,
              staff: isStaff(session),
              permissions: session.permissions || [],
            }
          : { staff: false, guest: true },
      });
      return true;
    }

    const session = requireAuth(req, res);
    if (!session) return true;

    if (pathname === '/api/hub/events/summary' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, summary: summary(readStore(), session) });
      return true;
    }
    if (pathname === '/api/hub/events/requests' && req.method === 'GET') {
      if (!isStaff(session)) fail(403, 'غير مصرح');
      const store = readStore();
      const items = store.events.filter((e) => e.requestId).map(adminRequest);
      sendJson(res, 200, { ok: true, items });
      return true;
    }
    if (pathname === '/api/hub/events/videos' && req.method === 'GET') {
      const store = readStore();
      const items = [];
      store.events.filter((e) => canSee(session, e)).forEach((e) => {
        (e.videos || []).concat((e.assets || []).filter((a) => a.kind === 'video')).forEach((v) => {
          items.push({ ...v, eventId: e.id, eventName: e.name });
        });
      });
      sendJson(res, 200, { ok: true, items });
      return true;
    }
    if (pathname === '/api/hub/events/clips' && req.method === 'GET') {
      const store = readStore();
      const items = [];
      store.events.filter((e) => canSee(session, e)).forEach((e) => {
        (e.clips || []).forEach((c) => items.push({ ...c, eventId: e.id, eventName: e.name }));
      });
      sendJson(res, 200, { ok: true, items });
      return true;
    }
    if (pathname === '/api/hub/events/activity' && req.method === 'GET') {
      const store = readStore();
      const items = store.activity.filter((a) => {
        const e = findEvent(store, a.eventId);
        return e && canSee(session, e);
      });
      sendJson(res, 200, { ok: true, items: items.slice(0, 300) });
      return true;
    }
    if (pathname === '/api/hub/events/registrations' && req.method === 'GET') {
      if (!isStaff(session)) fail(403, 'غير مصرح');
      const store = readStore();
      const items = [];
      store.events.forEach((e) => {
        (e.registrations || []).forEach((r) =>
          items.push({ ...r, eventName: e.name, eventStatus: e.status, startDate: e.startDate, seats: e.seats, seatsTaken: e.seatsTaken })
        );
      });
      sendJson(res, 200, { ok: true, items });
      return true;
    }
    if (pathname === '/api/hub/events/mine/registrations' && req.method === 'GET') {
      const store = readStore();
      const email = String(session.email || '').toLowerCase();
      const items = [];
      store.events.forEach((e) => {
        (e.registrations || [])
          .filter((r) => r.email === email)
          .forEach((r) => items.push({ ...r, eventName: e.name, eventStatus: e.status, startDate: e.startDate }));
      });
      sendJson(res, 200, { ok: true, items });
      return true;
    }

    if (pathname === '/api/hub/events' && req.method === 'GET') {
      const store = readStore();
      const list = listFor(store, session, qs).map((e) => publicEvent(e, { session }));
      sendJson(res, 200, { ok: true, items: list, count: list.length });
      return true;
    }

    if (pathname === '/api/hub/events' && req.method === 'POST') {
      const body = await readBody(req);
      const key = String(req.headers['idempotency-key'] || body.idempotencyKey || '').trim();
      const created = await withLock(() => {
        const store = readStore();
        const e = createEvent(store, body || {}, actorOf(session), key);
        writeStore(store);
        return e;
      });
      sendJson(res, 201, { ok: true, event: publicEvent(created, { full: true, session }) });
      return true;
    }

    const m = pathname.match(/^\/api\/hub\/events\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?$/);
    if (!m) {
      sendJson(res, 404, { ok: false, error: 'المسار غير موجود' });
      return true;
    }
    const eventId = decodeURIComponent(m[1]);
    const part = m[2] || '';
    const subId = m[3] ? decodeURIComponent(m[3]) : '';

    if (!part && req.method === 'GET') {
      const store = readStore();
      const e = requireEvent(store, eventId);
      if (!canSee(session, e)) fail(403, 'غير مصرح');
      sendJson(res, 200, { ok: true, event: publicEvent(e, { full: true, session }) });
      return true;
    }
    if (!part && (req.method === 'PUT' || req.method === 'PATCH')) {
      const body = await readBody(req);
      const updated = await withLock(() => {
        const store = readStore();
        const e = requireEvent(store, eventId);
        if (!canEdit(session, e)) fail(403, 'لا يمكن تعديل هذه الفعالية في حالتها الحالية');
        const diff = applyPatch(e, body || {});
        pushActivity(store, e, actorOf(session), 'updated', 'تم تعديل بيانات الفعالية', diff);
        writeStore(store);
        return e;
      });
      sendJson(res, 200, { ok: true, event: publicEvent(updated, { full: true, session }) });
      return true;
    }

    if (part === 'action' && req.method === 'POST') {
      const body = await readBody(req);
      const action = String(body.action || '').trim();
      const key = String(req.headers['idempotency-key'] || body.idempotencyKey || '').trim();
      const result = await withLock(() => {
        const store = readStore();
        if (key && store.idempotency[key]) {
          const hit = findEvent(store, store.idempotency[key]);
          if (hit) return hit;
        }
        const e = requireEvent(store, eventId);
        if (action === 'submit' || action === 'send_review') {
          const own = (e.ownerEmail || '').toLowerCase() === String(session.email || '').toLowerCase();
          if (!own && !isStaff(session)) fail(403, 'غير مصرح');
        }
        const out = handleAction(store, e, action, body || {}, actorOf(session), session);
        if (key) store.idempotency[key] = out.id;
        writeStore(store);
        return out;
      });
      sendJson(res, 200, { ok: true, event: publicEvent(result, { full: true, session }), request: adminRequest(result) });
      return true;
    }

    const mutate = async (fn) => {
      const out = await withLock(() => {
        const store = readStore();
        const e = requireEvent(store, eventId);
        const ret = fn(store, e);
        writeStore(store);
        return ret;
      });
      sendJson(res, 200, { ok: true, event: publicEvent(out.event || out, { full: true, session }), extra: out.extra });
    };

    if (part === 'register' && req.method === 'POST') {
      const body = await readBody(req);
      const key = String(req.headers['idempotency-key'] || body.idempotencyKey || '').trim();
      const out = await withLock(() => {
        const store = readStore();
        const e = requireEvent(store, eventId);
        const row = registerCustomer(store, e, session, body || {}, key);
        writeStore(store);
        return { event: e, extra: { registration: row } };
      });
      sendJson(res, 201, {
        ok: true,
        registration: out.extra.registration,
        event: publicEvent(out.event, { session }),
      });
      return true;
    }

    if (part === 'assets' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.url || !body.uploadId) fail(400, 'ملف الرفع غير مكتمل');
      await mutate((store, e) => {
        if (!canEdit(session, e) && !hasPerm(session, PERMS.upload) && e.ownerEmail !== session.email) fail(403, 'غير مصرح');
        const kind = String(body.kind || 'file');
        const row = {
          id: nextCode(store, kind === 'video' ? 'video' : 'asset', kind === 'video' ? 'VID' : 'AST'),
          kind,
          name: body.name || 'ملف',
          mime: body.mime || '',
          size: Number(body.size || 0),
          url: body.url,
          uploadId: body.uploadId,
          duration: body.duration || '',
          eventId: e.id,
          uploadedBy: session.email,
          uploadedByName: session.name,
          uploadedAt: nowIso(),
          status: 'ready',
        };
        e.assets.push(row);
        if (kind === 'video') e.videos.push(row);
        pushActivity(store, e, actorOf(session), 'asset_add', `${row.id} · ${row.name}`);
        return e;
      });
      return true;
    }

    if (part === 'clips' && req.method === 'POST') {
      const body = await readBody(req);
      await mutate((store, e) => {
        if (!canEdit(session, e) && !isStaff(session)) fail(403, 'غير مصرح');
        const start = Number(body.start || 0);
        const end = Number(body.end || 0);
        if (end && start >= end) fail(400, 'وقت النهاية يجب أن يكون بعد البداية');
        const row = {
          id: nextCode(store, 'clip', 'CLIP'),
          title: body.title || 'مقطع قصير',
          sourceVideoId: body.sourceVideoId || '',
          assetId: body.assetId || '',
          start,
          end,
          duration: body.duration || (end && start ? end - start : ''),
          status: body.assetId ? 'ready' : 'ready',
          note: 'لا توجد معالجة فيديو داخلية — يُحفظ المقطع المرفوع مع بياناته',
          createdAt: nowIso(),
          createdBy: session.email,
        };
        e.clips.push(row);
        pushActivity(store, e, actorOf(session), 'clip_add', row.id);
        return e;
      });
      return true;
    }

    if (part === 'publish' && req.method === 'POST') {
      const body = await readBody(req);
      await mutate((store, e) => {
        if (!isStaff(session) || !hasPerm(session, PERMS.publish)) fail(403, 'غير مصرح');
        const platform = String(body.platform || '').trim();
        if (!platform) fail(400, 'المنصة مطلوبة');
        const def = CHANNELS.find((x) => x.id === platform);
        if (def && def.connected && def.mode === 'internal') {
          const row = {
            id: nextCode(store, 'pub', 'PUB'),
            platform,
            platformLabel: def.label,
            mode: 'internal',
            status: 'published',
            statusLabel: 'تم النشر',
            url: body.url || `events.html#event=${e.id}`,
            clipId: body.clipId || '',
            at: nowIso(),
            by: session.email,
          };
          e.publications.push(row);
          pushActivity(store, e, actorOf(session), 'published', `نشر داخلي على ${def.label}`);
          return e;
        }
        const row = {
          id: nextCode(store, 'pub', 'PUB'),
          platform,
          platformLabel: def?.label || platform,
          mode: 'manual',
          status: body.url ? 'published' : 'awaiting',
          statusLabel: body.url ? 'تم النشر (تسجيل يدوي)' : 'بانتظار النشر اليدوي',
          url: body.url || '',
          note: body.url ? 'سُجّل رابط النشر يدوياً — لا يوجد تكامل API' : 'لا يوجد تكامل مع هذه المنصة',
          clipId: body.clipId || '',
          at: nowIso(),
          by: session.email,
        };
        e.publications.push(row);
        pushActivity(store, e, actorOf(session), 'publish_log', `${row.id} · ${row.platformLabel}`);
        return e;
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

module.exports = { PERMS, handleApi, readStore, publicEvent, adminRequest };
