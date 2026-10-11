/**
 * E2E: new customer register → login must succeed (durable auth).
 * Also simulates ephemeral disk wipe when DATABASE_URL is available locally.
 *
 * Usage:
 *   BASE=https://naiosh-hub-production.up.railway.app node scripts/e2e-customer-login-after-register.js
 *   node scripts/e2e-customer-login-after-register.js   # local server on PORT
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const STORE = path.join(ROOT, 'data', 'customer-accounts.json');
const BASE = String(process.env.BASE || '').replace(/\/$/, '');
const PORT = Number(process.env.PORT || 8791);
const ART = path.join('/opt/cursor/artifacts', 'customer-login-after-register');

function stamp() {
  return Date.now().toString(36);
}

function ensureArt() {
  fs.mkdirSync(ART, { recursive: true });
}

async function json(base, method, urlPath, body) {
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, j };
}

function requestLocal(port, method, urlPath, body) {
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
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
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
            j = { raw };
          }
          resolve({ status: res.statusCode, j });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function waitForServer(port, ms = 15000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await requestLocal(port, 'GET', '/api/health');
      if (res.status) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not boot on ${port}`);
}

async function runApiJourney(call) {
  const id = stamp();
  const email = `loginfix.${id}@naiosh-test.com`;
  const password = 'TestPass1234';
  const phone = `059${String(Date.now()).slice(-8)}`;
  const reg = await call('POST', '/api/auth/register', {
    fullName: 'عميل اختبار دخول',
    email,
    phone,
    password,
    confirmPassword: password,
    termsAccepted: true,
  });
  const login = await call('POST', '/api/auth/login', { email, password });
  return { email, password, phone, reg, login };
}

async function runUiJourney(base) {
  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch {
    try {
      puppeteer = require('puppeteer');
    } catch {
      return { skipped: true, reason: 'puppeteer_missing' };
    }
  }
  ensureArt();
  const id = stamp();
  const email = `uilogin.${id}@naiosh-test.com`;
  const password = 'TestPass1234';
  const phone = `058${String(Date.now()).slice(-8)}`;
  const chrome =
    process.env.CHROME_PATH ||
    (fs.existsSync('/usr/bin/google-chrome')
      ? '/usr/bin/google-chrome'
      : fs.existsSync('/usr/local/bin/google-chrome')
        ? '/usr/local/bin/google-chrome'
        : '');
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: chrome || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const shots = [];
  try {
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${base}/create-account.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.type('#fullName', 'عميل واجهة دخول');
    await page.type('#email', email);
    await page.type('#phone', phone);
    await page.type('#password', password);
    await page.type('#confirmPassword', password);
    const terms = await page.$('#termsAccepted, #terms, input[name="termsAccepted"]');
    if (terms) await terms.click();
    else {
      await page.evaluate(() => {
        const el =
          document.querySelector('#termsAccepted') ||
          document.querySelector('input[type="checkbox"][name*="term"]');
        if (el && !el.checked) el.click();
      });
    }
    await page.click('#createAccountBtn, button[type="submit"]');
    await page.waitForFunction(
      () => {
        const ok = document.querySelector('#successPanel:not(.hidden), .success-panel:not(.hidden)');
        const alert = document.querySelector('#alertMessage');
        return !!(ok || (alert && !alert.classList.contains('hidden')));
      },
      { timeout: 30000 }
    );
    const regShot = path.join(ART, `ui-register-${id}.png`);
    await page.screenshot({ path: regShot, fullPage: true });
    shots.push(regShot);

    await page.goto(`${base}/login.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.type('#email', email);
    await page.type('#password', password);
    await page.click('#loginBtn, button[type="submit"]');
    await page.waitForFunction(
      () =>
        location.pathname.includes('client') ||
        !!(document.querySelector('#alertMessage') && !document.querySelector('#alertMessage').classList.contains('hidden')),
      { timeout: 30000 }
    );
    const loginShot = path.join(ART, `ui-login-${id}.png`);
    await page.screenshot({ path: loginShot, fullPage: true });
    shots.push(loginShot);
    const url = page.url();
    const alertText = await page.evaluate(() => {
      const el = document.querySelector('#alertMessage');
      return el && !el.classList.contains('hidden') ? el.textContent.trim() : '';
    });
    const ok = /client\.html/i.test(url) && !/غير صحيحة/.test(alertText);
    return { ok, email, url, alertText, shots };
  } finally {
    await browser.close().catch(() => {});
  }
}

async function runLocalWipeRecovery() {
  const { getDatabaseUrl } = require('../db/migrate');
  if (!getDatabaseUrl()) {
    return { skipped: true, reason: 'no_database_url' };
  }

  // Fresh module state
  delete require.cache[require.resolve('../lib/hub-customer-auth')];
  const customerAuth = require('../lib/hub-customer-auth');
  await customerAuth.hydrateFromDb();

  const id = stamp();
  const email = `wipe.${id}@naiosh-test.com`;
  const password = 'TestPass1234';
  const phone = `057${String(Date.now()).slice(-8)}`;
  const reg = await customerAuth.register({
    fullName: 'Wipe Recovery',
    email,
    phone,
    password,
    confirmPassword: password,
    termsAccepted: true,
  });
  if (!reg.ok) return { ok: false, step: 'register', reg };

  // Simulate Railway ephemeral wipe + cold process
  fs.writeFileSync(
    STORE,
    JSON.stringify({ version: 1, accounts: [], updatedAt: new Date().toISOString() }, null, 2)
  );
  delete require.cache[require.resolve('../lib/hub-customer-auth')];
  const customerAuth2 = require('../lib/hub-customer-auth');
  const login = await customerAuth2.login({ email, password });
  return {
    ok: !!(login.ok && login.token),
    email,
    loginStatus: login.status,
    loginError: login.error || null,
  };
}

async function main() {
  ensureArt();
  const report = {
    at: new Date().toISOString(),
    base: BASE || `http://127.0.0.1:${PORT}`,
    checks: {},
    verdict: 'FAIL',
  };

  let child = null;
  let call;
  let base = BASE;

  try {
    if (!BASE) {
      child = spawn(process.execPath, ['server.js'], {
        cwd: ROOT,
        env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let bootLog = '';
      child.stdout.on('data', (d) => {
        bootLog += d.toString();
      });
      child.stderr.on('data', (d) => {
        bootLog += d.toString();
      });
      await waitForServer(PORT);
      base = `http://127.0.0.1:${PORT}`;
      call = (method, p, body) => requestLocal(PORT, method, p, body);
      report.bootLogTail = bootLog.slice(-800);
    } else {
      call = (method, p, body) => json(BASE, method, p, body);
    }

    const api = await runApiJourney(call);
    report.checks.apiRegisterLogin = {
      ok: !!(api.reg.j?.ok && api.login.j?.ok && api.login.j?.token),
      email: api.email,
      regStatus: api.reg.status,
      loginStatus: api.login.status,
      loginError: api.login.j?.error || null,
    };

    const wipe = await runLocalWipeRecovery();
    report.checks.wipeRecovery = wipe;

    if (BASE || process.env.RUN_UI === '1') {
      const ui = await runUiJourney(base);
      report.checks.uiRegisterLogin = ui;
    } else {
      report.checks.uiRegisterLogin = { skipped: true, reason: 'set BASE or RUN_UI=1' };
    }

    const required = [report.checks.apiRegisterLogin];
    if (!wipe.skipped) required.push(wipe);
    if (report.checks.uiRegisterLogin && !report.checks.uiRegisterLogin.skipped) {
      required.push(report.checks.uiRegisterLogin);
    }
    report.verdict = required.every((c) => c.ok) ? 'PASS' : 'FAIL';
  } catch (err) {
    report.error = err.message || String(err);
    report.verdict = 'FAIL';
  } finally {
    if (child) {
      child.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 300));
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
    }
  }

  const out = path.join(ART, 'report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`REPORT ${report.verdict} → ${out}`);
  process.exit(report.verdict === 'PASS' ? 0 : 1);
}

main();
