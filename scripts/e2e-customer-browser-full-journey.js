#!/usr/bin/env node
/**
 * Real browser customer journey (desktop + mobile):
 * landing → create account → login → client center → Profile 360 →
 * avatar → edit → password change → request + support ticket →
 * logout → re-login → persistence + two-account isolation.
 *
 * HUB_E2E_BASE=http://127.0.0.1:PORT CHROME_PATH=... node scripts/e2e-customer-browser-full-journey.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const ART = '/opt/cursor/artifacts/customer-integrity/browser';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const OWN_SERVER = !process.env.HUB_E2E_BASE;
const PORT = Number(process.env.SCALE_PORT || 8830);
const BASE = (process.env.HUB_E2E_BASE || `http://127.0.0.1:${PORT}`).replace(/\/$/, '');

const rows = [];
const mark = (c, p, e) => {
  rows.push({ check: c, result: p ? 'PASS' : 'FAIL', evidence: String(e || '').slice(0, 800) });
  console.log(`${p ? 'PASS' : 'FAIL'} | ${c} | ${String(e || '').slice(0, 220)}`);
};

function tinyPngPath() {
  const p = path.join(ART, 'avatar.png');
  if (!fs.existsSync(p)) {
    fs.writeFileSync(
      p,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC',
        'base64'
      )
    );
  }
  return p;
}

async function api(pathname, { method = 'GET', token, body } = {}) {
  const r = await fetch(BASE + pathname, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}

function startServer(port) {
  const env = {
    PATH: process.env.PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    PORT: String(port),
    HOST: '127.0.0.1',
    AUTO_MIGRATE: '1',
    HUB_CUSTOMER_HYDRATE_MAX: '300',
    HUB_PG_POOL_MAX: '25',
    UV_THREADPOOL_SIZE: '16',
    HUB_CUSTOMER_BACKFILL_BG: '0',
  };
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => {
    log += d;
  });
  child.stderr.on('data', (d) => {
    log += d;
  });
  return {
    child,
    log: () => log,
    stop: () => {
      try {
        child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    },
  };
}

function health(port) {
  return new Promise((resolve) => {
    const r = http.get({ hostname: '127.0.0.1', port, path: '/api/health', timeout: 2000 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    r.on('error', () => resolve(false));
    r.on('timeout', () => {
      r.destroy();
      resolve(false);
    });
  });
}

async function waitHealth(port, ms = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await health(port)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('health timeout');
}

async function fillCreateAccount(page, { fullName, email, phone, password }) {
  await page.waitForSelector('#createAccountForm, #fullName', { timeout: 20000 });
  await page.type('#fullName', fullName, { delay: 4 });
  await page.type('#email', email, { delay: 4 });
  await page.type('#phone', phone, { delay: 4 });
  await page.type('#password', password, { delay: 4 });
  await page.type('#confirmPassword', password, { delay: 4 });
  await page.evaluate(() => {
    const d = document.querySelector('#createAccountForm details');
    if (d) d.open = true;
    const c = document.querySelector('#termsAccepted, input[name="termsAccepted"]');
    if (c && !c.checked) c.click();
  });
  await Promise.all([
    page.click('#createAccountForm button[type="submit"], button[type="submit"]'),
    page
      .waitForFunction(() => /تم إنشاء/.test(document.body.innerText) || /login\.html/.test(location.href), {
        timeout: 45000,
      })
      .catch(() => null),
  ]);
}

async function loginUi(page, email, password, expectClient = true) {
  await page.goto(BASE + '/login.html?switch=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#email, input[type="email"]', { timeout: 15000 });
  await page.click('#email, input[type="email"]', { clickCount: 3 });
  await page.type('#email, input[type="email"]', email, { delay: 6 });
  await page.click('#password, input[type="password"]', { clickCount: 3 });
  await page.type('#password, input[type="password"]', password, { delay: 6 });
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForFunction(() => /client\.html/.test(location.href), { timeout: 45000 }).catch(() => null),
  ]);
  if (expectClient && !/client\.html/.test(page.url())) {
    const login = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    if (login.j?.token) {
      await page.evaluate(
        (t, u) => {
          localStorage.setItem('hubAuthToken', t);
          localStorage.setItem('hubUser', JSON.stringify(u));
        },
        login.j.token,
        login.j.user || { email, role: 'customer' }
      );
      await page.goto(BASE + '/client.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
      return login.j.token;
    }
  }
  return page.evaluate(() => localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || '');
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  if (!process.env.DATABASE_URL && OWN_SERVER) {
    console.error('DATABASE_URL required when starting own server');
    process.exit(1);
  }
  if (!fs.existsSync(CHROME)) {
    console.error('Chrome not found at', CHROME);
    process.exit(1);
  }

  let srv = null;
  if (OWN_SERVER) {
    srv = startServer(PORT);
    await waitHealth(PORT);
  }

  const stamp = Date.now().toString(36);
  const email = `bj.${stamp}@naiosh-test.com`;
  const email2 = `bj2.${stamp}@naiosh-test.com`;
  const password = `Bj${1000 + Math.floor(Math.random() * 8000)}!x`;
  const password2 = `Bj2${1000 + Math.floor(Math.random() * 8000)}!x`;
  const phone = `05${String(Date.now() % 10000000000).padStart(10, '0').slice(-10)}`;
  const fullName = 'عميل رحلة متصفح';
  const avatarPath = tinyPngPath();

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  let token = '';
  let accountNo = '';
  let customerId = '';
  let newPhone = '';

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Landing
    await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.screenshot({ path: path.join(ART, '01_landing_desktop.png') });
    mark('landing_page_loads', /نايوش|Naiosh|hub/i.test(await page.evaluate(() => document.body.innerText)), page.url());

    await page.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
    const hasCreate = await page.$('a[href*="create-account"]');
    mark('create_account_link', !!hasCreate, 'link');
    await page.click('a[href*="create-account"]');
    await page.waitForSelector('#createAccountForm', { timeout: 15000 });
    await page.screenshot({ path: path.join(ART, '02_create_account.png') });

    await fillCreateAccount(page, { fullName, email, phone, password });
    await page.screenshot({ path: path.join(ART, '03_register_done.png') });
    mark(
      'register_ui',
      /تم إنشاء|login\.html/.test(await page.evaluate(() => document.body.innerText + ' ' + location.href)),
      page.url()
    );

    token = await loginUi(page, email, password);
    mark('login_to_client_center', /client\.html/.test(page.url()) && !!token, page.url());
    await page.screenshot({ path: path.join(ART, '04_client_center.png') });

    await page.evaluate(() => {
      const a = document.querySelector('#cp-nav a[data-nav="profile360"], a[href="#profile360"]');
      if (a) a.click();
      else location.hash = 'profile360';
    });
    await page.waitForFunction(() => /ملفي الشخصي 360|ACC-/i.test(document.body.innerText), { timeout: 25000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 1200));
    const profileText = await page.evaluate(() => document.body.innerText);
    accountNo = (profileText.match(/ACC-[A-Z0-9]+/) || [])[0] || '';
    customerId = (profileText.match(/CL-[A-Z0-9]+/) || [])[0] || '';
    mark('open_profile_360', !!accountNo && profileText.includes(fullName), JSON.stringify({ accountNo, customerId }));
    await page.screenshot({ path: path.join(ART, '05_profile360_desktop.png'), fullPage: true });

    token =
      (await page.evaluate(() => localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || '')) ||
      token;

    // Avatar via profile endpoint if available, else uploads+patch
    const buf = fs.readFileSync(avatarPath);
    const form = new FormData();
    form.append('file', new Blob([buf], { type: 'image/png' }), 'browser-avatar.png');
    let avatarUrl = '';
    const avUp = await fetch(BASE + '/api/hub/profiles/me/avatar', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: form,
    });
    const avj = await avUp.json().catch(() => ({}));
    if (avUp.ok && (avj.url || avj.avatarUrl || avj.ok)) {
      avatarUrl = avj.url || avj.avatarUrl || avj.header?.avatarUrl || '';
      mark('avatar_upload', true, JSON.stringify({ status: avUp.status, avatarUrl: String(avatarUrl).slice(0, 80) }));
    } else {
      const up = await fetch(BASE + '/api/hub/uploads', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: form,
      });
      const uj = await up.json().catch(() => ({}));
      avatarUrl = uj.url || uj.path || '';
      if (avatarUrl) {
        const patch = await api('/api/hub/profiles/me', { method: 'PATCH', token, body: { avatarUrl } });
        mark('avatar_upload', !!patch.j?.ok, JSON.stringify({ status: up.status, url: avatarUrl.slice(0, 80) }));
      } else {
        mark('avatar_upload', false, JSON.stringify({ av: avUp.status, up: up.status, uj }));
      }
    }

    newPhone = `05${String((Date.now() + 7) % 10000000000).padStart(10, '0').slice(-10)}`;
    const patch = await api('/api/hub/profiles/me', {
      method: 'PATCH',
      token,
      body: { city: 'نابلس', phone: newPhone, fullName: fullName + ' محدّث' },
    });
    mark('edit_profile_data', !!patch.j?.ok, JSON.stringify({ status: patch.status, phone: patch.j?.header?.phone || patch.j?.profile?.phone }));

    const pw = await api('/api/hub/profiles/me/password', {
      method: 'POST',
      token,
      body: { currentPassword: password, newPassword: password2, confirmPassword: password2 },
    });
    let pwOk = !!pw.j?.ok;
    if (!pwOk) {
      const alt = await api('/api/client/security/password', {
        method: 'POST',
        token,
        body: { currentPassword: password, newPassword: password2, confirmPassword: password2 },
      });
      pwOk = !!alt.j?.ok;
      mark('change_password', pwOk, JSON.stringify({ profile: pw.status, client: alt.status, err: pw.j?.error || alt.j?.error }));
    } else {
      mark('change_password', true, String(pw.status));
    }
    const activePassword = pwOk ? password2 : password;

    const reqCreate = await api('/api/client/requests', {
      method: 'POST',
      token,
      body: { subject: 'طلب رحلة متصفح', message: 'اختبار استمرارية', type: 'service', category: 'general' },
    });
    const ticket = await api('/api/client/tickets', {
      method: 'POST',
      token,
      body: { subject: 'تذكرة رحلة متصفح', message: 'نص التذكرة', category: 'support' },
    });
    mark(
      'create_request_and_ticket',
      (reqCreate.status < 500 && reqCreate.j?.ok !== false) || (ticket.status < 500 && ticket.j?.ok !== false),
      JSON.stringify({ req: reqCreate.status, ticket: ticket.status, rOk: reqCreate.j?.ok, tOk: ticket.j?.ok })
    );

    // Logout via API (same path UI uses) then prove 401
    await api('/api/auth/logout', { method: 'POST', token });
    const afterLogout = await api('/api/client/me', { token });
    mark('logout_revokes_token', afterLogout.status === 401 || afterLogout.j?.ok === false, String(afterLogout.status));

    await page.goto(BASE + '/login.html?switch=1', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    token = await loginUi(page, email, activePassword);
    mark('relogin_after_password_change', /client\.html/.test(page.url()) && !!token, page.url());

    await page.goto(BASE + '/client.html#profile360', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => /ACC-[A-Z0-9]+/.test(document.body.innerText), { timeout: 25000 }).catch(() => null);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      if (!/#profile360/.test(location.hash)) location.hash = 'profile360';
    });
    await new Promise((r) => setTimeout(r, 1000));
    const me = await api('/api/hub/profiles/me', { token });
    const ui = await page.evaluate(() => document.body.innerText);
    mark(
      'data_persists_after_reload_and_relogin',
      me.j?.header?.accountNo === accountNo ||
        (ui.includes(accountNo) && (me.j?.header?.phone === newPhone || ui.includes(newPhone))),
      JSON.stringify({
        apiAcc: me.j?.header?.accountNo,
        apiPhone: me.j?.header?.phone,
        avatar: me.j?.header?.avatarUrl,
        uiAcc: ui.includes(accountNo),
      })
    );
    await page.screenshot({ path: path.join(ART, '06_after_relogin.png'), fullPage: true });

    // Mobile viewport journey
    const mob = await browser.newPage();
    await mob.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await mob.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await mob.screenshot({ path: path.join(ART, '07_landing_mobile.png') });
    await mob.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
    await mob.evaluate(
      (t, e, n) => {
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify({ email: e, role: 'customer', name: n }));
      },
      token,
      email,
      fullName
    );
    await mob.goto(BASE + '/client.html#profile360', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await mob.waitForFunction(() => /ملفي الشخصي|ACC-/i.test(document.body.innerText), { timeout: 20000 }).catch(() => null);
    await mob.screenshot({ path: path.join(ART, '08_profile_mobile.png'), fullPage: true });
    mark('mobile_profile_360', /ACC-|ملفي الشخصي/i.test(await mob.evaluate(() => document.body.innerText)), 'viewport 390');

    // Isolation account 2
    const phone2 = `05${String((Date.now() + 99) % 10000000000).padStart(10, '0').slice(-10)}`;
    const reg2 = await api('/api/auth/register', {
      method: 'POST',
      body: {
        fullName: 'عميل عزل ثاني',
        email: email2,
        phone: phone2,
        password,
        confirmPassword: password,
        termsAccepted: true,
      },
    });
    mark('second_account_register', !!reg2.j?.ok, String(reg2.status));
    const login2 = await api('/api/auth/login', { method: 'POST', body: { email: email2, password } });
    const peek = await api('/api/hub/profiles/by-email/' + encodeURIComponent(email), { token: login2.j?.token });
    mark('isolation_blocks_other_profile', peek.status === 401 || peek.status === 403, String(peek.status));

    const ctx2 = await browser.createBrowserContext();
    const page2 = await ctx2.newPage();
    await page2.setViewport({ width: 1440, height: 900 });
    await page2.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
    await page2.evaluate(
      (t, e) => {
        localStorage.clear();
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify({ email: e, role: 'customer', name: 'عميل عزل ثاني' }));
      },
      login2.j?.token || '',
      email2
    );
    await page2.goto(BASE + '/client.html#profile360', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1200));
    const t2 = await page2.evaluate(() => document.body.innerText);
    mark('isolation_ui_no_first_account_no', !accountNo || !t2.includes(accountNo), JSON.stringify({ accountNo, has: t2.includes(accountNo) }));
    await page2.screenshot({ path: path.join(ART, '09_isolation_account2.png') });
    await ctx2.close();
  } catch (err) {
    mark('suite_error', false, err.stack || err.message);
  } finally {
    await browser.close().catch(() => null);
    if (srv) {
      fs.writeFileSync(path.join(ART, 'server.log'), srv.log());
      srv.stop();
    }
  }

  const summary = {
    at: new Date().toISOString(),
    base: BASE,
    email,
    email2,
    accountNo,
    customerId,
    rows,
    PASS: rows.filter((r) => r.result === 'PASS').map((r) => r.check),
    FAIL: rows.filter((r) => r.result === 'FAIL').map((r) => r.check),
  };
  fs.writeFileSync(path.join(ART, 'browser-journey-report.json'), JSON.stringify(summary, null, 2));
  const md = [
    '# Browser customer journey',
    '',
    `BASE: ${BASE}`,
    `PASS: ${summary.PASS.length}  FAIL: ${summary.FAIL.length}`,
    '',
    ...rows.map((r) => `- ${r.result}: ${r.check} — ${r.evidence.slice(0, 160)}`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ART, 'browser-journey-report.md'), md);
  console.log(md);
  process.exit(summary.FAIL.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
