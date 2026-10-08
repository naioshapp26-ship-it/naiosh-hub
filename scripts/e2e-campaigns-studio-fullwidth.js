#!/usr/bin/env node
/**
 * Compare Marketing Campaigns studio width vs Events studio across viewports.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.HUB_E2E_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const SA = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const OUT = path.join('/opt/cursor/artifacts', `campaigns-fullwidth-${Date.now()}.json`);
const ART = '/opt/cursor/artifacts';

const rows = [];
function mark(check, pass, evidence) {
  rows.push({ check, result: pass ? 'PASS' : 'FAIL', evidence: String(evidence || '').slice(0, 400) });
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

    // Before/after style comparison at 1440 — campaigns vs events
    for (const vp of viewports) {
      await page.setViewport({
        width: vp.width,
        height: vp.height,
        isMobile: !!vp.isMobile,
        hasTouch: !!vp.isMobile,
      });

      await page.goto(`${BASE}/marketing-campaigns-studio.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('.mcs-wrap', { timeout: 20000 });
      await page.waitForTimeout?.(800).catch(() => new Promise((r) => setTimeout(r, 800)));
      const mcs = await measure(page, '.mcs-wrap');
      const mcsShot = path.join(ART, `campaigns-studio-${vp.name}.png`);
      await page.screenshot({ path: mcsShot, fullPage: false });

      await page.goto(`${BASE}/events.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('.ev-wrap', { timeout: 20000 });
      await page.waitForTimeout?.(800).catch(() => new Promise((r) => setTimeout(r, 800)));
      const ev = await measure(page, '.ev-wrap');
      const evShot = path.join(ART, `events-studio-${vp.name}.png`);
      await page.screenshot({ path: evShot, fullPage: false });

      const sideGapOk = mcs && mcs.left <= 24 && mcs.right <= 24;
      const widthMatch =
        mcs && ev && Math.abs(mcs.width - ev.width) <= Math.max(8, Math.round(vp.width * 0.02));
      const noNarrowMax = mcs && (mcs.maxWidth === 'none' || mcs.maxWidth === '100%');

      mark(
        `عرض ${vp.name}: حملات ≈ فعاليات`,
        !!(widthMatch && sideGapOk && noNarrowMax),
        JSON.stringify({ mcs, ev, widthMatch, sideGapOk, noNarrowMax })
      );
      mark(`لا تمرير أفقي ${vp.name}`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), `scrollW vs inner`);
    }

    // Button / tab / KPI smoke on campaigns (isolated page)
    const smoke = await browser.newPage();
    await smoke.setViewport({ width: 1440, height: 900 });
    // Reuse auth storage from logged-in page
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
    await smoke.goto(`${BASE}/marketing-campaigns-studio.html`, { waitUntil: 'networkidle2', timeout: 45000 });
    await smoke.waitForSelector('.mcs-nav, .mcs-hero', { timeout: 25000 });
    await new Promise((r) => setTimeout(r, 1000));

    const smokeStats = await smoke.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const navCount = document.querySelectorAll('.mcs-nav button').length;
      let tabsOk = 0;
      for (let i = 0; i < navCount; i++) {
        const btn = document.querySelectorAll('.mcs-nav button')[i];
        if (!btn) continue;
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await sleep(180);
        const cur = document.querySelectorAll('.mcs-nav button')[i];
        if (cur?.classList.contains('is-on')) tabsOk += 1;
      }
      const heroCount = document.querySelectorAll('.mcs-hero-actions .mcs-btn, .mcs-hero .mcs-btn').length;
      const newBtn =
        document.querySelector('[data-mcs="new"]') ||
        document.querySelector('.mcs-hero .mcs-btn.primary');
      if (newBtn) newBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await sleep(400);
      const formOk = !!(
        document.querySelector('.mcs-drawer, .mcs-overlay, .mcs-form, [data-w="name"]') ||
        /حملة جديدة|إنشاء حملة|اسم الحملة/.test(document.body.innerText || '')
      );
      const kpiCount = document.querySelectorAll('.mcs-kpi').length;
      const kpiCols = getComputedStyle(document.querySelector('.mcs-kpis') || document.body).gridTemplateColumns;
      return { navCount, tabsOk, heroCount, formOk, kpiCount, kpiCols };
    });
    mark('تبويبات الاستوديو موجودة', smokeStats.navCount >= 5, `count=${smokeStats.navCount}`);
    mark(
      'تبديل التبويبات يعمل',
      smokeStats.tabsOk >= Math.min(smokeStats.navCount, 8),
      `ok=${smokeStats.tabsOk}/${smokeStats.navCount}`
    );
    mark('أزرار الشريط العلوي موجودة', smokeStats.heroCount >= 2, `count=${smokeStats.heroCount}`);
    mark('زر حملة جديدة يستجيب', smokeStats.formOk, JSON.stringify({ formOk: smokeStats.formOk }));
    mark(
      'بطاقات الإحصاءات تستغل العرض (≈5 أعمدة)',
      smokeStats.kpiCount >= 5 && (smokeStats.kpiCols.match(/px/g) || []).length >= 5,
      `kpis=${smokeStats.kpiCount} cols=${smokeStats.kpiCols}`
    );

    await smoke.goto(`${BASE}/marketing-campaigns-studio.html`, { waitUntil: 'domcontentloaded' });
    await smoke.waitForSelector('.mcs-wrap', { timeout: 15000 });
    await smoke.screenshot({ path: path.join(ART, 'campaigns-studio-after-1440.png'), fullPage: false });
    mark('لقطة بعد التعديل 1440', fs.existsSync(path.join(ART, 'campaigns-studio-after-1440.png')), 'campaigns-studio-after-1440.png');
    mark('لقطة فعاليات 1440 للمقارنة', fs.existsSync(path.join(ART, 'events-studio-1440.png')), 'events-studio-1440.png');
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
