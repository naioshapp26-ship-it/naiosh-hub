/**
 * خدماتنا grid uses slide titles, add-service button, and 150MB image/video upload.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const requiredTitles = [
  'الدراسات',
  'استشارة مجانية',
  'الاشتراكات',
  'إدارة الفروع',
  'برامج الحاضنات',
  'الاستشارات',
  'إدارة المهارات',
  'إدارة الابتكارات',
  'إدارة الخبرات',
  'إدارة المواهب',
  'إدارة خفض التكاليف التشغيلية',
  'بناء الأنظمة بدون برمجة',
  'الأمن السيبراني',
  'دمج المرفقات عند التحميل',
  'نظام الرسائل الجماعية',
  'تكامل مع الماسح الضوئي',
  'محرك تقييم الجودة',
  'نظام الدردشة الكتابية',
  'مكتب إدارة المشاريع',
  'إدارة الأداء المؤسسي',
  'متابعة العمليات',
  'دراسة السوق عبر الذكاء الاصطناعي',
  'خدمة العملاء',
  'الخدمات الإدارية',
  'البحوث',
  'الاستشارات والتدريب',
  'تقييم المخاطر',
  'القاعات الافتراضية',
  'دراسات الجدوى',
  'الخدمات المساندة',
  'إدارة المرافق والفعاليات',
  'إدارة الحملات الإعلانية',
  'إدارة منصات التواصل',
  'خدمات الأمن والسلامة',
  'إدارة سلاسل الإمداد',
  'تتبع الطلبات والشحنات',
  'الحوكمة والأتمتة',
  'الجودة والتدقيق',
  'الملكية الفكرية',
  'العقود والفرنشايز',
  'الاستدامة',
  'تشغيل الأنظمة',
];

const catalogSrc = read('js/hub-services-catalog.js');
const uiSrc = read('js/hub-services-ui.js');
const cssSrc = read('css/hub-services-catalog.css');
const servicesPage = read('services.html');
const detailPage = read('service.html');
const searchPage = read('search.html');
const searchSrc = read('js/hub-universal-search.js');
const limitsSrc = read('js/hub-upload-limits.js');

assert(servicesPage.includes('خدماتنا'), 'services page must show خدماتنا');
assert(servicesPage.includes('اضافة خدمة'), 'services page must have add-service button');
assert(servicesPage.includes('data-ns-image'), 'add form must accept images');
assert(servicesPage.includes('data-ns-video'), 'add form must accept videos');
assert(servicesPage.includes('إضافة رابط'), 'add form must include add-link field');
assert(servicesPage.includes('رفع ملف نص / PDF'), 'add form must include text/PDF upload');
assert(servicesPage.includes('رفع صورة'), 'add form must include image upload');
assert(servicesPage.includes('رفع فيديو'), 'add form must include video upload');
assert(servicesPage.includes('ns-dialog-x'), 'add-service dialog must have X close button');
assert(servicesPage.includes('aria-label="إغلاق النموذج"'), 'X button must be labeled to close the form');
assert(cssSrc.includes('minmax(250px, 1fr)'), 'service cards must use original 250px card width');
assert(uiSrc.includes('ماذا تشمل الخدمة'), 'service pages must render inner content sections');
assert(uiSrc.includes('ns-dialog-x') || servicesPage.includes('ns-dialog-x'), 'close control is in the add dialog');
assert(servicesPage.includes('accept="image/png,image/jpeg,image/webp,image/gif'), 'image input excludes svg');
assert(!servicesPage.includes('accept="image/*"'), 'must not use image/* (SVG XSS)');
assert(servicesPage.includes('data-hub-attach="doc"'), 'add form has text/PDF input');
assert(servicesPage.includes('hub-form-attachments.js'), 'services.html loads shared attachment fields');
assert(servicesPage.includes('hub-services-catalog.js'), 'services.html loads catalog');
assert(servicesPage.includes('hub-upload-limits.js'), 'services.html loads upload limits');
assert(detailPage.includes('data-ns-detail'), 'service.html is independent service page');
assert(detailPage.includes('hub-form-attachments.js'), 'service page loads attachment helper');
assert(detailPage.includes('hub-service-requests.js'), 'service page can save requests');
assert(uiSrc.includes('data-service-request'), 'independent service pages include a request form');
assert(uiSrc.includes('FIELDS_HTML'), 'service request form uses shared attachment fields');
assert(searchPage.includes('hub-services-catalog.js'), 'search loads services catalog');
assert(searchSrc.includes('HubServicesCatalog'), 'universal search includes services');
assert(/MAX_FILE_MB = 150/.test(limitsSrc), 'upload limit remains 150MB');
assert(uiSrc.includes('HubFormAttachments'), 'UI collects link/doc/image/video via shared helper');

const store = {};
const windowObj = { HubServicesCatalog: null, HubUniversalSearch: null, HubSearchCatalog: null, HubInfoCenterPages: null };
const sandbox = {
  window: windowObj,
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
  },
  document: { readyState: 'complete', addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } },
};
vm.createContext(sandbox);
vm.runInContext(catalogSrc, sandbox);

const titles = windowObj.HubServicesCatalog.DEFAULT_SERVICES.map((s) => s.title);
assert.strictEqual(titles.length, requiredTitles.length, `expected ${requiredTitles.length} default services`);
requiredTitles.forEach((title) => {
  assert(titles.includes(title), `catalog missing slide title: ${title}`);
});
windowObj.HubServicesCatalog.DEFAULT_SERVICES.forEach((svc) => {
  const full = windowObj.HubServicesCatalog.get(svc.id);
  assert(full?.description && full.description.length > 40, `service page content missing for ${svc.id}`);
  assert(full.points?.length >= 3, `service points missing for ${svc.id}`);
  assert(full.audience, `service audience missing for ${svc.id}`);
});

const added = windowObj.HubServicesCatalog.add({
  title: 'خدمة تجريبية',
  description: 'رفع صورة وفيديو',
  imageUrl: '/uploads/demo.jpg',
  videoUrl: '/uploads/demo.mp4',
  linkUrl: 'https://example.com/brief',
  docUrl: '/uploads/demo.pdf',
  docName: 'demo.pdf',
});
assert(added.ok, 'custom service add must succeed');
assert(
  windowObj.HubServicesCatalog.list().some(
    (s) => s.title === 'خدمة تجريبية' && s.imageUrl && s.videoUrl && s.linkUrl && s.docUrl
  )
);
assert(windowObj.HubServicesCatalog.get(added.item.id), 'custom service has independent page id');

const builtinId = windowObj.HubServicesCatalog.DEFAULT_SERVICES[0].id;
assert.strictEqual(windowObj.HubServicesCatalog.remove(builtinId).ok, false, 'builtin services are not deletable');
assert(windowObj.HubServicesCatalog.remove(added.item.id).ok, 'custom service can be removed');

vm.runInContext(searchSrc, sandbox);
const items = windowObj.HubUniversalSearch.collectCatalog();
requiredTitles.forEach((title) => {
  assert(
    items.some((i) => i.title === title && i.type === 'service' && String(i.href || '').includes('service.html')),
    `search catalog missing service ${title}`
  );
});
assert.strictEqual(
  items.filter((i) => i.type === 'service').length,
  requiredTitles.length,
  'search must list all default services'
);

console.log('PASS services catalog matches slide titles and supports add-service media');
