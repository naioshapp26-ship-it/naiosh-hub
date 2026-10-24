/**
 * Local smoke: ad submission status API + platform-bookings auth gate.
 * Run: node scripts/smoke-ad-status-bookings.js
 */
'use strict';

const http = require('http');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = 18240 + Math.floor(Math.random() * 80);
const HOST = '127.0.0.1';
const SECRET = 'smoke-ad-status-bookings-secret-32ch!!';

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
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, body: json, raw });
        });
      }
    );
    r.on('error', reject);
    r.setTimeout(20000, () => r.destroy(new Error('timeout')));
    if (payload) r.end(payload);
    else r.end();
  });
}

function waitReady(ms = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      req('GET', '/api/health')
        .then((r) => {
          if (r.status === 200 || r.status === 503) return resolve();
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

function signStaffToken(email = 'naioshhub@example.com') {
  const base = `hub360.${Buffer.from(email).toString('base64')}.${Date.now()}.e1`;
  const sig = crypto.createHmac('sha256', SECRET).update(base).digest('base64url').slice(0, 32);
  return `${base}.s${sig}`;
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
      HUB_DEMO_AUTH: 'false',
      NODE_ENV: 'development',
      DATABASE_URL: process.env.DATABASE_URL || '',
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

  const failures = [];
  const check = (name, ok, detail) => {
    console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push({ name, detail });
  };

  try {
    await waitReady();
    const staffToken = signStaffToken();
    const auth = { Authorization: `Bearer ${staffToken}` };

    // 1) Unauth status update → 401 (or 403)
    const unauth = await req('POST', '/api/hub/ad-submissions/does-not-exist/status', {
      body: { status: 'approved' },
    });
    check(
      'ad_status_unauth',
      unauth.status === 401 || unauth.status === 403,
      `status=${unauth.status}`
    );

    // 2) Create ad (public guest) → staff status update → GET reflects
    const stamp = Date.now();
    const created = await req('POST', '/api/hub/ad-submissions', {
      body: {
        owner: {
          name: 'Smoke Ad Owner',
          email: `smoke-ad-${stamp}@test.naiosh.local`,
          phone: '+966500000011',
          company: 'Smoke Co',
        },
        ad: {
          title: `Smoke Ad ${stamp}`,
          headline: `Headline ${stamp}`,
          desc: 'smoke status test',
          contentType: 'image',
        },
        idempotencyKey: `smoke-ad-status-${stamp}`,
      },
    });
    check(
      'ad_create',
      created.status === 201 || created.status === 200,
      `status=${created.status} err=${created.body?.error || ''}`
    );
    const sub = created.body?.submission;
    const subId = sub?.id || sub?.requestId;
    check('ad_create_id', !!subId, `id=${subId || 'missing'}`);
    check(
      'ad_create_no_media_blob',
      !sub?.mediaDataUrl || sub.mediaDataUrl === '[media]' || sub.mediaDataUrl === '',
      `media=${String(sub?.mediaDataUrl || '').slice(0, 20)}`
    );
    check(
      'ad_create_pending',
      sub?.status === 'pending_review',
      `status=${sub?.status}`
    );

    if (subId) {
      const patched = await req('POST', `/api/hub/ad-submissions/${encodeURIComponent(subId)}/status`, {
        headers: auth,
        body: { status: 'approved' },
      });
      check(
        'ad_status_staff_update',
        patched.status === 200 && patched.body?.ok === true,
        `status=${patched.status} bodyStatus=${patched.body?.submission?.status}`
      );
      check(
        'ad_status_approved',
        patched.body?.submission?.status === 'approved',
        `status=${patched.body?.submission?.status}`
      );
      check(
        'ad_status_stripped',
        !patched.body?.submission?.mediaDataUrl ||
          patched.body.submission.mediaDataUrl === '[media]' ||
          patched.body.submission.mediaDataUrl === '',
        'media ok'
      );

      const got = await req('GET', `/api/hub/ad-submissions/${encodeURIComponent(subId)}`, {
        headers: auth,
      });
      check(
        'ad_get_reflects_status',
        got.status === 200 && got.body?.submission?.status === 'approved',
        `status=${got.status} sub=${got.body?.submission?.status} req=${got.body?.request?.status}`
      );

      const rejected = await req('PATCH', `/api/hub/ad-submissions/${encodeURIComponent(subId)}/status`, {
        headers: auth,
        body: { status: 'rejected', reason: 'smoke reject' },
      });
      check(
        'ad_status_reject',
        rejected.status === 200 && rejected.body?.submission?.status === 'rejected',
        `status=${rejected.status} sub=${rejected.body?.submission?.status}`
      );
    }

    // 3) Bookings GET requires auth
    const bookAnon = await req('GET', '/api/hub/platform-bookings');
    check(
      'bookings_get_unauth',
      bookAnon.status === 401 || bookAnon.status === 403,
      `status=${bookAnon.status}`
    );

    const bookStaff = await req('GET', '/api/hub/platform-bookings', { headers: auth });
    check(
      'bookings_get_staff',
      bookStaff.status === 200 && bookStaff.body?.ok === true && Array.isArray(bookStaff.body.bookings),
      `status=${bookStaff.status} count=${bookStaff.body?.count}`
    );

    if (failures.length) {
      console.error('FAIL', failures);
      process.exitCode = 1;
    } else {
      console.log('ALL SMOKE CHECKS PASSED');
    }
  } catch (err) {
    console.error('FAIL', err.message);
    console.error(logs.slice(-2500));
    process.exitCode = 1;
  } finally {
    child.kill('SIGTERM');
  }
}

main();
