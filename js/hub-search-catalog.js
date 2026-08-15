/**
 * كتالوج محتوى محرك البحث — يضيفه الأدمن (نصوص · صور · ملفات · فيديو)
 * تخزين: localStorage + مزامنة اختيارية مع /api/hub/search-catalog
 */
(() => {
  'use strict';

  const KEY = 'naiosh_hub_search_catalog_v1';
  const MAX_FILE_BYTES = 2.5 * 1024 * 1024; // 2.5MB للكتالوج المحلي

  const TYPE_META = {
    content: { typeAr: 'محتوى', icon: 'fa-file-lines' },
    image: { typeAr: 'صورة', icon: 'fa-image' },
    file: { typeAr: 'ملف', icon: 'fa-paperclip' },
    video: { typeAr: 'فيديو', icon: 'fa-video' },
  };

  const readLocal = () => {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };

  const saveLocal = (list) => {
    localStorage.setItem(KEY, JSON.stringify(list));
    return list;
  };

  const uid = () => `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const list = () => readLocal().slice().sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));

  const get = (id) => readLocal().find((x) => String(x.id) === String(id)) || null;

  const upsert = (payload = {}) => {
    const now = new Date().toISOString();
    const kind = TYPE_META[payload.kind] ? payload.kind : 'content';
    const title = String(payload.title || '').trim();
    if (!title) return { ok: false, error: 'العنوان مطلوب' };

    const item = {
      id: payload.id || uid(),
      kind,
      title,
      description: String(payload.description || '').trim(),
      keywords: String(payload.keywords || '').trim(),
      href: String(payload.href || '').trim(),
      mediaName: String(payload.mediaName || '').trim(),
      mediaMime: String(payload.mediaMime || '').trim(),
      mediaDataUrl: payload.mediaDataUrl || '',
      mediaUrl: String(payload.mediaUrl || '').trim(),
      externalUrl: String(payload.externalUrl || '').trim(),
      status: payload.status === 'draft' ? 'draft' : 'published',
      createdAt: payload.createdAt || now,
      updatedAt: now,
    };

    const all = readLocal();
    const idx = all.findIndex((x) => String(x.id) === String(item.id));
    if (idx >= 0) all[idx] = { ...all[idx], ...item, createdAt: all[idx].createdAt || item.createdAt };
    else all.unshift(item);
    saveLocal(all);
    return { ok: true, item: get(item.id) };
  };

  const remove = (id) => {
    const next = readLocal().filter((x) => String(x.id) !== String(id));
    saveLocal(next);
    return { ok: true };
  };

  const clear = () => {
    saveLocal([]);
    return { ok: true };
  };

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      if (!file) return reject(new Error('لا ملف'));
      if (file.size > MAX_FILE_BYTES) {
        return reject(new Error(`حجم الملف أكبر من ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(1)}MB — صغّره أو ضع رابطًا خارجيًا`));
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('فشل قراءة الملف'));
      reader.readAsDataURL(file);
    });

  const viewUrl = (id) => `search-content.html?id=${encodeURIComponent(id)}`;

  const toSearchItems = () =>
    list()
      .filter((x) => x.status !== 'draft')
      .map((x) => {
        const meta = TYPE_META[x.kind] || TYPE_META.content;
        return {
          id: x.id,
          type: x.kind,
          typeAr: meta.typeAr,
          icon: meta.icon,
          title: x.title,
          subtitle: x.description || meta.typeAr,
          meta: x.mediaName || x.kind,
          // زي الحاضنة/المنصة: يفتح صفحة عرض المحتوى
          href: viewUrl(x.id),
          preview: x.mediaDataUrl || x.mediaUrl || '',
          mediaMime: x.mediaMime || '',
          keywords: [x.title, x.description, x.keywords, x.mediaName, meta.typeAr, x.kind, 'محتوى', 'بحث'].filter(Boolean).join(' '),
          source: 'admin-catalog',
        };
      });

  const exportJson = () => JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items: list() }, null, 2);

  const importJson = (raw) => {
    let data = raw;
    if (typeof raw === 'string') data = JSON.parse(raw);
    const items = Array.isArray(data) ? data : data?.items;
    if (!Array.isArray(items)) throw new Error('ملف غير صالح');
    saveLocal(items);
    return { ok: true, count: items.length };
  };

  /** مزامنة مع السيرفر إن وُجد */
  const pullRemote = async () => {
    try {
      const res = await fetch('/api/hub/search-catalog', { cache: 'no-store' });
      if (!res.ok) return { ok: false, skipped: true };
      const data = await res.json();
      if (!data?.ok || !Array.isArray(data.items)) return { ok: false };
      saveLocal(data.items);
      return { ok: true, count: data.items.length };
    } catch {
      return { ok: false, skipped: true };
    }
  };

  const pushRemote = async () => {
    try {
      const res = await fetch('/api/hub/search-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: list() }),
      });
      if (!res.ok) return { ok: false };
      const data = await res.json();
      return { ok: !!data?.ok, count: data?.count };
    } catch {
      return { ok: false, skipped: true };
    }
  };

  window.HubSearchCatalog = {
    KEY,
    MAX_FILE_BYTES,
    TYPE_META,
    list,
    get,
    upsert,
    remove,
    clear,
    fileToDataUrl,
    viewUrl,
    toSearchItems,
    exportJson,
    importJson,
    pullRemote,
    pushRemote,
  };
})();
