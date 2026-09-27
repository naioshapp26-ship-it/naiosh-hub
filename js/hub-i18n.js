/**
 * قاموس واجهة مركزي — نصوص العرض بالعربية فقط
 * لا يغيّر قيم Backend / enums / API keys
 */
(() => {
  'use strict';

  const STATUS = {
    active: 'نشط',
    inactive: 'غير نشط',
    pending: 'قيد الانتظار',
    pending_review: 'بانتظار المراجعة',
    waiting: 'قيد الانتظار',
    approved: 'تمت الموافقة',
    rejected: 'مرفوض',
    archived: 'مؤرشف',
    enabled: 'مفعّل',
    disabled: 'متوقف',
    suspended: 'موقوف',
    closed: 'مغلق',
    draft: 'مسودة',
    published: 'منشور',
    completed: 'مكتمل',
    complete: 'مكتمل',
    cancelled: 'ملغي',
    canceled: 'ملغي',
    open: 'مفتوح',
    new: 'جديد',
    running: 'قيد التشغيل',
    success: 'نجاح',
    passed: 'ناجح',
    failed: 'فشل',
    failure: 'فشل',
    error: 'خطأ',
    queued: 'في الانتظار',
    expired: 'منتهي',
    paused: 'متوقف مؤقتًا',
    ready: 'جاهز',
    building: 'قيد البناء',
    planned: 'مخطط',
    todo: 'مطلوب',
    in_progress: 'قيد التنفيذ',
    'in-progress': 'قيد التنفيذ',
    blocked: 'موقوف',
    done: 'مكتمل',
    deferred: 'مؤجّل',
    stopped: 'متوقف',
    beta: 'تجريبي',
    scheduled: 'مجدول',
    review: 'قيد المراجعة',
    online: 'متصل',
    offline: 'غير متصل',
    degraded: 'متدهور',
    connected: 'متصل',
    disconnected: 'غير متصل',
    partial: 'جزئي',
    warning: 'تحذير',
    critical: 'حرج',
    investigating: 'قيد التحقيق',
    overdue: 'متأخر',
    acknowledged: 'مُقرّ',
    executed: 'منفَّذ',
    updating: 'جاري التحديث',
    indexed: 'مفهرس',
    hidden: 'مخفي',
    visible: 'ظاهر',
  };

  const ROLES = {
    admin: 'مدير النظام',
    super_admin: 'المدير الأعلى',
    supreme_leader: 'القائد الأعلى',
    chief_engineer: 'المهندس الرئيس',
    platform_owner: 'مالك المنصة',
    manager: 'مدير',
    system_manager: 'مدير نظام',
    employee: 'موظف',
    staff: 'موظف',
    customer: 'عميل',
    client: 'عميل',
    visitor: 'زائر',
    guest: 'ضيف',
    supervisor: 'مشرف',
    country_agent: 'وكيل دولة',
    branch_manager: 'مدير فرع',
    incubator_manager: 'مدير حاضنة',
    platform_manager: 'مدير منصة',
    digital_office: 'مستخدم مكتب إلكتروني',
    trainer: 'مدرب',
    trainee: 'متدرب',
  };

  const COMMON = {
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
    reset: 'إعادة ضبط',
    clear: 'مسح',
    confirm: 'تأكيد',
    back: 'رجوع',
    close: 'إغلاق',
    actions: 'الإجراءات',
    status: 'الحالة',
    name: 'الاسم',
    email: 'البريد الإلكتروني',
    phone: 'رقم الهاتف',
    role: 'الدور',
    permissions: 'الصلاحيات',
    system: 'النظام',
    module: 'الوحدة',
    service: 'الخدمة',
    layer: 'الطبقة',
    dashboard: 'لوحة التحكم',
    department: 'القسم',
    createdAt: 'تاريخ الإنشاء',
    updatedAt: 'آخر تحديث',
    lastLogin: 'آخر تسجيل دخول',
    loading: 'جارٍ التحميل...',
    success: 'تمت العملية بنجاح',
    error: 'حدث خطأ',
    errorGeneric: 'حدث خطأ أثناء تنفيذ العملية',
    noData: 'لا توجد بيانات',
    noResults: 'لا توجد نتائج',
    accessDenied: 'ليس لديك صلاحية للوصول',
    unauthorized: 'يجب تسجيل الدخول',
    required: 'هذا الحقل مطلوب',
    invalid: 'القيمة المدخلة غير صحيحة',
    requiredField: 'هذا الحقل مطلوب',
    invalidEmail: 'البريد الإلكتروني غير صحيح',
    noCustomers: 'لا يوجد عملاء',
    noRequests: 'لا توجد طلبات',
    yes: 'نعم',
    no: 'لا',
    all: 'الكل',
    notes: 'ملاحظات',
    description: 'الوصف',
    type: 'النوع',
    priority: 'الأولوية',
    employeeNo: 'رقم الموظف',
    clientId: 'رقم العميل',
    naioshId: 'رقم نايوش',
    progress: 'التقدم',
    component: 'المكوّن',
    next: 'التالي',
    previous: 'السابق',
    submit: 'إرسال',
    export: 'تصدير',
    import: 'استيراد',
    refresh: 'تحديث',
    details: 'التفاصيل',
    settings: 'الإعدادات',
  };

  /** مصطلحات دستور المعمارية والمكونات — مفتاح إنجليزي داخلي → عرض عربي */
  const LABELS = {
    // Layers
    'Core Layer': 'الطبقة الأساسية',
    'Business Layer': 'طبقة الأعمال',
    'Collaboration Layer': 'طبقة التعاون',
    'Knowledge Layer': 'طبقة المعرفة',
    'Governance Layer': 'طبقة الحوكمة',
    'Integration Layer': 'طبقة الربط',
    'Security Layer': 'طبقة الأمن',
    // Core platform components
    'NAIOSH ID': 'هوية نايوش',
    'Single Sign-On': 'تسجيل الدخول الموحد',
    IAM: 'إدارة الهوية والصلاحيات',
    'Role Matrix Engine': 'محرك مصفوفة القواعد',
    'Rules Smart Engine': 'محرك القواعد الذكي',
    'Multi-Tenant Engine': 'محرك تعدد المستأجرين',
    'Organization Hierarchy': 'الهيكل التنظيمي',
    'Notification Center': 'مركز الإشعارات',
    'Audit & Activity Log': 'سجل التدقيق والنشاط',
    'Settings & Configuration': 'الإعدادات والتكوين',
    'Language & Localization': 'اللغة والتعريب',
    // Axes / stack
    'Core Platform': 'النواة المشتركة',
    'Identity & SSO': 'الهوية وتسجيل الدخول الموحد',
    'Identity & Access': 'الهوية والوصول',
    'Organization Engine': 'محرك التنظيم',
    Notifications: 'الإشعارات',
    Audit: 'التدقيق',
    Settings: 'الإعدادات',
    'API Gateway': 'بوابة واجهات البرمجة',
    'Event Bus': 'ناقل الأحداث',
    Connectors: 'الموصّلات',
    'Governance Center': 'مركز الحوكمة',
    KPI: 'مؤشرات الأداء',
    Compliance: 'الامتثال',
    Risk: 'المخاطر',
    'Executive Reports': 'تقارير القيادة',
    'Incubator Management': 'إدارة الحاضنات',
    'Platform & Digital Offices': 'المنصات والمكاتب الرقمية',
    'Learning Ecosystem': 'منظومة التعلّم',
    'Marketing Network': 'شبكة التسويق',
    'Events Studio': 'استديو الفعاليات',
    'CRM & Customer Success': 'إدارة علاقات العملاء ونجاح العميل',
    'Points Economy': 'اقتصاد النقاط',
    'Knowledge Bank': 'بنك المعرفة',
    'AI Services': 'خدمات الذكاء الاصطناعي',
    'Analytics & BI': 'التحليلات وذكاء الأعمال',
    'Mobile Super App': 'التطبيق الموحد',
    'Unified Dashboard': 'لوحة التحكم الموحدة',
    'Global Structure Engine': 'محرك الهيكل المؤسسي العالمي',
    'Global Command Center': 'مركز التحكم العالمي',
    'System Marketplace': 'سوق الأنظمة التشغيلية',
    'NAIOSH Wallet': 'محفظة نايوش',
    'Marketing Studio': 'استديو التسويق',
    'Network Marketing Engine': 'محرك التسويق التشابكي',
    'Global Knowledge Center': 'مركز المعرفة العالمي',
    'NAIOSH AI Core': 'الذكاء الاصطناعي المركزي لنايوش',
    'CRM & Service Center': 'مركز خدمة العملاء',
    'Governance & Analytics': 'التحليلات والحوكمة',
    // Docs
    'Data Dictionary': 'قاموس البيانات',
    'Permission Matrix': 'مصفوفة الصلاحيات',
    'System Integration Map': 'خريطة تكامل الأنظمة',
    'User Journey Maps': 'خرائط رحلة المستخدم',
    'API Architecture': 'معمارية واجهات البرمجة',
    'Branch & Incubator Model': 'نموذج الفروع والحاضنات',
    'Wallet Model': 'نموذج المحفظة',
    'AI Architecture': 'معمارية الذكاء الاصطناعي',
    // Stack children / misc
    Content: 'المحتوى',
    Campaigns: 'الحملات',
    Affiliate: 'التسويق بالعمولة',
    LMS: 'نظام إدارة التعلّم',
    LXP: 'منصة تجربة التعلّم',
    'AI Tutor': 'المعلّم الذكي',
    Certificates: 'الشهادات',
    Gateway: 'البوابة',
    'Document AI': 'ذكاء المستندات',
    Predictive: 'التنبؤ',
    'Data Lake': 'بحيرة البيانات',
    ETL: 'استخراج وتحويل وتحميل',
    Dashboards: 'لوحات المؤشرات',
    OAuth2: 'مصادقة OAuth2',
    MFA: 'المصادقة الثنائية',
    SIEM: 'مراقبة الأمن SIEM',
    SSO: 'تسجيل الدخول الموحد',
    // Site settings leftovers
    'Request ID Format': 'صيغة رقم الطلب',
    'Require Admin Approval': 'يتطلب موافقة الإدارة',
    'Default Request Status': 'الحالة الافتراضية للطلب',
    'Default Status': 'الحالة الافتراضية',
    Priority: 'الأولوية',
    'Auto Assign': 'التعيين التلقائي',
    'Auto Assignment': 'التعيين التلقائي',
    'Default Department': 'القسم الافتراضي',
    'Request Notifications': 'إشعارات الطلبات',
    'Customer Request Routing': 'توجيه طلبات العملاء',
    'Site Logo': 'شعار الموقع',
    Favicon: 'أيقونة المتصفح',
    Timezone: 'المنطقة الزمنية',
    'Date Format': 'صيغة التاريخ',
    'Support Email': 'بريد الدعم',
    'Support Phone': 'هاتف الدعم',
    'Maintenance Mode': 'وضع الصيانة',
    'Default Currency': 'العملة الافتراضية',
    'Payment Methods': 'طرق الدفع',
    'Tax Settings': 'إعدادات الضريبة',
    'Tax Rate %': 'نسبة الضريبة %',
    'Invoice Settings (prefix)': 'بادئة رقم الفاتورة',
    'Refund Rules (days)': 'مهلة الاسترداد (أيام)',
    'Payment Notifications': 'إشعارات الدفع',
    'Payment Status Rules': 'قواعد حالة الدفع',
    'Enable Shipping': 'تفعيل الشحن',
    'Shipping Methods': 'طرق الشحن',
    'Shipping Regions': 'مناطق الشحن',
    'Shipping Fees': 'رسوم الشحن',
    'Free Shipping Rules (min USD)': 'حد الشحن المجاني (بالدولار)',
    'Estimated Delivery Time': 'وقت التوصيل المتوقع',
    'Tracking Settings': 'إعدادات التتبع',
    'Enable Advertisements': 'تفعيل الإعلانات',
    'Allowed Ad Types': 'أنواع الإعلانات المسموحة',
    'Maximum Image Size (MB)': 'الحد الأقصى لحجم الصورة (ميجابايت)',
    'Maximum Video Size (MB)': 'الحد الأقصى لحجم الفيديو (ميجابايت)',
    'Maximum File Size (MB)': 'الحد الأقصى لحجم الملف (ميجابايت)',
    'Default Ad Duration (days)': 'مدة الإعلان الافتراضية (أيام)',
    'Ad Placements': 'مواضع الإعلان',
    'CTA Types': 'أنواع الدعوة للإجراء',
    'Auto Expiration': 'انتهاء تلقائي',
    'Enable Articles': 'تفعيل المقالات',
    'Require Article Approval': 'يتطلب موافقة على المقال',
    'Article Categories': 'تصنيفات المقالات',
    'Allowed Upload Types': 'أنواع الملفات المسموحة',
    'Maximum Attachment Size (MB)': 'الحد الأقصى للمرفق (ميجابايت)',
    'Publishing Workflow': 'مسار النشر',
    'Moderation Settings': 'إعدادات الإشراف',
    'In-App Notifications': 'إشعارات داخل التطبيق',
    'Email Notifications': 'إشعارات البريد',
    'SMS Notifications': 'إشعارات الرسائل النصية',
    'Push Notifications': 'إشعارات الدفع',
    'Notification Templates': 'قوالب الإشعارات',
    'New Request': 'طلب جديد',
    'Request Approved': 'تمت الموافقة على الطلب',
    'Request Rejected': 'تم رفض الطلب',
    'Article Approved': 'تمت الموافقة على المقال',
    'Advertisement Approved': 'تمت الموافقة على الإعلان',
    'Product Approved': 'تمت الموافقة على المنتج',
    APIs: 'واجهات البرمجة (API)',
    Webhooks: 'خطافات الويب',
    'External Systems': 'الأنظمة الخارجية',
    'Connection Status': 'حالة الاتصال',
    'Last Sync': 'آخر مزامنة',
    'Sync Settings (minutes)': 'فترة المزامنة (دقائق)',
    'Session Timeout (min)': 'انتهاء الجلسة (دقائق)',
    'Password Policy (min length)': 'سياسة كلمة المرور (الحد الأدنى للطول)',
    'Login Attempts': 'محاولات تسجيل الدخول',
    'Account Lockout (min)': 'قفل الحساب (دقائق)',
    'IP Restrictions': 'قيود عناوين IP',
    'Audit Logging': 'تسجيل التدقيق',
    'Site Title': 'عنوان الموقع',
    'Meta Description': 'الوصف التعريفي',
    Keywords: 'الكلمات المفتاحية',
    'Open Graph': 'صورة المشاركة (Open Graph)',
    'Canonical URLs (base)': 'الرابط الأساسي المعتمد',
    'Search Engine Indexing': 'فهرسة محركات البحث',
    Sitemap: 'خريطة الموقع',
    'Robots Settings': 'إعدادات Robots',
    'Require Product URL': 'يتطلب رابط المنتج',
    'Allow External Stores': 'السماح بالمتاجر الخارجية',
    'Allow Customer To Add Product': 'السماح للعميل بإضافة منتج',
    'Allow Customer To Suggest New Store': 'السماح للعميل باقتراح متجر جديد',
    'Open External Links In New Tab': 'فتح الروابط الخارجية في تبويب جديد',
    'Store Status': 'حالة المتجر',
    'Products Per Page': 'عدد المنتجات في الصفحة',
    'Default View': 'العرض الافتراضي',
    'Currency Display': 'عرض العملة',
    'Show Store Logo': 'إظهار شعار المتجر',
    'Show Store Name': 'إظهار اسم المتجر',
    'Show Product Source': 'إظهار مصدر المنتج',
    'Show Product Price': 'إظهار سعر المنتج',
    'Enable Search': 'تفعيل البحث',
    'Enable Filters': 'تفعيل الفلاتر',
    'Enable Reviews': 'تفعيل التقييمات',
    'Enable Product Sharing': 'تفعيل مشاركة المنتج',
    Enabled: 'مفعّل',
    Disabled: 'متوقف',
    Active: 'نشط',
    Inactive: 'غير نشط',
    Grid: 'شبكة',
    List: 'قائمة',
    'Transaction ID': 'رقم العملية',
    Section: 'القسم',
    Action: 'الإجراء',
    'Old Value': 'القيمة السابقة',
    'New Value': 'القيمة الجديدة',
    'Changed By': 'عدّلها',
    Role: 'الدور',
    Date: 'التاريخ',
    Time: 'الوقت',
    'View Site Settings': 'عرض إعدادات الموقع',
    'Manage Site Settings': 'إدارة إعدادات الموقع',
    'Manage Stores': 'إدارة المتاجر',
    'Create Store': 'إنشاء متجر',
    'Edit Store': 'تعديل متجر',
    'Delete Store': 'حذف متجر',
    'Manage Products': 'إدارة المنتجات',
    'Approve Products': 'اعتماد المنتجات',
    'Manage Orders Settings': 'إدارة إعدادات الطلبات',
    'Manage Payment Settings': 'إدارة إعدادات الدفع',
    'Manage Shipping Settings': 'إدارة إعدادات الشحن',
    'Manage Ads Settings': 'إدارة إعدادات الإعلانات',
    'Manage Content Settings': 'إدارة إعدادات المحتوى',
    'Manage Notifications Settings': 'إدارة إعدادات الإشعارات',
    'Manage Integrations': 'إدارة التكاملات',
    'Manage Security Settings': 'إدارة إعدادات الأمان',
    'Manage SEO Settings': 'إدارة إعدادات تحسين البحث',
    'View Audit Log': 'عرض سجل التغييرات',
    Save: 'حفظ',
    Cancel: 'إلغاء',
    Delete: 'حذف',
    Edit: 'تعديل',
    Add: 'إضافة',
    Search: 'بحث',
    Filter: 'تصفية',
    Loading: 'جارٍ التحميل...',
    Status: 'الحالة',
    Layer: 'الطبقة',
    System: 'النظام',
    Module: 'الوحدة',
    Service: 'الخدمة',
    Dashboard: 'لوحة التحكم',
    Waiting: 'قيد الانتظار',
    Pending: 'قيد الانتظار',
    Passed: 'ناجح',
    Failed: 'فشل',
  };

  const BRAND_ALLOW = new Set([
    'NAIOSH',
    'NAIOSHAI',
    'NAIOSH HUB',
    'NAIOSH HUB 360',
    'NAIOSHAI HUB',
    'NAIOSHAI HUB 360',
    'HUB 360',
    'HUB',
    'Google',
    'USD',
    'ERP',
    'CRM',
    'API',
    'SMS',
    'SEO',
    'IP',
    'URL',
    'ID',
    'NAIS',
    'FIT',
    'LAW',
    'OAuth2',
    'SIEM',
    'KPI',
    'MFA',
    'SSO',
    'LMS',
    'LXP',
    'ETL',
  ]);

  const normalizeKey = (k) => String(k || '').trim();

  const hasArabic = (s) => /[\u0600-\u06FF]/.test(String(s || ''));

  const t = (key, fallback) => {
    const k = normalizeKey(key);
    if (!k) return fallback || '';
    if (COMMON[k] != null) return COMMON[k];
    if (COMMON[k.toLowerCase()] != null) return COMMON[k.toLowerCase()];
    if (STATUS[k.toLowerCase()] != null) return STATUS[k.toLowerCase()];
    if (ROLES[k.toLowerCase()] != null) return ROLES[k.toLowerCase()];
    if (LABELS[k] != null) return LABELS[k];
    if (fallback != null) return fallback;
    return k;
  };

  const status = (code, fallback) => {
    const raw = String(code || '').trim();
    if (!raw) return fallback || '—';
    if (hasArabic(raw)) return raw;
    const k = raw.toLowerCase().replace(/\s+/g, '_');
    return STATUS[k] || STATUS[raw.toLowerCase()] || fallback || LABELS[raw] || raw;
  };

  const role = (code, fallback) => {
    const k = String(code || '')
      .toLowerCase()
      .replace(/\s+/g, '_');
    return ROLES[k] || fallback || t(code, String(code || '—'));
  };

  const label = (englishLabel, arabicFallback) => {
    const k = normalizeKey(englishLabel);
    if (!k) return arabicFallback || '';
    if (hasArabic(k)) return k;
    if (LABELS[k] != null) return LABELS[k];
    if (BRAND_ALLOW.has(k)) return k;
    return arabicFallback || k;
  };

  /** اسم العرض: يفضّل nameAr ثم label(name) */
  const displayName = (item, opts = {}) => {
    if (!item) return opts.fallback || '—';
    if (typeof item === 'string') return label(item, opts.fallback);
    const ar = item.nameAr || item.titleAr || item.labelAr || item.title || '';
    if (ar && hasArabic(ar) && !opts.preferMapped) return ar;
    const en = item.name || item.title || item.label || item.axis || '';
    const mapped = label(en, ar || opts.fallback);
    if (mapped) return mapped;
    return ar || en || opts.fallback || '—';
  };

  const isAllowedBrand = (s) => BRAND_ALLOW.has(String(s || '').trim());

  /** هل النص يبدو عبارة واجهة إنجليزية (وليس علامة تجارية/كود)؟ */
  const looksLikeUiEnglish = (text) => {
    const s = String(text || '').trim();
    if (!s || s.length < 2) return false;
    if (hasArabic(s)) return false;
    if (BRAND_ALLOW.has(s)) return false;
    if (/@/.test(s) || /^https?:/i.test(s) || /^\d+(\.\d+)?%?$/.test(s)) return false;
    // قاموس الواجهة أولًا (قبل استثناء الأكواد القصيرة مثل Save)
    if (LABELS[s] != null || STATUS[s.toLowerCase()] != null || COMMON[s.toLowerCase()] != null) return true;
    if (/^(Save|Cancel|Delete|Edit|Add|Search|Filter|Status|Loading|Waiting|Pending|Failed|Passed|Active|Inactive)$/i.test(s))
      return true;
    // أكواد تقنية قصيرة بلا مسافات
    if (/^[A-Z0-9._-]{2,}$/i.test(s) && !/\s/.test(s) && s.length <= 12) return false;
    // عبارات إنجليزية متعددة الكلمات
    if (/^[A-Za-z][A-Za-z0-9+&/.-]*(?:\s+[A-Za-z][A-Za-z0-9+&/.-]*)+$/.test(s)) return true;
    return false;
  };

  window.HubI18n = {
    t,
    status,
    role,
    label,
    displayName,
    looksLikeUiEnglish,
    hasArabic,
    STATUS,
    ROLES,
    COMMON,
    LABELS,
    isAllowedBrand,
    BRAND_ALLOW,
  };
})();
