/**
 * Checkout workflow — Buy Now / Cart → order API (server-side prices)
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-hub-checkout]');
  if (!root) return;

  const DRAFT_KEY = 'naiosh_hub_checkout_draft_v1';
  const params = new URLSearchParams(location.search);
  const money = (n) =>
    window.HubPurchase?.formatUsd?.(n) ||
    (window.HubCurrency?.format ? window.HubCurrency.format(n) : `$${Number(n) || 0}`);

  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const alertEl = document.getElementById('co-alert');
  const showError = (msg) => {
    if (!alertEl) return;
    alertEl.hidden = !msg;
    alertEl.textContent = msg || '';
    if (msg) alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const authHeaders = () => {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const token = window.HubAuth?.getToken?.() || '';
    const user = window.HubAuth?.getUser?.() || {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers['X-Hub-Token'] = token;
    }
    if (user.role) headers['X-Hub-User-Role'] = user.role;
    if (user.name || user.fullName) headers['X-Hub-User-Name'] = user.name || user.fullName;
    return headers;
  };

  const loadDraft = () => {
    try {
      return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
    } catch {
      return null;
    }
  };

  const saveDraft = (draft) => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  };

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  };

  let state = {
    step: 1,
    source: params.get('source') === 'cart' ? 'cart' : 'buy_now',
    productId: params.get('product') || params.get('productId') || '',
    products: [],
    qty: Math.max(1, Math.min(99, Number(params.get('qty')) || 1)),
    customer: { name: '', email: '', phone: '', country: '', company: '' },
    idempotencyKey: '',
    submitting: false,
    order: null,
    orders: [],
  };

  const draft = loadDraft();
  if (draft && (draft.productId === state.productId || draft.source === state.source)) {
    state = { ...state, ...draft, submitting: false };
  }

  const setStep = (n) => {
    state.step = n;
    saveDraft({
      step: state.step,
      source: state.source,
      productId: state.productId,
      products: state.products.map((p) => ({ id: p.id, qty: p.qty || state.qty })),
      qty: state.qty,
      customer: state.customer,
      idempotencyKey: state.idempotencyKey,
      order: state.order,
      orders: state.orders,
    });

    root.querySelectorAll('[data-panel]').forEach((el) => {
      const key = el.getAttribute('data-panel');
      if (key === 'details') {
        el.hidden = true;
        return;
      }
      el.hidden = String(key) !== String(n);
    });

    root.querySelectorAll('#co-stepper li').forEach((li) => {
      const s = Number(li.dataset.step);
      li.classList.toggle('is-current', s === n);
      li.classList.toggle('is-done', s < n);
    });
    showError('');
  };

  const unitPrice = () => Number(state.products[0]?.price) || 0;
  const lineTotal = () => {
    if (state.source === 'cart' && state.products.length > 1) {
      return state.products.reduce((s, p) => s + Number(p.price || 0) * Number(p.qty || 1), 0);
    }
    return unitPrice() * Number(state.qty || 1);
  };

  const paintProduct = () => {
    const p = state.products[0];
    if (!p) return;
    document.getElementById('co-product-name').textContent = p.name || '—';
    document.getElementById('co-product-meta').textContent = [
      p.category ? `التصنيف: ${p.category}` : '',
      p.brand ? `العلامة: ${p.brand}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    document.getElementById('co-product-desc').textContent = p.description || '';
    document.getElementById('co-product-price').textContent = money(p.price);
    document.getElementById('co-product-status').textContent = p.available
      ? `الحالة: متاح`
      : `الحالة: غير متاح للشراء`;
    const icon = document.getElementById('co-product-icon');
    if (icon) icon.innerHTML = `<i class="fas ${esc(p.icon || 'fa-cube')}"></i>`;

    const lines = document.getElementById('co-lines');
    const qtyInput = document.getElementById('co-qty');
    if (state.source === 'cart' && state.products.length) {
      lines.hidden = false;
      lines.innerHTML = state.products
        .map(
          (x) => `<div class="hub-co-line">
            <span>${esc(x.name)} × ${Number(x.qty || 1)}</span>
            <strong>${esc(money(Number(x.price) * Number(x.qty || 1)))}</strong>
          </div>`
        )
        .join('');
      if (qtyInput) qtyInput.closest('.hub-co-qty-wrap')?.setAttribute('hidden', '');
    } else {
      lines.hidden = true;
      if (qtyInput) {
        qtyInput.closest('.hub-co-qty-wrap')?.removeAttribute('hidden');
        qtyInput.value = String(state.qty);
      }
    }

    // Embed totals in step 1
    let totalsHost = document.getElementById('co-step1-totals');
    if (!totalsHost) {
      totalsHost = document.createElement('div');
      totalsHost.id = 'co-step1-totals';
      totalsHost.className = 'hub-co-totals';
      totalsHost.style.marginTop = '1rem';
      document.getElementById('co-step-1')?.querySelector('.hub-checkout-actions')?.before(totalsHost);
    }
    const qty = state.source === 'cart' ? state.products.reduce((n, x) => n + Number(x.qty || 1), 0) : state.qty;
    totalsHost.innerHTML = `
      <div class="row"><span>سعر المنتج</span><span>${esc(money(state.source === 'cart' && state.products.length > 1 ? lineTotal() / Math.max(1, qty) : unitPrice()))}</span></div>
      <div class="row"><span>الكمية</span><span>${qty}</span></div>
      <div class="row total"><span>الإجمالي</span><span>${esc(money(lineTotal()))}</span></div>`;
  };

  const paintCustomer = () => {
    const user = window.HubAuth?.getUser?.();
    const loggedIn = window.HubAuth?.isLoggedIn?.();
    const gate = document.getElementById('co-login-gate');
    const form = document.getElementById('co-customer-form');
    const loginLink = document.getElementById('co-login-link');
    if (loginLink) {
      const next = encodeURIComponent(`${location.pathname}${location.search}`);
      loginLink.href = `login.html?next=${next}`;
    }
    if (!loggedIn) {
      gate.hidden = false;
      form.hidden = true;
      document.getElementById('co-customer-lead').textContent =
        'يرجى تسجيل الدخول لإكمال الشراء. نظام الطلبات يعتمد على حساب العميل.';
      return false;
    }
    gate.hidden = true;
    form.hidden = false;
    state.customer = {
      name: state.customer.name || user?.name || user?.fullName || '',
      email: user?.email || state.customer.email || '',
      phone: state.customer.phone || user?.phone || '',
      country: state.customer.country || user?.country || user?.governorate || '',
      company: state.customer.company || user?.company || '',
    };
    document.getElementById('co-name').value = state.customer.name;
    document.getElementById('co-email').value = state.customer.email;
    document.getElementById('co-phone').value = state.customer.phone;
    document.getElementById('co-country').value = state.customer.country;
    document.getElementById('co-company').value = state.customer.company;
    return true;
  };

  const readCustomerForm = () => {
    state.customer = {
      name: document.getElementById('co-name')?.value?.trim() || '',
      email: document.getElementById('co-email')?.value?.trim() || '',
      phone: document.getElementById('co-phone')?.value?.trim() || '',
      country: document.getElementById('co-country')?.value?.trim() || '',
      company: document.getElementById('co-company')?.value?.trim() || '',
    };
    if (!state.customer.name) {
      showError('يرجى إدخال الاسم الكامل.');
      return false;
    }
    if (!state.customer.email || !state.customer.email.includes('@')) {
      showError('يرجى تسجيل الدخول لإكمال الشراء.');
      return false;
    }
    return true;
  };

  const paintReview = () => {
    const box = document.getElementById('co-review');
    const itemsHtml =
      state.source === 'cart' && state.products.length > 1
        ? state.products
            .map(
              (p) =>
                `<p>${esc(p.name)} × ${Number(p.qty || 1)} — <strong>${esc(money(Number(p.price) * Number(p.qty || 1)))}</strong></p>`
            )
            .join('')
        : `<p>المنتج: <strong>${esc(state.products[0]?.name || '')}</strong></p>
           <p>السعر: <strong>${esc(money(unitPrice()))}</strong></p>
           <p>الكمية: <strong>${state.qty}</strong></p>`;
    box.innerHTML = `
      <div class="hub-co-review-block">
        <h3>بيانات العميل</h3>
        <p>${esc(state.customer.name)}</p>
        <p>${esc(state.customer.email)}</p>
        <p>${esc(state.customer.phone || '—')}</p>
        <p>${esc(state.customer.country || '—')}${state.customer.company ? ` · ${esc(state.customer.company)}` : ''}</p>
      </div>
      <div class="hub-co-review-block">
        <h3>بيانات المنتج</h3>
        ${itemsHtml}
      </div>
      <div class="hub-co-totals">
        <div class="row total"><span>الإجمالي</span><span>${esc(money(lineTotal()))}</span></div>
      </div>`;
  };

  const paintPay = () => {
    document.getElementById('co-pay-total').innerHTML = `
      <div class="row total"><span>إجمالي الطلب</span><span>${esc(money(lineTotal()))}</span></div>`;
  };

  const paintSuccess = () => {
    const order = state.order;
    if (!order) return;
    document.getElementById('co-success-dl').innerHTML = `
      <div><dt>رقم الطلب</dt><dd>${esc(order.number)}</dd></div>
      <div><dt>المنتج</dt><dd>${esc(order.productName)}</dd></div>
      <div><dt>الإجمالي</dt><dd>${esc(money(order.total))}</dd></div>
      <div><dt>حالة الدفع</dt><dd>دفع تجريبي مكتمل</dd></div>
      <div><dt>حالة الطلب</dt><dd>تم استلام الطلب</dd></div>`;
    const link = document.getElementById('co-view-order');
    if (link) link.href = `my-orders.html?id=${encodeURIComponent(order.id || order.number)}`;
  };

  const fetchProduct = async (id) => {
    const res = await fetch(`/api/hub/products/${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok || !data.product) {
      throw new Error(data.error || 'تعذر تحميل بيانات المنتج. حاول مرة أخرى.');
    }
    if (!data.product.available) {
      throw new Error('هذا المنتج غير متاح للشراء حاليًا.');
    }
    return data.product;
  };

  const ensureIdempotency = () => {
    if (!state.idempotencyKey) {
      state.idempotencyKey = `chk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      saveDraft({ ...state });
    }
    return state.idempotencyKey;
  };

  const grantLocalAccess = (orders) => {
    (orders || []).forEach((order) => {
      try {
        if (order.platformCode && window.HubStore?.grantSubscription) {
          window.HubStore.grantSubscription({
            email: order.customerEmail,
            systemCode: String(order.platformCode).toUpperCase(),
            plan: order.productName,
            permissions: ['read', 'write'],
            source: 'product-checkout',
          });
        }
        const store = window.HubStore?.get?.()?.empire?.salesStore;
        if (store?.orders) {
          store.orders.unshift({
            id: order.id,
            number: order.number,
            itemId: order.productId,
            title: order.productName,
            buyer: order.customerName || order.customerEmail,
            amount: order.total,
            at: order.createdAt,
            status: order.orderStatus,
            source: 'product-checkout',
          });
          window.HubStore.save?.();
        }
      } catch {
        /* ignore */
      }
    });
  };

  const submitOrder = async () => {
    if (state.submitting) return;
    const btn = document.getElementById('co-pay-confirm');
    state.submitting = true;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إنشاء الطلب…';
    }
    showError('');
    try {
      if (!window.HubAuth?.isLoggedIn?.()) {
        throw new Error('يرجى تسجيل الدخول لإكمال الشراء.');
      }
      const items =
        state.source === 'cart' && state.products.length
          ? state.products.map((p) => ({
              productId: p.id,
              qty: Number(p.qty || 1),
              clientPrice: Number(p.price),
            }))
          : [
              {
                productId: state.productId || state.products[0]?.id,
                qty: state.qty,
                clientPrice: unitPrice(),
              },
            ];

      const res = await fetch('/api/hub/product-orders', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          items,
          customer: state.customer,
          paymentMode: 'demo',
          source: state.source,
          idempotencyKey: ensureIdempotency(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'تعذر إنشاء الطلب.');
      }
      state.orders = data.orders || (data.order ? [data.order] : []);
      state.order = state.orders[0] || data.order;
      grantLocalAccess(state.orders);
      if (state.source === 'cart') window.HubCart?.clear?.();
      clearDraft();
      paintSuccess();
      setStep(5);
    } catch (err) {
      showError(err.message || 'تعذر إنشاء الطلب.');
    } finally {
      state.submitting = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-shield-halved"></i> تأكيد الدفع التجريبي';
      }
    }
  };

  const goNext = async () => {
    showError('');
    if (state.step === 1) {
      const qtyEl = document.getElementById('co-qty');
      if (qtyEl && state.source !== 'cart') {
        state.qty = Math.max(1, Math.min(99, Number(qtyEl.value) || 1));
      }
      if (!state.products.length || state.products.some((p) => !p.available)) {
        showError('هذا المنتج غير متاح للشراء حاليًا.');
        return;
      }
      setStep(2);
      paintCustomer();
      return;
    }
    if (state.step === 2) {
      if (!paintCustomer()) {
        showError('يرجى تسجيل الدخول لإكمال الشراء.');
        return;
      }
      if (!readCustomerForm()) return;
      paintReview();
      setStep(3);
      return;
    }
    if (state.step === 3) {
      if (!document.getElementById('co-terms')?.checked) {
        showError('يرجى الموافقة على شروط الشراء وسياسة الاستخدام.');
        return;
      }
      paintPay();
      setStep(4);
      return;
    }
    if (state.step === 4) {
      await submitOrder();
    }
  };

  const goPrev = () => {
    if (state.step <= 1 || state.step >= 5) return;
    setStep(state.step - 1);
    if (state.step === 1) paintProduct();
    if (state.step === 2) paintCustomer();
    if (state.step === 3) paintReview();
  };

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-co-next]')) {
      e.preventDefault();
      goNext();
    }
    if (e.target.closest('[data-co-prev]')) {
      e.preventDefault();
      goPrev();
    }
    if (e.target.closest('[data-co-edit]')) {
      e.preventDefault();
      setStep(2);
      paintCustomer();
    }
    if (e.target.closest('[data-co-pay]')) {
      e.preventDefault();
      submitOrder();
    }
  });

  document.getElementById('co-qty')?.addEventListener('change', () => {
    state.qty = Math.max(1, Math.min(99, Number(document.getElementById('co-qty').value) || 1));
    paintProduct();
  });

  const boot = async () => {
    try {
      if (state.order && state.step === 5) {
        paintSuccess();
        setStep(5);
        return;
      }

      if (state.source === 'cart') {
        const cart = window.HubCart?.read?.() || [];
        if (!cart.length) {
          showError('السلة فارغة.');
          return;
        }
        const products = [];
        for (const line of cart) {
          const p = await fetchProduct(line.id);
          products.push({ ...p, qty: Number(line.qty || 1) });
        }
        state.products = products;
        state.productId = products[0]?.id || '';
        document.getElementById('co-title').textContent = 'إتمام شراء السلة';
      } else {
        let id = state.productId;
        if (!id && draft?.productId) id = draft.productId;
        if (!id) {
          showError('تعذر تحميل بيانات المنتج. حاول مرة أخرى.');
          return;
        }
        state.productId = id;
        const product = await fetchProduct(id);
        state.products = [product];
      }
      ensureIdempotency();
      paintProduct();
      const startStep = Math.min(Math.max(Number(state.step) || 1, 1), 4);
      setStep(startStep);
      if (startStep === 2) paintCustomer();
      if (startStep === 3) {
        paintCustomer();
        readCustomerForm();
        paintReview();
      }
      if (startStep === 4) paintPay();
    } catch (err) {
      showError(err.message || 'تعذر تحميل بيانات المنتج. حاول مرة أخرى.');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
