/**
 * المواصفات الوظيفية لمحرك المعرفة والتشغيل والتعلم — ملف 02
 * قالب: الهدف → المستخدمون → الصلاحيات → الشاشة → البيانات → العمليات →
 * Workflow → التكاملات → الذكاء الاصطناعي → التدريب → الاختبار → مؤشرات الأداء → التقارير
 */
(() => {
  'use strict';

  const SPEC_FIELDS = [
    { key: 'goal', label: 'الهدف' },
    { key: 'users', label: 'المستخدمون' },
    { key: 'permissions', label: 'الصلاحيات' },
    { key: 'screen', label: 'الشاشة' },
    { key: 'data', label: 'البيانات' },
    { key: 'ops', label: 'العمليات' },
    { key: 'workflow', label: 'Workflow' },
    { key: 'integrations', label: 'التكاملات' },
    { key: 'ai', label: 'الذكاء الاصطناعي' },
    { key: 'training', label: 'التدريب' },
    { key: 'test', label: 'الاختبار' },
    { key: 'kpis', label: 'مؤشرات الأداء' },
    { key: 'reports', label: 'التقارير' },
  ];

  const PHASES = [
    { n: 1, title: 'Enterprise Architecture', items: ['الكيانات', 'العلاقات', 'الأدوار', 'الصلاحيات', 'الخدمات', 'التكاملات'] },
    { n: 2, title: 'Core Platform', items: ['Identity', 'Permission', 'Organization', 'App Registry', 'Notification', 'Workflow', 'Audit'] },
    { n: 3, title: 'Data Layer', items: ['Users', 'Orgs', 'Knowledge', 'Workflows', 'Courses', 'Skills', 'Transactions'] },
    { n: 4, title: 'API / Integration', items: ['Integration Layer', 'مزامنة الأنظمة', 'استيراد/تصدير'] },
    { n: 5, title: 'HUB UI', items: ['Dashboard', 'Applications', 'Services', 'Learning', 'Wallet', 'Knowledge'] },
    { n: 6, title: 'مركز المعرفة', items: ['Knowledge Engine', 'Search', 'Version', 'Approval', 'AI Retrieval'] },
    { n: 7, title: 'التشغيل', items: ['Workflow Engine', 'تحويل الإجراءات'] },
    { n: 8, title: 'التعلّم', items: ['Learning', 'Assessment', 'Skill', 'Certificate', 'Adaptive'] },
    { n: 9, title: 'الذكاء الاصطناعي', items: ['Assistant', 'Search', 'Recommendations', 'Analytics', 'Decision Support'] },
    { n: 10, title: 'القياس', items: ['KPI Engine', 'استخدام', 'جودة', 'تكلفة', 'رضا'] },
  ];

  const MODULES = [
    {
      id: 'identity',
      title: 'هوية رقمية واحدة',
      status: 'partial',
      href: 'login.html',
      hrefLabel: 'تسجيل الدخول',
      goal: 'دخول مرة واحدة ثم معرفة من هو المستخدم وأين يعمل وما يحق له.',
      users: 'كل مستخدمي الإمبراطورية',
      permissions: 'حسب الدور والكيان التنظيمي',
      screen: 'login.html · لوحة الملف',
      data: 'User · Profile · Org link · Session',
      ops: 'تسجيل · دخول · ربط كيان · تدقيق',
      workflow: 'طلب حساب → تحقق → إنشاء NAIOSH ID → ربط فرع/حاضنة → فتح الأنظمة',
      integrations: 'SSO مع أنظمة المنصات',
      ai: 'اكتشاف حسابات مكررة واقتراح الدمج',
      training: 'دورة الدخول الموحّد',
      test: 'سيناريو دخول مستخدمين بأدوار مختلفة',
      kpis: 'نسبة الدخول الموحّد · زمن الدخول · حسابات مكررة',
      reports: 'سجل الدخول والتدقيق',
    },
    {
      id: 'empire-map',
      title: 'خريطة الإمبراطورية',
      status: 'partial',
      href: 'branches.html',
      hrefLabel: 'الفروع والحاضنات',
      goal: 'رؤية الهيكل: إمبراطورية → فرع → حاضنة → منصة → مكتب → نظام → مستخدم.',
      users: 'الإدارة العليا · مدير فرع · مدير حاضنة',
      permissions: 'نطاق الرؤية حسب الموقع التنظيمي',
      screen: 'branches · incubators · platforms · dashboard',
      data: 'ID + Owner + Status + Permissions + Systems + KPIs لكل كيان',
      ops: 'إنشاء · تفعيل · تعليق · نقل ملكية',
      workflow: 'طلب كيان → مراجعة → اعتماد → تفعيل → ربط أنظمة',
      integrations: 'مزامنة حالة الكيان مع الأنظمة الفرعية',
      ai: 'اكتشاف عقد تنظيمية بلا مالك أو بلا KPI',
      training: 'مسار مدير الحاضنة',
      test: 'دولة تجريبية بفرع وحاضنة و3 منصات',
      kpis: 'اكتمال الهيكل · كيانات نشطة · تغطية الأنظمة',
      reports: 'خريطة تشغيلية للإمبراطورية',
    },
    {
      id: 'apps',
      title: 'مركز التطبيقات',
      status: 'done',
      href: 'apps.html',
      hrefLabel: 'الأنظمة',
      goal: 'نقطة دخول مركزية: تطبيقاتي تظهر فقط ما يحق للمستخدم.',
      users: 'كل المستخدمين المشتركين',
      permissions: 'اشتراك + دور + مهارة إن لزم',
      screen: 'apps.html · dashboard أيقونات',
      data: 'Application Registry: اسم، دومين، حالة، إصدار، API، مالك',
      ops: 'تسجيل نظام · تفعيل أيقونة · إيقاف',
      workflow: 'اختيار نظام → تحقق اشتراك → فتح أيقونة → اختبار دخول',
      integrations: 'روابط الأنظمة وSSO',
      ai: 'اقتراح أنظمة حسب الدور',
      training: 'أساسيات تشغيل هوب',
      test: 'مستخدم يرى فقط أنظمته',
      kpis: 'استخدام لكل نظام · أخطاء فتح',
      reports: 'سجل الوصول للأنظمة',
    },
    {
      id: 'services',
      title: 'مركز الخدمات',
      status: 'partial',
      href: 'operating.html',
      hrefLabel: 'آلية التشغيل',
      goal: 'المستخدم يطلب خدمة لا نظاماً؛ هوب يجمع الأنظمة اللازمة.',
      users: 'عملاء · موظفون · مدراء',
      permissions: 'حسب نوع الخدمة والرصيد',
      screen: 'خريطة الخدمات في آلية التشغيل',
      data: 'Service catalog + أنظمة مرتبطة + تكلفة نقاط',
      ops: 'طلب خدمة · تجميع أنظمة · تنفيذ · إغلاق',
      workflow: 'طلب → مطابقة خدمة → خصم نقاط → تنفيذ → تقييم',
      integrations: 'LMS + HR + CRM + شهادات حسب الخدمة',
      ai: 'مطابقة نية المستخدم بالخدمة المناسبة',
      training: 'كتالوج الخدمات',
      test: 'سيناريو «أريد تدريب موظفي الشركة»',
      kpis: 'زمن تلبية الخدمة · رضا · استهلاك نقاط',
      reports: 'تقرير الخدمات الأكثر طلباً',
    },
    {
      id: 'points',
      title: 'محرك النقاط',
      status: 'partial',
      href: 'packages.html',
      hrefLabel: 'الباقات والرصيد',
      goal: 'استهلاك نقاط مقابل الخدمة وليس اشتراكاً زمنياً فقط.',
      users: 'المستخدم · المالية · الدعم',
      permissions: 'شحن · خصم · منح · تدقيق',
      screen: 'شريط الرصيد · إشحن رصيد · المحفظة',
      data: 'Transaction: قبل/بعد · خدمة · نظام · حالة',
      ops: 'منح مجاني · شحن · خصم · استرجاع',
      workflow: 'فتح شحن → اختيار مبلغ → تأكيد → تحديث رصيد مدفوع',
      integrations: 'كل الأنظمة التي تخصم نقاطاً',
      ai: 'تنبيه نفاد الرصيد واقتراح باقة',
      training: 'دليل الرصيد والاشتراك',
      test: 'شحن ثم خصم عبر خدمة',
      kpis: 'حجم المعاملات · رصيد مجاني vs مدفوع',
      reports: 'سجل المعاملات والفواتير',
    },
    {
      id: 'knowledge',
      title: 'محرك المعرفة',
      status: 'done',
      href: 'info-center.html',
      hrefLabel: 'مركز المعرفة',
      goal: 'كل معلومة Knowledge Object قابلة للبحث والربط بالتشغيل والتعلّم.',
      users: 'الجميع · مالكو المحتوى · المعتمدون',
      permissions: 'قراءة حسب السرية · اعتماد للمحتوى',
      screen: 'تبويب محرك المعرفة + اسأل نايوش',
      data: 'عنوان · نوع · قطاع · دور · كلمات · إصدار · روابط',
      ops: 'إنشاء · مراجعة · اعتماد · أرشفة',
      workflow: 'مسودة → مراجعة → اعتماد → نشر → ربط دورة/إجراء',
      integrations: 'دليل التشغيل · السياسات · الدورات',
      ai: 'استرجاع معتمد فقط؛ الإنسان يعتمد',
      training: 'كتابة كائن معرفي',
      test: 'بحث Taxonomy + اسأل نايوش',
      kpis: 'كائنات معتمدة · نسبة إجابة معتمدة',
      reports: 'فجوات المعرفة (أسئلة بلا إجابة)',
    },
    {
      id: 'operations',
      title: 'محرك التشغيل (Workflow)',
      status: 'partial',
      href: 'info-center.html',
      hrefLabel: 'محرك التشغيل',
      goal: 'تحويل «ماذا نعرف؟» إلى «كيف ننفذ؟» بقالب موحّد قابل للتنفيذ.',
      users: 'مدراء الفروع · الحاضنات · التشغيل',
      permissions: 'بدء/اعتماد خطوات حسب الدور',
      screen: 'تبويب محرك التشغيل + غرفة العمليات',
      data: 'هدف · مسؤول · مدخلات · خطوات · مخرجات · مخاطر',
      ops: 'بدء workflow · تقدم خطوة · استثناء · إغلاق',
      workflow: 'طلب → مراجعة → اعتماد → تنفيذ خطوات → اختبار جاهزية → تفعيل',
      integrations: 'الحاضنات · الأنظمة · الصلاحيات',
      ai: 'اقتراح الخطوة التالية وكشف الاختناقات',
      training: 'مسار مرتبط بكل workflow',
      test: 'تشغيل حاضنة جديدة من الطلب حتى التفعيل',
      kpis: 'زمن الدورة · نسبة اكتمال · استثناءات',
      reports: 'لوحة workflows الجارية',
    },
    {
      id: 'learning',
      title: 'محرك التعلّم والمهارات',
      status: 'partial',
      href: 'info-center.html',
      hrefLabel: 'محرك التعلّم',
      goal: 'وظيفة → دورة → اختبار → مهارة → صلاحية (عتبة إتقان).',
      users: 'متعلمون · مدربون · مدراء',
      permissions: 'فتح صلاحيات حساسة بعد عتبة الإتقان',
      screen: 'ملف المتعلّم · المسارات · LMS',
      data: 'Learner Profile · وحدات · تقييم · Skill %',
      ops: 'تسجيل مسار · إكمال وحدة · اختبار · فتح صلاحية',
      workflow: 'تحديد مستوى → مسار مخصص → وحدات → اختبار → إتقان → صلاحية',
      integrations: 'المعرفة · workflows · الشهادات',
      ai: 'تعليم تكيفي حسب نقاط الضعف',
      training: 'مسارات الأدوار (مدير حاضنة…)',
      test: 'إكمال مسار ورفع المهارة فوق العتبة',
      kpis: 'إكمال الدورات · متوسط الإتقان · صلاحيات مفتوحة',
      reports: 'فجوة المهارات حسب الدور',
    },
    {
      id: 'ask-naiosh',
      title: 'اسأل نايوش',
      status: 'partial',
      href: 'info-center.html',
      hrefLabel: 'اسأل نايوش',
      goal: 'إجابة + إجراء + رابط نظام + دليل + دورة — من معرفة معتمدة فقط.',
      users: 'كل المستخدمين',
      permissions: 'قراءة المعرفة المسموح بها',
      screen: 'واجهة اسأل في مركز المعرفة',
      data: 'سؤال · مطابقة كائن · روابط مرتبطة',
      ops: 'سؤال → استرجاع → عرض حزمة → تسجيل فجوة',
      workflow: 'سؤال → AI يقترح → عرض مصادر → (اختياري) تنفيذ إجراء',
      integrations: 'Knowledge · Operations · Learning',
      ai: 'طبقة اقتراح فقط؛ الاعتماد بشري',
      training: 'كيف تسأل سؤالاً تشغيلياً',
      test: 'أسئلة لها/ليس لها معرفة معتمدة',
      kpis: 'نسبة إجابة معتمدة · أسئلة بلا مصدر',
      reports: 'FAQ الحي من الأسئلة المتكررة',
    },
    {
      id: 'command',
      title: 'مركز القيادة / غرفة العمليات',
      status: 'partial',
      href: 'dashboard.html',
      hrefLabel: 'غرفة العمليات',
      goal: 'لوحة عليا للنزول من الإمبراطورية حتى النظام مع القياس والدعم.',
      users: 'الإدارة العليا · التشغيل',
      permissions: 'رؤية شاملة أو نطاق فرع',
      screen: 'dashboard.html',
      data: 'دول · فروع · حاضنات · أنظمة · نقاط · تذاكر · أداء',
      ops: 'مراقبة · تصعيد · قرارات تشغيلية',
      workflow: 'رصد مؤشر → تذكرة/مهمة → حل → قياس أثر',
      integrations: 'كل محركات هوب',
      ai: 'دعم قرار وتشخيص مشاكل متكررة',
      training: 'قيادة غرفة العمليات',
      test: 'سيناريو إمبراطورية مصغّرة كاملة',
      kpis: 'صحة الإمبراطورية · SLA الدعم · استخدام',
      reports: 'تقارير القيادة اليومية',
    },
  ];

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];

  const statusLabel = (s) => ({ done: 'تم في الهوب', partial: 'جزئي', missing: 'لسه' }[s] || s);

  const renderPhases = () => {
    const root = qs('[data-spec-phases]');
    if (!root) return;
    root.innerHTML = PHASES.map(
      (p) => `
      <article class="spec-phase">
        <strong>المرحلة ${p.n}</strong>
        <h3>${p.title}</h3>
        <ul>${p.items.map((i) => `<li>${i}</li>`).join('')}</ul>
      </article>`
    ).join('');
  };

  const renderList = (filter = '') => {
    const list = qs('[data-spec-list]');
    if (!list) return;
    const q = filter.trim().toLowerCase();
    const rows = MODULES.filter((m) => {
      if (!q) return true;
      const hay = `${m.title} ${m.goal} ${m.id}`.toLowerCase();
      return hay.includes(q);
    });
    list.innerHTML = rows
      .map(
        (m) => `
      <article class="spec-card" data-spec-id="${m.id}">
        <header>
          <h3>${m.title}</h3>
          <span class="spec-badge spec-badge--${m.status}">${statusLabel(m.status)}</span>
        </header>
        <p class="spec-goal">${m.goal}</p>
        <dl class="spec-grid">
          ${SPEC_FIELDS.map((f) => `<div><dt>${f.label}</dt><dd>${m[f.key] || '—'}</dd></div>`).join('')}
        </dl>
        <div class="spec-actions">
          <a class="primary" href="${m.href}">${m.hrefLabel}</a>
        </div>
      </article>`
      )
      .join('');
  };

  const renderKpis = () => {
    const root = qs('[data-spec-kpis]');
    if (!root) return;
    const done = MODULES.filter((m) => m.status === 'done').length;
    const partial = MODULES.filter((m) => m.status === 'partial').length;
    const missing = MODULES.filter((m) => m.status === 'missing').length;
    root.innerHTML = [
      { n: MODULES.length, l: 'مكونات المواصفات' },
      { n: done, l: 'تم' },
      { n: partial, l: 'جزئي' },
      { n: missing, l: 'لسه' },
      { n: PHASES.length, l: 'مراحل البناء' },
    ]
      .map((i) => `<article class="spec-kpi"><strong>${i.n}</strong><span>${i.l}</span></article>`)
      .join('');
  };

  const init = () => {
    if (!qs('[data-spec-root]')) return;
    renderKpis();
    renderPhases();
    renderList();
    qs('[data-spec-q]')?.addEventListener('input', (e) => renderList(e.target.value));
    qsa('[data-spec-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        qsa('[data-spec-filter]').forEach((b) => b.classList.toggle('is-active', b === btn));
        const st = btn.getAttribute('data-spec-filter');
        const list = qs('[data-spec-list]');
        if (!list) return;
        qsa('.spec-card', list).forEach((card) => {
          const mod = MODULES.find((m) => m.id === card.getAttribute('data-spec-id'));
          card.hidden = st !== 'all' && mod?.status !== st;
        });
      });
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.HubEngineSpecs = { MODULES, PHASES, SPEC_FIELDS };
})();
