#!/usr/bin/env node
/**
 * Production Hardening E2E (A–E) — API + Chromium smoke.
 * Requires local server with:
 *   HUB_SUPER_ADMIN_INITIAL_PASSWORD set (bootstrap)
 *   HUB_EXPOSE_RESET_TOKEN=1 for forgot-password token visibility in staging
 * Never prints password values.
 */
'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

const BASE = process.env.HUB_E2E_BASE || 'http://127.0.0.1:8080';
const SA_EMAIL = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_INITIAL = process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || process.env.HUB_E2E_SA_PASSWORD;
const SA_NEW = process.env.HUB_E2E_SA_NEW_PASSWORD || 'NaioshHub#Prod9';
const CUST_PASS = process.env.HUB_E2E_CUST_PASSWORD || 'CustPass#9x';
const CUST_NEW = process.env.HUB_E2E_CUST_NEW_PASSWORD || 'CustPass#9y';
const ADMIN_TEMP = process.env.HUB_E2E_ADMIN_TEMP || 'AdminTemp#9a';

const rows = [];
function mark(check, result, evidence) {
  rows.push({ check, result: result ? 'PASS' : 'FAIL', evidence: String(evidence || '') });
  console.log(`${result ? 'PASS' : 'FAIL'} | ${check} | ${evidence}`);
}

function req(method, p, { body, token, headers } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(p, BASE);
    const lib = u.protocol === 'https:' ? https : http;
    const payload = body != null ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      headers: {
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(token ? { Authorization: `Bearer ${token}`, 'X-Hub-Token': token } : {}),
        ...headers,
      },
    };
    const r = lib.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = {};
        try {
          json = JSON.parse(raw);
        } catch {
          json = { raw };
        }
        resolve({ status: res.statusCode, headers: res.headers, json, raw });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function main() {
  if (!SA_INITIAL) {
    console.error('Set HUB_SUPER_ADMIN_INITIAL_PASSWORD or HUB_E2E_SA_PASSWORD for this run');
    process.exit(2);
  }

  // —— Login page: no Quick Login
  const loginPage = await req('GET', '/login.html');
  const html = loginPage.raw || '';
  mark(
    'Quick Login removed',
    !/دخول سريع|Hub@360|fillLogin|DEMO_USERS|leader@naiosh\.com|malika@naiosh\.com|client@naiosh\.com/.test(html),
    `login.html bytes=${html.length}`
  );
  const loginJs = await req('GET', '/js/login.js?v=prod1');
  mark(
    'Demo credentials removed from UI/JS',
    !/DEMO_USERS|Hub@360|fillLogin|password:\s*'/.test(loginJs.raw || ''),
    'login.js scanned'
  );
  mark(
    'No hardcoded production password',
    !/11111111/.test(html + (loginJs.raw || '')) && !fs.readFileSync(path.join(__dirname, '../js/login.js'), 'utf8').includes('11111111'),
    'frontend scanned'
  );

  // —— A) Customer register + password change + dashboard denied
  const stamp = Date.now().toString(36);
  const custEmail = `prod.cust.${stamp}@example.com`;
  const reg = await req('POST', '/api/auth/register', {
    body: {
      fullName: 'عميل إنتاج',
      username: `prod_${stamp}`,
      email: custEmail,
      phone: '+970599' + String(Date.now()).slice(-6),
      password: CUST_PASS,
      confirmPassword: CUST_PASS,
      termsAccepted: true,
    },
  });
  mark('Customer registration', !!(reg.json?.ok && reg.json?.user), `status=${reg.status}`);
  const customerId = reg.json?.user?.customerId || reg.json?.user?.clientId || '';
  mark('Customer ID', !!customerId && /^CL-/.test(customerId), customerId || 'none');
  mark('Register returns no token', !reg.json?.token, 'isolation');

  const custLogin = await req('POST', '/api/auth/login', { body: { email: custEmail, password: CUST_PASS } });
  mark('Customer login', !!(custLogin.json?.ok && custLogin.json?.token), `role=${custLogin.json?.user?.role}`);
  const custTok = custLogin.json?.token;
  const meCust = await req('GET', '/api/auth/me', { token: custTok });
  mark('Customer session CLIENT', meCust.json?.lane === 'CLIENT' || meCust.json?.role === 'customer', meCust.json?.lane || meCust.json?.role);

  const dashDeny = await req('GET', '/api/admin/account', { token: custTok });
  mark('Customer dashboard denied', dashDeny.status === 403 || dashDeny.json?.ok === false, `status=${dashDeny.status}`);

  const cpw = await req('POST', '/api/client/security/password', {
    token: custTok,
    body: { currentPassword: CUST_PASS, newPassword: CUST_NEW, confirmPassword: CUST_NEW },
  });
  mark('Customer password change', !!(cpw.json?.ok), cpw.json?.message || cpw.json?.error || String(cpw.status));
  const custTok2 = cpw.json?.token || custTok;

  const oldFail = await req('POST', '/api/auth/login', { body: { email: custEmail, password: CUST_PASS } });
  mark('Customer old password rejected', !oldFail.json?.ok, `status=${oldFail.status}`);
  const newOk = await req('POST', '/api/auth/login', { body: { email: custEmail, password: CUST_NEW } });
  mark('Customer new password works', !!(newOk.json?.ok), `status=${newOk.status}`);

  // —— B) Super Admin login + password change + old token revoked
  const saLogin = await req('POST', '/api/auth/login', { body: { email: SA_EMAIL, password: SA_INITIAL } });
  mark('naioshhub@example.com login', !!(saLogin.json?.ok && saLogin.json?.token), `status=${saLogin.status} emp=${saLogin.json?.employeeNo || saLogin.json?.user?.employeeNo}`);
  mark('Employee ID', (saLogin.json?.employeeNo || saLogin.json?.user?.employeeNo) === 'EMP-0001', saLogin.json?.employeeNo || saLogin.json?.user?.employeeNo);
  mark('Super Admin role', ['supreme_leader', 'super_admin'].includes(String(saLogin.json?.user?.role || '')), saLogin.json?.user?.role);
  const saTok = saLogin.json?.token;
  const saPerms = saLogin.json?.permissions || [];
  mark('Super Admin permissions', saPerms.includes('permissions.manage') || saPerms.length > 10, `count=${saPerms.length}`);

  const cookie = String(saLogin.headers['set-cookie'] || '');
  mark('Secure cookies', /HttpOnly/i.test(cookie) && /SameSite/i.test(cookie), cookie.slice(0, 80));

  const acct = await req('GET', '/api/admin/account', { token: saTok });
  mark('Super Admin account page API', !!(acct.json?.ok && acct.json?.account?.email === SA_EMAIL), acct.json?.account?.employeeNo);

  const saChange = await req('POST', '/api/admin/account/password', {
    token: saTok,
    body: { currentPassword: SA_INITIAL, newPassword: SA_NEW, confirmPassword: SA_NEW },
  });
  mark('Super Admin password change', !!(saChange.json?.ok), saChange.json?.message || saChange.json?.error);
  const saTokNew = saChange.json?.token;

  const oldTok = await req('GET', '/api/admin/account', { token: saTok });
  mark('Old token revoked', oldTok.status === 401 || oldTok.json?.ok === false, `status=${oldTok.status}`);

  const saOldPw = await req('POST', '/api/auth/login', { body: { email: SA_EMAIL, password: SA_INITIAL } });
  mark('Old password rejected', !saOldPw.json?.ok, `status=${saOldPw.status}`);
  const saNewPw = await req('POST', '/api/auth/login', { body: { email: SA_EMAIL, password: SA_NEW } });
  mark('New password works', !!(saNewPw.json?.ok), `status=${saNewPw.status}`);
  const saTok2 = saNewPw.json?.token || saTokNew;

  // —— C) Add Admin + permissions
  const adminEmail = `admin.${stamp}@example.com`;
  const add = await req('POST', '/api/admin/staff', {
    token: saTok2,
    body: {
      name: 'إداري اختبار',
      email: adminEmail,
      role: 'admin',
      workplace: 'HQ',
      temporaryPassword: ADMIN_TEMP,
      permissions: ['clients.view', 'orders.view'],
    },
  });
  mark('Add Admin', !!(add.json?.ok && add.json?.staff?.employeeNo), add.json?.staff?.employeeNo || add.json?.error);
  const newEmp = add.json?.staff?.employeeNo;
  mark('New Admin Employee ID', !!newEmp && /^EMP-\d+$/.test(newEmp), newEmp || 'none');

  const adminLogin = await req('POST', '/api/auth/login', { body: { email: adminEmail, password: ADMIN_TEMP } });
  mark('Assign permissions / admin login', !!(adminLogin.json?.ok), `perms=${(adminLogin.json?.permissions || []).join(',')}`);
  const adminTok = adminLogin.json?.token;
  const adminPerms = adminLogin.json?.permissions || [];
  mark('Unauthorized section denied (no clients.create)', !adminPerms.includes('clients.create'), 'perm list');

  const denyCreate = await req('POST', '/api/admin/clients', {
    token: adminTok,
    body: { email: `x${stamp}@ex.com`, fullName: 'X', phone: '+970599111222' },
  });
  mark('Unauthorized API denied', denyCreate.status === 403 || denyCreate.json?.ok === false, `status=${denyCreate.status}`);

  // —— D) Revoke permission
  await req('POST', `/api/admin/staff/${encodeURIComponent(adminEmail)}/permissions`, {
    token: saTok2,
    body: { permissions: ['orders.view'] },
  });
  const afterRevoke = await req('GET', '/api/auth/me', { token: adminTok });
  // epoch bump should invalidate old token
  mark(
    'Permission revoke',
    afterRevoke.status === 401 ||
      afterRevoke.json?.ok === false ||
      !(afterRevoke.json?.permissions || []).includes('clients.view'),
    `status=${afterRevoke.status}`
  );

  // —— E) Disable admin
  const adminLogin2 = await req('POST', '/api/auth/login', { body: { email: adminEmail, password: ADMIN_TEMP } });
  const adminTok2 = adminLogin2.json?.token;
  await req('POST', `/api/admin/staff/${encodeURIComponent(adminEmail)}/disable`, { token: saTok2, body: {} });
  const disabledLogin = await req('POST', '/api/auth/login', { body: { email: adminEmail, password: ADMIN_TEMP } });
  mark('Disable Admin login denied', !disabledLogin.json?.ok, `status=${disabledLogin.status}`);
  if (adminTok2) {
    const disabledSess = await req('GET', '/api/admin/account', { token: adminTok2 });
    mark('Disable Admin session denied', disabledSess.status === 401 || disabledSess.status === 403 || !disabledSess.json?.ok, `status=${disabledSess.status}`);
  }

  await req('POST', `/api/admin/staff/${encodeURIComponent(adminEmail)}/enable`, { token: saTok2, body: {} });

  // Privilege escalation / protect super admin
  const adminLogin3 = await req('POST', '/api/auth/login', { body: { email: adminEmail, password: ADMIN_TEMP } });
  const at3 = adminLogin3.json?.token;
  const escalate = await req('POST', `/api/admin/staff/${encodeURIComponent(SA_EMAIL)}/role`, {
    token: at3,
    body: { role: 'admin' },
  });
  mark('Admin cannot modify Super Admin', escalate.status === 403 || !escalate.json?.ok, `status=${escalate.status}`);
  const selfSuper = await req('POST', `/api/admin/staff/${encodeURIComponent(adminEmail)}/role`, {
    token: at3,
    body: { role: 'supreme_leader' },
  });
  mark('Admin cannot grant self Super Admin', selfSuper.status === 403 || !selfSuper.json?.ok, `status=${selfSuper.status}`);

  const audit = await req('GET', '/api/admin/staff/audit', { token: saTok2 });
  mark('Audit log', !!(audit.json?.ok && (audit.json.audit || []).length), `entries=${(audit.json?.audit || []).length}`);

  // Forgot password
  process.env.HUB_EXPOSE_RESET_TOKEN = process.env.HUB_EXPOSE_RESET_TOKEN || '1';
  const forgot = await req('POST', '/api/auth/forgot-password', { body: { email: custEmail } });
  mark(
    'Forgot password',
    !!(forgot.json?.ok && forgot.json?.message),
    forgot.json?.emailServiceConfigured
      ? 'email service configured'
      : forgot.json?.resetToken
        ? 'token exposed (staging)'
        : 'uniform response (email may be unconfigured)'
  );

  // Rate limiting smoke — many bad logins
  let limited = false;
  for (let i = 0; i < 15; i++) {
    const bad = await req('POST', '/api/auth/login', { body: { email: `brute${stamp}@ex.com`, password: 'wrong-pass-xx' } });
    if (bad.status === 429) {
      limited = true;
      break;
    }
  }
  mark('Rate limiting', limited, limited ? '429 received' : 'not triggered in 15 tries (may need tuning)');

  // Legacy demo login blocked
  const legacy = await req('POST', '/api/auth/login', { body: { email: 'leader@naiosh.com', password: SA_INITIAL } });
  mark('Legacy leader login blocked', !legacy.json?.ok, `status=${legacy.status}`);

  // Restore SA password for delivery if requested
  if (process.env.HUB_E2E_RESTORE_SA_PASSWORD === '1') {
    await req('POST', '/api/admin/account/password', {
      token: saTok2,
      body: { currentPassword: SA_NEW, newPassword: SA_INITIAL, confirmPassword: SA_INITIAL },
    });
  }

  const fail = rows.filter((r) => r.result === 'FAIL').length;
  const pass = rows.filter((r) => r.result === 'PASS').length;
  const report = {
    PRODUCTION_READINESS: fail === 0 ? 'PASS' : 'FAIL',
    pass,
    fail,
    checks: rows,
    migration: {
      leaderFate: 'Migrated EMP-0001 identity to naioshhub@example.com; leader@naiosh.com disabled/legacy',
      primaryEmployeeId: 'EMP-0001',
      primaryEmail: SA_EMAIL,
    },
  };
  const out = path.join(__dirname, '../docs/production-hardening-report.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log('\nPRODUCTION READINESS:', report.PRODUCTION_READINESS, `(${pass} PASS / ${fail} FAIL)`);
  console.log('Report:', out);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
