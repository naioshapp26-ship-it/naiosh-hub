/**
 * Unit test: customer auth durable hydrate/refresh survives local JSON wipe
 * when Postgres hub_meta / hub_users are available via a mock.
 * Run: node scripts/test-customer-auth-durable.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..');
const STORE = path.join(ROOT, 'data', 'customer-accounts.json');
const MIGRATE = path.join(ROOT, 'db', 'migrate.js');

const durable = {
  meta: null,
  users: new Map(),
};

function installMigrateMock() {
  const fake = {
    getDatabaseUrl: () => 'postgres://mock',
    withClient: async (fn) => {
      const client = {
        query: async (sql, params = []) => {
          const s = String(sql).replace(/\s+/g, ' ');
          if (s.includes('FROM hub_meta') && s.includes('customer_accounts_v1')) {
            if (!durable.meta) return { rows: [] };
            return { rows: [{ value: durable.meta }] };
          }
          if (s.includes('INSERT INTO hub_meta')) {
            durable.meta = JSON.parse(params[1]);
            return { rows: [] };
          }
          if (s.includes('FROM hub_users')) {
            const role = String(params[0] || '').toLowerCase();
            let rows = [...durable.users.values()].filter((u) => String(u.role).toLowerCase() === role);
            if (params[1]) {
              const email = String(params[1]).toLowerCase();
              rows = rows.filter((u) => u.email === email);
            }
            return { rows };
          }
          if (s.includes('INSERT INTO hub_users')) {
            const [email, password_hash, name_ar, role] = params;
            durable.users.set(String(email).toLowerCase(), {
              email: String(email).toLowerCase(),
              password_hash,
              name_ar,
              role,
              username: null,
              phone: null,
              platform: 'naiosh-hub-360',
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            return { rows: [] };
          }
          if (s.includes('UPDATE hub_users SET username')) {
            const [email, username, phone] = params;
            const row = durable.users.get(String(email).toLowerCase());
            if (row) {
              row.username = username;
              row.phone = phone;
              row.updated_at = new Date().toISOString();
            }
            return { rows: [] };
          }
          if (s.includes('ALTER TABLE')) return { rows: [] };
          return { rows: [] };
        },
      };
      return fn(client);
    },
  };
  require.cache[MIGRATE] = {
    id: MIGRATE,
    filename: MIGRATE,
    loaded: true,
    exports: fake,
  };
}

function clearCustomerAuthCache() {
  const authPath = require.resolve('../lib/hub-customer-auth');
  delete require.cache[authPath];
}

async function main() {
  installMigrateMock();
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify({ version: 1, accounts: [], updatedAt: new Date().toISOString() }, null, 2));
  durable.meta = null;
  durable.users.clear();
  clearCustomerAuthCache();

  const customerAuth = require('../lib/hub-customer-auth');
  const email = `durable_${Date.now().toString(36)}@example.com`;
  const password = 'TestPass1234';
  const reg = await customerAuth.register({
    fullName: 'عميل دائم',
    email,
    phone: `059${String(Date.now()).slice(-8)}`,
    password,
    confirmPassword: password,
    termsAccepted: true,
  });
  assert.strictEqual(reg.ok, true, reg.error || 'register');
  assert.ok(durable.meta && Array.isArray(durable.meta.accounts) && durable.meta.accounts.length >= 1, 'hub_meta persisted');
  // hub_users mirror uses optional pg client; seed it explicitly for the secondary hydrate path
  const saved = durable.meta.accounts.find((a) => a.email === email);
  assert.ok(saved?.passwordHash, 'account hash in hub_meta');
  durable.users.set(email, {
    email,
    password_hash: saved.passwordHash,
    name_ar: saved.fullName,
    role: 'customer',
    username: saved.username,
    phone: saved.phone,
    platform: 'naiosh-hub-360',
    is_active: true,
    created_at: saved.createdAt,
    updated_at: saved.updatedAt,
  });

  // Simulate Railway ephemeral disk wipe + new process
  fs.writeFileSync(STORE, JSON.stringify({ version: 1, accounts: [], updatedAt: new Date().toISOString() }, null, 2));
  clearCustomerAuthCache();
  installMigrateMock();
  const customerAuth2 = require('../lib/hub-customer-auth');
  const login = await customerAuth2.login({ email, password });
  assert.strictEqual(login.ok, true, login.error || 'login after wipe');
  assert.ok(login.token, 'token issued after durable hydrate');

  // Wipe again and leave only hub_users (legacy mirrors before hub_meta existed)
  fs.writeFileSync(STORE, JSON.stringify({ version: 1, accounts: [], updatedAt: new Date().toISOString() }, null, 2));
  durable.meta = null;
  clearCustomerAuthCache();
  installMigrateMock();
  const customerAuth3 = require('../lib/hub-customer-auth');
  const loginUsersOnly = await customerAuth3.login({ email, password });
  assert.strictEqual(loginUsersOnly.ok, true, loginUsersOnly.error || 'login from hub_users only');

  const wrong = await customerAuth2.login({ email, password: 'wrong-pass' });
  assert.strictEqual(wrong.ok, false, 'wrong password still rejected');

  console.log('PASS customer auth durable hydrate/login after wipe');
}

main().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
