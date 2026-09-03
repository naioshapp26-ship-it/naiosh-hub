/**
 * احجز معنا فريلانسر — مكتب فقط من المقر، بدون منصة وبدون نظام
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
assert(page.includes('لا يُمنح منصة ولا يُمنح نظام') || page.includes('بدون منصة'), 'no-platform copy missing');
assert(page.includes('hub-client-offices.js'), 'must load client offices');
assert(page.includes('hub-freelancer-register.js?v=3'), 'freelancer script cache bump');
assert(page.includes('my-office.html'), 'must link to مكتبي');

const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(String(k), String(v)),
  removeItem: (k) => store.delete(k),
};
const window = {
  localStorage,
  dispatchEvent() {},
  HubSystemOps: {
    grantStructure(payload) {
      assert.strictEqual(payload.type, 'office');
      assert.strictEqual(payload.systemCode, '', 'freelancer must not get a system code');
      return { grantId: 'OFF-FL-001', type: 'office', nameAr: payload.nameAr };
    },
    grantSubdomain() {
      throw new Error('freelancer must not grant subdomain/platform');
    },
  },
};
const context = vm.createContext({ window, localStorage, console });
vm.runInContext(fs.readFileSync('/workspace/js/hub-client-offices.js', 'utf8'), context, {
  filename: 'hub-client-offices.js',
});

const email = 'freelancer@test.com';
const res = window.HubClientOffices.grantFromBooking({
  kind: 'freelancer',
  source: 'freelancer',
  email,
  fullName: 'فريلانسر تجريبي',
  phone: '0500000000',
  officeName: 'مكتب فريلانسر — فريلانسر تجريبي',
  systems: [{ code: 'ERP' }], // يجب تجاهله
  subdomain: 'should-not-create',
});
assert(res.ok, res.error);
assert.strictEqual(res.office.source, 'freelancer');
assert.strictEqual(res.office.kind, 'freelancer');
assert.ok(Array.isArray(res.office.systems) && res.office.systems.length === 0, 'freelancer systems must be empty');
assert.strictEqual(res.office.platform, '');
assert.strictEqual(res.office.slug, '');
assert.strictEqual(res.office.grants.platform, false);
assert.strictEqual(res.office.grants.system, false);
assert.strictEqual(res.office.grants.office, true);
assert.strictEqual(res.office.grants.operatedBy, 'hq');
assert.strictEqual(window.HubClientOffices.listForEmail(email).length, 1);
assert.strictEqual(window.HubClientOffices.listForEmail('other@test.com').length, 0);

const src = fs.readFileSync('/workspace/js/hub-freelancer-register.js', 'utf8');
assert(src.includes('HubClientOffices'), 'freelancer register must grant via client offices');
assert(src.includes("platform: false") || src.includes('platformGranted: false'), 'must record no platform');
assert(src.includes('my-office.html'), 'success must link مكتبي');

console.log('PASS freelancer office-only grant from HQ');
