/**
 * Production login — server authentication only.
 * No demo users, quick login, or client-side password checks.
 */
(() => {
  const loginForm = document.getElementById('loginForm');
  const alertMessage = document.getElementById('alertMessage');
  const loginBtn = document.getElementById('loginBtn');
  const btnText = loginBtn?.querySelector('.btn-text');
  const loadingSpinner = loginBtn?.querySelector('.loading-spinner');
  const passwordInput = document.getElementById('password');
  const togglePasswordBtn = document.getElementById('togglePassword');
  const togglePasswordIcon = document.getElementById('togglePasswordIcon');

  togglePasswordBtn?.addEventListener('click', () => {
    if (!passwordInput || !togglePasswordIcon) return;
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    togglePasswordIcon.className = isHidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    togglePasswordBtn.setAttribute('aria-pressed', String(isHidden));
    togglePasswordBtn.setAttribute('aria-label', isHidden ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
    passwordInput.focus();
  });

  function showAlert(message, type = 'error') {
    if (!alertMessage) return;
    alertMessage.classList.remove(
      'hidden',
      'bg-red-50',
      'text-red-700',
      'border-red-200',
      'bg-black',
      'text-white',
      'border-black'
    );
    if (type === 'error') {
      alertMessage.classList.add('bg-red-50', 'text-red-700', 'border-red-200');
      alertMessage.innerHTML = `<i class="fa-solid fa-circle-exclamation ml-2"></i>${message}`;
    } else {
      alertMessage.classList.add('bg-black', 'text-white', 'border-black');
      alertMessage.innerHTML = `<i class="fa-solid fa-check-circle ml-2"></i>${message}`;
    }
    setTimeout(() => alertMessage.classList.add('hidden'), 4000);
  }

  function setLoading(isLoading) {
    if (!loginBtn || !btnText || !loadingSpinner) return;
    loginBtn.disabled = isLoading;
    loginBtn.classList.toggle('opacity-75', isLoading);
    loginBtn.classList.toggle('cursor-not-allowed', isLoading);
    btnText.classList.toggle('hidden', isLoading);
    loadingSpinner.classList.toggle('hidden', !isLoading);
  }

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('email')?.value.trim().toLowerCase() || '';
    const password = document.getElementById('password')?.value || '';
    const rememberMe = document.getElementById('rememberMe')?.checked;

    if (!email || !password) {
      showAlert('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setLoading(true);
    const withTimeout = (promise, ms, fallback = null) =>
      Promise.race([
        Promise.resolve(promise).catch(() => fallback),
        new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
      ]);

    // End any prior identity before accepting a new login.
    if (window.HubAuth?.clearSessionAsync) {
      await withTimeout(window.HubAuth.clearSessionAsync(), 5000, null);
    } else if (window.HubAuth?.clearSession) {
      window.HubAuth.clearSession();
    }
    await withTimeout(window.HubPlatformGrants?.hydrate?.(), 4000, null);
    await new Promise((resolve) => setTimeout(resolve, 120));

    let authPayload = null;
    let tenantUser = null;
    try {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 12000) : null;
      const authRes = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: ctrl?.signal,
      });
      if (timer) clearTimeout(timer);
      authPayload = await authRes.json().catch(() => ({}));
      authPayload = { ...authPayload, httpStatus: authRes.status };
    } catch {
      authPayload = null;
    }

    try {
      const res = await fetch('/api/hub/tenant-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.ok && data?.user) tenantUser = data.user;
    } catch {
      /* offline tenant path optional */
    }

    let user = null;
    let token = '';
    const serverOk = !!(authPayload?.ok && authPayload?.user && authPayload?.token);
    const serverRole = String(authPayload?.user?.role || '').toLowerCase();
    const serverIsStaff = ['supreme_leader', 'chief_engineer', 'admin', 'super_admin'].includes(serverRole);

    if (serverOk && serverIsStaff) {
      user = {
        email: authPayload.user.email || email,
        name: authPayload.user.name || email,
        role: authPayload.user.role,
        platform: authPayload.user.platform || 'naiosh-hub-360',
        employeeNo: authPayload.user.employeeNo || authPayload.employeeNo || null,
        naioshId: authPayload.user.naioshId || null,
        status: authPayload.user.status || 'active',
        mustChangePassword: !!authPayload.mustChangePassword || !!authPayload.user?.mustChangePassword,
      };
      token = authPayload.token;
    } else if (serverOk && !serverIsStaff) {
      user = {
        email: authPayload.user.email,
        name: authPayload.user.name || authPayload.user.fullName || email,
        fullName: authPayload.user.fullName || authPayload.user.name,
        username: authPayload.user.username,
        phone: authPayload.user.phone,
        role: 'customer',
        platform: authPayload.user.platform || 'naiosh-hub-360',
        id: authPayload.user.id,
        customerId: authPayload.user.customerId || authPayload.user.clientId || authPayload.user.id,
        clientId: authPayload.user.clientId || authPayload.user.customerId || '',
      };
      delete user.employeeNo;
      token = authPayload.token;
    } else if (tenantUser) {
      // Tenant platform owners only — server-validated tenant-login payload
      user = tenantUser;
      token = authPayload?.token || `hub360.${btoa(email)}.${Date.now()}`;
    } else {
      const errMsg =
        (authPayload && !authPayload.ok && (authPayload.error || authPayload.message)) ||
        'بيانات الدخول غير صحيحة.';
      showAlert(errMsg);
      if (authPayload?.needsBootstrap || /غير مهيأ|bootstrap/i.test(String(errMsg))) {
        setTimeout(() => {
          if (alertMessage && !alertMessage.querySelector('[data-bootstrap-link]')) {
            const a = document.createElement('a');
            a.href = 'admin-bootstrap.html';
            a.dataset.bootstrapLink = '1';
            a.className = 'block mt-2 underline font-bold';
            a.textContent = 'افتح صفحة تهيئة حساب الإدارة';
            alertMessage.appendChild(a);
          }
        }, 50);
      }
      setLoading(false);
      return;
    }

    if (window.HubAuth?.setSession) {
      window.HubAuth.setSession(user, token, { remember: !!rememberMe });
    } else {
      localStorage.removeItem('hubAuthToken');
      localStorage.removeItem('hubUser');
      sessionStorage.removeItem('hubAuthToken');
      sessionStorage.removeItem('hubUser');
      const isStaffRole = ['supreme_leader', 'chief_engineer', 'admin', 'super_admin'].includes(
        String(user.role || '').toLowerCase()
      );
      const storage = isStaffRole || rememberMe ? localStorage : sessionStorage;
      storage.setItem('hubAuthToken', token);
      storage.setItem('hubUser', JSON.stringify(user));
    }

    const params = new URLSearchParams(window.location.search);
    const next = params.get('next') || '';
    const system = (params.get('system') || '').toUpperCase();
    const role = String(user.role || '').toLowerCase();
    const destGate = window.HubAuth?.canAccessDashboard?.(user);
    const isStaff =
      role === 'supreme_leader' || role === 'chief_engineer' || role === 'admin' || role === 'super_admin';
    const isClientRole =
      role === 'customer' || role === 'client' || role === 'client_user' || role === 'platform_owner';
    let dest = 'client.html';
    if (destGate?.ok || isStaff) {
      dest = user.mustChangePassword ? 'dashboard.html#my-account' : 'dashboard.html';
    } else if (isClientRole) dest = role === 'platform_owner' ? 'my-platform.html' : 'client.html';

    const isSafePublicNext = (n) => {
      if (!n || n.startsWith('http') || n.includes('://') || n.includes('..')) return false;
      if (/dashboard\.html/i.test(n)) return false;
      return /^[a-zA-Z0-9_\-./?#=&%]+$/.test(n);
    };
    if (isClientRole && !(destGate?.ok)) {
      if (next && isSafePublicNext(next)) {
        dest = next;
      } else if (role === 'platform_owner' && (!next || next === 'my-platform.html')) {
        dest = next || 'my-platform.html';
      } else {
        dest = 'client.html';
      }
    } else if (next && !next.startsWith('http') && !next.includes('://')) {
      if ((isStaff || destGate?.ok) && /^client\.html/i.test(next)) {
        dest = 'dashboard.html';
      } else if (isClientRole && !destGate?.ok && /dashboard\.html/i.test(next)) {
        dest = 'client.html';
      } else {
        dest = next;
      }
    } else if (system && (isStaff || destGate?.ok) && window.HubLauncher?.getDirectLaunchUrl) {
      dest = window.HubLauncher.getDirectLaunchUrl(system);
    }

    showAlert('تم تسجيل الدخول بنجاح! جاري التحويل...', 'success');
    setTimeout(() => {
      window.location.replace(dest);
    }, 600);
  });

  window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.search);
    const prefillEmail = (params.get('email') || '').trim().toLowerCase();
    const fromParam = String(params.get('from') || '').toLowerCase();
    const referrer = String(document.referrer || '');
    const nextParam = params.get('next') || '';
    const fromRegistration =
      fromParam === 'register' ||
      fromParam === 'create-account' ||
      fromParam === 'signup' ||
      /create-account\.html|register\.html|register-freelancer\.html/i.test(referrer);
    const switchAccount =
      params.get('switch') === '1' ||
      params.get('switch') === 'true' ||
      fromRegistration;
    if (prefillEmail) {
      const emailInput = document.getElementById('email');
      if (emailInput && !emailInput.value) emailInput.value = prefillEmail;
    }
    if (switchAccount && window.HubAuth?.clearSessionAsync) {
      window.HubAuth.clearSessionAsync().catch(() => null);
      return;
    }

    // Always keep the form usable — cancel any pending bounce when the user focuses fields.
    let redirectTimer = null;
    let redirectCancelled = false;
    const cancelRedirect = () => {
      redirectCancelled = true;
      if (redirectTimer) {
        clearTimeout(redirectTimer);
        redirectTimer = null;
      }
    };
    ['email', 'password'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', cancelRedirect, { once: true });
      document.getElementById(id)?.addEventListener('focus', cancelRedirect, { once: true });
    });

    const localToken = localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken');
    // No local token: stay on the login form (do not bounce). Cookie-only stale
    // sessions are cleared server-side when hitting admin pages.
    if (!localToken) return;
    if (prefillEmail || fromRegistration) return;

    // Verify session with the server before any redirect — never trust localStorage alone.
    (async () => {
      let me = null;
      try {
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), 6000) : null;
        const res = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${localToken}`,
            'X-Hub-Token': localToken,
          },
          signal: ctrl?.signal,
        });
        if (timer) clearTimeout(timer);
        me = await res.json().catch(() => null);
        if (!res.ok || !me?.ok) me = null;
      } catch {
        me = null;
      }
      if (redirectCancelled) return;

      if (!me?.ok) {
        // Stale local session — clear and keep the login form visible
        if (window.HubAuth?.clearSessionAsync) {
          await window.HubAuth.clearSessionAsync().catch(() => null);
        } else if (window.HubAuth?.clearSession) {
          window.HubAuth.clearSession();
        } else {
          localStorage.removeItem('hubAuthToken');
          localStorage.removeItem('hubUser');
          sessionStorage.removeItem('hubAuthToken');
          sessionStorage.removeItem('hubUser');
        }
        return;
      }

      const role = String(me.role || me.user?.role || '').toLowerCase();
      const isStaff =
        role === 'supreme_leader' ||
        role === 'chief_engineer' ||
        role === 'admin' ||
        role === 'super_admin' ||
        me.lane === 'SUPER_ADMIN' ||
        me.lane === 'ADMIN';
      const isClientRole =
        role === 'customer' || role === 'client' || role === 'client_user' || role === 'platform_owner';
      const wantsAdmin =
        !nextParam ||
        /dashboard\.html|roles-permissions|search-admin|rent-admin/i.test(nextParam);

      // Customer with an admin next target: stay on login so an admin can sign in
      // (do not flash permission-denied via dashboard).
      if (isClientRole && !isStaff && wantsAdmin) {
        return;
      }

      let dest = isStaff ? 'dashboard.html' : isClientRole ? 'client.html' : 'client.html';
      if (role === 'platform_owner') dest = 'my-platform.html';
      if (nextParam && !nextParam.startsWith('http') && !nextParam.includes('://')) {
        if (isStaff) dest = nextParam;
        else if (
          isClientRole &&
          !/dashboard\.html/i.test(nextParam) &&
          !nextParam.includes('..') &&
          /^[a-zA-Z0-9_\-./?#=&%]+$/.test(nextParam)
        ) {
          dest = nextParam;
        } else if (isClientRole) {
          dest = 'client.html';
        }
      }

      showAlert('لديك جلسة نشطة. جاري تحويلك...', 'success');
      redirectTimer = setTimeout(() => {
        if (redirectCancelled) return;
        window.location.replace(dest.startsWith('http') ? (isStaff ? 'dashboard.html' : 'client.html') : dest);
      }, 500);
    })();
  });
})();
