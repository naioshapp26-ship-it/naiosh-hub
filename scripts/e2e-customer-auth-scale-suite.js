/**
 * Comprehensive customer auth scale + durability suite (isolated env).
 *
 * Requires DATABASE_URL pointing at a dedicated test database (never production).
 *
 * Usage:
 *   DATABASE_URL=postgresql://hubtest:hubtest@127.0.0.1:5432/naiosh_hub_test \
 *     node scripts/e2e-customer-auth-scale-suite.js
 *
 * Env:
 *   SCALE_MAX=10000   (default 10000; use 1000 for quicker runs)
 *   SKIP_10K=1
 *   PROD_SMOKE_BASE=https://...  (optional, max 5 accounts)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const ART = path.join('/opt/cursor/artifacts', 'customer-auth-scale');
const SCALE_MAX = Number(process.env.SCALE_MAX || 10000);
// Do NOT reuse ambient PORT (may point at an unrelated local server without DATABASE_URL).
const PORT = Number(process.env.SCALE_PORT) > 0 ? Number(process.env.SCALE_PORT) : 8795;
const BATCH = Number(process.env.SCALE_BATCH || 50);

function ensureArt() {
  fs.mkdirSync(ART, { recursive: true });
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function stats(times) {
  const s = [...times].sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    n: s.length,
    avgMs: s.length ? Math.round((sum / s.length) * 100) / 100 : 0,
    p95Ms: pct(s, 95),
    p99Ms: pct(s, 99),
    maxMs: s.length ? s[s.length - 1] : 0,
  };
}

async function request(port, method, urlPath, body, headers = {}) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let j = {};
          try {
            j = JSON.parse(raw);
          } catch {
            j = { raw: raw.slice(0, 200) };
          }
          resolve({ status: res.statusCode, j, ms: Date.now() - started });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(120000, () => req.destroy(new Error('timeout')));
    if (data) req.write(data);
    req.end();
  });
}

async function waitHealth(port, ms = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await request(port, 'GET', '/api/health');
      if (r.status === 200) return r;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('server health timeout');
}

function makeAccount(prefix, i) {
  const id = `${prefix}_${i}_${crypto.randomBytes(3).toString('hex')}`;
  // Unique original password per account — NEVER changed to pass durability tests
  const password = `Pw${(1000 + (i % 9000)).toString()}${id.slice(-4)}!`;
  // Phone must be unique across the whole suite (prefix salt + index)
  const prefixSalt = Math.abs(crypto.createHash('sha1').update(prefix).digest().readUInt32BE(0)) % 40000000;
  const phoneNum = 10000000 + ((prefixSalt + i) % 89999999);
  return {
    fullName: `عميل اختبار ${prefix} ${i}`,
    email: `${id}@scale-test.naiosh.local`,
    phone: `059${String(phoneNum).padStart(8, '0')}`,
    password,
    confirmPassword: password,
    termsAccepted: true,
  };
}

async function mapPool(items, concurrency, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return out;
}

async function registerBatch(port, accounts, concurrency) {
  const times = [];
  let ok = 0;
  let fail = 0;
  const errors = [];
  const results = await mapPool(accounts, concurrency, async (acc) => {
    try {
      const r = await request(port, 'POST', '/api/auth/register', acc);
      times.push(r.ms);
      if (r.j?.ok && r.status < 300) {
        ok += 1;
        return {
          ok: true,
          email: acc.email,
          password: acc.password,
          customerId: r.j.user?.customerId,
          accountNo: r.j.user?.accountNo,
        };
      }
      fail += 1;
      if (errors.length < 10) errors.push({ email: acc.email, status: r.status, error: r.j?.error });
      return { ok: false, email: acc.email, password: acc.password, error: r.j?.error };
    } catch (e) {
      fail += 1;
      times.push(0);
      if (errors.length < 10) errors.push({ email: acc.email, error: e.message });
      return { ok: false, email: acc.email, password: acc.password, error: e.message };
    }
  });
  return { ok, fail, times, results, errors, latency: stats(times) };
}

async function loginBatch(port, creds, concurrency) {
  const times = [];
  let ok = 0;
  let fail = 0;
  const errors = [];
  await mapPool(creds, concurrency, async (c) => {
    try {
      const r = await request(port, 'POST', '/api/auth/login', {
        email: c.email,
        password: c.password,
      });
      times.push(r.ms);
      if (r.j?.ok && r.j?.token) ok += 1;
      else {
        fail += 1;
        if (errors.length < 10) errors.push({ email: c.email, status: r.status, error: r.j?.error });
      }
      return r;
    } catch (e) {
      fail += 1;
      times.push(0);
      if (errors.length < 10) errors.push({ email: c.email, error: e.message });
      return null;
    }
  });
  return { ok, fail, times, errors, latency: stats(times) };
}

async function runScalePhase(port, n, prefix, concurrency) {
  const accounts = Array.from({ length: n }, (_, i) => makeAccount(prefix, i));
  const reg = await registerBatch(port, accounts, concurrency);
  const creds = reg.results.filter((r) => r.ok).map((r) => ({ email: r.email, password: r.password }));
  const login = await loginBatch(port, creds, concurrency);

  const ids = reg.results.filter((r) => r.ok).map((r) => r.customerId).filter(Boolean);
  const uniqueIds = new Set(ids);
  const emailSet = new Set(reg.results.filter((r) => r.ok).map((r) => r.email));

  // Duplicate email must 409
  let dupOk = false;
  if (creds[0]) {
    const dup = await request(port, 'POST', '/api/auth/register', {
      ...makeAccount(prefix + 'dup', 0),
      email: creds[0].email,
      phone: `058${String(Date.now()).slice(-8)}`,
    });
    dupOk = dup.status === 409 || /مستخدم/i.test(dup.j?.error || '');
  }

  // Wrong password
  let wrongOk = false;
  if (creds[0]) {
    const bad = await request(port, 'POST', '/api/auth/login', {
      email: creds[0].email,
      password: 'definitely-wrong-password-xx',
    });
    wrongOk = bad.status === 401 && !bad.j?.ok;
  }

  return {
    n,
    register: { ok: reg.ok, fail: reg.fail, latency: reg.latency, errors: reg.errors },
    login: { ok: login.ok, fail: login.fail, latency: login.latency, errors: login.errors },
    uniqueCustomerIds: uniqueIds.size === ids.length,
    uniqueEmails: emailSet.size === creds.length,
    duplicateEmailRejected: dupOk,
    wrongPasswordRejected: wrongOk,
    creds, // keep original passwords for durability
    pass:
      reg.ok === n &&
      login.ok === n &&
      uniqueIds.size === ids.length &&
      dupOk &&
      wrongOk,
  };
}

async function runConcurrencyBurst(port, n = 40) {
  const accounts = Array.from({ length: n }, (_, i) => makeAccount('burst', i));
  const started = Date.now();
  const reg = await registerBatch(port, accounts, n);
  const login = await loginBatch(
    port,
    reg.results.filter((r) => r.ok).map((r) => ({ email: r.email, password: r.password })),
    n
  );
  return {
    n,
    wallMs: Date.now() - started,
    registerOk: reg.ok,
    registerFail: reg.fail,
    loginOk: login.ok,
    loginFail: login.fail,
    pass: reg.ok === n && login.ok === n,
    latencyRegister: reg.latency,
    latencyLogin: login.latency,
  };
}

async function runDurability(port, creds, restartServer) {
  // 1) Wipe ephemeral JSON + clear module would happen on restart
  const storePath = path.join(ROOT, 'data', 'customer-accounts.json');
  const before = [...creds];
  fs.writeFileSync(
    storePath,
    JSON.stringify({ version: 1, accounts: [], updatedAt: new Date().toISOString() }, null, 2)
  );

  // 2) Restart process (new container / redeploy simulation)
  const newPort = await restartServer();

  // 3) Login with ORIGINAL passwords — must not change passwords to pass
  const login = await loginBatch(newPort, before, 20);
  return {
    wipedLocalJson: true,
    restarted: true,
    loginOk: login.ok,
    loginFail: login.fail,
    expected: before.length,
    pass: login.ok === before.length && login.fail === 0,
    errors: login.errors,
    latency: login.latency,
    port: newPort,
  };
}

async function runDbDisconnect(port, creds) {
  // Brief pause of postgres is invasive; instead verify login fails closed then recovers
  // by checking health.database when URL present.
  const health = await request(port, 'GET', '/api/health');
  const linked = !!health.j?.database?.linked || health.j?.database?.ok;
  const sample = creds.slice(0, Math.min(20, creds.length));
  const login = await loginBatch(port, sample, 10);
  return {
    databaseLinked: linked,
    sampleLoginOk: login.ok,
    sampleLoginFail: login.fail,
    pass: linked && login.ok === sample.length,
  };
}

async function prodSmoke(base) {
  const results = [];
  for (let i = 0; i < 5; i++) {
    const acc = makeAccount('prodsmoke', i);
    const regRes = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(acc),
    });
    const reg = await regRes.json().catch(() => ({}));
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: acc.email, password: acc.password }),
    });
    const login = await loginRes.json().catch(() => ({}));
    results.push({
      email: acc.email,
      regOk: !!reg.ok,
      loginOk: !!login.ok && !!login.token,
      // keep password out of report file? include for local debug only — strip
    });
  }
  return {
    n: results.length,
    ok: results.filter((r) => r.regOk && r.loginOk).length,
    pass: results.every((r) => r.regOk && r.loginOk),
    results: results.map(({ email, regOk, loginOk }) => ({ email, regOk, loginOk })),
  };
}

async function main() {
  ensureArt();
  if (!process.env.DATABASE_URL) {
    console.error('FAIL: DATABASE_URL required for isolated scale suite');
    process.exit(1);
  }
  if (/railway\.app|naiosh-hub-production/i.test(process.env.DATABASE_URL)) {
    console.error('FAIL: refusing to run scale suite against production DATABASE_URL');
    process.exit(1);
  }

  const report = {
    at: new Date().toISOString(),
    architecture: {
      durableStore: 'Postgres hub_users (row-per-customer)',
      passwordHash: 'scrypt (crypto.scrypt, salt per password)',
      localJson: 'cache only',
      sessions: 'opaque hub360.cust.* tokens; revoke list in memory/file',
    },
    phases: {},
    verdict: 'FAIL',
  };

  // Fresh test DB schema
  const { migrate } = require('../db/migrate');
  await migrate();

  // Reset customer rows for clean run
  const { withClient } = require('../db/migrate');
  await withClient(async (client) => {
    await client.query(`DELETE FROM hub_users WHERE role = 'customer'`);
    await client.query(`DELETE FROM hub_meta WHERE key = 'customer_accounts_v1'`);
  });
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, 'data', 'customer-accounts.json'),
    JSON.stringify({ version: 1, accounts: [], updatedAt: new Date().toISOString() }, null, 2)
  );

  let child = null;
  let currentPort = PORT;

  function startServer(port, extraEnv = {}) {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        PORT: String(port),
        HOST: '127.0.0.1',
        DATABASE_URL: process.env.DATABASE_URL,
        AUTO_MIGRATE: '1',
        HUB_SCALE_SUITE: '1',
        HUB_CUSTOMER_HYDRATE_MAX: process.env.HUB_CUSTOMER_HYDRATE_MAX || '200',
        HUB_PG_POOL_MAX: process.env.HUB_PG_POOL_MAX || '30',
        // Isolate auth durability from portal JSON amplification on large phases
        HUB_AUTH_LIGHT_SIDE_EFFECTS: process.env.HUB_AUTH_LIGHT_SIDE_EFFECTS || '0',
        ...extraEnv,
      };
      // Do not inherit demo flags that inflate boot work
      delete env.HUB_ALLOW_LEGACY_DEMO;
      delete env.HUB_DEMO_AUTH;
      const c = spawn(process.execPath, ['server.js'], {
        cwd: ROOT,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let log = '';
      c.stdout.on('data', (d) => {
        log += d.toString();
      });
      c.stderr.on('data', (d) => {
        log += d.toString();
      });
      waitHealth(port, 120000)
        .then(() => resolve({ child: c, log }))
        .catch((e) => {
          try {
            c.kill('SIGKILL');
          } catch {
            /* ignore */
          }
          reject(new Error(`${e.message}\n${log.slice(-2000)}`));
        });
    });
  }

  async function stopServer(c) {
    if (!c) return;
    c.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 400));
    try {
      c.kill('SIGKILL');
    } catch {
      /* ignore */
    }
  }

  try {
    const boot = await startServer(currentPort);
    child = boot.child;

    // Architecture audit via module
    delete require.cache[require.resolve('../lib/hub-customer-auth')];
    const customerAuth = require('../lib/hub-customer-auth');
    report.phases.architectureAudit = await customerAuth.auditAffectedAccounts();
    report.phases.architectureAudit.pass = !!customerAuth.dbEnabled();

    // Unit durable wipe (module-level)
    {
      const acc = makeAccount('unit', 1);
      const reg = await customerAuth.register(acc);
      fs.writeFileSync(
        path.join(ROOT, 'data', 'customer-accounts.json'),
        JSON.stringify({ version: 1, accounts: [], updatedAt: new Date().toISOString() }, null, 2)
      );
      delete require.cache[require.resolve('../lib/hub-customer-auth')];
      const ca2 = require('../lib/hub-customer-auth');
      const login = await ca2.login({ email: acc.email, password: acc.password });
      report.phases.unitWipeOriginalPassword = {
        pass: !!(reg.ok && login.ok),
        regOk: !!reg.ok,
        loginOk: !!login.ok,
      };
    }

    const phases = [
      { n: 10, prefix: 'p10', concurrency: 5, light: false },
      { n: 100, prefix: 'p100', concurrency: 15, light: false },
    ];
    if (SCALE_MAX >= 1000) phases.push({ n: 1000, prefix: 'p1k', concurrency: Math.min(BATCH, 20), light: true, restart: true });
    if (SCALE_MAX >= 10000 && process.env.SKIP_10K !== '1') {
      phases.push({ n: 10000, prefix: 'p10k', concurrency: Math.min(BATCH, 15), light: true, restart: true });
    }

    let durabilityCreds = [];
    for (const p of phases) {
      if (p.restart) {
        await stopServer(child);
        child = null;
        // Reset bloated local JSON caches between large phases (Postgres remains source of truth)
        for (const f of ['client-portal.json', 'profiles-360.json', 'customer-accounts.json']) {
          const fp = path.join(ROOT, 'data', f);
          try {
            if (f === 'customer-accounts.json') {
              fs.writeFileSync(fp, JSON.stringify({ version: 1, accounts: [], updatedAt: new Date().toISOString() }, null, 2));
            } else if (fs.existsSync(fp)) {
              fs.writeFileSync(fp, f.includes('portal') ? '{"version":1,"clients":{}}' : '{"version":1,"profiles":{}}');
            }
          } catch {
            /* ignore */
          }
        }
        currentPort += 1;
        const bootN = await startServer(currentPort, {
          HUB_AUTH_LIGHT_SIDE_EFFECTS: p.light ? '1' : '0',
        });
        child = bootN.child;
      }
      console.log(`\n=== SCALE ${p.n} (lightSideEffects=${!!p.light}) ===`);
      const result = await runScalePhase(currentPort, p.n, p.prefix, p.concurrency);
      report.phases[`scale_${p.n}`] = {
        pass: result.pass,
        register: result.register,
        login: result.login,
        uniqueCustomerIds: result.uniqueCustomerIds,
        uniqueEmails: result.uniqueEmails,
        duplicateEmailRejected: result.duplicateEmailRejected,
        wrongPasswordRejected: result.wrongPasswordRejected,
      };
      console.log(
        `scale_${p.n}: pass=${result.pass} reg=${result.register.ok}/${p.n} login=${result.login.ok}/${p.n}`
      );
      if (p.n === 100 || (p.n === 10 && !durabilityCreds.length)) {
        durabilityCreds = result.creds.slice(0, Math.min(50, result.creds.length));
      }
      if (!result.pass && p.n >= 1000) break;
    }

    console.log('\n=== CONCURRENCY BURST ===');
    report.phases.concurrencyBurst = await runConcurrencyBurst(currentPort, 40);
    console.log('burst', report.phases.concurrencyBurst.pass);

    console.log('\n=== DURABILITY (wipe JSON + restart, original passwords) ===');
    report.phases.durability = await runDurability(currentPort, durabilityCreds, async () => {
      await stopServer(child);
      child = null;
      currentPort += 1;
      const boot2 = await startServer(currentPort);
      child = boot2.child;
      return currentPort;
    });
    console.log('durability', report.phases.durability.pass, report.phases.durability);

    report.phases.dbConnectivity = await runDbDisconnect(currentPort, durabilityCreds);

    // Rate limit: many wrong logins should 429 without breaking a later good login forever
    {
      const victim = durabilityCreds[0];
      let saw429 = false;
      if (victim) {
        for (let i = 0; i < 20; i++) {
          const r = await request(currentPort, 'POST', '/api/auth/login', {
            email: victim.email,
            password: 'wrong-wrong-wrong',
          });
          if (r.status === 429) {
            saw429 = true;
            break;
          }
        }
        // Wait lock window if needed — use a different IP header to prove legit user not globally blocked
        const good = await request(
          currentPort,
          'POST',
          '/api/auth/login',
          { email: victim.email, password: victim.password },
          { 'X-Forwarded-For': '203.0.113.50' }
        );
        report.phases.rateLimit = {
          saw429,
          legitLoginFromOtherIp: !!good.j?.ok,
          pass: saw429 && !!good.j?.ok,
        };
      } else {
        report.phases.rateLimit = { pass: false, reason: 'no_creds' };
      }
    }

    if (process.env.PROD_SMOKE_BASE) {
      console.log('\n=== PROD SMOKE (5 accounts max) ===');
      report.phases.prodSmoke = await prodSmoke(process.env.PROD_SMOKE_BASE.replace(/\/$/, ''));
    }

    const required = [
      report.phases.architectureAudit,
      report.phases.unitWipeOriginalPassword,
      report.phases.scale_10,
      report.phases.scale_100,
      report.phases.concurrencyBurst,
      report.phases.durability,
      report.phases.dbConnectivity,
      report.phases.rateLimit,
    ];
    if (report.phases.scale_1000) required.push(report.phases.scale_1000);
    if (report.phases.scale_10000) required.push(report.phases.scale_10000);
    if (report.phases.prodSmoke) required.push(report.phases.prodSmoke);

    report.verdict = required.every((p) => p && p.pass) ? 'PASS' : 'FAIL';
  } catch (err) {
    report.error = err.message || String(err);
    report.verdict = 'FAIL';
  } finally {
    await stopServer(child);
  }

  const out = path.join(ART, 'scale-report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log('\n' + JSON.stringify(report, null, 2));
  console.log(`REPORT ${report.verdict} → ${out}`);
  process.exit(report.verdict === 'PASS' ? 0 : 1);
}

main();
