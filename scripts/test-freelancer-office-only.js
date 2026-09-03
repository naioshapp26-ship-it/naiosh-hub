/**
 * احجز معنا فريلانسر — مكتب فقط من المقر، بدون منصة وبدون نظام
 * يشغّل المحرك الحقيقي HubSystemOps للتأكد أن systemCode يبقى فارغًا.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const index = fs.readFileSync('/workspace/index.html', 'utf8');
assert(index.includes('احجز معنا فريلانسر'), 'homepage CTA label missing');
assert(index.includes('register-freelancer.html'), 'homepage CTA href missing');

const page = fs.readFileSync('/workspace/register-freelancer.html', 'utf8');
assert(page.includes('احجز معنا فريلانسر'), 'freelancer page title/copy missing');
assert(page.includes('hub-client-offices.js?v=3'), 'register must load offices v=3');
assert(page.includes('hub-freelancer-register.js?v=4'), 'freelancer script cache bump');
assert(page.includes('my-office.html'), 'must link to مكتبي');
assert(page.includes('fl-projects-required-proxy'), 'projects required proxy missing');

const bookOffice = fs.readFileSync('/workspace/book-office.html', 'utf8');
assert(bookOffice.includes('hub-client-offices.js?v=3'), 'book-office cache must match');

const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(String(k), String(v)),
  removeItem: (k) => store.delete(k),
};
const window = {
  localStorage,
  dispatchEvent() {},
  HubStore: { pushFeed() {}, grantOffice() {} },
};
const document = { readyState: 'complete', addEventListener() {}, querySelector() { return null; } };
const context = vm.createContext({ window, localStorage, document, console, CustomEvent: class CustomEvent {} });
const load = (rel) => {
  vm.runInContext(fs.readFileSync(path.join('/workspace', rel), 'utf8'), context, { filename: rel });
};

load('js/hub-system-ops-spec.js');
load('js/hub-system-ops-engine.js');
load('js/hub-client-offices.js');

assert(window.HubSystemOps?.grantStructure, 'real HubSystemOps missing');

const empty = window.HubSystemOps.grantStructure({
  type: 'office',
  nameAr: 'مكتب بلا نظام',
  tenantName: 'اختبار',
  systemCode: '',
  refId: 'HQ',
});
assert.strictEqual(empty.systemCode, '', 'engine must keep explicit empty systemCode');

const withErp = window.HubSystemOps.grantStructure({
  type: 'office',
  nameAr: 'مكتب ERP',
  tenantName: 'اختبار',
});
assert.strictEqual(withErp.systemCode, 'ERP', 'default systemCode remains ERP');

const email = 'freelancer@test.com';
const res = window.HubClientOffices.grantFromBooking({
  kind: 'freelancer',
  source: 'freelancer',
  email,
  fullName: 'فريلانسر تجريبي',
  phone: '0500000000',
  officeName: 'مكتب فريلانسر — فريلانسر تجريبي',
  systems: [{ code: 'ERP' }],
  subdomain: 'should-not-create',
});
assert(res.ok, res.error);
assert.strictEqual(res.reused, false);
assert.strictEqual(res.office.source, 'freelancer');
assert.strictEqual(res.office.kind, 'freelancer');
assert.ok(Array.isArray(res.office.systems) && res.office.systems.length === 0, 'systems empty');
assert.strictEqual(res.office.platform, '');
assert.strictEqual(res.office.slug, '');
assert.strictEqual(res.office.grants.platform, false);
assert.strictEqual(res.office.grants.system, false);
assert.strictEqual(res.office.grants.office, true);
assert.strictEqual(res.office.grants.operatedBy, 'hq');
assert.ok(res.office.grantId, 'grant id expected');

const structures = window.HubSystemOps.read().structures || [];
const flStructure = structures.find((s) => s.grantId === res.office.grantId);
assert(flStructure, 'structure grant missing in ops engine');
assert.strictEqual(flStructure.systemCode, '', 'freelancer structure must not get ERP');

const again = window.HubClientOffices.grantFromBooking({
  kind: 'freelancer',
  email,
  fullName: 'فريلانسر تجريبي',
});
assert(again.ok);
assert.strictEqual(again.reused, true, 'second booking must reuse office');
assert.strictEqual(again.office.grantId, res.office.grantId, 'success grantId must match مكتبي');
assert.strictEqual(window.HubClientOffices.listForEmail(email).length, 1, 'no duplicate offices');

const afterCount = (window.HubSystemOps.read().structures || []).filter(
  (s) => s.type === 'office' && String(s.tenantName || '').includes('فريلانسر')
).length;
assert.strictEqual(afterCount, 1, 'rebooking must not create orphan structure grants');

const src = fs.readFileSync('/workspace/js/hub-freelancer-register.js', 'utf8');
assert(src.includes('HubClientOffices'), 'freelancer register must grant via client offices');
assert(src.includes('selectedCount()'), 'must block submit without projects');
assert(src.includes('my-office.html'), 'success must link مكتبي');

console.log('PASS freelancer office-only grant from HQ (real ops engine)');
console.log(`  grantId=${res.office.grantId} systemCode="${flStructure.systemCode}"`);
