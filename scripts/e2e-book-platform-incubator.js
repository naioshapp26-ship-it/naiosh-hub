/**
 * Browser E2E: book platform from incubator → منصتي shows only that client.
 */
const puppeteer = require('/tmp/e2e-chrome/node_modules/puppeteer-core');

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:8765';
const stamp = Date.now().toString(36);
const EMAIL = `incubator-client-${stamp}@test.com`;
const OTHER = `other-client-${stamp}@test.com`;

const fail = (msg) => {
  console.error('FAIL', msg);
  process.exit(1);
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.hero-sidebar[data-hero-sidebar] a');
  const mine = await page.evaluate(() => {
    const links = [...document.querySelectorAll('.hero-sidebar[data-hero-sidebar] a')].map((a) => ({
      label: (a.querySelector('.hero-sidebar-label') || a).textContent.trim(),
      href: a.getAttribute('href'),
    }));
    return links.find((l) => l.label === 'منصتي') || null;
  });
  if (!mine) fail('منصتي missing from right sidebar');
  if (!String(mine.href || '').includes('my-platform.html')) fail(`منصتي href is ${mine.href}`);
  if (String(mine.href || '').includes('platforms.html')) fail('منصتي still points at catalog');

  await page.goto(`${BASE}/book-platform.html?from=incubator`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-book-form]');
  const copy = await page.evaluate(() => ({
    h1: document.querySelector('.hub-feature-hero h1')?.textContent.trim() || '',
    lead: document.querySelector('.hub-feature-hero p')?.textContent || '',
    ops: document.querySelector('.hub-book-ops')?.textContent || '',
    opsHidden: document.querySelector('[data-from-incubator]')?.hidden === true,
    incubatorDisabled: document.querySelector('[name="incubator"]')?.disabled === true,
  }));
  if (!copy.h1.includes('من حاضنة')) fail(`title ${copy.h1}`);
  if (!copy.lead.includes('حاضنة تابعة لفرع')) fail('lead missing operating text');
  if (!copy.ops.includes('منصات العميل')) fail('ops box missing');
  if (copy.opsHidden) fail('incubator ops still hidden');
  if (!copy.incubatorDisabled) fail('incubator should stay locked until branch');

  await page.type('#book-platform-name', 'منصة اختبار الحاضنة');
  await page.select('#book-sector', await page.$eval('#book-sector option:nth-child(2)', (el) => el.value));
  await page.type('#book-subdomain', `inc-plt-${stamp}`);
  await page.type('#book-name', 'عميل الاختبار');
  await page.type('#book-phone', '0501234567');
  await page.type('#book-email', EMAIL);

  const countryValue = await page.$$eval('#book-country option', (opts) => {
    const hit = opts.find((o) => /السعودية/.test(o.textContent || ''));
    return hit?.value || opts[1]?.value || '';
  });
  await page.select('#book-country', countryValue);
  await page.waitForFunction(() => {
    const el = document.querySelector('[name="branch"]');
    return el && !el.disabled && el.options.length > 1;
  });
  const branchValue = await page.$eval('#book-branch option:nth-child(2)', (el) => el.value);
  await page.select('#book-branch', branchValue);
  await page.waitForFunction(() => {
    const el = document.querySelector('[name="incubator"]');
    return el && !el.disabled && el.options.length > 1;
  });
  const incubatorInfo = await page.$$eval('#book-incubator option', (opts) => ({
    count: opts.filter((o) => o.value).length,
    value: opts.find((o) => o.value)?.value || '',
  }));
  if (incubatorInfo.count < 1) fail('no affiliated incubators after branch');
  await page.select('#book-incubator', incubatorInfo.value);

  const systemsCount = await page.$$eval('[name="systems"]', (els) => els.length);
  if (systemsCount < 2) fail('systems checkboxes missing');
  await page.click('[name="systems"][value="ERP"]');
  await page.click('[name="systems"][value="CRM"]');
  await page.type('#book-summary', 'تشغيل المنصة حسب حاجة العمل من حاضنة الفرع');

  await Promise.all([
    page.waitForSelector('[data-book-feedback]:not([hidden])'),
    page.click('[data-book-form] button[type="submit"]'),
  ]);
  const feedback = await page.$eval('[data-book-feedback]', (el) => el.textContent);
  if (!/تم منح المنصة/.test(feedback)) fail(`feedback: ${feedback}`);
  if (!/ERP/.test(feedback) || !/CRM/.test(feedback)) fail(`systems not in feedback: ${feedback}`);

  const stored = await page.evaluate((email) => {
    const all = JSON.parse(localStorage.getItem('naiosh_client_platforms_v1') || '{}');
    const mine = (all.platforms || []).filter((p) => String(p.email).toLowerCase() === email);
    const subs = (() => {
      try {
        const raw = localStorage.getItem('naiosh-hub-store') || localStorage.getItem('hub-store') || '';
        return raw;
      } catch {
        return '';
      }
    })();
    return { mine, subs };
  }, EMAIL);
  if (stored.mine.length !== 1) fail(`expected 1 client platform, got ${stored.mine.length}`);
  if (stored.mine[0].platformName !== 'منصة اختبار الحاضنة') fail('platform name mismatch');
  const codes = (stored.mine[0].systems || []).map((s) => s.code).sort().join(',');
  if (codes !== 'CRM,ERP') fail(`granted systems ${codes}`);

  await page.goto(`${BASE}/my-platform.html?email=${encodeURIComponent(EMAIL)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.hub-mine-card h3'));
  const cards = await page.evaluate((email, other) => {
    const titles = [...document.querySelectorAll('.hub-mine-card h3')].map((h) => h.textContent);
    const body = document.querySelector('[data-platform-root]')?.innerText || '';
    return {
      titles,
      hasMine: titles.some((t) => t.includes('منصة اختبار الحاضنة')),
      hasCatalogHint: /١٨ منصة|المنصات السيادية/.test(body),
      leakedOther: body.includes(other),
      meta: document.querySelector('[data-platform-meta]')?.textContent || '',
    };
  }, EMAIL, OTHER);
  if (!cards.hasMine) fail(`منصتي missing platform card: ${cards.titles.join(' | ')}`);
  if (cards.hasCatalogHint) fail('منصتي showed Hub catalog');
  if (cards.leakedOther) fail('منصتي leaked another client');
  if (!/منصات العميل فقط/.test(cards.meta)) fail(`meta ${cards.meta}`);

  await page.evaluate((email) => {
    const key = 'naiosh_client_platforms_v1';
    const state = JSON.parse(localStorage.getItem(key) || '{}');
    state.platforms = state.platforms || [];
    state.platforms.unshift({
      id: 'cplt-other',
      email,
      platformName: 'منصة عميل آخر',
      incubatorLabel: 'حاضنة أخرى',
      branchLabel: 'مصر',
      systems: [{ code: 'LAW', label: 'LAW' }],
      status: 'active',
      host: 'other.naiosh.app',
    });
    localStorage.setItem(key, JSON.stringify(state));
  }, OTHER);

  await page.goto(`${BASE}/my-platform.html?email=${encodeURIComponent(EMAIL)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.hub-mine-card'));
  const isolated = await page.evaluate(() => document.querySelector('[data-platform-root]')?.innerText || '');
  if (isolated.includes('منصة عميل آخر')) fail('client isolation broken');
  if (!isolated.includes('منصة اختبار الحاضنة')) fail('own platform disappeared');

  await browser.close();
  console.log('PASS browser E2E incubator booking → client-only منصتي');
  console.log(`  email=${EMAIL} systems=${codes} incubators=${incubatorInfo.count}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
