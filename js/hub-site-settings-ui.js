/**
 * Site Settings Admin UI — dashboard.html#site-settings
 */
(function () {
  'use strict';

  const SECTIONS = [
    { id: 'stores', label: 'إعدادات المتجر', icon: 'fa-store' },
    { id: 'general', label: 'الإعدادات العامة', icon: 'fa-sliders' },
    { id: 'orders', label: 'إعدادات الطلبات', icon: 'fa-inbox' },
    { id: 'payment', label: 'إعدادات الدفع', icon: 'fa-credit-card' },
    { id: 'shipping', label: 'إعدادات الشحن', icon: 'fa-truck' },
    { id: 'ads', label: 'إعدادات الإعلانات', icon: 'fa-rectangle-ad' },
    { id: 'content', label: 'إعدادات المحتوى', icon: 'fa-newspaper' },
    { id: 'notifications', label: 'إعدادات الإشعارات', icon: 'fa-bell' },
    { id: 'integrations', label: 'إعدادات التكاملات', icon: 'fa-plug' },
    { id: 'security', label: 'إعدادات الأمان', icon: 'fa-shield-halved' },
    { id: 'seo', label: 'إعدادات SEO', icon: 'fa-magnifying-glass' },
    { id: 'searchEngines', label: 'إعدادات محركات البحث', icon: 'fa-globe' },
    { id: 'permissions', label: 'الصلاحيات', icon: 'fa-user-lock' },
    { id: 'audit', label: 'سجل التغييرات', icon: 'fa-clock-rotate-left' },
  ];

  const STORE_TABS = [
    { id: 'list', label: 'المتاجر' },
    { id: 'products-settings', label: 'إعدادات المنتجات' },
    { id: 'store-general', label: 'الإعدادات العامة' },
    { id: 'store-audit', label: 'سجل التغييرات' },
  ];

  const ui = {
    section: 'stores',
    storeTab: 'list',
    q: '',
    statusFilter: 'all',
    dirty: false,
    draft: null,
    modal: null,
    wizardStep: 0,
    wizard: null,
    drawerStoreId: null,
    productsStoreId: null,
    auditQ: '',
    auditSection: '',
    auditUser: '',
    toast: '',
    loading: false,
    error: '',
  };

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function actor() {
    try {
      const u = window.HubAuth?.getUser?.() || JSON.parse(localStorage.getItem('hubUser') || '{}');
      return u?.name || u?.email || 'Admin';
    } catch (_) {
      return 'Admin';
    }
  }

  function reg() {
    return window.HubStoresRegistry;
  }

  function ss() {
    return window.HubSiteSettings;
  }

  function fmt(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ar-EG');
    } catch (_) {
      return String(iso).slice(0, 19);
    }
  }

  function toast(msg) {
    ui.toast = msg;
    setTimeout(() => {
      if (ui.toast === msg) {
        ui.toast = '';
        paint();
      }
    }, 2800);
    paint();
  }

  function ensureDraft(section) {
    if (!ui.draft || ui.draft._section !== section) {
      const data = ss()?.getSection?.(section) || {};
      ui.draft = Object.assign({ _section: section }, JSON.parse(JSON.stringify(data)));
      ui.dirty = false;
    }
  }

  function markDirty() {
    ui.dirty = true;
  }

  function discardDraft() {
    ui.draft = null;
    ui.dirty = false;
    paint();
  }

  function saveDraft() {
    if (!ui.draft || !ui.draft._section) return;
    const section = ui.draft._section;
    const patch = Object.assign({}, ui.draft);
    delete patch._section;
    try {
      ss()?.updateSection?.(section, patch, actor());
      ui.dirty = false;
      ui.draft = null;
      toast('✓ تم حفظ الإعدادات بنجاح');
      paint();
    } catch (e) {
      ui.error = e.message || 'تعذر الحفظ';
      paint();
    }
  }

  function storeName(s) {
    return s?.nameAr || s?.name || s?.storeId || '—';
  }

  function storeUrl(s) {
    return s?.websiteUrl || s?.website_url || '';
  }

  function statusLabel(st) {
    if (st === 'disabled') return 'معطل';
    if (st === 'archived') return 'مؤرشف';
    return 'نشط';
  }

  /* ───────── Stores table ───────── */
  function filteredStores() {
    let list = reg()?.listAdmin?.() || reg()?.list?.({ includeDisabled: true, includeArchived: true }) || [];
    if (ui.statusFilter === 'active') list = list.filter((s) => (s.status || 'active') === 'active');
    if (ui.statusFilter === 'disabled') list = list.filter((s) => s.status === 'disabled');
    if (ui.statusFilter === 'archived') list = list.filter((s) => s.status === 'archived');
    if (ui.q) {
      const q = ui.q.toLowerCase();
      list = list.filter((s) =>
        `${storeName(s)} ${s.storeId} ${storeUrl(s)}`.toLowerCase().includes(q)
      );
    }
    return list;
  }

  function storeActionsHtml(s) {
    const id = esc(s.storeId);
    const st = s.status || 'active';
    const url = storeUrl(s);
    const open =
      url && /^https?:\/\//i.test(url)
        ? `<a class="btn btn-ghost btn-sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">فتح الموقع ↗</a>`
        : '';
    if (st === 'archived') {
      return `<button type="button" class="btn btn-dark btn-sm" data-ss-store-view="${id}">عرض</button>
        <button type="button" class="btn btn-primary btn-sm" data-ss-store-enable="${id}">تفعيل</button>
        <div class="ss-more-wrap"><button type="button" class="btn btn-ghost btn-sm" data-ss-more="${id}">⋮</button></div>`;
    }
    const toggle =
      st === 'disabled'
        ? `<button type="button" class="btn btn-primary btn-sm" data-ss-store-enable="${id}">تفعيل</button>`
        : `<button type="button" class="btn btn-ghost btn-sm" data-ss-store-disable="${id}">تعطيل</button>`;
    return `<button type="button" class="btn btn-dark btn-sm" data-ss-store-view="${id}">عرض</button>
      <button type="button" class="btn btn-ghost btn-sm" data-ss-store-edit="${id}">تعديل</button>
      ${toggle}
      ${open}
      <div class="ss-more-wrap">
        <button type="button" class="btn btn-ghost btn-sm" data-ss-more="${id}">⋮</button>
        <div class="ss-more-menu" hidden data-ss-menu="${id}">
          <button type="button" data-ss-store-products="${id}">إدارة المنتجات</button>
          <button type="button" data-ss-store-logo="${id}">تغيير الشعار</button>
          <button type="button" data-ss-store-archive="${id}">أرشفة</button>
          <button type="button" data-ss-store-delete="${id}">حذف</button>
        </div>
      </div>`;
  }

  function storesTableHtml() {
    const rows = filteredStores();
    if (!rows.length) {
      return `<div class="ss-empty">لا توجد متاجر مطابقة للبحث أو الفلتر.</div>`;
    }
    return `<div class="table-wrap"><table class="data-table ss-table">
      <thead><tr>
        <th>المتجر</th><th>Logo</th><th>URL</th><th>Status</th><th>Products</th>
        <th>Created By</th><th>Last Updated</th><th>Actions</th>
      </tr></thead>
      <tbody>${rows
        .map((s) => {
          const id = s.storeId;
          const url = storeUrl(s);
          const count = reg()?.productCount?.(id) ?? 0;
          const logo = s.logo
            ? `<img class="ss-logo" src="${esc(s.logo)}" alt="">`
            : `<i class="${esc(s.icon || 'fas fa-store')}"></i>`;
          return `<tr>
            <td><strong>${esc(storeName(s))}</strong><div class="ss-muted">${esc(id)}</div></td>
            <td>${logo}</td>
            <td>${
              url
                ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>`
                : '—'
            }</td>
            <td><span class="chip ss-status-${esc(s.status || 'active')}">${esc(statusLabel(s.status))}</span></td>
            <td>${count}</td>
            <td>${esc(s.createdBy || s.created_by || '—')}</td>
            <td>${esc((s.updatedAt || s.updated_at || s.createdAt || '').slice(0, 10) || '—')}</td>
            <td class="ss-actions">${storeActionsHtml(s)}</td>
          </tr>`;
        })
        .join('')}</tbody></table></div>`;
  }

  function toggleField(key, label, desc, on) {
    return `<label class="ss-toggle-row">
      <span><b>${esc(label)}</b>${desc ? `<small>${esc(desc)}</small>` : ''}</span>
      <select data-draft="${esc(key)}">
        <option value="true" ${on ? 'selected' : ''}>On</option>
        <option value="false" ${!on ? 'selected' : ''}>Off</option>
      </select>
    </label>`;
  }

  function textField(key, label, desc, value, opts = {}) {
    const type = opts.type || 'text';
    const ro = opts.readonly ? 'readonly' : '';
    return `<label class="ss-field">
      <span>${esc(label)}${desc ? `<small>${esc(desc)}</small>` : ''}</span>
      ${
        type === 'textarea'
          ? `<textarea data-draft="${esc(key)}" rows="${opts.rows || 3}" ${ro}>${esc(value || '')}</textarea>`
          : `<input type="${esc(type)}" data-draft="${esc(key)}" value="${esc(value || '')}" ${ro} ${opts.required ? 'required' : ''} />`
      }
    </label>`;
  }

  function sectionFormHtml(section, fields) {
    ensureDraft(section);
    const d = ui.draft;
    return `<div class="ss-card">
      <div class="ss-fields">${fields
        .map((f) => {
          if (f.type === 'toggle') return toggleField(f.key, f.label, f.desc, !!d[f.key]);
          return textField(f.key, f.label, f.desc, d[f.key], f);
        })
        .join('')}</div>
    </div>`;
  }

  function storeModuleForm(tab) {
    ensureDraft('storeModule');
    const d = ui.draft;
    if (tab === 'products-settings') {
      const p = d.products || {};
      return `<div class="ss-card">
        <h3>إعدادات المنتجات</h3>
        <p class="ss-lead">العملة الافتراضية ثابتة USD لوحدة المتجر.</p>
        <div class="ss-fields">
          <label class="ss-field"><span>Default Currency</span><input value="USD" readonly /></label>
          ${toggleField('products.requireProductUrl', 'Require Product URL', '', p.requireProductUrl !== false)}
          ${toggleField('products.requireAdminApproval', 'Require Admin Approval', '', p.requireAdminApproval !== false)}
          ${toggleField('products.allowExternalStores', 'Allow External Stores', '', p.allowExternalStores !== false)}
          ${toggleField('products.allowCustomerAddProduct', 'Allow Customer To Add Product', '', p.allowCustomerAddProduct !== false)}
          ${toggleField('products.allowCustomerSuggestStore', 'Allow Customer To Suggest New Store', '', p.allowCustomerSuggestStore !== false)}
          ${toggleField('products.openExternalLinksInNewTab', 'Open External Links In New Tab', '', p.openExternalLinksInNewTab !== false)}
        </div>
      </div>`;
    }
    const g = d.general || {};
    return `<div class="ss-card">
      <h3>الإعدادات العامة للمتجر</h3>
      <div class="ss-fields">
        <label class="ss-field"><span>Store Status</span>
          <select data-draft="general.storeStatus">
            <option value="enabled" ${g.storeStatus !== 'disabled' ? 'selected' : ''}>Enabled</option>
            <option value="disabled" ${g.storeStatus === 'disabled' ? 'selected' : ''}>Disabled</option>
          </select>
        </label>
        <label class="ss-field"><span>Products Per Page</span>
          <select data-draft="general.productsPerPage">
            ${[12, 24, 48]
              .map((n) => `<option value="${n}" ${Number(g.productsPerPage) === n ? 'selected' : ''}>${n}</option>`)
              .join('')}
          </select>
        </label>
        <label class="ss-field"><span>Default View</span>
          <select data-draft="general.defaultView">
            <option value="grid" ${g.defaultView !== 'list' ? 'selected' : ''}>Grid</option>
            <option value="list" ${g.defaultView === 'list' ? 'selected' : ''}>List</option>
          </select>
        </label>
        <label class="ss-field"><span>Currency Display</span><input value="USD ($)" readonly /></label>
        ${toggleField('general.showStoreLogo', 'Show Store Logo', '', g.showStoreLogo !== false)}
        ${toggleField('general.showStoreName', 'Show Store Name', '', g.showStoreName !== false)}
        ${toggleField('general.showProductSource', 'Show Product Source', '', g.showProductSource !== false)}
        ${toggleField('general.showProductPrice', 'Show Product Price', '', g.showProductPrice !== false)}
        ${toggleField('general.enableSearch', 'Enable Search', '', g.enableSearch !== false)}
        ${toggleField('general.enableFilters', 'Enable Filters', '', g.enableFilters !== false)}
        ${toggleField('general.enableReviews', 'Enable Reviews', '', !!g.enableReviews)}
        ${toggleField('general.enableProductSharing', 'Enable Product Sharing', '', g.enableProductSharing !== false)}
      </div>
    </div>`;
  }

  function auditTableHtml(filterSection) {
    const rows =
      ss()?.listAudit?.({
        section: filterSection || ui.auditSection || undefined,
        q: ui.auditQ || undefined,
        user: ui.auditUser || undefined,
      }) || [];
    if (!rows.length) return `<div class="ss-empty">لا توجد سجلات بعد.</div>`;
    return `<div class="table-wrap"><table class="data-table ss-table">
      <thead><tr>
        <th>Transaction ID</th><th>Section</th><th>Action</th><th>Old Value</th><th>New Value</th>
        <th>Changed By</th><th>Role</th><th>Date</th><th>Time</th>
      </tr></thead>
      <tbody>${rows
        .slice(0, 100)
        .map((r) => {
          const d = r.at ? new Date(r.at) : null;
          return `<tr>
            <td><code>${esc(r.id)}</code></td>
            <td>${esc(r.section)}${r.storeId ? `<div class="ss-muted">${esc(r.storeId)}</div>` : ''}</td>
            <td>${esc(r.action)}</td>
            <td class="ss-clip">${esc(r.oldValue || '—')}</td>
            <td class="ss-clip">${esc(r.newValue || '—')}</td>
            <td>${esc(r.changedBy)}</td>
            <td>${esc(r.role || '—')}</td>
            <td>${d ? d.toLocaleDateString('ar-EG') : '—'}</td>
            <td>${d ? d.toLocaleTimeString('ar-EG') : '—'}</td>
          </tr>`;
        })
        .join('')}</tbody></table></div>`;
  }

  function productsPanelHtml(storeId) {
    const s = reg()?.get?.(storeId);
    if (!s) return `<div class="ss-empty">المتجر غير موجود</div>`;
    const stats = reg()?.productStats?.(storeId) || { total: 0, active: 0, pending: 0, rejected: 0, paused: 0, submissions: [] };
    return `<div class="ss-card">
      <div class="ss-panel-head">
        <div>
          <h3>منتجات ${esc(storeName(s))}</h3>
          <p class="ss-muted">${esc(storeId)}</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-ss-close-products>إغلاق</button>
      </div>
      <div class="ss-kpis">
        <div><b>${stats.total}</b><span>إجمالي</span></div>
        <div><b>${stats.active}</b><span>نشطة</span></div>
        <div><b>${stats.pending}</b><span>بانتظار المراجعة</span></div>
        <div><b>${stats.rejected}</b><span>مرفوضة</span></div>
        <div><b>${stats.paused}</b><span>موقوفة</span></div>
      </div>
      <div class="table-wrap"><table class="data-table ss-table">
        <thead><tr><th>ID</th><th>المنتج</th><th>السعر</th><th>الحالة</th><th>تاريخ</th></tr></thead>
        <tbody>${
          (stats.submissions || [])
            .map(
              (p) => `<tr>
            <td><code>${esc(p.id)}</code></td>
            <td>${esc(p.title || '—')}</td>
            <td>${esc(p.priceUsd || 0)} USD</td>
            <td>${esc(p.status || '—')}</td>
            <td>${esc((p.createdAt || '').slice(0, 10))}</td>
          </tr>`
            )
            .join('') || '<tr><td colspan="5">لا منتجات مرتبطة بهذا المتجر بعد.</td></tr>'
        }</tbody>
      </table></div>
    </div>`;
  }

  function storesSectionHtml() {
    if (ui.productsStoreId) return productsPanelHtml(ui.productsStoreId);
    const tabs = STORE_TABS.map(
      (t) =>
        `<button type="button" class="ss-subtab ${ui.storeTab === t.id ? 'is-on' : ''}" data-ss-store-tab="${t.id}">${esc(t.label)}</button>`
    ).join('');
    let body = '';
    if (ui.storeTab === 'list') {
      body = `
        <div class="ss-toolbar">
          <button type="button" class="btn btn-primary" data-ss-add-store>+ إضافة متجر جديد</button>
          <input type="search" placeholder="بحث عن متجر..." value="${esc(ui.q)}" data-ss-store-q />
          <select data-ss-store-status>
            <option value="all" ${ui.statusFilter === 'all' ? 'selected' : ''}>كل الحالات</option>
            <option value="active" ${ui.statusFilter === 'active' ? 'selected' : ''}>نشط</option>
            <option value="disabled" ${ui.statusFilter === 'disabled' ? 'selected' : ''}>معطل</option>
            <option value="archived" ${ui.statusFilter === 'archived' ? 'selected' : ''}>مؤرشف</option>
          </select>
        </div>
        ${storesTableHtml()}`;
    } else if (ui.storeTab === 'store-audit') {
      body = auditTableHtml('stores');
    } else {
      body = storeModuleForm(ui.storeTab);
    }
    return `<div class="ss-card">
      <h2>إعدادات المتجر</h2>
      <p class="ss-lead">إدارة المتاجر المتاحة للعملاء، الاسم، الشعار، الرابط، الحالة، عدد المنتجات والإجراءات.</p>
      <div class="ss-subtabs">${tabs}</div>
      ${body}
    </div>`;
  }

  function sectionBodyHtml() {
    const id = ui.section;
    if (id === 'stores') return storesSectionHtml();
    if (id === 'audit') {
      return `<div class="ss-card">
        <h2>سجل تغييرات إعدادات الموقع</h2>
        <div class="ss-toolbar">
          <input type="search" placeholder="بحث..." value="${esc(ui.auditQ)}" data-ss-audit-q />
          <select data-ss-audit-section>
            <option value="">كل الأقسام</option>
            ${SECTIONS.map((s) => `<option value="${s.id}" ${ui.auditSection === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
          </select>
          <input type="search" placeholder="المستخدم..." value="${esc(ui.auditUser)}" data-ss-audit-user />
        </div>
        ${auditTableHtml()}
      </div>`;
    }
    if (id === 'general') {
      return (
        `<div class="ss-card"><h2>الإعدادات العامة</h2><p class="ss-lead">هوية المنصة والدعم ووضع الصيانة.</p></div>` +
        sectionFormHtml('general', [
          { key: 'platformName', label: 'اسم المنصة', desc: 'يظهر في العناوين والهوية' },
          { key: 'siteLogo', label: 'Site Logo', desc: 'رابط أو data URL للشعار' },
          { key: 'favicon', label: 'Favicon', desc: 'أيقونة المتصفح' },
          { key: 'language', label: 'اللغة الافتراضية', desc: 'ar / en' },
          { key: 'timezone', label: 'Timezone', desc: 'مثال Asia/Riyadh' },
          { key: 'dateFormat', label: 'Date Format', desc: 'YYYY-MM-DD' },
          { key: 'supportEmail', label: 'Support Email', type: 'email' },
          { key: 'supportPhone', label: 'Support Phone' },
          { key: 'maintenanceMode', label: 'Maintenance Mode', type: 'toggle', desc: 'يعرض تنبيه صيانة' },
        ])
      );
    }
    if (id === 'orders') {
      return (
        `<div class="ss-card"><h2>إعدادات الطلبات</h2><p class="ss-lead">ترتبط مباشرة بـ عملاء هوب ← طلبات العملاء.</p></div>` +
        sectionFormHtml('orders', [
          { key: 'requestIdFormat', label: 'Request ID Format', desc: 'مثال YYYY-#####' },
          { key: 'requireAdminApproval', label: 'Require Admin Approval', type: 'toggle' },
          { key: 'defaultRequestStatus', label: 'Default Request Status' },
          { key: 'autoAssignment', label: 'Auto Assignment', type: 'toggle' },
          { key: 'defaultDepartment', label: 'Default Department' },
          { key: 'slaHours', label: 'SLA (ساعات)', type: 'number' },
          { key: 'requestNotifications', label: 'Request Notifications', type: 'toggle' },
          { key: 'customerRequestRouting', label: 'Customer Request Routing', type: 'toggle' },
        ])
      );
    }
    if (id === 'payment') {
      return (
        `<div class="ss-card"><h2>إعدادات الدفع</h2></div>` +
        sectionFormHtml('payment', [
          { key: 'defaultCurrency', label: 'Default Currency', desc: 'USD' },
          { key: 'paymentMethods', label: 'Payment Methods' },
          { key: 'taxEnabled', label: 'Tax Settings', type: 'toggle' },
          { key: 'taxRate', label: 'Tax Rate %', type: 'number' },
          { key: 'invoicePrefix', label: 'Invoice Settings (prefix)' },
          { key: 'refundWindowDays', label: 'Refund Rules (days)', type: 'number' },
          { key: 'paymentNotifications', label: 'Payment Notifications', type: 'toggle' },
          { key: 'statusRules', label: 'Payment Status Rules' },
        ])
      );
    }
    if (id === 'shipping') {
      return (
        `<div class="ss-card"><h2>إعدادات الشحن</h2></div>` +
        sectionFormHtml('shipping', [
          { key: 'enableShipping', label: 'Enable Shipping', type: 'toggle' },
          { key: 'methods', label: 'Shipping Methods' },
          { key: 'regions', label: 'Shipping Regions' },
          { key: 'fees', label: 'Shipping Fees' },
          { key: 'freeShippingMin', label: 'Free Shipping Rules (min USD)', type: 'number' },
          { key: 'estimatedDelivery', label: 'Estimated Delivery Time' },
          { key: 'trackingEnabled', label: 'Tracking Settings', type: 'toggle' },
        ])
      );
    }
    if (id === 'ads') {
      return (
        `<div class="ss-card"><h2>إعدادات الإعلانات</h2><p class="ss-lead">ترتبط بمسار طلبات نشر الإعلانات ← مراجعة ← قبول/رفض ← نشر.</p></div>` +
        sectionFormHtml('ads', [
          { key: 'enableAdvertisements', label: 'Enable Advertisements', type: 'toggle' },
          { key: 'requireAdminApproval', label: 'Require Admin Approval', type: 'toggle' },
          { key: 'allowedTypes', label: 'Allowed Ad Types', desc: 'image,video,text,file' },
          { key: 'maxImageMb', label: 'Maximum Image Size (MB)', type: 'number' },
          { key: 'maxVideoMb', label: 'Maximum Video Size (MB)', type: 'number' },
          { key: 'maxFileMb', label: 'Maximum File Size (MB)', type: 'number' },
          { key: 'defaultDurationDays', label: 'Default Ad Duration (days)', type: 'number' },
          { key: 'placements', label: 'Ad Placements' },
          { key: 'ctaTypes', label: 'CTA Types' },
          { key: 'autoExpiration', label: 'Auto Expiration', type: 'toggle' },
        ])
      );
    }
    if (id === 'content') {
      return (
        `<div class="ss-card"><h2>إعدادات المحتوى</h2><p class="ss-lead">مسار المقالات الحالي.</p></div>` +
        sectionFormHtml('content', [
          { key: 'enableArticles', label: 'Enable Articles', type: 'toggle' },
          { key: 'requireArticleApproval', label: 'Require Article Approval', type: 'toggle' },
          { key: 'categories', label: 'Article Categories' },
          { key: 'allowedUploadTypes', label: 'Allowed Upload Types' },
          { key: 'maxImageMb', label: 'Maximum Image Size (MB)', type: 'number' },
          { key: 'maxAttachmentMb', label: 'Maximum Attachment Size (MB)', type: 'number' },
          { key: 'publishingWorkflow', label: 'Publishing Workflow' },
          { key: 'moderationEnabled', label: 'Moderation Settings', type: 'toggle' },
        ])
      );
    }
    if (id === 'notifications') {
      ensureDraft('notifications');
      const d = ui.draft;
      const t = d.templates || {};
      return `<div class="ss-card"><h2>إعدادات الإشعارات</h2>
        <div class="ss-fields">
          ${toggleField('inApp', 'In-App Notifications', '', d.inApp !== false)}
          ${toggleField('email', 'Email Notifications', '', d.email !== false)}
          ${toggleField('sms', 'SMS Notifications', '', !!d.sms)}
          ${toggleField('push', 'Push Notifications', '', !!d.push)}
          <h4>Notification Templates</h4>
          ${textField('templates.newRequest', 'New Request', '', t.newRequest)}
          ${textField('templates.requestApproved', 'Request Approved', '', t.requestApproved)}
          ${textField('templates.requestRejected', 'Request Rejected', '', t.requestRejected)}
          ${textField('templates.articleApproved', 'Article Approved', '', t.articleApproved)}
          ${textField('templates.adApproved', 'Advertisement Approved', '', t.adApproved)}
          ${textField('templates.productApproved', 'Product Approved', '', t.productApproved)}
        </div></div>`;
    }
    if (id === 'integrations') {
      return (
        `<div class="ss-card"><h2>إعدادات التكاملات</h2></div>` +
        sectionFormHtml('integrations', [
          { key: 'apisEnabled', label: 'APIs', type: 'toggle' },
          { key: 'webhooksEnabled', label: 'Webhooks', type: 'toggle' },
          { key: 'externalSystems', label: 'External Systems', type: 'textarea' },
          { key: 'connectionStatus', label: 'Connection Status' },
          { key: 'lastSync', label: 'Last Sync' },
          { key: 'syncIntervalMin', label: 'Sync Settings (minutes)', type: 'number' },
        ])
      );
    }
    if (id === 'security') {
      return (
        `<div class="ss-card"><h2>إعدادات الأمان</h2></div>` +
        sectionFormHtml('security', [
          { key: 'sessionTimeoutMin', label: 'Session Timeout (min)', type: 'number' },
          { key: 'passwordMinLength', label: 'Password Policy (min length)', type: 'number' },
          { key: 'mfaRequired', label: 'MFA', type: 'toggle' },
          { key: 'maxLoginAttempts', label: 'Login Attempts', type: 'number' },
          { key: 'lockoutMinutes', label: 'Account Lockout (min)', type: 'number' },
          { key: 'ipRestrictions', label: 'IP Restrictions', type: 'textarea' },
          { key: 'auditLogging', label: 'Audit Logging', type: 'toggle' },
        ])
      );
    }
    if (id === 'seo') {
      return (
        `<div class="ss-card"><h2>إعدادات SEO</h2></div>` +
        sectionFormHtml('seo', [
          { key: 'siteTitle', label: 'Site Title' },
          { key: 'metaDescription', label: 'Meta Description', type: 'textarea' },
          { key: 'keywords', label: 'Keywords' },
          { key: 'openGraphImage', label: 'Open Graph' },
          { key: 'canonicalBase', label: 'Canonical URLs (base)' },
          { key: 'indexingEnabled', label: 'Search Engine Indexing', type: 'toggle' },
          { key: 'sitemapEnabled', label: 'Sitemap', type: 'toggle' },
          { key: 'robots', label: 'Robots Settings' },
        ])
      );
    }
    if (id === 'searchEngines') {
      ensureDraft('searchEngines');
      const g = ui.draft.google || {};
      return `<div class="ss-card">
        <h2>إعدادات محركات البحث</h2>
        <p class="ss-lead">Google Search عبر Programmable Search Engine — ضع Search Engine ID (cx) هنا فقط، لا تكرّره في ملفات أخرى.</p>
        <h3 style="margin:14px 0 8px">Google Search</h3>
        <div class="ss-fields">
          ${toggleField('google.enabled', 'الحالة: فعال', 'عند التعطيل يختفي كارت Google من الرئيسية', g.enabled !== false)}
          <label class="ss-field"><span>Search Engine ID (cx)<small>من Google Programmable Search</small></span>
            <input data-draft="google.cx" value="${esc(g.cx || '')}" placeholder="a1b2c3d4e5f6g7h8i" dir="ltr" />
          </label>
          <label class="ss-field"><span>عنوان الكارت</span>
            <input data-draft="google.cardTitle" value="${esc(g.cardTitle || 'محرك بحث Google')}" />
          </label>
          <label class="ss-field"><span>الوصف</span>
            <input data-draft="google.cardDescription" value="${esc(g.cardDescription || 'ابحث على الويب باستخدام Google')}" />
          </label>
          <label class="ss-field"><span>طريقة عرض النتائج</span>
            <select data-draft="google.resultsMode">
              <option value="standalone" ${g.resultsMode !== 'embedded' ? 'selected' : ''}>صفحة مستقلة داخل الموقع (google-search.html)</option>
              <option value="embedded" ${g.resultsMode === 'embedded' ? 'selected' : ''}>داخل صفحة NAIOSH HUB</option>
            </select>
          </label>
          ${toggleField('google.openLinksInNewTab', 'فتح الروابط الخارجية في تبويب جديد', '', g.openLinksInNewTab !== false)}
        </div>
        <p class="ss-lead" style="margin-top:12px">محرك بحث نايوش يبقى مستقلًا للبحث داخل المنظومة عبر search.html.</p>
      </div>`;
    }
    if (id === 'permissions') {
      ensureDraft('permissions');
      const d = ui.draft;
      const keys = [
        ['viewSiteSettings', 'View Site Settings'],
        ['manageSiteSettings', 'Manage Site Settings'],
        ['manageStores', 'Manage Stores'],
        ['createStore', 'Create Store'],
        ['editStore', 'Edit Store'],
        ['disableStore', 'Disable Store'],
        ['archiveStore', 'Archive Store'],
        ['managePaymentSettings', 'Manage Payment Settings'],
        ['manageSecuritySettings', 'Manage Security Settings'],
        ['manageIntegrations', 'Manage Integrations'],
      ];
      return `<div class="ss-card"><h2>الصلاحيات</h2><p class="ss-lead">تحكم في من يستطيع تعديل الإعدادات الحساسة.</p>
        <div class="ss-fields">${keys.map(([k, l]) => toggleField(k, l, '', d[k] !== false)).join('')}</div></div>`;
    }
    return `<div class="ss-empty">قسم غير معروف</div>`;
  }

  function stickyBarHtml() {
    if (!ui.dirty) return '';
    return `<div class="ss-sticky">
      <span>لديك تغييرات غير محفوظة</span>
      <div>
        <button type="button" class="btn btn-ghost" data-ss-discard>إلغاء التغييرات</button>
        <button type="button" class="btn btn-primary" data-ss-save>حفظ التغييرات</button>
      </div>
    </div>`;
  }

  function modalHtml() {
    if (!ui.modal) return '';
    const m = ui.modal;
    if (m.type === 'view') {
      const s = reg()?.get?.(m.storeId);
      if (!s) return '';
      const url = storeUrl(s);
      return `<div class="ss-overlay" data-ss-close-modal>
        <div class="ss-modal" role="dialog">${''}
          <h3>عرض المتجر</h3>
          <ul class="ss-dl">
            <li><b>الاسم:</b> ${esc(storeName(s))}</li>
            <li><b>Store ID:</b> <code>${esc(s.storeId)}</code></li>
            <li><b>Logo:</b> ${s.logo ? `<img class="ss-logo" src="${esc(s.logo)}" alt="">` : '—'}</li>
            <li><b>URL:</b> ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>` : '—'}</li>
            <li><b>Status:</b> ${esc(statusLabel(s.status))}</li>
            <li><b>Products:</b> ${reg()?.productCount?.(s.storeId) || 0}</li>
            <li><b>Created By:</b> ${esc(s.createdBy || '—')}</li>
            <li><b>Created At:</b> ${fmt(s.createdAt)}</li>
            <li><b>Last Updated:</b> ${fmt(s.updatedAt || s.createdAt)}</li>
          </ul>
          <div class="ss-modal-actions">
            ${url ? `<a class="btn btn-dark" href="${esc(url)}" target="_blank" rel="noopener noreferrer">فتح الموقع</a>` : ''}
            <button type="button" class="btn btn-ghost" data-ss-store-products="${esc(s.storeId)}">عرض المنتجات</button>
            <button type="button" class="btn btn-primary" data-ss-store-edit="${esc(s.storeId)}">تعديل</button>
            <button type="button" class="btn btn-ghost" data-ss-close-modal>إغلاق</button>
          </div>
        </div>
      </div>`;
    }
    if (m.type === 'edit') {
      const s = reg()?.get?.(m.storeId) || {};
      return `<div class="ss-overlay" data-ss-close-modal>
        <div class="ss-modal ss-modal-lg" role="dialog" onclick="event.stopPropagation()">
          <h3>تعديل المتجر</h3>
          <div class="ss-fields">
            <label class="ss-field"><span>اسم المتجر *</span><input id="ss-edit-name" value="${esc(storeName(s))}" required /></label>
            <label class="ss-field"><span>Store ID</span><input value="${esc(s.storeId || '')}" readonly /></label>
            <label class="ss-field"><span>Official Website URL *</span><input id="ss-edit-url" value="${esc(storeUrl(s))}" required /></label>
            <label class="ss-field"><span>Logo (URL / data)</span><input id="ss-edit-logo" value="${esc(s.logo || '')}" /></label>
            <label class="ss-field"><span>الوصف</span><textarea id="ss-edit-desc" rows="3">${esc(s.description || '')}</textarea></label>
            <label class="ss-field"><span>الحالة</span>
              <select id="ss-edit-status">
                <option value="active" ${(s.status || 'active') === 'active' ? 'selected' : ''}>Active</option>
                <option value="disabled" ${s.status === 'disabled' ? 'selected' : ''}>Disabled</option>
              </select>
            </label>
            <label class="ss-field"><span>Default Currency</span><input value="USD" readonly /></label>
            <label class="ss-field"><span>Require Product URL</span>
              <select id="ss-edit-requrl">
                <option value="on" ${s.requiresProductUrl !== false ? 'selected' : ''}>On</option>
                <option value="off" ${s.requiresProductUrl === false ? 'selected' : ''}>Off</option>
              </select>
            </label>
            <label class="ss-field"><span>Open Store In New Tab</span>
              <select id="ss-edit-newtab">
                <option value="on" ${s.openInNewTab !== false ? 'selected' : ''}>On</option>
                <option value="off" ${s.openInNewTab === false ? 'selected' : ''}>Off</option>
              </select>
            </label>
          </div>
          <div class="ss-modal-actions">
            <button type="button" class="btn btn-ghost" data-ss-close-modal>إلغاء</button>
            <button type="button" class="btn btn-primary" data-ss-save-edit="${esc(s.storeId)}">حفظ التغييرات</button>
          </div>
        </div>
      </div>`;
    }
    if (m.type === 'confirm') {
      return `<div class="ss-overlay" data-ss-close-modal>
        <div class="ss-modal" role="dialog" onclick="event.stopPropagation()">
          <h3>${esc(m.title)}</h3>
          <p>${esc(m.message)}</p>
          <div class="ss-modal-actions">
            <button type="button" class="btn btn-ghost" data-ss-close-modal>إلغاء</button>
            <button type="button" class="btn ${m.danger ? 'btn-danger' : 'btn-primary'}" data-ss-confirm-ok>${esc(m.okLabel || 'تأكيد')}</button>
          </div>
        </div>
      </div>`;
    }
    if (m.type === 'wizard') return wizardHtml();
    return '';
  }

  function wizardHtml() {
    const w = ui.wizard || {};
    const step = ui.wizardStep || 0;
    const steps = ['معلومات المتجر', 'رابط المتجر', 'شعار المتجر', 'إعدادات المتجر', 'مراجعة'];
    let body = '';
    if (step === 0) {
      body = `<div class="ss-fields">
        <label class="ss-field"><span>اسم المتجر *</span><input id="ss-w-name" value="${esc(w.name || '')}" placeholder="Amazon" /></label>
        <label class="ss-field"><span>Store Code *</span><input id="ss-w-code" value="${esc(w.storeCode || '')}" placeholder="AMAZON" /></label>
        <p class="ss-muted">Store ID سيكون: STORE-${esc((w.storeCode || 'CODE').toUpperCase())}</p>
        <label class="ss-field"><span>الوصف</span><textarea id="ss-w-desc" rows="3">${esc(w.description || '')}</textarea></label>
      </div>`;
    } else if (step === 1) {
      body = `<div class="ss-fields">
        <label class="ss-field"><span>Official Website URL *</span><input id="ss-w-url" value="${esc(w.websiteUrl || '')}" placeholder="https://www.amazon.com" /></label>
        <button type="button" class="btn btn-ghost" data-ss-test-url>اختبار الرابط</button>
        <p class="ss-muted" id="ss-w-url-msg"></p>
      </div>`;
    } else if (step === 2) {
      body = `<div class="ss-fields">
        <label class="ss-field"><span>Logo *</span>
          <input type="file" id="ss-w-logo-file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
        </label>
        ${w.logo ? `<img class="ss-logo-lg" src="${esc(w.logo)}" alt="preview">` : '<p class="ss-muted">ارفع شعاراً (PNG / JPG / WEBP / SVG)</p>'}
        <input type="hidden" id="ss-w-logo" value="${esc(w.logo || '')}" />
      </div>`;
    } else if (step === 3) {
      body = `<div class="ss-fields">
        <label class="ss-field"><span>Status</span>
          <select id="ss-w-status"><option value="active">Active</option><option value="disabled">Disabled</option></select>
        </label>
        <label class="ss-field"><span>Default Currency</span><input value="USD" readonly /></label>
        <label class="ss-field"><span>Require Product URL</span>
          <select id="ss-w-requrl"><option value="on">On</option><option value="off">Off</option></select>
        </label>
        <label class="ss-field"><span>Open External Store In New Tab</span>
          <select id="ss-w-newtab"><option value="on">On</option></select>
        </label>
        <label class="ss-field"><span>Allow Customers To Use Store</span>
          <select id="ss-w-allow"><option value="on">On</option><option value="off">Off</option></select>
        </label>
      </div>`;
    } else {
      body = `<ul class="ss-dl">
        <li><b>Logo:</b> ${w.logo ? `<img class="ss-logo" src="${esc(w.logo)}" alt="">` : '—'}</li>
        <li><b>Store Name:</b> ${esc(w.name || '—')}</li>
        <li><b>Store ID:</b> STORE-${esc((w.storeCode || '').toUpperCase())}</li>
        <li><b>URL:</b> ${esc(w.websiteUrl || '—')}</li>
        <li><b>Status:</b> ${esc(w.status || 'active')}</li>
        <li><b>Currency:</b> USD</li>
        <li><b>Product URL:</b> ${w.requiresProductUrl === false ? 'Off' : 'On'}</li>
      </ul>`;
    }
    return `<div class="ss-overlay">
      <div class="ss-modal ss-modal-lg" role="dialog" onclick="event.stopPropagation()">
        <h3>إضافة متجر جديد</h3>
        <div class="ss-wizard-steps">${steps
          .map((l, i) => `<span class="${i === step ? 'is-on' : i < step ? 'is-done' : ''}">${i + 1}. ${esc(l)}</span>`)
          .join('')}</div>
        ${body}
        <div class="ss-modal-actions">
          <button type="button" class="btn btn-ghost" data-ss-close-modal>إلغاء</button>
          ${step > 0 ? `<button type="button" class="btn btn-ghost" data-ss-wiz-prev>السابق</button>` : ''}
          ${
            step < 4
              ? `<button type="button" class="btn btn-primary" data-ss-wiz-next>التالي</button>`
              : `<button type="button" class="btn btn-primary" data-ss-wiz-save>حفظ المتجر</button>`
          }
        </div>
      </div>
    </div>`;
  }

  function renderShell() {
    if (!ss() || !reg()) {
      return `<div class="ss-empty ss-error">تعذر تحميل وحدات الإعدادات أو سجل المتاجر. أعد تحميل الصفحة.</div>`;
    }
    if (!ss().can('viewSiteSettings')) {
      return `<div class="ss-empty ss-error">ليست لديك صلاحية عرض إعدادات الموقع.</div>`;
    }
    const nav = SECTIONS.map(
      (s) =>
        `<button type="button" class="ss-nav-item ${ui.section === s.id ? 'is-on' : ''}" data-ss-section="${s.id}">
          <i class="fas ${s.icon}"></i> ${esc(s.label)}
        </button>`
    ).join('');
    return `
      <div class="ss-page" id="site-settings-root">
        <header class="ss-head">
          <div>
            <h1>إعدادات الموقع</h1>
            <p>إدارة إعدادات المنصة والمتاجر والطلبات والدفع والإعلانات والتكاملات والأمان من مكان واحد.</p>
          </div>
        </header>
        ${ui.toast ? `<div class="ss-toast">${esc(ui.toast)}</div>` : ''}
        ${ui.error ? `<div class="ss-error-banner">${esc(ui.error)}</div>` : ''}
        <div class="ss-layout">
          <aside class="ss-nav" id="ss-nav">${nav}</aside>
          <label class="ss-nav-mobile">
            <span>القسم</span>
            <select data-ss-section-select>
              ${SECTIONS.map((s) => `<option value="${s.id}" ${ui.section === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
            </select>
          </label>
          <main class="ss-main">${sectionBodyHtml()}</main>
        </div>
        ${stickyBarHtml()}
        ${modalHtml()}
      </div>`;
  }

  let hostEl = null;

  function paint() {
    if (!hostEl) return;
    hostEl.innerHTML = renderShell();
    bind(hostEl);
  }

  function setNestedDraft(path, value) {
    if (!ui.draft) return;
    const parts = path.split('.');
    let cur = ui.draft;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    const last = parts[parts.length - 1];
    const numericKeys = new Set([
      'slaHours',
      'taxRate',
      'refundWindowDays',
      'maxImageMb',
      'maxVideoMb',
      'maxFileMb',
      'defaultDurationDays',
      'maxAttachmentMb',
      'sessionTimeoutMin',
      'passwordMinLength',
      'maxLoginAttempts',
      'lockoutMinutes',
      'syncIntervalMin',
      'freeShippingMin',
      'productsPerPage',
    ]);
    if (value === 'true') cur[last] = true;
    else if (value === 'false') cur[last] = false;
    else if (numericKeys.has(last) && value !== '') cur[last] = Number(value);
    else cur[last] = value;
    markDirty();
  }

  function readWizardFields() {
    const w = ui.wizard || (ui.wizard = {});
    const name = document.getElementById('ss-w-name');
    const code = document.getElementById('ss-w-code');
    const desc = document.getElementById('ss-w-desc');
    const url = document.getElementById('ss-w-url');
    const logo = document.getElementById('ss-w-logo');
    const status = document.getElementById('ss-w-status');
    const req = document.getElementById('ss-w-requrl');
    const allow = document.getElementById('ss-w-allow');
    if (name) w.name = name.value.trim();
    if (code) w.storeCode = code.value.trim().toUpperCase();
    if (desc) w.description = desc.value.trim();
    if (url) w.websiteUrl = url.value.trim();
    if (logo) w.logo = logo.value;
    if (status) w.status = status.value;
    if (req) w.requiresProductUrl = req.value !== 'off';
    if (allow) w.allowCustomers = allow.value !== 'off';
    w.openInNewTab = true;
    w.defaultCurrency = 'USD';
  }

  function bind(root) {
    root.querySelectorAll('[data-ss-section]').forEach((btn) => {
      btn.onclick = () => {
        if (ui.dirty && !confirm('لديك تغييرات غير محفوظة. المتابعة بدون حفظ؟')) return;
        ui.section = btn.getAttribute('data-ss-section');
        ui.draft = null;
        ui.dirty = false;
        ui.productsStoreId = null;
        ui.error = '';
        paint();
      };
    });
    root.querySelector('[data-ss-section-select]')?.addEventListener('change', (e) => {
      if (ui.dirty && !confirm('لديك تغييرات غير محفوظة. المتابعة بدون حفظ؟')) {
        e.target.value = ui.section;
        return;
      }
      ui.section = e.target.value;
      ui.draft = null;
      ui.dirty = false;
      paint();
    });
    root.querySelectorAll('[data-ss-store-tab]').forEach((btn) => {
      btn.onclick = () => {
        if (ui.dirty && ui.storeTab !== 'list' && !confirm('تغييرات غير محفوظة؟')) return;
        ui.storeTab = btn.getAttribute('data-ss-store-tab');
        if (ui.storeTab === 'list' || ui.storeTab === 'store-audit') {
          ui.draft = null;
          ui.dirty = false;
        }
        paint();
      };
    });
    root.querySelector('[data-ss-store-q]')?.addEventListener('input', (e) => {
      ui.q = e.target.value;
      clearTimeout(ui._qTimer);
      ui._qTimer = setTimeout(() => paint(), 200);
    });
    root.querySelector('[data-ss-store-status]')?.addEventListener('change', (e) => {
      ui.statusFilter = e.target.value;
      paint();
    });
    root.querySelectorAll('[data-draft]').forEach((el) => {
      el.addEventListener('change', () => {
        setNestedDraft(el.getAttribute('data-draft'), el.value);
        paint();
      });
      el.addEventListener('input', () => {
        setNestedDraft(el.getAttribute('data-draft'), el.value);
      });
    });
    root.querySelector('[data-ss-save]')?.addEventListener('click', saveDraft);
    root.querySelector('[data-ss-discard]')?.addEventListener('click', discardDraft);

    root.querySelectorAll('[data-ss-more]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-ss-more');
        const menu = root.querySelector(`[data-ss-menu="${id}"]`);
        root.querySelectorAll('[data-ss-menu]').forEach((m) => {
          if (m !== menu) m.hidden = true;
        });
        if (menu) menu.hidden = !menu.hidden;
      };
    });

    root.querySelectorAll('[data-ss-store-view]').forEach((btn) => {
      btn.onclick = () => {
        ui.modal = { type: 'view', storeId: btn.getAttribute('data-ss-store-view') };
        paint();
      };
    });
    root.querySelectorAll('[data-ss-store-edit]').forEach((btn) => {
      btn.onclick = () => {
        if (!ss().can('editStore')) return alert('لا صلاحية');
        ui.modal = { type: 'edit', storeId: btn.getAttribute('data-ss-store-edit') };
        paint();
      };
    });
    root.querySelectorAll('[data-ss-store-disable]').forEach((btn) => {
      btn.onclick = () => {
        if (!ss().can('disableStore')) return alert('لا صلاحية');
        const id = btn.getAttribute('data-ss-store-disable');
        const s = reg().get(id);
        ui.modal = {
          type: 'confirm',
          title: `هل تريد تعطيل متجر ${storeName(s)}؟`,
          message:
            'بعد التعطيل لن يظهر هذا المتجر كخيار متاح للعملاء عند إضافة منتجات جديدة، ولن يتم حذف بياناته أو منتجاته.',
          okLabel: 'تأكيد التعطيل',
          danger: true,
          onOk: () => {
            reg().updateStore(id, { status: 'disabled' }, actor());
            toast('تم تعطيل المتجر');
          },
        };
        paint();
      };
    });
    root.querySelectorAll('[data-ss-store-enable]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-ss-store-enable');
        if (!confirm('تفعيل المتجر؟')) return;
        reg().updateStore(id, { status: 'active', allowCustomers: true }, actor());
        toast('تم تفعيل المتجر');
        paint();
      };
    });
    root.querySelectorAll('[data-ss-store-archive]').forEach((btn) => {
      btn.onclick = () => {
        if (!ss().can('archiveStore')) return alert('لا صلاحية');
        const id = btn.getAttribute('data-ss-store-archive');
        const s = reg().get(id);
        ui.modal = {
          type: 'confirm',
          title: `أرشفة متجر ${storeName(s)}؟`,
          message: 'الأرشفة لا تحذف المتجر أو المنتجات أو السجلات التاريخية.',
          okLabel: 'تأكيد الأرشفة',
          danger: true,
          onOk: () => {
            reg().updateStore(id, { status: 'archived' }, actor());
            toast('تمت الأرشفة');
          },
        };
        paint();
      };
    });
    root.querySelectorAll('[data-ss-store-delete]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-ss-store-delete');
        const res = reg().deleteStore(id, actor());
        if (!res.ok) {
          alert(res.message);
          return;
        }
        toast('تم حذف المتجر');
        paint();
      };
    });
    root.querySelectorAll('[data-ss-store-products]').forEach((btn) => {
      btn.onclick = () => {
        ui.productsStoreId = btn.getAttribute('data-ss-store-products');
        ui.modal = null;
        ui.storeTab = 'list';
        paint();
      };
    });
    root.querySelector('[data-ss-close-products]')?.addEventListener('click', () => {
      ui.productsStoreId = null;
      paint();
    });
    root.querySelectorAll('[data-ss-store-logo]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-ss-store-logo');
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/png,image/jpeg,image/webp,image/svg+xml';
        inp.onchange = () => {
          const file = inp.files && inp.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            reg().updateStore(id, { logo: reader.result }, actor());
            toast('تم تحديث الشعار');
            paint();
          };
          reader.readAsDataURL(file);
        };
        inp.click();
      };
    });

    root.querySelectorAll('[data-ss-close-modal]').forEach((el) => {
      el.onclick = (e) => {
        if (el.classList.contains('ss-overlay') && e.target !== el) return;
        ui.modal = null;
        ui.wizard = null;
        ui.wizardStep = 0;
        paint();
      };
    });
    root.querySelector('[data-ss-confirm-ok]')?.addEventListener('click', () => {
      const fn = ui.modal?.onOk;
      ui.modal = null;
      if (fn) fn();
      paint();
    });
    root.querySelector('[data-ss-save-edit]')?.addEventListener('click', () => {
      const id = root.querySelector('[data-ss-save-edit]').getAttribute('data-ss-save-edit');
      const name = root.querySelector('#ss-edit-name')?.value?.trim();
      const url = root.querySelector('#ss-edit-url')?.value?.trim();
      if (!name) return alert('اسم المتجر مطلوب');
      if (!url || !/^https?:\/\//i.test(url)) return alert('رابط الموقع غير صالح');
      try {
        new URL(url);
      } catch (_) {
        return alert('رابط الموقع غير صالح');
      }
      reg().updateStore(
        id,
        {
          name,
          nameAr: name,
          websiteUrl: url,
          logo: root.querySelector('#ss-edit-logo')?.value || '',
          description: root.querySelector('#ss-edit-desc')?.value || '',
          status: root.querySelector('#ss-edit-status')?.value || 'active',
          requiresProductUrl: root.querySelector('#ss-edit-requrl')?.value !== 'off',
          openInNewTab: root.querySelector('#ss-edit-newtab')?.value !== 'off',
        },
        actor()
      );
      ui.modal = null;
      toast('✓ تم حفظ إعدادات المتجر بنجاح');
      paint();
    });

    root.querySelector('[data-ss-add-store]')?.addEventListener('click', () => {
      if (!ss().can('createStore')) return alert('لا صلاحية');
      ui.wizard = { name: '', storeCode: '', websiteUrl: '', logo: '', description: '', status: 'active' };
      ui.wizardStep = 0;
      ui.modal = { type: 'wizard' };
      paint();
    });
    root.querySelector('[data-ss-wiz-prev]')?.addEventListener('click', () => {
      readWizardFields();
      ui.wizardStep = Math.max(0, ui.wizardStep - 1);
      paint();
    });
    root.querySelector('[data-ss-wiz-next]')?.addEventListener('click', () => {
      readWizardFields();
      const w = ui.wizard;
      if (ui.wizardStep === 0) {
        if (!w.name) return alert('اسم المتجر مطلوب');
        if (!w.storeCode) return alert('Store Code مطلوب');
      }
      if (ui.wizardStep === 1) {
        if (!w.websiteUrl || !/^https?:\/\//i.test(w.websiteUrl)) return alert('رابط غير صالح');
        try {
          new URL(w.websiteUrl);
        } catch (_) {
          return alert('رابط غير صالح');
        }
      }
      if (ui.wizardStep === 2 && !w.logo) return alert('الشعار مطلوب');
      ui.wizardStep += 1;
      paint();
    });
    root.querySelector('[data-ss-test-url]')?.addEventListener('click', () => {
      readWizardFields();
      const msg = root.querySelector('#ss-w-url-msg');
      try {
        const u = new URL(ui.wizard.websiteUrl);
        if (!/^https?:$/i.test(u.protocol)) throw new Error('bad');
        if (msg) msg.textContent = '✓ الرابط صالح — سيُفتح في تبويب جديد للاختبار';
        window.open(ui.wizard.websiteUrl, '_blank', 'noopener,noreferrer');
      } catch (_) {
        if (msg) msg.textContent = '✗ الرابط غير صالح';
      }
    });
    root.querySelector('#ss-w-logo-file')?.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        ui.wizard.logo = reader.result;
        const hidden = document.getElementById('ss-w-logo');
        if (hidden) hidden.value = reader.result;
        paint();
      };
      reader.readAsDataURL(file);
    });
    root.querySelector('[data-ss-wiz-save]')?.addEventListener('click', () => {
      readWizardFields();
      try {
        const w = ui.wizard;
        reg().addStore(
          {
            name: w.name,
            storeCode: w.storeCode,
            websiteUrl: w.websiteUrl,
            logo: w.logo,
            description: w.description,
            status: w.status || 'active',
            requiresProductUrl: w.requiresProductUrl !== false,
            openInNewTab: true,
            allowCustomers: w.allowCustomers !== false,
            source: 'admin',
          },
          actor()
        );
        ui.modal = null;
        ui.wizard = null;
        ui.wizardStep = 0;
        toast('✓ تم حفظ المتجر بنجاح');
        paint();
      } catch (err) {
        alert(err.message || 'تعذر الحفظ');
      }
    });

    root.querySelector('[data-ss-audit-q]')?.addEventListener('input', (e) => {
      ui.auditQ = e.target.value;
      paint();
    });
    root.querySelector('[data-ss-audit-section]')?.addEventListener('change', (e) => {
      ui.auditSection = e.target.value;
      paint();
    });
    root.querySelector('[data-ss-audit-user]')?.addEventListener('input', (e) => {
      ui.auditUser = e.target.value;
      paint();
    });
  }

  function mount(el) {
    hostEl = el;
    ui.section = 'stores';
    ui.storeTab = 'list';
    ui.draft = null;
    ui.dirty = false;
    ui.modal = null;
    ui.productsStoreId = null;
    try {
      reg()?.reload?.();
      ss()?.reload?.();
    } catch (_) {}
    paint();
    window.addEventListener('beforeunload', (e) => {
      if (!ui.dirty) return;
      e.preventDefault();
      e.returnValue = '';
    });
  }

  function render() {
    return `<div id="site-settings-mount" class="ss-mount"></div>`;
  }

  window.HubSiteSettingsUI = { render, mount, SECTIONS };
})();
