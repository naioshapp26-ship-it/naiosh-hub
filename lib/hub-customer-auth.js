/**
 * Customer registration & login for Naiosh Hub.
 * Local cache: data/customer-accounts.json (scrypt password hashes).
 * Durable source of truth: Postgres hub_meta (customer_accounts_v1) + hub_users
 * when DATABASE_URL is set — survives Railway redeploys / ephemeral disks.
 * Role is ALWAYS forced server-side to "customer" — never trust the client.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const { getDatabaseUrl } = require('../db/migrate');

const scryptAsync = promisify(crypto.scrypt);

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const STORE_PATH = path.join(DATA_DIR, 'customer-accounts.json');
const CUSTOMER_ROLE = 'customer';
const SCRYPT_KEYLEN = 64;
const META_KEY = 'customer_accounts_v1';

/** Staff emails — must never be registered as customers. */
const RESERVED_STAFF_EMAILS = new Set([
  'leader@naiosh.com',
  'malika@naiosh.com',
  'naioshhub@example.com',
  'viewer@naiosh.com',
]);

let mem = null;
let dbHydrated = false;
let dbWriteQueue = Promise.resolve();

function blankStore() {
  return { version: 1, accounts: [], updatedAt: new Date().toISOString() };
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(blankStore(), null, 2), 'utf8');
  }
}

function readStoreFromFile() {
  ensureStore();
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return {
      version: 1,
      accounts: Array.isArray(raw.accounts) ? raw.accounts : [],
      updatedAt: raw.updatedAt || new Date().toISOString(),
    };
  } catch {
    return blankStore();
  }
}

function accountEmailKey(account) {
  return normalizeEmail(account?.email);
}

function mergeAccountLists(primary = [], secondary = []) {
  const byEmail = new Map();
  for (const a of secondary) {
    const key = accountEmailKey(a);
    if (key) byEmail.set(key, a);
  }
  for (const a of primary) {
    const key = accountEmailKey(a);
    if (!key) continue;
    const prev = byEmail.get(key);
    if (!prev) {
      byEmail.set(key, a);
      continue;
    }
    const prevTs = Date.parse(prev.updatedAt || prev.createdAt || 0) || 0;
    const nextTs = Date.parse(a.updatedAt || a.createdAt || 0) || 0;
    byEmail.set(key, nextTs >= prevTs ? { ...prev, ...a } : { ...a, ...prev });
  }
  return Array.from(byEmail.values()).sort((a, b) => {
    const ta = Date.parse(a.createdAt || 0) || 0;
    const tb = Date.parse(b.createdAt || 0) || 0;
    return tb - ta;
  });
}

async function loadStoreFromDb() {
  try {
    const { getDatabaseUrl: dbUrl, withClient } = require('../db/migrate');
    if (!dbUrl()) return null;
    return await withClient(async (client) => {
      const r = await client.query(`SELECT value FROM hub_meta WHERE key = $1 LIMIT 1`, [META_KEY]);
      if (!r.rows[0]?.value) return null;
      const value = r.rows[0].value;
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return {
        version: 1,
        accounts: Array.isArray(parsed?.accounts) ? parsed.accounts : [],
        updatedAt: parsed?.updatedAt || new Date().toISOString(),
      };
    });
  } catch (err) {
    console.warn('[hub-customer-auth] DB load skipped:', err.message);
    return null;
  }
}

function hubUserRowToAccount(row) {
  if (!row?.email) return null;
  const email = normalizeEmail(row.email);
  const now = new Date().toISOString();
  return {
    id: `cust-db-${crypto.createHash('sha1').update(email).digest('hex').slice(0, 10)}`,
    customerId: makeCustomerId(email),
    fullName: row.name_ar || email,
    username: row.username || deriveUsernameFromEmail(email),
    email,
    phone: row.phone || '',
    passwordHash: row.password_hash,
    role: CUSTOMER_ROLE,
    platform: row.platform || 'naiosh-hub-360',
    status: row.is_active === false ? 'disabled' : 'active',
    governorate: '',
    city: '',
    address: '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : now,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : now,
    createdVia: 'hub_users_hydrate',
  };
}

async function loadAccountsFromHubUsers(emailFilter) {
  try {
    const { getDatabaseUrl: dbUrl, withClient } = require('../db/migrate');
    if (!dbUrl()) return [];
    return await withClient(async (client) => {
      const params = [];
      let sql = `
        SELECT email, password_hash, name_ar, username, phone, role, platform, is_active, created_at, updated_at
        FROM hub_users
        WHERE LOWER(role) = $1`;
      params.push(CUSTOMER_ROLE);
      if (emailFilter) {
        params.push(normalizeEmail(emailFilter));
        sql += ` AND LOWER(email) = $2`;
      }
      const r = await client.query(sql, params);
      return (r.rows || []).map(hubUserRowToAccount).filter(Boolean);
    });
  } catch (err) {
    console.warn('[hub-customer-auth] hub_users load skipped:', err.message);
    return [];
  }
}

function persistStoreToDb(store) {
  dbWriteQueue = dbWriteQueue
    .then(async () => {
      try {
        const { getDatabaseUrl: dbUrl, withClient } = require('../db/migrate');
        if (!dbUrl()) return;
        const payload = {
          version: 1,
          accounts: Array.isArray(store.accounts) ? store.accounts : [],
          updatedAt: store.updatedAt || new Date().toISOString(),
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
        console.warn('[hub-customer-auth] DB persist skipped:', err.message);
      }
    })
    .catch(() => {});
  return dbWriteQueue;
}

/**
 * Prefer Postgres hub_meta / hub_users over ephemeral disk (Railway redeploys wipe local data/).
 */
async function hydrateFromDb() {
  if (dbHydrated && mem) return mem;
  dbHydrated = true;
  const fromDb = await loadStoreFromDb();
  const fromUsers = await loadAccountsFromHubUsers();
  const fromFile = readStoreFromFile();

  let accounts = mergeAccountLists(fromDb?.accounts || [], fromFile.accounts || []);
  accounts = mergeAccountLists(accounts, fromUsers);

  mem = {
    version: 1,
    accounts,
    updatedAt: new Date().toISOString(),
  };

  try {
    ensureStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(mem, null, 2), 'utf8');
  } catch {
    /* ignore */
  }

  if (accounts.length) {
    await persistStoreToDb(mem);
  } else if (fromFile.accounts?.length) {
    await persistStoreToDb(fromFile);
  }

  return mem;
}

async function refreshAccountFromDb(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const fromDb = await loadStoreFromDb();
  const fromMeta = (fromDb?.accounts || []).find((a) => normalizeEmail(a.email) === normalized) || null;
  const fromUsers = (await loadAccountsFromHubUsers(normalized))[0] || null;
  const remote = fromMeta && fromUsers
    ? mergeAccountLists([fromMeta], [fromUsers])[0]
    : fromMeta || fromUsers;
  if (!remote) return null;

  const store = readStore();
  const idx = (store.accounts || []).findIndex((a) => normalizeEmail(a.email) === normalized);
  if (idx >= 0) store.accounts[idx] = { ...store.accounts[idx], ...remote };
  else store.accounts.unshift(remote);
  writeStore(store);
  return remote;
}

function readStore() {
  if (mem) return mem;
  mem = readStoreFromFile();
  return mem;
}

function writeStore(store) {
  ensureStore();
  const next = {
    version: 1,
    accounts: Array.isArray(store.accounts) ? store.accounts : [],
    updatedAt: new Date().toISOString(),
  };
  mem = next;
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(next, null, 2), 'utf8');
  } catch (err) {
    console.warn('[hub-customer-auth] file write failed:', err.message);
  }
  persistStoreToDb(next);
  return next;
}

async function flushDurable() {
  await dbWriteQueue;
}

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function normalizeUsername(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function normalizePhone(v) {
  return String(v || '')
    .trim()
    .replace(/[\s\-()]/g, '');
}

function normalizeName(v) {
  return String(v || '').trim().replace(/\s+/g, ' ');
}

function makeId() {
  return `cust-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}

/** Stable public Customer ID (CL-XXXXXXXX) — independent from email and employee IDs. */
function makeCustomerId(email) {
  return `CL-${crypto.createHash('sha1').update(String(email || '').toLowerCase()).digest('hex').slice(0, 8).toUpperCase()}`;
}

function makeToken(email) {
  return `hub360.cust.${Buffer.from(email).toString('base64url')}.${Date.now()}`;
}

function publicUser(account) {
  if (!account) return null;
  const customerId = account.customerId || makeCustomerId(account.email);
  return {
    id: account.id,
    customerId,
    clientId: customerId,
    fullName: account.fullName,
    name: account.fullName,
    username: account.username,
    email: account.email,
    phone: account.phone,
    role: CUSTOMER_ROLE,
    platform: 'naiosh-hub-360',
    createdAt: account.createdAt,
  };
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

const policy = require('./hub-password-policy');
const MIN_PASSWORD_LENGTH = policy.MIN_LEN;

function passwordStrength(password) {
  const check = policy.analyze(password);
  if (!check.ok) {
    return {
      ok: false,
      rules: check.rules,
      minLength: MIN_PASSWORD_LENGTH,
      error: check.error,
    };
  }
  return { ok: true, rules: check.rules, minLength: MIN_PASSWORD_LENGTH };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username) {
  return /^[a-z0-9._-]{3,32}$/.test(username);
}

/** Internal handle derived from email — not collected on the public create-account form. */
function deriveUsernameFromEmail(email) {
  const local = String(email || '').split('@')[0] || 'user';
  let u = normalizeUsername(local).replace(/[^a-z0-9._-]/g, '');
  if (u.length < 3) u = `${u}usr`.slice(0, 3);
  return u.slice(0, 32);
}

function uniqueUsername(base, accounts) {
  let candidate = base;
  let n = 0;
  const taken = new Set(
    (accounts || []).map((a) => normalizeUsername(a.username)).filter(Boolean)
  );
  while (taken.has(candidate) && n < 50) {
    n += 1;
    const suffix = Date.now().toString(36).slice(-4) + String(n);
    candidate = `${base}`.slice(0, Math.max(3, 32 - suffix.length)) + suffix;
  }
  return candidate.slice(0, 32);
}

function isValidPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 && /^\+?[0-9]+$/.test(phone);
}

function validateRegistrationInput(payload = {}) {
  const fullName = normalizeName(payload.fullName || payload.name);
  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.phone);
  const password = String(payload.password || '');
  const confirmPassword = String(payload.confirmPassword || payload.passwordConfirm || '');
  const termsAccepted =
    payload.termsAccepted === true ||
    payload.termsAccepted === 'true' ||
    payload.termsAccepted === 'on' ||
    payload.acceptTerms === true;

  // Client-supplied role is ignored completely (security)
  void payload.role;

  if (!fullName || fullName.length < 2) {
    return { ok: false, error: 'من فضلك أكمل جميع البيانات المطلوبة.', field: 'fullName' };
  }
  if (!email || !isValidEmail(email)) {
    return { ok: false, error: 'صيغة البريد الإلكتروني غير صحيحة.', field: 'email' };
  }
  if (!phone || !isValidPhone(phone)) {
    return { ok: false, error: 'رقم الهاتف غير صالح.', field: 'phone' };
  }
  const strength = passwordStrength(password);
  if (!strength.ok) {
    return {
      ok: false,
      error: strength.error || 'كلمة المرور مطلوبة.',
      field: 'password',
      strength,
    };
  }
  if (password !== confirmPassword) {
    return { ok: false, error: 'كلمتا المرور غير متطابقتين.', field: 'confirmPassword' };
  }
  if (!termsAccepted) {
    return { ok: false, error: 'يجب الموافقة على الشروط وسياسة الخصوصية.', field: 'terms' };
  }

  // Username is optional on the public form — derive a unique internal handle from email.
  let username = normalizeUsername(payload.username);
  if (username && !isValidUsername(username)) {
    username = '';
  }
  if (!username) {
    username = deriveUsernameFromEmail(email);
  }

  return {
    ok: true,
    data: {
      fullName,
      username,
      email,
      phone,
      password,
      governorate: normalizeName(payload.governorate || ''),
      city: normalizeName(payload.city || ''),
      address: normalizeName(payload.address || ''),
    },
  };
}

async function mirrorToPostgres(account) {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) return;
  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: databaseUrl,
      ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? false : { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query(`
      ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS username TEXT;
      ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS phone TEXT;
    `);
    await client.query(
      `INSERT INTO hub_users (email, password_hash, name_ar, role, platform, is_active)
       VALUES ($1, $2, $3, $4, 'naiosh-hub-360', TRUE)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         name_ar = EXCLUDED.name_ar,
         role = $4,
         updated_at = NOW()`,
      [account.email, account.passwordHash, account.fullName, CUSTOMER_ROLE]
    );
    await client.query(
      `UPDATE hub_users SET username = $2, phone = $3, updated_at = NOW() WHERE email = $1`,
      [account.email, account.username, account.phone]
    );
    await client.end();
  } catch {
    /* DB optional — JSON file is the source of truth when DB is unavailable */
  }
}

async function register(payload = {}) {
  const validated = validateRegistrationInput(payload);
  if (!validated.ok) {
    return {
      ok: false,
      status: 400,
      error: validated.error,
      field: validated.field,
      strength: validated.strength,
    };
  }

  const { data } = validated;
  await hydrateFromDb();
  // Refresh this email from durable store in case another replica registered it.
  await refreshAccountFromDb(data.email);
  const store = readStore();
  const accounts = store.accounts || [];

  if (RESERVED_STAFF_EMAILS.has(data.email)) {
    return {
      ok: false,
      status: 409,
      error: 'هذا البريد محجوز لحساب تشغيلي ولا يمكن استخدامه لتسجيل عميل.',
      field: 'email',
    };
  }

  if (accounts.some((a) => normalizeEmail(a.email) === data.email)) {
    return { ok: false, status: 409, error: 'هذا البريد الإلكتروني مستخدم بالفعل.', field: 'email' };
  }
  if (accounts.some((a) => normalizePhone(a.phone) === data.phone)) {
    return { ok: false, status: 409, error: 'رقم الهاتف مستخدم بالفعل.', field: 'phone' };
  }

  const username = uniqueUsername(data.username || deriveUsernameFromEmail(data.email), accounts);

  const passwordHash = await hashPassword(data.password);
  const now = new Date().toISOString();
  const account = {
    id: makeId(),
    customerId: makeCustomerId(data.email),
    fullName: data.fullName,
    username,
    email: data.email,
    phone: data.phone,
    passwordHash,
    role: CUSTOMER_ROLE,
    platform: 'naiosh-hub-360',
    status: 'active',
    governorate: data.governorate || '',
    city: data.city || '',
    address: data.address || '',
    createdAt: now,
    updatedAt: now,
  };

  accounts.unshift(account);
  writeStore({ accounts });
  await mirrorToPostgres(account);
  await flushDurable();

  return {
    ok: true,
    status: 201,
    success: true,
    message: 'تم إنشاء الحساب بنجاح',
    token: makeToken(account.email),
    user: publicUser(account),
  };
}

async function login({ email, password } = {}) {
  const normalized = normalizeEmail(email);
  const pass = String(password || '');
  if (!normalized || !pass) {
    return { ok: false, status: 400, error: 'من فضلك أكمل جميع البيانات المطلوبة.' };
  }

  await hydrateFromDb();
  let store = readStore();
  let account = (store.accounts || []).find(
    (a) => normalizeEmail(a.email) === normalized && a.status !== 'disabled'
  );

  // Multi-replica / post-redeploy: local JSON may be empty while Postgres still has the hash.
  if (!account) {
    account = await refreshAccountFromDb(normalized);
    if (account && account.status === 'disabled') account = null;
  }

  if (!account) {
    return { ok: false, status: 401, error: 'بيانات الدخول غير صحيحة.' };
  }

  let valid = await verifyPassword(pass, account.passwordHash);
  if (!valid) {
    // Prefer latest durable hash (password changed on another instance).
    const refreshed = await refreshAccountFromDb(normalized);
    if (refreshed && refreshed.status !== 'disabled') {
      account = refreshed;
      valid = await verifyPassword(pass, account.passwordHash);
    }
  }
  if (!valid) {
    return { ok: false, status: 401, error: 'بيانات الدخول غير صحيحة.' };
  }

  return {
    ok: true,
    status: 200,
    success: true,
    message: 'تم تسجيل الدخول بنجاح',
    token: makeToken(account.email),
    user: publicUser(account),
  };
}

function findByEmail(email) {
  const normalized = normalizeEmail(email);
  return (readStore().accounts || []).find((a) => normalizeEmail(a.email) === normalized) || null;
}

/**
 * Staff-provisioned customer (إدارة العملاء).
 * Creates a real customer account without public self-registration terms UX.
 * Role is always forced to customer — never employee/admin.
 */
async function adminCreateCustomer(payload = {}, actor = {}) {
  const fullName = normalizeName(payload.fullName || payload.name);
  const email = normalizeEmail(payload.email);
  let phone = normalizePhone(payload.phone);
  let username = normalizeUsername(payload.username);
  let password = String(payload.password || '');

  if (!fullName || fullName.length < 2) {
    return { ok: false, status: 400, error: 'الاسم مطلوب.', field: 'name' };
  }
  if (!email || !isValidEmail(email)) {
    return { ok: false, status: 400, error: 'صيغة البريد الإلكتروني غير صحيحة.', field: 'email' };
  }
  if (RESERVED_STAFF_EMAILS.has(email)) {
    return {
      ok: false,
      status: 409,
      error: 'هذا البريد محجوز لحساب تشغيلي ولا يمكن استخدامه لتسجيل عميل.',
      field: 'email',
    };
  }

  if (!username) {
    const local = email.split('@')[0] || 'client';
    username = normalizeUsername(local).slice(0, 28) || 'client';
    if (!isValidUsername(username)) username = `cli${Date.now().toString(36)}`.slice(0, 32);
  } else if (!isValidUsername(username)) {
    return {
      ok: false,
      status: 400,
      error: 'اسم المستخدم غير صالح. استخدم 3–32 حرفًا (لاتينية/أرقام/._-).',
      field: 'username',
    };
  }

  if (!phone) {
    // Deterministic unique-enough demo phone derived from email hash (admin UI may omit phone).
    const digits = crypto.createHash('sha1').update(email).digest('hex').replace(/\D/g, '').slice(0, 8);
    phone = `+97059${(digits + '00000000').slice(0, 8)}`;
  } else if (!isValidPhone(phone)) {
    return { ok: false, status: 400, error: 'رقم الهاتف غير صالح.', field: 'phone' };
  }

  if (!password) {
    password = `Cust@${crypto.randomBytes(4).toString('hex')}9A`;
  }
  const strength = passwordStrength(password);
  if (!strength.ok) {
    return {
      ok: false,
      status: 400,
      error: `كلمة المرور قصيرة جدًا. اكتبي على الأقل ${MIN_PASSWORD_LENGTH} أحرف أو أرقام.`,
      field: 'password',
      strength,
    };
  }

  await hydrateFromDb();
  await refreshAccountFromDb(email);
  const store = readStore();
  const accounts = store.accounts || [];
  if (accounts.some((a) => normalizeEmail(a.email) === email)) {
    return { ok: false, status: 409, error: 'هذا البريد الإلكتروني مستخدم بالفعل.', field: 'email' };
  }
  if (accounts.some((a) => normalizeUsername(a.username) === username)) {
    // Soft-unique username for admin path
    username = `${username}`.slice(0, 24) + Date.now().toString(36).slice(-6);
  }
  if (accounts.some((a) => normalizePhone(a.phone) === phone)) {
    phone = `+97059${String(Date.now()).slice(-8)}`;
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const customerId = makeCustomerId(email);
  const createdByEmployeeId = actor.employeeNo || null;
  const createdByEmail = actor.email || null;
  const account = {
    id: makeId(),
    customerId,
    fullName,
    username,
    email,
    phone,
    passwordHash,
    role: CUSTOMER_ROLE,
    platform: 'naiosh-hub-360',
    status: 'active',
    governorate: normalizeName(payload.governorate || ''),
    city: normalizeName(payload.city || ''),
    address: normalizeName(payload.address || ''),
    createdAt: now,
    updatedAt: now,
    createdByEmployeeId,
    createdByEmail,
    createdVia: 'admin_clients',
  };

  accounts.unshift(account);
  writeStore({ accounts });
  await mirrorToPostgres(account);
  await flushDurable();

  return {
    ok: true,
    status: 201,
    success: true,
    message: 'تم إنشاء العميل بنجاح.',
    tempPassword: password,
    user: publicUser(account),
    account,
  };
}

module.exports = {
  CUSTOMER_ROLE,
  STORE_PATH,
  RESERVED_STAFF_EMAILS,
  META_KEY,
  register,
  login,
  adminCreateCustomer,
  findByEmail,
  publicUser,
  makeCustomerId,
  makeToken,
  passwordStrength,
  hashPassword,
  verifyPassword,
  validateRegistrationInput,
  readStore,
  writeStore,
  hydrateFromDb,
  refreshAccountFromDb,
  flushDurable,
};
