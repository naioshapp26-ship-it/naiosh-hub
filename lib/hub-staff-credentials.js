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

function readStore() {
  if (mem) return mem;
  ensureDir();
  try {
    if (!fs.existsSync(STORE_PATH)) {
      mem = defaultStore();
      writeStore(mem);
      return mem;
    }
    mem = { ...defaultStore(), ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) };
    mem.credentials = mem.credentials || {};
    mem.passwordEpoch = mem.passwordEpoch || {};
    mem.resetTokens = mem.resetTokens || {};
    mem.audit = Array.isArray(mem.audit) ? mem.audit : [];
  } catch {
    mem = defaultStore();
  }
  return mem;
}

function writeStore(store) {
  ensureDir();
  store.updatedAt = new Date().toISOString();
  mem = store;
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
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
  const store = readStore();
  const email = SUPER_ADMIN_EMAIL;
  if (store.credentials[email]?.passwordHash) {
    // Ensure identity fields
    store.credentials[email].employeeNo = SUPER_ADMIN_EMP;
    store.credentials[email].role = SUPER_ADMIN_ROLE;
    store.credentials[email].name = store.credentials[email].name || SUPER_ADMIN_NAME;
    store.credentials[email].active = store.credentials[email].active !== false;
    writeStore(store);
    return { ok: true, created: false, email, employeeNo: SUPER_ADMIN_EMP };
  }

  const initial = process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD;
  if (!initial) {
    console.warn(
      '[hub-staff-credentials] Super Admin has no password hash. Set HUB_SUPER_ADMIN_INITIAL_PASSWORD once to bootstrap (never commit the value).'
    );
    return { ok: false, created: false, email, reason: 'missing_env' };
  }

  // Bootstrap may use a weak owner-chosen initial; force change flag set.
  const hash = await hashPassword(String(initial));
  store.credentials[email] = {
    email,
    employeeNo: SUPER_ADMIN_EMP,
    role: SUPER_ADMIN_ROLE,
    name: SUPER_ADMIN_NAME,
    naioshId: 'NAI-LEADER-001',
    active: true,
    passwordHash: hash,
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdVia: 'bootstrap',
    migratedFrom: 'leader@naiosh.com',
  };
  store.passwordEpoch[email] = 1;
  writeStore(store);
  audit('SUPER_ADMIN_BOOTSTRAP', {
    targetEmail: email,
    targetEmployeeNo: SUPER_ADMIN_EMP,
    detail: 'Migrated EMP-0001 identity; password hash set; mustChangePassword=true',
  });
  // Clear env from process memory recommendation — caller should unset after boot
  return { ok: true, created: true, email, employeeNo: SUPER_ADMIN_EMP, mustChangePassword: true };
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

function upsertStaff({
  email,
  name,
  employeeNo,
  role,
  permissions,
  active = true,
  phone = '',
  workplace = '',
  passwordHash = null,
  mustChangePassword = true,
} = {}) {
  const store = readStore();
  const e = normalizeEmail(email);
  const prev = store.credentials[e] || {};
  store.credentials[e] = {
    ...prev,
    email: e,
    name: name || prev.name || e,
    employeeNo: employeeNo || prev.employeeNo,
    role: role || prev.role || 'admin',
    permissions: Array.isArray(permissions) ? permissions : prev.permissions,
    phone: phone || prev.phone || '',
    workplace: workplace || prev.workplace || '',
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
  return Object.values(store.credentials).map((c) => ({
    email: c.email,
    name: c.name,
    employeeNo: c.employeeNo,
    role: c.role,
    permissions: c.permissions || null,
    active: c.active !== false,
    phone: c.phone || '',
    workplace: c.workplace || '',
    mustChangePassword: !!c.mustChangePassword,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
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
  setPassword,
  verifyLoginPassword,
  upsertStaff,
  listStaff,
  getCredential,
  passwordEpoch,
  bumpEpoch,
  nextEmployeeNo,
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
