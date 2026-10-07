const DEMO_USERS = {
  'leader@naiosh.com': {
    password: 'Hub@360',
    name: 'القائد الأعلى',
    role: 'supreme_leader',
  },
  'malika@naiosh.com': {
    password: 'Hub@360',
    name: 'المهندسة مليكة',
    role: 'chief_engineer',
  },
  'viewer@naiosh.com': {
    password: 'Hub@360',
    name: 'موظف عرض العملاء',
    role: 'admin',
  },
  'client@naiosh.com': {
    password: 'Hub@360',
    name: 'أحمد العميل',
    role: 'customer',
  },
};

function fillLogin(email, password, autoSubmit = true) {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  if (!emailInput || !passwordInput) return;
  emailInput.value = email;
  passwordInput.value = password;
  emailInput.dispatchEvent(new Event('input', { bubbles: true }));
  passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
  emailInput.parentElement?.classList.add('ring-2', 'ring-primary/20');
  setTimeout(() => {
    emailInput.parentElement?.classList.remove('ring-2', 'ring-primary/20');
  }, 500);
  document.getElementById('rememberMe') && (document.getElementById('rememberMe').checked = true);
  document.getElementById('loginBtn')?.focus();
  if (autoSubmit) {
    document.getElementById('loginForm')?.requestSubmit?.() ||
      document.getElementById('loginBtn')?.click();
  }
}

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

    // End any prior identity (customer/admin) before accepting a new login —
    // clears HttpOnly hub_session so the next account is not mixed with the last.
    if (window.HubAuth?.clearSessionAsync) {
      await withTimeout(window.HubAuth.clearSessionAsync(), 5000, null);
    } else if (window.HubAuth?.clearSession) {
      window.HubAuth.clearSession();
    }
    await withTimeout(window.HubPlatformGrants?.hydrate?.(), 4000, null);
    await new Promise((resolve) => setTimeout(resolve, 120));

    const demo = DEMO_USERS[email];
    const localTenant = (() => {
      try {
        const list = JSON.parse(localStorage.getItem('naiosh_hub_tenant_accounts_v1') || '[]');
        return (Array.isArray(list) ? list : []).find((a) => String(a.email || '').toLowerCase() === email) || null;
      } catch {
        return null;
      }
    })();
    const pendingGrant =
      window.HubPlatformGrants?.listGrants?.()?.find(
        (g) => String(g.adminEmail || '').toLowerCase() === email && g.status === 'pending'
      ) ||
      (() => {
        try {
          const grants = JSON.parse(localStorage.getItem('naiosh_hub_platform_grants_v1') || '{}')?.grants || [];
          return (Array.isArray(grants) ? grants : []).find(
            (g) => String(g.adminEmail || '').toLowerCase() === email && g.status === 'pending'
          );
        } catch {
          return null;
        }
      })();

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
      /* offline — local fallback below */
    }

    let user = null;
    let token = '';
    const serverOk = !!(authPayload?.ok && authPayload?.user && authPayload?.token);
    const serverRole = String(authPayload?.user?.role || '').toLowerCase();
    const serverIsStaff = ['supreme_leader', 'chief_engineer', 'admin', 'super_admin'].includes(serverRole);

    // Prefer server authentication (staff + customer) — same secure endpoint.
    if (serverOk && serverIsStaff) {
      user = {
        email: authPayload.user.email || email,
        name: authPayload.user.name || demo?.name || email,
        role: authPayload.user.role,
        platform: authPayload.user.platform || 'naiosh-hub-360',
        employeeNo: authPayload.user.employeeNo || authPayload.employeeNo || null,
        naioshId: authPayload.user.naioshId || null,
        status: authPayload.user.status || 'active',
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
    } else if (demo && demo.password === password) {
      // Offline / older-server fallback for built-in staff only
      user = {
        email,
        name: demo.name,
        role: demo.role,
        platform: 'naiosh-hub-360',
      };
      token = `hub360.${btoa(email)}.${Date.now()}`;
    } else if (tenantUser) {
      user = tenantUser;
      token = `hub360.${btoa(email)}.${Date.now()}`;
    } else if (localTenant && localTenant.status === 'active' && localTenant.password === password) {
      user = {
        email,
        name: localTenant.name || email,
        role: localTenant.role || 'platform_owner',
        platform: 'naiosh-hub-360',
        systemCode: localTenant.systemCode || '',
        host: localTenant.host || '',
      };
      token = `hub360.${btoa(email)}.${Date.now()}`;
    } else if (
      !demo &&
      !serverOk &&
      !tenantUser &&
      (pendingGrant || (localTenant && localTenant.status === 'pending'))
    ) {
      showAlert(
        'طلبك بانتظار موافقة السوبر أدمن. بعد الاعتماد ادخل من login.html ثم افتح صفحة «منصتي» لترى الدومين والنظام.'
      );
      setLoading(false);
      return;
    } else {
      const errMsg =
        (authPayload && !authPayload.ok && authPayload.error) || 'بيانات الدخول غير صحيحة.';
      showAlert(errMsg);
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
    if (destGate?.ok || isStaff) dest = 'dashboard.html';
    else if (isClientRole) dest = role === 'platform_owner' ? 'my-platform.html' : 'client.html';

    // CLIENT: allow safe public next (e.g. solutions resume), never admin/ops
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
    // Coming from incomplete/complete registration: stay on the form so another
    // account can sign in. Registration draft keys are left untouched.
    if (switchAccount && window.HubAuth?.clearSessionAsync) {
      window.HubAuth.clearSessionAsync().catch(() => null);
      return;
    }

    const token = localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken');
    if (!token) return;
    // If arriving from registration with ?email=, prefer the login form over auto-redirect
    // so the new customer (or another account) can authenticate cleanly.
    if (prefillEmail || fromRegistration) return;

    // If the user starts typing credentials, cancel auto-redirect (account switch intent).
    let redirectTimer = null;
    const cancelRedirect = () => {
      if (redirectTimer) {
        clearTimeout(redirectTimer);
        redirectTimer = null;
      }
    };
    ['email', 'password'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', cancelRedirect, { once: true });
      document.getElementById(id)?.addEventListener('focus', cancelRedirect, { once: true });
    });

    const next = params.get('next') || '';
    let dest = 'dashboard.html';
    try {
      const raw = localStorage.getItem('hubUser') || sessionStorage.getItem('hubUser');
      const sessionUser = raw ? JSON.parse(raw) : null;
      const role = String(sessionUser?.role || '').toLowerCase();
      if (role === 'customer' || role === 'client' || role === 'client_user') {
        dest = 'client.html';
      } else if (window.HubAuth?.postLoginDestination) {
        dest = window.HubAuth.postLoginDestination(sessionUser);
      } else if (sessionUser?.role === 'platform_owner') {
        dest = 'my-platform.html';
      }
    } catch {
      /* ignore */
    }
    if (next && !next.startsWith('http') && !next.includes('://')) {
      const role = (() => {
        try {
          return String(JSON.parse(localStorage.getItem('hubUser') || sessionStorage.getItem('hubUser') || '{}').role || '').toLowerCase();
        } catch {
          return '';
        }
      })();
      const isClientRole = role === 'customer' || role === 'client' || role === 'client_user';
      const safePublic =
        next &&
        !next.includes('..') &&
        !/dashboard\.html/i.test(next) &&
        /^[a-zA-Z0-9_\-./?#=&%]+$/.test(next);
      if (isClientRole && safePublic) dest = next;
      else if (isClientRole) dest = 'client.html';
      else dest = next;
    }
    showAlert('لديك جلسة نشطة. جاري تحويلك...', 'success');
    redirectTimer = setTimeout(() => {
      window.location.replace(dest.startsWith('http') ? 'dashboard.html' : dest);
    }, 500);
  });
})();
