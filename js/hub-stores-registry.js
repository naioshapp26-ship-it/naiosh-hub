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
      defaultCurrency: 'USD',
      featured: !!m.featured,
      createdAt: nowIso(),
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

  const list = ({ includeDisabled } = {}) =>
    (state.stores || []).filter((s) => includeDisabled || s.status !== 'disabled');

  const normalizeStore = (s) => {
    if (!s) return null;
    return Object.assign({}, s, {
      store_id: s.storeId || s.store_id || s.id,
      website_url: s.websiteUrl || s.website_url || '',
      created_at: s.createdAt || s.created_at || '',
      created_by: s.createdBy || s.created_by || '',
    });
  };

  const listActive = () =>
    list()
      .filter((s) => !s.status || s.status === 'active')
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
    const requiresUrl =
      payload.requiresProductUrl !== false &&
      payload.requires_product_url !== false &&
      payload.requires_product_url !== 'no';
    const row = {
      storeId: nextCustomId(),
      id: `custom-${Date.now()}`,
      name: payload.displayName || payload.display_name || name,
      nameAr: name,
      logo: payload.logo || '',
      icon: 'fas fa-store',
      color: '#d70000',
      websiteUrl,
      domains: host ? [host] : [],
      placeholder: websiteUrl,
      status: 'active',
      linkMode: payload.linkMode || payload.link_mode || 'External Link Only',
      requiresProductUrl: requiresUrl,
      defaultCurrency: 'USD',
      featured: false,
      createdAt: nowIso(),
      createdBy: actor,
      source: 'user',
      description: payload.description || '',
      audience: payload.audience || 'all',
    };
    state.stores.push(row);
    save();
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

  const updateStore = (storeId, patch = {}) => {
    const idx = (state.stores || []).findIndex((s) => s.storeId === storeId || s.id === storeId);
    if (idx < 0) return null;
    state.stores[idx] = Object.assign({}, state.stores[idx], patch, { updatedAt: nowIso() });
    save();
    return normalizeStore(state.stores[idx]);
  };

  window.HubStoresRegistry = {
    list: (opts) => list(opts).map(normalizeStore),
    listActive,
    get,
    addStore,
    updateStore,
    createSubmission,
    validateProductUrl,
    listSubmissions: () => subs.items.slice(),
    reload: () => {
      state = loadBag();
      subs = loadSubs();
    },
  };
})();
