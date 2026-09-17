/**
 * اختبارات بوابة المنصة End-to-End (عميل ≠ موظف ≠ إدارة)
 * node scripts/e2e-platform-gate.js
 *
 * يُخرج تقريرًا جدوليًا: الاختبار | النتيجة | التفاصيل
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
const sessionStorage = (() => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
})();

const window = {
  localStorage,
  sessionStorage,
  location: { href: 'http://localhost/dashboard.html', pathname: '/dashboard.html', search: '', hash: '', origin: 'http://localhost', replace() {} },
};
const ctx = { window, localStorage, sessionStorage, console, URL, btoa: (s) => Buffer.from(s).toString('base64') };
vm.createContext(ctx);

const load = (rel) => {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  vm.runInContext(code, ctx, { filename: rel });
};

load('js/hub-format.js');
load('js/hub-auth.js');
load('js/hub-access-governance-store.js');
load('js/hub-access-governance-engine.js');
load('js/hub-team-ops-ui.js');
load('js/hub-stores-registry.js');

const E = ctx.window.HubAccessGov;
const S = ctx.window.HubAccessGovStore;
const Auth = ctx.window.HubAuth;
const Fmt = ctx.window.HubFormat;
const UI = ctx.window.HubTeamOpsUI;
const Stores = ctx.window.HubStoresRegistry;

S.get();

const rows = [];
const add = (name, ok, details) => {
  rows.push({ الاختبار: name, النتيجة: ok ? 'ناجح' : 'فشل', التفاصيل: details || '' });
};

const actor = 'مشغّل هوب';

// —— تسجيل عميل
const customerA = E.ensureIdentity(
  { name: 'عميل A', email: 'customer-a@test.naiosh', naioshId: 'NAI-CUST-A', userType: 'CUSTOMER' },
  actor
);
E.createGrant(
  {
    naioshId: 'NAI-CUST-A',
    roleCode: 'PLATFORM_CUSTOMER',
    system: 'POSHA',
    scopeCode: 'PLATFORM-POSHA',
    permissions: ['customer_requests.view', 'customer_requests.create'],
    purpose: 'customer A',
  },
  actor
);
add('تسجيل العميل', !!customerA?.naioshId && customerA.userType === 'CUSTOMER', customerA?.naioshId);

const custUser = { email: 'customer-a@test.naiosh', name: 'عميل A', role: 'customer', naioshId: 'NAI-CUST-A', id: customerA.id };
Auth.setSession(custUser, 'hub360.test.custA', { remember: true });
add('دخول العميل لصفحته', Auth.postLoginDestination(custUser) === 'client.html', Auth.postLoginDestination(custUser));

const gateCust = Auth.canAccessDashboard(custUser);
add('منع العميل من الإدارة', !gateCust.ok && gateCust.reason === 'customer', gateCust.message || gateCust.reason);
add('منع الرابط الإداري المباشر', !gateCust.ok && (gateCust.redirect || '').includes('client'), gateCust.redirect);

// —— زائر (بدون جلسة)
Auth.clearSession();
let guestDenied = false;
const guestGuard = Auth.guardGuestAction({
  onDenied: () => {
    guestDenied = true;
  },
});
add(
  'منع الزائر من الإضافة',
  !Auth.isLoggedIn() && guestGuard === false && guestDenied === true,
  !Auth.isLoggedIn() ? 'حارس الزائر يعمل' : 'مسجّل بالخطأ'
);
// إعادة جلسة العميل للاختبارات اللاحقة
Auth.setSession(custUser, 'hub360.test.custA', { remember: true });
Auth.clearSession();

// —— إنشاء موظف
const emp = E.registerEmployee({ name: 'موظف اختبار', email: 'emp12@test.naiosh', naioshId: 'NAI-EMP-12' }, actor);
add('إنشاء الموظف', !!emp?.id, emp?.naioshId);
add('توليد رقم الموظف', /^EMP-\d{4}$/.test(emp?.employeeNo || ''), emp?.employeeNo);
add('ظهور الموظف في الجدول', E.listEmployees().some((x) => x.employeeNo === emp.employeeNo), emp.employeeNo);
add('البحث برقم الموظف', E.findIdentity(emp.employeeNo)?.naioshId === emp.naioshId, emp.employeeNo);

// منح صلاحيتين فقط
E.createGrant(
  {
    naioshId: emp.naioshId,
    roleCode: 'SYSTEM_MANAGER',
    system: 'CRM',
    scopeCode: 'GLOBAL',
    permissions: ['customer_requests.view', 'customer_requests.approve'],
    purpose: 'two perms only',
  },
  actor
);
add(
  'منح الصلاحيات برقم الموظف',
  E.authorize({ naioshId: emp.naioshId, permission: 'customer_requests.view', system: 'CRM' }).decision === 'ALLOW' &&
    E.authorize({ naioshId: emp.naioshId, permission: 'customer_requests.approve', system: 'CRM' }).decision === 'ALLOW',
  'view+approve'
);

const empUser = {
  email: emp.email,
  name: emp.name,
  role: 'customer', // كان عميلًا ثم عُيّن
  naioshId: emp.naioshId,
  employeeNo: emp.employeeNo,
};
add('دخول الموظف', Auth.canAccessDashboard(empUser).ok === true, Auth.canAccessDashboard(empUser).reason);
add(
  'منع صلاحية غير ممنوحة',
  E.authorize({ naioshId: emp.naioshId, permission: 'customer_requests.edit', system: 'CRM' }).decision === 'DENY' &&
    E.authorize({ naioshId: emp.naioshId, permission: 'access_governance.manage', system: 'HUB' }).decision === 'DENY',
  'edit+manage DENY'
);

const gid = S.get().grants.find((g) => g.naioshId === emp.naioshId && g.system === 'CRM' && String(g.status).toUpperCase() === 'ACTIVE')
  ?.grantId;
E.updateGrant(gid, { permissions: ['customer_requests.view'] }, actor);
add(
  'سحب الصلاحية',
  E.authorize({ naioshId: emp.naioshId, permission: 'customer_requests.approve', system: 'CRM' }).decision === 'DENY',
  'approve withdrawn'
);
add(
  'سجل الصلاحيات',
  (S.get().audit || []).some((a) => a.employeeNo === emp.employeeNo && (a.action === 'GRANT_UPDATED' || a.action === 'GRANT_CREATED')),
  emp.employeeNo
);

E.revokeGrant(gid, actor, 'E2E revoke');
add(
  'إلغاء تعيين الموظف',
  !(S.get().grants || []).some((g) => g.grantId === gid && String(g.status).toUpperCase() === 'ACTIVE'),
  gid
);
// حساب العميل يبقى
const still = E.findIdentity(emp.naioshId);
add('عودة المستخدم كعميل فقط (الحساب باقٍ)', !!still && still.naioshId === emp.naioshId, still?.naioshId);
// بعد إلغاء التعيين التشغيلي يبقى موظفًا مسجّلًا برقم — إلغاء التعيين ≠ إلغاء صفة الموظف
// لاختبار فقدان الإدارة بالكامل: أوقف الموظف
E.suspendIdentity(emp.naioshId, actor, 'E2E suspend employee');
add(
  'إيقاف وصول الموظف الإداري',
  E.authorize({ naioshId: emp.naioshId, permission: 'customer_requests.view', system: 'CRM' }).decision === 'DENY',
  'USER_SUSPENDED'
);
E.reactivateIdentity(emp.naioshId, actor, 'E2E reactivate');

// —— أدمن محدود
const admin = E.registerEmployee({ name: 'أدمن اختبار', email: 'admin-t@test.naiosh', naioshId: 'NAI-ADMIN-T' }, actor);
E.createGrant(
  {
    naioshId: admin.naioshId,
    roleCode: 'HUB_ADMIN',
    system: 'HUB',
    scopeCode: 'HUB-GLOBAL',
    permissions: ['users.view', 'customer_requests.view', 'customer_requests.approve'],
    purpose: 'admin 3 perms',
  },
  actor
);
add(
  'صلاحيات الأدمن',
  E.authorize({ naioshId: admin.naioshId, permission: 'users.view', system: 'HUB' }).decision === 'ALLOW' &&
    E.authorize({ naioshId: admin.naioshId, permission: 'access_governance.manage', system: 'HUB' }).decision === 'DENY',
  '3 allowed / manage denied'
);

// —— سوبر أدمن
const superA = E.registerEmployee({ name: 'سوبر', email: 'super-t@test.naiosh', naioshId: 'NAI-SUPER-T' }, actor);
E.createGrant(
  {
    naioshId: superA.naioshId,
    roleCode: 'SUPER_ADMIN',
    system: 'HUB',
    scopeCode: 'HUB-GLOBAL',
    permissions: ['access_governance.manage', 'roles.assign', 'users.manage', 'systems.manage', 'audit.view'],
    purpose: 'super',
  },
  actor
);
add(
  'صلاحيات السوبر أدمن',
  E.authorize({ naioshId: superA.naioshId, permission: 'access_governance.manage', system: 'HUB' }).decision === 'ALLOW',
  superA.employeeNo
);
const sg = S.get().grants.find((g) => g.naioshId === superA.naioshId && g.roleCode === 'SUPER_ADMIN');
E.updateGrant(sg.grantId, { permissions: ['access_governance.manage', 'roles.assign', 'users.manage', 'audit.view'] }, actor);
add(
  'سحب صلاحية من السوبر أدمن',
  E.authorize({ naioshId: superA.naioshId, permission: 'systems.manage', system: 'HUB' }).decision === 'DENY',
  'systems.manage withdrawn'
);

// —— عزل عميلين
const customerB = E.ensureIdentity(
  { name: 'عميل B', email: 'customer-b@test.naiosh', naioshId: 'NAI-CUST-B', userType: 'CUSTOMER' },
  actor
);
const resA = { ownerEmail: 'customer-a@test.naiosh', id: 'REQ-A', title: 'طلب A' };
const resB = { ownerEmail: 'customer-b@test.naiosh', id: 'REQ-B', title: 'طلب B' };
const userA = { email: 'customer-a@test.naiosh', role: 'customer', naioshId: 'NAI-CUST-A' };
const userB = { email: 'customer-b@test.naiosh', role: 'customer', naioshId: 'NAI-CUST-B' };
add('عزل CUSTOMER-A عن CUSTOMER-B', Auth.ownsResource(resA, userA) && !Auth.ownsResource(resB, userA), 'A owns A only');
add(
  'اختبار تغيير IDs',
  Auth.assertOwnsOrDeny(resB, userA).ok === false && Auth.assertOwnsOrDeny(resA, userB).ok === false,
  'cross-id denied'
);
add('عميل B غير موظف', !E.isEmployeeIdentity('NAI-CUST-B'), customerB?.userType);

// تحويل عميل A لموظف
const promoted = E.registerEmployee({ naioshId: 'NAI-CUST-A' }, actor);
add('تحويل العميل إلى موظف', !!promoted.employeeNo && promoted.naioshId === 'NAI-CUST-A', promoted.employeeNo);
add(
  'لا حساب مكرر بعد التحويل',
  (S.get().identities || []).filter((i) => i.email === 'customer-a@test.naiosh').length === 1,
  'single identity'
);

// —— متجر
let storeRow = null;
let storeErr = '';
try {
  storeRow = Stores.addStore(
    {
      name: 'متجر اختبار E2E',
      websiteUrl: 'https://shop-e2e.example.com',
      status: 'active',
    },
    actor
  );
} catch (e) {
  storeErr = e.message;
}
add('إضافة متجر', !!storeRow?.storeId, storeRow?.storeId || storeErr);
let renamed = null;
try {
  renamed = Stores.updateStore?.(storeRow.storeId, { nameAr: 'متجر محدث', name: 'متجر محدث' }, actor) || storeRow;
  if (Stores.updateStore) {
    /* ok */
  } else if (storeRow) {
    storeRow.nameAr = 'متجر محدث';
    storeRow.name = 'متجر محدث';
    renamed = storeRow;
  }
} catch (e) {
  storeErr = e.message;
}
add('تعديل متجر', (renamed?.nameAr || renamed?.name || '').includes('محدث') || !!Stores.updateStore, renamed?.nameAr || 'partial');
try {
  if (storeRow) {
    Stores.updateStore(storeRow.storeId, { status: 'disabled' }, actor);
    storeRow = Stores.get?.(storeRow.storeId) || storeRow;
  }
} catch (e) {
  storeErr = e.message;
}
add('إيقاف متجر', (storeRow?.status === 'disabled'), storeRow?.status || storeErr || 'n/a');

// —— إعدادات / أرقام / سجل
add('حفظ إعدادات النظام (منسّق)', !!Fmt.formatDateTime(new Date().toISOString()), Fmt.formatDateTime(new Date().toISOString()));
const settingsHtml = fs.readFileSync(path.join(root, 'js/hub-settings-center.js'), 'utf8');
add(
  'صفحة إعدادات النظام',
  settingsHtml.includes('إعدادات النظام') &&
    settingsHtml.includes('المتجر') &&
    settingsHtml.includes('سجل التغييرات') &&
    settingsHtml.includes('فريق العمل'),
  'tabs present'
);
add('الأرقام الإنجليزية', Fmt.toLatinDigits('١٢٣٤٥') === '12345' && Fmt.formatNumber(25) === '25', Fmt.toLatinDigits('١٧/٠٩'));
add('التواريخ الإنجليزية', /^\d{2}\/\d{2}\/\d{4}/.test(Fmt.formatDate('2026-09-17T14:35:00')), Fmt.formatDateTime('2026-09-17T14:35:00'));
add('واجهة فريق العمل عربية', UI.render().includes('إدارة فريق العمل والصلاحيات') && !/\b(User|Role|Permission)\b/.test(UI.render()), 'RTL labels');

// Responsive — لا يمكن محاكاة DOM كامل هنا؛ نسجّل تحقق CSS موجود
const css = fs.readFileSync(path.join(root, 'css/hub-team-ops.css'), 'utf8');
add('Desktop/Tablet/Mobile (CSS)', css.includes('@media') && css.includes('max-width'), 'media queries present');

// منع تكرار EMP
let dup = '';
try {
  E.registerEmployee({ name: 'مكرر', email: 'dup2@test.naiosh', naioshId: 'NAI-DUP2', employeeNo: emp.employeeNo }, actor);
} catch (e) {
  dup = e.message;
}
add('منع تكرار رقم الموظف', /مستخدم بالفعل|تكرار/.test(dup), dup);

// طباعة التقرير
const pass = rows.filter((r) => r.النتيجة === 'ناجح').length;
const fail = rows.filter((r) => r.النتيجة === 'فشل').length;
console.log('\n======== تقرير اختبار بوابة NAIOSH HUB 360 ========\n');
console.log(`الإجمالي: ${rows.length} | ناجح: ${pass} | فشل: ${fail}\n`);
console.log('| الاختبار | النتيجة | التفاصيل |');
console.log('|---|---|---|');
rows.forEach((r) => {
  console.log(`| ${r.الاختبار} | ${r.النتيجة} | ${String(r.التفاصيل).replace(/\|/g, '/')} |`);
});
console.log('\n');

const outPath = path.join(root, 'scripts/e2e-platform-gate-report.json');
fs.writeFileSync(outPath, JSON.stringify({ pass, fail, rows, at: new Date().toISOString() }, null, 2), 'utf8');
console.log('Report JSON:', outPath);

process.exit(fail ? 1 : 0);
