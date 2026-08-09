/**
 * منهجية مراجعة هندسية موحّدة — ملف 06
 * localStorage: hubUnitReviews
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'hubUnitReviews';

  const CHECKLIST = [
    { key: 'vision', label: 'الرؤية والهدف' },
    { key: 'requirements', label: 'المتطلبات' },
    { key: 'users', label: 'المستخدمون' },
    { key: 'roles', label: 'الأدوار والصلاحيات' },
    { key: 'functions', label: 'الوظائف' },
    { key: 'screens', label: 'الشاشات' },
    { key: 'database', label: 'قاعدة البيانات' },
    { key: 'workflow', label: 'Workflow' },
    { key: 'integration', label: 'التكامل' },
    { key: 'api', label: 'API / الأحداث' },
    { key: 'ai', label: 'الذكاء الاصطناعي' },
    { key: 'notifications', label: 'الإشعارات' },
    { key: 'reports', label: 'التقارير' },
    { key: 'kpi', label: 'KPI' },
    { key: 'security', label: 'الأمن والتدقيق' },
    { key: 'tests', label: 'الاختبارات' },
    { key: 'failures', label: 'حالات الفشل' },
    { key: 'docs', label: 'التوثيق والتدريب' },
    { key: 'acceptance', label: 'معايير القبول' },
    { key: 'scale', label: 'قابلية التوسع' },
  ];

  const PHASES = [
    {
      id: 'p1',
      title: 'المرحلة 1 — المحركات الأساسية',
      units: [
        { id: 'u01', n: 1, title: 'محرك الهوية والدخول الموحد', status: 'done', href: 'login.html', hrefLabel: 'تسجيل الدخول' },
        { id: 'u02', n: 2, title: 'محرك الهيكل المؤسسي', status: 'partial', href: 'branches.html', hrefLabel: 'الفروع والحاضنات' },
        { id: 'u03', n: 3, title: 'محرك الأدوار والصلاحيات', status: 'partial', href: 'dashboard.html', hrefLabel: 'غرفة العمليات' },
        { id: 'u04', n: 4, title: 'محرك التطبيقات والأنظمة', status: 'done', href: 'apps.html', hrefLabel: 'سجل الأنظمة' },
        { id: 'u05', n: 5, title: 'محرك الخدمات', status: 'partial', href: 'operating.html', hrefLabel: 'آلية التشغيل' },
        { id: 'u06', n: 6, title: 'محرك التوجيه المركزي', status: 'partial', href: 'directives.html', hrefLabel: 'التوجيه المركزي' },
        { id: 'u07', n: 7, title: 'محرك Workflow', status: 'partial', href: 'info-center.html', hrefLabel: 'محرك التشغيل' },
        { id: 'u08', n: 8, title: 'محرك الإشعارات', status: 'partial', href: 'dashboard.html', hrefLabel: 'غرفة العمليات' },
        { id: 'u09', n: 9, title: 'محرك التدقيق والسجل', status: 'partial', href: 'dashboard.html', hrefLabel: 'التدقيق' },
        { id: 'u10', n: 10, title: 'محرك التكامل و API', status: 'partial', href: 'engine-specs.html', hrefLabel: 'المواصفات' },
      ],
    },
    {
      id: 'p2',
      title: 'المرحلة 2 — المعرفة والتعلم',
      units: [
        { id: 'u11', n: 11, title: 'مركز المعرفة', status: 'done', href: 'info-center.html', hrefLabel: 'مركز المعرفة' },
        { id: 'u12', n: 12, title: 'مركز التشغيل والأدلة', status: 'done', href: 'ops-manuals.html', hrefLabel: 'الأدلة التشغيلية' },
        { id: 'u13', n: 13, title: 'مركز التدريب والتعلم', status: 'partial', href: 'info-center.html', hrefLabel: 'محرك التعلّم' },
        { id: 'u14', n: 14, title: 'محرك التعلم التكيفي', status: 'partial', href: 'info-center.html', hrefLabel: 'التعلّم التكيفي' },
        { id: 'u15', n: 15, title: 'محرك الاختبارات والتقييم', status: 'partial', href: 'systems/lms.html', hrefLabel: 'LMS' },
        { id: 'u16', n: 16, title: 'محرك المهارات والخبرات', status: 'partial', href: 'info-center.html', hrefLabel: 'المهارات' },
        { id: 'u17', n: 17, title: 'محرك الشهادات والاعتمادات', status: 'missing', href: null, hrefLabel: null },
      ],
    },
    {
      id: 'p3',
      title: 'المرحلة 3 — الإدارة والاقتصاد',
      units: [
        { id: 'u18', n: 18, title: 'محرك النقاط والمحفظة', status: 'partial', href: 'packages.html', hrefLabel: 'الباقات والرصيد' },
        { id: 'u19', n: 19, title: 'محرك الخدمات والاستخدام', status: 'partial', href: 'packages.html', hrefLabel: 'الاستخدام' },
        { id: 'u20', n: 20, title: 'CRM وخدمة العملاء', status: 'partial', href: 'systems/crm.html', hrefLabel: 'CRM' },
        { id: 'u21', n: 21, title: 'استديو التسويق الإلكتروني', status: 'missing', href: 'ads.html', hrefLabel: 'الإعلانات' },
        { id: 'u22', n: 22, title: 'استديو الفعاليات', status: 'partial', href: 'events.html', hrefLabel: 'الفعاليات' },
        { id: 'u23', n: 23, title: 'المحاسبة والتقارير المالية', status: 'missing', href: null, hrefLabel: null },
      ],
    },
    {
      id: 'p4',
      title: 'المرحلة 4 — الذكاء والرقابة',
      units: [
        { id: 'u24', n: 24, title: 'NAIOSH AI', status: 'partial', href: 'info-center.html', hrefLabel: 'اسأل نايوش' },
        { id: 'u25', n: 25, title: 'مركز القيادة والتحكم', status: 'partial', href: 'dashboard.html', hrefLabel: 'غرفة العمليات' },
        { id: 'u26', n: 26, title: 'محرك KPI', status: 'partial', href: 'dashboard.html', hrefLabel: 'مؤشرات الأداء' },
        { id: 'u27', n: 27, title: 'محرك المخاطر', status: 'missing', href: null, hrefLabel: null },
        { id: 'u28', n: 28, title: 'محرك جودة البيانات', status: 'partial', href: 'quality.html', hrefLabel: 'دليل الجودة' },
        { id: 'u29', n: 29, title: 'محرك المحاكاة ودعم القرار', status: 'partial', href: 'trial.html', hrefLabel: 'التجربة' },
        { id: 'u30', n: 30, title: 'محرك قياس النضج', status: 'missing', href: null, hrefLabel: null },
        { id: 'u31', n: 31, title: 'محرك قياس أثر القرارات', status: 'missing', href: 'directives.html', hrefLabel: 'التوجيه المركزي' },
      ],
    },
  ];

  const ALL_UNITS = PHASES.flatMap((p) => p.units);

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];

  const statusLabel = (s) => ({ done: 'تم', partial: 'جزئي', missing: 'لسه' }[s] || s);

  const readReviews = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (_) {
      return {};
    }
  };

  const saveReviews = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  const getUnitProgress = (unitId) => {
    const rev = readReviews()[unitId] || {};
    const done = CHECKLIST.filter((c) => rev[c.key]).length;
    return { done, total: CHECKLIST.length };
  };

  let selectedId = null;

  const renderKpis = () => {
    const root = qs('[data-rev-kpis]');
    if (!root) return;
    const reviews = readReviews();
    let checked = 0;
    ALL_UNITS.forEach((u) => {
      const rev = reviews[u.id] || {};
      checked += CHECKLIST.filter((c) => rev[c.key]).length;
    });
    const doneUnits = ALL_UNITS.filter((u) => u.status === 'done').length;
    const partialUnits = ALL_UNITS.filter((u) => u.status === 'partial').length;
    root.innerHTML = [
      { n: ALL_UNITS.length, l: 'وحدة للمراجعة' },
      { n: CHECKLIST.length, l: 'بند في القائمة' },
      { n: doneUnits, l: 'تم في الهوب' },
      { n: partialUnits, l: 'جزئي' },
      { n: checked, l: 'بنود مكتملة' },
    ]
      .map((i) => `<article class="rev-kpi"><strong>${i.n}</strong><span>${i.l}</span></article>`)
      .join('');
  };

  const renderPhases = (filter = '') => {
    const root = qs('[data-rev-phases]');
    if (!root) return;
    const q = filter.trim().toLowerCase();
    root.innerHTML = PHASES.map((phase) => {
      const units = phase.units.filter((u) => !q || u.title.toLowerCase().includes(q));
      if (!units.length) return '';
      return `
        <div class="rev-phase">
          <h3>${phase.title}</h3>
          ${units
            .map((u) => {
              const prog = getUnitProgress(u.id);
              return `
            <button type="button" class="rev-unit-btn ${selectedId === u.id ? 'is-active' : ''}" data-rev-unit="${u.id}">
              <span>${u.n}. ${u.title}</span>
              <span class="rev-badge rev-badge--${u.status}">${statusLabel(u.status)} · ${prog.done}/${prog.total}</span>
            </button>`;
            })
            .join('')}
        </div>`;
    }).join('');
  };

  const renderChecklist = (unitId) => {
    const panel = qs('[data-rev-checklist]');
    if (!panel) return;
    const unit = ALL_UNITS.find((u) => u.id === unitId);
    if (!unit) {
      panel.innerHTML = '<p class="rev-placeholder">اختر وحدة من القائمة لبدء المراجعة الهندسية.</p>';
      return;
    }
    const reviews = readReviews();
    const rev = reviews[unitId] || {};
    const prog = getUnitProgress(unitId);
    panel.innerHTML = `
      <div class="rev-head">
        <div>
          <h2>${unit.n}. ${unit.title}</h2>
          <p>حالة الهوب: <span class="rev-badge rev-badge--${unit.status}">${statusLabel(unit.status)}</span></p>
        </div>
        <div class="rev-progress">${prog.done} / ${prog.total} بنود مكتملة</div>
      </div>
      <div class="rev-fields">
        ${CHECKLIST.map(
          (c) => `
          <label class="rev-field ${rev[c.key] ? 'is-done' : ''}">
            <input type="checkbox" data-rev-field="${c.key}" ${rev[c.key] ? 'checked' : ''} />
            <span>${c.label}</span>
          </label>`
        ).join('')}
      </div>
      ${unit.href ? `<a class="rev-link" href="${unit.href}"><i class="fas fa-external-link-alt"></i> ${unit.hrefLabel}</a>` : ''}`;
  };

  const toggleField = (unitId, key, checked) => {
    const data = readReviews();
    if (!data[unitId]) data[unitId] = {};
    data[unitId][key] = checked;
    saveReviews(data);
    renderKpis();
    renderPhases(qs('[data-rev-q]')?.value || '');
    renderChecklist(unitId);
  };

  const init = () => {
    if (!qs('[data-rev-root]')) return;
    renderKpis();
    renderPhases();

    qs('[data-rev-phases]')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-rev-unit]');
      if (!btn) return;
      selectedId = btn.getAttribute('data-rev-unit');
      renderPhases(qs('[data-rev-q]')?.value || '');
      renderChecklist(selectedId);
    });

    qs('[data-rev-checklist]')?.addEventListener('change', (e) => {
      const cb = e.target.closest('[data-rev-field]');
      if (!cb || !selectedId) return;
      toggleField(selectedId, cb.getAttribute('data-rev-field'), cb.checked);
    });

    qs('[data-rev-q]')?.addEventListener('input', (e) => renderPhases(e.target.value));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.HubReviewMethodology = { PHASES, CHECKLIST, ALL_UNITS };
})();
