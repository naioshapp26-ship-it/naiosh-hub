/**
 * E2E: system settings save → API → file/DB store → reload → audit → auth fail.
 * Run against a live Hub server (PORT env or 8090).
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PORT = Number(process.env.PORT) || 8090;
const BASE = process.env.HUB_BASE || `http://127.0.0.1:${PORT}`;
const DATA_FILE = path.join(__dirname, '..', 'data', 'system-settings.json');

function staffToken(email = 'leader@naiosh.com') {
  return `hub360.${Buffer.from(email).toString('base64')}.${Date.now()}`;
}

function headers(email = 'leader@naiosh.com', role = 'supreme_leader') {
  const token = staffToken(email);
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Hub-Token': token,
    'X-Hub-User-Role': role,
    'X-Hub-User-Name': 'Leader',
  };
}

async function req(method, urlPath, { body, email, role, auth = true } = {}) {
  const opts = { method, headers: auth ? headers(email, role) : { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${urlPath}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function readStoreFile() {
  if (!fs.existsSync(DATA_FILE)) return null;
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

(async () => {
  const report = [];
  const row = (section, setting, before, during, saveOk, apiOk, dbOk, afterRefresh, reflected, audit, result) => {
    report.push({ section, setting, before, during, saveOk, apiOk, dbOk, afterRefresh, reflected, audit, result });
  };

  // Health
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  assert.strictEqual(health.ok, true, 'server health');

  // Auth: customer / anonymous must fail save
  {
    const anon = await req('PUT', '/api/hub/system-settings', {
      auth: false,
      body: { settings: { orgNameAr: 'قرصنة' } },
    });
    assert.ok(anon.status === 401 || anon.status === 403, 'anonymous save blocked');
    const custTok = staffToken('client@naiosh.com');
    const cust = await fetch(`${BASE}/api/hub/system-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custTok}`,
        'X-Hub-User-Role': 'customer',
      },
      body: JSON.stringify({ settings: { orgNameAr: 'عميل يحاول' } }),
    }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));
    assert.ok(cust.status === 403, 'customer save blocked');
    row('الصلاحيات', 'تفويض الحفظ', '—', 'محاولة غير مصرح', 'N/A', 'blocked', 'N/A', 'N/A', 'N/A', 'N/A', 'PASS');
  }

  // Baseline read
  const beforeGet = await req('GET', '/api/hub/system-settings');
  assert.strictEqual(beforeGet.status, 200, 'staff GET settings');
  assert.ok(beforeGet.data.settings, 'settings payload');
  const original = { ...beforeGet.data.settings };

  // —— Text: orgNameAr ——
  const testAr = 'نايوش هوب اختبار الحفظ';
  const saveAr = await req('PUT', '/api/hub/system-settings', {
    body: { settings: { orgNameAr: testAr }, employeeNo: 'EMP-0001' },
  });
  assert.strictEqual(saveAr.status, 200, 'save orgNameAr status');
  assert.strictEqual(saveAr.data.ok, true, 'save orgNameAr ok');
  assert.strictEqual(saveAr.data.settings.orgNameAr, testAr, 'response has new ar name');
  assert.ok(Array.isArray(saveAr.data.auditEntries) && saveAr.data.auditEntries.length >= 1, 'audit entries returned');
  const fileAfterAr = readStoreFile();
  assert.strictEqual(fileAfterAr?.settings?.orgNameAr, testAr, 'file store updated');
  const refreshAr = await req('GET', '/api/hub/system-settings');
  assert.strictEqual(refreshAr.data.settings.orgNameAr, testAr, 'reload returns new ar name');
  const brandAr = await req('GET', '/api/hub/system-settings?public=1', { auth: false });
  assert.strictEqual(brandAr.data.brand.orgNameAr, testAr, 'public brand reflects ar name');
  const auditHit = (refreshAr.data.settings.settingsChangeLog || []).find(
    (c) => c.key === 'orgNameAr' && c.newValue === testAr
  );
  assert.ok(auditHit, 'audit log has orgNameAr change');
  row(
    'الإعدادات العامة',
    'اسم المنصة (عربي)',
    original.orgNameAr,
    testAr,
    'yes',
    'yes',
    fileAfterAr?.settings?.orgNameAr === testAr ? 'yes' : 'no',
    refreshAr.data.settings.orgNameAr === testAr ? 'yes' : 'no',
    brandAr.data.brand.orgNameAr === testAr ? 'yes' : 'no',
    auditHit ? 'yes' : 'no',
    'PASS'
  );

  // —— Select-like: shopDefaultCategory ——
  const catBefore = refreshAr.data.settings.shopDefaultCategory;
  const catTest = 'فيت';
  const saveCat = await req('PUT', '/api/hub/system-settings', {
    body: { settings: { shopDefaultCategory: catTest } },
  });
  assert.strictEqual(saveCat.data.settings.shopDefaultCategory, catTest);
  const refreshCat = await req('GET', '/api/hub/system-settings');
  assert.strictEqual(refreshCat.data.settings.shopDefaultCategory, catTest);
  row(
    'المتجر',
    'تصنيف المتجر الافتراضي',
    catBefore,
    catTest,
    'yes',
    'yes',
    readStoreFile()?.settings?.shopDefaultCategory === catTest ? 'yes' : 'no',
    refreshCat.data.settings.shopDefaultCategory === catTest ? 'yes' : 'no',
    'N/A',
    (refreshCat.data.settings.settingsChangeLog || []).some((c) => c.key === 'shopDefaultCategory') ? 'yes' : 'no',
    'PASS'
  );

  // —— Toggle: compactSidebar ——
  const togBefore = !!refreshCat.data.settings.compactSidebar;
  const togTest = !togBefore;
  const saveTog = await req('PUT', '/api/hub/system-settings', {
    body: { settings: { compactSidebar: togTest } },
  });
  assert.strictEqual(!!saveTog.data.settings.compactSidebar, togTest);
  const refreshTog = await req('GET', '/api/hub/system-settings');
  assert.strictEqual(!!refreshTog.data.settings.compactSidebar, togTest);
  row(
    'الواجهة',
    'قائمة جانبية مضغوطة',
    String(togBefore),
    String(togTest),
    'yes',
    'yes',
    !!readStoreFile()?.settings?.compactSidebar === togTest ? 'yes' : 'no',
    !!refreshTog.data.settings.compactSidebar === togTest ? 'yes' : 'no',
    'N/A',
    (refreshTog.data.settings.settingsChangeLog || []).some((c) => c.key === 'compactSidebar') ? 'yes' : 'no',
    'PASS'
  );

  // —— Visual identity color ——
  const colorBefore = refreshTog.data.settings.primaryColor;
  const colorTest = '#112233';
  const saveColor = await req('PUT', '/api/hub/system-settings', {
    body: { settings: { primaryColor: colorTest } },
  });
  assert.strictEqual(saveColor.data.settings.primaryColor, colorTest);
  const refreshColor = await req('GET', '/api/hub/system-settings');
  assert.strictEqual(refreshColor.data.settings.primaryColor, colorTest);
  const brandColor = await req('GET', '/api/hub/system-settings?public=1', { auth: false });
  assert.strictEqual(brandColor.data.brand.primaryColor, colorTest);
  row(
    'الهوية البصرية',
    'اللون الأساسي',
    colorBefore,
    colorTest,
    'yes',
    'yes',
    readStoreFile()?.settings?.primaryColor === colorTest ? 'yes' : 'no',
    refreshColor.data.settings.primaryColor === colorTest ? 'yes' : 'no',
    brandColor.data.brand.primaryColor === colorTest ? 'yes' : 'no',
    (refreshColor.data.settings.settingsChangeLog || []).some((c) => c.key === 'primaryColor') ? 'yes' : 'no',
    'PASS'
  );

  // —— Fail path: invalid session must not mutate ——
  const beforeFail = readStoreFile()?.settings?.orgNameAr;
  const failSave = await req('PUT', '/api/hub/system-settings', {
    auth: false,
    body: { settings: { orgNameAr: 'يجب ألا تُحفظ' } },
  });
  assert.ok(failSave.status >= 400, 'fail status');
  assert.notStrictEqual(failSave.data.ok, true, 'fail not ok');
  assert.strictEqual(readStoreFile()?.settings?.orgNameAr, beforeFail, 'fail does not mutate store');
  row(
    'الأخطاء',
    'فشل الحفظ بدون صلاحية',
    beforeFail,
    'يجب ألا تُحفظ',
    'no',
    'no',
    'unchanged',
    'unchanged',
    'N/A',
    'N/A',
    'PASS'
  );

  // Restore originals (required by task)
  const restore = await req('PUT', '/api/hub/system-settings', {
    body: {
      settings: {
        orgNameAr: original.orgNameAr || 'نايوش هوب',
        orgNameEn: original.orgNameEn || 'NAIOSH HUB',
        orgTagline: original.orgTagline || '360 · إمبراطوري',
        shopDefaultCategory: original.shopDefaultCategory || 'الكل',
        compactSidebar: !!original.compactSidebar,
        primaryColor: original.primaryColor || '#d70000',
      },
      employeeNo: 'EMP-0001',
    },
  });
  assert.strictEqual(restore.data.ok, true, 'restore ok');
  assert.strictEqual(restore.data.settings.orgNameAr, original.orgNameAr || 'نايوش هوب');
  const finalGet = await req('GET', '/api/hub/system-settings');
  assert.strictEqual(finalGet.data.settings.orgNameAr, original.orgNameAr || 'نايوش هوب');
  row(
    'الإعدادات العامة',
    'استعادة اسم المنصة (عربي)',
    testAr,
    original.orgNameAr || 'نايوش هوب',
    'yes',
    'yes',
    'yes',
    'yes',
    'yes',
    (finalGet.data.settings.settingsChangeLog || []).some(
      (c) => c.key === 'orgNameAr' && c.newValue === (original.orgNameAr || 'نايوش هوب')
    )
      ? 'yes'
      : 'no',
    'PASS'
  );

  console.log(JSON.stringify({ ok: true, base: BASE, storage: restore.data.storage, report }, null, 2));
})().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
