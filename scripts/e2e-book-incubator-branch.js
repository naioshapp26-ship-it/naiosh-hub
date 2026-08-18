/**
 * Browser E2E: book incubator from branch → حاضنتي shows only that client.
 */
const puppeteer = require('/tmp/e2e-chrome/node_modules/puppeteer-core');

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:8765';
const stamp = Date.now().toString(36);
const EMAIL = `incubator-owner-${stamp}@test.com`;
const OTHER = `other-inc-${stamp}@test.com`;

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
    const hits = links.filter((l) => l.label === 'حاضنتي');
    return { hits, count: hits.length };
  });
  if (mine.count !== 1) fail(`حاضنتي icons in sidebar: ${mine.count}`);
  if (!String(mine.hits[0].href || '').includes('my-incubator.html')) fail(`حاضنتي href ${mine.hits[0].href}`);
  if (String(mine.hits[0].href || '').includes('incubators.html')) fail('حاضنتي still points at catalog');

  await page.goto(`${BASE}/book-incubator.html?from=branch`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-book-form]');
  const copy = await page.evaluate(() => ({
    h1: document.querySelector('.hub-feature-hero h1')?.textContent.trim() || '',
    lead: document.querySelector('.hub-feature-hero p')?.textContent || '',
    ops: document.querySelector('.hub-book-ops')?.textContent || '',
    incubatorDisabled: document.querySelector('[name="incubator"]')?.disabled === true,
  }));
  if (!copy.h1.includes('حاضنة من فرع')) fail(`title ${copy.h1}`);
  if (!copy.lead.includes('الفرع التابعة له عند التسجيل')) fail('lead missing operating text');
  if (!copy.ops.includes('حاضنتي')) fail('ops box missing');
  if (!copy.incubatorDisabled) fail('incubator should stay locked until branch');

  await page.select('#book-sector', await page.$eval('#book-sector option:nth-child(2)', (el) => el.value));
  await page.type('#book-subdomain', `inc-br-${stamp}`);
  await page.type('#book-name', 'عميل الحاضنة');
  await page.type('#book-phone', '0509876543');
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
  await page.select('#book-branch', await page.$eval('#book-branch option:nth-child(2)', (el) => el.value));
  await page.waitForFunction(() => {
    const el = document.querySelector('[name="incubator"]');
    return el && !el.disabled && el.options.length > 1;
  });
  const incubatorInfo = await page.$$eval('#book-incubator option', (opts) => ({
    count: opts.filter((o) => o.value).length,
    value: opts.find((o) => o.value)?.value || '',
    label: opts.find((o) => o.value)?.textContent.trim() || '',
  }));
  if (incubatorInfo.count < 1) fail('no affiliated incubators after branch');
  await page.select('#book-incubator', incubatorInfo.value);
  await page.type('#book-summary', 'حجز حاضنة من الفرع التابع عند التسجيل');

  await Promise.all([
    page.waitForSelector('[data-book-feedback]:not([hidden])'),
    page.click('[data-book-form] button[type="submit"]'),
  ]);
  const feedback = await page.$eval('[data-book-feedback]', (el) => el.textContent);
  if (!/تم منح الحاضنة/.test(feedback)) fail(`feedback: ${feedback}`);

  const stored = await page.evaluate((email) => {
    const all = JSON.parse(localStorage.getItem('naiosh_client_incubators_v1') || '{}');
    return (all.incubators || []).filter((p) => String(p.email).toLowerCase() === email);
  }, EMAIL);
  if (stored.length !== 1) fail(`expected 1 client incubator, got ${stored.length}`);

  await page.goto(`${BASE}/my-incubator.html?email=${encodeURIComponent(EMAIL)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.hub-mine-card h3'));
  const view = await page.evaluate((other) => {
    const titles = [...document.querySelectorAll('.hub-mine-card h3')].map((h) => h.textContent);
    const body = document.querySelector('[data-incubator-root]')?.innerText || '';
    return {
      titles,
      meta: document.querySelector('[data-incubator-meta]')?.textContent || '',
      leakedOther: body.includes(other),
      catalogHint: /إجمالي الحاضنات|100 حاضنة/.test(body),
    };
  }, OTHER);
  if (!view.titles.length) fail('no incubator cards');
  if (view.catalogHint) fail('حاضنتي showed Hub catalog');
  if (view.leakedOther) fail('حاضنتي leaked another client');
  if (!/حاضنات العميل فقط/.test(view.meta)) fail(`meta ${view.meta}`);

  await page.evaluate((email) => {
    const key = 'naiosh_client_incubators_v1';
    const state = JSON.parse(localStorage.getItem(key) || '{}');
    state.incubators = state.incubators || [];
    state.incubators.unshift({
      id: 'cinc-other',
      email,
      incubatorLabel: 'حاضنة عميل آخر',
      branchLabel: 'مصر',
      status: 'active',
    });
    localStorage.setItem(key, JSON.stringify(state));
  }, OTHER);

  await page.goto(`${BASE}/my-incubator.html?email=${encodeURIComponent(EMAIL)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.hub-mine-card'));
  const isolated = await page.evaluate(() => document.querySelector('[data-incubator-root]')?.innerText || '');
  if (isolated.includes('حاضنة عميل آخر')) fail('client isolation broken');

  await browser.close();
  console.log('PASS browser E2E book incubator from branch → client-only حاضنتي');
  console.log(`  email=${EMAIL} incubators=${incubatorInfo.count}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
