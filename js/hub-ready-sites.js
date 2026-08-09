/**
 * المواقع الجاهزة المعروضة في هوب — اضغط تدخل مباشرة
 * كونزو مستبعد من المنتجات والعرض
 */
(() => {
  const EXCLUDED = new Set(['كونزو', 'كونزوو', 'konzoo', 'conzoo', 'konzo', 'KONZOO', 'CONZOO']);

  const isExcluded = (name = '') => {
    const n = String(name).trim().toLowerCase();
    if (!n) return false;
    if (EXCLUDED.has(n) || EXCLUDED.has(String(name).trim())) return true;
    return [...EXCLUDED].some((x) => n.includes(String(x).toLowerCase()));
  };

  /** مواقع جاهزة — كلها ما عدا كونزو */
  const READY_SITES = [
    {
      id: 'erp',
      nameAr: 'نايوش إي آر بي',
      tag: 'نظام تشغيل مؤسسي',
      desc: 'المبيعات · المخزون · المالية · الموارد — اضغط وادخل فورًا.',
      href: 'https://web-production-419e2.up.railway.app/',
      launchCode: 'ERP',
      live: true,
      icon: 'fa-sitemap',
      tone: 'erp',
      inProducts: true,
      inGallery: true,
      /** وجه الموقع الحقيقي + اللوجو في المعرض والمنتجات */
      face: 'assets/systems/erp-face.png',
      logo: 'assets/systems/erp-logo.png',
      preview: [
        { icon: 'fa-sitemap', label: 'الموارد' },
        { icon: 'fa-boxes-stacked', label: 'المخزون' },
        { icon: 'fa-coins', label: 'المالية' },
      ],
      kpi: [
        { b: '١٢٤', s: 'طلب' },
        { b: '٨٨٪', s: 'جاهزية' },
      ],
      bar: 'نايوش إي آر بي',
      barSub: 'لوحة التشغيل',
    },
    {
      id: 'nais',
      nameAr: 'نايس',
      tag: 'ذكاء وتشغيل',
      desc: 'رؤية لحظية للعمليات والعملاء — ادخل واشتغل مباشرة.',
      href: 'https://nais-production.up.railway.app/',
      launchCode: 'NAIS',
      live: true,
      icon: 'fa-chart-line',
      tone: 'nais',
      inProducts: true,
      inGallery: true,
      face: 'assets/systems/nais-face.png',
      logo: 'assets/systems/nais-logo.png',
      preview: [
        { icon: 'fa-chart-line', label: 'تحليلات' },
        { icon: 'fa-bolt', label: 'تنبيهات' },
        { icon: 'fa-handshake', label: 'عملاء' },
      ],
      kpi: [
        { b: '٣٦٠', s: 'رؤية' },
        { b: '٩٤٪', s: 'دقة' },
      ],
      bar: 'نايس',
      barSub: 'مؤشرات النمو',
    },
    {
      id: 'fit',
      nameAr: 'نايوش فيت',
      tag: 'صحة ولياقة',
      desc: 'اشتراكات وبرامج ومتابعة — اضغط للدخول للموقع الجاهز.',
      href: 'https://naioshfit-production-f0b4.up.railway.app/',
      launchCode: 'FIT',
      live: true,
      icon: 'fa-dumbbell',
      tone: 'fit',
      inProducts: true,
      inGallery: true,
      face: 'assets/systems/fit-face.png',
      logo: 'assets/systems/fit-logo.png',
      preview: [
        { icon: 'fa-dumbbell', label: 'البرامج' },
        { icon: 'fa-heart-pulse', label: 'المتابعة' },
        { icon: 'fa-id-card', label: 'الاشتراكات' },
      ],
      kpi: [
        { b: '٢٫١ك', s: 'عضو' },
        { b: '٧٦٪', s: 'التزام' },
      ],
      bar: 'نايوش فيت',
      barSub: 'لوحة اللياقة',
    },
    {
      id: 'academy',
      nameAr: 'أكاديمية نايوش',
      tag: 'تعليم وتأهيل',
      desc: 'دورات وشهادات ومسارات — ادخل الأكاديمية فورًا.',
      href: 'https://betacdmy-production.up.railway.app/',
      launchCode: 'ACADEMY',
      live: true,
      icon: 'fa-chalkboard-user',
      tone: 'academy',
      inProducts: true,
      inGallery: true,
      face: 'assets/systems/academy-face.png',
      logo: 'assets/systems/academy-logo.png',
      preview: [
        { icon: 'fa-graduation-cap', label: 'الدورات' },
        { icon: 'fa-certificate', label: 'الشهادات' },
        { icon: 'fa-route', label: 'المسارات' },
      ],
      kpi: [
        { b: '٤٨', s: 'دورة' },
        { b: '١٫٢ك', s: 'متدرب' },
      ],
      bar: 'أكاديمية نايوش',
      barSub: 'مسارات التدريب',
    },
    {
      id: 'law',
      nameAr: 'نايوش لو',
      tag: 'قانوني',
      desc: 'عقود وقضايا وامتثال — اضغط وادخل النظام القانوني.',
      href: 'https://naiosh-law-production.up.railway.app/',
      launchCode: 'LAW',
      live: true,
      icon: 'fa-gavel',
      tone: 'law',
      inProducts: true,
      inGallery: true,
      face: 'assets/systems/law-face.png',
      logo: 'assets/systems/law-logo.png',
      preview: [
        { icon: 'fa-gavel', label: 'القضايا' },
        { icon: 'fa-file-contract', label: 'العقود' },
        { icon: 'fa-shield-halved', label: 'الامتثال' },
      ],
      kpi: [
        { b: '٣١٢', s: 'قضية' },
        { b: '٦٧', s: 'عقد' },
      ],
      bar: 'نايوش لو',
      barSub: 'الملفات القانونية',
    },
    {
      id: 'smartx',
      nameAr: 'سمارتكس',
      tag: 'اجتماعات وقاعات',
      desc: 'قاعات افتراضية واجتماعات تفاعلية — ادخل سمارتكس فورًا.',
      href: 'https://smrttx.com/',
      launchCode: 'SMARTX',
      live: true,
      icon: 'fa-video',
      tone: 'smartx',
      inProducts: true,
      inGallery: true,
      face: 'assets/systems/smartx-face.png',
      logo: 'assets/systems/smartx-logo.png',
      preview: [
        { icon: 'fa-video', label: 'القاعات' },
        { icon: 'fa-desktop', label: 'مشاركة' },
        { icon: 'fa-chalkboard', label: 'سبورة' },
      ],
      kpi: [
        { b: 'حي', s: 'مباشر' },
        { b: 'SSO', s: 'هوب' },
      ],
      bar: 'سمارتكس',
      barSub: 'smrttx.com',
    },
    {
      id: 'edusmartx',
      nameAr: 'إيديو سمارتكس',
      tag: 'تعليم ذكي',
      desc: 'إدارة أنظمة تعليمية متكاملة — اضغط وادخل إيديو سمارتكس.',
      href: 'https://edusmrttx.com/',
      launchCode: 'EDUSMARTX',
      live: true,
      icon: 'fa-graduation-cap',
      tone: 'edusmartx',
      inProducts: true,
      inGallery: true,
      face: 'assets/systems/edusmartx-face.png',
      logo: 'assets/systems/edusmartx-logo.png',
      preview: [
        { icon: 'fa-users', label: 'الطلاب' },
        { icon: 'fa-book', label: 'المحتوى' },
        { icon: 'fa-chart-column', label: 'التقدم' },
      ],
      kpi: [
        { b: 'LMS', s: 'منصة' },
        { b: 'حي', s: 'مباشر' },
      ],
      bar: 'إيديو سمارتكس',
      barSub: 'edusmrttx.com',
    },
    {
      id: 'edunaiosh',
      nameAr: 'نايوش',
      tag: 'مناهج ودورات',
      desc: 'مناهج ودورات تعليمية — ادخل موقع نايوش مباشرة.',
      href: 'https://edunaiosh.com/',
      launchCode: 'EDUNAIOSH',
      live: true,
      icon: 'fa-book-open-reader',
      tone: 'edunaiosh',
      inProducts: true,
      inGallery: true,
      face: 'assets/systems/edunaiosh-face.png',
      logo: 'assets/systems/edunaiosh-logo.png',
      preview: [
        { icon: 'fa-book-open', label: 'المناهج' },
        { icon: 'fa-graduation-cap', label: 'الدورات' },
        { icon: 'fa-earth-americas', label: 'الدول' },
      ],
      kpi: [
        { b: '٧٫٩ك', s: 'دورة' },
        { b: 'حي', s: 'مباشر' },
      ],
      bar: 'نايوش',
      barSub: 'edunaiosh.com',
    },
    {
      id: 'lms',
      nameAr: 'نظام التعلم LMS',
      tag: 'تعليم رقمي',
      desc: 'مسارات ومحتوى وتقييم — ادخل مباشرة.',
      href: 'systems/lms.html?from=hub&return=index.html',
      launchCode: 'LMS',
      icon: 'fa-laptop-code',
      tone: 'hub',
      inProducts: true,
      inGallery: true,
      preview: [
        { icon: 'fa-route', label: 'المسارات' },
        { icon: 'fa-book', label: 'المحتوى' },
        { icon: 'fa-clipboard-check', label: 'التقييم' },
      ],
      kpi: [
        { b: '٩٠', s: 'مسار' },
        { b: '٦٦٪', s: 'إتمام' },
      ],
      bar: 'نايوش LMS',
      barSub: 'التعلم الرقمي',
    },
    {
      id: 'crm',
      nameAr: 'إدارة علاقات العملاء',
      tag: 'مبيعات وعملاء',
      desc: 'عملاء محتملون وخط مبيعات ودعم — ادخل فورًا.',
      href: 'systems/crm.html?from=hub&return=index.html',
      launchCode: 'CRM',
      icon: 'fa-handshake',
      tone: 'nais',
      inProducts: true,
      inGallery: true,
      preview: [
        { icon: 'fa-user-plus', label: 'المحتملون' },
        { icon: 'fa-filter', label: 'الخط' },
        { icon: 'fa-headset', label: 'الدعم' },
      ],
      kpi: [
        { b: '١٨٠', s: 'عميل' },
        { b: '٤٢', s: 'فرصة' },
      ],
      bar: 'نايوش CRM',
      barSub: 'علاقات العملاء',
    },
    {
      id: 'branches',
      nameAr: 'فرعي — الفروع',
      tag: 'موقع جاهز',
      desc: 'شبكة الفروع العالمية — اضغط وادخل صفحة الفروع.',
      href: 'branches.html',
      icon: 'fa-code-branch',
      tone: 'hub',
      inProducts: true,
      inGallery: true,
      sidebar: { label: 'فرعي', icon: 'fa-code-branch' },
      preview: [
        { icon: 'fa-globe', label: 'الدول' },
        { icon: 'fa-building', label: 'الفروع' },
        { icon: 'fa-map', label: 'الخريطة' },
      ],
      kpi: [
        { b: '٢٥+', s: 'دولة' },
        { b: '٩', s: 'فروع' },
      ],
      bar: 'الفروع',
      barSub: 'شبكة نايوش',
    },
    {
      id: 'incubators',
      nameAr: 'حاضنتي — الحاضنات',
      tag: 'موقع جاهز',
      desc: '١٠٠ حاضنة قطاعية — ادخل مباشرة.',
      href: 'incubators.html',
      icon: 'fa-seedling',
      tone: 'fit',
      inProducts: true,
      inGallery: true,
      sidebar: { label: 'حاضنتي', icon: 'fa-seedling' },
      preview: [
        { icon: 'fa-seedling', label: 'البرامج' },
        { icon: 'fa-users', label: 'الأعضاء' },
        { icon: 'fa-layer-group', label: 'المنصات' },
      ],
      kpi: [
        { b: '١٠٠', s: 'حاضنة' },
        { b: '١٢', s: 'قطاع' },
      ],
      bar: 'الحاضنات',
      barSub: 'برامج نايوش',
    },
    {
      id: 'platforms',
      nameAr: 'منصتي — المنصات',
      tag: 'موقع جاهز',
      desc: '١٨ منصة سيادية — اضغط للدخول.',
      href: 'platforms.html',
      icon: 'fa-layer-group',
      tone: 'erp',
      inProducts: true,
      inGallery: true,
      sidebar: { label: 'منصتي', icon: 'fa-layer-group' },
      preview: [
        { icon: 'fa-brain', label: 'النواة' },
        { icon: 'fa-gears', label: 'التشغيل' },
        { icon: 'fa-scale-balanced', label: 'الحوكمة' },
      ],
      kpi: [
        { b: '١٨', s: 'منصة' },
        { b: '٤', s: 'مجموعات' },
      ],
      bar: 'المنصات',
      barSub: 'نايوش 360',
    },
    {
      id: 'office',
      nameAr: 'مكتبي — المكتب الإلكتروني',
      tag: 'موقع جاهز',
      desc: 'مكتبك الإلكتروني — اختصارات مساحتك والأنظمة الحية.',
      href: 'office.html',
      icon: 'fa-briefcase',
      tone: 'hub',
      inProducts: true,
      inGallery: true,
      sidebar: { label: 'مكتبي', icon: 'fa-briefcase' },
      preview: [
        { icon: 'fa-briefcase', label: 'المكتب' },
        { icon: 'fa-key', label: 'الصلاحيات' },
        { icon: 'fa-chart-simple', label: 'التقارير' },
      ],
      kpi: [
        { b: '١', s: 'مكتب' },
        { b: 'SSO', s: 'دخول' },
      ],
      bar: 'مكتبي',
      barSub: 'مكتب إلكتروني',
    },
    {
      id: 'ads',
      nameAr: 'اعلاناتي — استوديو الإعلانات',
      tag: 'موقع جاهز',
      desc: 'ارفع إعلانك واظهره على الرئيسية والفروع والمنصات.',
      href: 'ads.html',
      icon: 'fa-bullhorn',
      tone: 'law',
      inProducts: true,
      inGallery: true,
      sidebar: { label: 'اعلاناتي', icon: 'fa-bullhorn' },
      preview: [
        { icon: 'fa-rectangle-ad', label: 'الحملات' },
        { icon: 'fa-eye', label: 'الظهور' },
        { icon: 'fa-share-nodes', label: 'النشر' },
      ],
      kpi: [
        { b: '١٢', s: 'إعلان' },
        { b: '٤', s: 'نطاق' },
      ],
      bar: 'الإعلانات',
      barSub: 'استوديو هوب',
    },
    {
      id: 'products',
      nameAr: 'منتجاتي — عرض المنتجات',
      tag: 'كتالوج',
      desc: 'كل المنتجات الجاهزة — اشتري أو ادخل الموقع المرتبط.',
      href: 'products.html',
      icon: 'fa-box-open',
      tone: 'hub',
      inProducts: false,
      inGallery: true,
      sidebar: { label: 'منتجاتي', icon: 'fa-box-open' },
      preview: [
        { icon: 'fa-magnifying-glass', label: 'بحث' },
        { icon: 'fa-tags', label: 'تصنيف' },
        { icon: 'fa-cart-shopping', label: 'شراء' },
      ],
      kpi: [
        { b: '٢٤+', s: 'منتج' },
        { b: '٧', s: 'أنظمة' },
      ],
      bar: 'المنتجات',
      barSub: 'كتالوج نايوش',
    },
    {
      id: 'store',
      nameAr: 'شراكاتي — صفحة الشراكات',
      tag: 'شراكات',
      desc: 'شراكات التشغيل والأكاديمية والتسويق — ثم المتجر للتفعيل.',
      href: 'partnerships.html',
      icon: 'fa-handshake',
      tone: 'academy',
      inProducts: false,
      inGallery: true,
      sidebar: { label: 'شراكاتي', icon: 'fa-handshake' },
      preview: [
        { icon: 'fa-bag-shopping', label: 'الباقات' },
        { icon: 'fa-coins', label: 'النقاط' },
        { icon: 'fa-bolt', label: 'تفعيل' },
      ],
      kpi: [
        { b: 'اشترِ', s: 'الآن' },
        { b: 'ادخل', s: 'موقعك' },
      ],
      bar: 'الشراكات',
      barSub: 'تفعيل وتشغيل',
    },
    {
      id: 'clients',
      nameAr: 'عملائي — CRM',
      tag: 'عملاء',
      desc: 'إدارة عملائك من نظام CRM الجاهز.',
      href: 'systems/crm.html?from=hub&return=index.html',
      launchCode: 'CRM',
      icon: 'fa-users',
      tone: 'nais',
      inProducts: false,
      inGallery: false,
      sidebar: { label: 'عملائي', icon: 'fa-users' },
      preview: [],
      kpi: [],
      bar: 'CRM',
      barSub: 'عملائي',
    },
    {
      id: 'courses',
      nameAr: 'دورات',
      tag: 'تعليم',
      desc: 'كتالوج دورات نايوش العملية — تصفّح وسجّل وادخل الأكاديمية.',
      href: 'courses.html',
      icon: 'fa-chalkboard',
      tone: 'academy',
      inProducts: true,
      inGallery: true,
      sidebar: { label: 'دورات', icon: 'fa-chalkboard' },
      preview: [
        { icon: 'fa-chalkboard', label: 'الدورات' },
        { icon: 'fa-play', label: 'البدء' },
        { icon: 'fa-certificate', label: 'الشهادة' },
      ],
      kpi: [
        { b: '٦+', s: 'دورة' },
        { b: 'مسارات', s: 'جاهزة' },
      ],
      bar: 'الدورات',
      barSub: 'أكاديمية نايوش',
    },
    {
      id: 'diplomas',
      nameAr: 'دبلومات',
      tag: 'تعليم',
      desc: 'دبلومات معتمدة بمشاريع تخرج على أنظمة هوب الحقيقية.',
      href: 'diplomas.html',
      icon: 'fa-graduation-cap',
      tone: 'academy',
      inProducts: true,
      inGallery: true,
      sidebar: { label: 'دبلومات', icon: 'fa-graduation-cap' },
      preview: [
        { icon: 'fa-graduation-cap', label: 'الدبلوم' },
        { icon: 'fa-route', label: 'المسار' },
        { icon: 'fa-award', label: 'الاعتماد' },
      ],
      kpi: [
        { b: '٦+', s: 'دبلوم' },
        { b: 'معتمد', s: 'مسار' },
      ],
      bar: 'الدبلومات',
      barSub: 'أكاديمية نايوش',
    },
    {
      id: 'internal-chat',
      nameAr: 'دردشة داخلية',
      tag: 'تواصل',
      desc: 'دردشة تشغيلية داخل هوب بين الفرق والفروع وغرفة العمليات.',
      href: 'chat.html',
      icon: 'fa-comments',
      tone: 'hub',
      inProducts: false,
      inGallery: false,
      sidebar: { label: 'دردشة داخلية', icon: 'fa-comments' },
      preview: [],
      kpi: [],
      bar: 'دردشة',
      barSub: 'داخلية',
    },
    {
      id: 'more',
      nameAr: 'اخرى — سجل الأنظمة',
      tag: 'كل المواقع',
      desc: 'كل الأنظمة والمواقع الجاهزة في سجل واحد.',
      href: 'apps.html',
      icon: 'fa-ellipsis',
      tone: 'hub',
      inProducts: false,
      inGallery: false,
      sidebar: { label: 'اخرى', icon: 'fa-ellipsis' },
      preview: [],
      kpi: [],
      bar: 'الأنظمة',
      barSub: 'السجل',
    },
    {
      id: 'events',
      nameAr: 'استوديو الفعاليات',
      tag: 'فعاليات',
      desc: 'فعاليات وبث وورش — ادخل الاستوديو.',
      href: 'events.html',
      icon: 'fa-calendar-days',
      tone: 'fit',
      inProducts: true,
      inGallery: true,
      preview: [
        { icon: 'fa-calendar', label: 'الجدول' },
        { icon: 'fa-video', label: 'البث' },
        { icon: 'fa-ticket', label: 'التذاكر' },
      ],
      kpi: [
        { b: '٥', s: 'فعالية' },
        { b: 'بث', s: 'مباشر' },
      ],
      bar: 'الفعاليات',
      barSub: 'استوديو هوب',
    },
    {
      id: 'operating',
      nameAr: 'آلية التشغيل',
      tag: 'دليل التشغيل',
      desc: 'كيف يشتغل هوب للعميل: ادخل · اشترِ · شغّل.',
      href: 'operating.html',
      icon: 'fa-gears',
      tone: 'hub',
      inProducts: false,
      inGallery: true,
      preview: [
        { icon: 'fa-id-card', label: 'دخول' },
        { icon: 'fa-key', label: 'اشتراك' },
        { icon: 'fa-bolt', label: 'تشغيل' },
      ],
      kpi: [
        { b: '١١', s: 'مبدأ' },
        { b: 'SSO', s: 'موحّد' },
      ],
      bar: 'آلية التشغيل',
      barSub: 'للعميل',
    },
  ].filter((s) => !isExcluded(s.nameAr) && !isExcluded(s.id));

  /** المواقع الشغّالة فقط — دومين حي أو live:true */
  const isLiveSite = (s) => {
    if (!s || isExcluded(s.nameAr)) return false;
    if (s.live === true) return true;
    const code = String(s.launchCode || '').toUpperCase();
    return Boolean(code && window.HubLiveSystems?.isLive?.(code));
  };

  const gallerySites = () => READY_SITES.filter((s) => s.inGallery !== false && isLiveSite(s));
  const productSites = () => READY_SITES.filter((s) => s.inProducts && isLiveSite(s));
  const sidebarSites = () => READY_SITES.filter((s) => s.sidebar);

  const findByLaunchCode = (code) =>
    READY_SITES.find((s) => String(s.launchCode || '').toUpperCase() === String(code || '').toUpperCase());

  const findById = (id) => READY_SITES.find((s) => s.id === id);

  const openSite = (siteOrId, { force = false } = {}) => {
    const site = typeof siteOrId === 'string' ? findById(siteOrId) : siteOrId;
    if (!site || isExcluded(site.nameAr)) return null;
    if (site.launchCode && window.HubLauncher?.launch) {
      const live = window.HubLiveSystems?.isLive?.(site.launchCode);
      return window.HubLauncher.launch(site.launchCode, { mode: 'hub', force: force || live || site.live });
    }
    if (/^https?:\/\//i.test(site.href)) {
      window.open(site.href, '_blank', 'noopener');
      return site.href;
    }
    window.location.href = site.href;
    return site.href;
  };

  /** ربط منتج/عنصر متجر بموقع شغّال فقط — لا رجوع لمواقع تجريبية */
  const siteForProduct = (item = {}) => {
    const code = String(item.platformCode || item.launchCode || '').toUpperCase();
    if (code) {
      const byCode = findByLaunchCode(code);
      if (byCode && isLiveSite(byCode)) return byCode;
    }
    const brand = String(item.brand || item.platform || '').trim();
    if (brand) {
      const exact = READY_SITES.find((s) => isLiveSite(s) && s.nameAr === brand);
      if (exact) return exact;
      const byBrand = READY_SITES.find(
        (s) => isLiveSite(s) && (brand.includes(s.nameAr) || s.nameAr.includes(brand))
      );
      if (byBrand) return byBrand;
    }
    const cat = String(item.category || '');
    const map = {
      'إي آر بي': 'erp',
      ERP: 'erp',
      نايس: 'nais',
      فيت: 'fit',
      أكاديمية: 'academy',
      قانونية: 'law',
      سمارتكس: 'smartx',
      'إيديو سمارتكس': 'edusmartx',
      نايوش: 'edunaiosh',
      تعليم: 'edusmartx',
      مناهج: 'edunaiosh',
    };
    const id = map[cat];
    const site = id ? findById(id) : null;
    return site && isLiveSite(site) ? site : null;
  };

  const buyThenOpen = (itemId) => {
    const store = window.HubStore;
    if (!store?.placeStoreOrder) return { ok: false, error: 'المخزن غير جاهز' };
    const items = store.get()?.empire?.salesStore?.items || [];
    const item = items.find((x) => String(x.id) === String(itemId));
    if (!item) return { ok: false, error: 'المنتج غير موجود' };
    if (isExcluded(item.title) || isExcluded(item.brand)) {
      return { ok: false, error: 'هذا المنتج غير مدرج (كونزو مستبعد)' };
    }
    const buyer = window.HubAuth?.getUser?.()?.email || 'عميل هوب';
    const order = store.placeStoreOrder(itemId, buyer);
    if (!order) return { ok: false, error: 'تعذّر إتمام الشراء' };
    const site = siteForProduct(item);
    return { ok: true, order, site, openHref: site?.href || 'store.html' };
  };

  window.HubReadySites = {
    EXCLUDED: [...EXCLUDED],
    READY_SITES,
    isExcluded,
    isLiveSite,
    gallerySites,
    productSites,
    sidebarSites,
    findByLaunchCode,
    findById,
    openSite,
    siteForProduct,
    buyThenOpen,
  };
})();
