/**
 * طلباتي — قائمة وتفاصيل طلبات المنتجات
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-hub-my-orders]');
  if (!root) return;

  const STATUS_LABELS = {
    received: 'تم استلام الطلب',
    payment_confirmed: 'تم تأكيد الدفع',
    under_review: 'قيد المراجعة',
    confirmed: 'تم التأكيد',
    in_progress: 'قيد التنفيذ',
    completed: 'مكتمل',
    cancelled: 'ملغي',
  };

  const PAYMENT_LABELS = {
    demo_paid: 'دفع تجريبي مكتمل',
    unpaid: 'غير مدفوع',
    failed: 'فشل الدفع',
    refunded: 'مسترد',
  };

  const money = (n) =>
    window.HubPurchase?.formatUsd?.(n) ||
    `$${Number(n || 0).toLocaleString('en-US')}`;

  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const alertEl = document.getElementById('mo-alert');
  const showError = (msg) => {
    alertEl.hidden = !msg;
    alertEl.textContent = msg || '';
  };

  const authHeaders = () => {
    const headers = { Accept: 'application/json' };
    const token = window.HubAuth?.getToken?.() || '';
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers['X-Hub-Token'] = token;
    }
    return headers;
  };

  const fmtDate = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${day} ${hh}:${mm}`;
    } catch {
      return String(iso);
    }
  };

  const listEl = document.getElementById('mo-list');
  const detailEl = document.getElementById('mo-detail');
  const params = new URLSearchParams(location.search);
  let focusId = params.get('id') || '';

  const paintList = (orders) => {
    if (!orders.length) {
      listEl.innerHTML =
        '<p class="hub-co-lead">لا توجد طلبات بعد. ابدأ من <a href="products.html">المنتجات</a>.</p>';
      return;
    }
    listEl.innerHTML = orders
      .map((o) => {
        const status = STATUS_LABELS[o.orderStatus] || o.orderStatus;
        const pay = PAYMENT_LABELS[o.paymentStatus] || o.paymentStatus;
        return `<article class="hub-order-card" data-order-id="${esc(o.id)}">
          <h3>${esc(o.number)} — ${esc(o.productName)}</h3>
          <div class="meta">
            <span>السعر: ${esc(money(o.total))}</span>
            <span>تاريخ الطلب: ${esc(fmtDate(o.createdAt))}</span>
            <span>حالة الدفع: ${esc(pay)}</span>
            <span>حالة الطلب: ${esc(status)}</span>
          </div>
          <div class="hub-checkout-actions">
            <button type="button" class="btn btn-primary" data-view-order="${esc(o.id)}">عرض التفاصيل</button>
          </div>
        </article>`;
      })
      .join('');
  };

  const paintDetail = (order, labels = {}) => {
    const statusLabels = { ...STATUS_LABELS, ...(labels.statusLabels || {}) };
    const paymentLabels = { ...PAYMENT_LABELS, ...(labels.paymentLabels || {}) };
    const timeline = order.timeline || [];
    detailEl.hidden = false;
    detailEl.innerHTML = `
      <h2>تفاصيل الطلب ${esc(order.number)}</h2>
      <div class="hub-co-totals" style="margin-bottom:1rem">
        <div class="row"><span>المنتج</span><span>${esc(order.productName)}</span></div>
        <div class="row"><span>Product ID</span><span>${esc(order.productId)}</span></div>
        <div class="row"><span>الكمية</span><span>${esc(order.qty)}</span></div>
        <div class="row"><span>السعر وقت الشراء</span><span>${esc(money(order.unitPrice))}</span></div>
        <div class="row total"><span>الإجمالي</span><span>${esc(money(order.total))}</span></div>
        <div class="row"><span>حالة الدفع</span><span>${esc(paymentLabels[order.paymentStatus] || order.paymentStatus)}</span></div>
        <div class="row"><span>حالة الطلب</span><span>${esc(statusLabels[order.orderStatus] || order.orderStatus)}</span></div>
        <div class="row"><span>تاريخ الإنشاء</span><span>${esc(fmtDate(order.createdAt))}</span></div>
      </div>
      <h3>مسار الحالة</h3>
      <ol class="hub-order-timeline">
        ${timeline
          .map((t) => {
            const done = !!t.done;
            const current = done && t.key === order.orderStatus;
            return `<li class="${done ? 'is-done' : ''} ${current ? 'is-current' : ''}">
              ${esc(t.label || statusLabels[t.key] || t.key)}
              ${t.at && done ? `<span class="at">${esc(fmtDate(t.at))}</span>` : ''}
            </li>`;
          })
          .join('')}
      </ol>
      <div class="hub-checkout-actions">
        <button type="button" class="btn btn-secondary" data-back-list>العودة للقائمة</button>
        <a class="btn btn-secondary" href="products.html">المنتجات</a>
      </div>`;
    detailEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const loadOrder = async (id) => {
    showError('');
    const res = await fetch(`/api/hub/product-orders/${encodeURIComponent(id)}`, {
      headers: authHeaders(),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      showError(data.error || 'تعذر تحميل الطلب.');
      return;
    }
    paintDetail(data.order, data);
  };

  const boot = async () => {
    if (!window.HubAuth?.isLoggedIn?.()) {
      showError('يرجى تسجيل الدخول لعرض طلباتك.');
      listEl.innerHTML = `<p><a class="btn btn-primary" href="login.html?next=${encodeURIComponent(location.pathname + location.search)}">تسجيل الدخول</a></p>`;
      return;
    }
    try {
      const res = await fetch('/api/hub/product-orders', {
        headers: authHeaders(),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        showError(data.error || 'تعذر تحميل الطلبات.');
        return;
      }
      paintList(data.orders || []);
      if (focusId) await loadOrder(focusId);
    } catch (err) {
      showError(err.message || 'تعذر تحميل الطلبات.');
    }
  };

  root.addEventListener('click', (e) => {
    const view = e.target.closest('[data-view-order]');
    if (view) {
      focusId = view.getAttribute('data-view-order');
      history.replaceState(null, '', `my-orders.html?id=${encodeURIComponent(focusId)}`);
      loadOrder(focusId);
      return;
    }
    if (e.target.closest('[data-back-list]')) {
      detailEl.hidden = true;
      detailEl.innerHTML = '';
      history.replaceState(null, '', 'my-orders.html');
      focusId = '';
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
