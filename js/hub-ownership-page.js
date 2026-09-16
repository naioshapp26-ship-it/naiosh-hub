/**
 * واجهة صفحة ملكية نايوش
 */
(() => {
  'use strict';

  const qs = (s, r = document) => r.querySelector(s);
  const api = () => window.HubOwnership;

  const esc = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fmtDate = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('ar-EG');
    } catch {
      return String(iso).slice(0, 10);
    }
  };

  const statusLabel = (s) =>
    ({ active: 'ساري', disabled: 'موقوف', archived: 'مؤرشف' }[s] || s || '—');

  const visLabel = (v) =>
    ({ public: 'عام', customers: 'العملاء المسجلون', admin: 'الإدارة فقط' }[v] || v);

  let ui = { q: '', modal: null, detailId: '' };

  const showModal = (html) => {
    const mount = qs('[data-own-modal]');
    if (!mount) return;
    mount.innerHTML = `<div class="own-overlay" data-own-overlay><div class="own-modal">${html}</div></div>`;
    mount.querySelector('[data-own-overlay]')?.addEventListener('click', (e) => {
      if (e.target.matches('[data-own-overlay]') || e.target.closest('[data-own-close]')) {
        mount.innerHTML = '';
        ui.modal = null;
      }
    });
  };

  const cardHtml = (item) => {
    const manage = api().canManage();
    const isDoc = item.kind === 'document';
    const isAction = item.kind === 'action' || item.action === 'add';
    const actions = [];
    if (isAction) {
      actions.push(
        `<button type="button" class="own-btn primary" data-own-add><i class="fas fa-plus"></i> إضافة سجل</button>`
      );
    } else {
      actions.push(
        `<button type="button" class="own-btn primary" data-own-detail="${esc(item.id)}"><i class="fas fa-eye"></i> عرض التفاصيل</button>`
      );
      if (item.href) {
        actions.push(
          `<a class="own-btn" href="${esc(item.href)}"><i class="fas fa-arrow-up-left-from-circle"></i> فتح الصفحة المرتبطة</a>`
        );
      }
      if (isDoc && item.attachmentUrl) {
        actions.push(
          `<a class="own-btn" href="${esc(item.attachmentUrl)}" target="_blank" rel="noopener"><i class="fas fa-file"></i> عرض الوثيقة</a>`
        );
        actions.push(
          `<a class="own-btn" href="${esc(item.attachmentUrl)}" download><i class="fas fa-download"></i> تحميل</a>`
        );
      } else if (isDoc) {
        actions.push(
          `<button type="button" class="own-btn" data-own-detail="${esc(item.id)}"><i class="fas fa-file"></i> عرض الوثيقة</button>`
        );
      }
    }
    if (manage && !isAction) {
      actions.push(`<button type="button" class="own-btn" data-own-edit="${esc(item.id)}">تعديل</button>`);
      actions.push(
        `<button type="button" class="own-btn" data-own-status="${esc(item.id)}" data-status="${
          item.status === 'active' ? 'disabled' : 'active'
        }">${item.status === 'active' ? 'إيقاف' : 'تفعيل'}</button>`
      );
      actions.push(
        `<button type="button" class="own-btn" data-own-status="${esc(item.id)}" data-status="archived">أرشفة</button>`
      );
      actions.push(`<button type="button" class="own-btn danger" data-own-del="${esc(item.id)}">حذف</button>`);
    }

    return `<article class="own-card" data-own-id="${esc(item.id)}" id="item-${esc(item.id)}">
      <div class="own-card-head">
        <span class="own-card-icon" aria-hidden="true"><i class="fas ${esc(item.icon || 'fa-file')}"></i></span>
        <div>
          <h3>${esc(item.title)}</h3>
          <p class="own-meta">${esc(item.category || item.kind)} · ${esc(statusLabel(item.status))}${
            manage ? ` · ${esc(visLabel(item.visibility))}` : ''
          }</p>
        </div>
      </div>
      <p class="own-desc">${esc(item.description || '')}</p>
      ${
        isDoc
          ? `<div class="own-doc-meta">
              <div><span>نوع الوثيقة</span><strong>${esc(item.docType || '—')}</strong></div>
              <div><span>المرجع</span><strong dir="ltr">${esc(item.reference || '—')}</strong></div>
              <div><span>آخر تحديث</span><strong>${esc(fmtDate(item.updatedAt))}</strong></div>
            </div>`
          : ''
      }
      <div class="own-card-actions">${actions.join('')}</div>
    </article>`;
  };

  const detailModal = (id) => {
    const item = api().get(id);
    if (!item || !api().canSee(item)) return;
    showModal(`
      <button type="button" class="own-btn" data-own-close>إغلاق</button>
      <h2 style="margin-top:12px">${esc(item.title)}</h2>
      <p class="own-desc">${esc(item.description || '')}</p>
      <div class="own-doc-meta" style="margin-top:12px">
        <div><span>التصنيف</span><strong>${esc(item.category || '—')}</strong></div>
        <div><span>النوع</span><strong>${esc(item.kind || '—')}</strong></div>
        <div><span>الحالة</span><strong>${esc(statusLabel(item.status))}</strong></div>
        ${item.docType ? `<div><span>نوع الوثيقة</span><strong>${esc(item.docType)}</strong></div>` : ''}
        ${item.reference ? `<div><span>المرجع</span><strong dir="ltr">${esc(item.reference)}</strong></div>` : ''}
        <div><span>آخر تحديث</span><strong>${esc(fmtDate(item.updatedAt))}</strong></div>
      </div>
      <div class="own-card-actions" style="margin-top:16px">
        ${item.href ? `<a class="own-btn primary" href="${esc(item.href)}">فتح الصفحة المرتبطة</a>` : ''}
        ${
          item.attachmentUrl
            ? `<a class="own-btn" href="${esc(item.attachmentUrl)}" target="_blank" rel="noopener">عرض الوثيقة</a>
               <a class="own-btn" href="${esc(item.attachmentUrl)}" download>تحميل</a>`
            : ''
        }
        <button type="button" class="own-btn" data-own-close>إغلاق</button>
      </div>`);
  };

  const editModal = (id) => {
    const item = id ? api().get(id) : null;
    const isNew = !item;
    if (!api().canManage()) return alert('صلاحية الإدارة مطلوبة');
    showModal(`
      <h2>${isNew ? 'إضافة سجل ملكية' : 'تعديل السجل'}</h2>
      <label>اسم السجل *</label><input data-f="title" value="${esc(item?.title || '')}" />
      <label>التصنيف *</label><input data-f="category" value="${esc(item?.category || '')}" />
      <label>القسم</label>
      <select data-f="section">${api()
        .SECTIONS.filter((s) => s.id !== 'overview')
        .map(
          (s) =>
            `<option value="${s.id}" ${item?.section === s.id ? 'selected' : ''}>${esc(s.label)}</option>`
        )
        .join('')}</select>
      <label>النوع</label>
      <select data-f="kind">
        ${['ownership', 'document', 'right', 'info', 'action']
          .map((k) => `<option value="${k}" ${item?.kind === k ? 'selected' : ''}>${k}</option>`)
          .join('')}
      </select>
      <label>الوصف</label><textarea data-f="description">${esc(item?.description || '')}</textarea>
      <label>نوع الوثيقة / المرجع</label>
      <div class="own-two">
        <input data-f="docType" placeholder="نوع الوثيقة" value="${esc(item?.docType || '')}" />
        <input data-f="reference" placeholder="مرجع" value="${esc(item?.reference || '')}" dir="ltr" />
      </div>
      <label>رابط مرتبط / مرفق</label>
      <div class="own-two">
        <input data-f="href" placeholder="href" value="${esc(item?.href || '')}" dir="ltr" />
        <input data-f="attachmentUrl" placeholder="attachment URL" value="${esc(item?.attachmentUrl || '')}" dir="ltr" />
      </div>
      <label>الحالة</label>
      <select data-f="status">
        <option value="active" ${item?.status !== 'disabled' && item?.status !== 'archived' ? 'selected' : ''}>ساري</option>
        <option value="disabled" ${item?.status === 'disabled' ? 'selected' : ''}>موقوف</option>
        <option value="archived" ${item?.status === 'archived' ? 'selected' : ''}>مؤرشف</option>
      </select>
      <label>صلاحية الظهور</label>
      <select data-f="visibility">
        <option value="public" ${item?.visibility === 'public' || !item ? 'selected' : ''}>عام</option>
        <option value="customers" ${item?.visibility === 'customers' ? 'selected' : ''}>العملاء المسجلون</option>
        <option value="admin" ${item?.visibility === 'admin' ? 'selected' : ''}>الإدارة فقط</option>
      </select>
      <div class="own-card-actions" style="margin-top:16px">
        <button type="button" class="own-btn" data-own-close>إلغاء</button>
        <button type="button" class="own-btn primary" data-own-save="${esc(id || '')}">حفظ</button>
      </div>`);
    qs('[data-own-save]')?.addEventListener('click', () => {
      const get = (k) => qs(`[data-f="${k}"]`)?.value;
      const payload = {
        title: get('title'),
        category: get('category'),
        section: get('section'),
        kind: get('kind'),
        description: get('description'),
        docType: get('docType'),
        reference: get('reference'),
        href: get('href'),
        attachmentUrl: get('attachmentUrl'),
        status: get('status'),
        visibility: get('visibility'),
      };
      const res = isNew ? api().add(payload) : api().update(id, payload);
      if (!res.ok) return alert(res.error);
      qs('[data-own-modal]').innerHTML = '';
      render();
    });
  };

  const render = () => {
    const root = qs('[data-own-root]');
    if (!root || !api()) return;
    api().ensure();
    const s = api().stats();
    const q = ui.q;

    qs('[data-own-stat-total]') && (qs('[data-own-stat-total]').textContent = String(s.total));
    qs('[data-own-stat-docs]') && (qs('[data-own-stat-docs]').textContent = String(s.documents));
    qs('[data-own-stat-active]') && (qs('[data-own-stat-active]').textContent = String(s.activeDocuments));
    qs('[data-own-stat-updated]') && (qs('[data-own-stat-updated]').textContent = fmtDate(s.updatedAt));

    const manageBar = qs('[data-own-admin]');
    if (manageBar) {
      manageBar.hidden = !api().canManage();
    }

    api().SECTIONS.forEach((sec) => {
      const mount = qs(`[data-own-section="${sec.id}"]`);
      if (!mount) return;
      if (sec.id === 'overview') {
        mount.innerHTML = `<div class="own-overview-card">
          <h3>ما هي ملكية نايوش؟</h3>
          <p>مركز موحّد يعرض أنواع الملكية الهيكلية، والملكية الفكرية، ووثائق التوثيق المرتبطة بمنظومة نايوش — بدل القائمة الطويلة في شريط التنقل.</p>
          <ul>
            <li>ملكيات الهيكل: مكتب رئيسي · فرع · حاضنة · منصة · مكتب · فرانشايز</li>
            <li>وثائق التوثيق: عقود · ختم · براءات · ابتكار · علامات · نماذج · تسويات</li>
            <li>الوصول حسب الصلاحية: عام / عملاء / إدارة</li>
          </ul>
        </div>`;
        return;
      }
      const items = api().list({ q, section: sec.id });
      mount.innerHTML = items.length
        ? `<div class="own-grid">${items.map(cardHtml).join('')}</div>`
        : `<p class="own-empty">لا عناصر مطابقة في هذا القسم.</p>`;
    });

    bind();
  };

  const bind = () => {
    const root = qs('[data-own-root]');
    if (!root || root.dataset.bound === '1') {
      // rebind dynamic buttons via delegation already set
    }
    if (root.dataset.bound === '1') return;
    root.dataset.bound = '1';

    root.addEventListener('click', (e) => {
      const t = e.target.closest('button, a');
      if (!t) return;
      if (t.matches('[data-own-add]') || t.closest('[data-own-open-add]')) {
        e.preventDefault();
        if (!api().canManage() && !api().isLoggedIn()) {
          location.href = 'login.html';
          return;
        }
        if (!api().canManage()) {
          alert('إضافة السجلات متاحة للإدارة. تواصل مع فريق نايوش.');
          return;
        }
        editModal('');
        return;
      }
      if (t.dataset.ownDetail) {
        e.preventDefault();
        detailModal(t.dataset.ownDetail);
        return;
      }
      if (t.dataset.ownEdit) {
        e.preventDefault();
        editModal(t.dataset.ownEdit);
        return;
      }
      if (t.dataset.ownStatus) {
        e.preventDefault();
        api().setStatus(t.dataset.ownStatus, t.dataset.status);
        render();
        return;
      }
      if (t.dataset.ownDel) {
        e.preventDefault();
        if (!confirm('حذف هذا السجل نهائيًا؟')) return;
        api().remove(t.dataset.ownDel);
        render();
      }
    });

    qs('[data-own-q]')?.addEventListener('input', (e) => {
      ui.q = e.target.value || '';
      render();
    });

    qs('[data-own-open-add]')?.addEventListener('click', () => {
      if (!api().canManage()) return alert('صلاحية الإدارة مطلوبة');
      editModal('');
    });

    // smooth scroll nav
    root.querySelectorAll('[data-own-jump]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const id = a.getAttribute('data-own-jump');
        const el = qs(`#${id}`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        root.querySelectorAll('[data-own-jump]').forEach((x) => x.classList.toggle('is-active', x === a));
      });
    });
  };

  const init = () => {
    if (!qs('[data-own-root]')) return;
    render();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
