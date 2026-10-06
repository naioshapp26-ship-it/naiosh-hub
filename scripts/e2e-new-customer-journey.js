/**
 * Real E2E: brand-new customer journey on Hub 360.
 * Run: node scripts/e2e-new-customer-journey.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });

const stamp = Date.now().toString(36);
const ACCOUNT = {
  fullName: 'سالم التجريبي',
  username: `salemcust${stamp}`.slice(0, 32),
  email: `salem.e2e.${stamp}@naiosh-test.com`,
  phone: `+9665${String(Math.floor(10000000 + Math.random() * 89999999))}`,
  password: 'Test360',
};

const INDIC_RE = /[٠-٩۰-۹]/;
const ENGLISH_LEAK_RE = /\b(ONBOARDING|PENDING_APPROVAL|Active|Pending|Open|Completed|Status|Invoice|Order)\b/;
const NAV = [
  'home',
  'systems',
  'orders',
  'subscriptions',
  'wallet',
  'invoices',
  'requests',
  'complaints',
  'support',
  'notifications',
  'marketplace',
  'profile',
  'security',
];

const results = {};
const findings = [];
const report = {
  email: ACCOUNT.email,
  clientId: '',
  orderNumber: '',
  invoiceNumber: '',
  consoleErrors: [],
  networkErrors: [],
};

function mark(name, pass, problem = '', fixed = '') {
  results[name] = { result: pass ? 'PASS' : 'FAIL', problem, fixed };
}

function req(method, pathname, { token, role, name, body } = {}) {
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
    if (name) headers['X-Hub-User-Name'] = name;
    const r = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
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

async function shot(page, name) {
  try {
    await page.screenshot({ path: path.join(ART, name), fullPage: false });
  } catch {
    /* ignore */
  }
}

async function visibleText(page) {
  return page.evaluate(() => document.body ? document.body.innerText : '');
}

function scanUi(text, pageName) {
  if (INDIC_RE.test(text)) findings.push(`${pageName}: أرقام عربية هندية ظاهرة`);
  const leak = text.match(ENGLISH_LEAK_RE);
  if (leak) findings.push(`${pageName}: نص إنجليزي ظاهر (${leak[0]})`);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(25000);
  page.on('pageerror', (err) => report.consoleErrors.push(String(err.message || err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') report.consoleErrors.push(msg.text());
  });
  page.on('response', (res) => {
    const url = res.url();
    if (!url.includes('/api/')) return;
    if (res.status() >= 400) report.networkErrors.push(`${res.status()} ${url}`);
  });

  try {
    // 1. Guest homepage
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const homeText = await visibleText(page);
    const guestOk =
      /نايوش|هوب|NAIOSH/i.test(homeText) &&
      !/غرفة العمليات — نايوش هوب/.test(homeText) &&
      !/مركز التحكم العالمي/.test(homeText);
    mark('زائر — الصفحة الرئيسية', guestOk, guestOk ? '' : 'الصفحة الرئيسية لم تظهر بشكل طبيعي');
    await shot(page, 'e2e-guest-home.png');

    await page.goto(`${BASE}/products.html`, { waitUntil: 'domcontentloaded' });
    const prodGuest = await visibleText(page);
    mark('زائر — صفحات عامة', /منتج|نايوش|هوب/.test(prodGuest), /منتج|نايوش|هوب/.test(prodGuest) ? '' : 'المنتجات لا تظهر للزائر');

    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /login\.html|client\.html/i.test(location.pathname), { timeout: 15000 }).catch(() => {});
    const dashGuest = await page.evaluate(() => location.pathname);
    mark(
      'زائر — منع لوحة الإدارة',
      /login\.html/i.test(dashGuest) || /client\.html/i.test(dashGuest),
      /dashboard\.html/i.test(dashGuest) ? 'الزائر دخل لوحة الإدارة' : ''
    );

    // 2. Register via login → إنشاء حساب جديد
    await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded' });
    const createHref = await page.$eval('a[href*="create-account"]', (a) => a.getAttribute('href')).catch(() => '');
    mark('زر إنشاء حساب جديد', /create-account/.test(createHref), createHref ? '' : 'زر إنشاء حساب جديد غير موجود');
    await page.click('a[href*="create-account.html"]');
    await page.waitForSelector('#createAccountForm', { timeout: 15000 });

    await page.type('#fullName', ACCOUNT.fullName);
    await page.type('#username', ACCOUNT.username);
    await page.type('#email', ACCOUNT.email);
    await page.type('#phone', ACCOUNT.phone);
    await page.type('#password', ACCOUNT.password);
    await page.type('#confirmPassword', ACCOUNT.password);
    await page.click('#termsAccepted');
    await shot(page, 'e2e-create-account-form.png');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
      page.click('#createAccountBtn'),
    ]);
    await page.waitForFunction(
      () => /client\.html/i.test(location.pathname) || document.querySelector('#successPanel:not(.hidden)'),
      { timeout: 20000 }
    ).catch(() => {});
    if (!/client\.html/i.test(page.url())) {
      await page.waitForFunction(() => /client\.html/i.test(location.pathname), { timeout: 12000 }).catch(() => {});
    }
    const registered = /client\.html/i.test(page.url());
    mark('إنشاء عميل جديد', registered, registered ? '' : `لم يتم التحويل لمركز العميل: ${page.url()}`);
    mark('تسجيل الدخول', registered, registered ? '' : 'فشل توجيه العميل بعد إنشاء الحساب');

    const session = await page.evaluate(() => {
      const raw = localStorage.getItem('hubUser') || sessionStorage.getItem('hubUser');
      return {
        token: localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || '',
        user: raw ? JSON.parse(raw) : null,
      };
    });
    mark(
      'عدم إنشاء رقم موظف',
      !session.user?.employeeNo,
      session.user?.employeeNo ? `ظهر رقم موظف ${session.user.employeeNo}` : ''
    );
    mark(
      'دور العميل فقط',
      String(session.user?.role) === 'customer',
      session.user?.role ? `role=${session.user.role}` : 'لا توجد جلسة'
    );

    await page.waitForSelector('#cp-root', { timeout: 15000 });
    await page.waitForFunction(() => {
      const t = document.body.innerText || '';
      return t.includes('رقم العميل') || t.includes('مرحبًا');
    }, { timeout: 15000 }).catch(() => {});
    await shot(page, 'e2e-new-client-home.png');
    const homeClient = await visibleText(page);
    report.firstScreen = homeClient.slice(0, 2500);

    const leakOther =
      /أحمد العميل|client@naiosh\.com|NAI-CLIENT-001|مؤسسة تجريبية/.test(homeClient);
    mark('عدم ظهور بيانات عميل آخر', !leakOther, leakOther ? 'ظهرت بيانات العميل التجريبي' : '');

    const clientIdMatch = homeClient.match(/رقم العميل:\s*(CL-[A-Z0-9]+)/);
    report.clientId = clientIdMatch ? clientIdMatch[1] : '';
    mark('إنشاء رقم العميل', !!report.clientId, report.clientId ? '' : 'رقم العميل غير ظاهر');

    const emptyOk =
      /لا توجد طلبات حتى الآن|لا توجد طلبات/.test(homeClient) &&
      /ليس لديك أنظمة مفعلة حتى الآن|لا أنظمة/.test(homeClient);
    const fakeFill = /ORD-202|INV-00|450 نقطة|نايوش إي آر بي/.test(homeClient) && leakOther;
    mark(
      'صفحة العميل الجديدة',
      emptyOk && !fakeFill && /مرحبًا/.test(homeClient),
      emptyOk ? '' : 'حالات فارغة غير واضحة أو بيانات وهمية'
    );
    scanUi(homeClient, 'home');

    // Isolation API
    const token = session.token;
    const adminClients = await req('GET', '/api/admin/clients', { token, role: 'customer' });
    const adminPosha = await req('GET', '/api/admin/posha/clients', { token, role: 'customer' });
    const homeApi = await req('GET', '/api/client/home?client_id=CL-FAKE999', { token, role: 'customer' });
    const ownEmail = String(homeApi.data?.home?.welcome?.name || '').includes(ACCOUNT.fullName.split(' ')[0]);
    const otherOrder = await req('GET', '/api/hub/product-orders/ORD-1999-99999', { token, role: 'customer' });
    const isolationPass =
      adminClients.status === 403 &&
      adminPosha.status === 403 &&
      homeApi.status === 200 &&
      String(homeApi.data?.home?.welcome?.clientId || '') === report.clientId &&
      otherOrder.status >= 400;
    mark(
      'عزل بيانات العملاء',
      isolationPass,
      isolationPass
        ? ''
        : `admin=${adminClients.status}/${adminPosha.status} home=${homeApi.status} otherOrder=${otherOrder.status}`
    );
    mark('عزل بيانات العملاء API', isolationPass, isolationPass ? '' : 'API لم يرفض سجلات الآخرين');

    // 5. Purchase
    await page.goto(`${BASE}/products.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('a[href*="checkout.html?product="], [data-buy-now]', { timeout: 15000 });
    const productsText = await visibleText(page);
    mark('عرض المنتجات', /وحدة نايوش|منتج|إي آر بي|نايوش/.test(productsText), /نايوش/.test(productsText) ? '' : 'كتالوج المنتجات فارغ');
    await shot(page, 'e2e-products.png');

    const buy = await page.$('a[href*="checkout.html?product=pr-erp-1"]') || await page.$('a[href*="checkout.html?product="]');
    assert.ok(buy, 'لا يوجد زر شراء');
    await buy.click();
    await page.waitForFunction(() => /checkout\.html/i.test(location.pathname), { timeout: 10000 });
    await page.waitForSelector('#co-product-name', { timeout: 10000 });
    const productName = await page.$eval('#co-product-name', (el) => el.textContent.trim());
    mark('اختيار منتج', productName.length > 2, productName ? '' : 'تفاصيل المنتج لم تظهر');

    await page.click('[data-panel="1"] [data-co-next]');
    await page.waitForSelector('[data-panel="2"]:not([hidden])', { timeout: 8000 });
    const emailVal = await page.$eval('#co-email', (el) => el.value).catch(() => '');
    if (emailVal && emailVal !== ACCOUNT.email) {
      findings.push(`البريد في الدفع=${emailVal}`);
    }
    const nameInput = await page.$('#co-name');
    if (nameInput) {
      const current = await page.$eval('#co-name', (el) => el.value);
      if (!current) await page.type('#co-name', ACCOUNT.fullName);
    }
    const phoneInput = await page.$('#co-phone');
    if (phoneInput) {
      const current = await page.$eval('#co-phone', (el) => el.value);
      if (!current) await page.type('#co-phone', ACCOUNT.phone);
    }
    await page.click('[data-panel="2"] [data-co-next]');
    await page.waitForSelector('[data-panel="3"]:not([hidden])', { timeout: 8000 });
    const terms = await page.$('#co-terms');
    if (terms) await page.click('#co-terms');
    await page.click('[data-panel="3"] [data-co-next]');
    await page.waitForSelector('[data-panel="4"]:not([hidden])', { timeout: 8000 });
    await shot(page, 'e2e-checkout-pay.png');
    await page.click('#co-pay-confirm');
    await page.waitForSelector('[data-panel="5"]:not([hidden])', { timeout: 20000 });
    const confirmText = await visibleText(page);
    const orderMatch = confirmText.match(/ORD-\d{4}-\d+/);
    report.orderNumber = orderMatch ? orderMatch[0] : '';
    mark('إنشاء طلب', !!report.orderNumber || /طلب/.test(confirmText), report.orderNumber ? '' : 'لم يظهر رقم الطلب بعد الدفع التجريبي');
    await shot(page, 'e2e-checkout-done.png');

    // 6. Back to client portal
    await page.goto(`${BASE}/client.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#cp-root', { timeout: 15000 });
    await page.waitForFunction(() => (document.body.innerText || '').includes('مرحبًا'), { timeout: 15000 }).catch(() => {});
    const homeAfter = await visibleText(page);
    const orderOnHome = report.orderNumber ? homeAfter.includes(report.orderNumber) : /ORD-/.test(homeAfter);
    mark('ظهور الطلب في حساب العميل', orderOnHome, orderOnHome ? '' : 'الطلب لا يظهر في الرئيسية');

    await page.evaluate(() => {
      location.hash = 'orders';
    });
    await page.waitForFunction(() => (document.body.innerText || '').includes('طلباتي') || (document.body.innerText || '').includes('ORD-'), { timeout: 10000 }).catch(() => {});
    const ordersText = await visibleText(page);
    mark('طلبات العميل', /ORD-/.test(ordersText) && !/أحمد العميل/.test(ordersText), /ORD-/.test(ordersText) ? '' : 'صفحة الطلبات فارغة بعد الشراء');
    scanUi(ordersText, 'orders');
    await shot(page, 'e2e-client-orders.png');

    await page.evaluate(() => {
      location.hash = 'invoices';
    });
    await page.waitForFunction(() => (document.body.innerText || '').includes('فاتورة') || (document.body.innerText || '').includes('INV-'), { timeout: 10000 }).catch(() => {});
    const invText = await visibleText(page);
    const invMatch = invText.match(/INV-[A-Z0-9-]+/);
    report.invoiceNumber = invMatch ? invMatch[0] : '';
    mark('الفاتورة', !!report.invoiceNumber || /فاتورة/.test(invText), report.invoiceNumber ? '' : 'الفاتورة لا تظهر');
    await shot(page, 'e2e-client-invoices.png');

    // Sidebar pages
    const pageFails = [];
    for (const id of NAV) {
      await page.evaluate((p) => {
        location.hash = p;
      }, id);
      await new Promise((r) => setTimeout(r, 400));
      const crashed = await page.evaluate(() => /تعذر تحميل الصفحة/.test(document.body.innerText || ''));
      const t = await visibleText(page);
      if (crashed) pageFails.push(id);
      if (/أحمد العميل|client@naiosh\.com/.test(t) && id !== 'marketplace') pageFails.push(`${id}:other-data`);
      scanUi(t, id);
      await shot(page, `e2e-nav-${id}.png`);
    }
    mark('الاشتراكات', !pageFails.includes('subscriptions'), pageFails.includes('subscriptions') ? 'انهارت صفحة الاشتراكات' : '');
    mark('المحفظة', !pageFails.includes('wallet'), pageFails.includes('wallet') ? 'انهارت صفحة المحفظة' : '');
    mark('الدعم', !pageFails.includes('support'), pageFails.includes('support') ? 'انهارت صفحة الدعم' : '');
    mark('الإشعارات', !pageFails.includes('notifications'), pageFails.includes('notifications') ? 'انهارت صفحة الإشعارات' : '');
    mark('الحساب', !pageFails.includes('profile'), pageFails.includes('profile') ? 'انهارت صفحة الحساب' : '');
    mark('الأمان', !pageFails.includes('security'), pageFails.includes('security') ? 'انهارت صفحة الأمان' : '');

    // Logo
    const brand = await page.$eval('a.cp-brand', (a) => ({
      href: a.getAttribute('href'),
      target: a.getAttribute('target'),
    }));
    const logoOk = /^https:\/\/www\.naioshai\.com\/?$/.test(String(brand.href || '').trim()) && !brand.target;
    mark('الشعار ← الصفحة الرئيسية', logoOk, logoOk ? '' : `href=${brand.href} target=${brand.target}`);

    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    const stillIn = await page.evaluate(() => {
      const raw = localStorage.getItem('hubUser') || sessionStorage.getItem('hubUser');
      const token = localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken');
      const btn = document.querySelector('header.top-nav .auth-actions a.auth-btn');
      return {
        token: !!token,
        user: raw ? JSON.parse(raw) : null,
        authLabel: btn ? btn.textContent.trim() : '',
        authHref: btn ? btn.getAttribute('href') : '',
      };
    });
    mark(
      'استمرار تسجيل الدخول',
      stillIn.token && stillIn.user?.email === ACCOUNT.email,
      stillIn.token ? '' : 'ضاعت الجلسة بعد العودة للرئيسية'
    );

    if (stillIn.authHref) {
      await page.click('header.top-nav .auth-actions a.auth-btn');
      await page.waitForFunction(() => /client\.html|login\.html/i.test(location.pathname), { timeout: 10000 }).catch(() => {});
    } else {
      await page.goto(`${BASE}/client.html`, { waitUntil: 'domcontentloaded' });
    }
    const backPortal = /client\.html/i.test(page.url());
    mark('حسابي من الرئيسية', backPortal, backPortal ? '' : `وصل إلى ${page.url()}`);

    // Admin block while logged in as customer
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /client\.html/i.test(location.pathname), { timeout: 12000 }).catch(() => {});
    const blocked = /client\.html/i.test(page.url());
    await new Promise((r) => setTimeout(r, 500));
    const denyText = await visibleText(page);
    const toastText = await page.evaluate(() => {
      const el = document.getElementById('cp-toast');
      return el ? el.textContent : '';
    });
    mark(
      'منع العميل من لوحة الإدارة',
      blocked && (/ليس لديك صلاحية/.test(denyText + toastText) || blocked),
      blocked ? '' : 'العميل دخل لوحة الإدارة'
    );

    const db = await req('GET', '/api/client/me', { token, role: 'customer' });
    const dbClient = db.data?.client || {};
    if (!report.clientId) report.clientId = dbClient.clientId || '';
    mark(
      'قاعدة البيانات — عميل فقط',
      db.status === 200 && dbClient.email === ACCOUNT.email && !dbClient.employeeNo,
      dbClient.email === ACCOUNT.email ? '' : 'سجل العميل غير مطابق'
    );

    const latinFail = findings.some((f) => f.includes('أرقام عربية'));
    const arFail = findings.some((f) => f.includes('نص إنجليزي'));
    mark('اللغة العربية', !arFail, arFail ? findings.filter((f) => f.includes('إنجليزي')).join(' | ') : '');
    mark('الأرقام الإنجليزية', !latinFail, latinFail ? findings.filter((f) => f.includes('أرقام')).join(' | ') : '');

    const seriousNet = report.networkErrors.filter((e) => !/404/.test(e) && !/ORD-1999/.test(e) && !/admin\//.test(e));
    const seriousCon = report.consoleErrors.filter((e) => !/favicon|Failed to load resource/i.test(e));
    mark('Console/API', seriousNet.length === 0 && seriousCon.length === 0, [...seriousNet, ...seriousCon].slice(0, 6).join(' | '));
  } finally {
    await browser.close().catch(() => {});
  }

  const out = {
    account: ACCOUNT,
    report,
    results,
    findings,
  };
  fs.writeFileSync(path.join(ART, 'e2e-new-customer-report.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  const failed = Object.entries(results).filter(([, v]) => v.result !== 'PASS');
  if (failed.length) {
    console.error('FAILED:', failed.map(([k, v]) => `${k}: ${v.problem}`).join('\n'));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
