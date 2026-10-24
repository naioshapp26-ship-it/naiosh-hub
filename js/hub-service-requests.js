/**
 * طلبات الخدمة العامة — استشارة · مقترحات · شكاوي
 * الحفظ الدائم عبر /api/client/* عند تسجيل الدخول؛ بدون جلسة لا يُعرض نجاح وهمي.
 */
(() => {
  'use strict';

  const KEY = 'naiosh_hub_service_requests_v1';

  const LABELS = {
    consultation: 'استشارة',
    suggestion: 'مقترح',
    complaint: 'شكوى',
  };

  const TYPE_BY_KIND = {
    consultation: 'CONSULTATION',
    suggestion: 'SUGGESTION',
    complaint: 'COMPLAINT',
  };

  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  };

  const save = (list) => {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)));
    return list;
  };

  const authHeaders = () => {
    const h =
      (window.HubAuth && typeof window.HubAuth.authHeaders === 'function' && window.HubAuth.authHeaders({ 'Content-Type': 'application/json' })) ||
      {};
    if (!h['Content-Type']) h['Content-Type'] = 'application/json';
    return h;
  };

  const isLoggedIn = () => !!(window.HubAuth && typeof window.HubAuth.isLoggedIn === 'function' && window.HubAuth.isLoggedIn());

  const loginUrl = () => {
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    return `login.html?next=${next}`;
  };

  const mirrorLocal = (item) => {
    const list = read();
    list.unshift(item);
    save(list);
    try {
      const notes = JSON.parse(localStorage.getItem('naiosh_hub_notifications_v1') || '[]');
      notes.unshift({
        id: `n-${Date.now()}`,
        title: `${LABELS[item.kind] || 'طلب'} جديد`,
        body: item.title,
        href:
          item.kind === 'complaint'
            ? 'complaints.html'
            : item.kind === 'suggestion'
              ? 'suggestions.html'
              : 'consultation.html',
        at: new Date().toISOString(),
      });
      localStorage.setItem('naiosh_hub_notifications_v1', JSON.stringify(notes.slice(0, 40)));
    } catch {
      /* ignore */
    }
    return item;
  };

  /**
   * @returns {Promise<{ ok: boolean, item?: object, needsLogin?: boolean, error?: string, durable?: boolean }>}
   */
  const create = async (payload = {}) => {
    const kind = payload.kind || 'consultation';
    const title = String(payload.title || '').trim();
    const body = String(payload.body || '').trim();
    if (!title) return { ok: false, error: 'أدخل عنوانًا واضحًا للطلب' };
    if (!body) return { ok: false, error: 'نص الطلب مطلوب' };

    if (!isLoggedIn()) {
      return {
        ok: false,
        needsLogin: true,
        error: 'سجّل الدخول كعميل لإرسال الطلب إلى غرفة العمليات. لن يُحفظ الطلب محليًا فقط.',
        loginUrl: loginUrl(),
      };
    }

    const idem =
      String(payload.idempotencyKey || '').trim() ||
      `srv-${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      if (kind === 'complaint') {
        const res = await fetch('/api/client/complaints', {
          method: 'POST',
          headers: { ...authHeaders(), 'Idempotency-Key': idem },
          body: JSON.stringify({
            subject: title,
            title,
            message: body,
            body,
            type: 'COMPLAINT',
            priority: payload.priority || 'NORMAL',
            systemCode: payload.system || 'HUB',
            idempotencyKey: idem,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) {
          return { ok: false, error: json.error || json.message || `تعذر حفظ الشكوى (${res.status})` };
        }
        const c = json.complaint || {};
        const item = {
          id: c.id || `srv-${Date.now().toString(36)}`,
          kind,
          title,
          body,
          system: payload.system || 'HUB',
          category: payload.category || '',
          priority: payload.priority || 'عادي',
          fullName: String(payload.fullName || '').trim(),
          phone: String(payload.phone || '').trim(),
          email: String(payload.email || window.HubAuth?.getUser?.()?.email || '').trim(),
          status: c.status || 'OPEN',
          createdAt: c.created_at || c.createdAt || new Date().toISOString(),
          durable: true,
          serverId: c.id,
          attachLink: String(payload.attachLink || '').trim(),
          attachDocUrl: String(payload.attachDocUrl || '').trim(),
          attachDocName: String(payload.attachDocName || '').trim(),
          attachImageUrl: String(payload.attachImageUrl || '').trim(),
          attachVideoUrl: String(payload.attachVideoUrl || '').trim(),
        };
        mirrorLocal(item);
        return { ok: true, item, durable: true };
      }

      const res = await fetch('/api/client/requests', {
        method: 'POST',
        headers: { ...authHeaders(), 'Idempotency-Key': idem },
        body: JSON.stringify({
          subject: title,
          title,
          message: body,
          body,
          type: TYPE_BY_KIND[kind] || 'OTHER',
          kind: TYPE_BY_KIND[kind] || kind,
          priority: payload.priority || 'NORMAL',
          systemCode: payload.system || 'HUB',
          serviceId: payload.serviceId || '',
          serviceTitle: payload.serviceTitle || '',
          idempotencyKey: idem,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        return { ok: false, error: json.error || json.message || `تعذر حفظ الطلب (${res.status})` };
      }
      const r = json.request || {};
      const item = {
        id: r.id || `srv-${Date.now().toString(36)}`,
        kind,
        title,
        body,
        system: payload.system || 'HUB',
        category: payload.category || '',
        priority: payload.priority || 'عادي',
        fullName: String(payload.fullName || '').trim(),
        phone: String(payload.phone || '').trim(),
        email: String(payload.email || window.HubAuth?.getUser?.()?.email || '').trim(),
        preferredAt: payload.preferredAt || '',
        contactMethod: payload.contactMethod || '',
        reference: payload.reference || '',
        serviceId: String(payload.serviceId || '').trim(),
        serviceTitle: String(payload.serviceTitle || '').trim(),
        attachLink: String(payload.attachLink || '').trim(),
        attachDocUrl: String(payload.attachDocUrl || '').trim(),
        attachDocName: String(payload.attachDocName || '').trim(),
        attachImageUrl: String(payload.attachImageUrl || '').trim(),
        attachVideoUrl: String(payload.attachVideoUrl || '').trim(),
        status: r.status || 'NEW',
        createdAt: r.created_at || r.createdAt || new Date().toISOString(),
        durable: true,
        serverId: r.id,
        number: r.number || '',
      };
      mirrorLocal(item);
      return { ok: true, item, durable: true, duplicate: !!json.duplicate };
    } catch (err) {
      return { ok: false, error: err.message || 'تعذر الاتصال بالخادم' };
    }
  };

  const byKind = (kind) => read().filter((x) => x.kind === kind);

  window.HubServiceRequests = { KEY, LABELS, read, create, byKind, loginUrl };
})();
