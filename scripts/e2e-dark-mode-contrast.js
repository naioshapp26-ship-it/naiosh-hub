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

    // Dashboard — tabs + needs + KPIs (the reported white-on-white failure)
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle2', timeout: 90000 });
    await page.evaluate(() => {
      localStorage.setItem('hubTheme', 'dark');
      window.HubTheme?.set?.('dark');
    });
    await new Promise((r) => setTimeout(r, 1200));

    const dashProbe = await page.evaluate(() => {
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
        if (!fg || !bg) return 0;
        const L1 = lum(fg);
        const L2 = lum(bg);
        return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      }
      function sample(el) {
        if (!el) return null;
        const cs = getComputedStyle(el);
        let bgEl = el;
        let bg = cs.backgroundColor;
        while (bgEl && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) {
          bgEl = bgEl.parentElement;
          if (!bgEl) break;
          bg = getComputedStyle(bgEl).backgroundColor;
        }
        const fg = parse(cs.color);
        const bgRgb = parse(bg);
        return {
          t: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
          color: cs.color,
          bg,
          ratio: +contrast(fg, bgRgb).toFixed(2),
        };
      }
      const tabs = [...document.querySelectorAll('.tab, .hub-ws-tab')].slice(0, 8).map(sample);
      const needs = [...document.querySelectorAll('.hub-ws-needs-list li, .needs-list li')].slice(0, 6).map(sample);
      const kpis = [...document.querySelectorAll('.kpi span, .kpi small, .hub-ws-kpi span, .hub-ws-kpi small')]
        .slice(0, 8)
        .map(sample);
      return { tabs, needs, kpis, theme: document.documentElement.getAttribute('data-theme') };
    });

    const tabBad = (dashProbe.tabs || []).filter((t) => !t || t.ratio < 3);
    const needBad = (dashProbe.needs || []).filter((t) => !t || t.ratio < 3);
    const kpiBad = (dashProbe.kpis || []).filter((t) => !t || t.ratio < 3);
    mark(
      'لوحة التحكم: تبويبات مقروءة في الوضع الليلي',
      (dashProbe.tabs || []).length > 0 && tabBad.length === 0,
      JSON.stringify({ count: (dashProbe.tabs || []).length, bad: tabBad.slice(0, 4), sample: (dashProbe.tabs || []).slice(0, 2) })
    );
    mark(
      'لوحة التحكم: بطاقات يتطلب إجراء مقروءة',
      needBad.length === 0,
      JSON.stringify({ count: (dashProbe.needs || []).length, bad: needBad.slice(0, 4), sample: (dashProbe.needs || []).slice(0, 2) })
    );
    mark(
      'لوحة التحكم: تسميات KPI الثانوية مقروءة',
      (dashProbe.kpis || []).length === 0 || kpiBad.length === 0,
      JSON.stringify({ count: (dashProbe.kpis || []).length, bad: kpiBad.slice(0, 4), sample: (dashProbe.kpis || []).slice(0, 2) })
    );

    await page.screenshot({ path: path.join(ART, 'dashboard_dark_contrast_final.png'), fullPage: true });

    await page.evaluate(() => window.HubTheme?.set?.('light'));
    await new Promise((r) => setTimeout(r, 500));
    const lightTabs = await scanBad(page, '.tab, .hub-ws-tab');
    mark('لوحة التحكم نهاري: تبويبات مقروءة', lightTabs.length === 0, JSON.stringify(lightTabs.slice(0, 4)));
    await page.screenshot({ path: path.join(ART, 'dashboard_light_contrast_final.png'), fullPage: true });

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
    fs.writeFileSync(out, JSON.stringify({ checks: rows, dashProbe }, null, 2));
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
