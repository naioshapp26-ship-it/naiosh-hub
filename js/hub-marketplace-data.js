(() => {
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const sys = (code, nameAr, icon, status = 'active') => {
    const launchUrl = `systems/${String(code).toLowerCase()}.html`;
    return {
      code,
      nameAr,
      kind: 'system',
      category: 'أنظمة نايوش',
      url: launchUrl,
      launchUrl,
      standaloneUrl: launchUrl,
      hubPath: `apps.html#${String(code).toLowerCase()}`,
      icon,
      status,
      supportsStandalone: true,
      launchViaHub: true,
    };
  };

  const studio = (code, nameAr, url, icon) => ({
    code,
    nameAr,
    kind: 'studio',
    category: 'استوديوهات هوب',
    url,
    launchUrl: url,
    standaloneUrl: url,
    hubPath: url,
    icon,
    status: 'active',
    supportsStandalone: true,
    launchViaHub: true,
  });

  const sovereign = (code, nameAr, icon, category) => ({
    code,
    nameAr,
    kind: 'sovereign',
    category,
    url: `platforms.html#${String(code).toLowerCase()}`,
    launchUrl: `platforms.html#${String(code).toLowerCase()}`,
    standaloneUrl: `platforms.html#${String(code).toLowerCase()}`,
    hubPath: `platforms.html#${String(code).toLowerCase()}`,
    icon,
    status: 'active',
    supportsStandalone: true,
    launchViaHub: true,
  });

  const APPS = [
    sovereign('UOS', 'النظام التشغيلي الموحد', 'fa-brain', 'نواة'),
    sovereign('KMS', 'إدارة المعرفة والدستور', 'fa-book-open', 'نواة'),
    sovereign('CCS', 'التحكم الكوني', 'fa-satellite-dish', 'نواة'),
    sovereign('NAI', 'محرك الذكاء الاصطناعي', 'fa-robot', 'نواة'),
    sovereign('NERP', 'نظام إدارة الموارد', 'fa-building', 'تشغيل'),
    sovereign('NHR', 'الموارد البشرية السيادية', 'fa-users-gear', 'تشغيل'),
    sovereign('NQMS', 'الجودة والامتثال', 'fa-shield-halved', 'حوكمة'),
    sovereign('NIMS', 'إدارة الحوادث والطوارئ', 'fa-triangle-exclamation', 'حوكمة'),
    sovereign('NAMS', 'إدارة الأصول', 'fa-boxes-stacked', 'تشغيل'),
    sovereign('NEMS', 'التعليم والتدريب', 'fa-graduation-cap', 'نمو'),
    sovereign('NTS', 'النقل والمركبات', 'fa-truck-fast', 'تشغيل'),
    sovereign('NCS', 'الاتصال المؤسسي', 'fa-tower-broadcast', 'نمو'),
    sovereign('NMS', 'التسويق والهوية', 'fa-bullhorn', 'نمو'),
    sovereign('NDS', 'البيانات والتحليل', 'fa-chart-pie', 'نواة'),
    sovereign('NFS', 'المالية والمحاسبة', 'fa-coins', 'تشغيل'),
    sovereign('NOPS', 'العمليات التشغيلية', 'fa-gears', 'تشغيل'),
    sovereign('NIS', 'التكامل والربط', 'fa-network-wired', 'نواة'),
    sovereign('NGS', 'الحوكمة والرقابة', 'fa-scale-balanced', 'حوكمة'),
    sys('LAW', 'نايوش لو — النظام القانوني', 'fa-gavel'),
    sys('NAIS', 'نايس — ذكاء التشغيل', 'fa-chart-line'),
    sys('FIT', 'نايوش فيت — الصحة واللياقة', 'fa-dumbbell'),
    sys('ERP', 'نايوش إي آر بي', 'fa-sitemap'),
    sys('ACADEMY', 'أكاديمية نايوش', 'fa-chalkboard-user'),
    studio('ADS', 'استوديو الإعلانات', 'ads.html', 'fa-rectangle-ad'),
    studio('EVENTS', 'استوديو الفعاليات', 'events.html', 'fa-calendar-days'),
    studio('STORE', 'متجر المبيعات', 'store.html', 'fa-bag-shopping'),
    studio('PRODUCTS', 'عرض المنتجات', 'products.html', 'fa-boxes-stacked'),
    studio('BRANCHES', 'الفروع العالمية', 'branches.html', 'fa-code-branch'),
    studio('INCUBATORS', 'الحاضنات القطاعية', 'incubators.html', 'fa-seedling'),
    sys('LMS', 'نظام التعلم', 'fa-laptop-code'),
    sys('CRM', 'إدارة علاقات العملاء', 'fa-handshake', 'building'),
  ];

  const STORE_ITEMS = [
    { id: 'st-1', title: 'باقة تشغيل منصة', desc: 'تفعيل منصة سيادية مع مكتب إلكتروني ودعم شهر.', price: 2500, points: 500, category: 'تشغيل', platformCode: 'UOS', stock: 40, status: 'active', badge: 'الأكثر طلبًا' },
    { id: 'st-2', title: 'دورة حوكمة سيادية', desc: 'برنامج تدريب امتثال وجودة للمنصات والفروع.', price: 890, points: 80, category: 'تعليم', platformCode: 'NEMS', stock: 120, status: 'active', badge: 'تعليم' },
    { id: 'st-3', title: 'حملة إعلانية للمنصة', desc: 'باقة ظهور إعلاني لمنتجات المنصة داخل هوب.', price: 1500, points: 300, category: 'إعلانات', platformCode: 'NMS', stock: 60, status: 'active', badge: 'تسويق' },
    { id: 'st-4', title: 'تذكرة فعالية مباشرة', desc: 'حضور فعالية نايوش عبر استوديو الفعاليات.', price: 350, points: 50, category: 'فعاليات', platformCode: 'EVENTS', stock: 200, status: 'active', badge: 'فعالية' },
    { id: 'st-5', title: 'اشتراك تحليل بيانات', desc: 'لوحات تحليل لحظية من نظام البيانات.', price: 1200, points: 220, category: 'بيانات', platformCode: 'NDS', stock: 80, status: 'active', badge: 'تحليل' },
    { id: 'st-6', title: 'حزمة موارد بشرية', desc: 'تفعيل وحدة الموارد البشرية لمنصة أو فرع.', price: 1800, points: 350, category: 'موارد', platformCode: 'NHR', stock: 45, status: 'active', badge: 'موارد' },
    { id: 'st-7', title: 'رخصة نايوش لو', desc: 'تشغيل النظام القانوني ضمن منظومة هوب.', price: 3200, points: 600, category: 'قانون', platformCode: 'LAW', stock: 25, status: 'active', badge: 'قانون' },
    { id: 'st-8', title: 'باقة تكامل أنظمة', desc: 'ربط نظام خارجي عبر طبقة التكامل.', price: 2100, points: 400, category: 'تكامل', platformCode: 'NIS', stock: 35, status: 'active', badge: 'تكامل' },
    { id: 'st-9', title: 'اشتراك نايوش فيت', desc: 'إدارة اللياقة والاشتراكات الصحية.', price: 990, points: 180, category: 'صحة', platformCode: 'FIT', stock: 70, status: 'active', badge: 'صحة' },
    { id: 'st-10', title: 'باقة مالية شهرية', desc: 'محاسبة وتقارير من نظام المالية.', price: 1600, points: 280, category: 'مالية', platformCode: 'NFS', stock: 55, status: 'active', badge: 'مالية' },
    { id: 'st-11', title: 'عرض منتج المنصة', desc: 'بطاقة منتج تظهر في إعلانات المنصات.', price: 450, points: 90, category: 'إعلانات', platformCode: 'ADS', stock: 150, status: 'active', badge: 'منتج' },
    { id: 'st-12', title: 'استضافة فعالية افتراضية', desc: 'قاعة بث وإدارة حضور عبر استوديو الفعاليات.', price: 2700, points: 520, category: 'فعاليات', platformCode: 'EVENTS', stock: 20, status: 'active', badge: 'بث' },
    { id: 'st-ac-1', title: 'أكاديمية نايوش — مسار تشغيلي', desc: 'نفس متجر الأكاديمية: دورة تشغيل معتمدة.', price: 650, points: 80, category: 'أكاديمية', platformCode: 'ACADEMY', stock: 220, status: 'active', badge: 'أكاديمية', itemKind: 'خدمة', brand: 'أكاديمية نايوش' },
    { id: 'st-ac-2', title: 'دورة حوكمة معتمدة', desc: 'برنامج امتثال من أكاديمية نايوش داخل المتجر الموحّد.', price: 890, points: 100, category: 'أكاديمية', platformCode: 'ACADEMY', stock: 140, status: 'active', badge: 'أكاديمية', itemKind: 'خدمة', brand: 'أكاديمية نايوش' },
    { id: 'st-ac-3', title: 'ورشة المدربين السياديين', desc: 'ورشة تدريب من أكاديمية نايوش — متاحة عبر المتجر.', price: 1200, points: 150, category: 'أكاديمية', platformCode: 'ACADEMY', stock: 80, status: 'active', badge: 'أكاديمية', itemKind: 'خدمة', brand: 'أكاديمية نايوش' },
  ];

  const adTargets = (scope, extras = {}) => ({
    home: scope === 'home' || !!extras.home,
    branches: scope === 'branches' ? ['*'] : extras.branches || [],
    incubators: scope === 'incubators' ? ['*'] : extras.incubators || [],
    platforms: scope === 'platforms' ? ['*'] : extras.platforms || [],
  });

  const ADS = [
    { id: 'ad-1', title: 'عرض تفعيل النظام التشغيلي', content: 'فعّل منصتك السيادية خلال 24 ساعة مع دعم غرفة العمليات.', price: 2500, category: 'تشغيل', platformCode: 'UOS', productId: 'st-1', views: 1840, status: 'active', level: 'مرتفع', type: 'منتج منصة', productType: 'رقمية', scope: 'platforms', publishTargets: adTargets('platforms', { home: true }) },
    { id: 'ad-2', title: 'دورة الحوكمة للمنصات', content: 'برنامج امتثال وجودة معتمد من نايوش.', price: 890, category: 'تعليم', platformCode: 'NEMS', productId: 'st-2', views: 960, status: 'active', level: 'متوسط', type: 'منتج منصة', productType: 'خدمية', scope: 'platforms', publishTargets: adTargets('platforms') },
    { id: 'ad-3', title: 'نايوش لو للمحاماة الرقمية', content: 'إدارة العقود والقضايا داخل هوب.', price: 3200, category: 'قانون', platformCode: 'LAW', productId: 'st-7', views: 1220, status: 'active', level: 'مرتفع', type: 'منتج منصة', productType: 'رقمية', scope: 'platforms', publishTargets: adTargets('platforms') },
    { id: 'ad-4', title: 'فعالية القمة التشغيلية', content: 'احجز مقعدك في فعالية القيادة العليا.', price: 350, category: 'فعاليات', platformCode: 'EVENTS', productId: 'st-4', views: 2100, status: 'active', level: 'مرتفع', type: 'فعالية', productType: 'خدمية', scope: 'platforms', publishTargets: adTargets('platforms', { home: true }) },
    { id: 'ad-5', title: 'حزمة الموارد البشرية', content: 'ضبط العنصر البشري لمنصتك فورًا.', price: 1800, category: 'موارد', platformCode: 'NHR', productId: 'st-6', views: 740, status: 'active', level: 'متوسط', type: 'منتج منصة', productType: 'خدمية', scope: 'incubators', publishTargets: adTargets('incubators') },
    { id: 'ad-6', title: 'تحليلات البيانات اللحظية', content: 'لوحات سيادية لاتخاذ القرار.', price: 1200, category: 'بيانات', platformCode: 'NDS', productId: 'st-5', views: 1580, status: 'active', level: 'مرتفع', type: 'منتج منصة', productType: 'رقمية', scope: 'platforms', publishTargets: adTargets('platforms') },
    { id: 'ad-7', title: 'نايوش فيت للفروع', content: 'اشتراكات صحية متكاملة للموظفين.', price: 990, category: 'صحة', platformCode: 'FIT', productId: 'st-9', views: 680, status: 'paused', level: 'منخفض', type: 'منتج منصة', productType: 'عينية', scope: 'branches', publishTargets: adTargets('branches') },
    { id: 'ad-8', title: 'باقة التكامل بين الأنظمة', content: 'اربط أي نظام نايوش بهوب عبر طبقة التكامل.', price: 2100, category: 'تكامل', platformCode: 'NIS', productId: 'st-8', views: 910, status: 'active', level: 'مرتفع', type: 'منتج منصة', productType: 'رقمية', scope: 'platforms', publishTargets: adTargets('platforms') },
    { id: 'ad-9', title: 'استضافة بث فعالية', content: 'قاعة افتراضية جاهزة للفعاليات الكبرى.', price: 2700, category: 'فعاليات', platformCode: 'EVENTS', productId: 'st-12', views: 430, status: 'active', level: 'متوسط', type: 'فعالية', productType: 'خدمية', scope: 'incubators', publishTargets: adTargets('incubators') },
    { id: 'ad-10', title: 'إعلان افتتاح فرع جديد', content: 'ظهور الفرع في شبكة هوب العالمية مع دعوة للانضمام.', price: 1200, category: 'تشغيل', platformCode: 'BRANCHES', productId: 'st-1', views: 540, status: 'active', level: 'مرتفع', type: 'فرع', productType: 'عينية', scope: 'branches', publishTargets: adTargets('branches', { home: true }) },
    { id: 'ad-11', title: 'حاضنة السياحة الرقمية', content: 'برنامج حاضنة قطاعية جاهز للانضمام عبر هوب.', price: 1600, category: 'تعليم', platformCode: 'INCUBATORS', productId: 'st-2', views: 390, status: 'active', level: 'متوسط', type: 'حاضنة', productType: 'خدمية', scope: 'incubators', publishTargets: adTargets('incubators') },
    { id: 'ad-12', title: 'عرض تشغيل منصة سيادية', content: 'فعّل منصتك ضمن المنصات الـ18 داخل هوب.', price: 2800, category: 'تشغيل', platformCode: 'UOS', productId: 'st-1', views: 1120, status: 'active', level: 'مرتفع', type: 'منصة', productType: 'رقمية', scope: 'platforms', publishTargets: adTargets('platforms', { home: true }) },
  ];

  const EVENTS = [
    { id: 'ev-1', name: 'قمة القيادة التشغيلية', description: 'جلسة مباشرة للقادة حول سيادة التشغيل في هوب.', date: '2026-08-12', time: '19:00', platform: 'استوديو الفعاليات', status: 'قادمة', type: 'بث مباشر', speaker: 'القائد الأعلى', duration: '90 دقيقة', department: 'غرفة العمليات' },
    { id: 'ev-2', name: 'ورشة استوديو الإعلانات', description: 'كيف تنشر إعلانات منتجات المنصات داخل هوب.', date: '2026-08-18', time: '17:30', platform: 'استوديو الإعلانات', status: 'قادمة', type: 'ورشة', speaker: 'فريق التسويق', duration: '60 دقيقة', department: 'التسويق' },
    { id: 'ev-3', name: 'إطلاق متجر المبيعات', description: 'جولة في متجر المبيعات وربط النقاط بالمشتريات.', date: '2026-08-05', time: '16:00', platform: 'متجر المبيعات', status: 'منتهية', type: 'إطلاق', speaker: 'فريق التجارة', duration: '45 دقيقة', department: 'المبيعات' },
    { id: 'ev-4', name: 'تكامل الأنظمة مع هوب', description: 'تسجيل أي نظام نايوش ليظهر في سجل التطبيقات.', date: '2026-08-22', time: '20:00', platform: 'التكامل', status: 'قادمة', type: 'ندوة', speaker: 'فريق التكامل', duration: '75 دقيقة', department: 'التقنية' },
    { id: 'ev-5', name: 'أكاديمية الحوكمة', description: 'مسار امتثال للمنصات والفروع.', date: '2026-08-28', time: '18:00', platform: 'الأكاديمية', status: 'مسودة', type: 'دورة', speaker: 'مركز الحوكمة', duration: '120 دقيقة', department: 'الحوكمة' },
  ];

  const AD_CATEGORIES = [
    { id: 'all', name: 'الكل', icon: 'fa-border-all' },
    { id: 'تشغيل', name: 'تشغيل', icon: 'fa-gears' },
    { id: 'تعليم', name: 'تعليم', icon: 'fa-graduation-cap' },
    { id: 'قانون', name: 'قانون', icon: 'fa-gavel' },
    { id: 'فعاليات', name: 'فعاليات', icon: 'fa-calendar' },
    { id: 'موارد', name: 'موارد', icon: 'fa-users' },
    { id: 'بيانات', name: 'بيانات', icon: 'fa-chart-pie' },
    { id: 'صحة', name: 'صحة', icon: 'fa-heart-pulse' },
    { id: 'تكامل', name: 'تكامل', icon: 'fa-plug' },
  ];

  const STORE_CATEGORIES = ['الكل', 'تشغيل', 'تعليم', 'إعلانات', 'فعاليات', 'بيانات', 'موارد', 'قانون', 'صحة', 'تكامل', 'مالية', 'أكاديمية', 'إي آر بي', 'نايس', 'فيت', 'قانونية', 'خدمات'];

  /** تصنيفات المتجر — أسلوب hub360 (شريط + قائمة + عدّاد) — نفس قائمة المنتجات/الأكاديمية */
  const SHOP_CATEGORIES = [
    { id: 'الكل', name: 'كل المنتجات', icon: 'fa-border-all' },
    { id: 'إي آر بي', name: 'إي آر بي', icon: 'fa-sitemap' },
    { id: 'نايس', name: 'نايس', icon: 'fa-chart-line' },
    { id: 'فيت', name: 'فيت', icon: 'fa-dumbbell' },
    { id: 'أكاديمية', name: 'أكاديمية', icon: 'fa-graduation-cap' },
    { id: 'قانونية', name: 'قانونية', icon: 'fa-gavel' },
    { id: 'تشغيل', name: 'تشغيل', icon: 'fa-gears' },
    { id: 'حوكمة', name: 'حوكمة', icon: 'fa-shield-halved' },
    { id: 'بيانات', name: 'بيانات', icon: 'fa-chart-pie' },
    { id: 'مالية', name: 'مالية', icon: 'fa-coins' },
    { id: 'إعلانات', name: 'إعلانات', icon: 'fa-rectangle-ad' },
    { id: 'فعاليات', name: 'فعاليات', icon: 'fa-calendar-days' },
    { id: 'تكامل', name: 'تكامل', icon: 'fa-plug' },
    { id: 'موارد', name: 'موارد', icon: 'fa-users-gear' },
    { id: 'تسويق', name: 'تسويق', icon: 'fa-bullhorn' },
    { id: 'مبيعات', name: 'مبيعات', icon: 'fa-handshake' },
    { id: 'خدمات', name: 'خدمات', icon: 'fa-concierge-bell' },
  ];

  /** مواقع البيع المباشر القابلة للربط بالمتجر */
  const MARKETPLACE_CONNECTORS = [
    { id: 'amazon', name: 'Amazon', nameAr: 'أمازون', icon: 'fa-brands fa-amazon', color: '#ff9900', placeholder: 'https://www.amazon.com/dp/...' },
    { id: 'alibaba', name: 'Alibaba', nameAr: 'علي بابا', icon: 'fa-brands fa-alipay', color: '#ff6a00', placeholder: 'https://www.alibaba.com/product-detail/...' },
    { id: 'temu', name: 'Temu', nameAr: 'تيمو', icon: 'fa-bag-shopping', color: '#fb7701', placeholder: 'https://www.temu.com/...' },
    { id: 'shein', name: 'Shein', nameAr: 'شي إن', icon: 'fa-shirt', color: '#000000', placeholder: 'https://www.shein.com/...' },
    { id: 'noon', name: 'Noon', nameAr: 'نون', icon: 'fa-sun', color: '#f3ea48', placeholder: 'https://www.noon.com/...' },
    { id: 'ebay', name: 'eBay', nameAr: 'إيباي', icon: 'fa-brands fa-ebay', color: '#e53238', placeholder: 'https://www.ebay.com/itm/...' },
    { id: 'etsy', name: 'Etsy', nameAr: 'إيتسي', icon: 'fa-brands fa-etsy', color: '#f56400', placeholder: 'https://www.etsy.com/listing/...' },
    { id: 'custom', name: 'Other', nameAr: 'أي متجر كبير', icon: 'fa-store', color: '#dc2626', placeholder: 'https://...' },
  ];

  const storeCategoryOptions = () =>
    SHOP_CATEGORIES.filter((c) => c.id !== 'الكل').map((c) => ({ value: c.id, label: c.name }));

  const marketplaceOptions = () =>
    MARKETPLACE_CONNECTORS.map((m) => ({ value: m.id, label: `${m.nameAr} (${m.name})` }));

  /** أنواع منتجات نايوش: رقمية · خدمية · عينية */
  const PRODUCT_TYPES = [
    { value: 'رقمية', label: 'رقمية', icon: 'fa-cloud' },
    { value: 'خدمية', label: 'خدمية', icon: 'fa-concierge-bell' },
    { value: 'عينية', label: 'عينية', icon: 'fa-box' },
  ];

  /** تصنيفات فرعية حسب التصنيف الرئيسي */
  const PRODUCT_SUBCATEGORIES = {
    'إي آر بي': ['رخص', 'وحدات', 'فروع', 'مخزون'],
    'نايس': ['لوحات', 'تنبيهات', 'تكامل عملاء'],
    'فيت': ['اشتراكات', 'برامج', 'بطاقات'],
    'أكاديمية': ['دورات', 'ورش', 'شهادات', 'مسارات'],
    'قانونية': ['عقود', 'قضايا', 'امتثال'],
    'تشغيل': ['رخص تشغيل', 'لوحات قيادة', 'باقات'],
    'حوكمة': ['سياسات', 'جودة', 'رقابة'],
    'بيانات': ['تحليلات', 'تقارير', 'محركات'],
    'مالية': ['محاسبة', 'فواتير', 'اشتراكات شهرية'],
    'إعلانات': ['حملات', 'بطاقات ظهور', 'ميزانيات'],
    'فعاليات': ['تذاكر', 'بث', 'استضافة'],
    'تكامل': ['موصلات', 'واجهات API', 'مزامنة'],
    'موارد': ['قوى عاملة', 'توظيف', 'تدريب'],
    'تسويق': ['هوية', 'حملات', 'محتوى'],
    'مبيعات': ['باقات عملاء', 'CRM', 'عروض'],
    'خدمات': ['استشارات', 'دعم', 'تشغيل مفوّض'],
  };

  /** أماكن ظهور الإعلان — اختيار متعدد */
  const AD_APPEARANCE_PLACES = [
    { id: 'home', nameAr: 'الصفحة الرئيسية', icon: 'fa-house' },
    { id: 'products', nameAr: 'صفحة المنتجات', icon: 'fa-boxes-stacked' },
    { id: 'store', nameAr: 'المتجر', icon: 'fa-bag-shopping' },
    { id: 'ads', nameAr: 'استوديو الإعلانات', icon: 'fa-rectangle-ad' },
    { id: 'events', nameAr: 'الفعاليات', icon: 'fa-calendar-days' },
    { id: 'platforms', nameAr: 'المنصات', icon: 'fa-layer-group' },
    { id: 'branches', nameAr: 'الفروع', icon: 'fa-code-branch' },
    { id: 'incubators', nameAr: 'الحاضنات', icon: 'fa-seedling' },
    { id: 'dashboard', nameAr: 'غرفة العمليات', icon: 'fa-satellite-dish' },
    { id: 'apps', nameAr: 'سجل الأنظمة', icon: 'fa-cubes' },
  ];

  /** نطاقات رفع الإعلان — رئيسية · فروع · حاضنات · منصات */
  const AD_PUBLISH_SCOPES = [
    { id: 'home', nameAr: 'الصفحة الرئيسية', icon: 'fa-house' },
    { id: 'branches', nameAr: 'الفروع', icon: 'fa-code-branch' },
    { id: 'incubators', nameAr: 'الحاضنات', icon: 'fa-seedling' },
    { id: 'platforms', nameAr: 'المنصات', icon: 'fa-layer-group' },
  ];

  /** منصات التواصل الخاصة بنايوش هوب — اختيار واحد أو أكثر أو الكل */
  const HUB_SOCIAL_PLATFORMS = [
    { id: 'all', nameAr: 'كل المنصات', icon: 'fa-share-nodes' },
    { id: 'facebook', nameAr: 'فيسبوك نايوش', icon: 'fa-brands fa-facebook' },
    { id: 'instagram', nameAr: 'إنستغرام نايوش', icon: 'fa-brands fa-instagram' },
    { id: 'x', nameAr: 'منصة X نايوش', icon: 'fa-brands fa-x-twitter' },
    { id: 'linkedin', nameAr: 'لينكدإن نايوش', icon: 'fa-brands fa-linkedin' },
    { id: 'youtube', nameAr: 'يوتيوب نايوش', icon: 'fa-brands fa-youtube' },
    { id: 'tiktok', nameAr: 'تيك توك نايوش', icon: 'fa-brands fa-tiktok' },
    { id: 'whatsapp', nameAr: 'واتساب نايوش', icon: 'fa-brands fa-whatsapp' },
    { id: 'telegram', nameAr: 'تيليجرام نايوش', icon: 'fa-brands fa-telegram' },
  ];

  const subcategoriesFor = (category) => PRODUCT_SUBCATEGORIES[category] || [];

  /** كتالوج المنتجات للعرض الشبكي */
  const PRODUCT_CATALOG = [
    { id: 'pr-erp-1', sku: 'NH-ERP-010', name: 'وحدة نايوش إي آر بي الكاملة', brand: 'نايوش إي آر بي', platform: 'إدارة الموارد', category: 'إي آر بي', price: 4800, stock: 22, sold: 51, status: 'متوفر', movement: 'متوسط', icon: 'fa-sitemap' },
    { id: 'pr-erp-2', sku: 'NH-ERP-011', name: 'رخصة إي آر بي للفروع', brand: 'نايوش إي آر بي', platform: 'إدارة الموارد', category: 'إي آر بي', price: 3200, stock: 40, sold: 88, status: 'متوفر', movement: 'سريع', icon: 'fa-building' },
    { id: 'pr-erp-3', sku: 'NH-ERP-012', name: 'وحدة المخزون والمبيعات', brand: 'نايوش إي آر بي', platform: 'إدارة الموارد', category: 'إي آر بي', price: 2100, stock: 55, sold: 120, status: 'متوفر', movement: 'سريع', icon: 'fa-boxes-stacked' },
    { id: 'pr-nais-1', sku: 'NH-NAIS-001', name: 'نايس — لوحة القرار اللحظي', brand: 'نايس', platform: 'ذكاء التشغيل', category: 'نايس', price: 3900, stock: 30, sold: 64, status: 'متوفر', movement: 'سريع', icon: 'fa-chart-line' },
    { id: 'pr-nais-2', sku: 'NH-NAIS-002', name: 'نايس — جسر العملاء والعمليات', brand: 'نايس', platform: 'ذكاء التشغيل', category: 'نايس', price: 2750, stock: 48, sold: 91, status: 'متوفر', movement: 'متوسط', icon: 'fa-bolt' },
    { id: 'pr-nais-3', sku: 'NH-NAIS-003', name: 'نايس — تنبيهات النمو', brand: 'نايس', platform: 'ذكاء التشغيل', category: 'نايس', price: 1450, stock: 70, sold: 150, status: 'متوفر', movement: 'سريع', icon: 'fa-bell' },
    { id: 'pr-fit-1', sku: 'NH-FIT-055', name: 'اشتراك نايوش فيت للفروع', brand: 'نايوش فيت', platform: 'الصحة واللياقة', category: 'فيت', price: 990, stock: 160, sold: 420, status: 'متوفر', movement: 'سريع', icon: 'fa-dumbbell' },
    { id: 'pr-fit-2', sku: 'NH-FIT-056', name: 'فيت — برامج اللياقة الجماعية', brand: 'نايوش فيت', platform: 'الصحة واللياقة', category: 'فيت', price: 1250, stock: 90, sold: 210, status: 'متوفر', movement: 'سريع', icon: 'fa-heart-pulse' },
    { id: 'pr-fit-3', sku: 'NH-FIT-057', name: 'فيت — بطاقة اشتراك سنوية', brand: 'نايوش فيت', platform: 'الصحة واللياقة', category: 'فيت', price: 2800, stock: 65, sold: 98, status: 'متوفر', movement: 'متوسط', icon: 'fa-id-card' },
    { id: 'pr-ac-1', sku: 'NH-ACD-001', name: 'أكاديمية نايوش — مسار تشغيلي', brand: 'أكاديمية نايوش', platform: 'التعليم والتدريب', category: 'أكاديمية', price: 650, stock: 220, sold: 510, status: 'متوفر', movement: 'سريع', icon: 'fa-graduation-cap' },
    { id: 'pr-ac-2', sku: 'NH-ACD-002', name: 'دورة حوكمة معتمدة', brand: 'أكاديمية نايوش', platform: 'التعليم والتدريب', category: 'أكاديمية', price: 890, stock: 140, sold: 260, status: 'متوفر', movement: 'سريع', icon: 'fa-certificate' },
    { id: 'pr-ac-3', sku: 'NH-ACD-003', name: 'ورشة المدربين السياديين', brand: 'أكاديمية نايوش', platform: 'التعليم والتدريب', category: 'أكاديمية', price: 1200, stock: 80, sold: 145, status: 'متوفر', movement: 'متوسط', icon: 'fa-chalkboard-user' },
    { id: 'pr-law-1', sku: 'NH-LAW-101', name: 'رخصة نايوش لو المهنية', brand: 'نايوش لو', platform: 'النظام القانوني', category: 'قانونية', price: 3200, stock: 44, sold: 98, status: 'متوفر', movement: 'متوسط', icon: 'fa-gavel' },
    { id: 'pr-law-2', sku: 'NH-LAW-102', name: 'حزمة العقود الرقمية', brand: 'نايوش لو', platform: 'النظام القانوني', category: 'قانونية', price: 1800, stock: 70, sold: 132, status: 'متوفر', movement: 'سريع', icon: 'fa-file-contract' },
    { id: 'pr-law-3', sku: 'NH-LAW-103', name: 'إدارة القضايا والامتثال', brand: 'نايوش لو', platform: 'النظام القانوني', category: 'قانونية', price: 4100, stock: 28, sold: 54, status: 'متوفر', movement: 'متوسط', icon: 'fa-scale-balanced' },
    { id: 'pr-1', sku: 'NH-UOS-001', name: 'رخصة تشغيل هوب الأساسية', brand: 'نايوش هوب', platform: 'النظام التشغيلي الموحد', category: 'تشغيل', price: 2500, stock: 120, sold: 340, status: 'متوفر', movement: 'سريع', icon: 'fa-brain' },
    { id: 'pr-3', sku: 'NH-CCS-003', name: 'لوحة غرفة القيادة', brand: 'نايوش سيطرة', platform: 'التحكم الكوني', category: 'تشغيل', price: 4200, stock: 40, sold: 96, status: 'متوفر', movement: 'سريع', icon: 'fa-satellite-dish' },
    { id: 'pr-5', sku: 'NH-NERP-008', name: 'وحدة الموارد المؤسسية', brand: 'نايوش موارد', platform: 'نظام إدارة الموارد', category: 'تشغيل', price: 3100, stock: 66, sold: 210, status: 'متوفر', movement: 'سريع', icon: 'fa-building' },
    { id: 'pr-2', sku: 'NH-KMS-014', name: 'حزمة سياسات الدستور', brand: 'نايوش معرفة', platform: 'إدارة المعرفة والدستور', category: 'حوكمة', price: 780, stock: 85, sold: 190, status: 'متوفر', movement: 'متوسط', icon: 'fa-book-open' },
    { id: 'pr-7', sku: 'NH-NQMS-005', name: 'درع الجودة والامتثال', brand: 'نايوش جودة', platform: 'الجودة والامتثال', category: 'حوكمة', price: 1450, stock: 70, sold: 132, status: 'متوفر', movement: 'متوسط', icon: 'fa-shield-halved' },
    { id: 'pr-18', sku: 'NH-NGS-006', name: 'حزمة الرقابة العليا', brand: 'نايوش حوكمة', platform: 'الحوكمة والرقابة', category: 'حوكمة', price: 3400, stock: 32, sold: 67, status: 'منخفض', movement: 'بطيء', icon: 'fa-scale-balanced' },
    { id: 'pr-4', sku: 'NH-NAI-021', name: 'محرك تنبؤ تشغيلي', brand: 'نايوش ذكاء', platform: 'محرك الذكاء الاصطناعي', category: 'بيانات', price: 5600, stock: 28, sold: 74, status: 'منخفض', movement: 'متوسط', icon: 'fa-robot' },
    { id: 'pr-14', sku: 'NH-NDS-009', name: 'لوحة تحليل المبيعات', brand: 'نايوش بيانات', platform: 'البيانات والتحليل', category: 'بيانات', price: 2100, stock: 47, sold: 155, status: 'متوفر', movement: 'سريع', icon: 'fa-chart-pie' },
    { id: 'pr-15', sku: 'NH-NFS-012', name: 'اشتراك المحاسبة الشهرية', brand: 'نايوش مالية', platform: 'المالية والمحاسبة', category: 'مالية', price: 1600, stock: 110, sold: 290, status: 'متوفر', movement: 'سريع', icon: 'fa-coins' },
    { id: 'pr-21', sku: 'NH-ADS-077', name: 'بطاقة إعلان منتج منصة', brand: 'استوديو الإعلانات', platform: 'استوديو الإعلانات', category: 'إعلانات', price: 450, stock: 300, sold: 680, status: 'متوفر', movement: 'سريع', icon: 'fa-rectangle-ad' },
    { id: 'pr-22', sku: 'NH-EVT-088', name: 'تذكرة فعالية مباشرة', brand: 'استوديو الفعاليات', platform: 'استوديو الفعاليات', category: 'فعاليات', price: 350, stock: 500, sold: 920, status: 'متوفر', movement: 'سريع', icon: 'fa-ticket' },
    { id: 'pr-17', sku: 'NH-NIS-001', name: 'موصل تكامل الأنظمة', brand: 'نايوش تكامل', platform: 'التكامل والربط', category: 'تكامل', price: 2100, stock: 55, sold: 142, status: 'متوفر', movement: 'سريع', icon: 'fa-plug' },
    { id: 'pr-6', sku: 'NH-NHR-011', name: 'باقة ضبط القوى العاملة', brand: 'نايوش موارد بشرية', platform: 'الموارد البشرية السيادية', category: 'موارد', price: 1800, stock: 95, sold: 260, status: 'متوفر', movement: 'سريع', icon: 'fa-users-gear' },
    { id: 'pr-13', sku: 'NH-NMS-033', name: 'حملة هوية المنصة', brand: 'نايوش تسويق', platform: 'التسويق والهوية', category: 'تسويق', price: 1500, stock: 60, sold: 240, status: 'متوفر', movement: 'سريع', icon: 'fa-bullhorn' },
    { id: 'pr-24', sku: 'NH-CRM-030', name: 'باقة علاقات العملاء', brand: 'نايوش عملاء', platform: 'إدارة علاقات العملاء', category: 'مبيعات', price: 1700, stock: 64, sold: 133, status: 'متوفر', movement: 'متوسط', icon: 'fa-handshake' },
  ];

  const PRODUCT_BRANDS = ['الكل', ...Array.from(new Set(PRODUCT_CATALOG.map((p) => p.brand)))];
  const PRODUCT_CATEGORIES = ['الكل', ...Array.from(new Set(PRODUCT_CATALOG.map((p) => p.category)))];

  window.HubMarketplaceData = {
    APPS,
    STORE_ITEMS,
    ADS,
    EVENTS,
    AD_CATEGORIES,
    STORE_CATEGORIES,
    SHOP_CATEGORIES,
    MARKETPLACE_CONNECTORS,
    PRODUCT_CATALOG,
    PRODUCT_BRANDS,
    PRODUCT_CATEGORIES,
    PRODUCT_TYPES,
    PRODUCT_SUBCATEGORIES,
    AD_APPEARANCE_PLACES,
    AD_PUBLISH_SCOPES,
    HUB_SOCIAL_PLATFORMS,
    storeCategoryOptions,
    marketplaceOptions,
    subcategoriesFor,
    uid,
  };
})();
