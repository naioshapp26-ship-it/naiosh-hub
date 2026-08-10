/**
 * Naiosh Hub 360 — Central Operational Store (Imperial Edition)
 * Driven by EmpireBlueprint: Core Platform + 12 axes + org hierarchy + wallet.
 * Persists to localStorage.
 */
const HubStore = (() => {
  const KEY = 'naioshHub360Store_v13';

  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const nowIso = () => new Date().toISOString();
  const today = () => new Date().toLocaleDateString('ar-EG');

  const seedEmpire = () => {
    const bp = window.EmpireBlueprint;
    const coreModules = (bp?.corePlatform || []).map((m, i) => ({
      ...m,
      status: i < 5 ? 'building' : 'planned',
      progress: i < 5 ? Math.max(12, 72 - i * 10) : 0,
    }));
    const axes = (bp?.twelveAxes || []).map((a) => ({
      id: a.id,
      nameAr: a.nameAr,
      priority: a.priority,
      status: a.priority <= 5 ? 'active' : a.priority <= 8 ? 'queued' : 'deferred',
      progress: a.priority <= 5 ? Math.max(8, 55 - a.priority * 7) : 0,
    }));
    const priorities = (bp?.sixMonthPriorities || []).map((p) => ({
      ...p,
      status: p.order <= 4 ? 'in_progress' : 'pending',
      progress: p.order <= 4 ? Math.max(10, 48 - p.order * 6) : 0,
    }));
    return {
      coreModules,
      axes,
      priorities,
      docs: (bp?.preCodeDocs || []).map((name, i) => ({
        name,
        status: i < 3 ? 'ready' : i < 6 ? 'draft' : 'todo',
      })),
      identity: {
        totalUsers: 12840,
        ssoDomains: [
          'naioshhub360.com',
          'edunaiosh.com',
          'naiosherp.com',
          'naioshlaw.com',
          'naioshfit.com',
          'smrttx.com',
          'edusmrttx.com',
        ],
        mfaEnabledPct: 67,
        activeSessions: 412,
        roles: (bp?.dashboardsByRole || []).map((r, i) => ({
          ...r,
          users: [2, 14, 38, 96, 210, 540, 180, 8200][i] || 50,
        })),
      },
      organization: {
        chain: bp?.orgChain || ['دولة', 'فرع', 'حاضنة', 'منصة', 'مكتب إلكتروني'],
        countries: (window.HubBranchesData?.COUNTRIES || []).map((c) => ({
          id: uid('co'),
          name: c.nameAr,
          code: c.code,
          branches: c.branches || 1,
          status: c.status || 'active',
        })),
        branches: (window.HubBranchesData?.BRANCHES || [])
          .filter((b) => b.code !== 'HQ')
          .map((b) => ({
            id: uid('br'),
            name: `فرع ${b.nameAr}`,
            country: b.nameAr,
            incubators: 3,
            manager: '—',
          })),
        worldBranches: (window.HubBranchesData?.BRANCHES || []).map((b) => ({ ...b })),
        incubators: (window.HubIncubatorsData?.INCUBATORS || []).map((inc) => ({
          id: inc.id,
          name: inc.name,
          sector: inc.sector,
          platforms: 1 + (inc.num % 5),
          offices: 1 + (inc.num % 4),
          members: 20 + (inc.num % 80),
          health: 70 + (inc.num % 26),
          num: inc.num,
          icon: inc.icon,
          status: 'active',
        })),
        worldIncubators: (window.HubIncubatorsData?.INCUBATORS || []).map((i) => ({ ...i })),
        platforms: (window.HubSovereignPlatforms?.list || []).map((p) => ({
          id: uid('pl'),
          code: p.code,
          name: p.name,
          nameAr: p.nameAr,
          role: p.role,
          incubator: 'النواة السيادية — هوب 360',
          offices: 1,
          status: 'online',
          icon: p.icon,
          desc: p.desc,
        })),
      },
      command: {
        branches: (window.HubBranchesData?.BRANCHES || []).length || 26,
        incubators: (window.HubIncubatorsData?.INCUBATORS || []).length || 100,
        platforms: window.HubSovereignPlatforms?.count || 18,
        clients: 1860,
        trainees: 22400,
        revenuePoints: 9850000,
        systemsUsagePct: 73,
      },
      wallet: {
        treasury: 9850000,
        wallets: [
          { id: uid('w'), owner: 'فرع القاهرة', balance: 420000, burn30d: 38000 },
          { id: uid('w'), owner: 'حاضنة التعليم الذكي', balance: 210000, burn30d: 22000 },
          { id: uid('w'), owner: 'منصة النظام التشغيلي الموحد', balance: 64000, burn30d: 9100 },
          { id: uid('w'), owner: 'سارة أحمد', balance: 1250, burn30d: 180 },
        ],
        pricing: [
          { service: 'تفعيل نظام', cost: 500 },
          { service: 'مكتب إلكتروني / شهر', cost: 200 },
          { service: 'دورة تدريبية', cost: 80 },
          { service: 'شهادة رقمية', cost: 25 },
        ],
        ledger: [
          { id: uid('l'), type: 'burn', party: 'منصة النظام التشغيلي الموحد', amount: -500, note: 'تفعيل نظام التعليم', at: nowIso() },
          { id: uid('l'), type: 'topup', party: 'فرع القاهرة', amount: 50000, note: 'شحن رصيد', at: nowIso() },
          { id: uid('l'), type: 'transfer', party: 'حاضنة التعليم ← منصة التشغيل', amount: -2000, note: 'تحويل داخلي', at: nowIso() },
        ],
      },
      marketplace: {
        catalog: (window.HubSovereignPlatforms?.list || []).map((p) => ({
          id: uid('mk'),
          name: p.nameAr,
          category: p.role,
          status: 'active',
          tenants: 1,
          role: p.role,
        })),
      },
      apps: (window.HubMarketplaceData?.APPS || []).map((a) => ({
        id: uid('app'),
        ...a,
        registeredAt: nowIso(),
        health: a.status === 'active' ? 92 + Math.floor(Math.random() * 7) : 55,
      })),
      salesStore: {
        items: (window.HubMarketplaceData?.STORE_ITEMS || []).map((x) => ({ ...x })),
        orders: [
          { id: uid('ord'), itemId: 'st-1', title: 'باقة تشغيل منصة', buyer: 'فرع القاهرة', amount: 2500, points: 500, at: nowIso(), status: 'مكتمل' },
          { id: uid('ord'), itemId: 'st-4', title: 'تذكرة فعالية مباشرة', buyer: 'سارة أحمد', amount: 350, points: 50, at: nowIso(), status: 'مكتمل' },
        ],
      },
      productCatalog: (window.HubMarketplaceData?.PRODUCT_CATALOG || []).map((x) => ({ ...x })),
      adsStudio: {
        listings: (window.HubMarketplaceData?.ADS || []).map((x) => ({ ...x, impressions: x.views * 3, clicks: Math.floor(x.views * 0.08) })),
      },
      eventsStudio: {
        events: (window.HubMarketplaceData?.EVENTS || []).map((x) => ({ ...x })),
      },
      operating: seedOperating(),
    };
  };

  const seedOperating = () => {
    const systems = ['ERP', 'LAW', 'FIT', 'NAIS', 'ACADEMY', 'SMARTX', 'EDUSMARTX', 'EDUNAIOSH', 'LMS', 'CRM'];
    const grantAll = (email, plan = 'enterprise') =>
      systems.map((systemCode) => ({
        id: uid('sub'),
        email,
        systemCode,
        plan,
        status: 'active',
        permissions: ['read', 'write', 'admin'],
        grantedAt: nowIso(),
        expiresAt: '',
        source: 'seed',
      }));
    return {
      subscriptions: [...grantAll('leader@naiosh.com'), ...grantAll('malika@naiosh.com', 'professional')],
      offices: [
        {
          id: uid('off'),
          nameAr: 'المكتب الإلكتروني الرئيسي',
          branch: 'المقر الرئيسي',
          incubator: 'حاضنة تقنية',
          platform: 'النظام التشغيلي الموحد',
          type: 'إلكتروني',
          status: 'active',
          manager: 'القائد الأعلى',
          grantedAt: nowIso(),
        },
      ],
      activityLog: [
        {
          id: uid('act'),
          kind: 'boot',
          text: 'تفعيل آلية تشغيل هوب — سجل نشاط موحّد',
          at: nowIso(),
          meta: null,
        },
      ],
    };
  };

  const seedInfoSecurity = () => ({
    score: 91,
    mfaCoverage: 67,
    openIncidents: 2,
    controls: [
      { id: uid('sec'), name: 'OAuth2 / SSO', category: 'هوية', status: 'active', coverage: 98 },
      { id: uid('sec'), name: 'MFA متعدد العوامل', category: 'هوية', status: 'active', coverage: 67 },
      { id: uid('sec'), name: 'SIEM مراقبة الأحداث', category: 'رصد', status: 'active', coverage: 88 },
      { id: uid('sec'), name: 'تشفير البيانات أثناء النقل', category: 'حماية', status: 'active', coverage: 100 },
      { id: uid('sec'), name: 'إدارة الصلاحيات RBAC', category: 'صلاحيات', status: 'active', coverage: 94 },
      { id: uid('sec'), name: 'اختبار اختراق دوري', category: 'اختبار', status: 'scheduled', coverage: 72 },
    ],
    incidents: [
      { id: uid('inc'), title: 'محاولات دخول فاشلة مرتفعة', severity: 'متوسط', status: 'open', owner: 'أمن المعلومات' },
      { id: uid('inc'), title: 'تنبيه صلاحيات متجاوزة', severity: 'عالي', status: 'investigating', owner: 'الحوكمة' },
    ],
  });

  const seedDataGovernance = () => ({
    qualityScore: 87,
    classifiedPct: 74,
    retentionOk: 91,
    catalogs: [
      { id: uid('dg'), name: 'بيانات العملاء', owner: 'CRM', classification: 'سري', quality: 92, status: 'active' },
      { id: uid('dg'), name: 'سجلات التشغيل', owner: 'Hub Core', classification: 'داخلي', quality: 88, status: 'active' },
      { id: uid('dg'), name: 'معاملات المحفظة', owner: 'Wallet', classification: 'حساس', quality: 95, status: 'active' },
      { id: uid('dg'), name: 'أرشيف الإعلانات', owner: 'Ads Studio', classification: 'عام', quality: 81, status: 'review' },
      { id: uid('dg'), name: 'مستندات الحاضنات', owner: 'Incubators', classification: 'داخلي', quality: 79, status: 'active' },
    ],
    policies: [
      { id: uid('dgp'), title: 'تصنيف البيانات الإلزامي', status: 'active', scope: 'كل المنصات' },
      { id: uid('dgp'), title: 'احتفاظ السجلات 24 شهرًا', status: 'active', scope: 'التشغيل' },
      { id: uid('dgp'), title: 'حذف البيانات عند الطلب', status: 'draft', scope: 'العملاء' },
    ],
  });

  const seedSystemsAutomation = () => ({
    activeFlows: 12,
    successRate: 96,
    savedHours: 148,
    flows: [
      { id: uid('auto'), name: 'مزامنة الأنظمة الليلية', trigger: 'جدولة 02:00', system: 'ERP · LMS', status: 'active', runs: 128 },
      { id: uid('auto'), name: 'تنبيه انخفاض الإنتاجية', trigger: 'حدث قياس', system: 'Workforce', status: 'active', runs: 64 },
      { id: uid('auto'), name: 'تفعيل سياسة عند الاعتماد', trigger: 'اعتماد حوكمة', system: 'Governance', status: 'active', runs: 41 },
      { id: uid('auto'), name: 'إصدار تقرير يومي للقائد', trigger: 'جدولة 08:00', system: 'Reports', status: 'active', runs: 90 },
      { id: uid('auto'), name: 'أرشفة إعلانات منتهية', trigger: 'انتهاء حملة', system: 'Ads', status: 'paused', runs: 22 },
      { id: uid('auto'), name: 'إنشاء مهمة من تنبيه أمني', trigger: 'حادثة أمن', system: 'Security · Tasks', status: 'active', runs: 17 },
    ],
    queue: [
      { id: uid('aq'), name: 'أتمتة ترحيب العملاء الجدد', priority: 'عالي', status: 'queued' },
      { id: uid('aq'), name: 'أتمتة نسخ احتياطي للمنصات', priority: 'متوسط', status: 'queued' },
    ],
  });

  const seed = () => ({
      meta: {
      version: 6,
      updatedAt: nowIso(),
      phase: 1,
      productType: 'central_digital_hub',
      blueprint: 'empire-v1',
    },
    feed: [
      { id: uid('f'), type: 'architecture', text: 'تم تحميل دستور المعمارية الإمبراطورية — Core Platform أولوية قصوى', at: nowIso() },
      { id: uid('f'), type: 'decision', text: 'إعادة توزيع 6 مهام ذات أولوية عالية', at: nowIso() },
      { id: uid('f'), type: 'alert', text: 'انخفاض إنتاجية فريق التكامل 12%', at: nowIso() },
      { id: uid('f'), type: 'compliance', text: 'سياسة الجودة Q-17 فُعّلت على 3 أنظمة', at: nowIso() },
      { id: uid('f'), type: 'report', text: 'ملخص المخاطر اليومي جاهز للقائد', at: nowIso() },
    ],
    notifications: [
      {
        id: uid('n'),
        source: 'HUB',
        sourceName: 'نايوش هوب',
        title: 'مركز الإشعارات جاهز',
        body: 'كل إشعارات الأنظمة (ERP · LAW · FIT…) تصل إلى هوب هنا.',
        level: 'info',
        category: 'system',
        read: false,
        at: nowIso(),
        link: 'dashboard.html#notifications',
      },
    ],
    empire: seedEmpire(),
    core: {
      decisions: [
        { id: uid('d'), title: 'إعادة توزيع مهام الاختناق', engine: 'AI Decision', status: 'executed', impact: 'عالي', at: nowIso() },
        { id: uid('d'), title: 'تعليق تكامل POSHA مؤقتًا', engine: 'Anomaly', status: 'pending', impact: 'متوسط', at: nowIso() },
        { id: uid('d'), title: 'رفع أولوية مشروع Academy', engine: 'Optimization', status: 'executed', impact: 'عالي', at: nowIso() },
      ],
      predictions: [
        { id: uid('p'), risk: 'اختناق في طبقة المهام', probability: 72, eta: '48 ساعة', severity: 'عالي' },
        { id: uid('p'), risk: 'انخفاض امتثال فريق التصميم', probability: 41, eta: '5 أيام', severity: 'متوسط' },
        { id: uid('p'), risk: 'تأخر مزامنة ERP', probability: 58, eta: '24 ساعة', severity: 'عالي' },
      ],
      optimizations: [
        { id: uid('o'), target: 'القوى العاملة', suggestion: 'دمج ورديتين متداخلتين لتقليل الفاقد', gain: '+9% إنتاجية' },
        { id: uid('o'), target: 'الأنظمة', suggestion: 'تفعيل cache لمزامنة LXP', gain: '-22% زمن استجابة' },
      ],
      anomalies: [
        { id: uid('a'), source: 'موظف · سارة أحمد', signal: 'نشاط خارج ساعات العمل المعتمدة', score: 81, status: 'open' },
        { id: uid('a'), source: 'نظام · Naiosh Fit', signal: 'قفزات غير طبيعية في الطلبات', score: 67, status: 'investigating' },
      ],
      knowledgeGraph: [
        { from: 'العقل المركزي', to: 'الحوكمة', rel: 'يصدر أوامر' },
        { from: 'الحوكمة', to: 'القوى العاملة', rel: 'يفرض سياسات' },
        { from: 'المهام', to: 'القياس', rel: 'يرسل تنفيذ' },
        { from: 'القياس', to: 'العقل المركزي', rel: 'درجات لحظية' },
        { from: 'الأنظمة', to: 'التكامل', rel: 'مزامنة' },
        { from: 'التقارير', to: 'القائد الأعلى', rel: 'يرفع نتائج' },
      ],
      engineHealth: { decision: 92, predictive: 88, optimization: 85, anomaly: 90, knowledge: 94 },
    },
    governance: {
      policies: [
        { id: uid('pol'), code: 'POL-01', title: 'دستور ساعات العمل', status: 'active', scope: 'القوى العاملة' },
        { id: uid('pol'), code: 'POL-02', title: 'معيار جودة التنفيذ', status: 'active', scope: 'المهام' },
        { id: uid('pol'), code: 'POL-03', title: 'سياسة ربط الأنظمة', status: 'draft', scope: 'التكامل' },
      ],
      compliance: [
        { id: uid('c'), entity: 'فريق التطوير', rate: 96, violations: 1 },
        { id: uid('c'), entity: 'Naiosh Academy', rate: 91, violations: 3 },
        { id: uid('c'), entity: 'مكتب التسويق', rate: 84, violations: 5 },
      ],
      standards: [
        { id: uid('s'), name: 'QS-Execution', level: 'A', description: 'جودة تنفيذ المهام ≥ 85%' },
        { id: uid('s'), name: 'QS-Uptime', level: 'A+', description: 'صحة الأنظمة ≥ 98%' },
        { id: uid('s'), name: 'QS-Response', level: 'B', description: 'زمن استجابة القرار ≤ 15 دقيقة' },
      ],
      penaltiesRewards: [
        { id: uid('pr'), type: 'reward', target: 'أحمد علي', reason: 'تجاوز هدف الإنتاجية', points: 50, at: nowIso() },
        { id: uid('pr'), type: 'penalty', target: 'مكتب الدعم', reason: 'تأخير امتثال POL-01', points: -20, at: nowIso() },
      ],
      constitution: [
        { id: uid('con'), article: 'المادة 1', text: 'تُنشأ منصة Naiosh Hub360 كغرفة عمليات مركزية لكل الأنظمة.' },
        { id: uid('con'), article: 'المادة 2', text: 'تلتزم المنصة بثلاثة مبادئ: الوضوح – القياس – السيطرة التشغيلية.' },
      ],
    },
    workforce: {
      employees: [
        { id: uid('e'), name: 'سارة أحمد', role: 'تشغيل', hours: 7.5, productivity: 92, score: 88, status: 'active', warned: false },
        { id: uid('e'), name: 'محمد حسن', role: 'تكامل', hours: 6.2, productivity: 71, score: 68, status: 'warning', warned: true },
        { id: uid('e'), name: 'ليلى كريم', role: 'حوكمة', hours: 8.0, productivity: 95, score: 93, status: 'active', warned: false },
        { id: uid('e'), name: 'يوسف نادر', role: 'مهام', hours: 5.4, productivity: 62, score: 58, status: 'critical', warned: true },
        { id: uid('e'), name: 'نور فهد', role: 'تحليل', hours: 7.8, productivity: 89, score: 86, status: 'active', warned: false },
      ],
      rewards: [
        { id: uid('rw'), employee: 'ليلى كريم', amount: 500, reason: 'أداء متميز أسبوعي', at: nowIso() },
      ],
    },
    systems: {
      registry: [
        { id: uid('sys'), name: 'LMS', health: 99, status: 'online', lastSync: nowIso() },
        { id: uid('sys'), name: 'LXP', health: 97, status: 'online', lastSync: nowIso() },
        { id: uid('sys'), name: 'Adaptive', health: 94, status: 'online', lastSync: nowIso() },
        { id: uid('sys'), name: 'ERP', health: 91, status: 'degraded', lastSync: nowIso() },
        { id: uid('sys'), name: 'POSHA', health: 88, status: 'degraded', lastSync: nowIso() },
        { id: uid('sys'), name: 'Naiosh Academy', health: 98, status: 'online', lastSync: nowIso() },
        { id: uid('sys'), name: 'Naiosh Fit', health: 96, status: 'online', lastSync: nowIso() },
        { id: uid('sys'), name: 'Workspace', health: 99, status: 'online', lastSync: nowIso() },
      ],
      clients: [
        { id: uid('cl'), name: 'مؤسسة الأفق', systems: 3, status: 'connected' },
        { id: uid('cl'), name: 'مجموعة النور', systems: 5, status: 'connected' },
        { id: uid('cl'), name: 'شركة المدى', systems: 2, status: 'pending' },
      ],
    },
    tasks: {
      items: [
        {
          id: uid('t'),
          title: 'مراجعة سياسة POL-02',
          details: 'مراجعة بنود سياسة الحوكمة POL-02 واعتماد التعديلات مع لجنة الامتثال قبل النشر.',
          assignee: 'ليلى كريم',
          priority: 'عالي',
          status: 'in_progress',
          quality: 0,
          project: 'حوكمة Q1',
          dueDate: '2026-08-20',
          companyName: 'نايوش',
          party1Name: 'ليلى كريم',
          party1Phone: '0500000001',
          party2Name: 'لجنة الحوكمة',
          party2Phone: '0500000002',
          branch: 'الفرع الرئيسي',
          incubator: 'حاضنة التشغيل',
          platform: 'NAIOSH HUB',
          office: 'مكتب الحوكمة',
          docName: 'POL-02.pdf',
        },
        {
          id: uid('t'),
          title: 'مزامنة بيانات ERP',
          details: 'إغلاق فجوة المزامنة بين ERP وهوب ومعالجة السجلات المعلّقة في طابور التكامل.',
          assignee: 'محمد حسن',
          priority: 'عاجل',
          status: 'blocked',
          quality: 0,
          project: 'تكامل الأنظمة',
          dueDate: '2026-08-15',
          companyName: 'نايوش',
          party1Name: 'محمد حسن',
          party1Phone: '0500000003',
          party2Name: 'فريق التكامل',
          party2Phone: '0500000004',
          branch: 'الفرع الرئيسي',
          incubator: 'حاضنة الأنظمة',
          platform: 'ERP',
          office: 'مكتب التشغيل',
        },
        {
          id: uid('t'),
          title: 'تقرير مخاطر أسبوعي',
          details: 'إعداد تقرير المخاطر الأسبوعي للقائد الأعلى مع مؤشرات الاختناقات والتنبؤ.',
          assignee: 'نور فهد',
          priority: 'متوسط',
          status: 'todo',
          quality: 0,
          project: 'تقارير سيادية',
          dueDate: '2026-08-22',
          companyName: 'نايوش',
          party1Name: 'نور فهد',
          party1Phone: '0500000005',
          party2Name: 'غرفة العمليات',
          party2Phone: '0500000006',
          branch: 'الفرع الرئيسي',
          incubator: 'حاضنة التقارير',
          platform: 'NAIOSH HUB',
          office: 'مكتب التقارير',
        },
        {
          id: uid('t'),
          title: 'تحسين مسار Academy',
          details: 'تحسين مسار التسجيل في الأكاديمية من المتجر حتى فتح الدورة وإصدار الشهادة.',
          assignee: 'سارة أحمد',
          priority: 'عالي',
          status: 'done',
          quality: 91,
          project: 'تشغيل Academy',
          dueDate: '2026-08-08',
          companyName: 'نايوش',
          party1Name: 'سارة أحمد',
          party1Phone: '0500000007',
          party2Name: 'أكاديمية نايوش',
          party2Phone: '0500000008',
          branch: 'الفرع الرئيسي',
          incubator: 'حاضنة التعليم',
          platform: 'ACADEMY',
          office: 'مكتب الأكاديمية',
          imageName: 'academy-path.png',
        },
      ],
      projects: [
        { id: uid('pj'), name: 'تأسيس العقل المركزي', phase: 'التأسيس', progress: 64, owner: 'مليكة' },
        { id: uid('pj'), name: 'ربط الأنظمة الثمانية', phase: 'التشغيل', progress: 38, owner: 'التكامل' },
        { id: uid('pj'), name: 'إطلاق التقارير السيادية', phase: 'السيادة', progress: 12, owner: 'التقارير' },
      ],
      bottlenecks: [
        { id: uid('bn'), area: 'مزامنة ERP', waitHours: 18, severity: 'عالي' },
        { id: uid('bn'), area: 'اعتماد السياسات', waitHours: 9, severity: 'متوسط' },
      ],
    },
    measurement: {
      scores: [
        { entity: 'القوى العاملة', score: 84, level: 'L3' },
        { entity: 'الأنظمة', score: 93, level: 'L4' },
        { entity: 'الحاضنات', score: 78, level: 'L2' },
        { entity: 'المهام', score: 81, level: 'L3' },
        { entity: 'الحوكمة', score: 90, level: 'L4' },
      ],
      matrix: [
        { axis: 'الوضوح', value: 88 },
        { axis: 'القياس', value: 91 },
        { axis: 'السيطرة', value: 86 },
        { axis: 'الامتثال', value: 94 },
        { axis: 'السرعة', value: 79 },
      ],
      clientImpact: [
        { client: 'مؤسسة الأفق', impact: 76, trend: 'up' },
        { client: 'مجموعة النور', impact: 84, trend: 'up' },
        { client: 'شركة المدى', impact: 61, trend: 'down' },
      ],
    },
    reports: {
      generated: [
        { id: uid('r'), type: 'daily', title: 'التقرير اليومي', status: 'ready', at: nowIso() },
        { id: uid('r'), type: 'risk', title: 'تقرير المخاطر', status: 'ready', at: nowIso() },
      ],
      schedule: [
        { type: 'daily', label: 'يومي', next: 'غداً 08:00' },
        { type: 'weekly', label: 'أسبوعي', next: 'الأحد 09:00' },
        { type: 'monthly', label: 'شهري', next: '1 الشهر القادم' },
        { type: 'risk', label: 'مخاطر', next: 'عند التنبيه' },
        { type: 'growth', label: 'نمو', next: 'كل خميس' },
        { type: 'compliance', label: 'امتثال', next: 'نهاية الأسبوع' },
      ],
    },
    integration: {
      gateway: { status: 'online', rps: 1240, latencyMs: 48, errors: 0.2 },
      connectors: [
        { id: uid('ic'), name: 'Internal Systems', status: 'connected', type: 'internal' },
        { id: uid('ic'), name: 'External Systems', status: 'connected', type: 'external' },
        { id: uid('ic'), name: 'AI Connector', status: 'connected', type: 'ai' },
        { id: uid('ic'), name: 'Client Connector', status: 'partial', type: 'client' },
      ],
      apis: [
        { method: 'POST', path: '/api/core/decide', calls: 420 },
        { method: 'GET', path: '/api/measurement/scores', calls: 880 },
        { method: 'POST', path: '/api/tasks/assign', calls: 310 },
        { method: 'GET', path: '/api/reports/daily', calls: 96 },
      ],
    },
    infoSecurity: seedInfoSecurity(),
    dataGovernance: seedDataGovernance(),
    systemsAutomation: seedSystemsAutomation(),
    timeline: {
      phase1: { name: 'التأسيس', days: 30, progress: 42, items: ['العقل المركزي', 'الحوكمة', 'القياس الموحد'] },
      phase2: { name: 'التشغيل', days: 45, progress: 18, items: ['ربط الأنظمة', 'المهام', 'القوى العاملة'] },
      phase3: { name: 'السيادة', days: 30, progress: 5, items: ['التقارير السيادية', 'التكامل الخارجي', 'الإطلاق'] },
    },
  });

  const hydrateOpsDomains = () => {
    if (!state) return false;
    let changed = false;
    if (!state.infoSecurity) {
      state.infoSecurity = seedInfoSecurity();
      changed = true;
    }
    if (!state.dataGovernance) {
      state.dataGovernance = seedDataGovernance();
      changed = true;
    }
    if (!state.systemsAutomation) {
      state.systemsAutomation = seedSystemsAutomation();
      changed = true;
    }
    if (!Array.isArray(state.notifications)) {
      state.notifications = [];
      changed = true;
    }
    if (hydrateTasksDetails()) changed = true;
    return changed;
  };

  /** إثراء المهام القديمة بحقول التفاصيل/الموعد إن كانت ناقصة */
  const hydrateTasksDetails = () => {
    const items = state?.tasks?.items;
    if (!Array.isArray(items) || !items.length) return false;
    const defaults = {
      'مراجعة سياسة POL-02': {
        details: 'مراجعة بنود سياسة الحوكمة POL-02 واعتماد التعديلات مع لجنة الامتثال قبل النشر.',
        dueDate: '2026-08-20',
        branch: 'الفرع الرئيسي',
        incubator: 'حاضنة التشغيل',
        platform: 'NAIOSH HUB',
        office: 'مكتب الحوكمة',
        party1Name: 'ليلى كريم',
        party2Name: 'لجنة الحوكمة',
        companyName: 'نايوش',
        docName: 'POL-02.pdf',
      },
      'مزامنة بيانات ERP': {
        details: 'إغلاق فجوة المزامنة بين ERP وهوب ومعالجة السجلات المعلّقة في طابور التكامل.',
        dueDate: '2026-08-15',
        branch: 'الفرع الرئيسي',
        incubator: 'حاضنة الأنظمة',
        platform: 'ERP',
        office: 'مكتب التشغيل',
        party1Name: 'محمد حسن',
        party2Name: 'فريق التكامل',
        companyName: 'نايوش',
      },
      'تقرير مخاطر أسبوعي': {
        details: 'إعداد تقرير المخاطر الأسبوعي للقائد الأعلى مع مؤشرات الاختناقات والتنبؤ.',
        dueDate: '2026-08-22',
        branch: 'الفرع الرئيسي',
        incubator: 'حاضنة التقارير',
        platform: 'NAIOSH HUB',
        office: 'مكتب التقارير',
        party1Name: 'نور فهد',
        party2Name: 'غرفة العمليات',
        companyName: 'نايوش',
      },
      'تحسين مسار Academy': {
        details: 'تحسين مسار التسجيل في الأكاديمية من المتجر حتى فتح الدورة وإصدار الشهادة.',
        dueDate: '2026-08-08',
        branch: 'الفرع الرئيسي',
        incubator: 'حاضنة التعليم',
        platform: 'ACADEMY',
        office: 'مكتب الأكاديمية',
        party1Name: 'سارة أحمد',
        party2Name: 'أكاديمية نايوش',
        companyName: 'نايوش',
        imageName: 'academy-path.png',
      },
    };
    let changed = false;
    items.forEach((item) => {
      const fill = defaults[item.title] || {};
      const keys = [
        'details',
        'dueDate',
        'branch',
        'incubator',
        'platform',
        'office',
        'party1Name',
        'party2Name',
        'party1Phone',
        'party2Phone',
        'companyName',
        'companyAddress',
        'docName',
        'imageName',
        'videoName',
      ];
      keys.forEach((k) => {
        if (item[k] == null) {
          item[k] = fill[k] || '';
          changed = true;
        }
      });
    });
    return changed;
  };

  /** Refresh launch URLs / dual-mode fields from marketplace catalog */
  const hydrateLaunchFields = () => {
    const md = window.HubMarketplaceData?.APPS;
    if (!md?.length || !state?.empire?.apps?.length) return false;
    let changed = false;
    const byCode = Object.fromEntries(md.map((a) => [a.code, a]));
    state.empire.apps.forEach((app) => {
      const src = byCode[app.code];
      if (!src) return;
      ['launchUrl', 'standaloneUrl', 'hubPath', 'url', 'supportsStandalone', 'launchViaHub'].forEach((k) => {
        if (src[k] != null && app[k] !== src[k]) {
          app[k] = src[k];
          changed = true;
        }
      });
    });
    return changed;
  };

  /** آلية التشغيل: اشتراكات · مكاتب · سجل نشاط · إزالة تكرار الأنظمة */
  const hydrateOperating = () => {
    if (!state?.empire) return false;
    let changed = false;
    if (!state.empire.operating) {
      state.empire.operating = seedOperating();
      changed = true;
    } else {
      const op = state.empire.operating;
      if (!Array.isArray(op.subscriptions)) {
        op.subscriptions = seedOperating().subscriptions;
        changed = true;
      }
      if (!Array.isArray(op.offices)) {
        op.offices = seedOperating().offices;
        changed = true;
      }
      if (!Array.isArray(op.activityLog)) {
        op.activityLog = seedOperating().activityLog;
        changed = true;
      }
    }
    // Deduplicate empire.apps by code (canonical registry)
    const apps = state.empire.apps || [];
    const seen = new Map();
    const deduped = [];
    apps.forEach((a) => {
      const code = String(a.code || '').toUpperCase();
      if (!code) {
        deduped.push(a);
        return;
      }
      if (seen.has(code)) {
        const base = seen.get(code);
        Object.assign(base, a, { id: base.id, code });
        changed = true;
      } else {
        a.code = code;
        seen.set(code, a);
        deduped.push(a);
      }
    });
    if (deduped.length !== apps.length) {
      state.empire.apps = deduped;
      changed = true;
    }
    // Mirror systems.registry from apps without duplicate codes
    if (state.systems?.registry) {
      const regSeen = new Set();
      const nextReg = [];
      state.systems.registry.forEach((r) => {
        const key = String(r.code || r.name || r.id);
        if (regSeen.has(key)) {
          changed = true;
          return;
        }
        regSeen.add(key);
        nextReg.push(r);
      });
      if (nextReg.length !== state.systems.registry.length) {
        state.systems.registry = nextReg;
        changed = true;
      }
    }
    return changed;
  };

  let state = null;

  /** Refill empty marketplace catalogs if seed ran without HubMarketplaceData (e.g. login-first). */
  const hydrateMarketplace = () => {
    const md = window.HubMarketplaceData;
    if (!md || !state?.empire) return false;
    const e = state.empire;
    let changed = false;
    const fill = (cur, src, mapFn) => {
      if ((cur?.length || 0) > 0 || !(src?.length > 0)) return cur || [];
      changed = true;
      return src.map(mapFn);
    };
    e.productCatalog = fill(e.productCatalog, md.PRODUCT_CATALOG, (x) => ({ ...x }));
    // أسقط المنتجات التجريبية القديمة من التخزين المحلي وأبقِ الشغّالة فقط
    if (md.PRODUCT_CATALOG?.length) {
      const allowed = new Set(md.PRODUCT_CATALOG.map((x) => x.id));
      const before = e.productCatalog?.length || 0;
      e.productCatalog = (e.productCatalog || []).filter((p) => allowed.has(p.id));
      const have = new Set(e.productCatalog.map((x) => x.id));
      md.PRODUCT_CATALOG.forEach((src) => {
        if (!have.has(src.id)) {
          e.productCatalog.push({ ...src });
          changed = true;
        }
      });
      if (e.productCatalog.length !== before) changed = true;
    }
    if (!e.salesStore) e.salesStore = { items: [], orders: [] };
    e.salesStore.items = fill(e.salesStore.items, md.STORE_ITEMS, (x) => ({ ...x }));
    // Merge any newly seeded academy/store items missing from existing lists
    if (md.STORE_ITEMS?.length && e.salesStore.items?.length) {
      const have = new Set(e.salesStore.items.map((x) => x.id));
      md.STORE_ITEMS.forEach((src) => {
        if (!have.has(src.id)) {
          e.salesStore.items.push({ ...src });
          changed = true;
        }
      });
    }
    if (!e.adsStudio) e.adsStudio = { listings: [] };
    e.adsStudio.listings = fill(e.adsStudio.listings, md.ADS, (x) => ({
      ...x,
      publishTargets: {
        home: !!x.publishTargets?.home,
        offices: x.publishTargets?.offices || [],
        branches: x.publishTargets?.branches || [],
        incubators: x.publishTargets?.incubators || [],
        platforms: x.publishTargets?.platforms || [],
      },
      adLevel:
        x.adLevel ||
        (x.scope === 'branches'
          ? 'branch'
          : x.scope === 'incubators'
            ? 'incubator'
            : x.scope === 'offices'
              ? 'office'
              : 'platform'),
      impressions: (x.views || 0) * 3,
      clicks: Math.floor((x.views || 0) * 0.08),
    }));
    (e.adsStudio.listings || []).forEach((ad) => {
      if (!ad.publishTargets || typeof ad.publishTargets !== 'object') return;
      if (!Array.isArray(ad.publishTargets.offices)) ad.publishTargets.offices = [];
      if (!ad.adLevel) {
        ad.adLevel =
          ad.scope === 'branches'
            ? 'branch'
            : ad.scope === 'incubators'
              ? 'incubator'
              : ad.scope === 'offices'
                ? 'office'
                : 'platform';
      }
    });
    if (!e.eventsStudio) e.eventsStudio = { events: [] };
    e.eventsStudio.events = fill(e.eventsStudio.events, md.EVENTS, (x) => ({ ...x }));
    e.apps = fill(e.apps, md.APPS, (a) => ({
      id: uid('app'),
      ...a,
      registeredAt: nowIso(),
      health: a.status === 'active' ? 92 : 55,
    }));
    const bd = window.HubBranchesData?.BRANCHES;
    if (!e.organization) e.organization = {};
    const currentBranches = e.organization.worldBranches?.length || 0;
    if (bd?.length > 0 && currentBranches < bd.length) {
      e.organization.worldBranches = bd.map((x) => ({ ...x }));
      if (window.HubBranchesData?.COUNTRIES?.length) {
        e.organization.countries = window.HubBranchesData.COUNTRIES.map((c) => ({
          id: uid('co'),
          name: c.nameAr,
          code: c.code,
          branches: c.branches || 1,
          status: c.status || 'active',
        }));
      }
      if (e.command) e.command.branches = bd.length;
      changed = true;
    }
    const idata = window.HubIncubatorsData?.INCUBATORS;
    const currentInc = e.organization.incubators?.length || 0;
    if (idata?.length > 0 && currentInc < idata.length) {
      e.organization.incubators = idata.map((inc) => ({
        id: inc.id,
        name: inc.name,
        sector: inc.sector,
        platforms: 1 + (inc.num % 5),
        offices: 1 + (inc.num % 4),
        members: 20 + (inc.num % 80),
        health: 70 + (inc.num % 26),
        num: inc.num,
        icon: inc.icon,
        status: 'active',
      }));
      e.organization.worldIncubators = idata.map((x) => ({ ...x }));
      if (e.command) e.command.incubators = idata.length;
      changed = true;
    }
    return changed;
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        state = JSON.parse(raw);
        if (!state.empire) {
          state.empire = seedEmpire();
          save();
        } else if (hydrateMarketplace()) {
          save();
        }
        if (hydrateOpsDomains()) save();
        if (hydrateLaunchFields()) save();
        if (hydrateOperating()) save();
        return state;
      }
    } catch (_) {}
    state = seed();
    save();
    return state;
  };

  const save = () => {
    state.meta.updatedAt = nowIso();
    localStorage.setItem(KEY, JSON.stringify(state));
    return state;
  };

  const get = () => state || load();

  const pushFeed = (type, text) => {
    get().feed.unshift({ id: uid('f'), type, text, at: nowIso() });
    if (get().feed.length > 40) get().feed.length = 40;
    save();
  };

  const recordActivity = (kind, text, meta = null) => {
    const op = get().empire?.operating;
    if (op) {
      if (!Array.isArray(op.activityLog)) op.activityLog = [];
      op.activityLog.unshift({ id: uid('act'), kind, text, at: nowIso(), meta });
      if (op.activityLog.length > 200) op.activityLog.length = 200;
    }
    pushFeed(kind === 'auth' ? 'decision' : kind === 'report' ? 'report' : 'decision', text);
    return op?.activityLog?.[0] || null;
  };

  const ensureOperating = () => {
    const e = get().empire;
    if (!e.operating) e.operating = seedOperating();
    if (!Array.isArray(e.operating.subscriptions)) e.operating.subscriptions = [];
    if (!Array.isArray(e.operating.offices)) e.operating.offices = [];
    if (!Array.isArray(e.operating.activityLog)) e.operating.activityLog = [];
    return e.operating;
  };

  const listSubscriptions = (email = '') => {
    const list = ensureOperating().subscriptions || [];
    if (!email) return list;
    return list.filter((s) => String(s.email).toLowerCase() === String(email).toLowerCase());
  };

  const checkEntitlement = (email, systemCode, minPermission = 'read') => {
    const code = String(systemCode || '').toUpperCase();
    const order = { read: 1, write: 2, admin: 3 };
    const need = order[minPermission] || 1;
    const active = listSubscriptions(email).filter(
      (s) => s.systemCode === code && s.status === 'active' && (!s.expiresAt || s.expiresAt >= today())
    );
    if (!active.length) return { ok: false, reason: 'subscription', permissions: [] };
    const permissions = Array.from(new Set(active.flatMap((s) => s.permissions || ['read'])));
    const max = Math.max(...permissions.map((p) => order[p] || 0));
    if (max < need) return { ok: false, reason: 'permission', permissions };
    return { ok: true, reason: 'subscription', permissions, subscription: active[0] };
  };

  const grantSubscription = (payload = {}) => {
    const op = ensureOperating();
    const email = String(payload.email || '').trim().toLowerCase();
    const systemCode = String(payload.systemCode || payload.code || '').toUpperCase();
    if (!email || !systemCode) return null;
    const existing = op.subscriptions.find(
      (s) => s.email === email && s.systemCode === systemCode && s.status === 'active'
    );
    if (existing) {
      existing.permissions = payload.permissions || existing.permissions || ['read', 'write'];
      existing.plan = payload.plan || existing.plan || 'standard';
      existing.expiresAt = payload.expiresAt || existing.expiresAt || '';
      existing.updatedAt = nowIso();
      recordActivity('grant', `تحديث اشتراك ${systemCode} ← ${email}`, { email, systemCode });
      save();
      return existing;
    }
    const item = {
      id: uid('sub'),
      email,
      systemCode,
      plan: payload.plan || 'standard',
      status: 'active',
      permissions: payload.permissions || ['read', 'write'],
      grantedAt: nowIso(),
      expiresAt: payload.expiresAt || '',
      source: payload.source || 'hub',
    };
    op.subscriptions.unshift(item);
    recordActivity('grant', `منح اشتراك ${systemCode} ← ${email}`, { email, systemCode });
    pushNotification({
      source: 'HUB',
      sourceName: 'نايوش هوب',
      title: `اشتراك ${systemCode} مفعّل`,
      body: `تم منح صلاحية الدخول لنظام ${systemCode} للمستخدم ${email}`,
      level: 'success',
      category: 'subscription',
      link: 'dashboard.html#operating',
    });
    save();
    return item;
  };

  const revokeSubscription = (id) => {
    const op = ensureOperating();
    const sub = op.subscriptions.find((s) => s.id === id);
    if (!sub) return null;
    sub.status = 'revoked';
    sub.revokedAt = nowIso();
    recordActivity('grant', `إلغاء اشتراك ${sub.systemCode} ← ${sub.email}`, { id });
    save();
    return sub;
  };

  const addOffice = (payload = {}) => {
    const op = ensureOperating();
    const item = {
      id: uid('off'),
      nameAr: payload.nameAr || payload.name || 'مكتب إلكتروني',
      branch: payload.branch || '',
      incubator: payload.incubator || '',
      platform: payload.platform || '',
      type: payload.type || 'إلكتروني',
      status: payload.status || 'active',
      manager: payload.manager || payload.party1Name || '',
      grantedAt: nowIso(),
      ...pickCommonMeta(payload),
    };
    op.offices.unshift(item);
    recordActivity('org', `منح مكتب إلكتروني: ${item.nameAr}`, { id: item.id });
    save();
    return item;
  };

  const listUnifiedServices = () => {
    const catalog = window.HubOperatingModel?.allServices?.() || [];
    return catalog;
  };

  const listSystemServices = (code) => window.HubOperatingModel?.servicesFor?.(code) || [];

  const emitNotificationsChanged = () => {
    try {
      window.dispatchEvent(new CustomEvent('hub-notifications-changed'));
    } catch (_) {}
  };

  const pushNotification = (payload = {}) => {
    const s = get();
    if (!Array.isArray(s.notifications)) s.notifications = [];
    const item = {
      id: uid('n'),
      source: (payload.source || 'HUB').toString().toUpperCase(),
      sourceName: payload.sourceName || payload.source || 'HUB',
      title: payload.title || 'إشعار هوب',
      body: payload.body || '',
      level: payload.level || 'info',
      category: payload.category || 'system',
      link: payload.link || '',
      read: false,
      at: nowIso(),
      meta: payload.meta || null,
    };
    s.notifications.unshift(item);
    if (s.notifications.length > 200) s.notifications.length = 200;
    pushFeed('alert', `${item.sourceName}: ${item.title}`);
    save();
    emitNotificationsChanged();
    return item;
  };

  const listNotifications = () => get().notifications || [];

  const unreadNotificationsCount = () => (get().notifications || []).filter((n) => !n.read).length;

  const markNotificationRead = (id) => {
    const n = (get().notifications || []).find((x) => x.id === id);
    if (!n) return null;
    n.read = true;
    save();
    emitNotificationsChanged();
    return n;
  };

  const markAllNotificationsRead = () => {
    (get().notifications || []).forEach((n) => {
      n.read = true;
    });
    save();
    emitNotificationsChanged();
    return listNotifications();
  };

  const recordLaunch = (code, mode = 'hub') => {
    const app = get().empire?.apps?.find((a) => a.code === String(code || '').toUpperCase());
    if (app) {
      app.lastLaunchAt = nowIso();
      app.lastLaunchMode = mode;
      save();
    }
    recordActivity('launch', `تشغيل ${code} · ${mode === 'standalone' ? 'منفرد' : 'عبر هوب'}`, { code, mode });
    return app || null;
  };

  const ingestSystemSync = (payload = {}) => {
    const code = String(payload.code || '').toUpperCase();
    if (!code) return null;
    const empire = get().empire;
    if (!empire.apps) empire.apps = [];

    let app = empire.apps.find((a) => a.code === code);
    const launchUrl = payload.launchUrl || (window.HubLauncher?.systemPath?.(code) || `systems/${code.toLowerCase()}.html`);
    if (!app) {
      app = {
        id: uid('app'),
        code,
        nameAr: payload.nameAr || code,
        kind: 'system',
        category: 'أنظمة نايوش',
        url: launchUrl,
        launchUrl,
        standaloneUrl: launchUrl,
        hubPath: `apps.html#${code.toLowerCase()}`,
        icon: payload.icon || 'fa-cube',
        status: 'active',
        health: Number(payload.health) || 90,
        registeredAt: nowIso(),
        supportsStandalone: true,
        launchViaHub: true,
      };
      empire.apps.unshift(app);
    } else {
      if (payload.nameAr) app.nameAr = payload.nameAr;
      if (payload.health != null) app.health = Number(payload.health);
      app.status = payload.status === 'offline' ? 'stopped' : 'active';
      app.url = app.launchUrl || launchUrl;
      app.launchUrl = app.launchUrl || launchUrl;
      app.standaloneUrl = app.standaloneUrl || launchUrl;
      app.lastSyncAt = nowIso();
      app.lastSyncPayload = {
        metrics: payload.metrics || null,
        modules: payload.modules || null,
        mode: payload.mode || null,
        domain: payload.domain || null,
        uploadedAt: payload.uploadedAt || nowIso(),
      };
    }

    // Mirror into systems.registry health panel
    const reg = get().systems?.registry || [];
    let sys = reg.find((x) => String(x.name).toUpperCase() === code || String(x.code || '').toUpperCase() === code);
    if (!sys) {
      sys = { id: uid('sys'), name: code, code, health: Number(payload.health) || 90, status: 'online', lastSync: nowIso() };
      reg.unshift(sys);
    } else {
      sys.health = Number(payload.health) || sys.health;
      sys.status = payload.status || (sys.health >= 95 ? 'online' : sys.health >= 88 ? 'degraded' : 'offline');
      sys.lastSync = nowIso();
      sys.code = code;
    }

    pushFeed('decision', `رفع معلومات ${app.nameAr} على هوب`);
    save();
    return { app, sys };
  };

  const avg = (arr, key) => {
    if (!arr.length) return 0;
    return Math.round(arr.reduce((s, x) => s + Number(x[key] || 0), 0) / arr.length);
  };

  const kpis = () => {
    const s = get();
    const e = s.empire || {};
    const cmd = e.command || {};
    return {
      decisionsToday: s.core.decisions.filter((d) => d.status === 'executed').length,
      compliance: avg(s.governance.compliance, 'rate'),
      productivity: avg(s.workforce.employees, 'productivity'),
      systemsHealth: avg(s.systems.registry, 'health'),
      openAnomalies: s.core.anomalies.filter((a) => a.status !== 'closed').length,
      activeTasks: s.tasks.items.filter((t) => t.status !== 'done').length,
      branches: cmd.branches || 0,
      incubators: cmd.incubators || 0,
      platforms: cmd.platforms || 0,
      trainees: cmd.trainees || 0,
      treasury: e.wallet?.treasury || 0,
      coreReadyPct: Math.round(avg(e.coreModules || [], 'progress')),
      layerHealth: {
        core: avg(Object.values(s.core.engineHealth).map((v) => ({ v })), 'v') || Math.round(Object.values(s.core.engineHealth).reduce((a, b) => a + b, 0) / 5),
        governance: avg(s.governance.compliance, 'rate'),
        workforce: avg(s.workforce.employees, 'productivity'),
        systems: avg(s.systems.registry, 'health'),
        tasks: Math.max(20, 100 - s.tasks.bottlenecks.length * 12 - s.tasks.items.filter((t) => t.status === 'blocked').length * 10),
        measurement: avg(s.measurement.scores, 'score'),
        reports: s.reports.generated.length ? 88 : 60,
        integration: s.integration.gateway.status === 'online' ? 90 : 50,
        identity: e.identity?.mfaEnabledPct || 60,
        organization: Math.min(100, (e.organization?.branches?.length || 0) * 20 + 20),
        wallet: e.wallet ? 82 : 40,
      },
    };
  };

  // —— Core actions
  const issueDecision = (title, engine = 'AI Decision', impact = 'متوسط') => {
    const item = { id: uid('d'), title, engine, status: 'pending', impact, at: nowIso() };
    get().core.decisions.unshift(item);
    pushFeed('decision', title);
    save();
    return item;
  };

  const executeDecision = (id) => {
    const d = get().core.decisions.find((x) => x.id === id);
    if (!d) return null;
    d.status = 'executed';
    pushFeed('decision', `تنفيذ: ${d.title}`);
    save();
    return d;
  };

  const resolveAnomaly = (id) => {
    const a = get().core.anomalies.find((x) => x.id === id);
    if (!a) return null;
    a.status = 'closed';
    pushFeed('alert', `أُغلق الشذوذ: ${a.source}`);
    save();
    return a;
  };

  const runPredictiveScan = () => {
    const risks = [
      'ضغط على بوابة API',
      'تأخر دورة مشروع التأسيس',
      'انخفاض أثر عميل المدى',
      'اختناق اعتماد الحوكمة',
    ];
    const item = {
      id: uid('p'),
      risk: risks[Math.floor(Math.random() * risks.length)],
      probability: 35 + Math.floor(Math.random() * 55),
      eta: `${1 + Math.floor(Math.random() * 6)} أيام`,
      severity: Math.random() > 0.5 ? 'عالي' : 'متوسط',
    };
    get().core.predictions.unshift(item);
    pushFeed('alert', `تنبؤ جديد: ${item.risk}`);
    save();
    return item;
  };

  // —— Common ERP meta (طرف أول/ثاني · فرع · حاضنة · منصة · مكتب · مرفقات)
  const pickCommonMeta = (payload = {}) => ({
    companyName: payload.companyName || '',
    companyAddress: payload.companyAddress || '',
    party1Name: payload.party1Name || '',
    party1Phone: payload.party1Phone || '',
    party2Name: payload.party2Name || '',
    party2Phone: payload.party2Phone || '',
    branch: payload.branch || '',
    incubator: payload.incubator || '',
    platform: payload.platform || payload.platformCode || '',
    office: payload.office || '',
    projectCategory: payload.projectCategory || '',
    projectCategoryId: payload.projectCategoryId || '',
    projectId: payload.projectId || '',
    projectName: payload.projectName || '',
    docName: payload.docName || '',
    imageName: payload.imageName || '',
    videoName: payload.videoName || '',
    imageDataUrl: payload.imageDataUrl || '',
  });

  // —— Governance
  const addPolicy = (title, scope, extra = {}) => {
    const item = {
      id: uid('pol'),
      code: `POL-${String(get().governance.policies.length + 1).padStart(2, '0')}`,
      title,
      status: 'draft',
      scope,
      ...pickCommonMeta(extra),
    };
    get().governance.policies.unshift(item);
    pushFeed('compliance', `مسودة سياسة: ${title}`);
    save();
    return item;
  };

  const activatePolicy = (id) => {
    const p = get().governance.policies.find((x) => x.id === id);
    if (!p) return null;
    p.status = 'active';
    pushFeed('compliance', `تفعيل ${p.code}: ${p.title}`);
    save();
    return p;
  };

  const issuePenaltyOrReward = (type, target, reason, points) => {
    const item = { id: uid('pr'), type, target, reason, points: Number(points), at: nowIso() };
    get().governance.penaltiesRewards.unshift(item);
    pushFeed('compliance', `${type === 'reward' ? 'مكافأة' : 'عقوبة'}: ${target}`);
    save();
    return item;
  };

  const addConstitutionArticle = (article, text) => {
    const item = { id: uid('con'), article, text };
    get().governance.constitution.push(item);
    save();
    return item;
  };

  // —— Workforce
  const addBranch = (payload = {}) => {
    const org = get().empire.organization;
    if (!org.worldBranches) org.worldBranches = [];
    const nameAr = String(payload.nameAr || payload.name || '').trim();
    if (!nameAr) return null;
    const item = {
      id: uid('br'),
      nameAr,
      nameEn: String(payload.nameEn || nameAr).trim(),
      code: String(payload.code || 'XX').trim().toUpperCase(),
      type: String(payload.type || 'مكاتب خاصة').trim(),
      hours: String(payload.hours || 'من 9:00 صباحًا إلى 6:00 مساءً').trim(),
      flag: payload.flag || window.HubBranchesData?.FLAG?.eg || '',
      flagAlt: `علم ${nameAr}`,
      status: 'active',
      assignee: '',
      ...pickCommonMeta(payload),
    };
    org.worldBranches.unshift(item);
    pushFeed('decision', `فرع جديد: ${item.nameAr}`);
    save();
    return item;
  };

  const addEmployee = (payload = {}) => {
    const name = String(payload.name || '').trim();
    if (!name) return null;
    const item = {
      id: uid('e'),
      name,
      role: String(payload.role || 'تشغيل').trim() || 'تشغيل',
      hours: Number(payload.hours) || 0,
      productivity: Number(payload.productivity) || 70,
      score: Number(payload.score) || 70,
      status: payload.status || 'active',
      warned: false,
      assignee: '',
      ...pickCommonMeta(payload),
    };
    get().workforce.employees.unshift(item);
    pushFeed('decision', `موظف جديد: ${item.name} · ${item.role}`);
    save();
    return item;
  };

  const warnEmployee = (id) => {
    const e = get().workforce.employees.find((x) => x.id === id);
    if (!e) return null;
    e.warned = true;
    e.status = e.productivity < 65 ? 'critical' : 'warning';
    pushFeed('alert', `إنذار مبكر: ${e.name}`);
    save();
    return e;
  };

  const rewardEmployee = (id, amount = 300) => {
    const e = get().workforce.employees.find((x) => x.id === id);
    if (!e) return null;
    const item = { id: uid('rw'), employee: e.name, amount, reason: 'مكافأة تلقائية للأداء', at: nowIso() };
    get().workforce.rewards.unshift(item);
    e.score = Math.min(100, e.score + 3);
    pushFeed('decision', `مكافأة ${e.name}: ${amount}`);
    save();
    return item;
  };

  const tickProductivity = () => {
    get().workforce.employees.forEach((e) => {
      const delta = Math.floor(Math.random() * 7) - 3;
      e.productivity = Math.max(40, Math.min(100, e.productivity + delta));
      e.hours = Math.max(4, Math.min(9, +(e.hours + (Math.random() * 0.4 - 0.2)).toFixed(1)));
      e.score = Math.round(e.productivity * 0.7 + e.hours * 3);
      if (e.productivity < 65) e.status = 'critical';
      else if (e.productivity < 75) e.status = 'warning';
      else e.status = 'active';
    });
    save();
  };

  // —— Systems
  const syncSystem = (id) => {
    const sys = get().systems.registry.find((x) => x.id === id);
    if (!sys) return null;
    sys.lastSync = nowIso();
    sys.health = Math.min(100, sys.health + Math.floor(Math.random() * 5));
    sys.status = sys.health >= 95 ? 'online' : sys.health >= 88 ? 'degraded' : 'offline';
    pushFeed('decision', `مزامنة ${sys.name}`);
    pushNotification({
      source: sys.code || sys.name,
      sourceName: sys.name,
      title: `مزامنة ${sys.name}`,
      body: `اكتملت المزامنة مع هوب · صحة ${sys.health}%`,
      level: 'info',
      category: 'sync',
    });
    // Also mirror into apps registry when code matches
    const code = String(sys.code || sys.name || '').toUpperCase();
    ingestSystemSync({
      code,
      nameAr: sys.name,
      health: sys.health,
      status: sys.status,
      mode: 'hub',
      metrics: { lastSync: sys.lastSync },
    });
    save();
    return sys;
  };

  const syncAllSystems = () => {
    get().systems.registry.forEach((sys) => syncSystem(sys.id));
    return get().systems.registry;
  };

  // —— Tasks
  const addTask = (title, assignee, priority, project, extra = {}) => {
    const item = {
      id: uid('t'),
      title,
      details: String(extra.details || '').trim(),
      assignee,
      priority,
      status: 'todo',
      quality: 0,
      project,
      dueDate: String(extra.dueDate || '').trim(),
      ...pickCommonMeta(extra),
    };
    get().tasks.items.unshift(item);
    pushFeed('decision', `مهمة جديدة: ${title}`);
    save();
    return item;
  };

  const updateTaskStatus = (id, status) => {
    const t = get().tasks.items.find((x) => x.id === id);
    if (!t) return null;
    t.status = status;
    if (status === 'done') t.quality = 75 + Math.floor(Math.random() * 20);
    pushFeed('decision', `تحديث مهمة (${status}): ${t.title}`);
    // measurement ripple
    recalculateMeasurement();
    save();
    return t;
  };

  // —— Measurement
  const recalculateMeasurement = () => {
    const s = get();
    s.measurement.scores = [
      { entity: 'القوى العاملة', score: avg(s.workforce.employees, 'score'), level: levelOf(avg(s.workforce.employees, 'score')) },
      { entity: 'الأنظمة', score: avg(s.systems.registry, 'health'), level: levelOf(avg(s.systems.registry, 'health')) },
      { entity: 'الحاضنات', score: 78, level: 'L2' },
      {
        entity: 'المهام',
        score: Math.round(
          (s.tasks.items.filter((t) => t.status === 'done').length / Math.max(1, s.tasks.items.length)) * 100
        ),
        level: 'L1',
      },
      { entity: 'الحوكمة', score: avg(s.governance.compliance, 'rate'), level: 'L1' },
    ];
    s.measurement.scores.forEach((row) => {
      row.level = levelOf(row.score);
    });
    save();
  };

  const levelOf = (score) => {
    if (score >= 90) return 'L5';
    if (score >= 80) return 'L4';
    if (score >= 70) return 'L3';
    if (score >= 60) return 'L2';
    return 'L1';
  };

  // —— Reports
  const REPORT_TITLES = {
    daily: 'التقرير اليومي',
    weekly: 'التقرير الأسبوعي',
    monthly: 'التقرير الشهري',
    risk: 'تقرير المخاطر',
    growth: 'تقرير النمو',
    compliance: 'تقرير الامتثال',
    activity: 'تقرير النشاط الموحّد',
  };

  const generateReport = (type) => {
    const k = kpis();
    const op = ensureOperating();
    const activity = (op.activityLog || []).slice(0, 40);
    const notes = (get().notifications || []).slice(0, 20);
    const launches = (get().empire?.apps || [])
      .filter((a) => a.lastLaunchAt)
      .map((a) => ({ code: a.code, nameAr: a.nameAr, at: a.lastLaunchAt, mode: a.lastLaunchMode }));
    const subs = (op.subscriptions || []).filter((s) => s.status === 'active');
    const baseSummary =
      type === 'risk'
        ? `مخاطر مفتوحة: ${get().core.predictions.length} تنبؤ · ${get().core.anomalies.filter((a) => a.status !== 'closed').length} شذوذ`
        : type === 'compliance'
          ? `متوسط الامتثال ${k.compliance}%`
          : type === 'activity'
            ? `نشاط موحّد: ${activity.length} حدثًا · ${notes.length} إشعارًا · ${launches.length} تشغيل · ${subs.length} اشتراك`
            : `قرارات منفّذة ${k.decisionsToday} · إنتاجية ${k.productivity}% · صحة أنظمة ${k.systemsHealth}%`;
    const body = {
      date: today(),
      kpis: k,
      summary: baseSummary,
      activity,
      notifications: notes.map((n) => ({ title: n.title, source: n.sourceName, at: n.at, read: n.read })),
      launches,
      subscriptions: subs.map((s) => ({ email: s.email, systemCode: s.systemCode, plan: s.plan })),
      ongoing: {
        openTasks: (get().tasks?.items || []).filter((t) => t.status !== 'done' && t.status !== 'مكتمل').length,
        activeAds: (get().empire?.adsStudio?.listings || []).filter((a) => a.status === 'active').length,
        openIncidents: get().infoSecurity?.openIncidents || 0,
      },
    };
    const item = {
      id: uid('r'),
      type,
      title: REPORT_TITLES[type] || type,
      status: 'ready',
      at: nowIso(),
      body,
    };
    get().reports.generated.unshift(item);
    recordActivity('report', `${item.title} جاهز للقائد الأعلى`, { type });
    save();
    return item;
  };

  // —— Integration
  const toggleConnector = (id) => {
    const c = get().integration.connectors.find((x) => x.id === id);
    if (!c) return null;
    c.status = c.status === 'connected' ? 'disconnected' : 'connected';
    pushFeed('decision', `${c.name}: ${c.status}`);
    save();
    return c;
  };

  const pingGateway = () => {
    const g = get().integration.gateway;
    g.rps = 900 + Math.floor(Math.random() * 600);
    g.latencyMs = 30 + Math.floor(Math.random() * 40);
    g.errors = +(Math.random() * 0.8).toFixed(2);
    g.status = 'online';
    save();
    return g;
  };

  // —— Empire / Blueprint engines
  const advanceCoreModule = (id) => {
    const m = get().empire.coreModules.find((x) => x.id === id);
    if (!m) return null;
    m.progress = Math.min(100, m.progress + 8 + Math.floor(Math.random() * 10));
    m.status = m.progress >= 100 ? 'ready' : m.progress > 0 ? 'building' : 'planned';
    pushFeed('architecture', `تقدم Core: ${m.nameAr || m.name} → ${m.progress}%`);
    save();
    return m;
  };

  const advancePriority = (order) => {
    const p = get().empire.priorities.find((x) => x.order === Number(order));
    if (!p) return null;
    p.progress = Math.min(100, p.progress + 10);
    p.status = p.progress >= 100 ? 'done' : 'in_progress';
    pushFeed('architecture', `أولوية ${p.order}: ${p.axis} → ${p.progress}%`);
    save();
    return p;
  };

  const topupWallet = (owner, amount) => {
    const amt = Number(amount) || 0;
    if (amt <= 0) return null;
    const w = get().empire.wallet.wallets.find((x) => x.owner === owner) || get().empire.wallet.wallets[0];
    if (!w) return null;
    w.balance += amt;
    get().empire.wallet.treasury += amt;
    get().empire.wallet.ledger.unshift({
      id: uid('l'),
      type: 'topup',
      party: w.owner,
      amount: amt,
      note: 'شحن رصيد نقاط',
      at: nowIso(),
    });
    pushFeed('decision', `شحن محفظة ${w.owner}: +${amt}`);
    save();
    return w;
  };

  const burnPoints = (owner, amount, note = 'استهلاك خدمة') => {
    const amt = Number(amount) || 0;
    const w = get().empire.wallet.wallets.find((x) => x.owner === owner) || get().empire.wallet.wallets[0];
    if (!w || amt <= 0 || w.balance < amt) return null;
    w.balance -= amt;
    w.burn30d += amt;
    get().empire.wallet.ledger.unshift({
      id: uid('l'),
      type: 'burn',
      party: w.owner,
      amount: -amt,
      note,
      at: nowIso(),
    });
    pushFeed('decision', `استهلاك نقاط ${w.owner}: -${amt}`);
    save();
    return w;
  };

  const toggleMarketplaceSystem = (id) => {
    const sys = get().empire.marketplace.catalog.find((x) => x.id === id);
    if (!sys) return null;
    if (sys.status === 'active') sys.status = 'stopped';
    else if (sys.status === 'stopped' || sys.status === 'beta') sys.status = 'active';
    else sys.status = 'beta';
    pushFeed('decision', `سوق الأنظمة · ${sys.name}: ${sys.status}`);
    save();
    return sys;
  };

  const addIncubator = (name, sector, extra = {}) => {
    const item = {
      id: uid('inc'),
      name,
      sector: sector || 'عام',
      platforms: 0,
      offices: 0,
      members: 0,
      health: 70,
      ...pickCommonMeta(extra),
    };
    get().empire.organization.incubators.unshift(item);
    get().empire.command.incubators = Math.max(get().empire.command.incubators, get().empire.organization.incubators.length);
    pushFeed('architecture', `حاضنة جديدة: ${name}`);
    save();
    return item;
  };

  const registerApp = (manifest) => {
    const empire = get().empire;
    if (!empire.apps) empire.apps = [];
    const code = (manifest.code || '').trim().toUpperCase();
    if (!code || !manifest.nameAr) return null;
    const existing = empire.apps.find((a) => a.code === code);
    if (existing) {
      Object.assign(existing, manifest, { code, status: manifest.status || existing.status });
      pushFeed('architecture', `تحديث نظام في هوب: ${existing.nameAr}`);
      save();
      return existing;
    }
    const app = {
      id: uid('app'),
      code,
      nameAr: manifest.nameAr,
      kind: manifest.kind || 'system',
      category: manifest.category || 'أنظمة نايوش',
      url: manifest.url || manifest.launchUrl || 'apps.html',
      launchUrl: manifest.launchUrl || manifest.url || 'apps.html',
      standaloneUrl: manifest.standaloneUrl || manifest.launchUrl || manifest.url || 'apps.html',
      hubPath: manifest.hubPath || `apps.html#${code.toLowerCase()}`,
      icon: manifest.icon || 'fa-cube',
      status: manifest.status || 'active',
      health: 88,
      registeredAt: nowIso(),
      supportsStandalone: manifest.supportsStandalone !== false,
      launchViaHub: manifest.launchViaHub !== false,
      ...pickCommonMeta(manifest),
    };
    empire.apps.unshift(app);
    pushFeed('architecture', `نظام جديد ظهر في هوب: ${app.nameAr}`);
    save();
    return app;
  };

  const toggleApp = (id) => {
    const app = get().empire.apps?.find((a) => a.id === id);
    if (!app) return null;
    app.status = app.status === 'active' ? 'stopped' : 'active';
    pushFeed('decision', `تطبيق هوب · ${app.nameAr}: ${app.status}`);
    save();
    return app;
  };

  const placeStoreOrder = (itemId, buyer) => {
    const store = get().empire.salesStore;
    const item = store?.items?.find((x) => x.id === itemId);
    if (!item || item.stock < 1) return null;
    item.stock -= 1;
    const order = {
      id: uid('ord'),
      itemId: item.id,
      title: item.title,
      buyer: buyer || 'مستخدم هوب',
      amount: item.price,
      points: item.points,
      at: nowIso(),
      status: 'مكتمل',
    };
    store.orders.unshift(order);
    if (item.points) burnPoints('متجر المبيعات', item.points, `شراء: ${item.title}`);
    // اشتراك → صلاحية دخول للنظام المرتبط
    const systemCode = String(item.platformCode || '').toUpperCase();
    const userEmail =
      (typeof buyer === 'string' && buyer.includes('@') && buyer) ||
      window.HubAuth?.getUser?.()?.email ||
      '';
    if (systemCode && userEmail && window.HubLauncher?.SYSTEM_META?.[systemCode]) {
      grantSubscription({
        email: userEmail,
        systemCode,
        plan: item.title,
        permissions: ['read', 'write'],
        source: 'store',
      });
    }
    recordActivity('order', `طلب متجر: ${item.title}`, { itemId: item.id, systemCode });
    save();
    return order;
  };

  const parseMarketplacePayload = (payload, connectors) => {
    const linked = [];
    (connectors || []).forEach((c) => {
      if (c.id === 'custom') return; // handled via free-text fields below
      const enabled = payload[`mp_${c.id}`] === '1' || payload[`mp_${c.id}`] === true || payload[`mp_${c.id}`] === 'on';
      const url = (payload[`mp_url_${c.id}`] || '').trim();
      if (enabled || url) {
        linked.push({
          id: c.id,
          name: c.name,
          nameAr: c.nameAr,
          url: url || '',
          externalSku: (payload[`mp_sku_${c.id}`] || '').trim(),
          status: url ? 'linked' : 'draft',
        });
      }
    });
    // custom / أي متجر كبير — from checkbox+url or free-text name
    const customEnabled =
      payload.mp_custom === '1' ||
      payload.mp_custom === true ||
      !!(payload.mp_custom_name || '').trim() ||
      !!(payload.mp_url_custom || '').trim();
    if (customEnabled) {
      linked.push({
        id: 'custom',
        name: payload.mp_custom_name || 'Other',
        nameAr: payload.mp_custom_name || 'أي متجر كبير',
        url: (payload.mp_url_custom || '').trim(),
        externalSku: '',
        status: (payload.mp_url_custom || '').trim() ? 'linked' : 'draft',
      });
    }
    return linked;
  };

  const addStoreItem = (payload) => {
    const store = get().empire.salesStore;
    if (!store) return null;
    const title = payload.title || payload.name || '';
    if (!title) return null;
    const connectors = window.HubMarketplaceData?.MARKETPLACE_CONNECTORS || [];
    const marketplaces = Array.isArray(payload.marketplaces)
      ? payload.marketplaces
      : parseMarketplacePayload(payload, connectors);
    const item = {
      id: uid('st'),
      title,
      name: title,
      desc: payload.desc || payload.description || '',
      brand: payload.brand || 'نايوش هوب',
      platform: payload.platform || payload.platformCode || 'هوب',
      price: Number(payload.price) || 0,
      points: Number(payload.points) || 0,
      category: payload.category || 'تشغيل',
      platformCode: payload.platformCode || '',
      stock: Number(payload.stock) || 10,
      sku: payload.sku || `ST-${Date.now().toString().slice(-6)}`,
      itemKind: payload.itemKind || payload.kind || 'منتج',
      status: 'active',
      badge: payload.badge || (payload.itemKind === 'خدمة' ? 'خدمة' : 'جديد'),
      marketplaces,
      mirrorToCatalog: payload.mirrorToCatalog !== false,
      ...pickCommonMeta(payload),
    };
    store.items.unshift(item);
    pushFeed('decision', `رفع على المتجر: ${item.title} · ${item.category}`);

    if (item.mirrorToCatalog !== false) {
      const empire = get().empire;
      if (!empire.productCatalog) empire.productCatalog = [];
      empire.productCatalog.unshift({
        id: uid('pr'),
        sku: item.sku,
        name: item.title,
        brand: item.brand,
        platform: item.platform || 'متجر هوب',
        category: item.category,
        price: item.price,
        stock: item.stock,
        sold: 0,
        status: 'متوفر',
        movement: 'متوسط',
        icon: item.itemKind === 'خدمة' ? 'fa-concierge-bell' : 'fa-bag-shopping',
        storeItemId: item.id,
        itemKind: item.itemKind,
        ...pickCommonMeta(payload),
      });
    }
    save();
    return item;
  };

  const linkStoreMarketplace = (itemId, link = {}) => {
    const item = get().empire.salesStore?.items?.find((x) => x.id === itemId);
    if (!item) return null;
    if (!Array.isArray(item.marketplaces)) item.marketplaces = [];
    const id = link.id || 'custom';
    const existing = item.marketplaces.find((m) => m.id === id && (!link.url || m.url === link.url));
    const row = {
      id,
      name: link.name || id,
      nameAr: link.nameAr || link.name || id,
      url: link.url || '',
      externalSku: link.externalSku || '',
      status: link.url ? 'linked' : 'draft',
    };
    if (existing) Object.assign(existing, row);
    else item.marketplaces.push(row);
    pushFeed('decision', `ربط متجر · ${item.title} → ${row.nameAr}`);
    save();
    return item;
  };

  const normalizeList = (value) => {
    if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
    return String(value || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const normalizePublishTargets = (payload = {}) => {
    const fromObj = payload.publishTargets && typeof payload.publishTargets === 'object' ? payload.publishTargets : null;
    const appearance = normalizeList(payload.appearancePlaces);
    const home =
      payload.publishHome === true ||
      payload.publishHome === '1' ||
      !!fromObj?.home ||
      appearance.includes('home') ||
      appearance.includes('main_interface');
    const offices = normalizeList(fromObj?.offices || payload.targetOffices);
    const branches = normalizeList(fromObj?.branches || payload.targetBranches);
    const incubators = normalizeList(fromObj?.incubators || payload.targetIncubators);
    const platforms = normalizeList(fromObj?.platforms || payload.targetPlatforms);
    return { home, offices, branches, incubators, platforms };
  };

  const deriveAdScope = (targets) => {
    const hits = [];
    if (targets.home) hits.push('home');
    if ((targets.offices || []).length) hits.push('offices');
    if ((targets.branches || []).length) hits.push('branches');
    if ((targets.incubators || []).length) hits.push('incubators');
    if ((targets.platforms || []).length) hits.push('platforms');
    if (!hits.length) return 'platforms';
    if (hits.length === 1) return hits[0];
    return 'multi';
  };

  const adMatchesScope = (ad, scope) => {
    if (!scope) return true;
    const t = ad.publishTargets;
    if (t && typeof t === 'object') {
      if (scope === 'home') return !!t.home;
      if (scope === 'offices') return (t.offices || []).length > 0 || ad.scope === 'offices' || ad.adLevel === 'office';
      if (scope === 'branches') return (t.branches || []).length > 0 || ad.scope === 'branches';
      if (scope === 'incubators') return (t.incubators || []).length > 0 || ad.scope === 'incubators';
      if (scope === 'platforms') return (t.platforms || []).length > 0 || ad.scope === 'platforms';
      if (scope === 'multi') return deriveAdScope(t) === 'multi';
    }
    return (ad.scope || 'platforms') === scope;
  };

  const adMatchesTarget = (ad, kind, name = '') => {
    if (!ad) return false;
    if (ad.publishStatus === 'deferred' || ad.publishStatus === 'draft') return false;
    if (ad.status && ad.status !== 'active') return false;

    const places = normalizeList(ad.appearancePlaces);
    const t = ad.publishTargets;
    if (!t || typeof t !== 'object') {
      if (kind === 'home') {
        return places.includes('home') || places.includes('main_interface') || ad.scope === 'home';
      }
      if (kind === 'offices') return ad.adLevel === 'office' || ad.scope === 'offices' || places.includes('office_home');
      return (ad.scope || 'platforms') === kind;
    }
    if (kind === 'home') return !!t.home;
    const list = t[kind] || [];
    if (!list.length) return false;
    if (list.includes('*') || list.includes('all')) return true;
    if (!name) return true;
    return list.includes(name);
  };

  const listAdsFor = (kind, name = '') => {
    const listings = get().empire?.adsStudio?.listings || [];
    return listings.filter((ad) => adMatchesTarget(ad, kind, name));
  };

  const addAdListing = (payload) => {
    const studio = get().empire.adsStudio;
    if (!studio) return null;
    const publishStatus = payload.publishStatus || 'published';
    const statusMap = {
      published: 'active',
      deferred: 'paused',
      draft: 'paused',
    };
    const appearancePlaces = normalizeList(payload.appearancePlaces);
    const socialShares = normalizeList(payload.socialShares);
    const publishTargets = normalizePublishTargets(payload);
    if (
      !publishTargets.home &&
      !publishTargets.offices.length &&
      !publishTargets.branches.length &&
      !publishTargets.incubators.length &&
      !publishTargets.platforms.length
    ) {
      // fallback: use single branch/incubator/platform/office from common meta + ads studio
      if (payload.office) publishTargets.offices = [payload.office];
      if (payload.branch) publishTargets.branches = [payload.branch];
      if (payload.incubator) publishTargets.incubators = [payload.incubator];
      if (payload.platform) publishTargets.platforms = [payload.platform];
      if (
        !publishTargets.offices.length &&
        !publishTargets.branches.length &&
        !publishTargets.incubators.length &&
        !publishTargets.platforms.length
      ) {
        publishTargets.platforms = ['*'];
      }
    }
    const productType = payload.productType || payload.itemKind || 'رقمية';
    const desc = payload.desc || payload.description || payload.content || '';
    const adLevel =
      payload.adLevel ||
      (payload.type && String(payload.type).includes('مكتب')
        ? 'office'
        : payload.type && String(payload.type).includes('فرع')
          ? 'branch'
          : payload.type && String(payload.type).includes('حاضنة')
            ? 'incubator'
            : 'platform');
    const adType =
      payload.type ||
      window.HubMarketplaceData?.adTypeForLevel?.(adLevel) ||
      productType ||
      'إعلان هوب';
    const ad = {
      id: uid('ad'),
      title: payload.title,
      content: desc,
      desc,
      price: Number(payload.price) || 0,
      category: payload.category || 'عام',
      subcategory: payload.subcategory || '',
      productType,
      itemKind: productType,
      platformCode: payload.platformCode || '',
      productId: payload.productId || '',
      views: 0,
      impressions: 0,
      clicks: 0,
      status: statusMap[publishStatus] || payload.status || 'active',
      publishStatus,
      level: payload.level || 'متوسط',
      adLevel,
      type: adType,
      brand: payload.brand || payload.companyName || 'نايوش هوب',
      adStartDate: payload.adStartDate || '',
      adEndDate: payload.adEndDate || '',
      appearancePlaces,
      socialShares,
      publishTargets,
      scope: payload.scope || deriveAdScope(publishTargets),
      assignee: '',
      ...pickCommonMeta(payload),
    };
    studio.listings.unshift(ad);
    const label =
      publishStatus === 'deferred' ? 'تأجيل نشر إعلان' : publishStatus === 'draft' ? 'مسودة إعلان' : 'إعلان جديد';
    pushFeed('decision', `${label}: ${ad.title}`);
    save();
    return ad;
  };

  const toggleAd = (id) => {
    const ad = get().empire.adsStudio?.listings?.find((x) => x.id === id);
    if (!ad) return null;
    ad.status = ad.status === 'active' ? 'paused' : 'active';
    pushFeed('decision', `إعلان · ${ad.title}: ${ad.status}`);
    save();
    return ad;
  };

  const addEvent = (payload) => {
    const studio = get().empire.eventsStudio;
    if (!studio) return null;
    const event = {
      id: uid('ev'),
      name: payload.name,
      description: payload.description || '',
      date: payload.date || today(),
      time: payload.time || '18:00',
      platform: payload.platform || 'استوديو الفعاليات',
      status: payload.status || 'قادمة',
      type: payload.type || 'بث مباشر',
      speaker: payload.speaker || 'فريق نايوش',
      duration: payload.duration || '60 دقيقة',
      department: payload.department || 'غرفة العمليات',
      assignee: '',
      ...pickCommonMeta(payload),
    };
    studio.events.unshift(event);
    pushFeed('decision', `فعالية جديدة: ${event.name}`);
    save();
    return event;
  };

  const addProduct = (payload) => {
    const empire = get().empire;
    if (!empire.productCatalog) empire.productCatalog = [];
    const productType = payload.productType || payload.itemKind || 'رقمية';
    const publishStatus = payload.publishStatus || 'published';
    const statusMap = {
      published: 'متوفر',
      deferred: 'مؤجل',
      draft: 'مسودة',
    };
    const iconByType = {
      رقمية: 'fa-cloud',
      خدمية: 'fa-concierge-bell',
      عينية: 'fa-box',
    };
    const appearancePlaces = Array.isArray(payload.appearancePlaces)
      ? payload.appearancePlaces
      : String(payload.appearancePlaces || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    const socialShares = Array.isArray(payload.socialShares)
      ? payload.socialShares
      : String(payload.socialShares || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    const item = {
      id: uid('pr'),
      sku: payload.sku || `NH-${Date.now().toString().slice(-6)}`,
      name: payload.name,
      brand: payload.brand || payload.companyName || 'نايوش هوب',
      platform: payload.platform || 'هوب',
      category: payload.category || 'تشغيل',
      subcategory: payload.subcategory || '',
      productType,
      itemKind: productType,
      desc: payload.desc || payload.description || '',
      price: Number(payload.price) || 0,
      stock: Number(payload.stock) || 10,
      sold: 0,
      status: statusMap[publishStatus] || payload.status || 'متوفر',
      publishStatus,
      movement: 'متوسط',
      icon: payload.icon || iconByType[productType] || 'fa-cube',
      adStartDate: payload.adStartDate || '',
      adEndDate: payload.adEndDate || '',
      appearancePlaces,
      socialShares,
      assignee: '',
      ...pickCommonMeta(payload),
    };
    empire.productCatalog.unshift(item);
    const label =
      publishStatus === 'deferred' ? 'تأجيل نشر منتج' : publishStatus === 'draft' ? 'حفظ مسودة منتج' : 'منتج كتالوج';
    pushFeed('decision', `${label}: ${item.name} · ${item.category}${item.subcategory ? ' / ' + item.subcategory : ''}`);
    save();
    return item;
  };

  const addMarketSystem = (payload = {}) => {
    const market = get().empire.marketplace;
    if (!market?.catalog) return null;
    const item = {
      id: uid('sys'),
      name: payload.name,
      category: payload.category || 'تشغيل',
      tenants: Number(payload.tenants) || 1,
      status: 'active',
      ...pickCommonMeta(payload),
    };
    market.catalog.unshift(item);
    pushFeed('decision', `نظام سوق جديد: ${item.name}`);
    save();
    return item;
  };

  const addPlatform = (payload = {}) => {
    const org = get().empire.organization;
    if (!org.platforms) org.platforms = [];
    const item = {
      id: uid('plt'),
      code: (payload.code || 'PLT').toUpperCase(),
      nameAr: payload.nameAr || payload.name,
      role: payload.role || 'تشغيل',
      status: 'active',
      ...pickCommonMeta(payload),
    };
    org.platforms.unshift(item);
    pushFeed('architecture', `منصة جديدة: ${item.nameAr}`);
    save();
    return item;
  };

  const toggleSecurityControl = (id) => {
    const c = get().infoSecurity?.controls?.find((x) => x.id === id);
    if (!c) return null;
    c.status = c.status === 'active' ? 'paused' : 'active';
    pushFeed('alert', `أمن المعلومات · ${c.name}: ${c.status}`);
    save();
    return c;
  };

  const closeSecurityIncident = (id) => {
    const inc = get().infoSecurity?.incidents?.find((x) => x.id === id);
    if (!inc) return null;
    inc.status = 'closed';
    get().infoSecurity.openIncidents = get().infoSecurity.incidents.filter((x) => x.status !== 'closed').length;
    pushFeed('alert', `إغلاق حادثة أمنية: ${inc.title}`);
    save();
    return inc;
  };

  const toggleDataCatalog = (id) => {
    const row = get().dataGovernance?.catalogs?.find((x) => x.id === id);
    if (!row) return null;
    row.status = row.status === 'active' ? 'review' : 'active';
    pushFeed('compliance', `حوكمة البيانات · ${row.name}: ${row.status}`);
    save();
    return row;
  };

  const activateDataPolicy = (id) => {
    const p = get().dataGovernance?.policies?.find((x) => x.id === id);
    if (!p) return null;
    p.status = 'active';
    pushFeed('compliance', `تفعيل سياسة بيانات: ${p.title}`);
    save();
    return p;
  };

  const toggleAutomationFlow = (id) => {
    const f = get().systemsAutomation?.flows?.find((x) => x.id === id);
    if (!f) return null;
    f.status = f.status === 'active' ? 'paused' : 'active';
    get().systemsAutomation.activeFlows = get().systemsAutomation.flows.filter((x) => x.status === 'active').length;
    pushFeed('decision', `أتمتة · ${f.name}: ${f.status}`);
    save();
    return f;
  };

  const runAutomationFlow = (id) => {
    const f = get().systemsAutomation?.flows?.find((x) => x.id === id);
    if (!f) return null;
    f.runs = (f.runs || 0) + 1;
    f.status = 'active';
    get().systemsAutomation.savedHours = (get().systemsAutomation.savedHours || 0) + 1;
    pushFeed('decision', `تشغيل أتمتة: ${f.name}`);
    save();
    return f;
  };

  const resolveCollection = (entity) => {
    const s = get();
    const empire = s.empire;
    switch (entity) {
      case 'apps':
        return { list: empire.apps || [], nameKey: 'nameAr' };
      case 'store':
        return { list: empire.salesStore?.items || [], nameKey: 'title' };
      case 'ads':
        return { list: empire.adsStudio?.listings || [], nameKey: 'title' };
      case 'events':
        return { list: empire.eventsStudio?.events || [], nameKey: 'name' };
      case 'products':
        return { list: empire.productCatalog || [], nameKey: 'name' };
      case 'incubators':
        return { list: empire.organization?.incubators || [], nameKey: 'name' };
      case 'tasks':
        return { list: s.tasks?.items || [], nameKey: 'title' };
      case 'employees':
        return { list: s.workforce?.employees || [], nameKey: 'name' };
      case 'branches':
        return { list: empire.organization?.worldBranches || [], nameKey: 'nameAr' };
      case 'policies':
        return { list: s.governance?.policies || [], nameKey: 'title' };
      case 'systems':
        return { list: s.empire?.marketplace?.catalog || s.systems?.registry || [], nameKey: 'name' };
      case 'platforms':
        return { list: empire.organization?.platforms || [], nameKey: 'nameAr' };
      case 'offices':
        return { list: ensureOperating().offices || [], nameKey: 'nameAr' };
      case 'connectors':
        return { list: s.integration?.connectors || [], nameKey: 'name' };
      default:
        return null;
    }
  };

  const entityAction = (entity, id, action, patch = {}) => {
    const bag = resolveCollection(entity);
    if (!bag) return null;
    const idx = bag.list.findIndex((x) => String(x.id) === String(id));
    if (idx < 0) return null;
    const item = bag.list[idx];

    if (action === 'delete') {
      bag.list.splice(idx, 1);
      pushFeed('decision', `حذف ${entity}: ${item[bag.nameKey] || id}`);
      save();
      return true;
    }
    if (action === 'archive') {
      item.status = item.status === 'متوفر' ? 'مؤرشف' : 'archived';
      item.archivedAt = nowIso();
      pushFeed('decision', `أرشفة ${entity}: ${item[bag.nameKey] || id}`);
      save();
      return item;
    }
    if (action === 'assign') {
      item.assignee = patch.assignee || '';
      item.assignNote = patch.assignNote || item.assignNote || '';
      item.assignedAt = nowIso();
      pushFeed('decision', `تعيين ${entity} → ${item.assignee}`);
      save();
      return item;
    }
    if (action === 'edit') {
      const title = patch.title || patch.name;
      if (title) {
        if (bag.nameKey in item) item[bag.nameKey] = title;
        else if ('title' in item) item.title = title;
        else if ('name' in item) item.name = title;
        else if ('nameAr' in item) item.nameAr = title;
      }
      Object.keys(patch).forEach((k) => {
        if (k !== 'title' && k !== 'name') item[k] = patch[k];
      });
      pushFeed('decision', `تعديل ${entity}: ${item[bag.nameKey] || id}`);
      save();
      return item;
    }
    return null;
  };

  const getEntity = (entity, id) => {
    const bag = resolveCollection(entity);
    if (!bag) return null;
    return bag.list.find((x) => String(x.id) === String(id)) || null;
  };

  const refreshCommandStats = () => {
    const org = get().empire.organization;
    const cmd = get().empire.command;
    cmd.branches = org.branches.length;
    cmd.platforms = Math.max(cmd.platforms, org.platforms.length);
    cmd.systemsUsagePct = Math.min(99, cmd.systemsUsagePct + Math.floor(Math.random() * 3) - 1);
    cmd.revenuePoints = get().empire.wallet.treasury;
    pushFeed('report', 'تحديث مركز التحكم العالمي');
    save();
    return cmd;
  };

  const reset = () => {
    state = seed();
    save();
    return state;
  };

  load();

  return {
    get,
    save,
    reset,
    kpis,
    pushFeed,
    pushNotification,
    listNotifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    recordLaunch,
    ingestSystemSync,
    recordActivity,
    ensureOperating,
    listSubscriptions,
    checkEntitlement,
    grantSubscription,
    revokeSubscription,
    addOffice,
    listUnifiedServices,
    listSystemServices,
    issueDecision,
    executeDecision,
    resolveAnomaly,
    runPredictiveScan,
    addPolicy,
    activatePolicy,
    issuePenaltyOrReward,
    addConstitutionArticle,
    addBranch,
    addEmployee,
    warnEmployee,
    rewardEmployee,
    tickProductivity,
    syncSystem,
    syncAllSystems,
    addTask,
    updateTaskStatus,
    recalculateMeasurement,
    generateReport,
    toggleConnector,
    pingGateway,
    advanceCoreModule,
    advancePriority,
    topupWallet,
    burnPoints,
    toggleMarketplaceSystem,
    addIncubator,
    registerApp,
    toggleApp,
    placeStoreOrder,
    addStoreItem,
    linkStoreMarketplace,
    addAdListing,
    listAdsFor,
    adMatchesScope,
    adMatchesTarget,
    toggleAd,
    addEvent,
    addProduct,
    addMarketSystem,
    addPlatform,
    toggleSecurityControl,
    closeSecurityIncident,
    toggleDataCatalog,
    activateDataPolicy,
    toggleAutomationFlow,
    runAutomationFlow,
    entityAction,
    getEntity,
    refreshCommandStats,
    REPORT_TITLES,
  };
})();

window.HubStore = HubStore;
