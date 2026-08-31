/**
 * كتالوج خدماتنا — أسماء المربعات من شريحة ترتيب صفحات هوب
 * + خدمات يضيفها المستخدم (صور/فيديو حتى 150MB).
 */
(() => {
  'use strict';

  const KEY = 'naiosh_hub_services_catalog_v1';

  const DEFAULT_SERVICES = [
    { id: 'svc-studies', title: 'الدراسات', icon: 'fa-flask', relatedHref: 'publish-research.html', keywords: 'بحث دراسة دراسات' },
    { id: 'svc-free-consult', title: 'استشارة مجانية', icon: 'fa-comments', relatedHref: 'consultation.html', keywords: 'استشارة مجانية' },
    { id: 'svc-subscriptions', title: 'الاشتراكات', icon: 'fa-box', relatedHref: 'packages.html', keywords: 'باقات اشتراك' },
    { id: 'svc-branches', title: 'إدارة الفروع', icon: 'fa-code-branch', relatedHref: 'branches.html', keywords: 'فروع شبكة' },
    { id: 'svc-incubators', title: 'برامج الحاضنات', icon: 'fa-seedling', relatedHref: 'incubators.html', keywords: 'حاضنة برامج' },
    { id: 'svc-consulting', title: 'الاستشارات', icon: 'fa-user-tie', relatedHref: 'consultation.html', keywords: 'استشارات' },
    { id: 'svc-skills', title: 'إدارة المهارات', icon: 'fa-brain', relatedHref: 'courses.html', keywords: 'مهارات تدريب' },
    { id: 'svc-innovation', title: 'إدارة الابتكارات', icon: 'fa-lightbulb', keywords: 'ابتكار أفكار' },
    { id: 'svc-expertise', title: 'إدارة الخبرات', icon: 'fa-award', keywords: 'خبرات كفاءة' },
    { id: 'svc-talent', title: 'إدارة المواهب', icon: 'fa-star', keywords: 'مواهب كفاءات' },
    {
      id: 'svc-cost-cut',
      title: 'إدارة خفض التكاليف التشغيلية',
      icon: 'fa-chart-line',
      relatedHref: 'cost-reduction.html',
      keywords: 'تكاليف ساي فاي',
    },
    { id: 'svc-nocode', title: 'بناء الأنظمة بدون برمجة', icon: 'fa-cubes', keywords: 'بدون برمجة nocode' },
    { id: 'svc-cyber', title: 'الأمن السيبراني', icon: 'fa-shield-halved', keywords: 'أمن سيبراني حماية' },
    { id: 'svc-attachments', title: 'دمج المرفقات عند التحميل', icon: 'fa-paperclip', keywords: 'مرفقات تحميل' },
    { id: 'svc-bulk-msg', title: 'نظام الرسائل الجماعية', icon: 'fa-envelope-open-text', keywords: 'رسائل جماعية' },
    { id: 'svc-scanner', title: 'تكامل مع الماسح الضوئي', icon: 'fa-print', keywords: 'ماسح ضوئي سكانر' },
    { id: 'svc-quality-engine', title: 'محرك تقييم الجودة', icon: 'fa-gauge-high', relatedHref: 'quality.html', keywords: 'جودة تقييم' },
    { id: 'svc-chat', title: 'نظام الدردشة الكتابية', icon: 'fa-comment-dots', keywords: 'دردشة شات' },
    { id: 'svc-pmo', title: 'مكتب إدارة المشاريع', icon: 'fa-diagram-project', keywords: 'PMO مشاريع' },
    { id: 'svc-performance', title: 'إدارة الأداء المؤسسي', icon: 'fa-chart-pie', keywords: 'أداء مؤشرات' },
    { id: 'svc-ops-follow', title: 'متابعة العمليات', icon: 'fa-clipboard-list', relatedHref: 'operating.html', keywords: 'عمليات تشغيل' },
    { id: 'svc-ai-market', title: 'دراسة السوق عبر الذكاء الاصطناعي', icon: 'fa-robot', keywords: 'سوق ذكاء اصطناعي' },
    { id: 'svc-customers', title: 'خدمة العملاء', icon: 'fa-headset', relatedHref: 'support.html', keywords: 'عملاء دعم' },
    { id: 'svc-admin', title: 'الخدمات الإدارية', icon: 'fa-building', keywords: 'إدارية مكتب' },
    { id: 'svc-research', title: 'البحوث', icon: 'fa-microscope', relatedHref: 'publish-research.html', keywords: 'بحوث أبحاث' },
    { id: 'svc-consult-train', title: 'الاستشارات والتدريب', icon: 'fa-chalkboard-user', relatedHref: 'courses.html', keywords: 'تدريب استشارة' },
    { id: 'svc-risk', title: 'تقييم المخاطر', icon: 'fa-triangle-exclamation', keywords: 'مخاطر تقييم' },
    { id: 'svc-virtual-halls', title: 'القاعات الافتراضية', icon: 'fa-video', relatedHref: 'events.html', keywords: 'قاعات افتراضية' },
    { id: 'svc-feasibility', title: 'دراسات الجدوى', icon: 'fa-file-invoice-dollar', keywords: 'جدوى دراسة' },
    { id: 'svc-supportive', title: 'الخدمات المساندة', icon: 'fa-handshake-angle', keywords: 'مساندة دعم' },
    { id: 'svc-facilities', title: 'إدارة المرافق والفعاليات', icon: 'fa-calendar-check', relatedHref: 'events.html', keywords: 'مرافق فعاليات' },
    { id: 'svc-ads', title: 'إدارة الحملات الإعلانية', icon: 'fa-bullhorn', relatedHref: 'ads.html', keywords: 'إعلان حملات' },
    { id: 'svc-social', title: 'إدارة منصات التواصل', icon: 'fa-share-nodes', relatedHref: 'platforms.html', keywords: 'تواصل اجتماعي' },
    { id: 'svc-safety', title: 'خدمات الأمن والسلامة', icon: 'fa-helmet-safety', keywords: 'سلامة أمن' },
    { id: 'svc-supply', title: 'إدارة سلاسل الإمداد', icon: 'fa-truck', keywords: 'إمداد توريد' },
    { id: 'svc-tracking', title: 'تتبع الطلبات والشحنات', icon: 'fa-location-dot', keywords: 'شحن تتبع طلبات' },
    { id: 'svc-gov', title: 'الحوكمة والأتمتة', icon: 'fa-gears', keywords: 'حوكمة أتمتة' },
    { id: 'svc-audit', title: 'الجودة والتدقيق', icon: 'fa-clipboard-check', relatedHref: 'quality.html', keywords: 'تدقيق جودة' },
    { id: 'svc-ip', title: 'الملكية الفكرية', icon: 'fa-copyright', keywords: 'ملكية فكرية' },
    { id: 'svc-franchise', title: 'العقود والفرنشايز', icon: 'fa-file-contract', keywords: 'عقود فرنشايز' },
    { id: 'svc-sustain', title: 'الاستدامة', icon: 'fa-leaf', keywords: 'استدامة بيئة' },
    { id: 'svc-sysops', title: 'تشغيل الأنظمة', icon: 'fa-server', relatedHref: 'apps.html', keywords: 'تشغيل أنظمة' },
  ];

  const pageHref = (id) => `service.html?id=${encodeURIComponent(id)}`;

  const withDefaults = (item, custom = false) => ({
    id: item.id,
    title: String(item.title || '').trim(),
    icon: item.icon || 'fa-concierge-bell',
    description: String(item.description || '').trim(),
    keywords: String(item.keywords || '').trim(),
    relatedHref: String(item.relatedHref || '').trim(),
    imageUrl: String(item.imageUrl || '').trim(),
    videoUrl: String(item.videoUrl || '').trim(),
    custom,
    href: pageHref(item.id),
  });

  const readCustom = () => {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };

  const saveCustom = (list) => {
    localStorage.setItem(KEY, JSON.stringify(list));
    return list;
  };

  const uid = () => `svc-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const builtins = () => DEFAULT_SERVICES.map((s) => withDefaults(s, false));

  const customList = () => readCustom().map((s) => withDefaults(s, true));

  const list = () => [...customList(), ...builtins()];

  const get = (id) => list().find((s) => String(s.id) === String(id)) || null;

  const add = (payload = {}) => {
    const title = String(payload.title || '').trim();
    if (!title) return { ok: false, error: 'اسم الخدمة مطلوب' };
    const item = {
      id: payload.id || uid(),
      title,
      icon: String(payload.icon || 'fa-concierge-bell').trim() || 'fa-concierge-bell',
      description: String(payload.description || '').trim(),
      keywords: String(payload.keywords || title).trim(),
      relatedHref: String(payload.relatedHref || '').trim(),
      imageUrl: String(payload.imageUrl || '').trim(),
      videoUrl: String(payload.videoUrl || '').trim(),
      createdAt: new Date().toISOString(),
    };
    const all = readCustom();
    all.unshift(item);
    saveCustom(all);
    return { ok: true, item: withDefaults(item, true) };
  };

  const remove = (id) => {
    const next = readCustom().filter((s) => String(s.id) !== String(id));
    if (next.length === readCustom().length) return { ok: false, error: 'لا يمكن حذف الخدمات الأساسية' };
    saveCustom(next);
    return { ok: true };
  };

  const ingestFile = async (file, { onProgress } = {}) => {
    const limits = window.HubUploadLimits || {};
    if (!file) throw new Error('لا ملف');
    const check = limits.assertFile ? limits.assertFile(file) : { ok: true };
    if (!check.ok) throw new Error(check.error || 'حجم الملف غير مسموح');
    if (!limits.uploadFile) throw new Error('رفع الملفات يحتاج اتصالاً بالخادم');
    const uploaded = await limits.uploadFile(file, { onProgress });
    return { url: uploaded.url, mime: uploaded.mime || file.type, name: file.name };
  };

  const toSearchItems = () =>
    list().map((svc) => ({
      id: svc.id,
      type: 'service',
      typeAr: 'خدمة',
      icon: svc.icon,
      title: svc.title,
      pageTitle: svc.title,
      subtitle: svc.description || 'خدمة من كتالوج خدماتنا',
      meta: 'خدماتنا',
      href: svc.href,
      preview: svc.imageUrl || '',
      source: 'services',
      keywords: ['خدماتنا', 'خدمة', 'خدمات', svc.title, svc.keywords, svc.id].filter(Boolean).join(' '),
    }));

  window.HubServicesCatalog = {
    DEFAULT_SERVICES,
    KEY,
    pageHref,
    list,
    get,
    add,
    remove,
    ingestFile,
    toSearchItems,
  };
})();
