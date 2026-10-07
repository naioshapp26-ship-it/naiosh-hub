/**
 * Server-side demo staff authentication for built-in Hub operators.
 * Same login endpoint as customers (/api/auth/login) — role/permissions differ only.
 * Passwords are never logged or returned.
 */
'use strict';

const hubSession = require('./hub-session');

/** Demo staff secrets — override via env in deployed environments. Never expose to clients. */
const DEMO_STAFF_SECRETS = {
  'leader@naiosh.com': process.env.HUB_STAFF_PASSWORD_LEADER || process.env.HUB_DEMO_STAFF_PASSWORD || 'Hub@360',
  'malika@naiosh.com': process.env.HUB_STAFF_PASSWORD_MALIKA || process.env.HUB_DEMO_STAFF_PASSWORD || 'Hub@360',
  'viewer@naiosh.com': process.env.HUB_STAFF_PASSWORD_VIEWER || process.env.HUB_DEMO_STAFF_PASSWORD || 'Hub@360',
};

/** Optional disable list (comma-separated emails) without deleting the identity. */
function disabledStaffEmails() {
  return new Set(
    String(process.env.HUB_DISABLED_STAFF_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function makeStaffToken(email) {
  return `hub360.${Buffer.from(normalizeEmail(email)).toString('base64')}.${Date.now()}`;
}

function publicStaffUser(demo, email) {
  return {
    email,
    name: demo.name || email,
    role: demo.role,
    platform: 'naiosh-hub-360',
    employeeNo: demo.employeeNo || null,
    naioshId:
      email === 'leader@naiosh.com'
        ? 'NAI-LEADER-001'
        : email === 'malika@naiosh.com'
          ? 'NAI-MALIKA-001'
          : email === 'viewer@naiosh.com'
            ? 'NAI-VIEWER-099'
            : null,
    status: 'active',
    experience: 'admin',
  };
}

/**
 * Attempt staff login. Returns null if email is not a demo staff identity
 * (caller should fall through to customer auth).
 */
function login({ email, password } = {}) {
  const normalized = normalizeEmail(email);
  const pass = String(password || '');
  const demo = hubSession.DEMO_STAFF_BY_EMAIL[normalized];
  if (!demo) return null;

  if (!pass) {
    return { ok: false, status: 400, error: 'من فضلك أكمل جميع البيانات المطلوبة.' };
  }

  if (disabledStaffEmails().has(normalized) || demo.status === 'disabled' || demo.active === false) {
    return { ok: false, status: 403, error: 'الحساب غير نشط' };
  }

  const expected = DEMO_STAFF_SECRETS[normalized];
  if (!expected || pass !== expected) {
    return { ok: false, status: 401, error: 'بيانات الدخول غير صحيحة.' };
  }

  const user = publicStaffUser(demo, normalized);
  const lane = hubSession.experienceLane(user.role);
  const token = makeStaffToken(normalized);

  return {
    ok: true,
    status: 200,
    success: true,
    message: 'تم تسجيل الدخول بنجاح',
    token,
    user,
    lane,
    employeeNo: user.employeeNo,
    permissions: hubSession.permissionsFor(lane, user.role, normalized),
  };
}

function isStaffEmail(email) {
  return !!hubSession.DEMO_STAFF_BY_EMAIL[normalizeEmail(email)];
}

module.exports = {
  login,
  isStaffEmail,
  makeStaffToken,
  publicStaffUser,
};
