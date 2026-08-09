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
    NAIS: {
      url: 'https://nais-production.up.railway.app/',
      domain: 'nais-production.up.railway.app',
      openInNewTab: true,
      label: 'نايس (مباشر)',
    },
    LAW: {
      url: 'https://naiosh-law-production.up.railway.app/',
      domain: 'naiosh-law-production.up.railway.app',
      openInNewTab: true,
      label: 'نايوش لو (مباشر)',
    },
    ACADEMY: {
      url: 'https://betacdmy-production.up.railway.app/',
      domain: 'betacdmy-production.up.railway.app',
      openInNewTab: true,
      label: 'أكاديمية نايوش (مباشر)',
    },
    FIT: {
      url: 'https://naioshfit-production-f0b4.up.railway.app/',
      domain: 'naioshfit-production-f0b4.up.railway.app',
      openInNewTab: true,
      label: 'نايوش فيت (مباشر)',
    },
    SMARTX: {
      url: 'https://smrttx.com/',
      domain: 'smrttx.com',
      openInNewTab: true,
      label: 'سمارتكس (مباشر)',
    },
    EDUSMARTX: {
      url: 'https://edusmrttx.com/',
      domain: 'edusmrttx.com',
      openInNewTab: true,
      label: 'إيديو سمارتكس (مباشر)',
    },
    EDUNAIOSH: {
      url: 'https://edunaiosh.com/',
      domain: 'edunaiosh.com',
      openInNewTab: true,
      label: 'نايوش (مباشر)',
    },
  };

  const get = (code) => LIVE[String(code || '').toUpperCase()] || null;
  const url = (code) => get(code)?.url || null;
  const isLive = (code) => Boolean(url(code));

  window.HubLiveSystems = { LIVE, get, url, isLive };
})();
