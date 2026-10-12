/**
 * واجهة تذاكر الدعم — مرفقات متعددة + حفظ دائم عند تسجيل الدخول
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-hub-support]');
  if (!root) return;
  window.HubTenant?.mountBanner?.(root);

  const form = root.querySelector('[data-support-form]');
  const list = root.querySelector('[data-support-list]');
  const entityType = 'support';

  const attachBits = (t) => {
    const bits = [];
    if (t.attachLink) bits.push('رابط');
    const att = Array.isArray(t.attachments) ? t.attachments : [];
    if (att.length) {
      att.forEach((a) => bits.push(a.kind === 'image' ? 'صورة' : a.kind === 'video' ? 'فيديو' : 'ملف'));
    } else {
      if (t.attachDocName || t.attachDocUrl) bits.push('ملف');
      if (t.attachImageUrl) bits.push('صورة');
      if (t.attachVideoUrl) bits.push('فيديو');
    }
    if (t.attachmentsPersisted) bits.push('محفوظ');
    return bits.length ? ` · ${bits.join(' · ')}` : '';
  };

  const paint = async () => {
    if (!list) return;
    let rows = window.HubSupport?.read?.() || [];
    if (window.HubAuth?.isLoggedIn?.() && window.HubFormAttachments?.loadEntityAttachments) {
      rows = await Promise.all(
        rows.map(async (t) => {
          try {
            const loaded = await window.HubFormAttachments.loadEntityAttachments({
              entityType,
              entityId: t.id,
            });
            if (loaded?.length) {
              return {
                ...t,
                attachmentsPersisted: true,
                attachments: loaded.map((a) => ({
                  kind: a.category || 'file',
                  url: a.contentUrl || a.url || '',
                  name: a.originalFileName || '',
                })),
              };
            }
          } catch {
            /* ignore */
          }
          return t;
        })
      );
    }
    list.innerHTML = rows.length
      ? rows
          .map(
            (t) => `<article class="hub-feature-card" data-ticket="${t.id}">
              <div class="hub-feature-card-top">
                <span class="hub-feature-icon"><i class="fas fa-ticket"></i></span>
                <h3>${t.title}</h3>
              </div>
              <p>${t.body || '—'}</p>
              <p class="hub-feature-section-lead">${t.status} · ${t.system} · ${t.priority} · ${t.requester}${attachBits(t)}</p>
              <div class="hub-feature-actions">
                <button type="button" class="btn btn-secondary" data-status="قيد المعالجة">قيد المعالجة</button>
                <button type="button" class="btn btn-secondary" data-status="مغلق">إغلاق</button>
              </div>
            </article>`
          )
          .join('')
      : '<p class="hub-feature-section-lead">لا توجد تذاكر بعد — أرسل أول طلب صيانة أو دعم.</p>';
  };

  window.HubFormAttachments?.upgradeForm?.(form, { showLink: true, multi: true, title: 'المرفقات' });
  window.HubFormAttachments?.bind?.(form);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const collected = window.HubFormAttachments?.collect?.(form) || {};
    const stored = window.HubFormAttachments?.toStored?.(collected) || {};
    const ticket = window.HubSupport?.create?.({
      title: fd.get('title'),
      body: fd.get('body'),
      system: fd.get('system') || 'HUB',
      priority: fd.get('priority') || 'عادي',
      ...stored,
    });
    if (!ticket) return alert('أدخل عنوان التذكرة');
    await window.HubFormAttachments?.softPersistToEntity?.({
      entityType,
      entityId: ticket.id,
      ownerEmail: ticket.requester || '',
      items: collected.items || [],
    });
    form.reset();
    window.HubFormAttachments?.reset?.(form);
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
