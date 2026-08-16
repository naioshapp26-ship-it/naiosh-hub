(() => {
  'use strict';

  /** اختصارات الهيدر — استأجر نظام موجود في الهيرو فقط (بدون تكرار) */
  const ACTIONS = [
    {
      id: 'mine',
      label: 'أنظمتي',
      href: 'my-systems.html',
      className: 'hub-hbtn hub-hbtn--mine',
      icon: 'fa-cubes',
    },
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
      id: 'membership',
      label: 'العضوية',
      href: 'membership.html',
      className: 'hub-hbtn hub-hbtn--red',
      icon: 'fa-id-card',
    },
  ];

  const inject = () => {
    const topNav = document.querySelector('header.top-nav');
    const inner = topNav?.querySelector('.inner');
    const navLinks = inner?.querySelector('.nav-links');
    const auth = inner?.querySelector('.auth-actions');
    if (!inner || !auth) return;

    // امسح الصف الثاني القديم والحقن القديمة (شريط الأيقونات المكرر)
    topNav.querySelectorAll('[data-hub-header-bar]').forEach((el) => el.remove());
    document.querySelectorAll('[data-hub-header-actions]').forEach((el) => el.remove());

    // احذف تكرار «مركز المعرفة» من الروابط النصية إن وُجد — يبقى الزر الأحمر فقط
    navLinks?.querySelectorAll('a[href="info-center.html"]').forEach((a) => a.remove());

    if (!ACTIONS.length) return;

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
