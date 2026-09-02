/**
 * Every service form includes link + text/PDF + image + video fields.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const pages = {
  services: read('services.html'),
  consultation: read('consultation.html'),
  suggestions: read('suggestions.html'),
  complaints: read('complaints.html'),
  support: read('support.html'),
  service: read('service.html'),
};
const attachSrc = read('js/hub-form-attachments.js');
const requestsSrc = read('js/hub-service-requests.js');
const pagesSrc = read('js/hub-service-pages.js');
const supportPageSrc = read('js/hub-support-page.js');
const uiSrc = read('js/hub-services-ui.js');
const cssSrc = read('css/hub-service-requests.css');

const LABELS = ['إضافة رابط', 'رفع ملف نص / PDF', 'رفع صورة', 'رفع فيديو'];

Object.entries(pages).forEach(([name, html]) => {
  if (name === 'service') {
    assert(html.includes('hub-form-attachments.js'), `${name} loads attachment helper`);
    return;
  }
  LABELS.forEach((label) => {
    assert(html.includes(label), `${name} form must include ${label}`);
  });
  assert(html.includes('data-hub-attach="link"'), `${name} has link input`);
  assert(html.includes('data-hub-attach="doc"'), `${name} has doc input`);
  assert(html.includes('data-hub-attach="image"'), `${name} has image input`);
  assert(html.includes('data-hub-attach="video"'), `${name} has video input`);
  assert(html.includes('hub-form-attachments.js'), `${name} loads attachment helper`);
  assert(!html.includes('accept="image/*"'), `${name} must not use image/*`);
  assert(html.includes('image/png,image/jpeg,image/webp,image/gif'), `${name} image accept excludes svg`);
});

assert(uiSrc.includes('data-service-request'), 'independent service page renders a request form');
assert(uiSrc.includes('FIELDS_HTML'), 'service page request form injects the four attachment fields');
assert(pagesSrc.includes('HubFormAttachments'), 'consultation/suggestions/complaints persist attachments');
assert(supportPageSrc.includes('HubFormAttachments'), 'support tickets persist attachments');
assert(cssSrc.includes('.hub-attach-grid'), 'attachment grid styles exist');
assert(attachSrc.includes('isSvgFile'), 'SVG block helper');
assert(attachSrc.includes('سجّل الدخول لرفع فيديو'), 'video/large files require login');
assert(attachSrc.includes('INLINE_DATA_URL_MAX_BYTES'), 'inline fallback honors upload cap');

const store = {};
const windowObj = {};
const sandbox = {
  window: windowObj,
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
  },
  document: {
    readyState: 'complete',
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
  },
};
vm.createContext(sandbox);
vm.runInContext(attachSrc, sandbox);
vm.runInContext(requestsSrc, sandbox);

const api = windowObj.HubFormAttachments;
assert(api.isSvgFile({ name: 'logo.svg', type: 'image/svg+xml' }), 'detect svg by name/type');
assert(!api.isSvgFile({ name: 'photo.png', type: 'image/png' }), 'png is allowed');

const stored = api.toStored({
  attachLink: 'https://example.com/x',
  attachDoc: { url: '/uploads/a.pdf', name: 'a.pdf' },
  attachImage: { url: '/uploads/a.png' },
  attachVideo: { url: '/uploads/a.mp4' },
});
assert.strictEqual(stored.attachLink, 'https://example.com/x');
assert.strictEqual(stored.attachDocName, 'a.pdf');
assert.strictEqual(stored.attachImageUrl, '/uploads/a.png');
assert.strictEqual(stored.attachVideoUrl, '/uploads/a.mp4');

const item = windowObj.HubServiceRequests.create({
  kind: 'consultation',
  title: 'طلب تجربة',
  body: 'تفاصيل',
  ...stored,
});
assert(item.attachLink && item.attachDocUrl && item.attachImageUrl && item.attachVideoUrl, 'request stores all four attachments');

windowObj.HubUploadLimits = {
  INLINE_DATA_URL_MAX_BYTES: 1500,
  assertFile: () => ({ ok: true }),
};
windowObj.HubAuth = { isLoggedIn: () => false };

(async () => {
  await assert.rejects(
    () => api.ingest({ name: 'x.svg', type: 'image/svg+xml', size: 20 }, 'image'),
    /SVG/
  );
  await assert.rejects(
    () => api.ingest({ name: 'clip.mp4', type: 'video/mp4', size: 80 }, 'video'),
    /سجّل الدخول/
  );
  console.log('PASS service forms include link, text/PDF, image, and video fields');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
