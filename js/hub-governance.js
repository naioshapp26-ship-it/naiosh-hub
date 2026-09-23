/**
 * NAIOSH HUB 360 — Enterprise Governance 360 Module
 * لوحة · أشخاص · هيكل · سياسات · امتثال · جودة · عقود · مكافآت · موافقات · تدقيق
 */
(() => {
  'use strict';

  const stLabel = (s) => window.HubI18n?.display?.(s) || s;
  const sysLabel = (s) => window.HubI18n?.system?.(s) || s;

  const PAGE_SIZES = [10, 25, 50, 100];
  const TABS = [
    { id: 'dashboard', label: 'لوحة الحوكمة', icon: 'fa-gauge' },
    { id: 'people', label: 'الأشخاص والجهات', icon: 'fa-users' },
    { id: 'org', label: 'الهيكل التنظيمي', icon: 'fa-sitemap' },
    { id: 'policies', label: 'السياسات', icon: 'fa-file-shield' },
    { id: 'compliance', label: 'الامتثال', icon: 'fa-check-double' },
    { id: 'quality', label: 'الجودة والمعايير', icon: 'fa-award' },
    { id: 'contracts', label: 'العقود', icon: 'fa-file-contract' },
    { id: 'rewards', label: 'المكافآت', icon: 'fa-gift' },
    { id: 'decisions', label: 'القرارات واللجان', icon: 'fa-gavel' },
    { id: 'approvals', label: 'المهام والموافقات', icon: 'fa-inbox' },
    { id: 'violations', label: 'المخالفات والمخاطر', icon: 'fa-triangle-exclamation' },
    { id: 'reports', label: 'التقارير', icon: 'fa-chart-line' },
    { id: 'audit', label: 'سجل العمليات', icon: 'fa-clock-rotate-left' },
    { id: 'settings', label: 'الإعدادات', icon: 'fa-gear' },
  ];
  const PROFILE_TABS = [
    { id: 'overview', label: 'نظرة عامة' },
    { id: 'work', label: 'بيانات العمل' },
    { id: 'roles', label: 'الأدوار والصلاحيات' },
    { id: 'policies', label: 'السياسات' },
    { id: 'compliance', label: 'الامتثال' },
    { id: 'quality', label: 'الجودة' },
    { id: 'contracts', label: 'العقود' },
    { id: 'rewards', label: 'المكافآت' },
    { id: 'decisions', label: 'القرارات' },
    { id: 'approvals', label: 'المهام والموافقات' },
    { id: 'violations', label: 'المخالفات' },
    { id: 'docs', label: 'المستندات' },
    { id: 'activity', label: 'سجل النشاط' },
  ];
  const SOURCE_AR = {
    Manual: 'إدخال يدوي',
    'HR System': 'نظام الموارد البشرية',
    'Workforce Module': 'وحدة القوى العاملة',
    Import: 'استيراد',
    API: 'API',
    Integration: 'تكامل',
    Automation: 'أتمتة',
    'System Generated': 'مولّد تلقائياً',
    Quality: 'الجودة',
    Performance: 'الأداء',
    System: 'النظام',
  };

  const ui = {
    tab: 'dashboard',
    page: 1,
    pageSize: 25,
    filters: { q: '', branch: '', department: '', platform: '', role: '', status: '', compliance: '' },
    globalQ: '',
    menuOpen: null,
    addOpen: false,
    helpOpen: false,
    drawer: null,
    drawerTab: 'overview',
    modal: null,
    wizardStep: 0,
    wizardData: {},
    confirm: null,
    kpiFocus: '',
    approvalFilter: 'mine',
    detailId: null,
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
  const govData = () => {
    store()?.recomputeGovKpis?.();
    return store()?.get?.()?.governance || { people: [], policies: [], auditLog: [] };
  };
  const actorName = (user) => user?.name || user?.email || user?.displayName || 'مشغّل هوب';
  const permLevel = (user) => {
    const role = String(user?.role || '').toLowerCase();
    if (['supreme_leader', 'admin'].includes(role)) return 'admin';
    if (['chief_engineer', 'manager'].includes(role)) return 'manager';
    if (['auditor', 'audit'].includes(role)) return 'auditor';
    return 'admin';
  };
  const can = (user, action) => {
    const p = permLevel(user);
    if (p === 'admin') return true;
    if (p === 'auditor') return ['view', 'audit', 'report'].includes(action);
    return action !== 'settings' || p === 'manager';
  };
  const sourceLabel = (s) => SOURCE_AR[s] || s || '—';
  const unique = (arr) => [...new Set(arr.filter(Boolean))];
  const qVal = (id) => {
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (!el) return '';
    return el.type === 'checkbox' ? el.checked : el.value;
  };
  const initials = (name) => {
    const p = String(name || '').trim().split(/\s+/);
    return esc(((p[0] || '?')[0] || '') + ((p[1] || '')[0] || '')).toUpperCase();
  };
  const avatar = (p) =>
    p.avatar
      ? `<img class="gov-avatar" src="${esc(p.avatar)}" alt="" />`
      : `<span class="gov-avatar gov-avatar-fallback">${initials(p.name)}</span>`;

  const personById = (g, id) => (g.people || []).find((p) => p.id === id);
  const filterPeople = (g) => {
    const f = ui.filters;
    return (g.people || []).filter((p) => {
      if (p.status === 'Archived') return false;
      if (f.branch && p.branch !== f.branch) return false;
      if (f.department && p.department !== f.department) return false;
      if (f.platform && p.platform !== f.platform) return false;
      if (f.role && p.governanceRole !== f.role) return false;
      if (f.status && p.status !== f.status) return false;
      if (f.compliance === 'low' && (p.complianceScore || 0) >= 80) return false;
      if (f.compliance === 'high' && (p.complianceScore || 0) < 90) return false;
      if (ui.kpiFocus === 'incomplete' && !p.incomplete) return false;
      if (f.q || ui.globalQ) {
        const q = String(f.q || ui.globalQ).toLowerCase();
        const hay = `${p.name} ${p.employeeId} ${p.id} ${p.phone} ${p.email} ${p.department} ${p.branch} ${p.officeNumber}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  };
  const paginate = (arr) => {
    const size = Number(ui.pageSize) || 25;
    const total = arr.length;
    const pages = Math.max(1, Math.ceil(total / size) || 1);
    if (ui.page > pages) ui.page = pages;
    if (ui.page < 1) ui.page = 1;
    const start = (ui.page - 1) * size;
    return { rows: arr.slice(start, start + size), total, pages, start, end: Math.min(start + size, total) };
  };

  const actionNeeded = (g) => {
    const items = [];
    let pendingAck = 0;
    (g.policies || []).forEach((p) => {
      (p.assignments || []).forEach((a) => {
        if (a.status === 'Pending' || a.status === 'Overdue' || a.status === 'Sent') pendingAck += 1;
      });
    });
    if (pendingAck) items.push({ id: 'ack', text: `${pendingAck} شخصاً لم يقرّوا السياسات المطلوبة`, tab: 'policies' });
    if (g.expiringContracts) items.push({ id: 'ctr', text: `${g.expiringContracts} عقود تنتهي خلال 30 يوماً`, tab: 'contracts' });
    if (g.pendingApprovals) items.push({ id: 'apr', text: `${g.pendingApprovals} موافقات بانتظارك`, tab: 'approvals' });
    const lowQ = (g.standards || []).filter((s) => Number(s.currentValue) < Number(s.target)).length;
    if (lowQ) items.push({ id: 'qs', text: `${lowQ} معيار جودة أقل من الحد المطلوب`, tab: 'quality' });
    if (g.openViolations) items.push({ id: 'vio', text: `${g.openViolations} مخالفات تحتاج معالجة`, tab: 'violations' });
    const incomplete = (g.people || []).filter((p) => p.incomplete).length;
    if (incomplete) items.push({ id: 'inc', text: `${incomplete} أشخاص بيانات الحوكمة الخاصة بهم ناقصة`, tab: 'people', focus: 'incomplete' });
    return items;
  };

  const field = (label, id, val, opts = {}) => {
    const req = opts.required ? ' <span class="gov-req">*</span>' : '';
    const help = opts.help ? `<small class="muted">${esc(opts.help)}</small>` : '';
    if (opts.type === 'select') {
      return `<label class="field"><span>${esc(label)}${req}</span><select id="${esc(id)}">${opts.optionsHtml || ''}</select>${help}</label>`;
    }
    if (opts.type === 'textarea') {
      return `<label class="field"><span>${esc(label)}${req}</span><textarea id="${esc(id)}" rows="3">${esc(val || '')}</textarea>${help}</label>`;
    }
    if (opts.readonly) {
      return `<div class="gov-readonly"><span class="muted">${esc(label)}</span><strong>${esc(val || '—')}</strong>${opts.hint ? `<small>${esc(opts.hint)}</small>` : ''}</div>`;
    }
    return `<label class="field"><span>${esc(label)}${req}</span><input id="${esc(id)}" type="${esc(opts.type || 'text')}" value="${esc(val || '')}" placeholder="${esc(opts.placeholder || '')}" />${help}</label>`;
  };

  const modalShell = (title, body, footer) =>
    `<div class="gov-modal-overlay" data-action="gov-modal-close">
      <div class="card gov-modal" role="dialog" onclick="event.stopPropagation()">
        <div class="toolbar"><strong>${esc(title)}</strong><button type="button" class="btn btn-sm btn-ghost" data-action="gov-modal-close">✕</button></div>
        <div>${body}</div>
        <div class="toolbar" style="margin-top:12px;gap:8px;flex-wrap:wrap">${footer}</div>
      </div>
    </div>`;

  const renderHeader = (g, user) => `<div class="toolbar gov-header" style="flex-wrap:wrap;gap:8px">
      <div style="display:flex;flex-wrap:wrap;gap:8px;flex:1;position:relative">
        ${can(user, 'edit') ? `<button type="button" class="btn btn-primary" data-action="gov-add-toggle" title="إضافة"><i class="fas fa-plus"></i> إضافة</button>` : ''}
        ${ui.addOpen ? `<div class="gov-add-menu">
          <button type="button" data-action="gov-modal" data-modal="person">+ إضافة شخص/عضو حوكمة</button>
          <button type="button" data-action="gov-modal" data-modal="policy">+ إضافة سياسة</button>
          <button type="button" data-action="gov-modal" data-modal="compliance">+ إضافة معيار امتثال</button>
          <button type="button" data-action="gov-modal" data-modal="quality">+ إضافة معيار جودة</button>
          <button type="button" data-action="gov-modal" data-modal="contract">+ إضافة عقد</button>
          <button type="button" data-action="gov-modal" data-modal="reward">+ إضافة مكافأة</button>
          <button type="button" data-action="gov-modal" data-modal="decision">+ إضافة قرار</button>
          <button type="button" data-action="gov-modal" data-modal="committee">+ إضافة لجنة</button>
          <button type="button" data-action="gov-modal" data-modal="violation">+ إضافة مخالفة</button>
          <button type="button" data-action="gov-modal" data-modal="document">+ إضافة دليل/مستند</button>
        </div>` : ''}
        <button type="button" class="btn btn-ghost" data-action="gov-tab" data-tab="approvals" title="المهام والموافقات"><i class="fas fa-inbox"></i> المهام والموافقات</button>
        <button type="button" class="btn btn-ghost" data-action="gov-tab" data-tab="reports" title="التقارير"><i class="fas fa-chart-line"></i> التقارير</button>
        <button type="button" class="btn btn-ghost" data-action="gov-tab" data-tab="settings" title="الإعدادات"><i class="fas fa-gear"></i> الإعدادات</button>
        <button type="button" class="btn btn-ghost" data-action="gov-help-open" title="دليل الاستخدام"><i class="fas fa-circle-question"></i> كيف أستخدم الحوكمة؟</button>
      </div>
      <span class="badge badge-outline">${g.totalPeople || 0} شخص · ${g.activePolicies || 0} سياسة</span>
    </div>`;

  const renderHelp = () => {
    if (!ui.helpOpen) return '';
    return `<article class="card gov-help">
      <div class="toolbar">
        <strong>كيف أستخدم الحوكمة؟</strong>
        <button type="button" class="btn btn-sm btn-ghost" data-action="gov-help-close">✕</button>
      </div>
      <p class="muted">الحوكمة تساعدك على معرفة من المسؤول، وما القواعد والسياسات المطلوبة، وهل تم الالتزام بها أم لا.</p>
      <ul style="line-height:1.9;margin:0;padding-inline-start:1.1rem">
        <li>لإضافة شخص: إضافة → شخص</li>
        <li>لإنشاء سياسة: إضافة → سياسة → حدد على من تطبق → أرسل للاعتماد</li>
        <li>لمعيار امتثال: إضافة → معيار امتثال → حدد المطلوب والأشخاص وطريقة القياس</li>
        <li>لمعيار جودة: إضافة → معيار جودة → Target ومصدر القياس والمسؤول</li>
        <li>لعقد: إضافة → عقد → اربطه بالشخص/القسم/المنصة</li>
        <li>لمكافأة: افتح الشخص → مكافآت → منح مكافأة</li>
      </ul>
    </article>`;
  };

  const renderKpis = (g) => {
    const items = [
      { key: 'people', label: 'الأشخاص الخاضعون للحوكمة', value: g.totalPeople ?? 0, tab: 'people' },
      { key: 'policies', label: 'السياسات النشطة', value: g.activePolicies ?? 0, tab: 'policies' },
      { key: 'compliance', label: 'نسبة الامتثال', value: `${g.complianceRate ?? 0}%`, tab: 'compliance' },
      { key: 'quality', label: 'معايير الجودة', value: g.qualityStandards ?? 0, tab: 'quality' },
      { key: 'contracts', label: 'العقود النشطة', value: g.activeContracts ?? 0, tab: 'contracts' },
      { key: 'expiring', label: 'عقود ستنتهي قريباً', value: g.expiringContracts ?? 0, tab: 'contracts' },
      { key: 'approvals', label: 'الموافقات المعلقة', value: g.pendingApprovals ?? 0, tab: 'approvals' },
      { key: 'violations', label: 'المخالفات المفتوحة', value: g.openViolations ?? 0, tab: 'violations' },
      { key: 'risks', label: 'المخاطر العالية', value: g.highRisks ?? 0, tab: 'violations' },
      { key: 'rewards', label: 'المكافآت هذا الشهر', value: g.rewardsThisMonth ?? 0, tab: 'rewards' },
    ];
    return `<div class="kpis gov-kpis" style="margin:12px 0">${items
      .map(
        (k) => `<article class="kpi" data-action="gov-kpi" data-tab="${esc(k.tab)}" data-focus="${esc(k.key)}" role="button" tabindex="0">
        <span class="kpi-label">${esc(k.label)}</span><strong class="kpi-value">${esc(k.value)}</strong>
      </article>`
      )
      .join('')}</div>`;
  };

  const renderTabs = () =>
    `<div class="tabs gov-tabs" role="tablist">${TABS.map(
      (t) =>
        `<button type="button" class="tab ${ui.tab === t.id ? 'active' : ''}" data-action="gov-tab" data-tab="${esc(t.id)}"><i class="fas ${t.icon}"></i> ${esc(t.label)}</button>`
    ).join('')}</div>`;

  const renderSearch = () =>
    `<div class="card" style="padding:12px;margin:12px 0">
      <label class="field" style="margin:0"><span>بحث الحوكمة الشامل</span>
        <input id="gov-global-q" data-gov-change="globalQ" value="${esc(ui.globalQ)}" placeholder="ابحث عن أحمد · POL-001 · عقد · لجنة..." />
      </label>
    </div>`;

  const renderDashboard = (g) => {
    const needed = actionNeeded(g);
    const follow = filterPeople(g).filter((p) => (p.complianceScore || 0) < 85 || p.incomplete).slice(0, 8);
    return `${renderKpis(g)}
      <article class="card" style="margin-bottom:12px">
        <h3><span class="title-left"><i class="fas fa-bolt icon"></i> يحتاج إلى إجراء</span></h3>
        ${needed.length ? needed.map((n) => `<button type="button" class="gov-action-item" data-action="gov-need" data-tab="${esc(n.tab)}" data-focus="${esc(n.focus || '')}">${esc(n.text)}</button>`).join('') : '<div class="empty">لا إجراءات معلّقة حالياً</div>'}
      </article>
      ${renderSearch()}
      <div class="grid-2">
        <article class="card">
          <h3>أشخاص يحتاجون متابعة</h3>
          ${follow.map((p) => `<div class="gov-mini-row"><button type="button" class="gov-name-link" data-action="gov-profile" data-id="${esc(p.id)}">${esc(p.name)}</button><span>${p.complianceScore}% ${bar(p.complianceScore)}</span></div>`).join('') || '<div class="empty">لا يوجد</div>'}
        </article>
        <article class="card">
          <h3>عقود ستنتهي</h3>
          ${(g.contracts || [])
            .filter((c) => c.status === 'Active')
            .slice(0, 5)
            .map((c) => `<div class="gov-mini-row"><strong>${esc(c.name)}</strong><span class="muted">${esc(c.endDate)} · ${esc(c.owner)}</span></div>`)
            .join('') || '<div class="empty">لا عقود</div>'}
        </article>
      </div>
      <div class="grid-2" style="margin-top:12px">
        <article class="card">
          <h3>موافقات معلّقة</h3>
          ${(g.approvals || [])
            .filter((a) => a.status === 'Pending')
            .slice(0, 5)
            .map((a) => `<div class="gov-mini-row"><strong>${esc(a.type)}</strong> · ${esc(a.relatedEntity)}<span class="muted">${esc(a.assignedTo)}</span></div>`)
            .join('') || '<div class="empty">لا موافقات</div>'}
        </article>
        <article class="card">
          <h3>آخر العمليات</h3>
          ${(g.auditLog || [])
            .slice(0, 6)
            .map((a) => `<div class="gov-mini-row"><strong>${esc(a.action)}</strong> · ${esc(a.entityLabel || '—')}<span class="muted">${fmtTime(a.at)}</span></div>`)
            .join('')}
        </article>
      </div>`;
  };

  const renderPeople = (g, user) => {
    const list = filterPeople(g);
    const page = paginate(list);
    const branches = unique((g.people || []).map((p) => p.branch));
    const deps = unique((g.people || []).map((p) => p.department));
    const plats = unique((g.people || []).map((p) => p.platform));
    const roles = unique((g.people || []).map((p) => p.governanceRole));
    const opt = (arr, cur) => `<option value="">الكل</option>${arr.map((x) => `<option value="${esc(x)}" ${cur === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}`;
    return `<div class="card" style="padding:12px;margin-bottom:12px">
        <div class="toolbar" style="gap:8px;flex-wrap:wrap;align-items:flex-end">
          <label class="field" style="flex:1;min-width:200px"><span>ابحث بالاسم، الرقم، الهاتف، البريد، القسم...</span>
            <input data-gov-change="q" value="${esc(ui.filters.q)}" placeholder="🔍 بحث" />
          </label>
          <label class="field"><span>الفرع</span><select data-gov-change="branch">${opt(branches, ui.filters.branch)}</select></label>
          <label class="field"><span>القسم</span><select data-gov-change="department">${opt(deps, ui.filters.department)}</select></label>
          <label class="field"><span>المنصة</span><select data-gov-change="platform">${opt(plats, ui.filters.platform)}</select></label>
          <label class="field"><span>الدور</span><select data-gov-change="role">${opt(roles, ui.filters.role)}</select></label>
          <label class="field"><span>الحالة</span><select data-gov-change="status"><option value="">الكل</option><option value="Active" ${ui.filters.status === 'Active' ? 'selected' : ''}>نشط</option><option value="Inactive" ${ui.filters.status === 'Inactive' ? 'selected' : ''}>غير نشط</option></select></label>
          <label class="field"><span>الامتثال</span><select data-gov-change="compliance"><option value="">الكل</option><option value="high" ${ui.filters.compliance === 'high' ? 'selected' : ''}>مرتفع</option><option value="low" ${ui.filters.compliance === 'low' ? 'selected' : ''}>منخفض</option></select></label>
        </div>
      </div>
      <article class="card">
        <div class="toolbar"><h3 style="margin:0">الأشخاص والجهات</h3><span class="badge badge-outline">${page.total}</span></div>
        ${!page.total ? `<div class="empty">لا يوجد أشخاص.<div style="margin-top:8px"><button type="button" class="btn btn-primary" data-action="gov-modal" data-modal="person">+ إضافة شخص</button></div></div>` : `
        <div class="gov-table-wrap table-wrap"><table class="data gov-table">
          <thead><tr>
            <th></th><th>Governance ID</th><th>الاسم</th><th>رقم الموظف</th><th>المكتب</th><th>الهاتف</th><th>البريد</th>
            <th>الفرع</th><th>القسم</th><th>المنصة</th><th>الدور</th><th>المدير</th><th>الامتثال</th><th>الحالة</th><th>الإجراءات</th>
          </tr></thead>
          <tbody>${page.rows
            .map(
              (p) => `<tr>
              <td>${avatar(p)}</td>
              <td><code>${esc(p.id)}</code></td>
              <td><button type="button" class="gov-name-link" data-action="gov-profile" data-id="${esc(p.id)}">${esc(p.name)}</button></td>
              <td>${esc(p.employeeId || '—')}</td>
              <td>${esc(p.officeNumber || '—')}</td>
              <td>${esc(p.phone || '—')}</td>
              <td>${esc(p.email || '—')}</td>
              <td>${esc(p.branch || '—')}</td>
              <td>${esc(p.department || '—')}</td>
              <td>${esc(p.platform || '—')}</td>
              <td>${esc(p.governanceRole || '—')}</td>
              <td>${esc(p.manager || '—')}</td>
              <td><button type="button" class="gov-name-link" data-action="gov-profile" data-id="${esc(p.id)}" data-dtab="compliance">${p.complianceScore ?? 0}%</button> ${bar(p.complianceScore)}</td>
              <td><span class="badge ${p.status === 'Active' ? 'badge-black' : 'badge-gray'}">${esc(stLabel(p.status))}</span></td>
              <td>
                <div class="gov-actions">
                  <button type="button" class="btn btn-sm btn-ghost" data-action="gov-profile" data-id="${esc(p.id)}" title="عرض الملف">عرض الملف</button>
                  <button type="button" class="btn btn-sm btn-ghost" data-action="gov-menu" data-id="${esc(p.id)}" title="المزيد">⋮</button>
                  ${ui.menuOpen === p.id ? `<div class="gov-row-menu">
                    <button type="button" data-action="gov-edit-person" data-id="${esc(p.id)}">تعديل</button>
                    <button type="button" data-action="gov-profile" data-id="${esc(p.id)}" data-dtab="policies">السياسات</button>
                    <button type="button" data-action="gov-profile" data-id="${esc(p.id)}" data-dtab="compliance">الامتثال</button>
                    <button type="button" data-action="gov-profile" data-id="${esc(p.id)}" data-dtab="contracts">العقود</button>
                    <button type="button" data-action="gov-profile" data-id="${esc(p.id)}" data-dtab="rewards">المكافآت</button>
                    <button type="button" data-action="gov-profile" data-id="${esc(p.id)}" data-dtab="approvals">المهام</button>
                    <button type="button" data-action="gov-profile" data-id="${esc(p.id)}" data-dtab="docs">المستندات</button>
                    <button type="button" data-action="gov-profile" data-id="${esc(p.id)}" data-dtab="activity">سجل النشاط</button>
                  </div>` : ''}
                </div>
              </td>
            </tr>`
            )
            .join('')}</tbody>
        </table></div>
        <div class="toolbar" style="justify-content:space-between;margin-top:10px">
          <span class="muted">عرض ${page.start + 1}–${page.end} من ${page.total}</span>
          <div style="display:flex;gap:4px">
            <select data-gov-change="pageSize">${PAGE_SIZES.map((n) => `<option value="${n}" ${ui.pageSize === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
            <button type="button" class="btn btn-sm btn-ghost" data-action="gov-page" data-dir="prev">السابق</button>
            <button type="button" class="btn btn-sm btn-ghost" data-action="gov-page" data-dir="next">التالي</button>
          </div>
        </div>`}
      </article>`;
  };

  const renderProfileBody = (g, p) => {
    const policies = (g.policies || []).filter((pol) => (pol.assignments || []).some((a) => a.personId === p.id) || (p.policyIds || []).includes(pol.id));
    const contracts = (g.contracts || []).filter((c) => c.relatedId === p.id || c.party2 === p.name);
    const rewards = (g.rewards || []).filter((r) => r.beneficiaryId === p.id || r.beneficiary === p.name);
    const violations = (g.violations || []).filter((v) => v.personId === p.id || v.person === p.name);
    const docs = (g.documents || []).filter((d) => contracts.some((c) => c.id === d.relatedEntity) || policies.some((pol) => pol.id === d.relatedEntity));
    const audit = (g.auditLog || []).filter((a) => a.entityId === p.id || a.entityLabel === p.name).slice(0, 40);
    const approvals = (g.approvals || []).filter((a) => String(a.relatedEntity || '').includes(p.name));
    const nav = PROFILE_TABS.map(
      (t) =>
        `<button type="button" class="btn btn-sm ${ui.drawerTab === t.id ? 'btn-dark' : 'btn-ghost'}" data-action="gov-drawer-tab" data-dtab="${esc(t.id)}">${esc(t.label)}</button>`
    ).join('');
    let body = '';
    switch (ui.drawerTab) {
      case 'work':
        body = `<div class="gov-form-grid">
          <div><div class="muted">الشركة</div><strong>${esc(p.company)}</strong></div>
          <div><div class="muted">الفرع</div><strong>${esc(p.branch)}</strong></div>
          <div><div class="muted">الإدارة/القسم</div><strong>${esc(p.department)} · ${esc(p.section)}</strong></div>
          <div><div class="muted">الفريق</div><strong>${esc(p.team)}</strong></div>
          <div><div class="muted">المنصة</div><strong>${esc(p.platform)}</strong></div>
          <div><div class="muted">المدير المباشر</div><strong>${esc(p.manager)}</strong></div>
          <div><div class="muted">Governance Manager</div><strong>${esc(p.governanceManager)}</strong></div>
        </div>`;
        break;
      case 'roles':
        body = `<div class="gov-form-grid">
          <div><div class="muted">Governance Role</div><strong>${esc(p.governanceRole)}</strong></div>
          <div><div class="muted">Authority Level</div><strong>${esc(p.authorityLevel)}</strong></div>
          <div><div class="muted">Approval Limit</div><strong>${esc(p.approvalLimit)}</strong></div>
          <div><div class="muted">اللجان</div><strong>${esc((p.committeeIds || []).join(' · ') || '—')}</strong></div>
        </div>`;
        break;
      case 'policies':
        body = policies.length
          ? policies
              .map((pol) => {
                const a = (pol.assignments || []).find((x) => x.personId === p.id);
                return `<div class="gov-mini-row"><strong>${esc(pol.title)}</strong><span>${esc(stLabel(a?.status || '—'))} · ${esc(pol.code)}</span>
                  ${a && a.status !== 'Acknowledged' ? `<button type="button" class="btn btn-sm btn-primary" data-action="gov-ack" data-pid="${esc(pol.id)}" data-uid="${esc(p.id)}">إقرار</button>` : ''}
                </div>`;
              })
              .join('')
          : '<div class="empty">لا سياسات مرتبطة</div>';
        break;
      case 'compliance':
        body = `<p>Compliance Score: <strong>${p.complianceScore}%</strong> ${bar(p.complianceScore)}</p>
          <p class="muted">Drill-down من المتطلبات والسياسات المرتبطة بهذا الشخص.</p>
          ${(g.complianceRequirements || [])
            .map(
              (c) =>
                `<div class="gov-mini-row"><strong>${esc(c.name)}</strong><span>${c.currentScore}% / هدف ${c.target}% · ${esc(stLabel(c.status))}</span>
                <button type="button" class="btn btn-sm btn-ghost" data-action="gov-comp-detail" data-id="${esc(c.id)}">التفاصيل</button></div>`
            )
            .join('')}`;
        break;
      case 'quality':
        body = (g.standards || [])
          .map(
            (s) =>
              `<div class="gov-mini-row"><strong>${esc(s.name)}</strong><span>${s.currentValue}% · هدف ${s.target}% · مصدر: ${esc(s.dataSource)}</span>
              <button type="button" class="btn btn-sm btn-ghost" data-action="gov-qs-detail" data-id="${esc(s.id)}">كيف حُسب؟</button></div>`
          )
          .join('') || '<div class="empty">لا معايير</div>';
        break;
      case 'contracts':
        body = `${can({}, 'edit') || true ? `<button type="button" class="btn btn-sm btn-primary" data-action="gov-modal" data-modal="contract" data-person="${esc(p.id)}">+ إضافة عقد</button>` : ''}
          ${contracts
            .map(
              (c) =>
                `<div class="gov-mini-row"><strong>${esc(c.id)}</strong> · ${esc(c.type)} · ${esc(c.startDate)} → ${esc(c.endDate)} · ${esc(stLabel(c.status))} · المسؤول: ${esc(c.owner)}</div>`
            )
            .join('') || '<div class="empty">لا عقود</div>'}`;
        break;
      case 'rewards':
        body = `<button type="button" class="btn btn-sm btn-primary" data-action="gov-modal" data-modal="reward" data-person="${esc(p.id)}">+ منح مكافأة</button>
          ${rewards
            .map(
              (r) =>
                `<div class="card" style="padding:10px;margin-top:8px">
                  <strong>${esc(r.type)} · ${esc(r.value)}</strong>
                  <div>السبب: ${esc(r.reason)}</div>
                  <div class="muted">المصدر: ${esc(sourceLabel(r.source))} · طلبها: ${esc(r.requestedBy)} · اعتمدها: ${esc(r.approvedBy || '—')} · منحها: ${esc(r.grantedBy || '—')}</div>
                  <div class="muted">${fmtTime(r.at)} · ${esc(stLabel(r.status))}</div>
                </div>`
            )
            .join('') || '<div class="empty">لا مكافآت</div>'}`;
        break;
      case 'decisions':
        body = (g.decisions || [])
          .map((d) => `<div class="gov-mini-row"><strong>${esc(d.title)}</strong><span>${esc(stLabel(d.status))} · ${esc(d.committee)}</span></div>`)
          .join('') || '<div class="empty">لا قرارات</div>';
        break;
      case 'approvals':
        body = approvals.map((a) => `<div class="gov-mini-row"><strong>${esc(a.type)}</strong> · ${esc(a.relatedEntity)} · ${esc(stLabel(a.status))}</div>`).join('') || '<div class="empty">لا مهام</div>';
        break;
      case 'violations':
        body = violations.map((v) => `<div class="gov-mini-row"><strong>${esc(v.type)}</strong> · ${esc(v.description)} · ${esc(stLabel(v.status))}</div>`).join('') || '<div class="empty">لا مخالفات</div>';
        break;
      case 'docs':
        body = docs.map((d) => `<div class="gov-mini-row"><strong>${esc(d.name)}</strong> · ${esc(d.type)} · v${esc(d.version)}</div>`).join('') || '<div class="empty">لا مستندات</div>';
        break;
      case 'activity':
        body = audit.map((a) => `<div class="gov-mini-row"><strong>${esc(a.action)}</strong> · ${esc(a.field || '')} ${esc(a.oldValue || '')} → ${esc(a.newValue || '')}<span class="muted">${esc(a.user)} · ${fmtTime(a.at)}</span></div>`).join('') || '<div class="empty">لا سجل</div>';
        break;
      default:
        body = `<div class="grid-2">
          <article class="card"><h4>بطاقة التواصل</h4>
            <div>رقم المكتب: <strong>${esc(p.officeNumber || '—')}</strong></div>
            <div>الهاتف: <strong>${esc(p.phone || '—')}</strong></div>
            <div>داخلي: <strong>${esc(p.extension || '—')}</strong></div>
            <div>البريد: <strong>${esc(p.email || '—')}</strong></div>
            <div>الموقع: <strong>${esc(p.branch || '—')}</strong></div>
          </article>
          <article class="card"><h4>البطاقة التنظيمية</h4>
            <div>${esc(p.company)} → ${esc(p.branch)} → ${esc(p.department)} → ${esc(p.section)} → ${esc(p.platform)} → ${esc(p.name)}</div>
            <div>المدير: <strong>${esc(p.manager)}</strong></div>
          </article>
        </div>
        <article class="card" style="margin-top:12px"><h4>بطاقة الحوكمة</h4>
          <div class="gov-form-grid">
            <div>Role: <strong>${esc(p.governanceRole)}</strong></div>
            <div>Compliance: <strong>${p.complianceScore}%</strong></div>
            <div>Risk: <strong>${esc(p.riskLevel)}</strong></div>
            <div>Authority: <strong>${esc(p.authorityLevel)}</strong></div>
          </div>
        </article>
        <article class="card" style="margin-top:12px"><h4>مصدر البيانات</h4>
          <div class="gov-form-grid">
            ${field('المصدر', '', sourceLabel(p.source), { readonly: true })}
            ${field('طريقة الإضافة', '', p.creationMethod, { readonly: true })}
            ${field('أنشئ بواسطة', '', p.createdBy, { readonly: true })}
            ${field('Created At', '', fmtTime(p.createdAt), { readonly: true })}
            ${field('Last Synced', '', fmtTime(p.lastSynced), { readonly: true })}
            ${field('Last Modified By', '', p.lastModifiedBy, { readonly: true })}
            ${field('External ID', '', p.externalId || '—', { readonly: true })}
          </div>
        </article>`;
    }
    return `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">${nav}</div>${body}`;
  };

  const renderDrawer = (g, user) => {
    if (!ui.drawer) return '';
    const p = personById(g, ui.drawer);
    if (!p) return '';
    return `<aside class="card gov-drawer">
      <div class="toolbar" style="position:sticky;top:0;background:#fff;z-index:1;border-bottom:1px solid var(--border);padding-bottom:10px">
        <div style="display:flex;gap:12px;align-items:center">
          ${avatar(p)}
          <div>
            <h2 style="margin:0">ملف الحوكمة 360 · ${esc(p.name)}</h2>
            <div class="muted">${esc(p.id)} · ${esc(p.employeeId)} · ${esc(p.title)} · <span class="badge badge-black">${esc(stLabel(p.status))}</span></div>
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-ghost" data-action="gov-drawer-close">✕</button>
      </div>
      <div class="toolbar" style="gap:6px;margin:12px 0;flex-wrap:wrap">
        <button type="button" class="btn btn-sm btn-dark" data-action="gov-edit-person" data-id="${esc(p.id)}">تعديل البيانات</button>
        <button type="button" class="btn btn-sm btn-ghost" data-action="gov-assign-policy" data-id="${esc(p.id)}">إسناد سياسة</button>
        <button type="button" class="btn btn-sm btn-ghost" data-action="gov-modal" data-modal="contract" data-person="${esc(p.id)}">إضافة عقد</button>
        <button type="button" class="btn btn-sm btn-primary" data-action="gov-modal" data-modal="reward" data-person="${esc(p.id)}">منح مكافأة</button>
        <button type="button" class="btn btn-sm btn-ghost" data-action="gov-tab" data-tab="approvals">إنشاء مهمة</button>
      </div>
      ${renderProfileBody(g, p)}
    </aside>
    <div class="gov-drawer-backdrop" data-action="gov-drawer-close"></div>`;
  };

  const emptyAdd = (label, modal) =>
    `<div class="empty">${esc(label)}<div style="margin-top:8px"><button type="button" class="btn btn-primary" data-action="gov-modal" data-modal="${esc(modal)}">+ إضافة</button></div></div>`;

  const renderPolicies = (g) => {
    const rows = g.policies || [];
    if (!rows.length) return emptyAdd('لا توجد سياسات حتى الآن.', 'policy');
    return `<article class="card">
      <div class="toolbar"><h3 style="margin:0">السياسات</h3><button type="button" class="btn btn-primary" data-action="gov-modal" data-modal="policy">+ إنشاء سياسة</button></div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Policy ID</th><th>الاسم</th><th>الفئة</th><th>الإصدار</th><th>المالك</th><th>على من تطبق؟</th><th>السريان</th><th>الإقرار</th><th>الحالة</th><th></th></tr></thead>
        <tbody>${rows
          .map((p) => {
            const asg = p.assignments || [];
            const ack = asg.filter((a) => a.status === 'Acknowledged').length;
            return `<tr>
              <td><code>${esc(p.code || p.id)}</code></td>
              <td><button type="button" class="gov-name-link" data-action="gov-policy-detail" data-id="${esc(p.id)}">${esc(p.title)}</button></td>
              <td>${esc(p.category || p.scope || '—')}</td>
              <td>${esc(p.version || '—')}</td>
              <td>${esc(p.owner || '—')}</td>
              <td>${esc(p.appliesTo?.label || p.scope || '—')}</td>
              <td>${esc(p.effectiveDate || '—')}</td>
              <td>${asg.length ? `${ack}/${asg.length}` : '—'}</td>
              <td><span class="badge badge-outline">${esc(stLabel(p.status))}</span></td>
              <td>${!/active/i.test(String(p.status)) ? `<button class="btn btn-sm btn-primary" data-action="gov-activate-policy" data-id="${esc(p.id)}">تفعيل</button>` : `<button class="btn btn-sm btn-ghost" data-action="gov-policy-detail" data-id="${esc(p.id)}">عرض الأشخاص</button>`}</td>
            </tr>`;
          })
          .join('')}</tbody>
      </table></div>
    </article>`;
  };

  const renderCompliance = (g) => {
    const rows = g.complianceRequirements || [];
    if (!rows.length) return emptyAdd('لم تتم إضافة متطلبات امتثال.', 'compliance');
    return `<article class="card">
      <div class="toolbar"><h3 style="margin:0">الامتثال</h3><button type="button" class="btn btn-primary" data-action="gov-modal" data-modal="compliance">+ إضافة متطلب امتثال</button></div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>ID</th><th>الاسم</th><th>Framework</th><th>يطبق على</th><th>Owner</th><th>الدليل المطلوب</th><th>Target</th><th>الحالي</th><th>الحالة</th><th></th></tr></thead>
        <tbody>${rows
          .map(
            (c) => `<tr>
            <td><code>${esc(c.id)}</code></td>
            <td>${esc(c.name)}</td>
            <td>${esc(c.framework)}</td>
            <td>${esc(c.appliesTo?.label || '—')}</td>
            <td>${esc(c.owner)}</td>
            <td>${esc(c.evidenceRequired)}</td>
            <td>${c.target}%</td>
            <td><button type="button" class="gov-name-link" data-action="gov-comp-detail" data-id="${esc(c.id)}">${c.currentScore}%</button> ${bar(c.currentScore)}</td>
            <td>${esc(stLabel(c.status))}</td>
            <td><button type="button" class="btn btn-sm btn-ghost" data-action="gov-comp-detail" data-id="${esc(c.id)}">ما الدليل؟</button></td>
          </tr>`
          )
          .join('')}</tbody>
      </table></div>
    </article>`;
  };

  const renderQuality = (g) => {
    const rows = g.standards || [];
    if (!rows.length) return emptyAdd('لا توجد معايير جودة.', 'quality');
    return `<article class="card">
      <div class="toolbar"><h3 style="margin:0">الجودة والمعايير</h3><button type="button" class="btn btn-primary" data-action="gov-modal" data-modal="quality">+ إضافة معيار جودة</button></div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>ID</th><th>الاسم</th><th>الفئة</th><th>يطبق على</th><th>Target</th><th>الحالي</th><th>المصدر</th><th>Owner</th><th>الحالة</th><th></th></tr></thead>
        <tbody>${rows
          .map(
            (s) => `<tr>
            <td><code>${esc(s.id)}</code></td>
            <td>${esc(s.name)}</td>
            <td>${esc(s.category || s.level || '—')}</td>
            <td>${esc(s.appliesTo?.label || '—')}</td>
            <td>${s.target}</td>
            <td>${s.currentValue ?? s.description ?? '—'} ${typeof s.currentValue === 'number' ? bar(s.currentValue) : ''}</td>
            <td>${esc(s.dataSource || '—')}</td>
            <td>${esc(s.owner || '—')}</td>
            <td>${esc(stLabel(s.status || '—'))}</td>
            <td><button type="button" class="btn btn-sm btn-ghost" data-action="gov-qs-detail" data-id="${esc(s.id)}">من أين النتيجة؟</button></td>
          </tr>`
          )
          .join('')}</tbody>
      </table></div>
    </article>`;
  };

  const renderContracts = (g) => {
    const rows = g.contracts || [];
    if (!rows.length) return emptyAdd('لا توجد عقود.', 'contract');
    return `<article class="card">
      <div class="toolbar"><h3 style="margin:0">العقود</h3><button type="button" class="btn btn-primary" data-action="gov-modal" data-modal="contract">+ إضافة عقد</button></div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>ID</th><th>الاسم</th><th>الأطراف</th><th>مرتبط بـ</th><th>النوع</th><th>القيمة</th><th>الفترة</th><th>Owner</th><th>الحالة</th></tr></thead>
        <tbody>${rows
          .map(
            (c) => `<tr>
            <td><code>${esc(c.id)}</code></td>
            <td>${esc(c.name)}</td>
            <td>${esc(c.party1)} / ${esc(c.party2)}</td>
            <td>${esc(c.relatedLabel || '—')}</td>
            <td>${esc(c.type)}</td>
            <td>${esc(c.value)}</td>
            <td>${esc(c.startDate)} → ${esc(c.endDate)}</td>
            <td>${esc(c.owner)}</td>
            <td>${esc(stLabel(c.status))}</td>
          </tr>`
          )
          .join('')}</tbody>
      </table></div>
    </article>`;
  };

  const renderRewards = (g) => {
    const rows = g.rewards || g.penaltiesRewards || [];
    return `<article class="card">
      <div class="toolbar"><h3 style="margin:0">المكافآت والتقدير</h3><button type="button" class="btn btn-primary" data-action="gov-modal" data-modal="reward">+ منح مكافأة</button></div>
      ${!rows.length ? emptyAdd('لا مكافآت بعد.', 'reward') : `<div class="table-wrap"><table class="data">
        <thead><tr><th>ID</th><th>المستفيد</th><th>النوع</th><th>القيمة</th><th>السبب</th><th>المصدر</th><th>طلب</th><th>اعتماد</th><th>منح</th><th>الحالة</th><th>التاريخ</th></tr></thead>
        <tbody>${rows
          .map(
            (r) => `<tr>
            <td><code>${esc(r.id)}</code></td>
            <td>${esc(r.beneficiary || r.target)}</td>
            <td>${esc(r.type)}</td>
            <td>${esc(r.value ?? r.points)}</td>
            <td>${esc(r.reason)}</td>
            <td>${esc(sourceLabel(r.source))}</td>
            <td>${esc(r.requestedBy || '—')}</td>
            <td>${esc(r.approvedBy || '—')}</td>
            <td>${esc(r.grantedBy || '—')}</td>
            <td>${esc(stLabel(r.status || '—'))}</td>
            <td>${fmtTime(r.at || r.createdAt)}</td>
          </tr>`
          )
          .join('')}</tbody>
      </table></div>`}
    </article>`;
  };

  const renderOrg = (g) => `<div class="grid-2">
      <article class="card">
        <div class="toolbar"><h3 style="margin:0">الهيكل التنظيمي</h3>
          <div style="display:flex;gap:6px">
            <button type="button" class="btn btn-sm btn-dark" data-action="gov-modal" data-modal="branch">+ فرع</button>
            <button type="button" class="btn btn-sm btn-dark" data-action="gov-modal" data-modal="department">+ قسم</button>
            <button type="button" class="btn btn-sm btn-dark" data-action="gov-modal" data-modal="platform">+ منصة</button>
          </div>
        </div>
        ${(g.branches || [])
          .map(
            (b) => `<div class="gov-org-node">
            <strong>${esc(b.name)}</strong>
            <div class="muted">${esc(b.address)} · ${esc(b.manager)} · ${esc(stLabel(b.status))}</div>
            <div style="margin-right:12px">${(g.departments || [])
              .filter((d) => d.branchId === b.id)
              .map(
                (d) => `<div class="gov-org-node">
                <strong>${esc(d.name)}</strong>
                <div class="muted">${esc(d.manager)}</div>
                <div style="margin-right:12px">${(g.platforms || [])
                  .filter((p) => p.departmentId === d.id)
                  .map((p) => `<div class="gov-org-node"><strong>${esc(p.name)}</strong><div class="muted">${esc(p.owner)}</div>
                    ${(g.people || [])
                      .filter((pe) => pe.platformId === p.id)
                      .slice(0, 5)
                      .map((pe) => `<div><button type="button" class="gov-name-link" data-action="gov-profile" data-id="${esc(pe.id)}">${esc(pe.name)}</button></div>`)
                      .join('')}
                  </div>`)
                  .join('')}</div>
              </div>`
              )
              .join('')}</div>
          </div>`
          )
          .join('')}
      </article>
      <article class="card">
        <h3>الفروع · الأقسام · المنصات</h3>
        <p class="muted">الفروع: ${(g.branches || []).length} · الأقسام: ${(g.departments || []).length} · المنصات: ${(g.platforms || []).length}</p>
      </article>
    </div>`;

  const renderApprovals = (g, user) => {
    let rows = g.approvals || [];
    if (ui.approvalFilter === 'mine') rows = rows.filter((a) => a.status === 'Pending');
    if (ui.approvalFilter === 'done') rows = rows.filter((a) => a.status !== 'Pending');
    return `<article class="card">
      <div class="toolbar">
        <h3 style="margin:0">المهام والموافقات</h3>
        <div style="display:flex;gap:4px">
          <button type="button" class="btn btn-sm ${ui.approvalFilter === 'mine' ? 'btn-dark' : 'btn-ghost'}" data-action="gov-apr-filter" data-f="mine">بانتظاري</button>
          <button type="button" class="btn btn-sm ${ui.approvalFilter === 'all' ? 'btn-dark' : 'btn-ghost'}" data-action="gov-apr-filter" data-f="all">الكل</button>
          <button type="button" class="btn btn-sm ${ui.approvalFilter === 'done' ? 'btn-dark' : 'btn-ghost'}" data-action="gov-apr-filter" data-f="done">مكتملة</button>
        </div>
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>ID</th><th>النوع</th><th>الكيان</th><th>طلب</th><th>مُسند إلى</th><th>الموعد</th><th>الحالة</th><th></th></tr></thead>
        <tbody>${rows
          .map(
            (a) => `<tr>
            <td><code>${esc(a.id)}</code></td>
            <td>${esc(a.type)}</td>
            <td>${esc(a.relatedEntity)}</td>
            <td>${esc(a.requestedBy)}</td>
            <td>${esc(a.assignedTo)}</td>
            <td>${fmtTime(a.deadline)}</td>
            <td>${esc(stLabel(a.status))}</td>
            <td>${
              a.status === 'Pending'
                ? `<button class="btn btn-sm btn-primary" data-action="gov-apr" data-id="${esc(a.id)}" data-decision="approve">اعتماد</button>
                   <button class="btn btn-sm btn-ghost" data-action="gov-apr" data-id="${esc(a.id)}" data-decision="reject">رفض</button>`
                : '—'
            }</td>
          </tr>`
          )
          .join('') || '<tr><td colspan="8" class="empty">لا عناصر</td></tr>'}</tbody>
      </table></div>
    </article>`;
  };

  const renderDecisions = (g) => `<div class="grid-2">
      <article class="card">
        <div class="toolbar"><h3 style="margin:0">القرارات</h3><button type="button" class="btn btn-primary" data-action="gov-modal" data-modal="decision">+ إنشاء قرار</button></div>
        ${(g.decisions || []).map((d) => `<div class="gov-mini-row"><strong>${esc(d.title)}</strong><span>${esc(stLabel(d.status))} · ${esc(d.owner)}</span></div>`).join('') || '<div class="empty">لا قرارات</div>'}
      </article>
      <article class="card">
        <div class="toolbar"><h3 style="margin:0">اللجان</h3><button type="button" class="btn btn-primary" data-action="gov-modal" data-modal="committee">+ إضافة لجنة</button></div>
        ${(g.committees || []).map((c) => `<div class="gov-mini-row"><strong>${esc(c.name)}</strong><span>${esc(c.chairperson)} · ${(c.members || []).length} أعضاء</span></div>`).join('') || '<div class="empty">لا لجان</div>'}
      </article>
    </div>`;

  const renderViolations = (g) => `<div class="grid-2">
      <article class="card">
        <div class="toolbar"><h3 style="margin:0">المخالفات</h3><button type="button" class="btn btn-primary" data-action="gov-modal" data-modal="violation">+ تسجيل مخالفة</button></div>
        ${(g.violations || []).map((v) => `<div class="gov-mini-row"><strong>${esc(v.person || v.type)}</strong><span>${esc(v.description)} · ${esc(stLabel(v.status))}</span></div>`).join('') || '<div class="empty">لا مخالفات</div>'}
      </article>
      <article class="card">
        <div class="toolbar"><h3 style="margin:0">المخاطر</h3><button type="button" class="btn btn-dark" data-action="gov-modal" data-modal="risk">+ إضافة خطر</button></div>
        ${(g.risks || []).map((r) => `<div class="gov-mini-row"><strong>${esc(r.title)}</strong><span>Score ${r.riskScore} · ${esc(r.owner)}</span></div>`).join('') || '<div class="empty">لا مخاطر</div>'}
      </article>
    </div>`;

  const renderAudit = (g) => `<article class="card">
      <h3>سجل العمليات</h3>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Transaction</th><th>المستخدم</th><th>العملية</th><th>الكيان</th><th>الحقل</th><th>السابق</th><th>الجديد</th><th>المصدر</th><th>الوقت</th></tr></thead>
        <tbody>${(g.auditLog || [])
          .slice(0, 100)
          .map(
            (a) => `<tr>
            <td><code>${esc(a.id)}</code></td>
            <td>${esc(a.user)}</td>
            <td>${esc(a.action)}</td>
            <td>${esc(a.entityLabel || a.entityId || '—')}</td>
            <td>${esc(a.field || '—')}</td>
            <td>${esc(a.oldValue || '—')}</td>
            <td>${esc(a.newValue || '—')}</td>
            <td>${esc(sourceLabel(a.source))}</td>
            <td>${fmtTime(a.at)}</td>
          </tr>`
          )
          .join('')}</tbody>
      </table></div>
    </article>`;

  const renderReports = (g) => `<article class="card">
      <h3>تقارير الحوكمة</h3>
      <div class="grid-2">
        ${['ملخص تنفيذي', 'امتثال السياسات', 'امتثال الموظفين', 'امتثال الأقسام', 'تقرير الجودة', 'العقود', 'العقود المنتهية', 'المكافآت', 'المخالفات', 'المخاطر', 'أداء الموافقات', 'سجل التدقيق']
          .map(
            (r) =>
              `<button type="button" class="btn btn-ghost" style="justify-content:flex-start" data-action="gov-export-report" data-report="${esc(r)}"><i class="fas fa-file-export"></i> ${esc(r)}</button>`
          )
          .join('')}
      </div>
    </article>`;

  const renderSettings = (g, user) => {
    if (!can(user, 'settings') && permLevel(user) !== 'admin') return '<div class="empty">ليست لديك صلاحية الإعدادات.</div>';
    const s = g.settings || {};
    return `<article class="card">
      <h3>إعدادات الحوكمة</h3>
      <p class="muted">الإعدادات العامة · الهيكل · الأدوار · أنواع السياسات · Frameworks · الجودة · العقود · المكافآت · Workflows · المخاطر · الإشعارات · الصلاحيات · التدقيق</p>
      ${field('حجم الصفحة', 'gov-set-ps', s.pageSize || 25, { type: 'number' })}
      <label class="field" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" id="gov-set-rap" ${s.requireRewardApproval ? 'checked' : ''} /> تتطلب المكافآت اعتماداً</label>
      <p>Frameworks: ${(g.frameworks || []).join(' · ')}</p>
      <button type="button" class="btn btn-primary" data-action="gov-settings-save">حفظ الإعدادات</button>
    </article>`;
  };

  const renderDetailModal = (g) => {
    if (ui.modal === 'policy-detail') {
      const p = (g.policies || []).find((x) => x.id === ui.detailId);
      if (!p) return '';
      const asg = p.assignments || [];
      const ack = asg.filter((a) => a.status === 'Acknowledged').length;
      const pending = asg.filter((a) => a.status !== 'Acknowledged').length;
      return modalShell(
        p.title,
        `<p>على من تطبق هذه السياسة؟ <strong>${esc(p.appliesTo?.label || '—')}</strong></p>
         <p>الأشخاص المطلوب منهم الامتثال: <strong>${asg.length}</strong> · امتثل: ${ack} · لم يمتثل/متأخر: ${pending}</p>
         <div class="table-wrap"><table class="data"><thead><tr><th>الشخص</th><th>الحالة</th><th></th></tr></thead>
         <tbody>${asg
           .map(
             (a) =>
               `<tr><td><button type="button" class="gov-name-link" data-action="gov-profile" data-id="${esc(a.personId)}">${esc(a.person)}</button></td><td>${esc(stLabel(a.status))}</td>
               <td>${a.status !== 'Acknowledged' ? `<button class="btn btn-sm btn-primary" data-action="gov-ack" data-pid="${esc(p.id)}" data-uid="${esc(a.personId)}">إقرار</button>` : '—'}</td></tr>`
           )
           .join('')}</tbody></table></div>`,
        `<button type="button" class="btn btn-ghost" data-action="gov-modal-close">إغلاق</button>`
      );
    }
    if (ui.modal === 'comp-detail') {
      const c = (g.complianceRequirements || []).find((x) => x.id === ui.detailId);
      if (!c) return '';
      return modalShell(
        c.name,
        `<p>Score: <strong>${c.currentScore}%</strong> · الهدف: ${c.target}%</p>
         <p>طريقة القياس: <strong>${esc(c.measurement || '—')}</strong></p>
         <p>ما الدليل على الالتزام؟ <strong>${esc(c.evidenceRequired)}</strong></p>
         <p>المسؤول: ${esc(c.owner)} · Reviewer: ${esc(c.reviewer)} · Approver: ${esc(c.approver)}</p>
         ${(c.evidence || []).map((e) => `<div class="gov-mini-row">${esc(e.name)} · ${esc(e.uploadedBy)} · ${esc(stLabel(e.status))}</div>`).join('') || '<div class="empty">لا أدلة مرفوعة</div>'}`,
        `<button type="button" class="btn btn-ghost" data-action="gov-modal-close">إغلاق</button>`
      );
    }
    if (ui.modal === 'qs-detail') {
      const s = (g.standards || []).find((x) => x.id === ui.detailId);
      if (!s) return '';
      return modalShell(
        s.name,
        `<p>الحالي: <strong>${s.currentValue}</strong> · الهدف: ${s.target} · الحالة: ${esc(stLabel(s.status))}</p>
         <p>من أين نحصل على نتيجة هذا المعيار؟ <strong>${esc(s.dataSource || '—')}</strong></p>
         <p>طريقة الحساب: <strong>${esc(s.calculation || '—')}</strong></p>
         <p>المسؤول: ${esc(s.owner)} · Reviewer: ${esc(s.reviewer)} · Frequency: ${esc(s.frequency)}</p>
         <h4>History</h4>
         ${(s.history || []).map((h) => `<div class="gov-mini-row">${fmtTime(h.at)} · ${h.value}</div>`).join('') || '<div class="empty">لا تاريخ</div>'}`,
        `<button type="button" class="btn btn-ghost" data-action="gov-modal-close">إغلاق</button>`
      );
    }
    return '';
  };

  const renderCreateModal = (g) => {
    const m = ui.modal;
    if (!m || String(m).includes('detail')) return '';
    const peopleOpts = (g.people || []).map((p) => `<option value="${esc(p.id)}" ${ui.wizardData.personId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    if (m === 'person') {
      return modalShell(
        'إضافة شخص/عضو حوكمة',
        `${field('الاسم *', 'gov-p-name', '', { required: true })}
         ${field('رقم الموظف', 'gov-p-emp', '')}
         ${field('الهاتف', 'gov-p-phone', '')}
         ${field('البريد', 'gov-p-email', '')}
         ${field('المكتب', 'gov-p-office', '')}
         ${field('الفرع', 'gov-p-branch', 'الفرع الرئيسي')}
         ${field('القسم', 'gov-p-dept', 'إدارة العمليات')}
         ${field('المنصة', 'gov-p-plat', 'المنصة الأساسية')}
         ${field('الدور', 'gov-p-role', 'موظف')}`,
        `<button type="button" class="btn btn-ghost" data-action="gov-modal-close">إلغاء</button>
         <button type="button" class="btn btn-primary" data-action="gov-save-person">حفظ</button>`
      );
    }
    if (m === 'policy') {
      return modalShell(
        'إنشاء سياسة',
        `<p class="muted">* الحقول المشار إليها مطلوبة</p>
         ${field('اسم السياسة *', 'gov-pol-title', '', { required: true, help: 'الاسم الظاهر للمستخدمين' })}
         ${field('الوصف', 'gov-pol-desc', '', { type: 'textarea' })}
         ${field('الفئة', 'gov-pol-cat', 'Security')}
         ${field('المالك', 'gov-pol-owner', 'Security Manager')}
         ${field('على من تطبق هذه السياسة؟', 'gov-pol-applies', 'تقنية المعلومات', { help: 'فرع / إدارة / قسم / منصة / Role / أشخاص' })}
         <label class="field" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" id="gov-pol-ack" checked /> تتطلب إقراراً</label>
         ${field('موعد الإقرار', 'gov-pol-deadline', '2026-09-30', { type: 'date' })}`,
        `<button type="button" class="btn btn-ghost" data-action="gov-modal-close">إلغاء</button>
         <button type="button" class="btn btn-primary" data-action="gov-save-policy">إنشاء السياسة</button>`
      );
    }
    if (m === 'compliance') {
      return modalShell(
        'إضافة معيار امتثال',
        `${field('اسم المعيار *', 'gov-c-name', '', { required: true })}
         ${field('Framework', 'gov-c-fw', '', { type: 'select', optionsHtml: (g.frameworks || []).map((f) => `<option>${esc(f)}</option>`).join('') })}
         ${field('الوصف', 'gov-c-desc', '', { type: 'textarea' })}
         ${field('من يجب أن يمتثل؟', 'gov-c-applies', 'All Employees')}
         ${field('ما الدليل على الالتزام؟', 'gov-c-ev', 'Training Certificate')}
         ${field('Target %', 'gov-c-target', '100', { type: 'number' })}
         ${field('طريقة القياس', 'gov-c-meas', 'Completed / Assigned × 100')}
         ${field('Owner', 'gov-c-owner', 'Compliance Officer')}`,
        `<button type="button" class="btn btn-ghost" data-action="gov-modal-close">إلغاء</button>
         <button type="button" class="btn btn-primary" data-action="gov-save-compliance">حفظ</button>`
      );
    }
    if (m === 'quality') {
      return modalShell(
        'إضافة معيار جودة',
        `${field('اسم المعيار *', 'gov-q-name', '', { required: true })}
         ${field('الوصف', 'gov-q-desc', '', { type: 'textarea' })}
         ${field('يطبق على', 'gov-q-applies', 'إدارة العمليات')}
         ${field('Target', 'gov-q-target', '95', { type: 'number' })}
         ${field('من أين نحصل على نتيجة هذا المعيار؟', 'gov-q-src', 'Tasks Module', { help: 'Manual / System / API / Survey / Audit / Tasks...' })}
         ${field('طريقة الحساب', 'gov-q-calc', 'Completed On Time / Total Completed × 100')}
         ${field('Owner', 'gov-q-owner', 'Operations Manager')}
         ${field('Reviewer', 'gov-q-rev', 'Quality Manager')}`,
        `<button type="button" class="btn btn-ghost" data-action="gov-modal-close">إلغاء</button>
         <button type="button" class="btn btn-primary" data-action="gov-save-quality">حفظ</button>`
      );
    }
    if (m === 'contract') {
      return modalShell(
        'إضافة عقد',
        `${field('اسم العقد *', 'gov-ct-name', '', { required: true })}
         <label class="field"><span>مرتبط بشخص</span><select id="gov-ct-person"><option value="">—</option>${peopleOpts}</select></label>
         ${field('الطرف الثاني', 'gov-ct-p2', '')}
         ${field('نوع العقد', 'gov-ct-type', 'Employment')}
         ${field('القيمة', 'gov-ct-val', '0', { type: 'number' })}
         ${field('البداية', 'gov-ct-start', '2026-01-01', { type: 'date' })}
         ${field('النهاية', 'gov-ct-end', '2026-12-31', { type: 'date' })}
         ${field('Owner', 'gov-ct-owner', 'HR')}`,
        `<button type="button" class="btn btn-ghost" data-action="gov-modal-close">إلغاء</button>
         <button type="button" class="btn btn-primary" data-action="gov-save-contract">حفظ وإرسال للاعتماد</button>`
      );
    }
    if (m === 'reward') {
      return modalShell(
        'منح مكافأة',
        `<label class="field"><span>المستفيد *</span><select id="gov-r-person">${peopleOpts}</select></label>
         ${field('النوع', 'gov-r-type', 'نقاط')}
         ${field('القيمة *', 'gov-r-val', '500', { type: 'number' })}
         ${field('السبب *', 'gov-r-reason', '', { type: 'textarea' })}
         ${field('المصدر', 'gov-r-src', 'Quality', { help: 'Manual / Manager / Performance / Quality / Compliance / Automation' })}`,
        `<button type="button" class="btn btn-ghost" data-action="gov-modal-close">إلغاء</button>
         <button type="button" class="btn btn-primary" data-action="gov-save-reward">إرسال للاعتماد</button>`
      );
    }
    if (m === 'decision') {
      return modalShell(
        'إنشاء قرار',
        `${field('عنوان القرار *', 'gov-d-title', '', { required: true })}
         ${field('اللجنة', 'gov-d-com', (g.committees || [])[0]?.name || '')}
         ${field('يطبق على', 'gov-d-applies', '')}`,
        `<button type="button" class="btn btn-ghost" data-action="gov-modal-close">إلغاء</button>
         <button type="button" class="btn btn-primary" data-action="gov-save-decision">حفظ</button>`
      );
    }
    if (m === 'committee') {
      return modalShell(
        'إضافة لجنة',
        `${field('اسم اللجنة *', 'gov-com-name', '', { required: true })}
         ${field('رئيس اللجنة', 'gov-com-chair', '')}
         ${field('الأمين', 'gov-com-sec', '')}
         ${field('الغرض', 'gov-com-purpose', '', { type: 'textarea' })}`,
        `<button type="button" class="btn btn-ghost" data-action="gov-modal-close">إلغاء</button>
         <button type="button" class="btn btn-primary" data-action="gov-save-committee">حفظ</button>`
      );
    }
    if (m === 'violation') {
      return modalShell(
        'تسجيل مخالفة',
        `<label class="field"><span>الشخص</span><select id="gov-v-person">${peopleOpts}</select></label>
         ${field('النوع', 'gov-v-type', 'Policy Overdue')}
         ${field('الوصف *', 'gov-v-desc', '', { type: 'textarea' })}
         ${field('السياسة المرتبطة', 'gov-v-pol', 'POL-01')}
         ${field('الخطورة', 'gov-v-sev', 'Medium')}`,
        `<button type="button" class="btn btn-ghost" data-action="gov-modal-close">إلغاء</button>
         <button type="button" class="btn btn-primary" data-action="gov-save-violation">حفظ</button>`
      );
    }
    if (m === 'risk') {
      return modalShell(
        'إضافة خطر',
        `${field('العنوان *', 'gov-rk-title', '', { required: true })}
         ${field('الفئة', 'gov-rk-cat', 'Governance')}
         ${field('احتمال 1-5', 'gov-rk-l', '3', { type: 'number' })}
         ${field('أثر 1-5', 'gov-rk-i', '3', { type: 'number' })}
         ${field('المعالجة', 'gov-rk-mit', '', { type: 'textarea' })}`,
        `<button type="button" class="btn btn-ghost" data-action="gov-modal-close">إلغاء</button>
         <button type="button" class="btn btn-primary" data-action="gov-save-risk">حفظ</button>`
      );
    }
    if (m === 'document') {
      return modalShell(
        'إضافة دليل/مستند',
        `${field('اسم المستند *', 'gov-doc-name', '', { required: true })}
         ${field('النوع', 'gov-doc-type', 'Evidence')}
         ${field('مرتبط بـ', 'gov-doc-rel', '')}`,
        `<button type="button" class="btn btn-ghost" data-action="gov-modal-close">إلغاء</button>
         <button type="button" class="btn btn-primary" data-action="gov-save-document">حفظ</button>`
      );
    }
    if (m === 'branch' || m === 'department' || m === 'platform') {
      const title = m === 'branch' ? 'إضافة فرع' : m === 'department' ? 'إضافة قسم' : 'إضافة/ربط منصة';
      return modalShell(
        title,
        `${field('الاسم *', 'gov-org-name', '', { required: true })}
         ${field('المدير', 'gov-org-mgr', '')}
         ${m !== 'branch' ? field('الفرع', 'gov-org-branch', 'الفرع الرئيسي') : field('العنوان', 'gov-org-addr', '')}
         ${m === 'platform' ? field('القسم', 'gov-org-dept', 'إدارة العمليات') : ''}`,
        `<button type="button" class="btn btn-ghost" data-action="gov-modal-close">إلغاء</button>
         <button type="button" class="btn btn-primary" data-action="gov-save-org" data-kind="${esc(m)}">حفظ</button>`
      );
    }
    if (m === 'edit-person') {
      const p = personById(g, ui.wizardData.personId);
      if (!p) return '';
      return modalShell(
        `تعديل · ${p.name}`,
        `${field('الاسم', 'gov-ep-name', p.name)}
         ${field('الهاتف', 'gov-ep-phone', p.phone)}
         ${field('البريد', 'gov-ep-email', p.email)}
         ${field('المكتب', 'gov-ep-office', p.officeNumber)}
         ${field('القسم', 'gov-ep-dept', p.department)}
         ${field('المنصة', 'gov-ep-plat', p.platform)}
         ${field('الدور', 'gov-ep-role', p.governanceRole)}`,
        `<button type="button" class="btn btn-ghost" data-action="gov-modal-close">إلغاء</button>
         <button type="button" class="btn btn-primary" data-action="gov-save-edit-person">حفظ التغييرات</button>`
      );
    }
    return '';
  };

  const renderTabBody = (g, user) => {
    switch (ui.tab) {
      case 'people':
        return renderPeople(g, user);
      case 'org':
        return renderOrg(g);
      case 'policies':
        return renderPolicies(g);
      case 'compliance':
        return renderCompliance(g);
      case 'quality':
        return renderQuality(g);
      case 'contracts':
        return renderContracts(g);
      case 'rewards':
        return renderRewards(g);
      case 'decisions':
        return renderDecisions(g);
      case 'approvals':
        return renderApprovals(g, user);
      case 'violations':
        return renderViolations(g);
      case 'reports':
        return renderReports(g);
      case 'audit':
        return renderAudit(g);
      case 'settings':
        return renderSettings(g, user);
      default:
        return renderDashboard(g);
    }
  };

  const handle = (action, btn, ctx = {}) => {
    if (!action || !String(action).startsWith('gov-')) return false;
    const user = ctx.user || {};
    const toast = ctx.toast || (() => {});
    const act = actorName(user);
    const HS = store();
    if (!HS) {
      toast('HubStore غير متاح');
      return true;
    }
    const g = govData();

    if (action === 'gov-tab') {
      ui.tab = btn.dataset.tab || 'dashboard';
      ui.addOpen = false;
      ui.menuOpen = null;
      ui.page = 1;
      return true;
    }
    if (action === 'gov-kpi' || action === 'gov-need') {
      ui.tab = btn.dataset.tab || 'dashboard';
      ui.kpiFocus = btn.dataset.focus || '';
      if (ui.kpiFocus === 'incomplete') ui.filters = { ...ui.filters };
      ui.page = 1;
      return true;
    }
    if (action === 'gov-add-toggle') {
      ui.addOpen = !ui.addOpen;
      return true;
    }
    if (action === 'gov-help-open') {
      ui.helpOpen = true;
      return true;
    }
    if (action === 'gov-help-close') {
      ui.helpOpen = false;
      HS.dismissGovHelp?.();
      return true;
    }
    if (action === 'gov-menu') {
      ui.menuOpen = ui.menuOpen === btn.dataset.id ? null : btn.dataset.id;
      return true;
    }
    if (action === 'gov-profile') {
      ui.drawer = btn.dataset.id;
      ui.drawerTab = btn.dataset.dtab || 'overview';
      ui.menuOpen = null;
      ui.addOpen = false;
      ui.modal = null;
      return true;
    }
    if (action === 'gov-drawer-close') {
      ui.drawer = null;
      return true;
    }
    if (action === 'gov-drawer-tab') {
      ui.drawerTab = btn.dataset.dtab || 'overview';
      return true;
    }
    if (action === 'gov-page') {
      ui.page += btn.dataset.dir === 'prev' ? -1 : 1;
      return true;
    }
    if (action === 'gov-modal') {
      ui.modal = btn.dataset.modal;
      ui.wizardData = { personId: btn.dataset.person || '' };
      ui.addOpen = false;
      return true;
    }
    if (action === 'gov-modal-close') {
      ui.modal = null;
      ui.detailId = null;
      return true;
    }
    if (action === 'gov-edit-person') {
      ui.modal = 'edit-person';
      ui.wizardData = { personId: btn.dataset.id };
      return true;
    }
    if (action === 'gov-policy-detail') {
      ui.modal = 'policy-detail';
      ui.detailId = btn.dataset.id;
      return true;
    }
    if (action === 'gov-comp-detail') {
      ui.modal = 'comp-detail';
      ui.detailId = btn.dataset.id;
      return true;
    }
    if (action === 'gov-qs-detail') {
      ui.modal = 'qs-detail';
      ui.detailId = btn.dataset.id;
      return true;
    }
    if (action === 'gov-activate-policy') {
      HS.activatePolicy?.(btn.dataset.id, act);
      toast('تم تفعيل السياسة');
      return true;
    }
    if (action === 'gov-ack') {
      HS.acknowledgePolicy?.(btn.dataset.pid, btn.dataset.uid, act);
      toast('تم تسجيل الإقرار');
      return true;
    }
    if (action === 'gov-assign-policy') {
      const pol = (g.policies || []).find((p) => /active/i.test(String(p.status)));
      if (!pol) {
        toast('لا توجد سياسة نشطة');
        return true;
      }
      HS.assignPolicyToPeople?.(pol.id, [btn.dataset.id], act);
      toast(`أُسندت ${pol.title}`);
      return true;
    }
    if (action === 'gov-apr-filter') {
      ui.approvalFilter = btn.dataset.f || 'mine';
      return true;
    }
    if (action === 'gov-apr') {
      let comment = '';
      if (btn.dataset.decision === 'reject') {
        comment = (typeof window !== 'undefined' && window.prompt('سبب الرفض')) || '';
        if (!comment) {
          toast('التعليق مطلوب عند الرفض');
          return true;
        }
      }
      HS.decideGovApproval?.(btn.dataset.id, btn.dataset.decision, comment, act);
      toast(btn.dataset.decision === 'approve' ? 'تم الاعتماد' : 'تم الرفض');
      return true;
    }
    if (action === 'gov-save-person') {
      const name = qVal('gov-p-name');
      if (!name) {
        toast('الاسم مطلوب');
        return true;
      }
      const created = HS.addGovPerson?.(
        {
          name,
          employeeId: qVal('gov-p-emp'),
          phone: qVal('gov-p-phone'),
          email: qVal('gov-p-email'),
          officeNumber: qVal('gov-p-office'),
          branch: qVal('gov-p-branch'),
          department: qVal('gov-p-dept'),
          platform: qVal('gov-p-plat'),
          governanceRole: qVal('gov-p-role'),
          source: 'Manual',
        },
        act
      );
      ui.modal = null;
      if (created) {
        ui.drawer = created.id;
        ui.drawerTab = 'overview';
      }
      toast('تمت إضافة الشخص');
      return true;
    }
    if (action === 'gov-save-edit-person') {
      HS.updateGovPerson?.(
        ui.wizardData.personId,
        {
          name: qVal('gov-ep-name'),
          phone: qVal('gov-ep-phone'),
          email: qVal('gov-ep-email'),
          officeNumber: qVal('gov-ep-office'),
          department: qVal('gov-ep-dept'),
          platform: qVal('gov-ep-plat'),
          governanceRole: qVal('gov-ep-role'),
        },
        act
      );
      ui.modal = null;
      toast('تم حفظ تعديلات الشخص');
      return true;
    }
    if (action === 'gov-save-policy') {
      const title = qVal('gov-pol-title');
      if (!title) {
        toast('اسم السياسة مطلوب');
        return true;
      }
      const pol = HS.addPolicy?.(
        title,
        qVal('gov-pol-applies'),
        {
          description: qVal('gov-pol-desc'),
          category: qVal('gov-pol-cat'),
          owner: qVal('gov-pol-owner'),
          requiresAck: !!qVal('gov-pol-ack'),
          ackDeadline: qVal('gov-pol-deadline'),
          appliesTo: { type: 'custom', label: qVal('gov-pol-applies') },
          status: 'Draft',
        },
        act
      );
      const it = (g.people || []).filter((p) => /تقنية|Security/i.test(`${p.department} ${p.team}`)).map((p) => p.id);
      if (pol && it.length) HS.assignPolicyToPeople?.(pol.id, it, act);
      ui.modal = null;
      toast('تم إنشاء السياسة');
      return true;
    }
    if (action === 'gov-save-compliance') {
      const name = qVal('gov-c-name');
      if (!name) {
        toast('اسم المعيار مطلوب');
        return true;
      }
      HS.addComplianceRequirement?.(
        {
          name,
          framework: qVal('gov-c-fw'),
          description: qVal('gov-c-desc'),
          appliesTo: { label: qVal('gov-c-applies') },
          evidenceRequired: qVal('gov-c-ev'),
          target: Number(qVal('gov-c-target') || 100),
          measurement: qVal('gov-c-meas'),
          owner: qVal('gov-c-owner'),
        },
        act
      );
      ui.modal = null;
      toast('تم إضافة متطلب الامتثال');
      return true;
    }
    if (action === 'gov-save-quality') {
      const name = qVal('gov-q-name');
      if (!name) {
        toast('اسم المعيار مطلوب');
        return true;
      }
      HS.addQualityStandard?.(
        {
          name,
          description: qVal('gov-q-desc'),
          appliesTo: { label: qVal('gov-q-applies') },
          target: Number(qVal('gov-q-target') || 95),
          dataSource: qVal('gov-q-src'),
          calculation: qVal('gov-q-calc'),
          owner: qVal('gov-q-owner'),
          reviewer: qVal('gov-q-rev'),
          currentValue: 0,
          status: 'New',
        },
        act
      );
      ui.modal = null;
      toast('تم إضافة معيار الجودة');
      return true;
    }
    if (action === 'gov-save-contract') {
      const name = qVal('gov-ct-name');
      if (!name) {
        toast('اسم العقد مطلوب');
        return true;
      }
      const personId = qVal('gov-ct-person');
      const person = personById(g, personId);
      HS.addGovContract?.(
        {
          name,
          relatedType: 'person',
          relatedId: personId,
          relatedLabel: person?.name || qVal('gov-ct-p2'),
          party2: person?.name || qVal('gov-ct-p2'),
          type: qVal('gov-ct-type'),
          value: Number(qVal('gov-ct-val') || 0),
          startDate: qVal('gov-ct-start'),
          endDate: qVal('gov-ct-end'),
          owner: qVal('gov-ct-owner'),
        },
        act
      );
      ui.modal = null;
      toast('تم إنشاء العقد وإرساله للاعتماد');
      return true;
    }
    if (action === 'gov-save-reward') {
      const personId = qVal('gov-r-person') || ui.wizardData.personId;
      const person = personById(g, personId);
      const reason = qVal('gov-r-reason');
      if (!person || !reason) {
        toast('المستفيد والسبب مطلوبان');
        return true;
      }
      HS.issuePenaltyOrReward?.(
        'reward',
        person.name,
        reason,
        Number(qVal('gov-r-val') || 0),
        { beneficiaryId: person.id, rewardType: qVal('gov-r-type'), source: qVal('gov-r-src') || 'Manual' },
        act
      );
      ui.modal = null;
      toast('أُرسلت المكافأة للاعتماد');
      return true;
    }
    if (action === 'gov-save-decision') {
      const title = qVal('gov-d-title');
      if (!title) {
        toast('العنوان مطلوب');
        return true;
      }
      HS.addGovDecision?.({ title, committee: qVal('gov-d-com'), appliesTo: qVal('gov-d-applies') }, act);
      ui.modal = null;
      toast('تم إنشاء القرار');
      return true;
    }
    if (action === 'gov-save-committee') {
      const name = qVal('gov-com-name');
      if (!name) {
        toast('اسم اللجنة مطلوب');
        return true;
      }
      HS.addGovCommittee?.(
        { name, chairperson: qVal('gov-com-chair'), secretary: qVal('gov-com-sec'), purpose: qVal('gov-com-purpose'), members: [] },
        act
      );
      ui.modal = null;
      toast('تمت إضافة اللجنة');
      return true;
    }
    if (action === 'gov-save-violation') {
      const person = personById(g, qVal('gov-v-person'));
      const description = qVal('gov-v-desc');
      if (!description) {
        toast('الوصف مطلوب');
        return true;
      }
      HS.addGovViolation?.(
        {
          personId: person?.id,
          person: person?.name,
          type: qVal('gov-v-type'),
          description,
          relatedPolicy: qVal('gov-v-pol'),
          severity: qVal('gov-v-sev'),
        },
        act
      );
      ui.modal = null;
      toast('سُجلت المخالفة');
      return true;
    }
    if (action === 'gov-save-risk') {
      const title = qVal('gov-rk-title');
      if (!title) {
        toast('العنوان مطلوب');
        return true;
      }
      HS.addGovRisk?.(
        {
          title,
          category: qVal('gov-rk-cat'),
          likelihood: Number(qVal('gov-rk-l') || 1),
          impact: Number(qVal('gov-rk-i') || 1),
          mitigation: qVal('gov-rk-mit'),
        },
        act
      );
      ui.modal = null;
      toast('أُضيف الخطر');
      return true;
    }
    if (action === 'gov-save-document') {
      const name = qVal('gov-doc-name');
      if (!name) {
        toast('اسم المستند مطلوب');
        return true;
      }
      HS.addGovDocument?.({ name, type: qVal('gov-doc-type'), relatedEntity: qVal('gov-doc-rel') }, act);
      ui.modal = null;
      toast('أُضيف المستند');
      return true;
    }
    if (action === 'gov-save-org') {
      const name = qVal('gov-org-name');
      if (!name) {
        toast('الاسم مطلوب');
        return true;
      }
      const kind = btn.dataset.kind;
      if (kind === 'branch') HS.addGovBranch?.({ name, manager: qVal('gov-org-mgr'), address: qVal('gov-org-addr') }, act);
      if (kind === 'department') HS.addGovDepartment?.({ name, manager: qVal('gov-org-mgr'), branch: qVal('gov-org-branch') }, act);
      if (kind === 'platform')
        HS.addGovPlatform?.({ name, owner: qVal('gov-org-mgr'), branch: qVal('gov-org-branch'), department: qVal('gov-org-dept') }, act);
      ui.modal = null;
      toast('تم الحفظ');
      return true;
    }
    if (action === 'gov-settings-save') {
      HS.updateGovSettings?.(
        { pageSize: Number(qVal('gov-set-ps') || 25), requireRewardApproval: !!qVal('gov-set-rap') },
        act
      );
      ui.pageSize = Number(qVal('gov-set-ps') || ui.pageSize);
      toast('حُفظت الإعدادات');
      return true;
    }
    if (action === 'gov-export-report') {
      const report = btn.dataset.report || 'report';
      const csv = `report,value\nname,${report}\npeople,${g.totalPeople}\ncompliance,${g.complianceRate}\n`;
      if (typeof document !== 'undefined') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        a.download = `governance-${Date.now()}.csv`;
        a.click();
      }
      toast(`تم تصدير: ${report}`);
      return true;
    }
    return false;
  };

  const handleChange = (el) => {
    const key = el.getAttribute('data-gov-change');
    if (!key) return false;
    if (key === 'globalQ') {
      ui.globalQ = el.value;
      ui.filters.q = el.value;
      ui.tab = 'people';
      ui.page = 1;
      return true;
    }
    if (key === 'pageSize') {
      ui.pageSize = Number(el.value) || 25;
      ui.page = 1;
      return true;
    }
    if (['q', 'branch', 'department', 'platform', 'role', 'status', 'compliance'].includes(key)) {
      ui.filters[key] = el.value;
      ui.page = 1;
      return true;
    }
    return false;
  };

  const render = (ctx = {}) => {
    const user = ctx.user || {};
    const g = govData();
    if (g.settings?.pageSize && !ui._ps) {
      ui.pageSize = g.settings.pageSize;
      ui._ps = true;
    }
    return `<div class="hub-governance-360" dir="rtl" data-hub-governance>
      ${renderHeader(g, user)}
      ${renderHelp()}
      ${renderTabs()}
      <div style="margin-top:12px">${renderTabBody(g, user)}</div>
      ${renderDrawer(g, user)}
      ${renderCreateModal(g)}
      ${renderDetailModal(g)}
    </div>`;
  };

  window.HubGovernance = { render, handle, handleChange, ui };
})();
