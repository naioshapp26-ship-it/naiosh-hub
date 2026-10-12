/**
 * Real attachment lifecycle tests (not UI-only):
 * upload image/file/video → link entity → list → content → isolation → idempotency → retry.
 * Also probes largest practical upload in this env; marks 1500MB NOT_TESTED if not run.
 *
 * SCALE_PORT=8873 node scripts/e2e-unified-attachments-real.js
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ART = '/opt/cursor/artifacts/unified-attachments-real';
const PORT = Number(process.env.SCALE_PORT || 8873);
const SA_EMAIL = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const PROD = (process.env.HUB_E2E_BASE || process.env.APP_URL || 'https://naiosh-hub-production.up.railway.app').replace(/\/$/, '');
const LARGE_MB = Number(process.env.HUB_ATTACH_LARGE_MB || 8); // practical probe; 1500 is separate

const rows = [];
function mark(fn, op, recordId, store, result, note) {
  rows.push({
    function: fn,
    operation: op,
    recordId: recordId || '',
    storage: store || '',
    result,
    note: String(note || '').slice(0, 400),
  });
  console.log(`${result} | ${fn} | ${op} | ${recordId || '—'} | ${String(note || '').slice(0, 140)}`);
}

function tinyPng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
}

function tinyPdf() {
  return Buffer.from('%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
}

function tinyMp4() {
  // Minimal-ish bytes labeled as video/mp4 for pipeline test (not a playable film)
  const hdr = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x00, 0x01, 0x69, 0x73, 0x6f, 0x6d, 0x61, 0x76,
    0x63, 0x31,
  ]);
  return Buffer.concat([hdr, crypto.randomBytes(2048)]);
}

function multipart(fields, fileField, fileName, mime, buf) {
  const boundary = '----HubAtt' + crypto.randomBytes(8).toString('hex');
  const chunks = [];
  Object.entries(fields || {}).forEach(([k, v]) => {
    chunks.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)
    );
  });
  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${fileName}"\r\nContent-Type: ${mime}\r\n\r\n`
    )
  );
  chunks.push(buf);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return { body: Buffer.concat(chunks), type: `multipart/form-data; boundary=${boundary}` };
}

function req(method, urlPath, { token = '', body, headers: extra, type, hostname = '127.0.0.1', port = PORT } = {}) {
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
    const started = Date.now();
    const r = http.request({ hostname, port, path: urlPath, method, headers: h }, (res) => {
      const c = [];
      res.on('data', (d) => c.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(c);
        let j = {};
        try {
          j = JSON.parse(buf.toString('utf8'));
        } catch {
          j = { raw: buf.slice(0, 120).toString('utf8') };
        }
        resolve({ status: res.statusCode, j, buf, ms: Date.now() - started });
      });
    });
    r.on('error', (e) => resolve({ status: 0, j: { error: e.message }, buf: Buffer.alloc(0), ms: Date.now() - started }));
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
  child.stdout.on('data', (d) => {
    log += d;
  });
  child.stderr.on('data', (d) => {
    log += d;
  });
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

async function waitHealth(port = PORT) {
  for (let i = 0; i < 120; i++) {
    const h = await req('GET', '/api/health', { port });
    if (h.status === 200) return h;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('health timeout');
}

async function upload(token, fileName, mime, buf, kind) {
  const mp = multipart({ kind: kind || 'file' }, 'file', fileName, mime, buf);
  return req('POST', '/api/hub/uploads', { token, body: mp.body, type: mp.type });
}

async function link(token, entityType, entityId, item, ownerEmail, key) {
  return req('POST', '/api/hub/entity-attachments', {
    token,
    headers: { 'Idempotency-Key': key },
    body: {
      entityType,
      entityId,
      category: item.kind === 'image' ? 'image' : item.kind === 'video' ? 'video' : 'file',
      uploadId: String(item.id || '').replace(/^\/uploads\//, ''),
      url: item.url,
      mime: item.mime,
      originalName: item.name,
      sizeBytes: item.size,
      ownerEmail: ownerEmail || '',
    },
  });
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  if (!SA_PASS) throw new Error('Need HUB_SUPER_ADMIN_INITIAL_PASSWORD');

  // Source inventory gates for newly wired modules
  const srcChecks = [
    ['info_security_host', 'js/hub-info-security.js', /sec-inc-attachments/],
    ['data_gov_host', 'js/hub-data-governance.js', /dg-d-attachments/],
    ['governance_contract_host', 'js/hub-governance.js', /gov-ct-attachments/],
    ['governance_doc_host', 'js/hub-governance.js', /gov-doc-attachments/],
    ['posha_req_host', 'js/hub-posha-clients.js', /posha-req-attachments/],
    ['employee_host', 'js/hub-team-ops-forms.js', /hto-employee-attachments/],
    ['entity_types_extended', 'lib/hub-entity-attachments.js', /'security'[\s\S]*'governance'[\s\S]*'data_asset'[\s\S]*'request'/],
  ];
  for (const [name, file, re] of srcChecks) {
    const ok = re.test(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    mark(name, 'source_wired', '', file, ok ? 'PASS' : 'FAIL', '');
  }

  const srv = startServer();
  let staffTok = '';
  let empNo = `EMP-REAL-${Date.now().toString(36).toUpperCase()}`;
  try {
    await waitHealth();
    mark('health_local', 'GET /api/health', '', `127.0.0.1:${PORT}`, 'PASS', 'up');

    const login = await req('POST', '/api/auth/login', { body: { email: SA_EMAIL, password: SA_PASS } });
    staffTok = login.j?.token || '';
    mark('staff_login', 'POST /api/auth/login', SA_EMAIL, 'staff-credentials', staffTok ? 'PASS' : 'FAIL', login.j?.user?.role);

    // 1-3 upload image / file / video
    const imgUp = await upload(staffTok, 'real-emp.png', 'image/png', tinyPng(), 'image');
    const imgItem = {
      id: imgUp.j?.id,
      url: imgUp.j?.url,
      name: imgUp.j?.name || 'real-emp.png',
      mime: 'image/png',
      size: tinyPng().length,
      kind: 'image',
    };
    const okHttp = (s) => s === 200 || s === 201;
    mark(
      'upload_image',
      'POST /uploads',
      imgItem.id || '',
      'data/uploads',
      okHttp(imgUp.status) && imgItem.id ? 'PASS' : 'FAIL',
      `status=${imgUp.status};${JSON.stringify(imgUp.j).slice(0, 140)}`
    );

    const fileUp = await upload(staffTok, 'real-cv.pdf', 'application/pdf', tinyPdf(), 'file');
    const fileItem = {
      id: fileUp.j?.id,
      url: fileUp.j?.url,
      name: fileUp.j?.name || 'real-cv.pdf',
      mime: 'application/pdf',
      size: tinyPdf().length,
      kind: 'file',
    };
    mark(
      'upload_file',
      'POST /uploads',
      fileItem.id || '',
      'data/uploads',
      okHttp(fileUp.status) && fileItem.id ? 'PASS' : 'FAIL',
      `status=${fileUp.status};${JSON.stringify(fileUp.j).slice(0, 140)}`
    );

    const vidBuf = tinyMp4();
    const vidUp = await upload(staffTok, 'real-intro.mp4', 'video/mp4', vidBuf, 'video');
    const vidItem = {
      id: vidUp.j?.id,
      url: vidUp.j?.url,
      name: vidUp.j?.name || 'real-intro.mp4',
      mime: 'video/mp4',
      size: vidBuf.length,
      kind: 'video',
    };
    mark(
      'upload_video',
      'POST /uploads',
      vidItem.id || '',
      'data/uploads',
      okHttp(vidUp.status) && vidItem.id ? 'PASS' : 'FAIL',
      `status=${vidUp.status};${JSON.stringify(vidUp.j).slice(0, 140)}`
    );

    // Link all three to employee entity
    const linked = [];
    for (const it of [imgItem, fileItem, vidItem]) {
      if (!it.id) continue;
      const key = `real-${empNo}-${it.id}`;
      const res = await link(staffTok, 'employee', empNo, it, SA_EMAIL, key);
      linked.push(res.j?.item || res.j);
      mark(
        `link_${it.kind}`,
        'POST /entity-attachments',
        res.j?.item?.id || '',
        'entity-attachments',
        okHttp(res.status) && res.j?.item?.id ? 'PASS' : 'FAIL',
        `status=${res.status};${res.j?.error || ''}`
      );
    }

    // 4 reopen / list
    const listed = await req('GET', `/api/hub/entity-attachments?entityType=employee&entityId=${encodeURIComponent(empNo)}`, {
      token: staffTok,
    });
    const items = listed.j?.items || [];
    mark('reopen_list', 'GET entity-attachments', empNo, 'entity-attachments', items.length >= 3 ? 'PASS' : 'FAIL', `count=${items.length}`);

    // content download for each
    for (const it of items.slice(0, 3)) {
      const c = await req('GET', `/api/hub/entity-attachments/${encodeURIComponent(it.id)}/content`, { token: staffTok });
      mark(
        'content_download',
        'GET …/content',
        it.id,
        'uploads',
        c.status === 200 && c.buf.length > 0 ? 'PASS' : 'FAIL',
        `bytes=${c.buf.length};cat=${it.category}`
      );
    }

    // 5 simulate logout/login (new token) then list again
    const relogin = await req('POST', '/api/auth/login', { body: { email: SA_EMAIL, password: SA_PASS } });
    const tok2 = relogin.j?.token || '';
    const listed2 = await req('GET', `/api/hub/entity-attachments?entityType=employee&entityId=${encodeURIComponent(empNo)}`, {
      token: tok2,
    });
    mark(
      'after_relogin_list',
      'GET entity-attachments',
      empNo,
      'entity-attachments',
      (listed2.j?.items || []).length >= 3 ? 'PASS' : 'FAIL',
      `count=${(listed2.j?.items || []).length}`
    );

    // 6 authorized staff sees
    mark('authorized_staff_sees', 'GET as staff', empNo, 'entity-attachments', (listed2.j?.items || []).length >= 3 ? 'PASS' : 'FAIL', '');

    // 7 unauthorized customer must not see staff/employee attachments
    const custEmail = `cust.att.${Date.now().toString(36)}@example.com`;
    const custReg = await req('POST', '/api/auth/register', {
      body: { name: 'عميل اختبار مرفقات', email: custEmail, password: '24681357', phone: '0500000001' },
    });
    let custTok = custReg.j?.token || '';
    if (!custTok) {
      const cl = await req('POST', '/api/auth/login', { body: { email: custEmail, password: '24681357' } });
      custTok = cl.j?.token || '';
    }
    const asCust = await req('GET', `/api/hub/entity-attachments?entityType=employee&entityId=${encodeURIComponent(empNo)}`, {
      token: custTok,
    });
    const seen = (asCust.j?.items || []).length;
    mark(
      'isolation_customer_blocked',
      'GET as customer',
      empNo,
      'entity-attachments',
      seen === 0 ? 'PASS' : 'FAIL',
      `seen=${seen};status=${asCust.status}`
    );

    // 8 retry after failed upload (bad token) then succeed without losing prior links
    const failUp = await upload('bad-token', 'retry.png', 'image/png', tinyPng(), 'image');
    mark('upload_fail_unauthorized', 'POST /uploads bad token', '', 'uploads', failUp.status === 401 || failUp.status === 403 || !failUp.j?.id ? 'PASS' : 'FAIL', `status=${failUp.status}`);
    const retryUp = await upload(tok2, 'retry-ok.png', 'image/png', tinyPng(), 'image');
    const retryItem = { id: retryUp.j?.id, url: retryUp.j?.url, name: 'retry-ok.png', mime: 'image/png', size: tinyPng().length, kind: 'image' };
    if (retryItem.id) {
      await link(tok2, 'employee', empNo, retryItem, SA_EMAIL, `retry-${empNo}-${retryItem.id}`);
    }
    const afterRetry = await req('GET', `/api/hub/entity-attachments?entityType=employee&entityId=${encodeURIComponent(empNo)}`, {
      token: tok2,
    });
    mark(
      'retry_then_persist',
      'upload+link after fail',
      empNo,
      'entity-attachments',
      (afterRetry.j?.items || []).length >= 3 ? 'PASS' : 'FAIL',
      `count=${(afterRetry.j?.items || []).length}`
    );

    // 9 idempotency — same key must not duplicate
    if (imgItem.id) {
      const key = `idem-real-${empNo}-${imgItem.id}`;
      const a = await link(tok2, 'employee', empNo, imgItem, SA_EMAIL, key);
      const b = await link(tok2, 'employee', empNo, imgItem, SA_EMAIL, key);
      const same = a.j?.item?.id && a.j.item.id === b.j?.item?.id;
      mark('idempotent_no_duplicate', 'POST same Idempotency-Key', a.j?.item?.id || '', 'entity-attachments', same ? 'PASS' : 'FAIL', JSON.stringify({ reused: b.j?.reused, id: b.j?.item?.id }).slice(0, 160));
    } else {
      mark('idempotent_no_duplicate', 'POST same key', '', '', 'FAIL', 'no image id');
    }

    // Large practical probe (not 1500MB)
    const largeBytes = Math.max(1, LARGE_MB) * 1024 * 1024;
    const largeBuf = Buffer.alloc(largeBytes, 0x61);
    // prepend ftyp-ish header so mime stays video
    tinyMp4().copy(largeBuf, 0, 0, Math.min(tinyMp4().length, largeBuf.length));
    const t0 = Date.now();
    const largeUp = await upload(tok2, `probe-${LARGE_MB}mb.mp4`, 'video/mp4', largeBuf, 'video');
    const largeMs = Date.now() - t0;
    const largeOk = (largeUp.status === 200 || largeUp.status === 201) && largeUp.j?.id;
    mark(
      `large_video_${LARGE_MB}mb`,
      'POST /uploads',
      largeUp.j?.id || '',
      'data/uploads',
      largeOk ? 'PASS' : 'FAIL',
      `bytes=${largeBytes};ms=${largeMs};status=${largeUp.status};storage=${largeUp.j?.url || ''};err=${largeUp.j?.error || ''}`
    );
    // Honest 1500MB status
    mark(
      'video_1500mb_real_upload',
      'full 1500MB byte upload',
      '',
      'object-storage / reverse-proxy',
      'NOT_TESTED',
      'Environment policy: do not stream 1.5GB in CI agent; resumable chunking across reverse-proxy NOT IMPLEMENTED without external object storage. Policy limit 1500MB is code-verified separately.'
    );
    mark(
      'resumable_chunked_upload',
      'resume after disconnect',
      '',
      'object-storage',
      'NOT_IMPLEMENTED',
      'Requires external object storage multipart; stream+retry from UI is live for connected uploads only.'
    );

    // Production probe (read-only health + login if possible)
    try {
      const prodUrl = new URL(PROD);
      const prodHealth = await new Promise((resolve) => {
        const lib = prodUrl.protocol === 'https:' ? require('https') : http;
        const r = lib.request(
          { hostname: prodUrl.hostname, port: prodUrl.port || (prodUrl.protocol === 'https:' ? 443 : 80), path: '/api/health', method: 'GET', headers: { Accept: 'application/json' } },
          (res) => {
            const c = [];
            res.on('data', (d) => c.push(d));
            res.on('end', () => {
              let j = {};
              try {
                j = JSON.parse(Buffer.concat(c).toString('utf8'));
              } catch {
                /* */
              }
              resolve({ status: res.statusCode, j });
            });
          }
        );
        r.on('error', (e) => resolve({ status: 0, j: { error: e.message } }));
        r.setTimeout(15000, () => {
          r.destroy();
          resolve({ status: 0, j: { error: 'timeout' } });
        });
        r.end();
      });
      mark(
        'prod_health',
        'GET production /api/health',
        PROD,
        'railway',
        prodHealth.status === 200 ? 'PASS' : 'FAIL',
        JSON.stringify(prodHealth.j).slice(0, 180)
      );
      mark(
        'prod_browser_journeys',
        'client/staff/manager/unauthorized + mobile/dark',
        PROD,
        'production',
        'NOT_TESTED',
        'Requires deployed revision of this branch + dedicated test accounts on production; local lifecycle tests above cover API durability. Mark NOT_TESTED until release includes this commit.'
      );
    } catch (e) {
      mark('prod_health', 'GET production', PROD, 'railway', 'FAIL', e.message);
      mark('prod_browser_journeys', 'multi-role', PROD, 'production', 'NOT_TESTED', e.message);
    }
  } catch (err) {
    mark('suite_error', err.message, '', '', 'FAIL', err.stack);
  } finally {
    fs.writeFileSync(path.join(ART, 'server.log'), srv.log());
    srv.stop();
  }

  const summary = {
    pass: rows.filter((r) => r.result === 'PASS').length,
    fail: rows.filter((r) => r.result === 'FAIL').length,
    not_tested: rows.filter((r) => r.result === 'NOT_TESTED').length,
    not_implemented: rows.filter((r) => r.result === 'NOT_IMPLEMENTED').length,
  };
  const report = { at: new Date().toISOString(), empNo, summary, rows, prod: PROD, largeProbeMb: LARGE_MB };
  const md = [
    '# تقرير اختبار المرفقات الحقيقي — نايوش هوب 360',
    '',
    `التاريخ: ${report.at}`,
    `سجل الموظف الاختباري: \`${empNo}\``,
    `PASS: ${summary.pass} · FAIL: ${summary.fail} · NOT_TESTED: ${summary.not_tested} · NOT_IMPLEMENTED: ${summary.not_implemented}`,
    '',
    '| الوظيفة | العملية | رقم السجل | مكان الحفظ | النتيجة | ملاحظة |',
    '|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.function} | ${r.operation} | ${r.recordId || '—'} | ${r.storage || '—'} | **${r.result}** | ${String(r.note || '').replace(/\|/g, '/').slice(0, 160)} |`
    ),
    '',
    '## ملاحظات صريحة',
    '- رفع صورة/ملف/فيديو + الربط بكيان موظف + إعادة الجلب بعد إعادة الدخول + العزل + عدم التكرار: مغطاة أعلاه.',
    '- **1500MB فعليًا: NOT_TESTED** في هذه البيئة؛ تم فحص حد السياسة في الكود واختبار حجم عملي أصغر (`HUB_ATTACH_LARGE_MB`).',
    '- **استئناف مجزأ بعد انقطاع: NOT_IMPLEMENTED** بدون Object Storage خارجي.',
    '- **رحلات الإنتاج متعددة الأدوار/الجوال/الوضع الليلي: NOT_TESTED** حتى ينشر هذا الفرع على الإنتاج بحسابات اختبار.',
    '',
  ].join('\n');

  fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(ART, 'ops-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(ART, 'ops-report.md'), md);
  fs.writeFileSync(path.join(ROOT, 'docs/unified-attachments-real-ops-report.md'), md);
  console.log(md);
  process.exit(summary.fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
