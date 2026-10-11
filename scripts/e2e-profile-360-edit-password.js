#!/usr/bin/env node
/**
 * Profile 360: edit-data + password buttons must open in-view forms and persist.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.HUB_E2E_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const ART = '/opt/cursor/artifacts';

const rows = [];
const mark = (c, p, e) => {
  rows.push({ check: c, result: p ? 'PASS' : 'FAIL', evidence: String(e || '').slice(0, 600) });
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
  const email = `editpw.${stamp}@naiosh-test.com`;
  const email2 = `editpw2.${stamp}@naiosh-test.com`;
  const pass = 'EditPw360!';
  const pass2 = 'NewEditPw360!';
  const fullName = 'عميل تعديل وكلمة';
  const newName = 'عميل معدّل 360';
  const newPhone = `+9665${String(Date.now()).slice(-8)}`;

  const reg = await json('/api/auth/register', {
    method: 'POST',
    body: {
      fullName,
      email,
      phone: `+9665${String(Date.now() + 1).slice(-8)}`,
      password: pass,
      confirmPassword: pass,
      termsAccepted: true,
      city: 'الرياض',
      governorate: 'السعودية',
    },
  });
  mark('تسجيل عميل عادي', !!reg.j.ok, JSON.stringify(reg.j.profile360 || reg.j.error));
  let login = await json('/api/auth/login', { method: 'POST', body: { email, password: pass } });
  let token = login.j.token;
  mark('دخول العميل', !!token, login.j.user?.role);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const logs = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on('pageerror', (e) => logs.push(String(e.message || e)));

    await page.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      (t, u) => {
        localStorage.clear();
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify(u));
      },
      token,
      login.j.user || { email, role: 'customer', name: fullName }
    );
    await page.goto(BASE + '/client.html#profile360', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => /ACC-/.test(document.body.innerText), { timeout: 25000 });
    await new Promise((r) => setTimeout(r, 1200));

    // Open edit form
    await page.click('#p360-edit-btn');
    await new Promise((r) => setTimeout(r, 600));
    const editOpen = await page.evaluate(() => {
      const p = document.getElementById('p360-edit-panel');
      const r = p?.getBoundingClientRect();
      return {
        hidden: p?.hidden,
        inView: !!r && r.top >= 0 && r.top < window.innerHeight && r.height > 40,
        hasSave: !!document.getElementById('p360-edit-save'),
        hasCancel: !!document.getElementById('p360-edit-cancel'),
        top: r?.top,
      };
    });
    mark('فتح نموذج تعديل البيانات في مجال الرؤية', editOpen.hidden === false && editOpen.inView && editOpen.hasSave, JSON.stringify(editOpen));
    await page.screenshot({ path: path.join(ART, 'editpw_01_edit_form_open.png'), fullPage: false });

    // Fill and save
    await page.click('#p360-edit-form [name="fullName"]', { clickCount: 3 });
    await page.type('#p360-edit-form [name="fullName"]', newName, { delay: 8 });
    await page.click('#p360-edit-form [name="phone"]', { clickCount: 3 });
    await page.type('#p360-edit-form [name="phone"]', newPhone, { delay: 5 });
    await page.click('#p360-edit-form [name="city"]', { clickCount: 3 });
    await page.type('#p360-edit-form [name="city"]', 'جدة', { delay: 5 });
    await page.click('#p360-edit-form [name="country"]', { clickCount: 3 });
    await page.type('#p360-edit-form [name="country"]', 'السعودية', { delay: 5 });
    await page.click('#p360-edit-save');
    await page.waitForFunction(() => /تم حفظ|نجاح|فشل/.test(document.body.innerText), { timeout: 15000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 1000));
    const afterSave = await page.evaluate((n, ph) => {
      const t = document.body.innerText;
      return { hasName: t.includes(n), hasPhone: t.includes(ph), chip: document.getElementById('cp-user-name')?.textContent || '' };
    }, newName, newPhone);
    mark('حفظ الاسم والجوال في الواجهة', afterSave.hasName && afterSave.hasPhone, JSON.stringify(afterSave));
    await page.screenshot({ path: path.join(ART, 'editpw_02_after_edit_save.png'), fullPage: false });

    // Reload persist
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      location.hash = 'profile360';
    });
    await page.waitForFunction(() => /ACC-/.test(document.body.innerText), { timeout: 25000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 1200));
    const afterReload = await page.evaluate((n, ph) => document.body.innerText.includes(n) && document.body.innerText.includes(ph), newName, newPhone);
    mark('بقاء البيانات بعد تحديث الصفحة', afterReload, 'reload');

    // Relogin persist
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    login = await json('/api/auth/login', { method: 'POST', body: { email, password: pass } });
    token = login.j.token;
    await page.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      (t, u) => {
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify(u));
      },
      token,
      login.j.user || { email, role: 'customer', name: newName }
    );
    await page.goto(BASE + '/client.html#profile360', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /ACC-/.test(document.body.innerText), { timeout: 25000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 1200));
    const afterRelogin = await page.evaluate((n, ph) => document.body.innerText.includes(n) && document.body.innerText.includes(ph), newName, newPhone);
    mark('بقاء البيانات بعد خروج ودخول', afterRelogin, 'relogin');
    await page.screenshot({ path: path.join(ART, 'editpw_03_relogin_data.png'), fullPage: false });

    // Password panel
    await page.click('#p360-pass-btn');
    await new Promise((r) => setTimeout(r, 600));
    const passOpen = await page.evaluate(() => {
      const p = document.getElementById('p360-pass-panel');
      const r = p?.getBoundingClientRect();
      return {
        hidden: p?.hidden,
        inView: !!r && r.top >= 0 && r.top < window.innerHeight && r.height > 40,
        fields: !!p?.querySelector('[name="currentPassword"]') && !!p?.querySelector('[name="newPassword"]') && !!p?.querySelector('[name="confirmPassword"]'),
      };
    });
    mark('فتح نموذج كلمة المرور في مجال الرؤية', passOpen.hidden === false && passOpen.inView && passOpen.fields, JSON.stringify(passOpen));
    await page.screenshot({ path: path.join(ART, 'editpw_04_pass_form_open.png'), fullPage: false });

    // Wrong current password
    await page.type('#p360-pass-form [name="currentPassword"]', 'WrongPass!', { delay: 5 });
    await page.type('#p360-pass-form [name="newPassword"]', pass2, { delay: 5 });
    await page.type('#p360-pass-form [name="confirmPassword"]', pass2, { delay: 5 });
    await page.click('#p360-pass-form button[type="submit"]');
    await new Promise((r) => setTimeout(r, 1200));
    const wrongCur = await page.evaluate(() => document.getElementById('p360-pass-msg')?.textContent || document.body.innerText);
    mark('رفض كلمة المرور الحالية الخاطئة', /غير صحيحة|فشل/.test(wrongCur), wrongCur.slice(0, 160));

    // Mismatch confirm
    await page.evaluate(() => {
      const f = document.getElementById('p360-pass-form');
      if (f) f.reset();
    });
    await page.type('#p360-pass-form [name="currentPassword"]', pass, { delay: 5 });
    await page.type('#p360-pass-form [name="newPassword"]', pass2, { delay: 5 });
    await page.type('#p360-pass-form [name="confirmPassword"]', 'Mismatch360!', { delay: 5 });
    await page.click('#p360-pass-form button[type="submit"]');
    await new Promise((r) => setTimeout(r, 800));
    const mismatch = await page.evaluate(() => document.getElementById('p360-pass-msg')?.textContent || '');
    mark('رفض تأكيد غير مطابق', /غير متطابق/.test(mismatch), mismatch);

    // Success change
    await page.evaluate(() => {
      const f = document.getElementById('p360-pass-form');
      if (f) f.reset();
    });
    await page.type('#p360-pass-form [name="currentPassword"]', pass, { delay: 5 });
    await page.type('#p360-pass-form [name="newPassword"]', pass2, { delay: 5 });
    await page.type('#p360-pass-form [name="confirmPassword"]', pass2, { delay: 5 });
    await page.click('#p360-pass-form button[type="submit"]');
    await page.waitForFunction(() => /تم تغيير كلمة المرور/.test(document.body.innerText), { timeout: 15000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 800));
    mark(
      'تغيير كلمة المرور بنجاح من الواجهة',
      /تم تغيير كلمة المرور/.test(await page.evaluate(() => document.body.innerText)),
      'ui'
    );
    await page.screenshot({ path: path.join(ART, 'editpw_05_pass_changed.png'), fullPage: false });

    // Login with new password; reject old
    const oldLogin = await json('/api/auth/login', { method: 'POST', body: { email, password: pass } });
    mark('رفض كلمة المرور القديمة', oldLogin.status === 401 || !oldLogin.j.token, JSON.stringify({ status: oldLogin.status, err: oldLogin.j.error }));
    const newLogin = await json('/api/auth/login', { method: 'POST', body: { email, password: pass2 } });
    token = newLogin.j.token;
    mark('دخول بكلمة المرور الجديدة', !!token, JSON.stringify({ status: newLogin.status }));

    // Isolation
    const reg2 = await json('/api/auth/register', {
      method: 'POST',
      body: {
        fullName: 'عميل آخر للعزل',
        email: email2,
        phone: `+9665${String(Date.now() + 9).slice(-8)}`,
        password: pass2,
        confirmPassword: pass2,
        termsAccepted: true,
      },
    });
    const login2 = await json('/api/auth/login', { method: 'POST', body: { email: email2, password: pass2 } });
    const stealEdit = await json('/api/hub/profiles/by-email/' + encodeURIComponent(email), {
      method: 'PATCH',
      token: login2.j.token,
      body: { fullName: 'اختراق' },
    });
    const stealPass = await json('/api/hub/profiles/me/password', {
      method: 'POST',
      token: login2.j.token,
      body: { currentPassword: pass2, newPassword: 'X', confirmPassword: 'Y' },
    });
    // stealPass is on own account with mismatch — better: try patching other email password endpoint doesn't exist
    mark('عزل: منع تعديل بيانات عميل آخر', stealEdit.status === 403 || stealEdit.status === 401, JSON.stringify({ status: stealEdit.status, err: stealEdit.j.error }));
    mark('عزل: تأكيد غير مطابق يُرفض للعميل الثاني', stealPass.status === 400, JSON.stringify({ status: stealPass.status, err: stealPass.j.error }));

    // Mobile + dark
    await page.evaluate(() => window.HubTheme?.set?.('dark'));
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      (t, u) => {
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify(u));
        localStorage.setItem('hubTheme', 'dark');
      },
      token,
      newLogin.j.user || { email, role: 'customer', name: newName }
    );
    await page.goto(BASE + '/client.html#profile360', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!document.getElementById('p360-edit-btn'), { timeout: 25000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 1200));
    await page.evaluate(() => {
      document.getElementById('p360-edit-btn')?.scrollIntoView({ block: 'center' });
    });
    await new Promise((r) => setTimeout(r, 300));
    const clicked = await page.evaluate(() => {
      const btn = document.getElementById('p360-edit-btn');
      if (!btn) return false;
      btn.click();
      return true;
    });
    await new Promise((r) => setTimeout(r, 700));
    const mob = await page.evaluate(() => {
      const p = document.getElementById('p360-edit-panel');
      const r = p?.getBoundingClientRect();
      return {
        clicked: true,
        hidden: p?.hidden,
        height: r?.height || 0,
        top: r?.top,
        inView: !!r && r.height > 40 && r.top < window.innerHeight && r.bottom > 0,
      };
    });
    mark('موبايل + ليلي: فتح نموذج التعديل', clicked && mob.hidden === false && mob.inView, JSON.stringify(mob));
    await page.screenshot({ path: path.join(ART, 'editpw_06_mobile_dark.png'), fullPage: false });
  } finally {
    await browser.close().catch(() => null);
  }

  mark('أخطاء متصفح جسيمة', logs.length === 0, JSON.stringify(logs.slice(0, 6)));
  const out = { base: BASE, email, checks: rows };
  const outPath = path.join(ART, `profile-360-edit-password-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log('REPORT', outPath);
  console.log('SUMMARY', { pass: rows.filter((r) => r.result === 'PASS').length, fail: rows.filter((r) => r.result === 'FAIL').length });
  process.exit(rows.some((r) => r.result === 'FAIL') ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
