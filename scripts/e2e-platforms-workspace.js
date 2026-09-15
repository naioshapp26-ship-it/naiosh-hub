/**
 * E2E: Platforms Center — access request → admin approve → available
 * Run: node scripts/e2e-platforms-workspace.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function makeSb(email) {
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
    sessionStorage: {
      _d: Object.create(null),
      getItem(k) {
        return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null;
      },
      setItem(k, v) {
        this._d[k] = String(v);
      },
      removeItem(k) {
        delete this._d[k];
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
    },
    window: null,
    CustomEvent: function (n, opts) {
      this.type = n;
      this.detail = opts && opts.detail;
    },
    location: { href: '', pathname: '/platforms.html', search: '', hash: '' },
  };
  sb.window = sb;
  sb.window.dispatchEvent = () => {};
  sb.window.addEventListener = () => {};
  sb.window.HubAuth = {
    getUser: () => ({ email: email || 'client@test.com', name: 'عميل تجريبي', role: 'customer' }),
    isStaff: () => false,
    isLoggedIn: () => true,
  };
  sb.window.HubSovereignPlatforms = {
    list: [
      {
        code: 'NERP',
        nameAr: 'نظام إدارة الموارد',
        role: 'ERP',
        desc: 'وصف',
        category: 'operations',
        icon: 'fa-building',
      },
      {
        code: 'NMS',
        nameAr: 'التسويق والهوية',
        role: 'تسويق',
        desc: 'وصف',
        category: 'growth',
        icon: 'fa-bullhorn',
      },
      {
        code: 'UOS',
        nameAr: 'النظام التشغيلي الموحد',
        role: 'دماغ',
        desc: 'وصف',
        category: 'core',
        icon: 'fa-brain',
      },
    ],
    categories: {
      core: { id: 'core', label: 'النواة السيادية' },
      operations: { id: 'operations', label: 'التشغيل والموارد' },
      growth: { id: 'growth', label: 'النمو والواجهة' },
    },
    count: 3,
  };
  vm.createContext(sb);
  return sb;
}

function boot(sb) {
  sb.globalThis = sb;
  vm.runInContext(read('js/hub-customer-requests.js'), sb);
}

function run() {
  const results = [];
  const pass = (n) => results.push({ name: n, ok: true });
  const fail = (n, e) => results.push({ name: n, ok: false, err: String(e.message || e) });

  try {
    const html = read('platforms.html');
    assert.ok(html.includes('hub-platforms-workspace.js'));
    assert.ok(html.includes('hub-platforms-workspace.css'));
    assert.ok(!html.includes('hub-ops-path.js'));
    assert.ok(!html.includes('market-pages.js'));
    assert.ok(!html.includes('data-market-page'));
    const js = read('js/hub-platforms-workspace.js');
    assert.ok(!js.includes('اشترِ الآن') && !js.includes('اشتر الآن'));
    assert.ok(js.includes('كيف تستخدم المنصات؟'));
    assert.ok(js.includes('طلب إضافة منصة'));
    assert.ok(js.includes('طلب وصول'));
    assert.ok(js.includes('فتح المنصة'));
    assert.ok(js.includes('منصات نايوش 360'));
    assert.ok(js.includes('اكتشف منصات نايوش 360'));
    assert.ok(!js.includes('operating.html?platform='));
    pass('1 page shell + journey copy + no buy CTA');
  } catch (e) {
    fail('1 page shell + journey copy + no buy CTA', e);
  }

  try {
    const js = read('js/hub-platforms-workspace.js');
    assert.ok(js.includes("id: 'ecommerce'"));
    assert.ok(js.includes('البيانات والتحليلات'));
    assert.ok(js.includes('platforms-browse'));
    assert.ok(js.includes('platforms-request'));
    assert.ok(js.includes('PLATFORM_ROUTES'));
    assert.ok(js.includes("NMS: 'ads.html'"));
    pass('2 categories + section order + routes');
  } catch (e) {
    fail('2 categories + section order + routes', e);
  }

  try {
    const sb = makeSb();
    boot(sb);
    const row = sb.window.HubCustomerRequests.create(
      {
        requestType: 'Platform Access Request',
        requestTypeLabel: 'طلب وصول لمنصة',
        referenceType: 'Platform',
        referenceId: 'NERP',
        sourceModule: 'منصات نايوش 360',
        sourceUrl: 'platforms.html',
        title: 'طلب وصول — نظام إدارة الموارد',
        description: 'أحتاج ERP للتقارير',
        need: 'أحتاج ERP للتقارير',
        status: 'Pending Review',
        email: 'client@test.com',
        customerName: 'عميل تجريبي',
        customer: { name: 'عميل تجريبي', email: 'client@test.com' },
      },
      'عميل تجريبي'
    );
    assert.ok(row.id);
    assert.ok(String(row.id).startsWith('PLT'));
    assert.strictEqual(row.requestType, 'Platform Access Request');
    assert.strictEqual(row.sourceModule, 'منصات نايوش 360');
    assert.strictEqual(row.referenceId, 'NERP');
    const pending = sb.window.HubCustomerRequests.list({ view: 'pending_review' });
    assert.ok(pending.some((r) => r.id === row.id));
    pass('3 access request → Posha pending inbox');
  } catch (e) {
    fail('3 access request → Posha pending inbox', e);
  }

  try {
    const sb = makeSb('client@test.com');
    boot(sb);
    const row = sb.window.HubCustomerRequests.create(
      {
        requestType: 'Platform Access Request',
        referenceType: 'Platform',
        referenceId: 'UOS',
        sourceModule: 'منصات نايوش 360',
        title: 'طلب وصول — UOS',
        need: 'تشغيل موحد',
        status: 'Pending Review',
        email: 'client@test.com',
        customerName: 'عميل تجريبي',
      },
      'عميل تجريبي'
    );
    const before = sb.window.HubCustomerRequests.readPlatformAccessStore();
    assert.ok(!(before.byEmail['client@test.com'] || { codes: [] }).codes.includes('UOS'));

    const approved = sb.window.HubCustomerRequests.approveRequest(row.id, 'Admin');
    assert.strictEqual(approved.status, 'Approved');
    const store = sb.window.HubCustomerRequests.readPlatformAccessStore();
    assert.ok(store.byEmail['client@test.com'].codes.includes('UOS'));
    const accepted = sb.window.HubCustomerRequests.list({ view: 'approved' });
    assert.ok(accepted.some((r) => r.id === row.id));
    pass('4 admin approve → grant access + approved inbox');
  } catch (e) {
    fail('4 admin approve → grant access + approved inbox', e);
  }

  try {
    const sb = makeSb();
    boot(sb);
    const row = sb.window.HubCustomerRequests.create(
      {
        requestType: 'Platform Add Request',
        requestTypeLabel: 'طلب إضافة منصة',
        referenceType: 'Platform',
        referenceId: 'منصة تجريبية',
        sourceModule: 'منصات نايوش 360',
        sourceUrl: 'platforms.html',
        title: 'طلب إضافة منصة — منصة تجريبية',
        description: 'ملخص\nسبب\nURL: https://example.com',
        need: 'سبب',
        status: 'Pending Review',
        email: 'client@test.com',
        customerName: 'عميل تجريبي',
        platformDraft: {
          name: 'منصة تجريبية',
          url: 'https://example.com',
          category: 'operations',
          summary: 'ملخص',
          reason: 'سبب',
        },
      },
      'عميل تجريبي'
    );
    assert.strictEqual(row.requestType, 'Platform Add Request');
    assert.ok(row.platformDraft && row.platformDraft.url === 'https://example.com');
    assert.ok(sb.window.HubCustomerRequests.list({ view: 'pending_review' }).some((r) => r.id === row.id));
    const approved = sb.window.HubCustomerRequests.approveRequest(row.id, 'Admin');
    assert.strictEqual(approved.status, 'Approved');
    pass('5 add-platform request → admin approve');
  } catch (e) {
    fail('5 add-platform request → admin approve', e);
  }

  try {
    const posha = read('js/hub-posha-clients.js');
    assert.ok(posha.includes('Platform Access Request') || posha.includes("=== 'platform'"));
    assert.ok(posha.includes('منح الوصول') || posha.includes('platform'));
    const cr = read('js/hub-customer-requests.js');
    assert.ok(cr.includes('grantPlatformAccess'));
    assert.ok(cr.includes('Platform Access Request'));
    assert.ok(cr.includes('Platform Add Request'));
    pass('6 Posha + CR wiring present');
  } catch (e) {
    fail('6 Posha + CR wiring present', e);
  }

  try {
    const css = read('css/hub-platforms-workspace.css');
    assert.ok(css.includes('grid-template-columns: repeat(4'));
    assert.ok(css.includes('@media (max-width: 640px)'));
    assert.ok(css.includes('overflow-x: auto'));
    pass('7 responsive CSS grid + tabs scroll');
  } catch (e) {
    fail('7 responsive CSS grid + tabs scroll', e);
  }

  const failed = results.filter((r) => !r.ok);
  results.forEach((r) => console.log((r.ok ? 'PASS' : 'FAIL') + '  ' + r.name + (r.err ? ' — ' + r.err : '')));
  if (failed.length) {
    console.error('\n' + failed.length + ' failed');
    process.exit(1);
  }
  console.log('\nAll ' + results.length + ' checks passed');
}

run();
