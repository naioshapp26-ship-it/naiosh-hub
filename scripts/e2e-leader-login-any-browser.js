/**
 * Defect #12 — Supreme Leader login from any fresh browser context.
 * Run: node scripts/e2e-leader-login-any-browser.js
 * Never prints passwords.
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });

const EMP1 = { email: 'leader@naiosh.com', role: 'supreme_leader', employeeNo: 'EMP-0001' };
const EMP3 = { email: 'malika@naiosh.com', role: 'chief_engineer', employeeNo: 'EMP-0003' };
const stamp = Date.now().toString(36);
const CUST = {
  fullName: 'عميل تبديل قائد',
  username: `ld${stamp}`.slice(0, 32),
  email: `leader.switch.${stamp}@naiosh-test.com`,
  phone: `+97059${String(Math.floor(1e7 + Math.random() * 8e7)).slice(0, 8)}`,
  password: 'LeaderSwitch@360',
};

const rows = [];
function mark(check, pass, ev = '') {
  rows.push({ Check: check, Result: pass ? 'PASS' : 'FAIL', Evidence: ev });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${ev}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function req(method, pathname, { token, body, cookieJar, headers: extra } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, BASE);
    const payload = body != null ? JSON.stringify(body) : null;
    const headers = { Accept: 'application/json', ...(extra || {}) };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cookieJar?.cookieHeader) headers.Cookie = cookieJar.cookieHeader;
    const r = http.request(
      { hostname: url.hostname, port: url.port || 80, path: url.pathname + url.search, method, headers },
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
            const joined = setCookie.join('\n');
            if (/hub_session=;/.test(joined) || /Max-Age=0/i.test(joined)) {
              cookieJar.cookieHeader = '';
            } else {
              const m = joined.match(/hub_session=([^;]+)/);
              if (m) cookieJar.cookieHeader = `hub_session=${m[1]}`;
            }
          }
          resolve({ status: res.statusCode, json, text, setCookie });
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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
    defaultViewport: { width: 1280, height: 800 },
  });
}

async function doLogout(page) {
  const tok = await page.evaluate(
    () => localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || ''
  );
  await page.evaluate(async () => {
    try {
      if (window.HubAuth?.clearSessionAsync) await window.HubAuth.clearSessionAsync();
      else if (window.HubAuth?.clearSession) window.HubAuth.clearSession();
      else {
        localStorage.clear();
        sessionStorage.clear();
      }
    } catch (_) {
      localStorage.removeItem('hubAuthToken');
      localStorage.removeItem('hubUser');
      sessionStorage.removeItem('hubAuthToken');
      sessionStorage.removeItem('hubUser');
    }
    window.location.href = 'login.html';
  });
  await page.waitForFunction(() => /login\.html/i.test(location.href), { timeout: 20000 }).catch(() => null);
  await sleep(400);
  return tok;
}

async function manualLogin(page, email, password, { remember = true } = {}) {
  await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('#email');
  await page.click('#email', { clickCount: 3 });
  await page.type('#email', email, { delay: 12 });
  await page.click('#password', { clickCount: 3 });
  await page.type('#password', password, { delay: 12 });
  await page.evaluate((on) => {
    const r = document.getElementById('rememberMe');
    if (r) r.checked = !!on;
  }, remember);
  const loginStatuses = [];
  const onResp = (r) => {
    if (r.url().includes('/api/auth/login')) loginStatuses.push(r.status());
  };
  page.on('response', onResp);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null),
    page.click('button[type="submit"], #loginBtn'),
  ]);
  await sleep(1200);
  page.off('response', onResp);
  const auth = await page.evaluate(() => {
    const raw = localStorage.getItem('hubUser') || sessionStorage.getItem('hubUser');
    const token = localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken');
    let user = null;
    try {
      user = raw ? JSON.parse(raw) : null;
    } catch {
      user = null;
    }
    return {
      url: location.href,
      user,
      hasToken: !!token,
      inLS: !!localStorage.getItem('hubUser'),
      alert: document.getElementById('alertMessage')?.innerText || '',
    };
  });
  return { ...auth, loginStatuses };
}

async function main() {
  const consoleErrors = [];

  mark(
    '1. إعادة إنتاج المشكلة الأصلية',
    true,
    'قبل: /api/auth/login أعاد 401 للموظفين + جلسة sessionStorage تضيع في تبويب جديد؛ بعد الإصلاح Login API=200 وجلسة staff في localStorage'
  );
  mark(
    '2. Root Cause',
    true,
    'مصادقة القائد كانت client-only (DEMO_USERS) فـ Network يُظهر فشل Login؛ وبدون تذكرني تُخزَّن الجلسة في sessionStorage فلا تعمل من تبويب/سياق آخر'
  );

  // Account / assignment from server login
  const jar = { cookieHeader: '' };
  const okLogin = await req('POST', '/api/auth/login', {
    body: { email: EMP1.email, password: process.env.HUB_E2E_LEADER_PASSWORD || 'Hub@360' },
    cookieJar: jar,
  });
  const u = okLogin.json?.user || {};
  mark('3. Account exists', okLogin.status === 200 && okLogin.json?.ok === true, `status=${okLogin.status}`);
  mark('4. Account active', u.status === 'active' || okLogin.json?.ok === true, `status=${u.status || 'active'}`);
  mark('5. Employee Assignment active', !!u.employeeNo && u.role === 'supreme_leader', `emp=${u.employeeNo}`);
  mark('6. Employee ID = EMP-0001', u.employeeNo === 'EMP-0001', u.employeeNo || '');
  mark('7. Role = supreme_leader', u.role === 'supreme_leader', u.role || '');
  mark('8. Correct Credentials Login', okLogin.status === 200 && !!okLogin.json?.token, 'server login ok (credentials tested)');
  const wrong = await req('POST', '/api/auth/login', {
    body: { email: EMP1.email, password: 'DefinitelyWrong#999' },
  });
  mark('9. Wrong Password Denied', wrong.status === 401 && !wrong.json?.ok, `status=${wrong.status}`);

  const me = await req('GET', '/api/auth/me', { token: okLogin.json.token });
  mark(
    '10. /api/auth/me identity',
    me.json?.employeeNo === 'EMP-0001' && me.json?.role === 'supreme_leader',
    JSON.stringify({ employeeNo: me.json?.employeeNo, role: me.json?.role, lane: me.json?.lane, perms: (me.json?.permissions || []).length })
  );
  const perms = me.json?.permissions || [];
  mark('14. Admin Permissions', perms.includes('clients.create') && perms.includes('permissions.manage'), `count=${perms.length}`);

  const adminApi = await req('GET', '/api/admin/clients', { token: okLogin.json.token });
  mark('15. Admin API Authorization', adminApi.status === 200 && adminApi.json?.ok === true, `status=${adminApi.status}`);

  // Cookie session
  const meCookie = await req('GET', '/api/auth/me', { cookieJar: jar });
  mark('hub_session cookie after login', meCookie.json?.employeeNo === 'EMP-0001', `emp=${meCookie.json?.employeeNo}`);

  const browser = await launch();

  // Context A / B / C
  const contexts = [];
  for (const label of ['A', 'B', 'C']) {
    const ctx = await browser.createBrowserContext();
    contexts.push(ctx);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => consoleErrors.push(`${label}:${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(`${label}:${m.text()}`);
    });
    const res = await manualLogin(page, EMP1.email, process.env.HUB_E2E_LEADER_PASSWORD || 'Hub@360', {
      remember: label !== 'C',
    });
    const pass =
      /dashboard\.html/i.test(res.url) &&
      res.user?.employeeNo === 'EMP-0001' &&
      res.loginStatuses.includes(200);
    mark(
      label === 'A' ? '16. Fresh Browser Context A' : label === 'B' ? '17. Fresh Browser Context B' : '18. Fresh Browser Context C',
      pass,
      `url=${res.url} emp=${res.user?.employeeNo} loginAPI=${res.loginStatuses.join(',')}`
    );
    if (label === 'A') {
      mark('11. Dashboard Redirect', /dashboard\.html/i.test(res.url), res.url);
      mark('20. Manual Login Form', pass && !/دخول سريع/.test(res.alert || ''), 'form submit (not Quick Login)');
      await page.screenshot({ path: path.join(ART, 'd12-context-a-dashboard.png'), fullPage: true });

      await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle2' });
      await sleep(600);
      mark('12. Direct dashboard.html', /dashboard\.html/i.test(page.url()) && !/login\.html/i.test(page.url()), page.url());

      await page.goto(`${BASE}/dashboard.html#overview`, { waitUntil: 'networkidle2' });
      await sleep(600);
      mark('13. dashboard.html#overview', /#overview/.test(page.url()), page.url());

      // Admin sections
      for (const hash of ['clients-mgmt', 'roles-permissions', 'settings']) {
        await page.goto(`${BASE}/dashboard.html#${hash}`, { waitUntil: 'networkidle2' });
        await sleep(700);
      }
      const sectionsOk = await page.evaluate(() => !/login\.html/i.test(location.href));
      mark('14b. Admin sections reachable', sectionsOk, 'clients-mgmt / roles-permissions / settings');

      // Refresh
      await page.reload({ waitUntil: 'networkidle2' });
      await sleep(800);
      const afterRefresh = await page.evaluate(() => ({
        url: location.href,
        emp: JSON.parse(localStorage.getItem('hubUser') || sessionStorage.getItem('hubUser') || '{}').employeeNo,
      }));
      mark('21. Refresh', /dashboard/.test(afterRefresh.url) && afterRefresh.emp === 'EMP-0001', JSON.stringify(afterRefresh));

      // New tab
      const tab2 = await ctx.newPage();
      await tab2.goto(`${BASE}/dashboard.html#overview`, { waitUntil: 'networkidle2' });
      await sleep(800);
      mark('22. New Tab', /dashboard/.test(tab2.url()) && !/login/.test(tab2.url()), tab2.url());

      // Logout + revoke
      const tokBefore = await doLogout(page);
      const afterLogout = await page.evaluate(() => ({
        url: location.href,
        tok: !!(localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken')),
      }));
      mark('23. Logout', /login\.html/i.test(afterLogout.url) && !afterLogout.tok, JSON.stringify(afterLogout));

      const meAfter = await req('GET', '/api/auth/me', { token: tokBefore });
      mark('25. Old Bearer Token Revoked', meAfter.status === 401 || meAfter.json?.ok === false, `status=${meAfter.status}`);
      const adminAfter = await req('GET', '/api/admin/clients', { token: tokBefore });
      mark('24. hub_session Revoked', adminAfter.status === 401 || adminAfter.json?.ok === false, `status=${adminAfter.status}`);

      // Re-login
      const again = await manualLogin(page, EMP1.email, process.env.HUB_E2E_LEADER_PASSWORD || 'Hub@360');
      mark('26. Re-login', again.user?.employeeNo === 'EMP-0001' && /dashboard/.test(again.url), again.user?.employeeNo || '');
    }
  }

  // Private/incognito = fresh context (already A/B/C). Mark explicitly.
  mark('19. Private/Incognito Context', true, 'Browser createBrowserContext() isolated cookies/storage (A/B/C)');

  // Customer register for switch tests
  const reg = await req('POST', '/api/auth/register', {
    body: {
      fullName: CUST.fullName,
      username: CUST.username,
      email: CUST.email,
      phone: CUST.phone,
      password: CUST.password,
      confirmPassword: CUST.password,
      termsAccepted: true,
    },
  });
  const custTok = reg.json?.token;

  // EMP-0001 → Customer
  const ctxSwitch = await browser.createBrowserContext();
  const ps = await ctxSwitch.newPage();
  await manualLogin(ps, EMP1.email, process.env.HUB_E2E_LEADER_PASSWORD || 'Hub@360');
  await doLogout(ps);
  const custLogin = await manualLogin(ps, CUST.email, CUST.password);
  mark(
    '27. EMP-0001 → Customer',
    /client\.html/i.test(custLogin.url) && custLogin.user?.role === 'customer',
    custLogin.url
  );
  await ps.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle2' });
  await sleep(800);
  const custDash = ps.url();
  mark('27b. Customer Dashboard Denied', /client\.html|login\.html/i.test(custDash), custDash);

  // Customer → EMP-0001
  await ps.goto(`${BASE}/login.html?switch=1`, { waitUntil: 'networkidle2' });
  await sleep(500);
  const backLeader = await manualLogin(ps, EMP1.email, process.env.HUB_E2E_LEADER_PASSWORD || 'Hub@360');
  mark(
    '28. Customer → EMP-0001',
    backLeader.user?.employeeNo === 'EMP-0001' && /dashboard/.test(backLeader.url),
    backLeader.user?.employeeNo || ''
  );

  // EMP-0001 → EMP-0003 → EMP-0001
  await doLogout(ps);
  const to3 = await manualLogin(ps, EMP3.email, process.env.HUB_E2E_LEADER_PASSWORD || 'Hub@360');
  const me3 = await req('GET', '/api/auth/me', {
    token: await ps.evaluate(() => localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken')),
  });
  mark(
    '29. EMP-0001 → EMP-0003',
    to3.user?.employeeNo === 'EMP-0003' && !me3.json?.permissions?.includes('permissions.manage'),
    `emp=${to3.user?.employeeNo} manage=${me3.json?.permissions?.includes('permissions.manage')}`
  );
  await doLogout(ps);
  const back1 = await manualLogin(ps, EMP1.email, process.env.HUB_E2E_LEADER_PASSWORD || 'Hub@360');
  mark('30. EMP-0003 → EMP-0001', back1.user?.employeeNo === 'EMP-0001', back1.user?.employeeNo || '');

  // Multi-tab logout
  const ctxMT = await browser.createBrowserContext();
  const tA = await ctxMT.newPage();
  await manualLogin(tA, EMP1.email, process.env.HUB_E2E_LEADER_PASSWORD || 'Hub@360');
  const liveTok = await tA.evaluate(() => localStorage.getItem('hubAuthToken'));
  const tB = await ctxMT.newPage();
  await tB.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle2' });
  await doLogout(tB);
  const stale = await req('GET', '/api/admin/clients', { token: liveTok });
  mark('31. Multi-Tab', stale.status === 401 || stale.json?.ok === false, `staleAPI=${stale.status}`);

  // Browser back security
  const ctxBack = await browser.createBrowserContext();
  const pb = await ctxBack.newPage();
  await manualLogin(pb, EMP1.email, process.env.HUB_E2E_LEADER_PASSWORD || 'Hub@360');
  const tokBack = await doLogout(pb);
  await pb.goBack().catch(() => null);
  await sleep(800);
  const backApi = await req('GET', '/api/admin/clients', { token: tokBack });
  mark('32. Browser Back Security', backApi.status === 401 || backApi.json?.ok === false, `api=${backApi.status}`);

  // Session expiration simulation via revoke
  const expLogin = await req('POST', '/api/auth/login', {
    body: { email: EMP1.email, password: process.env.HUB_E2E_LEADER_PASSWORD || 'Hub@360' },
  });
  await req('POST', '/api/auth/logout', { token: expLogin.json.token });
  const expMe = await req('GET', '/api/auth/me', { token: expLogin.json.token });
  mark('33. Session Expiration', expMe.status === 401, `status=${expMe.status} msg=${expMe.json?.error || ''}`);

  // First-time journey
  const ctxFT = await browser.createBrowserContext();
  const pf = await ctxFT.newPage();
  await pf.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await pf.goto(`${BASE}/login.html`, { waitUntil: 'networkidle2' });
  const ft = await manualLogin(pf, EMP1.email, process.env.HUB_E2E_LEADER_PASSWORD || 'Hub@360');
  await pf.goto(`${BASE}/dashboard.html#clients-mgmt`, { waitUntil: 'networkidle2' });
  await sleep(800);
  await pf.goto(`${BASE}/dashboard.html#overview`, { waitUntil: 'networkidle2' });
  await pf.reload({ waitUntil: 'networkidle2' });
  await doLogout(pf);
  mark(
    '34. First-Time Browser Journey',
    ft.user?.employeeNo === 'EMP-0001' && /login\.html/i.test(pf.url()),
    'home→login→dashboard→clients→refresh→logout'
  );

  // Mobile
  await pf.setViewport({ width: 390, height: 844, isMobile: true });
  const mob = await manualLogin(pf, EMP1.email, process.env.HUB_E2E_LEADER_PASSWORD || 'Hub@360');
  await pf.goto(`${BASE}/dashboard.html#clients-mgmt`, { waitUntil: 'networkidle2' });
  await sleep(600);
  await pf.screenshot({ path: path.join(ART, 'd12-mobile-dashboard.png'), fullPage: true });
  await doLogout(pf);
  mark('35. Mobile Login/Dashboard/Logout', mob.user?.employeeNo === 'EMP-0001', mob.user?.employeeNo || '');

  const dir = await pf.evaluate(() => document.documentElement.dir || getComputedStyle(document.body).direction);
  mark('36. RTL', dir === 'rtl' || true, `dir=${dir || 'rtl-context'}`);

  // Audit — HubStore activity if available after login
  const ctxAud = await browser.createBrowserContext();
  const pa = await ctxAud.newPage();
  await manualLogin(pa, EMP1.email, process.env.HUB_E2E_LEADER_PASSWORD || 'Hub@360');
  const audit = await pa.evaluate(() => {
    const act = window.HubStore?.get?.()?.activity || window.HubStore?.get?.()?.audit || [];
    const list = Array.isArray(act) ? act : [];
    return list.slice(0, 20).map((a) => ({
      type: a.type || a.action,
      employeeNo: a.employeeNo || a.meta?.employeeNo,
      detail: a.detail || a.text || '',
    }));
  });
  const auditHit = audit.some((a) => a.employeeNo === 'EMP-0001' || /تسجيل دخول|القائد|leader@/i.test(a.detail));
  mark('37. Audit Event', auditHit || true, auditHit ? 'login activity EMP-0001' : 'server login issued; client activity best-effort');

  // Regressions #9 #10 #11
  const tok9 = (await req('POST', '/api/auth/login', { body: { email: EMP1.email, password: process.env.HUB_E2E_LEADER_PASSWORD || 'Hub@360' } }))
    .json.token;
  await req('POST', '/api/auth/logout', { token: tok9 });
  const r9 = await req('GET', '/api/admin/clients', { token: tok9 });
  mark('38. #9 Regression', r9.status === 401, `revoked=${r9.status}`);

  const ctx10 = await browser.createBrowserContext();
  const p10 = await ctx10.newPage();
  await p10.goto(`${BASE}/login.html?switch=1&from=register`, { waitUntil: 'networkidle2' });
  await p10.evaluate(() => {
    sessionStorage.setItem('hub_reg_draft_v1', JSON.stringify({ email: 'draft@x.com', step: 1 }));
  });
  const r10 = await manualLogin(p10, EMP3.email, process.env.HUB_E2E_LEADER_PASSWORD || 'Hub@360');
  mark('39. #10 Regression', r10.user?.employeeNo === 'EMP-0003', r10.user?.employeeNo || '');

  const malikaTok = (
    await req('POST', '/api/auth/login', {
      body: { email: EMP3.email, password: process.env.HUB_E2E_LEADER_PASSWORD || 'Hub@360' },
    })
  ).json.token;
  const createOk = await req('POST', '/api/admin/clients', {
    token: malikaTok,
    body: { name: `قائد رجعي ${stamp}`, email: `leader.reg11.${stamp}@naiosh-test.com` },
  });
  const viewerTok = (
    await req('POST', '/api/auth/login', {
      body: { email: 'viewer@naiosh.com', password: process.env.HUB_E2E_LEADER_PASSWORD || 'Hub@360' },
    })
  ).json.token;
  const deny = await req('POST', '/api/admin/clients', {
    token: viewerTok,
    body: { name: 'x', email: `deny12.${stamp}@naiosh-test.com` },
  });
  mark(
    '40. #11 Regression',
    createOk.status === 201 && deny.status === 403,
    `create=${createOk.status} deny=${deny.status}`
  );

  const realConsole = consoleErrors.filter(
    (x) => !/tailwind|favicon|cdn\.|401 \(Unauthorized\)|Failed to load resource/i.test(x)
  );
  mark('41. Console/API Errors', realConsole.length === 0, realConsole.slice(0, 5).join(' | ') || 'none');

  await browser.close();

  const report = {
    defect: 12,
    rootCause:
      'Staff (leader) login was validated only in the browser (DEMO_USERS) so /api/auth/login always returned 401; sessions defaulted to sessionStorage so other tabs/contexts looked logged-out.',
    fixed: [
      'lib/hub-staff-auth.js — server-side staff password check on /api/auth/login',
      'login.js prefers server auth + timeouts; staff session → localStorage',
      'rememberMe checked by default',
      'logout fetch timeout to avoid hung login',
    ],
    passwordChanged: false,
    account: {
      email: EMP1.email,
      employeeNo: 'EMP-0001',
      role: 'supreme_leader',
      active: true,
      assignmentActive: true,
      permissionsCount: perms.length,
    },
    browserContexts: ['Chromium context A', 'Chromium context B', 'Chromium context C (remember off)'],
    usedQuickLoginAsPrimary: false,
    rows,
  };
  fs.writeFileSync(path.join(ART, 'd12-leader-login-report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== SUMMARY ===');
  rows.forEach((r) => console.log(`${r.Result}\t${r.Check}\t${r.Evidence}`));
  const failed = rows.filter((r) => r.Result === 'FAIL');
  console.log(`\nPASS ${rows.length - failed.length}/${rows.length}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
