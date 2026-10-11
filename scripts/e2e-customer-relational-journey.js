/**
 * Full new-customer journey against relational customer store (API-level).
 * Also seeds a second customer to prove isolation.
 *
 * DATABASE_URL=... SCALE_PORT=8795 node scripts/e2e-customer-relational-journey.js
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ART = '/opt/cursor/artifacts/customer-relational';
const PORT = Number(process.env.SCALE_PORT || 8795);

function ensureArt() {
  fs.mkdirSync(ART, { recursive: true });
}

function req(port, method, urlPath, body, headers = {}) {
  return new Promise((resolve) => {
    const data = body == null ? null : Buffer.isBuffer(body) ? body : JSON.stringify(body);
    const hdrs = { Accept: 'application/json', ...headers };
    if (data && !Buffer.isBuffer(body)) hdrs['Content-Type'] = 'application/json';
    if (data) hdrs['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(
      { hostname: '127.0.0.1', port, path: urlPath, method, headers: hdrs },
      (res) => {
        const c = [];
        res.on('data', (d) => c.push(d));
        res.on('end', () => {
          const buf = Buffer.concat(c);
          let j = {};
          try {
            j = JSON.parse(buf.toString('utf8'));
          } catch {
            j = { raw: buf.slice(0, 120).toString('utf8') };
          }
          resolve({ status: res.statusCode, j, buf });
        });
      }
    );
    r.on('error', (e) => resolve({ status: 0, j: { error: e.message }, buf: Buffer.alloc(0) }));
    r.setTimeout(120000, () => {
      r.destroy();
      resolve({ status: 0, j: { error: 'timeout' }, buf: Buffer.alloc(0) });
    });
    if (data) r.write(data);
    r.end();
  });
}

async function waitHealth(port, ms = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const h = await req(port, 'GET', '/api/health');
    if (h.status === 200) return h;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('health timeout');
}

function startServer(port) {
  const env = {
    PATH: process.env.PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    PORT: String(port),
    HOST: '127.0.0.1',
    AUTO_MIGRATE: '1',
    HUB_CUSTOMER_HYDRATE_MAX: '500',
    HUB_PG_POOL_MAX: '30',
    UV_THREADPOOL_SIZE: '32',
    HUB_CUSTOMER_BACKFILL_BG: '0',
  };
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => {
    log += d;
  });
  child.stderr.on('data', (d) => {
    log += d;
  });
  return { child, log: () => log };
}

function tinyPng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
}

async function journey(port, label) {
  const id = `${label}_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`;
  const password = `Jrn${1000 + Math.floor(Math.random() * 8000)}!a`;
  const email = `${id}@journey.naiosh.local`;
  const phone = `05${String(Date.now() % 10000000000).padStart(10, '0').slice(-10)}`;

  const reg = await req(port, 'POST', '/api/auth/register', {
    fullName: `رحلة ${label}`,
    email,
    phone,
    password,
    confirmPassword: password,
    termsAccepted: true,
    city: 'غزة',
  });
  if (!reg.j?.ok) return { ok: false, step: 'register', reg: reg.j };

  const login = await req(port, 'POST', '/api/auth/login', { email, password });
  if (!login.j?.ok || !login.j.token) return { ok: false, step: 'login', login: login.j };
  const token = login.j.token;
  const auth = { Authorization: `Bearer ${token}` };

  const me = await req(port, 'GET', '/api/client/me', null, auth);
  const prof = await req(port, 'GET', '/api/hub/profiles/me', null, auth);
  const patch = await req(port, 'PATCH', '/api/hub/profiles/me', { city: 'نابلس', fullName: `رحلة ${label} محدث` }, auth);
  const av = await req(port, 'POST', '/api/hub/profiles/me/avatar', tinyPng(), {
    ...auth,
    'Content-Type': 'image/png',
    'Content-Length': String(tinyPng().length),
    'X-File-Name': 'a.png',
    'X-File-Type': 'image/png',
  });
  const sreq = await req(
    port,
    'POST',
    '/api/client/requests',
    { subject: `طلب ${label}`, message: `تفاصيل ${label}`, type: 'support' },
    auth
  );
  const ticket = await req(
    port,
    'POST',
    '/api/client/tickets',
    { subject: `تذكرة ${label}`, message: `رسالة ${label}`, category: 'عام' },
    auth
  );

  // logout revoke
  await req(port, 'POST', '/api/auth/logout', {}, auth);
  const afterLogout = await req(port, 'GET', '/api/client/me', null, auth);

  const login2 = await req(port, 'POST', '/api/auth/login', { email, password });
  const auth2 = { Authorization: `Bearer ${login2.j.token}` };
  const me2 = await req(port, 'GET', '/api/client/me', null, auth2);
  const tickets = await req(port, 'GET', '/api/client/tickets', null, auth2);
  const reqs = await req(port, 'GET', '/api/client/requests', null, auth2);
  const prof2 = await req(port, 'GET', '/api/hub/profiles/me', null, auth2);

  const accountNo = av.j?.accountNo || prof2.j?.header?.accountNo || '';
  const avatarGet = accountNo
    ? await req(port, 'GET', `/api/hub/avatars/${encodeURIComponent(accountNo)}`)
    : { status: 0, buf: Buffer.alloc(0) };

  // Relational table proof
  const rel = require('../lib/hub-customer-relational');
  const bundle = await rel.getClientBundle(email);
  const prow = await rel.getProfileRow(email);

  return {
    ok:
      !!me.j?.ok &&
      !!prof.j?.ok &&
      !!patch.j?.ok &&
      !!(av.j?.ok || av.status === 201) &&
      !!sreq.j?.ok &&
      !!ticket.j?.ok &&
      afterLogout.status === 401 &&
      !!login2.j?.ok &&
      !!me2.j?.ok &&
      (tickets.j?.tickets || []).length >= 1 &&
      (reqs.j?.requests || []).length >= 1 &&
      !!bundle &&
      (bundle.tickets || []).length >= 1 &&
      (bundle.serviceRequests || []).length >= 1 &&
      !!prow &&
      avatarGet.status === 200,
    email,
    password,
    token: login2.j?.token,
    accountNo,
    details: {
      me: me.status,
      prof: prof.status,
      patch: patch.status,
      av: av.status,
      sreq: sreq.status,
      ticket: ticket.status,
      afterLogout: afterLogout.status,
      ticketsN: (tickets.j?.tickets || []).length,
      reqsN: (reqs.j?.requests || []).length,
      relTickets: (bundle?.tickets || []).length,
      relReqs: (bundle?.serviceRequests || []).length,
      profileEmail: prow?.email,
      avatar: avatarGet.status,
    },
  };
}

async function main() {
  ensureArt();
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const { migrate } = require('../db/migrate');
  await migrate();

  const report = { at: new Date().toISOString(), PASS: [], FAIL: [], NOT_TESTED: [], details: {} };
  const mark = (n, p, note) => report[p ? 'PASS' : 'FAIL'].push({ name: n, note });

  const srv = startServer(PORT);
  await waitHealth(PORT);

  const a = await journey(PORT, 'a');
  const b = await journey(PORT, 'b');
  mark('journey_customer_a', a.ok, JSON.stringify(a.details || a));
  mark('journey_customer_b', b.ok, JSON.stringify(b.details || b));

  // Isolation
  let isolation = false;
  if (a.ok && b.ok) {
    const peek = await req(PORT, 'GET', `/api/hub/profiles/by-email/${encodeURIComponent(b.email)}`, null, {
      Authorization: `Bearer ${a.token}`,
    });
    const meA = await req(PORT, 'GET', '/api/client/me', null, { Authorization: `Bearer ${a.token}` });
    isolation =
      (peek.status === 403 || peek.status === 401 || !peek.j?.ok) &&
      String(meA.j?.client?.email || '').toLowerCase() === a.email;
  }
  mark('journey_isolation', isolation, '');

  try {
    srv.child.kill('SIGKILL');
  } catch {
    /* ignore */
  }

  report.verdict = report.FAIL.length === 0 ? 'PASS' : 'FAIL';
  fs.writeFileSync(`${ART}/journey-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.verdict === 'PASS' ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
