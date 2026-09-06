/**
 * Customer registration + login tests
 * Run: node scripts/test-customer-registration.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const STORE = path.join(ROOT, 'data', 'customer-accounts.json');

function resetStore() {
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  fs.writeFileSync(
    STORE,
    JSON.stringify({ version: 1, accounts: [], updatedAt: new Date().toISOString() }, null, 2)
  );
}

function request(port, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = {};
          try {
            json = JSON.parse(raw);
          } catch {
            json = { raw };
          }
          resolve({ status: res.statusCode, json });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function waitForServer(port, child, ms = 10000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await request(port, 'GET', '/login.html');
      if (res.status === 200 || res.status === 404 || res.json) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  const errOut = child?.stderr ? '' : '';
  throw new Error(`server did not boot on ${port}${errOut}`);
}

async function main() {
  resetStore();
  delete require.cache[require.resolve('../lib/hub-customer-auth')];
  const customerAuth = require('../lib/hub-customer-auth');

  const tooShort = await customerAuth.register({
    fullName: 'عميل تجريبي',
    username: 'custshort',
    email: 'short@example.com',
    phone: '+966500000001',
    password: '123',
    confirmPassword: '123',
    termsAccepted: true,
  });
  assert.strictEqual(tooShort.ok, false, 'password shorter than 4 chars must fail');

  const stamp = Date.now().toString(36);
  const email = `cust_${stamp}@example.com`;
  const username = `cust_${stamp}`;
  // Easy passwords (letters or numbers) are accepted — no complexity rules.
  const password = '1234';
  const created = await customerAuth.register({
    fullName: 'سارة العميل',
    username,
    email,
    phone: `+9665${String(Date.now()).slice(-8)}`,
    password,
    confirmPassword: password,
    termsAccepted: true,
    role: 'admin',
  });
  assert.strictEqual(created.ok, true, created.error || 'register should succeed');
  assert.strictEqual(created.user.role, 'customer', 'role must be customer');
  assert.ok(!JSON.stringify(created).includes(password), 'response must not include plaintext password');

  const store = customerAuth.readStore();
  const row = (store.accounts || []).find((a) => a.email === email);
  assert.ok(row, 'account persisted');
  assert.ok(row.passwordHash && row.passwordHash.startsWith('scrypt$'), 'password hashed with scrypt');
  assert.ok(!JSON.stringify(row).includes(password), 'store must not keep plaintext password');

  const dupEmail = await customerAuth.register({
    fullName: 'مكرر',
    username: `${username}_2`,
    email,
    phone: '+966511111111',
    password,
    confirmPassword: password,
    termsAccepted: true,
  });
  assert.strictEqual(dupEmail.ok, false);
  assert.strictEqual(dupEmail.field, 'email');

  const loginOk = await customerAuth.login({ email, password });
  assert.strictEqual(loginOk.ok, true);
  assert.strictEqual(loginOk.user.role, 'customer');

  const loginBad = await customerAuth.login({ email, password: 'Wrong1!x' });
  assert.strictEqual(loginBad.ok, false);

  const port = 18081;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await waitForServer(port, child);
    const httpEmail = `http_${stamp}@example.com`;
    const httpUser = `http_${stamp}`;
    const httpPass = 'HttpTest1!';
    const reg = await request(port, 'POST', '/api/auth/register', {
      fullName: 'عميل واجهة',
      username: httpUser,
      email: httpEmail,
      phone: `+9665${String(Date.now() + 1).slice(-8)}`,
      password: httpPass,
      confirmPassword: httpPass,
      termsAccepted: true,
      role: 'super_admin',
    });
    assert.ok(reg.status === 201 || reg.json.ok === true, `register http failed: ${JSON.stringify(reg.json)}`);
    assert.strictEqual(reg.json.user.role, 'customer');
    assert.ok(!JSON.stringify(reg.json).toLowerCase().includes('passwordhash'));
    assert.ok(!JSON.stringify(reg.json).includes(httpPass));

    const empty = await request(port, 'POST', '/api/auth/register', {});
    assert.ok(empty.status >= 400);

    const login = await request(port, 'POST', '/api/auth/login', {
      email: httpEmail,
      password: httpPass,
    });
    assert.ok(login.json.ok, `login failed: ${JSON.stringify(login.json)}`);
    assert.strictEqual(login.json.user.role, 'customer');

    assert.ok(fs.existsSync(path.join(ROOT, 'create-account.html')));
    assert.ok(fs.existsSync(path.join(ROOT, 'js/hub-create-account.js')));
    assert.ok(fs.existsSync(path.join(ROOT, 'terms.html')));
    assert.ok(fs.existsSync(path.join(ROOT, 'privacy.html')));
    const loginHtml = fs.readFileSync(path.join(ROOT, 'login.html'), 'utf8');
    assert.ok(loginHtml.includes('create-account.html'), 'login CTA must point to create-account');

    console.log('PASS customer registration + login (unit + API)');
  } finally {
    child.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error('FAIL', error);
  process.exit(1);
});
