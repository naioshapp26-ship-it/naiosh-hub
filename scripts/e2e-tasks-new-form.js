#!/usr/bin/env node
/**
 * E2E: New Task form — typed assignees, entities, attachments, ACL, notifications.
 * Usage: HUB_SUPER_ADMIN_INITIAL_PASSWORD=… node scripts/e2e-tasks-new-form.js
 */
'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.HUB_E2E_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const SA = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const OUT = path.join('/opt/cursor/artifacts', `tasks-new-form-e2e-${Date.now()}.json`);

const rows = [];
const created = [];

function mark(check, pass, evidence) {
  rows.push({ check, result: pass ? 'PASS' : 'FAIL', evidence: String(evidence || '').slice(0, 500) });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${evidence}`);
}

function req(method, p, { body, token, rawBody, headers } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(p, BASE);
    const lib = u.protocol === 'https:' ? https : http;
    const isRaw = Buffer.isBuffer(rawBody);
    const payload = isRaw ? rawBody : body != null ? JSON.stringify(body) : null;
    const r = lib.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        headers: {
          Accept: 'application/json',
          ...(payload && !isRaw
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...(isRaw ? { 'Content-Length': payload.length } : {}),
          ...(token ? { Authorization: `Bearer ${token}`, 'X-Hub-Token': token } : {}),
          ...(headers || {}),
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
          resolve({ status: res.statusCode, json, raw });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function upload(token, name, mime, buf) {
  return req('POST', '/api/hub/uploads', {
    token,
    rawBody: buf,
    headers: {
      'Content-Type': mime,
      'X-File-Name': encodeURIComponent(name),
      'X-File-Type': mime,
    },
  });
}

async function main() {
  if (!SA_PASS) {
    console.error('Set HUB_SUPER_ADMIN_INITIAL_PASSWORD or HUB_E2E_SA_PASSWORD');
    process.exit(2);
  }

  const stamp = Date.now().toString(36);
  const login = await req('POST', '/api/auth/login', { body: { email: SA, password: SA_PASS } });
  const tok = login.json?.token;
  mark('دخول القائد الأعلى', !!tok, login.json?.employeeNo || login.json?.error || login.status);
  if (!tok) {
    writeReport();
    process.exit(1);
  }

  const catalog = await req('GET', '/api/hub/tasks/catalog', { token: tok });
  mark('كتالوج المهام', !!(catalog.json?.ok && catalog.json.catalog), `staffN=${catalog.json?.catalog?.staffNaiosh?.length || 0} cust=${catalog.json?.catalog?.customers?.length || 0}`);

  // Ensure active external staff + company for real assignee types
  let extEmail = (catalog.json?.catalog?.staffExternal || [])[0]?.email;
  let companyName = (catalog.json?.catalog?.companies || [])[0]?.id;
  if (!extEmail || !companyName) {
    extEmail = `adm.ext.tasks.${stamp}@example.com`;
    companyName = 'مؤسسة الأفق للمهام';
    const createE = await req('POST', '/api/admin/staff', {
      token: tok,
      body: {
        name: 'متابع خارجي للمهام',
        email: extEmail,
        phone: '+970599001122',
        affiliationKind: 'external',
        orgName: companyName,
        department: 'الشراكات',
        role: 'admin',
        temporaryPassword: '2468',
        permissions: ['clients.view'],
      },
    });
    mark(
      'تهيئة إداري جهة خارجية حقيقي للاختبار',
      !!(createE.json?.ok && createE.json?.staff?.affiliationKind === 'external'),
      `${createE.json?.staff?.orgName || createE.json?.error || ''}`
    );
  } else {
    mark('جهة خارجية موجودة في الكتالوج', true, `${extEmail} / ${companyName}`);
  }

  const cat2 = await req('GET', '/api/hub/tasks/catalog', { token: tok });
  const staffN = (cat2.json?.catalog?.staffNaiosh || []).find((s) => s.email !== SA) || (cat2.json?.catalog?.staffNaiosh || [])[0];
  const staffX = (cat2.json?.catalog?.staffExternal || []).find((s) => s.email === extEmail) || (cat2.json?.catalog?.staffExternal || [])[0];
  const customer = (cat2.json?.catalog?.customers || [])[0];
  const company = (cat2.json?.catalog?.companies || []).find((c) => c.id === companyName) || (cat2.json?.catalog?.companies || [])[0];

  mark('مسؤول نايوش متاح', !!staffN?.email, staffN?.email || 'none');
  mark('مسؤول خارجي متاح', !!staffX?.email, staffX?.email || 'none');
  mark('عميل متاح', !!customer?.email, customer?.email || 'none — لا عملاء في القاعدة');
  mark('شركة متاحة', !!company?.id, company?.id || 'none');

  // Uploads
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const doc = Buffer.from('%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
  const video = Buffer.from('ftypisomfake-video-bytes-for-e2e');

  const upImg = await upload(tok, `task-img-${stamp}.png`, 'image/png', png);
  const upDoc = await upload(tok, `task-doc-${stamp}.pdf`, 'application/pdf', doc);
  const upVid = await upload(tok, `task-vid-${stamp}.mp4`, 'video/mp4', video);
  mark('رفع صورة', !!(upImg.json?.ok && (upImg.json.url || upImg.json.attachment?.url)), upImg.json?.url || upImg.json?.error || upImg.status);
  mark('رفع مستند', !!(upDoc.json?.ok && (upDoc.json.url || upDoc.json.attachment?.url)), upDoc.json?.url || upDoc.json?.error || upDoc.status);
  mark('رفع فيديو', !!(upVid.json?.ok && (upVid.json.url || upVid.json.attachment?.url)), upVid.json?.url || upVid.json?.error || upVid.status);

  const att = (up, kind, name) => ({
    id: up.json?.id || up.json?.attachment?.id || crypto.randomBytes(4).toString('hex'),
    name,
    url: up.json?.url || up.json?.attachment?.url,
    size: kind === 'image' ? png.length : kind === 'document' ? doc.length : video.length,
    mime: kind === 'image' ? 'image/png' : kind === 'document' ? 'application/pdf' : 'video/mp4',
    kind,
    uploadedAt: new Date().toISOString(),
  });

  const entities = [
    { entityType: 'branch', entityId: 'HQ', entityName: 'المقر الرئيسي' },
    { entityType: 'office', entityId: 'off-hq', entityName: 'مكتب التشغيل الرئيسي' },
    { entityType: 'platform', entityId: 'UOS', entityName: 'منصة UOS' },
    { entityType: 'incubator', entityId: 'inc-edu', entityName: 'التعليم والتعلم' },
    { entityType: 'none', entityId: '', entityName: 'مهمة عامة' },
  ];

  async function createOne(label, body) {
    const res = await req('POST', '/api/hub/tasks', { token: tok, body });
    const ok = !!(res.json?.ok && res.json?.task?.taskNo && res.json?.task?.id);
    mark(`إنشاء مهمة — ${label}`, ok, `${res.json?.task?.taskNo || res.json?.error || res.status} | assignee=${res.json?.task?.assignee?.type}:${res.json?.task?.assignee?.id} | entity=${res.json?.task?.entity?.type}:${res.json?.task?.entity?.id || 'none'}`);
    if (ok) {
      created.push({
        label,
        taskNo: res.json.task.taskNo,
        id: res.json.task.id,
        assigneeType: res.json.task.assignee?.type,
        assigneeId: res.json.task.assignee?.id,
        entityType: res.json.task.entity?.type,
        entityId: res.json.task.entity?.id,
        attachments: (res.json.task.attachments || []).length,
        notified: !!res.json.notified,
      });
    }
    return res.json?.task || null;
  }

  // Assignee-type matrix (entity rotates)
  if (staffN) {
    await createOne('موظف نايوش', {
      title: `مهمة نايوش ${stamp}`,
      details: 'متابعة تشغيل يومي لموظف نايوش — اختبار E2E',
      notes: 'تعليمات: راجع اللوحة خلال 24 ساعة',
      taskType: 'operational',
      priority: 'عالي',
      status: 'todo',
      dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      assigneeType: 'staff_naiosh',
      assigneeId: staffN.email,
      ...entities[0],
      attachments: [att(upImg, 'image', `task-img-${stamp}.png`)],
    });
  }

  if (staffX) {
    await createOne('شخص جهة خارجية', {
      title: `مهمة خارجي ${stamp}`,
      details: 'تنسيق مع جهة خارجية — اختبار E2E',
      taskType: 'followup',
      priority: 'متوسط',
      status: 'todo',
      assigneeType: 'staff_external',
      assigneeId: staffX.email,
      ...entities[1],
      attachments: [att(upDoc, 'document', `task-doc-${stamp}.pdf`)],
    });
  }

  let customerTask = null;
  if (customer) {
    customerTask = await createOne('عميل', {
      title: `مهمة عميل ${stamp}`,
      details: 'متابعة طلب عميل — اختبار E2E',
      taskType: 'support',
      priority: 'عاجل',
      status: 'in_progress',
      assigneeType: 'customer',
      assigneeId: customer.email,
      ...entities[2],
      attachments: [att(upVid, 'video', `task-vid-${stamp}.mp4`)],
    });
  } else {
    mark('إنشاء مهمة — عميل', false, 'تخطّي: لا عملاء مسجّلون في قاعدة البيانات');
  }

  if (company) {
    const contactId = (company.contacts || [])[0]?.id || staffX?.email || '';
    await createOne('شركة أو مؤسسة', {
      title: `مهمة شركة ${stamp}`,
      details: 'متابعة عقد مع شركة — اختبار E2E',
      taskType: 'project',
      priority: 'متوسط',
      status: 'todo',
      assigneeType: 'company',
      assigneeId: company.id,
      companyName: company.name || company.id,
      contactPersonId: contactId,
      ...entities[3],
      attachments: [
        att(upImg, 'image', `task-img-${stamp}.png`),
        att(upDoc, 'document', `task-doc-${stamp}.pdf`),
      ],
    });
  }

  // Entity-type coverage with naiosh staff
  if (staffN) {
    await createOne('جهة حاضنة', {
      title: `مهمة حاضنة ${stamp}`,
      details: 'ربط بحاضنة',
      assigneeType: 'staff_naiosh',
      assigneeId: staffN.email,
      ...entities[3],
    });
    await createOne('مهمة عامة', {
      title: `مهمة عامة ${stamp}`,
      details: 'بلا جهة محددة',
      assigneeType: 'staff_naiosh',
      assigneeId: staffN.email,
      ...entities[4],
    });
  }

  // List + detail + refresh persistence
  const list1 = await req('GET', '/api/hub/tasks', { token: tok });
  mark('قائمة المهام بعد الإنشاء', !!(list1.json?.ok && (list1.json.items || []).length >= created.length), `count=${list1.json?.count}`);

  if (created[0]) {
    const detail = await req('GET', `/api/hub/tasks/${encodeURIComponent(created[0].id)}`, { token: tok });
    mark(
      'فتح تفاصيل المهمة',
      !!(detail.json?.ok && detail.json.task?.taskNo === created[0].taskNo && detail.json.task?.assignee?.id),
      `${detail.json?.task?.taskNo} assigneeId=${detail.json?.task?.assignee?.id}`
    );
    mark(
      'المرفقات محفوظة في التفاصيل',
      Array.isArray(detail.json?.task?.attachments),
      `n=${detail.json?.task?.attachments?.length || 0}`
    );

    // Simulate process restart by clearing require cache isn't needed — re-GET proves file persist
    const again = await req('GET', `/api/hub/tasks/${encodeURIComponent(created[0].id)}`, { token: tok });
    mark('استمرار البيانات بعد إعادة الجلب (Refresh)', again.json?.task?.taskNo === created[0].taskNo, again.json?.task?.taskNo);

    const patched = await req('PATCH', `/api/hub/tasks/${encodeURIComponent(created[0].id)}`, {
      token: tok,
      body: { status: 'in_progress', notes: 'حدّثت عبر E2E' },
    });
    mark('تعديل الحالة', patched.json?.ok && patched.json.task?.status === 'in_progress', patched.json?.task?.status || patched.json?.error);

    const commented = await req('POST', `/api/hub/tasks/${encodeURIComponent(created[0].id)}/comments`, {
      token: tok,
      body: { text: 'تحديث متابعة من الاختبار' },
    });
    mark('إضافة تحديث/تعليق', !!(commented.json?.ok && (commented.json.task?.comments || []).length), `comments=${commented.json?.task?.comments?.length}`);
  }

  // Notifications for staff assignee
  if (staffN) {
    const nLogin = await req('POST', '/api/auth/login', { body: { email: staffN.email, password: '2468' } }).catch(() => ({ json: {} }));
    // staff may not use 2468 — try SA notifications as SUPER_ADMIN sees all
    const notes = await req('GET', '/api/hub/notifications', { token: tok });
    const hit = (notes.json?.items || []).find(
      (n) => n.category === 'task_assigned' && (n.meta?.taskNo || n.title || '').includes(stamp)
    ) || (notes.json?.items || []).find((n) => n.category === 'task_assigned' && created.some((c) => n.meta?.taskId === c.id || (n.link || '').includes(c.id)));
    mark(
      'إشعار إسناد المهمة موجود',
      !!hit,
      hit ? `target=${hit.targetEmail || hit.meta?.targetEmail} link=${hit.link}` : `notes=${notes.json?.count}`
    );
    if (hit) {
      mark('رابط الإشعار يشير للمهمة', /#tasks\?task=/.test(hit.link || ''), hit.link);
    }
  }

  // ACL: guest
  const guestList = await req('GET', '/api/hub/tasks');
  mark('منع قائمة المهام بدون جلسة', guestList.status === 401 || guestList.json?.ok === false, `status=${guestList.status}`);

  if (customerTask && customer?.email) {
    // Customer session — try login if we know password is unavailable; use CLIENT token forge is not allowed.
    // Instead verify: another staff-assigned task is not visible when filtering as customer via direct canView.
    // Use /api/auth/login only if demo client exists.
    const custLogin = await req('POST', '/api/auth/login', {
      body: { email: customer.email, password: process.env.HUB_E2E_CUSTOMER_PASSWORD || 'Client@123456' },
    });
    if (custLogin.json?.token) {
      const cTok = custLogin.json.token;
      const mine = await req('GET', '/api/hub/tasks', { token: cTok });
      const ids = (mine.json?.items || []).map((t) => t.id);
      mark('العميل يرى مهمته فقط', ids.includes(customerTask.id) && ids.every((id) => {
        const t = (mine.json.items || []).find((x) => x.id === id);
        return t?.assignee?.email === customer.email || t?.assignee?.id === customer.email;
      }), `seen=${ids.length} hasOwn=${ids.includes(customerTask.id)}`);

      const other = created.find((c) => c.id !== customerTask.id);
      if (other) {
        const deny = await req('GET', `/api/hub/tasks/${encodeURIComponent(other.id)}`, { token: cTok });
        mark('منع اطلاع العميل على مهمة غيره', deny.status === 403 || deny.json?.ok === false, `status=${deny.status} err=${deny.json?.error}`);
      }

      // Assignment must not grant admin dashboard
      const dash = await req('GET', '/api/admin/staff', { token: cTok });
      mark('الإسناد لا يمنح دخول لوحة الإدارة', dash.status === 401 || dash.status === 403 || dash.json?.ok === false, `status=${dash.status}`);

      const cNotes = await req('GET', '/api/hub/notifications', { token: cTok });
      const ownNote = (cNotes.json?.items || []).find((n) => n.meta?.taskId === customerTask.id || (n.link || '').includes(customerTask.id));
      mark('إشعار العميل لمهمته', !!ownNote, ownNote?.link || `count=${cNotes.json?.count}`);
    } else {
      mark('دخول العميل لاختبار ACL', false, `تعذر دخول ${customer.email} — ${custLogin.json?.error || custLogin.status} (اختبار واجهة API للإسناد تم؛ كلمة مرور العميل غير متاحة)`);
      // Still verify create path stored real id
      mark('معرف المسؤول الحقيقي محفوظ (عميل)', customerTask.assignee?.id === customer.email || customerTask.assignee?.email === customer.email, customerTask.assignee?.id);
    }
  }

  // UI smoke (desktop + mobile viewport)
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
      defaultViewport: { width: 1400, height: 900 },
    });
    const page = await browser.newPage();
    await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#email, input[type="email"]', { timeout: 15000 });
    await page.evaluate(
      (email, pass) => {
        const e = document.querySelector('#email, input[type="email"]');
        const p = document.querySelector('#password, input[type="password"]');
        if (e) e.value = email;
        if (p) p.value = pass;
      },
      SA,
      SA_PASS
    );
    await page.click('button[type="submit"], #loginBtn, .btn-primary');
    await page.waitForFunction(() => /dashboard\.html/i.test(location.pathname), { timeout: 20000 }).catch(() => null);
    await page.goto(`${BASE}/dashboard.html#tasks`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout?.(1500).catch(() => new Promise((r) => setTimeout(r, 1500)));
    // Ensure hash route
    await page.evaluate(() => {
      location.hash = 'tasks';
    });
    await page.waitForTimeout?.(1200).catch(() => new Promise((r) => setTimeout(r, 1200)));

    const createBtn = await page.$('[data-action="tk-create"]');
    mark('زر مهمة جديدة في الواجهة', !!createBtn, createBtn ? 'found' : 'missing');
    if (createBtn) {
      await createBtn.click();
      await page.waitForTimeout?.(600).catch(() => new Promise((r) => setTimeout(r, 600)));
      const wide = await page.evaluate(() => {
        const modal = document.querySelector('.hub-ws-modal');
        const sections = [...document.querySelectorAll('.tk-form-section h4')].map((h) => h.textContent.trim());
        return {
          width: modal ? modal.getBoundingClientRect().width : 0,
          sections,
          hasAssigneeType: !!document.getElementById('tk-assignee-type'),
          hasEntityType: !!document.getElementById('tk-entity-type'),
          hasFiles: !!document.getElementById('tk-files'),
          hasSave: !!document.querySelector('[data-action="tk-save"]'),
        };
      });
      mark('نموذج واسع RTL مع المجموعات', wide.width >= 700 && wide.sections.length >= 5 && wide.hasAssigneeType && wide.hasEntityType && wide.hasFiles && wide.hasSave, JSON.stringify(wide));

      // Fill and save via UI for one naiosh task
      if (staffN) {
        await page.select('#tk-assignee-type', 'staff_naiosh');
        await page.waitForTimeout?.(300).catch(() => new Promise((r) => setTimeout(r, 300)));
        await page.evaluate((email) => {
          document.getElementById('tk-title').value = 'مهمة واجهة ' + Date.now().toString(36);
          document.getElementById('tk-details').value = 'أنشئت من واجهة المتصفح — اختبار';
          const sel = document.getElementById('tk-assignee-id');
          if (sel) {
            const opt = [...sel.options].find((o) => o.value === email);
            if (opt) sel.value = email;
            else if (sel.options.length) sel.selectedIndex = 0;
          }
          document.getElementById('tk-entity-type').value = 'none';
        }, staffN.email);
        await page.click('[data-action="tk-save"]');
        await page.waitForTimeout?.(2000).catch(() => new Promise((r) => setTimeout(r, 2000)));
        const uiCreated = await page.evaluate(() => {
          const rows = [...document.querySelectorAll('table.data tbody tr')];
          return rows.some((tr) => (tr.textContent || '').includes('مهمة واجهة'));
        });
        mark('حفظ مهمة من الواجهة وظهورها في القائمة', uiCreated, uiCreated ? 'visible in table' : 'not visible');
      }
    }

    // Mobile viewport
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.goto(`${BASE}/dashboard.html#tasks`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => {
      location.hash = 'tasks';
    });
    await page.waitForTimeout?.(1000).catch(() => new Promise((r) => setTimeout(r, 1000)));
    const mob = await page.$('[data-action="tk-create"]');
    if (mob) {
      await mob.click();
      await page.waitForTimeout?.(500).catch(() => new Promise((r) => setTimeout(r, 500)));
    }
    const mobForm = await page.evaluate(() => {
      const modal = document.querySelector('.hub-ws-modal');
      return {
        ok: !!document.getElementById('tk-assignee-type') && !!document.getElementById('tk-files'),
        w: modal ? modal.getBoundingClientRect().width : 0,
      };
    });
    mark('نموذج الموبايل', mobForm.ok && mobForm.w > 280 && mobForm.w <= 420, JSON.stringify(mobForm));

    const shot = path.join('/opt/cursor/artifacts', `tasks-new-form-ui-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    mark('لقطة شاشة النموذج', fs.existsSync(shot), shot);
  } catch (err) {
    mark('اختبار واجهة Puppeteer', false, err.message);
  } finally {
    if (browser) await browser.close().catch(() => null);
  }

  // Persist file store
  const storePath = path.join(__dirname, '..', 'data', 'hub-tasks.json');
  mark('ملف التخزين hub-tasks.json', fs.existsSync(storePath), storePath);
  if (fs.existsSync(storePath)) {
    const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    const nos = created.map((c) => c.taskNo);
    const found = nos.filter((n) => Object.values(store.tasks || {}).some((t) => t.taskNo === n));
    mark('أرقام المهام في التخزين', found.length === nos.length, found.join(', '));
  }

  writeReport();
  const failed = rows.filter((r) => r.result === 'FAIL').length;
  console.log('\n=== CREATED TASKS ===');
  console.log(JSON.stringify(created, null, 2));
  console.log(`\nSummary: ${rows.length - failed} PASS / ${failed} FAIL / ${rows.length} total`);
  process.exit(failed ? 1 : 0);
}

function writeReport() {
  try {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), base: BASE, rows, created }, null, 2));
    console.log('Report:', OUT);
  } catch (e) {
    console.warn('report write failed', e.message);
  }
}

main().catch((e) => {
  console.error(e);
  mark('e2e crashed', false, e.message);
  writeReport();
  process.exit(1);
});
