#!/usr/bin/env node
/**
 * E2E: New Task — independent branch + incubator + platform links.
 */
'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.HUB_E2E_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const SA = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const OUT = path.join('/opt/cursor/artifacts', `tasks-org-links-triple-${Date.now()}.json`);

const rows = [];
function mark(check, pass, evidence) {
  rows.push({ check, result: pass ? 'PASS' : 'FAIL', evidence: String(evidence || '').slice(0, 400) });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${evidence}`);
}

function req(method, p, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(p, BASE);
    const lib = u.protocol === 'https:' ? https : http;
    const payload = body != null ? JSON.stringify(body) : null;
    const r = lib.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        headers: {
          Accept: 'application/json',
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...(token ? { Authorization: `Bearer ${token}`, 'X-Hub-Token': token } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch {
            /* */
          }
          resolve({ status: res.statusCode, json });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function main() {
  if (!SA_PASS) {
    console.error('Need HUB_SUPER_ADMIN_INITIAL_PASSWORD');
    process.exit(2);
  }
  const stamp = Date.now().toString(36);
  const login = await req('POST', '/api/auth/login', { body: { email: SA, password: SA_PASS } });
  const tok = login.json?.token;
  mark('دخول القائد', !!tok, login.json?.employeeNo);
  if (!tok) {
    writeReport();
    process.exit(1);
  }

  const catalog = await req('GET', '/api/hub/tasks/catalog', { token: tok });
  const staff = (catalog.json?.catalog?.staffNaiosh || [])[0];
  mark('مسؤول متاح', !!staff?.email, staff?.email);

  // API: triple link
  const created = await req('POST', '/api/hub/tasks', {
    token: tok,
    body: {
      title: `مهمة ثلاثية ${stamp}`,
      details: 'ربط فرع + حاضنة + منصة معًا',
      taskType: 'operational',
      priority: 'عالي',
      status: 'todo',
      assigneeType: 'staff_naiosh',
      assigneeId: staff.email,
      branchId: 'HQ',
      branchName: 'المقر الرئيسي',
      incubatorId: 'inc-001',
      incubatorName: 'التعليم والتعلم',
      platformId: 'UOS',
      platformName: 'منصة UOS',
    },
  });
  const t = created.json?.task;
  mark(
    'إنشاء مهمة بفرع+حاضنة+منصة',
    !!(t?.taskNo && t.branchId === 'HQ' && t.incubatorId === 'inc-001' && t.platformId === 'UOS'),
    `${t?.taskNo} b=${t?.branchId} i=${t?.incubatorId} p=${t?.platformId}`
  );
  mark('حفظ معرف الفرع', t?.branchId === 'HQ' && t?.branch?.name, `${t?.branchId}/${t?.branch?.name}`);
  mark('حفظ معرف الحاضنة', t?.incubatorId === 'inc-001' && t?.incubator?.name, `${t?.incubatorId}/${t?.incubator?.name}`);
  mark('حفظ معرف المنصة', t?.platformId === 'UOS' && t?.platform?.name, `${t?.platformId}/${t?.platform?.name}`);

  const detail = await req('GET', `/api/hub/tasks/${encodeURIComponent(t.id)}`, { token: tok });
  mark(
    'تفاصيل بعد الجلب',
    detail.json?.task?.branchId === 'HQ' &&
      detail.json?.task?.incubatorId === 'inc-001' &&
      detail.json?.task?.platformId === 'UOS',
    detail.json?.task?.entityLabel
  );

  // Edit platform only — keep branch+incubator
  const patched = await req('PATCH', `/api/hub/tasks/${encodeURIComponent(t.id)}`, {
    token: tok,
    body: {
      branchId: 'HQ',
      branchName: 'المقر الرئيسي',
      incubatorId: 'inc-001',
      incubatorName: 'التعليم والتعلم',
      platformId: 'KMS',
      platformName: 'منصة KMS',
    },
  });
  mark(
    'تعديل المنصة مع بقاء الفرع والحاضنة',
    patched.json?.task?.platformId === 'KMS' &&
      patched.json?.task?.branchId === 'HQ' &&
      patched.json?.task?.incubatorId === 'inc-001',
    `p=${patched.json?.task?.platformId} b=${patched.json?.task?.branchId} i=${patched.json?.task?.incubatorId}`
  );

  // Single / dual / general
  const onlyBranch = await req('POST', '/api/hub/tasks', {
    token: tok,
    body: {
      title: `فرع فقط ${stamp}`,
      details: 'اختبار',
      assigneeType: 'staff_naiosh',
      assigneeId: staff.email,
      branchId: 'IQ',
      branchName: 'العراق',
    },
  });
  mark(
    'ربط فرع فقط',
    onlyBranch.json?.task?.branchId === 'IQ' && !onlyBranch.json?.task?.incubatorId && !onlyBranch.json?.task?.platformId,
    onlyBranch.json?.task?.taskNo
  );

  const dual = await req('POST', '/api/hub/tasks', {
    token: tok,
    body: {
      title: `حاضنة+منصة ${stamp}`,
      details: 'اختبار',
      assigneeType: 'staff_naiosh',
      assigneeId: staff.email,
      incubatorId: 'inc-002',
      incubatorName: 'حاضنة 2',
      platformId: 'CCS',
      platformName: 'CCS',
    },
  });
  mark(
    'ربط حاضنة+منصة بدون فرع',
    !dual.json?.task?.branchId && dual.json?.task?.incubatorId === 'inc-002' && dual.json?.task?.platformId === 'CCS',
    dual.json?.task?.taskNo
  );

  const general = await req('POST', '/api/hub/tasks', {
    token: tok,
    body: {
      title: `عامة ${stamp}`,
      details: 'بلا جهات',
      assigneeType: 'staff_naiosh',
      assigneeId: staff.email,
    },
  });
  mark(
    'مهمة عامة بلا جهات',
    !general.json?.task?.branchId &&
      !general.json?.task?.incubatorId &&
      !general.json?.task?.platformId &&
      /عامة/.test(general.json?.task?.entityLabel || ''),
    general.json?.task?.entityLabel
  );

  // Refresh persistence via re-GET
  const again = await req('GET', `/api/hub/tasks/${encodeURIComponent(t.id)}`, { token: tok });
  mark(
    'استمرار البيانات بعد Refresh',
    again.json?.task?.branchId === 'HQ' &&
      again.json?.task?.incubatorId === 'inc-001' &&
      again.json?.task?.platformId === 'KMS',
    again.json?.task?.entityLabel
  );

  // UI
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1400, height: 900 },
    });
    const page = await browser.newPage();
    await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#email, input[type="email"]', { timeout: 15000 });
    await page.evaluate(
      (e, p) => {
        const email = document.querySelector('#email, input[type="email"]');
        const pass = document.querySelector('#password, input[type="password"]');
        if (email) email.value = e;
        if (pass) pass.value = p;
      },
      SA,
      SA_PASS
    );
    await page.click('button[type="submit"], #loginBtn, .btn-primary');
    await page.waitForFunction(() => /dashboard\.html/i.test(location.pathname), { timeout: 20000 }).catch(() => null);
    await page.goto(`${BASE}/dashboard.html#tasks`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => {
      location.hash = 'tasks';
    });
    await page.waitForTimeout?.(1500).catch(() => new Promise((r) => setTimeout(r, 1500)));
    await page.click('[data-action="tk-create"]');
    await page.waitForTimeout?.(800).catch(() => new Promise((r) => setTimeout(r, 800)));

    const fields = await page.evaluate(() => ({
      branch: !!document.getElementById('tk-branch-id'),
      incubator: !!document.getElementById('tk-incubator-id'),
      platform: !!document.getElementById('tk-platform-id'),
      entityTypeGone: !document.getElementById('tk-entity-type'),
      section: [...document.querySelectorAll('.tk-form-section h4')].some((h) => /الجهات المرتبطة/.test(h.textContent || '')),
      orgCols: getComputedStyle(document.querySelector('.tk-org-grid') || document.body).gridTemplateColumns,
    }));
    mark('خانة الفرع ظاهرة', fields.branch, JSON.stringify(fields));
    mark('الحاضنة مستقلة ظاهرة', fields.incubator, JSON.stringify(fields));
    mark('المنصة مستقلة ظاهرة', fields.platform, JSON.stringify(fields));
    mark('الثلاثة معًا (لا نوع جهة بديل)', fields.branch && fields.incubator && fields.platform && fields.entityTypeGone && fields.section, JSON.stringify(fields));

    // Fill triple via UI
    await page.waitForFunction(() => (window.HubTasksWS?.ui?.catalog?.staffNaiosh || []).length > 0, { timeout: 10000 }).catch(() => null);
    const uiTitle = `واجهة ثلاثية ${stamp}`;
    await page.select('#tk-assignee-type', 'staff_naiosh');
    await page.waitForTimeout?.(400).catch(() => new Promise((r) => setTimeout(r, 400)));
    await page.evaluate(
      (email, title) => {
        document.getElementById('tk-title').value = title;
        document.getElementById('tk-details').value = 'من الواجهة — فرع وحاضنة ومنصة';
        const a = document.getElementById('tk-assignee-id');
        if (a) {
          const opt = [...a.options].find((o) => o.value === email);
          if (opt) a.value = email;
          else if (a.options.length > 1) a.selectedIndex = 1;
        }
      },
      staff.email,
      uiTitle
    );
    // Wait pools
    await page.waitForFunction(() => (document.getElementById('tk-branch-id')?.options?.length || 0) > 1, { timeout: 8000 }).catch(() => null);
    await page.waitForFunction(() => (document.getElementById('tk-incubator-id')?.options?.length || 0) > 1, { timeout: 8000 }).catch(() => null);
    await page.waitForFunction(() => (document.getElementById('tk-platform-id')?.options?.length || 0) > 1, { timeout: 8000 }).catch(() => null);

    const picked = await page.evaluate(() => {
      const pick = (id, prefer) => {
        const sel = document.getElementById(id);
        if (!sel || sel.options.length < 2) return null;
        const pref = [...sel.options].find((o) => o.value && (o.value === prefer || o.textContent.includes(prefer)));
        const opt = pref || [...sel.options].find((o) => o.value);
        if (!opt) return null;
        sel.value = opt.value;
        return { id: opt.value, name: opt.getAttribute('data-name') || opt.textContent };
      };
      return {
        branch: pick('tk-branch-id', 'HQ'),
        incubator: pick('tk-incubator-id', 'inc-001'),
        platform: pick('tk-platform-id', 'UOS'),
      };
    });
    mark('اختيار الثلاثة في الواجهة دون فقد', !!(picked.branch && picked.incubator && picked.platform), JSON.stringify(picked));

    const saveWait = page
      .waitForResponse((r) => r.url().includes('/api/hub/tasks') && r.request().method() === 'POST', { timeout: 15000 })
      .catch(() => null);
    await page.click('[data-action="tk-save"]');
    const saveRes = await saveWait;
    let saveJson = null;
    try {
      saveJson = saveRes ? await saveRes.json() : null;
    } catch {
      /* */
    }
    mark(
      'حفظ مهمة حقيقية من الواجهة',
      !!(saveJson?.ok && saveJson.task?.branchId && saveJson.task?.incubatorId && saveJson.task?.platformId),
      `${saveJson?.task?.taskNo} ${saveJson?.task?.entityLabel || saveJson?.error || ''}`
    );

    if (saveJson?.task?.id) {
      await page.waitForFunction(
        (no) => (document.body?.innerText || '').includes(no),
        { timeout: 10000 },
        saveJson.task.taskNo
      ).catch(() => null);
      // open detail
      const openBtn = await page.$(`[data-action="tk-open"][data-id="${saveJson.task.id}"]`);
      if (openBtn) {
        await openBtn.click();
        await page.waitForTimeout?.(600).catch(() => new Promise((r) => setTimeout(r, 600)));
      }
      const detailText = await page.evaluate(() => document.body?.innerText || '');
      mark(
        'تفاصيل الواجهة تعرض الجهات الثلاث',
        /الفرع/.test(detailText) && /الحاضنة/.test(detailText) && /المنصة/.test(detailText),
        detailText.includes(saveJson.task.branch?.name || '') ? 'labels present' : 'partial'
      );
    }

    // Mobile layout
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.goto(`${BASE}/dashboard.html#tasks`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => {
      location.hash = 'tasks';
    });
    await page.waitForTimeout?.(800).catch(() => new Promise((r) => setTimeout(r, 800)));
    await page.click('[data-action="tk-create"]');
    await page.waitForTimeout?.(500).catch(() => new Promise((r) => setTimeout(r, 500)));
    const mob = await page.evaluate(() => {
      const g = document.querySelector('.tk-org-grid');
      const cols = g ? getComputedStyle(g).gridTemplateColumns : '';
      return {
        ok: !!document.getElementById('tk-branch-id') && !!document.getElementById('tk-incubator-id') && !!document.getElementById('tk-platform-id'),
        cols,
      };
    });
    mark('موبايل: الثلاثة عموديًا', mob.ok && !/,/.test(mob.cols.replace(/[^\d.,]/g, '')), JSON.stringify(mob));

    const shot = path.join('/opt/cursor/artifacts', `tasks-org-links-form-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    mark('لقطة النموذج', fs.existsSync(shot), shot);
  } catch (err) {
    mark('اختبار الواجهة', false, err.message);
  } finally {
    if (browser) await browser.close().catch(() => null);
  }

  writeReport();
  const failed = rows.filter((r) => r.result === 'FAIL').length;
  console.log(`Summary: ${rows.length - failed} PASS / ${failed} FAIL / ${rows.length} total`);
  process.exit(failed ? 1 : 0);
}

function writeReport() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), base: BASE, rows }, null, 2));
  console.log('Report:', OUT);
}

main().catch((e) => {
  console.error(e);
  mark('crash', false, e.message);
  writeReport();
  process.exit(1);
});
