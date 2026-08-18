/**
 * Homepage header must not repeat sidebar items:
 * المشاريع الجانبية · سجل معنا · منصتي
 */
const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('/workspace/index.html', 'utf8');
const nav = html.match(/<nav class="nav-links"[\s\S]*?<\/nav>/);
assert(nav, 'homepage nav-links missing');
const header = html.match(/<header class="top-nav"[\s\S]*?<\/header>/);
assert(header, 'homepage header missing');

assert(!nav[0].includes('المشاريع الجانبية'), 'header nav still has المشاريع الجانبية');
assert(!nav[0].includes('سجل معنا'), 'header nav still has سجل معنا');
assert(!nav[0].includes('منصتي'), 'header nav still has منصتي');
assert(!nav[0].includes('side-projects.html'), 'header nav still links side-projects');
assert(!nav[0].includes('my-platform.html'), 'header nav still links منصتي');
assert(!header[0].includes('سجل معنا'), 'header still has سجل معنا');

const sidebar = fs.readFileSync('/workspace/js/hero-sidebar-nav.js', 'utf8');
assert(sidebar.includes("ensure('منصتي', 'my-platform.html'"), 'sidebar منصتي missing');
assert(sidebar.includes("label: 'سجل معنا'"), 'sidebar سجل معنا missing');
assert(sidebar.includes("ensure('قناتي', 'side-projects.html"), 'sidebar قناتي/المشاريع missing');

const actions = fs.readFileSync('/workspace/js/hub-header-actions.js', 'utf8');
assert(actions.includes("label === 'منصتي'"), 'header cleanup missing منصتي');
assert(actions.includes('side-projects.html'), 'header cleanup missing side-projects');

console.log('PASS header no longer duplicates sidebar items');
