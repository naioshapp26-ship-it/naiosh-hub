#!/usr/bin/env node
/**
 * Diagnose Super Admin login on production WITHOUT changing password or permissions.
 *
 * Probes (never prints secrets):
 *  1) HUB_SUPER_ADMIN_INITIAL_PASSWORD → expect 401 when owner changed password
 *  2) HUB_PROD_SA_PASSWORD (current owner password) → prove login if provided
 *  3) Confirms FORCE reset flag is NOT used by this script
 *
 * Usage:
 *   HUB_E2E_BASE=https://naiosh-hub-production.up.railway.app \
 *   HUB_PROD_SA_PASSWORD='…' \
 *   node scripts/diagnose-sa-login-prod.js
 */
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const BASE = (process.env.HUB_E2E_BASE || 'https://naiosh-hub-production.up.railway.app').replace(
  /\/$/,
  ''
);
const SA = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const INITIAL = process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const PROD_PASS = process.env.HUB_PROD_SA_PASSWORD || '';
const OUT_DIR = '/opt/cursor/artifacts';
const OUT = path.join(OUT_DIR, `sa-login-diagnose-${Date.now()}.json`);

const rows = [];
function mark(check, pass, evidence) {
  rows.push({ check, result: pass ? 'PASS' : 'FAIL', evidence: String(evidence || '').slice(0, 500) });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${evidence}`);
}

function req(method, p, { body, token, headers } = {}) {
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
          Origin: BASE,
          Referer: `${BASE}/`,
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...(token ? { Authorization: `Bearer ${token}`, 'X-Hub-Token': token } : {}),
          ...(headers || {}),
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
  fs.mkdirSync(OUT_DIR, { recursive: true });
  mark(
    'script never sets HUB_SUPER_ADMIN_FORCE_PASSWORD_RESET',
    String(process.env.HUB_SUPER_ADMIN_FORCE_PASSWORD_RESET || '') !== '1',
    `FORCE=${process.env.HUB_SUPER_ADMIN_FORCE_PASSWORD_RESET || '(unset)'}`
  );

  const health = await req('GET', '/api/health');
  mark('production reachable', health.status === 200 && !!health.json?.ok, `status=${health.status}`);

  if (!INITIAL) {
    mark('INITIAL password available in agent env', false, 'HUB_SUPER_ADMIN_INITIAL_PASSWORD missing');
  } else {
    const r = await req('POST', '/api/auth/login', {
      body: { email: SA, password: INITIAL, lane: 'staff' },
    });
    // Account exists + hash diverged from INITIAL → 401 is the expected healthy signal
    // (owner password changed; we must NOT force-reset without approval).
    const expectedDiverge = r.status === 401 && !r.json?.ok;
    mark(
      'INITIAL password does not overwrite / login when hash diverged (expected 401)',
      expectedDiverge,
      JSON.stringify({
        status: r.status,
        ok: !!r.json?.ok,
        error: r.json?.error,
        note: expectedDiverge
          ? 'hash ≠ INITIAL — no password change performed'
          : 'unexpected — investigate without FORCE reset',
      })
    );
  }

  if (!PROD_PASS) {
    mark(
      'owner password login (HUB_PROD_SA_PASSWORD)',
      false,
      'secret not provided — cannot prove SA login without changing password'
    );
  } else {
    const r = await req('POST', '/api/auth/login', {
      body: { email: SA, password: PROD_PASS, lane: 'staff' },
    });
    const ok = r.status === 200 && !!r.json?.ok && !!r.json?.token;
    mark(
      'owner password login (HUB_PROD_SA_PASSWORD)',
      ok,
      JSON.stringify({
        status: r.status,
        ok: !!r.json?.ok,
        error: r.json?.error,
        role: r.json?.user?.role,
        employeeNo: r.json?.employeeNo || r.json?.user?.employeeNo,
        mustChangePassword: r.json?.mustChangePassword,
        hasToken: !!r.json?.token,
      })
    );
    if (ok) {
      const me = await req('GET', '/api/auth/me', { token: r.json.token });
      mark(
        'session /me after owner login',
        me.status === 200 && (me.json?.email === SA || me.json?.user?.email === SA),
        JSON.stringify({
          status: me.status,
          email: me.json?.email || me.json?.user?.email,
          role: me.json?.role || me.json?.user?.role,
          employeeNo: me.json?.employeeNo || me.json?.user?.employeeNo,
          lane: me.json?.lane,
        })
      );
    }
  }

  const pass = rows.filter((x) => x.result === 'PASS').length;
  const fail = rows.filter((x) => x.result === 'FAIL').length;
  const report = {
    at: new Date().toISOString(),
    base: BASE,
    email: SA,
    passwordChanged: false,
    permissionsChanged: false,
    forceResetUsed: false,
    pass,
    fail,
    rows,
    verdict:
      PROD_PASS && fail === 0
        ? 'SA_LOGIN_PROVEN'
        : !PROD_PASS
          ? 'BLOCKED_NEEDS_HUB_PROD_SA_PASSWORD'
          : 'FAIL_SEE_ROWS',
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${OUT}`);
  console.log(`verdict=${report.verdict} PASS=${pass} FAIL=${fail}`);
  process.exit(fail && PROD_PASS ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
