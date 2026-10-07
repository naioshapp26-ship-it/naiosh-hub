/**
 * Staff account APIs: profile, password change, forgot/reset, admin staff management.
 * Privilege escalation protection — Super Admin identity is protected.
 */
'use strict';

const hubSession = require('./hub-session');
const hubStaffAuth = require('./hub-staff-auth');
const staffCreds = require('./hub-staff-credentials');
const policy = require('./hub-password-policy');
const customerAuth = require('./hub-customer-auth');

const SUPER_ROLES = new Set(['supreme_leader', 'super_admin']);

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(Object.assign(new Error('JSON غير صالح'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function isSuperAdminSession(session) {
  return session?.ok && (session.lane === 'SUPER_ADMIN' || SUPER_ROLES.has(String(session.role || '').toLowerCase()));
}

function isProtectedSuperAdmin(email) {
  const e = staffCreds.normalizeEmail(email);
  return e === staffCreds.SUPER_ADMIN_EMAIL || e === 'leader@naiosh.com';
}

function canManageStaff(session) {
  return isSuperAdminSession(session) || hubSession.hasPermission(session, 'permissions.manage');
}

/**
 * @returns {Promise<boolean>} true if handled
 */
async function handle(req, res, url) {
  const pathname = url.pathname;

  // —— One-time Super Admin bootstrap (public only while SA has no hash) ——
  if (pathname === '/api/auth/bootstrap-super-admin' && req.method === 'POST') {
    const body = await readBody(req);
    const result = await staffCreds.bootstrapWithSetupCode({
      setupCode: body.setupCode || body.code,
      password: body.password || body.newPassword,
      confirmPassword: body.confirmPassword,
    });
    sendJson(res, result.status || (result.ok ? 200 : 400), {
      ok: !!result.ok,
      message: result.ok
        ? 'تم تهيئة حساب الإدارة. سجّلي الدخول ثم غيّري كلمة المرور من حسابي.'
        : undefined,
      error: result.ok ? undefined : result.error,
      email: result.ok ? result.email : undefined,
      employeeNo: result.ok ? result.employeeNo : undefined,
      mustChangePassword: result.ok ? !!result.mustChangePassword : undefined,
    });
    return true;
  }

  if (pathname === '/api/auth/bootstrap-status' && req.method === 'GET') {
    await staffCreds.hydrateFromDb();
    sendJson(res, 200, {
      ok: true,
      needsBootstrap: staffCreds.needsBootstrap(),
      email: staffCreds.SUPER_ADMIN_EMAIL,
    });
    return true;
  }

  // —— Forgot password (public) ——
  if (pathname === '/api/auth/forgot-password' && req.method === 'POST') {
    const body = await readBody(req);
    const email = staffCreds.normalizeEmail(body.email);
    // Uniform response — no email enumeration
    const staff = staffCreds.getCredential(email);
    const customer = customerAuth.findByEmail?.(email);
    let resetToken = null;
    let kind = null;
    if (staff) {
      const r = staffCreds.createResetToken(email);
      resetToken = r.token;
      kind = 'staff';
    } else if (customer) {
      // Customer reset tokens stored alongside staff store under cust: prefix
      const r = staffCreds.createResetToken(`cust:${email}`);
      // Also store under customer email for consume — use dedicated customer path
      resetToken = r.token;
      kind = 'customer';
      // Re-key: createResetToken for cust: — consume will use same
    }
    // In production without email service, expose token only when HUB_EXPOSE_RESET_TOKEN=1 (staging)
    const expose = String(process.env.HUB_EXPOSE_RESET_TOKEN || '') === '1';
    sendJson(res, 200, {
      ok: true,
      message: 'إذا كان البريد مسجّلاً، ستصلك تعليمات إعادة التعيين.',
      emailServiceConfigured: !!process.env.HUB_SMTP_URL || !!process.env.SENDGRID_API_KEY,
      ...(expose && resetToken ? { resetToken, kind, email } : {}),
    });
    return true;
  }

  if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
    const body = await readBody(req);
    const email = staffCreds.normalizeEmail(body.email);
    const token = String(body.token || body.resetToken || '');
    const newPassword = String(body.newPassword || body.password || '');
    const confirm = body.confirmPassword != null ? String(body.confirmPassword) : newPassword;
    if (newPassword !== confirm) {
      sendJson(res, 400, { ok: false, error: 'تأكيد كلمة المرور غير متطابق.' });
      return true;
    }
    const check = policy.analyze(newPassword);
    if (!check.ok) {
      sendJson(res, 400, { ok: false, error: check.error });
      return true;
    }

    // Staff path
    let result = await staffCreds.consumeResetToken(email, token, newPassword);
    if (result.ok) {
      sendJson(res, 200, { ok: true, message: result.message || 'تم تعيين كلمة المرور الجديدة.' });
      return true;
    }

    // Customer path — token keyed as cust:email
    const custConsume = staffCreds.consumeResetTokenOnly(`cust:${email}`, token);
    if (custConsume.ok) {
      const account = customerAuth.findByEmail(email);
      if (!account) {
        sendJson(res, 404, { ok: false, error: 'الحساب غير موجود' });
        return true;
      }
      const store = customerAuth.readStore();
      const row = (store.accounts || []).find((a) => staffCreds.normalizeEmail(a.email) === email);
      if (!row) {
        sendJson(res, 404, { ok: false, error: 'الحساب غير موجود' });
        return true;
      }
      row.passwordHash = await customerAuth.hashPassword(newPassword);
      row.passwordEpoch = Number(row.passwordEpoch || 0) + 1;
      row.updatedAt = new Date().toISOString();
      customerAuth.writeStore(store);
      sendJson(res, 200, { ok: true, message: 'تم تعيين كلمة المرور الجديدة.' });
      return true;
    }

    sendJson(res, 400, {
      ok: false,
      error: result.error || custConsume.error || 'رابط إعادة التعيين غير صالح أو منتهٍ.',
    });
    return true;
  }

  // —— Staff: my account ——
  if (pathname === '/api/admin/account' && req.method === 'GET') {
    const session = hubSession.resolveSession(req);
    if (!session.ok || !hubSession.isStaffLane(session.lane)) {
      sendJson(res, 403, { ok: false, error: 'غير مصرح' });
      return true;
    }
    const cred = staffCreds.getCredential(session.email) || {};
    sendJson(res, 200, {
      ok: true,
      account: {
        name: session.name,
        email: session.email,
        employeeNo: session.employeeNo,
        role: session.role,
        lane: session.lane,
        status: cred.active === false ? 'disabled' : 'active',
        permissions: session.permissions || [],
        mustChangePassword: !!session.mustChangePassword || !!cred.mustChangePassword,
        workplace: cred.workplace || '',
        phone: cred.phone || '',
      },
    });
    return true;
  }

  if (pathname === '/api/admin/account/password' && req.method === 'POST') {
    const session = hubSession.resolveSession(req);
    if (!session.ok || !hubSession.isStaffLane(session.lane)) {
      sendJson(res, 403, { ok: false, error: 'غير مصرح' });
      return true;
    }
    const body = await readBody(req);
    const result = await hubStaffAuth.changePassword({
      email: session.email,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      confirmPassword: body.confirmPassword,
      currentToken: session.token,
    });
    if (!result.ok) {
      sendJson(res, result.status || 400, { ok: false, error: result.error });
      return true;
    }
    sendJson(
      res,
      200,
      {
        ok: true,
        message: result.message,
        token: result.token,
        user: result.user,
      },
      result.token ? { 'Set-Cookie': hubSession.sessionCookieHeader(result.token) } : {}
    );
    return true;
  }

  // —— Admin staff management ——
  if (pathname === '/api/admin/staff' && req.method === 'GET') {
    const session = hubSession.resolveSession(req);
    if (!canManageStaff(session)) {
      sendJson(res, 403, { ok: false, error: 'غير مصرح' });
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      staff: staffCreds.listStaff(),
      permissionCatalog: hubSession.SUPER_ADMIN_PERMISSIONS,
      roles: [
        { code: 'supreme_leader', label: 'القائد الأعلى / Super Admin', lane: 'SUPER_ADMIN' },
        { code: 'chief_engineer', label: 'مهندس رئيس / Admin', lane: 'ADMIN' },
        { code: 'admin', label: 'إداري', lane: 'ADMIN' },
      ],
    });
    return true;
  }

  if (pathname === '/api/admin/staff' && req.method === 'POST') {
    const session = hubSession.resolveSession(req);
    if (!canManageStaff(session)) {
      sendJson(res, 403, { ok: false, error: 'غير مصرح' });
      return true;
    }
    const body = await readBody(req);
    const email = staffCreds.normalizeEmail(body.email);
    const name = String(body.name || '').trim();
    const role = String(body.role || 'admin').toLowerCase();
    const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : null;

    if (!email || !name) {
      sendJson(res, 400, { ok: false, error: 'الاسم والبريد مطلوبان.' });
      return true;
    }
    if (SUPER_ROLES.has(role) && !isSuperAdminSession(session)) {
      sendJson(res, 403, { ok: false, error: 'لا يمكن منح دور القائد الأعلى.' });
      return true;
    }
    if (permissions?.includes('permissions.manage') && !isSuperAdminSession(session)) {
      sendJson(res, 403, { ok: false, error: 'لا يمكن منح صلاحية إدارة الصلاحيات.' });
      return true;
    }
    if (staffCreds.getCredential(email) || hubSession.DEMO_STAFF_BY_EMAIL[email]) {
      sendJson(res, 409, { ok: false, error: 'هذا البريد مسجّل بالفعل كإداري.' });
      return true;
    }

    const tempPassword = String(body.temporaryPassword || '');
    const check = policy.analyze(tempPassword || 'x'.repeat(policy.MIN_LEN));
    if (!tempPassword || !check.ok) {
      sendJson(res, 400, {
        ok: false,
        error: tempPassword ? check.error : 'كلمة مرور مؤقتة مطلوبة للإداري الجديد.',
      });
      return true;
    }

    const employeeNo = staffCreds.nextEmployeeNo();
    const passwordHash = await staffCreds.hashPassword(tempPassword);
    const row = staffCreds.upsertStaff({
      email,
      name,
      employeeNo,
      role,
      permissions,
      active: true,
      phone: String(body.phone || ''),
      workplace: String(body.workplace || body.entity_name || ''),
      passwordHash,
      mustChangePassword: true,
    });
    staffCreds.audit('ADMIN_CREATED', {
      actorEmail: session.email,
      actorEmployeeNo: session.employeeNo,
      targetEmail: email,
      targetEmployeeNo: employeeNo,
      detail: `role=${role}`,
    });
    sendJson(res, 201, {
      ok: true,
      message: 'تم إنشاء الإداري. يجب عليه تغيير كلمة المرور عند أول دخول.',
      staff: {
        email: row.email,
        name: row.name,
        employeeNo: row.employeeNo,
        role: row.role,
        permissions: row.permissions,
        active: row.active,
        mustChangePassword: true,
      },
      // Temporary password returned once to Super Admin only (not logged)
      temporaryPassword: tempPassword,
    });
    return true;
  }

  // PATCH /api/admin/staff/:email
  const staffMatch = pathname.match(/^\/api\/admin\/staff\/([^/]+)(?:\/(disable|enable|permissions|role))?$/);
  if (staffMatch && ['PUT', 'PATCH', 'POST'].includes(req.method)) {
    const session = hubSession.resolveSession(req);
    if (!canManageStaff(session)) {
      sendJson(res, 403, { ok: false, error: 'غير مصرح' });
      return true;
    }
    const targetEmail = staffCreds.normalizeEmail(decodeURIComponent(staffMatch[1]));
    const action = staffMatch[2] || 'update';
    const body = await readBody(req);
    const target = staffCreds.getCredential(targetEmail);
    if (!target && !hubSession.DEMO_STAFF_BY_EMAIL[targetEmail]) {
      sendJson(res, 404, { ok: false, error: 'الإداري غير موجود' });
      return true;
    }

    if (isProtectedSuperAdmin(targetEmail) && !isSuperAdminSession(session)) {
      sendJson(res, 403, { ok: false, error: 'لا يمكن تعديل حساب القائد الأعلى.' });
      return true;
    }
    // Even Super Admin: block lower admins acting as — already checked.
    // Prevent non-super from disabling super
    if (isProtectedSuperAdmin(targetEmail) && (action === 'disable' || body.active === false)) {
      if (staffCreds.normalizeEmail(session.email) !== staffCreds.SUPER_ADMIN_EMAIL) {
        sendJson(res, 403, { ok: false, error: 'لا يمكن تعطيل حساب القائد الأعلى.' });
        return true;
      }
    }
    if (isProtectedSuperAdmin(targetEmail) && (action === 'role' || body.role)) {
      const newRole = String(body.role || '').toLowerCase();
      if (newRole && !SUPER_ROLES.has(newRole)) {
        sendJson(res, 403, { ok: false, error: 'لا يمكن سحب دور القائد الأعلى.' });
        return true;
      }
    }
    if (isProtectedSuperAdmin(targetEmail) && action === 'permissions') {
      sendJson(res, 403, { ok: false, error: 'صلاحيات القائد الأعلى غير قابلة للسحب.' });
      return true;
    }
    if (isProtectedSuperAdmin(targetEmail) && body.email && staffCreds.normalizeEmail(body.email) !== targetEmail) {
      sendJson(res, 403, { ok: false, error: 'لا يمكن تغيير بريد القائد الأعلى من هذه الواجهة.' });
      return true;
    }

    if (action === 'disable') {
      staffCreds.upsertStaff({ ...target, email: targetEmail, active: false });
      staffCreds.bumpEpoch(targetEmail);
      staffCreds.audit('ADMIN_DISABLED', {
        actorEmail: session.email,
        actorEmployeeNo: session.employeeNo,
        targetEmail,
        targetEmployeeNo: target?.employeeNo,
      });
      sendJson(res, 200, { ok: true, message: 'تم تعطيل الحساب.' });
      return true;
    }
    if (action === 'enable') {
      staffCreds.upsertStaff({ ...target, email: targetEmail, active: true });
      staffCreds.audit('ADMIN_ENABLED', {
        actorEmail: session.email,
        actorEmployeeNo: session.employeeNo,
        targetEmail,
        targetEmployeeNo: target?.employeeNo,
      });
      sendJson(res, 200, { ok: true, message: 'تم إعادة تفعيل الحساب.' });
      return true;
    }
    if (action === 'permissions') {
      const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : [];
      if (permissions.includes('permissions.manage') && !isSuperAdminSession(session)) {
        sendJson(res, 403, { ok: false, error: 'لا يمكن منح صلاحية إدارة الصلاحيات.' });
        return true;
      }
      staffCreds.upsertStaff({ ...target, email: targetEmail, permissions });
      staffCreds.bumpEpoch(targetEmail); // force re-auth so old session loses perms
      staffCreds.audit('ADMIN_PERMISSIONS_UPDATED', {
        actorEmail: session.email,
        actorEmployeeNo: session.employeeNo,
        targetEmail,
        targetEmployeeNo: target?.employeeNo,
        detail: `count=${permissions.length}`,
      });
      sendJson(res, 200, { ok: true, message: 'تم تحديث الصلاحيات.', permissions });
      return true;
    }
    if (action === 'role') {
      const role = String(body.role || '').toLowerCase();
      if (SUPER_ROLES.has(role) && !isSuperAdminSession(session)) {
        sendJson(res, 403, { ok: false, error: 'لا يمكن منح دور القائد الأعلى.' });
        return true;
      }
      staffCreds.upsertStaff({ ...target, email: targetEmail, role });
      staffCreds.bumpEpoch(targetEmail);
      staffCreds.audit('ADMIN_ROLE_CHANGED', {
        actorEmail: session.email,
        actorEmployeeNo: session.employeeNo,
        targetEmail,
        targetEmployeeNo: target?.employeeNo,
        detail: `role=${role}`,
      });
      sendJson(res, 200, { ok: true, message: 'تم تحديث الدور.', role });
      return true;
    }

    // generic update
    staffCreds.upsertStaff({
      ...target,
      email: targetEmail,
      name: body.name != null ? String(body.name) : target?.name,
      phone: body.phone != null ? String(body.phone) : target?.phone,
      workplace: body.workplace != null ? String(body.workplace) : target?.workplace,
      active: body.active != null ? !!body.active : target?.active,
    });
    staffCreds.audit('ADMIN_UPDATED', {
      actorEmail: session.email,
      actorEmployeeNo: session.employeeNo,
      targetEmail,
      targetEmployeeNo: target?.employeeNo,
    });
    sendJson(res, 200, { ok: true, message: 'تم التحديث.' });
    return true;
  }

  if (pathname === '/api/admin/staff/audit' && req.method === 'GET') {
    const session = hubSession.resolveSession(req);
    if (!canManageStaff(session)) {
      sendJson(res, 403, { ok: false, error: 'غير مصرح' });
      return true;
    }
    sendJson(res, 200, { ok: true, audit: staffCreds.getAudit(200) });
    return true;
  }

  return false;
}

module.exports = { handle, isProtectedSuperAdmin, canManageStaff };
