/**
 * إصدار تذاكر SSO قصيرة العمر من هوب للأنظمة التخصصية (ERP…)
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SECRET = process.env.HUB_SSO_SECRET || 'naiosh-hub-sso-dev-secret';
const TTL_MS = Number(process.env.HUB_SSO_TTL_MS || 10 * 60 * 1000);
const STORE_PATH = path.join(__dirname, '..', 'data', 'sso-tickets.json');

const ensureStore = () => {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify({ tickets: {} }, null, 2), 'utf8');
  }
};

const readStore = () => {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { tickets: {} };
  }
};

const writeStore = (store) => {
  ensureStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
};

const purgeExpired = (store, now = Date.now()) => {
  Object.keys(store.tickets || {}).forEach((k) => {
    if (!store.tickets[k]?.expiresAt || Date.parse(store.tickets[k].expiresAt) <= now) {
      delete store.tickets[k];
    }
  });
};

const issue = (payload = {}) => {
  const email = String(payload.email || '').trim().toLowerCase();
  const systemCode = String(payload.systemCode || 'ERP').trim().toUpperCase();
  const tenant = String(payload.tenant || payload.subdomain || '').trim().toLowerCase();
  const rentalId = String(payload.rentalId || '').trim();
  const name = String(payload.name || '').trim();
  if (!email) return { ok: false, error: 'البريد مطلوب لإصدار تذكرة SSO' };

  const token = crypto.randomBytes(24).toString('hex');
  const now = Date.now();
  const expiresAt = new Date(now + TTL_MS).toISOString();
  const ticket = {
    token,
    email,
    name,
    systemCode,
    tenant,
    rentalId,
    permissions: Array.isArray(payload.permissions) ? payload.permissions : ['read', 'write'],
    createdAt: new Date(now).toISOString(),
    expiresAt,
    usedAt: null,
  };

  const store = readStore();
  purgeExpired(store, now);
  store.tickets[token] = ticket;
  writeStore(store);

  const sig = crypto.createHmac('sha256', SECRET).update(`${token}.${expiresAt}.${email}`).digest('hex');
  return { ok: true, token, sig, expiresAt, ticket: { ...ticket, token: undefined } };
};

const verify = (token, { consume = false } = {}) => {
  const key = String(token || '').trim();
  if (!key) return { ok: false, error: 'التذكرة مطلوبة' };
  const store = readStore();
  purgeExpired(store);
  const ticket = store.tickets[key];
  if (!ticket) return { ok: false, error: 'تذكرة غير موجودة أو منتهية' };
  if (Date.parse(ticket.expiresAt) <= Date.now()) {
    delete store.tickets[key];
    writeStore(store);
    return { ok: false, error: 'انتهت صلاحية التذكرة' };
  }
  if (consume) {
    ticket.usedAt = new Date().toISOString();
    writeStore(store);
  }
  const sig = crypto.createHmac('sha256', SECRET).update(`${key}.${ticket.expiresAt}.${ticket.email}`).digest('hex');
  return { ok: true, ticket, sig };
};

module.exports = { issue, verify, TTL_MS };
