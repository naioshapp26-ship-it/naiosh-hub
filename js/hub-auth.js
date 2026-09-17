/**
 * NAIOSH ID — جلسة موحّدة + بوابة وصول (عميل ≠ موظف ≠ إدارة)
 */
(() => {
  'use strict';

  const TOKEN_KEY = 'hubAuthToken';
  const USER_KEY = 'hubUser';

  const STAFF_ROLES = new Set(['supreme_leader', 'chief_engineer', 'admin', 'super_admin']);
  const CLIENT_ROLES = new Set(['customer', 'client', 'client_user', 'platform_owner']);

  const storageOf = () => {
    if (localStorage.getItem(TOKEN_KEY)) return localStorage;
    if (sessionStorage.getItem(TOKEN_KEY)) return sessionStorage;
    return null;
  };

  const getToken = () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';

  const getUser = () => {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  };

  const isLoggedIn = () => !!(getToken() && getUser());

  const roleOf = (user = getUser()) => String(user?.role || '').toLowerCase();

  const isStaff = (user = getUser()) => STAFF_ROLES.has(roleOf(user));

  const isClient = (user = getUser()) => CLIENT_ROLES.has(roleOf(user));

  /** موظف تشغيلي مسجّل في حوكمة الوصول (رقم موظف + STAFF) */
  const getEmployeeRecord = (user = getUser()) => {
    if (!user || !window.HubAccessGov?.findIdentity) return null;
    try {
      const id =
        window.HubAccessGov.findIdentity(user.employeeNo) ||
        window.HubAccessGov.findIdentity(user.naioshId) ||
        window.HubAccessGov.findIdentity(user.email) ||
        window.HubAccessGov.findIdentity(user.id);
      if (!id) return null;
      if (window.HubAccessGov.isEmployeeIdentity?.(id) || (id.userType === 'STAFF' && id.employeeNo)) {
        return id;
      }
      return null;
    } catch (_) {
      return null;
    }
  };

  const isRegisteredEmployee = (user = getUser()) => !!getEmployeeRecord(user);

  /**
   * هل يحق لهذا الحساب فتح لوحة الإدارة؟
   * - أدوار تشغيل تقليدية (قائد/مهندس/أدمن)
   * - أو موظف مسجّل برقم موظف في AG
   * العملاء ممنوعون دائمًا.
   */
  const canAccessDashboard = (user = getUser()) => {
    if (!user) return { ok: false, reason: 'login', message: 'يرجى تسجيل الدخول للمتابعة' };
    if (isClient(user) && !isStaff(user)) {
      // عميل صريح — حتى لو وُجد له رقم موظف لاحقًا عبر تعيين، نسمح إن كان موظفًا فعليًا
      if (isRegisteredEmployee(user)) {
        return { ok: true, reason: 'employee', employee: getEmployeeRecord(user) };
      }
      return {
        ok: false,
        reason: 'customer',
        message: 'ليس لديك صلاحية للوصول إلى هذه الصفحة.',
        redirect: 'client.html',
      };
    }
    if (isStaff(user)) return { ok: true, reason: 'legacy-staff' };
    if (isRegisteredEmployee(user)) {
      return { ok: true, reason: 'employee', employee: getEmployeeRecord(user) };
    }
    return {
      ok: false,
      reason: 'not-employee',
      message: 'ليس لديك صلاحية للوصول إلى هذه الصفحة. يلزم تعيينك كموظف أولًا.',
      redirect: 'client.html',
    };
  };

  const postLoginDestination = (user = getUser()) => {
    if (isStaff(user)) return 'dashboard.html';
    if (isRegisteredEmployee(user)) return 'dashboard.html';
    if (isClient(user)) {
      if (roleOf(user) === 'platform_owner') return 'my-platform.html';
      return 'client.html';
    }
    return 'client.html';
  };

  const setSession = (user, token, { remember = true } = {}) => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    const storage = remember ? localStorage : sessionStorage;
    // اربط رقم الموظف إن وُجد في AG
    try {
      const emp = getEmployeeRecord(user) || (window.HubAccessGov?.findIdentity?.(user?.email) && null);
      const id =
        window.HubAccessGov?.findIdentity?.(user?.email) ||
        window.HubAccessGov?.findIdentity?.(user?.naioshId) ||
        null;
      if (id?.employeeNo && id.userType === 'STAFF') {
        user = { ...user, employeeNo: id.employeeNo, naioshId: id.naioshId || user.naioshId };
      }
    } catch (_) {}
    storage.setItem(TOKEN_KEY, token);
    storage.setItem(USER_KEY, JSON.stringify(user));
    window.HubStore?.recordActivity?.('auth', `تسجيل دخول: ${user.name || user.email}`, {
      email: user.email,
      role: user.role,
      employeeNo: user.employeeNo || null,
    });
  };

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  };

  const loginUrl = ({ next = '', system = '' } = {}) => {
    const u = new URL('login.html', window.location.href);
    if (next) u.searchParams.set('next', next);
    if (system) u.searchParams.set('system', system);
    return u.pathname + u.search;
  };

  const requireLogin = ({ next = '', system = '', message = 'يرجى تسجيل الدخول للمتابعة' } = {}) => {
    if (isLoggedIn()) return true;
    try {
      sessionStorage.setItem('hubAuthFlash', message);
    } catch (_) {}
    window.location.href = loginUrl({
      next: next || `${window.location.pathname}${window.location.search}${window.location.hash}`,
      system,
    });
    return false;
  };

  /** حارس لعمليات الزائر المحمية — لا يغيّر الصفحة إن مرّرت onDenied */
  const showGuestGate = ({ message = 'يرجى تسجيل الدخول للمتابعة', next = '' } = {}) => {
    const href = loginUrl({
      next: next || `${window.location.pathname}${window.location.search}${window.location.hash}`,
    });
    try {
      sessionStorage.setItem('hubAuthFlash', message);
    } catch (_) {}
    let modal = document.getElementById('hub-guest-gate-modal');
    if (!modal && typeof document !== 'undefined') {
      modal = document.createElement('div');
      modal.id = 'hub-guest-gate-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML =
        '<div class="hub-guest-gate-backdrop" data-guest-close="1"></div>' +
        '<div class="hub-guest-gate-card">' +
        '<p class="hub-guest-gate-msg"></p>' +
        '<div class="hub-guest-gate-actions">' +
        '<a class="btn btn-primary hub-guest-gate-login" href="#">تسجيل الدخول</a>' +
        '<button type="button" class="btn btn-ghost" data-guest-close="1">إغلاق</button>' +
        '</div></div>';
      if (!document.getElementById('hub-guest-gate-style')) {
        const st = document.createElement('style');
        st.id = 'hub-guest-gate-style';
        st.textContent =
          '#hub-guest-gate-modal{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;font-family:inherit}' +
          '#hub-guest-gate-modal[hidden]{display:none!important}' +
          '.hub-guest-gate-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.45)}' +
          '.hub-guest-gate-card{position:relative;background:#fff;color:#111;border-radius:12px;padding:22px 24px;max-width:420px;width:92%;box-shadow:0 18px 50px rgba(0,0,0,.25);text-align:center;direction:rtl}' +
          '.hub-guest-gate-msg{margin:0 0 16px;font-size:1.05rem;line-height:1.6}' +
          '.hub-guest-gate-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}';
        document.head.appendChild(st);
      }
      modal.addEventListener('click', (e) => {
        if (e.target && e.target.getAttribute && e.target.getAttribute('data-guest-close')) {
          modal.hidden = true;
        }
      });
      document.body.appendChild(modal);
    }
    if (modal) {
      const msg = modal.querySelector('.hub-guest-gate-msg');
      if (msg) msg.textContent = message;
      const a = modal.querySelector('.hub-guest-gate-login');
      if (a) a.href = href;
      modal.hidden = false;
      return false;
    }
    window.location.href = href;
    return false;
  };

  const guardGuestAction = ({ onDenied, useModal = true } = {}) => {
    if (isLoggedIn()) return true;
    const payload = {
      message: 'يرجى تسجيل الدخول للمتابعة',
      loginUrl: loginUrl({ next: `${window.location.pathname}${window.location.search}${window.location.hash}` }),
    };
    if (typeof onDenied === 'function') {
      onDenied(payload);
      return false;
    }
    if (useModal) return showGuestGate(payload);
    return requireLogin({ message: payload.message });
  };

  const canAccessSystem = (systemCode, minPermission = 'read') => {
    if (!isLoggedIn()) return { ok: false, reason: 'login' };
    const user = getUser();
    if (isStaff(user) || isRegisteredEmployee(user)) {
      return { ok: true, reason: 'staff', permissions: ['read', 'write', 'admin'] };
    }
    const check = window.HubStore?.checkEntitlement?.(user.email, systemCode, minPermission);
    if (check?.ok) return check;
    try {
      const code = String(systemCode || '').toUpperCase();
      const mine = window.HubRentStore?.listMine?.(user.email) || [];
      const hit = mine.find((r) => r.status === 'active' && (r.systems || []).includes(code));
      if (hit) return { ok: true, reason: 'hub-rental', permissions: ['read', 'write'], rentalId: hit.id };
    } catch {
      /* ignore */
    }
    return { ok: false, reason: 'subscription', permissions: [] };
  };

  const attachSsoParams = (url, systemCode = '', extra = {}) => {
    try {
      const u = new URL(url, window.location.href);
      const token = getToken();
      const user = getUser();
      if (token) u.searchParams.set('sso', token);
      if (user?.email) u.searchParams.set('hubUser', user.email);
      if (user?.name) u.searchParams.set('hubName', user.name);
      if (systemCode) u.searchParams.set('system', String(systemCode).toUpperCase());
      const ent = canAccessSystem(systemCode);
      if (ent.ok && ent.permissions?.length) {
        u.searchParams.set('perms', ent.permissions.join(','));
      }
      if (extra.tenant) u.searchParams.set('tenant', String(extra.tenant).toLowerCase());
      if (extra.subdomain) u.searchParams.set('subdomain', String(extra.subdomain).toLowerCase());
      if (extra.hubTicket) u.searchParams.set('hubTicket', String(extra.hubTicket));
      if (extra.hubSig) u.searchParams.set('hubSig', String(extra.hubSig));
      u.searchParams.set('from', extra.from || 'hub');
      u.searchParams.set('hubOrigin', window.location.origin);
      if (u.origin !== window.location.origin) return u.toString();
      return u.pathname + u.search + u.hash;
    } catch (_) {
      return url;
    }
  };

  const issueHubTicket = async (payload = {}) => {
    try {
      const res = await fetch('/api/hub/sso/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (error) {
      return { ok: false, error: error.message || 'تعذّر إصدار تذكرة SSO' };
    }
  };

  const requireStaff = ({ next = '' } = {}) => {
    if (!requireLogin({ next })) return false;
    const gate = canAccessDashboard();
    if (gate.ok) return true;
    window.location.href = gate.redirect || 'client.html';
    return false;
  };

  const requireClient = ({ next = '' } = {}) => {
    if (!requireLogin({ next: next || 'client.html' })) return false;
    if (isClient()) return true;
    if (isStaff() || isRegisteredEmployee()) {
      window.location.href = 'dashboard.html';
      return false;
    }
    window.location.href = 'login.html';
    return false;
  };

  /** عزل بيانات العميل — هل المورد يخص هذا الحساب؟ */
  const ownsResource = (resource, user = getUser()) => {
    if (!user || !resource) return false;
    const email = String(user.email || '').toLowerCase();
    const id = String(user.id || user.naioshId || '');
    const candidates = [
      resource.ownerEmail,
      resource.email,
      resource.customerEmail,
      resource.userEmail,
      resource.createdByEmail,
      resource.ownerId,
      resource.customerId,
      resource.userId,
      resource.owner,
    ]
      .filter(Boolean)
      .map((x) => String(x).toLowerCase());
    if (email && candidates.includes(email)) return true;
    if (id && candidates.includes(String(id).toLowerCase())) return true;
    return false;
  };

  const assertOwnsOrDeny = (resource, user = getUser()) => {
    if (isStaff(user) || isRegisteredEmployee(user)) return { ok: true, reason: 'staff' };
    if (ownsResource(resource, user)) return { ok: true, reason: 'owner' };
    return { ok: false, reason: 'isolation', message: 'ليس لديك صلاحية للوصول إلى هذه البيانات.' };
  };

  window.HubAuth = {
    TOKEN_KEY,
    USER_KEY,
    getToken,
    getUser,
    isLoggedIn,
    isStaff,
    isClient,
    isRegisteredEmployee,
    getEmployeeRecord,
    canAccessDashboard,
    postLoginDestination,
    setSession,
    clearSession,
    loginUrl,
    requireLogin,
    requireStaff,
    requireClient,
    guardGuestAction,
    showGuestGate,
    canAccessSystem,
    attachSsoParams,
    issueHubTicket,
    ownsResource,
    assertOwnsOrDeny,
    storageOf,
  };
})();
