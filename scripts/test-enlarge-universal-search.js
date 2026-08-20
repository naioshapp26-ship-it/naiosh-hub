/**
 * Universal search modal must be large enough to use page space and readable fonts.
 */
const fs = require('fs');
const assert = require('assert');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '../css/hub-universal-search.css'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

assert(/width:\s*min\(1180px,\s*96vw\)/.test(css), 'modal width should be ~1180px');
assert(/height:\s*min\(94vh,\s*1080px\)/.test(css), 'modal height should use ~94vh');
assert(/\.hus-head h2[\s\S]*?font-size:\s*1\.55rem/.test(css), 'title font should be enlarged');
assert(/\.hus-input-wrap input[\s\S]*?font-size:\s*17px/.test(css), 'search input font should be enlarged');
assert(/\.hus-item-body strong[\s\S]*?font-size:\s*17px/.test(css), 'result titles should be enlarged');
assert(/\.hus-starter[\s\S]*?font-size:\s*14px/.test(css), 'starter chips should be readable');
assert(/hub-universal-search\.css\?v=\d+/.test(index), 'index must cache-bust search CSS');
assert(
  Number((index.match(/hub-universal-search\.css\?v=(\d+)/) || [])[1] || 0) >= 7,
  'search CSS cache bust should be v=7+'
);

console.log('PASS universal search modal is enlarged and readable');
