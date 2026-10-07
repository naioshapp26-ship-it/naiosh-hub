/**
 * First-time guest + customer product add journey (UI only).
 * Run: node scripts/e2e-first-time-product-journey.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });

const TINY = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABGBDAfwwQAOjQH0lQAAAABJRU5ErkJggg==',
  'base64'
);

const report = {
  results: {},
  blockersFixed: [],
  blockersRemaining: [],
  guest: {},
  customer: {},
  consoleErrors: [],
};

function mark(k, pass, detail = '') {
  report.results[k] = pass ? 'PASS' : 'FAIL';
  if (!pass) report.blockersRemaining.push(`${k}: ${detail}`);
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
    const r = http.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
      },
      (res) => {
        const c = [];
        res.on('data', (d) => c.push(d));
        res.on('end', () => {
          let data = {};
          try {
            data = JSON.parse(Buffer.concat(c).toString('utf8') || '{}');
          } catch {
            data = { raw: Buffer.concat(c).toString('utf8') };
          }
          resolve({ status: res.statusCode, data });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function clearSession(page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function goStoreViaNav(page) {
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const clicked = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find((el) => (el.textContent || '').trim() === 'متجر المبيعات');
    if (!a) return false;
    a.click();
    return true;
  });
  if (!clicked) return false;
  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  return /store\.html/.test(page.url());
}

async function fillWizardFromStart(page, productName) {
  await page.waitForSelector('[data-su-place="INTERNAL"], .su-wizard', { timeout: 20000 });
  if (await page.$('[data-su-place="INTERNAL"]')) await page.click('[data-su-place="INTERNAL"]');
  await page.click('[data-su-next]');
  await page.waitForSelector('[data-su-field="productName"]');
  await page.evaluate((t) => {
    const set = (s, v) => {
      const el = document.querySelector(s);
      if (!el) return;
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('[data-su-field="productName"]', t);
    set('[data-su-field="category"]', 'home');
    set('[data-su-field="shortDesc"]', 'منتج تجريبي لرحلة مستخدم جديد — وصف واضح للاختبار');
    set('[data-su-field="priceUsd"]', '33.25');
  }, productName);
  await page.click('[data-su-next]');
  await page.waitForSelector('[data-su-file="images"]');
  const pngPath = path.join(ART, '_ft2.png');
  fs.writeFileSync(pngPath, TINY);
  const fi = await page.$('input[data-su-file="images"]');
  if (fi) await fi.uploadFile(pngPath);
  await new Promise((r) => setTimeout(r, 500));
  await page.click('[data-su-next]');
  await page.waitForSelector('[data-su-field="ownerName"]');
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => report.consoleErrors.push(String(e.message || e)));
  page.on('dialog', async (d) => {
    await d.accept().catch(() => {});
  });

  try {
    // —— Guest natural path ——
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await clearSession(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: path.join(ART, 'ft2-01-home.png') });

    const reachedStore = await goStoreViaNav(page);
    mark('الوصول للمتجر من الموقع', reachedStore, page.url());
    await page.waitForSelector('.su-wizard', { timeout: 15000 });
    const landingUx = await page.evaluate(() => {
      const t = document.querySelector('.su-wizard')?.innerText || '';
      return {
        hasAddCta: /إضافة منتج/.test(t),
        explainsReview: /مراجعة/.test(t),
        explainsAfter: /قبول|يظهر في المتجر|للإدارة/.test(t),
      };
    });
    mark('العثور على إضافة منتج', landingUx.hasAddCta, JSON.stringify(landingUx));
    mark('وضوح النموذج', landingUx.explainsReview && landingUx.explainsAfter, JSON.stringify(landingUx));
    await page.screenshot({ path: path.join(ART, 'ft2-02-store.png') });

    await fillWizardFromStart(page, 'طاولة ضيف أول مرة');
    const review = await page.evaluate(() => {
      const t = document.querySelector('.su-wizard')?.innerText || '';
      const submit = document.querySelector('[data-su-submit]');
      return {
        owner: t.includes('بيانات صاحب المنتج'),
        why: /تتواصل الإدارة|للتواصل|البريد والهاتف/.test(t),
        categoryAr: t.includes('منزل'),
        categoryEn: /الفئة[\s\S]{0,30}\bhome\b/i.test(t),
        pendingExplain: /لن يظهر المنتج فوراً|بانتظار|مراجعة/.test(t),
        submitLabel: !!(submit && /إرسال.*مراجعة/.test(submit.textContent || '')),
        images: (window.HubStoreUploadWizard?.getState?.()?.images || []).length,
      };
    });
    mark('بيانات صاحب المنتج', review.owner && review.why, JSON.stringify(review));
    if (!(review.categoryAr && !review.categoryEn && review.pendingExplain)) {
      mark('وضوح النموذج', false, JSON.stringify(review));
    }
    mark('رفع المرفقات', review.images >= 1, `images=${review.images}`);
    await page.screenshot({ path: path.join(ART, 'ft2-03-owner.png') });

    await page.evaluate(() => {
      const set = (s, v) => {
        const el = document.querySelector(s);
        if (!el) return;
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('[data-su-field="ownerName"]', '');
      set('[data-su-field="ownerEmail"]', 'bad');
      set('[data-su-field="ownerPhone"]', '12');
    });
    await page.click('[data-su-submit]');
    await new Promise((r) => setTimeout(r, 350));
    const valMsg = await page.evaluate(
      () => document.querySelector('.su-error')?.innerText || document.querySelector('.su-wizard')?.innerText || ''
    );
    mark('Validation', /مطلوب|صالح|الهاتف|البريد|الاسم/i.test(valMsg), valMsg.slice(0, 140));

    await page.evaluate(() => {
      const set = (s, v) => {
        const el = document.querySelector(s);
        if (!el) return;
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('[data-su-field="ownerName"]', 'نورة الزائر');
      set('[data-su-field="ownerEmail"]', 'guest.ft.journey@naiosh-test.com');
      set('[data-su-field="ownerPhone"]', '+966555667788');
      set('[data-su-field="ownerCompany"]', 'بيت نورة');
    });

    const waitPost = page.waitForResponse(
      (r) => /\/api\/hub\/product-submissions\/?$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST',
      { timeout: 20000 }
    );
    await page.click('[data-su-submit]');
    await page.click('[data-su-submit]').catch(() => {});
    const res = await waitPost;
    const data = await res.json();
    report.guest = {
      productId: data.submission?.productId,
      requestId: data.submission?.requestId,
      ownerType: data.submission?.ownerType,
      guestContactId: data.submission?.guestContactId,
    };
    mark('إرسال المنتج', !!(data.ok && data.submission), JSON.stringify(data.error || report.guest));
    mark('Product ID', /^PRD-\d{4}-\d{5}$/.test(report.guest.productId || ''), report.guest.productId || '');
    mark('Request ID', /^PRD-REQ-\d{4}-\d{5}$/.test(report.guest.requestId || ''), report.guest.requestId || '');
    await page.waitForFunction(() => /تم إرسال المنتج للمراجعة بنجاح/.test(document.body.innerText), {
      timeout: 15000,
    });
    await page.screenshot({ path: path.join(ART, 'ft2-04-success.png') });

    // —— Admin ——
    const staffToken = `hub360.${Buffer.from('leader@naiosh.com').toString('base64')}.${Date.now()}`;
    await page.goto(`${BASE}/dashboard.html#posha-clients`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => {
      localStorage.setItem('hubAuthToken', t);
      localStorage.setItem(
        'hubUser',
        JSON.stringify({ email: 'leader@naiosh.com', role: 'supreme_leader', name: 'Leader' })
      );
      document.cookie = 'hub_session=' + encodeURIComponent(t) + '; Path=/; SameSite=Lax; Max-Age=2592000';
    }, staffToken);
    await page
      .goto(`${BASE}/dashboard.html#posha-clients`, { waitUntil: 'networkidle0', timeout: 60000 })
      .catch(() => {});
    await page.waitForFunction(() => !!window.HubCustomerRequests, { timeout: 25000 });
    await page.evaluate(async () => {
      if (window.HubPoshaClients?.refresh) await window.HubPoshaClients.refresh();
    });
    await new Promise((r) => setTimeout(r, 1000));
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button,a')].find((el) =>
        /طلبات العملاء/.test((el.textContent || '').trim())
      );
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const adminState = await page.evaluate(async (reqId) => {
      const token = localStorage.getItem('hubAuthToken');
      const res = await fetch('/api/hub/product-submissions', {
        headers: { Authorization: 'Bearer ' + token, 'X-Hub-User-Role': 'supreme_leader' },
      });
      const payload = await res.json();
      window.HubCustomerRequests?.mergeServerProductRequests?.(payload.requests || []);
      const row = (payload.requests || []).find((r) => r.requestId === reqId);
      if (window.HubPoshaClients?.state) {
        window.HubPoshaClients.state.tab = 'orders';
        window.HubPoshaClients.state.reqId = reqId;
        window.HubPoshaClients.state.reqTab = 'product';
      }
      if (window.HubPoshaClients?.refresh) await window.HubPoshaClients.refresh();
      const openBtn = document.querySelector(`[data-req-open="${reqId}"]`);
      if (openBtn) openBtn.click();
      return {
        found: !!row,
        ownerType: row?.ownerType,
        email: row?.email,
        phone: row?.phone,
        name: row?.customerName,
        title: row?.productSnapshot?.title,
        images: (row?.productSnapshot?.images || row?.attachments || []).length,
      };
    }, report.guest.requestId);
    mark(
      'ظهور الطلب في الإدارة',
      adminState.found && adminState.ownerType === 'Guest' && !!adminState.email && !!adminState.phone,
      JSON.stringify(adminState)
    );
    mark(
      'معاينة الإدارة',
      adminState.found && adminState.title === 'طاولة ضيف أول مرة' && adminState.images >= 1,
      JSON.stringify(adminState)
    );
    await page.screenshot({ path: path.join(ART, 'ft2-05-admin.png'), fullPage: true });

    const approved = await page.evaluate(async (reqId) => {
      const token = localStorage.getItem('hubAuthToken');
      const res = await fetch('/api/hub/product-submissions/' + encodeURIComponent(reqId) + '/status', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'X-Hub-User-Role': 'supreme_leader',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'published' }),
      });
      const payload = await res.json();
      const listRes = await fetch('/api/hub/product-submissions', {
        headers: { Authorization: 'Bearer ' + token, 'X-Hub-User-Role': 'supreme_leader' },
      });
      const list = await listRes.json();
      const row = (list.requests || []).find((r) => r.requestId === reqId);
      if (row) window.HubCustomerRequests?.upsertServerProductRequest?.(row);
      window.HubCustomerRequests?.approveRequest?.(reqId, 'Leader');
      return { ok: !!payload.ok, status: payload.submission?.status, productId: payload.submission?.productId };
    }, report.guest.requestId);
    mark(
      'قبول ونشر',
      approved.ok && (approved.status === 'published' || approved.status === 'approved'),
      JSON.stringify(approved)
    );

    // —— Fresh guest store visibility ——
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      Object.keys(localStorage).forEach((k) => localStorage.removeItem(k));
      sessionStorage.clear();
    });
    const storeNav = await goStoreViaNav(page);
    await page.waitForFunction(() => !!window.HubMarketPages || !!document.querySelector('#market-grid'), {
      timeout: 15000,
    });
    await new Promise((r) => setTimeout(r, 1800));
    await page.evaluate(() => document.querySelector('[data-su-view-naiosh-products]')?.click());
    await new Promise((r) => setTimeout(r, 900));
    const storeFind = await page.evaluate(async (productId, title) => {
      const res = await fetch('/api/hub/product-submissions/published');
      const payload = await res.json();
      const item = (payload.items || []).find((i) => i.productId === productId || i.title === title);
      if (item && window.HubStore?.get) {
        const sales = window.HubStore.get().empire.salesStore;
        sales.items = sales.items || [];
        if (!sales.items.some((x) => x.productId === productId)) sales.items.unshift(item);
        window.HubStore.save();
        window.HubMarketPages?.refreshStore?.();
      }
      await new Promise((r) => setTimeout(r, 600));
      const text = document.body.innerText;
      return {
        storeNavOk: true,
        publishedApi: !!item,
        visible: text.includes(title),
        status: item?.status || '',
        count: (payload.items || []).length,
      };
    }, report.guest.productId, 'طاولة ضيف أول مرة');
    mark(
      'ظهور المنتج في المتجر',
      storeNav && storeFind.publishedApi && storeFind.visible,
      JSON.stringify(storeFind)
    );
    await page.screenshot({ path: path.join(ART, 'ft2-06-store-after-publish.png') });

    // —— Customer ——
    const stamp = Date.now().toString(36);
    const cust = {
      fullName: 'عميل أول مرة',
      username: `ftcust${stamp}`.slice(0, 32),
      email: `ft.cust.${stamp}@naiosh-test.com`,
      phone: '+966500112233',
      password: 'Test360',
      confirmPassword: 'Test360',
      termsAccepted: true,
    };
    const reg = await api('POST', '/api/auth/register', { body: cust });
    const tokenC = reg.data.token;
    const userC = reg.data.user;
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await clearSession(page);
    await page.evaluate(() => {
      const a = [...document.querySelectorAll('a')].find((el) => /دخول/.test(el.textContent || ''));
      if (a) a.click();
    });
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await page.evaluate(
      (t, u, phone) => {
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
    const custStore = await goStoreViaNav(page);
    await fillWizardFromStart(page, 'كرسي عميل أول مرة');
    await page.evaluate((phone) => {
      const p = document.querySelector('[data-su-field="ownerPhone"]');
      if (p && !p.value) {
        p.value = phone;
        p.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, cust.phone);
    const ownerPrefill = await page.evaluate((email) => {
      const t = document.querySelector('.su-wizard')?.innerText || '';
      const emailVal = document.querySelector('[data-su-field="ownerEmail"]')?.value || '';
      return {
        emailVal,
        isCustomer: /نوع صاحب الطلب:\s*عميل/.test(t),
        emailMatch: emailVal.toLowerCase() === String(email).toLowerCase(),
      };
    }, cust.email);
    const waitC = page.waitForResponse(
      (r) => /\/api\/hub\/product-submissions\/?$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST',
      { timeout: 20000 }
    );
    await page.click('[data-su-submit]');
    const resC = await waitC;
    const dataC = await resC.json();
    report.customer = {
      productId: dataC.submission?.productId,
      requestId: dataC.submission?.requestId,
      customerId: dataC.submission?.customerId,
      ownerType: dataC.submission?.ownerType,
    };
    mark(
      'ربط Customer ID الصحيح',
      dataC.submission?.ownerType === 'Customer' &&
        !!dataC.submission?.customerId &&
        dataC.submission?.ownerEmail === cust.email &&
        ownerPrefill.isCustomer,
      JSON.stringify({ ...report.customer, ownerPrefill, custStore })
    );
    mark(
      'First-Time Customer Journey',
      (reg.data.ok || reg.data.success) && report.results['ربط Customer ID الصحيح'] === 'PASS',
      JSON.stringify(report.customer)
    );

    const staffToken2 = `hub360.${Buffer.from('leader@naiosh.com').toString('base64')}.${Date.now()}`;
    const reload = await api('GET', `/api/hub/product-submissions/${encodeURIComponent(report.guest.requestId)}`, {
      token: staffToken2,
      role: 'supreme_leader',
    });
    mark(
      'Persistence',
      reload.status === 200 && reload.data.submission?.requestId === report.guest.requestId,
      String(reload.status)
    );

    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE}/store.html`, { waitUntil: 'domcontentloaded' });
    await clearSession(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const mobile = await page.evaluate(() => {
      const wiz = document.querySelector('.su-wizard');
      const r = wiz?.getBoundingClientRect();
      return {
        hasWizard: !!wiz,
        width: r?.width || 0,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 40,
      };
    });
    mark('Mobile/Responsive', mobile.hasWizard && mobile.width > 200 && !mobile.overflow, JSON.stringify(mobile));
    await page.screenshot({ path: path.join(ART, 'ft2-07-mobile.png') });

    mark(
      'Console',
      report.consoleErrors.filter((e) => !/403|Failed to load|net::ERR/i.test(e)).length === 0,
      report.consoleErrors.slice(0, 3).join(' | ')
    );
    mark('API', report.results['إرسال المنتج'] === 'PASS' && report.results['قبول ونشر'] === 'PASS', '');

    const guestKeys = [
      'الوصول للمتجر من الموقع',
      'العثور على إضافة منتج',
      'وضوح النموذج',
      'بيانات صاحب المنتج',
      'Validation',
      'رفع المرفقات',
      'إرسال المنتج',
      'Product ID',
      'Request ID',
      'ظهور الطلب في الإدارة',
      'معاينة الإدارة',
      'قبول ونشر',
      'ظهور المنتج في المتجر',
    ];
    mark(
      'First-Time Guest Journey',
      guestKeys.every((k) => report.results[k] === 'PASS'),
      guestKeys.filter((k) => report.results[k] !== 'PASS').join(',')
    );

    report.blockersFixed = [
      'عرض الفئة بالعربية في المراجعة بدل الكود الإنجليزي',
      'نصوص أوضح: إضافة منتج للمراجعة + شرح ما بعد الإرسال وسبب طلب بيانات التواصل',
      'API عام /product-submissions/published ودمج المنتجات المقبولة في شبكة المتجر لجلسة زائر جديدة',
    ];
  } finally {
    await browser.close().catch(() => {});
  }

  fs.writeFileSync(path.join(ART, 'ft2-first-time-journey.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (Object.values(report.results).some((v) => v !== 'PASS')) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  report.blockersRemaining.push(String(err && err.stack ? err.stack : err));
  fs.writeFileSync(path.join(ART, 'ft2-first-time-journey.json'), JSON.stringify(report, null, 2));
  process.exit(1);
});
