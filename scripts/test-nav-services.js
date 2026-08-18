/**
 * Main nav must include خدمات immediately after الرئيسية (before المنتجات).
 */
const fs = require('fs');
const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');

function navHtml(file) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const nav = html.match(/<nav class="nav-links"[\s\S]*?<\/nav>/);
  assert(nav, `${file}: nav-links missing`);
  return { html, nav: nav[0] };
}

function assertServicesAfterHome(file) {
  const { nav } = navHtml(file);
  const home = nav.search(/href="index\.html"[^>]*>\s*الرئيسية\s*</);
  const services = nav.search(/href="services\.html"[^>]*>\s*خدمات\s*</);
  const products = nav.search(/href="products\.html"/);
  assert(home >= 0, `${file}: الرئيسية missing`);
  assert(services > home, `${file}: خدمات must follow الرئيسية`);
  if (products >= 0) {
    assert(services < products, `${file}: خدمات must come before المنتجات`);
  }
}

[
  'index.html',
  'services.html',
  'products.html',
  'store.html',
  'ads.html',
  'events.html',
  'apps.html',
  'branches.html',
  'incubators.html',
  'platforms.html',
].forEach(assertServicesAfterHome);

const footer = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(
  /<a href="index.html">الرئيسية<\/a>\s*<a href="services.html">خدمات<\/a>/.test(footer),
  'index footer must list خدمات after الرئيسية'
);

const services = fs.readFileSync(path.join(root, 'services.html'), 'utf8');
[
  'branches.html',
  'incubators.html',
  'consultation.html',
  'packages.html',
  'publish-research.html',
  'suggestions.html',
  'complaints.html',
  'support.html',
].forEach((href) => {
  assert(services.includes(`href="${href}"`), `services.html missing ${href}`);
});

console.log('PASS خدمات appears after الرئيسية in main nav');
