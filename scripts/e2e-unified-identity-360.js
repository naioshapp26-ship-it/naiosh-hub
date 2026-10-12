/**
 * E2E: unified 360 identity — client org affiliation persist + reopen.
 *
 *   HUB_E2E_BASE=http://127.0.0.1:8899 node scripts/e2e-unified-identity-360.js
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { withClient, getDatabaseUrl } = require('../db/migrate');

const BASE = String(process.env.HUB_E2E_BASE || process.env.BASE_URL || 'http://127.0.0.1:8899').replace(/\/$/, '');
const ART = path.join('/opt/cursor/artifacts', `id360-${Date.now()}`);
const STAFF_EMAIL = process.env.HUB_E2E_STAFF_EMAIL || 'e2e-branches@naiosh.test';
const STAFF_PASS =
  process.env.HUB_E2E_STAFF_PASSWORD ||
  crypto.createHash('sha256').update(`naiosh-hub-e2e-staff-v1|${STAFF_EMAIL}|EMP-E2E-BR`).digest('base64url').slice(0, 28);

fs.mkdirSync(ART, { recursive: true });

const results = [];
const mark = (area, name, ok, detail = '') => {
  results.push({ area, name, ok: !!ok, detail: String(detail || '').slice(0, 400) });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${area} | ${name}${detail ? ` — ${detail}` : ''}`);
};

async function api(method, urlPath, { token, body, headers, timeoutMs = 60000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${urlPath}`, {
      method,
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}`, 'X-Hub-Token': token } : {}),
        ...(headers || {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text.slice(0, 200) };
    }
    return { status: res.status, json, ok: res.ok };
  } catch (err) {
    return {
      status: 0,
      json: {},
      ok: false,
      error: err.name === 'AbortError' ? `timeout ${timeoutMs}ms` : err.message,
    };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  console.log(`BASE=${BASE}`);
  console.log(`ART=${ART}`);

  // Static assets
  for (const p of [
    '/js/hub-identity-unified-form.js',
    '/css/hub-identity-unified-form.css',
    '/dashboard.html',
    '/register.html',
  ]) {
    const r = await fetch(`${BASE}${p}`);
    mark('assets', p, r.ok, `status=${r.status}`);
  }

  // Prefer on-disk dashboard (server may serve auth gate HTML for unauthenticated GETs).
  const dashDisk = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
  mark('assets', 'dashboard includes unified form script', /hub-identity-unified-form\.js/.test(dashDisk));
  mark('assets', 'dashboard includes unified form css', /hub-identity-unified-form\.css/.test(dashDisk));

  // Catalog (no invented options when empty — here we expect real rows)
  const inc = await api('GET', '/api/hub/catalog/incubators');
  const plat = await api('GET', '/api/hub/catalog/platforms');
  mark('catalog', 'incubators API', inc.json.ok && (inc.json.count || 0) > 0, `count=${inc.json.count}`);
  mark('catalog', 'platforms API', plat.json.ok && (plat.json.count || 0) > 0, `count=${plat.json.count}`);
  const incubator = (inc.json.incubators || [])[0];
  const platform = (plat.json.platforms || [])[0];
  if (!incubator || !platform) {
    mark('catalog', 'usable catalog rows', false, 'cannot continue client create');
    throw new Error('catalog empty');
  }

  // Staff login
  const login = await api('POST', '/api/auth/login', {
    body: { email: STAFF_EMAIL, password: STAFF_PASS, lane: 'staff' },
  });
  const token = login.json.token || login.json.accessToken || '';
  mark('auth', 'staff login', !!(login.ok && token), `status=${login.status} email=${STAFF_EMAIL}`);
  if (!token) throw new Error('staff login failed');

  // Validation: missing affiliation rejected
  const stamp = Date.now().toString(36);
  const email = `id360.client.${stamp}@naiosh.test`;
  const phoneDigits = `0599${String(Date.now()).slice(-7)}`;
  const bad = await api('POST', '/api/admin/clients', {
    token,
    body: { name: 'عميل بدون ارتباط', email, phone: phoneDigits, status: 'pending' },
  });
  mark(
    'validation',
    'reject client without incubator/platform/branch',
    bad.status === 400 && /حاضنة|منصة|فرع/i.test(String(bad.json.error || '')),
    `status=${bad.status} err=${bad.json.error || ''}`
  );

  // Create client with full affiliation
  const branchName = `فرع اختبار 360 — عمّان ${stamp}`;
  const created = await api('POST', '/api/admin/clients', {
    token,
    headers: { 'X-Idempotency-Key': `id360-${stamp}` },
    body: {
      name: `عميل هوية 360 ${stamp}`,
      email,
      phone: phoneDigits,
      country: 'الأردن',
      city: 'عمّان',
      address: 'شارع التجربة',
      status: 'pending',
      clientType: 'فرد',
      company: 'شركة اختبار 360',
      incubatorId: incubator.id,
      platformCode: platform.code,
      branch: branchName,
      branchName,
      lat: 31.9539,
      lng: 35.9106,
      locationSource: 'manual',
      locationConfirmed: true,
      source: 'E2E هوية 360',
    },
  });
  mark(
    'create',
    'create client with org affiliation',
    created.status === 201 && created.json.ok,
    `status=${created.status} err=${created.json.error || ''} clientId=${created.json.client?.clientId || ''}`
  );
  const client = created.json.client || {};
  mark('create', 'response has incubator', !!client.incubatorId || !!client.incubatorName, client.incubatorName || client.incubatorId);
  mark('create', 'response has platform', !!client.platformCode, client.platformCode);
  mark('create', 'response has branch', (client.branchName || client.branch) === branchName, client.branchName || client.branch);

  // Reopen via list API
  const list = await api('GET', '/api/admin/clients', { token });
  const row = (list.json.clients || []).find((c) => String(c.email || '').toLowerCase() === email);
  mark('reopen', 'client appears in admin list', !!row, row?.clientId || '');
  mark('reopen', 'list incubator', !!(row && (row.incubatorId || row.incubatorName)), row?.incubatorName || row?.incubatorId || '');
  mark('reopen', 'list platform', !!(row && row.platformCode), row?.platformCode || '');
  mark('reopen', 'list branch', !!(row && (row.branchName || row.branch) === branchName), row?.branchName || row?.branch || '');

  // Reopen via GET one
  const one = await api('GET', `/api/admin/clients/${encodeURIComponent(email)}`, { token });
  mark('reopen', 'GET one client', one.json.ok && one.json.client?.email === email, `status=${one.status}`);
  mark(
    'reopen',
    'GET one affiliation',
    one.json.client?.platformCode === platform.code && (one.json.client?.branchName || one.json.client?.branch) === branchName,
    JSON.stringify({
      incubator: one.json.client?.incubatorName || one.json.client?.incubatorId,
      platform: one.json.client?.platformCode,
      branch: one.json.client?.branchName || one.json.client?.branch,
    })
  );

  // Postgres extras proof
  let pgAff = null;
  if (getDatabaseUrl()) {
    pgAff = await withClient(async (c) => {
      const r = await c.query(
        `SELECT extras->'orgAffiliation' AS aff FROM hub_client_accounts WHERE LOWER(email)=LOWER($1) LIMIT 1`,
        [email]
      );
      return r.rows[0]?.aff || null;
    });
    mark('postgres', 'extras.orgAffiliation present', !!pgAff, JSON.stringify(pgAff || {}));
    mark(
      'postgres',
      'pg branch matches',
      !!(pgAff && (pgAff.branchName || pgAff.branch) === branchName),
      pgAff?.branchName || pgAff?.branch || ''
    );
    mark(
      'postgres',
      'pg platform matches',
      !!(pgAff && pgAff.platformCode === platform.code),
      pgAff?.platformCode || ''
    );
  } else {
    mark('postgres', 'DATABASE_URL', false, 'not set — skipped');
  }

  // Profile 360 compose (admin) — by-email (may be slow on large DBs)
  let p360;
  try {
    p360 = await api('GET', `/api/hub/profiles/by-email/${encodeURIComponent(email)}`, {
      token,
      timeoutMs: 45000,
    });
  } catch (err) {
    p360 = { status: 0, json: {}, ok: false, error: err.message };
  }
  const basics2 =
    p360.json?.sections?.client?.basics ||
    p360.json?.profile?.sections?.client?.basics ||
    p360.json?.view?.sections?.client?.basics ||
    null;
  mark(
    'profile360',
    'compose reachable',
    p360.status > 0 && p360.status < 400 && p360.json.ok !== false,
    p360.error || `status=${p360.status} keys=${Object.keys(p360.json || {}).slice(0, 10).join(',')}`
  );
  if (basics2) {
    mark(
      'profile360',
      'affiliation in basics',
      !!(basics2.incubatorId || basics2.incubatorName) &&
        !!(basics2.platformCode || basics2.platformName) &&
        !!(basics2.branchName || basics2.branch),
      JSON.stringify({
        incubator: basics2.incubatorName || basics2.incubatorId,
        platform: basics2.platformName || basics2.platformCode,
        branch: basics2.branchName || basics2.branch,
      })
    );
  } else {
    mark(
      'profile360',
      'affiliation in basics',
      false,
      p360.error || 'basics missing / timeout — NOT TESTED on this run'
    );
  }

  // Staff create (employee) — requires staff-admin permission; use SA when e2e staff lacks it.
  let staffToken = token;
  const saEmail = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
  const saPass = process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || process.env.HUB_PROD_SA_PASSWORD || '';
  if (saPass) {
    const saLogin = await api('POST', '/api/auth/login', {
      body: { email: saEmail, password: saPass, lane: 'staff' },
    });
    if (saLogin.json.token || saLogin.json.accessToken) {
      staffToken = saLogin.json.token || saLogin.json.accessToken;
      mark('staff', 'SA login for staff.create', true, saEmail);
    } else {
      mark('staff', 'SA login for staff.create', false, saLogin.json.error || String(saLogin.status));
    }
  } else {
    mark('staff', 'SA login for staff.create', false, 'no SA password in env — may 403');
  }
  const empEmail = `id360.emp.${stamp}@naiosh.test`;
  const empPass = `Emp@${stamp}9A`;
  const empPhone = `0598${String(Date.now()).slice(-7)}`;
  const emp = await api('POST', '/api/admin/staff', {
    token: staffToken,
    body: {
      name: `موظف هوية 360 ${stamp}`,
      email: empEmail,
      phone: empPhone,
      affiliationKind: 'naiosh',
      orgName: 'نايوش',
      department: 'عمليات',
      role: 'admin',
      temporaryPassword: empPass,
      permissions: [],
    },
  });
  mark(
    'staff',
    'create employee via staff API',
    emp.ok && emp.json.ok !== false && (emp.json.staff?.employeeNo || emp.json.employeeNo),
    `status=${emp.status} emp=${emp.json.staff?.employeeNo || emp.json.error || ''}`
  );
  mark(
    'staff',
    'employee has no automatic elevated perms from empty grant',
    Array.isArray(emp.json.staff?.permissions) ? emp.json.staff.permissions.length === 0 : true,
    JSON.stringify(emp.json.staff?.permissions || null)
  );

  // Dual role: same email already client — try alsoCustomer path is AG; here we assert client email still unique (no second client)
  const dup = await api('POST', '/api/admin/clients', {
    token,
    body: {
      name: 'مكرر',
      email,
      phone: '0599000000',
      incubatorId: incubator.id,
      platformCode: platform.code,
      branchName: 'فرع مكرر',
    },
  });
  mark(
    'dual',
    'reject duplicate client email identity',
    dup.status >= 400,
    `status=${dup.status} err=${dup.json.error || ''}`
  );

  // Source checks: no invented register fallbacks
  const regJs = await (await fetch(`${BASE}/js/hub-register.js`)).text();
  mark('register', 'no hard-coded incubator fallbacks', !regJs.includes("id: 'inc-edu'"));
  mark('register', 'uses catalog API', regJs.includes('/api/hub/catalog/incubators'));

  const formJs = await (await fetch(`${BASE}/js/hub-identity-unified-form.js`)).text();
  mark('form', 'validates incubator required', formJs.includes('اختيار الحاضنة إلزامي'));
  mark('form', 'validates platform required', formJs.includes('اختيار المنصة إلزامي'));
  mark('form', 'uses HubGeoBranch', formJs.includes('HubGeoBranch'));

  const clientsJs = await (await fetch(`${BASE}/js/hub-clients-workspaces.js`)).text();
  mark('clients-ui', 'mounts HubIdentityUnifiedForm', clientsJs.includes('HubIdentityUnifiedForm'));
  mark('clients-ui', 'title هوية 360', clientsJs.includes('هوية 360'));

  const staffJs = await (await fetch(`${BASE}/js/hub-staff-admin.js`)).text();
  mark('staff-ui', 'mounts HubIdentityUnifiedForm', staffJs.includes('HubIdentityUnifiedForm'));

  const idnJs = await (await fetch(`${BASE}/js/hub-identity-ui.js`)).text();
  mark('identity-ui', 'mounts HubIdentityUnifiedForm', idnJs.includes('HubIdentityUnifiedForm'));

  // Browser smoke via puppeteer-core + system Chrome
  let browserOk = false;
  try {
    const puppeteer = require('puppeteer-core');
    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      (fs.existsSync('/usr/local/bin/google-chrome')
        ? '/usr/local/bin/google-chrome'
        : fs.existsSync('/usr/bin/google-chrome')
          ? '/usr/bin/google-chrome'
          : '/usr/bin/chromium');
    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(
      (t, user) => {
        localStorage.setItem('hubAuthToken', t);
        sessionStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hub_token', t);
        localStorage.setItem('hubUser', JSON.stringify(user));
      },
      token,
      login.json.user || { email: STAFF_EMAIL, role: 'admin', name: 'E2E' }
    );
    await page.goto(`${BASE}/dashboard.html#clients`, { waitUntil: 'networkidle2', timeout: 90000 }).catch(() => {});
    await page.waitForFunction(() => !!window.HubIdentityUnifiedForm, { timeout: 20000 }).catch(() => {});
    const hasForm = await page.evaluate(() => !!window.HubIdentityUnifiedForm?.mount);
    mark('browser', 'HubIdentityUnifiedForm loaded on dashboard', hasForm);
    // Open create modal if button present
    const opened = await page.evaluate(async () => {
      const btn = document.querySelector('[data-action="cl-create"]');
      if (!btn) return { clicked: false };
      btn.click();
      await new Promise((r) => setTimeout(r, 800));
      const host = document.getElementById('cl-id360-host');
      return {
        clicked: true,
        host: !!host,
        hasIncubator: !!host?.querySelector('[data-id360="incubatorId"]'),
        hasPlatform: !!host?.querySelector('[data-id360="platformCode"]'),
        hasGeo: !!host?.querySelector('[data-id360-geo], [data-hub-geo-branch]'),
        title: document.querySelector('.hub-modal h3, .modal-title, [class*="modal"] h3')?.textContent || '',
      };
    });
    mark('browser', 'open add-client modal', opened.clicked, JSON.stringify(opened));
    if (opened.clicked) {
      mark('browser', 'modal has incubator select', opened.hasIncubator);
      mark('browser', 'modal has platform select', opened.hasPlatform);
      mark('browser', 'modal has geo branch', opened.hasGeo);
      mark('browser', 'modal title unified', /هوية 360|إنسان/.test(opened.title || ''), opened.title);
      await page.screenshot({ path: path.join(ART, 'clients-add-modal.png'), fullPage: false });
    }
    // Dark mode smoke
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await page.screenshot({ path: path.join(ART, 'clients-add-modal-dark.png'), fullPage: false });
    mark('browser', 'dark mode screenshot', fs.existsSync(path.join(ART, 'clients-add-modal-dark.png')));
    // Mobile
    await page.setViewport({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(ART, 'clients-add-modal-mobile.png'), fullPage: false });
    mark('browser', 'mobile screenshot', fs.existsSync(path.join(ART, 'clients-add-modal-mobile.png')));
    await browser.close();
    browserOk = true;
  } catch (err) {
    mark('browser', 'puppeteer smoke', false, err.message);
  }

  const pass = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  const report = {
    base: BASE,
    at: new Date().toISOString(),
    staff: STAFF_EMAIL,
    clientEmail: email,
    branchName,
    incubator: { id: incubator.id, name: incubator.name_ar },
    platform: { code: platform.code, name: platform.name_ar },
    postgresAffiliation: pgAff,
    browserOk,
    pass,
    fail,
    results,
    verdict: fail === 0 ? 'PASS' : 'PARTIAL — see FAIL rows; do not claim FULL PASS for production until deployed',
  };
  fs.writeFileSync(path.join(ART, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(`PASS ${pass} / FAIL ${fail}`);
  console.log(`Report: ${path.join(ART, 'report.json')}`);
  console.log(`Verdict: ${report.verdict}`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
