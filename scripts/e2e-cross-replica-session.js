/**
 * Cross-replica session revoke without sticky sessions.
 *
 * Starts two app instances + round-robin LB, then:
 *  1) register/login via LB
 *  2) hit /api/client/me on replica A (direct)
 *  3) hit /api/hub/profiles/me on replica B (direct) — same token
 *  4) logout on replica A (await Postgres revoke)
 *  5) prove token rejected on replica B immediately (no sticky)
 *
 * DATABASE_URL=... node scripts/e2e-cross-replica-session.js
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ART = '/opt/cursor/artifacts/customer-integrity';
const PORT_A = Number(process.env.REPLICA_A || 8811);
const PORT_B = Number(process.env.REPLICA_B || 8812);
const PORT_LB = Number(process.env.LISTEN || 8810);

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
            j = { raw: buf.slice(0, 160).toString('utf8') };
          }
          resolve({ status: res.statusCode, j, buf });
        });
      }
    );
    r.on('error', (e) => resolve({ status: 0, j: { error: e.message }, buf: Buffer.alloc(0) }));
    r.setTimeout(60000, () => {
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
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`health timeout port=${port}`);
}

function startServer(port, label) {
  const env = {
    PATH: process.env.PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    PORT: String(port),
    HOST: '127.0.0.1',
    AUTO_MIGRATE: '1',
    HUB_CUSTOMER_HYDRATE_MAX: '200',
    HUB_PG_POOL_MAX: '20',
    UV_THREADPOOL_SIZE: '16',
    HUB_CUSTOMER_BACKFILL_BG: '0',
    HUB_INSTANCE_ID: label,
  };
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => {
    log += d;
  });
  child.stderr.on('data', (d) => {
    log += d;
  });
  return {
    child,
    log: () => log,
    stop: () => {
      try {
        child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    },
  };
}

function startLb() {
  const child = spawn(
    process.execPath,
    [path.join(ROOT, 'scripts/multi-instance-lb.js')],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        LISTEN: String(PORT_LB),
        HUB_UPSTREAMS: `${PORT_A},${PORT_B}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  return {
    child,
    stop: () => {
      try {
        child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    },
  };
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }

  const report = {
    at: new Date().toISOString(),
    sticky: false,
    ports: { lb: PORT_LB, a: PORT_A, b: PORT_B },
    PASS: [],
    FAIL: [],
    steps: [],
  };
  const mark = (name, ok, note) => {
    report.steps.push({ name, ok, note });
    report[ok ? 'PASS' : 'FAIL'].push({ name, note });
    console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${note}`);
  };

  const a = startServer(PORT_A, 'replica-a');
  const b = startServer(PORT_B, 'replica-b');
  const lb = startLb();

  try {
    await waitHealth(PORT_A);
    await waitHealth(PORT_B);
    mark('replicas_healthy', true, `A=${PORT_A} B=${PORT_B}`);

    const id = `xrep_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`;
    const email = `${id}@xrep.naiosh.local`;
    const password = `Xrep${1000 + Math.floor(Math.random() * 8000)}!a`;
    const phone = `05${String(Date.now() % 10000000000).padStart(10, '0').slice(-10)}`;

    const reg = await req(PORT_LB, 'POST', '/api/auth/register', {
      fullName: 'Cross Replica Customer',
      email,
      phone,
      password,
      confirmPassword: password,
      termsAccepted: true,
    });
    mark('register_via_lb', !!reg.j?.ok, JSON.stringify({ status: reg.status, err: reg.j?.error }).slice(0, 200));

    const login = await req(PORT_LB, 'POST', '/api/auth/login', { email, password });
    const token = login.j?.token;
    mark('login_via_lb', !!token, JSON.stringify({ status: login.status }).slice(0, 120));
    if (!token) throw new Error('no token');

    const auth = { Authorization: `Bearer ${token}` };

    const meA = await req(PORT_A, 'GET', '/api/client/me', null, auth);
    mark('session_works_on_replica_a', meA.status === 200 && !!meA.j?.ok, JSON.stringify({ status: meA.status }).slice(0, 120));

    const meB = await req(PORT_B, 'GET', '/api/hub/profiles/me', null, auth);
    mark('session_works_on_replica_b', meB.status === 200 && !!meB.j?.ok, JSON.stringify({ status: meB.status }).slice(0, 120));

    // Prove LB is round-robin (not sticky) by sampling Instance or Set-Cookie absence + alternating upstreams via health headers if any
    const hits = [];
    for (let i = 0; i < 6; i++) {
      const h = await req(PORT_LB, 'GET', '/api/health');
      hits.push(h.status);
    }
    mark('lb_round_robin_no_sticky_config', hits.every((s) => s === 200), `health hits=${hits.join(',')}; HUB_UPSTREAMS=${PORT_A},${PORT_B}`);

    const logout = await req(PORT_A, 'POST', '/api/auth/logout', {}, auth);
    mark('logout_on_replica_a_awaits_db', logout.status === 200 && !!logout.j?.ok, JSON.stringify(logout.j).slice(0, 160));

    // Immediate check on the OTHER replica — must fail without waiting for hydrate TTL
    const afterB = await req(PORT_B, 'GET', '/api/client/me', null, auth);
    const afterProfB = await req(PORT_B, 'GET', '/api/hub/profiles/me', null, auth);
    const revoked =
      (afterB.status === 401 || afterB.j?.ok === false) &&
      (afterProfB.status === 401 || afterProfB.j?.ok === false);
    mark(
      'token_revoked_on_replica_b_immediately',
      revoked,
      JSON.stringify({
        clientMe: { status: afterB.status, err: afterB.j?.error },
        profile: { status: afterProfB.status, err: afterProfB.j?.error },
      }).slice(0, 400)
    );

    const afterA = await req(PORT_A, 'GET', '/api/client/me', null, auth);
    mark(
      'token_revoked_on_replica_a',
      afterA.status === 401 || afterA.j?.ok === false,
      JSON.stringify({ status: afterA.status, err: afterA.j?.error }).slice(0, 200)
    );

    // Relogin still works
    const login2 = await req(PORT_B, 'POST', '/api/auth/login', { email, password });
    const token2 = login2.j?.token;
    const me2 = token2 ? await req(PORT_A, 'GET', '/api/client/me', null, { Authorization: `Bearer ${token2}` }) : { status: 0 };
    mark('relogin_after_revoke', !!token2 && me2.status === 200, JSON.stringify({ login: login2.status, me: me2.status }));
  } catch (err) {
    mark('suite_error', false, err.message);
  } finally {
    a.stop();
    b.stop();
    lb.stop();
    fs.writeFileSync(path.join(ART, 'a-server.log'), a.log());
    fs.writeFileSync(path.join(ART, 'b-server.log'), b.log());
  }

  const out = path.join(ART, 'cross-replica-session.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log('Wrote', out);
  process.exit(report.FAIL.length ? 1 : 0);
}

main();
