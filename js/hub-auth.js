/**
 * NAIOSH ID — جلسة موحّدة (SSO) عبر هوب والأنظمة
 */
(() => {
  const TOKEN_KEY = 'hubAuthToken';
  const USER_KEY = 'hubUser';

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

  const isStaff = (user = getUser()) => {
    const role = user?.role || '';
    return role === 'supreme_leader' || role === 'chief_engineer' || role === 'admin';
  };

  const setSession = (user, token, { remember = true } = {}) => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY, token);
    storage.setItem(USER_KEY, JSON.stringify(user));
    window.HubStore?.recordActivity?.('auth', `تسجيل دخول: ${user.name || user.email}`, {
      email: user.email,
      role: user.role,
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

  const requireLogin = ({ next = '', system = '' } = {}) => {
    if (isLoggedIn()) return true;
    window.location.href = loginUrl({
      next: next || `${window.location.pathname}${window.location.search}${window.location.hash}`,
      system,
    });
    return false;
  };

  /** هل يملك المستخدم صلاحية على النظام */
  const canAccessSystem = (systemCode, minPermission = 'read') => {
    if (!isLoggedIn()) return { ok: false, reason: 'login' };
    const user = getUser();
    if (isStaff(user)) return { ok: true, reason: 'staff', permissions: ['read', 'write', 'admin'] };
    const check = window.HubStore?.checkEntitlement?.(user.email, systemCode, minPermission);
    if (check?.ok) return check;
    return { ok: false, reason: 'subscription', permissions: [] };
  };

  const attachSsoParams = (url, systemCode = '') => {
    try {
      const u = new URL(url, window.location.href);
      const token = getToken();
      const user = getUser();
      if (token) u.searchParams.set('sso', token);
      if (user?.email) u.searchParams.set('hubUser', user.email);
      if (systemCode) u.searchParams.set('system', String(systemCode).toUpperCase());
      const ent = canAccessSystem(systemCode);
      if (ent.ok && ent.permissions?.length) {
        u.searchParams.set('perms', ent.permissions.join(','));
      }
      return u.pathname + u.search + u.hash;
    } catch (_) {
      return url;
    }
  };

  window.HubAuth = {
    TOKEN_KEY,
    USER_KEY,
    getToken,
    getUser,
    isLoggedIn,
    isStaff,
    setSession,
    clearSession,
    loginUrl,
    requireLogin,
    canAccessSystem,
    attachSsoParams,
    storageOf,
  };
})();
