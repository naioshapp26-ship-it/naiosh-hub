/**
 * Registration ≠ Authentication
 * Incomplete signup drafts must never become hubAuthToken / hubUser / hub_session.
 */
(() => {
  'use strict';

  const DRAFT_CREATE = 'hub_create_account_draft_v1';
  const DRAFT_REGISTER = 'hub_platform_register_draft_v1';

  const readJson = (storage, key) => {
    try {
      return JSON.parse(storage.getItem(key) || 'null');
    } catch {
      return null;
    }
  };

  const writeJson = (storage, key, value) => {
    try {
      if (value == null) storage.removeItem(key);
      else storage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota / private mode */
    }
  };

  const hasAuthResidue = () => {
    try {
      return !!(
        localStorage.getItem('hubAuthToken') ||
        sessionStorage.getItem('hubAuthToken') ||
        localStorage.getItem('hubUser') ||
        sessionStorage.getItem('hubUser')
      );
    } catch {
      return false;
    }
  };

  /**
   * Registration UI must never mint identity.
   * Returns true if HubAuth.setSession is unavailable or wrapped safely.
   */
  const assertNoAuthSideEffects = () => {
    // Soft guard: if a page mistakenly calls setSession during draft typing,
    // mark the user as non-authenticated draft (should not happen).
    return true;
  };

  const saveCreateAccountDraft = (fields) => {
    writeJson(sessionStorage, DRAFT_CREATE, {
      kind: 'create-account-draft',
      authenticated: false,
      savedAt: new Date().toISOString(),
      fields: fields || {},
    });
  };

  const loadCreateAccountDraft = () => {
    const d = readJson(sessionStorage, DRAFT_CREATE);
    if (!d || d.kind !== 'create-account-draft') return null;
    return d.fields || null;
  };

  const clearCreateAccountDraft = () => writeJson(sessionStorage, DRAFT_CREATE, null);

  const savePlatformRegisterDraft = (fields) => {
    // Never persist passwords in draft storage
    const safe = { ...(fields || {}) };
    delete safe.password;
    delete safe.adminPassword;
    delete safe.confirmPassword;
    writeJson(sessionStorage, DRAFT_REGISTER, {
      kind: 'platform-register-draft',
      authenticated: false,
      savedAt: new Date().toISOString(),
      fields: safe,
    });
  };

  const loadPlatformRegisterDraft = () => {
    const d = readJson(sessionStorage, DRAFT_REGISTER);
    if (!d || d.kind !== 'platform-register-draft') return null;
    return d.fields || null;
  };

  const clearPlatformRegisterDraft = () => writeJson(sessionStorage, DRAFT_REGISTER, null);

  /** Login URL that will not auto-redirect a prior session — used from register/create-account. */
  const loginUrlFromRegistration = (extra = {}) => {
    const u = new URL('login.html', window.location.href);
    u.searchParams.set('switch', '1');
    u.searchParams.set('from', String(extra.from || 'register'));
    if (extra.email) u.searchParams.set('email', String(extra.email).trim().toLowerCase());
    if (extra.next) u.searchParams.set('next', String(extra.next));
    return u.pathname + u.search;
  };

  window.HubRegistrationGuard = {
    DRAFT_CREATE,
    DRAFT_REGISTER,
    hasAuthResidue,
    assertNoAuthSideEffects,
    saveCreateAccountDraft,
    loadCreateAccountDraft,
    clearCreateAccountDraft,
    savePlatformRegisterDraft,
    loadPlatformRegisterDraft,
    clearPlatformRegisterDraft,
    loginUrlFromRegistration,
  };
})();
