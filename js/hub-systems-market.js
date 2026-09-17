/**
 * NAIOSH HUB 360 — سوق الأنظمة التشغيلية (System Management Module)
 * قائمة · بحث/فلاتر · عرض · تعديل فعلي · Wizard إضافة · مستخدمون · تكاملات · تدقيق
 */
(() => {
  'use strict';

  const PAGE_SIZES = [10, 25, 50, 100];
  const DEFAULT_PAGE_SIZE = 25;
  const TABS = [
    { id: 'list', label: 'الأنظمة', icon: 'fa-store' },
    { id: 'categories', label: 'الفئات', icon: 'fa-tags' },
    { id: 'reports', label: 'التقارير', icon: 'fa-chart-line' },
    { id: 'settings', label: 'إعدادات السوق', icon: 'fa-gear' },
    { id: 'audit', label: 'سجل التدقيق', icon: 'fa-clock-rotate-left' },
  ];
  const EDIT_TABS = [
    { id: 'basic', label: 'المعلومات الأساسية', icon: 'fa-info-circle' },
    { id: 'company', label: 'الشركة والاشتراك', icon: 'fa-building' },
    { id: 'users', label: 'المستخدمون والصلاحيات', icon: 'fa-users' },
    { id: 'integrations', label: 'الاتصال والتكامل', icon: 'fa-plug' },
    { id: 'settings', label: 'الإعدادات', icon: 'fa-sliders' },
    { id: 'audit', label: 'سجل التغييرات', icon: 'fa-clock-rotate-left' },
  ];
  const VIEW_TABS = [
    { id: 'overview', label: 'نظرة عامة', icon: 'fa-gauge' },
    { id: 'company', label: 'الشركة', icon: 'fa-building' },
    { id: 'users', label: 'المستخدمون', icon: 'fa-users' },
    { id: 'integrations', label: 'التكاملات', icon: 'fa-plug' },
    { id: 'activity', label: 'النشاط', icon: 'fa-bolt' },
    { id: 'audit', label: 'التغييرات', icon: 'fa-clock' },
  ];
  const ADD_STEPS = ['المعلومات', 'الشركة', 'الاشتراك', 'المستخدمون', 'التكامل', 'المراجعة'];
  const STATUSES = ['Draft', 'Active', 'Suspended', 'Archived'];
  const STATUS_AR = { Draft: 'مسودة', Active: 'نشط', Suspended: 'موقوف', Archived: 'مؤرشف' };
  const SOURCE_AR = {
    Manual: 'إدخال يدوي',
    Import: 'استيراد',
    API: 'API',
    Integration: 'تكامل',
    Template: 'قالب',
    'System Generated': 'مولّد تلقائياً',
  };
  const FIELD_AR = {
    name: 'اسم النظام',
    code: 'رمز النظام',
    description: 'الوصف',
    category: 'الفئة',
    status: 'الحالة',
    owner: 'المسؤول',
    companyName: 'اسم الشركة',
    companyNameEn: 'اسم الشركة (EN)',
    companyAddress: 'العنوان',
    companyPhone: 'الهاتف',
    companyPhone2: 'الهاتف الثاني',
    companyEmail: 'البريد',
    companyWebsite: 'الموقع',
    plan: 'الخطة',
    subscriptionStart: 'بداية الاشتراك',
    subscriptionEnd: 'نهاية الاشتراك',
    seatsAllowed: 'المقاعد المسموحة',
    subscriptionStatus: 'حالة الاشتراك',
  };
  const SENSITIVE = new Set(['plan', 'seatsAllowed', 'status', 'subscriptionStatus']);

  const ui = {
    tab: 'list',
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    sortKey: 'updatedAt',
    sortDir: 'desc',
    filters: { q: '', status: '', category: '', company: '', plan: '', source: '' },
    menuOpen: null,
    helpOpen: false,
    mode: null,
    systemId: null,
    editTab: 'basic',
    viewTab: 'overview',
    draft: null,
    baseline: null,
    dirty: false,
    errors: {},
    saveError: '',
    confirm: null,
    wizardStep: 0,
    wizardData: {},
    importStep: 0,
    importRows: [],
    importStats: null,
    userQ: '',
    userRole: '',
    userStatus: '',
    pendingSensitive: null,
  };

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fmtTime = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return String(iso);
    }
  };

  const store = () => window.HubStore;
  const marketData = () => {
    store()?.hydrateSystemsMarketplace?.();
    store()?.recomputeMarketKpis?.();
    return store()?.get?.()?.empire?.marketplace || { catalog: [], auditLog: [], settings: {} };
  };

  const actorName = (user) => user?.name || user?.email || user?.displayName || 'مشغّل هوب';
  const permLevel = (user) => {
    const role = String(user?.role || '').toLowerCase();
    if (['supreme_leader', 'admin'].includes(role)) return 'admin';
    if (['chief_engineer', 'manager'].includes(role)) return 'manager';
    if (['operator'].includes(role)) return 'operator';
    if (['auditor', 'audit'].includes(role)) return 'auditor';
    if (['employee', 'user', 'customer', 'client'].includes(role)) return 'viewer';
    return 'admin';
  };
  const can = (user, action) => {
    const p = permLevel(user);
    if (p === 'admin') return true;
    if (p === 'auditor') return ['view', 'audit', 'report'].includes(action);
    if (p === 'viewer') return action === 'view';
    if (p === 'operator') return ['view', 'sync', 'ops'].includes(action);
    if (p === 'manager') return !['settings_market'].includes(action) || true;
    return true;
  };

  const statusLabel = (s) => STATUS_AR[s] || STATUS_AR[String(s)] || s || '—';
  const statusBadge = (s) => {
    const n = String(s);
    const map = { Active: 'badge-black', Draft: 'badge-outline', Suspended: 'badge-red', Archived: 'badge-gray' };
    return `<span class="badge ${map[n] || 'badge-outline'}">${esc(statusLabel(n))}</span>`;
  };
  const sourceLabel = (s) => SOURCE_AR[s] || s || '—';
  const unique = (arr) => [...new Set(arr.filter(Boolean))];
  const qVal = (id) => {
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (!el) return '';
    return el.type === 'checkbox' ? el.checked : el.value;
  };

  const activeSystems = (m) => (m.catalog || []).filter((s) => !s.archived && String(s.status) !== 'Archived');

  const filterSystems = (m) => {
    const f = ui.filters;
    return activeSystems(m).filter((s) => {
      if (f.status && String(s.status) !== f.status) return false;
      if (f.category && s.category !== f.category) return false;
      if (f.company && s.companyName !== f.company) return false;
      if (f.plan && s.plan !== f.plan) return false;
      if (f.source && s.source !== f.source) return false;
      if (f.q) {
        const hay = `${s.name} ${s.code} ${s.companyName} ${s.category} ${s.owner}`.toLowerCase();
        if (!hay.includes(String(f.q).toLowerCase())) return false;
      }
      return true;
    });
  };

  const sortSystems = (list) => {
    const key = ui.sortKey || 'name';
    const dir = ui.sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[key] ?? '';
      const bv = b[key] ?? '';
      if (key === 'updatedAt' || key === 'createdAt') return (new Date(av) - new Date(bv)) * dir;
      if (typeof av === 'number' || typeof bv === 'number') return (Number(av) - Number(bv)) * dir;
      return String(av).localeCompare(String(bv), 'ar') * dir;
    });
  };

  const paginate = (arr) => {
    const size = Number(ui.pageSize) || DEFAULT_PAGE_SIZE;
    const total = arr.length;
    const pages = Math.max(1, Math.ceil(total / size) || 1);
    if (ui.page > pages) ui.page = pages;
    if (ui.page < 1) ui.page = 1;
    const start = (ui.page - 1) * size;
    return { rows: arr.slice(start, start + size), total, pages, start, end: Math.min(start + size, total), size };
  };

  const sysById = (m, id) => (m.catalog || []).find((s) => s.id === id);

  const snapshot = (sys) =>
    JSON.parse(
      JSON.stringify({
        name: sys.name,
        code: sys.code,
        description: sys.description,
        category: sys.category,
        status: sys.status,
        owner: sys.owner,
        logo: sys.logo,
        companyName: sys.companyName,
        companyNameEn: sys.companyNameEn,
        companyAddress: sys.companyAddress,
        companyPhone: sys.companyPhone,
        companyPhone2: sys.companyPhone2,
        companyEmail: sys.companyEmail,
        companyWebsite: sys.companyWebsite,
        plan: sys.plan,
        subscriptionStart: sys.subscriptionStart,
        subscriptionEnd: sys.subscriptionEnd,
        seatsAllowed: sys.seatsAllowed,
        subscriptionStatus: sys.subscriptionStatus,
        settings: sys.settings || {},
      })
    );

  const markDirty = () => {
    if (!ui.draft || !ui.baseline) {
      ui.dirty = false;
      return;
    }
    ui.dirty = JSON.stringify(ui.draft) !== JSON.stringify(ui.baseline);
  };

  const captureEditFields = () => {
    if (!ui.draft) return ui.draft;
    const d = ui.draft;
    const tab = ui.editTab;
    if (tab === 'basic') {
      d.name = qVal('sm-e-name') || d.name;
      d.code = qVal('sm-e-code') || d.code;
      d.description = qVal('sm-e-desc');
      d.category = qVal('sm-e-cat') || d.category;
      d.status = qVal('sm-e-status') || d.status;
      d.owner = qVal('sm-e-owner') || d.owner;
      d.logo = qVal('sm-e-logo') || d.logo;
    } else if (tab === 'company') {
      d.companyName = qVal('sm-e-cname');
      d.companyNameEn = qVal('sm-e-cname-en');
      d.companyAddress = qVal('sm-e-addr');
      d.companyPhone = qVal('sm-e-phone');
      d.companyPhone2 = qVal('sm-e-phone2');
      d.companyEmail = qVal('sm-e-email');
      d.companyWebsite = qVal('sm-e-web');
      d.plan = qVal('sm-e-plan') || d.plan;
      d.subscriptionStart = qVal('sm-e-sstart') || d.subscriptionStart;
      d.subscriptionEnd = qVal('sm-e-send') || d.subscriptionEnd;
      d.seatsAllowed = Number(qVal('sm-e-seats') || d.seatsAllowed);
      d.subscriptionStatus = qVal('sm-e-sstatus') || d.subscriptionStatus;
    } else if (tab === 'settings') {
      d.settings = {
        ...(d.settings || {}),
        language: qVal('sm-e-lang') || 'ar',
        timezone: qVal('sm-e-tz') || 'Asia/Riyadh',
        notifications: !!qVal('sm-e-notif'),
        dataRetentionDays: Number(qVal('sm-e-retain') || 365),
        auditEnabled: !!qVal('sm-e-aud'),
        mfaRequired: !!qVal('sm-e-mfa'),
      };
    }
    ui.draft = d;
    markDirty();
    return d;
  };

  const openEdit = (sys) => {
    ui.mode = 'edit';
    ui.systemId = sys.id;
    ui.editTab = 'basic';
    ui.draft = snapshot(sys);
    ui.baseline = snapshot(sys);
    ui.dirty = false;
    ui.errors = {};
    ui.saveError = '';
    ui.menuOpen = null;
  };

  const openView = (sys) => {
    ui.mode = 'view';
    ui.systemId = sys.id;
    ui.viewTab = 'overview';
    ui.menuOpen = null;
  };

  const requestClosePanel = () => {
    if (ui.mode === 'edit') captureEditFields();
    if (ui.mode === 'edit' && ui.dirty) {
      ui.confirm = {
        title: 'لديك تغييرات غير محفوظة',
        message: 'هل تريد مغادرة الصفحة؟',
        yes: 'تجاهل التغييرات',
        no: 'متابعة التعديل',
        run: () => {
          ui.mode = null;
          ui.systemId = null;
          ui.draft = null;
          ui.baseline = null;
          ui.dirty = false;
        },
      };
      return;
    }
    ui.mode = null;
    ui.systemId = null;
    ui.draft = null;
    ui.baseline = null;
    ui.dirty = false;
  };

  const field = (label, id, val, opts = {}) => {
    const required = opts.required ? ' <span class="sm-req">*</span>' : '';
    const help = opts.help ? `<small class="sm-help">${esc(opts.help)}</small>` : '';
    const err = ui.errors[opts.errorKey || id.replace(/^sm-e-/, '')] || ui.errors[opts.field];
    const errHtml = err ? `<div class="sm-field-error">${esc(err)}</div>` : '';
    if (opts.type === 'textarea') {
      return `<label class="field sm-field"><span>${esc(label)}${required}</span><textarea id="${esc(id)}" rows="${opts.rows || 3}" placeholder="${esc(opts.placeholder || '')}">${esc(val || '')}</textarea>${help}${errHtml}</label>`;
    }
    if (opts.type === 'select') {
      return `<label class="field sm-field"><span>${esc(label)}${required}</span><select id="${esc(id)}">${opts.optionsHtml || ''}</select>${help}${errHtml}</label>`;
    }
    if (opts.readonly) {
      return `<div class="sm-readonly"><span class="muted">${esc(label)}</span><strong>${esc(val || '—')}</strong><small>لا يمكن تعديل هذا الحقل</small></div>`;
    }
    return `<label class="field sm-field"><span>${esc(label)}${required}</span><input id="${esc(id)}" type="${esc(opts.type || 'text')}" value="${esc(val || '')}" placeholder="${esc(opts.placeholder || '')}" />${help}${errHtml}</label>`;
  };

  const renderHeader = (m, user) => {
    const role = permLevel(user);
    const roleLabel = { admin: 'System Admin', manager: 'System Manager', operator: 'Operator', auditor: 'Auditor', viewer: 'عرض' }[role];
    return `<div class="toolbar sm-header" style="flex-wrap:wrap;gap:8px">
      <div style="display:flex;flex-wrap:wrap;gap:8px;flex:1">
        ${can(user, 'edit') ? `<button type="button" class="btn btn-primary" data-action="sm-add" title="إضافة نظام"><i class="fas fa-plus"></i> إضافة نظام</button>` : ''}
        ${can(user, 'edit') ? `<button type="button" class="btn btn-dark" data-action="sm-import" title="استيراد أنظمة"><i class="fas fa-file-import"></i> استيراد</button>` : ''}
        <button type="button" class="btn btn-ghost" data-action="sm-tab" data-tab="categories" title="الفئات"><i class="fas fa-tags"></i> الفئات</button>
        <button type="button" class="btn btn-ghost" data-action="sm-tab" data-tab="reports" title="التقارير"><i class="fas fa-chart-line"></i> التقارير</button>
        <button type="button" class="btn btn-ghost" data-action="sm-tab" data-tab="settings" title="إعدادات السوق"><i class="fas fa-gear"></i> إعدادات السوق</button>
        <button type="button" class="btn btn-ghost" data-action="sm-help-open" title="دليل الاستخدام"><i class="fas fa-circle-question"></i> كيف أستخدم سوق الأنظمة؟</button>
      </div>
      <span class="badge badge-outline">${esc(roleLabel)} · ${m.totalSystems || 0} نظام</span>
    </div>`;
  };

  const renderHelp = () => {
    if (!ui.helpOpen) return '';
    return `<article class="card sm-help">
      <div class="toolbar">
        <strong><i class="fas fa-circle-question icon"></i> كيف أستخدم سوق الأنظمة؟</strong>
        <div>
          <button type="button" class="btn btn-sm btn-ghost" data-action="sm-help-dismiss">إخفاء</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="sm-help-close">✕</button>
        </div>
      </div>
      <p class="muted">من سوق الأنظمة يمكنك إضافة وإدارة الأنظمة المتصلة بالمنصة.</p>
      <ol style="line-height:1.8;margin:0;padding-inline-start:1.2rem">
        <li>ابحث عن النظام.</li>
        <li>اضغط «عرض» لرؤية التفاصيل.</li>
        <li>اضغط «تعديل» لتغيير بياناته.</li>
        <li>عدّل القسم المطلوب من التبويبات.</li>
        <li>اضغط «حفظ التغييرات».</li>
        <li>يتم تسجيل التعديل تلقائياً في سجل التغييرات.</li>
      </ol>
    </article>`;
  };

  const renderKpis = (m) => {
    const items = [
      { label: 'إجمالي الأنظمة', value: m.totalSystems ?? 0 },
      { label: 'نشطة', value: m.activeSystems ?? 0 },
      { label: 'موقوفة', value: m.suspendedSystems ?? 0 },
      { label: 'مسودات', value: m.draftSystems ?? 0 },
    ];
    return `<div class="kpis" style="margin:12px 0">${items
      .map((k) => `<article class="kpi"><span class="kpi-label">${esc(k.label)}</span><strong class="kpi-value">${esc(k.value)}</strong></article>`)
      .join('')}</div>`;
  };

  const renderTabs = () =>
    `<div class="tabs" role="tablist">${TABS.map(
      (t) =>
        `<button type="button" class="tab ${ui.tab === t.id ? 'active' : ''}" data-action="sm-tab" data-tab="${esc(t.id)}" role="tab"><i class="fas ${t.icon}"></i> ${esc(t.label)}</button>`
    ).join('')}</div>`;

  const renderFilters = (m) => {
    const list = activeSystems(m);
    const cats = unique(list.map((s) => s.category));
    const companies = unique(list.map((s) => s.companyName));
    const plans = unique(list.map((s) => s.plan));
    const sources = unique(list.map((s) => s.source));
    const f = ui.filters;
    const opt = (arr, cur) =>
      `<option value="">الكل</option>${arr.map((x) => `<option value="${esc(x)}" ${cur === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}`;
    return `<div class="card sm-filters" style="padding:12px;margin:12px 0">
      <div class="toolbar" style="gap:8px;flex-wrap:wrap;align-items:flex-end">
        <label class="field" style="flex:1;min-width:220px"><span>ابحث باسم النظام، الشركة، الكود...</span>
          <input id="sm-q" type="search" value="${esc(f.q)}" data-sm-change="q" placeholder="🔍 بحث" />
        </label>
        <label class="field"><span>الحالة</span><select data-sm-change="status">${opt(STATUSES, f.status)}</select></label>
        <label class="field"><span>الفئة</span><select data-sm-change="category">${opt(cats, f.category)}</select></label>
        <label class="field"><span>الشركة</span><select data-sm-change="company">${opt(companies, f.company)}</select></label>
        <label class="field"><span>الخطة</span><select data-sm-change="plan">${opt(plans, f.plan)}</select></label>
        <label class="field"><span>مصدر النظام</span><select data-sm-change="source">${opt(sources, f.source)}</select></label>
        <button type="button" class="btn btn-ghost" data-action="sm-clear-filters">مسح الفلاتر</button>
      </div>
    </div>`;
  };

  const sortBtn = (key, label) => {
    const active = ui.sortKey === key;
    const arrow = active ? (ui.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<button type="button" class="sm-sort" data-action="sm-sort" data-key="${esc(key)}" title="ترتيب حسب ${esc(label)}">${esc(label)}${arrow}</button>`;
  };

  const renderRowMenu = (s, user) => {
    if (ui.menuOpen !== s.id) return '';
    const toggle = String(s.status) === 'Active' ? 'إيقاف' : 'تفعيل';
    return `<div class="sm-row-menu">
      ${can(user, 'edit') ? `<button type="button" data-action="sm-view-tab" data-id="${esc(s.id)}" data-vtab="users" title="إدارة المستخدمين">إدارة المستخدمين</button>` : ''}
      ${can(user, 'edit') ? `<button type="button" data-action="sm-view-tab" data-id="${esc(s.id)}" data-vtab="company" title="إدارة الاشتراك">إدارة الاشتراك</button>` : ''}
      <button type="button" data-action="sm-view-tab" data-id="${esc(s.id)}" data-vtab="integrations" title="التكاملات">التكاملات</button>
      <button type="button" data-action="sm-view-tab" data-id="${esc(s.id)}" data-vtab="activity" title="سجل النشاط">سجل النشاط</button>
      ${can(user, 'edit') ? `<button type="button" data-action="sm-status" data-id="${esc(s.id)}" data-status="${String(s.status) === 'Active' ? 'Suspended' : 'Active'}" title="${toggle}">${toggle}</button>` : ''}
      ${can(user, 'edit') ? `<button type="button" data-action="sm-clone" data-id="${esc(s.id)}" title="نسخ النظام">نسخ النظام</button>` : ''}
      ${can(user, 'edit') ? `<button type="button" data-action="sm-status" data-id="${esc(s.id)}" data-status="Archived" title="أرشفة">أرشفة</button>` : ''}
    </div>`;
  };

  const renderTable = (m, user, page) => {
    if (!page.total) {
      return `<div class="empty">لا توجد أنظمة.
        ${can(user, 'edit') ? `<div style="margin-top:8px"><button type="button" class="btn btn-primary" data-action="sm-add">+ إضافة نظام</button></div>` : ''}
      </div>`;
    }
    const rows = page.rows
      .map(
        (s) => `<tr>
        <td class="sm-sticky-name">
          <button type="button" class="sm-name-link" data-action="sm-view" data-id="${esc(s.id)}" title="عرض النظام">${esc(s.name)}</button>
          <small class="muted">${esc(sourceLabel(s.source))}</small>
        </td>
        <td><code>${esc(s.code)}</code></td>
        <td>${esc(s.companyName || '—')}</td>
        <td>${esc(s.category || '—')}</td>
        <td>${esc(s.plan || '—')}</td>
        <td>${s.userCount || (s.users || []).length || 0} / ${s.seatsAllowed || '—'}</td>
        <td>${statusBadge(s.status)}</td>
        <td>${fmtTime(s.updatedAt)}</td>
        <td class="sm-sticky-actions">
          <div class="sm-actions">
            <button type="button" class="btn btn-sm btn-ghost" data-action="sm-view" data-id="${esc(s.id)}" title="عرض">عرض</button>
            ${can(user, 'edit') ? `<button type="button" class="btn btn-sm btn-primary" data-action="sm-edit" data-id="${esc(s.id)}" title="تعديل">تعديل</button>` : ''}
            <button type="button" class="btn btn-sm btn-ghost" data-action="sm-menu" data-id="${esc(s.id)}" title="المزيد">⋮</button>
            ${renderRowMenu(s, user)}
          </div>
        </td>
      </tr>`
      )
      .join('');
    return `<div class="sm-table-wrap table-wrap"><table class="data sm-table">
      <thead><tr>
        <th class="sm-sticky-name">${sortBtn('name', 'النظام')}</th>
        <th>${sortBtn('code', 'الكود')}</th>
        <th>${sortBtn('companyName', 'الشركة')}</th>
        <th>${sortBtn('category', 'الفئة')}</th>
        <th>${sortBtn('plan', 'الخطة')}</th>
        <th>المستخدمون</th>
        <th>${sortBtn('status', 'الحالة')}</th>
        <th>${sortBtn('updatedAt', 'آخر تحديث')}</th>
        <th class="sm-sticky-actions">الإجراءات</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  };

  const renderPagination = (page) => {
    if (!page.total) return '';
    const nums = [];
    const max = page.pages;
    let start = Math.max(1, ui.page - 2);
    let end = Math.min(max, start + 4);
    start = Math.max(1, end - 4);
    for (let i = start; i <= end; i++) nums.push(i);
    return `<div class="toolbar sm-pagination" style="justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:12px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <label class="field" style="margin:0">عرض
          <select data-sm-change="pageSize">${PAGE_SIZES.map((n) => `<option value="${n}" ${ui.pageSize === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
        </label>
        <span class="muted">عرض ${page.start + 1}–${page.end} من ${page.total} نظام</span>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        <button type="button" class="btn btn-sm btn-ghost" data-action="sm-page" data-dir="prev" ${ui.page <= 1 ? 'disabled' : ''} title="السابق">السابق</button>
        ${nums.map((n) => `<button type="button" class="btn btn-sm ${n === ui.page ? 'btn-dark' : 'btn-ghost'}" data-action="sm-goto" data-page="${n}">${n}</button>`).join('')}
        <button type="button" class="btn btn-sm btn-ghost" data-action="sm-page" data-dir="next" ${ui.page >= max ? 'disabled' : ''} title="التالي">التالي</button>
      </div>
    </div>`;
  };

  const renderList = (m, user) => {
    const page = paginate(sortSystems(filterSystems(m)));
    return `${renderFilters(m)}
      <article class="card">
        <div class="toolbar">
          <h3 style="margin:0"><span class="title-left"><i class="fas fa-store icon"></i> الأنظمة التشغيلية</span></h3>
          <span class="badge badge-outline">${page.total} نظام</span>
        </div>
        ${renderTable(m, user, page)}
        ${renderPagination(page)}
      </article>
      <article class="card" style="margin-top:16px">
        <h3><span class="title-left"><i class="fas fa-heartbeat icon"></i> صحة التشغيل اللحظية</span></h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>النظام</th><th>الصحة</th><th>الحالة</th><th>آخر مزامنة</th><th></th></tr></thead>
          <tbody>${(store()?.get?.()?.systems?.registry || [])
            .map(
              (sys) => `<tr>
              <td>${esc(sys.name)}</td>
              <td>${sys.health}%</td>
              <td>${statusBadge(sys.status === 'online' ? 'Active' : 'Suspended')}</td>
              <td>${fmtTime(sys.lastSync)}</td>
              <td><button type="button" class="btn btn-sm btn-dark" data-action="sm-sync-registry" data-id="${esc(sys.id)}" title="مزامنة">مزامنة</button></td>
            </tr>`
            )
            .join('')}</tbody>
        </table></div>
      </article>`;
  };

  const renderUsersTable = (sys, editable) => {
    let users = sys.users || [];
    if (ui.userQ) users = users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(ui.userQ.toLowerCase()));
    if (ui.userRole) users = users.filter((u) => u.role === ui.userRole);
    if (ui.userStatus) users = users.filter((u) => u.status === ui.userStatus);
    return `
      <div class="toolbar" style="gap:8px;flex-wrap:wrap">
        <strong>عدد المستخدمين: ${(sys.users || []).length} / ${sys.seatsAllowed || '—'}</strong>
        ${editable ? `<button type="button" class="btn btn-sm btn-primary" data-action="sm-add-user" data-id="${esc(sys.id)}" title="إضافة مستخدم">+ إضافة مستخدم</button>` : ''}
      </div>
      <div class="toolbar" style="gap:8px;margin:8px 0">
        <input data-sm-change="userQ" placeholder="بحث مستخدم..." value="${esc(ui.userQ)}" />
        <select data-sm-change="userRole"><option value="">كل الأدوار</option>${['Admin', 'Manager', 'Operator'].map((r) => `<option ${ui.userRole === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
        <select data-sm-change="userStatus"><option value="">كل الحالات</option>${['Active', 'Inactive'].map((r) => `<option ${ui.userStatus === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الحالة</th><th>آخر دخول</th></tr></thead>
        <tbody>${
          users.length
            ? users
                .map(
                  (u) =>
                    `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${esc(u.status)}</td><td>${fmtTime(u.lastLogin)}</td></tr>`
                )
                .join('')
            : '<tr><td colspan="5" class="empty">لا مستخدمين</td></tr>'
        }</tbody>
      </table></div>`;
  };

  const renderIntegrations = (sys, user) =>
    `<div class="table-wrap"><table class="data">
      <thead><tr><th>Integration</th><th>Type</th><th>Direction</th><th>Status</th><th>Last Sync</th><th>الإجراءات</th></tr></thead>
      <tbody>${(sys.integrations || [])
        .map(
          (i) => `<tr>
          <td>${esc(i.name)}</td><td>${esc(i.type)}</td><td>${esc(i.direction)}</td>
          <td>${esc(i.status)}</td><td>${fmtTime(i.lastSync)}</td>
          <td>
            <button type="button" class="btn btn-sm btn-ghost" data-action="sm-int-test" data-sid="${esc(sys.id)}" data-iid="${esc(i.id)}" title="اختبار الاتصال">اختبار الاتصال</button>
            <button type="button" class="btn btn-sm btn-dark" data-action="sm-int-sync" data-sid="${esc(sys.id)}" data-iid="${esc(i.id)}" title="مزامنة الآن">مزامنة الآن</button>
          </td>
        </tr>`
        )
        .join('') || '<tr><td colspan="6" class="empty">لا تكاملات</td></tr>'}</tbody>
    </table></div>`;

  const renderAuditRows = (rows) =>
    `<div class="table-wrap"><table class="data">
      <thead><tr><th>رقم العملية</th><th>المستخدم</th><th>العملية</th><th>الحقل</th><th>السابق</th><th>الجديد</th><th>التاريخ</th></tr></thead>
      <tbody>${
        (rows || []).length
          ? rows
              .map(
                (a) => `<tr>
              <td><code>${esc(a.id)}</code></td>
              <td>${esc(a.user)}</td>
              <td>${esc(a.action)}</td>
              <td>${esc(FIELD_AR[a.field] || a.field || '—')}</td>
              <td>${esc(a.oldValue || '—')}</td>
              <td>${esc(a.newValue || '—')}</td>
              <td>${fmtTime(a.at)}</td>
            </tr>`
              )
              .join('')
          : '<tr><td colspan="7" class="empty">لا تغييرات بعد</td></tr>'
      }</tbody>
    </table></div>`;

  const renderSourceCard = (sys) =>
    `<div class="card sm-source" style="margin-top:12px">
      <h4>مصدر النظام</h4>
      <div class="sm-form-grid">
        <div class="sm-readonly"><span class="muted">أنشئ بواسطة</span><strong>${esc(sys.createdBy || '—')}</strong></div>
        <div class="sm-readonly"><span class="muted">Created At</span><strong>${fmtTime(sys.createdAt)}</strong></div>
        <div class="sm-readonly"><span class="muted">Creation Method</span><strong>${esc(sourceLabel(sys.creationMethod || sys.source))}</strong></div>
        <div class="sm-readonly"><span class="muted">Imported From</span><strong>${esc(sys.importedFrom || '—')}</strong></div>
        <div class="sm-readonly"><span class="muted">Integration Source</span><strong>${esc(sys.integrationSource || '—')}</strong></div>
      </div>
    </div>`;

  const renderViewPanel = (m, user) => {
    const sys = sysById(m, ui.systemId);
    if (!sys) return '';
    const nav = VIEW_TABS.map(
      (t) =>
        `<button type="button" class="btn btn-sm ${ui.viewTab === t.id ? 'btn-dark' : 'btn-ghost'}" data-action="sm-viewtab" data-vtab="${esc(t.id)}"><i class="fas ${t.icon}"></i> ${esc(t.label)}</button>`
    ).join('');
    let body = '';
    if (ui.viewTab === 'company') {
      body = `<div class="sm-form-grid">
        <div><div class="muted">الشركة</div><strong>${esc(sys.companyName)}</strong></div>
        <div><div class="muted">EN</div><strong>${esc(sys.companyNameEn)}</strong></div>
        <div><div class="muted">الهاتف</div><strong>${esc(sys.companyPhone)}</strong></div>
        <div><div class="muted">البريد</div><strong>${esc(sys.companyEmail)}</strong></div>
        <div><div class="muted">الخطة</div><strong>${esc(sys.plan)}</strong></div>
        <div><div class="muted">الاشتراك</div><strong>${esc(sys.subscriptionStatus)}</strong></div>
      </div>`;
    } else if (ui.viewTab === 'users') body = renderUsersTable(sys, can(user, 'edit'));
    else if (ui.viewTab === 'integrations') body = renderIntegrations(sys, user);
    else if (ui.viewTab === 'activity') {
      body = (sys.activityLog || [])
        .slice(0, 40)
        .map((a) => `<div style="padding:8px 0;border-bottom:1px solid var(--border)"><strong>${esc(a.type)}</strong> · ${esc(a.text)}<div class="muted">${esc(a.user)} · ${fmtTime(a.at)}</div></div>`)
        .join('') || '<div class="empty">لا نشاط</div>';
    } else if (ui.viewTab === 'audit') body = renderAuditRows(sys.auditLog || []);
    else {
      body = `<div class="kpis" style="margin-bottom:12px">
        <article class="kpi"><span class="kpi-label">الحالة</span><strong>${statusBadge(sys.status)}</strong></article>
        <article class="kpi"><span class="kpi-label">المستخدمون</span><strong>${sys.userCount || 0}/${sys.seatsAllowed || '—'}</strong></article>
        <article class="kpi"><span class="kpi-label">الخطة</span><strong>${esc(sys.plan)}</strong></article>
        <article class="kpi"><span class="kpi-label">آخر مزامنة</span><strong>${fmtTime(sys.lastSync)}</strong></article>
      </div>
      <p>${esc(sys.description || '')}</p>
      ${renderSourceCard(sys)}`;
    }
    return `<div class="sm-panel">
      <div class="sm-panel-head">
        <div>
          <h2 style="margin:0">${esc(sys.name)}</h2>
          <div class="muted">${esc(sys.companyName)} · <code>${esc(sys.code)}</code> · ${statusBadge(sys.status)}</div>
        </div>
        <div class="toolbar" style="gap:6px">
          ${can(user, 'edit') ? `<button type="button" class="btn btn-primary" data-action="sm-edit" data-id="${esc(sys.id)}" title="تعديل">تعديل</button>` : ''}
          <button type="button" class="btn btn-ghost" data-action="sm-view-tab" data-id="${esc(sys.id)}" data-vtab="users" title="إدارة المستخدمين">إدارة المستخدمين</button>
          <button type="button" class="btn btn-ghost" data-action="sm-edit" data-id="${esc(sys.id)}" data-etab="settings" title="الإعدادات">الإعدادات</button>
          <button type="button" class="btn btn-ghost" data-action="sm-close-panel" title="إغلاق">✕</button>
        </div>
      </div>
      <div class="toolbar" style="gap:4px;flex-wrap:wrap;margin:12px 0">${nav}</div>
      ${body}
    </div>`;
  };

  const renderEditBasic = (m, d) => {
    const cats = m.categories || [];
    return `<p class="muted">* الحقول المشار إليها مطلوبة</p>
      <div class="card sm-section"><h4>المعلومات الأساسية</h4>
        <div class="sm-form-grid">
          ${field('اسم النظام', 'sm-e-name', d.name, { required: true, help: 'الاسم الذي سيظهر للمستخدمين داخل المنصة.', field: 'name' })}
          ${field('System Code', 'sm-e-code', d.code, { required: true, help: 'رمز فريد يستخدم لتعريف النظام في التكاملات.', field: 'code' })}
          ${field('الوصف', 'sm-e-desc', d.description, { type: 'textarea' })}
          ${field('الفئة', 'sm-e-cat', d.category, { type: 'select', optionsHtml: cats.map((c) => `<option ${d.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('') })}
          ${field('الحالة', 'sm-e-status', d.status, { type: 'select', optionsHtml: STATUSES.map((s) => `<option value="${s}" ${d.status === s ? 'selected' : ''}>${esc(statusLabel(s))}</option>`).join('') })}
          ${field('المالك / المسؤول', 'sm-e-owner', d.owner, { placeholder: 'اختر أو اكتب اسم المسؤول' })}
          ${field('Logo (رابط)', 'sm-e-logo', d.logo, { placeholder: 'https://...' })}
        </div>
      </div>
      <div class="card sm-section"><h4>حقول ثابتة</h4>
        <div class="sm-form-grid">
          ${field('System ID', '', ui.systemId, { readonly: true })}
          ${field('Created At', '', fmtTime(sysById(m, ui.systemId)?.createdAt), { readonly: true })}
          ${field('أنشئ بواسطة', '', sysById(m, ui.systemId)?.createdBy, { readonly: true })}
        </div>
      </div>`;
  };

  const renderEditCompany = (m, d) => `<div class="card sm-section"><h4>بيانات الشركة</h4>
      <div class="sm-form-grid">
        ${field('اسم الشركة', 'sm-e-cname', d.companyName, { required: true, field: 'companyName' })}
        ${field('اسم الشركة باللغة الإنجليزية', 'sm-e-cname-en', d.companyNameEn)}
        ${field('العنوان', 'sm-e-addr', d.companyAddress)}
        ${field('الهاتف', 'sm-e-phone', d.companyPhone)}
        ${field('الهاتف الثاني', 'sm-e-phone2', d.companyPhone2)}
        ${field('البريد', 'sm-e-email', d.companyEmail, { type: 'email' })}
        ${field('الموقع الإلكتروني', 'sm-e-web', d.companyWebsite)}
      </div>
    </div>
    <div class="card sm-section"><h4>بيانات الاشتراك</h4>
      <div class="sm-form-grid">
        ${field('الخطة', 'sm-e-plan', d.plan, { type: 'select', optionsHtml: (m.plans || []).map((p) => `<option ${d.plan === p ? 'selected' : ''}>${esc(p)}</option>`).join('') })}
        ${field('تاريخ البداية', 'sm-e-sstart', d.subscriptionStart, { type: 'date' })}
        ${field('تاريخ الانتهاء', 'sm-e-send', d.subscriptionEnd, { type: 'date' })}
        ${field('عدد المستخدمين المسموح', 'sm-e-seats', d.seatsAllowed, { type: 'number' })}
        ${field('حالة الاشتراك', 'sm-e-sstatus', d.subscriptionStatus, { type: 'select', optionsHtml: ['Active', 'Paused', 'Expired'].map((p) => `<option ${d.subscriptionStatus === p ? 'selected' : ''}>${p}</option>`).join('') })}
        <div class="sm-readonly"><span class="muted">عدد المستخدمين الحالي</span><strong>${sysById(m, ui.systemId)?.userCount || 0}</strong></div>
      </div>
    </div>`;

  const renderEditSettings = (d) => {
    const s = d.settings || {};
    return `<div class="card sm-section"><h4>إعدادات النظام</h4>
      <div class="sm-form-grid">
        ${field('اللغة', 'sm-e-lang', s.language || 'ar')}
        ${field('Timezone', 'sm-e-tz', s.timezone || 'Asia/Riyadh')}
        ${field('Data Retention (أيام)', 'sm-e-retain', s.dataRetentionDays || 365, { type: 'number' })}
        <label class="field" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="sm-e-notif" ${s.notifications ? 'checked' : ''} /> الإشعارات</label>
        <label class="field" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="sm-e-aud" ${s.auditEnabled ? 'checked' : ''} /> Audit Settings</label>
        <label class="field" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="sm-e-mfa" ${s.mfaRequired ? 'checked' : ''} /> الأمان · MFA</label>
      </div>
      <p class="muted">الإعدادات العامة · المستخدمون · الصلاحيات · الإشعارات · التكاملات · المزامنة · الأمان · الهوية · اللغة · Timezone · Data Retention · Audit</p>
    </div>`;
  };

  const renderEditPanel = (m, user) => {
    const sys = sysById(m, ui.systemId);
    const d = ui.draft;
    if (!sys || !d) return '';
    const nav = EDIT_TABS.map(
      (t) =>
        `<button type="button" class="btn btn-sm ${ui.editTab === t.id ? 'btn-dark' : 'btn-ghost'}" data-action="sm-edittab" data-etab="${esc(t.id)}"><i class="fas ${t.icon}"></i> ${esc(t.label)}</button>`
    ).join('');
    let body = '';
    if (ui.editTab === 'basic') body = renderEditBasic(m, d);
    else if (ui.editTab === 'company') body = renderEditCompany(m, d);
    else if (ui.editTab === 'users') body = renderUsersTable(sys, true);
    else if (ui.editTab === 'integrations') body = renderIntegrations(sys, user);
    else if (ui.editTab === 'settings') body = renderEditSettings(d);
    else body = renderAuditRows(sys.auditLog || []);
    return `<div class="sm-panel sm-edit-panel">
      <div class="sm-panel-head">
        <div>
          <h2 style="margin:0">تعديل النظام</h2>
          <div class="muted">${esc(sys.name)} · <code>${esc(sys.code || sys.id)}</code> · ${statusBadge(sys.status)}</div>
          ${ui.dirty ? '<span class="badge badge-red">تغييرات غير محفوظة</span>' : ''}
        </div>
        <button type="button" class="btn btn-ghost" data-action="sm-close-panel" title="إغلاق">✕</button>
      </div>
      <div class="toolbar" style="gap:4px;flex-wrap:wrap;margin:12px 0">${nav}</div>
      ${ui.saveError ? `<div class="sm-save-error">${esc(ui.saveError)} <button type="button" class="btn btn-sm btn-dark" data-action="sm-save">إعادة المحاولة</button></div>` : ''}
      <div class="sm-edit-body">${body}</div>
      <div class="sm-sticky-bar">
        <button type="button" class="btn btn-ghost" data-action="sm-close-panel" title="إلغاء">إلغاء</button>
        <button type="button" class="btn btn-primary" data-action="sm-save" title="حفظ التغييرات">حفظ التغييرات</button>
      </div>
    </div>`;
  };

  const modalShell = (title, body, footer) =>
    `<div class="sm-modal-overlay" data-action="sm-modal-close">
      <div class="card sm-modal" role="dialog" onclick="event.stopPropagation()">
        <div class="toolbar"><strong>${esc(title)}</strong><button type="button" class="btn btn-sm btn-ghost" data-action="sm-modal-close">✕</button></div>
        <div>${body}</div>
        <div class="toolbar" style="margin-top:12px;gap:8px;flex-wrap:wrap">${footer}</div>
      </div>
    </div>`;

  const renderWizard = (m) => {
    const w = ui.wizardData || {};
    const step = ui.wizardStep || 0;
    let body = '';
    if (step === 0) {
      body = `${field('اسم النظام *', 'sm-w-name', w.name, { required: true, help: 'الاسم الظاهر في المنصة' })}
        ${field('System Code *', 'sm-w-code', w.code, { help: 'رمز فريد للتكاملات' })}
        ${field('الوصف', 'sm-w-desc', w.description, { type: 'textarea' })}
        ${field('الفئة', 'sm-w-cat', w.category || 'تشغيل', { type: 'select', optionsHtml: (m.categories || []).map((c) => `<option ${w.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('') })}`;
    } else if (step === 1) {
      body = `${field('اسم الشركة *', 'sm-w-cname', w.companyName)}
        ${field('اسم الشركة EN', 'sm-w-cname-en', w.companyNameEn)}
        ${field('الهاتف', 'sm-w-phone', w.companyPhone)}
        ${field('البريد', 'sm-w-email', w.companyEmail)}`;
    } else if (step === 2) {
      body = `${field('الخطة', 'sm-w-plan', w.plan || 'Professional', { type: 'select', optionsHtml: (m.plans || []).map((p) => `<option ${w.plan === p ? 'selected' : ''}>${esc(p)}</option>`).join('') })}
        ${field('المقاعد', 'sm-w-seats', w.seatsAllowed || 25, { type: 'number' })}
        ${field('الحالة', 'sm-w-status', w.status || 'Active', { type: 'select', optionsHtml: STATUSES.map((s) => `<option value="${s}" ${w.status === s ? 'selected' : ''}>${esc(statusLabel(s))}</option>`).join('') })}`;
    } else if (step === 3) {
      body = `<p class="muted">يمكن إضافة المستخدمين لاحقاً من ملف النظام.</p>
        ${field('عدد المستخدمين المبدئي', 'sm-w-users', w.userCount || 1, { type: 'number' })}`;
    } else if (step === 4) {
      body = `<p class="muted">سيتم إنشاء تكاملات ERP/CRM افتراضية ويمكن ضبطها بعد الإنشاء.</p>`;
    } else {
      body = `<div class="card" style="padding:12px">
        <h4>راجع بيانات النظام</h4>
        <p>اسم النظام: <strong>${esc(w.name)}</strong></p>
        <p>الشركة: <strong>${esc(w.companyName)}</strong></p>
        <p>الخطة: <strong>${esc(w.plan || 'Professional')}</strong></p>
        <p>المستخدمون: <strong>${esc(w.userCount || 1)}</strong></p>
        <p>الحالة: <strong>${esc(statusLabel(w.status || 'Active'))}</strong></p>
      </div>`;
    }
    return modalShell(
      'إضافة نظام',
      `<div class="sm-steps">${ADD_STEPS.map((s, i) => `<span class="${i === step ? 'on' : ''}">${i + 1} ${esc(s)}</span>`).join('<span class="muted">→</span>')}</div>${body}`,
      `<button type="button" class="btn btn-ghost" data-action="sm-modal-close">إلغاء</button>
       ${step > 0 ? '<button type="button" class="btn btn-ghost" data-action="sm-wiz-prev">السابق</button>' : ''}
       ${step < 5 ? '<button type="button" class="btn btn-dark" data-action="sm-wiz-next">التالي</button>' : ''}
       <button type="button" class="btn btn-ghost" data-action="sm-wiz-save" data-draft="1">حفظ كمسودة</button>
       ${step === 5 ? '<button type="button" class="btn btn-primary" data-action="sm-wiz-save">إنشاء النظام</button>' : ''}`
    );
  };

  const captureWizard = () => {
    const w = { ...(ui.wizardData || {}) };
    const step = ui.wizardStep || 0;
    if (step === 0) {
      w.name = qVal('sm-w-name');
      w.code = qVal('sm-w-code');
      w.description = qVal('sm-w-desc');
      w.category = qVal('sm-w-cat');
    } else if (step === 1) {
      w.companyName = qVal('sm-w-cname');
      w.companyNameEn = qVal('sm-w-cname-en');
      w.companyPhone = qVal('sm-w-phone');
      w.companyEmail = qVal('sm-w-email');
    } else if (step === 2) {
      w.plan = qVal('sm-w-plan');
      w.seatsAllowed = Number(qVal('sm-w-seats') || 25);
      w.status = qVal('sm-w-status');
    } else if (step === 3) {
      w.userCount = Number(qVal('sm-w-users') || 1);
    }
    ui.wizardData = w;
    return w;
  };

  const renderImport = () => {
    const step = ui.importStep || 0;
    const stats = ui.importStats;
    let body = '';
    if (step === 0) {
      body = `<p class="muted">الصق CSV: name,code,category,companyName,plan</p>
        <textarea id="sm-import-raw" rows="8" style="width:100%"></textarea>
        <button type="button" class="btn btn-dark" style="margin-top:8px" data-action="sm-import-parse">معاينة</button>`;
    } else {
      body = `<p>سجلات: ${stats?.total || 0} · صحيح: ${stats?.ok || 0} · أخطاء: ${stats?.invalid || 0} · مكرر: ${stats?.dup || 0}</p>
        <button type="button" class="btn btn-primary" data-action="sm-import-run">استيراد</button>`;
    }
    return modalShell('استيراد أنظمة', body, `<button type="button" class="btn btn-ghost" data-action="sm-modal-close">إغلاق</button>`);
  };

  const renderConfirm = () => {
    if (!ui.confirm) return '';
    return modalShell(
      ui.confirm.title || 'تأكيد',
      `<p>${esc(ui.confirm.message || '')}</p>${ui.confirm.extra || ''}`,
      `<button type="button" class="btn btn-ghost" data-action="sm-confirm-no">${esc(ui.confirm.no || 'إلغاء')}</button>
       <button type="button" class="btn btn-primary" data-action="sm-confirm-yes">${esc(ui.confirm.yes || 'تأكيد')}</button>`
    );
  };

  const renderSensitiveConfirm = () => {
    const p = ui.pendingSensitive;
    if (!p) return '';
    const lines = p.changes
      .map(
        (c) =>
          `<div style="padding:8px 0;border-bottom:1px solid var(--border)"><strong>${esc(FIELD_AR[c.field] || c.field)}</strong><div>${esc(c.oldValue)} → <b>${esc(c.newValue)}</b></div></div>`
      )
      .join('');
    return modalShell(
      'تأكيد التغييرات الحساسة',
      `<p>سيتم تغيير:</p>${lines}`,
      `<button type="button" class="btn btn-ghost" data-action="sm-sensitive-cancel">إلغاء</button>
       <button type="button" class="btn btn-primary" data-action="sm-sensitive-ok">تأكيد وحفظ</button>`
    );
  };

  const renderSettingsTab = (m, user) => {
    if (!can(user, 'settings') && permLevel(user) !== 'admin' && permLevel(user) !== 'manager') {
      return '<div class="empty">ليست لديك صلاحية الإعدادات.</div>';
    }
    const s = m.settings || {};
    return `<article class="card">
      <h3>إعدادات سوق الأنظمة</h3>
      <p class="muted">الفئات · الخطط · حالات النظام · Default Permissions · Integration Types · Import · Notifications · Approval · Audit</p>
      <div class="sm-form-grid">
        ${field('الخطة الافتراضية', 'sm-set-plan', s.defaultPlan || 'Professional')}
        ${field('المقاعد الافتراضية', 'sm-set-seats', s.defaultSeats || 25, { type: 'number' })}
        ${field('حجم الصفحة', 'sm-set-ps', s.pageSize || 25, { type: 'number' })}
      </div>
      <p>الفئات: ${(m.categories || []).join(' · ')}</p>
      <p>الخطط: ${(m.plans || []).join(' · ')}</p>
      <button type="button" class="btn btn-primary" data-action="sm-settings-save">حفظ إعدادات السوق</button>
    </article>`;
  };

  const renderReports = (m) =>
    `<div class="grid-2">
      <article class="card"><h3>ملخص</h3>
        <ul style="line-height:1.9">
          <li>إجمالي: <strong>${m.totalSystems || 0}</strong></li>
          <li>نشط: <strong>${m.activeSystems || 0}</strong></li>
          <li>موقوف: <strong>${m.suspendedSystems || 0}</strong></li>
        </ul>
      </article>
      <article class="card"><h3>أحدث النشاط</h3>
        ${(m.activityLog || [])
          .slice(0, 10)
          .map((a) => `<div style="padding:6px 0;border-bottom:1px solid var(--border)"><strong>${esc(a.type)}</strong> · ${esc(a.text)} <span class="muted">${fmtTime(a.at)}</span></div>`)
          .join('') || '<div class="empty">لا نشاط</div>'}
      </article>
    </div>`;

  const renderModal = (m) => {
    if (ui.mode === 'wizard') return renderWizard(m);
    if (ui.mode === 'import') return renderImport();
    return '';
  };

  const doSave = (ctx, force = false) => {
    const toast = ctx.toast || (() => {});
    const act = actorName(ctx.user || {});
    const HS = store();
    captureEditFields();
    const d = ui.draft || {};
    ui.errors = {};
    ui.saveError = '';
    if (!String(d.name || '').trim()) {
      ui.errors.name = 'اسم النظام مطلوب';
      ui.saveError = 'تعذر حفظ التغييرات';
      toast('اسم النظام مطلوب');
      return true;
    }
    if (!String(d.companyName || '').trim()) {
      ui.errors.companyName = 'اسم الشركة مطلوب';
      ui.editTab = 'company';
      ui.saveError = 'تعذر حفظ التغييرات';
      toast('اسم الشركة مطلوب');
      return true;
    }
    if (!String(d.code || '').trim()) {
      ui.errors.code = 'رمز النظام مطلوب';
      ui.saveError = 'تعذر حفظ التغييرات';
      toast('رمز النظام مطلوب');
      return true;
    }
    const changes = [];
    Object.keys(d).forEach((k) => {
      if (k === 'settings') return;
      if (String((ui.baseline || {})[k] ?? '') !== String(d[k] ?? '')) {
        changes.push({ field: k, oldValue: (ui.baseline || {})[k], newValue: d[k] });
      }
    });
    const sensitive = changes.filter((c) => SENSITIVE.has(c.field));
    if (sensitive.length && !force) {
      ui.pendingSensitive = { changes: sensitive, all: changes };
      return true;
    }
    const res = HS.updateMarketSystem?.(ui.systemId, d, act);
    if (!res || res.error) {
      ui.saveError = res?.error || 'تعذر الاتصال بالخادم';
      if (res?.field) ui.errors[res.field] = res.error;
      toast(ui.saveError);
      return true;
    }
    ui.baseline = snapshot({ ...sysById(marketData(), ui.systemId), ...d });
    ui.draft = snapshot(sysById(marketData(), ui.systemId) || d);
    ui.dirty = false;
    ui.pendingSensitive = null;
    toast('تم حفظ تعديلات النظام بنجاح');
    return true;
  };

  const handle = (action, btn, ctx = {}) => {
    if (!action || !String(action).startsWith('sm-')) return false;
    const user = ctx.user || {};
    const toast = ctx.toast || (() => {});
    const act = actorName(user);
    const HS = store();
    if (!HS) {
      toast('HubStore غير متاح');
      return true;
    }
    const m = marketData();

    if (action === 'sm-tab') {
      ui.tab = btn.dataset.tab || 'list';
      ui.menuOpen = null;
      return true;
    }
    if (action === 'sm-help-open') {
      ui.helpOpen = true;
      return true;
    }
    if (action === 'sm-help-close') {
      ui.helpOpen = false;
      return true;
    }
    if (action === 'sm-help-dismiss') {
      HS.dismissMarketHelp?.();
      ui.helpOpen = false;
      return true;
    }
    if (action === 'sm-clear-filters') {
      ui.filters = { q: '', status: '', category: '', company: '', plan: '', source: '' };
      ui.page = 1;
      return true;
    }
    if (action === 'sm-page') {
      ui.page += btn.dataset.dir === 'prev' ? -1 : 1;
      return true;
    }
    if (action === 'sm-goto') {
      ui.page = Number(btn.dataset.page) || 1;
      return true;
    }
    if (action === 'sm-sort') {
      const key = btn.dataset.key;
      if (ui.sortKey === key) ui.sortDir = ui.sortDir === 'asc' ? 'desc' : 'asc';
      else {
        ui.sortKey = key;
        ui.sortDir = key === 'updatedAt' ? 'desc' : 'asc';
      }
      return true;
    }
    if (action === 'sm-menu') {
      ui.menuOpen = ui.menuOpen === btn.dataset.id ? null : btn.dataset.id;
      return true;
    }
    if (action === 'sm-view' || action === 'sm-view-tab') {
      const sys = sysById(m, btn.dataset.id);
      if (!sys) return true;
      openView(sys);
      if (btn.dataset.vtab) ui.viewTab = btn.dataset.vtab;
      return true;
    }
    if (action === 'sm-viewtab') {
      ui.viewTab = btn.dataset.vtab || 'overview';
      return true;
    }
    if (action === 'sm-edit') {
      const sys = sysById(m, btn.dataset.id || ui.systemId);
      if (!sys) return true;
      openEdit(sys);
      if (btn.dataset.etab) ui.editTab = btn.dataset.etab;
      return true;
    }
    if (action === 'sm-edittab') {
      captureEditFields();
      ui.editTab = btn.dataset.etab || 'basic';
      return true;
    }
    if (action === 'sm-close-panel') {
      requestClosePanel();
      return true;
    }
    if (action === 'sm-save') {
      return doSave(ctx, false);
    }
    if (action === 'sm-sensitive-ok') {
      ui.pendingSensitive = null;
      return doSave(ctx, true);
    }
    if (action === 'sm-sensitive-cancel') {
      ui.pendingSensitive = null;
      return true;
    }
    if (action === 'sm-confirm-yes') {
      ui.confirm?.run?.();
      ui.confirm = null;
      return true;
    }
    if (action === 'sm-confirm-no') {
      ui.confirm = null;
      return true;
    }
    if (action === 'sm-status') {
      const sys = sysById(m, btn.dataset.id);
      const next = btn.dataset.status;
      if (!sys) return true;
      const label = next === 'Suspended' ? 'إيقاف النظام' : next === 'Archived' ? 'أرشفة النظام' : 'تفعيل النظام';
      ui.confirm = {
        title: label,
        message:
          next === 'Suspended'
            ? `هل تريد إيقاف «${sys.name}»؟ سيتم منع المستخدمين من الوصول إليه.`
            : `تأكيد ${label}: ${sys.name}`,
        yes: label,
        no: 'إلغاء',
        run: () => {
          HS.setMarketSystemStatus?.(sys.id, next, act);
          toast(next === 'Suspended' ? 'تم إيقاف النظام' : next === 'Archived' ? 'تمت الأرشفة' : 'تم التفعيل');
        },
      };
      ui.menuOpen = null;
      return true;
    }
    if (action === 'sm-clone') {
      const copy = HS.cloneMarketSystem?.(btn.dataset.id, act);
      toast(copy ? `تم نسخ النظام: ${copy.name}` : 'تعذر النسخ');
      ui.menuOpen = null;
      return true;
    }
    if (action === 'sm-add') {
      ui.mode = 'wizard';
      ui.wizardStep = 0;
      ui.wizardData = { category: 'تشغيل', plan: 'Professional', status: 'Active', seatsAllowed: 25, userCount: 1 };
      return true;
    }
    if (action === 'sm-modal-close') {
      if (ui.mode === 'wizard' || ui.mode === 'import') ui.mode = null;
      return true;
    }
    if (action === 'sm-wiz-next') {
      const w = captureWizard();
      if (ui.wizardStep === 0 && !String(w.name || '').trim()) {
        toast('اسم النظام مطلوب');
        return true;
      }
      if (ui.wizardStep === 1 && !String(w.companyName || '').trim()) {
        toast('اسم الشركة مطلوب');
        return true;
      }
      ui.wizardStep = Math.min(5, (ui.wizardStep || 0) + 1);
      return true;
    }
    if (action === 'sm-wiz-prev') {
      captureWizard();
      ui.wizardStep = Math.max(0, (ui.wizardStep || 0) - 1);
      return true;
    }
    if (action === 'sm-wiz-save') {
      const w = captureWizard();
      if (!String(w.name || '').trim()) {
        toast('اسم النظام مطلوب');
        return true;
      }
      const draft = btn.dataset.draft === '1';
      const created = HS.addMarketSystem({ ...w, draft, status: draft ? 'Draft' : w.status || 'Active', source: 'Manual' }, act);
      if (!created) {
        toast('تعذر إنشاء النظام');
        return true;
      }
      ui.mode = null;
      openView(created);
      toast(draft ? 'حُفظت مسودة النظام' : 'تم إنشاء النظام');
      return true;
    }
    if (action === 'sm-import') {
      ui.mode = 'import';
      ui.importStep = 0;
      ui.importRows = [];
      return true;
    }
    if (action === 'sm-import-parse') {
      const raw = qVal('sm-import-raw');
      const lines = String(raw || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const rows = [];
      lines.forEach((line, idx) => {
        if (idx === 0 && /name/i.test(line)) return;
        const [name, code, category, companyName, plan] = line.split(/[,;\t]/);
        rows.push({ name: (name || '').trim(), code, category, companyName, plan });
      });
      const names = new Set(activeSystems(m).map((s) => s.name));
      let invalid = 0;
      let dup = 0;
      let ok = 0;
      rows.forEach((r) => {
        if (!r.name) {
          invalid += 1;
          r._ok = false;
        } else if (names.has(r.name)) {
          dup += 1;
          r._ok = false;
        } else {
          ok += 1;
          r._ok = true;
        }
      });
      ui.importRows = rows;
      ui.importStats = { total: rows.length, ok, invalid, dup };
      ui.importStep = 1;
      return true;
    }
    if (action === 'sm-import-run') {
      const good = (ui.importRows || []).filter((r) => r._ok);
      const res = HS.importMarketSystems?.(good, act);
      ui.mode = null;
      toast(`تم استيراد ${res?.created?.length || 0}`);
      return true;
    }
    if (action === 'sm-add-user') {
      const name = (typeof window !== 'undefined' && window.prompt('اسم المستخدم')) || '';
      if (!name) return true;
      const email = (typeof window !== 'undefined' && window.prompt('البريد', `${name.split(' ')[0]}@naiosh.local`)) || '';
      HS.addMarketSystemUser?.(btn.dataset.id, { name, email, role: 'Operator' }, act);
      toast('تمت إضافة المستخدم');
      return true;
    }
    if (action === 'sm-int-test') {
      const res = HS.testMarketIntegration?.(btn.dataset.sid, btn.dataset.iid, act);
      toast(res?.ok ? 'الاتصال ناجح' : res?.error || 'فشل الاختبار');
      return true;
    }
    if (action === 'sm-int-sync') {
      HS.syncMarketIntegration?.(btn.dataset.sid, btn.dataset.iid, act);
      toast('تمت المزامنة');
      return true;
    }
    if (action === 'sm-sync-registry') {
      HS.syncSystem?.(btn.dataset.id);
      toast('تمت مزامنة النظام');
      return true;
    }
    if (action === 'sm-settings-save') {
      HS.updateMarketSettings?.(
        {
          defaultPlan: qVal('sm-set-plan') || 'Professional',
          defaultSeats: Number(qVal('sm-set-seats') || 25),
          pageSize: Number(qVal('sm-set-ps') || 25),
        },
        act
      );
      ui.pageSize = Number(qVal('sm-set-ps') || ui.pageSize);
      toast('حُفظت إعدادات السوق');
      return true;
    }
    return false;
  };

  const handleChange = (el) => {
    const key = el.getAttribute('data-sm-change');
    if (!key) return false;
    if (key === 'q') {
      ui.filters.q = el.value;
      ui.page = 1;
      return true;
    }
    if (key === 'pageSize') {
      ui.pageSize = Number(el.value) || DEFAULT_PAGE_SIZE;
      ui.page = 1;
      return true;
    }
    if (['status', 'category', 'company', 'plan', 'source'].includes(key)) {
      ui.filters[key] = el.value;
      ui.page = 1;
      return true;
    }
    if (key === 'userQ') {
      ui.userQ = el.value;
      return true;
    }
    if (key === 'userRole') {
      ui.userRole = el.value;
      return true;
    }
    if (key === 'userStatus') {
      ui.userStatus = el.value;
      return true;
    }
    return false;
  };

  const render = (ctx = {}) => {
    const user = ctx.user || {};
    const m = marketData();
    if (m.settings?.pageSize && !ui._psInit) {
      ui.pageSize = m.settings.pageSize || DEFAULT_PAGE_SIZE;
      ui._psInit = true;
    }
    let body = '';
    if (ui.tab === 'categories') {
      body = `<article class="card"><h3>الفئات</h3><ul>${(m.categories || []).map((c) => `<li>${esc(c)}</li>`).join('')}</ul></article>`;
    } else if (ui.tab === 'reports') body = renderReports(m);
    else if (ui.tab === 'settings') body = renderSettingsTab(m, user);
    else if (ui.tab === 'audit') body = renderAuditRows(m.auditLog || []);
    else body = renderList(m, user);

    const panel =
      ui.mode === 'edit' ? renderEditPanel(m, user) : ui.mode === 'view' ? renderViewPanel(m, user) : '';

    return `<div class="hub-systems-market" dir="rtl" data-hub-systems-market>
      ${renderHeader(m, user)}
      ${renderHelp()}
      ${renderKpis(m)}
      ${renderTabs()}
      <div style="margin-top:12px">${body}</div>
      ${panel ? `<div class="sm-panel-backdrop" data-action="sm-close-panel"></div>${panel}` : ''}
      ${renderModal(m)}
      ${renderConfirm()}
      ${renderSensitiveConfirm()}
    </div>`;
  };

  window.HubSystemsMarket = { render, handle, handleChange, ui };
})();
