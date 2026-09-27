/**
 * سجل الهويات — اختبار السيناريوهات الإلزامية
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
  HubAuth: {
    canAccessDashboard: () => ({ ok: true }),
    attachSsoParams: (url) => url + '?sso=1',
    isStaff: () => true,
  },
  HubOpsCatalog: {
    listSystems: () => [
      { code: 'HUB', name: 'هوب' },
      { code: 'CRM', name: 'عملاء' },
      { code: 'CONTENT', name: 'المدونة' },
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

const document = {
  querySelector: () => null,
  querySelectorAll: () => [],
  body: { appendChild: () => {} },
  addEventListener: () => {},
};

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

const boss = { name: 'مدير', email: 'boss@test', role: 'SUPER_ADMIN', naioshId: 'NAI-BOSS' };

// تحميل السجل (يشمل البذور الخمس)
Store.get();

const find = (nai) => E.findIdentity(nai);
const ahmed = find('NAI-INT-AHMED');
const sara = find('NAI-CUS-SARA');
const khaled = find('NAI-ORG-KHALED');
const layla = find('NAI-ORG-LAYLA');
const yousef = find('NAI-HYB-YOUSEF');

push('seed-internal', !!ahmed && ahmed.employeeNo === 'EMP-0010' && ahmed.userKind === 'INTERNAL' && ahmed.orgName === 'نايوش' && !ahmed.clientNo, ahmed && JSON.stringify({ e: ahmed.employeeNo, k: ahmed.userKind, o: ahmed.orgName, c: ahmed.clientNo }));
push('seed-customer', !!sara && !sara.employeeNo && sara.clientNo === 'CL-2001' && sara.userKind === 'CUSTOMER', sara && JSON.stringify({ e: sara.employeeNo, c: sara.clientNo, k: sara.userKind }));
push('seed-org-emp', !!khaled && khaled.employeeNo === 'EMP-0012' && khaled.orgName === 'مؤسسة الأفق' && khaled.branchName === 'الرياض' && khaled.department === 'المالية' && khaled.userKind === 'ORG_EMPLOYEE', khaled && JSON.stringify(khaled));
push('seed-org-mgr', !!layla && layla.userKind === 'ORG_MANAGER' && layla.orgName === 'مؤسسة الأفق' && layla.jobTitle, layla && JSON.stringify({ k: layla.userKind, o: layla.orgName, j: layla.jobTitle }));
push('seed-hybrid', !!yousef && yousef.employeeNo === 'EMP-0014' && yousef.clientNo === 'CL-2005', yousef && JSON.stringify({ e: yousef.employeeNo, c: yousef.clientNo }));

const htmlHome = UI.render({ user: boss, toast: () => {} });
push('home-title', htmlHome.includes('إدارة الهوية'));
push('home-users-card', htmlHome.includes('المستخدمون والهويات') && !htmlHome.includes('>تسجيل المستخدمين<'));
push('home-desc', htmlHome.includes('المؤسسات والفروع'));
push('home-perms-link', htmlHome.includes('#roles-permissions'));

UI.handle('idn-view', { dataset: { view: 'users' } }, { user: boss, toast: () => {} });
const htmlUsers = UI.render({ user: boss });
push('users-title', htmlUsers.includes('المستخدمون والهويات'));
push('users-cols', ['المستخدم', 'رقم نايوش', 'رقم العميل', 'رقم الموظف', 'البريد الإلكتروني', 'نوع المستخدم', 'المؤسسة / الجهة', 'الفرع', 'القسم', 'المسمى الوظيفي', 'الدور', 'الحالة', 'آخر دخول', 'الإجراءات'].every((c) => htmlUsers.includes(c)));
push('users-ahmed', htmlUsers.includes('أحمد الداخلي') && htmlUsers.includes('EMP-0010') && htmlUsers.includes('نايوش'));
push('users-sara', htmlUsers.includes('سارة العميل') && htmlUsers.includes('CL-2001') && !htmlUsers.match(/سارة العميل[\s\S]{0,400}EMP-/));
push('users-khaled-org', htmlUsers.includes('خالد الأفق') && htmlUsers.includes('مؤسسة الأفق') && htmlUsers.includes('الرياض') && htmlUsers.includes('المالية'));
push('users-layla', htmlUsers.includes('ليلى مديرة الأفق'));
push('users-yousef-both', htmlUsers.includes('يوسف المزدوج') && htmlUsers.includes('CL-2005') && htmlUsers.includes('EMP-0014'));
push('users-add-btn', htmlUsers.includes('إضافة مستخدم'));
push('users-kind-not-role-mix', htmlUsers.includes('نوع المستخدم') && htmlUsers.includes('الدور'));

// بحث برقم نايوش
UI.ui.q = 'NAI-ORG-KHALED';
UI.ui.org = '';
UI.ui.branch = '';
let filtered = UI.filteredIdentities();
push('search-naiosh', filtered.length === 1 && filtered[0].naioshId === 'NAI-ORG-KHALED', filtered.map((x) => x.naioshId).join(','));

// بحث برقم موظف
UI.ui.q = 'EMP-0012';
filtered = UI.filteredIdentities();
push('search-emp', filtered.some((x) => x.naioshId === 'NAI-ORG-KHALED'));

// فلتر مؤسسة الأفق
UI.ui.q = '';
UI.ui.org = 'مؤسسة الأفق';
filtered = UI.filteredIdentities();
push('filter-org', filtered.length >= 2 && filtered.every((x) => x.orgName === 'مؤسسة الأفق'), filtered.map((x) => x.name).join(','));

// فلتر فرع الرياض
UI.ui.branch = 'الرياض';
filtered = UI.filteredIdentities();
push('filter-branch', filtered.length >= 2 && filtered.every((x) => x.branchName === 'الرياض'), filtered.map((x) => x.name).join(','));

UI.ui.org = '';
UI.ui.branch = '';

// تفاصيل
UI.handle('idn-detail', { dataset: { id: 'NAI-ORG-KHALED' } }, { user: boss, toast: () => {} });
const htmlDetail = UI.render({ user: boss });
push('detail-title', htmlDetail.includes('ملف المستخدم'));
push('detail-sections', ['الهوية الأساسية', 'الارتباط المؤسسي', 'صفة العميل', 'الوصول والصلاحيات', 'النشاط'].every((s) => htmlDetail.includes(s)));
push('detail-org', htmlDetail.includes('مؤسسة الأفق') && htmlDetail.includes('الرياض') && htmlDetail.includes('المالية'));

// تعديل المؤسسة ثم refresh من التخزين
E.updateIdentity('NAI-ORG-KHALED', { orgName: 'مؤسسة الأفق', branchName: 'جدة', department: 'المبيعات', reason: 'e2e' }, 'مشغّل هوب');
const afterEdit = E.findIdentity('NAI-ORG-KHALED');
push('edit-branch', afterEdit.branchName === 'جدة' && afterEdit.department === 'المبيعات');

// تعديل الدور عبر المنح
const grant = (Store.get().grants || []).find((g) => g.naioshId === 'NAI-ORG-KHALED' && String(g.status).toUpperCase() === 'ACTIVE');
if (grant) {
  E.updateGrant(grant.id || grant.grantId, { roleCode: 'REPORT_VIEWER', reason: 'e2e role' }, 'مشغّل هوب');
}
const afterRole = (Store.get().grants || []).find((g) => g.naioshId === 'NAI-ORG-KHALED' && String(g.status).toUpperCase() === 'ACTIVE');
push('edit-role', afterRole && afterRole.roleCode === 'REPORT_VIEWER', afterRole && afterRole.roleCode);

// محاكاة Refresh — إعادة قراءة من localStorage
const raw = localStorage.getItem(Store.KEY);
localStorage.setItem(Store.KEY, raw);
const reloaded = Store.get();
const khaled2 = (reloaded.identities || []).find((i) => i.naioshId === 'NAI-ORG-KHALED');
push('persist-refresh', khaled2 && khaled2.branchName === 'جدة' && khaled2.department === 'المبيعات', khaled2 && JSON.stringify({ b: khaled2.branchName, d: khaled2.department }));

// إضافة مستخدم جديد مرتبط بمؤسسة الأفق
const created = E.createUserIdentity(
  {
    name: 'نورة الفرع',
    email: 'noura.branch@alofoq.example',
    phone: '0500009999',
    country: 'السعودية',
    userKind: 'BRANCH_EMPLOYEE',
    orgId: 'CL-1001',
    orgName: 'مؤسسة الأفق',
    branchName: 'الرياض',
    department: 'الموارد البشرية',
    jobTitle: 'موظفة فرع',
    roleCode: 'HUB_EMPLOYEE',
    systems: ['HUB'],
  },
  'مشغّل هوب'
);
push('create-user', !!created && created.orgName === 'مؤسسة الأفق' && created.employeeNo && created.userKind === 'BRANCH_EMPLOYEE', created && JSON.stringify(created));

// مؤسسة جديدة من العملاء تظهر في القائمة
const orgs = E.listOrganizations();
push('orgs-include-alofoq', orgs.some((o) => o.name === 'مؤسسة الأفق'));
push('orgs-include-naiosh', orgs.some((o) => o.name === 'نايوش'));

// نوع المستخدم ≠ الدور في العرض
UI.ui.q = '';
UI.ui.org = '';
UI.ui.branch = '';
UI.handle('idn-view', { dataset: { view: 'users' } }, { user: boss });
const htmlUsers2 = UI.render({ user: boss });
push('kind-label-org-mgr', htmlUsers2.includes('مدير مؤسسة'));
push('kind-label-customer', UI.userKindAr(sara) === 'عميل');
push('kind-label-org-emp', UI.userKindAr(khaled) === 'موظف مؤسسة');

// العميل يحتفظ برقمه بعد أن يصبح موظفًا (يوسف)
push('hybrid-keeps-client', yousef.clientNo === 'CL-2005' && yousef.employeeNo === 'EMP-0014');

// SSO / MFA ما زالا يعملان
UI.handle('idn-view', { dataset: { view: 'sso' } }, { user: boss, toast: () => {} });
const htmlSso = UI.render({ user: boss });
push('sso-table', htmlSso.includes('تسجيل الدخول الموحد') && htmlSso.includes('HUB'));

UI.handle('idn-view', { dataset: { view: 'mfa' } }, { user: boss, toast: () => {} });
const htmlMfa = UI.render({ user: boss });
push('mfa-table', htmlMfa.includes('التحقق الثنائي') || htmlMfa.includes('حالة التحقق'));

const failed = tests.filter((t) => !t.ok);
console.log(JSON.stringify({ total: tests.length, passed: tests.length - failed.length, failed: failed.map((t) => ({ n: t.n, d: t.d })) }, null, 2));
if (failed.length) {
  failed.forEach((t) => console.error('FAIL', t.n, t.d));
  process.exit(1);
}
console.log('OK identity registry e2e');
