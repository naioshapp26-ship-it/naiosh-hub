#!/usr/bin/env node
/**
 * Local-only: start server with DATABASE_URL, create booking, kill server, restart, reopen.
 * Proves Postgres durability across process restart (proxy for Railway redeploy).
 *
 *   DATABASE_URL=postgresql://… node scripts/e2e-platform-bookings-restart-durability.js
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { URL } = require('url');

const PORT = String(process.env.DURABILITY_PORT || '8765');
const HOST = '127.0.0.1';
const BASE = `http://${HOST}:${PORT}`;
const OUT = path.join('/opt/cursor/artifacts', `bookings-restart-durability-${Date.now()}.json`);
const ROOT = path.join(__dirname, '..');

const rows = [];
function mark(check, pass, evidence) {
  rows.push({ check, result: pass ? 'PASS' : 'FAIL', evidence: String(evidence || '').slice(0, 500) });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${evidence}`);
}

function req(method, p, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(p, BASE);
    const payload = body != null ? JSON.stringify(body) : null;
    const r = http.request(
      {
        method,
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        headers: {
          Accept: 'application/json',
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
          resolve({ status: res.statusCode, json });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitHealth(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const h = await req('GET', '/api/health');
      if (h.status === 200 && h.json?.ok) return true;
    } catch {
      /* */
    }
    await sleep(400);
  }
  return false;
}

function startServer() {
  const env = {
    ...process.env,
    PORT,
    HOST,
    NODE_ENV: 'development',
    HUB_AUTO_MIGRATE: 'true',
    // Ensure restore never runs
    HUB_SAFE_RESTORE_TWO_BOOKINGS: '',
    HUB_RESTORE_TWO_BOOKINGS: '',
  };
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL required');
  }
  const child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => {
    const s = d.toString();
    if (/listening|safe-restore|ERROR|Error/.test(s)) process.stdout.write(`[srv] ${s}`);
  });
  child.stderr.on('data', (d) => process.stderr.write(`[srv:err] ${d}`));
  return child;
}

async function stopServer(child) {
  if (!child || child.killed) return;
  child.kill('SIGTERM');
  await sleep(800);
  try {
    child.kill('SIGKILL');
  } catch {
    /* */
  }
  await sleep(400);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  mark('restore cancelled / flag unset', true, 'HUB_SAFE_RESTORE_* cleared for this run');

  let child = startServer();
  const up1 = await waitHealth();
  mark('server start #1', up1, BASE);
  if (!up1) {
    await stopServer(child);
    process.exit(1);
  }

  // Bootstrap SA via env if needed for staff GET — use public POST then staff from e2e
  const crypto = require('crypto');
  const staffEmail = 'e2e-branches@naiosh.test';
  const staffPass = crypto
    .createHash('sha256')
    .update(`naiosh-hub-e2e-staff-v1|${staffEmail}|EMP-E2E-BR`)
    .digest('base64url')
    .slice(0, 28);

  // Wait a moment for e2e staff bootstrap
  await sleep(1500);
  let login = await req('POST', '/api/auth/login', {
    body: { email: staffEmail, password: staffPass, lane: 'staff' },
  });
  if (!login.json?.token && process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD) {
    login = await req('POST', '/api/auth/login', {
      body: {
        email: process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com',
        password: process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD,
        lane: 'staff',
      },
    });
  }
  mark('staff login', !!login.json?.token, login.json?.user?.role || login.json?.error || login.status);
  if (!login.json?.token) {
    await stopServer(child);
    process.exit(1);
  }
  const token = login.json.token;

  const tag = Date.now().toString(36);
  const created = await req('POST', '/api/hub/platform-bookings', {
    body: {
      kind: 'incubator',
      source: 'incubator',
      platformName: `restart-${tag}`,
      sectorName: 'education',
      subdomain: `rst-${tag}`,
      fullName: 'ثبات إعادة تشغيل',
      phone: '+962790099988',
      email: `restart.${tag}@example.com`,
      country: 'الأردن',
      branch: `فرع إعادة تشغيل — ${tag}`,
      city: 'عمّان',
      lat: 31.9539,
      lng: 35.9106,
      locationSource: 'map',
      locationConfirmed: true,
      incubator: 'inc-edu',
      summary: 'يثبت البقاء بعد قتل العملية',
      systems: ['ERP'],
    },
  });
  const booking = created.json?.booking;
  mark('create booking before restart', created.status === 201 && !!booking?.id, booking?.id || created.status);
  if (!booking?.id) {
    await stopServer(child);
    process.exit(1);
  }

  // Confirm in Postgres before kill
  const { withClient, closePool } = require('../db/migrate');
  const beforeDb = await withClient(async (client) => {
    const r = await client.query(`SELECT value FROM hub_meta WHERE key=$1`, ['platform_bookings_v1']);
    const v = r.rows[0]?.value;
    const parsed = typeof v === 'string' ? JSON.parse(v) : v;
    return (parsed?.bookings || []).some((b) => b.id === booking.id);
  });
  mark('Postgres has booking before restart', beforeDb, booking.id);

  await stopServer(child);
  mark('server stopped', true, 'SIGTERM');

  child = startServer();
  const up2 = await waitHealth();
  mark('server start #2 (after restart)', up2, BASE);
  if (!up2) {
    await stopServer(child);
    process.exit(1);
  }
  await sleep(1500);

  login = await req('POST', '/api/auth/login', {
    body: { email: staffEmail, password: staffPass, lane: 'staff' },
  });
  const token2 = login.json?.token || token;
  const reopen = await req('GET', `/api/hub/platform-bookings?id=${encodeURIComponent(booking.id)}`, {
    token: token2,
  });
  mark(
    'reopen after process restart',
    reopen.status === 200 &&
      reopen.json?.booking?.id === booking.id &&
      reopen.json?.booking?.branch === booking.branch,
    JSON.stringify({
      status: reopen.status,
      id: reopen.json?.booking?.id,
      branch: reopen.json?.booking?.branch,
      lat: reopen.json?.booking?.lat,
    })
  );

  const afterDb = await withClient(async (client) => {
    const r = await client.query(`SELECT value FROM hub_meta WHERE key=$1`, ['platform_bookings_v1']);
    const v = r.rows[0]?.value;
    const parsed = typeof v === 'string' ? JSON.parse(v) : v;
    const hit = (parsed?.bookings || []).find((b) => b.id === booking.id);
    return { ok: !!hit, branch: hit?.branch, count: (parsed?.bookings || []).length };
  });
  mark('Postgres still has booking after restart', !!afterDb.ok, JSON.stringify(afterDb));

  await stopServer(child);
  try {
    await closePool();
  } catch {
    /* */
  }

  const fail = rows.filter((r) => r.result === 'FAIL').length;
  const report = {
    at: new Date().toISOString(),
    base: BASE,
    bookingId: booking.id,
    restoreCancelled: true,
    pass: rows.filter((r) => r.result === 'PASS').length,
    fail,
    rows,
  };
  fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${OUT}`);
  process.exit(fail ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
