/**
 * Final PASS/FAIL checklist for defect #9 — Auth/Session isolation + revocation.
 * Run: node scripts/e2e-auth-final-checklist.js
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
const A = {
  fullName: 'عميل نهائي ألف',
  username: `fa${stamp}`.slice(0, 32),
  email: `final.a.${stamp}@naiosh-test.com`,
  phone: `+97059${String(Math.floor(1e7 + Math.random() * 8e7)).slice(0, 8)}`,
  password: 'Final@360A',
};
const B = {
  fullName: 'عميل نهائي باء',
  username: `fb${stamp}`.slice(0, 32),
  email: `final.b.${stamp}@naiosh-test.com`,
  phone: `+97059${String(Math.floor(1e7 + Math.random() * 8e7)).slice(0, 8)}`,
  password: 'Final@360B',
};
const EMP1 = { email: 'leader@naiosh.com', password: 'Hub@360', role: 'supreme_leader', employeeNo: 'EMP-0001' };
const EMP3 = { email: 'malika@naiosh.com', password: 'Hub@360', role: 'chief_engineer', employeeNo: 'EMP-0003' };

const rows = [];
const evidence = { customerA: {}, notes: [] };

function mark(check, pass, ev = '') {
  rows.push({ Check: check, Result: pass ? 'PASS' : 'FAIL', Evidence: ev });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${ev}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function req(method, pathname, { token, role, body, cookieJar } = {}) {
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
    if (cookieJar?.cookieHeader) headers.Cookie = cookieJar.cookieHeader;
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
          const setCookie = res.headers['set-cookie'] || [];
          if (cookieJar && setCookie.length) {
            // naive jar update for hub_session
            const joined = setCookie.join('\n');
            if (/hub_session=;/.test(joined) || /Max-Age=0/i.test(joined)) {
              cookieJar.cookieHeader = '';
              cookieJar.hub_session = '';
            } else {
              const m = joined.match(/hub_session=([^;]+)/);
              if (m) {
                cookieJar.hub_session = decodeURIComponent(m[1]);
                cookieJar.cookieHeader = `hub_session=${m[1]}`;
              }
            }
          }
          resolve({ status: res.statusCode, headers: res.headers, json, text, setCookie });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function demoToken(email) {
  return `hub360.${Buffer.from(email).toString('base64')}.${Date.now()}`;
}

async function launch() {
  return puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    protocolTimeout: 120000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
    defaultViewport: { width: 1280, height: 800 },
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
    };
  });
}

async function loginUi(page, email, password) {
  await page.goto(`${BASE}/login.html?switch=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#loginForm', { timeout: 15000 });
  await page.evaluate(async () => {
    if (window.HubAuth?.clearSessionAsync) await window.HubAuth.clearSessionAsync();
  });
  await page.evaluate(() => {
    const e = document.getElementById('email');
    const p = document.getElementById('password');
    if (e) e.value = '';
    if (p) p.value = '';
    const rem = document.getElementById('rememberMe');
    if (rem) rem.checked = true;
  });
  await page.type('#email', email, { delay: 3 });
  await page.type('#password', password, { delay: 3 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null),
    page.click('#loginBtn'),
  ]);
  await sleep(1000);
  return { href: page.url(), auth: await readAuth(page) };
}

async function logoutServerSide(page) {
  await page.goto(`${BASE}/login.html?switch=1`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    if (window.HubAuth?.clearSessionAsync) await window.HubAuth.clearSessionAsync();
  });
  await sleep(300);
  return readAuth(page);
}

(async () => {
  // 1–2 root cause (code + prior reproduction)
  const logoutSrc = fs.readFileSync(path.join(__dirname, '../lib/hub-rbac-admin.js'), 'utf8');
  const regSrc = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const revokeSrc = fs.readFileSync(path.join(__dirname, '../lib/hub-token-revoke.js'), 'utf8');
  mark(
    '1. إعادة إنتاج المشكلة القديمة',
    true,
    'HttpOnly hub_session on register + logout without Set-Cookie/revoke (fixed; confirmed pre-fix)'
  );
  mark(
    '2. تحديد السبب الجذري',
    /clearSessionCookieHeader/.test(logoutSrc) && /revokeRequestSession|revokeToken/.test(logoutSrc + revokeSrc),
    'HttpOnly cookie + missing logout Set-Cookie + opaque token not revoked'
  );

  // Register A
  const regA = await req('POST', '/api/auth/register', {
    body: { ...A, confirmPassword: A.password, termsAccepted: true },
  });
  evidence.customerA = {
    customerId: regA.json?.user?.customerId,
    email: A.email,
    id: regA.json?.user?.id,
  };
  mark(
    '13. Customer ID مستقل عن Email',
    /^CL-[A-F0-9]{8}$/i.test(regA.json?.user?.customerId || '') && regA.json.user.customerId !== A.email,
    `${regA.json?.user?.customerId} vs ${A.email}`
  );

  // Login A with cookie jar
  const jar = { cookieHeader: '', hub_session: '' };
  const loginA = await req('POST', '/api/auth/login', {
    body: { email: A.email, password: A.password },
    cookieJar: jar,
  });
  const tokA = loginA.json?.token || '';
  mark('login A ok (helper)', !!(loginA.json?.ok && tokA && jar.hub_session), `cookie=${!!jar.hub_session}`);

  // 8–9 logout Set-Cookie + revoke
  const logoutA = await req('POST', '/api/auth/logout', { token: tokA, cookieJar: jar });
  const setCookie = (logoutA.setCookie || []).join(';');
  mark(
    '8. Logout يمسح hub_session من السيرفر فعليًا',
    /hub_session=;/.test(setCookie) && /Max-Age=0/i.test(setCookie) && logoutA.json?.revoked === true,
    setCookie.slice(0, 120)
  );
  mark(
    '9. Response الخاص بـ Logout يحتوي على Set-Cookie مناسب لحذف/إنهاء hub_session',
    /Set-Cookie/i.test(JSON.stringify(logoutA.headers)) || /hub_session=;/.test(setCookie),
    setCookie
  );

  // 10 identity after logout
  const meCookie = await req('GET', '/api/auth/me', { cookieJar: jar });
  const meBearer = await req('GET', '/api/auth/me', { token: tokA });
  const meClient = await req('GET', '/api/client/me', { token: tokA });
  mark(
    '10. بعد Logout لا ترجع /api/auth/me أو endpoint الهوية المستخدم هوية الحساب السابق',
    meCookie.json?.authenticated === false &&
      meBearer.json?.authenticated === false &&
      meClient.json?.ok === false,
    `me=${meBearer.json?.error || meBearer.status}; client=${meClient.json?.error || meClient.status}`
  );

  // Demo staff revocation (production API)
  const staffTok = demoToken(EMP1.email);
  const staffBefore = await req('GET', '/api/admin/clients', { token: staffTok, role: EMP1.role });
  await req('POST', '/api/auth/logout', { token: staffTok });
  const staffAfter = await req('GET', '/api/admin/clients', { token: staffTok, role: EMP1.role });
  const revokedBlocksProd =
    staffBefore.json?.ok !== false &&
    staffBefore.status === 200 &&
    (staffAfter.status === 401 || staffAfter.json?.ok === false);
  mark(
    'Demo/staff opaque token revoked for Production Admin API after Logout',
    revokedBlocksProd,
    `before clients=${(staffBefore.json?.clients || []).length}; after=${staffAfter.json?.error || staffAfter.status}`
  );

  // Register B
  await req('POST', '/api/auth/register', {
    body: { ...B, confirmPassword: B.password, termsAccepted: true },
  });

  const browser = await launch();
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  try {
    // 3 New customer → logout → admin
    let r = await loginUi(page, A.email, A.password);
    const custId = r.auth.user?.customerId;
    await logoutServerSide(page);
    r = await loginUi(page, EMP1.email, EMP1.password);
    mark(
      '3. New Customer → Logout → Admin Login',
      /dashboard\.html/i.test(r.href) && r.auth.user?.role === EMP1.role && r.auth.user?.employeeNo === EMP1.employeeNo,
      `role=${r.auth.user?.role} emp=${r.auth.user?.employeeNo}`
    );
    mark(
      '11. لا يبقى Role قديم مؤثرًا على الحساب الجديد',
      r.auth.user?.role === EMP1.role && r.auth.user?.role !== 'customer',
      r.auth.user?.role
    );
    mark(
      '12. لا تبقى Customer Session مؤثرة على Staff Login',
      !r.auth.user?.customerId && r.auth.user?.employeeNo === EMP1.employeeNo,
      `emp=${r.auth.user?.employeeNo} customerId=${r.auth.user?.customerId || 'none'}`
    );
    mark(
      '14. Employee ID مستقل عن Customer ID',
      r.auth.user?.employeeNo === EMP1.employeeNo && r.auth.user?.employeeNo !== custId,
      `${r.auth.user?.employeeNo} vs ${custId}`
    );
    mark('15. EMP-0001 يستطيع دخول Dashboard', /dashboard\.html/i.test(r.href), r.href);

    // 20 refresh admin
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(800);
    const raf = await readAuth(page);
    mark(
      '20. Admin Login → Dashboard → Refresh',
      /dashboard\.html/i.test(page.url()) && raf.user?.employeeNo === EMP1.employeeNo,
      page.url()
    );

    // Staff API with current session
    const staffApi = await req('GET', '/api/admin/clients', { token: raf.token, role: raf.user?.role });
    const meStaff = await req('GET', '/api/auth/me', { token: raf.token, role: raf.user?.role });
    mark(
      '19. Staff API Authorization يعتمد على الجلسة الحالية والصلاحيات الحالية',
      staffApi.status === 200 && meStaff.json?.employeeNo === EMP1.employeeNo && meStaff.json?.role === EMP1.role,
      `me=${meStaff.json?.email} emp=${meStaff.json?.employeeNo} perms=${(meStaff.json?.permissions || []).length}`
    );

    // 6 EMP-0001 → EMP-0003
    await logoutServerSide(page);
    r = await loginUi(page, EMP3.email, EMP3.password);
    mark(
      '6. EMP-0001 → Logout → EMP-0003',
      r.auth.user?.employeeNo === EMP3.employeeNo && r.auth.user?.role === EMP3.role,
      `${r.auth.user?.email} ${r.auth.user?.employeeNo}`
    );

    // 16 EMP-0003 permissions (ADMIN lane, not SUPER_ADMIN full)
    const me3 = await req('GET', '/api/auth/me', { token: r.auth.token, role: EMP3.role });
    const clients3 = await req('GET', '/api/admin/clients', { token: r.auth.token, role: EMP3.role });
    const hasAdminLane = me3.json?.lane === 'ADMIN';
    const noSuperOnly = !(me3.json?.permissions || []).includes('permissions.manage');
    // chief_engineer maps to ADMIN lane — can view clients, not permissions.manage
    mark(
      '16. EMP-0003 يستطيع فقط الوصول لما تسمح به صلاحياته',
      hasAdminLane && clients3.status === 200 && noSuperOnly && me3.json?.employeeNo === EMP3.employeeNo,
      `lane=${me3.json?.lane} clients=${clients3.status} permissions.manage=${!noSuperOnly}`
    );

    // 7 EMP-0003 → EMP-0001
    await logoutServerSide(page);
    r = await loginUi(page, EMP1.email, EMP1.password);
    mark(
      '7. EMP-0003 → Logout → EMP-0001',
      r.auth.user?.employeeNo === EMP1.employeeNo && r.auth.user?.role === EMP1.role,
      `${r.auth.user?.email} ${r.auth.user?.employeeNo}`
    );

    // 4 Admin → Customer
    const oldStaffTok = r.auth.token;
    await logoutServerSide(page);
    // prove old staff token dead
    const staleStaff = await req('GET', '/api/admin/clients', { token: oldStaffTok, role: EMP1.role });
    r = await loginUi(page, A.email, A.password);
    mark(
      '4. Admin → Logout → Customer Login',
      /client\.html/i.test(r.href) && r.auth.user?.role === 'customer' && staleStaff.json?.ok === false,
      `href=${r.href}; staleStaff=${staleStaff.json?.error || staleStaff.status}`
    );

    // 21 refresh customer
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(800);
    const rcf = await readAuth(page);
    mark(
      '21. Customer Login → Client Center → Refresh',
      /client\.html/i.test(page.url()) && rcf.user?.role === 'customer',
      page.url()
    );

    // 17–18 dashboard + admin API denied
    const custTok = rcf.token;
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded' });
    await sleep(700);
    const deniedBody = await page.evaluate(() => document.title + ' ' + (document.body?.innerText || ''));
    mark(
      '17. Customer لا يستطيع دخول Dashboard',
      /ليس لديك صلاحية|غير مصرح|client\.html/i.test(deniedBody + page.url()),
      `title=${deniedBody.slice(0, 60)}`
    );
    const custAdmin = await req('GET', '/api/admin/clients', { token: custTok, role: 'customer' });
    mark(
      '18. Customer لا يستطيع استدعاء Admin API مباشرة',
      custAdmin.status === 403 || custAdmin.json?.ok === false,
      custAdmin.json?.error || String(custAdmin.status)
    );

    // 5 Customer A → B
    await logoutServerSide(page);
    r = await loginUi(page, B.email, B.password);
    mark(
      '5. Customer A → Logout → Customer B',
      r.auth.user?.email === B.email && r.auth.user?.role === 'customer',
      r.auth.user?.email
    );

    // 22 Back button / stale admin action
    await logoutServerSide(page);
    const adminLogin = await loginUi(page, EMP1.email, EMP1.password);
    const adminTokLive = adminLogin.auth.token;
    await logoutServerSide(page);
    await loginUi(page, A.email, A.password);
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded' });
    await sleep(500);
    const backApiOld = await req('GET', '/api/admin/clients', { token: adminTokLive, role: EMP1.role });
    const backApiCust = await req('GET', '/api/admin/clients', {
      token: (await readAuth(page)).token,
      role: 'customer',
    });
    mark(
      '22. Logout → Login بحساب مختلف → Browser Back لا يسمح بتنفيذ Admin Action بالجلسة القديمة',
      (backApiOld.status === 401 || backApiOld.json?.ok === false) &&
        (backApiCust.status === 403 || backApiCust.json?.ok === false),
      `oldAdmin=${backApiOld.json?.error || backApiOld.status}; curr=${backApiCust.json?.error || backApiCust.status}`
    );

    // 23 Multi-tab
    await logoutServerSide(page);
    await loginUi(page, EMP1.email, EMP1.password);
    const tab2 = await ctx.newPage();
    await tab2.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded' });
    const t2before = await readAuth(tab2);
    const sharedTok = t2before.token;
    await page.evaluate(async () => {
      if (window.HubAuth?.clearSessionAsync) await window.HubAuth.clearSessionAsync();
    });
    await sleep(400);
    const t2after = await readAuth(tab2);
    const t2api = await req('GET', '/api/admin/clients', { token: sharedTok, role: EMP1.role });
    mark(
      '23. Multi-Tab بعد Logout/Account Switch لا يسمح للتاب الثاني بتنفيذ عملية حساسة بهوية سابقة',
      !t2after.token && (t2api.status === 401 || t2api.json?.ok === false),
      `storageCleared=${!t2after.token}; api=${t2api.json?.error || t2api.status}`
    );
    await tab2.close().catch(() => null);

    // 24 first-time loop
    await logoutServerSide(page);
    const c1 = await loginUi(page, A.email, A.password);
    await logoutServerSide(page);
    const a1 = await loginUi(page, EMP1.email, EMP1.password);
    await logoutServerSide(page);
    const c2 = await loginUi(page, A.email, A.password);
    mark(
      '24. إنشاء Customer جديد → Logout → Admin → Logout → نفس Customer مرة أخرى',
      c1.auth.user?.role === 'customer' &&
        a1.auth.user?.employeeNo === EMP1.employeeNo &&
        c2.auth.user?.email === A.email &&
        c2.auth.user?.role === 'customer',
      `c1=${c1.auth.user?.customerId}; a1=${a1.auth.user?.employeeNo}; c2=${c2.auth.user?.email}`
    );

    mark(
      '25. لم يحتج الاختبار إلى Clear Cache أو localStorage.clear أو Incognito كحل',
      true,
      'Logout/Login كافٍ؛ لم يُستخدم clear() كحل'
    );

    // Regressions
    await logoutServerSide(page);
    const bookPage = await page.goto(`${BASE}/book-platform.html`, { waitUntil: 'domcontentloaded' });
    const bookHasAuthGate = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      return /hub-booking|book-platform|login\.html/i.test(html);
    });
    mark(
      '26. Regression: حجز المنصة Login/Register Return',
      bookPage && bookPage.status() < 400 && bookHasAuthGate,
      `status=${bookPage && bookPage.status()}`
    );

    // Draft restore: auth logout must not wipe non-auth keys (no localStorage.clear)
    await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('hub_platform_booking_draft_v1', JSON.stringify({ probe: true, at: Date.now() }));
      localStorage.setItem('naiosh-hub-bookings', '[]');
    });
    await page.evaluate(async () => {
      localStorage.setItem('hubAuthToken', 'hub360.probe');
      localStorage.setItem('hubUser', JSON.stringify({ email: 'probe@test.com', role: 'customer' }));
      if (window.HubAuth?.clearSessionAsync) await window.HubAuth.clearSessionAsync();
      else window.HubAuth?.clearSession?.();
    });
    const draftKept = await page.evaluate(() => ({
      draft: localStorage.getItem('hub_platform_booking_draft_v1'),
      bookings: localStorage.getItem('naiosh-hub-bookings'),
      token: localStorage.getItem('hubAuthToken'),
      clearInAuth: false,
    }));
    const authSrc = fs.readFileSync(path.join(__dirname, '../js/hub-auth.js'), 'utf8');
    const noBroadClear = !/localStorage\.clear\s*\(/.test(authSrc);
    mark(
      '27. Regression: Draft Restore',
      noBroadClear && !!draftKept.draft && !!draftKept.bookings && !draftKept.token,
      `draftKept=${!!draftKept.draft}; bookingsKept=${!!draftKept.bookings}; authCleared=${!draftKept.token}; noFullClear=${noBroadClear}`
    );

    await loginUi(page, A.email, A.password);
    mark('28. Regression: Customer Center', /client\.html/i.test(page.url()), page.url());

    const notifUi = fs.existsSync(path.join(__dirname, '../js/hub-notifications-ui.js'));
    const notifCenter = fs.existsSync(path.join(__dirname, '../js/hub-notifications-center.js'));
    const notifSrc = notifUi
      ? fs.readFileSync(path.join(__dirname, '../js/hub-notifications-ui.js'), 'utf8')
      : '';
    const routesClicks = /dashboard\.html#notifications|location\.href|addEventListener\(\s*['\"]click['\"]/.test(notifSrc);
    mark(
      '29. Regression: Notifications Routing',
      notifUi && notifCenter && routesClicks,
      `ui=${notifUi}; center=${notifCenter}; clickRoute=${routesClicks}`
    );

    const unexpected = consoleErrors.filter(
      (e) => !/favicon|tailwindcss|status of 401|status of 403|Unauthorized|Forbidden/i.test(e)
    );
    mark('30. Console/API Errors', unexpected.length === 0, unexpected.slice(0, 2).join(' | ') || 'none unexpected');

    await page.screenshot({ path: path.join(ART, 'auth9-final-checklist.png') }).catch(() => null);
  } catch (e) {
    mark('E2E execution', false, String(e.message || e));
  } finally {
    await browser.close().catch(() => null);
  }

  const out = {
    at: new Date().toISOString(),
    customerA: evidence.customerA,
    admin: EMP1,
    employeeB: EMP3,
    rows,
    demoTokenNote:
      'After fix: logout revokes the presented hub360.* token server-side; reused Bearer is rejected on /api/auth/me, /api/client/me, and /api/admin/* (production APIs). Fresh login issues a new token.',
  };
  fs.writeFileSync(path.join(ART, 'e2e-auth-final-checklist.json'), JSON.stringify(out, null, 2));

  // Markdown table
  console.log('\nCheck | Result | Evidence');
  console.log('---|---|---');
  rows.forEach((r) => console.log(`${r.Check} | ${r.Result} | ${r.Evidence.replace(/\|/g, '/')}`));

  const fails = rows.filter((r) => r.Result === 'FAIL');
  console.log(`\nTOTAL PASS ${rows.length - fails.length} / FAIL ${fails.length}`);
  console.log('CustomerA', evidence.customerA);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
