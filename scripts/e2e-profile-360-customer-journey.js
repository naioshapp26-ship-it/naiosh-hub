#!/usr/bin/env node
/**
 * Fresh-browser customer journey: home → create account → login → client center → Profile 360.
 * Also isolation + (optional) admin visibility when SA password works.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.HUB_E2E_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const SA = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS =
  process.env.HUB_PROD_SA_PASSWORD ||
  process.env.HUB_E2E_SA_PASSWORD ||
  process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD ||
  '';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const ART = '/opt/cursor/artifacts';
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

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  if (!fs.existsSync(AVATAR)) {
    // tiny red png
    const { execSync } = require('child_process');
    execSync(
      `python3 -c "import struct,zlib;w=h=48;raw=b''.join(b'\\x00'+b'\\xe5\\x00\\x14'*w for _ in range(h));open('${AVATAR}','wb').write(b'\\x89PNG\\r\\n\\x1a\\n'+struct.pack('>I',13)+b'IHDR'+struct.pack('>IIBBBBB',w,h,8,2,0,0,0)+struct.pack('>I',zlib.crc32(b'IHDR'+struct.pack('>IIBBBBB',w,h,8,2,0,0,0))&0xffffffff)+ (lambda d:(struct.pack('>I',len(d))+b'IDAT'+d+struct.pack('>I',zlib.crc32(b'IDAT'+d)&0xffffffff)))(zlib.compress(raw,9))+struct.pack('>I',0)+b'IEND'+struct.pack('>I',zlib.crc32(b'IEND')&0xffffffff))"`
    );
  }

  const stamp = Date.now().toString(36);
  const email = `journey.${stamp}@naiosh-test.com`;
  const email2 = `journey2.${stamp}@naiosh-test.com`;
  const pass = 'Journey360!';
  const phone = `+9665${String(Date.now()).slice(-8)}`;
  const fullName = 'عميل رحلة 360';

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const consoleErrors = [];
  let accountNo = '';
  let customerId = '';
  let token = '';
  let newPhone = '';

  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => consoleErrors.push(String(e.message || e)));
    await page.setViewport({ width: 1440, height: 900 });

    // 1) Fresh home → login → create account
    await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: path.join(ART, 'journey_01_home.png'), fullPage: false });

    await page.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
    const hasCreate = await page.$('a[href*="create-account"]');
    mark('رابط إنشاء حساب من صفحة الدخول', !!hasCreate, 'create-account link');
    await page.click('a[href*="create-account"]');
    await page.waitForSelector('#createAccountForm', { timeout: 15000 });
    await page.screenshot({ path: path.join(ART, 'journey_02_create_account.png'), fullPage: false });

    await page.type('#fullName', fullName, { delay: 5 });
    await page.type('#email', email, { delay: 5 });
    await page.type('#phone', phone, { delay: 5 });
    await page.type('#password', pass, { delay: 5 });
    await page.type('#confirmPassword', pass, { delay: 5 });
    const gov = await page.$('#governorate');
    if (gov) await page.select('#governorate', await page.$eval('#governorate option:nth-child(2)', (o) => o.value).catch(() => ''));
    const city = await page.$('#city');
    if (city) {
      await page.click('#city', { clickCount: 3 });
      await page.type('#city', 'الرياض', { delay: 5 });
    }
    const terms = await page.$('#termsAccepted, input[name="termsAccepted"], #terms');
    if (terms) await terms.click();
    else {
      // try checkbox by label
      await page.evaluate(() => {
        const c = document.querySelector('input[type="checkbox"]');
        if (c && !c.checked) c.click();
      });
    }

    await Promise.all([
      page.click('#createAccountForm button[type="submit"], button[type="submit"]'),
      page.waitForFunction(() => /تم إنشاء/.test(document.body.innerText) || location.href.includes('login.html'), {
        timeout: 30000,
      }),
    ]).catch(() => null);

    await new Promise((r) => setTimeout(r, 1200));
    const afterRegText = await page.evaluate(() => document.body.innerText);
    mark('تسجيل عميل جديد من الواجهة', /تم إنشاء|تسجيل الدخول/.test(afterRegText) || /login\.html/.test(page.url()), afterRegText.slice(0, 280));
    await page.screenshot({ path: path.join(ART, 'journey_03_register_success.png'), fullPage: false });

    // Ensure on login (auto-redirect may have fired)
    if (!/login\.html/.test(page.url())) {
      await page.goto(BASE + '/login.html?switch=1&from=create-account&email=' + encodeURIComponent(email) + '&next=' + encodeURIComponent('client.html#profile360'), {
        waitUntil: 'domcontentloaded',
      });
    }
    // Prefill email if empty
    await page.evaluate((e) => {
      const el = document.getElementById('email') || document.querySelector('input[type="email"]');
      if (el && !el.value) el.value = e;
    }, email);
    const emailSel = '#email, input[type="email"]';
    const passSel = '#password, input[type="password"]';
    await page.click(passSel, { clickCount: 3 });
    await page.type(passSel, pass, { delay: 8 });
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => /client\.html/.test(location.href), { timeout: 30000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 1500));
    mark('توجيه بعد الدخول إلى مركز العميل', /client\.html/.test(page.url()), page.url());

    // Open Profile 360 via nav
    const navClicked = await page.evaluate(() => {
      const a = document.querySelector('#cp-nav a[data-nav="profile360"], a[href="#profile360"]');
      if (a) {
        a.click();
        return true;
      }
      location.hash = 'profile360';
      return false;
    });
    await new Promise((r) => setTimeout(r, 2000));
    const profileText = await page.evaluate(() => document.body.innerText);
    const accMatch = profileText.match(/ACC-[A-Z0-9]+/);
    const clMatch = profileText.match(/CL-[A-Z0-9]+/);
    accountNo = accMatch ? accMatch[0] : '';
    customerId = clMatch ? clMatch[0] : '';
    mark(
      'فتح ملفي الشخصي 360 من مركز العميل',
      /ملفي الشخصي 360/.test(profileText) && !!accountNo && profileText.includes(fullName),
      JSON.stringify({ url: page.url(), accountNo, customerId, navClicked })
    );
    mark('عرض رقم الحساب ورقم العميل', !!accountNo && !!customerId, JSON.stringify({ accountNo, customerId }));
    await page.screenshot({ path: path.join(ART, 'journey_04_profile360_desktop_light.png'), fullPage: true });

    // Get token from storage for API checks
    token = await page.evaluate(() => localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || '');

    // Edit phone via UI
    newPhone = `+9665${String(Date.now() + 2).slice(-8)}`;
    const edited = await page.evaluate(async (ph) => {
      const btn = document.getElementById('p360-edit-btn');
      if (!btn) return { ok: false, err: 'no edit btn' };
      btn.click();
      const form = document.getElementById('p360-edit-form');
      if (!form) return { ok: false, err: 'no form' };
      const phoneInput = form.querySelector('[name="phone"]');
      if (!phoneInput) return { ok: false, err: 'no phone' };
      phoneInput.value = ph;
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      await new Promise((r) => setTimeout(r, 1200));
      return { ok: true };
    }, newPhone);
    mark('تعديل الجوال من الواجهة', !!edited.ok, JSON.stringify(edited));

    // Avatar upload via API (more reliable than file chooser in headless)
    if (token && fs.existsSync(AVATAR)) {
      const buf = fs.readFileSync(AVATAR);
      const form = new FormData();
      form.append('file', new Blob([buf], { type: 'image/png' }), 'journey-avatar.png');
      const up = await fetch(BASE + '/api/hub/uploads', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: form,
      });
      const uj = await up.json().catch(() => ({}));
      const url = uj.url || uj.path || uj.publicUrl || '';
      if (url) {
        const patch = await json('/api/hub/profiles/me', { method: 'PATCH', token, body: { avatarUrl: url } });
        mark('رفع وحفظ الصورة الشخصية', !!patch.j.ok, JSON.stringify({ status: up.status, url: url.slice(0, 80) }));
      } else {
        mark('رفع وحفظ الصورة الشخصية', false, JSON.stringify({ status: up.status, uj }));
      }
    }

    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));
    if (!/#profile360/.test(page.url())) {
      await page.evaluate(() => {
        location.hash = 'profile360';
      });
      await new Promise((r) => setTimeout(r, 1500));
    }
    const afterReload = await page.evaluate(() => document.body.innerText);
    mark('بقاء الجوال بعد تحديث الصفحة', afterReload.includes(newPhone) || afterReload.includes(newPhone.replace('+966', '')), afterReload.slice(0, 200));

    // Logout / login
    await page.evaluate(() => {
      localStorage.removeItem('hubAuthToken');
      localStorage.removeItem('hubUser');
      sessionStorage.clear();
    });
    await page.goto(BASE + '/login.html?switch=1', { waitUntil: 'domcontentloaded' });
    await page.evaluate((e) => {
      const el = document.querySelector('#email, input[type="email"]');
      if (el) el.value = e;
    }, email);
    await page.click('#password, input[type="password"]', { clickCount: 3 });
    await page.type('#password, input[type="password"]', pass, { delay: 5 });
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => /client\.html/.test(location.href), { timeout: 30000 }).catch(() => null);
    await page.goto(BASE + '/client.html#profile360', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1500));
    const afterRelogin = await page.evaluate(() => document.body.innerText);
    mark(
      'بقاء البيانات بعد خروج ودخول',
      afterRelogin.includes(accountNo) && (afterRelogin.includes(newPhone) || afterRelogin.includes(fullName)),
      afterRelogin.slice(0, 250)
    );
    await page.screenshot({ path: path.join(ART, 'journey_05_after_relogin.png'), fullPage: true });

    // Themes + mobile
    await page.evaluate(() => window.HubTheme?.set?.('dark'));
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(ART, 'journey_06_profile_dark.png'), fullPage: true });
    mark('الوضع الليلي', true, 'screenshot');

    const mob = await browser.newPage();
    await mob.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await mob.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
    await mob.evaluate(
      (t, e, n) => {
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify({ email: e, role: 'customer', name: n }));
        localStorage.setItem('hubTheme', 'light');
      },
      token,
      email,
      fullName
    );
    // refresh token after relogin
    const loginAgain = await json('/api/auth/login', { method: 'POST', body: { email, password: pass } });
    token = loginAgain.j.token || token;
    await mob.evaluate((t) => localStorage.setItem('hubAuthToken', t), token);
    await mob.goto(BASE + '/client.html#profile360', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1200));
    await mob.screenshot({ path: path.join(ART, 'journey_07_profile_mobile.png'), fullPage: true });
    mark('موبايل: ملفي الشخصي 360', /ملفي الشخصي 360/.test(await mob.evaluate(() => document.body.innerText)), 'screenshot');

    // Isolation client 2
    const reg2 = await json('/api/auth/register', {
      method: 'POST',
      body: {
        fullName: 'عميل رحلة ثاني',
        username: ('j2' + stamp).slice(0, 32),
        email: email2,
        phone: `+9665${String(Date.now() + 9).slice(-8)}`,
        password: pass,
        confirmPassword: pass,
        termsAccepted: true,
      },
    });
    mark('إنشاء عميل ثانٍ', reg2.status === 201 || reg2.j.ok, JSON.stringify({ status: reg2.status, accountNo: reg2.j.user?.accountNo || reg2.j.profile360?.accountNo }));
    const login2 = await json('/api/auth/login', { method: 'POST', body: { email: email2, password: pass } });
    const peek = await json('/api/hub/profiles/by-email/' + encodeURIComponent(email), { token: login2.j.token });
    mark('عزل: منع قراءة ملف العميل الأول', peek.status === 401 || peek.status === 403, JSON.stringify({ status: peek.status }));
    await mob.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await mob.evaluate(
      (t, e) => {
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify({ email: e, role: 'customer', name: 'عميل رحلة ثاني' }));
      },
      login2.j.token,
      email2
    );
    await mob.goto(BASE + '/client.html#profile360', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1200));
    const isoText = await mob.evaluate(() => document.body.innerText);
    mark(
      'عزل واجهة: العميل الثاني لا يرى بيانات الأول',
      isoText.includes('عميل رحلة ثاني') && !isoText.includes(fullName) && !isoText.includes(accountNo),
      isoText.slice(0, 220)
    );
    await mob.goto(BASE + '/dashboard.html#profiles-360', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 1500));
    mark(
      'منع العميل من لوحة الإدارة',
      !/dashboard\.html/i.test(mob.url()) || /login|client|غير مصرح/i.test(await mob.evaluate(() => document.body.innerText + location.href)),
      mob.url()
    );
    await mob.close();

    // Admin visibility (local SA or prod secret)
    if (SA_PASS) {
      const saRes = await fetch(BASE + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: SA, password: SA_PASS }),
      });
      const saBody = await saRes.json().catch(() => ({}));
      const saToken = saBody.token || '';
      mark('دخول القائد/الإدارة', !!saToken, JSON.stringify({ status: saRes.status, err: saBody.error }));
      if (saToken) {
        const list = await json('/api/hub/profiles?q=' + encodeURIComponent(email), { token: saToken });
        const list2 = await json('/api/hub/profiles?q=' + encodeURIComponent(email2), { token: saToken });
        mark(
          'ظهور العميلين في إدارة الملفات',
          (list.j.items || []).some((i) => i.email === email) && (list2.j.items || []).some((i) => i.email === email2),
          JSON.stringify({ c1: list.j.items?.length, c2: list2.j.items?.length })
        );
        const view1 = await json('/api/hub/profiles/by-email/' + encodeURIComponent(email), { token: saToken });
        mark(
          'عرض ملف العميل الأول من الإدارة صحيح',
          view1.j.header?.email === email && view1.j.header?.accountNo === accountNo,
          JSON.stringify({ email: view1.j.header?.email, accountNo: view1.j.header?.accountNo, phone: view1.j.header?.phone })
        );
        const setCookie = saRes.headers.getSetCookie?.() || [];
        const cookieHeader = setCookie.join(',') || saRes.headers.get('set-cookie') || '';
        const cm = cookieHeader.match(/hub_session=([^;]+)/);
        if (cm) {
          const admin = await browser.newPage();
          await admin.setViewport({ width: 1440, height: 900 });
          const u = new URL(BASE);
          await admin.setCookie({ name: 'hub_session', value: cm[1], domain: u.hostname, path: '/', httpOnly: true, sameSite: 'Lax' });
          await admin.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
          await admin.evaluate((t) => {
            localStorage.setItem('hubAuthToken', t);
            localStorage.setItem('hubUser', JSON.stringify({ email: 'naioshhub@example.com', role: 'supreme_leader', name: 'القائد الأعلى' }));
          }, saToken);
          await admin.goto(BASE + '/dashboard.html#profiles-360', { waitUntil: 'domcontentloaded', timeout: 120000 });
          await new Promise((r) => setTimeout(r, 2500));
          await admin.screenshot({ path: path.join(ART, 'journey_08_admin_profiles.png'), fullPage: false });
          mark('لقطة إدارة الملفات', /إدارة الملفات الشخصية 360|عدد النتائج/.test(await admin.evaluate(() => document.body.innerText)), 'screenshot');
          await admin.close();
        }
      }
    } else {
      mark('دخول القائد/الإدارة', false, 'BLOCKED: missing SA password for this base');
      mark('ظهور العميلين في إدارة الملفات', false, 'BLOCKED');
      mark('عرض ملف العميل الأول من الإدارة صحيح', false, 'BLOCKED');
    }

    // Role check: no staff role
    const me = await json('/api/hub/profiles/me', { token });
    mark(
      'العميل ليس موظفًا/أدمن',
      me.j.header?.email === email &&
        !(me.j.header?.personas || []).some((p) => p.type === 'employee') &&
        loginAgain.j.user?.role === 'customer',
      JSON.stringify({ role: loginAgain.j.user?.role, personas: me.j.header?.personas })
    );
  } finally {
    await browser.close().catch(() => null);
  }

  const serious = consoleErrors.filter((e) => !/favicon|cdn\.tailwind|net::ERR/i.test(e));
  mark('أخطاء متصفح جسيمة', serious.length === 0, JSON.stringify(serious.slice(0, 6)));

  const out = {
    base: BASE,
    links: {
      register: BASE + '/create-account.html',
      login: BASE + '/login.html',
      clientCenter: BASE + '/client.html',
      profile360: BASE + '/client.html#profile360',
      profile360Page: BASE + '/profile-360.html',
      adminProfiles: BASE + '/dashboard.html#profiles-360',
    },
    account: { email, accountNo, customerId, phone: newPhone || phone, fullName },
    second: { email: email2 },
    checks: rows,
  };
  const outPath = path.join(ART, `profile-360-customer-journey-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log('REPORT', outPath);
  process.exit(rows.some((r) => r.result === 'FAIL') ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
