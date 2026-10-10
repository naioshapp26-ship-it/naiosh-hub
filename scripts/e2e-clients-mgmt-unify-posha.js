#!/usr/bin/env node
/**
 * Unify clients-mgmt with posha-clients: same portal source, create/edit sync, profile fields.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.HUB_E2E_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const SA = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const ART = '/opt/cursor/artifacts';
const OUT = path.join(ART, `clients-unify-${Date.now()}.json`);

const rows = [];
function mark(check, pass, evidence) {
  rows.push({ check, result: pass ? 'PASS' : 'FAIL', evidence: String(evidence || '').slice(0, 500) });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${evidence}`);
}

async function login(page, email, pass) {
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#email, input[type="email"]', { timeout: 15000 });
  await page.evaluate(
    (e, p) => {
      document.querySelector('#email, input[type="email"]').value = e;
      document.querySelector('#password, input[type="password"]').value = p;
    },
    email,
    pass
  );
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => null),
    page.click('button[type="submit"], #loginBtn, .btn-primary'),
  ]);
  await new Promise((r) => setTimeout(r, 700));
}

async function authHeaders(page) {
  return page.evaluate(() => {
    const token = localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || '';
    let role = '';
    try {
      role = JSON.parse(localStorage.getItem('hubUser') || sessionStorage.getItem('hubUser') || '{}').role || '';
    } catch (_) {}
    const h = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (token) h.Authorization = `Bearer ${token}`;
    if (role) h['X-Hub-User-Role'] = role;
    return h;
  });
}

async function main() {
  if (!SA_PASS) {
    console.error('Need HUB_SUPER_ADMIN_INITIAL_PASSWORD');
    process.exit(2);
  }
  fs.mkdirSync(ART, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  });

  let created = null;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await login(page, SA, SA_PASS);
    const headers = await authHeaders(page);

    // 1) Posha fields inventory
    await page.goto(`${BASE}/dashboard.html#posha-clients`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#posha-mount, .posha-clients-table, .posha-ops', { timeout: 25000 });
    await new Promise((r) => setTimeout(r, 1200));
    // Jump to clients tab if needed
    await page.evaluate(() => {
      document.querySelector('#posha-subnav [data-ptab="clients"]')?.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    const poshaCols = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.posha-clients-table thead th')).map((th) => (th.textContent || '').trim())
    );
    mark(
      'عملاء نايوش: أعمدة الجدول الشامل',
      poshaCols.includes('رقم العميل') && poshaCols.includes('رقم نايوش') && poshaCols.includes('نوع العميل'),
      JSON.stringify(poshaCols)
    );
    await page.screenshot({ path: path.join(ART, 'clients-unify-posha-ref.png'), fullPage: false });

    // 2) Clients-mgmt uses same mount/table
    await page.goto(`${BASE}/dashboard.html#clients-mgmt`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#clients-mgmt-mount, .hub-clients-ws--unified', { timeout: 25000 });
    await new Promise((r) => setTimeout(r, 1500));
    const mgmt = await page.evaluate(() => {
      const mount = document.getElementById('clients-mgmt-mount');
      const cols = Array.from(document.querySelectorAll('#clients-mgmt-mount .posha-clients-table thead th')).map((th) =>
        (th.textContent || '').trim()
      );
      const title = (document.getElementById('page-title')?.textContent || '').trim();
      const kpis = Array.from(document.querySelectorAll('.hub-clients-ws--unified .kpi span, .hub-clients-ws .kpi span'))
        .map((el) => (el.textContent || '').trim())
        .filter(Boolean);
      return {
        hasMount: !!mount,
        cols,
        title,
        kpis,
        hasCreate: !!document.querySelector('[data-action="cl-create"]'),
        bodyHasUnified: (document.body.innerText || '').includes('نفس نموذج'),
      };
    });
    mark('إدارة العملاء: عنوان الصفحة', mgmt.title === 'إدارة العملاء', mgmt.title);
    mark('إدارة العملاء: mount موحّد لعملاء نايوش', mgmt.hasMount && mgmt.cols.length >= 10, JSON.stringify(mgmt.cols));
    mark(
      'إدارة العملاء: أعمدة مطابقة (رقم نايوش / نوع / مدينة)',
      mgmt.cols.includes('رقم نايوش') && mgmt.cols.includes('نوع العميل') && mgmt.cols.includes('المدينة'),
      JSON.stringify(mgmt.cols)
    );
    mark('إدارة العملاء: زر إضافة عميل', mgmt.hasCreate, 'cl-create');
    await page.screenshot({ path: path.join(ART, 'clients-unify-mgmt-after.png'), fullPage: false });

    // 3) Create client from clients-mgmt API (authoritative)
    const stamp = Date.now().toString(36);
    const email = `unify.cli.${stamp}@naiosh-test.com`;
    const phone = `+9665${String(Date.now()).slice(-8)}`;
    const createRes = await page.evaluate(
      async (h, body) => {
        const res = await fetch('/api/admin/clients', {
          method: 'POST',
          headers: { ...h, 'X-Idempotency-Key': `e2e-${Date.now()}` },
          body: JSON.stringify(body),
        });
        const j = await res.json().catch(() => ({}));
        return { status: res.status, j };
      },
      headers,
      {
        name: `عميل توحيد ${stamp}`,
        email,
        phone,
        status: 'active',
        clientType: 'مؤسسة',
        activityType: 'تعليم',
        company: 'مؤسسة التوحيد',
        country: 'السعودية',
        city: 'الرياض',
        address: 'حي الاختبار',
        source: 'إدخال يدوي',
      }
    );
    created = createRes.j?.client || null;
    mark(
      'إنشاء عميل من إدارة العملاء (API)',
      createRes.status === 201 && !!created?.clientId,
      JSON.stringify({ status: createRes.status, clientId: created?.clientId, naioshId: created?.naioshId, err: createRes.j?.error })
    );

    // 4) Appears in both list APIs with same clientId
    const lists = await page.evaluate(async (h, em) => {
      const a = await fetch('/api/admin/clients', { headers: h, cache: 'no-store' }).then((r) => r.json());
      const b = await fetch('/api/admin/posha/clients', { headers: h, cache: 'no-store' }).then((r) => r.json());
      const rowA = (a.clients || []).find((c) => String(c.email).toLowerCase() === em);
      const rowB = (b.clients || b.items || []).find((c) => String(c.email).toLowerCase() === em);
      return { rowA, rowB, totalA: (a.clients || []).length, totalB: (b.clients || b.items || []).length };
    }, headers, email);
    mark(
      'يظهر في إدارة العملاء وعملاء نايوش بنفس رقم العميل',
      !!(lists.rowA && lists.rowB && lists.rowA.clientId === lists.rowB.clientId && lists.rowA.clientId === created?.clientId),
      JSON.stringify({
        clientId: created?.clientId,
        a: lists.rowA && { id: lists.rowA.clientId, city: lists.rowA.city, type: lists.rowA.clientType },
        b: lists.rowB && { id: lists.rowB.clientId, city: lists.rowB.city, type: lists.rowB.clientType },
      })
    );
    mark(
      'الحقول الشاملة موجودة في المصدر',
      !!(lists.rowA?.city === 'الرياض' && lists.rowA?.clientType === 'مؤسسة' && lists.rowA?.naioshId),
      JSON.stringify({
        city: lists.rowA?.city,
        type: lists.rowA?.clientType,
        naioshId: lists.rowA?.naioshId,
        activity: lists.rowA?.activityType,
      })
    );

    // 5) Edit phone from admin clients profile → visible in posha
    const newPhone = `+9665${String(Date.now() + 7).slice(-8)}`;
    const patch = await page.evaluate(
      async (h, em, phone) => {
        const res = await fetch(`/api/admin/clients/${encodeURIComponent(em)}/profile`, {
          method: 'PATCH',
          headers: h,
          body: JSON.stringify({ phone, city: 'جدة' }),
        });
        const j = await res.json().catch(() => ({}));
        return { status: res.status, j };
      },
      headers,
      email,
      newPhone
    );
    mark('تعديل الملف عبر إدارة العملاء API', patch.status === 200 && patch.j?.ok, JSON.stringify({ status: patch.status, err: patch.j?.error }));

    const afterEdit = await page.evaluate(async (h, em) => {
      const a = await fetch(`/api/admin/clients/${encodeURIComponent(em)}`, { headers: h }).then((r) => r.json());
      const b = await fetch(`/api/admin/posha/clients/${encodeURIComponent(em)}`, { headers: h }).then((r) => r.json());
      return {
        phoneA: a.client?.phone,
        phoneB: b.client?.phone || b.detail?.client?.phone,
        cityA: a.client?.city,
        cityB: b.client?.city || b.detail?.client?.city,
      };
    }, headers, email);
    mark(
      'التزامن بعد التعديل بين القسمين',
      afterEdit.phoneA === newPhone && afterEdit.phoneB === newPhone && afterEdit.cityA === 'جدة' && afterEdit.cityB === 'جدة',
      JSON.stringify(afterEdit)
    );

    // 6) UI refresh shows client in both pages
    await page.goto(`${BASE}/dashboard.html#clients-mgmt`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1500));
    await page.evaluate(() => document.querySelector('#posha-refresh')?.click());
    await new Promise((r) => setTimeout(r, 1200));
    const inMgmtUi = await page.evaluate((id) => (document.body.innerText || '').includes(id), created?.clientId || '___');
    mark('ظهور العميل في واجهة إدارة العملاء بعد التحديث', inMgmtUi, created?.clientId);

    await page.goto(`${BASE}/dashboard.html#posha-clients`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1200));
    await page.evaluate(() => {
      document.querySelector('#posha-subnav [data-ptab="clients"]')?.click();
      document.querySelector('#posha-refresh')?.click();
    });
    await new Promise((r) => setTimeout(r, 1200));
    const inPoshaUi = await page.evaluate((id) => (document.body.innerText || '').includes(id), created?.clientId || '___');
    mark('ظهور العميل في واجهة عملاء نايوش', inPoshaUi, created?.clientId);

    // Open 360 from posha
    if (inPoshaUi) {
      await page.evaluate((em) => {
        document.querySelector(`[data-open-posha="${em}"]`)?.click();
      }, email);
      await new Promise((r) => setTimeout(r, 1000));
      const drawer = await page.evaluate(() => {
        const d = document.getElementById('posha-drawer');
        const text = d?.innerText || '';
        return {
          open: d && !d.hidden,
          hasForm: !!document.getElementById('posha-profile-form'),
          hasPhone: text.includes('الهاتف') || !!document.querySelector('#posha-profile-form [name="phone"]'),
          hasTabs: (document.querySelectorAll('#posha-ctabs button') || []).length >= 6,
        };
      });
      mark('ملف العميل الشامل يفتح مع نموذج التعديل والتبويبات', drawer.open && drawer.hasForm && drawer.hasTabs, JSON.stringify(drawer));
      await page.screenshot({ path: path.join(ART, 'clients-unify-profile-360.png'), fullPage: false });
    } else {
      mark('ملف العميل الشامل يفتح مع نموذج التعديل والتبويبات', false, 'client not in UI');
    }

    // 7) Customer denied dashboard / other client
    const custPage = await browser.newPage();
    await custPage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const custEmail = `unify.cust.${stamp}@naiosh-test.com`;
    const custPass = 'Test360';
    await custPage.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    const reg = await custPage.evaluate(
      async (body) => {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        return { status: res.status, j: await res.json().catch(() => ({})) };
      },
      {
        fullName: 'عميل منع',
        username: `ucust${stamp}`.slice(0, 32),
        email: custEmail,
        phone: `+9665${String(Date.now() + 9).slice(-8)}`,
        password: custPass,
        confirmPassword: custPass,
        termsAccepted: true,
      }
    );
    if (reg.j?.token) {
      await custPage.evaluate(
        (t, u) => {
          localStorage.setItem('hubAuthToken', t);
          localStorage.setItem('hubUser', JSON.stringify(u));
        },
        reg.j.token,
        { ...(reg.j.user || {}), role: 'customer', email: custEmail }
      );
    } else {
      await login(custPage, custEmail, custPass);
    }
    await custPage.goto(`${BASE}/dashboard.html#clients-mgmt`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1200));
    const denied = await custPage.evaluate(() => {
      const url = location.href;
      return /login\.html|client\.html/i.test(url) || /ليس لديك صلاحية/.test(document.body.innerText || '');
    });
    mark('عميل عادي ممنوع من إدارة العملاء', denied, custPage.url());

    const peek = await custPage.evaluate(async (em) => {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(em)}`, { headers: { Accept: 'application/json' } });
      return { status: res.status };
    }, email);
    mark('عميل لا يرى بيانات عميل آخر عبر API', peek.status === 401 || peek.status === 403, `status=${peek.status}`);
    await custPage.screenshot({ path: path.join(ART, 'clients-unify-customer-denied.png'), fullPage: false });
    await custPage.close();

    // Mobile mgmt — fresh SA page to avoid stale session from prior desktop flow
    const mob = await browser.newPage();
    await mob.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await login(mob, SA, SA_PASS);
    await mob.goto(`${BASE}/dashboard.html#clients-mgmt`, { waitUntil: 'networkidle2', timeout: 60000 });
    await mob.waitForSelector('#clients-mgmt-mount, .hub-clients-ws--unified', { timeout: 25000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 1500));
    const mobileOk = await mob.evaluate(
      () => !!(document.getElementById('clients-mgmt-mount') || document.querySelector('.hub-clients-ws--unified .posha-ops'))
    );
    mark('موبايل: صفحة إدارة العملاء الموحّدة تحمّل', mobileOk, mobileOk ? 'mount' : mob.url());
    await mob.screenshot({ path: path.join(ART, 'clients-unify-mobile.png'), fullPage: false });
    await mob.close();

    mark('الحفاظ على بيانات العملاء القديمة (قوائم غير فارغة)', lists.totalA >= 1 && lists.totalB >= 1, `A=${lists.totalA} B=${lists.totalB}`);
  } catch (err) {
    mark('e2e', false, err.stack || err.message);
  } finally {
    await browser.close().catch(() => null);
  }

  const report = {
    at: new Date().toISOString(),
    base: BASE,
    createdClientId: created?.clientId || null,
    createdEmail: created?.email || null,
    rows,
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log('Report:', OUT);
  const failed = rows.filter((r) => r.result === 'FAIL').length;
  console.log(`Summary: ${rows.length - failed} PASS / ${failed} FAIL / ${rows.length} total`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
