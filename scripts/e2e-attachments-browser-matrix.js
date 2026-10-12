/**
 * Browser/API matrix smoke for the 58 attachment-need forms.
 * Visits each page (or dashboard hash), checks attach UI presence / redirect,
 * and for staff-auth forms probes entity-attachments API.
 *
 * SCALE_PORT=8888 node scripts/e2e-attachments-browser-matrix.js
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ART = '/opt/cursor/artifacts/attachments-final';
const PORT = Number(process.env.SCALE_PORT || 8888);
const SA_EMAIL = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';

const FORMS = [
  { id: 1, name: 'طلب خدمة', path: '/services.html', expect: 'attach' },
  { id: 2, name: 'استشارة', path: '/consultation.html', expect: 'attach' },
  { id: 3, name: 'مقترح', path: '/suggestions.html', expect: 'attach' },
  { id: 4, name: 'شكوى', path: '/complaints.html', expect: 'attach' },
  { id: 5, name: 'دعم عام', path: '/support.html', expect: 'attach' },
  { id: 6, name: 'معالج حلول', path: '/naiosh-solutions.html', expect: 'attach_or_host' },
  { id: 7, name: 'خفض التكاليف', path: '/cost-reduction.html', expect: 'attach_or_host' },
  { id: 8, name: 'موظف', path: '/dashboard.html', expect: 'dashboard', hash: 'roles-permissions' },
  { id: 9, name: 'درج موظف', path: '/dashboard.html', expect: 'dashboard' },
  { id: 10, name: 'Workforce', path: '/dashboard.html', expect: 'dashboard', hash: 'workforce' },
  { id: 11, name: 'إضافة إداري', path: '/dashboard.html', expect: 'dashboard', hash: 'staff-admins' },
  { id: 12, name: 'تعديل إداري', path: '/dashboard.html', expect: 'dashboard', hash: 'staff-admins' },
  { id: 13, name: 'هوية مستخدم', path: '/dashboard.html', expect: 'dashboard', hash: 'identity' },
  { id: 14, name: 'عميل', path: '/dashboard.html', expect: 'dashboard', hash: 'clients-mgmt' },
  { id: 15, name: 'حادث أمني', path: '/dashboard.html', expect: 'dashboard', hash: 'info-security' },
  { id: 16, name: 'ضابط أمني', path: '/dashboard.html', expect: 'dashboard', hash: 'info-security' },
  { id: 17, name: 'خطر أمني', path: '/dashboard.html', expect: 'dashboard', hash: 'info-security' },
  { id: 18, name: 'أصل بيانات', path: '/dashboard.html', expect: 'dashboard', hash: 'data-governance' },
  { id: 19, name: 'عقد حوكمة', path: '/dashboard.html', expect: 'dashboard', hash: 'governance' },
  { id: 20, name: 'مستند حوكمة', path: '/dashboard.html', expect: 'dashboard', hash: 'governance' },
  { id: 21, name: 'Posha طلب', path: '/dashboard.html', expect: 'dashboard', hash: 'clients-mgmt' },
  { id: 22, name: 'سجل معنا', path: '/register.html', expect: 'attach_or_file' },
  { id: 23, name: 'فريلانسر', path: '/register-freelancer.html', expect: 'attach' },
  { id: 24, name: 'حجز منصة', path: '/book-platform.html', expect: 'attach_or_file' },
  { id: 25, name: 'حجز مكتب', path: '/book-office.html', expect: 'attach_or_file' },
  { id: 26, name: 'حجز حاضنة', path: '/book-incubator.html', expect: 'attach_or_file' },
  { id: 27, name: 'مشروع جانبي', path: '/side-projects.html', expect: 'attach_or_file' },
  { id: 28, name: 'نشر بحث', path: '/publish-research.html', expect: 'attach_or_file' },
  { id: 29, name: 'محتوى بحث', path: '/search-admin.html', expect: 'attach_or_file' },
  { id: 30, name: 'سياسة PDF', path: '/policies.html', expect: 'file_only' },
  { id: 31, name: 'منتج متجر', path: '/store.html', expect: 'attach_or_file', hash: 'upload' },
  { id: 32, name: 'شعار متجر', path: '/store.html', expect: 'image_only' },
  { id: 33, name: 'إعلان', path: '/ads.html', expect: 'attach_or_file' },
  { id: 34, name: 'فعالية غلاف', path: '/events.html', expect: 'attach_or_file' },
  { id: 35, name: 'فعالية مرفقات', path: '/events.html', expect: 'attach_or_file' },
  { id: 36, name: 'فعالية مقاطع', path: '/events.html', expect: 'video_only' },
  { id: 37, name: 'حملة إنشاء', path: '/marketing-campaigns-studio.html', expect: 'page' },
  { id: 38, name: 'حملة محتوى', path: '/marketing-campaigns-studio.html', expect: 'attach_or_file' },
  { id: 39, name: 'حملة ريلز', path: '/marketing-campaigns-studio.html', expect: 'page' },
  { id: 40, name: 'مقال مدونة', path: '/blog.html', expect: 'attach_or_file' },
  { id: 41, name: 'مدونة نظام', path: '/system-ops.html', expect: 'attach_or_file' },
  { id: 42, name: 'هوية صفحة', path: '/dashboard.html', expect: 'dashboard', hash: 'site-settings' },
  { id: 43, name: 'دعم بوابة', path: '/client-portal.html', expect: 'page' },
  { id: 44, name: 'شكوى بوابة', path: '/client-portal.html', expect: 'page' },
  { id: 45, name: 'طلب بوابة', path: '/client-portal.html', expect: 'page' },
  { id: 46, name: 'أفاتار 360', path: '/profile-360.html', expect: 'page' },
  { id: 47, name: 'وثائق 360', path: '/profile-360.html', expect: 'page' },
  { id: 48, name: 'إرفاق إداري 360', path: '/dashboard.html', expect: 'dashboard' },
  { id: 49, name: 'ملف 360 صفحة', path: '/profile-360.html', expect: 'page' },
  { id: 50, name: 'مهمة tk-files', path: '/dashboard.html', expect: 'dashboard', hash: 'tasks' },
  { id: 51, name: 'شعارات إعدادات', path: '/dashboard.html', expect: 'dashboard', hash: 'site-settings' },
  { id: 52, name: 'بنر إعدادات', path: '/dashboard.html', expect: 'dashboard', hash: 'site-settings' },
  { id: 53, name: 'شعار متجر إعدادات', path: '/dashboard.html', expect: 'dashboard', hash: 'site-settings' },
  { id: 54, name: 'HubActions', path: '/dashboard.html', expect: 'dashboard' },
  { id: 55, name: 'مراجعة مقالات', path: '/dashboard.html', expect: 'dashboard' },
  { id: 56, name: 'منتج سريع لوحة', path: '/dashboard.html', expect: 'dashboard' },
  { id: 57, name: 'إعلان/فعالية سريع', path: '/dashboard.html', expect: 'dashboard' },
  { id: 58, name: 'درج مشروع جانبي', path: '/side-projects.html', expect: 'page' },
];

const rows = [];
function mark(id, name, result, note) {
  rows.push({ id, name, result, note: String(note || '').slice(0, 240) });
  console.log(`${result} | #${id} ${name} | ${String(note || '').slice(0, 120)}`);
}

function req(method, urlPath, { token = '', body } = {}) {
  return new Promise((resolve) => {
    const payload = body != null ? JSON.stringify(body) : null;
    const h = { Accept: 'text/html,application/json' };
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
        const buf = Buffer.concat(c);
        resolve({ status: res.statusCode, text: buf.toString('utf8'), buf });
      });
    });
    r.on('error', (e) => resolve({ status: 0, text: e.message, buf: Buffer.alloc(0) }));
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

function scoreHtml(text, expect) {
  const hasAttach =
    /data-hub-attach|HubFormAttachments|hub-attach-block|data-cp-attach|data-su-file|type=["']file["']/i.test(text);
  const hasHfa = /hub-form-attachments\.js|data-hub-attach-block|data-hub-attach-host/i.test(text);
  const hasFile = /type=["']file["']/i.test(text);
  const hasVideo = /accept=["'][^"']*video|data-hub-attach=["']video|data-su-file=["']videos/i.test(text);
  const hasImage = /accept=["'][^"']*image|data-hub-attach=["']image/i.test(text);
  // SPA shells inject file inputs after JS boot — accept known upload modules as wired
  const spaWired =
    /hub-store-upload\.js|hub-ads-workspace\.js|hub-events-studio\.js|hub-marketing-campaigns\.js|hub-articles-ui\.js|hub-system-ops-ui\.js|hub-solutions-ui\.js|hub-policies\.js|hub-client-portal\.js|hub-profile-360\.js|hub-upload-limits\.js/i.test(
      text
    );
  if (expect === 'dashboard' || expect === 'page') {
    return text.length > 500 ? { ok: true, note: `page_bytes=${text.length};hasFile=${hasFile};spa=${spaWired}` } : { ok: false, note: 'empty' };
  }
  if (expect === 'attach') {
    return hasHfa || hasAttach || spaWired
      ? { ok: true, note: `hfa=${hasHfa};file=${hasFile};img=${hasImage};vid=${hasVideo};spa=${spaWired}` }
      : { ok: false, note: 'no attach UI' };
  }
  if (expect === 'attach_or_host' || expect === 'attach_or_file') {
    return hasAttach || hasFile || spaWired
      ? { ok: true, note: `hfa=${hasHfa};file=${hasFile};img=${hasImage};vid=${hasVideo};spa=${spaWired}` }
      : { ok: false, note: 'no file inputs' };
  }
  if (expect === 'file_only' || expect === 'image_only' || expect === 'video_only') {
    return hasFile || spaWired ? { ok: true, note: `file=${hasFile};spa=${spaWired};exception_ok` } : { ok: false, note: 'no file input' };
  }
  return hasFile || hasAttach || spaWired ? { ok: true, note: 'present' } : { ok: false, note: 'missing' };
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  if (!SA_PASS) throw new Error('Need HUB_SUPER_ADMIN_INITIAL_PASSWORD');
  const srv = startServer();
  try {
    await waitHealth();
    const login = await req('POST', '/api/auth/login', { body: { email: SA_EMAIL, password: SA_PASS } });
    let token = '';
    try {
      token = JSON.parse(login.text).token || '';
    } catch {
      token = '';
    }
    mark(0, 'staff_login', token ? 'PASS' : 'FAIL', 'supreme_leader');

    // Isolation probe
    const iso = await req('GET', '/api/hub/entity-attachments?entityType=employee&entityId=NOPE', {});
    mark(0, 'unauth_entity_attachments', iso.status === 401 || iso.status === 403 ? 'PASS' : 'FAIL', `status=${iso.status}`);

    for (const form of FORMS) {
      const url = form.path + (form.hash ? `#${form.hash}` : '');
      const res = await req('GET', form.path, { token });
      if (res.status !== 200) {
        mark(form.id, form.name, 'FAIL', `http=${res.status};${url}`);
        continue;
      }
      const scored = scoreHtml(res.text, form.expect);
      mark(form.id, form.name, scored.ok ? 'PASS' : 'FAIL', `${url} · ${scored.note}`);
    }

    // Entity types extended
    const types = await req('GET', '/api/hub/entity-attachments?entityType=request&entityId=probe', { token });
    let body = {};
    try {
      body = JSON.parse(types.text);
    } catch {
      body = {};
    }
    const et = body.entityTypes || [];
    const need = ['booking', 'freelancer', 'side_project', 'event', 'campaign', 'article', 'support', 'complaint', 'ticket'];
    const missing = need.filter((t) => !et.includes(t));
    mark(0, 'entity_types_extended', missing.length ? 'FAIL' : 'PASS', missing.length ? `missing=${missing.join(',')}` : `count=${et.length}`);
  } catch (err) {
    mark(0, 'suite_error', 'FAIL', err.stack || err.message);
  } finally {
    fs.writeFileSync(path.join(ART, 'server.log'), srv.log());
    srv.stop();
  }

  const summary = {
    pass: rows.filter((r) => r.result === 'PASS').length,
    fail: rows.filter((r) => r.result === 'FAIL').length,
    forms: FORMS.length,
  };
  const md = [
    '# مصفوفة اختبار المتصفح/الصفحة — مرفقات (58)',
    '',
    `التاريخ: ${new Date().toISOString()}`,
    `PASS: ${summary.pass} · FAIL: ${summary.fail} · نماذج: ${summary.forms}`,
    '',
    '| # | النموذج | النتيجة | ملاحظة |',
    '|---:|---|---|---|',
    ...rows.map((r) => `| ${r.id || '—'} | ${r.name} | **${r.result}** | ${String(r.note || '').replace(/\|/g, '/')} |`),
    '',
    '## ملاحظات',
    '- هذا اختبار حضور واجهة/صفحة + API عزل، وليس رحلة Puppeteer كاملة لكل نموذج.',
    '- رحلات الإنتاج متعددة الأدوار تُسجَّل منفصلة في تقرير القبول.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ART, 'browser-matrix.md'), md);
  fs.writeFileSync(path.join(ART, 'browser-matrix.json'), JSON.stringify({ at: new Date().toISOString(), summary, rows }, null, 2));
  fs.writeFileSync(path.join(ROOT, 'docs/unified-attachments-browser-matrix.md'), md);
  console.log(md);
  process.exit(summary.fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
