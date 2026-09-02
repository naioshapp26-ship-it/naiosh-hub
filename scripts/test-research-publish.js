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
assert(html.includes('js/hub-research-publish.js?v=1'), 'page loads research script');
assert(html.includes('css/hub-research-publish.css?v=1'), 'page loads research styles');
assert(html.includes('js/hub-upload-limits.js'), 'page loads 150MB upload limits');
assert(html.includes('name="body"'), 'clear writing field');
assert(html.includes('class="rp-body"'), 'large writing area class');
assert(html.includes('data-rp-upload="text"'), 'text file upload');
assert(html.includes('data-rp-upload="pdf"'), 'pdf upload');
assert(html.includes('data-rp-upload="image"'), 'image upload');
assert(html.includes('data-rp-upload="video"'), 'video upload');
assert(html.includes('accept="application/pdf,.pdf"'), 'pdf accept');
assert(html.includes('accept="image/*"'), 'image accept');
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
assert(html.includes('إرسال للمراجعة'), 'submit still exists');
assert(html.includes('hub-research-submissions') || js.includes("KEY = 'hub-research-submissions'"), 'homepage counter key kept');

assert(js.includes("data-rp-part-fix"), 'correct section');
assert(js.includes("data-rp-part-edit"), 'edit section');
assert(js.includes("data-rp-part-del"), 'delete section');
assert(js.includes('NAIOSH_BANK'), 'multiple Naiosh questions');
assert(js.includes('naioshReply'), 'Naiosh answers researcher questions');
assert(js.includes('HubUploadLimits'), 'uploads go through shared limits');

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

const draft = api.emptyDraft();
draft.title = 'بحث تجريبي';
draft.body = 'نص واضح';
draft.status = 'pending';
api.saveItem(draft);
const saved = api.readAll();
assert.strictEqual(saved[0].title, 'بحث تجريبي');
assert.strictEqual(saved[0].status, 'pending');

const engage = read('js/hub-home-engage.js');
assert(engage.includes('hub-research-submissions'), 'home section still counts submissions');

console.log(`ok: research workspace writing + 4 uploads + CRUD + ${api.NAIOSH_BANK.length} Naiosh questions`);
