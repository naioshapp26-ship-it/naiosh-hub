/**
 * Hub Tasks — server-backed tasks with typed assignees, entities, attachments.
 * Persists to data/hub-tasks.json + hub_meta when DATABASE_URL is set.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const hubSession = require('./hub-session');
const staffCreds = require('./hub-staff-credentials');
const customerAuth = require('./hub-customer-auth');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const STORE_PATH = path.join(DATA_DIR, 'hub-tasks.json');
const META_KEY = 'hub_tasks_v1';

const ASSIGNEE_TYPES = {
  staff_naiosh: 'موظف في نايوش',
  staff_external: 'موظف أو شخص من جهة خارجية',
  customer: 'عميل',
  company: 'شركة أو مؤسسة',
};

const ENTITY_TYPES = {
  none: 'مهمة عامة',
  branch: 'فرع',
  office: 'مكتب',
  platform: 'منصة',
  incubator: 'حاضنة',
};

const TASK_TYPES = {
  operational: 'تشغيلية',
  followup: 'متابعة',
  support: 'دعم',
  compliance: 'امتثال',
  project: 'مشروع',
  other: 'أخرى',
};

let mem = null;
let dbWriteQueue = Promise.resolve();

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function defaultStore() {
  return { version: 1, updatedAt: new Date().toISOString(), seq: 0, tasks: {}, audit: [] };
}

async function loadFromDb() {
  try {
    const { getDatabaseUrl, withClient } = require('../db/migrate');
    if (!getDatabaseUrl()) return null;
    return await withClient(async (client) => {
      const r = await client.query(`SELECT value FROM hub_meta WHERE key = $1 LIMIT 1`, [META_KEY]);
      if (!r.rows[0]?.value) return null;
      const value = r.rows[0].value;
      return typeof value === 'string' ? JSON.parse(value) : value;
    });
  } catch {
    return null;
  }
}

function persistToDb(store) {
  dbWriteQueue = dbWriteQueue
    .then(async () => {
      try {
        const { getDatabaseUrl, withClient } = require('../db/migrate');
        if (!getDatabaseUrl()) return;
        await withClient(async (client) => {
          await client.query(
            `INSERT INTO hub_meta (key, value, updated_at)
             VALUES ($1, $2::jsonb, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [META_KEY, JSON.stringify(store)]
          );
        });
      } catch (err) {
        console.warn('[hub-tasks] DB persist skipped:', err.message);
      }
    })
    .catch(() => {});
  return dbWriteQueue;
}

function readStore() {
  if (mem) return mem;
  ensureDir();
  try {
    if (fs.existsSync(STORE_PATH)) {
      mem = { ...defaultStore(), ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) };
      if (!mem.tasks) mem.tasks = {};
      if (!Array.isArray(mem.audit)) mem.audit = [];
      return mem;
    }
  } catch {
    /* */
  }
  mem = defaultStore();
  return mem;
}

function writeStore(store) {
  mem = store;
  store.updatedAt = new Date().toISOString();
  ensureDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  persistToDb(store);
}

async function hydrateFromDb() {
  const fromDb = await loadFromDb();
  if (fromDb && fromDb.tasks) {
    mem = { ...defaultStore(), ...fromDb };
    ensureDir();
    fs.writeFileSync(STORE_PATH, JSON.stringify(mem, null, 2));
  } else {
    readStore();
  }
  return mem;
}

function audit(action, meta = {}) {
  const store = readStore();
  store.audit.unshift({
    id: crypto.randomBytes(8).toString('hex'),
    at: new Date().toISOString(),
    action,
    ...meta,
  });
  if (store.audit.length > 500) store.audit.length = 500;
  writeStore(store);
}

function nextTaskNo() {
  const store = readStore();
  store.seq = Number(store.seq || 0) + 1;
  writeStore(store);
  return `TSK-${String(store.seq).padStart(5, '0')}`;
}

function resolveAssignee(body) {
  const type = String(body.assigneeType || '').trim();
  const id = String(body.assigneeId || '').trim();
  if (!type || !ASSIGNEE_TYPES[type]) {
    return { ok: false, error: 'اختر نوع المسؤول عن المهمة.' };
  }
  if (!id) return { ok: false, error: 'اختر المسؤول من قاعدة البيانات.' };

  if (type === 'staff_naiosh' || type === 'staff_external') {
    const cred = staffCreds.getCredential(id);
    if (!cred) return { ok: false, error: 'الموظف غير موجود في سجل الإداريين.' };
    const aff = cred.affiliationKind === 'external' ? 'external' : 'naiosh';
    if (type === 'staff_naiosh' && aff !== 'naiosh') {
      return { ok: false, error: 'هذا الحساب ليس موظف نايوش.' };
    }
    if (type === 'staff_external' && aff !== 'external') {
      return { ok: false, error: 'هذا الحساب ليس من جهة خارجية.' };
    }
    return {
      ok: true,
      assignee: {
        type,
        typeLabel: ASSIGNEE_TYPES[type],
        id: cred.email,
        name: cred.name || cred.email,
        email: cred.email,
        employeeNo: cred.employeeNo || null,
        accountId: cred.naioshId || null,
        orgName: cred.orgName || (aff === 'naiosh' ? 'نايوش' : ''),
        phone: cred.phone || '',
      },
    };
  }

  if (type === 'customer') {
    const account = customerAuth.findByEmail?.(id) || null;
    if (!account) return { ok: false, error: 'العميل غير موجود.' };
    return {
      ok: true,
      assignee: {
        type,
        typeLabel: ASSIGNEE_TYPES[type],
        id: account.email || account.id,
        name: account.fullName || account.name || account.email,
        email: account.email,
        customerId: account.customerId || account.id || null,
        phone: account.phone || '',
      },
    };
  }

  if (type === 'company') {
    const orgName = String(body.companyName || body.assigneeLabel || id).trim();
    if (!orgName) return { ok: false, error: 'اسم الشركة أو المؤسسة مطلوب.' };
    let contact = null;
    const contactId = String(body.contactPersonId || '').trim();
    if (contactId) {
      const cred = staffCreds.getCredential(contactId);
      if (!cred) return { ok: false, error: 'شخص المتابعة داخل الشركة غير موجود.' };
      contact = {
        id: cred.email,
        name: cred.name || cred.email,
        email: cred.email,
        employeeNo: cred.employeeNo || null,
      };
    }
    return {
      ok: true,
      assignee: {
        type,
        typeLabel: ASSIGNEE_TYPES[type],
        id: orgName,
        name: orgName,
        orgName,
        contact,
      },
    };
  }

  return { ok: false, error: 'نوع المسؤول غير مدعوم.' };
}

function normalizeEntity(body) {
  const type = String(body.entityType || 'none').trim() || 'none';
  if (!ENTITY_TYPES[type]) return { ok: false, error: 'نوع الجهة غير صالح.' };
  if (type === 'none') {
    return { ok: true, entity: { type: 'none', typeLabel: ENTITY_TYPES.none, id: null, name: 'مهمة عامة' } };
  }
  const id = String(body.entityId || '').trim();
  const name = String(body.entityName || '').trim();
  if (!id && !name) return { ok: false, error: 'اختر الجهة أو الوحدة المرتبطة من القائمة.' };
  return {
    ok: true,
    entity: {
      type,
      typeLabel: ENTITY_TYPES[type],
      id: id || name,
      name: name || id,
    },
  };
}

function publicTask(t) {
  return {
    id: t.id,
    taskNo: t.taskNo,
    title: t.title,
    details: t.details || '',
    notes: t.notes || '',
    taskType: t.taskType || 'operational',
    taskTypeLabel: TASK_TYPES[t.taskType] || TASK_TYPES.operational,
    project: t.project || '',
    priority: t.priority || 'متوسط',
    status: t.status || 'todo',
    dueDate: t.dueDate || '',
    source: t.source || 'إدخال يدوي',
    assignee: t.assignee || null,
    assigneeLabel: t.assignee?.name || t.assigneeName || '—',
    entity: t.entity || null,
    entityLabel:
      t.entity?.type === 'none'
        ? 'مهمة عامة'
        : t.entity
          ? `${t.entity.typeLabel || t.entity.type}: ${t.entity.name || t.entity.id}`
          : '—',
    attachments: Array.isArray(t.attachments) ? t.attachments : [],
    comments: Array.isArray(t.comments) ? t.comments : [],
    createdBy: t.createdBy || null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    updatedBy: t.updatedBy || null,
  };
}

function canManageTasks(session) {
  if (!session?.ok) return false;
  if (hubSession.isStaffLane(session.lane)) return true;
  return false;
}

function canViewTask(session, task) {
  if (!session?.ok) return false;
  // Ops room staff managing المهام can see all hub tasks.
  // Being assigned a task does NOT grant general dashboard access — customers use client views.
  if (hubSession.isStaffLane(session.lane)) return true;
  if (session.lane === 'CLIENT') {
    return (
      task.assignee?.type === 'customer' &&
      (task.assignee.id === session.email || task.assignee.email === session.email)
    );
  }
  return false;
}

function listTasks(session, { mineOnly } = {}) {
  const store = readStore();
  let items = Object.values(store.tasks).map(publicTask);
  if (!session?.ok) return [];
  if (session.lane === 'SUPER_ADMIN' && !mineOnly) {
    return items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  items = items.filter((t) => canViewTask(session, store.tasks[t.id] || t));
  return items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function getTask(id) {
  return readStore().tasks[id] || null;
}

function buildCatalog() {
  const staff = staffCreds.listStaff().filter((s) => s.assignmentStatus !== 'revoked' && s.active);
  const naioshStaff = staff
    .filter((s) => s.affiliationKind !== 'external')
    .map((s) => ({
      id: s.email,
      label: `${s.name} · ${s.employeeNo || ''} · ${s.email}`.trim(),
      name: s.name,
      email: s.email,
      employeeNo: s.employeeNo,
      accountId: s.accountId,
      phone: s.phone,
      orgName: s.orgName || 'نايوش',
    }));
  const externalStaff = staff
    .filter((s) => s.affiliationKind === 'external')
    .map((s) => ({
      id: s.email,
      label: `${s.name} · ${s.orgName || 'جهة خارجية'} · ${s.employeeNo || ''}`.trim(),
      name: s.name,
      email: s.email,
      employeeNo: s.employeeNo,
      accountId: s.accountId,
      phone: s.phone,
      orgName: s.orgName || '',
    }));

  let customers = [];
  try {
    const list = customerAuth.readStore?.()?.accounts || [];
    customers = (list || []).slice(0, 500).map((c) => ({
      id: c.email,
      label: `${c.fullName || c.name || c.email} · ${c.email}`,
      name: c.fullName || c.name || c.email,
      email: c.email,
      phone: c.phone || '',
      customerId: c.customerId || c.id || null,
    }));
  } catch {
    customers = [];
  }

  const companyMap = new Map();
  externalStaff.forEach((s) => {
    if (!s.orgName) return;
    if (!companyMap.has(s.orgName)) {
      companyMap.set(s.orgName, { id: s.orgName, label: s.orgName, name: s.orgName, contacts: [] });
    }
    companyMap.get(s.orgName).contacts.push({
      id: s.email,
      name: s.name,
      email: s.email,
      employeeNo: s.employeeNo,
    });
  });

  return {
    assigneeTypes: Object.entries(ASSIGNEE_TYPES).map(([code, label]) => ({ code, label })),
    entityTypes: Object.entries(ENTITY_TYPES).map(([code, label]) => ({ code, label })),
    taskTypes: Object.entries(TASK_TYPES).map(([code, label]) => ({ code, label })),
    priorities: ['عاجل', 'عالي', 'متوسط', 'منخفض'],
    statuses: [
      { code: 'todo', label: 'معلّقة' },
      { code: 'in_progress', label: 'قيد التنفيذ' },
      { code: 'blocked', label: 'مختنقة' },
      { code: 'done', label: 'مكتملة' },
    ],
    staffNaiosh: naioshStaff,
    staffExternal: externalStaff,
    customers,
    companies: [...companyMap.values()],
    notes: {
      entities:
        'قوائم الفروع/المكاتب/المنصات/الحاضنات تُحمّل من سجلات الواجهة المسجّلة (HubBranchesData / offices / platforms / incubators).',
      companies:
        companyMap.size === 0
          ? 'لا توجد شركات/مؤسسات مسجّلة بعد عبر إداريين بجهة خارجية — أضف إداريًا بجهة خارجية أو اختر نوعًا آخر.'
          : null,
      customers: customers.length === 0 ? 'لا يوجد عملاء مسجّلون بعد في قاعدة العملاء.' : null,
    },
  };
}

function createTask(body, session) {
  const title = String(body.title || '').trim();
  if (!title) return { ok: false, status: 400, error: 'عنوان المهمة مطلوب.' };
  const details = String(body.details || '').trim();
  if (!details) return { ok: false, status: 400, error: 'وصف المهمة وتفاصيلها مطلوب.' };
  const assigneeRes = resolveAssignee(body);
  if (!assigneeRes.ok) return { ok: false, status: 400, error: assigneeRes.error };
  const entityRes = normalizeEntity(body);
  if (!entityRes.ok) return { ok: false, status: 400, error: entityRes.error };

  const taskType = TASK_TYPES[body.taskType] ? body.taskType : 'operational';
  const priority = ['عاجل', 'عالي', 'متوسط', 'منخفض'].includes(body.priority) ? body.priority : 'متوسط';
  const status = ['todo', 'in_progress', 'blocked', 'done'].includes(body.status) ? body.status : 'todo';
  const attachments = Array.isArray(body.attachments)
    ? body.attachments
        .filter((a) => a && (a.url || a.id))
        .map((a) => ({
          id: a.id || crypto.randomBytes(6).toString('hex'),
          name: a.name || a.filename || 'مرفق',
          url: a.url,
          size: Number(a.size || 0),
          mime: a.mime || a.type || '',
          kind: a.kind || guessKind(a.mime || a.type || a.name || ''),
          uploadedAt: a.uploadedAt || new Date().toISOString(),
        }))
    : [];

  const id = `task_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  const taskNo = nextTaskNo();
  const now = new Date().toISOString();
  const task = {
    id,
    taskNo,
    title,
    details,
    notes: String(body.notes || body.instructions || '').trim(),
    taskType,
    project: String(body.project || '').trim(),
    priority,
    status,
    dueDate: String(body.dueDate || '').trim(),
    source: String(body.source || 'إدخال يدوي').trim(),
    assignee: assigneeRes.assignee,
    assigneeName: assigneeRes.assignee.name,
    entity: entityRes.entity,
    attachments,
    comments: [],
    createdBy: {
      email: session.email,
      name: session.name || session.email,
      employeeNo: session.employeeNo || null,
    },
    createdAt: now,
    updatedAt: now,
    updatedBy: { email: session.email, name: session.name || session.email },
  };

  const store = readStore();
  store.tasks[id] = task;
  writeStore(store);
  audit('TASK_CREATED', {
    actorEmail: session.email,
    targetId: id,
    detail: `${taskNo}: ${title}; assignee=${assigneeRes.assignee.type}:${assigneeRes.assignee.id}`,
  });

  return { ok: true, task: publicTask(task), notify: buildNotify(task) };
}

function guessKind(mimeOrName) {
  const s = String(mimeOrName || '').toLowerCase();
  if (s.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|heic)$/i.test(s)) return 'image';
  if (s.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(s)) return 'video';
  return 'document';
}

function buildNotify(task) {
  const a = task.assignee || {};
  const targetEmail = a.email || a.contact?.email || null;
  if (!targetEmail) return null;
  return {
    title: `مهمة جديدة: ${task.title}`,
    body: `كُلّفت بمهمة ${task.taskNo}. الأولوية: ${task.priority}.`,
    link: `dashboard.html#tasks?task=${encodeURIComponent(task.id)}`,
    category: 'task_assigned',
    targetEmail,
    meta: { taskId: task.id, taskNo: task.taskNo, targetEmail },
  };
}

function updateTask(id, body, session) {
  const store = readStore();
  const prev = store.tasks[id];
  if (!prev) return { ok: false, status: 404, error: 'المهمة غير موجودة.' };
  if (!canViewTask(session, prev) && session.lane !== 'SUPER_ADMIN') {
    return { ok: false, status: 403, error: 'غير مصرح بتعديل هذه المهمة.' };
  }

  if (body.title != null) {
    const title = String(body.title).trim();
    if (!title) return { ok: false, status: 400, error: 'عنوان المهمة مطلوب.' };
    prev.title = title;
  }
  if (body.details != null) prev.details = String(body.details).trim();
  if (body.notes != null) prev.notes = String(body.notes).trim();
  if (body.taskType != null && TASK_TYPES[body.taskType]) prev.taskType = body.taskType;
  if (body.priority != null && ['عاجل', 'عالي', 'متوسط', 'منخفض'].includes(body.priority)) {
    prev.priority = body.priority;
  }
  if (body.status != null && ['todo', 'in_progress', 'blocked', 'done'].includes(body.status)) {
    prev.status = body.status;
  }
  if (body.dueDate != null) prev.dueDate = String(body.dueDate).trim();
  if (body.project != null) prev.project = String(body.project).trim();

  if (body.assigneeType != null || body.assigneeId != null) {
    const assigneeRes = resolveAssignee(body);
    if (!assigneeRes.ok) return { ok: false, status: 400, error: assigneeRes.error };
    prev.assignee = assigneeRes.assignee;
    prev.assigneeName = assigneeRes.assignee.name;
  }
  if (body.entityType != null || body.entityId != null) {
    const entityRes = normalizeEntity(body);
    if (!entityRes.ok) return { ok: false, status: 400, error: entityRes.error };
    prev.entity = entityRes.entity;
  }
  if (Array.isArray(body.attachments)) {
    const existing = Array.isArray(prev.attachments) ? prev.attachments : [];
    const incoming = body.attachments
      .filter((a) => a && (a.url || a.id))
      .map((a) => ({
        id: a.id || crypto.randomBytes(6).toString('hex'),
        name: a.name || a.filename || 'مرفق',
        url: a.url,
        size: Number(a.size || 0),
        mime: a.mime || a.type || '',
        kind: a.kind || guessKind(a.mime || a.type || a.name || ''),
        uploadedAt: a.uploadedAt || new Date().toISOString(),
      }));
    // merge by url
    const byUrl = new Map(existing.map((a) => [a.url, a]));
    incoming.forEach((a) => byUrl.set(a.url, a));
    prev.attachments = [...byUrl.values()];
  }

  prev.updatedAt = new Date().toISOString();
  prev.updatedBy = { email: session.email, name: session.name || session.email };
  store.tasks[id] = prev;
  writeStore(store);
  audit('TASK_UPDATED', {
    actorEmail: session.email,
    targetId: id,
    detail: `${prev.taskNo}: status=${prev.status}`,
  });
  return { ok: true, task: publicTask(prev) };
}

function addComment(id, text, session) {
  const store = readStore();
  const prev = store.tasks[id];
  if (!prev) return { ok: false, status: 404, error: 'المهمة غير موجودة.' };
  if (!canViewTask(session, prev) && session.lane !== 'SUPER_ADMIN') {
    return { ok: false, status: 403, error: 'غير مصرح.' };
  }
  const body = String(text || '').trim();
  if (!body) return { ok: false, status: 400, error: 'نص التحديث مطلوب.' };
  if (!Array.isArray(prev.comments)) prev.comments = [];
  prev.comments.push({
    id: crypto.randomBytes(6).toString('hex'),
    text: body,
    at: new Date().toISOString(),
    by: { email: session.email, name: session.name || session.email },
  });
  prev.updatedAt = new Date().toISOString();
  store.tasks[id] = prev;
  writeStore(store);
  audit('TASK_COMMENT', { actorEmail: session.email, targetId: id, detail: body.slice(0, 120) });
  return { ok: true, task: publicTask(prev) };
}

function removeTask(id, session) {
  const store = readStore();
  const prev = store.tasks[id];
  if (!prev) return { ok: false, status: 404, error: 'المهمة غير موجودة.' };
  if (session.lane !== 'SUPER_ADMIN' && prev.createdBy?.email !== session.email) {
    return { ok: false, status: 403, error: 'غير مصرح بحذف هذه المهمة.' };
  }
  delete store.tasks[id];
  writeStore(store);
  audit('TASK_DELETED', { actorEmail: session.email, targetId: id, detail: prev.taskNo });
  return { ok: true };
}

function getAudit(limit = 100) {
  return readStore().audit.slice(0, limit);
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('JSON غير صالح'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

async function handle(req, res, url) {
  const pathname = url.pathname;
  if (!pathname.startsWith('/api/hub/tasks')) return false;

  await hydrateFromDb();

  if (pathname === '/api/hub/tasks/catalog' && req.method === 'GET') {
    const session = hubSession.resolveSession(req);
    if (!canManageTasks(session)) {
      sendJson(res, 403, { ok: false, error: 'غير مصرح' });
      return true;
    }
    sendJson(res, 200, { ok: true, catalog: buildCatalog() });
    return true;
  }

  if (pathname === '/api/hub/tasks' && req.method === 'GET') {
    const session = hubSession.resolveSession(req);
    if (!session.ok) {
      sendJson(res, 401, { ok: false, error: 'مطلوب تسجيل الدخول' });
      return true;
    }
    const mineOnly = url.searchParams.get('mine') === '1';
    const items = listTasks(session, { mineOnly });
    sendJson(res, 200, { ok: true, items, count: items.length, audit: getAudit(40) });
    return true;
  }

  if (pathname === '/api/hub/tasks' && req.method === 'POST') {
    const session = hubSession.resolveSession(req);
    if (!canManageTasks(session)) {
      sendJson(res, 403, { ok: false, error: 'غير مصرح بإنشاء مهام من لوحة الإدارة.' });
      return true;
    }
    let body = {};
    try {
      body = await readBody(req);
    } catch (e) {
      sendJson(res, 400, { ok: false, error: e.message });
      return true;
    }
    const result = createTask(body, session);
    if (!result.ok) {
      sendJson(res, result.status || 400, { ok: false, error: result.error });
      return true;
    }
    // Best-effort notification
    if (result.notify) {
      try {
        const hubRuntime = require('../db/hub-runtime');
        hubRuntime.addNotification({
          title: result.notify.title,
          body: result.notify.body,
          link: result.notify.link,
          category: result.notify.category,
          level: 'info',
          source: 'TASKS',
          sourceName: 'المهام',
          targetEmail: result.notify.targetEmail,
          meta: result.notify.meta,
        });
      } catch {
        /* notifications optional if runtime unavailable */
      }
    }
    sendJson(res, 201, { ok: true, task: result.task, message: 'تم حفظ المهمة.', notified: !!result.notify?.targetEmail });
    return true;
  }

  const match = pathname.match(/^\/api\/hub\/tasks\/([^/]+)(?:\/(comments|status))?$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    const sub = match[2] || '';
    const session = hubSession.resolveSession(req);

    if (req.method === 'GET' && !sub) {
      if (!session.ok) {
        sendJson(res, 401, { ok: false, error: 'مطلوب تسجيل الدخول' });
        return true;
      }
      const task = getTask(id);
      if (!task) {
        sendJson(res, 404, { ok: false, error: 'المهمة غير موجودة.' });
        return true;
      }
      if (!canViewTask(session, task) && session.lane !== 'SUPER_ADMIN') {
        sendJson(res, 403, { ok: false, error: 'غير مصرح بالاطلاع على هذه المهمة.' });
        return true;
      }
      sendJson(res, 200, { ok: true, task: publicTask(task) });
      return true;
    }

    if ((req.method === 'PATCH' || req.method === 'PUT' || req.method === 'POST') && !sub) {
      if (!session.ok || !canManageTasks(session)) {
        sendJson(res, 403, { ok: false, error: 'غير مصرح' });
        return true;
      }
      let body = {};
      try {
        body = await readBody(req);
      } catch (e) {
        sendJson(res, 400, { ok: false, error: e.message });
        return true;
      }
      const result = updateTask(id, body, session);
      if (!result.ok) {
        sendJson(res, result.status || 400, { ok: false, error: result.error });
        return true;
      }
      sendJson(res, 200, { ok: true, task: result.task, message: 'تم تحديث المهمة.' });
      return true;
    }

    if (sub === 'status' && req.method === 'POST') {
      if (!session.ok) {
        sendJson(res, 401, { ok: false, error: 'مطلوب تسجيل الدخول' });
        return true;
      }
      let body = {};
      try {
        body = await readBody(req);
      } catch (e) {
        sendJson(res, 400, { ok: false, error: e.message });
        return true;
      }
      const result = updateTask(id, { status: body.status }, session);
      if (!result.ok) {
        sendJson(res, result.status || 400, { ok: false, error: result.error });
        return true;
      }
      sendJson(res, 200, { ok: true, task: result.task });
      return true;
    }

    if (sub === 'comments' && req.method === 'POST') {
      if (!session.ok) {
        sendJson(res, 401, { ok: false, error: 'مطلوب تسجيل الدخول' });
        return true;
      }
      let body = {};
      try {
        body = await readBody(req);
      } catch (e) {
        sendJson(res, 400, { ok: false, error: e.message });
        return true;
      }
      const result = addComment(id, body.text || body.comment, session);
      if (!result.ok) {
        sendJson(res, result.status || 400, { ok: false, error: result.error });
        return true;
      }
      sendJson(res, 201, { ok: true, task: result.task });
      return true;
    }

    if (req.method === 'DELETE' && !sub) {
      if (!session.ok) {
        sendJson(res, 401, { ok: false, error: 'مطلوب تسجيل الدخول' });
        return true;
      }
      const result = removeTask(id, session);
      if (!result.ok) {
        sendJson(res, result.status || 400, { ok: false, error: result.error });
        return true;
      }
      sendJson(res, 200, { ok: true, message: 'تم حذف المهمة.' });
      return true;
    }
  }

  return false;
}

module.exports = {
  handle,
  hydrateFromDb,
  buildCatalog,
  createTask,
  listTasks,
  getTask,
  updateTask,
  ASSIGNEE_TYPES,
  ENTITY_TYPES,
  TASK_TYPES,
};
