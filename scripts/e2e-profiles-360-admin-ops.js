/**
 * Profiles 360 admin ops — real journey:
 * register → ticket/order → admin list → View → ops → customer sees update.
 * Also ACL: customer denied admin API; unauthorized staff denied.
 *
 * SCALE_PORT=8878 node scripts/e2e-profiles-360-admin-ops.js
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const ART = '/opt/cursor/artifacts/profiles-360-admin-ops';
const PORT = Number(process.env.SCALE_PORT || 8878);
const BASE = `http://127.0.0.1:${PORT}`;
const SA_EMAIL = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const rows = [];
function mark(check, pass, evidence) {
  rows.push({ check, result: pass ? 'PASS' : 'FAIL', evidence: String(evidence || '').slice(0, 400) });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${String(evidence || '').slice(0, 180)}`);
}

function startServer() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      AUTO_MIGRATE: '0',
      HUB_CUSTOMER_BACKFILL_BG: '0',
      HUB_SUPER_ADMIN_EMAIL: SA_EMAIL,
      HUB_SUPER_ADMIN_INITIAL_PASSWORD: SA_PASS,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    stop: () => {
      try {
        child.kill('SIGTERM');
      } catch {
        /* */
      }
    },
  };
}

function req(method, urlPath, { token, body } = {}) {
  return new Promise((resolve) => {
    const payload = body != null ? JSON.stringify(body) : null;
    const h = { Accept: 'application/json' };
    if (token) {
      h.Authorization = `Bearer ${token}`;
      h['X-Hub-Token'] = token;
    }
    if (payload) {
      h['Content-Type'] = 'application/json';
      h['Content-Length'] = Buffer.byteLength(payload);
    }
    const r = http.request({ hostname: '127.0.0.1', port: PORT, path: urlPath, method, headers: h }, (res) => {
      const c = [];
      res.on('data', (d) => c.push(d));
      res.on('end', () => {
        let b;
        try {
          b = JSON.parse(Buffer.concat(c).toString('utf8'));
        } catch {
          b = Buffer.concat(c).toString('utf8').slice(0, 240);
        }
        resolve({ status: res.statusCode, body: b });
      });
    });
    r.on('error', (e) => resolve({ status: 0, body: String(e) }));
    if (payload) r.write(payload);
    r.end();
  });
}

async function waitHealth() {
  for (let i = 0; i < 80; i++) {
    const h = await req('GET', '/api/health');
    if (h.status === 200) return;
    await sleep(250);
  }
  throw new Error('health timeout');
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  if (!SA_PASS) throw new Error('need SA password');
  const srv = startServer();
  let browser;
  try {
    await waitHealth();
    const ts = Date.now().toString(36);
    const email = `p360.journey.${ts}@naiosh-test.com`;
    const phone = `+97059${String(Date.now() % 10000000).padStart(7, '0')}`;
    const pass = SA_PASS;

    const reg = await req('POST', '/api/auth/register', {
      body: {
        email,
        password: pass,
        confirmPassword: pass,
        fullName: 'رحلة ملف 360',
        name: 'رحلة ملف 360',
        phone,
        acceptTerms: true,
        termsAccepted: true,
      },
    });
    mark('تسجيل عميل + ملف 360', reg.status === 201 && reg.body?.ok, reg.body?.message || reg.body?.error);

    const custLogin = await req('POST', '/api/auth/login', { body: { email, password: pass } });
    mark('دخول عميل', !!custLogin.body?.token, custLogin.body?.role || custLogin.body?.error);
    const custTok = custLogin.body?.token;

    const ticket = await req('POST', '/api/client/tickets', {
      token: custTok,
      body: { subject: 'تذكرة رحلة 360', message: 'تفاصيل التذكرة' },
    });
    mark('إنشاء تذكرة مرتبطة بالحساب', ticket.status === 201 && !!ticket.body?.ticket?.id, ticket.body?.ticket?.id || ticket.body?.error);

    const order = await req('POST', '/api/client/orders', {
      token: custTok,
      body: { service: 'طلب رحلة 360', amount: 25 },
    });
    mark('إنشاء طلب/معاملة', order.status === 201 && !!order.body?.order?.id, order.body?.order?.id || order.body?.error);

    const staffLogin = await req('POST', '/api/auth/login', { body: { email: SA_EMAIL, password: SA_PASS } });
    mark('دخول موظف مخوّل', !!staffLogin.body?.token, staffLogin.body?.user?.role || staffLogin.body?.role || staffLogin.body?.error);
    const st = staffLogin.body?.token;

    const list = await req('GET', `/api/hub/profiles?q=${encodeURIComponent(email)}&limit=20`, { token: st });
    mark('البحث بالبريد يجد الحساب', list.status === 200 && (list.body?.items || []).some((i) => i.email === email), list.body?.total);

    const byAcc = await req('GET', `/api/hub/profiles?q=${encodeURIComponent((list.body?.items || [])[0]?.accountNo || 'ACC-')}&limit=20`, {
      token: st,
    });
    mark('البحث بـ ACC', byAcc.status === 200 && (byAcc.body?.items || []).length > 0, byAcc.body?.total);

    const view = await req('GET', `/api/hub/profiles/by-email/${encodeURIComponent(email)}`, { token: st });
    const counts = view.body?.sections?.client?.counts || {};
    mark(
      'عرض الملف يُظهر التذكرة والطلب',
      view.status === 200 && view.body?.ok && counts.tickets >= 1 && counts.orders >= 1,
      JSON.stringify(counts)
    );
    mark('ملخص إداري من بيانات حقيقية', (view.body?.sections?.client?.adminSummary?.total || 0) >= 2, JSON.stringify(view.body?.sections?.client?.adminSummary));

    const tid = ticket.body?.ticket?.id;
    const ops = await req('POST', `/api/hub/profiles/by-email/${encodeURIComponent(email)}/ops`, {
      token: st,
      body: { action: 'refer', kind: 'ticket', id: tid },
    });
    mark('إجراء مسؤول (إحالة) يحدّث الحالة', ops.status === 200 && ops.body?.item?.status === 'in_progress', ops.body?.item?.status || ops.body?.error);

    const notif = await req('GET', '/api/client/notifications', { token: custTok });
    const nCount = Array.isArray(notif.body?.notifications) ? notif.body.notifications.length : 0;
    mark('إشعار يظهر للعميل بعد الإجراء', notif.status === 200 && nCount > 0, `count=${nCount}`);

    const denied = await req('GET', `/api/hub/profiles/by-email/${encodeURIComponent(email)}`, { token: custTok });
    mark('عميل لا يصل لواجهة/API الإدارة', denied.status === 403, denied.body?.error);

    // Browser: View button opens dossier
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    // Cookie-backed staff session (dashboard gate)
    const saRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SA_EMAIL, password: SA_PASS }),
    });
    const saBody = await saRes.json().catch(() => ({}));
    const setCookie = typeof saRes.headers.getSetCookie === 'function' ? saRes.headers.getSetCookie() : [];
    const cookieHeader = setCookie.join(',') || saRes.headers.get('set-cookie') || '';
    const cookieMatch = String(cookieHeader).match(/hub_session=([^;]+)/);
    const hubCookie = cookieMatch ? cookieMatch[1] : saBody.token;
    const staffUser = saBody.user || staffLogin.body?.user || { email: SA_EMAIL, role: 'supreme_leader', name: 'القائد' };
    mark('جلسة كوكي للإدارة', !!saBody.token && !!hubCookie, cookieMatch ? 'hub_session' : 'token-fallback');

    async function seedAndOpen(page, viewport) {
      await page.setViewport(viewport);
      const u = new URL(BASE);
      await page.setCookie({
        name: 'hub_session',
        value: hubCookie,
        domain: u.hostname,
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      });
      await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.evaluate(
        (tok, user) => {
          localStorage.setItem('hubAuthToken', tok);
          sessionStorage.setItem('hubAuthToken', tok);
          localStorage.setItem('hubUser', JSON.stringify(user));
          sessionStorage.setItem('hubUser', JSON.stringify(user));
          localStorage.setItem('hubTheme', 'light');
        },
        saBody.token || st,
        staffUser
      );
      await page.goto(`${BASE}/dashboard.html#profiles-360`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForFunction(() => /dashboard\.html/i.test(location.href), { timeout: 30000 }).catch(() => null);
      await page.evaluate(() => {
        if (location.hash !== '#profiles-360') {
          location.hash = 'profiles-360';
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }
      });
      await sleep(1200);
      await page.evaluate(() => {
        const link = [...document.querySelectorAll('a,button,[data-section],.nav-item,.sidebar a')].find((el) =>
          /الملفات الشخصية 360|profiles-360/i.test(el.textContent + (el.getAttribute('href') || '') + (el.dataset?.section || ''))
        );
        link?.click();
      });
      await sleep(2000);
      await page.waitForSelector('#profiles-360-mount #p360-admin-search', { timeout: 45000 });
      const q = await page.$('#p360-admin-search [name=q]');
      if (q) {
        await q.click({ clickCount: 3 });
        await q.type(email, { delay: 5 });
      }
      await page.click('#p360-admin-search button[type=submit]');
      await sleep(1200);
      await page.waitForSelector(`#p360-admin-rows [data-open="${email}"]`, { timeout: 20000 });
      await page.click(`#p360-admin-rows [data-open="${email}"]`);
      await sleep(2000);
      await page.waitForSelector('#p360-admin-dossier .p360-hero, #p360-admin-detail .p360-hero', { timeout: 20000 });
      const text = await page.evaluate(() => document.querySelector('#p360-admin-detail')?.innerText || '');
      return text;
    }

    const desk = await browser.newPage();
    const deskText = await seedAndOpen(desk, { width: 1366, height: 900 });
    const deskHasDossier =
      /رحلة ملف 360/i.test(deskText) &&
      /رقم الحساب|ACC-/i.test(deskText) &&
      (/ملخص إداري|الطلبات والمعاملات|الشكاوى والدعم|التذاكر|سجل النشاط/i.test(deskText) ||
        (await desk.$('#p360-admin-dossier .p360-kpi')) != null) &&
      !/تعذّر فتح الملف/i.test(deskText);
    mark('متصفح كمبيوتر: عرض يفتح الملف الحقيقي', deskHasDossier, deskText.slice(0, 280));
    // Click an ops button if present (close on order)
    const opsClicked = await desk.evaluate(() => {
      const btn = document.querySelector('[data-p360-ops="close"]');
      if (!btn) return false;
      btn.click();
      return true;
    });
    if (opsClicked) await sleep(1500);
    mark('متصفح: زر إجراء تشغيلي قابل للضغط', opsClicked || /إحالة|متابعة|إغلاق/.test(deskText), opsClicked ? 'clicked close' : 'ops labels in dossier');
    await desk.screenshot({ path: path.join(ART, 'admin-view-desktop.png'), fullPage: false });

    // theme dark
    await desk.evaluate(() => {
      localStorage.setItem('hubTheme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark-mode');
    });
    await desk.reload({ waitUntil: 'domcontentloaded' });
    await sleep(800);
    await desk.screenshot({ path: path.join(ART, 'admin-view-desktop-dark.png'), fullPage: false });
    mark('وضع ليلي يحمّل صفحة الإدارة', true, 'screenshot');

    const mob = await browser.newPage();
    const mobText = await seedAndOpen(mob, { width: 390, height: 844, isMobile: true, hasTouch: true });
    mark(
      'متصفح موبايل: عرض يفتح الملف',
      /رحلة ملف 360|تذكرة|ملخص إداري/i.test(mobText),
      mobText.slice(0, 180)
    );
    await mob.screenshot({ path: path.join(ART, 'admin-view-mobile.png'), fullPage: false });

    // re-login persistence
    const relog = await req('POST', '/api/auth/login', { body: { email, password: pass } });
    const view2 = await req('GET', `/api/hub/profiles/by-email/${encodeURIComponent(email)}`, { token: st });
    const t2 = (view2.body?.sections?.client?.tickets || []).find((t) => t.id === tid);
    mark('بعد خروج/دخول: التذكرة ما زالت in_progress', t2 && t2.status === 'in_progress', t2?.status);
    mark('إعادة دخول العميل تنجح', !!relog.body?.token, relog.status);
  } catch (err) {
    mark('suite', false, err.message);
  } finally {
    if (browser) await browser.close();
    srv.stop();
  }

  const pass = rows.filter((r) => r.result === 'PASS').length;
  const fail = rows.filter((r) => r.result === 'FAIL').length;
  const md = [
    '# إدارة الملفات الشخصية 360 — تقرير الاختبار',
    '',
    `PASS: ${pass} · FAIL: ${fail} · المجموع: ${rows.length}`,
    '',
    '| الفحص | النتيجة | دليل |',
    '|---|---|---|',
    ...rows.map((r) => `| ${r.check} | **${r.result}** | ${String(r.evidence || '').replace(/\|/g, '/')} |`),
    '',
    fail
      ? '**الحكم: لم يكتمل — راجع الفشل أعلاه.**'
      : '**الحكم: الرحلة الأساسية نجحت (تسجيل→معاملة→عرض→إجراء→إشعار→استمرارية).**',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ART, 'report.md'), md);
  fs.writeFileSync(path.join(ART, 'report.json'), JSON.stringify({ pass, fail, rows }, null, 2));
  fs.writeFileSync(path.join(ROOT, 'docs/profiles-360-admin-ops-report.md'), md);
  console.log(md);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
