/**
 * E2E: Notifications center + Search admin shared index
 * Run: node scripts/test-notifications-search-admin.js
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

const context = {
  console,
  localStorage,
  window: {},
  document: { documentElement: { dir: 'rtl' }, readyState: 'complete', addEventListener() {}, createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; }, head: { appendChild() {} }, querySelector() { return null; }, body: { appendChild() {} } },
  Date,
  Math,
  JSON,
  Array,
  Object,
  String,
  Number,
  Set,
  Map,
  Error,
  CustomEvent: function CustomEvent(name, init) { this.type = name; this.detail = init?.detail; },
  fetch: async () => ({ ok: false }),
};
context.window = context;
context.window.localStorage = localStorage;
vm.createContext(context);

// Minimal stubs for store deps
vm.runInContext(`window.HubOperatingModel = { allServices: () => [], servicesFor: () => [] };`, context);
vm.runInContext(read('js/hub-store.js'), context);
vm.runInContext(read('js/hub-search-catalog.js'), context);
vm.runInContext(read('js/hub-universal-search.js'), context);
vm.runInContext(read('js/hub-notifications-center.js'), context);
vm.runInContext(read('js/hub-search-admin-ws.js'), context);
vm.runInContext(read('js/hub-customer-requests.js'), context);

const Store = context.window.HubStore;
const Cat = context.window.HubSearchCatalog;
const Search = context.window.HubUniversalSearch;
const CR = context.window.HubCustomerRequests;

// --- Notifications rich payload ---
const n = Store.pushNotification({
  title: 'طلب نشر مقال جديد',
  body: 'قام العميل أحمد بإرسال مقال للمراجعة.',
  reason: 'قام العميل أحمد بإرسال مقال للمراجعة.',
  source: 'المقالات',
  sourceName: 'المقالات',
  type: 'article',
  typeLabel: 'المقالات',
  requestId: 'ART-REQ-2026-00001',
  customerId: 'NAI-TEST',
  customerName: 'أحمد',
  needsAction: true,
  actionLabel: 'مراجعة الطلب',
  actionLink: 'dashboard.html#posha-clients',
  priority: 'medium',
});
assert.ok(n.code, 'notification code');
assert.ok(n.requestId === 'ART-REQ-2026-00001');
assert.ok(Store.unreadNotificationsCount() >= 1);

const html = context.window.HubNotificationsCenter.render();
assert.ok(html.includes('مركز إشعارات نايوش هوب'));
assert.ok(html.includes('طلب نشر مقال جديد'));
assert.ok(html.includes('المقالات'));

Store.markNotificationRead(n.id);
assert.strictEqual(Store.listNotifications().find((x) => x.id === n.id).read, true);

// Customer request notification path (direct push API used by ingest)
CR.pushCustomerNotification({
  title: 'طلب نشر مقال جديد',
  message: 'قام العميل أحمد بإرسال مقال للمراجعة.',
  reason: 'تم إنشاء طلب جديد من المقالات ويحتاج مراجعة.',
  source: 'المقالات',
  requestId: 'ART-REQ-2026-00021',
  customerId: 'NAI-TEST',
  customerName: 'أحمد',
  actionLabel: 'مراجعة الطلب',
  link: 'dashboard.html#posha-clients',
});
assert.ok(Store.listNotifications().some((x) => x.requestId === 'ART-REQ-2026-00021'), 'request notification linked');

// --- Shared search index ---
const added = Cat.upsertFromSource({
  id: 'article-test-e2e',
  sourceType: 'article',
  sourceId: 'test-e2e',
  sourceLabel: 'المقالات',
  section: 'content',
  title: 'دليل اختبار محرك بحث نايوش الفريد',
  description: 'محتوى تجريبي للفهرسة المشتركة',
  keywords: 'اختبار فهرسة نايوش',
  href: 'blog.html#test-e2e',
  status: 'published',
  searchVisible: true,
});
assert.ok(added.ok);

const hits = Search.searchOrchestrated('دليل اختبار محرك بحث نايوش الفريد');
assert.ok(hits.results.some((r) => r.id === 'article-test-e2e' || r.title.includes('دليل اختبار')), 'public search finds admin-indexed item');

Cat.setSearchVisible('article-test-e2e', false, 'tester');
const hidden = Search.searchOrchestrated('دليل اختبار محرك بحث نايوش الفريد');
assert.ok(!hidden.results.some((r) => r.id === 'article-test-e2e'), 'hidden item not in public search');

Cat.setSearchVisible('article-test-e2e', true, 'tester');
Cat.reindex('article-test-e2e', 'tester');
const again = Search.searchOrchestrated('دليل اختبار محرك بحث نايوش الفريد');
assert.ok(again.results.some((r) => r.id === 'article-test-e2e'), 'visible again after reindex');

const saHtml = context.window.HubSearchAdminWS.render();
assert.ok(saHtml.includes('إدارة محرك بحث نايوش'));
assert.ok(saHtml.includes('المحتوى المفهرس'));

// Empty query analytics
Search.searchOrchestrated('خدمة الشحن الدولي غير الموجودة xyz123');
const empty = Cat.readEmptyQueries();
assert.ok(empty.some((e) => /الشحن الدولي/.test(e.query)), 'empty query recorded');

console.log('PASS notifications center + shared search admin index E2E');
