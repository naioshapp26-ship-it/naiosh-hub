/**
 * عميل API لاستوديوهات الحملات/الفعاليات على هوب.
 * مصدر البيانات الحقيقي: NAIOSH ERP (نفس endpoints استوديو الفعاليات).
 */
(() => {
  'use strict';

  const ERP_BASE = String(window.HUB_ERP_BASE || 'https://web-production-419e2.up.railway.app').replace(/\/$/, '');

  const resolve = (path) => {
    const raw = String(path || '');
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/api/events-studio')) return `${ERP_BASE}${raw}`;
    if (raw.startsWith('api/events-studio')) return `${ERP_BASE}/${raw}`;
    return raw;
  };

  const request = async (path, options = {}) => {
    const url = resolve(path);
    const opts = { credentials: options.credentials || 'omit', ...options };
    const headers = { ...(options.headers || {}) };
    const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
    if (!isForm && opts.body != null && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (isForm) {
      delete headers['Content-Type'];
      delete headers['content-type'];
    }
    opts.headers = headers;

    let response;
    try {
      response = await fetch(url, opts);
    } catch (err) {
      const e = new Error('تعذر الاتصال بخدمة الاستوديو. تحقق من الاتصال بالإنترنت ثم أعد المحاولة.');
      e.cause = err;
      e.status = 0;
      e.url = url;
      throw e;
    }

    if (!response.ok) {
      let body = {};
      try {
        body = await response.json();
      } catch (_) {}
      const msg =
        body.error ||
        body.message ||
        (response.status === 401
          ? 'يلزم تسجيل الدخول للوصول إلى بيانات الاستوديو.'
          : response.status === 403
            ? 'ليس لديك صلاحية للوصول إلى هذا الاستوديو.'
            : response.status === 404
              ? 'خدمة بيانات الاستوديو غير متاحة حالياً.'
              : `تعذر تحميل بيانات الاستوديو (رمز ${response.status}).`);
      const e = new Error(msg);
      e.status = response.status;
      e.body = body;
      e.url = url;
      throw e;
    }

    if (response.status === 204) return {};
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (err) {
      const e = new Error('استجابة غير صالحة من خدمة الاستوديو.');
      e.cause = err;
      e.status = response.status;
      e.url = url;
      throw e;
    }
  };

  window.HubStudioApi = { ERP_BASE, resolve, request };
})();
