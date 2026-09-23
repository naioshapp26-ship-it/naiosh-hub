/**
 * NAIOSH HUB 360 — Central Intelligence & Decision Center
 * Full enterprise workspace for core / العقل المركزي
 */
(() => {
  'use strict';

  const Kit = () => window.HubWsKit;
  const store = () => window.HubStore;

  const STATUS_AR = {
    Draft: 'مسودة',
    'Pending Review': 'بانتظار المراجعة',
    'Pending Approval': 'بانتظار الاعتماد',
    Approved: 'معتمد',
    Executed: 'منفّذ',
    Rejected: 'مرفوض',
    Archived: 'مؤرشف',
  };
  const STATUS_BADGE = {
    Draft: 'badge-gray',
    'Pending Review': 'badge-outline',
    'Pending Approval': 'badge-red',
    Approved: 'badge-black',
    Executed: 'badge-black',
    Rejected: 'badge-red',
    Archived: 'badge-outline',
  };

  const MODULES = ['المهام', 'القوى العاملة', 'القياس', 'أمن المعلومات', 'الحوكمة', 'حوكمة البيانات', 'العملاء', 'المبيعات', 'الأنظمة', 'التكامل'];
  const SOURCE_TYPES = ['يدوي', 'تحليل ذكي', 'محرك القواعد', 'شذوذ', 'تنبؤ', 'توصية', 'نظام خارجي'];

  const CR_TABS = [
    { id: 'overview', label: 'نظرة عامة', icon: 'fa-gauge' },
    { id: 'decisions', label: 'القرارات', icon: 'fa-gavel' },
    { id: 'recommendations', label: 'التوصيات', icon: 'fa-lightbulb' },
    { id: 'insights', label: 'الرؤى', icon: 'fa-eye' },
    { id: 'predictions', label: 'التنبؤات', icon: 'fa-binoculars' },
    { id: 'anomalies', label: 'حالات الشذوذ', icon: 'fa-triangle-exclamation' },
    { id: 'rules', label: 'قواعد القرار', icon: 'fa-code-branch' },
    { id: 'sources', label: 'مصادر البيانات', icon: 'fa-database' },
    { id: 'executions', label: 'سجل التنفيذ', icon: 'fa-play' },
    { id: 'approvals', label: 'الموافقات', icon: 'fa-stamp' },
    { id: 'reports', label: 'التقارير', icon: 'fa-chart-column' },
    { id: 'settings', label: 'الإعدادات', icon: 'fa-gear' },
  ];

  const ui = {
    tab: 'overview',
    page: 1,
    pageSize: 25,
    filters: { q: '', status: '', source: '', impact: '', owner: '' },
    kpiFocus: '',
    helpOpen: false,
    addMenu: false,
    moreId: null,
    modal: null,
    drawer: null,
    wizard: null,
    confirm: null,
    detailTab: 'overview',
    approvalFilter: 'inbox',
  };

  const core = () => store().coreBag?.() || store().get()?.core || {};
  const actor = (ctx) => Kit().actorName(ctx?.user);

  const confTip = (n) =>
    `title="درجة ثقة التحليل بناءً على جودة البيانات والنموذج · ${n}% — اضغط للتفاصيل"`;

  const statusBadge = (st) => Kit().badge(STATUS_AR[st] || window.HubI18n?.display?.(st) || st, STATUS_BADGE[st] || 'badge-outline');

  const needsItems = (c) => {
    const items = [];
    const pending = (c.decisions || []).filter((d) => d.status === 'Pending Approval' || d.status === 'Pending Review');
    if (pending.length) items.push({ text: `${pending.length} قرار بانتظار موافقتك`, tab: 'approvals' });
    const crit = (c.anomalies || []).filter((a) => a.status !== 'Closed' && (a.severity === 'حرج' || a.score >= 80));
    if (crit.length) items.push({ text: `${crit.length} حالة شذوذ حرجة`, tab: 'anomalies' });
    const recs = (c.recommendations || []).filter((r) => r.status === 'New');
    if (recs.length) items.push({ text: `${recs.length} توصيات تحتاج مراجعة`, tab: 'recommendations' });
    const failed = (c.executions || []).filter((e) => e.status === 'Failed');
    if (failed.length) items.push({ text: `${failed.length} تنفيذ فشل`, tab: 'executions' });
    const disc = (c.dataSources || []).filter((s) => s.status !== 'Connected');
    if (disc.length) items.push({ text: `${disc.length} مصادر بيانات غير متصلة`, tab: 'sources' });
    return items;
  };

  const successRate = (c) => {
    const executed = (c.decisions || []).filter((d) => d.status === 'Executed');
    const measured = executed.filter((d) => d.impactResult);
    const ok = measured.filter((d) => d.impactResult === 'Effective' || d.impactResult === 'Partial');
    const rate = measured.length ? Math.round((ok.length / measured.length) * 1000) / 10 : 0;
    return { executed: executed.length, measured: measured.length, ok: ok.length, rate };
  };

  const filterDecisions = (list) => {
    const f = ui.filters;
    return (list || []).filter((d) => {
      if (ui.kpiFocus === 'pending' && !['Pending Approval', 'Pending Review'].includes(d.status)) return false;
      if (ui.kpiFocus === 'executed' && d.status !== 'Executed') return false;
      if (ui.kpiFocus === 'needs' && !['Pending Approval', 'Pending Review', 'Approved'].includes(d.status)) return false;
      if (f.status && d.status !== f.status) return false;
      if (f.source && d.sourceType !== f.source) return false;
      if (f.impact && d.impact !== f.impact) return false;
      if (f.owner && !(d.owner || '').includes(f.owner)) return false;
      if (f.q) {
        const hay = `${d.decisionId} ${d.title} ${d.sourceType} ${d.engine} ${d.createdBy} ${d.approvedBy}`.toLowerCase();
        if (!hay.includes(f.q.toLowerCase())) return false;
      }
      return true;
    });
  };

  const headerActions = () => `
    <div class="hub-ci-add-wrap">
      <button type="button" class="btn btn-primary btn-sm" data-action="cr-add-menu"><i class="fas fa-plus"></i> إضافة</button>
      ${
        ui.addMenu
          ? `<div class="hub-ci-menu">
              <button type="button" data-action="cr-wizard-decision"><i class="fas fa-gavel"></i> إضافة قرار</button>
              <button type="button" data-action="cr-add-rec"><i class="fas fa-lightbulb"></i> إضافة توصية</button>
              <button type="button" data-action="cr-add-insight"><i class="fas fa-eye"></i> إضافة رؤية Insight</button>
              <button type="button" data-action="cr-add-pred"><i class="fas fa-binoculars"></i> إضافة تنبؤ</button>
              <button type="button" data-action="cr-add-anom"><i class="fas fa-triangle-exclamation"></i> تسجيل شذوذ</button>
              <button type="button" data-action="cr-add-rule"><i class="fas fa-code-branch"></i> إضافة قاعدة قرار</button>
              <button type="button" data-action="cr-add-source"><i class="fas fa-database"></i> إضافة مصدر بيانات</button>
            </div>`
          : ''
      }
    </div>
    <button type="button" class="btn btn-dark btn-sm" data-action="cr-request-analysis"><i class="fas fa-magnifying-glass-chart"></i> طلب تحليل</button>
    <button type="button" class="btn btn-dark btn-sm" data-action="cr-run-analysis"><i class="fas fa-bolt"></i> تشغيل التحليل</button>
    <button type="button" class="btn btn-ghost btn-sm" data-action="cr-tab" data-tab="approvals"><i class="fas fa-stamp"></i> الموافقات</button>
    <button type="button" class="btn btn-ghost btn-sm" data-action="cr-tab" data-tab="reports"><i class="fas fa-chart-column"></i> التقارير</button>
    <button type="button" class="btn btn-ghost btn-sm" data-action="cr-tab" data-tab="settings"><i class="fas fa-gear"></i> الإعدادات</button>
    <button type="button" class="btn btn-ghost btn-sm" data-action="cr-help-open" title="دليل الاستخدام"><i class="fas fa-circle-question"></i></button>`;

  const explainCard = () => `
    <article class="card hub-ci-explain">
      <h3><span class="title-left"><i class="fas fa-brain icon"></i> ما هو العقل المركزي؟</span>
        <button type="button" class="btn btn-sm btn-ghost" data-action="cr-help-open">؟ كيف أستخدمه</button></h3>
      <p>العقل المركزي يجمع البيانات من أنظمة المنصة، يحللها، يكشف المشكلات والفرص، ويقدم توصيات وقرارات قابلة للمراجعة والتنفيذ.</p>
      <div class="hub-ci-flow" aria-label="مسار القرار">
        <span>بيانات</span><i class="fas fa-arrow-left"></i>
        <span>تحليل</span><i class="fas fa-arrow-left"></i>
        <span>رؤية</span><i class="fas fa-arrow-left"></i>
        <span>توصية</span><i class="fas fa-arrow-left"></i>
        <span>قرار</span><i class="fas fa-arrow-left"></i>
        <span>موافقة</span><i class="fas fa-arrow-left"></i>
        <span>تنفيذ</span><i class="fas fa-arrow-left"></i>
        <span>قياس النتيجة</span>
      </div>
      <div class="hub-ci-glossary">
        <span><b>Decision</b> قرار قابل للاعتماد والتنفيذ</span>
        <span><b>Insight</b> رؤية مستخلصة من البيانات</span>
        <span><b>Recommendation</b> توصية قابلة للتحويل لقرار</span>
        <span><b>Prediction</b> تنبؤ بمستقبل مؤشر</span>
        <span><b>Anomaly</b> شذوذ يحتاج تحقيقًا</span>
      </div>
    </article>`;

  const searchFilters = (showStatus = true) => {
    const K = Kit();
    return `<div class="toolbar hub-ci-filters" style="flex-wrap:wrap;gap:8px;margin:10px 0">
      <div class="field" style="min-width:220px;flex:1"><label>بحث</label>
        <input data-cr-change="q" value="${K.esc(ui.filters.q)}" placeholder="ابحث في القرارات والرؤى والتوصيات..." /></div>
      ${
        showStatus
          ? `<div class="field"><label>الحالة</label>
        <select data-cr-change="status"><option value="">الكل</option>
          ${Object.keys(STATUS_AR).map((s) => `<option value="${s}" ${ui.filters.status === s ? 'selected' : ''}>${STATUS_AR[s]}</option>`).join('')}
        </select></div>`
          : ''
      }
      <div class="field"><label>المصدر</label>
        <select data-cr-change="source"><option value="">الكل</option>
          ${SOURCE_TYPES.map((s) => `<option value="${s}" ${ui.filters.source === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select></div>
      <div class="field"><label>حجم الصفحة</label>
        <select data-cr-change="pageSize">${[10, 25, 50, 100].map((n) => `<option value="${n}" ${ui.pageSize === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </div>
    </div>`;
  };

  const moreMenu = (id, items) => {
    if (ui.moreId !== id) return '';
    return `<div class="hub-ci-menu hub-ci-menu-inline">${items
      .map((it) => `<button type="button" data-action="${Kit().esc(it.action)}" data-id="${Kit().esc(id)}" ${it.extra || ''}>${it.label}</button>`)
      .join('')}</div>`;
  };

  const decisionActions = (d) => {
    const pending = d.status === 'Pending Approval' || d.status === 'Pending Review';
    const canExec = d.status === 'Approved' || d.status === 'Pending Approval';
    const canEdit = !['Executed', 'Approved', 'Archived'].includes(d.status);
    return `<div class="toolbar hub-ci-row-actions" style="margin:0;gap:4px;position:relative;flex-wrap:wrap">
      <button type="button" class="btn btn-sm btn-ghost" data-action="cr-view" data-id="${d.id}">عرض</button>
      ${pending ? `<button type="button" class="btn btn-sm btn-primary" data-action="cr-approve" data-id="${d.id}">اعتماد</button>
        <button type="button" class="btn btn-sm btn-dark" data-action="cr-reject" data-id="${d.id}">رفض</button>` : ''}
      ${canEdit ? `<button type="button" class="btn btn-sm btn-ghost" data-action="cr-edit" data-id="${d.id}">تعديل</button>` : `<button type="button" class="btn btn-sm btn-ghost" data-action="cr-revise" data-id="${d.id}">نسخة معدّلة</button>`}
      ${canExec && d.status !== 'Executed' ? `<button type="button" class="btn btn-sm btn-primary" data-action="cr-exec-preview" data-id="${d.id}">تنفيذ</button>` : ''}
      <button type="button" class="btn btn-sm btn-ghost" data-action="cr-preview" data-id="${d.id}">معاينة</button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="cr-more" data-id="${d.id}">⋮</button>
      ${moreMenu(d.id, [
        { action: 'cr-submit-review', label: 'إرسال للمراجعة' },
        { action: 'cr-submit-approval', label: 'إرسال للاعتماد' },
        { action: 'cr-clone', label: 'نسخ' },
        { action: 'cr-reanalyze', label: 'إعادة التحليل' },
        { action: 'cr-exec-log', label: 'سجل التنفيذ' },
        { action: 'cr-archive', label: 'الأرشفة' },
        { action: 'cr-delete', label: 'الحذف' },
      ])}
    </div>`;
  };

  const renderDecisionTable = (rows) => {
    const K = Kit();
    if (!rows.length) {
      return `<div class="empty">لا توجد قرارات مسجلة حتى الآن.
        <div class="toolbar" style="justify-content:center;margin-top:10px">
          <button type="button" class="btn btn-primary" data-action="cr-wizard-decision"><i class="fas fa-plus"></i> إضافة أول قرار</button>
        </div></div>`;
    }
    return `<div class="table-wrap"><table class="data hub-ci-table">
      <thead><tr>
        <th>Decision ID</th><th>عنوان القرار</th><th>النوع</th><th>المصدر</th><th>المحرك</th>
        <th>الأثر</th><th>الثقة</th><th>أنشئ بواسطة</th><th>اعتمد بواسطة</th><th>الحالة</th><th>تاريخ الإنشاء</th><th>الإجراءات</th>
      </tr></thead>
      <tbody>${rows
        .map(
          (d) => `<tr>
            <td><code>${K.esc(d.decisionId || d.id)}</code></td>
            <td><button type="button" class="btn btn-sm btn-ghost" data-action="cr-view" data-id="${d.id}" style="font-weight:800">${K.esc(d.title)}</button></td>
            <td>${K.esc(d.type || '—')}</td>
            <td>${K.badge(d.sourceType || '—', 'badge-outline')}</td>
            <td>${K.esc(d.engine || '—')}</td>
            <td>${K.esc(d.impact || '—')}</td>
            <td><button type="button" class="btn btn-sm btn-ghost" data-action="cr-conf" data-id="${d.id}" ${confTip(d.confidence)}>${d.confidence ?? '—'}%</button></td>
            <td>${K.esc(d.createdBy || '—')}</td>
            <td>${K.esc(d.approvedBy || '—')}</td>
            <td>${statusBadge(d.status)}</td>
            <td>${K.fmtTime(d.createdAt || d.at)}</td>
            <td>${decisionActions(d)}</td>
          </tr>`
        )
        .join('')}</tbody>
    </table></div>`;
  };

  const renderDecisionDrawer = (d) => {
    const K = Kit();
    const tab = ui.detailTab;
    const tabs = [
      ['overview', 'نظرة عامة'],
      ['data', 'البيانات المستخدمة'],
      ['analysis', 'التحليل'],
      ['recommendation', 'التوصية'],
      ['approvals', 'الموافقات'],
      ['execution', 'التنفيذ'],
      ['impact', 'النتائج'],
      ['history', 'السجل'],
    ];
    let body = '';
    if (tab === 'overview') {
      body = `
        <div class="kpi-grid">
          <article class="kpi"><span>الحالة</span><strong>${statusBadge(d.status)}</strong></article>
          <article class="kpi"><span>Impact</span><strong>${K.esc(d.impact)}</strong></article>
          <article class="kpi"><span>Confidence</span><strong ${confTip(d.confidence)}>${d.confidence}%</strong></article>
          <article class="kpi"><span>Priority</span><strong>${K.esc(d.priority)}</strong></article>
        </div>
        <p>${K.esc(d.description || d.rationale || '')}</p>
        <article class="card" style="margin-top:10px">
          <h4>مصدر القرار</h4>
          <ul class="feed">
            <li><b>مصدر القرار:</b> ${K.esc(d.sourceType)} · ${K.esc(d.engine)}</li>
            <li><b>تم إنشاؤه بواسطة:</b> ${K.esc(d.createdBy)}</li>
            <li><b>Created At:</b> ${K.fmtTime(d.createdAt || d.at)}</li>
            <li><b>Source Modules:</b> ${K.esc((d.sourceModules || []).join(' + ') || '—')}</li>
            <li><b>Data Used:</b> ${K.esc(d.dataUsed || '—')}</li>
            <li><b>Model / Rule:</b> ${K.esc(d.model || '—')}</li>
            <li><b>آخر تحديث:</b> ${K.fmtTime(d.updatedAt)}</li>
            <li><b>Owner / Reviewer / Approver:</b> ${K.esc(d.owner || '—')} · ${K.esc(d.reviewer || '—')} · ${K.esc(d.approver || d.approvedBy || '—')}</li>
          </ul>
        </article>`;
    } else if (tab === 'data') {
      body = `<h4>البيانات الداعمة</h4>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>مصدر البيانات</th><th>المؤشر</th><th>القيمة</th><th>الفترة</th><th>آخر تحديث</th></tr></thead>
          <tbody>${
            (d.evidence || [])
              .map(
                (e) =>
                  `<tr><td>${K.esc(e.source)}</td><td>${K.esc(e.metric)}</td><td>${K.esc(e.value)}</td><td>${K.esc(e.period)}</td><td>${K.fmtTime(e.updatedAt)}</td></tr>`
              )
              .join('') || '<tr><td colspan="5" class="empty">لا أدلة بيانات</td></tr>'
          }</tbody>
        </table></div>`;
    } else if (tab === 'analysis') {
      body = `<h4>لماذا تم اقتراح هذا القرار؟</h4>
        <ul>${(d.reasoning || []).map((r) => `<li>${K.esc(r)}</li>`).join('') || `<li>${K.esc(d.reason || d.rationale || '—')}</li>`}</ul>
        <p class="muted">Explainable Summary فقط — بدون Chain of Thought داخلي.</p>`;
    } else if (tab === 'recommendation') {
      body = `<h4>التوصية</h4><p>${K.esc(d.recommendation || '—')}</p>
        <p><b>المبرر:</b> ${K.esc(d.reason || d.rationale || '—')}</p>`;
    } else if (tab === 'approvals') {
      body = `<ul class="feed">
        <li>المراجع: ${K.esc(d.reviewer || '—')}</li>
        <li>المعتمد: ${K.esc(d.approver || d.approvedBy || '—')}</li>
        <li>الحالة: ${statusBadge(d.status)}</li>
      </ul>
      <div class="toolbar">
        <button type="button" class="btn btn-primary" data-action="cr-approve" data-id="${d.id}">اعتماد</button>
        <button type="button" class="btn btn-dark" data-action="cr-reject" data-id="${d.id}">رفض</button>
        <button type="button" class="btn btn-ghost" data-action="cr-submit-review" data-id="${d.id}">طلب تعديل / مراجعة</button>
      </div>`;
    } else if (tab === 'execution') {
      const ex = (core().executions || []).filter((e) => e.decisionRef === d.id || e.decisionId === d.decisionId);
      body = `<div class="toolbar">
          <button type="button" class="btn btn-primary" data-action="cr-exec-preview" data-id="${d.id}">تنفيذ</button>
          <button type="button" class="btn btn-ghost" data-action="cr-preview" data-id="${d.id}">معاينة الأثر</button>
        </div>
        ${
          ex.length
            ? ex
                .map(
                  (e) => `<article class="card" style="margin-top:8px">
                    <b>${K.esc(e.id)}</b> · ${K.badge(e.status, e.status === 'Success' ? 'badge-black' : 'badge-red')}
                    <p>${K.esc(e.result)}</p>
                    <ul>${(e.timeline || []).map((t) => `<li>${t.ok ? '✓' : '✕'} ${K.esc(t.text)}</li>`).join('')}</ul>
                  </article>`
                )
                .join('')
            : '<p class="empty">لا تنفيذ بعد</p>'
        }`;
    } else if (tab === 'impact') {
      body = `<h4>قياس أثر القرار</h4>
        <ul class="feed">
          <li><b>Expected:</b> ${K.esc(d.expectedOutcome || '—')}</li>
          <li><b>Actual:</b> ${K.esc(d.actualOutcome || '—')}</li>
          <li><b>Result:</b> ${K.esc(d.impactResult || '—')}</li>
        </ul>
        <h4>تقييم القرار</h4>
        <div class="toolbar" style="flex-wrap:wrap">
          ${['مفيد جداً', 'مفيد', 'محايد', 'غير مفيد']
            .map((r) => `<button type="button" class="btn btn-sm ${d.feedback?.rating === r ? 'btn-primary' : 'btn-ghost'}" data-action="cr-feedback" data-id="${d.id}" data-rating="${r}">${r}</button>`)
            .join('')}
        </div>
        <div class="field" style="margin-top:8px"><label>تعليق</label><input id="cr-feedback-note" value="${K.esc(d.feedback?.comment || '')}" placeholder="تعليق التقييم" />
          <button type="button" class="btn btn-dark btn-sm" data-action="cr-feedback-save" data-id="${d.id}" style="margin-top:6px">حفظ التقييم</button></div>`;
    } else {
      body = `<ul class="feed">${(d.history || [])
        .map((h) => `<li><b>${K.esc(h.action)}</b> — ${K.esc(h.detail || '')} · ${K.esc(h.by)} <small>${K.fmtTime(h.at)}</small></li>`)
        .join('') || '<li>لا سجل</li>'}</ul>`;
    }

    return K.renderDrawer('cr', {
      title: `${d.decisionId || ''} · ${d.title}`,
      bodyHtml: `
        <div class="toolbar" style="flex-wrap:wrap;margin-bottom:10px">
          <button type="button" class="btn btn-sm btn-ghost" data-action="cr-edit" data-id="${d.id}">تعديل</button>
          <button type="button" class="btn btn-sm btn-primary" data-action="cr-approve" data-id="${d.id}">اعتماد</button>
          <button type="button" class="btn btn-sm btn-dark" data-action="cr-reject" data-id="${d.id}">رفض</button>
          <button type="button" class="btn btn-sm btn-primary" data-action="cr-exec-preview" data-id="${d.id}">تنفيذ</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="cr-preview" data-id="${d.id}">معاينة</button>
        </div>
        <div class="toolbar" style="flex-wrap:wrap;margin-bottom:10px">${tabs
          .map(
            ([id, label]) =>
              `<button type="button" class="btn btn-sm ${tab === id ? 'btn-primary' : 'btn-ghost'}" data-action="cr-detail-tab" data-tab="${id}">${label}</button>`
          )
          .join('')}</div>
        ${body}`,
    });
  };

  const wizardHtml = () => {
    const K = Kit();
    const w = ui.wizard;
    if (!w || w.kind !== 'decision') return '';
    const step = w.step || 1;
    const d = w.data || {};
    const steps = ['معلومات', 'المصدر', 'البيانات', 'المبرر', 'الأثر', 'الموافقة', 'مراجعة'];
    let body = '';
    if (step === 1) {
      body = `<div class="grid-2">
        <div class="field"><label>عنوان القرار *</label><input id="cr-w-title" value="${K.esc(d.title || '')}" /></div>
        <div class="field"><label>الفئة</label><input id="cr-w-category" value="${K.esc(d.category || 'Operations')}" /></div>
        <div class="field" style="grid-column:1/-1"><label>الوصف *</label><textarea id="cr-w-desc" rows="3">${K.esc(d.description || '')}</textarea></div>
        <div class="field"><label>الأولوية</label>
          <select id="cr-w-priority">${['عاجل', 'عالي', 'متوسط', 'منخفض'].map((p) => `<option ${ (d.priority || 'متوسط') === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
        <div class="field"><label>المالك</label><input id="cr-w-owner" value="${K.esc(d.owner || '')}" /></div>
      </div>`;
    } else if (step === 2) {
      body = `<div class="field"><label>مصدر القرار</label>
        <select id="cr-w-sourceType">${SOURCE_TYPES.map((s) => `<option ${ (d.sourceType || 'يدوي') === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label>المحرك / النظام</label><input id="cr-w-engine" value="${K.esc(d.engine || '')}" placeholder="AI Decision / Rule Engine / Manual" /></div>`;
    } else if (step === 3) {
      body = `<p class="muted">اختر مصادر البيانات المستخدمة</p>
        <div class="hub-ci-checks">${MODULES.map(
          (m) =>
            `<label><input type="checkbox" data-cr-mod="${K.esc(m)}" ${(d.sourceModules || []).includes(m) ? 'checked' : ''}/> ${K.esc(m)}</label>`
        ).join('')}</div>
        <div class="field" style="margin-top:8px"><label>فترة البيانات</label><input id="cr-w-dataUsed" value="${K.esc(d.dataUsed || 'آخر 30 يوم')}" /></div>`;
    } else if (step === 4) {
      body = `<div class="field"><label>لماذا يتم اتخاذ هذا القرار؟ *</label>
        <textarea id="cr-w-reason" rows="4">${K.esc(d.reason || '')}</textarea></div>
        <div class="field"><label>نص التوصية</label><textarea id="cr-w-rec" rows="2">${K.esc(d.recommendation || '')}</textarea></div>`;
    } else if (step === 5) {
      body = `<div class="grid-2">
        <div class="field"><label>Affected Module</label><input id="cr-w-aff-mod" value="${K.esc(d.affectedModule || '')}" /></div>
        <div class="field"><label>Affected Users</label><input id="cr-w-aff-users" type="number" value="${K.esc(String(d.preview?.affectedUsers ?? 0))}" /></div>
        <div class="field"><label>Impact Level</label>
          <select id="cr-w-impact">${['عالي', 'متوسط', 'منخفض'].map((p) => `<option ${(d.impact || 'متوسط') === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
        <div class="field"><label>الأثر المتوقع</label><input id="cr-w-expected" value="${K.esc(d.expectedOutcome || '')}" /></div>
        <div class="field"><label>مهام متأثرة (معاينة)</label><input id="cr-w-tasks" type="number" value="${K.esc(String(d.preview?.tasks ?? 0))}" /></div>
        <div class="field"><label>درجة الثقة %</label><input id="cr-w-conf" type="number" value="${K.esc(String(d.confidence ?? 75))}" /></div>
      </div>`;
    } else if (step === 6) {
      body = `<div class="grid-2">
        <div class="field"><label>Reviewer</label><input id="cr-w-reviewer" value="${K.esc(d.reviewer || '')}" /></div>
        <div class="field"><label>Approver</label><input id="cr-w-approver" value="${K.esc(d.approver || '')}" /></div>
        <div class="field"><label><input type="checkbox" id="cr-w-sensitive" ${d.sensitive ? 'checked' : ''}/> قرار حسّاس (يتطلب موافقة)</label></div>
      </div>`;
    } else {
      body = `<ul class="feed">
        <li><b>العنوان:</b> ${K.esc(d.title)}</li>
        <li><b>المصدر:</b> ${K.esc(d.sourceType)} · ${K.esc(d.engine)}</li>
        <li><b>الوحدات:</b> ${K.esc((d.sourceModules || []).join(', '))}</li>
        <li><b>المبرر:</b> ${K.esc(d.reason)}</li>
        <li><b>الأثر:</b> ${K.esc(d.impact)} · ثقة ${d.confidence}%</li>
        <li><b>المراجع/المعتمد:</b> ${K.esc(d.reviewer || '—')} / ${K.esc(d.approver || '—')}</li>
      </ul>`;
    }

    return K.renderModal('cr', {
      title: `معالج قرار — ${steps[step - 1]} (${step}/7)`,
      bodyHtml: `
        <div class="hub-ci-steps">${steps.map((s, i) => `<span class="${i + 1 === step ? 'on' : ''}">${i + 1}. ${s}</span>`).join('')}</div>
        ${body}`,
      footerHtml: `
        <button type="button" class="btn btn-ghost" data-action="cr-modal-close">إلغاء</button>
        ${step > 1 ? '<button type="button" class="btn btn-dark" data-action="cr-wiz-prev">السابق</button>' : ''}
        ${step < 7 ? '<button type="button" class="btn btn-primary" data-action="cr-wiz-next">التالي</button>' : ''}
        ${
          step === 7
            ? `<button type="button" class="btn btn-ghost" data-action="cr-wiz-save" data-status="Draft">حفظ كمسودة</button>
               <button type="button" class="btn btn-dark" data-action="cr-wiz-save" data-status="Pending Review">إرسال للمراجعة</button>
               <button type="button" class="btn btn-primary" data-action="cr-wiz-save" data-status="Pending Approval">إرسال للاعتماد</button>`
            : ''
        }`,
    });
  };

  const simpleFormModal = () => {
    const K = Kit();
    const m = ui.modal;
    if (!m) return '';
    return K.renderModal('cr', {
      title: m.title,
      bodyHtml: m.bodyHtml,
      footerHtml: `<button type="button" class="btn btn-ghost" data-action="cr-modal-close">إلغاء</button>
        <button type="button" class="btn btn-primary" data-action="${K.esc(m.saveAction)}">حفظ</button>`,
    });
  };

  const confirmModal = () => {
    const K = Kit();
    const c = ui.confirm;
    if (!c) return '';
    return K.renderModal('cr', {
      title: c.title,
      bodyHtml: `<p>${K.esc(c.message)}</p>`,
      footerHtml: `<button type="button" class="btn btn-ghost" data-action="cr-confirm-cancel">إلغاء</button>
        <button type="button" class="btn btn-primary" data-action="cr-confirm-ok">${K.esc(c.okLabel || 'تأكيد')}</button>`,
    });
  };

  const renderOverview = (c, needs) => {
    const K = Kit();
    const sr = successRate(c);
    const recent = (c.decisions || []).slice(0, 5);
    const openAnom = (c.anomalies || []).filter((a) => a.status !== 'Closed').slice(0, 4);
    const recs = (c.recommendations || []).filter((r) => r.status === 'New').slice(0, 4);
    return `${K.renderNeeds('cr', needs)}
      <div class="hub-op-rail">
        <article class="card hub-op-panel">
          <h3><span class="title-left"><i class="fas fa-bolt icon"></i> غرفة القرار</span></h3>
          <div class="hub-op-pulse">
            <div><span>نسبة نجاح القرارات المنفّذة</span><strong ${confTip(sr.rate)}>${sr.rate}%</strong>${K.bar(sr.rate)}
              <small class="muted">${sr.ok} من ${sr.measured} قرار مقاس · ${sr.executed} منفّذ</small></div>
            <div><span>دقة/ثقة التنبؤ</span><strong ${confTip(c.engineHealth?.predictive)}>${c.engineHealth?.predictive || 0}%</strong>${K.bar(c.engineHealth?.predictive)}
              <small class="muted">Model Forecast v1 · Last Evaluation الآن · مصدر Predictive Engine</small></div>
          </div>
          <div class="toolbar" style="margin-top:10px;flex-wrap:wrap">
            <button type="button" class="btn btn-primary" data-action="cr-wizard-decision"><i class="fas fa-plus"></i> إضافة قرار</button>
            <button type="button" class="btn btn-dark" data-action="cr-run-analysis">تشغيل التحليل</button>
            <button type="button" class="btn btn-ghost" data-action="cr-tab" data-tab="decisions">كل القرارات</button>
          </div>
        </article>
        <article class="card hub-op-panel">
          <h3><span class="title-left"><i class="fas fa-inbox icon"></i> يحتاج إلى إجراء</span></h3>
          <ul class="hub-op-mini-list">${
            needs.map((n) => `<li><b>${K.esc(n.text)}</b><button type="button" class="btn btn-sm btn-ghost" data-action="cr-tab" data-tab="${n.tab}">فتح</button></li>`).join('') ||
            '<li class="empty">غرفة العمليات مستقرة</li>'
          }</ul>
        </article>
      </div>
      <div class="hub-op-grid3" style="margin-top:12px">
        <article class="card hub-op-panel">
          <h3><span class="title-left"><i class="fas fa-gavel icon"></i> آخر القرارات</span>
            <button type="button" class="btn btn-sm btn-ghost" data-action="cr-tab" data-tab="decisions">الكل</button></h3>
          <ul class="hub-op-mini-list">${recent
            .map((d) => `<li><b>${K.esc(d.title)}</b><small>${K.esc(d.sourceType)} · ${K.esc(d.createdBy)}</small>${statusBadge(d.status)}</li>`)
            .join('')}</ul>
        </article>
        <article class="card hub-op-panel">
          <h3><span class="title-left"><i class="fas fa-lightbulb icon"></i> توصيات جديدة</span>
            <button type="button" class="btn btn-sm btn-ghost" data-action="cr-tab" data-tab="recommendations">الكل</button></h3>
          <ul class="hub-op-mini-list">${recs
            .map((r) => `<li><b>${K.esc(r.title)}</b><small>${K.esc(r.source)} · ثقة ${r.confidence}%</small>
              <button type="button" class="btn btn-sm btn-primary" data-action="cr-rec-convert" data-id="${r.id}">تحويل لقرار</button></li>`)
            .join('') || '<li class="empty">لا توجد توصيات جديدة</li>'}</ul>
        </article>
        <article class="card hub-op-panel">
          <h3><span class="title-left"><i class="fas fa-triangle-exclamation icon"></i> شذوذ مفتوح</span>
            <button type="button" class="btn btn-sm btn-ghost" data-action="cr-tab" data-tab="anomalies">الكل</button></h3>
          <ul class="hub-op-mini-list">${openAnom
            .map((a) => `<li><b>${K.esc(a.signal || a.metric)}</b><small>${K.esc(a.source)}</small>${K.badge(a.severity || a.status, 'badge-red')}</li>`)
            .join('') || '<li class="empty">لا شذوذ مفتوح</li>'}</ul>
        </article>
      </div>
      <article class="card" style="margin-top:12px">
        <h3>النشاط الأخير</h3>
        <ul class="feed">${(c.auditLog || [])
          .slice(0, 8)
          .map((a) => `<li><b>${K.esc(a.action)}</b> — ${K.esc(a.detail)} · ${K.esc(a.by)} <small>${K.fmtTime(a.at)}</small></li>`)
          .join('') || '<li>لا نشاط</li>'}</ul>
      </article>`;
  };

  const render = (ctx = {}) => {
    const K = Kit();
    store().hydrateCoreIntelligence?.();
    const c = core();
    const needs = needsItems(c);
    const sr = successRate(c);
    const pending = (c.decisions || []).filter((d) => d.status === 'Pending Approval' || d.status === 'Pending Review').length;
    const executed = (c.decisions || []).filter((d) => d.status === 'Executed').length;
    const newInsights = (c.insights || []).filter((i) => i.status === 'New' || i.status === 'open').length;
    const activePred = (c.predictions || []).filter((p) => p.status !== 'Closed').length;
    const openAnom = (c.anomalies || []).filter((a) => a.status !== 'Closed').length;

    const kpis = [
      { key: 'total', label: 'إجمالي القرارات', value: (c.decisions || []).length, tab: 'decisions' },
      { key: 'pending', label: 'بانتظار الموافقة', value: pending, tab: 'decisions', hint: 'Pending' },
      { key: 'executed', label: 'تم التنفيذ', value: executed, tab: 'executions' },
      { key: 'needs', label: 'يحتاج إلى إجراء', value: needs.length, tab: 'overview' },
      { key: 'insights', label: 'الرؤى الجديدة', value: newInsights, tab: 'insights' },
      { key: 'preds', label: 'التنبؤات النشطة', value: activePred, tab: 'predictions' },
      { key: 'anom', label: 'شذوذ مفتوح', value: openAnom, tab: 'anomalies' },
      { key: 'success', label: 'نسبة نجاح القرارات', value: `${sr.rate}%`, tab: 'reports', hint: `${sr.ok}/${sr.measured}` },
    ];

    let body = '';
    if (ui.tab === 'overview') body = renderOverview(c, needs);
    else if (ui.tab === 'decisions') {
      const filtered = filterDecisions(c.decisions || []);
      const pg = K.paginate(filtered, ui.page, ui.pageSize);
      ui.page = pg.page;
      body = `${K.renderNeeds('cr', needs)}
        ${searchFilters(true)}
        <div class="toolbar"><button type="button" class="btn btn-primary" data-action="cr-wizard-decision"><i class="fas fa-plus"></i> إضافة قرار</button></div>
        <article class="card">${renderDecisionTable(pg.rows)}${K.renderPager('cr', pg.page, pg.pages, pg.total)}</article>`;
    } else if (ui.tab === 'recommendations') {
      const rows = c.recommendations || [];
      body = `${searchFilters(false)}
        <div class="toolbar"><button type="button" class="btn btn-primary" data-action="cr-add-rec"><i class="fas fa-plus"></i> توصية</button></div>
        <article class="card">${
          rows.length
            ? `<div class="table-wrap"><table class="data">
              <thead><tr><th>ID</th><th>Title</th><th>Source</th><th>Reason</th><th>Impact</th><th>Confidence</th><th>Suggested Action</th><th>Owner</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>${rows
                .map(
                  (r) => `<tr>
                    <td><code>${K.esc(r.id)}</code></td><td>${K.esc(r.title)}</td><td>${K.esc(r.source)}</td>
                    <td>${K.esc(r.reason)}</td><td>${K.esc(r.impact)}</td>
                    <td><span ${confTip(r.confidence)}>${r.confidence}%</span></td>
                    <td>${K.esc(r.suggestedAction)}</td><td>${K.esc(r.owner)}</td>
                    <td>${K.badge(r.status, 'badge-outline')}</td>
                    <td class="toolbar" style="margin:0;gap:4px">
                      <button type="button" class="btn btn-sm btn-ghost" data-action="cr-rec-view" data-id="${r.id}">عرض</button>
                      <button type="button" class="btn btn-sm btn-primary" data-action="cr-rec-convert" data-id="${r.id}">تحويل إلى قرار</button>
                      <button type="button" class="btn btn-sm btn-dark" data-action="cr-rec-dismiss" data-id="${r.id}">تجاهل</button>
                    </td>
                  </tr>`
                )
                .join('')}</tbody></table></div>`
            : '<div class="empty">لا توجد توصيات جديدة.</div>'
        }</article>`;
    } else if (ui.tab === 'insights') {
      body = `<div class="toolbar"><button type="button" class="btn btn-primary" data-action="cr-add-insight"><i class="fas fa-plus"></i> رؤية</button></div>
        <article class="card">${
          (c.insights || []).length
            ? (c.insights || [])
                .map(
                  (ins) => `<div style="border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px">
                    <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
                      <b>${K.esc(ins.insightId || ins.id)} · ${K.esc(ins.title)}</b>
                      ${K.badge(ins.severity || '—', 'badge-red')} ${K.badge(ins.status, 'badge-outline')}
                    </div>
                    <p class="muted">${K.esc(ins.summary || ins.rationale || '')}</p>
                    <small>المصدر: ${K.esc(ins.source)} · ${K.fmtTime(ins.generatedAt || ins.at)} · ثقة ${ins.confidence}%</small>
                    <div class="toolbar" style="margin-top:8px">
                      <button type="button" class="btn btn-sm btn-ghost" data-action="cr-ins-view" data-id="${ins.id}">عرض التفاصيل</button>
                      <button type="button" class="btn btn-sm btn-dark" data-action="cr-ins-to-rec" data-id="${ins.id}">إنشاء توصية</button>
                      <button type="button" class="btn btn-sm btn-primary" data-action="cr-ins-to-dec" data-id="${ins.id}">إنشاء قرار</button>
                    </div>
                  </div>`
                )
                .join('')
            : '<div class="empty">لا رؤى حالياً.</div>'
        }</article>`;
    } else if (ui.tab === 'predictions') {
      body = `<div class="toolbar"><button type="button" class="btn btn-primary" data-action="cr-add-pred">تنبؤ</button>
        <button type="button" class="btn btn-dark" data-action="cr-run-analysis">مسح تنبؤي</button></div>
        <article class="card">${
          (c.predictions || []).length
            ? `<div class="table-wrap"><table class="data">
              <thead><tr><th>ID</th><th>Title</th><th>Target</th><th>Predicted</th><th>Confidence</th><th>Period</th><th>Source</th><th>Model</th><th>Generated</th><th>Status</th></tr></thead>
              <tbody>${(c.predictions || [])
                .map(
                  (p) => `<tr>
                    <td><code>${K.esc(p.predictionId || p.id)}</code></td>
                    <td>${K.esc(p.title || p.risk)}</td><td>${K.esc(p.target || '—')}</td>
                    <td>${p.predictedValue ?? p.probability}%</td>
                    <td><span ${confTip(p.confidence)}>${p.confidence ?? '—'}%</span></td>
                    <td>${K.esc(p.period || p.eta)}</td><td>${K.esc(p.source || '—')}</td>
                    <td>${K.esc(p.model || '—')}</td><td>${K.fmtTime(p.generatedAt)}</td>
                    <td>${K.badge(p.status || 'Active', 'badge-black')}</td>
                  </tr>`
                )
                .join('')}</tbody></table></div>`
            : '<div class="empty">لا توجد تنبؤات متاحة حالياً.</div>'
        }</article>`;
    } else if (ui.tab === 'anomalies') {
      body = `<div class="toolbar"><button type="button" class="btn btn-primary" data-action="cr-add-anom">تسجيل شذوذ</button></div>
        <article class="card"><div class="table-wrap"><table class="data">
          <thead><tr><th>ID</th><th>Type</th><th>Source</th><th>Metric</th><th>Expected</th><th>Actual</th><th>Deviation</th><th>Severity</th><th>Detected</th><th>Owner</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${(c.anomalies || [])
            .map(
              (a) => `<tr>
                <td><code>${K.esc(a.anomalyId || a.id)}</code></td>
                <td>${K.esc(a.type)}</td><td>${K.esc(a.source)}</td><td>${K.esc(a.metric || a.signal)}</td>
                <td>${K.esc(a.expected)}</td><td>${K.esc(a.actual)}</td><td>${K.esc(a.deviation)}</td>
                <td>${K.badge(a.severity || '—', 'badge-red')}</td><td>${K.fmtTime(a.detectedAt)}</td>
                <td>${K.esc(a.owner)}</td><td>${K.badge(a.status, 'badge-outline')}</td>
                <td class="toolbar" style="margin:0;gap:4px">
                  <button type="button" class="btn btn-sm btn-dark" data-action="cr-anom-invest" data-id="${a.id}">تحقيق</button>
                  <button type="button" class="btn btn-sm btn-ghost" data-action="cr-anom-task" data-id="${a.id}">مهمة</button>
                  <button type="button" class="btn btn-sm btn-primary" data-action="cr-anom-dec" data-id="${a.id}">قرار</button>
                  <button type="button" class="btn btn-sm btn-ghost" data-action="cr-anom-close" data-id="${a.id}">إغلاق</button>
                </td>
              </tr>`
            )
            .join('') || '<tr><td colspan="12" class="empty">لا شذوذ</td></tr>'}</tbody>
        </table></div></article>`;
    } else if (ui.tab === 'rules') {
      body = `<div class="toolbar"><button type="button" class="btn btn-primary" data-action="cr-add-rule"><i class="fas fa-plus"></i> إضافة قاعدة</button></div>
        <article class="card">${(c.rules || [])
          .map(
            (r) => `<div style="border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px">
              <b>${K.esc(r.id)} · ${K.esc(r.name)}</b> ${K.badge(r.status, 'badge-black')} ${K.badge(r.severity, 'badge-red')}
              <p>إذا: <code>${K.esc(r.metric)} ${K.esc(r.operator)} ${r.value}</code>
                ${(r.extraConditions || []).map((x) => ` AND <code>${K.esc(x.metric)} ${K.esc(x.operator)} ${x.value}</code>`).join('')}
              </p>
              <p>THEN: <b>${K.esc(r.action)}</b> · الوحدة: ${K.esc(r.sourceModule)} · المالك: ${K.esc(r.owner)}</p>
            </div>`
          )
          .join('') || '<div class="empty">لا قواعد بعد</div>'}</article>`;
    } else if (ui.tab === 'sources') {
      body = `<div class="toolbar"><button type="button" class="btn btn-primary" data-action="cr-add-source">مصدر بيانات</button></div>
        <article class="card"><div class="table-wrap"><table class="data">
          <thead><tr><th>Source</th><th>Module</th><th>Type</th><th>Status</th><th>Last Sync</th><th>Records</th><th>Owner</th><th>Actions</th></tr></thead>
          <tbody>${(c.dataSources || [])
            .map(
              (s) => `<tr>
                <td>${K.esc(s.name)}</td><td>${K.esc(s.module)}</td><td>${K.esc(s.type)}</td>
                <td>${K.badge(s.status, s.status === 'Connected' ? 'badge-black' : 'badge-red')}</td>
                <td>${K.fmtTime(s.lastSync)}</td><td>${s.records}</td><td>${K.esc(s.owner)}</td>
                <td class="toolbar" style="margin:0;gap:4px">
                  <button type="button" class="btn btn-sm btn-ghost" data-action="cr-src-view" data-id="${s.id}">عرض</button>
                  <button type="button" class="btn btn-sm btn-dark" data-action="cr-src-test" data-id="${s.id}">اختبار الاتصال</button>
                  <button type="button" class="btn btn-sm btn-primary" data-action="cr-src-sync" data-id="${s.id}">Sync</button>
                  <button type="button" class="btn btn-sm btn-ghost" data-action="cr-tab" data-tab="settings">Logs</button>
                </td>
              </tr>`
            )
            .join('')}</tbody>
        </table></div></article>`;
    } else if (ui.tab === 'executions') {
      body = `<article class="card"><div class="table-wrap"><table class="data">
        <thead><tr><th>Execution ID</th><th>Decision ID</th><th>Decision</th><th>Executed By</th><th>Started</th><th>Completed</th><th>Affected</th><th>Status</th><th>Result</th><th>Actions</th></tr></thead>
        <tbody>${(c.executions || [])
          .map(
            (e) => `<tr>
              <td><code>${K.esc(e.id)}</code></td><td><code>${K.esc(e.decisionId)}</code></td>
              <td>${K.esc(e.decision)}</td><td>${K.esc(e.executedBy)}</td>
              <td>${K.fmtTime(e.startedAt)}</td><td>${K.fmtTime(e.completedAt)}</td>
              <td>${e.affectedRecords}</td>
              <td>${K.badge(e.status, e.status === 'Success' ? 'badge-black' : 'badge-red')}</td>
              <td>${K.esc(e.result)}</td>
              <td class="toolbar" style="margin:0;gap:4px">
                <button type="button" class="btn btn-sm btn-ghost" data-action="cr-exec-view" data-id="${e.id}">عرض</button>
                ${e.status === 'Failed' ? `<button type="button" class="btn btn-sm btn-primary" data-action="cr-exec-retry" data-id="${e.id}">إعادة المحاولة</button>` : ''}
              </td>
            </tr>`
          )
          .join('') || '<tr><td colspan="10" class="empty">لا تنفيذات</td></tr>'}</tbody>
      </table></div></article>`;
    } else if (ui.tab === 'approvals') {
      const rows = (c.approvals || []).filter((a) => {
        if (ui.approvalFilter === 'inbox') return a.direction === 'inbox' || a.status === 'Waiting';
        if (ui.approvalFilter === 'sent') return a.direction === 'sent';
        return a.direction === 'done' || a.status !== 'Waiting';
      });
      body = `<div class="toolbar">
          <button type="button" class="btn btn-sm ${ui.approvalFilter === 'inbox' ? 'btn-primary' : 'btn-ghost'}" data-action="cr-apr-filter" data-filter="inbox">بانتظاري</button>
          <button type="button" class="btn btn-sm ${ui.approvalFilter === 'sent' ? 'btn-primary' : 'btn-ghost'}" data-action="cr-apr-filter" data-filter="sent">أرسلتها</button>
          <button type="button" class="btn btn-sm ${ui.approvalFilter === 'done' ? 'btn-primary' : 'btn-ghost'}" data-action="cr-apr-filter" data-filter="done">مكتملة</button>
        </div>
        <article class="card" style="margin-top:10px">${rows
          .map(
            (a) => `<div style="border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px">
              <b>${K.esc(a.decisionId)} · ${K.esc(a.title)}</b> · ${K.badge(a.stage, 'badge-outline')} · ${K.badge(a.status, 'badge-red')}
              <p class="muted">المسند إلى: ${K.esc(a.assignee)}</p>
              <div class="toolbar">
                <button type="button" class="btn btn-sm btn-primary" data-action="cr-apr-decide" data-id="${a.id}" data-decision="approve">اعتماد</button>
                <button type="button" class="btn btn-sm btn-dark" data-action="cr-apr-decide" data-id="${a.id}" data-decision="reject">رفض</button>
                <button type="button" class="btn btn-sm btn-ghost" data-action="cr-apr-decide" data-id="${a.id}" data-decision="changes">طلب تعديل</button>
                <button type="button" class="btn btn-sm btn-ghost" data-action="cr-view" data-id="${a.decisionRef}">عرض القرار</button>
              </div>
            </div>`
          )
          .join('') || '<div class="empty">لا موافقات في هذا التبويب</div>'}</article>`;
    } else if (ui.tab === 'reports') {
      body = `<div class="hub-op-grid3">
        <article class="card hub-op-panel"><h3>نجاح القرارات</h3><strong style="font-size:2rem">${sr.rate}%</strong>
          <p class="muted">${sr.ok} حقق الهدف من ${sr.measured} مقاس · ${sr.executed} منفّذ</p>
          <button type="button" class="btn btn-dark btn-sm" data-action="cr-tab" data-tab="decisions" data-kpi="executed">Drill down</button></article>
        <article class="card hub-op-panel"><h3>التنبؤ</h3><strong style="font-size:2rem">${c.engineHealth?.predictive || 0}%</strong>
          <p class="muted">دقة/ثقة التنبؤ · Forecast v1 · ${(c.predictions || []).length} تنبؤ</p></article>
        <article class="card hub-op-panel"><h3>المحركات</h3>
          <ul class="feed">${Object.entries(c.engineHealth || {})
            .map(([k, v]) => `<li><b>${K.esc(k)}</b> ${v}%</li>`)
            .join('')}</ul></article>
      </div>`;
    } else {
      const s = c.settings || {};
      body = `<article class="card">
        <h3>إعدادات العقل المركزي</h3>
        <div class="grid-2">
          <div class="field"><label>عتبة الثقة</label><input id="cr-set-conf" type="number" value="${s.confidenceThreshold ?? 70}" /></div>
          <div class="field"><label>الاحتفاظ (أيام)</label><input id="cr-set-ret" type="number" value="${s.retentionDays ?? 365}" /></div>
          <div class="field"><label><input type="checkbox" id="cr-set-apr" ${s.requireApprovalForSensitive ? 'checked' : ''}/> موافقة إلزامية للقرارات الحساسة</label></div>
          <div class="field"><label>حجم الصفحة الافتراضي</label>
            <select id="cr-set-ps">${[10, 25, 50, 100].map((n) => `<option value="${n}" ${Number(s.pageSize) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        </div>
        <p class="muted">General · Decision Types · Impact Levels · Confidence · Approval Workflows · AI/Analysis · Rule Engine · Data Sources · Notifications · Execution · Permissions · Audit · Retention</p>
        <div class="toolbar"><button type="button" class="btn btn-primary" data-action="cr-settings-save">حفظ الإعدادات</button></div>
        <h4 style="margin-top:16px">الصلاحيات (مرجع)</h4>
        <ul class="feed">
          <li><b>CI Admin</b> Full Access</li>
          <li><b>Decision Manager</b> Create / Edit / Review</li>
          <li><b>Approver</b> Approve / Reject</li>
          <li><b>Operator</b> Execute Approved</li>
          <li><b>Analyst</b> Insights / Recommendations / Predictions</li>
          <li><b>Auditor / Viewer</b> Read Only + Logs</li>
        </ul>
        <h4>Audit Log</h4>
        ${K.renderAuditTable(c.auditLog || [])}
      </article>`;
    }

    const drawer =
      ui.drawer?.kind === 'decision'
        ? renderDecisionDrawer(ui.drawer.data)
        : ui.drawer
          ? K.renderDrawer('cr', { title: ui.drawer.title, bodyHtml: ui.drawer.bodyHtml })
          : '';

    return `<div class="hub-ops-ws hub-operating-ws hub-ci-ws">
      ${K.renderHeader({
        prefix: 'cr',
        title: 'العقل المركزي — Central Intelligence & Decision Center',
        subtitle: 'رؤية → توصية → قرار → موافقة → تنفيذ → أثر → سجل',
        icon: 'fa-brain',
        badgeText: 'CENTRAL INTELLIGENCE',
        actionsHtml: headerActions(),
      })}
      ${explainCard()}
      ${K.renderKpis('cr', kpis, ui.kpiFocus)}
      ${K.renderTabs('cr', CR_TABS, ui.tab)}
      ${body}
      ${K.renderHelp('cr', {
        title: 'كيف أستخدم العقل المركزي؟',
        dismissed: !!c.settings?.helpDismissed,
        open: ui.helpOpen,
        bodyHtml: `<ol>
          <li>راجع الرؤى والتنبيهات.</li>
          <li>افتح التوصية.</li>
          <li>راجع البيانات التي أدت إليها.</li>
          <li>حوّل التوصية إلى قرار.</li>
          <li>راجع Preview قبل التنفيذ.</li>
          <li>أرسل القرار للاعتماد.</li>
          <li>نفّذ القرار بعد الاعتماد.</li>
          <li>تابع Execution ID والنتيجة والأثر.</li>
        </ol>`,
      })}
      ${wizardHtml()}
      ${simpleFormModal()}
      ${confirmModal()}
      ${drawer}
    </div>`;
  };

  const readWizardStep = () => {
    const K = Kit();
    const d = ui.wizard.data || (ui.wizard.data = {});
    const step = ui.wizard.step || 1;
    if (step === 1) {
      d.title = K.qVal('cr-w-title');
      d.description = document.getElementById('cr-w-desc')?.value?.trim() || '';
      d.category = K.qVal('cr-w-category');
      d.priority = K.qVal('cr-w-priority');
      d.owner = K.qVal('cr-w-owner');
    } else if (step === 2) {
      d.sourceType = K.qVal('cr-w-sourceType');
      d.engine = K.qVal('cr-w-engine') || d.sourceType;
    } else if (step === 3) {
      d.sourceModules = [...document.querySelectorAll('[data-cr-mod]:checked')].map((el) => el.getAttribute('data-cr-mod'));
      d.dataUsed = K.qVal('cr-w-dataUsed');
    } else if (step === 4) {
      d.reason = document.getElementById('cr-w-reason')?.value?.trim() || '';
      d.recommendation = document.getElementById('cr-w-rec')?.value?.trim() || '';
    } else if (step === 5) {
      d.affectedModule = K.qVal('cr-w-aff-mod');
      d.impact = K.qVal('cr-w-impact');
      d.expectedOutcome = K.qVal('cr-w-expected');
      d.confidence = Number(K.qVal('cr-w-conf')) || 75;
      d.preview = {
        tasks: Number(K.qVal('cr-w-tasks')) || 0,
        users: Number(K.qVal('cr-w-aff-users')) || 0,
        affectedUsers: Number(K.qVal('cr-w-aff-users')) || 0,
        impactText: d.expectedOutcome || '—',
      };
    } else if (step === 6) {
      d.reviewer = K.qVal('cr-w-reviewer');
      d.approver = K.qVal('cr-w-approver');
      d.sensitive = !!document.getElementById('cr-w-sensitive')?.checked;
    }
  };

  const openSimple = (kind, title, fields, saveAction, seed = {}) => {
    const K = Kit();
    ui.modal = {
      kind,
      title,
      saveAction,
      seed,
      bodyHtml: fields
        .map((f) => {
          if (f.type === 'textarea') return `<div class="field"><label>${K.esc(f.label)}</label><textarea id="${f.id}" rows="3">${K.esc(seed[f.key] || '')}</textarea></div>`;
          if (f.type === 'select')
            return `<div class="field"><label>${K.esc(f.label)}</label><select id="${f.id}">${(f.options || [])
              .map((o) => `<option ${seed[f.key] === o ? 'selected' : ''}>${o}</option>`)
              .join('')}</select></div>`;
          return `<div class="field"><label>${K.esc(f.label)}</label><input id="${f.id}" type="${f.type || 'text'}" value="${K.esc(String(seed[f.key] ?? f.value ?? ''))}" /></div>`;
        })
        .join(''),
    };
  };

  const handle = (action, btn, ctx = {}) => {
    const { toast } = ctx;
    const K = Kit();
    const who = actor(ctx);
    const id = btn?.dataset?.id;

    if (action === 'cr-tab') {
      ui.tab = btn.dataset.tab || 'overview';
      ui.page = 1;
      ui.addMenu = false;
      ui.moreId = null;
      if (btn.dataset.kpi) ui.kpiFocus = btn.dataset.kpi;
      return true;
    }
    if (action === 'cr-kpi') {
      ui.kpiFocus = btn.dataset.key || '';
      if (btn.dataset.tab) ui.tab = btn.dataset.tab;
      if (btn.dataset.key === 'pending') {
        ui.tab = 'decisions';
        ui.kpiFocus = 'pending';
        ui.filters.status = 'Pending Approval';
      }
      if (btn.dataset.key === 'success') ui.tab = 'reports';
      return true;
    }
    if (action === 'cr-page') {
      ui.page = Number(btn.dataset.page) || 1;
      return true;
    }
    if (action === 'cr-add-menu') {
      ui.addMenu = !ui.addMenu;
      return true;
    }
    if (action === 'cr-help-open') {
      ui.helpOpen = true;
      return true;
    }
    if (action === 'cr-help-dismiss') {
      store().updateCoreSettings?.({ helpDismissed: true }, who);
      ui.helpOpen = false;
      return true;
    }
    if (action === 'cr-modal-close' || action === 'cr-drawer-close') {
      ui.modal = null;
      ui.wizard = null;
      ui.drawer = null;
      ui.confirm = null;
      return true;
    }
    if (action === 'cr-wizard-decision') {
      ui.addMenu = false;
      ui.wizard = { kind: 'decision', step: 1, data: { priority: 'متوسط', sourceType: 'يدوي', confidence: 75, sourceModules: [], owner: who } };
      return true;
    }
    if (action === 'cr-wiz-next') {
      readWizardStep();
      const d = ui.wizard.data;
      if (ui.wizard.step === 1 && (!d.title || !d.description)) {
        toast?.('العنوان والوصف مطلوبان');
        return true;
      }
      if (ui.wizard.step === 4 && !d.reason) {
        toast?.('المبرر مطلوب');
        return true;
      }
      ui.wizard.step = Math.min(7, (ui.wizard.step || 1) + 1);
      return true;
    }
    if (action === 'cr-wiz-prev') {
      readWizardStep();
      ui.wizard.step = Math.max(1, (ui.wizard.step || 1) - 1);
      return true;
    }
    if (action === 'cr-wiz-save') {
      readWizardStep();
      const d = ui.wizard.data;
      const status = btn.dataset.status || 'Draft';
      const row = store().upsertCoreDecision?.(
        {
          ...d,
          status,
          impact: d.impact || d.priority,
          source: d.sourceType,
          reasoning: d.reason ? [d.reason] : [],
        },
        who
      );
      if (row?.error) {
        toast?.(row.error);
        return true;
      }
      if (status === 'Pending Review' || status === 'Pending Approval') {
        store().updateCoreDecisionStatus?.(row.id, status, who);
      }
      ui.wizard = null;
      ui.tab = 'decisions';
      toast?.('تم حفظ القرار');
      return true;
    }

    if (action === 'cr-view') {
      const d = (core().decisions || []).find((x) => x.id === id);
      if (!d) return true;
      ui.detailTab = 'overview';
      ui.drawer = { kind: 'decision', data: d };
      return true;
    }
    if (action === 'cr-detail-tab') {
      ui.detailTab = btn.dataset.tab || 'overview';
      return true;
    }
    if (action === 'cr-more') {
      ui.moreId = ui.moreId === id ? null : id;
      return true;
    }
    if (action === 'cr-conf') {
      const d = (core().decisions || []).find((x) => x.id === id);
      ui.drawer = {
        title: `ثقة التحليل · ${d?.confidence ?? '—'}%`,
        bodyHtml: `<ul class="feed">
          <li><b>Data Quality:</b> جيدة</li>
          <li><b>Model Confidence:</b> ${d?.confidence ?? '—'}%</li>
          <li><b>Coverage:</b> ${(d?.sourceModules || []).join(', ') || '—'}</li>
          <li><b>Last Validation:</b> ${Kit().fmtTime(d?.updatedAt)}</li>
          <li><b>Model:</b> ${Kit().esc(d?.model || '—')}</li>
        </ul>`,
      };
      return true;
    }
    if (action === 'cr-preview' || action === 'cr-exec-preview') {
      const d = (core().decisions || []).find((x) => x.id === id);
      if (!d) return true;
      const msg = `ماذا سيحدث إذا تم تنفيذ القرار؟\nسيتم إعادة توزيع/تطبيق: ${d.preview?.tasks || 0} سجل\nعلى: ${d.preview?.users || d.preview?.affectedUsers || 0} مستخدم\nExpected Impact: ${d.preview?.impactText || d.expectedOutcome || '—'}\nAffected Users: ${d.preview?.affectedUsers || 0}`;
      if (action === 'cr-preview') {
        ui.drawer = { title: `معاينة · ${d.title}`, bodyHtml: `<pre style="white-space:pre-wrap;font-family:inherit">${Kit().esc(msg)}</pre><p class="muted">المعاينة لا تنفّذ شيئًا.</p>` };
        return true;
      }
      ui.confirm = {
        title: 'تأكيد التنفيذ',
        message: `سيتم تنفيذ القرار على ${d.preview?.tasks || 0} مهمة و${d.preview?.users || d.preview?.affectedUsers || 0} موظفين.`,
        okLabel: 'تأكيد التنفيذ',
        kind: 'execute',
        id,
      };
      return true;
    }
    if (action === 'cr-confirm-cancel') {
      ui.confirm = null;
      return true;
    }
    if (action === 'cr-confirm-ok') {
      const cnf = ui.confirm;
      ui.confirm = null;
      if (!cnf) return true;
      if (cnf.kind === 'execute') {
        const res = store().executeCoreDecision?.(cnf.id, who, true);
        if (res?.error) toast?.(res.error);
        else {
          toast?.(`تم التنفيذ · ${res?.execution?.id || ''}`);
          ui.tab = 'executions';
        }
        return true;
      }
      if (cnf.kind === 'delete') {
        const res = store().deleteCoreDecision?.(cnf.id, who);
        toast?.(res?.error || 'تم الحذف');
        return true;
      }
      return true;
    }
    if (action === 'cr-approve') {
      store().updateCoreDecisionStatus?.(id, 'Approved', who, 'اعتماد');
      toast?.('تم الاعتماد');
      return true;
    }
    if (action === 'cr-reject') {
      store().updateCoreDecisionStatus?.(id, 'Rejected', who, 'رفض');
      toast?.('تم الرفض');
      return true;
    }
    if (action === 'cr-submit-review') {
      store().updateCoreDecisionStatus?.(id, 'Pending Review', who);
      toast?.('أُرسل للمراجعة');
      return true;
    }
    if (action === 'cr-submit-approval') {
      store().updateCoreDecisionStatus?.(id, 'Pending Approval', who);
      toast?.('أُرسل للاعتماد');
      return true;
    }
    if (action === 'cr-archive') {
      store().archiveCoreDecision?.(id, who);
      toast?.('تمت الأرشفة');
      return true;
    }
    if (action === 'cr-delete') {
      ui.confirm = { title: 'حذف القرار', message: 'هل تريد حذف القرار؟', okLabel: 'حذف', kind: 'delete', id };
      return true;
    }
    if (action === 'cr-clone') {
      const d = (core().decisions || []).find((x) => x.id === id);
      if (!d) return true;
      const row = store().upsertCoreDecision?.(
        {
          title: `${d.title} (نسخة)`,
          description: d.description,
          reason: d.reason,
          sourceType: d.sourceType,
          engine: d.engine,
          impact: d.impact,
          confidence: d.confidence,
          owner: d.owner,
          sourceModules: d.sourceModules,
          status: 'Draft',
        },
        who
      );
      toast?.(row?.error || 'تم النسخ');
      return true;
    }
    if (action === 'cr-revise') {
      const rev = store().upsertCoreDecision?.({ id, forceEdit: true }, who);
      toast?.(rev?.error || 'أُنشئت نسخة معدّلة');
      ui.tab = 'decisions';
      return true;
    }
    if (action === 'cr-edit') {
      const d = (core().decisions || []).find((x) => x.id === id);
      if (!d) return true;
      if (['Approved', 'Executed'].includes(d.status)) {
        toast?.('استخدم «نسخة معدّلة» للقرارات المعتمدة/المنفّذة');
        return true;
      }
      openSimple(
        'edit-decision',
        'تعديل قرار',
        [
          { id: 'cr-ed-title', key: 'title', label: 'العنوان' },
          { id: 'cr-ed-desc', key: 'description', label: 'الوصف', type: 'textarea' },
          { id: 'cr-ed-priority', key: 'priority', label: 'الأولوية', type: 'select', options: ['عاجل', 'عالي', 'متوسط', 'منخفض'] },
          { id: 'cr-ed-owner', key: 'owner', label: 'المالك' },
          { id: 'cr-ed-reason', key: 'reason', label: 'المبرر', type: 'textarea' },
          { id: 'cr-ed-impact', key: 'impact', label: 'الأثر', type: 'select', options: ['عالي', 'متوسط', 'منخفض'] },
          { id: 'cr-ed-reviewer', key: 'reviewer', label: 'Reviewer' },
          { id: 'cr-ed-approver', key: 'approver', label: 'Approver' },
        ],
        'cr-edit-save',
        d
      );
      ui.modal.editId = d.id;
      return true;
    }
    if (action === 'cr-edit-save') {
      store().upsertCoreDecision?.(
        {
          id: ui.modal.editId,
          title: K.qVal('cr-ed-title'),
          description: document.getElementById('cr-ed-desc')?.value || '',
          priority: K.qVal('cr-ed-priority'),
          owner: K.qVal('cr-ed-owner'),
          reason: document.getElementById('cr-ed-reason')?.value || '',
          impact: K.qVal('cr-ed-impact'),
          reviewer: K.qVal('cr-ed-reviewer'),
          approver: K.qVal('cr-ed-approver'),
        },
        who
      );
      ui.modal = null;
      toast?.('تم التعديل');
      return true;
    }
    if (action === 'cr-reanalyze') {
      store().runCoreAnalysis?.(who);
      toast?.('أُعيد التحليل');
      return true;
    }
    if (action === 'cr-exec-log') {
      ui.tab = 'executions';
      return true;
    }
    if (action === 'cr-feedback') {
      store().setCoreDecisionFeedback?.(id, btn.dataset.rating, '', who);
      toast?.('تم التقييم');
      return true;
    }
    if (action === 'cr-feedback-save') {
      const note = document.getElementById('cr-feedback-note')?.value || '';
      const d = (core().decisions || []).find((x) => x.id === id);
      store().setCoreDecisionFeedback?.(id, d?.feedback?.rating || 'مفيد', note, who);
      toast?.('حُفظ التقييم');
      return true;
    }
    if (action === 'cr-run-analysis' || action === 'cr-request-analysis') {
      store().runCoreAnalysis?.(who);
      ui.tab = 'predictions';
      toast?.('تم تشغيل التحليل');
      return true;
    }
    if (action === 'cr-rec-convert') {
      const d = store().convertRecommendationToDecision?.(id, who);
      toast?.(d?.error || 'حُوّلت إلى قرار');
      ui.tab = 'decisions';
      return true;
    }
    if (action === 'cr-rec-dismiss') {
      store().upsertCoreRecommendation?.({ id, status: 'Dismissed' }, who);
      toast?.('تم التجاهل');
      return true;
    }
    if (action === 'cr-rec-view') {
      const r = (core().recommendations || []).find((x) => x.id === id);
      ui.drawer = { title: r?.title, bodyHtml: `<p>${Kit().esc(r?.reason || '')}</p><p><b>الإجراء المقترح:</b> ${Kit().esc(r?.suggestedAction || '')}</p>` };
      return true;
    }
    if (action === 'cr-ins-view') {
      const ins = (core().insights || []).find((x) => x.id === id);
      ui.drawer = { title: ins?.title, bodyHtml: `<p>${Kit().esc(ins?.summary || ins?.rationale || '')}</p><p>المصدر: ${Kit().esc(ins?.source)} · ثقة ${ins?.confidence}%</p>` };
      return true;
    }
    if (action === 'cr-ins-to-rec') {
      const ins = (core().insights || []).find((x) => x.id === id);
      store().upsertCoreRecommendation?.({ title: ins.title, reason: ins.summary || ins.rationale, source: ins.source, confidence: ins.confidence, suggestedAction: 'مراجعة واتخاذ قرار' }, who);
      ui.tab = 'recommendations';
      toast?.('أُنشئت توصية');
      return true;
    }
    if (action === 'cr-ins-to-dec') {
      const ins = (core().insights || []).find((x) => x.id === id);
      store().upsertCoreDecision?.({ title: ins.title, description: ins.summary || ins.rationale, reason: ins.summary || ins.rationale, sourceType: 'AI Analysis', source: ins.source, confidence: ins.confidence, status: 'Draft' }, who);
      ui.tab = 'decisions';
      toast?.('أُنشئ قرار');
      return true;
    }
    if (action === 'cr-anom-invest') {
      store().upsertCoreAnomaly?.({ id, status: 'Investigating' }, who);
      toast?.('قيد التحقيق');
      return true;
    }
    if (action === 'cr-anom-close') {
      store().resolveAnomaly?.(id);
      store().upsertCoreAnomaly?.({ id, status: 'Closed' }, who);
      toast?.('أُغلق الشذوذ');
      return true;
    }
    if (action === 'cr-anom-task') {
      store().addTask?.({ title: `تحقيق شذوذ ${id}`, assignee: who, priority: 'عالي', status: 'todo', source: 'Central Intelligence' });
      toast?.('أُنشئت مهمة');
      return true;
    }
    if (action === 'cr-anom-dec') {
      const a = (core().anomalies || []).find((x) => x.id === id);
      store().upsertCoreDecision?.(
        {
          title: `معالجة شذوذ: ${a?.metric || a?.signal}`,
          description: a?.signal || '',
          reason: `شذوذ من ${a?.source}`,
          sourceType: 'Anomaly',
          engine: 'Anomaly',
          status: 'Draft',
          impact: a?.severity === 'حرج' ? 'عالي' : 'متوسط',
        },
        who
      );
      ui.tab = 'decisions';
      toast?.('أُنشئ قرار من الشذوذ');
      return true;
    }
    if (action === 'cr-src-sync') {
      store().syncCoreDataSource?.(id, who);
      toast?.('تمت المزامنة');
      return true;
    }
    if (action === 'cr-src-test') {
      store().testCoreDataSource?.(id, who);
      toast?.('الاتصال ناجح');
      return true;
    }
    if (action === 'cr-src-view') {
      const s = (core().dataSources || []).find((x) => x.id === id);
      ui.drawer = { title: s?.name, bodyHtml: `<ul class="feed"><li>${Kit().esc(s?.module)}</li><li>${Kit().esc(s?.type)}</li><li>${s?.records} سجل</li><li>${Kit().fmtTime(s?.lastSync)}</li></ul>` };
      return true;
    }
    if (action === 'cr-exec-view') {
      const e = (core().executions || []).find((x) => x.id === id);
      ui.drawer = {
        title: e?.id,
        bodyHtml: `<p>${Kit().esc(e?.result)}</p><ul>${(e?.timeline || []).map((t) => `<li>${t.ok ? '✓' : '✕'} ${Kit().esc(t.text)}</li>`).join('')}</ul>
          ${e?.status === 'Failed' ? `<button type="button" class="btn btn-primary" data-action="cr-exec-retry" data-id="${e.id}">إعادة المحاولة</button>` : ''}`,
      };
      return true;
    }
    if (action === 'cr-exec-retry') {
      store().retryCoreExecution?.(id, who);
      toast?.('أُعيدت المحاولة');
      return true;
    }
    if (action === 'cr-apr-filter') {
      ui.approvalFilter = btn.dataset.filter || 'inbox';
      return true;
    }
    if (action === 'cr-apr-decide') {
      const decision = btn.dataset.decision;
      const comment = decision === 'reject' ? window.prompt('سبب الرفض؟') || '' : '';
      const res = store().decideCoreApproval?.(id, decision, who, comment);
      toast?.(res?.error || 'تم');
      return true;
    }
    if (action === 'cr-settings-save') {
      store().updateCoreSettings?.(
        {
          confidenceThreshold: Number(K.qVal('cr-set-conf')) || 70,
          retentionDays: Number(K.qVal('cr-set-ret')) || 365,
          requireApprovalForSensitive: !!document.getElementById('cr-set-apr')?.checked,
          pageSize: Number(K.qVal('cr-set-ps')) || 25,
        },
        who
      );
      ui.pageSize = Number(K.qVal('cr-set-ps')) || 25;
      toast?.('حُفظت الإعدادات');
      return true;
    }

    // Add entity shortcuts
    if (action === 'cr-add-rec') {
      ui.addMenu = false;
      openSimple('rec', 'إضافة توصية', [
        { id: 'cr-f-title', key: 'title', label: 'العنوان *' },
        { id: 'cr-f-reason', key: 'reason', label: 'السبب', type: 'textarea' },
        { id: 'cr-f-action', key: 'suggestedAction', label: 'الإجراء المقترح' },
        { id: 'cr-f-impact', key: 'impact', label: 'الأثر', type: 'select', options: ['عالي', 'متوسط', 'منخفض'] },
        { id: 'cr-f-conf', key: 'confidence', label: 'الثقة', type: 'number', value: '80' },
      ], 'cr-save-rec');
      return true;
    }
    if (action === 'cr-save-rec') {
      const res = store().upsertCoreRecommendation?.(
        { title: K.qVal('cr-f-title'), reason: document.getElementById('cr-f-reason')?.value || '', suggestedAction: K.qVal('cr-f-action'), impact: K.qVal('cr-f-impact'), confidence: Number(K.qVal('cr-f-conf')) || 70 },
        who
      );
      if (res?.error) toast?.(res.error);
      else {
        ui.modal = null;
        ui.tab = 'recommendations';
        toast?.('تمت الإضافة');
      }
      return true;
    }
    if (action === 'cr-add-insight') {
      ui.addMenu = false;
      openSimple('ins', 'إضافة رؤية', [
        { id: 'cr-f-title', key: 'title', label: 'العنوان *' },
        { id: 'cr-f-summary', key: 'summary', label: 'الملخص', type: 'textarea' },
        { id: 'cr-f-source', key: 'source', label: 'المصدر', value: 'إدخال يدوي' },
        { id: 'cr-f-sev', key: 'severity', label: 'الخطورة', type: 'select', options: ['حرج', 'عالي', 'متوسط', 'منخفض'] },
        { id: 'cr-f-conf', key: 'confidence', label: 'الثقة', type: 'number', value: '75' },
      ], 'cr-save-insight');
      return true;
    }
    if (action === 'cr-save-insight') {
      const res = store().upsertCoreInsight?.(
        { title: K.qVal('cr-f-title'), summary: document.getElementById('cr-f-summary')?.value || '', source: K.qVal('cr-f-source'), severity: K.qVal('cr-f-sev'), confidence: Number(K.qVal('cr-f-conf')) || 70 },
        who
      );
      if (res?.error) toast?.(res.error);
      else {
        ui.modal = null;
        ui.tab = 'insights';
        toast?.('تمت الإضافة');
      }
      return true;
    }
    if (action === 'cr-add-pred') {
      ui.addMenu = false;
      openSimple('pred', 'إضافة تنبؤ', [
        { id: 'cr-f-title', key: 'title', label: 'العنوان *' },
        { id: 'cr-f-target', key: 'target', label: 'الهدف', value: 'الإنتاجية' },
        { id: 'cr-f-val', key: 'predictedValue', label: 'القيمة المتوقعة %', type: 'number', value: '70' },
        { id: 'cr-f-conf', key: 'confidence', label: 'الثقة %', type: 'number', value: '80' },
        { id: 'cr-f-period', key: 'period', label: 'الفترة', value: '7 أيام' },
      ], 'cr-save-pred');
      return true;
    }
    if (action === 'cr-save-pred') {
      const res = store().upsertCorePrediction?.(
        { title: K.qVal('cr-f-title'), target: K.qVal('cr-f-target'), predictedValue: Number(K.qVal('cr-f-val')) || 50, confidence: Number(K.qVal('cr-f-conf')) || 80, period: K.qVal('cr-f-period') },
        who
      );
      if (res?.error) toast?.(res.error);
      else {
        ui.modal = null;
        ui.tab = 'predictions';
        toast?.('تمت الإضافة');
      }
      return true;
    }
    if (action === 'cr-add-anom') {
      ui.addMenu = false;
      openSimple('anom', 'تسجيل شذوذ', [
        { id: 'cr-f-metric', key: 'metric', label: 'المؤشر / الإشارة *' },
        { id: 'cr-f-source', key: 'source', label: 'المصدر' },
        { id: 'cr-f-expected', key: 'expected', label: 'المتوقع' },
        { id: 'cr-f-actual', key: 'actual', label: 'الفعلي' },
        { id: 'cr-f-sev', key: 'severity', label: 'الخطورة', type: 'select', options: ['حرج', 'عالي', 'متوسط', 'منخفض'] },
      ], 'cr-save-anom');
      return true;
    }
    if (action === 'cr-save-anom') {
      store().upsertCoreAnomaly?.(
        { metric: K.qVal('cr-f-metric'), signal: K.qVal('cr-f-metric'), source: K.qVal('cr-f-source'), expected: K.qVal('cr-f-expected'), actual: K.qVal('cr-f-actual'), severity: K.qVal('cr-f-sev') },
        who
      );
      ui.modal = null;
      ui.tab = 'anomalies';
      toast?.('تم التسجيل');
      return true;
    }
    if (action === 'cr-add-rule') {
      ui.addMenu = false;
      openSimple('rule', 'إضافة قاعدة قرار (No-Code)', [
        { id: 'cr-f-name', key: 'name', label: 'اسم القاعدة *' },
        { id: 'cr-f-mod', key: 'sourceModule', label: 'Source Module', type: 'select', options: MODULES },
        { id: 'cr-f-metric', key: 'metric', label: 'Metric', value: 'Overdue Tasks' },
        { id: 'cr-f-op', key: 'operator', label: 'Operator', type: 'select', options: ['>', '>=', '<', '<=', '='] },
        { id: 'cr-f-val', key: 'value', label: 'Value', type: 'number', value: '30' },
        { id: 'cr-f-action', key: 'action', label: 'Action', type: 'select', options: ['Generate Recommendation', 'Generate Decision', 'Create Task', 'Notify Owner'] },
        { id: 'cr-f-sev', key: 'severity', label: 'Severity', type: 'select', options: ['High', 'Medium', 'Low'] },
      ], 'cr-save-rule');
      return true;
    }
    if (action === 'cr-save-rule') {
      const res = store().upsertCoreRule?.(
        {
          name: K.qVal('cr-f-name'),
          sourceModule: K.qVal('cr-f-mod'),
          metric: K.qVal('cr-f-metric'),
          operator: K.qVal('cr-f-op'),
          value: Number(K.qVal('cr-f-val')) || 0,
          action: K.qVal('cr-f-action'),
          severity: K.qVal('cr-f-sev'),
          extraConditions: [{ metric: 'Team Utilization', operator: '>', value: 90 }],
        },
        who
      );
      if (res?.error) toast?.(res.error);
      else {
        ui.modal = null;
        ui.tab = 'rules';
        toast?.('أُضيفت القاعدة');
      }
      return true;
    }
    if (action === 'cr-add-source') {
      ui.addMenu = false;
      openSimple('src', 'إضافة مصدر بيانات', [
        { id: 'cr-f-name', key: 'name', label: 'اسم المصدر *' },
        { id: 'cr-f-mod', key: 'module', label: 'Module' },
        { id: 'cr-f-type', key: 'type', label: 'Type', type: 'select', options: ['Internal Module', 'API', 'File', 'Warehouse'] },
        { id: 'cr-f-owner', key: 'owner', label: 'Owner' },
      ], 'cr-save-source');
      return true;
    }
    if (action === 'cr-save-source') {
      const res = store().upsertCoreDataSource?.(
        { name: K.qVal('cr-f-name'), module: K.qVal('cr-f-mod'), type: K.qVal('cr-f-type'), owner: K.qVal('cr-f-owner') || who },
        who
      );
      if (res?.error) toast?.(res.error);
      else {
        ui.modal = null;
        ui.tab = 'sources';
        toast?.('أُضيف المصدر');
      }
      return true;
    }

    // legacy aliases from old HubCoreWS
    if (action === 'cr-issue') {
      ui.wizard = { kind: 'decision', step: 1, data: { title: K.qVal('cr-decision-title'), reason: K.qVal('cr-decision-rationale'), engine: K.qVal('cr-decision-engine'), sourceType: 'AI Analysis', priority: 'متوسط' } };
      return true;
    }
    if (action === 'cr-exec') {
      btn.dataset.id = id;
      return handle('cr-exec-preview', btn, ctx);
    }
    if (action === 'cr-predict') return handle('cr-run-analysis', btn, ctx);
    if (action === 'cr-resolve') return handle('cr-anom-close', btn, ctx);
    if (action === 'cr-ins-add' || action === 'cr-ins-close') return false;

    return false;
  };

  const handleChange = (el) => {
    const key = el.getAttribute('data-cr-change');
    if (!key) return false;
    if (key === 'pageSize') {
      ui.pageSize = Number(el.value) || 25;
      ui.page = 1;
      return true;
    }
    ui.filters[key] = el.value;
    ui.page = 1;
    return true;
  };

  window.HubCoreIntelligence = { render, handle, handleChange, ui };
  window.HubCoreWS = window.HubCoreIntelligence;
})();
