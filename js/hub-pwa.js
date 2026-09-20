(() => {
  'use strict';

  /**
   * NAIOSH HUB PWA — same architecture as NAIS + soft install notice:
   * header button "نزّل التطبيق"
   * auto notification that keeps appearing until the app is installed
   * deferred beforeinstallprompt → __HUB_DEFERRED_PROMPT__ + hub:beforeinstallprompt
   */

  const LABELS = {
    ariaInstall: 'تثبيت تطبيق نايوش هوب',
    button: 'نزّل التطبيق',
    installed: 'مثبت بالفعل',
    installedTitle: 'تطبيق نايوش هوب مثبت على هذا الجهاز',
    success: 'تم تثبيت التطبيق بنجاح',
    cancelled: 'تم إلغاء التثبيت',
    pending: 'جارٍ تجهيز خيار التثبيت... إن لم تظهر النافذة استخدم أيقونة التثبيت في شريط العنوان',
    manual: 'اضغط أيقونة التثبيت في شريط العنوان أعلى الصفحة (بجانب النجمة) لإكمال التثبيت',
    failed: 'تعذر بدء التثبيت',
    noticeTitle: 'نزّل تطبيق نايوش هوب',
    noticeBody: 'ثبّت التطبيق على جهازك لفتحه بسرعة كتطبيق مستقل.',
    noticeClose: 'إخفاء الآن',
  };

  const DISMISS_KEY = 'hub-pwa-notice-dismissed-at';
  const DISMISS_MS = 45 * 60 * 1000; // يعود الإشعار بعد 45 دقيقة إن لم يُثبَّت

  let deferredPrompt = null;
  let installState = 'pending';
  let tipEl = null;
  let tipTimer = null;
  let installBtn = null;
  let installedBadge = null;
  let noticeEl = null;

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

  const isNoticeDismissedTemporarily = () => {
    try {
      const raw = sessionStorage.getItem(DISMISS_KEY) || localStorage.getItem(DISMISS_KEY);
      const at = Number(raw || 0);
      if (!at) return false;
      return Date.now() - at < DISMISS_MS;
    } catch (_) {
      return false;
    }
  };

  const markNoticeDismissed = () => {
    try {
      const now = String(Date.now());
      sessionStorage.setItem(DISMISS_KEY, now);
      localStorage.setItem(DISMISS_KEY, now);
    } catch (_) {}
  };

  const clearNoticeDismissed = () => {
    try {
      sessionStorage.removeItem(DISMISS_KEY);
      localStorage.removeItem(DISMISS_KEY);
    } catch (_) {}
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

  const syncNotice = () => {
    if (!noticeEl) return;
    if (installState === 'installed' || isStandalone()) {
      noticeEl.hidden = true;
      return;
    }
    if (isNoticeDismissedTemporarily()) {
      noticeEl.hidden = true;
      return;
    }
    noticeEl.hidden = false;
  };

  const setState = (next) => {
    installState = next;
    document.documentElement.dataset.hubPwaState = next;

    if (next === 'installed') {
      clearNoticeDismissed();
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
    syncNotice();
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
    if (result === 'accepted') {
      showTip(LABELS.success);
      syncNotice();
    } else if (result === 'dismissed') showTip(LABELS.cancelled);
    else if (result === 'pending' || installState === 'pending') showTip(LABELS.pending);
    else if (result === 'failed') showTip(LABELS.failed);
    else showTip(LABELS.manual);
  };

  const ensureNotice = () => {
    noticeEl = document.querySelector('[data-hub-pwa-notice]');
    if (!noticeEl) {
      noticeEl = document.createElement('div');
      noticeEl.className = 'hub-pwa-notice';
      noticeEl.setAttribute('data-hub-pwa-notice', '');
      noticeEl.setAttribute('role', 'status');
      noticeEl.setAttribute('aria-live', 'polite');
      noticeEl.hidden = true;
      noticeEl.innerHTML = `
        <div class="hub-pwa-notice-inner">
          <div class="hub-pwa-notice-icon" aria-hidden="true"><i class="fas fa-download"></i></div>
          <div class="hub-pwa-notice-copy">
            <strong>${LABELS.noticeTitle}</strong>
            <span>${LABELS.noticeBody}</span>
          </div>
          <button type="button" class="hub-pwa-notice-cta" data-hub-pwa-notice-install aria-label="${LABELS.ariaInstall}">
            ${LABELS.button}
          </button>
          <button type="button" class="hub-pwa-notice-close" data-hub-pwa-notice-close aria-label="${LABELS.noticeClose}">×</button>
        </div>`;
      document.body.appendChild(noticeEl);
    }

    const cta = noticeEl.querySelector('[data-hub-pwa-notice-install]');
    const closeBtn = noticeEl.querySelector('[data-hub-pwa-notice-close]');
    if (cta && !cta.dataset.hubPwaBound) {
      cta.dataset.hubPwaBound = '1';
      cta.addEventListener('click', onInstallClick);
    }
    if (closeBtn && !closeBtn.dataset.hubPwaBound) {
      closeBtn.dataset.hubPwaBound = '1';
      closeBtn.addEventListener('click', () => {
        markNoticeDismissed();
        syncNotice();
      });
    }
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
    ensureNotice();

    const auth = document.querySelector('header.top-nav .auth-actions');
    if (!auth) {
      syncNotice();
      return;
    }

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

    // إشعار يظهر تلقائيًا ويظل يعود حتى التثبيت
    setTimeout(() => syncNotice(), 1200);
    setInterval(() => {
      if (installState !== 'installed' && !isStandalone()) syncNotice();
    }, 60 * 1000);
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
      try {
        const ver = 'hub-pwa-v7';
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
