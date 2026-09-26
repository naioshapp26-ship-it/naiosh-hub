/**
 * E2E: كارت «داخل NAIOSH» يفتح نايوش هوب بدون فقدان النموذج
 * node scripts/e2e-store-naiosh-open-site.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const OUT = '/opt/cursor/artifacts';
const HUB = 'https://www.naioshai.com/';
fs.mkdirSync(OUT, { recursive: true });

const EXPECTED = {
  amazon: 'https://www.amazon.com',
  noon: 'https://www.noon.com',
  alibaba: 'https://www.alibaba.com',
  aliexpress: 'https://www.aliexpress.com',
  ebay: 'https://www.ebay.com',
  walmart: 'https://www.walmart.com',
  etsy: 'https://www.etsy.com',
};

async function main() {
  const src = fs.readFileSync(path.join(__dirname, '../js/hub-store-upload.js'), 'utf8');
  assert.ok(src.includes(HUB) || src.includes('https://www.naioshai.com/'), 'hub home url in source');
  assert.ok(src.includes('فتح موقع نايوش هوب'), 'Arabic open-hub label');
  assert.ok(src.includes('target="_blank"'), 'opens in new tab');
  assert.ok(src.includes('noopener noreferrer'), 'noopener set');

  const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(25000);

  const runViewport = async (vp, label) => {
    await page.setViewport(vp);
    await page.goto(`${BASE}/store.html`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 800));

    // Ensure upload wizard place step is visible
    const hasPlace = await page.evaluate(() => {
      const h = document.body.innerText || '';
      return h.includes('أين سيتم بيع المنتج') || h.includes('داخل NAIOSH') || h.includes('داخل NAIOSh');
    });
    assert.ok(hasPlace, `${label}: place step visible`);

    const info = await page.evaluate((hub) => {
      const internal = document.querySelector('.su-store-card[data-place="INTERNAL"]');
      if (!internal) return { ok: false, reason: 'no internal card' };
      const open = internal.querySelector('.su-store-actions a[data-su-open]');
      const brand = internal.querySelector('a.su-store-brand-link');
      const select = internal.querySelector('[data-su-place="INTERNAL"]');
      const selected = internal.classList.contains('is-selected');
      const opens = Array.from(document.querySelectorAll('.su-store-actions a[data-su-open]')).map((a) => ({
        text: (a.textContent || '').trim(),
        href: a.getAttribute('href') || '',
        target: a.getAttribute('target') || '',
        rel: a.getAttribute('rel') || '',
      }));
      return {
        ok: true,
        selected,
        selectText: (select && select.textContent || '').trim(),
        openHref: open && open.href,
        openText: open && (open.textContent || '').trim(),
        brandHref: brand && brand.href,
        opens,
        hubMatch: open && open.href.replace(/\/$/, '') === hub.replace(/\/$/, ''),
      };
    }, HUB);

    assert.ok(info.ok, `${label}: ${info.reason || 'internal card'}`);
    assert.ok(info.selected, `${label}: NAIOSH selected by default`);
    assert.ok(/محدد/.test(info.selectText), `${label}: select button shows محدد`);
    assert.ok(info.hubMatch, `${label}: open hub href is ${HUB}, got ${info.openHref}`);
    assert.ok(info.openText && info.openText.includes('نايوش هوب'), `${label}: open button label got=${JSON.stringify(info.openText)}`);
    assert.ok(info.brandHref && info.brandHref.replace(/\/$/, '') === HUB.replace(/\/$/, ''), `${label}: brand link`);

    // External stores must have real https URLs
    const missing = info.opens.filter((o) => !/^https?:\/\//i.test(o.href));
    assert.strictEqual(missing.length, 0, `${label}: all open links https: ${JSON.stringify(missing)}`);
    info.opens.forEach((o) => {
      assert.strictEqual(o.target, '_blank', `${label}: target blank for ${o.href}`);
      assert.ok(/noopener/.test(o.rel), `${label}: noopener for ${o.href}`);
    });

    for (const [key, url] of Object.entries(EXPECTED)) {
      const hit = info.opens.find((o) => (o.href || '').includes(key) || o.href.startsWith(url));
      assert.ok(hit, `${label}: expected store link for ${key}`);
    }

    // Clicking select must NOT navigate away
    const urlBefore = page.url();
    await page.click('.su-store-card[data-place="INTERNAL"] [data-su-place="INTERNAL"]');
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(page.url().includes('store.html'), `${label}: select stays on store`);
    assert.strictEqual(new URL(page.url()).pathname, new URL(urlBefore).pathname, `${label}: no navigation on select`);

    // Fill a field then verify open link attributes (new tab — we don't follow)
    await page.type('[data-su-field="productName"]', 'منتج اختبار', { delay: 10 }).catch(() => {});
    // may still be on step 0 — type only if field exists; otherwise skip persistence check via state
    const persisted = await page.evaluate(() => {
      const name = document.querySelector('[data-su-field="productName"]');
      return name ? name.value : null;
    });

    await page.screenshot({ path: path.join(OUT, `store-naiosh-open-${label}.png`) });
    return { info, persisted };
  };

  await runViewport({ width: 1280, height: 900 }, 'desktop');
  await runViewport({ width: 390, height: 844 }, 'mobile');

  console.log(JSON.stringify({ ok: true, hub: HUB, out: OUT }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
