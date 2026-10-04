/**
 * Comprehensive search opens as a full page (search.html), not a modal.
 * Quick lists belong after results, not between the search box and hits.
 */
const fs = require('fs');
const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

assert(fs.existsSync(path.join(root, 'search.html')), 'search.html missing');

const searchPage = read('search.html');
assert(searchPage.includes('data-hus-page'), 'search page shell missing');
assert(searchPage.includes('hub-universal-search-ui.js'), 'search page must load UI');

const index = read('index.html');
assert(/href="search\.html"/.test(index.match(/id="hero-float-card"[\s\S]*?<\/a>/)?.[0] || ''), 'hero must link to search.html');
assert(!/<button[^>]*id="hero-float-card"/.test(index), 'hero must not be a modal button');
assert(index.includes('hub-universal-search-ui.js'), 'index UI cache-bust');
assert(index.includes('hub-universal-search.css'), 'index CSS cache-bust');

const ui = read('js/hub-universal-search-ui.js');
assert(ui.includes("SEARCH_PAGE = 'search.html'"), 'UI must target search.html');
assert(ui.includes('isSearchPage'), 'UI must support page mode');
assert(!ui.includes("setOpen(true)"), 'UI must not open modal on homepage');
assert(ui.includes('location.replace(searchUrl'), 'legacy #open-search must redirect to page');

const inputIdx = ui.indexOf('data-hus-input');
const resultsIdx = ui.indexOf('data-hus-results');
const suggestIdx = ui.indexOf('data-hus-suggest');
const filtersIdx = ui.indexOf('data-hus-filter');
assert(inputIdx > -1 && resultsIdx > inputIdx, 'results must come after the search input');
assert(suggestIdx > resultsIdx, 'quick lists must come after results');
assert(ui.includes('<section class="hus-suggest" data-hus-suggest'), 'quick lists section present once as a section');
assert((ui.split('<section class="hus-suggest"').length - 1) === 1, 'quick lists must exist once in the shell');
assert(ui.includes('تصفية نتائج البحث'), 'filters must be labeled as result filters');
assert(ui.includes('data-hus-results-cluster'), 'results cluster must wrap hits');
assert(!/hus-toolbar[\s\S]*data-hus-suggest[\s\S]*hus-results-cluster/.test(ui), 'quick lists must not sit inside the toolbar');
assert(filtersIdx > inputIdx && filtersIdx < suggestIdx, 'filters belong with results, before quick lists');

const css = read('css/hub-universal-search.css');
assert(css.includes('.hus-page'), 'page-mode CSS missing');
assert(/\.hus-page\s+\.hus-results[\s\S]*?overflow:\s*visible/.test(css), 'page results must not clip');

assert(read('search-admin.html').includes('href="search.html"'), 'admin link must open search page');
assert(read('search-content.html').includes('href="search.html"'), 'content link must open search page');

console.log('PASS search opens as a full page with quick lists last');
