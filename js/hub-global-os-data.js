/**
 * NAIOSH GLOBAL OPERATING SYSTEM — بيانات المعمارية والسجل والمصفوفات
 * مصدر: تشغيل انظمة ERP.rar (وثائق المعمارية + سجل الأنظمة)
 */
(() => {
  'use strict';

  const layers = [
    { id: 'gov', n: 1, en: 'Governance', ar: 'الحوكمة والإدارة', desc: 'إمبراطورية ← دولة ← فرع ← حاضنة ← منصة ← مكتب ← قسم ← مستخدم' },
    { id: 'id', n: 2, en: 'Identity & Access', ar: 'الهوية والصلاحيات', desc: 'NAIOSH ID · SSO · RBAC+ABAC · سياق الكيان' },
    { id: 'ops', n: 3, en: 'Core Operations', ar: 'التشغيل المؤسسي', desc: 'Workflow · Requests · Tasks · Documents · Audit' },
    { id: 'erp', n: 4, en: 'ERP', ar: 'المالية والموارد', desc: 'Finance · HR · Procurement · Sales · Inventory' },
    { id: 'spec', n: 5, en: 'Specialized Engines', ar: 'الأنظمة المتخصصة', desc: 'الـ41 محركًا المتخصص داخل المنظومة' },
    { id: 'int', n: 6, en: 'Integration Hub', ar: 'التكامل', desc: 'API · Events · Webhooks · Sync' },
    { id: 'data', n: 7, en: 'Data & Knowledge', ar: 'البيانات والمعرفة', desc: 'Operational · Analytical · Policies · Lessons' },
    { id: 'mkt', n: 8, en: 'Marketing & CRM', ar: 'التسويق والعملاء', desc: 'Campaign → Lead → CRM → Sale → ROI' },
    { id: 'ai', n: 9, en: 'AI Intelligence', ar: 'الذكاء الاصطناعي', desc: 'Assistant · Analyst · Advisor · Predictive · Orchestrator' },
    { id: 'cmd', n: 10, en: 'Command Center', ar: 'مركز القيادة', desc: 'من العالم إلى المعاملة في شاشة واحدة' },
  ];

  const coreServices = [
    'Unified Registration & NAIOSH ID',
    'Single Sign-On',
    'Identity Management',
    'Roles & Permissions',
    'Organization / Tenant Management',
    'Subdomain Management',
    'User Dashboard Engine',
    'Menu & Navigation Engine',
    'Workflow Engine',
    'Notification Engine',
    'Task Engine',
    'Document & Archive Engine',
    'Membership & Certificates',
    'Subscription & Packages',
    'Points & Usage Engine',
    'Payment Engine',
    'Customer / CRM',
    'Marketing Studio',
    'Knowledge & Information Center',
    'Search Engine',
    'Reporting & KPI Engine',
    'Audit Trail',
    'API / Integration Hub',
    'AI Gateway',
    'Analytics & Command Center',
  ];

  const executionOrder = [
    { n: 1, title: 'Architecture Core', desc: 'المعمارية والبنية الأساسية' },
    { n: 2, title: 'Unified Registration & NAIOSH ID', desc: 'التسجيل والهوية الموحدة' },
    { n: 3, title: 'SSO', desc: 'دخول موحّد لجميع الأنظمة' },
    { n: 4, title: 'Organization & Tenant Engine', desc: 'دول → فروع → حاضنات → منصات → مكاتب → مستأجرين' },
    { n: 5, title: 'Roles & Permissions', desc: 'الأدوار ومصفوفة الصلاحيات' },
    { n: 6, title: 'Common Operating Components', desc: 'Workflow · مهام · إشعارات · وثائق · نقاط · دفع · تقارير · تدقيق' },
    { n: 7, title: 'HUB 360 Core', desc: 'مركز التشغيل والتوجيه' },
    { n: 8, title: 'Integration Hub + API + Event Bus', desc: 'الجهاز العصبي للمنظومة' },
    { n: 9, title: 'Data & Knowledge Hub', desc: 'البيانات والمعرفة المؤسسية' },
    { n: 10, title: 'AI Gateway', desc: 'طبقة الذكاء فوق كل الأنظمة' },
    { n: 11, title: 'Specialized Systems 01→41', desc: 'الأنظمة المتخصصة واحدًا تلو الآخر' },
  ];

  const aiLevels = [
    { id: 'assistant', n: 1, title: 'AI Assistant', ar: 'مساعد', desc: 'يجيب عن الأسئلة ضمن الصلاحيات.' },
    { id: 'analyst', n: 2, title: 'AI Analyst', ar: 'محلل', desc: 'يفهم البيانات ويشرح الأسباب.' },
    { id: 'advisor', n: 3, title: 'AI Advisor', ar: 'مستشار', desc: 'يقدّم توصيات قابلة للاعتماد.' },
    { id: 'predictor', n: 4, title: 'AI Predictor', ar: 'تنبؤ', desc: 'يتوقع الأداء والطلب والمخاطر.' },
    { id: 'orchestrator', n: 5, title: 'AI Orchestrator', ar: 'منسّق', desc: 'ينسّق العمليات المصرّح بها مع Human-in-the-Loop.' },
  ];

  const erpLayers = [
    { n: 1, title: 'الحوكمة والإدارة', items: ['لوحة تحكم', 'أدوار', 'سياسات', 'هيكل', 'أرشفة', 'مستأجرين', 'طلبات', 'SaaS'] },
    { n: 2, title: 'الموارد البشرية', items: ['People 360', 'حضور', 'رواتب', 'أداء', 'تدريب', 'مواهب'] },
    { n: 3, title: 'المالية والدفع', items: ['حسابات', 'فواتير', 'تحصيل', 'بنوك', 'ميزانيات', 'نقاط'] },
    { n: 4, title: 'المبيعات والعملاء', items: ['CRM', 'عروض', 'عقود', 'POS', 'عمولات'] },
    { n: 5, title: 'التشغيل والخدمات', items: ['مهام', 'SLA', 'مكاتب إلكترونية', 'عمليات يومية'] },
    { n: 6, title: 'سلاسل الإمداد', items: ['مشتريات', 'مخزون', 'موردون', 'لوجستيات', 'جودة'] },
    { n: 7, title: 'الأصول والمرافق', items: ['أصول', 'صيانة', 'عقود', 'تكامل Facility'] },
    { n: 8, title: 'البيانات والتحليل والأتمتة', items: ['Data Hub', 'KPI', 'AI Advisor', 'اختناقات'] },
  ];

  const cycle = ['PLAN', 'REQUEST', 'APPROVAL', 'EXECUTE', 'RECORD', 'FINANCE', 'MEASURE', 'ANALYZE', 'AI', 'DECIDE', 'IMPROVE'];

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
    { entity: 'Customer', owner: 'CRM', type: 'Master', readers: ['Sales', 'Finance', 'Marketing', 'Support'], writers: ['CRM'] },
    { entity: 'Employee', owner: 'HR', type: 'Master', readers: ['Facility', 'Safety', 'Training', 'ERP'], writers: ['HR'] },
    { entity: 'Product/Service', owner: 'Catalog', type: 'Master', readers: ['Store', 'Marketing', 'Finance', 'CRM'], writers: ['Catalog', 'ERP'] },
    { entity: 'Vendor', owner: 'Supply', type: 'Master', readers: ['Finance', 'Facility', 'Procurement'], writers: ['Supply'] },
    { entity: 'Branch', owner: 'Organization', type: 'Master', readers: ['All'], writers: ['Organization'] },
    { entity: 'Incubator', owner: 'Organization', type: 'Master', readers: ['All'], writers: ['Organization'] },
    { entity: 'Platform', owner: 'Organization', type: 'Master', readers: ['All'], writers: ['Organization'] },
    { entity: 'Office', owner: 'Organization', type: 'Master', readers: ['All'], writers: ['Organization'] },
    { entity: 'Student/Trainee', owner: 'LMS', type: 'Master', readers: ['CRM', 'Academy', 'Finance'], writers: ['LMS', 'Academy'] },
    { entity: 'Asset', owner: 'Assets/Facility', type: 'Master', readers: ['Finance', 'HR', 'Ops'], writers: ['Assets'] },
    { entity: 'Contract', owner: 'Legal/ERP', type: 'Master', readers: ['Finance', 'Sales', 'HR'], writers: ['Legal', 'ERP'] },
    { entity: 'Invoice', owner: 'Finance', type: 'Transactional', readers: ['CRM', 'Sales', 'Analytics'], writers: ['Finance'] },
    { entity: 'Payment', owner: 'Finance/Points', type: 'Transactional', readers: ['CRM', 'Analytics', 'Wallet'], writers: ['Finance', 'Points'] },
    { entity: 'NAIOSH ID', owner: 'Identity', type: 'Master', readers: ['All'], writers: ['Identity'] },
    { entity: 'Knowledge Object', owner: 'Knowledge', type: 'Derived', readers: ['AI', 'All'], writers: ['Knowledge', 'Systems'] },
  ];

  const directives = [
    'لا تبنوا 41 نظامًا منفصلًا — محركات داخل نظام تشغيل واحد.',
    'ابنوا الـCore أولًا قبل الأنظمة المتخصصة.',
    'لا تكرروا الوظائف المشتركة — Central Engines.',
    'HUB 360 = Orchestration Layer وليس مجرد Dashboard.',
    'أنشئوا Data Dictionary وMaster Source لكل كيان.',
    'Event-Driven Architecture بدل ربط كل نظام بكل نظام.',
    'API First — لا وصول مباشر لقواعد أنظمة أخرى.',
    'Multi-Tenant / Multi-Country من اليوم الأول.',
    'RBAC + ABAC حسب الدولة/الفرع/الحاضنة/المنصة/المكتب.',
    'الأمن منذ اليوم الأول (MFA · Zero Trust · Audit).',
    'AI عبر AI Gateway فقط مع سجل تدقيق.',
    'Human-in-the-Loop: Green / Yellow / Red.',
    'التوسع Configuration وليس إعادة برمجة.',
    'Points Engine مركزي لنموذج الاستخدام.',
    'Marketing Studio قابل للاستدعاء من أي خدمة.',
    'كل نظام ينتج Knowledge Objects.',
    'Architecture قبل UI.',
    'Integration Testing أهم من اختبار النظام منفردًا.',
    'بيئات: Dev → Test → Staging → Production.',
    'Architecture Review Board قبل أي Production.',
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
    owner: 'NAIOSH Architecture Board',
    status: readiness >= 85 ? 'ready' : readiness >= 70 ? 'integrate' : 'reengineer',
    readiness,
    integrations: integrations || { hub: true, erp: false, crm: false, marketing: false, ai: true, knowledge: true, data: true, workflow: true },
    dependsOn: [],
    dependents: [],
  });

  const systems = [
    mk(1, 'التسجيل والهوية الموحدة', 'Unified Identity & Registration', 1, 'Core', 'باب واحد لإمبراطورية نايوش وNAIOSH ID', 'login.html', { hub: true, erp: true, crm: true, marketing: true, ai: true, knowledge: true, data: true, workflow: true }, 88),
    mk(2, 'الدخول الموحّد SSO', 'Single Sign-On', 1, 'Core', 'جلسة واحدة لكل الأنظمة دون إعادة تسجيل', 'login.html', null, 86),
    mk(3, 'محرك الهيكل والمستأجرين', 'Organization & Tenant Engine', 1, 'Core', 'دول · فروع · حاضنات · منصات · مكاتب · مستأجرين', 'branches.html', null, 84),
    mk(4, 'الأدوار والصلاحيات', 'Roles & Permissions Engine', 1, 'Core', 'RBAC + ABAC حسب السياق والكيان', 'system-ops.html', null, 85),
    mk(5, 'محرك سير العمل', 'Workflow Engine', 1, 'Core', 'Request → Approval → Execution مركزي', 'system-ops.html', null, 78),
    mk(6, 'محرك الإشعارات', 'Notification Engine', 1, 'Core', 'إشعارات موحّدة لكل الأنظمة', 'dashboard.html', null, 80),
    mk(7, 'محرك الطلبات', 'Request Engine', 1, 'Core', 'طلبات الموظفين والعمليات بـWorkflow واحد', 'system-ops.html', null, 76),
    mk(8, 'الوثائق والأرشفة', 'Document & Archive Engine', 1, 'Core', 'أرشفة وتصنيف ومرفقات مشتركة', 'info-center.html', null, 74),
    mk(9, 'النقاط والاستخدام', 'Points & Usage Engine', 1, 'Core', 'رصيد · خصم · Ledger · تقارير الاستخدام', 'packages.html', null, 82),
    mk(10, 'محرك الدفع', 'Payment Engine', 1, 'Core', 'فواتير ذكية · بوابات · أقساط · تحصيل', 'store.html', { hub: true, erp: true, crm: true, marketing: false, ai: true, knowledge: false, data: true, workflow: true }, 81),
    mk(11, 'مركز التكامل', 'Integration Hub', 1, 'Core', 'API · Events · Webhooks · Sync', 'global-os.html#integration', null, 72),
    mk(12, 'نواة هوب 360', 'HUB 360 Core', 1, 'Core', 'طبقة التشغيل والتنسيق والقيادة', 'index.html', null, 90),
    mk(13, 'لوحة الحوكمة والإدارة', 'Governance Admin Console', 2, 'ERP-Gov', 'إدارة مركزية للسياسات والهيكل والأدوار', 'dashboard.html', { hub: true, erp: true, crm: false, marketing: false, ai: true, knowledge: true, data: true, workflow: true }, 77),
    mk(14, 'السياسات والإدارة الاستراتيجية', 'Policies & Strategy', 2, 'ERP-Gov', 'سياسات معتمدة ومتابعة أهداف مؤسسية', 'info-center.html', null, 70),
    mk(15, 'الأرشفة الإلكترونية', 'Electronic Archive', 2, 'ERP-Gov', 'صادر/وارد · OCR · سير عمل وثائق', 'info-center.html', null, 68),
    mk(16, 'المستأجرين والاشتراك SaaS', 'Tenants & SaaS', 2, 'ERP-Gov', 'مستأجرون · خطط · دومينات فرعية', 'system-ops.html', null, 83),
    mk(17, 'النواة المالية', 'Financial Core', 2, 'ERP-Finance', 'دليل حسابات · قيود · أستاذ · ميزانيات', 'systems/erp.html', { hub: true, erp: true, crm: true, marketing: false, ai: true, knowledge: false, data: true, workflow: true }, 75),
    mk(18, 'الفواتير والتقارير المالية', 'Invoicing & Financial Reports', 2, 'ERP-Finance', 'فواتير · تقارير · تدفق نقدي · مخاطر', 'systems/erp.html', null, 74),
    mk(19, 'محرك المبيعات', 'Sales Engine', 2, 'ERP-Sales', 'Lead → Opportunity → عقد → فاتورة → تسليم', 'systems/crm.html', { hub: true, erp: true, crm: true, marketing: true, ai: true, knowledge: false, data: true, workflow: true }, 79),
    mk(20, 'استديو التسويق', 'Marketing Studio', 2, 'Growth', 'خدمة → حملة → Lead → CRM → ROI', 'ads.html', { hub: true, erp: false, crm: true, marketing: true, ai: true, knowledge: true, data: true, workflow: true }, 87),
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
    { fn: 'Notifications', wrong: 'محرك إشعارات داخل كل نظام', right: 'Central Notification Engine (SYS-06)' },
    { fn: 'Users / Login', wrong: 'حساب منفصل لكل نظام', right: 'Unified Identity + SSO (SYS-01/02)' },
    { fn: 'Permissions', wrong: 'صلاحيات محلية مكررة', right: 'Roles & Permissions Engine (SYS-04)' },
    { fn: 'Workflow', wrong: 'سير عمل خاص بكل نظام', right: 'Central Workflow Engine (SYS-05)' },
    { fn: 'Payments', wrong: 'بوابة دفع داخل كل نظام', right: 'Payment + Points Engines (SYS-09/10)' },
    { fn: 'Documents', wrong: 'أرشيف منفصل', right: 'Document & Archive Engine (SYS-08)' },
    { fn: 'Search / Reports', wrong: 'تقارير معزولة', right: 'Reporting & KPI + Search مركزية' },
    { fn: 'Branch/Incubator/Platform Ops', wrong: 'ثلاثة أنظمة بنفس الشاشات', right: 'One Operating Model + Instances' },
  ];

  const gate = [
    'Architecture Review',
    'Security Review',
    'Data Review',
    'Integration Review',
    'AI Review',
    'Marketing Review',
    'Testing',
    'User Acceptance',
    'Production',
  ];

  const architectureDocs = [
    { code: '01', title: 'NAIOSH Global Architecture Blueprint', href: 'global-os.html#architecture' },
    { code: '02', title: 'NAIOSH System Master Register', href: 'global-os.html#register' },
    { code: '03', title: 'NAIOSH Integration & API Architecture', href: 'global-os.html#integration' },
    { code: '04', title: 'NAIOSH Data & Security Architecture', href: 'global-os.html#data' },
    { code: '05', title: 'NAIOSH AI & Knowledge Architecture', href: 'global-os.html#ai' },
  ];

  window.HubGlobalOsData = {
    brand: {
      nameEn: 'NAIOSH GLOBAL OPERATING SYSTEM',
      nameAr: 'نظام التشغيل المتكامل لإمبراطورية نايوش',
      rule: 'Build Once – Integrate Everywhere',
      equation: 'HUB 360 + ERP + 41 Systems + Integration + Data + Knowledge + AI + Marketing + CRM = Global Operations',
      mantra: 'لا نبرمج نظامًا جديدًا — نضيف قدرة تشغيلية إلى NAIOSH GLOBAL OPERATING SYSTEM.',
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
