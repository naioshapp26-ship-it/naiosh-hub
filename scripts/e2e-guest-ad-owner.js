/**
 * Guest/Customer ad owner identity regression.
 * Run: node scripts/e2e-guest-ad-owner.js
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

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const out = {
  results: {},
  guestRequestId: '',
  customerRequestId: '',
  errors: [],
  fixed: [],
  remaining: [],
};

function mark(name, pass, detail = '') {
  out.results[name] = pass ? 'PASS' : 'FAIL';
  if (!pass) out.remaining.push(`${name}: ${detail}`);
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

async function fillWizard(page, title) {
  await page.waitForSelector('[data-ads-create]', { timeout: 15000 });
  await page.click('[data-ads-create]');
  await page.waitForSelector('[data-draft="title"]', { timeout: 8000 });
  await page.click('[data-ads-type-pick="image"]');
  await page.waitForSelector('input[data-ads-file]', { timeout: 5000 });
  await page.evaluate((t) => {
    const titleEl = document.querySelector('[data-draft="title"]');
    const headline = document.querySelector('[data-draft="headline"]');
    const desc = document.querySelector('[data-draft="desc"]');
    if (titleEl) titleEl.value = t;
    if (headline) headline.value = t + ' · عنوان';
    if (desc) desc.value = 'وصف اختبار هوية صاحب الإعلان';
    [titleEl, headline, desc].forEach((el) => el && el.dispatchEvent(new Event('input', { bubbles: true })));
  }, title);
  const pngPath = path.join(ART, '_guest-ad.png');
  fs.writeFileSync(pngPath, TINY_PNG);
  await (await page.$('input[data-ads-file]')).uploadFile(pngPath);
  await page.waitForFunction(() => !!document.querySelector('.ads-preview-box'), { timeout: 10000 });
  for (let i = 0; i < 4; i++) {
    if (await page.$('[data-ads-place="home"]')) {
      await page.evaluate(() => document.querySelector('[data-ads-place="home"]')?.click());
    }
    const hasNext = await page.$('[data-ads-next]');
    if (!hasNext) break;
    await page.evaluate(() => document.querySelector('[data-ads-next]')?.click());
    await new Promise((r) => setTimeout(r, 250));
  }
  await page.waitForSelector('[data-ads-submit]', { timeout: 10000 });
}

async function main() {
  const consoleErrors = [];
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(25000);
    page.on('pageerror', (e) => consoleErrors.push(String(e.message || e)));
    page.on('dialog', async (d) => {
      await d.dismiss().catch(() => {});
    });

    // —— Test A: Guest ——
    await page.goto(`${BASE}/ads.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await fillWizard(page, 'إعلان زائر هوية');

    const ownerSection = await page.evaluate(() => document.body.innerText.includes('بيانات صاحب الإعلان'));
    assert.ok(ownerSection, 'owner section missing for guest');

    await page.evaluate(() => {
      const set = (sel, v) => {
        const el = document.querySelector(sel);
        if (!el) return;
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('[data-draft="ownerName"]', 'ضيف الاختبار');
      set('[data-draft="ownerEmail"]', 'guest.ad.owner@naiosh-test.com');
      set('[data-draft="ownerPhone"]', '+966511112222');
      set('[data-draft="ownerCompany"]', 'جهة تجريبية');
    });

    const guestPost1 = page.waitForResponse(
      (r) => /\/api\/hub\/ad-submissions\/?$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST',
      { timeout: 20000 }
    );
    await page.evaluate(() => document.querySelector('[data-ads-submit]')?.click());
    const res1 = await guestPost1;
    const data1 = await res1.json();
    assert.ok(data1.ok && data1.submission, JSON.stringify(data1));
    out.guestRequestId = data1.submission.requestId;
    mark(
      'اختبار الزائر',
      data1.submission.ownerType === 'Guest' &&
        !!data1.submission.guestContactId &&
        !data1.submission.customerId &&
        data1.submission.ownerPhone === '+966511112222',
      JSON.stringify(data1.submission)
    );
    mark('Request ID تم إنشاؤه', !!out.guestRequestId, out.guestRequestId);

    // Double submit with same idempotency
    const body1 = JSON.parse(res1.request().postData() || '{}');
    const dup = await api('POST', '/api/hub/ad-submissions', { body: body1 });
    mark(
      'منع Double Submission',
      dup.status === 200 && dup.data.duplicate === true && dup.data.submission.requestId === out.guestRequestId,
      `status=${dup.status} dup=${dup.data.duplicate}`
    );

    await page.waitForFunction(() => /تم إرسال إعلانك للمراجعة بنجاح/.test(document.body.innerText), {
      timeout: 15000,
    });

    const staffToken = `hub360.${Buffer.from('leader@naiosh.com').toString('base64')}.${Date.now()}`;
    const adminList = await api('GET', '/api/hub/ad-submissions', {
      token: staffToken,
      role: 'supreme_leader',
    });
    const guestInAdmin = (adminList.data.requests || []).find((r) => r.requestId === out.guestRequestId);
    mark(
      'وصل إلى الإدارة',
      adminList.status === 200 && !!guestInAdmin,
      `status=${adminList.status} count=${adminList.data.count}`
    );
    mark(
      'بيانات التواصل ظاهرة للإدارة',
      !!guestInAdmin &&
        guestInAdmin.ownerType === 'Guest' &&
        guestInAdmin.email === 'guest.ad.owner@naiosh-test.com' &&
        guestInAdmin.phone === '+966511112222' &&
        guestInAdmin.customerName === 'ضيف الاختبار',
      guestInAdmin ? JSON.stringify({ email: guestInAdmin.email, phone: guestInAdmin.phone }) : 'missing'
    );
    mark(
      'بيانات صاحب الإعلان محفوظة',
      !!guestInAdmin && !!guestInAdmin.guestContactId && !guestInAdmin.customerId,
      guestInAdmin ? guestInAdmin.guestContactId : ''
    );
    mark(
      'المرفقات تعمل',
      !!data1.submission.mediaDataUrl || !!data1.submission.mediaName || (guestInAdmin?.attachments || []).length > 0,
      data1.submission.mediaName || ''
    );

    // —— Test B: Customer ——
    const stamp = Date.now().toString(36);
    const cust = {
      fullName: 'عميل إعلان',
      username: `adcust${stamp}`.slice(0, 32),
      email: `ad.cust.${stamp}@naiosh-test.com`,
      phone: '+966533334444',
      password: 'Test360',
      confirmPassword: 'Test360',
      termsAccepted: true,
    };
    const reg = await api('POST', '/api/auth/register', { body: cust });
    assert.ok(reg.data.ok || reg.data.success, JSON.stringify(reg.data));
    const tokenC = reg.data.token;
    const userC = reg.data.user;

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE}/ads.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      (t, u) => {
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify(u));
        document.cookie = 'hub_session=' + encodeURIComponent(t) + '; Path=/; SameSite=Lax; Max-Age=2592000';
      },
      tokenC,
      { ...userC, role: 'customer', name: userC.fullName || userC.name, phone: cust.phone }
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await fillWizard(page, 'إعلان عميل هوية');
    await page.evaluate((phone) => {
      const p = document.querySelector('[data-draft="ownerPhone"]');
      if (p && !p.value) {
        p.value = phone;
        p.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, cust.phone);

    const custPost = page.waitForResponse(
      (r) => /\/api\/hub\/ad-submissions\/?$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST',
      { timeout: 20000 }
    );
    await page.evaluate(() => document.querySelector('[data-ads-submit]')?.click());
    const resC = await custPost;
    const dataC = await resC.json();
    assert.ok(dataC.ok && dataC.submission, JSON.stringify(dataC));
    out.customerRequestId = dataC.submission.requestId;
    mark(
      'اختبار العميل',
      dataC.submission.ownerType === 'Customer' &&
        !!dataC.submission.customerId &&
        !dataC.submission.guestContactId &&
        dataC.submission.ownerEmail === cust.email,
      JSON.stringify({
        ownerType: dataC.submission.ownerType,
        customerId: dataC.submission.customerId,
        email: dataC.submission.ownerEmail,
      })
    );

    // —— Test C: tamper ——
    const steal = await api('POST', '/api/hub/ad-submissions', {
      token: tokenC,
      body: {
        idempotencyKey: `tamper-${Date.now()}`,
        customerId: 'CL-FAKE-OTHER',
        owner: { name: 'سارق', email: cust.email, phone: cust.phone, company: '' },
        ad: {
          title: 'محاولة انتحال',
          headline: 'محاولة انتحال',
          contentType: 'text',
          bodyText: 'نص',
          placements: ['home'],
        },
      },
    });
    const stealGet = await api('GET', `/api/hub/ad-submissions/${encodeURIComponent(out.guestRequestId)}`, {
      token: tokenC,
    });
    mark(
      'منع انتحال Customer ID',
      (steal.status === 403 && steal.data.code === 'CUSTOMER_ID_TAMPER') ||
        (steal.status === 201 &&
          steal.data.submission &&
          steal.data.submission.customerId &&
          steal.data.submission.customerId !== 'CL-FAKE-OTHER' &&
          stealGet.status >= 400),
      `post=${steal.status} get=${stealGet.status} code=${steal.data.code} cid=${steal.data.submission && steal.data.submission.customerId}`
    );

    mark(
      'Console/API Errors',
      consoleErrors.filter((e) => !/403|Failed to load resource/i.test(e)).length === 0,
      consoleErrors.slice(0, 3).join(' | ')
    );

    out.fixed = [
      'قسم بيانات صاحب الإعلان للزائر والعميل',
      'Owner Type Customer/Guest مع Guest Contact ID',
      'API /api/hub/ad-submissions + Postgres hub_ad_submissions',
      'ربط طلبات الإعلانات في POSHA مع بيانات التواصل',
      'منع انتحال Customer ID و Double Submission',
    ];

    await page.screenshot({ path: path.join(ART, 'e2e-guest-ad-owner.png') }).catch(() => {});
  } catch (err) {
    out.errors.push(String(err && err.stack ? err.stack : err));
    Object.keys(out.results).forEach((k) => {
      if (!out.results[k]) out.results[k] = 'FAIL';
    });
    [
      'اختبار الزائر',
      'اختبار العميل',
      'بيانات صاحب الإعلان محفوظة',
      'Request ID تم إنشاؤه',
      'وصل إلى الإدارة',
      'بيانات التواصل ظاهرة للإدارة',
      'المرفقات تعمل',
      'منع انتحال Customer ID',
      'منع Double Submission',
      'Console/API Errors',
    ].forEach((k) => {
      if (!out.results[k]) out.results[k] = 'FAIL';
    });
    throw err;
  } finally {
    await browser.close().catch(() => {});
  }

  fs.writeFileSync(path.join(ART, 'e2e-guest-ad-owner.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  if (Object.values(out.results).some((v) => v !== 'PASS')) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  fs.writeFileSync(
    path.join(ART, 'e2e-guest-ad-owner.json'),
    JSON.stringify({ ...out, fatal: String(err && err.stack ? err.stack : err) }, null, 2)
  );
  process.exit(1);
});
