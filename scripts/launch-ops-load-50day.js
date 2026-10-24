#!/usr/bin/env node
/**
 * Bounded operational load (not health-only):
 *   N cycles of register → login → create client request → logout-ish
 *   New accounts each cycle. Concurrency capped.
 *
 *   node scripts/launch-ops-load-50day.js
 *
 * Env:
 *   HUB_E2E_BASE | BASE_URL
 *   OPS_LOAD_CYCLES (default 15)
 *   OPS_LOAD_CONCURRENCY (default 3)
 *
 * Writes:
 *   /opt/cursor/artifacts/launch-ops-load-50day.json
 *
 * No passwords or tokens in the artifact.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const BASE = String(
  process.env.HUB_E2E_BASE || process.env.BASE_URL || 'https://naiosh-hub-production.up.railway.app'
).replace(/\/$/, '');
const ART = '/opt/cursor/artifacts';
const CYCLES = Number(process.env.OPS_LOAD_CYCLES || 15);
const CONCURRENCY = Number(process.env.OPS_LOAD_CONCURRENCY || 3);
const stamp = `${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`;

function ensureArt() {
  fs.mkdirSync(ART, { recursive: true });
}

function req(method, pathname, { body, token, timeoutMs = 60000 } = {}) {
  return new Promise((resolve) => {
    const u = new URL(pathname, BASE);
    const lib = u.protocol === 'https:' ? https : http;
    const payload = body !== undefined ? JSON.stringify(body) : null;
    const headers = { Accept: 'application/json', 'User-Agent': 'naiosh-launch-ops-load/1.0' };
    if (payload != null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers['X-Hub-Token'] = token;
    }
    const started = Date.now();
    const r = lib.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = {};
          try {
            json = JSON.parse(raw);
          } catch {
            json = { raw: raw.slice(0, 200) };
          }
          resolve({ status: res.statusCode, json, ms: Date.now() - started });
        });
      }
    );
    r.on('error', (e) => resolve({ status: 0, json: { error: e.message }, ms: Date.now() - started }));
    r.setTimeout(timeoutMs, () => {
      r.destroy();
      resolve({ status: 0, json: { error: 'timeout' }, ms: Date.now() - started });
    });
    if (payload) r.write(payload);
    r.end();
  });
}

function makeCustomer(i) {
  const id = `ops${i}_${stamp}`;
  const password = `Ops${1000 + Math.floor(Math.random() * 8000)}!x`;
  const n = Math.abs(crypto.createHash('sha1').update(id).digest().readUInt32BE(0)) % 1e9;
  return {
    i,
    fullName: `عميل تشغيل ${i} ${stamp.slice(0, 6)}`,
    email: `${id}@naiosh.test`,
    phone: `05${String(n).padStart(9, '0')}`,
    password,
    confirmPassword: password,
    termsAccepted: true,
    city: 'رام الله',
    company: `شركة تشغيل ${i}`,
  };
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function latencyStats(times) {
  const s = [...times].sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    n: s.length,
    avgMs: s.length ? Math.round((sum / s.length) * 100) / 100 : 0,
    p50Ms: pct(s, 50),
    p95Ms: pct(s, 95),
    maxMs: s.length ? s[s.length - 1] : 0,
  };
}

async function oneCycle(i) {
  const cust = makeCustomer(i);
  const steps = {};
  const t0 = Date.now();

  const reg = await req('POST', '/api/auth/register', {
    body: {
      fullName: cust.fullName,
      email: cust.email,
      phone: cust.phone,
      password: cust.password,
      confirmPassword: cust.confirmPassword,
      termsAccepted: true,
      city: cust.city,
      company: cust.company,
    },
  });
  steps.register = {
    status: reg.status,
    ok: !!(reg.json?.ok && reg.json?.user),
    ms: reg.ms,
    err: reg.json?.error || null,
  };

  const login = await req('POST', '/api/auth/login', {
    body: { email: cust.email, password: cust.password },
  });
  const token = login.json?.token || '';
  steps.login = {
    status: login.status,
    ok: !!(login.json?.ok && token),
    ms: login.ms,
    err: login.json?.error || null,
  };

  const create = await req('POST', '/api/client/requests', {
    token,
    body: {
      subject: `طلب تشغيل ${stamp} #${i}`,
      message: `دورة تشغيل محدودة ${i} — ${stamp}`,
      type: 'support',
      priority: 'NORMAL',
    },
  });
  const reqId = create.json?.request?.id || null;
  steps.createRequest = {
    status: create.status,
    ok: !!(create.json?.ok && reqId) && (create.status === 200 || create.status === 201),
    ms: create.ms,
    requestId: reqId,
    err: create.json?.error || null,
  };

  // logout-ish: hit logout endpoint then confirm /me rejects without relying on server session store
  const logout = await req('POST', '/api/auth/logout', { token });
  const meAfter = await req('GET', '/api/auth/me', { token: '' });
  steps.logoutIsh = {
    logoutStatus: logout.status,
    logoutOk: logout.status === 200 || logout.status === 204 || logout.json?.ok === true || logout.status === 401,
    meWithoutTokenStatus: meAfter.status,
    meRejected: meAfter.status === 401 || meAfter.status === 403 || meAfter.json?.ok === false || !meAfter.json?.user,
    ms: logout.ms + meAfter.ms,
  };

  const ok =
    steps.register.ok && steps.login.ok && steps.createRequest.ok && steps.logoutIsh.meRejected;
  return {
    i,
    ok,
    email: cust.email,
    phone: cust.phone,
    totalMs: Date.now() - t0,
    steps,
    // never include password or token
  };
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  }
  const n = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

async function main() {
  ensureArt();
  console.log(`BASE ${BASE}`);
  console.log(`Ops load: ${CYCLES} cycles, concurrency ${CONCURRENCY}, stamp ${stamp}`);

  const health = await req('GET', '/api/health', { timeoutMs: 20000 });
  if (!(health.status === 200 && health.json?.ok)) {
    console.error('Health check failed', health.status, health.json);
  }

  const wall0 = Date.now();
  const indices = Array.from({ length: CYCLES }, (_, i) => i);
  const cycles = await mapPool(indices, CONCURRENCY, async (i) => {
    const row = await oneCycle(i);
    console.log(
      `cycle ${i + 1}/${CYCLES}: ${row.ok ? 'PASS' : 'FAIL'} ${row.totalMs}ms reg=${row.steps.register.status} login=${row.steps.login.status} req=${row.steps.createRequest.status}`
    );
    return row;
  });
  const wallMs = Date.now() - wall0;

  const okN = cycles.filter((c) => c.ok).length;
  const failN = cycles.length - okN;
  const stepKeys = ['register', 'login', 'createRequest'];
  const stepStats = {};
  for (const key of stepKeys) {
    const arr = cycles.map((c) => c.steps[key]);
    const ok = arr.filter((s) => s.ok).length;
    stepStats[key] = {
      ok,
      fail: arr.length - ok,
      errorRate: arr.length ? Math.round(((arr.length - ok) / arr.length) * 10000) / 100 : 0,
      latency: latencyStats(arr.map((s) => s.ms)),
      statusCodes: arr.reduce((acc, s) => {
        acc[String(s.status)] = (acc[String(s.status)] || 0) + 1;
        return acc;
      }, {}),
    };
  }
  const logoutArr = cycles.map((c) => c.steps.logoutIsh);
  stepStats.logoutIsh = {
    ok: logoutArr.filter((s) => s.meRejected).length,
    fail: logoutArr.filter((s) => !s.meRejected).length,
    errorRate:
      logoutArr.length
        ? Math.round((logoutArr.filter((s) => !s.meRejected).length / logoutArr.length) * 10000) / 100
        : 0,
    latency: latencyStats(logoutArr.map((s) => s.ms)),
  };

  const report = {
    at: new Date().toISOString(),
    base: BASE,
    stamp,
    caps: {
      cycles: CYCLES,
      concurrency: CONCURRENCY,
      note: 'Bounded operational journey load (register+login+create request+logout-ish); not a soak/scale suite',
    },
    health: { status: health.status, ok: !!(health.json?.ok), ms: health.ms },
    wallMs,
    cycles: {
      total: cycles.length,
      ok: okN,
      fail: failN,
      errorRatePct: cycles.length ? Math.round((failN / cycles.length) * 10000) / 100 : 0,
      latency: latencyStats(cycles.map((c) => c.totalMs)),
    },
    steps: stepStats,
    samples: cycles.map((c) => ({
      i: c.i,
      ok: c.ok,
      email: c.email,
      phone: c.phone,
      totalMs: c.totalMs,
      registerStatus: c.steps.register.status,
      loginStatus: c.steps.login.status,
      createStatus: c.steps.createRequest.status,
      requestId: c.steps.createRequest.requestId,
      logoutStatus: c.steps.logoutIsh.logoutStatus,
      meWithoutTokenStatus: c.steps.logoutIsh.meWithoutTokenStatus,
    })),
    summary: {
      pass: okN,
      fail: failN,
      total: cycles.length,
      verdict: failN === 0 && health.status === 200 ? 'PASS' : 'FAIL',
    },
  };

  const out = path.join(ART, 'launch-ops-load-50day.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log('\n=== OPS LOAD SUMMARY ===');
  console.log(
    JSON.stringify(
      {
        pass: report.summary.pass,
        fail: report.summary.fail,
        errorRatePct: report.cycles.errorRatePct,
        latency: report.cycles.latency,
        steps: Object.fromEntries(
          Object.entries(stepStats).map(([k, v]) => [k, { ok: v.ok, fail: v.fail, errorRate: v.errorRate, p50: v.latency.p50Ms, p95: v.latency.p95Ms }])
        ),
        file: out,
        verdict: report.summary.verdict,
      },
      null,
      2
    )
  );
  process.exit(report.summary.verdict === 'PASS' ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
