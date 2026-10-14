/**
 * NAIOSH HUB 360 — مصدر مركزي لهوية الشعار العام.
 * حدّث المسارات هنا فقط عند اعتماد شعار رسمي جديد.
 */
(function (global) {
  'use strict';

  var VERSION = 'official1';

  var Brand = {
    version: VERSION,
    /** الشعار الرسمي الكامل (درع + HUB 360) */
    logoOfficial: 'assets/brand/naiosh-hub-360-official.jpg?v=' + VERSION,
    /** مسار التوافق المستخدم في معظم الصفحات */
    logoHub: 'assets/logo-hub.jpeg?v=' + VERSION,
    logoHubJpg: 'assets/logo-hub.jpg?v=' + VERSION,
    /** أيقونة مربّعة مشتقة من الدرع */
    icon192: 'assets/hub-icon-192.png?v=' + VERSION,
    icon512: 'assets/hub-icon-512.png?v=' + VERSION,
    favicon: 'assets/brand/favicon-32.png?v=' + VERSION,
    appleTouch: 'assets/brand/apple-touch-icon-180.png?v=' + VERSION,
    /** افتراضي عام للهوية */
    defaultLogo: 'assets/logo-hub.jpeg?v=' + VERSION,
    withVersion: function (path) {
      if (!path) return Brand.defaultLogo;
      if (String(path).indexOf('?') >= 0) return path;
      return path + (path.indexOf('v=') >= 0 ? '' : '?v=' + VERSION);
    },
  };

  global.HubBrand = Brand;
})(typeof window !== 'undefined' ? window : globalThis);
