/**
 * Node checks: HQ platform grant — no branch, no incubator, client-only منصتي
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
      return { grantId: 'PLT-HQ', type: payload.type, refId: payload.refId };
    },
    grantSubdomain(payload) {
      return { grantId: 'SD-HQ', host: `${payload.slug}.naiosh.app` };
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

const CP = window.HubClientPlatforms;
const email = 'hq-client@test.com';
const other = 'other-hq@test.com';

const deniedNoSystems = CP.grantFromBooking({
  source: 'hq',
  email,
  platformName: 'منصة المقر',
  subdomain: 'hq-plt',
  systems: [],
});
assert.strictEqual(deniedNoSystems.ok, false);

const deniedIncubatorPath = CP.grantFromBooking({
  source: 'incubator',
  email,
  platformName: 'منصة بلا فرع',
  systems: [{ code: 'ERP', label: 'ERP' }],
});
assert.strictEqual(deniedIncubatorPath.ok, false);

const grant = CP.grantFromBooking({
  source: 'hq',
  email,
  fullName: 'عميل المقر',
  platformName: 'منصة المقر',
  subdomain: 'hq-plt',
  country: 'مصر',
  systems: [
    { code: 'ERP', label: 'ERP' },
    { code: 'LAW', label: 'LAW' },
  ],
});
assert(grant.ok, grant.error);
assert.strictEqual(grant.platform.source, 'hq');
assert.strictEqual(grant.platform.branch, '');
assert.strictEqual(grant.platform.incubator, '');
assert.strictEqual(grant.platform.branchLabel, 'المكتب الرئيسي');
assert.strictEqual(grant.platform.host, 'hq-plt.naiosh.app');
assert.strictEqual(grant.platform.systems.map((s) => s.code).join(','), 'ERP,LAW');

CP.grantFromBooking({
  source: 'hq',
  email: other,
  platformName: 'منصة أخرى',
  subdomain: 'hq-other',
  systems: [{ code: 'CRM', label: 'CRM' }],
});

assert.strictEqual(CP.listForEmail(email).length, 1);
assert.strictEqual(CP.listForEmail(other).length, 1);
assert.strictEqual(CP.listForEmail(email)[0].platformName, 'منصة المقر');
assert.strictEqual(CP.listForEmail(other)[0].platformName, 'منصة أخرى');

const html = fs.readFileSync('/workspace/book-platform.html', 'utf8');
assert(html.includes('data-from-hq'), 'HQ operating copy missing');
assert(html.includes('data-not-hq'), 'HQ hide branch/incubator missing');
assert(html.includes('data-work-systems'), 'work systems fieldset missing');

console.log('PASS HQ platform grant — no branch/incubator + client isolation');
console.log(`  host=${grant.platform.host} systems=${grant.platform.systems.map((s) => s.code).join(',')}`);
