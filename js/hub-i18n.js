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
    approved: 'تمت الموافقة',
    rejected: 'مرفوض',
    archived: 'مؤرشف',
    enabled: 'مفعّل',
    disabled: 'معطّل',
    suspended: 'موقوف',
    closed: 'مغلق',
    draft: 'مسودة',
    published: 'منشور',
    completed: 'مكتمل',
    cancelled: 'ملغي',
    canceled: 'ملغي',
    open: 'مفتوح',
    new: 'جديد',
    running: 'قيد التشغيل',
    success: 'نجاح',
    failed: 'فشل',
    queued: 'في الانتظار',
    expired: 'منتهي',
    paused: 'متوقف',
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
  };

  const LABELS = {
    // Site settings — orders
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
    // general
    'Site Logo': 'شعار الموقع',
    Favicon: 'أيقونة المتصفح',
    Timezone: 'المنطقة الزمنية',
    'Date Format': 'صيغة التاريخ',
    'Support Email': 'بريد الدعم',
    'Support Phone': 'هاتف الدعم',
    'Maintenance Mode': 'وضع الصيانة',
    // payment
    'Default Currency': 'العملة الافتراضية',
    'Payment Methods': 'طرق الدفع',
    'Tax Settings': 'إعدادات الضريبة',
    'Tax Rate %': 'نسبة الضريبة %',
    'Invoice Settings (prefix)': 'بادئة رقم الفاتورة',
    'Refund Rules (days)': 'مهلة الاسترداد (أيام)',
    'Payment Notifications': 'إشعارات الدفع',
    'Payment Status Rules': 'قواعد حالة الدفع',
    // shipping
    'Enable Shipping': 'تفعيل الشحن',
    'Shipping Methods': 'طرق الشحن',
    'Shipping Regions': 'مناطق الشحن',
    'Shipping Fees': 'رسوم الشحن',
    'Free Shipping Rules (min USD)': 'حد الشحن المجاني (بالدولار)',
    'Estimated Delivery Time': 'وقت التوصيل المتوقع',
    'Tracking Settings': 'إعدادات التتبع',
    // ads
    'Enable Advertisements': 'تفعيل الإعلانات',
    'Allowed Ad Types': 'أنواع الإعلانات المسموحة',
    'Maximum Image Size (MB)': 'الحد الأقصى لحجم الصورة (ميجابايت)',
    'Maximum Video Size (MB)': 'الحد الأقصى لحجم الفيديو (ميجابايت)',
    'Maximum File Size (MB)': 'الحد الأقصى لحجم الملف (ميجابايت)',
    'Default Ad Duration (days)': 'مدة الإعلان الافتراضية (أيام)',
    'Ad Placements': 'مواضع الإعلان',
    'CTA Types': 'أنواع الدعوة للإجراء',
    'Auto Expiration': 'انتهاء تلقائي',
    // content
    'Enable Articles': 'تفعيل المقالات',
    'Require Article Approval': 'يتطلب موافقة على المقال',
    'Article Categories': 'تصنيفات المقالات',
    'Allowed Upload Types': 'أنواع الملفات المسموحة',
    'Maximum Attachment Size (MB)': 'الحد الأقصى للمرفق (ميجابايت)',
    'Publishing Workflow': 'مسار النشر',
    'Moderation Settings': 'إعدادات الإشراف',
    // notifications
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
    // integrations
    APIs: 'واجهات البرمجة (API)',
    Webhooks: 'خطافات الويب',
    'External Systems': 'الأنظمة الخارجية',
    'Connection Status': 'حالة الاتصال',
    'Last Sync': 'آخر مزامنة',
    'Sync Settings (minutes)': 'فترة المزامنة (دقائق)',
    // security
    'Session Timeout (min)': 'انتهاء الجلسة (دقائق)',
    'Password Policy (min length)': 'سياسة كلمة المرور (الحد الأدنى للطول)',
    MFA: 'المصادقة الثنائية',
    'Login Attempts': 'محاولات تسجيل الدخول',
    'Account Lockout (min)': 'قفل الحساب (دقائق)',
    'IP Restrictions': 'قيود عناوين IP',
    'Audit Logging': 'تسجيل التدقيق',
    // seo
    'Site Title': 'عنوان الموقع',
    'Meta Description': 'الوصف التعريفي',
    Keywords: 'الكلمات المفتاحية',
    'Open Graph': 'صورة المشاركة (Open Graph)',
    'Canonical URLs (base)': 'الرابط الأساسي المعتمد',
    'Search Engine Indexing': 'فهرسة محركات البحث',
    Sitemap: 'خريطة الموقع',
    'Robots Settings': 'إعدادات Robots',
    // store
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
    Disabled: 'معطّل',
    Grid: 'شبكة',
    List: 'قائمة',
    // audit
    'Transaction ID': 'رقم العملية',
    Section: 'القسم',
    Action: 'الإجراء',
    'Old Value': 'القيمة السابقة',
    'New Value': 'القيمة الجديدة',
    'Changed By': 'عدّلها',
    Role: 'الدور',
    Date: 'التاريخ',
    Time: 'الوقت',
    // permissions
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
  };

  const BRAND_ALLOW = new Set([
    'NAIOSH',
    'NAIOSHAI',
    'NAIOSH HUB',
    'NAIOSH HUB 360',
    'NAIOSHAI HUB',
    'NAIOSHAI HUB 360',
    'HUB 360',
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
  ]);

  const normalizeKey = (k) => String(k || '').trim();

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
    const k = String(code || '').toLowerCase();
    return STATUS[k] || fallback || t(code, String(code || '—'));
  };

  const role = (code, fallback) => {
    const k = String(code || '')
      .toLowerCase()
      .replace(/\s+/g, '_');
    return ROLES[k] || fallback || t(code, String(code || '—'));
  };

  const label = (englishLabel, arabicFallback) => LABELS[normalizeKey(englishLabel)] || arabicFallback || englishLabel;

  const isAllowedBrand = (s) => BRAND_ALLOW.has(String(s || '').trim());

  window.HubI18n = {
    t,
    status,
    role,
    label,
    STATUS,
    ROLES,
    COMMON,
    LABELS,
    isAllowedBrand,
    BRAND_ALLOW,
  };
})();
