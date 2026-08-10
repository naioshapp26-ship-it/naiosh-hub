(() => {
  'use strict';

  const ACTIONS = [
    {
      id: 'info',
      label: 'مركز المعرفة',
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
      id: 'packages',
      label: 'الباقات',
      href: 'packages.html',
      className: 'hub-hbtn hub-hbtn--red',
      icon: 'fa-box',
    },
    {
      id: 'membership',
      label: 'العضوية',
      href: 'membership.html',
      className: 'hub-hbtn hub-hbtn--red',
      icon: 'fa-id-card',
    },
    {
      id: 'side-projects',
      label: 'مشاريع جانبية',
      href: 'side-projects.html',
      className: 'hub-hbtn hub-hbtn--red',
      icon: 'fa-seedling',
    },
    {
      id: 'courses',
      label: 'دورات',
      href: 'courses.html',
      className: 'hub-hbtn hub-hbtn--red',
      icon: 'fa-chalkboard',
    },
    {
      id: 'diplomas',
      label: 'دبلومات',
      href: 'diplomas.html',
      className: 'hub-hbtn hub-hbtn--red',
      icon: 'fa-graduation-cap',
    },
    {
      id: 'chat',
      label: 'الدردشة الداخلية',
      href: 'chat.html',
      className: 'hub-hbtn hub-hbtn--red',
      icon: 'fa-comments',
    },
  ];

  const inject = () => {
    const topNav = document.querySelector('header.top-nav');
    const inner = topNav?.querySelector('.inner');
    const navLinks = inner?.querySelector('.nav-links');
    const auth = inner?.querySelector('.auth-actions');
    if (!inner || !auth) return;

    // امسح الصف الثاني القديم والحقن القديم
    topNav.querySelectorAll('[data-hub-header-bar]').forEach((el) => el.remove());
    document.querySelectorAll('[data-hub-header-actions]').forEach((el) => el.remove());

    const wrap = document.createElement('div');
    wrap.className = 'hub-header-actions';
    wrap.dataset.hubHeaderActions = '1';
    wrap.setAttribute('aria-label', 'اختصارات هوب');

    const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    wrap.innerHTML = ACTIONS.map((a) => {
      const active = path === a.href.toLowerCase() ? ' is-active' : '';
      return `<a class="${a.className}${active}" href="${a.href}" data-hub-hbtn="${a.id}">
        <i class="fas ${a.icon}" aria-hidden="true"></i>${a.label}
      </a>`;
    }).join('');

    // جوه صف الروابط نفسه — صف واحد متصل بدون فجوة
    if (navLinks) {
      navLinks.appendChild(wrap);
    } else {
      inner.insertBefore(wrap, auth);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
