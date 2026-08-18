/**
 * Node checks for incubator → client platform grant (no browser).
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
  HubStore: {
    grantSubscription(payload) {
      const op = (window._subs = window._subs || []);
      const row = {
        id: `sub-${op.length + 1}`,
        email: String(payload.email || '').toLowerCase(),
        systemCode: String(payload.systemCode || '').toUpperCase(),
        source: payload.source,
        status: 'active',
      };
      op.unshift(row);
      return row;
    },
    pushFeed() {},
  },
  HubSystemOps: {
    grantStructure(payload) {
      return { grantId: 'PLT-001', type: payload.type, nameAr: payload.nameAr };
    },
    grantSubdomain(payload) {
      return { grantId: 'SD-001', host: `${payload.slug}.naiosh.app` };
    },
    read() {
      return { structures: [] };
    },
  },
};

const context = vm.createContext({
  window,
  localStorage,
  CustomEvent,
  console,
});

const load = (rel) => {
  const code = fs.readFileSync(path.join('/workspace', rel), 'utf8');
  vm.runInContext(code, context, { filename: rel });
};

load('js/hub-branches-data.js');
load('js/hub-incubators-data.js');
load('js/hub-client-platforms.js');

const CP = window.HubClientPlatforms;
assert(CP, 'HubClientPlatforms missing');

const sa = 'br-sa';
const eg = 'br-eg';
const incSa = CP.incubatorsForBranch(sa);
const incEg = CP.incubatorsForBranch(eg);
assert(incSa.length > 0, 'Saudi branch should have affiliated incubators');
assert(incEg.length > 0, 'Egypt branch should have affiliated incubators');
const overlap = incSa.filter((a) => incEg.some((b) => b.id === a.id));
assert.strictEqual(overlap.length, 0, 'affiliated incubators should differ by branch');

const emailA = 'client-a@test.com';
const emailB = 'client-b@test.com';
const grantA = CP.grantFromBooking({
  email: emailA,
  fullName: 'عميل أ',
  phone: '0500000001',
  platformName: 'منصة ألفا',
  subdomain: 'alpha-plt',
  country: 'المملكة العربية السعودية',
  branch: sa,
  branchLabel: 'السعودية',
  incubator: incSa[0].id,
  incubatorLabel: incSa[0].name,
  systems: [
    { code: 'ERP', label: 'ERP' },
    { code: 'CRM', label: 'CRM' },
  ],
  source: 'incubator',
});
assert(grantA.ok, grantA.error);
assert.strictEqual(grantA.platform.host, 'alpha-plt.naiosh.app');
assert.strictEqual(grantA.platform.systems.map((s) => s.code).join(','), 'ERP,CRM');

const grantB = CP.grantFromBooking({
  email: emailB,
  fullName: 'عميل ب',
  phone: '0500000002',
  platformName: 'منصة بيتا',
  subdomain: 'beta-plt',
  country: 'مصر',
  branch: eg,
  branchLabel: 'مصر',
  incubator: incEg[0].id,
  incubatorLabel: incEg[0].name,
  systems: [{ code: 'LAW', label: 'LAW' }],
  source: 'incubator',
});
assert(grantB.ok, grantB.error);

const onlyA = CP.listForEmail(emailA);
const onlyB = CP.listForEmail(emailB);
assert.strictEqual(onlyA.length, 1);
assert.strictEqual(onlyB.length, 1);
assert.strictEqual(onlyA[0].platformName, 'منصة ألفا');
assert.strictEqual(onlyB[0].platformName, 'منصة بيتا');
assert.strictEqual(CP.listForEmail('nobody@test.com').length, 0);

const denied = CP.grantFromBooking({
  email: emailA,
  platformName: 'بدون أنظمة',
  branch: sa,
  incubator: incSa[0].id,
  systems: [],
});
assert.strictEqual(denied.ok, false);

const subsA = (window._subs || []).filter((s) => s.email === emailA).map((s) => s.systemCode).sort();
const subsB = (window._subs || []).filter((s) => s.email === emailB).map((s) => s.systemCode);
assert.strictEqual(subsA.join(','), 'CRM,ERP');
assert.strictEqual(subsB.join(','), 'LAW');

const html = fs.readFileSync('/workspace/book-platform.html', 'utf8');
assert(html.includes('data-from-incubator'), 'incubator operating copy missing');
assert(html.includes('name="platformName"'), 'platform name field missing');
assert(html.includes('data-book-systems'), 'systems fieldset missing');
assert(html.includes('hub-client-platforms.js'), 'client platforms script missing');

const mine = fs.readFileSync('/workspace/my-platform.html', 'utf8');
assert(mine.includes('فقط منصات العميل'), 'my-platform copy missing');

const sidebar = fs.readFileSync('/workspace/js/hero-sidebar-nav.js', 'utf8');
assert(sidebar.includes("ensure('منصتي', 'my-platform.html'"), 'sidebar منصتي missing');
assert(!sidebar.includes("p.label !== 'منصتي' && p.label !== 'أنظمتي'"), 'منصتي still filtered out');

console.log('PASS incubator platform grant + client isolation');
console.log(`  affiliated incubators SA=${incSa.length} EG=${incEg.length}`);
console.log(`  client A systems=${subsA.join(',')} client B systems=${subsB.join(',')}`);
