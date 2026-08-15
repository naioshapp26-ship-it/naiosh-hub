/**
 * كتالوج محتوى محرك البحث — يضيفه الأدمن لأي تصنيف:
 * حاضنات · منصات · أنظمة · محتوى · صور · ملفات · فيديو
 */
(() => {
  'use strict';

  const KEY = 'naiosh_hub_search_catalog_v1';
  const MAX_FILE_BYTES = 2.5 * 1024 * 1024;

  /** نوع الوسائط (طريقة العرض) */
  const MEDIA_META = {
    content: { typeAr: 'محتوى', icon: 'fa-file-lines' },
    image: { typeAr: 'صورة', icon: 'fa-image' },
    file: { typeAr: 'ملف', icon: 'fa-paperclip' },
    video: { typeAr: 'فيديو', icon: 'fa-video' },
  };

  /** تصنيف الظهور في فلاتر محرك البحث + اسم صفحة التصنيف */
  const SECTION_META = {
    incubator: { typeAr: 'حاضنة', pageTitle: 'الحاضنات', pageLead: 'محتوى مضاف ضمن تصنيف الحاضنات', icon: 'fa-seedling', type: 'incubator' },
    platform: { typeAr: 'منصة', pageTitle: 'المنصات', pageLead: 'محتوى مضاف ضمن تصنيف المنصات', icon: 'fa-layer-group', type: 'platform' },
    system: { typeAr: 'نظام', pageTitle: 'الأنظمة', pageLead: 'محتوى مضاف ضمن تصنيف الأنظمة', icon: 'fa-cube', type: 'system' },
    content: { typeAr: 'محتوى', pageTitle: 'المحتوى', pageLead: 'مقالات ومعلومات مضافة لمحرك البحث', icon: 'fa-file-lines', type: 'content' },
    image: { typeAr: 'صورة', pageTitle: 'الصور', pageLead: 'معرض الصور المرفوعة لمحرك البحث', icon: 'fa-image', type: 'image' },
    file: { typeAr: 'ملف', pageTitle: 'الملفات', pageLead: 'الملفات والمستندات المرفوعة لمحرك البحث', icon: 'fa-paperclip', type: 'file' },
    video: { typeAr: 'فيديو', pageTitle: 'الفيديو', pageLead: 'مقاطع الفيديو المرفوعة لمحرك البحث', icon: 'fa-video', type: 'video' },
  };

  /** توافق خلفي */
  const TYPE_META = { ...MEDIA_META, ...Object.fromEntries(Object.entries(SECTION_META).map(([k, v]) => [k, { typeAr: v.typeAr, icon: v.icon }])) };

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

  const normalizeSection = (section, kind) => {
    if (SECTION_META[section]) return section;
    if (SECTION_META[kind]) return kind;
    return 'content';
  };

  const normalizeKind = (kind, mime = '') => {
    if (MEDIA_META[kind]) return kind;
    if (String(mime).startsWith('image/')) return 'image';
    if (String(mime).startsWith('video/')) return 'video';
    if (mime) return 'file';
    return 'content';
  };

  const upsert = (payload = {}) => {
    const now = new Date().toISOString();
    const kind = normalizeKind(payload.kind, payload.mediaMime);
    const section = normalizeSection(payload.section, kind);
    const title = String(payload.title || '').trim();
    if (!title) return { ok: false, error: 'العنوان مطلوب' };

    const item = {
      id: payload.id || uid(),
      kind,
      section,
      pageTitle: String(payload.pageTitle || title).trim(),
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
    saveLocal(readLocal().filter((x) => String(x.id) !== String(id)));
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
  const sectionPageUrl = (section) => `search-content.html?type=${encodeURIComponent(section || 'content')}`;

  const toSearchItems = () =>
    list()
      .filter((x) => x.status !== 'draft')
      .map((x) => {
        const section = normalizeSection(x.section, x.kind);
        const sectionMeta = SECTION_META[section] || SECTION_META.content;
        const mediaMeta = MEDIA_META[normalizeKind(x.kind, x.mediaMime)] || MEDIA_META.content;
        const pageName = x.pageTitle || x.title;
        return {
          id: x.id,
          type: sectionMeta.type,
          typeAr: sectionMeta.typeAr,
          icon: sectionMeta.icon || mediaMeta.icon,
          title: x.title,
          subtitle: x.description || pageName || sectionMeta.typeAr,
          meta: pageName || x.mediaName || sectionMeta.typeAr,
          href: viewUrl(x.id),
          preview: x.mediaDataUrl || x.mediaUrl || '',
          mediaMime: x.mediaMime || '',
          pageTitle: pageName,
          section,
          keywords: [
            x.title,
            pageName,
            x.description,
            x.keywords,
            x.mediaName,
            sectionMeta.typeAr,
            sectionMeta.pageTitle,
            mediaMeta.typeAr,
            x.kind,
            section,
            'محتوى',
            'بحث',
          ]
            .filter(Boolean)
            .join(' '),
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
    MEDIA_META,
    SECTION_META,
    list,
    get,
    upsert,
    remove,
    clear,
    fileToDataUrl,
    viewUrl,
    sectionPageUrl,
    toSearchItems,
    exportJson,
    importJson,
    pullRemote,
    pushRemote,
  };
})();
