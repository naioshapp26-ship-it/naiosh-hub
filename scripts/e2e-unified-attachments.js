/**
 * Unified attachments: employee form + entity-attachments API + isolation + limits meta.
 * SCALE_PORT=8871 node scripts/e2e-unified-attachments.js
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ART = '/opt/cursor/artifacts/unified-attachments';
const PORT = Number(process.env.SCALE_PORT || 8871);
const SA_EMAIL = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';

const rows = [];
function mark(fn, op, recordId, store, pass, note) {
  rows.push({ function: fn, operation: op, recordId: recordId || '', storage: store || '', result: pass ? 'PASS' : 'FAIL', note: String(note || '').slice(0, 300) });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${fn} | ${op} | ${recordId || '—'} | ${String(note || '').slice(0, 140)}`);
}

function req(method, urlPath, { token = '', body, headers: extra, type } = {}) {
  return new Promise((resolve) => {
    const payload = body != null ? (Buffer.isBuffer(body) ? body : JSON.stringify(body)) : null;
    const h = { Accept: 'application/json', ...(extra || {}) };
    if (token) {
      h.Authorization = `Bearer ${token}`;
      h['X-Hub-Token'] = token;
    }
    if (payload && !type) h['Content-Type'] = 'application/json';
    if (type) h['Content-Type'] = type;
    if (payload) h['Content-Length'] = Buffer.byteLength(payload);
    const r = http.request({ hostname: '127.0.0.1', port: PORT, path: urlPath, method, headers: h }, (res) => {
      const c = [];
      res.on('data', (d) => c.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(c);
        let j = {};
        try {
          j = JSON.parse(buf.toString('utf8'));
        } catch {
          j = { raw: buf.slice(0, 80).toString('utf8') };
        }
        resolve({ status: res.statusCode, j, buf });
      });
    });
    r.on('error', (e) => resolve({ status: 0, j: { error: e.message } }));
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
    AUTO_MIGRATE: process.env.DATABASE_URL ? '1' : '0',
    HUB_CUSTOMER_BACKFILL_BG: '0',
    HUB_SUPER_ADMIN_EMAIL: SA_EMAIL,
    HUB_SUPER_ADMIN_INITIAL_PASSWORD: SA_PASS,
  };
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  return {
    stop: () => { try { child.kill('SIGTERM'); } catch { /* */ } },
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

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  if (!SA_PASS) throw new Error('Need HUB_SUPER_ADMIN_INITIAL_PASSWORD');
  const srv = startServer();
  try {
    await waitHealth();
    mark('health', 'GET /api/health', '', 'server', true, 'up');

    const login = await req('POST', '/api/auth/login', { body: { email: SA_EMAIL, password: SA_PASS } });
    const token = login.j?.token;
    mark('staff_login', 'POST /api/auth/login', SA_EMAIL, 'staff-credentials', !!token, login.j?.user?.role);

    // Static: employee form no longer URL-only photo
    const formsSrc = fs.readFileSync(path.join(ROOT, 'js/hub-team-ops-forms.js'), 'utf8');
    const attachSrc = fs.readFileSync(path.join(ROOT, 'js/hub-form-attachments.js'), 'utf8');
    const dashHtml = fs.readFileSync(path.join(ROOT, 'dashboard.html'), 'utf8');
    mark('component_multi_zones', 'HubFormAttachments blockHtml', '', 'js/hub-form-attachments.js', /رفع صورة/.test(attachSrc) && /رفع ملف/.test(attachSrc) && /رفع فيديو/.test(attachSrc) && /persistToEntity/.test(attachSrc), 'multi+persist');
    mark('dashboard_loads_component', 'dashboard.html script', '', 'dashboard.html', /hub-form-attachments\.js/.test(dashHtml), '');
    mark('employee_form_has_attach_host', 'hto-employee-attachments', '', 'hub-team-ops-forms.js', /hto-employee-attachments/.test(formsSrc) && !/صورة الموظف \(رابط اختياري\)/.test(formsSrc), 'URL-only photo removed');

    // Upload image + register entity attachment
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    const up = await req('POST', '/api/hub/uploads', {
      token,
      body: png,
      type: 'image/png',
      headers: { 'X-File-Name': 'emp-photo.png', 'X-File-Type': 'image/png' },
    });
    const uploadId = up.j?.id || up.j?.storageRef;
    mark('upload_image', 'POST /uploads', uploadId, 'data/uploads', up.status === 201 || !!up.j?.ok, JSON.stringify(up.j).slice(0, 100));

    const empNo = `EMP-ATT-${Date.now().toString(36).toUpperCase()}`;
    const link = await req('POST', '/api/hub/entity-attachments', {
      token,
      body: {
        entityType: 'employee',
        entityId: empNo,
        category: 'image',
        uploadId,
        url: up.j?.url,
        mime: 'image/png',
        originalName: 'emp-photo.png',
        sizeBytes: png.length,
        ownerEmail: SA_EMAIL,
      },
      headers: { 'Idempotency-Key': `eatt-emp-${empNo}-${uploadId}` },
    });
    const attId = link.j?.item?.id;
    mark('link_employee_attachment', 'POST /entity-attachments', attId, 'entity-attachments.json', !!attId && link.status < 300, link.j?.error);

    // Idempotent re-POST
    const again = await req('POST', '/api/hub/entity-attachments', {
      token,
      body: {
        entityType: 'employee',
        entityId: empNo,
        category: 'image',
        uploadId,
        url: up.j?.url,
        mime: 'image/png',
        originalName: 'emp-photo.png',
        sizeBytes: png.length,
      },
      headers: { 'Idempotency-Key': `eatt-emp-${empNo}-${uploadId}` },
    });
    mark('idempotent_no_duplicate', 'POST same key', again.j?.item?.id, 'entity-attachments', again.j?.reused === true || again.j?.item?.id === attId, JSON.stringify({ reused: again.j?.reused, id: again.j?.item?.id }));

    const list = await req('GET', `/api/hub/entity-attachments?entityType=employee&entityId=${encodeURIComponent(empNo)}`, { token });
    mark('list_employee_attachments', 'GET entity-attachments', empNo, 'entity-attachments.json', (list.j?.items || []).some((i) => i.id === attId), `count=${(list.j?.items || []).length}`);

    const content = await req('GET', `/api/hub/entity-attachments/${encodeURIComponent(attId)}/content`, { token });
    mark('content_download', 'GET …/content', attId, 'uploads', content.status === 200 && content.buf?.length > 0, `bytes=${content.buf?.length || 0}`);

    // Isolation: customer cannot list/link another's employee attachments
    const stamp = Date.now().toString(36);
    const custEmail = `att.iso.${stamp}@naiosh-test.com`;
    await req('POST', '/api/auth/register', {
      body: {
        fullName: 'عميل عزل مرفقات',
        email: custEmail,
        phone: `05${String(Date.now() % 10000000000).padStart(10, '0').slice(-10)}`,
        password: 'Attach1!',
        confirmPassword: 'Attach1!',
        termsAccepted: true,
      },
    });
    const custLogin = await req('POST', '/api/auth/login', { body: { email: custEmail, password: 'Attach1!' } });
    const custTok = custLogin.j?.token;
    const leak = await req('GET', `/api/hub/entity-attachments?entityType=employee&entityId=${encodeURIComponent(empNo)}`, { token: custTok });
    const leakItems = leak.j?.items || [];
    mark('isolation_customer_no_staff_files', 'GET as customer', empNo, 'entity-attachments', leakItems.length === 0, `seen=${leakItems.length}`);

    // Upload limit meta still 1500MB
    const limitsOk = /1500/.test(fs.readFileSync(path.join(ROOT, 'js/hub-upload-limits.js'), 'utf8'));
    mark('limit_1500mb_policy', 'HubUploadLimits.MAX_FILE_MB', '1500', 'hub-upload-limits.js', limitsOk, '');

    // HIGH-priority forms inventory smoke (source checks)
    const staffAdmin = fs.readFileSync(path.join(ROOT, 'js/hub-staff-admin.js'), 'utf8');
    const workforce = fs.readFileSync(path.join(ROOT, 'js/hub-workforce.js'), 'utf8');
    const solutionsUi = fs.readFileSync(path.join(ROOT, 'js/hub-solutions-ui.js'), 'utf8');
    const costHtml = fs.readFileSync(path.join(ROOT, 'cost-reduction.html'), 'utf8');
    const solHtml = fs.readFileSync(path.join(ROOT, 'naiosh-solutions.html'), 'utf8');
    mark('staff_admin_has_attachments', 'sa-add-attachments', '', 'hub-staff-admin.js', /sa-add-attachments/.test(staffAdmin), '');
    mark('workforce_has_attachments', 'wf-employee-attachments', '', 'hub-workforce.js', /wf-employee-attachments/.test(workforce), '');
    mark(
      'solutions_wizard_attachments',
      'so-wizard-attachments + persistToEntity',
      '',
      'hub-solutions-ui.js',
      /so-wizard-attachments/.test(solutionsUi) &&
        /scheduleWizardAttachMount/.test(solutionsUi) &&
        /persistToEntity/.test(solutionsUi) &&
        /entityType:\s*['"]solution['"]/.test(solutionsUi),
      ''
    );
    mark(
      'solutions_pages_load_component',
      'hub-form-attachments.js',
      '',
      'naiosh-solutions.html + cost-reduction.html',
      /hub-form-attachments\.js/.test(solHtml) && /hub-form-attachments\.js/.test(costHtml),
      ''
    );
    const identityUi = fs.readFileSync(path.join(ROOT, 'js/hub-identity-ui.js'), 'utf8');
    const clientsWs = fs.readFileSync(path.join(ROOT, 'js/hub-clients-workspaces.js'), 'utf8');
    mark(
      'identity_form_attachments',
      'idn-user-attachments + persist',
      '',
      'hub-identity-ui.js',
      /idn-user-attachments/.test(identityUi) &&
        /scheduleIdentityAttachMount/.test(identityUi) &&
        /entityType:\s*['"]identity['"]/.test(identityUi),
      ''
    );
    mark(
      'clients_form_attachments',
      'cl-attachments + persist',
      '',
      'hub-clients-workspaces.js',
      /cl-attachments/.test(clientsWs) &&
        /scheduleClientAttachMount/.test(clientsWs) &&
        /entityType:\s*['"]client['"]/.test(clientsWs),
      ''
    );
  } catch (err) {
    mark('suite_error', err.message, '', '', false, err.stack);
  } finally {
    fs.writeFileSync(path.join(ART, 'server.log'), srv.log());
    srv.stop();
  }

  const report = {
    at: new Date().toISOString(),
    summary: { pass: rows.filter((r) => r.result === 'PASS').length, fail: rows.filter((r) => r.result === 'FAIL').length },
    rows,
    integrations: {
      connected: ['/api/hub/uploads', '/api/hub/entity-attachments', 'HubFormAttachments', 'HubUploadLimits 1500MB'],
      needs_external: ['true multipart resumable chunking across reverse-proxy (stream upload with progress is live)'],
    },
  };
  const md = [
    '# تقرير توحيد المرفقات — نايوش هوب 360',
    '',
    `التاريخ: ${report.at}`,
    `PASS: ${report.summary.pass} · FAIL: ${report.summary.fail}`,
    '',
    '| الوظيفة | العملية | رقم السجل | مكان الحفظ | النتيجة | ملاحظة |',
    '|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.function} | ${r.operation} | ${r.recordId || '—'} | ${r.storage || '—'} | **${r.result}** | ${String(r.note || '').replace(/\|/g, '/').slice(0, 120)} |`),
    '',
  ].join('\n');
  fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(ART, 'ops-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(ART, 'ops-report.md'), md);
  fs.writeFileSync(path.join(ROOT, 'docs/unified-attachments-ops-report.md'), md);
  console.log(md);
  process.exit(report.summary.fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
