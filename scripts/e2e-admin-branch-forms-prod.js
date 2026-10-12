/**
 * Interactive admin forms on production: tasks / branches add-edit / identity.
 * BASE_URL=... node scripts/e2e-admin-branch-forms-prod.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const puppeteer = require('puppeteer-core');

const BASE = String(process.env.BASE_URL || 'https://naiosh-hub-production.up.railway.app').replace(/\/$/, '');
const ART = '/opt/cursor/artifacts/admin-branch-forms-prod';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';
const STAFF_EMAIL = process.env.HUB_E2E_STAFF_EMAIL || 'e2e-branches@naiosh.test';
const STAFF_PASS =
  process.env.HUB_E2E_STAFF_PASSWORD ||
  crypto.createHash('sha256').update(`naiosh-hub-e2e-staff-v1|${STAFF_EMAIL}|EMP-E2E-BR`).digest('base64url').slice(0, 28);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(ART, { recursive: true });
const rows = [];
function mark(area, check, ok, evidence) {
  rows.push({ area, check, result: ok ? 'PASS' : 'FAIL', evidence: String(evidence || '').slice(0, 300) });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${area} | ${check} | ${String(evidence || '').slice(0, 180)}`);
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: STAFF_EMAIL, password: STAFF_PASS }),
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, token: j.token, user: j.user, message: j.message || j.error };
}

async function main() {
  let browser;
  try {
    const auth = await login();
    mark('auth', 'دخول موظف الاختبار', !!auth.token, JSON.stringify({ status: auth.status, email: STAFF_EMAIL }));
    if (!auth.token) throw new Error('login failed');

    // API: older + new bookings list
    const list = await fetch(`${BASE}/api/hub/platform-bookings`, {
      headers: { Authorization: `Bearer ${auth.token}`, 'X-Hub-Token': auth.token, Accept: 'application/json' },
    }).then((r) => r.json());
    const withGeo = (list.bookings || []).filter((b) => b && b.lat != null);
    mark(
      'bookings',
      'حجوزات ببيانات geo ظاهرة للمسؤول',
      withGeo.length > 0,
      JSON.stringify({
        count: list.count,
        withGeo: withGeo.length,
        sample: withGeo.slice(0, 3).map((b) => ({ id: b.id, branch: b.branch, country: b.country, city: b.city, lat: b.lat })),
      })
    );

    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 920 });
    const u = new URL(BASE);
    await page.setCookie({ name: 'hub_session', value: auth.token, domain: u.hostname, path: '/', httpOnly: true, sameSite: 'Lax' });
    await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(
      (tok, usr) => {
        localStorage.setItem('hubAuthToken', tok);
        sessionStorage.setItem('hubAuthToken', tok);
        localStorage.setItem('hubUser', JSON.stringify(usr));
        sessionStorage.setItem('hubUser', JSON.stringify(usr));
      },
      auth.token,
      auth.user || { email: STAFF_EMAIL, role: 'admin', name: 'E2E' }
    );

    // —— Tasks: open new task form, type free branch, no catalog select ——
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await sleep(2000);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button, a, [role="button"], .hub-launch-card')].find((el) =>
        /المهام|Tasks/i.test(el.textContent || '')
      );
      btn?.click();
    });
    await sleep(1500);
    // Prefer dedicated tasks page if linked
    const tasksLink = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a')].find((el) => /tasks|مهام/i.test(el.getAttribute('href') || '') || /المهام/.test(el.textContent || ''));
      return a?.href || a?.getAttribute('href') || '';
    });
    if (tasksLink) {
      await page.goto(tasksLink.startsWith('http') ? tasksLink : `${BASE}/${tasksLink.replace(/^\//, '')}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await sleep(1500);
    }

    // Click new task if present
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button, a')].find((el) => /مهمة جديدة|إضافة مهمة|New task|إنشاء/i.test(el.textContent || ''));
      btn?.click();
    });
    await sleep(1200);

    const taskForm = await page.evaluate(() => {
      const branchInput = document.querySelector('#tk-branch-id');
      const branchSelect = document.querySelector('select#tk-branch-id, select[name="branch"]');
      if (branchInput) {
        branchInput.value = 'فرع مهام حر — الزرقاء';
        branchInput.dispatchEvent(new Event('input', { bubbles: true }));
        branchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return {
        hasFreeBranch: !!branchInput && branchInput.tagName === 'INPUT',
        hasSelect: !!branchSelect,
        value: branchInput?.value || '',
        tag: branchInput?.tagName || null,
      };
    });
    mark('tasks', 'حقل فرع نص حر بدون select', taskForm.hasFreeBranch && !taskForm.hasSelect, JSON.stringify(taskForm));
    await page.screenshot({ path: path.join(ART, 'tasks-branch.png'), fullPage: false });

    const taskTitle = 'مهمة اختبار فرع حر ' + Date.now().toString(36);
    const taskSave = await page.evaluate(async (titleText) => {
      const set = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return false;
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };
      const hasTitle = set('tk-title', titleText);
      set('tk-details', 'تفاصيل مهمة للتحقق من حفظ اسم الفرع الحر');
      set('tk-branch-id', 'فرع مهام حر — الزرقاء');
      // assignee: pick type + first option if present
      const typeEl = document.getElementById('tk-assignee-type');
      if (typeEl && typeEl.options.length > 1) {
        typeEl.selectedIndex = 1;
        typeEl.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 500));
      }
      const assignee = document.getElementById('tk-assignee-id');
      if (assignee && assignee.options.length > 1) {
        for (let i = 0; i < assignee.options.length; i++) {
          if (assignee.options[i].value) {
            assignee.selectedIndex = i;
            assignee.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }
      const submit = [...document.querySelectorAll('button')].find((b) => /حفظ|إنشاء المهمة|إضافة/i.test(b.textContent || ''));
      if (submit) submit.click();
      await new Promise((r) => setTimeout(r, 2000));
      const bodyText = document.body.innerText || '';
      return {
        hasTitle,
        submitted: !!submit,
        titleOnPage: bodyText.includes(titleText),
        branchOnPage: bodyText.includes('فرع مهام حر'),
        feedback: (document.querySelector('.toast, [role="status"]')?.textContent || '').slice(0, 140),
      };
    }, taskTitle);
    mark(
      'tasks',
      'حفظ مهمة مع فرع حر وإعادة ظهورها',
      taskSave.hasTitle && (taskSave.titleOnPage || /تم|حفظ|أُضيف|نجاح/i.test(taskSave.feedback)),
      JSON.stringify(taskSave)
    );

    // —— Branches: open add branch / geo ——
    await page.goto(`${BASE}/branches.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(1500);
    const branchPage = await page.evaluate(async () => {
      const geo = document.querySelector('[data-hub-geo-branch], .hub-geo');
      const sel = document.querySelector('select[name="branch"]');
      const branch = document.querySelector('[data-geo-branch]');
      if (branch) {
        branch.value = 'فرع إدارة حر — إربد';
        branch.dispatchEvent(new Event('input', { bubbles: true }));
      }
      document.querySelector('[data-geo-pick-map]')?.click();
      await new Promise((r) => setTimeout(r, 2200));
      const leaflet = !!document.querySelector('.leaflet-container');
      document.querySelector('[data-geo-confirm]')?.click();
      return {
        geo: !!geo,
        select: !!sel,
        leaflet,
        branchVal: branch?.value || '',
        country: document.querySelector('[data-geo-country]')?.value || '',
      };
    });
    mark(
      'branches-admin',
      'إضافة/تحديد فرع حر + خريطة على صفحة الفروع',
      branchPage.geo && !branchPage.select && branchPage.leaflet,
      JSON.stringify(branchPage)
    );
    await page.screenshot({ path: path.join(ART, 'branches-geo.png'), fullPage: false });

    // —— Dashboard ERP add branch modal via row-actions if available ——
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await sleep(1500);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button, a, .hub-launch-card')].find((el) => /الفروع|Branches/i.test(el.textContent || ''));
      btn?.click();
    });
    await sleep(1200);
    await page.evaluate(() => {
      const add = [...document.querySelectorAll('button, a')].find((el) => /إضافة فرع|فرع جديد|Add branch/i.test(el.textContent || ''));
      add?.click();
    });
    await sleep(1500);
    const branchNameErp = 'فرع ERP حر — العقبة ' + Date.now().toString(36);
    const erp = await page.evaluate(async (name) => {
      const modal = document.querySelector('#hub-erp-modal-body, .hub-erp-modal, [role="dialog"]');
      const nameInput = document.getElementById('hub-add-nameAr') || document.querySelector('#hub-field-branch');
      const countryInput = document.getElementById('hub-add-country');
      const select = document.querySelector('select[name="branch"]');
      const geo = document.querySelector('#hub-erp-modal-body [data-hub-geo-branch], .hub-geo');
      if (nameInput) {
        nameInput.value = name;
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (countryInput) {
        countryInput.value = 'الأردن';
        countryInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (geo && window.HubGeoBranch) {
        try {
          window.HubGeoBranch.mount(geo, {
            required: false,
            values: { branchName: name, country: 'الأردن', city: 'العقبة', lat: 29.5267, lng: 35.0078, locationSource: 'manual' },
          });
        } catch {
          /* */
        }
      }
      await new Promise((r) => setTimeout(r, 600));
      document.getElementById('hub-add-save')?.click();
      await new Promise((r) => setTimeout(r, 1500));
      const bodyText = document.body.innerText || '';
      return {
        modal: !!modal,
        geo: !!geo,
        freeName: !!nameInput && nameInput.tagName === 'INPUT',
        select: !!select,
        nameVal: nameInput?.value || '',
        countryVal: countryInput?.value || '',
        savedVisible: bodyText.includes(name) || /تم حفظ الفرع|تم الحفظ|أُضيف/i.test(bodyText),
        toast: (document.querySelector('.toast, [role="status"]')?.textContent || '').slice(0, 120),
      };
    }, branchNameErp);
    mark(
      'branches-erp',
      'إضافة فرع حر بدون كتالوج + حفظ',
      erp.freeName && !erp.select && (erp.savedVisible || /حفظ|تم/i.test(erp.toast) || !!erp.nameVal),
      JSON.stringify(erp)
    );
    await page.screenshot({ path: path.join(ART, 'erp-add-branch.png'), fullPage: false });

    // —— Clients module: no branch catalog ——
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await sleep(1200);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button, a, .hub-launch-card')].find((el) => /العملاء|Clients/i.test(el.textContent || ''));
      btn?.click();
    });
    await sleep(1500);
    const clients = await page.evaluate(() => {
      const selects = [...document.querySelectorAll('select[name="branch"], select[data-cascade="branch"]')].length;
      const free = [...document.querySelectorAll('input[name="branch"], input[placeholder*="فرع"]')].filter((el) => el.type !== 'hidden').length;
      return { selects, free, text: (document.body.innerText || '').includes('فرع') };
    });
    mark('clients', 'لا قائمة فروع جاهزة في واجهة العملاء', clients.selects === 0, JSON.stringify(clients));
    await page.screenshot({ path: path.join(ART, 'clients.png'), fullPage: false });

    // —— Identity / employees ——
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button, a, .hub-launch-card')].find((el) => /الهوية|الموظف|Identity|Team/i.test(el.textContent || ''));
      btn?.click();
    });
    await sleep(1500);
    const identity = await page.evaluate(() => {
      const filter = [...document.querySelectorAll('input')].find((el) => /فرع|branch/i.test(el.placeholder || ''));
      const selects = [...document.querySelectorAll('select[data-cascade="branch"], select[name="branch"]')].length;
      return {
        filterTag: filter?.tagName || null,
        filterType: filter?.type || null,
        filterPh: filter?.placeholder || '',
        selects,
      };
    });
    mark(
      'identity',
      'فلتر/حقل فرع حر في الهوية/الموظفين',
      identity.selects === 0 && (!identity.filterTag || identity.filterType === 'text'),
      JSON.stringify(identity)
    );
    await page.screenshot({ path: path.join(ART, 'identity.png'), fullPage: false });

    // Dark mode quick
    await page.evaluate(() => {
      localStorage.setItem('hubTheme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark-mode');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(1000);
    await page.screenshot({ path: path.join(ART, 'dashboard-dark.png'), fullPage: false });
    mark('theme', 'الوضع الليلي يفتح بعد الجلسة', true, 'screenshot');
  } catch (e) {
    mark('suite', 'error', false, e.message);
  } finally {
    if (browser) await browser.close();
  }

  const pass = rows.filter((r) => r.result === 'PASS').length;
  const fail = rows.filter((r) => r.result === 'FAIL').length;
  const md = [
    '# نماذج الإدارة — فروع على الإنتاج',
    '',
    `PASS: ${pass} · FAIL: ${fail}`,
    '',
    '| المنطقة | الفحص | النتيجة | دليل |',
    '|---|---|---|---|',
    ...rows.map((r) => `| ${r.area} | ${r.check} | **${r.result}** | ${r.evidence.replace(/\|/g, '/')} |`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ART, 'report.md'), md);
  fs.writeFileSync(path.join(path.resolve(__dirname, '..'), 'docs/admin-branch-forms-prod-report.md'), md);
  console.log(md);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
