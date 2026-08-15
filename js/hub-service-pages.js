/**
 * صفحات الاستشارة / المقترحات / الشكاوي
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-hub-service]');
  if (!root) return;

  const kind = root.getAttribute('data-hub-service') || 'consultation';
  const form = root.querySelector('[data-service-form]');
  const feedback = root.querySelector('[data-service-feedback]');
  const listEl = root.querySelector('[data-service-list]');

  const renderList = () => {
    if (!listEl || !window.HubServiceRequests?.byKind) return;
    const items = window.HubServiceRequests.byKind(kind).slice(0, 8);
    if (!items.length) {
      listEl.innerHTML = '<p class="hub-service-empty">لا طلبات بعد — أرسل النموذج أعلاه.</p>';
      return;
    }
    listEl.innerHTML = items
      .map(
        (t) => `<article class="hub-feature-card">
          <div class="hub-feature-card-top">
            <span class="hub-feature-icon"><i class="fas fa-${
              kind === 'complaint' ? 'triangle-exclamation' : kind === 'suggestion' ? 'lightbulb' : 'comments'
            }"></i></span>
            <div>
              <h3>${escapeHtml(t.title)}</h3>
              <p style="margin:4px 0 0;font-size:12px;color:#6b7280">${escapeHtml(t.system)} · ${escapeHtml(
          t.status
        )} · ${escapeHtml(t.priority || '')}</p>
            </div>
          </div>
          <p>${escapeHtml(t.body || '—')}</p>
        </article>`
      )
      .join('');
  };

  const escapeHtml = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const data = new FormData(form);
    const item = window.HubServiceRequests?.create?.({
      kind,
      title: data.get('title'),
      body: data.get('body'),
      system: data.get('system'),
      category: data.get('category'),
      priority: data.get('priority'),
      fullName: data.get('fullName'),
      phone: data.get('phone'),
      email: data.get('email'),
      preferredAt: data.get('preferredAt'),
      contactMethod: data.get('contactMethod'),
      reference: data.get('reference'),
    });
    if (!item) {
      alert('أدخل عنوانًا واضحًا للطلب');
      return;
    }
    if (feedback) {
      feedback.hidden = false;
      feedback.textContent = 'تم استلام طلبك وربطه بالنظام. فريق هوب بيتابعه من غرفة العمليات.';
    }
    form.reset();
    renderList();
  });

  renderList();
})();
