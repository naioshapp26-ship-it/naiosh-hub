/**
 * All Information Center pages must appear in the Search Center.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const infoHtml = read('info-center.html');
const pagesSrc = read('js/hub-info-center-pages.js');
const searchSrc = read('js/hub-universal-search.js');
const uiSrc = read('js/hub-universal-search-ui.js');
const checklistSrc = read('js/hub-checklist.js');
const searchPage = read('search.html');
const index = read('index.html');
const checklistHtml = read('hub-checklist.html');

const requiredHrefs = [
  'info-center.html',
  'engine-specs.html',
  'policies.html',
  'ops-manuals.html',
  'review-methodology.html',
  'hub-checklist.html',
  'directives.html',
  'job-roles.html',
  'operating.html',
];

requiredHrefs.forEach((href) => {
  if (href === 'info-center.html') return;
  assert(infoHtml.includes(`href="${href}"`), `info-center must link to ${href}`);
});

const windowObj = { HubInfoCenterPages: null, HubUniversalSearch: null, HubChecklist: null, HubSearchCatalog: null };
const sandbox = { window: windowObj, document: { readyState: 'complete', addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } } };
vm.createContext(sandbox);
vm.runInContext(pagesSrc, sandbox);
assert(windowObj.HubInfoCenterPages?.PAGES?.length >= 9, 'info center pages catalog missing');

const catalogHrefs = windowObj.HubInfoCenterPages.PAGES.map((p) => p.href);
requiredHrefs.forEach((href) => {
  assert(catalogHrefs.includes(href), `catalog missing ${href}`);
});

vm.runInContext(searchSrc, sandbox);
const items = windowObj.HubUniversalSearch.collectCatalog();
const knowledge = items.filter((i) => i.type === 'knowledge' && i.source === 'info-center');
assert.strictEqual(knowledge.length, requiredHrefs.length, 'search catalog must include every info-center page');
requiredHrefs.forEach((href) => {
  assert(
    knowledge.some((i) => i.href === href),
    `search results missing page ${href}`
  );
});

const byQuery = windowObj.HubUniversalSearch.search('مركز المعلومات', 'all');
requiredHrefs.forEach((href) => {
  assert(
    byQuery.some((i) => i.href === href),
    `searching مركز المعلومات must return ${href}`
  );
});

const filtered = windowObj.HubUniversalSearch.search('', 'knowledge');
assert.strictEqual(filtered.length, requiredHrefs.length, 'knowledge filter must list all info-center pages');

assert(uiSrc.includes('data-hus-filter="knowledge"'), 'search UI must have مركز المعلومات filter');
assert(uiSrc.includes('صفحات مركز المعلومات') || searchSrc.includes('صفحات مركز المعلومات'), 'suggested list for info pages');
assert(searchPage.includes('hub-info-center-pages.js'), 'search.html must load info-center pages');
assert(index.includes('hub-info-center-pages.js'), 'index.html must load info-center pages');
assert(checklistHtml.includes('hub-info-center-pages.js'), 'checklist page must load info-center pages');

vm.runInContext(checklistSrc, sandbox);
const checkItems = windowObj.HubChecklist.ITEMS;
requiredHrefs.forEach((href) => {
  assert(
    checkItems.some((i) => i.href === href),
    `checklist must include info-center page ${href}`
  );
});

console.log(`PASS ${knowledge.length} info-center pages appear in the search center`);
