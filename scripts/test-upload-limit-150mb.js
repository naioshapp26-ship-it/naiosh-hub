/**
 * System-wide upload limit must be 150MB across client, server, and admin pages.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const assert = require('assert');
const { EventEmitter } = require('events');

const root = path.join(__dirname, '..');
const uploads = require(path.join(root, 'lib/hub-uploads.js'));

const EXPECTED_MB = 150;
const EXPECTED_BYTES = EXPECTED_MB * 1024 * 1024;

assert.strictEqual(uploads.MAX_UPLOAD_MB, EXPECTED_MB, 'server max must be 150MB');
assert.strictEqual(uploads.MAX_UPLOAD_BYTES, EXPECTED_BYTES, 'server bytes must be 150 * 1024 * 1024');

const clientJs = fs.readFileSync(path.join(root, 'js/hub-upload-limits.js'), 'utf8');
assert(/MAX_FILE_MB = 150/.test(clientJs), 'client MAX_FILE_MB must be 150');
assert(/MAX_FILE_BYTES = MAX_FILE_MB \* 1024 \* 1024/.test(clientJs), 'client bytes derived from 150MB');

const catalog = fs.readFileSync(path.join(root, 'js/hub-search-catalog.js'), 'utf8');
assert(!/2\.5 \* 1024 \* 1024/.test(catalog), 'search catalog must not keep the 2.5MB cap');
assert(/150 \* 1024 \* 1024/.test(catalog), 'search catalog fallback must be 150MB');

const adminHtml = fs.readFileSync(path.join(root, 'search-admin.html'), 'utf8');
assert(!/فيديو صغير/.test(adminHtml), 'search admin must not call videos small');
assert(/150 ميجابايت/.test(adminHtml), 'search admin must show 150MB');
assert(/hub-upload-limits\.js/.test(adminHtml), 'search admin must load shared limits');

const roles = fs.readFileSync(path.join(root, 'roles-permissions.html'), 'utf8');
assert(!/100 \* 1024 \* 1024/.test(roles), 'roles page must not keep 100MB JS cap');
assert(!/الحد الأقصى 100 ميجابايت/.test(roles), 'roles page must not show 100MB');
assert(/150 ميجابايت/.test(roles), 'roles page must show 150MB');
assert(/hub-upload-limits\.js/.test(roles), 'roles page must load shared limits');

const pages = [
  'book-platform.html',
  'book-office.html',
  'book-incubator.html',
  'register-freelancer.html',
  'side-projects.html',
  'dashboard.html',
  'index.html',
];
for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  assert(html.includes('js/hub-upload-limits.js'), `${page} must load shared 150MB limits`);
}

const serverSrc = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
assert(/hubUploads\.MAX_UPLOAD/.test(serverSrc) || /\/api\/hub\/uploads/.test(serverSrc), 'server must expose upload route');
assert(/requestTimeout = 30 \* 60 \* 1000/.test(serverSrc), 'server must allow long video uploads');

class FakeReq extends EventEmitter {
  constructor(headers) {
    super();
    this.headers = headers;
    this.destroyed = false;
    this.resumed = false;
  }
  resume() {
    this.resumed = true;
  }
  pipe() {
    return this;
  }
  destroy() {
    this.destroyed = true;
  }
}

(async () => {
  const tooBig = new FakeReq({
    'content-length': String(EXPECTED_BYTES + 1),
    'x-file-name': 'video.mp4',
    'content-type': 'video/mp4',
  });
  await assert.rejects(
    () => uploads.saveRequestToFile(tooBig),
    (err) => err.status === 413 && /150MB/.test(err.message)
  );

  const { spawn } = require('child_process');
  const port = 18080;
  const child = spawn(process.execPath, [path.join(root, 'server.js')], {
    env: { ...process.env, PORT: String(port), HUB_AUTO_MIGRATE: 'false' },
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server start timeout')), 12000);
    let out = '';
    const onData = (buf) => {
      out += String(buf);
      if (/listening on/i.test(out)) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        child.stderr.off('data', onData);
        resolve(true);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code) {
        clearTimeout(timer);
        reject(new Error(`server exited ${code}: ${out}`));
      }
    });
  });
  assert(ready);

  const jsonGet = (urlPath) =>
    new Promise((resolve, reject) => {
      http
        .get({ hostname: '127.0.0.1', port, path: urlPath }, (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
            } catch (err) {
              reject(err);
            }
          });
        })
        .on('error', reject);
    });

  const limits = await jsonGet('/api/hub/upload-limits');
  assert.strictEqual(limits.status, 200);
  assert.strictEqual(limits.body.maxMb, EXPECTED_MB);
  assert.strictEqual(limits.body.maxBytes, EXPECTED_BYTES);

  const payload = Buffer.from('fake-mp4-bytes-for-upload-test');
  const uploaded = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/hub/uploads',
        method: 'POST',
        headers: {
          'Content-Type': 'video/mp4',
          'X-File-Name': encodeURIComponent('important-video.mp4'),
          'X-File-Type': 'video/mp4',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
          });
        });
      }
    );
    req.on('error', reject);
    req.end(payload);
  });

  assert.strictEqual(uploaded.status, 201, `upload status ${uploaded.status} ${JSON.stringify(uploaded.body)}`);
  assert(uploaded.body.ok);
  assert(uploaded.body.url.startsWith('/uploads/'));
  assert.strictEqual(uploaded.body.maxMb, EXPECTED_MB);

  const fileGet = await new Promise((resolve, reject) => {
    http
      .get({ hostname: '127.0.0.1', port, path: uploaded.body.url }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), type: res.headers['content-type'] }));
      })
      .on('error', reject);
  });
  assert.strictEqual(fileGet.status, 200);
  assert.strictEqual(fileGet.body.toString(), payload.toString());
  assert(/video\/mp4/.test(fileGet.type));

  const overOldLimit = Buffer.alloc(3 * 1024 * 1024, 7);
  const uploaded3mb = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/hub/uploads',
        method: 'POST',
        headers: {
          'Content-Type': 'video/mp4',
          'X-File-Name': encodeURIComponent('above-old-2.5mb.mp4'),
          'X-File-Type': 'video/mp4',
          'Content-Length': overOldLimit.length,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
          });
        });
      }
    );
    req.on('error', reject);
    req.end(overOldLimit);
  });
  assert.strictEqual(uploaded3mb.status, 201, 'files above the old 2.5MB cap must upload');
  assert(uploaded3mb.body.ok);


  const rejected = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/hub/uploads',
        method: 'POST',
        headers: {
          'Content-Type': 'video/mp4',
          'X-File-Name': 'too-big.mp4',
          'Content-Length': String(EXPECTED_BYTES + 1024),
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
    req.on('error', (err) => {
      if (err.code === 'ECONNRESET') resolve({ status: 413, body: { error: 'reset' } });
      else reject(err);
    });
    req.end(Buffer.from('x'));
  });
  assert.strictEqual(rejected.status, 413);
  assert(/150MB/.test(rejected.body.error || ''));

  child.kill('SIGTERM');
  await new Promise((r) => child.once('exit', r));

  console.log('PASS upload limit is 150MB system-wide and server stores video files');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
