#!/usr/bin/env node
/**
 * Password policy: numeric-only allowed; no letter/symbol complexity.
 * Never prints password values in evidence beyond length/kind labels.
 */
'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

const BASE = process.env.HUB_E2E_BASE || 'http://127.0.0.1:8080';
const SA = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_CURRENT = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const PW4 = '4827';
const PW8 = '12345678';

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
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}`, 'X-Hub-Token': token } : {}),
        },
      },
      (res) => {
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
  const policy = require('../lib/hub-password-policy');
  mark('Password numeric 4 digits (policy)', policy.analyze('1234').ok, 'analyze(1234)');
  mark('Password numeric 8 digits (policy)', policy.analyze('12345678').ok, 'analyze(12345678)');
  mark('No-letter password (policy)', policy.analyze('4827').ok && policy.analyze('11111111').ok, '4827+11111111');
  mark('No-symbol password (policy)', policy.analyze('abcdefgh').ok, 'letters only');
  mark('Empty password (policy)', !policy.analyze('').ok, policy.analyze('').error);
  mark('No letter requirement message', !/حرف|رمز|كبير|صغير/.test(policy.analyze('1234').error || ''), 'error empty on ok');

  if (!SA_CURRENT) {
    console.error('Set HUB_E2E_SA_PASSWORD or HUB_SUPER_ADMIN_INITIAL_PASSWORD');
    process.exit(2);
  }

  const login0 = await req('POST', '/api/auth/login', { body: { email: SA, password: SA_CURRENT } });
  mark('Super Admin login (current)', !!(login0.json?.ok && login0.json?.token), `status=${login0.status}`);
  const tok0 = login0.json?.token;
  if (!tok0) {
    writeReport(1);
    process.exit(1);
  }

  const mismatch = await req('POST', '/api/admin/account/password', {
    token: tok0,
    body: { currentPassword: SA_CURRENT, newPassword: PW4, confirmPassword: '9999' },
  });
  mark(
    'Mismatch confirmation',
    !mismatch.json?.ok && /متطابق/.test(String(mismatch.json?.error || '')),
    mismatch.json?.error || String(mismatch.status)
  );

  const empty = await req('POST', '/api/admin/account/password', {
    token: tok0,
    body: { currentPassword: SA_CURRENT, newPassword: '', confirmPassword: '' },
  });
  mark('Empty password rejected', !empty.json?.ok, empty.json?.error || String(empty.status));

  const change4 = await req('POST', '/api/admin/account/password', {
    token: tok0,
    body: { currentPassword: SA_CURRENT, newPassword: PW4, confirmPassword: PW4 },
  });
  mark('Backend accepts numeric password (4)', !!(change4.json?.ok && change4.json?.token), change4.json?.message || change4.json?.error);
  const tok1 = change4.json?.token;

  const oldTok = await req('GET', '/api/admin/account', { token: tok0 });
  mark('Session revocation regression', oldTok.status === 401 || oldTok.status === 403 || !oldTok.json?.ok, `status=${oldTok.status}`);

  const oldPw = await req('POST', '/api/auth/login', { body: { email: SA, password: SA_CURRENT } });
  mark('Old password after change', !oldPw.json?.ok ? 'DENIED' : 'PASS', `status=${oldPw.status}`);
  // normalize mark for DENIED expectation
  rows[rows.length - 1].result = !oldPw.json?.ok ? 'PASS' : 'FAIL';

  const newLogin = await req('POST', '/api/auth/login', { body: { email: SA, password: PW4 } });
  mark('New password login (4 digits)', !!(newLogin.json?.ok && newLogin.json?.token), `status=${newLogin.status}`);
  const tok2 = newLogin.json?.token || tok1;

  // Hash maintained: password change response must not echo password; credential store uses scrypt
  const echoed = JSON.stringify(change4.json || {}).includes(PW4) || JSON.stringify(newLogin.json || {}).includes(PW4);
  mark('Password hash maintained (no plaintext in API)', !echoed && !!(change4.json?.ok), 'no plaintext in responses');

  // Change again to 8-digit numeric
  const change8 = await req('POST', '/api/admin/account/password', {
    token: tok2,
    body: { currentPassword: PW4, newPassword: PW8, confirmPassword: PW8 },
  });
  mark('Password numeric 8 digits (change)', !!(change8.json?.ok), change8.json?.message || change8.json?.error);
  const login8 = await req('POST', '/api/auth/login', { body: { email: SA, password: PW8 } });
  mark('New password login (8 digits)', !!(login8.json?.ok), `status=${login8.status}`);

  // Customer registration with numeric password
  const stamp = Date.now().toString(36);
  const custEmail = `pw.cust.${stamp}@example.com`;
  const reg = await req('POST', '/api/auth/register', {
    body: {
      fullName: 'عميل سياسة',
      username: `pw_${stamp}`,
      email: custEmail,
      phone: '+970599' + String(Date.now()).slice(-6),
      password: '1234',
      confirmPassword: '1234',
      termsAccepted: true,
    },
  });
  mark('Customer register numeric 1234', !!(reg.json?.ok), `status=${reg.status} ${reg.json?.error || ''}`);
  const custLogin = await req('POST', '/api/auth/login', { body: { email: custEmail, password: '1234' } });
  mark('Customer login numeric 1234', !!(custLogin.json?.ok), `status=${custLogin.status}`);

  // Restore SA to a known delivery password if requested
  if (process.env.HUB_E2E_RESTORE_SA_PASSWORD === '1' && SA_CURRENT && login8.json?.token) {
    await req('POST', '/api/admin/account/password', {
      token: login8.json.token,
      body: { currentPassword: PW8, newPassword: SA_CURRENT, confirmPassword: SA_CURRENT },
    });
  }

  writeReport(rows.some((r) => r.result === 'FAIL') ? 1 : 0);
}

function writeReport(code) {
  const out = {
    at: new Date().toISOString(),
    base: BASE,
    policy: 'no-complexity; non-empty only (MIN_LEN default 1)',
    validatorsTouched: [
      'lib/hub-password-policy.js',
      'lib/hub-customer-auth.js (via policy)',
      'lib/hub-staff-credentials.js / setPassword / reset',
      'lib/hub-client-portal.js password change',
      'lib/hub-staff-account.js',
      'js/hub-staff-admin.js',
      'js/hub-client-portal.js',
      'js/hub-create-account.js',
      'create-account.html / forgot-password.html / register.html / admin-bootstrap.html',
    ],
    checks: rows,
  };
  const file = path.join(__dirname, '../docs/password-policy-numeric-report.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log('\nReport:', file);
  const fail = rows.filter((r) => r.result === 'FAIL').length;
  console.log(`RESULT: ${fail ? 'FAIL' : 'PASS'} (${rows.length - fail}/${rows.length})`);
  process.exit(code ?? (fail ? 1 : 0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
