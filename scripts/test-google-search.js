/**
 * اختبارات محرك بحث Google + عدم كسر محرك نايوش
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
assert(fs.existsSync(path.join(root, 'google-search.html')), 'google-search.html missing');
assert(read('google-search.html').includes('cse.google.com') || read('js/hub-google-search.js').includes('cse.google.com'), 'must use official CSE');
assert(read('js/hub-google-search.js').includes('cse.google.com/cse.js'), 'CSE script URL missing');
assert(!read('js/hub-google-search.js').includes('fakeResults'), 'no fake results');

const settings = read('js/hub-site-settings.js');
assert(settings.includes('searchEngines'), 'site settings missing searchEngines');
assert(read('js/hub-site-settings-ui.js').includes('إعدادات محركات البحث'), 'admin UI section missing');

const local = {};
const storage = {
  getItem: (k) => (k in local ? local[k] : null),
  setItem: (k, v) => {
    local[k] = String(v);
  },
  removeItem: (k) => delete local[k],
};

const sb = {
  window: {},
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
};
sb.window = sb;
sb.globalThis = sb;
sb.URLSearchParams = URLSearchParams;

vm.runInNewContext(read('js/hub-site-settings.js'), sb);
vm.runInNewContext(read('js/hub-google-search-config.js'), sb);

const cfg = sb.window.HubGoogleSearchConfig;
assert(cfg.isEnabled(), 'google enabled by default');
assert(cfg.resultsUrl('ERP Systems').includes('q=ERP'), 'results url encodes q');

sb.window.HubSiteSettings.updateSection('searchEngines', {
  google: { enabled: false, cx: 'test-cx-123' },
});
assert(!cfg.isEnabled(), 'disable hides google');
assert(cfg.getCx() === 'test-cx-123', 'cx from central settings');

sb.window.HubSiteSettings.updateSection('searchEngines', {
  google: { enabled: true, cx: 'test-cx-123', openLinksInNewTab: true },
});
assert(cfg.isEnabled(), 're-enable works');

const ui = read('js/hub-universal-search-ui.js');
assert(ui.includes('محرك بحث نايوش'), 'naiosh search card label preserved');
assert(ui.includes('search.html'), 'naiosh still uses search.html');

console.log('✓ Google search wiring + config + Naiosh intact');
console.log('\nAll google-search tests passed.');
