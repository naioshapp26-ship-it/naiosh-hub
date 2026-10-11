/**
 * NAIOSH HUB 360 — unified light / dark theme controller
 * - Persists preference in localStorage (`hubTheme` + legacy `theme`)
 * - Sets html[data-theme] and body.dark-mode
 * - Injects a labeled toggle into public / client / admin / auth chrome
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'hubTheme';
  var LEGACY_KEY = 'theme';
  var DARK_CLASS = 'dark-mode';

  function readStored() {
    try {
      var v = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
      if (v === 'dark' || v === 'light') return v;
    } catch (_) {}
    return null;
  }

  function writeStored(mode) {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
      localStorage.setItem(LEGACY_KEY, mode);
    } catch (_) {}
  }

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ||
      document.body.classList.contains(DARK_CLASS);
  }

  function applyTheme(mode) {
    var dark = mode === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    if (document.body) document.body.classList.toggle(DARK_CLASS, dark);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0c0d10' : '#d70000');
    syncButtons();
    try {
      window.dispatchEvent(new CustomEvent('hub:themechange', { detail: { theme: dark ? 'dark' : 'light' } }));
    } catch (_) {}
  }

  function syncButtons() {
    var dark = isDark();
    document.querySelectorAll('.hub-theme-toggle, .dark-mode-toggle').forEach(function (btn) {
      var label = dark ? 'الوضع النهاري' : 'الوضع الليلي';
      var icon = dark ? 'fa-sun' : 'fa-moon';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
      btn.setAttribute('data-theme-state', dark ? 'dark' : 'light');
      btn.innerHTML =
        '<i class="fas ' + icon + '" aria-hidden="true"></i>' +
        '<span class="hub-theme-toggle__text">' + label + '</span>';
    });
  }

  function toggle() {
    var next = isDark() ? 'light' : 'dark';
    writeStored(next);
    applyTheme(next);
  }

  function createButton() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hub-theme-toggle dark-mode-toggle';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      toggle();
    });
    return btn;
  }

  function ensureIn(host, opts) {
    if (!host) return null;
    var existing = host.querySelector('.hub-theme-toggle, .dark-mode-toggle');
    if (existing) return existing;
    var btn = createButton();
    if (opts && opts.prepend && host.firstChild) host.insertBefore(btn, host.firstChild);
    else host.appendChild(btn);
    return btn;
  }

  function injectButtons() {
    var placed = false;

    document.querySelectorAll('.auth-actions').forEach(function (el) {
      ensureIn(el, { prepend: true });
      placed = true;
    });

    document.querySelectorAll('.topbar-actions').forEach(function (el) {
      ensureIn(el, { prepend: true });
      placed = true;
    });

    document.querySelectorAll('.cp-top-actions').forEach(function (el) {
      ensureIn(el, { prepend: true });
      placed = true;
    });

    document.querySelectorAll('.pos-top-actions, .studio-top-actions, .mcs-top-actions, .evs-topbar-actions').forEach(function (el) {
      ensureIn(el, { prepend: true });
      placed = true;
    });

    /* Public top-nav without auth-actions */
    if (!placed) {
      document.querySelectorAll('header.top-nav .container.inner, header.top-nav .container, header.top-nav').forEach(function (el) {
        if (el.querySelector('.hub-theme-toggle, .dark-mode-toggle')) {
          placed = true;
          return;
        }
        ensureIn(el, { prepend: false });
        placed = true;
      });
    }

    /* Auth pages (login / register / forgot) — floating chip near card */
    if (!placed || document.body.classList.contains('bg-white') || document.querySelector('#loginForm, #registerForm, .auth-card')) {
      var authHosts = document.querySelectorAll(
        '#loginForm, #registerForm, form[action*="login"], .max-w-md.w-full, .auth-card, .login-card'
      );
      if (authHosts.length && !document.querySelector('.hub-theme-toggle--auth')) {
        var host = authHosts[0].closest('.max-w-md, .auth-card, .login-card') || authHosts[0].parentElement;
        if (host) {
          var wrap = document.createElement('div');
          wrap.className = 'hub-theme-toggle-wrap hub-theme-toggle-wrap--auth';
          var btn = createButton();
          btn.classList.add('hub-theme-toggle--auth');
          wrap.appendChild(btn);
          host.insertBefore(wrap, host.firstChild);
          placed = true;
        }
      }
    }

    /* Absolute fallback: floating control */
    if (!document.querySelector('.hub-theme-toggle, .dark-mode-toggle')) {
      var fab = document.createElement('div');
      fab.className = 'hub-theme-toggle-wrap hub-theme-toggle-wrap--fab';
      fab.appendChild(createButton());
      document.body.appendChild(fab);
    }

    syncButtons();
  }

  function ensureStylesheet() {
    if (document.querySelector('link[href*="hub-theme-modes.css"], link[href*="dark-mode.css"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/hub-theme-modes.css?v=1';
    document.head.appendChild(link);
  }

  function boot() {
    ensureStylesheet();
    var stored = readStored();
    var mode = stored || 'light';
    applyTheme(mode);
    injectButtons();
    /* Re-inject after delayed chrome (header builders) */
    setTimeout(injectButtons, 400);
    setTimeout(injectButtons, 1200);
    try {
      var obs = new MutationObserver(function () {
        if (!document.querySelector('.hub-theme-toggle, .dark-mode-toggle')) injectButtons();
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}
  }

  /* Expose for other modules */
  window.HubTheme = {
    get: function () { return isDark() ? 'dark' : 'light'; },
    set: function (mode) {
      var m = mode === 'dark' ? 'dark' : 'light';
      writeStored(m);
      applyTheme(m);
    },
    toggle: toggle,
    inject: injectButtons,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
