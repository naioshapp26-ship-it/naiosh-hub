#!/usr/bin/env node
/**
 * Guest must see Login (not permission-denied) when opening admin pages.
 * Stale/garbage hub_session must not invent a CLIENT session.
 */
'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.HUB_E2E_BASE || process.env.HUB_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const SA_EMAIL = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';

const rows = [];
function mark(check, pass, evidence) {
  rows.push({ check, result: pass ? 'PASS' : 'FAIL', evidence: String(evidence || '') });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${evidence}`);
}

function req(method, p, { body, token, cookie, redirect } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(p, BASE);
    const lib = u.protocol === 'https:' ? https : http;
    const payload = body != null ? JSON.stringify(body) : null;
    const r = lib.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        headers: {
          Accept: 'text/html,application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}`, 'X-Hub-Token': token } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch {
            /* html */
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            location: res.headers.location || '',
            raw,
            json,
          });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function main() {
  // API: garbage cookie must not get 403 permission page
  const garbage =
    'hub_session=' +
    encodeURIComponent('hub360.' + Buffer.from('ghost@example.com').toString('base64') + '.' + Date.now());
  const dashGuest = await req('GET', '/dashboard.html', { cookie: garbage });
  mark(
    'فتح Dashboard كزائر/جلسة تالفة يحول إلى Login',
    dashGuest.status === 302 && /login\.html/i.test(dashGuest.location),
    `status=${dashGuest.status} loc=${dashGuest.location}`
  );
  mark(
    'لا صفحة صلاحيات للجلسة التالفة',
    !/ليس لديك صلاحية|فريق التشغيل فقط/i.test(dashGuest.raw || ''),
    `status=${dashGuest.status}`
  );

  const dashBare = await req('GET', '/dashboard.html');
  mark(
    'Dashboard بدون Cookie → Login',
    dashBare.status === 302 && /login\.html/i.test(dashBare.location),
    `status=${dashBare.status} loc=${dashBare.location}`
  );

  const loginPage = await req('GET', '/login.html');
  mark(
    'فتح Login كزائر',
    loginPage.status === 200 && /loginForm|دخول الحساب|login\.js/i.test(loginPage.raw),
    `status=${loginPage.status}`
  );

  if (!SA_PASS) {
    console.warn('Skip Super Admin UI tests — set HUB_E2E_SA_PASSWORD');
  } else {
    const login = await req('POST', '/api/auth/login', {
      body: { email: SA_EMAIL, password: SA_PASS },
    });
    mark(
      'تسجيل دخول Super Admin يدويًا (API)',
      !!(login.json?.ok && login.json?.token),
      `emp=${login.json?.employeeNo || login.json?.user?.employeeNo}`
    );
    mark(
      'هوية EMP-0001 صحيحة',
      (login.json?.employeeNo || login.json?.user?.employeeNo) === 'EMP-0001',
      login.json?.employeeNo || login.json?.user?.employeeNo
    );
    const tok = login.json?.token;
    const me = await req('GET', '/api/auth/me', { token: tok });
    mark('جلسة إدارية بعد Login', !!(me.json?.ok && (me.json.lane === 'SUPER_ADMIN' || me.json.role === 'supreme_leader')), me.json?.lane || me.json?.role);

    // Customer denied
    const stamp = Date.now().toString(36);
    const reg = await req('POST', '/api/auth/register', {
      body: {
        fullName: 'عميل بوابة',
        email: `gate.cust.${stamp}@example.com`,
        phone: '+97059' + String(Date.now()).slice(-7),
        password: '1234',
        confirmPassword: '1234',
        termsAccepted: true,
      },
    });
    const custLogin = await req('POST', '/api/auth/login', {
      body: { email: `gate.cust.${stamp}@example.com`, password: '1234' },
    });
    const cTok = custLogin.json?.token;
    const dashCust = await req('GET', '/dashboard.html', {
      cookie: cTok ? `hub_session=${encodeURIComponent(cTok)}` : '',
      token: cTok,
    });
    // Customer cookie via Cookie header — serveStatic uses cookie
    mark(
      'Customer Dashboard Denied',
      dashCust.status === 403 && /ليس لديك صلاحية/i.test(dashCust.raw || ''),
      `status=${dashCust.status}`
    );
    const apiDeny = await req('GET', '/api/admin/account', { token: cTok });
    mark('Admin API Authorization', apiDeny.status === 403 || apiDeny.json?.ok === false, `status=${apiDeny.status}`);

    // Logout revoke
    await req('POST', '/api/auth/logout', { token: tok });
    const afterLogout = await req('GET', '/api/auth/me', { token: tok });
    mark('Logout وToken Revocation', !afterLogout.json?.ok, `status=${afterLogout.status}`);
  }

  // Browser: guest login form stays visible
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--disable-gpu', '--window-size=390,844'],
    });
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForTimeout?.(800).catch(() => new Promise((r) => setTimeout(r, 800)));
    const stillLogin = await page.evaluate(() => {
      const form = document.getElementById('loginForm');
      const denied = /ليس لديك صلاحية|فريق التشغيل فقط/i.test(document.body?.innerText || '');
      return {
        url: location.href,
        hasForm: !!form,
        formVisible: !!(form && form.offsetParent !== null),
        denied,
        text: (document.body?.innerText || '').slice(0, 200),
      };
    });
    mark(
      'عدم اختفاء نموذج Login (موبايل)',
      stillLogin.hasForm && stillLogin.formVisible && !stillLogin.denied && /login\.html/i.test(stillLogin.url),
      stillLogin.url
    );

    // Direct dashboard as guest → should end on login
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForTimeout?.(1000).catch(() => new Promise((r) => setTimeout(r, 1000)));
    const afterDash = await page.evaluate(() => ({
      url: location.href,
      hasForm: !!document.getElementById('loginForm'),
      denied: /ليس لديك صلاحية|فريق التشغيل فقط/i.test(document.body?.innerText || ''),
    }));
    mark(
      'Dashboard كزائر → Login في المتصفح',
      /login\.html/i.test(afterDash.url) && afterDash.hasForm && !afterDash.denied,
      afterDash.url
    );

    if (SA_PASS) {
      await page.goto(`${BASE}/login.html?next=${encodeURIComponent('dashboard.html#my-account')}`, {
        waitUntil: 'networkidle2',
      });
      await page.waitForSelector('#email', { timeout: 15000 });
      await page.type('#email', SA_EMAIL, { delay: 20 });
      await page.type('#password', SA_PASS, { delay: 20 });
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null),
        page.click('#loginBtn'),
      ]);
      await page.waitForTimeout?.(1500).catch(() => new Promise((r) => setTimeout(r, 1500)));
      const afterAdmin = await page.evaluate(() => ({
        url: location.href,
        denied: /ليس لديك صلاحية|فريق التشغيل فقط/i.test(document.body?.innerText || ''),
        hasSidebar: !!document.querySelector('.sidebar'),
      }));
      const onDashboard = (url) => {
        try {
          const u = new URL(url);
          return /\/dashboard\.html$/i.test(u.pathname);
        } catch {
          return false;
        }
      };
      mark(
        'فتح Dashboard بعد Login',
        onDashboard(afterAdmin.url) && !afterAdmin.denied,
        afterAdmin.url
      );
      mark(
        'رابط داخلي بعد Login',
        onDashboard(afterAdmin.url) && /#my-account/i.test(afterAdmin.url) && !afterAdmin.denied,
        afterAdmin.url
      );
      await page.reload({ waitUntil: 'networkidle2' });
      const afterRefresh = await page.evaluate(() => ({
        url: location.href,
        denied: /ليس لديك صلاحية/i.test(document.body?.innerText || ''),
      }));
      mark('Refresh', onDashboard(afterRefresh.url) && !afterRefresh.denied, afterRefresh.url);

      const art = '/opt/cursor/artifacts/screenshots';
      fs.mkdirSync(art, { recursive: true });
      await page.screenshot({ path: path.join(art, 'admin-login-mobile-dashboard.png'), fullPage: true });
    }

    // Second isolated context
    const ctx2 = await browser.createBrowserContext();
    const p2 = await ctx2.newPage();
    await p2.setViewport({ width: 390, height: 844, isMobile: true });
    await p2.goto(`${BASE}/login.html`, { waitUntil: 'networkidle2' });
    await p2.waitForTimeout?.(600).catch(() => new Promise((r) => setTimeout(r, 600)));
    const iso = await p2.evaluate(() => ({
      url: location.href,
      hasForm: !!document.getElementById('loginForm'),
      denied: /ليس لديك صلاحية/i.test(document.body?.innerText || ''),
    }));
    mark('متصفح مستقل آخر', iso.hasForm && !iso.denied, iso.url);
    await ctx2.close();
    await ctx.close();
  } catch (err) {
    mark('الهاتف / Puppeteer', false, err.message);
  } finally {
    if (browser) await browser.close().catch(() => null);
  }

  const out = {
    at: new Date().toISOString(),
    base: BASE,
    rootCause:
      'resolveSession invented CLIENT sessions for unknown hub360 tokens; serveStatic returned 403 permission HTML for those cookies; login.js auto-redirected from localStorage without /api/auth/me.',
    checks: rows,
  };
  const file = path.join(__dirname, '../docs/admin-login-guest-redirect-report.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  const fail = rows.filter((r) => r.result === 'FAIL').length;
  console.log(`\nRESULT: ${fail ? 'FAIL' : 'PASS'} (${rows.length - fail}/${rows.length})`);
  console.log('Report:', file);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
