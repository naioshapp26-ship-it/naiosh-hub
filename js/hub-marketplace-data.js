(() => {
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const APPS = [
    { code: 'UOS', nameAr: 'النظام التشغيلي الموحد', kind: 'sovereign', category: 'نواة', url: 'platforms.html', icon: 'fa-brain', status: 'active' },
    { code: 'KMS', nameAr: 'إدارة المعرفة والدستور', kind: 'sovereign', category: 'نواة', url: 'platforms.html', icon: 'fa-book-open', status: 'active' },
    { code: 'CCS', nameAr: 'التحكم الكوني', kind: 'sovereign', category: 'نواة', url: 'platforms.html', icon: 'fa-satellite-dish', status: 'active' },
    { code: 'NAI', nameAr: 'محرك الذكاء الاصطناعي', kind: 'sovereign', category: 'نواة', url: 'platforms.html', icon: 'fa-robot', status: 'active' },
    { code: 'NERP', nameAr: 'نظام إدارة الموارد', kind: 'sovereign', category: 'تشغيل', url: 'platforms.html', icon: 'fa-building', status: 'active' },
    { code: 'NHR', nameAr: 'الموارد البشرية السيادية', kind: 'sovereign', category: 'تشغيل', url: 'platforms.html', icon: 'fa-users-gear', status: 'active' },
    { code: 'NQMS', nameAr: 'الجودة والامتثال', kind: 'sovereign', category: 'حوكمة', url: 'platforms.html', icon: 'fa-shield-halved', status: 'active' },
    { code: 'NIMS', nameAr: 'إدارة الحوادث والطوارئ', kind: 'sovereign', category: 'حوكمة', url: 'platforms.html', icon: 'fa-triangle-exclamation', status: 'active' },
    { code: 'NAMS', nameAr: 'إدارة الأصول', kind: 'sovereign', category: 'تشغيل', url: 'platforms.html', icon: 'fa-boxes-stacked', status: 'active' },
    { code: 'NEMS', nameAr: 'التعليم والتدريب', kind: 'sovereign', category: 'نمو', url: 'platforms.html', icon: 'fa-graduation-cap', status: 'active' },
    { code: 'NTS', nameAr: 'النقل والمركبات', kind: 'sovereign', category: 'تشغيل', url: 'platforms.html', icon: 'fa-truck-fast', status: 'active' },
    { code: 'NCS', nameAr: 'الاتصال المؤسسي', kind: 'sovereign', category: 'نمو', url: 'platforms.html', icon: 'fa-tower-broadcast', status: 'active' },
    { code: 'NMS', nameAr: 'التسويق والهوية', kind: 'sovereign', category: 'نمو', url: 'platforms.html', icon: 'fa-bullhorn', status: 'active' },
    { code: 'NDS', nameAr: 'البيانات والتحليل', kind: 'sovereign', category: 'نواة', url: 'platforms.html', icon: 'fa-chart-pie', status: 'active' },
    { code: 'NFS', nameAr: 'المالية والمحاسبة', kind: 'sovereign', category: 'تشغيل', url: 'platforms.html', icon: 'fa-coins', status: 'active' },
    { code: 'NOPS', nameAr: 'العمليات التشغيلية', kind: 'sovereign', category: 'تشغيل', url: 'platforms.html', icon: 'fa-gears', status: 'active' },
    { code: 'NIS', nameAr: 'التكامل والربط', kind: 'sovereign', category: 'نواة', url: 'platforms.html', icon: 'fa-network-wired', status: 'active' },
    { code: 'NGS', nameAr: 'الحوكمة والرقابة', kind: 'sovereign', category: 'حوكمة', url: 'platforms.html', icon: 'fa-scale-balanced', status: 'active' },
    { code: 'LAW', nameAr: 'نايوش لو — النظام القانوني', kind: 'system', category: 'أنظمة نايوش', url: 'apps.html#law', icon: 'fa-gavel', status: 'active' },
    { code: 'FIT', nameAr: 'نايوش فيت — الصحة واللياقة', kind: 'system', category: 'أنظمة نايوش', url: 'apps.html#fit', icon: 'fa-dumbbell', status: 'active' },
    { code: 'ERP', nameAr: 'نايوش إي آر بي', kind: 'system', category: 'أنظمة نايوش', url: 'apps.html#erp', icon: 'fa-sitemap', status: 'active' },
    { code: 'ACADEMY', nameAr: 'أكاديمية نايوش', kind: 'system', category: 'أنظمة نايوش', url: 'apps.html#academy', icon: 'fa-chalkboard-user', status: 'active' },
    { code: 'ADS', nameAr: 'استوديو الإعلانات', kind: 'studio', category: 'استوديوهات هوب', url: 'ads.html', icon: 'fa-rectangle-ad', status: 'active' },
    { code: 'EVENTS', nameAr: 'استوديو الفعاليات', kind: 'studio', category: 'استوديوهات هوب', url: 'events.html', icon: 'fa-calendar-days', status: 'active' },
    { code: 'STORE', nameAr: 'متجر المبيعات', kind: 'studio', category: 'استوديوهات هوب', url: 'store.html', icon: 'fa-bag-shopping', status: 'active' },
    { code: 'LMS', nameAr: 'نظام التعلم', kind: 'system', category: 'أنظمة نايوش', url: 'apps.html#lms', icon: 'fa-laptop-code', status: 'active' },
    { code: 'CRM', nameAr: 'إدارة علاقات العملاء', kind: 'system', category: 'أنظمة نايوش', url: 'apps.html#crm', icon: 'fa-handshake', status: 'building' },
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
  ];

  const ADS = [
    { id: 'ad-1', title: 'عرض تفعيل النظام التشغيلي', content: 'فعّل منصتك السيادية خلال 24 ساعة مع دعم غرفة العمليات.', price: 2500, category: 'تشغيل', platformCode: 'UOS', productId: 'st-1', views: 1840, status: 'active', level: 'مرتفع', type: 'منتج منصة' },
    { id: 'ad-2', title: 'دورة الحوكمة للمنصات', content: 'برنامج امتثال وجودة معتمد من نايوش.', price: 890, category: 'تعليم', platformCode: 'NEMS', productId: 'st-2', views: 960, status: 'active', level: 'متوسط', type: 'منتج منصة' },
    { id: 'ad-3', title: 'نايوش لو للمحاماة الرقمية', content: 'إدارة العقود والقضايا داخل هوب.', price: 3200, category: 'قانون', platformCode: 'LAW', productId: 'st-7', views: 1220, status: 'active', level: 'مرتفع', type: 'منتج منصة' },
    { id: 'ad-4', title: 'فعالية القمة التشغيلية', content: 'احجز مقعدك في فعالية القيادة العليا.', price: 350, category: 'فعاليات', platformCode: 'EVENTS', productId: 'st-4', views: 2100, status: 'active', level: 'مرتفع', type: 'فعالية' },
    { id: 'ad-5', title: 'حزمة الموارد البشرية', content: 'ضبط العنصر البشري لمنصتك فورًا.', price: 1800, category: 'موارد', platformCode: 'NHR', productId: 'st-6', views: 740, status: 'active', level: 'متوسط', type: 'منتج منصة' },
    { id: 'ad-6', title: 'تحليلات البيانات اللحظية', content: 'لوحات سيادية لاتخاذ القرار.', price: 1200, category: 'بيانات', platformCode: 'NDS', productId: 'st-5', views: 1580, status: 'active', level: 'مرتفع', type: 'منتج منصة' },
    { id: 'ad-7', title: 'نايوش فيت للفروع', content: 'اشتراكات صحية متكاملة للموظفين.', price: 990, category: 'صحة', platformCode: 'FIT', productId: 'st-9', views: 680, status: 'paused', level: 'منخفض', type: 'منتج منصة' },
    { id: 'ad-8', title: 'باقة التكامل بين الأنظمة', content: 'اربط أي نظام نايوش بهوب عبر طبقة التكامل.', price: 2100, category: 'تكامل', platformCode: 'NIS', productId: 'st-8', views: 910, status: 'active', level: 'مرتفع', type: 'منتج منصة' },
    { id: 'ad-9', title: 'استضافة بث فعالية', content: 'قاعة افتراضية جاهزة للفعاليات الكبرى.', price: 2700, category: 'فعاليات', platformCode: 'EVENTS', productId: 'st-12', views: 430, status: 'active', level: 'متوسط', type: 'فعالية' },
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

  const STORE_CATEGORIES = ['الكل', 'تشغيل', 'تعليم', 'إعلانات', 'فعاليات', 'بيانات', 'موارد', 'قانون', 'صحة', 'تكامل', 'مالية'];

  window.HubMarketplaceData = {
    APPS,
    STORE_ITEMS,
    ADS,
    EVENTS,
    AD_CATEGORIES,
    STORE_CATEGORIES,
    uid,
  };
})();
