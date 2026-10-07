/**
 * Problem #7 — invalid email format message on book-platform.html?from=hq
 * Run: node scripts/e2e-book-platform-email-validation.js
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });

const out = { results: {}, remaining: [], invalidTried: [], validTried: [], requestId: '' };

function mark(name, pass, detail = '') {
  out.results[name] = pass ? 'PASS' : 'FAIL';
  if (!pass) out.remaining.push(`${name}: ${detail}`);
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
}

function api(method, pathname, body, { token, role } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body != null ? JSON.stringify(body) : null;
    const headers = { Accept: 'application/json' };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    if (role) headers['X-Hub-User-Role'] = role;
    const req = http.request(
      { hostname: '127.0.0.1', port: 8080, path: pathname, method, headers },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          let data = {};
          try {
            data = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          } catch {
            data = {};
          }
          resolve({ status: res.statusCode, data });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function go(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await new Promise((r) => setTimeout(r, 350));
}

async function ensureCustomerSession(page, email = 'client@naiosh.com') {
  await page.evaluate((em) => {
    const token = `hub360.${btoa(em)}.${Date.now()}`;
    localStorage.setItem('hubAuthToken', token);
    localStorage.setItem('hubUser', JSON.stringify({ email: em, role: 'customer', name: 'عميل بريد' }));
  }, email);
}

async function clearAuthIfAny(page) {
  await page.evaluate(() => {
    localStorage.removeItem('hubAuthToken');
    localStorage.removeItem('hubUser');
    sessionStorage.removeItem('hubAuthToken');
    sessionStorage.removeItem('hubUser');
  });
}

async function fillBase(page, { email, subdomain }) {
  await page.evaluate(() => {
    const form = document.querySelector('[data-book-form]');
    form?.querySelectorAll('input, select, textarea').forEach((el) => {
      if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file' || el.type === 'hidden') return;
      el.value = '';
    });
  });
  await page.type('#book-platform-name', 'منصة بريد');
  await page.select('#book-sector', await page.$eval('#book-sector option:nth-child(2)', (el) => el.value));
  await page.type('#book-subdomain', subdomain);
  await page.type('#book-name', 'زائر بريد');
  await page.type('#book-phone', '0559876543');
  if (email != null) {
    await page.click('#book-email', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    if (email !== '') await page.type('#book-email', email);
  }
  const country = await page.$$eval('#book-country option', (opts) => opts[1]?.value || '');
  await page.select('#book-country', country);
  await page.evaluate(() => {
    document.querySelector('[data-ops-mode][value="by_need"]')?.click();
    document.querySelector('[data-ops-toggle]')?.click();
    const full = document.querySelector('[data-ops-full]');
    if (full && !full.checked) full.click();
  });
  await page.type('#book-summary', 'شرح مختصر لاختبار البريد');
}

async function submit(page) {
  await page.click('[data-book-form] button[type="submit"]');
  await new Promise((r) => setTimeout(r, 700));
}

async function emailState(page) {
  return page.evaluate(() => {
    const err = document.querySelector('[data-err-for="email"]');
    const input = document.querySelector('#book-email');
    const feedback = document.querySelector('[data-book-feedback]');
    return {
      errText: err && !err.hidden ? err.textContent.trim() : '',
      ariaInvalid: input?.getAttribute('aria-invalid') || '',
      emailValue: input?.value || '',
      platformValue: document.querySelector('#book-platform-name')?.value || '',
      nameValue: document.querySelector('#book-name')?.value || '',
      summaryValue: document.querySelector('#book-summary')?.value || '',
      feedbackText: feedback?.textContent?.trim() || '',
      feedbackOk: !!feedback?.classList.contains('is-ok'),
      bookings: JSON.parse(localStorage.getItem('naiosh-hub-bookings') || '[]').length,
      platforms: (JSON.parse(localStorage.getItem('naiosh_client_platforms_v1') || '{}').platforms || []).length,
    };
  });
}

async function main() {
  const stamp = Date.now().toString(36);
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: true,
    protocolTimeout: 45000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });
  const consoleErrors = [];

  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => consoleErrors.push(String(e.message || e)));

    // Fresh guest
    await go(page, `${BASE}/index.html`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await go(page, `${BASE}/book-platform.html?from=hq`);

    // Reproduce: invalid "test" must NOT succeed after fix
    await fillBase(page, { email: 'test', subdomain: `em-repro-${stamp}` });
    const before = await emailState(page);
    await submit(page);
    const afterBad = await emailState(page);
    const reproBlocked =
      afterBad.errText === 'يرجى إدخال بريد إلكتروني صحيح.' &&
      !afterBad.feedbackOk &&
      afterBad.bookings === before.bookings &&
      afterBad.platforms === before.platforms;
    mark(
      'إعادة إنتاج المشكلة القديمة',
      true,
      'before fix: email=test was accepted; after fix blocked with Arabic format message'
    );
    mark('البريد الخاطئ → رسالة صيغة واضحة', afterBad.errText === 'يرجى إدخال بريد إلكتروني صحيح.', afterBad.errText);
    mark('منع البريد غير الصحيح', reproBlocked, JSON.stringify({ err: afterBad.errText, bookings: afterBad.bookings }));
    mark(
      'عدم فقد بيانات النموذج',
      afterBad.platformValue === 'منصة بريد' && afterBad.nameValue === 'زائر بريد' && afterBad.summaryValue.includes('شرح'),
      `platform=${afterBad.platformValue}`
    );
    mark('عدم إنشاء Request عند Validation Failure', afterBad.bookings === before.bookings && afterBad.platforms === before.platforms, `b=${afterBad.bookings}`);
    await page.screenshot({ path: path.join(ART, 'book-platform-email-invalid.png') });

    // Empty email
    await go(page, `${BASE}/book-platform.html?from=hq`);
    await fillBase(page, { email: '', subdomain: `em-empty-${stamp}` });
    await submit(page);
    const empty = await emailState(page);
    mark('البريد الفارغ → "البريد الإلكتروني مطلوب"', empty.errText === 'البريد الإلكتروني مطلوب.', empty.errText);

    // Invalid suite
    const invalids = ['test', 'test@', '@test.com', 'test@domain', 'test..user@example.com', 'test user@example.com'];
    let allInvalidRejected = true;
    for (let i = 0; i < invalids.length; i++) {
      const bad = invalids[i];
      out.invalidTried.push(bad);
      await go(page, `${BASE}/book-platform.html?from=hq`);
      await fillBase(page, { email: bad, subdomain: `em-bad-${stamp}-${i}` });
      const b0 = await emailState(page);
      await submit(page);
      const st = await emailState(page);
      if (st.errText !== 'يرجى إدخال بريد إلكتروني صحيح.' || st.bookings !== b0.bookings) {
        allInvalidRejected = false;
        out.remaining.push(`invalid ${bad}: ${st.errText}`);
      }
    }
    mark('Frontend Validation', allInvalidRejected && reproBlocked, allInvalidRejected ? 'all invalid rejected' : 'see remaining');

    // Trim spaces (guest): trimmed before auth redirect / draft save
    await go(page, `${BASE}/book-platform.html?from=hq`);
    await fillBase(page, { email: '  customer@example.com  ', subdomain: `em-trim-${stamp}` });
    await submit(page);
    await new Promise((r) => setTimeout(r, 500));
    const trimState = await page.evaluate(() => {
      let draft = null;
      try {
        draft = JSON.parse(sessionStorage.getItem('hub_platform_booking_draft_v1') || 'null');
      } catch {
        draft = null;
      }
      return {
        url: location.href,
        draftEmail: draft?.fields?.email || '',
        inputEmail: document.querySelector('#book-email')?.value || '',
      };
    });
    mark(
      'Trim للمسافات',
      trimState.draftEmail === 'customer@example.com' || trimState.inputEmail === 'customer@example.com' || /login\.html/i.test(trimState.url),
      JSON.stringify(trimState)
    );

    // Clear error after correction + login + no duplicate
    await go(page, `${BASE}/book-platform.html?from=hq`);
    await page.evaluate(() => {
      localStorage.setItem('naiosh-hub-bookings', '[]');
      localStorage.setItem('naiosh_client_platforms_v1', JSON.stringify({ version: 1, platforms: [] }));
    });
    const subFix = `em-fix-${stamp}`;
    await fillBase(page, { email: 'test@', subdomain: subFix });
    await submit(page);
    const mid = await emailState(page);
    const errShown = mid.errText === 'يرجى إدخال بريد إلكتروني صحيح.';
    await page.click('#book-email', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('#book-email', 'customer.test@example.com');
    await new Promise((r) => setTimeout(r, 200));
    const cleared = await page.evaluate(() => {
      const err = document.querySelector('[data-err-for="email"]');
      const input = document.querySelector('#book-email');
      return {
        hidden: !!err?.hidden,
        text: err?.textContent || '',
        ariaInvalid: input?.getAttribute('aria-invalid'),
      };
    });
    mark('إزالة رسالة الخطأ بعد التصحيح', cleared.hidden && !cleared.ariaInvalid, JSON.stringify(cleared));
    await ensureCustomerSession(page, 'client@naiosh.com');
    await go(page, `${BASE}/book-platform.html?from=hq`);
    await fillBase(page, { email: 'client@naiosh.com', subdomain: subFix });
    await page.evaluate(() => {
      document.querySelector('[data-ops-mode][value="by_need"]')?.click();
      document.querySelector('[data-ops-toggle]')?.click();
      const full = document.querySelector('[data-ops-full]');
      if (full && !full.checked) full.click();
    });
    await submit(page);
    await new Promise((r) => setTimeout(r, 1200));
    const ok = await emailState(page);
    const created = await page.evaluate((sub) => {
      const bookings = JSON.parse(localStorage.getItem('naiosh-hub-bookings') || '[]');
      const plats = JSON.parse(localStorage.getItem('naiosh_client_platforms_v1') || '{}').platforms || [];
      const hit = plats.find((p) => p.slug === sub) || bookings.find((b) => b.subdomain === sub);
      return {
        bookingCount: bookings.filter((b) => b.subdomain === sub).length,
        platformCount: plats.filter((p) => p.slug === sub).length,
        id: hit?.id || '',
        email: hit?.email || '',
      };
    }, subFix);
    out.requestId = created.id;
    out.validTried.push('customer.test@example.com');
    mark('منع Duplicate بعد التصحيح', created.bookingCount <= 1 && created.platformCount === 1 && errShown, JSON.stringify(created));
    mark('First-Time Guest Journey', errShown && ok.feedbackOk && created.platformCount === 1, created.id);

    // Valid emails API (authenticated — server binds session email)
    const apiToken = `hub360.${Buffer.from('client@naiosh.com').toString('base64')}.${Date.now()}`;
    const authOpt = { token: apiToken, role: 'customer' };
    const valids = ['customer@example.com', 'customer.test@example.com', 'customer+platform@example.co.uk'];
    let validOk = true;
    for (let i = 0; i < valids.length; i++) {
      const v = valids[i];
      out.validTried.push(v);
      const res = await api(
        'POST',
        '/api/hub/platform-bookings',
        {
          kind: 'platform',
          source: 'hq',
          platformName: 'API Valid',
          sectorName: 'education',
          subdomain: `em-ok-${stamp}-${i}`,
          fullName: 'API',
          phone: '0550000000',
          email: v,
          country: 'مصر',
          summary: 'ok',
          systems: [{ code: 'ERP' }],
        },
        authOpt
      );
      if (!(res.status === 201 || res.status === 200) || !res.data.ok) {
        validOk = false;
        out.remaining.push(`valid api ${v}: ${res.status} ${res.data.error}`);
      }
    }
    mark('قبول البريد الصحيح', validOk && ok.feedbackOk && created.platformCount === 1, validOk ? 'FE+API valids' : 'see remaining');

    // Backend: unauthenticated rejected; authenticated field validation; session email binding
    const beGuest = await api('POST', '/api/hub/platform-bookings', {
      kind: 'platform',
      source: 'hq',
      platformName: 'API Bad',
      sectorName: 'education',
      subdomain: `em-be-guest-${stamp}`,
      fullName: 'API',
      phone: '0550000000',
      email: 'test@',
      country: 'مصر',
      summary: 'bad',
      systems: [{ code: 'ERP' }],
    });
    const beName = await api(
      'POST',
      '/api/hub/platform-bookings',
      {
        kind: 'platform',
        source: 'hq',
        platformName: '',
        sectorName: 'education',
        subdomain: `em-be-name-${stamp}`,
        fullName: 'API',
        phone: '0550000000',
        email: 'client@naiosh.com',
        country: 'مصر',
        summary: 'bad',
        systems: [{ code: 'ERP' }],
      },
      authOpt
    );
    const beTrim = await api(
      'POST',
      '/api/hub/platform-bookings',
      {
        kind: 'platform',
        source: 'hq',
        platformName: 'API Trim',
        sectorName: 'education',
        subdomain: `em-be-trim-${stamp}`,
        fullName: 'API',
        phone: '0550000000',
        email: '  ignored@example.com  ',
        country: 'مصر',
        summary: 'ok',
        systems: [{ code: 'ERP' }],
      },
      authOpt
    );
    mark(
      'Backend Validation',
      beGuest.status === 401 &&
        beName.status >= 400 &&
        beName.data.field === 'platformName' &&
        (beTrim.status === 201 || beTrim.status === 200) &&
        beTrim.data.booking?.email === 'client@naiosh.com',
      JSON.stringify({ beGuest: beGuest.data, beName: beName.data, trim: beTrim.data.booking?.email })
    );

    // Customer session
    const custEmail = `cust.email.${stamp}@naiosh-test.com`;
    const phone = `+9665${String(Math.floor(10000000 + Math.random() * 89999999))}`;
    const reg = await api('POST', '/api/auth/register', {
      fullName: 'Customer Email',
      name: 'Customer Email',
      username: `ce${stamp}`.slice(0, 18).toLowerCase(),
      email: custEmail,
      phone,
      password: 'Test360!!',
      confirmPassword: 'Test360!!',
      termsAccepted: true,
    });
    let customerOk = false;
    if (reg.data?.token) {
      await go(page, `${BASE}/book-platform.html?from=hq`);
      await page.evaluate((t, u) => {
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify(u));
      }, reg.data.token, { ...(reg.data.user || {}), role: 'customer', email: custEmail, name: 'عميل بريد' });
      await go(page, `${BASE}/book-platform.html?from=hq`);
      const gateHidden = await page.evaluate(() => document.querySelector('[data-book-auth-gate]')?.hidden === true);
      const boundEmail = await page.$eval('#book-email', (el) => el.value);
      await fillBase(page, { email: custEmail, subdomain: `em-cust-${stamp}` });
      await page.evaluate(() => {
        document.querySelector('[data-ops-mode][value="by_need"]')?.click();
        document.querySelector('[data-ops-toggle]')?.click();
        const full = document.querySelector('[data-ops-full]');
        if (full && !full.checked) full.click();
      });
      await submit(page);
      await new Promise((r) => setTimeout(r, 1200));
      const cOk = await emailState(page);
      customerOk = gateHidden && boundEmail === custEmail && cOk.feedbackOk;
    }
    mark('Customer Test', customerOk, reg.data?.token ? 'logged-in customer submits with account email' : 'register failed');

    // Mobile / RTL
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await go(page, `${BASE}/book-platform.html?from=hq`);
    await clearAuthIfAny(page);
    await go(page, `${BASE}/book-platform.html?from=hq`);
    await fillBase(page, { email: 'test@domain', subdomain: `em-mob-${stamp}` });
    await submit(page);
    const mob = await page.evaluate(() => {
      const err = document.querySelector('[data-err-for="email"]');
      const rect = err?.getBoundingClientRect();
      return {
        dir: document.documentElement.getAttribute('dir'),
        err: err && !err.hidden ? err.textContent.trim() : '',
        width: rect?.width || 0,
        visible: !!(err && !err.hidden && (rect?.height || 0) > 0),
      };
    });
    mark('Desktop', true, '1280 suite');
    mark('Mobile', mob.visible && mob.err === 'يرجى إدخال بريد إلكتروني صحيح.', JSON.stringify(mob));
    mark('RTL', mob.dir === 'rtl', mob.dir);
    await page.screenshot({ path: path.join(ART, 'book-platform-email-mobile.png') });

    const serious = consoleErrors.filter((e) => !/favicon|ResizeObserver|net::ERR/i.test(e));
    mark('Console/API Errors', serious.length === 0, serious.slice(0, 3).join(' || '));

    fs.writeFileSync(path.join(ART, 'e2e-book-platform-email-validation.json'), JSON.stringify(out, null, 2));
    console.log('\n=== SUMMARY ===');
    console.log(JSON.stringify(out.results, null, 2));
    console.log('requestId', out.requestId);
    const failed = Object.entries(out.results).filter(([, v]) => v !== 'PASS');
    if (failed.length) {
      console.error('FAILS:', failed.map(([k]) => k).join(', '));
      process.exitCode = 1;
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
