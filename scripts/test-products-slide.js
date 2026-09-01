/**
 * Slide 4 products page: extra shop categories next to نايوش,
 * live sites so cards render, hierarchy/sectors sidebar, instant-entry banner.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const extraCats = [
  'نظام الأرشفة',
  'استديو الحملات التسويقية',
  'استوديو الفعاليات',
  'مركز المعلمين',
  'الإنترنت والأتمتة',
  'إدارة المرافق',
  'سلاسل التوريد',
  'حاضنة السلامة',
  'إدارة العملاء CRM',
  'الموارد البشرية',
  'القوائم والتقارير المالية',
  'المشتريات والطلبات',
  'إدارة الموظفين',
  'المهام',
  'نظام الدفع',
  'المبيعات',
  'الدعم والتحصيل',
];

const sandbox = { HubLiveSystems: { isLive: () => false } };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(read('js/hub-marketplace-data.js'), sandbox);
vm.runInContext(read('js/hub-ready-sites.js'), sandbox);
vm.runInContext(read('js/hub-sector-library.js'), sandbox);

const data = sandbox.HubMarketplaceData;
const sites = sandbox.HubReadySites;
assert(data && sites, 'marketplace + ready sites must load');

const catIds = data.SHOP_CATEGORIES.map((c) => c.id);
const nayoshAt = catIds.indexOf('نايوش');
assert(nayoshAt >= 0, 'نايوش category must exist');
extraCats.forEach((name, i) => {
  assert(catIds.includes(name), `SHOP_CATEGORIES missing ${name}`);
  assert(catIds.indexOf(name) > nayoshAt, `${name} must sit after نايوش`);
  const expectedIndex = nayoshAt + 1 + i;
  assert.strictEqual(catIds[expectedIndex], name, `${name} must keep slide order after نايوش`);
});

extraCats.forEach((name) => {
  const product = data.PRODUCT_CATALOG.find((p) => p.category === name);
  assert(product, `PRODUCT_CATALOG missing item for ${name}`);
  const site = sites.siteForProduct(product);
  assert(site, `siteForProduct must resolve ${name}`);
  assert(sites.isLiveSite(site), `${name} site must be live so the card appears`);
  const store = data.STORE_ITEMS.find((s) => s.sku === product.sku);
  assert(store, `STORE_ITEMS must include buy SKU ${product.sku} for ${name}`);
});

['إي آر بي', 'نايس', 'فيت', 'أكاديمية', 'قانونية', 'سمارتكس', 'إيديو سمارتكس', 'نايوش'].forEach((name) => {
  const product = data.PRODUCT_CATALOG.find((p) => p.category === name);
  assert(product, `existing catalog ${name} still present`);
  assert(sites.siteForProduct(product), `existing ${name} still maps to a live site`);
});

const productsPage = read('products.html');
assert(productsPage.includes('إضافة تصنيف'), 'sidebar title إضافة تصنيف');
assert(productsPage.includes('الهيكل الهرمي'), 'hierarchy block');
assert(productsPage.includes('قطاعات نايوش'), 'sectors block');
assert(productsPage.includes('href="branches.html"'), 'branches link');
assert(productsPage.includes('href="incubators.html"'), 'incubators link');
assert(productsPage.includes('href="platforms.html"'), 'platforms link');
assert(productsPage.includes('href="office.html"'), 'electronic offices link');
assert(productsPage.includes('hub-marketplace-data.js?v=slide4'), 'products page cache-busts marketplace data');
assert(productsPage.includes('hub-ready-sites.js?v=slide4'), 'products page cache-busts ready sites');
assert(productsPage.includes('hub-sector-library.js'), 'products page loads sector library');
assert(productsPage.includes('id="shop-results"'), 'product results have a scroll target');
assert(productsPage.includes('id="shop-sectors-list"'), 'sectors list mount');
assert(productsPage.includes('id="shop-side-back"'), 'sidebar back button');
assert(productsPage.includes('market-pages.js?v=scroll1'), 'products page cache-busts market-pages scroll fix');

const ops = read('js/hub-ops-path.js');
assert(ops.includes('دخول فوري مجاني.. دون الحاجة إلى بطاقة ائتمانية'), 'instant-entry headline');
assert(ops.includes('اشتر الآن'), 'buy-now button');
assert(ops.includes('ادخل موقعك جاهزاً'), 'enter-ready-site button');
assert(ops.includes('طريقة التشغيل'), 'how-to-operate button');

const market = read('js/market-pages.js');
assert(market.includes('revealShopResults'), 'category clicks scroll down to the result heading');
assert(market.includes("setCategory(btn.dataset.cat, { scroll: true })"), 'icon strip scrolls after pick');
assert(market.includes('fillSectors'), 'sectors are rendered');
assert(market.includes('shop-side-back'), 'sidebar back is wired');
assert(market.includes('ادخل الموقع'), 'enter-site action remains');
assert(market.includes('اشتري'), 'buy action remains');

const sectors = sandbox.HubSectorLibrary.list().filter((s) => s.sectorId !== 'other');
assert(sectors.length > 8, 'Nayosh sectors list is populated');

const incubators = read('js/hub-incubators.js');
assert(incubators.includes("params.get('q')"), 'incubators honor ?q= from sector links');

console.log(`ok: ${extraCats.length} extra product categories live after نايوش, ${sectors.length} sectors`);
