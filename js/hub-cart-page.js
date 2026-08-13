/**
 * صفحة السلة
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-hub-cart-page]');
  if (!root || !window.HubCart) return;

  const list = root.querySelector('[data-cart-list]');
  const summary = root.querySelector('[data-cart-summary]');
  const money = (n) => (window.HubCurrency?.format ? window.HubCurrency.format(n) : `${Number(n) || 0}$`);

  const paint = () => {
    const items = window.HubCart.read();
    if (!items.length) {
      list.innerHTML = '<p class="hub-feature-section-lead">السلة فارغة — أضف منتجات من المتجر أو المنتجات.</p>';
      summary.innerHTML = '';
      return;
    }
    list.innerHTML = items
      .map(
        (i) => `<article class="hub-feature-card" data-id="${i.id}">
          <div class="hub-feature-card-top">
            <span class="hub-feature-icon"><i class="fas fa-box"></i></span>
            <h3>${i.title}</h3>
          </div>
          <p>${money(i.price)} · نقاط: ${i.points || 0}</p>
          <div class="hub-feature-actions">
            <button type="button" class="btn btn-secondary" data-qty="-1">−</button>
            <strong>${i.qty}</strong>
            <button type="button" class="btn btn-secondary" data-qty="1">+</button>
            <button type="button" class="btn btn-secondary" data-remove>حذف</button>
          </div>
        </article>`
      )
      .join('');
    summary.innerHTML = `<div class="hub-feature-card hub-feature-card--featured">
      <h3>الإجمالي: ${money(window.HubCart.total())}</h3>
      <p>${window.HubCart.count()} عنصر</p>
      <div class="hub-feature-actions">
        <button type="button" class="btn btn-primary" data-checkout>إتمام الشراء وتفعيل الصلاحية</button>
        <a class="btn btn-secondary" href="store.html">متابعة التسوق</a>
        <a class="btn btn-secondary" href="office.html">مكتبي</a>
      </div>
    </div>`;
  };

  list?.addEventListener('click', (e) => {
    const card = e.target.closest('[data-id]');
    if (!card) return;
    if (e.target.closest('[data-remove]')) window.HubCart.remove(card.dataset.id);
    const q = e.target.closest('[data-qty]');
    if (q) {
      const item = window.HubCart.read().find((x) => String(x.id) === card.dataset.id);
      if (item) window.HubCart.setQty(card.dataset.id, Number(item.qty) + Number(q.dataset.qty));
    }
    paint();
  });

  summary?.addEventListener('click', (e) => {
    if (!e.target.closest('[data-checkout]')) return;
    const res = window.HubCart.checkout();
    if (!res.ok) return alert(res.error || 'تعذّر الإتمام');
    alert('تم الشراء — يمكنك فتح النظام من مكتبي أو الأنظمة.');
    paint();
    location.href = 'office.html';
  });

  paint();
})();
