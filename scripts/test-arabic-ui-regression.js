/**
 * Regression: يمنع عودة نصوص UI إنجليزية في دستور المعمارية وHubI18n
 * node scripts/test-arabic-ui-regression.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(read('js/hub-i18n.js'), context);
vm.runInContext(read('js/empire-blueprint.js'), context);

const I18n = context.window.HubI18n;
const BP = context.window.EmpireBlueprint;

assert.ok(I18n, 'HubI18n loaded');
assert.ok(BP, 'EmpireBlueprint loaded');

// Status mapping
['building', 'planned', 'ready', 'pending', 'active', 'failed', 'passed', 'waiting', 'in_progress'].forEach((s) => {
  const ar = I18n.status(s);
  assert.ok(/[\u0600-\u06FF]/.test(ar), `status ${s} → Arabic, got ${ar}`);
  assert.notStrictEqual(ar.toLowerCase(), s.toLowerCase());
});

// Layer names not shown as English via displayName
BP.fiveLayers.forEach((l) => {
  const d = I18n.displayName(l);
  assert.ok(/[\u0600-\u06FF]/.test(d), `layer ${l.id} display Arabic`);
  assert.ok(!/Layer$/i.test(d), `layer display must not end with Layer: ${d}`);
});

// Core platform display via label
[
  'Single Sign-On',
  'IAM',
  'Role Matrix Engine',
  'Organization Hierarchy',
  'Notification Center',
  'Multi-Tenant Engine',
].forEach((en) => {
  const ar = I18n.label(en);
  assert.ok(/[\u0600-\u06FF]/.test(ar), `${en} mapped to Arabic: ${ar}`);
  assert.notStrictEqual(ar, en);
});

// Learning Ecosystem item Arabic in blueprint
const knowledge = BP.fiveLayers.find((l) => l.id === 'knowledge');
assert.ok(knowledge.items.every((i) => !/^[A-Za-z]/.test(i) || /[\u0600-\u06FF]/.test(i)));
assert.ok(!knowledge.items.includes('Learning Ecosystem'));

// Priorities axis Arabic
BP.sixMonthPriorities.forEach((p) => {
  assert.ok(/[\u0600-\u06FF]/.test(p.axis), `priority ${p.order} axis Arabic: ${p.axis}`);
});

// Docs Arabic
BP.preCodeDocs.forEach((d) => {
  assert.ok(d.nameAr && /[\u0600-\u06FF]/.test(d.nameAr), `doc Arabic: ${d.name}`);
});

// looksLikeUiEnglish detects Save but allows NAIOSH / API
assert.strictEqual(I18n.looksLikeUiEnglish('Save'), true);
assert.strictEqual(I18n.looksLikeUiEnglish('Core Layer'), true);
assert.strictEqual(I18n.looksLikeUiEnglish('Notification Center'), true);
assert.strictEqual(I18n.looksLikeUiEnglish('NAIOSH'), false);
assert.strictEqual(I18n.looksLikeUiEnglish('API'), false);
assert.strictEqual(I18n.looksLikeUiEnglish('حفظ'), false);
assert.strictEqual(I18n.looksLikeUiEnglish('leader@naiosh.com'), false);

vm.runInContext(read('js/hub-i18n-display.js'), context);
const I2 = context.window.HubI18n;
assert.ok(typeof I2.getArabicLabel === 'function', 'getArabicLabel exists');

const coreCases = {
  'Central Intelligence Engine': 'محرك الذكاء المركزي',
  'AI Decision': 'قرارات الذكاء الاصطناعي',
  'AI Decisions': 'قرارات الذكاء الاصطناعي',
  'AI Analysis': 'تحليل الذكاء الاصطناعي',
  Operational: 'تشغيلي',
  Anomaly: 'اكتشاف الشذوذ',
  Risk: 'مخاطر',
  'Anomaly Engine': 'محرك اكتشاف الشذوذ',
  Optimization: 'تحسين',
  'Optimization Engine': 'محرك التحسين',
  Growth: 'نمو',
  pending: 'قيد الانتظار',
  approved: 'تمت الموافقة',
  rejected: 'مرفوض',
  high: 'مرتفع',
};
Object.entries(coreCases).forEach(([en, ar]) => {
  const got = I2.getArabicLabel('default', en);
  assert.ok(/[\u0600-\u06FF]/.test(got), `${en} → Arabic, got ${got}`);
  assert.notStrictEqual(got, en);
  assert.strictEqual(got, ar, `${en} expected ${ar}, got ${got}`);
});

assert.strictEqual(I2.getArabicLabel('default', 'DEC-2026-00001'), 'DEC-2026-00001');
assert.strictEqual(I2.getArabicLabel('default', 'EMP-0004'), 'EMP-0004');
assert.ok(!/[A-Za-z]{3,}/.test(I2.localizeText('نوع Operational')));

// dashboard renderBlueprint must not inject English layer names as visible small tags
const dash = read('js/dashboard.js');
assert.ok(!/esc\(l\.name\)/.test(dash) || !/fiveLayers[\s\S]{0,200}esc\(l\.name\)/.test(dash));
assert.ok(dash.includes('HubI18n'), 'dashboard uses HubI18n');
assert.ok(dash.includes('النواة المشتركة'), 'section title Arabic');

console.log('OK arabic-ui-regression');
