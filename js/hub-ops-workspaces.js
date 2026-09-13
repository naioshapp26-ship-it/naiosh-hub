/**
 * NAIOSH HUB 360 — Batch A: Leadership & Operations Workspaces
 * overview · operating · tasks · measurement · reports · integration · core
 */
(() => {
  'use strict';

  const Kit = () => window.HubWsKit;
  const store = () => window.HubStore;

  const statusTaskLabel = (s) =>
    ({ todo: 'معلّقة', in_progress: 'قيد التنفيذ', blocked: 'مختنق', done: 'مكتملة' }[s] || s);
  const statusTaskBadge = (s) => {
    const map = { todo: 'badge-gray', in_progress: 'badge-red', blocked: 'badge-red', done: 'badge-black' };
    return Kit().badge(statusTaskLabel(s), map[s] || 'badge-outline');
  };

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
      { key: 'branches', label: 'الفروع', value: k.branches, hint: 'Branches', tab: 'board' },
      { key: 'incubators', label: 'الحاضنات', value: k.incubators, hint: 'Incubators', tab: 'board' },
      { key: 'platforms', label: 'المنصات', value: k.platforms, hint: 'Platforms', tab: 'board' },
      { key: 'treasury', label: 'خزينة النقاط', value: Number(k.treasury).toLocaleString('en-US'), hint: 'Wallet', tab: 'board' },
      { key: 'core', label: 'جاهزية Core', value: `${k.coreReadyPct}%`, hint: 'Core', tab: 'layers' },
      { key: 'usage', label: 'استخدام الأنظمة', value: `${cmd.systemsUsagePct || 0}%`, hint: 'Usage', tab: 'pulse' },
      { key: 'health', label: 'صحة الأنظمة', value: `${k.systemsHealth}%`, hint: 'Health', tab: 'layers' },
      { key: 'needs', label: 'Needs Action', value: needs.length, hint: 'إجراء مطلوب', tab: 'board' },
    ];

    let body = '';
    if (ovUi.tab === 'board') {
      body = `
        ${K.renderNeeds('ov', needs)}
        <div class="grid-2" style="margin-top:12px">
          <article class="card">
            <h3><span class="title-left"><i class="fas fa-crosshairs icon"></i> مصادر المؤشرات</span></h3>
            <ul class="feed">
              <li><b>الفروع/الحاضنات/المنصات</b> — empire.organization · Source: Organization</li>
              <li><b>الخزينة</b> — empire.wallet.treasury · Source: Wallet</li>
              <li><b>صحة الأنظمة</b> — systems.registry.health · Source: Systems</li>
              <li><b>جاهزية Core</b> — empire.coreModules · Source: Blueprint</li>
            </ul>
          </article>
          <article class="card">
            <h3><span class="title-left"><i class="fas fa-link icon"></i> اختصارات غرفة العمليات</span></h3>
            <div class="toolbar" style="flex-wrap:wrap">
              <button type="button" class="btn btn-dark btn-sm" data-nav="tasks">المهام</button>
              <button type="button" class="btn btn-dark btn-sm" data-nav="measurement">القياس</button>
              <button type="button" class="btn btn-dark btn-sm" data-nav="reports">التقارير</button>
              <button type="button" class="btn btn-dark btn-sm" data-nav="integration">التكامل</button>
              <button type="button" class="btn btn-dark btn-sm" data-nav="core">العقل المركزي</button>
              <button type="button" class="btn btn-dark btn-sm" data-nav="operating">آلية التشغيل</button>
            </div>
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
                .map((f) => `<li><b>${K.esc(f.type)}:</b> ${K.esc(f.text)}<small>${K.fmtTime(f.at)}</small></li>`)
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
        <p class="muted">التدفق الحي يُدار من الإعدادات الداخلية العامة. تحديث المؤشرات يسجّل في Audit.</p>
        <button type="button" class="btn btn-primary" data-action="ov-refresh"><i class="fas fa-rotate"></i> تحديث المؤشرات الآن</button>
      </article>`;
    }

    return `<div class="hub-ops-ws hub-overview">
      ${K.renderHeader({
        prefix: 'ov',
        title: 'مركز التحكم العالمي',
        subtitle: 'غرفة قيادة واحدة — مؤشرات قابلة للنقر · Needs Action · مصدر كل رقم واضح',
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
        bodyHtml: `<p>اضغط أي KPI للانتقال للتبويب المناسب. Needs Action يجمع الاختناقات والشذوذ. كل تحديث يُسجَّل في سجل العمليات مع المصدر.</p>`,
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
      { key: 'needs', label: 'Needs Action', value: needs.length, hint: needs.length ? 'يتطلب تدخل' : 'مستقر', tab: 'overview', icon: 'fa-bolt' },
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
              <div class="field"><label>بريد العميل</label><input id="op-sub-email" type="email" value="${K.esc(user?.email || '')}" placeholder="client@example.com" /></div>
              <div class="field"><label>النظام</label>
                <select id="op-sub-system">${systems.map((c) => `<option value="${K.esc(c)}">${K.esc(c)}</option>`).join('')}</select>
              </div>
              <div class="field"><label>الخطة</label><input id="op-sub-plan" value="${K.esc(store().getSettings?.()?.defaultGrantPlan || 'standard')}" /></div>
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
                  .map((s) => `<tr><td>${K.esc(s.email)}</td><td><code>${K.esc(s.systemCode)}</code></td><td>${K.esc(s.plan)}</td></tr>`)
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
                .map((a) => `<li><b>${K.esc(a.kind)}</b> — ${K.esc(a.text)} <small>${K.fmtTime(a.at)}</small></li>`)
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
                  <strong>${K.esc(window.HubLauncher?.SYSTEM_META?.[code]?.nameAr || code)}</strong>
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
            <select id="op-sub-system">${systems.map((c) => `<option value="${K.esc(c)}">${K.esc(c)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>الخطة</label><input id="op-sub-plan" value="${K.esc(store().getSettings?.()?.defaultGrantPlan || 'standard')}" /></div>
          <button type="button" class="btn btn-primary" data-action="op-grant"><i class="fas fa-user-check"></i> منح</button>
        </div>
        <div class="table-wrap" style="margin-top:10px"><table class="data">
          <thead><tr><th>البريد</th><th>النظام</th><th>الخطة</th><th>الصلاحيات</th><th></th></tr></thead>
          <tbody>${
            activeSubs
              .map(
                (s) => `<tr>
                <td>${K.esc(s.email)}</td><td>${K.esc(s.systemCode)}</td><td>${K.esc(s.plan)}</td>
                <td>${K.esc((s.permissions || []).join(' · '))}</td>
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
              <b>${K.esc(window.HubLauncher?.SYSTEM_META?.[code]?.nameAr || code)}</b>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${list.map((s) => `<span class="chip">${K.esc(s.nameAr)}</span>`).join('')}</div>
              <div style="margin-top:8px">${window.HubLauncher?.openButtonsHtml?.(code, { compact: true }) || ''}</div>
            </div>`
          )
          .join('')}</div></article>`;
    } else if (opUi.tab === 'activity') {
      body = `<article class="card"><h3>النشاط الجاري والماضي</h3>
        <ul class="feed">${(op.activityLog || [])
          .slice(0, 40)
          .map((a) => `<li><b>${K.esc(a.kind)}</b> — ${K.esc(a.text)} <small>${K.fmtTime(a.at)}</small></li>`)
          .join('') || '<li>لا نشاط مسجّل بعد</li>'}</ul></article>`;
    } else if (opUi.tab === 'audit') {
      body = `<article class="card">${K.renderAuditTable(op.auditLog || [])}</article>`;
    } else {
      body = `<article class="card"><p>آلية التشغيل: اشتراك = صلاحية · SSO · خدمات موحّدة بدون تكرار.</p>
        <button type="button" class="btn btn-ghost" data-action="op-help-open">فتح الدليل</button></article>`;
    }

    return `<div class="hub-ops-ws hub-operating-ws" data-ws="operating">
      ${K.renderHeader({
        prefix: 'op',
        title: 'آلية تشغيل نايوش هوب',
        subtitle: 'غرفة تشغيل حيّة: منح صلاحيات · مكاتب · خدمات موحّدة · نشاط · تدقيق — ليست صفحة ثابتة',
        icon: 'fa-gears',
        badgeText: 'OPERATING CONTROL',
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

  /* ───────── Tasks ───────── */
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
  };
  const TK_TABS = [
    { id: 'list', label: 'قائمة المهام', icon: 'fa-list-check' },
    { id: 'board', label: 'لوحة الحالات', icon: 'fa-columns' },
    { id: 'audit', label: 'سجل العمليات', icon: 'fa-clock-rotate-left' },
    { id: 'settings', label: 'الإعدادات', icon: 'fa-gear' },
  ];

  const filterTasks = (items) => {
    const f = tkUi.filters;
    return (items || []).filter((t) => {
      if (tkUi.kpiFocus === 'blocked' && t.status !== 'blocked') return false;
      if (tkUi.kpiFocus === 'todo' && t.status !== 'todo') return false;
      if (tkUi.kpiFocus === 'done' && t.status !== 'done') return false;
      if (f.status && t.status !== f.status) return false;
      if (f.priority && t.priority !== f.priority) return false;
      if (f.assignee && t.assignee !== f.assignee) return false;
      if (f.q) {
        const hay = `${t.title} ${t.details} ${t.assignee} ${t.project}`.toLowerCase();
        if (!hay.includes(f.q.toLowerCase())) return false;
      }
      return true;
    });
  };

  const taskFormHtml = (item = {}) => {
    const K = Kit();
    const people = peopleNames();
    return `
      <div class="grid-2">
        <div class="field"><label>العنوان *</label><input id="tk-title" value="${K.esc(item.title || '')}" /></div>
        <div class="field"><label>المشروع</label><input id="tk-project" value="${K.esc(item.project || 'تشغيل يومي')}" /></div>
        <div class="field"><label>المسؤول</label>
          <select id="tk-assignee">${(people.length ? people : ['مشغّل هوب']).map((p) => `<option ${item.assignee === p ? 'selected' : ''}>${K.esc(p)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>الأولوية</label>
          <select id="tk-priority">${['عاجل', 'عالي', 'متوسط', 'منخفض'].map((p) => `<option ${ (item.priority || 'متوسط') === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
        </div>
        <div class="field"><label>الحالة</label>
          <select id="tk-status">${['todo', 'in_progress', 'blocked', 'done'].map((s) => `<option value="${s}" ${item.status === s ? 'selected' : ''}>${statusTaskLabel(s)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>الموعد</label><input id="tk-due" type="date" value="${K.esc(item.dueDate || '')}" /></div>
        <div class="field"><label>المصدر</label>
          <select id="tk-source">${['إدخال يدوي', 'Integration', 'Automation', 'Governance', 'System Generated'].map((s) => `<option ${ (item.source || 'إدخال يدوي') === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        </div>
        <div class="field"><label>الفرع</label><input id="tk-branch" value="${K.esc(item.branch || '')}" /></div>
      </div>
      <div class="field"><label>التفاصيل</label><textarea id="tk-details" rows="3">${K.esc(item.details || '')}</textarea></div>`;
  };

  const readTaskForm = () => {
    const K = Kit();
    return {
      title: K.qVal('tk-title'),
      project: K.qVal('tk-project'),
      assignee: K.qVal('tk-assignee'),
      priority: K.qVal('tk-priority'),
      status: K.qVal('tk-status') || 'todo',
      dueDate: K.qVal('tk-due'),
      source: K.qVal('tk-source'),
      branch: K.qVal('tk-branch'),
      details: K.qVal('tk-details'),
    };
  };

  const renderTasks = (ctx = {}) => {
    const { user } = ctx;
    const K = Kit();
    const bag = store().get().tasks || { items: [], auditLog: [], settings: {} };
    const items = bag.items || [];
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
      { key: 'needs', label: 'Needs Action', value: needs.length, tab: 'list' },
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
            <thead><tr><th>المهمة</th><th>المسؤول</th><th>الأولوية</th><th>الحالة</th><th>الموعد</th><th>المصدر</th><th>إجراءات</th></tr></thead>
            <tbody>${
              pg.rows.length
                ? pg.rows
                    .map(
                      (t) => `<tr>
                        <td><strong>${K.esc(t.title)}</strong><br/><small>${K.esc((t.details || '').slice(0, 80))}</small></td>
                        <td>${K.esc(t.assignee || '—')}</td>
                        <td>${K.badge(t.priority, t.priority === 'عاجل' ? 'badge-red' : 'badge-outline')}</td>
                        <td>${statusTaskBadge(t.status)}</td>
                        <td>${K.esc(t.dueDate || '—')}</td>
                        <td>${K.sourceBadge(t.source)}</td>
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
                : '<tr><td colspan="7" class="empty">لا مهام مطابقة — أنشئ مهمة جديدة</td></tr>'
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
              <b>${K.esc(t.title)}</b><br/><small>${K.esc(t.assignee || '')}</small>
              <div class="toolbar" style="margin-top:6px"><button type="button" class="btn btn-sm btn-ghost" data-action="tk-open" data-id="${t.id}">فتح</button></div>
            </div>`).join('') || '<p class="empty">—</p>'}
          </article>`;
        })
        .join('')}</div>`;
    } else if (tkUi.tab === 'audit') {
      body = `<article class="card">${K.renderAuditTable(bag.auditLog || [])}</article>`;
    } else {
      body = `<article class="card"><p>حجم الصفحة: ${tkUi.pageSize}. الأولوية الافتراضية: ${K.esc(bag.settings?.defaultPriority || 'متوسط')}</p></article>`;
    }

    const modal = tkUi.modal
      ? K.renderModal('tk', {
          title: tkUi.editId ? 'تعديل مهمة' : 'مهمة جديدة',
          bodyHtml: taskFormHtml(tkUi.modal.data || {}),
          footerHtml: `<button type="button" class="btn btn-ghost" data-action="tk-modal-close">إلغاء</button>
            <button type="button" class="btn btn-primary" data-action="tk-save">حفظ</button>`,
        })
      : '';

    const drawer = tkUi.drawer
      ? K.renderDrawer('tk', {
          title: tkUi.drawer.title || 'تفاصيل المهمة',
          bodyHtml: tkUi.drawer.bodyHtml,
        })
      : '';

    return `<div class="hub-ops-ws hub-tasks-ws">
      ${K.renderHeader({
        prefix: 'tk',
        title: 'إدارة المهام',
        subtitle: 'CRUD كامل · مصدر · تدقيق · Needs Action · بدون أزرار ميتة',
        icon: 'fa-clipboard-list',
        actionsHtml: `
          <button type="button" class="btn btn-primary btn-sm" data-action="tk-create"><i class="fas fa-plus"></i> جديد</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="tk-help-open"><i class="fas fa-circle-question"></i></button>`,
      })}
      ${K.renderKpis('tk', kpis, tkUi.kpiFocus)}
      ${K.renderTabs('tk', TK_TABS, tkUi.tab)}
      ${body}
      ${K.renderHelp('tk', {
        title: 'دليل المهام',
        dismissed: !!bag.settings?.helpDismissed,
        open: tkUi.helpOpen,
        bodyHtml: `<p>أنشئ مهمة، عدّلها، غيّر حالتها، واحذفها. كل إجراء يظهر في سجل العمليات مع المصدر والمنفّذ.</p>`,
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
      tkUi.modal = { data: { priority: 'متوسط', status: 'todo', source: 'إدخال يدوي' } };
      return true;
    }
    if (action === 'tk-edit') {
      const item = store().get().tasks.items.find((x) => x.id === btn.dataset.id);
      if (!item) {
        toast?.('المهمة غير موجودة');
        return true;
      }
      tkUi.editId = item.id;
      tkUi.modal = { data: { ...item } };
      return true;
    }
    if (action === 'tk-open') {
      const item = store().get().tasks.items.find((x) => x.id === btn.dataset.id);
      if (!item) return true;
      tkUi.drawer = {
        title: item.title,
        bodyHtml: `<p>${K.esc(item.details || '—')}</p>
          <p><b>المسؤول:</b> ${K.esc(item.assignee || '—')} · <b>الحالة:</b> ${statusTaskLabel(item.status)}</p>
          <p><b>المصدر:</b> ${K.esc(item.source || '—')} · <b>الموعد:</b> ${K.esc(item.dueDate || '—')}</p>
          <p><b>أُنشئت:</b> ${K.fmtTime(item.createdAt)} · <b>حدّثت:</b> ${K.fmtTime(item.updatedAt)}</p>
          <div class="toolbar">
            <button type="button" class="btn btn-dark" data-action="tk-edit" data-id="${item.id}">تعديل</button>
            ${item.status !== 'done' ? `<button type="button" class="btn btn-primary" data-action="tk-status" data-id="${item.id}" data-status="done">إتمام</button>` : ''}
          </div>`,
      };
      return true;
    }
    if (action === 'tk-modal-close' || action === 'tk-drawer-close') {
      if (action === 'tk-modal-close') tkUi.modal = null;
      if (action === 'tk-drawer-close') tkUi.drawer = null;
      return true;
    }
    if (action === 'tk-save') {
      const data = readTaskForm();
      if (!data.title) {
        toast?.('عنوان المهمة مطلوب');
        return true;
      }
      if (tkUi.editId) {
        store().updateTask?.(tkUi.editId, data, actor);
        toast?.('تم تحديث المهمة');
      } else {
        store().addTask?.(data.title, data.assignee, data.priority, data.project, {
          ...data,
          createdBy: actor,
        });
        toast?.('تم إنشاء المهمة');
      }
      tkUi.modal = null;
      tkUi.editId = null;
      return true;
    }
    if (action === 'tk-status') {
      store().updateTaskStatus?.(btn.dataset.id, btn.dataset.status);
      toast?.('تحدّثت حالة المهمة');
      return true;
    }
    if (action === 'tk-delete') {
      if (!confirm('حذف هذه المهمة؟')) return true;
      store().removeTask?.(btn.dataset.id, actor);
      toast?.('حُذفت المهمة');
      tkUi.drawer = null;
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
      { key: 'needs', label: 'Needs Action', value: needs.length, tab: 'scores' },
    ];

    let body = '';
    if (msUi.tab === 'scores') {
      body = `${K.renderNeeds('ms', needs)}
        <div class="toolbar"><button type="button" class="btn btn-primary" data-action="ms-recalc"><i class="fas fa-calculator"></i> إعادة حساب</button></div>
        <article class="card">${(m.scores || [])
          .map(
            (row) => `<div style="margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px">
                <span>${K.esc(row.entity)}</span><span>${row.score} · ${K.badge(row.level, 'badge-black')}</span>
              </div>${K.bar(row.score)}
              <small class="muted">Source: Measurement Engine · Formula: domain aggregate</small>
            </div>`
          )
          .join('')}</article>`;
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
        bodyHtml: `<p>كل درجة لها مصدر. المؤشرات تحمل صيغة صريحة. إعادة الحساب تُحدّث القيم وتُسجَّل في Audit.</p>`,
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
      { key: 'needs', label: 'Needs Action', value: needs.length, tab: 'generated' },
    ];

    let body = '';
    if (rpUi.tab === 'generated') {
      body = `${K.renderNeeds('rp', needs)}
        <div class="tabs" style="margin-top:10px">${types
          .map((t) => `<button type="button" class="tab ${rpUi.type === t ? 'active' : ''}" data-action="rp-type" data-type="${t}">${K.esc(titles[t])}</button>`)
          .join('')}</div>
        <div class="toolbar">
          <button type="button" class="btn btn-primary" data-action="rp-gen" data-type="${rpUi.type}"><i class="fas fa-file-lines"></i> توليد ${K.esc(titles[rpUi.type] || '')}</button>
        </div>
        <article class="card">${
          (r.generated || []).length
            ? (r.generated || [])
                .slice(0, 20)
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
            : '<div class="empty">لا تقارير بعد — اضغط توليد</div>'
        }</article>`;
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
    { id: 'apis', label: 'مسارات API', icon: 'fa-code' },
    { id: 'audit', label: 'سجل العمليات', icon: 'fa-clock-rotate-left' },
  ];

  const renderIntegration = () => {
    const K = Kit();
    const i = store().get().integration || {};
    const disconnected = (i.connectors || []).filter((c) => c.status !== 'connected');
    const needs = disconnected.map((c) => ({ text: `موصل غير متصل: ${c.name}`, tab: 'connectors', id: c.id }));

    const kpis = [
      { key: 'status', label: 'البوابة', value: i.gateway?.status || '—', hint: 'API Gateway', tab: 'gateway' },
      { key: 'rps', label: 'الطلبات/ث', value: i.gateway?.rps ?? 0, tab: 'gateway' },
      { key: 'latency', label: 'الكمون', value: `${i.gateway?.latencyMs ?? 0}ms`, tab: 'gateway' },
      { key: 'errors', label: 'الأخطاء', value: `${i.gateway?.errors ?? 0}%`, tab: 'gateway' },
      { key: 'needs', label: 'Needs Action', value: needs.length, tab: 'connectors' },
    ];

    let body = '';
    if (igUi.tab === 'gateway') {
      body = `${K.renderNeeds('ig', needs)}
        <div class="toolbar"><button type="button" class="btn btn-primary" data-action="ig-ping"><i class="fas fa-satellite-dish"></i> فحص البوابة</button></div>
        <article class="card"><p>آخر فحص: ${K.fmtTime(i.gateway?.lastPingAt)} · Source: API Gateway</p></article>`;
    } else if (igUi.tab === 'connectors') {
      body = `<article class="card">
        <div class="toolbar"><button type="button" class="btn btn-primary" data-action="ig-conn-create"><i class="fas fa-plus"></i> موصل</button></div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>الموصل</th><th>النوع</th><th>الحالة</th><th>آخر مزامنة</th><th>المصدر</th><th></th></tr></thead>
          <tbody>${
            (i.connectors || [])
              .map(
                (c) => `<tr>
                  <td>${K.esc(c.name)}</td><td>${K.esc(c.type)}</td>
                  <td>${K.badge(c.status, c.status === 'connected' ? 'badge-black' : 'badge-red')}</td>
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
                <td>${K.fmtTime(l.at)}</td><td>${K.esc(l.connector)}</td>
                <td>${K.badge(l.status, l.status === 'success' ? 'badge-black' : 'badge-red')}</td>
                <td>${K.esc(l.detail)}</td><td>${K.esc(l.source || '—')}</td>
              </tr>`
            )
            .join('') || '<tr><td colspan="5" class="empty">لا مزامنات بعد</td></tr>'
        }</tbody></table></div></article>`;
    } else if (igUi.tab === 'apis') {
      body = `<article class="card"><div class="table-wrap"><table class="data">
        <thead><tr><th>Method</th><th>Path</th><th>Calls</th></tr></thead>
        <tbody>${(i.apis || []).map((a) => `<tr><td>${K.badge(a.method, 'badge-red')}</td><td>${K.esc(a.path)}</td><td>${a.calls}</td></tr>`).join('')}</tbody>
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
              <select id="ig-type">${['internal', 'external', 'ai', 'client'].map((t) => `<option ${igUi.modal.data?.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
            </div>
            <div class="field"><label>الحالة</label>
              <select id="ig-status">${['connected', 'disconnected', 'partial'].map((t) => `<option ${igUi.modal.data?.status === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
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
        subtitle: 'موصلات · مزامنة · API · تدقيق',
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
        bodyHtml: `<p>افحص البوابة، أدر الموصلات، ونفّذ مزامنة يدوية. كل مزامنة تُسجَّل في سجل المزامنة وAudit.</p>`,
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
      { key: 'needs', label: 'Needs Action', value: needs.length, tab: 'decisions' },
    ];

    let body = '';
    if (crUi.tab === 'engines') {
      body = `${K.renderNeeds('cr', needs)}
        <div class="engine-grid" style="margin-top:12px">${[
          ['Decision', health.decision],
          ['Predictive', health.predictive],
          ['Optimization', health.optimization],
          ['Anomaly', health.anomaly],
          ['Knowledge', health.knowledge],
        ]
          .map(([n, v]) => `<div class="engine-pill"><span>${n}</span><strong>${v || 0}%</strong></div>`)
          .join('')}</div>
        <article class="card" style="margin-top:12px">
          <h3>تحسينات مقترحة</h3>
          ${(s.optimizations || [])
            .map(
              (o) => `<div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px">
                <b>${K.esc(o.target)}</b> · ${K.badge(o.gain, 'badge-red')}
                <div style="margin-top:6px;font-size:13px;color:var(--muted)">${K.esc(o.suggestion)}</div>
                <small>Source: Optimization Engine · Explainable suggestion (not opaque AI)</small>
              </div>`
            )
            .join('') || '<p class="empty">لا اقتراحات</p>'}
        </article>`;
    } else if (crUi.tab === 'decisions') {
      body = `<article class="card">
        <div class="toolbar" style="flex-wrap:wrap">
          <div class="field"><label>قرار جديد</label><input id="cr-decision-title" placeholder="عنوان القرار" /></div>
          <div class="field"><label>المحرك</label>
            <select id="cr-decision-engine"><option>AI Decision</option><option>Predictive</option><option>Optimization</option><option>Anomaly</option></select>
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
                  <td>${K.esc(d.title)}</td><td>${K.esc(d.engine)}</td>
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
              <small>Source: ${K.esc(ins.source)} · Confidence: ${ins.confidence}% · ${K.fmtTime(ins.at)}</small>
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
  window.HubCoreWS = { render: renderCore, handle: handleCore, ui: crUi };
})();
