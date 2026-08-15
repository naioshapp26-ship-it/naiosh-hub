(() => {
  'use strict';

  /** اختصارات الهيدر أُلغيت — كل وظيفة تظهر مرة واحدة فقط في مكانها المعتمد */
  const ACTIONS = [];

  const inject = () => {
    const topNav = document.querySelector('header.top-nav');
    const inner = topNav?.querySelector('.inner');
    const navLinks = inner?.querySelector('.nav-links');
    const auth = inner?.querySelector('.auth-actions');
    if (!inner || !auth) return;

    topNav.querySelectorAll('[data-hub-header-bar]').forEach((el) => el.remove());
    document.querySelectorAll('[data-hub-header-actions]').forEach((el) => el.remove());

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
