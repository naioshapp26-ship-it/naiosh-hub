/**
 * E2E: تعريب الواجهة — لا تسميات إنجليزية ظاهرة للمستخدم
 * node scripts/e2e-arabic-ui.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BANNED = [
  'Core Layer',
  'Business Layer',
  'Collaboration Layer',
  'Governance Layer',
  'Knowledge Layer',
  'Learning Ecosystem',
  'Core Platform',
  'ENTERPRISE WORKSPACE',
  'Tier 1 — Core',
  'building',
  'Active',
  'Inactive',
  'Pending',
  'Approved',
  'Rejected',
  'Draft',
  'Published',
  'Failed to fetch',
  'Network Error',
  'Loading...',
  'No Data',
  'Save Changes',
  'View All',
];

const BRAND_OK = /NAIOSH|HUB|ERP|CRM|SSO|API|SMS|ID|USD|KPI|LMS|MFA|FIT|LAW|NAIS/i;

function visibleTextScan(page) {
  return page.evaluate((banned) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const hits = [];
    let n;
    while ((n = walker.nextNode())) {
      const t = (n.textContent || '').trim();
      if (!t || t.length < 3) continue;
      const el = n.parentElement;
      if (!el) continue;
      const tag = el.tagName;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE'].includes(tag)) continue;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      for (const b of banned) {
        if (t === b || t.includes(b)) {
          // allow brand-ish short codes alone
          hits.push({ banned: b, text: t.slice(0, 120), tag });
        }
      }
    }
    return hits;
  }, BANNED);
}

async function seedStaff(page) {
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    const user = { email: 'leader@naiosh.com', name: 'القائد الأعلى', role: 'supreme_leader', employeeNo: 'EMP-0001' };
    localStorage.setItem('hubUser', JSON.stringify(user));
    sessionStorage.setItem('hubUser', JSON.stringify(user));
    localStorage.setItem('hubAuthToken', 'hub360.' + btoa('leader@naiosh.com') + '.' + Date.now());
  });
}

async function seedClient(page) {
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    const user = { email: 'client@naiosh.com', name: 'عميل تجريبي', role: 'customer' };
    localStorage.setItem('hubUser', JSON.stringify(user));
    sessionStorage.setItem('hubUser', JSON.stringify(user));
    localStorage.setItem('hubAuthToken', 'hub360.' + btoa('client@naiosh.com') + '.' + Date.now());
  });
}

async function checkPage(page, url, name, viewport) {
  await page.setViewport(viewport);
  await page.goto(`${BASE}/${url}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(800);
  const hits = await visibleTextScan(page);
  // Filter: "building" inside font-awesome class text shouldn't appear as text nodes;
  // "Active" as part of Arabic is rare; allow if surrounded by brand patterns only when exact word.
  const real = hits.filter((h) => {
    if (h.banned === 'building' && /fa-/.test(h.text)) return false;
    // status words that appear inside longer Arabic sentences with English brand — keep flagging exact
    return true;
  });
  const shot = path.join(OUT, `ar-ui-${name}-${viewport.width}.png`);
  await page.screenshot({ path: shot, fullPage: false });
  return { name, url, viewport: viewport.width, hits: real, shot };
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(25000);

  const report = { pages: [], failures: [] };
  const viewports = [
    { width: 1440, height: 900, label: 'desktop' },
    { width: 768, height: 1024, label: 'tablet' },
    { width: 390, height: 844, label: 'mobile' },
  ];

  await seedStaff(page);
  // Clear stored empire so Arabic seed applies
  await page.evaluate(() => {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('naioshHub360Store')) localStorage.removeItem(k);
    });
  });

  const staffPages = [
    ['dashboard.html#blueprint', 'blueprint'],
    ['dashboard.html#overview', 'overview'],
    ['index.html', 'home'],
    ['global-os.html', 'global-os'],
    ['operating.html', 'operating'],
    ['system-ops.html', 'system-ops'],
    ['products.html', 'products'],
    ['store.html', 'store'],
    ['branches.html', 'branches'],
    ['engine-specs.html', 'engine-specs'],
  ];

  for (const vp of viewports) {
    for (const [url, name] of staffPages) {
      try {
        const r = await checkPage(page, url, `${name}-${vp.label}`, vp);
        report.pages.push(r);
        // Blueprint must not show layer English
        if (name === 'blueprint') {
          const layerHits = r.hits.filter((h) =>
            ['Core Layer', 'Business Layer', 'Collaboration Layer', 'Governance Layer', 'Knowledge Layer', 'Learning Ecosystem', 'Core Platform', 'building'].includes(h.banned)
          );
          if (layerHits.length) {
            report.failures.push({ page: name, vp: vp.label, layerHits });
          }
        }
      } catch (e) {
        report.failures.push({ page: name, vp: vp.label, error: String(e.message || e) });
      }
    }
  }

  await seedClient(page);
  for (const vp of viewports) {
    try {
      const r = await checkPage(page, 'client.html', `client-${vp.label}`, vp);
      report.pages.push(r);
    } catch (e) {
      report.failures.push({ page: 'client', vp: vp.label, error: String(e.message || e) });
    }
  }

  // Deep assert blueprint Arabic content
  await seedStaff(page);
  await page.evaluate(() => {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('naioshHub360Store')) localStorage.removeItem(k);
    });
  });
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE}/dashboard.html#blueprint`, { waitUntil: 'networkidle2' });
  await sleep(1200);
  const bodyText = await page.evaluate(() => document.body.innerText);
  assert.ok(bodyText.includes('الطبقة الأساسية') || bodyText.includes('طبقة الأعمال'), 'missing Arabic layer titles');
  assert.ok(!bodyText.includes('Core Layer'), 'Core Layer still visible');
  assert.ok(!bodyText.includes('Business Layer'), 'Business Layer still visible');
  assert.ok(!bodyText.includes('Collaboration Layer'), 'Collaboration Layer still visible');
  assert.ok(!bodyText.includes('Governance Layer'), 'Governance Layer still visible');
  assert.ok(!bodyText.includes('Knowledge Layer'), 'Knowledge Layer still visible');
  assert.ok(!bodyText.includes('Learning Ecosystem'), 'Learning Ecosystem still visible');
  assert.ok(bodyText.includes('قيد الإنشاء') || bodyText.includes('مخطط') || bodyText.includes('المنصة الأساسية'), 'expected Arabic status/platform');
  assert.ok(!/\bbuilding\b/.test(bodyText), 'building status still visible');
  await page.screenshot({ path: path.join(OUT, 'ar-ui-blueprint-desktop-final.png'), fullPage: true });

  const outPath = path.join(OUT, 'ar-ui-e2e-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pages: report.pages.length, failures: report.failures, outPath }, null, 2));

  await browser.close();
  if (report.failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
