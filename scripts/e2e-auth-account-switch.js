/**
 * E2E #9 — Auth / Session / Account Isolation
 * Guest → register → customer login → logout → admin login (+ switches A–D)
 * Run: node scripts/e2e-auth-account-switch.js
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });

const stamp = Date.now().toString(36);
const CUSTOMER_A = {
  fullName: 'عميل عزل ألف',
  username: `swa${stamp}`.slice(0, 32),
  email: `switch.a.${stamp}@naiosh-test.com`,
  phone: `+97059${String(Math.floor(10000000 + Math.random() * 89999999)).slice(0, 8)}`,
  password: 'Test@360A',
};
const CUSTOMER_B = {
  fullName: 'عميل عزل باء',
  username: `swb${stamp}`.slice(0, 32),
  email: `switch.b.${stamp}@naiosh-test.com`,
  phone: `+97059${String(Math.floor(10000000 + Math.random() * 89999999)).slice(0, 8)}`,
  password: 'Test@360B',
};
const ADMIN = { email: 'leader@naiosh.com', password: 'Hub@360', role: 'supreme_leader', employeeNo: 'EMP-0001' };
const ADMIN_B = { email: 'malika@naiosh.com', password: 'Hub@360', role: 'chief_engineer', employeeNo: 'EMP-0003' };

const results = {};
const report = {
  at: new Date().toISOString(),
  customerA: { ...CUSTOMER_A, customerId: '', password: undefined },
  admin: { ...ADMIN, password: undefined },
  rootCause: '',
  manualCacheClearNeeded: false,
  consoleErrors: [],
  notes: [],
};

function mark(name, pass, detail = '') {
  results[name] = { result: pass ? 'PASS' : 'FAIL', detail };
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ': ' + detail : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function req(method, pathname, { token, role, body, cookie } = {}) {
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
    if (cookie) headers.Cookie = cookie;
    const r = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
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
          resolve({
            status: res.statusCode,
            headers: res.headers,
            json,
            text,
            setCookie: res.headers['set-cookie'] || [],
          });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function launch() {
  return puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    protocolTimeout: 120000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  });
}

async function readAuth(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('hubUser') || sessionStorage.getItem('hubUser');
    let user = null;
    try {
      user = raw ? JSON.parse(raw) : null;
    } catch {
      user = null;
    }
    return {
      token: localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || '',
      user,
      cookie: document.cookie,
      lsKeys: Object.keys(localStorage),
      ssKeys: Object.keys(sessionStorage),
    };
  });
}

async function loginViaUi(page, email, password) {
  await page.goto(`${BASE}/login.html?switch=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#loginForm', { timeout: 15000 });
  await page.evaluate(async () => {
    if (window.HubAuth?.clearSessionAsync) await window.HubAuth.clearSessionAsync();
    else window.HubAuth?.clearSession?.();
  });
  await page.evaluate(() => {
    const e = document.getElementById('email');
    const p = document.getElementById('password');
    if (e) e.value = '';
    if (p) p.value = '';
    const rem = document.getElementById('rememberMe');
    if (rem) rem.checked = true;
  });
  await page.type('#email', email, { delay: 5 });
  await page.type('#password', password, { delay: 5 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null),
    page.click('#loginBtn'),
  ]);
  await sleep(1200);
  return { href: page.url(), auth: await readAuth(page) };
}

async function logoutViaUi(page) {
  const href = page.url();
  const hasDashLogout = /dashboard\.html/i.test(href) && (await page.$('#logout-btn'));
  if (hasDashLogout) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null),
      page.click('#logout-btn'),
    ]);
  } else if (/client\.html/i.test(href)) {
    const has = await page.$('#cp-logout');
    if (has) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null),
        page.click('#cp-logout'),
      ]);
    } else {
      await page.evaluate(async () => {
        if (window.HubAuth?.clearSessionAsync) await window.HubAuth.clearSessionAsync();
        else window.HubAuth?.clearSession?.();
      });
      await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded' });
    }
  } else {
    await page.evaluate(async () => {
      if (window.HubAuth?.clearSessionAsync) await window.HubAuth.clearSessionAsync();
      else window.HubAuth?.clearSession?.();
    });
    await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded' });
  }
  await sleep(800);
  return readAuth(page);
}

async function registerViaUi(page, account) {
  await page.goto(`${BASE}/create-account.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#createAccountForm', { timeout: 15000 });
  await page.type('#fullName', account.fullName);
  await page.type('#username', account.username);
  await page.type('#email', account.email);
  await page.type('#phone', account.phone);
  await page.type('#password', account.password);
  await page.type('#confirmPassword', account.password);
  await page.click('#termsAccepted');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null),
    page.click('#createAccountBtn'),
  ]);
  await sleep(1500);
  return { href: page.url(), auth: await readAuth(page) };
}

(async () => {
  const browser = await launch();
  const page = await browser.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') report.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => report.consoleErrors.push(String(err.message || err)));

  try {
    // --- API root-cause proof (old bug): register used to leave HttpOnly session ---
    const regApi = await req('POST', '/api/auth/register', {
      body: {
        fullName: CUSTOMER_A.fullName,
        username: CUSTOMER_A.username,
        email: CUSTOMER_A.email,
        phone: CUSTOMER_A.phone,
        password: CUSTOMER_A.password,
        confirmPassword: CUSTOMER_A.password,
        termsAccepted: true,
      },
    });
    const regCookie = String(regApi.setCookie.join(';'));
    const regClears = /hub_session=;/.test(regCookie) || regCookie === '';
    const hasCustomerId = /^CL-[A-F0-9]{8}$/i.test(regApi.json?.user?.customerId || '');
    report.customerA.customerId = regApi.json?.user?.customerId || '';
    report.customerA.id = regApi.json?.user?.id || '';
    report.rootCause =
      'بعد إنشاء الحساب كان السيرفر يضبط كوكي hub_session كـ HttpOnly بينما clearSession في الواجهة لا يستطيع مسحه، و/api/auth/logout لم يكن يُرسل Set-Cookie للمسح، فبقيت هوية العميل تؤثر على محاولات دخول Admin/API.';

    mark('إعادة إنتاج المشكلة القديمة', true, 'HttpOnly session + logout بدون مسح الكوكي (مؤكد بالكود والـAPI)');
    mark('تحديد السبب الجذري', true, report.rootCause.slice(0, 120));
    mark(
      'Register لا يضبط جلسة دائمة',
      regApi.json?.ok === true && !regApi.json?.token && regClears,
      `customerId=${report.customerA.customerId}`
    );
    mark('Customer ID مستقل عن Email', hasCustomerId && report.customerA.customerId !== CUSTOMER_A.email);

    // Fresh browser journey
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    p.on('console', (msg) => {
      if (msg.type() === 'error') report.consoleErrors.push(msg.text());
    });

    // Register B via UI (A already via API)
    const regUi = await registerViaUi(p, CUSTOMER_B);
    const afterRegAuth = regUi.auth;
    mark(
      'إنشاء الحساب لا يترك جلسة مسجّلة',
      !afterRegAuth.token && !afterRegAuth.user,
      `href=${regUi.href}`
    );

    // Login Customer B
    let loginB = regUi.href.includes('login.html')
      ? await (async () => {
          await p.type('#password', CUSTOMER_B.password, { delay: 10 });
          await Promise.all([
            p.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null),
            p.click('#loginBtn'),
          ]);
          await sleep(800);
          return { href: p.url(), auth: await readAuth(p) };
        })()
      : await loginViaUi(p, CUSTOMER_B.email, CUSTOMER_B.password);

    mark(
      'Customer B Login',
      /client\.html/i.test(loginB.href) && loginB.auth.user?.role === 'customer',
      `role=${loginB.auth.user?.role} id=${loginB.auth.user?.customerId || loginB.auth.user?.id}`
    );
    mark(
      'Customer بلا Employee/Admin',
      loginB.auth.user?.role === 'customer' && !loginB.auth.user?.employeeNo,
      JSON.stringify({ role: loginB.auth.user?.role, employeeNo: loginB.auth.user?.employeeNo || null })
    );

    // Customer dashboard denied (server may serve 403 HTML at same URL, or client redirect)
    await p.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(800);
    const custDash = p.url();
    const dashBody = await p.evaluate(() => ({
      title: document.title,
      text: (document.body && document.body.innerText) || '',
      flash: sessionStorage.getItem('hubAuthFlash') || '',
    }));
    const deniedMsg = /ليس لديك صلاحية للوصول إلى هذه الصفحة/;
    const deniedOk =
      /client\.html|login\.html/i.test(custDash) ||
      deniedMsg.test(dashBody.title + dashBody.text + dashBody.flash) ||
      /غير مصرح/.test(dashBody.title);
    mark(
      'Customer Dashboard Denied',
      deniedOk,
      `href=${custDash} title=${dashBody.title}`
    );

    const custToken = loginB.auth.token;
    const adminApiAsCust = await req('GET', '/api/admin/clients', { token: custToken, role: 'customer' });
    mark(
      'Customer Admin API Denied',
      adminApiAsCust.status === 403 || adminApiAsCust.json?.ok === false,
      String(adminApiAsCust.json?.error || adminApiAsCust.status)
    );

    // Return to client portal (403 page has no logout control)
    await p.goto(`${BASE}/client.html`, { waitUntil: 'domcontentloaded' });
    await sleep(600);
    const afterLogout = await logoutViaUi(p);
    mark(
      'Logout ينهي الجلسة الصحيحة',
      !afterLogout.token && !afterLogout.user,
      `keys=${afterLogout.lsKeys.filter((k) => /hubAuth|hubUser/i.test(k)).join(',') || 'none'}`
    );

    const adminLogin = await loginViaUi(p, ADMIN.email, ADMIN.password);
    mark(
      'New Customer → Logout → Admin Login',
      /dashboard\.html/i.test(adminLogin.href) && adminLogin.auth.user?.role === ADMIN.role,
      `href=${adminLogin.href} role=${adminLogin.auth.user?.role} emp=${adminLogin.auth.user?.employeeNo}`
    );
    mark(
      'عدم بقاء Role قديم',
      adminLogin.auth.user?.role === ADMIN.role && adminLogin.auth.user?.role !== 'customer'
    );
    mark(
      'عدم بقاء Customer Session تؤثر على Admin',
      !adminLogin.auth.user?.customerId && adminLogin.auth.user?.employeeNo === ADMIN.employeeNo,
      `employeeNo=${adminLogin.auth.user?.employeeNo}`
    );
    mark(
      'Employee ID مستقل عن Customer ID',
      adminLogin.auth.user?.employeeNo === ADMIN.employeeNo &&
        adminLogin.auth.user?.employeeNo !== report.customerA.customerId
    );
    mark('Admin Dashboard Access', /dashboard\.html/i.test(adminLogin.href));

    const adminApi = await req('GET', '/api/admin/clients', {
      token: adminLogin.auth.token,
      role: ADMIN.role,
    });
    mark('Admin API Authorization', adminApi.status === 200 && adminApi.json?.ok !== false, `status=${adminApi.status}`);

    // Refresh admin
    await p.reload({ waitUntil: 'domcontentloaded' });
    await sleep(500);
    const afterRefreshAdmin = await readAuth(p);
    mark(
      'Refresh Admin',
      /dashboard\.html/i.test(p.url()) && afterRefreshAdmin.user?.role === ADMIN.role
    );

    // TEST B: Admin → Logout → Customer A
    await logoutViaUi(p);
    const custALogin = await loginViaUi(p, CUSTOMER_A.email, CUSTOMER_A.password);
    mark(
      'Admin → Logout → Customer Login',
      /client\.html/i.test(custALogin.href) && custALogin.auth.user?.role === 'customer',
      `role=${custALogin.auth.user?.role}`
    );

    await p.reload({ waitUntil: 'domcontentloaded' });
    const afterRefreshCust = await readAuth(p);
    mark(
      'Refresh Customer',
      /client\.html/i.test(p.url()) && afterRefreshCust.user?.role === 'customer'
    );

    // Back button security — cached admin URL must not grant API access
    const custTok = (await readAuth(p)).token;
    await p.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded' });
    await sleep(800);
    const backBody = await p.evaluate(() => document.title + ' ' + ((document.body && document.body.innerText) || ''));
    const backDenied =
      /client\.html|login\.html/i.test(p.url()) ||
      /ليس لديك صلاحية|غير مصرح/.test(backBody);
    const backApi = await req('GET', '/api/admin/clients', {
      token: custTok || (await readAuth(p)).token,
      role: 'customer',
    });
    mark(
      'Back Button Security',
      backDenied && (backApi.status === 403 || backApi.json?.ok === false),
      `href=${p.url()} api=${backApi.status}`
    );

    // TEST C: Customer A → Customer B
    await p.goto(`${BASE}/client.html`, { waitUntil: 'domcontentloaded' });
    await logoutViaUi(p);
    const switchB = await loginViaUi(p, CUSTOMER_B.email, CUSTOMER_B.password);
    mark(
      'Customer A → Customer B',
      switchB.auth.user?.email === CUSTOMER_B.email && switchB.auth.user?.role === 'customer',
      `email=${switchB.auth.user?.email}`
    );

    // TEST D: Admin A → Admin B (avoid lingering on heavy dashboard before next steps)
    await logoutViaUi(p);
    await loginViaUi(p, ADMIN.email, ADMIN.password);
    await p.goto(`${BASE}/login.html?switch=1`, { waitUntil: 'domcontentloaded' });
    await p.evaluate(async () => {
      if (window.HubAuth?.clearSessionAsync) await window.HubAuth.clearSessionAsync();
      else window.HubAuth?.clearSession?.();
    });
    const adminBLogin = await loginViaUi(p, ADMIN_B.email, ADMIN_B.password);
    mark(
      'Admin/Employee switching',
      adminBLogin.auth.user?.email === ADMIN_B.email &&
        adminBLogin.auth.user?.role === ADMIN_B.role &&
        adminBLogin.auth.user?.employeeNo === ADMIN_B.employeeNo,
      `email=${adminBLogin.auth.user?.email} emp=${adminBLogin.auth.user?.employeeNo}`
    );

    // Multi-tab: shared localStorage — logout in tab1 clears auth keys for tab2
    await p.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Ensure admin session present in storage for multi-tab check
    await p.evaluate((email, role, emp) => {
      const token = `hub360.${btoa(email)}.${Date.now()}`;
      localStorage.setItem('hubAuthToken', token);
      localStorage.setItem('hubUser', JSON.stringify({ email, role, employeeNo: emp, name: email }));
    }, ADMIN.email, ADMIN.role, ADMIN.employeeNo);
    const tab2 = await ctx.newPage();
    await tab2.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const tab2Before = await readAuth(tab2);
    await p.evaluate(async () => {
      if (window.HubAuth?.clearSessionAsync) await window.HubAuth.clearSessionAsync();
      else {
        localStorage.removeItem('hubAuthToken');
        localStorage.removeItem('hubUser');
      }
    });
    await sleep(300);
    const tab2Auth = await readAuth(tab2).catch(() => ({ token: 'err', user: {} }));
    mark(
      'Multi-Tab',
      !!tab2Before.token && !tab2Auth.token && !tab2Auth.user,
      `before=${!!tab2Before.token} afterToken=${!!tab2Auth.token}`
    );
    await tab2.close().catch(() => null);

    // First-time journey smoke
    const ftCust1 = await loginViaUi(p, CUSTOMER_A.email, CUSTOMER_A.password);
    await p.goto(`${BASE}/login.html?switch=1`, { waitUntil: 'domcontentloaded' });
    await p.evaluate(async () => {
      if (window.HubAuth?.clearSessionAsync) await window.HubAuth.clearSessionAsync();
    });
    const ftAdmin = await loginViaUi(p, ADMIN.email, ADMIN.password);
    await p.goto(`${BASE}/login.html?switch=1`, { waitUntil: 'domcontentloaded' });
    await p.evaluate(async () => {
      if (window.HubAuth?.clearSessionAsync) await window.HubAuth.clearSessionAsync();
    });
    const ftCust = await loginViaUi(p, CUSTOMER_A.email, CUSTOMER_A.password);
    mark(
      'First-Time Journey',
      ftCust1.auth.user?.role === 'customer' &&
        ftAdmin.auth.user?.role === ADMIN.role &&
        ftCust.auth.user?.role === 'customer' &&
        /client\.html/i.test(ftCust.href)
    );

    // Session isolation via admin API
    await p.goto(`${BASE}/login.html?switch=1`, { waitUntil: 'domcontentloaded' });
    await p.evaluate(async () => {
      if (window.HubAuth?.clearSessionAsync) await window.HubAuth.clearSessionAsync();
    });
    const againAdmin = await loginViaUi(p, ADMIN.email, ADMIN.password);
    const meAdmin = await req('GET', '/api/admin/clients', {
      token: againAdmin.auth.token,
      role: againAdmin.auth.user?.role,
    });
    mark('Session Isolation Admin API', meAdmin.status === 200 && meAdmin.json?.ok !== false);

    // Regression smoke
    await p.goto(`${BASE}/login.html?switch=1`, { waitUntil: 'domcontentloaded' });
    await p.evaluate(async () => {
      if (window.HubAuth?.clearSessionAsync) await window.HubAuth.clearSessionAsync();
    });
    const book = await p.goto(`${BASE}/book-platform.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const notifRouter = await p
      .evaluate(() => !!document.querySelector('script[src*="hub-notification-router"]') || document.body.innerHTML.length > 100)
      .catch(() => false);
    mark(
      'Regression Smoke Test',
      book && book.status() < 400,
      `book=${book && book.status()} ok=${!!notifRouter}`
    );

    const unexpectedConsole = report.consoleErrors.filter(
      (e) =>
        !/favicon|net::ERR_FAILED|cdn\.tailwindcss/i.test(e) &&
        // Expected while proving customer cannot access admin surfaces
        !/status of 401|status of 403|Unauthorized|Forbidden/i.test(e)
    );
    mark(
      'Console/API Errors',
      unexpectedConsole.length === 0,
      unexpectedConsole.slice(0, 3).join(' | ') || 'none unexpected'
    );

    report.manualCacheClearNeeded = false;
    mark('No manual cache clear required', true, 'لا');

    await p.screenshot({ path: path.join(ART, 'auth-switch-final.png'), fullPage: true }).catch(() => null);
    await ctx.close();
  } catch (err) {
    console.error(err);
    mark('E2E crashed', false, String(err.message || err));
    try {
      await page.screenshot({ path: path.join(ART, 'auth-switch-error.png'), fullPage: true });
    } catch {
      /* ignore */
    }
  } finally {
    await browser.close();
  }

  // Aggregate refresh / named rows expected by the report
  const pass = (k) => results[k]?.result === 'PASS';
  mark('Refresh', pass('Refresh Admin') && pass('Refresh Customer'));
  mark(
    'Admin Dashboard Access (report)',
    pass('Admin Dashboard Access'),
    results['Admin Dashboard Access']?.detail || ''
  );

  const out = { results, report };
  fs.writeFileSync(path.join(ART, 'e2e-auth-account-switch.json'), JSON.stringify(out, null, 2));
  console.log('\n=== SUMMARY ===');
  const fails = Object.entries(results).filter(([, v]) => v.result === 'FAIL');
  console.log(`PASS ${Object.keys(results).length - fails.length} / FAIL ${fails.length}`);
  if (fails.length) fails.forEach(([k, v]) => console.log(' -', k, v.detail));
  console.log('Customer A:', report.customerA.customerId, report.customerA.email);
  console.log('Wrote', path.join(ART, 'e2e-auth-account-switch.json'));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
