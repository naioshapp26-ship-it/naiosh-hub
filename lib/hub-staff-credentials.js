/**
 * Production staff credentials — scrypt hashes only.
 * Never stores or returns plaintext passwords.
 * Store path is under data/ (gitignored).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const policy = require('./hub-password-policy');

const scryptAsync = promisify(crypto.scrypt);
const SCRYPT_KEYLEN = 64;
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const STORE_PATH = path.join(DATA_DIR, 'staff-credentials.json');

/** Production Super Admin identity (migrated from leader@naiosh.com / EMP-0001). */
const SUPER_ADMIN_EMAIL = String(process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com')
  .trim()
  .toLowerCase();
const SUPER_ADMIN_EMP = 'EMP-0001';
const SUPER_ADMIN_ROLE = 'supreme_leader';
const SUPER_ADMIN_NAME = 'القائد الأعلى';

/** Legacy demo emails — login disabled in production unless HUB_ALLOW_LEGACY_DEMO=1 */
const LEGACY_DEMO_EMAILS = new Set(['leader@naiosh.com', 'malika@naiosh.com', 'viewer@naiosh.com']);

let mem = null;
let dbHydrated = false;
let dbWriteQueue = Promise.resolve();

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function defaultStore() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    credentials: {},
    passwordEpoch: {}, // email -> number; bump on password change to invalidate old tokens
    resetTokens: {},
    audit: [],
  };
}

const META_KEY = 'staff_credentials_v1';

async function loadStoreFromDb() {
  try {
    const { getDatabaseUrl, withClient } = require('../db/migrate');
    if (!getDatabaseUrl()) return null;
    return await withClient(async (client) => {
      const r = await client.query(`SELECT value FROM hub_meta WHERE key = $1 LIMIT 1`, [META_KEY]);
      if (!r.rows[0]?.value) return null;
      const value = r.rows[0].value;
      return typeof value === 'string' ? JSON.parse(value) : value;
    });
  } catch (err) {
    console.warn('[hub-staff-credentials] DB load skipped:', err.message);
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
          updatedAt: store.updatedAt,
          credentials: store.credentials || {},
          passwordEpoch: store.passwordEpoch || {},
          resetTokens: store.resetTokens || {},
          audit: Array.isArray(store.audit) ? store.audit.slice(0, 200) : [],
        };
        await withClient(async (client) => {
          await client.query(
            `INSERT INTO hub_meta (key, value, updated_at)
             VALUES ($1, $2::jsonb, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [META_KEY, JSON.stringify(payload)]
          );
        });
      } catch (err) {
        console.warn('[hub-staff-credentials] DB persist skipped:', err.message);
      }
    })
    .catch(() => {});
  return dbWriteQueue;
}

function readStoreFromFile() {
  ensureDir();
  try {
    if (!fs.existsSync(STORE_PATH)) return null;
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return {
      ...defaultStore(),
      ...parsed,
      credentials: parsed.credentials || {},
      passwordEpoch: parsed.passwordEpoch || {},
      resetTokens: parsed.resetTokens || {},
      audit: Array.isArray(parsed.audit) ? parsed.audit : [],
    };
  } catch {
    return null;
  }
}

function readStore() {
  if (mem) return mem;
  const fromFile = readStoreFromFile();
  mem = fromFile || defaultStore();
  return mem;
}

/**
 * Prefer Postgres hub_meta over ephemeral disk (Railway redeploys wipe local data/).
 */
async function hydrateFromDb() {
  if (dbHydrated) return readStore();
  dbHydrated = true;
  const fromDb = await loadStoreFromDb();
  const fromFile = readStoreFromFile();
  if (fromDb && Object.keys(fromDb.credentials || {}).length) {
    mem = {
      ...defaultStore(),
      ...fromDb,
      credentials: fromDb.credentials || {},
      passwordEpoch: fromDb.passwordEpoch || {},
      resetTokens: fromDb.resetTokens || {},
      audit: Array.isArray(fromDb.audit) ? fromDb.audit : [],
    };
    // Mirror to local disk for fast sync reads
    try {
      ensureDir();
      fs.writeFileSync(STORE_PATH, JSON.stringify(mem, null, 2), 'utf8');
    } catch {
      /* ignore */
    }
    return mem;
  }
  if (fromFile) {
    mem = fromFile;
    // Promote file → DB so next redeploy keeps credentials
    if (Object.keys(fromFile.credentials || {}).length) {
      await persistStoreToDb(fromFile);
    }
    return mem;
  }
  mem = defaultStore();
  return mem;
}

function writeStore(store) {
  ensureDir();
  store.updatedAt = new Date().toISOString();
  mem = store;
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.warn('[hub-staff-credentials] file write failed:', err.message);
  }
  persistStoreToDb(store);
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(String(password), salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${Buffer.from(derived).toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const raw = String(stored || '');
  if (!raw.startsWith('scrypt$')) return false;
  const parts = raw.split('$');
  if (parts.length !== 3) return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const derived = await scryptAsync(String(password), salt, expected.length || SCRYPT_KEYLEN);
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(expected, derived);
}

function audit(action, meta = {}) {
  const store = readStore();
  store.audit.unshift({
    at: new Date().toISOString(),
    action,
    actorEmployeeNo: meta.actorEmployeeNo || null,
    actorEmail: meta.actorEmail || null,
    targetEmployeeNo: meta.targetEmployeeNo || null,
    targetEmail: meta.targetEmail || null,
    detail: meta.detail || '',
  });
  if (store.audit.length > 500) store.audit.length = 500;
  writeStore(store);
}

function getCredential(email) {
  const store = readStore();
  return store.credentials[normalizeEmail(email)] || null;
}

function passwordEpoch(email) {
  const store = readStore();
  return Number(store.passwordEpoch[normalizeEmail(email)] || 0);
}

function bumpEpoch(email) {
  const store = readStore();
  const e = normalizeEmail(email);
  store.passwordEpoch[e] = Number(store.passwordEpoch[e] || 0) + 1;
  writeStore(store);
  return store.passwordEpoch[e];
}

function allowLegacyDemo() {
  return String(process.env.HUB_ALLOW_LEGACY_DEMO || '') === '1';
}

function isLegacyDemoEmail(email) {
  return LEGACY_DEMO_EMAILS.has(normalizeEmail(email));
}

/**
 * Bootstrap Super Admin credential once.
 * Password MUST come from env HUB_SUPER_ADMIN_INITIAL_PASSWORD — never hardcoded here.
 */
async function ensureSuperAdminBootstrap() {
  await hydrateFromDb();
  const store = readStore();
  const email = SUPER_ADMIN_EMAIL;
  const initial = process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD;
  const forceReset = String(process.env.HUB_SUPER_ADMIN_FORCE_PASSWORD_RESET || '') === '1';

  // Ops recovery: re-apply env password when FORCE flag is set (then unset the flag on Railway).
  if (forceReset && initial && store.credentials[email]?.passwordHash) {
    const applied = await applySuperAdminPassword(String(initial), {
      via: 'env_force_reset',
      forceChange: true,
    });
    console.warn(
      '[hub-staff-credentials] Super Admin password reset from HUB_SUPER_ADMIN_INITIAL_PASSWORD (FORCE=1). Unset HUB_SUPER_ADMIN_FORCE_PASSWORD_RESET after login.'
    );
    return { ...applied, forced: true };
  }

  if (store.credentials[email]?.passwordHash) {
    // Ensure identity fields
    store.credentials[email].employeeNo = SUPER_ADMIN_EMP;
    store.credentials[email].role = SUPER_ADMIN_ROLE;
    store.credentials[email].name = store.credentials[email].name || SUPER_ADMIN_NAME;
    store.credentials[email].naioshId = store.credentials[email].naioshId || 'NAI-LEADER-001';
    store.credentials[email].active = store.credentials[email].active !== false;
    if (store.credentials[email].phone == null) store.credentials[email].phone = '';
    if (store.credentials[email].workplace == null) store.credentials[email].workplace = '';
    if (!store.credentials[email].affiliationKind) store.credentials[email].affiliationKind = 'naiosh';
    if (!store.credentials[email].orgName) store.credentials[email].orgName = 'نايوش';
    if (store.credentials[email].department == null) store.credentials[email].department = store.credentials[email].workplace || '';
    if (!store.credentials[email].assignmentStatus) store.credentials[email].assignmentStatus = 'active';
    writeStore(store);
    return { ok: true, created: false, email, employeeNo: SUPER_ADMIN_EMP };
  }

  if (!initial) {
    await ensureBootstrapSetupCode();
    console.warn(
      '[hub-staff-credentials] Super Admin has no password hash. Set HUB_SUPER_ADMIN_INITIAL_PASSWORD on the host (Railway Variables) once and redeploy — or use the one-time setup code printed above with /api/auth/bootstrap-super-admin.'
    );
    return { ok: false, created: false, email, reason: 'missing_env', needsBootstrap: true };
  }

  return applySuperAdminPassword(String(initial), { via: 'env_bootstrap', forceChange: true });
}

async function applySuperAdminPassword(password, { via = 'bootstrap', forceChange = true } = {}) {
  const store = readStore();
  const email = SUPER_ADMIN_EMAIL;
  const prev = store.credentials[email] || {};
  const hash = await hashPassword(String(password));
  store.credentials[email] = {
    ...prev,
    email,
    employeeNo: SUPER_ADMIN_EMP,
    role: SUPER_ADMIN_ROLE,
    name: prev.name || SUPER_ADMIN_NAME,
    naioshId: prev.naioshId || 'NAI-LEADER-001',
    phone: prev.phone || '',
    workplace: prev.workplace || '',
    affiliationKind: prev.affiliationKind || 'naiosh',
    orgName: prev.orgName || 'نايوش',
    department: prev.department || prev.workplace || '',
    assignmentStatus: prev.assignmentStatus || 'active',
    active: true,
    passwordHash: hash,
    mustChangePassword: !!forceChange,
    createdAt: prev.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdVia: via,
    migratedFrom: prev.migratedFrom || 'leader@naiosh.com',
  };
  store.passwordEpoch[email] = Number(store.passwordEpoch[email] || 0) + 1 || 1;
  // Clear one-time setup code if present
  delete store.bootstrapSetup;
  writeStore(store);
  audit('SUPER_ADMIN_BOOTSTRAP', {
    targetEmail: email,
    targetEmployeeNo: SUPER_ADMIN_EMP,
    detail: `via=${via}; mustChangePassword=${!!forceChange}`,
  });
  return { ok: true, created: true, email, employeeNo: SUPER_ADMIN_EMP, mustChangePassword: !!forceChange };
}

/** One-time setup code for production when env password was not set (printed in server logs only). */
async function ensureBootstrapSetupCode() {
  const store = readStore();
  if (store.credentials[SUPER_ADMIN_EMAIL]?.passwordHash) return null;
  // Rotate a fresh code on each boot so redeploy logs always show a usable value.
  const code = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  store.bootstrapSetup = {
    hash,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    createdAt: new Date().toISOString(),
  };
  writeStore(store);
  console.warn('============================================================');
  console.warn('[HUB BOOTSTRAP] Super Admin not configured.');
  console.warn(`[HUB BOOTSTRAP] One-time setup code (valid 24h): ${code}`);
  console.warn('[HUB BOOTSTRAP] Open /admin-bootstrap.html or POST /api/auth/bootstrap-super-admin');
  console.warn('  { "setupCode":"<code>", "password":"<new>", "confirmPassword":"<new>" }');
  console.warn('============================================================');
  return code;
}

/**
 * Complete Super Admin bootstrap with one-time setup code from server logs.
 * Never returns the code. Only works while SA has no password hash.
 */
async function bootstrapWithSetupCode({ setupCode, password, confirmPassword } = {}) {
  await hydrateFromDb();
  const email = SUPER_ADMIN_EMAIL;
  const store = readStore();
  if (store.credentials[email]?.passwordHash) {
    return { ok: false, status: 409, error: 'حساب الإدارة مهيأ بالفعل. سجّل الدخول مباشرة.' };
  }
  if (confirmPassword != null && String(password) !== String(confirmPassword)) {
    return { ok: false, status: 400, error: 'تأكيد كلمة المرور غير متطابق.' };
  }
  const entry = store.bootstrapSetup;
  if (!entry || entry.expiresAt < Date.now() || entry.used) {
    await ensureBootstrapSetupCode();
    return {
      ok: false,
      status: 400,
      error: 'رمز التهيئة غير صالح أو منتهٍ. راجع سجلات الخادم لرمز جديد، أو اضبط HUB_SUPER_ADMIN_INITIAL_PASSWORD وأعد التشغيل.',
    };
  }
  const hash = crypto.createHash('sha256').update(String(setupCode || '')).digest('hex');
  if (hash !== entry.hash) {
    return { ok: false, status: 400, error: 'رمز التهيئة غير صحيح.' };
  }
  // Allow weak owner-chosen initial (e.g. delivery password) then force change
  const check = policy.analyze(password, { allowBootstrapWeak: true });
  if (!check.ok) return { ok: false, status: 400, error: check.error };

  entry.used = true;
  writeStore(store);
  return applySuperAdminPassword(password, { via: 'setup_code', forceChange: true });
}

function needsBootstrap() {
  const store = readStore();
  return !store.credentials[SUPER_ADMIN_EMAIL]?.passwordHash;
}

async function setPassword(email, newPassword, { actor = null, allowBootstrapWeak = false, forceChange = false } = {}) {
  const e = normalizeEmail(email);
  const check = policy.analyze(newPassword, { allowBootstrapWeak });
  if (!check.ok) return { ok: false, status: 400, error: check.error };

  const store = readStore();
  const row = store.credentials[e];
  if (!row) return { ok: false, status: 404, error: 'الحساب غير موجود' };

  row.passwordHash = await hashPassword(newPassword);
  row.mustChangePassword = !!forceChange;
  row.updatedAt = new Date().toISOString();
  store.passwordEpoch[e] = Number(store.passwordEpoch[e] || 0) + 1;
  writeStore(store);
  audit('PASSWORD_CHANGED', {
    actorEmail: actor?.email,
    actorEmployeeNo: actor?.employeeNo,
    targetEmail: e,
    targetEmployeeNo: row.employeeNo,
  });
  return { ok: true, status: 200, message: 'تم تغيير كلمة المرور بنجاح.', epoch: store.passwordEpoch[e] };
}

async function verifyLoginPassword(email, password) {
  const row = getCredential(email);
  if (!row || !row.passwordHash) return { ok: false, reason: 'no_credential' };
  if (row.active === false) return { ok: false, reason: 'disabled' };
  const match = await verifyPassword(password, row.passwordHash);
  if (!match) return { ok: false, reason: 'bad_password' };
  return { ok: true, credential: row };
}

function nextNaioshId(employeeNo) {
  const store = readStore();
  const used = new Set(
    Object.values(store.credentials)
      .map((c) => String(c.naioshId || '').toUpperCase())
      .filter(Boolean)
  );
  const empDigits = String(employeeNo || '').match(/(\d+)$/);
  if (empDigits) {
    const candidate = `NAI-STAFF-${empDigits[1].padStart(3, '0')}`;
    if (!used.has(candidate)) return candidate;
  }
  let n = used.size + 1;
  let candidate = `NAI-STAFF-${String(n).padStart(3, '0')}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `NAI-STAFF-${String(n).padStart(3, '0')}`;
  }
  return candidate;
}

/** Normalize/validate international mobile (+ optional country code). Empty allowed (clear). */
function normalizePhone(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { ok: true, phone: '' };
  // Allow +, spaces, dashes, parentheses — store compact form with leading + if present
  const compact = s.replace(/[\s\-().]/g, '');
  if (!/^\+?[0-9]{8,15}$/.test(compact)) {
    return {
      ok: false,
      error: 'رقم الجوال غير صالح. استخدم أرقامًا فقط مع رمز الدولة إن لزم (مثال: +97059XXXXXXX).',
    };
  }
  return { ok: true, phone: compact };
}

function ensureAccountId(email) {
  const store = readStore();
  const e = normalizeEmail(email);
  const row = store.credentials[e];
  if (!row) return null;
  if (row.naioshId) return row;
  row.naioshId = e === SUPER_ADMIN_EMAIL ? 'NAI-LEADER-001' : nextNaioshId(row.employeeNo);
  row.updatedAt = new Date().toISOString();
  store.credentials[e] = row;
  writeStore(store);
  return row;
}

function updateOwnProfile(email, { phone, workplace } = {}) {
  const store = readStore();
  const e = normalizeEmail(email);
  const row = store.credentials[e];
  if (!row) return { ok: false, status: 404, error: 'الحساب غير موجود' };

  let changed = false;
  if (phone !== undefined) {
    const checked = normalizePhone(phone);
    if (!checked.ok) return { ok: false, status: 400, error: checked.error };
    if (row.phone !== checked.phone) changed = true;
    row.phone = checked.phone;
  }
  if (workplace !== undefined) {
    const w = String(workplace || '').trim().slice(0, 120);
    if (row.workplace !== w) changed = true;
    row.workplace = w;
  }
  if (!row.naioshId) {
    row.naioshId = e === SUPER_ADMIN_EMAIL ? 'NAI-LEADER-001' : nextNaioshId(row.employeeNo);
    changed = true;
  }
  if (!changed) return { ok: true, credential: row };
  row.updatedAt = new Date().toISOString();
  store.credentials[e] = row;
  writeStore(store);
  audit('PROFILE_UPDATED', {
    actorEmail: e,
    actorEmployeeNo: row.employeeNo,
    targetEmail: e,
    targetEmployeeNo: row.employeeNo,
    detail: `phone=${row.phone ? 'set' : 'empty'}; workplace=${row.workplace ? 'set' : 'empty'}`,
  });
  return { ok: true, credential: row };
}

const ROLE_LABEL_AR = {
  supreme_leader: 'القائد الأعلى',
  super_admin: 'القائد الأعلى',
  chief_engineer: 'المهندس الرئيس',
  admin: 'إداري',
};

function normalizeAffiliation(kind, orgName, email) {
  const e = normalizeEmail(email);
  let k = String(kind || '').toLowerCase();
  if (k === 'internal' || k === 'hq' || k === 'naioshai') k = 'naiosh';
  if (k === 'org' || k === 'contractor' || k === 'outside') k = 'external';
  if (k !== 'naiosh' && k !== 'external') {
    k = e === SUPER_ADMIN_EMAIL ? 'naiosh' : 'naiosh';
  }
  let org = String(orgName || '').trim().slice(0, 120);
  if (k === 'naiosh') org = org || 'نايوش';
  return { affiliationKind: k, orgName: org };
}

function publicStaffRow(c) {
  const role = String(c.role || '').toLowerCase();
  const affiliationKind = c.affiliationKind === 'external' ? 'external' : 'naiosh';
  const assignmentStatus = c.assignmentStatus === 'revoked' ? 'revoked' : 'active';
  const active = c.active !== false;
  let statusLabel = 'نشط';
  if (assignmentStatus === 'revoked') statusLabel = 'ملغى التكليف';
  else if (!active) statusLabel = 'موقوف';
  const perms = Array.isArray(c.permissions) ? c.permissions.slice() : c.permissions || null;
  return {
    email: c.email,
    name: c.name || c.email,
    employeeNo: c.employeeNo || null,
    accountId: c.naioshId || null,
    naioshId: c.naioshId || null,
    phone: c.phone || '',
    affiliationKind,
    affiliationLabel: affiliationKind === 'external' ? 'جهة خارجية' : 'نايوش',
    orgName: c.orgName || (affiliationKind === 'naiosh' ? 'نايوش' : ''),
    department: c.department || c.workplace || '',
    workplace: c.workplace || c.department || '',
    role,
    roleLabel: ROLE_LABEL_AR[role] || role || 'غير مسجل',
    permissions: perms,
    permissionsCount: Array.isArray(perms) ? perms.length : perms == null ? null : 0,
    active,
    assignmentStatus,
    statusLabel,
    mustChangePassword: !!c.mustChangePassword,
    createdAt: c.createdAt || null,
    updatedAt: c.updatedAt || null,
  };
}

function staffStats(list) {
  const rows = list || listStaff();
  return {
    total: rows.length,
    active: rows.filter((r) => r.active && r.assignmentStatus !== 'revoked').length,
    suspended: rows.filter((r) => !r.active && r.assignmentStatus !== 'revoked').length,
    revoked: rows.filter((r) => r.assignmentStatus === 'revoked').length,
    naiosh: rows.filter((r) => r.affiliationKind === 'naiosh').length,
    external: rows.filter((r) => r.affiliationKind === 'external').length,
  };
}

function upsertStaff({
  email,
  name,
  employeeNo,
  role,
  permissions,
  active = true,
  phone = '',
  workplace = '',
  department = '',
  affiliationKind = null,
  orgName = null,
  assignmentStatus = null,
  naioshId = null,
  passwordHash = null,
  mustChangePassword = true,
} = {}) {
  const store = readStore();
  const e = normalizeEmail(email);
  const prev = store.credentials[e] || {};
  const emp = employeeNo || prev.employeeNo;
  const phoneNorm =
    phone !== undefined && phone !== null && String(phone).length
      ? normalizePhone(phone)
      : { ok: true, phone: prev.phone || '' };
  const resolvedPhone = phoneNorm.ok ? phoneNorm.phone : prev.phone || '';
  const aff = normalizeAffiliation(
    affiliationKind != null ? affiliationKind : prev.affiliationKind,
    orgName != null ? orgName : prev.orgName,
    e
  );
  const dept = String(department || workplace || prev.department || prev.workplace || '').trim().slice(0, 120);
  const place = String(workplace || department || prev.workplace || prev.department || '').trim().slice(0, 120);
  store.credentials[e] = {
    ...prev,
    email: e,
    name: name || prev.name || e,
    employeeNo: emp,
    naioshId:
      naioshId ||
      prev.naioshId ||
      (e === SUPER_ADMIN_EMAIL ? 'NAI-LEADER-001' : nextNaioshId(emp)),
    role: role || prev.role || 'admin',
    permissions: Array.isArray(permissions) ? permissions : prev.permissions,
    phone: resolvedPhone,
    workplace: place,
    department: dept,
    affiliationKind: aff.affiliationKind,
    orgName: aff.orgName,
    assignmentStatus: assignmentStatus || prev.assignmentStatus || 'active',
    active: active !== false,
    passwordHash: passwordHash || prev.passwordHash || null,
    mustChangePassword: mustChangePassword,
    updatedAt: new Date().toISOString(),
    createdAt: prev.createdAt || new Date().toISOString(),
  };
  if (!store.passwordEpoch[e]) store.passwordEpoch[e] = 1;
  writeStore(store);
  return store.credentials[e];
}

function listStaff() {
  const store = readStore();
  let dirty = false;
  const rows = Object.values(store.credentials).map((raw) => {
    const c = { ...raw };
    if (!c.affiliationKind || !c.orgName || !c.assignmentStatus || !c.naioshId) {
      const aff = normalizeAffiliation(c.affiliationKind, c.orgName, c.email);
      c.affiliationKind = aff.affiliationKind;
      c.orgName = aff.orgName;
      c.department = c.department || c.workplace || '';
      c.assignmentStatus = c.assignmentStatus || 'active';
      if (!c.naioshId) {
        c.naioshId =
          normalizeEmail(c.email) === SUPER_ADMIN_EMAIL ? 'NAI-LEADER-001' : nextNaioshId(c.employeeNo);
      }
      store.credentials[normalizeEmail(c.email)] = { ...raw, ...c };
      dirty = true;
    }
    return publicStaffRow(store.credentials[normalizeEmail(c.email)] || c);
  });
  if (dirty) writeStore(store);
  return rows.sort((a, b) => String(a.employeeNo || '').localeCompare(String(b.employeeNo || ''), 'en'));
}

function nextEmployeeNo() {
  const store = readStore();
  let max = 0;
  Object.values(store.credentials).forEach((c) => {
    const m = String(c.employeeNo || '').match(/^EMP-(\d+)$/i);
    if (m) max = Math.max(max, Number(m[1]));
  });
  // Also reserve known demo numbers
  max = Math.max(max, 1, 3, 99);
  return `EMP-${String(max + 1).padStart(4, '0')}`;
}

/**
 * Create a single-use reset token.
 * @param {string} emailOrKey — staff email, or `cust:email` for customers
 */
function createResetToken(emailOrKey) {
  const store = readStore();
  const raw = String(emailOrKey || '').trim();
  const isCust = raw.toLowerCase().startsWith('cust:');
  const e = isCust ? `cust:${normalizeEmail(raw.slice(5))}` : normalizeEmail(raw);
  const row = !isCust ? store.credentials[e] || null : null;
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const exists = isCust || !!row;
  if (exists) {
    store.resetTokens[e] = {
      hash,
      expiresAt: Date.now() + 60 * 60 * 1000,
      used: false,
      kind: isCust ? 'customer' : 'staff',
    };
    writeStore(store);
    if (row) {
      audit('PASSWORD_RESET_REQUESTED', { targetEmail: e, targetEmployeeNo: row.employeeNo });
    } else {
      audit('PASSWORD_RESET_REQUESTED', { targetEmail: e.replace(/^cust:/, ''), detail: 'customer' });
    }
  }
  return { ok: true, token: exists ? token : null, email: e, exists, kind: isCust ? 'customer' : 'staff' };
}

/** Validate + consume reset token without applying password (for customer path). */
function consumeResetTokenOnly(emailOrKey, token) {
  const store = readStore();
  const raw = String(emailOrKey || '').trim();
  const isCust = raw.toLowerCase().startsWith('cust:');
  const e = isCust ? `cust:${normalizeEmail(raw.slice(5))}` : normalizeEmail(raw);
  const entry = store.resetTokens[e];
  if (!entry || entry.used || entry.expiresAt < Date.now()) {
    return { ok: false, status: 400, error: 'رابط إعادة التعيين غير صالح أو منتهٍ.' };
  }
  const hash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
  if (hash !== entry.hash) {
    return { ok: false, status: 400, error: 'رابط إعادة التعيين غير صالح أو منتهٍ.' };
  }
  entry.used = true;
  writeStore(store);
  return { ok: true, kind: entry.kind || (isCust ? 'customer' : 'staff'), key: e };
}

async function consumeResetToken(email, token, newPassword) {
  const store = readStore();
  const e = normalizeEmail(email);
  const entry = store.resetTokens[e];
  if (!entry || entry.used || entry.expiresAt < Date.now()) {
    return { ok: false, status: 400, error: 'رابط إعادة التعيين غير صالح أو منتهٍ.' };
  }
  const hash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
  if (hash !== entry.hash) {
    return { ok: false, status: 400, error: 'رابط إعادة التعيين غير صالح أو منتهٍ.' };
  }
  const check = policy.analyze(newPassword);
  if (!check.ok) return { ok: false, status: 400, error: check.error };
  const row = store.credentials[e];
  if (!row) return { ok: false, status: 404, error: 'الحساب غير موجود' };
  row.passwordHash = await hashPassword(newPassword);
  row.mustChangePassword = false;
  row.updatedAt = new Date().toISOString();
  entry.used = true;
  store.passwordEpoch[e] = Number(store.passwordEpoch[e] || 0) + 1;
  writeStore(store);
  audit('PASSWORD_RESET_COMPLETED', { targetEmail: e, targetEmployeeNo: row.employeeNo });
  return { ok: true, status: 200, message: 'تم تعيين كلمة المرور الجديدة.', epoch: store.passwordEpoch[e] };
}

/**
 * Seed hashed credentials for legacy demo staff when HUB_ALLOW_LEGACY_DEMO=1.
 * Password must come from HUB_LEGACY_DEMO_PASSWORD (or HUB_E2E_PASSWORD) — never hardcoded.
 */
async function ensureLegacyDemoBootstrap() {
  if (!allowLegacyDemo()) return { ok: false, reason: 'disabled' };
  const pwd = process.env.HUB_LEGACY_DEMO_PASSWORD || process.env.HUB_E2E_PASSWORD;
  if (!pwd) {
    console.warn('[hub-staff-credentials] HUB_ALLOW_LEGACY_DEMO=1 but no HUB_LEGACY_DEMO_PASSWORD/HUB_E2E_PASSWORD');
    return { ok: false, reason: 'missing_env' };
  }
  const demos = [
    {
      email: 'malika@naiosh.com',
      name: 'المهندسة مليكة',
      employeeNo: 'EMP-0003',
      role: 'chief_engineer',
      naioshId: 'NAI-MALIKA-001',
    },
    {
      email: 'viewer@naiosh.com',
      name: 'موظف عرض العملاء',
      employeeNo: 'EMP-0099',
      role: 'admin',
      naioshId: 'NAI-VIEWER-099',
      permissions: [
        'clients.view',
        'clients.edit',
        'client_activity.view',
        'orders.view',
        'support.view',
        'notifications.view',
        'reports.view',
      ],
    },
  ];
  const hash = await hashPassword(String(pwd));
  const store = readStore();
  let created = 0;
  for (const d of demos) {
    if (store.credentials[d.email]?.passwordHash) continue;
    store.credentials[d.email] = {
      ...d,
      active: true,
      passwordHash: hash,
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdVia: 'legacy_demo_bootstrap',
    };
    store.passwordEpoch[d.email] = 1;
    created += 1;
  }
  if (created) writeStore(store);
  return { ok: true, created };
}

function getAudit(limit = 100) {
  return readStore().audit.slice(0, limit);
}

module.exports = {
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_EMP,
  SUPER_ADMIN_ROLE,
  SUPER_ADMIN_NAME,
  LEGACY_DEMO_EMAILS,
  STORE_PATH,
  hashPassword,
  verifyPassword,
  ensureSuperAdminBootstrap,
  bootstrapWithSetupCode,
  needsBootstrap,
  hydrateFromDb,
  applySuperAdminPassword,
  setPassword,
  verifyLoginPassword,
  upsertStaff,
  listStaff,
  staffStats,
  publicStaffRow,
  ROLE_LABEL_AR,
  getCredential,
  passwordEpoch,
  bumpEpoch,
  nextEmployeeNo,
  nextNaioshId,
  normalizePhone,
  normalizeAffiliation,
  ensureAccountId,
  updateOwnProfile,
  createResetToken,
  consumeResetToken,
  consumeResetTokenOnly,
  ensureLegacyDemoBootstrap,
  getAudit,
  audit,
  allowLegacyDemo,
  isLegacyDemoEmail,
  normalizeEmail,
  readStore,
};
