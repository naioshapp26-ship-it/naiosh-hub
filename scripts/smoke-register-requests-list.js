/**
 * Smoke: GET /api/hub/register-requests staff list + auth gate + POST unchanged.
 * node scripts/smoke-register-requests-list.js
 */
'use strict';

const http = require('http');
const path = require('path');
const assert = require('assert');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = 18191;
const HOST = '127.0.0.1';
const SECRET = 'smoke-register-list-secret-32chars!!';

function req(method, urlPath, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body != null ? Buffer.from(JSON.stringify(body)) : null;
    const r = http.request(
      {
        hostname: HOST,
        port: PORT,
        path: urlPath,
        method,
        headers: {
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
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, body: json, raw });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.end(payload);
    else r.end();
  });
}

function waitReady(ms = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      req('GET', '/api/health')
        .then((r) => {
          if (r.status === 200) return resolve();
          if (Date.now() - start > ms) return reject(new Error('server not ready'));
          setTimeout(tick, 200);
        })
        .catch(() => {
          if (Date.now() - start > ms) return reject(new Error('server not ready'));
          setTimeout(tick, 200);
        });
    };
    tick();
  });
}

async function main() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      SESSION_SECRET: SECRET,
      HUB_AUTO_MIGRATE: '0',
      HUB_ALLOW_LEGACY_DEMO: '1',
      NODE_ENV: 'development',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (d) => {
    logs += d.toString();
  });
  child.stderr.on('data', (d) => {
    logs += d.toString();
  });

  try {
    await waitReady();

    // 1) Unauthenticated GET → 401/403 (not hang / 502)
    const anon = await req('GET', '/api/hub/register-requests');
    assert.ok([401, 403].includes(anon.status), `anon expected 401/403 got ${anon.status} ${anon.raw}`);
    console.log(`PASS unauth GET → ${anon.status}`);

    // 2) Staff signed token → 200, no password fields
    // Mirror hub-token-crypto.signTokenBody with the same SESSION_SECRET the child uses.
    const crypto = require('crypto');
    const sign = (body) => {
      const base = String(body).replace(/\.s[A-Za-z0-9_-]+$/, '');
      const sig = crypto.createHmac('sha256', SECRET).update(base).digest('base64url').slice(0, 32);
      return `${base}.s${sig}`;
    };
    const staffEmail = 'naioshhub@example.com';
    const staffToken = sign(
      `hub360.${Buffer.from(staffEmail).toString('base64')}.${Date.now()}.e1`
    );

    const list = await req('GET', '/api/hub/register-requests', {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.equal(list.status, 200, `staff list ${list.status} ${list.raw}`);
    assert.equal(list.body?.ok, true);
    assert.ok(Array.isArray(list.body?.requests));
    const blob = JSON.stringify(list.body);
    assert.ok(!/adminPassword|passwordHash|"password"\s*:/.test(blob), 'password fields leaked');
    console.log(`PASS staff GET → 200 count=${list.body.count}`);

    // 3) Non-staff / unknown customer token must not list
    const cust = await req('GET', '/api/hub/register-requests', {
      headers: {
        Authorization: `Bearer ${sign(
          `hub360.cust.${Buffer.from('client@naiosh.com').toString('base64url')}.${Date.now()}`
        )}`,
      },
    });
    assert.ok([401, 403].includes(cust.status), `customer expected 401/403 got ${cust.status}`);
    console.log(`PASS non-staff GET → ${cust.status}`);

    // 4) POST create still works (public)
    const slug = `smoke${Date.now().toString(36)}`;
    const created = await req('POST', '/api/hub/register-requests', {
      body: {
        adminName: 'Smoke List',
        adminPhone: '0500000099',
        adminEmail: `smoke-list-${Date.now()}@test.naiosh.local`,
        adminPassword: 'HubTest@360',
        subdomain: slug,
        slug,
        host: `${slug}.naiosh.app`,
        country: 'SA',
        branch: 'br-saudi',
        incubator: 'inc-edu',
        platform: 'core',
        requestedSystem: 'ERP',
      },
    });
    // May be 201, or 503 if HA enqueue fails without DB — either way must not be 404/405
    assert.ok(
      [200, 201, 503].includes(created.status),
      `POST unexpected ${created.status} ${created.raw}`
    );
    if (created.status === 201 || created.status === 200) {
      assert.ok(created.body?.requestId || created.body?.request?.id);
      assert.ok(created.body?.uploadToken);
      assert.ok(!created.body?.request?.adminPassword, 'POST publicRequest leaked password');
      console.log(`PASS POST create → ${created.status} ${created.body.requestId}`);

      const list2 = await req('GET', '/api/hub/register-requests', {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      assert.equal(list2.status, 200);
      const hit = (list2.body.requests || []).find((r) => r.id === created.body.requestId);
      assert.ok(hit, 'created request missing from staff list');
      assert.ok(!hit.adminPassword && !hit.uploadToken, 'list leaked secrets');
      console.log('PASS created request appears in staff list without secrets');
    } else {
      console.log(`WARN POST create → ${created.status} (HA/db) — GET auth gate still verified`);
    }

    console.log('ALL SMOKE CHECKS PASSED');
  } catch (err) {
    console.error('FAIL', err.message);
    console.error(logs.slice(-2000));
    process.exitCode = 1;
  } finally {
    child.kill('SIGTERM');
  }
}

main();
