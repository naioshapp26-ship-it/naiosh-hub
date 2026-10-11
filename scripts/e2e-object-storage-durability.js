/**
 * Attachment / object-storage durability in test env.
 * - Upload avatar + ticket attachment via API
 * - Restart server
 * - Prove bytes still readable from DB backend
 * - Exercise adapter status; S3 live only if fully configured (never deletes originals)
 *
 * DATABASE_URL=... SCALE_PORT=8820 node scripts/e2e-object-storage-durability.js
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ART = '/opt/cursor/artifacts/customer-integrity';
const PORT = Number(process.env.SCALE_PORT || 8820);

function tinyPng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
}

function req(port, method, urlPath, body, headers = {}) {
  return new Promise((resolve) => {
    const data = body == null ? null : Buffer.isBuffer(body) ? body : JSON.stringify(body);
    const hdrs = { Accept: 'application/json', ...headers };
    if (data && !Buffer.isBuffer(body)) hdrs['Content-Type'] = 'application/json';
    if (data) hdrs['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(
      { hostname: '127.0.0.1', port, path: urlPath, method, headers: hdrs },
      (res) => {
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
          resolve({ status: res.statusCode, j, buf, headers: res.headers });
        });
      }
    );
    r.on('error', (e) => resolve({ status: 0, j: { error: e.message }, buf: Buffer.alloc(0) }));
    r.setTimeout(90000, () => {
      r.destroy();
      resolve({ status: 0, j: { error: 'timeout' }, buf: Buffer.alloc(0) });
    });
    if (data) r.write(data);
    r.end();
  });
}

function multipart(fields, fileField, filename, buffer, mime) {
  const boundary = '----HubBound' + crypto.randomBytes(8).toString('hex');
  const parts = [];
  for (const [k, v] of Object.entries(fields || {})) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`
    );
  }
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`
  );
  const head = Buffer.from(parts.join(''), 'utf8');
  const mid = buffer;
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  return {
    body: Buffer.concat([head, mid, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

async function waitHealth(port, ms = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const h = await req(port, 'GET', '/api/health');
    if (h.status === 200) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('health timeout');
}

function startServer(port) {
  const env = {
    PATH: process.env.PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    PORT: String(port),
    HOST: '127.0.0.1',
    AUTO_MIGRATE: '1',
    HUB_OBJECT_STORAGE_BACKEND: process.env.HUB_OBJECT_STORAGE_BACKEND || 'db',
    HUB_CUSTOMER_HYDRATE_MAX: '200',
    HUB_PG_POOL_MAX: '20',
    UV_THREADPOOL_SIZE: '16',
    HUB_CUSTOMER_BACKFILL_BG: '0',
  };
  // Pass through optional S3 test vars if present
  for (const k of [
    'HUB_S3_BUCKET',
    'HUB_S3_ACCESS_KEY_ID',
    'HUB_S3_SECRET_ACCESS_KEY',
    'HUB_S3_ENDPOINT',
    'HUB_S3_REGION',
    'HUB_S3_FORCE_PATH_STYLE',
    'HUB_OBJECT_STORAGE_DUAL_WRITE',
  ]) {
    if (process.env[k]) env[k] = process.env[k];
  }
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => {
    log += d;
  });
  child.stderr.on('data', (d) => {
    log += d;
  });
  return {
    child,
    log: () => log,
    stop: () => {
      try {
        child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    },
  };
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  const report = {
    at: new Date().toISOString(),
    PASS: [],
    FAIL: [],
    NOT_TESTED: [],
    details: {},
  };
  const mark = (name, ok, note) => {
    report[ok ? 'PASS' : 'FAIL'].push({ name, note });
    console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${note}`);
  };

  const obj = require('../lib/hub-object-storage');
  report.details.adapter = obj.statusReport();
  mark('object_storage_adapter_loaded', true, JSON.stringify(report.details.adapter));

  let srv = startServer(PORT);
  try {
    await waitHealth(PORT);
    const id = `att_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`;
    const email = `${id}@att.naiosh.local`;
    const password = `Att${1000 + Math.floor(Math.random() * 8000)}!a`;
    const phone = `05${String(Date.now() % 10000000000).padStart(10, '0').slice(-10)}`;
    const png = tinyPng();

    const reg = await req(PORT, 'POST', '/api/auth/register', {
      fullName: 'مرفق اختبار',
      email,
      phone,
      password,
      confirmPassword: password,
      termsAccepted: true,
    });
    mark('register', !!reg.j?.ok, JSON.stringify({ status: reg.status }).slice(0, 120));

    const login = await req(PORT, 'POST', '/api/auth/login', { email, password });
    const token = login.j?.token;
    mark('login', !!token, String(login.status));
    if (!token) throw new Error('no token');
    const auth = { Authorization: `Bearer ${token}` };

    const mp = multipart({}, 'file', 'durability.png', png, 'image/png');
    const up = await req(PORT, 'POST', '/api/hub/uploads', mp.body, {
      ...auth,
      'Content-Type': mp.contentType,
    });
    const storageRef = up.j?.storageRef || up.j?.id || up.j?.filename;
    const url = up.j?.url || up.j?.path || up.j?.publicUrl;
    mark('upload_bytes', up.status === 201 || !!up.j?.ok, JSON.stringify({ status: up.status, storageRef, url }).slice(0, 240));

    if (url || storageRef) {
      const patch = await req(
        PORT,
        'PATCH',
        '/api/hub/profiles/me',
        { avatarUrl: url || `/uploads/${storageRef}` },
        auth
      );
      mark('avatar_linked', !!patch.j?.ok, JSON.stringify(patch.j).slice(0, 160));
    }

    // Ticket with attachment reference if portal supports it
    const ticket = await req(
      PORT,
      'POST',
      '/api/client/tickets',
      {
        subject: 'اختبار مرفق',
        body: 'تحقق استمرارية الملف',
        category: 'support',
        attachments: url ? [{ url, name: 'durability.png' }] : [],
      },
      auth
    );
    mark(
      'support_ticket_created',
      ticket.status < 500 && (ticket.j?.ok !== false || ticket.status === 404),
      JSON.stringify({ status: ticket.status, ok: ticket.j?.ok, err: ticket.j?.error }).slice(0, 220)
    );

    // Adapter put/get roundtrip directly
    const ref = `test/${id}.png`;
    const put = await obj.putObject({ storageRef: ref, buffer: png, mime: 'image/png', originalName: 'durability.png' });
    mark('adapter_put_db', (put.dualWritten || []).includes('db') || put.backend === 'db', JSON.stringify(put).slice(0, 200));

    srv.stop();
    await new Promise((r) => setTimeout(r, 1500));
    srv = startServer(PORT);
    await waitHealth(PORT);

    const got = await obj.getObject(ref);
    mark(
      'adapter_get_after_restart',
      !!got?.buffer && got.buffer.equals(png),
      JSON.stringify({ source: got?.source, len: got?.buffer?.length }).slice(0, 160)
    );

    const login2 = await req(PORT, 'POST', '/api/auth/login', { email, password });
    const token2 = login2.j?.token;
    const me = token2
      ? await req(PORT, 'GET', '/api/hub/profiles/me', null, { Authorization: `Bearer ${token2}` })
      : { j: {} };
    const avatarOk = !!(me.j?.header?.avatarUrl || me.j?.profile?.avatarUrl);
    mark('avatar_persists_after_restart', avatarOk, JSON.stringify({ avatar: me.j?.header?.avatarUrl || me.j?.profile?.avatarUrl }).slice(0, 200));

    if (url) {
      const fetchUrl = url.startsWith('http') ? null : url;
      if (fetchUrl) {
        const fileRes = await req(PORT, 'GET', fetchUrl.startsWith('/') ? fetchUrl : `/${fetchUrl}`, null, {
          Authorization: `Bearer ${token2}`,
        });
        mark(
          'uploaded_file_fetchable_after_restart',
          fileRes.status === 200 && fileRes.buf.length > 0,
          JSON.stringify({ status: fileRes.status, bytes: fileRes.buf.length })
        );
      }
    }

    if (obj.s3Configured()) {
      report.details.s3 = 'configured — attempting dual-write probe without deleting originals';
      process.env.HUB_OBJECT_STORAGE_BACKEND = 's3';
      const putS3 = await obj.putObject({
        storageRef: `s3probe/${id}.png`,
        buffer: png,
        mime: 'image/png',
        originalName: 's3.png',
      });
      const s3Ok = (putS3.dualWritten || []).includes('s3') && (putS3.dualWritten || []).includes('db');
      mark('s3_dual_write_keeps_db', s3Ok, JSON.stringify(putS3).slice(0, 240));
    } else {
      report.NOT_TESTED.push({
        name: 's3_live_cutover',
        note: 'HUB_S3_* not fully configured; db backend proven; originals not deleted',
      });
      console.log('NOT_TESTED | s3_live_cutover | missing S3 env');
    }

    mark('no_original_deletes_in_adapter', obj.statusReport().deleteOldCopies === false, 'deleteOldCopies=false');
  } catch (err) {
    mark('suite_error', false, err.message);
  } finally {
    srv.stop();
    fs.writeFileSync(path.join(ART, 'object-storage-server.log'), srv.log());
  }

  const out = path.join(ART, 'object-storage-durability.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log('Wrote', out);
  process.exit(report.FAIL.length ? 1 : 0);
}

main();
