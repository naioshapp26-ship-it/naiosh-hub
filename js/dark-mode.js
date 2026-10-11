/* Legacy entry — delegates to HubTheme (js/hub-theme.js). */
(function () {
  'use strict';
  function boot() {
    if (window.HubTheme) return;
    var s = document.createElement('script');
    s.src = 'js/hub-theme.js?v=theme2';
    s.defer = true;
    document.head.appendChild(s);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
