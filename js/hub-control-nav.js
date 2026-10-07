/**
 * شعار صغير → صفحة الهبوط.
 * لا يُعرض زر «لوحة التحكم» في الهيدر العام للزائر/المستخدم —
 * الوصول لغرفة العمليات يتم عبر تسجيل الدخول والصلاحيات فقط.
 */
(() => {
  'use strict';

  if (window.HubControlNav) return;
  window.HubControlNav = { mounted: false };

  const STYLE_ID = 'hub-control-nav-style';
  // الصفحات التي لا تحتاج شريط الشعار المصغّر (لديها تنقل كافٍ أو هي صفحة الهبوط نفسها)
  const SKIP_PAGES = new Set([
    'index.html',
    '',
    '/',
    'login.html',
    'register.html',
    'register-freelancer.html',
    'sso-bridge.html',
  ]);
  const fileName = () => (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const inSystems = /\/systems\//i.test(window.location.pathname.replace(/\\/g, '/'));
  const prefix = inSystems ? '../' : '';
  const isHome = fileName() === 'index.html' || fileName() === '' || fileName() === '/';
  const isAuthPage = SKIP_PAGES.has(fileName());

  const isDashHref = (href) => {
    const h = String(href || '')
      .split('?')[0]
      .split('#')[0]
      .toLowerCase();
    return /(^|\/)dashboard\.html$/.test(h);
  };

  const ensureStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .hub-control-nav {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
        z-index: 10060;
      }
      .hub-control-nav__logo {
        display: inline-flex;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        overflow: hidden;
        border: 1px solid rgba(15, 23, 42, 0.14);
        background: #fff;
        box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
        flex: 0 0 auto;
      }
      .hub-control-nav__logo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .hub-control-nav:not(.hub-control-nav--inline) {
        position: fixed;
        top: 12px;
        left: 12px;
        right: auto;
      }
      body:has(.top-nav) .hub-control-nav:not(.hub-control-nav--inline) {
        top: 10px;
      }
      header.top-nav .auth-actions {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
    `;
    document.head.appendChild(style);
  };

  const build = () => {
    const wrap = document.createElement('div');
    wrap.className = 'hub-control-nav';
    wrap.dataset.hubControlNav = '1';
    wrap.setAttribute('aria-label', 'التنقل إلى الرئيسية');

    const logo = document.createElement('a');
    logo.className = 'hub-control-nav__logo';
    logo.href = `${prefix}index.html`;
    logo.title = 'الصفحة الرئيسية — صفحة الهبوط';
    logo.setAttribute('aria-label', 'نايوش هوب — الصفحة الرئيسية');
    logo.innerHTML = `<img src="${prefix}assets/hub-icon-192.png" alt="نايوش هوب" />`;
    wrap.appendChild(logo);
    return wrap;
  };

  /** يحذف زر «لوحة التحكم» من الهيدر العام فقط — دون المساس بروابط أخرى داخل الصفحات */
  const stripPublicHeaderDash = (root = document) => {
    root.querySelectorAll?.('header.top-nav a, .auth-actions a, a.hub-control-nav__dash').forEach((a) => {
      if (a.classList.contains('hub-control-nav__dash')) {
        a.remove();
        return;
      }
      if (!a.closest('header.top-nav') && !a.closest('.auth-actions')) return;
      if (!isDashHref(a.getAttribute('href'))) return;
      const label = (a.textContent || '').replace(/\s+/g, ' ').trim();
      if (label === 'لوحة التحكم') a.remove();
    });
  };

  const host = () => {
    if (isAuthPage) return { el: null, inline: false, skip: true };

    const inner = document.querySelector('header.top-nav .inner') || document.querySelector('header.top-nav .container.inner');
    if (inner) {
      let auth = inner.querySelector('.auth-actions');
      if (!auth) {
        auth = document.createElement('div');
        auth.className = 'auth-actions';
        inner.appendChild(auth);
      }
      return { el: auth, inline: true };
    }

    const rolesActions =
      document.querySelector('[data-hub-control-host]') ||
      document.querySelector('nav.sticky .flex.justify-between > .flex.items-center.gap-4');
    if (rolesActions) return { el: rolesActions, inline: true };

    const topbar = document.querySelector('.topbar-actions');
    if (topbar) return { el: topbar, inline: true };

    return { el: document.body, inline: false };
  };

  const mount = () => {
    if (window.HubControlNav.mounted) return;
    ensureStyle();
    // دائمًا: أزل زر لوحة التحكم من الهيدر العام (يشمل الرئيسية حتى لو تُتخطى الحقن)
    stripPublicHeaderDash(document);

    if (document.querySelector('[data-hub-control-nav]')) {
      window.HubControlNav.mounted = true;
      return;
    }
    const { el, inline, skip } = host();
    if (skip || !el) {
      window.HubControlNav.mounted = true;
      return;
    }
    const wrap = build();
    if (inline) {
      wrap.classList.add('hub-control-nav--inline');
      stripPublicHeaderDash(el);
      el.appendChild(wrap);
    } else {
      el.appendChild(wrap);
    }
    window.HubControlNav.mounted = true;
  };

  window.HubControlNav.mount = mount;
  window.HubControlNav.stripPublicHeaderDash = stripPublicHeaderDash;
  window.HubControlNav.isHome = isHome;
  window.HubControlNav.isAuthPage = isAuthPage;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
