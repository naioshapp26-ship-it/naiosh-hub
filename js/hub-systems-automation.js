/**
 * NAIOSH HUB 360 — وحدة أتمتة الأنظمة (vanilla IIFE)
 * تدفقات · جدولة · تشغيل · طابور · اتصالات · سجل
 * يعتمد على HubStore.systemsAutomation (schemaVersion 2)
 */
(() => {
  'use strict';

  const PAGE_SIZE = 10;
  const WIZARD_STEPS = [
    'اختر الوحدة',
    'متى تبدأ؟',
    'هل تريد شرط؟',
    'ماذا يفعل النظام؟',
    'معاينة المسار',
    'اختبار التدفق',
    'المراجعة والحفظ',
  ];
  const TABS = [
    { id: 'overview', label: 'نظرة عامة', icon: 'fa-gauge' },
    { id: 'list', label: 'قائمة الأتمتة', icon: 'fa-list' },
    { id: 'create', label: 'إنشاء', icon: 'fa-plus' },
    { id: 'templates', label: 'القوالب', icon: 'fa-clone' },
    { id: 'executions', label: 'سجل التشغيل', icon: 'fa-play' },
    { id: 'connections', label: 'الاتصالات', icon: 'fa-plug' },
    { id: 'audit', label: 'سجل التدقيق', icon: 'fa-clock-rotate-left' },
    { id: 'settings', label: 'الإعدادات', icon: 'fa-gear' },
  ];
  const DRAWER_TABS = [
    { id: 'overview', label: 'نظرة عامة', icon: 'fa-gauge' },
    { id: 'workflow', label: 'المسار', icon: 'fa-diagram-project' },
    { id: 'executions', label: 'التشغيلات', icon: 'fa-play' },
    { id: 'config', label: 'الإعداد', icon: 'fa-sliders' },
    { id: 'history', label: 'السجل', icon: 'fa-clock-rotate-left' },
  ];
  const MODULES = [
    { id: 'sec', label: 'أمن المعلومات', icon: 'fa-shield-halved', systems: ['Security', 'Tasks'] },
    { id: 'dg', label: 'حوكمة البيانات', icon: 'fa-database', systems: ['Data Governance'] },
    { id: 'wf', label: 'القوى العاملة', icon: 'fa-users', systems: ['Workforce'] },
    { id: 'tasks', label: 'المهام', icon: 'fa-list-check', systems: ['Tasks'] },
    { id: 'rep', label: 'التقارير', icon: 'fa-chart-line', systems: ['Reports'] },
    { id: 'ads', label: 'الإعلانات', icon: 'fa-bullhorn', systems: ['Ads'] },
    { id: 'gov', label: 'الحوكمة', icon: 'fa-scale-balanced', systems: ['Governance'] },
    { id: 'ops', label: 'العمليات', icon: 'fa-gears', systems: ['ERP', 'LMS'] },
    { id: 'ext', label: 'نظام خارجي', icon: 'fa-cloud', systems: ['External'] },
  ];
  const TRIGGER_CHOICES = [
    { type: 'create_record', label: 'عند إنشاء سجل', hint: 'مثال: حادث أمني جديد' },
    { type: 'update_record', label: 'عند تحديث سجل', hint: 'مثال: تغيير حالة' },
    { type: 'status_change', label: 'عند تغيير الحالة', hint: 'مثال: انتهاء حملة' },
    { type: 'event', label: 'عند حدث نظام', hint: 'مثال: انخفاض إنتاجية' },
    { type: 'schedule', label: 'جدولة زمنية', hint: 'يومي / أسبوعي / شهري' },
    { type: 'approval', label: 'عند اعتماد', hint: 'قرار حوكمة معتمد' },
    { type: 'manual', label: 'تشغيل يدوي', hint: 'زر تشغيل الآن' },
    { type: 'webhook', label: 'Webhook / API', hint: 'استدعاء خارجي' },
  ];
  const CONDITION_OPS = ['يساوي', 'لا يساوي', 'يحتوي', 'أكبر من', 'أقل من', 'فارغ', 'غير فارغ'];
  const ACTION_CATALOG = [
    { type: 'create_task', label: 'إنشاء مهمة', desc: 'يفتح مهمة في وحدة المهام' },
    { type: 'assign_user', label: 'تعيين مستخدم', desc: 'تعيين مسؤول التنفيذ' },
    { type: 'send_notification', label: 'إرسال إشعار', desc: 'إشعار داخل المنصة أو بريد' },
    { type: 'update_status', label: 'تحديث الحالة', desc: 'تغيير حالة السجل المرتبط' },
    { type: 'create_report', label: 'إنشاء تقرير', desc: 'توليد تقرير جاهز' },
    { type: 'sync_data', label: 'مزامنة بيانات', desc: 'مزامنة بين نظامين' },
    { type: 'create_log', label: 'تسجيل في السجل', desc: 'إضافة سطر تدقيق' },
    { type: 'call_webhook', label: 'استدعاء Webhook', desc: 'POST لنقطة خارجية' },
    { type: 'archive_record', label: 'أرشفة سجل', desc: 'نقل للأرشيف' },
    { type: 'delay', label: 'انتظار', desc: 'تأخير قبل الخطوة التالية' },
  ];
  const AUTO_STATUSES = [
    { v: 'active', l: 'نشط' },
    { v: 'paused', l: 'متوقف مؤقتاً' },
    { v: 'draft', l: 'مسودة' },
    { v: 'error', l: 'خطأ' },
  ];
  const EXEC_STATUSES = ['Running', 'Success', 'Failed', 'Queued', 'Cancelled'];

  const ui = {
    tab: 'overview',
    modal: null,
    drawer: null,
    drawerTab: 'overview',
    wizardStep: 0,
    wizardData: {},
    confirm: null,
    helpOpen: false,
    page: 1,
    filters: {
      autoQ: '',
      module: '',
      status: '',
      triggerType: '',
      owner: '',
      system: '',
      sensitive: '',
      auditQ: '',
      connQ: '',
      execStatus: '',
      templateQ: '',
    },
    kpiFocus: '',
    execFilter: '',
    loading: false,
    error: '',
    advancedMode: false,
    editId: '',
    execDetailId: '',
    testResult: null,
    showQueuePanel: false,
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

  const qVal = (id) => {
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    return el ? (el.type === 'checkbox' ? el.checked : el.value) : '';
  };

  const store = () => window.HubStore;
  const autoData = () => {
    store()?.recomputeAutomationKpis?.();
    return (
      store()?.get?.()?.systemsAutomation || {
        schemaVersion: 2,
        automations: [],
        executions: [],
        queue: [],
        connections: [],
        templates: [],
        auditLog: [],
        settings: {},
        helpDismissed: false,
      }
    );
  };

  const actorName = (user) => user?.name || user?.email || user?.displayName || 'مشغّل هوب';

  const permLevel = (user) => {
    const role = String(user?.role || '').toLowerCase();
    if (['supreme_leader', 'admin'].includes(role)) return 'admin';
    if (['chief_engineer'].includes(role)) return 'manager';
    if (['auditor', 'audit'].includes(role)) return 'auditor';
    if (['employee', 'user'].includes(role)) return 'employee';
    return 'admin';
  };

  const can = (user, cap) => {
    const p = permLevel(user);
    const managerCaps = [
      'view',
      'list',
      'create',
      'edit',
      'run',
      'toggle',
      'duplicate',
      'test',
      'template_use',
      'connections_test',
      'queue_run',
      'settings',
      'audit_view',
      'executions',
      'retry',
    ];
    const auditorCaps = ['view', 'list', 'audit_view', 'executions', 'export'];
    const employeeCaps = ['view', 'list', 'executions'];
    if (cap === 'view' || cap === 'list') return true;
    if (p === 'admin') return true;
    if (p === 'manager') return managerCaps.includes(cap);
    if (p === 'auditor') return auditorCaps.includes(cap);
    if (p === 'employee') return employeeCaps.includes(cap);
    return false;
  };

  const statusLabel = (st) => AUTO_STATUSES.find((x) => x.v === st)?.l || st || '—';

  const badgeClass = (kind, value) => {
    const v = String(value || '');
    const maps = {
      status: { active: 'badge-black', paused: 'badge-gray', draft: 'badge-outline', error: 'badge-red' },
      exec: { Success: 'badge-black', Failed: 'badge-red', Running: 'badge-gray', Queued: 'badge-outline', Cancelled: 'badge-outline' },
      conn: { Connected: 'badge-black', Error: 'badge-red', Disconnected: 'badge-outline' },
    };
    return (maps[kind] || {})[v] || 'badge-outline';
  };

  const badge = (text, kind = 'status') =>
    `<span class="badge ${badgeClass(kind, text)}">${esc(kind === 'status' ? statusLabel(text) : text)}</span>`;

  const execBadge = (st) => `<span class="badge ${badgeClass('exec', st)}">${esc(st)}</span>`;

  const connBadge = (st) => `<span class="badge ${badgeClass('conn', st)}">${esc(st)}</span>`;

  const activeAutos = (sa) => (sa.automations || sa.flows || []).filter((a) => !a.archived);

  const filterAutos = (sa) => {
    const f = ui.filters;
    return activeAutos(sa).filter((a) => {
      if (ui.kpiFocus === 'activeFlows' && a.status !== 'active') return false;
      if (ui.kpiFocus === 'pausedFlows' && a.status !== 'paused') return false;
      if (ui.kpiFocus === 'totalAutomations') return true;
      if (ui.kpiFocus === 'failedExecutions' && !(a.failedRuns > 0)) return false;
      if (f.module && a.module !== f.module) return false;
      if (f.status && a.status !== f.status) return false;
      if (f.triggerType && a.triggerType !== f.triggerType) return false;
      if (f.owner && a.owner !== f.owner) return false;
      if (f.system && !(a.systems || []).includes(f.system) && a.system !== f.system) return false;
      if (f.sensitive === '1' && !a.sensitive) return false;
      if (f.autoQ) {
        const hay = `${a.id} ${a.name} ${a.module} ${a.triggerLabel} ${(a.systems || []).join(' ')}`.toLowerCase();
        if (!hay.includes(f.autoQ.toLowerCase())) return false;
      }
      return true;
    });
  };

  const sortAutos = (list) => {
    const arr = [...list];
    arr.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    return arr;
  };

  const paginate = (arr) => {
    const total = arr.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (ui.page > pages) ui.page = pages;
    if (ui.page < 1) ui.page = 1;
    const start = (ui.page - 1) * PAGE_SIZE;
    return { rows: arr.slice(start, start + PAGE_SIZE), total, pages };
  };

  const findAuto = (sa, id) => activeAutos(sa).find((x) => x.id === id) || null;

  const actionNeeded = (sa) => {
    const items = [];
    activeAutos(sa)
      .filter((a) => a.status === 'error')
      .forEach((a) => items.push({ kind: 'error', id: a.id, text: `أتمتة بحالة خطأ: ${a.name}`, tab: 'list' }));
    (sa.connections || [])
      .filter((c) => c.status === 'Error')
      .forEach((c) => items.push({ kind: 'conn', id: c.id, text: `اتصال معطل: ${c.system}`, tab: 'connections' }));
    (sa.queue || [])
      .filter((q) => q.status === 'queued')
      .slice(0, 3)
      .forEach((q) => items.push({ kind: 'queue', id: q.id, text: `في الطابور: ${q.name}`, tab: 'overview' }));
    (sa.executions || [])
      .filter((e) => e.status === 'Failed')
      .slice(0, 3)
      .forEach((e) => items.push({ kind: 'exec', id: e.id, text: `تشغيل فاشل: ${e.automationName}`, tab: 'executions' }));
    activeAutos(sa)
      .filter((a) => a.status === 'draft')
      .slice(0, 2)
      .forEach((a) => items.push({ kind: 'draft', id: a.id, text: `مسودة بانتظار التفعيل: ${a.name}`, tab: 'list' }));
    return items.slice(0, 12);
  };

  const renderHelpCard = (sa, user) => {
    if (sa.helpDismissed && !ui.helpOpen) return '';
    return `<article class="card" style="margin-top:12px;border-right:4px solid var(--primary,#d70000)">
      <h3><span class="title-left"><i class="fas fa-circle-question icon"></i> دليل الاستخدام السريع</span>
        ${can(user, 'create') ? `<button type="button" class="btn btn-sm btn-ghost" data-action="auto-help-dismiss">إخفاء</button>` : ''}
      </h3>
      <p>الأتمتة = <strong>محفّز</strong> (متى تبدأ) ← <strong>شرط</strong> (اختياري) ← <strong>إجراء</strong> (ماذا يفعل النظام).</p>
      <p class="empty" style="text-align:right">مثال: عند تسجيل <em>حادث حرج</em> (محفّز) إذا <em>الخطورة = حرج</em> (شرط) → <em>إنشاء مهمة + إشعار</em> (إجراء).</p>
      <div class="toolbar">
        ${can(user, 'create') ? `<button type="button" class="btn btn-primary" data-action="auto-help-first">إنشاء أول أتمتة</button>` : ''}
        <button type="button" class="btn btn-dark" data-action="auto-help-example">شاهد مثالاً</button>
        <button type="button" class="btn btn-ghost" data-action="auto-help-close">إغلاق</button>
      </div>
    </article>`;
  };

  const renderKpis = (sa) => {
    const kpis = [
      { key: 'totalAutomations', label: 'إجمالي الأتمتة', value: sa.totalAutomations ?? 0, tab: 'list' },
      { key: 'activeFlows', label: 'تدفقات نشطة', value: sa.activeFlows ?? 0, tab: 'list', filter: { status: 'active' } },
      { key: 'pausedFlows', label: 'متوقفة مؤقتاً', value: sa.pausedFlows ?? 0, tab: 'list', filter: { status: 'paused' } },
      { key: 'runningNow', label: 'تشغيل الآن', value: sa.runningNow ?? 0, tab: 'executions', filter: { execStatus: 'Running' } },
      { key: 'queuedCount', label: 'في الطابور', value: sa.queuedCount ?? 0, tab: 'overview', queue: true },
      { key: 'successRate', label: 'نسبة النجاح', value: `${sa.successRate ?? 0}%`, tab: 'executions' },
      { key: 'failedExecutions', label: 'تشغيلات فاشلة', value: sa.failedExecutions ?? 0, tab: 'executions', filter: { execStatus: 'Failed' } },
      { key: 'savedHours', label: 'ساعات موفّرة', value: sa.savedHours ?? 0, tab: 'overview' },
    ];
    return `<div class="kpi-grid">
      ${kpis
        .map(
          (k) => `<article class="kpi ${ui.kpiFocus === k.key ? 'is-focus' : ''}" data-action="auto-kpi-focus" data-kpi="${esc(k.key)}" data-tab="${esc(k.tab)}" role="button" tabindex="0">
        <span>${esc(k.label)}</span>
        <strong>${esc(String(k.value))}</strong>
        <small>انقر للتفصيل</small>
      </article>`
        )
        .join('')}
    </div>`;
  };

  const renderHeader = (sa, user) => `
    <header class="toolbar" style="flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center">
      <div>
        <h2 style="margin:0"><span class="title-left"><i class="fas fa-robot icon"></i> أتمتة الأنظمة</span></h2>
        <small>تدفقات · جدولة · تشغيل · طابور — schema v${esc(String(sa.schemaVersion || 2))}</small>
      </div>
      <div style="margin-right:auto;display:flex;flex-wrap:wrap;gap:6px">
        ${can(user, 'create') ? `<button type="button" class="btn btn-primary" data-action="auto-tab" data-tab="create"><i class="fas fa-plus icon"></i> إنشاء أتمتة</button>` : ''}
        ${can(user, 'create') ? `<button type="button" class="btn btn-dark" data-action="auto-modal" data-modal="wizard">معالج سريع</button>` : ''}
        <button type="button" class="btn btn-dark" data-action="auto-tab" data-tab="templates">القوالب</button>
        <button type="button" class="btn btn-ghost" data-action="auto-tab" data-tab="executions">سجل التشغيل</button>
        <button type="button" class="btn btn-ghost" data-action="auto-tab" data-tab="connections">الاتصالات</button>
        ${can(user, 'settings') ? `<button type="button" class="btn btn-ghost" data-action="auto-tab" data-tab="settings">الإعدادات</button>` : ''}
        <button type="button" class="btn btn-sm btn-ghost" data-action="auto-help-open">؟ دليل الاستخدام</button>
      </div>
    </header>`;

  const renderTabs = () =>
    `<div class="tabs" role="tablist">${TABS.map(
      (t) =>
        `<button type="button" class="tab ${ui.tab === t.id ? 'active' : ''}" data-action="auto-tab" data-tab="${esc(t.id)}" role="tab">
        <i class="fas ${esc(t.icon)} icon"></i> ${esc(t.label)}
      </button>`
    ).join('')}</div>`;

  const renderWorkflowBlocks = (auto) => {
    const cond = (auto.conditions || [])
      .map((c, i) => `${i ? esc(c.logic || 'AND') + ' ' : ''}${esc(c.field)} ${esc(c.op)} ${esc(c.value)}`)
      .join(' ');
    const acts = (auto.actions || []).map((a) => esc(a.label || a.type)).join(' → ') || '—';
    return `<div class="grid-2" style="gap:8px">
      <div class="card" style="padding:10px;background:#fafafa"><strong>محفّز</strong><p>${esc(auto.triggerLabel || auto.trigger || '—')}</p></div>
      <div class="card" style="padding:10px;background:#fafafa"><strong>شرط</strong><p>${cond || 'بدون شروط — ينفّذ دائماً'}</p></div>
      <div class="card" style="padding:10px;background:#fafafa;grid-column:1/-1"><strong>إجراءات</strong><p>${acts}</p></div>
    </div>`;
  };

  const renderQueueSection = (sa, user) => {
    const q = sa.queue || [];
    return `<article class="card" style="margin-top:12px">
      <h3><span class="title-left"><i class="fas fa-layer-group icon"></i> طابور التشغيل</span></h3>
      ${q.length ? `<div class="table-wrap"><table class="data">
        <thead><tr><th>المعرّف</th><th>الأتمتة</th><th>الأولوية</th><th>الحالة</th><th>السبب</th><th></th></tr></thead>
        <tbody>${q
          .map((item) => {
            const acts = [];
            if (can(user, 'queue_run') && item.status === 'queued')
              acts.push(`<button type="button" class="btn btn-sm btn-primary" data-action="auto-queue-run" data-id="${esc(item.id)}">تشغيل</button>`);
            if (can(user, 'edit'))
              acts.push(`<button type="button" class="btn btn-sm btn-ghost" data-action="auto-queue-cancel" data-id="${esc(item.id)}">إلغاء</button>`);
            return `<tr><td>${esc(item.id)}</td><td>${esc(item.name)}</td><td>${esc(item.priority)}</td><td>${badge(item.status === 'queued' ? 'paused' : 'active')}</td><td>${esc(item.reason)}</td><td>${acts.join(' ')}</td></tr>`;
          })
          .join('')}</tbody></table></div>` : '<p class="empty">الطابور فارغ.</p>'}
    </article>`;
  };

  const renderOverview = (sa, user) => {
    const needed = actionNeeded(sa);
    const recent = (sa.executions || []).slice(0, 5);
    const topAutos = sortAutos(activeAutos(sa)).slice(0, 5);
    return `
      ${ui.kpiFocus ? `<p class="empty" style="margin:8px 0">تركيز KPI — <button type="button" class="btn btn-sm btn-ghost" data-action="auto-kpi-clear">إزالة</button></p>` : ''}
      ${renderHelpCard(sa, user)}
      <div class="grid-2" style="margin-top:12px">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-bolt icon"></i> يحتاج انتباهك</span></h3>
          ${needed.length
            ? `<ul style="margin:0;padding-right:18px">${needed
                .map(
                  (a) => `<li style="margin:6px 0">${esc(a.text)}
                <button type="button" class="btn btn-sm btn-primary" data-action="auto-action-item" data-tab="${esc(a.tab)}" data-id="${esc(a.id)}" data-kind="${esc(a.kind)}">معالجة</button></li>`
                )
                .join('')}</ul>`
            : '<p class="empty">لا عناصر عاجلة — التدفقات مستقرة.</p>'}
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-chart-pie icon"></i> ملخص الأداء</span></h3>
          <p>نسبة النجاح: <strong>${sa.successRate ?? 0}%</strong></p>
          ${bar(sa.successRate || 0)}
          <p style="margin-top:10px">ساعات موفّرة تقديرياً: <strong>${sa.savedHours ?? 0}</strong></p>
          <p>تشغيل جاري: <strong>${sa.runningNow ?? 0}</strong> · في الطابور: <strong>${sa.queuedCount ?? 0}</strong></p>
        </article>
      </div>
      ${ui.showQueuePanel || ui.kpiFocus === 'queuedCount' ? renderQueueSection(sa, user) : ''}
      <div class="grid-2" style="margin-top:12px">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-play icon"></i> آخر التشغيلات</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>الأتمتة</th><th>الحالة</th><th>الوقت</th></tr></thead>
            <tbody>${recent
              .map(
                (e) => `<tr data-action="auto-exec-detail" data-id="${esc(e.id)}" style="cursor:pointer">
                <td>${esc(e.automationName)}</td><td>${execBadge(e.status)}</td><td>${fmtTime(e.startTime)}</td></tr>`
              )
              .join('') || '<tr><td colspan="3" class="empty">لا تشغيلات.</td></tr>'}</tbody>
          </table></div>
          <button type="button" class="btn btn-sm btn-ghost" data-action="auto-tab" data-tab="executions">عرض الكل</button>
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-diagram-project icon"></i> أتمتة نشطة</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>الاسم</th><th>المحفّز</th><th>النجاح</th></tr></thead>
            <tbody>${topAutos
              .map(
                (a) => `<tr data-action="auto-drawer" data-id="${esc(a.id)}" style="cursor:pointer">
                <td>${esc(a.name)}</td><td>${esc(a.triggerLabel)}</td><td>${a.successRate}%</td></tr>`
              )
              .join('') || '<tr><td colspan="3" class="empty">لا أتمتة.</td></tr>'}</tbody>
          </table></div>
        </article>
      </div>`;
  };

  const renderListToolbar = (sa) => {
    const owners = [...new Set(activeAutos(sa).map((a) => a.owner).filter(Boolean))];
    const systems = [...new Set(activeAutos(sa).flatMap((a) => a.systems || []))];
    return `<div class="toolbar" style="flex-wrap:wrap;gap:8px;margin-bottom:12px">
      <label class="field">بحث<input type="search" data-auto-change="autoQ" value="${esc(ui.filters.autoQ)}" placeholder="اسم / معرّف…" /></label>
      <label class="field">الوحدة<select data-auto-change="module"><option value="">الكل</option>${MODULES.map((m) => `<option value="${esc(m.label)}" ${ui.filters.module === m.label ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select></label>
      <label class="field">الحالة<select data-auto-change="status"><option value="">الكل</option>${AUTO_STATUSES.map((s) => `<option value="${esc(s.v)}" ${ui.filters.status === s.v ? 'selected' : ''}>${esc(s.l)}</option>`).join('')}</select></label>
      <label class="field">المحفّز<select data-auto-change="triggerType"><option value="">الكل</option>${TRIGGER_CHOICES.map((t) => `<option value="${esc(t.type)}" ${ui.filters.triggerType === t.type ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select></label>
      <label class="field">المالك<select data-auto-change="owner"><option value="">الكل</option>${owners.map((o) => `<option value="${esc(o)}" ${ui.filters.owner === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>
      ${ui.advancedMode ? `<label class="field">النظام<select data-auto-change="system"><option value="">الكل</option>${systems.map((s) => `<option value="${esc(s)}" ${ui.filters.system === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <label class="field">حساس<select data-auto-change="sensitive"><option value="">الكل</option><option value="1" ${ui.filters.sensitive === '1' ? 'selected' : ''}>حساس فقط</option></select></label>` : ''}
      <button type="button" class="btn btn-sm btn-ghost" data-action="auto-advanced-toggle">${ui.advancedMode ? 'فلاتر أبسط' : 'فلاتر متقدمة'}</button>
    </div>`;
  };

  const renderList = (sa, user) => {
    const filtered = sortAutos(filterAutos(sa));
    const { rows, total, pages } = paginate(filtered);
    return `${renderListToolbar(sa)}
      <div class="table-wrap"><table class="data">
        <thead><tr>
          <th>المعرّف</th><th>الاسم</th><th>الوحدة</th><th>المحفّز</th><th>الأنظمة</th><th>الحالة</th>
          <th>تشغيلات</th><th>نجاح</th><th>آخر تشغيل</th><th>التالي</th><th>المالك</th><th>أُنشئ بواسطة</th><th></th>
        </tr></thead>
        <tbody>${rows.length
          ? rows
              .map((a) => {
                const acts = [`<button type="button" class="btn btn-sm btn-ghost" data-action="auto-drawer" data-id="${esc(a.id)}">عرض</button>`];
                if (can(user, 'run')) acts.push(`<button type="button" class="btn btn-sm btn-primary" data-action="auto-run" data-id="${esc(a.id)}">تشغيل</button>`);
                if (can(user, 'edit')) acts.push(`<button type="button" class="btn btn-sm btn-dark" data-action="auto-edit" data-id="${esc(a.id)}">تعديل</button>`);
                if (can(user, 'toggle')) acts.push(`<button type="button" class="btn btn-sm btn-ghost" data-action="auto-toggle" data-id="${esc(a.id)}">تفعيل/إيقاف</button>`);
                if (can(user, 'duplicate')) acts.push(`<button type="button" class="btn btn-sm btn-ghost" data-action="auto-duplicate" data-id="${esc(a.id)}">نسخ</button>`);
                acts.push(`<button type="button" class="btn btn-sm btn-ghost" data-action="auto-exec-filter" data-automation-id="${esc(a.id)}">تشغيلات</button>`);
                if (can(user, 'edit')) acts.push(`<button type="button" class="btn btn-sm btn-ghost" data-action="auto-archive" data-id="${esc(a.id)}">أرشفة</button>`);
                return `<tr>
                  <td>${esc(a.id)}</td><td><strong>${esc(a.name)}</strong></td><td>${esc(a.module)}</td><td>${esc(a.triggerLabel)}</td>
                  <td>${esc((a.systems || []).join(' · ') || a.system || '—')}</td><td>${badge(a.status)}</td>
                  <td>${a.runs ?? 0}</td><td>${a.successRate ?? 0}% ${bar(a.successRate)}</td>
                  <td>${fmtTime(a.lastRun)}</td><td>${fmtTime(a.nextRun)}</td><td>${esc(a.owner)}</td><td>${esc(a.createdBy)}</td>
                  <td style="white-space:nowrap">${acts.join(' ')}</td></tr>`;
              })
              .join('')
          : `<tr><td colspan="13" class="empty">لا أتمتة مطابقة.${can(user, 'create') ? `<br/><button type="button" class="btn btn-primary" style="margin-top:10px" data-action="auto-tab" data-tab="create">إنشاء أول أتمتة</button>` : ''}</td></tr>`}
        </tbody></table></div>
      <div class="toolbar"><button type="button" class="btn btn-sm btn-ghost" data-action="auto-page" data-dir="prev" ${ui.page <= 1 ? 'disabled' : ''}>السابق</button>
        <span class="empty">صفحة ${ui.page} / ${pages} (${total})</span>
        <button type="button" class="btn btn-sm btn-ghost" data-action="auto-page" data-dir="next" ${ui.page >= pages ? 'disabled' : ''}>التالي</button></div>`;
  };

  const defaultWizard = () => ({
    module: '',
    moduleSystems: [],
    triggerType: '',
    triggerLabel: '',
    name: '',
    description: '',
    conditions: [],
    actions: [],
    schedule: null,
    errorHandling: 'stop',
    retryPolicy: { retries: 3, waitMinutes: 5, onFail: 'notify' },
    sensitive: false,
    owner: '',
    templateUsed: '',
  });

  const renderWizardStep = (step, user) => {
    const w = { ...defaultWizard(), ...(ui.wizardData || {}) };
    ui.wizardData = w;
    if (step === 0) {
      return `<p>اختر الوحدة التي تنتمي إليها الأتمتة:</p>
        <div class="kpi-grid">${MODULES.map(
          (m) =>
            `<article class="kpi ${w.module === m.label ? 'is-focus' : ''}" data-action="auto-module-pick" data-module="${esc(m.label)}" data-systems="${esc(m.systems.join(','))}" role="button" tabindex="0">
          <span><i class="fas ${esc(m.icon)} icon"></i> ${esc(m.label)}</span></article>`
        ).join('')}</div>`;
    }
    if (step === 1) {
      return `<p><strong>متى تبدأ</strong> الأتمتة؟</p>
        <div class="grid-2">${TRIGGER_CHOICES.map(
          (t) =>
            `<button type="button" class="card ${w.triggerType === t.type ? 'is-focus' : ''}" style="cursor:pointer;text-align:right;padding:12px" data-action="auto-trigger-pick" data-type="${esc(t.type)}" data-label="${esc(t.label)}">
          <strong>${esc(t.label)}</strong><br/><small>${esc(t.hint)}</small></button>`
        ).join('')}</div>
        ${w.triggerType === 'schedule' ? `<label class="field">وقت الجدولة<input id="auto-w-sched-time" value="${esc(w.schedule?.time || '08:00')}" /></label>
        <label class="field">التكرار<select id="auto-w-sched-every"><option value="يوم" ${w.schedule?.every === 'يوم' ? 'selected' : ''}>يوم</option><option value="أسبوع" ${w.schedule?.every === 'أسبوع' ? 'selected' : ''}>أسبوع</option><option value="شهر" ${w.schedule?.every === 'شهر' ? 'selected' : ''}>شهر</option></select></label>` : ''}
        <label class="field">اسم الأتمتة<input id="auto-w-name" value="${esc(w.name)}" placeholder="مثال: تنبيه حادث حرج" /></label>
        <label class="field">وصف<textarea id="auto-w-desc" rows="2">${esc(w.description)}</textarea></label>`;
    }
    if (step === 2) {
      const conds = w.conditions || [];
      return `<p><strong>هل تريد شرط</strong> قبل التنفيذ؟ (اختياري — بدون كود)</p>
        <div id="auto-conditions">${conds
          .map(
            (c, i) => `<div class="toolbar" style="align-items:flex-end" data-cond-idx="${i}">
          ${i > 0 ? `<label class="field">الربط<select data-auto-change="cond-logic-${i}"><option value="AND" ${(c.logic || 'AND') === 'AND' ? 'selected' : ''}>AND</option><option value="OR" ${c.logic === 'OR' ? 'selected' : ''}>OR</option></select></label>` : ''}
          <label class="field">الحقل<input data-auto-change="cond-field-${i}" value="${esc(c.field)}" placeholder="مثال: مستوى الخطورة" /></label>
          <label class="field">العملية<select data-auto-change="cond-op-${i}">${CONDITION_OPS.map((o) => `<option ${c.op === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>
          <label class="field">القيمة<input data-auto-change="cond-val-${i}" value="${esc(c.value)}" /></label>
          <button type="button" class="btn btn-sm btn-ghost" data-action="auto-condition-remove" data-idx="${i}">حذف</button></div>`
          )
          .join('')}</div>
        <button type="button" class="btn btn-sm btn-dark" data-action="auto-condition-add">+ إضافة شرط</button>`;
    }
    if (step === 3) {
      const acts = w.actions || [];
      return `<p><strong>ماذا يفعل النظام؟</strong> اختر الإجراءات ورتّبها.</p>
        <div class="grid-2">${ACTION_CATALOG.map(
          (a) =>
            `<button type="button" class="btn btn-ghost" style="text-align:right;height:auto;padding:10px" data-action="auto-action-add" data-type="${esc(a.type)}" data-label="${esc(a.label)}">
          <strong>${esc(a.label)}</strong><br/><small>${esc(a.desc)}</small></button>`
        ).join('')}</div>
        <h4>ترتيب الإجراءات</h4>
        <ol>${acts
          .map(
            (a, i) =>
              `<li style="margin:6px 0">${esc(a.label)}
            <button type="button" class="btn btn-sm btn-ghost" data-action="auto-action-up" data-idx="${i}">↑</button>
            <button type="button" class="btn btn-sm btn-ghost" data-action="auto-action-down" data-idx="${i}">↓</button>
            <button type="button" class="btn btn-sm btn-ghost" data-action="auto-action-remove" data-idx="${i}">✕</button></li>`
          )
          .join('') || '<li class="empty">لم تُضف إجراءات بعد.</li>'}</ol>`;
    }
    if (step === 4) return renderWorkflowBlocks(w);
    if (step === 5) {
      const tr = ui.testResult;
      return `<p>اختبار التكوين دون تفعيل (HubStore.testAutomation):</p>
        <button type="button" class="btn btn-dark" data-action="auto-wizard-test">${can(user, 'test') ? 'تشغيل الاختبار' : 'لا صلاحية'}</button>
        ${tr ? `<ul>${(tr.steps || []).map((s) => `<li>${s.ok ? '✓' : '✗'} ${esc(s.name)} — ${esc(s.detail)}</li>`).join('')}</ul><p>${esc(tr.message || '')}</p>` : ''}`;
    }
    if (step === 6) {
      return `<div class="report-body">
        ${renderWorkflowBlocks(w)}
        <p>المالك: <input id="auto-w-owner" value="${esc(w.owner)}" /></p>
        <label class="field"><input type="checkbox" id="auto-w-sensitive" ${w.sensitive ? 'checked' : ''} /> أتمتة حساسة</label>
        <label class="field">معالجة الخطأ<select id="auto-w-err"><option value="stop" ${w.errorHandling === 'stop' ? 'selected' : ''}>إيقاف</option><option value="continue" ${w.errorHandling === 'continue' ? 'selected' : ''}>متابعة</option></select></label>
      </div>`;
    }
    return '';
  };

  const renderCreate = (user) => {
    const step = ui.wizardStep;
    return `<article class="card">
      <h3><span class="title-left"><i class="fas fa-wand-magic-sparkles icon"></i> معالج إنشاء أتمتة — ${esc(WIZARD_STEPS[step] || '')}</span></h3>
      <div class="toolbar">${WIZARD_STEPS.map((s, i) => `<span class="badge ${i === step ? 'badge-black' : 'badge-outline'}">${i + 1}. ${esc(s)}</span>`).join(' ')}</div>
      ${ui.error ? `<p class="badge badge-red">${esc(ui.error)}</p>` : ''}
      ${renderWizardStep(step, user)}
      <div class="toolbar" style="margin-top:12px">
        <button type="button" class="btn btn-ghost" data-action="auto-wizard-prev" ${step <= 0 ? 'disabled' : ''}>السابق</button>
        ${step < WIZARD_STEPS.length - 1 ? `<button type="button" class="btn btn-primary" data-action="auto-wizard-next">التالي</button>` : ''}
        ${step === WIZARD_STEPS.length - 1 && can(user, 'create') ? `
          <button type="button" class="btn btn-dark" data-action="auto-wizard-save" data-mode="draft">حفظ مسودة</button>
          <button type="button" class="btn btn-dark" data-action="auto-wizard-save" data-mode="test">اختبار</button>
          <button type="button" class="btn btn-primary" data-action="auto-wizard-save" data-mode="activate">تفعيل</button>` : ''}
      </div>
    </article>`;
  };

  const renderTemplates = (sa, user) => {
    const q = ui.filters.templateQ;
    const tpls = (sa.templates || []).filter((t) => {
      if (!q) return true;
      const hay = `${t.name} ${t.module} ${t.category}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
    return `<label class="field">بحث في القوالب<input type="search" data-auto-change="templateQ" value="${esc(q)}" /></label>
      <div class="grid-2" style="margin-top:12px">${tpls
        .map(
          (t) =>
            `<article class="card"><h4>${esc(t.name)}</h4><p>${esc(t.module)} · ${esc(t.triggerLabel)}</p>
          ${renderWorkflowBlocks(t)}
          ${can(user, 'template_use') ? `<button type="button" class="btn btn-primary" data-action="auto-use-template" data-id="${esc(t.id)}">استخدام القالب</button>` : ''}
        </article>`
        )
        .join('') || '<p class="empty">لا قوالب.</p>'}</div>`;
  };

  const renderExecutions = (sa, user) => {
    let execs = [...(sa.executions || [])];
    const f = ui.filters.execStatus || ui.execFilter;
    if (f) execs = execs.filter((e) => e.status === f);
    if (ui.filters.autoQ) {
      const q = ui.filters.autoQ.toLowerCase();
      execs = execs.filter((e) => `${e.automationName} ${e.id}`.toLowerCase().includes(q));
    }
    return `<div class="toolbar" style="flex-wrap:wrap;gap:8px">
      <label class="field">الحالة<select data-auto-change="execStatus"><option value="">الكل</option>${EXEC_STATUSES.map((s) => `<option value="${esc(s)}" ${ui.filters.execStatus === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <label class="field">بحث<input type="search" data-auto-change="autoQ" value="${esc(ui.filters.autoQ)}" /></label>
    </div>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>المعرّف</th><th>الأتمتة</th><th>المحفّز</th><th>بواسطة</th><th>البداية</th><th>المدة</th><th>الحالة</th><th></th></tr></thead>
      <tbody>${execs.length
        ? execs
            .slice(0, 50)
            .map((e) => {
              const acts = [`<button type="button" class="btn btn-sm btn-ghost" data-action="auto-exec-detail" data-id="${esc(e.id)}">تفاصيل</button>`];
              if (e.status === 'Failed' && can(user, 'retry'))
                acts.push(`<button type="button" class="btn btn-sm btn-primary" data-action="auto-retry-exec" data-id="${esc(e.id)}">إعادة</button>`);
              return `<tr><td>${esc(e.id)}</td><td>${esc(e.automationName)}</td><td>${esc(e.trigger)}</td><td>${esc(e.triggeredBy)}</td>
                <td>${fmtTime(e.startTime)}</td><td>${e.durationSec ?? '—'}ث</td><td>${execBadge(e.status)}</td><td>${acts.join(' ')}</td></tr>`;
            })
            .join('')
        : '<tr><td colspan="8" class="empty">لا سجل تشغيل.</td></tr>'}</tbody></table></div>`;
  };

  const renderConnections = (sa, user) => {
    const q = ui.filters.connQ;
    const list = (sa.connections || []).filter((c) => !q || `${c.system} ${c.type}`.toLowerCase().includes(q.toLowerCase()));
    return `<label class="field">بحث<input type="search" data-auto-change="connQ" value="${esc(q)}" /></label>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>المعرّف</th><th>النظام</th><th>النوع</th><th>الحالة</th><th>آخر فحص</th><th>المالك</th><th></th></tr></thead>
        <tbody>${list
          .map((c) => {
            const btn = can(user, 'connections_test')
              ? `<button type="button" class="btn btn-sm btn-dark" data-action="auto-test-connection" data-id="${esc(c.id)}">اختبار الاتصال</button>`
              : '';
            return `<tr><td>${esc(c.id)}</td><td>${esc(c.system)}</td><td>${esc(c.type)}</td><td>${connBadge(c.status)}</td>
              <td>${fmtTime(c.lastChecked)}</td><td>${esc(c.owner)}</td><td>${btn}${c.lastError ? `<small> ${esc(c.lastError)}</small>` : ''}</td></tr>`;
          })
          .join('') || '<tr><td colspan="7" class="empty">لا اتصالات.</td></tr>'}</tbody></table></div>`;
  };

  const renderAudit = (sa, user) => {
    if (!can(user, 'audit_view')) return '<p class="empty">لا صلاحية لعرض سجل التدقيق.</p>';
    const q = ui.filters.auditQ;
    const logs = (sa.auditLog || []).filter((r) => {
      if (!q) return true;
      const hay = `${r.action} ${r.user} ${r.automationName} ${r.newValue}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
    return `<label class="field">بحث في السجل<input type="search" data-auto-change="auditQ" value="${esc(q)}" placeholder="إجراء / مستخدم / أتمتة…" /></label>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>الوقت</th><th>المستخدم</th><th>الإجراء</th><th>الأتمتة</th><th>قبل</th><th>بعد</th></tr></thead>
        <tbody>${logs
          .slice(0, 100)
          .map(
            (r) =>
              `<tr><td>${fmtTime(r.at)}</td><td>${esc(r.user)}</td><td>${esc(r.action)}</td><td>${esc(r.automationName || r.automationId)}</td><td>${esc(r.oldValue)}</td><td>${esc(r.newValue)}</td></tr>`
          )
          .join('') || '<tr><td colspan="6" class="empty">السجل فارغ.</td></tr>'}</tbody></table></div>`;
  };

  const renderSettings = (sa, user) => {
    if (!can(user, 'settings')) return '<p class="empty">لا صلاحية لتعديل الإعدادات.</p>';
    const s = sa.settings || {};
    return `<form class="grid-2" onsubmit="return false">
      <label class="field">المنطقة الزمنية<input id="auto-set-tz" value="${esc(s.timezone || 'Asia/Riyadh')}" /></label>
      <label class="field">محاولات إعادة افتراضية<input id="auto-set-retries" type="number" value="${esc(String(s.defaultRetries ?? 3))}" /></label>
      <label class="field">حد الطابور<input id="auto-set-queue" type="number" value="${esc(String(s.queueMax ?? 50))}" /></label>
      <label class="field">احتفاظ سجل التشغيل (أيام)<input id="auto-set-retain" type="number" value="${esc(String(s.retainExecDays ?? 90))}" /></label>
      <label class="field"><input type="checkbox" id="auto-set-notify" ${s.notifyOnFail !== false ? 'checked' : ''} /> إشعار عند الفشل</label>
      <label class="field"><input type="checkbox" id="auto-set-confirm" ${s.requireConfirmSensitive !== false ? 'checked' : ''} /> تأكيد للأتمتة الحساسة</label>
      <button type="button" class="btn btn-primary" data-action="auto-settings-save">حفظ الإعدادات</button>
    </form>`;
  };

  const renderTabBody = (sa, user) => {
    switch (ui.tab) {
      case 'list':
        return renderList(sa, user);
      case 'create':
        return can(user, 'create') ? renderCreate(user) : '<p class="empty">لا صلاحية للإنشاء.</p>';
      case 'templates':
        return renderTemplates(sa, user);
      case 'executions':
        return renderExecutions(sa, user);
      case 'connections':
        return renderConnections(sa, user);
      case 'audit':
        return renderAudit(sa, user);
      case 'settings':
        return renderSettings(sa, user);
      default:
        return renderOverview(sa, user);
    }
  };

  const renderDrawerBody = (sa, auto, user) => {
    switch (ui.drawerTab) {
      case 'workflow':
        return renderWorkflowBlocks(auto);
      case 'executions': {
        const ex = (sa.executions || []).filter((e) => e.automationId === auto.id).slice(0, 20);
        return `<div class="table-wrap"><table class="data"><thead><tr><th>الوقت</th><th>الحالة</th><th></th></tr></thead><tbody>${ex
          .map(
            (e) =>
              `<tr><td>${fmtTime(e.startTime)}</td><td>${execBadge(e.status)}</td>
            <td><button type="button" class="btn btn-sm btn-ghost" data-action="auto-exec-detail" data-id="${esc(e.id)}">تفاصيل</button></td></tr>`
          )
          .join('') || '<tr><td colspan="3" class="empty">لا تشغيلات.</td></tr>'}</tbody></table></div>`;
      }
      case 'config':
        return `<div class="report-body">
          <p>معالجة الخطأ: ${esc(auto.errorHandling)}</p>
          <p>إعادة المحاولة: ${esc(JSON.stringify(auto.retryPolicy || {}))}</p>
          <p>جدولة: ${esc(JSON.stringify(auto.schedule || {}))}</p>
          <p>حساس: ${auto.sensitive ? 'نعم' : 'لا'}</p>
        </div>`;
      case 'history': {
        const logs = (sa.auditLog || []).filter((r) => r.automationId === auto.id).slice(0, 30);
        return `<ul>${logs.map((r) => `<li>${fmtTime(r.at)} — ${esc(r.action)} (${esc(r.user)})</li>`).join('') || '<li class="empty">لا سجل.</li>'}</ul>`;
      }
      default:
        return `<div class="report-body">
          <p>${esc(auto.description || '—')}</p>
          <p>المصدر: ${esc(auto.sourceModule || auto.module)} · المالك: ${esc(auto.owner)} · أُنشئ: ${esc(auto.createdBy)} (${fmtDate(auto.createdAt)})</p>
          <p>طريقة الإنشاء: ${esc(auto.creationMethod)} ${auto.templateUsed ? `· قالب: ${esc(auto.templateUsed)}` : ''}</p>
          <p>تشغيلات: ${auto.runs} · نجاح: ${auto.successRate}%</p>
          ${can(user, 'run') ? `<button type="button" class="btn btn-primary" data-action="auto-run-confirm" data-id="${esc(auto.id)}">تشغيل الآن</button>` : ''}
        </div>`;
    }
  };

  const renderDrawer = (sa, user) => {
    if (!ui.drawer) return '';
    const auto = findAuto(sa, ui.drawer);
    if (!auto) return '';
    const tabs = DRAWER_TABS.map(
      (t) =>
        `<button type="button" class="btn btn-sm ${ui.drawerTab === t.id ? 'btn-primary' : 'btn-ghost'}" data-action="auto-drawer-tab" data-tab="${esc(t.id)}"><i class="fas ${esc(t.icon)} icon"></i> ${esc(t.label)}</button>`
    ).join('');
    return `<aside class="card" data-auto-drawer style="position:fixed;left:0;top:0;bottom:0;width:min(480px,95vw);z-index:9000;overflow:auto;padding:16px;box-shadow:0 0 24px rgba(0,0,0,.2)">
      <div class="toolbar"><strong>${esc(auto.name)}</strong><span>${badge(auto.status)}</span>
        <button type="button" class="btn btn-sm btn-ghost" data-action="auto-drawer-close">✕</button></div>
      <div class="toolbar" style="flex-wrap:wrap">${tabs}</div>
      ${renderDrawerBody(sa, auto, user)}
    </aside>`;
  };

  const renderExecTimeline = (ex) =>
    `<ol>${(ex.steps || [])
      .map(
        (s) =>
          `<li style="margin:8px 0">${s.ok ? '✓' : '✗'} <strong>${esc(s.name)}</strong> — ${esc(s.detail || '')} <small>${fmtTime(s.at)}</small></li>`
      )
      .join('') || '<li class="empty">لا خطوات.</li>'}</ol>`;

  const renderModal = (sa, user) => {
    if (!ui.modal) return '';
    if (ui.modal === 'exec' && ui.execDetailId) {
      const ex = (sa.executions || []).find((x) => x.id === ui.execDetailId);
      if (!ex) return '';
      return `<div data-auto-modal-backdrop style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9100;display:flex;align-items:center;justify-content:center;padding:16px">
        <article class="card" style="max-width:560px;width:100%;max-height:90vh;overflow:auto">
          <h3>تفاصيل التشغيل ${esc(ex.id)}</h3>
          <p>${esc(ex.automationName)} · ${execBadge(ex.status)}</p>
          ${ex.error ? `<p class="badge badge-red">${esc(ex.error)}</p>` : ''}
          ${renderExecTimeline(ex)}
          ${ex.status === 'Failed' && can(user, 'retry') ? `<button type="button" class="btn btn-primary" data-action="auto-retry-exec" data-id="${esc(ex.id)}">إعادة المحاولة</button>` : ''}
          <button type="button" class="btn btn-ghost" data-action="auto-modal-close">إغلاق</button>
        </article></div>`;
    }
    if (ui.modal === 'wizard' && can(user, 'create')) {
      return `<div data-auto-modal-backdrop style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9100;display:flex;align-items:center;justify-content:center;padding:16px">
        <article class="card" style="max-width:720px;width:100%;max-height:90vh;overflow:auto">${renderCreate(user)}
          <button type="button" class="btn btn-ghost" data-action="auto-modal-close">إغلاق</button>
        </article></div>`;
    }
    if (ui.modal === 'example') {
      const sample = (sa.automations || [])[0] || (sa.templates || [])[0];
      return `<div data-auto-modal-backdrop style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9100;display:flex;align-items:center;justify-content:center;padding:16px">
        <article class="card" style="max-width:560px;width:100%"><h3>مثال تدفق</h3>${sample ? renderWorkflowBlocks(sample) : '<p class="empty">لا مثال.</p>'}
          <button type="button" class="btn btn-ghost" data-action="auto-modal-close">إغلاق</button></article></div>`;
    }
    return '';
  };

  const renderConfirm = () => {
    const c = ui.confirm;
    if (!c) return '';
    return `<div data-auto-modal-backdrop style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9200;display:flex;align-items:center;justify-content:center">
      <article class="card"><p>${esc(c.message || 'تأكيد؟')}</p>
        <div class="toolbar"><button type="button" class="btn btn-ghost" data-action="auto-confirm-cancel">إلغاء</button>
        <button type="button" class="btn btn-primary" data-action="auto-confirm-ok" data-kind="${esc(c.kind)}" data-id="${esc(c.id)}">تأكيد</button></div>
      </article></div>`;
  };

  const collectWizardFromDom = () => {
    const w = { ...defaultWizard(), ...(ui.wizardData || {}) };
    w.name = qVal('auto-w-name') || w.name;
    w.description = qVal('auto-w-desc') || w.description;
    w.owner = qVal('auto-w-owner') || w.owner;
    w.sensitive = !!document.getElementById('auto-w-sensitive')?.checked;
    w.errorHandling = qVal('auto-w-err') || w.errorHandling;
    if (w.triggerType === 'schedule') {
      w.schedule = { time: qVal('auto-w-sched-time') || '08:00', every: qVal('auto-w-sched-every') || 'يوم' };
      w.triggerLabel = `جدولة ${w.schedule.time}`;
    }
    const conds = w.conditions || [];
    conds.forEach((c, i) => {
      const f = document.querySelector(`[data-auto-change="cond-field-${i}"]`);
      const o = document.querySelector(`[data-auto-change="cond-op-${i}"]`);
      const v = document.querySelector(`[data-auto-change="cond-val-${i}"]`);
      const l = document.querySelector(`[data-auto-change="cond-logic-${i}"]`);
      if (f) c.field = f.value;
      if (o) c.op = o.value;
      if (v) c.value = v.value;
      if (l) c.logic = l.value;
    });
    w.conditions = conds;
    ui.wizardData = w;
  };

  const wizardPayload = (mode) => {
    collectWizardFromDom();
    const w = ui.wizardData || {};
    return {
      name: w.name || 'أتمتة جديدة',
      description: w.description || '',
      module: w.module || 'العمليات',
      triggerType: w.triggerType || 'manual',
      triggerLabel: w.triggerLabel || 'تشغيل يدوي',
      conditions: w.conditions || [],
      actions: w.actions || [],
      systems: w.moduleSystems?.length ? w.moduleSystems : w.systems || [],
      schedule: w.schedule,
      errorHandling: w.errorHandling,
      retryPolicy: w.retryPolicy,
      sensitive: w.sensitive,
      owner: w.owner || '',
      templateUsed: w.templateUsed || '',
      creationMethod: w.templateUsed ? 'Template' : 'إنشاء يدوي',
      sourceModule: w.module,
      draft: mode === 'draft',
      activate: mode === 'activate',
    };
  };

  const loadAutoToWizard = (auto) => {
    ui.wizardData = {
      module: auto.module,
      moduleSystems: auto.systems || [],
      triggerType: auto.triggerType,
      triggerLabel: auto.triggerLabel,
      name: auto.name,
      description: auto.description,
      conditions: JSON.parse(JSON.stringify(auto.conditions || [])),
      actions: JSON.parse(JSON.stringify(auto.actions || [])),
      schedule: auto.schedule,
      errorHandling: auto.errorHandling,
      retryPolicy: auto.retryPolicy,
      sensitive: auto.sensitive,
      owner: auto.owner,
      templateUsed: auto.templateUsed,
    };
    ui.wizardStep = 0;
    ui.editId = auto.id;
  };

  const applyTemplate = (sa, tplId) => {
    const t = (sa.templates || []).find((x) => x.id === tplId);
    if (!t) return;
    ui.wizardData = {
      ...defaultWizard(),
      module: t.module,
      moduleSystems: t.systems || [],
      triggerType: t.triggerType,
      triggerLabel: t.triggerLabel,
      name: t.name,
      description: `من قالب ${t.id}`,
      conditions: JSON.parse(JSON.stringify(t.conditions || [])),
      actions: JSON.parse(JSON.stringify(t.actions || [])),
      schedule: t.schedule ? { ...t.schedule } : null,
      templateUsed: t.id,
    };
    ui.wizardStep = 1;
    ui.tab = 'create';
  };

  const handle = (action, btn, ctx = {}) => {
    if (!action || !String(action).startsWith('auto-')) return false;
    const user = ctx.user || {};
    const toast = ctx.toast || (() => {});
    const act = actorName(user);
    const HS = store();
    if (!HS) {
      ui.error = 'HubStore غير متاح';
      return true;
    }
    ui.error = '';
    const sa = autoData();

    if (action === 'auto-tab') {
      ui.tab = btn.dataset.tab || 'overview';
      ui.page = 1;
      return true;
    }

    if (action === 'auto-kpi-focus') {
      ui.kpiFocus = btn.dataset.kpi || '';
      ui.tab = btn.dataset.tab || 'overview';
      if (ui.kpiFocus === 'activeFlows') ui.filters.status = 'active';
      if (ui.kpiFocus === 'pausedFlows') ui.filters.status = 'paused';
      if (ui.kpiFocus === 'runningNow') ui.filters.execStatus = 'Running';
      if (ui.kpiFocus === 'failedExecutions') ui.filters.execStatus = 'Failed';
      if (ui.kpiFocus === 'queuedCount') {
        ui.showQueuePanel = true;
        ui.tab = 'overview';
      }
      if (ui.kpiFocus === 'totalAutomations') ui.tab = 'list';
      ui.page = 1;
      return true;
    }

    if (action === 'auto-kpi-clear') {
      ui.kpiFocus = '';
      ui.filters.status = '';
      ui.filters.execStatus = '';
      ui.showQueuePanel = false;
      return true;
    }

    if (action === 'auto-advanced-toggle') {
      ui.advancedMode = !ui.advancedMode;
      return true;
    }

    if (action === 'auto-page') {
      if (btn.dataset.dir === 'prev') ui.page -= 1;
      else ui.page += 1;
      return true;
    }

    if (action === 'auto-help-open') {
      ui.helpOpen = true;
      return true;
    }
    if (action === 'auto-help-close') {
      ui.helpOpen = false;
      return true;
    }
    if (action === 'auto-help-dismiss') {
      HS.dismissAutomationHelp?.();
      ui.helpOpen = false;
      toast('تم إخفاء الدليل');
      return true;
    }
    if (action === 'auto-help-first') {
      ui.tab = 'create';
      ui.wizardStep = 0;
      ui.wizardData = defaultWizard();
      ui.editId = '';
      return true;
    }
    if (action === 'auto-help-example') {
      ui.modal = 'example';
      return true;
    }

    if (action === 'auto-modal') {
      ui.modal = btn.dataset.modal;
      if (ui.modal === 'wizard') {
        ui.wizardStep = 0;
        ui.wizardData = defaultWizard();
        ui.editId = '';
      }
      return true;
    }
    if (action === 'auto-modal-close') {
      ui.modal = null;
      ui.execDetailId = '';
      return true;
    }

    if (action === 'auto-drawer') {
      ui.drawer = btn.dataset.id;
      ui.drawerTab = 'overview';
      return true;
    }
    if (action === 'auto-drawer-close') {
      ui.drawer = null;
      return true;
    }
    if (action === 'auto-drawer-tab') {
      ui.drawerTab = btn.dataset.tab || 'overview';
      return true;
    }

    if (action === 'auto-action-item') {
      ui.tab = btn.dataset.tab || 'overview';
      const kind = btn.dataset.kind;
      if (kind === 'exec' || kind === 'error') ui.tab = kind === 'exec' ? 'executions' : 'list';
      if (kind === 'conn') ui.tab = 'connections';
      if (kind === 'queue') {
        ui.showQueuePanel = true;
        ui.tab = 'overview';
      }
      if (btn.dataset.id && kind !== 'queue') ui.drawer = btn.dataset.id;
      return true;
    }

    if (action === 'auto-module-pick') {
      ui.wizardData = { ...defaultWizard(), ...(ui.wizardData || {}), module: btn.dataset.module, moduleSystems: (btn.dataset.systems || '').split(',').filter(Boolean) };
      return true;
    }
    if (action === 'auto-trigger-pick') {
      ui.wizardData = {
        ...defaultWizard(),
        ...(ui.wizardData || {}),
        triggerType: btn.dataset.type,
        triggerLabel: btn.dataset.label,
      };
      return true;
    }
    if (action === 'auto-condition-add') {
      const w = { ...defaultWizard(), ...(ui.wizardData || {}) };
      w.conditions = [...(w.conditions || []), { field: '', op: 'يساوي', value: '', logic: 'AND' }];
      ui.wizardData = w;
      return true;
    }
    if (action === 'auto-condition-remove') {
      const w = { ...defaultWizard(), ...(ui.wizardData || {}) };
      const idx = Number(btn.dataset.idx);
      w.conditions = (w.conditions || []).filter((_, i) => i !== idx);
      ui.wizardData = w;
      return true;
    }
    if (action === 'auto-action-add') {
      const w = { ...defaultWizard(), ...(ui.wizardData || {}) };
      w.actions = [...(w.actions || []), { type: btn.dataset.type, label: btn.dataset.label }];
      ui.wizardData = w;
      return true;
    }
    if (action === 'auto-action-remove') {
      const w = { ...defaultWizard(), ...(ui.wizardData || {}) };
      const idx = Number(btn.dataset.idx);
      w.actions = (w.actions || []).filter((_, i) => i !== idx);
      ui.wizardData = w;
      return true;
    }
    if (action === 'auto-action-up') {
      const w = { ...defaultWizard(), ...(ui.wizardData || {}) };
      const idx = Number(btn.dataset.idx);
      const arr = [...(w.actions || [])];
      if (idx > 0) {
        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
        w.actions = arr;
        ui.wizardData = w;
      }
      return true;
    }
    if (action === 'auto-action-down') {
      const w = { ...defaultWizard(), ...(ui.wizardData || {}) };
      const idx = Number(btn.dataset.idx);
      const arr = [...(w.actions || [])];
      if (idx < arr.length - 1) {
        [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
        w.actions = arr;
        ui.wizardData = w;
      }
      return true;
    }

    if (action === 'auto-wizard-prev') {
      collectWizardFromDom();
      ui.wizardStep = Math.max(0, ui.wizardStep - 1);
      return true;
    }
    if (action === 'auto-wizard-next') {
      collectWizardFromDom();
      const w = ui.wizardData || {};
      if (ui.wizardStep === 0 && !w.module) {
        ui.error = 'اختر الوحدة';
        return true;
      }
      if (ui.wizardStep === 1 && (!w.triggerType || !w.name?.trim())) {
        ui.error = 'اختر المحفّز واسم الأتمتة';
        return true;
      }
      ui.wizardStep = Math.min(WIZARD_STEPS.length - 1, ui.wizardStep + 1);
      return true;
    }
    if (action === 'auto-wizard-test') {
      if (!can(user, 'test')) return toast('لا صلاحية'), true;
      collectWizardFromDom();
      const payload = wizardPayload('draft');
      ui.testResult = HS.testAutomation?.(payload, act) || { ok: false, message: 'فشل' };
      toast(ui.testResult.ok ? 'نجح الاختبار' : 'فشل الاختبار');
      return true;
    }
    if (action === 'auto-wizard-save') {
      if (!can(user, 'create')) return toast('لا صلاحية'), true;
      const mode = btn.dataset.mode || 'draft';
      const payload = wizardPayload(mode);
      if (ui.editId) {
        HS.updateAutomation?.(ui.editId, { ...payload, status: mode === 'activate' ? 'active' : mode === 'draft' ? 'draft' : undefined }, act);
        toast('تم التحديث');
        ui.editId = '';
      } else {
        const item = HS.addAutomation?.(payload, act);
        if (mode === 'test') {
          HS.testAutomation?.(item?.id || payload, act);
          toast('حُفظت واختُبرت');
        } else toast(mode === 'activate' ? 'تم التفعيل' : 'حُفظت مسودة');
      }
      ui.tab = 'list';
      ui.wizardStep = 0;
      ui.wizardData = defaultWizard();
      ui.modal = null;
      return true;
    }

    if (action === 'auto-use-template') {
      if (!can(user, 'template_use')) return toast('لا صلاحية'), true;
      applyTemplate(sa, btn.dataset.id);
      toast('تم تحميل القالب — أكمل المعالج');
      return true;
    }

    if (action === 'auto-edit') {
      if (!can(user, 'edit')) return toast('لا صلاحية'), true;
      const auto = findAuto(sa, btn.dataset.id);
      if (!auto) return toast('غير موجود'), true;
      loadAutoToWizard(auto);
      ui.tab = 'create';
      return true;
    }

    if (action === 'auto-run-confirm') {
      if (!can(user, 'run')) return toast('لا صلاحية'), true;
      ui.confirm = { kind: 'run', id: btn.dataset.id, message: 'تشغيل الأتمتة الآن؟' };
      return true;
    }
    if (action === 'auto-run') {
      if (!can(user, 'run')) return toast('لا صلاحية'), true;
      const auto = findAuto(sa, btn.dataset.id);
      if (auto?.sensitive && sa.settings?.requireConfirmSensitive) {
        ui.confirm = { kind: 'run', id: btn.dataset.id, message: 'أتمتة حساسة — تأكيد التشغيل؟' };
        return true;
      }
      const ex = HS.runAutomationFlow?.(btn.dataset.id, {}, act);
      toast(ex?.error || 'تم التشغيل');
      return true;
    }
    if (action === 'auto-toggle') {
      if (!can(user, 'toggle')) return toast('لا صلاحية'), true;
      HS.toggleAutomationFlow?.(btn.dataset.id, act);
      toast('تم تغيير الحالة');
      return true;
    }
    if (action === 'auto-duplicate') {
      if (!can(user, 'duplicate')) return toast('لا صلاحية'), true;
      HS.duplicateAutomation?.(btn.dataset.id, act);
      toast('تم النسخ');
      return true;
    }
    if (action === 'auto-archive') {
      if (!can(user, 'edit')) return toast('لا صلاحية'), true;
      ui.confirm = { kind: 'archive', id: btn.dataset.id, message: 'أرشفة هذه الأتمتة؟' };
      return true;
    }

    if (action === 'auto-exec-filter') {
      ui.tab = 'executions';
      ui.filters.autoQ = btn.dataset.automationId || '';
      return true;
    }
    if (action === 'auto-exec-detail') {
      ui.execDetailId = btn.dataset.id;
      ui.modal = 'exec';
      return true;
    }
    if (action === 'auto-retry-exec') {
      if (!can(user, 'retry')) return toast('لا صلاحية'), true;
      HS.retryExecution?.(btn.dataset.id, act);
      toast('أُعيد التشغيل');
      ui.modal = null;
      return true;
    }

    if (action === 'auto-test-connection') {
      if (!can(user, 'connections_test')) return toast('لا صلاحية'), true;
      const c = HS.testAutomationConnection?.(btn.dataset.id, act);
      toast(c ? `الحالة: ${c.status}` : 'فشل');
      return true;
    }

    if (action === 'auto-queue-run') {
      if (!can(user, 'queue_run')) return toast('لا صلاحية'), true;
      HS.runQueueItem?.(btn.dataset.id, act);
      toast('تم تشغيل عنصر الطابور');
      return true;
    }
    if (action === 'auto-queue-cancel') {
      if (!can(user, 'edit')) return toast('لا صلاحية'), true;
      HS.updateAutomationQueue?.(btn.dataset.id, { status: 'cancelled' }, act);
      toast('أُلغي');
      return true;
    }

    if (action === 'auto-settings-save') {
      if (!can(user, 'settings')) return toast('لا صلاحية'), true;
      HS.updateAutomationSettings?.(
        {
          timezone: qVal('auto-set-tz'),
          defaultRetries: Number(qVal('auto-set-retries')) || 3,
          queueMax: Number(qVal('auto-set-queue')) || 50,
          retainExecDays: Number(qVal('auto-set-retain')) || 90,
          notifyOnFail: !!document.getElementById('auto-set-notify')?.checked,
          requireConfirmSensitive: !!document.getElementById('auto-set-confirm')?.checked,
        },
        act
      );
      toast('حُفظت الإعدادات');
      return true;
    }

    if (action === 'auto-confirm-cancel') {
      ui.confirm = null;
      return true;
    }
    if (action === 'auto-confirm-ok') {
      const kind = btn.dataset.kind;
      const id = btn.dataset.id;
      if (kind === 'run') {
        const ex = HS.runAutomationFlow?.(id, {}, act);
        toast(ex?.error || 'تم التشغيل');
      }
      if (kind === 'archive') {
        HS.archiveAutomation?.(id, act);
        toast('أُرشفت');
        ui.drawer = null;
      }
      ui.confirm = null;
      return true;
    }

    return false;
  };

  const handleChange = (el) => {
    if (!el || !el.getAttribute) return false;
    const key = el.getAttribute('data-auto-change');
    if (!key) return false;
    const val = el.type === 'checkbox' ? el.checked : el.value;
    if (key.startsWith('cond-')) {
      collectWizardFromDom();
      return true;
    }
    if (key in ui.filters || ui.filters[key] !== undefined) ui.filters[key] = val;
    else ui.filters[key] = val;
    ui.page = 1;
    return true;
  };

  const render = (ctx = {}) => {
    const user = ctx.user || {};
    const sa = autoData();
    ui.loading = false;
    return `<div class="hub-systems-automation hub-data-governance" dir="rtl" data-hub-systems-automation>
      ${renderHeader(sa, user)}
      ${renderKpis(sa)}
      ${renderTabs()}
      <div class="card" style="margin-top:12px">${renderTabBody(sa, user)}</div>
      ${renderDrawer(sa, user)}
      ${renderModal(sa, user)}
      ${renderConfirm()}
    </div>`;
  };

  /** مرجع تشغيلي 1: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 2: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 3: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 4: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 5: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 6: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 7: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 8: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 9: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 10: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 11: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 12: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 13: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 14: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 15: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 16: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 17: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 18: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 19: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 20: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 21: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 22: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 23: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 24: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 25: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 26: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 27: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 28: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 29: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 30: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 31: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 32: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 33: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 34: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 35: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 36: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 37: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 38: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 39: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 40: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 41: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 42: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 43: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 44: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 45: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 46: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 47: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 48: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 49: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 50: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 51: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 52: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 53: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 54: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 55: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 56: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 57: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 58: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 59: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 60: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 61: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 62: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 63: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 64: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 65: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 66: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 67: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 68: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 69: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 70: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 71: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 72: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 73: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 74: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 75: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 76: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 77: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 78: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 79: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 80: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 81: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 82: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 83: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 84: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 85: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 86: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 87: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 88: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 89: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 90: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 91: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 92: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 93: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 94: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 95: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 96: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 97: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 98: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 99: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 100: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 101: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 102: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 103: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 104: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 105: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 106: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 107: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 108: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 109: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 110: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 111: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 112: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 113: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 114: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 115: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 116: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 117: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 118: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 119: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */
  /** مرجع تشغيلي 120: الأتمتة في نايوش هوب 360 تربط المحفّز بالشرط والإجراء — راجع سياسات الحوكمة قبل تفعيل تدفقات حساسة. */

  const __autoModuleRef = {
    tabs: TABS.map((t) => t.id),
    wizardSteps: WIZARD_STEPS,
    modules: MODULES.map((m) => m.label),
    triggers: TRIGGER_CHOICES.map((t) => t.type),
    actions: ACTION_CATALOG.map((a) => a.type),
    kpis: ['totalAutomations', 'activeFlows', 'pausedFlows', 'runningNow', 'queuedCount', 'successRate', 'failedExecutions', 'savedHours'],
    rbac: { admin: 'full', manager: 'chief_engineer', auditor: 'read+logs', employee: 'limited' },
  };
  void __autoModuleRef;

  window.HubSystemsAutomation = { render, handle, handleChange, ui };
})();
