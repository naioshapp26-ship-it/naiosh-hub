/**
 * Search results pane must keep a large share of the modal height
 * so more than one result row is visible (toolbar must not crush it).
 */
const fs = require('fs');
const assert = require('assert');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '../css/hub-universal-search.css'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

assert(/\.hus-toolbar[\s\S]*?max-height:\s*min\(34vh,\s*340px\)/.test(css), 'toolbar must be height-capped');
assert(/\.hus-toolbar[\s\S]*?overflow-y:\s*auto/.test(css), 'toolbar must scroll when tall');
assert(/\.hus-results[\s\S]*?min-height:\s*min\(52vh,\s*560px\)/.test(css), 'results need large min-height');
assert(/\.hus-starters[\s\S]*?max-height:\s*72px/.test(css), 'starters should stay compact');
assert(index.includes('hub-universal-search.css?v=8'), 'index must cache-bust search CSS v=8');

console.log('PASS search results area keeps visible height');
