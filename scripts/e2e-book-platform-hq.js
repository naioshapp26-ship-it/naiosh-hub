/**
 * Browser E2E: book platform from HQ → no branch/incubator → منصتي client-only
 */
const puppeteer = require('/tmp/e2e-chrome/node_modules/puppeteer-core');

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:8765';
const stamp = Date.now().toString(36);
const EMAIL = `hq-client-${stamp}@test.com`;

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
  if (!mine || !String(mine.href || '').includes('my-platform.html')) fail('منصتي missing from right menu');

  await page.goto(`${BASE}/book-platform.html?from=hq`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-book-form]');
  const ui = await page.evaluate(() => ({
    h1: document.querySelector('.hub-feature-hero h1')?.textContent.trim() || '',
    lead: document.querySelector('.hub-feature-hero p')?.textContent || '',
    ops: document.querySelector('[data-from-hq] .hub-book-ops')?.textContent || '',
    branchHidden: document.querySelector('[name="branch"]')?.hidden === true,
    incubatorHidden: document.querySelector('[name="incubator"]')?.hidden === true,
    branchRequired: document.querySelector('[name="branch"]')?.required === true,
    incubatorRequired: document.querySelector('[name="incubator"]')?.required === true,
    systemsVisible: document.querySelector('[data-work-systems]')?.hidden === false,
  }));
  if (!ui.h1.includes('المكتب الرئيسي')) fail(`title ${ui.h1}`);
  if (!ui.lead.includes('بدون فروع ولا حاضنات')) fail('lead missing HQ operating text');
  if (!ui.ops.includes('منصتي')) fail('HQ ops box missing');
  if (!ui.branchHidden || !ui.incubatorHidden) fail('branch/incubator still visible');
  if (ui.branchRequired || ui.incubatorRequired) fail('branch/incubator still required');
  if (!ui.systemsVisible) fail('systems not shown for HQ');

  await page.type('#book-platform-name', 'منصة المقر');
  await page.select('#book-sector', await page.$eval('#book-sector option:nth-child(2)', (el) => el.value));
  await page.type('#book-subdomain', `hq-plt-${stamp}`);
  await page.type('#book-name', 'عميل المقر');
  await page.type('#book-phone', '0551112233');
  await page.type('#book-email', EMAIL);
  const countryValue = await page.$$eval('#book-country option', (opts) => {
    const hit = opts.find((o) => /مصر/.test(o.textContent || ''));
    return hit?.value || opts[1]?.value || '';
  });
  await page.select('#book-country', countryValue);
  await page.click('[name="systems"][value="ERP"]');
  await page.click('[name="systems"][value="LAW"]');
  await page.type('#book-summary', 'منح منصة من المكتب الرئيسي حسب حاجة العمل');

  await Promise.all([
    page.waitForSelector('[data-book-feedback]:not([hidden])'),
    page.click('[data-book-form] button[type="submit"]'),
  ]);
  const feedback = await page.$eval('[data-book-feedback]', (el) => el.textContent);
  if (!/تم منح المنصة/.test(feedback)) fail(`feedback ${feedback}`);
  if (!/بدون فروع ولا حاضنات/.test(feedback)) fail(`feedback missing HQ note: ${feedback}`);

  const stored = await page.evaluate((email) => {
    const all = JSON.parse(localStorage.getItem('naiosh_client_platforms_v1') || '{}');
    return (all.platforms || []).filter((p) => String(p.email).toLowerCase() === email);
  }, EMAIL);
  if (stored.length !== 1) fail(`expected 1 platform got ${stored.length}`);
  if (stored[0].source !== 'hq') fail(`source ${stored[0].source}`);
  if (stored[0].branch || stored[0].incubator) fail('HQ grant still has branch/incubator');

  await page.goto(`${BASE}/my-platform.html?email=${encodeURIComponent(EMAIL)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.hub-mine-card h3'));
  const view = await page.evaluate(() => document.querySelector('[data-platform-root]')?.innerText || '');
  if (!view.includes('منصة المقر')) fail('منصتي missing HQ platform');
  if (!view.includes('بدون فرع') || !view.includes('بدون حاضنة')) fail('منصتي still shows branch path');
  if (!view.includes('المكتب الرئيسي')) fail('منصتي missing HQ source');
  if (!view.includes('ERP') || !view.includes('LAW')) fail('systems missing on منصتي');

  await browser.close();
  console.log('PASS browser E2E HQ platform → client-only منصتي');
  console.log(`  email=${EMAIL}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
