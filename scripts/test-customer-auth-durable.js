/**
 * Unit test: customer auth survives local JSON wipe when Postgres hub_users is primary.
 * Run: DATABASE_URL=... node scripts/test-customer-auth-durable.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STORE = path.join(ROOT, 'data', 'customer-accounts.json');

function clearCustomerAuthCache() {
  delete require.cache[require.resolve('../lib/hub-customer-auth')];
}

async function main() {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL required');
  const { migrate, withClient } = require('../db/migrate');
  await migrate();

  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify({ version: 1, accounts: [], updatedAt: new Date().toISOString() }, null, 2));
  clearCustomerAuthCache();

  const customerAuth = require('../lib/hub-customer-auth');
  assert.ok(customerAuth.dbEnabled(), 'db must be enabled');

  const email = `durable_${Date.now().toString(36)}@example.com`;
  const password = 'OriginalPass4827!';
  const phone = `059${String(Date.now()).slice(-8)}`;
  const reg = await customerAuth.register({
    fullName: 'عميل دائم',
    email,
    phone,
    password,
    confirmPassword: password,
    termsAccepted: true,
  });
  assert.strictEqual(reg.ok, true, reg.error || 'register');

  const count = await customerAuth.dbCountCustomers();
  assert.ok(count >= 1, 'hub_users has customers');

  // Simulate Railway ephemeral wipe + new process — keep ORIGINAL password
  fs.writeFileSync(STORE, JSON.stringify({ version: 1, accounts: [], updatedAt: new Date().toISOString() }, null, 2));
  clearCustomerAuthCache();
  const customerAuth2 = require('../lib/hub-customer-auth');
  const login = await customerAuth2.login({ email, password });
  assert.strictEqual(login.ok, true, login.error || 'login after wipe with original password');
  assert.ok(login.token, 'token issued');

  const wrong = await customerAuth2.login({ email, password: 'wrong-pass' });
  assert.strictEqual(wrong.ok, false, 'wrong password still rejected');

  // Confirm row in hub_users
  await withClient(async (client) => {
    const r = await client.query(`SELECT email, password_hash FROM hub_users WHERE email = $1`, [email]);
    assert.strictEqual(r.rows.length, 1);
    assert.ok(String(r.rows[0].password_hash).startsWith('scrypt$'));
  });

  console.log('PASS customer auth durable hub_users login after wipe (original password)');
}

main().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
