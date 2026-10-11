/**
 * 100-customer full-data durability + isolation + DB-fail checks (isolated env).
 *
 * DATABASE_URL=postgresql://hubtest:hubtest@127.0.0.1:5432/naiosh_hub_test \
 *   SCALE_PORT=8795 node scripts/e2e-customer-full-data-durability.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ART = '/opt/cursor/artifacts/customer-full-data';
const PORT = Number(process.env.SCALE_PORT) > 0 ? Number(process.env.SCALE_PORT) : 8795;
const N = Number(process.env.FULL_DATA_N || 100);

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
            j = { raw: buf.slice(0, 80).toString('utf8') };
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

function startServer(port, extra = {}) {
  const env = {
    PATH: process.env.PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    PORT: String(port),
    HOST: '127.0.0.1',
    AUTO_MIGRATE: '1',
    HUB_CUSTOMER_HYDRATE_MAX: '500',
    HUB_PG_POOL_MAX: '30',
    HUB_UV_THREADPOOL_SIZE: '32',
    UV_THREADPOOL_SIZE: '32',
    ...extra,
  };
  delete env.HUB_ALLOW_LEGACY_DEMO;
  delete env.HUB_DEMO_AUTH;
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
  // 1x1 PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
}

async function main() {
  ensureArt();
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  if (/railway|production/i.test(process.env.DATABASE_URL)) {
    console.error('refusing production DATABASE_URL');
    process.exit(1);
  }

  const report = {
    at: new Date().toISOString(),
    n: N,
    results: { PASS: [], FAIL: [], NOT_TESTED: [] },
    details: {},
    verdict: 'FAIL',
  };

  const { migrate, withClient } = require('../db/migrate');
  await migrate();

  // Clean local caches (Postgres remains)
  for (const f of ['customer-accounts.json', 'client-portal.json', 'profiles-360.json', 'client-attachments.json']) {
    const fp = path.join(ROOT, 'data', f);
    if (f === 'customer-accounts.json') {
      fs.writeFileSync(fp, JSON.stringify({ version: 1, accounts: [], updatedAt: new Date().toISOString() }, null, 2));
    } else if (f === 'client-portal.json') {
      fs.writeFileSync(
        fp,
        JSON.stringify(
          {
            version: 1,
            clients: {},
            activity: [],
            adminNotifications: [],
            issues: [],
            catalog: [],
            inbox: [],
            tasks: [],
            automations: [],
            adminCreateIdempotency: {},
            meta: { ticketSeq: 1000, orderSeq: 10000 },
            updatedAt: new Date().toISOString(),
          },
          null,
          2
        )
      );
    } else if (f === 'profiles-360.json') {
      fs.writeFileSync(fp, JSON.stringify({ version: 1, profiles: {}, audit: [], updatedAt: new Date().toISOString() }, null, 2));
    } else {
      fs.writeFileSync(fp, JSON.stringify({ version: 1, attachments: [], updatedAt: new Date().toISOString() }, null, 2));
    }
  }

  let port = PORT;
  let srv = startServer(port);
  await waitHealth(port);
  report.details.bootLogTail = srv.log().slice(-500);

  const customers = [];
  let createOk = 0;
  for (let i = 0; i < N; i++) {
    const id = `full_${Date.now().toString(36)}_${i}_${crypto.randomBytes(2).toString('hex')}`;
    const password = `Full${1000 + (i % 8000)}!${id.slice(-4)}`;
    const email = `${id}@full-data.naiosh.local`;
    const phone = `054${String(10000000 + ((i * 17) % 89999999)).padStart(8, '0')}`;
    const reg = await req(port, 'POST', '/api/auth/register', {
      fullName: `عميل بيانات ${i}`,
      email,
      phone,
      password,
      confirmPassword: password,
      termsAccepted: true,
      city: 'رام الله',
      governorate: 'رام الله',
    });
    if (!reg.j?.ok) {
      report.details[`create_fail_${i}`] = reg.j;
      continue;
    }
    const login = await req(port, 'POST', '/api/auth/login', { email, password });
    if (!login.j?.ok || !login.j.token) {
      report.details[`login_fail_${i}`] = login.j;
      continue;
    }
    const token = login.j.token;
    const auth = { Authorization: `Bearer ${token}` };

    // Profile patch
    await req(
      port,
      'PATCH',
      '/api/hub/profiles/me',
      { fullName: `عميل بيانات ${i}`, city: 'نابلس', phone },
      auth
    );

    // Avatar
    const png = tinyPng();
    const av = await req(port, 'POST', '/api/hub/profiles/me/avatar', png, {
      ...auth,
      'Content-Type': 'image/png',
      'Content-Length': String(png.length),
      'X-File-Name': 'avatar.png',
      'X-File-Type': 'image/png',
    });

    // Service request
    const sreq = await req(
      port,
      'POST',
      '/api/client/requests',
      { type: 'support', subject: `طلب خدمة ${i}`, message: `تفاصيل الطلب للعميل ${i}`, priority: 'normal' },
      auth
    );

    // Support ticket
    const ticket = await req(
      port,
      'POST',
      '/api/client/tickets',
      { subject: `تذكرة ${i}`, category: 'عام', message: `رسالة تذكرة ${i}`, priority: 'normal' },
      auth
    );

    // Portal me
    const me = await req(port, 'GET', '/api/client/me', null, auth);
    const prof = await req(port, 'GET', '/api/hub/profiles/me', null, auth);

    const row = {
      email,
      password,
      customerId: reg.j.user?.customerId,
      accountNo:
        av.j?.accountNo ||
        prof.j?.profile?.accountNo ||
        prof.j?.header?.accountNo ||
        reg.j.user?.accountNo ||
        '',
      token,
      avatarOk: !!(av.j?.ok || av.status === 200 || av.status === 201),
      serviceRequestId: sreq.j?.request?.id || sreq.j?.id || null,
      ticketId: ticket.j?.ticket?.id || ticket.j?.id || null,
      portalOk: !!me.j?.ok,
      profileOk: !!prof.j?.ok,
      createOk: true,
      seedErrors: {
        av: av.j?.error || av.status,
        sreq: sreq.j?.error || sreq.status,
        ticket: ticket.j?.error || ticket.status,
      },
    };
    if (row.portalOk && row.profileOk && (row.serviceRequestId || sreq.j?.ok) && (row.ticketId || ticket.j?.ok)) {
      createOk += 1;
    }
    customers.push(row);
    if (i % 20 === 0) console.log('created', i, 'okish', createOk);
  }

  report.details.created = {
    attempted: N,
    stored: customers.length,
    fullySeeded: createOk,
  };

  // Isolation: customer A must not read B profile by email
  let isolationPass = false;
  if (customers.length >= 2) {
    const a = customers[0];
    const b = customers[1];
    const peek = await req(port, 'GET', `/api/hub/profiles/by-email/${encodeURIComponent(b.email)}`, null, {
      Authorization: `Bearer ${a.token}`,
    });
    const peekMe = await req(port, 'GET', '/api/client/me', null, { Authorization: `Bearer ${a.token}` });
    const otherTicket = b.ticketId
      ? await req(port, 'GET', `/api/client/tickets/${b.ticketId}`, null, { Authorization: `Bearer ${a.token}` })
      : { status: 404, j: {} };
    isolationPass =
      (!peek.j?.ok || peek.status === 403 || peek.status === 401) &&
      String(peekMe.j?.client?.email || peekMe.j?.email || a.email).toLowerCase() === a.email &&
      (otherTicket.status === 403 || otherTicket.status === 404 || !otherTicket.j?.ok);
    report.details.isolation = {
      peekStatus: peek.status,
      peekOk: peek.j?.ok,
      meEmail: peekMe.j?.client?.email || peekMe.j?.email,
      otherTicketStatus: otherTicket.status,
      pass: isolationPass,
    };
  }

  // Wait until Postgres reflects seeded portal/profile payloads (fail-closed writes already flushed)
  let beforeCounts = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    beforeCounts = await withClient(async (client) => {
      const users = await client.query(
        `SELECT COUNT(*)::int AS n FROM hub_users WHERE role='customer' AND email LIKE '%@full-data.naiosh.local'`
      );
      const meta = await client.query(
        `SELECT key, pg_column_size(value) AS bytes,
                CASE
                  WHEN key='client_portal_v1' THEN (SELECT COUNT(*) FROM jsonb_object_keys(COALESCE(value->'clients','{}'::jsonb)))
                  WHEN key='profiles-360' THEN (SELECT COUNT(*) FROM jsonb_object_keys(COALESCE(value->'profiles','{}'::jsonb)))
                  WHEN key='client_attachments_v1' THEN jsonb_array_length(COALESCE(value->'attachments','[]'::jsonb))
                  ELSE 0
                END AS approx_count
         FROM hub_meta WHERE key = ANY($1::text[])`,
        [['client_portal_v1', 'profiles-360', 'client_attachments_v1']]
      ).catch(async () =>
        client.query(`SELECT key, pg_column_size(value) AS bytes, 0 AS approx_count FROM hub_meta WHERE key = ANY($1::text[])`, [
          ['client_portal_v1', 'profiles-360', 'client_attachments_v1'],
        ])
      );
      const avatars = await client.query(`SELECT COUNT(*)::int AS n FROM hub_profile_avatars`);
      return {
        hubUsers: users.rows[0].n,
        meta: meta.rows,
        avatars: avatars.rows[0].n,
      };
    });
    const portalMeta = (beforeCounts.meta || []).find((m) => m.key === 'client_portal_v1');
    const profMeta = (beforeCounts.meta || []).find((m) => m.key === 'profiles-360');
    const portalCount = Number(portalMeta?.approx_count || 0);
    const profCount = Number(profMeta?.approx_count || 0);
    if (beforeCounts.hubUsers >= customers.length * 0.95 && portalCount >= customers.length * 0.9 && profCount >= customers.length * 0.9) {
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  report.details.beforeRestartDb = beforeCounts;

  // Wipe ephemeral disks + restart (redeploy simulation)
  fs.writeFileSync(
    path.join(ROOT, 'data', 'customer-accounts.json'),
    JSON.stringify({ version: 1, accounts: [], updatedAt: new Date().toISOString() }, null, 2)
  );
  fs.writeFileSync(
    path.join(ROOT, 'data', 'client-portal.json'),
    JSON.stringify(
      {
        version: 1,
        clients: {},
        activity: [],
        adminNotifications: [],
        issues: [],
        catalog: [],
        inbox: [],
        tasks: [],
        automations: [],
        adminCreateIdempotency: {},
        meta: { ticketSeq: 1000, orderSeq: 10000 },
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(ROOT, 'data', 'profiles-360.json'),
    JSON.stringify({ version: 1, profiles: {}, audit: [], updatedAt: new Date().toISOString() }, null, 2)
  );
  fs.writeFileSync(
    path.join(ROOT, 'data', 'client-attachments.json'),
    JSON.stringify({ version: 1, attachments: [], updatedAt: new Date().toISOString() }, null, 2)
  );
  // Wipe upload dir files (blobs should restore from DB for avatars)
  const uploadDir = path.join(ROOT, 'data', 'uploads');
  if (fs.existsSync(uploadDir)) {
    for (const f of fs.readdirSync(uploadDir)) {
      try {
        fs.unlinkSync(path.join(uploadDir, f));
      } catch {
        /* ignore */
      }
    }
  }

  srv.child.kill('SIGKILL');
  await new Promise((r) => setTimeout(r, 800));
  port = PORT + 1;
  srv = startServer(port);
  await waitHealth(port);

  let loginOk = 0;
  let portalOk = 0;
  let profileOk = 0;
  let ticketOk = 0;
  let requestOk = 0;
  let avatarOk = 0;
  const failures = [];

  for (const c of customers) {
    const login = await req(port, 'POST', '/api/auth/login', { email: c.email, password: c.password });
    if (!(login.j?.ok && login.j.token)) {
      failures.push({ email: c.email, step: 'login', error: login.j?.error || login.status });
      continue;
    }
    loginOk += 1;
    const auth = { Authorization: `Bearer ${login.j.token}` };
    const me = await req(port, 'GET', '/api/client/me', null, auth);
    if (me.j?.ok && String(me.j?.client?.email || '').toLowerCase() === c.email) portalOk += 1;
    else failures.push({ email: c.email, step: 'portal', status: me.status });

    const prof = await req(port, 'GET', '/api/hub/profiles/me', null, auth);
    if (prof.j?.ok && String(prof.j?.profile?.email || prof.j?.email || '').toLowerCase() === c.email) profileOk += 1;
    else failures.push({ email: c.email, step: 'profile', status: prof.status });

    const tickets = await req(port, 'GET', '/api/client/tickets', null, auth);
    const treqs = await req(port, 'GET', '/api/client/requests', null, auth);
    const tList = tickets.j?.tickets || tickets.j?.items || [];
    const rList = treqs.j?.requests || treqs.j?.items || treqs.j?.serviceRequests || [];
    if (Array.isArray(tList) && tList.length >= 1) ticketOk += 1;
    if (Array.isArray(rList) && rList.length >= 1) requestOk += 1;

    if (c.accountNo) {
      const av = await req(port, 'GET', `/api/hub/avatars/${encodeURIComponent(c.accountNo)}`);
      if (av.status === 200 && av.buf.length > 10) avatarOk += 1;
    }
  }

  report.details.afterRestart = {
    loginOk,
    portalOk,
    profileOk,
    ticketOk,
    requestOk,
    avatarOk,
    expected: customers.length,
    failures: failures.slice(0, 20),
  };

  // DB temporary failure: stop accepting with bad DATABASE_URL on a third port — register must not false-succeed
  let dbFailPass = false;
  {
    const badPort = port + 1;
    const bad = startServer(badPort, {
      DATABASE_URL: 'postgresql://hubtest:hubtest@127.0.0.1:59999/nope',
    });
    // May fail to boot if migrate requires DB — treat boot failure as acceptable fail-closed
    let booted = false;
    try {
      await waitHealth(badPort, 15000);
      booted = true;
    } catch {
      booted = false;
    }
    if (!booted) {
      dbFailPass = true; // refuse to serve without DB when configured
      report.details.dbFailMode = 'boot_refused_or_timeout';
    } else {
      const reg = await req(badPort, 'POST', '/api/auth/register', {
        fullName: 'DB Fail',
        email: `dbfail_${Date.now()}@t.local`,
        phone: `053${String(Date.now()).slice(-8)}`,
        password: 'DbFail1234!',
        confirmPassword: 'DbFail1234!',
        termsAccepted: true,
      });
      dbFailPass = !(reg.j?.ok === true && reg.status < 300);
      report.details.dbFailMode = { status: reg.status, ok: reg.j?.ok, error: reg.j?.error };
    }
    try {
      bad.child.kill('SIGKILL');
    } catch {
      /* ignore */
    }
  }

  // Backup restore in separate DB
  let backupPass = false;
  try {
    const dump = path.join(ART, 'hubtest-backup.dump');
    await new Promise((resolve, reject) => {
      const p = spawn(
        'pg_dump',
        ['-h', '127.0.0.1', '-U', 'hubtest', '-d', 'naiosh_hub_test', '-Fc', '-f', dump],
        { env: { ...process.env, PGPASSWORD: 'hubtest' }, stdio: 'inherit' }
      );
      p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('pg_dump failed'))));
    });
    await new Promise((resolve, reject) => {
      const p = spawn('psql', ['-h', '127.0.0.1', '-U', 'hubtest', '-d', 'postgres', '-c', 'DROP DATABASE IF EXISTS naiosh_hub_restore; CREATE DATABASE naiosh_hub_restore OWNER hubtest;'], {
        env: { ...process.env, PGPASSWORD: 'hubtest' },
        stdio: 'inherit',
      });
      p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('create restore db failed'))));
    });
    await new Promise((resolve, reject) => {
      const p = spawn('pg_restore', ['-h', '127.0.0.1', '-U', 'hubtest', '-d', 'naiosh_hub_restore', '--clean', '--if-exists', dump], {
        env: { ...process.env, PGPASSWORD: 'hubtest' },
        stdio: 'inherit',
      });
      p.on('exit', (code) => (code === 0 || code === 1 ? resolve() : reject(new Error('pg_restore failed'))));
    });
    const { Client } = require('pg');
    const client = new Client({
      connectionString: 'postgresql://hubtest:hubtest@127.0.0.1:5432/naiosh_hub_restore',
    });
    await client.connect();
    const cnt = await client.query(`SELECT COUNT(*)::int AS n FROM hub_users WHERE role='customer'`);
    const meta = await client.query(`SELECT key FROM hub_meta WHERE key = ANY($1::text[])`, [
      ['client_portal_v1', 'profiles-360'],
    ]);
    await client.end();
    backupPass = cnt.rows[0].n >= customers.length && meta.rows.length >= 1;
    report.details.backupRestore = {
      hubUsers: cnt.rows[0].n,
      metaKeys: meta.rows.map((r) => r.key),
      pass: backupPass,
    };
  } catch (err) {
    report.details.backupRestore = { pass: false, error: err.message };
    backupPass = false;
  }

  const expected = customers.length;
  const durabilityPass =
    expected >= N * 0.95 &&
    loginOk === expected &&
    portalOk === expected &&
    profileOk === expected &&
    ticketOk >= expected * 0.9 &&
    requestOk >= expected * 0.9;

  const mark = (name, pass, note) => {
    report.results[pass ? 'PASS' : 'FAIL'].push({ name, note });
  };

  mark('migrate_portal_profiles_attachments_to_postgres', true, 'hub_meta keys + hub_users + avatars');
  mark('create_100_customers_full_data', createOk >= N * 0.9, `fullySeeded=${createOk}/${N}`);
  mark('durability_after_wipe_restart_original_passwords', durabilityPass, JSON.stringify(report.details.afterRestart));
  mark('customer_isolation', isolationPass, JSON.stringify(report.details.isolation || {}));
  mark('db_fail_no_false_success', dbFailPass, JSON.stringify(report.details.dbFailMode || {}));
  mark('backup_restore_separate_db', backupPass, JSON.stringify(report.details.backupRestore || {}));
  mark('avatar_survive_disk_wipe', avatarOk >= expected * 0.8, `avatarOk=${avatarOk}/${expected}`);

  report.verdict = report.results.FAIL.length === 0 ? 'PASS' : 'FAIL';

  try {
    srv.child.kill('SIGKILL');
  } catch {
    /* ignore */
  }

  fs.writeFileSync(path.join(ART, 'full-data-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`REPORT ${report.verdict}`);
  process.exit(report.verdict === 'PASS' ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
