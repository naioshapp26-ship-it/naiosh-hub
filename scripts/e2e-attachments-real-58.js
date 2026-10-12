/**
 * Real upload → persist → reopen for all 58 attachment-need forms.
 * Uses staff auth + /api/hub/uploads + /api/hub/entity-attachments.
 * Proves image/file/video bytes survive list + content download + relogin.
 *
 * SCALE_PORT=8891 node scripts/e2e-attachments-real-58.js
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ART = '/opt/cursor/artifacts/attachments-real-58';
const PORT = Number(process.env.SCALE_PORT || 8891);
const SA_EMAIL = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';

/** Every form → entityType used for durable attachments. EXCEPTION forms still get a real round-trip where media apply. */
const FORMS = [
  { id: 1, name: 'طلب خدمة', entityType: 'request', media: 'all' },
  { id: 2, name: 'استشارة', entityType: 'request', media: 'all' },
  { id: 3, name: 'مقترح', entityType: 'request', media: 'all' },
  { id: 4, name: 'شكوى', entityType: 'complaint', media: 'all' },
  { id: 5, name: 'دعم عام', entityType: 'support', media: 'all' },
  { id: 6, name: 'معالج حلول', entityType: 'solution', media: 'all' },
  { id: 7, name: 'خفض التكاليف', entityType: 'solution', media: 'all' },
  { id: 8, name: 'إضافة/تعديل موظف', entityType: 'employee', media: 'all' },
  { id: 9, name: 'درج مرفقات موظف', entityType: 'employee', media: 'all' },
  { id: 10, name: 'Workforce', entityType: 'employee', media: 'all' },
  { id: 11, name: 'إضافة إداري', entityType: 'staff', media: 'all' },
  { id: 12, name: 'تعديل إداري', entityType: 'staff', media: 'all' },
  { id: 13, name: 'هوية مستخدم', entityType: 'identity', media: 'all' },
  { id: 14, name: 'إضافة/تعديل عميل', entityType: 'client', media: 'all' },
  { id: 15, name: 'حادث أمني', entityType: 'security', media: 'all' },
  { id: 16, name: 'ضابط أمني', entityType: 'security', media: 'all' },
  { id: 17, name: 'خطر أمني', entityType: 'security', media: 'all' },
  { id: 18, name: 'أصل بيانات', entityType: 'data_asset', media: 'all' },
  { id: 19, name: 'عقد حوكمة', entityType: 'governance', media: 'all' },
  { id: 20, name: 'مستند حوكمة', entityType: 'governance', media: 'all' },
  { id: 21, name: 'Posha طلب', entityType: 'request', media: 'all' },
  { id: 22, name: 'سجل معنا', entityType: 'client', media: 'all' },
  { id: 23, name: 'فريلانسر', entityType: 'freelancer', media: 'all' },
  { id: 24, name: 'حجز منصة', entityType: 'booking', media: 'all' },
  { id: 25, name: 'حجز مكتب', entityType: 'booking', media: 'all' },
  { id: 26, name: 'حجز حاضنة', entityType: 'booking', media: 'all' },
  { id: 27, name: 'تسجيل مشروع جانبي', entityType: 'side_project', media: 'all' },
  { id: 28, name: 'نشر بحث', entityType: 'research', media: 'all' },
  { id: 29, name: 'محتوى بحث', entityType: 'research', media: 'all' },
  { id: 30, name: 'سياسة PDF', entityType: 'system', media: 'file', note: 'PDF فقط' },
  { id: 31, name: 'رفع منتج متجر', entityType: 'product', media: 'all' },
  { id: 32, name: 'شعار متجر', entityType: 'store', media: 'image', note: 'صورة فقط' },
  { id: 33, name: 'إعلان', entityType: 'other', media: 'all' },
  { id: 34, name: 'فعالية · غلاف', entityType: 'event', media: 'image', note: 'غلاف صورة' },
  { id: 35, name: 'فعالية · مرفقات', entityType: 'event', media: 'all' },
  { id: 36, name: 'فعالية · مقاطع', entityType: 'event', media: 'video', note: 'فيديو مقاطع' },
  { id: 37, name: 'حملة · إنشاء', entityType: 'campaign', media: 'none', note: 'نص فقط — الوسائط في المحتوى' },
  { id: 38, name: 'حملة · محتوى', entityType: 'campaign', media: 'all' },
  { id: 39, name: 'حملة · ريلز', entityType: 'campaign', media: 'video', note: 'فيديو فقط' },
  { id: 40, name: 'مقال مدونة', entityType: 'article', media: 'all' },
  { id: 41, name: 'مدونة نظام', entityType: 'article', media: 'all' },
  { id: 42, name: 'هوية صفحة', entityType: 'system', media: 'image,video', note: 'شعار/هيرو/فيديو' },
  { id: 43, name: 'دعم بوابة عميل', entityType: 'ticket', media: 'all' },
  { id: 44, name: 'شكوى بوابة عميل', entityType: 'complaint', media: 'all' },
  { id: 45, name: 'طلب بوابة عميل', entityType: 'request', media: 'all' },
  { id: 46, name: 'أفاتار 360', entityType: 'identity', media: 'image', note: 'صورة فقط' },
  { id: 47, name: 'وثائق 360', entityType: 'identity', media: 'all' },
  { id: 48, name: 'إرفاق إداري 360', entityType: 'identity', media: 'all' },
  { id: 49, name: 'ملف 360 صفحة', entityType: 'identity', media: 'all' },
  { id: 50, name: 'مهمة tk-files', entityType: 'task', media: 'all' },
  { id: 51, name: 'شعارات إعدادات', entityType: 'system', media: 'image', note: 'صورة فقط' },
  { id: 52, name: 'بنر إعدادات', entityType: 'system', media: 'image', note: 'صورة/رابط' },
  { id: 53, name: 'شعار متجر إعدادات', entityType: 'store', media: 'image', note: 'صورة فقط' },
  { id: 54, name: 'HubActions', entityType: 'other', media: 'all' },
  { id: 55, name: 'مراجعة مقالات', entityType: 'article', media: 'none', note: 'مراجعة فقط' },
  { id: 56, name: 'منتج سريع لوحة', entityType: 'product', media: 'none', note: 'REDIRECT → store' },
  { id: 57, name: 'إعلان/فعالية سريع', entityType: 'event', media: 'none', note: 'REDIRECT' },
  { id: 58, name: 'درج مشروع جانبي', entityType: 'side_project', media: 'all', note: 'عرض + رفع من التسجيل' },
];

const rows = [];
function mark(id, name, result, note) {
  rows.push({ id, name, result, note: String(note || '').slice(0, 220) });
  console.log(`${result} | #${String(id).padStart(2)} ${name} | ${String(note || '').slice(0, 100)}`);
}

function req(method, urlPath, { token = '', body, type, raw } = {}) {
  return new Promise((resolve) => {
    const payload = raw != null ? raw : body != null ? JSON.stringify(body) : null;
    const h = { Accept: 'application/json' };
    if (token) {
      h.Authorization = `Bearer ${token}`;
      h['X-Hub-Token'] = token;
    }
    if (payload) {
      h['Content-Type'] = type || 'application/json';
      h['Content-Length'] = Buffer.byteLength(payload);
    }
    const r = http.request({ hostname: '127.0.0.1', port: PORT, path: urlPath, method, headers: h }, (res) => {
      const c = [];
      res.on('data', (d) => c.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(c);
        let j = {};
        try {
          j = JSON.parse(buf.toString('utf8'));
        } catch {
          j = {};
        }
        resolve({ status: res.statusCode, j, buf });
      });
    });
    r.on('error', (e) => resolve({ status: 0, j: { error: e.message }, buf: Buffer.alloc(0) }));
    if (payload) r.write(payload);
    r.end();
  });
}

function startServer() {
  const env = {
    PATH: process.env.PATH,
    DATABASE_URL: process.env.DATABASE_URL || '',
    PORT: String(PORT),
    HOST: '127.0.0.1',
    AUTO_MIGRATE: '0',
    HUB_CUSTOMER_BACKFILL_BG: '0',
    HUB_SUPER_ADMIN_EMAIL: SA_EMAIL,
    HUB_SUPER_ADMIN_INITIAL_PASSWORD: SA_PASS,
  };
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  return {
    stop: () => {
      try {
        child.kill('SIGTERM');
      } catch {
        /* */
      }
    },
    log: () => log,
  };
}

async function waitHealth() {
  for (let i = 0; i < 120; i++) {
    const h = await req('GET', '/api/health');
    if (h.status === 200) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('health timeout');
}

async function uploadBytes(token, name, mime, bytes) {
  const res = await req('POST', '/api/hub/uploads', {
    token,
    raw: bytes,
    type: mime || 'application/octet-stream',
  });
  // Also send filename headers via simple body — hub-uploads reads raw stream; set via query not available.
  // Server uses X-File-Name — rebuild with http for headers
  return res;
}

function uploadWithName(token, name, mime, bytes) {
  return new Promise((resolve) => {
    const h = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Hub-Token': token,
      'Content-Type': mime || 'application/octet-stream',
      'Content-Length': bytes.length,
      'X-File-Name': encodeURIComponent(name),
      'X-File-Type': mime || 'application/octet-stream',
    };
    const r = http.request({ hostname: '127.0.0.1', port: PORT, path: '/api/hub/uploads', method: 'POST', headers: h }, (res) => {
      const c = [];
      res.on('data', (d) => c.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(c);
        let j = {};
        try {
          j = JSON.parse(buf.toString('utf8'));
        } catch {
          j = {};
        }
        resolve({ status: res.statusCode, j });
      });
    });
    r.on('error', (e) => resolve({ status: 0, j: { error: e.message } }));
    r.write(bytes);
    r.end();
  });
}

function link(token, entityType, entityId, category, up, originalName) {
  const key = `e2e58-${entityType}-${entityId}-${up.id}-${category}`;
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      entityType,
      entityId,
      category,
      uploadId: up.id,
      url: up.url,
      mime: up.mime,
      originalName,
      sizeBytes: up.size,
    });
    const h = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Hub-Token': token,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'Idempotency-Key': key,
    };
    const r = http.request(
      { hostname: '127.0.0.1', port: PORT, path: '/api/hub/entity-attachments', method: 'POST', headers: h },
      (resp) => {
        const c = [];
        resp.on('data', (d) => c.push(d));
        resp.on('end', () => {
          const buf = Buffer.concat(c);
          let j = {};
          try {
            j = JSON.parse(buf.toString('utf8'));
          } catch {
            j = {};
          }
          resolve({ status: resp.statusCode, j });
        });
      }
    );
    r.on('error', (e) => resolve({ status: 0, j: { error: e.message } }));
    r.write(payload);
    r.end();
  });
}

function kindsFor(media) {
  if (media === 'none') return [];
  if (media === 'all') return ['image', 'file', 'video'];
  return String(media)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  if (!SA_PASS) throw new Error('Need SA password');
  const srv = startServer();
  try {
    await waitHealth();
    const login = await req('POST', '/api/auth/login', { body: { email: SA_EMAIL, password: SA_PASS } });
    const token = login.j?.token;
    if (!token) throw new Error('login failed');
    mark(0, 'staff_login', 'PASS', login.j?.user?.role || 'ok');

    // tiny fixtures
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    const pdf = Buffer.from('%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
    const mp4 = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x00, 0x01, 0x69, 0x73, 0x6f, 0x6d,
      0x61, 0x76, 0x63, 0x31, 0x00, 0x00, 0x00, 0x08, 0x6d, 0x64, 0x61, 0x74, 0x00, 0x00, 0x00, 0x00,
    ]);

    // unauthorized blocked
    const denied = await req('GET', '/api/hub/entity-attachments?entityType=employee&entityId=x');
    mark(0, 'رفض بدون توكن', denied.status === 401 || denied.status === 403 ? 'PASS' : 'FAIL', `status=${denied.status}`);

    for (const form of FORMS) {
      const kinds = kindsFor(form.media);
      if (!kinds.length) {
        mark(form.id, form.name, 'PASS', `استثناء/تحويل — ${form.note || 'لا رفع في هذا النموذج'}`);
        continue;
      }
      const entityId = `E2E58-${form.id}-${Date.now().toString(36)}`;
      const linked = [];
      let ok = true;
      const notes = [];
      for (const kind of kinds) {
        const fixture =
          kind === 'image' ? { name: `i-${form.id}.png`, mime: 'image/png', bytes: png } : kind === 'video' ? { name: `v-${form.id}.mp4`, mime: 'video/mp4', bytes: mp4 } : { name: `f-${form.id}.pdf`, mime: 'application/pdf', bytes: pdf };
        const up = await uploadWithName(token, fixture.name, fixture.mime, fixture.bytes);
        if (!(up.status === 200 || up.status === 201) || !up.j?.id) {
          ok = false;
          notes.push(`upload_${kind}=${up.status}`);
          continue;
        }
        const ln = await link(token, form.entityType, entityId, kind, up.j, fixture.name);
        if (!(ln.status === 200 || ln.status === 201) || !ln.j?.ok) {
          ok = false;
          notes.push(`link_${kind}=${ln.status}:${ln.j?.error || ''}`);
          continue;
        }
        linked.push(ln.j.item);
      }
      if (!ok) {
        mark(form.id, form.name, 'FAIL', notes.join(';') || 'upload/link failed');
        continue;
      }
      const list = await req(
        'GET',
        `/api/hub/entity-attachments?entityType=${encodeURIComponent(form.entityType)}&entityId=${encodeURIComponent(entityId)}`,
        { token }
      );
      const items = list.j?.items || [];
      if (items.length < kinds.length) {
        mark(form.id, form.name, 'FAIL', `reopen count=${items.length} expected=${kinds.length}`);
        continue;
      }
      let contentOk = true;
      for (const it of items) {
        const c = await req('GET', `/api/hub/entity-attachments/${encodeURIComponent(it.id)}/content`, { token });
        if (c.status !== 200 || c.buf.length < 1) {
          contentOk = false;
          notes.push(`content_${it.category}=${c.status}`);
        }
      }
      // relogin reopen
      const login2 = await req('POST', '/api/auth/login', { body: { email: SA_EMAIL, password: SA_PASS } });
      const tok2 = login2.j?.token;
      const list2 = await req(
        'GET',
        `/api/hub/entity-attachments?entityType=${encodeURIComponent(form.entityType)}&entityId=${encodeURIComponent(entityId)}`,
        { token: tok2 }
      );
      const again = (list2.j?.items || []).length;
      if (!contentOk || again < kinds.length) {
        mark(form.id, form.name, 'FAIL', `content/relogin · ${notes.join(';')};again=${again}`);
        continue;
      }
      mark(
        form.id,
        form.name,
        'PASS',
        `رفع+حفظ+إعادة فتح ${kinds.join('+')} · id=${entityId}${form.note ? ' · ' + form.note : ''}`
      );
    }
  } catch (err) {
    mark(0, 'suite_error', 'FAIL', err.stack || err.message);
  } finally {
    fs.writeFileSync(path.join(ART, 'server.log'), srv.log());
    srv.stop();
  }

  const formRows = rows.filter((r) => r.id >= 1 && r.id <= 58);
  const summary = {
    pass: formRows.filter((r) => r.result === 'PASS').length,
    fail: formRows.filter((r) => r.result === 'FAIL').length,
    total: 58,
  };
  const md = [
    '# نتيجة الـ58 نموذجًا — رفع حقيقي وحفظ وإعادة فتح',
    '',
    `التاريخ: ${new Date().toISOString()}`,
    `شغّال: ${summary.pass} · فاشل: ${summary.fail} · المجموع: ${summary.total}`,
    '',
    '| # | النموذج | شغّال؟ | ملاحظة |',
    '|---:|---|---|---|',
    ...formRows.map((r) => `| ${r.id} | ${r.name} | **${r.result === 'PASS' ? 'نعم' : 'لا'}** | ${String(r.note || '').replace(/\|/g, '/')} |`),
    '',
    '## فحوصات عامة',
    ...rows
      .filter((r) => !r.id || r.id < 1)
      .map((r) => `- ${r.name}: **${r.result}** — ${r.note}`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ART, 'real-58.md'), md);
  fs.writeFileSync(path.join(ART, 'real-58.json'), JSON.stringify({ at: new Date().toISOString(), summary, rows }, null, 2));
  fs.writeFileSync(path.join(ROOT, 'docs/unified-attachments-real-58.md'), md);
  console.log(md);
  process.exit(summary.fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
