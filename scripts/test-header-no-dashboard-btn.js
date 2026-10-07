/**
 * Header must not expose a public «لوحة التحكم» CTA; dashboard page remains intact.
 * node scripts/test-header-no-dashboard-btn.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = (() => {
  try {
    return { JSDOM: require('jsdom').JSDOM };
  } catch {
    return { JSDOM: null };
  }
})();

const root = path.join(__dirname, '..');
const controlNav = fs.readFileSync(path.join(root, 'js/hub-control-nav.js'), 'utf8');

assert(!/className = 'hub-control-nav__dash'/.test(controlNav), 'control-nav must not create dashboard button');
assert(!/createElement\('a'\);\s*\n\s*dash\.className = 'hub-control-nav__dash'/.test(controlNav), 'no dash button element');
assert(!/<span>لوحة التحكم<\/span>/.test(controlNav), 'control-nav must not render لوحة التحكم label');
assert(/stripPublicHeaderDash/.test(controlNav), 'control-nav must strip public header dashboard CTAs');
assert(!/wrap\.appendChild\(dash\)/.test(controlNav), 'must not append dashboard CTA to header wrap');
assert(fs.existsSync(path.join(root, 'dashboard.html')), 'dashboard.html must remain');

const htmlFiles = [];
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full);
    else if (name.endsWith('.html')) htmlFiles.push(full);
  }
};
walk(root);

let scanned = 0;
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  scanned += 1;
  const authBlocks = html.match(/<div class="auth-actions"[\s\S]*?<\/div>/g) || [];
  for (const block of authBlocks) {
    assert(
      !/>\s*لوحة التحكم\s*</.test(block),
      `${path.relative(root, file)} auth-actions still has لوحة التحكم`
    );
  }
  if (html.includes('hub-control-nav.js')) {
    assert(
      html.includes('hub-control-nav.js?v=5') || html.includes('../js/hub-control-nav.js?v=5'),
      `${path.relative(root, file)} must bump hub-control-nav cache`
    );
  }
}

// Runtime strip on homepage markup
if (JSDOM) {
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  // inject a leftover button to prove strip works
  const poisoned = indexHtml.replace(
    '<div class="auth-actions" aria-label="إجراءات الحساب">',
    '<div class="auth-actions" aria-label="إجراءات الحساب"><a href="dashboard.html" class="auth-btn primary">لوحة التحكم</a>'
  );
  const dom = new JSDOM(poisoned, { runScripts: 'outside-only', url: 'http://127.0.0.1/index.html' });
  const { window } = dom;
  window.eval(controlNav);
  // force mount if needed
  window.HubControlNav?.stripPublicHeaderDash?.(window.document);
  const left = [...window.document.querySelectorAll('header.top-nav .auth-actions a')].map((a) =>
    (a.textContent || '').trim()
  );
  assert(!left.includes('لوحة التحكم'), `strip failed, left=${left.join('|')}`);
  assert(left.includes('تسجيل الدخول'), 'login button must remain');
}

console.log(`PASS header has no public dashboard CTA (${scanned} html files scanned)`);
