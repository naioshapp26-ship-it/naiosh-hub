/**
 * Node checks: incubator granted via branch → client-only حاضنتي
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(String(k), String(v)),
  removeItem: (k) => store.delete(k),
};

class CustomEvent {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
}

const window = {
  localStorage,
  dispatchEvent() {},
  HubStore: { pushFeed() {} },
  HubSystemOps: {
    grantStructure(payload) {
      return { grantId: 'INC-001', type: payload.type, nameAr: payload.nameAr, refId: payload.refId };
    },
    grantSubdomain(payload) {
      return { grantId: 'SD-002', host: `${payload.slug}.naiosh.app` };
    },
    read() {
      return { structures: [] };
    },
  },
};

const context = vm.createContext({ window, localStorage, CustomEvent, console });
const load = (rel) => {
  vm.runInContext(fs.readFileSync(path.join('/workspace', rel), 'utf8'), context, { filename: rel });
};

load('js/hub-branches-data.js');
load('js/hub-incubators-data.js');
load('js/hub-client-platforms.js');
load('js/hub-client-incubators.js');

const CI = window.HubClientIncubators;
assert(CI, 'HubClientIncubators missing');

const sa = 'br-sa';
const eg = 'br-eg';
const incSa = CI.incubatorsForBranch(sa);
const incEg = CI.incubatorsForBranch(eg);
assert(incSa.length > 0, 'Saudi branch should have incubators');
assert(incEg.length > 0, 'Egypt branch should have incubators');
assert.strictEqual(
  incSa.filter((a) => incEg.some((b) => b.id === a.id)).length,
  0,
  'branch incubators must differ'
);

const emailA = 'inc-a@test.com';
const emailB = 'inc-b@test.com';
const grantA = CI.grantFromBooking({
  email: emailA,
  fullName: 'عميل أ',
  phone: '0500000001',
  subdomain: 'inc-alpha',
  country: 'المملكة العربية السعودية',
  branch: sa,
  branchLabel: 'السعودية',
  incubator: incSa[0].id,
  incubatorLabel: incSa[0].name,
  source: 'branch',
});
assert(grantA.ok, grantA.error);
assert.strictEqual(grantA.incubator.branch, sa);
assert.strictEqual(grantA.incubator.host, 'inc-alpha.naiosh.app');

const denied = CI.grantFromBooking({
  email: emailA,
  platformName: 'x',
  branch: sa,
  incubator: incEg[0].id,
  incubatorLabel: incEg[0].name,
});
assert.strictEqual(denied.ok, false, 'must reject incubator from another branch');

const grantB = CI.grantFromBooking({
  email: emailB,
  fullName: 'عميل ب',
  subdomain: 'inc-beta',
  country: 'مصر',
  branch: eg,
  branchLabel: 'مصر',
  incubator: incEg[0].id,
  incubatorLabel: incEg[0].name,
  source: 'branch',
});
assert(grantB.ok, grantB.error);

assert.strictEqual(CI.listForEmail(emailA).length, 1);
assert.strictEqual(CI.listForEmail(emailB).length, 1);
assert.strictEqual(CI.listForEmail(emailA)[0].incubator, incSa[0].id);
assert.strictEqual(CI.listForEmail(emailB)[0].incubator, incEg[0].id);
assert.strictEqual(CI.listForEmail('nobody@test.com').length, 0);

const html = fs.readFileSync('/workspace/book-incubator.html', 'utf8');
assert(html.includes('الفرع التابعة له عند التسجيل'), 'operating copy missing');
assert(html.includes('hub-client-incubators.js'), 'client incubators script missing');

const mine = fs.readFileSync('/workspace/my-incubator.html', 'utf8');
assert(mine.includes('فقط الحاضنات الخاصة بالعميل') || mine.includes('حاضنات العميل فقط'), 'my-incubator copy missing');

const sidebar = fs.readFileSync('/workspace/js/hero-sidebar-nav.js', 'utf8');
assert(sidebar.includes("ensure('حاضنتي', 'my-incubator.html'"), 'sidebar حاضنتي missing');
assert(sidebar.includes("href: 'my-incubator.html'"), 'sidebar href missing');

console.log('PASS incubator grant via branch + client isolation');
console.log(`  affiliated SA=${incSa.length} EG=${incEg.length}`);
console.log(`  A=${incSa[0].id} B=${incEg[0].id}`);
