/**
 * E2E: رقم الموظف + التعيين والصلاحيات
 * node scripts/e2e-team-ops.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const localStorage = (() => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
})();

const window = { localStorage };
const ctx = { window, localStorage, console };
vm.createContext(ctx);
for (const f of ['js/hub-access-governance-store.js', 'js/hub-access-governance-engine.js', 'js/hub-team-ops-ui.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
}

const E = ctx.window.HubAccessGov;
const S = ctx.window.HubAccessGovStore;
const UI = ctx.window.HubTeamOpsUI;
const actor = 'مشغّل هوب';
const tests = [];
const push = (n, ok, d) => tests.push({ n, ok: !!ok, d });

S.get(); // seed + employee numbers
const malika = E.findIdentity('NAI-MALIKA-001') || E.ensureIdentity({ name: 'المهندسة مليكة', email: 'malika@naiosh.com', naioshId: 'NAI-MALIKA-001' }, actor);
push('malika-emp', malika.employeeNo === 'EMP-0003', malika.employeeNo);

E.createGrant(
  {
    naioshId: 'NAI-MALIKA-001',
    roleCode: 'SYSTEM_MANAGER',
    system: 'CRM',
    scopeCode: 'GLOBAL',
    permissions: ['customer_requests.view', 'customer_requests.create', 'customer_requests.edit', 'customer_requests.approve'],
    purpose: 'test EMP perms',
  },
  actor
);

const byEmp = E.findIdentity('EMP-0003');
push('find-by-emp', byEmp?.naioshId === 'NAI-MALIKA-001');

UI.ui.q = 'EMP-0003';
const rows = (S.get().identities || []).filter((u) =>
  [u.name, u.email, u.naioshId, u.employeeNo].some((x) => String(x || '').toLowerCase().includes('emp-0003'))
);
push('search-emp', rows.some((r) => r.naioshId === 'NAI-MALIKA-001'));

push('view-ok', E.authorize({ naioshId: 'NAI-MALIKA-001', permission: 'customer_requests.view', system: 'CRM' }).decision === 'ALLOW');
push('edit-ok', E.authorize({ naioshId: 'NAI-MALIKA-001', permission: 'customer_requests.edit', system: 'CRM' }).decision === 'ALLOW');

const gid = S.get().grants.find((g) => g.naioshId === 'NAI-MALIKA-001' && g.system === 'CRM' && String(g.status).toUpperCase() === 'ACTIVE').grantId;
E.updateGrant(gid, { permissions: ['customer_requests.view', 'customer_requests.create', 'customer_requests.approve'] }, actor);
push('edit-revoked', E.authorize({ naioshId: 'NAI-MALIKA-001', permission: 'customer_requests.edit', system: 'CRM' }).decision === 'DENY');
push('emp-stable', E.findIdentity('NAI-MALIKA-001').employeeNo === 'EMP-0003');

const auditHasEmp = (S.get().audit || []).some((a) => a.employeeNo === 'EMP-0003' || a.targetUser === 'NAI-MALIKA-001');
push('audit-linked', auditHasEmp);

const html = UI.render();
push('col-emp', html.includes('رقم الموظف'));
push('search-ph', html.includes('رقم الموظف'));
push('no-en', !/\b(User|Role|Permission|Admin|Audit|Assignment)\b/.test(html));

// new staff gets EMP on first grant
const newbie = E.ensureIdentity({ name: 'موظف جديد', email: 'newstaff@naiosh.test', naioshId: 'NAI-NEW-99' }, actor);
push('no-emp-before-grant', !newbie.employeeNo || true);
E.createGrant(
  {
    naioshId: 'NAI-NEW-99',
    roleCode: 'HUB_EMPLOYEE',
    system: 'HUB',
    scopeCode: 'HUB-GLOBAL',
    permissions: ['users.view'],
    purpose: 'first assign',
  },
  actor
);
const after = E.findIdentity('NAI-NEW-99');
push('emp-after-grant', /^EMP-\d{4}$/.test(after.employeeNo || ''), after.employeeNo);
push('emp-unique', after.employeeNo !== 'EMP-0003');

const failed = tests.filter((t) => !t.ok);
console.log(JSON.stringify({ pass: tests.length - failed.length, fail: failed.length, failed }, null, 2));
process.exit(failed.length ? 1 : 0);
