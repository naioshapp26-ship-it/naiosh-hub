/**
 * System settings — file-backed Single Source of Truth with optional Postgres hub_meta mirror.
 * Staff-only writes; public brand subset for chrome reflection.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_PATH = path.join(__dirname, '..', 'data', 'system-settings.json');
const META_KEY = 'system_settings';

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const SETTINGS_BOOL = new Set([
  'compactSidebar',
  'reduceMotion',
  'maintenanceMode',
  'notifyInApp',
  'notifyEmail',
  'notifySecurity',
  'notifyOps',
  'requireMfa',
  'autoLogoutIdle',
  'excludeKonzoo',
  'searchIndexEnabled',
  'aiAssistantEnabled',
  'liveFeedEnabled',
  'allowPublicRegister',
]);

const SETTINGS_NUM = new Set(['sessionMinutes', 'autoSyncMinutes', 'activityRetainDays', 'maxUploadMb']);
const SETTINGS_JSON = new Set(['banners']);

const KEY_LABELS = {
  orgNameAr: 'اسم المنصة (عربي)',
  orgNameEn: 'اسم المنصة (إنجليزي)',
  orgTagline: 'وصف / الشعار النصي',
  timezone: 'المنطقة الزمنية',
  locale: 'اللغة',
  dateFormat: 'تنسيق التاريخ',
  compactSidebar: 'قائمة جانبية مضغوطة',
  reduceMotion: 'تقليل الحركة',
  maintenanceMode: 'وضع الصيانة',
  maintenanceMessage: 'رسالة الصيانة',
  notifyInApp: 'إشعارات داخل التطبيق',
  notifyEmail: 'إشعارات البريد',
  notifySecurity: 'تنبيهات الأمن',
  notifyOps: 'تنبيهات التشغيل',
  sessionMinutes: 'مدة الجلسة (دقائق)',
  requireMfa: 'المصادقة الثنائية',
  autoLogoutIdle: 'تسجيل خروج تلقائي عند الخمول',
  autoSyncMinutes: 'المزامنة التلقائية (دقائق)',
  defaultGrantPlan: 'خطة المنح الافتراضية',
  activityRetainDays: 'أيام الاحتفاظ بالنشاط',
  maxUploadMb: 'حد الرفع (ميجابايت)',
  shopDefaultCategory: 'تصنيف المتجر الافتراضي',
  excludeKonzoo: 'استثناء كونزو',
  searchIndexEnabled: 'فهرسة البحث',
  aiAssistantEnabled: 'المساعد الذكي',
  liveFeedEnabled: 'البث الحي',
  allowPublicRegister: 'التسجيل العام',
  currency: 'العملة',
  primaryColor: 'اللون الأساسي',
  secondaryColor: 'اللون الثانوي',
  accentColor: 'لون التمييز',
  bgColor: 'لون الخلفية',
  textColor: 'لون النص',
  surfaceColor: 'لون البطاقات',
  logoMain: 'الشعار الرئيسي',
  logoLight: 'شعار فاتح',
  logoDark: 'شعار داكن',
  faviconUrl: 'أيقونة المتصفح',
  loginImage: 'صورة صفحة الدخول',
  dashboardImage: 'صورة لوحة التحكم',
  banners: 'البنرات',
};

const KEY_SECTIONS = {
  orgNameAr: 'الإعدادات العامة',
  orgNameEn: 'الإعدادات العامة',
  orgTagline: 'الإعدادات العامة',
  maintenanceMode: 'الإعدادات العامة',
  maintenanceMessage: 'الإعدادات العامة',
  primaryColor: 'الهوية البصرية',
  secondaryColor: 'الهوية البصرية',
  accentColor: 'الهوية البصرية',
  bgColor: 'الهوية البصرية',
  textColor: 'الهوية البصرية',
  surfaceColor: 'الهوية البصرية',
  logoMain: 'الشعار والصور',
  logoLight: 'الشعار والصور',
  logoDark: 'الشعار والصور',
  faviconUrl: 'الشعار والصور',
  loginImage: 'الشعار والصور',
  dashboardImage: 'الشعار والصور',
  banners: 'البنرات والفيديو',
  locale: 'اللغة والمنطقة',
  timezone: 'اللغة والمنطقة',
  dateFormat: 'اللغة والمنطقة',
  currency: 'اللغة والمنطقة',
  compactSidebar: 'الواجهة',
  reduceMotion: 'الواجهة',
  notifyInApp: 'الإشعارات',
  notifyEmail: 'الإشعارات',
  notifySecurity: 'الإشعارات',
  notifyOps: 'الإشعارات',
  sessionMinutes: 'الأمان والوصول',
  requireMfa: 'الأمان والوصول',
  autoLogoutIdle: 'الأمان والوصول',
  allowPublicRegister: 'الأمان والوصول',
  autoSyncMinutes: 'التشغيل',
  defaultGrantPlan: 'التشغيل',
  activityRetainDays: 'التشغيل',
  liveFeedEnabled: 'التشغيل',
  maxUploadMb: 'الرفع والملفات',
  shopDefaultCategory: 'المتجر',
  excludeKonzoo: 'المتجر',
  searchIndexEnabled: 'محرك البحث',
  aiAssistantEnabled: 'الذكاء الاصطناعي',
};

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function defaultSettings() {
  return {
    orgNameAr: 'نايوش هوب',
    orgNameEn: 'NAIOSH HUB',
    orgTagline: '360 · إمبراطوري',
    timezone: 'Asia/Riyadh',
    locale: 'ar',
    dateFormat: 'ar-EG',
    compactSidebar: false,
    reduceMotion: false,
    maintenanceMode: false,
    maintenanceMessage: 'المنصة تحت الصيانة — نعود قريبًا.',
    notifyInApp: true,
    notifyEmail: false,
    notifySecurity: true,
    notifyOps: true,
    sessionMinutes: 480,
    requireMfa: false,
    autoLogoutIdle: true,
    autoSyncMinutes: 15,
    defaultGrantPlan: 'standard',
    activityRetainDays: 90,
    maxUploadMb: 1500,
    shopDefaultCategory: 'الكل',
    excludeKonzoo: true,
    searchIndexEnabled: true,
    aiAssistantEnabled: true,
    liveFeedEnabled: true,
    allowPublicRegister: true,
    currency: 'USD',
    primaryColor: '#d70000',
    secondaryColor: '#0a0a0a',
    accentColor: '#8a000c',
    bgColor: '#f4f4f5',
    textColor: '#111111',
    surfaceColor: '#ffffff',
    logoMain: '',
    logoLight: '',
    logoDark: '',
    faviconUrl: '',
    loginImage: '',
    dashboardImage: '',
    banners: [],
    settingsChangeLog: [],
    updatedAt: null,
  };
}

function normalizeBanner(b = {}) {
  return {
    id: String(b.id || `bnr-${Date.now().toString(36)}`),
    name: String(b.name || 'بنر'),
    title: String(b.title || ''),
    description: String(b.description || ''),
    buttonText: String(b.buttonText || ''),
    buttonUrl: String(b.buttonUrl || ''),
    imageDataUrl: String(b.imageDataUrl || ''),
    videoUrl: String(b.videoUrl || ''),
    location: String(b.location || 'homepage'),
    startDate: String(b.startDate || ''),
    endDate: String(b.endDate || ''),
    order: Number.isFinite(Number(b.order)) ? Number(b.order) : 1,
    enabled: b.enabled !== false && b.enabled !== 'false' && b.enabled !== 0,
  };
}

function coerceSettings(raw = {}) {
  const d = defaultSettings();
  const out = { ...d };
  Object.keys(d).forEach((key) => {
    if (key === 'updatedAt' || key === 'settingsChangeLog') return;
    if (!(key in raw) || raw[key] === undefined || raw[key] === null) return;
    if (SETTINGS_BOOL.has(key)) {
      out[key] = raw[key] === true || raw[key] === 'true' || raw[key] === 'on' || raw[key] === 1 || raw[key] === '1';
    } else if (SETTINGS_NUM.has(key)) {
      const n = Number(raw[key]);
      out[key] = Number.isFinite(n) ? n : d[key];
    } else if (SETTINGS_JSON.has(key)) {
      let list = raw[key];
      if (typeof list === 'string') {
        try {
          list = JSON.parse(list || '[]');
        } catch {
          list = [];
        }
      }
      out[key] = Array.isArray(list) ? list.map(normalizeBanner) : [];
    } else {
      out[key] = String(raw[key]);
    }
  });
  out.excludeKonzoo = true;
  out.maxUploadMb = Math.max(1, Math.min(1500, out.maxUploadMb || 1500));
  out.sessionMinutes = Math.max(5, Math.min(24 * 60, out.sessionMinutes || 480));
  out.autoSyncMinutes = Math.max(0, Math.min(24 * 60, out.autoSyncMinutes || 0));
  out.activityRetainDays = Math.max(7, Math.min(3650, out.activityRetainDays || 90));
  if (!out.timezone) out.timezone = d.timezone;
  if (!out.dateFormat) out.dateFormat = d.dateFormat;
  if (!out.shopDefaultCategory) out.shopDefaultCategory = 'الكل';
  if (/Imperial/i.test(String(out.orgTagline || ''))) out.orgTagline = d.orgTagline;
  ['primaryColor', 'secondaryColor', 'accentColor', 'bgColor', 'textColor', 'surfaceColor'].forEach((k) => {
    if (!HEX_RE.test(out[k] || '')) out[k] = d[k];
  });
  if (!Array.isArray(out.banners)) out.banners = [];
  out.updatedAt = raw.updatedAt || null;
  if (Array.isArray(raw.settingsChangeLog)) {
    out.settingsChangeLog = raw.settingsChangeLog.slice(0, 500);
  } else {
    out.settingsChangeLog = [];
  }
  return out;
}

function ensureDir() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readFileStore() {
  ensureDir();
  if (!fs.existsSync(DATA_PATH)) {
    const seeded = coerceSettings(defaultSettings());
    writeFileStore(seeded);
    return seeded;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    return coerceSettings(raw?.settings || raw || {});
  } catch (err) {
    console.error('[hub-system-settings] read failed', err.message);
    return coerceSettings(defaultSettings());
  }
}

function writeFileStore(settings) {
  ensureDir();
  const payload = {
    version: 1,
    updatedAt: settings.updatedAt || nowIso(),
    settings,
  };
  fs.writeFileSync(DATA_PATH, JSON.stringify(payload, null, 2), 'utf8');
  return settings;
}

async function mirrorToDb(settings) {
  let getDatabaseUrl;
  try {
    ({ getDatabaseUrl } = require('../db/migrate'));
  } catch {
    return { mirrored: false, reason: 'migrate-module-missing' };
  }
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) return { mirrored: false, reason: 'no-database-url' };
  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: databaseUrl,
      ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? false : { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query(
      `INSERT INTO hub_meta (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [META_KEY, JSON.stringify(settings)]
    );
    await client.end();
    return { mirrored: true };
  } catch (err) {
    console.error('[hub-system-settings] DB mirror failed', err.message);
    return { mirrored: false, reason: err.message };
  }
}

async function loadFromDb() {
  let getDatabaseUrl;
  try {
    ({ getDatabaseUrl } = require('../db/migrate'));
  } catch {
    return null;
  }
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) return null;
  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: databaseUrl,
      ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? false : { rejectUnauthorized: false },
    });
    await client.connect();
    const result = await client.query(`SELECT value FROM hub_meta WHERE key = $1 LIMIT 1`, [META_KEY]);
    await client.end();
    if (!result.rows?.[0]?.value) return null;
    return coerceSettings(result.rows[0].value);
  } catch (err) {
    console.error('[hub-system-settings] DB load failed', err.message);
    return null;
  }
}

function displayValue(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function buildAuditEntries(prev, next, actor = {}, opType = 'تعديل إعداد') {
  const entries = [];
  const keys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
  keys.forEach((key) => {
    if (key === 'updatedAt' || key === 'settingsChangeLog') return;
    if (!(key in (next || {}))) return;
    const oldVal = prev?.[key];
    const newVal = next?.[key];
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return;
    entries.push({
      id: uid('scl'),
      at: nowIso(),
      actor: actor.name || actor.email || 'مشغّل هوب',
      employeeNo: actor.employeeNo || actor.userId || actor.email || null,
      email: actor.email || null,
      key,
      label: KEY_LABELS[key] || key,
      section: KEY_SECTIONS[key] || 'إعدادات النظام',
      oldValue: displayValue(oldVal),
      newValue: displayValue(newVal),
      operation: opType,
    });
  });
  return entries;
}

async function getSettings({ preferDb = true } = {}) {
  if (preferDb) {
    const fromDb = await loadFromDb();
    if (fromDb) {
      // Keep file in sync when DB is authoritative
      writeFileStore(fromDb);
      return fromDb;
    }
  }
  return readFileStore();
}

function getPublicBrand(settings) {
  const s = settings || readFileStore();
  return {
    orgNameAr: s.orgNameAr,
    orgNameEn: s.orgNameEn,
    orgTagline: s.orgTagline,
    primaryColor: s.primaryColor,
    secondaryColor: s.secondaryColor,
    accentColor: s.accentColor,
    bgColor: s.bgColor,
    textColor: s.textColor,
    surfaceColor: s.surfaceColor,
    logoMain: s.logoMain,
    faviconUrl: s.faviconUrl,
    maintenanceMode: !!s.maintenanceMode,
    maintenanceMessage: s.maintenanceMessage,
    updatedAt: s.updatedAt,
  };
}

async function saveSettings(patch = {}, actor = {}) {
  const prev = await getSettings({ preferDb: true });
  const merged = coerceSettings({ ...prev, ...(patch || {}), updatedAt: nowIso() });
  const audit = buildAuditEntries(prev, merged, actor, 'تعديل إعداد');
  merged.settingsChangeLog = [...audit, ...(Array.isArray(prev.settingsChangeLog) ? prev.settingsChangeLog : [])].slice(
    0,
    500
  );
  writeFileStore(merged);
  const mirror = await mirrorToDb(merged);
  return {
    ok: true,
    settings: merged,
    changedKeys: audit.map((a) => a.key),
    auditEntries: audit,
    storage: {
      file: DATA_PATH,
      databaseMirrored: !!mirror.mirrored,
      databaseReason: mirror.reason || null,
    },
  };
}

async function resetSettings(actor = {}) {
  const prev = await getSettings({ preferDb: true });
  const next = coerceSettings({ ...defaultSettings(), updatedAt: nowIso() });
  const audit = buildAuditEntries(prev, next, actor, 'إعادة للافتراضي');
  next.settingsChangeLog = [...audit, ...(Array.isArray(prev.settingsChangeLog) ? prev.settingsChangeLog : [])].slice(
    0,
    500
  );
  writeFileStore(next);
  const mirror = await mirrorToDb(next);
  return {
    ok: true,
    settings: next,
    changedKeys: audit.map((a) => a.key),
    auditEntries: audit,
    storage: {
      file: DATA_PATH,
      databaseMirrored: !!mirror.mirrored,
      databaseReason: mirror.reason || null,
    },
  };
}

module.exports = {
  META_KEY,
  DATA_PATH,
  KEY_LABELS,
  KEY_SECTIONS,
  defaultSettings,
  coerceSettings,
  getSettings,
  getPublicBrand,
  saveSettings,
  resetSettings,
  readFileStore,
};
