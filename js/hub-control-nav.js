/**
 * شعار صغير → صفحة الهبوط، وزر «لوحة التحكم» → غرفة العمليات.
 * يُحقن في أعلى يسار كل الصفحات حتى لا يبقى المستخدم محبوسًا داخل صفحات الإدارة.
 */
(() => {
  'use strict';

  if (window.HubControlNav) return;
  window.HubControlNav = { mounted: false };

  const STYLE_ID = 'hub-control-nav-style';
  const AUTH_PAGES = new Set([
    'login.html',
    'register.html',
    'register-freelancer.html',
    'sso-bridge.html',
  ]);
  const fileName = () => (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const inSystems = /\/systems\//i.test(window.location.pathname.replace(/\\/g, '/'));
  const prefix = inSystems ? '../' : '';
  const isDashboard = fileName() === 'dashboard.html';
  const isHome = fileName() === 'index.html' || fileName() === '' || fileName() === '/';
  const isAuthPage = AUTH_PAGES.has(fileName());

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
      .hub-control-nav__dash {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 36px;
        padding: 6px 12px;
        border-radius: 12px;
        background: linear-gradient(135deg, #b10011, #7a000c);
        color: #fff !important;
        font-family: Cairo, Tajawal, sans-serif;
        font-size: 13px;
        font-weight: 800;
        text-decoration: none !important;
        white-space: nowrap;
        box-shadow: 0 8px 18px rgba(177, 0, 17, 0.28);
      }
      .hub-control-nav__dash:hover,
      .hub-control-nav__dash:focus-visible {
        filter: brightness(1.08);
        color: #fff !important;
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
    `;
    document.head.appendChild(style);
  };

  const build = () => {
    const wrap = document.createElement('div');
    wrap.className = 'hub-control-nav';
    wrap.dataset.hubControlNav = '1';
    wrap.setAttribute('aria-label', 'التنقل إلى الرئيسية ولوحة التحكم');

    const logo = document.createElement('a');
    logo.className = 'hub-control-nav__logo';
    logo.href = `${prefix}index.html`;
    logo.title = 'الصفحة الرئيسية — صفحة الهبوط';
    logo.setAttribute('aria-label', 'نايوش هوب — الصفحة الرئيسية');
    logo.innerHTML = `<img src="${prefix}assets/logo-hub.jpeg" alt="نايوش هوب" />`;
    wrap.appendChild(logo);

    if (!isDashboard) {
      const dash = document.createElement('a');
      dash.className = 'hub-control-nav__dash';
      dash.href = `${prefix}dashboard.html`;
      dash.innerHTML = '<i class="fas fa-gauge-high" aria-hidden="true"></i><span>لوحة التحكم</span>';
      wrap.appendChild(dash);
    }
    return wrap;
  };

  const stripDuplicateDash = (root) => {
    root?.querySelectorAll?.('a').forEach((a) => {
      if (a.closest('[data-hub-control-nav]')) return;
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
      stripDuplicateDash(el);
      el.appendChild(wrap);
    } else {
      el.appendChild(wrap);
    }
    window.HubControlNav.mounted = true;
  };

  window.HubControlNav.mount = mount;
  window.HubControlNav.isHome = isHome;
  window.HubControlNav.isAuthPage = isAuthPage;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
