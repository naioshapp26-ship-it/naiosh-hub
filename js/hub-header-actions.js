(() => {
  'use strict';

  // صف مستقل تحت الناف — عشان ما تتصغّرش وتتلف وسط الأزرار
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
    const topNav = document.querySelector('header.top-nav');
    if (!topNav) return;

    // نظّف أي حقن قديم جوه auth-actions
    document.querySelectorAll('.auth-actions [data-hub-header-actions]').forEach((el) => el.remove());

    let bar = topNav.querySelector('[data-hub-header-bar]');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'hub-header-bar';
      bar.dataset.hubHeaderBar = '1';
      bar.setAttribute('aria-label', 'اختصارات هوب');
      const inner = topNav.querySelector('.inner');
      if (inner && inner.parentElement === topNav) {
        inner.insertAdjacentElement('afterend', bar);
      } else {
        topNav.appendChild(bar);
      }
    }

    const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    bar.innerHTML = `<div class="hub-header-actions" data-hub-header-actions="1">${ACTIONS.map((a) => {
      const active = path === a.href.toLowerCase() ? ' is-active' : '';
      return `<a class="${a.className}${active}" href="${a.href}" data-hub-hbtn="${a.id}">
        <i class="fas ${a.icon}" aria-hidden="true"></i>${a.label}
      </a>`;
    }).join('')}</div>`;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
