/**
 * In-memory + file-backed Hub runtime (notifications + system sync payloads)
 * Works without Postgres; optionally mirrors to DB when available.
 */
const fs = require('fs');
const path = require('path');
const { getDatabaseUrl } = require('./migrate');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'hub-runtime.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ notifications: [], synced: {}, apps: [], updatedAt: new Date().toISOString() }, null, 2)
    );
  }
}

function readStore() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (_) {
    return { notifications: [], synced: {}, apps: [], updatedAt: new Date().toISOString() };
  }
}

function writeStore(store) {
  ensureStore();
  store.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  return store;
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

async function mirrorNotificationToDb(item) {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) return;
  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: databaseUrl,
      ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? false : { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query(
      `INSERT INTO hub_notifications (source, source_name, title, body, level, category, link, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        item.source,
        item.sourceName,
        item.title,
        item.body,
        item.level,
        item.category,
        item.link || null,
        JSON.stringify(item.meta || {}),
      ]
    );
    await client.query(`INSERT INTO hub_feed (feed_type, text_ar) VALUES ($1,$2)`, [
      'alert',
      `${item.sourceName}: ${item.title}`,
    ]);
    await client.end();
  } catch (_) {
    // DB optional
  }
}

async function mirrorSyncToDb(payload, appRow) {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) return;
  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: databaseUrl,
      ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? false : { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query(
      `INSERT INTO hub_apps (code, name_ar, kind, category, url, icon, status, health)
       VALUES ($1,$2,'system','أنظمة نايوش',$3,$4,$5,$6)`,
      [
        appRow.code,
        appRow.nameAr,
        appRow.launchUrl || appRow.url,
        appRow.icon || 'fa-cube',
        appRow.status || 'active',
        Number(appRow.health) || 90,
      ]
    );
    await client.query(
      `UPDATE hub_apps SET health = $2, status = $3, url = COALESCE($4, url)
       WHERE id = (
         SELECT id FROM hub_apps WHERE code = $1 ORDER BY created_at DESC LIMIT 1
       )`,
      [appRow.code, Number(appRow.health) || 90, appRow.status || 'active', appRow.launchUrl || appRow.url || null]
    );
    await client.query(
      `INSERT INTO hub_system_sync (code, payload, health, status)
       VALUES ($1, $2::jsonb, $3, $4)`,
      [payload.code, JSON.stringify(payload), Number(payload.health) || 90, payload.status || 'online']
    );
    await client.end();
  } catch (_) {
    // DB optional
  }
}

function listNotifications(limit = 100) {
  const store = readStore();
  return (store.notifications || []).slice(0, limit);
}

function addNotification(input = {}) {
  const store = readStore();
  const targetEmail = String(input.targetEmail || input.meta?.targetEmail || '')
    .trim()
    .toLowerCase();
  const item = {
    id: uid('n'),
    source: String(input.source || 'HUB').toUpperCase(),
    sourceName: input.sourceName || input.source || 'HUB',
    title: input.title || 'إشعار هوب',
    body: input.body || '',
    level: input.level || 'info',
    category: input.category || 'system',
    link: input.link || '',
    targetEmail: targetEmail || null,
    read: false,
    at: new Date().toISOString(),
    meta: input.meta || null,
  };
  store.notifications = store.notifications || [];
  store.notifications.unshift(item);
  if (store.notifications.length > 500) store.notifications.length = 500;
  writeStore(store);
  mirrorNotificationToDb(item).catch(() => {});
  return item;
}

function markRead(id, all = false) {
  const store = readStore();
  (store.notifications || []).forEach((n) => {
    if (all || n.id === id) n.read = true;
  });
  writeStore(store);
  return store.notifications;
}

function ingestSync(payload = {}) {
  const code = String(payload.code || '').toUpperCase();
  if (!code) {
    const err = new Error('code مطلوب');
    err.status = 400;
    throw err;
  }
  const store = readStore();
  const launchUrl = payload.launchUrl || `systems/${code.toLowerCase()}.html`;
  const appRow = {
    code,
    nameAr: payload.nameAr || code,
    launchUrl,
    url: launchUrl,
    icon: payload.icon || 'fa-cube',
    status: payload.status === 'offline' ? 'stopped' : 'active',
    health: Number(payload.health) || 90,
    lastSyncAt: new Date().toISOString(),
    lastSyncPayload: payload,
  };
  store.synced = store.synced || {};
  store.synced[code] = appRow;
  store.apps = store.apps || [];
  const idx = store.apps.findIndex((a) => a.code === code);
  if (idx >= 0) store.apps[idx] = { ...store.apps[idx], ...appRow };
  else store.apps.unshift(appRow);
  writeStore(store);
  mirrorSyncToDb(payload, appRow).catch(() => {});

  const note = addNotification({
    source: code,
    sourceName: appRow.nameAr,
    title: `رفع معلومات ${appRow.nameAr}`,
    body: `تم رفع الحالة والمقاييس إلى هوب · صحة ${appRow.health}% · وضع ${payload.mode || 'hub'}`,
    level: 'info',
    category: 'sync',
    link: launchUrl,
    meta: { metrics: payload.metrics || null },
  });

  return { app: appRow, notification: note };
}

function listApps() {
  return readStore().apps || [];
}

function getSynced(code) {
  const store = readStore();
  if (!code) return store.synced || {};
  return store.synced?.[String(code).toUpperCase()] || null;
}

/** Validate + register an app from «إضافة نظام» — required fields must match the guest form. */
function registerApp(payload = {}) {
  const nameAr = String(payload.nameAr || payload.name || '').trim();
  const code = String(payload.code || '')
    .trim()
    .toUpperCase();
  const companyName = String(payload.companyName || '').trim();
  const companyAddress = String(payload.companyAddress || '').trim();
  const party1Name = String(payload.party1Name || '').trim();
  const party1Phone = String(payload.party1Phone || '').trim();
  const party2Name = String(payload.party2Name || '').trim();
  const party2Phone = String(payload.party2Phone || '').trim();
  const branch = String(payload.branch || '').trim();
  const incubator = String(payload.incubator || '').trim();
  const platform = String(payload.platform || '').trim();
  const office = String(payload.office || '').trim();

  const fail = (error, field) => {
    const err = new Error(error);
    err.status = 400;
    err.field = field;
    throw err;
  };

  if (!nameAr) fail('اسم النظام مطلوب.', 'nameAr');
  if (!code) fail('رمز النظام مطلوب.', 'code');
  if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code)) {
    fail('رمز النظام غير صالح. استخدم أحرفًا إنجليزية وأرقامًا فقط.', 'code');
  }
  if (!companyName) fail('اسم الشركة مطلوب.', 'companyName');
  if (!companyAddress) fail('عنوان الشركة مطلوب.', 'companyAddress');
  if (!party1Name) fail('طرف أول مطلوب.', 'party1Name');
  if (!party1Phone) fail('رقم جوال الطرف الأول مطلوب.', 'party1Phone');
  if (!party2Name) fail('طرف ثاني مطلوب.', 'party2Name');
  if (!party2Phone) fail('رقم جوال الطرف الثاني مطلوب.', 'party2Phone');
  if (!branch) fail('الفرع مطلوب.', 'branch');
  if (!incubator) fail('الحاضنة مطلوبة.', 'incubator');
  if (!platform) fail('المنصة مطلوبة.', 'platform');
  if (!office) fail('المكتب مطلوب.', 'office');

  const store = readStore();
  store.apps = store.apps || [];
  const launchUrl =
    String(payload.url || payload.launchUrl || '').trim() || `systems/${code.toLowerCase()}.html`;
  const appRow = {
    id: uid('app'),
    code,
    nameAr,
    kind: 'system',
    category: String(payload.category || 'أنظمة نايوش').trim() || 'أنظمة نايوش',
    url: launchUrl,
    launchUrl,
    icon: payload.icon || 'fa-cube',
    status: 'active',
    health: 88,
    companyName,
    companyAddress,
    party1Name,
    party1Phone,
    party2Name,
    party2Phone,
    branch,
    incubator,
    platform,
    office,
    registeredAt: new Date().toISOString(),
    source: 'add-system-form',
  };
  const idx = store.apps.findIndex((a) => String(a.code).toUpperCase() === code);
  if (idx >= 0) store.apps[idx] = { ...store.apps[idx], ...appRow, id: store.apps[idx].id || appRow.id };
  else store.apps.unshift(appRow);
  writeStore(store);
  mirrorSyncToDb(payload, appRow).catch(() => {});
  return { ok: true, app: appRow };
}

module.exports = {
  listNotifications,
  addNotification,
  markRead,
  ingestSync,
  listApps,
  getSynced,
  registerApp,
  readStore,
};
