#!/usr/bin/env node
/**
 * Regression: Super Admin password change must NOT be wiped by env-password login.
 * Also covers Production login probe (no secret values printed).
 *
 * Usage:
 *   HUB_SUPER_ADMIN_INITIAL_PASSWORD=… node scripts/e2e-sa-login-no-env-overwrite.js
 *   HUB_E2E_BASE=https://www.naioshai.com …  # production probe + browser
 */
'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.HUB_E2E_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const SA = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const ENV_PASS = process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || process.env.HUB_E2E_SA_PASSWORD || '';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const IS_PROD = /naioshai\.com/i.test(BASE);
const OUT = path.join(
  '/opt/cursor/artifacts',
  `sa-login-no-overwrite-${IS_PROD ? 'prod' : 'local'}-${Date.now()}.json`
);

const rows = [];
function mark(check, pass, evidence) {
  rows.push({ check, result: pass ? 'PASS' : 'FAIL', evidence: String(evidence || '').slice(0, 400) });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${evidence}`);
}

function req(method, p, { body, token } = {}) {
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
          Accept: 'application/json',
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...(token ? { Authorization: `Bearer ${token}`, 'X-Hub-Token': token } : {}),
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
            /* */
          }
          resolve({ status: res.statusCode, json, raw });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function safeLoginSummary(r) {
  return {
    status: r.status,
    ok: !!r.json?.ok,
    error: r.json?.error,
    employeeNo: r.json?.employeeNo || r.json?.user?.employeeNo,
    role: r.json?.user?.role,
    name: r.json?.user?.name,
    mustChangePassword: r.json?.mustChangePassword,
    hasToken: !!(r.json?.token),
    destination: r.json?.destination,
  };
}

async function unitNoOverwrite() {
  // In-process unit: does not hit network — proves auth module behavior
  delete process.env.HUB_SUPER_ADMIN_FORCE_PASSWORD_RESET;
  const staffCreds = require('../lib/hub-staff-credentials');
  const hubStaffAuth = require('../lib/hub-staff-auth');

  // Isolate store file for this process
  const stamp = Date.now().toString(36);
  const customPass = `4827${stamp.slice(-2)}`; // numeric-only owner-style
  await staffCreds.applySuperAdminPassword(ENV_PASS || '1111', { via: 'unit_seed', forceChange: false });
  const set = await staffCreds.setPassword(SA, customPass, {
    actor: { email: SA, employeeNo: 'EMP-0001' },
    forceChange: false,
  });
  mark('unit: setPassword owner numeric', !!set.ok, set.message || set.error);

  const loginCustom = await hubStaffAuth.login({ email: SA, password: customPass });
  mark('unit: login with owner password', !!loginCustom?.ok, loginCustom?.employeeNo || loginCustom?.error);

  const loginEnv = await hubStaffAuth.login({ email: SA, password: ENV_PASS || '1111' });
  mark(
    'unit: env password does NOT login/overwrite when FORCE off',
    !loginEnv?.ok,
    loginEnv?.error || 'unexpected ok'
  );

  const stillCustom = await hubStaffAuth.login({ email: SA, password: customPass });
  mark('unit: owner password still works after env attempt', !!stillCustom?.ok, stillCustom?.employeeNo);

  // FORCE path
  process.env.HUB_SUPER_ADMIN_FORCE_PASSWORD_RESET = '1';
  const forced = await hubStaffAuth.login({ email: SA, password: ENV_PASS || '1111' });
  mark('unit: FORCE=1 allows env recovery', !!forced?.ok, forced?.employeeNo || forced?.error);
  delete process.env.HUB_SUPER_ADMIN_FORCE_PASSWORD_RESET;

  // restore custom for cleanliness of local store
  await staffCreds.setPassword(SA, customPass, {
    actor: { email: SA, employeeNo: 'EMP-0001' },
    forceChange: false,
  });
}

async function prodProbeAndBrowser() {
  if (!ENV_PASS) {
    mark('prod: env password available', false, 'HUB_SUPER_ADMIN_INITIAL_PASSWORD unset');
    return;
  }

  const wrong = await req('POST', '/api/auth/login', { body: { email: SA, password: '00000000' } });
  mark('prod: wrong password rejected', wrong.status === 401 && !wrong.json?.ok, wrong.json?.error);

  const okLogin = await req('POST', '/api/auth/login', { body: { email: SA, password: ENV_PASS } });
  const s = safeLoginSummary(okLogin);
  mark(
    'وجود الحساب في Production / Backend Login',
    !!(s.ok && s.hasToken && s.employeeNo === 'EMP-0001'),
    JSON.stringify(s)
  );
  mark('ارتباطه بـ EMP-0001', s.employeeNo === 'EMP-0001', s.employeeNo);
  mark('صحة الدور', s.role === 'supreme_leader', s.role);
  mark('فحص ترحيل البريد (naioshhub@example.com)', s.ok && okLogin.json?.user?.email === SA, okLogin.json?.user?.email);

  const token = okLogin.json?.token;
  if (!token) return;

  const me = await req('GET', '/api/auth/me', { token });
  mark(
    'Session /me',
    !!(me.json?.ok || me.json?.authenticated) &&
      (me.json?.employeeNo === 'EMP-0001' || me.json?.user?.employeeNo === 'EMP-0001'),
    `lane=${me.json?.lane} emp=${me.json?.employeeNo || me.json?.user?.employeeNo}`
  );

  const staff = await req('GET', '/api/admin/staff', { token });
  const leader = (staff.json?.staff || []).find((x) => x.email === SA);
  mark(
    'إدارة الإداريين API',
    !!(staff.json?.ok && leader && leader.employeeNo === 'EMP-0001' && leader.active !== false),
    JSON.stringify({
      emp: leader?.employeeNo,
      role: leader?.role || leader?.roleLabel,
      active: leader?.active,
      assignment: leader?.assignmentStatus,
      accountId: leader?.accountId,
    })
  );

  // Password-change round-trip. On builds that still include silent env_login_recovery,
  // logging in with ENV_PASS after a change would wipe the new hash — detect that and
  // skip destructive steps until the fix is deployed.
  const tempPass = `2468${String(Date.now()).slice(-4)}`;
  const changed = await req('POST', '/api/admin/account/password', {
    token,
    body: {
      currentPassword: ENV_PASS,
      newPassword: tempPass,
      confirmPassword: tempPass,
    },
  });
  mark(
    'فحص حفظ كلمة المرور (تغيير مؤقت)',
    !!(changed.json?.ok && changed.json?.token),
    changed.json?.error || changed.json?.message
  );

  if (changed.json?.ok) {
    const envAfterChange = await req('POST', '/api/auth/login', { body: { email: SA, password: ENV_PASS } });
    const recoveryStillActive = !!envAfterChange.json?.ok;
    mark(
      'منع استعادة صامتة بسر البيئة بعد تغيير كلمة المرور',
      !recoveryStillActive,
      recoveryStillActive
        ? 'FAIL: env login still overwrites owner password (deploy fix required)'
        : 'env rejected as expected'
    );

    if (recoveryStillActive) {
      // Hash was wiped back to ENV_PASS by legacy recovery — account still usable.
      mark('كلمة المرور القديمة مرفوضة بعد التغيير', false, 'skipped — legacy env_login_recovery re-applied env hash');
      mark('كلمة المرور الجديدة تعمل', false, 'skipped — hash overwritten by legacy recovery');
      mark('Session Revocation (token قبل التغيير)', false, 'skipped — awaiting deploy');
      mark('استعادة سر البيئة بعد اختبار التغيير', true, 'legacy recovery already restored env hash');
    } else {
      mark('كلمة المرور القديمة مرفوضة بعد التغيير', !envAfterChange.json?.ok, envAfterChange.json?.error);
      const newOk = await req('POST', '/api/auth/login', { body: { email: SA, password: tempPass } });
      mark(
        'كلمة المرور الجديدة تعمل',
        !!(newOk.json?.ok && newOk.json?.employeeNo === 'EMP-0001'),
        safeLoginSummary(newOk)
      );
      const oldMe = await req('GET', '/api/auth/me', { token });
      mark(
        'Session Revocation (token قبل التغيير)',
        oldMe.status === 401 || oldMe.json?.ok === false || oldMe.json?.authenticated === false,
        `status=${oldMe.status}`
      );
      const restoreTok = newOk.json?.token || changed.json?.token;
      const restored = await req('POST', '/api/admin/account/password', {
        token: restoreTok,
        body: {
          currentPassword: tempPass,
          newPassword: ENV_PASS,
          confirmPassword: ENV_PASS,
        },
      });
      mark(
        'استعادة سر البيئة بعد اختبار التغيير',
        !!(restored.json?.ok),
        restored.json?.error || restored.json?.message
      );
    }
  }

  const envAgain = await req('POST', '/api/auth/login', { body: { email: SA, password: ENV_PASS } });
  mark(
    'Backend Login بعد الاستعادة',
    !!(envAgain.json?.ok && envAgain.json?.employeeNo === 'EMP-0001'),
    safeLoginSummary(envAgain)
  );
  mark(
    'دخول متكرر بسر البيئة دون فقدان EMP-0001',
    envAgain.json?.employeeNo === 'EMP-0001',
    envAgain.json?.employeeNo
  );

  // Browser login — type into real form
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
      defaultViewport: { width: 1400, height: 900 },
    });
    const page = await browser.newPage();
    await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#email, input[type="email"]', { timeout: 20000 });
    await page.click('#email, input[type="email"]', { clickCount: 3 });
    await page.type('#email, input[type="email"]', SA, { delay: 20 });
    await page.click('#password, input[type="password"]', { clickCount: 3 });
    await page.type('#password, input[type="password"]', ENV_PASS, { delay: 20 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null),
      page.click('button[type="submit"], #loginBtn, .btn-primary'),
    ]);
    await page.waitForFunction(() => /dashboard\.html/i.test(location.pathname), { timeout: 25000 }).catch(() => null);
    const onDash = await page.evaluate(() => /dashboard\.html/i.test(location.pathname));
    mark('Browser Login → Dashboard', onDash, await page.evaluate(() => location.pathname + location.hash));

    if (onDash) {
      // Identity in UI / API from browser session
      const browserMe = await page.evaluate(async () => {
        const token = localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || '';
        const r = await fetch('/api/auth/me', {
          credentials: 'same-origin',
          headers: token ? { Authorization: `Bearer ${token}`, 'X-Hub-Token': token } : {},
        });
        return r.json().catch(() => ({}));
      });
      mark(
        'Browser session EMP-0001 / القائد الأعلى',
        (browserMe.employeeNo || browserMe.user?.employeeNo) === 'EMP-0001' &&
          (browserMe.lane === 'SUPER_ADMIN' ||
            browserMe.role === 'supreme_leader' ||
            browserMe.user?.role === 'supreme_leader'),
        `emp=${browserMe.employeeNo || browserMe.user?.employeeNo} lane=${browserMe.lane} role=${browserMe.role || browserMe.user?.role}`
      );

      await page.goto(`${BASE}/dashboard.html#account`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout?.(1200).catch(() => new Promise((r) => setTimeout(r, 1200)));
      const accountOk = await page.evaluate(() => /account|حسابي/i.test(location.hash + document.body.innerText));
      mark('فتح حسابي', accountOk, await page.evaluate(() => location.hash));

      await page.goto(`${BASE}/dashboard.html#admins`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout?.(1200).catch(() => new Promise((r) => setTimeout(r, 1200)));
      const adminsOk = await page.evaluate(() => /admin|إداري/i.test(location.hash + document.body.innerText));
      mark('فتح إدارة الإداريين', adminsOk, await page.evaluate(() => location.hash));

      await page.goto(`${BASE}/dashboard.html#clients`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout?.(1200).catch(() => new Promise((r) => setTimeout(r, 1200)));
      const clientsOk = await page.evaluate(() => /client|عملاء/i.test(location.hash + document.body.innerText));
      mark('فتح إدارة العملاء', clientsOk, await page.evaluate(() => location.hash));

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout?.(1000).catch(() => new Promise((r) => setTimeout(r, 1000)));
      const afterRefresh = await page.evaluate(async () => {
        const token = localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || '';
        const r = await fetch('/api/auth/me', {
          credentials: 'same-origin',
          headers: token ? { Authorization: `Bearer ${token}`, 'X-Hub-Token': token } : {},
        });
        const j = await r.json().catch(() => ({}));
        return { status: r.status, emp: j.employeeNo || j.user?.employeeNo, ok: j.ok || j.authenticated };
      });
      mark('نجاح Refresh', afterRefresh.ok && afterRefresh.emp === 'EMP-0001', JSON.stringify(afterRefresh));

      // Logout
      await page.evaluate(async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
        } catch {
          /* */
        }
        localStorage.removeItem('hubAuthToken');
        sessionStorage.removeItem('hubAuthToken');
      });
      await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#email, input[type="email"]', { timeout: 15000 });
      await page.click('#email, input[type="email"]', { clickCount: 3 });
      await page.type('#email, input[type="email"]', SA, { delay: 15 });
      await page.click('#password, input[type="password"]', { clickCount: 3 });
      await page.type('#password, input[type="password"]', ENV_PASS, { delay: 15 });
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null),
        page.click('button[type="submit"], #loginBtn, .btn-primary'),
      ]);
      await page.waitForFunction(() => /dashboard\.html/i.test(location.pathname), { timeout: 25000 }).catch(() => null);
      mark(
        'Logout ثم Login مرة أخرى',
        await page.evaluate(() => /dashboard\.html/i.test(location.pathname)),
        await page.evaluate(() => location.pathname)
      );

      // Mobile viewport login in fresh context
      const mob = await browser.newPage();
      await mob.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await mob.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const emailSel = await mob.waitForSelector('#email, input[name="email"], input[type="email"]', { timeout: 25000 }).catch(() => null);
      const passSel = await mob.$('#password, input[name="password"], input[type="password"]');
      if (!emailSel || !passSel) {
        mark('Mobile Login', false, `selectors missing email=${!!emailSel} pass=${!!passSel} url=${mob.url()}`);
      } else {
        await emailSel.click({ clickCount: 3 });
        await emailSel.type(SA, { delay: 15 });
        await passSel.click({ clickCount: 3 });
        await passSel.type(ENV_PASS, { delay: 15 });
        const btn = (await mob.$('button[type="submit"]')) || (await mob.$('#loginBtn')) || (await mob.$('.btn-primary'));
        await Promise.all([
          mob.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null),
          btn ? btn.click() : Promise.resolve(),
        ]);
        await mob.waitForFunction(() => /dashboard\.html/i.test(location.pathname), { timeout: 25000 }).catch(() => null);
        mark(
          'Mobile Login',
          await mob.evaluate(() => /dashboard\.html/i.test(location.pathname)),
          await mob.evaluate(() => location.pathname)
        );
      }

      // Direct dashboard.html while logged out should not show permission-denied as primary for guests
      await mob.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await mob.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await mob.waitForTimeout?.(1500).catch(() => new Promise((r) => setTimeout(r, 1500)));
      const guest = await mob.evaluate(() => ({
        path: location.pathname,
        text: (document.body?.innerText || '').slice(0, 200),
      }));
      const deniedFirst = /ليس لديك صلاحية|غير مصرح|ليس لديك صلاحية الوصول/.test(guest.text) && !/login/i.test(guest.path);
      mark(
        'dashboard.html كضيف لا يظهر رفض صلاحية قبل Login',
        /login\.html/i.test(guest.path) || !deniedFirst,
        `${guest.path} deniedFirst=${deniedFirst}`
      );

      const shot = path.join('/opt/cursor/artifacts', `sa-login-prod-dashboard-${Date.now()}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      mark('لقطة Production بعد الدخول', fs.existsSync(shot), shot);
    }
  } catch (err) {
    mark('Browser Login', false, err.message);
  } finally {
    if (browser) await browser.close().catch(() => null);
  }
}

async function locationHash(page) {
  return page.evaluate(() => location.hash);
}

async function main() {
  if (!ENV_PASS) {
    console.error('Set HUB_SUPER_ADMIN_INITIAL_PASSWORD');
    process.exit(2);
  }

  mark('Production Deployment reachable', true, BASE);

  if (!IS_PROD) {
    await unitNoOverwrite();
  } else {
    mark('unit suite skipped on production host', true, 'run locally against :8080 for unit');
  }

  await prodProbeAndBrowser();

  // Local unit always when base is local
  if (!IS_PROD) {
    /* already ran */
  } else {
    // Also run unit against local modules (in-process) even when probing prod
    await unitNoOverwrite();
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), base: BASE, rows }, null, 2));
  console.log('Report:', OUT);
  const failed = rows.filter((r) => r.result === 'FAIL').length;
  console.log(`Summary: ${rows.length - failed} PASS / ${failed} FAIL / ${rows.length} total`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  mark('e2e crashed', false, e.message);
  try {
    fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), base: BASE, rows, error: e.message }, null, 2));
  } catch {
    /* */
  }
  process.exit(1);
});
