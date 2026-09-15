/**
 * All Information Center pages must appear in the Search Center.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const homeHtml = read('hub-checklist.html');
const redirectHtml = read('info-center.html');
const pagesSrc = read('js/hub-info-center-pages.js');
const searchSrc = read('js/hub-universal-search.js');
const uiSrc = read('js/hub-universal-search-ui.js');
const checklistSrc = read('js/hub-checklist.js');
const searchPage = read('search.html');
const index = read('index.html');
const header = read('js/hub-header-actions.js');

assert(redirectHtml.includes('hub-checklist.html'), 'info-center must redirect to hub-checklist');
assert(header.includes('مركز معلومات نايوش هوب'), 'header button renamed');
assert(header.includes("href: 'hub-checklist.html'"), 'header points to landing');
assert(homeHtml.includes('مرحبًا بك في مركز معلومات نايوش هوب'), 'landing welcome title');
assert(homeHtml.includes('ماذا تريد أن تعرف؟'), 'landing start cards');
assert(homeHtml.includes('hub-info-center-chrome.js'), 'landing loads chrome');

const windowObj = { HubInfoCenterPages: null, HubUniversalSearch: null, HubChecklist: null, HubSearchCatalog: null };
const sandbox = {
  window: windowObj,
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
};
vm.createContext(sandbox);
vm.runInContext(pagesSrc, sandbox);
assert(windowObj.HubInfoCenterPages?.PAGES?.length >= 9, 'info center pages catalog missing');

const catalogHrefs = windowObj.HubInfoCenterPages.PAGES.map((p) => p.href);
[
  'hub-checklist.html',
  'engine-specs.html',
  'policies.html',
  'ops-manuals.html',
  'review-methodology.html',
  'directives.html',
  'job-roles.html',
  'operating.html',
].forEach((href) => {
  assert(
    catalogHrefs.some((h) => h === href || h.startsWith(href)),
    `catalog missing ${href}`
  );
});

vm.runInContext(searchSrc, sandbox);
const items = windowObj.HubUniversalSearch.collectCatalog();
const knowledge = items.filter((i) => i.type === 'knowledge' && i.source === 'info-center');
assert.ok(knowledge.length >= 9, 'search catalog must include info-center pages');
assert(
  knowledge.some((i) => String(i.href).includes('hub-checklist.html')),
  'search must include info center home'
);
assert(knowledge.some((i) => i.href === 'policies.html'), 'search missing policies');
assert(knowledge.some((i) => i.href === 'engine-specs.html'), 'search missing specs');

const byQuery = windowObj.HubUniversalSearch.search('مركز المعلومات', 'all');
assert(byQuery.some((i) => String(i.href).includes('hub-checklist.html')), 'query must find home');

assert(uiSrc.includes('data-hus-filter="knowledge"'), 'search UI must have مركز المعلومات filter');
assert(searchPage.includes('hub-info-center-pages.js'), 'search.html must load info-center pages');
assert(index.includes('hub-info-center-pages.js'), 'index.html must load info-center pages');
assert(homeHtml.includes('hub-info-center-pages.js'), 'landing must load info-center pages');

vm.runInContext(checklistSrc, sandbox);
const checkItems = windowObj.HubChecklist.ITEMS;
assert(checkItems.some((i) => String(i.href || '').includes('policies.html')), 'checklist includes policies');
assert(checkItems.some((i) => String(i.href || '').includes('hub-checklist.html')), 'checklist includes home');

console.log(`PASS ${knowledge.length} info-center pages appear in the search center`);
