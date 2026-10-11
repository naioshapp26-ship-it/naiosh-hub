#!/usr/bin/env node
/** E2E: dark-mode button/nav contrast — no light-on-light. */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.HUB_E2E_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const ART = '/opt/cursor/artifacts';
const rows = [];
const mark = (c, p, e) => {
  rows.push({ check: c, result: p ? 'PASS' : 'FAIL', evidence: String(e || '').slice(0, 400) });
  console.log(`${p ? 'PASS' : 'FAIL'} | ${c} | ${e}`);
};

function contrastHelpers() {
  return {
    lum([r, g, b]) {
      const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    },
    parse(c) {
      const m = String(c || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? [+m[1], +m[2], +m[3]] : null;
    },
    contrast(fg, bg) {
      const L1 = this.lum(fg);
      const L2 = this.lum(bg);
      const hi = Math.max(L1, L2);
      const lo = Math.min(L1, L2);
      return (hi + 0.05) / (lo + 0.05);
    },
  };
}

async function scanBad(page, selector) {
  return page.evaluate((sel) => {
    function lum([r, g, b]) {
      const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    }
    function parse(c) {
      const m = String(c || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? [+m[1], +m[2], +m[3]] : null;
    }
    function contrast(fg, bg) {
      const L1 = lum(fg);
      const L2 = lum(bg);
      return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    }
    const bad = [];
    document.querySelectorAll(sel).forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.2) return;
      const fg = parse(cs.color);
      const bg = parse(cs.backgroundColor);
      if (!fg || !bg || cs.backgroundColor === 'rgba(0, 0, 0, 0)') return;
      const ratio = contrast(fg, bg);
      if (ratio < 3) {
        bad.push({
          t: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28),
          ratio: +ratio.toFixed(2),
          color: cs.color,
          bg: cs.backgroundColor,
        });
      }
    });
    return bad;
  }, selector);
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(() => {
      localStorage.setItem('hubTheme', 'dark');
      window.HubTheme?.set?.('dark');
    });
    await new Promise((r) => setTimeout(r, 600));

    const navSel = '.top-nav .nav-links a, .top-nav .auth-btn, .hub-theme-toggle';
    const navBad = await scanBad(page, navSel);
    mark('هيدر الرئيسية: لا أزرار بتباين ضعيف', navBad.length === 0, JSON.stringify(navBad.slice(0, 5)));

    const navSample = await page.evaluate(() => {
      const a = document.querySelector('.top-nav .nav-links a:not(.active)');
      const cs = getComputedStyle(a);
      return { t: a?.textContent?.trim(), color: cs.color, bg: cs.backgroundColor };
    });
    mark(
      'هيدر: أزرار غير النشطة بخلفية داكنة ونص فاتح',
      /rgb\(2[0-9],\s*3[0-9],\s*3[0-9]\)|rgb\(28,\s*30,\s*38\)/.test(navSample.bg) &&
        /rgb\(24[0-9]|rgb\(255/.test(navSample.color),
      JSON.stringify(navSample)
    );

    await page.screenshot({ path: path.join(ART, 'dark_contrast_nav_final.png'), fullPage: false });

    for (const p of ['services.html', 'store.html', 'login.html']) {
      await page.goto(`${BASE}/${p}`, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.evaluate(() => window.HubTheme?.set?.('dark'));
      await new Promise((r) => setTimeout(r, 500));
      const bad = await scanBad(page, '.top-nav .nav-links a, .auth-btn, .hub-theme-toggle, a.btn, button.btn, .btn');
      mark(`صفحة ${p}: تباين الأزرار`, bad.length === 0, JSON.stringify(bad.slice(0, 5)));
    }

    // Light mode still OK
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(() => window.HubTheme?.set?.('light'));
    await new Promise((r) => setTimeout(r, 400));
    const lightNav = await page.evaluate(() => {
      const a = document.querySelector('.top-nav .nav-links a:not(.active)');
      const cs = getComputedStyle(a);
      return { color: cs.color, bg: cs.backgroundColor, text: (a?.textContent || '').trim() };
    });
    mark('الوضع النهاري ما زال مقروءًا', !!lightNav.bg && !!lightNav.color, JSON.stringify(lightNav));

    const out = path.join(ART, `dark-contrast-e2e-${Date.now()}.json`);
    fs.writeFileSync(out, JSON.stringify({ checks: rows }, null, 2));
    console.log('REPORT', out);
    process.exit(rows.some((r) => r.result === 'FAIL') ? 1 : 0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await browser.close().catch(() => null);
  }
}
main();
