/**
 * إصدار تذاكر SSO قصيرة العمر من هوب للأنظمة التخصصية (ERP…)
 * وجسر فتح الأنظمة (تحقق + توجيه لصفحة الدخول الصحيحة)
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SECRET = process.env.HUB_SSO_SECRET || 'naiosh-hub-sso-dev-secret';
const TTL_MS = Number(process.env.HUB_SSO_TTL_MS || 10 * 60 * 1000);
const STORE_PATH = path.join(__dirname, '..', 'data', 'sso-tickets.json');
const DEFAULT_ERP_BASE = String(
  process.env.ERP_BASE_URL || 'https://web-production-419e2.up.railway.app'
).replace(/\/$/, '');

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

const verify = (token, { consume = false, sig: expectedSig = '' } = {}) => {
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
  const sig = crypto.createHmac('sha256', SECRET).update(`${key}.${ticket.expiresAt}.${ticket.email}`).digest('hex');
  if (expectedSig && String(expectedSig) !== sig) {
    return { ok: false, error: 'توقيع التذكرة غير صالح' };
  }
  if (consume) {
    ticket.usedAt = new Date().toISOString();
    writeStore(store);
  }
  return { ok: true, ticket, sig };
};

/**
 * رابط فتح النظام الهدف بعد التحقق من تذكرة هوب.
 * ERP الحالي لا يستهلك hubTicket تلقائيًا — يوجَّه لصفحة الدخول بالمستأجر الصحيح.
 */
const buildTargetUrl = (ticket = {}, { erpBase = DEFAULT_ERP_BASE, hubTicket = '', hubSig = '' } = {}) => {
  const code = String(ticket.systemCode || 'ERP').trim().toUpperCase();
  const slug = String(ticket.tenant || '').trim().toLowerCase();
  const base = String(erpBase || DEFAULT_ERP_BASE).replace(/\/$/, '');
  const email = String(ticket.email || '').trim().toLowerCase();
  const name = String(ticket.name || '').trim();

  if (code === 'ERP' && slug) {
    // login=1 يمنع تحويل مسار /t/{slug}/login-page.html إلى الصفحة الرئيسية للمستأجر
    const u = new URL(`${base}/t/${encodeURIComponent(slug)}/login-page.html`);
    u.searchParams.set('login', '1');
    u.searchParams.set('tenant', slug);
    u.searchParams.set('subdomain', slug);
    if (email) {
      u.searchParams.set('email', email);
      u.searchParams.set('hubUser', email);
    }
    if (name) u.searchParams.set('hubName', name);
    if (hubTicket) u.searchParams.set('hubTicket', hubTicket);
    if (hubSig) u.searchParams.set('hubSig', hubSig);
    u.searchParams.set('from', 'hub-sso-bridge');
    return { ok: true, url: u.toString(), mode: 'erp-login', systemCode: code, tenant: slug };
  }

  if (slug) {
    return {
      ok: true,
      url: `${base}/t/${encodeURIComponent(slug)}/`,
      mode: 'tenant-home',
      systemCode: code,
      tenant: slug,
    };
  }

  return { ok: false, error: 'لا يوجد مستأجر مرتبط بالتذكرة', systemCode: code };
};

const bridge = (token, { consume = false, sig = '', erpBase = DEFAULT_ERP_BASE } = {}) => {
  const checked = verify(token, { consume, sig });
  if (!checked.ok) return checked;
  const target = buildTargetUrl(checked.ticket, {
    erpBase,
    hubTicket: String(token || '').trim(),
    hubSig: checked.sig,
  });
  if (!target.ok) return target;
  return {
    ok: true,
    ticket: checked.ticket,
    sig: checked.sig,
    targetUrl: target.url,
    mode: target.mode,
    systemCode: target.systemCode,
    tenant: target.tenant,
    note:
      target.mode === 'erp-login'
        ? 'تم التحقق من هوية هوب. ERP يطلب كلمة المرور حتى يُفعَّل استهلاك hubTicket على جانب ERP.'
        : '',
  };
};

module.exports = { issue, verify, bridge, buildTargetUrl, TTL_MS, DEFAULT_ERP_BASE };
