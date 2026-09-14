/**
 * E2E: Site Settings + Store admin migration
 * Run: node scripts/e2e-site-settings.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function makeSb() {
  const local = { _d: Object.create(null) };
  const sb = {
    console,
    URL,
    localStorage: {
      getItem(k) {
        return Object.prototype.hasOwnProperty.call(local._d, k) ? local._d[k] : null;
      },
      setItem(k, v) {
        local._d[k] = String(v);
      },
      removeItem(k) {
        delete local._d[k];
      },
    },
    document: {
      readyState: 'complete',
      body: { dataset: {} },
      addEventListener() {},
      dispatchEvent() {},
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      getElementById() {
        return null;
      },
      createElement() {
        return { style: {}, appendChild() {}, setAttribute() {} };
      },
    },
    window: null,
    CustomEvent: function (n) {
      this.type = n;
    },
  };
  sb.window = sb;
  sb.window.dispatchEvent = () => {};
  sb.window.addEventListener = () => {};
  sb.window.HubAuth = {
    getUser: () => ({ email: 'admin@test.com', name: 'Admin', role: 'admin' }),
    isStaff: () => true,
  };
  sb.window.HubMarketplaceData = {
    MARKETPLACE_CONNECTORS: [
      { id: 'amazon', storeId: 'STORE-AMAZON', name: 'Amazon', websiteUrl: 'https://www.amazon.com', domains: ['amazon.'], icon: 'fa-brands fa-amazon' },
      { id: 'noon', storeId: 'STORE-NOON', name: 'Noon', websiteUrl: 'https://www.noon.com', domains: ['noon.'], icon: 'fas fa-moon' },
      { id: 'alibaba', storeId: 'STORE-ALIBABA', name: 'Alibaba', websiteUrl: 'https://www.alibaba.com', domains: ['alibaba.'], icon: 'fas fa-store' },
      { id: 'aliexpress', storeId: 'STORE-ALIEXPRESS', name: 'AliExpress', websiteUrl: 'https://www.aliexpress.com', domains: ['aliexpress.'], icon: 'fas fa-store' },
      { id: 'ebay', storeId: 'STORE-EBAY', name: 'eBay', websiteUrl: 'https://www.ebay.com', domains: ['ebay.'], icon: 'fas fa-store' },
      { id: 'walmart', storeId: 'STORE-WALMART', name: 'Walmart', websiteUrl: 'https://www.walmart.com', domains: ['walmart.'], icon: 'fas fa-store' },
      { id: 'etsy', storeId: 'STORE-ETSY', name: 'Etsy', websiteUrl: 'https://www.etsy.com', domains: ['etsy.'], icon: 'fas fa-store' },
      { id: 'temu', storeId: 'STORE-TEMU', name: 'Temu', websiteUrl: 'https://www.temu.com', domains: ['temu.'], icon: 'fas fa-store' },
      { id: 'shein', storeId: 'STORE-SHEIN', name: 'Shein', websiteUrl: 'https://www.shein.com', domains: ['shein.'], icon: 'fas fa-store' },
    ],
  };
  vm.createContext(sb);
  return sb;
}

function boot(sb) {
  vm.runInContext(read('js/hub-site-settings.js'), sb);
  vm.runInContext(read('js/hub-stores-registry.js'), sb);
  return sb;
}

function run() {
  const results = [];
  const pass = (n) => results.push({ name: n, ok: true });
  const fail = (n, e) => results.push({ name: n, ok: false, err: String(e.message || e) });

  try {
    const dash = read('js/dashboard.js');
    assert.ok(dash.includes("key: 'site-settings'"));
    assert.ok(dash.includes('إعدادات الموقع'));
    const idxPosha = dash.indexOf("key: 'posha-clients'");
    const idxSite = dash.indexOf("key: 'site-settings'");
    const idxOs = dash.indexOf("key: 'posha-os'");
    assert.ok(idxPosha < idxSite && idxSite < idxOs, 'nav order');
    pass('1 sidebar order: posha → site-settings → posha-os');
  } catch (e) {
    fail('1 sidebar order: posha → site-settings → posha-os', e);
  }

  try {
    const sb = boot(makeSb());
    const list = sb.window.HubStoresRegistry.listAdmin();
    const ids = list.map((s) => s.storeId);
    [
      'STORE-AMAZON',
      'STORE-NOON',
      'STORE-ALIBABA',
      'STORE-ALIEXPRESS',
      'STORE-EBAY',
      'STORE-WALMART',
      'STORE-ETSY',
      'STORE-TEMU',
      'STORE-SHEIN',
    ].forEach((id) => assert.ok(ids.includes(id), id));
    const amazon = sb.window.HubStoresRegistry.get('STORE-AMAZON');
    assert.strictEqual(amazon.websiteUrl, 'https://www.amazon.com');
    pass('2 seed stores present with URLs');
  } catch (e) {
    fail('2 seed stores present with URLs', e);
  }

  try {
    const sb = boot(makeSb());
    const R = sb.window.HubStoresRegistry;
    R.updateStore('STORE-AMAZON', { name: 'Amazon Test', nameAr: 'Amazon Test' }, 'Admin');
    assert.strictEqual(R.get('STORE-AMAZON').nameAr, 'Amazon Test');
    R.updateStore('STORE-AMAZON', { status: 'disabled' }, 'Admin');
    assert.strictEqual(R.get('STORE-AMAZON').status, 'disabled');
    const active = R.listActive().map((s) => s.storeId);
    assert.ok(!active.includes('STORE-AMAZON'));
    R.updateStore('STORE-AMAZON', { status: 'active', allowCustomers: true }, 'Admin');
    assert.ok(R.listActive().some((s) => s.storeId === 'STORE-AMAZON'));
    pass('3 edit / disable / enable persists');
  } catch (e) {
    fail('3 edit / disable / enable persists', e);
  }

  try {
    const sb = boot(makeSb());
    const created = sb.window.HubStoresRegistry.addStore(
      {
        name: 'TestMart',
        storeCode: 'TESTMART',
        websiteUrl: 'https://www.testmart.example',
        logo: 'data:image/png;base64,xx',
        status: 'active',
      },
      'Admin'
    );
    assert.strictEqual(created.storeId, 'STORE-TESTMART');
    assert.ok(sb.window.HubStoresRegistry.get('STORE-TESTMART'));
    const audit = sb.window.HubSiteSettings.listAudit({ section: 'stores' });
    assert.ok(audit.some((a) => a.action === 'Store Created'));
    pass('4 create store + audit');
  } catch (e) {
    fail('4 create store + audit', e);
  }

  try {
    const sb = boot(makeSb());
    sb.window.HubSiteSettings.updateSection('orders', { slaHours: 2, requireAdminApproval: true }, 'Admin');
    assert.strictEqual(sb.window.HubSiteSettings.get().orders.slaHours, 2);
    assert.ok(sb.window.HubSiteSettings.listAudit({ section: 'orders' }).length >= 1);
    pass('5 site settings section save + audit');
  } catch (e) {
    fail('5 site settings section save + audit', e);
  }

  try {
    const upload = read('js/hub-store-upload.js');
    assert.ok(!upload.includes('إعدادات المتاجر (Admin)'));
    assert.ok(!upload.includes('adminStoresHtml'));
    assert.ok(!upload.includes('su-admin-stores'));
    const ui = read('js/hub-site-settings-ui.js');
    assert.ok(ui.includes('إعدادات المتجر'));
    assert.ok(ui.includes('data-ss-add-store'));
    pass('6 admin settings removed from store.html wizard; present in site-settings');
  } catch (e) {
    fail('6 admin settings removed from store.html wizard; present in site-settings', e);
  }

  try {
    const sb = boot(makeSb());
    const del = sb.window.HubStoresRegistry.deleteStore('STORE-AMAZON', 'Admin');
    // no products → should allow delete of seed without links
    assert.ok(del.ok);
    assert.ok(!sb.window.HubStoresRegistry.get('STORE-AMAZON'));
    pass('7 delete unlinked store');
  } catch (e) {
    fail('7 delete unlinked store', e);
  }

  try {
    const sb = boot(makeSb());
    sb.window.HubStoresRegistry.createSubmission(
      { storeId: 'STORE-NOON', title: 'P1', productUrl: 'https://www.noon.com/p/1', priceUsd: 10 },
      'client'
    );
    const del = sb.window.HubStoresRegistry.deleteStore('STORE-NOON', 'Admin');
    assert.ok(!del.ok);
    assert.ok(String(del.message).includes('أرشفته'));
    pass('8 block delete when products linked');
  } catch (e) {
    fail('8 block delete when products linked', e);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  if (failed.length) process.exit(1);
}

run();
