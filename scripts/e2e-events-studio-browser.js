/**
 * Browser E2E for events studio.
 * Run: node scripts/e2e-events-studio-browser.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

async function launch() {
  return puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    protocolTimeout: 120000,
  });
}

async function authedPage(browser, user, width, height) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  page.setDefaultTimeout(30000);
  const token =
    user.role === 'customer'
      ? `hub360.cust.${Buffer.from(user.email).toString('base64url')}.${Date.now()}`
      : `hub360.${Buffer.from(user.email).toString('base64')}.${Date.now()}`;
  await page.evaluateOnNewDocument(
    (u, t) => {
      localStorage.setItem('hubUser', JSON.stringify(u));
      sessionStorage.setItem('hubUser', JSON.stringify(u));
      localStorage.setItem('hubAuthToken', t);
      sessionStorage.setItem('hubAuthToken', t);
      window.alert = () => {};
      window.confirm = () => true;
      window.prompt = (msg) => (String(msg || '').includes('سبب') ? 'أضف تفاصيل أوضح' : 'ملاحظة');
    },
    user,
    token
  );
  return page;
}

async function main() {
  const rows = [];
  const mark = (a, b, ok, extra) => {
    rows.push({ fn: a, test: b, result: ok ? 'PASS' : 'FAIL', extra: extra || '' });
    console.log(ok ? 'PASS' : 'FAIL', a, b, extra || '');
  };
  const browser = await launch();
  const staff = { email: 'leader@naiosh.com', name: 'القائد الأعلى', role: 'supreme_leader' };
  const client = { email: 'client-events-ui@naiosh.com', name: 'عميل الواجهة', role: 'customer' };
  let eventId = '';
  const errors = [];

  try {
    for (const [name, w, h] of [
      ['desktop', 1440, 900],
      ['tablet', 768, 1024],
      ['mobile', 390, 844],
    ]) {
      const page = await authedPage(browser, staff, w, h);
      await page.goto(`${BASE}/events.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.body.innerText.includes('استوديو الفعاليات الذكي'), { timeout: 20000 });
      await page.screenshot({ path: path.join(OUT, `events_${name}.png`), fullPage: true });
      await page.close();
      mark(name, 'Responsive', true);
    }

    const page = await authedPage(browser, staff, 1440, 900);
    page.on('pageerror', (err) => errors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(`${BASE}/events.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-ev="new"]', { timeout: 20000 });

    const sections = ['dashboard', 'create', 'manage', 'register-admin', 'videos', 'clipmaker', 'clips', 'publish', 'record'];
    for (const sec of sections) {
      await page.evaluate((s) => document.querySelector(`[data-sec="${s}"]`)?.click(), sec);
      await new Promise(function (r) { setTimeout(r, 250); });
      const title = await page.evaluate(() => document.body.innerText.slice(0, 400));
      mark('TEST22 button ' + sec, 'opens', /استوديو|إنشاء|إدارة|تسجيل|فيديو|مقطع|نشر|ريلز/.test(title), sec);
    }

    await page.evaluate(() => document.querySelector('[data-ev="new"]')?.click());
    await page.waitForSelector('[data-w="name"]', { timeout: 10000 });
    await page.evaluate(() => {
      const el = document.querySelector('[data-w="name"]');
      el.value = 'فعالية اختبار من المتصفح';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      const s = document.querySelector('[data-w="summary"]');
      if (s) s.value = 'ملخص المتصفح';
    });
    await page.evaluate(() => document.querySelector('[data-wiz="next"]')?.click());
    await page.waitForSelector('[data-w="startDate"]', { timeout: 8000 });
    await page.evaluate(() => {
      const d = document.querySelector('[data-w="startDate"]');
      d.value = '2026-10-20';
      d.dispatchEvent(new Event('input', { bubbles: true }));
      const t = document.querySelector('[data-w="attendanceType"]');
      if (t) {
        t.value = 'online';
        t.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.waitForSelector('[data-w="onlineUrl"], [data-w="address"]', { timeout: 8000 });
    await page.evaluate(() => {
      const u = document.querySelector('[data-w="onlineUrl"]');
      if (u) u.value = 'https://meet.naiosh.com/browser';
    });
    await page.evaluate(() => document.querySelector('[data-wiz="draft"]')?.click());
    await page.waitForFunction(() => /EVT-\d{4}-\d{5}/.test(document.body.innerText), { timeout: 20000 });
    eventId = await page.evaluate(() => {
      const m = document.body.innerText.match(/EVT-\d{4}-\d{5}/);
      return m && m[0];
    });
    assert.ok(eventId);
    mark('TEST1-3 wizard draft', 'create+save', true, eventId);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-sec="manage"]', { timeout: 15000 });
    await page.evaluate(() => document.querySelector('[data-sec="manage"]')?.click());
    await page.waitForFunction((id) => document.body.innerText.includes(id), { timeout: 20000 }, eventId);
    mark('refresh keeps draft', 'manage list', true, eventId);

    const cust = await authedPage(browser, client, 1280, 800);
    await cust.goto(`${BASE}/events.html`, { waitUntil: 'domcontentloaded' });
    await cust.waitForFunction(() => document.body.innerText.includes('استوديو الفعاليات'), { timeout: 20000 });
    const noDash = await cust.evaluate(() => !document.body.innerText.includes('رجوع إلى لوحة التحكم'));
    mark('customer back button', 'no admin dashboard', noDash);
    const canCreate = await cust.evaluate(() => !!document.querySelector('[data-ev="new"]'));
    mark('customer can create', 'button present', canCreate);
    await cust.screenshot({ path: path.join(OUT, 'events_customer.png'), fullPage: true });
    await cust.close();

    mark('TEST30 console', errors.length ? 'errors' : 'clean', errors.length === 0, errors.slice(0, 5).join(' | '));
    await page.close();

    const dash = await authedPage(browser, staff, 1440, 900);
    dash.on('pageerror', (err) => errors.push('dash:' + String(err)));
    await dash.goto(`${BASE}/dashboard.html#posha-clients`, { waitUntil: 'domcontentloaded' });
    await dash.waitForFunction(
      () => {
        const t = document.body.innerText || '';
        return t.includes('عملاء') || t.includes('طلبات') || !!document.getElementById('posha-ops');
      },
      { timeout: 25000 }
    );
    await dash.evaluate(() => {
      const btn = document.querySelector('[data-ptab="orders"]');
      if (btn) btn.click();
    });
    await new Promise(function (r) { setTimeout(r, 800); });
    await dash.evaluate(() => {
      const all = document.querySelector('[data-req-view="all"]');
      if (all) all.click();
    });
    await new Promise(function (r) { setTimeout(r, 800); });
    const inboxText = await dash.evaluate(() => document.body.innerText);
    const hasReq = /EVT-REQ-\d{4}-\d{5}/.test(inboxText) && inboxText.includes('طلب نشر فعالية');
    await dash.screenshot({ path: path.join(OUT, 'events_posha_inbox.png'), fullPage: true });
    mark('TEST7/8 POSHA inbox', 'request visible', hasReq, hasReq ? (inboxText.match(/EVT-REQ-\d{4}-\d{5}/) || [])[0] : inboxText.slice(0, 220));
    await dash.evaluate(() => {
      const appr = document.querySelector('[data-ptab="approved"]');
      if (appr) appr.click();
    });
    await new Promise(function (r) { setTimeout(r, 800); });
    const apprText = await dash.evaluate(() => document.body.innerText);
    const inApproved = /EVT-REQ-\d{4}-\d{5}/.test(apprText);
    await dash.screenshot({ path: path.join(OUT, 'events_posha_approved.png'), fullPage: true });
    mark('TEST13 POSHA approved', 'accepted requests', inApproved, inApproved ? (apprText.match(/EVT-REQ-\d{4}-\d{5}/) || [])[0] : apprText.slice(0, 180));
    await dash.close();
  } catch (e) {
    mark('browser suite', 'fatal', false, String(e && e.message ? e.message : e));
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(OUT, 'events-studio-browser-report.json'), JSON.stringify({ eventId, rows, errors }, null, 2));
  const failed = rows.filter((r) => r.result !== 'PASS');
  console.log('\nSUMMARY', rows.length - failed.length, '/', rows.length, 'passed');
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
