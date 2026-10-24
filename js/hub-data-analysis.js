/**
 * بوابة نظام تحليل البيانات — يربط أزرار الصفحة بالنظام المستقل الحي.
 * لا يجمع كلمات مرور داخل هوب؛ التسجيل والدخول داخل نظام التحليل فقط.
 */
(function () {
  'use strict';

  var FALLBACK = {
    url: 'https://www.naioshai.com/',
    loginUrl: 'https://www.naioshai.com/#login',
    signupUrl: 'https://www.naioshai.com/',
  };

  function cfg() {
    var live = window.HubLiveSystems && window.HubLiveSystems.get
      ? window.HubLiveSystems.get('ANALYSIS')
      : null;
    return {
      url: (live && live.url) || FALLBACK.url,
      loginUrl: (live && live.loginUrl) || FALLBACK.loginUrl,
      signupUrl: (live && live.signupUrl) || (live && live.url) || FALLBACK.signupUrl,
    };
  }

  function bind() {
    var c = cfg();
    document.querySelectorAll('[data-da-open]').forEach(function (el) {
      el.setAttribute('href', c.url);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    });
    document.querySelectorAll('[data-da-signup]').forEach(function (el) {
      el.setAttribute('href', c.signupUrl);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    });
    document.querySelectorAll('[data-da-login]').forEach(function (el) {
      el.setAttribute('href', c.loginUrl);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
