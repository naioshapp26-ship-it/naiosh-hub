/**
 * سجل أنظمة نايوش — روابط التشغيل المباشر + عبر هوب
 * الضغط على النظام يفتح بوابة النظام ذاته (standalone)،
 * مع خيار التشغيل تحت سيطرة هوب.
 */
(() => {
  const SYSTEMS = [
    {
      code: 'ERP',
      nameAr: 'نايوش إي آر بي',
      nameEn: 'Naiosh ERP',
      icon: 'fa-sitemap',
      category: 'أنظمة نايوش',
      color: '#d70000',
      desc: 'نظام إدارة الموارد المؤسسية — تشغيل مستقل أو عبر هوب.',
      modules: ['المبيعات', 'المخزون', 'المشتريات', 'المحاسبة', 'الفروع'],
    },
    {
      code: 'LAW',
      nameAr: 'نايوش لو — النظام القانوني',
      nameEn: 'Naiosh Law',
      icon: 'fa-gavel',
      category: 'أنظمة نايوش',
      color: '#8b1a1a',
      desc: 'النظام القانوني السيادي — قضايا، عقود، امتثال.',
      modules: ['القضايا', 'العقود', 'الاستشارات', 'الأرشيف'],
    },
    {
      code: 'FIT',
      nameAr: 'نايوش فيت — الصحة واللياقة',
      nameEn: 'Naiosh Fit',
      icon: 'fa-dumbbell',
      category: 'أنظمة نايوش',
      color: '#b91c1c',
      desc: 'إدارة اللياقة والاشتراكات الصحية.',
      modules: ['الأعضاء', 'الاشتراكات', 'البرامج', 'المدفوعات'],
    },
    {
      code: 'ACADEMY',
      nameAr: 'أكاديمية نايوش',
      nameEn: 'Naiosh Academy',
      icon: 'fa-chalkboard-user',
      category: 'أنظمة نايوش',
      color: '#991b1b',
      desc: 'التعليم والتدريب المؤسسي.',
      modules: ['الدورات', 'المتدربون', 'الشهادات', 'المدربون'],
    },
    {
      code: 'NAIS',
      nameAr: 'نايس — ذكاء التشغيل',
      nameEn: 'NAIS',
      icon: 'fa-chart-line',
      category: 'أنظمة نايوش',
      color: '#c2410c',
      desc: 'ذكاء التشغيل والتحليلات التنبؤية.',
      modules: ['التنبؤ', 'التوصيات', 'لوحات القرار'],
    },
    {
      code: 'LMS',
      nameAr: 'نظام التعلم',
      nameEn: 'LMS',
      icon: 'fa-laptop-code',
      category: 'أنظمة نايوش',
      color: '#9a3412',
      desc: 'منصة التعلم الإلكتروني.',
      modules: ['المسارات', 'المحتوى', 'التقييم'],
    },
    {
      code: 'CRM',
      nameAr: 'إدارة علاقات العملاء',
      nameEn: 'CRM',
      icon: 'fa-handshake',
      category: 'أنظمة نايوش',
      color: '#7f1d1d',
      desc: 'علاقات العملاء والفرص.',
      modules: ['العملاء', 'الفرص', 'التذاكر'],
    },
  ];

  const byCode = Object.fromEntries(SYSTEMS.map((s) => [s.code, s]));

  const portalUrl = (code, mode = 'standalone') =>
    `system-portal.html?code=${encodeURIComponent(code)}&mode=${encodeURIComponent(mode)}`;

  const resolveLaunch = (app = {}) => {
    const code = String(app.code || '').toUpperCase();
    const meta = byCode[code];
    if (meta) {
      return {
        standaloneUrl: portalUrl(code, 'standalone'),
        hubUrl: portalUrl(code, 'hub'),
        isExternalSystem: true,
        meta,
      };
    }
    const url = app.url || app.externalUrl || 'apps.html';
    return {
      standaloneUrl: url,
      hubUrl: url,
      isExternalSystem: false,
      meta: null,
    };
  };

  const enrichApp = (app = {}) => {
    const launch = resolveLaunch(app);
    return {
      ...app,
      url: launch.standaloneUrl,
      externalUrl: launch.standaloneUrl,
      hubLaunchUrl: launch.hubUrl,
      launchModes: ['standalone', 'hub'],
    };
  };

  window.HubSystemsRegistry = {
    SYSTEMS,
    byCode,
    portalUrl,
    resolveLaunch,
    enrichApp,
  };
})();
