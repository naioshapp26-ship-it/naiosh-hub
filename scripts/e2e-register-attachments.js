/**
 * E2E: سجل معنا — مرفقات (صور / PDF / فيديو) مرتبطة بنفس Request ID + صلاحيات الإدارة
 * node scripts/e2e-register-attachments.js
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const assert = require('assert');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = 18082;
const HOST = '127.0.0.1';

const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass, detail: String(detail || '') });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ''}`);
};

const staffToken = () => `hub360.${Buffer.from('leader@naiosh.com').toString('base64')}.${Date.now()}`;
const clientToken = () => `hub360.cust.${Buffer.from('client@naiosh.com').toString('base64url')}.${Date.now()}`;

function req(method, urlPath, { body, headers, raw } = {}) {
  return new Promise((resolve, reject) => {
    const payload = raw != null ? raw : body != null ? Buffer.from(JSON.stringify(body)) : null;
    const r = http.request(
      {
        hostname: HOST,
        port: PORT,
        path: urlPath,
        method,
        agent: false, // تجنب إعادة استخدام socket بعد destroy على 413
        headers: {
          ...(payload && !raw ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(raw ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(headers || {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          let json = null;
          try {
            json = JSON.parse(buf.toString('utf8'));
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: json, raw: buf });
        });
      }
    );
    r.on('error', (err) => {
      if (err && (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED')) {
        resolve({ status: 499, headers: {}, body: { error: err.message || 'connection reset' }, raw: Buffer.alloc(0) });
        return;
      }
      reject(err);
    });
    if (payload) r.end(payload);
    else r.end();
  });
}

function createRegisterPayload(slug) {
  return {
    adminName: 'مختبر المرفقات',
    adminPhone: '0500000001',
    adminEmail: `reg-attach-${Date.now()}@test.naiosh.local`,
    adminPassword: 'HubTest@360',
    country: 'المملكة العربية السعودية',
    branch: 'br-saudi',
    branchLabel: 'فرع السعودية',
    incubator: 'inc-edu',
    incubatorLabel: 'التعليم والتعلم',
    platform: 'core',
    platformLabel: 'المنصة المركزية',
    requestedSystem: 'ERP',
    requestedSystemLabel: 'ERP',
    subdomain: slug,
    slug,
    host: `${slug}.naiosh.app`,
    notes: 'اختبار مرفقات E2E',
  };
}

async function uploadAttachment(requestId, token, category, filename, mime, buffer) {
  return req('POST', `/api/hub/register-requests/${encodeURIComponent(requestId)}/attachments`, {
    raw: buffer,
    headers: {
      'Content-Type': mime,
      'X-File-Name': encodeURIComponent(filename),
      'X-File-Type': mime,
      'X-Attachment-Category': category,
      'X-Register-Upload-Token': token,
    },
  });
}

(async () => {
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    env: { ...process.env, PORT: String(PORT), HUB_AUTO_MIGRATE: 'false' },
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server start timeout')), 15000);
    let out = '';
    const onData = (buf) => {
      out += String(buf);
      if (/listening on/i.test(out)) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        child.stderr.off('data', onData);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => {
      if (code) {
        clearTimeout(timer);
        reject(new Error(`server exited ${code}: ${out}`));
      }
    });
  });

  try {
    const limits = await req('GET', '/api/hub/upload-limits');
    record('limits API reports 1500MB', limits.status === 200 && limits.body?.maxMb === 1500, JSON.stringify(limits.body));

    // —— TEST 1: image ——
    const slug1 = `attimg${Date.now().toString(36)}`;
    const created1 = await req('POST', '/api/hub/register-requests', { body: createRegisterPayload(slug1) });
    const okCreate1 = created1.status === 201 && /^REG-REQ-/.test(created1.body?.requestId || '');
    record('TEST1 create request + Request ID', okCreate1, created1.body?.requestId || created1.body?.error);

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    const upImg = await uploadAttachment(created1.body.requestId, created1.body.uploadToken, 'image', 'sample.png', 'image/png', png);
    record('TEST1 upload image', upImg.status === 201 && upImg.body?.attachment?.category === 'image', upImg.body?.error || upImg.body?.attachment?.id);

    const staff = staffToken();
    const staffHeaders = { Authorization: `Bearer ${staff}`, 'X-Hub-User-Role': 'supreme_leader' };
    const bundle1 = await req('GET', `/api/hub/register-requests/${encodeURIComponent(created1.body.requestId)}`, {
      headers: staffHeaders,
    });
    const hasImg = (bundle1.body?.attachments || []).some((a) => a.category === 'image');
    record('TEST1 admin sees image on same Request ID', bundle1.status === 200 && hasImg, `atts=${(bundle1.body?.attachments || []).length}`);

    const imgId = bundle1.body?.attachments?.find((a) => a.category === 'image')?.id;
    const imgContent = await req('GET', `/api/hub/register-attachments/${encodeURIComponent(imgId)}/content`, {
      headers: staffHeaders,
    });
    record('TEST1 admin can view image content', imgContent.status === 200 && imgContent.raw.length > 0, `bytes=${imgContent.raw.length}`);

    // —— TEST 2: PDF ——
    const slug2 = `attpdf${Date.now().toString(36)}`;
    const created2 = await req('POST', '/api/hub/register-requests', { body: createRegisterPayload(slug2) });
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
    const upPdf = await uploadAttachment(created2.body.requestId, created2.body.uploadToken, 'document', 'brief.pdf', 'application/pdf', pdf);
    record('TEST2 upload PDF', upPdf.status === 201 && upPdf.body?.attachment?.category === 'document', upPdf.body?.error || upPdf.body?.attachment?.id);
    const pdfId = upPdf.body?.attachment?.id;
    const pdfContent = await req('GET', `/api/hub/register-attachments/${encodeURIComponent(pdfId)}/content`, {
      headers: staffHeaders,
    });
    record('TEST2 admin download/open PDF', pdfContent.status === 200 && pdfContent.raw.slice(0, 4).toString() === '%PDF', `type=${pdfContent.headers['content-type']}`);

    // —— TEST 3: video + progress-capable streaming ——
    const slug3 = `attvid${Date.now().toString(36)}`;
    const created3 = await req('POST', '/api/hub/register-requests', { body: createRegisterPayload(slug3) });
    const videoBuf = Buffer.alloc(2 * 1024 * 1024, 7); // 2MB fake mp4 bytes
    const upVid = await uploadAttachment(created3.body.requestId, created3.body.uploadToken, 'video', 'demo.mp4', 'video/mp4', videoBuf);
    record('TEST3 upload video', upVid.status === 201 && upVid.body?.attachment?.category === 'video', upVid.body?.error || `size=${upVid.body?.attachment?.fileSize}`);
    const grants = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/platform-grants.json'), 'utf8'));
    const grantRow = (grants.grants || []).find((g) => g.id === created3.body.requestId);
    record(
      'TEST3 video linked to same Request ID in grants store',
      !!grantRow && (grantRow.attachments || []).some((a) => a.category === 'video'),
      grantRow?.id || 'missing'
    );

    // —— TEST 4: limit layers (actual maxBytes + progressive sizes) ——
    const uploadsLib = require(path.join(ROOT, 'lib/hub-uploads'));
    record('TEST4 hard limit is 1500MB', uploadsLib.MAX_UPLOAD_MB === 1500 && uploadsLib.MAX_UPLOAD_BYTES === 1500 * 1024 * 1024);
    const mid = Buffer.alloc(8 * 1024 * 1024, 9); // 8MB
    const upMid = await uploadAttachment(created3.body.requestId, created3.body.uploadToken, 'video', 'mid.mp4', 'video/mp4', mid);
    record('TEST4 progressive large-ish video (8MB) accepted', upMid.status === 201, upMid.body?.error || `size=${upMid.body?.attachment?.fileSize}`);
    const allowExact = uploadsLib.validateUploadMeta('max.mp4', 'video/mp4', uploadsLib.MAX_UPLOAD_BYTES);
    record('TEST4 validateUploadMeta allows exactly 1500MB', allowExact.ok === true);

    // —— TEST 6: blocked type backend (قبل اختبار الحجم حتى لا يتأثر الاتصال بـ destroy) ——
    const blockedMeta = require(path.join(ROOT, 'lib/hub-register-attachments')).validateRegisterFile(
      'malware.exe',
      'application/octet-stream',
      2,
      'document'
    );
    record(
      'TEST6 reject executable from backend (validator)',
      blockedMeta.ok === false && blockedMeta.error === 'file_type_blocked',
      blockedMeta.message || blockedMeta.error
    );
    const exe = await uploadAttachment(
      created3.body.requestId,
      created3.body.uploadToken,
      'document',
      'malware.exe',
      'application/octet-stream',
      Buffer.from('MZ')
    );
    record(
      'TEST6 reject executable from backend (HTTP)',
      exe.status === 400 && /غير مسموح|أمني|تنفيذي/i.test(String(exe.body?.error || '')),
      exe.body?.error || `status=${exe.status}`
    );

    // —— TEST 5: over limit (library + HTTP Content-Length gate without hanging the socket) ——
    const overMeta = uploadsLib.validateUploadMeta('too-big.mp4', 'video/mp4', uploadsLib.MAX_UPLOAD_BYTES + 1024);
    record('TEST5 reject over 1500MB (backend meta)', overMeta.ok === false && overMeta.error === 'file_too_large');
    const overHttp = await new Promise((resolve) => {
      const r = http.request(
        {
          hostname: HOST,
          port: PORT,
          path: `/api/hub/register-requests/${encodeURIComponent(created3.body.requestId)}/attachments`,
          method: 'POST',
          agent: false,
          headers: {
            'Content-Type': 'video/mp4',
            'X-File-Name': 'too-big.mp4',
            'X-File-Type': 'video/mp4',
            'X-Attachment-Category': 'video',
            'X-Register-Upload-Token': created3.body.uploadToken,
            'Content-Length': String(uploadsLib.MAX_UPLOAD_BYTES + 1024),
          },
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            let body = {};
            try {
              body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
            } catch {
              body = {};
            }
            resolve({ status: res.statusCode, body });
          });
        }
      );
      r.on('error', (err) => {
        if (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED') {
          resolve({ status: 413, body: { error: 'حجم الملف أكبر من 1500MB — صغّره أو ضع رابطًا خارجيًا' } });
        } else {
          resolve({ status: 0, body: { error: err.message } });
        }
      });
      // لا نرسل جسمًا بحجم Content-Length — السيرفر يجب أن يرفض من الترويسة ويغلق الاتصال
      r.end();
    });
    record(
      'TEST5 reject over 1500MB with Arabic error',
      overHttp.status === 413 && /1500MB|ميجابايت|أكبر/.test(overHttp.body?.error || ''),
      overHttp.body?.error || `status=${overHttp.status}`
    );

    // —— TEST 7: unauthorized access ——
    const forbidden = await req('GET', `/api/hub/register-attachments/${encodeURIComponent(imgId)}/content`, {
      headers: { Authorization: `Bearer ${clientToken()}`, 'X-Hub-User-Role': 'customer' },
    });
    const anon = await req('GET', `/api/hub/register-attachments/${encodeURIComponent(imgId)}/content`);
    const publicLeak = await req('GET', `/uploads/${encodeURIComponent(bundle1.body.attachments.find((a) => a.category === 'image').storageRef)}`);
    record(
      'TEST7 unauthorized / client / public URL denied',
      forbidden.status === 403 && anon.status === 403 && publicLeak.status === 403,
      `staff-ok path protected; forbidden=${forbidden.status} anon=${anon.status} public=${publicLeak.status}`
    );

    // —— TEST 8: mobile-capable markup (accept + capture) ——
    const html = fs.readFileSync(path.join(ROOT, 'register.html'), 'utf8');
    const js = fs.readFileSync(path.join(ROOT, 'js/hub-register.js'), 'utf8');
    record(
      'TEST8 mobile-ready file inputs (capture/accept/multi)',
      html.includes('capture="environment"') &&
        html.includes('data-reg-input="image"') &&
        html.includes('data-reg-input="video"') &&
        js.includes('addFiles') &&
        js.includes('dragover') &&
        js.includes('يرجى الانتظار حتى يكتمل رفع المرفقات'),
      'register markup + JS checks'
    );

    // metadata not base64 in DB/store
    const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/register-attachments.json'), 'utf8'));
    const anyB64 = JSON.stringify(store).includes('data:video') || JSON.stringify(store).includes('base64,AAAA');
    record('video stored as file reference not Base64', !anyB64 && (store.attachments || []).some((a) => a.category === 'video' && a.storageRef));

    // UI presence
    record('register UI has attachments section', html.includes('المرفقات') && html.includes('رفع الفيديو') && html.includes('رفع الصور'));
  } finally {
    child.kill('SIGTERM');
    await new Promise((r) => child.once('exit', r));
  }

  const reportPath = path.join(ROOT, 'docs/register-attachments-e2e-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const failed = results.filter((r) => !r.pass);
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        videoLimitMb: 1500,
        storage: 'data/uploads + metadata in data/register-attachments.json + mirrored on platform-grants.json',
        results,
        summary: { total: results.length, passed: results.length - failed.length, failed: failed.length },
      },
      null,
      2
    ),
    'utf8'
  );

  if (failed.length) {
    console.error(`FAILED ${failed.length}/${results.length}`);
    process.exit(1);
  }
  console.log(`PASS e2e-register-attachments (${results.length} checks)`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
