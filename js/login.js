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
    await window.HubPlatformGrants?.hydrate?.().catch?.(() => null);
    await new Promise((resolve) => setTimeout(resolve, 400));

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

    let serverUser = null;
    try {
      const res = await fetch('/api/hub/tenant-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.ok && data?.user) serverUser = data.user;
    } catch {
      /* offline — local fallback below */
    }

    let user = null;
    if (demo && demo.password === password) {
      user = {
        email,
        name: demo.name,
        role: demo.role,
        platform: 'naiosh-hub-360',
      };
    } else if (serverUser) {
      user = serverUser;
    } else if (localTenant && localTenant.status === 'active' && localTenant.password === password) {
      user = {
        email,
        name: localTenant.name || email,
        role: localTenant.role || 'platform_owner',
        platform: 'naiosh-hub-360',
        systemCode: localTenant.systemCode || '',
        host: localTenant.host || '',
      };
    } else if (pendingGrant || (localTenant && localTenant.status === 'pending')) {
      showAlert(
        'طلبك بانتظار موافقة السوبر أدمن. بعد الاعتماد ادخل من login.html ثم افتح صفحة «منصتي» لترى الدومين والنظام.'
      );
      setLoading(false);
      return;
    } else {
      showAlert('بيانات الدخول غير صحيحة.');
      setLoading(false);
      return;
    }
    const token = `hub360.${btoa(email)}.${Date.now()}`;
    if (window.HubAuth?.setSession) {
      window.HubAuth.setSession(user, token, { remember: !!rememberMe });
    } else {
      localStorage.removeItem('hubAuthToken');
      localStorage.removeItem('hubUser');
      sessionStorage.removeItem('hubAuthToken');
      sessionStorage.removeItem('hubUser');
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('hubAuthToken', token);
      storage.setItem('hubUser', JSON.stringify(user));
    }

    const params = new URLSearchParams(window.location.search);
    const next = params.get('next') || '';
    const system = (params.get('system') || '').toUpperCase();
    let dest = 'dashboard.html';
    if (next && !next.startsWith('http') && !next.includes('://')) {
      dest = next;
    } else if (system && window.HubLauncher?.getDirectLaunchUrl) {
      dest = window.HubLauncher.getDirectLaunchUrl(system);
    } else if (user.role === 'platform_owner') {
      dest = 'my-platform.html';
    }

    showAlert('تم تسجيل الدخول بنجاح! جاري التحويل...', 'success');
    setTimeout(() => {
      window.location.href = dest;
    }, 900);
  });

  window.addEventListener('load', () => {
    const token = localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken');
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next') || '';
    let dest = 'dashboard.html';
    if (next && !next.startsWith('http') && !next.includes('://')) {
      dest = next;
    } else {
      try {
        const raw = localStorage.getItem('hubUser') || sessionStorage.getItem('hubUser');
        const sessionUser = raw ? JSON.parse(raw) : null;
        if (sessionUser?.role === 'platform_owner') dest = 'my-platform.html';
      } catch {
        /* ignore */
      }
    }
    showAlert('لديك جلسة نشطة. جاري تحويلك...', 'success');
    setTimeout(() => {
      window.location.href = dest.startsWith('http') ? 'dashboard.html' : dest;
    }, 800);
  });
})();
