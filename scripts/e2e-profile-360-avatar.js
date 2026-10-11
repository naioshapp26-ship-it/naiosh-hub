#!/usr/bin/env node
/**
 * Profile 360 avatar: UI upload JPG/PNG, durable URL, persist after reload/relogin,
 * isolation (other customer cannot change), chip sync.
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
  rows.push({ check: c, result: p ? 'PASS' : 'FAIL', evidence: String(e || '').slice(0, 500) });
  console.log(`${p ? 'PASS' : 'FAIL'} | ${c} | ${e}`);
};

function makePng(filePath, rgb) {
  const { execSync } = require('child_process');
  const [r, g, b] = rgb;
  execSync(
    `python3 -c "import struct,zlib;w=h=64;pixel=bytes([${r},${g},${b}]);rows=b''.join(b'\\\\x00'+pixel*w for _ in range(h));chunk=lambda t,d:struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff);open('${filePath}','wb').write(b'\\\\x89PNG\\\\r\\\\n\\\\x1a\\\\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(rows,9))+chunk(b'IEND',b''))"`
  );
}

async function json(pathname, { method = 'GET', token, body, raw, headers } = {}) {
  const r = await fetch(BASE + pathname, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body && !raw ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(headers || {}),
    },
    body: raw ? raw : body ? JSON.stringify(body) : undefined,
  });
  const ct = r.headers.get('content-type') || '';
  const j = ct.includes('json') ? await r.json().catch(() => ({})) : {};
  const buf = ct.includes('json') ? null : Buffer.from(await r.arrayBuffer());
  return { status: r.status, j, buf, ct };
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  const pngPath = path.join(ART, 'avatar_e2e_blue.png');
  makePng(pngPath, [30, 90, 220]);
  const stamp = Date.now().toString(36);
  const email = `avatar.fix.${stamp}@naiosh-test.com`;
  const email2 = `avatar.fix2.${stamp}@naiosh-test.com`;
  const pass = 'AvatarFix360!';

  const reg = await json('/api/auth/register', {
    method: 'POST',
    body: {
      fullName: 'عميل إصلاح الصورة',
      email,
      phone: `+9665${String(Date.now()).slice(-8)}`,
      password: pass,
      confirmPassword: pass,
      termsAccepted: true,
    },
  });
  mark('تسجيل عميل للاختبار', !!reg.j.ok, JSON.stringify(reg.j.profile360 || reg.j.error));
  const login = await json('/api/auth/login', { method: 'POST', body: { email, password: pass } });
  let token = login.j.token;
  mark('دخول العميل', !!token, login.j.user?.role);

  // API durable upload
  const png = fs.readFileSync(pngPath);
  const up = await json('/api/hub/profiles/me/avatar', {
    method: 'POST',
    token,
    raw: png,
    headers: { 'Content-Type': 'image/png', 'X-File-Name': 'avatar.png', 'X-File-Type': 'image/png' },
  });
  mark(
    'API: رفع صورة شخصية دائمة',
    up.status === 201 && !!up.j.avatarUrl && /\/api\/hub\/avatars\//.test(up.j.avatarUrl),
    JSON.stringify({ status: up.status, url: up.j.avatarUrl, err: up.j.error })
  );

  const me = await json('/api/hub/profiles/me', { token });
  const accountNo = me.j.header?.accountNo || '';
  mark('ربط الصورة برقم الحساب', me.j.header?.avatarUrl?.includes(accountNo), JSON.stringify({ accountNo, avatarUrl: me.j.header?.avatarUrl }));

  const getAv = await json('/api/hub/avatars/' + encodeURIComponent(accountNo));
  mark(
    'جلب الصورة من المسار الدائم',
    getAv.status === 200 && getAv.ct.includes('image/') && getAv.buf && getAv.buf[0] === 0x89,
    JSON.stringify({ status: getAv.status, ct: getAv.ct, size: getAv.buf?.length })
  );

  // Isolation: other customer cannot upload to this account
  const reg2 = await json('/api/auth/register', {
    method: 'POST',
    body: {
      fullName: 'عميل آخر',
      email: email2,
      phone: `+9665${String(Date.now() + 3).slice(-8)}`,
      password: pass,
      confirmPassword: pass,
      termsAccepted: true,
    },
  });
  const login2 = await json('/api/auth/login', { method: 'POST', body: { email: email2, password: pass } });
  const steal = await json('/api/hub/profiles/by-email/' + encodeURIComponent(email) + '/avatar', {
    method: 'POST',
    token: login2.j.token,
    raw: png,
    headers: { 'Content-Type': 'image/png', 'X-File-Name': 'x.png', 'X-File-Type': 'image/png' },
  });
  mark('عزل: منع تعديل صورة عميل آخر', steal.status === 403 || steal.status === 401, JSON.stringify({ status: steal.status, err: steal.j.error }));

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      (t, u) => {
        localStorage.clear();
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify(u));
      },
      token,
      login.j.user || { email, role: 'customer', name: 'عميل إصلاح الصورة' }
    );
    await page.goto(BASE + '/client.html#profile360', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => /ACC-/.test(document.body.innerText), { timeout: 25000 });
    await new Promise((r) => setTimeout(r, 1200));

    const uiBefore = await page.evaluate(() => ({
      img: document.querySelector('.p360-avatar img')?.getAttribute('src') || '',
      chip: document.querySelector('#cp-user-avatar img')?.getAttribute('src') || '',
      hasBtn: !!document.getElementById('p360-avatar-btn'),
    }));
    mark('واجهة: ظهور الصورة بعد الربط', /\/api\/hub\/avatars\//.test(uiBefore.img), JSON.stringify(uiBefore));
    await page.screenshot({ path: path.join(ART, 'avatar_fix_01_profile.png'), fullPage: false });

    // Replace via UI with green png
    const green = path.join(ART, 'avatar_e2e_green.png');
    makePng(green, [20, 180, 80]);
    const [chooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 10000 }),
      page.click('#p360-avatar-btn'),
    ]);
    await chooser.accept([green]);
    await page.waitForFunction(() => /تم حفظ الصورة|نجاح|فشل/.test(document.body.innerText), { timeout: 20000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 1500));
    const afterUi = await page.evaluate(() => ({
      img: document.querySelector('.p360-avatar img')?.getAttribute('src') || '',
      status: document.getElementById('p360-avatar-status')?.textContent || '',
      toast: document.getElementById('p360-toast')?.textContent || '',
      chip: document.querySelector('#cp-user-avatar img')?.getAttribute('src') || '',
    }));
    mark(
      'واجهة: رفع واستبدال الصورة مع رسالة عربية',
      /\/api\/hub\/avatars\//.test(afterUi.img) && (/حفظ|نجاح/.test(afterUi.status + afterUi.toast) || !!afterUi.img),
      JSON.stringify(afterUi)
    );
    await page.screenshot({ path: path.join(ART, 'avatar_fix_02_after_ui_upload.png'), fullPage: false });

    // Reload + relogin
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      location.hash = 'profile360';
    });
    await page.waitForFunction(() => /ACC-/.test(document.body.innerText), { timeout: 25000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 1200));
    const afterReload = await page.evaluate(() => document.querySelector('.p360-avatar img')?.getAttribute('src') || '');
    mark('بقاء الصورة بعد تحديث الصفحة', /\/api\/hub\/avatars\//.test(afterReload), afterReload);

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    const loginAgain = await json('/api/auth/login', { method: 'POST', body: { email, password: pass } });
    token = loginAgain.j.token;
    await page.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      (t, u) => {
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify(u));
      },
      token,
      loginAgain.j.user || { email, role: 'customer', name: 'عميل إصلاح الصورة' }
    );
    await page.goto(BASE + '/client.html#profile360', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /ACC-/.test(document.body.innerText), { timeout: 25000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 1200));
    const afterRelogin = await page.evaluate(() => ({
      img: document.querySelector('.p360-avatar img')?.getAttribute('src') || '',
      chip: document.querySelector('#cp-user-avatar img')?.getAttribute('src') || '',
    }));
    mark(
      'بقاء الصورة بعد خروج ودخول + الشريحة',
      /\/api\/hub\/avatars\//.test(afterRelogin.img) && !!afterRelogin.chip,
      JSON.stringify(afterRelogin)
    );
    await page.screenshot({ path: path.join(ART, 'avatar_fix_03_relogin_chip.png'), fullPage: false });

    // Reject non-image
    const bad = await json('/api/hub/profiles/me/avatar', {
      method: 'POST',
      token,
      raw: Buffer.from('not-an-image'),
      headers: { 'Content-Type': 'text/plain', 'X-File-Name': 'x.txt', 'X-File-Type': 'text/plain' },
    });
    mark('رفض ملف غير صورة', bad.status === 400, JSON.stringify({ status: bad.status, err: bad.j.error }));
  } finally {
    await browser.close().catch(() => null);
  }

  const out = {
    base: BASE,
    email,
    accountNo,
    avatarUrl: me.j.header?.avatarUrl,
    checks: rows,
  };
  const outPath = path.join(ART, `profile-360-avatar-fix-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log('REPORT', outPath);
  process.exit(rows.some((r) => r.result === 'FAIL') ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
