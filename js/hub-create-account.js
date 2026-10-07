/**
 * Create-account page — client validation + POST /api/auth/register
 * IDs must match create-account.html exactly.
 */
(() => {
  'use strict';

  const form = document.getElementById('createAccountForm');
  const alertEl = document.getElementById('alertMessage');
  const successPanel = document.getElementById('successPanel');
  const submitBtn = document.getElementById('createAccountBtn');
  const btnText = submitBtn?.querySelector('.btn-text');
  const spinner = submitBtn?.querySelector('.loading-spinner');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirmPassword');
  const meterFill = document.getElementById('passwordMeterFill');
  const meterLabel = document.getElementById('passwordMeterLabel');

  let busy = false;

  function showAlert(message, type = 'error') {
    if (!alertEl) return;
    alertEl.classList.remove(
      'hidden',
      'bg-red-50',
      'text-red-700',
      'border-red-200',
      'bg-black',
      'text-white',
      'border-black',
      'bg-green-50',
      'text-green-800',
      'border-green-200'
    );
    if (type === 'success') {
      alertEl.classList.add('bg-green-50', 'text-green-800', 'border-green-200');
      alertEl.innerHTML = `<i class="fa-solid fa-check-circle ml-2"></i>${message}`;
    } else if (type === 'info') {
      alertEl.classList.add('bg-black', 'text-white', 'border-black');
      alertEl.innerHTML = `<i class="fa-solid fa-circle-info ml-2"></i>${message}`;
    } else {
      alertEl.classList.add('bg-red-50', 'text-red-700', 'border-red-200');
      alertEl.innerHTML = `<i class="fa-solid fa-circle-exclamation ml-2"></i>${message}`;
    }
  }

  function hideAlert() {
    alertEl?.classList.add('hidden');
  }

  function setLoading(on) {
    busy = on;
    if (!submitBtn || !btnText || !spinner) return;
    submitBtn.disabled = on;
    submitBtn.classList.toggle('opacity-75', on);
    submitBtn.classList.toggle('cursor-not-allowed', on);
    if (on) {
      if (!btnText.dataset.original) btnText.dataset.original = btnText.innerHTML;
      btnText.textContent = 'جاري إنشاء الحساب...';
      btnText.classList.remove('hidden');
      spinner.classList.add('hidden');
    } else {
      if (btnText.dataset.original) btnText.innerHTML = btnText.dataset.original;
      btnText.classList.remove('hidden');
      spinner.classList.add('hidden');
    }
  }

  function setFieldError(id, message) {
    const inputId = id === 'terms' ? 'termsAccepted' : id;
    const errorId = id === 'terms' ? 'termsError' : `${id}Error`;
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(errorId);
    if (input) {
      input.classList.add('field-error');
      input.classList.remove('field-ok');
      input.setAttribute('aria-invalid', 'true');
    }
    if (errorEl) {
      errorEl.textContent = message || '';
      errorEl.classList.toggle('hidden', !message);
    }
  }

  function clearFieldError(id) {
    const inputId = id === 'terms' ? 'termsAccepted' : id;
    const errorId = id === 'terms' ? 'termsError' : `${id}Error`;
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(errorId);
    if (input) {
      input.classList.remove('field-error');
      input.removeAttribute('aria-invalid');
    }
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }
  }

  function clearAllErrors() {
    ['fullName', 'email', 'phone', 'password', 'confirmPassword', 'terms'].forEach(clearFieldError);
  }

  /** Owner policy: no complexity — any non-empty password (numeric OK). */
  function passwordStrength(password) {
    const p = String(password || '');
    const rules = { notEmpty: p.length > 0 && p.trim().length > 0 };
    return { ok: rules.notEmpty, rules };
  }

  function updatePasswordUI() {
    const value = passwordInput?.value || '';
    const { ok, rules } = passwordStrength(value);
    document.querySelectorAll('.pw-rule').forEach((el) => {
      const key = el.getAttribute('data-rule');
      const met = key ? !!rules[key] : ok;
      el.classList.toggle('is-met', met);
      const icon = el.querySelector('i');
      if (icon) icon.className = met ? 'fa-solid fa-circle-check ml-1' : 'fa-solid fa-circle-xmark ml-1';
    });
    if (meterFill) {
      meterFill.style.width = ok ? '100%' : value ? '40%' : '0%';
      meterFill.style.backgroundColor = ok ? '#16a34a' : value ? '#d97706' : '#dc2626';
    }
    if (meterLabel) {
      meterLabel.textContent = !value
        ? 'اختاري أي كلمة مرور — أرقام أو حروف، بدون شروط تركيب'
        : ok
          ? 'كلمة المرور مقبولة ✓'
          : 'كلمة المرور مطلوبة';
    }
    if (passwordInput && value) {
      passwordInput.classList.toggle('field-ok', ok);
      passwordInput.classList.toggle('field-error', !ok);
    }
    if (confirmInput?.value) {
      const match = confirmInput.value === value;
      confirmInput.classList.toggle('field-ok', match);
      confirmInput.classList.toggle('field-error', !match);
      if (!match) setFieldError('confirmPassword', 'كلمتا المرور غير متطابقتين.');
      else clearFieldError('confirmPassword');
    }
  }

  function wireToggle(btnId, inputId, iconId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    btn?.addEventListener('click', () => {
      if (!input || !icon) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      icon.className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
      input.focus();
    });
  }

  function validateClient() {
    clearAllErrors();
    const fullName = document.getElementById('fullName')?.value.trim() || '';
    const email = (document.getElementById('email')?.value || '').trim().toLowerCase();
    const phone = (document.getElementById('phone')?.value || '').trim().replace(/[\s\-()]/g, '');
    const password = passwordInput?.value || '';
    const confirmPassword = confirmInput?.value || '';
    const termsAccepted = !!document.getElementById('termsAccepted')?.checked;

    let ok = true;
    if (fullName.length < 2) {
      setFieldError('fullName', 'من فضلك أكمل جميع البيانات المطلوبة.');
      ok = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError('email', 'صيغة البريد الإلكتروني غير صحيحة.');
      ok = false;
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15 || !/^\+?[0-9]+$/.test(phone)) {
      setFieldError('phone', 'رقم الهاتف غير صالح.');
      ok = false;
    }
    if (!passwordStrength(password).ok) {
      setFieldError('password', 'كلمة المرور مطلوبة.');
      ok = false;
    }
    if (password !== confirmPassword) {
      setFieldError('confirmPassword', 'تأكيد كلمة المرور غير متطابق.');
      ok = false;
    }
    if (!termsAccepted) {
      setFieldError('terms', 'يجب الموافقة على الشروط وسياسة الخصوصية.');
      ok = false;
    }

    return {
      ok,
      payload: {
        fullName,
        name: fullName,
        email,
        phone,
        password,
        confirmPassword,
        termsAccepted,
        governorate: document.getElementById('governorate')?.value.trim() || '',
        city: document.getElementById('city')?.value.trim() || '',
        address: document.getElementById('address')?.value.trim() || '',
      },
    };
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (busy) return;
    hideAlert();
    const { ok, payload } = validateClient();
    if (!ok) {
      showAlert('من فضلك أكمل جميع البيانات المطلوبة.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.user) {
        if (data?.field) {
          const field = data.field === 'terms' ? 'terms' : data.field;
          setFieldError(field, data.error || '');
        }
        showAlert(data?.error || data?.message || 'حدث خطأ أثناء إنشاء الحساب. حاول مرة أخرى.');
        setLoading(false);
        return;
      }

      // Registration must NOT leave an authenticated session.
      // Clear any prior identity so a later Admin/Employee login is not blocked.
      if (window.HubAuth?.clearSessionAsync) {
        await window.HubAuth.clearSessionAsync().catch(() => null);
      } else if (window.HubAuth?.clearSession) {
        window.HubAuth.clearSession();
      } else {
        try {
          localStorage.removeItem('hubAuthToken');
          localStorage.removeItem('hubUser');
          sessionStorage.removeItem('hubAuthToken');
          sessionStorage.removeItem('hubUser');
        } catch (_) {}
      }

      form?.classList.add('hidden');
      successPanel?.classList.remove('hidden');
      const customerId = data.user.customerId || data.user.clientId || data.user.id || '';
      showAlert(
        customerId
          ? `تم إنشاء الحساب بنجاح. رقم العميل: ${customerId}. سيتم تحويلك لتسجيل الدخول.`
          : 'تم إنشاء الحساب بنجاح. سيتم تحويلك لتسجيل الدخول.',
        'success'
      );
      const params = new URLSearchParams(location.search);
      const next = params.get('next') || '';
      const safeNext =
        next &&
        !next.startsWith('http') &&
        !next.includes('://') &&
        !/dashboard\.html/i.test(next) &&
        /^[a-zA-Z0-9_\-./?#=&%]+$/.test(next)
          ? next
          : '';
      window.HubRegistrationGuard?.clearCreateAccountDraft?.();
      const loginUrl = new URL('login.html', location.href);
      loginUrl.searchParams.set('switch', '1');
      loginUrl.searchParams.set('from', 'create-account');
      if (data.user.email) loginUrl.searchParams.set('email', data.user.email);
      if (safeNext) loginUrl.searchParams.set('next', safeNext);
      setTimeout(() => {
        window.location.href = loginUrl.pathname + loginUrl.search;
      }, 900);
    } catch {
      showAlert('حدث خطأ أثناء إنشاء الحساب. حاول مرة أخرى.');
      setLoading(false);
    }
  }

  const collectDraftFields = () => ({
    fullName: document.getElementById('fullName')?.value || '',
    email: document.getElementById('email')?.value || '',
    phone: document.getElementById('phone')?.value || '',
    governorate: document.getElementById('governorate')?.value || '',
    city: document.getElementById('city')?.value || '',
    address: document.getElementById('address')?.value || '',
  });

  const persistDraft = () => {
    // Draft only — never creates Customer ID, Role, Token, or hub_session
    window.HubRegistrationGuard?.saveCreateAccountDraft?.(collectDraftFields());
  };

  const restoreDraft = () => {
    const fields = window.HubRegistrationGuard?.loadCreateAccountDraft?.();
    if (!fields) return;
    Object.entries(fields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el && value != null && el.type !== 'password' && el.type !== 'checkbox') {
        el.value = String(value);
      }
    });
  };

  wireToggle('togglePassword', 'password', 'togglePasswordIcon');
  wireToggle('toggleConfirmPassword', 'confirmPassword', 'toggleConfirmPasswordIcon');
  passwordInput?.addEventListener('input', updatePasswordUI);
  confirmInput?.addEventListener('input', updatePasswordUI);
  ['fullName', 'email', 'phone', 'governorate', 'city', 'address'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', persistDraft);
  });
  form?.addEventListener('submit', onSubmit);

  // Incomplete registration must never mint auth. Draft restore is UI-only.
  window.HubRegistrationGuard?.assertNoAuthSideEffects?.();
  restoreDraft();

  // "لديك حساب بالفعل؟" → login with switch so a draft visit cannot trap another account
  document.querySelectorAll('a[href="login.html"], a[href="./login.html"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const href =
        window.HubRegistrationGuard?.loginUrlFromRegistration?.({ from: 'create-account' }) ||
        'login.html?switch=1&from=create-account';
      window.location.href = href;
    });
  });

  if (window.HubAuth?.isLoggedIn?.()) {
    const user = window.HubAuth.getUser();
    if (user?.role === 'customer' || user?.role === 'client') {
      const params = new URLSearchParams(location.search);
      const next = params.get('next') || '';
      const safeNext =
        next &&
        !next.startsWith('http') &&
        !next.includes('://') &&
        !/dashboard\.html/i.test(next) &&
        /^[a-zA-Z0-9_\-./?#=&%]+$/.test(next)
          ? next
          : 'client.html';
      showAlert('لديك جلسة نشطة. جاري تحويلك...', 'info');
      setTimeout(() => {
        window.location.href = safeNext;
      }, 700);
    }
  }
})();
