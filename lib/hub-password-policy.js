/**
 * Production password policy — shared by customer + staff.
 * Never logs or returns password values.
 */
'use strict';

const MIN_LEN = Number(process.env.HUB_PASSWORD_MIN_LENGTH || 8);
const PROD = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

/** Very weak patterns rejected for new passwords (not bootstrap). */
const WEAK = new Set([
  'password',
  'password1',
  '12345678',
  '123456789',
  'qwertyui',
  'abcdefgh',
  '11111111',
  '00000000',
  'hub@360',
  'hub360',
]);

function analyze(password, { allowBootstrapWeak = false } = {}) {
  const p = String(password || '');
  const lower = p.toLowerCase();
  const rules = {
    minLength: p.length >= MIN_LEN,
    notWhitespaceOnly: p.trim().length === p.length && p.length > 0,
    notCommon: allowBootstrapWeak || !WEAK.has(lower),
  };
  if (PROD && !allowBootstrapWeak) {
    rules.hasLetter = /[A-Za-z\u0600-\u06FF]/.test(p);
    rules.hasNumber = /\d/.test(p);
  }
  const ok = Object.values(rules).every(Boolean);
  let error = '';
  if (!rules.minLength) error = `كلمة المرور يجب أن تكون ${MIN_LEN} أحرف على الأقل.`;
  else if (!rules.notWhitespaceOnly) error = 'كلمة المرور غير صالحة.';
  else if (!rules.notCommon) error = 'كلمة المرور ضعيفة جدًا. اختر كلمة أقوى.';
  else if (rules.hasLetter === false) error = 'يجب أن تحتوي كلمة المرور على حرف واحد على الأقل.';
  else if (rules.hasNumber === false) error = 'يجب أن تحتوي كلمة المرور على رقم واحد على الأقل.';
  return { ok, rules, minLength: MIN_LEN, error };
}

module.exports = { analyze, MIN_LEN, WEAK };
