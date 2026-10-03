/**
 * إعدادات محرك البحث الشامل — مصدر حقيقة واحد مع search.html
 * يخزّن: إخفاء العناصر الحيّة، نوايا البحث المخصّصة/المعطّلة، القوائم السريعة
 * لا يستبدل الفروع/الخدمات/… — يربط الظهور بالكيانات الأصلية.
 */
(() => {
  'use strict';

  const KEY = 'naiosh_hub_search_config_v1';

  const DEFAULT_QUICK_LISTS = [
    {
      id: 'branches',
      type: 'branch',
      label: 'جميع الفروع',
      icon: 'fa-code-branch',
      lead: 'قائمة كل فروع نايوش مع رقم الفرع',
      visible: true,
      order: 0,
      maxItems: 0,
    },
    {
      id: 'incubators',
      type: 'incubator',
      label: 'جميع الحاضنات',
      icon: 'fa-seedling',
      lead: 'قائمة كل الحاضنات مع معرف رقم الحاضنة',
      visible: true,
      order: 1,
      maxItems: 0,
    },
    {
      id: 'platforms',
      type: 'platform',
      label: 'جميع المنصات',
      icon: 'fa-layer-group',
      lead: 'قائمة كل المنصات مع رقم المنصة',
      visible: true,
      order: 2,
      maxItems: 0,
    },
    {
      id: 'knowledge',
      type: 'knowledge',
      label: 'صفحات مركز المعلومات',
      icon: 'fa-circle-info',
      lead: 'كل صفحات مركز المعرفة تظهر هنا في محرك البحث',
      visible: true,
      order: 3,
      maxItems: 0,
    },
    {
      id: 'services',
      type: 'service',
      label: 'خدماتنا',
      icon: 'fa-concierge-bell',
      lead: 'كل خدمة في صفحة مستقلة داخل هوب',
      visible: true,
      order: 4,
      maxItems: 0,
    },
  ];

  const empty = () => ({
    version: 1,
    hidden: {},
    intentDisabled: {},
    intentOrder: [],
    intentPatches: {},
    customIntents: [],
    quickLists: DEFAULT_QUICK_LISTS.map((q) => ({ ...q })),
    updatedAt: '',
  });

  const read = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!raw || typeof raw !== 'object') return empty();
      const base = empty();
      return {
        ...base,
        ...raw,
        hidden: raw.hidden && typeof raw.hidden === 'object' ? raw.hidden : {},
        intentDisabled: raw.intentDisabled && typeof raw.intentDisabled === 'object' ? raw.intentDisabled : {},
        intentOrder: Array.isArray(raw.intentOrder) ? raw.intentOrder : [],
        intentPatches: raw.intentPatches && typeof raw.intentPatches === 'object' ? raw.intentPatches : {},
        customIntents: Array.isArray(raw.customIntents) ? raw.customIntents : [],
        quickLists: Array.isArray(raw.quickLists) && raw.quickLists.length
          ? raw.quickLists
          : base.quickLists,
      };
    } catch {
      return empty();
    }
  };

  const save = (next) => {
    const payload = {
      ...empty(),
      ...next,
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
    try {
      window.dispatchEvent(new CustomEvent('hub-search-config-changed', { detail: payload }));
    } catch (_) {}
    return payload;
  };

  const isHidden = (id) => {
    if (!id) return false;
    return !!read().hidden[String(id)];
  };

  const setHidden = (id, hidden, actor = 'مشغّل') => {
    if (!id) return { ok: false, error: 'معرّف مطلوب' };
    const cfg = read();
    const key = String(id);
    if (hidden) cfg.hidden[key] = true;
    else delete cfg.hidden[key];
    save(cfg);
    try {
      window.HubSearchCatalog?.pushAudit?.({
        action: hidden ? 'إخفاء من البحث' : 'إظهار في البحث',
        itemId: key,
        title: key,
        by: actor,
        result: 'نجاح',
        detail: 'إعداد ظهور لمصدر حيّ',
      });
    } catch (_) {}
    return { ok: true, hidden: !!hidden };
  };

  const hiddenIds = () => new Set(Object.keys(read().hidden || {}).filter((k) => read().hidden[k]));

  const isIntentDisabled = (id) => !!read().intentDisabled[String(id)];

  const setIntentDisabled = (id, disabled, actor = 'مشغّل') => {
    if (!id) return { ok: false };
    const cfg = read();
    const key = String(id);
    if (disabled) cfg.intentDisabled[key] = true;
    else delete cfg.intentDisabled[key];
    save(cfg);
    try {
      window.HubSearchCatalog?.pushAudit?.({
        action: disabled ? 'إيقاف نية بحث' : 'تفعيل نية بحث',
        itemId: key,
        title: key,
        by: actor,
        result: 'نجاح',
      });
    } catch (_) {}
    return { ok: true };
  };

  const patchIntent = (id, patch = {}, actor = 'مشغّل') => {
    if (!id) return { ok: false };
    const cfg = read();
    const key = String(id);
    cfg.intentPatches[key] = { ...(cfg.intentPatches[key] || {}), ...patch, updatedAt: new Date().toISOString() };
    save(cfg);
    try {
      window.HubSearchCatalog?.pushAudit?.({
        action: 'تعديل نية بحث',
        itemId: key,
        title: patch.label || key,
        by: actor,
        result: 'نجاح',
      });
    } catch (_) {}
    return { ok: true, patch: cfg.intentPatches[key] };
  };

  const upsertCustomIntent = (payload = {}, actor = 'مشغّل') => {
    const cfg = read();
    const id = String(payload.id || `intent-custom-${Date.now().toString(36)}`).trim();
    const label = String(payload.label || '').trim();
    if (!label) return { ok: false, error: 'نص النية مطلوب' };
    const item = {
      id,
      label,
      group: payload.group || 'primary',
      icon: String(payload.icon || 'fa-compass').trim() || 'fa-compass',
      starters: Array.isArray(payload.starters)
        ? payload.starters
        : String(payload.starters || label)
            .split('|')
            .map((s) => s.trim())
            .filter(Boolean),
      routes: payload.routes || {
        types: Array.isArray(payload.types) ? payload.types : ['all'],
        keywords: Array.isArray(payload.keywords)
          ? payload.keywords
          : String(payload.keywords || '')
              .split(/[,\s]+/)
              .map((s) => s.trim())
              .filter(Boolean),
        destinations: Array.isArray(payload.destinations) ? payload.destinations : [],
      },
      explain: String(payload.explain || '').trim(),
      href: String(payload.href || '').trim(),
      action: String(payload.action || 'search').trim() || 'search',
      custom: true,
      order: Number(payload.order) || cfg.customIntents.length,
      enabled: payload.enabled !== false,
    };
    const idx = cfg.customIntents.findIndex((x) => String(x.id) === id);
    if (idx >= 0) cfg.customIntents[idx] = { ...cfg.customIntents[idx], ...item };
    else cfg.customIntents.push(item);
    if (item.enabled === false) cfg.intentDisabled[id] = true;
    else delete cfg.intentDisabled[id];
    save(cfg);
    try {
      window.HubSearchCatalog?.pushAudit?.({
        action: idx >= 0 ? 'تحديث نية بحث مخصصة' : 'إضافة نية بحث',
        itemId: id,
        title: label,
        by: actor,
        result: 'نجاح',
      });
    } catch (_) {}
    return { ok: true, item };
  };

  const removeCustomIntent = (id, actor = 'مشغّل') => {
    const cfg = read();
    const before = cfg.customIntents.length;
    cfg.customIntents = cfg.customIntents.filter((x) => String(x.id) !== String(id));
    delete cfg.intentDisabled[String(id)];
    delete cfg.intentPatches[String(id)];
    save(cfg);
    if (cfg.customIntents.length === before) return { ok: false, error: 'غير موجودة أو نية أساسية' };
    try {
      window.HubSearchCatalog?.pushAudit?.({
        action: 'حذف نية بحث مخصصة',
        itemId: String(id),
        by: actor,
        result: 'نجاح',
      });
    } catch (_) {}
    return { ok: true };
  };

  const setIntentOrder = (ids = []) => {
    const cfg = read();
    cfg.intentOrder = (Array.isArray(ids) ? ids : []).map(String);
    save(cfg);
    return { ok: true };
  };

  const resolvedIntents = (baseIntents = []) => {
    const cfg = read();
    const patches = cfg.intentPatches || {};
    const merged = [
      ...baseIntents.map((i) => {
        const p = patches[i.id] || {};
        return {
          ...i,
          ...p,
          id: i.id,
          routes: { ...(i.routes || {}), ...(p.routes || {}) },
          starters: Array.isArray(p.starters) && p.starters.length ? p.starters : i.starters,
          custom: false,
        };
      }),
      ...cfg.customIntents.map((i) => ({ ...i, custom: true })),
    ];
    if (cfg.intentOrder?.length) {
      const order = new Map(cfg.intentOrder.map((id, idx) => [String(id), idx]));
      merged.sort((a, b) => {
        const ao = order.has(String(a.id)) ? order.get(String(a.id)) : 9999;
        const bo = order.has(String(b.id)) ? order.get(String(b.id)) : 9999;
        return ao - bo || String(a.label).localeCompare(String(b.label), 'ar');
      });
    }
    return merged;
  };

  const activeIntents = (baseIntents = []) =>
    resolvedIntents(baseIntents).filter((i) => !isIntentDisabled(i.id) && i.enabled !== false);

  const getQuickLists = () => {
    const cfg = read();
    const byId = new Map((cfg.quickLists || []).map((q) => [q.id, q]));
    return DEFAULT_QUICK_LISTS.map((def, idx) => {
      const cur = byId.get(def.id) || {};
      return {
        ...def,
        ...cur,
        id: def.id,
        type: cur.type || def.type,
        visible: cur.visible !== false,
        order: Number.isFinite(Number(cur.order)) ? Number(cur.order) : idx,
        maxItems: Number(cur.maxItems) || 0,
      };
    }).sort((a, b) => a.order - b.order);
  };

  const visibleQuickLists = () => getQuickLists().filter((q) => q.visible !== false);

  const setQuickList = (id, patch = {}, actor = 'مشغّل') => {
    const lists = getQuickLists();
    const idx = lists.findIndex((q) => q.id === id);
    if (idx < 0) return { ok: false, error: 'قائمة غير معروفة' };
    lists[idx] = { ...lists[idx], ...patch, id };
    const cfg = read();
    cfg.quickLists = lists;
    save(cfg);
    try {
      window.HubSearchCatalog?.pushAudit?.({
        action: 'تحديث قائمة سريعة',
        itemId: id,
        title: lists[idx].label,
        by: actor,
        result: 'نجاح',
      });
    } catch (_) {}
    return { ok: true, item: lists[idx] };
  };

  const pullRemote = async () => {
    try {
      const res = await fetch('/api/hub/search-catalog', { cache: 'no-store' });
      if (!res.ok) return { ok: false, skipped: true };
      const data = await res.json();
      if (!data?.ok || !data.config) return { ok: true, skipped: true };
      const remote = data.config;
      const local = read();
      const remoteAt = Date.parse(remote.updatedAt || 0) || 0;
      const localAt = Date.parse(local.updatedAt || 0) || 0;
      if (remoteAt >= localAt && remote && typeof remote === 'object') {
        save({ ...empty(), ...remote });
        return { ok: true, count: 1 };
      }
      return { ok: true, skipped: true, reason: 'keep-local' };
    } catch {
      return { ok: false, skipped: true };
    }
  };

  const pushRemote = async () => {
    try {
      // يُدمَج مع دفع الكتالوج إن وُجد — وإلا يُرسل الإعداد وحده
      const items = window.HubSearchCatalog?.list?.() || [];
      const res = await fetch('/api/hub/search-catalog', {
        method: 'POST',
        headers: window.HubAuth?.authHeaders?.({ 'Content-Type': 'application/json' }) || {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items, config: read() }),
      });
      if (!res.ok) return { ok: false };
      const data = await res.json();
      return { ok: !!data?.ok };
    } catch {
      return { ok: false, skipped: true };
    }
  };

  window.HubSearchConfig = {
    KEY,
    DEFAULT_QUICK_LISTS,
    read,
    save,
    isHidden,
    setHidden,
    hiddenIds,
    isIntentDisabled,
    setIntentDisabled,
    patchIntent,
    upsertCustomIntent,
    removeCustomIntent,
    setIntentOrder,
    resolvedIntents,
    activeIntents,
    getQuickLists,
    visibleQuickLists,
    setQuickList,
    pullRemote,
    pushRemote,
  };
})();
