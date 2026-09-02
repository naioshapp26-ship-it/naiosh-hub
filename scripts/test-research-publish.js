/**
 * Research publish form must support full writing, uploads, section CRUD, and two-way questions.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const html = read('publish-research.html');
const js = read('js/hub-research-publish.js');
const css = read('css/hub-research-publish.css');

assert(!/ساي فاي|Sci-?Fi/i.test(html + js), 'research form must not add Sci-Fi copy');

assert(html.includes('data-research-workspace'), 'workspace mount');
assert(html.includes('js/hub-research-publish.js?v=3'), 'page loads research script');
assert(html.includes('css/hub-research-publish.css?v=1'), 'page loads research styles');
assert(html.includes('js/hub-upload-limits.js'), 'page loads 150MB upload limits');
assert(html.includes('js/hub-home-engage.js?v=2'), 'research page cache-busts engage pending filter');
assert(html.includes('name="body"'), 'clear writing field');
assert(html.includes('class="rp-body"'), 'large writing area class');
assert(html.includes('data-rp-upload="text"'), 'text file upload');
assert(html.includes('data-rp-upload="pdf"'), 'pdf upload');
assert(html.includes('data-rp-upload="image"'), 'image upload');
assert(html.includes('data-rp-upload="video"'), 'video upload');
assert(html.includes('accept="application/pdf,.pdf"'), 'pdf accept');
assert(html.includes('accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"'), 'image accept excludes svg');
assert(!html.includes('accept="image/*"'), 'must not use image/* (SVG XSS)');
assert(html.includes('accept="video/*'), 'video accept');
assert(html.includes('data-rp-add-part'), 'add section');
assert(html.includes('إضافة قسم'), 'add section label');
assert(html.includes('data-rp-ask-naiosh'), 'Naiosh can pose questions');
assert(html.includes('اطرح أسئلة نايوش'), 'Naiosh questions button');
assert(html.includes('data-rp-mine-q'), 'researcher question input');
assert(html.includes('أسئلة الباحث'), 'researcher questions heading');
assert(js.includes('data-rp-edit'), 'edit saved research');
assert(js.includes('data-rp-delete'), 'delete saved research');
assert(html.includes('data-rp-new'), 'add new research');
assert(html.includes('إرسال'), 'submit still exists');
assert(html.includes('حفظ على هذا الجهاز'), 'submit copy is local, not an admin review queue');
assert(!html.includes('تم استلام بحثك للمراجعة'), 'must not promise admin intake');
assert(html.includes('hub-research-submissions') || js.includes("KEY = 'hub-research-submissions'"), 'homepage counter key kept');

assert(js.includes("data-rp-part-fix"), 'correct section');
assert(js.includes("data-rp-part-edit"), 'edit section');
assert(js.includes("data-rp-part-del"), 'delete section');
assert(js.includes('NAIOSH_BANK'), 'multiple Naiosh questions');
assert(js.includes('naioshReply'), 'Naiosh answers researcher questions');
assert(js.includes('isSvgFile'), 'SVG block helper');
assert(js.includes('correctText'), 'تصحيح actually cleans text');
assert(js.includes('سجّل الدخول لرفع فيديو'), 'public page does not POST large/video without auth');
assert(js.includes('INLINE_DATA_URL_MAX_BYTES'), 'inline fallback honors upload cap');

assert(css.includes('.rp-body'), 'writing area styles');
assert(css.includes('min-height: 280px'), 'writing area is large');

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
  document: {
    readyState: 'complete',
    querySelector() {
      return null;
    },
    addEventListener() {},
  },
  localStorage,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(js, sandbox);

const api = sandbox.window.HubResearchPublish;
assert(api, 'HubResearchPublish exports');
assert(api.NAIOSH_BANK.length >= 3, 'Naiosh asks more than one question');
assert(api.naioshReply('كيف أرفع PDF').includes('PDF'), 'Naiosh replies to researcher upload questions');
assert(api.naioshReply('كيف أضيف قسم').includes('قسم'), 'Naiosh replies about sections');

assert.strictEqual(api.isSvgFile({ name: 'x.svg', type: 'image/svg+xml' }), true);
assert.strictEqual(api.detectKind({ name: 'x.svg', type: 'image/svg+xml' }), '');
assert.strictEqual(api.detectKind({ name: 'shot.png', type: 'image/png' }), 'image');
assert.strictEqual(api.correctText('نص\u0640\u0640   تجريبى\n\n\nسطر'), 'نص تجريبى\n\nسطر');

const draft = api.emptyDraft();
draft.title = 'مسودة فقط';
draft.body = 'نص';
draft.status = 'draft';
api.saveItem(draft);
const pendingItem = api.emptyDraft();
pendingItem.title = 'بحث تجريبي';
pendingItem.body = 'نص واضح';
pendingItem.status = 'pending';
api.saveItem(pendingItem);
assert.strictEqual(api.readAll().length, 2);

const engageSrc = read('js/hub-home-engage.js');
assert(engageSrc.includes("x.status === 'pending'"), 'engage filters pending only');
vm.runInContext(engageSrc, sandbox);
const pendingCount = sandbox.window.HubHomeEngage.countPendingResearch();
assert.strictEqual(pendingCount, 1, 'drafts must not inflate the home kicker');
const kicker = sandbox.window.HubHomeEngage.PORTALS.find((p) => p.id === 'research').feed().kicker;
assert(kicker.includes('محفوظ على هذا الجهاز'), 'home kicker is local storage, not admin review');
assert(!kicker.includes('بانتظار المراجعة'), 'must not label drafts/sends as awaiting review');

const index = read('index.html');
assert(index.includes('hub-home-engage.js?v=2'), 'index cache-busts pending filter');

console.log(`ok: research workspace writing + 4 uploads + CRUD + pending filter + ${api.NAIOSH_BANK.length} Naiosh questions`);
