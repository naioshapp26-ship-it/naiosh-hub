/**
 * Every Hub page must expose a small landing-page logo and a Control Panel button.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.join(__dirname, '..');
const walk = (dir) => {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
};

const pages = walk(root);
assert(pages.length >= 70, `expected many html pages, got ${pages.length}`);

pages.forEach((file) => {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file);
  assert(
    html.includes('hub-control-nav.js'),
    `${rel} must load hub-control-nav.js`
  );
  if (rel === 'roles-permissions.html') {
    assert(html.includes('لوحة التحكم'), 'roles page must show لوحة التحكم in markup');
    assert(html.includes('href="dashboard.html"'), 'roles page must link dashboard');
    assert(html.includes('href="index.html"'), 'roles page logo must link landing');
    assert(html.includes('assets/logo-hub.jpeg'), 'roles page must include small logo');
  }
});

const js = fs.readFileSync(path.join(root, 'js/hub-control-nav.js'), 'utf8');
assert(js.includes('لوحة التحكم'), 'injector labels the dashboard button');
assert(js.includes('index.html'), 'injector links landing page');
assert(js.includes('dashboard.html'), 'injector links control panel');
assert(js.includes('logo-hub.jpeg'), 'injector uses Hub logo');
assert(js.includes('data-hub-control-nav'), 'injector marks the cluster');
assert(js.includes("fileName() === 'dashboard.html'"), 'dashboard page skips the control-panel button');

const back = fs.readFileSync(path.join(root, 'js/hub-global-back.js'), 'utf8');
assert(back.includes('hub-control-nav.js'), 'global-back still loads control nav as a safety net');

const css = fs.readFileSync(path.join(root, 'css/hub-chrome.css'), 'utf8');
assert(css.includes('.hub-control-nav'), 'chrome stylesheet includes control nav');

const created = [];
const documentMock = {
  readyState: 'complete',
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: (tag) => {
    const el = {
      tagName: String(tag).toUpperCase(),
      className: '',
      dataset: {},
      style: {},
      innerHTML: '',
      children: [],
      appendChild(child) {
        this.children.push(child);
        created.push(child);
        return child;
      },
      setAttribute() {},
    };
    return el;
  },
  head: { appendChild() {} },
  body: { appendChild(child) { created.push(child); return child; } },
  addEventListener() {},
};
const sandbox = {
  window: { location: { pathname: '/roles-permissions.html' } },
  document: documentMock,
};
documentMock.body.appendChild = (child) => {
  created.push(child);
  return child;
};
vm.createContext(sandbox);
vm.runInContext(js, sandbox);
assert(sandbox.window.HubControlNav, 'exposes HubControlNav');
assert(
  created.some((el) => String(el.className || '').includes('hub-control-nav')),
  'mounts control nav cluster'
);
assert(
  created.some((el) => String(el.innerHTML || el.href || '').includes('لوحة التحكم') || (el.children || []).some((c) => String(c.innerHTML || '').includes('لوحة التحكم'))),
  'cluster contains لوحة التحكم'
);

console.log(`PASS control nav on ${pages.length} pages`);
