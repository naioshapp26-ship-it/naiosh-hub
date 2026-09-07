/**
 * Broad file-type support for ops/blog uploads: allow most types, block dangerous executables.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');

const root = path.join(__dirname, '..');
const uploads = require(path.join(root, 'lib/hub-uploads.js'));

assert(uploads.isAllowedUpload('report.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
assert(uploads.isAllowedUpload('model.dwg', 'application/dwg'));
assert(uploads.isAllowedUpload('archive.7z', 'application/x-7z-compressed'));
assert(uploads.isAllowedUpload('notes.md', 'text/markdown'));
assert(uploads.isAllowedUpload('unknown.xyz', 'application/octet-stream'), 'unknown non-blocked ext must be allowed');
assert(uploads.isAllowedUpload('noext', 'application/octet-stream'), 'no extension falls back to .bin');
assert(!uploads.isAllowedUpload('malware.exe', 'application/octet-stream'), 'exe must be blocked');
assert(!uploads.isAllowedUpload('shell.php', 'application/x-php'), 'php must be blocked');
assert(!uploads.isAllowedUpload('hack.js', 'text/javascript'), 'js must be blocked');

assert.strictEqual(uploads.extFromNameAndMime('plan.dwg', 'application/octet-stream'), '.dwg');
assert.strictEqual(uploads.extFromNameAndMime('file', 'application/pdf'), '.pdf');
assert.strictEqual(uploads.extFromNameAndMime('x', 'application/octet-stream'), '.bin');
assert.strictEqual(uploads.extFromNameAndMime('bad.exe', 'application/octet-stream'), '');

const blogHtml = fs.readFileSync(path.join(root, 'blog.html'), 'utf8');
assert(blogHtml.includes('js/hub-blog.js'), 'blog.html must load hub-blog.js');
assert(blogHtml.includes('system-ops.html?tab=blog'), 'blog must link to ops publish tab');
assert(blogHtml.includes('data-blog-posts'), 'blog must have live posts host');

const opsUi = fs.readFileSync(path.join(root, 'js/hub-system-ops-ui.js'), 'utf8');
assert(/name="attachments"/.test(opsUi), 'ops blog form must accept attachments');
assert(/HubUploadLimits\.uploadFile/.test(opsUi), 'ops blog must upload via HubUploadLimits');

const engine = fs.readFileSync(path.join(root, 'js/hub-system-ops-engine.js'), 'utf8');
assert(/attachments/.test(engine), 'engine publishPost must store attachments');
assert(/listPublishedPosts/.test(engine), 'engine must list published posts');

const operating = fs.readFileSync(path.join(root, 'operating.html'), 'utf8');
assert(operating.includes('system-ops.html?tab=blog'), 'operating page must link to blog publish');

class FakeReq extends EventEmitter {
  constructor(headers) {
    super();
    this.headers = headers;
  }
  resume() {}
  pipe() {
    return this;
  }
  destroy() {}
}

(async () => {
  await assert.rejects(
    () =>
      uploads.saveRequestToFile(
        new FakeReq({
          'content-length': '10',
          'x-file-name': 'virus.exe',
          'content-type': 'application/octet-stream',
        })
      ),
    (err) => err.status === 400
  );

  const port = 18081;
  const child = spawn(process.execPath, [path.join(root, 'server.js')], {
    env: { ...process.env, PORT: String(port), HUB_AUTO_MIGRATE: 'false' },
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server start timeout')), 12000);
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

  const upload = (name, type, body) =>
    new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/api/hub/uploads',
          method: 'POST',
          headers: {
            'Content-Type': type,
            'X-File-Name': encodeURIComponent(name),
            'X-File-Type': type,
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            let parsed = {};
            try {
              parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
            } catch {
              parsed = {};
            }
            resolve({ status: res.statusCode, body: parsed });
          });
        }
      );
      req.on('error', reject);
      req.end(body);
    });

  const dwg = await upload('floor.dwg', 'application/octet-stream', Buffer.from('dwg-bytes'));
  assert.strictEqual(dwg.status, 201, `dwg upload failed: ${JSON.stringify(dwg.body)}`);
  assert(dwg.body.url.includes('.dwg'));

  const zip = await upload('pack.zip', 'application/zip', Buffer.from('PK\x03\x04'));
  assert.strictEqual(zip.status, 201);

  const blocked = await upload('evil.exe', 'application/octet-stream', Buffer.from('MZ'));
  assert.strictEqual(blocked.status, 400, 'exe must be rejected');

  child.kill('SIGTERM');
  await new Promise((r) => child.once('exit', r));
  console.log('PASS blog/ops uploads accept broad file types and block dangerous executables');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
