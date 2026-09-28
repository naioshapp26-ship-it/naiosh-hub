/**
 * E2E: Site Settings full-width store table layout
 * node scripts/e2e-site-settings-fullwidth.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const OUT = path.join(__dirname, '..', '.tmp', 'site-settings-fullwidth');
const ART = '/opt/cursor/artifacts/screenshots';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(ART, { recursive: true });

async function seedAdmin(page) {
  await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded' });
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
  });
}

async function openSiteSettings(page) {
  await page.goto(`${BASE}/dashboard.html#site-settings`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!document.getElementById('site-settings-root'), { timeout: 45000 });
  await page.waitForFunction(
    () => document.querySelectorAll('.ss-table tbody tr, .ss-store-card').length > 0,
    { timeout: 45000 }
  );
}

async function measure(page) {
  return page.evaluate(() => {
    const root = document.getElementById('site-settings-root');
    const main = document.querySelector('.main');
    const layout = document.querySelector('.ss-layout');
    const nav = document.querySelector('.ss-nav');
    const table = document.querySelector('.ss-table');
    const wrap = document.querySelector('.ss-table-wrap');
    const card = document.querySelector('.ss-card');
    const toolbar = document.querySelector('.ss-toolbar');
    if (!root || !table || !wrap) return { ok: false, reason: 'missing nodes' };

    const mainRect = main.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const navRect = nav ? nav.getBoundingClientRect() : null;

    const emptyLeft = wrapRect.left - cardRect.left;
    const unusedRight = cardRect.right - wrapRect.right;
    const fillRatio = tableRect.width / Math.max(1, cardRect.width);
    const hasHScroll = wrap.scrollWidth > wrap.clientWidth + 2;
    const navIsHorizontal = nav && getComputedStyle(nav).flexDirection !== 'column';
    const longUrls = [...table.querySelectorAll('td.ss-col-link a, td a.ss-link')].map((a) => (a.textContent || '').trim());
    const actionCounts = [...table.querySelectorAll('tbody tr')].slice(0, 3).map((tr) => {
      const acts = tr.querySelector('.ss-actions');
      if (!acts) return 0;
      return [...acts.children].filter((el) => el.matches('button, a, .ss-more-wrap')).length;
    });
    const headers = [...table.querySelectorAll('thead th')].map((th) => (th.textContent || '').trim());
    const sampleHosts = longUrls.slice(0, 5);

    return {
      ok: true,
      viewportW: window.innerWidth,
      mainW: Math.round(mainRect.width),
      cardW: Math.round(cardRect.width),
      wrapW: Math.round(wrapRect.width),
      tableW: Math.round(tableRect.width),
      fillRatio: Number(fillRatio.toFixed(3)),
      emptyLeft: Math.round(emptyLeft),
      unusedRight: Math.round(unusedRight),
      hasHScroll,
      navIsHorizontal,
      navH: navRect ? Math.round(navRect.height) : 0,
      headers,
      sampleHosts,
      actionCounts,
      toolbarCols: toolbar ? getComputedStyle(toolbar).gridTemplateColumns : '',
      sectionCount: document.querySelectorAll('.ss-nav-item').length,
    };
  });
}

async function shot(page, name) {
  const p1 = path.join(OUT, `${name}.png`);
  const p2 = path.join(ART, `${name}.png`);
  await page.screenshot({ path: p1, fullPage: false });
  fs.copyFileSync(p1, p2);
  return p2;
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1440, height: 980 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);

  await seedAdmin(page);
  await openSiteSettings(page);
  await new Promise((r) => setTimeout(r, 600));

  const desktop = await measure(page);
  console.log('desktop', JSON.stringify(desktop, null, 2));
  assert.ok(desktop.ok, desktop.reason || 'measure failed');
  assert.ok(desktop.fillRatio >= 0.85, `table should fill card width, got ${desktop.fillRatio}`);
  assert.ok(desktop.emptyLeft < 80, `empty left space too large: ${desktop.emptyLeft}`);
  assert.ok(!desktop.hasHScroll, 'no horizontal scroll on desktop');
  assert.ok(desktop.navIsHorizontal, 'section nav should be horizontal');
  assert.ok(desktop.headers.includes('المتجر') && desktop.headers.includes('الإجراءات'));
  assert.ok(desktop.headers.includes('تاريخ الإضافة'));
  assert.ok(desktop.sampleHosts.every((h) => !h.startsWith('https://')), `hosts should be short: ${desktop.sampleHosts}`);
  assert.ok(desktop.sampleHosts.some((h) => /amazon\.com|alibaba\.com|noon\.com/.test(h)), 'expected known hosts');
  assert.ok(desktop.actionCounts.every((n) => n <= 5), `actions cramped? ${desktop.actionCounts}`);

  await shot(page, 'site-settings-stores-desktop');

  async function closeModal() {
    await page.evaluate(() => {
      const btn = document.querySelector('.ss-modal-actions [data-ss-close-modal]');
      if (btn) btn.click();
    });
    await page.waitForFunction(() => !document.querySelector('.ss-modal'), { timeout: 8000 });
  }

  // View / Edit / Disable / Open site smoke — use visible table controls
  await page.evaluate(() => {
    document.querySelector('.ss-table [data-ss-store-view]')?.scrollIntoView({ block: 'center' });
  });
  await page.click('.ss-table [data-ss-store-view]');
  await page.waitForSelector('.ss-modal', { timeout: 5000 });
  await shot(page, 'site-settings-store-view');
  await closeModal();

  await page.click('.ss-table [data-ss-store-edit]');
  await page.waitForSelector('#ss-edit-name', { timeout: 5000 });
  await closeModal();

  const href = await page.$eval('.ss-table .ss-actions a[aria-label="فتح الموقع"]', (el) => el.getAttribute('href'));
  assert.ok(/^https?:\/\//.test(href), `open href=${href}`);

  // Add store wizard opens
  await page.click('[data-ss-add-store]');
  await page.waitForSelector('.ss-wizard-steps, .ss-modal', { timeout: 5000 });
  await shot(page, 'site-settings-add-store');
  await closeModal();

  // Other sections fill width
  for (const sec of ['general', 'payment', 'shipping', 'audit']) {
    await page.click(`.ss-nav-item[data-ss-section="${sec}"]`);
    await page.waitForFunction(
      (id) => document.querySelector(`.ss-nav-item.is-on[data-ss-section="${id}"]`),
      { timeout: 8000 },
      sec
    );
    const w = await page.evaluate(() => {
      const card = document.querySelector('.ss-card, .ss-main > *');
      const main = document.querySelector('.ss-main');
      if (!card || !main) return 0;
      return card.getBoundingClientRect().width / main.getBoundingClientRect().width;
    });
    assert.ok(w >= 0.9, `${sec} content fill ${w}`);
  }
  await shot(page, 'site-settings-general-desktop');

  // Back to stores for tablet/mobile
  await page.click('.ss-nav-item[data-ss-section="stores"]');
  await page.waitForSelector('.ss-table, .ss-store-cards');

  await page.setViewport({ width: 1000, height: 900 });
  await new Promise((r) => setTimeout(r, 400));
  await shot(page, 'site-settings-stores-tablet');
  const tablet = await measure(page);
  console.log('tablet', { fillRatio: tablet.fillRatio, hasHScroll: tablet.hasHScroll, ok: tablet.ok });
  assert.ok(tablet.ok && tablet.fillRatio >= 0.85, `tablet fill ${tablet.fillRatio}`);
  assert.ok(!tablet.hasHScroll, 'tablet no h-scroll');

  await page.setViewport({ width: 390, height: 844 });
  await new Promise((r) => setTimeout(r, 400));
  const mobile = await page.evaluate(() => {
    const cards = document.querySelectorAll('.ss-store-card').length;
    const wrap = document.querySelector('.ss-table-wrap');
    const tableHidden = !wrap || getComputedStyle(wrap).display === 'none';
    const navHidden = getComputedStyle(document.querySelector('.ss-nav')).display === 'none';
    const mobileSelect = getComputedStyle(document.querySelector('.ss-nav-mobile')).display !== 'none';
    return { cards, tableHidden, navHidden, mobileSelect };
  });
  console.log('mobile', mobile);
  assert.ok(mobile.cards > 0, 'mobile cards');
  assert.ok(mobile.tableHidden, 'table hidden on mobile');
  assert.ok(mobile.navHidden && mobile.mobileSelect, 'mobile section select');
  await shot(page, 'site-settings-stores-mobile');

  // Disable/enable one store via custom confirm modal or window.confirm
  await page.setViewport({ width: 1440, height: 980 });
  await page.goto(`${BASE}/dashboard.html#site-settings`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.ss-table [data-ss-store-disable], .ss-table [data-ss-store-enable]');
  page.on('dialog', async (d) => {
    try {
      await d.accept();
    } catch (_) {}
  });
  const hasDisable = await page.$('.ss-table [data-ss-store-disable]');
  if (hasDisable) {
    await page.click('.ss-table [data-ss-store-disable]');
    await page.waitForSelector('[data-ss-confirm-ok]', { timeout: 5000 });
    await page.click('[data-ss-confirm-ok]');
  } else {
    await page.click('.ss-table [data-ss-store-enable]');
  }
  await new Promise((r) => setTimeout(r, 700));
  await shot(page, 'site-settings-stores-after-toggle');

  console.log('PASS site-settings-fullwidth');
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
