/**
 * تذاكر الدعم والصيانة — غرفة العمليات (localStorage)
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
    localStorage.setItem(KEY, JSON.stringify(list));
    return list;
  };

  const create = ({
    title,
    body,
    system = 'HUB',
    priority = 'عادي',
    attachLink = '',
    attachDocUrl = '',
    attachDocName = '',
    attachImageUrl = '',
    attachVideoUrl = '',
  } = {}) => {
    if (!title?.trim()) return null;
    const ticket = {
      id: `tkt-${Date.now().toString(36)}`,
      title: title.trim(),
      body: (body || '').trim(),
      system,
      priority,
      attachLink: String(attachLink || '').trim(),
      attachDocUrl: String(attachDocUrl || '').trim(),
      attachDocName: String(attachDocName || '').trim(),
      attachImageUrl: String(attachImageUrl || '').trim(),
      attachVideoUrl: String(attachVideoUrl || '').trim(),
      status: 'جديد',
      requester: window.HubAuth?.getUser?.()?.email || window.HubTenant?.read?.()?.nameAr || 'مستخدم هوب',
      createdAt: new Date().toISOString(),
      updates: [],
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
    } catch {}
    return ticket;
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

  window.HubSupport = { KEY, read, create, setStatus };
})();
