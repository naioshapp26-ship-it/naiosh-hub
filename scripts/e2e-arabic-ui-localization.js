/**
 * E2E Browser: تعريب دستور المعمارية + فحص لوحات أخرى
 * node scripts/e2e-arabic-ui-localization.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const ART = path.join(ROOT, '.tmp', 'arabic-ui');
const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
fs.mkdirSync(ART, { recursive: true });

const BRAND_OK = new Set([
  'NAIOSH',
  'NAIOSHAI',
  'NAIOSH HUB',
  'NAIOSH HUB 360',
  'HUB',
  'HUB 360',
  'CRM',
  'ERP',
  'API',
  'SMS',
  'URL',
  'ID',
  'SEO',
  'IP',
  'KPI',
  'SSO',
  'MFA',
  'OAuth2',
  'SIEM',
  'LMS',
  'LXP',
  'ETL',
  'USD',
]);

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
    // Force fresh empire seed from updated blueprint
    localStorage.removeItem('naioshHub360Store_v13');
  });
};

const collectUiEnglish = async (page) =>
  page.evaluate((brandList) => {
    const brand = new Set(brandList);
    const looks = (s) => {
      const t = String(s || '').trim();
      if (!t || t.length < 2) return false;
      if (/[\u0600-\u06FF]/.test(t)) return false;
      if (brand.has(t)) return false;
      if (/@/.test(t) || /^https?:/i.test(t)) return false;
      if (/^\d+(\.\d+)?%?$/.test(t)) return false;
      if (/^[A-Z0-9._-]{2,12}$/i.test(t) && !/\s/.test(t)) return false;
      if (window.HubI18n?.looksLikeUiEnglish?.(t)) return true;
      if (/^[A-Za-z][A-Za-z0-9+&/.-]*(?:\s+[A-Za-z][A-Za-z0-9+&/.-]*)+$/.test(t)) return true;
      if (/^(Save|Cancel|Delete|Edit|Add|Search|Filter|Status|Loading|Waiting|Pending|Failed|Passed|Active|Inactive|building|planned|ready)$/i.test(t))
        return true;
      return false;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const hits = [];
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent) continue;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE'].includes(parent.tagName)) continue;
      if (parent.closest('code, pre, [data-testid="tech"], .sr-only')) continue;
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      // split on · | , for mixed lines
      text.split(/\s*[·|,/]\s*/).forEach((part) => {
        const p = part.trim();
        if (looks(p)) hits.push({ text: p, tag: parent.tagName, sample: text.slice(0, 80) });
      });
      if (looks(text)) hits.push({ text, tag: parent.tagName, sample: text.slice(0, 80) });
    }
    // unique
    const seen = new Set();
    return hits.filter((h) => {
      const k = h.text;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [...BRAND_OK]);

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
    console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d != null && d !== '' ? ` — ${String(d).slice(0, 200)}` : ''}`);
  };

  await page.setViewport({ width: 1400, height: 900 });
  await loginAsLeader(page);

  // 1. Blueprint page
  await page.goto(`${BASE}/dashboard.html#blueprint`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => !!document.querySelector('.empire-verdict, .phase-cards') && !!window.EmpireBlueprint, {
    timeout: 60000,
  });
  await new Promise((r) => setTimeout(r, 600));

  const title = await page.evaluate(() => document.querySelector('#page-title')?.textContent?.trim() || '');
  push('T1-blueprint-title', /دستور المعمارية/.test(title), title);

  const layerCheck = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.phase-card')];
    const titles = cards.map((c) => c.querySelector('h4')?.textContent?.trim());
    const smalls = cards.map((c) => c.querySelector('small')?.textContent?.trim()).filter(Boolean);
    const items = cards.flatMap((c) => [...c.querySelectorAll('li')].map((li) => li.textContent.trim()));
    return { titles, smalls, items };
  });
  push(
    'T2-layers-arabic',
    layerCheck.titles.length === 5 && layerCheck.titles.every((t) => /[\u0600-\u06FF]/.test(t)) && !layerCheck.titles.some((t) => /Layer/i.test(t)),
    JSON.stringify(layerCheck.titles)
  );
  push('T3-no-english-layer-subtitle', layerCheck.smalls.length === 0, JSON.stringify(layerCheck.smalls));
  push('T4-no-learning-ecosystem-en', !layerCheck.items.some((i) => /Learning Ecosystem/i.test(i)), JSON.stringify(layerCheck.items));

  const tableCheck = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.table-wrap table.data tbody tr')].slice(0, 12);
    return rows.map((r) => {
      const cells = [...r.querySelectorAll('td')].map((td) => td.textContent.replace(/\s+/g, ' ').trim());
      return { name: cells[0], desc: cells[1], status: cells[2] };
    });
  });
  const badNames = tableCheck.filter((r) => /Single Sign-On|Role Matrix|Notification Center|Organization Hierarchy|^IAM$|Multi-Tenant/i.test(r.name || ''));
  const badStatus = tableCheck.filter((r) => /building|planned|ready|pending|active/i.test(r.status || '') && !/[\u0600-\u06FF]/.test(r.status || ''));
  push('T5-core-names-arabic', badNames.length === 0, JSON.stringify(badNames));
  push('T6-status-arabic', badStatus.length === 0, JSON.stringify(badStatus.map((x) => x.status)));

  // Scroll bottom — docs / tree
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((r) => setTimeout(r, 300));
  const bottomHits = await collectUiEnglish(page);
  // Filter known allowed brand tokens that might appear alone in title NAIOSH HUB 360
  const blueprintEnglish = bottomHits.filter(
    (h) =>
      !BRAND_OK.has(h.text) &&
      !/^NAIOSH(\s+HUB(\s+360)?)?$/i.test(h.text) &&
      !/^0\d+$/.test(h.text)
  );
  push('T7-blueprint-dom-scan', blueprintEnglish.length === 0, JSON.stringify(blueprintEnglish.slice(0, 25)));

  await page.screenshot({ path: path.join(ART, 'blueprint-top.png'), fullPage: false });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.screenshot({ path: path.join(ART, 'blueprint-bottom.png'), fullPage: false });

  // Advance action
  await page.evaluate(() => window.scrollTo(0, 400));
  const advanced = await page.evaluate(() => {
    const btn = document.querySelector('[data-action="advance-core"]');
    if (!btn) return { ok: false };
    btn.click();
    return { ok: true };
  });
  await new Promise((r) => setTimeout(r, 400));
  push('T8-advance-action', advanced.ok, '');

  // Refresh
  await page.reload({ waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => !!document.querySelector('.phase-cards'), { timeout: 60000 });
  const afterRefresh = await page.evaluate(() =>
    [...document.querySelectorAll('.phase-card h4')].map((h) => h.textContent.trim())
  );
  push('T9-refresh-arabic', afterRefresh.every((t) => /[\u0600-\u06FF]/.test(t) && !/Layer/i.test(t)), JSON.stringify(afterRefresh));

  // Logout / Login
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.removeItem('hubUser');
    localStorage.removeItem('hubAuthToken');
  });
  await loginAsLeader(page);
  // keep store this time
  await page.evaluate(() => {
    /* store already seeded */
  });
  await page.goto(`${BASE}/dashboard.html#blueprint`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => !!document.querySelector('.phase-cards'), { timeout: 60000 });
  const afterLogin = await collectUiEnglish(page);
  const afterLoginBad = afterLogin.filter((h) => !BRAND_OK.has(h.text) && !/^NAIOSH(\s+HUB(\s+360)?)?$/i.test(h.text));
  push('T10-relogin-arabic', afterLoginBad.length === 0, JSON.stringify(afterLoginBad.slice(0, 20)));

  // Other panels scan
  const panels = [
    'overview',
    'identity',
    'roles-permissions',
    'branches',
    'incubators',
    'search-admin',
    'notifications',
    'settings',
    'governance',
    'systems-market',
  ];
  const panelResults = [];
  for (const panel of panels) {
    await page.evaluate(() => {
      localStorage.removeItem('naioshHub360Store_v13');
    });
    await page.goto(`${BASE}/dashboard.html#${panel}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !!window.HubStore?.get, { timeout: 60000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));
    const hits = await collectUiEnglish(page);
    const bad = hits.filter(
      (h) =>
        !BRAND_OK.has(h.text) &&
        !/^NAIOSH(\s+HUB(\s+360)?)?$/i.test(h.text) &&
        !/^Naiosh(\s+Hub)?$/i.test(h.text) &&
        !/^EMP-|^NAI-|^cmt_|^svc-|^sc-/i.test(h.text) &&
        !/^POL-/i.test(h.text) &&
        !/^\d{4}-\d{2}-\d{2}/.test(h.text)
    );
    panelResults.push({ panel, count: bad.length, sample: bad.slice(0, 8) });
    push(`T-panel-${panel}`, bad.length === 0, bad.length ? JSON.stringify(bad.slice(0, 8)) : 'clean');
  }

  fs.writeFileSync(
    path.join(ART, 'results.json'),
    JSON.stringify({ tests, panelResults, blueprintEnglishCount: blueprintEnglish.length }, null, 2)
  );

  const failed = tests.filter((t) => !t.ok);
  await browser.close();
  if (failed.length) {
    console.error('FAILED', failed.map((f) => f.n).join(', '));
    process.exit(1);
  }
  console.log('OK e2e-arabic-ui-localization');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
