/**
 * طلبات الخدمة العامة — استشارة · مقترحات · شكاوي (localStorage + إشعار غرفة العمليات)
 */
(() => {
  'use strict';

  const KEY = 'naiosh_hub_service_requests_v1';

  const LABELS = {
    consultation: 'استشارة',
    suggestion: 'مقترح',
    complaint: 'شكوى',
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

  const create = (payload = {}) => {
    const kind = payload.kind || 'consultation';
    const title = String(payload.title || '').trim();
    if (!title) return null;

    const item = {
      id: `srv-${Date.now().toString(36)}`,
      kind,
      title,
      body: String(payload.body || '').trim(),
      system: payload.system || 'HUB',
      category: payload.category || '',
      priority: payload.priority || 'عادي',
      fullName: String(payload.fullName || '').trim(),
      phone: String(payload.phone || '').trim(),
      email: String(payload.email || '').trim(),
      preferredAt: payload.preferredAt || '',
      contactMethod: payload.contactMethod || '',
      reference: payload.reference || '',
      status: 'جديد',
      createdAt: new Date().toISOString(),
    };

    const list = read();
    list.unshift(item);
    save(list);

    try {
      const notes = JSON.parse(localStorage.getItem('naiosh_hub_notifications_v1') || '[]');
      notes.unshift({
        id: `n-${Date.now()}`,
        title: `${LABELS[kind] || 'طلب'} جديد`,
        body: item.title,
        href:
          kind === 'complaint'
            ? 'complaints.html'
            : kind === 'suggestion'
              ? 'suggestions.html'
              : 'consultation.html',
        at: new Date().toISOString(),
      });
      localStorage.setItem('naiosh_hub_notifications_v1', JSON.stringify(notes.slice(0, 40)));
    } catch {
      /* ignore */
    }

    try {
      window.HubStore?.pushFeed?.(
        'decision',
        `${LABELS[kind] || 'طلب'} نظامي: ${item.system} — ${item.title}`
      );
    } catch {
      /* ignore */
    }

    return item;
  };

  const byKind = (kind) => read().filter((x) => x.kind === kind);

  window.HubServiceRequests = { KEY, LABELS, read, create, byKind };
})();
