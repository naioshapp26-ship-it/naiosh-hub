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
    { code: 'NAIS', nameAr: 'نايس — ذكاء التشغيل', kind: 'system', category: 'أنظمة نايوش', url: 'apps.html#nais', icon: 'fa-chart-line', status: 'active' },
    { code: 'FIT', nameAr: 'نايوش فيت — الصحة واللياقة', kind: 'system', category: 'أنظمة نايوش', url: 'apps.html#fit', icon: 'fa-dumbbell', status: 'active' },
    { code: 'ERP', nameAr: 'نايوش إي آر بي', kind: 'system', category: 'أنظمة نايوش', url: 'apps.html#erp', icon: 'fa-sitemap', status: 'active' },
    { code: 'ACADEMY', nameAr: 'أكاديمية نايوش', kind: 'system', category: 'أنظمة نايوش', url: 'apps.html#academy', icon: 'fa-chalkboard-user', status: 'active' },
    { code: 'ADS', nameAr: 'استوديو الإعلانات', kind: 'studio', category: 'استوديوهات هوب', url: 'ads.html', icon: 'fa-rectangle-ad', status: 'active' },
    { code: 'EVENTS', nameAr: 'استوديو الفعاليات', kind: 'studio', category: 'استوديوهات هوب', url: 'events.html', icon: 'fa-calendar-days', status: 'active' },
    { code: 'STORE', nameAr: 'متجر المبيعات', kind: 'studio', category: 'استوديوهات هوب', url: 'store.html', icon: 'fa-bag-shopping', status: 'active' },
    { code: 'PRODUCTS', nameAr: 'عرض المنتجات', kind: 'studio', category: 'استوديوهات هوب', url: 'products.html', icon: 'fa-boxes-stacked', status: 'active' },
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

  /** تصنيفات المتجر — أسلوب hub360 (شريط + قائمة + عدّاد) */
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
  ];

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
    PRODUCT_CATALOG,
    PRODUCT_BRANDS,
    PRODUCT_CATEGORIES,
    uid,
  };
})();
