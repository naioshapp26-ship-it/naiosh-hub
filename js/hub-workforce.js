/**
 * NAIOSH HUB 360 — وحدة القوى العاملة (Workforce Management Workspace)
 * موظفين أولاً · بحث/فلاتر · Pagination · ملف موظف · مكافآت · مزامنة · تدقيق
 */
(() => {
  'use strict';

  const PAGE_SIZES = [10, 25, 50, 100];
  const DEFAULT_PAGE_SIZE = 25;
  const TABS = [
    { id: 'employees', label: 'الموظفون', icon: 'fa-users' },
    { id: 'rewards', label: 'المكافآت والتقدير', icon: 'fa-gift' },
    { id: 'reports', label: 'التقارير والنشاط', icon: 'fa-chart-line' },
    { id: 'sync', label: 'المزامنة', icon: 'fa-sync' },
    { id: 'audit', label: 'سجل العمليات', icon: 'fa-clock-rotate-left' },
    { id: 'settings', label: 'الإعدادات', icon: 'fa-gear' },
  ];
  const DRAWER_TABS = [
    { id: 'overview', label: 'نظرة عامة', icon: 'fa-gauge' },
    { id: 'work', label: 'بيانات العمل', icon: 'fa-briefcase' },
    { id: 'attendance', label: 'الحضور', icon: 'fa-user-check' },
    { id: 'performance', label: 'الأداء', icon: 'fa-chart-simple' },
    { id: 'tasks', label: 'المهام', icon: 'fa-list-check' },
    { id: 'points', label: 'النقاط', icon: 'fa-coins' },
    { id: 'rewards', label: 'المكافآت', icon: 'fa-gift' },
    { id: 'docs', label: 'المستندات', icon: 'fa-folder' },
    { id: 'activity', label: 'سجل النشاط', icon: 'fa-clock' },
  ];
  const ADD_STEPS = ['البيانات الشخصية', 'بيانات العمل', 'إعدادات النظام'];
  const REWARD_STEPS = ['اختر الموظف', 'نوع المكافأة', 'القيمة', 'السبب', 'المصدر', 'الموافقة'];
  const REWARD_TYPES = ['نقاط', 'مكافأة مالية', 'شهادة تقدير', 'Badge', 'يوم إجازة', 'هدية', 'أخرى'];
  const REWARD_SOURCES = ['Performance', 'Achievement', 'Manager', 'Campaign', 'Automation', 'Manual', 'Points System'];
  const SOURCE_AR = {
    'HR System': 'نظام الموارد البشرية',
    Manual: 'إدخال يدوي',
    'Excel Import': 'استيراد Excel',
    API: 'API',
    Integration: 'تكامل',
    Performance: 'الأداء',
    Achievement: 'إنجاز',
    Manager: 'ترشيح مدير',
    Campaign: 'حملة',
    Automation: 'أتمتة',
    'Points System': 'نظام النقاط',
  };

  const ui = {
    tab: 'employees',
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: 'name_asc',
    sortDir: 'asc',
    sortKey: 'name',
    filters: {
      q: '',
      department: '',
      section: '',
      title: '',
      status: '',
      workType: '',
      location: '',
      performance: '',
      view: 'all',
    },
    selected: {},
    drawer: null,
    drawerTab: 'overview',
    modal: null,
    wizardStep: 0,
    wizardData: {},
    rewardStep: 0,
    rewardData: {},
    importStep: 0,
    importRows: [],
    importStats: null,
    confirm: null,
    menuOpen: null,
    helpOpen: false,
    kpiFocus: '',
    scrollRestore: 0,
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

  const bar = (pct) => {
    const n = Math.max(0, Math.min(100, Number(pct) || 0));
    return `<div class="bar" aria-hidden="true"><i style="width:${n}%"></i></div>`;
  };

  const store = () => window.HubStore;
  const wfData = () => {
    store()?.recomputeWorkforceKpis?.();
    return store()?.get?.()?.workforce || { employees: [], rewards: [], auditLog: [], settings: {} };
  };

  const actorName = (user) => user?.name || user?.email || user?.displayName || 'مشغّل هوب';

  const permLevel = (user) => {
    const role = String(user?.role || '').toLowerCase();
    if (['supreme_leader', 'admin'].includes(role)) return 'hr_admin';
    if (['chief_engineer', 'hr_manager'].includes(role)) return 'hr_manager';
    if (['manager', 'dept_manager'].includes(role)) return 'dept_manager';
    if (['line_manager'].includes(role)) return 'line_manager';
    if (['auditor', 'audit'].includes(role)) return 'auditor';
    if (['employee', 'user', 'customer', 'client'].includes(role)) return 'employee';
    return 'hr_admin';
  };

  const can = (user, action) => {
    const p = permLevel(user);
    if (p === 'hr_admin') return true;
    if (p === 'auditor') return ['view', 'report', 'audit'].includes(action);
    if (p === 'employee') return action === 'view';
    if (p === 'line_manager' || p === 'dept_manager') {
      return ['view', 'reward', 'edit', 'task', 'notify', 'report'].includes(action);
    }
    if (p === 'hr_manager') return action !== 'settings' || true;
    return true;
  };

  const statusLabel = (s) =>
    ({ active: 'نشط', inactive: 'غير نشط', warning: 'يحتاج متابعة', critical: 'حرج', leave: 'إجازة', draft: 'مسودة' }[s] || s);
  const statusBadge = (s) => {
    const map = {
      active: 'badge-black',
      inactive: 'badge-gray',
      warning: 'badge-red',
      critical: 'badge-red',
      leave: 'badge-outline',
      draft: 'badge-outline',
    };
    return `<span class="badge ${map[s] || 'badge-outline'}">${esc(statusLabel(s))}</span>`;
  };

  const sourceLabel = (s) => SOURCE_AR[s] || s || '—';

  const initials = (name) => {
    const p = String(name || '').trim().split(/\s+/);
    return esc(((p[0] || '?')[0] || '') + ((p[1] || '')[0] || '')).toUpperCase();
  };

  const avatarHtml = (e) => {
    if (e.avatar) return `<img class="wf-avatar" src="${esc(e.avatar)}" alt="" />`;
    return `<span class="wf-avatar wf-avatar-fallback" aria-hidden="true">${initials(e.name)}</span>`;
  };

  const unique = (arr) => [...new Set(arr.filter(Boolean))];

  const activeEmployees = (wf) => (wf.employees || []).filter((e) => !e.archived);

  const applyView = (e, view) => {
    switch (view) {
      case 'remote':
        return e.workType === 'عن بعد';
      case 'office':
        return e.workType === 'بالمكتب';
      case 'leave':
        return e.status === 'leave';
      case 'high':
        return (e.productivity || 0) >= 85;
      case 'follow':
        return e.status === 'warning' || e.status === 'critical';
      case 'new':
        return e.createdAt && Date.now() - new Date(e.createdAt).getTime() < 30 * 86400000;
      case 'team':
        return true;
      default:
        return true;
    }
  };

  const filterEmployees = (wf) => {
    const f = ui.filters;
    return activeEmployees(wf).filter((e) => {
      if (!applyView(e, f.view)) return false;
      if (f.department && e.department !== f.department) return false;
      if (f.section && e.section !== f.section) return false;
      if (f.title && e.title !== f.title && e.role !== f.title) return false;
      if (f.status && e.status !== f.status) return false;
      if (f.workType && e.workType !== f.workType) return false;
      if (f.location && e.location !== f.location) return false;
      if (f.performance === 'high' && (e.productivity || 0) < 85) return false;
      if (f.performance === 'low' && (e.productivity || 0) >= 70) return false;
      if (f.performance === 'mid' && ((e.productivity || 0) < 70 || (e.productivity || 0) >= 85)) return false;
      if (ui.kpiFocus === 'active' && e.status !== 'active') return false;
      if (ui.kpiFocus === 'remote' && e.workType !== 'عن بعد') return false;
      if (ui.kpiFocus === 'office' && e.workType !== 'بالمكتب') return false;
      if (ui.kpiFocus === 'leave' && e.status !== 'leave') return false;
      if (ui.kpiFocus === 'follow' && e.status !== 'warning' && e.status !== 'critical') return false;
      if (f.q) {
        const hay = `${e.id} ${e.name} ${e.email} ${e.title} ${e.role} ${e.department} ${e.section} ${e.manager}`.toLowerCase();
        if (!hay.includes(String(f.q).toLowerCase())) return false;
      }
      return true;
    });
  };

  const sortEmployees = (list) => {
    const key = ui.sortKey || 'name';
    const dir = ui.sortDir === 'desc' ? -1 : 1;
    return [...list].sort((a, b) => {
      const av = a[key] ?? '';
      const bv = b[key] ?? '';
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

  const selectedIds = () => Object.keys(ui.selected).filter((id) => ui.selected[id]);

  const perfFormula = (wf) => {
    const w = wf.settings?.performanceWeights || { goals: 40, tasks: 30, attendance: 20, manager: 10 };
    return `${w.goals}% أهداف · ${w.tasks}% مهام · ${w.attendance}% حضور · ${w.manager}% تقييم المدير`;
  };

  const qVal = (id) => {
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (!el) return '';
    return el.type === 'checkbox' ? el.checked : el.value;
  };

  const renderHeader = (wf, user) => {
    const role = permLevel(user);
    const roleLabel = {
      hr_admin: 'HR Admin',
      hr_manager: 'HR Manager',
      dept_manager: 'مدير إدارة',
      line_manager: 'مدير مباشر',
      auditor: 'مدقق · قراءة فقط',
      employee: 'موظف',
    }[role];
    return `<div class="toolbar wf-header" style="flex-wrap:wrap;gap:8px">
      <div style="display:flex;flex-wrap:wrap;gap:8px;flex:1">
        ${can(user, 'edit') ? `<button type="button" class="btn btn-primary" data-action="wf-modal" data-modal="add"><i class="fas fa-plus"></i> إضافة موظف</button>` : ''}
        ${can(user, 'import') || can(user, 'edit') ? `<button type="button" class="btn btn-dark" data-action="wf-modal" data-modal="import"><i class="fas fa-file-import"></i> استيراد موظفين</button>` : ''}
        ${can(user, 'sync') || can(user, 'edit') ? `<button type="button" class="btn btn-ghost" data-action="wf-tab" data-tab="sync"><i class="fas fa-sync"></i> مزامنة الموظفين</button>` : ''}
        <button type="button" class="btn btn-ghost" data-action="wf-tab" data-tab="rewards"><i class="fas fa-gift"></i> المكافآت</button>
        <button type="button" class="btn btn-ghost" data-action="wf-tab" data-tab="reports"><i class="fas fa-chart-line"></i> التقارير</button>
        ${can(user, 'settings') || role === 'hr_admin' || role === 'hr_manager' ? `<button type="button" class="btn btn-ghost" data-action="wf-tab" data-tab="settings"><i class="fas fa-gear"></i> الإعدادات</button>` : ''}
        <button type="button" class="btn btn-ghost" data-action="wf-help-open"><i class="fas fa-circle-question"></i> دليل الاستخدام</button>
        <button type="button" class="btn btn-ghost" data-action="wf-tick" title="تحديث الإنتاجية"><i class="fas fa-heartbeat"></i></button>
      </div>
      <span class="badge badge-outline">${esc(roleLabel)} · ${wf.totalEmployees || 0} موظف</span>
    </div>`;
  };

  const renderHelp = (wf) => {
    if (!ui.helpOpen && wf.helpDismissed) return '';
    if (!ui.helpOpen && !wf.helpDismissed) {
      /* show compact strip until dismissed or opened */
    }
    if (!ui.helpOpen) return '';
    return `<article class="card wf-help">
      <div class="toolbar">
        <strong><i class="fas fa-circle-question icon"></i> كيف أستخدم القوى العاملة؟</strong>
        <div>
          <button type="button" class="btn btn-sm btn-ghost" data-action="wf-help-dismiss">إخفاء</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="wf-help-close">✕</button>
        </div>
      </div>
      <p style="margin:0 0 8px;color:var(--muted)">من هنا يمكنك البحث عن الموظفين وإدارة ملفاتهم ومتابعة الأداء ومنح المكافآت.</p>
      <ol style="margin:0;padding-inline-start:1.2rem;line-height:1.8">
        <li>ابحث عن الموظف.</li>
        <li>افتح ملفه.</li>
        <li>اختر العملية المطلوبة.</li>
        <li>يتم تسجيل كل تغيير تلقائياً.</li>
      </ol>
      <p style="margin:12px 0 4px;font-weight:700">للمكافأة:</p>
      <ol style="margin:0;padding-inline-start:1.2rem;line-height:1.8">
        <li>اختر الموظف واضغط «منح مكافأة».</li>
        <li>اختر النوع والقيمة والسبب والمصدر.</li>
        <li>أرسلها للاعتماد إن كان مطلوباً.</li>
        <li>تظهر في سجل الموظف بعد الاعتماد.</li>
      </ol>
    </article>`;
  };

  const renderKpis = (wf) => {
    const items = [
      { key: 'total', label: 'إجمالي الموظفين', value: wf.totalEmployees ?? 0, focus: '' },
      { key: 'active', label: 'الموظفون النشطون', value: wf.activeEmployees ?? 0, focus: 'active' },
      { key: 'remote', label: 'عن بعد', value: wf.remoteEmployees ?? 0, focus: 'remote' },
      { key: 'office', label: 'بالمكتب', value: wf.officeEmployees ?? 0, focus: 'office' },
      { key: 'leave', label: 'في إجازة', value: wf.onLeave ?? 0, focus: 'leave' },
      { key: 'follow', label: 'يحتاجون متابعة', value: wf.needsFollowUp ?? 0, focus: 'follow' },
      { key: 'rewards', label: 'مكافآت هذا الشهر', value: wf.rewardsThisMonth ?? 0, focus: 'rewards', tab: 'rewards' },
    ];
    return `<div class="kpis wf-kpis" style="margin:12px 0">
      ${items
        .map(
          (k) => `<article class="kpi ${ui.kpiFocus === k.focus && k.focus ? 'is-focus' : ''}" data-action="wf-kpi" data-focus="${esc(k.focus)}" data-tab="${esc(k.tab || 'employees')}" role="button" tabindex="0">
            <span class="kpi-label">${esc(k.label)}</span>
            <strong class="kpi-value">${esc(k.value)}</strong>
          </article>`
        )
        .join('')}
    </div>`;
  };

  const renderTabs = () =>
    `<div class="tabs" role="tablist">${TABS.map(
      (t) =>
        `<button type="button" class="tab ${ui.tab === t.id ? 'active' : ''}" data-action="wf-tab" data-tab="${esc(t.id)}" role="tab"><i class="fas ${t.icon}"></i> ${esc(t.label)}</button>`
    ).join('')}</div>`;

  const renderViews = (wf) => {
    const views = wf.savedViews || [];
    return `<div class="toolbar" style="gap:6px;flex-wrap:wrap;margin-bottom:8px">
      ${views
        .map(
          (v) =>
            `<button type="button" class="btn btn-sm ${ui.filters.view === v.id ? 'btn-dark' : 'btn-ghost'}" data-action="wf-view" data-view="${esc(v.id)}">${esc(v.name)}</button>`
        )
        .join('')}
      <button type="button" class="btn btn-sm btn-ghost" data-action="wf-save-view"><i class="fas fa-bookmark"></i> حفظ العرض</button>
    </div>`;
  };

  const renderFilters = (wf) => {
    const emps = activeEmployees(wf);
    const depts = unique(emps.map((e) => e.department));
    const sections = unique(emps.map((e) => e.section));
    const titles = unique(emps.map((e) => e.title || e.role));
    const locations = unique(emps.map((e) => e.location));
    const f = ui.filters;
    const opt = (list, cur) =>
      `<option value="">الكل</option>${list.map((x) => `<option value="${esc(x)}" ${cur === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}`;
    return `<div class="wf-filters card" style="padding:12px;margin-bottom:12px">
      <div class="toolbar" style="gap:8px;flex-wrap:wrap;align-items:flex-end">
        <label class="field" style="flex:1;min-width:200px"><span>البحث عن موظف...</span>
          <input id="wf-q" type="search" placeholder="🔍 الاسم · الرقم · البريد · الإدارة" value="${esc(f.q)}" data-wf-change="q" />
        </label>
        <label class="field"><span>الإدارة</span><select id="wf-f-dept" data-wf-change="department">${opt(depts, f.department)}</select></label>
        <label class="field"><span>القسم</span><select id="wf-f-sec" data-wf-change="section">${opt(sections, f.section)}</select></label>
        <label class="field"><span>الوظيفة</span><select id="wf-f-title" data-wf-change="title">${opt(titles, f.title)}</select></label>
        <label class="field"><span>حالة العمل</span><select id="wf-f-status" data-wf-change="status">
          <option value="">الكل</option>
          ${['active', 'inactive', 'warning', 'critical', 'leave', 'draft']
            .map((s) => `<option value="${s}" ${f.status === s ? 'selected' : ''}>${esc(statusLabel(s))}</option>`)
            .join('')}
        </select></label>
        <label class="field"><span>موقع العمل</span><select id="wf-f-wt" data-wf-change="workType">
          <option value="">الكل</option>
          ${['عن بعد', 'بالمكتب', 'هجين'].map((x) => `<option value="${esc(x)}" ${f.workType === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}
        </select></label>
        <label class="field"><span>الموقع</span><select id="wf-f-loc" data-wf-change="location">${opt(locations, f.location)}</select></label>
        <label class="field"><span>الأداء</span><select id="wf-f-perf" data-wf-change="performance">
          <option value="">الكل</option>
          <option value="high" ${f.performance === 'high' ? 'selected' : ''}>مرتفع</option>
          <option value="mid" ${f.performance === 'mid' ? 'selected' : ''}>متوسط</option>
          <option value="low" ${f.performance === 'low' ? 'selected' : ''}>منخفض</option>
        </select></label>
        <button type="button" class="btn btn-ghost" data-action="wf-clear-filters">مسح الفلاتر</button>
      </div>
    </div>`;
  };

  const renderBulkBar = (user) => {
    const n = selectedIds().length;
    if (!n) return '';
    return `<div class="toolbar wf-bulk card" style="padding:10px;margin-bottom:10px;background:#fff8f8">
      <strong>تم اختيار ${n} موظفاً</strong>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        <button type="button" class="btn btn-sm btn-dark" data-action="wf-bulk" data-bulk="notify">إرسال إشعار</button>
        <button type="button" class="btn btn-sm btn-dark" data-action="wf-bulk" data-bulk="task">تعيين مهمة</button>
        <button type="button" class="btn btn-sm btn-dark" data-action="wf-bulk" data-bulk="dept">تغيير إدارة</button>
        <button type="button" class="btn btn-sm btn-dark" data-action="wf-bulk" data-bulk="export">تصدير</button>
        <button type="button" class="btn btn-sm btn-dark" data-action="wf-bulk" data-bulk="tag">إضافة Tag</button>
        <button type="button" class="btn btn-sm btn-ghost" data-action="wf-bulk-clear">إلغاء التحديد</button>
      </div>
    </div>`;
  };

  const renderRowMenu = (e, user) => {
    if (ui.menuOpen !== e.id) return '';
    const toggleLabel = e.status === 'inactive' ? 'تفعيل' : 'إيقاف';
    return `<div class="wf-row-menu">
      ${can(user, 'edit') ? `<button type="button" data-action="wf-edit" data-id="${esc(e.id)}">تعديل</button>` : ''}
      <button type="button" data-action="wf-drawer" data-id="${esc(e.id)}" data-dtab="attendance">الحضور</button>
      <button type="button" data-action="wf-drawer" data-id="${esc(e.id)}" data-dtab="performance">الأداء</button>
      <button type="button" data-action="wf-drawer" data-id="${esc(e.id)}" data-dtab="points">النقاط</button>
      <button type="button" data-action="wf-drawer" data-id="${esc(e.id)}" data-dtab="tasks">المهام</button>
      <button type="button" data-action="wf-drawer" data-id="${esc(e.id)}" data-dtab="rewards">المكافآت</button>
      <button type="button" data-action="wf-drawer" data-id="${esc(e.id)}" data-dtab="docs">المستندات</button>
      <button type="button" data-action="wf-drawer" data-id="${esc(e.id)}" data-dtab="activity">سجل النشاط</button>
      ${can(user, 'edit') ? `<button type="button" data-action="wf-toggle-status" data-id="${esc(e.id)}">${toggleLabel}</button>` : ''}
    </div>`;
  };

  const sortBtn = (key, label) => {
    const active = ui.sortKey === key;
    const arrow = active ? (ui.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<button type="button" class="wf-sort" data-action="wf-sort" data-key="${esc(key)}">${esc(label)}${arrow}</button>`;
  };

  const renderTable = (wf, user, page) => {
    if (!page.total) {
      return `<div class="empty wf-empty">
        <p>لا يوجد موظفون مسجلون.</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <button type="button" class="btn btn-primary" data-action="wf-modal" data-modal="add">+ إضافة موظف</button>
          <button type="button" class="btn btn-dark" data-action="wf-modal" data-modal="import">استيراد Excel</button>
          <button type="button" class="btn btn-ghost" data-action="wf-tab" data-tab="sync">ربط نظام HR</button>
        </div>
      </div>`;
    }
    const rows = page.rows
      .map((e) => {
        const checked = ui.selected[e.id] ? 'checked' : '';
        return `<tr data-id="${esc(e.id)}">
          <td class="wf-check"><input type="checkbox" data-wf-change="sel" data-id="${esc(e.id)}" ${checked} /></td>
          <td class="wf-sticky-name">
            <div class="wf-name-cell">
              ${avatarHtml(e)}
              <div>
                <button type="button" class="wf-name-link" data-action="wf-drawer" data-id="${esc(e.id)}">${esc(e.name)}</button>
                <small>${esc(e.email || '')}</small>
              </div>
            </div>
          </td>
          <td><code>${esc(e.id)}</code></td>
          <td>${esc(e.title || e.role || '—')}</td>
          <td>${esc(e.department || '—')}</td>
          <td>${esc(e.section || '—')}</td>
          <td>${esc(e.manager || '—')}</td>
          <td>${esc(e.workType || '—')}</td>
          <td>${esc(e.location || '—')}</td>
          <td>${esc(e.attendance || '—')}</td>
          <td><span class="wf-perf">${e.productivity ?? 0}%</span> ${bar(e.productivity)}</td>
          <td>${e.points ?? 0}</td>
          <td>${statusBadge(e.status)}</td>
          <td>${fmtTime(e.lastActivity)}</td>
          <td class="wf-sticky-actions">
            <div class="wf-actions">
              <button type="button" class="btn btn-sm btn-ghost" data-action="wf-drawer" data-id="${esc(e.id)}">عرض</button>
              ${can(user, 'reward') ? `<button type="button" class="btn btn-sm btn-primary" data-action="wf-reward-open" data-id="${esc(e.id)}">مكافأة</button>` : ''}
              <button type="button" class="btn btn-sm btn-ghost wf-more" data-action="wf-menu" data-id="${esc(e.id)}">⋮</button>
              ${renderRowMenu(e, user)}
            </div>
          </td>
        </tr>`;
      })
      .join('');

    const cards = page.rows
      .map(
        (e) => `<article class="wf-card card">
        <div class="wf-name-cell">${avatarHtml(e)}
          <div>
            <button type="button" class="wf-name-link" data-action="wf-drawer" data-id="${esc(e.id)}">${esc(e.name)}</button>
            <div>${esc(e.title || '')} · ${esc(e.department || '')}</div>
            ${statusBadge(e.status)}
          </div>
        </div>
        <div class="wf-actions" style="margin-top:8px">
          <button type="button" class="btn btn-sm btn-ghost" data-action="wf-drawer" data-id="${esc(e.id)}">عرض</button>
          ${can(user, 'reward') ? `<button type="button" class="btn btn-sm btn-primary" data-action="wf-reward-open" data-id="${esc(e.id)}">مكافأة</button>` : ''}
          <button type="button" class="btn btn-sm btn-ghost" data-action="wf-menu" data-id="${esc(e.id)}">⋮</button>
        </div>
      </article>`
      )
      .join('');

    return `
      <div class="wf-table-wrap table-wrap">
        <table class="data wf-table">
          <thead>
            <tr>
              <th class="wf-check"><input type="checkbox" data-wf-change="sel-all" title="تحديد الكل" /></th>
              <th class="wf-sticky-name">${sortBtn('name', 'الاسم')}</th>
              <th>${sortBtn('id', 'Employee ID')}</th>
              <th>${sortBtn('title', 'المسمى')}</th>
              <th>${sortBtn('department', 'الإدارة')}</th>
              <th>${sortBtn('section', 'القسم')}</th>
              <th>${sortBtn('manager', 'المدير')}</th>
              <th>${sortBtn('workType', 'نوع العمل')}</th>
              <th>${sortBtn('location', 'الموقع')}</th>
              <th>الحضور</th>
              <th>${sortBtn('productivity', 'الأداء')}</th>
              <th>${sortBtn('points', 'النقاط')}</th>
              <th>${sortBtn('status', 'الحالة')}</th>
              <th>${sortBtn('lastActivity', 'آخر نشاط')}</th>
              <th class="wf-sticky-actions">الإجراءات</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="wf-cards">${cards}</div>`;
  };

  const renderPagination = (page) => {
    if (!page.total) return '';
    const nums = [];
    const max = page.pages;
    let start = Math.max(1, ui.page - 2);
    let end = Math.min(max, start + 4);
    start = Math.max(1, end - 4);
    for (let i = start; i <= end; i++) nums.push(i);
    return `<div class="toolbar wf-pagination" style="justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:12px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <label class="field" style="margin:0">عرض
          <select id="wf-page-size" data-wf-change="pageSize">
            ${PAGE_SIZES.map((n) => `<option value="${n}" ${ui.pageSize === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
          موظف في الصفحة
        </label>
        <span class="muted">عرض ${page.start + 1} - ${page.end} من أصل ${page.total} موظف</span>
      </div>
      <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
        <button type="button" class="btn btn-sm btn-ghost" data-action="wf-page" data-dir="prev" ${ui.page <= 1 ? 'disabled' : ''}>السابق</button>
        ${nums
          .map(
            (n) =>
              `<button type="button" class="btn btn-sm ${n === ui.page ? 'btn-dark' : 'btn-ghost'}" data-action="wf-goto" data-page="${n}">${n}</button>`
          )
          .join('')}
        ${end < max ? `<span>…</span><button type="button" class="btn btn-sm btn-ghost" data-action="wf-goto" data-page="${max}">${max}</button>` : ''}
        <button type="button" class="btn btn-sm btn-ghost" data-action="wf-page" data-dir="next" ${ui.page >= max ? 'disabled' : ''}>التالي</button>
      </div>
    </div>`;
  };

  const renderInsights = (wf, filtered) => {
    const remote = filtered.filter((e) => e.workType === 'عن بعد').length;
    const avg =
      filtered.length > 0
        ? Math.round(filtered.reduce((s, e) => s + (Number(e.productivity) || 0), 0) / filtered.length)
        : 0;
    return `<article class="card" style="margin-top:16px">
      <h3><span class="title-left"><i class="fas fa-lightbulb icon"></i> رؤى القوى العاملة</span></h3>
      <div class="grid-3">
        <div><div class="muted">متوسط الأداء (النتائج الحالية)</div><strong>${avg}%</strong></div>
        <div><div class="muted">نسبة العمل عن بعد</div><strong>${filtered.length ? Math.round((remote / filtered.length) * 100) : 0}%</strong></div>
        <div><div class="muted">معادلة الأداء</div><strong style="font-size:13px">${esc(perfFormula(wf))}</strong></div>
      </div>
    </article>`;
  };

  const renderRewardsPanel = (wf, user) => {
    const monthRewards = (wf.rewards || []).filter((r) => {
      const d = new Date(r.at || 0);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const pending = (wf.rewards || []).filter((r) => r.status === 'Pending Approval');
    const people = unique(monthRewards.map((r) => r.employeeId || r.employee)).length;
    const pts = monthRewards.reduce((s, r) => s + (Number(r.points) || 0), 0);
    const list = (wf.rewards || []).slice(0, ui.tab === 'rewards' ? 40 : 5);
    if (!list.length && ui.tab === 'rewards') {
      return `<div class="empty">لم يتم منح مكافآت حتى الآن.
        ${can(user, 'reward') ? `<div style="margin-top:8px"><button type="button" class="btn btn-primary" data-action="wf-reward-open">+ منح أول مكافأة</button></div>` : ''}
      </div>`;
    }
    return `
      <div class="kpis" style="margin-bottom:12px">
        <article class="kpi"><span class="kpi-label">مكافآت هذا الشهر</span><strong>${monthRewards.length}</strong></article>
        <article class="kpi"><span class="kpi-label">موظفون حصلوا على مكافأة</span><strong>${people}</strong></article>
        <article class="kpi"><span class="kpi-label">إجمالي النقاط</span><strong>${pts}</strong></article>
        <article class="kpi"><span class="kpi-label">بانتظار الاعتماد</span><strong>${pending.length}</strong></article>
      </div>
      ${can(user, 'reward') ? `<div class="toolbar"><button type="button" class="btn btn-primary" data-action="wf-reward-open"><i class="fas fa-plus"></i> منح مكافأة</button></div>` : ''}
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Reward ID</th><th>الموظف</th><th>النوع</th><th>القيمة</th><th>السبب</th><th>المصدر</th><th>رشّح</th><th>منح</th><th>اعتمد</th><th>التاريخ</th><th>الحالة</th><th></th></tr></thead>
        <tbody>
          ${list
            .map(
              (r) => `<tr>
              <td><code>${esc(r.id)}</code></td>
              <td>${esc(r.employee)}</td>
              <td>${esc(r.type)}</td>
              <td>${esc(r.value)} ${r.points ? `(${r.points} نقطة)` : ''}</td>
              <td>${esc(r.reason)}</td>
              <td><span class="badge badge-outline">${esc(sourceLabel(r.source))}</span></td>
              <td>${esc(r.nominatedBy || '—')}</td>
              <td>${esc(r.grantedBy || '—')}</td>
              <td>${esc(r.approvedBy || '—')}</td>
              <td>${fmtTime(r.at)}</td>
              <td>${esc(r.status)}</td>
              <td>${
                r.status === 'Pending Approval' && can(user, 'reward')
                  ? `<button class="btn btn-sm btn-primary" data-action="wf-reward-decide" data-id="${esc(r.id)}" data-decision="approve">اعتماد</button>
                     <button class="btn btn-sm btn-ghost" data-action="wf-reward-decide" data-id="${esc(r.id)}" data-decision="reject">رفض</button>`
                  : ''
              }</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table></div>`;
  };

  const renderSync = (wf, user) => {
    const conn = (wf.connections || [])[0];
    return `<article class="card">
      <h3><span class="title-left"><i class="fas fa-plug icon"></i> Connections — HR System</span></h3>
      ${
        conn
          ? `<div class="grid-2">
        <div>
          <div class="muted">النظام</div><strong>${esc(conn.system)}</strong>
          <div class="muted" style="margin-top:8px">الحالة</div>${statusBadge(conn.status === 'Connected' ? 'active' : 'warning')}
          <div class="muted" style="margin-top:8px">آخر مزامنة</div>${fmtTime(conn.lastSync)}
          <div class="muted" style="margin-top:8px">المزامنة التالية</div>${fmtTime(conn.nextSync)}
          <div class="muted" style="margin-top:8px">موظفون مزامَنون</div><strong>${conn.syncedCount ?? 0}</strong>
          <div class="muted" style="margin-top:8px">أخطاء</div><strong>${conn.errors ?? 0}</strong>
        </div>
        <div class="toolbar" style="flex-direction:column;align-items:stretch">
          <button type="button" class="btn btn-dark" data-action="wf-sync-test">Test Connection</button>
          <button type="button" class="btn btn-primary" data-action="wf-sync-now">Sync Now</button>
          <button type="button" class="btn btn-ghost" data-action="wf-tab" data-tab="audit">View Logs</button>
          <button type="button" class="btn btn-ghost" data-action="wf-tab" data-tab="settings">Configure</button>
        </div>
      </div>`
          : '<div class="empty">لا يوجد اتصال HR مُعرّف.</div>'
      }
    </article>`;
  };

  const renderAudit = (wf) => {
    const rows = (wf.auditLog || []).slice(0, 80);
    return `<div class="table-wrap"><table class="data">
      <thead><tr><th>رقم العملية</th><th>المستخدم</th><th>الإجراء</th><th>الموظف</th><th>القيمة القديمة</th><th>الجديدة</th><th>المصدر</th><th>الوقت</th></tr></thead>
      <tbody>${
        rows.length
          ? rows
              .map(
                (a) => `<tr>
            <td><code>${esc(a.id)}</code></td>
            <td>${esc(a.user)}</td>
            <td>${esc(a.action)}</td>
            <td>${esc(a.employee || a.employeeId || '—')}</td>
            <td>${esc(a.oldValue || '—')}</td>
            <td>${esc(a.newValue || '—')}</td>
            <td>${esc(a.source || '—')}</td>
            <td>${fmtTime(a.at)}</td>
          </tr>`
              )
              .join('')
          : '<tr><td colspan="8" class="empty">لا عمليات بعد</td></tr>'
      }</tbody>
    </table></div>`;
  };

  const renderSettings = (wf, user) => {
    if (!can(user, 'settings') && permLevel(user) !== 'hr_admin' && permLevel(user) !== 'hr_manager') {
      return '<div class="empty">ليست لديك صلاحية الإعدادات.</div>';
    }
    const s = wf.settings || {};
    const w = s.performanceWeights || {};
    const types = s.rewardTypes || [];
    return `<div class="grid-2">
      <article class="card">
        <h3>إعدادات عامة</h3>
        <label class="field"><span>حجم الصفحة الافتراضي</span>
          <select id="wf-set-ps">${PAGE_SIZES.map((n) => `<option value="${n}" ${(s.pageSize || 25) === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
        </label>
        <label class="field" style="flex-direction:row;align-items:center;gap:8px">
          <input type="checkbox" id="wf-set-rap" ${(s.requireRewardApproval ? 'checked' : '')} /> تتطلب المكافآت اعتماداً
        </label>
        <h4 style="margin-top:16px">قواعد الأداء</h4>
        <div class="grid-2">
          <label class="field">أهداف %<input id="wf-w-goals" type="number" value="${w.goals ?? 40}" /></label>
          <label class="field">مهام %<input id="wf-w-tasks" type="number" value="${w.tasks ?? 30}" /></label>
          <label class="field">حضور %<input id="wf-w-att" type="number" value="${w.attendance ?? 20}" /></label>
          <label class="field">تقييم المدير %<input id="wf-w-mgr" type="number" value="${w.manager ?? 10}" /></label>
        </div>
        <button type="button" class="btn btn-primary" data-action="wf-settings-save" style="margin-top:12px">حفظ الإعدادات</button>
      </article>
      <article class="card">
        <h3>أنواع المكافآت</h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>النوع</th><th>مفعّل</th><th>يعتمد</th><th>الحد</th><th>يمنح</th><th>يعتمد من</th></tr></thead>
          <tbody>${types
            .map(
              (t) => `<tr>
              <td>${esc(t.name)}</td>
              <td>${t.enabled ? 'نعم' : 'لا'}</td>
              <td>${t.requiresApproval ? 'نعم' : 'لا'}</td>
              <td>${t.maxValue}</td>
              <td>${esc(t.canGive)}</td>
              <td>${esc(t.approver || '—')}</td>
            </tr>`
            )
            .join('')}</tbody>
        </table></div>
        <p class="muted" style="margin-top:12px">الإدارات: ${(wf.departments || []).join(' · ')}</p>
        <p class="muted">الأقسام: ${(wf.sections || []).join(' · ')}</p>
        <p class="muted">المسميات: ${(wf.titles || []).slice(0, 8).join(' · ')}…</p>
      </article>
    </div>`;
  };

  const renderReports = (wf) => {
    const recent = (wf.auditLog || []).slice(0, 12);
    return `<div class="grid-2">
      <article class="card">
        <h3>ملخص</h3>
        <ul style="line-height:1.9;margin:0;padding-inline-start:1.1rem">
          <li>إجمالي الموظفين: <strong>${wf.totalEmployees || 0}</strong></li>
          <li>نشطون: <strong>${wf.activeEmployees || 0}</strong></li>
          <li>مكافآت الشهر: <strong>${wf.rewardsThisMonth || 0}</strong></li>
          <li>بانتظار اعتماد: <strong>${(wf.rewards || []).filter((r) => r.status === 'Pending Approval').length}</strong></li>
        </ul>
        <button type="button" class="btn btn-dark" style="margin-top:12px" data-action="wf-export-report">تصدير ملخص CSV</button>
      </article>
      <article class="card">
        <h3>أحدث النشاط</h3>
        ${recent
          .map(
            (a) => `<div style="border-bottom:1px solid var(--border);padding:8px 0">
            <strong>${esc(a.action)}</strong> · ${esc(a.employee || '—')}
            <div class="muted" style="font-size:12px">${esc(a.user)} · ${fmtTime(a.at)}</div>
          </div>`
          )
          .join('') || '<div class="empty">لا نشاط</div>'}
      </article>
    </div>`;
  };

  const empById = (wf, id) => (wf.employees || []).find((e) => e.id === id);

  const renderDrawerBody = (wf, e, user) => {
    const nav = DRAWER_TABS.map(
      (t) =>
        `<button type="button" class="btn btn-sm ${ui.drawerTab === t.id ? 'btn-dark' : 'btn-ghost'}" data-action="wf-drawer-tab" data-dtab="${esc(t.id)}"><i class="fas ${t.icon}"></i> ${esc(t.label)}</button>`
    ).join('');
    const rewards = (wf.rewards || []).filter((r) => r.employeeId === e.id || r.employee === e.name);
    const pts = (wf.pointsTx || []).filter((t) => t.employeeId === e.id);
    const audit = (wf.auditLog || []).filter((a) => a.employeeId === e.id || a.employee === e.name).slice(0, 30);
    const tasks = (store()?.get?.()?.tasks?.items || []).filter((t) => t.assignee === e.name).slice(0, 20);
    let body = '';
    switch (ui.drawerTab) {
      case 'work':
        body = `<div class="grid-2">
          <div><div class="muted">الوظيفة</div><strong>${esc(e.title)}</strong></div>
          <div><div class="muted">الإدارة</div><strong>${esc(e.department)}</strong></div>
          <div><div class="muted">القسم</div><strong>${esc(e.section)}</strong></div>
          <div><div class="muted">المدير المباشر</div><strong>${esc(e.manager)}</strong></div>
          <div><div class="muted">تاريخ الانضمام</div><strong>${esc(e.joinDate || '—')}</strong></div>
          <div><div class="muted">نوع التوظيف</div><strong>${esc(e.employmentType || '—')}</strong></div>
          <div><div class="muted">موقع العمل</div><strong>${esc(e.workType)} · ${esc(e.location)}</strong></div>
          <div><div class="muted">Role النظام</div><strong>${esc(e.systemRole)}</strong></div>
        </div>`;
        break;
      case 'attendance':
        body = `<p>الحضور الحالي: <strong>${esc(e.attendance)}</strong></p><p>ساعات اليوم: <strong>${e.hours ?? '—'}</strong></p><p class="muted">آخر نشاط: ${fmtTime(e.lastActivity)}</p>`;
        break;
      case 'performance':
        body = `<p>درجة الأداء: <strong>${e.productivity}%</strong> ${bar(e.productivity)}</p>
          <p>Score: <strong>${e.score}</strong></p>
          <p>طريقة حساب الأداء: <strong>${esc(perfFormula(wf))}</strong></p>
          <p class="muted">المصدر: قياس تشغيلي لحظي + أوزان الإعدادات</p>`;
        break;
      case 'tasks':
        body = tasks.length
          ? `<ul>${tasks.map((t) => `<li>${esc(t.title)} · ${esc(t.status)}</li>`).join('')}</ul>`
          : '<div class="empty">لا مهام مرتبطة</div>';
        break;
      case 'points':
        body = `<div class="kpis" style="margin-bottom:12px">
            <article class="kpi"><span class="kpi-label">الرصيد</span><strong>${e.points ?? 0}</strong></article>
            <article class="kpi"><span class="kpi-label">مكتسبة</span><strong>${pts.filter((t) => t.type === 'earn').reduce((s, t) => s + t.points, 0)}</strong></article>
            <article class="kpi"><span class="kpi-label">مستخدمة</span><strong>${pts.filter((t) => t.type === 'spend').reduce((s, t) => s + t.points, 0)}</strong></article>
          </div>
          <div class="table-wrap"><table class="data"><thead><tr><th>ID</th><th>التاريخ</th><th>النوع</th><th>نقاط</th><th>السبب</th><th>المصدر</th><th>بواسطة</th></tr></thead>
          <tbody>${
            pts.length
              ? pts
                  .map(
                    (t) =>
                      `<tr><td><code>${esc(t.id)}</code></td><td>${fmtTime(t.at)}</td><td>${esc(t.type)}</td><td>${t.type === 'spend' ? '-' : '+'}${t.points}</td><td>${esc(t.reason)}</td><td>${esc(t.source)}</td><td>${esc(t.createdBy)}</td></tr>`
                  )
                  .join('')
              : '<tr><td colspan="7" class="empty">لا حركات</td></tr>'
          }</tbody></table></div>`;
        break;
      case 'rewards':
        body = rewards.length
          ? `<div class="table-wrap"><table class="data"><thead><tr><th>التاريخ</th><th>المكافأة</th><th>القيمة</th><th>السبب</th><th>المصدر</th><th>منح</th><th>اعتماد</th><th>الحالة</th></tr></thead>
            <tbody>${rewards
              .map(
                (r) =>
                  `<tr><td>${fmtTime(r.at)}</td><td>${esc(r.type)}</td><td>${esc(r.value)}</td><td>${esc(r.reason)}</td><td>${esc(sourceLabel(r.source))}</td><td>${esc(r.grantedBy || '—')}</td><td>${esc(r.approvedBy || '—')}</td><td>${esc(r.status)}</td></tr>`
              )
              .join('')}</tbody></table></div>`
          : '<div class="empty">لا مكافآت لهذا الموظف</div>';
        break;
      case 'docs':
        body = (e.documents || []).length
          ? `<ul>${e.documents.map((d) => `<li>${esc(d.name || d)}</li>`).join('')}</ul>`
          : '<div class="empty">لا مستندات</div>';
        break;
      case 'activity':
        body = audit.length
          ? audit
              .map(
                (a) =>
                  `<div style="border-bottom:1px solid var(--border);padding:8px 0"><strong>${esc(a.action)}</strong><div class="muted">${esc(a.user)} · ${fmtTime(a.at)}</div><div>${esc(a.oldValue || '')} → ${esc(a.newValue || '')}</div></div>`
              )
              .join('')
          : '<div class="empty">لا سجل</div>';
        break;
      default:
        body = `<div class="grid-2">
          <div><div class="muted">مصدر الموظف</div><strong>${esc(sourceLabel(e.source))}</strong></div>
          <div><div class="muted">طريقة الإضافة</div><strong>${esc(e.source === 'HR System' || e.source === 'Integration' ? 'مزامنة تلقائية' : e.source === 'Excel Import' ? 'استيراد' : 'يدوي')}</strong></div>
          <div><div class="muted">أُضيف بواسطة</div><strong>${esc(e.createdBy || '—')}</strong></div>
          <div><div class="muted">تاريخ الإضافة</div><strong>${fmtTime(e.createdAt)}</strong></div>
          <div><div class="muted">آخر مزامنة</div><strong>${fmtTime(e.lastSynced)}</strong></div>
          <div><div class="muted">External Employee ID</div><strong>${esc(e.externalId || '—')}</strong></div>
          <div><div class="muted">المستخدم المرتبط</div><strong>${esc(e.linkedUser || '—')}</strong></div>
          <div><div class="muted">الحالة</div>${statusBadge(e.status)}</div>
        </div>
        <p style="margin-top:12px" class="muted">البريد: ${esc(e.email || '—')} · الهاتف: ${esc(e.phone || '—')}</p>`;
    }
    return `<div style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:4px">${nav}</div>${body}`;
  };

  const renderDrawer = (wf, user) => {
    if (!ui.drawer) return '';
    const e = empById(wf, ui.drawer);
    if (!e) return '';
    return `<aside class="card wf-drawer" data-wf-drawer>
      <div class="toolbar" style="position:sticky;top:0;background:#fff;z-index:1;border-bottom:1px solid var(--border);padding-bottom:10px">
        <div class="wf-name-cell">${avatarHtml(e)}
          <div>
            <strong style="font-size:1.1rem">${esc(e.name)}</strong>
            <div class="muted">${esc(e.id)} · ${esc(e.title)} · ${esc(e.department)}</div>
            ${statusBadge(e.status)}
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-ghost" data-action="wf-drawer-close">✕</button>
      </div>
      <div class="toolbar" style="gap:6px;margin:12px 0">
        ${can(user, 'edit') ? `<button type="button" class="btn btn-sm btn-dark" data-action="wf-edit" data-id="${esc(e.id)}">تعديل</button>` : ''}
        ${can(user, 'reward') ? `<button type="button" class="btn btn-sm btn-primary" data-action="wf-reward-open" data-id="${esc(e.id)}">إضافة مكافأة</button>` : ''}
        <button type="button" class="btn btn-sm btn-ghost" data-action="wf-add-note" data-id="${esc(e.id)}">تسجيل ملاحظة</button>
        <button type="button" class="btn btn-sm btn-ghost" data-action="wf-add-task" data-id="${esc(e.id)}">إضافة مهمة</button>
      </div>
      ${renderDrawerBody(wf, e, user)}
    </aside>
    <div class="wf-drawer-backdrop" data-action="wf-drawer-close"></div>`;
  };

  const renderAddWizard = (wf) => {
    const w = ui.wizardData || {};
    const step = ui.wizardStep || 0;
    let body = '';
    if (step === 0) {
      body = `${field('الاسم *', 'wf-a-name', w.name)}
        ${field('Employee ID', 'wf-a-id', w.id)}
        ${field('البريد', 'wf-a-email', w.email, 'email')}
        ${field('الهاتف', 'wf-a-phone', w.phone)}
        ${field('رابط الصورة', 'wf-a-avatar', w.avatar)}`;
    } else if (step === 1) {
      body = `${field('الوظيفة', 'wf-a-title', w.title)}
        ${field('الإدارة', 'wf-a-dept', w.department, 'select', (wf.departments || []).map((d) => `<option ${w.department === d ? 'selected' : ''}>${esc(d)}</option>`).join(''))}
        ${field('القسم', 'wf-a-sec', w.section, 'select', (wf.sections || []).map((d) => `<option ${w.section === d ? 'selected' : ''}>${esc(d)}</option>`).join(''))}
        ${field('المدير', 'wf-a-mgr', w.manager)}
        ${field('تاريخ الانضمام', 'wf-a-join', w.joinDate, 'date')}
        ${field('نوع التوظيف', 'wf-a-etype', w.employmentType || 'دوام كامل')}
        ${field('موقع العمل', 'wf-a-wtype', w.workType || 'عن بعد', 'select', ['عن بعد', 'بالمكتب', 'هجين'].map((x) => `<option ${w.workType === x ? 'selected' : ''}>${esc(x)}</option>`).join(''))}`;
    } else {
      body = `${field('المستخدم المرتبط', 'wf-a-user', w.linkedUser)}
        ${field('Role', 'wf-a-role', w.systemRole || 'employee', 'select', ['employee', 'manager', 'hr'].map((x) => `<option value="${x}" ${w.systemRole === x ? 'selected' : ''}>${x}</option>`).join(''))}
        ${field('الحالة', 'wf-a-status', w.status || 'active', 'select', ['active', 'inactive', 'draft'].map((x) => `<option value="${x}" ${w.status === x ? 'selected' : ''}>${esc(statusLabel(x))}</option>`).join(''))}`;
    }
    return modalShell(
      'إضافة موظف',
      `<div class="wf-steps">${ADD_STEPS.map((s, i) => `<span class="${i === step ? 'on' : ''}">${i + 1}. ${esc(s)}</span>`).join('')}</div>${body}`,
      `<button type="button" class="btn btn-ghost" data-action="wf-modal-close">إلغاء</button>
       ${step > 0 ? '<button type="button" class="btn btn-ghost" data-action="wf-add-prev">السابق</button>' : ''}
       ${step < 2 ? '<button type="button" class="btn btn-dark" data-action="wf-add-next">التالي</button>' : ''}
       <button type="button" class="btn btn-ghost" data-action="wf-add-save" data-draft="1">حفظ كمسودة</button>
       <button type="button" class="btn btn-primary" data-action="wf-add-save">إضافة الموظف</button>`
    );
  };

  const field = (label, id, val, type = 'text', optionsHtml = '') => {
    if (type === 'select') {
      return `<label class="field"><span>${esc(label)}</span><select id="${esc(id)}">${optionsHtml}</select></label>`;
    }
    if (type === 'textarea') {
      return `<label class="field"><span>${esc(label)}</span><textarea id="${esc(id)}">${esc(val || '')}</textarea></label>`;
    }
    return `<label class="field"><span>${esc(label)}</span><input id="${esc(id)}" type="${esc(type)}" value="${esc(val || '')}" /></label>`;
  };

  const modalShell = (title, body, footer) =>
    `<div class="wf-modal-overlay" data-action="wf-modal-close">
      <div class="card wf-modal" role="dialog" onclick="event.stopPropagation()">
        <div class="toolbar"><strong>${esc(title)}</strong><button type="button" class="btn btn-sm btn-ghost" data-action="wf-modal-close">✕</button></div>
        <div class="wf-modal-body">${body}</div>
        <div class="toolbar" style="margin-top:12px;justify-content:flex-start;gap:8px;flex-wrap:wrap">${footer}</div>
      </div>
    </div>`;

  const captureAdd = () => {
    const step = ui.wizardStep || 0;
    const w = { ...(ui.wizardData || {}) };
    if (step === 0) {
      w.name = qVal('wf-a-name');
      w.id = qVal('wf-a-id');
      w.email = qVal('wf-a-email');
      w.phone = qVal('wf-a-phone');
      w.avatar = qVal('wf-a-avatar');
    } else if (step === 1) {
      w.title = qVal('wf-a-title');
      w.department = qVal('wf-a-dept');
      w.section = qVal('wf-a-sec');
      w.manager = qVal('wf-a-mgr');
      w.joinDate = qVal('wf-a-join');
      w.employmentType = qVal('wf-a-etype');
      w.workType = qVal('wf-a-wtype');
    } else {
      w.linkedUser = qVal('wf-a-user');
      w.systemRole = qVal('wf-a-role');
      w.status = qVal('wf-a-status');
    }
    ui.wizardData = w;
    return w;
  };

  const renderRewardWizard = (wf) => {
    const d = ui.rewardData || {};
    const step = ui.rewardStep || 0;
    const emps = activeEmployees(wf);
    let body = '';
    if (step === 0) {
      body = `<label class="field"><span>اختر الموظف *</span>
        <input id="wf-r-q" placeholder="بحث..." value="${esc(d.q || '')}" data-wf-change="rewardQ" />
        <select id="wf-r-emp" size="8" style="min-height:160px">
          ${emps
            .filter((e) => !d.q || `${e.name} ${e.id}`.includes(d.q))
            .slice(0, 80)
            .map((e) => `<option value="${esc(e.id)}" ${d.employeeId === e.id ? 'selected' : ''}>${esc(e.name)} · ${esc(e.id)}</option>`)
            .join('')}
        </select>
      </label>`;
    } else if (step === 1) {
      body = `<div class="grid-2">${REWARD_TYPES.map(
        (t) =>
          `<button type="button" class="btn ${d.type === t ? 'btn-primary' : 'btn-ghost'}" data-action="wf-reward-type" data-type="${esc(t)}">${esc(t)}</button>`
      ).join('')}</div>`;
    } else if (step === 2) {
      body = field('القيمة / النقاط *', 'wf-r-val', d.value || 500, 'number');
    } else if (step === 3) {
      body = field('سبب المكافأة *', 'wf-r-reason', d.reason || '', 'textarea');
    } else if (step === 4) {
      body = `<label class="field"><span>المصدر *</span><select id="wf-r-src">${REWARD_SOURCES.map(
        (s) => `<option value="${esc(s)}" ${d.source === s ? 'selected' : ''}>${esc(sourceLabel(s))}</option>`
      ).join('')}</select></label>`;
    } else {
      const needs = wf.settings?.requireRewardApproval || (d.type && String(d.type).includes('مالية'));
      body = `<p>مسار الاعتماد:</p>
        <div class="wf-flow">Manager → HR → Approved</div>
        <p class="muted">${needs ? 'هذه المكافأة ستُرسل للاعتماد (Pending Approval).' : 'يمكنك منحها مباشرة حسب صلاحيتك.'}</p>
        <label class="field"><span>تعليق</span><textarea id="wf-r-comment">${esc(d.comment || '')}</textarea></label>`;
    }
    return modalShell(
      'منح مكافأة',
      `<div class="wf-steps">${REWARD_STEPS.map((s, i) => `<span class="${i === step ? 'on' : ''}">${i + 1}. ${esc(s)}</span>`).join('')}</div>${body}`,
      `<button type="button" class="btn btn-ghost" data-action="wf-modal-close">إلغاء</button>
       ${step > 0 ? '<button type="button" class="btn btn-ghost" data-action="wf-reward-prev">السابق</button>' : ''}
       ${step < 5 ? '<button type="button" class="btn btn-dark" data-action="wf-reward-next">التالي</button>' : ''}
       <button type="button" class="btn btn-ghost" data-action="wf-reward-submit" data-mode="draft">حفظ كمسودة</button>
       <button type="button" class="btn btn-dark" data-action="wf-reward-submit" data-mode="request">إرسال للاعتماد</button>
       <button type="button" class="btn btn-primary" data-action="wf-reward-submit" data-mode="grant">منح المكافأة</button>`
    );
  };

  const captureReward = () => {
    const d = { ...(ui.rewardData || {}) };
    const step = ui.rewardStep || 0;
    if (step === 0) d.employeeId = qVal('wf-r-emp') || d.employeeId;
    if (step === 2) d.value = Number(qVal('wf-r-val') || 0);
    if (step === 3) d.reason = qVal('wf-r-reason');
    if (step === 4) d.source = qVal('wf-r-src');
    if (step === 5) d.comment = qVal('wf-r-comment');
    ui.rewardData = d;
    return d;
  };

  const renderImportWizard = () => {
    const step = ui.importStep || 0;
    const stats = ui.importStats;
    let body = '';
    if (step === 0) {
      body = `<p class="muted">ارفع ملف CSV (الاسم,الوظيفة,الإدارة,القسم,المدير,البريد,نوع العمل)</p>
        <label class="field"><span>الصق محتوى CSV / Excel</span><textarea id="wf-import-raw" rows="8" placeholder="name,title,department,section,manager,email,workType"></textarea></label>
        <button type="button" class="btn btn-dark" data-action="wf-import-parse">معاينة</button>`;
    } else if (step === 1) {
      body = `<p>عدد السجلات: <strong>${stats?.total ?? 0}</strong> · صحيح: <strong>${stats?.ok ?? 0}</strong> · أخطاء: <strong>${stats?.invalid ?? 0}</strong> · مكرر: <strong>${stats?.dup ?? 0}</strong></p>
        <div class="table-wrap"><table class="data"><thead><tr><th>الاسم</th><th>الوظيفة</th><th>الإدارة</th><th>ملاحظة</th></tr></thead>
        <tbody>${(ui.importRows || [])
          .slice(0, 25)
          .map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.title)}</td><td>${esc(r.department)}</td><td>${esc(r._note || 'OK')}</td></tr>`)
          .join('')}</tbody></table></div>`;
    } else {
      body = `<p>جاهز للاستيراد: <strong>${(ui.importRows || []).filter((r) => r._ok).length}</strong> سجل</p>`;
    }
    return modalShell(
      'استيراد موظفين',
      body,
      `<button type="button" class="btn btn-ghost" data-action="wf-modal-close">إلغاء</button>
       ${step === 1 ? '<button type="button" class="btn btn-primary" data-action="wf-import-run">استيراد</button>' : ''}
       ${step === 2 ? '<button type="button" class="btn btn-primary" data-action="wf-modal-close">تم</button>' : ''}`
    );
  };

  const renderEditModal = (wf) => {
    const e = empById(wf, ui.wizardData?.editId);
    if (!e) return '';
    return modalShell(
      `تعديل · ${e.name}`,
      `${field('الاسم', 'wf-e-name', e.name)}
       ${field('الوظيفة', 'wf-e-title', e.title)}
       ${field('الإدارة', 'wf-e-dept', e.department)}
       ${field('القسم', 'wf-e-sec', e.section)}
       ${field('المدير', 'wf-e-mgr', e.manager)}
       ${field('نوع العمل', 'wf-e-wt', e.workType)}
       ${field('الموقع', 'wf-e-loc', e.location)}
       ${field('الحالة', 'wf-e-status', e.status, 'select', ['active', 'inactive', 'warning', 'critical', 'leave', 'draft'].map((s) => `<option value="${s}" ${e.status === s ? 'selected' : ''}>${esc(statusLabel(s))}</option>`).join(''))}`,
      `<button type="button" class="btn btn-ghost" data-action="wf-modal-close">إلغاء</button>
       <button type="button" class="btn btn-primary" data-action="wf-edit-save" data-id="${esc(e.id)}">حفظ</button>`
    );
  };

  const renderConfirm = () => {
    if (!ui.confirm) return '';
    return modalShell(
      ui.confirm.title || 'تأكيد',
      `<p>${esc(ui.confirm.message || '')}</p>`,
      `<button type="button" class="btn btn-ghost" data-action="wf-confirm-no">إلغاء</button>
       <button type="button" class="btn btn-primary" data-action="wf-confirm-yes">تأكيد</button>`
    );
  };

  const renderModal = (wf, user) => {
    if (!ui.modal) return '';
    if (ui.modal === 'add') return renderAddWizard(wf);
    if (ui.modal === 'import') return renderImportWizard();
    if (ui.modal === 'reward') return renderRewardWizard(wf);
    if (ui.modal === 'edit') return renderEditModal(wf);
    return '';
  };

  const renderEmployeesTab = (wf, user) => {
    const filtered = sortEmployees(filterEmployees(wf));
    const page = paginate(filtered);
    return `
      ${renderViews(wf)}
      ${renderFilters(wf)}
      ${renderBulkBar(user)}
      <article class="card wf-employees-card">
        <div class="toolbar">
          <h3 style="margin:0"><span class="title-left"><i class="fas fa-users icon"></i> الموظفون</span></h3>
          <span class="badge badge-outline">عدد الموظفين: ${page.total}</span>
        </div>
        ${renderTable(wf, user, page)}
        ${renderPagination(page)}
      </article>
      ${renderInsights(wf, filtered)}
      <article class="card" style="margin-top:16px">
        <div class="toolbar">
          <h3 style="margin:0"><span class="title-left"><i class="fas fa-gift icon"></i> المكافآت والتقدير</span></h3>
          <button type="button" class="btn btn-sm btn-ghost" data-action="wf-tab" data-tab="rewards">عرض الكل</button>
        </div>
        ${renderRewardsPanel(wf, user)}
      </article>
      <article class="card" style="margin-top:16px">
        <h3><span class="title-left"><i class="fas fa-clock icon"></i> آخر النشاط</span></h3>
        ${(wf.auditLog || [])
          .slice(0, 6)
          .map((a) => `<div style="padding:6px 0;border-bottom:1px solid var(--border)"><strong>${esc(a.action)}</strong> · ${esc(a.employee || '—')} <span class="muted">${fmtTime(a.at)}</span></div>`)
          .join('') || '<div class="empty">لا نشاط</div>'}
      </article>`;
  };

  const renderTabBody = (wf, user) => {
    switch (ui.tab) {
      case 'rewards':
        return renderRewardsPanel(wf, user);
      case 'reports':
        return renderReports(wf);
      case 'sync':
        return renderSync(wf, user);
      case 'audit':
        return renderAudit(wf);
      case 'settings':
        return renderSettings(wf, user);
      default:
        return renderEmployeesTab(wf, user);
    }
  };

  const parseCsv = (text) => {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return [];
    const headers = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase());
    const mapKey = (h) => {
      if (/name|اسم/.test(h)) return 'name';
      if (/title|role|وظيف/.test(h)) return 'title';
      if (/dept|department|إدار/.test(h)) return 'department';
      if (/section|قسم/.test(h)) return 'section';
      if (/manager|مدير/.test(h)) return 'manager';
      if (/email|بريد/.test(h)) return 'email';
      if (/work|نوع/.test(h)) return 'workType';
      return h;
    };
    const keys = headers.map(mapKey);
    const start = keys.includes('name') ? 1 : 0;
    const rows = [];
    for (let i = start; i < lines.length; i++) {
      const cols = lines[i].split(/[,;\t]/);
      const row = {};
      keys.forEach((k, idx) => {
        row[k] = (cols[idx] || '').trim();
      });
      if (!keys.includes('name') && cols[0]) row.name = cols[0].trim();
      rows.push(row);
    }
    return rows;
  };

  const handle = (action, btn, ctx = {}) => {
    if (!action || !String(action).startsWith('wf-')) return false;
    const user = ctx.user || {};
    const toast = ctx.toast || (() => {});
    const act = actorName(user);
    const HS = store();
    if (!HS) {
      toast('HubStore غير متاح');
      return true;
    }
    const wf = wfData();

    if (action === 'wf-tab') {
      ui.tab = btn.dataset.tab || 'employees';
      ui.menuOpen = null;
      return true;
    }
    if (action === 'wf-kpi') {
      const focus = btn.dataset.focus || '';
      if (focus === 'rewards' || btn.dataset.tab === 'rewards') {
        ui.tab = 'rewards';
        ui.kpiFocus = '';
        return true;
      }
      ui.kpiFocus = ui.kpiFocus === focus ? '' : focus;
      ui.tab = 'employees';
      ui.page = 1;
      return true;
    }
    if (action === 'wf-help-open') {
      ui.helpOpen = true;
      return true;
    }
    if (action === 'wf-help-close') {
      ui.helpOpen = false;
      return true;
    }
    if (action === 'wf-help-dismiss') {
      HS.dismissWorkforceHelp?.();
      ui.helpOpen = false;
      toast('تم إخفاء الدليل');
      return true;
    }
    if (action === 'wf-clear-filters') {
      ui.filters = { q: '', department: '', section: '', title: '', status: '', workType: '', location: '', performance: '', view: 'all' };
      ui.kpiFocus = '';
      ui.page = 1;
      return true;
    }
    if (action === 'wf-view') {
      ui.filters.view = btn.dataset.view || 'all';
      ui.page = 1;
      return true;
    }
    if (action === 'wf-save-view') {
      const name = (typeof window !== 'undefined' && window.prompt('اسم العرض المحفوظ', 'فريق مخصص')) || '';
      if (!name) return true;
      HS.addWorkforceSavedView?.(name, { ...ui.filters }, act);
      toast('تم حفظ العرض');
      return true;
    }
    if (action === 'wf-page') {
      ui.page += btn.dataset.dir === 'prev' ? -1 : 1;
      return true;
    }
    if (action === 'wf-goto') {
      ui.page = Number(btn.dataset.page) || 1;
      return true;
    }
    if (action === 'wf-sort') {
      const key = btn.dataset.key;
      if (ui.sortKey === key) ui.sortDir = ui.sortDir === 'asc' ? 'desc' : 'asc';
      else {
        ui.sortKey = key;
        ui.sortDir = 'asc';
      }
      return true;
    }
    if (action === 'wf-menu') {
      ui.menuOpen = ui.menuOpen === btn.dataset.id ? null : btn.dataset.id;
      return true;
    }
    if (action === 'wf-drawer') {
      ui.drawer = btn.dataset.id;
      ui.drawerTab = btn.dataset.dtab || 'overview';
      ui.menuOpen = null;
      return true;
    }
    if (action === 'wf-drawer-close') {
      ui.drawer = null;
      return true;
    }
    if (action === 'wf-drawer-tab') {
      ui.drawerTab = btn.dataset.dtab || 'overview';
      return true;
    }
    if (action === 'wf-modal') {
      ui.modal = btn.dataset.modal;
      if (ui.modal === 'add') {
        ui.wizardStep = 0;
        ui.wizardData = {};
      }
      if (ui.modal === 'import') {
        ui.importStep = 0;
        ui.importRows = [];
        ui.importStats = null;
      }
      return true;
    }
    if (action === 'wf-modal-close') {
      ui.modal = null;
      return true;
    }
    if (action === 'wf-add-next') {
      captureAdd();
      if (ui.wizardStep === 0 && !String(ui.wizardData.name || '').trim()) {
        toast('الاسم مطلوب');
        return true;
      }
      ui.wizardStep = Math.min(2, (ui.wizardStep || 0) + 1);
      return true;
    }
    if (action === 'wf-add-prev') {
      captureAdd();
      ui.wizardStep = Math.max(0, (ui.wizardStep || 0) - 1);
      return true;
    }
    if (action === 'wf-add-save') {
      const w = captureAdd();
      if (!String(w.name || '').trim()) {
        toast('الاسم مطلوب');
        return true;
      }
      const draft = btn.dataset.draft === '1';
      const created = HS.addEmployee(
        {
          ...w,
          source: 'Manual',
          status: draft ? 'draft' : w.status || 'active',
          draft,
        },
        act
      );
      if (!created) {
        toast('تعذر الإضافة');
        return true;
      }
      ui.modal = null;
      ui.drawer = created.id;
      ui.drawerTab = 'overview';
      toast(draft ? 'حُفظت مسودة الموظف' : 'تمت إضافة الموظف');
      return true;
    }
    if (action === 'wf-edit') {
      ui.modal = 'edit';
      ui.wizardData = { editId: btn.dataset.id };
      ui.menuOpen = null;
      return true;
    }
    if (action === 'wf-edit-save') {
      HS.updateEmployee?.(
        btn.dataset.id,
        {
          name: qVal('wf-e-name'),
          title: qVal('wf-e-title'),
          department: qVal('wf-e-dept'),
          section: qVal('wf-e-sec'),
          manager: qVal('wf-e-mgr'),
          workType: qVal('wf-e-wt'),
          location: qVal('wf-e-loc'),
          status: qVal('wf-e-status'),
        },
        act
      );
      ui.modal = null;
      toast('تم حفظ التعديلات');
      return true;
    }
    if (action === 'wf-toggle-status') {
      const e = empById(wf, btn.dataset.id);
      if (!e) return true;
      const next = e.status === 'inactive' ? 'active' : 'inactive';
      ui.confirm = {
        title: next === 'inactive' ? 'إيقاف موظف' : 'تفعيل موظف',
        message: `تأكيد ${next === 'inactive' ? 'إيقاف' : 'تفعيل'} ${e.name}؟`,
        run: () => {
          HS.updateEmployee?.(e.id, { status: next }, act);
          toast(next === 'inactive' ? 'تم الإيقاف' : 'تم التفعيل');
        },
      };
      ui.menuOpen = null;
      return true;
    }
    if (action === 'wf-confirm-yes') {
      ui.confirm?.run?.();
      ui.confirm = null;
      return true;
    }
    if (action === 'wf-confirm-no') {
      ui.confirm = null;
      return true;
    }
    if (action === 'wf-reward-open') {
      ui.modal = 'reward';
      ui.rewardStep = 0;
      ui.rewardData = { employeeId: btn.dataset.id || '', type: 'نقاط', value: 500, source: 'Performance' };
      return true;
    }
    if (action === 'wf-reward-type') {
      ui.rewardData = { ...(ui.rewardData || {}), type: btn.dataset.type };
      return true;
    }
    if (action === 'wf-reward-next') {
      const d = captureReward();
      if (ui.rewardStep === 0 && !d.employeeId) {
        toast('اختر موظفاً');
        return true;
      }
      if (ui.rewardStep === 1 && !d.type) {
        toast('اختر نوع المكافأة');
        return true;
      }
      ui.rewardStep = Math.min(5, (ui.rewardStep || 0) + 1);
      return true;
    }
    if (action === 'wf-reward-prev') {
      captureReward();
      ui.rewardStep = Math.max(0, (ui.rewardStep || 0) - 1);
      return true;
    }
    if (action === 'wf-reward-submit') {
      const d = captureReward();
      if (!d.employeeId || !d.reason || !d.source) {
        toast('أكمل بيانات المكافأة (موظف · سبب · مصدر)');
        return true;
      }
      const mode = btn.dataset.mode;
      const typeCfg = (wf.settings?.rewardTypes || []).find((t) => t.name === d.type || (d.type === 'نقاط' && t.id === 'points'));
      const needsApproval = mode === 'request' || (mode !== 'grant' && (wf.settings?.requireRewardApproval || typeCfg?.requiresApproval));
      const forceGrant = mode === 'grant' && (permLevel(user) === 'hr_admin' || permLevel(user) === 'hr_manager');
      if (mode === 'draft') {
        toast('حُفظت كمسودة محلية — أرسل للاعتماد للمتابعة');
        ui.modal = null;
        return true;
      }
      const item = HS.rewardEmployee(
        d.employeeId,
        Number(d.value) || 0,
        {
          type: d.type,
          value: Number(d.value) || 0,
          points: d.type === 'نقاط' || !d.type ? Number(d.value) || 0 : 0,
          reason: d.reason,
          source: d.source,
          requiresApproval: needsApproval && !forceGrant,
          forceGrant: forceGrant && mode === 'grant',
        },
        act
      );
      ui.modal = null;
      toast(item?.status === 'Pending Approval' ? 'أُرسلت للاعتماد' : 'تم منح المكافأة');
      return true;
    }
    if (action === 'wf-reward-decide') {
      const decision = btn.dataset.decision;
      let comment = '';
      if (decision === 'reject') {
        comment = (typeof window !== 'undefined' && window.prompt('سبب الرفض (إجباري)')) || '';
        if (!comment.trim()) {
          toast('التعليق إجباري عند الرفض');
          return true;
        }
      }
      const res = HS.decideReward?.(btn.dataset.id, decision, comment, act);
      if (res?.error) {
        toast(res.error);
        return true;
      }
      toast(decision === 'approve' ? 'تم اعتماد المكافأة وإضافة النقاط' : 'تم رفض المكافأة');
      return true;
    }
    if (action === 'wf-import-parse') {
      const raw = qVal('wf-import-raw');
      const rows = parseCsv(raw);
      const names = new Set(activeEmployees(wf).map((e) => e.name));
      let invalid = 0;
      let dup = 0;
      let ok = 0;
      rows.forEach((r) => {
        if (!r.name) {
          r._note = 'خطأ: لا اسم';
          r._ok = false;
          invalid += 1;
        } else if (names.has(r.name)) {
          r._note = 'مكرر';
          r._ok = false;
          dup += 1;
        } else {
          r._note = 'OK';
          r._ok = true;
          ok += 1;
        }
      });
      ui.importRows = rows;
      ui.importStats = { total: rows.length, ok, invalid, dup };
      ui.importStep = 1;
      return true;
    }
    if (action === 'wf-import-run') {
      const good = (ui.importRows || []).filter((r) => r._ok);
      const res = HS.importEmployees?.(good, act);
      ui.importStep = 2;
      toast(`تم استيراد ${res?.created?.length || 0} · أخطاء ${res?.invalid || 0} · مكرر ${res?.duplicates || 0}`);
      return true;
    }
    if (action === 'wf-sync-now') {
      HS.syncWorkforce?.(act);
      toast('تمت المزامنة');
      return true;
    }
    if (action === 'wf-sync-test') {
      toast('الاتصال ناجح · HR System Connected');
      return true;
    }
    if (action === 'wf-tick') {
      HS.tickProductivity?.();
      toast('تم تحديث الإنتاجية');
      return true;
    }
    if (action === 'wf-settings-save') {
      HS.updateWorkforceSettings?.(
        {
          pageSize: Number(qVal('wf-set-ps') || 25),
          requireRewardApproval: !!qVal('wf-set-rap'),
          performanceWeights: {
            goals: Number(qVal('wf-w-goals') || 40),
            tasks: Number(qVal('wf-w-tasks') || 30),
            attendance: Number(qVal('wf-w-att') || 20),
            manager: Number(qVal('wf-w-mgr') || 10),
          },
        },
        act
      );
      ui.pageSize = Number(qVal('wf-set-ps') || ui.pageSize);
      toast('حُفظت إعدادات القوى العاملة');
      return true;
    }
    if (action === 'wf-bulk-clear') {
      ui.selected = {};
      return true;
    }
    if (action === 'wf-bulk') {
      const ids = selectedIds();
      if (!ids.length) return true;
      const bulk = btn.dataset.bulk;
      if (bulk === 'export') {
        const rows = activeEmployees(wf).filter((e) => ids.includes(e.id));
        const csv = ['id,name,title,department,status', ...rows.map((e) => `${e.id},${e.name},${e.title},${e.department},${e.status}`)].join('\n');
        downloadText('workforce-export.csv', csv);
        toast('تم التصدير');
        return true;
      }
      if (bulk === 'tag') {
        const tag = (typeof window !== 'undefined' && window.prompt('الوسم')) || '';
        if (!tag) return true;
        HS.bulkTagEmployees?.(ids, tag, act);
        toast('تمت إضافة الوسم');
        return true;
      }
      if (bulk === 'dept') {
        const dept = (typeof window !== 'undefined' && window.prompt('الإدارة الجديدة')) || '';
        if (!dept) return true;
        ui.confirm = {
          title: 'تغيير الإدارة',
          message: `تغيير إدارة ${ids.length} موظفاً إلى «${dept}»؟`,
          run: () => {
            ids.forEach((id) => HS.updateEmployee?.(id, { department: dept }, act));
            toast('تم تغيير الإدارة');
          },
        };
        return true;
      }
      if (bulk === 'notify') {
        toast(`تم تسجيل إشعار لـ ${ids.length} موظفاً (محاكاة)`);
        HS.pushWfAudit?.({ user: act, action: 'إشعار جماعي', newValue: String(ids.length) });
        return true;
      }
      if (bulk === 'task') {
        const title = (typeof window !== 'undefined' && window.prompt('عنوان المهمة', 'متابعة تشغيلية')) || '';
        if (!title) return true;
        ids.forEach((id) => {
          const e = empById(wf, id);
          if (e && HS.addTask) HS.addTask(title, e.name, 'متوسط', 'القوى العاملة');
        });
        toast('تم تعيين المهام');
        return true;
      }
      return true;
    }
    if (action === 'wf-add-note') {
      const note = (typeof window !== 'undefined' && window.prompt('الملاحظة')) || '';
      if (!note) return true;
      const e = empById(wf, btn.dataset.id);
      if (!e) return true;
      if (!Array.isArray(e.notes)) e.notes = [];
      e.notes.unshift({ text: note, at: new Date().toISOString(), by: act });
      HS.updateEmployee?.(e.id, { notes: e.notes }, act);
      toast('سُجلت الملاحظة');
      return true;
    }
    if (action === 'wf-add-task') {
      const e = empById(wf, btn.dataset.id);
      const title = (typeof window !== 'undefined' && window.prompt('عنوان المهمة', `مهمة لـ ${e?.name || ''}`)) || '';
      if (!title || !e) return true;
      HS.addTask?.(title, e.name, 'متوسط', 'القوى العاملة');
      toast('أُضيفت المهمة');
      return true;
    }
    if (action === 'wf-export-report') {
      const csv = `metric,value\ntotal,${wf.totalEmployees}\nactive,${wf.activeEmployees}\nremote,${wf.remoteEmployees}\nrewards_month,${wf.rewardsThisMonth}\n`;
      downloadText('workforce-report.csv', csv);
      toast('تم تصدير التقرير');
      return true;
    }
    return false;
  };

  const downloadText = (name, text) => {
    if (typeof document === 'undefined') return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  };

  const handleChange = (el) => {
    const key = el.getAttribute('data-wf-change');
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
    if (['department', 'section', 'title', 'status', 'workType', 'location', 'performance'].includes(key)) {
      ui.filters[key] = el.value;
      ui.page = 1;
      return true;
    }
    if (key === 'sel') {
      const id = el.dataset.id;
      if (el.checked) ui.selected[id] = true;
      else delete ui.selected[id];
      return true;
    }
    if (key === 'sel-all') {
      const wf = wfData();
      const page = paginate(sortEmployees(filterEmployees(wf)));
      if (el.checked) page.rows.forEach((e) => (ui.selected[e.id] = true));
      else page.rows.forEach((e) => delete ui.selected[e.id]);
      return true;
    }
    if (key === 'rewardQ') {
      ui.rewardData = { ...(ui.rewardData || {}), q: el.value };
      return true;
    }
    return false;
  };

  const render = (ctx = {}) => {
    const user = ctx.user || {};
    const wf = wfData();
    if (wf.settings?.pageSize && !ui._pageSizeInit) {
      ui.pageSize = wf.settings.pageSize || DEFAULT_PAGE_SIZE;
      ui._pageSizeInit = true;
    }
    return `<div class="hub-workforce" dir="rtl" data-hub-workforce>
      ${renderHeader(wf, user)}
      ${renderHelp(wf)}
      ${renderKpis(wf)}
      ${renderTabs()}
      <div style="margin-top:12px">${renderTabBody(wf, user)}</div>
      ${renderDrawer(wf, user)}
      ${renderModal(wf, user)}
      ${renderConfirm()}
    </div>`;
  };

  window.HubWorkforce = { render, handle, handleChange, ui };
})();
