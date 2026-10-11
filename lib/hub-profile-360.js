/**
 * Unified Profile 360 — one account identity, multiple personas.
 * Sources of truth remain existing stores (customer-auth, client-portal, staff-credentials).
 * This module links them without inventing fake metrics or a second user registry.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const STORE_PATH = path.join(DATA_DIR, 'profiles-360.json');

const PERSONA_TYPES = ['client', 'employee', 'trainee', 'trainer', 'freelancer', 'member'];
const SELF_SERVABLE = new Set(['client', 'trainee', 'trainer', 'freelancer', 'member']);
const STAFF_ONLY_PERSONAS = new Set(['employee']);

const PERSONA_LABELS = {
  client: 'عميل',
  employee: 'موظف',
  trainee: 'متدرب',
  trainer: 'مدرب',
  freelancer: 'مستقل',
  member: 'عضو',
};

const EMPTY = 'لا توجد بيانات بعد';

function now() {
  return new Date().toISOString();
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function normEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify({ version: 1, profiles: {}, audit: [] }, null, 2));
  }
}

function readStore() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { version: 1, profiles: {}, audit: [] };
  }
}

function writeStore(store) {
  ensureStore();
  const tmp = `${STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, STORE_PATH);
}

function audit(store, entry) {
  store.audit = store.audit || [];
  store.audit.unshift({
    id: uid('aud'),
    at: now(),
    ...entry,
  });
  store.audit = store.audit.slice(0, 500);
}

function blankPersona(type, extras = {}) {
  return {
    type,
    label: PERSONA_LABELS[type] || type,
    status: 'active',
    linkedAt: now(),
    linkedBy: extras.linkedBy || '',
    refs: extras.refs || {},
    meta: extras.meta || {},
  };
}

function blankProfile(email, name = '') {
  const e = normEmail(email);
  return {
    profileId: uid('PRF'),
    accountNo: `ACC-${crypto.createHash('sha1').update(e).digest('hex').slice(0, 8).toUpperCase()}`,
    email: e,
    fullName: name || e,
    phone: '',
    avatarUrl: '',
    status: 'active',
    department: '',
    orgName: '',
    title: '',
    personas: [],
    activePersona: '',
    documents: [],
    publicOptIn: {
      trainer: false,
      freelancer: false,
      member: false,
    },
    createdAt: now(),
    updatedAt: now(),
  };
}

function customerAuth() {
  return require('./hub-customer-auth');
}
function clientPortal() {
  return require('./hub-client-portal');
}
function staffCreds() {
  return require('./hub-staff-credentials');
}
function liveSystems() {
  return require('./hub-live-systems');
}

/** Ensure a profile exists for an email; seed personas from known stores. */
function ensureProfile(email, name = '') {
  const e = normEmail(email);
  if (!e) throw Object.assign(new Error('البريد مطلوب'), { status: 400 });
  const store = readStore();
  let p = store.profiles[e];
  if (!p) {
    p = blankProfile(e, name);
    // Seed client persona if customer account exists
    const acct = customerAuth().findByEmail?.(e);
    if (acct) {
      p.fullName = acct.fullName || acct.name || p.fullName;
      p.phone = acct.phone || '';
      p.personas.push(
        blankPersona('client', {
          linkedBy: 'system',
          refs: { customerId: acct.customerId || acct.id, clientId: acct.customerId || '' },
        })
      );
      p.activePersona = 'client';
    }
    // Seed employee persona only if staff credential exists (never auto-promote)
    const staff = staffCreds().getCredential?.(e);
    if (staff && staff.active !== false) {
      p.fullName = staff.name || p.fullName;
      p.phone = staff.phone || p.phone;
      p.department = staff.department || staff.workplace || '';
      p.orgName = staff.orgName || '';
      p.title = staff.role === 'supreme_leader' ? 'القائد الأعلى' : staff.role === 'chief_engineer' ? 'مهندس رئيس' : 'موظف';
      p.personas.push(
        blankPersona('employee', {
          linkedBy: 'system',
          refs: { employeeNo: staff.employeeNo || '', naioshId: staff.naioshId || staff.accountId || '' },
        })
      );
      if (!p.activePersona) p.activePersona = 'employee';
    }
    if (!p.activePersona && p.personas[0]) p.activePersona = p.personas[0].type;
    store.profiles[e] = p;
    audit(store, { action: 'profile.ensure', email: e, by: 'system', detail: { personas: p.personas.map((x) => x.type) } });
    writeStore(store);
  }
  return p;
}

function getProfileRaw(email) {
  const e = normEmail(email);
  const store = readStore();
  return store.profiles[e] || null;
}

function listProfiles({ q = '', persona = '', limit = 50 } = {}) {
  const store = readStore();
  const needle = String(q || '')
    .trim()
    .toLowerCase();
  let rows = Object.values(store.profiles || {});
  if (persona) rows = rows.filter((p) => (p.personas || []).some((x) => x.type === persona && x.status === 'active'));
  if (needle) {
    rows = rows.filter((p) => {
      const blob = [p.fullName, p.email, p.accountNo, p.phone, ...(p.personas || []).map((x) => x.refs?.employeeNo || x.refs?.customerId || '')]
        .join(' ')
        .toLowerCase();
      return blob.includes(needle);
    });
  }
  rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  return rows.slice(0, Math.min(200, Number(limit) || 50)).map((p) => summary(p));
}

function summary(p) {
  return {
    profileId: p.profileId,
    accountNo: p.accountNo,
    email: p.email,
    fullName: p.fullName,
    phone: p.phone || '',
    avatarUrl: p.avatarUrl || '',
    status: p.status || 'active',
    activePersona: p.activePersona || '',
    personas: (p.personas || []).map((x) => ({
      type: x.type,
      label: x.label || PERSONA_LABELS[x.type],
      status: x.status,
    })),
    updatedAt: p.updatedAt,
  };
}

function canView(session, email) {
  if (!session?.ok) return false;
  if (normEmail(session.email) === normEmail(email)) return true;
  const hubSession = require('./hub-session');
  return (
    hubSession.hasPermission(session, 'profiles.view') ||
    hubSession.hasPermission(session, 'clients.view') ||
    hubSession.hasPermission(session, 'permissions.manage')
  );
}

function canEdit(session, email) {
  if (!session?.ok) return false;
  if (normEmail(session.email) === normEmail(email)) return true;
  const hubSession = require('./hub-session');
  return (
    hubSession.hasPermission(session, 'profiles.edit') ||
    hubSession.hasPermission(session, 'clients.edit') ||
    hubSession.hasPermission(session, 'permissions.manage')
  );
}

function canAssignEmployee(session) {
  const hubSession = require('./hub-session');
  return hubSession.hasPermission(session, 'permissions.manage') || hubSession.hasPermission(session, 'profiles.assign_employee');
}

function canViewFinance(session, email) {
  if (!session?.ok) return false;
  if (normEmail(session.email) === normEmail(email)) return true;
  const hubSession = require('./hub-session');
  return hubSession.hasPermission(session, 'billing.view') || hubSession.hasPermission(session, 'billing.manage');
}

function integrationStatus() {
  const live = liveSystems().LIVE || {};
  return Object.entries(live).map(([code, meta]) => ({
    code,
    label: meta.label || code,
    url: meta.url || null,
    connected: !!meta.url,
    note: meta.url ? 'رابط نظام حي متاح — البيانات التفصيلية عبر تكامل موثّق عند التفعيل' : EMPTY,
  }));
}

function buildClientSection(email, { includeFinance }) {
  const e = normEmail(email);
  const acct = customerAuth().findByEmail?.(e);
  let portal = null;
  try {
    const cp = clientPortal();
    const store = cp.readStore();
    if (store.clients?.[e] || acct) {
      portal = cp.ensureClient(store, e, acct?.fullName || acct?.name || '');
    }
  } catch {
    portal = null;
  }
  if (!acct && !portal) {
    return { available: false, empty: EMPTY, reason: 'لا يوجد حساب عميل مرتبط بهذا البريد' };
  }
  const systems = Array.isArray(portal?.systems) ? portal.systems : [];
  const orders = Array.isArray(portal?.orders) ? portal.orders : [];
  const invoices = Array.isArray(portal?.invoices) ? portal.invoices : [];
  const tickets = Array.isArray(portal?.tickets) ? portal.tickets : [];
  const subscriptions = Array.isArray(portal?.subscriptions) ? portal.subscriptions : [];
  const serviceRequests = Array.isArray(portal?.serviceRequests) ? portal.serviceRequests : [];
  const out = {
    available: true,
    clientId: portal?.clientId || acct?.customerId || '',
    customerId: acct?.customerId || portal?.clientId || '',
    status: portal?.status || acct?.status || 'active',
    accountLevel: portal?.accountLevel || '',
    company: portal?.company || '',
    city: portal?.city || '',
    country: portal?.country || '',
    counts: {
      systems: systems.length,
      orders: orders.length,
      invoices: invoices.length,
      tickets: tickets.length,
      subscriptions: subscriptions.length,
      serviceRequests: serviceRequests.length,
    },
    systems: systems.length
      ? systems.map((s) => ({
          code: s.code || '',
          name: s.name || s.code || '',
          status: s.status || '',
          plan: s.plan || '',
        }))
      : EMPTY,
    orders: orders.length
      ? orders.slice(0, 20).map((o) => ({
          id: o.id || o.orderId || '',
          status: o.status || '',
          total: o.total ?? o.amount ?? null,
          createdAt: o.createdAt || o.at || '',
        }))
      : EMPTY,
    tickets: tickets.length
      ? tickets.slice(0, 20).map((t) => ({
          id: t.id || '',
          subject: t.subject || t.title || '',
          status: t.status || '',
          createdAt: t.createdAt || '',
        }))
      : EMPTY,
    subscriptions: subscriptions.length
      ? subscriptions.slice(0, 20).map((s) => ({
          id: s.id || '',
          name: s.name || s.plan || '',
          status: s.status || '',
        }))
      : EMPTY,
    serviceRequests: serviceRequests.length
      ? serviceRequests.slice(0, 20).map((r) => ({
          id: r.id || '',
          title: r.title || r.type || '',
          status: r.status || '',
        }))
      : EMPTY,
  };
  if (includeFinance) {
    out.invoices = invoices.length
      ? invoices.slice(0, 20).map((i) => ({
          id: i.id || '',
          status: i.status || '',
          amount: i.amount ?? i.total ?? null,
          createdAt: i.createdAt || '',
        }))
      : EMPTY;
    out.wallet = portal?.wallet
      ? { paid: portal.wallet.paid ?? 0, free: portal.wallet.free ?? 0, total: portal.wallet.total ?? 0 }
      : EMPTY;
  } else {
    out.invoices = { restricted: true, message: 'البيانات المالية متاحة لصاحب الحساب أو المخوّلين فقط' };
    out.wallet = { restricted: true, message: 'البيانات المالية متاحة لصاحب الحساب أو المخوّلين فقط' };
  }
  return out;
}

function buildEmployeeSection(email, profile, { includeFinance }) {
  const e = normEmail(email);
  const staff = staffCreds().getCredential?.(e);
  const persona = (profile.personas || []).find((x) => x.type === 'employee' && x.status === 'active');
  if (!staff && !persona) {
    return { available: false, empty: EMPTY, reason: 'لا يوجد تعيين موظف مرتبط — التعيين يتم عبر رقم الموظف والصلاحيات المعتمدة فقط' };
  }
  const employeeNo = staff?.employeeNo || persona?.refs?.employeeNo || '';
  const out = {
    available: true,
    employeeNo,
    naioshId: staff?.naioshId || staff?.accountId || persona?.refs?.naioshId || '',
    role: staff?.role || '',
    department: staff?.department || staff?.workplace || profile.department || '',
    workplace: staff?.workplace || '',
    orgName: staff?.orgName || profile.orgName || '',
    affiliationKind: staff?.affiliationKind || '',
    assignmentStatus: staff?.assignmentStatus || (staff?.active === false ? 'inactive' : 'active'),
    permissionsCount: Array.isArray(staff?.permissions) ? staff.permissions.length : null,
    tasks: EMPTY,
    attendance: EMPTY,
    leaves: EMPTY,
    performance: EMPTY,
    note: 'المهام والحضور والإجازات ومؤشرات الأداء تُعرض عند اتصال أنظمة الموارد البشرية — لا تُعرض قيم تجريبية.',
  };
  if (includeFinance) {
    out.payroll = EMPTY;
    out.financeNote = 'لا تتوفر بيانات رواتب من نظام مالي متصل حاليًا.';
  } else {
    out.payroll = { restricted: true, message: 'بيانات الرواتب محجوبة عن غير المخوّلين' };
  }
  return out;
}

function buildLearningSection(type, persona) {
  if (!persona || persona.status !== 'active') {
    return { available: false, empty: EMPTY, reason: `صفة ${PERSONA_LABELS[type] || type} غير مفعّلة` };
  }
  const meta = persona.meta || {};
  const connected = !!meta.systemConnected;
  if (type === 'trainee') {
    return {
      available: true,
      system: 'ACADEMY',
      connected,
      courses: Array.isArray(meta.courses) && meta.courses.length ? meta.courses : EMPTY,
      progress: meta.progress != null ? meta.progress : EMPTY,
      schedule: Array.isArray(meta.schedule) && meta.schedule.length ? meta.schedule : EMPTY,
      exams: Array.isArray(meta.exams) && meta.exams.length ? meta.exams : EMPTY,
      certificates: Array.isArray(meta.certificates) && meta.certificates.length ? meta.certificates : EMPTY,
      note: connected
        ? null
        : 'الأكاديمية غير مزامَنة بعد عبر واجهة تكامل — أضف الدورات يدويًا عند الربط أو انتظر التكامل.',
    };
  }
  if (type === 'trainer') {
    return {
      available: true,
      specialties: Array.isArray(meta.specialties) && meta.specialties.length ? meta.specialties : EMPTY,
      courses: Array.isArray(meta.courses) && meta.courses.length ? meta.courses : EMPTY,
      trainees: Array.isArray(meta.trainees) && meta.trainees.length ? meta.trainees : EMPTY,
      schedule: Array.isArray(meta.schedule) && meta.schedule.length ? meta.schedule : EMPTY,
      ratings: Array.isArray(meta.ratings) && meta.ratings.length ? meta.ratings : EMPTY,
      materials: Array.isArray(meta.materials) && meta.materials.length ? meta.materials : EMPTY,
      note: 'بيانات التدريب تُعرض من السجلات المرتبطة فقط — بدون مؤشرات مصطنعة.',
    };
  }
  return { available: false, empty: EMPTY };
}

function buildFreelancerSection(persona) {
  if (!persona || persona.status !== 'active') {
    return { available: false, empty: EMPTY, reason: 'صفة المستقل غير مفعّلة' };
  }
  const meta = persona.meta || {};
  return {
    available: true,
    specialty: meta.specialty || EMPTY,
    skills: Array.isArray(meta.skills) && meta.skills.length ? meta.skills : EMPTY,
    portfolio: Array.isArray(meta.portfolio) && meta.portfolio.length ? meta.portfolio : EMPTY,
    projects: Array.isArray(meta.projects) && meta.projects.length ? meta.projects : EMPTY,
    contracts: Array.isArray(meta.contracts) && meta.contracts.length ? meta.contracts : EMPTY,
    tasks: Array.isArray(meta.tasks) && meta.tasks.length ? meta.tasks : EMPTY,
    dues: meta.dues != null ? meta.dues : EMPTY,
  };
}

function buildMemberSection(persona) {
  if (!persona || persona.status !== 'active') {
    return { available: false, empty: EMPTY, reason: 'صفة العضوية غير مفعّلة' };
  }
  const meta = persona.meta || {};
  return {
    available: true,
    membershipId: meta.membershipId || persona.refs?.membershipId || EMPTY,
    tier: meta.tier || EMPTY,
    status: persona.status || EMPTY,
    services: Array.isArray(meta.services) && meta.services.length ? meta.services : EMPTY,
    systems: Array.isArray(meta.systems) && meta.systems.length ? meta.systems : EMPTY,
    activity: Array.isArray(meta.activity) && meta.activity.length ? meta.activity : EMPTY,
    subscriptions: Array.isArray(meta.subscriptions) && meta.subscriptions.length ? meta.subscriptions : EMPTY,
  };
}

function composeView(email, session, { persona } = {}) {
  const e = normEmail(email);
  if (!canView(session, e)) {
    const err = new Error('ليس لديك صلاحية عرض هذا الملف');
    err.status = 403;
    throw err;
  }
  const profile = ensureProfile(e);
  const includeFinance = canViewFinance(session, e);
  const isOwner = normEmail(session.email) === e;
  const active = persona || profile.activePersona || (profile.personas[0] && profile.personas[0].type) || '';
  const personaMap = Object.fromEntries((profile.personas || []).map((x) => [x.type, x]));

  const header = {
    profileId: profile.profileId,
    accountNo: profile.accountNo,
    email: profile.email,
    fullName: profile.fullName,
    phone: profile.phone || '',
    avatarUrl: profile.avatarUrl || '',
    status: profile.status || 'active',
    title: profile.title || (personaMap[active] && PERSONA_LABELS[active]) || '',
    department: profile.department || '',
    orgName: profile.orgName || '',
    activePersona: active,
    personaLabel: PERSONA_LABELS[active] || active || '',
    roleRef:
      active === 'client'
        ? personaMap.client?.refs?.customerId || personaMap.client?.refs?.clientId || ''
        : active === 'employee'
          ? personaMap.employee?.refs?.employeeNo || ''
          : active === 'member'
            ? personaMap.member?.refs?.membershipId || personaMap.member?.meta?.membershipId || ''
            : profile.accountNo,
    canEdit: canEdit(session, e),
    isOwner,
    personas: (profile.personas || []).map((x) => ({
      type: x.type,
      label: x.label || PERSONA_LABELS[x.type],
      status: x.status,
      active: x.type === active,
    })),
  };

  const sections = {
    client: buildClientSection(e, { includeFinance }),
    employee: buildEmployeeSection(e, profile, { includeFinance }),
    trainee: buildLearningSection('trainee', personaMap.trainee),
    trainer: buildLearningSection('trainer', personaMap.trainer),
    freelancer: buildFreelancerSection(personaMap.freelancer),
    member: buildMemberSection(personaMap.member),
  };

  return {
    ok: true,
    header,
    sections,
    documents: Array.isArray(profile.documents) && profile.documents.length ? profile.documents : EMPTY,
    integrations: integrationStatus(),
    emptyLabel: EMPTY,
    privacy: {
      default: 'private',
      publicOptIn: profile.publicOptIn || {},
      financeVisible: includeFinance,
    },
  };
}

function updateProfile(email, patch, session) {
  const e = normEmail(email);
  if (!canEdit(session, e)) {
    const err = new Error('ليس لديك صلاحية تعديل هذا الملف');
    err.status = 403;
    throw err;
  }
  const store = readStore();
  const p = store.profiles[e] || ensureProfile(e);
  const next = store.profiles[e] || p;
  const allowed = ['fullName', 'phone', 'avatarUrl', 'department', 'orgName', 'title'];
  const changes = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) {
      changes[k] = { from: next[k] || '', to: patch[k] };
      next[k] = String(patch[k] ?? '');
    }
  }
  if (patch.publicOptIn && typeof patch.publicOptIn === 'object') {
    next.publicOptIn = { ...(next.publicOptIn || {}), ...patch.publicOptIn };
    changes.publicOptIn = next.publicOptIn;
  }
  next.updatedAt = now();
  store.profiles[e] = next;
  audit(store, { action: 'profile.update', email: e, by: session.email, detail: changes });
  writeStore(store);

  // Mirror safe fields into client portal store when present
  try {
    if (patch.fullName !== undefined || patch.phone !== undefined) {
      const portal = clientPortal();
      const store = portal.readStore();
      if (store.clients?.[e]) {
        const c = portal.ensureClient(store, e, next.fullName);
        if (patch.fullName !== undefined) c.name = next.fullName;
        if (patch.phone !== undefined) c.phone = next.phone;
        c.updatedAt = now();
        portal.writeStore(store);
      }
    }
  } catch {
    /* best-effort mirror */
  }

  return summary(next);
}

function setActivePersona(email, type, session) {
  const e = normEmail(email);
  if (normEmail(session.email) !== e && !canEdit(session, e)) {
    const err = new Error('ليس لديك صلاحية تبديل الصفة');
    err.status = 403;
    throw err;
  }
  const store = readStore();
  const p = store.profiles[e] || ensureProfile(e);
  const persona = (store.profiles[e].personas || []).find((x) => x.type === type && x.status === 'active');
  if (!persona) {
    const err = new Error('الصفة غير متاحة على هذا الحساب');
    err.status = 400;
    throw err;
  }
  store.profiles[e].activePersona = type;
  store.profiles[e].updatedAt = now();
  audit(store, { action: 'persona.activate', email: e, by: session.email, detail: { type } });
  writeStore(store);
  return summary(store.profiles[e]);
}

function attachPersona(email, type, session, { refs = {}, meta = {}, forceStaff = false } = {}) {
  const e = normEmail(email);
  const t = String(type || '').toLowerCase();
  if (!PERSONA_TYPES.includes(t)) {
    const err = new Error('نوع صفة غير معروف');
    err.status = 400;
    throw err;
  }
  const isOwner = normEmail(session.email) === e;
  if (STAFF_ONLY_PERSONAS.has(t)) {
    if (!canAssignEmployee(session)) {
      const err = new Error('تعيين صفة الموظف يتطلب صلاحية إدارية معتمدة — لا يمكن الترقية الذاتية');
      err.status = 403;
      throw err;
    }
    const employeeNo = String(refs.employeeNo || '').trim();
    if (!employeeNo) {
      const err = new Error('رقم الموظف مطلوب لربط صفة الموظف');
      err.status = 400;
      throw err;
    }
    const staff = staffCreds().getCredential?.(e);
    if (!staff || String(staff.employeeNo || '') !== employeeNo) {
      // Allow linking only when credential exists with matching employee number
      const err = new Error('لا يوجد حساب موظف معتمد بهذا البريد ورقم الموظف — أنشئ التعيين من إدارة الإداريين أولًا');
      err.status = 400;
      throw err;
    }
  } else if (!SELF_SERVABLE.has(t)) {
    const err = new Error('صفة غير مسموحة');
    err.status = 400;
    throw err;
  } else if (!isOwner && !canEdit(session, e) && !forceStaff) {
    const err = new Error('ليس لديك صلاحية ربط هذه الصفة');
    err.status = 403;
    throw err;
  }

  // Client persona: ensure customer exists
  if (t === 'client') {
    const acct = customerAuth().findByEmail?.(e);
    if (!acct && !isOwner) {
      const err = new Error('لا يوجد حساب عميل لهذا البريد');
      err.status = 400;
      throw err;
    }
    if (acct) {
      refs.customerId = acct.customerId || acct.id;
      refs.clientId = acct.customerId || '';
    }
  }

  const store = readStore();
  ensureProfile(e);
  const p = store.profiles[e];
  const existing = (p.personas || []).find((x) => x.type === t);
  if (existing) {
    existing.status = 'active';
    existing.refs = { ...(existing.refs || {}), ...refs };
    existing.meta = { ...(existing.meta || {}), ...meta };
    existing.linkedAt = now();
    existing.linkedBy = session.email;
  } else {
    p.personas.push(
      blankPersona(t, {
        linkedBy: session.email,
        refs,
        meta,
      })
    );
  }
  if (!p.activePersona) p.activePersona = t;
  p.updatedAt = now();
  audit(store, { action: 'persona.attach', email: e, by: session.email, detail: { type: t, refs } });
  writeStore(store);
  return summary(p);
}

function detachPersona(email, type, session) {
  const e = normEmail(email);
  const t = String(type || '').toLowerCase();
  if (t === 'employee' && !canAssignEmployee(session)) {
    const err = new Error('إلغاء صفة الموظف يتطلب صلاحية إدارية');
    err.status = 403;
    throw err;
  }
  if (normEmail(session.email) !== e && !canEdit(session, e)) {
    const err = new Error('ليس لديك صلاحية');
    err.status = 403;
    throw err;
  }
  const store = readStore();
  const p = store.profiles[e];
  if (!p) {
    const err = new Error('الملف غير موجود');
    err.status = 404;
    throw err;
  }
  const persona = (p.personas || []).find((x) => x.type === t);
  if (!persona) {
    const err = new Error('الصفة غير موجودة');
    err.status = 404;
    throw err;
  }
  persona.status = 'inactive';
  if (p.activePersona === t) {
    const next = (p.personas || []).find((x) => x.status === 'active' && x.type !== t);
    p.activePersona = next ? next.type : '';
  }
  p.updatedAt = now();
  audit(store, { action: 'persona.detach', email: e, by: session.email, detail: { type: t } });
  writeStore(store);
  return summary(p);
}

function updatePersonaMeta(email, type, metaPatch, session) {
  const e = normEmail(email);
  if (normEmail(session.email) !== e && !canEdit(session, e)) {
    const err = new Error('ليس لديك صلاحية');
    err.status = 403;
    throw err;
  }
  if (type === 'employee' && normEmail(session.email) === e && !canAssignEmployee(session)) {
    // owner cannot escalate employee meta arbitrarily beyond safe fields — block employee meta self-edit of refs
  }
  const store = readStore();
  ensureProfile(e);
  const p = store.profiles[e];
  let persona = (p.personas || []).find((x) => x.type === type);
  if (!persona) {
    // self-serve create for allowed types
    attachPersona(e, type, session, { meta: metaPatch });
    return composeView(e, session, { persona: type });
  }
  const safe = { ...(metaPatch || {}) };
  // Never allow forging finance/payroll via meta
  delete safe.payroll;
  delete safe.salary;
  persona.meta = { ...(persona.meta || {}), ...safe };
  persona.status = 'active';
  p.updatedAt = now();
  audit(store, { action: 'persona.meta', email: e, by: session.email, detail: { type, keys: Object.keys(safe) } });
  writeStore(store);
  return summary(p);
}

function addDocument(email, doc, session) {
  const e = normEmail(email);
  if (!canEdit(session, e)) {
    const err = new Error('ليس لديك صلاحية إضافة مرفقات');
    err.status = 403;
    throw err;
  }
  const store = readStore();
  ensureProfile(e);
  const p = store.profiles[e];
  const item = {
    id: uid('doc'),
    kind: String(doc.kind || 'file'),
    name: String(doc.name || 'مرفق'),
    url: String(doc.url || ''),
    mime: String(doc.mime || ''),
    persona: String(doc.persona || ''),
    uploadedAt: now(),
    uploadedBy: session.email,
  };
  if (!item.url) {
    const err = new Error('رابط المرفق مطلوب');
    err.status = 400;
    throw err;
  }
  p.documents = p.documents || [];
  p.documents.unshift(item);
  p.updatedAt = now();
  audit(store, { action: 'document.add', email: e, by: session.email, detail: { id: item.id, kind: item.kind } });
  writeStore(store);
  return item;
}

function removeDocument(email, docId, session) {
  const e = normEmail(email);
  if (!canEdit(session, e)) {
    const err = new Error('ليس لديك صلاحية حذف المرفق');
    err.status = 403;
    throw err;
  }
  const store = readStore();
  const p = store.profiles[e];
  if (!p) {
    const err = new Error('الملف غير موجود');
    err.status = 404;
    throw err;
  }
  const before = (p.documents || []).length;
  p.documents = (p.documents || []).filter((d) => d.id !== docId);
  if (p.documents.length === before) {
    const err = new Error('المرفق غير موجود');
    err.status = 404;
    throw err;
  }
  p.updatedAt = now();
  audit(store, { action: 'document.remove', email: e, by: session.email, detail: { id: docId } });
  writeStore(store);
  return { ok: true };
}

function getAudit(email, session, { limit = 50 } = {}) {
  const e = normEmail(email);
  if (!canView(session, e)) {
    const err = new Error('ليس لديك صلاحية');
    err.status = 403;
    throw err;
  }
  const store = readStore();
  return (store.audit || []).filter((a) => a.email === e).slice(0, Math.min(200, Number(limit) || 50));
}

/** Sync hooks after register/login — idempotent */
function onAccountTouch(email, name) {
  try {
    ensureProfile(email, name);
    const store = readStore();
    const e = normEmail(email);
    const p = store.profiles[e];
    if (!p) return;
    const acct = customerAuth().findByEmail?.(e);
    if (acct && !(p.personas || []).some((x) => x.type === 'client' && x.status === 'active')) {
      p.personas.push(
        blankPersona('client', {
          linkedBy: 'system',
          refs: { customerId: acct.customerId || acct.id, clientId: acct.customerId || '' },
        })
      );
      if (!p.activePersona) p.activePersona = 'client';
      p.updatedAt = now();
      writeStore(store);
    }
  } catch {
    /* ignore */
  }
}

async function handleApi(req, res, pathname, { sendJson, readBody, requireAuth, requireStaff }) {
  const method = req.method;

  // GET /api/hub/profiles/me
  if (pathname === '/api/hub/profiles/me' && method === 'GET') {
    const session = requireAuth(req, res);
    if (!session) return true;
    try {
      onAccountTouch(session.email, session.name);
      const url = new URL(req.url, 'http://local');
      const persona = url.searchParams.get('persona') || '';
      const view = composeView(session.email, session, { persona });
      sendJson(res, 200, view);
    } catch (err) {
      sendJson(res, err.status || 500, { ok: false, error: err.message || 'فشل تحميل الملف' });
    }
    return true;
  }

  // PATCH /api/hub/profiles/me
  if (pathname === '/api/hub/profiles/me' && method === 'PATCH') {
    const session = requireAuth(req, res);
    if (!session) return true;
    try {
      const body = await readBody(req);
      const updated = updateProfile(session.email, body || {}, session);
      sendJson(res, 200, { ok: true, profile: updated });
    } catch (err) {
      sendJson(res, err.status || 500, { ok: false, error: err.message });
    }
    return true;
  }

  // POST /api/hub/profiles/me/persona
  if (pathname === '/api/hub/profiles/me/persona' && method === 'POST') {
    const session = requireAuth(req, res);
    if (!session) return true;
    try {
      const body = await readBody(req);
      const type = body?.type || body?.persona;
      if (body?.activate) {
        const updated = setActivePersona(session.email, type, session);
        sendJson(res, 200, { ok: true, profile: updated });
        return true;
      }
      if (STAFF_ONLY_PERSONAS.has(String(type || '').toLowerCase())) {
        sendJson(res, 403, { ok: false, error: 'لا يمكن الترقية الذاتية إلى موظف — استخدم مسار التعيين الإداري' });
        return true;
      }
      const updated = attachPersona(session.email, type, session, { refs: body?.refs || {}, meta: body?.meta || {} });
      sendJson(res, 200, { ok: true, profile: updated });
    } catch (err) {
      sendJson(res, err.status || 500, { ok: false, error: err.message });
    }
    return true;
  }

  // PATCH /api/hub/profiles/me/persona/:type
  {
    const m = pathname.match(/^\/api\/hub\/profiles\/me\/persona\/([a-z]+)$/);
    if (m && method === 'PATCH') {
      const session = requireAuth(req, res);
      if (!session) return true;
      try {
        const body = await readBody(req);
        const updated = updatePersonaMeta(session.email, m[1], body?.meta || body || {}, session);
        sendJson(res, 200, { ok: true, profile: updated });
      } catch (err) {
        sendJson(res, err.status || 500, { ok: false, error: err.message });
      }
      return true;
    }
  }

  // POST /api/hub/profiles/me/documents
  if (pathname === '/api/hub/profiles/me/documents' && method === 'POST') {
    const session = requireAuth(req, res);
    if (!session) return true;
    try {
      const body = await readBody(req);
      const doc = addDocument(session.email, body || {}, session);
      sendJson(res, 201, { ok: true, document: doc });
    } catch (err) {
      sendJson(res, err.status || 500, { ok: false, error: err.message });
    }
    return true;
  }

  // DELETE /api/hub/profiles/me/documents/:id
  {
    const m = pathname.match(/^\/api\/hub\/profiles\/me\/documents\/([^/]+)$/);
    if (m && method === 'DELETE') {
      const session = requireAuth(req, res);
      if (!session) return true;
      try {
        removeDocument(session.email, decodeURIComponent(m[1]), session);
        sendJson(res, 200, { ok: true });
      } catch (err) {
        sendJson(res, err.status || 500, { ok: false, error: err.message });
      }
      return true;
    }
  }

  // Admin list
  if (pathname === '/api/hub/profiles' && method === 'GET') {
    const session = requireStaff(req, res, 'clients.view');
    if (!session) return true;
    const url = new URL(req.url, 'http://local');
    sendJson(res, 200, {
      ok: true,
      items: listProfiles({
        q: url.searchParams.get('q') || '',
        persona: url.searchParams.get('persona') || '',
        limit: url.searchParams.get('limit') || 50,
      }),
    });
    return true;
  }

  // Admin get by email
  {
    const m = pathname.match(/^\/api\/hub\/profiles\/by-email\/([^/]+)$/);
    if (m && method === 'GET') {
      const session = requireStaff(req, res, 'clients.view');
      if (!session) return true;
      try {
        const email = decodeURIComponent(m[1]);
        const url = new URL(req.url, 'http://local');
        const view = composeView(email, session, { persona: url.searchParams.get('persona') || '' });
        sendJson(res, 200, view);
      } catch (err) {
        sendJson(res, err.status || 500, { ok: false, error: err.message });
      }
      return true;
    }
  }

  // Admin attach persona
  {
    const m = pathname.match(/^\/api\/hub\/profiles\/by-email\/([^/]+)\/persona$/);
    if (m && method === 'POST') {
      const session = requireStaff(req, res, 'clients.edit');
      if (!session) return true;
      try {
        const email = decodeURIComponent(m[1]);
        const body = await readBody(req);
        const type = body?.type || body?.persona;
        if (String(type).toLowerCase() === 'employee') {
          const s = requireStaff(req, res, 'permissions.manage');
          if (!s) return true;
        }
        const updated = attachPersona(email, type, session, {
          refs: body?.refs || {},
          meta: body?.meta || {},
          forceStaff: true,
        });
        sendJson(res, 200, { ok: true, profile: updated });
      } catch (err) {
        sendJson(res, err.status || 500, { ok: false, error: err.message });
      }
      return true;
    }
  }

  // Admin detach
  {
    const m = pathname.match(/^\/api\/hub\/profiles\/by-email\/([^/]+)\/persona\/([a-z]+)$/);
    if (m && method === 'DELETE') {
      const session = requireStaff(req, res, 'clients.edit');
      if (!session) return true;
      try {
        const email = decodeURIComponent(m[1]);
        const updated = detachPersona(email, m[2], session);
        sendJson(res, 200, { ok: true, profile: updated });
      } catch (err) {
        sendJson(res, err.status || 500, { ok: false, error: err.message });
      }
      return true;
    }
  }

  // Admin patch profile
  {
    const m = pathname.match(/^\/api\/hub\/profiles\/by-email\/([^/]+)$/);
    if (m && method === 'PATCH') {
      const session = requireStaff(req, res, 'clients.edit');
      if (!session) return true;
      try {
        const email = decodeURIComponent(m[1]);
        const body = await readBody(req);
        const updated = updateProfile(email, body || {}, session);
        sendJson(res, 200, { ok: true, profile: updated });
      } catch (err) {
        sendJson(res, err.status || 500, { ok: false, error: err.message });
      }
      return true;
    }
  }

  // Audit
  {
    const m = pathname.match(/^\/api\/hub\/profiles\/by-email\/([^/]+)\/audit$/);
    if (m && method === 'GET') {
      const session = requireStaff(req, res, 'clients.view');
      if (!session) return true;
      try {
        const email = decodeURIComponent(m[1]);
        sendJson(res, 200, { ok: true, items: getAudit(email, session) });
      } catch (err) {
        sendJson(res, err.status || 500, { ok: false, error: err.message });
      }
      return true;
    }
  }

  // Meta
  if (pathname === '/api/hub/profiles/meta' && method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      personaTypes: PERSONA_TYPES.map((t) => ({
        type: t,
        label: PERSONA_LABELS[t],
        selfServe: SELF_SERVABLE.has(t),
        staffOnly: STAFF_ONLY_PERSONAS.has(t),
      })),
      emptyLabel: EMPTY,
    });
    return true;
  }

  return false;
}

module.exports = {
  PERSONA_TYPES,
  PERSONA_LABELS,
  EMPTY,
  ensureProfile,
  getProfileRaw,
  listProfiles,
  composeView,
  updateProfile,
  setActivePersona,
  attachPersona,
  detachPersona,
  updatePersonaMeta,
  addDocument,
  removeDocument,
  getAudit,
  onAccountTouch,
  canView,
  canEdit,
  canAssignEmployee,
  canViewFinance,
  handleApi,
  summary,
};
