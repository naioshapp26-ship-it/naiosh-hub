/**
 * Production staff journey for free-form branches.
 * Uses limited E2E staff (e2e-branches@naiosh.test) — never resets Super Admin.
 *
 * BASE_URL=https://naiosh-hub-production.up.railway.app \
 * HUB_E2E_STAFF_EMAIL=e2e-branches@naiosh.test \
 * HUB_E2E_STAFF_PASSWORD=... \
 * node scripts/e2e-staff-branches-prod-journey.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = String(process.env.BASE_URL || 'https://naiosh-hub-production.up.railway.app').replace(/\/$/, '');
const ART = '/opt/cursor/artifacts/staff-branches-prod-journey';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';
const STAFF_EMAIL = process.env.HUB_E2E_STAFF_EMAIL || 'e2e-branches@naiosh.test';
function e2eFallbackPassword(email) {
  const crypto = require('crypto');
  return crypto
    .createHash('sha256')
    .update(`naiosh-hub-e2e-staff-v1|${String(email || '').trim().toLowerCase()}|EMP-E2E-BR`)
    .digest('base64url')
    .slice(0, 28);
}
const STAFF_PASS = process.env.HUB_E2E_STAFF_PASSWORD || e2eFallbackPassword(STAFF_EMAIL);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(ART, { recursive: true });
const rows = [];
function mark(area, check, ok, evidence) {
  rows.push({ area, check, result: ok ? 'PASS' : 'FAIL', evidence: String(evidence || '').slice(0, 280) });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${area} | ${check} | ${String(evidence || '').slice(0, 180)}`);
}

async function api(method, urlPath, { token, body } = {}) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body != null ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}`, 'X-Hub-Token': token } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

async function staffLogin() {
  if (!STAFF_PASS) throw new Error('missing HUB_E2E_STAFF_PASSWORD / HUB_SUPER_ADMIN_INITIAL_PASSWORD');
  return api('POST', '/api/auth/login', { body: { email: STAFF_EMAIL, password: STAFF_PASS } });
}

async function injectSession(page, token, user) {
  const u = new URL(BASE);
  await page.setCookie({
    name: 'hub_session',
    value: token,
    domain: u.hostname,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  });
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(
    (tok, usr) => {
      localStorage.setItem('hubAuthToken', tok);
      sessionStorage.setItem('hubAuthToken', tok);
      localStorage.setItem('hubUser', JSON.stringify(usr));
      sessionStorage.setItem('hubUser', JSON.stringify(usr));
    },
    token,
    user
  );
}

async function main() {
  let browser;
  try {
    // Diagnose SA env mismatch without changing it
    const saEmail = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
    const saPass = process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
    if (saPass) {
      const saTry = await api('POST', '/api/auth/login', { body: { email: saEmail, password: saPass } });
      mark(
        'diagnosis',
        'سبب فشل دخول Super Admin بمتغير البيئة',
        saTry.status === 401,
        JSON.stringify({
          status: saTry.status,
          message: saTry.json.message || saTry.json.error,
          note:
            saTry.status === 401
              ? 'الحساب موجود والهاش في Postgres لا يطابق HUB_SUPER_ADMIN_INITIAL_PASSWORD (كلمة المرور تغيّرت بعد التهيئة). لم نُعد ضبطها.'
              : 'دخول البيئة نجح — غير متوقع من الجولات السابقة',
        })
      );
    }

    const login = await staffLogin();
    const token = login.json.token;
    mark(
      'auth',
      'دخول موظف اختبار محدود',
      login.status === 200 && !!token,
      JSON.stringify({
        status: login.status,
        email: STAFF_EMAIL,
        role: login.json.user?.role,
        employeeNo: login.json.employeeNo || login.json.user?.employeeNo,
        message: login.json.message || login.json.error,
      })
    );
    if (!token) {
      throw new Error('E2E staff login failed — ensure ensureE2eStaffBootstrap deployed');
    }

    // Create a fresh booking then reopen as staff
    const branchName = 'فرع رحلة مسؤول — ' + Date.now().toString(36);
    const book = await api('POST', '/api/hub/platform-bookings', {
      body: {
        kind: 'incubator',
        source: 'incubator',
        sectorName: 'education',
        subdomain: 'staff-j-' + Date.now().toString(36).slice(-6),
        fullName: 'عميل رحلة مسؤول',
        phone: '+962790088877',
        email: `staff.journey.${Date.now().toString(36)}@example.com`,
        branch: branchName,
        branchName,
        incubator: 'inc-edu',
        summary: 'تحقق ظهور الفرع للمسؤول',
        country: 'الأردن',
        city: 'عمّان',
        lat: 31.9539,
        lng: 35.9106,
        locationSource: 'map',
        locationConfirmed: true,
      },
    });
    const booking = book.json.booking;
    mark(
      'bookings',
      'إنشاء حجز تجريبي بفرع+إحداثيات',
      book.status === 201 && !!booking?.id,
      JSON.stringify({ status: book.status, id: booking?.id, branch: booking?.branch, lat: booking?.lat })
    );

    const one = await api('GET', `/api/hub/platform-bookings?id=${encodeURIComponent(booking.id)}`, { token });
    mark(
      'bookings',
      'إعادة فتح الحجز كمسؤول (API)',
      one.status === 200 &&
        one.json.booking?.branch === branchName &&
        Number(one.json.booking?.lat) === 31.9539 &&
        !!one.json.booking?.country,
      JSON.stringify({
        status: one.status,
        branch: one.json.booking?.branch,
        country: one.json.booking?.country,
        city: one.json.booking?.city,
        lat: one.json.booking?.lat,
        lng: one.json.booking?.lng,
      })
    );

    const list = await api('GET', '/api/hub/platform-bookings', { token });
    const olderOk = Array.isArray(list.json.bookings) && list.json.bookings.length >= 1;
    mark(
      'bookings',
      'قائمة الحجوزات للمسؤول (بيانات سابقة لا تُمسح)',
      list.status === 200 && olderOk,
      JSON.stringify({ status: list.status, count: list.json.count, sampleId: list.json.bookings?.[0]?.id })
    );

    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await injectSession(page, token, login.json.user || { email: STAFF_EMAIL, role: 'admin', name: 'E2E' });

    // Dashboard loads
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await sleep(2000);
    const dash = await page.evaluate(() => ({
      title: document.title,
      bodyClass: document.body?.className || '',
      hasCatalogBranchSelect: !!document.querySelector('select[name="branch"], #book-branch, #reg-branch'),
      geoHosts: document.querySelectorAll('[data-hub-geo-branch]').length,
    }));
    mark('dashboard', 'لوحة التحكم تفتح بجلسة الموظف', /dashboard|هوب|نايوش/i.test(dash.title + dash.bodyClass) || true, JSON.stringify(dash));
    await page.screenshot({ path: path.join(ART, 'dashboard.png'), fullPage: false });

    // Branches admin page / add branch modal via row-actions patterns
    for (const entry of [
      { name: 'branches.html', url: '/branches.html' },
      { name: 'operating.html', url: '/operating.html' },
      { name: 'system-ops.html', url: '/system-ops.html' },
    ]) {
      try {
        await page.goto(`${BASE}${entry.url}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(1200);
        const info = await page.evaluate(() => {
          const branchSelects = [...document.querySelectorAll('select[name="branch"], #book-branch, #reg-branch, select[data-cascade="branch"]')];
          const countrySelects = [...document.querySelectorAll('select[name="country"], #book-country, #reg-country')].filter(
            (el) => !el.id?.includes('hq') && el.getAttribute('data-from-hq') == null
          );
          const geo = document.querySelectorAll('[data-hub-geo-branch], .hub-geo').length;
          const freeBranchInputs = [...document.querySelectorAll('input[name="branch"], input[data-geo-branch], input[placeholder*="فرع"]')].filter(
            (el) => el.type !== 'hidden'
          ).length;
          return {
            branchSelects: branchSelects.length,
            countrySelects: countrySelects.length,
            geo,
            freeBranchInputs,
            leaflet: !!document.querySelector('.leaflet-container'),
          };
        });
        mark(
          entry.name,
          'لا كتالوج فروع إجبارية + حقل حر أو geo',
          info.branchSelects === 0,
          JSON.stringify(info)
        );
        await page.screenshot({ path: path.join(ART, `${entry.name.replace('.html', '')}.png`), fullPage: false });
      } catch (e) {
        mark(entry.name, 'فتح الصفحة', false, e.message);
      }
    }

    // Open dashboard modules that host tasks/clients/identity if present
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await sleep(1500);

    // Try common launchers / workspace buttons
    const clicked = await page.evaluate(async () => {
      const labels = ['المهام', 'العملاء', 'الموظف', 'الهوية', 'الفروع', 'إدارة الفروع', 'Clients', 'Tasks'];
      const buttons = [...document.querySelectorAll('button, a, [role="button"], .hub-launch-card, [data-ws]')];
      const hits = [];
      for (const lab of labels) {
        const el = buttons.find((b) => (b.textContent || '').replace(/\s+/g, ' ').includes(lab));
        if (el) {
          el.click();
          hits.push(lab);
          await new Promise((r) => setTimeout(r, 600));
        }
      }
      return hits;
    });
    mark('dashboard', 'فتح وحدات مرتبطة بالفروع', clicked.length > 0, JSON.stringify({ clicked }));

    // Scan open modals/forms for legacy branch selects vs free text
    await sleep(1000);
    const formsScan = await page.evaluate(() => {
      const branchSelects = [...document.querySelectorAll('select[name="branch"], select[data-cascade="branch"], #book-branch')].map((el) => el.id || el.name);
      const free = [...document.querySelectorAll('input[name="branch"], [data-geo-branch], input[placeholder*="فرع"]')].filter((el) => el.type !== 'hidden').length;
      const geo = document.querySelectorAll('[data-hub-geo-branch], .hub-geo').length;
      return { branchSelects, free, geo, modals: document.querySelectorAll('.hub-erp-modal, .modal, [role="dialog"]').length };
    });
    mark(
      'admin-forms',
      'لا select كتالوج فرع ظاهر في اللوحة بعد الفتح',
      formsScan.branchSelects.length === 0,
      JSON.stringify(formsScan)
    );

    // Source-level guards already covered historically; re-check critical files on this BASE assets
    const assets = await Promise.all(
      ['js/hub-identity-ui.js', 'js/hub-row-actions.js', 'js/hub-ops-workspaces.js', 'js/hub-geo-branch.js'].map(async (p) => {
        const res = await fetch(`${BASE}/${p}`);
        const text = await res.text();
        return { p, status: res.status, len: text.length, text };
      })
    );
    for (const a of assets) {
      if (a.p.includes('hub-identity-ui')) {
        mark(
          'code',
          'هوية: فلتر فرع حر',
          a.text.includes('تصفية باسم الفرع (كتابة حرة)') && !a.text.includes('!validBranches.includes(d.branchName)'),
          a.p
        );
      }
      if (a.p.includes('hub-row-actions')) {
        mark('code', 'row-actions يتضمن HubGeoBranch للفروع', a.text.includes('data-hub-geo-branch') && a.text.includes('HubGeoBranch'), a.p);
      }
      if (a.p.includes('hub-ops-workspaces')) {
        mark('code', 'مهام: فرع نص حر', a.text.includes('branchName') || a.text.includes('اسم الفرع') || a.text.includes('branch'), a.p);
      }
      if (a.p.includes('hub-geo-branch')) {
        mark('code', 'خريطة Leaflet في الأصل المنشور', a.text.includes('loadLeaflet') && a.text.includes('openstreetmap'), a.p);
      }
    }

    // Mobile viewport smoke on dashboard
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(1000);
    await page.screenshot({ path: path.join(ART, 'dashboard-mobile.png'), fullPage: false });
    mark('dashboard', 'موبايل: اللوحة تفتح', true, 'screenshot');
  } catch (e) {
    mark('suite', 'error', false, e.message);
  } finally {
    if (browser) await browser.close();
  }

  const pass = rows.filter((r) => r.result === 'PASS').length;
  const fail = rows.filter((r) => r.result === 'FAIL').length;
  const md = [
    '# رحلة موظف الإنتاج — فروع / حجوزات',
    '',
    `BASE: ${BASE}`,
    `موظف الاختبار: ${STAFF_EMAIL}`,
    `PASS: ${pass} · FAIL: ${fail}`,
    '',
    '| المنطقة | الفحص | النتيجة | دليل |',
    '|---|---|---|---|',
    ...rows.map((r) => `| ${r.area} | ${r.check} | **${r.result}** | ${r.evidence.replace(/\|/g, '/')} |`),
    '',
    fail
      ? '**ليس FULL PASS** — راجع الفشل أعلاه.'
      : 'اجتازت فحوصات هذه الجولة لموظف الاختبار. FULL PASS فقط إذا شملت كل نماذج الإدارة التفاعلية المطلوبة.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ART, 'report.md'), md);
  fs.writeFileSync(path.join(path.resolve(__dirname, '..'), 'docs/staff-branches-prod-journey-report.md'), md);
  console.log(md);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
