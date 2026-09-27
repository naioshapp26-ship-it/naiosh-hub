/**
 * E2E: إدارة محرك البحث ↔ search.html — مصدر حقيقة واحد
 * node scripts/e2e-search-admin-unify.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const ART = path.join(ROOT, '.tmp', 'search-admin-unify');
const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
fs.mkdirSync(ART, { recursive: true });

const stamp = Date.now().toString(36);
const SERVICE_TITLE = `خدمة اختبار توحيد بحث ${stamp}`;

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

const readSearchStats = async (page) => {
  await page.goto(`${BASE}/search.html`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => !!window.HubUniversalSearch?.stats, { timeout: 60000 });
  return page.evaluate(() => {
    const s = window.HubUniversalSearch.stats();
    const texts = [...document.querySelectorAll('[data-hus-stats] article')].map((a) => ({
      n: a.querySelector('strong')?.textContent?.trim(),
      l: a.querySelector('span')?.textContent?.trim(),
    }));
    return { s, texts };
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
  const push = (n, ok, d) => {
    tests.push({ n, ok: !!ok, d: d == null ? '' : String(d) });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d != null ? ` — ${d}` : ''}`);
  };

  await page.setViewport({ width: 1366, height: 900 });
  await loginAsLeader(page);

  // Clean prior test artifacts but keep live catalogs
  await page.evaluate(() => {
    localStorage.removeItem('naiosh_hub_search_config_v1');
    // keep services catalog except our prior test services — wipe custom services for clean counter
    try {
      const list = JSON.parse(localStorage.getItem('naiosh_hub_services_catalog_v1') || '[]');
      const cleaned = (Array.isArray(list) ? list : []).filter((x) => !String(x.title || '').includes('خدمة اختبار توحيد بحث'));
      localStorage.setItem('naiosh_hub_services_catalog_v1', JSON.stringify(cleaned));
    } catch (_) {}
  });

  // 1–3: baseline search.html
  const before = await readSearchStats(page);
  push('T1-search-stats-loaded', before.s.all > 0, `all=${before.s.all} service=${before.s.service}`);
  push('T2-service-counter', before.s.service >= 1, before.s.service);
  const existingHit = await page.evaluate(() => {
    const r = window.HubUniversalSearch.search('الدراسات', 'service');
    return r.some((x) => /دراس/.test(x.title));
  });
  push('T3-existing-service-searchable', existingHit, '');

  // 4: open admin
  await page.goto(`${BASE}/dashboard.html#search-admin`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => !!document.querySelector('[data-hsa-root]') && !!window.HubUniversalSearch?.stats, {
    timeout: 60000,
  });
  await new Promise((r) => setTimeout(r, 400));

  const adminShell = await page.evaluate(() => {
    const title = document.querySelector('#page-title')?.textContent?.trim() || '';
    const tabs = [...document.querySelectorAll('.hsa-tab')].map((t) => t.textContent.trim());
    const stats = window.HubUniversalSearch.stats();
    const adminAll = document.querySelector('.hsa-stat strong')?.textContent?.trim();
    return { title, tabs, stats, adminAll };
  });
  push('T4-admin-open', /إدارة محرك البحث/.test(adminShell.title), adminShell.title);
  push('T4-admin-tabs-intents', adminShell.tabs.includes('نوايا البحث'), adminShell.tabs.join(','));
  push('T4-admin-tabs-ql', adminShell.tabs.includes('القوائم السريعة'), adminShell.tabs.join(','));
  push(
    'T4-admin-same-total',
    Number(adminShell.stats.all) === Number(before.s.all),
    `admin=${adminShell.stats.all} search=${before.s.all}`
  );

  // 5–6: add real service via admin API (same path as UI confirm)
  const added = await page.evaluate((title) => {
    const beforeSvc = window.HubUniversalSearch.stats().service;
    const res = window.HubServicesCatalog.add({
      title,
      description: 'خدمة أُضيفت من اختبار توحيد الإدارة مع المحرك',
      keywords: title,
    });
    const afterSvc = window.HubUniversalSearch.stats().service;
    const inCatalog = window.HubUniversalSearch.collectCatalog().some((x) => x.title === title);
    window.HubSearchCatalog?.pushAudit?.({
      action: 'إضافة خدمة لمحرك البحث',
      itemId: res.item?.id,
      title,
      by: 'e2e',
      result: 'نجاح',
    });
    return {
      ok: !!res?.ok,
      id: res.item?.id,
      beforeSvc,
      afterSvc,
      inCatalog,
      all: window.HubUniversalSearch.stats().all,
    };
  }, SERVICE_TITLE);
  push('T5-add-service-ok', added.ok && added.inCatalog, JSON.stringify(added));
  push('T6-service-counter-plus1', added.afterSvc === added.beforeSvc + 1, `${added.beforeSvc}→${added.afterSvc}`);

  // Persist via UI path: open add tab and verify table shows it
  await page.evaluate(() => {
    const btn = document.querySelector('[data-action="sa-tab"][data-tab="indexed"]');
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 200));
  // trigger rerender if available
  await page.evaluate(() => {
    if (typeof window.__hubSaRerender === 'function') window.__hubSaRerender();
    else if (typeof window.hubRerender === 'function') window.hubRerender();
  });
  await new Promise((r) => setTimeout(r, 500));

  const inAdminTable = await page.evaluate((title) => {
    const rows = window.HubSearchAdminWS?.liveCatalog?.(true) || window.HubUniversalSearch.collectCatalog({ includeHidden: true });
    return rows.some((r) => r.title === title && r.type === 'service');
  }, SERVICE_TITLE);
  push('T6b-in-admin-live-catalog', inAdminTable, '');

  // 7–10: refresh search.html — find + counters
  const afterAdd = await readSearchStats(page);
  push('T7-service-counter-search', afterAdd.s.service === before.s.service + 1, `${before.s.service}→${afterAdd.s.service}`);
  push('T8-total-plus1', afterAdd.s.all === before.s.all + 1, `${before.s.all}→${afterAdd.s.all}`);
  const foundNew = await page.evaluate((title) => {
    const r = window.HubUniversalSearch.search(title, 'all');
    return { hit: r.some((x) => x.title === title), n: r.length };
  }, SERVICE_TITLE);
  push('T9-new-searchable', foundNew.hit, JSON.stringify(foundNew));

  // screenshot evidence
  await page.screenshot({ path: path.join(ART, '01-search-after-add.png'), fullPage: true });

  // 11–18: hide from admin
  await page.goto(`${BASE}/dashboard.html#search-admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.HubSearchConfig && !!window.HubUniversalSearch, { timeout: 60000 });
  const hidden = await page.evaluate((title) => {
    const item = window.HubUniversalSearch.collectCatalog({ includeHidden: true }).find((x) => x.title === title);
    if (!item) return { ok: false };
    window.HubSearchConfig.setHidden(item.id, true, 'e2e');
    const visible = window.HubUniversalSearch.collectCatalog().some((x) => x.title === title);
    const s = window.HubUniversalSearch.stats();
    return { ok: true, id: item.id, stillVisible: visible, service: s.service, all: s.all };
  }, SERVICE_TITLE);
  push('T11-hide-ok', hidden.ok && !hidden.stillVisible, JSON.stringify(hidden));

  const afterHide = await readSearchStats(page);
  push('T12-hidden-not-in-search', afterHide.s.service === before.s.service, `${afterHide.s.service} vs baseline ${before.s.service}`);
  push('T13-total-restored', afterHide.s.all === before.s.all, `${afterHide.s.all} vs ${before.s.all}`);
  const notFound = await page.evaluate((title) => {
    return !window.HubUniversalSearch.search(title, 'all').some((x) => x.title === title);
  }, SERVICE_TITLE);
  push('T14-search-miss-when-hidden', notFound, '');

  // 19–20: re-enable
  await page.goto(`${BASE}/dashboard.html#search-admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.HubSearchConfig, { timeout: 30000 });
  const shown = await page.evaluate((id) => {
    window.HubSearchConfig.setHidden(id, false, 'e2e');
    return window.HubUniversalSearch.stats();
  }, hidden.id);
  push('T19-reenable-service-count', shown.service === before.s.service + 1, shown.service);

  const afterShow = await readSearchStats(page);
  const foundAgain = await page.evaluate((title) => {
    return window.HubUniversalSearch.search(title, 'all').some((x) => x.title === title);
  }, SERVICE_TITLE);
  push('T20-reappear', foundAgain && afterShow.s.service === before.s.service + 1, afterShow.s.service);

  // intents: add custom + appear on search
  await page.goto(`${BASE}/dashboard.html#search-admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.HubSearchConfig, { timeout: 30000 });
  const intentLabel = `أريد اختبار توحيد ${stamp}...`;
  await page.evaluate((label) => {
    window.HubSearchConfig.upsertCustomIntent(
      {
        label,
        icon: 'fa-flask',
        starters: [label, 'أريد اختبار توحيد'],
        explain: 'نية اختبار E2E',
        group: 'primary',
      },
      'e2e'
    );
  }, intentLabel);
  await page.goto(`${BASE}/search.html`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => !!window.HubSearchIntents?.PRIMARY_STARTERS, { timeout: 60000 });
  const intentOnPage = await page.evaluate((label) => {
    const starters = window.HubSearchIntents.PRIMARY_STARTERS || [];
    const inApi = starters.some((s) => s.label === label);
    const inDom = [...document.querySelectorAll('[data-hus-starters] button')].some((b) => b.textContent.includes(label.slice(0, 12)));
    return { inApi, inDom, intents: window.HubUniversalSearch.stats().intents };
  }, intentLabel);
  push('T-intent-on-search', intentOnPage.inApi && intentOnPage.inDom, JSON.stringify(intentOnPage));

  // 21–24: logout/login persistence (localStorage)
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.removeItem('hubUser');
    localStorage.removeItem('hubAuthToken');
  });
  await loginAsLeader(page);
  await page.goto(`${BASE}/search.html`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => !!window.HubUniversalSearch?.stats, { timeout: 60000 });
  const afterRelogin = await page.evaluate((title, intentLabel) => {
    const s = window.HubUniversalSearch.stats();
    const hit = window.HubUniversalSearch.search(title, 'all').some((x) => x.title === title);
    const intent = (window.HubSearchIntents.PRIMARY_STARTERS || []).some((x) => x.label === intentLabel);
    const cfg = window.HubSearchConfig?.read?.();
    return {
      service: s.service,
      hit,
      intent,
      hasConfig: !!cfg,
      customServices: (JSON.parse(localStorage.getItem('naiosh_hub_services_catalog_v1') || '[]') || []).some(
        (x) => x.title === title
      ),
    };
  }, SERVICE_TITLE, intentLabel);
  push('T21-persist-after-relogin', afterRelogin.hit && afterRelogin.customServices && afterRelogin.intent, JSON.stringify(afterRelogin));

  // refresh
  await page.reload({ waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => !!window.HubUniversalSearch?.stats, { timeout: 60000 });
  const afterRefresh = await page.evaluate((title) => {
    return window.HubUniversalSearch.search(title, 'all').some((x) => x.title === title);
  }, SERVICE_TITLE);
  push('T23-persist-after-refresh', afterRefresh, '');

  await page.screenshot({ path: path.join(ART, '02-search-final.png'), fullPage: true });

  const failed = tests.filter((t) => !t.ok);
  fs.writeFileSync(path.join(ART, 'results.json'), JSON.stringify({ tests, failed: failed.length, SERVICE_TITLE }, null, 2));
  await browser.close();
  if (failed.length) {
    console.error('FAILED', failed.map((f) => f.n).join(', '));
    process.exit(1);
  }
  console.log('OK search-admin-unify e2e');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
