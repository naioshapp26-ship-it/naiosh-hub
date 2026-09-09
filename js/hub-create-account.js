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
    ['fullName', 'username', 'email', 'phone', 'password', 'confirmPassword', 'terms'].forEach(clearFieldError);
  }

  const MIN_PASSWORD_LENGTH = 4;

  function passwordStrength(password) {
    const p = String(password || '');
    const rules = { minLength: p.length >= MIN_PASSWORD_LENGTH };
    return { ok: rules.minLength, rules };
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
      const pct = Math.min(100, (value.length / MIN_PASSWORD_LENGTH) * 100);
      meterFill.style.width = `${pct}%`;
      meterFill.style.backgroundColor = ok ? '#16a34a' : value ? '#d97706' : '#dc2626';
    }
    if (meterLabel) {
      meterLabel.textContent = !value
        ? 'اختاري أي كلمة مرور أو رقم (4 أحرف على الأقل)'
        : ok
          ? 'كلمة المرور مقبولة ✓'
          : `أضيفي ${MIN_PASSWORD_LENGTH - value.length} حرفًا أو رقمًا على الأقل`;
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
    const username = (document.getElementById('username')?.value || '').trim().toLowerCase();
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
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      setFieldError('username', 'اسم المستخدم غير صالح.');
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
      setFieldError('password', `كلمة المرور قصيرة جدًا — ${MIN_PASSWORD_LENGTH} أحرف أو أرقام على الأقل.`);
      ok = false;
    }
    if (password !== confirmPassword) {
      setFieldError('confirmPassword', 'كلمتا المرور غير متطابقتين.');
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
        username,
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

      const user = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name || data.user.fullName,
        fullName: data.user.fullName || data.user.name,
        username: data.user.username,
        phone: data.user.phone,
        role: 'customer',
        platform: data.user.platform || 'naiosh-hub-360',
      };
      const token = data.token || `hub360.${btoa(user.email)}.${Date.now()}`;
      if (window.HubAuth?.setSession) {
        window.HubAuth.setSession(user, token, { remember: true });
      } else {
        localStorage.setItem('hubAuthToken', token);
        localStorage.setItem('hubUser', JSON.stringify(user));
      }

      form?.classList.add('hidden');
      successPanel?.classList.remove('hidden');
      showAlert('تم إنشاء الحساب بنجاح', 'success');
      setTimeout(() => {
        window.location.href = data.destination || 'client.html';
      }, 900);
    } catch {
      showAlert('حدث خطأ أثناء إنشاء الحساب. حاول مرة أخرى.');
      setLoading(false);
    }
  }

  wireToggle('togglePassword', 'password', 'togglePasswordIcon');
  wireToggle('toggleConfirmPassword', 'confirmPassword', 'toggleConfirmPasswordIcon');
  passwordInput?.addEventListener('input', updatePasswordUI);
  confirmInput?.addEventListener('input', updatePasswordUI);
  form?.addEventListener('submit', onSubmit);

  if (window.HubAuth?.isLoggedIn?.()) {
    const user = window.HubAuth.getUser();
    if (user?.role === 'customer' || user?.role === 'client') {
      showAlert('لديك جلسة نشطة. جاري تحويلك...', 'info');
      setTimeout(() => {
        window.location.href = 'client.html';
      }, 700);
    }
  }
})();
