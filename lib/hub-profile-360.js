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

let dbWriteQueue = Promise.resolve();
let storeLoadedFromDb = false;

async function loadStoreFromDb() {
  try {
    const { getDatabaseUrl, withClient } = require('../db/migrate');
    if (!getDatabaseUrl()) return null;
    return await withClient(async (client) => {
      const r = await client.query(`SELECT value FROM hub_meta WHERE key = $1 LIMIT 1`, ['profiles-360']);
      if (!r.rows[0]?.value) return null;
      const value = r.rows[0].value;
      return typeof value === 'string' ? JSON.parse(value) : value;
    });
  } catch (err) {
    console.warn('[hub-profile-360] DB load skipped:', err.message);
    return null;
  }
}

function persistStoreToDb(store) {
  dbWriteQueue = dbWriteQueue
    .then(async () => {
      try {
        const { getDatabaseUrl, withClient } = require('../db/migrate');
        if (!getDatabaseUrl()) return;
        const payload = {
          version: store.version || 1,
          profiles: store.profiles || {},
          audit: Array.isArray(store.audit) ? store.audit.slice(0, 200) : [],
          updatedAt: now(),
        };
        await withClient(async (client) => {
          await client.query(
            `INSERT INTO hub_meta (key, value, updated_at)
             VALUES ($1, $2::jsonb, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            ['profiles-360', JSON.stringify(payload)]
          );
        });
      } catch (err) {
        console.warn('[hub-profile-360] DB persist skipped:', err.message);
      }
    })
    .catch(() => {});
  return dbWriteQueue;
}

function writeStore(store) {
  ensureStore();
  const tmp = `${STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, STORE_PATH);
  persistStoreToDb(store);
}

function readStore() {
  ensureStore();
  if (!storeLoadedFromDb) {
    storeLoadedFromDb = true;
    // Best-effort sync from Postgres on first read (multi-replica / redeploy recovery)
    loadStoreFromDb()
      .then((fromDb) => {
        if (!fromDb || !fromDb.profiles) return;
        try {
          const local = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
          const localUpdated = String(local.updatedAt || '');
          const dbUpdated = String(fromDb.updatedAt || '');
          const localCount = Object.keys(local.profiles || {}).length;
          const dbCount = Object.keys(fromDb.profiles || {}).length;
          if (dbCount > localCount || (dbUpdated && dbUpdated > localUpdated)) {
            fs.writeFileSync(STORE_PATH, JSON.stringify(fromDb, null, 2));
          }
        } catch {
          fs.writeFileSync(STORE_PATH, JSON.stringify(fromDb, null, 2));
        }
      })
      .catch(() => {});
  }
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { version: 1, profiles: {}, audit: [] };
  }
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

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_MIME = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function publicAvatarPath(accountNo, version) {
  const acc = String(accountNo || '').trim().toUpperCase();
  const v = version ? `?v=${encodeURIComponent(String(version))}` : '';
  return `/api/hub/avatars/${encodeURIComponent(acc)}${v}`;
}

function sniffImageMime(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return '';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return '';
}

async function persistAvatarBlob({ email, accountNo, mime, buffer }) {
  const e = normEmail(email);
  try {
    const { getDatabaseUrl, withClient } = require('../db/migrate');
    if (!getDatabaseUrl()) return { ok: false, reason: 'no_db' };
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO hub_profile_avatars (email, account_no, mime, bytes, size_bytes, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (email) DO UPDATE SET
           account_no = EXCLUDED.account_no,
           mime = EXCLUDED.mime,
           bytes = EXCLUDED.bytes,
           size_bytes = EXCLUDED.size_bytes,
           updated_at = NOW()`,
        [e, String(accountNo || ''), mime, buffer, buffer.length]
      );
      await client.query(
        `INSERT INTO hub_profiles (profile_id, account_no, email, full_name, avatar_url, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (email) DO UPDATE SET
           avatar_url = EXCLUDED.avatar_url,
           account_no = COALESCE(NULLIF(EXCLUDED.account_no, ''), hub_profiles.account_no),
           updated_at = NOW()`,
        [
          String(accountNo || e),
          String(accountNo || `ACC-${crypto.createHash('sha1').update(e).digest('hex').slice(0, 8).toUpperCase()}`),
          e,
          e,
          publicAvatarPath(accountNo),
        ]
      );
    });
    return { ok: true };
  } catch (err) {
    console.warn('[hub-profile-360] avatar DB persist skipped:', err.message);
    return { ok: false, reason: err.message };
  }
}

async function loadAvatarBlobByAccount(accountNo) {
  const acc = String(accountNo || '').trim().toUpperCase();
  if (!acc) return null;
  try {
    const { getDatabaseUrl, withClient } = require('../db/migrate');
    if (!getDatabaseUrl()) return null;
    return await withClient(async (client) => {
      const r = await client.query(
        `SELECT email, account_no, mime, bytes, size_bytes, updated_at
         FROM hub_profile_avatars WHERE upper(account_no) = $1 LIMIT 1`,
        [acc]
      );
      return r.rows[0] || null;
    });
  } catch (err) {
    console.warn('[hub-profile-360] avatar DB load skipped:', err.message);
    return null;
  }
}

function mirrorAvatarToPortal(email, avatarUrl, fullName) {
  try {
    const portal = clientPortal();
    const store = portal.readStore();
    const e = normEmail(email);
    if (store.clients?.[e] || customerAuth().findByEmail?.(e)) {
      const c = portal.ensureClient(store, e, fullName || e);
      c.avatarUrl = avatarUrl || '';
      c.updatedAt = now();
      portal.writeStore(store);
    }
  } catch {
    /* best-effort */
  }
}

function readRequestBuffer(req, { maxBytes = AVATAR_MAX_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let received = 0;
    req.on('data', (chunk) => {
      received += chunk.length;
      if (received > maxBytes) {
        req.destroy();
        const err = new Error(`حجم الصورة أكبر من ${Math.round(maxBytes / 1024 / 1024)} ميجابايت`);
        err.status = 413;
        reject(err);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function saveAvatarForEmail(email, buffer, { mimeHint = '', session } = {}) {
  const e = normEmail(email);
  if (!session || !canEdit(session, e)) {
    const err = new Error('ليس لديك صلاحية تعديل صورة هذا الحساب');
    err.status = 403;
    throw err;
  }
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    const err = new Error('لم يتم استلام بيانات الصورة');
    err.status = 400;
    throw err;
  }
  if (buffer.length > AVATAR_MAX_BYTES) {
    const err = new Error('حجم الصورة أكبر من 5 ميجابايت — صغّرها ثم أعد المحاولة');
    err.status = 413;
    throw err;
  }
  const sniffed = sniffImageMime(buffer);
  const declared = String(mimeHint || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  const mime = sniffed || (AVATAR_MIME[declared] ? declared : '');
  if (!mime || !AVATAR_MIME[mime]) {
    const err = new Error('يُسمح فقط بصور JPG أو PNG أو WEBP');
    err.status = 400;
    throw err;
  }

  const hubUploads = require('./hub-uploads');
  hubUploads.ensureUploadDir();
  const profile = ensureProfile(e);
  const ext = AVATAR_MIME[mime];
  const id = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  const dest = path.join(hubUploads.UPLOAD_DIR, id);
  fs.writeFileSync(dest, buffer);

  const version = Date.now().toString(36);
  const avatarUrl = publicAvatarPath(profile.accountNo, version);
  const diskUrl = `${hubUploads.PUBLIC_PREFIX}/${id}`;

  const store = readStore();
  const row = store.profiles[e] || ensureProfile(e);
  row.avatarUrl = avatarUrl;
  row.avatarDiskUrl = diskUrl;
  row.avatarMime = mime;
  row.avatarUpdatedAt = now();
  row.updatedAt = now();
  store.profiles[e] = row;
  audit(store, {
    action: 'profile.avatar',
    email: e,
    by: session.email,
    detail: { avatarUrl, diskUrl, mime, size: buffer.length },
  });
  writeStore(store);

  await persistAvatarBlob({ email: e, accountNo: row.accountNo, mime, buffer });
  mirrorAvatarToPortal(e, avatarUrl, row.fullName);

  return {
    ok: true,
    avatarUrl,
    diskUrl,
    mime,
    size: buffer.length,
    accountNo: row.accountNo,
    profile: row,
  };
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
    city: '',
    country: '',
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
  let created = false;
  if (!p) {
    p = blankProfile(e, name);
    created = true;
  }
  let dirty = created;

  // Seed / refresh from customer account (never invent metrics)
  const acct = customerAuth().findByEmail?.(e);
  if (acct) {
    if (acct.fullName || acct.name) {
      if (created || !p.fullName || p.fullName === e) {
        p.fullName = acct.fullName || acct.name || p.fullName;
        dirty = true;
      }
    }
    if (acct.phone && acct.phone !== p.phone) {
      p.phone = acct.phone;
      dirty = true;
    }
    const city = acct.city || '';
    const country = acct.governorate || acct.country || '';
    if (city && city !== p.city) {
      p.city = city;
      dirty = true;
    }
    if (country && country !== p.country) {
      p.country = country;
      dirty = true;
    }
    if (!(p.personas || []).some((x) => x.type === 'client' && x.status === 'active')) {
      p.personas = p.personas || [];
      p.personas.push(
        blankPersona('client', {
          linkedBy: 'system',
          refs: { customerId: acct.customerId || acct.id, clientId: acct.customerId || '' },
        })
      );
      if (!p.activePersona) p.activePersona = 'client';
      dirty = true;
    } else {
      const clientPersona = (p.personas || []).find((x) => x.type === 'client');
      if (clientPersona) {
        clientPersona.refs = {
          ...(clientPersona.refs || {}),
          customerId: acct.customerId || clientPersona.refs?.customerId || '',
          clientId: acct.customerId || clientPersona.refs?.clientId || '',
        };
      }
    }
  }

  // Seed employee persona only if staff credential exists (never auto-promote)
  const staff = staffCreds().getCredential?.(e);
  if (staff && staff.active !== false) {
    if (staff.name && (created || !p.fullName)) {
      p.fullName = staff.name;
      dirty = true;
    }
    if (staff.phone && !p.phone) {
      p.phone = staff.phone;
      dirty = true;
    }
    if (staff.department || staff.workplace) {
      const dep = staff.department || staff.workplace || '';
      if (dep && dep !== p.department) {
        p.department = dep;
        dirty = true;
      }
    }
    if (!(p.personas || []).some((x) => x.type === 'employee' && x.status === 'active')) {
      p.personas = p.personas || [];
      p.title =
        p.title ||
        (staff.role === 'supreme_leader' ? 'القائد الأعلى' : staff.role === 'chief_engineer' ? 'مهندس رئيس' : 'موظف');
      p.personas.push(
        blankPersona('employee', {
          linkedBy: 'system',
          refs: { employeeNo: staff.employeeNo || '', naioshId: staff.naioshId || staff.accountId || '' },
        })
      );
      if (!p.activePersona) p.activePersona = 'employee';
      dirty = true;
    }
  }

  if (!p.activePersona && p.personas[0]) {
    p.activePersona = p.personas[0].type;
    dirty = true;
  }
  if (dirty) {
    p.updatedAt = now();
    store.profiles[e] = p;
    if (created) {
      audit(store, {
        action: 'profile.ensure',
        email: e,
        by: 'system',
        detail: { personas: (p.personas || []).map((x) => x.type) },
      });
    }
    writeStore(store);
  }
  return p;
}

/**
 * Backfill Profile 360 rows from real customer + staff stores so admin list
 * is not limited to previously touched emails.
 */
function syncFromSources() {
  try {
    const accounts = customerAuth().readStore?.()?.accounts || [];
    for (const acct of accounts) {
      if (!acct?.email || acct.status === 'disabled') continue;
      ensureProfile(acct.email, acct.fullName || acct.name || '');
    }
  } catch {
    /* ignore */
  }
  try {
    const creds = staffCreds().readStore?.()?.credentials || {};
    for (const [email, staff] of Object.entries(creds)) {
      if (!email || staff?.active === false) continue;
      ensureProfile(email, staff.name || '');
    }
  } catch {
    /* ignore */
  }
}

function getProfileRaw(email) {
  const e = normEmail(email);
  const store = readStore();
  return store.profiles[e] || null;
}

function listProfiles({ q = '', persona = '', limit = 50 } = {}) {
  syncFromSources();
  const store = readStore();
  const needle = String(q || '')
    .trim()
    .toLowerCase();
  let rows = Object.values(store.profiles || {});
  if (persona) rows = rows.filter((p) => (p.personas || []).some((x) => x.type === persona && x.status === 'active'));
  if (needle) {
    rows = rows.filter((p) => {
      const personaRefs = (p.personas || []).flatMap((x) => [
        x.refs?.employeeNo,
        x.refs?.customerId,
        x.refs?.clientId,
        x.refs?.membershipId,
        x.meta?.membershipId,
      ]);
      const blob = [p.fullName, p.email, p.accountNo, p.phone, p.city, p.country, ...personaRefs]
        .join(' ')
        .toLowerCase();
      return blob.includes(needle);
    });
  }
  rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  return rows.slice(0, Math.min(200, Number(limit) || 50)).map((p) => summary(p));
}

function summary(p) {
  const clientPersona = (p.personas || []).find((x) => x.type === 'client');
  const empPersona = (p.personas || []).find((x) => x.type === 'employee');
  return {
    profileId: p.profileId,
    accountNo: p.accountNo,
    email: p.email,
    fullName: p.fullName,
    phone: p.phone || '',
    city: p.city || '',
    country: p.country || '',
    customerId: clientPersona?.refs?.customerId || clientPersona?.refs?.clientId || '',
    employeeNo: empPersona?.refs?.employeeNo || '',
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
    notifications: Array.isArray(portal?.notifications) && portal.notifications.length
      ? portal.notifications.slice(0, 15).map((n) => ({
          id: n.id || '',
          title: n.title || n.subject || n.message || '',
          status: n.read ? 'مقروء' : 'جديد',
          createdAt: n.at || n.createdAt || '',
        }))
      : EMPTY,
    activity: Array.isArray(portal?.activity) && portal.activity.length
      ? portal.activity.slice(0, 15).map((a) => ({
          id: a.id || '',
          title: a.title || a.type || a.message || '',
          status: a.at || a.createdAt || '',
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
  let tasks = EMPTY;
  try {
    const hubTasks = require('./hub-tasks');
    const mine = hubTasks.listTasksForPerson({ email: e, employeeNo }) || [];
    tasks = mine.length
      ? mine.slice(0, 30).map((t) => ({
          id: t.id || t.taskNo || '',
          title: t.title || t.name || '',
          status: t.status || '',
          createdAt: t.dueAt || t.updatedAt || t.createdAt || '',
        }))
      : EMPTY;
  } catch {
    tasks = EMPTY;
  }
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
    tasks,
    attendance: EMPTY,
    leaves: EMPTY,
    performance: EMPTY,
    sources: {
      credentials: !!staff,
      hubTasks: tasks !== EMPTY,
      hrAttendance: false,
      hrLeaves: false,
      payroll: false,
    },
    note:
      'المهام من نظام مهام الهوب عند التعيين. الحضور والإجازات والأداء والرواتب تتطلب تكامل HR/مالي منفصل — لا تُعرض قيم تجريبية.',
  };
  if (includeFinance) {
    out.payroll = EMPTY;
    out.financeNote = 'لا تتوفر واجهة رواتب متصلة في الهوب حاليًا — التكامل المالي مستقل.';
  } else {
    out.payroll = { restricted: true, message: 'بيانات الرواتب محجوبة عن غير المخوّلين' };
  }
  return out;
}

function buildLearningSection(type, persona, email) {
  if (!persona || persona.status !== 'active') {
    return { available: false, empty: EMPTY, reason: `صفة ${PERSONA_LABELS[type] || type} غير مفعّلة` };
  }
  const meta = persona.meta || {};
  let serverLearning = null;
  try {
    serverLearning = require('./hub-learning-enrollments').summaryForProfile(email || '');
  } catch {
    serverLearning = null;
  }
  if (type === 'trainee') {
    const metaCourses = Array.isArray(meta.courses) && meta.courses.length ? meta.courses : null;
    const serverCourses = serverLearning?.courses?.length ? serverLearning.courses : null;
    const courses = serverCourses || metaCourses || EMPTY;
    const progress =
      serverLearning?.progress != null
        ? `${serverLearning.progress}%`
        : meta.progress != null
          ? meta.progress
          : EMPTY;
    const connected = !!(serverLearning?.connected || meta.systemConnected);
    return {
      available: true,
      system: 'ACADEMY',
      connected,
      academyUrl: liveSystems().url?.('ACADEMY') || '',
      courses,
      diplomas: serverLearning?.diplomas?.length ? serverLearning.diplomas : EMPTY,
      progress,
      schedule: Array.isArray(meta.schedule) && meta.schedule.length ? meta.schedule : EMPTY,
      exams: Array.isArray(meta.exams) && meta.exams.length ? meta.exams : EMPTY,
      certificates: Array.isArray(meta.certificates) && meta.certificates.length ? meta.certificates : EMPTY,
      sources: {
        hubEnrollments: !!serverCourses,
        personaMeta: !!metaCourses,
        academyApi: false,
        browserLocalOnly: true,
      },
      note: connected
        ? 'الدورات المعروضة من سجل التسجيل في الهوب (خادم). مزامنة أكاديمية نايوش الحية غير مفعّلة بعد.'
        : 'لا تسجيلات خادمية بعد. دورات المتصفح المحلية (my-courses) ليست مصدرًا للملف 360 — يلزم تسجيل عبر API/إدارة أو تكامل الأكاديمية.',
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
      note: 'بيانات المدرب من السجلات المرتبطة بالصفة فقط — بدون مؤشرات مصطنعة. كتالوج الأكاديمية الحي يحتاج تكاملًا منفصلًا.',
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

  const customerId =
    personaMap.client?.refs?.customerId || personaMap.client?.refs?.clientId || customerAuth().findByEmail?.(e)?.customerId || '';
  const header = {
    profileId: profile.profileId,
    accountNo: profile.accountNo,
    email: profile.email,
    fullName: profile.fullName,
    phone: profile.phone || '',
    city: profile.city || '',
    country: profile.country || '',
    customerId,
    avatarUrl: profile.avatarUrl || '',
    avatarUpdatedAt: profile.avatarUpdatedAt || profile.updatedAt || '',
    status: profile.status || 'active',
    title: profile.title || (personaMap[active] && PERSONA_LABELS[active]) || '',
    department: profile.department || '',
    orgName: profile.orgName || '',
    activePersona: active,
    personaLabel: PERSONA_LABELS[active] || active || '',
    accountType: (profile.personas || [])
      .filter((x) => x.status === 'active')
      .map((x) => PERSONA_LABELS[x.type] || x.type)
      .join(' · '),
    roleRef:
      active === 'client'
        ? customerId || profile.accountNo
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
    trainee: buildLearningSection('trainee', personaMap.trainee, e),
    trainer: buildLearningSection('trainer', personaMap.trainer, e),
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
  const allowed = ['fullName', 'phone', 'avatarUrl', 'department', 'orgName', 'title', 'city', 'country'];
  const changes = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) {
      let value = String(patch[k] ?? '');
      if (k === 'avatarUrl' && value) {
        // Only allow this account's durable avatar route or own /uploads/ path (legacy)
        const durable = publicAvatarPath(next.accountNo).split('?')[0];
        const okDurable = value.split('?')[0] === durable;
        const okUpload = value.startsWith('/uploads/') && !value.includes('..');
        if (!okDurable && !okUpload) {
          const err = new Error('رابط الصورة غير مسموح — ارفع الصورة عبر زر الكاميرا');
          err.status = 400;
          throw err;
        }
        // Prefer durable account-bound URL
        if (okUpload) {
          next.avatarDiskUrl = value.split('?')[0];
          value = publicAvatarPath(next.accountNo, Date.now().toString(36));
          next.avatarUpdatedAt = now();
        }
      }
      changes[k] = { from: next[k] || '', to: value };
      next[k] = value;
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

  // Mirror safe fields into customer-auth + client portal when present
  try {
    if (
      patch.fullName !== undefined ||
      patch.phone !== undefined ||
      patch.city !== undefined ||
      patch.country !== undefined
    ) {
      const caStore = customerAuth().readStore();
      const row = (caStore.accounts || []).find((a) => normEmail(a.email) === e);
      if (row) {
        if (patch.fullName !== undefined) row.fullName = next.fullName;
        if (patch.phone !== undefined) row.phone = next.phone;
        if (patch.city !== undefined) row.city = next.city;
        if (patch.country !== undefined) row.governorate = next.country;
        row.updatedAt = now();
        customerAuth().writeStore(caStore);
      }
    }
  } catch {
    /* ignore */
  }
  try {
    if (
      patch.fullName !== undefined ||
      patch.phone !== undefined ||
      patch.city !== undefined ||
      patch.country !== undefined ||
      patch.avatarUrl !== undefined
    ) {
      const portal = clientPortal();
      const pStore = portal.readStore();
      if (pStore.clients?.[e] || customerAuth().findByEmail?.(e)) {
        const c = portal.ensureClient(pStore, e, next.fullName);
        if (patch.fullName !== undefined) c.name = next.fullName;
        if (patch.phone !== undefined) c.phone = next.phone;
        if (patch.city !== undefined) c.city = next.city;
        if (patch.country !== undefined) c.country = next.country;
        if (patch.avatarUrl !== undefined) c.avatarUrl = next.avatarUrl || '';
        c.updatedAt = now();
        portal.writeStore(pStore);
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

  // Persist trainee courses into server enrollment store (no fake rows)
  if (t === 'trainee' && Array.isArray(meta.courses)) {
    try {
      const learning = require('./hub-learning-enrollments');
      for (const c of meta.courses) {
        if (!c) continue;
        const itemId = typeof c === 'string' ? c : c.id || c.itemId || c.code;
        const title = typeof c === 'string' ? c : c.name || c.title || itemId;
        if (!itemId) continue;
        learning.enroll({
          email: e,
          kind: 'course',
          itemId: String(itemId),
          title: String(title),
          progress: typeof c === 'object' && c.progress != null ? c.progress : undefined,
          source: 'admin-attach',
        });
      }
    } catch {
      /* ignore */
    }
  }

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
      let workingEmail = session.email;
      const requestedEmail = body?.email != null ? normEmail(body.email) : '';
      if (requestedEmail && requestedEmail !== normEmail(session.email)) {
        // Owner-only email change with password proof (login identity)
        const confirmPass = String(body?.confirmCurrentPassword || body?.currentPassword || '');
        if (!confirmPass) {
          sendJson(res, 400, { ok: false, error: 'أدخل كلمة المرور الحالية لتأكيد تغيير البريد الإلكتروني' });
          return true;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedEmail)) {
          sendJson(res, 400, { ok: false, error: 'صيغة البريد الإلكتروني غير صحيحة' });
          return true;
        }
        const acct = customerAuth().findByEmail(session.email);
        if (!acct) {
          sendJson(res, 400, { ok: false, error: 'تغيير البريد متاح لحسابات العملاء المسجّلة' });
          return true;
        }
        const passOk = await customerAuth().verifyPassword(confirmPass, acct.passwordHash);
        if (!passOk) {
          sendJson(res, 401, { ok: false, error: 'كلمة المرور الحالية غير صحيحة' });
          return true;
        }
        if (customerAuth().findByEmail(requestedEmail)) {
          sendJson(res, 409, { ok: false, error: 'هذا البريد مستخدم بالفعل لحساب آخر' });
          return true;
        }
        // Migrate profile key + customer-auth + portal
        const store = readStore();
        const oldKey = normEmail(session.email);
        const profile = store.profiles[oldKey] || ensureProfile(oldKey);
        profile.email = requestedEmail;
        profile.updatedAt = now();
        store.profiles[requestedEmail] = profile;
        if (requestedEmail !== oldKey) delete store.profiles[oldKey];
        // rewrite audit emails for this account (best-effort)
        (store.audit || []).forEach((a) => {
          if (a.email === oldKey) a.email = requestedEmail;
        });
        audit(store, {
          action: 'profile.email',
          email: requestedEmail,
          by: session.email,
          detail: { from: oldKey, to: requestedEmail },
        });
        writeStore(store);

        const caStore = customerAuth().readStore();
        const row = (caStore.accounts || []).find((a) => normEmail(a.email) === oldKey);
        if (row) {
          row.email = requestedEmail;
          row.updatedAt = now();
          customerAuth().writeStore(caStore);
        }
        try {
          const portal = clientPortal();
          const pStore = portal.readStore();
          if (pStore.clients?.[oldKey]) {
            pStore.clients[requestedEmail] = {
              ...pStore.clients[oldKey],
              email: requestedEmail,
              updatedAt: now(),
            };
            delete pStore.clients[oldKey];
            portal.writeStore(pStore);
          }
        } catch {
          /* ignore */
        }
        workingEmail = requestedEmail;
        // Revoke old token; client must use new token if returned
        try {
          const tokenRevoke = require('./hub-token-revoke');
          if (session.token) tokenRevoke.revokeToken(session.token);
        } catch {
          /* ignore */
        }
      }

      const updated = updateProfile(workingEmail, body || {}, { ...session, email: workingEmail });
      const view = composeView(workingEmail, { ...session, email: workingEmail, ok: true }, {});
      const payload = { ok: true, profile: updated, header: view.header };
      if (requestedEmail && requestedEmail !== normEmail(session.email)) {
        payload.emailChanged = true;
        payload.token = customerAuth().makeToken(requestedEmail);
        payload.message = 'تم تحديث البيانات وتغيير البريد. استخدم البريد الجديد لتسجيل الدخول.';
      }
      sendJson(res, 200, payload);
    } catch (err) {
      sendJson(res, err.status || 500, { ok: false, error: err.message });
    }
    return true;
  }

  // POST /api/hub/profiles/me/learning — owner or staff: record a real enrollment row
  if (pathname === '/api/hub/profiles/me/learning' && method === 'POST') {
    const session = requireAuth(req, res);
    if (!session) return true;
    try {
      const body = await readBody(req);
      ensureProfile(session.email, session.name);
      // Ensure trainee persona exists when owner enrolls
      const store = readStore();
      const p = store.profiles[normEmail(session.email)];
      if (!(p.personas || []).some((x) => x.type === 'trainee' && x.status === 'active')) {
        if (STAFF_ONLY_PERSONAS.has('trainee')) {
          /* never */
        } else {
          attachPersona(session.email, 'trainee', session, { meta: {} });
        }
      }
      const learning = require('./hub-learning-enrollments');
      const result = learning.enroll({
        email: session.email,
        kind: body?.kind || 'course',
        itemId: body?.itemId || body?.id || body?.courseId,
        title: body?.title || body?.name,
        level: body?.level,
        duration: body?.duration,
        progress: body?.progress,
        source: body?.source || 'profile',
      });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.error });
        return true;
      }
      sendJson(res, 200, { ok: true, enrollment: result.enrollment, item: result.item });
    } catch (err) {
      sendJson(res, err.status || 500, { ok: false, error: err.message });
    }
    return true;
  }

  // POST /api/hub/profiles/me/password — owner-only password change (customer accounts)
  if (pathname === '/api/hub/profiles/me/password' && method === 'POST') {
    const session = requireAuth(req, res);
    if (!session) return true;
    try {
      const body = await readBody(req);
      const current = String(body?.currentPassword || '');
      const next = String(body?.newPassword || '');
      const confirm = body?.confirmPassword != null ? String(body.confirmPassword) : next;
      if (!current || !next) {
        sendJson(res, 400, { ok: false, error: 'كلمة المرور الحالية والجديدة مطلوبتان' });
        return true;
      }
      if (next !== confirm) {
        sendJson(res, 400, { ok: false, error: 'تأكيد كلمة المرور غير متطابق.' });
        return true;
      }
      const policy = require('./hub-password-policy');
      const check = policy.analyze(next);
      if (!check.ok) {
        sendJson(res, 400, { ok: false, error: check.error });
        return true;
      }
      const account = customerAuth().findByEmail(session.email);
      if (!account) {
        sendJson(res, 400, { ok: false, error: 'تغيير كلمة المرور من الملف متاح لحسابات العملاء المسجّلة' });
        return true;
      }
      const ok = await customerAuth().verifyPassword(current, account.passwordHash);
      if (!ok) {
        sendJson(res, 401, { ok: false, error: 'كلمة المرور الحالية غير صحيحة' });
        return true;
      }
      const storeAccounts = customerAuth().readStore();
      const row = (storeAccounts.accounts || []).find((a) => normEmail(a.email) === normEmail(account.email));
      if (!row) {
        sendJson(res, 404, { ok: false, error: 'الحساب غير موجود' });
        return true;
      }
      row.passwordHash = await customerAuth().hashPassword(next);
      row.passwordEpoch = Number(row.passwordEpoch || 0) + 1;
      row.updatedAt = now();
      customerAuth().writeStore(storeAccounts);
      try {
        if (typeof customerAuth().flushDurable === 'function') await customerAuth().flushDurable();
      } catch {
        /* ignore */
      }
      const store = readStore();
      audit(store, { action: 'profile.password', email: normEmail(session.email), by: session.email, detail: {} });
      writeStore(store);
      // Invalidate previous access token; issue a fresh one for the current browser session
      try {
        const tokenRevoke = require('./hub-token-revoke');
        if (session.token) tokenRevoke.revokeToken(session.token);
      } catch {
        /* ignore */
      }
      const newToken = customerAuth().makeToken(account.email);
      sendJson(res, 200, {
        ok: true,
        message: 'تم تغيير كلمة المرور بنجاح. كلمة المرور القديمة لم تعد تعمل.',
        token: newToken,
        passwordEpoch: row.passwordEpoch,
      });
    } catch (err) {
      sendJson(res, err.status || 500, { ok: false, error: err.message || 'فشل تغيير كلمة المرور' });
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
    const items = listProfiles({
      q: url.searchParams.get('q') || '',
      persona: url.searchParams.get('persona') || '',
      limit: url.searchParams.get('limit') || 100,
    });
    sendJson(res, 200, {
      ok: true,
      items,
      total: items.length,
      synced: true,
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

  // POST /api/hub/profiles/me/avatar — owner uploads JPG/PNG/WEBP (durable)
  if (pathname === '/api/hub/profiles/me/avatar' && method === 'POST') {
    const session = requireAuth(req, res);
    if (!session) return true;
    try {
      const mimeHint = String(req.headers['x-file-type'] || req.headers['content-type'] || '');
      const buffer = await readRequestBuffer(req, { maxBytes: AVATAR_MAX_BYTES });
      const saved = await saveAvatarForEmail(session.email, buffer, { mimeHint, session });
      sendJson(res, 201, {
        ok: true,
        avatarUrl: saved.avatarUrl,
        url: saved.avatarUrl,
        mime: saved.mime,
        size: saved.size,
        accountNo: saved.accountNo,
        message: 'تم حفظ الصورة الشخصية بنجاح',
      });
    } catch (err) {
      sendJson(res, err.status || 500, { ok: false, error: err.message || 'فشل رفع الصورة الشخصية' });
    }
    return true;
  }

  // POST /api/hub/profiles/by-email/:email/avatar — owner or staff
  {
    const m = pathname.match(/^\/api\/hub\/profiles\/by-email\/([^/]+)\/avatar$/);
    if (m && method === 'POST') {
      const session = requireAuth(req, res);
      if (!session) return true;
      try {
        const email = decodeURIComponent(m[1]);
        if (!canEdit(session, email)) {
          sendJson(res, 403, { ok: false, error: 'ليس لديك صلاحية تعديل صورة هذا الحساب' });
          return true;
        }
        const mimeHint = String(req.headers['x-file-type'] || req.headers['content-type'] || '');
        const buffer = await readRequestBuffer(req, { maxBytes: AVATAR_MAX_BYTES });
        const saved = await saveAvatarForEmail(email, buffer, { mimeHint, session });
        sendJson(res, 201, {
          ok: true,
          avatarUrl: saved.avatarUrl,
          url: saved.avatarUrl,
          mime: saved.mime,
          size: saved.size,
          accountNo: saved.accountNo,
          message: 'تم حفظ الصورة الشخصية بنجاح',
        });
      } catch (err) {
        sendJson(res, err.status || 500, { ok: false, error: err.message || 'فشل رفع الصورة الشخصية' });
      }
      return true;
    }
  }

  // GET|HEAD /api/hub/avatars/:accountNo — durable avatar bytes (DB first, disk fallback)
  {
    const m = pathname.match(/^\/api\/hub\/avatars\/([^/]+)$/);
    if (m && (method === 'GET' || method === 'HEAD')) {
      try {
        const accountNo = decodeURIComponent(m[1]).toUpperCase();
        const row = await loadAvatarBlobByAccount(accountNo);
        if (row?.bytes) {
          const buf = Buffer.isBuffer(row.bytes) ? row.bytes : Buffer.from(row.bytes);
          const headers = {
            'Content-Type': row.mime || 'application/octet-stream',
            'Content-Length': String(buf.length),
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
            'X-Content-Type-Options': 'nosniff',
          };
          if (method === 'HEAD') {
            res.writeHead(200, headers);
            res.end();
            return true;
          }
          res.writeHead(200, headers);
          res.end(buf);
          return true;
        }
        const store = readStore();
        const profile = Object.values(store.profiles || {}).find(
          (p) => String(p.accountNo || '').toUpperCase() === accountNo
        );
        const disk = profile?.avatarDiskUrl || '';
        if (disk && disk.startsWith('/uploads/')) {
          const hubUploads = require('./hub-uploads');
          const filePath = hubUploads.resolveUploadPath(path.basename(disk));
          if (filePath && fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const headers = {
              'Content-Type': hubUploads.mimeForExt(ext) || 'application/octet-stream',
              'Content-Length': String(stat.size),
              'Cache-Control': 'public, max-age=86400',
              'X-Content-Type-Options': 'nosniff',
            };
            if (method === 'HEAD') {
              res.writeHead(200, headers);
              res.end();
              return true;
            }
            res.writeHead(200, headers);
            fs.createReadStream(filePath).pipe(res);
            return true;
          }
        }
        sendJson(res, 404, { ok: false, error: 'لا توجد صورة شخصية لهذا الحساب' });
      } catch (err) {
        sendJson(res, err.status || 500, { ok: false, error: err.message || 'تعذّر جلب الصورة' });
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
      avatarMaxMb: 5,
      avatarTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    return true;
  }

  return false;
}

module.exports = {
  PERSONA_TYPES,
  PERSONA_LABELS,
  EMPTY,
  AVATAR_MAX_BYTES,
  ensureProfile,
  syncFromSources,
  getProfileRaw,
  listProfiles,
  composeView,
  updateProfile,
  saveAvatarForEmail,
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
  publicAvatarPath,
};
