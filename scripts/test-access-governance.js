/**
 * E2E / unit tests for Access Governance 360 engine
 * Run: node scripts/test-access-governance.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const storage = new Map();
const localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

const context = {
  console,
  localStorage,
  window: {},
  Date,
  Math,
  JSON,
  Array,
  Object,
  String,
  Number,
  Set,
  Map,
  Error,
};
context.window = context;
context.global = context;

vm.createContext(context);
vm.runInContext(read('js/hub-access-governance-store.js'), context);
vm.runInContext(read('js/hub-access-governance-engine.js'), context);

const Store = context.window.HubAccessGovStore;
const Eng = context.window.HubAccessGov;

// fresh store
localStorage.removeItem(Store.KEY);
const state = Store.get();

assert.ok(state.roles.length >= 6, 'roles seeded');
assert.ok(state.permissions.length > 10, 'permission dictionary');
assert.ok(state.positions.length >= 5, 'positions');
assert.ok(state.identities.length >= 1, 'demo or migrated identity');

const user = state.identities.find((i) => i.naioshId === 'NAI-USER-0025') || state.identities[0];
assert.ok(user, 'test user');

// TEST 1: grant chain works
const allowApprove = Eng.authorize({
  naioshId: user.naioshId,
  permission: 'finance_approvals.approve',
  system: 'ERP',
  scopeCode: 'BRANCH-ALEX',
  amount: 10000,
});
assert.strictEqual(allowApprove.decision, 'ALLOW', 'TEST1 10k ALLOW: ' + allowApprove.reason);

// TEST 3b: over limit
const denyBig = Eng.authorize({
  naioshId: user.naioshId,
  permission: 'finance_approvals.approve',
  system: 'ERP',
  scopeCode: 'BRANCH-ALEX',
  amount: 50000,
});
assert.ok(['DENY', 'ESCALATE', 'REQUIRE_APPROVAL'].includes(denyBig.decision), 'TEST3 50k blocked: ' + denyBig.decision);

// TEST 2: system isolation — ERP grant does not allow CRM approve
const denyOtherSys = Eng.authorize({
  naioshId: user.naioshId,
  permission: 'finance_approvals.approve',
  system: 'CRM',
  scopeCode: 'BRANCH-ALEX',
  amount: 1000,
});
assert.strictEqual(denyOtherSys.decision, 'DENY', 'TEST2 cross-system DENY');

// TEST 11: level isolation — SYSTEM grant cannot satisfy EMPIRE
const denyEmpire = Eng.authorize({
  naioshId: user.naioshId,
  permission: 'customer_requests.approve',
  system: 'ERP',
  scopeCode: 'BRANCH-ALEX',
  governanceLevel: 'EMPIRE',
});
assert.strictEqual(denyEmpire.decision, 'DENY', 'TEST11 empire isolation');

// TEST 4: temporary access + auto revoke
Eng.createTemporaryAccess(
  {
    naioshId: user.naioshId,
    system: 'LAW',
    permission: 'policies.view',
    scopeCode: 'HUB-GLOBAL',
    endDate: new Date(Date.now() - 1000).toISOString(),
    reason: 'expired immediately',
  },
  'tester'
);
const before = Eng.authorize({ naioshId: user.naioshId, permission: 'policies.view', system: 'LAW' });
assert.strictEqual(before.decision, 'DENY', 'TEST4 expired temp should not allow');
const tmpActive = Store.get().temporaryAccess.find((t) => t.permission === 'policies.view');
assert.ok(tmpActive && tmpActive.status === 'EXPIRED', 'TEST4 AUTO_REVOKE status');

Eng.createTemporaryAccess(
  {
    naioshId: user.naioshId,
    system: 'LAW',
    permission: 'policies.view',
    scopeCode: 'HUB-GLOBAL',
    endDate: new Date(Date.now() + 3600 * 1000).toISOString(),
    reason: 'one hour',
  },
  'tester'
);
const tmpOk = Eng.authorize({ naioshId: user.naioshId, permission: 'policies.view', system: 'LAW' });
assert.strictEqual(tmpOk.decision, 'ALLOW', 'TEST4 active temp ALLOW');

// TEST 5: delegation single permission
Store.update((st) => {
  if (!st.identities.some((i) => i.naioshId === 'NAI-ASSIST-001')) {
    st.identities.push({
      id: Store.uid('id'),
      naioshId: 'NAI-ASSIST-001',
      name: 'Assistant',
      email: 'a@x.com',
      userType: 'STAFF',
      verificationStatus: 'VERIFIED',
      status: 'active',
      positions: [],
      createdAt: Store.nowIso(),
      updatedAt: Store.nowIso(),
    });
  }
  return st;
});
Eng.createDelegation(
  {
    delegatorNaioshId: user.naioshId,
    delegateNaioshId: 'NAI-ASSIST-001',
    permission: 'customer_requests.view',
    system: 'ERP',
    scopeCode: 'BRANCH-ALEX',
    endDate: new Date(Date.now() + 86400000).toISOString(),
    purpose: 'view only',
  },
  'tester'
);
const assistView = Eng.authorize({ naioshId: 'NAI-ASSIST-001', permission: 'customer_requests.view', system: 'ERP', scopeCode: 'BRANCH-ALEX' });
const assistApprove = Eng.authorize({ naioshId: 'NAI-ASSIST-001', permission: 'customer_requests.approve', system: 'ERP', scopeCode: 'BRANCH-ALEX' });
assert.strictEqual(assistView.decision, 'ALLOW', 'TEST5 delegate view');
assert.strictEqual(assistApprove.decision, 'DENY', 'TEST5 no role inheritance');

// TEST 6: suspend
Eng.suspendIdentity(user.naioshId, 'tester', 'test suspend');
const afterSus = Eng.authorize({
  naioshId: user.naioshId,
  permission: 'finance_approvals.approve',
  system: 'ERP',
  scopeCode: 'BRANCH-ALEX',
  amount: 1000,
});
assert.strictEqual(afterSus.decision, 'DENY', 'TEST6 suspended DENY');
assert.strictEqual(Eng.effectiveAccess(user.naioshId).status, 'SUSPENDED', 'TEST6 effective suspended');

// restore for revoke test on another grant
Store.update((st) => {
  const id = st.identities.find((i) => i.naioshId === user.naioshId);
  if (id) id.status = 'active';
  st.suspensions = (st.suspensions || []).map((s) => ({ ...s, status: 'ENDED' }));
  return st;
});

// TEST 7: revoke
const grant = Store.get().grants.find((g) => g.naioshId === user.naioshId && g.status === 'ACTIVE');
assert.ok(grant, 'active grant exists');
Eng.revokeGrant(grant.grantId, 'tester', 'e2e revoke');
const afterRev = Store.get().grants.find((g) => g.grantId === grant.grantId);
assert.strictEqual(afterRev.status, 'REVOKED', 'TEST7 revoked');
assert.ok((Store.get().audit || []).some((a) => a.action === 'GRANT_REVOKED'), 'TEST10 audit has revoke');

// TEST 8: SoD self-approve
const sod = Eng.authorize({
  naioshId: 'NAI-ASSIST-001',
  permission: 'customer_requests.approve',
  system: 'ERP',
  transactionId: 'TX1',
  transactionCreatorId: Store.get().identities.find((i) => i.naioshId === 'NAI-ASSIST-001').id,
});
assert.strictEqual(sod.decision, 'DENY', 'TEST8 SoD self-approve DENY');

// TEST 9: explain matches backend effective
const expl = Eng.explainPermission(Store.get(), 'NAI-ASSIST-001', 'customer_requests.view', { system: 'ERP', scopeCode: 'BRANCH-ALEX' });
assert.strictEqual(expl.result, 'ALLOWED', 'TEST9 explanation');

// UI wiring files exist
assert.ok(fs.existsSync(path.join(root, 'js/hub-access-governance-ui.js')));
assert.ok(fs.existsSync(path.join(root, 'css/hub-access-governance.css')));
const dash = read('dashboard.html');
assert.ok(dash.includes('hub-access-governance-ui.js'));
assert.ok(dash.includes('hub-access-governance.css'));
const djs = read('js/dashboard.js');
assert.ok(djs.includes('حوكمة الوصول والأدوار'));
const ws = read('js/hub-clients-workspaces.js');
assert.ok(ws.includes('HubAccessGovUI'));

console.log('PASS access-governance tests (1–11 core engine + wiring)');
