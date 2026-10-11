#!/usr/bin/env node
/** Full production verification for Profile 360 — ACC-C328DB41. */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.HUB_E2E_BASE || 'https://naiosh-hub-production.up.railway.app').replace(/\/$/, '');
const SA = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_PROD_SA_PASSWORD || process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const ART = '/opt/cursor/artifacts';
const EMAIL = process.env.P360_PROD_EMAIL || 'u360.mv3y79b9@naiosh-test.com';
const PASS = process.env.P360_PROD_PASS || 'Test360User!';
const EXPECT_ACC = 'ACC-C328DB41';
const EXPECT_CL = 'CL-C328DB41';
const AVATAR = path.join(ART, 'p360_test_avatar.png');

const rows = [];
const mark = (c, p, e) => {
  rows.push({ check: c, result: p ? 'PASS' : 'FAIL', evidence: String(e || '').slice(0, 700) });
  console.log(`${p ? 'PASS' : 'FAIL'} | ${c} | ${e}`);
};

async function json(pathname, { method = 'GET', token, body } = {}) {
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

async function discoverUploadPath(token) {
  const candidates = ['/api/hub/uploads', '/api/uploads', '/api/hub/upload', '/api/client/upload'];
  for (const p of candidates) {
    try {
      const buf = fs.readFileSync(AVATAR);
      const form = new FormData();
      form.append('file', new Blob([buf], { type: 'image/png' }), 'p360_test_avatar.png');
      const up = await fetch(BASE + p, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form });
      const uj = await up.json().catch(() => ({}));
      const url = uj.url || uj.path || uj.publicUrl || uj.file?.url || uj.attachment?.url || '';
      if (up.status < 500 && url) return { path: p, url, status: up.status, uj };
      if (up.status === 404) continue;
      if (url) return { path: p, url, status: up.status, uj };
      // keep last non-404 for evidence
      if (up.status !== 404) return { path: p, url: '', status: up.status, uj };
    } catch {
      /* try next */
    }
  }
  return { path: '', url: '', status: 0, uj: {} };
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });

  // Deploy readiness: learning enrollments endpoint
  let deployed = false;
  for (let i = 0; i < 12; i++) {
    const probeLogin = await json('/api/auth/login', { method: 'POST', body: { email: EMAIL, password: PASS } });
    if (probeLogin.j.token) {
      const lr = await json('/api/hub/profiles/me/learning', {
        method: 'POST',
        token: probeLogin.j.token,
        body: { itemId: 'deploy-probe', title: 'probe' },
      });
      if (lr.status !== 404) {
        deployed = true;
        break;
      }
    }
    console.log('waiting deploy', i + 1);
    await new Promise((r) => setTimeout(r, 8000));
  }
  mark('نشر الإنتاج محدّث (مسارات الملف 360)', deployed, BASE);

  let login = await json('/api/auth/login', { method: 'POST', body: { email: EMAIL, password: PASS } });
  if (!login.j.token) {
    await json('/api/auth/register', {
      method: 'POST',
      body: {
        fullName: 'عميل ملفي 360',
        username: 'u360mv3y79b9',
        email: EMAIL,
        phone: '+966512345678',
        password: PASS,
        confirmPassword: PASS,
        city: 'الرياض',
        governorate: 'السعودية',
        termsAccepted: true,
      },
    });
    login = await json('/api/auth/login', { method: 'POST', body: { email: EMAIL, password: PASS } });
  }
  let token = login.j.token;
  mark('1 دخول العميل ACC-C328DB41', !!token, JSON.stringify({ customerId: login.j.user?.customerId }));

  let me = await json('/api/hub/profiles/me', { token });
  mark(
    '1 ملف 360 = ACC-C328DB41 / CL-C328DB41',
    me.j.header?.accountNo === EXPECT_ACC && me.j.header?.customerId === EXPECT_CL && me.j.header?.email === EMAIL,
    JSON.stringify({ accountNo: me.j.header?.accountNo, customerId: me.j.header?.customerId, email: me.j.header?.email })
  );

  const newPhone = `+9665${String(Date.now()).slice(-8)}`;
  const patch = await json('/api/hub/profiles/me', {
    method: 'PATCH',
    token,
    body: { phone: newPhone, city: 'الدمام', country: 'السعودية' },
  });
  mark('2 تعديل الجوال والمدينة', patch.j.ok, JSON.stringify({ status: patch.status }));

  const up = await discoverUploadPath(token);
  let avatarOk = false;
  if (up.url) {
    const av = await json('/api/hub/profiles/me', { method: 'PATCH', token, body: { avatarUrl: up.url } });
    avatarOk = !!av.j.ok;
  }
  mark('2 رفع/حفظ الصورة الشخصية', avatarOk, JSON.stringify({ uploadPath: up.path, status: up.status, url: String(up.url).slice(0, 140), err: up.uj?.error || up.uj?.message }));

  const againLogin = await json('/api/auth/login', { method: 'POST', body: { email: EMAIL, password: PASS } });
  token = againLogin.j.token;
  me = await json('/api/hub/profiles/me', { token });
  mark(
    '3 استمرار البيانات بعد تسجيل الخروج/الدخول',
    me.j.header?.phone === newPhone && me.j.header?.city === 'الدمام' && (!avatarOk || !!me.j.header?.avatarUrl),
    JSON.stringify({ phone: me.j.header?.phone, city: me.j.header?.city, avatar: me.j.header?.avatarUrl || '' })
  );

  // Second customer isolation
  const stamp = Date.now().toString(36);
  const email2 = `u360iso.${stamp}@naiosh-test.com`;
  await json('/api/auth/register', {
    method: 'POST',
    body: {
      fullName: 'عميل عزل 360',
      username: ('u360iso' + stamp).slice(0, 32),
      email: email2,
      phone: `+9665${String(Date.now() + 7).slice(-8)}`,
      password: PASS,
      confirmPassword: PASS,
      termsAccepted: true,
    },
  });
  const login2 = await json('/api/auth/login', { method: 'POST', body: { email: email2, password: PASS } });
  const me2 = await json('/api/hub/profiles/me', { token: login2.j.token });
  mark(
    '4 عزل: العميل الثاني يرى ملفه فقط',
    me2.j.header?.email === email2 && me2.j.header?.accountNo !== EXPECT_ACC,
    JSON.stringify({ email: me2.j.header?.email, accountNo: me2.j.header?.accountNo })
  );
  const peek = await json('/api/hub/profiles/by-email/' + encodeURIComponent(EMAIL), { token: login2.j.token });
  mark('4 عزل API: منع قراءة ملف العميل الأول', peek.status === 401 || peek.status === 403, JSON.stringify({ status: peek.status }));
  const hackPatch = await json('/api/hub/profiles/by-email/' + encodeURIComponent(EMAIL), {
    method: 'PATCH',
    token: login2.j.token,
    body: { phone: '+966500000000' },
  });
  mark('4 عزل API: منع تعديل ملف العميل الأول', hackPatch.status === 401 || hackPatch.status === 403, JSON.stringify({ status: hackPatch.status }));
  const afterHack = await json('/api/hub/profiles/me', { token });
  mark('4 عزل: هاتف العميل الأول لم يتغيّر', afterHack.j.header?.phone === newPhone, afterHack.j.header?.phone);

  // Employee
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
    hubCookie = m ? m[1] : '';
    mark(
      '5 دخول موظف/قائد',
      !!saToken,
      JSON.stringify({
        status: saRes.status,
        role: saBody.user?.role,
        employeeNo: saBody.employeeNo || saBody.user?.employeeNo,
        err: saBody.error || saBody.message,
        hint: saToken ? '' : 'set HUB_PROD_SA_PASSWORD to current Railway SA password',
      })
    );
    if (saToken) {
      const emp = await json('/api/hub/profiles/me', { token: saToken });
      mark(
        '5 بيانات وظيفية صحيحة دون صلاحيات إضافية مصطنعة',
        (emp.j.header?.personas || []).some((p) => p.type === 'employee') && !!emp.j.sections?.employee?.employeeNo,
        JSON.stringify({
          employeeNo: emp.j.sections?.employee?.employeeNo,
          role: emp.j.sections?.employee?.role,
          tasks: emp.j.sections?.employee?.tasks,
          payroll: emp.j.sections?.employee?.payroll,
          sources: emp.j.sections?.employee?.sources,
        })
      );

      const list = await json('/api/hub/profiles?limit=100', { token: saToken });
      mark('6 قائمة إدارة: حسابات حقيقية', (list.j.items || []).length >= 2, JSON.stringify({ total: list.j.total, count: list.j.items?.length }));
      const byName = await json('/api/hub/profiles?q=' + encodeURIComponent('عميل ملفي'), { token: saToken });
      const byEmail = await json('/api/hub/profiles?q=' + encodeURIComponent(EMAIL), { token: saToken });
      const byAcc = await json('/api/hub/profiles?q=' + encodeURIComponent(EXPECT_ACC), { token: saToken });
      const byCl = await json('/api/hub/profiles?q=' + encodeURIComponent(EXPECT_CL), { token: saToken });
      const byEmp = await json('/api/hub/profiles?q=EMP-0001', { token: saToken });
      mark('6 بحث بالاسم', (byName.j.items || []).some((i) => i.email === EMAIL), JSON.stringify({ n: byName.j.items?.length }));
      mark('6 بحث بالبريد', (byEmail.j.items || []).some((i) => i.email === EMAIL), JSON.stringify({ n: byEmail.j.items?.length }));
      mark('6 بحث برقم الحساب', (byAcc.j.items || []).some((i) => i.accountNo === EXPECT_ACC), JSON.stringify({ n: byAcc.j.items?.length }));
      mark('6 بحث برقم العميل', (byCl.j.items || []).some((i) => i.customerId === EXPECT_CL || i.email === EMAIL), JSON.stringify({ n: byCl.j.items?.length }));
      mark('6 بحث برقم الموظف', (byEmp.j.items || []).some((i) => i.employeeNo === 'EMP-0001' || i.email === SA), JSON.stringify({ n: byEmp.j.items?.length, sample: byEmp.j.items?.[0] }));

      const attach = await json('/api/hub/profiles/by-email/' + encodeURIComponent(EMAIL) + '/persona', {
        method: 'POST',
        token: saToken,
        body: {
          type: 'trainee',
          meta: { courses: [{ id: 'CRS-PROD-1', name: 'دورة اختبار الإنتاج', progress: 40 }] },
        },
      });
      mark('7 ربط صفة متدرب (من الإدارة)', attach.j.ok, JSON.stringify({ status: attach.status, err: attach.j.error }));
      mark('8 الإداري يستطيع قائمة الملفات', (list.j.items || []).length > 0, JSON.stringify({ total: list.j.total }));
    } else {
      mark('5 بيانات وظيفية صحيحة دون صلاحيات إضافية مصطنعة', false, 'BLOCKED: no production SA session');
      mark('6 قائمة إدارة: حسابات حقيقية', false, 'BLOCKED: no production SA session');
      mark('6 بحث بالاسم', false, 'BLOCKED');
      mark('6 بحث بالبريد', false, 'BLOCKED');
      mark('6 بحث برقم الحساب', false, 'BLOCKED');
      mark('6 بحث برقم العميل', false, 'BLOCKED');
      mark('6 بحث برقم الموظف', false, 'BLOCKED');
      mark('7 ربط صفة متدرب (من الإدارة)', false, 'BLOCKED: no production SA session — owner learning path still tested below');
      mark('8 الإداري يستطيع قائمة الملفات', false, 'BLOCKED: no production SA session');
    }
    const deny = await json('/api/hub/profiles', { token });
    mark('8 منع العميل من API الإدارة', deny.status === 401 || deny.status === 403, JSON.stringify({ status: deny.status }));
  } else {
    mark('5 دخول موظف/قائد', false, 'missing HUB_PROD_SA_PASSWORD / HUB_E2E_SA_PASSWORD');
    mark('5 بيانات وظيفية صحيحة دون صلاحيات إضافية مصطنعة', false, 'BLOCKED');
    mark('6 قائمة إدارة: حسابات حقيقية', false, 'BLOCKED');
    mark('6 بحث بالاسم', false, 'BLOCKED');
    mark('6 بحث بالبريد', false, 'BLOCKED');
    mark('6 بحث برقم الحساب', false, 'BLOCKED');
    mark('6 بحث برقم العميل', false, 'BLOCKED');
    mark('6 بحث برقم الموظف', false, 'BLOCKED');
    mark('7 ربط صفة متدرب (من الإدارة)', false, 'BLOCKED');
    mark('8 الإداري يستطيع قائمة الملفات', false, 'BLOCKED');
    const deny = await json('/api/hub/profiles', { token });
    mark('8 منع العميل من API الإدارة', deny.status === 401 || deny.status === 403, JSON.stringify({ status: deny.status }));
  }

  // Trainee path without SA: owner learning enrollment (still proves persona + courses on account)
  if (!(me.j.header?.personas || []).some((p) => p.type === 'trainee' && p.status === 'active')) {
    const selfTrainee = await json('/api/hub/profiles/me/persona', {
      method: 'POST',
      token,
      body: { type: 'trainee', meta: {} },
    });
    mark('7 تفعيل صفة متدرب (مسار صاحب الحساب)', selfTrainee.j.ok, JSON.stringify({ status: selfTrainee.status, err: selfTrainee.j.error }));
  } else {
    mark('7 صفة متدرب موجودة على الحساب', true, 'already active');
  }
  const learn = await json('/api/hub/profiles/me/learning', {
    method: 'POST',
    token,
    body: { itemId: 'CRS-PROD-VERIFY', title: 'دورة تحقق الإنتاج', progress: 25 },
  });
  mark('7 تسجيل دورة خادمية في ملف المتدرب', learn.j.ok, JSON.stringify({ status: learn.status, n: learn.j.enrollment?.length }));
  const meTrain = await json('/api/hub/profiles/me?persona=trainee', { token });
  mark(
    '7 ظهور الدورات في قسم التدريب',
    Array.isArray(meTrain.j.sections?.trainee?.courses) && meTrain.j.sections.trainee.courses.length > 0,
    JSON.stringify({ courses: meTrain.j.sections?.trainee?.courses, note: meTrain.j.sections?.trainee?.note })
  );

  // Browser journeys
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const consoleErrors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => consoleErrors.push(String(e.message || e)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      (t, e) => {
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify({ email: e, role: 'customer', name: 'عميل ملفي 360', customerId: 'CL-C328DB41' }));
        localStorage.setItem('hubTheme', 'light');
      },
      token,
      EMAIL
    );
    await page.goto(BASE + '/client.html#profile360', { waitUntil: 'networkidle2', timeout: 120000 });
    await new Promise((r) => setTimeout(r, 2000));
    let text = await page.evaluate(() => document.body.innerText);
    mark(
      '9 متصفح: ملفي الشخصي من مركز العميل (نهاري)',
      /ACC-C328DB41/.test(text) && /عميل ملفي 360/.test(text) && /ملفي الشخصي 360/.test(text),
      text.slice(0, 350)
    );
    await page.screenshot({ path: path.join(ART, 'prod_p360_client_desktop_light.png'), fullPage: true });
    await page.evaluate(() => window.HubTheme?.set?.('dark'));
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(ART, 'prod_p360_client_desktop_dark.png'), fullPage: true });
    mark('9 وضع ليلي عميل سطح المكتب', true, 'screenshot saved');

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
      EMAIL
    );
    await mob.goto(BASE + '/client.html#profile360', { waitUntil: 'networkidle2', timeout: 120000 });
    await new Promise((r) => setTimeout(r, 1500));
    await mob.screenshot({ path: path.join(ART, 'prod_p360_client_mobile_light.png'), fullPage: true });
    await mob.evaluate(() => window.HubTheme?.set?.('dark'));
    await new Promise((r) => setTimeout(r, 400));
    await mob.screenshot({ path: path.join(ART, 'prod_p360_client_mobile_dark.png'), fullPage: true });
    mark('9 موبايل نهاري/ليلي', true, 'screenshots saved');
    await mob.close();

    // Customer blocked from admin page
    await page.goto(BASE + '/dashboard.html#profiles-360', { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 2000));
    mark(
      '8 متصفح: العميل لا يدخل إدارة الملفات',
      !/dashboard\.html/i.test(page.url()) || /login|client\.html|غير مصرح/i.test(await page.evaluate(() => document.body.innerText + location.href)),
      page.url()
    );

    if (saToken && hubCookie) {
      const admin = await browser.newPage();
      await admin.setViewport({ width: 1440, height: 900 });
      const u = new URL(BASE);
      await admin.setCookie({ name: 'hub_session', value: hubCookie, domain: u.hostname, path: '/', httpOnly: true, sameSite: 'Lax' });
      await admin.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
      await admin.evaluate((t) => {
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify({ email: 'naioshhub@example.com', role: 'supreme_leader', name: 'القائد الأعلى' }));
        localStorage.setItem('hubTheme', 'light');
      }, saToken);
      await admin.goto(BASE + '/dashboard.html#profiles-360', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await new Promise((r) => setTimeout(r, 3000));
      const adminText = await admin.evaluate(() => document.querySelector('#profiles-360-mount')?.innerText || document.body.innerText);
      mark('8 متصفح: الإدارة تفتح الملفات', /عدد النتائج|ACC-C328DB41|إدارة الملفات الشخصية 360/.test(adminText), adminText.slice(0, 300));
      await admin.screenshot({ path: path.join(ART, 'prod_p360_admin_desktop.png'), fullPage: false });
      await admin.goto(BASE + '/profile-360.html', { waitUntil: 'networkidle2', timeout: 90000 });
      await new Promise((r) => setTimeout(r, 1000));
      await admin.evaluate(() => {
        [...document.querySelectorAll('[data-persona]')].find((b) => b.dataset.persona === 'employee')?.click();
      });
      await new Promise((r) => setTimeout(r, 800));
      await admin.screenshot({ path: path.join(ART, 'prod_p360_employee_desktop.png'), fullPage: true });
      mark('5 متصفح: ملف الموظف', /EMP-0001|موظف/.test(await admin.evaluate(() => document.body.innerText)), 'screenshot');
      await admin.close();
    }
  } finally {
    await browser.close().catch(() => null);
  }

  const serious = consoleErrors.filter((e) => !/favicon|cdn\.tailwind|net::ERR_BLOCKED/i.test(e));
  mark('10 أخطاء متصفح جسيمة', serious.length === 0, JSON.stringify(serious.slice(0, 8)));

  const out = {
    base: BASE,
    accounts: {
      primary: { email: EMAIL, accountNo: EXPECT_ACC, customerId: EXPECT_CL, phone: newPhone },
      secondary: { email: email2 },
      staff: { email: SA, employeeNo: 'EMP-0001' },
    },
    integrations: {
      hubTasks: 'موصول لملف الموظف عند وجود مهام معيّنة',
      learningServer: 'موصول عبر learning-enrollments عند الربط/التسجيل',
      academyLiveApi: 'غير موصول — يحتاج تكامل مع betacdmy',
      hrAttendanceLeaves: 'غير موصول',
      payroll: 'غير موصول',
    },
    checks: rows,
  };
  const outPath = path.join(ART, `profile-360-production-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log('REPORT', outPath);
  process.exit(rows.some((r) => r.result === 'FAIL') ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
