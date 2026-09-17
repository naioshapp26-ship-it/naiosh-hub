/**
 * Smoke: هوية نايوش — بطاقات + مصفوفة + ربط الصلاحيات
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
  HubStore: { get: () => ({ settings: { requireMfa: true }, clients: [] }) },
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
const UI = ctx.window.HubIdentityUI;
const tests = [];
const push = (n, ok, d) => tests.push({ n, ok: !!ok, d: d == null ? '' : String(d) });

const boss = { name: 'مدير', email: 'boss@test', role: 'SUPER_ADMIN', naioshId: 'NAI-BOSS' };
E.registerEmployee({ name: 'محمد', email: 'm@test', naioshId: 'NAI-M' }, 'مشغّل هوب');
E.createGrant(
  {
    naioshId: 'NAI-M',
    roleCode: 'SYSTEM_MANAGER',
    system: 'CONTENT',
    permissions: ['roles.view', 'customer_requests.view', 'customer_requests.create', 'policies.publish'],
    purpose: 'e2e',
  },
  'مشغّل هوب'
);

const htmlHome = UI.render({ user: boss, toast: () => {} });
push('home-title', htmlHome.includes('إدارة الهوية'));
push('home-cards', htmlHome.includes('تسجيل المستخدمين') && htmlHome.includes('تسجيل الدخول الموحد') && htmlHome.includes('التحقق الثنائي'));
push('home-no-sso-chip', !htmlHome.includes('>SSO<'));
push('home-perms-link', htmlHome.includes('#roles-permissions'));

UI.handle('idn-view', { dataset: { view: 'users' } }, { user: boss, toast: () => {} });
const htmlUsers = UI.render({ user: boss });
push('users-table', htmlUsers.includes('رقم نايوش') && htmlUsers.includes('محمد'));

UI.handle('idn-view', { dataset: { view: 'sso' } }, { user: boss, toast: () => {} });
const htmlSso = UI.render({ user: boss });
push('sso-table', htmlSso.includes('تسجيل الدخول الموحد') && htmlSso.includes('HUB'));

UI.handle('idn-view', { dataset: { view: 'mfa' } }, { user: boss, toast: () => {} });
const htmlMfa = UI.render({ user: boss });
push('mfa-table', htmlMfa.includes('التحقق الثنائي') || htmlMfa.includes('حالة التحقق'));

UI.handle('idn-view', { dataset: { view: 'matrix' } }, { user: boss, toast: () => {} });
UI.ui.matrixEmp = 'NAI-M';
const htmlMx = UI.render({ user: boss });
push('matrix-content', htmlMx.includes('CONTENT') || htmlMx.includes('مصفوفة'));
push('matrix-actions', htmlMx.includes('عرض') && htmlMx.includes('نشر'));

UI.handle('idn-mfa-on', { dataset: { id: 'NAI-M' } }, { user: boss, toast: () => {} });
push('mfa-on', UI.secOf('NAI-M').mfaEnabled === true);

const denied = UI.render({ user: { name: 'عميل', email: 'c@test', role: 'customer' } });
push('client-denied-or-empty', denied.includes('غير مصرح') || denied.includes('إدارة الهوية'));

const failed = tests.filter((t) => !t.ok);
console.log(JSON.stringify({ passed: tests.filter((t) => t.ok).length, failed: failed.length, failed }, null, 2));
if (failed.length) process.exit(1);
console.log('PASS identity-ui e2e');
