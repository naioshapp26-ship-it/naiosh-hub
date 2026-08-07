(() => {
  'use strict';

  const ACTIONS = [
    {
      id: 'packages',
      label: 'الباقات',
      href: 'packages.html',
      className: 'hub-hbtn hub-hbtn--packages',
      icon: 'fa-box',
    },
    {
      id: 'quality',
      label: 'دليل الجودة',
      href: 'quality.html',
      className: 'hub-hbtn hub-hbtn--quality',
      icon: 'fa-clipboard-check',
    },
    {
      id: 'trial',
      label: 'تجربة',
      href: 'trial.html',
      className: 'hub-hbtn hub-hbtn--trial',
      icon: 'fa-flask',
    },
  ];

  const inject = () => {
    const auth = document.querySelector('.auth-actions');
    if (!auth || auth.querySelector('[data-hub-header-actions]')) return;

    const wrap = document.createElement('div');
    wrap.className = 'hub-header-actions';
    wrap.dataset.hubHeaderActions = '1';
    wrap.setAttribute('aria-label', 'إجراءات هوب السريعة');

    const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    wrap.innerHTML = ACTIONS.map((a) => {
      const active = path === a.href.toLowerCase() ? ' is-active' : '';
      return `<a class="${a.className}${active}" href="${a.href}" data-hub-hbtn="${a.id}">
        <i class="fas ${a.icon}" aria-hidden="true"></i>${a.label}
      </a>`;
    }).join('');

    // قبل غرفة العمليات / تسجيل الدخول
    auth.insertBefore(wrap, auth.firstChild);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
