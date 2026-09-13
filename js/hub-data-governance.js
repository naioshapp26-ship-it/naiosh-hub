/**
 * NAIOSH HUB 360 — وحدة حوكمة البيانات (vanilla IIFE)
 * كتالوج · مصادر · سلسلة · جودة · تصنيف · سياسات · اعتمادات · تقارير · RBAC
 * يعتمد على HubStore.dataGovernance (schemaVersion 2)
 */
(() => {
  'use strict';

  const PAGE_SIZE = 10;
  const ASSET_STATUSES = [
    { v: 'draft', l: 'مسودة' },
    { v: 'review', l: 'مراجعة' },
    { v: 'pending_approval', l: 'بانتظار الاعتماد' },
    { v: 'approved', l: 'معتمد' },
    { v: 'active', l: 'نشط' },
  ];
  const CLASSIFICATIONS = ['عام', 'داخلي', 'سري', 'سري للغاية'];
  const ASSET_TYPES = ['Table', 'View', 'File', 'API', 'Stream', 'Document', 'Dataset', 'Report', 'Other'];
  const SENSITIVITY_LEVELS = ['Operational', 'Personal Data', 'Financial', 'HR', 'Customer', 'Credentials', 'Public'];
  const SOURCE_TYPES = [
    'SQL Database',
    'Oracle',
    'MySQL',
    'PostgreSQL',
    'SQL Server',
    'Excel / CSV',
    'API',
    'ERP',
    'CRM',
    'HR System',
    'Data Warehouse',
    'Data Lake',
    'Cloud Storage',
    'Manual Entry',
    'Other',
  ];
  const SOURCE_STATUSES = [
    { v: 'connected', l: 'متصل' },
    { v: 'degraded', l: 'متدهور' },
    { v: 'failed', l: 'فشل الاتصال' },
    { v: 'disconnected', l: 'غير متصل' },
    { v: 'scanning', l: 'جاري الفحص' },
  ];
  const QI_STATUSES = ['New', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
  const RULE_TYPES = ['Completeness', 'Uniqueness', 'Validity', 'Timeliness', 'Consistency', 'Accuracy'];
  const WIZARD_STEPS = [
    'الهوية والنوع',
    'المصدر والموقع',
    'الملكية والمسؤولية',
    'التصنيف والحساسية',
    'المخطط والحقول',
    'المراجعة والإرسال',
  ];
  const DRAWER_TABS = [
    { id: 'overview', label: 'نظرة عامة', icon: 'fa-gauge' },
    { id: 'metadata', label: 'البيانات الوصفية', icon: 'fa-tags' },
    { id: 'schema', label: 'المخطط / الحقول', icon: 'fa-table' },
    { id: 'source', label: 'المصدر', icon: 'fa-plug' },
    { id: 'lineage', label: 'السلسلة', icon: 'fa-diagram-project' },
    { id: 'quality', label: 'الجودة', icon: 'fa-check-double' },
    { id: 'classification', label: 'التصنيف', icon: 'fa-lock' },
    { id: 'policies', label: 'السياسات', icon: 'fa-file-shield' },
    { id: 'usage', label: 'الاستخدام', icon: 'fa-chart-line' },
    { id: 'history', label: 'السجل', icon: 'fa-clock-rotate-left' },
    { id: 'comments', label: 'التعليقات', icon: 'fa-comments' },
    { id: 'attachments', label: 'المرفقات', icon: 'fa-paperclip' },
  ];

  const ui = {
    tab: 'overview',
    modal: null,
    drawer: null,
    drawerTab: 'overview',
    wizardStep: 0,
    wizardData: {},
    confirm: null,
    page: 1,
    sort: 'updated_desc',
    filters: {
      assetQ: '',
      assetType: '',
      assetStatus: '',
      assetClassification: '',
      assetSource: '',
      assetOwner: '',
      assetSystem: '',
      sourceQ: '',
      sourceStatus: '',
      qualityQ: '',
      qualitySeverity: '',
      auditQ: '',
      auditAction: '',
      policyQ: '',
      approvalQ: '',
      lineageQ: '',
    },
    kpiFocus: '',
    report: null,
    exportOpen: false,
    loading: false,
    error: '',
    importPreview: [],
    importRaw: '',
    policyEditId: '',
    sourceEditId: '',
    approvalCommentId: '',
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

  const fmtDate = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return String(iso);
    }
  };

  const bar = (pct) => {
    const n = Math.max(0, Math.min(100, Number(pct) || 0));
    return `<div class="bar" aria-hidden="true"><i style="width:${n}%"></i></div>`;
  };

  const store = () => window.HubStore;
  const dgData = () => {
    store()?.recomputeDataGovernanceKpis?.();
    return (
      store()?.get?.()?.dataGovernance || {
        assets: [],
        sources: [],
        qualityRules: [],
        qualityIssues: [],
        policies: [],
        approvals: [],
        integrations: [],
        settings: {},
        auditLog: [],
        people: [],
        departments: [],
      }
    );
  };

  const actorName = (user) => user?.name || user?.email || user?.displayName || 'مشغّل هوب';

  const permLevel = (user) => {
    const role = String(user?.role || '').toLowerCase();
    if (['supreme_leader', 'admin'].includes(role)) return 'admin';
    if (['chief_engineer'].includes(role)) return 'steward';
    if (['auditor', 'audit'].includes(role)) return 'auditor';
    if (['employee', 'user'].includes(role)) return 'employee';
    return 'admin';
  };

  const can = (user, cap) => {
    const p = permLevel(user);
    const adminCaps = true;
    const stewardCaps = [
      'view',
      'catalog_view',
      'create_asset',
      'edit_asset',
      'archive_asset',
      'create_source',
      'edit_source',
      'test_source',
      'scan_source',
      'import',
      'quality',
      'policy_create',
      'policy_edit',
      'policy_activate',
      'approve',
      'reports',
      'export',
      'print',
      'audit_view',
      'lineage',
    ];
    const auditorCaps = ['view', 'catalog_view', 'reports', 'export', 'print', 'audit_view', 'lineage'];
    const employeeCaps = ['view', 'catalog_view', 'create_asset_draft', 'lineage'];
    if (cap === 'view' || cap === 'catalog_view' || cap === 'lineage') return true;
    if (p === 'admin') return adminCaps;
    if (p === 'steward') return stewardCaps.includes(cap);
    if (p === 'auditor') return auditorCaps.includes(cap);
    if (p === 'employee') return employeeCaps.includes(cap);
    return false;
  };

  const statusLabel = (st) => ASSET_STATUSES.find((x) => x.v === st)?.l || st || '—';
  const sourceStatusLabel = (st) => SOURCE_STATUSES.find((x) => x.v === st)?.l || st || '—';

  const badgeClass = (kind, value) => {
    const v = String(value || '');
    const maps = {
      classification: { عام: 'badge-outline', داخلي: 'badge-gray', سري: 'badge-red', 'سري للغاية': 'badge-red' },
      status: {
        draft: 'badge-outline',
        review: 'badge-gray',
        pending_approval: 'badge-gray',
        approved: 'badge-black',
        active: 'badge-black',
        connected: 'badge-black',
        failed: 'badge-red',
        disconnected: 'badge-outline',
        scanning: 'badge-gray',
        active_policy: 'badge-black',
        draft_policy: 'badge-outline',
        review_policy: 'badge-gray',
        pending: 'badge-gray',
        approved_apr: 'badge-black',
        rejected: 'badge-red',
        changes_requested: 'badge-gray',
      },
      severity: { حرج: 'badge-red', مرتفع: 'badge-red', متوسط: 'badge-gray', منخفض: 'badge-outline' },
      quality: { New: 'badge-red', Assigned: 'badge-gray', 'In Progress': 'badge-gray', Resolved: 'badge-black', Closed: 'badge-black' },
    };
    const m = maps[kind] || {};
    return m[v] || 'badge-outline';
  };

  const badge = (text, kind = 'status') => `<span class="badge ${badgeClass(kind, text)}">${esc(text)}</span>`;

  const activeAssets = (dg) => (dg.assets || []).filter((a) => !a.archived);
  const activeSources = (dg) => (dg.sources || []).filter((s) => !s.archived);
  const openIssues = (dg) => (dg.qualityIssues || []).filter((i) => !['Resolved', 'Closed'].includes(i.status));

  const assetById = (dg, id) => (dg.assets || []).find((x) => x.id === id);
  const sourceById = (dg, id) => (dg.sources || []).find((x) => x.id === id);

  const actionNeeded = (dg) => {
    const items = [];
    activeAssets(dg)
      .filter((a) => !a.classification)
      .forEach((a) => items.push({ kind: 'unclassified', id: a.id, text: `أصل غير مصنّف: ${a.name}`, tab: 'catalog', filter: 'unclassified' }));
    activeSources(dg)
      .filter((s) => s.status === 'failed' || s.status === 'disconnected')
      .forEach((s) => items.push({ kind: 'source', id: s.id, text: `مشكلة مصدر: ${s.name} (${sourceStatusLabel(s.status)})`, tab: 'sources' }));
    openIssues(dg).forEach((q) =>
      items.push({ kind: 'quality', id: q.id, text: `مشكلة جودة: ${q.rule || q.dataset} (${q.severity})`, tab: 'quality' })
    );
    activeAssets(dg)
      .filter((a) => !a.owner || !a.steward)
      .forEach((a) => items.push({ kind: 'owner', id: a.id, text: `مالك/ steward ناقص: ${a.name}`, tab: 'catalog', filter: 'missing_owner' }));
    (dg.approvals || [])
      .filter((a) => a.status === 'pending')
      .forEach((a) => items.push({ kind: 'approval', id: a.id, text: `اعتماد معلّق: ${a.entityLabel}`, tab: 'approvals' }));
    (dg.policies || [])
      .filter((p) => p.status === 'review' || p.status === 'draft')
      .forEach((p) => items.push({ kind: 'policy', id: p.id, text: `سياسة تحتاج مراجعة: ${p.name || p.title}`, tab: 'policies' }));
    return items.slice(0, 14);
  };

  const sortAssets = (list) => {
    const arr = [...list];
    switch (ui.sort) {
      case 'name_asc':
        arr.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));
        break;
      case 'quality_desc':
        arr.sort((a, b) => (Number(b.quality) || 0) - (Number(a.quality) || 0));
        break;
      case 'updated_asc':
        arr.sort((a, b) => new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0));
        break;
      default:
        arr.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    }
    return arr;
  };

  const filterAssets = (dg) => {
    const f = ui.filters;
    return activeAssets(dg).filter((a) => {
      if (f.assetType && a.type !== f.assetType) return false;
      if (f.assetStatus && a.status !== f.assetStatus) return false;
      if (f.assetClassification && a.classification !== f.assetClassification) return false;
      if (f.assetSource && a.sourceId !== f.assetSource && a.sourceName !== f.assetSource) return false;
      if (f.assetOwner && a.owner !== f.assetOwner) return false;
      if (f.assetSystem && a.system !== f.assetSystem) return false;
      if (ui.kpiFocus === 'unclassified' && a.classification) return false;
      if (ui.kpiFocus === 'sensitive' && !['سري', 'سري للغاية'].includes(a.classification)) return false;
      if (ui.kpiFocus === 'review' && a.status !== 'review' && a.status !== 'pending_approval') return false;
      if (ui.kpiFocus === 'quality_low' && (Number(a.quality) || 0) >= 70) return false;
      if (f.assetQ) {
        const hay = `${a.id} ${a.name} ${a.businessName} ${a.type} ${a.system} ${a.owner} ${(a.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(f.assetQ.toLowerCase())) return false;
      }
      if (ui.filters.missing_owner === '1' && a.owner && a.steward) return false;
      return true;
    });
  };

  const paginate = (arr) => {
    const total = arr.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (ui.page > pages) ui.page = pages;
    if (ui.page < 1) ui.page = 1;
    const start = (ui.page - 1) * PAGE_SIZE;
    return { rows: arr.slice(start, start + PAGE_SIZE), total, pages };
  };

  const renderKpis = (dg) => {
    const kpis = [
      { key: 'qualityScore', label: 'درجة جودة البيانات', value: `${dg.qualityScore ?? '—'}%`, tab: 'quality' },
      { key: 'classifiedPct', label: 'نسبة التصنيف', value: `${dg.classifiedPct ?? '—'}%`, tab: 'classification' },
      { key: 'metadataCompletion', label: 'اكتمال البيانات الوصفية', value: `${dg.metadataCompletion ?? '—'}%`, tab: 'catalog' },
      { key: 'totalAssets', label: 'إجمالي الأصول', value: dg.totalAssets ?? 0, tab: 'catalog' },
      { key: 'connectedSources', label: 'مصادر متصلة', value: dg.connectedSources ?? 0, tab: 'sources' },
      { key: 'openQualityIssues', label: 'مشكلات جودة مفتوحة', value: dg.openQualityIssues ?? 0, tab: 'quality' },
      { key: 'assetsNeedingReview', label: 'أصول تحتاج مراجعة', value: dg.assetsNeedingReview ?? 0, tab: 'catalog', focus: 'review' },
      { key: 'sensitiveCount', label: 'أصول حساسة', value: dg.sensitiveCount ?? 0, tab: 'classification', focus: 'sensitive' },
    ];
    return `<div class="kpi-grid" data-dg-kpis>
      ${kpis
        .map(
          (k) => `<article class="kpi ${ui.kpiFocus === k.key || ui.kpiFocus === k.focus ? 'is-focus' : ''}" data-action="dg-kpi-focus" data-kpi="${esc(k.key)}" data-focus="${esc(k.focus || k.key)}" data-tab="${esc(k.tab)}" role="button" tabindex="0">
        <span>${esc(k.label)}</span>
        <strong>${esc(String(k.value))}</strong>
        <small>انقر للتصفية</small>
      </article>`
        )
        .join('')}
    </div>`;
  };

  const formField = (label, id, value = '', type = 'text', opts = '') => {
    if (type === 'textarea') return `<label class="field">${esc(label)}<textarea id="${esc(id)}" rows="3">${esc(value)}</textarea></label>`;
    if (type === 'select') return `<label class="field">${esc(label)}<select id="${esc(id)}">${opts}</select></label>`;
    return `<label class="field">${esc(label)}<input id="${esc(id)}" type="${esc(type)}" value="${esc(value)}" /></label>`;
  };

  const qVal = (id) => {
    const el = document.getElementById(id);
    if (!el) return '';
    if (el.type === 'checkbox') return el.checked;
    return el.value;
  };

  const renderOverview = (dg, user) => {
    const needed = actionNeeded(dg);
    const recent = sortAssets(activeAssets(dg)).slice(0, 6);
    const settings = dg.settings || {};
    return `
      ${ui.kpiFocus ? `<p class="empty" style="margin:8px 0">تركيز KPI — <button type="button" class="btn btn-sm btn-ghost" data-action="dg-kpi-clear">إزالة</button></p>` : ''}
      <div class="grid-2" style="margin-top:12px">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-bolt icon"></i> إجراء مطلوب الآن</span></h3>
          ${
            needed.length
              ? `<ul style="margin:0;padding-right:18px">${needed
                  .map(
                    (a) => `<li style="margin:8px 0">${esc(a.text)}
                <button type="button" class="btn btn-sm btn-primary" data-action="dg-action-item" data-kind="${esc(a.kind)}" data-id="${esc(a.id)}" data-tab="${esc(a.tab)}">معالجة</button></li>`
                  )
                  .join('')}</ul>`
              : '<p class="empty">لا عناصر عاجلة — حوكمة البيانات مستقرة.</p>'
          }
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-chart-pie icon"></i> ملخص الحوكمة</span></h3>
          <p>درجة الجودة: <strong>${dg.qualityScore ?? '—'}%</strong></p>${bar(dg.qualityScore || 0)}
          <p style="margin-top:10px">التصنيف: <strong>${dg.classifiedPct ?? '—'}%</strong> · اكتمال Metadata: <strong>${dg.metadataCompletion ?? '—'}%</strong></p>
          <p style="margin-top:10px">امتثال الاحتفاظ: <strong>${dg.retentionOk ?? '—'}%</strong></p>
          ${bar(dg.retentionOk || 0)}
          <p style="margin-top:10px"><small>اعتماد إلزامي: ${settings.requireApproval ? 'نعم' : 'لا'} · حد الجودة: ${settings.qualityThreshold ?? 80}%</small></p>
        </article>
      </div>
      <article class="card" style="margin-top:12px">
        <h3><span class="title-left"><i class="fas fa-database icon"></i> أحدث الأصول</span></h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>المعرّف</th><th>الاسم</th><th>النوع</th><th>التصنيف</th><th>الجودة</th><th>الحالة</th></tr></thead>
          <tbody>
            ${recent
              .map(
                (a) => `<tr data-action="dg-drawer" data-id="${esc(a.id)}" style="cursor:pointer">
                <td>${esc(a.id)}</td><td>${esc(a.name)}</td><td>${esc(a.type)}</td>
                <td>${a.classification ? badge(a.classification, 'classification') : badge('غير مصنّف')}</td>
                <td>${a.quality ?? '—'}% ${bar(a.quality)}</td><td>${badge(statusLabel(a.status))}</td></tr>`
              )
              .join('') || '<tr><td colspan="6" class="empty">لا أصول.</td></tr>'}
          </tbody>
        </table></div>
        <button type="button" class="btn btn-sm btn-ghost" data-action="dg-tab" data-tab="catalog">عرض الكتالوج الكامل</button>
      </article>`;
  };

  const renderCatalogToolbar = (dg, user) => {
    const owners = [...new Set(activeAssets(dg).map((a) => a.owner).filter(Boolean))];
    const systems = [...new Set(activeAssets(dg).map((a) => a.system).filter(Boolean))];
    const sources = activeSources(dg);
    return `<div class="toolbar" style="flex-wrap:wrap;gap:8px;margin-bottom:12px">
      <label class="field">بحث<input type="search" data-dg-change="assetQ" value="${esc(ui.filters.assetQ)}" placeholder="اسم / معرّف / نظام…" /></label>
      <label class="field">النوع<select data-dg-change="assetType"><option value="">الكل</option>${ASSET_TYPES.map((t) => `<option value="${esc(t)}" ${ui.filters.assetType === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <label class="field">الحالة<select data-dg-change="assetStatus"><option value="">الكل</option>${ASSET_STATUSES.map((s) => `<option value="${esc(s.v)}" ${ui.filters.assetStatus === s.v ? 'selected' : ''}>${esc(s.l)}</option>`).join('')}</select></label>
      <label class="field">التصنيف<select data-dg-change="assetClassification"><option value="">الكل</option>${CLASSIFICATIONS.map((c) => `<option value="${esc(c)}" ${ui.filters.assetClassification === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label class="field">المصدر<select data-dg-change="assetSource"><option value="">الكل</option>${sources.map((s) => `<option value="${esc(s.id)}" ${ui.filters.assetSource === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="field">المالك<select data-dg-change="assetOwner"><option value="">الكل</option>${owners.map((o) => `<option value="${esc(o)}" ${ui.filters.assetOwner === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>
      <label class="field">النظام<select data-dg-change="assetSystem"><option value="">الكل</option>${systems.map((s) => `<option value="${esc(s)}" ${ui.filters.assetSystem === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <label class="field">ترتيب<select data-dg-change="sort"><option value="updated_desc" ${ui.sort === 'updated_desc' ? 'selected' : ''}>الأحدث</option><option value="updated_asc" ${ui.sort === 'updated_asc' ? 'selected' : ''}>الأقدم</option><option value="name_asc" ${ui.sort === 'name_asc' ? 'selected' : ''}>الاسم</option><option value="quality_desc" ${ui.sort === 'quality_desc' ? 'selected' : ''}>الجودة</option></select></label>
      ${can(user, 'create_asset') || can(user, 'create_asset_draft') ? `<button type="button" class="btn btn-primary" data-action="dg-modal" data-modal="asset_wizard">+ إضافة أصل</button>` : ''}
    </div>`;
  };

  const renderCatalog = (dg, user) => {
    const filtered = sortAssets(filterAssets(dg));
    const { rows, total, pages } = paginate(filtered);
    return `
      ${renderCatalogToolbar(dg, user)}
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Asset ID</th><th>الاسم</th><th>النوع</th><th>المصدر</th><th>النظام</th><th>المالك</th><th>Steward</th><th>التصنيف</th><th>الحساسية</th><th>الجودة</th><th>الحالة</th><th>تحديث</th><th></th></tr></thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map((a) => {
                    const acts = [`<button type="button" class="btn btn-sm btn-ghost" data-action="dg-drawer" data-id="${esc(a.id)}">تفاصيل</button>`];
                    if (can(user, 'edit_asset')) acts.push(`<button type="button" class="btn btn-sm btn-dark" data-action="dg-toggle-catalog" data-id="${esc(a.id)}">تبديل</button>`);
                    if (can(user, 'archive_asset')) acts.push(`<button type="button" class="btn btn-sm btn-ghost" data-action="dg-confirm" data-kind="archive_asset" data-id="${esc(a.id)}">أرشفة</button>`);
                    return `<tr>
                    <td>${esc(a.id)}</td><td><strong>${esc(a.name)}</strong></td><td>${esc(a.type)}</td>
                    <td>${esc(a.sourceName || '—')}</td><td>${esc(a.system || '—')}</td>
                    <td>${esc(a.owner || '—')}</td><td>${esc(a.steward || '—')}</td>
                    <td>${a.classification ? badge(a.classification, 'classification') : '—'}</td>
                    <td>${esc(a.sensitivity || '—')}</td><td>${a.quality ?? '—'}%</td><td>${badge(statusLabel(a.status))}</td>
                    <td>${esc(fmtDate(a.updatedAt))}</td><td style="white-space:nowrap">${acts.join(' ')}</td></tr>`;
                  })
                  .join('')
              : `<tr><td colspan="13" class="empty">لا أصول في الكتالوج.<br/>${can(user, 'create_asset') || can(user, 'create_asset_draft') ? `<button type="button" class="btn btn-primary" style="margin-top:10px" data-action="dg-modal" data-modal="asset_wizard">إضافة أول أصل بيانات</button>` : ''}</td></tr>`
          }
        </tbody>
      </table></div>
      <div class="toolbar" style="justify-content:space-between;margin-top:8px">
        <span>الإجمالي: ${total}</span>
        <span>
          <button type="button" class="btn btn-sm btn-ghost" data-action="dg-page" data-dir="prev" ${ui.page <= 1 ? 'disabled' : ''}>السابق</button>
          <span style="margin:0 8px">صفحة ${ui.page} / ${pages}</span>
          <button type="button" class="btn btn-sm btn-ghost" data-action="dg-page" data-dir="next" ${ui.page >= pages ? 'disabled' : ''}>التالي</button>
        </span>
      </div>`;
  };

  const renderSources = (dg, user) => {
    const q = (ui.filters.sourceQ || '').toLowerCase();
    const rows = activeSources(dg).filter((s) => {
      if (ui.filters.sourceStatus && s.status !== ui.filters.sourceStatus) return false;
      if (ui.kpiFocus === 'connectedSources' && s.status !== 'connected') return false;
      if (q) {
        const hay = `${s.id} ${s.name} ${s.system} ${s.type} ${s.host}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return `
      <div class="toolbar" style="flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <label class="field">بحث<input type="search" data-dg-change="sourceQ" value="${esc(ui.filters.sourceQ)}" /></label>
        <label class="field">الحالة<select data-dg-change="sourceStatus"><option value="">الكل</option>${SOURCE_STATUSES.map((s) => `<option value="${esc(s.v)}" ${ui.filters.sourceStatus === s.v ? 'selected' : ''}>${esc(s.l)}</option>`).join('')}</select></label>
        ${can(user, 'create_source') ? `<button type="button" class="btn btn-primary" data-action="dg-modal" data-modal="source_wizard">+ إضافة مصدر</button>` : ''}
        ${can(user, 'test_source') ? `<button type="button" class="btn btn-dark" data-action="dg-test-all-sources">فحص كل المصادر</button>` : ''}
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>المعرّف</th><th>الاسم</th><th>النوع</th><th>النظام</th><th>الحالة</th><th>آخر مزامنة</th><th>الأصول</th><th></th></tr></thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map((s) => {
                    const acts = [];
                    if (can(user, 'test_source')) acts.push(`<button type="button" class="btn btn-sm btn-dark" data-action="dg-test-source" data-id="${esc(s.id)}">Test Connection</button>`);
                    if (can(user, 'scan_source')) acts.push(`<button type="button" class="btn btn-sm btn-primary" data-action="dg-scan-source" data-id="${esc(s.id)}">Scan Source</button>`);
                    if (can(user, 'edit_source')) acts.push(`<button type="button" class="btn btn-sm btn-ghost" data-action="dg-modal" data-modal="source_edit" data-id="${esc(s.id)}">تعديل</button>`);
                    return `<tr><td>${esc(s.id)}</td><td><strong>${esc(s.name)}</strong></td><td>${esc(s.type)}</td><td>${esc(s.system || '—')}</td>
                    <td>${badge(sourceStatusLabel(s.status))}</td><td>${esc(fmtTime(s.lastSync))}</td><td>${s.assetsCount ?? 0}</td><td>${acts.join(' ') || '—'}</td></tr>`;
                  })
                  .join('')
              : '<tr><td colspan="8" class="empty">لا مصادر — أضف مصدراً للبدء.</td></tr>'
          }
        </tbody>
      </table></div>
      <article class="card" style="margin-top:12px">
        <h3><span class="title-left"><i class="fas fa-link icon"></i> التكاملات (Integrations)</span></h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>الاسم</th><th>النوع</th><th>الاتجاه</th><th>الحالة</th><th>آخر مزامنة</th><th>سجلات</th><th>خطأ</th></tr></thead>
          <tbody>
            ${(dg.integrations || [])
              .map(
                (i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.type)}</td><td>${esc(i.direction)}</td>
                <td>${badge(i.status)}</td><td>${esc(fmtTime(i.lastSync))}</td><td>${i.records ?? 0}</td><td><small>${esc(i.lastError || '—')}</small></td></tr>`
              )
              .join('') || '<tr><td colspan="7" class="empty">لا تكاملات.</td></tr>'}
          </tbody>
        </table></div>
      </article>`;
  };

  const renderLineageChain = (asset) => {
    const ln = asset.lineage || { upstream: [], node: {}, downstream: [] };
    const nodeBtn = (n, type) =>
      n?.name
        ? `<button type="button" class="btn btn-sm btn-ghost" data-action="dg-lineage-node" data-name="${esc(n.name)}" title="${esc(type)}">${esc(n.name)}</button>`
        : '';
    const up = (ln.upstream || []).map((n) => nodeBtn(n, 'upstream')).join(' ');
    const down = (ln.downstream || []).map((n) => nodeBtn(n, 'downstream')).join(' ');
    const mid = nodeBtn(ln.node || { name: asset.name }, 'asset');
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px">
      <div><span class="badge badge-outline">Upstream</span><div style="margin-top:8px">${up || '<span class="empty">—</span>'}</div></div>
      <div style="font-size:1.4rem">↓</div>
      <div>${mid}</div>
      <div style="font-size:1.4rem">↓</div>
      <div><span class="badge badge-outline">Consumers</span><div style="margin-top:8px">${down || '<span class="empty">—</span>'}</div></div>
    </div>`;
  };

  const renderLineageTab = (dg) => {
    const q = (ui.filters.lineageQ || '').toLowerCase();
    const assets = activeAssets(dg).filter((a) => {
      if (!q) return true;
      const hay = `${a.name} ${(a.lineage?.upstream || []).map((x) => x.name).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
    return `
      <label class="field" style="max-width:320px">بحث في السلسلة<input type="search" data-dg-change="lineageQ" value="${esc(ui.filters.lineageQ)}" /></label>
      <div class="grid-2" style="margin-top:12px">
        ${assets
          .slice(0, 12)
          .map(
            (a) => `<article class="card"><h4>${esc(a.name)}</h4>${renderLineageChain(a)}
            <button type="button" class="btn btn-sm btn-primary" data-action="dg-drawer" data-id="${esc(a.id)}">فتح الأصل</button></article>`
          )
          .join('') || '<p class="empty">لا أصول لعرض السلسلة.</p>'}
      </div>`;
  };

  const renderQuality = (dg, user) => {
    const rules = dg.qualityRules || [];
    const issues = openIssues(dg).filter((i) => {
      if (ui.filters.qualitySeverity && i.severity !== ui.filters.qualitySeverity) return false;
      if (ui.kpiFocus === 'openQualityIssues') return true;
      if (ui.filters.qualityQ) {
        const hay = `${i.rule} ${i.dataset} ${i.field}`.toLowerCase();
        if (!hay.includes(ui.filters.qualityQ.toLowerCase())) return false;
      }
      return true;
    });
    return `
      <div class="grid-2">
        <article class="card"><h3>درجة الجودة الإجمالية</h3><strong style="font-size:2rem">${dg.qualityScore ?? '—'}%</strong>${bar(dg.qualityScore || 0)}</article>
        <article class="card"><h3>مشكلات مفتوحة</h3><strong style="font-size:2rem">${dg.openQualityIssues ?? 0}</strong></article>
      </div>
      <div class="toolbar" style="margin-top:12px;flex-wrap:wrap;gap:8px">
        <label class="field">بحث<input type="search" data-dg-change="qualityQ" value="${esc(ui.filters.qualityQ)}" /></label>
        <label class="field">الخطورة<select data-dg-change="qualitySeverity"><option value="">الكل</option>${['حرج', 'مرتفع', 'متوسط', 'منخفض'].map((s) => `<option value="${esc(s)}" ${ui.filters.qualitySeverity === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
        ${can(user, 'quality') ? `<button type="button" class="btn btn-primary" data-action="dg-modal" data-modal="quality_rule">+ قاعدة جودة</button>` : ''}
      </div>
      <h4 style="margin-top:16px">قواعد الجودة</h4>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>القاعدة</th><th>الأصل</th><th>الحقل</th><th>النوع</th><th>آخر تشغيل</th><th>فشل</th><th></th></tr></thead>
        <tbody>
          ${rules
            .map((r) => {
              const asset = assetById(dg, r.assetId);
              const runBtn = can(user, 'quality') ? `<button type="button" class="btn btn-sm btn-dark" data-action="dg-run-quality" data-id="${esc(r.id)}">Run Check</button>` : '';
              return `<tr><td>${esc(r.name)}</td><td>${esc(asset?.name || r.assetId)}</td><td>${esc(r.field)}</td><td>${esc(r.ruleType)}</td>
              <td>${esc(fmtTime(r.lastRun))}</td><td>${r.failed ?? 0}</td><td>${runBtn}</td></tr>`;
            })
            .join('') || '<tr><td colspan="7" class="empty">لا قواعد.</td></tr>'}
        </tbody>
      </table></div>
      <h4 style="margin-top:16px">مشكلات الجودة</h4>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Dataset</th><th>القاعدة</th><th>الخطورة</th><th>سجلات فاشلة</th><th>المالك</th><th>الحالة</th><th></th></tr></thead>
        <tbody>
          ${issues
            .map((i) => {
              const acts = [];
              if (can(user, 'quality')) {
                acts.push(`<button type="button" class="btn btn-sm btn-ghost" data-action="dg-issue-status" data-id="${esc(i.id)}" data-status="Assigned">تعيين</button>`);
                acts.push(`<button type="button" class="btn btn-sm btn-dark" data-action="dg-issue-status" data-id="${esc(i.id)}" data-status="In Progress">معالجة</button>`);
                acts.push(`<button type="button" class="btn btn-sm btn-primary" data-action="dg-issue-status" data-id="${esc(i.id)}" data-status="Resolved">حل</button>`);
                acts.push(`<button type="button" class="btn btn-sm btn-ghost" data-action="dg-issue-status" data-id="${esc(i.id)}" data-status="Closed">إغلاق</button>`);
              }
              return `<tr><td>${esc(i.dataset)}</td><td>${esc(i.rule)}</td><td>${badge(i.severity, 'severity')}</td><td>${i.failedRecords ?? 0}</td>
              <td>${esc(i.owner || '—')}</td><td>${badge(i.status, 'quality')}</td><td>${acts.join(' ')}</td></tr>`;
            })
            .join('') || '<tr><td colspan="7" class="empty">لا مشكلات مفتوحة.</td></tr>'}
        </tbody>
      </table></div>`;
  };

  const renderClassification = (dg) => {
    const assets = activeAssets(dg);
    const byClass = CLASSIFICATIONS.map((c) => ({ c, n: assets.filter((a) => a.classification === c).length }));
    const max = Math.max(1, ...byClass.map((x) => x.n));
    const noOwner = assets.filter((a) => !a.owner).length;
    const noSteward = assets.filter((a) => !a.steward).length;
    return `
      <div class="grid-2">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-layer-group icon"></i> التصنيف</span></h3>
          ${byClass
            .map(
              (x) => `<div style="display:flex;align-items:center;gap:8px;margin:8px 0"><span style="width:100px">${badge(x.c, 'classification')}</span>${bar((x.n / max) * 100)}<strong>${x.n}</strong></div>`
            )
            .join('')}
          <p style="margin-top:12px">غير مصنّف: <strong>${assets.filter((a) => !a.classification).length}</strong></p>
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-user-shield icon"></i> الملكية</span></h3>
          <p>بدون مالك: <strong>${noOwner}</strong></p>
          <p>بدون steward: <strong>${noSteward}</strong></p>
          <p>حساسة (سري/سري للغاية): <strong>${assets.filter((a) => ['سري', 'سري للغاية'].includes(a.classification)).length}</strong></p>
        </article>
      </div>
      <div class="table-wrap" style="margin-top:12px"><table class="data">
        <thead><tr><th>الأصل</th><th>التصنيف</th><th>الحساسية</th><th>المالك</th><th>Steward</th></tr></thead>
        <tbody>
          ${assets
            .slice(0, 20)
            .map(
              (a) => `<tr data-action="dg-drawer" data-id="${esc(a.id)}" style="cursor:pointer"><td>${esc(a.name)}</td>
              <td>${a.classification ? badge(a.classification, 'classification') : '—'}</td><td>${esc(a.sensitivity || '—')}</td>
              <td>${esc(a.owner || '—')}</td><td>${esc(a.steward || '—')}</td></tr>`
            )
            .join('')}
        </tbody>
      </table></div>`;
  };

  const renderPolicies = (dg, user) => {
    const q = (ui.filters.policyQ || '').toLowerCase();
    const rows = (dg.policies || []).filter((p) => {
      if (!q) return true;
      return `${p.name} ${p.title} ${p.category}`.toLowerCase().includes(q);
    });
    return `
      <div class="toolbar" style="margin-bottom:12px">
        <label class="field">بحث<input type="search" data-dg-change="policyQ" value="${esc(ui.filters.policyQ)}" /></label>
        ${can(user, 'policy_create') ? `<button type="button" class="btn btn-primary" data-action="dg-modal" data-modal="policy_new">+ سياسة</button>` : ''}
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>الاسم</th><th>الفئة</th><th>النطاق</th><th>المالك</th><th>الإصدار</th><th>الحالة</th><th>مراجعة</th><th></th></tr></thead>
        <tbody>
          ${rows
            .map((p) => {
              const acts = [];
              if (can(user, 'policy_edit')) acts.push(`<button type="button" class="btn btn-sm btn-ghost" data-action="dg-modal" data-modal="policy_edit" data-id="${esc(p.id)}">تعديل</button>`);
              if (can(user, 'policy_activate') && p.status !== 'active') acts.push(`<button type="button" class="btn btn-sm btn-dark" data-action="dg-activate-policy" data-id="${esc(p.id)}">تفعيل</button>`);
              return `<tr><td><strong>${esc(p.name || p.title)}</strong></td><td>${esc(p.category || '—')}</td><td>${esc(p.scope || p.appliesTo || '—')}</td>
              <td>${esc(p.owner || '—')}</td><td>${esc(p.version || '—')}</td><td>${badge(p.status)}</td><td>${esc(p.reviewDate || '—')}</td><td>${acts.join(' ') || '—'}</td></tr>`;
            })
            .join('') || '<tr><td colspan="8" class="empty">لا سياسات.</td></tr>'}
        </tbody>
      </table></div>`;
  };

  const renderApprovals = (dg, user) => {
    const q = (ui.filters.approvalQ || '').toLowerCase();
    const rows = (dg.approvals || []).filter((a) => {
      if (!q) return true;
      return `${a.entityLabel} ${a.type} ${a.requestedBy}`.toLowerCase().includes(q);
    });
    return `
      <div class="toolbar"><label class="field">بحث<input type="search" data-dg-change="approvalQ" value="${esc(ui.filters.approvalQ)}" /></label></div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>النوع</th><th>الكيان</th><th>طلب بواسطة</th><th>المكلّف</th><th>التاريخ</th><th>الحالة</th><th></th></tr></thead>
        <tbody>
          ${rows
            .map((a) => {
              const acts = [];
              if (can(user, 'approve') && a.status === 'pending') {
                acts.push(`<button type="button" class="btn btn-sm btn-primary" data-action="dg-approval" data-id="${esc(a.id)}" data-decision="approve">اعتماد</button>`);
                acts.push(`<button type="button" class="btn btn-sm btn-dark" data-action="dg-approval" data-id="${esc(a.id)}" data-decision="changes">طلب تعديل</button>`);
                acts.push(`<button type="button" class="btn btn-sm btn-ghost" data-action="dg-modal" data-modal="approval_reject" data-id="${esc(a.id)}">رفض</button>`);
              }
              return `<tr><td>${esc(a.type)}</td><td>${esc(a.entityLabel)}</td><td>${esc(a.requestedBy)}</td><td>${esc(a.assignedTo || '—')}</td>
              <td>${esc(fmtTime(a.date))}</td><td>${badge(a.status)}</td><td>${acts.join(' ') || '—'}</td></tr>`;
            })
            .join('') || '<tr><td colspan="7" class="empty">لا طلبات اعتماد.</td></tr>'}
        </tbody>
      </table></div>`;
  };

  const buildReportBody = (dg, type) => {
    const lines = [];
    lines.push(`<h2>تقرير حوكمة البيانات — ${esc(type)}</h2>`);
    lines.push(`<p>تاريخ: ${esc(fmtTime(new Date().toISOString()))}</p>`);
    lines.push(`<p>جودة: <strong>${dg.qualityScore}%</strong> · تصنيف: <strong>${dg.classifiedPct}%</strong> · أصول: <strong>${dg.totalAssets}</strong> · مشكلات: <strong>${dg.openQualityIssues}</strong></p>`);
    if (type === 'executive' || type === 'full') {
      lines.push('<h3>إجراء مطلوب</h3><ul>');
      actionNeeded(dg).forEach((a) => lines.push(`<li>${esc(a.text)}</li>`));
      if (!actionNeeded(dg).length) lines.push('<li>لا عناصر عاجلة</li>');
      lines.push('</ul>');
    }
    if (type === 'catalog' || type === 'full') {
      lines.push('<h3>الكتالوج (مختصر)</h3><table border="1" cellpadding="6" style="width:100%;border-collapse:collapse"><tr><th>ID</th><th>الاسم</th><th>التصنيف</th><th>الجودة</th></tr>');
      activeAssets(dg)
        .slice(0, 40)
        .forEach((a) => lines.push(`<tr><td>${esc(a.id)}</td><td>${esc(a.name)}</td><td>${esc(a.classification || '—')}</td><td>${a.quality}%</td></tr>`));
      lines.push('</table>');
    }
    if (type === 'quality' || type === 'full') {
      lines.push('<h3>مشكلات الجودة</h3><ul>');
      openIssues(dg).forEach((i) => lines.push(`<li>${esc(i.dataset)} — ${esc(i.rule)} (${esc(i.severity)})</li>`));
      lines.push('</ul>');
    }
    if (type === 'sources' || type === 'full') {
      lines.push('<h3>المصادر</h3><ul>');
      activeSources(dg).forEach((s) => lines.push(`<li>${esc(s.name)}: ${esc(sourceStatusLabel(s.status))}</li>`));
      lines.push('</ul>');
    }
    if (type === 'classification' || type === 'full') {
      lines.push('<h3>التصنيف</h3><ul>');
      CLASSIFICATIONS.forEach((c) => {
        const n = activeAssets(dg).filter((a) => a.classification === c).length;
        lines.push(`<li>${esc(c)}: ${n}</li>`);
      });
      lines.push('</ul>');
    }
    return lines.join('\n');
  };

  const renderReports = (dg, user) => {
    const cards = [
      { type: 'executive', title: 'ملخص تنفيذي', desc: 'مؤشرات وإجراء مطلوب' },
      { type: 'catalog', title: 'تقرير الكتالوج', desc: 'قائمة الأصول والتصنيف' },
      { type: 'quality', title: 'تقرير الجودة', desc: 'القواعد والمشكلات' },
      { type: 'sources', title: 'تقرير المصادر', desc: 'حالة الاتصال والمزامنة' },
      { type: 'classification', title: 'تقرير التصنيف', desc: 'توزيع مستويات السرية' },
      { type: 'full', title: 'تقرير شامل', desc: 'كل الأقسام للقيادة' },
    ];
    const body = ui.report ? buildReportBody(dg, ui.report.type) : '';
    return `
      <div class="grid-2" style="margin-bottom:12px">
        ${cards
          .map(
            (c) => `<button type="button" class="card" style="text-align:right;cursor:pointer" data-action="dg-report" data-type="${esc(c.type)}">
              <b>${esc(c.title)}</b><div class="empty" style="padding:8px 0 0;text-align:right">${esc(c.desc)}</div></button>`
          )
          .join('')}
      </div>
      <div class="toolbar">
        ${can(user, 'reports') ? `<button type="button" class="btn btn-primary" data-action="dg-report" data-type="${esc(ui.report?.type || 'executive')}">معاينة</button>` : ''}
        ${ui.report && can(user, 'print') ? `<button type="button" class="btn btn-dark" data-action="dg-report-print">PDF / طباعة</button>` : ''}
        ${ui.report && can(user, 'export') ? `<button type="button" class="btn btn-ghost" data-action="dg-export" data-format="csv">CSV</button>` : ''}
      </div>
      ${ui.report ? `<article class="card report-body">${body}</article>` : '<p class="empty">اختر تقريراً ثم معاينة.</p>'}`;
  };

  const renderAudit = (dg, user) => {
    const q = (ui.filters.auditQ || '').toLowerCase();
    const act = ui.filters.auditAction || '';
    const rows = (dg.auditLog || []).filter((a) => {
      if (act && a.action !== act && !String(a.action).includes(act)) return false;
      if (!q) return true;
      const hay = `${a.action} ${a.user} ${a.entityType} ${a.entityLabel} ${a.oldValue} ${a.newValue}`.toLowerCase();
      return hay.includes(q);
    });
    return `
      <div class="toolbar" style="flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <label class="field">بحث<input type="search" data-dg-change="auditQ" value="${esc(ui.filters.auditQ)}" /></label>
        <label class="field">الإجراء<input type="text" data-dg-change="auditAction" value="${esc(ui.filters.auditAction)}" placeholder="فلتر إجراء…" /></label>
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>الوقت</th><th>المستخدم</th><th>الإجراء</th><th>الكيان</th><th>قبل</th><th>بعد</th><th>الحالة</th></tr></thead>
        <tbody>
          ${rows
            .slice(0, 120)
            .map(
              (a) => `<tr><td>${esc(fmtTime(a.at))}</td><td>${esc(a.user)}</td><td>${esc(a.action)}</td>
              <td>${esc(a.entityType)} · ${esc(a.entityLabel || a.entityId)}</td><td><small>${esc(a.oldValue)}</small></td><td><small>${esc(a.newValue)}</small></td><td>${esc(a.status || 'ok')}</td></tr>`
            )
            .join('') || '<tr><td colspan="7" class="empty">السجل فارغ.</td></tr>'}
        </tbody>
      </table></div>`;
  };

  const renderSettings = (dg, user) => {
    const s = dg.settings || {};
    if (!can(user, 'settings')) {
      return '<p class="empty">لا صلاحية لتعديل الإعدادات — عرض للقراءة فقط.</p><pre style="white-space:pre-wrap;font-size:.85rem">' + esc(JSON.stringify(s, null, 2)) + '</pre>';
    }
    return `
      <form data-dg-settings-form>
        <div class="grid-2">
          <label class="field"><input type="checkbox" id="dg-set-approval" ${s.requireApproval ? 'checked' : ''} /> اعتماد إلزامي للأصول الجديدة</label>
          <label class="field">حد الجودة %<input type="number" id="dg-set-quality" value="${esc(String(s.qualityThreshold ?? 80))}" min="0" max="100" /></label>
          <label class="field">جدولة الفحص<input id="dg-set-scan" value="${esc(s.scanSchedule || '')}" /></label>
          <label class="field"><input type="checkbox" id="dg-set-notify" ${s.notifyOnIssue ? 'checked' : ''} /> تنبيه عند مشكلة جودة</label>
          <label class="field">احتفاظ افتراضي (أشهر)<input type="number" id="dg-set-retention" value="${esc(String(s.defaultRetentionMonths ?? 24))}" /></label>
          <label class="field"><input type="checkbox" id="dg-set-catalog" ${s.allowEmployeeCatalogView ? 'checked' : ''} /> السماح للموظف بعرض الكتالوج</label>
        </div>
        <button type="button" class="btn btn-primary" data-action="dg-settings-save">حفظ الإعدادات</button>
      </form>
      <article class="card" style="margin-top:16px">
        <h3><span class="title-left"><i class="fas fa-plug icon"></i> التكاملات السريعة</span></h3>
        <p class="empty">راجع تبويب المصادر للتفاصيل الكاملة — ${(dg.integrations || []).length} تكامل مسجّل.</p>
      </article>`;
  };

  const renderTabs = () => {
    const tabs = [
      { id: 'overview', label: 'نظرة عامة', icon: 'fa-gauge-high' },
      { id: 'catalog', label: 'الكتالوج', icon: 'fa-database' },
      { id: 'sources', label: 'المصادر', icon: 'fa-plug' },
      { id: 'lineage', label: 'السلسلة', icon: 'fa-diagram-project' },
      { id: 'quality', label: 'الجودة', icon: 'fa-check-double' },
      { id: 'classification', label: 'التصنيف', icon: 'fa-lock' },
      { id: 'policies', label: 'السياسات', icon: 'fa-file-shield' },
      { id: 'approvals', label: 'الاعتمادات', icon: 'fa-stamp' },
      { id: 'reports', label: 'التقارير', icon: 'fa-file-lines' },
      { id: 'audit', label: 'سجل الأنشطة', icon: 'fa-list-check' },
      { id: 'settings', label: 'الإعدادات', icon: 'fa-gear' },
    ];
    return `<div class="tabs" role="tablist">${tabs
      .map(
        (t) => `<button type="button" class="tab ${ui.tab === t.id ? 'active' : ''}" data-action="dg-tab" data-tab="${esc(t.id)}" role="tab">
        <i class="fas ${esc(t.icon)} icon"></i> ${esc(t.label)}</button>`
      )
      .join('')}</div>`;
  };

  const renderHeader = (dg, user) => {
    const exportMenu = ui.exportOpen
      ? `<div style="position:absolute;left:0;top:100%;z-index:5;background:#fff;border:1px solid #ddd;border-radius:8px;padding:8px;min-width:160px;box-shadow:0 4px 12px rgba(0,0,0,.12)">
          <button type="button" class="btn btn-sm btn-ghost" style="width:100%;margin:4px 0" data-action="dg-export" data-format="csv">CSV</button>
          <button type="button" class="btn btn-sm btn-ghost" style="width:100%;margin:4px 0" data-action="dg-export" data-format="print">طباعة</button>
        </div>`
      : '';
    const roleLabel = { admin: 'صلاحية كاملة', steward: 'مهندس رئيسي / steward', auditor: 'مدقق', employee: 'موظف — عرض ومسودات' }[permLevel(user)] || permLevel(user);
    return `<div class="toolbar" style="flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center">
      <div style="flex:1">
        <h2 style="margin:0"><span class="title-left"><i class="fas fa-database icon"></i> حوكمة البيانات</span></h2>
        <small>كتالوج · مصادر · جودة · تصنيف · سياسات · اعتمادات · RBAC</small>
      </div>
      ${can(user, 'create_asset') || can(user, 'create_asset_draft') ? `<button type="button" class="btn btn-primary" data-action="dg-modal" data-modal="asset_wizard"><i class="fas fa-plus icon"></i> إضافة أصل بيانات</button>` : ''}
      ${can(user, 'create_source') ? `<button type="button" class="btn btn-dark" data-action="dg-modal" data-modal="source_wizard">إضافة مصدر بيانات</button>` : ''}
      ${can(user, 'import') ? `<button type="button" class="btn btn-dark" data-action="dg-modal" data-modal="import">استيراد بيانات</button>` : ''}
      ${can(user, 'test_source') ? `<button type="button" class="btn btn-ghost" data-action="dg-tab" data-tab="sources">فحص المصادر</button>` : ''}
      ${can(user, 'reports') ? `<button type="button" class="btn btn-dark" data-action="dg-tab" data-tab="reports">إنشاء تقرير</button>` : ''}
      ${can(user, 'settings') ? `<button type="button" class="btn btn-ghost" data-action="dg-tab" data-tab="settings">الإعدادات</button>` : ''}
      ${can(user, 'export') ? `<div class="field" style="position:relative"><button type="button" class="btn btn-ghost" data-action="dg-export-toggle">تصدير ▾</button>${exportMenu}</div>` : ''}
      <span class="badge badge-outline">${esc(roleLabel)}</span>
    </div>`;
  };

  const renderDrawerBody = (dg, asset, user) => {
    const people = dg.people || [];
    const tab = ui.drawerTab || 'overview';
    const nav = DRAWER_TABS.map(
      (t) => `<button type="button" class="btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-ghost'}" data-action="dg-drawer-tab" data-tab="${esc(t.id)}"><i class="fas ${esc(t.icon)} icon"></i> ${esc(t.label)}</button>`
    ).join(' ');
    let body = '';
    if (tab === 'overview') {
      body = `<dl style="display:grid;grid-template-columns:130px 1fr;gap:8px">
        <dt>Asset ID</dt><dd>${esc(asset.id)}</dd>
        <dt>الاسم</dt><dd>${esc(asset.name)}</dd>
        <dt>اسم الأعمال</dt><dd>${esc(asset.businessName || '—')}</dd>
        <dt>النوع</dt><dd>${esc(asset.type)}</dd>
        <dt>الحالة</dt><dd>${badge(statusLabel(asset.status))}</dd>
        <dt>الجودة</dt><dd>${asset.quality ?? '—'}% ${bar(asset.quality)}</dd>
        <dt>Metadata</dt><dd>${asset.metadataCompletion ?? '—'}% ${bar(asset.metadataCompletion)}</dd>
      </dl>`;
    } else if (tab === 'metadata') {
      body = `<p>${esc(asset.description || '—')}</p><p><strong>تقني:</strong> ${esc(asset.technicalDescription || '—')}</p>
        <p>الوسوم: ${(asset.tags || []).map((t) => badge(t)).join(' ') || '—'}</p>
        <p>الموقع: ${esc(asset.location || '—')}</p>`;
    } else if (tab === 'schema') {
      body = `<div class="table-wrap"><table class="data"><thead><tr><th>الحقل</th><th>نوع</th><th>Nullable</th><th>PK</th><th>تصنيف</th></tr></thead><tbody>
        ${(asset.fields || [])
          .map((f) => `<tr><td>${esc(f.name)}</td><td>${esc(f.dataType)}</td><td>${f.nullable ? 'نعم' : 'لا'}</td><td>${f.pk ? '✓' : ''}</td><td>${esc(f.classification || '—')}</td></tr>`)
          .join('') || '<tr><td colspan="5" class="empty">لا حقول.</td></tr>'}
      </tbody></table></div>`;
    } else if (tab === 'source') {
      body = `<p>المصدر: <strong>${esc(asset.sourceName || '—')}</strong> (${esc(asset.sourceId || '')})</p>
        <p>النظام: ${esc(asset.system || '—')} · DB: ${esc(asset.database || '—')} · Schema: ${esc(asset.schema || '—')} · Table: ${esc(asset.tableName || '—')}</p>
        <h4>SOURCE → … → CONSUMERS</h4>${renderLineageChain(asset)}`;
    } else if (tab === 'lineage') {
      body = renderLineageChain(asset);
    } else if (tab === 'quality') {
      const rules = (dg.qualityRules || []).filter((r) => r.assetId === asset.id);
      body = `<ul>${rules.map((r) => `<li>${esc(r.name)} — ${esc(r.ruleType)} (فشل: ${r.failed ?? 0})</li>`).join('') || '<li class="empty">لا قواعد مرتبطة</li>'}</ul>`;
    } else if (tab === 'classification') {
      body = can(user, 'edit_asset')
        ? `<div class="toolbar" style="flex-wrap:wrap;gap:8px">
          <label class="field">التصنيف<select id="dg-d-class">${CLASSIFICATIONS.map((c) => `<option value="${esc(c)}" ${asset.classification === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
          <label class="field">الحساسية<select id="dg-d-sens">${SENSITIVITY_LEVELS.map((s) => `<option value="${esc(s)}" ${asset.sensitivity === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
          <button type="button" class="btn btn-sm btn-dark" data-action="dg-asset-patch" data-id="${esc(asset.id)}">حفظ التصنيف</button>
        </div>`
        : `<p>التصنيف: ${badge(asset.classification || '—', 'classification')} · الحساسية: ${esc(asset.sensitivity || '—')}</p>`;
    } else if (tab === 'policies') {
      const rel = (dg.policies || []).filter((p) => String(p.appliesTo || '').toLowerCase().includes(String(asset.sensitivity || '').toLowerCase()) || String(p.scope || '').includes('كل'));
      body = `<ul>${rel.map((p) => `<li>${esc(p.name)} (${esc(p.status)})</li>`).join('') || '<li>—</li>'}</ul>`;
    } else if (tab === 'usage') {
      body = `<p class="empty">استخدام تقريبي — ${(asset.lineage?.downstream || []).length} مستهلك downstream.</p>`;
    } else if (tab === 'history') {
      const hist = (dg.auditLog || []).filter((a) => a.entityId === asset.id).slice(0, 15);
      body = `<ul>${hist.map((h) => `<li>${esc(fmtTime(h.at))}: ${esc(h.action)} (${esc(h.user)})</li>`).join('') || '<li>—</li>'}</ul>`;
    } else if (tab === 'comments') {
      body = `<ul>${(asset.comments || []).map((c) => `<li>${esc(fmtTime(c.at))}: ${esc(c.text)} — ${esc(c.by)}</li>`).join('') || '<li>لا تعليقات</li>'}</ul>
        <label class="field">تعليق<input id="dg-d-comment" /></label>
        <button type="button" class="btn btn-sm btn-primary" data-action="dg-asset-comment" data-id="${esc(asset.id)}">إضافة</button>`;
    } else if (tab === 'attachments') {
      body = `<ul>${(asset.attachments || []).map((a) => `<li>${esc(a.name)} — ${esc(fmtTime(a.at))}</li>`).join('') || '<li>لا مرفقات</li>'}</ul>
        <label class="field">مرفق (اسم)<input id="dg-d-attach" /></label>
        <button type="button" class="btn btn-sm btn-primary" data-action="dg-asset-attach" data-id="${esc(asset.id)}">إرفاق</button>`;
    }
    if (can(user, 'edit_asset') && (tab === 'overview' || tab === 'metadata')) {
      body += `<div class="toolbar" style="margin-top:12px;flex-wrap:wrap;gap:8px;border-top:1px solid rgba(0,0,0,.08);padding-top:12px">
        <label class="field">المالك<select id="dg-d-owner"><option value="">—</option>${people.map((p) => `<option value="${esc(p)}" ${asset.owner === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>
        <label class="field">Steward<select id="dg-d-steward"><option value="">—</option>${people.map((p) => `<option value="${esc(p)}" ${asset.steward === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>
        <button type="button" class="btn btn-sm btn-dark" data-action="dg-asset-patch" data-id="${esc(asset.id)}">حفظ الملكية</button>
      </div>`;
    }
    return `<div style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:4px">${nav}</div>${body}`;
  };

  const renderDrawer = (dg, user) => {
    if (!ui.drawer) return '';
    const asset = assetById(dg, ui.drawer);
    if (!asset) return '';
    return `<aside class="card" data-dg-drawer style="position:fixed;left:0;top:0;bottom:0;width:min(520px,94vw);z-index:40;overflow:auto;box-shadow:4px 0 24px rgba(0,0,0,.15);margin:0;border-radius:0">
      <div class="toolbar" style="position:sticky;top:0;background:inherit;z-index:1">
        <strong>${esc(asset.name)}</strong>
        <button type="button" class="btn btn-sm btn-ghost" data-action="dg-drawer-close">✕</button>
      </div>
      ${renderDrawerBody(dg, asset, user)}
    </aside>`;
  };

  const renderWizardStep = (dg) => {
    const w = ui.wizardData || {};
    const step = ui.wizardStep || 0;
    const sources = activeSources(dg);
    const people = dg.people || [];
    const depts = dg.departments || [];
    switch (step) {
      case 0:
        return `${formField('اسم الأصل *', 'dg-w-name', w.name || '')}
          ${formField('اسم الأعمال', 'dg-w-bname', w.businessName || '')}
          ${formField('النوع *', 'dg-w-type', '', 'select', ASSET_TYPES.map((t) => `<option value="${esc(t)}" ${w.type === t ? 'selected' : ''}>${esc(t)}</option>`).join(''))}
          ${formField('الوصف *', 'dg-w-desc', w.description || '', 'textarea')}`;
      case 1:
        return `${formField('المصدر', 'dg-w-source', '', 'select', `<option value=""></option>${sources.map((s) => `<option value="${esc(s.id)}" data-name="${esc(s.name)}" ${w.sourceId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}`)}
          ${formField('النظام', 'dg-w-system', w.system || '')}
          ${formField('قاعدة البيانات', 'dg-w-db', w.database || '')}
          ${formField('Schema', 'dg-w-schema', w.schema || '')}
          ${formField('Table / كائن', 'dg-w-table', w.tableName || '')}
          ${formField('الموقع', 'dg-w-loc', w.location || '')}`;
      case 2:
        return `${formField('الإدارة', 'dg-w-dept', '', 'select', `<option value=""></option>${depts.map((d) => `<option value="${esc(d)}" ${w.department === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}`)}
          ${formField('المالك *', 'dg-w-owner', '', 'select', `<option value=""></option>${people.map((p) => `<option value="${esc(p)}" ${w.owner === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}`)}
          ${formField('Steward', 'dg-w-steward', '', 'select', `<option value=""></option>${people.map((p) => `<option value="${esc(p)}" ${w.steward === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}`)}
          ${formField('المالك التقني', 'dg-w-tech', w.technicalOwner || '')}`;
      case 3:
        return `${formField('التصنيف *', 'dg-w-class', '', 'select', `<option value=""></option>${CLASSIFICATIONS.map((c) => `<option value="${esc(c)}" ${w.classification === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}`)}
          ${formField('الحساسية', 'dg-w-sens', '', 'select', SENSITIVITY_LEVELS.map((s) => `<option value="${esc(s)}" ${w.sensitivity === s ? 'selected' : ''}>${esc(s)}</option>`).join(''))}
          ${formField('وسوم (فاصلة)', 'dg-w-tags', w.tagsStr || '')}`;
      case 4:
        return `${formField('وصف تقني', 'dg-w-techdesc', w.technicalDescription || '', 'textarea')}
          <p class="empty">الحقول: سطر لكل حقل — name|type|nullable|pk|classification</p>
          ${formField('تعريف الحقول', 'dg-w-fields', w.fieldsRaw || '', 'textarea')}`;
      default:
        return `<h4>مراجعة قبل الحفظ</h4>
          <ul><li>الاسم: ${esc(w.name || '—')}</li><li>النوع: ${esc(w.type || '—')}</li><li>المصدر: ${esc(w.sourceName || w.sourceId || '—')}</li>
          <li>المالك: ${esc(w.owner || '—')}</li><li>التصنيف: ${esc(w.classification || '—')}</li></ul>`;
    }
  };

  const renderModal = (dg, user) => {
    if (!ui.modal) return '';
    let title = '';
    let body = '';
    let footer = '';
    const people = dg.people || [];
    if (ui.modal === 'asset_wizard') {
      title = `معالج أصل بيانات — ${esc(WIZARD_STEPS[ui.wizardStep] || '')} (${(ui.wizardStep || 0) + 1}/${WIZARD_STEPS.length})`;
      body = `<div class="toolbar" style="margin-bottom:12px;flex-wrap:wrap;gap:4px">${WIZARD_STEPS.map((s, i) => `<span class="badge ${i === ui.wizardStep ? 'badge-black' : 'badge-outline'}">${i + 1}. ${esc(s)}</span>`).join(' ')}</div>${renderWizardStep(dg)}`;
      footer = `<button type="button" class="btn btn-ghost" data-action="dg-modal-close">إلغاء</button>
        <button type="button" class="btn btn-ghost" data-action="dg-wizard-prev" ${ui.wizardStep <= 0 ? 'disabled' : ''}>السابق</button>
        <button type="button" class="btn btn-dark" data-action="dg-wizard-next" data-mode="draft">حفظ مسودة</button>
        ${ui.wizardStep >= WIZARD_STEPS.length - 1 ? `<button type="button" class="btn btn-primary" data-action="dg-wizard-submit">حفظ + إرسال للاعتماد</button>` : `<button type="button" class="btn btn-primary" data-action="dg-wizard-next">التالي</button>`}`;
    } else if (ui.modal === 'source_wizard' || ui.modal === 'source_edit') {
      const s = ui.modal === 'source_edit' ? sourceById(dg, ui.sourceEditId) : null;
      title = s ? 'تعديل مصدر' : 'إضافة مصدر بيانات';
      body = `${formField('الاسم *', 'dg-src-name', s?.name || '')}
        ${formField('النوع', 'dg-src-type', '', 'select', SOURCE_TYPES.map((t) => `<option value="${esc(t)}" ${s?.type === t ? 'selected' : ''}>${esc(t)}</option>`).join(''))}
        ${formField('النظام', 'dg-src-system', s?.system || '')}
        ${formField('Host', 'dg-src-host', s?.host || '')}
        ${formField('Port', 'dg-src-port', s?.port ?? '', 'number')}
        ${formField('Database', 'dg-src-db', s?.database || '')}
        ${formField('المالك', 'dg-src-owner', '', 'select', `<option value=""></option>${people.map((p) => `<option value="${esc(p)}" ${s?.owner === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}`)}`;
      footer = `<button type="button" class="btn btn-ghost" data-action="dg-modal-close">إلغاء</button>
        <button type="button" class="btn btn-primary" data-action="dg-source-save" data-id="${esc(s?.id || '')}">حفظ</button>`;
    } else if (ui.modal === 'import') {
      title = 'استيراد أصول بيانات';
      body = `<p class="empty">الصق CSV أو سطر لكل أصل: name,type,system,owner,classification</p>
        ${formField('البيانات', 'dg-import-raw', ui.importRaw || '', 'textarea')}
        ${ui.importPreview.length ? `<h4>معاينة (${ui.importPreview.length})</h4><div class="table-wrap"><table class="data"><thead><tr><th>name</th><th>type</th><th>owner</th></tr></thead><tbody>
          ${ui.importPreview.slice(0, 8).map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.type)}</td><td>${esc(r.owner)}</td></tr>`).join('')}
        </tbody></table></div>` : ''}`;
      footer = `<button type="button" class="btn btn-ghost" data-action="dg-modal-close">إلغاء</button>
        <button type="button" class="btn btn-dark" data-action="dg-import-preview">معاينة</button>
        <button type="button" class="btn btn-primary" data-action="dg-import-run">استيراد</button>`;
    } else if (ui.modal === 'quality_rule') {
      title = 'قاعدة جودة جديدة';
      const assets = activeAssets(dg);
      body = `${formField('الاسم *', 'dg-qr-name', '')}
        ${formField('الأصل', 'dg-qr-asset', '', 'select', `<option value=""></option>${assets.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}`)}
        ${formField('الحقل', 'dg-qr-field', '')}
        ${formField('النوع', 'dg-qr-type', '', 'select', RULE_TYPES.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join(''))}
        ${formField('الشرط', 'dg-qr-cond', '')}
        ${formField('الخطورة', 'dg-qr-sev', '', 'select', ['حرج', 'مرتفع', 'متوسط', 'منخفض'].map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join(''))}`;
      footer = `<button type="button" class="btn btn-ghost" data-action="dg-modal-close">إلغاء</button>
        <button type="button" class="btn btn-primary" data-action="dg-quality-save">حفظ</button>`;
    } else if (ui.modal === 'policy_new' || ui.modal === 'policy_edit') {
      const p = ui.modal === 'policy_edit' ? (dg.policies || []).find((x) => x.id === ui.policyEditId) : null;
      title = p ? 'تعديل سياسة' : 'سياسة جديدة';
      body = `${formField('الاسم *', 'dg-pol-name', p?.name || '')}
        ${formField('الفئة', 'dg-pol-cat', p?.category || '')}
        ${formField('النطاق', 'dg-pol-scope', p?.scope || p?.appliesTo || '')}
        ${formField('تاريخ المراجعة', 'dg-pol-review', p?.reviewDate || '', 'date')}
        ${formField('الإصدار', 'dg-pol-ver', p?.version || '1.0')}`;
      footer = `<button type="button" class="btn btn-ghost" data-action="dg-modal-close">إلغاء</button>
        <button type="button" class="btn btn-primary" data-action="dg-policy-save" data-id="${esc(p?.id || '')}">حفظ</button>`;
    } else if (ui.modal === 'approval_reject') {
      title = 'رفض طلب الاعتماد';
      body = `<p class="empty">التعليق إجباري عند الرفض.</p>${formField('سبب الرفض *', 'dg-apr-comment', '', 'textarea')}`;
      footer = `<button type="button" class="btn btn-ghost" data-action="dg-modal-close">إلغاء</button>
        <button type="button" class="btn btn-primary" data-action="dg-approval-reject" data-id="${esc(ui.approvalCommentId || '')}">رفض</button>`;
    }
    if (!title) return '';
    return `<div data-dg-modal-backdrop style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px">
      <div class="card" style="width:min(560px,96vw);max-height:90vh;overflow:auto" role="dialog">
        <h3>${title}</h3>
        ${ui.error ? `<p class="badge badge-red">${esc(ui.error)}</p>` : ''}
        ${body}
        <div class="toolbar" style="margin-top:12px;justify-content:flex-end">${footer}</div>
      </div>
    </div>`;
  };

  const renderConfirm = () => {
    if (!ui.confirm) return '';
    const c = ui.confirm;
    return `<div data-dg-confirm style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:60;display:flex;align-items:center;justify-content:center">
      <article class="card" style="max-width:420px"><h3>تأكيد</h3><p>${esc(c.message || 'هل أنت متأكد؟')}</p>
        <div class="toolbar"><button type="button" class="btn btn-ghost" data-action="dg-confirm-cancel">إلغاء</button>
        <button type="button" class="btn btn-primary" data-action="dg-confirm-ok" data-kind="${esc(c.kind)}" data-id="${esc(c.id)}">تأكيد</button></div>
      </article></div>`;
  };

  const renderTabBody = (dg, user) => {
    switch (ui.tab) {
      case 'catalog':
        return renderCatalog(dg, user);
      case 'sources':
        return renderSources(dg, user);
      case 'lineage':
        return renderLineageTab(dg);
      case 'quality':
        return renderQuality(dg, user);
      case 'classification':
        return renderClassification(dg);
      case 'policies':
        return renderPolicies(dg, user);
      case 'approvals':
        return renderApprovals(dg, user);
      case 'reports':
        return renderReports(dg, user);
      case 'audit':
        return renderAudit(dg, user);
      case 'settings':
        return renderSettings(dg, user);
      default:
        return renderOverview(dg, user);
    }
  };

  const render = (ctx = {}) => {
    const user = ctx.user || {};
    const dg = dgData();
    ui.loading = false;
    return `<div class="hub-data-governance" dir="rtl" data-hub-data-governance>
      ${renderHeader(dg, user)}
      ${renderKpis(dg)}
      ${renderTabs()}
      <div class="card" style="margin-top:12px">${renderTabBody(dg, user)}</div>
      ${renderDrawer(dg, user)}
      ${renderModal(dg, user)}
      ${renderConfirm()}
    </div>`;
  };

  const parseImportLines = (raw) => {
    const lines = String(raw || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.map((line) => {
      const parts = line.split(',').map((x) => x.trim());
      return {
        name: parts[0] || 'مستورد',
        type: parts[1] || 'Table',
        system: parts[2] || '',
        owner: parts[3] || '',
        classification: parts[4] || '',
        department: parts[5] || '',
        steward: parts[6] || '',
        description: 'مستورد',
      };
    });
  };

  const parseFieldsRaw = (raw) => {
    return String(raw || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, dataType, nullable, pk, classification] = line.split('|').map((x) => x.trim());
        return {
          name: name || 'field',
          businessName: name || '',
          dataType: dataType || 'varchar',
          nullable: nullable === 'true' || nullable === '1' || nullable === 'نعم',
          pk: pk === 'true' || pk === '1' || pk === 'pk',
          classification: classification || 'داخلي',
          sensitive: false,
          quality: 100,
        };
      });
  };

  const collectWizardFromDom = () => {
    const sel = document.getElementById('dg-w-source');
    const sourceId = qVal('dg-w-source');
    const sourceName = sel?.selectedOptions?.[0]?.dataset?.name || sel?.selectedOptions?.[0]?.text || '';
    ui.wizardData = {
      ...ui.wizardData,
      name: qVal('dg-w-name'),
      businessName: qVal('dg-w-bname'),
      type: qVal('dg-w-type'),
      description: qVal('dg-w-desc'),
      sourceId,
      sourceName,
      system: qVal('dg-w-system'),
      database: qVal('dg-w-db'),
      schema: qVal('dg-w-schema'),
      tableName: qVal('dg-w-table'),
      location: qVal('dg-w-loc'),
      department: qVal('dg-w-dept'),
      owner: qVal('dg-w-owner'),
      steward: qVal('dg-w-steward'),
      technicalOwner: qVal('dg-w-tech'),
      classification: qVal('dg-w-class'),
      sensitivity: qVal('dg-w-sens'),
      tagsStr: qVal('dg-w-tags'),
      technicalDescription: qVal('dg-w-techdesc'),
      fieldsRaw: qVal('dg-w-fields'),
    };
  };

  const validateWizardStep = (step) => {
    const w = ui.wizardData || {};
    if (step === 0 && (!w.name?.trim() || !w.type || !w.description?.trim())) {
      ui.error = 'الاسم والنوع والوصف مطلوبة';
      return false;
    }
    if (step === 2 && !w.owner?.trim()) {
      ui.error = 'المالك مطلوب';
      return false;
    }
    if (step === 3 && !w.classification?.trim()) {
      ui.error = 'التصنيف مطلوب';
      return false;
    }
    return true;
  };

  const wizardPayload = (draft, submit) => {
    const w = ui.wizardData || {};
    return {
      name: w.name,
      businessName: w.businessName || w.name,
      type: w.type,
      description: w.description,
      technicalDescription: w.technicalDescription,
      sourceId: w.sourceId,
      sourceName: w.sourceName,
      system: w.system,
      database: w.database,
      schema: w.schema,
      tableName: w.tableName,
      location: w.location,
      department: w.department,
      owner: w.owner,
      steward: w.steward,
      technicalOwner: w.technicalOwner,
      classification: w.classification,
      sensitivity: w.sensitivity,
      tags: w.tagsStr,
      fields: parseFieldsRaw(w.fieldsRaw),
      draft: !!draft,
      submitApproval: !!submit,
    };
  };

  const exportCsv = (dg) => {
    const lines = [['Asset ID', 'Name', 'Type', 'Classification', 'Quality', 'Owner', 'Status'].join(',')];
    activeAssets(dg).forEach((a) => {
      lines.push([a.id, `"${(a.name || '').replace(/"/g, '""')}"`, a.type, a.classification || '', a.quality, a.owner || '', a.status].join(','));
    });
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `naiosh-data-governance-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportPrint = (dg) => {
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>حوكمة البيانات</title>
      <style>body{font-family:Tahoma,Arial;padding:24px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccc;padding:6px}</style></head><body>
      ${buildReportBody(dg, ui.report?.type || 'full')}
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const handle = (action, btn, ctx = {}) => {
    if (!action || !String(action).startsWith('dg-')) return false;
    const user = ctx.user || {};
    const toast = ctx.toast || (() => {});
    const act = actorName(user);
    const HS = store();
    if (!HS) {
      ui.error = 'HubStore غير متاح';
      return true;
    }
    ui.error = '';

    if (action === 'dg-tab') {
      ui.tab = btn.dataset.tab || 'overview';
      ui.page = 1;
      return true;
    }

    if (action === 'dg-kpi-focus') {
      ui.kpiFocus = btn.dataset.focus || btn.dataset.kpi || '';
      ui.tab = btn.dataset.tab || 'overview';
      if (ui.kpiFocus === 'totalAssets' || ui.kpiFocus === 'metadataCompletion') ui.tab = 'catalog';
      if (ui.kpiFocus === 'connectedSources') ui.tab = 'sources';
      if (ui.kpiFocus === 'openQualityIssues' || ui.kpiFocus === 'qualityScore') ui.tab = 'quality';
      if (ui.kpiFocus === 'classifiedPct' || ui.kpiFocus === 'sensitive') ui.tab = 'classification';
      if (ui.kpiFocus === 'review' || ui.kpiFocus === 'assetsNeedingReview') {
        ui.tab = 'catalog';
        ui.filters.assetStatus = 'review';
      }
      ui.page = 1;
      return true;
    }

    if (action === 'dg-kpi-clear') {
      ui.kpiFocus = '';
      ui.filters.assetStatus = '';
      return true;
    }

    if (action === 'dg-page') {
      if (btn.dataset.dir === 'prev') ui.page -= 1;
      else ui.page += 1;
      return true;
    }

    if (action === 'dg-export-toggle') {
      ui.exportOpen = !ui.exportOpen;
      return true;
    }

    if (action === 'dg-export') {
      if (!can(user, 'export')) return toast('لا صلاحية'), true;
      const dg = dgData();
      if (btn.dataset.format === 'print') exportPrint(dg);
      else exportCsv(dg);
      ui.exportOpen = false;
      toast('تم التصدير');
      return true;
    }

    if (action === 'dg-modal') {
      ui.modal = btn.dataset.modal;
      ui.error = '';
      if (ui.modal === 'asset_wizard') {
        ui.wizardStep = 0;
        ui.wizardData = {};
      }
      if (ui.modal === 'source_edit') ui.sourceEditId = btn.dataset.id || '';
      if (ui.modal === 'policy_edit') ui.policyEditId = btn.dataset.id || '';
      if (ui.modal === 'approval_reject') ui.approvalCommentId = btn.dataset.id || '';
      return true;
    }

    if (action === 'dg-modal-close') {
      ui.modal = null;
      ui.error = '';
      ui.wizardStep = 0;
      return true;
    }

    if (action === 'dg-drawer') {
      ui.drawer = btn.dataset.id;
      ui.drawerTab = 'overview';
      return true;
    }

    if (action === 'dg-drawer-close') {
      ui.drawer = null;
      return true;
    }

    if (action === 'dg-drawer-tab') {
      ui.drawerTab = btn.dataset.tab || 'overview';
      return true;
    }

    if (action === 'dg-action-item') {
      ui.tab = btn.dataset.tab || 'overview';
      const kind = btn.dataset.kind;
      if (kind === 'unclassified') {
        ui.tab = 'catalog';
        ui.kpiFocus = 'unclassified';
      } else if (kind === 'owner') {
        ui.tab = 'catalog';
        ui.filters.missing_owner = '1';
      } else if (kind === 'quality') {
        ui.tab = 'quality';
      } else if (kind === 'source') {
        ui.tab = 'sources';
        ui.drawer = null;
      } else if (kind === 'approval') {
        ui.tab = 'approvals';
      } else if (kind === 'policy') {
        ui.tab = 'policies';
      }
      if (btn.dataset.id && kind !== 'source' && kind !== 'approval' && kind !== 'policy') {
        ui.drawer = btn.dataset.id;
      }
      return true;
    }

    if (action === 'dg-lineage-node') {
      const name = btn.dataset.name || '';
      const dg = dgData();
      const found = activeAssets(dg).find((a) => a.name === name || a.sourceName === name);
      if (found) ui.drawer = found.id;
      else toast(`لم يُعثر على أصل: ${name}`);
      return true;
    }

    if (action === 'dg-wizard-prev') {
      collectWizardFromDom();
      ui.wizardStep = Math.max(0, (ui.wizardStep || 0) - 1);
      return true;
    }

    if (action === 'dg-wizard-next') {
      collectWizardFromDom();
      if (!validateWizardStep(ui.wizardStep)) return true;
      if (btn.dataset.mode === 'draft') {
        if (!can(user, 'create_asset') && !can(user, 'create_asset_draft')) return toast('لا صلاحية'), true;
        HS.addDataAsset(wizardPayload(true, false), act);
        toast('حُفظت المسودة');
        ui.modal = null;
        ui.wizardStep = 0;
        return true;
      }
      ui.wizardStep = Math.min(WIZARD_STEPS.length - 1, (ui.wizardStep || 0) + 1);
      return true;
    }

    if (action === 'dg-wizard-submit') {
      collectWizardFromDom();
      if (!validateWizardStep(0) || !validateWizardStep(2) || !validateWizardStep(3)) return true;
      if (!can(user, 'create_asset') && !can(user, 'create_asset_draft')) return toast('لا صلاحية'), true;
      const submit = can(user, 'create_asset');
      HS.addDataAsset(wizardPayload(false, submit), act);
      toast(submit ? 'أُرسل للاعتماد' : 'أُنشئ الأصل');
      ui.modal = null;
      ui.wizardStep = 0;
      return true;
    }

    if (action === 'dg-source-save') {
      if (!can(user, 'create_source') && !can(user, 'edit_source')) return toast('لا صلاحية'), true;
      const name = String(qVal('dg-src-name') || '').trim();
      if (!name) {
        ui.error = 'اسم المصدر مطلوب';
        return true;
      }
      const payload = {
        name,
        type: qVal('dg-src-type'),
        system: qVal('dg-src-system'),
        host: qVal('dg-src-host'),
        port: Number(qVal('dg-src-port') || 0),
        database: qVal('dg-src-db'),
        owner: qVal('dg-src-owner'),
      };
      const id = btn.dataset.id;
      if (id) {
        HS.updateDataSource(id, payload, act);
        toast('حُدّث المصدر');
      } else {
        HS.addDataSource(payload, act);
        toast('أُضيف المصدر');
      }
      ui.modal = null;
      return true;
    }

    if (action === 'dg-test-source') {
      if (!can(user, 'test_source')) return toast('لا صلاحية'), true;
      const r = HS.testDataSourceConnection(btn.dataset.id, act);
      toast(r ? `الحالة: ${sourceStatusLabel(r.status)}` : 'فشل');
      return true;
    }

    if (action === 'dg-scan-source') {
      if (!can(user, 'scan_source')) return toast('لا صلاحية'), true;
      const r = HS.scanDataSource(btn.dataset.id, act);
      if (r?.error) return toast(r.error), true;
      toast('اكتمل Scan — أُضيف أصل مكتشف');
      if (r?.asset?.id) ui.drawer = r.asset.id;
      ui.tab = 'catalog';
      return true;
    }

    if (action === 'dg-test-all-sources') {
      if (!can(user, 'test_source')) return toast('لا صلاحية'), true;
      activeSources(dgData()).forEach((s) => HS.testDataSourceConnection(s.id, act));
      toast('تم فحص المصادر');
      ui.tab = 'sources';
      return true;
    }

    if (action === 'dg-toggle-catalog') {
      if (!can(user, 'edit_asset')) return toast('لا صلاحية'), true;
      HS.toggleDataCatalog(btn.dataset.id);
      toast('تغيّرت حالة الأصل');
      return true;
    }

    if (action === 'dg-asset-patch') {
      if (!can(user, 'edit_asset')) return toast('لا صلاحية'), true;
      const patch = {
        owner: qVal('dg-d-owner') || undefined,
        steward: qVal('dg-d-steward') || undefined,
        classification: qVal('dg-d-class') || undefined,
        sensitivity: qVal('dg-d-sens') || undefined,
      };
      Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
      HS.updateDataAsset(btn.dataset.id, patch, act);
      toast('حُدّث الأصل');
      return true;
    }

    if (action === 'dg-asset-comment') {
      if (!can(user, 'edit_asset')) return toast('لا صلاحية'), true;
      const text = String(qVal('dg-d-comment') || '').trim();
      if (!text) return true;
      const a = assetById(dgData(), btn.dataset.id);
      if (!a) return true;
      if (!Array.isArray(a.comments)) a.comments = [];
      a.comments.unshift({ at: new Date().toISOString(), text, by: act });
      HS.updateDataAsset(btn.dataset.id, { comments: a.comments }, act);
      toast('أُضيف التعليق');
      return true;
    }

    if (action === 'dg-asset-attach') {
      if (!can(user, 'edit_asset')) return toast('لا صلاحية'), true;
      const name = String(qVal('dg-d-attach') || '').trim();
      if (!name) return true;
      const a = assetById(dgData(), btn.dataset.id);
      if (!a) return true;
      if (!Array.isArray(a.attachments)) a.attachments = [];
      a.attachments.unshift({ name, at: new Date().toISOString(), by: act });
      HS.updateDataAsset(btn.dataset.id, { attachments: a.attachments }, act);
      toast('أُرفق الملف');
      return true;
    }

    if (action === 'dg-import-preview') {
      ui.importRaw = qVal('dg-import-raw');
      ui.importPreview = parseImportLines(ui.importRaw);
      toast(`معاينة: ${ui.importPreview.length} سطر`);
      return true;
    }

    if (action === 'dg-import-run') {
      if (!can(user, 'import')) return toast('لا صلاحية'), true;
      ui.importRaw = qVal('dg-import-raw');
      const rows = ui.importPreview.length ? ui.importPreview : parseImportLines(ui.importRaw);
      if (!rows.length) {
        ui.error = 'لا بيانات للاستيراد';
        return true;
      }
      HS.importDataAssets(rows, act);
      toast(`استُورد ${rows.length} أصل`);
      ui.modal = null;
      ui.importPreview = [];
      ui.tab = 'catalog';
      return true;
    }

    if (action === 'dg-quality-save') {
      if (!can(user, 'quality')) return toast('لا صلاحية'), true;
      const name = String(qVal('dg-qr-name') || '').trim();
      if (!name) {
        ui.error = 'اسم القاعدة مطلوب';
        return true;
      }
      HS.addQualityRule(
        {
          name,
          assetId: qVal('dg-qr-asset'),
          field: qVal('dg-qr-field'),
          ruleType: qVal('dg-qr-type'),
          condition: qVal('dg-qr-cond'),
          severity: qVal('dg-qr-sev'),
        },
        act
      );
      toast('أُضيفت القاعدة');
      ui.modal = null;
      return true;
    }

    if (action === 'dg-run-quality') {
      if (!can(user, 'quality')) return toast('لا صلاحية'), true;
      HS.runQualityCheck(btn.dataset.id, act);
      toast('اكتمل فحص الجودة');
      return true;
    }

    if (action === 'dg-issue-status') {
      if (!can(user, 'quality')) return toast('لا صلاحية'), true;
      HS.updateQualityIssue(btn.dataset.id, { status: btn.dataset.status }, act);
      toast('حُدّثت المشكلة');
      return true;
    }

    if (action === 'dg-policy-save') {
      if (!can(user, 'policy_create') && !can(user, 'policy_edit')) return toast('لا صلاحية'), true;
      const name = String(qVal('dg-pol-name') || '').trim();
      if (!name) {
        ui.error = 'اسم السياسة مطلوب';
        return true;
      }
      const payload = {
        name,
        title: name,
        category: qVal('dg-pol-cat'),
        scope: qVal('dg-pol-scope'),
        appliesTo: qVal('dg-pol-scope'),
        reviewDate: qVal('dg-pol-review'),
        version: qVal('dg-pol-ver'),
      };
      const id = btn.dataset.id;
      if (id) {
        HS.updateDgPolicy(id, payload, act);
        toast('حُدّثت السياسة');
      } else {
        HS.addDgPolicy(payload, act);
        toast('أُنشئت السياسة');
      }
      ui.modal = null;
      return true;
    }

    if (action === 'dg-activate-policy') {
      if (!can(user, 'policy_activate')) return toast('لا صلاحية'), true;
      HS.activateDataPolicy(btn.dataset.id);
      toast('تفعيل السياسة');
      return true;
    }

    if (action === 'dg-approval') {
      if (!can(user, 'approve')) return toast('لا صلاحية'), true;
      HS.decideDgApproval(btn.dataset.id, btn.dataset.decision, '', act);
      toast('تم القرار');
      return true;
    }

    if (action === 'dg-approval-reject') {
      if (!can(user, 'approve')) return toast('لا صلاحية'), true;
      const comment = String(qVal('dg-apr-comment') || '').trim();
      const r = HS.decideDgApproval(btn.dataset.id, 'reject', comment, act);
      if (r?.error) {
        ui.error = r.error;
        return true;
      }
      toast('رُفض الطلب');
      ui.modal = null;
      return true;
    }

    if (action === 'dg-report') {
      if (!can(user, 'reports')) return toast('لا صلاحية'), true;
      const type = btn.dataset.type || 'executive';
      ui.report = { type, at: new Date().toISOString() };
      HS.pushDgAudit?.({
        user: act,
        action: 'إنشاء تقرير حوكمة',
        entityType: 'report',
        entityId: type,
        entityLabel: type,
        newValue: 'generated',
      });
      HS.save?.();
      ui.tab = 'reports';
      toast('جُهّز التقرير');
      return true;
    }

    if (action === 'dg-report-print') {
      if (!can(user, 'print')) return toast('لا صلاحية'), true;
      exportPrint(dgData());
      return true;
    }

    if (action === 'dg-settings-save') {
      if (!can(user, 'settings')) return toast('لا صلاحية'), true;
      HS.updateDgSettings(
        {
          requireApproval: !!qVal('dg-set-approval'),
          qualityThreshold: Number(qVal('dg-set-quality') || 80),
          scanSchedule: qVal('dg-set-scan'),
          notifyOnIssue: !!qVal('dg-set-notify'),
          defaultRetentionMonths: Number(qVal('dg-set-retention') || 24),
          allowEmployeeCatalogView: !!qVal('dg-set-catalog'),
        },
        act
      );
      toast('حُفظت الإعدادات');
      return true;
    }

    if (action === 'dg-confirm') {
      const kind = btn.dataset.kind;
      const id = btn.dataset.id;
      const messages = { archive_asset: 'أرشفة هذا الأصل؟ لن يظهر في الكتالوج التشغيلي.' };
      ui.confirm = { kind, id, message: messages[kind] || 'تأكيد العملية' };
      return true;
    }

    if (action === 'dg-confirm-cancel') {
      ui.confirm = null;
      return true;
    }

    if (action === 'dg-confirm-ok') {
      const kind = btn.dataset.kind;
      const id = btn.dataset.id;
      if (kind === 'archive_asset') {
        if (!can(user, 'archive_asset')) return toast('لا صلاحية'), true;
        HS.archiveDataAsset(id, act);
        toast('أُرشف الأصل');
        ui.drawer = null;
      }
      ui.confirm = null;
      return true;
    }

    return false;
  };

  const handleChange = (el) => {
    if (!el || !el.getAttribute) return false;
    const key = el.getAttribute('data-dg-change');
    if (!key) return false;
    const val = el.type === 'checkbox' ? el.checked : el.value;
    if (key === 'sort') ui.sort = val;
    else if (key in ui.filters || ui.filters[key] !== undefined) ui.filters[key] = val;
    else ui.filters[key] = val;
    ui.page = 1;
    return true;
  };

  /**
   * ملحق توثيقي — سلوك الوحدة (مرجع للمطورين)
   * - جميع أزرار التفاعل تستخدم data-action="dg-*"
   * - حقول الفلاتر تستخدم data-dg-change="assetQ|sourceQ|…"
   * - HubStore.recomputeDataGovernanceKpis يُستدعى عند dgData()
   * - معالجات الاعتماد: approve | changes | reject (تعليق إلزامي)
   * - مصادر: testDataSourceConnection + scanDataSource (يتطلب connected)
   * - استيراد: importDataAssets بعد معاينة parseImportLines
   * - RBAC: admin كامل؛ chief_engineer steward؛ auditor قراءة+تقارير؛ employee كتالوج+مسودة
   */
  const __dgModuleRef = {
    tabs: ['overview', 'catalog', 'sources', 'lineage', 'quality', 'classification', 'policies', 'approvals', 'reports', 'audit', 'settings'],
    wizardSteps: WIZARD_STEPS,
    drawerTabs: DRAWER_TABS.map((t) => t.id),
    kpis: ['qualityScore', 'classifiedPct', 'metadataCompletion', 'totalAssets', 'connectedSources', 'openQualityIssues', 'assetsNeedingReview', 'sensitiveCount'],
    classifications: CLASSIFICATIONS,
    assetStatuses: ASSET_STATUSES.map((s) => s.v),
  };
  void __dgModuleRef;

  window.HubDataGovernance = { render, handle, handleChange, ui };
})();
