/**
 * Dashboard sidebar ends with إعدادات داخلية, and HubStore persists system settings.
 * Settings UI is rendered by hub-settings-center.js (Admin Control Center).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const dashJs = read('js/dashboard.js');
const centerJs = read('js/hub-settings-center.js');
const storeJs = read('js/hub-store.js');
const css = read('css/dashboard.css');
const html = read('dashboard.html');
const uploadJs = read('js/hub-upload-limits.js');
const searchJs = read('js/hub-universal-search.js');
const marketJs = read('js/market-pages.js');

assert(!/ساي فاي|Sci-?Fi/i.test(dashJs + storeJs + html + centerJs), 'settings work must not add Sci-Fi copy');

const navMatch = dashJs.match(/const NAV = \[([\s\S]*?)\];/);
assert(navMatch, 'NAV array must exist');
const navItems = [...navMatch[1].matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1]);
assert(navItems.length > 5, 'sidebar must keep existing items');
assert.strictEqual(navItems[navItems.length - 1], 'إعدادات داخلية', 'settings must be the last sidebar item before Home');
assert(navItems.includes('التكامل'), 'integration item remains');
assert(navItems.indexOf('التكامل') === navItems.length - 2, 'settings sits after التكامل');

assert(dashJs.includes("key: 'settings'"), 'NAV has settings key');
assert(dashJs.includes("settings: ['إعدادات داخلية'"), 'TITLES has settings');
assert(dashJs.includes('const renderSettings'), 'settings panel renderer');
assert(dashJs.includes('settings: renderSettings'), 'renderers.settings registered');
assert(dashJs.includes("case 'save-settings'"), 'save-settings action');
assert(dashJs.includes("case 'reset-settings'"), 'reset-settings action');
assert(dashJs.includes('HubSettingsCenter'), 'uses settings center module');
assert(dashJs.includes('applyDashboardChrome'), 'settings apply to dashboard chrome');

assert(centerJs.includes('هوية المنشأة'), 'identity section');
assert(centerJs.includes('وضع الصيانة'), 'maintenance section');
assert(centerJs.includes('الإشعارات'), 'notifications section');
assert(centerJs.includes('الأمن والجلسات'), 'security section');
assert(centerJs.includes('التشغيل والمزامنة'), 'ops section');
assert(centerJs.includes('الرفع والملفات'), 'upload section');
assert(centerJs.includes('المتجر والمنتجات'), 'shop section');
assert(centerJs.includes('البحث والتسجيل'), 'search section');
assert(centerJs.includes('صفحات الإدارة المرتبطة'), 'admin shortcuts');
assert(centerJs.includes('معاينة مباشرة'), 'live preview');
assert(centerJs.includes('الهوية البصرية') || centerJs.includes('الألوان'), 'branding section');
assert(centerJs.includes('window.HubSettingsCenter'), 'settings center exported');

assert(html.includes('id="sidebar-nav"'), 'sidebar nav mount remains');
assert(html.includes('sidebar-home'), 'Home stays below the generated nav');
assert(html.includes('hub-settings-center.js'), 'settings center script included');
assert(html.includes('dashboard.js?v=12'), 'dashboard cache-bust');
assert(html.includes('dashboard.css?v=8'), 'css cache-bust');

assert(css.includes('.settings-grid'), 'settings layout styles');
assert(css.includes('.sac-hero') || css.includes('.sac {'), 'settings admin center styles');
assert(css.includes('.hub-maintenance-banner'), 'maintenance banner styles');
assert(css.includes('hub-compact-sidebar'), 'compact sidebar styles');

assert(storeJs.includes('const defaultSettings'), 'store seeds settings');
assert(storeJs.includes('const getSettings'), 'getSettings API');
assert(storeJs.includes('const saveSettings'), 'saveSettings API');
assert(storeJs.includes('const resetSettings'), 'resetSettings API');
assert(storeJs.includes('getSettings,'), 'getSettings exported');
assert(storeJs.includes('primaryColor'), 'branding colors in store');
assert(storeJs.includes('banners'), 'banners in store');

assert(/MAX_FILE_MB = 150/.test(uploadJs), 'system upload ceiling stays 150MB');
assert(uploadJs.includes('policyMaxMb'), 'upload policy can follow settings');
assert(searchJs.includes('searchIndexEnabled'), 'search honors settings index flag');
assert(marketJs.includes('shopDefaultCategory'), 'products/store honor default shop category');

const localStorage = {
  data: {},
  getItem(k) {
    return Object.prototype.hasOwnProperty.call(this.data, k) ? this.data[k] : null;
  },
  setItem(k, v) {
    this.data[k] = String(v);
  },
  removeItem(k) {
    delete this.data[k];
  },
};
const sandbox = {
  window: {},
  localStorage,
  CustomEvent: class CustomEvent {
    constructor(name) {
      this.type = name;
    }
  },
};
sandbox.window = sandbox;
sandbox.window.EmpireBlueprint = {
  corePlatform: [],
  twelveAxes: [],
  sixMonthPriorities: [],
  preCodeDocs: [],
  dashboardsByRole: [],
};
vm.createContext(sandbox);
vm.runInContext(storeJs, sandbox);

const HubStore = sandbox.window.HubStore;
assert(HubStore && typeof HubStore.getSettings === 'function', 'HubStore.getSettings available');
const defaults = HubStore.getSettings();
assert.strictEqual(defaults.orgNameEn, 'NAIOSH HUB');
assert.strictEqual(defaults.maxUploadMb, 150);
assert.strictEqual(defaults.timezone, 'Asia/Riyadh');
assert.strictEqual(defaults.excludeKonzoo, true);
assert.strictEqual(defaults.searchIndexEnabled, true);
assert.strictEqual(defaults.primaryColor, '#d70000');
assert.ok(Array.isArray(defaults.banners), 'banners defaults to array');

const saved = HubStore.saveSettings({
  orgNameAr: 'منشأة الاختبار',
  compactSidebar: true,
  maxUploadMb: 80,
  shopDefaultCategory: 'فيت',
  primaryColor: '#112233',
  banners: [{ id: 'b1', name: 'بنر تجريبي', enabled: true, order: 1 }],
});
assert.strictEqual(saved.orgNameAr, 'منشأة الاختبار');
assert.strictEqual(saved.compactSidebar, true);
assert.strictEqual(saved.maxUploadMb, 80);
assert.strictEqual(HubStore.getSettings().shopDefaultCategory, 'فيت');
assert.strictEqual(HubStore.getSettings().primaryColor, '#112233');
assert.strictEqual(HubStore.getSettings().banners.length, 1);

const over = HubStore.saveSettings({ maxUploadMb: 900 });
assert.strictEqual(over.maxUploadMb, 150, 'settings cannot raise upload above 150');

const badColor = HubStore.saveSettings({ primaryColor: 'red' });
assert.strictEqual(badColor.primaryColor, '#d70000', 'invalid hex falls back to default');

HubStore.resetSettings();
assert.strictEqual(HubStore.getSettings().orgNameAr, 'نايوش هوب');
assert.strictEqual(HubStore.getSettings().compactSidebar, false);
assert.strictEqual(HubStore.getSettings().banners.length, 0);

console.log(`ok: settings admin center + last in ${navItems.length} sidebar items, store persist/reset works`);
