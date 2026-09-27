/**
 * E2E: dashboard #organization → إدارة الفروع
 * Add / edit / persist across refresh + logout/login
 * Incubators page remains independent; branch filter works
 *
 * node scripts/e2e-branches-mgmt.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const ART = path.join(ROOT, '.tmp', 'branches-mgmt');
const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
fs.mkdirSync(ART, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop-1366', width: 1366, height: 900 },
  { name: 'tablet-900', width: 900, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
];

const stamp = Date.now().toString(36);
const BRANCH_NAME = `فرع اختبار ${stamp}`;
const BRANCH_MANAGER = `مدير ${stamp}`;
const BRANCH_CODE = `T${stamp.slice(-3).toUpperCase()}`;

const loginAsLeader = async (page) => {
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    const user = {
      name: 'القائد الأعلى',
      email: 'leader@naiosh.com',
      role: 'supreme_leader',
      naioshId: 'NAI-LEADER-001',
      employeeNo: 'EMP-0001',
    };
    localStorage.setItem('hubUser', JSON.stringify(user));
    sessionStorage.setItem('hubUser', JSON.stringify(user));
    const token = `hub360.${btoa('leader@naiosh.com')}.${Date.now()}`;
    localStorage.setItem('hubAuthToken', token);
    sessionStorage.setItem('hubAuthToken', token);
  });
};

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  const tests = [];
  const push = (n, ok, d) => tests.push({ n, ok: !!ok, d: d == null ? '' : String(d) });

  await page.setViewport({ width: 1366, height: 900 });
  await loginAsLeader(page);
  await page.goto(`${BASE}/dashboard.html#organization`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!document.querySelector('[data-branches-admin], .branches-admin'), {
    timeout: 45000,
  });
  await new Promise((r) => setTimeout(r, 600));

  const labels = await page.evaluate(() => {
    const nav = [...document.querySelectorAll('[data-nav]')].map((el) => ({
      key: el.dataset.nav,
      label: el.textContent.replace(/\s+/g, ' ').trim(),
    }));
    const orgNav = nav.find((n) => n.key === 'organization');
    const incNav = nav.find((n) => n.key === 'incubators');
    return {
      title: document.querySelector('#page-title')?.textContent.trim() || '',
      subtitle: document.querySelector('#page-sub, .page-sub, .page-lead, #page-desc')?.textContent?.trim() ||
        document.querySelector('.page-head p, .content-head p, header p')?.textContent?.trim() ||
        '',
      orgNav: orgNav?.label || '',
      incNav: incNav?.label || '',
      hasChain: !!document.querySelector('.chain-row'),
      hasCountriesCard: [...document.querySelectorAll('h3')].some((h) => /الدول/.test(h.textContent)),
      hasPlatformsCard: [...document.querySelectorAll('h3')].some((h) => /المنصات السيادية/.test(h.textContent)),
      hasOpenBranchesBtn: [...document.querySelectorAll('a,button')].some((el) =>
        /فتح صفحة الفروع/.test(el.textContent || '')
      ),
      hasAddBtn: !!document.querySelector('[data-hub-act="add"][data-entity="branches"]'),
      cols: [...document.querySelectorAll('.branches-admin-table thead th')].map((th) => th.textContent.trim()),
      seedCount: document.querySelectorAll('.branches-admin-table tbody tr[data-branch-id]').length,
    };
  });

  // subtitle may live in #page-sub — probe more selectively
  const pageMeta = await page.evaluate(() => {
    const sub =
      document.querySelector('#page-sub')?.textContent?.trim() ||
      document.querySelector('[data-page-sub]')?.textContent?.trim() ||
      '';
    return { sub, bodyHasDesc: /إدارة فروع نايوش حسب الدول/.test(document.body.innerText) };
  });

  push('nav-label-branches', /الفروع/.test(labels.orgNav), labels.orgNav);
  push('nav-incubators-kept', /الحاضنات/.test(labels.incNav), labels.incNav);
  push('title-manage-branches', labels.title === 'إدارة الفروع', labels.title);
  push('desc-present', pageMeta.bodyHasDesc || /إدارة فروع نايوش/.test(pageMeta.sub), pageMeta.sub);
  push('no-hierarchy-chain', !labels.hasChain, String(labels.hasChain));
  push('no-countries-admin-card', !labels.hasCountriesCard, String(labels.hasCountriesCard));
  push('no-platforms-admin-card', !labels.hasPlatformsCard, String(labels.hasPlatformsCard));
  push('no-open-branches-btn', !labels.hasOpenBranchesBtn, String(labels.hasOpenBranchesBtn));
  push('has-add-branch-btn', labels.hasAddBtn, '');
  push(
    'table-cols',
    labels.cols.includes('اسم الفرع') &&
      labels.cols.includes('الدولة') &&
      labels.cols.includes('كود الفرع') &&
      labels.cols.includes('مدير الفرع') &&
      labels.cols.includes('الحالة') &&
      labels.cols.includes('الحاضنات') &&
      labels.cols.includes('الإجراءات'),
    labels.cols.join('|')
  );
  push('seed-branches-kept', labels.seedCount >= 20, String(labels.seedCount));

  // layout viewports
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise((r) => setTimeout(r, 300));
    const shot = path.join(ART, `${vp.name}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    const metrics = await page.evaluate(() => {
      const wrap = document.querySelector('.branches-admin-table-wrap');
      const table = document.querySelector('.branches-admin-table');
      if (!wrap || !table) return { ok: false };
      const overflow = wrap.scrollWidth > wrap.clientWidth + 8;
      const titleOk = (document.querySelector('#page-title')?.textContent || '').includes('الفروع');
      return { ok: true, overflow, titleOk, scrollW: wrap.scrollWidth, clientW: wrap.clientWidth };
    });
    push(`layout-${vp.name}`, metrics.ok && metrics.titleOk, JSON.stringify(metrics));
  }

  await page.setViewport({ width: 1366, height: 900 });

  // Add branch
  await page.click('[data-hub-act="add"][data-entity="branches"]');
  await page.waitForSelector('#hub-erp-modal.open #hub-add-nameAr', { timeout: 15000 });
  await page.type('#hub-add-nameAr', BRANCH_NAME);
  const countryValue = await page.$$eval('#hub-add-country option', (opts) => {
    const hit = opts.find((o) => /السعودية/.test(o.textContent || ''));
    return hit?.value || opts.find((o) => o.value)?.value || '';
  });
  push('country-select-has-options', !!countryValue, countryValue);
  await page.select('#hub-add-country', countryValue);
  await page.evaluate((code) => {
    const el = document.getElementById('hub-add-code');
    if (el) {
      el.value = code;
      el.dataset.auto = '0';
    }
  }, BRANCH_CODE);
  await page.type('#hub-add-manager', BRANCH_MANAGER);
  await page.click('#hub-add-save');
  await page.waitForFunction(
    (name) => [...document.querySelectorAll('.branches-admin-table tbody tr')].some((tr) => tr.textContent.includes(name)),
    { timeout: 15000 },
    BRANCH_NAME
  );
  push('branch-appears-after-add', true, BRANCH_NAME);

  const storedAfterAdd = await page.evaluate((name) => {
    const raw = localStorage.getItem('naioshHub360Store_v13');
    const store = raw ? JSON.parse(raw) : null;
    const list = store?.empire?.organization?.worldBranches || [];
    const hit = list.find((b) => b.nameAr === name);
    return {
      found: !!hit,
      country: hit?.country || '',
      code: hit?.code || '',
      manager: hit?.manager || '',
      status: hit?.status || '',
      total: list.length,
      incubators: (store?.empire?.organization?.incubators || []).length,
      countries: (store?.empire?.organization?.countries || []).length,
    };
  }, BRANCH_NAME);
  push('persisted-in-hubstore', storedAfterAdd.found, JSON.stringify(storedAfterAdd));
  push('incubators-untouched', storedAfterAdd.incubators >= 50, String(storedAfterAdd.incubators));
  push('countries-kept', storedAfterAdd.countries >= 20, String(storedAfterAdd.countries));

  // Edit branch
  const branchId = await page.evaluate((name) => {
    const tr = [...document.querySelectorAll('.branches-admin-table tbody tr')].find((row) =>
      row.textContent.includes(name)
    );
    return tr?.getAttribute('data-branch-id') || '';
  }, BRANCH_NAME);
  push('branch-row-id', !!branchId, branchId);
  await page.click(`[data-hub-act="edit"][data-entity="branches"][data-id="${branchId}"]`);
  await page.waitForSelector('#hub-erp-modal.open #hub-edit-title', { timeout: 15000 });
  const editedName = `${BRANCH_NAME} معدّل`;
  await page.evaluate((name) => {
    document.getElementById('hub-edit-title').value = name;
  }, editedName);
  await page.evaluate((mgr) => {
    const el = document.getElementById('hub-edit-manager');
    if (el) el.value = mgr;
  }, `${BRANCH_MANAGER} 2`);
  await page.click('#hub-edit-save');
  await page.waitForFunction(
    (name) => [...document.querySelectorAll('.branches-admin-table tbody tr')].some((tr) => tr.textContent.includes(name)),
    { timeout: 15000 },
    editedName
  );
  push('branch-edited', true, editedName);

  // View → incubators link
  await page.click(`[data-hub-act="view"][data-entity="branches"][data-id="${branchId}"]`);
  await page.waitForSelector('#hub-erp-modal.open', { timeout: 10000 });
  const viewHasInc = await page.evaluate(() => /الحاضنات التابعة لهذا الفرع/.test(document.body.innerText));
  push('view-shows-incubator-count', viewHasInc, '');
  await page.click('#hub-branch-go-incubators');
  await page.waitForFunction(() => (location.hash || '').includes('incubators'), { timeout: 10000 });
  await page.waitForFunction(() => !!document.querySelector('.branches-admin-filter-banner, table.data'), {
    timeout: 15000,
  });
  const incPage = await page.evaluate(() => ({
    hash: location.hash,
    banner: document.querySelector('.branches-admin-filter-banner')?.textContent || '',
    rows: document.querySelectorAll('table.data tbody tr').length,
    title: document.querySelector('#page-title')?.textContent || '',
  }));
  push('incubators-page-filtered', /incubators/.test(incPage.hash) && /إدارة الحاضنات/.test(incPage.title), JSON.stringify(incPage));
  push('incubators-filter-banner', /فلتر|الفرع|الحاضنات المرتبطة/.test(incPage.banner), incPage.banner.slice(0, 120));
  push('incubators-still-listed', incPage.rows >= 1, String(incPage.rows));

  // Refresh persistence
  await page.goto(`${BASE}/dashboard.html#organization`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    (name) => [...document.querySelectorAll('.branches-admin-table tbody tr')].some((tr) => tr.textContent.includes(name)),
    { timeout: 20000 },
    editedName
  );
  push('survives-refresh', true, editedName);

  // Logout / login persistence (clear auth only, keep HubStore)
  await page.evaluate(() => {
    localStorage.removeItem('hubAuthToken');
    sessionStorage.removeItem('hubAuthToken');
    localStorage.removeItem('hubUser');
    sessionStorage.removeItem('hubUser');
  });
  await loginAsLeader(page);
  await page.goto(`${BASE}/dashboard.html#organization`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    (name) => [...document.querySelectorAll('.branches-admin-table tbody tr')].some((tr) => tr.textContent.includes(name)),
    { timeout: 20000 },
    editedName
  );
  push('survives-logout-login', true, editedName);

  const finalStore = await page.evaluate((name) => {
    const store = JSON.parse(localStorage.getItem('naioshHub360Store_v13') || '{}');
    const org = store?.empire?.organization || {};
    const hit = (org.worldBranches || []).find((b) => b.nameAr === name);
    return {
      branch: !!hit,
      manager: hit?.manager || '',
      incubators: (org.incubators || []).length,
      worldBranches: (org.worldBranches || []).length,
      chainKept: Array.isArray(org.chain) && org.chain.length >= 3,
      countriesKept: (org.countries || []).length >= 20,
    };
  }, editedName);
  push('final-branch-present', finalStore.branch, JSON.stringify(finalStore));
  push('backend-relations-kept', finalStore.chainKept && finalStore.countriesKept && finalStore.incubators >= 50, JSON.stringify(finalStore));

  await page.screenshot({ path: path.join(ART, 'final-desktop.png'), fullPage: true });

  const failed = tests.filter((t) => !t.ok);
  const report = { passed: tests.filter((t) => t.ok).length, failed: failed.length, tests };
  fs.writeFileSync(path.join(ART, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (failed.length) {
    console.error('FAILED', failed.map((f) => f.n).join(', '));
    process.exit(1);
  }
  console.log('OK branches-mgmt e2e');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
