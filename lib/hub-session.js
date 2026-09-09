/**
 * Hub session / RBAC helpers — verify opaque hub tokens and map roles.
 * Tokens are issued by customer-auth or demo/tenant login (hub360.*).
 * Server-side checks must use this module — never trust client role claims alone.
 */
'use strict';

const customerAuth = require('./hub-customer-auth');

const STAFF_SESSION_ROLES = new Set(['supreme_leader', 'chief_engineer', 'admin', 'super_admin']);
const CLIENT_SESSION_ROLES = new Set(['customer', 'client']);

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
  'systems.assign',
  'systems.remove',
  'orders.view',
  'orders.update',
  'subscriptions.view',
  'subscriptions.manage',
  'billing.view',
  'billing.manage',
  'wallet.view',
  'wallet.adjust',
  'support.view',
  'support.reply',
  'reports.view',
  'permissions.manage',
];

const ADMIN_DEFAULT_PERMISSIONS = [
  'clients.view',
  'clients.edit',
  'orders.view',
  'orders.update',
  'subscriptions.view',
  'billing.view',
  'wallet.view',
  'support.view',
  'support.reply',
  'reports.view',
];

function parseAuthHeader(req) {
  const raw = String(req.headers.authorization || req.headers.Authorization || '').trim();
  if (!raw) return '';
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : raw;
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
  // hub360.<btoa(email)>.<ts>
  const demo = t.match(/^hub360\.([^.]+)\./);
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

function experienceLane(role) {
  return ROLE_LANE[String(role || '').toLowerCase()] || 'CLIENT';
}

function isStaffLane(lane) {
  return lane === 'SUPER_ADMIN' || lane === 'ADMIN';
}

function isClientLane(lane) {
  return lane === 'CLIENT';
}

function permissionsFor(lane, role) {
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
function resolveSession(req) {
  const token = parseAuthHeader(req) || String(req.headers['x-hub-token'] || '').trim();
  if (!token) {
    return { ok: false, status: 401, error: 'مطلوب تسجيل الدخول' };
  }

  const email = decodeEmailFromToken(token);
  if (!email) {
    return { ok: false, status: 401, error: 'جلسة غير صالحة' };
  }

  // Prefer customer store
  const account = customerAuth.findByEmail?.(email) || null;
  if (account) {
    if (account.status && account.status !== 'active') {
      return { ok: false, status: 403, error: 'الحساب غير نشط' };
    }
    const role = 'customer';
    const lane = 'CLIENT';
    return {
      ok: true,
      token,
      email,
      role,
      lane,
      name: account.fullName || account.name || email,
      userId: account.id,
      permissions: [],
      account,
      experience: 'client',
    };
  }

  // Demo / staff tokens (no customer record)
  const hintRole = String(req.headers['x-hub-user-role'] || '').toLowerCase();
  let role = hintRole;
  if (!role) {
    if (email === 'leader@naiosh.com') role = 'supreme_leader';
    else if (email === 'malika@naiosh.com') role = 'chief_engineer';
    else if (email.startsWith('admin')) role = 'admin';
    else role = 'customer';
  }
  const lane = experienceLane(role);
  const name = String(req.headers['x-hub-user-name'] || '') || email;

  return {
    ok: true,
    token,
    email,
    role,
    lane,
    name,
    userId: email,
    permissions: permissionsFor(lane, role),
    account: null,
    experience: isClientLane(lane) ? 'client' : 'admin',
  };
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
    const err = new Error('غير مصرح — هذه واجهة إدارية');
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

module.exports = {
  STAFF_SESSION_ROLES,
  CLIENT_SESSION_ROLES,
  ROLE_LANE,
  SUPER_ADMIN_PERMISSIONS,
  ADMIN_DEFAULT_PERMISSIONS,
  parseAuthHeader,
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
};
