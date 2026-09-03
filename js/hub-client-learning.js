/**
 * دوراتي / دبلوماتي — برامج المستخدم الخاصة فقط (ليست الكتالوج العام)
 */
(() => {
  'use strict';

  const KEY = 'naiosh_client_learning_v1';
  const EMAIL_KEY = 'naiosh_client_learning_email';

  const blank = () => ({ version: 1, enrollment: [], updatedAt: new Date().toISOString() });
  const uid = (p = 'lrn') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const normEmail = (v) => String(v || '').trim().toLowerCase();

  const read = () => {
    try {
      const raw = { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
      raw.enrollment = Array.isArray(raw.enrollment)
        ? raw.enrollment
        : Array.isArray(raw.enroll)
          ? raw.enroll
          : [];
      return raw;
    } catch {
      return blank();
    }
  };

  const save = (state) => {
    state.updatedAt = new Date().toISOString();
    state.enrollment = Array.isArray(state.enrollment) ? state.enrollment : [];
    localStorage.setItem(KEY, JSON.stringify(state));
    return state;
  };

  const rememberEmail = (email) => {
    const key = normEmail(email);
    if (!key) return;
    try {
      localStorage.setItem(EMAIL_KEY, key);
    } catch {
      /* ignore */
    }
  };

  const rememberedEmail = () => {
    try {
      return normEmail(localStorage.getItem(EMAIL_KEY) || '');
    } catch {
      return '';
    }
  };

  const catalogItem = (kind, idOrStore) => {
    const list =
      kind === 'diploma'
        ? window.HubLearningCatalog?.DIPLOMAS || []
        : window.HubLearningCatalog?.COURSES || [];
    return (
      list.find((x) => String(x.id) === String(idOrStore) || String(x.storeId) === String(idOrStore)) || null
    );
  };

  const listForEmail = (email, kind) => {
    const key = normEmail(email);
    if (!key) return [];
    return (read().enrollment || []).filter(
      (row) => normEmail(row.email) === key && (!kind || row.kind === kind)
    );
  };

  const enroll = (payload = {}) => {
    const email = normEmail(payload.email);
    const kind = payload.kind === 'diploma' ? 'diploma' : 'course';
    const item = catalogItem(kind, payload.itemId || payload.storeId || payload.id);
    if (!email) return { ok: false, error: 'الإيميل مطلوب' };
    if (!item) return { ok: false, error: 'البرنامج غير موجود في الكتالوج' };
    const state = read();
    state.enrollment = Array.isArray(state.enrollment) ? state.enrollment : [];
    const exists = state.enrollment.some(
      (row) => normEmail(row.email) === email && row.kind === kind && row.itemId === item.id
    );
    if (!exists) {
      state.enrollment.unshift({
        id: uid(),
        email,
        kind,
        itemId: item.id,
        storeId: item.storeId,
        title: item.title,
        level: item.level,
        duration: item.duration,
        icon: item.icon,
        source: payload.source || 'manual',
        at: new Date().toISOString(),
      });
      save(state);
    }
    rememberEmail(email);
    return { ok: true, enrollment: listForEmail(email, kind) };
  };

  const enrollFromPurchase = (payload = {}) => {
    const email = normEmail(payload.email);
    const storeId = String(payload.storeId || payload.id || '').trim();
    if (!email || !storeId) return { ok: false, error: 'بيانات الشراء ناقصة' };
    const course = catalogItem('course', storeId);
    if (course) return enroll({ email, kind: 'course', itemId: course.id, source: payload.source || 'cart' });
    const diploma = catalogItem('diploma', storeId);
    if (diploma) return enroll({ email, kind: 'diploma', itemId: diploma.id, source: payload.source || 'cart' });
    return { ok: false, error: 'ليس برنامجًا تعليميًا' };
  };

  window.HubClientLearning = {
    KEY,
    listForEmail,
    enroll,
    enrollFromPurchase,
    rememberEmail,
    rememberedEmail,
  };
})();
