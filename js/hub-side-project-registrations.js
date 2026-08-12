/**
 * سجل طلبات تسجيل المشاريع الجانبية — يستقبله فريق هوب للمتابعة والتواصل
 */
(() => {
  'use strict';

  const KEY = 'naiosh_side_project_registrations_v1';
  const STATUSES = ['جديد', 'قيد المتابعة', 'تم التواصل', 'مقبول', 'مرفوض', 'مغلق'];

  const read = () => {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };

  const save = (list) => {
    const next = (Array.isArray(list) ? list : []).slice(0, 200);
    localStorage.setItem(KEY, JSON.stringify(next));
    try {
      window.dispatchEvent(new CustomEvent('hub-sp-registrations-changed'));
    } catch (_) {}
    return next;
  };

  const normalizeContact = (payload = {}) => {
    const phone = String(payload.phone || '').trim();
    const email = String(payload.email || '').trim();
    if (!phone && !email) return { ok: false, error: 'أضف رقم جوال أو بريداً إلكترونياً للتواصل' };
    return { ok: true, phone, email };
  };

  const create = (payload = {}) => {
    const contact = normalizeContact(payload);
    if (!contact.ok) return { ok: false, error: contact.error };
    const ownerName = String(payload.ownerName || '').trim();
    const projectName = String(payload.projectName || '').trim();
    if (!ownerName) return { ok: false, error: 'اسم صاحب المشروع مطلوب' };
    if (!projectName) return { ok: false, error: 'اسم المشروع مطلوب' };

    const record = {
      id: payload.id || `reg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      projectId: String(payload.projectId || ''),
      projectName,
      ownerName,
      phone: contact.phone,
      email: contact.email,
      preferredContact: payload.preferredContact || (contact.phone ? 'جوال' : 'إيميل'),
      country: String(payload.country || '').trim(),
      education: String(payload.education || '').trim(),
      experienceYears: Number(payload.experienceYears || 0),
      experience1: String(payload.experience1 || '').trim(),
      experience2: String(payload.experience2 || '').trim(),
      experience3: String(payload.experience3 || '').trim(),
      fileDoc: payload.fileDoc || null,
      fileImage: payload.fileImage || null,
      fileVideo: payload.fileVideo || null,
      currentWork: String(payload.currentWork || '').trim(),
      commercialOrNotes: String(payload.commercialOrNotes || '').trim(),
      status: 'جديد',
      adminNotes: [],
      createdAt: payload.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const list = read().filter((x) => x.id !== record.id);
    list.unshift(record);
    save(list);

    try {
      window.HubStore?.pushNotification?.({
        source: 'SIDE-PROJECTS',
        sourceName: 'المشاريع الجانبية',
        title: 'طلب تسجيل مشروع جديد',
        body: `${record.ownerName} · ${record.projectName} · ${record.phone || record.email}`,
        level: 'info',
        category: 'side-projects',
        link: 'side-project-registrations.html',
        meta: { registrationId: record.id },
      });
    } catch (_) {}

    return { ok: true, record };
  };

  const get = (id) => read().find((x) => String(x.id) === String(id)) || null;

  const setStatus = (id, status, note = '') => {
    if (!STATUSES.includes(status)) return null;
    const list = read();
    const idx = list.findIndex((x) => String(x.id) === String(id));
    if (idx < 0) return null;
    const item = { ...list[idx] };
    item.status = status;
    item.updatedAt = new Date().toISOString();
    if (note && String(note).trim()) {
      item.adminNotes = [
        ...(item.adminNotes || []),
        { at: item.updatedAt, status, note: String(note).trim() },
      ];
    } else {
      item.adminNotes = [
        ...(item.adminNotes || []),
        { at: item.updatedAt, status, note: `تغيير الحالة إلى ${status}` },
      ];
    }
    list[idx] = item;
    save(list);
    return item;
  };

  const addNote = (id, note) => {
    const text = String(note || '').trim();
    if (!text) return null;
    const list = read();
    const idx = list.findIndex((x) => String(x.id) === String(id));
    if (idx < 0) return null;
    const item = { ...list[idx] };
    item.updatedAt = new Date().toISOString();
    item.adminNotes = [...(item.adminNotes || []), { at: item.updatedAt, status: item.status, note: text }];
    list[idx] = item;
    save(list);
    return item;
  };

  const remove = (id) => save(read().filter((x) => String(x.id) !== String(id)));

  const counts = () => {
    const list = read();
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    list.forEach((r) => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    });
    return { total: list.length, byStatus, newCount: byStatus['جديد'] || 0 };
  };

  window.HubSideProjectRegistrations = {
    KEY,
    STATUSES,
    read,
    create,
    get,
    setStatus,
    addNote,
    remove,
    counts,
  };
})();
