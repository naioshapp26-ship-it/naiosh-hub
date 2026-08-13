/**
 * NAIOSH Sector Library — قطاعات كبيانات/تكوين فقط.
 * لا كود خاص بقطاع داخل النواة.
 */
(() => {
  'use strict';

  const CYCLE = Object.freeze([
    'SECTOR',
    'SUB_SECTOR',
    'SKILLS',
    'PERSON_PROFILE',
    'MARKET_NEED',
    'OPPORTUNITY',
    'PROJECT',
    'SKILL_GAP',
    'PARTNER_MATCH',
    'LEARNING',
    'COMPLIANCE',
    'SAFETY',
    'SUSTAINABILITY',
    'INCUBATOR',
    'MARKETING',
    'ACTION',
    'PERFORMANCE',
  ]);

  const GATE_STATUSES = Object.freeze([
    'READY',
    'NEEDS_TRAINING',
    'NEEDS_PARTNER',
    'NEEDS_LICENSE',
    'HIGH_RISK_RESTRICTED',
  ]);

  /** قالب إعداد موحّد لأي قطاع */
  const emptyPackage = (partial = {}) => ({
    sectorId: '',
    sectorName: '',
    sectorNameAr: '',
    icon: 'fa-industry',
    color: '#dc2626',
    subSectors: [],
    occupations: [],
    skills: [],
    competencies: [],
    services: [],
    products: [],
    projects: [],
    marketNeeds: [],
    resources: [],
    equipment: [],
    partners: [],
    trainingPaths: [],
    regulations: [],
    licenses: [],
    safetyRisks: [],
    sustainabilityFactors: [],
    opportunityTemplates: [],
    kpis: [],
    crossHints: [],
    published: true,
    ...partial,
  });

  const pack = (id, nameAr, nameEn, icon, extras = {}) =>
    emptyPackage({
      sectorId: id,
      sectorName: nameEn,
      sectorNameAr: nameAr,
      icon,
      ...extras,
    });

  const SECTORS = [
    pack('energy', 'الطاقة والمرافق', 'Energy & Utilities', 'fa-bolt', {
      subSectors: ['كفاءة الطاقة', 'مرافق المباني', 'طاقة متجددة صغيرة'],
      skills: ['إدارة الطاقة', 'صيانة معدات', 'قراءة فواتير/أحمال', 'تدقيق مباني'],
      occupations: ['فني طاقة', 'مستشار كفاءة', 'مشغّل مرافق'],
      marketNeeds: ['خفض فاتورة الكهرباء', 'صيانة أنظمة تكييف', 'تركيب لوحات صغيرة'],
      opportunityTemplates: [
        {
          id: 'energy-audit-sme',
          titleAr: 'تدقيق كفاءة طاقة للمنشآت الصغيرة',
          skills: ['إدارة الطاقة', 'تدقيق مباني'],
          resources: ['جهاز قياس أساسي', 'قائمة تحقق'],
          risk: 'متوسط',
          capital: 'منخفض',
        },
        {
          id: 'hvac-filter-service',
          titleAr: 'خدمة صيانة فلاتر وأنظمة تكييف منزلية',
          skills: ['صيانة معدات'],
          resources: ['عدة يدوية', 'فلاتر'],
          risk: 'منخفض',
          capital: 'منخفض',
        },
      ],
      safetyRisks: ['كهرباء', 'عمل على أسطح'],
      licenses: ['تصريح أعمال كهربائية عند الحاجة'],
      crossHints: ['construction', 'facilities', 'sustainability', 'industry'],
      kpis: ['عدد تدقيقات/شهر', 'متوسط توفير تقديري'],
    }),
    pack('construction', 'البناء والتشييد', 'Construction', 'fa-helmet-safety', {
      subSectors: ['تشطيبات', 'صيانة', 'خدمات مساندة'],
      skills: ['تشطيب', 'قياس كميات', 'سلامة موقع', 'تنسيق مقاولين'],
      occupations: ['مقاول صغير', 'فني تشطيب', 'مراقب سلامة'],
      marketNeeds: ['صيانة وحدات', 'تشطيب شقق', 'ترميم خفيف'],
      opportunityTemplates: [
        {
          id: 'fitout-small',
          titleAr: 'تشطيب وحدات سكنية صغيرة',
          skills: ['تشطيب', 'قياس كميات'],
          resources: ['عدة', 'مورد مواد'],
          risk: 'متوسط',
          capital: 'متوسط',
        },
      ],
      safetyRisks: ['سقوط', 'أدوات حادة', 'غبار'],
      licenses: ['رخصة مقاول/تسجيل نشاط'],
      crossHints: ['energy', 'osh', 'realestate', 'facilities'],
    }),
    pack('health', 'الصحة والرعاية', 'Health & Care', 'fa-heart-pulse', {
      subSectors: ['رعاية منزلية مساندة', 'توعية', 'خدمات رقمية مساندة'],
      skills: ['إسعافات أولية', 'متابعة مرضى', 'تثقيف صحي'],
      occupations: ['مساعد رعاية', 'منسق توعية'],
      marketNeeds: ['رعاية كبار السن', 'تذكير أدوية', 'توعية غذائية'],
      opportunityTemplates: [
        {
          id: 'elder-care-assist',
          titleAr: 'خدمة مساندة منزلية لكبار السن (غير طبية)',
          skills: ['إسعافات أولية', 'متابعة مرضى'],
          resources: ['تأمين مسؤولية', 'بروتوكول سلامة'],
          risk: 'مرتفع',
          capital: 'منخفض',
        },
      ],
      regulations: ['عدم تقديم خدمة طبية دون ترخيص'],
      licenses: ['ترخيص صحي عند تقديم خدمات منظمة'],
      safetyRisks: ['عدوى', 'رفع ونقل'],
      crossHints: ['digital', 'education', 'personal'],
    }),
    pack('finance', 'المالية والمصرفية', 'Finance & Banking', 'fa-coins', {
      subSectors: ['محاسبة مصغّرة', 'تثقيف مالي', 'تحصيل'],
      skills: ['محاسبة أساسية', 'Excel', 'امتثال'],
      opportunityTemplates: [
        {
          id: 'micro-bookkeeping',
          titleAr: 'مسك دفاتر للمنشآت المتناهية',
          skills: ['محاسبة أساسية', 'Excel'],
          resources: ['برنامج محاسبة بسيط'],
          risk: 'منخفض',
          capital: 'منخفض جدًا',
        },
      ],
      crossHints: ['digital', 'professional', 'retail'],
    }),
    pack('industry', 'الصناعة والتصنيع', 'Industry & Manufacturing', 'fa-industry', {
      subSectors: ['ورش صغيرة', 'صيانة خطوط', 'رقمنة جودة'],
      skills: ['صيانة ميكانيكية', 'سلامة صناعية', 'ضبط جودة'],
      crossHints: ['osh', 'logistics', 'digital', 'energy'],
      opportunityTemplates: [
        {
          id: 'small-workshop-repair',
          titleAr: 'صيانة معدات ورش صغيرة',
          skills: ['صيانة ميكانيكية', 'سلامة صناعية'],
          resources: ['عدة صيانة'],
          risk: 'متوسط',
          capital: 'متوسط',
        },
      ],
    }),
    pack('agriculture', 'الزراعة والغذاء', 'Agriculture & Food', 'fa-seedling', {
      subSectors: ['زراعة منزلية', 'أغذية محلية', 'زراعة ذكية'],
      skills: ['زراعة', 'ري', 'تعبئة', 'مبيعات منتجات'],
      resources: ['أرض/سطح', 'بذور', 'معدات ري بسيطة'],
      opportunityTemplates: [
        {
          id: 'smart-home-grow',
          titleAr: 'زراعة منزلية ذكية وبيع منتجات طازجة',
          skills: ['زراعة', 'ري', 'مبيعات منتجات'],
          resources: ['سطح/شرفة', 'نظام ري'],
          risk: 'منخفض',
          capital: 'منخفض',
        },
      ],
      crossHints: ['digital', 'retail', 'sustainability', 'logistics'],
      sustainabilityFactors: ['ماء', 'مبيدات', 'هدر غذاء'],
    }),
    pack('education', 'التعليم والتدريب', 'Education & Training', 'fa-graduation-cap', {
      subSectors: ['تدريب مهني', 'دروس خصوصية', 'محتوى تعليمي'],
      skills: ['تدريس', 'تصميم منهج', 'تيسير ورش'],
      opportunityTemplates: [
        {
          id: 'skills-workshop',
          titleAr: 'ورش مهارات قصيرة للمجتمع',
          skills: ['تيسير ورش', 'تصميم منهج'],
          resources: ['قاعة/أونلاين'],
          risk: 'منخفض',
          capital: 'منخفض جدًا',
        },
      ],
      crossHints: ['digital', 'health', 'creative', 'professional'],
    }),
    pack('tourism', 'السياحة والضيافة والترفيه', 'Tourism & Hospitality', 'fa-plane', {
      subSectors: ['تجارب محلية', 'ضيافة صغيرة', 'جولات'],
      skills: ['ضيافة', 'سرد قصصي', 'تنظيم جولات'],
      crossHints: ['events', 'media', 'retail', 'transport'],
      opportunityTemplates: [
        {
          id: 'local-experience',
          titleAr: 'تجارب سياحية محلية قصيرة',
          skills: ['تنظيم جولات', 'سرد قصصي'],
          resources: ['شراكة مواقع', 'تأمين'],
          risk: 'متوسط',
          capital: 'منخفض',
        },
      ],
    }),
    pack('logistics', 'اللوجستيات وسلاسل الإمداد', 'Logistics & Supply Chain', 'fa-truck', {
      subSectors: ['توصيل أخير', 'تخزين صغير', 'تتبع أسطول'],
      skills: ['تخطيط مسار', 'إدارة مخزون', 'خدمة عملاء'],
      crossHints: ['digital', 'retail', 'agriculture', 'energy'],
      opportunityTemplates: [
        {
          id: 'last-mile-micro',
          titleAr: 'خدمة توصيل أخير للأحياء',
          skills: ['تخطيط مسار', 'خدمة عملاء'],
          resources: ['دراجة/سيارة', 'تطبيق طلبات'],
          risk: 'متوسط',
          capital: 'منخفض',
        },
      ],
    }),
    pack('digital', 'التقنية والقطاع الرقمي', 'Technology & Digital', 'fa-microchip', {
      subSectors: ['خدمات ويب', 'أتمتة', 'متاجر إلكترونية'],
      skills: ['تطوير ويب', 'أتمتة', 'إدارة متجر', 'تحليل بيانات'],
      opportunityTemplates: [
        {
          id: 'sme-automation',
          titleAr: 'أتمتة عمليات منشآت صغيرة',
          skills: ['أتمتة', 'تحليل بيانات'],
          resources: ['حاسب', 'اشتراكات أدوات'],
          risk: 'منخفض',
          capital: 'منخفض جدًا',
        },
      ],
      crossHints: ['finance', 'agriculture', 'logistics', 'health', 'media'],
    }),
    pack('osh', 'السلامة والصحة المهنية', 'OSH', 'fa-shield-halved', {
      subSectors: ['تقييم مخاطر', 'تدريب سلامة', 'تفتيش'],
      skills: ['تقييم مخاطر', 'تحقيق حوادث', 'تدريب سلامة'],
      opportunityTemplates: [
        {
          id: 'risk-assessment-sme',
          titleAr: 'تقييم مخاطر للمنشآت الصغيرة',
          skills: ['تقييم مخاطر', 'تدريب سلامة'],
          resources: ['قوائم تحقق', 'كاميرا'],
          risk: 'متوسط',
          capital: 'منخفض',
        },
      ],
      crossHints: ['industry', 'construction', 'facilities'],
    }),
    pack('sustainability', 'البيئة والاستدامة', 'Environment & Sustainability', 'fa-leaf', {
      subSectors: ['تدوير', 'كفاءة موارد', 'توعية'],
      skills: ['فرز نفايات', 'قياس أثر', 'توعية مجتمعية'],
      crossHints: ['energy', 'agriculture', 'facilities'],
    }),
    pack('facilities', 'إدارة المرافق', 'Facilities Management', 'fa-building', {
      subSectors: ['نظافة', 'صيانة مباني', 'تشغيل منشآت'],
      skills: ['جدولة صيانة', 'إدارة مقاولين', 'سلامة مبنى'],
      crossHints: ['energy', 'construction', 'osh'],
    }),
    pack('realestate', 'العقار والخدمات العقارية', 'Real Estate', 'fa-house', {
      subSectors: ['وساطة', 'إدارة أملاك', 'تصوير وحدات'],
      skills: ['تفاوض', 'تسويق عقاري', 'إدارة عقود'],
      crossHints: ['construction', 'media', 'finance'],
    }),
    pack('retail', 'التجارة والتجزئة', 'Trade & Retail', 'fa-store', {
      subSectors: ['تجزئة حي', 'تجارة إلكترونية', 'كشك'],
      skills: ['مبيعات', 'مخزون', 'تسعير'],
      crossHints: ['digital', 'logistics', 'media'],
    }),
    pack('professional', 'الخدمات المهنية والاستشارية', 'Professional Services', 'fa-briefcase', {
      subSectors: ['استشارات', 'كتابة عروض', 'امتثال إداري'],
      skills: ['تحليل', 'كتابة', 'تيسير'],
      crossHints: ['finance', 'education', 'digital'],
    }),
    pack('events', 'الفعاليات والمعارض والمؤتمرات', 'Events & Exhibitions', 'fa-calendar-check', {
      subSectors: ['تنظيم فعاليات', 'ضيافة فعاليات', 'معارض مصغّرة'],
      skills: ['تنظيم', 'تنسيق موردين', 'إدارة حضور'],
      crossHints: ['tourism', 'media', 'logistics'],
    }),
    pack('media', 'الإعلام والمحتوى والتسويق', 'Media & Marketing', 'fa-bullhorn', {
      subSectors: ['محتوى', 'إعلانات', 'تصوير'],
      skills: ['كتابة محتوى', 'مونتاج', 'إعلانات مدفوعة'],
      crossHints: ['digital', 'tourism', 'retail', 'creative'],
    }),
    pack('transport', 'النقل والتنقل', 'Transport & Mobility', 'fa-car', {
      subSectors: ['نقل ركاب محدود', 'توصيل', 'صيانة مركبات'],
      skills: ['قيادة', 'صيانة خفيفة', 'خدمة عملاء'],
      crossHints: ['logistics', 'tourism', 'osh'],
    }),
    pack('home-economy', 'الاقتصاد المنزلي والمشاريع المنزلية', 'Home Economy', 'fa-house-chimney', {
      subSectors: ['منتجات منزلية', 'خدمات من المنزل', 'مطبخ منزلي منظم'],
      skills: ['طبخ', 'خياطة', 'تنظيم منزلي', 'بيع منزلي'],
      opportunityTemplates: [
        {
          id: 'home-product-micro',
          titleAr: 'منتج منزلي قابل للبيع محليًا',
          skills: ['طبخ', 'بيع منزلي'],
          resources: ['مطبخ', 'تعبئة'],
          risk: 'منخفض',
          capital: 'منخفض جدًا',
        },
      ],
      crossHints: ['retail', 'media', 'personal'],
    }),
    pack('personal', 'الخدمات الشخصية والمجتمعية', 'Personal & Community Services', 'fa-people-group', {
      subSectors: ['عناية شخصية', 'خدمات حي', 'دعم أسري'],
      skills: ['خدمة عملاء', 'تنظيم مواعيد', 'عناية'],
      crossHints: ['health', 'home-economy', 'retail'],
    }),
    pack('crafts', 'الحرف والمهن التطبيقية', 'Applied Crafts', 'fa-hammer', {
      subSectors: ['حرف يدوية', 'إصلاحات', 'تفصيل'],
      skills: ['حرفة يدوية', 'إصلاح', 'تشطيب'],
      crossHints: ['retail', 'construction', 'creative'],
    }),
    pack('sports', 'القطاع الرياضي واللياقة', 'Sports & Fitness', 'fa-dumbbell', {
      subSectors: ['تدريب شخصي', 'فعاليات رياضية', 'تغذية رياضية'],
      skills: ['تدريب لياقة', 'تحفيز', 'سلامة تمرين'],
      crossHints: ['health', 'media', 'events'],
    }),
    pack('creative', 'الاقتصاد الإبداعي', 'Creative Economy', 'fa-palette', {
      subSectors: ['تصميم', 'فنون', 'منتجات إبداعية'],
      skills: ['تصميم', 'تصوير', 'هوية بصرية'],
      crossHints: ['media', 'digital', 'events', 'crafts'],
    }),
    pack('other', 'قطاعات أخرى', 'Other / Extensible', 'fa-plus', {
      published: true,
      subSectors: ['قابل للإضافة عبر حزمة إعداد'],
      opportunityTemplates: [],
    }),
  ];

  /** علاقات مهارة→قطاعات (Ontology مبسّطة) */
  const SKILL_ONTOLOGY = {
    'إدارة الطاقة': ['energy', 'facilities', 'sustainability', 'construction', 'industry', 'osh'],
    'صيانة معدات': ['energy', 'industry', 'facilities', 'agriculture', 'transport'],
    'تقييم مخاطر': ['osh', 'industry', 'construction', 'facilities'],
    'زراعة': ['agriculture', 'sustainability', 'home-economy'],
    'أتمتة': ['digital', 'industry', 'logistics', 'finance'],
    'كتابة محتوى': ['media', 'digital', 'education', 'tourism'],
    'مبيعات': ['retail', 'realestate', 'tourism', 'home-economy'],
    'تشطيب': ['construction', 'crafts', 'facilities'],
    'تدريب لياقة': ['sports', 'health', 'education'],
    'تصميم': ['creative', 'media', 'digital'],
  };

  const COMBINATIONS = [
    { a: 'energy', b: 'construction', titleAr: 'كفاءة الطاقة في المباني' },
    { a: 'logistics', b: 'digital', titleAr: 'نظام تتبع الأسطول' },
    { a: 'agriculture', b: 'digital', titleAr: 'الزراعة الذكية' },
    { a: 'tourism', b: 'media', titleAr: 'تجارب سياحية وتسويقها' },
    { a: 'health', b: 'digital', titleAr: 'خدمات صحية رقمية مساندة' },
    { a: 'osh', b: 'industry', titleAr: 'خدمات تقييم مخاطر صناعية' },
    { a: 'energy', b: 'logistics', titleAr: 'كفاءة طاقة في سلاسل الإمداد' },
    { a: 'tourism', b: 'events', titleAr: 'فعاليات وتجارب سياحية' },
    { a: 'construction', b: 'osh', titleAr: 'سلامة مواقع البناء' },
    { a: 'health', b: 'education', titleAr: 'توعية وتدريب صحي مجتمعي' },
    { a: 'finance', b: 'digital', titleAr: 'خدمات مالية رقمية مصغّرة' },
  ];

  window.HubSectorLibrary = {
    CYCLE,
    GATE_STATUSES,
    SECTORS,
    SKILL_ONTOLOGY,
    COMBINATIONS,
    emptyPackage,
    list: () => SECTORS.filter((s) => s.published !== false),
    get: (id) => SECTORS.find((s) => s.sectorId === id) || null,
    bySkill: (skill) => {
      const key = Object.keys(SKILL_ONTOLOGY).find((k) => skill.includes(k) || k.includes(skill));
      return key ? SKILL_ONTOLOGY[key].map((id) => SECTORS.find((s) => s.sectorId === id)).filter(Boolean) : [];
    },
  };
})();
