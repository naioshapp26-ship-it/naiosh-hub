/**
 * E2E: بطاقة «داخل NAIOSH» → دخول متجر نايوش → منتجات داخلية
 * node scripts/e2e-store-naiosh-open-site.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const OUT = path.join(__dirname, '..', '.tmp', 'naiosh-store-link');
const ART = '/opt/cursor/artifacts/screenshots';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(ART, { recursive: true });

const HUB_HOME = 'https://www.naioshai.com/';

async function main() {
  const src = fs.readFileSync(path.join(__dirname, '../js/hub-store-upload.js'), 'utf8');
  assert.ok(src.includes('data-su-view-naiosh-products'), 'view-naiosh-products button marker');
  assert.ok(src.includes('دخول متجر نايوش'), 'Arabic enter-store label');
  assert.ok(!/data-place="INTERNAL"[\s\S]{0,800}فتح موقع نايوش هوب/.test(src), 'INTERNAL card must not open hub home');
  assert.ok(fs.readFileSync(path.join(__dirname, '../store.html'), 'utf8').includes('id="naiosh-products"'), 'section id');

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  const runViewport = async (vp, label) => {
    await page.setViewport(vp);
    await page.goto(`${BASE}/store.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () =>
        !!document.querySelector('.su-store-card[data-place="INTERNAL"]') &&
        !!document.getElementById('naiosh-products') &&
        !!document.getElementById('market-grid'),
      { timeout: 45000 }
    );
    await new Promise((r) => setTimeout(r, 500));

    const info = await page.evaluate((hubHome) => {
      const internal = document.querySelector('.su-store-card[data-place="INTERNAL"]');
      if (!internal) return { ok: false, reason: 'no internal card' };
      const select = internal.querySelector('[data-su-place="INTERNAL"]');
      const viewBtn = internal.querySelector('[data-su-view-naiosh-products]');
      const badHomeLink = [...internal.querySelectorAll('a')].find((a) => {
        const href = a.getAttribute('href') || '';
        return href.includes('naioshai.com') || /فتح موقع نايوش هوب/.test(a.textContent || '');
      });
      const opens = [...document.querySelectorAll('.su-store-actions a[data-su-open]')].map((a) => ({
        text: (a.textContent || '').trim(),
        href: a.getAttribute('href') || '',
        target: a.getAttribute('target') || '',
      }));
      return {
        ok: true,
        selected: internal.classList.contains('is-selected'),
        selectText: (select?.textContent || '').trim(),
        viewText: (viewBtn?.textContent || '').trim(),
        hasViewBtn: !!viewBtn,
        badHomeLink: badHomeLink ? badHomeLink.href : null,
        externalOpens: opens,
        hubHomeStillUsedByInternal: !!badHomeLink,
        gridCards: document.querySelectorAll('#market-grid .market-card').length,
        section: !!document.getElementById('naiosh-products'),
        hubHome,
      };
    }, HUB_HOME);

    assert.ok(info.ok, `${label}: ${info.reason || 'internal card'}`);
    assert.ok(info.selected, `${label}: NAIOSH selected by default`);
    assert.ok(/محدد/.test(info.selectText), `${label}: select shows محدد`);
    assert.ok(info.hasViewBtn, `${label}: view products button exists`);
    assert.ok(/دخول متجر نايوش|عرض منتجات/.test(info.viewText), `${label}: label=${info.viewText}`);
    assert.strictEqual(info.badHomeLink, null, `${label}: INTERNAL must not link to hub home`);
    assert.ok(info.section, `${label}: #naiosh-products exists`);
    assert.ok(info.gridCards > 0, `${label}: catalog has products before filter`);

    // External stores still open real sites
    const missing = info.externalOpens.filter((o) => !/^https?:\/\//i.test(o.href));
    assert.strictEqual(missing.length, 0, `${label}: external opens https`);
    info.externalOpens.forEach((o) => assert.strictEqual(o.target, '_blank', `${label}: blank for ${o.href}`));

    // Select stays on page
    const urlBefore = page.url();
    await page.click('.su-store-card[data-place="INTERNAL"] [data-su-place="INTERNAL"]');
    await new Promise((r) => setTimeout(r, 250));
    assert.ok(page.url().includes('store.html'), `${label}: select stays on store`);
    assert.strictEqual(new URL(page.url()).pathname, new URL(urlBefore).pathname, `${label}: no nav on select`);

    // View NAIOSH products → scroll + channel filter
    await page.click('[data-su-view-naiosh-products]');
    await new Promise((r) => setTimeout(r, 700));

    const afterView = await page.evaluate(() => {
      const section = document.getElementById('naiosh-products');
      const banner = document.getElementById('naiosh-channel-banner');
      const cards = [...document.querySelectorAll('#market-grid .market-card')];
      const empty = (document.querySelector('#market-grid .shop-empty')?.textContent || '').trim();
      const types = cards.map((c) => c.getAttribute('data-purchase-type'));
      const titles = cards.map((c) => c.querySelector('h3')?.textContent?.trim()).filter(Boolean);
      const rect = section?.getBoundingClientRect();
      return {
        hash: location.hash,
        search: location.search,
        bannerVisible: banner && !banner.hidden,
        bannerText: banner?.innerText || '',
        cardCount: cards.length,
        allInternal: types.length ? types.every((t) => t === 'INTERNAL') : false,
        empty,
        titles: titles.slice(0, 8),
        sectionInView: rect ? rect.top < window.innerHeight && rect.bottom > 0 : false,
        stillOnStore: location.pathname.endsWith('store.html'),
      };
    });

    assert.ok(afterView.stillOnStore, `${label}: stayed on store.html`);
    assert.ok(!afterView.search.includes('naioshai.com'), `${label}: no external nav`);
    assert.ok(afterView.hash.includes('naiosh-products') || afterView.search.includes('channel=internal'), `${label}: hash/channel set`);
    assert.ok(afterView.bannerVisible, `${label}: channel banner visible`);
    assert.ok(afterView.cardCount > 0 || /لا توجد منتجات متاحة داخل نايوش/.test(afterView.empty), `${label}: products or empty state`);
    if (afterView.cardCount > 0) {
      assert.ok(afterView.allInternal, `${label}: filtered cards are INTERNAL`);
    }

    await page.screenshot({ path: path.join(OUT, `naiosh-products-${label}.png`), fullPage: true });
    await page.screenshot({ path: path.join(ART, `naiosh_store_products_${label}.png`), fullPage: true });
    return afterView;
  };

  const desktop = await runViewport({ width: 1280, height: 900 }, 'desktop');
  const mobile = await runViewport({ width: 390, height: 844 }, 'mobile');

  // Add INTERNAL product then verify it appears in NAIOSH channel view
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${BASE}/store.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.su-store-card[data-place="INTERNAL"]');
  await page.click('[data-su-place="INTERNAL"]');
  // advance wizard enough to fill and submit — use HubStore API + refresh for reliability of persistence,
  // then UI path for viewing
  const title = `منتج داخل نايوش E2E ${Date.now().toString().slice(-5)}`;
  const created = await page.evaluate((t) => {
    const item = window.HubStore.addStoreItem({
      title: t,
      price: 99,
      points: 10,
      brand: 'NAIOSh',
      category: 'أكاديمية',
      itemKind: 'منتج',
      purchaseType: 'INTERNAL',
      status: 'pending_review',
      mirrorToCatalog: true,
    });
    window.HubMarketPages?.refreshStore?.();
    return { id: item?.id, title: item?.title, purchaseType: item?.purchaseType };
  }, title);
  assert.ok(created.id, 'created internal product');

  await page.click('[data-su-view-naiosh-products]');
  await new Promise((r) => setTimeout(r, 600));
  const seen = await page.evaluate((t) => {
    const cards = [...document.querySelectorAll('#market-grid .market-card')];
    return {
      visible: cards.some((c) => (c.textContent || '').includes(t)),
      count: cards.length,
      pendingBadge: [...document.querySelectorAll('#market-grid .badge-soft.is-warn')].length > 0,
    };
  }, title);
  assert.ok(seen.visible, `new INTERNAL product visible in channel view: ${JSON.stringify(seen)}`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#naiosh-products');
  // restore channel via API after reload
  await page.evaluate(() => window.HubMarketPages?.showNaioshInternalProducts?.({ scroll: false }));
  await new Promise((r) => setTimeout(r, 400));
  const afterRefresh = await page.evaluate((t) =>
    [...document.querySelectorAll('#market-grid .market-card')].some((c) => (c.textContent || '').includes(t)), title);
  assert.ok(afterRefresh, 'product still visible after refresh');

  console.log(
    JSON.stringify(
      {
        ok: true,
        desktopCards: desktop.cardCount,
        mobileCards: mobile.cardCount,
        created,
        out: OUT,
      },
      null,
      2
    )
  );
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
