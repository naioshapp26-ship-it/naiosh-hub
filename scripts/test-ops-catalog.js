/**
 * اختبارات A–F لكتالوج الأنظمة/الوحدات والصلاحيات
 * تشغيل: node scripts/test-ops-catalog.js
 */
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'js/hub-ops-catalog.js'), 'utf8');

const local = {};
const storage = {
  getItem: (k) => (k in local ? local[k] : null),
  setItem: (k, v) => {
    local[k] = String(v);
  },
  removeItem: (k) => {
    delete local[k];
  },
};

const sandbox = {
  window: {},
  localStorage: storage,
  console,
  Date,
  Math,
  JSON,
  Set,
  Map,
  Array,
  Object,
  String,
  Number,
  Boolean,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.runInNewContext(code, sandbox);
const Cat = sandbox.window.HubOpsCatalog;
assert(Cat, 'HubOpsCatalog missing');
Cat.resetToSeed();

// A: ERP كامل
const entA = Cat.resolveEntitlements({
  mode: 'by_need',
  items: [{ kind: 'system', systemId: 'ERP', full: true }],
});
assert(entA.grants.some((g) => g.systemCode === 'ERP' && g.kind === 'system'), 'A: ERP grant missing');
assert(entA.services[0]?.modules?.length >= 5, 'A: ERP modules missing');
assert(
  entA.services[0].modules.some((m) => m.id === 'ERP_INV'),
  'A: inventory module in full ERP'
);
console.log('✓ A ERP كامل');

// B: المخزون فقط
const entB = Cat.resolveEntitlements({
  mode: 'by_need',
  items: [{ kind: 'module', systemId: 'ERP', moduleId: 'ERP_INV', standalone: true, hideParent: false }],
});
assert(entB.grants.every((g) => g.systemCode !== 'ERP'), 'B: must NOT grant full ERP');
assert(entB.grants.some((g) => g.systemCode === 'ERP_INV'), 'B: inventory grant missing');
assert(entB.services.length === 1, 'B: one service only');
assert(!entB.services.some((s) => s.code === 'ERP' && s.kind === 'system'), 'B: no ERP system service');
console.log('✓ B المخزون فقط');

// C: إخفاء النظام الأب
const entC = Cat.resolveEntitlements({
  mode: 'by_need',
  items: [{ kind: 'module', systemId: 'ERP', moduleId: 'ERP_INV', standalone: true, hideParent: true }],
});
const faceC = Cat.customerFacingServices(entC);
assert(faceC[0].label === 'إدارة المخزون', 'C: customer label must be inventory only');
assert(faceC[0].hideParent === true, 'C: hideParent flag');
assert(!String(faceC[0].label).includes('ERP'), 'C: ERP name hidden from customer');
console.log('✓ C إخفاء الأب');

// D: إضافة نظام جديد
const addSys = Cat.addSystem({
  name: 'نظام اختبار الجودة',
  shortName: 'QATEST',
  description: 'نظام تجريبي للاختبار الآلي',
  icon: 'fa-flask',
  sortOrder: 999,
});
assert(addSys.ok, 'D: add system failed ' + addSys.error);
assert(
  Cat.systemOptions().some((s) => s.code === 'QATEST'),
  'D: new system not in picker options'
);
console.log('✓ D إضافة نظام');

// E: إضافة وحدة لنظام موجود
const addMod = Cat.addModule({
  systemId: 'ERP',
  name: 'وحدة اختبار الأصول',
  description: 'وحدة تجريبية تحت ERP',
  canStandalone: true,
  hideParentDefault: true,
});
assert(addMod.ok, 'E: add module failed ' + addMod.error);
assert(
  Cat.listModules('ERP').some((m) => m.name === 'وحدة اختبار الأصول'),
  'E: module not under ERP'
);
console.log('✓ E إضافة وحدة');

// F: تشغيل شمولي — تجميع أنظمة ووحدات مختلفة
const entF = Cat.resolveEntitlements({
  mode: 'hub_comprehensive',
  items: [
    { kind: 'module', systemId: 'ERP', moduleId: 'ERP_INV', hideParent: true, standalone: true },
    { kind: 'system', systemId: 'CRM', full: true },
    { kind: 'system', systemId: 'ACADEMY', full: true },
    { kind: 'system', systemId: 'LAW', full: true },
  ],
});
assert(entF.mode === 'hub_comprehensive', 'F: mode');
assert(entF.umbrella === 'NAIOSH HUB', 'F: umbrella');
const faceF = Cat.customerFacingServices(entF);
assert(faceF.some((s) => s.label === 'إدارة المخزون'), 'F: inventory as hub service');
assert(faceF.some((s) => s.code === 'CRM' || s.label.includes('عملاء')), 'F: CRM included');
assert(faceF.some((s) => s.code === 'ACADEMY' || s.label.includes('أكاديمية')), 'F: Academy included');
assert(faceF.some((s) => s.code === 'LAW' || s.label.includes('قانون')), 'F: LAW included');
assert(!entF.grants.some((g) => g.systemCode === 'ERP' && g.kind === 'system'), 'F: no full ERP grant');
console.log('✓ F تشغيل شمولي');

// HTML wiring
const book = fs.readFileSync(path.join(root, 'book-platform.html'), 'utf8');
assert(book.includes('hub-ops-catalog.js'), 'book-platform missing catalog');
assert(book.includes('hub-ops-picker.js'), 'book-platform missing picker');
assert(book.includes('ops-catalog-admin.html') || book.includes('data-ops-picker'), 'picker mount');
assert(fs.existsSync(path.join(root, 'ops-catalog-admin.html')), 'admin page missing');
console.log('✓ wiring');

console.log('\nAll ops-catalog tests A–F passed.');
