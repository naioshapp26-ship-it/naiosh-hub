/**
 * NAIOSH GLOBAL OPERATING SYSTEM — بيانات المعمارية والسجل والمصفوفات
 * مصدر: تشغيل انظمة ERP.rar (وثائق المعمارية + سجل الأنظمة)
 */
(() => {
  'use strict';

  const layers = [
    { id: 'gov', n: 1, en: 'Governance', ar: 'الحوكمة والإدارة', desc: 'إمبراطورية ← دولة ← فرع ← حاضنة ← منصة ← مكتب ← قسم ← مستخدم' },
    { id: 'id', n: 2, en: 'Identity & Access', ar: 'الهوية والوصول', desc: 'هوية نايوش · الدخول الموحد · الصلاحيات حسب الدور والسياق · سياق الكيان' },
    { id: 'ops', n: 3, en: 'Core Operations', ar: 'العمليات الأساسية', desc: 'مسارات العمل · الطلبات · المهام · المستندات · التدقيق' },
    { id: 'erp', n: 4, en: 'ERP', ar: 'المالية والموارد (ERP)', desc: 'المالية · الموارد البشرية · المشتريات · المبيعات · المخزون' },
    { id: 'spec', n: 5, en: 'Specialized Engines', ar: 'المحركات المتخصصة', desc: 'الـ41 محركًا المتخصص داخل المنظومة' },
    { id: 'int', n: 6, en: 'Integration Hub', ar: 'مركز التكامل', desc: 'واجهات البرمجة · الأحداث · خطافات الويب · المزامنة' },
    { id: 'data', n: 7, en: 'Data & Knowledge', ar: 'البيانات والمعرفة', desc: 'تشغيلية · تحليلية · سياسات · دروس مستفادة' },
    { id: 'mkt', n: 8, en: 'Marketing & CRM', ar: 'التسويق وإدارة العملاء', desc: 'حملة → عميل محتمل → إدارة العملاء → بيع → عائد الاستثمار' },
    { id: 'ai', n: 9, en: 'AI Intelligence', ar: 'الذكاء الاصطناعي', desc: 'مساعد · محلل · مستشار · تنبؤ · منسّق' },
    { id: 'cmd', n: 10, en: 'Command Center', ar: 'مركز القيادة', desc: 'من العالم إلى المعاملة في شاشة واحدة' },
  ];

  const coreServices = [
    'التسجيل الموحّد وهوية نايوش',
    'الدخول الموحّد',
    'إدارة الهوية',
    'الأدوار والصلاحيات',
    'إدارة الهيكل والمستأجرين',
    'إدارة النطاقات الفرعية',
    'محرك لوحة المستخدم',
    'محرك القوائم والتنقّل',
    'محرك مسارات العمل',
    'محرك الإشعارات',
    'محرك المهام',
    'محرك الوثائق والأرشفة',
    'العضوية والشهادات',
    'الاشتراكات والباقات',
    'محرك النقاط والاستخدام',
    'محرك الدفع',
    'العملاء وإدارة العلاقات',
    'استوديو التسويق',
    'مركز المعرفة والمعلومات',
    'محرك البحث',
    'محرك التقارير ومؤشرات الأداء',
    'سجل التدقيق',
    'واجهات البرمجة / مركز التكامل',
    'بوابة الذكاء الاصطناعي',
    'التحليلات ومركز القيادة',
  ];

  const executionOrder = [
    { n: 1, title: 'نواة المعمارية', desc: 'المعمارية والبنية الأساسية' },
    { n: 2, title: 'التسجيل الموحّد وهوية نايوش', desc: 'التسجيل والهوية الموحدة' },
    { n: 3, title: 'الدخول الموحّد', desc: 'دخول موحّد لجميع الأنظمة' },
    { n: 4, title: 'محرك الهيكل والمستأجرين', desc: 'دول → فروع → حاضنات → منصات → مكاتب → مستأجرين' },
    { n: 5, title: 'الأدوار والصلاحيات', desc: 'الأدوار ومصفوفة الصلاحيات' },
    { n: 6, title: 'المكوّنات التشغيلية المشتركة', desc: 'مسارات العمل · مهام · إشعارات · وثائق · نقاط · دفع · تقارير · تدقيق' },
    { n: 7, title: 'نواة HUB 360', desc: 'مركز التشغيل والتوجيه' },
    { n: 8, title: 'مركز التكامل + واجهات البرمجة + ناقل الأحداث', desc: 'الجهاز العصبي للمنظومة' },
    { n: 9, title: 'مركز البيانات والمعرفة', desc: 'البيانات والمعرفة المؤسسية' },
    { n: 10, title: 'بوابة الذكاء الاصطناعي', desc: 'طبقة الذكاء فوق كل الأنظمة' },
    { n: 11, title: 'الأنظمة المتخصصة 01←41', desc: 'الأنظمة المتخصصة واحدًا تلو الآخر' },
  ];

  const aiLevels = [
    { id: 'assistant', n: 1, title: 'AI Assistant', ar: 'مساعد ذكي', desc: 'يجيب عن الأسئلة ضمن الصلاحيات.' },
    { id: 'analyst', n: 2, title: 'AI Analyst', ar: 'محلل ذكي', desc: 'يفهم البيانات ويشرح الأسباب.' },
    { id: 'advisor', n: 3, title: 'AI Advisor', ar: 'مستشار ذكي', desc: 'يقدّم توصيات قابلة للاعتماد.' },
    { id: 'predictor', n: 4, title: 'AI Predictor', ar: 'تنبؤ ذكي', desc: 'يتوقع الأداء والطلب والمخاطر.' },
    { id: 'orchestrator', n: 5, title: 'AI Orchestrator', ar: 'منسّق ذكي', desc: 'ينسّق العمليات المصرّح بها مع مراجعة بشرية في الحلقة.' },
  ];

  const erpLayers = [
    { n: 1, title: 'الحوكمة والإدارة', items: ['لوحة تحكم', 'أدوار', 'سياسات', 'هيكل', 'أرشفة', 'مستأجرين', 'طلبات', 'اشتراك سحابي'] },
    { n: 2, title: 'الموارد البشرية', items: ['الأفراد 360', 'حضور', 'رواتب', 'أداء', 'تدريب', 'مواهب'] },
    { n: 3, title: 'المالية والدفع', items: ['حسابات', 'فواتير', 'تحصيل', 'بنوك', 'ميزانيات', 'نقاط'] },
    { n: 4, title: 'المبيعات والعملاء', items: ['إدارة العملاء', 'عروض', 'عقود', 'نقاط البيع', 'عمولات'] },
    { n: 5, title: 'التشغيل والخدمات', items: ['مهام', 'مستوى الخدمة', 'مكاتب إلكترونية', 'عمليات يومية'] },
    { n: 6, title: 'سلاسل الإمداد', items: ['مشتريات', 'مخزون', 'موردون', 'لوجستيات', 'جودة'] },
    { n: 7, title: 'الأصول والمرافق', items: ['أصول', 'صيانة', 'عقود', 'تكامل المرافق'] },
    { n: 8, title: 'البيانات والتحليل والأتمتة', items: ['مركز البيانات', 'مؤشرات الأداء', 'مستشار ذكي', 'اختناقات'] },
  ];

  const cycle = ['خطّط', 'اطلب', 'اعتمد', 'نفّذ', 'سجّل', 'المالية', 'قِس', 'حلّل', 'ذكاء', 'قرّر', 'حسّن'];

  const events = [
    { code: 'Student.Registered', systems: ['LMS', 'CRM', 'Points'] },
    { code: 'Course.Completed', systems: ['LMS', 'Knowledge', 'AI'] },
    { code: 'Invoice.Created', systems: ['Finance', 'CRM', 'ERP'] },
    { code: 'Payment.Received', systems: ['Finance', 'Points', 'CRM', 'Notifications', 'Analytics'] },
    { code: 'Campaign.Created', systems: ['Marketing', 'Ads', 'Analytics'] },
    { code: 'Lead.Created', systems: ['CRM', 'Sales', 'Marketing'] },
    { code: 'Employee.Hired', systems: ['HR', 'Identity', 'Tasks'] },
    { code: 'Purchase.Approved', systems: ['Supply', 'Finance', 'Workflow'] },
    { code: 'Asset.MaintenanceDue', systems: ['Facility', 'Assets', 'Notifications'] },
    { code: 'Opportunity.Matched', systems: ['Opportunity', 'Learning', 'CRM'] },
    { code: 'Tenant.SubdomainGranted', systems: ['Identity', 'Organization', 'HUB'] },
    { code: 'Structure.Granted', systems: ['Organization', 'Branches', 'Incubators'] },
  ];

  const dataDictionary = [
    { entity: 'العميل', owner: 'إدارة العملاء', type: 'رئيسي', readers: ['المبيعات', 'المالية', 'التسويق', 'الدعم'], writers: ['إدارة العملاء'] },
    { entity: 'الموظف', owner: 'الموارد البشرية', type: 'رئيسي', readers: ['المرافق', 'السلامة', 'التدريب', 'ERP'], writers: ['الموارد البشرية'] },
    { entity: 'منتج / خدمة', owner: 'الكتالوج', type: 'رئيسي', readers: ['المتجر', 'التسويق', 'المالية', 'إدارة العملاء'], writers: ['الكتالوج', 'ERP'] },
    { entity: 'المورد', owner: 'الإمداد', type: 'رئيسي', readers: ['المالية', 'المرافق', 'المشتريات'], writers: ['الإمداد'] },
    { entity: 'الفرع', owner: 'الهيكل', type: 'رئيسي', readers: ['الكل'], writers: ['الهيكل'] },
    { entity: 'الحاضنة', owner: 'الهيكل', type: 'رئيسي', readers: ['الكل'], writers: ['الهيكل'] },
    { entity: 'المنصة', owner: 'الهيكل', type: 'رئيسي', readers: ['الكل'], writers: ['الهيكل'] },
    { entity: 'المكتب', owner: 'الهيكل', type: 'رئيسي', readers: ['الكل'], writers: ['الهيكل'] },
    { entity: 'طالب / متدرّب', owner: 'نظام التعلم', type: 'رئيسي', readers: ['إدارة العملاء', 'الأكاديمية', 'المالية'], writers: ['نظام التعلم', 'الأكاديمية'] },
    { entity: 'الأصل', owner: 'الأصول / المرافق', type: 'رئيسي', readers: ['المالية', 'الموارد البشرية', 'التشغيل'], writers: ['الأصول'] },
    { entity: 'العقد', owner: 'القانون / ERP', type: 'رئيسي', readers: ['المالية', 'المبيعات', 'الموارد البشرية'], writers: ['القانون', 'ERP'] },
    { entity: 'الفاتورة', owner: 'المالية', type: 'معاملة', readers: ['إدارة العملاء', 'المبيعات', 'التحليلات'], writers: ['المالية'] },
    { entity: 'الدفعة', owner: 'المالية / النقاط', type: 'معاملة', readers: ['إدارة العملاء', 'التحليلات', 'المحفظة'], writers: ['المالية', 'النقاط'] },
    { entity: 'هوية نايوش', owner: 'الهوية', type: 'رئيسي', readers: ['الكل'], writers: ['الهوية'] },
    { entity: 'كائن معرفة', owner: 'المعرفة', type: 'مشتق', readers: ['الذكاء', 'الكل'], writers: ['المعرفة', 'الأنظمة'] },
  ];

  const directives = [
    'لا تبنوا 41 نظامًا منفصلًا — محركات داخل نظام تشغيل واحد.',
    'ابنوا النواة أولًا قبل الأنظمة المتخصصة.',
    'لا تكرروا الوظائف المشتركة — محركات مركزية.',
    'HUB 360 = طبقة تنسيق وليس مجرد لوحة تحكم.',
    'أنشئوا قاموس بيانات ومصدر حقيقة لكل كيان.',
    'معمارية موجّهة بالأحداث بدل ربط كل نظام بكل نظام.',
    'واجهات البرمجة أولًا — لا وصول مباشر لقواعد أنظمة أخرى.',
    'تعدد المستأجرين والدول من اليوم الأول.',
    'صلاحيات حسب الدور والسياق للدولة/الفرع/الحاضنة/المنصة/المكتب.',
    'الأمن منذ اليوم الأول (مصادقة متعددة · ثقة صفرية · تدقيق).',
    'الذكاء عبر بوابة الذكاء فقط مع سجل تدقيق.',
    'المراجعة البشرية في الحلقة: أخضر / أصفر / أحمر.',
    'التوسع بالإعدادات وليس بإعادة البرمجة.',
    'محرك النقاط مركزي لنموذج الاستخدام.',
    'استوديو التسويق قابل للاستدعاء من أي خدمة.',
    'كل نظام ينتج كائنات معرفة.',
    'المعمارية قبل واجهة المستخدم.',
    'اختبار التكامل أهم من اختبار النظام منفردًا.',
    'بيئات: تطوير → اختبار → تجهيز → إنتاج.',
    'مجلس مراجعة المعمارية قبل أي إنتاج.',
  ];

  const mk = (id, nameAr, nameEn, tier, domain, goal, href, integrations, readiness) => ({
    id,
    code: `SYS-${String(id).padStart(2, '0')}`,
    nameAr,
    nameEn,
    tier,
    domain,
    goal,
    href: href || 'apps.html',
    owner: 'مجلس معمارية نايوش',
    status: readiness >= 85 ? 'ready' : readiness >= 70 ? 'integrate' : 'reengineer',
    readiness,
    integrations: integrations || { hub: true, erp: false, crm: false, marketing: false, ai: true, knowledge: true, data: true, workflow: true },
    dependsOn: [],
    dependents: [],
  });

  const systems = [
    mk(1, 'التسجيل والهوية الموحدة', 'Unified Identity & Registration', 1, 'Core', 'باب واحد لإمبراطورية نايوش وهوية نايوش', 'login.html', { hub: true, erp: true, crm: true, marketing: true, ai: true, knowledge: true, data: true, workflow: true }, 88),
    mk(2, 'الدخول الموحّد SSO', 'Single Sign-On', 1, 'Core', 'جلسة واحدة لكل الأنظمة دون إعادة تسجيل', 'login.html', null, 86),
    mk(3, 'محرك الهيكل والمستأجرين', 'Organization & Tenant Engine', 1, 'Core', 'دول · فروع · حاضنات · منصات · مكاتب · مستأجرين', 'branches.html', null, 84),
    mk(4, 'الأدوار والصلاحيات', 'Roles & Permissions Engine', 1, 'Core', 'صلاحيات حسب الدور والسياق والكيان', 'system-ops.html', null, 85),
    mk(5, 'محرك سير العمل', 'Workflow Engine', 1, 'Core', 'طلب → اعتماد → تنفيذ مركزي', 'system-ops.html', null, 78),
    mk(6, 'محرك الإشعارات', 'Notification Engine', 1, 'Core', 'إشعارات موحّدة لكل الأنظمة', 'dashboard.html', null, 80),
    mk(7, 'محرك الطلبات', 'Request Engine', 1, 'Core', 'طلبات الموظفين والعمليات بمسار عمل واحد', 'system-ops.html', null, 76),
    mk(8, 'الوثائق والأرشفة', 'Document & Archive Engine', 1, 'Core', 'أرشفة وتصنيف ومرفقات مشتركة', 'info-center.html', null, 74),
    mk(9, 'النقاط والاستخدام', 'Points & Usage Engine', 1, 'Core', 'رصيد · خصم · Ledger · تقارير الاستخدام', 'packages.html', null, 82),
    mk(10, 'محرك الدفع', 'Payment Engine', 1, 'Core', 'فواتير ذكية · بوابات · أقساط · تحصيل', 'store.html', { hub: true, erp: true, crm: true, marketing: false, ai: true, knowledge: false, data: true, workflow: true }, 81),
    mk(11, 'مركز التكامل', 'Integration Hub', 1, 'Core', 'واجهات البرمجة · الأحداث · خطافات الويب · المزامنة', 'global-os.html#integration', null, 72),
    mk(12, 'نواة هوب 360', 'HUB 360 Core', 1, 'Core', 'طبقة التشغيل والتنسيق والقيادة', 'index.html', null, 90),
    mk(13, 'لوحة الحوكمة والإدارة', 'Governance Admin Console', 2, 'ERP-Gov', 'إدارة مركزية للسياسات والهيكل والأدوار', 'dashboard.html', { hub: true, erp: true, crm: false, marketing: false, ai: true, knowledge: true, data: true, workflow: true }, 77),
    mk(14, 'السياسات والإدارة الاستراتيجية', 'Policies & Strategy', 2, 'ERP-Gov', 'سياسات معتمدة ومتابعة أهداف مؤسسية', 'info-center.html', null, 70),
    mk(15, 'الأرشفة الإلكترونية', 'Electronic Archive', 2, 'ERP-Gov', 'صادر/وارد · OCR · سير عمل وثائق', 'info-center.html', null, 68),
    mk(16, 'المستأجرين والاشتراك SaaS', 'Tenants & SaaS', 2, 'ERP-Gov', 'مستأجرون · خطط · دومينات فرعية', 'system-ops.html', null, 83),
    mk(17, 'النواة المالية', 'Financial Core', 2, 'ERP-Finance', 'دليل حسابات · قيود · أستاذ · ميزانيات', 'systems/erp.html', { hub: true, erp: true, crm: true, marketing: false, ai: true, knowledge: false, data: true, workflow: true }, 75),
    mk(18, 'الفواتير والتقارير المالية', 'Invoicing & Financial Reports', 2, 'ERP-Finance', 'فواتير · تقارير · تدفق نقدي · مخاطر', 'systems/erp.html', null, 74),
    mk(19, 'محرك المبيعات', 'Sales Engine', 2, 'ERP-Sales', 'عميل محتمل → فرصة → عقد → فاتورة → تسليم', 'systems/crm.html', { hub: true, erp: true, crm: true, marketing: true, ai: true, knowledge: false, data: true, workflow: true }, 79),
    mk(20, 'استديو التسويق', 'Marketing Studio', 2, 'Growth', 'خدمة → حملة → عميل محتمل → إدارة العملاء → عائد الاستثمار', 'ads.html', { hub: true, erp: false, crm: true, marketing: true, ai: true, knowledge: true, data: true, workflow: true }, 87),
    mk(21, 'استديو الفعاليات', 'Events Studio', 2, 'Growth', 'فعاليات حضورية وافتراضية', 'events.html', null, 85),
    mk(22, 'الموارد البشرية People 360', 'NAIOSH People 360', 2, 'ERP-HR', 'ملف موظف شامل حضور وأداء ومهارات', 'systems/erp.html', { hub: true, erp: true, crm: false, marketing: false, ai: true, knowledge: true, data: true, workflow: true }, 73),
    mk(23, 'بوابة الموظف', 'Employee Portal', 2, 'ERP-HR', 'مهامي · إجازاتي · راتبي · طلباتي', 'office.html', null, 78),
    mk(24, 'الخدمات وSLA', 'Services Engine', 2, 'Ops', 'طلبات خدمة ومستوى دعم', 'support.html', null, 71),
    mk(25, 'المهام المركزية', 'Task Engine', 2, 'Ops', 'تكليف وتتبع المهام بين الفرق', 'dashboard.html', null, 84),
    mk(26, 'سلاسل الإمداد', 'Supply Chain Engine', 2, 'ERP-Supply', 'شراء → مخزون → توزيع → فاتورة', 'systems/erp.html', { hub: true, erp: true, crm: false, marketing: false, ai: true, knowledge: false, data: true, workflow: true }, 69),
    mk(27, 'السلامة والصحة المهنية', 'Safety System', 3, 'Specialized', 'مخاطر · تفتيش · امتثال · تكامل ERP', 'systems/nais.html', { hub: true, erp: true, crm: false, marketing: false, ai: true, knowledge: true, data: true, workflow: true }, 72),
    mk(28, 'إدارة المرافق', 'Facility Management', 3, 'Specialized', 'تشغيل فني · صيانة · طاقة · تكامل مالي', 'systems/fit.html', { hub: true, erp: true, crm: false, marketing: false, ai: true, knowledge: false, data: true, workflow: true }, 70),
    mk(29, 'نايوش ERP', 'NAIOSH ERP', 2, 'ERP', 'محرك التشغيل المؤسسي داخل هوب', 'systems/erp.html', { hub: true, erp: true, crm: true, marketing: true, ai: true, knowledge: true, data: true, workflow: true }, 88),
    mk(30, 'نايوش لو', 'NAIOSH LAW', 3, 'Specialized', 'المنظومة القانونية والقضايا والحوكمة', 'systems/law.html', { hub: true, erp: true, crm: true, marketing: false, ai: true, knowledge: true, data: true, workflow: true }, 86),
    mk(31, 'نايس', 'NAIS', 3, 'Specialized', 'ذكاء التشغيل والتحليل', 'systems/nais.html', null, 80),
    mk(32, 'نايوش فيت', 'NAIOSH FIT', 3, 'Specialized', 'الصحة واللياقة والاشتراكات', 'systems/fit.html', null, 82),
    mk(33, 'أكاديمية نايوش', 'NAIOSH Academy', 3, 'Education', 'تعليم وتدريب معتمد', 'systems/academy.html', { hub: true, erp: false, crm: true, marketing: true, ai: true, knowledge: true, data: true, workflow: true }, 85),
    mk(34, 'نظام التعلم', 'LMS', 3, 'Education', 'مسارات تعلم وشهادات', 'systems/lms.html', null, 84),
    mk(35, 'إدارة علاقات العملاء', 'CRM', 2, 'Growth', 'عملاء · فرص · متابعة', 'systems/crm.html', { hub: true, erp: true, crm: true, marketing: true, ai: true, knowledge: true, data: true, workflow: true }, 87),
    mk(36, 'سمارتكس', 'SMARTX', 3, 'Specialized', 'اجتماعات وقاعات', 'systems/smartx.html', null, 78),
    mk(37, 'إيديو سمارتكس', 'EDUSMARTX', 3, 'Education', 'أنظمة تعليمية متخصصة', 'systems/edusmartx.html', null, 76),
    mk(38, 'نايوش مناهج', 'EDUNAIOSH', 3, 'Education', 'مناهج ودورات', 'systems/edunaiosh.html', null, 77),
    mk(39, 'محرك الفرص', 'Opportunity Engine', 3, 'Growth', 'اكتشاف فرص دخل قابلة للاختبار', 'side-projects.html', { hub: true, erp: false, crm: true, marketing: true, ai: true, knowledge: true, data: true, workflow: true }, 89),
    mk(40, 'مركز المعرفة', 'Knowledge Hub', 1, 'Core', 'ذاكرة الإمبراطورية والدروس المستفادة', 'info-center.html', null, 83),
    mk(41, 'بوابة الذكاء الاصطناعي', 'AI Gateway / Intelligence Layer', 1, 'Core', 'طبقة ذكاء فوق كل الأنظمة مع حوكمة', 'global-os.html#ai', null, 71),
  ];

  // Wire simple dependencies
  systems.forEach((s) => {
    if (s.id > 1 && s.tier === 1) s.dependsOn = ['SYS-01', 'SYS-12'];
    if (s.tier === 2) s.dependsOn = ['SYS-01', 'SYS-04', 'SYS-05', 'SYS-11', 'SYS-12'];
    if (s.tier === 3) s.dependsOn = ['SYS-01', 'SYS-11', 'SYS-12', 'SYS-29'];
    if (s.id === 12) s.dependsOn = ['SYS-01', 'SYS-03', 'SYS-04'];
    if (s.id === 11) s.dependsOn = ['SYS-01', 'SYS-12'];
    if (s.id === 41) s.dependsOn = ['SYS-11', 'SYS-40', 'SYS-12'];
  });
  systems.forEach((s) => {
    s.dependsOn.forEach((code) => {
      const parent = systems.find((x) => x.code === code);
      if (parent && !parent.dependents.includes(s.code)) parent.dependents.push(s.code);
    });
  });

  const duplicationHints = [
    { fn: 'الإشعارات', wrong: 'محرك إشعارات داخل كل نظام', right: 'محرك إشعارات مركزي (SYS-06)' },
    { fn: 'المستخدمون / الدخول', wrong: 'حساب منفصل لكل نظام', right: 'هوية موحّدة + دخول موحّد (SYS-01/02)' },
    { fn: 'الصلاحيات', wrong: 'صلاحيات محلية مكررة', right: 'محرك الأدوار والصلاحيات (SYS-04)' },
    { fn: 'مسارات العمل', wrong: 'سير عمل خاص بكل نظام', right: 'محرك مسارات عمل مركزي (SYS-05)' },
    { fn: 'المدفوعات', wrong: 'بوابة دفع داخل كل نظام', right: 'محركات الدفع والنقاط (SYS-09/10)' },
    { fn: 'الوثائق', wrong: 'أرشيف منفصل', right: 'محرك الوثائق والأرشفة (SYS-08)' },
    { fn: 'البحث / التقارير', wrong: 'تقارير معزولة', right: 'تقارير ومؤشرات وأبحاث مركزية' },
    { fn: 'تشغيل الفرع / الحاضنة / المنصة', wrong: 'ثلاثة أنظمة بنفس الشاشات', right: 'نموذج تشغيل واحد + نسخ مثيلات' },
  ];

  const gate = [
    'مراجعة المعمارية',
    'مراجعة الأمن',
    'مراجعة البيانات',
    'مراجعة التكامل',
    'مراجعة الذكاء',
    'مراجعة التسويق',
    'الاختبار',
    'قبول المستخدم',
    'الإنتاج',
  ];

  const architectureDocs = [
    { code: '01', title: 'مخطط المعمارية العالمية لنايوش', href: 'global-os.html#architecture' },
    { code: '02', title: 'السجل الرئيسي لأنظمة نايوش', href: 'global-os.html#register' },
    { code: '03', title: 'معمارية التكامل وواجهات البرمجة', href: 'global-os.html#integration' },
    { code: '04', title: 'معمارية البيانات والأمن', href: 'global-os.html#data' },
    { code: '05', title: 'معمارية الذكاء والمعرفة', href: 'global-os.html#ai' },
  ];

  window.HubGlobalOsData = {
    brand: {
      nameEn: 'NAIOSH GLOBAL OPERATING SYSTEM',
      nameAr: 'نظام التشغيل المتكامل لإمبراطورية نايوش',
      rule: 'ابنِ مرة — اربط في كل مكان',
      equation: 'HUB 360 + ERP + 41 نظامًا + التكامل + البيانات + المعرفة + الذكاء + التسويق + إدارة العملاء = عمليات عالمية',
      mantra: 'لا نبرمج نظامًا جديدًا — نضيف قدرة تشغيلية إلى نظام التشغيل العالمي لنايوش.',
    },
    layers,
    coreServices,
    executionOrder,
    aiLevels,
    erpLayers,
    cycle,
    events,
    dataDictionary,
    directives,
    systems,
    duplicationHints,
    gate,
    architectureDocs,
  };
})();
