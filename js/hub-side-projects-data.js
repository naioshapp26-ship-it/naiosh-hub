/**
 * توافق خلفي — يحمّل كتالوج المشاريع من JSON المضغوط بدل ملف 1.8MB المتزامن.
 * الصفحات الجديدة تستخدم hub-side-projects-boot.js
 */
(() => {
  'use strict';
  if (window.HubSideProjectsData?.projects) return;

  const url = 'js/hub-side-projects-data.json?v=1';
  window.HubSideProjectsDataReady = fetch(url, { credentials: 'same-origin' })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      window.HubSideProjectsData = data;
      window.dispatchEvent(new CustomEvent('hub-side-projects-data-ready', { detail: data }));
      return data;
    })
    .catch((err) => {
      console.error('HubSideProjectsData load failed', err);
      window.HubSideProjectsData = window.HubSideProjectsData || { projects: [], categories: [], formFields: [] };
      return window.HubSideProjectsData;
    });
})();
