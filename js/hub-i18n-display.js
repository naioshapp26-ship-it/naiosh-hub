/**
 * طبقة عرض عربية مركزية — getArabicLabel / localizeText
 * لا تغيّر أكواد API أو القيم المخزّنة؛ للعرض فقط.
 */
(() => {
  'use strict';

  const I = window.HubI18n;
  if (!I) return;

  const ALIASES = {
    'central intelligence engine': 'محرك الذكاء المركزي',
    'central intelligence': 'العقل المركزي',
    'ai decision': 'قرارات الذكاء الاصطناعي',
    'ai decisions': 'قرارات الذكاء الاصطناعي',
    'ai analysis': 'تحليل الذكاء الاصطناعي',
    'ai detection': 'كشف الذكاء الاصطناعي',
    'ai connector': 'موصل الذكاء الاصطناعي',
    operational: 'تشغيلي',
    anomaly: 'اكتشاف الشذوذ',
    'anomaly engine': 'محرك اكتشاف الشذوذ',
    optimization: 'تحسين',
    'optimization engine': 'محرك التحسين',
    'optimization engine v1': 'محرك التحسين الإصدار 1',
    growth: 'نمو',
    risk: 'مخاطر',
    prediction: 'تنبؤ',
    predictive: 'تنبؤي',
    'predictive engine': 'محرك التنبؤ',
    recommendation: 'توصية',
    insight: 'رؤية',
    manual: 'يدوي',
    'rule engine': 'محرك القواعد',
    'external system': 'نظام خارجي',
    'internal module': 'وحدة داخلية',
    'decision model v2': 'نموذج القرار الإصدار 2',
    'anomaly detector v1': 'كاشف الشذوذ الإصدار 1',
    'forecast v1': 'التنبؤ الإصدار 1',
    'model forecast v1': 'نموذج التنبؤ الإصدار 1',
    'overdue tasks': 'المهام المتأخرة',
    'last 30 days': 'آخر 30 يوم',
    'last 14 days': 'آخر 14 يوم',
    'last 7 days': 'آخر 7 أيام',
    current: 'الحالي',
    utilization: 'معدل الإشغال',
    'team productivity': 'إنتاجية الفريق',
    'spike rate': 'معدل القفزة',
    workforce: 'القوى العاملة',
    tasks: 'المهام',
    measurement: 'القياس',
    security: 'الأمن',
    analytics: 'التحليلات',
    integration: 'تكامل',
    pending: 'قيد الانتظار',
    'pending review': 'بانتظار المراجعة',
    'pending approval': 'بانتظار الاعتماد',
    approved: 'تمت الموافقة',
    rejected: 'مرفوض',
    executed: 'منفَّذ',
    draft: 'مسودة',
    archived: 'مؤرشف',
    published: 'منشور',
    active: 'نشط',
    inactive: 'غير نشط',
    suspended: 'موقوف',
    closed: 'مغلق',
    open: 'مفتوح',
    connected: 'متصل',
    disconnected: 'غير متصل',
    failed: 'فشل',
    success: 'ناجح',
    effective: 'فعّال',
    partial: 'جزئي',
    high: 'مرتفع',
    medium: 'متوسط',
    low: 'منخفض',
    critical: 'حرج',
    warning: 'تحذير',
    created: 'إنشاء',
    approved_by: 'اعتماد',
    needs_changes: 'يحتاج تعديلاً',
    in_progress: 'قيد التنفيذ',
    'in-progress': 'قيد التنفيذ',
    todo: 'مطلوب',
    done: 'مكتمل',
    cancelled: 'ملغي',
    canceled: 'ملغي',
    queued: 'في الانتظار',
    paused: 'متوقف مؤقتًا',
    scheduled: 'مجدول',
    new: 'جديد',
    online: 'متصل',
    offline: 'غير متصل',
    enabled: 'مفعّل',
    disabled: 'متوقف',
    visible: 'ظاهر',
    hidden: 'مخفي',
    standard: 'قياسي',
    professional: 'احترافي',
    enterprise: 'مؤسسي',
    free: 'مجاني',
    trial: 'تجريبي',
    basic: 'أساسي',
    customer: 'عميل',
    client: 'عميل',
    employee: 'موظف',
    admin: 'مدير النظام',
    manager: 'مدير',
    guest: 'ضيف',
    visitor: 'زائر',
    staff: 'موظف',
    owner: 'المالك',
    reviewer: 'المراجع',
    approver: 'المعتمد',
    system: 'النظام',
    warehouse: 'مستودع',
    file: 'ملف',
    api: 'واجهة برمجة',
    table: 'جدول',
    stream: 'تدفق',
    document: 'مستند',
    dataset: 'مجموعة بيانات',
    other: 'أخرى',
    internal: 'داخلي',
    external: 'خارجي',
    inbound: 'وارد',
    outbound: 'صادر',
    production: 'إنتاج',
    staging: 'تجريبي',
    sync: 'مزامنة',
    logs: 'السجلات',
    actions: 'الإجراءات',
    status: 'الحالة',
    type: 'النوع',
    source: 'المصدر',
    engine: 'المحرك',
    impact: 'الأثر',
    priority: 'الأولوية',
    confidence: 'الثقة',
    title: 'العنوان',
    result: 'النتيجة',
    model: 'النموذج',
    metric: 'المؤشر',
    expected: 'المتوقع',
    actual: 'الفعلي',
    period: 'الفترة',
    owner_label: 'المالك',
    'system generated': 'مولّد تلقائياً',
    'hub launch': 'تشغيل عبر هوب',
    loading: 'جارٍ التحميل...',
    'no data': 'لا توجد بيانات',
    'no results': 'لا توجد نتائج',
    'access denied': 'ليس لديك صلاحية للوصول',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    view: 'عرض',
    add: 'إضافة',
    create: 'إنشاء',
    update: 'تحديث',
    search: 'بحث',
    filter: 'تصفية',
    submit: 'إرسال',
    close: 'إغلاق',
    back: 'رجوع',
    next: 'التالي',
    previous: 'السابق',
    confirm: 'تأكيد',
    details: 'التفاصيل',
    settings: 'الإعدادات',
    notifications: 'الإشعارات',
    dashboard: 'لوحة التحكم',
    report: 'تقرير',
    audit: 'التدقيق',
    'audit log': 'سجل التدقيق',
    'created at': 'تاريخ الإنشاء',
    'last updated': 'آخر تحديث',
    'created by': 'أنشئ بواسطة',
    'executed by': 'نفّذه',
    'decision id': 'معرّف القرار',
    'execution id': 'معرّف التنفيذ',
    'request id': 'رقم الطلب',
    'employee id': 'رقم الموظف',
    'article id': 'رقم المقال',
    'reference id': 'رقم المرجع',
    'source module': 'وحدة المصدر',
    'source modules': 'وحدات المصدر',
    'data used': 'البيانات المستخدمة',
    'suggested action': 'الإجراء المقترح',
    'impact level': 'مستوى الأثر',
    'expected impact': 'الأثر المتوقع',
    'affected module': 'الوحدة المتأثرة',
    'affected users': 'المستخدمون المتأثرون',
    'data quality': 'جودة البيانات',
    'model confidence': 'ثقة النموذج',
    coverage: 'التغطية',
    'last validation': 'آخر تحقق',
    'model / rule': 'النموذج / القاعدة',
    'owner / reviewer / approver': 'المالك / المراجع / المعتمد',
    decision: 'قرار',
    executed_status: 'منفَّذ',
    knowledge: 'المعرفة',
    'english (dd/mm)': 'الإنجليزية (يوم/شهر)',
    'english (us)': 'الإنجليزية (أمريكي)',
    english: 'الإنجليزية',
    preview: 'المعاينة',
    started: 'البدء',
    completed: 'الاكتمال',
    affected: 'المتأثر',
    generated: 'تاريخ الإنشاء',
    predicted: 'المتنبّأ',
    detected: 'وقت الاكتشاف',
    records: 'السجلات',
    deviation: 'الانحراف',
    severity: 'الحدة',
    reason: 'السبب',
    value: 'القيمة',
    action: 'الإجراء',
    formula: 'الصيغة',
    method: 'الطريقة',
    path: 'المسار',
    calls: 'الاستدعاءات',
    configure: 'تهيئة',
    'sync now': 'مزامنة الآن',
    'view logs': 'عرض السجلات',
    'test connection': 'اختبار الاتصال',
    'scan source': 'فحص المصدر',
    'open incidents': 'الحوادث المفتوحة',
    'active controls': 'الضوابط النشطة',
    'critical risks': 'المخاطر الحرجة',
    'workflow runs': 'تشغيلات سير العمل',
    'customer requests': 'طلبات العملاء',
    'store status': 'حالة المتجر',
    'transaction id': 'رقم المعاملة',
    'default status': 'الحالة الافتراضية',
    'auto assign': 'التعيين التلقائي',
    'enable articles': 'تفعيل المقالات',
    'enable advertisements': 'تفعيل الإعلانات',
    'session timeout': 'مهلة الجلسة',
    'password policy': 'سياسة كلمة المرور',
    'in-app notifications': 'إشعارات داخل التطبيق',
    'email notifications': 'إشعارات البريد',
    pagination: 'ترقيم الصفحات',
    'drill down': 'تفصيل',
    operator: 'مشغّل',
    auditor: 'مدقق',
    'system admin': 'مسؤول النظام',
    'system manager': 'مدير النظام',
    'hr admin': 'مسؤول الموارد البشرية',
    'hr manager': 'مدير الموارد البشرية',
    'hr system': 'نظام الموارد البشرية',
    'hr ops': 'عمليات الموارد البشرية',
    'measurement engine': 'محرك القياس',
    'sql database': 'قاعدة بيانات SQL',
    'cloud storage': 'تخزين سحابي',
    'manual entry': 'إدخال يدوي',
    'excel import': 'استيراد إكسل',
    'excel / csv': 'إكسل / جداول',
    'side projects': 'المشاريع الجانبية',
    'rent admin': 'موافقات الإيجار',
    'posha ops': 'عمليات بوشا',
    'ads studio': 'استوديو الإعلانات',
    'events studio': 'استوديو الفعاليات',
    'marketing studio': 'استوديو التسويق',
    'naiosh academy': 'أكاديمية نايوش',
    'head office': 'المقر الرئيسي',
    'saudi arabia': 'السعودية',
    'company os': 'نظام تشغيل الشركة',
    'command center': 'مركز القيادة',
    governance: 'الحوكمة',
    'core operations': 'العمليات الأساسية',
    'identity & access': 'الهوية والوصول',
    'data & knowledge': 'البيانات والمعرفة',
    'marketing & crm': 'التسويق وإدارة العملاء',
    'build once – integrate everywhere': 'ابنِ مرة — اربط في كل مكان',
    'build once - integrate everywhere': 'ابنِ مرة — اربط في كل مكان',
    'last 30 days': 'آخر 30 يوم',
    adaptive: 'متكيّف',
    workspace: 'مساحة العمل',
    leads: 'العملاء المحتملون',
    cover: 'الغلاف',
    center: 'المركز',
    archive: 'الأرشيف',
    teachers: 'المعلمون',
    facilities: 'المرافق',
    supply: 'التوريد',
    sector: 'القطاع',
    skills: 'المهارات',
    person_profile: 'ملف الشخص',
    opportunity: 'فرصة',
    project: 'مشروع',
    learning: 'تعلّم',
    safety: 'سلامة',
    sustainability: 'استدامة',
    positions: 'المناصب',
    profile: 'الملف',
    metadata: 'البيانات الوصفية',
    timeliness: 'الوقتية',
    'test b': 'اختبار ب',
    login: 'تسجيل الدخول',
    complaint: 'شكوى',
    ticket: 'تذكرة',
    nms: 'نظام التسويق الشبكي',
    ncs: 'نظام الاتصال',
    pm: 'م',
    am: 'ص',
    'a.m.': 'ص',
    'p.m.': 'م',
  };

  const WORDS = {
    engine: 'محرك',
    analysis: 'تحليل',
    decision: 'قرار',
    decisions: 'قرارات',
    operational: 'تشغيلي',
    operations: 'عمليات',
    optimization: 'تحسين',
    anomaly: 'شذوذ',
    growth: 'نمو',
    risk: 'مخاطر',
    risks: 'مخاطر',
    manual: 'يدوي',
    predictive: 'تنبؤي',
    prediction: 'تنبؤ',
    recommendation: 'توصية',
    insight: 'رؤية',
    intelligence: 'ذكاء',
    central: 'مركزي',
    source: 'مصدر',
    status: 'حالة',
    pending: 'قيد الانتظار',
    approved: 'معتمد',
    rejected: 'مرفوض',
    active: 'نشط',
    inactive: 'غير نشط',
    draft: 'مسودة',
    published: 'منشور',
    type: 'نوع',
    high: 'مرتفع',
    medium: 'متوسط',
    low: 'منخفض',
    critical: 'حرج',
    warning: 'تحذير',
    connected: 'متصل',
    failed: 'فشل',
    success: 'نجاح',
    review: 'مراجعة',
    approval: 'اعتماد',
    executed: 'منفَّذ',
    archived: 'مؤرشف',
    layer: 'طبقة',
    system: 'نظام',
    systems: 'أنظمة',
    module: 'وحدة',
    service: 'خدمة',
    gateway: 'بوابة',
    connector: 'موصل',
    dataset: 'بيانات',
    stream: 'تدفق',
    table: 'جدول',
    file: 'ملف',
    document: 'مستند',
    view: 'عرض',
    report: 'تقرير',
    audit: 'تدقيق',
    log: 'سجل',
    settings: 'إعدادات',
    notifications: 'إشعارات',
    integration: 'تكامل',
    security: 'أمن',
    measurement: 'قياس',
    workforce: 'قوى عاملة',
    tasks: 'مهام',
    analytics: 'تحليلات',
    manager: 'مدير',
    admin: 'مسؤول',
    user: 'مستخدم',
    customer: 'عميل',
    employee: 'موظف',
    owner: 'مالك',
    priority: 'أولوية',
    impact: 'أثر',
    confidence: 'ثقة',
    model: 'نموذج',
    forecast: 'تنبؤ',
    detection: 'كشف',
    rule: 'قاعدة',
    external: 'خارجي',
    internal: 'داخلي',
    generated: 'مولَّد',
    created: 'إنشاء',
    updated: 'تحديث',
    actions: 'إجراءات',
    details: 'تفاصيل',
    search: 'بحث',
    filter: 'تصفية',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    add: 'إضافة',
    create: 'إنشاء',
    update: 'تحديث',
    submit: 'إرسال',
    export: 'تصدير',
    import: 'استيراد',
    refresh: 'تحديث',
    loading: 'تحميل',
    error: 'خطأ',
    online: 'متصل',
    offline: 'غير متصل',
    open: 'مفتوح',
    closed: 'مغلق',
    new: 'جديد',
    running: 'تشغيل',
    queued: 'انتظار',
    paused: 'متوقف',
    ready: 'جاهز',
    building: 'بناء',
    planned: 'مخطط',
    blocked: 'موقوف',
    done: 'مكتمل',
    overdue: 'متأخر',
    effective: 'فعّال',
    partial: 'جزئي',
    waiting: 'انتظار',
    score: 'درجة',
    role: 'دور',
    target: 'هدف',
    policy: 'سياسة',
    contract: 'عقد',
    quality: 'جودة',
    health: 'صحة',
    core: 'نواة',
    checkout: 'دفع',
    standard: 'قياسي',
    professional: 'احترافي',
    enterprise: 'مؤسسي',
    knowledge: 'معرفة',
    detector: 'كاشف',
    utilization: 'إشغال',
    productivity: 'إنتاجية',
    spike: 'قفزة',
    rate: 'معدل',
    team: 'فريق',
    last: 'آخر',
    days: 'أيام',
    current: 'حالي',
    records: 'سجلات',
    metric: 'مؤشر',
    period: 'فترة',
    value: 'قيمة',
    reason: 'سبب',
    result: 'نتيجة',
    method: 'طريقة',
    path: 'مسار',
    calls: 'استدعاءات',
    inbound: 'وارد',
    outbound: 'صادر',
    sync: 'مزامنة',
    logs: 'سجلات',
    preview: 'معاينة',
    started: 'بدء',
    completed: 'اكتمال',
    affected: 'متأثر',
    generated: 'إنشاء',
    predicted: 'متنبأ',
    detected: 'اكتشاف',
    deviation: 'انحراف',
    severity: 'حدة',
    formula: 'صيغة',
    configure: 'تهيئة',
    operator: 'مشغّل',
    auditor: 'مدقق',
    warehouse: 'مستودع',
    storage: 'تخزين',
    cloud: 'سحابي',
    database: 'قاعدة بيانات',
    studio: 'استوديو',
    campaign: 'حملة',
    campaigns: 'حملات',
    content: 'محتوى',
    identity: 'هوية',
    access: 'وصول',
    organization: 'تنظيم',
    platform: 'منصة',
    platforms: 'منصات',
    branch: 'فرع',
    branches: 'فروع',
    incubator: 'حاضنة',
    incubators: 'حاضنات',
    wallet: 'محفظة',
    store: 'متجر',
    product: 'منتج',
    products: 'منتجات',
    event: 'فعالية',
    events: 'فعاليات',
    article: 'مقال',
    articles: 'مقالات',
    blog: 'مدونة',
    ad: 'إعلان',
    ads: 'إعلانات',
    request: 'طلب',
    requests: 'طلبات',
    task: 'مهمة',
    workflow: 'سير عمل',
    payment: 'دفع',
    paid: 'مدفوع',
    unpaid: 'غير مدفوع',
    refunded: 'مسترد',
    shipping: 'شحن',
    guest: 'ضيف',
    visitor: 'زائر',
    staff: 'موظف',
    client: 'عميل',
    customers: 'عملاء',
    users: 'مستخدمون',
    employees: 'موظفون',
    permissions: 'صلاحيات',
    permission: 'صلاحية',
    role: 'دور',
    roles: 'أدوار',
    department: 'قسم',
    name: 'اسم',
    email: 'بريد',
    phone: 'هاتف',
    description: 'وصف',
    notes: 'ملاحظات',
    yes: 'نعم',
    no: 'لا',
    all: 'الكل',
    none: 'لا شيء',
    other: 'أخرى',
    unknown: 'غير معروف',
    default: 'افتراضي',
    custom: 'مخصص',
    automatic: 'تلقائي',
    auto: 'تلقائي',
    manual: 'يدوي',
    enabled: 'مفعّل',
    disabled: 'متوقف',
    visible: 'ظاهر',
    hidden: 'مخفي',
    public: 'عام',
    private: 'خاص',
    archived: 'مؤرشف',
    deleted: 'محذوف',
    updated: 'محدّث',
    created: 'منشأ',
    assigned: 'مُسند',
    unassigned: 'غير مسند',
    resolved: 'محلول',
    investigating: 'قيد التحقيق',
    acknowledged: 'مُقرّ',
    overdue: 'متأخر',
    on: 'تشغيل',
    off: 'إيقاف',
    true: 'نعم',
    false: 'لا',
    null: 'فارغ',
    none: 'لا شيء',
    n_a: 'غير متاح',
    na: 'غير متاح',
    version: 'إصدار',
    model: 'نموذج',
  };

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'KBD', 'SAMP']);
  const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];

  const INDEX = new Map();

  const norm = (s) =>
    String(s || '')
      .trim()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase();

  const put = (key, ar) => {
    const k = norm(key);
    if (!k || !ar) return;
    if (!INDEX.has(k)) INDEX.set(k, ar);
  };

  const ingest = (obj) => {
    if (!obj) return;
    Object.keys(obj).forEach((k) => put(k, obj[k]));
  };

  ingest(I.LABELS);
  ingest(I.STATUS);
  ingest(I.COMMON);
  ingest(I.ROLES);
  ingest(I.PLANS);
  ingest(I.SYSTEMS);
  ingest(I.ACTIVITY_KINDS);
  ingest(ALIASES);

  const ID_RE =
    /^(EMP|CUS|NAI|ART|REQ|ORD|EVT|ADS|CR|TKT|SOL|EXEC|SRC|USR|BR|INC|PLT|DEC|WF|PAY|NTF|CAM|PRD|SYS|HUB)-[A-Z0-9-]+$/i;
  const CODE_RE = /^[A-Z]{2,8}-\d{4}-\d{2,}$/;
  const ACRONYM_RE = /^[A-Z]{2,6}$/;
  const NUM_RE = /^[\d.,:%+\-\s/]+$/;
  const FA_RE = /^fa[sbrl]?-/i;

  const isExempt = (raw) => {
    const s = String(raw || '').trim();
    if (!s) return true;
    if (I.isAllowedBrand?.(s)) return true;
    if (/@/.test(s) || /^https?:/i.test(s) || /^mailto:/i.test(s)) return true;
    if (ID_RE.test(s) || CODE_RE.test(s)) return true;
    if (/^(SYS|POL|OWN|INC|SLA|NH|ST)-\w+/i.test(s)) return true;
    if (/^[A-Z]{2,12}$/.test(s)) return true;
    if (/\.(com|app|net|org|io|html|js|css)\b/i.test(s) && s.length <= 80) return true;
    if (NUM_RE.test(s)) return true;
    if (FA_RE.test(s) || /^[.#]|px$|rem$/.test(s)) return true;
    if (/\.(html?|js|css|png|jpe?g|gif|webp|svg|pdf|mp4|json)(\?|$)/i.test(s)) return true;
    if (ACRONYM_RE.test(s) && (I.isAllowedBrand?.(s) || s.length <= 5)) return true;
    if (/^#[0-9a-f]{3,8}$/i.test(s)) return true;
    return false;
  };

  const lookup = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const k = norm(raw);
    if (INDEX.has(k)) return INDEX.get(k);
    const compact = k.replace(/\s+/g, '');
    if (INDEX.has(compact)) return INDEX.get(compact);
    return '';
  };

  const translateWord = (word) => {
    if (!word) return word;
    if (isExempt(word) || I.isAllowedBrand?.(word)) return word;
    const hit = lookup(word);
    if (hit) return hit;
    const w = WORDS[norm(word)];
    return w || word;
  };

  const localizeText = (input) => {
    const raw = String(input ?? '');
    if (!raw) return raw;
    if (!/[A-Za-z]/.test(raw)) return raw;
    const trimmed = raw.trim();
    if (isExempt(trimmed)) return raw;
    if (/\.(com|app|net|org|io)(\b|$)/i.test(trimmed) && !/\s/.test(trimmed)) return raw;

    const exact = lookup(trimmed);
    if (exact) return exact;

    return raw.replace(/[A-Za-z][A-Za-z0-9+]*/g, (tok) => {
      if (isExempt(tok) || I.isAllowedBrand?.(tok)) return tok;
      if (/^[A-Z]{2,10}$/.test(tok)) return tok;
      const hit = lookup(tok);
      if (hit && !hit.includes(tok)) return hit;
      if (hit && I.hasArabic?.(hit) && /^[A-Z]{2,10}$/.test(tok)) return tok;
      if (hit && !new RegExp(tok, 'i').test(hit)) return hit;
      return translateWord(tok);
    });
  };

  const TYPE_HINTS = {
    status: true,
    type: true,
    engine: true,
    source: true,
    priority: true,
    role: true,
    plan: true,
    system: true,
    permission: true,
    category: true,
    impact: true,
    severity: true,
    workflow: true,
    notification: true,
    payment: true,
    publish: true,
    approval: true,
    content: true,
    default: true,
  };

  const getArabicLabel = (type, value) => {
    const raw = value == null ? '' : String(value).trim();
    if (!raw) return '—';
    if (isExempt(raw)) return raw;
    if (I.hasArabic?.(raw) && !/[A-Za-z]{3,}/.test(raw)) return raw;

    const typed = type && TYPE_HINTS[type] ? lookup(raw) : lookup(raw);
    if (typed) return typed;

    if (/_/.test(raw) && !isExempt(raw)) {
      const parts = raw.split('_').map((p) => {
        if (!p) return p;
        if (I.hasArabic?.(p) && !/[A-Za-z]/.test(p)) return p;
        return lookup(p) || translateWord(p) || p;
      });
      const joined = parts.join(' · ');
      if (joined !== raw && /[\u0600-\u06FF]/.test(joined)) return joined;
    }

    if (type === 'status' && I.status) {
      const st = I.status(raw, null);
      if (st && st !== raw && I.hasArabic?.(st)) return st;
    }
    if (type === 'role' && I.role) {
      const r = I.role(raw, null);
      if (r && r !== raw && I.hasArabic?.(r)) return r;
    }
    if (type === 'plan' && I.plan) {
      const p = I.plan(raw, null);
      if (p && p !== raw && I.hasArabic?.(p)) return p;
    }
    if (type === 'system' && I.system) {
      const sys = I.system(raw, null);
      if (sys && sys !== raw) return sys;
    }

    const localized = localizeText(raw);
    if (localized && localized !== raw) return localized;
    if (I.hasArabic?.(localized) || !/[A-Za-z]{3,}/.test(localized)) return localized || raw;
    return localized || raw;
  };

  const shouldSkipNode = (el) => {
    if (!el) return true;
    if (el.closest && el.closest('[data-i18n-skip]')) return true;
    let n = el;
    while (n) {
      if (SKIP_TAGS.has(n.tagName)) return true;
      n = n.parentElement;
    }
    return false;
  };

  const applyToTextNode = (node) => {
    if (!node || node.nodeType !== 3) return;
    const parent = node.parentElement;
    if (!parent || shouldSkipNode(parent)) return;
    if (parent.isContentEditable) return;
    const cur = node.nodeValue;
    if (!cur || !/[A-Za-z]/.test(cur)) return;
    const next = localizeText(cur);
    if (next !== cur) node.nodeValue = next;
  };

  const applyToElement = (el) => {
    if (!el || el.nodeType !== 1 || shouldSkipNode(el)) return;
    ATTRS.forEach((attr) => {
      if (!el.hasAttribute(attr)) return;
      const v = el.getAttribute(attr);
      if (!v || !/[A-Za-z]/.test(v)) return;
      const n = localizeText(v);
      if (n !== v) el.setAttribute(attr, n);
    });
  };

  const applyDisplayLayer = (root) => {
    const start = root || (typeof document !== 'undefined' ? document.body : null);
    if (!start) return;
    if (start.nodeType === 3) {
      applyToTextNode(start);
      return;
    }
    applyToElement(start);
    const walker = document.createTreeWalker(start, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    const list = [];
    while (walker.nextNode()) list.push(walker.currentNode);
    list.forEach((n) => {
      if (n.nodeType === 3) applyToTextNode(n);
      else applyToElement(n);
    });
  };

  const origLabel = I.label.bind(I);
  I.label = (englishLabel, arabicFallback) => {
    const k = String(englishLabel || '').trim();
    if (!k) return arabicFallback || '';
    const mapped = getArabicLabel('default', k);
    if (mapped && mapped !== k && (I.hasArabic?.(mapped) || mapped !== k)) {
      if (mapped !== k) return mapped;
    }
    return origLabel(englishLabel, arabicFallback);
  };

  const origStatus = I.status.bind(I);
  I.status = (code, fallback) => {
    const mapped = getArabicLabel('status', code);
    if (mapped && mapped !== String(code || '').trim()) return mapped;
    return origStatus(code, fallback);
  };

  I.getArabicLabel = getArabicLabel;
  I.localizeText = localizeText;
  I.applyDisplayLayer = applyDisplayLayer;
  I.isExempt = isExempt;
  I.display = (v, type) => getArabicLabel(type || 'default', v);
  I.INDEX_SIZE = INDEX.size;

  const install = () => {
    if (typeof document === 'undefined' || !document.body) return;
    applyDisplayLayer(document.body);
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
  }
})();
