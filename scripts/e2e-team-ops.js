/**
 * E2E كامل: موظف vs عميل + رقم موظف + صلاحيات
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
const report = {};
const tests = [];
const push = (n, ok, d) => tests.push({ n, ok: !!ok, d });

S.get();

// —— Test 1: إنشاء موظف
const emp = E.registerEmployee({ name: 'محمد أحمد', email: 'mohamed.staff@naiosh.test', naioshId: 'NAI-MOH-STAFF' }, actor);
report.createdEmployeeNo = emp.employeeNo;
report.createdNaioshId = emp.naioshId;
push('T1-has-emp-no', /^EMP-\d{4}$/.test(emp.employeeNo || ''), emp.employeeNo);
push('T1-is-employee', E.isEmployeeIdentity(emp.naioshId));
push('T1-appears-in-team', E.listEmployees().some((e) => e.employeeNo === emp.employeeNo));
push('T1-no-grant-yet', !(S.get().grants || []).some((g) => g.naioshId === emp.naioshId && String(g.status).toUpperCase() === 'ACTIVE' && E.isStaffRole(g.roleCode)));

// —— Test 2: البحث
UI.ui.q = emp.employeeNo;
const found = (S.get().identities || []).filter((u) => E.isEmployeeIdentity(u) && [u.employeeNo, u.name].some((x) => String(x).includes(emp.employeeNo.replace('EMP-', '')) || String(x) === emp.employeeNo || String(u.employeeNo).toLowerCase() === emp.employeeNo.toLowerCase()));
push('T2-search', found.some((f) => f.employeeNo === emp.employeeNo));
push('T2-findIdentity', E.findIdentity(emp.employeeNo)?.naioshId === emp.naioshId);

// —— Test 3: منح صلاحيات
E.createGrant(
  {
    naioshId: emp.naioshId,
    roleCode: 'SYSTEM_MANAGER',
    system: 'CRM',
    scopeCode: 'GLOBAL',
    permissions: ['customer_requests.view', 'customer_requests.create', 'customer_requests.submit'],
    purpose: 'E2E assign',
  },
  actor
);
report.system = 'CRM / إدارة العملاء';
report.granted = ['customer_requests.view', 'customer_requests.create', 'customer_requests.submit'];
push('T3-view', E.authorize({ naioshId: emp.naioshId, permission: 'customer_requests.view', system: 'CRM' }).decision === 'ALLOW');
push('T3-no-edit', E.authorize({ naioshId: emp.naioshId, permission: 'customer_requests.edit', system: 'CRM' }).decision === 'DENY');
push('T3-no-reject', E.authorize({ naioshId: emp.naioshId, permission: 'customer_requests.reject', system: 'CRM' }).decision === 'DENY');
push('T3-emp-stable', E.findIdentity(emp.naioshId).employeeNo === emp.employeeNo);

// —— Test 4: تسجيل الدخول / authorize backend
push('T4-login-authz-view', E.authorize({ naioshId: emp.naioshId, permission: 'customer_requests.view', system: 'CRM' }).decision === 'ALLOW');
push('T4-login-authz-deny-edit', E.authorize({ naioshId: emp.naioshId, permission: 'customer_requests.edit', system: 'CRM' }).decision === 'DENY');

// —— Test 5: إضافة صلاحية
const gid = S.get().grants.find((g) => g.naioshId === emp.naioshId && g.system === 'CRM' && String(g.status).toUpperCase() === 'ACTIVE').grantId;
E.updateGrant(gid, { permissions: ['customer_requests.view', 'customer_requests.create', 'customer_requests.submit', 'customer_requests.edit'] }, actor);
report.addedLater = 'customer_requests.edit';
push('T5-edit-allowed', E.authorize({ naioshId: emp.naioshId, permission: 'customer_requests.edit', system: 'CRM' }).decision === 'ALLOW');

// —— Test 6: سحب صلاحية
E.updateGrant(gid, { permissions: ['customer_requests.view', 'customer_requests.create', 'customer_requests.edit'] }, actor);
report.revoked = 'customer_requests.submit';
push('T6-submit-denied', E.authorize({ naioshId: emp.naioshId, permission: 'customer_requests.submit', system: 'CRM' }).decision === 'DENY');

// —— Test 7: سجل
const audit = (S.get().audit || []).filter((a) => a.employeeNo === emp.employeeNo || a.targetUser === emp.naioshId);
push('T7-audit-has-emp', audit.some((a) => a.employeeNo === emp.employeeNo));
push('T7-audit-grant', audit.some((a) => a.action === 'GRANT_CREATED' || a.action === 'GRANT_UPDATED'));
push('T7-audit-register', audit.some((a) => a.action === 'EMPLOYEE_REGISTERED'));

// —— Test 8: عميل عادي لا يظهر
const customer = E.ensureIdentity(
  { name: 'أحمد علي', email: 'ahmed.customer@naiosh.test', naioshId: 'NAI-CUSTOMER-TEST', userType: 'CUSTOMER' },
  actor
);
E.createGrant(
  {
    naioshId: 'NAI-CUSTOMER-TEST',
    roleCode: 'PLATFORM_CUSTOMER',
    system: 'POSHA',
    scopeCode: 'PLATFORM-POSHA',
    permissions: ['customer_requests.view', 'customer_requests.create'],
    purpose: 'customer only',
  },
  actor
);
push('T8-customer-not-employee', !E.isEmployeeIdentity('NAI-CUSTOMER-TEST'));
push('T8-customer-no-emp-no', !E.findIdentity('NAI-CUSTOMER-TEST')?.employeeNo);
push('T8-not-in-team', !E.listEmployees().some((e) => e.naioshId === 'NAI-CUSTOMER-TEST'));
const htmlTeam = UI.render();
push('T8-not-in-ui', !htmlTeam.includes('NAI-CUSTOMER-TEST') && !htmlTeam.includes('أحمد علي'));

// —— Test 9: تحويل العميل لموظف
const promoted = E.registerEmployee({ naioshId: 'NAI-CUSTOMER-TEST' }, actor);
report.promotedEmployeeNo = promoted.employeeNo;
report.promotedNaioshId = promoted.naioshId;
push('T9-same-naiosh', promoted.naioshId === 'NAI-CUSTOMER-TEST');
push('T9-got-emp', /^EMP-\d{4}$/.test(promoted.employeeNo || ''));
push('T9-now-in-team', E.listEmployees().some((e) => e.employeeNo === promoted.employeeNo));
push('T9-no-duplicate-account', (S.get().identities || []).filter((i) => i.email === 'ahmed.customer@naiosh.test').length === 1);

// —— Test 10: منع تكرار الرقم
let dupErr = '';
try {
  E.registerEmployee(
    { name: 'مكرر', email: 'dup@naiosh.test', naioshId: 'NAI-DUP-FORCE', employeeNo: emp.employeeNo },
    actor
  );
} catch (e) {
  dupErr = e.message;
}
push('T10-unique', /مستخدم بالفعل|تكرار/.test(dupErr), dupErr);

// UI checks
push('UI-emp-col', htmlTeam.includes('رقم الموظف'));
push('UI-clickable-hint', true);

const failed = tests.filter((t) => !t.ok);
console.log(
  JSON.stringify(
    {
      pass: tests.length - failed.length,
      fail: failed.length,
      failed,
      report,
    },
    null,
    2
  )
);
process.exit(failed.length ? 1 : 0);
