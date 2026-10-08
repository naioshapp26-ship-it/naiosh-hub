/**
 * NAIOSH HUB 360 — Batch A: Leadership & Operations Workspaces
 * overview · operating · tasks · measurement · reports · integration · core
 */
(() => {
  'use strict';

  const Kit = () => window.HubWsKit;
  const store = () => window.HubStore;

  const statusTaskLabel = (s) =>
    ({ todo: 'معلّقة', in_progress: 'قيد التنفيذ', blocked: 'مختنق', done: 'مكتملة' }[s] || window.HubI18n?.status?.(s) || s);
  const statusTaskBadge = (s) => {
    const map = { todo: 'badge-gray', in_progress: 'badge-red', blocked: 'badge-red', done: 'badge-black' };
    return Kit().badge(statusTaskLabel(s), map[s] || 'badge-outline');
  };
  const feedTypeAr = (t) =>
    window.HubI18n?.label?.(t) ||
    ({ architecture: 'معمارية', decision: 'قرار', alert: 'تنبيه', compliance: 'امتثال', report: 'تقرير' }[t] || t);

  const peopleNames = () =>
    (store()?.get?.()?.workforce?.employees || []).map((e) => e.name).filter(Boolean);

  /* ───────── Overview / Command Center ───────── */
  const ovUi = { tab: 'board', helpOpen: false, kpiFocus: '' };
  const OV_TABS = [
    { id: 'board', label: 'لوحة القيادة', icon: 'fa-gauge' },
    { id: 'pulse', label: 'النبض الحي', icon: 'fa-bolt' },
    { id: 'phases', label: 'المراحل', icon: 'fa-flag' },
    { id: 'layers', label: 'صحة المحاور', icon: 'fa-diagram-project' },
    { id: 'audit', label: 'سجل العمليات', icon: 'fa-clock-rotate-left' },
    { id: 'settings', label: 'الإعدادات', icon: 'fa-gear' },
  ];

  const ovNeeds = (s, k) => {
    const items = [];
    const blocked = (s.tasks?.items || []).filter((t) => t.status === 'blocked');
    blocked.slice(0, 3).forEach((t) => items.push({ text: `مهمة مختنقة: ${t.title}`, tab: 'board', id: t.id }));
    (s.core?.anomalies || [])
      .filter((a) => a.status !== 'closed')
      .slice(0, 2)
      .forEach((a) => items.push({ text: `شذوذ مفتوح: ${a.signal}`, tab: 'board' }));
    if ((k.systemsHealth || 0) < 90) items.push({ text: `صحة الأنظمة ${k.systemsHealth}% — مراجعة التكامل`, tab: 'layers' });
    if ((s.integration?.connectors || []).some((c) => c.status !== 'connected'))
      items.push({ text: 'موصل غير متصل — افتح التكامل', tab: 'board' });
    return items;
  };

  const renderOverview = (ctx = {}) => {
    const { user } = ctx;
    const K = Kit();
    const s = store().get();
    const k = store().kpis();
    const cmd = s.empire?.command || {};
    const lh = k.layerHealth || {};
    const needs = ovNeeds(s, k);
    const ws = cmd.ws || { auditLog: [], settings: {} };

    const kpis = [
      { key: 'branches', label: 'الفروع', value: k.branches, hint: 'فروع', tab: 'board' },
      { key: 'incubators', label: 'الحاضنات', value: k.incubators, hint: 'حاضنات', tab: 'board' },
      { key: 'platforms', label: 'المنصات', value: k.platforms, hint: 'منصات', tab: 'board' },
      { key: 'treasury', label: 'خزينة النقاط', value: Number(k.treasury).toLocaleString('en-US'), hint: 'محفظة', tab: 'board' },
      { key: 'core', label: 'جاهزية النواة', value: `${k.coreReadyPct}%`, hint: 'النواة', tab: 'layers' },
      { key: 'usage', label: 'استخدام الأنظمة', value: `${cmd.systemsUsagePct || 0}%`, hint: 'الاستخدام', tab: 'pulse' },
      { key: 'health', label: 'صحة الأنظمة', value: `${k.systemsHealth}%`, hint: 'الصحة', tab: 'layers' },
      { key: 'needs', label: 'يتطلب إجراء', value: needs.length, hint: 'إجراء مطلوب', tab: 'board' },
    ];

    let body = '';
    if (ovUi.tab === 'board') {
      const blocked = (s.tasks?.items || []).filter((t) => t.status === 'blocked').slice(0, 5);
      const openAnom = (s.core?.anomalies || []).filter((a) => a.status !== 'closed').slice(0, 5);
      body = `
        ${K.renderNeeds('ov', needs)}
        <div class="hub-op-rail">
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-satellite-dish icon"></i> غرفة القرار الآن</span></h3>
            <div class="hub-op-pulse">
              <div><span>صحة الأنظمة</span><strong>${k.systemsHealth || 0}%</strong>${K.bar(k.systemsHealth)}</div>
              <div><span>جاهزية النواة</span><strong>${k.coreReadyPct || 0}%</strong>${K.bar(k.coreReadyPct)}</div>
              <div><span>استخدام الأنظمة</span><strong>${cmd.systemsUsagePct || 0}%</strong>${K.bar(cmd.systemsUsagePct)}</div>
            </div>
            <div class="toolbar" style="margin-top:10px;flex-wrap:wrap">
              <button type="button" class="btn btn-primary" data-action="ov-refresh"><i class="fas fa-rotate"></i> تحديث المؤشرات</button>
              <button type="button" class="btn btn-dark" data-action="ov-tab" data-tab="pulse">التدفق الحي</button>
              <button type="button" class="btn btn-ghost" data-action="ov-tab" data-tab="layers">صحة المحاور</button>
            </div>
          </article>
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-bolt icon"></i> اختناقات فورية</span></h3>
            <ul class="hub-op-mini-list">
              ${blocked.map((t) => `<li><b>${K.esc(t.title)}</b><small>مهمة مختنقة · ${K.esc(t.assignee || '—')}</small>${statusTaskBadge(t.status)}</li>`).join('') || '<li class="empty">لا مهام مختنقة</li>'}
              ${openAnom.map((a) => `<li><b>${K.esc(a.signal)}</b><small>${K.esc(a.source)}</small>${K.badge(String(a.score), 'badge-red')}</li>`).join('')}
            </ul>
            <div class="toolbar" style="margin-top:8px;flex-wrap:wrap">
              <button type="button" class="btn btn-dark btn-sm" data-nav="tasks">المهام</button>
              <button type="button" class="btn btn-dark btn-sm" data-nav="core">العقل المركزي</button>
              <button type="button" class="btn btn-dark btn-sm" data-nav="integration">التكامل</button>
              <button type="button" class="btn btn-dark btn-sm" data-nav="clients-mgmt">العملاء</button>
            </div>
          </article>
        </div>
        <div class="hub-op-grid3">
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-crosshairs icon"></i> مصادر المؤشرات</span></h3>
            <ul class="feed">
              <li><b>الفروع/الحاضنات/المنصات</b> · الهيكل التنظيمي</li>
              <li><b>الخزينة</b> · المحفظة</li>
              <li><b>صحة الأنظمة</b> · سجل الأنظمة</li>
              <li><b>جاهزية النواة</b> · دستور المعمارية</li>
            </ul>
          </article>
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-flag icon"></i> مراحل السيادة</span>
              <button type="button" class="btn btn-sm btn-ghost" data-action="ov-tab" data-tab="phases">الكل</button></h3>
            ${['phase1', 'phase2', 'phase3']
              .map((key) => {
                const p = s.timeline[key];
                return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800"><span>${K.esc(p.name)}</span><span>${p.progress}%</span></div>${K.bar(p.progress)}</div>`;
              })
              .join('')}
          </article>
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-stream icon"></i> آخر التدفق</span>
              <button type="button" class="btn btn-sm btn-ghost" data-action="ov-tab" data-tab="pulse">المزيد</button></h3>
            <ul class="feed hub-op-feed">${(s.feed || [])
              .slice(0, 6)
              .map((f) => `<li><b>${K.esc(feedTypeAr(f.type))}</b> — ${K.esc(f.text)} <small>${K.fmtTime(f.at)}</small></li>`)
              .join('') || '<li>لا أحداث</li>'}</ul>
          </article>
        </div>`;
    } else if (ovUi.tab === 'pulse') {
      const feedOff = store().getSettings?.()?.liveFeedEnabled === false;
      body = `<article class="card"><h3><span class="title-left"><i class="fas fa-bolt icon"></i> تدفق حي</span>
        <button type="button" class="btn btn-sm btn-ghost" data-action="ov-refresh-feed"><i class="fas fa-rotate"></i></button></h3>
        <ul class="feed">${
          feedOff
            ? '<li>التدفق الحي موقوف من الإعدادات الداخلية.</li>'
            : (s.feed || [])
                .slice(0, 15)
                .map((f) => `<li><b>${K.esc(feedTypeAr(f.type))}:</b> ${K.esc(f.text)}<small>${K.fmtTime(f.at)}</small></li>`)
                .join('') || '<li>لا أحداث بعد</li>'
        }</ul></article>`;
    } else if (ovUi.tab === 'phases') {
      body = `<div class="phase-cards">${['phase1', 'phase2', 'phase3']
        .map((key) => {
          const p = s.timeline[key];
          return `<article class="phase-card"><h4>${K.esc(p.name)} · ${p.days} يوم</h4>${K.bar(p.progress)}<small>${p.progress}%</small>
            <ul>${p.items.map((i) => `<li>${K.esc(i)}</li>`).join('')}</ul></article>`;
        })
        .join('')}</div>`;
    } else if (ovUi.tab === 'layers') {
      body = `<article class="card"><h3><span class="title-left"><i class="fas fa-diagram-project icon"></i> صحة المحاور</span></h3>
        ${Object.entries({
          'الهوية NAIOSH ID': lh.identity,
          'الهيكل العالمي': lh.organization,
          'العقل المركزي': lh.core,
          الحوكمة: lh.governance,
          'محفظة النقاط': lh.wallet,
          الأنظمة: lh.systems,
          التكامل: lh.integration,
          القياس: lh.measurement,
        })
          .map(
            ([name, val]) =>
              `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:4px"><span>${K.esc(name)}</span><span>${val || 0}%</span></div>${K.bar(val)}</div>`
          )
          .join('')}</article>`;
    } else if (ovUi.tab === 'audit') {
      body = `<article class="card"><h3><span class="title-left"><i class="fas fa-clock-rotate-left icon"></i> سجل مركز التحكم</span></h3>${K.renderAuditTable(ws.auditLog || [])}</article>`;
    } else {
      body = `<article class="card"><h3>إعدادات مركز التحكم</h3>
        <p class="muted">التدفق الحي يُدار من الإعدادات الداخلية العامة. تحديث المؤشرات يسجّل في سجل التدقيق.</p>
        <button type="button" class="btn btn-primary" data-action="ov-refresh"><i class="fas fa-rotate"></i> تحديث المؤشرات الآن</button>
      </article>`;
    }

    return `<div class="hub-ops-ws hub-overview">
      ${K.renderHeader({
        prefix: 'ov',
        title: 'مركز التحكم العالمي',
        subtitle: 'غرفة قيادة واحدة — مؤشرات قابلة للنقر · يتطلب إجراء · مصدر كل رقم واضح',
        icon: 'fa-satellite-dish',
        actionsHtml: `
          <button type="button" class="btn btn-primary btn-sm" data-action="ov-refresh"><i class="fas fa-rotate"></i> تحديث</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="ov-help-open"><i class="fas fa-circle-question"></i></button>`,
      })}
      ${K.renderKpis('ov', kpis, ovUi.kpiFocus)}
      ${K.renderTabs('ov', OV_TABS, ovUi.tab)}
      ${body}
      ${K.renderHelp('ov', {
        title: 'كيف تستخدم مركز التحكم',
        dismissed: !!ws.settings?.helpDismissed,
        open: ovUi.helpOpen,
        bodyHtml: `<p>اضغط أي KPI للانتقال للتبويب المناسب. يتطلب إجراء يجمع الاختناقات والشذوذ. كل تحديث يُسجَّل في سجل العمليات مع المصدر.</p>`,
      })}
    </div>`;
  };

  const handleOverview = (action, btn, ctx = {}) => {
    const { toast } = ctx;
    if (action === 'ov-tab') {
      ovUi.tab = btn.dataset.tab || 'board';
      return true;
    }
    if (action === 'ov-kpi') {
      ovUi.kpiFocus = btn.dataset.key || '';
      if (btn.dataset.tab) ovUi.tab = btn.dataset.tab;
      return true;
    }
    if (action === 'ov-refresh' || action === 'ov-refresh-feed') {
      store().refreshCommandStats?.();
      toast?.('تم تحديث مؤشرات مركز التحكم');
      return true;
    }
    if (action === 'ov-help-open') {
      ovUi.helpOpen = true;
      return true;
    }
    if (action === 'ov-help-dismiss') {
      const cmd = store().get().empire.command;
      cmd.ws = cmd.ws || { schemaVersion: 2, auditLog: [], settings: {} };
      cmd.ws.settings.helpDismissed = true;
      ovUi.helpOpen = false;
      store().save?.();
      return true;
    }
    return false;
  };

  /* ───────── Operating ───────── */
  const opUi = { tab: 'overview', helpOpen: false, page: 1 };
  const OP_TABS = [
    { id: 'overview', label: 'نظرة عامة', icon: 'fa-gauge' },
    { id: 'subs', label: 'الاشتراكات', icon: 'fa-key' },
    { id: 'offices', label: 'المكاتب', icon: 'fa-briefcase' },
    { id: 'services', label: 'خريطة الخدمات', icon: 'fa-layer-group' },
    { id: 'activity', label: 'النشاط', icon: 'fa-timeline' },
    { id: 'audit', label: 'سجل العمليات', icon: 'fa-clock-rotate-left' },
    { id: 'settings', label: 'الإعدادات', icon: 'fa-gear' },
  ];

  const PLAN_OPTS = ['standard', 'professional', 'enterprise'];
  const planLabel = (p) => window.HubI18n?.plan?.(p) || p || '—';
  const systemLabel = (code) =>
    window.HubI18n?.system?.(code) || window.HubLauncher?.SYSTEM_META?.[code]?.nameAr || code || '—';
  const kindLabel = (k) => window.HubI18n?.activityKind?.(k) || k || '—';
  const permLabels = (list) =>
    (list || [])
      .map((p) => window.HubI18n?.permission?.(p) || p)
      .filter(Boolean)
      .join(' · ');
  const systemOptionsHtml = (systems, selected) =>
    (systems || [])
      .map((c) => `<option value="${K_esc_op(c)}" ${c === selected ? 'selected' : ''}>${K_esc_op(systemLabel(c))}</option>`)
      .join('');
  const planOptionsHtml = (selected) =>
    PLAN_OPTS.map(
      (p) => `<option value="${p}" ${p === selected ? 'selected' : ''}>${planLabel(p)}</option>`
    ).join('');
  const K_esc_op = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const renderOperating = (ctx = {}) => {
    const { user } = ctx;
    const K = Kit();
    const op = store().ensureOperating?.() || store().get().empire.operating || { subscriptions: [], offices: [], activityLog: [] };
    const systems = Object.keys(window.HubLauncher?.SYSTEM_META || {});
    const services = store().listUnifiedServices?.() || [];
    const bySystem = services.reduce((acc, s) => {
      (acc[s.systemCode] = acc[s.systemCode] || []).push(s);
      return acc;
    }, {});
    const activeSubs = (op.subscriptions || []).filter((s) => s.status === 'active');
    const offices = op.offices || [];
    const activity = op.activityLog || [];
    const systemCount = Object.keys(bySystem).length || systems.length;
    const defaultPlan = store().getSettings?.()?.defaultGrantPlan || 'standard';
    const needs = [];
    if (!activeSubs.length) needs.push({ text: 'لا اشتراكات نشطة — امنح صلاحية لنظام', tab: 'subs', hint: 'تبويب الاشتراكات' });
    if (!offices.length) needs.push({ text: 'لا مكاتب إلكترونية ممنوحة', tab: 'offices', hint: 'تبويب المكاتب' });
    if (activity.length < 3) needs.push({ text: 'سجل النشاط خفيف — ولّد تقرير نشاط موحّد', tab: 'activity', hint: 'للقائد الأعلى' });

    const kpis = [
      { key: 'subs', label: 'اشتراكات نشطة', value: activeSubs.length, hint: 'صلاحيات ممنوحة', tab: 'subs', icon: 'fa-key' },
      { key: 'offices', label: 'مكاتب إلكترونية', value: offices.length, hint: 'ممنوحة من هوب', tab: 'offices', icon: 'fa-briefcase' },
      { key: 'services', label: 'خدمات موحّدة', value: services.length, hint: `${systemCount} نظام`, tab: 'services', icon: 'fa-layer-group' },
      { key: 'activity', label: 'سجل النشاط', value: activity.length, hint: 'أحداث تشغيل', tab: 'activity', icon: 'fa-timeline' },
      { key: 'systems', label: 'أنظمة مربوطة', value: systemCount, hint: 'خريطة الخدمات', tab: 'services', icon: 'fa-cubes' },
      { key: 'needs', label: 'يتطلب إجراء', value: needs.length, hint: needs.length ? 'يتطلب تدخل' : 'مستقر', tab: 'overview', icon: 'fa-bolt' },
    ];

    let body = '';
    if (opUi.tab === 'overview') {
      const recentSubs = activeSubs.slice(0, 6);
      const recentAct = activity.slice(0, 8);
      const topSystems = Object.entries(bySystem).slice(0, 6);
      body = `
        ${K.renderNeeds('op', needs)}
        <div class="hub-op-rail">
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-bolt icon"></i> منح سريع</span></h3>
            <p class="muted">اشتراك = صلاحية · بدون تكرار أنظمة</p>
            <div class="toolbar" style="flex-wrap:wrap">
              <div class="field"><label>بريد العميل</label><input id="op-sub-email" type="email" value="${K.esc(user?.email || '')}" placeholder="name@naiosh.com" /></div>
              <div class="field"><label>النظام</label>
                <select id="op-sub-system">${systemOptionsHtml(systems)}</select>
              </div>
              <div class="field"><label>الخطة</label>
                <select id="op-sub-plan">${planOptionsHtml(defaultPlan)}</select>
              </div>
              <button type="button" class="btn btn-primary" data-action="op-grant"><i class="fas fa-user-check"></i> منح الآن</button>
            </div>
          </article>
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-gauge-high icon"></i> نبض التشغيل</span></h3>
            <div class="hub-op-pulse">
              <div><span>نسبة تغطية الخدمات</span><strong>${services.length ? Math.min(100, Math.round((systemCount / Math.max(1, systems.length || 1)) * 100)) : 0}%</strong>${K.bar(services.length ? Math.min(100, Math.round((systemCount / Math.max(1, systems.length || 1)) * 100)) : 0)}</div>
              <div><span>مكاتب / اشتراكات</span><strong>${offices.length} / ${activeSubs.length}</strong>${K.bar(Math.min(100, activeSubs.length ? Math.round((offices.length / activeSubs.length) * 100) : 0))}</div>
              <div><span>أحداث آخر دورة</span><strong>${recentAct.length}</strong>${K.bar(Math.min(100, recentAct.length * 12))}</div>
            </div>
            <div class="toolbar" style="margin-top:10px;flex-wrap:wrap">
              <button type="button" class="btn btn-primary" data-action="op-gen-activity"><i class="fas fa-scroll"></i> تقرير النشاط الموحّد</button>
              <button type="button" class="btn btn-dark" data-action="op-tab" data-tab="subs">إدارة الاشتراكات</button>
              <button type="button" class="btn btn-ghost" data-action="op-tab" data-tab="services">خريطة الخدمات</button>
              <a class="btn btn-ghost" href="operating.html" target="_blank"><i class="fas fa-book"></i> الدليل الكامل</a>
            </div>
          </article>
        </div>
        <div class="hub-op-grid3">
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-key icon"></i> آخر الاشتراكات</span>
              <button type="button" class="btn btn-sm btn-ghost" data-action="op-tab" data-tab="subs">الكل</button></h3>
            <div class="table-wrap"><table class="data">
              <thead><tr><th>البريد</th><th>النظام</th><th>الخطة</th></tr></thead>
              <tbody>${
                recentSubs
                  .map(
                    (s) =>
                      `<tr><td>${K.esc(s.email)}</td><td title="${K.esc(s.systemCode)}">${K.esc(systemLabel(s.systemCode))}</td><td>${K.esc(planLabel(s.plan))}</td></tr>`
                  )
                  .join('') || '<tr><td colspan="3" class="empty">لا اشتراكات — استخدم المنح السريع أعلاه</td></tr>'
              }</tbody>
            </table></div>
          </article>
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-briefcase icon"></i> المكاتب</span>
              <button type="button" class="btn btn-sm btn-ghost" data-action="op-tab" data-tab="offices">الكل</button></h3>
            <ul class="hub-op-mini-list">${
              offices
                .slice(0, 6)
                .map((o) => `<li><b>${K.esc(o.nameAr)}</b><small>${K.esc(o.branch || '—')} · ${K.esc(o.platform || '—')}</small>${K.badge(o.status || 'active', 'badge-black')}</li>`)
                .join('') || '<li class="empty">لا مكاتب ممنوحة بعد</li>'
            }</ul>
            ${window.HubActions ? `<div style="margin-top:8px">${window.HubActions.toolbarHtml('offices', 'منح مكتب')}</div>` : ''}
          </article>
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-timeline icon"></i> آخر النشاط</span>
              <button type="button" class="btn btn-sm btn-ghost" data-action="op-tab" data-tab="activity">الكل</button></h3>
            <ul class="feed hub-op-feed">${
              recentAct
                .map((a) => `<li><b>${K.esc(kindLabel(a.kind))}</b> — ${K.esc(a.text)} <small>${K.fmtTime(a.at)}</small></li>`)
                .join('') || '<li>لا نشاط مسجّل بعد</li>'
            }</ul>
          </article>
        </div>
        <article class="card hub-op-panel" style="margin-top:12px">
          <h3><span class="title-left"><i class="fas fa-layer-group icon"></i> معاينة خريطة الخدمات</span>
            <button type="button" class="btn btn-sm btn-primary" data-action="op-tab" data-tab="services">فتح الخريطة كاملة</button></h3>
          <div class="hub-op-service-strip">${
            topSystems
              .map(
                ([code, list]) => `<div class="hub-op-service-chip">
                  <strong title="${K.esc(code)}">${K.esc(systemLabel(code))}</strong>
                  <span>${list.length} خدمة</span>
                </div>`
              )
              .join('') || '<p class="empty">لا خدمات موحّدة محمّلة</p>'
          }</div>
        </article>`;
    } else if (opUi.tab === 'subs') {
      body = `<article class="card">
        <h3><span class="title-left"><i class="fas fa-key icon"></i> منح اشتراك / صلاحية</span></h3>
        <div class="toolbar" style="flex-wrap:wrap">
          <div class="field"><label>بريد العميل</label><input id="op-sub-email" type="email" value="${K.esc(user?.email || '')}" /></div>
          <div class="field"><label>النظام</label>
            <select id="op-sub-system">${systemOptionsHtml(systems)}</select>
          </div>
          <div class="field"><label>الخطة</label>
            <select id="op-sub-plan">${planOptionsHtml(defaultPlan)}</select>
          </div>
          <button type="button" class="btn btn-primary" data-action="op-grant"><i class="fas fa-user-check"></i> منح</button>
        </div>
        <div class="table-wrap" style="margin-top:10px"><table class="data">
          <thead><tr><th>البريد</th><th>النظام</th><th>الخطة</th><th>الصلاحيات</th><th></th></tr></thead>
          <tbody>${
            activeSubs
              .map(
                (s) => `<tr>
                <td>${K.esc(s.email)}</td><td title="${K.esc(s.systemCode)}">${K.esc(systemLabel(s.systemCode))}</td><td>${K.esc(planLabel(s.plan))}</td>
                <td>${K.esc(permLabels(s.permissions))}</td>
                <td><button type="button" class="btn btn-sm btn-dark" data-action="op-revoke" data-id="${K.esc(s.id)}">إلغاء</button></td>
              </tr>`
              )
              .join('') || '<tr><td colspan="5" class="empty">لا اشتراكات بعد</td></tr>'
          }</tbody>
        </table></div>
      </article>`;
    } else if (opUi.tab === 'offices') {
      body = `<article class="card">
        <h3><span class="title-left"><i class="fas fa-briefcase icon"></i> المكاتب الإلكترونية</span>
          ${window.HubActions ? window.HubActions.toolbarHtml('offices', 'منح مكتب إلكتروني') : ''}
        </h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>المكتب</th><th>الفرع</th><th>الحاضنة</th><th>المنصة</th><th>الحالة</th></tr></thead>
          <tbody>${
            (op.offices || [])
              .map(
                (o) => `<tr>
                <td>${K.esc(o.nameAr)}</td><td>${K.esc(o.branch || '—')}</td>
                <td>${K.esc(o.incubator || '—')}</td><td>${K.esc(o.platform || '—')}</td>
                <td>${K.badge(o.status, 'badge-black')}</td>
              </tr>`
              )
              .join('') || '<tr><td colspan="5" class="empty">لا مكاتب بعد</td></tr>'
          }</tbody>
        </table></div>
      </article>`;
    } else if (opUi.tab === 'services') {
      body = `<article class="card"><h3><span class="title-left"><i class="fas fa-layer-group icon"></i> خريطة خدمات الأنظمة</span></h3>
        <div class="grid-2">${Object.entries(bySystem)
          .map(
            ([code, list]) => `<div style="border:1px solid var(--border);border-radius:12px;padding:10px">
              <b title="${K.esc(code)}">${K.esc(systemLabel(code))}</b>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${list.map((s) => `<span class="chip">${K.esc(s.nameAr)}</span>`).join('')}</div>
              <div style="margin-top:8px">${window.HubLauncher?.openButtonsHtml?.(code, { compact: true }) || ''}</div>
            </div>`
          )
          .join('')}</div></article>`;
    } else if (opUi.tab === 'activity') {
      body = `<article class="card"><h3>النشاط الجاري والماضي</h3>
        <ul class="feed">${(op.activityLog || [])
          .slice(0, 40)
          .map((a) => `<li><b>${K.esc(kindLabel(a.kind))}</b> — ${K.esc(a.text)} <small>${K.fmtTime(a.at)}</small></li>`)
          .join('') || '<li>لا نشاط مسجّل بعد</li>'}</ul></article>`;
    } else if (opUi.tab === 'audit') {
      body = `<article class="card">${K.renderAuditTable(op.auditLog || [])}</article>`;
    } else {
      body = `<article class="card"><p>آلية التشغيل: اشتراك = صلاحية · دخول موحّد · خدمات موحّدة بدون تكرار.</p>
        <button type="button" class="btn btn-ghost" data-action="op-help-open">فتح الدليل</button></article>`;
    }

    return `<div class="hub-ops-ws hub-operating-ws" data-ws="operating">
      ${K.renderHeader({
        prefix: 'op',
        title: 'آلية تشغيل نايوش هوب',
        subtitle: 'غرفة تشغيل حيّة: منح صلاحيات · مكاتب · خدمات موحّدة · نشاط · تدقيق — ليست صفحة ثابتة',
        icon: 'fa-gears',
        badgeText: 'غرفة التشغيل',
        actionsHtml: `
          <button type="button" class="btn btn-primary btn-sm" data-action="op-grant"><i class="fas fa-user-check"></i> منح سريع</button>
          <button type="button" class="btn btn-dark btn-sm" data-action="op-gen-activity"><i class="fas fa-scroll"></i> تقرير</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="op-help-open"><i class="fas fa-circle-question"></i></button>`,
      })}
      ${K.renderKpis('op', kpis, '')}
      ${K.renderTabs('op', OP_TABS, opUi.tab)}
      <div class="hub-ws-body">${body}</div>
      ${K.renderHelp('op', {
        title: 'دليل آلية التشغيل',
        dismissed: !!op.settings?.helpDismissed,
        open: opUi.helpOpen,
        bodyHtml: `<p>من النظرة العامة تمنح اشتراكًا فورًا، ترى المكاتب والنشاط وخريطة الخدمات. التبويبات الأخرى للتفاصيل العميقة والتدقيق.</p>`,
      })}
    </div>`;
  };

  const handleOperating = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const K = Kit();
    if (action === 'op-tab') {
      opUi.tab = btn.dataset.tab || 'overview';
      return true;
    }
    if (action === 'op-kpi') {
      if (btn.dataset.tab) opUi.tab = btn.dataset.tab;
      return true;
    }
    if (action === 'op-grant') {
      const email = K.qVal('op-sub-email');
      const systemCode = K.qVal('op-sub-system');
      const plan = K.qVal('op-sub-plan') || 'standard';
      if (!email || !systemCode) {
        toast?.('البريد والنظام مطلوبان');
        return true;
      }
      store().grantSubscription?.({ email, systemCode, plan });
      const op = store().ensureOperating?.();
      store().pushDomainAudit?.(op, {
        action: 'grant',
        detail: `منح ${systemCode} → ${email}`,
        by: K.actorName(user),
        source: 'Operating',
      });
      store().save?.();
      toast?.('تم منح الاشتراك');
      return true;
    }
    if (action === 'op-revoke') {
      store().revokeSubscription?.(btn.dataset.id);
      const op = store().ensureOperating?.();
      store().pushDomainAudit?.(op, {
        action: 'revoke',
        detail: `إلغاء اشتراك ${btn.dataset.id}`,
        by: K.actorName(user),
        source: 'Operating',
      });
      store().save?.();
      toast?.('أُلغي الاشتراك');
      return true;
    }
    if (action === 'op-gen-activity') {
      store().generateReport?.('activity');
      toast?.('تقرير النشاط جاهز — راجع وحدة التقارير');
      return true;
    }
    if (action === 'op-help-open') {
      opUi.helpOpen = true;
      return true;
    }
    if (action === 'op-help-dismiss') {
      const op = store().ensureOperating?.();
      if (op) {
        op.settings = op.settings || {};
        op.settings.helpDismissed = true;
        store().save?.();
      }
      opUi.helpOpen = false;
      return true;
    }
    return false;
  };

  /* ───────── Tasks (server-backed) ───────── */
  const tkUi = {
    tab: 'list',
    page: 1,
    pageSize: 10,
    filters: { q: '', status: '', priority: '', assignee: '' },
    modal: null,
    drawer: null,
    helpOpen: false,
    kpiFocus: '',
    editId: null,
    serverItems: null,
    serverAudit: [],
    catalog: null,
    pendingAttachments: [],
    loading: false,
    loaded: false,
  };
  const TK_TABS = [
    { id: 'list', label: 'قائمة المهام', icon: 'fa-list-check' },
    { id: 'board', label: 'لوحة الحالات', icon: 'fa-columns' },
    { id: 'audit', label: 'سجل العمليات', icon: 'fa-clock-rotate-left' },
    { id: 'settings', label: 'الإعدادات', icon: 'fa-gear' },
  ];

  const tkAuthHeaders = () => {
    const token = localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || '';
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}`, 'X-Hub-Token': token } : {}),
    };
  };

  const tkRefreshDash = () => {
    try {
      document.dispatchEvent(new CustomEvent('hub-panel-refresh'));
    } catch {
      /* */
    }
  };

  const ensureTasksLoaded = () => {
    if (tkUi.loading || tkUi.loaded) return;
    tkUi.loading = true;
    Promise.all([
      fetch('/api/hub/tasks', { credentials: 'same-origin', headers: tkAuthHeaders() }).then((r) => r.json()),
      fetch('/api/hub/tasks/catalog', { credentials: 'same-origin', headers: tkAuthHeaders() }).then((r) => r.json()),
    ])
      .then(([list, cat]) => {
        if (list?.ok) {
          tkUi.serverItems = list.items || [];
          tkUi.serverAudit = list.audit || [];
        }
        if (cat?.ok) tkUi.catalog = cat.catalog;
        tkUi.loaded = true;
      })
      .catch(() => {
        tkUi.loaded = true;
      })
      .finally(() => {
        tkUi.loading = false;
        tkRefreshDash();
      });
  };

  const orgPool = (kind) => {
    if (kind === 'branch') {
      return (window.HubBranchesData?.BRANCHES || []).map((b) => ({
        id: String(b.code || b.id || b.nameAr || ''),
        name: b.nameAr || b.name || b.code || '',
        num: b.code || b.id || '',
      }));
    }
    if (kind === 'incubator') {
      return (window.HubIncubatorsData?.INCUBATORS || []).map((i) => ({
        id: String(i.id || i.code || i.num || i.name || ''),
        name: i.name || i.nameAr || i.code || '',
        num: i.num != null ? String(i.num) : i.id || '',
      }));
    }
    if (kind === 'platform') {
      return (window.HubSovereignPlatforms?.list || []).map((p) => ({
        id: String(p.code || p.id || p.nameAr || ''),
        name: p.nameAr || p.name || p.code || '',
        num: p.code || p.id || '',
      }));
    }
    return [];
  };

  const filterTasks = (items) => {
    const f = tkUi.filters;
    return (items || []).filter((t) => {
      if (tkUi.kpiFocus === 'blocked' && t.status !== 'blocked') return false;
      if (tkUi.kpiFocus === 'todo' && t.status !== 'todo') return false;
      if (tkUi.kpiFocus === 'done' && t.status !== 'done') return false;
      if (f.status && t.status !== f.status) return false;
      if (f.priority && t.priority !== f.priority) return false;
      const assigneeLabel = t.assigneeLabel || t.assignee?.name || t.assignee || '';
      if (f.assignee && assigneeLabel !== f.assignee) return false;
      if (f.q) {
        const orgHay = `${t.entityLabel || ''} ${t.branch?.name || ''} ${t.incubator?.name || ''} ${t.platform?.name || ''} ${t.branchId || ''} ${t.incubatorId || ''} ${t.platformId || ''}`;
        const hay = `${t.title} ${t.details || ''} ${assigneeLabel} ${t.project || ''} ${t.taskNo || ''} ${orgHay}`.toLowerCase();
        if (!hay.includes(f.q.toLowerCase())) return false;
      }
      return true;
    });
  };

  const taskFormHtml = (item = {}) => {
    const K = Kit();
    const cat = tkUi.catalog || {};
    const assigneeType = item.assignee?.type || item.assigneeType || '';
    const att = tkUi.pendingAttachments || item.attachments || [];
    const typeOptions = (cat.assigneeTypes || [
      { code: 'staff_naiosh', label: 'موظف في نايوش' },
      { code: 'staff_external', label: 'موظف أو شخص من جهة خارجية' },
      { code: 'customer', label: 'عميل' },
      { code: 'company', label: 'شركة أو مؤسسة' },
    ])
      .map((t) => `<option value="${K.esc(t.code)}" ${assigneeType === t.code ? 'selected' : ''}>${K.esc(t.label)}</option>`)
      .join('');
    const taskTypeOpts = (cat.taskTypes || [{ code: 'operational', label: 'تشغيلية' }])
      .map((t) => `<option value="${K.esc(t.code)}" ${(item.taskType || 'operational') === t.code ? 'selected' : ''}>${K.esc(t.label)}</option>`)
      .join('');

    return `
      <style>
        .hub-ws-modal[data-tk-wide="1"], .hub-tasks-form-wrap { width: min(960px,96vw) !important; }
        .tk-form-section{border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:12px;background:#f8fafc}
        .tk-form-section h4{margin:0 0 10px;font-size:15px}
        .tk-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .tk-org-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .tk-form-grid .full,.tk-org-grid .full{grid-column:1/-1}
        .tk-req{color:#b91c1c}
        .tk-opt{color:#64748b;font-size:12px;font-weight:500}
        .tk-org-field select{width:100%;min-height:38px;max-height:38px}
        .tk-org-field input[type="search"]{width:100%;margin-bottom:6px}
        .tk-att-list{display:grid;gap:8px;margin-top:8px}
        .tk-att-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;font-size:13px}
        .tk-att-bar{height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;flex:1;min-width:120px}
        .tk-att-bar>i{display:block;height:100%;background:#b91c1c;width:0}
        @media(max-width:820px){.tk-org-grid{grid-template-columns:1fr}.tk-form-grid{grid-template-columns:1fr}}
      </style>
      <div class="tk-form-wrap" data-tk-wide="1">
        <section class="tk-form-section">
          <h4>1) بيانات المهمة</h4>
          <div class="tk-form-grid">
            <div class="field full"><label>عنوان المهمة <span class="tk-req">*</span></label><input id="tk-title" value="${K.esc(item.title || '')}" placeholder="مثال: متابعة تفعيل اشتراك العميل" /></div>
            <div class="field"><label>نوع / تصنيف المهمة <span class="tk-req">*</span></label>
              <select id="tk-task-type">${taskTypeOpts}</select>
            </div>
            <div class="field"><label>المشروع <span class="tk-opt">(اختياري)</span></label><input id="tk-project" value="${K.esc(item.project || '')}" placeholder="تشغيل يومي / مشروع…" /></div>
          </div>
        </section>

        <section class="tk-form-section">
          <h4>2) المسؤول عن المهمة</h4>
          <div class="tk-form-grid">
            <div class="field"><label>نوع المسؤول عن المهمة <span class="tk-req">*</span></label>
              <select id="tk-assignee-type" data-tk-change="assigneeType"><option value="">— اختر النوع —</option>${typeOptions}</select>
            </div>
            <div class="field"><label>المسؤول عن المهمة <span class="tk-req">*</span></label>
              <input id="tk-assignee-q" data-tk-change="assigneeQ" type="search" placeholder="ابحث بالاسم / البريد / رقم الموظف…" value="" />
              <select id="tk-assignee-id" style="width:100%;margin-top:6px;min-height:38px">
                <option value="">اختر نوع المسؤول أولًا ثم ابحث</option>
              </select>
              <small id="tk-assignee-hint" class="tk-opt"></small>
            </div>
            <div class="field full" id="tk-contact-wrap" style="display:none">
              <label>شخص المتابعة داخل الشركة <span class="tk-opt">(مطلوب عند الإمكان)</span></label>
              <select id="tk-contact-id"><option value="">— بدون تحديد —</option></select>
            </div>
          </div>
        </section>

        <section class="tk-form-section">
          <h4>الجهات المرتبطة بالمهمة</h4>
          <p class="tk-opt" style="margin:0 0 10px">يمكن ربط المهمة بفرع و/أو حاضنة و/أو منصة معًا. اترك الكل فارغًا لمهمة عامة.</p>
          <div class="tk-org-grid">
            <div class="field tk-org-field">
              <label>الفرع <span class="tk-opt">(اختياري)</span></label>
              <input id="tk-branch-q" data-tk-change="branchQ" type="search" placeholder="ابحث باسم الفرع أو رقمه…" />
              <select id="tk-branch-id"><option value="">— بدون فرع —</option></select>
            </div>
            <div class="field tk-org-field">
              <label>الحاضنة <span class="tk-opt">(اختياري)</span></label>
              <input id="tk-incubator-q" data-tk-change="incubatorQ" type="search" placeholder="ابحث باسم الحاضنة أو رقمها…" />
              <select id="tk-incubator-id"><option value="">— بدون حاضنة —</option></select>
            </div>
            <div class="field tk-org-field">
              <label>المنصة <span class="tk-opt">(اختياري)</span></label>
              <input id="tk-platform-q" data-tk-change="platformQ" type="search" placeholder="ابحث باسم المنصة أو رمزها…" />
              <select id="tk-platform-id"><option value="">— بدون منصة —</option></select>
            </div>
          </div>
        </section>

        <section class="tk-form-section">
          <h4>3) الأولوية والمواعيد</h4>
          <div class="tk-form-grid">
            <div class="field"><label>الأولوية <span class="tk-req">*</span></label>
              <select id="tk-priority">${['عاجل', 'عالي', 'متوسط', 'منخفض'].map((p) => `<option ${(item.priority || 'متوسط') === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
            </div>
            <div class="field"><label>الحالة <span class="tk-req">*</span></label>
              <select id="tk-status">${['todo', 'in_progress', 'blocked', 'done'].map((s) => `<option value="${s}" ${(item.status || 'todo') === s ? 'selected' : ''}>${statusTaskLabel(s)}</option>`).join('')}</select>
            </div>
            <div class="field"><label>تاريخ الاستحقاق <span class="tk-opt">(اختياري)</span></label><input id="tk-due" type="date" value="${K.esc(item.dueDate || '')}" /></div>
            <div class="field"><label>المصدر</label>
              <select id="tk-source">${['إدخال يدوي', 'Integration', 'Automation', 'Governance', 'System Generated'].map((s) => `<option value="${s}" ${(item.source || 'إدخال يدوي') === s ? 'selected' : ''}>${window.HubI18n?.label?.(s) || s}</option>`).join('')}</select>
            </div>
          </div>
        </section>

        <section class="tk-form-section">
          <h4>4) الوصف والتعليمات</h4>
          <div class="tk-form-grid">
            <div class="field full"><label>وصف المهمة وتفاصيلها <span class="tk-req">*</span></label><textarea id="tk-details" rows="4" placeholder="اشرح المطلوب بوضوح…">${K.esc(item.details || '')}</textarea></div>
            <div class="field full"><label>الملاحظات والتعليمات <span class="tk-opt">(اختياري)</span></label><textarea id="tk-notes" rows="3" placeholder="تعليمات إضافية للمكلّف…">${K.esc(item.notes || '')}</textarea></div>
          </div>
        </section>

        <section class="tk-form-section">
          <h4>5) مرفقات المهمة</h4>
          <p class="tk-opt" style="margin:0 0 8px">صور · مستندات · فيديو — حتى 1500 ميجابايت للملف عبر نظام الرفع الموحّد. لا يُعتبر الملف مرفوعًا إلا بعد اكتمال الحفظ على الخادم.</p>
          <input id="tk-files" type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt" />
          <div class="tk-att-list" id="tk-att-list">
            ${
              att.length
                ? att
                    .map(
                      (a, i) => `<div class="tk-att-row" data-att="${i}">
                        <span><b>${K.esc(a.name)}</b> · ${(Number(a.size || 0) / 1024 / 1024).toFixed(2)}MB · ${K.esc(a.kind || 'ملف')} · <span style="color:#166534">محفوظ</span></span>
                        <a href="${K.esc(a.url || '#')}" target="_blank" rel="noopener">فتح</a>
                        <button type="button" class="btn btn-sm btn-ghost" data-action="tk-att-remove" data-idx="${i}">حذف</button>
                      </div>`
                    )
                    .join('')
                : '<p class="tk-opt">لا مرفقات بعد.</p>'
            }
          </div>
        </section>
      </div>`;
  };

  const assigneePool = (type) => {
    const cat = tkUi.catalog || {};
    if (type === 'staff_naiosh') return cat.staffNaiosh || [];
    if (type === 'staff_external') return cat.staffExternal || [];
    if (type === 'customer') return cat.customers || [];
    if (type === 'company') return cat.companies || [];
    return [];
  };

  const fillAssigneeSelect = () => {
    const typeEl = document.getElementById('tk-assignee-type');
    const sel = document.getElementById('tk-assignee-id');
    const q = String(document.getElementById('tk-assignee-q')?.value || '')
      .trim()
      .toLowerCase();
    const hint = document.getElementById('tk-assignee-hint');
    const contactWrap = document.getElementById('tk-contact-wrap');
    if (!typeEl || !sel) return;
    const type = typeEl.value;
    const preferred =
      tkUi.modal?.data?.assignee?.id ||
      tkUi.modal?.data?.assigneeId ||
      sel.value ||
      '';
    let pool = assigneePool(type);
    if (q) {
      pool = pool.filter((p) => `${p.label || ''} ${p.name || ''} ${p.email || ''} ${p.employeeNo || ''}`.toLowerCase().includes(q));
    }
    if (!type) {
      sel.innerHTML = '<option value="">اختر نوع المسؤول أولًا ثم ابحث</option>';
      if (hint) hint.textContent = '';
      if (contactWrap) contactWrap.style.display = 'none';
      return;
    }
    if (!pool.length) {
      const notes = tkUi.catalog?.notes || {};
      sel.innerHTML = '<option value="">لا سجلات مطابقة في قاعدة البيانات</option>';
      if (hint) {
        hint.textContent =
          type === 'customer'
            ? notes.customers || 'لا عملاء مسجّلين.'
            : type === 'company'
              ? notes.companies || 'لا شركات مسجّلة عبر إداريين بجهة خارجية.'
              : 'لا نتائج.';
      }
    } else {
      sel.innerHTML = pool
        .slice(0, 80)
        .map(
          (p) =>
            `<option value="${Kit().esc(p.id)}" data-org="${Kit().esc(p.orgName || p.name || '')}" ${
              preferred && preferred === p.id ? 'selected' : ''
            }>${Kit().esc(p.label || p.name)}</option>`
        )
        .join('');
      if (hint) hint.textContent = `${pool.length} نتيجة من السجلات الحقيقية`;
    }
    if (contactWrap) contactWrap.style.display = type === 'company' ? '' : 'none';
    if (type === 'company') fillCompanyContacts();
  };

  const fillCompanyContacts = () => {
    const sel = document.getElementById('tk-assignee-id');
    const contact = document.getElementById('tk-contact-id');
    if (!sel || !contact) return;
    const orgId = sel.value;
    const company = (tkUi.catalog?.companies || []).find((c) => c.id === orgId);
    const contacts = company?.contacts || [];
    contact.innerHTML =
      '<option value="">— بدون تحديد —</option>' +
      contacts.map((c) => `<option value="${Kit().esc(c.id)}">${Kit().esc(c.name)} · ${Kit().esc(c.email)}</option>`).join('');
  };

  const preferredOrgId = (kind) => {
    const d = tkUi.modal?.data || {};
    if (kind === 'branch') return d.branchId || d.branch?.id || d.orgLinks?.branch?.id || '';
    if (kind === 'incubator') return d.incubatorId || d.incubator?.id || d.orgLinks?.incubator?.id || '';
    if (kind === 'platform') return d.platformId || d.platform?.id || d.orgLinks?.platform?.id || '';
    // legacy single-entity edit
    if (d.entity?.type === kind) return d.entity.id || '';
    return '';
  };

  const fillOrgSelect = (kind) => {
    const sel = document.getElementById(`tk-${kind}-id`);
    const qEl = document.getElementById(`tk-${kind}-q`);
    if (!sel) return;
    const q = String(qEl?.value || '')
      .trim()
      .toLowerCase();
    const preferred = preferredOrgId(kind) || sel.value || '';
    let pool = orgPool(kind);
    if (q) {
      pool = pool.filter((p) => `${p.name} ${p.id} ${p.num || ''}`.toLowerCase().includes(q));
    }
    const emptyLabel =
      kind === 'branch' ? '— بدون فرع —' : kind === 'incubator' ? '— بدون حاضنة —' : '— بدون منصة —';
    const opts = pool.slice(0, 200).map((p) => {
      const label = p.num && p.num !== p.name ? `${p.name} · ${p.num}` : p.name;
      return `<option value="${Kit().esc(p.id)}" data-name="${Kit().esc(p.name)}" ${
        preferred && preferred === p.id ? 'selected' : ''
      }>${Kit().esc(label)}</option>`;
    });
    sel.innerHTML = `<option value="">${emptyLabel}</option>` + (opts.join('') || '');
    if (preferred && ![...sel.options].some((o) => o.value === preferred)) {
      // keep previously saved id visible even if not in current filter
      const d = tkUi.modal?.data || {};
      const name =
        kind === 'branch'
          ? d.branch?.name || d.orgLinks?.branch?.name || preferred
          : kind === 'incubator'
            ? d.incubator?.name || d.orgLinks?.incubator?.name || preferred
            : d.platform?.name || d.orgLinks?.platform?.name || preferred;
      sel.insertAdjacentHTML(
        'beforeend',
        `<option value="${Kit().esc(preferred)}" data-name="${Kit().esc(name)}" selected>${Kit().esc(name)}</option>`
      );
    }
  };

  const fillOrgSelects = () => {
    fillOrgSelect('branch');
    fillOrgSelect('incubator');
    fillOrgSelect('platform');
  };

  const bindTaskFormWidgets = () => {
    // Widen modal
    document.querySelector('.hub-ws-modal')?.setAttribute('data-tk-wide', '1');
    const modal = document.querySelector('.hub-ws-modal');
    if (modal) modal.style.width = 'min(960px,96vw)';
    fillAssigneeSelect();
    fillOrgSelects();
    document.getElementById('tk-assignee-id')?.addEventListener('change', fillCompanyContacts);
    document.getElementById('tk-files')?.addEventListener('change', async (ev) => {
      const files = [...(ev.target.files || [])];
      if (!files.length) return;
      const list = document.getElementById('tk-att-list');
      for (const file of files) {
        const row = document.createElement('div');
        row.className = 'tk-att-row';
        row.innerHTML = `<span><b></b></span><div class="tk-att-bar"><i></i></div><span class="tk-att-status">جاري الرفع…</span>`;
        row.querySelector('b').textContent = file.name;
        list?.appendChild(row);
        const bar = row.querySelector('.tk-att-bar > i');
        const status = row.querySelector('.tk-att-status');
        try {
          const uploaded = await window.HubUploadLimits.uploadFile(file, {
            onProgress: (pct) => {
              if (bar) bar.style.width = `${pct}%`;
            },
          });
          const att = {
            id: uploaded.id || uploaded.attachment?.id || `up_${Date.now()}`,
            name: file.name,
            url: uploaded.url || uploaded.attachment?.url,
            size: file.size,
            mime: file.type,
            kind: (file.type || '').startsWith('image/')
              ? 'image'
              : (file.type || '').startsWith('video/')
                ? 'video'
                : 'document',
            uploadedAt: new Date().toISOString(),
          };
          if (!att.url) throw new Error('لم يُرجع الخادم رابط المرفق');
          tkUi.pendingAttachments.push(att);
          status.textContent = 'محفوظ';
          status.style.color = '#166534';
          if (bar) bar.style.width = '100%';
        } catch (err) {
          status.textContent = err.message || 'فشل الرفع';
          status.style.color = '#991b1b';
          const retry = document.createElement('button');
          retry.type = 'button';
          retry.className = 'btn btn-sm btn-ghost';
          retry.textContent = 'إعادة المحاولة';
          retry.onclick = () => {
            const dt = new DataTransfer();
            dt.items.add(file);
            const input = document.getElementById('tk-files');
            if (input) {
              input.files = dt.files;
              input.dispatchEvent(new Event('change'));
            }
            row.remove();
          };
          row.appendChild(retry);
        }
      }
      ev.target.value = '';
    });
  };

  const readTaskForm = () => {
    const K = Kit();
    const assigneeType = K.qVal('tk-assignee-type');
    const assigneeId = K.qVal('tk-assignee-id');
    const assigneeOpt = document.getElementById('tk-assignee-id')?.selectedOptions?.[0];
    const branchOpt = document.getElementById('tk-branch-id')?.selectedOptions?.[0];
    const incubatorOpt = document.getElementById('tk-incubator-id')?.selectedOptions?.[0];
    const platformOpt = document.getElementById('tk-platform-id')?.selectedOptions?.[0];
    const branchId = K.qVal('tk-branch-id');
    const incubatorId = K.qVal('tk-incubator-id');
    const platformId = K.qVal('tk-platform-id');
    return {
      title: K.qVal('tk-title'),
      details: K.qVal('tk-details'),
      notes: K.qVal('tk-notes'),
      taskType: K.qVal('tk-task-type') || 'operational',
      project: K.qVal('tk-project'),
      priority: K.qVal('tk-priority') || 'متوسط',
      status: K.qVal('tk-status') || 'todo',
      dueDate: K.qVal('tk-due'),
      source: K.qVal('tk-source') || 'إدخال يدوي',
      assigneeType,
      assigneeId,
      companyName: assigneeOpt?.getAttribute('data-org') || assigneeOpt?.textContent || '',
      contactPersonId: K.qVal('tk-contact-id'),
      branchId,
      branchName: branchId ? branchOpt?.getAttribute('data-name') || branchOpt?.textContent || '' : '',
      incubatorId,
      incubatorName: incubatorId
        ? incubatorOpt?.getAttribute('data-name') || incubatorOpt?.textContent || ''
        : '',
      platformId,
      platformName: platformId
        ? platformOpt?.getAttribute('data-name') || platformOpt?.textContent || ''
        : '',
      attachments: tkUi.pendingAttachments.slice(),
      assignee: assigneeOpt?.textContent || '',
    };
  };

  const renderTasks = (ctx = {}) => {
    const { user } = ctx;
    const K = Kit();
    ensureTasksLoaded();
    const bag = store().get().tasks || { items: [], auditLog: [], settings: {} };
    const items = tkUi.serverItems || bag.items || [];
    const filtered = filterTasks(items);
    const pg = K.paginate(filtered, tkUi.page, tkUi.pageSize);
    tkUi.page = pg.page;
    const blocked = items.filter((t) => t.status === 'blocked').length;
    const todo = items.filter((t) => t.status === 'todo').length;
    const done = items.filter((t) => t.status === 'done').length;
    const needs = items
      .filter((t) => t.status === 'blocked' || (t.dueDate && t.status !== 'done' && t.dueDate < new Date().toISOString().slice(0, 10)))
      .slice(0, 8)
      .map((t) => ({ text: `${t.status === 'blocked' ? 'مختنق' : 'متأخر'}: ${t.title}`, tab: 'list', id: t.id }));

    const kpis = [
      { key: 'total', label: 'إجمالي', value: items.length, tab: 'list' },
      { key: 'todo', label: 'معلّقة', value: todo, tab: 'list' },
      { key: 'blocked', label: 'مختنق', value: blocked, tab: 'list' },
      { key: 'done', label: 'مكتملة', value: done, tab: 'list' },
      { key: 'needs', label: 'يتطلب إجراء', value: needs.length, tab: 'list' },
    ];

    let body = '';
    if (tkUi.tab === 'list') {
      body = `
        ${K.renderNeeds('tk', needs)}
        <article class="card" style="margin-top:12px">
          <div class="toolbar" style="flex-wrap:wrap">
            <div class="field"><label>بحث</label><input data-tk-change="q" value="${K.esc(tkUi.filters.q)}" placeholder="عنوان / تفاصيل / مسؤول" /></div>
            <div class="field"><label>الحالة</label>
              <select data-tk-change="status"><option value="">الكل</option>
                ${['todo', 'in_progress', 'blocked', 'done'].map((s) => `<option value="${s}" ${tkUi.filters.status === s ? 'selected' : ''}>${statusTaskLabel(s)}</option>`).join('')}
              </select>
            </div>
            <div class="field"><label>الأولوية</label>
              <select data-tk-change="priority"><option value="">الكل</option>
                ${['عاجل', 'عالي', 'متوسط', 'منخفض'].map((p) => `<option ${tkUi.filters.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>
            <button type="button" class="btn btn-primary" data-action="tk-create"><i class="fas fa-plus"></i> مهمة جديدة</button>
          </div>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>رقم المهمة</th><th>المهمة</th><th>المسؤول</th><th>الفرع / الحاضنة / المنصة</th><th>الأولوية</th><th>الحالة</th><th>الموعد</th><th>مرفقات</th><th>إجراءات</th></tr></thead>
            <tbody>${
              pg.rows.length
                ? pg.rows
                    .map(
                      (t) => `<tr>
                        <td dir="ltr"><code>${K.esc(t.taskNo || t.id)}</code></td>
                        <td><strong>${K.esc(t.title)}</strong><br/><small>${K.esc((t.details || '').slice(0, 80))}</small></td>
                        <td>${K.esc(t.assigneeLabel || t.assignee?.name || t.assignee || '—')}<br/><small>${K.esc(t.assignee?.typeLabel || '')}</small></td>
                        <td>${K.esc(t.entityLabel || '—')}</td>
                        <td>${K.badge(t.priority, t.priority === 'عاجل' ? 'badge-red' : 'badge-outline')}</td>
                        <td>${statusTaskBadge(t.status)}</td>
                        <td>${K.esc(t.dueDate || '—')}</td>
                        <td>${Array.isArray(t.attachments) ? t.attachments.length : 0}</td>
                        <td class="toolbar" style="margin:0;gap:4px;flex-wrap:wrap">
                          <button type="button" class="btn btn-sm btn-ghost" data-action="tk-open" data-id="${t.id}">عرض</button>
                          <button type="button" class="btn btn-sm btn-dark" data-action="tk-edit" data-id="${t.id}">تعديل</button>
                          ${t.status !== 'done' ? `<button type="button" class="btn btn-sm btn-primary" data-action="tk-status" data-id="${t.id}" data-status="done">إتمام</button>` : ''}
                          ${t.status !== 'blocked' && t.status !== 'done' ? `<button type="button" class="btn btn-sm btn-ghost" data-action="tk-status" data-id="${t.id}" data-status="blocked">اختناق</button>` : ''}
                          <button type="button" class="btn btn-sm btn-ghost" data-action="tk-delete" data-id="${t.id}">حذف</button>
                        </td>
                      </tr>`
                    )
                    .join('')
                : `<tr><td colspan="9" class="empty">${tkUi.loading ? 'جاري تحميل المهام من الخادم…' : 'لا مهام مطابقة — أنشئ مهمة جديدة'}</td></tr>`
            }</tbody>
          </table></div>
          ${K.renderPager('tk', pg.page, pg.pages, pg.total)}
        </article>`;
    } else if (tkUi.tab === 'board') {
      const cols = ['todo', 'in_progress', 'blocked', 'done'];
      body = `<div class="grid-2" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">${cols
        .map((st) => {
          const list = items.filter((t) => t.status === st).slice(0, 8);
          return `<article class="card"><h3>${statusTaskLabel(st)} · ${list.length}</h3>
            ${list.map((t) => `<div style="border:1px solid var(--border);border-radius:8px;padding:8px;margin-bottom:6px">
              <b>${K.esc(t.title)}</b><br/><small>${K.esc(t.assigneeLabel || t.assignee?.name || '')}</small>
              <div class="toolbar" style="margin-top:6px"><button type="button" class="btn btn-sm btn-ghost" data-action="tk-open" data-id="${t.id}">فتح</button></div>
            </div>`).join('') || '<p class="empty">—</p>'}
          </article>`;
        })
        .join('')}</div>`;
    } else if (tkUi.tab === 'audit') {
      const auditRows = (tkUi.serverAudit || []).length
        ? tkUi.serverAudit.map((a) => ({
            at: a.at,
            action: a.action,
            detail: a.detail,
            by: a.actorEmail,
            source: 'TASKS',
          }))
        : bag.auditLog || [];
      body = `<article class="card">${K.renderAuditTable(auditRows)}</article>`;
    } else {
      body = `<article class="card"><p>المهام تُحفظ على الخادم مع رقم فريد ومسؤول وجهة ومرفقات. حجم الصفحة: ${tkUi.pageSize}.</p></article>`;
    }

    const modal = tkUi.modal
      ? K.renderModal('tk', {
          title: tkUi.editId ? 'تعديل مهمة' : 'مهمة جديدة',
          bodyHtml: taskFormHtml(tkUi.modal.data || {}),
          footerHtml: `<button type="button" class="btn btn-ghost" data-action="tk-modal-close">إلغاء</button>
            <button type="button" class="btn btn-primary" data-action="tk-save">حفظ المهمة</button>`,
        })
      : '';

    const drawer = tkUi.drawer
      ? K.renderDrawer('tk', {
          title: tkUi.drawer.title || 'تفاصيل المهمة',
          bodyHtml: tkUi.drawer.bodyHtml,
        })
      : '';

    // Bind form widgets after paint
    if (tkUi.modal) setTimeout(() => bindTaskFormWidgets(), 0);

    return `<div class="hub-ops-ws hub-tasks-ws">
      ${K.renderHeader({
        prefix: 'tk',
        title: 'إدارة المهام',
        subtitle: 'مسؤولون حقيقيون · جهات تنظيمية · مرفقات · إشعارات · تدقيق على الخادم',
        icon: 'fa-clipboard-list',
        actionsHtml: `
          <button type="button" class="btn btn-primary btn-sm" data-action="tk-create"><i class="fas fa-plus"></i> مهمة جديدة</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="tk-help-open"><i class="fas fa-circle-question"></i></button>`,
      })}
      ${K.renderKpis('tk', kpis, tkUi.kpiFocus)}
      ${K.renderTabs('tk', TK_TABS, tkUi.tab)}
      ${body}
      ${K.renderHelp('tk', {
        title: 'دليل المهام',
        dismissed: !!bag.settings?.helpDismissed,
        open: tkUi.helpOpen,
        bodyHtml: `<p>اختر نوع المسؤول من السجلات الحقيقية، واربط المهمة بفرع و/أو حاضنة و/أو منصة معًا (أو اتركها عامة)، وارفع المرفقات عبر نظام الرفع الموحّد (حتى 1500MB). الإسناد لا يمنح دخولًا للوحة الإدارة.</p>`,
      })}
      ${modal}${drawer}
    </div>`;
  };

  const handleTasks = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const K = Kit();
    const actor = K.actorName(user);
    if (action === 'tk-tab') {
      tkUi.tab = btn.dataset.tab || 'list';
      return true;
    }
    if (action === 'tk-kpi') {
      tkUi.kpiFocus = btn.dataset.key === 'total' || btn.dataset.key === 'needs' ? '' : btn.dataset.key || '';
      if (btn.dataset.tab) tkUi.tab = btn.dataset.tab;
      tkUi.page = 1;
      return true;
    }
    if (action === 'tk-page') {
      tkUi.page = Number(btn.dataset.page) || 1;
      return true;
    }
    if (action === 'tk-create') {
      tkUi.editId = null;
      tkUi.pendingAttachments = [];
      tkUi.modal = {
        data: {
          priority: 'متوسط',
          status: 'todo',
          source: 'إدخال يدوي',
          taskType: 'operational',
          branchId: '',
          incubatorId: '',
          platformId: '',
        },
      };
      if (!tkUi.catalog) {
        fetch('/api/hub/tasks/catalog', { credentials: 'same-origin', headers: tkAuthHeaders() })
          .then((r) => r.json())
          .then((d) => {
            if (d?.ok) {
              tkUi.catalog = d.catalog;
              tkRefreshDash();
            }
          })
          .catch(() => null);
      }
      return true;
    }
    if (action === 'tk-edit') {
      const item = (tkUi.serverItems || store().get().tasks.items || []).find((x) => x.id === btn.dataset.id);
      if (!item) {
        toast?.('المهمة غير موجودة');
        return true;
      }
      tkUi.editId = item.id;
      tkUi.pendingAttachments = Array.isArray(item.attachments) ? item.attachments.slice() : [];
      tkUi.modal = { data: { ...item } };
      return true;
    }
    if (action === 'tk-open') {
      const item = (tkUi.serverItems || store().get().tasks.items || []).find((x) => x.id === btn.dataset.id);
      if (!item) return true;
      const atts = Array.isArray(item.attachments) ? item.attachments : [];
      const comments = Array.isArray(item.comments) ? item.comments : [];
      tkUi.drawer = {
        title: `${item.taskNo || ''} · ${item.title}`,
        bodyHtml: `
          <p><b>رقم المهمة:</b> <code dir="ltr">${K.esc(item.taskNo || item.id)}</code></p>
          <p>${K.esc(item.details || '—')}</p>
          ${item.notes ? `<p><b>تعليمات:</b> ${K.esc(item.notes)}</p>` : ''}
          <p><b>المسؤول:</b> ${K.esc(item.assigneeLabel || item.assignee?.name || '—')} (${K.esc(item.assignee?.typeLabel || '—')})</p>
          <p><b>الفرع:</b> ${K.esc(item.branch?.name || item.orgLinks?.branch?.name || item.branchId || '—')}</p>
          <p><b>الحاضنة:</b> ${K.esc(item.incubator?.name || item.orgLinks?.incubator?.name || item.incubatorId || '—')}</p>
          <p><b>المنصة:</b> ${K.esc(item.platform?.name || item.orgLinks?.platform?.name || item.platformId || '—')}</p>
          <p><b>الحالة:</b> ${statusTaskLabel(item.status)} · <b>الأولوية:</b> ${K.esc(item.priority || '—')}</p>
          <p><b>الموعد:</b> ${K.esc(item.dueDate || '—')} · <b>المنشئ:</b> ${K.esc(item.createdBy?.name || item.createdBy?.email || '—')}</p>
          <p><b>أُنشئت:</b> ${K.fmtTime(item.createdAt)} · <b>حدّثت:</b> ${K.fmtTime(item.updatedAt)}</p>
          <h4 style="margin:12px 0 6px">المرفقات (${atts.length})</h4>
          ${
            atts.length
              ? `<ul>${atts.map((a) => `<li><a href="${K.esc(a.url)}" target="_blank" rel="noopener">${K.esc(a.name)}</a> · ${(Number(a.size || 0) / 1024 / 1024).toFixed(2)}MB</li>`).join('')}</ul>`
              : '<p class="empty">لا مرفقات</p>'
          }
          <h4 style="margin:12px 0 6px">التحديثات</h4>
          ${
            comments.length
              ? comments
                  .map((c) => `<div style="border:1px solid var(--border);border-radius:8px;padding:8px;margin-bottom:6px"><small>${K.esc(c.by?.name || '')} · ${K.fmtTime(c.at)}</small><div>${K.esc(c.text)}</div></div>`)
                  .join('')
              : '<p class="empty">لا تحديثات بعد</p>'
          }
          <div class="field" style="margin-top:10px"><label>إضافة تحديث</label><textarea id="tk-comment" rows="2"></textarea>
            <button type="button" class="btn btn-sm btn-primary" data-action="tk-comment" data-id="${item.id}" style="margin-top:6px">إرسال</button>
          </div>
          <div class="toolbar" style="margin-top:12px">
            <button type="button" class="btn btn-dark" data-action="tk-edit" data-id="${item.id}">تعديل</button>
            ${item.status !== 'done' ? `<button type="button" class="btn btn-primary" data-action="tk-status" data-id="${item.id}" data-status="done">إتمام</button>` : ''}
            ${item.status !== 'blocked' && item.status !== 'done' ? `<button type="button" class="btn btn-ghost" data-action="tk-status" data-id="${item.id}" data-status="blocked">إيقاف / اختناق</button>` : ''}
          </div>`,
      };
      return true;
    }
    if (action === 'tk-modal-close' || action === 'tk-drawer-close') {
      if (action === 'tk-modal-close') {
        tkUi.modal = null;
        tkUi.pendingAttachments = [];
      }
      if (action === 'tk-drawer-close') tkUi.drawer = null;
      return true;
    }
    if (action === 'tk-att-remove') {
      const idx = Number(btn.dataset.idx);
      if (Number.isFinite(idx)) {
        tkUi.pendingAttachments.splice(idx, 1);
        if (tkUi.modal) tkUi.modal = { data: { ...(tkUi.modal.data || {}), attachments: tkUi.pendingAttachments.slice() } };
      }
      return true;
    }
    if (action === 'tk-save') {
      const data = readTaskForm();
      if (!data.title) {
        toast?.('عنوان المهمة مطلوب');
        return true;
      }
      if (!data.details) {
        toast?.('وصف المهمة مطلوب');
        return true;
      }
      if (!data.assigneeType || !data.assigneeId) {
        toast?.('اختر نوع المسؤول والمسؤول من قاعدة البيانات');
        return true;
      }
      toast?.('جاري حفظ المهمة على الخادم…');
      const url = tkUi.editId ? `/api/hub/tasks/${encodeURIComponent(tkUi.editId)}` : '/api/hub/tasks';
      const method = tkUi.editId ? 'PATCH' : 'POST';
      fetch(url, {
        method,
        credentials: 'same-origin',
        headers: tkAuthHeaders(),
        body: JSON.stringify(data),
      })
        .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
        .then(({ ok, j }) => {
          if (!ok || j?.ok === false) throw new Error(j?.error || 'فشل الحفظ');
          toast?.(j.message || (tkUi.editId ? 'تم تحديث المهمة' : `تم إنشاء المهمة ${j.task?.taskNo || ''}`));
          if (j.task) {
            const list = Array.isArray(tkUi.serverItems) ? tkUi.serverItems.slice() : [];
            const idx = list.findIndex((x) => x.id === j.task.id);
            if (idx >= 0) list[idx] = j.task;
            else list.unshift(j.task);
            tkUi.serverItems = list;
          }
          tkUi.modal = null;
          tkUi.editId = null;
          tkUi.pendingAttachments = [];
          tkUi.loaded = false;
          ensureTasksLoaded();
          tkRefreshDash();
        })
        .catch((err) => toast?.(err.message || 'تعذر الحفظ'));
      return true;
    }
    if (action === 'tk-status') {
      fetch(`/api/hub/tasks/${encodeURIComponent(btn.dataset.id)}/status`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: tkAuthHeaders(),
        body: JSON.stringify({ status: btn.dataset.status }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (!j?.ok) throw new Error(j?.error || 'فشل التحديث');
          toast?.('تحدّثت حالة المهمة');
          tkUi.loaded = false;
          ensureTasksLoaded();
          tkRefreshDash();
        })
        .catch((err) => toast?.(err.message));
      return true;
    }
    if (action === 'tk-comment') {
      const text = document.getElementById('tk-comment')?.value || '';
      fetch(`/api/hub/tasks/${encodeURIComponent(btn.dataset.id)}/comments`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: tkAuthHeaders(),
        body: JSON.stringify({ text }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (!j?.ok) throw new Error(j?.error || 'فشل');
          toast?.('تم إضافة التحديث');
          tkUi.loaded = false;
          ensureTasksLoaded();
          // reopen drawer with fresh data after load
          setTimeout(() => {
            const item = (tkUi.serverItems || []).find((x) => x.id === btn.dataset.id);
            if (item) {
              const fakeBtn = { dataset: { id: item.id } };
              handleTasks('tk-open', fakeBtn, ctx);
              tkRefreshDash();
            }
          }, 400);
        })
        .catch((err) => toast?.(err.message));
      return true;
    }
    if (action === 'tk-delete') {
      if (!confirm('حذف هذه المهمة؟')) return true;
      fetch(`/api/hub/tasks/${encodeURIComponent(btn.dataset.id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: tkAuthHeaders(),
      })
        .then((r) => r.json())
        .then((j) => {
          if (!j?.ok) throw new Error(j?.error || 'فشل الحذف');
          toast?.('حُذفت المهمة');
          tkUi.drawer = null;
          tkUi.loaded = false;
          ensureTasksLoaded();
          tkRefreshDash();
        })
        .catch((err) => toast?.(err.message));
      return true;
    }
    if (action === 'tk-help-open') {
      tkUi.helpOpen = true;
      return true;
    }
    if (action === 'tk-help-dismiss') {
      store().dismissTasksHelp?.();
      tkUi.helpOpen = false;
      return true;
    }
    return false;
  };

  const handleTasksChange = (el) => {
    const key = el.getAttribute('data-tk-change');
    if (!key) return false;
    if (key === 'assigneeType' || key === 'assigneeQ') {
      fillAssigneeSelect();
      return false; // don't full re-render (keeps modal state)
    }
    if (key === 'branchQ') {
      fillOrgSelect('branch');
      return false;
    }
    if (key === 'incubatorQ') {
      fillOrgSelect('incubator');
      return false;
    }
    if (key === 'platformQ') {
      fillOrgSelect('platform');
      return false;
    }
    tkUi.filters[key] = el.type === 'checkbox' ? el.checked : el.value;
    tkUi.page = 1;
    return true;
  };

  /* ───────── Measurement ───────── */
  const msUi = { tab: 'scores', helpOpen: false, modal: null, editId: null };
  const MS_TABS = [
    { id: 'scores', label: 'الدرجات', icon: 'fa-star' },
    { id: 'indicators', label: 'المؤشرات', icon: 'fa-sliders' },
    { id: 'matrix', label: 'المصفوفة', icon: 'fa-border-all' },
    { id: 'clients', label: 'أثر العملاء', icon: 'fa-handshake' },
    { id: 'audit', label: 'سجل العمليات', icon: 'fa-clock-rotate-left' },
  ];

  const renderMeasurement = () => {
    const K = Kit();
    const m = store().get().measurement || {};
    const needs = (m.scores || [])
      .filter((r) => (r.score || 0) < 70)
      .map((r) => ({ text: `درجة منخفضة: ${r.entity} (${r.score})`, tab: 'scores' }));

    const kpis = [
      { key: 'avg', label: 'متوسط الدرجات', value: Math.round((m.scores || []).reduce((a, b) => a + (b.score || 0), 0) / Math.max(1, (m.scores || []).length)), tab: 'scores' },
      { key: 'inds', label: 'المؤشرات', value: (m.indicators || []).length, tab: 'indicators' },
      { key: 'needs', label: 'يتطلب إجراء', value: needs.length, tab: 'scores' },
    ];

    let body = '';
    if (msUi.tab === 'scores') {
      const avg = Math.round((m.scores || []).reduce((a, b) => a + (b.score || 0), 0) / Math.max(1, (m.scores || []).length));
      const low = (m.scores || []).filter((r) => (r.score || 0) < 70);
      body = `${K.renderNeeds('ms', needs)}
        <div class="hub-op-rail">
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-calculator icon"></i> غرفة القياس</span></h3>
            <p class="muted">كل درجة مصدرها محرك القياس · إعادة الحساب تُحدّث القيم وتُسجَّل في سجل التدقيق</p>
            <div class="hub-op-pulse">
              <div><span>متوسط الدرجات</span><strong>${avg}</strong>${K.bar(avg)}</div>
              <div><span>درجات منخفضة</span><strong>${low.length}</strong>${K.bar(Math.min(100, low.length * 25))}</div>
              <div><span>المؤشرات</span><strong>${(m.indicators || []).length}</strong>${K.bar(Math.min(100, (m.indicators || []).length * 20))}</div>
            </div>
            <div class="toolbar" style="margin-top:10px;flex-wrap:wrap">
              <button type="button" class="btn btn-primary" data-action="ms-recalc"><i class="fas fa-calculator"></i> إعادة حساب</button>
              <button type="button" class="btn btn-dark" data-action="ms-tab" data-tab="indicators">المؤشرات</button>
              <button type="button" class="btn btn-ghost" data-action="ms-tab" data-tab="matrix">المصفوفة</button>
            </div>
          </article>
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-triangle-exclamation icon"></i> تحت العتبة (&lt;70)</span></h3>
            <ul class="hub-op-mini-list">${
              low
                .slice(0, 6)
                .map((r) => `<li><b>${K.esc(r.entity)}</b><small>${r.score} · ${K.esc(r.level || '')}</small>${K.badge('منخفض', 'badge-red')}</li>`)
                .join('') || '<li class="empty">لا درجات منخفضة — القياس مستقر</li>'
            }</ul>
          </article>
        </div>
        <div class="hub-op-grid3">
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-star icon"></i> درجات المجالات</span></h3>
            ${(m.scores || [])
              .map(
                (row) => `<div style="margin-bottom:12px">
                  <div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px">
                    <span>${K.esc(row.entity)}</span><span>${row.score} · ${K.badge(row.level, 'badge-black')}</span>
                  </div>${K.bar(row.score)}
                  <small class="muted">المصدر: محرك القياس · الصيغة: تجميع المجال</small>
                </div>`
              )
              .join('') || '<p class="empty">لا درجات بعد — اضغط إعادة حساب</p>'}
          </article>
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-sliders icon"></i> مؤشرات سريعة</span>
              <button type="button" class="btn btn-sm btn-ghost" data-action="ms-tab" data-tab="indicators">الكل</button></h3>
            <ul class="hub-op-mini-list">${
              (m.indicators || [])
                .slice(0, 5)
                .map((i) => `<li><b>${K.esc(i.name)}</b><small><code>${K.esc(i.formula)}</code> · ${i.value}</small>${K.sourceBadge(i.source)}</li>`)
                .join('') || '<li class="empty">لا مؤشرات</li>'
            }</ul>
            <div class="toolbar" style="margin-top:8px"><button type="button" class="btn btn-sm btn-primary" data-action="ms-ind-create"><i class="fas fa-plus"></i> مؤشر</button></div>
          </article>
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-handshake icon"></i> أثر العملاء</span>
              <button type="button" class="btn btn-sm btn-ghost" data-action="ms-tab" data-tab="clients">الكل</button></h3>
            <ul class="hub-op-mini-list">${
              (m.clientImpact || [])
                .slice(0, 5)
                .map(
                  (c) =>
                    `<li><b>${K.esc(c.client)}</b><small>${c.impact}%</small>${c.trend === 'up' ? K.badge('صاعد', 'badge-black') : K.badge('هابط', 'badge-red')}</li>`
                )
                .join('') || '<li class="empty">لا بيانات أثر</li>'
            }</ul>
          </article>
        </div>`;
    } else if (msUi.tab === 'indicators') {
      body = `<article class="card">
        <div class="toolbar"><button type="button" class="btn btn-primary" data-action="ms-ind-create"><i class="fas fa-plus"></i> مؤشر</button>
          <button type="button" class="btn btn-dark" data-action="ms-recalc">مزامنة القيم</button></div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>المؤشر</th><th>الصيغة</th><th>القيمة</th><th>المصدر</th><th>المالك</th><th></th></tr></thead>
          <tbody>${
            (m.indicators || [])
              .map(
                (i) => `<tr>
                  <td>${K.esc(i.name)}</td><td><code>${K.esc(i.formula)}</code></td>
                  <td>${i.value}</td><td>${K.sourceBadge(i.source)}</td><td>${K.esc(i.owner || '—')}</td>
                  <td><button type="button" class="btn btn-sm btn-ghost" data-action="ms-ind-edit" data-id="${i.id}">تعديل</button></td>
                </tr>`
              )
              .join('') || '<tr><td colspan="6" class="empty">لا مؤشرات</td></tr>'
          }</tbody>
        </table></div>
      </article>`;
    } else if (msUi.tab === 'matrix') {
      body = `<article class="card">${(m.matrix || [])
        .map(
          (x) => `<div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700"><span>${K.esc(x.axis)}</span><span>${x.value}</span></div>
            ${K.bar(x.value)}</div>`
        )
        .join('')}</article>`;
    } else if (msUi.tab === 'clients') {
      body = `<article class="card"><div class="table-wrap"><table class="data">
        <thead><tr><th>العميل</th><th>الأثر</th><th>الاتجاه</th></tr></thead>
        <tbody>${(m.clientImpact || [])
          .map(
            (c) => `<tr>
              <td>${K.esc(c.client)}</td><td>${c.impact}% ${K.bar(c.impact)}</td>
              <td>${c.trend === 'up' ? K.badge('صاعد', 'badge-black') : K.badge('هابط', 'badge-red')}</td>
            </tr>`
          )
          .join('')}</tbody></table></div></article>`;
    } else {
      body = `<article class="card">${K.renderAuditTable(m.auditLog || [])}</article>`;
    }

    const modal = msUi.modal
      ? K.renderModal('ms', {
          title: msUi.editId ? 'تعديل مؤشر' : 'مؤشر جديد',
          bodyHtml: `
            <div class="field"><label>الاسم *</label><input id="ms-name" value="${K.esc(msUi.modal.data?.name || '')}" /></div>
            <div class="field"><label>الصيغة</label><input id="ms-formula" value="${K.esc(msUi.modal.data?.formula || '')}" placeholder="done_tasks / total_tasks * 100" /></div>
            <div class="field"><label>المصدر</label><input id="ms-source" value="${K.esc(msUi.modal.data?.source || 'إدخال يدوي')}" /></div>
            <div class="field"><label>القيمة</label><input id="ms-value" type="number" value="${K.esc(String(msUi.modal.data?.value ?? 0))}" /></div>
            <div class="field"><label>المالك</label><input id="ms-owner" value="${K.esc(msUi.modal.data?.owner || '')}" /></div>`,
          footerHtml: `<button type="button" class="btn btn-ghost" data-action="ms-modal-close">إلغاء</button>
            <button type="button" class="btn btn-primary" data-action="ms-ind-save">حفظ</button>`,
        })
      : '';

    return `<div class="hub-ops-ws hub-measurement-ws">
      ${K.renderHeader({
        prefix: 'ms',
        title: 'القياس الموحّد',
        subtitle: 'درجات · مؤشرات بصيغة ومصدر · إعادة حساب موثّقة',
        icon: 'fa-chart-simple',
        actionsHtml: `<button type="button" class="btn btn-primary btn-sm" data-action="ms-recalc"><i class="fas fa-calculator"></i> إعادة حساب</button>`,
      })}
      ${K.renderKpis('ms', kpis, '')}
      ${K.renderTabs('ms', MS_TABS, msUi.tab)}
      ${body}
      ${K.renderHelp('ms', {
        title: 'دليل القياس',
        dismissed: !!m.settings?.helpDismissed,
        open: msUi.helpOpen,
        bodyHtml: `<p>كل درجة لها مصدر. المؤشرات تحمل صيغة صريحة. إعادة الحساب تُحدّث القيم وتُسجَّل في سجل التدقيق.</p>`,
      })}
      ${modal}
    </div>`;
  };

  const handleMeasurement = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const K = Kit();
    if (action === 'ms-tab') {
      msUi.tab = btn.dataset.tab || 'scores';
      return true;
    }
    if (action === 'ms-kpi') {
      if (btn.dataset.tab) msUi.tab = btn.dataset.tab;
      return true;
    }
    if (action === 'ms-recalc') {
      store().recalculateMeasurement?.();
      toast?.('أُعيد حساب الدرجات');
      return true;
    }
    if (action === 'ms-ind-create') {
      msUi.editId = null;
      msUi.modal = { data: { source: 'إدخال يدوي', value: 0 } };
      return true;
    }
    if (action === 'ms-ind-edit') {
      const row = (store().get().measurement.indicators || []).find((x) => x.id === btn.dataset.id);
      if (!row) return true;
      msUi.editId = row.id;
      msUi.modal = { data: { ...row } };
      return true;
    }
    if (action === 'ms-modal-close') {
      msUi.modal = null;
      return true;
    }
    if (action === 'ms-ind-save') {
      const payload = {
        name: K.qVal('ms-name'),
        formula: K.qVal('ms-formula'),
        source: K.qVal('ms-source'),
        value: Number(K.qVal('ms-value')) || 0,
        owner: K.qVal('ms-owner') || K.actorName(user),
      };
      if (!payload.name) {
        toast?.('اسم المؤشر مطلوب');
        return true;
      }
      if (msUi.editId) store().updateMeasurementIndicator?.(msUi.editId, payload, K.actorName(user));
      else store().addMeasurementIndicator?.(payload, K.actorName(user));
      msUi.modal = null;
      toast?.('تم حفظ المؤشر');
      return true;
    }
    if (action === 'ms-help-open') {
      msUi.helpOpen = true;
      return true;
    }
    if (action === 'ms-help-dismiss') {
      const m = store().get().measurement;
      m.settings = m.settings || {};
      m.settings.helpDismissed = true;
      msUi.helpOpen = false;
      store().save?.();
      return true;
    }
    return false;
  };

  /* ───────── Reports ───────── */
  const rpUi = { tab: 'generated', type: 'daily', helpOpen: false, drawer: null };
  const RP_TABS = [
    { id: 'generated', label: 'المُولَّدة', icon: 'fa-scroll' },
    { id: 'schedule', label: 'الجدول', icon: 'fa-calendar' },
    { id: 'audit', label: 'سجل العمليات', icon: 'fa-clock-rotate-left' },
  ];

  const renderReports = () => {
    const K = Kit();
    const r = store().get().reports || { generated: [], schedule: [] };
    const titles = store().REPORT_TITLES || {};
    const types = Object.keys(titles);
    const needs = !(r.generated || []).length ? [{ text: 'لا تقارير بعد — ولّد تقريرًا', tab: 'generated' }] : [];

    const kpis = [
      { key: 'count', label: 'تقارير جاهزة', value: (r.generated || []).length, tab: 'generated' },
      { key: 'sched', label: 'جداول', value: (r.schedule || []).length, tab: 'schedule' },
      { key: 'needs', label: 'يتطلب إجراء', value: needs.length, tab: 'generated' },
    ];

    let body = '';
    if (rpUi.tab === 'generated') {
      const latest = (r.generated || []).slice(0, 8);
      const byType = types.reduce((acc, t) => {
        acc[t] = (r.generated || []).filter((g) => g.type === t).length;
        return acc;
      }, {});
      body = `${K.renderNeeds('rp', needs)}
        <div class="hub-op-rail">
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-file-lines icon"></i> توليد تقرير</span></h3>
            <p class="muted">اختر النوع ثم ولّد — كل تقرير يُحفظ مع المصدر ويُصدَّر JSON</p>
            <div class="tabs" style="margin:8px 0;flex-wrap:wrap">${types
              .map(
                (t) =>
                  `<button type="button" class="tab ${rpUi.type === t ? 'active' : ''}" data-action="rp-type" data-type="${t}">${K.esc(titles[t])} <small>(${byType[t] || 0})</small></button>`
              )
              .join('')}</div>
            <div class="toolbar" style="flex-wrap:wrap">
              <button type="button" class="btn btn-primary" data-action="rp-gen" data-type="${rpUi.type}"><i class="fas fa-file-lines"></i> توليد ${K.esc(titles[rpUi.type] || '')}</button>
              <button type="button" class="btn btn-dark" data-action="rp-tab" data-tab="schedule">الجدول الزمني</button>
              <button type="button" class="btn btn-ghost" data-action="rp-tab" data-tab="audit">سجل العمليات</button>
            </div>
          </article>
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-gauge-high icon"></i> نبض التقارير</span></h3>
            <div class="hub-op-pulse">
              <div><span>تقارير جاهزة</span><strong>${(r.generated || []).length}</strong>${K.bar(Math.min(100, (r.generated || []).length * 12))}</div>
              <div><span>جداول مجدولة</span><strong>${(r.schedule || []).length}</strong>${K.bar(Math.min(100, (r.schedule || []).length * 15))}</div>
              <div><span>النوع الحالي</span><strong>${K.esc(titles[rpUi.type] || rpUi.type)}</strong>${K.bar(Math.min(100, (byType[rpUi.type] || 0) * 20))}</div>
            </div>
            <ul class="hub-op-mini-list" style="margin-top:10px">${
              (r.schedule || [])
                .slice(0, 4)
                .map((s) => `<li><b>${K.esc(s.label)}</b><small>التالي: ${K.esc(s.next)}</small>${K.badge('جدول', 'badge-black')}</li>`)
                .join('') || '<li class="empty">لا جداول بعد</li>'
            }</ul>
          </article>
        </div>
        <div class="hub-op-grid3">
          <article class="card hub-op-panel" style="grid-column:1 / -1">
            <h3><span class="title-left"><i class="fas fa-scroll icon"></i> التقارير المُولَّدة</span>
              <span class="muted">${latest.length} / ${(r.generated || []).length}</span></h3>
            ${
              latest.length
                ? latest
                    .map(
                      (rep) => `<div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px">
                        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">
                          <b>${K.esc(rep.title)}</b>${K.badge(rep.status, 'badge-black')} ${K.sourceBadge(rep.source)}
                        </div>
                        <small style="color:var(--muted)">${K.fmtTime(rep.at)} · ${K.esc(rep.createdBy || '')}</small>
                        ${rep.body ? `<div class="report-body"><b>${K.esc(rep.body.date)}</b><br/>${K.esc(rep.body.summary)}</div>` : ''}
                        <div class="toolbar" style="margin-top:6px">
                          <button type="button" class="btn btn-sm btn-ghost" data-action="rp-view" data-id="${rep.id}">عرض</button>
                          <button type="button" class="btn btn-sm btn-dark" data-action="rp-export" data-id="${rep.id}">تصدير JSON</button>
                        </div>
                      </div>`
                    )
                    .join('')
                : '<div class="empty">لا تقارير بعد — اختر نوعًا واضغط توليد أعلاه</div>'
            }
          </article>
        </div>`;
    } else if (rpUi.tab === 'schedule') {
      body = `<article class="card"><div class="table-wrap"><table class="data">
        <thead><tr><th>النوع</th><th>التالي</th></tr></thead>
        <tbody>${(r.schedule || []).map((s) => `<tr><td>${K.esc(s.label)}</td><td>${K.esc(s.next)}</td></tr>`).join('')}</tbody>
      </table></div></article>`;
    } else {
      body = `<article class="card">${K.renderAuditTable(r.auditLog || [])}</article>`;
    }

    const drawer = rpUi.drawer
      ? K.renderDrawer('rp', { title: rpUi.drawer.title, bodyHtml: rpUi.drawer.bodyHtml })
      : '';

    return `<div class="hub-ops-ws hub-reports-ws">
      ${K.renderHeader({
        prefix: 'rp',
        title: 'مركز التقارير',
        subtitle: 'توليد · عرض · تصدير · جدول · سجل عمليات',
        icon: 'fa-scroll',
        actionsHtml: `<button type="button" class="btn btn-primary btn-sm" data-action="rp-gen" data-type="${rpUi.type}"><i class="fas fa-file-lines"></i> توليد</button>`,
      })}
      ${K.renderKpis('rp', kpis, '')}
      ${K.renderTabs('rp', RP_TABS, rpUi.tab)}
      ${body}
      ${K.renderHelp('rp', {
        title: 'دليل التقارير',
        dismissed: !!r.settings?.helpDismissed,
        open: rpUi.helpOpen,
        bodyHtml: `<p>كل تقرير مولَّد يُحفظ مع المصدر والتاريخ ويمكن تصديره JSON. سجل العمليات يوثّق كل توليد.</p>`,
      })}
      ${drawer}
    </div>`;
  };

  const handleReports = (action, btn, ctx = {}) => {
    const { toast } = ctx;
    const K = Kit();
    if (action === 'rp-tab') {
      rpUi.tab = btn.dataset.tab || 'generated';
      return true;
    }
    if (action === 'rp-kpi') {
      if (btn.dataset.tab) rpUi.tab = btn.dataset.tab;
      return true;
    }
    if (action === 'rp-type') {
      rpUi.type = btn.dataset.type || 'daily';
      return true;
    }
    if (action === 'rp-gen') {
      const type = btn.dataset.type || rpUi.type;
      store().generateReport?.(type);
      toast?.('تم توليد التقرير');
      rpUi.tab = 'generated';
      return true;
    }
    if (action === 'rp-view') {
      const rep = (store().get().reports.generated || []).find((x) => x.id === btn.dataset.id);
      if (!rep) return true;
      rpUi.drawer = {
        title: rep.title,
        bodyHtml: `<p>${K.esc(rep.body?.summary || '—')}</p>
          <pre style="white-space:pre-wrap;font-size:12px;background:#f7f7f7;padding:10px;border-radius:8px">${K.esc(JSON.stringify(rep.body?.kpis || {}, null, 2))}</pre>
          <p><b>المصدر:</b> ${K.esc(rep.source)} · ${K.fmtTime(rep.at)}</p>`,
      };
      return true;
    }
    if (action === 'rp-export') {
      const rep = (store().get().reports.generated || []).find((x) => x.id === btn.dataset.id);
      if (!rep) return true;
      const blob = new Blob([JSON.stringify(rep, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${rep.type || 'report'}-${rep.id}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      store().pushDomainAudit?.(store().get().reports, {
        action: 'export',
        detail: rep.title,
        by: 'مشغّل هوب',
        source: 'Export',
        entityId: rep.id,
      });
      store().save?.();
      toast?.('تم التصدير');
      return true;
    }
    if (action === 'rp-drawer-close') {
      rpUi.drawer = null;
      return true;
    }
    if (action === 'rp-help-open') {
      rpUi.helpOpen = true;
      return true;
    }
    if (action === 'rp-help-dismiss') {
      const r = store().get().reports;
      r.settings = r.settings || {};
      r.settings.helpDismissed = true;
      rpUi.helpOpen = false;
      store().save?.();
      return true;
    }
    return false;
  };

  /* ───────── Integration ───────── */
  const igUi = { tab: 'gateway', helpOpen: false, modal: null, editId: null };
  const IG_TABS = [
    { id: 'gateway', label: 'البوابة', icon: 'fa-satellite-dish' },
    { id: 'connectors', label: 'الموصلات', icon: 'fa-plug' },
    { id: 'sync', label: 'سجل المزامنة', icon: 'fa-arrows-rotate' },
    { id: 'apis', label: 'مسارات واجهات البرمجة', icon: 'fa-code' },
    { id: 'audit', label: 'سجل العمليات', icon: 'fa-clock-rotate-left' },
  ];

  const renderIntegration = () => {
    const K = Kit();
    const i = store().get().integration || {};
    const L = (k, fb) => window.HubI18n?.label?.(k, fb) || fb || k;
    const connName = (c) => L(c?.name, c?.name);
    const connType = (t) => L(t, t);
    const disconnected = (i.connectors || []).filter((c) => c.status !== 'connected');
    const needs = disconnected.map((c) => ({ text: `موصل غير متصل: ${connName(c)}`, tab: 'connectors', id: c.id }));

    const kpis = [
      { key: 'status', label: 'البوابة', value: window.HubI18n?.status?.(i.gateway?.status) || i.gateway?.status || '—', hint: L('API Gateway', 'بوابة واجهات البرمجة'), tab: 'gateway' },
      { key: 'rps', label: 'الطلبات/ث', value: i.gateway?.rps ?? 0, tab: 'gateway' },
      { key: 'latency', label: 'الكمون', value: `${i.gateway?.latencyMs ?? 0}ms`, tab: 'gateway' },
      { key: 'errors', label: 'الأخطاء', value: `${i.gateway?.errors ?? 0}%`, tab: 'gateway' },
      { key: 'needs', label: 'يتطلب إجراء', value: needs.length, tab: 'connectors' },
    ];

    let body = '';
    if (igUi.tab === 'gateway') {
      const connected = (i.connectors || []).filter((c) => c.status === 'connected');
      const recentSync = (i.syncLog || []).slice(0, 6);
      body = `${K.renderNeeds('ig', needs)}
        <div class="hub-op-rail">
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-satellite-dish icon"></i> غرفة البوابة</span></h3>
            <p class="muted">المصدر: بوابة واجهات البرمجة · فحص حي يحدّث الحالة والكمون</p>
            <div class="hub-op-pulse">
              <div><span>الحالة</span><strong>${K.esc(window.HubI18n?.status?.(i.gateway?.status) || i.gateway?.status || '—')}</strong>${K.bar(i.gateway?.status === 'online' || i.gateway?.status === 'ok' ? 100 : 55)}</div>
              <div><span>الطلبات/ث</span><strong>${i.gateway?.rps ?? 0}</strong>${K.bar(Math.min(100, (i.gateway?.rps || 0) * 2))}</div>
              <div><span>الكمون</span><strong>${i.gateway?.latencyMs ?? 0}ms</strong>${K.bar(Math.max(5, 100 - Math.min(95, (i.gateway?.latencyMs || 0) / 2)))}</div>
              <div><span>الأخطاء</span><strong>${i.gateway?.errors ?? 0}%</strong>${K.bar(Math.min(100, (i.gateway?.errors || 0) * 10))}</div>
            </div>
            <div class="toolbar" style="margin-top:10px;flex-wrap:wrap">
              <button type="button" class="btn btn-primary" data-action="ig-ping"><i class="fas fa-satellite-dish"></i> فحص البوابة</button>
              <button type="button" class="btn btn-dark" data-action="ig-tab" data-tab="connectors">الموصلات</button>
              <button type="button" class="btn btn-ghost" data-action="ig-tab" data-tab="sync">سجل المزامنة</button>
            </div>
            <p style="margin-top:8px"><small class="muted">آخر فحص: ${K.fmtTime(i.gateway?.lastPingAt)}</small></p>
          </article>
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-plug icon"></i> حالة الموصلات</span>
              <button type="button" class="btn btn-sm btn-ghost" data-action="ig-tab" data-tab="connectors">الكل</button></h3>
            <ul class="hub-op-mini-list">${
              (i.connectors || [])
                .slice(0, 6)
                .map(
                  (c) =>
                    `<li><b>${K.esc(connName(c))}</b><small>${K.esc(connType(c.type))} · ${K.fmtTime(c.lastSyncAt)}</small>${K.badge(window.HubI18n?.status?.(c.status) || c.status, c.status === 'connected' ? 'badge-black' : 'badge-red')}</li>`
                )
                .join('') || '<li class="empty">لا موصلات</li>'
            }</ul>
            <p class="muted" style="margin-top:8px">${connected.length} متصل / ${(i.connectors || []).length} إجمالي</p>
          </article>
        </div>
        <div class="hub-op-grid3">
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-arrows-rotate icon"></i> آخر المزامنات</span>
              <button type="button" class="btn btn-sm btn-ghost" data-action="ig-tab" data-tab="sync">الكل</button></h3>
            <ul class="feed hub-op-feed">${
              recentSync
                .map(
                  (l) =>
                    `<li><b>${K.esc(L(l.connector, l.connector))}</b> — ${K.esc(l.detail)} ${K.badge(window.HubI18n?.status?.(l.status) || l.status, l.status === 'success' ? 'badge-black' : 'badge-red')} <small>${K.fmtTime(l.at)}</small></li>`
                )
                .join('') || '<li>لا مزامنات بعد — نفّذ مزامنة من تبويب الموصلات</li>'
            }</ul>
          </article>
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-code icon"></i> مسارات واجهات البرمجة</span>
              <button type="button" class="btn btn-sm btn-ghost" data-action="ig-tab" data-tab="apis">الكل</button></h3>
            <div class="table-wrap"><table class="data">
              <thead><tr><th>الطريقة</th><th>المسار</th><th>الاستدعاءات</th></tr></thead>
              <tbody>${
                (i.apis || [])
                  .slice(0, 6)
                  .map((a) => `<tr><td>${K.badge(a.method, 'badge-red')}</td><td><code data-tech>${K.esc(a.path)}</code></td><td>${a.calls}</td></tr>`)
                  .join('') || '<tr><td colspan="3" class="empty">لا مسارات</td></tr>'
              }</tbody>
            </table></div>
          </article>
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-bolt icon"></i> إجراءات سريعة</span></h3>
            <div class="toolbar" style="flex-direction:column;align-items:stretch;gap:8px">
              <button type="button" class="btn btn-primary" data-action="ig-conn-create"><i class="fas fa-plus"></i> موصل جديد</button>
              <button type="button" class="btn btn-dark" data-action="ig-tab" data-tab="connectors">إدارة الموصلات</button>
              <button type="button" class="btn btn-ghost" data-action="ig-tab" data-tab="audit">سجل العمليات</button>
            </div>
          </article>
        </div>`;
    } else if (igUi.tab === 'connectors') {
      body = `<article class="card">
        <div class="toolbar"><button type="button" class="btn btn-primary" data-action="ig-conn-create"><i class="fas fa-plus"></i> موصل</button></div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>الموصل</th><th>النوع</th><th>الحالة</th><th>آخر مزامنة</th><th>المصدر</th><th></th></tr></thead>
          <tbody>${
            (i.connectors || [])
              .map(
                (c) => `<tr>
                  <td>${K.esc(connName(c))}</td><td>${K.esc(connType(c.type))}</td>
                  <td>${K.badge(window.HubI18n?.status?.(c.status) || c.status, c.status === 'connected' ? 'badge-black' : 'badge-red')}</td>
                  <td>${K.fmtTime(c.lastSyncAt)}</td><td>${K.sourceBadge(c.source)}</td>
                  <td class="toolbar" style="margin:0;gap:4px">
                    <button type="button" class="btn btn-sm btn-primary" data-action="ig-sync" data-id="${c.id}">مزامنة</button>
                    <button type="button" class="btn btn-sm btn-dark" data-action="ig-toggle" data-id="${c.id}">تبديل</button>
                    <button type="button" class="btn btn-sm btn-ghost" data-action="ig-conn-edit" data-id="${c.id}">تعديل</button>
                  </td>
                </tr>`
              )
              .join('') || '<tr><td colspan="6" class="empty">لا موصلات</td></tr>'
          }</tbody>
        </table></div>
      </article>`;
    } else if (igUi.tab === 'sync') {
      body = `<article class="card"><div class="table-wrap"><table class="data">
        <thead><tr><th>الوقت</th><th>الموصل</th><th>الحالة</th><th>التفاصيل</th><th>المصدر</th></tr></thead>
        <tbody>${
          (i.syncLog || [])
            .slice(0, 40)
            .map(
              (l) => `<tr>
                <td>${K.fmtTime(l.at)}</td><td>${K.esc(L(l.connector, l.connector))}</td>
                <td>${K.badge(window.HubI18n?.status?.(l.status) || l.status, l.status === 'success' ? 'badge-black' : 'badge-red')}</td>
                <td>${K.esc(l.detail)}</td><td>${K.esc(L(l.source, l.source || '—'))}</td>
              </tr>`
            )
            .join('') || '<tr><td colspan="5" class="empty">لا مزامنات بعد</td></tr>'
        }</tbody></table></div></article>`;
    } else if (igUi.tab === 'apis') {
      body = `<article class="card"><div class="table-wrap"><table class="data">
        <thead><tr><th>الطريقة</th><th>المسار</th><th>الاستدعاءات</th></tr></thead>
        <tbody>${(i.apis || []).map((a) => `<tr><td>${K.badge(a.method, 'badge-red')}</td><td><code data-tech>${K.esc(a.path)}</code></td><td>${a.calls}</td></tr>`).join('')}</tbody>
      </table></div></article>`;
    } else {
      body = `<article class="card">${K.renderAuditTable(i.auditLog || [])}</article>`;
    }

    const modal = igUi.modal
      ? K.renderModal('ig', {
          title: igUi.editId ? 'تعديل موصل' : 'موصل جديد',
          bodyHtml: `
            <div class="field"><label>الاسم *</label><input id="ig-name" value="${K.esc(igUi.modal.data?.name || '')}" /></div>
            <div class="field"><label>النوع</label>
              <select id="ig-type">${['internal', 'external', 'ai', 'client'].map((t) => `<option value="${t}" ${igUi.modal.data?.type === t ? 'selected' : ''}>${K.esc(connType(t))}</option>`).join('')}</select>
            </div>
            <div class="field"><label>الحالة</label>
              <select id="ig-status">${['connected', 'disconnected', 'partial'].map((t) => `<option value="${t}" ${igUi.modal.data?.status === t ? 'selected' : ''}>${K.esc(window.HubI18n?.status?.(t) || t)}</option>`).join('')}</select>
            </div>
            <div class="field"><label>المصدر</label><input id="ig-source" value="${K.esc(igUi.modal.data?.source || 'إدخال يدوي')}" /></div>`,
          footerHtml: `<button type="button" class="btn btn-ghost" data-action="ig-modal-close">إلغاء</button>
            <button type="button" class="btn btn-primary" data-action="ig-conn-save">حفظ</button>`,
        })
      : '';

    return `<div class="hub-ops-ws hub-integration-ws">
      ${K.renderHeader({
        prefix: 'ig',
        title: 'التكامل والبوابة',
        subtitle: 'موصلات · مزامنة · بوابة واجهات · تدقيق',
        icon: 'fa-plug',
        actionsHtml: `<button type="button" class="btn btn-primary btn-sm" data-action="ig-ping"><i class="fas fa-satellite-dish"></i> فحص</button>`,
      })}
      ${K.renderKpis('ig', kpis, '')}
      ${K.renderTabs('ig', IG_TABS, igUi.tab)}
      ${body}
      ${K.renderHelp('ig', {
        title: 'دليل التكامل',
        dismissed: !!i.settings?.helpDismissed,
        open: igUi.helpOpen,
        bodyHtml: `<p>افحص البوابة، أدر الموصلات، ونفّذ مزامنة يدوية. كل مزامنة تُسجَّل في سجل المزامنة وسجل التدقيق.</p>`,
      })}
      ${modal}
    </div>`;
  };

  const handleIntegration = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const K = Kit();
    if (action === 'ig-tab') {
      igUi.tab = btn.dataset.tab || 'gateway';
      return true;
    }
    if (action === 'ig-kpi') {
      if (btn.dataset.tab) igUi.tab = btn.dataset.tab;
      return true;
    }
    if (action === 'ig-ping') {
      store().pingGateway?.();
      toast?.('تم فحص البوابة');
      return true;
    }
    if (action === 'ig-toggle') {
      store().toggleConnector?.(btn.dataset.id);
      toast?.('تبدلت حالة الموصل');
      return true;
    }
    if (action === 'ig-sync') {
      store().syncIntegrationConnector?.(btn.dataset.id, K.actorName(user));
      toast?.('تمت المزامنة');
      igUi.tab = 'sync';
      return true;
    }
    if (action === 'ig-conn-create') {
      igUi.editId = null;
      igUi.modal = { data: { type: 'internal', status: 'disconnected', source: 'إدخال يدوي' } };
      return true;
    }
    if (action === 'ig-conn-edit') {
      const c = (store().get().integration.connectors || []).find((x) => x.id === btn.dataset.id);
      if (!c) return true;
      igUi.editId = c.id;
      igUi.modal = { data: { ...c } };
      return true;
    }
    if (action === 'ig-modal-close') {
      igUi.modal = null;
      return true;
    }
    if (action === 'ig-conn-save') {
      const payload = {
        id: igUi.editId || undefined,
        name: K.qVal('ig-name'),
        type: K.qVal('ig-type'),
        status: K.qVal('ig-status'),
        source: K.qVal('ig-source'),
      };
      if (!payload.name) {
        toast?.('اسم الموصل مطلوب');
        return true;
      }
      store().upsertIntegrationConnector?.(payload, K.actorName(user));
      igUi.modal = null;
      toast?.('تم حفظ الموصل');
      return true;
    }
    if (action === 'ig-help-open') {
      igUi.helpOpen = true;
      return true;
    }
    if (action === 'ig-help-dismiss') {
      const i = store().get().integration;
      i.settings = i.settings || {};
      i.settings.helpDismissed = true;
      igUi.helpOpen = false;
      store().save?.();
      return true;
    }
    return false;
  };

  /* ───────── Core ───────── */
  const crUi = { tab: 'engines', helpOpen: false };
  const CR_TABS = [
    { id: 'engines', label: 'المحركات', icon: 'fa-microchip' },
    { id: 'decisions', label: 'القرارات', icon: 'fa-gavel' },
    { id: 'insights', label: 'الرؤى', icon: 'fa-lightbulb' },
    { id: 'predictions', label: 'التنبؤات', icon: 'fa-binoculars' },
    { id: 'anomalies', label: 'الشذوذ', icon: 'fa-triangle-exclamation' },
    { id: 'graph', label: 'معرفة', icon: 'fa-project-diagram' },
    { id: 'audit', label: 'سجل العمليات', icon: 'fa-clock-rotate-left' },
  ];

  const renderCore = () => {
    const K = Kit();
    const s = store().get().core || {};
    const health = s.engineHealth || {};
    const openAnom = (s.anomalies || []).filter((a) => a.status !== 'closed');
    const openIns = (s.insights || []).filter((i) => i.status !== 'closed');
    const needs = [
      ...openAnom.slice(0, 3).map((a) => ({ text: `شذوذ: ${a.signal}`, tab: 'anomalies', id: a.id })),
      ...(s.decisions || [])
        .filter((d) => d.status === 'pending')
        .slice(0, 3)
        .map((d) => ({ text: `قرار معلّق: ${d.title}`, tab: 'decisions', id: d.id })),
      ...openIns.slice(0, 2).map((i) => ({ text: `رؤية مفتوحة: ${i.title}`, tab: 'insights', id: i.id })),
    ];

    const kpis = [
      { key: 'decision', label: 'Decision', value: `${health.decision || 0}%`, tab: 'engines' },
      { key: 'predictive', label: 'Predictive', value: `${health.predictive || 0}%`, tab: 'engines' },
      { key: 'pending', label: 'قرارات معلّقة', value: (s.decisions || []).filter((d) => d.status === 'pending').length, tab: 'decisions' },
      { key: 'needs', label: 'يتطلب إجراء', value: needs.length, tab: 'decisions' },
    ];

    let body = '';
    if (crUi.tab === 'engines') {
      const pendingDec = (s.decisions || []).filter((d) => d.status === 'pending');
      body = `${K.renderNeeds('cr', needs)}
        <div class="hub-op-rail">
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-brain icon"></i> صحة المحركات</span></h3>
            <div class="hub-op-pulse">
              ${[
                ['Decision', health.decision],
                ['Predictive', health.predictive],
                ['Optimization', health.optimization],
                ['Anomaly', health.anomaly],
                ['Knowledge', health.knowledge],
              ]
                .map(([n, v]) => `<div><span>${window.HubI18n?.getArabicLabel?.('engine', n) || n}</span><strong>${v || 0}%</strong>${K.bar(v || 0)}</div>`)
                .join('')}
            </div>
            <div class="toolbar" style="margin-top:10px;flex-wrap:wrap">
              <button type="button" class="btn btn-primary" data-action="cr-tab" data-tab="decisions">القرارات</button>
              <button type="button" class="btn btn-dark" data-action="cr-tab" data-tab="anomalies">الشذوذ (${openAnom.length})</button>
              <button type="button" class="btn btn-ghost" data-action="cr-tab" data-tab="insights">الرؤى</button>
            </div>
          </article>
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-gavel icon"></i> قرارات معلّقة</span>
              <button type="button" class="btn btn-sm btn-ghost" data-action="cr-tab" data-tab="decisions">الكل</button></h3>
            <ul class="hub-op-mini-list">${
              pendingDec
                .slice(0, 5)
                .map((d) => `<li><b>${K.esc(d.title)}</b><small>${K.esc(window.HubI18n?.getArabicLabel?.('engine', d.engine) || d.engine)} · ${K.esc(d.impact || '')}</small>${K.badge('معلّق', 'badge-red')}</li>`)
                .join('') || '<li class="empty">لا قرارات معلّقة</li>'
            }</ul>
          </article>
        </div>
        <div class="hub-op-grid3">
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-wand-magic-sparkles icon"></i> تحسينات مقترحة</span></h3>
            ${(s.optimizations || [])
              .slice(0, 5)
              .map(
                (o) => `<div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px">
                  <b>${K.esc(o.target)}</b> · ${K.badge(o.gain, 'badge-red')}
                  <div style="margin-top:6px;font-size:13px;color:var(--muted)">${K.esc(o.suggestion)}</div>
                  <small>المصدر: محرك التحسين</small>
                </div>`
              )
              .join('') || '<p class="empty">لا اقتراحات</p>'}
          </article>
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-triangle-exclamation icon"></i> شذوذ مفتوح</span>
              <button type="button" class="btn btn-sm btn-ghost" data-action="cr-tab" data-tab="anomalies">الكل</button></h3>
            <ul class="hub-op-mini-list">${
              openAnom
                .slice(0, 5)
                .map((a) => `<li><b>${K.esc(a.signal)}</b><small>${K.esc(a.source || '')}</small>${K.badge(String(a.score ?? ''), 'badge-red')}</li>`)
                .join('') || '<li class="empty">لا شذوذ مفتوح</li>'
            }</ul>
          </article>
          <article class="card hub-op-panel">
            <h3><span class="title-left"><i class="fas fa-lightbulb icon"></i> رؤى مفتوحة</span>
              <button type="button" class="btn btn-sm btn-ghost" data-action="cr-tab" data-tab="insights">الكل</button></h3>
            <ul class="hub-op-mini-list">${
              openIns
                .slice(0, 5)
                .map((i) => `<li><b>${K.esc(i.title)}</b><small>${K.esc(i.source || '')}</small></li>`)
                .join('') || '<li class="empty">لا رؤى مفتوحة</li>'
            }</ul>
          </article>
        </div>`;
    } else if (crUi.tab === 'decisions') {
      body = `<article class="card">
        <div class="toolbar" style="flex-wrap:wrap">
          <div class="field"><label>قرار جديد</label><input id="cr-decision-title" placeholder="عنوان القرار" /></div>
          <div class="field"><label>المحرك</label>
            <select id="cr-decision-engine"><option value="AI Decision">قرارات الذكاء الاصطناعي</option><option value="Predictive">تنبؤي</option><option value="Optimization">تحسين</option><option value="Anomaly">اكتشاف الشذوذ</option></select>
          </div>
          <div class="field"><label>التبرير</label><input id="cr-decision-rationale" placeholder="لماذا هذا القرار؟" /></div>
          <button type="button" class="btn btn-primary" data-action="cr-issue"><i class="fas fa-microchip"></i> إصدار</button>
        </div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>القرار</th><th>المحرك</th><th>الأثر</th><th>الحالة</th><th>المصدر / التبرير</th><th></th></tr></thead>
          <tbody>${
            (s.decisions || [])
              .map(
                (d) => `<tr>
                  <td>${K.esc(d.title)}</td><td>${K.esc(window.HubI18n?.getArabicLabel?.('engine', d.engine) || d.engine)}</td>
                  <td>${K.badge(d.impact, 'badge-outline')}</td><td>${K.badge(d.status, d.status === 'executed' ? 'badge-black' : 'badge-red')}</td>
                  <td><small>${K.esc(d.source || '—')}<br/>${K.esc(d.rationale || '—')}</small></td>
                  <td>${d.status !== 'executed' ? `<button type="button" class="btn btn-sm btn-primary" data-action="cr-exec" data-id="${d.id}">تنفيذ</button>` : '—'}</td>
                </tr>`
              )
              .join('') || '<tr><td colspan="6" class="empty">لا قرارات</td></tr>'
          }</tbody>
        </table></div>
      </article>`;
    } else if (crUi.tab === 'insights') {
      body = `<article class="card">
        <div class="toolbar" style="flex-wrap:wrap">
          <div class="field"><label>عنوان الرؤية</label><input id="cr-ins-title" /></div>
          <div class="field"><label>التبرير</label><input id="cr-ins-rationale" /></div>
          <div class="field"><label>المصدر</label><input id="cr-ins-source" value="إدخال يدوي" /></div>
          <div class="field"><label>الثقة %</label><input id="cr-ins-conf" type="number" value="70" /></div>
          <button type="button" class="btn btn-primary" data-action="cr-ins-add">إضافة رؤية</button>
        </div>
        ${(s.insights || [])
          .map(
            (ins) => `<div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
                <b>${K.esc(ins.title)}</b>${K.badge(ins.status, ins.status === 'closed' ? 'badge-black' : 'badge-red')}
              </div>
              <p style="margin:6px 0;font-size:13px">${K.esc(ins.rationale)}</p>
              <small>المصدر: ${K.esc(ins.source)} · الثقة: ${ins.confidence}% · ${K.fmtTime(ins.at)}</small>
              ${ins.status !== 'closed' ? `<div class="toolbar"><button type="button" class="btn btn-sm btn-dark" data-action="cr-ins-close" data-id="${ins.id}">إغلاق</button></div>` : ''}
            </div>`
          )
          .join('') || '<p class="empty">لا رؤى</p>'}
      </article>`;
    } else if (crUi.tab === 'predictions') {
      body = `<article class="card">
        <div class="toolbar"><button type="button" class="btn btn-dark" data-action="cr-predict"><i class="fas fa-binoculars"></i> مسح تنبؤي</button></div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>المخاطر</th><th>الاحتمال</th><th>الموعد</th><th>الحدة</th></tr></thead>
          <tbody>${(s.predictions || [])
            .map(
              (p) => `<tr><td>${K.esc(p.risk)}</td><td>${p.probability}% ${K.bar(p.probability)}</td><td>${K.esc(p.eta)}</td><td>${K.badge(p.severity, 'badge-red')}</td></tr>`
            )
            .join('')}</tbody>
        </table></div>
        <small class="muted">التنبؤات مبنية على قواعد تشغيلية معلنة — ليست صندوقًا أسود.</small>
      </article>`;
    } else if (crUi.tab === 'anomalies') {
      body = `<article class="card"><div class="table-wrap"><table class="data">
        <thead><tr><th>المصدر</th><th>الإشارة</th><th>الدرجة</th><th></th></tr></thead>
        <tbody>${(s.anomalies || [])
          .map(
            (a) => `<tr>
              <td>${K.esc(a.source)}</td><td>${K.esc(a.signal)}</td>
              <td>${a.score} ${K.badge(a.status, a.status === 'closed' ? 'badge-black' : 'badge-red')}</td>
              <td>${a.status !== 'closed' ? `<button type="button" class="btn btn-sm btn-dark" data-action="cr-resolve" data-id="${a.id}">إغلاق</button>` : '—'}</td>
            </tr>`
          )
          .join('')}</tbody>
      </table></div></article>`;
    } else if (crUi.tab === 'graph') {
      body = `<article class="card"><div class="kg">${(s.knowledgeGraph || [])
        .map((k) => `<div class="kg-row"><span>${K.esc(k.from)}</span><span class="rel">${K.esc(k.rel)}</span><span>${K.esc(k.to)}</span></div>`)
        .join('')}</div></article>`;
    } else {
      body = `<article class="card">${K.renderAuditTable(s.auditLog || [])}</article>`;
    }

    return `<div class="hub-ops-ws hub-core-ws">
      ${K.renderHeader({
        prefix: 'cr',
        title: 'العقل المركزي',
        subtitle: 'قرارات قابلة للتفسير · رؤى بمصدر · تنبؤات معلنة · بدون AI وهمي',
        icon: 'fa-brain',
        actionsHtml: `<button type="button" class="btn btn-dark btn-sm" data-action="cr-predict"><i class="fas fa-binoculars"></i> مسح</button>`,
      })}
      ${K.renderKpis('cr', kpis, '')}
      ${K.renderTabs('cr', CR_TABS, crUi.tab)}
      ${body}
      ${K.renderHelp('cr', {
        title: 'دليل العقل المركزي',
        dismissed: !!s.settings?.helpDismissed,
        open: crUi.helpOpen,
        bodyHtml: `<p>كل قرار ورؤية يحمل مصدرًا وتبريرًا. لا ندّعي ذكاءً اصطناعيًا غامضًا — المحركات قواعد تشغيل + مؤشرات.</p>`,
      })}
    </div>`;
  };

  const handleCore = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const K = Kit();
    if (action === 'cr-tab') {
      crUi.tab = btn.dataset.tab || 'engines';
      return true;
    }
    if (action === 'cr-kpi') {
      if (btn.dataset.tab) crUi.tab = btn.dataset.tab;
      return true;
    }
    if (action === 'cr-issue') {
      const title = K.qVal('cr-decision-title');
      if (!title) {
        toast?.('عنوان القرار مطلوب');
        return true;
      }
      store().issueDecision?.(title, K.qVal('cr-decision-engine'), 'متوسط', {
        rationale: K.qVal('cr-decision-rationale'),
        by: K.actorName(user),
        source: 'محرك القرار',
      });
      toast?.('صدر القرار');
      return true;
    }
    if (action === 'cr-exec') {
      store().executeDecision?.(btn.dataset.id);
      store().pushDomainAudit?.(store().get().core, {
        action: 'execute',
        detail: `تنفيذ قرار ${btn.dataset.id}`,
        by: K.actorName(user),
        source: 'Core',
        entityId: btn.dataset.id,
      });
      store().save?.();
      toast?.('نُفّذ القرار');
      return true;
    }
    if (action === 'cr-predict') {
      store().runPredictiveScan?.();
      store().pushDomainAudit?.(store().get().core, {
        action: 'predict',
        detail: 'مسح تنبؤي',
        by: K.actorName(user),
        source: 'Predictive',
      });
      store().save?.();
      toast?.('أُضيف تنبؤ');
      crUi.tab = 'predictions';
      return true;
    }
    if (action === 'cr-resolve') {
      store().resolveAnomaly?.(btn.dataset.id);
      store().pushDomainAudit?.(store().get().core, {
        action: 'resolve_anomaly',
        detail: btn.dataset.id,
        by: K.actorName(user),
        source: 'Anomaly',
        entityId: btn.dataset.id,
      });
      store().save?.();
      toast?.('أُغلق الشذوذ');
      return true;
    }
    if (action === 'cr-ins-add') {
      const title = K.qVal('cr-ins-title');
      if (!title) {
        toast?.('عنوان الرؤية مطلوب');
        return true;
      }
      store().addCoreInsight?.(
        {
          title,
          rationale: K.qVal('cr-ins-rationale'),
          source: K.qVal('cr-ins-source') || 'إدخال يدوي',
          confidence: Number(K.qVal('cr-ins-conf')) || 70,
        },
        K.actorName(user)
      );
      toast?.('أُضيفت الرؤية');
      return true;
    }
    if (action === 'cr-ins-close') {
      store().closeCoreInsight?.(btn.dataset.id, K.actorName(user));
      toast?.('أُغلقت الرؤية');
      return true;
    }
    if (action === 'cr-help-open') {
      crUi.helpOpen = true;
      return true;
    }
    if (action === 'cr-help-dismiss') {
      const c = store().get().core;
      c.settings = c.settings || {};
      c.settings.helpDismissed = true;
      crUi.helpOpen = false;
      store().save?.();
      return true;
    }
    return false;
  };

  /* ───────── Exports ───────── */
  window.HubOverview = { render: renderOverview, handle: handleOverview, ui: ovUi };
  window.HubOperatingWS = { render: renderOperating, handle: handleOperating, ui: opUi };
  window.HubTasksWS = {
    render: renderTasks,
    handle: handleTasks,
    handleChange: handleTasksChange,
    ui: tkUi,
  };
  window.HubMeasurementWS = { render: renderMeasurement, handle: handleMeasurement, ui: msUi };
  window.HubReportsWS = { render: renderReports, handle: handleReports, ui: rpUi };
  window.HubIntegrationWS = { render: renderIntegration, handle: handleIntegration, ui: igUi };
  if (!window.HubCoreIntelligence) {
    window.HubCoreWS = { render: renderCore, handle: handleCore, ui: crUi };
  }
})();
