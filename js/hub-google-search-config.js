/**
 * إعدادات محرك بحث Google — مصدر مركزي واحد (Site Settings)
 * لا تضع Search Engine ID (cx) في ملفات متعددة.
 */
(() => {
  'use strict';

  const SECTION = 'searchEngines';

  const defaults = () => ({
    google: {
      enabled: true,
      cx: '',
      cardTitle: 'محرك بحث جوجل',
      cardDescription: 'ابحث على الإنترنت باستخدام جوجل',
      resultsMode: 'web', // web = Google.com مباشرة | standalone = صفحة داخلية اختيارية
      openLinksInNewTab: true,
    },
  });

  const readFromSiteSettings = () => {
    try {
      const bag = window.HubSiteSettings?.get?.();
      if (bag?.[SECTION]) return bag[SECTION];
    } catch (_) {
      /* ignore */
    }
    try {
      const raw = JSON.parse(localStorage.getItem('naiosh_site_settings_v1') || 'null');
      if (raw?.[SECTION]) return raw[SECTION];
    } catch (_) {
      /* ignore */
    }
    return null;
  };

  const getGoogle = () => {
    const from = readFromSiteSettings()?.google || {};
    return { ...defaults().google, ...from };
  };

  const isEnabled = () => {
    const g = getGoogle();
    return g.enabled !== false;
  };

  const getCx = () => String(getGoogle().cx || '').trim();

  const hasCx = () => !!getCx();

  /** رابط بحث Google الحقيقي على الويب */
  const webSearchUrl = (q = '') => {
    const query = String(q || '').trim();
    if (!query) return '';
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  };

  /** للتوافق مع الصفحات القديمة — إن وُجد cx يمكن استخدام صفحة داخلية */
  const resultsUrl = (q = '') => {
    const query = String(q || '').trim();
    const mode = getGoogle().resultsMode;
    if (mode === 'web' || !hasCx()) return webSearchUrl(query);
    if (query) {
      try {
        sessionStorage.setItem('hubGoogleSearchQ', query);
      } catch (_) {
        /* ignore */
      }
    }
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    const qs = params.toString();
    return qs ? `google-search.html?${qs}` : 'google-search.html';
  };

  window.HubGoogleSearchConfig = {
    SECTION,
    defaults,
    getGoogle,
    isEnabled,
    getCx,
    hasCx,
    webSearchUrl,
    resultsUrl,
  };
})();
