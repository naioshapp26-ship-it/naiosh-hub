/**
 * Stores Registry + Product Submissions (customer store upload)
 * Key: naiosh_stores_registry_v1 · naiosh_product_submissions_v1
 */
(function () {
  'use strict';

  const STORES_KEY = 'naiosh_stores_registry_v1';
  const SUBS_KEY = 'naiosh_product_submissions_v1';

  const nowIso = () => new Date().toISOString();

  const seedFromConnectors = () => {
    const list = window.HubMarketplaceData?.MARKETPLACE_CONNECTORS || [];
    return list.map((m) => ({
      storeId: m.storeId || `STORE-${String(m.id || 'X').toUpperCase()}`,
      id: m.id,
      name: m.name,
      nameAr: m.nameAr || m.name,
      logo: '',
      icon: m.icon || 'fas fa-store',
      color: m.color || '#d70000',
      websiteUrl: m.websiteUrl || '',
      domains: m.domains || [],
      placeholder: m.placeholder || 'https://...',
      status: 'active',
      linkMode: 'External Link Only',
      requiresProductUrl: true,
      openInNewTab: true,
      allowCustomers: true,
      defaultCurrency: 'USD',
      featured: !!m.featured,
      description: '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdBy: 'system',
      source: 'seed',
    }));
  };

  const loadBag = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORES_KEY) || 'null');
      if (raw && Array.isArray(raw.stores) && raw.stores.length) {
        const seed = seedFromConnectors();
        const byId = Object.create(null);
        raw.stores.forEach((s) => {
          byId[s.storeId || s.id] = s;
          if (!s.updatedAt) s.updatedAt = s.createdAt || nowIso();
          if (s.openInNewTab == null) s.openInNewTab = true;
          if (s.allowCustomers == null) s.allowCustomers = s.status === 'active';
          if (!s.defaultCurrency) s.defaultCurrency = 'USD';
        });
        seed.forEach((s) => {
          const key = s.storeId || s.id;
          if (!byId[key]) {
            raw.stores.push(s);
            return;
          }
          const cur = byId[key];
          if (!cur.websiteUrl && s.websiteUrl) cur.websiteUrl = s.websiteUrl;
          if ((!cur.domains || !cur.domains.length) && s.domains) cur.domains = s.domains;
          if (!cur.storeId && s.storeId) cur.storeId = s.storeId;
        });
        try {
          localStorage.setItem(STORES_KEY, JSON.stringify(raw));
        } catch (_) {}
        return raw;
      }
    } catch (_) {}
    const bag = { schemaVersion: 1, stores: seedFromConnectors() };
    try {
      localStorage.setItem(STORES_KEY, JSON.stringify(bag));
    } catch (_) {}
    return bag;
  };

  let state = loadBag();

  const save = () => {
    try {
      localStorage.setItem(STORES_KEY, JSON.stringify(state));
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('hub-stores-changed'));
    } catch (_) {}
  };

  const list = ({ includeDisabled, includeArchived } = {}) =>
    (state.stores || []).filter((s) => {
      const st = s.status || 'active';
      if (st === 'disabled' && !includeDisabled) return false;
      if (st === 'archived' && !includeArchived) return false;
      return true;
    });

  const listAdmin = () => list({ includeDisabled: true, includeArchived: true });

  const normalizeStore = (s) => {
    if (!s) return null;
    return Object.assign({}, s, {
      store_id: s.storeId || s.store_id || s.id,
      website_url: s.websiteUrl || s.website_url || '',
      created_at: s.createdAt || s.created_at || '',
      created_by: s.createdBy || s.created_by || '',
      updated_at: s.updatedAt || s.updated_at || s.createdAt || '',
    });
  };

  const listActive = () =>
    list()
      .filter((s) => (!s.status || s.status === 'active') && s.allowCustomers !== false)
      .map(normalizeStore);

  const get = (storeId) => {
    const row =
      (state.stores || []).find((s) => s.storeId === storeId || s.id === storeId || s.store_id === storeId) ||
      null;
    return normalizeStore(row);
  };

  const nextCustomId = () => {
    const year = new Date().getFullYear();
    const n =
      (state.stores || []).filter((s) => String(s.storeId || '').startsWith(`STORE-${year}-`)).length + 1;
    return `STORE-${year}-${String(n).padStart(5, '0')}`;
  };

  const makeStoreId = (code) => {
    const c = String(code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');
    if (!c) return nextCustomId();
    return c.startsWith('STORE-') ? c : `STORE-${c}`;
  };

  const productStats = (storeId) => {
    const items = (subs.items || []).filter((x) => x.storeId === storeId);
    const sales = (() => {
      try {
        return (window.HubStore?.get?.()?.empire?.salesStore?.items || []).filter(
          (x) => x.storeId === storeId || x.externalStoreId === storeId
        );
      } catch (_) {
        return [];
      }
    })();
    const all = items.length + sales.length;
    const active = items.filter((x) => /approved|published|active/i.test(String(x.status || ''))).length;
    const pending = items.filter((x) => /انتظار|pending|review/i.test(String(x.status || ''))).length;
    const rejected = items.filter((x) => /رفض|reject/i.test(String(x.status || ''))).length;
    const paused = items.filter((x) => /وقف|pause|disabled/i.test(String(x.status || ''))).length;
    return { total: all || items.length, active, pending, rejected, paused, submissions: items, sales };
  };

  const productCount = (storeId) => productStats(storeId).total;

  const relatedRecords = (storeId) => {
    const stats = productStats(storeId);
    let orders = 0;
    try {
      const bag = JSON.parse(localStorage.getItem('naiosh_hub_purchase_orders_v1') || '{"items":[]}');
      orders = (bag.items || []).filter((o) => o.storeId === storeId).length;
    } catch (_) {}
    return {
      products: stats.total,
      submissions: stats.submissions.length,
      orders,
      hasLinks: stats.total > 0 || orders > 0,
    };
  };

  const addStore = (payload = {}, actor = 'عميل') => {
    const name = String(payload.name || payload.nameAr || payload.display_name || '').trim();
    const websiteUrl = String(payload.websiteUrl || payload.website_url || '').trim();
    if (!name) throw new Error('اسم المتجر مطلوب');
    if (!websiteUrl || !/^https?:\/\//i.test(websiteUrl)) throw new Error('رابط الموقع الرسمي مطلوب');
    let host = '';
    try {
      host = new URL(websiteUrl).hostname.replace(/^www\./, '');
    } catch (_) {
      throw new Error('رابط الموقع غير صالح');
    }
    const storeId = makeStoreId(payload.storeCode || payload.storeId || payload.store_id);
    if ((state.stores || []).some((s) => s.storeId === storeId || s.id === storeId)) {
      throw new Error('Store ID موجود مسبقاً: ' + storeId);
    }
    const requiresUrl =
      payload.requiresProductUrl !== false &&
      payload.requires_product_url !== false &&
      payload.requires_product_url !== 'no' &&
      payload.requiresProductUrl !== 'off';
    const status = payload.status === 'disabled' ? 'disabled' : 'active';
    const row = {
      storeId,
      id: payload.id || `custom-${Date.now()}`,
      name: payload.displayName || payload.display_name || name,
      nameAr: name,
      logo: payload.logo || '',
      icon: 'fas fa-store',
      color: payload.color || '#d70000',
      websiteUrl,
      domains: payload.domains || (host ? [host] : []),
      placeholder: websiteUrl,
      status,
      linkMode: payload.linkMode || payload.link_mode || 'External Link Only',
      requiresProductUrl: requiresUrl,
      openInNewTab: payload.openInNewTab !== false && payload.openInNewTab !== 'off',
      allowCustomers: payload.allowCustomers !== false && payload.allowCustomers !== 'off',
      defaultCurrency: 'USD',
      featured: !!payload.featured,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdBy: actor,
      source: payload.source || 'admin',
      description: payload.description || '',
      audience: payload.audience || 'all',
    };
    state.stores.push(row);
    save();
    try {
      window.HubSiteSettings?.logAudit?.({
        section: 'stores',
        action: 'Store Created',
        storeId,
        oldValue: '',
        newValue: name,
        changedBy: actor,
      });
    } catch (_) {}
    return normalizeStore(row);
  };

  const loadSubs = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(SUBS_KEY) || 'null');
      if (raw && Array.isArray(raw.items)) return raw;
    } catch (_) {}
    return { schemaVersion: 1, items: [], seq: 0 };
  };

  let subs = loadSubs();

  const saveSubs = () => {
    try {
      localStorage.setItem(SUBS_KEY, JSON.stringify(subs));
    } catch (_) {}
  };

  const nextSubmissionId = () => {
    const year = new Date().getFullYear();
    subs.seq = (subs.seq || 0) + 1;
    return `PRD-REQ-${year}-${String(subs.seq).padStart(5, '0')}`;
  };

  const createSubmission = (payload = {}, actor = 'عميل') => {
    const storeId = payload.storeId || payload.store_id || '';
    const store = get(storeId);
    const item = {
      id: nextSubmissionId(),
      storeId: store?.storeId || storeId,
      storeName: store?.nameAr || store?.name || payload.storeName || payload.store_name || '',
      productUrl: payload.productUrl || payload.product_url || '',
      title: payload.title || payload.product_name || '',
      category: payload.category || '',
      brand: payload.brand || '',
      sku: payload.sku || '',
      summary: payload.summary || payload.short_desc || '',
      description: payload.description || payload.full_desc || '',
      quantity: Number(payload.quantity) || 1,
      condition: payload.condition || 'جديد',
      priceUsd: Number(payload.priceUsd != null ? payload.priceUsd : payload.price_usd) || 0,
      currency: 'USD',
      images: payload.images || [],
      attachments: payload.attachments || [],
      imagesCount: payload.images_count || (payload.images || []).length || 0,
      attachmentsCount: payload.attachments_count || (payload.attachments || []).length || 0,
      status: payload.status || 'بانتظار المراجعة',
      customer: payload.customer || actor,
      createdBy: actor,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    subs.items.unshift(item);
    saveSubs();
    return Object.assign({}, item, { submission_id: item.id });
  };

  const validateProductUrl = (url, storeOrId) => {
    const store = typeof storeOrId === 'string' ? get(storeOrId) : storeOrId;
    const u = String(url || '').trim();
    if (!u) return { ok: false, message: 'رابط المنتج مطلوب' };
    let parsed;
    try {
      parsed = new URL(u);
    } catch (_) {
      return { ok: false, message: 'الرابط غير صالح أو لا يبدو تابعاً للمتجر المختار.' };
    }
    if (!/^https?:$/i.test(parsed.protocol)) {
      return { ok: false, message: 'الرابط غير صالح أو لا يبدو تابعاً للمتجر المختار.' };
    }
    if (store?.domains?.length) {
      const host = parsed.hostname.toLowerCase();
      const ok = store.domains.some((d) => host.includes(String(d).toLowerCase()));
      if (!ok) {
        return {
          ok: false,
          message: 'الرابط غير صالح أو لا يبدو تابعاً للمتجر المختار.',
        };
      }
    }
    return { ok: true };
  };

  const updateStore = (storeId, patch = {}, actor = 'Admin') => {
    const idx = (state.stores || []).findIndex((s) => s.storeId === storeId || s.id === storeId);
    if (idx < 0) return null;
    const prev = state.stores[idx];
    const next = Object.assign({}, prev, patch, { updatedAt: nowIso() });
    if (patch.websiteUrl || patch.website_url) {
      next.websiteUrl = patch.websiteUrl || patch.website_url;
      try {
        const host = new URL(next.websiteUrl).hostname.replace(/^www\./, '');
        if (host && (!next.domains || !next.domains.length)) next.domains = [host];
      } catch (_) {}
    }
    if (patch.requiresProductUrl === 'on') next.requiresProductUrl = true;
    if (patch.requiresProductUrl === 'off') next.requiresProductUrl = false;
    if (patch.openInNewTab === 'on') next.openInNewTab = true;
    if (patch.openInNewTab === 'off') next.openInNewTab = false;
    if (patch.allowCustomers === 'on') next.allowCustomers = true;
    if (patch.allowCustomers === 'off') next.allowCustomers = false;
    next.defaultCurrency = 'USD';
    // Store ID is immutable after create
    next.storeId = prev.storeId;
    state.stores[idx] = next;
    save();
    try {
      const action =
        patch.status === 'disabled'
          ? 'Store Disabled'
          : patch.status === 'active' && prev.status !== 'active'
            ? 'Store Enabled'
            : patch.status === 'archived'
              ? 'Store Archived'
              : patch.websiteUrl && patch.websiteUrl !== prev.websiteUrl
                ? 'URL Changed'
                : patch.logo && patch.logo !== prev.logo
                  ? 'Logo Changed'
                  : 'Store Updated';
      window.HubSiteSettings?.logAudit?.({
        section: 'stores',
        action,
        storeId: prev.storeId,
        oldValue: JSON.stringify({
          status: prev.status,
          websiteUrl: prev.websiteUrl,
          name: prev.nameAr || prev.name,
        }),
        newValue: JSON.stringify({
          status: next.status,
          websiteUrl: next.websiteUrl,
          name: next.nameAr || next.name,
        }),
        changedBy: actor,
      });
    } catch (_) {}
    return normalizeStore(next);
  };

  const deleteStore = (storeId, actor = 'Admin') => {
    const row = get(storeId);
    if (!row) return { ok: false, message: 'المتجر غير موجود' };
    const rel = relatedRecords(row.storeId);
    if (rel.hasLinks) {
      return {
        ok: false,
        message: 'لا يمكن حذف المتجر لأنه مرتبط ببيانات. يمكنك أرشفته بدلاً من ذلك.',
        related: rel,
      };
    }
    state.stores = (state.stores || []).filter((s) => s.storeId !== row.storeId && s.id !== row.storeId);
    save();
    try {
      window.HubSiteSettings?.logAudit?.({
        section: 'stores',
        action: 'Store Deleted',
        storeId: row.storeId,
        oldValue: row.nameAr || row.name,
        newValue: '',
        changedBy: actor,
      });
    } catch (_) {}
    return { ok: true };
  };

  const updateSubmission = (id, patch = {}) => {
    const idx = (subs.items || []).findIndex((x) => x.id === id || x.submission_id === id);
    if (idx < 0) return null;
    subs.items[idx] = Object.assign({}, subs.items[idx], patch, { updatedAt: nowIso() });
    saveSubs();
    return subs.items[idx];
  };

  const approveSubmission = (id, actor = 'Admin') => {
    const row = updateSubmission(id, { status: 'Approved/Published', reviewedBy: actor, reviewedAt: nowIso() });
    if (!row) return null;
    try {
      const items = window.HubStore?.get?.()?.empire?.salesStore?.items || [];
      const item = items.find((x) => x.submissionId === row.id || x.productUrl === row.productUrl);
      if (item) {
        item.status = 'active';
        item.purchaseType = row.storeId && row.storeId !== 'INTERNAL' ? 'EXTERNAL' : item.purchaseType || 'EXTERNAL';
        window.HubStore?.save?.();
      }
    } catch (_) {}
    return row;
  };

  window.HubStoresRegistry = {
    list: (opts) => list(opts).map(normalizeStore),
    listAdmin: () => listAdmin().map(normalizeStore),
    listActive,
    get,
    addStore,
    updateStore,
    deleteStore,
    productCount,
    productStats,
    relatedRecords,
    createSubmission,
    updateSubmission,
    approveSubmission,
    validateProductUrl,
    listSubmissions: () => subs.items.slice(),
    reload: () => {
      state = loadBag();
      subs = loadSubs();
    },
  };
})();
