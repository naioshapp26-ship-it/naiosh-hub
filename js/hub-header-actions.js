(() => {
  'use strict';

  /** اختصارات الهيدر — استأجر نظام موجود في الهيرو فقط (بدون تكرار) */
  const ACTIONS = [
    {
      id: 'ownership',
      label: 'ملكية نايوش',
      href: 'naiosh-ownership.html',
      className: 'hub-hbtn hub-hbtn--red',
      icon: 'fa-certificate',
    },
    {
      id: 'info',
      label: 'مركز معلومات نايوش هوب',
      href: 'hub-checklist.html',
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

  const INFO_PAGES = new Set([
    'hub-checklist.html',
    'info-center.html',
    'policies.html',
    'engine-specs.html',
    'ops-manuals.html',
    'review-methodology.html',
    'directives.html',
    'job-roles.html',
    'operating.html',
  ]);

  const removeLegacyOwnershipDropdown = (root) => {
    root?.querySelectorAll('.nav-dropdown, details.nav-dropdown').forEach((el) => {
      const label = (el.querySelector('summary')?.textContent || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (/ملكية نايوش/.test(label)) el.remove();
    });
    // أي قائمة منسدلة قديمة لعناصر الملكية داخل الهيدر
    root?.querySelectorAll('[data-ownership-dropdown], [data-naiosh-ownership-menu]').forEach((el) => el.remove());
  };

  const inject = () => {
    const topNav = document.querySelector('header.top-nav');
    const inner = topNav?.querySelector('.inner');
    const navLinks = inner?.querySelector('.nav-links');
    const auth = inner?.querySelector('.auth-actions');
    if (!inner || !auth) return;

    removeLegacyOwnershipDropdown(topNav);
    removeLegacyOwnershipDropdown(document);

    // امسح الصف الثاني القديم والحقن القديمة (شريط الأيقونات المكرر)
    topNav.querySelectorAll('[data-hub-header-bar]').forEach((el) => el.remove());
    document.querySelectorAll('[data-hub-header-actions]').forEach((el) => el.remove());

    // احذف تكرار «مركز المعرفة / مركز المعلومات» من الروابط النصية — يبقى الزر الأحمر فقط
    navLinks?.querySelectorAll('a[href="info-center.html"], a[href="hub-checklist.html"]').forEach((a) => {
      const t = (a.textContent || '').replace(/\s+/g, ' ').trim();
      if (/مركز المعرفة|مركز معلومات|قائمة الهوب/.test(t) || a.getAttribute('href') === 'info-center.html') {
        a.remove();
      }
    });

    // لا تكرار لزر ملكية نايوش إذا وُجد رابط نصي بنفس الوجهة
    navLinks?.querySelectorAll('a[href="naiosh-ownership.html"]').forEach((a) => a.remove());
    auth.querySelectorAll('a[href="naiosh-ownership.html"]').forEach((a) => a.remove());

    // هيدر الرئيسية: أزل ما هو موجود في القائمة الجانبية (المشاريع الجانبية · سجل معنا · منصتي)
    const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const isHome = path === 'index.html' || path === '' || path === '/';
    if (isHome) {
      const isSidebarDupe = (a) => {
        const href = (a.getAttribute('href') || '').toLowerCase();
        const label = (a.textContent || '').replace(/\s+/g, ' ').trim();
        return (
          label === 'المشاريع الجانبية' ||
          label === 'سجل معنا' ||
          label === 'منصتي' ||
          href.includes('side-projects.html') ||
          href.includes('my-platform.html') ||
          /^register\.html(?:$|[?#])/.test(href)
        );
      };
      navLinks?.querySelectorAll('a').forEach((a) => {
        if (isSidebarDupe(a)) a.remove();
      });
      auth.querySelectorAll('a').forEach((a) => {
        if (isSidebarDupe(a)) a.remove();
      });
    }

    if (!ACTIONS.length) return;

    const wrap = document.createElement('div');
    wrap.className = 'hub-header-actions';
    wrap.dataset.hubHeaderActions = '1';
    wrap.setAttribute('aria-label', 'اختصارات هوب');

    wrap.innerHTML = ACTIONS.map((a) => {
      const active =
        a.id === 'info'
          ? INFO_PAGES.has(path)
            ? ' is-active'
            : ''
          : path === a.href.toLowerCase() || (a.id === 'ownership' && path === 'naiosh-ownership.html')
            ? ' is-active'
            : '';
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
