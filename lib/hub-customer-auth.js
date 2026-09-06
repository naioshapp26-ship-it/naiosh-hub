/**
 * Customer registration & login for Naiosh Hub.
 * Primary store: data/customer-accounts.json (scrypt password hashes).
 * Optional mirror to Postgres hub_users when DATABASE_URL is set.
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

function blankStore() {
  return { version: 1, accounts: [], updatedAt: new Date().toISOString() };
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(blankStore(), null, 2), 'utf8');
  }
}

function readStore() {
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

function writeStore(store) {
  ensureStore();
  const next = {
    version: 1,
    accounts: Array.isArray(store.accounts) ? store.accounts : [],
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(STORE_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
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

function makeToken(email) {
  return `hub360.cust.${Buffer.from(email).toString('base64url')}.${Date.now()}`;
}

function publicUser(account) {
  if (!account) return null;
  return {
    id: account.id,
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

/** Easy signup passwords: any letters/numbers, just not empty/too short. */
const MIN_PASSWORD_LENGTH = 4;

function passwordStrength(password) {
  const p = String(password || '');
  const rules = {
    minLength: p.length >= MIN_PASSWORD_LENGTH,
  };
  return { ok: rules.minLength, rules, minLength: MIN_PASSWORD_LENGTH };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username) {
  return /^[a-z0-9._-]{3,32}$/.test(username);
}

function isValidPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 && /^\+?[0-9]+$/.test(phone);
}

function validateRegistrationInput(payload = {}) {
  const fullName = normalizeName(payload.fullName || payload.name);
  const username = normalizeUsername(payload.username);
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
  if (!username || !isValidUsername(username)) {
    return {
      ok: false,
      error: 'اسم المستخدم غير صالح. استخدم 3–32 حرفًا (لاتينية/أرقام/._-).',
      field: 'username',
    };
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
      error: `كلمة المرور قصيرة جدًا. اكتبي على الأقل ${MIN_PASSWORD_LENGTH} أحرف أو أرقام.`,
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
  const store = readStore();
  const accounts = store.accounts || [];

  if (accounts.some((a) => normalizeEmail(a.email) === data.email)) {
    return { ok: false, status: 409, error: 'هذا البريد الإلكتروني مستخدم بالفعل.', field: 'email' };
  }
  if (accounts.some((a) => normalizeUsername(a.username) === data.username)) {
    return { ok: false, status: 409, error: 'اسم المستخدم مستخدم بالفعل.', field: 'username' };
  }
  if (accounts.some((a) => normalizePhone(a.phone) === data.phone)) {
    return { ok: false, status: 409, error: 'رقم الهاتف مستخدم بالفعل.', field: 'phone' };
  }

  const passwordHash = await hashPassword(data.password);
  const now = new Date().toISOString();
  const account = {
    id: makeId(),
    fullName: data.fullName,
    username: data.username,
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

  const store = readStore();
  const account = (store.accounts || []).find(
    (a) => normalizeEmail(a.email) === normalized && a.status !== 'disabled'
  );
  if (!account) {
    return { ok: false, status: 401, error: 'بيانات الدخول غير صحيحة.' };
  }

  const valid = await verifyPassword(pass, account.passwordHash);
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

module.exports = {
  CUSTOMER_ROLE,
  STORE_PATH,
  register,
  login,
  findByEmail,
  publicUser,
  passwordStrength,
  hashPassword,
  verifyPassword,
  validateRegistrationInput,
  readStore,
};
