/**
 * دومينات الأنظمة الحية — مصدر مشترك لسيرفر هوب (جسر SSO).
 * يطابق js/hub-live-systems.js قدر الإمكان.
 */
const LIVE = {
  ERP: {
    url: 'https://web-production-419e2.up.railway.app/',
    label: 'نايوش إي آر بي',
  },
  NAIS: {
    url: 'https://nais-production.up.railway.app/',
    label: 'نايس',
  },
  LAW: {
    url: 'https://naiosh-law-production.up.railway.app/',
    label: 'نايوش لو',
  },
  ACADEMY: {
    url: 'https://betacdmy-production.up.railway.app/',
    label: 'أكاديمية نايوش',
  },
  FIT: {
    url: 'https://naioshfit-production-f0b4.up.railway.app/',
    label: 'نايوش فيت',
  },
  SMARTX: {
    url: 'https://smrttx.com/',
    label: 'سمارتكس',
  },
  EDUSMARTX: {
    url: 'https://edusmrttx.com/',
    label: 'إيديو سمارتكس',
  },
  EDUNAIOSH: {
    url: 'https://edunaiosh.com/',
    label: 'إيديو نايوش',
  },
};

const get = (code) => LIVE[String(code || '').toUpperCase()] || null;
const url = (code) => get(code)?.url || null;

module.exports = { LIVE, get, url };
