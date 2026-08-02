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

function fillLogin(email, password) {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  if (!emailInput || !passwordInput) return;
  emailInput.value = email;
  passwordInput.value = password;
  emailInput.parentElement?.classList.add('ring-2', 'ring-primary/20');
  setTimeout(() => {
    emailInput.parentElement?.classList.remove('ring-2', 'ring-primary/20');
  }, 500);
  document.getElementById('loginBtn')?.focus();
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
    await new Promise((resolve) => setTimeout(resolve, 700));

    const demo = DEMO_USERS[email];
    if (!demo || demo.password !== password) {
      showAlert('بيانات الدخول غير صحيحة. جرّب الحسابات التجريبية.');
      setLoading(false);
      return;
    }

    const user = {
      email,
      name: demo.name,
      role: demo.role,
      platform: 'naiosh-hub-360',
    };
    const token = `hub360.${btoa(email)}.${Date.now()}`;
    localStorage.removeItem('hubAuthToken');
    localStorage.removeItem('hubUser');
    sessionStorage.removeItem('hubAuthToken');
    sessionStorage.removeItem('hubUser');
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('hubAuthToken', token);
    storage.setItem('hubUser', JSON.stringify(user));

    showAlert('تم تسجيل الدخول بنجاح! جاري تحويلك لغرفة العمليات...', 'success');
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 900);
  });

  window.addEventListener('load', () => {
    const token = localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken');
    if (token) {
      showAlert('لديك جلسة نشطة. جاري تحويلك...', 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 800);
    }
  });
})();
