/**
 * واجهة تذاكر الدعم
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-hub-support]');
  if (!root) return;
  window.HubTenant?.mountBanner?.(root);

  const form = root.querySelector('[data-support-form]');
  const list = root.querySelector('[data-support-list]');

  const paint = () => {
    if (!list) return;
    const rows = window.HubSupport?.read?.() || [];
    list.innerHTML = rows.length
      ? rows
          .map(
            (t) => `<article class="hub-feature-card" data-ticket="${t.id}">
              <div class="hub-feature-card-top">
                <span class="hub-feature-icon"><i class="fas fa-ticket"></i></span>
                <h3>${t.title}</h3>
              </div>
              <p>${t.body || '—'}</p>
              <p class="hub-feature-section-lead">${t.status} · ${t.system} · ${t.priority} · ${t.requester}</p>
              <div class="hub-feature-actions">
                <button type="button" class="btn btn-secondary" data-status="قيد المعالجة">قيد المعالجة</button>
                <button type="button" class="btn btn-secondary" data-status="مغلق">إغلاق</button>
              </div>
            </article>`
          )
          .join('')
      : '<p class="hub-feature-section-lead">لا توجد تذاكر بعد — أرسل أول طلب صيانة أو دعم.</p>';
  };

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const ticket = window.HubSupport?.create?.({
      title: fd.get('title'),
      body: fd.get('body'),
      system: fd.get('system') || 'HUB',
      priority: fd.get('priority') || 'عادي',
    });
    if (!ticket) return alert('أدخل عنوان التذكرة');
    form.reset();
    paint();
  });

  list?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-status]');
    const card = e.target.closest('[data-ticket]');
    if (!btn || !card) return;
    window.HubSupport?.setStatus?.(card.dataset.ticket, btn.dataset.status);
    paint();
  });

  paint();
})();
