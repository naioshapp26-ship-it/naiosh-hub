#!/usr/bin/env node
/** E2E: Unified Profile 360 — multi-persona, privacy, no self-employee promotion. */
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
  rows.push({ check: c, result: p ? 'PASS' : 'FAIL', evidence: String(e || '').slice(0, 400) });
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

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  const stamp = Date.now().toString(36);
  const email = `p360.${stamp}@naiosh-test.com`;
  const pass = 'Test360!';

  // 1) Register customer
  const reg = await json('/api/auth/register', {
    method: 'POST',
    body: {
      fullName: 'عميل ملف 360',
      username: ('p360' + stamp).slice(0, 32),
      email,
      phone: `+9665${String(Date.now()).slice(-8)}`,
      password: pass,
      confirmPassword: pass,
      termsAccepted: true,
    },
  });
  mark('إنشاء عميل جديد', reg.status === 201 || reg.j.ok, JSON.stringify({ status: reg.status, msg: reg.j.message }));

  const login = await json('/api/auth/login', { method: 'POST', body: { email, password: pass } });
  const custToken = login.j.token;
  mark('دخول العميل', !!custToken, JSON.stringify({ status: login.status, role: login.j.user?.role }));

  // 2) Profile me — client persona
  const me = await json('/api/hub/profiles/me', { token: custToken });
  mark(
    'ملف العميل 360 متاح',
    me.j.ok && me.j.header && (me.j.header.personas || []).some((p) => p.type === 'client'),
    JSON.stringify({
      accountNo: me.j.header?.accountNo,
      personas: me.j.header?.personas,
      clientAvail: me.j.sections?.client?.available,
    })
  );

  // 3) Attach trainee / trainer / freelancer / member
  for (const type of ['trainee', 'trainer', 'freelancer', 'member']) {
    const r = await json('/api/hub/profiles/me/persona', {
      method: 'POST',
      token: custToken,
      body: {
        type,
        meta:
          type === 'freelancer'
            ? { specialty: 'تصميم', skills: ['Figma'] }
            : type === 'trainer'
              ? { specialties: ['قيادة'] }
              : type === 'member'
                ? { tier: 'أساسي', membershipId: 'MEM-' + stamp }
                : { courses: [] },
      },
    });
    mark('تفعيل صفة ' + type, r.j.ok, JSON.stringify({ status: r.status, err: r.j.error }));
  }

  // 4) Self employee promotion blocked
  const selfEmp = await json('/api/hub/profiles/me/persona', {
    method: 'POST',
    token: custToken,
    body: { type: 'employee', refs: { employeeNo: 'EMP-9999' } },
  });
  mark('منع الترقية الذاتية لموظف', selfEmp.status === 403, JSON.stringify({ status: selfEmp.status, err: selfEmp.error || selfEmp.j.error }));

  // 5) Switch personas
  const act = await json('/api/hub/profiles/me/persona', {
    method: 'POST',
    token: custToken,
    body: { type: 'freelancer', activate: true },
  });
  const me2 = await json('/api/hub/profiles/me', { token: custToken });
  mark(
    'التبديل بين الصفات بدون حساب جديد',
    act.j.ok && me2.j.header?.activePersona === 'freelancer' && me2.j.header?.accountNo === me.j.header?.accountNo,
    JSON.stringify({ active: me2.j.header?.activePersona, accountNo: me2.j.header?.accountNo })
  );

  // 6) Freelancer meta
  const meta = await json('/api/hub/profiles/me/persona/freelancer', {
    method: 'PATCH',
    token: custToken,
    body: { meta: { skills: ['Figma', 'UI'], portfolio: [{ name: 'عمل تجريبي', url: '#' }] } },
  });
  mark('تحديث مهارات المستقل', meta.j.ok, JSON.stringify({ status: meta.status }));

  // 7) Privacy — other customer cannot view
  const email2 = `p360b.${stamp}@naiosh-test.com`;
  await json('/api/auth/register', {
    method: 'POST',
    body: {
      fullName: 'عميل آخر',
      username: ('p360b' + stamp).slice(0, 32),
      email: email2,
      phone: `+9665${String(Date.now() + 3).slice(-8)}`,
      password: pass,
      confirmPassword: pass,
      termsAccepted: true,
    },
  });
  const login2 = await json('/api/auth/login', { method: 'POST', body: { email: email2, password: pass } });
  const peek = await json('/api/hub/profiles/by-email/' + encodeURIComponent(email), { token: login2.j.token });
  mark('منع عميل من ملف عميل آخر', peek.status === 401 || peek.status === 403, JSON.stringify({ status: peek.status, err: peek.j.error }));

  // 8) Staff path (optional if password available)
  let staffOk = false;
  if (SA_PASS) {
    const sa = await json('/api/auth/login', { method: 'POST', body: { email: SA, password: SA_PASS } });
    staffOk = !!sa.j.token;
    mark('دخول موظف/قائد للاختبار الإداري', staffOk, JSON.stringify({ status: sa.status, err: sa.j.error }));
    if (staffOk) {
      const list = await json('/api/hub/profiles?q=' + encodeURIComponent(email), { token: sa.j.token });
      mark('إدارة الملفات: بحث بالبريد', (list.j.items || []).some((i) => i.email === email), JSON.stringify({ count: (list.j.items || []).length }));
      const view = await json('/api/hub/profiles/by-email/' + encodeURIComponent(email), { token: sa.j.token });
      mark('إدارة: عرض ملف العميل', view.j.ok && view.j.header?.email === email, JSON.stringify({ personas: view.j.header?.personas }));
      // finance visible to staff with billing.view
      const fin = view.j.sections?.client?.wallet;
      mark(
        'المالية ظاهرة للمخوّل أو محجوبة بوضوح',
        fin && (fin.restricted || typeof fin.total === 'number' || fin === 'لا توجد بيانات بعد' || fin.paid != null),
        JSON.stringify(fin)
      );
    }
  } else {
    mark('دخول موظف/قائد للاختبار الإداري', false, 'missing SA password in env');
  }

  // Browser screenshots
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
      (e, p, t) => {
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify({ email: e, role: 'customer', name: 'عميل ملف 360' }));
      },
      email,
      pass,
      custToken
    );
    await json('/api/hub/profiles/me/persona', {
      method: 'POST',
      token: custToken,
      body: { type: 'client', activate: true },
    });
    await page.goto(BASE + '/profile-360.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1000));
    await page.evaluate(() => {
      window.HubTheme?.set?.('light');
      const btn = [...document.querySelectorAll('[data-persona]')].find((b) => b.dataset.persona === 'client');
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: path.join(ART, 'profile360_client_desktop_light.png'), fullPage: true });
    await page.evaluate(() => window.HubTheme?.set?.('dark'));
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(ART, 'profile360_client_desktop_dark.png'), fullPage: true });

    // switch persona UI — capture each self-servable persona
    for (const persona of ['trainee', 'trainer', 'freelancer', 'member']) {
      await page.evaluate((p) => {
        const btn = [...document.querySelectorAll('[data-persona]')].find((b) => b.dataset.persona === p);
        btn?.click();
      }, persona);
      await new Promise((r) => setTimeout(r, 900));
      await page.screenshot({ path: path.join(ART, `profile360_${persona}_desktop.png`), fullPage: true });
    }

    // ensure client persona active for mobile client shots
    await json('/api/hub/profiles/me/persona', {
      method: 'POST',
      token: custToken,
      body: { type: 'client', activate: true },
    });

    // mobile light + dark for client
    const mob = await browser.newPage();
    await mob.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await mob.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
    await mob.evaluate(
      (t, e) => {
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify({ email: e, role: 'customer', name: 'عميل ملف 360' }));
        localStorage.setItem('hubTheme', 'light');
      },
      custToken,
      email
    );
    await mob.goto(BASE + '/profile-360.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 800));
    await mob.evaluate(() => {
      window.HubTheme?.set?.('light');
      const btn = [...document.querySelectorAll('[data-persona]')].find((b) => b.dataset.persona === 'client');
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 700));
    await mob.screenshot({ path: path.join(ART, 'profile360_client_mobile_light.png'), fullPage: true });
    await mob.evaluate(() => {
      localStorage.setItem('hubTheme', 'dark');
      window.HubTheme?.set?.('dark');
    });
    await new Promise((r) => setTimeout(r, 500));
    await mob.screenshot({ path: path.join(ART, 'profile360_client_mobile_dark.png'), fullPage: true });
    // mobile member
    await mob.evaluate(() => {
      const btn = [...document.querySelectorAll('[data-persona]')].find((b) => b.dataset.persona === 'member');
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    await mob.screenshot({ path: path.join(ART, 'profile360_member_mobile.png'), fullPage: true });
    await mob.close();

    if (staffOk) {
      // Cookie-backed login — dashboard.html is gated by hub_session HttpOnly cookie
      const saRes = await fetch(BASE + '/api/auth/login', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: SA, password: SA_PASS }),
      });
      const saBody = await saRes.json().catch(() => ({}));
      const saToken = saBody.token;
      const setCookie = saRes.headers.getSetCookie?.() || [];
      const cookieHeader = setCookie.join(',') || saRes.headers.get('set-cookie') || '';
      const cookieMatch = cookieHeader.match(/hub_session=([^;]+)/);
      const hubCookie = cookieMatch ? cookieMatch[1] : saToken;
      mark('جلسة كوكي للإدارة', !!saToken && !!hubCookie, cookieMatch ? 'hub_session from Set-Cookie' : 'fallback token');

      const empPage = await browser.newPage();
      await empPage.setViewport({ width: 1440, height: 900 });
      const u = new URL(BASE);
      await empPage.setCookie({
        name: 'hub_session',
        value: hubCookie,
        domain: u.hostname,
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      });
      await empPage.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
      await empPage.evaluate((t, user) => {
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify(user));
        localStorage.setItem('hubTheme', 'light');
      }, saToken, saBody.user || { email: SA, role: 'supreme_leader', name: 'القائد الأعلى' });

      await empPage.goto(BASE + '/profile-360.html', { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 1000));
      await empPage.evaluate(() => {
        const btn = [...document.querySelectorAll('[data-persona]')].find((b) => b.dataset.persona === 'employee');
        btn?.click();
      });
      await new Promise((r) => setTimeout(r, 900));
      await empPage.screenshot({ path: path.join(ART, 'profile360_employee_desktop.png'), fullPage: true });
      await empPage.evaluate(() => window.HubTheme?.set?.('dark'));
      await new Promise((r) => setTimeout(r, 400));
      await empPage.screenshot({ path: path.join(ART, 'profile360_employee_desktop_dark.png'), fullPage: true });

      await empPage.goto(BASE + '/dashboard.html#profiles-360', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await empPage.waitForFunction(() => /dashboard\.html/i.test(location.href), { timeout: 30000 }).catch(() => null);
      await empPage.evaluate(() => {
        if (location.hash !== '#profiles-360') {
          location.hash = 'profiles-360';
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }
      });
      await empPage.waitForSelector('#profiles-360-mount', { timeout: 60000 }).catch(() => null);
      await empPage.evaluate(() => {
        const link = [...document.querySelectorAll('a,button,[data-section],.nav-item,.sidebar a, .sidebar-nav *')].find((el) =>
          /الملفات الشخصية 360|profiles-360/i.test(el.textContent + (el.getAttribute('href') || '') + (el.dataset?.section || ''))
        );
        link?.click();
      });
      await new Promise((r) => setTimeout(r, 2500));
      const adminHtml = await empPage.evaluate(
        () => document.querySelector('#profiles-360-mount')?.innerHTML?.slice(0, 240) || document.body.innerText.slice(0, 240)
      );
      mark('لقطة إدارة الملفات الشخصية 360', /p360|بحث|ملف|profile|إدارة/i.test(adminHtml) && !/تسجيل الدخول/i.test(adminHtml), adminHtml);
      await empPage.screenshot({ path: path.join(ART, 'profile360_admin_desktop.png'), fullPage: false });
      await empPage.close();
    }
  } finally {
    await browser.close().catch(() => null);
  }

  // Refresh persistence
  const again = await json('/api/hub/profiles/me', { token: custToken });
  mark(
    'استمرار الصفات بعد إعادة التحميل',
    (again.j.header?.personas || []).filter((p) => p.status === 'active').length >= 5,
    JSON.stringify(again.j.header?.personas)
  );

  const out = path.join(ART, `profile-360-e2e-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify({ base: BASE, email, checks: rows }, null, 2));
  console.log('REPORT', out);
  process.exit(rows.some((r) => r.result === 'FAIL') ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
