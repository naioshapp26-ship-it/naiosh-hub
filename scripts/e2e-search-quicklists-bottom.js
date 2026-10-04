/**
 * Browser E2E: search box → results immediately → quick lists last.
 * Run: node scripts/e2e-search-quicklists-bottom.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

async function launch() {
  return puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

async function pageAt(browser, width, height) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  page.setDefaultTimeout(25000);
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.__errors = errors;
  return page;
}

async function orderOn(page) {
  return page.evaluate(() => {
    const input = document.querySelector('[data-hus-input]');
    const cluster = document.querySelector('[data-hus-results-cluster]');
    const results = document.querySelector('[data-hus-results]');
    const filters = document.querySelector('.hus-filters');
    const suggest = document.querySelector('[data-hus-suggest]');
    const suggests = [...document.querySelectorAll('[data-hus-suggest]')];
    const top = (el) => (el ? el.getBoundingClientRect().top + window.scrollY : -1);
    const between = (a, b, c) => a < b && b < c;
    return {
      hasInput: !!input,
      hasResults: !!results,
      hasSuggest: !!suggest,
      suggestCount: suggests.length,
      inputTop: top(input),
      clusterTop: top(cluster),
      resultsTop: top(results),
      filtersTop: top(filters),
      suggestTop: top(suggest),
      label: suggest?.innerText?.includes('قوائم سريعة') || false,
      filterLabel: document.body.innerText.includes('تصفية نتائج البحث'),
      firstHit: document.querySelector('.hus-item')?.getAttribute('href') || '',
      firstTitle: document.querySelector('.hus-item strong')?.textContent || '',
      countText: document.querySelector('[data-hus-results-meta]')?.innerText || '',
    };
  });
}

async function main() {
  const rows = [];
  const mark = (t, ok, extra) => {
    rows.push({ t, result: ok ? 'PASS' : 'FAIL', extra: extra || '' });
    console.log(ok ? 'PASS' : 'FAIL', t, extra || '');
  };
  const browser = await launch();
  try {
    for (const [name, w, h] of [
      ['desktop', 1440, 900],
      ['tablet', 768, 1024],
      ['mobile', 390, 844],
    ]) {
      const page = await pageAt(browser, w, h);
      await page.goto(`${BASE}/search.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-hus-input]');
      await page.waitForSelector('.hus-item, .hus-empty');
      const before = await orderOn(page);
      mark(`${name} single quick lists`, before.suggestCount === 1, String(before.suggestCount));
      mark(
        `${name} order input→results→quicklists`,
        before.inputTop < before.resultsTop && before.resultsTop < before.suggestTop,
        JSON.stringify({ i: before.inputTop, r: before.resultsTop, s: before.suggestTop })
      );
      mark(`${name} no lists between search and results`, before.suggestTop > before.resultsTop && before.filtersTop > before.inputTop);

      await page.click('[data-hus-input]', { clickCount: 3 });
      await page.type('[data-hus-input]', 'استشارة');
      await page.waitForFunction(() => document.body.innerText.includes('نتائج البحث عن'));
      const after = await orderOn(page);
      mark(`${name} results under query`, after.countText.includes('استشارة') && after.resultsTop > after.inputTop, after.countText.slice(0, 80));
      mark(`${name} still one quick list`, after.suggestCount === 1);
      await page.screenshot({ path: path.join(OUT, `search_quicklists_${name}.png`), fullPage: true });

      if (name === 'desktop') {
        const href = after.firstHit;
        mark('first result has href', !!href, href);
        const beforeUrl = page.url();
        if (href && !href.startsWith('javascript:')) {
          await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null), page.click('.hus-item')]);
          mark('result opens destination', page.url() !== beforeUrl || page.url().includes(href.split('#')[0]), page.url());
        }
        await page.goto(`${BASE}/search.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-hus-input]');
        await page.type('[data-hus-input]', 'فرع');
        await page.waitForFunction(() => (document.querySelector('[data-hus-results-meta]')?.innerText || '').includes('فرع'));
        const allCount = await page.evaluate(() => document.querySelectorAll('.hus-item').length);
        await page.click('[data-hus-filter="branch"]');
        await page.waitForFunction(() => document.querySelector('[data-hus-filter="branch"]')?.classList.contains('is-active'));
        const filtered = await page.evaluate(() => ({
          n: document.querySelectorAll('.hus-item').length,
          badges: [...document.querySelectorAll('.hus-badge')].map((b) => b.textContent),
        }));
        mark('filter changes results', filtered.n !== allCount || filtered.badges.every((b) => b.includes('فرع')), `${allCount} → ${filtered.n}`);
        const cards = await page.evaluate(() =>
          [...document.querySelectorAll('[data-hus-suggest-type]')].map((b) => ({
            type: b.getAttribute('data-hus-suggest-type'),
            label: b.innerText.replace(/\s+/g, ' ').trim(),
          }))
        );
        mark('quick list cards present', cards.length >= 4, cards.map((c) => c.type).join(','));
        const consoleErrs = page.__errors.filter((e) => !/favicon/i.test(e));
        mark('no page errors', consoleErrs.length === 0, consoleErrs.slice(0, 3).join(' | '));
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, 'search-quicklists-e2e.json'), JSON.stringify(rows, null, 2));
  const failed = rows.filter((r) => r.result === 'FAIL');
  console.log('\nSUMMARY', rows.length - failed.length + '/' + rows.length);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
