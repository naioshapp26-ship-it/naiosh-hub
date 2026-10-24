/**
 * Local smoke: P0/P1 auth gates for launch harden (platform-grants, SSO, ERP, await staff, env-check).
 * Run: node scripts/smoke-launch-auth-gates.js
 */
'use strict';

const http = require('http');
const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 18765 + Math.floor(Math.random() * 200);
const SECRET = `smoke-launch-${Date.now()}`;
const ROOT = path.join(__dirname, '..');

function req(method, urlPath, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body != null ? JSON.stringify(body) : null;
    const r = http.request(
      {
        method,
        hostname: '127.0.0.1',
        port: PORT,
        path: urlPath,
        headers: {
          Accept: 'application/json',
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
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
          } catch (_) {}
          resolve({ status: res.statusCode, raw, json });
        });
      }
    );
    r.on('error', reject);
    r.setTimeout(20000, () => r.destroy(new Error('timeout')));
    if (payload) r.write(payload);
    r.end();
  });
}

async function main() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'production',
      SESSION_SECRET: SECRET,
      HUB_SSO_SECRET: 'smoke-sso-secret',
      HUB_DEMO_AUTH: 'false',
      HUB_AUTO_MIGRATE: 'false',
      // Avoid hard fail if DATABASE_URL missing in this smoke — server still boots for hub routes.
      DATABASE_URL: process.env.DATABASE_URL || '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let boot = '';
  child.stdout.on('data', (d) => {
    boot += d.toString();
  });
  child.stderr.on('data', (d) => {
    boot += d.toString();
  });

  const started = Date.now();
  while (Date.now() - started < 15000) {
    try {
      const h = await req('GET', '/api/health');
      if (h.status === 200 || h.status === 503) break;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 200));
  }

  const failures = [];
  const check = (name, ok, detail) => {
    console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push({ name, detail });
  };

  try {
    const grants = await req('GET', '/api/hub/platform-grants');
    check('platform_grants_unauth', grants.status === 401 || grants.status === 403, `status=${grants.status}`);

    const sso = await req('POST', '/api/hub/sso/issue', {
      body: { email: 'nobody@example.com', systemCode: 'ERP' },
    });
    check('sso_issue_unauth', sso.status === 401 || sso.status === 403, `status=${sso.status}`);

    const erp = await req('POST', '/api/hub/adapters/erp/provision', {
      body: { subdomain: 'x', companyName: 'X', adminEmail: 'a@b.com', adminPassword: 'Password12' },
    });
    check('erp_provision_unauth', erp.status === 401 || erp.status === 403, `status=${erp.status}`);

    const envc = await req('GET', '/api/env-check');
    check('env_check_unauth', envc.status === 401 || envc.status === 403, `status=${envc.status}`);

    const catalog = await req('POST', '/api/hub/search-catalog', { body: { items: [] } });
    check('search_catalog_post_unauth', catalog.status === 401 || catalog.status === 403, `status=${catalog.status}`);

    const apps = await req('POST', '/api/hub/apps', { body: { code: 'X', nameAr: 'اختبار' } });
    check('apps_post_unauth', apps.status === 401 || apps.status === 403, `status=${apps.status}`);

    const sync = await req('POST', '/api/hub/sync', { body: { code: 'X' } });
    check('sync_post_unauth', sync.status === 401 || sync.status === 403, `status=${sync.status}`);

    // Unsigned customer token must fail when SESSION_SECRET is set
    const email = 'smoke-cust@naiosh.test';
    const forge = `hub360.cust.${Buffer.from(email).toString('base64url')}.${Date.now()}`;
    const forged = await req('GET', '/api/auth/me', { headers: { Authorization: `Bearer ${forge}` } });
    check(
      'forged_token_rejected',
      forged.status === 401 && !forged.json?.authenticated,
      `status=${forged.status} err=${forged.json?.error || ''}`
    );

    // Signed token body verifies via crypto unit (no need for full account)
    const tokenCrypto = require('../lib/hub-token-crypto');
    const body = `hub360.cust.${Buffer.from(email).toString('base64url')}.${Date.now()}`;
    const signed = tokenCrypto.signTokenBody(body);
    assert.ok(signed.includes('.s'), 'signed token has .s');
    assert.strictEqual(tokenCrypto.verifySignedToken(signed).ok, true);
    assert.strictEqual(tokenCrypto.verifySignedToken(body).ok, false);
    check('token_crypto_roundtrip', true, 'sign/verify/forge');
  } finally {
    child.kill('SIGTERM');
  }

  if (failures.length) {
    console.error('\nFAIL', failures);
    console.error('boot log tail:\n', boot.slice(-1500));
    process.exit(1);
  }
  console.log('\nALL SMOKE PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
