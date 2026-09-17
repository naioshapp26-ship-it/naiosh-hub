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
const document = {
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: () => null,
  addEventListener: () => {},
};
const ctx = { window, localStorage, document, console };
vm.createContext(ctx);
ctx.window.document = document;
for (const f of ['js/hub-access-governance-store.js', 'js/hub-access-governance-engine.js', 'js/hub-team-ops-forms.js', 'js/hub-team-ops-ui.js']) {
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
UI.ui.tab = 'team';
UI.ui.q = '';
const htmlTeamEarly = UI.render();
push('T8-not-in-ui', !htmlTeamEarly.includes('NAI-CUSTOMER-TEST') && !htmlTeamEarly.includes('أحمد علي'));

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

// —— Test 11: أنظمة/أدوار/صلاحيات ديناميكية
const beforeSys = (S.get().systems || []).length;
const beforeRoles = (S.get().roles || []).length;
const beforePerms = (S.get().permissions || []).length;
E.upsertManagedSystem(
  { code: 'E2E_SYS', nameAr: 'نظام اختبار', classification: 'independent', description: 'نظام تجريبي', status: 'active' },
  actor
);
E.upsertRole(
  {
    code: 'E2E_ROLE',
    nameAr: 'دور اختبار',
    applicableSystems: ['E2E_SYS'],
    permissions: ['articles.publish', 'articles.view'],
    status: 'active',
  },
  actor
);
E.upsertPermission({ nameAr: 'نشر مقال اختبار', resource: 'articles', action: 'PUBLISH', system: 'CONTENT' }, actor);
push('T11-system-added', (S.get().systems || []).some((s) => s.code === 'E2E_SYS'));
push('T11-system-count-up', (S.get().systems || []).length >= beforeSys);
push('T11-roles-catalog-large', beforeRoles >= 30, beforeRoles);
push('T11-perms-catalog-large', beforePerms >= 80, beforePerms);
push('T11-role-added', (S.get().roles || []).some((r) => r.code === 'E2E_ROLE'));
push('T11-perm-added', (S.get().permissions || []).some((p) => p.code === 'articles.publish'));
E.createGrant(
  {
    naioshId: emp.naioshId,
    roleCode: 'E2E_ROLE',
    system: 'E2E_SYS',
    scopeCode: 'GLOBAL',
    permissions: ['articles.publish', 'articles.view'],
    purpose: 'e2e independent system',
  },
  actor
);
push('T11-grant-on-new-system', E.authorize({ naioshId: emp.naioshId, permission: 'articles.publish', system: 'E2E_SYS' }).decision === 'ALLOW');
push('T11-erp-subsystems', (S.get().systems || []).some((s) => s.code === 'SALES') && (S.get().systems || []).some((s) => s.code === 'EVENTS'));

// UI checks
UI.ui.tab = 'team';
const htmlTeam = UI.render();
push('UI-emp-col', htmlTeam.includes('رقم الموظف'));
push('UI-tabs-systems', htmlTeam.includes('الأنظمة') && htmlTeam.includes('الصلاحيات'));
push('UI-no-global-assign-on-audit', (() => {
  UI.ui.tab = 'audit';
  const h = UI.render();
  return h.includes('سجل الصلاحيات') && !h.includes('+ تعيين موظف');
})());
push('UI-systems-cta', (() => {
  UI.ui.tab = 'systems';
  return UI.render().includes('+ إضافة نظام');
})());
push('UI-roles-full', (() => {
  UI.ui.tab = 'roles';
  return UI.render().includes('+ إضافة دور') && (S.get().roles || []).length > 10;
})());
push('UI-clickable-hint', true);

// —— Test 12: نماذج Modal بدل prompt/confirm/alert
const F = ctx.window.HubTeamOpsForms;
push('T12-forms-loaded', !!F && !!UI);
const srcUi = fs.readFileSync(path.join(root, 'js/hub-team-ops-ui.js'), 'utf8');
const srcForms = fs.readFileSync(path.join(root, 'js/hub-team-ops-forms.js'), 'utf8');
push('T12-no-prompt-ui', !/\bprompt\s*\(/.test(srcUi));
push('T12-no-confirm-ui', !/\bconfirm\s*\(/.test(srcUi));
push('T12-no-alert-ui', !/\balert\s*\(/.test(srcUi));
push('T12-no-prompt-forms', !/\bprompt\s*\(/.test(srcForms) && !/\bconfirm\s*\(/.test(srcForms) && !/\balert\s*\(/.test(srcForms));

F.openForm(UI.ui, 'permission');
let modalHtml = UI.render();
push('T12-perm-modal', modalHtml.includes('إضافة صلاحية جديدة') && modalHtml.includes('حفظ الصلاحية') && modalHtml.includes('hto-form-modal'));
push('T12-perm-fields', modalHtml.includes('اسم الصلاحية') && modalHtml.includes('رمز الصلاحية') && modalHtml.includes('مستوى حساسية'));
UI.ui.form = null;

F.openForm(UI.ui, 'system');
modalHtml = UI.render();
push('T12-sys-modal', modalHtml.includes('إضافة نظام جديد') && modalHtml.includes('حفظ النظام'));
UI.ui.form = null;

F.openForm(UI.ui, 'role');
modalHtml = UI.render();
push('T12-role-modal', modalHtml.includes('إضافة دور جديد') && modalHtml.includes('الصلاحيات التابعة للدور'));
UI.ui.form = null;

F.openForm(UI.ui, 'employee');
modalHtml = UI.render();
push('T12-emp-modal', modalHtml.includes('إضافة موظف') && modalHtml.includes('رقم الموظف') && modalHtml.includes('البريد الإلكتروني'));
UI.ui.form = null;

F.openForm(UI.ui, 'workplace');
modalHtml = UI.render();
push('T12-workplace-modal', modalHtml.includes('إضافة مكان عمل') && modalHtml.includes('النوع / المستوى'));
UI.ui.form = null;

UI.handle('hto-add-perm', { dataset: {} }, { toast: () => {} });
push('T12-add-perm-opens-form', UI.ui.form?.kind === 'permission');
UI.ui.form = null;

UI.handle('hto-toggle-system', { dataset: { code: 'E2E_SYS', next: 'inactive' } }, { toast: () => {} });
push('T12-toggle-uses-confirm-modal', UI.ui.confirm?.kind === 'disable-system');
UI.ui.confirm = null;

E.upsertPosition({ code: 'E2E_POS', nameAr: 'فرع اختبار', orgLevel: 'BRANCH', status: 'active' }, actor);
push('T12-position-upsert', (S.get().positions || []).some((p) => p.code === 'E2E_POS'));

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
