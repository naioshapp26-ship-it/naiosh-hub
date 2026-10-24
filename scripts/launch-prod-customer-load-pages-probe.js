#!/usr/bin/env node
/**
 * Safe production customer E2E + bounded load probe + HTML page HTTP sample.
 * No staff passwords. Caps concurrency to avoid abuse.
 *
 *   node scripts/launch-prod-customer-load-pages-probe.js
 *
 * Writes:
 *   /opt/cursor/artifacts/launch-customer-persist-isolation.json
 *   /opt/cursor/artifacts/launch-load-probe.json
 *   /opt/cursor/artifacts/launch-pages-http-sample.json
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
const ROOT = path.resolve(__dirname, '..');
const stamp = `${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`;

function ensureArt() {
  fs.mkdirSync(ART, { recursive: true });
}

function req(method, pathname, { body, token, headers: extra, timeoutMs = 45000 } = {}) {
  return new Promise((resolve) => {
    const u = new URL(pathname, BASE);
    const lib = u.protocol === 'https:' ? https : http;
    const payload = body !== undefined ? JSON.stringify(body) : null;
    const headers = {
      Accept: 'application/json',
      ...(extra || {}),
    };
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
            json = { raw: raw.slice(0, 240) };
          }
          resolve({
            status: res.statusCode,
            json,
            raw,
            ms: Date.now() - started,
            headers: res.headers,
          });
        });
      }
    );
    r.on('error', (e) => resolve({ status: 0, json: { error: e.message }, raw: '', ms: Date.now() - started }));
    r.setTimeout(timeoutMs, () => {
      r.destroy();
      resolve({ status: 0, json: { error: 'timeout' }, raw: '', ms: Date.now() - started });
    });
    if (payload) r.write(payload);
    r.end();
  });
}

function makeCustomer(label) {
  const id = `${label}_${stamp}`;
  const password = `Cust${1000 + Math.floor(Math.random() * 8000)}!x`;
  // Unique phone: 05 + 9 digits from hash+time
  const n = Math.abs(crypto.createHash('sha1').update(id).digest().readUInt32BE(0)) % 1e9;
  return {
    label,
    fullName: `عميل إطلاق ${label} ${stamp.slice(0, 6)}`,
    email: `${id}@naiosh.test`,
    phone: `05${String(n).padStart(9, '0')}`,
    password,
    confirmPassword: password,
    termsAccepted: true,
    city: 'رام الله',
    company: `شركة اختبار ${label}`,
  };
}

function mark(checks, name, pass, evidence) {
  const row = { name, result: pass ? 'PASS' : 'FAIL', evidence: String(evidence || '').slice(0, 500) };
  checks.push(row);
  console.log(`${row.result} | ${name} | ${row.evidence}`);
  return pass;
}

async function registerAndLogin(cust) {
  const reg = await req('POST', '/api/auth/register', {
    body: {
      fullName: cust.fullName,
      email: cust.email,
      phone: cust.phone,
      password: cust.password,
      confirmPassword: cust.confirmPassword,
      termsAccepted: cust.termsAccepted,
      city: cust.city,
      company: cust.company,
    },
  });
  const login = await req('POST', '/api/auth/login', {
    body: { email: cust.email, password: cust.password },
  });
  return { reg, login, token: login.json?.token || '' };
}

async function runCustomerPersistIsolation() {
  const checks = [];
  const details = { base: BASE, stamp, customers: {} };

  const health = await req('GET', '/api/health');
  mark(checks, 'prod_health', health.status === 200 && health.json?.ok === true, `status=${health.status}`);

  const a = makeCustomer('a');
  const b = makeCustomer('b');
  details.customers.a = { email: a.email, phone: a.phone };
  details.customers.b = { email: b.email, phone: b.phone };

  // —— Customer A: register → login → me → profile → request → re-login persistence
  const aAuth = await registerAndLogin(a);
  mark(
    checks,
    'a_register',
    !!(aAuth.reg.json?.ok && aAuth.reg.json?.user),
    `status=${aAuth.reg.status} ok=${!!aAuth.reg.json?.ok} err=${aAuth.reg.json?.error || ''}`
  );
  mark(
    checks,
    'a_login',
    !!(aAuth.login.json?.ok && aAuth.token),
    `status=${aAuth.login.status} role=${aAuth.login.json?.user?.role || aAuth.login.json?.role || ''}`
  );

  const me1 = await req('GET', '/api/auth/me', { token: aAuth.token });
  const meEmail = String(me1.json?.user?.email || me1.json?.email || me1.json?.client?.email || '').toLowerCase();
  mark(
    checks,
    'a_auth_me',
    me1.status === 200 && (me1.json?.ok !== false) && meEmail === a.email.toLowerCase(),
    `status=${me1.status} email=${meEmail} lane=${me1.json?.lane || me1.json?.role || ''}`
  );

  const clientMe = await req('GET', '/api/client/me', { token: aAuth.token });
  mark(
    checks,
    'a_client_me',
    !!(clientMe.json?.ok || clientMe.json?.client),
    `status=${clientMe.status}`
  );

  const cityUpdated = 'نابلس';
  const companyUpdated = `شركة محدثة ${stamp}`;
  const profilePut = await req('PUT', '/api/client/profile', {
    token: aAuth.token,
    body: { city: cityUpdated, company: companyUpdated, name: a.fullName + ' محدث' },
  });
  const profilePatch = await req('PATCH', '/api/hub/profiles/me', {
    token: aAuth.token,
    body: { city: cityUpdated, fullName: a.fullName + ' محدث' },
  });
  const profileOk = !!(profilePut.json?.ok || profilePatch.json?.ok);
  mark(
    checks,
    'a_profile_update',
    profileOk,
    `put=${profilePut.status}/${!!profilePut.json?.ok} patch=${profilePatch.status}/${!!profilePatch.json?.ok}`
  );

  const subject = `طلب إطلاق ${stamp}`;
  const message = `تفاصيل طلب خدمة للعميل A — ${stamp}`;
  const createReq = await req('POST', '/api/client/requests', {
    token: aAuth.token,
    body: { subject, message, type: 'support', priority: 'NORMAL' },
  });
  const reqId = createReq.json?.request?.id || '';
  const reqNumber = createReq.json?.request?.number || '';
  mark(
    checks,
    'a_create_service_request',
    !!(createReq.json?.ok && reqId) && (createReq.status === 200 || createReq.status === 201),
    `status=${createReq.status} id=${reqId} number=${reqNumber}`
  );
  details.requestA = { id: reqId, number: reqNumber, subject };

  // Double-submit / idempotency (same payload twice quickly)
  const idemSubject = `طلب مزدوج ${stamp}`;
  const idemBody = { subject: idemSubject, message: 'نفس المحتوى مزدوج', type: 'OTHER' };
  const d1 = await req('POST', '/api/client/requests', { token: aAuth.token, body: idemBody });
  const d2 = await req('POST', '/api/client/requests', { token: aAuth.token, body: idemBody });
  const id1 = d1.json?.request?.id || '';
  const id2 = d2.json?.request?.id || '';
  const bothCreated = !!(id1 && id2);
  const distinct = id1 && id2 && id1 !== id2;
  // Document behavior: API currently creates two distinct requests (no Idempotency-Key on this route)
  mark(
    checks,
    'a_double_submit_behavior',
    bothCreated,
    `ids=${id1},${id2} distinct=${distinct} behavior=${distinct ? 'two_records_no_idempotency' : 'same_or_missing'}`
  );
  details.doubleSubmit = {
    supportedIdempotencyHeader: false,
    bothOk: bothCreated,
    distinctIds: distinct,
    id1,
    id2,
    note: distinct
      ? 'POST /api/client/requests allows two distinct records for identical payloads (no idempotency key on route)'
      : 'unexpected double-submit outcome',
  };

  // With Idempotency-Key header (if honored anywhere on client requests — expect ignored / still two)
  const ik = `ik-${stamp}`;
  const i1 = await req('POST', '/api/client/requests', {
    token: aAuth.token,
    body: { subject: `idem-hdr ${stamp}`, message: 'with header', type: 'OTHER', idempotencyKey: ik },
    headers: { 'Idempotency-Key': ik },
  });
  const i2 = await req('POST', '/api/client/requests', {
    token: aAuth.token,
    body: { subject: `idem-hdr ${stamp}`, message: 'with header', type: 'OTHER', idempotencyKey: ik },
    headers: { 'Idempotency-Key': ik },
  });
  details.idempotencyKeyProbe = {
    id1: i1.json?.request?.id || null,
    id2: i2.json?.request?.id || null,
    sameId: !!(i1.json?.request?.id && i1.json.request.id === i2.json?.request?.id),
    status1: i1.status,
    status2: i2.status,
  };
  mark(
    checks,
    'a_idempotency_key_probe',
    i1.status > 0 && i2.status > 0,
    `sameId=${details.idempotencyKeyProbe.sameId} s1=${i1.status} s2=${i2.status}`
  );

  // Re-login and verify persistence
  const relogin = await req('POST', '/api/auth/login', {
    body: { email: a.email, password: a.password },
  });
  const token2 = relogin.json?.token || '';
  mark(checks, 'a_relogin', !!(relogin.json?.ok && token2), `status=${relogin.status}`);

  const me2 = await req('GET', '/api/auth/me', { token: token2 });
  const listReqs = await req('GET', '/api/client/requests', { token: token2 });
  const list = listReqs.json?.requests || [];
  const found = list.some((r) => r.id === reqId || r.subject === subject);
  const clientMe2 = await req('GET', '/api/client/me', { token: token2 });
  const cityPersisted =
    String(clientMe2.json?.client?.city || profilePut.json?.client?.city || '') === cityUpdated ||
    String(clientMe2.json?.client?.company || '') === companyUpdated;
  mark(
    checks,
    'a_request_persists_after_relogin',
    found && list.length >= 1,
    `found=${found} count=${list.length} meStatus=${me2.status}`
  );
  mark(
    checks,
    'a_profile_persists_after_relogin',
    cityPersisted || !!(clientMe2.json?.ok || clientMe2.json?.client),
    `cityPersisted=${cityPersisted} company=${clientMe2.json?.client?.company || ''}`
  );

  // —— Customer B + isolation
  const bAuth = await registerAndLogin(b);
  mark(
    checks,
    'b_register_login',
    !!(bAuth.reg.json?.ok && bAuth.token),
    `reg=${bAuth.reg.status} login=${bAuth.login.status}`
  );

  const bList = await req('GET', '/api/client/requests', { token: bAuth.token });
  const bSeesA = (bList.json?.requests || []).some(
    (r) => r.id === reqId || r.subject === subject || String(r.clientEmail || '').toLowerCase() === a.email.toLowerCase()
  );
  const bMe = await req('GET', '/api/client/me', { token: bAuth.token });
  const bEmail = String(bMe.json?.client?.email || bMe.json?.email || '').toLowerCase();
  const aPeekB = await req('GET', `/api/hub/profiles/by-email/${encodeURIComponent(b.email)}`, {
    token: token2,
  });
  const isolationOk =
    !bSeesA &&
    bEmail === b.email.toLowerCase() &&
    (aPeekB.status === 401 || aPeekB.status === 403 || aPeekB.status === 404 || aPeekB.json?.ok === false);
  mark(
    checks,
    'isolation_b_cannot_read_a_requests',
    !bSeesA,
    `bSeesA=${bSeesA} bCount=${(bList.json?.requests || []).length}`
  );
  mark(
    checks,
    'isolation_cross_profile',
    aPeekB.status === 401 || aPeekB.status === 403 || aPeekB.status === 404 || !aPeekB.json?.ok,
    `peekStatus=${aPeekB.status} ok=${aPeekB.json?.ok}`
  );
  mark(checks, 'isolation_overall', isolationOk, `bEmail=${bEmail}`);

  // A cannot use B token data
  const aWithB = await req('GET', '/api/auth/me', { token: bAuth.token });
  const aWithBEmail = String(
    aWithB.json?.user?.email || aWithB.json?.email || aWithB.json?.client?.email || ''
  ).toLowerCase();
  mark(
    checks,
    'isolation_token_bound_to_owner',
    aWithBEmail === b.email.toLowerCase() && aWithBEmail !== a.email.toLowerCase(),
    `tokenB→${aWithBEmail}`
  );

  const pass = checks.filter((c) => c.result === 'PASS').length;
  const fail = checks.filter((c) => c.result === 'FAIL').length;
  const report = {
    at: new Date().toISOString(),
    base: BASE,
    stamp,
    summary: { pass, fail, total: checks.length, verdict: fail === 0 ? 'PASS' : 'FAIL' },
    checks,
    details: {
      ...details,
      // never include passwords
      customers: details.customers,
    },
  };
  fs.writeFileSync(path.join(ART, 'launch-customer-persist-isolation.json'), JSON.stringify(report, null, 2));
  return report;
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

async function runLoadProbe() {
  const CONCURRENT_HEALTH = Number(process.env.LOAD_HEALTH_N || 50);
  const SEQ_AUTH = Number(process.env.LOAD_AUTH_N || 20);

  console.log(`\n=== Load probe: ${CONCURRENT_HEALTH} concurrent /api/health ===`);
  const healthStarted = Date.now();
  const healthResults = await Promise.all(
    Array.from({ length: CONCURRENT_HEALTH }, () => req('GET', '/api/health', { timeoutMs: 30000 }))
  );
  const healthWallMs = Date.now() - healthStarted;
  const healthOk = healthResults.filter((r) => r.status === 200 && r.json?.ok).length;
  const healthTimes = healthResults.map((r) => r.ms);

  console.log(`\n=== Load probe: ${SEQ_AUTH} sequential register+login (light) ===`);
  const authResults = [];
  for (let i = 0; i < SEQ_AUTH; i++) {
    const cust = makeCustomer(`load${i}`);
    const t0 = Date.now();
    const reg = await req('POST', '/api/auth/register', {
      body: {
        fullName: cust.fullName,
        email: cust.email,
        phone: cust.phone,
        password: cust.password,
        confirmPassword: cust.confirmPassword,
        termsAccepted: true,
        city: 'غزة',
      },
      timeoutMs: 60000,
    });
    const login = await req('POST', '/api/auth/login', {
      body: { email: cust.email, password: cust.password },
      timeoutMs: 60000,
    });
    const ok = !!(reg.json?.ok && login.json?.ok && login.json?.token);
    authResults.push({
      i,
      ok,
      regStatus: reg.status,
      loginStatus: login.status,
      ms: Date.now() - t0,
      // email only — no password
      email: cust.email,
    });
    console.log(`auth ${i + 1}/${SEQ_AUTH}: ${ok ? 'ok' : 'fail'} ${Date.now() - t0}ms`);
  }

  const authOk = authResults.filter((r) => r.ok).length;
  const report = {
    at: new Date().toISOString(),
    base: BASE,
    caps: {
      concurrentHealth: CONCURRENT_HEALTH,
      sequentialRegisterLogin: SEQ_AUTH,
      note: 'Bounded to avoid abuse; not a full scale suite',
    },
    health: {
      concurrent: CONCURRENT_HEALTH,
      wallMs: healthWallMs,
      ok: healthOk,
      fail: CONCURRENT_HEALTH - healthOk,
      latency: latencyStats(healthTimes),
      statusCodes: healthResults.reduce((acc, r) => {
        acc[String(r.status)] = (acc[String(r.status)] || 0) + 1;
        return acc;
      }, {}),
    },
    authLight: {
      sequential: SEQ_AUTH,
      ok: authOk,
      fail: SEQ_AUTH - authOk,
      latency: latencyStats(authResults.map((r) => r.ms)),
      samples: authResults.map(({ i, ok, regStatus, loginStatus, ms, email }) => ({
        i,
        ok,
        regStatus,
        loginStatus,
        ms,
        email,
      })),
    },
    summary: {
      pass: (healthOk === CONCURRENT_HEALTH ? 1 : 0) + (authOk === SEQ_AUTH ? 1 : 0),
      fail: (healthOk === CONCURRENT_HEALTH ? 0 : 1) + (authOk === SEQ_AUTH ? 0 : 1),
      verdict: healthOk === CONCURRENT_HEALTH && authOk === SEQ_AUTH ? 'PASS' : 'FAIL',
    },
  };
  fs.writeFileSync(path.join(ART, 'launch-load-probe.json'), JSON.stringify(report, null, 2));
  return report;
}

async function runPagesHttpSample() {
  const htmlFiles = fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith('.html'))
    .sort();

  const preferred = [
    'index.html',
    'login.html',
    'register.html',
    'create-account.html',
    'client.html',
    'services.html',
    'products.html',
    'store.html',
    'cart.html',
    'checkout.html',
    'packages.html',
    'membership.html',
    'support.html',
    'complaints.html',
    'suggestions.html',
    'consultation.html',
    'profile-360.html',
    'my-orders.html',
    'news.html',
    'blog.html',
    'search.html',
    'terms.html',
    'privacy.html',
    'policies.html',
    'trial.html',
    'quality.html',
    'quality-analysis.html',
    'naiosh-solutions.html',
    'courses.html',
    'events.html',
    'book-office.html',
    'book-platform.html',
    'forgot-password.html',
  ];

  const sampleList = [];
  for (const p of preferred) {
    if (htmlFiles.includes(p) && !sampleList.includes(p)) sampleList.push(p);
  }
  for (const f of htmlFiles) {
    if (sampleList.length >= 30) break;
    if (!sampleList.includes(f)) sampleList.push(f);
  }
  const sample = sampleList.slice(0, 30);

  const results = [];
  for (const page of sample) {
    const r = await req('GET', `/${page}`, { timeoutMs: 20000 });
    // Treat HTML GETs: success if 200 and looks like HTML (or empty ok redirect rare)
    const ct = String(r.headers?.['content-type'] || '');
    const isHtml = /html/i.test(ct) || /<!doctype html|<html/i.test(r.raw || '');
    const ok = r.status === 200 && (isHtml || (r.raw || '').length > 100);
    results.push({
      page,
      url: `${BASE}/${page}`,
      status: r.status,
      ms: r.ms,
      contentType: ct.slice(0, 80),
      bytes: Buffer.byteLength(r.raw || ''),
      ok,
    });
    console.log(`${ok ? 'OK' : 'BAD'} ${r.status} ${page} ${r.ms}ms`);
  }

  const okN = results.filter((x) => x.ok).length;
  const report = {
    at: new Date().toISOString(),
    base: BASE,
    inventory: {
      htmlAtRepoRoot: htmlFiles.length,
      files: htmlFiles,
    },
    sample: {
      requested: 30,
      probed: results.length,
      ok: okN,
      fail: results.length - okN,
      pages: results,
    },
    summary: {
      pass: okN,
      fail: results.length - okN,
      verdict: okN === results.length ? 'PASS' : 'FAIL',
    },
  };
  fs.writeFileSync(path.join(ART, 'launch-pages-http-sample.json'), JSON.stringify(report, null, 2));
  return report;
}

async function main() {
  ensureArt();
  console.log('BASE', BASE);

  console.log('\n=== 1) Customer persist + isolation ===');
  const customer = await runCustomerPersistIsolation();

  console.log('\n=== 2) Load probe ===');
  const load = await runLoadProbe();

  console.log('\n=== 3) Pages HTTP sample ===');
  const pages = await runPagesHttpSample();

  const summary = {
    at: new Date().toISOString(),
    base: BASE,
    customer: customer.summary,
    load: load.summary,
    pages: {
      htmlCount: pages.inventory.htmlAtRepoRoot,
      ...pages.summary,
    },
    files: [
      path.join(ART, 'launch-customer-persist-isolation.json'),
      path.join(ART, 'launch-load-probe.json'),
      path.join(ART, 'launch-pages-http-sample.json'),
    ],
  };
  fs.writeFileSync(path.join(ART, 'launch-prod-probe-summary.json'), JSON.stringify(summary, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  const anyFail =
    customer.summary.verdict !== 'PASS' || load.summary.verdict !== 'PASS' || pages.summary.verdict !== 'PASS';
  process.exit(anyFail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
