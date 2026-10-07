/**
 * Shared password policy — owner-approved: no complexity rules.
 * Only reject empty / whitespace-only passwords (optional min length via env).
 * Never logs or returns password values.
 */
'use strict';

/** Owner policy: allow short numeric passwords (e.g. 1234, 4827). Default 1 = non-empty. */
const MIN_LEN = Math.max(1, Number(process.env.HUB_PASSWORD_MIN_LENGTH || 1));

/**
 * @param {string} password
 * @param {{ allowBootstrapWeak?: boolean }} [_opts] kept for call-site compatibility
 */
function analyze(password, _opts = {}) {
  const p = String(password ?? '');
  const rules = {
    notEmpty: p.length > 0,
    minLength: p.length >= MIN_LEN,
    // Reject passwords that are only whitespace (not a complexity rule)
    notWhitespaceOnly: p.length === 0 ? false : p.trim().length > 0,
  };
  const ok = rules.notEmpty && rules.minLength && rules.notWhitespaceOnly;
  let error = '';
  if (!rules.notEmpty || !rules.notWhitespaceOnly) {
    error = 'كلمة المرور مطلوبة.';
  } else if (!rules.minLength) {
    error = MIN_LEN > 1 ? `كلمة المرور يجب أن تكون ${MIN_LEN} أحرف على الأقل.` : 'كلمة المرور مطلوبة.';
  }
  return { ok, rules, minLength: MIN_LEN, error };
}

/** @deprecated empty — kept so older require() callers do not crash */
const WEAK = new Set();

module.exports = { analyze, MIN_LEN, WEAK };
