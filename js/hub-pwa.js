(() => {
  'use strict';

  /**
   * NAIOSH HUB PWA — same UX + architecture as NAIS:
   * header button "نزّل التطبيق"
   * small tooltip under the button
   * deferred beforeinstallprompt → __HUB_DEFERRED_PROMPT__ + hub:beforeinstallprompt
   */

  const LABELS = {
    ariaInstall: 'تثبيت تطبيق نايوش هوب',
    button: 'نزّل التطبيق',
    installed: 'مثبت بالفعل',
    installedTitle: 'تطبيق نايوش هوب مثبت على هذا الجهاز',
    success: 'تم تثبيت التطبيق بنجاح',
    cancelled: 'تم إلغاء التثبيت',
    pending: 'جارٍ تجهيز خيار التثبيت... إن لم تظهر النافذة استخدم أيقونة التثبيت بالمتصفح',
    manual: 'التثبيت متاح من أيقونة التثبيت أو قائمة المتصفح',
    failed: 'تعذر بدء التثبيت',
  };

  let deferredPrompt = null;
  let installState = 'pending';
  let tipEl = null;
  let tipTimer = null;
  let installBtn = null;
  let installedBadge = null;

  const isChromiumInstallCapable = () => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return (
      !/iPhone|iPad|iPod/.test(ua) &&
      /Chrome\/|Edg\/|OPR\/|SamsungBrowser\//.test(ua) &&
      !/Firefox\//.test(ua)
    );
  };

  const isStandalone = () => {
    const mq = window.matchMedia('(display-mode: standalone)');
    const iosStandalone = 'standalone' in window.navigator && window.navigator.standalone === true;
    return mq.matches || iosStandalone;
  };

  const showTip = (message) => {
    if (!tipEl || !message) return;
    tipEl.textContent = message;
    tipEl.hidden = false;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => {
      if (tipEl) tipEl.hidden = true;
    }, 7000);
  };

  const setState = (next) => {
    installState = next;
    document.documentElement.dataset.hubPwaState = next;

    if (next === 'installed') {
      if (installBtn) installBtn.hidden = true;
      if (installedBadge) {
        installedBadge.hidden = false;
        installedBadge.title = LABELS.installedTitle;
        installedBadge.setAttribute('aria-label', LABELS.installedTitle);
      }
    } else {
      if (installBtn) {
        installBtn.hidden = false;
        installBtn.disabled = false;
      }
      if (installedBadge) installedBadge.hidden = true;
    }
  };

  const capturePrompt = (event) => {
    if (!event) return;
    try {
      event.preventDefault();
    } catch (_) {
      /* already prevented */
    }
    window.__HUB_DEFERRED_PROMPT__ = event;
    deferredPrompt = event;
    setState('available');
  };

  const waitForPrompt = (ms) =>
    new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        window.removeEventListener('hub:beforeinstallprompt', onCustom);
        window.removeEventListener('beforeinstallprompt', onNative);
        resolve(value);
      };
      const onCustom = (e) => {
        if (e.detail) finish(e.detail);
      };
      const onNative = (e) => {
        try {
          e.preventDefault();
        } catch (_) {}
        finish(e);
      };
      window.addEventListener('hub:beforeinstallprompt', onCustom, { once: true });
      window.addEventListener('beforeinstallprompt', onNative, { once: true });
      const timer = setTimeout(() => finish(null), ms);
      if (window.__HUB_DEFERRED_PROMPT__) finish(window.__HUB_DEFERRED_PROMPT__);
    });

  const promptInstall = async () => {
    let promptEvent = deferredPrompt || window.__HUB_DEFERRED_PROMPT__ || null;

    // User gesture often unlocks beforeinstallprompt — short wait like NAIS
    if (!promptEvent) {
      showTip(LABELS.pending);
      promptEvent = await waitForPrompt(1200);
      if (promptEvent) capturePrompt(promptEvent);
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
    if (result === 'accepted') showTip(LABELS.success);
    else if (result === 'dismissed') showTip(LABELS.cancelled);
    else if (result === 'pending' || installState === 'pending') showTip(LABELS.pending);
    else if (result === 'failed') showTip(LABELS.failed);
    else showTip(LABELS.manual);
  };

  const removeExtraUi = () => {
    document
      .querySelectorAll(
        '[data-hub-pwa-install-hero], [data-hub-pwa-install-float], [data-hub-pwa-guide], [data-hub-pwa-status]'
      )
      .forEach((el) => el.remove());
    document.body.classList.remove('hub-pwa-guide-open');
  };

  const ensureUi = () => {
    removeExtraUi();

    const auth = document.querySelector('header.top-nav .auth-actions');
    if (!auth) return;

    let wrapEl = auth.querySelector('[data-hub-pwa-root]');
    if (!wrapEl) {
      wrapEl = document.createElement('div');
      wrapEl.className = 'hub-pwa-actions';
      wrapEl.setAttribute('data-hub-pwa-root', '');

      installBtn = document.createElement('button');
      installBtn.type = 'button';
      installBtn.className = 'auth-btn hub-pwa-install-btn';
      installBtn.setAttribute('data-hub-pwa-install', '');
      installBtn.setAttribute('aria-label', LABELS.ariaInstall);
      installBtn.innerHTML =
        '<i class="fas fa-download" aria-hidden="true"></i><span>نزّل التطبيق</span>';

      installedBadge = document.createElement('span');
      installedBadge.className = 'auth-btn hub-pwa-installed-badge';
      installedBadge.setAttribute('data-hub-pwa-installed', '');
      installedBadge.setAttribute('aria-label', LABELS.installedTitle);
      installedBadge.title = LABELS.installedTitle;
      installedBadge.hidden = true;
      installedBadge.innerHTML =
        '<i class="fas fa-check-circle" aria-hidden="true"></i><span>مثبت بالفعل</span>';

      tipEl = document.createElement('span');
      tipEl.className = 'hub-pwa-tip';
      tipEl.setAttribute('data-hub-pwa-tip', '');
      tipEl.setAttribute('role', 'status');
      tipEl.setAttribute('aria-live', 'polite');
      tipEl.hidden = true;

      wrapEl.appendChild(installBtn);
      wrapEl.appendChild(installedBadge);
      wrapEl.appendChild(tipEl);
      auth.insertBefore(wrapEl, auth.firstChild);
    } else {
      installBtn = wrapEl.querySelector('[data-hub-pwa-install]');
      installedBadge = wrapEl.querySelector('[data-hub-pwa-installed]');
      tipEl = wrapEl.querySelector('[data-hub-pwa-tip]');
    }

    if (installBtn && !installBtn.dataset.hubPwaBound) {
      installBtn.dataset.hubPwaBound = '1';
      installBtn.addEventListener('click', onInstallClick);
    }
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
      showTip(LABELS.success);
    });

    const timeoutMs = isChromiumInstallCapable() ? 15000 : 60000;
    setTimeout(() => {
      if (installState === 'pending') setState('unsupported');
    }, timeoutMs);
  };

  const registerServiceWorker = () => {
    if (!('serviceWorker' in navigator)) return;

    const run = async () => {
      // One-time cleanup so users stuck on old hub-shell caches get a fresh SW (v3+)
      try {
        const ver = 'hub-pwa-v5';
        if (localStorage.getItem('hub-pwa-asset-ver') !== ver) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
          const keys = await caches.keys();
          await Promise.all(keys.filter((k) => String(k).startsWith('hub-shell-')).map((k) => caches.delete(k)));
          localStorage.setItem('hub-pwa-asset-ver', ver);
          console.info('[HUB PWA] Cleared old Hub service worker/cache');
        }
      } catch (err) {
        console.warn('[HUB PWA] SW cleanup failed:', err);
      }

      fetch('/manifest.json', { cache: 'no-store' })
        .then((res) => {
          if (res.ok) console.info('[HUB PWA] Manifest loaded');
          else console.warn('[HUB PWA] Manifest fetch returned non-OK status:', res.status);
        })
        .catch((err) => console.warn('[HUB PWA] Manifest fetch failed:', err));

      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((reg) => {
          console.info('[HUB PWA] Service worker registered', reg.scope);
          try {
            reg.update();
          } catch (_) {}
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
            () => {
              console.info('[HUB PWA] Service worker now controlling page');
            },
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
