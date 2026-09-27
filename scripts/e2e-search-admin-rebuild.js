/**
 * E2E: Search admin rebuild — add → index → public search → hide → show → persist
 * node scripts/e2e-search-admin-rebuild.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const ART = path.join(ROOT, '.tmp', 'search-admin');
const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
fs.mkdirSync(ART, { recursive: true });

const stamp = Date.now().toString(36);
const CUSTOM_TITLE = `صفحة اختبار بحث ${stamp}`;
const CUSTOM_HREF = `https://example.com/search-test-${stamp}`;

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

  // Clear previous catalog for clean run (keep HubStore)
  await page.evaluate(() => {
    localStorage.removeItem('naiosh_hub_search_catalog_v1');
    localStorage.removeItem('naiosh_hub_search_audit_v1');
  });

  // TEST 1: open search admin
  await page.goto(`${BASE}/dashboard.html#search-admin`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => !!document.querySelector('[data-hsa-root]') && !!window.HubStore?.get?.()?.empire?.productCatalog?.length, {
    timeout: 60000,
  });
  await new Promise((r) => setTimeout(r, 500));

  const shell = await page.evaluate(() => {
    const title = document.querySelector('#page-title')?.textContent?.trim() || '';
    const sub = document.querySelector('#page-sub')?.textContent?.trim() || '';
    const nav = [...document.querySelectorAll('#sidebar-nav a[data-panel="search-admin"]')].map((a) =>
      a.textContent.replace(/\s+/g, ' ').trim()
    );
    const tabs = [...document.querySelectorAll('.hsa-tab')].map((t) => t.textContent.trim());
    const engineText = document.querySelector('.hsa-engine-card')?.innerText || '';
    const emptySelects = [...document.querySelectorAll('.hsa-root select')].filter((s) => {
      const opts = [...s.options].filter((o) => o.value);
      return opts.length === 0;
    }).length;
    return { title, sub, nav: nav[0] || '', tabs, engineText, emptySelects };
  });
  push('T1-open-admin', /إدارة محرك البحث/.test(shell.title), shell.title);
  push('T1-desc', /محتوى الذي يظهر في محرك بحث نايوش/.test(shell.sub), shell.sub);
  push('T1-nav', /إدارة محرك البحث/.test(shell.nav), shell.nav);
  push(
    'T1-tabs',
    ['نظرة عامة', 'المحتوى المفهرس', 'إضافة محتوى', 'مصادر البحث', 'إعدادات البحث', 'سجل الفهرسة'].every((t) =>
      shell.tabs.includes(t)
    ),
    shell.tabs.join('|')
  );

  // TEST 2: engine not empty dropdown
  push('T2-engine-named', /محرك بحث نايوش/.test(shell.engineText), shell.engineText.slice(0, 120));
  push('T2-no-empty-select', shell.emptySelects === 0, String(shell.emptySelects));
  push('T2-no-engine-select-tab', !shell.tabs.includes('اختيار محرك البحث'), shell.tabs.join('|'));

  await page.screenshot({ path: path.join(ART, '01-overview.png'), fullPage: true });

  // TEST 3-6: add real product
  await page.click('.hsa-tabs [data-action="sa-tab"][data-tab="add"]');
  await page.waitForFunction(() => document.querySelector('.hsa-type-grid'), { timeout: 15000 });
  push('T3-add-wizard', true, 'add tab');

  await page.click('.hsa-type-grid [data-action="sa-add-type"][data-type="product"]');
  await page.waitForFunction(() => document.querySelectorAll('[data-action="sa-add-pick"]').length > 0, {
    timeout: 20000,
  });
  const productPick = await page.evaluate(() => {
    const btn = document.querySelector('[data-action="sa-add-pick"]');
    const row = btn?.closest('tr');
    return {
      id: btn?.dataset?.id || '',
      title: row?.querySelector('strong')?.textContent?.trim() || '',
      count: document.querySelectorAll('[data-action="sa-add-pick"]').length,
    };
  });
  push('T4-product-candidates', productPick.count >= 1 && !!productPick.id, JSON.stringify(productPick));
  await page.click(`[data-action="sa-add-pick"][data-id="${productPick.id}"]`);
  await page.click('[data-action="sa-add-next"]'); // to step 3
  await page.waitForSelector('#hsa-f-title', { timeout: 10000 });
  await page.click('[data-action="sa-add-next"]'); // to step 4
  await page.waitForFunction(() => !!document.querySelector('[data-action="sa-add-confirm"]'), { timeout: 10000 });
  await page.click('[data-action="sa-add-confirm"]');
  await page.waitForFunction(() => /تمت إضافة المحتوى/.test(document.body.innerText), { timeout: 10000 });
  push('T5-added', true, productPick.title);

  await page.click('[data-action="sa-tab"][data-tab="indexed"]');
  await page.waitForFunction(
    (title) => [...document.querySelectorAll('.hsa-table tbody tr')].some((tr) => tr.textContent.includes(title)),
    { timeout: 10000 },
    productPick.title
  );
  push('T6-in-indexed-table', true, productPick.title);

  const indexedId = await page.evaluate((title) => {
    const tr = [...document.querySelectorAll('.hsa-table tbody tr')].find((r) => r.textContent.includes(title));
    return tr?.querySelector('[data-action="sa-toggle-visible"]')?.dataset?.id || '';
  }, productPick.title);
  push('T6-row-id', !!indexedId, indexedId);

  // TEST 7-8: public search shows item
  await page.goto(`${BASE}/search.html`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForSelector('[data-hus-input]', { timeout: 30000 });
  await page.waitForFunction(() => !!window.HubUniversalSearch && !!window.HubSearchCatalog, { timeout: 20000 });
  const publicHit = await page.evaluate((title) => {
    const inCatalog = (window.HubSearchCatalog?.list?.() || []).some(
      (x) => x.title === title && x.searchVisible !== false
    );
    const pack =
      window.HubUniversalSearch?.searchOrchestrated?.(title) ||
      { results: window.HubUniversalSearch?.search?.(title) || [] };
    const results = pack.results || pack || [];
    const found = results.some((r) => String(r.title || '').includes(title.slice(0, 10)) || String(r.title) === title);
    const input = document.querySelector('[data-hus-input]');
    if (input) {
      input.value = title;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return { inCatalog, found, resultCount: results.length, sample: results.slice(0, 3).map((r) => r.title) };
  }, productPick.title);
  await new Promise((r) => setTimeout(r, 600));
  push('T7-open-public-search', true, 'search.html');
  push('T8-appears-in-results', publicHit.inCatalog && publicHit.found, JSON.stringify(publicHit));
  await page.screenshot({ path: path.join(ART, '02-public-search-visible.png'), fullPage: false });

  // TEST 9-10: hide then absent
  await page.goto(`${BASE}/dashboard.html#search-admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-hsa-root]', { timeout: 30000 });
  await page.evaluate(() => {
    if (window.HubSearchAdminWS?.ui) window.HubSearchAdminWS.ui.tab = 'indexed';
  });
  // trigger rerender via tab click
  await page.click('[data-action="sa-tab"][data-tab="indexed"]');
  await page.waitForFunction(
    (id) => !!document.querySelector(`[data-action="sa-toggle-visible"][data-id="${id}"]`),
    { timeout: 15000 },
    indexedId
  );
  await page.click(`[data-action="sa-toggle-visible"][data-id="${indexedId}"]`);
  await new Promise((r) => setTimeout(r, 400));
  const hidden = await page.evaluate((id) => {
    const row = window.HubSearchCatalog?.get?.(id);
    return row?.searchVisible === false;
  }, indexedId);
  push('T9-hidden-in-admin', hidden, String(hidden));

  await page.goto(`${BASE}/search.html`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => !!window.HubUniversalSearch && !!window.HubSearchCatalog, { timeout: 20000 });
  const afterHide = await page.evaluate((title) => {
    const row = (window.HubSearchCatalog?.list?.() || []).find((x) => x.title === title);
    const pack = window.HubUniversalSearch?.searchOrchestrated?.(title) || { results: [] };
    const found = (pack.results || []).some((r) => r.title === title);
    return { visible: row?.searchVisible !== false, found };
  }, productPick.title);
  push('T10-gone-from-public', afterHide.visible === false && afterHide.found === false, JSON.stringify(afterHide));

  // TEST 11: re-enable
  await page.goto(`${BASE}/dashboard.html#search-admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-hsa-root]', { timeout: 30000 });
  await page.click('[data-action="sa-tab"][data-tab="indexed"]');
  await page.waitForFunction(
    (id) => !!document.querySelector(`[data-action="sa-toggle-visible"][data-id="${id}"]`),
    { timeout: 15000 },
    indexedId
  );
  await page.click(`[data-action="sa-toggle-visible"][data-id="${indexedId}"]`);
  await new Promise((r) => setTimeout(r, 400));
  await page.goto(`${BASE}/search.html`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => !!window.HubUniversalSearch && !!window.HubSearchCatalog, { timeout: 20000 });
  const afterShow = await page.evaluate((title) => {
    const row = (window.HubSearchCatalog?.list?.() || []).find((x) => x.title === title);
    const pack = window.HubUniversalSearch?.searchOrchestrated?.(title) || { results: [] };
    const found = (pack.results || []).some((r) => r.title === title);
    return { visible: row?.searchVisible !== false, found };
  }, productPick.title);
  push('T11-reappears', afterShow.visible && afterShow.found, JSON.stringify(afterShow));

  // TEST 12: refresh
  await page.goto(`${BASE}/dashboard.html#search-admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-hsa-root]', { timeout: 30000 });
  await page.click('[data-action="sa-tab"][data-tab="indexed"]');
  await page.waitForFunction(
    (t) => [...document.querySelectorAll('.hsa-table tbody tr')].some((tr) => tr.textContent.includes(t)),
    { timeout: 15000 },
    productPick.title
  );
  push('T12-survives-refresh', true, productPick.title);

  // TEST 13: logout/login
  await page.evaluate(() => {
    localStorage.removeItem('hubAuthToken');
    sessionStorage.removeItem('hubAuthToken');
    localStorage.removeItem('hubUser');
    sessionStorage.removeItem('hubUser');
  });
  await loginAsLeader(page);
  await page.goto(`${BASE}/dashboard.html#search-admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-hsa-root]', { timeout: 30000 });
  await page.click('[data-action="sa-tab"][data-tab="indexed"]');
  await page.waitForFunction(
    (t) => [...document.querySelectorAll('.hsa-table tbody tr')].some((tr) => tr.textContent.includes(t)),
    { timeout: 15000 },
    productPick.title
  );
  push('T13-survives-logout-login', true, productPick.title);

  // TEST 14: add custom page/link
  await page.click('[data-action="sa-tab"][data-tab="add"]');
  await page.waitForSelector('[data-action="sa-add-type"][data-type="link"]', { timeout: 10000 });
  // reset wizard if on step 5
  const needsReset = await page.evaluate(() => !!document.querySelector('[data-action="sa-add-reset"]'));
  if (needsReset) await page.click('[data-action="sa-add-reset"]');
  await page.waitForSelector('[data-action="sa-add-type"][data-type="link"]', { timeout: 10000 });
  await page.click('[data-action="sa-add-type"][data-type="link"]');
  await page.waitForSelector('#hsa-f-title', { timeout: 10000 });
  await page.type('#hsa-f-title', CUSTOM_TITLE);
  await page.type('#hsa-f-href', CUSTOM_HREF);
  await page.click('[data-action="sa-add-next"]');
  await page.waitForSelector('#hsa-f-title', { timeout: 10000 });
  await page.click('[data-action="sa-add-next"]');
  await page.waitForSelector('[data-action="sa-add-confirm"]', { timeout: 10000 });
  await page.click('[data-action="sa-add-confirm"]');
  await page.waitForFunction(() => /تمت إضافة المحتوى/.test(document.body.innerText), { timeout: 10000 });
  const linkInCatalog = await page.evaluate((title) => {
    return (window.HubSearchCatalog?.list?.() || []).some((x) => x.title === title);
  }, CUSTOM_TITLE);
  push('T14-add-external-link', linkInCatalog, CUSTOM_TITLE);

  // TEST 15: reindex
  await page.click('[data-action="sa-tab"][data-tab="indexed"]');
  await page.waitForFunction(
    (t) => [...document.querySelectorAll('.hsa-table tbody tr')].some((tr) => tr.textContent.includes(t)),
    { timeout: 10000 },
    CUSTOM_TITLE
  );
  const linkId = await page.evaluate((title) => {
    const tr = [...document.querySelectorAll('.hsa-table tbody tr')].find((r) => r.textContent.includes(title));
    return tr?.querySelector('[data-action="sa-reindex"]')?.dataset?.id || '';
  }, CUSTOM_TITLE);
  await page.click(`[data-action="sa-reindex"][data-id="${linkId}"]`);
  await new Promise((r) => setTimeout(r, 300));
  const reindexed = await page.evaluate((id) => {
    const row = window.HubSearchCatalog?.get?.(id);
    return row?.indexStatus === 'indexed';
  }, linkId);
  push('T15-reindex', reindexed, linkId);

  // TEST 16: filters
  await page.select('#hsa-f-visible', '1');
  await page.click('[data-action="sa-apply"]');
  await new Promise((r) => setTimeout(r, 300));
  const filterOk = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.hsa-table tbody tr')];
    return rows.length >= 1 && !rows.every((r) => /لا توجد نتائج/.test(r.textContent));
  });
  push('T16-filters', filterOk, '');
  await page.click('[data-action="sa-clear"]');

  // Sources tab
  await page.click('[data-action="sa-tab"][data-tab="sources"]');
  await page.waitForFunction(() => /مصادر البحث/.test(document.body.innerText), { timeout: 10000 });
  const sourcesOk = await page.evaluate(() => {
    const rows = document.querySelectorAll('.hsa-table tbody tr').length;
    const hasEngine = /محرك بحث نايوش/.test(document.body.innerText);
    const emptyEngineSelect = [...document.querySelectorAll('select')].some((s) => {
      const label = s.previousElementSibling?.textContent || s.getAttribute('aria-label') || '';
      return /محرك/.test(label) && [...s.options].filter((o) => o.value).length === 0;
    });
    return { rows, hasEngine, emptyEngineSelect };
  });
  push('T-sources-table', sourcesOk.rows >= 5 && sourcesOk.hasEngine && !sourcesOk.emptyEngineSelect, JSON.stringify(sourcesOk));

  await page.screenshot({ path: path.join(ART, '03-sources.png'), fullPage: true });

  const failed = tests.filter((t) => !t.ok);
  const report = {
    passed: tests.filter((t) => t.ok).length,
    failed: failed.length,
    tests,
    engine: 'محرك بحث نايوش (HubUniversalSearch + HubSearchCatalog)',
    storage: 'localStorage:naiosh_hub_search_catalog_v1 (+ optional /api/hub/search-catalog)',
  };
  fs.writeFileSync(path.join(ART, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (failed.length) {
    console.error('FAILED', failed.map((f) => f.n).join(', '));
    process.exit(1);
  }
  console.log('OK search-admin-rebuild e2e');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
