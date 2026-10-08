#!/usr/bin/env node
/**
 * My Account profile fields: employeeNo, accountId (naioshId), editable phone.
 */
'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.HUB_E2E_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const SA = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';

const rows = [];
function mark(check, pass, evidence) {
  rows.push({ check, result: pass ? 'PASS' : 'FAIL', evidence: String(evidence || '') });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${evidence}`);
}

function req(method, p, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(p, BASE);
    const lib = u.protocol === 'https:' ? https : http;
    const payload = body != null ? JSON.stringify(body) : null;
    const r = lib.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        headers: {
          Accept: 'application/json',
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...(token ? { Authorization: `Bearer ${token}`, 'X-Hub-Token': token } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch {
            /* */
          }
          resolve({ status: res.statusCode, json, raw });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function main() {
  if (!SA_PASS) {
    console.error('Set HUB_SUPER_ADMIN_INITIAL_PASSWORD');
    process.exit(2);
  }

  const login = await req('POST', '/api/auth/login', { body: { email: SA, password: SA_PASS } });
  mark('تسجيل دخول القائد الأعلى', !!(login.json?.ok && login.json?.token), `emp=${login.json?.employeeNo}`);
  const tok = login.json?.token;
  if (!tok) {
    writeReport(1);
    process.exit(1);
  }

  const acct = await req('GET', '/api/admin/account', { token: tok });
  const a = acct.json?.account || {};
  mark('رقم الموظف EMP-0001', a.employeeNo === 'EMP-0001', a.employeeNo);
  mark(
    'رقم الحساب الحقيقي ومختلف عن الموظف',
    !!(a.accountId || a.naioshId) &&
      (a.accountId || a.naioshId) !== a.employeeNo &&
      /NAI-/i.test(a.accountId || a.naioshId || ''),
    a.accountId || a.naioshId
  );
  mark('الدور بالعربية', a.roleLabel === 'القائد الأعلى', a.roleLabel);
  mark('الحالة بالعربية', a.statusLabel === 'نشط', a.statusLabel);

  const phone = '+97059' + String(Date.now()).slice(-7);
  const save = await req('PATCH', '/api/admin/account', { token: tok, body: { phone } });
  mark('حفظ رقم الجوال', !!(save.json?.ok && save.json?.account?.phone === phone), save.json?.account?.phone || save.json?.error);

  const again = await req('GET', '/api/admin/account', { token: tok });
  mark('استمرارية الجوال بعد GET', again.json?.account?.phone === phone, again.json?.account?.phone);

  const badEmp = await req('PATCH', '/api/admin/account', {
    token: tok,
    body: { employeeNo: 'EMP-9999', phone },
  });
  mark('رفض تعديل رقم الموظف', badEmp.status === 403 || badEmp.json?.ok === false, String(badEmp.status));

  const badAcc = await req('PATCH', '/api/admin/account', {
    token: tok,
    body: { accountId: 'NAI-HACK-001', phone },
  });
  mark('رفض تعديل رقم الحساب', badAcc.status === 403 || badAcc.json?.ok === false, String(badAcc.status));

  const badPhone = await req('PATCH', '/api/admin/account', { token: tok, body: { phone: 'abc' } });
  mark('رفض جوال غير صالح', !badPhone.json?.ok, badPhone.json?.error);

  // Logout / login persistence
  await req('POST', '/api/auth/logout', { token: tok });
  const login2 = await req('POST', '/api/auth/login', { body: { email: SA, password: SA_PASS } });
  const tok2 = login2.json?.token;
  const afterRelogin = await req('GET', '/api/admin/account', { token: tok2 });
  mark(
    'استمرارية بعد Logout/Login',
    afterRelogin.json?.account?.phone === phone && afterRelogin.json?.account?.employeeNo === 'EMP-0001',
    afterRelogin.json?.account?.phone
  );

  // Create another admin and verify isolation
  const stamp = Date.now().toString(36);
  const otherEmail = `acct.admin.${stamp}@example.com`;
  const created = await req('POST', '/api/admin/staff', {
    token: tok2,
    body: {
      name: 'إداري اختبار حسابي',
      email: otherEmail,
      phone: '+970591111111',
      workplace: 'رام الله',
      role: 'admin',
      temporaryPassword: '2468',
      permissions: ['clients.view'],
    },
  });
  mark('إنشاء إداري آخر', !!(created.json?.ok && created.json?.staff?.employeeNo), created.json?.staff?.employeeNo);

  if (created.json?.ok) {
    const otherLogin = await req('POST', '/api/auth/login', {
      body: { email: otherEmail, password: '2468' },
    });
    const oTok = otherLogin.json?.token;
    const oAcct = await req('GET', '/api/admin/account', { token: oTok });
    mark(
      'حساب إداري آخر يعرض بياناته فقط',
      oAcct.json?.account?.email === otherEmail &&
        oAcct.json?.account?.employeeNo !== 'EMP-0001' &&
        oAcct.json?.account?.phone === '+970591111111',
      `${oAcct.json?.account?.email}|${oAcct.json?.account?.employeeNo}|${oAcct.json?.account?.accountId}`
    );
    mark(
      'رقم حساب الإداري مختلف عن الموظف',
      oAcct.json?.account?.accountId &&
        oAcct.json?.account?.accountId !== oAcct.json?.account?.employeeNo,
      oAcct.json?.account?.accountId
    );
  }

  // UI smoke
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,900'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle2' });
    await page.type('#email', SA, { delay: 10 });
    await page.type('#password', SA_PASS, { delay: 10 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null),
      page.click('#loginBtn'),
    ]);
    await page.goto(`${BASE}/dashboard.html#my-account`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#sa-profile-form', { timeout: 20000 });
    const ui = await page.evaluate(() => {
      const text = document.body.innerText || '';
      return {
        hasSection: /بيانات حسابي/.test(text),
        hasEmp: /EMP-0001/.test(text),
        hasAccount: /NAI-LEADER-001|NAI-/.test(text),
        hasRoleAr: /القائد الأعلى/.test(text),
        hasStatusAr: /نشط/.test(text),
        hasPhoneInput: !!document.getElementById('sa-phone'),
        hasSave: !!document.getElementById('sa-profile-save'),
        hasPwdSection: /الأمان وكلمة المرور/.test(text),
      };
    });
    mark(
      'واجهة بيانات حسابي (كمبيوتر)',
      ui.hasSection && ui.hasEmp && ui.hasAccount && ui.hasRoleAr && ui.hasStatusAr && ui.hasPhoneInput && ui.hasSave && ui.hasPwdSection,
      JSON.stringify(ui)
    );

    const art = '/opt/cursor/artifacts/screenshots';
    fs.mkdirSync(art, { recursive: true });
    await page.screenshot({ path: path.join(art, 'my-account-desktop.png'), fullPage: true });

    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('#sa-profile-form', { timeout: 20000 });
    await page.screenshot({ path: path.join(art, 'my-account-mobile.png'), fullPage: true });
    mark('واجهة الموبايل', true, 'my-account-mobile.png');
  } catch (err) {
    mark('واجهة حسابي', false, err.message);
  } finally {
    if (browser) await browser.close().catch(() => null);
  }

  writeReport(rows.some((r) => r.result === 'FAIL') ? 1 : 0);
}

function writeReport(code) {
  const out = {
    at: new Date().toISOString(),
    base: BASE,
    accountIdForLeader: rows.find((r) => r.check.includes('رقم الحساب'))?.evidence || null,
    employeeNo: 'EMP-0001',
    checks: rows,
  };
  const file = path.join(__dirname, '../docs/my-account-profile-report.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  const fail = rows.filter((r) => r.result === 'FAIL').length;
  console.log(`\nRESULT: ${fail ? 'FAIL' : 'PASS'} (${rows.length - fail}/${rows.length})`);
  console.log('Report:', file);
  process.exit(code ?? (fail ? 1 : 0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
