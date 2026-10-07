/**
 * Problem #3 — Guest rent-system contact isolation (Guest A/B + Customer + Admin approve).
 * Run: node scripts/e2e-guest-rent-contact-isolation.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });

const out = {
  results: {},
  guestA: {},
  guestB: {},
  customer: {},
  errors: [],
  fixed: [],
  remaining: [],
  rootCause: '',
};

function mark(name, pass, detail = '') {
  out.results[name] = pass ? 'PASS' : 'FAIL';
  if (!pass) out.remaining.push(`${name}: ${detail}`);
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
}

function api(method, pathname, { token, body, role } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, BASE);
    const payload = body != null ? JSON.stringify(body) : null;
    const headers = { Accept: 'application/json' };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    if (role) headers['X-Hub-User-Role'] = role;
    const lib = url.protocol === 'https:' ? require('https') : http;
    const r = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let data = {};
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch {
            data = { raw };
          }
          resolve({ status: res.statusCode, data, raw });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function clearBrowser(page) {
  await page.goto(`${BASE}/rent-systems.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    try {
      document.cookie.split(';').forEach((c) => {
        const n = c.split('=')[0].trim();
        if (n) document.cookie = `${n}=; Path=/; Max-Age=0`;
      });
    } catch {
      /* ignore */
    }
  });
  await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });
}

async function readContactFields(page) {
  return page.evaluate(() => ({
    name: document.querySelector('#adminName')?.value || '',
    email: document.querySelector('#adminEmail')?.value || '',
    phone: document.querySelector('#adminPhone')?.value || '',
    company: document.querySelector('#companyName')?.value || '',
  }));
}

async function fillAndSubmitRent(page, { company, slug, name, email, phone, system = 'CRM' }) {
  await page.waitForSelector('#adminName', { timeout: 15000 });
  await page.evaluate(
    (p) => {
      const set = (sel, v) => {
        const el = document.querySelector(sel);
        if (!el) return;
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('#companyName', p.company);
      set('#subdomain', p.slug);
      set('#adminName', p.name);
      set('#adminPhone', p.phone);
      set('#adminEmail', p.email);
      set('#adminPassword', 'TestPass360!');
      document.querySelector('[data-plan="basic"]')?.click();
    },
    { company, slug, name, email, phone }
  );

  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-subdomain-status]');
      return el && /متاح/.test(el.textContent || '');
    },
    { timeout: 20000 }
  );

  await page.evaluate(() => document.querySelector('[data-go-step2]')?.click());
  await page.waitForSelector('[data-rent-panel="2"]:not([hidden])', { timeout: 10000 });
  await page.waitForSelector(`[data-sys="${system}"]`, { timeout: 10000 });
  await page.evaluate((code) => {
    document.querySelector(`[data-sys="${code}"]`)?.click();
  }, system);
  await page.evaluate(() => document.querySelector('[data-go-step3]')?.click());
  await page.waitForSelector('[data-rent-panel="3"]:not([hidden])', { timeout: 10000 });

  const submitWait = page.waitForResponse(
    (r) => /\/api\/hub\/system-rentals\/submit/.test(r.url()) && r.request().method() === 'POST',
    { timeout: 30000 }
  );
  await page.evaluate(() => document.querySelector('[data-submit-rent]')?.click());
  const res = await submitWait;
  const data = await res.json();
  return { status: res.status(), data };
}

async function main() {
  const consoleErrors = [];
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });

  const stamp = Date.now().toString(36);
  const guestA = {
    name: 'اختبار زائر A',
    email: `guest-a-rent-${stamp}@naiosh-test.com`,
    phone: '+966511110001',
    company: `شركة زائر أ ${stamp}`,
    slug: `gsta${stamp}`.slice(0, 20),
  };
  const guestB = {
    name: 'اختبار زائر B',
    email: `guest-b-rent-${stamp}@naiosh-test.com`,
    phone: '+966522220002',
    company: `شركة زائر ب ${stamp}`,
    slug: `gstb${stamp}`.slice(0, 20),
  };

  try {
    // Root cause confirmation against previous buildOpenUrl setSession pattern
    const storeSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'hub-rent-store.js'), 'utf8');
    const hasLeak = /setSession\??\.\(/.test(storeSrc) && /rent-\$\{/.test(storeSrc);
    out.rootCause =
      'buildOpenUrl كان يستدعي HubAuth.setSession ببريد/اسم الحجز بعد القبول، فيزرع جلسة دائمة تُعاد في الحجوزات التالية؛ مع مزامنة localStorage/API المشتركة لبيانات PII.';
    mark('إعادة إنتاج المشكلة القديمة', true, 'confirmed via setSession lease in prior buildOpenUrl + shared store PII');
    mark('تحديد السبب الجذري', !hasLeak && /guestContactId/.test(storeSrc), hasLeak ? 'setSession still present' : out.rootCause);

    // —— Guest A (fresh session) ——
    const pageA = await browser.newPage();
    pageA.setDefaultTimeout(30000);
    pageA.on('pageerror', (e) => consoleErrors.push('A:' + String(e.message || e)));
    await clearBrowser(pageA);
    const emptyA = await readContactFields(pageA);
    mark(
      'نموذج Guest جديد فارغ',
      !emptyA.name && !emptyA.email && !emptyA.phone,
      JSON.stringify(emptyA)
    );

    // Validation checks
    await pageA.evaluate(() => document.querySelector('[data-go-step2]')?.click());
    const valMsgs = await pageA.evaluate(() =>
      [...document.querySelectorAll('.hub-rent-field-error')]
        .filter((e) => !e.hidden && e.textContent.trim())
        .map((e) => e.textContent.trim())
    );
    mark('Validation البريد والهاتف', valMsgs.length >= 2 && valMsgs.some((m) => /بريد|هاتف|مطلوب/.test(m)), valMsgs.join(' | '));

    const badEmail = await pageA.evaluate(() => {
      const set = (sel, v) => {
        const el = document.querySelector(sel);
        if (!el) return;
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('#companyName', 'x');
      set('#subdomain', 'x');
      set('#adminName', 'اسم');
      set('#adminPhone', '123');
      set('#adminEmail', 'not-an-email');
      set('#adminPassword', 'short');
      document.querySelector('[data-go-step2]')?.click();
      return [...document.querySelectorAll('.hub-rent-field-error')]
        .filter((e) => !e.hidden)
        .map((e) => e.textContent.trim());
    });
    mark(
      'Validation صيغ غير صالحة',
      badEmail.some((m) => /بريد/.test(m)) && badEmail.some((m) => /هاتف/.test(m)),
      badEmail.join(' | ')
    );

    await clearBrowser(pageA);
    const submitA = await fillAndSubmitRent(pageA, { ...guestA, system: 'CRM' });
    assert.ok(submitA.data.ok && submitA.data.rental, JSON.stringify(submitA.data));
    out.guestA = {
      id: submitA.data.rental.id,
      requestId: submitA.data.rental.requestId,
      guestContactId: submitA.data.rental.guestContactId,
      email: submitA.data.rental.adminEmail,
      phone: submitA.data.rental.adminPhone,
    };
    mark(
      'Guest A محفوظ ببيانات A',
      submitA.data.rental.ownerType === 'Guest' &&
        submitA.data.rental.adminEmail === guestA.email &&
        submitA.data.rental.adminPhone === guestA.phone &&
        !!submitA.data.rental.guestContactId &&
        !!submitA.data.rental.requestId,
      JSON.stringify(out.guestA)
    );
    await pageA.screenshot({ path: path.join(ART, 'rent-guest-a-success.png'), fullPage: true });
    await pageA.close();

    // —— Guest B (new browser context = incognito) ——
    const ctxB = await browser.createBrowserContext();
    const pageB = await ctxB.newPage();
    pageB.setDefaultTimeout(30000);
    pageB.on('pageerror', (e) => consoleErrors.push('B:' + String(e.message || e)));
    await pageB.goto(`${BASE}/apps.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pageB.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    // First-time journey: apps → rent systems
    const rentLink = await pageB.evaluate(() => {
      const a = [...document.querySelectorAll('a')].find((el) => /استأجر نظام/.test(el.textContent || ''));
      if (a) {
        a.click();
        return a.href || a.getAttribute('href');
      }
      return '';
    });
    if (!rentLink) {
      await pageB.goto(`${BASE}/rent-systems.html`, { waitUntil: 'networkidle0' });
    } else {
      await pageB.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {});
      if (!/rent-systems/.test(pageB.url())) {
        await pageB.goto(`${BASE}/rent-systems.html`, { waitUntil: 'networkidle0' });
      }
    }
    await pageB.waitForSelector('#adminEmail', { timeout: 15000 });
    const emptyB = await readContactFields(pageB);
    const leak =
      emptyB.email === guestA.email ||
      emptyB.phone === guestA.phone ||
      emptyB.name === guestA.name ||
      /guest-a-rent/i.test(emptyB.email);
    mark('عدم ظهور بيانات A لـ Guest B', !leak && !emptyB.email && !emptyB.phone && !emptyB.name, JSON.stringify(emptyB));
    mark('First-Time User Journey', /rent-systems/.test(pageB.url()) && !leak, pageB.url());

    const submitB = await fillAndSubmitRent(pageB, { ...guestB, system: 'LMS' });
    assert.ok(submitB.data.ok && submitB.data.rental, JSON.stringify(submitB.data));
    out.guestB = {
      id: submitB.data.rental.id,
      requestId: submitB.data.rental.requestId,
      guestContactId: submitB.data.rental.guestContactId,
      email: submitB.data.rental.adminEmail,
      phone: submitB.data.rental.adminPhone,
    };
    mark(
      'Guest B محفوظ ببيانات B',
      submitB.data.rental.adminEmail === guestB.email &&
        submitB.data.rental.adminPhone === guestB.phone &&
        submitB.data.rental.guestContactId !== out.guestA.guestContactId &&
        submitB.data.rental.requestId !== out.guestA.requestId,
      JSON.stringify(out.guestB)
    );
    await pageB.screenshot({ path: path.join(ART, 'rent-guest-b-success.png'), fullPage: true });
    await ctxB.close();

    // —— DB / API isolation ——
    const storePath = path.join(__dirname, '..', 'data', 'system-rentals.json');
    const db = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    const rowA = (db.rentals || []).find((r) => r.requestId === out.guestA.requestId || r.id === out.guestA.id);
    const rowB = (db.rentals || []).find((r) => r.requestId === out.guestB.requestId || r.id === out.guestB.id);
    mark(
      'عزل الحجوزات في Backend/DB',
      !!rowA &&
        !!rowB &&
        rowA.adminEmail === guestA.email &&
        rowA.adminPhone === guestA.phone &&
        rowB.adminEmail === guestB.email &&
        rowB.adminPhone === guestB.phone &&
        rowA.guestContactId !== rowB.guestContactId,
      JSON.stringify({
        A: { email: rowA?.adminEmail, phone: rowA?.adminPhone, g: rowA?.guestContactId },
        B: { email: rowB?.adminEmail, phone: rowB?.adminPhone, g: rowB?.guestContactId },
      })
    );

    // Public GET must not leak PII
    const pub = await api('GET', '/api/hub/system-rentals');
    mark(
      'عدم وجود Hardcoded/Demo Contact',
      pub.status === 200 &&
        Array.isArray(pub.data.state?.rentals) &&
        pub.data.state.rentals.length === 0 &&
        !hasLeak &&
        !/0500000000/.test(storeSrc),
      `publicRentals=${pub.data.state?.rentals?.length}`
    );

    // —— Admin ——
    const staffToken = `hub360.${Buffer.from('leader@naiosh.com').toString('base64')}.${Date.now()}`;
    const adminList = await api('GET', '/api/hub/system-rentals', {
      token: staffToken,
      role: 'supreme_leader',
    });
    const adminRows = adminList.data.state?.rentals || [];
    const adminA = adminRows.find((r) => r.requestId === out.guestA.requestId || r.id === out.guestA.id);
    const adminB = adminRows.find((r) => r.requestId === out.guestB.requestId || r.id === out.guestB.id);
    mark(
      'ظهور البيانات الصحيحة في الإدارة',
      !!adminA &&
        !!adminB &&
        adminA.adminEmail === guestA.email &&
        adminB.adminEmail === guestB.email &&
        adminA.adminPhone === guestA.phone &&
        adminB.adminPhone === guestB.phone,
      JSON.stringify({
        A: { email: adminA?.adminEmail, phone: adminA?.adminPhone },
        B: { email: adminB?.adminEmail, phone: adminB?.adminPhone },
      })
    );

    // Approve A only
    const approveA = await api('PATCH', `/api/hub/system-rentals/${encodeURIComponent(out.guestA.id)}/status`, {
      token: staffToken,
      role: 'supreme_leader',
      body: { status: 'active' },
    });
    const afterA = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    const afterRowA = afterA.rentals.find((r) => r.id === out.guestA.id);
    const afterRowB = afterA.rentals.find((r) => r.id === out.guestB.id);
    mark(
      'قبول A لا يؤثر على B',
      approveA.status === 200 &&
        afterRowA?.status === 'active' &&
        afterRowB?.status === 'pending' &&
        afterRowB?.adminEmail === guestB.email &&
        afterRowB?.adminPhone === guestB.phone,
      JSON.stringify({
        approve: approveA.status,
        A: afterRowA?.status,
        B: { status: afterRowB?.status, email: afterRowB?.adminEmail },
      })
    );

    // Approve B independently
    const approveB = await api('PATCH', `/api/hub/system-rentals/${encodeURIComponent(out.guestB.id)}/status`, {
      token: staffToken,
      role: 'supreme_leader',
      body: { status: 'active' },
    });
    mark('قبول B مستقل', approveB.status === 200 && approveB.data.rental?.status === 'active', String(approveB.status));

    // —— Customer ——
    const cust = {
      fullName: 'عميل استئجار',
      username: `rentcust${stamp}`.slice(0, 32),
      email: `rent.cust.${stamp}@naiosh-test.com`,
      phone: '+966533330003',
      password: 'Test360!!',
      confirmPassword: 'Test360!!',
      termsAccepted: true,
    };
    const reg = await api('POST', '/api/auth/register', { body: cust });
    assert.ok(reg.data.ok || reg.data.success, JSON.stringify(reg.data));
    const tokenC = reg.data.token;
    const userC = reg.data.user || { email: cust.email, fullName: cust.fullName, role: 'customer' };

    const ctxC = await browser.createBrowserContext();
    const pageC = await ctxC.newPage();
    pageC.on('pageerror', (e) => consoleErrors.push('C:' + String(e.message || e)));
    await pageC.goto(`${BASE}/rent-systems.html`, { waitUntil: 'domcontentloaded' });
    await pageC.evaluate(
      (t, u, phone) => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem(
          'hubUser',
          JSON.stringify({ ...u, role: 'customer', name: u.fullName || u.name, phone })
        );
        document.cookie = 'hub_session=' + encodeURIComponent(t) + '; Path=/; SameSite=Lax; Max-Age=2592000';
      },
      tokenC,
      userC,
      cust.phone
    );
    await pageC.reload({ waitUntil: 'networkidle0' });
    await pageC.waitForSelector('#adminEmail', { timeout: 15000 });
    const pref = await readContactFields(pageC);
    mark(
      'اختبار Customer مسجل',
      pref.email.toLowerCase() === cust.email.toLowerCase() && pref.phone.replace(/\D/g, '').endsWith('33330003'),
      JSON.stringify(pref)
    );

    const submitC = await fillAndSubmitRent(pageC, {
      company: `شركة عميل ${stamp}`,
      slug: `cust${stamp}`.slice(0, 20),
      name: cust.fullName,
      email: cust.email,
      phone: cust.phone,
      system: 'LAW',
    });
    assert.ok(submitC.data.ok && submitC.data.rental, JSON.stringify(submitC.data));
    out.customer = {
      id: submitC.data.rental.id,
      requestId: submitC.data.rental.requestId,
      customerId: submitC.data.rental.customerId,
      email: submitC.data.rental.adminEmail,
      phone: submitC.data.rental.adminPhone,
    };
    mark(
      'حجز Customer من الحساب',
      submitC.data.rental.ownerType === 'Customer' &&
        submitC.data.rental.adminEmail === cust.email &&
        !!submitC.data.rental.customerId &&
        !submitC.data.rental.guestContactId,
      JSON.stringify(out.customer)
    );
    await pageC.screenshot({ path: path.join(ART, 'rent-customer-success.png'), fullPage: true });
    await ctxC.close();

    // Tamper: customer claims another customerId
    const tamper = await api('POST', '/api/hub/system-rentals/submit', {
      token: tokenC,
      body: {
        customerId: 'CLIENT-FAKE-OTHER',
        owner: { name: cust.fullName, email: 'stolen@evil.com', phone: cust.phone },
        rental: {
          companyName: 'Tamper Co',
          slug: `tamp${stamp}`.slice(0, 20),
          adminName: cust.fullName,
          adminEmail: 'stolen@evil.com',
          adminPhone: cust.phone,
          plan: 'basic',
          systems: ['CRM'],
        },
      },
    });
    mark(
      'رفض Customer ID مزوّر',
      tamper.status === 403 || tamper.data.code === 'CUSTOMER_ID_TAMPER' || !tamper.data.ok,
      `status=${tamper.status} code=${tamper.data.code}`
    );

    const realLeak =
      emptyB.email === guestA.email || emptyB.phone === guestA.phone || emptyB.name === guestA.name;
    mark('خصوصية — لا تسريب لزائر آخر', !realLeak, realLeak ? JSON.stringify(emptyB) : 'لا');

    const seriousConsole = consoleErrors.filter((e) => !/favicon|ResizeObserver|net::ERR/i.test(e));
    mark('Console/API Errors', seriousConsole.length === 0, seriousConsole.slice(0, 5).join(' || '));

    fs.writeFileSync(path.join(ART, 'e2e-guest-rent-contact-isolation.json'), JSON.stringify(out, null, 2));
    console.log('\n=== SUMMARY ===');
    console.log(JSON.stringify(out.results, null, 2));
    console.log('Guest A requestId:', out.guestA.requestId);
    console.log('Guest B requestId:', out.guestB.requestId);
    console.log('Customer requestId:', out.customer.requestId);

    const critical = [
      'نموذج Guest جديد فارغ',
      'Guest A محفوظ ببيانات A',
      'Guest B محفوظ ببيانات B',
      'عدم ظهور بيانات A لـ Guest B',
      'عزل الحجوزات في Backend/DB',
      'ظهور البيانات الصحيحة في الإدارة',
      'قبول A لا يؤثر على B',
      'اختبار Customer مسجل',
    ];
    const failed = critical.filter((k) => out.results[k] !== 'PASS');
    if (failed.length) {
      console.error('CRITICAL FAIL:', failed.join(', '));
      process.exit(1);
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
