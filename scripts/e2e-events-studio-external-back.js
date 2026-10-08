#!/usr/bin/env node
/**
 * Events studio: external back → home; admin entry → dashboard; customer denied dashboard.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.HUB_E2E_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const HOME = 'https://www.naioshai.com/';
const SA = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const ART = '/opt/cursor/artifacts';
const OUT = path.join(ART, `events-external-back-${Date.now()}.json`);

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
      const emailEl = document.querySelector('#email, input[type="email"]');
      const passEl = document.querySelector('#password, input[type="password"]');
      if (emailEl) emailEl.value = e;
      if (passEl) passEl.value = p;
    },
    email,
    pass
  );
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => null),
    page.click('button[type="submit"], #loginBtn, .btn-primary'),
  ]);
  await new Promise((r) => setTimeout(r, 800));
}

async function backInfo(page) {
  return page.evaluate(() => {
    const a = document.querySelector('[data-ev-back], .ev-hero-actions a.ev-btn');
    if (!a) return null;
    return {
      text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
      href: a.getAttribute('href') || '',
      kind: a.getAttribute('data-ev-back') || '',
      entry: sessionStorage.getItem('hubStudioEntry') || '',
    };
  });
}

async function ensureCustomer(page) {
  const stamp = Date.now().toString(36);
  const email = `evt.back.${stamp}@naiosh-test.com`;
  const pass = 'Test360';
  const phone = `+9665${String(Date.now()).slice(-8)}`;
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const reg = await page.evaluate(
    async (body) => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, j };
    },
    {
      fullName: 'عميل اختبار رجوع',
      username: `evtback${stamp}`.slice(0, 32),
      email,
      phone,
      password: pass,
      confirmPassword: pass,
      termsAccepted: true,
    }
  );
  if (reg.j && (reg.j.token || reg.j.user)) {
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      (t, u) => {
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify(u));
        document.cookie = 'hub_session=' + encodeURIComponent(t) + '; Path=/; SameSite=Lax; Max-Age=2592000';
      },
      reg.j.token,
      { ...(reg.j.user || {}), role: 'customer', email }
    );
  } else {
    await login(page, email, pass);
  }
  return { email, pass, created: !!(reg.ok || reg.j?.ok || reg.j?.success || reg.j?.token), reg };
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
    // —— 1) Guest: home → events → back to home
    const guest = await browser.newPage();
    await guest.setViewport({ width: 1440, height: 900 });
    await guest.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await Promise.all([
      guest.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }),
      guest.click('a[href="events.html"], a[href="./events.html"], nav a[href*="events.html"]'),
    ]);
    await guest.waitForSelector('.ev-hero', { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 700));
    await guest.screenshot({ path: path.join(ART, 'events-back-guest-after.png'), fullPage: false });
    let info = await backInfo(guest);
    mark(
      'زائر: زر العودة للرئيسية',
      !!(info && /العودة للرئيسية/.test(info.text) && info.href === HOME && !/لوحة التحكم/.test(info.text)),
      JSON.stringify(info)
    );
    mark('زائر: لا dashboard في زر الرجوع', !!(info && !/dashboard\.html/i.test(info.href)), info && info.href);
    // Don't navigate off-site in CI; verify href only then reload
    await guest.reload({ waitUntil: 'networkidle2' });
    await guest.waitForSelector('.ev-hero', { timeout: 15000 });
    info = await backInfo(guest);
    mark(
      'زائر: بعد التحديث يبقى العودة للرئيسية',
      !!(info && /العودة للرئيسية/.test(info.text) && info.href === HOME),
      JSON.stringify(info)
    );
    await guest.close();

    // —— 2) Customer session preserved + home back + dashboard denied
    const cust = await browser.newPage();
    await cust.setViewport({ width: 1440, height: 900 });
    const customer = await ensureCustomer(cust);
    const tokenBefore = await cust.evaluate(
      () => localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || ''
    );
    await cust.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await Promise.all([
      cust.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }),
      cust.click('a[href="events.html"], a[href="./events.html"], nav a[href*="events.html"]'),
    ]);
    await cust.waitForSelector('.ev-hero', { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 700));
    info = await backInfo(cust);
    mark(
      'عميل: العودة للرئيسية',
      !!(info && /العودة للرئيسية/.test(info.text) && info.href === HOME),
      JSON.stringify({ info, email: customer.email })
    );
    const tokenAfter = await cust.evaluate(
      () => localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || ''
    );
    mark('عميل: الجلسة باقية بعد فتح الاستوديو', !!(tokenBefore && tokenBefore === tokenAfter), 'token match');
    await cust.screenshot({ path: path.join(ART, 'events-back-customer-public.png'), fullPage: false });

    await cust.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1200));
    const dashDenied = await cust.evaluate(() => {
      const url = location.href;
      const text = document.body.innerText || '';
      const onDash = /dashboard\.html/i.test(url);
      const denied =
        /client\.html/i.test(url) ||
        /login\.html/i.test(url) ||
        /ليس لديك صلاحية/.test(text) ||
        !!document.querySelector('.cp-brand, .client-portal, #client-root');
      return { url, onDash, denied, snippet: text.slice(0, 120) };
    });
    mark('عميل → Dashboard مباشرة: DENIED', !dashDenied.onDash || dashDenied.denied, JSON.stringify(dashDenied));
    await cust.screenshot({ path: path.join(ART, 'events-back-customer-denied-dash.png'), fullPage: false });
    await cust.close();

    // —— 3) Super admin: public entry → home back (even if staff UI)
    const saPublic = await browser.newPage();
    await saPublic.setViewport({ width: 1440, height: 900 });
    await login(saPublic, SA, SA_PASS);
    await saPublic.evaluate(() => {
      try {
        sessionStorage.removeItem('hubStudioEntry');
        sessionStorage.removeItem('hubStudioReturn');
      } catch (_) {}
    });
    await saPublic.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await Promise.all([
      saPublic.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }),
      saPublic.click('a[href="events.html"], a[href="./events.html"], nav a[href*="events.html"]'),
    ]);
    await saPublic.waitForSelector('.ev-hero', { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 900));
    info = await backInfo(saPublic);
    await saPublic.screenshot({ path: path.join(ART, 'events-back-sa-public-entry.png'), fullPage: false });
    mark(
      'سوبر أدمن من الرئيسية: العودة للرئيسية (وليس لوحة التحكم)',
      !!(info && info.kind === 'home' && info.href === HOME && /العودة للرئيسية/.test(info.text)),
      JSON.stringify(info)
    );
    const canCreate = await saPublic.evaluate(() => !!document.querySelector('[data-ev="new"]'));
    mark('إنشاء فعالية ما زال متاحًا (صلاحيات الاستوديو)', canCreate, 'data-ev=new');
    await saPublic.close();

    // —— 4) Super admin: dashboard → studio → dashboard back
    const saAdmin = await browser.newPage();
    await saAdmin.setViewport({ width: 1440, height: 900 });
    await login(saAdmin, SA, SA_PASS);
    await saAdmin.goto(`${BASE}/dashboard.html#overview`, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 1000));
    await saAdmin.evaluate(() => {
      sessionStorage.setItem('hubStudioEntry', 'admin');
      sessionStorage.setItem('hubStudioReturn', 'dashboard.html#overview');
      localStorage.setItem('hubStudioReturn', 'dashboard.html#overview');
    });
    await saAdmin.goto(`${BASE}/events.html`, {
      waitUntil: 'networkidle2',
      timeout: 45000,
      referer: `${BASE}/dashboard.html`,
    });
    await saAdmin.waitForSelector('.ev-hero', { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 900));
    info = await backInfo(saAdmin);
    await saAdmin.screenshot({ path: path.join(ART, 'events-back-sa-admin-entry.png'), fullPage: false });
    mark(
      'سوبر أدمن من لوحة الإدارة: رجوع إلى لوحة التحكم',
      !!(
        info &&
        info.kind === 'admin' &&
        /dashboard\.html/i.test(info.href) &&
        /رجوع إلى لوحة التحكم/.test(info.text)
      ),
      JSON.stringify(info)
    );

    // Click back (same tab) → dashboard
    await Promise.all([
      saAdmin.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null),
      saAdmin.click('[data-ev-back="admin"]'),
    ]);
    await new Promise((r) => setTimeout(r, 800));
    mark(
      'زر الرجوع الإداري يصل للوحة التحكم',
      /dashboard\.html/i.test(saAdmin.url()),
      saAdmin.url()
    );

    // Mobile viewport public entry
    await saAdmin.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await saAdmin.evaluate(() => {
      sessionStorage.setItem('hubStudioEntry', 'public');
    });
    await saAdmin.goto(`${BASE}/events.html`, {
      waitUntil: 'networkidle2',
      referer: `${BASE}/index.html`,
    });
    await saAdmin.waitForSelector('.ev-hero', { timeout: 15000 });
    info = await backInfo(saAdmin);
    await saAdmin.screenshot({ path: path.join(ART, 'events-back-mobile-public.png'), fullPage: false });
    mark(
      'موبايل: العودة للرئيسية من المسار العام',
      !!(info && info.href === HOME && /العودة للرئيسية/.test(info.text)),
      JSON.stringify(info)
    );
    await saAdmin.close();

    mark('لقطة ضيف', fs.existsSync(path.join(ART, 'events-back-guest-after.png')), 'guest shot');
    mark('لقطة دخول إداري', fs.existsSync(path.join(ART, 'events-back-sa-admin-entry.png')), 'admin shot');
    mark('لقطة دخول عام لسوبر أدمن', fs.existsSync(path.join(ART, 'events-back-sa-public-entry.png')), 'sa public shot');
  } catch (err) {
    mark('e2e', false, err.stack || err.message);
  } finally {
    await browser.close().catch(() => null);
  }

  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), base: BASE, home: HOME, rows }, null, 2));
  console.log('Report:', OUT);
  const failed = rows.filter((r) => r.result === 'FAIL').length;
  console.log(`Summary: ${rows.length - failed} PASS / ${failed} FAIL / ${rows.length} total`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
