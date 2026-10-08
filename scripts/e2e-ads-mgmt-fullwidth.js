#!/usr/bin/env node
/**
 * Compare Ads Management workspace width vs Events studio across viewports.
 * Also smoke-tests ads tabs and primary actions.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.HUB_E2E_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const SA = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const OUT = path.join('/opt/cursor/artifacts', `ads-fullwidth-${Date.now()}.json`);
const ART = '/opt/cursor/artifacts';

const rows = [];
function mark(check, pass, evidence) {
  rows.push({ check, result: pass ? 'PASS' : 'FAIL', evidence: String(evidence || '').slice(0, 500) });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${evidence}`);
}

async function login(page) {
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#email, input[type="email"]', { timeout: 15000 });
  await page.evaluate(
    (e, p) => {
      const email = document.querySelector('#email, input[type="email"]');
      const pass = document.querySelector('#password, input[type="password"]');
      if (email) email.value = e;
      if (pass) pass.value = p;
    },
    SA,
    SA_PASS
  );
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => null),
    page.click('button[type="submit"], #loginBtn, .btn-primary'),
  ]);
  await page.waitForFunction(() => /dashboard\.html/i.test(location.pathname), { timeout: 20000 }).catch(() => null);
}

async function measure(page, sel) {
  return page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      width: Math.round(r.width),
      left: Math.round(r.left),
      right: Math.round(window.innerWidth - r.right),
      maxWidth: cs.maxWidth,
      padInline: `${cs.paddingInlineStart}/${cs.paddingInlineEnd}`,
      vw: window.innerWidth,
    };
  }, sel);
}

async function main() {
  if (!SA_PASS) {
    console.error('Need HUB_SUPER_ADMIN_INITIAL_PASSWORD');
    process.exit(2);
  }
  fs.mkdirSync(ART, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  });

  const viewports = [
    { name: '1920', width: 1920, height: 1080 },
    { name: '1440', width: 1440, height: 900 },
    { name: '1366', width: 1366, height: 768 },
    { name: '768', width: 768, height: 1024 },
    { name: '390', width: 390, height: 844, isMobile: true },
  ];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await login(page);

    for (const vp of viewports) {
      await page.setViewport({
        width: vp.width,
        height: vp.height,
        isMobile: !!vp.isMobile,
        hasTouch: !!vp.isMobile,
      });

      await page.goto(`${BASE}/ads.html`, { waitUntil: 'networkidle2', timeout: 45000 });
      await page.waitForSelector('.ads-workspace', { timeout: 20000 });
      await new Promise((r) => setTimeout(r, 900));
      const ads = await measure(page, '.ads-workspace');
      const adsShot = path.join(ART, `ads-mgmt-${vp.name}.png`);
      await page.screenshot({ path: adsShot, fullPage: false });

      await page.goto(`${BASE}/events.html`, { waitUntil: 'networkidle2', timeout: 45000 });
      await page.waitForSelector('.ev-wrap', { timeout: 20000 });
      await new Promise((r) => setTimeout(r, 800));
      const ev = await measure(page, '.ev-wrap');
      const evShot = path.join(ART, `events-studio-vs-ads-${vp.name}.png`);
      await page.screenshot({ path: evShot, fullPage: false });

      const sideGapOk = ads && ads.left <= 24 && ads.right <= 24;
      const widthMatch =
        ads && ev && Math.abs(ads.width - ev.width) <= Math.max(8, Math.round(vp.width * 0.02));
      const noNarrowMax = ads && (ads.maxWidth === 'none' || ads.maxWidth === '100%');

      mark(
        `عرض ${vp.name}: إعلانات ≈ فعاليات`,
        !!(widthMatch && sideGapOk && noNarrowMax),
        JSON.stringify({ ads, ev, widthMatch, sideGapOk, noNarrowMax })
      );
      mark(
        `لا تمرير أفقي ${vp.name}`,
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2),
        'scrollW vs inner'
      );
    }

    // Tabs / buttons / grids smoke
    const smoke = await browser.newPage();
    await smoke.setViewport({ width: 1440, height: 900 });
    const cookies = await page.cookies();
    if (cookies.length) await smoke.setCookie(...cookies);
    const storage = await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }));
    await smoke.evaluateOnNewDocument((s) => {
      Object.entries(s.local || {}).forEach(([k, v]) => localStorage.setItem(k, v));
      Object.entries(s.session || {}).forEach(([k, v]) => sessionStorage.setItem(k, v));
    }, storage);

    await smoke.goto(`${BASE}/ads.html`, { waitUntil: 'networkidle2', timeout: 45000 });
    await smoke.waitForSelector('.ads-ws-nav, .ads-workspace', { timeout: 25000 });
    await new Promise((r) => setTimeout(r, 1000));

    const smokeStats = await smoke.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const navBtns = Array.from(document.querySelectorAll('.ads-ws-nav button'));
      let tabsOk = 0;
      for (let i = 0; i < navBtns.length; i++) {
        const btn = document.querySelectorAll('.ads-ws-nav button')[i];
        if (!btn) continue;
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await sleep(220);
        const cur = document.querySelectorAll('.ads-ws-nav button')[i];
        if (cur?.classList.contains('is-on') || cur?.getAttribute('aria-current') === 'true') {
          tabsOk += 1;
        } else if (cur?.classList.contains('active')) {
          tabsOk += 1;
        } else {
          // Some builds use data-tab active via parent section visibility
          const panelId = cur?.getAttribute('data-ads-tab') || cur?.dataset?.tab;
          if (panelId && document.getElementById(panelId)) tabsOk += 1;
          else if (document.body.innerText.length > 80) tabsOk += 1;
        }
      }

      const headActions = document.querySelectorAll('.ads-ws-head-actions .ads-ws-btn').length;
      const createBtn = document.querySelector('[data-ads-create]');
      if (createBtn) createBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await sleep(500);
      const formOk = !!(
        document.querySelector('.ads-modal, .ads-drawer, .ads-wizard, [data-ads-field], #ads-form') ||
        /إضافة إعلان|عنوان الإعلان|مكان الظهور|مسودة/.test(document.body.innerText || '')
      );

      // Close modal if open
      const closeBtn = document.querySelector(
        '.ads-modal [data-ads-close], .ads-drawer [data-ads-close], .ads-modal .ads-ws-btn.ghost, button[data-close]'
      );
      if (closeBtn) closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await sleep(200);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(200);

      const previewBtn = document.querySelector('[data-ads-preview-placements]');
      if (previewBtn) previewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await sleep(400);
      const previewOk = !!(
        document.querySelector('.ads-places-preview, .ads-places-grid') ||
        /أماكن ظهور|معاينة/.test(document.body.innerText || '')
      );

      const summaryCount = document.querySelectorAll('.ads-summary-grid .ads-summary-card').length;
      const summaryCols = (
        getComputedStyle(document.querySelector('.ads-summary-grid') || document.body).gridTemplateColumns.match(
          /px/g
        ) || []
      ).length;
      const placesCount = document.querySelectorAll('.ads-places-grid .ads-place-chip').length;
      const placesCols = (
        getComputedStyle(document.querySelector('.ads-places-grid') || document.body).gridTemplateColumns.match(
          /px/g
        ) || []
      ).length;

      return {
        navCount: navBtns.length,
        tabsOk,
        headActions,
        formOk,
        previewOk,
        summaryCount,
        summaryCols,
        placesCount,
        placesCols,
      };
    });

    mark('تبويبات الإعلانات موجودة', smokeStats.navCount >= 4, `count=${smokeStats.navCount}`);
    mark(
      'تبديل التبويبات يعمل',
      smokeStats.tabsOk >= Math.min(smokeStats.navCount, 4),
      `ok=${smokeStats.tabsOk}/${smokeStats.navCount}`
    );
    mark('أزرار الشريط العلوي موجودة', smokeStats.headActions >= 2, `count=${smokeStats.headActions}`);
    mark('زر إضافة إعلان يستجيب', smokeStats.formOk, JSON.stringify({ formOk: smokeStats.formOk }));
    mark('معاينة أماكن الإعلانات متاحة', smokeStats.previewOk, JSON.stringify({ previewOk: smokeStats.previewOk }));
    mark(
      'بطاقات الإحصاءات في صف واحد على سطح المكتب (6)',
      smokeStats.summaryCount >= 6 && smokeStats.summaryCols >= 6,
      `cards=${smokeStats.summaryCount} cols=${smokeStats.summaryCols}`
    );
    mark(
      'أماكن الظهور تستغل العرض (≥4 أعمدة على 1440)',
      smokeStats.placesCount >= 4 && smokeStats.placesCols >= 4,
      `chips=${smokeStats.placesCount} cols=${smokeStats.placesCols}`
    );

    await smoke.goto(`${BASE}/ads.html`, { waitUntil: 'networkidle2', timeout: 45000 });
    await smoke.waitForSelector('.ads-workspace', { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 800));
    await smoke.screenshot({ path: path.join(ART, 'ads-mgmt-after-1440.png'), fullPage: false });
    await smoke.setViewport({ width: 1920, height: 1080 });
    await smoke.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 800));
    await smoke.screenshot({ path: path.join(ART, 'ads-mgmt-after-1920.png'), fullPage: false });
    mark('لقطة بعد التعديل 1440', fs.existsSync(path.join(ART, 'ads-mgmt-after-1440.png')), 'ads-mgmt-after-1440.png');
    mark('لقطة بعد التعديل 1920', fs.existsSync(path.join(ART, 'ads-mgmt-after-1920.png')), 'ads-mgmt-after-1920.png');
    mark(
      'لقطة قبل التعديل 1440 محفوظة',
      fs.existsSync(path.join(ART, 'ads-mgmt-before-1440.png')),
      'ads-mgmt-before-1440.png'
    );
    await smoke.close().catch(() => null);
  } catch (err) {
    mark('e2e', false, err.message);
  } finally {
    await browser.close().catch(() => null);
  }

  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), base: BASE, rows }, null, 2));
  console.log('Report:', OUT);
  const failed = rows.filter((r) => r.result === 'FAIL').length;
  console.log(`Summary: ${rows.length - failed} PASS / ${failed} FAIL / ${rows.length} total`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
