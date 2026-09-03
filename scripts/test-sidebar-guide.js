/**
 * Sidebar guide destinations — each mine button opens the right page
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const sidebar = fs.readFileSync('/workspace/js/hero-sidebar-nav.js', 'utf8');
const expected = [
  ["فرعي", 'my-branch.html'],
  ["حاضنتي", 'my-incubator.html'],
  ["منصتي", 'my-platform.html'],
  ["مكتبي", 'my-office.html'],
  ["اعلاناتي", 'ads.html'],
  ["منتجاتي", 'products.html'],
  ["قناتي", 'my-channel.html'],
  ["طلبات المشاريع", 'side-project-registrations.html'],
  ["نظام التشغيل", 'global-os.html'],
  ["شراكاتي", 'partnerships.html'],
  ["دوراتي", 'my-courses.html'],
  ["دبلوماتي", 'my-diplomas.html'],
];

expected.forEach(([label, href]) => {
  assert(sidebar.includes(`ensure('${label}', '${href}'`), `missing ensure ${label} → ${href}`);
});
assert(sidebar.includes("href: 'chat.html'"), 'chat missing');
assert(sidebar.includes("href: 'apps.html'"), 'اخرى/apps missing');
assert(!sidebar.includes("ensure('قناتي', 'side-projects.html"), 'قناتي must not be side-projects');
assert(!sidebar.includes("ensure('مكتبي', 'office.html'"), 'مكتبي must not be generic office');
assert(!sidebar.includes("ensure('دوراتي', 'courses.html'"), 'دوراتي must not be public catalog');

[
  'my-office.html',
  'my-channel.html',
  'my-courses.html',
  'my-diplomas.html',
  'js/hub-client-offices.js',
  'js/hub-client-channels.js',
  'js/hub-client-learning.js',
  'js/hub-my-office.js',
  'js/hub-my-channel.js',
  'js/hub-my-learning.js',
].forEach((rel) => assert(fs.existsSync(path.join('/workspace', rel)), `missing ${rel}`));

const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(String(k), String(v)),
  removeItem: (k) => store.delete(k),
};
const window = {
  localStorage,
  dispatchEvent() {},
  HubLearningCatalog: {
    COURSES: [{ id: 'course-ops', storeId: 'st-ac-1', title: 'دورة التشغيل السيادي', level: 'تأسيسي', duration: '٤ أسابيع', icon: 'fa-gears' }],
    DIPLOMAS: [{ id: 'dip-ops-leader', storeId: 'st-dip-1', title: 'دبلوم قيادة التشغيل', level: 'احترافي', duration: '١٢ أسبوعًا', icon: 'fa-flag' }],
  },
};
const context = vm.createContext({ window, localStorage, console });
const load = (rel) => {
  vm.runInContext(fs.readFileSync(path.join('/workspace', rel), 'utf8'), context, { filename: rel });
};
load('js/hub-client-offices.js');
load('js/hub-client-channels.js');
load('js/hub-client-learning.js');

const email = 'guide-user@test.com';
const office = window.HubClientOffices.grantFromBooking({
  email,
  fullName: 'مستخدم',
  subdomain: 'guide-office',
  sectorName: 'مكتب تجريبي',
  branch: 'br-sa',
  branchLabel: 'السعودية',
  incubator: 'inc-1',
  incubatorLabel: 'حاضنة',
  platform: 'plt-1',
  platformLabel: 'منصة',
  source: 'platform',
});
assert(office.ok, office.error);
assert.strictEqual(window.HubClientOffices.listForEmail(email).length, 1);
assert.strictEqual(window.HubClientOffices.listForEmail('other@test.com').length, 0);

const ch = window.HubClientChannels.updateLinks(email, {
  title: 'قناة الدليل',
  youtubeUrl: 'https://youtube.com/@naiosh',
  socialUrl: 'https://instagram.com/naiosh',
});
assert(ch.ok);
const vid = window.HubClientChannels.addVideo(email, {
  title: 'فيديو تجريبي',
  url: 'https://youtube.com/watch?v=abc',
});
assert(vid.ok);
assert.strictEqual(window.HubClientChannels.listForEmail(email)[0].videos.length, 1);

const courseId = window.HubLearningCatalog.COURSES[0].id;
const dipId = window.HubLearningCatalog.DIPLOMAS[0].id;
assert(window.HubClientLearning.enroll({ email, kind: 'course', itemId: courseId }).ok);
assert(window.HubClientLearning.enroll({ email, kind: 'diploma', itemId: dipId }).ok);
assert.strictEqual(window.HubClientLearning.listForEmail(email, 'course').length, 1);
assert.strictEqual(window.HubClientLearning.listForEmail(email, 'diploma').length, 1);
assert.strictEqual(window.HubClientLearning.listForEmail('nobody@test.com', 'course').length, 0);

const index = fs.readFileSync('/workspace/index.html', 'utf8');
assert(index.includes('hero-sidebar-nav.js?v=13'), 'sidebar cache bump missing');

console.log('PASS sidebar guide mine destinations + isolation');
