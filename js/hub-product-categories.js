/**
 * تصنيفات المنتجات — مصدر مركزي واحد للفلاتر والنماذج والإدارة.
 * يزامن مع /api/hub/product-categories ويحفظ مرآة في HubStore.
 */
(() => {
  'use strict';

  const ALL = { id: 'الكل', name: 'كل المنتجات', icon: 'fa-border-all', status: 'active', system: true };
  let cache = [];
  let canManage = false;
  let ready = false;
  const listeners = new Set();

  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const authHeaders = () => {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const token = window.HubAuth?.getToken?.() || '';
    const user = window.HubAuth?.getUser?.() || {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (token) headers['X-Hub-Token'] = token;
    if (user.role) headers['X-Hub-User-Role'] = user.role;
    if (user.name || user.fullName) headers['X-Hub-User-Name'] = user.name || user.fullName;
    return headers;
  };

  const isStaff = () => Boolean(window.HubAuth?.isStaff?.() || canManage);

  const seedFromMarketplace = () => {
    const base = (window.HubMarketplaceData?.SHOP_CATEGORIES || []).filter((c) => c.id !== 'الكل');
    return base.map((c) => ({
      id: c.id,
      name: c.name || c.id,
      description: '',
      icon: c.icon || 'fa-tag',
      status: 'active',
      system: true,
    }));
  };

  const mirrorToStore = (items) => {
    try {
      const store = window.HubStore;
      if (!store?.get || !store?.save) return;
      const state = store.get();
      if (!state.empire) state.empire = {};
      state.empire.productCategories = items.map((x) => ({ ...x }));
      store.save();
    } catch {
      /* ignore */
    }
  };

  const emit = () => {
    listeners.forEach((fn) => {
      try {
        fn(listForShop({ includeInactive: isStaff() }));
      } catch {
        /* ignore */
      }
    });
    window.dispatchEvent(new CustomEvent('hub:product-categories', { detail: { items: cache.slice() } }));
  };

  const setCache = (items, manageFlag) => {
    cache = Array.isArray(items) ? items.map((x) => ({ ...x })) : [];
    if (typeof manageFlag === 'boolean') canManage = manageFlag;
    else canManage = isStaff();
    mirrorToStore(cache);
    ready = true;
    emit();
  };

  const loadFromStore = () => {
    const fromStore = window.HubStore?.get?.()?.empire?.productCategories;
    if (Array.isArray(fromStore) && fromStore.length) return fromStore.map((x) => ({ ...x }));
    return seedFromMarketplace();
  };

  const refresh = async () => {
    try {
      const staff = Boolean(window.HubAuth?.isStaff?.());
      const q = staff ? '?includeInactive=1' : '';
      const res = await fetch(`/api/hub/product-categories${q}`, {
        headers: authHeaders(),
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'فشل التحميل');
      setCache(data.items || [], !!data.canManage);
      return cache;
    } catch {
      setCache(loadFromStore(), Boolean(window.HubAuth?.isStaff?.()));
      return cache;
    }
  };

  const listRaw = ({ includeInactive = false } = {}) => {
    const items = cache.length ? cache : loadFromStore();
    return includeInactive ? items.slice() : items.filter((c) => c.status !== 'inactive');
  };

  const listForShop = ({ includeInactive = false } = {}) => {
    return [ALL, ...listRaw({ includeInactive })];
  };

  const optionsForForms = () =>
    listRaw({ includeInactive: false }).map((c) => ({ value: c.id, label: c.name }));

  const find = (id) => listRaw({ includeInactive: true }).find((c) => String(c.id) === String(id)) || null;

  const productRefs = () => {
    const empire = window.HubStore?.get?.()?.empire || {};
    return {
      catalog: empire.productCatalog || [],
      storeItems: empire.salesStore?.items || [],
    };
  };

  const countProducts = (categoryId) => {
    if (!categoryId || categoryId === 'الكل') {
      const { catalog } = productRefs();
      return (catalog || []).filter((p) => p.status !== 'archived' && p.status !== 'مؤرشف').length;
    }
    const { catalog, storeItems } = productRefs();
    const fromCatalog = (catalog || []).filter(
      (p) =>
        p.category === categoryId &&
        p.status !== 'archived' &&
        p.status !== 'مؤرشف' &&
        p.status !== 'بانتظار المراجعة' &&
        p.status !== 'pending_review'
    ).length;
    // Prefer catalog counts for shop page consistency
    if (catalog?.length) return fromCatalog;
    return (storeItems || []).filter((i) => i.category === categoryId && i.status !== 'archived').length;
  };

  const reassignLocal = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return 0;
    const store = window.HubStore;
    if (!store?.get || !store?.save) return 0;
    const empire = store.get().empire;
    let n = 0;
    (empire.productCatalog || []).forEach((p) => {
      if (p.category === fromId) {
        p.category = toId;
        n += 1;
      }
    });
    (empire.salesStore?.items || []).forEach((i) => {
      if (i.category === fromId) {
        i.category = toId;
        n += 1;
      }
    });
    if (n) store.save();
    return n;
  };

  const renameLocal = (fromKey, toId, toName) => {
    const store = window.HubStore;
    if (!store?.get || !store?.save) return;
    const empire = store.get().empire;
    let changed = false;
    (empire.productCatalog || []).forEach((p) => {
      if (p.category === fromKey) {
        p.category = toId;
        changed = true;
      }
    });
    (empire.salesStore?.items || []).forEach((i) => {
      if (i.category === fromKey) {
        i.category = toId;
        changed = true;
      }
    });
    if (changed) store.save();
    return toName;
  };

  const create = async (payload) => {
    if (!isStaff()) {
      const err = new Error('غير مصرح — إدارة التصنيفات للموظفين فقط.');
      err.status = 403;
      throw err;
    }
    const res = await fetch('/api/hub/product-categories', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const err = new Error(data.error || 'تعذر حفظ التصنيف');
      err.status = res.status;
      throw err;
    }
    await refresh();
    return data.item;
  };

  const update = async (id, payload) => {
    if (!isStaff()) {
      const err = new Error('غير مصرح — إدارة التصنيفات للموظفين فقط.');
      err.status = 403;
      throw err;
    }
    const prev = find(id);
    const res = await fetch(`/api/hub/product-categories/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const err = new Error(data.error || 'تعذر تحديث التصنيف');
      err.status = res.status;
      throw err;
    }
    if (prev && data.item && (prev.name !== data.item.name || prev.id !== data.item.id)) {
      renameLocal(prev.id, data.item.id, data.item.name);
      if (prev.name !== prev.id) renameLocal(prev.name, data.item.id, data.item.name);
    }
    await refresh();
    return data.item;
  };

  const remove = async (id, { replacementId } = {}) => {
    if (!isStaff()) {
      const err = new Error('غير مصرح — إدارة التصنيفات للموظفين فقط.');
      err.status = 403;
      throw err;
    }
    const count = countProducts(id);
    const res = await fetch(`/api/hub/product-categories/${encodeURIComponent(id)}/delete`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ productCount: count, replacementId, replacementCategoryId: replacementId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const err = new Error(data.error || 'تعذر حذف التصنيف');
      err.status = res.status;
      err.needsReplacement = !!data.needsReplacement;
      err.productCount = data.productCount || count;
      throw err;
    }
    if (data.reassignFrom && data.reassignTo) {
      reassignLocal(data.reassignFrom, data.reassignTo);
    }
    await refresh();
    return data;
  };

  const toggleStatus = async (id) => {
    const item = find(id);
    if (!item) throw new Error('التصنيف غير موجود.');
    const next = item.status === 'inactive' ? 'active' : 'inactive';
    return update(id, { status: next });
  };

  const subscribe = (fn) => {
    if (typeof fn === 'function') listeners.add(fn);
    return () => listeners.delete(fn);
  };

  window.HubProductCategories = {
    ALL,
    refresh,
    listForShop,
    listRaw,
    optionsForForms,
    find,
    countProducts,
    create,
    update,
    remove,
    toggleStatus,
    reassignLocal,
    subscribe,
    isStaff,
    canManage: () => canManage || isStaff(),
    get ready() {
      return ready;
    },
    esc,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      refresh();
    });
  } else {
    refresh();
  }
})();
