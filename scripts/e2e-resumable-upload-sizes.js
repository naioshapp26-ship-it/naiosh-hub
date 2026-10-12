/**
 * Resumable chunked upload + progressive size probes.
 * Creates files on disk, uploads via /init + /chunk + /complete, verifies bytes,
 * simulates resume by skipping already-received chunks, optionally restarts server.
 *
 * HUB_SIZE_LADDER=8,32,100 SCALE_PORT=8876 node scripts/e2e-resumable-upload-sizes.js
 * Full ladder (may be slow / heavy): HUB_SIZE_LADDER=100,500,1000,1500
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ART = '/opt/cursor/artifacts/resumable-uploads';
const PORT = Number(process.env.SCALE_PORT || 8876);
const SA_EMAIL = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const LADDER = String(process.env.HUB_SIZE_LADDER || '8,32,100')
  .split(',')
  .map((x) => Number(x.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);
const TMP = path.join(ROOT, 'data', 'tmp-upload-probes');

const rows = [];
function mark(sizeMb, op, result, note) {
  rows.push({ sizeMb, operation: op, result, note: String(note || '').slice(0, 400) });
  console.log(`${result} | ${sizeMb || '—'}MB | ${op} | ${String(note || '').slice(0, 160)}`);
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
    const started = Date.now();
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
        resolve({ status: res.statusCode, j, buf, ms: Date.now() - started });
      });
    });
    r.on('error', (e) => resolve({ status: 0, j: { error: e.message }, buf: Buffer.alloc(0), ms: Date.now() - started }));
    if (payload) r.write(payload);
    r.end();
  });
}

function createProbeFile(mb) {
  fs.mkdirSync(TMP, { recursive: true });
  const filePath = path.join(TMP, `probe-${mb}mb.bin`);
  const size = mb * 1024 * 1024;
  // Prefer sparse/fast allocation to avoid RAM pressure on large probes
  try {
    const { execFileSync } = require('child_process');
    execFileSync('truncate', ['-s', String(size), filePath], { stdio: 'ignore' });
  } catch {
    const fd = fs.openSync(filePath, 'w');
    try {
      fs.ftruncateSync(fd, size);
    } finally {
      fs.closeSync(fd);
    }
  }
  const fd2 = fs.openSync(filePath, 'r+');
  try {
    const header = Buffer.alloc(1024, 0x5a);
    header.write('HUBPROBE');
    fs.writeSync(fd2, header, 0, header.length, 0);
  } finally {
    fs.closeSync(fd2);
  }
  const stat = fs.statSync(filePath);
  return { filePath, size: stat.size };
}

function startServer(envExtra = {}) {
  const env = {
    PATH: process.env.PATH,
    DATABASE_URL: process.env.DATABASE_URL || '',
    PORT: String(PORT),
    HOST: '127.0.0.1',
    AUTO_MIGRATE: '0',
    HUB_CUSTOMER_BACKFILL_BG: '0',
    HUB_SUPER_ADMIN_EMAIL: SA_EMAIL,
    HUB_SUPER_ADMIN_INITIAL_PASSWORD: SA_PASS,
    HUB_UPLOAD_CHUNK_SIZE: String(2 * 1024 * 1024),
    ...envExtra,
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

async function waitHealth() {
  for (let i = 0; i < 120; i++) {
    const h = await req('GET', '/api/health');
    if (h.status === 200) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('health timeout');
}

async function uploadFileChunked(token, filePath, size, { dropAfterChunks = 0 } = {}) {
  const name = path.basename(filePath);
  const init = await req('POST', '/api/hub/uploads/init', {
    token,
    body: { name, mime: 'application/octet-stream', size },
  });
  if (!(init.status === 200 || init.status === 201) || !init.j?.uploadId) {
    return { ok: false, stage: 'init', init };
  }
  const uploadId = init.j.uploadId;
  const chunkSize = init.j.chunkSize || 2 * 1024 * 1024;
  const total = init.j.totalChunks || Math.ceil(size / chunkSize);
  const fd = fs.openSync(filePath, 'r');
  let uploaded = 0;
  try {
    for (let i = 0; i < total; i += 1) {
      if (dropAfterChunks && i >= dropAfterChunks) {
        return { ok: false, stage: 'interrupted', uploadId, chunkSize, total, uploadedChunks: i };
      }
      const start = i * chunkSize;
      const len = Math.min(chunkSize, size - start);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, start);
      let attempts = 0;
      let ok = false;
      while (attempts < 3 && !ok) {
        attempts += 1;
        const put = await req('PUT', `/api/hub/uploads/${encodeURIComponent(uploadId)}/chunk?index=${i}`, {
          token,
          body: buf,
          type: 'application/octet-stream',
        });
        ok = put.status >= 200 && put.status < 300 && put.j?.ok;
        if (!ok && attempts >= 3) return { ok: false, stage: 'chunk', index: i, put };
      }
      uploaded = i + 1;
    }
  } finally {
    fs.closeSync(fd);
  }
  const done = await req('POST', `/api/hub/uploads/${encodeURIComponent(uploadId)}/complete`, { token, body: {} });
  return {
    ok: (done.status === 200 || done.status === 201) && done.j?.ok && done.j?.id,
    stage: 'complete',
    uploadId,
    done,
    uploadedChunks: uploaded,
    total,
    chunkSize,
  };
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  if (!SA_PASS) throw new Error('Need HUB_SUPER_ADMIN_INITIAL_PASSWORD');
  let srv = startServer();
  try {
    await waitHealth();
    const login = await req('POST', '/api/auth/login', { body: { email: SA_EMAIL, password: SA_PASS } });
    let token = login.j?.token;
    mark(0, 'staff_login', token ? 'PASS' : 'FAIL', login.j?.user?.role);

    // Resume proof: interrupt after 1 chunk then continue (6MB + 100MB when in ladder / always try 100)
    const resumeSizes = [6];
    if (LADDER.includes(100) || !LADDER.length) resumeSizes.push(100);
    else if (LADDER.some((n) => n >= 100)) resumeSizes.push(Math.min(...LADDER.filter((n) => n >= 100)));
    for (const rmb of resumeSizes) {
      const { filePath, size } = createProbeFile(rmb);
      const t0 = Date.now();
      const mid = await uploadFileChunked(token, filePath, size, { dropAfterChunks: 1 });
      mark(rmb, 'interrupt_after_1_chunk', mid.uploadId ? 'PASS' : 'FAIL', `uploadId=${mid.uploadId || ''}`);
      if (!mid.uploadId) continue;
      const st = await req('GET', `/api/hub/uploads/${encodeURIComponent(mid.uploadId)}/status`, { token });
      const missing = st.j?.missingIndexes || [];
      mark(rmb, 'status_shows_missing', missing.length > 0 ? 'PASS' : 'FAIL', `missing=${missing.length}`);
      const chunkSize = st.j?.chunkSize || 2 * 1024 * 1024;
      const fd = fs.openSync(filePath, 'r');
      try {
        for (const i of missing) {
          const start = i * chunkSize;
          const len = Math.min(chunkSize, size - start);
          const buf = Buffer.alloc(len);
          fs.readSync(fd, buf, 0, len, start);
          await req('PUT', `/api/hub/uploads/${encodeURIComponent(mid.uploadId)}/chunk?index=${i}`, {
            token,
            body: buf,
            type: 'application/octet-stream',
          });
        }
      } finally {
        fs.closeSync(fd);
      }
      const done = await req('POST', `/api/hub/uploads/${encodeURIComponent(mid.uploadId)}/complete`, { token, body: {} });
      const ok = (done.status === 200 || done.status === 201) && done.j?.id;
      mark(rmb, 'resume_complete', ok ? 'PASS' : 'FAIL', `id=${done.j?.id || ''};ms=${Date.now() - t0}`);
      if (ok) {
        const content = await req('GET', `/uploads/${done.j.id}`);
        mark(
          rmb,
          'file_readable',
          content.status === 200 && content.buf.length === size ? 'PASS' : 'FAIL',
          `bytes=${content.buf.length}`
        );
      }
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* */
      }
    }

    for (const mb of LADDER) {
      const mem = process.memoryUsage();
      mark(mb, 'mem_before_rss_mb', 'INFO', String(Math.round(mem.rss / 1024 / 1024)));
      let probe;
      try {
        probe = createProbeFile(mb);
      } catch (e) {
        mark(mb, 'create_file', 'FAIL', e.message);
        continue;
      }
      mark(mb, 'create_file', 'PASS', `bytes=${probe.size};path=${probe.filePath}`);
      const t0 = Date.now();
      const up = await uploadFileChunked(token, probe.filePath, probe.size);
      const ms = Date.now() - t0;
      mark(
        mb,
        'chunked_upload_complete',
        up.ok ? 'PASS' : 'FAIL',
        `ms=${ms};id=${up.done?.j?.id || ''};stage=${up.stage};err=${up.done?.j?.error || up.put?.j?.error || ''}`
      );
      if (!up.ok) continue;
      const id = up.done.j.id;
      const content = await req('GET', `/uploads/${id}`);
      const intact = content.status === 200 && content.buf.length === probe.size && content.buf.slice(0, 8).toString() === 'HUBPROBE';
      mark(mb, 'integrity_open', intact ? 'PASS' : 'FAIL', `http=${content.status};bytes=${content.buf.length}`);
      // Restart durability for 100, 500, and the last ladder size
      const restartSizes = new Set([100, 500, LADDER[LADDER.length - 1]]);
      if (intact && restartSizes.has(mb)) {
        mark(mb, 'persist_path', 'PASS', path.join(ROOT, 'data', 'uploads', id));
        srv.stop();
        await new Promise((r) => setTimeout(r, 800));
        srv = startServer();
        await waitHealth();
        const login2 = await req('POST', '/api/auth/login', { body: { email: SA_EMAIL, password: SA_PASS } });
        const tok2 = login2.j?.token;
        const again = await req('GET', `/uploads/${id}`, { token: tok2 });
        mark(
          mb,
          'after_restart_readable',
          again.status === 200 && again.buf.length === probe.size ? 'PASS' : 'FAIL',
          `http=${again.status};bytes=${again.buf.length}`
        );
        token = tok2 || token;
      }
      try {
        fs.unlinkSync(probe.filePath);
      } catch {
        /* */
      }
    }

    // Explicit 1500 status if not in ladder
    if (!LADDER.includes(1500)) {
      mark(1500, 'chunked_upload_complete', 'NOT_TESTED', `Set HUB_SIZE_LADDER to include 1500. Current ladder: ${LADDER.join(',')}`);
      mark(1500, 'integrity_open', 'NOT_TESTED', 'depends on 1500 upload');
      mark(1500, 'after_restart_readable', 'NOT_TESTED', 'depends on 1500 upload');
      mark(1500, 'resume_after_disconnect', 'NOT_TESTED', 'resume proven at 6MB; 1500MB resume not run in this pass');
    }
  } catch (err) {
    mark(0, 'suite_error', 'FAIL', err.stack || err.message);
  } finally {
    fs.writeFileSync(path.join(ART, 'server.log'), srv.log());
    srv.stop();
  }

  const summary = {
    pass: rows.filter((r) => r.result === 'PASS').length,
    fail: rows.filter((r) => r.result === 'FAIL').length,
    not_tested: rows.filter((r) => r.result === 'NOT_TESTED').length,
    info: rows.filter((r) => r.result === 'INFO').length,
  };
  const md = [
    '# تقرير الرفع المجزأ والأحجام — نايوش هوب 360',
    '',
    `التاريخ: ${new Date().toISOString()}`,
    `السلم: ${LADDER.join(', ')} MB`,
    `PASS: ${summary.pass} · FAIL: ${summary.fail} · NOT_TESTED: ${summary.not_tested}`,
    '',
    '| الحجم (MB) | العملية | النتيجة | ملاحظة |',
    '|---|---|---|---|',
    ...rows.map((r) => `| ${r.sizeMb || '—'} | ${r.operation} | **${r.result}** | ${String(r.note || '').replace(/\|/g, '/').slice(0, 180)} |`),
    '',
    '## ملاحظات',
    '- الاستئناف بعد انقطاع مُنفَّذ عبر جلسات `.chunk-sessions` + `/chunk` + `/complete`.',
    '- الملفات الكبيرة لا تُنسخ إلى PostgreSQL BYTEA (حد 10MB للمرآة); المصدر الدائم هو مجلد الرفع / Volume.',
    '- 1500MB يعتمد على مساحة القرص والمهلة والذاكرة؛ إن لم يُدرج في السلم يبقى NOT_TESTED.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ART, 'size-report.md'), md);
  fs.writeFileSync(path.join(ART, 'size-report.json'), JSON.stringify({ at: new Date().toISOString(), ladder: LADDER, summary, rows }, null, 2));
  fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'docs/unified-attachments-resumable-sizes-report.md'), md);
  console.log(md);
  process.exit(summary.fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
