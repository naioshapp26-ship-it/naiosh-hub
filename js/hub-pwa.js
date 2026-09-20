(() => {
  'use strict';

  /**
   * NAIOSH HUB PWA — same architecture as NAIS:
   * deferred beforeinstallprompt → __HUB_DEFERRED_PROMPT__ + hub:beforeinstallprompt
   * states: pending | available | unsupported | installed | dismissed
   * Chromium timeout 15s / other 60s → unsupported
   * prompt() + userChoice; appinstalled → installed
   * SW register /sw.js scope /
   */

  const LABELS = {
    install: 'تثبيت تطبيق نايوش هوب',
    installed: 'تطبيق نايوش هوب مثبت على هذا الجهاز',
    installedShort: 'التطبيق مثبت',
    success: 'تم تثبيت التطبيق بنجاح',
    cancelled: 'تم إلغاء التثبيت',
    pending: 'جارٍ تجهيز خيار التثبيت... إن لم تظهر النافذة استخدم قائمة المتصفح لإضافة التطبيق',
    manual: 'استخدم خيارات المتصفح لإضافة التطبيق إلى جهازك',
    failed: 'تعذر بدء التثبيت',
  };

  let deferredPrompt = null;
  let installState = 'pending';
  let statusEl = null;
  let installBtn = null;
  let installedBadge = null;

  const isStandalone = () => {
    const mq = window.matchMedia('(display-mode: standalone)');
    const iosStandalone = 'standalone' in window.navigator && window.navigator.standalone === true;
    return mq.matches || iosStandalone;
  };

  const isChromiumInstallCapable = () => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return (
      !/iPhone|iPad|iPod/.test(ua) &&
      /Chrome\/|Edg\/|OPR\/|SamsungBrowser\//.test(ua) &&
      !/Firefox\//.test(ua)
    );
  };

  const setStatus = (message) => {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.hidden = !message;
  };

  const syncHeroVisibility = () => {
    document.querySelectorAll('[data-hub-pwa-install-hero]').forEach((btn) => {
      btn.hidden = installState === 'installed';
    });
  };

  const setState = (next) => {
    installState = next;
    document.documentElement.dataset.hubPwaState = next;

    if (next === 'installed') {
      if (installBtn) installBtn.hidden = true;
      if (installedBadge) {
        installedBadge.hidden = false;
        installedBadge.title = LABELS.installed;
        installedBadge.setAttribute('aria-label', LABELS.installed);
      }
    } else {
      if (installBtn) {
        installBtn.hidden = false;
        installBtn.disabled = false;
      }
      if (installedBadge) installedBadge.hidden = true;
    }
    syncHeroVisibility();
  };

  const capturePrompt = (event) => {
    if (!event) return;
    try {
      event.preventDefault();
    } catch (_) {
      /* already prevented by early capture */
    }
    window.__HUB_DEFERRED_PROMPT__ = event;
    deferredPrompt = event;
    setState('available');
  };

  const promptInstall = async () => {
    let promptEvent = deferredPrompt || window.__HUB_DEFERRED_PROMPT__ || null;

    if (!promptEvent) {
      promptEvent = await new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          window.removeEventListener('hub:beforeinstallprompt', onCustom);
          resolve(value);
        };
        const onCustom = (e) => {
          if (e.detail) finish(e.detail);
        };
        window.addEventListener('hub:beforeinstallprompt', onCustom, { once: true });
        const timer = setTimeout(() => finish(null), 1200);
        if (window.__HUB_DEFERRED_PROMPT__) finish(window.__HUB_DEFERRED_PROMPT__);
      });
    }

    if (!promptEvent) {
      if (installState === 'pending') return 'pending';
      return 'unavailable';
    }

    try {
      console.info('[HUB PWA] Prompt shown');
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      console.info('[HUB PWA] User choice result', outcome);
      window.__HUB_DEFERRED_PROMPT__ = null;
      deferredPrompt = null;
      if (outcome === 'accepted') setState('installed');
      if (outcome === 'dismissed') setState('dismissed');
      return outcome;
    } catch (err) {
      console.warn('[HUB PWA] prompt failed', err);
      return 'failed';
    }
  };

  const onInstallClick = async () => {
    console.info('[HUB PWA] Install button clicked');
    const result = await promptInstall();
    if (result === 'accepted') setStatus(LABELS.success);
    else if (result === 'dismissed') setStatus(LABELS.cancelled);
    else if (result === 'pending' || installState === 'pending') setStatus(LABELS.pending);
    else if (result === 'failed') setStatus(LABELS.failed);
    else setStatus(LABELS.manual);
  };

  const ensureUi = () => {
    const auth = document.querySelector('header.top-nav .auth-actions');
    if (!auth) return;

    if (!auth.querySelector('[data-hub-pwa-install]')) {
      const wrap = document.createElement('div');
      wrap.className = 'hub-pwa-actions';
      wrap.setAttribute('data-hub-pwa-root', '');

      installBtn = document.createElement('button');
      installBtn.type = 'button';
      installBtn.className = 'auth-btn hub-pwa-install-btn';
      installBtn.setAttribute('data-hub-pwa-install', '');
      installBtn.setAttribute('aria-label', LABELS.install);
      installBtn.innerHTML =
        '<i class="fas fa-download" aria-hidden="true"></i><span>تثبيت تطبيق نايوش هوب</span>';

      installedBadge = document.createElement('span');
      installedBadge.className = 'auth-btn hub-pwa-installed-badge';
      installedBadge.setAttribute('data-hub-pwa-installed', '');
      installedBadge.setAttribute('aria-label', LABELS.installed);
      installedBadge.title = LABELS.installed;
      installedBadge.hidden = true;
      installedBadge.innerHTML =
        '<i class="fas fa-check-circle" aria-hidden="true"></i><span>التطبيق مثبت</span>';

      wrap.appendChild(installBtn);
      wrap.appendChild(installedBadge);
      auth.insertBefore(wrap, auth.firstChild);
    } else {
      installBtn = auth.querySelector('[data-hub-pwa-install]');
      installedBadge = auth.querySelector('[data-hub-pwa-installed]');
    }

    statusEl = document.querySelector('[data-hub-pwa-status]');
    if (!statusEl) {
      statusEl = document.createElement('p');
      statusEl.className = 'hub-pwa-status';
      statusEl.setAttribute('data-hub-pwa-status', '');
      statusEl.setAttribute('role', 'status');
      statusEl.setAttribute('aria-live', 'polite');
      statusEl.hidden = true;
      const header = document.querySelector('header.top-nav');
      if (header) header.insertAdjacentElement('afterend', statusEl);
      else auth.appendChild(statusEl);
    }

    const heroCtas = document.querySelector('.hero-ctas');
    if (heroCtas && !heroCtas.querySelector('[data-hub-pwa-install-hero]')) {
      const heroBtn = document.createElement('button');
      heroBtn.type = 'button';
      heroBtn.className = 'btn hero-cta-pill hub-pwa-hero-btn';
      heroBtn.setAttribute('data-hub-pwa-install-hero', '');
      heroBtn.setAttribute('aria-label', LABELS.install);
      heroBtn.innerHTML =
        '<i class="fas fa-mobile-screen-button" aria-hidden="true"></i> تثبيت تطبيق نايوش هوب';
      heroCtas.appendChild(heroBtn);
    }

    document.querySelectorAll('[data-hub-pwa-install], [data-hub-pwa-install-hero]').forEach((btn) => {
      btn.addEventListener('click', onInstallClick);
    });
  };

  const bootListeners = () => {
    if (isStandalone()) {
      setState('installed');
      return;
    }

    if (window.__HUB_DEFERRED_PROMPT__) {
      deferredPrompt = window.__HUB_DEFERRED_PROMPT__;
      setState('available');
    }

    window.addEventListener('beforeinstallprompt', (event) => {
      console.info('[HUB PWA] beforeinstallprompt received in hook');
      capturePrompt(event);
    });

    window.addEventListener('hub:beforeinstallprompt', (event) => {
      if (event.detail) {
        deferredPrompt = event.detail;
        window.__HUB_DEFERRED_PROMPT__ = event.detail;
        setState('available');
      }
    });

    window.addEventListener('appinstalled', () => {
      setState('installed');
      deferredPrompt = null;
      window.__HUB_DEFERRED_PROMPT__ = null;
      setStatus(LABELS.success);
    });

    const timeoutMs = isChromiumInstallCapable() ? 15000 : 60000;
    setTimeout(() => {
      if (installState === 'pending') setState('unsupported');
    }, timeoutMs);
  };

  const registerServiceWorker = () => {
    if (!('serviceWorker' in navigator)) return;

    const run = () => {
      fetch('/manifest.json')
        .then((res) => {
          if (res.ok) console.info('[HUB PWA] Manifest loaded');
          else console.warn('[HUB PWA] Manifest fetch returned non-OK status:', res.status);
        })
        .catch((err) => console.warn('[HUB PWA] Manifest fetch failed:', err));

      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.info('[HUB PWA] Service worker registered', reg.scope);
          return navigator.serviceWorker.ready;
        })
        .then(() => {
          console.info('[HUB PWA] Service worker active');
          if (navigator.serviceWorker.controller) {
            console.info('[HUB PWA] Service worker controlling page');
            return;
          }
          console.info('[HUB PWA] Service worker not controlling yet, waiting for controllerchange');
          navigator.serviceWorker.addEventListener(
            'controllerchange',
            () => console.info('[HUB PWA] Service worker now controlling page'),
            { once: true }
          );
        })
        .catch((err) => console.warn('[HUB PWA] Service worker registration failed:', err));
    };

    if (document.readyState === 'complete') run();
    else window.addEventListener('load', run, { once: true });
  };

  const init = () => {
    ensureUi();
    bootListeners();
    registerServiceWorker();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
