/**
 * محمّل خفيف لبيانات المشاريع — الصفحة تظهر فورًا ثم تُحمَّل البيانات مضغوطة.
 */
(() => {
  'use strict';

  const DATA_URL = 'js/hub-side-projects-data.json?v=1';
  const APP_URL = 'js/hub-side-projects.js?v=10';

  const root = document.querySelector('[data-side-projects-page]');
  if (!root) return;

  const markLoading = (on) => {
    root.classList.toggle('is-data-loading', on);
    let el = root.querySelector('[data-sp-data-loading]');
    if (on && !el) {
      el = document.createElement('p');
      el.className = 'sp-data-loading';
      el.setAttribute('data-sp-data-loading', '');
      el.setAttribute('role', 'status');
      el.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تحميل كتالوج المشاريع…';
      root.insertBefore(el, root.firstChild?.nextSibling || null);
    }
    if (!on && el) el.remove();
  };

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`failed ${src}`));
      document.body.appendChild(s);
    });

  const boot = async () => {
    markLoading(true);
    try {
      if (!window.HubSideProjectsData?.projects) {
        const res = await fetch(DATA_URL, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        window.HubSideProjectsData = await res.json();
      }
      await loadScript(APP_URL);
      markLoading(false);
    } catch (err) {
      console.error(err);
      const el = root.querySelector('[data-sp-data-loading]') || document.createElement('p');
      el.className = 'sp-data-loading is-error';
      el.setAttribute('data-sp-data-loading', '');
      el.setAttribute('role', 'alert');
      el.innerHTML =
        '<i class="fas fa-triangle-exclamation"></i> تعذر تحميل كتالوج المشاريع. حدّث الصفحة أو حاول لاحقًا.';
      if (!el.parentNode) root.prepend(el);
      root.classList.remove('is-data-loading');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
