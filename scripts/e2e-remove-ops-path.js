/**
 * E2E audit: Generic Operating Guide strip must not appear on hub pages.
 * Keeps standalone operating.html intact.
 *
 * node scripts/e2e-remove-ops-path.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

const BANNED_TITLES = [
  'طريقة تشغيل الأنظمة',
  'طريقة تشغيل المنتجات',
  'طريقة تشغيل المتجر',
  'طريقة تشغيل المنصات',
  'طريقة تشغيل الفروع',
  'طريقة تشغيل الحاضنات',
  'طريقة تشغيل الإعلانات',
  'طريقة تشغيل الفعاليات',
  'طريقة التشغيل على الرئيسية',
  'آلية التشغيل الكاملة',
  'تشغيل الأنظمة من ملف العميل',
];

const PAGES = [
  { file: 'index.html', label: 'الرئيسية' },
  { file: 'services.html', label: 'الخدمات' },
  { file: 'products.html', label: 'المنتجات' },
  { file: 'store.html', label: 'المتجر' },
  { file: 'apps.html', label: 'الأنظمة' },
  { file: 'platforms.html', label: 'المنصات' },
  { file: 'incubators.html', label: 'الحاضنات' },
  { file: 'branches.html', label: 'الفروع' },
  { file: 'ads.html', label: 'الإعلانات' },
  { file: 'events.html', label: 'الفعاليات' },
  { file: 'naiosh-solutions.html', label: 'الحلول' },
  { file: 'operating.html', label: 'آلية التشغيل (مستقلة)' },
  { file: 'system-ops.html', label: 'تشغيل الأنظمة' },
];

const VIEWPORTS = [
  { width: 390, height: 844, name: 'mobile' },
  { width: 1440, height: 900, name: 'desktop' },
];

async function scan(page) {
  return page.evaluate((titles) => {
    const ops = document.querySelectorAll('.hub-ops-path, .hub-ops-path-inner, .hub-instant-entry');
    const body = document.body?.innerText || '';
    const foundTitles = titles.filter((t) => body.includes(t));
    // On standalone operating page, "آلية التشغيل" heading is expected — only flag GUIDE strip titles
    const buyInOpsStrip = !!document.querySelector('.hub-ops-path-links');
    return {
      opsNodes: ops.length,
      foundTitles,
      buyInOpsStrip,
      hasOpsPathClass: !!document.querySelector('.hub-ops-path'),
    };
  }, BANNED_TITLES);
}

async function main() {
  // Static: no HTML still loads the injector (except optional leftover — none expected)
  const htmlFiles = fs.readdirSync(path.join(__dirname, '..')).filter((f) => f.endsWith('.html'));
  const loaders = htmlFiles.filter((f) =>
    fs.readFileSync(path.join(__dirname, '..', f), 'utf8').includes('hub-ops-path.js')
  );
  assert.deepStrictEqual(loaders, [], `HTML still loads hub-ops-path.js: ${loaders.join(', ')}`);

  const opsSrc = fs.readFileSync(path.join(__dirname, '../js/hub-ops-path.js'), 'utf8');
  assert.ok(/intentionally empty|DISABLED/i.test(opsSrc), 'hub-ops-path.js must be disabled');
  assert.ok(!opsSrc.includes('createElement'), 'hub-ops-path.js must not create DOM');

  // Standalone page must remain
  const opHtml = fs.readFileSync(path.join(__dirname, '../operating.html'), 'utf8');
  assert.ok(opHtml.includes('آلية التشغيل'), 'standalone operating.html kept');
  assert.ok(!opHtml.includes('hub-ops-path.js'), 'operating.html does not inject generic strip');

  const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(25000);

  const report = [];

  for (const p of PAGES) {
    const row = { page: p.label, file: p.file, hadStrip: null, removed: true, gap: 'ok', mobile: '—', desktop: '—' };
    for (const vp of VIEWPORTS) {
      await page.setViewport(vp);
      const res = await page.goto(`${BASE}/${p.file}`, { waitUntil: 'networkidle2', timeout: 45000 }).catch((e) => e);
      if (res instanceof Error) {
        row[vp.name] = `error: ${res.message}`;
        report.push(row);
        continue;
      }
      await new Promise((r) => setTimeout(r, 700));
      const s = await scan(page);
      // operating.html may contain similar wording in its own content — only fail on .hub-ops-path
      const fail =
        s.hasOpsPathClass ||
        s.buyInOpsStrip ||
        (p.file !== 'operating.html' && s.foundTitles.length > 0);
      row[vp.name] = fail ? `FAIL ${JSON.stringify(s)}` : 'pass';
      if (fail) row.removed = false;
      if (vp.name === 'desktop' && p.file === 'apps.html') {
        await page.screenshot({ path: path.join(OUT, 'ops-path-apps-desktop.png') });
      }
      if (vp.name === 'mobile' && p.file === 'apps.html') {
        await page.screenshot({ path: path.join(OUT, 'ops-path-apps-mobile.png') });
      }
    }
    // Gap check on apps: tabs should sit close under hero
    if (p.file === 'apps.html') {
      await page.setViewport({ width: 390, height: 844 });
      await page.goto(`${BASE}/apps.html`, { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 500));
      const gap = await page.evaluate(() => {
        const hero = document.querySelector('.market-hero');
        const tabs = document.querySelector('.market-tabs');
        if (!hero || !tabs) return null;
        const hb = hero.getBoundingClientRect().bottom;
        const tt = tabs.getBoundingClientRect().top;
        return Math.round(tt - hb);
      });
      row.gap = gap == null ? 'n/a' : gap < 80 ? `ok (${gap}px)` : `large (${gap}px)`;
      row.hadStrip = 'yes (source)';
    }
    report.push(row);
  }

  const out = path.join(OUT, 'ops-path-removal-audit.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ out, report }, null, 2));

  const failed = report.filter((r) => r.mobile?.startsWith?.('FAIL') || r.desktop?.startsWith?.('FAIL') || r.removed === false);
  await browser.close();
  if (failed.length) {
    console.error('FAILED', failed);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
