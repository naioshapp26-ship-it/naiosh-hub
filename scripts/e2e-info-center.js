/**
 * E2E: Information Center — landing, policies workflow, permissions
 * Run: node scripts/e2e-info-center.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function makeSb(staff) {
  const local = { _d: Object.create(null) };
  const sb = {
    console,
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
      addEventListener() {},
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
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
    isStaff: () => !!staff,
    isLoggedIn: () => true,
    getUser: () =>
      staff
        ? { email: 'admin@test.com', name: 'Admin', role: 'admin' }
        : { email: 'client@test.com', name: 'عميل', role: 'customer' },
  };
  vm.createContext(sb);
  return sb;
}

function boot(sb) {
  sb.globalThis = sb;
  vm.runInContext(read('js/hub-policies-store.js'), sb);
}

function run() {
  const results = [];
  const pass = (n) => results.push({ name: n, ok: true });
  const fail = (n, e) => results.push({ name: n, ok: false, err: String(e.message || e) });

  try {
    const header = read('js/hub-header-actions.js');
    assert.ok(header.includes('مركز معلومات نايوش هوب'));
    assert.ok(header.includes("href: 'hub-checklist.html'"));
    const home = read('hub-checklist.html');
    assert.ok(home.includes('مرحبًا بك في مركز معلومات نايوش هوب'));
    assert.ok(!home.includes('اشترِ الآن'));
    assert.ok(home.includes('policies.html'));
    pass('1 rename + landing');
  } catch (e) {
    fail('1 rename + landing', e);
  }

  try {
    const pol = read('policies.html');
    assert.ok(pol.includes('hub-policies-store.js'));
    assert.ok(pol.includes('hub-info-center-chrome.js'));
    const js = read('js/hub-policies.js');
    assert.ok(js.includes('إضافة سياسة جديدة'));
    assert.ok(js.includes('حفظ كمسودة'));
    assert.ok(!js.includes('اشترِ الآن'));
    pass('2 policies shell');
  } catch (e) {
    fail('2 policies shell', e);
  }

  try {
    const sb = makeSb(false);
    boot(sb);
    assert.strictEqual(sb.window.HubPoliciesStore.canManage(), false);
    const pub = sb.window.HubPoliciesStore.list({});
    assert.ok(pub.length >= 40);
    assert.ok(pub.every((p) => p.status === 'published'));
    const created = sb.window.HubPoliciesStore.create({
      title: 'سياسة اختبار',
      summary: 'ملخص',
      body: 'محتوى',
      cat: 'ops',
    });
    assert.strictEqual(created, null);
    pass('3 customer sees published only + cannot create');
  } catch (e) {
    fail('3 customer sees published only + cannot create', e);
  }

  try {
    const sb = makeSb(true);
    boot(sb);
    assert.ok(sb.window.HubPoliciesStore.canManage());
    const draft = sb.window.HubPoliciesStore.create({
      title: 'سياسة اختبار مركز المعلومات',
      summary: 'ملخص تجريبي',
      body: 'محتوى السياسة التجريبي',
      cat: 'ops',
      department: 'الجودة',
    });
    assert.ok(draft);
    assert.strictEqual(draft.status, 'draft');
    const asCustomer = sb.window.HubPoliciesStore.list({ manage: false });
    assert.ok(!asCustomer.some((p) => p.id === draft.id));
    const pending = sb.window.HubPoliciesStore.setStatus(draft.id, 'pending_review', 'إرسال');
    assert.strictEqual(pending.status, 'pending_review');
    const published = sb.window.HubPoliciesStore.setStatus(draft.id, 'published', 'نشر');
    assert.strictEqual(published.status, 'published');
    const visible = sb.window.HubPoliciesStore.list({ manage: false, q: 'سياسة اختبار مركز المعلومات' });
    assert.ok(visible.some((p) => p.id === draft.id));
    pass('4 staff draft → review → publish → visible to public');
  } catch (e) {
    fail('4 staff draft → review → publish → visible to public', e);
  }

  try {
    const specs = read('js/hub-engine-specs.js');
    assert.ok(specs.includes('titleAr'));
    assert.ok(specs.includes('ما وظيفته؟'));
    assert.ok(specs.includes('من يحتاجه؟'));
    const html = read('engine-specs.html');
    assert.ok(html.includes('المواصفات الوظيفية لنايوش هوب'));
    assert.ok(html.includes('hub-info-center-chrome.js'));
    pass('5 specs Arabic-first');
  } catch (e) {
    fail('5 specs Arabic-first', e);
  }

  try {
    const chrome = read('js/hub-info-center-chrome.js');
    assert.ok(chrome.includes('مركز معلومات نايوش هوب'));
    assert.ok(chrome.includes('السياسات'));
    pass('6 internal chrome nav');
  } catch (e) {
    fail('6 internal chrome nav', e);
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
