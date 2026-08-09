/**
 * سلة مشتريات هوب — localStorage
 */
(() => {
  'use strict';

  const KEY = 'naiosh_hub_cart_v1';

  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  };

  const save = (items) => {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('hub:cart-changed', { detail: items }));
    paintBadge();
    return items;
  };

  const add = (item = {}) => {
    const id = String(item.id || item.sku || Date.now());
    const list = read();
    const found = list.find((x) => String(x.id) === id);
    if (found) found.qty = Number(found.qty || 1) + 1;
    else
      list.unshift({
        id,
        title: item.title || item.name || 'عنصر',
        price: Number(item.price || 0),
        points: Number(item.points || 0),
        qty: 1,
        platformCode: item.platformCode || '',
      });
    return save(list);
  };

  const setQty = (id, qty) => {
    const list = read()
      .map((x) => (String(x.id) === String(id) ? { ...x, qty: Math.max(0, Number(qty) || 0) } : x))
      .filter((x) => x.qty > 0);
    return save(list);
  };

  const remove = (id) => save(read().filter((x) => String(x.id) !== String(id)));
  const clear = () => save([]);
  const count = () => read().reduce((n, x) => n + Number(x.qty || 0), 0);
  const total = () => read().reduce((n, x) => n + Number(x.price || 0) * Number(x.qty || 0), 0);

  const checkout = () => {
    const items = read();
    if (!items.length) return { ok: false, error: 'السلة فارغة' };
    const buyer = window.HubAuth?.getUser?.()?.email || 'عميل هوب';
    const orders = [];
    const storeItems =
      window.HubStore?.get?.()?.empire?.salesStore?.items ||
      window.HubMarketplaceData?.STORE_ITEMS ||
      [];

    for (const line of items) {
      let order = null;
      if (window.HubStore?.placeStoreOrder) {
        order = window.HubStore.placeStoreOrder(line.id, buyer);
      }
      if (!order) {
        const match = storeItems.find(
          (x) =>
            String(x.id) === String(line.id) ||
            String(x.title || '') === String(line.title || '')
        );
        if (match && window.HubStore?.placeStoreOrder) {
          order = window.HubStore.placeStoreOrder(match.id, buyer);
        }
      }
      if (!order) {
        // مسار احتياطي: سجّل طلبًا محليًا وفعّل صلاحية إن وُجدت
        order = {
          id: `cart-${Date.now().toString(36)}`,
          title: line.title,
          amount: line.price,
          points: line.points,
          qty: line.qty,
          source: 'cart-fallback',
          at: new Date().toISOString(),
        };
        if (line.platformCode && window.HubStore?.grantSubscription) {
          window.HubStore.grantSubscription({
            email: buyer.includes('@') ? buyer : undefined,
            systemCode: String(line.platformCode).toUpperCase(),
            plan: line.title,
            permissions: ['read', 'write'],
            source: 'cart',
          });
        }
        try {
          const key = 'naiosh_hub_cart_orders_v1';
          const prev = JSON.parse(localStorage.getItem(key) || '[]');
          prev.unshift(order);
          localStorage.setItem(key, JSON.stringify(prev.slice(0, 50)));
        } catch {}
      }
      if (order) orders.push(order);
    }

    if (!orders.length) return { ok: false, error: 'تعذّر إتمام الشراء' };
    clear();
    try {
      const notes = JSON.parse(localStorage.getItem('naiosh_hub_notifications_v1') || '[]');
      notes.unshift({
        id: `n-${Date.now()}`,
        title: 'تم إتمام شراء من السلة',
        body: `${orders.length} عنصر — يمكنك فتح النظام من مكتبي أو الأنظمة.`,
        href: 'office.html',
        at: new Date().toISOString(),
      });
      localStorage.setItem('naiosh_hub_notifications_v1', JSON.stringify(notes.slice(0, 40)));
    } catch {}
    return { ok: true, orders };
  };

  const paintBadge = () => {
    document.querySelectorAll('[data-hub-cart-count]').forEach((el) => {
      el.textContent = String(count());
      el.hidden = count() === 0;
    });
  };

  const ensureFab = () => {
    if (document.querySelector('[data-hub-cart-fab]')) return;
    const a = document.createElement('a');
    a.href = 'cart.html';
    a.className = 'hub-cart-fab';
    a.dataset.hubCartFab = '1';
    a.innerHTML = `<i class="fas fa-cart-shopping"></i><span data-hub-cart-count hidden>0</span>`;
    a.title = 'سلة المشتريات';
    document.body.appendChild(a);
    paintBadge();
  };

  window.HubCart = { KEY, read, add, setQty, remove, clear, count, total, checkout, paintBadge, ensureFab };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureFab();
      paintBadge();
    });
  } else {
    ensureFab();
    paintBadge();
  }
})();
