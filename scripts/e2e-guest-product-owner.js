/**
 * Guest/Customer product owner identity — Tests A–F.
 * Run: node scripts/e2e-guest-product-owner.js
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
  guestProductId: '',
  guestRequestId: '',
  customerProductId: '',
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

async function fillProductWizard(page, title) {
  await page.waitForSelector('[data-su-place="INTERNAL"], .su-wizard', { timeout: 20000 });
  if (await page.$('[data-su-place="INTERNAL"]')) {
    await page.evaluate(() => document.querySelector('[data-su-place="INTERNAL"]')?.click());
  }
  await page.waitForSelector('[data-su-next]', { timeout: 8000 });
  await page.evaluate(() => document.querySelector('[data-su-next]')?.click());

  await page.waitForSelector('[data-su-field="productName"]', { timeout: 8000 });
  await page.evaluate((t) => {
    const set = (sel, v) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('[data-su-field="productName"]', t);
    set('[data-su-field="category"]', 'electronics');
    set('[data-su-field="shortDesc"]', 'وصف اختبار منتج هوية صاحب المنتج');
    set('[data-su-field="priceUsd"]', '29.99');
  }, title);
  await page.evaluate(() => document.querySelector('[data-su-next]')?.click());

  // INTERNAL skips link step → media
  await page.waitForSelector('[data-su-file="images"]', { timeout: 10000 });
  const fileInput = await page.$('input[data-su-file="images"]');
  if (fileInput) {
    const pngPath = path.join(ART, '_guest-product.png');
    fs.writeFileSync(pngPath, TINY_PNG);
    await fileInput.uploadFile(pngPath);
    await new Promise((r) => setTimeout(r, 500));
  }
  await page.evaluate(() => document.querySelector('[data-su-next]')?.click());

  await page.waitForSelector('[data-su-submit], [data-su-field="ownerName"]', { timeout: 10000 });
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
    page.setDefaultTimeout(30000);
    page.on('pageerror', (e) => consoleErrors.push(String(e.message || e)));
    page.on('dialog', async (d) => {
      await d.accept().catch(() => {});
    });

    // —— Test A: Guest ——
    await page.goto(`${BASE}/store.html#upload`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await fillProductWizard(page, 'منتج زائر هوية');

    const ownerSection = await page.evaluate(() => document.body.innerText.includes('بيانات صاحب المنتج'));
    assert.ok(ownerSection, 'owner section missing for guest');

    await page.evaluate(() => {
      const set = (sel, v) => {
        const el = document.querySelector(sel);
        if (!el) return;
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('[data-su-field="ownerName"]', 'ضيف المنتج');
      set('[data-su-field="ownerEmail"]', 'guest.product.owner@naiosh-test.com');
      set('[data-su-field="ownerPhone"]', '+966511112233');
      set('[data-su-field="ownerCompany"]', 'متجر تجريبي');
    });

    const guestPost1 = page.waitForResponse(
      (r) => /\/api\/hub\/product-submissions\/?$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST',
      { timeout: 25000 }
    );
    await page.evaluate(() => document.querySelector('[data-su-submit]')?.click());
    const res1 = await guestPost1;
    const data1 = await res1.json();
    assert.ok(data1.ok && data1.submission, JSON.stringify(data1));
    out.guestProductId = data1.submission.productId;
    out.guestRequestId = data1.submission.requestId;

    mark(
      'اختبار إضافة منتج كزائر',
      data1.submission.ownerType === 'Guest' &&
        !!data1.submission.guestContactId &&
        !data1.submission.customerId &&
        data1.submission.ownerPhone === '+966511112233',
      JSON.stringify({
        ownerType: data1.submission.ownerType,
        guestContactId: data1.submission.guestContactId,
        customerId: data1.submission.customerId,
      })
    );
    mark(
      'بيانات صاحب المنتج محفوظة',
      data1.submission.ownerName === 'ضيف المنتج' &&
        data1.submission.ownerEmail === 'guest.product.owner@naiosh-test.com' &&
        data1.submission.ownerPhone === '+966511112233' &&
        data1.submission.ownerCompany === 'متجر تجريبي',
      JSON.stringify({
        name: data1.submission.ownerName,
        email: data1.submission.ownerEmail,
        phone: data1.submission.ownerPhone,
      })
    );
    mark(
      'Product ID',
      /^PRD-\d{4}-\d{5}$/.test(out.guestProductId || ''),
      out.guestProductId
    );
    mark(
      'Request ID',
      /^PRD-REQ-\d{4}-\d{5}$/.test(out.guestRequestId || ''),
      out.guestRequestId
    );

    // Double submit same idempotency
    const body1 = JSON.parse(res1.request().postData() || '{}');
    const dup = await api('POST', '/api/hub/product-submissions', { body: body1 });
    mark(
      'منع Double Submission',
      dup.status === 200 &&
        dup.data.duplicate === true &&
        dup.data.submission.requestId === out.guestRequestId &&
        dup.data.submission.productId === out.guestProductId,
      `status=${dup.status} dup=${dup.data.duplicate}`
    );

    await page.waitForFunction(() => /تم إرسال المنتج للمراجعة بنجاح/.test(document.body.innerText), {
      timeout: 15000,
    });

    const staffToken = `hub360.${Buffer.from('leader@naiosh.com').toString('base64')}.${Date.now()}`;
    const adminList = await api('GET', '/api/hub/product-submissions', {
      token: staffToken,
      role: 'supreme_leader',
    });
    const guestInAdmin = (adminList.data.requests || []).find((r) => r.requestId === out.guestRequestId);
    mark(
      'ظهور الطلب في الإدارة',
      adminList.status === 200 &&
        !!guestInAdmin &&
        guestInAdmin.requestType === 'Product Submission' &&
        guestInAdmin.sourceModule === 'المتجر',
      `status=${adminList.status} type=${guestInAdmin && guestInAdmin.requestType}`
    );
    mark(
      'معاينة المنتج في الإدارة',
      !!guestInAdmin &&
        guestInAdmin.ownerType === 'Guest' &&
        guestInAdmin.email === 'guest.product.owner@naiosh-test.com' &&
        guestInAdmin.phone === '+966511112233' &&
        guestInAdmin.customerName === 'ضيف المنتج' &&
        !!guestInAdmin.productSnapshot &&
        guestInAdmin.productSnapshot.title === 'منتج زائر هوية',
      guestInAdmin
        ? JSON.stringify({
            email: guestInAdmin.email,
            title: guestInAdmin.productSnapshot && guestInAdmin.productSnapshot.title,
          })
        : 'missing'
    );
    mark(
      'المرفقات',
      (data1.submission.images || []).length > 0 ||
        (guestInAdmin?.attachments || []).length > 0 ||
        (guestInAdmin?.productSnapshot?.images || []).length > 0,
      `images=${(data1.submission.images || []).length}`
    );

    // Persist via API reload
    const reloadGuest = await api('GET', `/api/hub/product-submissions/${encodeURIComponent(out.guestRequestId)}`, {
      token: staffToken,
      role: 'supreme_leader',
    });
    mark(
      'Persistence بعد Refresh',
      reloadGuest.status === 200 &&
        reloadGuest.data.submission &&
        reloadGuest.data.submission.requestId === out.guestRequestId &&
        reloadGuest.data.submission.productId === out.guestProductId,
      `status=${reloadGuest.status}`
    );

    // —— Test B: Customer ——
    const stamp = Date.now().toString(36);
    const cust = {
      fullName: 'عميل منتج',
      username: `prdcust${stamp}`.slice(0, 32),
      email: `prd.cust.${stamp}@naiosh-test.com`,
      phone: '+966533334455',
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
    await page.goto(`${BASE}/store.html#upload`, { waitUntil: 'domcontentloaded' });
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
    await fillProductWizard(page, 'منتج عميل هوية');
    await page.evaluate((phone) => {
      const p = document.querySelector('[data-su-field="ownerPhone"]');
      if (p && !p.value) {
        p.value = phone;
        p.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, cust.phone);

    const custPost = page.waitForResponse(
      (r) => /\/api\/hub\/product-submissions\/?$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST',
      { timeout: 25000 }
    );
    await page.evaluate(() => document.querySelector('[data-su-submit]')?.click());
    const resC = await custPost;
    const dataC = await resC.json();
    assert.ok(dataC.ok && dataC.submission, JSON.stringify(dataC));
    out.customerProductId = dataC.submission.productId;
    out.customerRequestId = dataC.submission.requestId;
    mark(
      'اختبار العميل المسجل',
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

    // —— Test C: Admin Approval ——
    const approve = await api(
      'POST',
      `/api/hub/product-submissions/${encodeURIComponent(out.guestRequestId)}/status`,
      {
        token: staffToken,
        role: 'supreme_leader',
        body: { status: 'published' },
      }
    );
    mark(
      'قبول ونشر المنتج',
      approve.status === 200 &&
        approve.data.ok &&
        (approve.data.submission.status === 'published' || approve.data.submission.status === 'approved') &&
        approve.data.submission.productId === out.guestProductId &&
        approve.data.submission.requestId === out.guestRequestId,
      `status=${approve.status} sub=${approve.data.submission && approve.data.submission.status}`
    );

    // Browser-side publish into store catalog (mirrors POSHA approveRequest)
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      (t) => {
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem(
          'hubUser',
          JSON.stringify({ email: 'leader@naiosh.com', role: 'supreme_leader', name: 'Leader' })
        );
        document.cookie = 'hub_session=' + encodeURIComponent(t) + '; Path=/; SameSite=Lax; Max-Age=2592000';
      },
      staffToken
    );
    await page.reload({ waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
    await page.waitForFunction(() => !!window.HubCustomerRequests && !!window.HubStore, { timeout: 20000 });
    const publishedInStore = await page.evaluate(async (reqId, productId, snap) => {
      try {
        const listRes = await fetch('/api/hub/product-submissions', {
          headers: {
            Authorization: 'Bearer ' + localStorage.getItem('hubAuthToken'),
            'X-Hub-User-Role': 'supreme_leader',
          },
        });
        const listData = await listRes.json();
        const req = (listData.requests || []).find((r) => r.requestId === reqId);
        if (req && window.HubCustomerRequests?.upsertServerProductRequest) {
          window.HubCustomerRequests.upsertServerProductRequest(req);
        }
        const approved = window.HubCustomerRequests?.approveRequest?.(reqId, 'Leader');
        const items = window.HubStore?.get?.()?.empire?.salesStore?.items || [];
        const found = items.find(
          (x) =>
            x.productId === productId ||
            x.submissionId === reqId ||
            (x.title === snap.title && Number(x.price) === Number(snap.priceUsd))
        );
        return {
          approved: !!approved,
          found: !!found,
          status: found?.status || '',
          productId: found?.productId || '',
          title: found?.title || '',
        };
      } catch (e) {
        return { error: String(e && e.message ? e.message : e) };
      }
    }, out.guestRequestId, out.guestProductId, {
      title: 'منتج زائر هوية',
      priceUsd: data1.submission.priceUsd,
    });

    await page.goto(`${BASE}/store.html`, { waitUntil: 'domcontentloaded' });
    const storeVisible = await page.evaluate((productId, title) => {
      const items = window.HubStore?.get?.()?.empire?.salesStore?.items || [];
      const found = items.find(
        (x) =>
          (x.productId === productId || x.title === title) &&
          String(x.status || '').toLowerCase() !== 'pending_review'
      );
      return {
        ok: !!found && (found.status === 'active' || found.published === true || !found.status),
        status: found?.status || '',
        productId: found?.productId || '',
      };
    }, out.guestProductId, 'منتج زائر هوية');
    mark(
      'ظهور المنتج في المتجر بعد القبول',
      (publishedInStore.found && publishedInStore.status === 'active') || storeVisible.ok,
      JSON.stringify({ publishedInStore, storeVisible })
    );

    // —— Test E: Security ——
    const steal = await api('POST', '/api/hub/product-submissions', {
      token: tokenC,
      body: {
        idempotencyKey: `tamper-prd-${Date.now()}`,
        customerId: 'CL-FAKE-OTHER',
        owner: { name: 'سارق', email: cust.email, phone: cust.phone, company: '' },
        product: {
          title: 'محاولة انتحال منتج',
          category: 'electronics',
          summary: 'محاولة',
          priceUsd: 9.99,
        },
      },
    });
    const stealGet = await api('GET', `/api/hub/product-submissions/${encodeURIComponent(out.guestRequestId)}`, {
      token: tokenC,
    });
    mark(
      'منع انتحال Customer ID',
      (steal.status === 403 && steal.data.code === 'CUSTOMER_ID_TAMPER') ||
        (steal.status === 201 &&
          steal.data.submission &&
          steal.data.submission.customerId &&
          steal.data.submission.customerId !== 'CL-FAKE-OTHER'),
      `post=${steal.status} code=${steal.data.code} cid=${steal.data.submission && steal.data.submission.customerId}`
    );
    mark(
      'عزل بيانات العملاء',
      stealGet.status === 403 || stealGet.status === 404,
      `get=${stealGet.status}`
    );

    mark(
      'Console/API Errors',
      consoleErrors.filter((e) => !/403|Failed to load resource|net::ERR/i.test(e)).length === 0,
      consoleErrors.slice(0, 3).join(' | ')
    );

    out.fixed = [
      'قسم بيانات صاحب المنتج للزائر والعميل',
      'Owner Type Customer/Guest + Guest Contact ID بدون إنشاء حساب تلقائي',
      'API /api/hub/product-submissions + Product ID / Request ID من Backend',
      'ربط طلبات المنتجات في POSHA (معاينة / قبول / طلب تعديل / رفض)',
      'منع انتحال Customer ID و Double Submission و Idempotency',
    ];

    await page.screenshot({ path: path.join(ART, 'e2e-guest-product-owner.png') }).catch(() => {});
  } catch (err) {
    out.errors.push(String(err && err.stack ? err.stack : err));
    [
      'اختبار إضافة منتج كزائر',
      'بيانات صاحب المنتج محفوظة',
      'اختبار العميل المسجل',
      'Product ID',
      'Request ID',
      'ظهور الطلب في الإدارة',
      'معاينة المنتج في الإدارة',
      'قبول ونشر المنتج',
      'ظهور المنتج في المتجر بعد القبول',
      'المرفقات',
      'Persistence بعد Refresh',
      'منع انتحال Customer ID',
      'عزل بيانات العملاء',
      'منع Double Submission',
      'Console/API Errors',
    ].forEach((k) => {
      if (!out.results[k]) out.results[k] = 'FAIL';
    });
    throw err;
  } finally {
    await browser.close().catch(() => {});
  }

  fs.writeFileSync(path.join(ART, 'e2e-guest-product-owner.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  if (Object.values(out.results).some((v) => v !== 'PASS')) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  fs.writeFileSync(
    path.join(ART, 'e2e-guest-product-owner.json'),
    JSON.stringify({ ...out, fatal: String(err && err.stack ? err.stack : err) }, null, 2)
  );
  process.exit(1);
});
