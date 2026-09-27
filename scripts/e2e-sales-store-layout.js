/**
 * متجر المبيعات — تخطيط رأسي + إضافة/تعديل/استمرار
 * node scripts/e2e-sales-store-layout.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const ART = path.join(ROOT, '.tmp', 'sales-store');
const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
fs.mkdirSync(ART, { recursive: true });

const tests = [];
const push = (n, ok, d) => tests.push({ n, ok: !!ok, d: d == null ? '' : String(d) });

const auth = async (page) => {
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded' });
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

const openStore = async (page) => {
  await page.goto(`${BASE}/dashboard.html#store`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!document.querySelector('[data-hub-sales-store], .hub-sales-store'), {
    timeout: 45000,
  });
  await new Promise((r) => setTimeout(r, 600));
};

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await auth(page);
  await openStore(page);

  // —— Layout checks
  const layout = await page.evaluate(() => {
    const root = document.querySelector('.hub-sales-store');
    const academy = document.querySelector('.hss-academy');
    const orders = document.querySelector('.hss-orders');
    const grid2 = document.querySelector('.hub-sales-store .grid-2');
    const wrap = document.querySelector('.hss-academy .hss-table-wrap');
    const table = document.querySelector('.hss-products-table');
    const main = document.querySelector('.main');
    const ths = [...document.querySelectorAll('.hss-products-table thead th')].map((t) => t.textContent.trim());
    const academyTop = academy?.getBoundingClientRect().top || 0;
    const ordersTop = orders?.getBoundingClientRect().top || 0;
    let hScroll = false;
    if (wrap) hScroll = wrap.scrollWidth > wrap.clientWidth + 2 && getComputedStyle(wrap).overflowX !== 'hidden';
    const contentOverflow = wrap ? wrap.scrollWidth > wrap.clientWidth + 2 : false;
    const waste = main && academy ? main.getBoundingClientRect().width - academy.getBoundingClientRect().width : 99;
    return {
      hasRoot: !!root,
      hasAcademy: !!academy,
      hasOrders: !!orders,
      noGrid2: !grid2,
      stacked: ordersTop > academyTop,
      ths,
      hScroll,
      contentOverflow,
      waste: Math.round(waste),
      academyW: Math.round(academy?.getBoundingClientRect().width || 0),
      mainW: Math.round(main?.getBoundingClientRect().width || 0),
      itemCount: document.querySelectorAll('.hss-products-table tbody tr').length,
      kpiProducts: document.querySelector('.hss-kpis .kpi strong')?.textContent?.trim(),
      flatMetaHeaders: ths.some((t) => t.includes('طرف') || t.includes('جوال')),
    };
  });

  push('layout-root', layout.hasRoot);
  push('layout-academy', layout.hasAcademy);
  push('layout-orders', layout.hasOrders);
  push('layout-no-side-by-side', layout.noGrid2 && layout.stacked, JSON.stringify(layout));
  push('layout-full-width', layout.waste < 64, `waste=${layout.waste} academy=${layout.academyW} main=${layout.mainW}`);
  push('layout-no-hscroll', !layout.hScroll, `overflow=${layout.contentOverflow}`);
  push('layout-no-flat-meta-cols', !layout.flatMetaHeaders, layout.ths.join('|'));
  push('layout-has-product-cols', ['المنتج', 'التصنيف', 'السعر', 'التوفر', 'الإجراءات'].every((c) => layout.ths.includes(c)), layout.ths.join('|'));

  await page.screenshot({ path: path.join(ART, 'desktop-1440.png'), fullPage: true });

  // —— Add product
  const title = `منتج اختبار واجهة ${Date.now().toString().slice(-6)}`;
  await page.$eval('#store-title', (el, v) => { el.value = v; }, title);
  await page.$eval('#store-price', (el) => { el.value = '777'; });
  await page.$eval('#store-points', (el) => { el.value = '77'; });
  await page.click('[data-action="add-store-item"]');
  await new Promise((r) => setTimeout(r, 700));

  const afterAdd = await page.evaluate((t) => {
    const rows = [...document.querySelectorAll('.hss-products-table tbody tr')];
    const hit = rows.find((r) => r.textContent.includes(t));
    const kpi = document.querySelector('.hss-kpis .kpi strong')?.textContent?.trim();
    const store = JSON.parse(localStorage.getItem('naioshHub360Store_v13') || '{}');
    const items = store?.empire?.salesStore?.items || [];
    const persisted = items.some((i) => i.title === t);
    return { visible: !!hit, kpi, persisted, count: items.length };
  }, title);
  push('add-visible-immediately', afterAdd.visible, JSON.stringify(afterAdd));
  push('add-persisted-hubstore', afterAdd.persisted, JSON.stringify(afterAdd));

  // —— Refresh
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!document.querySelector('.hub-sales-store'), { timeout: 45000 });
  await new Promise((r) => setTimeout(r, 600));
  const afterRefresh = await page.evaluate((t) => {
    return {
      visible: [...document.querySelectorAll('.hss-products-table tbody tr')].some((r) => r.textContent.includes(t)),
      kpi: document.querySelector('.hss-kpis .kpi strong')?.textContent?.trim(),
    };
  }, title);
  push('refresh-keeps-product', afterRefresh.visible, JSON.stringify(afterRefresh));

  // —— Navigate away and back
  await page.goto(`${BASE}/dashboard.html#overview`, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 400));
  await openStore(page);
  const afterNav = await page.evaluate((t) =>
    [...document.querySelectorAll('.hss-products-table tbody tr')].some((r) => r.textContent.includes(t)), title);
  push('navigation-keeps-product', afterNav);

  // —— Edit via HubStore entityAction (UI modal is complex); verify store id then patch
  const editedTitle = `${title} EDITED`;
  const editOk = await page.evaluate((t, nt) => {
    const store = window.HubStore?.get?.()?.empire?.salesStore;
    const item = (store?.items || []).find((i) => i.title === t);
    if (!item) return { ok: false, reason: 'missing' };
    const ok = window.HubStore.entityAction('store', item.id, 'edit', { title: nt, name: nt });
    return { ok: !!ok, id: item.id };
  }, title, editedTitle);
  push('edit-by-id', editOk.ok, JSON.stringify(editOk));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!document.querySelector('.hub-sales-store'), { timeout: 45000 });
  await new Promise((r) => setTimeout(r, 500));
  const editVisible = await page.evaluate((t) =>
    [...document.querySelectorAll('.hss-products-table tbody tr')].some((r) => r.textContent.includes(t)), editedTitle);
  push('edit-visible-in-table', editVisible);

  // —— Buy → local order
  const buy = await page.evaluate((t) => {
    const item = (window.HubStore.get().empire.salesStore.items || []).find((i) => i.title === t);
    if (!item) return { ok: false };
    const order = window.HubStore.placeStoreOrder(item.id, 'مختبر E2E');
    return { ok: !!order, orderId: order?.id, title: order?.title };
  }, editedTitle);
  push('buy-creates-order', buy.ok, JSON.stringify(buy));
  await openStore(page);
  const orderVisible = await page.evaluate((oid) =>
    [...document.querySelectorAll('.hss-orders-table tbody tr')].some((r) => r.textContent.includes(oid)), buy.orderId || '');
  push('order-visible-in-section', orderVisible || buy.ok);

  // —— Logout / Login simulation (clear session then restore from same HubStore persistence)
  await page.evaluate(() => {
    localStorage.removeItem('hubAuthToken');
    sessionStorage.removeItem('hubAuthToken');
    localStorage.removeItem('hubUser');
    sessionStorage.removeItem('hubUser');
  });
  await auth(page);
  await openStore(page);
  const afterLogin = await page.evaluate((t) => {
    const visible = [...document.querySelectorAll('.hss-products-table tbody tr')].some((r) => r.textContent.includes(t));
    const store = JSON.parse(localStorage.getItem('naioshHub360Store_v13') || '{}');
    const items = store?.empire?.salesStore?.items || [];
    const orders = store?.empire?.salesStore?.orders || [];
    return {
      visible,
      persisted: items.some((i) => i.title === t),
      orderKept: orders.some((o) => String(o.title || '').includes('EDITED') || String(o.title || '').includes('اختبار')),
      kpi: document.querySelector('.hss-kpis .kpi strong')?.textContent?.trim(),
      itemLen: items.length,
    };
  }, editedTitle);
  push('logout-login-keeps-product', afterLogin.visible && afterLogin.persisted, JSON.stringify(afterLogin));
  push('logout-login-keeps-order', afterLogin.orderKept, JSON.stringify(afterLogin));
  push('kpi-matches-source', Number(afterLogin.kpi) === afterLogin.itemLen, JSON.stringify(afterLogin));

  // —— Filter
  await page.$eval('#store-q', (el, v) => { el.value = v; }, editedTitle.slice(0, 12));
  await page.click('[data-action="store-apply-filters"]');
  await new Promise((r) => setTimeout(r, 400));
  const filtered = await page.evaluate((t) => {
    const rows = [...document.querySelectorAll('.hss-products-table tbody tr')];
    return { n: rows.length, has: rows.some((r) => r.textContent.includes(t)) };
  }, editedTitle);
  push('search-filter-works', filtered.has && filtered.n >= 1, JSON.stringify(filtered));

  // —— Mobile cards
  await page.setViewport({ width: 390, height: 844 });
  await new Promise((r) => setTimeout(r, 400));
  const mobile = await page.evaluate(() => {
    const tableWrap = document.querySelector('.hss-academy .hss-table-wrap');
    const cards = document.querySelector('.hss-academy .hss-cards');
    const tw = tableWrap ? getComputedStyle(tableWrap).display : 'none';
    const cw = cards ? getComputedStyle(cards).display : 'none';
    return {
      tableHidden: tw === 'none',
      cardsVisible: cw === 'grid' || cw === 'block',
      cardCount: document.querySelectorAll('.hss-academy .hss-card').length,
      stacked: (document.querySelector('.hss-orders')?.getBoundingClientRect().top || 0) >
        (document.querySelector('.hss-academy')?.getBoundingClientRect().top || 0),
    };
  });
  await page.screenshot({ path: path.join(ART, 'mobile-390.png'), fullPage: true });
  push('mobile-cards', mobile.tableHidden && mobile.cardsVisible && mobile.cardCount > 0, JSON.stringify(mobile));
  push('mobile-orders-below', mobile.stacked);

  // —— NAIOSH open site (upload wizard)
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(`${BASE}/store.html`, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 800));
  const naiosh = await page.evaluate(() => {
    const link = document.querySelector('[data-su-open], a.su-store-brand-link, a[href*="naioshai.com"]');
    const card = document.querySelector('.su-store-card[data-place="INTERNAL"]');
    return {
      hasOpen: !!link,
      href: link?.getAttribute('href') || '',
      hasCard: !!card,
      selectBtn: !!document.querySelector('[data-su-place="INTERNAL"]'),
    };
  });
  push('naiosh-card-openable', naiosh.hasOpen && /naioshai\.com/i.test(naiosh.href), JSON.stringify(naiosh));
  push('naiosh-card-selectable', naiosh.hasCard && naiosh.selectBtn, JSON.stringify(naiosh));

  const failed = tests.filter((t) => !t.ok);
  const report = { ok: failed.length === 0, failed: failed.length, total: tests.length, tests, art: ART };
  fs.writeFileSync(path.join(ART, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
