/**
 * Server-side staff authentication.
 * Passwords verified against scrypt hashes in staff-credentials store.
 * Never logs or returns passwords.
 */
'use strict';

const hubSession = require('./hub-session');
const staffCreds = require('./hub-staff-credentials');
const tokenRevoke = require('./hub-token-revoke');

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function makeStaffToken(email, epoch) {
  const e = normalizeEmail(email);
  const payload = Buffer.from(e).toString('base64');
  const ep = Number(epoch || staffCreds.passwordEpoch(e) || 1);
  return `hub360.${payload}.${Date.now()}.e${ep}`;
}

function publicStaffUser(row, email) {
  return {
    email,
    name: row.name || email,
    role: row.role,
    platform: 'naiosh-hub-360',
    employeeNo: row.employeeNo || null,
    naioshId: row.naioshId || null,
    status: row.active === false ? 'disabled' : 'active',
    experience: 'admin',
    mustChangePassword: !!row.mustChangePassword,
  };
}

/**
 * Resolve staff identity for email — credentials store first, then session map.
 */
function resolveStaffIdentity(email) {
  const e = normalizeEmail(email);
  const cred = staffCreds.getCredential(e);
  if (cred) {
    return {
      email: e,
      name: cred.name,
      role: cred.role,
      employeeNo: cred.employeeNo,
      naioshId: cred.naioshId || null,
      active: cred.active !== false,
      permissions: cred.permissions,
      mustChangePassword: !!cred.mustChangePassword,
      fromCredentials: true,
    };
  }
  const demo = hubSession.DEMO_STAFF_BY_EMAIL[e];
  if (!demo) return null;
  return {
    email: e,
    name: demo.name,
    role: demo.role,
    employeeNo: demo.employeeNo,
    naioshId: demo.naioshId || null,
    active: demo.active !== false && demo.status !== 'disabled',
    permissions: demo.permissions,
    mustChangePassword: false,
    fromCredentials: false,
    legacy: !!demo.legacy,
  };
}

function isStaffEmail(email) {
  return !!resolveStaffIdentity(email);
}

/**
 * Attempt staff login. Returns null if email is not a staff identity
 * (caller should fall through to customer auth).
 */
async function login({ email, password } = {}) {
  const normalized = normalizeEmail(email);
  const pass = String(password || '');
  const identity = resolveStaffIdentity(normalized);
  if (!identity) return null;

  if (!pass) {
    return { ok: false, status: 400, error: 'من فضلك أكمل جميع البيانات المطلوبة.' };
  }

  // Legacy demo emails blocked in production unless explicitly allowed
  if (staffCreds.isLegacyDemoEmail(normalized) && !staffCreds.allowLegacyDemo()) {
    return { ok: false, status: 401, error: 'بيانات الدخول غير صحيحة.' };
  }

  if (!identity.active) {
    return { ok: false, status: 403, error: 'الحساب غير نشط' };
  }

  // Always verify against the latest Postgres-backed hash (not a stale replica memory).
  let verified = await staffCreds.verifyLoginPassword(normalized, pass, { refreshFromDb: true });

  // Ops-only recovery: NEVER overwrite an owner-chosen password just because the
  // host env password was typed (that caused recurring Production lockouts after
  // My Account password changes / agent E2E). Recovery requires an explicit
  // Railway flag: HUB_SUPER_ADMIN_FORCE_PASSWORD_RESET=1.
  const forceReset = String(process.env.HUB_SUPER_ADMIN_FORCE_PASSWORD_RESET || '') === '1';
  if (
    !verified.ok &&
    forceReset &&
    normalized === staffCreds.SUPER_ADMIN_EMAIL &&
    process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD &&
    pass === String(process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD)
  ) {
    await staffCreds.applySuperAdminPassword(pass, { via: 'env_force_login_recovery', forceChange: true });
    verified = await staffCreds.verifyLoginPassword(normalized, pass, { refreshFromDb: true });
    if (verified.ok) {
      console.warn(
        '[hub-staff-auth] Super Admin hash force-reset from HUB_SUPER_ADMIN_INITIAL_PASSWORD — unset HUB_SUPER_ADMIN_FORCE_PASSWORD_RESET after login'
      );
    }
  }
  if (verified.ok) {
    const row = verified.credential;
    const user = publicStaffUser(row, normalized);
    const lane = hubSession.experienceLane(user.role);
    const epoch = staffCreds.passwordEpoch(normalized);
    const token = makeStaffToken(normalized, epoch);
    const perms = Array.isArray(row.permissions)
      ? row.permissions.slice()
      : hubSession.permissionsFor(lane, user.role, normalized);
    return {
      ok: true,
      status: 200,
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user,
      lane,
      employeeNo: user.employeeNo,
      permissions: perms,
      mustChangePassword: !!row.mustChangePassword,
    };
  }

  // No hash yet — try env bootstrap once (covers redeploy with env set)
  if (verified.reason === 'no_credential') {
    if (normalized === staffCreds.SUPER_ADMIN_EMAIL) {
      if (process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD) {
        const boot = await staffCreds.ensureSuperAdminBootstrap();
        if (boot.ok) {
          const again = await staffCreds.verifyLoginPassword(normalized, pass);
          if (again.ok) {
            const row = again.credential;
            const user = publicStaffUser(row, normalized);
            const lane = hubSession.experienceLane(user.role);
            const epoch = staffCreds.passwordEpoch(normalized);
            const token = makeStaffToken(normalized, epoch);
            const perms = Array.isArray(row.permissions)
              ? row.permissions.slice()
              : hubSession.permissionsFor(lane, user.role, normalized);
            return {
              ok: true,
              status: 200,
              success: true,
              message: 'تم تسجيل الدخول بنجاح',
              token,
              user,
              lane,
              employeeNo: user.employeeNo,
              permissions: perms,
              mustChangePassword: !!row.mustChangePassword,
            };
          }
        }
      }
      return {
        ok: false,
        status: 503,
        error:
          'حساب الإدارة غير مهيأ بعد. على Railway: Variables → أضف HUB_SUPER_ADMIN_INITIAL_PASSWORD ثم Redeploy. أو استخدم رمز التهيئة من سجلات الخادم عبر /api/auth/bootstrap-super-admin.',
        needsBootstrap: true,
      };
    }
    return { ok: false, status: 401, error: 'بيانات الدخول غير صحيحة.' };
  }

  if (verified.reason === 'disabled') {
    return { ok: false, status: 403, error: 'الحساب غير نشط' };
  }

  return { ok: false, status: 401, error: 'بيانات الدخول غير صحيحة.' };
}

/**
 * Change password for authenticated staff. Revokes all prior tokens for that email
 * by bumping password epoch (tokens embed .e{N}).
 */
async function changePassword({ email, currentPassword, newPassword, confirmPassword, currentToken } = {}) {
  const e = normalizeEmail(email);
  if (confirmPassword != null && String(newPassword) !== String(confirmPassword)) {
    return { ok: false, status: 400, error: 'تأكيد كلمة المرور غير متطابق.' };
  }
  const verified = await staffCreds.verifyLoginPassword(e, currentPassword);
  if (!verified.ok) {
    return { ok: false, status: 401, error: 'كلمة المرور الحالية غير صحيحة.' };
  }
  const result = await staffCreds.setPassword(e, newPassword, {
    actor: { email: e, employeeNo: verified.credential.employeeNo },
    allowBootstrapWeak: false,
    forceChange: false,
  });
  if (!result.ok) return result;

  // Revoke the previous token explicitly + epoch invalidates others
  if (currentToken) tokenRevoke.revokeToken(currentToken);

  const epoch = result.epoch;
  const token = makeStaffToken(e, epoch);
  const row = staffCreds.getCredential(e);
  const user = publicStaffUser(row, e);
  return {
    ok: true,
    status: 200,
    message: 'تم تغيير كلمة المرور بنجاح.',
    token,
    user,
    employeeNo: user.employeeNo,
  };
}

module.exports = {
  login,
  isStaffEmail,
  makeStaffToken,
  publicStaffUser,
  resolveStaffIdentity,
  changePassword,
};
