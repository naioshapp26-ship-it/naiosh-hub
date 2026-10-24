/**
 * تذاكر الدعم والصيانة — حفظ دائم عبر /api/client/tickets عند تسجيل الدخول.
 * بدون جلسة: لا يُعرض نجاح وهمي لغرفة العمليات.
 */
(() => {
  'use strict';

  const KEY = 'naiosh_hub_support_tickets_v1';

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

  /**
   * @returns {Promise<{ ok: boolean, ticket?: object, needsLogin?: boolean, error?: string, durable?: boolean }>}
   */
  const create = async ({
    title,
    body,
    system = 'HUB',
    priority = 'عادي',
    attachLink = '',
    attachDocUrl = '',
    attachDocName = '',
    attachImageUrl = '',
    attachVideoUrl = '',
    idempotencyKey = '',
  } = {}) => {
    if (!title?.trim()) return { ok: false, error: 'أدخل عنوان التذكرة' };
    if (!isLoggedIn()) {
      return {
        ok: false,
        needsLogin: true,
        error: 'سجّل الدخول كعميل لفتح تذكرة تصل إلى الإدارة. لن تُحفظ التذكرة في المتصفح فقط.',
        loginUrl: loginUrl(),
      };
    }

    const idem =
      String(idempotencyKey || '').trim() ||
      `tkt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const res = await fetch('/api/client/tickets', {
        method: 'POST',
        headers: { ...authHeaders(), 'Idempotency-Key': idem },
        body: JSON.stringify({
          subject: title.trim(),
          title: title.trim(),
          message: (body || '').trim(),
          body: (body || '').trim(),
          systemCode: system,
          priority,
          idempotencyKey: idem,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        return { ok: false, error: json.error || json.message || `تعذر فتح التذكرة (${res.status})` };
      }
      const t = json.ticket || {};
      const ticket = {
        id: t.id || `tkt-${Date.now().toString(36)}`,
        title: title.trim(),
        body: (body || '').trim(),
        system,
        priority,
        attachLink: String(attachLink || '').trim(),
        attachDocUrl: String(attachDocUrl || '').trim(),
        attachDocName: String(attachDocName || '').trim(),
        attachImageUrl: String(attachImageUrl || '').trim(),
        attachVideoUrl: String(attachVideoUrl || '').trim(),
        status: t.status || 'OPEN',
        requester: window.HubAuth?.getUser?.()?.email || 'مستخدم هوب',
        createdAt: t.created_at || t.createdAt || new Date().toISOString(),
        updates: [],
        durable: true,
        serverId: t.id,
        number: t.number || '',
      };
      const list = read();
      list.unshift(ticket);
      save(list);
      try {
        const notes = JSON.parse(localStorage.getItem('naiosh_hub_notifications_v1') || '[]');
        notes.unshift({
          id: `n-${Date.now()}`,
          title: 'تذكرة دعم جديدة',
          body: ticket.title,
          href: 'support.html',
          at: new Date().toISOString(),
        });
        localStorage.setItem('naiosh_hub_notifications_v1', JSON.stringify(notes.slice(0, 40)));
      } catch {
        /* ignore */
      }
      return { ok: true, ticket, durable: true };
    } catch (err) {
      return { ok: false, error: err.message || 'تعذر الاتصال بالخادم' };
    }
  };

  const setStatus = (id, status) => {
    const list = read().map((t) =>
      String(t.id) === String(id)
        ? {
            ...t,
            status,
            updates: [...(t.updates || []), { at: new Date().toISOString(), status }],
          }
        : t
    );
    return save(list);
  };

  window.HubSupport = { KEY, read, create, setStatus, loginUrl };
})();
