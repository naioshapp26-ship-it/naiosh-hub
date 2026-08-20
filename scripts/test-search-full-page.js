/**
 * Comprehensive search opens as a full page (search.html), not a modal.
 */
const fs = require('fs');
const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

assert(fs.existsSync(path.join(root, 'search.html')), 'search.html missing');

const searchPage = read('search.html');
assert(searchPage.includes('data-hus-page'), 'search page shell missing');
assert(searchPage.includes('hub-universal-search-ui.js?v=9'), 'search page must load UI v=9');

const index = read('index.html');
assert(/href="search\.html"/.test(index.match(/id="hero-float-card"[\s\S]*?<\/a>/)?.[0] || ''), 'hero must link to search.html');
assert(!/<button[^>]*id="hero-float-card"/.test(index), 'hero must not be a modal button');
assert(index.includes('hub-universal-search-ui.js?v=9'), 'index UI cache-bust v=9');
assert(index.includes('hub-universal-search.css?v=9'), 'index CSS cache-bust v=9');

const ui = read('js/hub-universal-search-ui.js');
assert(ui.includes("SEARCH_PAGE = 'search.html'"), 'UI must target search.html');
assert(ui.includes('isSearchPage'), 'UI must support page mode');
assert(!ui.includes("setOpen(true)"), 'UI must not open modal on homepage');
assert(ui.includes('location.replace(searchUrl'), 'legacy #open-search must redirect to page');

const css = read('css/hub-universal-search.css');
assert(css.includes('.hus-page'), 'page-mode CSS missing');
assert(/\.hus-page\s+\.hus-results[\s\S]*?overflow:\s*visible/.test(css), 'page results must not clip');

assert(read('search-admin.html').includes('href="search.html"'), 'admin link must open search page');
assert(read('search-content.html').includes('href="search.html"'), 'content link must open search page');

console.log('PASS search opens as a full page');
