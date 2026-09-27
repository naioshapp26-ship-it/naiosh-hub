/**
 * NAIOSH HUB 360 — Empire Architecture Blueprint (Source of Truth)
 * Combined from Imperial Architecture (Ans.1) + Global Digital Hub (Ans.2)
 * This is NOT a brochure — it drives modules, roles, priorities, and dashboards.
 * الحقول name / axisKey داخلية؛ المعروض للمستخدم عبر nameAr / axisAr / items بالعربية.
 */
const EmpireBlueprint = (() => {
  const philosophy = {
    title: 'NAIOSH HUB 360',
    subtitle: 'نظام التشغيل العالمي لإمبراطورية نايوش',
    verdict:
      'لا يُبنى كموقع إلكتروني، بل كمنصة تشغيل مركزية (محور رقمي مركزي / محور رقمي عالمي) تربط الدومينات والأنظمة والفروع والحاضنات والمنصات والمكاتب الإلكترونية في بيئة واحدة قابلة للتوسع لأي دولة دون إعادة بناء الأساس.',
    capitalMetaphor:
      'العاصمة الرقمية لإمبراطورية نايوش — والدومينات المتخصصة (إي آر بي، نايس، فيت، لو…) مدن مرتبطة بها عبر هوية ومحرك تشغيل موحّدين.',
  };

  /** Answer 2 — 5 architectural layers */
  const fiveLayers = [
    {
      id: 'core',
      name: 'Core Layer',
      nameAr: 'الطبقة الأساسية',
      items: ['الهوية والصلاحيات', 'الذكاء الاصطناعي', 'المحفظة والنقاط'],
    },
    {
      id: 'business',
      name: 'Business Layer',
      nameAr: 'طبقة الأعمال',
      items: ['الأنظمة التشغيلية', 'الحاضنات', 'المنصات والمكاتب'],
    },
    {
      id: 'collaboration',
      name: 'Collaboration Layer',
      nameAr: 'طبقة التعاون',
      items: ['التسويق', 'الفعاليات', 'التواصل والتكامل'],
    },
    {
      id: 'knowledge',
      name: 'Knowledge Layer',
      nameAr: 'طبقة المعرفة',
      items: ['المعرفة العالمية', 'التدريب', 'منظومة التعلّم'],
    },
    {
      id: 'governance',
      name: 'Governance Layer',
      nameAr: 'طبقة الحوكمة',
      items: ['الحوكمة', 'التحليلات', 'الأمن والامتثال'],
    },
  ];

  /** Answer 1 — full stack tree */
  const stackTree = [
    {
      id: 'core-platform',
      name: 'Core Platform',
      nameAr: 'النواة المشتركة',
      children: ['الهوية والوصول', 'محرك التنظيم', 'الإشعارات', 'التدقيق', 'الإعدادات'],
    },
    {
      id: 'integration',
      name: 'Integration Layer',
      nameAr: 'الربط المؤسسي',
      children: ['بوابة واجهات البرمجة', 'ناقل الأحداث', 'الموصّلات'],
    },
    {
      id: 'governance-center',
      name: 'Governance Center',
      nameAr: 'مركز الحوكمة',
      children: ['مؤشرات الأداء', 'الامتثال', 'المخاطر', 'تقارير القيادة'],
    },
    {
      id: 'incubator-mgmt',
      name: 'Incubator Management',
      nameAr: 'إدارة الحاضنات',
      children: ['100 حاضنة', 'منصات', 'مكاتب', 'عقود'],
    },
    {
      id: 'platform-offices',
      name: 'Platform & Digital Offices',
      nameAr: 'المنصات والمكاتب',
      children: ['هيكل', 'مهام', 'وثائق', 'توقيع'],
    },
    {
      id: 'learning',
      name: 'Learning Ecosystem',
      nameAr: 'منظومة التعلّم',
      children: ['نظام إدارة التعلّم', 'منصة تجربة التعلّم', 'المعلّم الذكي', 'الشهادات'],
    },
    {
      id: 'marketing',
      name: 'Marketing Network',
      nameAr: 'التسويق الشبكي',
      children: ['المحتوى', 'الحملات', 'التسويق بالعمولة'],
    },
    {
      id: 'events',
      name: 'Events Studio',
      nameAr: 'استديو الفعاليات',
      children: ['بث', 'تذاكر', 'أرشيف'],
    },
    {
      id: 'crm',
      name: 'CRM & Customer Success',
      nameAr: 'خدمة العملاء (CRM)',
      children: ['تذاكر', 'معرفة', 'محادثة ذكية'],
    },
    {
      id: 'points',
      name: 'Points Economy',
      nameAr: 'اقتصاد النقاط',
      children: ['محفظة', 'استهلاك', 'فواتير'],
    },
    {
      id: 'knowledge',
      name: 'Knowledge Bank',
      nameAr: 'بنك المعرفة',
      children: ['كتب', 'حقائب', 'خبراء'],
    },
    {
      id: 'ai',
      name: 'AI Services',
      nameAr: 'خدمات الذكاء',
      children: ['البوابة', 'ذكاء المستندات', 'التنبؤ'],
    },
    {
      id: 'analytics',
      name: 'Analytics & BI',
      nameAr: 'التحليلات',
      children: ['بحيرة البيانات', 'استخراج وتحويل وتحميل', 'لوحات المؤشرات'],
    },
    {
      id: 'security',
      name: 'Security Layer',
      nameAr: 'الأمن',
      children: ['مصادقة OAuth2', 'المصادقة الثنائية', 'مراقبة الأمن'],
    },
    {
      id: 'mobile',
      name: 'Mobile Super App',
      nameAr: 'التطبيق الموحد',
      children: ['تسجيل الدخول الموحد', 'محفظة', 'إشعارات'],
    },
  ];

  /** Answer 2 — 12 primary axes */
  const twelveAxes = [
    {
      id: 'naiosh-id',
      priority: 1,
      name: 'NAIOSH ID',
      nameAr: 'بوابة الهوية الرقمية الموحدة',
      components: ['تسجيل المستخدمين', 'تسجيل الدخول الموحد', 'التحقق الثنائي', 'إدارة الحسابات', 'إدارة الصلاحيات', 'مصفوفة الصلاحيات'],
      roles: ['سوبر أدمن', 'مالك فرع', 'مدير حاضنة', 'مدير منصة', 'مدير مكتب', 'مدرب', 'متدرب', 'مستثمر', 'عميل', 'زائر'],
    },
    {
      id: 'structure',
      priority: 2,
      name: 'Global Structure Engine',
      nameAr: 'محرك الهيكل المؤسسي العالمي',
      components: ['الدول', 'المدن', 'الوكلاء', '100 حاضنة قطاعية', 'منصات التشغيل', 'المكاتب الإلكترونية والهيكل التنظيمي'],
    },
    {
      id: 'command',
      priority: 3,
      name: 'Global Command Center',
      nameAr: 'مركز التحكم العالمي',
      components: ['عدد الفروع', 'الحاضنات', 'المنصات', 'العملاء', 'المتدربين', 'الإيرادات', 'استخدام الأنظمة', 'لوحة لحظية'],
    },
    {
      id: 'marketplace',
      priority: 4,
      name: 'System Marketplace',
      nameAr: 'محرك الأنظمة التشغيلية',
      components: ['الأنظمة الـ 41', 'التطبيقات', 'التفعيل', 'الإيقاف', 'الاشتراك', 'ربط النظام'],
    },
    {
      id: 'wallet',
      priority: 5,
      name: 'NAIOSH Wallet',
      nameAr: 'محرك النقاط والاشتراكات',
      components: ['المحفظة', 'النقاط', 'الاستهلاك', 'التحويلات', 'الفواتير'],
    },
    {
      id: 'marketing-studio',
      priority: 6,
      name: 'Marketing Studio',
      nameAr: 'استديو التسويق الإلكتروني',
      components: ['إنشاء المحتوى', 'جدولة المنشورات', 'الحملات', 'تصميم البوستات', 'النشر الموحد للفروع والحاضنات والمنصات'],
    },
    {
      id: 'network-marketing',
      priority: 7,
      name: 'Network Marketing Engine',
      nameAr: 'محرك التسويق التشابكي',
      components: ['ربط الفروع', 'الحاضنات', 'المنصات', 'المكاتب', 'تبادل العملاء والخدمات والإعلانات'],
    },
    {
      id: 'events',
      priority: 8,
      name: 'Events Studio',
      nameAr: 'استديو الفعاليات',
      components: ['مؤتمرات', 'ندوات', 'اجتماعات', 'بث مباشر', 'فيديوهات', 'ريلز'],
    },
    {
      id: 'knowledge',
      priority: 9,
      name: 'Global Knowledge Center',
      nameAr: 'مركز المعرفة العالمي',
      components: ['كتب', 'حقائب تدريبية', 'سياسات', 'إجراءات', 'نماذج', 'فيديوهات', 'بنك الخبرات', 'المكتبة الرقمية'],
    },
    {
      id: 'ai-core',
      priority: 10,
      name: 'NAIOSH AI Core',
      nameAr: 'الذكاء الاصطناعي المركزي',
      components: ['المساعد الذكي', 'تحليل البيانات', 'التوصيات', 'إنشاء المحتوى', 'تحليل المخاطر', 'التدريب الذكي'],
    },
    {
      id: 'crm',
      priority: 11,
      name: 'CRM & Service Center',
      nameAr: 'مركز خدمة العملاء',
      components: ['التذاكر', 'الشكاوى', 'الاستفسارات', 'المتابعة', 'إدارة العملاء'],
    },
    {
      id: 'gov-analytics',
      priority: 12,
      name: 'Governance & Analytics',
      nameAr: 'مركز التحليلات والحوكمة',
      components: ['مؤشرات الأداء', 'الامتثال', 'المخاطر', 'جودة التشغيل', 'نشاط الفروع والحاضنات'],
    },
  ];

  /** Answer 1 — Core Platform must be complete first */
  const corePlatform = [
    {
      id: 'naiosh-id',
      name: 'NAIOSH ID',
      nameAr: 'هوية نايوش',
      descAr: 'الهوية الرقمية الموحدة لكل مستخدمي هوب',
    },
    {
      id: 'sso',
      name: 'Single Sign-On',
      nameAr: 'تسجيل الدخول الموحد',
      descAr: 'دخول موحّد لكل الدومينات والأنظمة',
    },
    {
      id: 'iam',
      name: 'IAM',
      nameAr: 'إدارة الهوية والصلاحيات',
      descAr: 'إدارة المستخدمين والصلاحيات والأدوار',
    },
    {
      id: 'role-matrix',
      name: 'Role Matrix Engine',
      nameAr: 'محرك مصفوفة القواعد',
      descAr: 'مصفوفة الصلاحيات الديناميكية حسب الدور والنظام',
    },
    {
      id: 'multi-tenant',
      name: 'Multi-Tenant Engine',
      nameAr: 'محرك تعدد المستأجرين',
      descAr: 'دعم الفروع والوكلاء والدول',
    },
    {
      id: 'org-hierarchy',
      name: 'Organization Hierarchy',
      nameAr: 'الهيكل التنظيمي',
      descAr: 'دولة ← فرع ← حاضنة ← منصة ← مكتب',
    },
    {
      id: 'notifications',
      name: 'Notification Center',
      nameAr: 'مركز الإشعارات',
      descAr: 'بريد · رسائل نصية · واتساب · إشعارات فورية',
    },
    {
      id: 'audit',
      name: 'Audit & Activity Log',
      nameAr: 'سجل التدقيق والنشاط',
      descAr: 'سجل كامل لكل العمليات',
    },
    {
      id: 'settings',
      name: 'Settings & Configuration',
      nameAr: 'الإعدادات والتكوين',
      descAr: 'إعدادات مركزية للمنصة',
    },
    {
      id: 'i18n',
      name: 'Language & Localization',
      nameAr: 'اللغة والتعريب',
      descAr: 'واجهة عربية مع دعم تعدد لغوي عند الحاجة',
    },
  ];

  const dashboardsByRole = [
    { role: 'super_admin', nameAr: 'سوبر أدمن', scope: 'إدارة الإمبراطورية كاملة' },
    { role: 'country_agent', nameAr: 'وكيل دولة', scope: 'إدارة الدولة والفروع' },
    { role: 'branch_manager', nameAr: 'مدير فرع', scope: 'الفرع والحاضنات التابعة' },
    { role: 'incubator_manager', nameAr: 'مدير حاضنة', scope: 'المنصات والمكاتب الإلكترونية' },
    { role: 'platform_manager', nameAr: 'مدير منصة', scope: 'تشغيل المنصة والخدمات' },
    { role: 'digital_office', nameAr: 'مستخدم مكتب إلكتروني', scope: 'مهام المكتب' },
    { role: 'trainer', nameAr: 'مدرب', scope: 'الدورات والمتدربون والتقييمات' },
    { role: 'trainee', nameAr: 'متدرب / طالب', scope: 'التعلم والاختبارات والشهادات' },
  ];

  /** First 6 months — Answer 1 priorities */
  const sixMonthPriorities = [
    { order: 1, axisKey: 'Core Platform', axis: 'النواة المشتركة', note: 'النواة المشتركة — لا نظام قبل اكتمالها' },
    { order: 2, axisKey: 'Identity & SSO', axis: 'الهوية وتسجيل الدخول الموحد', note: 'هوية نايوش + دخول موحد' },
    { order: 3, axisKey: 'Organization Hierarchy', axis: 'الهيكل التنظيمي', note: 'دولة ← فرع ← حاضنة ← منصة ← مكتب' },
    { order: 4, axisKey: 'Role Matrix Engine', axis: 'محرك مصفوفة القواعد', note: 'صلاحيات ديناميكية' },
    { order: 5, axisKey: 'Unified Dashboard', axis: 'لوحة التحكم الموحدة', note: 'بوابة ديناميكية حسب الدور' },
    { order: 6, axisKey: 'API Gateway', axis: 'بوابة واجهات البرمجة', note: 'منع الجزر المنفصلة' },
    { order: 7, axisKey: 'Incubator Management', axis: 'إدارة الحاضنات', note: '100 حاضنة' },
    { order: 8, axisKey: 'Platform & Digital Offices', axis: 'المنصات والمكاتب الرقمية', note: 'بيئات العمل الرقمية' },
    { order: 9, axisKey: 'Points Economy', axis: 'اقتصاد النقاط', note: 'نقاط لا اشتراكات' },
    { order: 10, axisKey: 'Governance Center', axis: 'مركز الحوكمة', note: 'رقابة مركزية للقائد' },
  ];

  const preCodeDocs = [
    { id: 'data-dictionary', name: 'Data Dictionary', nameAr: 'قاموس البيانات' },
    { id: 'permission-matrix', name: 'Permission Matrix', nameAr: 'مصفوفة الصلاحيات' },
    { id: 'integration-map', name: 'System Integration Map', nameAr: 'خريطة تكامل الأنظمة' },
    { id: 'user-journeys', name: 'User Journey Maps', nameAr: 'خرائط رحلة المستخدم' },
    { id: 'api-architecture', name: 'API Architecture', nameAr: 'معمارية واجهات البرمجة (API)' },
    { id: 'branch-incubator', name: 'Branch & Incubator Model', nameAr: 'نموذج الفروع والحاضنات' },
    { id: 'wallet-model', name: 'Wallet Model', nameAr: 'نموذج المحفظة' },
    { id: 'ai-architecture', name: 'AI Architecture', nameAr: 'معمارية الذكاء الاصطناعي' },
  ];

  const orgChain = ['دولة', 'فرع', 'حاضنة', 'منصة', 'مكتب إلكتروني'];

  const getAxis = (id) => twelveAxes.find((a) => a.id === id) || null;

  return {
    philosophy,
    fiveLayers,
    stackTree,
    twelveAxes,
    corePlatform,
    dashboardsByRole,
    sixMonthPriorities,
    preCodeDocs,
    orgChain,
    getAxis,
  };
})();

window.EmpireBlueprint = EmpireBlueprint;
