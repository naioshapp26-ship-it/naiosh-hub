#!/usr/bin/env node
/** Visual + computed-style proof for dashboard dark-mode contrast. */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.HUB_E2E_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const SA = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const ART = '/opt/cursor/artifacts';

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

async function login(page) {
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#email, input[type="email"]', { timeout: 15000 });
  await page.evaluate(
    (e, p) => {
      document.querySelector('#email, input[type="email"]').value = e;
      document.querySelector('#password, input[type="password"]').value = p;
    },
    SA,
    SA_PASS
  );
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => null),
    page.click('button[type="submit"], #loginBtn, .btn-primary'),
  ]);
  await new Promise((r) => setTimeout(r, 900));
}

async function openDashboard(page, theme) {
  await page.goto(`${BASE}/dashboard.html#overview`, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('.topbar, .kpi, .hub-theme-toggle'), {
    timeout: 25000,
  });
  await page.evaluate((t) => {
    localStorage.setItem('hubTheme', t);
    window.HubTheme?.set?.(t);
  }, theme);
  await new Promise((r) => setTimeout(r, 1000));
  await page.waitForFunction(() => document.querySelectorAll('.tab, .hub-ws-tab').length > 0, {
    timeout: 20000,
  }).catch(() => null);
  await new Promise((r) => setTimeout(r, 600));
}

async function probe(page) {
  return page.evaluate(() => {
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
      return (Math.max(lum(fg), lum(bg)) + 0.05) / (Math.min(lum(fg), lum(bg)) + 0.05);
    }
    function resolvedBg(el) {
      let n = el;
      while (n) {
        const bg = getComputedStyle(n).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        n = n.parentElement;
      }
      return 'rgb(0,0,0)';
    }
    function sample(el) {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const color = cs.color;
      const bg = resolvedBg(el);
      return {
        t: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48),
        color,
        bg,
        ratio: +contrast(parse(color), parse(bg)).toFixed(2),
        cls: el.className,
      };
    }
    return {
      url: location.href,
      theme: document.documentElement.getAttribute('data-theme'),
      bodyDark: document.body.classList.contains('dark-mode'),
      cssHref: [...document.styleSheets]
        .map((s) => s.href || '')
        .find((h) => h.includes('hub-theme-modes')) || null,
      black: getComputedStyle(document.documentElement).getPropertyValue('--black').trim(),
      white: getComputedStyle(document.documentElement).getPropertyValue('--white').trim(),
      themeText: getComputedStyle(document.documentElement).getPropertyValue('--theme-text').trim(),
      tabs: [...document.querySelectorAll('.tab, .hub-ws-tab')].map(sample),
      needs: [...document.querySelectorAll('.hub-ws-needs-list li, .needs-list li')].slice(0, 6).map(sample),
      kpis: [...document.querySelectorAll('.kpi, .hub-ws-kpi')].slice(0, 8).map((el) => ({
        card: sample(el),
        strong: sample(el.querySelector('strong')),
        label: sample(el.querySelector('span, small')),
      })),
    };
  });
}

async function clickAllTabs(page) {
  const n = await page.$$eval('.tab, .hub-ws-tab', (els) => els.length);
  const results = [];
  for (let i = 0; i < n; i++) {
    await page.evaluate((idx) => {
      const tabs = [...document.querySelectorAll('.tab, .hub-ws-tab')];
      tabs[idx]?.click();
    }, i);
    await new Promise((r) => setTimeout(r, 350));
    const info = await page.evaluate((idx) => {
      const tab = [...document.querySelectorAll('.tab, .hub-ws-tab')][idx];
      const cs = getComputedStyle(tab);
      return {
        t: (tab?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
        active: tab?.classList.contains('active'),
        color: cs.color,
        bg: cs.backgroundColor,
      };
    }, i);
    results.push(info);
  }
  return results;
}

async function main() {
  if (!SA_PASS) {
    console.error('Need HUB_SUPER_ADMIN_INITIAL_PASSWORD');
    process.exit(1);
  }
  fs.mkdirSync(ART, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const report = { checks: [] };
  const mark = (c, p, e) => {
    report.checks.push({ check: c, result: p ? 'PASS' : 'FAIL', evidence: e });
    console.log(`${p ? 'PASS' : 'FAIL'} | ${c} | ${typeof e === 'string' ? e : JSON.stringify(e).slice(0, 300)}`);
  };
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await login(page);
    await openDashboard(page, 'dark');
    const dark = await probe(page);
    const tabClicks = await clickAllTabs(page);
    await page.screenshot({ path: path.join(ART, 'dashboard_dark_fixed_desktop.png'), fullPage: true });

    const tabBad = dark.tabs.filter((t) => t.ratio < 3);
    const needBad = dark.needs.filter((t) => t.ratio < 3);
    const kpiLabelBad = dark.kpis.map((k) => k.label).filter((t) => t && t.ratio < 3);
    mark('--black remains absolute dark', dark.black === '#0a0a0a' || dark.black === '10, 10, 10', {
      black: dark.black,
      white: dark.white,
    });
    mark('CSS theme3 loaded', /theme3/.test(dark.cssHref || ''), dark.cssHref);
    mark('tabs readable dark', dark.tabs.length >= 4 && tabBad.length === 0, {
      count: dark.tabs.length,
      bad: tabBad,
      sample: dark.tabs.slice(0, 3),
    });
    mark('needs readable dark', needBad.length === 0, {
      count: dark.needs.length,
      bad: needBad,
      sample: dark.needs.slice(0, 3),
    });
    mark('KPI labels readable dark', kpiLabelBad.length === 0, {
      bad: kpiLabelBad,
      sample: dark.kpis.slice(0, 2),
    });
    mark('all tabs clickable', tabClicks.length >= 4 && tabClicks.every((t) => t.t), tabClicks);

    await page.evaluate(() => window.HubTheme?.set?.('light'));
    await new Promise((r) => setTimeout(r, 700));
    const light = await probe(page);
    await page.screenshot({ path: path.join(ART, 'dashboard_light_fixed_desktop.png'), fullPage: true });
    const lightTabBad = light.tabs.filter((t) => t.ratio < 3);
    mark('tabs readable light', light.tabs.length >= 4 && lightTabBad.length === 0, {
      count: light.tabs.length,
      bad: lightTabBad,
      sample: light.tabs.slice(0, 3),
    });

    // Soft refresh persistence
    await page.evaluate(() => window.HubTheme?.set?.('dark'));
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));
    const afterReload = await probe(page);
    await page.screenshot({ path: path.join(ART, 'dashboard_dark_after_refresh.png'), fullPage: true });
    mark(
      'after refresh dark still readable',
      afterReload.theme === 'dark' &&
        afterReload.tabs.length > 0 &&
        afterReload.tabs.every((t) => t.ratio >= 3),
      { theme: afterReload.theme, tabs: afterReload.tabs.slice(0, 3) }
    );

    // Mobile
    const mob = await browser.newPage();
    await mob.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await login(mob);
    await openDashboard(mob, 'dark');
    const mobile = await probe(mob);
    await mob.screenshot({ path: path.join(ART, 'dashboard_dark_fixed_mobile.png'), fullPage: true });
    mark(
      'mobile dark tabs readable',
      mobile.tabs.length > 0 && mobile.tabs.every((t) => t.ratio >= 3),
      { count: mobile.tabs.length, sample: mobile.tabs.slice(0, 3) }
    );
    await mob.close();

    report.dark = dark;
    report.light = light;
    report.afterReload = afterReload;
    report.mobile = mobile;
    report.tabClicks = tabClicks;
    const out = path.join(ART, `dashboard-dark-contrast-proof-${Date.now()}.json`);
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    console.log('REPORT', out);
    process.exit(report.checks.some((c) => c.result === 'FAIL') ? 1 : 0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await browser.close().catch(() => null);
  }
}
main();
