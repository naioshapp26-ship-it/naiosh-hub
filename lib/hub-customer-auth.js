/**
 * Customer registration & login for Naiosh Hub.
 *
 * Durable source of truth (production): Postgres `hub_users` — one row per customer.
 * Local `data/customer-accounts.json` + in-memory map are caches only (dev / hot path).
 * Never store plaintext passwords — scrypt hashes only.
 * Role is ALWAYS forced server-side to "customer" — never trust the client.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const { getDatabaseUrl, withClient } = require('../db/migrate');

const scryptAsync = promisify(crypto.scrypt);

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const STORE_PATH = path.join(DATA_DIR, 'customer-accounts.json');
const CUSTOMER_ROLE = 'customer';
const SCRYPT_KEYLEN = 64;
/** OWASP-aligned scrypt params — do NOT lower N to chase load-test score. */
const SCRYPT_N = Math.max(16384, Number(process.env.HUB_SCRYPT_N || 16384));
const SCRYPT_R = Math.max(8, Number(process.env.HUB_SCRYPT_R || 8));
const SCRYPT_P = Math.max(1, Number(process.env.HUB_SCRYPT_P || 1));
const SCRYPT_OPTS = { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024 };
const META_KEY = 'customer_accounts_v1'; // legacy blob — migrated once into hub_users, not used at scale
/** Skip full-table hydrate above this count (login/register use indexed SQL). */
const HYDRATE_MAX = Number(process.env.HUB_CUSTOMER_HYDRATE_MAX || 2000);

/** Staff emails — must never be registered as customers. */
const RESERVED_STAFF_EMAILS = new Set([
  'leader@naiosh.com',
  'malika@naiosh.com',
  'naioshhub@example.com',
  'viewer@naiosh.com',
]);

let mem = null;
let dbHydrated = false;
let schemaReady = false;
/** email -> account (hot cache; never the sole durable store) */
const hotCache = new Map();

function dbEnabled() {
  return !!getDatabaseUrl();
}

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
  const tokenCrypto = require('./hub-token-crypto');
  const body = `hub360.cust.${Buffer.from(String(email || '').toLowerCase()).toString('base64url')}.${Date.now()}`;
  return tokenCrypto.signTokenBody(body);
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
  const derived = await scryptAsync(String(password), salt, SCRYPT_KEYLEN, SCRYPT_OPTS);
  // Encode params so future tuning can verify legacy hashes without silent mismatch
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${Buffer.from(derived).toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const raw = String(stored || '');
  if (!raw.startsWith('scrypt$')) return false;
  const parts = raw.split('$');
  // Legacy: scrypt$salt$hash  |  New: scrypt$N$r$p$salt$hash
  let salt;
  let expected;
  let opts = SCRYPT_OPTS;
  if (parts.length === 3) {
    salt = Buffer.from(parts[1], 'hex');
    expected = Buffer.from(parts[2], 'hex');
    opts = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
  } else if (parts.length === 6) {
    opts = {
      N: Number(parts[1]) || SCRYPT_N,
      r: Number(parts[2]) || SCRYPT_R,
      p: Number(parts[3]) || SCRYPT_P,
      maxmem: 64 * 1024 * 1024,
    };
    salt = Buffer.from(parts[4], 'hex');
    expected = Buffer.from(parts[5], 'hex');
  } else {
    return false;
  }
  const derived = await scryptAsync(String(password), salt, expected.length || SCRYPT_KEYLEN, opts);
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

function deriveUsernameFromEmail(email) {
  const local = String(email || '').split('@')[0] || 'user';
  let u = normalizeUsername(local).replace(/[^a-z0-9._-]/g, '');
  if (u.length < 3) u = `${u}usr`.slice(0, 3);
  return u.slice(0, 32);
}

function isValidPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 && /^\+?[0-9]+$/.test(phone);
}

function cachePut(account) {
  if (!account?.email) return;
  hotCache.set(normalizeEmail(account.email), account);
}

function cacheGet(email) {
  return hotCache.get(normalizeEmail(email)) || null;
}

function rowToAccount(row) {
  if (!row?.email) return null;
  const email = normalizeEmail(row.email);
  const now = new Date().toISOString();
  return {
    id: row.customer_uid || `cust-db-${crypto.createHash('sha1').update(email).digest('hex').slice(0, 10)}`,
    customerId: row.customer_id || makeCustomerId(email),
    fullName: row.name_ar || email,
    username: row.username || deriveUsernameFromEmail(email),
    email,
    phone: row.phone || '',
    passwordHash: row.password_hash,
    passwordEpoch: Number(row.password_epoch || 0),
    role: CUSTOMER_ROLE,
    platform: row.platform || 'naiosh-hub-360',
    status: row.is_active === false || row.status === 'disabled' ? 'disabled' : row.status || 'active',
    governorate: row.governorate || '',
    city: row.city || '',
    address: row.address || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : now,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : now,
  };
}

async function ensureCustomerSchema() {
  if (!dbEnabled()) return false;
  if (schemaReady) return true;
  await withClient(async (client) => {
    await client.query(`
      ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS username TEXT;
      ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS phone TEXT;
      ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS customer_id TEXT;
      ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS customer_uid TEXT;
      ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
      ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS password_epoch INT DEFAULT 0;
      ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS governorate TEXT;
      ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS city TEXT;
      ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS address TEXT;
      CREATE INDEX IF NOT EXISTS hub_users_role_email_idx ON hub_users (role, email);
      CREATE INDEX IF NOT EXISTS hub_users_customer_id_idx ON hub_users (customer_id);
    `);
  });
  schemaReady = true;
  return true;
}

async function dbFindByEmail(email) {
  if (!dbEnabled()) return null;
  await ensureCustomerSchema();
  const normalized = normalizeEmail(email);
  return withClient(async (client) => {
    const r = await client.query(
      `SELECT * FROM hub_users WHERE LOWER(email) = $1 AND LOWER(role) = $2 LIMIT 1`,
      [normalized, CUSTOMER_ROLE]
    );
    const account = rowToAccount(r.rows[0]);
    if (account) cachePut(account);
    return account;
  });
}

async function dbFindByPhone(phone) {
  if (!dbEnabled() || !phone) return null;
  await ensureCustomerSchema();
  const normalized = normalizePhone(phone);
  return withClient(async (client) => {
    const r = await client.query(
      `SELECT * FROM hub_users WHERE phone = $1 AND LOWER(role) = $2 LIMIT 1`,
      [normalized, CUSTOMER_ROLE]
    );
    return rowToAccount(r.rows[0]);
  });
}

async function dbUsernameTaken(username, exceptEmail) {
  if (!dbEnabled() || !username) return false;
  await ensureCustomerSchema();
  return withClient(async (client) => {
    const r = await client.query(
      `SELECT email FROM hub_users
       WHERE LOWER(username) = $1 AND LOWER(role) = $2
         AND ($3::text IS NULL OR LOWER(email) <> $3)
       LIMIT 1`,
      [normalizeUsername(username), CUSTOMER_ROLE, exceptEmail ? normalizeEmail(exceptEmail) : null]
    );
    return r.rows.length > 0;
  });
}

async function dbCountCustomers() {
  if (!dbEnabled()) return 0;
  await ensureCustomerSchema();
  return withClient(async (client) => {
    const r = await client.query(
      `SELECT COUNT(*)::int AS n FROM hub_users WHERE LOWER(role) = $1`,
      [CUSTOMER_ROLE]
    );
    return r.rows[0]?.n || 0;
  });
}

async function dbUpsertAccount(account) {
  if (!dbEnabled()) return { ok: false, reason: 'no_db' };
  await ensureCustomerSchema();
  try {
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO hub_users (
           email, password_hash, name_ar, role, platform, is_active,
           username, phone, customer_id, customer_uid, status, password_epoch,
           governorate, city, address, created_at, updated_at
         ) VALUES (
           $1,$2,$3,$4,'naiosh-hub-360',$5,
           $6,$7,$8,$9,$10,$11,
           $12,$13,$14, COALESCE($15::timestamptz, NOW()), NOW()
         )
         ON CONFLICT (email) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           name_ar = EXCLUDED.name_ar,
           role = EXCLUDED.role,
           is_active = EXCLUDED.is_active,
           username = EXCLUDED.username,
           phone = EXCLUDED.phone,
           customer_id = EXCLUDED.customer_id,
           customer_uid = COALESCE(hub_users.customer_uid, EXCLUDED.customer_uid),
           status = EXCLUDED.status,
           password_epoch = EXCLUDED.password_epoch,
           governorate = EXCLUDED.governorate,
           city = EXCLUDED.city,
           address = EXCLUDED.address,
           updated_at = NOW()`,
        [
          account.email,
          account.passwordHash,
          account.fullName,
          CUSTOMER_ROLE,
          account.status !== 'disabled',
          account.username || null,
          account.phone || null,
          account.customerId || makeCustomerId(account.email),
          account.id,
          account.status || 'active',
          Number(account.passwordEpoch || 0),
          account.governorate || null,
          account.city || null,
          account.address || null,
          account.createdAt || null,
        ]
      );
    });
    cachePut(account);
    return { ok: true };
  } catch (err) {
    if (err && (err.code === '23505' || /duplicate|unique/i.test(err.message || ''))) {
      return { ok: false, reason: 'conflict', error: err.message, code: err.code };
    }
    console.error('[hub-customer-auth] dbUpsertAccount failed:', err.message);
    return { ok: false, reason: 'db_error', error: err.message };
  }
}

async function dbInsertAccount(account) {
  if (!dbEnabled()) return { ok: false, reason: 'no_db' };
  await ensureCustomerSchema();
  try {
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO hub_users (
           email, password_hash, name_ar, role, platform, is_active,
           username, phone, customer_id, customer_uid, status, password_epoch,
           governorate, city, address, created_at, updated_at
         ) VALUES (
           $1,$2,$3,$4,'naiosh-hub-360',TRUE,
           $5,$6,$7,$8,'active',$9,
           $10,$11,$12, NOW(), NOW()
         )`,
        [
          account.email,
          account.passwordHash,
          account.fullName,
          CUSTOMER_ROLE,
          account.username || null,
          account.phone || null,
          account.customerId,
          account.id,
          Number(account.passwordEpoch || 0),
          account.governorate || null,
          account.city || null,
          account.address || null,
        ]
      );
    });
    cachePut(account);
    return { ok: true };
  } catch (err) {
    if (err && err.code === '23505') {
      const msg = String(err.detail || err.message || '');
      if (/phone/i.test(msg)) return { ok: false, reason: 'phone', field: 'phone' };
      if (/username/i.test(msg)) return { ok: false, reason: 'username', field: 'username' };
      return { ok: false, reason: 'email', field: 'email' };
    }
    console.error('[hub-customer-auth] dbInsertAccount failed:', err.message);
    return { ok: false, reason: 'db_error', error: err.message };
  }
}

/** Migrate legacy hub_meta blob into hub_users once (no longer used as primary store). */
async function migrateLegacyMetaBlob() {
  if (!dbEnabled()) return 0;
  try {
    return await withClient(async (client) => {
      const r = await client.query(`SELECT value FROM hub_meta WHERE key = $1 LIMIT 1`, [META_KEY]);
      if (!r.rows[0]?.value) return 0;
      const value = r.rows[0].value;
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      const accounts = Array.isArray(parsed?.accounts) ? parsed.accounts : [];
      let n = 0;
      for (const a of accounts) {
        if (!a?.email || !a?.passwordHash) continue;
        const up = await dbUpsertAccount({
          ...a,
          email: normalizeEmail(a.email),
          customerId: a.customerId || makeCustomerId(a.email),
          id: a.id || makeId(),
          status: a.status || 'active',
        });
        if (up.ok) n += 1;
      }
      return n;
    });
  } catch (err) {
    console.warn('[hub-customer-auth] legacy meta migrate skipped:', err.message);
    return 0;
  }
}

let cacheFlushTimer = null;
let cacheDirty = false;

function touchLocalCache(account) {
  cachePut(account);
  if (!mem) mem = readStoreFromFile();
  const idx = (mem.accounts || []).findIndex((a) => normalizeEmail(a.email) === normalizeEmail(account.email));
  if (idx >= 0) mem.accounts[idx] = { ...mem.accounts[idx], ...account };
  else {
    mem.accounts = mem.accounts || [];
    mem.accounts.unshift(account);
    // Keep local cache bounded — hot accounts only when DB is primary
    if (dbEnabled() && mem.accounts.length > 500) mem.accounts.length = 500;
  }
  mem.updatedAt = new Date().toISOString();
  // When Postgres is primary, avoid sync full-file writes on every register (IO storm under load).
  if (!dbEnabled()) {
    writeStoreLocal(mem);
    return;
  }
  cacheDirty = true;
  if (!cacheFlushTimer) {
    cacheFlushTimer = setTimeout(() => {
      cacheFlushTimer = null;
      if (cacheDirty && mem) {
        cacheDirty = false;
        writeStoreLocal(mem);
      }
    }, 2000);
    if (typeof cacheFlushTimer.unref === 'function') cacheFlushTimer.unref();
  }
}

function writeStoreLocal(store) {
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
  return next;
}

/**
 * Boot hydrate: ensure schema, migrate legacy blob, optionally warm cache.
 * Does NOT load unbounded tables into memory when count is large.
 */
async function hydrateFromDb() {
  if (dbHydrated && mem) return mem;
  dbHydrated = true;
  const fromFile = readStoreFromFile();
  mem = fromFile;

  if (!dbEnabled()) {
    for (const a of mem.accounts || []) cachePut(a);
    return mem;
  }

  await ensureCustomerSchema();
  const migrated = await migrateLegacyMetaBlob();
  if (migrated) console.log(`[hub-customer-auth] migrated ${migrated} accounts from legacy hub_meta blob`);

  // Promote any file-only accounts into Postgres (one-time recovery after older deploys)
  for (const a of fromFile.accounts || []) {
    if (a?.email && a?.passwordHash) {
      const existing = await dbFindByEmail(a.email);
      if (!existing) await dbUpsertAccount(a);
    }
  }

  const count = await dbCountCustomers();
  if (count <= HYDRATE_MAX) {
    const rows = await withClient(async (client) => {
      const r = await client.query(
        `SELECT * FROM hub_users WHERE LOWER(role) = $1 ORDER BY created_at DESC`,
        [CUSTOMER_ROLE]
      );
      return r.rows || [];
    });
    const accounts = rows.map(rowToAccount).filter(Boolean);
    for (const a of accounts) cachePut(a);
    mem = { version: 1, accounts, updatedAt: new Date().toISOString() };
    writeStoreLocal(mem);
  } else {
    console.warn(
      `[hub-customer-auth] ${count} customers — skipping full memory hydrate (limit ${HYDRATE_MAX}); SQL path used for auth`
    );
    mem = blankStore();
  }
  return mem;
}

async function refreshAccountFromDb(email) {
  const account = await dbFindByEmail(email);
  if (account) touchLocalCache(account);
  return account;
}

function readStore() {
  if (mem) return mem;
  mem = readStoreFromFile();
  for (const a of mem.accounts || []) cachePut(a);
  return mem;
}

function writeStore(store) {
  const next = writeStoreLocal(store);
  // When DB is enabled, durable writes must go through persistAccount / register / login paths.
  // Still best-effort upsert changed rows if callers mutate then writeStore (password change).
  if (dbEnabled()) {
    const accounts = next.accounts || [];
    // Upsert at most the first few recently touched (password-change callers put row at find index)
    Promise.resolve()
      .then(async () => {
        for (const a of accounts.slice(0, 20)) {
          if (a?.email && a?.passwordHash) await dbUpsertAccount(a);
        }
      })
      .catch(() => {});
  }
  return next;
}

async function flushDurable() {
  /* row upserts await in register/persistAccount; nothing queued */
}

async function persistAccount(account) {
  touchLocalCache(account);
  if (dbEnabled()) {
    const up = await dbUpsertAccount(account);
    if (!up.ok) throw Object.assign(new Error(up.error || 'فشل حفظ الحساب في قاعدة البيانات'), { status: 500 });
  }
  return account;
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

  let username = normalizeUsername(payload.username);
  if (username && !isValidUsername(username)) username = '';
  if (!username) username = deriveUsernameFromEmail(email);

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

async function uniqueUsernameAsync(base, email) {
  let candidate = base;
  let n = 0;
  while (n < 50) {
    const takenDb = dbEnabled() ? await dbUsernameTaken(candidate, email) : false;
    const takenLocal = (readStore().accounts || []).some(
      (a) => normalizeUsername(a.username) === candidate && normalizeEmail(a.email) !== normalizeEmail(email)
    );
    if (!takenDb && !takenLocal) return candidate.slice(0, 32);
    n += 1;
    const suffix = Date.now().toString(36).slice(-4) + String(n);
    candidate = `${base}`.slice(0, Math.max(3, 32 - suffix.length)) + suffix;
  }
  return `${base}`.slice(0, 24) + crypto.randomBytes(3).toString('hex');
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
  if (RESERVED_STAFF_EMAILS.has(data.email)) {
    return {
      ok: false,
      status: 409,
      error: 'هذا البريد محجوز لحساب تشغيلي ولا يمكن استخدامه لتسجيل عميل.',
      field: 'email',
    };
  }

  await hydrateFromDb();

  if (dbEnabled()) {
    const byEmail = await dbFindByEmail(data.email);
    if (byEmail) {
      return { ok: false, status: 409, error: 'هذا البريد الإلكتروني مستخدم بالفعل.', field: 'email' };
    }
    const byPhone = await dbFindByPhone(data.phone);
    if (byPhone) {
      return { ok: false, status: 409, error: 'رقم الهاتف مستخدم بالفعل.', field: 'phone' };
    }
  } else {
    const accounts = readStore().accounts || [];
    if (accounts.some((a) => normalizeEmail(a.email) === data.email)) {
      return { ok: false, status: 409, error: 'هذا البريد الإلكتروني مستخدم بالفعل.', field: 'email' };
    }
    if (accounts.some((a) => normalizePhone(a.phone) === data.phone)) {
      return { ok: false, status: 409, error: 'رقم الهاتف مستخدم بالفعل.', field: 'phone' };
    }
  }

  const username = await uniqueUsernameAsync(data.username || deriveUsernameFromEmail(data.email), data.email);
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
    passwordEpoch: 0,
    role: CUSTOMER_ROLE,
    platform: 'naiosh-hub-360',
    status: 'active',
    governorate: data.governorate || '',
    city: data.city || '',
    address: data.address || '',
    createdAt: now,
    updatedAt: now,
  };

  if (dbEnabled()) {
    const inserted = await dbInsertAccount(account);
    if (!inserted.ok) {
      if (inserted.field === 'phone') {
        return { ok: false, status: 409, error: 'رقم الهاتف مستخدم بالفعل.', field: 'phone' };
      }
      if (inserted.field === 'email') {
        return { ok: false, status: 409, error: 'هذا البريد الإلكتروني مستخدم بالفعل.', field: 'email' };
      }
      if (inserted.field === 'username') {
        account.username = await uniqueUsernameAsync(username + 'x', data.email);
        const retry = await dbInsertAccount(account);
        if (!retry.ok) {
          return {
            ok: false,
            status: 500,
            error: 'تعذر حفظ الحساب في قاعدة البيانات. حاول مرة أخرى.',
          };
        }
      } else {
        return {
          ok: false,
          status: 500,
          error: 'تعذر حفظ الحساب في قاعدة البيانات. حاول مرة أخرى.',
        };
      }
    }
    touchLocalCache(account);
  } else {
    const store = readStore();
    store.accounts.unshift(account);
    writeStoreLocal(store);
    cachePut(account);
  }

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

  let account = null;
  if (dbEnabled()) {
    account = await dbFindByEmail(normalized);
  }
  if (!account) {
    account =
      cacheGet(normalized) ||
      (readStore().accounts || []).find((a) => normalizeEmail(a.email) === normalized) ||
      null;
  }

  if (!account || account.status === 'disabled') {
    return { ok: false, status: 401, error: 'بيانات الدخول غير صحيحة.' };
  }

  const valid = await verifyPassword(pass, account.passwordHash);
  if (!valid) {
    return { ok: false, status: 401, error: 'بيانات الدخول غير صحيحة.' };
  }

  cachePut(account);
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
  const hot = cacheGet(normalized);
  if (hot) return hot;
  return (readStore().accounts || []).find((a) => normalizeEmail(a.email) === normalized) || null;
}

async function findByEmailAsync(email) {
  const local = findByEmail(email);
  if (local) return local;
  if (dbEnabled()) return refreshAccountFromDb(email);
  return null;
}

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

  const reg = await register({
    fullName,
    email,
    phone,
    username,
    password,
    confirmPassword: password,
    termsAccepted: true,
    governorate: payload.governorate,
    city: payload.city,
    address: payload.address,
  });
  if (!reg.ok) return reg;

  const account = await findByEmailAsync(email);
  if (account) {
    account.createdByEmployeeId = actor.employeeNo || null;
    account.createdByEmail = actor.email || null;
    account.createdVia = 'admin_clients';
    await persistAccount(account);
  }

  return {
    ok: true,
    status: 201,
    success: true,
    message: 'تم إنشاء العميل بنجاح.',
    tempPassword: password,
    user: reg.user,
    account,
  };
}

async function updatePasswordHash(email, passwordHash, passwordEpoch) {
  const account = (await findByEmailAsync(email)) || findByEmail(email);
  if (!account) return { ok: false, error: 'الحساب غير موجود' };
  account.passwordHash = passwordHash;
  account.passwordEpoch = Number(passwordEpoch || 0);
  account.updatedAt = new Date().toISOString();
  await persistAccount(account);
  return { ok: true, account };
}

async function auditAffectedAccounts() {
  const report = {
    dbEnabled: dbEnabled(),
    dbCount: 0,
    fileCount: 0,
    cacheCount: hotCache.size,
    fileOnlyEmails: [],
    notes: [],
  };
  const file = readStoreFromFile();
  report.fileCount = (file.accounts || []).length;
  if (dbEnabled()) {
    report.dbCount = await dbCountCustomers();
    const dbEmails = new Set();
    if (report.dbCount <= HYDRATE_MAX) {
      const rows = await withClient(async (client) => {
        const r = await client.query(
          `SELECT LOWER(email) AS email FROM hub_users WHERE LOWER(role) = $1`,
          [CUSTOMER_ROLE]
        );
        return r.rows;
      });
      for (const r of rows) dbEmails.add(r.email);
    }
    for (const a of file.accounts || []) {
      const e = normalizeEmail(a.email);
      if (e && !dbEmails.has(e) && report.dbCount <= HYDRATE_MAX) report.fileOnlyEmails.push(e);
    }
    report.notes.push(
      'Passwords survive redeploys only when stored in hub_users. Accounts that existed solely in ephemeral JSON before durable auth were lost unless re-registered.'
    );
  } else {
    report.notes.push('DATABASE_URL missing — file store is not durable across redeploys.');
  }
  return report;
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
  findByEmailAsync,
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
  persistAccount,
  updatePasswordHash,
  dbCountCustomers,
  dbEnabled,
  auditAffectedAccounts,
  ensureCustomerSchema,
};
