/**
 * سيناريو مليكة التشغيلي — Access Governance
 * Run: node scripts/test-access-governance-malika.js
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
const context = { console, localStorage, window: {}, Date, Math, JSON, Array, Object, String, Number, Set, Map, Error };
context.window = context;
vm.createContext(context);
vm.runInContext(read('js/hub-access-governance-store.js'), context);
vm.runInContext(read('js/hub-access-governance-engine.js'), context);

const Store = context.window.HubAccessGovStore;
const Eng = context.window.HubAccessGov;
localStorage.removeItem(Store.KEY);
const st0 = Store.get();
const malika = st0.identities.find((i) => i.email === 'malika@naiosh.com' || /مليكة/.test(i.name));
assert.ok(malika, 'مليكة موجودة في الكتالوج');

// تعيين مليكة كمديرة تشغيل في نايوش هوب
Eng.createGrant(
  {
    naioshId: malika.naioshId,
    positionCode: 'HUB_ADMIN_POS',
    roleCode: 'HUB_ADMIN',
    system: 'HUB',
    scopeCode: 'HUB-GLOBAL',
    governanceLevel: 'HUB',
    purpose: 'تعيين مليكة مديرة في نايوش هوب 360',
    authorityCodes: ['ACCESS_GRANT_AUTHORITY', 'FIN_APPROVE_25K'],
  },
  'tester'
);

let grant = Store.get().grants.find((g) => g.naioshId === malika.naioshId && g.status === 'ACTIVE');
assert.ok(grant, 'التعيين ظاهر');
assert.strictEqual(grant.roleCode, 'HUB_ADMIN');

let allow = Eng.authorize({ naioshId: malika.naioshId, permission: 'users.assign', system: 'HUB' });
assert.strictEqual(allow.decision, 'ALLOW', 'الوصول يعمل بعد التعيين');

// تغيير الدور
Eng.updateGrant(grant.grantId, { roleCode: 'HUB_AUDITOR', permissions: ['audit.view', 'audit.export', 'roles.view', 'users.view', 'access_governance.view'], reason: 'تعديل دور مليكة' }, 'tester');
grant = Store.get().grants.find((g) => g.grantId === grant.grantId);
assert.strictEqual(grant.roleCode, 'HUB_AUDITOR');
const afterChange = Eng.authorize({ naioshId: malika.naioshId, permission: 'users.assign', system: 'HUB' });
assert.strictEqual(afterChange.decision, 'DENY', 'بعد تغيير الدور لا تملك تعيين مستخدمين');
const auditView = Eng.authorize({ naioshId: malika.naioshId, permission: 'audit.view', system: 'HUB' });
assert.strictEqual(auditView.decision, 'ALLOW', 'صلاحية المدقق فعّالة');

// إيقاف
Eng.suspendIdentity(malika.naioshId, 'tester', 'إيقاف مليكة');
assert.strictEqual(Eng.authorize({ naioshId: malika.naioshId, permission: 'audit.view', system: 'HUB' }).decision, 'DENY');
assert.strictEqual(Eng.effectiveAccess(malika.naioshId).status, 'SUSPENDED');

// إعادة تفعيل
Eng.reactivateIdentity(malika.naioshId, 'tester', 'إعادة');
assert.strictEqual(Eng.authorize({ naioshId: malika.naioshId, permission: 'audit.view', system: 'HUB' }).decision, 'ALLOW');

// إلغاء التعيين — الحساب يبقى
Eng.revokeGrant(grant.grantId, 'tester', 'إلغاء تعيين مليكة');
const stillUser = Eng.findIdentity(malika.naioshId);
assert.ok(stillUser && stillUser.status === 'active', 'الحساب ما زال موجودًا');
assert.strictEqual(Eng.authorize({ naioshId: malika.naioshId, permission: 'audit.view', system: 'HUB' }).decision, 'DENY');

const audit = Store.get().audit.filter((a) => a.targetUser === malika.naioshId);
assert.ok(audit.some((a) => a.action === 'GRANT_CREATED'));
assert.ok(audit.some((a) => a.action === 'GRANT_UPDATED'));
assert.ok(audit.some((a) => a.action === 'USER_SUSPENDED'));
assert.ok(audit.some((a) => a.action === 'USER_REACTIVATED'));
assert.ok(audit.some((a) => a.action === 'GRANT_REVOKED'));

const uiSrc = read('js/hub-access-governance-ui.js');
assert.ok(uiSrc.includes('حوكمة الوصول والأدوار'));
assert.ok(uiSrc.includes('ماذا تريد أن تفعل؟'));
assert.ok(uiSrc.includes('تعيين مستخدم'));
assert.ok(uiSrc.includes('إلغاء التعيين'));
assert.ok(uiSrc.includes('نايوش هوب 360'));
assert.ok(uiSrc.includes('إمبراطورية نايوش'));
assert.ok(!uiSrc.includes('NAIOSHAI EMPIRE'));
assert.ok(!uiSrc.includes('Temporary Access'));
assert.ok(!uiSrc.includes('Orphaned Access'));

console.log('PASS سيناريو مليكة التشغيلي + تعريب الواجهة');
