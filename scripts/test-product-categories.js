/**
 * اختبار تصنيفات المنتجات — API + صلاحيات
 */
const assert = require('assert');
const http = require('http');

const PORT = Number(process.env.PORT) || 8080;
const BASE = `http://127.0.0.1:${PORT}`;

function req(method, path, { token, role, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const payload = body != null ? JSON.stringify(body) : null;
    const headers = { Accept: 'application/json' };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    if (role) headers['X-Hub-User-Role'] = role;
    const r = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let data = {};
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch {
            data = { raw };
          }
          resolve({ status: res.statusCode, data });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function main() {
  const staff = `hub360.${Buffer.from('admin@naiosh.com').toString('base64')}.${Date.now()}`;
  const client = `hub360.cust.${Buffer.from('client@naiosh.com').toString('base64url')}.${Date.now()}`;
  const name = `اختبار-${Date.now().toString(36)}`;

  const listed = await req('GET', '/api/hub/product-categories');
  assert.equal(listed.status, 200);
  assert.equal(listed.data.ok, true);
  assert.ok(Array.isArray(listed.data.items));
  assert.ok(listed.data.items.length >= 1);

  const denied = await req('POST', '/api/hub/product-categories', {
    token: client,
    role: 'customer',
    body: { name },
  });
  assert.ok(denied.status === 403 || denied.data.ok === false);

  const created = await req('POST', '/api/hub/product-categories', {
    token: staff,
    role: 'admin',
    body: { name, description: 'وصف', icon: 'fa-tag', status: 'active' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.ok, true);
  assert.equal(created.data.item.name, name);
  const id = created.data.item.id;

  const dup = await req('POST', '/api/hub/product-categories', {
    token: staff,
    role: 'admin',
    body: { name },
  });
  assert.equal(dup.status, 409);
  assert.match(String(dup.data.error || ''), /بالفعل/);

  const empty = await req('POST', '/api/hub/product-categories', {
    token: staff,
    role: 'admin',
    body: { name: '   ' },
  });
  assert.equal(empty.status, 400);

  const renamed = await req('PATCH', `/api/hub/product-categories/${encodeURIComponent(id)}`, {
    token: staff,
    role: 'admin',
    body: { name: `${name}-محدث` },
  });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.data.item.name, `${name}-محدث`);

  const blockedDelete = await req('POST', `/api/hub/product-categories/${encodeURIComponent(id)}/delete`, {
    token: staff,
    role: 'admin',
    body: { productCount: 3 },
  });
  assert.equal(blockedDelete.status, 409);
  assert.equal(blockedDelete.data.needsReplacement, true);

  const deleted = await req('POST', `/api/hub/product-categories/${encodeURIComponent(id)}/delete`, {
    token: staff,
    role: 'admin',
    body: { productCount: 0 },
  });
  assert.equal(deleted.status, 200);
  assert.equal(deleted.data.ok, true);

  console.log('test-product-categories: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
