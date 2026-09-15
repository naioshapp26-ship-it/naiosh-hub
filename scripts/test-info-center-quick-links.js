#!/usr/bin/env node
/**
 * Info-center landing must expose clear start cards after the hero.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'hub-checklist.html'), 'utf8');

assert(html.includes('مرحبًا بك في مركز معلومات نايوش هوب'), 'welcome title');
assert(html.includes('ماذا تريد أن تعرف؟'), 'start section');
assert(html.includes('policies.html'), 'policies card link');
assert(html.includes('engine-specs.html'), 'specs card link');
assert(html.includes('#about-hub'), 'about hub anchor');
assert(html.includes('#guides'), 'guides anchor');
assert(html.includes('data-info-subnav'), 'internal subnav mount');
assert(html.includes('hub-info-center-chrome.js'), 'chrome script');

const redirect = fs.readFileSync(path.join(root, 'info-center.html'), 'utf8');
assert(redirect.includes('hub-checklist.html'), 'legacy info-center redirects home');

console.log('PASS info-center landing start cards');
