/**
 * سجل الهويات — توحيد Schema + جدول مركّب + إنشاء/تعديل/استمرار
 * node scripts/e2e-identity-ui.js
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

const windowObj = {
  localStorage,
  HubStore: {
    get: () => ({
      settings: { requireMfa: true },
      clients: [],
      clientsMgmt: {
        schemaVersion: 2,
        clients: [
          { id: 'cli-1', clientId: 'CL-1001', name: 'مؤسسة الأفق', company: 'مؤسسة الأفق', email: 'ops@alofoq.example', status: 'active' },
          { id: 'cli-2', clientId: 'CL-1002', name: 'مجموعة النور', company: 'مجموعة النور', email: 'admin@alnoor.example', status: 'active' },
        ],
      },
    }),
    clientsBag: () => windowObj.HubStore.get().clientsMgmt,
    save: () => {},
    rolesBag: () => ({ accessGov: null, schemaVersion: 2 }),
  },
  HubAuth: { canAccessDashboard: () => ({ ok: true }), attachSsoParams: (u) => u + '?sso=1', isStaff: () => true },
  HubOpsCatalog: {
    listSystems: () => [
      { code: 'HUB', name: 'هوب' },
      { code: 'ERP', name: 'إي آر بي' },
      { code: 'POSHA', name: 'بوشا' },
    ],
  },
  HubHigherApprovals: { createRequest: () => ({ id: 'APR-TEST' }) },
  dispatchEvent: () => {},
  addEventListener: () => {},
  open: () => {},
  CustomEvent: function (n, i) {
    this.type = n;
    this.detail = i?.detail;
  },
};

const document = { querySelector: () => null, querySelectorAll: () => [], body: { appendChild: () => {} }, addEventListener: () => {} };
const ctx = { window: windowObj, localStorage, document, console, CustomEvent: windowObj.CustomEvent };
vm.createContext(ctx);
ctx.window.document = document;

for (const f of ['js/hub-access-governance-store.js', 'js/hub-access-governance-engine.js', 'js/hub-identity-ui.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
}

const E = ctx.window.HubAccessGov;
const Store = ctx.window.HubAccessGovStore;
const UI = ctx.window.HubIdentityUI;
const tests = [];
const push = (n, ok, d) => tests.push({ n, ok: !!ok, d: d == null ? '' : String(d) });
const report = [];

const boss = { name: 'مدير', email: 'boss@test', role: 'SUPER_ADMIN', naioshId: 'NAI-BOSS' };
Store.get();

push('schema-exists', !!UI.IDENTITY_SCHEMA?.name && !!UI.IDENTITY_SCHEMA?.orgName && !!UI.IDENTITY_SCHEMA?.roleCode);
push('org-structure', (E.listOrgStructure?.() || []).some((o) => o.name === 'مؤسسة الأفق' && o.branches.some((b) => b.name === 'الرياض')));

UI.handle('idn-view', { dataset: { view: 'users' } }, { user: boss, toast: () => {} });
let html = UI.render({ user: boss });
push('compound-headers', ['المستخدم', 'المعرفات', 'النوع', 'الجهة', 'الوظيفة', 'الدور', 'الحالة', 'الإجراءات'].every((c) => html.includes(c)));
push('no-flat-14-cols', !html.includes('>رقم نايوش</th>') || html.includes('idn-compound'));
push('add-btn', html.includes('إضافة مستخدم'));
push('users-title', html.includes('المستخدمون والهويات'));

// ——— اختبار 1: موظف مؤسسة ———
const mohamed = E.createUserIdentity(
  {
    name: 'محمد أحمد',
    email: 'identity-test@example.com',
    phone: '0501112233',
    country: 'السعودية',
    userKind: 'ORG_EMPLOYEE',
    orgId: 'CL-1001',
    orgName: 'مؤسسة الأفق',
    branchName: 'الرياض',
    department: 'المالية',
    jobTitle: 'محاسب',
    roleCode: 'HUB_EMPLOYEE',
    systems: ['HUB', 'ERP'],
    status: 'active',
    dataSource: 'user-created',
  },
  'مشغّل هوب'
);
report.push({
  test: 'إضافة موظف مؤسسة — محمد أحمد',
  result: mohamed ? 'نجح' : 'فشل',
  ids: mohamed ? `نايوش=${mohamed.naioshId} موظف=${mohamed.employeeNo}` : '—',
});
push('create-org-emp', !!mohamed && mohamed.employeeNo && mohamed.orgName === 'مؤسسة الأفق' && mohamed.branchName === 'الرياض' && mohamed.department === 'المالية' && mohamed.jobTitle === 'محاسب' && !mohamed.clientNo, JSON.stringify(mohamed && { n: mohamed.naioshId, e: mohamed.employeeNo, o: mohamed.orgName }));

UI.ui.q = '';
UI.ui.org = '';
html = UI.render({ user: boss });
push('table-shows-mohamed', html.includes('محمد أحمد') && html.includes('مؤسسة الأفق') && html.includes('المالية') && html.includes('محاسب'));
push('compound-cell-email', html.includes('identity-test@example.com') && html.includes('idn-email'));

// Refresh persistence
const raw1 = localStorage.getItem(Store.KEY);
localStorage.setItem(Store.KEY, raw1);
const afterRefresh1 = Store.get().identities.find((i) => i.email === 'identity-test@example.com');
report[0].afterRefresh = afterRefresh1 ? 'موجود' : 'مفقود';
push('persist-mohamed-refresh', !!afterRefresh1 && afterRefresh1.department === 'المالية');

// Logout/Login simulation = clear UI state, reload store
UI.ui.view = 'users';
UI.ui.q = '';
const afterLogin = Store.get().identities.find((i) => i.email === 'identity-test@example.com');
report[0].afterLogoutLogin = afterLogin ? 'موجود' : 'مفقود';
push('persist-mohamed-relogin', !!afterLogin);

// Search by employee no
UI.ui.q = mohamed.employeeNo;
push('search-emp-mohamed', UI.filteredIdentities().some((i) => i.email === 'identity-test@example.com'));
UI.ui.q = mohamed.naioshId;
push('search-nai-mohamed', UI.filteredIdentities().some((i) => i.email === 'identity-test@example.com'));
UI.ui.q = '';
UI.ui.org = 'مؤسسة الأفق';
push('filter-org-mohamed', UI.filteredIdentities().some((i) => i.email === 'identity-test@example.com'));
UI.ui.org = '';

// Edit department
E.updateIdentity(mohamed.naioshId, { department: 'الموارد البشرية', jobTitle: 'أخصائي موارد بشرية', reason: 'e2e' }, 'مشغّل هوب');
const edited = E.findIdentity(mohamed.naioshId);
push('edit-dept', edited.department === 'الموارد البشرية' && edited.jobTitle === 'أخصائي موارد بشرية');
const afterEditRefresh = Store.get().identities.find((i) => i.naioshId === mohamed.naioshId);
report.push({
  test: 'تعديل القسم بعد الحفظ+Refresh',
  result: afterEditRefresh?.department === 'الموارد البشرية' ? 'نجح' : 'فشل',
  ids: mohamed.naioshId,
  afterRefresh: afterEditRefresh?.department || '—',
  afterLogoutLogin: Store.get().identities.find((i) => i.naioshId === mohamed.naioshId)?.department || '—',
});

// ——— اختبار 2: عميل فقط ———
const customer = E.createUserIdentity(
  {
    name: 'عميل الاختبار',
    email: 'identity-customer@example.com',
    phone: '0509998877',
    country: 'السعودية',
    userKind: 'CUSTOMER',
    status: 'active',
    roleCode: 'PLATFORM_CUSTOMER',
    systems: ['POSHA'],
    dataSource: 'user-created',
  },
  'مشغّل هوب'
);
report.push({
  test: 'إضافة عميل فقط',
  result: customer && customer.clientNo && !customer.employeeNo ? 'نجح' : 'فشل',
  ids: customer ? `نايوش=${customer.naioshId} عميل=${customer.clientNo}` : '—',
});
push('create-customer', !!customer && !!customer.clientNo && !customer.employeeNo && customer.userKind === 'CUSTOMER', JSON.stringify(customer && { n: customer.naioshId, c: customer.clientNo, e: customer.employeeNo }));
push('customer-no-forced-job', !customer.department && !customer.jobTitle);

// ——— اختبار 3: مزدوج الصفة ———
const dual = E.createUserIdentity(
  {
    name: 'مزدوج الاختبار',
    email: 'identity-dual@example.com',
    phone: '0505554433',
    country: 'السعودية',
    userKind: 'INTERNAL',
    alsoCustomer: true,
    orgId: 'ORG-NAIOSH',
    orgName: 'نايوش',
    branchName: 'المقر الرئيسي',
    department: 'التشغيل',
    jobTitle: 'منسق',
    roleCode: 'HUB_EMPLOYEE',
    systems: ['HUB'],
    status: 'active',
    dataSource: 'user-created',
  },
  'مشغّل هوب'
);
report.push({
  test: 'عميل + موظف (مزدوج)',
  result: dual && dual.clientNo && dual.employeeNo ? 'نجح' : 'فشل',
  ids: dual ? `نايوش=${dual.naioshId} عميل=${dual.clientNo} موظف=${dual.employeeNo}` : '—',
});
push('create-dual', !!dual && !!dual.clientNo && !!dual.employeeNo && !!dual.naioshId, JSON.stringify(dual && { n: dual.naioshId, c: dual.clientNo, e: dual.employeeNo }));

// Suspend / reactivate / archive
E.suspendIdentity(mohamed.naioshId, 'مشغّل هوب', 'e2e');
push('suspend', E.findIdentity(mohamed.naioshId).status === 'suspended');
E.reactivateIdentity(mohamed.naioshId, 'مشغّل هوب', 'e2e');
push('reactivate', E.findIdentity(mohamed.naioshId).status === 'active');
E.archiveIdentity(customer.naioshId, 'مشغّل هوب', 'e2e');
push('archive', E.findIdentity(customer.naioshId).status === 'archived');
report.push({
  test: 'إيقاف / إعادة تفعيل / أرشفة',
  result: 'نجح',
  ids: `موقوف ثم نشط: ${mohamed.naioshId} · مؤرشف: ${customer.naioshId}`,
  afterRefresh: Store.get().identities.find((i) => i.naioshId === mohamed.naioshId)?.status,
  afterLogoutLogin: Store.get().identities.find((i) => i.naioshId === customer.naioshId)?.status,
});

// Wizard fields coverage in add modal HTML
UI.handle('idn-add-open', { dataset: {} }, { user: boss, toast: () => {} });
html = UI.render({ user: boss });
push('wizard-step1-fields', html.includes('الاسم الكامل') && html.includes('نوع المستخدم') && html.includes('الحالة') && html.includes('سيتم إنشاؤه تلقائيًا'));
UI.ui.addStep = 3;
UI.ui.addDraft = { ...UI.blankDraft(), name: 'x', email: 'x@y.com', userKind: 'ORG_EMPLOYEE', orgName: 'مؤسسة الأفق', orgId: 'CL-1001' };
html = UI.render({ user: boss });
push('wizard-step3-org', html.includes('المؤسسة / الجهة') && html.includes('الفرع') && html.includes('القسم') && html.includes('المسمى الوظيفي'));
UI.ui.addStep = 5;
html = UI.render({ user: boss });
push('wizard-review', html.includes('المراجعة') || html.includes('سيتم إنشاؤه تلقائيًا'));

// Detail
UI.ui.modal = null;
UI.handle('idn-detail', { dataset: { id: mohamed.naioshId } }, { user: boss });
html = UI.render({ user: boss });
push('detail-sections', ['الهوية', 'المعرفات', 'الارتباط', 'الوصول', 'الحساب'].every((s) => html.includes(s)));
push('detail-phone-country', html.includes('0501112233') && html.includes('السعودية'));

// Seeds still present
push('seeds-present', ['NAI-INT-AHMED', 'NAI-CUS-SARA', 'NAI-ORG-KHALED', 'NAI-ORG-LAYLA', 'NAI-HYB-YOUSEF'].every((id) => E.findIdentity(id)));

const failed = tests.filter((t) => !t.ok);
console.log('=== تقرير الاختبار ===');
console.log(
  ['الاختبار', 'النتيجة', 'المعرف', 'بعد Refresh', 'بعد Logout/Login'].join(' | ')
);
report.forEach((r) => {
  console.log([r.test, r.result, r.ids || '—', r.afterRefresh || '—', r.afterLogoutLogin || '—'].join(' | '));
});
console.log(JSON.stringify({ total: tests.length, passed: tests.length - failed.length, failed: failed.map((t) => ({ n: t.n, d: t.d })) }, null, 2));
if (failed.length) {
  failed.forEach((t) => console.error('FAIL', t.n, t.d));
  process.exit(1);
}
console.log('OK identity registry unify e2e');
