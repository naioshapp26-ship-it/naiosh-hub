/**
 * NAIOSH Solutions Catalog — data + transactions (localStorage)
 */
(() => {
  'use strict';

  const KEY = 'naiosh_solutions_workspace_v1';
  const nowIso = () => new Date().toISOString();
  const uid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const nextSeq = (list, prefix) => {
    const year = new Date().getFullYear();
    const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
    let max = 0;
    (list || []).forEach((row) => {
      const m = String(row.id || row.requestId || '').match(re);
      if (m) max = Math.max(max, Number(m[1]));
    });
    return `${prefix}-${year}-${String(max + 1).padStart(5, '0')}`;
  };

  const SEED_SOLUTIONS = [
    {
      id: 'SOL-2026-00001',
      name: 'حساب شركات ذكي لإدارة إنفاق المرافق والصيانة',
      shortName: 'المرافق والصيانة',
      icon: 'fa-building',
      category: 'مرافق',
      sector: 'Facilities',
      serviceType: 'إدارة إنفاق',
      description: 'ميزانيات حسب الموقع أو العقار، بطاقات ميدانية، دفع للموردين، وتتبع لحظي لمصروف الصيانة.',
      fullDescription: 'حل متكامل لإدارة إنفاق المرافق والصيانة عبر حساب شركات ذكي يضبط الميزانية حسب الموقع والعقد والفريق مع بطاقات مُتحكم بها وتتبع لحظي.',
      audience: 'شركات إدارة المرافق والعقارات وخدمات الصيانة',
      problem: 'تشتت مصروفات الصيانة الميدانية وصعوبة ربطها بالموقع والعقد',
      scope: 'مواقع · عقارات · عقود · فرق ميدانية',
      deliverables: ['ميزانيات مواقع', 'بطاقات شركات', 'تتبع مصروفات لحظي', 'تقارير موردين'],
      duration: '2–4 أسابيع',
      requirements: ['بيانات المواقع', 'قائمة الموردين', 'هيكل الميزانية'],
      steps: ['تشخيص الاحتياج', 'ضبط الميزانيات', 'إصدار البطاقات', 'التشغيل والمتابعة'],
      priceType: 'quote',
      priceLabel: 'السعر يحدد بعد دراسة الاحتياج',
      startingFrom: null,
      ctaType: 'Choose Solution',
      owner: 'فريق حلول الإنفاق',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00002',
      name: 'حلول مالية للشركات الاستشارية',
      shortName: 'الاستشارات',
      icon: 'fa-briefcase',
      category: 'استشارات',
      sector: 'Consulting',
      serviceType: 'حلول مالية',
      description: 'ميزانية حسب العميل أو المهمة، بطاقات للاستشاريين، تعويضات، وفوترة على المشروع الصحيح.',
      fullDescription: 'منظومة مالية للاستشارات تربط كل مصروف بالعميل والمهمة والمشروع مع بطاقات وتعويضات وتتبع لحظي.',
      audience: 'مكاتب وشركات الاستشارات',
      problem: 'صعوبة تحميل المصروفات على المشاريع والعملاء',
      scope: 'عملاء · مهام · مشاريع · فرق استشارية',
      deliverables: ['ميزانيات عملاء', 'بطاقات استشاريين', 'تعويضات', 'تتبع مشاريع'],
      duration: '2–3 أسابيع',
      requirements: ['قائمة العملاء', 'هيكل المشاريع'],
      steps: ['رسم خريطة العملاء', 'ضبط الميزانيات', 'التفعيل', 'التدريب'],
      priceType: 'quote',
      priceLabel: 'السعر يحدد بعد دراسة الاحتياج',
      startingFrom: null,
      ctaType: 'Request Quote',
      owner: 'فريق حلول الإنفاق',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00003',
      name: 'حساب شركات ذكي لإدارة إنفاق الإعلام والاتصالات والحملات',
      shortName: 'الإعلام والحملات',
      icon: 'fa-bullhorn',
      category: 'إعلام',
      sector: 'Media',
      serviceType: 'إدارة إنفاق',
      description: 'ميزانيات حسب الحملة أو القناة، بطاقات للموظفين، دفع للموردين، وتتبع لحظي.',
      fullDescription: 'تحكّم في إنفاق الحملات والإعلام عبر ميزانيات قنوات وبطاقات مُتحكم بها وتتبع لكل مصروف.',
      audience: 'وكالات وفرق إعلام واتصالات',
      problem: 'تجاوز ميزانيات الحملات وصعوبة تتبع القنوات',
      scope: 'حملات · إنتاج · قنوات · فرق',
      deliverables: ['ميزانيات حملات', 'بطاقات', 'تتبع موردين'],
      duration: '2–4 أسابيع',
      requirements: ['خطة الحملات', 'قائمة الموردين'],
      steps: ['تحديد القنوات', 'ضبط الميزانية', 'التفعيل'],
      priceType: 'quote',
      priceLabel: 'السعر يحدد بعد دراسة الاحتياج',
      ctaType: 'Choose Solution',
      owner: 'فريق حلول الإنفاق',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00004',
      name: 'حلول مالية لقطاع الأغذية والمشروبات',
      shortName: 'أغذية ومشروبات',
      icon: 'fa-utensils',
      category: 'أغذية',
      sector: 'F&B',
      serviceType: 'حلول مالية',
      description: 'ميزانيات حسب الفرع، بطاقات للفرق، دفع للموردين، وتتبع تشغيل لحظي.',
      fullDescription: 'حلول مالية لقطاع الأغذية تربط الإنفاق بالفرع والفريق والمورد مع تتبع لحظي.',
      audience: 'مطاعم وسلاسل أغذية ومشروبات',
      problem: 'تفاوت إنفاق الفروع وضعف الرقابة على المشتريات',
      scope: 'فروع · مواقع · فرق تشغيل',
      deliverables: ['ميزانيات فروع', 'بطاقات', 'تتبع موردين'],
      duration: '3 أسابيع',
      requirements: ['قائمة الفروع', 'الموردين'],
      steps: ['تشخيص الفروع', 'الضبط', 'التشغيل'],
      priceType: 'starting',
      priceLabel: 'Starting From',
      startingFrom: 4500,
      ctaType: 'Choose Solution',
      owner: 'فريق حلول القطاعات',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00005',
      name: 'حلول إدارة المصروفات لشركات المقاولات',
      shortName: 'المقاولات',
      icon: 'fa-helmet-safety',
      category: 'مقاولات',
      sector: 'Construction',
      serviceType: 'إدارة مصروفات',
      description: 'بطاقات مواقع، دفع لمقاولي الباطن، وتتبع التكلفة حسب المشروع والمرحلة.',
      fullDescription: 'إدارة مصروفات المقاولات حسب المشروع والموقع والمرحلة والمقاول مع بطاقات مُتحكم بها.',
      audience: 'شركات المقاولات والتطوير الإنشائي',
      problem: 'صعوبة تتبع تكاليف المواقع ومقاولي الباطن',
      scope: 'مشاريع · مواقع · مراحل · مقاولين',
      deliverables: ['بطاقات مواقع', 'تتبع مشاريع', 'تقارير تكلفة'],
      duration: '3–5 أسابيع',
      requirements: ['هيكل المشاريع', 'قائمة المقاولين'],
      steps: ['رسم المشاريع', 'البطاقات', 'التتبع'],
      priceType: 'quote',
      priceLabel: 'السعر يحدد بعد دراسة الاحتياج',
      ctaType: 'Request Quote',
      owner: 'فريق حلول القطاعات',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00006',
      name: 'حلول مالية لوكالات التسويق والإعلان',
      shortName: 'تسويق وإعلان',
      icon: 'fa-rectangle-ad',
      category: 'تسويق',
      sector: 'Marketing',
      serviceType: 'حلول مالية',
      description: 'ميزانية حسب العميل أو الحملة، بطاقات للفرق، ومدفوعات موردين مع تتبع لحظي.',
      fullDescription: 'حلول مالية لوكالات التسويق تربط الإنفاق بالعميل والحملة والحساب الصحيح.',
      audience: 'وكالات التسويق والإعلان',
      problem: 'خلط مصروفات العملاء والحملات',
      scope: 'عملاء · حملات · فرق',
      deliverables: ['ميزانيات حملات', 'بطاقات', 'تتبع حسابات'],
      duration: '2–3 أسابيع',
      requirements: ['قائمة العملاء', 'الحملات النشطة'],
      steps: ['الربط', 'الضبط', 'التفعيل'],
      priceType: 'quote',
      priceLabel: 'السعر يحدد بعد دراسة الاحتياج',
      ctaType: 'Choose Solution',
      owner: 'فريق حلول الإنفاق',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00007',
      name: 'حلول مالية لقطاع التجزئة والتجارة الإلكترونية',
      shortName: 'تجزئة وتجارة',
      icon: 'fa-store',
      category: 'تجزئة',
      sector: 'Retail',
      serviceType: 'حلول مالية',
      description: 'ميزانيات حسب المتجر أو القناة، بطاقات للمديرين، وتتبع إنفاق التجزئة لحظياً.',
      fullDescription: 'تحكّم في إنفاق المتاجر والقنوات الإلكترونية مع بطاقات وتتبع لحظي.',
      audience: 'سلاسل التجزئة والتجارة الإلكترونية',
      problem: 'تفاوت إنفاق المتاجر والقنوات',
      scope: 'متاجر · قنوات · مشترين',
      deliverables: ['ميزانيات متاجر', 'بطاقات', 'تقارير قنوات'],
      duration: '3 أسابيع',
      requirements: ['خريطة المتاجر', 'القنوات'],
      steps: ['التشخيص', 'الضبط', 'التشغيل'],
      priceType: 'starting',
      priceLabel: 'Starting From',
      startingFrom: 5200,
      ctaType: 'Choose Solution',
      owner: 'فريق حلول القطاعات',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00008',
      name: 'حلول مالية لقطاع التصنيع',
      shortName: 'التصنيع',
      icon: 'fa-industry',
      category: 'تصنيع',
      sector: 'Manufacturing',
      serviceType: 'حلول مالية',
      description: 'ميزانيات حسب المصنع أو الخط، بطاقات مشتريات، وتتبع إنفاق الإنتاج.',
      fullDescription: 'حلول مالية للتصنيع تربط الإنفاق بالمصنع والخط والمواد الخام.',
      audience: 'مصانع وخطوط إنتاج',
      problem: 'ضعف تتبع تكلفة الخطوط والمواد',
      scope: 'مصانع · خطوط · مشتريات',
      deliverables: ['ميزانيات خطوط', 'بطاقات', 'تتبع مواد'],
      duration: '4 أسابيع',
      requirements: ['هيكل المصانع', 'الموردين'],
      steps: ['رسم الخطوط', 'الضبط', 'التتبع'],
      priceType: 'quote',
      priceLabel: 'السعر يحدد بعد دراسة الاحتياج',
      ctaType: 'Request Quote',
      owner: 'فريق حلول القطاعات',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00009',
      name: 'حلول مالية للمؤسسات التعليمية',
      shortName: 'التعليم',
      icon: 'fa-graduation-cap',
      category: 'تعليم',
      sector: 'Education',
      serviceType: 'حلول مالية',
      description: 'ميزانيات حسب الحرم أو القسم، بطاقات بضوابط، وتتبع مصروفات التعليم.',
      fullDescription: 'إدارة إنفاق المؤسسات التعليمية حسب الحرم والقسم والفصل الدراسي.',
      audience: 'مدارس وجامعات ومراكز تعليم',
      problem: 'تشتت ميزانيات الأقسام والحُرُم',
      scope: 'حرم · أقسام · فرق',
      deliverables: ['ميزانيات أقسام', 'بطاقات', 'تقارير'],
      duration: '3 أسابيع',
      requirements: ['هيكل الأقسام'],
      steps: ['التشخيص', 'الضبط', 'التفعيل'],
      priceType: 'consultation',
      priceLabel: 'يُحدد عبر استشارة',
      ctaType: 'Request Consultation',
      owner: 'فريق حلول القطاعات',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00010',
      name: 'تحكّم في إنفاق البرمجيات كخدمة والسحابة والبحث والتطوير',
      shortName: 'SaaS والسحابة',
      icon: 'fa-cloud',
      category: 'تقنية',
      sector: 'Tech',
      serviceType: 'إدارة إنفاق تقني',
      description: 'ميزانية حسب المورّد أو المشروع، بطاقات افتراضية للاشتراكات، وتتبع قبل نهاية الشهر.',
      fullDescription: 'تحكّم في اشتراكات SaaS والسحابة وR&D عبر بطاقات افتراضية وميزانيات مشاريع.',
      audience: 'شركات تقنية وفرق منتج',
      problem: 'اشتراكات متكررة غير مرئية حتى نهاية الشهر',
      scope: 'موردون · مشاريع · فرق',
      deliverables: ['بطاقات افتراضية', 'ميزانيات SaaS', 'تنبيهات'],
      duration: '2 أسابيع',
      requirements: ['قائمة الاشتراكات'],
      steps: ['جرد الاشتراكات', 'البطاقات', 'الرقابة'],
      priceType: 'starting',
      priceLabel: 'Starting From',
      startingFrom: 3900,
      ctaType: 'Choose Solution',
      owner: 'فريق حلول التقنية',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00011',
      name: 'أدِر إنفاق الأسطول والمستودعات والشحنات',
      shortName: 'أسطول وشحن',
      icon: 'fa-truck',
      category: 'لوجستيات',
      sector: 'Logistics',
      serviceType: 'إدارة إنفاق',
      description: 'ميزانيات حسب المسار أو الشحنة، بطاقات للسائقين، وتتبع تكلفة العملية.',
      fullDescription: 'إدارة إنفاق الأسطول والمستودعات والشحنات مع بطاقات وتتبع مراكز التكلفة.',
      audience: 'شركات النقل واللوجستيات',
      problem: 'صعوبة ربط تكلفة الشحنة بالمسار والعميل',
      scope: 'مسارات · شحنات · مستودعات',
      deliverables: ['بطاقات سائقين', 'تتبع شحنات', 'تقارير تكلفة'],
      duration: '3–4 أسابيع',
      requirements: ['خريطة الأسطول'],
      steps: ['التشخيص', 'البطاقات', 'التتبع'],
      priceType: 'quote',
      priceLabel: 'السعر يحدد بعد دراسة الاحتياج',
      ctaType: 'Choose Solution',
      owner: 'فريق حلول القطاعات',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00012',
      name: 'حساب شركات ذكي لإدارة إنفاق الموظفين والتشغيل',
      shortName: 'موظفون وتشغيل',
      icon: 'fa-users',
      category: 'تشغيل',
      sector: 'Operations',
      serviceType: 'إدارة إنفاق',
      description: 'ميزانيات حسب القسم أو التكليف، بطاقات للموظفين، وتعويضات مع تتبع لحظي.',
      fullDescription: 'حساب شركات لإدارة إنفاق الموظفين والتشغيل عبر أقسام وقضايا وتكاليف.',
      audience: 'الشركات متوسطة وكبيرة الحجم',
      problem: 'تعويضات ومصروفات تشغيل غير منضبطة',
      scope: 'أقسام · فرق · تكليفات',
      deliverables: ['بطاقات موظفين', 'تعويضات', 'تتبع تشغيل'],
      duration: '2–3 أسابيع',
      requirements: ['هيكل الأقسام'],
      steps: ['الضبط', 'البطاقات', 'التدريب'],
      priceType: 'starting',
      priceLabel: 'Starting From',
      startingFrom: 3500,
      ctaType: 'Choose Solution',
      owner: 'فريق حلول الإنفاق',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00013',
      name: 'حساب شركات ذكي لكل منشأة وقسم ومورّد',
      shortName: 'رعاية صحية',
      icon: 'fa-hospital',
      category: 'رعاية صحية',
      sector: 'Healthcare',
      serviceType: 'إدارة إنفاق',
      description: 'ميزانيات حسب المنشأة أو القسم، بطاقات مشتريات، وتتبع عبر كل موقع.',
      fullDescription: 'إدارة إنفاق المنشآت الصحية حسب القسم والمورد والموقع.',
      audience: 'مستشفيات وعيادات ومجموعات طبية',
      problem: 'تشتت مشتريات المستلزمات عبر المواقع',
      scope: 'منشآت · أقسام · موردون',
      deliverables: ['ميزانيات منشآت', 'بطاقات', 'تتبع موردين'],
      duration: '4 أسابيع',
      requirements: ['هيكل المنشآت'],
      steps: ['التشخيص', 'الضبط', 'التشغيل'],
      priceType: 'quote',
      priceLabel: 'السعر يحدد بعد دراسة الاحتياج',
      ctaType: 'Request Consultation',
      owner: 'فريق حلول القطاعات',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00014',
      name: 'حساب شركات ذكي لكل رحلة وحجز ومورّد',
      shortName: 'سفر ورحلات',
      icon: 'fa-plane',
      category: 'سفر',
      sector: 'Travel',
      serviceType: 'إدارة إنفاق',
      description: 'ميزانية حسب الرحلة أو العميل، بطاقات للمسافرين، وتتبع مقابل الحجز.',
      fullDescription: 'إدارة إنفاق السفر والحجوزات مع بطاقات وتتبع لكل رحلة.',
      audience: 'شركات ذات سفر أعمال مكثف',
      problem: 'مصروفات سفر غير مربوطة بالحجوزات',
      scope: 'رحلات · حجوزات · موردون',
      deliverables: ['بطاقات سفر', 'تتبع حجوزات'],
      duration: '2 أسابيع',
      requirements: ['سياسة السفر'],
      steps: ['السياسة', 'البطاقات', 'التتبع'],
      priceType: 'starting',
      priceLabel: 'Starting From',
      startingFrom: 2800,
      ctaType: 'Choose Solution',
      owner: 'فريق حلول الإنفاق',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00015',
      name: 'حلول مالية لقطاع الضيافة',
      shortName: 'الضيافة',
      icon: 'fa-hotel',
      category: 'ضيافة',
      sector: 'Hospitality',
      serviceType: 'حلول مالية',
      description: 'ميزانيات حسب العقار أو المنفذ، بطاقات للمديرين، وتتبع عبر المواقع.',
      fullDescription: 'حلول مالية للضيافة تربط الإنفاق بالعقار والمنفذ والمورد.',
      audience: 'فنادق ومنتجعات ومجموعات ضيافة',
      problem: 'تفاوت إنفاق العقارات والمنافذ',
      scope: 'عقارات · منافذ · مديرون',
      deliverables: ['ميزانيات عقارات', 'بطاقات', 'تتبع'],
      duration: '3 أسابيع',
      requirements: ['قائمة العقارات'],
      steps: ['التشخيص', 'الضبط', 'التفعيل'],
      priceType: 'quote',
      priceLabel: 'السعر يحدد بعد دراسة الاحتياج',
      ctaType: 'Choose Solution',
      owner: 'فريق حلول القطاعات',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00016',
      name: 'حساب شركات ذكي لإدارة مصاريف الفرق الميدانية والوقود',
      shortName: 'ميدان ووقود',
      icon: 'fa-gas-pump',
      category: 'ميداني',
      sector: 'Field',
      serviceType: 'إدارة إنفاق',
      description: 'ميزانيات حسب الموقع أو المشروع، بطاقات ميدانية، وإدارة وقود مع تتبع لحظي.',
      fullDescription: 'إدارة مصاريف الفرق الميدانية والوقود عبر بطاقات ومراكز تكلفة.',
      audience: 'شركات خدمات ميدانية وأساطيل خفيفة',
      problem: 'إنفاق وقود وميدان غير مراقب',
      scope: 'مواقع · مشاريع · فرق ميدانية',
      deliverables: ['بطاقات ميدان', 'تتبع وقود'],
      duration: '2–3 أسابيع',
      requirements: ['خريطة الفرق'],
      steps: ['الضبط', 'البطاقات', 'الرقابة'],
      priceType: 'starting',
      priceLabel: 'Starting From',
      startingFrom: 3200,
      ctaType: 'Choose Solution',
      owner: 'فريق حلول الإنفاق',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00017',
      name: 'حساب شركات ذكي لإدارة إنفاق مشاريع وعقارات التطوير العقاري',
      shortName: 'تطوير عقاري',
      icon: 'fa-city',
      category: 'عقارات',
      sector: 'RealEstate',
      serviceType: 'إدارة إنفاق',
      description: 'ميزانيات حسب المشروع أو العقار، بطاقات للموظفين، ودفع للمقاولين مع تتبع لحظي.',
      fullDescription: 'إدارة إنفاق مشاريع التطوير العقاري حسب المشروع والعقار والفريق.',
      audience: 'مطورون عقاريون',
      problem: 'تداخل تكاليف المشاريع والعقارات',
      scope: 'مشاريع · عقارات · مقاولون',
      deliverables: ['ميزانيات مشاريع', 'بطاقات', 'تتبع مقاولين'],
      duration: '4 أسابيع',
      requirements: ['هيكل المشاريع'],
      steps: ['رسم المشاريع', 'الضبط', 'التتبع'],
      priceType: 'quote',
      priceLabel: 'السعر يحدد بعد دراسة الاحتياج',
      ctaType: 'Request Quote',
      owner: 'فريق حلول القطاعات',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00018',
      name: 'حساب شركات ذكي لكل فعالية وإنتاج ومكان',
      shortName: 'فعاليات',
      icon: 'fa-calendar-check',
      category: 'فعاليات',
      sector: 'Events',
      serviceType: 'إدارة إنفاق',
      description: 'ميزانية حسب الفعالية، بطاقات للطاقم، ودفع للأماكن والموردين مع تتبع التكلفة.',
      fullDescription: 'إدارة إنفاق الفعاليات والإنتاج والأماكن مع بطاقات وتتبع مراكز التكلفة.',
      audience: 'منظمو فعاليات وشركات إنتاج',
      problem: 'تجاوز ميزانيات الفعاليات',
      scope: 'فعاليات · إنتاج · أماكن',
      deliverables: ['ميزانيات فعاليات', 'بطاقات', 'تتبع'],
      duration: '2 أسابيع',
      requirements: ['خطة الفعالية'],
      steps: ['الميزانية', 'البطاقات', 'الإغلاق'],
      priceType: 'starting',
      priceLabel: 'Starting From',
      startingFrom: 2500,
      ctaType: 'Choose Solution',
      owner: 'فريق حلول الإنفاق',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00019',
      name: 'حلول مالية للجهات الحكومية',
      shortName: 'حكومي',
      icon: 'fa-landmark',
      category: 'حكومي',
      sector: 'Government',
      serviceType: 'حلول مالية',
      description: 'ميزانيات أقسام، بطاقات مخوّلين، ومدفوعات موردين مع تتبع بنود الإنفاق.',
      fullDescription: 'حلول مالية للقطاع العام تربط الإنفاق بالأقسام والبنود مع ضوابط صلاحيات.',
      audience: 'جهات حكومية وشبه حكومية',
      problem: 'صعوبة ضبط بنود الإنفاق والصلاحيات',
      scope: 'أقسام · بنود · مخوّلون',
      deliverables: ['ميزانيات أقسام', 'بطاقات', 'تقارير بنود'],
      duration: '4–6 أسابيع',
      requirements: ['هيكل الاعتمادات'],
      steps: ['التشخيص', 'الضوابط', 'التفعيل'],
      priceType: 'consultation',
      priceLabel: 'يُحدد عبر استشارة',
      ctaType: 'Request Consultation',
      owner: 'فريق الحلول الحكومية',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00020',
      name: 'حلول مالية للجهات غير الربحية',
      shortName: 'غير ربحي',
      icon: 'fa-hand-holding-heart',
      category: 'غير ربحي',
      sector: 'Nonprofit',
      serviceType: 'حلول مالية',
      description: 'ميزانية حسب البرنامج أو الحملة، بطاقات للفرق، وتتبع من التبرع إلى الأثر.',
      fullDescription: 'حلول مالية للمنظمات غير الربحية لربط الإنفاق بالبرامج والأثر.',
      audience: 'جمعيات ومنظمات غير ربحية',
      problem: 'صعوبة إثبات أثر الإنفاق من التبرعات',
      scope: 'برامج · حملات · متطوعون',
      deliverables: ['ميزانيات برامج', 'بطاقات', 'تقارير أثر'],
      duration: '3 أسابيع',
      requirements: ['هيكل البرامج'],
      steps: ['التشخيص', 'الضبط', 'التقارير'],
      priceType: 'consultation',
      priceLabel: 'يُحدد عبر استشارة',
      ctaType: 'Request Consultation',
      owner: 'فريق حلول القطاعات',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00021',
      name: 'حلول مالية لشركات الاستثمار',
      shortName: 'استثمار',
      icon: 'fa-chart-pie',
      category: 'استثمار',
      sector: 'Investment',
      serviceType: 'حلول مالية',
      description: 'ميزانيات حسب الكيان أو الصندوق، بطاقات للفرق، وتتبع إنفاق المجموعة.',
      fullDescription: 'حلول مالية لشركات الاستثمار والصناديق لتتبع الإنفاق عبر الهيكل.',
      audience: 'شركات استثمار وصناديق',
      problem: 'تداخل إنفاق الكيانات والصناديق',
      scope: 'كيانات · صناديق · محافظ',
      deliverables: ['ميزانيات كيانات', 'بطاقات', 'تقارير مجموعة'],
      duration: '4 أسابيع',
      requirements: ['هيكل الكيانات'],
      steps: ['رسم الهيكل', 'الضبط', 'التتبع'],
      priceType: 'quote',
      priceLabel: 'السعر يحدد بعد دراسة الاحتياج',
      ctaType: 'Request Quote',
      owner: 'فريق حلول القطاعات',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
    },
    {
      id: 'SOL-2026-00022',
      name: 'برنامج خفض التكاليف التشغيلية',
      shortName: 'خفض التكاليف',
      icon: 'fa-chart-line',
      category: 'خفض تكاليف',
      sector: 'CostReduction',
      serviceType: 'تقييم وخفض تكاليف',
      description: 'تقييم مصروفات التشغيل وتحديد فرص التوفير مع خطة تنفيذ ومتابعة.',
      fullDescription: 'مسار تقييم وخفض التكاليف التشغيلية: تشخيص المصروفات، فرص التوفير، خطة تنفيذ، ومتابعة الأثر.',
      audience: 'أي منشأة تسعى لتقنين المصروفات',
      problem: 'مصروفات مرتفعة بدون خريطة فرص توفير واضحة',
      scope: 'تشغيل · رواتب · تقنية · تسويق · توريد · اتصالات · خدمات',
      deliverables: ['تقرير تقييم', 'فرص توفير', 'خطة تنفيذ', 'متابعة أثر'],
      duration: '3–6 أسابيع',
      requirements: ['فواتير', 'تقارير مصروفات', 'ميزانيات', 'عقود'],
      steps: ['جمع البيانات', 'التحليل', 'العرض', 'التنفيذ', 'قياس الأثر'],
      priceType: 'consultation',
      priceLabel: 'يُحدد عبر تقييم',
      ctaType: 'Choose Solution',
      owner: 'فريق خفض التكاليف',
      status: 'active',
      createdBy: 'نظام الحلول',
      createdAt: '2026-01-10T10:00:00.000Z',
      lastModified: '2026-01-10T10:00:00.000Z',
      requestType: 'Cost Reduction Assessment',
    },
  ];

  const blank = () => ({
    schemaVersion: 1,
    solutions: SEED_SOLUTIONS.map((s) => ({ ...s, deliverables: [...(s.deliverables || [])], requirements: [...(s.requirements || [])], steps: [...(s.steps || [])] })),
    requests: [],
    quotations: [],
    auditLog: [],
  });

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        const s = blank();
        localStorage.setItem(KEY, JSON.stringify(s));
        return s;
      }
      const parsed = JSON.parse(raw);
      if (!parsed.schemaVersion) Object.assign(parsed, blank());
      if (!Array.isArray(parsed.solutions) || parsed.solutions.length < 20) {
        const byId = new Map((parsed.solutions || []).map((s) => [s.id, s]));
        parsed.solutions = SEED_SOLUTIONS.map((s) => ({ ...s, ...(byId.get(s.id) || {}) }));
      }
      if (!Array.isArray(parsed.requests)) parsed.requests = [];
      if (!Array.isArray(parsed.quotations)) parsed.quotations = [];
      if (!Array.isArray(parsed.auditLog)) parsed.auditLog = [];
      return parsed;
    } catch {
      return blank();
    }
  };

  let state = load();

  const save = () => {
    localStorage.setItem(KEY, JSON.stringify(state));
    return state;
  };

  const pushAudit = (entry) => {
    const row = {
      id: nextSeq(state.auditLog, 'TX'),
      at: nowIso(),
      ...entry,
    };
    state.auditLog.unshift(row);
    state.auditLog = state.auditLog.slice(0, 300);
    save();
    return row;
  };

  const listSolutions = (includeInactive = false) =>
    (state.solutions || []).filter((s) => includeInactive || s.status === 'active');

  const getSolution = (id) => (state.solutions || []).find((s) => s.id === id);

  const upsertSolution = (payload = {}, actor = 'مشغّل') => {
    let row = payload.id ? getSolution(payload.id) : null;
    const stamp = nowIso();
    if (row) {
      Object.assign(row, payload, { lastModified: stamp });
      pushAudit({ action: 'Solution Updated', requestId: '', solutionId: row.id, solution: row.name, customer: '', performedBy: actor, oldStatus: '', newStatus: row.status });
      save();
      return row;
    }
    row = {
      id: nextSeq(state.solutions, 'SOL'),
      name: payload.name || 'حل جديد',
      shortName: payload.shortName || payload.name || 'حل',
      icon: payload.icon || 'fa-lightbulb',
      category: payload.category || 'عام',
      sector: payload.sector || 'General',
      serviceType: payload.serviceType || 'خدمة',
      description: payload.description || '',
      fullDescription: payload.fullDescription || payload.description || '',
      audience: payload.audience || '',
      problem: payload.problem || '',
      scope: payload.scope || '',
      deliverables: payload.deliverables || [],
      duration: payload.duration || '—',
      requirements: payload.requirements || [],
      steps: payload.steps || [],
      priceType: payload.priceType || 'quote',
      priceLabel: payload.priceLabel || 'السعر يحدد بعد دراسة الاحتياج',
      startingFrom: payload.startingFrom ?? null,
      ctaType: payload.ctaType || 'Choose Solution',
      owner: payload.owner || actor,
      status: payload.status || 'active',
      createdBy: actor,
      createdAt: stamp,
      lastModified: stamp,
    };
    state.solutions.unshift(row);
    pushAudit({ action: 'Solution Created', solutionId: row.id, solution: row.name, performedBy: actor, customer: '', requestId: '', oldStatus: '', newStatus: row.status });
    save();
    return row;
  };

  const setSolutionStatus = (id, status, actor = 'مشغّل') => {
    const row = getSolution(id);
    if (!row) return null;
    const old = row.status;
    row.status = status;
    row.lastModified = nowIso();
    pushAudit({ action: 'Solution Status', solutionId: id, solution: row.name, performedBy: actor, oldStatus: old, newStatus: status, requestId: '', customer: '' });
    save();
    return row;
  };

  const createRequest = (payload = {}, actor = 'عميل') => {
    const sol = getSolution(payload.solutionId);
    const stamp = nowIso();
    const requestId = payload.requestType === 'Cost Reduction Assessment' ? nextSeq(state.requests, 'COST') : nextSeq(state.requests, 'SOL-REQ');
    const item = {
      id: requestId,
      requestId,
      requestType: payload.requestType || 'Solution Request',
      solutionId: sol?.id || payload.solutionId || '',
      solutionName: sol?.name || payload.solutionName || 'حل',
      customer: {
        name: payload.customer?.name || '',
        company: payload.customer?.company || '',
        phone: payload.customer?.phone || '',
        email: payload.customer?.email || '',
        branch: payload.customer?.branch || '',
      },
      need: payload.need || '',
      priority: payload.priority || 'عادي',
      scopeType: payload.scopeType || 'شركة كاملة',
      scopeDetail: payload.scopeDetail || '',
      attachments: payload.attachments || [],
      costMeta: payload.costMeta || null,
      status: 'New',
      requestedBy: actor,
      assignedTo: '',
      salesOwner: 'Sales Desk',
      consultant: '',
      approver: '',
      createdAt: stamp,
      updatedAt: stamp,
      timeline: [
        { at: stamp, by: actor, text: 'تم اختيار الحل', key: 'selected' },
        { at: stamp, by: actor, text: 'تم إرسال الطلب', key: 'submitted' },
      ],
      messages: [],
      tasks: [],
    };
    state.requests.unshift(item);
    pushAudit({
      action: 'Request Created',
      requestId: item.id,
      customer: item.customer.company || item.customer.name,
      solution: item.solutionName,
      performedBy: actor,
      oldStatus: '',
      newStatus: 'New',
      solutionId: item.solutionId,
    });
    save();
    return item;
  };

  const updateRequestStatus = (id, status, actor = 'مشغّل', note = '') => {
    const row = state.requests.find((r) => r.id === id);
    if (!row) return null;
    const old = row.status;
    row.status = status;
    row.updatedAt = nowIso();
    if (!Array.isArray(row.timeline)) row.timeline = [];
    row.timeline.push({ at: row.updatedAt, by: actor, text: note || `تغيّر الحالة إلى ${status}`, key: status });
    pushAudit({
      action: 'Status Changed',
      requestId: id,
      customer: row.customer?.company || row.customer?.name,
      solution: row.solutionName,
      performedBy: actor,
      oldStatus: old,
      newStatus: status,
      solutionId: row.solutionId,
    });
    save();
    return row;
  };

  const assignRequest = (id, fields = {}, actor = 'مشغّل') => {
    const row = state.requests.find((r) => r.id === id);
    if (!row) return null;
    Object.assign(row, fields, { updatedAt: nowIso() });
    row.timeline.push({ at: row.updatedAt, by: actor, text: `تعيين مسؤول: ${fields.assignedTo || fields.salesOwner || ''}`, key: 'assigned' });
    if (row.status === 'New') row.status = 'Under Review';
    pushAudit({ action: 'Assigned', requestId: id, customer: row.customer?.company, solution: row.solutionName, performedBy: actor, oldStatus: 'New', newStatus: row.status, solutionId: row.solutionId });
    save();
    return row;
  };

  const addAttachment = (id, fileName, actor = 'عميل') => {
    const row = state.requests.find((r) => r.id === id);
    if (!row) return null;
    if (!Array.isArray(row.attachments)) row.attachments = [];
    row.attachments.push({ name: fileName, at: nowIso(), by: actor });
    row.updatedAt = nowIso();
    row.timeline.push({ at: row.updatedAt, by: actor, text: `إضافة مرفق: ${fileName}`, key: 'attachment' });
    pushAudit({ action: 'Attachment Added', requestId: id, customer: row.customer?.company, solution: row.solutionName, performedBy: actor, oldStatus: row.status, newStatus: row.status, solutionId: row.solutionId });
    save();
    return row;
  };

  const addMessage = (id, text, actor = 'عميل') => {
    const row = state.requests.find((r) => r.id === id);
    if (!row) return null;
    if (!Array.isArray(row.messages)) row.messages = [];
    row.messages.push({ at: nowIso(), by: actor, text });
    row.updatedAt = nowIso();
    save();
    return row;
  };

  const createQuotation = (requestId, payload = {}, actor = 'Sales Desk') => {
    const req = state.requests.find((r) => r.id === requestId);
    if (!req) return null;
    const price = Number(payload.price) || 0;
    const tax = Number(payload.tax) || Math.round(price * 0.15);
    const discount = Number(payload.discount) || 0;
    const item = {
      id: nextSeq(state.quotations, 'QT'),
      requestId,
      solutionId: req.solutionId,
      solutionName: req.solutionName,
      price,
      tax,
      discount,
      total: price + tax - discount,
      validUntil: payload.validUntil || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      createdBy: actor,
      createdAt: nowIso(),
      status: 'Sent',
    };
    state.quotations.unshift(item);
    updateRequestStatus(requestId, 'Proposal Sent', actor, `إرسال عرض سعر ${item.id}`);
    pushAudit({ action: 'Quotation Sent', requestId, customer: req.customer?.company, solution: req.solutionName, performedBy: actor, oldStatus: 'Under Review', newStatus: 'Proposal Sent', solutionId: req.solutionId });
    save();
    return item;
  };

  const decideQuotation = (qid, decision, actor = 'عميل') => {
    const q = state.quotations.find((x) => x.id === qid);
    if (!q) return null;
    q.status = decision === 'accept' ? 'Accepted' : 'Rejected';
    const next = decision === 'accept' ? 'Approved' : 'Need More Information';
    updateRequestStatus(q.requestId, next, actor, decision === 'accept' ? 'قبول العرض' : 'رفض العرض');
    if (decision === 'accept') {
      const req = state.requests.find((r) => r.id === q.requestId);
      if (req) {
        req.timeline.push({ at: nowIso(), by: actor, text: 'تم اعتماد العرض', key: 'quote_accepted' });
        save();
      }
    }
    pushAudit({ action: decision === 'accept' ? 'Quotation Accepted' : 'Quotation Rejected', requestId: q.requestId, customer: '', solution: q.solutionName, performedBy: actor, oldStatus: 'Proposal Sent', newStatus: next, solutionId: q.solutionId });
    return q;
  };

  window.HubSolutions = {
    KEY,
    SEED_SOLUTIONS,
    getState: () => state,
    reload: () => {
      state = load();
      return state;
    },
    save,
    listSolutions,
    getSolution,
    upsertSolution,
    setSolutionStatus,
    createRequest,
    updateRequestStatus,
    assignRequest,
    addAttachment,
    addMessage,
    createQuotation,
    decideQuotation,
    listRequests: () => state.requests || [],
    getRequest: (id) => (state.requests || []).find((r) => r.id === id),
    listQuotations: (requestId) => (state.quotations || []).filter((q) => !requestId || q.requestId === requestId),
    listAudit: () => state.auditLog || [],
    pushAudit,
  };
})();
