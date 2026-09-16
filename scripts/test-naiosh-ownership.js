/**
 * اختبارات صفحة ملكية نايوش + زر Navbar بدون Dropdown
 * Run: node scripts/test-naiosh-ownership.js
 */
const assert = (c, m) => {
  if (!c) throw new Error(m);
};
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

assert(fs.existsSync(path.join(root, 'naiosh-ownership.html')), 'page missing');
const page = read('naiosh-ownership.html');
assert(page.includes('ملكية نايوش'), 'page title');
assert(page.includes('data-own-jump'), 'internal nav');
assert(page.includes('data-own-q'), 'search');
assert(page.includes('hub-ownership-data.js'), 'data script');

const header = read('js/hub-header-actions.js');
assert(header.includes("label: 'ملكية نايوش'"), 'navbar button');
assert(header.includes('naiosh-ownership.html'), 'navbar href');
assert(header.includes('removeLegacyOwnershipDropdown'), 'removes legacy dropdown');
assert(!/nav-dropdown-menu[\s\S]{0,80}ملكية/.test(header), 'must not build ownership dropdown menu');

const required = [
  'ملكية المكتب الرئيسي',
  'ملكية الفرع',
  'ملكية الحاضنة',
  'ملكية المنصة',
  'ملكية المكتب',
  'ملكية الفرانشايز',
  'الملكية الفكرية',
  'توثيق العقود',
  'توثيق ختم',
  'توثيق براءات الاختراع',
  'توثيق الابتكار',
  'توثيق النماذج الصناعية',
  'توثيق علامة تجارية',
  'توثيق نموذج تجاري',
  'توثيق نموذج صناعي',
  'توثيق تسوية النزاعات',
  'أخرى',
  'إضافة ملكية جديدة',
];

const dataSrc = read('js/hub-ownership-data.js');
required.forEach((t) => assert(dataSrc.includes(t), `missing seed item: ${t}`));

const local = {};
const storage = {
  getItem: (k) => (k in local ? local[k] : null),
  setItem: (k, v) => {
    local[k] = String(v);
  },
  removeItem: (k) => delete local[k],
};
const sb = { window: {}, localStorage: storage, console, Date, Math, JSON, Object, Array, String, Number, Boolean, Set };
sb.window = sb;
sb.CustomEvent = function () {};
vm.runInNewContext(dataSrc, sb);
const Own = sb.window.HubOwnership;
Own.ensure();
const titles = Own.list().map((i) => i.title);
const publicRequired = required.filter((t) => t !== 'توثيق تسوية النزاعات');
publicRequired.forEach((t) => assert(titles.includes(t), `list missing ${t}`));

// admin-only dispute doc hidden for anonymous
assert(!Own.list().some((i) => i.id === 'doc-disputes'), 'dispute should be admin-only for anon');

// staff sees it + can add
sb.window.HubAuth = { isStaff: () => true, getUser: () => ({ email: 'a@b.com' }) };
assert(Own.list().some((i) => i.id === 'doc-disputes'), 'staff sees dispute doc');
assert(Own.list().some((i) => i.title === 'إضافة ملكية جديدة'), 'staff sees add action');

const allTitles = Own.SEED.map((i) => i.title);
required.forEach((t) => assert(allTitles.includes(t), `seed missing ${t}`));

const st = Own.stats();
assert(st.total > 0 && st.documents > 0, 'stats from real data');

console.log('✓ ownership page + navbar + seed + permissions');
console.log('\nAll naiosh-ownership tests passed.');
