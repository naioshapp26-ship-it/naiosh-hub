/**
 * صفحات مركز المعلومات — مصدر موحّد لفهرسة محرك البحث وقائمة قدرات الهوب.
 * المطلوب: كل صفحة من مركز المعلومات تظهر في مركز البحث.
 */
(() => {
  'use strict';

  const SHARED_KEYWORDS =
    'مركز معلومات نايوش هوب مركز المعرفة محرك البحث معرفة تشغيل تعلم سياسات أدلة مواصفات مراجعة توجيه وصف وظيفي هوب';

  const PAGES = [
    {
      id: 'info-home',
      href: 'hub-checklist.html',
      title: 'مركز معلومات نايوش هوب',
      shortTitle: 'مركز المعلومات',
      subtitle: 'ابدأ هنا: التعريف · السياسات · المواصفات · الأدلة',
      icon: 'fa-circle-info',
      keywords: 'ماذا يعني هوب نظرة عامة مركز معلومات تعريف',
    },
    {
      id: 'info-specs',
      href: 'engine-specs.html',
      title: 'المواصفات الوظيفية لنايوش هوب',
      shortTitle: 'المواصفات',
      subtitle: 'مكونات المحرك ووظيفة كل جزء بلغة مفهومة',
      icon: 'fa-gears',
      keywords: 'مواصفات محرك تكامل API وظائف متطلبات',
    },
    {
      id: 'info-policies',
      href: 'policies.html',
      title: 'سياسات نايوش هوب',
      shortTitle: 'السياسات',
      subtitle: 'السياسات والإجراءات والخصوصية وأمن المعلومات',
      icon: 'fa-scroll',
      keywords: 'سياسة سياسات إجراءات خصوصية أمن معلومات حوكمة',
    },
    {
      id: 'info-manuals',
      href: 'ops-manuals.html',
      title: 'منظومة الأدلة التشغيلية',
      shortTitle: 'الأدلة',
      subtitle: 'أدلة التشغيل لجميع الأنظمة والمنصات',
      icon: 'fa-book',
      keywords: 'دليل أدلة تشغيلية تشغيل مسار تنفيذي',
    },
    {
      id: 'info-review',
      href: 'review-methodology.html',
      title: 'منهجية المراجعة الهندسية',
      shortTitle: 'المراجعة',
      subtitle: 'مراجعة وحدات هوب وحالة التنفيذ حسب المراحل',
      icon: 'fa-clipboard-check',
      keywords: 'مراجعة هندسية وحدات محركات نضج قبول',
    },
    {
      id: 'info-checklist',
      href: 'hub-checklist.html#about-hub',
      title: 'ما هو نايوش هوب؟',
      shortTitle: 'ما هو هوب',
      subtitle: 'تعرّف على مفهوم نايوش هوب، ودوره، وكيف تعمل المنظومة',
      icon: 'fa-list-check',
      keywords: 'قائمة قدرات هوب ترتيب صفحات تم جزئي لسه',
    },
    {
      id: 'info-directives',
      href: 'directives.html',
      title: 'نظام التوجيه المركزي',
      shortTitle: 'التوجيه',
      subtitle: 'التوجيه المركزي وسجل القرارات التشغيلية',
      icon: 'fa-compass',
      keywords: 'توجيه مركزي قرارات سجل عمليات سيادي',
    },
    {
      id: 'info-roles',
      href: 'job-roles.html',
      title: 'مكتبة الأوصاف الوظيفية',
      shortTitle: 'الوصف الوظيفي',
      subtitle: 'الأدوار والمهارات والأوصاف الوظيفية داخل هوب',
      icon: 'fa-user-tie',
      keywords: 'وصف وظيفي أدوار مهارات وظيفة مهن قاموس',
    },
    {
      id: 'info-operating',
      href: 'operating.html',
      title: 'آلية تشغيل نايوش هوب',
      shortTitle: 'آلية التشغيل',
      subtitle: 'كيف يعمل هوب: طبقات · صلاحيات · تقارير · SSO',
      icon: 'fa-diagram-project',
      keywords: 'آلية تشغيل قطاعات تدفق أتمتة مراحل تأسيس',
    },
  ];

  const HREFS = PAGES.map((p) => p.href);

  const toSearchItems = () =>
    PAGES.map((page, idx) => ({
      id: `knowledge-${page.id}`,
      type: 'knowledge',
      typeAr: 'مركز المعلومات',
      icon: page.icon,
      title: page.title,
      pageTitle: page.title,
      subtitle: page.subtitle,
      meta: page.shortTitle,
      grantId: `INFO-${String(idx + 1).padStart(2, '0')}`,
      href: page.href,
      source: 'info-center',
      keywords: [SHARED_KEYWORDS, page.title, page.shortTitle, page.subtitle, page.keywords, page.href]
        .filter(Boolean)
        .join(' '),
    }));

  const toChecklistItems = () =>
    PAGES.map((page, idx) => ({
      id: `info-page-${page.id}`,
      label: `صفحة مركز المعلومات — ${page.shortTitle}`,
      status: 'done',
      href: page.href,
      hrefLabel: page.shortTitle,
      keywords: [SHARED_KEYWORDS, page.title, page.shortTitle, page.subtitle, page.keywords].join(' '),
      num: idx + 1,
    }));

  window.HubInfoCenterPages = {
    PAGES,
    HREFS,
    SHARED_KEYWORDS,
    toSearchItems,
    toChecklistItems,
  };
})();
