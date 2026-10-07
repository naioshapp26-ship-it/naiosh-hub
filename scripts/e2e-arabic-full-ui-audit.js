/**
 * Runtime Arabic UI crawl — dashboard panels + public pages.
 * Mandatory case: العقل المركزي decision table.
 *
 * node scripts/e2e-arabic-full-ui-audit.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });

const BRAND = new Set([
  'NAIOSH', 'NAIOSHAI', 'NAIOSH HUB', 'NAIOSH HUB 360', 'NAIOSHAI HUB', 'HUB', 'HUB 360',
  'CRM', 'ERP', 'API', 'SMS', 'URL', 'ID', 'SEO', 'IP', 'KPI', 'KPIs', 'SSO', 'MFA',
  'LMS', 'LXP', 'ETL', 'USD', 'AI', 'OTP', 'QR', 'PDF', 'JSON', 'OAuth2', 'SIEM',
  'UTC', 'LAW', 'FIT', 'NAIS', 'ACADEMY', 'SMARTX', 'EDUSMARTX', 'EDUNAIOSH', 'POSHA',
  'HTTP', 'HTTPS', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HQ', 'RBAC', 'ABAC',
  'Google', 'Facebook', 'Instagram', 'WhatsApp', 'YouTube', 'Amazon', 'Noon',
  'ChatGPT', 'Canva', 'Stripe', 'PayPal', 'Paymob', 'HTML', 'CSS', 'JS', 'OS', 'UI', 'UX',
  'SDK', 'CDN', 'JWT', 'ISO', 'NIST', 'SOC',
]);

const PANELS = [
  'overview', 'operating', 'posha-clients', 'site-settings', 'clients-mgmt', 'roles-permissions',
  'notifications', 'side-project-regs', 'content-articles', 'search-admin', 'rent-admin', 'blueprint',
  'platforms', 'apps', 'products', 'store', 'identity', 'organization', 'incubators', 'wallet', 'core',
  'governance', 'info-security', 'data-governance', 'systems-automation', 'workforce', 'systems',
  'tasks', 'measurement', 'reports', 'integration', 'settings',
];

const STANDALONE = [
  'index.html', 'login.html', 'search.html', 'operating.html', 'client.html', 'store.html',
  'products.html', 'apps.html', 'branches.html', 'incubators.html', 'platforms.html', 'register.html',
  'roles-permissions.html', 'search-admin.html', 'side-projects.html', 'system-ops.html',
  'rent-admin.html', 'checkout.html', 'cart.html', 'blog.html', 'services.html', 'policies.html',
  'membership.html', 'posha.html', 'ops-catalog-admin.html', 'global-os.html', 'ads.html',
  'events.html', 'marketing-campaigns-studio.html', 'naiosh-ownership.html', 'hub-checklist.html',
  'user-path.html', 'support.html', 'news.html', 'suggestions.html', 'complaints.html',
];

const CORE_FORBIDDEN = [
  'Central Intelligence Engine',
  'AI Decision',
  'AI Decisions',
  'AI Analysis',
  'Operational',
  'Anomaly Engine',
  'Optimization Engine',
  'Optimization',
  'Growth',
];

function looksEnglish(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t || t.length < 2) return false;
  if (!/[A-Za-z]/.test(t)) return false;
  if (BRAND.has(t)) return false;
  if (/@/.test(t) || /^https?:/i.test(t)) return false;
  if (/^[A-Z]{2,8}-\d{4}-\d+/i.test(t)) return false;
  if (/^(EMP|CUS|NAI|ART|REQ|ORD|EVT|ADS|CR|TKT|SOL|EXEC|DEC)-/i.test(t)) return false;
  if (/^[\d.,:%+\-\s/]+$/.test(t)) return false;
  if (/^[A-Z]{2,6}$/.test(t) && t.length <= 5) return false;
  if (/^fa[sbrl]?-/i.test(t)) return false;
  if (/[\u0600-\u06FF]/.test(t)) {
    const latin = t.match(/[A-Za-z]{3,}/g) || [];
    return latin.some((w) => !BRAND.has(w) && !/^(AM|PM)$/i.test(w));
  }
  if (/^[A-Za-z][A-Za-z0-9+&/.-]*(?:\s+[A-Za-z][A-Za-z0-9+&/.-]*)+$/.test(t)) return true;
  if (/^[A-Za-z][A-Za-z0-9+&/.-]{3,}$/.test(t) && !BRAND.has(t)) return true;
  return false;
}

async function collect(page) {
  return page.evaluate((brandList) => {
    const brand = new Set(brandList);
    const hits = [];
    const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'KBD']);
    const walk = (node) => {
      if (!node) return;
      if (node.nodeType === 3) {
        const t = (node.nodeValue || '').replace(/\s+/g, ' ').trim();
        if (!t) return;
        hits.push({ kind: 'text', t });
        return;
      }
      if (node.nodeType !== 1) return;
      if (skip.has(node.tagName)) return;
      ['title', 'placeholder', 'aria-label', 'alt'].forEach((a) => {
        const v = node.getAttribute && node.getAttribute(a);
        if (v) hits.push({ kind: a, t: v });
      });
      if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') return;
      [...node.childNodes].forEach(walk);
    };
    walk(document.body);
    return hits;
  }, [...BRAND]);
}

async function launch() {
  return puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

(async () => {
  const browser = await launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  const report = {
    pages: [],
    coreMandatory: {},
    totals: { pages: 0, englishFound: 0, arabicizedByLayer: true },
  };

  const login = async () => {
    await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle2', timeout: 60000 });
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

  const scanPage = async (label, url) => {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 700));
    const raw = await collect(page);
    const english = raw
      .map((h) => h.t)
      .filter((t) => looksEnglish(t))
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .slice(0, 40);
    const row = {
      page: label,
      url,
      englishFound: english,
      count: english.length,
      tested: true,
      result: english.length ? 'FAIL' : 'PASS',
    };
    report.pages.push(row);
    report.totals.pages += 1;
    report.totals.englishFound += english.length;
    return row;
  };

  try {
    await login();

    for (const panel of PANELS) {
      const row = await scanPage(`dashboard#${panel}`, `${BASE}/dashboard.html#${panel}`);
      if (panel === 'core') {
        await page.waitForSelector('.hub-ci-table, .hub-core-ws, .data', { timeout: 15000 }).catch(() => {});
        await page.click('button[data-tab="decisions"], [data-action="cr-tab"][data-tab="decisions"]').catch(() => {});
        await new Promise((r) => setTimeout(r, 600));
        const tableText = await page.evaluate(() => document.body.innerText || '');
        const leftover = CORE_FORBIDDEN.filter((en) => tableText.includes(en));
        const arabicHits = {
          engine: /محرك الذكاء المركزي/.test(tableText),
          type: /تشغيلي/.test(tableText),
          analysis: /تحليل الذكاء الاصطناعي/.test(tableText),
          decision: /قرارات الذكاء الاصطناعي/.test(tableText),
        };
        await page.screenshot({ path: `${ART}/arabic_core_intelligence_desktop.png`, fullPage: false });
        report.coreMandatory = {
          leftoverEnglish: leftover,
          arabicHits,
          ok: leftover.length === 0 && arabicHits.engine && arabicHits.type,
        };
        const re = await scanPage('dashboard#core decisions', `${BASE}/dashboard.html#core`);
        report.pages[report.pages.length - 1] = re;
      }
    }

    for (const file of STANDALONE) {
      await scanPage(file, `${BASE}/${file}`);
    }

    await page.setViewport({ width: 768, height: 1024 });
    await scanPage('core tablet', `${BASE}/dashboard.html#core`);
    await page.screenshot({ path: `${ART}/arabic_core_intelligence_tablet.png`, fullPage: false });
    await page.setViewport({ width: 390, height: 844 });
    await scanPage('core mobile', `${BASE}/dashboard.html#core`);
    await page.screenshot({ path: `${ART}/arabic_core_intelligence_mobile.png`, fullPage: false });
  } finally {
    await browser.close();
  }

  const out = path.join(ART, 'arabic_full_ui_audit.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    pages: report.totals.pages,
    englishSnippets: report.totals.englishFound,
    coreMandatory: report.coreMandatory,
    fails: report.pages.filter((p) => p.result === 'FAIL').map((p) => ({ page: p.page, count: p.count, sample: p.englishFound.slice(0, 8) })),
  }, null, 2));
  if (!report.coreMandatory.ok) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
