/**
 * صفحات الاستشارة / المقترحات / الشكاوي — مرفقات متعددة + حفظ دائم عند تسجيل الدخول
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-hub-service]');
  if (!root) return;

  const kind = root.getAttribute('data-hub-service') || 'consultation';
  const form = root.querySelector('[data-service-form]');
  const feedback = root.querySelector('[data-service-feedback]');
  const listEl = root.querySelector('[data-service-list]');
  const entityType = kind === 'complaint' ? 'complaint' : 'request';

  const escapeHtml = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const attachLine = (t) => {
    const bits = [];
    if (t.attachLink) bits.push(`<a href="${escapeHtml(t.attachLink)}" target="_blank" rel="noopener noreferrer">رابط</a>`);
    const att = Array.isArray(t.attachments) ? t.attachments : [];
    att.forEach((a) => {
      const label = a.kind === 'image' ? 'صورة' : a.kind === 'video' ? 'فيديو' : 'ملف';
      if (a.url) bits.push(`<a href="${escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
      else bits.push(label);
    });
    if (!att.length) {
      if (t.attachDocName || t.attachDocUrl) bits.push(`ملف: ${escapeHtml(t.attachDocName || 'مستند')}`);
      if (t.attachImageUrl) bits.push(t.attachImageUrl ? `<a href="${escapeHtml(t.attachImageUrl)}" target="_blank" rel="noopener noreferrer">صورة</a>` : 'صورة');
      if (t.attachVideoUrl) bits.push(t.attachVideoUrl ? `<a href="${escapeHtml(t.attachVideoUrl)}" target="_blank" rel="noopener noreferrer">فيديو</a>` : 'فيديو');
    }
    if (t.attachmentsPersisted) bits.push('محفوظ');
    if (!bits.length) return '';
    return `<p class="hub-attach-chip" style="margin-top:8px">${bits.join(' · ')}</p>`;
  };

  const renderList = async () => {
    if (!listEl || !window.HubServiceRequests?.byKind) return;
    const items = window.HubServiceRequests.byKind(kind).slice(0, 8);
    if (!items.length) {
      listEl.innerHTML = '<p class="hub-service-empty">لا طلبات بعد — أرسل النموذج أعلاه.</p>';
      return;
    }
    const enriched = await Promise.all(
      items.map(async (t) => {
        if (!window.HubAuth?.isLoggedIn?.() || !window.HubFormAttachments?.loadEntityAttachments) return t;
        try {
          const loaded = await window.HubFormAttachments.loadEntityAttachments({ entityType, entityId: t.id });
          if (loaded?.length) {
            return {
              ...t,
              attachmentsPersisted: true,
              attachments: loaded.map((a) => ({
                url: a.contentUrl || a.url || '',
                kind: a.category || 'file',
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
    listEl.innerHTML = enriched
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
          ${attachLine(t)}
        </article>`
      )
      .join('');
  };

  window.HubFormAttachments?.upgradeForm?.(form, { showLink: true, multi: true, title: 'المرفقات' });
  window.HubFormAttachments?.bind?.(form);

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const data = new FormData(form);
    const collected = window.HubFormAttachments?.collect?.(form) || {};
    const stored = window.HubFormAttachments?.toStored?.(collected) || {};
    const result = await window.HubServiceRequests?.create?.({
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
      ...stored,
    });
    if (!result?.ok) {
      if (result?.needsLogin) {
        if (feedback) {
          feedback.hidden = false;
          feedback.textContent =
            result.error || 'يجب تسجيل الدخول لإرسال الطلب إلى الإدارة. لن يُحفظ الطلب في المتصفح فقط.';
        }
        const go = confirm((result.error || 'يلزم تسجيل الدخول.') + '\n\nالانتقال لصفحة الدخول الآن؟');
        if (go) location.href = result.loginUrl || window.HubServiceRequests?.loginUrl?.() || 'login.html';
        return;
      }
      alert(result?.error || 'أدخل عنوانًا واضحًا للطلب');
      return;
    }
    const item = result.item;
    const persist = await window.HubFormAttachments?.softPersistToEntity?.({
      entityType,
      entityId: item.id,
      ownerEmail: item.email || '',
      items: collected.items || [],
    });
    if (persist?.persisted) {
      try {
        const list = window.HubServiceRequests.read();
        const row = list.find((x) => x.id === item.id);
        if (row) {
          row.attachmentsPersisted = true;
          localStorage.setItem(window.HubServiceRequests.KEY, JSON.stringify(list));
        }
      } catch {
        /* ignore */
      }
    }
    if (feedback) {
      feedback.hidden = false;
      const note = persist?.persisted ? ' تم ربط المرفقات بالحفظ الدائم.' : '';
      const ref = item.number ? ` رقم المرجع: ${item.number}.` : '';
      feedback.textContent =
        'تم حفظ طلبك في النظام ووصل إلى صندوق الإدارة.' + ref + note;
    }
    form.reset();
    window.HubFormAttachments?.reset?.(form);
    renderList();
  });

  renderList();
})();
