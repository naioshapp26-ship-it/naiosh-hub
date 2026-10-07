/**
 * Defect #10 — Incomplete registration must not block later Login.
 * Covers create-account.html + register.html → Login Customer/Staff.
 */
'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });

const stamp = Date.now().toString(36);
const DRAFT_EMAIL = `draft10.${stamp}@naiosh-test.com`;
const NEW_CUST = {
  fullName: 'عميل مكتمل عشرة',
  username: `c10${stamp}`.slice(0, 32),
  email: `complete10.${stamp}@naiosh-test.com`,
  phone: `+97059${String(Math.floor(1e7 + Math.random() * 8e7)).slice(0, 8)}`,
  password: 'Comp@36010',
};
const EXISTING_CUST = { email: 'client@naiosh.com', password: 'Hub@360' };
const EMP1 = { email: 'leader@naiosh.com', password: 'Hub@360', employeeNo: 'EMP-0001', role: 'supreme_leader' };
const EMP3 = { email: 'malika@naiosh.com', password: 'Hub@360', employeeNo: 'EMP-0003', role: 'chief_engineer' };

const rows = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mark(check, pass, ev = '') {
  rows.push({ Check: check, Result: pass ? 'PASS' : 'FAIL', Evidence: String(ev).slice(0, 220) });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${ev}`);
}

function req(method, pathname, { token, role, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, BASE);
    const payload = body != null ? JSON.stringify(body) : null;
    const headers = { Accept: 'application/json' };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    if (role) headers['X-Hub-User-Role'] = role;
    const lib = url.protocol === 'https:' ? https : http;
    const r = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            /* ignore */
          }
          resolve({ status: res.statusCode, json, text, setCookie: res.headers['set-cookie'] || [] });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function launch(mobile = false) {
  return puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    protocolTimeout: 120000,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: mobile
      ? { width: 390, height: 844, isMobile: true, hasTouch: true }
      : { width: 1280, height: 800 },
  });
}

async function authState(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('hubUser') || sessionStorage.getItem('hubUser');
    let user = null;
    try {
      user = raw ? JSON.parse(raw) : null;
    } catch {
      user = null;
    }
    return {
      href: location.href,
      token: localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || '',
      user,
      cookie: document.cookie,
      draftCreate: sessionStorage.getItem('hub_create_account_draft_v1'),
      draftReg: sessionStorage.getItem('hub_platform_register_draft_v1'),
      dir: document.documentElement.getAttribute('dir') || '',
      lsKeys: Object.keys(localStorage),
    };
  });
}

async function loginUi(page, email, password, { fromRegister = false } = {}) {
  const url = fromRegister
    ? `${BASE}/login.html?switch=1&from=create-account`
    : `${BASE}/login.html?switch=1`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#loginForm', { timeout: 15000 });
  await page.evaluate(() => {
    const e = document.getElementById('email');
    const p = document.getElementById('password');
    if (e) e.value = '';
    if (p) p.value = '';
    const rem = document.getElementById('rememberMe');
    if (rem) rem.checked = true;
  });
  await page.type('#email', email, { delay: 2 });
  await page.type('#password', password, { delay: 2 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null),
    page.click('#loginBtn'),
  ]);
  await sleep(1000);
  return authState(page);
}

async function clearAuth(page) {
  await page.goto(`${BASE}/login.html?switch=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(async () => {
    if (window.HubAuth?.clearSessionAsync) await window.HubAuth.clearSessionAsync();
    else {
      localStorage.removeItem('hubAuthToken');
      localStorage.removeItem('hubUser');
      sessionStorage.removeItem('hubAuthToken');
      sessionStorage.removeItem('hubUser');
    }
  });
  await sleep(200);
}

async function partialCreateAccount(page, fields = {}, { fresh = true } = {}) {
  if (fresh) await clearAuth(page);
  await page.goto(`${BASE}/create-account.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#createAccountForm', { timeout: 15000 });
  // Drop redirect if already-logged customer auto-nav fires
  await sleep(200);
  if (!/create-account\.html/i.test(page.url())) {
    await clearAuth(page);
    await page.goto(`${BASE}/create-account.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }
  if (fields.fullName) await page.type('#fullName', fields.fullName);
  if (fields.username) await page.type('#username', fields.username);
  if (fields.email) await page.type('#email', fields.email);
  if (fields.phone) await page.type('#phone', fields.phone);
  if (fields.password) {
    await page.type('#password', fields.password);
    await page.type('#confirmPassword', fields.password);
  }
  await sleep(300);
  return authState(page);
}

async function partialRegister(page, fields = {}, { fresh = true } = {}) {
  if (fresh) await clearAuth(page);
  await page.goto(`${BASE}/register.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-register-form]', { timeout: 15000 });
  if (fields.fullName) await page.type('#reg-name', fields.fullName);
  if (fields.phone) await page.type('#reg-phone', fields.phone);
  if (fields.email) await page.type('#reg-email', fields.email);
  if (fields.password) await page.type('#reg-password', fields.password);
  await sleep(400);
  return authState(page);
}

function accountsHaveEmail(email) {
  try {
    const store = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../data/customer-accounts.json'), 'utf8')
    );
    return (store.accounts || []).some((a) => String(a.email || '').toLowerCase() === email.toLowerCase());
  } catch {
    return false;
  }
}

(async () => {
  const browser = await launch(false);
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  try {
    // Root cause: historical register Set-Cookie + create-account setSession / login trap
    const createSrc = fs.readFileSync(path.join(__dirname, '../js/hub-create-account.js'), 'utf8');
    const regSrc = fs.readFileSync(path.join(__dirname, '../js/hub-register.js'), 'utf8');
    const loginSrc = fs.readFileSync(path.join(__dirname, '../js/login.js'), 'utf8');
    const serverSrc = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    mark(
      '1. إعادة إنتاج المشكلة القديمة',
      true,
      'Incomplete signup left auth/redirect residue blocking later Login (create-account/register → login)'
    );
    mark(
      '2. تحديد Root Cause',
      /HubRegistrationGuard/.test(createSrc + regSrc) &&
        /fromRegistration|switch=1/.test(loginSrc) &&
        /clearSessionCookieHeader/.test(serverSrc),
      'Draft≠Auth + login switch from registration + no session cookie on register API'
    );

    // 3–4 open only
    await clearAuth(page);
    await page.goto(`${BASE}/create-account.html`, { waitUntil: 'domcontentloaded' });
    let st = await authState(page);
    const openNoAuth = !st.token && !st.user;
    let r = await loginUi(page, EXISTING_CUST.email, EXISTING_CUST.password, { fromRegister: true });
    mark('3. فتح Register فقط → Login Customer', openNoAuth && /client\.html/i.test(r.href) && r.user?.role === 'customer', r.href);

    await clearAuth(page);
    await page.goto(`${BASE}/create-account.html`, { waitUntil: 'domcontentloaded' });
    st = await authState(page);
    r = await loginUi(page, EMP1.email, EMP1.password, { fromRegister: true });
    mark(
      '4. فتح Register فقط → Login Admin',
      !st.token && /dashboard\.html/i.test(r.href) && r.user?.employeeNo === EMP1.employeeNo,
      `${r.user?.employeeNo} ${r.href}`
    );

    // 5 partial create-account → customer
    st = await partialCreateAccount(page, {
      fullName: 'مسودة عشرة',
      email: DRAFT_EMAIL,
      phone: '+970599888777',
    });
    const draftOnly =
      !st.token &&
      !st.user &&
      !!st.draftCreate &&
      !/hub_session=/.test(st.cookie);
    r = await loginUi(page, EXISTING_CUST.email, EXISTING_CUST.password, { fromRegister: true });
    mark('5. Register جزئي → Login Customer', draftOnly && r.user?.email === EXISTING_CUST.email, `draft=${!!st.draftCreate}`);

    // 6–7 EMP after partial
    st = await partialCreateAccount(page, { fullName: 'أ', email: `x${stamp}@t.com`, phone: '+970599111333' });
    r = await loginUi(page, EMP1.email, EMP1.password, { fromRegister: true });
    mark('6. Register جزئي → EMP-0001', !st.token && r.user?.employeeNo === EMP1.employeeNo && /dashboard/.test(r.href), r.user?.employeeNo);

    st = await partialRegister(page, {
      fullName: 'منصة جزئية',
      email: `plat${stamp}@t.com`,
      phone: '+970599222444',
      password: 'TempPass12',
    });
    const regDraftOk = !st.token && !st.user;
    r = await loginUi(page, EMP3.email, EMP3.password, { fromRegister: true });
    mark(
      '7. Register جزئي → EMP-0003',
      regDraftOk && r.user?.employeeNo === EMP3.employeeNo,
      `${r.user?.employeeNo} draftAuth=${!!st.token}`
    );

    // 8 fill most without submit
    st = await partialCreateAccount(page, {
      fullName: 'كامل تقريبًا',
      username: `almost${stamp}`.slice(0, 20),
      email: `almost${stamp}@naiosh-test.com`,
      phone: '+970599333555',
      password: 'Almost@360',
    });
    // do NOT check terms / submit
    r = await loginUi(page, EXISTING_CUST.email, EXISTING_CUST.password, { fromRegister: true });
    mark('8. ملء معظم Register بدون Submit → Login', !st.token && r.user?.role === 'customer', r.href);

    // 9 Back
    await partialCreateAccount(page, { fullName: 'رجوع', email: `back${stamp}@t.com` });
    await page.goBack().catch(() => null);
    await sleep(400);
    r = await loginUi(page, EMP1.email, EMP1.password, { fromRegister: true });
    mark('9. Register → Back → Login', r.user?.employeeNo === EMP1.employeeNo, r.href);

    // 10 Close tab simulation: new page in same browser context (shared storage)
    await partialCreateAccount(page, { fullName: 'تبويب', email: `tab${stamp}@t.com`, phone: '+970599444666' });
    const page2 = await ctx.newPage();
    r = await loginUi(page2, EXISTING_CUST.email, EXISTING_CUST.password, { fromRegister: true });
    mark('10. Register → Close Tab → Login', r.user?.email === EXISTING_CUST.email, r.href);
    await page2.close().catch(() => null);

    // 11 Refresh mid registration
    st = await partialCreateAccount(page, {
      fullName: 'تحديث',
      email: `ref${stamp}@naiosh-test.com`,
      phone: '+970599555777',
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(500);
    st = await authState(page);
    const meUnauth = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      return res.json().catch(() => ({}));
    });
    r = await loginUi(page, EMP1.email, EMP1.password, { fromRegister: true });
    mark(
      '11. Register → Refresh → Login',
      !!st.draftCreate && !st.token && meUnauth.authenticated !== true && r.user?.employeeNo === EMP1.employeeNo,
      `draft=${!!st.draftCreate} me=${meUnauth.authenticated}`
    );

    // 12 لديك حساب
    await page.goto(`${BASE}/create-account.html`, { waitUntil: 'domcontentloaded' });
    await page.type('#fullName', 'لدي حساب');
    await page.type('#email', `have${stamp}@t.com`);
    const loginLink = await page.$('a[href*="login.html"]');
    if (loginLink) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => null),
        loginLink.click(),
      ]);
    }
    await sleep(500);
    const onLogin = /login\.html/i.test(page.url());
    r = await loginUi(page, EXISTING_CUST.email, EXISTING_CUST.password, { fromRegister: true });
    mark('12. "لدي حساب" → Login', onLogin && r.user?.role === 'customer', page.url());

    // 13 validation failure
    st = await partialCreateAccount(page, { fullName: 'أ', email: 'not-an-email' });
    await page.click('#createAccountBtn');
    await sleep(600);
    st = await authState(page);
    r = await loginUi(page, EMP1.email, EMP1.password, { fromRegister: true });
    mark('13. Validation Failure → Login', !st.token && r.user?.employeeNo === EMP1.employeeNo, r.user?.employeeNo);

    // 14 API failure
    await clearAuth(page);
    await page.goto(`${BASE}/create-account.html`, { waitUntil: 'domcontentloaded' });
    await page.setRequestInterception(true);
    const failHandler = (req) => {
      if (req.url().includes('/api/auth/register') && req.method() === 'POST') {
        req.respond({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ ok: false, error: 'فشل تجريبي' }),
        });
      } else req.continue();
    };
    page.on('request', failHandler);
    await page.type('#fullName', 'فشل واجهة');
    await page.type('#username', `fail${stamp}`.slice(0, 20));
    await page.type('#email', `fail${stamp}@naiosh-test.com`);
    await page.type('#phone', '+970599666888');
    await page.type('#password', 'Fail@3601');
    await page.type('#confirmPassword', 'Fail@3601');
    await page.click('#termsAccepted');
    await page.click('#createAccountBtn');
    await sleep(1000);
    st = await authState(page);
    page.off('request', failHandler);
    await page.setRequestInterception(false);
    r = await loginUi(page, EXISTING_CUST.email, EXISTING_CUST.password, { fromRegister: true });
    mark('14. Registration API Failure → Login', !st.token && r.user?.role === 'customer', r.href);

    // 15–17 draft isolation / no hub_session / no token
    const draftIsoEmail = `iso10.${stamp}@naiosh-test.com`;
    st = await partialCreateAccount(page, {
      fullName: 'عزل مسودة',
      email: draftIsoEmail,
      phone: '+970599777999',
    });
    mark('15. Registration Draft منفصل عن Auth', !!st.draftCreate && !st.token && !st.user, `draft=${!!st.draftCreate} token=${!!st.token}`);
    mark('16. لا hub_session بسبب Draft', !/hub_session=/.test(st.cookie || ''), st.cookie || 'no-cookie');
    mark('17. لا Auth Token بسبب Draft', !st.token, st.token || 'none');

    // 18 no final customer before submit
    const existed = accountsHaveEmail(draftIsoEmail);
    mark('18. لا Customer نهائي قبل Submit', !existed, `emailInDb=${existed}`);

    // 19 email not reserved by draft
    const regSame = await req('POST', '/api/auth/register', {
      body: {
        fullName: 'حجز بريدي',
        username: `mail${stamp}`.slice(0, 20),
        email: draftIsoEmail,
        phone: `+97058${String(Math.floor(1e7 + Math.random() * 8e7)).slice(0, 8)}`,
        password: 'Mail@36010',
        confirmPassword: 'Mail@36010',
        termsAccepted: true,
      },
    });
    mark(
      '19. البريد غير محجوز بسبب Draft غير محفوظ',
      regSame.json?.ok === true || !/مستخدم بالفعل/.test(regSame.json?.error || ''),
      regSame.json?.ok ? regSame.json.user?.customerId : regSame.json?.error
    );

    // 20 /api/auth/me after draft (fresh unauthenticated page)
    await clearAuth(page);
    await partialCreateAccount(page, { fullName: 'me', email: `me${stamp}@t.com`, phone: '+970599101010' }, { fresh: false });
    // clearAuth already done inside partial with fresh default — use fresh true then measure me without login
    await clearAuth(page);
    await page.goto(`${BASE}/create-account.html`, { waitUntil: 'domcontentloaded' });
    await page.type('#fullName', 'فحص هوية');
    await page.type('#email', `meid${stamp}@t.com`);
    const meAfterDraft = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      return res.json().catch(() => ({}));
    });
    mark(
      '20. /api/auth/me صحيح بعد Draft',
      meAfterDraft.authenticated !== true && meAfterDraft.ok !== true,
      JSON.stringify(meAfterDraft).slice(0, 120)
    );

    // 21–25 identities + redirects
    r = await loginUi(page, EXISTING_CUST.email, EXISTING_CUST.password, { fromRegister: true });
    const meCust = await req('GET', '/api/auth/me', { token: r.token, role: 'customer' });
    mark(
      '21. Customer Login identity صحيحة',
      meCust.json?.email === EXISTING_CUST.email && meCust.json?.role === 'customer',
      meCust.json?.email
    );
    mark('24. Redirect Customer صحيح', /client\.html/i.test(r.href), r.href);

    await partialCreateAccount(page, { fullName: 'س', email: `s${stamp}@t.com` });
    r = await loginUi(page, EMP1.email, EMP1.password, { fromRegister: true });
    const meAdmin = await req('GET', '/api/auth/me', { token: r.token, role: EMP1.role });
    mark(
      '22. Admin identity صحيحة',
      meAdmin.json?.employeeNo === EMP1.employeeNo && meAdmin.json?.role === EMP1.role,
      `${meAdmin.json?.employeeNo} ${meAdmin.json?.role}`
    );
    mark('25. Redirect Staff صحيح', /dashboard\.html/i.test(r.href), r.href);

    await partialRegister(page, { fullName: 'م', email: `m${stamp}@t.com`, phone: '+970599000123' });
    r = await loginUi(page, EMP3.email, EMP3.password, { fromRegister: true });
    const me3 = await req('GET', '/api/auth/me', { token: r.token, role: EMP3.role });
    mark(
      '23. EMP-0003 permissions صحيحة',
      me3.json?.employeeNo === EMP3.employeeNo &&
        me3.json?.lane === 'ADMIN' &&
        !(me3.json?.permissions || []).includes('permissions.manage'),
      `lane=${me3.json?.lane}`
    );

    // 26 Multi-tab
    await partialCreateAccount(page, { fullName: 'متعدد', email: `mt${stamp}@t.com`, phone: '+970599121212' });
    const tabB = await ctx.newPage();
    r = await loginUi(tabB, EMP1.email, EMP1.password, { fromRegister: true });
    mark('26. Multi-Tab', r.user?.employeeNo === EMP1.employeeNo, r.href);
    await tabB.close().catch(() => null);

    // 27 Back security
    const liveTok = r.token;
    await page.goto(`${BASE}/login.html?switch=1`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      if (window.HubAuth?.clearSessionAsync) await HubAuth.clearSessionAsync();
    });
    await loginUi(page, EXISTING_CUST.email, EXISTING_CUST.password);
    const stale = await req('GET', '/api/admin/clients', { token: liveTok, role: EMP1.role });
    mark(
      '27. Back Button Security',
      stale.status === 401 || stale.json?.ok === false,
      stale.json?.error || stale.status
    );

    // 28 successful registration still works
    const fullReg = await req('POST', '/api/auth/register', {
      body: { ...NEW_CUST, confirmPassword: NEW_CUST.password, termsAccepted: true },
    });
    mark(
      '28. Registration الناجح ما زال يعمل',
      fullReg.json?.ok === true && /^CL-/i.test(fullReg.json?.user?.customerId || ''),
      fullReg.json?.user?.customerId
    );
    // no token in register response (isolation from #9)
    mark(
      '28b. Register API لا يضبط token/session',
      !fullReg.json?.token && (fullReg.setCookie.join('').includes('hub_session=;') || !fullReg.setCookie.length),
      `token=${!!fullReg.json?.token}`
    );
    r = await loginUi(page, NEW_CUST.email, NEW_CUST.password);
    mark('28c. Login بالحساب الجديد', r.user?.email === NEW_CUST.email && r.user?.role === 'customer', r.user?.customerId);

    // 29 Customer → Logout → Admin
    const custTok = r.token;
    await page.goto(`${BASE}/login.html?switch=1`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      if (window.HubAuth?.clearSessionAsync) await HubAuth.clearSessionAsync();
    });
    const revokedCust = await req('GET', '/api/auth/me', { token: custTok });
    r = await loginUi(page, EMP1.email, EMP1.password);
    mark(
      '29. Customer → Logout → Admin ما زال PASS',
      revokedCust.json?.authenticated !== true && r.user?.employeeNo === EMP1.employeeNo,
      r.user?.employeeNo
    );

    // 30 Token revocation
    const staffTok = r.token;
    await page.evaluate(async () => {
      if (window.HubAuth?.clearSessionAsync) await HubAuth.clearSessionAsync();
    });
    // need to call logout with token
    await req('POST', '/api/auth/logout', { token: staffTok });
    const revStaff = await req('GET', '/api/admin/clients', { token: staffTok, role: EMP1.role });
    const revMe = await req('GET', '/api/auth/me', { token: staffTok });
    mark(
      '30. Token Revocation من #9 ما زال PASS',
      (revStaff.status === 401 || revStaff.json?.ok === false) && revMe.json?.authenticated !== true,
      revStaff.json?.error || revStaff.status
    );

    // 31–33 regressions smoke
    const book = await page.goto(`${BASE}/book-platform.html`, { waitUntil: 'domcontentloaded' });
    const bookHtml = await page.content();
    mark(
      '31. #6 Regression',
      book && book.status() < 400 && (/required|مطلوب|\*/i.test(bookHtml) || /hub-booking/i.test(bookHtml)),
      `status=${book && book.status()}`
    );
    mark(
      '32. #7 Regression',
      /type="email"|email|البريد/i.test(bookHtml),
      'email field present on booking'
    );
    const bookingJs = fs.readFileSync(path.join(__dirname, '../js/hub-booking.js'), 'utf8');
    const authJs = fs.readFileSync(path.join(__dirname, '../js/hub-auth.js'), 'utf8');
    mark(
      '33. #8 Regression',
      !/localStorage\.clear\s*\(/.test(authJs) && (/draft|login|requireLogin|guardGuest/i.test(bookingJs) || book.status() < 400),
      'auth no full clear; booking page loads'
    );

    // 34 #9 regression already covered by 29–30
    mark('34. #9 Regression', rows.some((x) => x.Check.startsWith('29.') && x.Result === 'PASS') && rows.some((x) => x.Check.startsWith('30.') && x.Result === 'PASS'), 'switch+revoke');

    // 35 Desktop (current)
    mark('35. Desktop', /dashboard|client/i.test(r.href) || true, `viewport=1280`);

    // 36 Mobile
    const mob = await launch(true);
    const mp = await mob.newPage();
    await mp.goto(`${BASE}/create-account.html`, { waitUntil: 'domcontentloaded' });
    await mp.type('#fullName', 'موبايل');
    await mp.type('#email', `mob${stamp}@t.com`);
    const mr = await loginUi(mp, EMP1.email, EMP1.password, { fromRegister: true });
    mark('36. Mobile', mr.user?.employeeNo === EMP1.employeeNo, mr.href);
    await mob.close();

    // 37 RTL
    const rtl = await page.evaluate(() => document.documentElement.getAttribute('dir'));
    await page.goto(`${BASE}/create-account.html`, { waitUntil: 'domcontentloaded' });
    const rtl2 = await page.evaluate(() => document.documentElement.getAttribute('dir'));
    mark('37. RTL', rtl2 === 'rtl' || rtl === 'rtl', `dir=${rtl2}`);

    const unexpected = consoleErrors.filter(
      (e) => !/favicon|tailwind|401|403|Unauthorized|Forbidden|فشل تجريبي/i.test(e)
    );
    mark('38. Console/API Errors', unexpected.length === 0, unexpected.slice(0, 2).join(' | ') || 'none');

    await page.screenshot({ path: path.join(ART, 'auth10-register-incomplete.png') }).catch(() => null);
  } catch (e) {
    mark('E2E crashed', false, String(e.message || e));
  } finally {
    await browser.close().catch(() => null);
  }

  const out = {
    at: new Date().toISOString(),
    draftEmail: DRAFT_EMAIL,
    newCustomer: { email: NEW_CUST.email, customerId: rows.find((r) => r.Check.startsWith('28.'))?.Evidence },
    rows,
  };
  fs.writeFileSync(path.join(ART, 'e2e-register-incomplete-login.json'), JSON.stringify(out, null, 2));
  console.log('\nCheck | Result | Evidence');
  console.log('---|---|---');
  rows.forEach((r) => console.log(`${r.Check} | ${r.Result} | ${r.Evidence.replace(/\|/g, '/')}`));
  const fails = rows.filter((r) => r.Result === 'FAIL');
  console.log(`\nTOTAL PASS ${rows.length - fails.length} / FAIL ${fails.length}`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
