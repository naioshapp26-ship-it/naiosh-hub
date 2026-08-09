/**
 * دومينات الأنظمة الحية المعروضة في هوب
 * أضف هنا أي نظام جديد لما يوصّل الدومين من العميل.
 */
(() => {
  'use strict';

  const LIVE = {
    ERP: {
      url: 'https://web-production-419e2.up.railway.app/',
      domain: 'web-production-419e2.up.railway.app',
      openInNewTab: true,
      label: 'نايوش إي آر بي (مباشر)',
    },
    // LAW: { url: 'https://…', domain: '…', openInNewTab: true },
    // FIT: { url: 'https://…', domain: '…', openInNewTab: true },
    // NAIS: { url: 'https://…', domain: '…', openInNewTab: true },
    // ACADEMY: { url: 'https://…', domain: '…', openInNewTab: true },
    // LMS: { url: 'https://…', domain: '…', openInNewTab: true },
    // CRM: { url: 'https://…', domain: '…', openInNewTab: true },
  };

  const get = (code) => LIVE[String(code || '').toUpperCase()] || null;
  const url = (code) => get(code)?.url || null;
  const isLive = (code) => Boolean(url(code));

  window.HubLiveSystems = { LIVE, get, url, isLive };
})();
