/**
 * Roles UX — human-readable enrichment + protected system roles + templates metadata.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
const rbac = require(path.join(root, 'lib/hub-rbac-admin.js'));

assert(rbac.PROTECTED_ROLE_CODES.has('SUPER_ADMIN'));
assert(typeof rbac.enrichRole === 'function');

const store = rbac.readStore();
const superRole = store.roles.find((r) => r.code === 'SUPER_ADMIN');
assert(superRole, 'SUPER_ADMIN must exist');
const enriched = rbac.enrichRole(store, superRole);
assert.strictEqual(enriched.is_protected, true);
assert.strictEqual(enriched.can_delete, false);
assert(enriched.plain_description, 'plain description required');
assert(enriched.audience, 'audience required');

const html = fs.readFileSync(path.join(root, 'roles-permissions.html'), 'utf8');
assert(html.includes('js/hub-roles-ux.js'), 'page must load roles UX');
assert(html.includes('css/hub-roles-ux.css'), 'page must load roles UX css');

const ux = fs.readFileSync(path.join(root, 'js/hub-roles-ux.js'), 'utf8');
assert(/displayRoles/.test(ux));
assert(/openWizard/.test(ux));
assert(/الوضع المتقدم/.test(ux));
assert(/صلاحية حسّاسة/.test(ux));

(async () => {
  const port = 18091;
  const child = spawn(process.execPath, [path.join(root, 'server.js')], {
    env: { ...process.env, PORT: String(port), HUB_AUTO_MIGRATE: 'false' },
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server timeout')), 12000);
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
        reject(new Error(`server exited ${code}`));
      }
    });
  });

  const get = (p) =>
    new Promise((resolve, reject) => {
      http
        .get({ hostname: '127.0.0.1', port, path: p }, (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') });
          });
        })
        .on('error', reject);
    });

  const del = (p) =>
    new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port, path: p, method: 'DELETE' }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') });
        });
      });
      req.on('error', reject);
      req.end();
    });

  const meta = await get('/api/admin/metadata');
  assert.strictEqual(meta.status, 200);
  assert(meta.body.permission_levels[0].summary_ar, 'levels need summaries');
  assert(Array.isArray(meta.body.templates) && meta.body.templates.length >= 3);
  assert(meta.body.help?.role);

  const roles = await get('/api/admin/roles');
  assert.strictEqual(roles.status, 200);
  const sa = roles.body.roles.find((r) => r.code === 'SUPER_ADMIN');
  assert(sa.is_protected);
  assert(sa.plain_description);

  const blocked = await del('/api/admin/roles/SUPER_ADMIN');
  assert.strictEqual(blocked.status, 403);

  child.kill('SIGTERM');
  await new Promise((r) => child.once('exit', r));
  console.log('PASS roles UX backend enrichment + protected SUPER_ADMIN');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
