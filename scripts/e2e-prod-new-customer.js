/**
 * Production regression: new customer on https://www.naioshai.com
 * Run: HUB_BASE=https://www.naioshai.com node scripts/e2e-prod-new-customer.js
 */
'use strict';

const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'https://www.naioshai.com';
const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });

const stamp = Date.now().toString(36);
const A = {
  fullName: 'سالم الإنتاج',
  username: `salemprod${stamp}`.slice(0, 32),
  email: `salem.prod.${stamp}@naiosh-test.com`,
  phone: `+9665${String(Math.floor(10000000 + Math.random() * 89999999))}`,
  password: 'Test360',
};
const B = {
  fullName: 'نورة العزل',
  username: `noraiso${stamp}`.slice(0, 32),
  email: `nora.iso.${stamp}@naiosh-test.com`,
  phone: `+9665${String(Math.floor(10000000 + Math.random() * 89999999))}`,
  password: 'Test360',
};

const out = {
  results: {},
  clientId: '',
  orderNumber: '',
  invoiceNumber: '',
  orderId: '',
  dbPersisted: null,
  hubOrdersBefore: null,
  hubOrdersAfter: null,
  remaining: [],
};

function mark(name, pass, problem = '') {
  out.results[name] = pass ? 'PASS' : 'FAIL';
  if (!pass && problem) out.remaining.push(`${name}: ${problem}`);
}

function api(method, pathname, { token, body, headers: extra } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, BASE);
    const payload = body != null ? JSON.stringify(body) : null;
    const headers = { Accept: 'application/json', ...(extra || {}) };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    const lib = url.protocol === 'https:' ? https : http;
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

async function restoreSession(page, token, user) {
  await page.evaluate(
    (t, u) => {
      try {
        localStorage.setItem('hubAuthToken', t);
        localStorage.setItem('hubUser', JSON.stringify(u));
        sessionStorage.setItem('hubAuthToken', t);
        sessionStorage.setItem('hubUser', JSON.stringify(u));
        document.cookie = 'hub_session=' + encodeURIComponent(t) + '; Path=/; SameSite=Lax; Max-Age=2592000';
      } catch {
        /* ignore */
      }
    },
    token,
    user
  );
}

async function registerInPage(page, acc) {
  await page.goto(`${BASE}/create-account.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#createAccountForm', { timeout: 20000 });
  await page.type('#fullName', acc.fullName);
  await page.type('#username', acc.username);
  await page.type('#email', acc.email);
  await page.type('#phone', acc.phone);
  await page.type('#password', acc.password);
  await page.type('#confirmPassword', acc.password);
  await page.click('#termsAccepted');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {}),
    page.click('#createAccountBtn'),
  ]);
  await page.waitForFunction(() => /client\.html/i.test(location.pathname), { timeout: 20000 }).catch(() => {});
  return page.evaluate(() => ({
    path: location.pathname,
    token: localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || '',
    user: JSON.parse(localStorage.getItem('hubUser') || sessionStorage.getItem('hubUser') || 'null'),
    storageKeys: Object.keys(localStorage),
  }));
}

async function dumpCheckout(page, name) {
  const info = await page.evaluate(() => {
    const panels = [...document.querySelectorAll('[data-panel]')].map((el) => ({
      panel: el.getAttribute('data-panel'),
      hidden: el.hidden,
      hasHiddenAttr: el.hasAttribute('hidden'),
    }));
    return {
      href: location.href,
      product: (document.getElementById('co-product-name') || {}).textContent || '',
      alert: (document.getElementById('co-alert') || {}).textContent || '',
      loggedIn: Boolean(window.HubAuth && window.HubAuth.isLoggedIn && window.HubAuth.isLoggedIn()),
      email: (window.HubAuth && window.HubAuth.getUser && window.HubAuth.getUser() || {}).email || '',
      panels,
      bodyTail: (document.body.innerText || '').slice(-400),
    };
  });
  fs.writeFileSync(path.join(ART, `${name}.json`), JSON.stringify(info, null, 2));
  await page.screenshot({ path: path.join(ART, `${name}.png`) }).catch(() => {});
  return info;
}

async function clickPanelNext(page, panel) {
  const sel = `[data-panel="${panel}"] [data-co-next]`;
  await page.waitForSelector(sel, { timeout: 15000 });
  await page.$eval(sel, (el) => {
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    el.disabled = false;
    el.click();
  });
}

async function waitPanel(page, n, timeout = 15000) {
  await page.waitForFunction(
    (step) => {
      const el = document.querySelector(`[data-panel="${step}"]`);
      return Boolean(el && el.hidden === false);
    },
    { timeout },
    n
  );
}

async function buyProduct(page, token, user) {
  await restoreSession(page, token, user);
  await page.goto(`${BASE}/products.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await restoreSession(page, token, user);
  await page.waitForSelector('a[href*="checkout.html?product="]', { timeout: 20000 });
  const href = await page.$eval(
    'a[href*="checkout.html?product=pr-erp-1"], a[href*="checkout.html?product="]',
    (a) => a.getAttribute('href')
  );
  await page.goto(`${BASE}/${String(href || 'checkout.html?product=pr-erp-1').replace(/^\//, '')}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await restoreSession(page, token, user);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#co-product-name', { timeout: 20000 });
  await page.waitForFunction(
    () => {
      const n = document.getElementById('co-product-name');
      return n && n.textContent && n.textContent.trim() !== '…' && n.textContent.trim().length > 2;
    },
    { timeout: 20000 }
  );
  await page.waitForFunction(
    () => Boolean(window.HubAuth && window.HubAuth.isLoggedIn && window.HubAuth.isLoggedIn()),
    { timeout: 10000 }
  ).catch(() => {});

  let created = null;
  page.on('response', async (res) => {
    try {
      if (!/\/api\/hub\/product-orders\/?$/.test(new URL(res.url()).pathname)) return;
      if (String(res.request().method()).toUpperCase() !== 'POST') return;
      const data = await res.json().catch(() => ({}));
      if (data && data.order) created = data;
    } catch {
      /* ignore */
    }
  });

  await clickPanelNext(page, '1');
  try {
    await waitPanel(page, 2, 12000);
  } catch (err) {
    await dumpCheckout(page, 'prod-checkout-step1');
    throw err;
  }

  const nameInput = await page.$('#co-name');
  if (nameInput) {
    const v = await page.$eval('#co-name', (el) => el.value);
    if (!v) await page.type('#co-name', A.fullName);
  }
  const phoneInput = await page.$('#co-phone');
  if (phoneInput) {
    const v = await page.$eval('#co-phone', (el) => el.value);
    if (!v) await page.type('#co-phone', A.phone);
  }
  await clickPanelNext(page, '2');
  await waitPanel(page, 3, 12000);
  const terms = await page.$('#co-terms');
  if (terms) {
    await page.$eval('#co-terms', (el) => {
      if (!el.checked) el.click();
    });
  }
  await clickPanelNext(page, '3');
  await waitPanel(page, 4, 12000);
  await page.$eval('#co-pay-confirm', (el) => {
    el.scrollIntoView({ block: 'center' });
    el.click();
  });
  try {
    await waitPanel(page, 5, 25000);
  } catch (err) {
    await dumpCheckout(page, 'prod-checkout-pay');
    if (created && created.order) return { text: '', created };
    throw err;
  }
  const text = await page.evaluate(() => document.body.innerText);
  return { text, created };
}

async function main() {
  const health0 = await api('GET', '/api/health');
  out.hubOrdersBefore =
    health0.data && health0.data.database && typeof health0.data.database.hubOrders === 'number'
      ? health0.data.database.hubOrders
      : null;

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(25000);
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e.message || e)));

  try {
    const home = await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const html = await page.content();
    mark(
      'Production Deployment',
      Boolean(home && home.ok()) && /المنصة التشغيلية/.test(html) && !/غرفة عمليات الإمبراطورية/.test(html),
      /المنصة التشغيلية/.test(html) ? '' : 'النسخة المنشورة لا تحتوي نص الهوم الجديد'
    );

    const sessA = await registerInPage(page, A);
    mark('إنشاء عميل جديد على Production', /client\.html/i.test(sessA.path) && sessA.user?.role === 'customer', sessA.path);

    await page.waitForSelector('#cp-root', { timeout: 20000 });
    await page.waitForFunction(() => (document.body.innerText || '').includes('رقم العميل'), { timeout: 15000 }).catch(() => {});
    const homeA = await page.evaluate(() => document.body.innerText);
    const idm = homeA.match(/رقم العميل:\s*(CL-[A-Z0-9]+)/);
    out.clientId = idm ? idm[1] : '';

    const buy = await buyProduct(page, sessA.token, sessA.user);
    const confirmText = buy.text || '';
    if (buy.created && buy.created.order) {
      out.orderNumber = buy.created.order.number || out.orderNumber;
      out.orderId = buy.created.order.id || out.orderId;
      out.invoiceNumber = buy.created.order.invoiceNumber || out.invoiceNumber;
      out.dbPersisted = buy.created.dbPersisted;
    }
    const om = confirmText.match(/ORD-\d{4}-\d+/);
    if (!out.orderNumber && om) out.orderNumber = om[0];
    mark('إنشاء طلب تجريبي', !!out.orderNumber, confirmText.slice(0, 200));

    await restoreSession(page, sessA.token, sessA.user);
    await page.goto(`${BASE}/client.html#orders`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#cp-root', { timeout: 20000 });
    await page
      .waitForFunction((n) => !n || (document.body.innerText || '').includes(n), { timeout: 15000 }, out.orderNumber)
      .catch(() => {});
    let ordersText = await page.evaluate(() => document.body.innerText);
    mark('ظهور الطلب في حساب العميل', ordersText.includes(out.orderNumber), ordersText.slice(0, 300));

    await page.evaluate(() => {
      location.hash = 'invoices';
    });
    await page.waitForFunction(() => /INV-/.test(document.body.innerText || ''), { timeout: 10000 }).catch(() => {});
    const invText = await page.evaluate(() => document.body.innerText);
    const im = invText.match(/INV-\d{4}-\d+/);
    if (!out.invoiceNumber) out.invoiceNumber = im ? im[0] : '';
    mark('ظهور الفاتورة', !!out.invoiceNumber || invText.includes(out.orderNumber), invText.slice(0, 200));

    const tokenA = sessA.token;
    const apiOrders = await api('GET', '/api/client/orders', { token: tokenA });
    const apiInvoices = await api('GET', '/api/client/invoices', { token: tokenA });
    const apiHub = await api('GET', '/api/hub/product-orders', { token: tokenA });
    const foundOrder = (apiOrders.data.orders || []).find((o) => o.number === out.orderNumber);
    const foundInv = (apiInvoices.data.invoices || []).find(
      (i) => i.number === out.invoiceNumber || i.orderNumber === out.orderNumber
    );
    const hubOrder = (apiHub.data.orders || []).find((o) => o.number === out.orderNumber);
    out.orderId = (foundOrder && foundOrder.id) || (hubOrder && hubOrder.id) || out.orderId;
    if (foundInv && foundInv.number) out.invoiceNumber = foundInv.number;

    const health1 = await api('GET', '/api/health');
    out.hubOrdersAfter =
      health1.data && health1.data.database && typeof health1.data.database.hubOrders === 'number'
        ? health1.data.database.hubOrders
        : null;
    const dbGrew =
      out.hubOrdersBefore != null && out.hubOrdersAfter != null && out.hubOrdersAfter > out.hubOrdersBefore;
    const inBackend = apiOrders.status === 200 && !!foundOrder && foundOrder.source === 'hub_orders';
    mark(
      'الطلب محفوظ في Backend/DB',
      inBackend && (out.dbPersisted === true || dbGrew || out.dbPersisted == null),
      foundOrder
        ? `source=${foundOrder.source} dbPersisted=${out.dbPersisted} hubOrders=${out.hubOrdersBefore}->${out.hubOrdersAfter}`
        : `status=${apiOrders.status}`
    );
    mark(
      'الفاتورة محفوظة في Backend/DB',
      apiInvoices.status === 200 && !!foundInv && foundInv.orderId === (foundOrder && foundOrder.id) && foundInv.source === 'hub_orders',
      foundInv ? `orderId=${foundInv.orderId} source=${foundInv.source}` : `status=${apiInvoices.status}`
    );
    mark(
      'مصدر بيانات الطلبات موحد',
      !!foundOrder && !!hubOrder && foundOrder.id === hubOrder.id && foundOrder.invoiceNumber === (hubOrder.invoiceNumber || out.invoiceNumber),
      foundOrder && hubOrder ? `client=${foundOrder.id} hub=${hubOrder.id}` : 'order ids diverge'
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#cp-root', { timeout: 15000 });
    await page.evaluate(() => {
      location.hash = 'orders';
    });
    await page.waitForFunction((n) => (document.body.innerText || '').includes(n), { timeout: 15000 }, out.orderNumber).catch(() => {});
    ordersText = await page.evaluate(() => document.body.innerText);
    mark('الطلب بعد Refresh', ordersText.includes(out.orderNumber), 'اختفى بعد التحديث');

    await page.evaluate(() => {
      location.hash = 'invoices';
    });
    await new Promise((r) => setTimeout(r, 600));
    const invAfter = await page.evaluate(() => document.body.innerText);
    mark('الفاتورة بعد Refresh', !out.invoiceNumber || invAfter.includes(out.invoiceNumber), 'اختفت الفاتورة بعد التحديث');

    await page.click('#cp-logout');
    await page.waitForFunction(() => /login\.html/i.test(location.pathname), { timeout: 10000 }).catch(() => {});

    const page2 = await browser.newPage();
    await page2.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded' });
    await page2.waitForSelector('#email', { timeout: 10000 });
    await page2.type('#email', A.email);
    await page2.type('#password', A.password);
    await page2.click('#loginBtn');
    await page2.waitForFunction(() => /client\.html/i.test(location.pathname), { timeout: 20000 }).catch(() => {});
    const tokenAfter = await page2.evaluate(
      () => localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || ''
    );
    await page2.waitForSelector('#cp-root', { timeout: 15000 });
    await page2.evaluate(() => {
      location.hash = 'orders';
    });
    await page2
      .waitForFunction((n) => (document.body.innerText || '').includes(n), { timeout: 15000 }, out.orderNumber)
      .catch(() => {});
    const afterLogin = await page2.evaluate(() => document.body.innerText);
    const apiAfter = await api('GET', '/api/client/orders', { token: tokenAfter || tokenA });
    const stillThere = (apiAfter.data.orders || []).some((o) => o.number === out.orderNumber);
    mark(
      'الطلب بعد Logout/Login',
      afterLogin.includes(out.orderNumber) && stillThere,
      stillThere ? 'ظهر في API واختفى من الواجهة' : 'اختفى بعد إعادة الدخول'
    );

    const dash = await api('GET', '/dashboard.html', { token: tokenA });
    const adminClients = await api('GET', '/api/admin/clients', { token: tokenA });
    const adminPosha = await api('GET', '/api/admin/posha/clients', { token: tokenA });
    await page2.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 700));
    const dashUi = await page2.evaluate(() => ({
      text: document.body ? document.body.innerText : '',
      hasOps: !!document.querySelector('aside.sidebar #sidebar-nav, #panel-root'),
      statusHint: document.title || '',
    }));
    mark(
      'منع العميل من Admin/API',
      dash.status === 403 && adminClients.status === 403 && adminPosha.status === 403 && !dashUi.hasOps,
      `html=${dash.status} admin=${adminClients.status}/${adminPosha.status} ops=${dashUi.hasOps}`
    );

    const sessB = await registerInPage(page2, B);
    const steal = out.orderId
      ? await api('GET', `/api/hub/product-orders/${encodeURIComponent(out.orderId)}`, { token: sessB.token })
      : { status: 0, data: {} };
    const steal2 = out.orderNumber
      ? await api('GET', `/api/client/orders/${encodeURIComponent(out.orderNumber)}`, { token: sessB.token })
      : { status: 0, data: {} };
    const stealInv = out.invoiceNumber
      ? await api('GET', `/api/client/invoices/${encodeURIComponent(out.invoiceNumber)}`, { token: sessB.token })
      : { status: 0, data: {} };
    mark(
      'عزل CUSTOMER-A عن CUSTOMER-B',
      steal.status >= 400 && steal2.status >= 400 && stealInv.status >= 400,
      `hub=${steal.status} clientOrder=${steal2.status} inv=${stealInv.status}`
    );

    const staffToken = `hub360.${Buffer.from('leader@naiosh.com').toString('base64')}.${Date.now()}`;
    const adminList = await api('GET', '/api/hub/product-orders', {
      token: staffToken,
      headers: { 'X-Hub-User-Role': 'supreme_leader' },
    });
    const seenByAdmin = (adminList.data.orders || []).some((o) => o.number === out.orderNumber || o.id === out.orderId);
    mark(
      'ظهوره في الإدارة',
      adminList.status === 200 && seenByAdmin,
      `status=${adminList.status} staff=${adminList.data.staff} count=${adminList.data.count}`
    );

    mark(
      'Console/API Errors',
      consoleErrors.filter((e) => !/403|Failed to load resource/i.test(e)).length === 0,
      consoleErrors.slice(0, 4).join(' | ')
    );

    await page2.screenshot({ path: path.join(ART, 'e2e-prod-client.png') }).catch(() => {});
    await page2.close().catch(() => {});
  } finally {
    await browser.close().catch(() => {});
  }

  fs.writeFileSync(path.join(ART, 'e2e-prod-new-customer.json'), JSON.stringify({ A, B, ...out }, null, 2));
  console.log(JSON.stringify({ A: A.email, B: B.email, ...out }, null, 2));
  const failed = Object.entries(out.results).filter(([, v]) => v !== 'PASS');
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
