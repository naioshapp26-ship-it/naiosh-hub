/**
 * Hub session / RBAC helpers — verify opaque hub tokens and map roles.
 * Tokens are issued by customer-auth or demo/tenant login (hub360.*).
 * Server-side checks must use this module — never trust client role claims alone.
 */
'use strict';

const customerAuth = require('./hub-customer-auth');
const tokenRevoke = require('./hub-token-revoke');

const STAFF_SESSION_ROLES = new Set(['supreme_leader', 'chief_engineer', 'admin', 'super_admin']);
const CLIENT_SESSION_ROLES = new Set(['customer', 'client']);

/**
 * Built-in staff identities — never resolve as customer via leftover cookie/email.
 * Production Super Admin: naioshhub@example.com (EMP-0001), migrated from leader@naiosh.com.
 * Legacy demo emails remain mapped but login is blocked unless HUB_ALLOW_LEGACY_DEMO=1.
 */
const DEMO_STAFF_BY_EMAIL = {
  'naioshhub@example.com': {
    role: 'supreme_leader',
    name: 'القائد الأعلى',
    employeeNo: 'EMP-0001',
    naioshId: 'NAI-LEADER-001',
  },
  /** Legacy alias — identity migrated; public login disabled. */
  'leader@naiosh.com': {
    role: 'supreme_leader',
    name: 'القائد الأعلى',
    employeeNo: 'EMP-0001',
    naioshId: 'NAI-LEADER-001',
    legacy: true,
    status: 'disabled',
  },
  'malika@naiosh.com': {
    role: 'chief_engineer',
    name: 'المهندسة مليكة',
    employeeNo: 'EMP-0003',
    naioshId: 'NAI-MALIKA-001',
    legacy: true,
  },
  /**
   * Limited ops viewer — ADMIN lane identity without clients.create.
   * Used to prove create-client authorization is permission-dynamic (not role-hardcoded).
   */
  'viewer@naiosh.com': {
    role: 'admin',
    name: 'موظف عرض العملاء',
    employeeNo: 'EMP-0099',
    naioshId: 'NAI-VIEWER-099',
    legacy: true,
    permissions: [
      'clients.view',
      'clients.edit',
      'client_activity.view',
      'orders.view',
      'support.view',
      'notifications.view',
      'reports.view',
    ],
  },
};

const ROLE_LANE = {
  supreme_leader: 'SUPER_ADMIN',
  chief_engineer: 'ADMIN',
  admin: 'ADMIN',
  super_admin: 'SUPER_ADMIN',
  customer: 'CLIENT',
  client: 'CLIENT',
  platform_owner: 'CLIENT',
};

const SUPER_ADMIN_PERMISSIONS = [
  'clients.view',
  'clients.create',
  'clients.edit',
  'clients.suspend',
  'clients.manage',
  'client_activity.view',
  'systems.assign',
  'systems.remove',
  'orders.view',
  'orders.update',
  'orders.manage',
  'subscriptions.view',
  'subscriptions.manage',
  'billing.view',
  'billing.manage',
  'wallet.view',
  'wallet.adjust',
  'support.view',
  'support.reply',
  'support.assign',
  'notifications.view',
  'issues.view',
  'issues.manage',
  'security_logs.view',
  'reports.view',
  'permissions.manage',
  'campaigns.view',
  'campaigns.create',
  'campaigns.edit',
  'campaigns.content',
  'campaigns.upload',
  'campaigns.review',
  'campaigns.approve',
  'campaigns.budget',
  'campaigns.publish',
  'campaigns.pause',
  'campaigns.reports',
  'campaigns.delete',
  'events.view',
  'events.create',
  'events.edit',
  'events.upload',
  'events.review',
  'events.approve',
  'events.publish',
  'events.delete',
  'articles.view',
  'articles.create',
  'articles.edit',
  'articles.upload',
  'articles.review',
  'articles.approve',
  'articles.publish',
  'articles.delete',
];

const ADMIN_DEFAULT_PERMISSIONS = [
  'clients.view',
  'clients.create',
  'clients.edit',
  'client_activity.view',
  'orders.view',
  'orders.update',
  'subscriptions.view',
  'billing.view',
  'wallet.view',
  'support.view',
  'support.reply',
  'notifications.view',
  'issues.view',
  'reports.view',
  'campaigns.view',
  'campaigns.create',
  'campaigns.edit',
  'campaigns.content',
  'campaigns.upload',
  'campaigns.review',
  'campaigns.approve',
  'campaigns.budget',
  'campaigns.publish',
  'campaigns.pause',
  'campaigns.reports',
  'campaigns.delete',
  'events.view',
  'events.create',
  'events.edit',
  'events.upload',
  'events.review',
  'events.approve',
  'events.publish',
  'events.delete',
  'articles.view',
  'articles.create',
  'articles.edit',
  'articles.upload',
  'articles.review',
  'articles.approve',
  'articles.publish',
  'articles.delete',
];

function parseAuthHeader(req) {
  const raw = String(req.headers.authorization || req.headers.Authorization || '').trim();
  if (raw) {
    const m = raw.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
    if (raw.startsWith('hub360.')) return raw;
  }
  const cookie = String(req.headers.cookie || '');
  const cm = cookie.match(/(?:^|;\s*)hub_session=([^;]+)/);
  if (cm) {
    try {
      return decodeURIComponent(cm[1].trim());
    } catch {
      return cm[1].trim();
    }
  }
  return String(req.headers['x-hub-token'] || '').trim();
}

function cookieSecureFlag() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production' ? '; Secure' : '';
}

function sessionCookieHeader(token) {
  const value = encodeURIComponent(String(token || ''));
  return `hub_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${cookieSecureFlag()}`;
}

function clearSessionCookieHeader() {
  return `hub_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${cookieSecureFlag()}`;
}

function decodeEmailFromToken(token) {
  const t = String(token || '');
  // hub360.cust.<base64url(email)>.<ts>
  const cust = t.match(/^hub360\.cust\.([^.]+)\./);
  if (cust) {
    try {
      return Buffer.from(cust[1], 'base64url').toString('utf8').toLowerCase();
    } catch {
      return '';
    }
  }
  // hub360.<btoa(email)>.<ts>[.e{epoch}]
  const demo = t.match(/^hub360\.([^.]+)\.(\d+)(?:\.e(\d+))?$/);
  if (demo && !demo[1].startsWith('cust')) {
    try {
      return Buffer.from(demo[1], 'base64').toString('utf8').toLowerCase();
    } catch {
      try {
        return Buffer.from(demo[1], 'base64url').toString('utf8').toLowerCase();
      } catch {
        return '';
      }
    }
  }
  return '';
}

/** Extract password-epoch from staff token (hub360.<b64>.<ts>.eN). Missing → 0 (pre-hardening). */
function decodeEpochFromToken(token) {
  const m = String(token || '').match(/\.e(\d+)$/);
  return m ? Number(m[1]) : 0;
}

function experienceLane(role) {
  return ROLE_LANE[String(role || '').toLowerCase()] || 'CLIENT';
}

function isStaffLane(lane) {
  return lane === 'SUPER_ADMIN' || lane === 'ADMIN';
}

function isClientLane(lane) {
  return lane === 'CLIENT';
}

function permissionsFor(lane, role, email) {
  const demo = email ? DEMO_STAFF_BY_EMAIL[String(email).toLowerCase()] : null;
  if (Array.isArray(demo?.permissions)) return demo.permissions.slice();
  if (lane === 'SUPER_ADMIN') return SUPER_ADMIN_PERMISSIONS.slice();
  if (lane === 'ADMIN') return ADMIN_DEFAULT_PERMISSIONS.slice();
  return [];
}

function hasPermission(session, permission) {
  if (!session?.ok) return false;
  if (session.lane === 'SUPER_ADMIN') return true;
  return (session.permissions || []).includes(permission);
}

/**
 * Resolve authenticated session from request.
 * Optional x-hub-user-role / x-hub-user-name used only to enrich demo sessions after token email decode.
 */
function isCustomerToken(token) {
  return /^hub360\.cust\./i.test(String(token || ''));
}

function resolveSession(req) {
  const token = parseAuthHeader(req) || String(req.headers['x-hub-token'] || '').trim();
  if (!token) {
    return { ok: false, status: 401, error: 'مطلوب تسجيل الدخول' };
  }

  if (tokenRevoke.isRevoked(token)) {
    return { ok: false, status: 401, error: 'انتهت الجلسة. يرجى تسجيل الدخول مجددًا.' };
  }

  const email = decodeEmailFromToken(token);
  if (!email) {
    return { ok: false, status: 401, error: 'جلسة غير صالحة' };
  }

  // Password-epoch invalidation for staff tokens after password change
  let staffCred = null;
  try {
    const staffCreds = require('./hub-staff-credentials');
    staffCred = staffCreds.getCredential(email);
    if (staffCred && !isCustomerToken(token)) {
      const tokenEpoch = decodeEpochFromToken(token);
      const currentEpoch = staffCreds.passwordEpoch(email);
      if (currentEpoch > 0 && tokenEpoch > 0 && tokenEpoch < currentEpoch) {
        return { ok: false, status: 401, error: 'انتهت الجلسة. يرجى تسجيل الدخول مجددًا.' };
      }
      // Tokens issued before epoch embedding are rejected once a password was set/changed
      if (currentEpoch > 1 && tokenEpoch === 0) {
        return { ok: false, status: 401, error: 'انتهت الجلسة. يرجى تسجيل الدخول مجددًا.' };
      }
      if (staffCred.active === false) {
        return { ok: false, status: 403, error: 'الحساب غير نشط' };
      }
    }
  } catch {
    staffCred = null;
  }

  const demoStaff = DEMO_STAFF_BY_EMAIL[email] || null;
  const hintRole = String(req.headers['x-hub-user-role'] || '').toLowerCase();

  // Staff credential / built-in identity — never downgrade to customer
  if ((staffCred || demoStaff) && !isCustomerToken(token)) {
    if (demoStaff?.status === 'disabled' && !staffCred) {
      return { ok: false, status: 403, error: 'الحساب غير نشط' };
    }
    const role = staffCred?.role || demoStaff.role;
    const lane = experienceLane(role);
    const perms = Array.isArray(staffCred?.permissions)
      ? staffCred.permissions.slice()
      : permissionsFor(lane, role, email);
    return {
      ok: true,
      token,
      email,
      role,
      lane,
      name: staffCred?.name || demoStaff?.name || email,
      userId: email,
      employeeNo: staffCred?.employeeNo || demoStaff?.employeeNo || null,
      permissions: perms,
      account: null,
      experience: 'admin',
      mustChangePassword: !!staffCred?.mustChangePassword,
    };
  }

  // Customer tokens / customer store — only real accounts, never invent a CLIENT session
  const account = customerAuth.findByEmail?.(email) || null;
  if (isCustomerToken(token)) {
    if (!account) {
      return { ok: false, status: 401, error: 'جلسة غير صالحة' };
    }
    if (account.status && account.status !== 'active') {
      return { ok: false, status: 403, error: 'الحساب غير نشط' };
    }
    return {
      ok: true,
      token,
      email,
      role: 'customer',
      lane: 'CLIENT',
      name: account.fullName || account.name || email,
      userId: account.id,
      customerId: account.customerId || account.id,
      employeeNo: null,
      permissions: [],
      account,
      experience: 'client',
    };
  }

  // Legacy non-.cust token that maps to a known customer account (not staff)
  if (account && !staffCred && !demoStaff) {
    if (account.status && account.status !== 'active') {
      return { ok: false, status: 403, error: 'الحساب غير نشط' };
    }
    return {
      ok: true,
      token,
      email,
      role: 'customer',
      lane: 'CLIENT',
      name: account.fullName || account.name || email,
      userId: account.id,
      customerId: account.customerId || account.id,
      employeeNo: null,
      permissions: [],
      account,
      experience: 'client',
    };
  }

  // Do NOT invent sessions for unknown hub360.* tokens (stale phone cookies used to
  // become fake CLIENT sessions → dashboard served a 403 "no permission" page to guests).
  void hintRole;
  return { ok: false, status: 401, error: 'جلسة غير صالحة' };
}

function requireAuth(req) {
  const session = resolveSession(req);
  if (!session.ok) {
    const err = new Error(session.error || 'Unauthorized');
    err.status = session.status || 401;
    throw err;
  }
  return session;
}

function requireStaff(req, permission = null) {
  const session = requireAuth(req);
  if (!isStaffLane(session.lane)) {
    const err = new Error('ليس لديك صلاحية للوصول إلى هذه الصفحة.');
    err.status = 403;
    throw err;
  }
  if (permission && !hasPermission(session, permission)) {
    const err = new Error('ليست لديك صلاحية هذه العملية');
    err.status = 403;
    throw err;
  }
  return session;
}

function requireClient(req) {
  const session = requireAuth(req);
  if (!isClientLane(session.lane)) {
    const err = new Error('هذه الواجهة مخصصة لحسابات العملاء');
    err.status = 403;
    throw err;
  }
  return session;
}

function postLoginDestination(role) {
  const lane = experienceLane(role);
  if (lane === 'CLIENT') return 'client.html';
  return 'dashboard.html';
}

function revokeRequestSession(req) {
  const token = parseAuthHeader(req) || String(req.headers['x-hub-token'] || '').trim();
  if (token) tokenRevoke.revokeToken(token);
  return !!token;
}

function publicSessionView(session) {
  if (!session?.ok) {
    return {
      ok: false,
      authenticated: false,
      error: session?.error || 'مطلوب تسجيل الدخول',
    };
  }
  return {
    ok: true,
    authenticated: true,
    email: session.email,
    role: session.role,
    lane: session.lane,
    name: session.name,
    userId: session.userId,
    customerId: session.customerId || null,
    employeeNo: session.employeeNo || null,
    experience: session.experience,
    permissions: session.permissions || [],
    mustChangePassword: !!session.mustChangePassword,
  };
}

module.exports = {
  STAFF_SESSION_ROLES,
  CLIENT_SESSION_ROLES,
  ROLE_LANE,
  SUPER_ADMIN_PERMISSIONS,
  ADMIN_DEFAULT_PERMISSIONS,
  DEMO_STAFF_BY_EMAIL,
  parseAuthHeader,
  sessionCookieHeader,
  clearSessionCookieHeader,
  decodeEmailFromToken,
  experienceLane,
  isStaffLane,
  isClientLane,
  permissionsFor,
  hasPermission,
  resolveSession,
  requireAuth,
  requireStaff,
  requireClient,
  postLoginDestination,
  revokeRequestSession,
  publicSessionView,
};
