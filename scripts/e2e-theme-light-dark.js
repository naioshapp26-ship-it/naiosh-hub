#!/usr/bin/env node
/**
 * E2E: unified light/dark theme across public, auth, client, dashboard.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.HUB_E2E_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const SA = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const ART = '/opt/cursor/artifacts';

const rows = [];
function mark(check, pass, evidence) {
  rows.push({ check, result: pass ? 'PASS' : 'FAIL', evidence: String(evidence || '').slice(0, 500) });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${evidence}`);
}

async function login(page, email, pass) {
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#email, input[type="email"]', { timeout: 15000 });
  await page.evaluate(
    (e, p) => {
      document.querySelector('#email, input[type="email"]').value = e;
      document.querySelector('#password, input[type="password"]').value = p;
    },
    email,
    pass
  );
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => null),
    page.click('button[type="submit"], #loginBtn, .btn-primary'),
  ]);
  await new Promise((r) => setTimeout(r, 700));
}

async function themeState(page) {
  return page.evaluate(() => {
    const btn = document.querySelector('.hub-theme-toggle, .dark-mode-toggle');
    return {
      dataTheme: document.documentElement.getAttribute('data-theme'),
      bodyDark: document.body.classList.contains('dark-mode'),
      stored: localStorage.getItem('hubTheme') || localStorage.getItem('theme'),
      hasBtn: !!btn,
      btnText: (btn?.textContent || '').replace(/\s+/g, ' ').trim(),
      btnCount: document.querySelectorAll('.hub-theme-toggle, .dark-mode-toggle').length,
    };
  });
}

async function clickToggle(page) {
  await page.evaluate(() => {
    const btn = document.querySelector('.hub-theme-toggle, .dark-mode-toggle');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 350));
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

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Static coverage
    const htmlDir = process.cwd();
    const htmls = fs.readdirSync(htmlDir).filter((f) => f.endsWith('.html'));
    let wired = 0;
    for (const f of htmls) {
      const src = fs.readFileSync(path.join(htmlDir, f), 'utf8');
      if (src.includes('hub-theme.js') && src.includes('hub-theme-modes.css')) wired += 1;
    }
    mark('جميع صفحات HTML مربوطة بنظام الثيم', wired === htmls.length, `${wired}/${htmls.length}`);

    // 1) Homepage light → dark
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(() => window.HubTheme || document.querySelector('.hub-theme-toggle'), { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 500));
    await page.evaluate(() => {
      localStorage.setItem('hubTheme', 'light');
      localStorage.setItem('theme', 'light');
      window.HubTheme?.set?.('light');
    });
    await new Promise((r) => setTimeout(r, 300));
    let st = await themeState(page);
    mark('الصفحة الرئيسية: زر التبديل ظاهر', st.hasBtn, JSON.stringify(st));
    mark('الصفحة الرئيسية: نص الوضع الليلي في النهاري', /الوضع الليلي/.test(st.btnText), st.btnText);
    await page.screenshot({ path: path.join(ART, 'theme_home_light.png'), fullPage: false });

    await clickToggle(page);
    st = await themeState(page);
    mark('الصفحة الرئيسية: التبديل إلى الليلي فورًا', st.dataTheme === 'dark' && st.bodyDark, JSON.stringify(st));
    mark('الصفحة الرئيسية: نص الوضع النهاري في الليلي', /الوضع النهاري/.test(st.btnText), st.btnText);
    await page.screenshot({ path: path.join(ART, 'theme_home_dark.png'), fullPage: false });

    // Persistence across navigation
    await page.goto(`${BASE}/services.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('.hub-theme-toggle'), { timeout: 15000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 500));
    st = await themeState(page);
    mark('الثبات عبر الصفحات العامة (services)', st.dataTheme === 'dark' && st.stored === 'dark', JSON.stringify(st));

    // Login page
    await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('.hub-theme-toggle'), { timeout: 15000 });
    st = await themeState(page);
    mark('صفحة الدخول: زر + الوضع الليلي محفوظ', st.hasBtn && st.dataTheme === 'dark', JSON.stringify(st));
    await page.screenshot({ path: path.join(ART, 'theme_login_dark.png'), fullPage: false });
    await clickToggle(page);
    st = await themeState(page);
    mark('صفحة الدخول: التبديل إلى النهاري', st.dataTheme === 'light', JSON.stringify(st));
    await page.screenshot({ path: path.join(ART, 'theme_login_light.png'), fullPage: false });

    // Dashboard
    await login(page, SA, SA_PASS);
    await page.goto(`${BASE}/dashboard.html#overview`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('.hub-theme-toggle, .topbar-actions'), { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 800));
    // Force dark then capture
    await page.evaluate(() => window.HubTheme?.set?.('dark'));
    await new Promise((r) => setTimeout(r, 400));
    st = await themeState(page);
    mark('لوحة الإدارة: زر في الشريط العلوي', st.hasBtn, JSON.stringify(st));
    mark('لوحة الإدارة: الوضع الليلي يطبّق', st.dataTheme === 'dark' && st.bodyDark, JSON.stringify(st));
    await page.screenshot({ path: path.join(ART, 'theme_dashboard_dark.png'), fullPage: false });
    await page.evaluate(() => window.HubTheme?.set?.('light'));
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(ART, 'theme_dashboard_light.png'), fullPage: false });
    st = await themeState(page);
    mark('لوحة الإدارة: العودة للنهاري', st.dataTheme === 'light', JSON.stringify(st));

    // Client center — register ephemeral customer in isolated context
    const stamp = Date.now().toString(36);
    const custEmail = `theme.cust.${stamp}@naiosh-test.com`;
    const custPass = 'Test360!';
    const ctx = await browser.createBrowserContext();
    const cust = await ctx.newPage();
    await cust.setViewport({ width: 1280, height: 800 });
    await cust.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    const reg = await cust.evaluate(
      async (body) => {
        const r = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        return { status: r.status, j: await r.json().catch(() => ({})) };
      },
      {
        fullName: 'عميل ثيم',
        username: `tcust${stamp}`.slice(0, 32),
        email: custEmail,
        phone: `+9665${String(Date.now()).slice(-8)}`,
        password: custPass,
        confirmPassword: custPass,
        termsAccepted: true,
      }
    );
    if (reg.j?.token) {
      await cust.evaluate(
        (t, u) => {
          localStorage.setItem('hubAuthToken', t);
          localStorage.setItem('hubUser', JSON.stringify(u));
        },
        reg.j.token,
        { ...(reg.j.user || {}), role: 'customer', email: custEmail }
      );
    }
    await cust.goto(`${BASE}/client.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await cust.waitForFunction(() => window.HubTheme || document.querySelector('.hub-theme-toggle'), { timeout: 15000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 600));
    let cst = await themeState(cust);
    mark('مركز العميل: زر التبديل', cst.hasBtn, JSON.stringify({ ...cst, reg: reg.status }));
    await cust.evaluate(() => window.HubTheme?.set?.('dark'));
    await new Promise((r) => setTimeout(r, 400));
    cst = await themeState(cust);
    mark('مركز العميل: الوضع الليلي', cst.dataTheme === 'dark' && cst.bodyDark, JSON.stringify(cst));
    await cust.screenshot({ path: path.join(ART, 'theme_client_dark.png'), fullPage: false });
    await ctx.close().catch(() => null);

    // Mobile homepage
    const mob = await browser.newPage();
    await mob.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await mob.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await mob.evaluate(() => {
      localStorage.setItem('hubTheme', 'dark');
      window.HubTheme?.set?.('dark');
    });
    await new Promise((r) => setTimeout(r, 500));
    const mst = await themeState(mob);
    mark('موبايل: زر التبديل يعمل', mst.hasBtn && mst.dataTheme === 'dark', JSON.stringify(mst));
    await mob.screenshot({ path: path.join(ART, 'theme_home_mobile_dark.png'), fullPage: false });
    await mob.close();

    // Store + ads quick check
    await page.evaluate(() => window.HubTheme?.set?.('dark'));
    await page.goto(`${BASE}/store.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 600));
    st = await themeState(page);
    mark('المتجر: الوضع الليلي + الزر', st.hasBtn && st.dataTheme === 'dark', JSON.stringify(st));

    const out = path.join(ART, `theme-e2e-${Date.now()}.json`);
    fs.writeFileSync(out, JSON.stringify({ checks: rows }, null, 2));
    console.log('REPORT', out);
    process.exit(rows.some((r) => r.result === 'FAIL') ? 1 : 0);
  } catch (err) {
    console.error(err);
    fs.writeFileSync(path.join(ART, 'theme-e2e-error.json'), JSON.stringify({ error: String(err.stack || err), checks: rows }, null, 2));
    process.exit(1);
  } finally {
    await browser.close().catch(() => null);
  }
}

main();
