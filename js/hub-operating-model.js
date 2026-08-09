/**
 * آلية تشغيل نايوش هوب — المبادئ الـ11 + كتالوج الخدمات + واجهة مساعدة
 */
(() => {
  const PRINCIPLES = [
    {
      id: 1,
      title: 'عدم التكرار',
      icon: 'fa-clone',
      summary: 'سجل أنظمة واحد · خدمة واحدة · مصدر بيانات واحد',
      detail: 'هوب هو المصدر المرجعي للأنظمة والخدمات. كل نظام يُسجَّل مرة واحدة بكود فريد، والخدمات تُعرَّف مرة وتُعرض موحّدة في هوب ومفلترة داخل النظام.',
    },
    {
      id: 2,
      title: 'أيقونات تفتح الأنظمة',
      icon: 'fa-arrow-up-right-from-square',
      summary: 'كل أيقونة تفتح النظام/الموقع المخصص مباشرة',
      detail: 'الضغط على أيقونة النظام يفتح بوابته المخصصة (عبر هوب أو منفردًا) مع سياق العودة، دون صفحات وسيطة مكررة.',
    },
    {
      id: 3,
      title: 'صلاحيات حسب الاشتراك',
      icon: 'fa-key',
      summary: 'الاشتراك يمنح الصلاحية — لا وصول بدون اشتراك نشط',
      detail: 'شراء/منح اشتراك لنظام معيّن يفعّل صلاحيات العميل (قراءة · كتابة · إدارة). الإطلاق يُفحص قبل الدخول.',
    },
    {
      id: 4,
      title: 'تقارير واضحة',
      icon: 'fa-scroll',
      summary: 'هوب يعكس كل الأنشطة الماضية والجارية',
      detail: 'التقارير تُبنى من سجل النشاط الموحّد: تشغيل أنظمة · مزامنة · إشعارات · طلبات · منح هيكل · اشتراكات.',
    },
    {
      id: 5,
      title: 'التحكم من هوب',
      icon: 'fa-satellite-dish',
      summary: 'تشغيل · إيقاف · مزامنة · أوامر من غرفة العمليات',
      detail: 'غرفة العمليات تتحكم بالأنظمة المسجّلة: فتح · تبديل حالة · رفع بيانات · إشعارات مركزية.',
    },
    {
      id: 6,
      title: 'منح الهيكل من هوب',
      icon: 'fa-sitemap',
      summary: 'فروع · حاضنات · منصات · مكاتب إلكترونية',
      detail: 'إنشاء ومنح الفروع والحاضنات والمنصات والمكاتب الإلكترونية يتم من هوب ويرتبط بالصلاحيات والمحفظة.',
    },
    {
      id: 7,
      title: 'تسجيل مفتوح من هوب',
      icon: 'fa-user-plus',
      summary: 'التسجيل في الأنظمة والبرامج يبدأ من هوب',
      detail: 'نقطة تسجيل واحدة في هوب لأي نظام أو برنامج؛ بعد الموافقة يظهر في السجل الموحّد.',
    },
    {
      id: 8,
      title: 'دخول حسب الصلاحية',
      icon: 'fa-right-to-bracket',
      summary: 'الدخول للنظام المشترك فيه فقط وبالصلاحية الممنوحة',
      detail: 'من هوب يدخل العميل للنظام المشترك فيه فقط، ويُمرَّر رمز جلسة NAIOSH ID مع حدود الصلاحية.',
    },
    {
      id: 9,
      title: 'تسجيل دخول واحد (SSO)',
      icon: 'fa-id-card',
      summary: 'جلسة واحدة لكل الأنظمة والبرامج',
      detail: 'NAIOSH ID جلسة موحّدة؛ بعد الدخول مرة واحدة تُفتح الأنظمة المصرّح بها دون إعادة تسجيل منفصلة.',
    },
    {
      id: 10,
      title: 'خدمات موحّدة / مفلترة',
      icon: 'fa-layer-group',
      summary: 'هوب = كل الخدمات · النظام = خدماته فقط',
      detail: 'في هوب تظهر كل خدمات الأنظمة. داخل كل نظام تظهر فقط خدمات وأنشطة ذلك النظام.',
    },
    {
      id: 11,
      title: 'هوب يعكس كل الخدمات',
      icon: 'fa-globe',
      summary: 'خريطة خدمات كاملة عبر كل الأنظمة',
      detail: 'لوحة خدمات هوب تجمع خدمات ERP · LAW · FIT · Academy وغيرها في عرض واحد قابل للفلترة.',
    },
  ];

  /** خدمات كل نظام — تظهر كاملة في هوب ومفلترة داخل النظام */
  const SYSTEM_SERVICES = {
    ERP: [
      { id: 'erp-exec', nameAr: 'الإدارة التنفيذية', icon: 'fa-briefcase' },
      { id: 'erp-staff', nameAr: 'إدارة الموظفين', icon: 'fa-user-tie' },
      { id: 'erp-smart', nameAr: 'الأنظمة الذكية', icon: 'fa-microchip' },
      { id: 'erp-subs', nameAr: 'إدارة الاشتراكات', icon: 'fa-ticket' },
      { id: 'erp-ops', nameAr: 'إدارة العمليات', icon: 'fa-gears' },
      { id: 'erp-finance-approve', nameAr: 'الموافقات المالية', icon: 'fa-file-invoice-dollar' },
      { id: 'erp-tenants', nameAr: 'المستأجرون', icon: 'fa-building-user' },
      { id: 'erp-customers', nameAr: 'مركز العملاء', icon: 'fa-users' },
      { id: 'erp-training', nameAr: 'التدريب والتطوير', icon: 'fa-graduation-cap' },
      { id: 'erp-quality', nameAr: 'الجودة والتدقيق', icon: 'fa-clipboard-check' },
      { id: 'erp-eval', nameAr: 'التقييم', icon: 'fa-star' },
      { id: 'erp-tasks', nameAr: 'المهام', icon: 'fa-list-check' },
      { id: 'erp-info', nameAr: 'مركز المعلومات', icon: 'fa-circle-info' },
      { id: 'erp-brand', nameAr: 'الهوية البصرية', icon: 'fa-palette' },
      { id: 'erp-log', nameAr: 'سجل النظام', icon: 'fa-book' },
      { id: 'erp-events', nameAr: 'ستوديو الفعاليات', icon: 'fa-calendar-days' },
      { id: 'erp-org', nameAr: 'الهيكل التنظيمي', icon: 'fa-sitemap' },
      { id: 'erp-finance', nameAr: 'المالية والمحاسبة', icon: 'fa-coins' },
      { id: 'erp-archive', nameAr: 'الأرشيف', icon: 'fa-box-archive' },
      { id: 'erp-hr', nameAr: 'الموارد البشرية', icon: 'fa-id-card' },
      { id: 'erp-campaigns', nameAr: 'الحملات التسويقية', icon: 'fa-bullhorn' },
      { id: 'erp-requests', nameAr: 'طلبات الموظفين', icon: 'fa-inbox' },
      { id: 'erp-pay', nameAr: 'أنظمة الدفع', icon: 'fa-credit-card' },
      { id: 'erp-supply', nameAr: 'سلاسل الإمداد', icon: 'fa-truck' },
      { id: 'erp-services', nameAr: 'الخدمات', icon: 'fa-concierge-bell' },
      { id: 'erp-safety', nameAr: 'السلامة والصحة المهنية', icon: 'fa-helmet-safety' },
      { id: 'erp-facilities', nameAr: 'إدارة المرافق', icon: 'fa-warehouse' },
      { id: 'erp-plants', nameAr: 'إدارة المنشآت', icon: 'fa-industry' },
      { id: 'erp-policies', nameAr: 'السياسات التشغيلية', icon: 'fa-file-shield' },
      { id: 'erp-innovation', nameAr: 'المهارات والابتكارات', icon: 'fa-lightbulb' },
      { id: 'erp-sustain', nameAr: 'الاستدامة', icon: 'fa-leaf' },
      { id: 'erp-auto', nameAr: 'الأتمتة', icon: 'fa-robot' },
      { id: 'erp-gov', nameAr: 'الحوكمة', icon: 'fa-scale-balanced' },
      { id: 'erp-inventory', nameAr: 'المخزون', icon: 'fa-boxes-stacked' },
      { id: 'erp-sales', nameAr: 'المبيعات', icon: 'fa-cart-shopping' },
    ],
    LAW: [
      { id: 'law-cases', nameAr: 'القضايا', icon: 'fa-gavel' },
      { id: 'law-clients', nameAr: 'العملاء', icon: 'fa-users' },
      { id: 'law-parties', nameAr: 'الموكلين', icon: 'fa-user-tie' },
      { id: 'law-sessions', nameAr: 'التقويم والجلسات', icon: 'fa-calendar-check' },
      { id: 'law-finance', nameAr: 'المالية', icon: 'fa-coins' },
      { id: 'law-accounting', nameAr: 'المحاسبة القانونية', icon: 'fa-file-invoice' },
      { id: 'law-archive', nameAr: 'الأرشيف', icon: 'fa-box-archive' },
      { id: 'law-roles', nameAr: 'الأدوار والصلاحيات', icon: 'fa-user-shield' },
      { id: 'law-sovereign', nameAr: 'اللوحة السيادية', icon: 'fa-crown' },
      { id: 'law-intl', nameAr: 'التصنيف الدولي', icon: 'fa-earth-americas' },
      { id: 'law-network', nameAr: 'الشبكة المهنية', icon: 'fa-network-wired' },
      { id: 'law-library', nameAr: 'المكتبة القانونية', icon: 'fa-book-open' },
      { id: 'law-esign', nameAr: 'الحوكمة والتوقيع الإلكتروني', icon: 'fa-signature' },
      { id: 'law-services', nameAr: 'الخدمات القانونية', icon: 'fa-scale-balanced' },
      { id: 'law-integrations', nameAr: 'التكاملات', icon: 'fa-plug' },
      { id: 'law-ai', nameAr: 'الذكاء الاصطناعي القانوني', icon: 'fa-brain' },
      { id: 'law-contracts', nameAr: 'العقود', icon: 'fa-file-contract' },
      { id: 'law-compliance', nameAr: 'الامتثال', icon: 'fa-shield-halved' },
    ],
    FIT: [
      { id: 'fit-members', nameAr: 'الأعضاء', icon: 'fa-id-card' },
      { id: 'fit-programs', nameAr: 'البرامج', icon: 'fa-dumbbell' },
      { id: 'fit-subscriptions', nameAr: 'الاشتراكات', icon: 'fa-ticket' },
    ],
    NAIS: [
      { id: 'nais-dashboard', nameAr: 'لوحة القرار', icon: 'fa-chart-line' },
      { id: 'nais-alerts', nameAr: 'التنبيهات', icon: 'fa-bell' },
      { id: 'nais-bridge', nameAr: 'جسر العملاء', icon: 'fa-bridge' },
    ],
    ACADEMY: [
      { id: 'ac-courses', nameAr: 'الدورات', icon: 'fa-chalkboard' },
      { id: 'ac-diplomas', nameAr: 'الدبلومات', icon: 'fa-graduation-cap' },
      { id: 'ac-workshops', nameAr: 'الورش', icon: 'fa-chalkboard-user' },
      { id: 'ac-certs', nameAr: 'الشهادات', icon: 'fa-certificate' },
    ],
    LMS: [
      { id: 'lms-paths', nameAr: 'المسارات', icon: 'fa-route' },
      { id: 'lms-content', nameAr: 'المحتوى', icon: 'fa-book' },
      { id: 'lms-assess', nameAr: 'التقييم', icon: 'fa-clipboard-check' },
    ],
    CRM: [
      { id: 'crm-leads', nameAr: 'العملاء المحتملون', icon: 'fa-user-plus' },
      { id: 'crm-pipeline', nameAr: 'خط المبيعات', icon: 'fa-filter' },
      { id: 'crm-support', nameAr: 'الدعم', icon: 'fa-headset' },
    ],
  };

  const PERMISSION_LEVELS = [
    { id: 'read', nameAr: 'قراءة' },
    { id: 'write', nameAr: 'كتابة' },
    { id: 'admin', nameAr: 'إدارة' },
  ];

  const servicesFor = (code) => SYSTEM_SERVICES[String(code || '').toUpperCase()] || [];

  const allServices = () =>
    Object.entries(SYSTEM_SERVICES).flatMap(([systemCode, list]) =>
      list.map((s) => ({ ...s, systemCode, systemName: window.HubLauncher?.SYSTEM_META?.[systemCode]?.nameAr || systemCode }))
    );

  window.HubOperatingModel = {
    PRINCIPLES,
    SYSTEM_SERVICES,
    PERMISSION_LEVELS,
    servicesFor,
    allServices,
  };
})();
