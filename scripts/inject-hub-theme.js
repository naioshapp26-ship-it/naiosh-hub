#!/usr/bin/env node
/**
 * Inject hub theme (CSS + JS + FOUC-prevention) into every HTML page.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EARLY = `  <script>
    /* Hub theme FOUC guard — keep before paint */
    (function () {
      try {
        var t = localStorage.getItem('hubTheme') || localStorage.getItem('theme');
        if (t === 'dark') {
          document.documentElement.setAttribute('data-theme', 'dark');
          document.documentElement.style.colorScheme = 'dark';
          document.addEventListener('DOMContentLoaded', function () {
            document.body.classList.add('dark-mode');
          });
        } else {
          document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'light');
        }
      } catch (e) {}
    })();
  </script>
`;

const CSS_BLOCK = `  <link rel="stylesheet" href="css/dark-mode.css?v=theme1" />
  <link rel="stylesheet" href="css/hub-theme-modes.css?v=theme1" />
`;

const JS_TAG = `  <script src="js/hub-theme.js?v=theme1" defer></script>
`;

function listHtml(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => path.join(dir, f));
}

function inject(file) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  let changed = false;

  if (!html.includes('Hub theme FOUC guard')) {
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (m) => m + '\n' + EARLY);
      changed = true;
    }
  }

  if (!html.includes('hub-theme-modes.css') && !html.includes('dark-mode.css?v=theme1')) {
    if (/<\/head>/i.test(html)) {
      html = html.replace(/<\/head>/i, CSS_BLOCK + '</head>');
      changed = true;
    }
  }

  if (!html.includes('hub-theme.js')) {
    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, JS_TAG + '</body>');
      changed = true;
    } else if (/<\/html>/i.test(html)) {
      html = html.replace(/<\/html>/i, JS_TAG + '</html>');
      changed = true;
    }
  }

  if (changed && html !== before) {
    fs.writeFileSync(file, html);
    return true;
  }
  return false;
}

const files = listHtml(ROOT);
let n = 0;
for (const f of files) {
  if (inject(f)) {
    n += 1;
    console.log('updated', path.basename(f));
  } else {
    console.log('skip', path.basename(f));
  }
}
console.log('done', n + '/' + files.length);
