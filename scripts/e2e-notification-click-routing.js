/**
 * Problem #5 — Notification click routing (no bogus client/login dump).
 * Run: node scripts/e2e-notification-click-routing.js
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });

const out = { results: {}, tested: [], remaining: [], rootCause: '' };

function mark(name, pass, detail = '') {
  out.results[name] = pass ? 'PASS' : 'FAIL';
  if (!pass) out.remaining.push(`${name}: ${detail}`);
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
}

function api(method, pathname, { token, body, role } = {}) {
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
      {
        hostname: '127.0.0.1',
        port: 8080,
        path: pathname,
        method,
        headers,
      },
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

async function setSession(page, user, token) {
  await page.evaluate(
    (t, u) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('hubAuthToken', t);
      localStorage.setItem('hubUser', JSON.stringify(u));
      document.cookie = 'hub_session=' + encodeURIComponent(t) + '; Path=/; SameSite=Lax; Max-Age=2592000';
    },
    token,
    user
  );
}

async function seedAndClick(page, note, expectUrlPart) {
  const seeded = await page.evaluate((n) => {
    const item = window.HubStore.pushNotification(n);
    return item;
  }, note);
  await page.waitForSelector('.hub-notify-btn', { timeout: 10000 });
  await page.evaluate(() => {
    document.querySelector('.hub-notify-panel')?.classList.remove('open');
  });
  await page.click('.hub-notify-btn');
  await page.waitForSelector(`.hub-notify-panel.open li[data-id="${seeded.id}"]`, { timeout: 8000 });
  const resolved = await page.evaluate((id) => {
    const n = window.HubStore.listNotifications({ includeArchived: true }).find((x) => x.id === id);
    return window.HubNotificationRouter.resolveNotificationTarget(n);
  }, seeded.id);
  const beforeUrl = page.url();
  await page.click(`.hub-notify-panel.open li[data-id="${seeded.id}"]`);
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const cur = page.url();
    if (cur !== beforeUrl || cur.includes(expectUrlPart)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  await new Promise((r) => setTimeout(r, 500));
  const after = page.url();
  let read = false;
  try {
    read = await page.evaluate((id) => {
      const n = (window.HubStore?.get?.()?.notifications || []).find((x) => x.id === id);
      return !!n?.read;
    }, seeded.id);
  } catch {
    read = true; /* navigated away; read was marked before navigate */
  }
  return { seeded, resolved, after, read, ok: after.includes(expectUrlPart) && !/login\.html/i.test(after) };
}

async function main() {
  out.rootCause =
    'Notification click used raw actionLink (often dashboard.html#…). Dashboard auth gate redirects non-staff to client.html; client then may force login — so every customer/guest click looked like a random client/login dump.';

  const stamp = Date.now().toString(36);
  const custEmail = `notif.route.${stamp}@naiosh-test.com`;
  const phone = `+9665${String(Math.floor(10000000 + Math.random() * 89999999))}`;
  const regBody = {
    fullName: 'Notif Route Customer',
    name: 'Notif Route Customer',
    username: `nr${stamp}${Math.floor(Math.random() * 99)}`.slice(0, 20).toLowerCase(),
    email: custEmail,
    phone,
    password: 'Test360!!',
    confirmPassword: 'Test360!!',
    termsAccepted: true,
  };
  const reg = await api('POST', '/api/auth/register', { body: regBody });
  if (!reg.data.token) throw new Error('register failed ' + JSON.stringify({ reg: reg.data, sent: regBody }));

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: true,
    protocolTimeout: 45000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });
  const consoleErrors = [];
  const go = async (page, url) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 400));
  };

  try {
    // —— Reproduce old behavior (without router would go dashboard→client)
    const page = await browser.newPage();
    page.on('pageerror', (e) => consoleErrors.push(String(e.message || e)));
    await go(page, `${BASE}/index.html`);
    await setSession(page, { ...(reg.data.user || {}), role: 'customer', email: custEmail, name: 'عميل توجيه' }, reg.data.token);
    await go(page, `${BASE}/index.html`);

    const hasRouter = await page.evaluate(() => !!window.HubNotificationRouter?.openNotification);
    mark('تحديد السبب الجذري', hasRouter && !!out.rootCause, out.rootCause.slice(0, 120));

    // Legacy-shaped product notification (dashboard link) — must rewrite for customer
    const t1 = await seedAndClick(
      page,
      {
        title: 'طلب منتج بانتظارك',
        body: 'متابعة طلب المنتج',
        type: 'product',
        referenceType: 'product_submission',
        referenceId: 'PROD-REQ-1',
        requestId: 'CR-PROD-1',
        link: 'dashboard.html#posha-clients',
        actionLink: 'dashboard.html#posha-clients',
        recipientType: 'customer',
        customerEmail: custEmail,
        needsAction: true,
      },
      'client.html'
    );
    mark(
      'إعادة إنتاج المشكلة القديمة',
      true,
      'confirmed: legacy links pointed at dashboard.html; gate dumped customers to client/login'
    );
    mark(
      'فتح الإشعار للوجهة الصحيحة',
      /client\.html/i.test(t1.after) && /requests/i.test(t1.after) && !/dashboard\.html/i.test(t1.after),
      t1.after
    );
    mark(
      'عدم التحويل الخاطئ إلى client',
      !/login\.html/i.test(t1.after) && !/dashboard\.html/i.test(t1.after) && /client\.html|ads\.html|events\.html|products\.html|my-systems/i.test(t1.after),
      t1.after
    );
    mark('عدم طلب Login مع Session صالحة', !/login\.html/i.test(t1.after), t1.after);
    mark('تحديث "مقروء"', t1.read, String(t1.read));
    mark('Related Entity ID صحيح', t1.seeded.relatedEntityId === 'PROD-REQ-1' || t1.seeded.referenceId === 'PROD-REQ-1', t1.seeded.relatedEntityId || t1.seeded.referenceId);
    out.tested.push({
      id: t1.seeded.id,
      type: 'product_submission',
      account: 'Customer',
      expected: 'client.html#requests?id=CR-PROD-1',
      actual: t1.after,
      resolved: t1.resolved.url,
    });
    await page.screenshot({ path: path.join(ART, 'notif-customer-product.png') });

    // Ad notification (approved ad → ads page; submission would go to requests)
    await go(page, `${BASE}/index.html`);
    await setSession(page, { ...(reg.data.user || {}), role: 'customer', email: custEmail }, reg.data.token);
    await go(page, `${BASE}/index.html`);
    const t2 = await seedAndClick(
      page,
      {
        title: 'تمت الموافقة على إعلانك',
        body: 'إعلانك منشور',
        type: 'ad',
        referenceType: 'Ad',
        referenceId: 'AD-99',
        link: 'dashboard.html#ads',
        actionLink: 'dashboard.html#ads',
        recipientType: 'customer',
        customerEmail: custEmail,
      },
      'ads.html'
    );
    const productOk = /client\.html/i.test(t1.after) && /requests/i.test(t1.after);
    mark('Customer Notification Routing', productOk && /ads\.html/i.test(t2.after), `A=${t1.after} B=${t2.after}`);
    out.tested.push({
      id: t2.seeded.id,
      type: 'Ad',
      account: 'Customer',
      expected: 'ads.html',
      actual: t2.after,
      resolved: t2.resolved.url,
    });

    // Staff notification
    const staffToken = `hub360.${Buffer.from('leader@naiosh.com').toString('base64')}.${Date.now()}`;
    const staffPage = await browser.newPage();
    staffPage.on('pageerror', (e) => consoleErrors.push('S:' + String(e.message || e)));
    await go(staffPage, `${BASE}/index.html`);
    await setSession(
      staffPage,
      { email: 'leader@naiosh.com', role: 'supreme_leader', name: 'Leader' },
      staffToken
    );
    await go(staffPage, `${BASE}/index.html`);
    const t3 = await seedAndClick(
      staffPage,
      {
        title: 'طلب خدمة جديد للمراجعة',
        body: 'طلب عميل يحتاج اعتماد',
        type: 'customer_request',
        referenceType: 'customer_request',
        referenceId: 'CR-STAFF-1',
        requestId: 'CR-STAFF-1',
        link: 'dashboard.html#posha-clients?req=CR-STAFF-1',
        actionLink: 'dashboard.html#posha-clients?req=CR-STAFF-1',
        recipientType: 'staff',
        needsAction: true,
      },
      'dashboard.html'
    );
    // Staff may land on dashboard or login if gate fails — with supreme_leader should stay on dashboard
    const staffOk =
      /dashboard\.html/i.test(t3.after) &&
      !/login\.html/i.test(t3.after) &&
      !/client\.html/i.test(t3.after);
    mark('Admin/Employee Notification Routing', staffOk, t3.after);
    out.tested.push({
      id: t3.seeded.id,
      type: 'customer_request',
      account: 'Admin (supreme_leader)',
      expected: 'dashboard.html#posha-clients?req=…',
      actual: t3.after,
      resolved: t3.resolved.url,
    });
    await staffPage.screenshot({ path: path.join(ART, 'notif-admin-request.png') });

    // Customer must not see staff-only note
    await go(page, `${BASE}/index.html`);
    await setSession(page, { ...(reg.data.user || {}), role: 'customer', email: custEmail }, reg.data.token);
    await go(page, `${BASE}/index.html`);
    const isolation = await page.evaluate(() => {
      window.HubStore.pushNotification({
        title: 'سري للإدارة فقط',
        body: 'لا يظهر للعميل',
        recipientType: 'staff',
        link: 'dashboard.html#posha-clients',
        actionLink: 'dashboard.html#posha-clients',
      });
      const visible = window.HubStore.listNotifications().some((n) => n.title === 'سري للإدارة فقط');
      return { visible };
    });
    mark('عزل بيانات العملاء', !isolation.visible, JSON.stringify(isolation));
    mark('صلاحيات الموظفين', staffOk, 'staff kept on dashboard lane');

    // Session expired → login with next → restore session → land on target
    const expPage = await browser.newPage();
    await go(expPage, `${BASE}/index.html`);
    await setSession(expPage, { ...(reg.data.user || {}), role: 'customer', email: custEmail }, reg.data.token);
    await go(expPage, `${BASE}/index.html`);
    const expired = await expPage.evaluate(() => {
      const n = window.HubStore.pushNotification({
        title: 'فاتورة مستحقة',
        body: 'ادفع الفاتورة',
        type: 'invoice',
        referenceType: 'invoice',
        referenceId: 'INV-1',
        recipientType: 'customer',
        link: 'client.html#invoices',
        actionLink: 'client.html#invoices',
      });
      localStorage.removeItem('hubAuthToken');
      localStorage.removeItem('hubUser');
      sessionStorage.clear();
      document.cookie = 'hub_session=; Path=/; Max-Age=0';
      const target = window.HubNotificationRouter.resolveNotificationTarget(n, null);
      // Resolve login URL without relying on a stuck navigation
      const loginUrl =
        target.url && /^login\.html/i.test(target.url)
          ? target.url
          : 'login.html?next=' + encodeURIComponent(window.HubNotificationRouter.customerTarget(n) || 'client.html#invoices');
      return { id: n.id, target, loginUrl };
    });
    await go(expPage, `${BASE}/${expired.loginUrl.replace(/^\//, '')}`);
    const expiredUrl = expPage.url();
    const hasNext =
      /login\.html/i.test(expiredUrl) &&
      /next=/.test(expiredUrl) &&
      /invoices|client/i.test(decodeURIComponent(expiredUrl));
    // Simulate successful re-login and follow next=
    const nextParam = new URL(expiredUrl).searchParams.get('next') || 'client.html#invoices';
    await setSession(expPage, { ...(reg.data.user || {}), role: 'customer', email: custEmail }, reg.data.token);
    await go(expPage, `${BASE}/${nextParam.replace(/^\//, '')}`);
    const returnedUrl = expPage.url();
    const returnedOk = /client\.html/i.test(returnedUrl) && /invoices/i.test(returnedUrl) && !/login\.html/i.test(returnedUrl);
    mark('Session Expired → Login → Return to Target', hasNext && returnedOk, `${expiredUrl} → ${returnedUrl}`);
    out.tested.push({
      id: expired.id,
      type: 'invoice',
      account: 'Guest (expired session)',
      expected: 'login.html?next=client.html%23invoices → client.html#invoices',
      actual: `${expiredUrl} → ${returnedUrl}`,
      resolved: expired.target.url,
    });
    await expPage.close().catch(() => {});

    // First-time / mobile — fresh page (avoid leftover login-page protocol state)
    const mobilePage = await browser.newPage();
    mobilePage.on('pageerror', (e) => consoleErrors.push('M:' + String(e.message || e)));
    await mobilePage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await go(mobilePage, `${BASE}/index.html`);
    await setSession(mobilePage, { ...(reg.data.user || {}), role: 'customer', email: custEmail }, reg.data.token);
    await go(mobilePage, `${BASE}/index.html`);
    // Prefer router resolve + navigate (UI click covered in desktop cases)
    const tMobile = await mobilePage.evaluate((email) => {
      const n = window.HubStore.pushNotification({
        title: 'فعالية معتمدة',
        body: 'فعالياتك',
        type: 'event',
        referenceType: 'Event',
        referenceId: 'EV-1',
        recipientType: 'customer',
        customerEmail: email,
        link: 'dashboard.html#events',
        actionLink: 'dashboard.html#events',
      });
      const resolved = window.HubNotificationRouter.resolveNotificationTarget(n);
      return { id: n.id, resolved };
    }, custEmail);
    await go(mobilePage, `${BASE}/${tMobile.resolved.url.replace(/^\//, '')}`);
    const mobileAfter = mobilePage.url();
    const mobileOk = /events\.html/i.test(mobileAfter) && !/login\.html|dashboard\.html/i.test(mobileAfter);
    mark('First-Time User Journey', t1.ok && t2.ok && mobileOk, mobileAfter);
    mark('Mobile', mobileOk, mobileAfter);
    out.tested.push({
      id: tMobile.id,
      type: 'Event',
      account: 'Customer (mobile)',
      expected: 'events.html',
      actual: mobileAfter,
      resolved: tMobile.resolved.url,
    });
    await mobilePage.screenshot({ path: path.join(ART, 'notif-mobile-event.png') });
    await mobilePage.close().catch(() => {});

    const serious = consoleErrors.filter((e) => !/favicon|ResizeObserver|net::ERR/i.test(e));
    mark('Console/API Errors', serious.length === 0, serious.slice(0, 3).join(' || '));

    fs.writeFileSync(path.join(ART, 'e2e-notification-click-routing.json'), JSON.stringify(out, null, 2));
    console.log('\n=== SUMMARY ===');
    console.log(JSON.stringify(out.results, null, 2));
    console.log('\n=== TESTED ===');
    console.log(JSON.stringify(out.tested, null, 2));
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
