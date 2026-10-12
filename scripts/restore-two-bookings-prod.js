#!/usr/bin/env node
/**
 * Approved restore of exactly two missing platform bookings on production.
 *
 * Safety:
 *  - Backs up current bookings (API) always
 *  - Full pg_dump when PROD_DATABASE_URL is set (public TCP URL, not railway.internal)
 *  - Restores ONLY allowlisted ids via /api/hub/platform-bookings/restore-missing
 *  - Never deletes/modifies existing bookings
 *  - Does not change passwords
 *
 * Auth: HUB_PROD_SA_PASSWORD (preferred) — never pass on CLI argv.
 */
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { URL } = require('url');

const BASE = (process.env.HUB_E2E_BASE || 'https://naiosh-hub-production.up.railway.app').replace(
  /\/$/,
  ''
);
const SA = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_PROD_SA_PASSWORD || '';
const FIXTURE = path.join(__dirname, 'fixtures', 'restore-two-bookings.json');
const OUT_DIR = '/opt/cursor/artifacts/bookings-restore';
const ALLOWED = new Set(['pb-mv5po1cv-x1he3', 'pb-mv5oximx-9f46e']);

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
          Origin: BASE,
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

function redactDbUrl(u) {
  return String(u || '').replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const bookings = (fixture.bookings || []).filter((b) => ALLOWED.has(b.id));
  if (bookings.length !== 2) {
    console.error('Fixture must contain exactly the two approved ids');
    process.exit(1);
  }

  const report = {
    at: new Date().toISOString(),
    base: BASE,
    passwordChanged: false,
    permissionsChanged: false,
    steps: [],
  };
  const step = (name, ok, detail) => {
    report.steps.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  };

  // 1) Review candidates
  step(
    'review two bookings',
    true,
    bookings.map((b) => ({
      id: b.id,
      email: b.email,
      branch: b.branch,
      lat: b.lat,
      lng: b.lng,
      createdAt: b.createdAt,
    }))
  );

  if (!SA_PASS) {
    step('SA auth secret', false, 'Set HUB_PROD_SA_PASSWORD (secret channel) — abort');
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const login = await req('POST', '/api/auth/login', {
    body: { email: SA, password: SA_PASS, lane: 'staff' },
  });
  const token = login.json?.token;
  step(
    'SA login (no password change)',
    !!(login.json?.ok && token && login.json?.user?.role === 'supreme_leader'),
    {
      status: login.status,
      role: login.json?.user?.role,
      employeeNo: login.json?.employeeNo,
    }
  );
  if (!token) {
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    process.exit(1);
  }

  // 2) API backup of current bookings
  const before = await req('GET', '/api/hub/platform-bookings', { token });
  const beforeBookings = before.json?.bookings || [];
  const beforeIds = beforeBookings.map((b) => b.id);
  const apiBackupPath = path.join(OUT_DIR, `api-backup-before-${Date.now()}.json`);
  fs.writeFileSync(
    apiBackupPath,
    JSON.stringify({ at: new Date().toISOString(), count: beforeBookings.length, bookings: beforeBookings }, null, 2)
  );
  step('API backup of current bookings', before.status === 200, {
    count: beforeBookings.length,
    ids: beforeIds,
    path: apiBackupPath,
  });

  // 3) Full pg_dump when public URL available
  const prodDb = process.env.PROD_DATABASE_URL || '';
  let dumpPath = null;
  if (!prodDb) {
    step(
      'full Postgres backup',
      false,
      'PROD_DATABASE_URL missing (need public TCP URL, not railway.internal)'
    );
  } else if (/railway\.internal/i.test(prodDb)) {
    step('full Postgres backup', false, 'URL is railway.internal — unreachable from agent; use public proxy URL');
  } else {
    dumpPath = path.join(OUT_DIR, `prod-pgdump-${Date.now()}.sql`);
    const dump = spawnSync('pg_dump', [prodDb, '--no-owner', '--no-acl', '-f', dumpPath], {
      encoding: 'utf8',
      timeout: 120000,
    });
    const dumpOk = dump.status === 0 && fs.existsSync(dumpPath) && fs.statSync(dumpPath).size > 1000;
    step('full Postgres backup', dumpOk, {
      url: redactDbUrl(prodDb),
      path: dumpPath,
      bytes: dumpOk ? fs.statSync(dumpPath).size : 0,
      stderr: (dump.stderr || '').slice(0, 300),
    });
    if (dumpOk) {
      // Verify restoreability into local throwaway DB if available
      const localUrl = process.env.DATABASE_URL || '';
      if (localUrl && /127\.0\.0\.1|localhost/.test(localUrl)) {
        const verifyDb = 'naiosh_hub_restore_verify';
        spawnSync('psql', [localUrl, '-v', 'ON_ERROR_STOP=1', '-c', `DROP DATABASE IF EXISTS ${verifyDb}`], {
          encoding: 'utf8',
        });
        const created = spawnSync(
          'psql',
          [localUrl.replace(/\/[^/]+$/, '/postgres'), '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${verifyDb}`],
          { encoding: 'utf8' }
        );
        if (created.status === 0) {
          const verifyUrl = localUrl.replace(/\/[^/]+$/, `/${verifyDb}`);
          const restored = spawnSync('psql', [verifyUrl, '-v', 'ON_ERROR_STOP=1', '-f', dumpPath], {
            encoding: 'utf8',
            timeout: 180000,
          });
          step('backup restoreability check (local)', restored.status === 0, {
            db: verifyDb,
            stderr: (restored.stderr || '').slice(0, 300),
          });
          spawnSync('psql', [localUrl, '-c', `DROP DATABASE IF EXISTS ${verifyDb}`], { encoding: 'utf8' });
        } else {
          step('backup restoreability check (local)', false, (created.stderr || 'create failed').slice(0, 300));
        }
      } else {
        step('backup restoreability check (local)', true, 'dump file written; local verify DB skipped');
      }
    } else if (!dumpOk) {
      fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
      process.exit(1);
    }
  }

  // Hard gate: user required full backup first
  if (!report.steps.find((s) => s.name === 'full Postgres backup' && s.ok)) {
    step('restore aborted until full backup', false, 'Will not write until PROD_DATABASE_URL public dump succeeds');
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    process.exit(2);
  }

  // Skip if already present
  const missing = bookings.filter((b) => !beforeIds.includes(b.id));
  if (!missing.length) {
    step('already restored', true, 'both ids already present — no write');
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    process.exit(0);
  }

  // 4) Restore missing only
  const restore = await req('POST', '/api/hub/platform-bookings/restore-missing', {
    token,
    body: {
      confirm: 'RESTORE_MISSING_ONLY',
      allowIds: [...ALLOWED],
      bookings: missing,
    },
  });
  step('restore-missing API', restore.status === 200 && !!restore.json?.ok, {
    status: restore.status,
    error: restore.json?.error,
    addedIds: restore.json?.addedIds,
    totalCount: restore.json?.totalCount,
    preservedExisting: restore.json?.preservedExisting,
  });
  if (!(restore.status === 200 && restore.json?.ok)) {
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    process.exit(1);
  }

  // 5) Verify
  const after = await req('GET', '/api/hub/platform-bookings', { token });
  const afterBookings = after.json?.bookings || [];
  const afterIds = afterBookings.map((b) => b.id);
  const preserved = beforeIds.every((id) => afterIds.includes(id));
  const restoredOk = [...ALLOWED].every((id) => afterIds.includes(id));
  const details = [...ALLOWED].map((id) => {
    const b = afterBookings.find((x) => x.id === id);
    return b
      ? {
          id: b.id,
          email: b.email,
          branch: b.branch || b.branchName,
          country: b.country,
          city: b.city,
          lat: b.lat,
          lng: b.lng,
          locationConfirmed: b.locationConfirmed,
          createdAt: b.createdAt,
        }
      : { id, missing: true };
  });
  step('verify existing preserved + two restored', preserved && restoredOk, {
    beforeCount: beforeIds.length,
    afterCount: afterIds.length,
    afterIds,
    details,
  });

  report.verdict = preserved && restoredOk ? 'RESTORE_OK' : 'RESTORE_VERIFY_FAIL';
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  process.exit(preserved && restoredOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
