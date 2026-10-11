#!/usr/bin/env node
/** E2E: user-facing Profile 360 — auto-create, isolation, admin real list, personas. */
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
const mark = (c, p, e) => {
  rows.push({ check: c, result: p ? 'PASS' : 'FAIL', evidence: String(e || '').slice(0, 500) });
  console.log(`${p ? 'PASS' : 'FAIL'} | ${c} | ${e}`);
};

async function json(pathname, { method = 'GET', token, body, cookie } = {}) {
  const r = await fetch(BASE + pathname, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j, headers: r.headers };
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  const stamp = Date.now().toString(36);
  const email = `u360.${stamp}@naiosh-test.com`;
  const email2 = `u360b.${stamp}@naiosh-test.com`;
  const pass = 'Test360User!';
  const phone = `+9665${String(Date.now()).slice(-8)}`;

  // 1) Public register
  const reg = await json('/api/auth/register', {
    method: 'POST',
    body: {
      fullName: 'عميل ملفي 360',
      username: ('u360' + stamp).slice(0, 32),
      email,
      phone,
      password: pass,
      confirmPassword: pass,
      city: 'الرياض',
      governorate: 'السعودية',
      termsAccepted: true,
    },
  });
  mark('تسجيل عميل جديد من API التسجيل', reg.status === 201 || reg.j.ok, JSON.stringify({ status: reg.status, msg: reg.j.message }));

  const login = await json('/api/auth/login', { method: 'POST', body: { email, password: pass } });
  const token = login.j.token;
  mark('دخول العميل الجديد', !!token, JSON.stringify({ role: login.j.user?.role, customerId: login.j.user?.customerId }));

  const me = await json('/api/hub/profiles/me', { token });
  const accountNo = me.j.header?.accountNo;
  const customerId = me.j.header?.customerId || me.j.sections?.client?.customerId;
  mark(
    'ملف شخصي 360 يُنشأ تلقائيًا مع رقم حساب ورقم عميل',
    me.j.ok && !!accountNo && !!customerId && (me.j.header?.personas || []).some((p) => p.type === 'client'),
    JSON.stringify({ accountNo, customerId, email: me.j.header?.email, personas: me.j.header?.personas })
  );
  mark('بيانات الملف تخص العميل الجديد وليس القائد', me.j.header?.email === email && !/naioshhub@example/.test(me.j.header?.email || ''), me.j.header?.email);

  // 2) Edit phone + city
  const newPhone = `+9665${String(Date.now() + 9).slice(-8)}`;
  const patch = await json('/api/hub/profiles/me', {
    method: 'PATCH',
    token,
    body: { phone: newPhone, city: 'جدة', country: 'السعودية' },
  });
  mark('تعديل الجوال والمدينة', patch.j.ok, JSON.stringify({ status: patch.status }));
  const me2 = await json('/api/hub/profiles/me', { token });
  mark(
    'حفظ التعديلات بعد القراءة',
    me2.j.header?.phone === newPhone && me2.j.header?.city === 'جدة',
    JSON.stringify({ phone: me2.j.header?.phone, city: me2.j.header?.city })
  );

  // 3) Isolation
  await json('/api/auth/register', {
    method: 'POST',
    body: {
      fullName: 'عميل ثاني 360',
      username: ('u360b' + stamp).slice(0, 32),
      email: email2,
      phone: `+9665${String(Date.now() + 11).slice(-8)}`,
      password: pass,
      confirmPassword: pass,
      termsAccepted: true,
    },
  });
  const login2 = await json('/api/auth/login', { method: 'POST', body: { email: email2, password: pass } });
  const meB = await json('/api/hub/profiles/me', { token: login2.j.token });
  mark(
    'عميل ثانٍ يرى ملفه فقط',
    meB.j.header?.email === email2 && meB.j.header?.accountNo !== accountNo,
    JSON.stringify({ email: meB.j.header?.email, accountNo: meB.j.header?.accountNo })
  );
  const peek = await json('/api/hub/profiles/by-email/' + encodeURIComponent(email), { token: login2.j.token });
  mark('منع عميل من فتح ملف عميل آخر عبر API', peek.status === 401 || peek.status === 403, JSON.stringify({ status: peek.status }));

  const selfEmp = await json('/api/hub/profiles/me/persona', {
    method: 'POST',
    token,
    body: { type: 'employee', refs: { employeeNo: 'EMP-HACK' } },
  });
  mark('منع الترقية الذاتية لموظف', selfEmp.status === 403, JSON.stringify({ status: selfEmp.status, err: selfEmp.j.error }));

  // 4) Staff admin
  let saToken = '';
  let hubCookie = '';
  if (SA_PASS) {
    const saRes = await fetch(BASE + '/api/auth/login', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SA, password: SA_PASS }),
    });
    const saBody = await saRes.json().catch(() => ({}));
    saToken = saBody.token || '';
    const setCookie = saRes.headers.getSetCookie?.() || [];
    const cookieHeader = setCookie.join(',') || saRes.headers.get('set-cookie') || '';
    const m = cookieHeader.match(/hub_session=([^;]+)/);
    hubCookie = m ? m[1] : saToken;
    mark('دخول إداري مخول', !!saToken, JSON.stringify({ role: saBody.user?.role }));

    const list = await json('/api/hub/profiles?limit=100', { token: saToken });
    const emails = (list.j.items || []).map((i) => i.email);
    mark(
      'إدارة الملفات تعرض حسابات حقيقية متعددة',
      (list.j.items || []).length >= 2 && emails.includes(email),
      JSON.stringify({ total: list.j.total || list.j.items?.length, hasNew: emails.includes(email), sample: emails.slice(0, 5) })
    );
    const search = await json('/api/hub/profiles?q=' + encodeURIComponent(customerId || accountNo), { token: saToken });
    mark(
      'البحث برقم العميل/الحساب',
      (search.j.items || []).some((i) => i.email === email),
      JSON.stringify({ count: search.j.items?.length, q: customerId || accountNo })
    );

    const attach = await json('/api/hub/profiles/by-email/' + encodeURIComponent(email) + '/persona', {
      method: 'POST',
      token: saToken,
      body: { type: 'trainee', meta: { courses: [] } },
    });
    mark('ربط صفة متدرب من الإدارة', attach.j.ok, JSON.stringify({ status: attach.status, err: attach.j.error }));
    const meTrainee = await json('/api/hub/profiles/me?persona=trainee', { token });
    mark(
      'قسم التدريب يظهر لصاحب الحساب بعد الربط',
      (meTrainee.j.header?.personas || []).some((p) => p.type === 'trainee' && p.status === 'active') &&
        meTrainee.j.sections?.trainee?.available !== false,
      JSON.stringify({ personas: meTrainee.j.header?.personas, trainee: meTrainee.j.sections?.trainee })
    );

    const emp = await json('/api/hub/profiles/me', { token: saToken });
    mark(
      'ملف موظف فعلي يظهر بياناته الوظيفية',
      (emp.j.header?.personas || []).some((p) => p.type === 'employee') && !!emp.j.sections?.employee?.employeeNo,
      JSON.stringify({ employeeNo: emp.j.sections?.employee?.employeeNo, personas: emp.j.header?.personas })
    );

    const denyAdmin = await json('/api/hub/profiles', { token });
    mark('منع العميل من صفحة/API الإدارة', denyAdmin.status === 401 || denyAdmin.status === 403, JSON.stringify({ status: denyAdmin.status }));
  } else {
    mark('دخول إداري مخول', false, 'missing SA password');
  }

  // Browser
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      (t, e) => {
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify({ email: e, role: 'customer', name: 'عميل ملفي 360', customerId: 'x' }));
        localStorage.setItem('hubTheme', 'light');
      },
      token,
      email
    );
    await page.goto(BASE + '/client.html#profile360', { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 1500));
    const clientText = await page.evaluate(() => document.body.innerText);
    mark(
      'مركز العميل → ملفي الشخصي 360 يظهر بيانات العميل',
      /عميل ملفي 360/.test(clientText) && /ملفي الشخصي 360/.test(clientText) && !/naioshhub@example/.test(clientText),
      clientText.slice(0, 280)
    );
    await page.screenshot({ path: path.join(ART, 'p360_user_client_desktop_light.png'), fullPage: true });
    await page.evaluate(() => window.HubTheme?.set?.('dark'));
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(ART, 'p360_user_client_desktop_dark.png'), fullPage: true });

    await page.goto(BASE + '/profile-360.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(ART, 'p360_user_standalone_desktop.png'), fullPage: true });

    const mob = await browser.newPage();
    await mob.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await mob.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
    await mob.evaluate(
      (t, e) => {
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify({ email: e, role: 'customer', name: 'عميل ملفي 360' }));
        localStorage.setItem('hubTheme', 'light');
      },
      token,
      email
    );
    await mob.goto(BASE + '/client.html#profile360', { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 1200));
    await mob.screenshot({ path: path.join(ART, 'p360_user_client_mobile.png'), fullPage: true });
    await mob.close();

    if (saToken && hubCookie) {
      const admin = await browser.newPage();
      await admin.setViewport({ width: 1440, height: 900 });
      const u = new URL(BASE);
      await admin.setCookie({
        name: 'hub_session',
        value: hubCookie,
        domain: u.hostname,
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      });
      await admin.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
      await admin.evaluate((t, user) => {
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify(user));
        localStorage.setItem('hubTheme', 'light');
      }, saToken, { email: SA, role: 'supreme_leader', name: 'القائد الأعلى' });
      await admin.goto(BASE + '/dashboard.html#profiles-360', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await new Promise((r) => setTimeout(r, 2800));
      const adminText = await admin.evaluate(() => document.querySelector('#profiles-360-mount')?.innerText || '');
      mark(
        'صفحة إدارة الملفات تعرض نتائج حقيقية',
        /عدد النتائج:\s*[2-9]|عدد النتائج:\s*\d{2,}/.test(adminText) || adminText.includes(email) || /عميل|ACC-/.test(adminText),
        adminText.slice(0, 300)
      );
      await admin.screenshot({ path: path.join(ART, 'p360_user_admin_desktop.png'), fullPage: false });

      await admin.goto(BASE + '/profile-360.html', { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 900));
      await admin.evaluate(() => {
        const btn = [...document.querySelectorAll('[data-persona]')].find((b) => b.dataset.persona === 'employee');
        btn?.click();
      });
      await new Promise((r) => setTimeout(r, 700));
      await admin.screenshot({ path: path.join(ART, 'p360_user_employee_desktop.png'), fullPage: true });
      await admin.close();
    }

    // Guest blocked from admin page
    const guest = await browser.newPage();
    await guest.setViewport({ width: 1200, height: 800 });
    await guest.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
    await guest.evaluate(
      (t, e) => {
        localStorage.clear();
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify({ email: e, role: 'customer', name: 'عميل' }));
      },
      token,
      email
    );
    await guest.goto(BASE + '/dashboard.html#profiles-360', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 1500));
    const gUrl = guest.url();
    mark(
      'منع العميل من دخول لوحة/إدارة الملفات',
      !/dashboard\.html/i.test(gUrl) || /login\.html|client\.html|غير مصرح/i.test(await guest.evaluate(() => document.body.innerText)),
      gUrl
    );
    await guest.close();
  } finally {
    await browser.close().catch(() => null);
  }

  // Persistence after re-login
  const againLogin = await json('/api/auth/login', { method: 'POST', body: { email, password: pass } });
  const again = await json('/api/hub/profiles/me', { token: againLogin.j.token });
  mark(
    'بقاء البيانات بعد تسجيل الخروج والدخول',
    again.j.header?.phone === newPhone && again.j.header?.accountNo === accountNo,
    JSON.stringify({ phone: again.j.header?.phone, accountNo: again.j.header?.accountNo, customerId: again.j.header?.customerId })
  );

  const out = {
    base: BASE,
    links: {
      userProfile: BASE + '/profile-360.html',
      clientCenterProfile: BASE + '/client.html#profile360',
      adminProfiles: BASE + '/dashboard.html#profiles-360',
    },
    testAccount: { email, accountNo, customerId, phone: newPhone },
    checks: rows,
  };
  const outPath = path.join(ART, `profile-360-user-e2e-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log('REPORT', outPath);
  process.exit(rows.some((r) => r.result === 'FAIL') ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
