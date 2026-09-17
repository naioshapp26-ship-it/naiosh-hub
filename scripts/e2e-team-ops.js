/**
 * E2E: إدارة فريق العمل والصلاحيات (محرك AG + واجهة فريق العمل)
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
const actor = 'مشغّل هوب';
const tests = [];
const push = (n, ok, d) => tests.push({ n, ok: !!ok, d });

E.ensureIdentity({ name: 'مليكة أحمد', email: 'malika@naiosh.test', naioshId: 'NAI-00125' }, actor);
E.ensureIdentity({ name: 'مشرف اختبار', email: 'supervisor@naiosh.test', naioshId: 'NAI-SUP' }, actor);
E.createGrant(
  {
    naioshId: 'NAI-SUP',
    roleCode: 'HUB_ADMIN',
    system: 'HUB',
    scopeCode: 'HUB-GLOBAL',
    permissions: ['roles.assign', 'users.view', 'customer_requests.view', 'customer_requests.approve'],
    purpose: 'test',
  },
  actor
);
E.createGrant(
  {
    naioshId: 'NAI-00125',
    roleCode: 'SYSTEM_MANAGER',
    system: 'CRM',
    scopeCode: 'GLOBAL',
    permissions: ['customer_requests.view', 'customer_requests.approve'],
    purpose: 'test CRM',
  },
  actor
);

push('view', E.authorize({ naioshId: 'NAI-00125', permission: 'customer_requests.view', system: 'CRM' }).decision === 'ALLOW');
push('no-edit', E.authorize({ naioshId: 'NAI-00125', permission: 'customer_requests.edit', system: 'CRM' }).decision === 'DENY');
push('no-manage', E.authorize({ naioshId: 'NAI-00125', permission: 'users.manage', system: 'CRM' }).decision === 'DENY');

const gid = S.get().grants.find((g) => g.naioshId === 'NAI-00125').grantId;
E.updateGrant(gid, { permissions: ['customer_requests.view', 'customer_requests.approve', 'customer_requests.edit'] }, actor);
push('added-edit', E.authorize({ naioshId: 'NAI-00125', permission: 'customer_requests.edit', system: 'CRM' }).decision === 'ALLOW');

E.updateGrant(gid, { permissions: ['customer_requests.view', 'customer_requests.edit'] }, actor);
push('revoked-approve', E.authorize({ naioshId: 'NAI-00125', permission: 'customer_requests.approve', system: 'CRM' }).decision === 'DENY');

E.suspendIdentity('NAI-00125', actor, 't');
push('suspended', E.authorize({ naioshId: 'NAI-00125', permission: 'customer_requests.view', system: 'CRM' }).decision === 'DENY');
E.reactivateIdentity('NAI-00125', actor, 't');
push('reactivated', E.authorize({ naioshId: 'NAI-00125', permission: 'customer_requests.view', system: 'CRM' }).decision === 'ALLOW');

E.revokeGrant(gid, actor, 'r');
push('revoked-grant', E.authorize({ naioshId: 'NAI-00125', permission: 'customer_requests.view', system: 'CRM' }).decision === 'DENY');
push('identity-kept', !!E.findIdentity('NAI-00125'));

let elev = '';
try {
  E.createGrant(
    {
      naioshId: 'NAI-00125',
      roleCode: 'SUPER_ADMIN',
      system: 'HUB',
      scopeCode: 'HUB-GLOBAL',
      permissions: ['access_governance.manage'],
    },
    'NAI-SUP'
  );
} catch (e) {
  elev = e.message;
}
push('no-elevate', /حدود سلطتك|غير مصرح/.test(elev), elev);

const html = ctx.window.HubTeamOpsUI.render();
push('ar-title', html.includes('إدارة فريق العمل والصلاحيات'));
push('tabs', html.includes('فريق العمل') && html.includes('سجل الصلاحيات'));
push('no-en', !/\b(User|Role|Permission|Admin|Audit|Assignment)\b/.test(html));

const failed = tests.filter((t) => !t.ok);
console.log(JSON.stringify({ pass: tests.length - failed.length, fail: failed.length, failed, audit: S.get().audit.length }, null, 2));
process.exit(failed.length ? 1 : 0);
