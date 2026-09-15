/**
 * إدارة كتالوج الأنظمة والوحدات
 */
(() => {
  'use strict';

  const qs = (s, r = document) => r.querySelector(s);
  const esc = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  let ui = { modal: null };

  const closeModal = () => {
    ui.modal = null;
    qs('[data-ops-admin-modal]') && (qs('[data-ops-admin-modal]').innerHTML = '');
  };

  const showModal = (html) => {
    const mount = qs('[data-ops-admin-modal]');
    if (!mount) return;
    mount.innerHTML = `<div class="ops-modal-overlay" data-ops-overlay><div class="ops-modal">${html}</div></div>`;
    mount.querySelector('[data-ops-overlay]')?.addEventListener('click', (e) => {
      if (e.target.matches('[data-ops-overlay]') || e.target.closest('[data-ops-close]')) closeModal();
    });
  };

  const render = () => {
    const list = qs('[data-ops-admin-list]');
    if (!list || !window.HubOpsCatalog) return;
    window.HubOpsCatalog.ensure();
    const systems = window.HubOpsCatalog.listSystems({ includeUmbrella: true });
    list.innerHTML = systems
      .map((sys) => {
        const mods = window.HubOpsCatalog.listModules(sys.id);
        const badge =
          sys.status === 'active'
            ? '<span class="ops-badge">فعال</span>'
            : '<span class="ops-badge is-off">غير فعال</span>';
        return `<article class="ops-admin-sys" data-sys="${esc(sys.id)}">
          <header>
            <div>
              <h2><i class="fas ${esc(sys.icon || 'fa-cube')}"></i> ${esc(sys.name)} <small dir="ltr">(${esc(
          sys.shortName || sys.code
        )})</small> ${badge}</h2>
              <p class="desc">${esc(sys.description)}</p>
            </div>
            <div class="ops-admin-actions">
              ${
                sys.isUmbrella
                  ? ''
                  : `<button type="button" class="ops-admin-btn" data-edit-sys="${esc(sys.id)}">تعديل</button>
              <button type="button" class="ops-admin-btn" data-toggle-sys="${esc(sys.id)}">${
                      sys.status === 'active' ? 'تعطيل' : 'تفعيل'
                    }</button>
              <button type="button" class="ops-admin-btn danger" data-del-sys="${esc(sys.id)}">حذف</button>`
              }
              ${
                sys.isUmbrella
                  ? ''
                  : `<button type="button" class="ops-admin-btn primary" data-add-mod="${esc(
                      sys.id
                    )}"><i class="fas fa-plus"></i> إضافة وحدة</button>`
              }
            </div>
          </header>
          ${
            sys.isUmbrella
              ? '<p class="desc">المظلة الرئيسية — التشغيل الشمولي يُدار من شاشة اختيار احتياجات العميل.</p>'
              : `<div class="ops-admin-mods">${
                  mods.length
                    ? mods
                        .map(
                          (m) => `<div class="ops-admin-mod">
                    <div>
                      <strong>${esc(m.name)}</strong>
                      <div class="desc" style="margin:4px 0 0">${esc(m.description)}</div>
                      <div style="margin-top:6px">
                        ${m.canStandalone ? '<span class="ops-badge">مستقلة</span>' : ''}
                        ${m.hideParentDefault ? '<span class="ops-badge">إخفاء الأب</span>' : ''}
                        ${
                          m.status === 'active'
                            ? '<span class="ops-badge">فعال</span>'
                            : '<span class="ops-badge is-off">معطّل</span>'
                        }
                      </div>
                    </div>
                    <div class="ops-admin-actions">
                      <button type="button" class="ops-admin-btn" data-edit-mod="${esc(m.id)}">تعديل</button>
                      <button type="button" class="ops-admin-btn" data-toggle-mod="${esc(m.id)}">${
                            m.status === 'active' ? 'تعطيل' : 'تفعيل'
                          }</button>
                      <button type="button" class="ops-admin-btn danger" data-del-mod="${esc(m.id)}">حذف</button>
                    </div>
                  </div>`
                        )
                        .join('')
                    : '<p class="desc">لا وحدات بعد.</p>'
                }</div>`
          }
        </article>`;
      })
      .join('');
  };

  const openAddSystem = () => {
    showModal(`
      <h3>إضافة نظام</h3>
      <label>اسم النظام *</label><input data-f="name" required />
      <label>الاسم المختصر</label><input data-f="shortName" placeholder="ERP" />
      <label>الوصف *</label><textarea data-f="description" required></textarea>
      <label>الأيقونة (Font Awesome)</label><input data-f="icon" value="fa-cube" />
      <label>نوع النظام</label>
      <select data-f="type"><option value="system">system</option><option value="specialized">specialized</option><option value="education">education</option></select>
      <label>ترتيب العرض</label><input type="number" data-f="sortOrder" value="200" />
      <label>الحالة</label>
      <select data-f="status"><option value="active">فعال</option><option value="inactive">غير فعال</option></select>
      <div class="ops-admin-actions" style="margin-top:16px">
        <button type="button" class="ops-admin-btn" data-ops-close>إلغاء</button>
        <button type="button" class="ops-admin-btn primary" data-save-sys>حفظ النظام</button>
      </div>`);
    qs('[data-save-sys]')?.addEventListener('click', () => {
      const get = (k) => qs(`[data-f="${k}"]`)?.value;
      const res = window.HubOpsCatalog.addSystem({
        name: get('name'),
        shortName: get('shortName'),
        description: get('description'),
        icon: get('icon'),
        type: get('type'),
        sortOrder: get('sortOrder'),
        status: get('status'),
      });
      if (!res.ok) return alert(res.error);
      closeModal();
      render();
    });
  };

  const openEditSystem = (id) => {
    const sys = window.HubOpsCatalog.getSystem(id);
    if (!sys) return;
    showModal(`
      <h3>تعديل نظام</h3>
      <label>اسم النظام *</label><input data-f="name" value="${esc(sys.name)}" />
      <label>الاسم المختصر</label><input data-f="shortName" value="${esc(sys.shortName || '')}" />
      <label>الوصف *</label><textarea data-f="description">${esc(sys.description)}</textarea>
      <label>الأيقونة</label><input data-f="icon" value="${esc(sys.icon || '')}" />
      <label>ترتيب العرض</label><input type="number" data-f="sortOrder" value="${esc(sys.sortOrder)}" />
      <label>الحالة</label>
      <select data-f="status">
        <option value="active" ${sys.status === 'active' ? 'selected' : ''}>فعال</option>
        <option value="inactive" ${sys.status === 'inactive' ? 'selected' : ''}>غير فعال</option>
      </select>
      <div class="ops-admin-actions" style="margin-top:16px">
        <button type="button" class="ops-admin-btn" data-ops-close>إلغاء</button>
        <button type="button" class="ops-admin-btn primary" data-save-sys-edit>حفظ</button>
      </div>`);
    qs('[data-save-sys-edit]')?.addEventListener('click', () => {
      const get = (k) => qs(`[data-f="${k}"]`)?.value;
      const res = window.HubOpsCatalog.updateSystem(id, {
        name: get('name'),
        shortName: get('shortName'),
        description: get('description'),
        icon: get('icon'),
        sortOrder: get('sortOrder'),
        status: get('status'),
      });
      if (!res.ok) return alert(res.error);
      closeModal();
      render();
    });
  };

  const openAddModule = (systemId) => {
    showModal(`
      <h3>إضافة وحدة تشغيلية</h3>
      <label>اسم الوحدة *</label><input data-f="name" placeholder="إدارة المخزون" />
      <label>الوصف *</label><textarea data-f="description" placeholder="إدارة المخزون وحركات الأصناف."></textarea>
      <label class="row-check"><input type="checkbox" data-f="canStandalone" checked /> يمكن تشغيل الوحدة بشكل مستقل</label>
      <label class="row-check"><input type="checkbox" data-f="hideParentDefault" /> يمكن إخفاء اسم النظام الأب</label>
      <label class="row-check"><input type="checkbox" data-f="requiresSiblingModules" /> تحتاج باقي وحدات النظام</label>
      <div class="ops-admin-actions" style="margin-top:16px">
        <button type="button" class="ops-admin-btn" data-ops-close>إلغاء</button>
        <button type="button" class="ops-admin-btn primary" data-save-mod>حفظ الوحدة</button>
      </div>`);
    qs('[data-save-mod]')?.addEventListener('click', () => {
      const res = window.HubOpsCatalog.addModule({
        systemId,
        name: qs('[data-f="name"]')?.value,
        description: qs('[data-f="description"]')?.value,
        canStandalone: !!qs('[data-f="canStandalone"]')?.checked,
        hideParentDefault: !!qs('[data-f="hideParentDefault"]')?.checked,
        requiresSiblingModules: !!qs('[data-f="requiresSiblingModules"]')?.checked,
      });
      if (!res.ok) return alert(res.error);
      closeModal();
      render();
    });
  };

  const openEditModule = (id) => {
    const m = window.HubOpsCatalog.getModule(id);
    if (!m) return;
    showModal(`
      <h3>تعديل وحدة</h3>
      <label>اسم الوحدة *</label><input data-f="name" value="${esc(m.name)}" />
      <label>الوصف *</label><textarea data-f="description">${esc(m.description)}</textarea>
      <label class="row-check"><input type="checkbox" data-f="canStandalone" ${m.canStandalone ? 'checked' : ''} /> يمكن تشغيل الوحدة بشكل مستقل</label>
      <label class="row-check"><input type="checkbox" data-f="hideParentDefault" ${
        m.hideParentDefault ? 'checked' : ''
      } /> يمكن إخفاء اسم النظام الأب</label>
      <label class="row-check"><input type="checkbox" data-f="requiresSiblingModules" ${
        m.requiresSiblingModules ? 'checked' : ''
      } /> تحتاج باقي وحدات النظام</label>
      <label>الحالة</label>
      <select data-f="status">
        <option value="active" ${m.status === 'active' ? 'selected' : ''}>فعال</option>
        <option value="inactive" ${m.status === 'inactive' ? 'selected' : ''}>غير فعال</option>
      </select>
      <div class="ops-admin-actions" style="margin-top:16px">
        <button type="button" class="ops-admin-btn" data-ops-close>إلغاء</button>
        <button type="button" class="ops-admin-btn primary" data-save-mod-edit>حفظ</button>
      </div>`);
    qs('[data-save-mod-edit]')?.addEventListener('click', () => {
      const res = window.HubOpsCatalog.updateModule(id, {
        name: qs('[data-f="name"]')?.value,
        description: qs('[data-f="description"]')?.value,
        canStandalone: !!qs('[data-f="canStandalone"]')?.checked,
        hideParentDefault: !!qs('[data-f="hideParentDefault"]')?.checked,
        requiresSiblingModules: !!qs('[data-f="requiresSiblingModules"]')?.checked,
        status: qs('[data-f="status"]')?.value,
      });
      if (!res.ok) return alert(res.error);
      closeModal();
      render();
    });
  };

  const onListClick = (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.editSys) return openEditSystem(t.dataset.editSys);
    if (t.dataset.addMod) return openAddModule(t.dataset.addMod);
    if (t.dataset.editMod) return openEditModule(t.dataset.editMod);
    if (t.dataset.toggleSys) {
      const sys = window.HubOpsCatalog.getSystem(t.dataset.toggleSys);
      window.HubOpsCatalog.setSystemStatus(t.dataset.toggleSys, sys.status === 'active' ? 'inactive' : 'active');
      render();
      return;
    }
    if (t.dataset.toggleMod) {
      const m = window.HubOpsCatalog.getModule(t.dataset.toggleMod);
      window.HubOpsCatalog.setModuleStatus(t.dataset.toggleMod, m.status === 'active' ? 'inactive' : 'active');
      render();
      return;
    }
    if (t.dataset.delSys) {
      let res = window.HubOpsCatalog.deleteSystem(t.dataset.delSys);
      if (!res.ok && res.needsConfirm) {
        if (confirm(`${res.error}\n\nهل تريد الحذف القسري؟`)) {
          res = window.HubOpsCatalog.deleteSystem(t.dataset.delSys, { force: true });
        } else return;
      }
      if (!res.ok) return alert(res.error);
      render();
      return;
    }
    if (t.dataset.delMod) {
      let res = window.HubOpsCatalog.deleteModule(t.dataset.delMod);
      if (!res.ok && res.needsConfirm) {
        if (confirm(`${res.error}\n\nهل تريد الحذف القسري؟`)) {
          res = window.HubOpsCatalog.deleteModule(t.dataset.delMod, { force: true });
        } else return;
      }
      if (!res.ok) return alert(res.error);
      render();
    }
  };

  const init = () => {
    if (!qs('[data-ops-admin-root]')) return;
    qs('[data-ops-add-sys]')?.addEventListener('click', openAddSystem);
    // bind once via delegation
    qs('[data-ops-admin-list]')?.addEventListener('click', onListClick);
    render();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
