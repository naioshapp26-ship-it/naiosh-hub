/**
 * صفحة استقبال طلبات تسجيل المشاريع الجانبية — للأدمن / الفريق الداخلي
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-sp-admin-page]');
  const api = window.HubSideProjectRegistrations;
  if (!root || !api) return;

  const listEl = root.querySelector('[data-spr-list]');
  const statsEl = root.querySelector('[data-spr-stats]');
  const searchEl = root.querySelector('[data-spr-search]');
  const statusFilter = root.querySelector('[data-spr-status-filter]');
  const toastEl = document.getElementById('spr-toast');

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 2600);
  };

  const statusClass = (status) => {
    if (status === 'قيد المتابعة') return 'is-follow';
    if (status === 'تم التواصل' || status === 'مقبول') return 'is-contacted is-accepted';
    if (status === 'مرفوض') return 'is-rejected';
    if (status === 'مغلق') return 'is-closed';
    return '';
  };

  const paintStats = () => {
    if (!statsEl) return;
    const c = api.counts();
    statsEl.innerHTML = `
      <article><strong>${c.total.toLocaleString('ar-EG')}</strong><span>كل الطلبات</span></article>
      <article><strong>${(c.byStatus['جديد'] || 0).toLocaleString('ar-EG')}</strong><span>جديد</span></article>
      <article><strong>${(c.byStatus['قيد المتابعة'] || 0).toLocaleString('ar-EG')}</strong><span>قيد المتابعة</span></article>
      <article><strong>${(c.byStatus['تم التواصل'] || 0).toLocaleString('ar-EG')}</strong><span>تم التواصل</span></article>`;
  };

  const filtered = () => {
    const q = (searchEl?.value || '').trim().toLowerCase();
    const st = statusFilter?.value || '';
    return api.read().filter((r) => {
      if (st && r.status !== st) return false;
      if (!q) return true;
      const hay = `${r.projectName} ${r.ownerName} ${r.phone} ${r.email} ${r.country}`.toLowerCase();
      return hay.includes(q);
    });
  };

  const cardHtml = (r) => {
    const phoneHref = r.phone ? `tel:${esc(r.phone.replace(/\s+/g, ''))}` : '';
    const mailHref = r.email ? `mailto:${esc(r.email)}?subject=${encodeURIComponent('متابعة تسجيل مشروع: ' + r.projectName)}` : '';
    const waHref = r.phone
      ? `https://wa.me/${esc(String(r.phone).replace(/[^\d+]/g, '').replace(/^0/, '966'))}`
      : '';
    const notes = (r.adminNotes || [])
      .slice()
      .reverse()
      .slice(0, 4)
      .map(
        (n) =>
          `<li><strong>${esc(n.status || r.status)}</strong> — ${esc(n.note || '')}<time>${esc(
            new Date(n.at).toLocaleString('ar-EG')
          )}</time></li>`
      )
      .join('');

    return `<article class="spr-card" data-id="${esc(r.id)}">
      <div class="spr-card-head">
        <div>
          <h3>${esc(r.projectName)}</h3>
          <small>${esc(r.ownerName)} · سجّل ${esc(new Date(r.createdAt).toLocaleString('ar-EG'))}</small>
        </div>
        <span class="spr-status ${statusClass(r.status)}">${esc(r.status || 'جديد')}</span>
      </div>

      <div class="spr-contact" aria-label="وسائل التواصل">
        ${
          r.phone
            ? `<a class="is-primary" href="${phoneHref}"><i class="fas fa-phone"></i> ${esc(r.phone)}</a>
               <a href="${waHref}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> واتساب</a>`
            : '<span><i class="fas fa-phone-slash"></i> لا يوجد جوال</span>'
        }
        ${
          r.email
            ? `<a class="${r.phone ? '' : 'is-primary'}" href="${mailHref}"><i class="fas fa-envelope"></i> ${esc(r.email)}</a>`
            : '<span><i class="fas fa-envelope-open"></i> لا يوجد إيميل</span>'
        }
        <span><i class="fas fa-star"></i> يفضّل: ${esc(r.preferredContact || '—')}</span>
      </div>

      <div class="spr-meta">
        <div><span>الدولة</span><strong>${esc(r.country || '—')}</strong></div>
        <div><span>المستوى العلمي</span><strong>${esc(r.education || '—')}</strong></div>
        <div><span>سنوات الخبرة</span><strong>${esc(String(r.experienceYears ?? '—'))}</strong></div>
        <div><span>مجال الخبرة 1</span><strong>${esc(r.experience1 || '—')}</strong></div>
        <div><span>مجال الخبرة 2</span><strong>${esc(r.experience2 || '—')}</strong></div>
        <div><span>مجال الخبرة 3</span><strong>${esc(r.experience3 || '—')}</strong></div>
        <div><span>عمل حالي</span><strong>${esc(r.currentWork || '—')}</strong></div>
        <div><span>سجل / ملاحظات</span><strong>${esc(r.commercialOrNotes || '—')}</strong></div>
        <div><span>مرفقات</span><strong>${esc(
          [r.fileDoc?.name && `ملف: ${r.fileDoc.name}`, r.fileImage?.name && `صورة: ${r.fileImage.name}`, r.fileVideo?.name && `فيديو: ${r.fileVideo.name}`]
            .filter(Boolean)
            .join(' · ') || 'لا مرفقات'
        )}</strong></div>
      </div>

      <div class="spr-actions">
        <select data-spr-status="${esc(r.id)}" aria-label="تغيير الحالة">
          ${api.STATUSES.map((s) => `<option value="${esc(s)}" ${s === r.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}
        </select>
        <input type="text" data-spr-note-input="${esc(r.id)}" placeholder="ملاحظة متابعة للفريق…" />
        <button type="button" class="btn btn-primary" data-spr-save-note="${esc(r.id)}"><i class="fas fa-floppy-disk"></i> حفظ ملاحظة</button>
        <button type="button" class="btn btn-secondary" data-spr-mark-contact="${esc(r.id)}"><i class="fas fa-phone"></i> تم التواصل</button>
        <button type="button" class="btn btn-secondary" data-spr-remove="${esc(r.id)}">حذف</button>
      </div>
      ${notes ? `<ul class="spr-notes">${notes}</ul>` : '<p class="spr-empty" style="padding:8px 0">لا ملاحظات متابعة بعد.</p>'}
    </article>`;
  };

  const paint = () => {
    paintStats();
    if (!listEl) return;
    const list = filtered();
    if (!list.length) {
      listEl.innerHTML =
        '<p class="spr-empty">لا طلبات مطابقة — ستظهر هنا تلقائياً عند إرسال التسجيل من صفحة المشاريع الجانبية.</p>';
      return;
    }
    listEl.innerHTML = list.map(cardHtml).join('');
  };

  paint();

  searchEl?.addEventListener('input', paint);
  statusFilter?.addEventListener('change', paint);
  window.addEventListener('hub-sp-registrations-changed', paint);
  window.addEventListener('storage', (e) => {
    if (e.key === api.KEY) paint();
  });

  root.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-spr-status]');
    if (!sel) return;
    const id = sel.getAttribute('data-spr-status');
    const status = sel.value;
    const updated = api.setStatus(id, status);
    if (!updated) return toast('تعذّر تحديث الحالة');
    toast(`تم تحديث الحالة: ${status}`);
    paint();
  });

  root.addEventListener('click', (e) => {
    const noteBtn = e.target.closest('[data-spr-save-note]');
    if (noteBtn) {
      const id = noteBtn.getAttribute('data-spr-save-note');
      const input = root.querySelector(`[data-spr-note-input="${CSS.escape(id)}"]`);
      const note = input?.value || '';
      if (!api.addNote(id, note)) return toast('اكتب ملاحظة أولاً');
      if (input) input.value = '';
      toast('تم حفظ ملاحظة المتابعة');
      paint();
      return;
    }
    const contactBtn = e.target.closest('[data-spr-mark-contact]');
    if (contactBtn) {
      const id = contactBtn.getAttribute('data-spr-mark-contact');
      api.setStatus(id, 'تم التواصل', 'تم التواصل مع صاحب المشروع');
      toast('تم تسجيل التواصل');
      paint();
      return;
    }
    const rm = e.target.closest('[data-spr-remove]');
    if (rm) {
      api.remove(rm.getAttribute('data-spr-remove'));
      toast('تم حذف الطلب');
      paint();
    }
  });
})();
