/**
 * اختبارات محرك بحث جوجل (ويب) + عدم كسر محرك نايوش
 * Run: node scripts/test-google-search.js
 */
const assert = (c, m) => {
  if (!c) throw new Error(m);
};
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const index = read('index.html');
assert(index.includes('hub-hero-search-engines.js'), 'index missing hero search engines');
assert(index.includes('hub-google-search-config.js'), 'index missing google config');
assert(index.includes('hub-google-search.css'), 'index missing google css');

const hero = read('js/hub-hero-search-engines.js');
assert(hero.includes('https://www.google.com/search?q='), 'hero must open Google.com');
assert(hero.includes('encodeURIComponent'), 'hero must encode query');
assert(hero.includes("'_blank'"), 'hero must open new tab');
assert(hero.includes('noopener,noreferrer'), 'hero must use noopener');
assert(hero.includes('اكتب ما تريد البحث عنه أولًا'), 'empty query Arabic message');
assert(hero.includes('ابحث في جوجل...'), 'Arabic placeholder');
assert(hero.includes('search.html'), 'Naiosh card still points to search.html');
assert(!hero.includes('location.href = url'), 'must not navigate same tab to internal google page');

const local = {};
const storage = {
  getItem: (k) => (k in local ? local[k] : null),
  setItem: (k, v) => {
    local[k] = String(v);
  },
  removeItem: (k) => delete local[k],
};

const opened = [];
const sb = {
  window: {},
  document: {
    readyState: 'complete',
    body: { classList: { contains: () => false } },
    querySelector: () => null,
    addEventListener: () => {},
  },
  localStorage: storage,
  console,
  Date,
  Math,
  JSON,
  Object,
  Array,
  String,
  Number,
  Boolean,
  CustomEvent: function () {},
  encodeURIComponent,
};
sb.window = sb;
sb.globalThis = sb;
sb.URLSearchParams = URLSearchParams;
sb.window.open = (url, target, features) => {
  opened.push({ url, target, features });
  return { closed: false };
};
sb.window.addEventListener = () => {};

vm.runInNewContext(read('js/hub-site-settings.js'), sb);
vm.runInNewContext(read('js/hub-google-search-config.js'), sb);
vm.runInNewContext(read('js/hub-hero-search-engines.js'), sb);

const cfg = sb.window.HubGoogleSearchConfig;
assert(cfg.isEnabled(), 'google enabled by default');
assert(cfg.webSearchUrl('نايوش هوب') === 'https://www.google.com/search?q=' + encodeURIComponent('نايوش هوب'), 'web url encodes Arabic');
assert(cfg.resultsUrl('ERP Systems').startsWith('https://www.google.com/search?q='), 'default results go to Google.com');

const api = sb.window.HubHeroSearchEngines;
assert(api.openGoogleSearch('نايوش هوب') === true, 'open with query');
assert(opened.length === 1, 'opened once');
assert(opened[0].url.includes(encodeURIComponent('نايوش هوب')), 'opened correct q');
assert(opened[0].target === '_blank', 'new tab');
assert(api.openGoogleSearch('   ') === false, 'empty blocked');
assert(opened.length === 1, 'empty did not open');

sb.window.HubSiteSettings.updateSection('searchEngines', {
  google: { enabled: false, cx: 'test-cx-123' },
});
assert(!cfg.isEnabled(), 'disable hides google');

const ui = read('js/hub-universal-search-ui.js');
assert(ui.includes('محرك بحث نايوش'), 'naiosh search card label preserved');
assert(ui.includes('search.html'), 'naiosh still uses search.html');

console.log('✓ Google web search + Naiosh separation OK');
console.log('\nAll google-search tests passed.');
