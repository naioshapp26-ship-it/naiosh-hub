(() => {
  'use strict';

  // ترتيب RTL: أول عنصر يظهر يمين المجموعة — زي الصورة
  const ACTIONS = [
    {
      id: 'info',
      label: 'مركز المعلومات',
      href: 'info-center.html',
      className: 'hub-hbtn hub-hbtn--red',
      icon: 'fa-circle-info',
    },
    {
      id: 'blog',
      label: 'المدونة',
      href: 'blog.html',
      className: 'hub-hbtn hub-hbtn--red',
      icon: 'fa-newspaper',
    },
    {
      id: 'chat',
      label: 'الدردشة الداخلية',
      href: 'chat.html',
      className: 'hub-hbtn hub-hbtn--red',
      icon: 'fa-comments',
    },
    {
      id: 'membership',
      label: 'العضوية',
      href: 'membership.html',
      className: 'hub-hbtn hub-hbtn--red',
      icon: 'fa-id-card',
    },
    {
      id: 'packages',
      label: 'الباقات',
      href: 'packages.html',
      className: 'hub-hbtn hub-hbtn--packages',
      icon: 'fa-box',
    },
  ];

  const inject = () => {
    const auth = document.querySelector('.auth-actions');
    if (!auth) return;

    const existing = auth.querySelector('[data-hub-header-actions]');
    if (existing) existing.remove();

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

    auth.insertBefore(wrap, auth.firstChild);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
