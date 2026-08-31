/**
 * NAIOSH SMART SEARCH — Intent Engine
 * كلمات البداية ليست زينة واجهة؛ كل عبارة تحمل Intent ID
 * وتوجّه البحث إلى الأنواع/الكلمات/الصفحات المناسبة.
 */
(() => {
  'use strict';

  const DEST = {
    opportunity: { href: 'side-projects.html#sp-client-intro', title: 'محرك الفرص والمشاريع الجانبية', type: 'content', typeAr: 'فرصة', icon: 'fa-lightbulb' },
    skills: { href: 'job-roles.html', title: 'قاموس المهارات والأدوار', type: 'knowledge', typeAr: 'مركز المعلومات', icon: 'fa-user-gear' },
    incubators: { href: 'incubators.html', title: 'الحاضنات القطاعية', type: 'incubator', typeAr: 'حاضنة', icon: 'fa-seedling' },
    platforms: { href: 'platforms.html', title: 'المنصات السيادية', type: 'platform', typeAr: 'منصة', icon: 'fa-layer-group' },
    systems: { href: 'apps.html', title: 'دليل الأنظمة', type: 'system', typeAr: 'نظام', icon: 'fa-cubes' },
    rent: { href: 'rent-system.html', title: 'ابدأ رحلتك', type: 'system', typeAr: 'خيار', icon: 'fa-key' },
    network: { href: 'partnerships.html', title: 'التشبيك والشركاء', type: 'content', typeAr: 'تشبيك', icon: 'fa-handshake' },
    learning: { href: 'info-center.html', title: 'مركز المعرفة والتعلم', type: 'knowledge', typeAr: 'مركز المعلومات', icon: 'fa-graduation-cap' },
    marketing: { href: 'ads.html', title: 'استديو التسويق والإعلانات', type: 'content', typeAr: 'تسويق', icon: 'fa-bullhorn' },
    safety: { href: 'quality.html', title: 'السلامة والجودة NAIOSH SAFETY', type: 'content', typeAr: 'سلامة', icon: 'fa-shield-halved' },
    policies: { href: 'policies.html', title: 'السياسات والإجراءات', type: 'knowledge', typeAr: 'مركز المعلومات', icon: 'fa-scroll' },
    infoCenter: { href: 'info-center.html', title: 'مركز المعرفة والتعلم', type: 'knowledge', typeAr: 'مركز المعلومات', icon: 'fa-circle-info' },
    engineSpecs: { href: 'engine-specs.html', title: 'المواصفات الوظيفية للمحرك', type: 'knowledge', typeAr: 'مركز المعلومات', icon: 'fa-gears' },
    manuals: { href: 'ops-manuals.html', title: 'الأدلة التشغيلية', type: 'knowledge', typeAr: 'مركز المعلومات', icon: 'fa-book' },
    review: { href: 'review-methodology.html', title: 'منهجية المراجعة الهندسية', type: 'knowledge', typeAr: 'مركز المعلومات', icon: 'fa-clipboard-check' },
    checklist: { href: 'hub-checklist.html', title: 'قائمة قدرات نايوش هوب', type: 'knowledge', typeAr: 'مركز المعلومات', icon: 'fa-list-check' },
    directives: { href: 'directives.html', title: 'نظام التوجيه المركزي', type: 'knowledge', typeAr: 'مركز المعلومات', icon: 'fa-compass' },
    jobRoles: { href: 'job-roles.html', title: 'مكتبة الأوصاف الوظيفية', type: 'knowledge', typeAr: 'مركز المعلومات', icon: 'fa-user-tie' },
    services: { href: 'services.html', title: 'خدمات نايوش', type: 'content', typeAr: 'خدمة', icon: 'fa-concierge-bell' },
    sectors: { href: 'operating.html', title: 'محرك القطاعات والفرص', type: 'content', typeAr: 'قطاع', icon: 'fa-industry' },
    ops: { href: 'system-ops.html', title: 'تشغيل الأنظمة والمنح', type: 'content', typeAr: 'تشغيل', icon: 'fa-gears' },
    instructions: { href: 'systems-instructions.html', title: 'تعليمات أنظمة نايوش', type: 'content', typeAr: 'تعليمات', icon: 'fa-book-open' },
    register: { href: 'register.html', title: 'سجل معنا', type: 'content', typeAr: 'تسجيل', icon: 'fa-user-plus' },
    approve: { href: 'rent-admin.html', title: 'موافقة السوبر أدمن', type: 'content', typeAr: 'موافقة', icon: 'fa-user-shield' },
  };

  /** Intent registry — Intent ID هو العقد البرمجي */
  const INTENTS = [
    {
      id: 'NEED_GENERAL',
      label: 'أريد...',
      group: 'primary',
      icon: 'fa-compass',
      starters: ['أريد...', 'أريد '],
      routes: { types: ['all'], keywords: ['أريد', 'هدف', 'احتياج', 'سجل معنا'], destinations: ['register', 'opportunity', 'systems', 'ops'] },
      explain: 'توجيه عام حسب الاحتياج أو الهدف',
    },
    {
      id: 'JOIN_SIGNUP',
      label: 'أريد التسجيل...',
      group: 'primary',
      icon: 'fa-user-plus',
      starters: ['أريد التسجيل', 'سجل معنا', 'أريد منصة', 'أريد دومين'],
      routes: {
        types: ['platform', 'content'],
        keywords: ['سجل', 'تسجيل', 'منصة', 'دومين', 'فرع', 'حاضنة', 'موافقة'],
        destinations: ['register', 'approve', 'platforms'],
      },
      explain: 'تسجيل صاحب المنصة من سجل معنا ثم موافقة السوبر أدمن',
    },
    {
      id: 'SEEK_INFO',
      label: 'أبحث عن...',
      group: 'primary',
      icon: 'fa-magnifying-glass',
      starters: ['أبحث عن', 'أبحث عن...'],
      routes: { types: ['all'], keywords: ['أبحث', 'معلومة', 'فرصة', 'مركز المعلومات', 'مركز المعرفة'], destinations: ['infoCenter', 'policies', 'engineSpecs', 'manuals', 'review', 'checklist', 'directives', 'jobRoles'] },
      explain: 'بحث عن معلومة أو فرصة',
    },
    {
      id: 'NEED_SERVICE',
      label: 'أحتاج إلى...',
      group: 'primary',
      icon: 'fa-hand-holding-hand',
      starters: ['أحتاج إلى', 'أحتاج', 'خدمات', 'أريد خدمة'],
      routes: { types: ['system', 'content'], keywords: ['خدمة', 'خدمات', 'حل', 'أحتاج', 'استشارة'], destinations: ['services', 'systems', 'ops', 'rent'] },
      explain: 'خدمة أو حل تشغيلي',
    },
    {
      id: 'LEARNING_SEEK',
      label: 'أريد أن أتعلم...',
      group: 'primary',
      icon: 'fa-graduation-cap',
      starters: ['أريد أن أتعلم', 'أريد تعلم', 'أريد أن أتعلم...'],
      routes: { types: ['content', 'incubator'], keywords: ['تعلم', 'مهارة', 'دورة', 'تدريب'], destinations: ['learning', 'skills', 'incubators'] },
      explain: 'مسار تعلم ومهارات',
    },
    {
      id: 'PROJECT_SEEK',
      label: 'أريد مشروعًا...',
      group: 'primary',
      icon: 'fa-lightbulb',
      starters: ['أريد مشروعًا', 'أريد مشروع', 'أريد مشروعًا...'],
      routes: {
        types: ['content', 'incubator', 'platform'],
        keywords: ['مشروع', 'فرصة', 'جانبي', 'منزلي', 'متنقل', 'موسمي'],
        destinations: ['opportunity', 'incubators', 'sectors'],
      },
      followUps: [
        { label: 'صغيرًا', append: 'صغير', intentId: 'PROJECT_SEEK' },
        { label: 'منزليًا', append: 'منزلي', intentId: 'PROJECT_SEEK' },
        { label: 'متنقلًا', append: 'متنقل', intentId: 'PROJECT_SEEK' },
        { label: 'موسميًا', append: 'موسمي', intentId: 'PROJECT_SEEK' },
        { label: 'برأس مال قليل', append: 'رأس مال قليل', intentId: 'PROJECT_SEEK' },
        { label: 'عالي العائد', append: 'عالي العائد', intentId: 'PROJECT_SEEK' },
        { label: 'قليل المخاطر', append: 'قليل المخاطر', intentId: 'PROJECT_SEEK' },
        { label: 'عبر الإنترنت', append: 'إنترنت', intentId: 'PROJECT_SEEK' },
        { label: 'بالذكاء الاصطناعي', append: 'ذكاء اصطناعي', intentId: 'PROJECT_SEEK' },
      ],
      explain: 'Opportunity Engine · مشاريع وفرص',
    },
    {
      id: 'INCOME_GROWTH',
      label: 'أريد زيادة دخلي...',
      group: 'primary',
      icon: 'fa-coins',
      starters: ['أريد زيادة دخلي', 'زيادة دخلي'],
      routes: {
        types: ['content', 'incubator'],
        keywords: ['دخل', 'إضافي', 'مشروع', 'فرصة', 'متقاعد', 'وظيفة'],
        destinations: ['opportunity', 'skills', 'incubators'],
      },
      followUps: [
        { label: 'لدي وظيفة', append: 'موظف بعد الدوام', intentId: 'INCOME_GROWTH' },
        { label: 'أنا متقاعد', append: 'متقاعد', intentId: 'INCOME_GROWTH' },
        { label: 'لا أملك شهادة', append: 'بدون شهادة', intentId: 'INCOME_GROWTH' },
        { label: 'لدي خبرة', append: 'خبرة', intentId: 'INCOME_GROWTH' },
        { label: 'رأس مال قليل', append: 'رأس مال قليل', intentId: 'INCOME_GROWTH' },
        { label: 'مشروع منزلي', append: 'منزلي', intentId: 'INCOME_GROWTH' },
        { label: 'مشروع متنقل', append: 'متنقل', intentId: 'INCOME_GROWTH' },
        { label: 'قليل المخاطر', append: 'قليل المخاطر', intentId: 'INCOME_GROWTH' },
      ],
      explain: 'Opportunity + Skills · دخل إضافي',
    },
    {
      id: 'EXPERIENCE_MATCH',
      label: 'لدي خبرة في...',
      group: 'primary',
      icon: 'fa-briefcase',
      starters: ['لدي خبرة في', 'لدي خبرة'],
      routes: {
        types: ['content', 'incubator', 'system'],
        keywords: ['خبرة', 'مهنة', 'مستودعات', 'لوجست', 'فرصة'],
        destinations: ['opportunity', 'skills', 'network', 'learning'],
      },
      explain: 'مطابقة الخبرة بالفرص والمشاريع',
    },
    {
      id: 'SKILL_MATCH',
      label: 'لدي مهارة في...',
      group: 'primary',
      icon: 'fa-wand-magic-sparkles',
      starters: ['لدي مهارة في', 'لدي مهارة', 'أبحث عن مهارة'],
      routes: {
        types: ['content', 'incubator'],
        keywords: ['مهارة', 'skill', 'تدريب', 'وظيفة'],
        destinations: ['skills', 'opportunity', 'learning'],
      },
      explain: 'Skill Matching · مهنة ← مشروع ← فرصة',
    },
    {
      id: 'JOB_SEEK',
      label: 'أبحث عن وظيفة...',
      group: 'primary',
      icon: 'fa-user-tie',
      starters: ['أبحث عن وظيفة', 'أريد وظيفة'],
      routes: { types: ['content', 'system'], keywords: ['وظيفة', 'مهنة', 'عمل', 'توظيف'], destinations: ['skills', 'network', 'learning'] },
      explain: 'وظائف ومهن ومسارات مهنية',
    },
    {
      id: 'PARTNER_SEEK',
      label: 'أبحث عن شريك...',
      group: 'primary',
      icon: 'fa-handshake',
      starters: ['أريد شريكًا', 'أبحث عن شريك', 'أبحث عن مستثمر', 'أبحث عن خبير', 'أبحث عن مدرب', 'أبحث عن استشاري', 'أبحث عن مورد', 'أبحث عن فريق'],
      routes: { types: ['content', 'incubator', 'platform'], keywords: ['شريك', 'مستثمر', 'خبير', 'مدرب', 'تشبيك'], destinations: ['network', 'incubators'] },
      explain: 'Network & Connecting Engine',
    },
    {
      id: 'INCUBATOR_SEEK',
      label: 'أبحث عن حاضنة...',
      group: 'primary',
      icon: 'fa-seedling',
      starters: ['أبحث عن حاضنة', 'أريد حاضنة'],
      routes: { types: ['incubator'], keywords: ['حاضنة'], destinations: ['incubators'] },
      explain: 'قائمة الحاضنات القطاعية',
    },
    {
      id: 'MARKETING_SEEK',
      label: 'أريد تسويق...',
      group: 'primary',
      icon: 'fa-bullhorn',
      starters: ['أريد تسويق', 'أحتاج تسويق'],
      routes: { types: ['content', 'system', 'platform'], keywords: ['تسويق', 'إعلان', 'حملة'], destinations: ['marketing', 'systems'] },
      explain: 'استديو التسويق',
    },
    {
      id: 'ASSESSMENT',
      label: 'أريد تقييم...',
      group: 'primary',
      icon: 'fa-clipboard-check',
      starters: ['أريد تقييم', 'أريد تدقيق'],
      routes: { types: ['content', 'system'], keywords: ['تقييم', 'تقويم', 'تدقيق'], destinations: ['safety', 'learning', 'ops'] },
      explain: 'التقييم والتقويم',
    },
    {
      id: 'COMPARISON',
      label: 'أريد مقارنة...',
      group: 'primary',
      icon: 'fa-code-compare',
      starters: ['أريد مقارنة', 'ما الفرق بين'],
      routes: { types: ['system', 'platform', 'content'], keywords: ['مقارنة', 'فرق', 'أفضل'], destinations: ['systems', 'platforms', 'instructions'] },
      explain: 'مقارنات الأنظمة والمنصات',
    },
    {
      id: 'ANALYSIS',
      label: 'أريد تحليل...',
      group: 'primary',
      icon: 'fa-chart-line',
      starters: ['أريد تحليل', 'أريد دراسة', 'أريد خطة'],
      routes: { types: ['content', 'system'], keywords: ['تحليل', 'دراسة', 'خطة', 'تخطيط'], destinations: ['opportunity', 'ops', 'learning'] },
      explain: 'تحليل ودراسات وتخطيط',
    },
    {
      id: 'PROBLEM_SOLVING',
      label: 'لدي مشكلة...',
      group: 'primary',
      icon: 'fa-triangle-exclamation',
      starters: ['لدي مشكلة', 'أريد حلًا لـ', 'أريد تحسين', 'أريد إدارة', 'أريد أتمتة'],
      routes: {
        types: ['system', 'content', 'platform'],
        keywords: ['مشكلة', 'حل', 'تحسين', 'أتمتة', 'إدارة', 'مبيعات', 'إنتاجية', 'سلامة', 'موظفين'],
        destinations: ['systems', 'ops', 'safety', 'rent'],
      },
      followUps: [
        { label: 'في التسويق', append: 'تسويق', intentId: 'PROBLEM_SOLVING' },
        { label: 'في السلامة', append: 'سلامة', intentId: 'PROBLEM_SOLVING' },
        { label: 'في إدارة الموظفين', append: 'موظفين', intentId: 'PROBLEM_SOLVING' },
        { label: 'في انخفاض المبيعات', append: 'مبيعات', intentId: 'PROBLEM_SOLVING' },
        { label: 'في الإنتاجية', append: 'إنتاجية', intentId: 'PROBLEM_SOLVING' },
      ],
      explain: 'حل المشكلات → نظام/محرك مناسب',
    },
    {
      id: 'SYSTEM_DISCOVERY',
      label: 'أريد نظامًا لـ...',
      group: 'primary',
      icon: 'fa-cube',
      starters: ['أريد نظامًا لـ', 'أريد نظامًا', 'أبحث عن نظام'],
      routes: { types: ['system', 'platform'], keywords: ['نظام', 'ERP', 'تشغيل'], destinations: ['systems', 'rent', 'ops', 'instructions'] },
      explain: 'اكتشاف النظام المناسب',
    },
    {
      id: 'STANDARD_SEEK',
      label: 'أبحث عن معيار...',
      group: 'primary',
      icon: 'fa-certificate',
      starters: ['أبحث عن معيار', 'أبحث عن لائحة', 'أبحث عن إجراء', 'أبحث عن نموذج', 'أبحث عن سياسة', 'أبحث عن مخاطر', 'أبحث عن طريقة لتقليل', 'ISO 45001'],
      routes: { types: ['content', 'system'], keywords: ['معيار', 'لائحة', 'إجراء', 'سياسة', 'مخاطر', 'ISO', 'سلامة'], destinations: ['safety', 'policies', 'learning'] },
      explain: 'المعايير والسياسات والسلامة',
    },
    {
      id: 'SAFETY_SEEK',
      label: 'سلامة ومخاطر...',
      group: 'primary',
      icon: 'fa-shield-halved',
      starters: [
        'أريد تقييم مخاطر',
        'أريد تحليل خطر',
        'أريد تحسين السلامة',
        'أريد نظام سلامة',
        'أريد خطة طوارئ',
        'أريد سياسة سلامة',
        'أريد مؤشرات سلامة',
        'أريد مقارنة أنظمة السلامة',
        'أريد تقييم كفاءة العاملين',
      ],
      routes: { types: ['content', 'system'], keywords: ['سلامة', 'مخاطر', 'طوارئ', 'تدقيق', 'OSH', '45001'], destinations: ['safety', 'policies', 'quality'] },
      explain: 'NAIOSH SAFETY 360',
    },
    {
      id: 'SECTOR_SEEK',
      label: 'أريد فرصة في...',
      group: 'primary',
      icon: 'fa-industry',
      starters: ['أريد فرصة في', 'فرصة في'],
      routes: {
        types: ['incubator', 'content', 'platform'],
        keywords: ['قطاع', 'طاقة', 'لوجست', 'بناء', 'صناعة', 'صحة', 'تعليم', 'سياحة', 'زراعة', 'تقنية'],
        destinations: ['sectors', 'incubators', 'opportunity'],
      },
      followUps: [
        { label: 'الطاقة', append: 'الطاقة', intentId: 'SECTOR_SEEK' },
        { label: 'اللوجستيات', append: 'اللوجستيات', intentId: 'SECTOR_SEEK' },
        { label: 'البناء', append: 'البناء', intentId: 'SECTOR_SEEK' },
        { label: 'الصناعة', append: 'الصناعة', intentId: 'SECTOR_SEEK' },
        { label: 'الصحة', append: 'الصحة', intentId: 'SECTOR_SEEK' },
        { label: 'التعليم', append: 'التعليم', intentId: 'SECTOR_SEEK' },
        { label: 'السياحة', append: 'السياحة', intentId: 'SECTOR_SEEK' },
        { label: 'الزراعة', append: 'الزراعة', intentId: 'SECTOR_SEEK' },
        { label: 'التقنية', append: 'التقنية', intentId: 'SECTOR_SEEK' },
        { label: 'التجارة', append: 'التجارة', intentId: 'SECTOR_SEEK' },
      ],
      explain: 'Universal Sector Opportunity Engine',
    },
    {
      id: 'HOW_TO',
      label: 'كيف أبدأ...',
      group: 'primary',
      icon: 'fa-route',
      starters: ['كيف أبدأ', 'كيف أطور', 'كيف أنشئ', 'كيف أقيس', 'كيف أعرف', 'ماذا أحتاج لـ', 'ما المهارات المطلوبة', 'ما المشاريع المناسبة', 'ما أفضل طريقة', 'ما العلاقة بين', 'من يمكنه مساعدتي'],
      routes: { types: ['content', 'system', 'incubator'], keywords: ['كيف', 'ابدأ', 'طور', 'أنشئ', 'مهارات', 'مشروع'], destinations: ['opportunity', 'learning', 'ops', 'instructions'] },
      explain: 'إرشاد تشغيلي وخطوات',
    },
    {
      id: 'REVERSE_SEARCH',
      label: 'ماذا أستطيع بخبرتي؟',
      group: 'primary',
      icon: 'fa-arrows-rotate',
      starters: ['ماذا أستطيع أن أفعل بخبرتي', 'ماذا أستطيع أن أفعل بمهاراتي', 'ماذا أستطيع أن أفعل برأس مالي', 'ماذا أستطيع أن أفعل بوقتي', 'اقترح لي فرصًا مناسبة لي'],
      routes: { types: ['content', 'incubator'], keywords: ['خبرة', 'مهارة', 'فرصة', 'مشروع', 'رأس مال'], destinations: ['opportunity', 'skills', 'network'] },
      explain: 'بحث عكسي مما لديك → فرص',
    },
    {
      id: 'UNKNOWN_DISCOVERY',
      label: 'لا أعرف ماذا أبحث...',
      group: 'discovery',
      icon: 'fa-circle-question',
      starters: ['لا أعرف ماذا أبحث', 'ساعدني في اكتشاف ما أحتاجه'],
      routes: { types: ['all'], keywords: [], destinations: ['opportunity', 'learning', 'skills', 'network', 'systems'] },
      followUps: [
        { label: 'زيادة الدخل', append: 'زيادة دخلي', intentId: 'INCOME_GROWTH' },
        { label: 'تطوير مهنتي', append: 'تطوير مهنة', intentId: 'LEARNING_SEEK' },
        { label: 'إنشاء مشروع', append: 'أريد مشروعًا', intentId: 'PROJECT_SEEK' },
        { label: 'التعلم', append: 'أريد أن أتعلم', intentId: 'LEARNING_SEEK' },
        { label: 'البحث عن وظيفة', append: 'أبحث عن وظيفة', intentId: 'JOB_SEEK' },
        { label: 'حل مشكلة', append: 'لدي مشكلة', intentId: 'PROBLEM_SOLVING' },
        { label: 'البحث عن شريك', append: 'أبحث عن شريك', intentId: 'PARTNER_SEEK' },
        { label: 'تطوير مشروع قائم', append: 'تحسين مشروع', intentId: 'ANALYSIS' },
      ],
      explain: 'اكتشاف الهدف ثم توجيه المحركات',
    },
  ];

  const PRIMARY_STARTERS = INTENTS.filter((i) => i.group === 'primary' || i.group === 'discovery').map((i) => ({
    intentId: i.id,
    label: i.label,
    icon: i.icon,
    starter: i.starters[0],
  }));

  const byId = (id) => INTENTS.find((i) => i.id === id) || null;

  const detectIntent = (rawQuery) => {
    const q = String(rawQuery || '').trim();
    if (!q) return null;
    const n = q.toLowerCase();

    // إشارات سياقية قوية تتقدّم على البداية العامة «أريد»
    if (/سلام|مخاطر|iso\s*45001|طوارئ|سلامة/.test(n)) return byId('SAFETY_SEEK');
    if (/مستودع|لوجست|دخلً?\s*إضافي|زيادة\s*دخلي|بعد\s*الدوام|خبرة\s+\d+/.test(n)) {
      if (/دخل|إضافي|بعد\s*الدوام|زيادة/.test(n)) return byId('INCOME_GROWTH');
      return byId('EXPERIENCE_MATCH');
    }
    if (/مركز\s*(المعلومات|المعرفة)|معلومات\s*هوب/.test(n)) return byId('SEEK_INFO');
    if (/شريك|مستثمر|مدرب|خبير|استشاري|مورد/.test(n)) return byId('PARTNER_SEEK');
    if (/مشروع/.test(n) && /أريد|أبحث|أنشئ/.test(n)) return byId('PROJECT_SEEK');
    if (/نظامً?\s*ل|أريد\s*نظام/.test(n)) return byId('SYSTEM_DISCOVERY');
    if (/مهارة/.test(n)) return byId('SKILL_MATCH');
    if (/وظيفة/.test(n)) return byId('JOB_SEEK');
    if (/لا\s*أعرف\s*ماذا\s*أبحث|اكتشاف\s*ما\s*أحتاج/.test(n)) return byId('UNKNOWN_DISCOVERY');

    // أطول بداية مطابقة (تجاهل البدايات القصيرة جدًا مثل «أريد» وحدها إلا إذا كان النص قصيرًا)
    let best = null;
    let bestLen = 0;
    INTENTS.forEach((intent) => {
      (intent.starters || []).forEach((s) => {
        const sn = String(s).toLowerCase().replace(/\.\.\.$/, '').trim();
        if (sn.length < 5 && n.length > sn.length + 2) return;
        if (n.includes(sn) && sn.length > bestLen) {
          best = intent;
          bestLen = sn.length;
        }
      });
    });
    return best;
  };

  const destinationCards = (intent) => {
    const keys = intent?.routes?.destinations || [];
    return keys
      .map((k) => DEST[k])
      .filter(Boolean)
      .map((d, idx) => ({
        id: `intent-dest-${intent.id}-${idx}`,
        type: d.type,
        typeAr: d.typeAr,
        icon: d.icon,
        title: d.title,
        subtitle: `موجّه عبر ${intent.id} · ${intent.explain || ''}`,
        meta: intent.id,
        grantId: intent.id,
        href: d.href,
        keywords: `${intent.id} ${intent.label} ${(intent.routes?.keywords || []).join(' ')}`,
        source: 'intent-route',
        intentId: intent.id,
        matchScore: 96 - idx * 2,
        why: [`يتوافق مع نية البحث: ${intent.label}`, intent.explain].filter(Boolean),
      }));
  };

  const scoreAgainstIntent = (item, intent, queryNorm) => {
    if (!intent) return { score: 0, why: [] };
    let score = 0;
    const why = [];
    const types = intent.routes?.types || [];
    if (types.includes('all') || types.includes(item.type)) {
      score += 8;
      why.push('نوع النتيجة مناسب للنية');
    }
    const hay = `${item.keywords || ''} ${item.title || ''} ${item.subtitle || ''}`.toLowerCase();
    (intent.routes?.keywords || []).forEach((kw) => {
      if (kw && hay.includes(String(kw).toLowerCase())) {
        score += 5;
      }
    });
    if (item.source === 'intent-route' && item.intentId === intent.id) {
      score += 30;
      why.push('مسار تشغيلي موصى به لهذه النية');
    }
    if (queryNorm && hay.includes(queryNorm)) score += 4;
    // side projects boost for project/income intents
    if (
      (intent.id === 'PROJECT_SEEK' || intent.id === 'INCOME_GROWTH' || intent.id === 'REVERSE_SEARCH') &&
      /side-projects|مشروع/.test(hay + (item.href || ''))
    ) {
      score += 12;
      why.push('مرتبط بمحرك الفرص/المشاريع الجانبية');
    }
    if ((intent.id === 'SEEK_INFO' || intent.id === 'LEARNING_SEEK' || intent.id === 'STANDARD_SEEK') && /info-center|policies|engine-specs|ops-manuals|review-methodology|hub-checklist|directives|job-roles|operating|مركز/.test(hay + (item.href || '') + (item.source || ''))) {
      score += 14;
      why.push('صفحة من مركز المعلومات');
    }
    if ((intent.id === 'SAFETY_SEEK' || intent.id === 'STANDARD_SEEK') && /سلام|جودة|سياس|quality|policies/.test(hay + (item.href || ''))) {
      score += 12;
      why.push('مرتبط بمسار السلامة والمعايير');
    }
    return { score, why: why.slice(0, 4) };
  };

  window.HubSearchIntents = {
    INTENTS,
    PRIMARY_STARTERS,
    DEST,
    byId,
    detectIntent,
    destinationCards,
    scoreAgainstIntent,
  };
})();
