/**
 * Naiosh Hub 360 — Central Operational Store (Imperial Edition)
 * Driven by EmpireBlueprint: Core Platform + 12 axes + org hierarchy + wallet.
 * Persists to localStorage.
 */
const HubStore = (() => {
  const KEY = 'naioshHub360Store_v13';

  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const nowIso = () => new Date().toISOString();
  const today = () => new Date().toLocaleDateString('ar-EG', { numberingSystem: 'latn' });

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

  const nextSecSeq = (list, prefix, pad = 5) => {
    const year = new Date().getFullYear();
    const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
    let max = 0;
    (list || []).forEach((row) => {
      const m = String(row.id || '').match(re);
      if (m) max = Math.max(max, Number(m[1]));
    });
    return `${prefix}-${year}-${String(max + 1).padStart(pad, '0')}`;
  };

  const seedInfoSecurity = () => {
    const ctrl1 = 'CTRL-2026-00001';
    const ctrl2 = 'CTRL-2026-00002';
    const ctrl3 = 'CTRL-2026-00003';
    const ctrl4 = 'CTRL-2026-00004';
    const ctrl5 = 'CTRL-2026-00005';
    const ctrl6 = 'CTRL-2026-00006';
    const risk1 = 'RISK-2026-00001';
    const risk2 = 'RISK-2026-00002';
    const risk3 = 'RISK-2026-00003';
    const risk4 = 'RISK-2026-00004';
    const now = Date.now();
    const isoDaysAgo = (d, h = 10, m = 0) => new Date(now - d * 86400000 - (10 - h) * 3600000 - m * 60000).toISOString();
    return {
      schemaVersion: 2,
    score: 91,
      prevScore: 88,
    mfaCoverage: 67,
      prevMfaCoverage: 61,
      compliancePct: 84,
      prevCompliancePct: 79,
      closedThisMonth: 8,
      prevClosedThisMonth: 5,
    controls: [
        {
          id: ctrl1,
          name: 'OAuth2 / SSO',
          category: 'قوية',
          framework: 'ISO 27001',
          compliance: 98,
          status: 'implemented',
          owner: 'أحمد الراشد',
          lastReview: '2026-08-01',
          nextReview: '2026-11-01',
          description: 'تسجيل دخول موحّد عبر OAuth2/SSO لكل أنظمة هوب.',
          evidence: ['sso-config.pdf'],
          relatedRisks: [risk2],
          relatedIncidents: [],
          reviewHistory: [{ at: '2026-08-01', by: 'أحمد الراشد', note: 'مراجعة ناجحة' }],
          attachments: [],
          archived: false,
        },
        {
          id: ctrl2,
          name: 'MFA متعدد العوامل',
          category: 'متوسطة',
          framework: 'NIST',
          compliance: 67,
          status: 'partial',
          owner: 'سارة العتيبي',
          lastReview: '2026-07-15',
          nextReview: '2026-09-20',
          description: 'إلزام المصادقة متعددة العوامل للحسابات الحساسة.',
          evidence: ['mfa-rollout.xlsx'],
          relatedRisks: [risk1],
          relatedIncidents: ['INC-2026-00124'],
          reviewHistory: [{ at: '2026-07-15', by: 'سارة العتيبي', note: 'تغطية جزئية للأقسام' }],
          attachments: [],
          archived: false,
        },
        {
          id: ctrl3,
          name: 'SIEM مراقبة الأحداث',
          category: 'قوية',
          framework: 'ISO 27001',
          compliance: 88,
          status: 'implemented',
          owner: 'مركز SOC',
          lastReview: '2026-08-10',
          nextReview: '2026-10-10',
          description: 'تجميع وتنبيه أحداث الأمن عبر SIEM.',
          evidence: ['siem-dashboard.png'],
          relatedRisks: [risk3],
          relatedIncidents: ['INC-2026-00125'],
          reviewHistory: [],
          attachments: [],
          archived: false,
        },
        {
          id: ctrl4,
          name: 'تشفير البيانات أثناء النقل',
          category: 'قوية',
          framework: 'Internal Control',
          compliance: 100,
          status: 'implemented',
          owner: 'فريق البنية',
          lastReview: '2026-06-20',
          nextReview: '2026-12-20',
          description: 'TLS 1.2+ لجميع القنوات الخارجية والداخلية الحساسة.',
          evidence: ['tls-audit.pdf'],
          relatedRisks: [],
          relatedIncidents: [],
          reviewHistory: [],
          attachments: [],
          archived: false,
        },
        {
          id: ctrl5,
          name: 'إدارة الصلاحيات RBAC',
          category: 'قوية',
          framework: 'NIST',
          compliance: 94,
          status: 'implemented',
          owner: 'الحوكمة',
          lastReview: '2026-08-05',
          nextReview: '2026-09-18',
          description: 'أدوار وصلاحيات مبنية على الوظيفة مع مراجعة دورية.',
          evidence: ['rbac-matrix.xlsx'],
          relatedRisks: [risk4],
          relatedIncidents: ['INC-2026-00126'],
          reviewHistory: [],
          attachments: [],
          archived: false,
        },
        {
          id: ctrl6,
          name: 'اختبار اختراق دوري',
          category: 'متوسطة',
          framework: 'ISO 27001',
          compliance: 72,
          status: 'needs_review',
          owner: 'فريق الاختبار',
          lastReview: '2026-05-01',
          nextReview: '2026-09-15',
          description: 'اختبارات اختراق ربع سنوية للأنظمة الحرجة.',
          evidence: [],
          relatedRisks: [risk1, risk3],
          relatedIncidents: [],
          reviewHistory: [{ at: '2026-05-01', by: 'فريق الاختبار', note: 'يحتاج جدولة الجولة القادمة' }],
          attachments: [],
          archived: false,
        },
    ],
    incidents: [
        {
          id: 'INC-2026-00125',
          title: 'محاولة وصول غير مصرح من عنوان خارجي',
          type: 'وصول غير مصرح',
          severity: 'حرج',
          status: 'جديد',
          department: 'ERP',
          owner: 'أحمد الراشد',
          discoveredAt: isoDaysAgo(0, 9, 15),
          createdAt: isoDaysAgo(0, 9, 40),
          source: 'SIEM',
          description: 'رصد محاولات متكررة للوصول إلى لوحة إدارة ERP من IP غير موثوق.',
          initialActions: 'حظر العنوان مؤقتاً وتنبيه SOC.',
          sensitiveData: false,
          tags: ['brute-force', 'erp'],
          slaHours: 4,
          slaDueAt: isoDaysAgo(-0.1, 13, 15),
          timeline: [
            { at: isoDaysAgo(0, 9, 15), by: 'SIEM', text: 'تنبيه تلقائي: محاولات فاشلة مرتفعة' },
            { at: isoDaysAgo(0, 9, 40), by: 'أحمد الراشد', text: 'تسجيل الحادث وبدء الاحتواء' },
          ],
          actionsTaken: [{ at: isoDaysAgo(0, 9, 45), by: 'أحمد الراشد', text: 'حظر IP في الجدار الناري' }],
          attachments: [{ name: 'siem-alert.pdf', at: isoDaysAgo(0, 9, 50) }],
          rootCause: '',
          resolution: '',
          correctiveActions: [],
          preventiveActions: [],
          notes: [],
          relatedRisks: [risk3],
          relatedControls: [ctrl3],
          archived: false,
          draft: false,
        },
        {
          id: 'INC-2026-00124',
          title: 'حملة تصيد إلكتروني على موظفي المالية',
          type: 'تصيد إلكتروني',
          severity: 'مرتفع',
          status: 'قيد التحقيق',
          department: 'المالية',
          owner: 'سارة العتيبي',
          discoveredAt: isoDaysAgo(1, 11, 0),
          createdAt: isoDaysAgo(1, 11, 20),
          source: 'Email Security',
          description: 'رسائل تصيد تستهدف بيانات الدخول لحسابات المالية.',
          initialActions: 'عزل الرسائل وإشعار الموظفين.',
          sensitiveData: true,
          tags: ['phishing', 'email'],
          slaHours: 8,
          slaDueAt: isoDaysAgo(0.7, 19, 0),
          timeline: [
            { at: isoDaysAgo(1, 11, 0), by: 'Email Security', text: 'اكتشاف حملة تصيد' },
            { at: isoDaysAgo(1, 11, 20), by: 'سارة العتيبي', text: 'فتح تحقيق أمني' },
          ],
          actionsTaken: [{ at: isoDaysAgo(1, 12, 0), by: 'سارة العتيبي', text: 'حجر الرسائل المشبوهة' }],
          attachments: [],
          rootCause: '',
          resolution: '',
          correctiveActions: [],
          preventiveActions: [],
          notes: [{ at: isoDaysAgo(1, 14, 0), by: 'سارة العتيبي', text: 'لا توجد مؤشرات اختراق ناجح حتى الآن' }],
          relatedRisks: [risk1],
          relatedControls: [ctrl2],
          archived: false,
          draft: false,
        },
        {
          id: 'INC-2026-00126',
          title: 'تنبيه صلاحيات متجاوزة على حساب خدمة',
          type: 'إساءة استخدام صلاحيات',
          severity: 'متوسط',
          status: 'قيد المعالجة',
          department: 'الحوكمة',
          owner: 'نور فهد',
          discoveredAt: isoDaysAgo(2, 8, 30),
          createdAt: isoDaysAgo(2, 9, 0),
          source: 'موظف / بلاغ داخلي',
          description: 'حساب خدمة يمتلك صلاحيات أوسع من المطلوب بعد تحديث النظام.',
          initialActions: 'تعليق الصلاحيات الزائدة.',
          sensitiveData: false,
          tags: ['rbac', 'privilege'],
          slaHours: 24,
          slaDueAt: isoDaysAgo(1, 8, 30),
          timeline: [
            { at: isoDaysAgo(2, 8, 30), by: 'موظف / بلاغ داخلي', text: 'بلاغ داخلي من فريق الحوكمة' },
          ],
          actionsTaken: [{ at: isoDaysAgo(2, 9, 10), by: 'نور فهد', text: 'تقليص صلاحيات الحساب' }],
          attachments: [],
          rootCause: '',
          resolution: '',
          correctiveActions: [],
          preventiveActions: [],
          notes: [],
          relatedRisks: [risk4],
          relatedControls: [ctrl5],
          archived: false,
          draft: false,
        },
        {
          id: 'INC-2026-00120',
          title: 'تنبيه Malware على محطة عمل',
          type: 'Malware',
          severity: 'منخفض',
          status: 'مغلق',
          department: 'الدعم الفني',
          owner: 'مركز SOC',
          discoveredAt: isoDaysAgo(12, 15, 0),
          createdAt: isoDaysAgo(12, 15, 20),
          closedAt: isoDaysAgo(11, 10, 0),
          source: 'EDR',
          description: 'ملف مشبوه حُجر تلقائياً بواسطة EDR.',
          initialActions: 'عزل المحطة ومسح كامل.',
          sensitiveData: false,
          tags: ['edr', 'endpoint'],
          slaHours: 12,
          slaDueAt: isoDaysAgo(11.5, 3, 0),
          timeline: [
            { at: isoDaysAgo(12, 15, 0), by: 'EDR', text: 'اكتشاف وحجر تلقائي' },
            { at: isoDaysAgo(11, 10, 0), by: 'مركز SOC', text: 'إغلاق بعد التنظيف' },
          ],
          actionsTaken: [{ at: isoDaysAgo(12, 16, 0), by: 'مركز SOC', text: 'إعادة تثبيت الوكيل الأمني' }],
          attachments: [{ name: 'edr-report.pdf', at: isoDaysAgo(12, 16, 30) }],
          rootCause: 'تحميل ملف من مصدر غير موثوق',
          resolution: 'تم التنظيف وإعادة المحطة للخدمة',
          correctiveActions: ['تحديث سياسات الويب'],
          preventiveActions: ['توعية المستخدم'],
          notes: [],
          relatedRisks: [],
          relatedControls: [ctrl3],
          archived: false,
          draft: false,
        },
      ],
      risks: [
        {
          id: risk1,
          name: 'ضعف تغطية MFA على الحسابات الحساسة',
          category: 'هوية ووصول',
          likelihood: 4,
          impact: 5,
          score: 20,
          level: 'حرج',
          department: 'هوية',
          owner: 'سارة العتيبي',
          treatmentPlan: 'إلزام MFA لكل الحسابات ذات الصلاحيات العالية خلال 30 يوماً.',
          targetDate: '2026-09-30',
          status: 'قيد المعالجة',
          relatedControls: [ctrl2],
          relatedIncidents: ['INC-2026-00124'],
          description: 'نسبة MFA الحالية 67% وتترك حسابات حساسة معرضة.',
          archived: false,
        },
        {
          id: risk2,
          name: 'اعتماد مزود هوية واحد دون بديل',
          category: 'توفر',
          likelihood: 2,
          impact: 4,
          score: 8,
          level: 'متوسط',
          department: 'البنية',
          owner: 'أحمد الراشد',
          treatmentPlan: 'إعداد مزود احتياطي واختبار التحول.',
          targetDate: '2026-10-15',
          status: 'مفتوح',
          relatedControls: [ctrl1],
          relatedIncidents: [],
          description: 'انقطاع مزود SSO قد يوقف الدخول لكل الأنظمة.',
          archived: false,
        },
        {
          id: risk3,
          name: 'تأخر الاستجابة لتنبيهات SIEM الحرجة',
          category: 'رصد واستجابة',
          likelihood: 3,
          impact: 4,
          score: 12,
          level: 'مرتفع',
          department: 'SOC',
          owner: 'مركز SOC',
          treatmentPlan: 'مناوبة 24/7 وتحسين قواعد التصعيد.',
          targetDate: '2026-09-25',
          status: 'قيد المعالجة',
          relatedControls: [ctrl3, ctrl6],
          relatedIncidents: ['INC-2026-00125'],
          description: 'SLA غير مكتمل لبعض التنبيهات الحرجة خارج ساعات العمل.',
          archived: false,
        },
        {
          id: risk4,
          name: 'تراكم صلاحيات زائدة على حسابات الخدمة',
          category: 'صلاحيات',
          likelihood: 3,
          impact: 3,
          score: 9,
          level: 'متوسط',
          department: 'الحوكمة',
          owner: 'نور فهد',
          treatmentPlan: 'مراجعة ربع سنوية وصلاحيات أقل امتيازاً.',
          targetDate: '2026-10-01',
          status: 'مفتوح',
          relatedControls: [ctrl5],
          relatedIncidents: ['INC-2026-00126'],
          description: 'حسابات خدمة قد تحتفظ بصلاحيات قديمة بعد الترقيات.',
          archived: false,
        },
      ],
      auditLog: [
        {
          id: uid('secaud'),
          user: 'النظام',
          action: 'تهيئة الوحدة',
          entityType: 'module',
          entityId: 'info-security',
          entityLabel: 'أمن المعلومات',
          at: isoDaysAgo(20, 9, 0),
          oldValue: '',
          newValue: 'schema v2',
        },
      ],
      notifications: [
        {
          id: uid('secn'),
          type: 'critical_incident',
          title: 'حادث حرج جديد',
          body: 'INC-2026-00125 — محاولة وصول غير مصرح',
          at: isoDaysAgo(0, 9, 40),
          read: false,
          linkId: 'INC-2026-00125',
        },
        {
          id: uid('secn'),
          type: 'control_review',
          title: 'ضابط يحتاج مراجعة',
          body: 'اختبار اختراق دوري — المراجعة القادمة 2026-09-15',
          at: isoDaysAgo(1, 8, 0),
          read: false,
          linkId: 'CTRL-2026-00006',
        },
        {
          id: uid('secn'),
          type: 'critical_risk',
          title: 'خطر حرج قائم',
          body: 'ضعف تغطية MFA على الحسابات الحساسة',
          at: isoDaysAgo(2, 10, 0),
          read: false,
          linkId: 'RISK-2026-00001',
        },
      ],
      people: ['أحمد الراشد', 'سارة العتيبي', 'نور فهد', 'مركز SOC', 'فريق البنية', 'فريق الاختبار', 'الحوكمة'],
      departments: ['ERP', 'المالية', 'الحوكمة', 'الدعم الفني', 'هوية', 'SOC', 'البنية', 'HR', 'LMS'],
    };
  };

  const recomputeInfoSecurityKpis = (sec = get().infoSecurity) => {
    if (!sec) return sec;
    const incidents = (sec.incidents || []).filter((x) => !x.archived && !x.draft);
    const controls = (sec.controls || []).filter((x) => !x.archived);
    const risks = (sec.risks || []).filter((x) => !x.archived);
    const openStatuses = new Set(['جديد', 'قيد التحقيق', 'قيد المعالجة', 'تم الاحتواء', 'open', 'investigating']);
    sec.openIncidents = incidents.filter((i) => openStatuses.has(i.status)).length;
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    sec.closedThisMonth = incidents.filter((i) => {
      if (i.status !== 'مغلق' && i.status !== 'closed') return false;
      const d = new Date(i.closedAt || i.createdAt || 0);
      return d.getMonth() === month && d.getFullYear() === year;
    }).length;
    const activeControls = controls.filter((c) => c.status === 'implemented' || c.status === 'active').length;
    sec.activeControls = activeControls;
    sec.criticalRisks = risks.filter((r) => r.level === 'حرج' && r.status !== 'مغلق').length;
    if (controls.length) {
      sec.compliancePct = Math.round(controls.reduce((a, c) => a + Number(c.compliance || c.coverage || 0), 0) / controls.length);
    }
    const mfa = controls.find((c) => /MFA/i.test(c.name));
    if (mfa) sec.mfaCoverage = Number(mfa.compliance || mfa.coverage || sec.mfaCoverage || 0);
    const openCritical = incidents.filter((i) => openStatuses.has(i.status) && (i.severity === 'حرج' || i.severity === 'مرتفع')).length;
    const base = 100 - openCritical * 4 - (sec.criticalRisks || 0) * 3 - Math.max(0, 90 - (sec.compliancePct || 0)) * 0.3;
    sec.score = Math.max(40, Math.min(99, Math.round(base)));
    return sec;
  };

  const seedDataGovernance = () => {
    const now = Date.now();
    const isoDaysAgo = (d, h = 10) => new Date(now - d * 86400000 - (12 - h) * 3600000).toISOString();
    const src1 = 'SRC-2026-00001';
    const src2 = 'SRC-2026-00002';
    const src3 = 'SRC-2026-00003';
    const src4 = 'SRC-2026-00004';
    const ast1 = 'AST-2026-00001';
    const ast2 = 'AST-2026-00002';
    const ast3 = 'AST-2026-00003';
    const ast4 = 'AST-2026-00004';
    const ast5 = 'AST-2026-00005';
    const ast6 = 'AST-2026-00006';
    const pol1 = 'POL-DG-2026-00001';
    const pol2 = 'POL-DG-2026-00002';
    const pol3 = 'POL-DG-2026-00003';
    const rule1 = 'QR-2026-00001';
    const rule2 = 'QR-2026-00002';
    const rule3 = 'QR-2026-00003';
    return {
      schemaVersion: 2,
    qualityScore: 87,
      prevQualityScore: 84,
    classifiedPct: 74,
      prevClassifiedPct: 68,
    retentionOk: 91,
      metadataCompletion: 78,
      prevMetadataCompletion: 72,
      people: ['سارة العتيبي', 'أحمد الراشد', 'نور فهد', 'فريق البيانات', 'مركز التكامل', 'الحوكمة'],
      departments: ['CRM', 'المالية', 'HR', 'التشغيل', 'المحفظة', 'الحاضنات', 'الإعلانات', 'Hub Core'],
      sources: [
        {
          id: src1,
          name: 'CRM Production DB',
          type: 'PostgreSQL',
          system: 'CRM',
          environment: 'Production',
          status: 'connected',
          lastSync: isoDaysAgo(0, 8),
          assetsCount: 2,
          owner: 'سارة العتيبي',
          syncMethod: 'CDC / Hourly',
          host: 'crm-db.naiosh.local',
          port: 5432,
          database: 'crm_prod',
          authType: 'Service Account',
          schedule: 'كل ساعة',
          archived: false,
        },
        {
          id: src2,
          name: 'ERP Finance API',
          type: 'API',
          system: 'ERP',
          environment: 'Production',
          status: 'connected',
          lastSync: isoDaysAgo(0, 7),
          assetsCount: 1,
          owner: 'أحمد الراشد',
          syncMethod: 'REST Sync',
          host: 'https://erp.naiosh.local/api',
          port: 443,
          database: '',
          authType: 'OAuth2',
          schedule: 'كل 30 دقيقة',
          archived: false,
        },
        {
          id: src3,
          name: 'Wallet Transactions Warehouse',
          type: 'Data Warehouse',
          system: 'Wallet',
          environment: 'Production',
          status: 'degraded',
          lastSync: isoDaysAgo(1, 22),
          assetsCount: 1,
          owner: 'نور فهد',
          syncMethod: 'ETL Nightly',
          host: 'dwh.naiosh.local',
          port: 5432,
          database: 'wallet_dwh',
          authType: 'Service Account',
          schedule: 'يومياً 02:00',
          archived: false,
        },
        {
          id: src4,
          name: 'Ads Studio CSV Drop',
          type: 'Excel / CSV',
          system: 'Ads Studio',
          environment: 'Staging',
          status: 'failed',
          lastSync: isoDaysAgo(3, 11),
          assetsCount: 1,
          owner: 'فريق البيانات',
          syncMethod: 'Manual / File',
          host: 's3://naiosh-ads-drop',
          port: 0,
          database: '',
          authType: 'Access Key',
          schedule: 'عند الطلب',
          archived: false,
        },
      ],
      assets: [
        {
          id: ast1,
          name: 'بيانات العملاء',
          businessName: 'Customer Master',
          type: 'Table',
          description: 'السجل الرئيسي لبيانات عملاء نايوش عبر CRM.',
          technicalDescription: 'جدول customers في crm_prod.public',
          sourceId: src1,
          sourceName: 'CRM Production DB',
          system: 'CRM',
          database: 'crm_prod',
          schema: 'public',
          tableName: 'customers',
          location: 'crm_prod.public.customers',
          department: 'CRM',
          owner: 'سارة العتيبي',
          steward: 'نور فهد',
          technicalOwner: 'مركز التكامل',
          classification: 'سري',
          sensitivity: 'Customer',
          quality: 92,
          status: 'approved',
          metadataCompletion: 95,
          retentionPolicy: pol2,
          tags: ['customers', 'pii'],
          fields: [
            { name: 'customer_id', businessName: 'معرّف العميل', dataType: 'uuid', nullable: false, pk: true, classification: 'داخلي', sensitive: false, quality: 99 },
            { name: 'full_name', businessName: 'الاسم الكامل', dataType: 'text', nullable: false, pk: false, classification: 'سري', sensitive: true, quality: 94 },
            { name: 'national_id', businessName: 'رقم الهوية', dataType: 'varchar', nullable: true, pk: false, classification: 'سري للغاية', sensitive: true, quality: 88 },
            { name: 'email', businessName: 'البريد', dataType: 'varchar', nullable: true, pk: false, classification: 'سري', sensitive: true, quality: 90 },
            { name: 'mobile', businessName: 'الجوال', dataType: 'varchar', nullable: true, pk: false, classification: 'سري', sensitive: true, quality: 91 },
            { name: 'created_at', businessName: 'تاريخ الإنشاء', dataType: 'timestamptz', nullable: false, pk: false, classification: 'داخلي', sensitive: false, quality: 100 },
          ],
          lineage: {
            upstream: [{ id: 'n1', name: 'CRM', type: 'System' }, { id: 'n2', name: 'crm_prod', type: 'Database' }, { id: 'n3', name: 'ETL Customer Sync', type: 'Transformation' }],
            node: { id: 'n4', name: 'Customer Master', type: 'Dataset' },
            downstream: [{ id: 'n5', name: 'BI Customer Dashboard', type: 'Report' }, { id: 'n6', name: 'Support Portal', type: 'System' }],
          },
          classifiedBy: 'نور فهد',
          classificationDate: '2026-07-01',
          nextReview: '2026-10-01',
          createdBy: 'سارة العتيبي',
          createdAt: isoDaysAgo(40, 9),
          updatedBy: 'نور فهد',
          updatedAt: isoDaysAgo(1, 14),
          comments: [{ at: isoDaysAgo(2, 10), by: 'نور فهد', text: 'تمت مراجعة الحقول الحساسة' }],
          attachments: [{ name: 'customer-dict.pdf', at: isoDaysAgo(10, 11) }],
          archived: false,
          draft: false,
        },
        {
          id: ast2,
          name: 'سجلات التشغيل',
          businessName: 'Ops Event Logs',
          type: 'Table',
          description: 'سجلات أحداث التشغيل المركزية في Hub Core.',
          technicalDescription: 'hub_core.ops.event_logs',
          sourceId: src1,
          sourceName: 'CRM Production DB',
          system: 'Hub Core',
          database: 'hub_core',
          schema: 'ops',
          tableName: 'event_logs',
          location: 'hub_core.ops.event_logs',
          department: 'التشغيل',
          owner: 'أحمد الراشد',
          steward: 'فريق البيانات',
          technicalOwner: 'مركز التكامل',
          classification: 'داخلي',
          sensitivity: 'Operational',
          quality: 88,
          status: 'approved',
          metadataCompletion: 82,
          retentionPolicy: pol2,
          tags: ['ops', 'logs'],
          fields: [
            { name: 'event_id', businessName: 'معرّف الحدث', dataType: 'uuid', nullable: false, pk: true, classification: 'داخلي', sensitive: false, quality: 100 },
            { name: 'payload', businessName: 'المحتوى', dataType: 'jsonb', nullable: true, pk: false, classification: 'داخلي', sensitive: false, quality: 85 },
          ],
          lineage: {
            upstream: [{ id: 'o1', name: 'Hub Services', type: 'System' }, { id: 'o2', name: 'Event Bus', type: 'Transformation' }],
            node: { id: 'o3', name: 'Ops Event Logs', type: 'Dataset' },
            downstream: [{ id: 'o4', name: 'Ops Monitoring', type: 'Report' }],
          },
          classifiedBy: 'أحمد الراشد',
          classificationDate: '2026-06-15',
          nextReview: '2026-09-15',
          createdBy: 'أحمد الراشد',
          createdAt: isoDaysAgo(55, 10),
          updatedBy: 'فريق البيانات',
          updatedAt: isoDaysAgo(4, 9),
          comments: [],
          attachments: [],
          archived: false,
          draft: false,
        },
        {
          id: ast3,
          name: 'معاملات المحفظة',
          businessName: 'Wallet Transactions',
          type: 'Dataset',
          description: 'معاملات نقاط المحفظة والتحويلات.',
          technicalDescription: 'wallet_dwh.fact_transactions',
          sourceId: src3,
          sourceName: 'Wallet Transactions Warehouse',
          system: 'Wallet',
          database: 'wallet_dwh',
          schema: 'public',
          tableName: 'fact_transactions',
          location: 'wallet_dwh.public.fact_transactions',
          department: 'المحفظة',
          owner: 'نور فهد',
          steward: 'سارة العتيبي',
          technicalOwner: 'مركز التكامل',
          classification: 'سري',
          sensitivity: 'Financial',
          quality: 95,
          status: 'approved',
          metadataCompletion: 90,
          retentionPolicy: pol1,
          tags: ['wallet', 'finance'],
          fields: [
            { name: 'txn_id', businessName: 'رقم المعاملة', dataType: 'varchar', nullable: false, pk: true, classification: 'سري', sensitive: false, quality: 100 },
            { name: 'amount', businessName: 'المبلغ', dataType: 'numeric', nullable: false, pk: false, classification: 'سري', sensitive: true, quality: 98 },
          ],
          lineage: {
            upstream: [{ id: 'w1', name: 'Wallet App', type: 'System' }, { id: 'w2', name: 'ETL Wallet', type: 'Transformation' }],
            node: { id: 'w3', name: 'Wallet Transactions', type: 'Dataset' },
            downstream: [{ id: 'w4', name: 'Finance Dashboard', type: 'Report' }],
          },
          classifiedBy: 'نور فهد',
          classificationDate: '2026-05-20',
          nextReview: '2026-11-20',
          createdBy: 'نور فهد',
          createdAt: isoDaysAgo(70, 8),
          updatedBy: 'نور فهد',
          updatedAt: isoDaysAgo(0, 18),
          comments: [],
          attachments: [],
          archived: false,
          draft: false,
        },
        {
          id: ast4,
          name: 'أرشيف الإعلانات',
          businessName: 'Ads Archive',
          type: 'File',
          description: 'ملفات حملات الإعلانات المؤرشفة.',
          technicalDescription: 'CSV drop zone',
          sourceId: src4,
          sourceName: 'Ads Studio CSV Drop',
          system: 'Ads Studio',
          database: '',
          schema: '',
          tableName: 'ads_archive.csv',
          location: 's3://naiosh-ads-drop/ads_archive.csv',
          department: 'الإعلانات',
          owner: '',
          steward: 'فريق البيانات',
          technicalOwner: 'مركز التكامل',
          classification: '',
          sensitivity: 'Operational',
          quality: 81,
          status: 'review',
          metadataCompletion: 55,
          retentionPolicy: '',
          tags: ['ads'],
          fields: [],
          lineage: {
            upstream: [{ id: 'a1', name: 'Ads Studio', type: 'System' }],
            node: { id: 'a2', name: 'Ads Archive', type: 'File' },
            downstream: [],
          },
          classifiedBy: '',
          classificationDate: '',
          nextReview: '2026-09-20',
          createdBy: 'فريق البيانات',
          createdAt: isoDaysAgo(20, 12),
          updatedBy: 'فريق البيانات',
          updatedAt: isoDaysAgo(2, 16),
          comments: [{ at: isoDaysAgo(2, 16), by: 'فريق البيانات', text: 'بحاجة لتعيين Data Owner وتصنيف' }],
          attachments: [],
          archived: false,
          draft: false,
        },
        {
          id: ast5,
          name: 'مستندات الحاضنات',
          businessName: 'Incubator Documents',
          type: 'Dataset',
          description: 'مستندات وملفات الحاضنات القطاعية.',
          technicalDescription: 'incubators.docs',
          sourceId: src2,
          sourceName: 'ERP Finance API',
          system: 'Incubators',
          database: 'incubators',
          schema: 'docs',
          tableName: 'documents',
          location: 'incubators.docs.documents',
          department: 'الحاضنات',
          owner: 'أحمد الراشد',
          steward: 'سارة العتيبي',
          technicalOwner: 'مركز التكامل',
          classification: 'داخلي',
          sensitivity: 'Operational',
          quality: 79,
          status: 'approved',
          metadataCompletion: 70,
          retentionPolicy: pol2,
          tags: ['incubators'],
          fields: [{ name: 'doc_id', businessName: 'معرّف المستند', dataType: 'uuid', nullable: false, pk: true, classification: 'داخلي', sensitive: false, quality: 100 }],
          lineage: {
            upstream: [{ id: 'i1', name: 'Incubators Portal', type: 'System' }],
            node: { id: 'i2', name: 'Incubator Documents', type: 'Dataset' },
            downstream: [{ id: 'i3', name: 'Knowledge Center', type: 'System' }],
          },
          classifiedBy: 'سارة العتيبي',
          classificationDate: '2026-08-01',
          nextReview: '2026-12-01',
          createdBy: 'أحمد الراشد',
          createdAt: isoDaysAgo(30, 9),
          updatedBy: 'سارة العتيبي',
          updatedAt: isoDaysAgo(5, 11),
          comments: [],
          attachments: [],
          archived: false,
          draft: false,
        },
        {
          id: ast6,
          name: 'موظفو HR الأساسي',
          businessName: 'HR Employee Master',
          type: 'Table',
          description: 'بيانات الموظفين الأساسية — مسودة بانتظار الاعتماد.',
          technicalDescription: 'hr.employees',
          sourceId: src2,
          sourceName: 'ERP Finance API',
          system: 'HR',
          database: 'hr',
          schema: 'public',
          tableName: 'employees',
          location: 'hr.public.employees',
          department: 'HR',
          owner: 'سارة العتيبي',
          steward: 'نور فهد',
          technicalOwner: 'مركز التكامل',
          classification: 'سري',
          sensitivity: 'HR',
          quality: 76,
          status: 'pending_approval',
          metadataCompletion: 68,
          retentionPolicy: pol1,
          tags: ['hr', 'pii'],
          fields: [
            { name: 'emp_id', businessName: 'رقم الموظف', dataType: 'varchar', nullable: false, pk: true, classification: 'سري', sensitive: true, quality: 95 },
            { name: 'salary', businessName: 'الراتب', dataType: 'numeric', nullable: true, pk: false, classification: 'سري للغاية', sensitive: true, quality: 80 },
          ],
          lineage: {
            upstream: [{ id: 'h1', name: 'HR System', type: 'System' }],
            node: { id: 'h2', name: 'HR Employee Master', type: 'Dataset' },
            downstream: [],
          },
          classifiedBy: 'نور فهد',
          classificationDate: '2026-09-01',
          nextReview: '2026-12-01',
          createdBy: 'نور فهد',
          createdAt: isoDaysAgo(3, 10),
          updatedBy: 'نور فهد',
          updatedAt: isoDaysAgo(1, 9),
          comments: [],
          attachments: [],
          archived: false,
          draft: false,
        },
      ],
      qualityRules: [
        {
          id: rule1,
          name: 'البريد لا يكون فارغاً',
          assetId: ast1,
          field: 'email',
          ruleType: 'Completeness',
          condition: 'email IS NOT NULL',
          threshold: 95,
          severity: 'مرتفع',
          owner: 'نور فهد',
          schedule: 'يومياً',
          passed: 1240,
          failed: 38,
          lastRun: isoDaysAgo(0, 6),
          nextRun: isoDaysAgo(-1, 6),
          status: 'active',
        },
        {
          id: rule2,
          name: 'هوية فريدة',
          assetId: ast1,
          field: 'national_id',
          ruleType: 'Uniqueness',
          condition: 'COUNT(DISTINCT national_id) = COUNT(*)',
          threshold: 100,
          severity: 'حرج',
          owner: 'سارة العتيبي',
          schedule: 'يومياً',
          passed: 1270,
          failed: 8,
          lastRun: isoDaysAgo(0, 6),
          nextRun: isoDaysAgo(-1, 6),
          status: 'active',
        },
        {
          id: rule3,
          name: 'مبلغ المعاملة موجب',
          assetId: ast3,
          field: 'amount',
          ruleType: 'Validity',
          condition: 'amount > 0',
          threshold: 99,
          severity: 'متوسط',
          owner: 'نور فهد',
          schedule: 'كل ساعة',
          passed: 9800,
          failed: 12,
          lastRun: isoDaysAgo(0, 7),
          nextRun: isoDaysAgo(-0.04, 7),
          status: 'active',
        },
      ],
      qualityIssues: [
        {
          id: 'QI-2026-00001',
          assetId: ast1,
          dataset: 'بيانات العملاء',
          field: 'email',
          ruleId: rule1,
          rule: 'البريد لا يكون فارغاً',
          severity: 'مرتفع',
          failedRecords: 38,
          owner: 'نور فهد',
          detectedAt: isoDaysAgo(0, 6),
          status: 'New',
        },
        {
          id: 'QI-2026-00002',
          assetId: ast1,
          dataset: 'بيانات العملاء',
          field: 'national_id',
          ruleId: rule2,
          rule: 'هوية فريدة',
          severity: 'حرج',
          failedRecords: 8,
          owner: 'سارة العتيبي',
          detectedAt: isoDaysAgo(0, 6),
          status: 'Assigned',
        },
        {
          id: 'QI-2026-00003',
          assetId: ast3,
          dataset: 'معاملات المحفظة',
          field: 'amount',
          ruleId: rule3,
          rule: 'مبلغ المعاملة موجب',
          severity: 'متوسط',
          failedRecords: 12,
          owner: 'نور فهد',
          detectedAt: isoDaysAgo(0, 7),
          status: 'In Progress',
        },
        {
          id: 'QI-2026-00004',
          assetId: ast4,
          dataset: 'أرشيف الإعلانات',
          field: '—',
          ruleId: '',
          rule: 'اكتمال Metadata',
          severity: 'مرتفع',
          failedRecords: 1,
          owner: 'فريق البيانات',
          detectedAt: isoDaysAgo(2, 12),
          status: 'New',
        },
        {
          id: 'QI-2026-00005',
          assetId: ast5,
          dataset: 'مستندات الحاضنات',
          field: 'doc_id',
          ruleId: '',
          rule: 'Timeliness — تأخر تحديث',
          severity: 'منخفض',
          failedRecords: 3,
          owner: 'أحمد الراشد',
          detectedAt: isoDaysAgo(5, 9),
          status: 'New',
        },
    ],
    policies: [
        {
          id: pol1,
          name: 'سياسة بيانات العملاء الحساسة',
          title: 'سياسة بيانات العملاء الحساسة',
          category: 'حساسية / وصول',
          appliesTo: 'Customer / PII',
          owner: 'الحوكمة',
          effectiveDate: '2026-01-01',
          reviewDate: '2026-10-01',
          status: 'active',
          version: '1.2',
          scope: 'كل المنصات',
        },
        {
          id: pol2,
          name: 'احتفاظ السجلات 24 شهراً',
          title: 'احتفاظ السجلات 24 شهراً',
          category: 'Retention',
          appliesTo: 'تشغيل / سجلات',
          owner: 'الحوكمة',
          effectiveDate: '2026-02-01',
          reviewDate: '2026-09-30',
          status: 'active',
          version: '1.0',
          scope: 'التشغيل',
        },
        {
          id: pol3,
          name: 'تصنيف البيانات الإلزامي',
          title: 'تصنيف البيانات الإلزامي',
          category: 'Classification',
          appliesTo: 'كل الأصول',
          owner: 'فريق البيانات',
          effectiveDate: '2026-03-01',
          reviewDate: '2026-09-15',
          status: 'review',
          version: '0.9',
          scope: 'كل المنصات',
        },
      ],
      approvals: [
        {
          id: 'APR-2026-00001',
          type: 'اعتماد أصل بيانات',
          assetId: ast6,
          entityLabel: 'موظفو HR الأساسي',
          requestedBy: 'نور فهد',
          assignedTo: 'سارة العتيبي',
          date: isoDaysAgo(1, 9),
          status: 'pending',
          comment: '',
        },
        {
          id: 'APR-2026-00002',
          type: 'تغيير تصنيف',
          assetId: ast4,
          entityLabel: 'أرشيف الإعلانات',
          requestedBy: 'فريق البيانات',
          assignedTo: 'الحوكمة',
          date: isoDaysAgo(2, 15),
          status: 'pending',
          comment: '',
        },
      ],
      integrations: [
        {
          id: 'INT-2026-00001',
          name: 'CRM → Hub Catalog',
          type: 'Database Sync',
          direction: 'Inbound',
          status: 'active',
          lastSync: isoDaysAgo(0, 8),
          nextSync: isoDaysAgo(-0.04, 8),
          records: 12840,
          lastError: '',
        },
        {
          id: 'INT-2026-00002',
          name: 'Hub → BI Warehouse',
          type: 'ETL',
          direction: 'Outbound',
          status: 'active',
          lastSync: isoDaysAgo(0, 2),
          nextSync: isoDaysAgo(-1, 2),
          records: 4200,
          lastError: '',
        },
        {
          id: 'INT-2026-00003',
          name: 'Ads Drop Zone',
          type: 'File',
          direction: 'Inbound',
          status: 'error',
          lastSync: isoDaysAgo(3, 11),
          nextSync: '',
          records: 0,
          lastError: 'Authentication Error — Access Key expired',
        },
      ],
      settings: {
        requireApproval: true,
        qualityThreshold: 80,
        scanSchedule: 'يومياً 03:00',
        notifyOnIssue: true,
        defaultRetentionMonths: 24,
        allowEmployeeCatalogView: true,
      },
      auditLog: [
        {
          id: uid('dgaud'),
          user: 'النظام',
          action: 'تهيئة وحدة حوكمة البيانات',
          module: 'data-governance',
          entityType: 'module',
          entityId: 'data-governance',
          entityLabel: 'حوكمة البيانات',
          at: isoDaysAgo(25, 9),
          oldValue: '',
          newValue: 'schema v2',
          status: 'ok',
        },
      ],
      // backward-compat aliases used by older UI snippets
      catalogs: [],
    };
  };

  const recomputeDataGovernanceKpis = (dg = get().dataGovernance) => {
    if (!dg) return dg;
    const assets = (dg.assets || dg.catalogs || []).filter((a) => !a.archived);
    const sources = (dg.sources || []).filter((s) => !s.archived);
    const issues = (dg.qualityIssues || []).filter((i) => !['Resolved', 'Closed'].includes(i.status));
    dg.totalAssets = assets.length;
    dg.connectedSources = sources.filter((s) => s.status === 'connected').length;
    dg.openQualityIssues = issues.length;
    dg.assetsNeedingReview = assets.filter((a) => a.status === 'review' || !a.classification || !a.owner).length;
    dg.sensitiveCount = assets.filter((a) => ['سري', 'سري للغاية', 'حساس', 'Restricted'].includes(a.classification) || ['Personal Data', 'Financial', 'HR', 'Customer', 'Credentials'].includes(a.sensitivity)).length;
    if (assets.length) {
      dg.qualityScore = Math.round(assets.reduce((sum, a) => sum + Number(a.quality || 0), 0) / assets.length);
      dg.classifiedPct = Math.round((assets.filter((a) => a.classification).length / assets.length) * 100);
      dg.metadataCompletion = Math.round(assets.reduce((sum, a) => sum + Number(a.metadataCompletion || 0), 0) / assets.length);
    }
    // keep legacy catalogs mirror for any leftover readers
    dg.catalogs = assets.map((a) => ({
      id: a.id,
      name: a.name,
      owner: a.owner || a.system,
      classification: a.classification || '—',
      quality: a.quality,
      status: a.status === 'approved' ? 'active' : a.status === 'review' ? 'review' : a.status,
    }));
    return dg;
  };

  const seedSystemsAutomation = () => {
    const now = Date.now();
    const isoAgo = (h, m = 0) => new Date(now - h * 3600000 - m * 60000).toISOString();
    const a1 = 'AUTO-2026-00001';
    const a2 = 'AUTO-2026-00002';
    const a3 = 'AUTO-2026-00003';
    const a4 = 'AUTO-2026-00004';
    const a5 = 'AUTO-2026-00005';
    const a6 = 'AUTO-2026-00006';
    const mk = (id, name, opts) => ({
      id,
      name,
      description: opts.description,
      module: opts.module,
      triggerType: opts.triggerType,
      triggerLabel: opts.triggerLabel,
      trigger: opts.triggerLabel,
      conditions: opts.conditions || [],
      actions: opts.actions || [],
      systems: opts.systems || [],
      system: (opts.systems || []).join(' · '),
      status: opts.status || 'active',
      runs: opts.runs || 0,
      successRuns: opts.successRuns || 0,
      failedRuns: opts.failedRuns || 0,
      successRate: opts.successRate || 100,
      lastRun: opts.lastRun || '',
      nextRun: opts.nextRun || '',
      createdBy: opts.createdBy || 'النظام',
      createdAt: opts.createdAt || isoAgo(240),
      creationMethod: opts.creationMethod || 'System Generated',
      templateUsed: opts.templateUsed || '',
      sourceModule: opts.sourceModule || opts.module,
      updatedBy: opts.updatedBy || opts.createdBy || 'النظام',
      updatedAt: opts.updatedAt || opts.lastRun || isoAgo(24),
      owner: opts.owner || opts.createdBy || 'مشغّل هوب',
      schedule: opts.schedule || null,
      retryPolicy: opts.retryPolicy || { retries: 3, waitMinutes: 5, onFail: 'notify' },
      errorHandling: opts.errorHandling || 'stop',
      timeoutSec: 120,
      logging: true,
      sensitive: !!opts.sensitive,
      archived: false,
      draft: false,
    });
    return {
      schemaVersion: 2,
      helpDismissed: false,
      activeFlows: 5,
    successRate: 96,
    savedHours: 148,
      settings: {
        timezone: 'Asia/Riyadh',
        defaultRetries: 3,
        queueMax: 50,
        notifyOnFail: true,
        retainExecDays: 90,
        requireConfirmSensitive: true,
      },
      automations: [
        mk(a1, 'مزامنة الأنظمة الليلية', {
          description: 'مزامنة ERP وLMS ليلاً وتسجيل نتيجة المزامنة.',
          module: 'العمليات',
          triggerType: 'schedule',
          triggerLabel: 'جدولة 02:00',
          conditions: [],
          actions: [
            { type: 'sync_data', label: 'مزامنة ERP' },
            { type: 'sync_data', label: 'مزامنة LMS' },
            { type: 'create_log', label: 'تسجيل نتيجة المزامنة' },
          ],
          systems: ['ERP', 'LMS'],
          status: 'active',
          runs: 128,
          successRuns: 124,
          failedRuns: 4,
          successRate: 97,
          lastRun: isoAgo(8),
          nextRun: isoAgo(-16),
          createdBy: 'مركز التكامل',
          owner: 'مركز التكامل',
          schedule: { every: 'يوم', time: '02:00' },
          sourceModule: 'التكامل',
        }),
        mk(a2, 'تنبيه انخفاض الإنتاجية', {
          description: 'عند انخفاض الإنتاجية عن الحد ترسل تنبيهاً لمدير القوى العاملة.',
          module: 'القوى العاملة',
          triggerType: 'event',
          triggerLabel: 'حدث قياس',
          conditions: [{ field: 'الإنتاجية', op: 'أقل من', value: '70' }],
          actions: [
            { type: 'send_notification', label: 'إرسال تنبيه انخفاض الإنتاجية' },
            { type: 'create_task', label: 'إنشاء مهمة متابعة' },
          ],
          systems: ['Workforce'],
          status: 'active',
          runs: 64,
          successRuns: 61,
          failedRuns: 3,
          successRate: 95,
          lastRun: isoAgo(5),
          nextRun: '',
          createdBy: 'سارة العتيبي',
          owner: 'سارة العتيبي',
          sourceModule: 'القوى العاملة',
          templateUsed: 'تنبيه الإنتاجية',
          creationMethod: 'Template',
        }),
        mk(a3, 'تفعيل سياسة عند الاعتماد', {
          description: 'عند اعتماد قرار حوكمة يتم تفعيل السياسة المرتبطة.',
          module: 'الحوكمة',
          triggerType: 'approval',
          triggerLabel: 'اعتماد حوكمة',
          conditions: [{ field: 'الحالة', op: 'يساوي', value: 'معتمد' }],
          actions: [
            { type: 'update_status', label: 'تفعيل السياسة' },
            { type: 'send_notification', label: 'إشعار المعنيين' },
          ],
          systems: ['Governance'],
          status: 'active',
          runs: 41,
          successRuns: 41,
          failedRuns: 0,
          successRate: 100,
          lastRun: isoAgo(30),
          createdBy: 'الحوكمة',
          owner: 'الحوكمة',
          sourceModule: 'الحوكمة',
        }),
        mk(a4, 'إصدار تقرير يومي للقائد', {
          description: 'إنشاء التقرير اليومي للقائد الأعلى الساعة 08:00.',
          module: 'التقارير',
          triggerType: 'schedule',
          triggerLabel: 'جدولة 08:00',
          conditions: [],
          actions: [
            { type: 'create_report', label: 'إنشاء التقرير اليومي' },
            { type: 'send_notification', label: 'إرسال للقائد' },
          ],
          systems: ['Reports'],
          status: 'active',
          runs: 90,
          successRuns: 88,
          failedRuns: 2,
          successRate: 98,
          lastRun: isoAgo(3),
          nextRun: isoAgo(-21),
          createdBy: 'نور فهد',
          owner: 'نور فهد',
          schedule: { every: 'يوم', time: '08:00' },
          sourceModule: 'التقارير',
        }),
        mk(a5, 'أرشفة إعلانات منتهية', {
          description: 'عند انتهاء الحملة أرشفة الإعلان تلقائياً.',
          module: 'الإعلانات',
          triggerType: 'status_change',
          triggerLabel: 'انتهاء حملة',
          conditions: [{ field: 'حالة الحملة', op: 'يساوي', value: 'منتهية' }],
          actions: [{ type: 'update_status', label: 'أرشفة الإعلان' }],
          systems: ['Ads'],
          status: 'paused',
          runs: 22,
          successRuns: 20,
          failedRuns: 2,
          successRate: 91,
          lastRun: isoAgo(72),
          createdBy: 'فريق الإعلانات',
          owner: 'فريق الإعلانات',
          sourceModule: 'الإعلانات',
        }),
        mk(a6, 'إنشاء مهمة من تنبيه أمني', {
          description: 'عند تسجيل حادث أمني حرج: إنشاء مهمة وتعيينها وإرسال إشعار.',
          module: 'أمن المعلومات',
          triggerType: 'create_record',
          triggerLabel: 'حادثة أمن',
          conditions: [
            { field: 'مستوى الخطورة', op: 'يساوي', value: 'حرج', logic: 'AND' },
            { field: 'الحالة', op: 'يساوي', value: 'جديد' },
          ],
          actions: [
            { type: 'create_task', label: 'إنشاء مهمة عاجلة' },
            { type: 'assign_user', label: 'تعيين لمسؤول الأمن' },
            { type: 'send_notification', label: 'إرسال إشعار' },
            { type: 'create_log', label: 'تسجيل العملية' },
          ],
          systems: ['Security', 'Tasks'],
          status: 'active',
          runs: 17,
          successRuns: 16,
          failedRuns: 1,
          successRate: 94,
          lastRun: isoAgo(2),
          createdBy: 'أحمد الراشد',
          owner: 'أحمد الراشد',
          creationMethod: 'إنشاء يدوي',
          sourceModule: 'أمن المعلومات',
          templateUsed: 'حادث أمني حرج',
        }),
    ],
    queue: [
        {
          id: 'Q-2026-00001',
          automationId: a2,
          name: 'أتمتة ترحيب العملاء الجدد',
          priority: 'عالي',
          status: 'queued',
          addedAt: isoAgo(1),
          expectedRun: isoAgo(-0.5),
          reason: 'انتظار نافذة التشغيل',
        },
        {
          id: 'Q-2026-00002',
          automationId: a1,
          name: 'أتمتة نسخ احتياطي للمنصات',
          priority: 'متوسط',
          status: 'queued',
          addedAt: isoAgo(2),
          expectedRun: isoAgo(-2),
          reason: 'جدولة ليلية',
        },
      ],
      executions: [
        {
          id: 'RUN-2026-001280',
          automationId: a6,
          automationName: 'إنشاء مهمة من تنبيه أمني',
          trigger: 'حادثة أمن',
          triggeredBy: 'Security Incident INC-2026-00125',
          startTime: isoAgo(2, 10),
          endTime: isoAgo(2, 8),
          durationSec: 2.1,
          steps: [
            { name: 'استلام المحفز', ok: true, at: isoAgo(2, 10), detail: 'INC-2026-00125' },
            { name: 'فحص الشروط', ok: true, at: isoAgo(2, 10), detail: 'الخطورة = حرج' },
            { name: 'إنشاء مهمة', ok: true, at: isoAgo(2, 9), detail: 'TASK-00921' },
            { name: 'تعيين مسؤول', ok: true, at: isoAgo(2, 9), detail: 'أحمد الراشد' },
            { name: 'إرسال إشعار', ok: true, at: isoAgo(2, 8), detail: 'تم' },
          ],
          status: 'Success',
          error: '',
        },
        {
          id: 'RUN-2026-001281',
          automationId: a1,
          automationName: 'مزامنة الأنظمة الليلية',
          trigger: 'جدولة 02:00',
          triggeredBy: 'Scheduler',
          startTime: isoAgo(8, 5),
          endTime: isoAgo(8, 0),
          durationSec: 48,
          steps: [
            { name: 'استلام المحفز', ok: true, at: isoAgo(8, 5), detail: 'Schedule' },
            { name: 'مزامنة ERP', ok: true, at: isoAgo(8, 3), detail: 'OK' },
            { name: 'مزامنة LMS', ok: false, at: isoAgo(8, 1), detail: 'Connection authentication expired' },
          ],
          status: 'Failed',
          error: 'فشل مزامنة LMS — انتهت صلاحية المصادقة',
        },
        {
          id: 'RUN-2026-001282',
          automationId: a4,
          automationName: 'إصدار تقرير يومي للقائد',
          trigger: 'جدولة 08:00',
          triggeredBy: 'Scheduler',
          startTime: isoAgo(3),
          endTime: isoAgo(2, 58),
          durationSec: 12,
          steps: [
            { name: 'استلام المحفز', ok: true, at: isoAgo(3), detail: 'Schedule' },
            { name: 'إنشاء التقرير', ok: true, at: isoAgo(2, 59), detail: 'Daily Report' },
            { name: 'إرسال للقائد', ok: true, at: isoAgo(2, 58), detail: 'OK' },
          ],
          status: 'Success',
          error: '',
        },
      ],
      connections: [
        { id: 'ACON-2026-00001', system: 'ERP', type: 'Database Sync', status: 'Connected', lastChecked: isoAgo(1), usedBy: [a1], owner: 'مركز التكامل' },
        { id: 'ACON-2026-00002', system: 'LMS', type: 'API', status: 'Error', lastChecked: isoAgo(8), usedBy: [a1], owner: 'مركز التكامل', lastError: 'Authentication expired' },
        { id: 'ACON-2026-00003', system: 'Security', type: 'Event Bus', status: 'Connected', lastChecked: isoAgo(0.5), usedBy: [a6], owner: 'أحمد الراشد' },
        { id: 'ACON-2026-00004', system: 'Tasks', type: 'Internal', status: 'Connected', lastChecked: isoAgo(0.5), usedBy: [a6, a2], owner: 'مشغّل هوب' },
        { id: 'ACON-2026-00005', system: 'Ads', type: 'Internal', status: 'Connected', lastChecked: isoAgo(4), usedBy: [a5], owner: 'فريق الإعلانات' },
      ],
      templates: [
        {
          id: 'TPL-SEC-01',
          category: 'SECURITY',
          name: 'عند تسجيل حادث حرج → مهمة + إشعار',
          module: 'أمن المعلومات',
          triggerType: 'create_record',
          triggerLabel: 'تسجيل حادث أمني',
          conditions: [{ field: 'مستوى الخطورة', op: 'يساوي', value: 'حرج' }],
          actions: [
            { type: 'create_task', label: 'إنشاء مهمة عاجلة' },
            { type: 'assign_user', label: 'تعيين لمسؤول الأمن' },
            { type: 'send_notification', label: 'إرسال إشعار' },
          ],
          systems: ['Security', 'Tasks'],
        },
        {
          id: 'TPL-DG-01',
          category: 'DATA GOVERNANCE',
          name: 'بيانات غير مصنفة → مهمة للـSteward',
          module: 'حوكمة البيانات',
          triggerType: 'event',
          triggerLabel: 'اكتشاف بيانات غير مصنفة',
          conditions: [{ field: 'التصنيف', op: 'يساوي', value: '' }],
          actions: [{ type: 'create_task', label: 'إنشاء مهمة تصنيف' }, { type: 'assign_user', label: 'تعيين Data Steward' }],
          systems: ['Data Governance'],
        },
        {
          id: 'TPL-WF-01',
          category: 'WORKFORCE',
          name: 'انخفاض الإنتاجية → تنبيه',
          module: 'القوى العاملة',
          triggerType: 'event',
          triggerLabel: 'حدث قياس',
          conditions: [{ field: 'الإنتاجية', op: 'أقل من', value: '70' }],
          actions: [{ type: 'send_notification', label: 'إرسال تنبيه' }],
          systems: ['Workforce'],
        },
        {
          id: 'TPL-GOV-01',
          category: 'GOVERNANCE',
          name: 'اعتماد قرار → تفعيل الإجراء',
          module: 'الحوكمة',
          triggerType: 'approval',
          triggerLabel: 'اعتماد قرار',
          conditions: [],
          actions: [{ type: 'update_status', label: 'تفعيل الإجراء المرتبط' }],
          systems: ['Governance'],
        },
        {
          id: 'TPL-REP-01',
          category: 'REPORTS',
          name: 'التقرير الشهري تلقائياً',
          module: 'التقارير',
          triggerType: 'schedule',
          triggerLabel: 'جدولة شهرية',
          conditions: [],
          actions: [{ type: 'create_report', label: 'إنشاء التقرير الشهري' }],
          systems: ['Reports'],
          schedule: { every: 'شهر', time: '09:00' },
        },
        {
          id: 'TPL-ADS-01',
          category: 'ADS',
          name: 'انتهاء حملة → أرشفة',
          module: 'الإعلانات',
          triggerType: 'status_change',
          triggerLabel: 'انتهاء حملة',
          conditions: [],
          actions: [{ type: 'update_status', label: 'أرشفة الحملة' }],
          systems: ['Ads'],
        },
      ],
      auditLog: [
        {
          id: uid('autaud'),
          user: 'النظام',
          action: 'تهيئة وحدة الأتمتة',
          automationId: '',
          automationName: 'systems-automation',
          at: isoAgo(200),
          oldValue: '',
          newValue: 'schema v2',
        },
      ],
      people: ['أحمد الراشد', 'سارة العتيبي', 'نور فهد', 'مركز التكامل', 'الحوكمة', 'فريق الإعلانات', 'مشغّل هوب'],
      flows: [],
    };
  };

  const recomputeAutomationKpis = (sa = get().systemsAutomation) => {
    if (!sa) return sa;
    const autos = (sa.automations || sa.flows || []).filter((a) => !a.archived);
    const execs = sa.executions || [];
    sa.activeFlows = autos.filter((a) => a.status === 'active').length;
    sa.pausedFlows = autos.filter((a) => a.status === 'paused').length;
    sa.draftFlows = autos.filter((a) => a.status === 'draft').length;
    sa.errorFlows = autos.filter((a) => a.status === 'error').length;
    sa.runningNow = execs.filter((e) => e.status === 'Running').length;
    sa.queuedCount = (sa.queue || []).filter((q) => q.status === 'queued').length;
    const done = execs.filter((e) => e.status === 'Success' || e.status === 'Failed');
    const ok = done.filter((e) => e.status === 'Success').length;
    sa.successRate = done.length ? Math.round((ok / done.length) * 100) : autos.length ? Math.round(autos.reduce((s, a) => s + Number(a.successRate || 0), 0) / autos.length) : 0;
    sa.failedExecutions = execs.filter((e) => e.status === 'Failed').length;
    sa.totalAutomations = autos.length;
    // legacy mirror
    sa.flows = autos.map((a) => ({
      id: a.id,
      name: a.name,
      trigger: a.triggerLabel || a.trigger,
      system: (a.systems || []).join(' · ') || a.system,
      status: a.status === 'active' ? 'active' : a.status === 'paused' ? 'paused' : a.status,
      runs: a.runs || 0,
    }));
    return sa;
  };

  const seedWorkforce = () => {
    const now = Date.now();
    const isoAgo = (h) => new Date(now - h * 3600000).toISOString();
    const first = ['أحمد', 'محمد', 'سارة', 'نور', 'ليلى', 'يوسف', 'فاطمة', 'خالد', 'هند', 'عمر', 'ريم', 'سلمان', 'منى', 'فهد', 'دانة', 'طارق', 'لينا', 'ماجد', 'هدى', 'باسل'];
    const last = ['الراشد', 'العتيبي', 'الشمري', 'القحطاني', 'الحربي', 'الدوسري', 'الغامدي', 'الزهراني', 'السبيعي', 'المطيري', 'حسن', 'كريم', 'نادر', 'فهد', 'أحمد'];
    const titles = ['أخصائي تشغيل', 'محلل بيانات', 'مدير مبيعات', 'مهندس تكامل', 'أخصائي حوكمة', 'منسق مهام', 'أخصائي موارد بشرية', 'مطور أنظمة', 'مشرف خدمة', 'محاسب'];
    const depts = ['المبيعات', 'التشغيل', 'التقنية', 'الحوكمة', 'الموارد البشرية', 'المالية', 'التسويق', 'دعم العملاء'];
    const sections = ['العمليات', 'التكامل', 'الجودة', 'التطوير', 'خدمة العملاء', 'التخطيط'];
    const managers = ['سارة العتيبي', 'أحمد الراشد', 'نور فهد', 'ليلى كريم', 'محمد حسن'];
    const workTypes = ['عن بعد', 'بالمكتب', 'هجين'];
    const locations = ['الرياض', 'جدة', 'الدمام', 'عن بعد'];
    const sources = ['HR System', 'Manual', 'Excel Import', 'API', 'Integration'];
    const employees = [];
    for (let i = 1; i <= 237; i++) {
      const name = `${first[i % first.length]} ${last[(i * 3) % last.length]}`;
      const productivity = 55 + ((i * 17) % 45);
      const hours = +(5 + (i % 40) / 10).toFixed(1);
      const score = Math.min(100, Math.round(productivity * 0.7 + hours * 3));
      let status = 'active';
      if (productivity < 65) status = 'critical';
      else if (productivity < 75) status = 'warning';
      if (i % 17 === 0) status = 'leave';
      if (i % 23 === 0) status = 'inactive';
      const workType = workTypes[i % workTypes.length];
      const source = i <= 5 ? 'Manual' : sources[i % sources.length];
      employees.push({
        id: `EMP-2026-${String(i).padStart(5, '0')}`,
        externalId: source === 'HR System' ? `HR-${1000 + i}` : '',
        name,
        email: `emp${i}@naiosh.local`,
        phone: `05${String(10000000 + i).slice(0, 8)}`,
        avatar: '',
        title: titles[i % titles.length],
        role: titles[i % titles.length],
        department: depts[i % depts.length],
        section: sections[i % sections.length],
        manager: managers[i % managers.length],
        joinDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`,
        employmentType: i % 9 === 0 ? 'عقد' : 'دوام كامل',
        workType,
        location: workType === 'عن بعد' ? 'عن بعد' : locations[i % locations.length],
        attendance: status === 'leave' ? 'إجازة' : status === 'inactive' ? 'غير نشط' : i % 5 === 0 ? 'Offline' : 'Online',
        hours,
        productivity,
        score,
        points: Math.floor(score * 4 + (i % 50)),
        status,
        warned: status === 'warning' || status === 'critical',
        source,
        createdBy: source === 'Manual' ? 'سارة العتيبي' : 'مزامنة HR',
        createdAt: isoAgo(800 - i),
        lastSynced: source === 'HR System' || source === 'Integration' ? isoAgo(i % 48) : '',
        lastActivity: isoAgo(i % 72),
        linkedUser: `emp${i}@naiosh.local`,
        systemRole: i % 11 === 0 ? 'manager' : 'employee',
        notes: [],
        documents: [],
        archived: false,
      });
    }
    // keep classic demo names recognizable at top
    employees[0].name = 'سارة أحمد';
    employees[0].title = 'تشغيل';
    employees[0].role = 'تشغيل';
    employees[1].name = 'محمد حسن';
    employees[1].title = 'تكامل';
    employees[1].status = 'warning';
    employees[2].name = 'ليلى كريم';
    employees[2].title = 'حوكمة';
    employees[2].productivity = 95;
    employees[2].score = 93;
    employees[3].name = 'يوسف نادر';
    employees[3].status = 'critical';
    employees[4].name = 'نور فهد';

    const wf = {
      schemaVersion: 3,
      helpDismissed: false,
      employees,
      rewards: [
        {
          id: 'RWD-2026-00001',
          employeeId: employees[2].id,
          employee: 'ليلى كريم',
          type: 'نقاط',
          value: 500,
          points: 500,
          reason: 'أداء متميز أسبوعي',
          source: 'Performance',
          nominatedBy: 'أحمد الراشد',
          grantedBy: 'سارة العتيبي',
          approvedBy: 'الحوكمة',
          approvalDate: isoAgo(20),
          status: 'Approved',
          at: isoAgo(20),
          createdBy: 'أحمد الراشد',
        },
        {
          id: 'RWD-2026-00002',
          employeeId: employees[0].id,
          employee: 'سارة أحمد',
          type: 'شهادة تقدير',
          value: 1,
          points: 0,
          reason: 'إنجاز مشروع التشغيل',
          source: 'Manager',
          nominatedBy: 'أحمد الراشد',
          grantedBy: 'أحمد الراشد',
          approvedBy: '',
          approvalDate: '',
          status: 'Pending Approval',
          at: isoAgo(5),
          createdBy: 'أحمد الراشد',
        },
      ],
      pointsTx: [
        {
          id: 'PTX-2026-00001',
          employeeId: employees[2].id,
          employee: 'ليلى كريم',
          type: 'earn',
          points: 500,
          reason: 'مكافأة أداء',
          source: 'Reward',
          createdBy: 'سارة العتيبي',
          at: isoAgo(20),
        },
      ],
      connections: [
        {
          id: 'WCON-2026-00001',
          system: 'HR System',
          status: 'Connected',
          lastSync: isoAgo(2),
          nextSync: isoAgo(-22),
          syncedCount: 86,
          errors: 0,
          owner: 'الموارد البشرية',
        },
      ],
      settings: {
        pageSize: 25,
        requireRewardApproval: true,
        performanceWeights: { goals: 40, tasks: 30, attendance: 20, manager: 10 },
        rewardTypes: [
          { id: 'points', name: 'نقاط', enabled: true, requiresApproval: false, maxValue: 5000, canGive: 'Manager', approver: 'HR' },
          { id: 'money', name: 'مالية', enabled: true, requiresApproval: true, maxValue: 10000, canGive: 'Manager', approver: 'HR Manager' },
          { id: 'certificate', name: 'شهادة تقدير', enabled: true, requiresApproval: false, maxValue: 1, canGive: 'Manager', approver: '' },
          { id: 'badge', name: 'Badge', enabled: true, requiresApproval: false, maxValue: 1, canGive: 'Manager', approver: '' },
          { id: 'leave', name: 'يوم إجازة', enabled: true, requiresApproval: true, maxValue: 3, canGive: 'Manager', approver: 'HR' },
          { id: 'gift', name: 'هدية', enabled: true, requiresApproval: true, maxValue: 1, canGive: 'Manager', approver: 'HR' },
        ],
      },
      departments: depts,
      sections,
      titles,
      savedViews: [
        { id: 'all', name: 'كل الموظفين' },
        { id: 'remote', name: 'عن بعد' },
        { id: 'office', name: 'في المكتب' },
        { id: 'leave', name: 'في إجازة' },
        { id: 'high', name: 'أداء مرتفع' },
        { id: 'follow', name: 'يحتاج متابعة' },
        { id: 'new', name: 'موظفون جدد' },
      ],
      auditLog: [
        {
          id: uid('wfaud'),
          user: 'النظام',
          action: 'تهيئة وحدة القوى العاملة',
          employeeId: '',
          employee: '',
          at: isoAgo(900),
          oldValue: '',
          newValue: 'schema v3 · 237 employees',
          source: 'System',
        },
      ],
    };
    const empsAlive = employees.filter((e) => !e.archived);
    wf.totalEmployees = empsAlive.length;
    wf.activeEmployees = empsAlive.filter((e) => e.status === 'active').length;
    wf.remoteEmployees = empsAlive.filter((e) => e.workType === 'عن بعد').length;
    wf.officeEmployees = empsAlive.filter((e) => e.workType === 'بالمكتب').length;
    wf.onLeave = empsAlive.filter((e) => e.status === 'leave').length;
    wf.needsFollowUp = empsAlive.filter((e) => e.status === 'warning' || e.status === 'critical').length;
    wf.rewardsThisMonth = (wf.rewards || []).length;
    return wf;
  };

  const recomputeWorkforceKpis = (wf = get().workforce) => {
    if (!wf) return wf;
    const emps = (wf.employees || []).filter((e) => !e.archived);
    wf.totalEmployees = emps.length;
    wf.activeEmployees = emps.filter((e) => e.status === 'active').length;
    wf.remoteEmployees = emps.filter((e) => e.workType === 'عن بعد').length;
    wf.officeEmployees = emps.filter((e) => e.workType === 'بالمكتب').length;
    wf.onLeave = emps.filter((e) => e.status === 'leave').length;
    wf.needsFollowUp = emps.filter((e) => e.status === 'warning' || e.status === 'critical').length;
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    wf.rewardsThisMonth = (wf.rewards || []).filter((r) => {
      const d = new Date(r.at || 0);
      return d.getMonth() === month && d.getFullYear() === year && r.status !== 'Rejected';
    }).length;
    return wf;
  };

  const defaultSettings = () => ({
    orgNameAr: 'نايوش هوب',
    orgNameEn: 'NAIOSH HUB',
    orgTagline: '360 · Imperial',
    timezone: 'Asia/Riyadh',
    locale: 'ar',
    dateFormat: 'ar-EG',
    compactSidebar: false,
    reduceMotion: false,
    maintenanceMode: false,
    maintenanceMessage: 'المنصة تحت الصيانة — نعود قريبًا.',
    notifyInApp: true,
    notifyEmail: false,
    notifySecurity: true,
    notifyOps: true,
    sessionMinutes: 480,
    requireMfa: false,
    autoLogoutIdle: true,
    autoSyncMinutes: 15,
    defaultGrantPlan: 'standard',
    activityRetainDays: 90,
    maxUploadMb: 150,
    shopDefaultCategory: 'الكل',
    excludeKonzoo: true,
    searchIndexEnabled: true,
    aiAssistantEnabled: true,
    liveFeedEnabled: true,
    allowPublicRegister: true,
    currency: 'USD',
    primaryColor: '#d70000',
    secondaryColor: '#0a0a0a',
    accentColor: '#8a000c',
    bgColor: '#f4f4f5',
    textColor: '#111111',
    surfaceColor: '#ffffff',
    logoMain: '',
    logoLight: '',
    logoDark: '',
    faviconUrl: '',
    loginImage: '',
    dashboardImage: '',
    banners: [],
    updatedAt: null,
  });

  const SETTINGS_BOOL = new Set([
    'compactSidebar',
    'reduceMotion',
    'maintenanceMode',
    'notifyInApp',
    'notifyEmail',
    'notifySecurity',
    'notifyOps',
    'requireMfa',
    'autoLogoutIdle',
    'excludeKonzoo',
    'searchIndexEnabled',
    'aiAssistantEnabled',
    'liveFeedEnabled',
    'allowPublicRegister',
  ]);
  const SETTINGS_NUM = new Set(['sessionMinutes', 'autoSyncMinutes', 'activityRetainDays', 'maxUploadMb']);
  const SETTINGS_JSON = new Set(['banners']);
  const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

  const normalizeBanner = (b = {}) => ({
    id: String(b.id || `bnr-${Date.now().toString(36)}`),
    name: String(b.name || 'بنر'),
    title: String(b.title || ''),
    description: String(b.description || ''),
    buttonText: String(b.buttonText || ''),
    buttonUrl: String(b.buttonUrl || ''),
    imageDataUrl: String(b.imageDataUrl || ''),
    videoUrl: String(b.videoUrl || ''),
    location: String(b.location || 'homepage'),
    startDate: String(b.startDate || ''),
    endDate: String(b.endDate || ''),
    order: Number.isFinite(Number(b.order)) ? Number(b.order) : 1,
    enabled: b.enabled !== false && b.enabled !== 'false' && b.enabled !== 0,
  });

  const coerceSettings = (raw = {}) => {
    const d = defaultSettings();
    const out = { ...d };
    Object.keys(d).forEach((key) => {
      if (key === 'updatedAt') return;
      if (!(key in raw) || raw[key] === undefined || raw[key] === null) return;
      if (SETTINGS_BOOL.has(key)) {
        out[key] = raw[key] === true || raw[key] === 'true' || raw[key] === 'on' || raw[key] === 1 || raw[key] === '1';
      } else if (SETTINGS_NUM.has(key)) {
        const n = Number(raw[key]);
        out[key] = Number.isFinite(n) ? n : d[key];
      } else if (SETTINGS_JSON.has(key)) {
        let list = raw[key];
        if (typeof list === 'string') {
          try {
            list = JSON.parse(list || '[]');
          } catch (_) {
            list = [];
          }
        }
        out[key] = Array.isArray(list) ? list.map(normalizeBanner) : [];
      } else {
        out[key] = String(raw[key]);
      }
    });
    out.excludeKonzoo = true;
    out.maxUploadMb = Math.max(1, Math.min(150, out.maxUploadMb || 150));
    out.sessionMinutes = Math.max(5, Math.min(24 * 60, out.sessionMinutes || 480));
    out.autoSyncMinutes = Math.max(0, Math.min(24 * 60, out.autoSyncMinutes || 0));
    out.activityRetainDays = Math.max(7, Math.min(3650, out.activityRetainDays || 90));
    if (!out.timezone) out.timezone = d.timezone;
    if (!out.dateFormat) out.dateFormat = d.dateFormat;
    if (!out.shopDefaultCategory) out.shopDefaultCategory = 'الكل';
    ['primaryColor', 'secondaryColor', 'accentColor', 'bgColor', 'textColor', 'surfaceColor'].forEach((k) => {
      if (!HEX_RE.test(out[k] || '')) out[k] = d[k];
    });
    if (!Array.isArray(out.banners)) out.banners = [];
    out.updatedAt = raw.updatedAt || null;
    return out;
  };

  const hydrateSettings = () => {
    if (!state) return false;
    const next = coerceSettings(state.settings || {});
    try {
      if (JSON.stringify(state.settings || {}) === JSON.stringify(next)) return false;
    } catch (_) {}
    state.settings = next;
    return true;
  };

  const seed = () => ({
      meta: {
      version: 6,
      updatedAt: nowIso(),
      phase: 1,
      productType: 'central_digital_hub',
      blueprint: 'empire-v1',
    },
    settings: defaultSettings(),
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
    governance: typeof window !== 'undefined' && window.HubGovernanceData?.seed ? window.HubGovernanceData.seed() : {
      schemaVersion: 1,
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
    workforce: seedWorkforce(),
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
    if (!state.infoSecurity || state.infoSecurity.schemaVersion !== 2) {
      state.infoSecurity = seedInfoSecurity();
      recomputeInfoSecurityKpis(state.infoSecurity);
      changed = true;
    } else {
      recomputeInfoSecurityKpis(state.infoSecurity);
    }
    if (!state.dataGovernance || state.dataGovernance.schemaVersion !== 2) {
      state.dataGovernance = seedDataGovernance();
      recomputeDataGovernanceKpis(state.dataGovernance);
      changed = true;
    } else {
      recomputeDataGovernanceKpis(state.dataGovernance);
    }
    if (!state.systemsAutomation || state.systemsAutomation.schemaVersion !== 2) {
      state.systemsAutomation = seedSystemsAutomation();
      recomputeAutomationKpis(state.systemsAutomation);
      changed = true;
    } else {
      recomputeAutomationKpis(state.systemsAutomation);
    }
    if (!state.workforce || state.workforce.schemaVersion !== 3) {
      state.workforce = seedWorkforce();
      recomputeWorkforceKpis(state.workforce);
      changed = true;
    } else {
      recomputeWorkforceKpis(state.workforce);
    }
    if (hydrateSystemsMarketplace()) changed = true;
    if (!state.governance || state.governance.schemaVersion !== 2) {
      if (window.HubGovernanceData?.seed) {
        state.governance = window.HubGovernanceData.seed();
        changed = true;
      }
    } else if (window.HubGovernanceData?.recompute) {
      window.HubGovernanceData.recompute(state.governance);
    }
    if (!Array.isArray(state.notifications)) {
      state.notifications = [];
      changed = true;
    }
    if (hydrateTasksDetails()) changed = true;
    if (hydrateOpsCommandDomains()) changed = true;
    if (hydrateCoreIntelligence()) changed = true;
    if (hydrateClientsBatchDomains()) changed = true;
    return changed;
  };

  /** Batch B — customers & permissions workspace enrichment */
  const seedClientsMgmt = () => {
    const stamp = nowIso();
    return {
      schemaVersion: 2,
      clients: [
        {
          id: uid('cli'),
          clientId: 'CL-1001',
          name: 'مؤسسة الأفق',
          email: 'ops@alofoq.example',
          status: 'active',
          company: 'مؤسسة الأفق',
          country: 'السعودية',
          accountLevel: 'standard',
          systems: [{ code: 'ERP', name: 'ERP', plan: 'standard', status: 'active' }],
          orders: [{ number: 'ORD-21', service: 'اشتراك سنوي', status: 'open' }],
          subscriptions: [{ systemName: 'ERP', plan: 'standard', status: 'active' }],
          invoices: [{ number: 'INV-9', amount: 1200, status: 'paid' }],
          wallet: { paid: 800, free: 200, total: 1000, ledger: [{ note: 'شحن افتتاحي', type: '+', amount: 1000 }] },
          tickets: [{ subject: 'طلب تفعيل مستخدم', status: 'open' }],
          internalNotes: [{ by: 'غرفة العمليات', note: 'عميل استراتيجي — متابعة أسبوعية', at: stamp }],
          systemsCount: 1,
          openOrders: 1,
          walletTotal: 1000,
          lastLoginAt: stamp,
          source: 'System Generated',
          createdAt: stamp,
          updatedAt: stamp,
        },
        {
          id: uid('cli'),
          clientId: 'CL-1002',
          name: 'مجموعة النور',
          email: 'admin@alnoor.example',
          status: 'pending',
          company: 'مجموعة النور',
          country: 'الإمارات',
          accountLevel: 'trial',
          systems: [],
          orders: [{ number: 'ORD-44', service: 'تجربة Academy', status: 'pending' }],
          subscriptions: [],
          invoices: [],
          wallet: { paid: 0, free: 50, total: 50, ledger: [] },
          tickets: [],
          internalNotes: [],
          systemsCount: 0,
          openOrders: 1,
          walletTotal: 50,
          lastLoginAt: '',
          source: 'إدخال يدوي',
          createdAt: stamp,
          updatedAt: stamp,
        },
        {
          id: uid('cli'),
          clientId: 'CL-1003',
          name: 'شركة المدى',
          email: 'contact@almad.example',
          status: 'suspended',
          company: 'شركة المدى',
          country: 'السعودية',
          accountLevel: 'standard',
          systems: [{ code: 'POSHA', name: 'بوشا', plan: 'basic', status: 'paused' }],
          orders: [],
          subscriptions: [{ systemName: 'POSHA', plan: 'basic', status: 'paused' }],
          invoices: [{ number: 'INV-3', amount: 400, status: 'overdue' }],
          wallet: { paid: 100, free: 0, total: 100, ledger: [] },
          tickets: [{ subject: 'تعليق حساب', status: 'open' }],
          internalNotes: [{ by: 'الامتثال', note: 'موقوف حتى تسوية الفاتورة', at: stamp }],
          systemsCount: 1,
          openOrders: 0,
          walletTotal: 100,
          lastLoginAt: stamp,
          source: 'Integration',
          createdAt: stamp,
          updatedAt: stamp,
        },
      ],
      auditLog: [],
      settings: { helpDismissed: false },
    };
  };

  const seedRolesHub = () => {
    const stamp = nowIso();
    const mk = (code, nameAr, level, systems, permissions) => ({
      id: uid('role'),
      code,
      nameAr,
      level,
      systems,
      permissions,
      status: 'active',
      source: 'System Generated',
      createdAt: stamp,
      updatedAt: stamp,
    });
    return {
      schemaVersion: 2,
      roles: [
        mk('supreme_leader', 'القائد الأعلى', 'admin', ['HUB', 'ERP', 'POSHA', 'ACADEMY', 'FIT'], ['read', 'write', 'admin']),
        mk('admin', 'مشرف هوب', 'admin', ['HUB', 'ERP', 'POSHA', 'ACADEMY'], ['read', 'write', 'admin']),
        mk('manager', 'مدير تشغيل', 'manager', ['HUB', 'ERP', 'POSHA'], ['read', 'write']),
        mk('auditor', 'مدقق', 'auditor', ['HUB', 'ERP'], ['read', 'audit']),
        mk('employee', 'موظف', 'employee', ['HUB'], ['read']),
        mk('customer', 'عميل منصة', 'customer', ['POSHA', 'ACADEMY'], ['read']),
      ],
      assignments: [
        {
          id: uid('ras'),
          userEmail: 'leader@naiosh.example',
          userName: 'القائد الأعلى',
          roleCode: 'supreme_leader',
          source: 'Manual',
          at: stamp,
        },
        {
          id: uid('ras'),
          userEmail: 'ops@alofoq.example',
          userName: 'مؤسسة الأفق',
          roleCode: 'customer',
          source: 'Operating',
          at: stamp,
        },
      ],
      auditLog: [],
      settings: { helpDismissed: false },
    };
  };

  const hydrateClientsBatchDomains = () => {
    if (!state) return false;
    let changed = false;
    if (!state.clientsMgmt || state.clientsMgmt.schemaVersion !== 2) {
      state.clientsMgmt = seedClientsMgmt();
      changed = true;
    } else {
      if (!Array.isArray(state.clientsMgmt.auditLog)) {
        state.clientsMgmt.auditLog = [];
        changed = true;
      }
      if (!state.clientsMgmt.settings) {
        state.clientsMgmt.settings = { helpDismissed: false };
        changed = true;
      }
    }
    if (!state.rolesHub || state.rolesHub.schemaVersion !== 2) {
      state.rolesHub = seedRolesHub();
      changed = true;
    } else {
      if (!Array.isArray(state.rolesHub.auditLog)) {
        state.rolesHub.auditLog = [];
        changed = true;
      }
      if (!Array.isArray(state.rolesHub.assignments)) {
        state.rolesHub.assignments = [];
        changed = true;
      }
    }
    if (!Array.isArray(state.notificationsMeta)) {
      /* keep notifications array; add meta bag */
    }
    if (!state.notificationsWs || state.notificationsWs.schemaVersion !== 2) {
      state.notificationsWs = {
        schemaVersion: 2,
        auditLog: Array.isArray(state.notificationsWs?.auditLog) ? state.notificationsWs.auditLog : [],
        settings: state.notificationsWs?.settings || { helpDismissed: false },
      };
      changed = true;
    }
    if (!state.sideProjectsWs || state.sideProjectsWs.schemaVersion !== 2) {
      state.sideProjectsWs = {
        schemaVersion: 2,
        auditLog: [],
        settings: { helpDismissed: false },
      };
      changed = true;
    }
    if (!state.rentAdminWs || state.rentAdminWs.schemaVersion !== 2) {
      state.rentAdminWs = {
        schemaVersion: 2,
        auditLog: [],
        settings: { helpDismissed: false },
      };
      changed = true;
    }
    if (!state.poshaClientsWs || state.poshaClientsWs.schemaVersion !== 2) {
      state.poshaClientsWs = {
        schemaVersion: 2,
        auditLog: [],
        settings: { helpDismissed: false },
      };
      changed = true;
    }
    return changed;
  };

  /** Batch A — leadership & ops workspace enrichment (schema v2) */
  const hydrateOpsCommandDomains = () => {
    if (!state) return false;
    let changed = false;
    const stamp = nowIso();

    if (!state.tasks) state.tasks = { items: [], bottlenecks: [] };
    if (state.tasks.schemaVersion !== 2) {
      state.tasks.schemaVersion = 2;
      if (!Array.isArray(state.tasks.auditLog)) state.tasks.auditLog = [];
      state.tasks.settings = state.tasks.settings || {
        defaultPriority: 'متوسط',
        helpDismissed: false,
        pageSize: 10,
      };
      (state.tasks.items || []).forEach((t) => {
        if (!t.source) t.source = 'إدخال يدوي';
        if (!t.createdAt) t.createdAt = stamp;
        if (!t.updatedAt) t.updatedAt = t.createdAt;
        if (!t.createdBy) t.createdBy = 'نظام';
      });
      if (!Array.isArray(state.tasks.bottlenecks)) state.tasks.bottlenecks = [];
      changed = true;
    }

    if (!state.measurement) state.measurement = { scores: [], matrix: [], clientImpact: [] };
    if (state.measurement.schemaVersion !== 2) {
      state.measurement.schemaVersion = 2;
      if (!Array.isArray(state.measurement.auditLog)) state.measurement.auditLog = [];
      state.measurement.settings = state.measurement.settings || { helpDismissed: false };
      if (!Array.isArray(state.measurement.indicators) || !state.measurement.indicators.length) {
        state.measurement.indicators = [
          {
            id: uid('mi'),
            name: 'إنجاز المهام',
            formula: 'done_tasks / total_tasks * 100',
            source: 'Tasks Module',
            value: 0,
            owner: 'غرفة العمليات',
            status: 'active',
            updatedAt: stamp,
          },
          {
            id: uid('mi'),
            name: 'صحة الأنظمة',
            formula: 'avg(systems.health)',
            source: 'Systems Registry',
            value: 0,
            owner: 'التكامل',
            status: 'active',
            updatedAt: stamp,
          },
          {
            id: uid('mi'),
            name: 'امتثال الحوكمة',
            formula: 'avg(governance.compliance.rate)',
            source: 'Governance 360',
            value: 0,
            owner: 'الحوكمة',
            status: 'active',
            updatedAt: stamp,
          },
        ];
      }
      changed = true;
    }

    if (!state.reports) state.reports = { generated: [], schedule: [] };
    if (state.reports.schemaVersion !== 2) {
      state.reports.schemaVersion = 2;
      if (!Array.isArray(state.reports.auditLog)) state.reports.auditLog = [];
      state.reports.settings = state.reports.settings || { helpDismissed: false, retainDays: 90 };
      (state.reports.generated || []).forEach((r) => {
        if (!r.source) r.source = 'System Generated';
        if (!r.createdBy) r.createdBy = 'نظام التقارير';
      });
      changed = true;
    }

    if (!state.integration) {
      state.integration = { gateway: { status: 'online', rps: 0, latencyMs: 0, errors: 0 }, connectors: [], apis: [] };
    }
    if (state.integration.schemaVersion !== 2) {
      state.integration.schemaVersion = 2;
      if (!Array.isArray(state.integration.auditLog)) state.integration.auditLog = [];
      if (!Array.isArray(state.integration.syncLog)) {
        state.integration.syncLog = [
          {
            id: uid('sl'),
            connector: 'Internal Systems',
            status: 'success',
            detail: 'مزامنة دورية ناجحة',
            at: stamp,
            source: 'Scheduler',
          },
        ];
      }
      state.integration.settings = state.integration.settings || { helpDismissed: false, autoPing: true };
      (state.integration.connectors || []).forEach((c) => {
        if (!c.source) c.source = 'System';
        if (!c.lastSyncAt) c.lastSyncAt = stamp;
        if (c.direction == null) c.direction = 'ثنائي';
      });
      changed = true;
    }

    if (!state.core) state.core = { decisions: [], predictions: [], optimizations: [], anomalies: [], knowledgeGraph: [], engineHealth: {} };
    if (state.core.schemaVersion !== 2) {
      state.core.schemaVersion = 2;
      if (!Array.isArray(state.core.auditLog)) state.core.auditLog = [];
      state.core.settings = state.core.settings || { helpDismissed: false };
      if (!Array.isArray(state.core.insights) || !state.core.insights.length) {
        state.core.insights = [
          {
            id: uid('ins'),
            title: 'ضغط على طبقة المهام',
            rationale: 'نسبة المهام المختنقة أعلى من المتوسط الأسبوعي مع تنبؤ احتمال 72%.',
            source: 'Predictive + Tasks',
            confidence: 78,
            status: 'open',
            at: stamp,
          },
          {
            id: uid('ins'),
            title: 'فرصة تحسين Academy',
            rationale: 'اقتراح التحسين النشط يقدّر خفض زمن المسار بنسبة ملموسة.',
            source: 'Optimization Engine',
            confidence: 71,
            status: 'open',
            at: stamp,
          },
        ];
      }
      (state.core.decisions || []).forEach((d) => {
        if (!d.source) d.source = 'محرك القرار';
        if (!d.rationale) d.rationale = 'مبني على مؤشرات القياس والمهام والتنبؤات النشطة';
      });
      changed = true;
    }

    if (!state.empire) state.empire = {};
    if (!state.empire.command) state.empire.command = {};
    if (!state.empire.command.ws || state.empire.command.ws.schemaVersion !== 2) {
      state.empire.command.ws = {
        schemaVersion: 2,
        auditLog: Array.isArray(state.empire.command.ws?.auditLog) ? state.empire.command.ws.auditLog : [],
        settings: state.empire.command.ws?.settings || { helpDismissed: false },
      };
      changed = true;
    }

    const op = state.empire?.operating;
    if (op && op.schemaVersion !== 2) {
      op.schemaVersion = 2;
      if (!Array.isArray(op.auditLog)) op.auditLog = [];
      op.settings = op.settings || { helpDismissed: false };
      changed = true;
    }

    return changed;
  };

  const hydrateCoreIntelligence = () => {
    const core = get().core || (get().core = {});
    let changed = false;
    const stamp = nowIso();
    const mapStatus = (st) => {
      const x = String(st || '').toLowerCase();
      if (x === 'draft') return 'Draft';
      if (x === 'pending review' || x === 'pending_review') return 'Pending Review';
      if (x === 'pending' || x === 'pending approval' || x === 'pending_approval') return 'Pending Approval';
      if (x === 'approved') return 'Approved';
      if (x === 'executed' || x === 'done') return 'Executed';
      if (x === 'rejected') return 'Rejected';
      if (x === 'archived') return 'Archived';
      return st || 'Draft';
    };
    const enrichDecision = (d) => {
      const title = d.title || 'قرار';
      const presets = {
        'إعادة توزيع مهام الاختناق': {
          decisionId: 'DEC-2026-00001',
          type: 'Operational',
          sourceType: 'AI Analysis',
          engine: 'AI Decision',
          createdBy: 'Central Intelligence Engine',
          approvedBy: 'القائد الأعلى',
          owner: 'غرفة العمليات',
          reviewer: 'مدير العمليات',
          confidence: 91,
          status: 'Executed',
          category: 'Workforce',
          priority: 'عالي',
          description: 'إعادة توزيع المهام المختنقة لتقليل التأخير ورفع إنتاجية الفريق.',
          reason: 'انخفاض إنتاجية الفريق مع ارتفاع المهام المتأخرة وعبء غير متوازن.',
          reasoning: [
            'انخفاض إنتاجية الفريق 18%.',
            'زيادة المهام المتأخرة 27%.',
            '4 موظفين لديهم عبء أعلى من المتوسط.',
            'النظام يتوقع استمرار الانخفاض خلال 7 أيام.',
          ],
          recommendation: 'إعادة توزيع المهام بين أعضاء الفريق.',
          sourceModules: ['القوى العاملة', 'المهام', 'القياس'],
          dataUsed: 'آخر 30 يوم',
          model: 'Decision Model v2',
          evidence: [
            { source: 'Tasks', metric: 'Overdue Tasks', value: '42', period: 'Last 30 Days', updatedAt: stamp },
            { source: 'Workforce', metric: 'Utilization', value: '88%', period: 'Current', updatedAt: stamp },
            { source: 'Measurement', metric: 'Team Productivity', value: '-18%', period: 'Last 14 Days', updatedAt: stamp },
          ],
          preview: { tasks: 18, users: 5, impactText: 'خفض التأخير 20%', affectedUsers: 5 },
          expectedOutcome: 'خفض التأخير 20%',
          actualOutcome: 'خفض التأخير 17%',
          impactResult: 'Effective',
          history: [
            { at: stamp, action: 'created', by: 'Central Intelligence Engine', detail: 'توليد من تحليل المهام' },
            { at: stamp, action: 'approved', by: 'القائد الأعلى', detail: 'اعتماد' },
            { at: stamp, action: 'executed', by: 'غرفة العمليات', detail: 'تنفيذ EXEC-2026-00001' },
          ],
        },
        'تعليق تكامل POSHA مؤقتًا': {
          decisionId: 'DEC-2026-00002',
          type: 'Risk',
          sourceType: 'Anomaly',
          engine: 'Anomaly',
          createdBy: 'Anomaly Engine',
          approvedBy: '',
          owner: 'التكامل',
          reviewer: 'أمن المعلومات',
          confidence: 84,
          status: 'Pending Approval',
          category: 'Integration',
          priority: 'متوسط',
          description: 'تعليق مؤقت لتكامل POSHA بسبب شذوذ في الطلبات حتى اكتمال التحقيق.',
          reason: 'قفزات غير طبيعية في طلبات POSHA مع مؤشر شذوذ مرتفع.',
          reasoning: [
            'ارتفاع معدل الطلبات الشاذة في POSHA.',
            'صحة الموصل متدهورة.',
            'مخاطر على بيانات العملاء إذا استمر التكامل بدون فلترة.',
          ],
          recommendation: 'تعليق المزامنة مؤقتًا وفتح تحقيق أمني.',
          sourceModules: ['التكامل', 'أمن المعلومات', 'عملاء بوشا'],
          dataUsed: 'آخر 7 أيام',
          model: 'Anomaly Detector v1',
          evidence: [
            { source: 'POSHA', metric: 'Spike Rate', value: '3.4x', period: 'Last 7 Days', updatedAt: stamp },
            { source: 'Integration', metric: 'Connector Health', value: '88%', period: 'Current', updatedAt: stamp },
          ],
          preview: { tasks: 0, users: 2, impactText: 'إيقاف مزامنة POSHA مؤقتًا', affectedUsers: 2 },
          expectedOutcome: 'احتواء المخاطر خلال 24 ساعة',
          actualOutcome: '',
          impactResult: '',
          history: [
            { at: stamp, action: 'created', by: 'Anomaly Engine', detail: 'من شذوذ POSHA' },
            { at: stamp, action: 'submitted', by: 'التكامل', detail: 'إرسال للاعتماد' },
          ],
        },
        'رفع أولوية مشروع Academy': {
          decisionId: 'DEC-2026-00003',
          type: 'Growth',
          sourceType: 'Recommendation',
          engine: 'Optimization',
          createdBy: 'Optimization Engine',
          approvedBy: 'مدير المنصات',
          owner: 'Academy',
          reviewer: 'مدير المنصات',
          confidence: 87,
          status: 'Executed',
          category: 'Projects',
          priority: 'عالي',
          description: 'رفع أولوية مشروع Academy لتسريع مسار الإطلاق وتقليل زمن الدورة.',
          reason: 'فرصة تحسين واضحة في مسار Academy مع عائد إنتاجية متوقع.',
          reasoning: [
            'اقتراح التحسين يقدّر خفض زمن المسار.',
            'مؤشرات Academy أعلى من المتوسط في الجاهزية.',
            'تأخير الإطلاق يؤثر على الإيرادات المتوقعة.',
          ],
          recommendation: 'رفع أولوية المشروع وتخصيص موارد إضافية لأسبوعين.',
          sourceModules: ['الأنظمة', 'القياس', 'المهام'],
          dataUsed: 'آخر 14 يوم',
          model: 'Optimization Engine v1',
          evidence: [
            { source: 'Academy', metric: 'Cycle Time', value: '12 يوم', period: 'Last 14 Days', updatedAt: stamp },
            { source: 'Measurement', metric: 'Readiness', value: '81%', period: 'Current', updatedAt: stamp },
          ],
          preview: { tasks: 6, users: 3, impactText: 'تسريع الإطلاق أسبوعًا', affectedUsers: 3 },
          expectedOutcome: 'خفض زمن المسار 15%',
          actualOutcome: 'خفض زمن المسار 14%',
          impactResult: 'Effective',
          history: [
            { at: stamp, action: 'created', by: 'Optimization Engine', detail: 'من توصية تحسين' },
            { at: stamp, action: 'approved', by: 'مدير المنصات', detail: 'اعتماد' },
            { at: stamp, action: 'executed', by: 'Academy', detail: 'تنفيذ EXEC-2026-00002' },
          ],
        },
      };
      const p = presets[title] || {};
      const status = p.status || mapStatus(d.status);
      return Object.assign({}, d, {
        decisionId: d.decisionId || p.decisionId || nextSecSeq(core.decisions || [], 'DEC'),
        title,
        description: d.description || p.description || '',
        type: d.type || p.type || 'Operational',
        category: d.category || p.category || 'General',
        priority: d.priority || p.priority || d.impact || 'متوسط',
        sourceType: d.sourceType || p.sourceType || (String(d.engine || '').includes('AI') ? 'AI Analysis' : 'يدوي'),
        source: d.source || p.engine || d.engine || 'محرك القرار',
        engine: d.engine || p.engine || 'AI Decision',
        impact: d.impact || p.priority || 'متوسط',
        confidence: d.confidence != null ? d.confidence : p.confidence != null ? p.confidence : 75,
        createdBy: d.createdBy || p.createdBy || d.by || 'مشغّل هوب',
        approvedBy: d.approvedBy != null ? d.approvedBy : p.approvedBy || '',
        owner: d.owner || p.owner || 'غرفة العمليات',
        reviewer: d.reviewer || p.reviewer || '',
        approver: d.approver || p.approvedBy || '',
        status,
        createdAt: d.createdAt || d.at || stamp,
        updatedAt: d.updatedAt || stamp,
        reason: d.reason || d.rationale || p.reason || '',
        rationale: d.rationale || p.reason || '',
        reasoning: Array.isArray(d.reasoning) ? d.reasoning : p.reasoning || [],
        recommendation: d.recommendation || p.recommendation || '',
        sourceModules: d.sourceModules || p.sourceModules || ['المهام', 'القياس'],
        dataUsed: d.dataUsed || p.dataUsed || 'آخر 30 يوم',
        model: d.model || p.model || 'Decision Model v2',
        evidence: Array.isArray(d.evidence) ? d.evidence : p.evidence || [],
        preview: d.preview || p.preview || { tasks: 0, users: 0, impactText: '—', affectedUsers: 0 },
        expectedOutcome: d.expectedOutcome || p.expectedOutcome || '',
        actualOutcome: d.actualOutcome || p.actualOutcome || '',
        impactResult: d.impactResult || p.impactResult || '',
        feedback: d.feedback || null,
        history: Array.isArray(d.history) && d.history.length ? d.history : p.history || [{ at: stamp, action: 'created', by: d.by || 'نظام', detail: 'استيراد' }],
        sensitive: d.sensitive != null ? d.sensitive : status === 'Pending Approval',
      });
    };

    if (core.schemaVersion !== 3) {
      core.schemaVersion = 3;
      if (!Array.isArray(core.auditLog)) core.auditLog = [];
      core.settings = Object.assign(
        {
          helpDismissed: false,
          pageSize: 25,
          confidenceThreshold: 70,
          requireApprovalForSensitive: true,
          retentionDays: 365,
          role: 'admin',
        },
        core.settings || {}
      );

      core.decisions = (core.decisions || []).map(enrichDecision);

      if (!Array.isArray(core.recommendations) || !core.recommendations.length) {
        core.recommendations = [
          {
            id: nextSecSeq([], 'REC'),
            title: 'إعادة توزيع عبء فريق العمليات',
            source: 'Insight · ضغط المهام',
            reason: 'ارتفاع التأخير وعبء غير متوازن',
            impact: 'عالي',
            confidence: 89,
            suggestedAction: 'تحويل إلى قرار إعادة توزيع المهام',
            owner: 'غرفة العمليات',
            status: 'Converted',
            linkedDecisionId: (core.decisions.find((x) => x.title.includes('إعادة توزيع')) || {}).id || '',
            at: stamp,
          },
          {
            id: uid('rec'),
            title: 'مراجعة موصل POSHA',
            source: 'Anomaly Engine',
            reason: 'قفزات طلبات غير طبيعية',
            impact: 'متوسط',
            confidence: 82,
            suggestedAction: 'تعليق التكامل مؤقتًا',
            owner: 'التكامل',
            status: 'New',
            at: stamp,
          },
          {
            id: uid('rec'),
            title: 'تسريع مسار Academy',
            source: 'Optimization',
            reason: 'فرصة خفض زمن الدورة',
            impact: 'عالي',
            confidence: 80,
            suggestedAction: 'رفع أولوية المشروع',
            owner: 'Academy',
            status: 'Reviewed',
            at: stamp,
          },
        ];
      }

      if (!Array.isArray(core.insights)) core.insights = [];
      core.insights = (core.insights || []).map((ins) =>
        Object.assign(
          {
            insightId: ins.insightId || nextSecSeq(core.insights, 'INS'),
            category: ins.category || 'Operations',
            summary: ins.summary || ins.rationale || '',
            severity: ins.severity || (ins.confidence > 75 ? 'عالي' : 'متوسط'),
            generatedAt: ins.generatedAt || ins.at || stamp,
            status: ins.status === 'closed' ? 'Closed' : ins.status === 'open' ? 'New' : ins.status || 'New',
          },
          ins
        )
      );
      if (!core.insights.some((x) => String(x.title || '').includes('التأخير'))) {
        core.insights.unshift({
          id: uid('ins'),
          insightId: nextSecSeq(core.insights, 'INS'),
          title: 'ارتفاع معدل التأخير في فريق العمليات بنسبة 22%',
          category: 'Operations',
          source: 'Tasks + Measurement',
          summary: 'التأخير تجاوز العتبة الأسبوعية مع تركيز في وردية المساء.',
          rationale: 'التأخير تجاوز العتبة الأسبوعية مع تركيز في وردية المساء.',
          severity: 'عالي',
          confidence: 86,
          generatedAt: stamp,
          at: stamp,
          status: 'New',
        });
      }

      core.predictions = (core.predictions || []).map((p) =>
        Object.assign(
          {
            predictionId: p.predictionId || nextSecSeq(core.predictions, 'PRD'),
            title: p.title || p.risk || 'تنبؤ',
            target: p.target || 'الإنتاجية',
            predictedValue: p.predictedValue != null ? p.predictedValue : p.probability,
            confidence: p.confidence != null ? p.confidence : Math.min(95, (p.probability || 70) + 10),
            period: p.period || p.eta || '7 أيام',
            source: p.source || 'Predictive Engine',
            model: p.model || 'Forecast v1',
            generatedAt: p.generatedAt || stamp,
            status: p.status || 'Active',
          },
          p
        )
      );

      core.anomalies = (core.anomalies || []).map((a) =>
        Object.assign(
          {
            anomalyId: a.anomalyId || nextSecSeq(core.anomalies, 'ANM'),
            type: a.type || 'Behavioral',
            metric: a.metric || a.signal || 'Signal',
            expected: a.expected || 'Baseline',
            actual: a.actual || String(a.score || ''),
            deviation: a.deviation || (a.score ? `${a.score}%` : '—'),
            severity: a.severity || (a.score >= 80 ? 'حرج' : 'متوسط'),
            detectedAt: a.detectedAt || stamp,
            owner: a.owner || 'أمن المعلومات',
            status: a.status === 'closed' ? 'Closed' : a.status === 'investigating' ? 'Investigating' : 'Open',
          },
          a
        )
      );

      if (!Array.isArray(core.rules) || !core.rules.length) {
        core.rules = [
          {
            id: nextSecSeq([], 'RULE'),
            name: 'تأخير مهام + استغلال مرتفع',
            sourceModule: 'المهام',
            metric: 'Overdue Tasks',
            operator: '>',
            value: 30,
            extraConditions: [{ metric: 'Team Utilization', operator: '>', value: 90 }],
            action: 'Generate Recommendation',
            severity: 'High',
            priority: 'عالي',
            owner: 'العقل المركزي',
            status: 'Active',
            at: stamp,
          },
        ];
      }

      if (!Array.isArray(core.dataSources) || !core.dataSources.length) {
        core.dataSources = [
          { id: nextSecSeq([], 'SRC'), name: 'Workforce', module: 'القوى العاملة', type: 'Internal Module', status: 'Connected', lastSync: stamp, records: 128, owner: 'HR Ops' },
          { id: uid('src'), name: 'Tasks', module: 'المهام', type: 'Internal Module', status: 'Connected', lastSync: stamp, records: 412, owner: 'Ops' },
          { id: uid('src'), name: 'Measurement', module: 'القياس', type: 'Internal Module', status: 'Connected', lastSync: stamp, records: 96, owner: 'Analytics' },
          { id: uid('src'), name: 'Security', module: 'أمن المعلومات', type: 'Internal Module', status: 'Connected', lastSync: stamp, records: 54, owner: 'SecOps' },
          { id: uid('src'), name: 'External ERP', module: 'ERP', type: 'API', status: 'Connected', lastSync: stamp, records: 2200, owner: 'Integration' },
          { id: uid('src'), name: 'POSHA Feed', module: 'عملاء بوشا', type: 'API', status: 'Degraded', lastSync: stamp, records: 880, owner: 'POSHA' },
        ];
      }

      if (!Array.isArray(core.executions) || !core.executions.length) {
        const d1 = core.decisions.find((x) => x.title.includes('إعادة توزيع')) || core.decisions[0];
        const d3 = core.decisions.find((x) => x.title.includes('Academy')) || core.decisions[2];
        core.executions = [
          {
            id: nextSecSeq([], 'EXEC'),
            decisionId: d1?.decisionId || d1?.id,
            decisionRef: d1?.id,
            decision: d1?.title || '',
            executedBy: 'غرفة العمليات',
            startedAt: stamp,
            completedAt: stamp,
            affectedRecords: 18,
            status: 'Success',
            result: 'أُعيد توزيع 18 مهمة على 5 موظفين',
            timeline: [
              { ok: true, text: 'القرار تم اعتماده' },
              { ok: true, text: 'تم تحميل البيانات' },
              { ok: true, text: 'تم التحقق من الشروط' },
              { ok: true, text: 'تم تحديث المهام' },
              { ok: true, text: 'تم إرسال الإشعارات' },
              { ok: true, text: 'اكتمل التنفيذ' },
            ],
          },
          {
            id: uid('exec'),
            decisionId: d3?.decisionId || d3?.id,
            decisionRef: d3?.id,
            decision: d3?.title || '',
            executedBy: 'Academy',
            startedAt: stamp,
            completedAt: stamp,
            affectedRecords: 6,
            status: 'Success',
            result: 'رُفعت أولوية 6 مهام مشروع',
            timeline: [
              { ok: true, text: 'القرار تم اعتماده' },
              { ok: true, text: 'تم تحديث أولويات المشروع' },
              { ok: true, text: 'اكتمل التنفيذ' },
            ],
          },
        ];
      }

      if (!Array.isArray(core.approvals)) {
        core.approvals = (core.decisions || [])
          .filter((d) => d.status === 'Pending Approval' || d.status === 'Pending Review')
          .map((d) => ({
            id: nextSecSeq(core.approvals || [], 'APR'),
            decisionRef: d.id,
            decisionId: d.decisionId,
            title: d.title,
            stage: d.status === 'Pending Review' ? 'Review' : 'Approval',
            assignee: d.approver || d.reviewer || 'القائد الأعلى',
            status: 'Waiting',
            direction: 'inbox',
            at: stamp,
          }));
      }

      if (!Array.isArray(core.optimizations)) core.optimizations = [];
      if (!Array.isArray(core.knowledgeGraph)) core.knowledgeGraph = [];
      if (!core.engineHealth) core.engineHealth = { decision: 92, predictive: 88, optimization: 85, anomaly: 90, knowledge: 94 };
      changed = true;
    }
    return changed;
  };


  const pushDomainAudit = (bag, entry = {}) => {
    if (!bag) return null;
    if (!Array.isArray(bag.auditLog)) bag.auditLog = [];
    const row = {
      id: uid('aud'),
      at: nowIso(),
      action: entry.action || 'update',
      detail: entry.detail || '',
      by: entry.by || 'مشغّل هوب',
      source: entry.source || 'Manual',
      entityId: entry.entityId || '',
    };
    bag.auditLog.unshift(row);
    bag.auditLog = bag.auditLog.slice(0, 200);
    return row;
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
        if (hydrateSettings()) save();
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

  const getSettings = () => {
    get();
    if (hydrateSettings()) save();
    return { ...(get().settings || defaultSettings()) };
  };

  const saveSettings = (patch = {}) => {
    const s = get();
    s.settings = coerceSettings({ ...(s.settings || defaultSettings()), ...(patch || {}), updatedAt: nowIso() });
    save();
    recordActivity('settings', 'تحديث الإعدادات الداخلية', { keys: Object.keys(patch || {}) });
    return getSettings();
  };

  const resetSettings = () => {
    const s = get();
    s.settings = { ...defaultSettings(), updatedAt: nowIso() };
    save();
    recordActivity('settings', 'إعادة الإعدادات الداخلية للافتراضي');
    return getSettings();
  };

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
      const retainDays = Number((get().settings || {}).activityRetainDays) || 0;
      if (retainDays > 0) {
        const cutoff = Date.now() - retainDays * 86400000;
        op.activityLog = op.activityLog.filter((a) => !a.at || Date.parse(a.at) >= cutoff);
      }
      if (op.activityLog.length > 200) op.activityLog.length = 200;
    }
    pushFeed(kind === 'auth' ? 'decision' : kind === 'report' ? 'report' : 'decision', text);
    return op?.activityLog?.[0] || null;
  };

  const ensureOperating = () => {
    const s = get();
    if (!s.empire) s.empire = seedEmpire();
    const e = s.empire;
    if (!e.operating) e.operating = seedOperating();
    if (!Array.isArray(e.operating.subscriptions)) e.operating.subscriptions = [];
    if (!Array.isArray(e.operating.offices)) e.operating.offices = [];
    if (!Array.isArray(e.operating.activityLog)) e.operating.activityLog = [];
    if (!Array.isArray(e.operating.auditLog)) e.operating.auditLog = [];
    if (!e.operating.settings) e.operating.settings = { helpDismissed: false };
    if (e.operating.schemaVersion !== 2) e.operating.schemaVersion = 2;
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
      plan: payload.plan || getSettings().defaultGrantPlan || 'standard',
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
    const cfg = s.settings || {};
    if (cfg.notifyInApp === false) return null;
    const level = String(payload.level || 'info');
    const category = String(payload.category || 'system');
    if (cfg.notifySecurity === false && (level === 'critical' || category === 'security')) return null;
    if (cfg.notifyOps === false && category === 'ops') return null;
    if (!Array.isArray(s.notifications)) s.notifications = [];
    const year = new Date().getFullYear();
    const seq = String((s.notifications.length || 0) + 1).padStart(5, '0');
    const code =
      payload.code ||
      payload.notificationCode ||
      `NTF-${year}-${seq}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    const item = {
      id: payload.id || uid('n'),
      code,
      source: (payload.source || 'HUB').toString(),
      sourceName: payload.sourceName || payload.source || 'نايوش هوب',
      section: payload.section || payload.sourceName || payload.source || 'عام',
      title: payload.title || 'إشعار هوب',
      body: payload.body || payload.message || '',
      reason: payload.reason || payload.body || payload.message || '',
      type: payload.type || category || 'system',
      typeLabel: payload.typeLabel || '',
      level: payload.level || 'info',
      category: payload.category || 'system',
      priority: payload.priority || (level === 'critical' || level === 'error' ? 'high' : level === 'warning' ? 'medium' : 'low'),
      link: payload.link || payload.href || '',
      sourceLink: payload.sourceLink || payload.link || '',
      actionLabel: payload.actionLabel || '',
      actionLink: payload.actionLink || payload.link || '',
      needsAction: payload.needsAction === true || !!payload.actionLabel,
      status: payload.status || 'new',
      requestId: payload.requestId || payload.meta?.requestId || null,
      customerId: payload.customerId || payload.meta?.customerId || null,
      customerName: payload.customerName || payload.meta?.customerName || null,
      actorName: payload.actorName || payload.meta?.actorName || null,
      referenceType: payload.referenceType || payload.meta?.referenceType || null,
      referenceId: payload.referenceId || payload.meta?.referenceId || null,
      read: payload.read === true,
      archived: payload.archived === true,
      at: payload.at || nowIso(),
      meta: payload.meta || null,
    };
    s.notifications.unshift(item);
    if (s.notifications.length > 300) s.notifications.length = 300;
    pushFeed('alert', `${item.sourceName}: ${item.title}`);
    save();
    emitNotificationsChanged();
    return item;
  };

  const listNotifications = (opts = {}) => {
    let rows = get().notifications || [];
    if (opts.includeArchived !== true) rows = rows.filter((n) => !n.archived);
    return rows;
  };

  const unreadNotificationsCount = () =>
    (get().notifications || []).filter((n) => !n.read && !n.archived).length;

  const markNotificationRead = (id) => {
    const n = (get().notifications || []).find((x) => x.id === id);
    if (!n) return null;
    n.read = true;
    if (n.status === 'new') n.status = 'read';
    save();
    emitNotificationsChanged();
    return n;
  };

  const markNotificationUnread = (id) => {
    const n = (get().notifications || []).find((x) => x.id === id);
    if (!n) return null;
    n.read = false;
    n.status = 'new';
    save();
    emitNotificationsChanged();
    return n;
  };

  const archiveNotification = (id) => {
    const n = (get().notifications || []).find((x) => x.id === id);
    if (!n) return null;
    n.archived = true;
    n.read = true;
    n.status = 'archived';
    save();
    emitNotificationsChanged();
    return n;
  };

  const markAllNotificationsRead = () => {
    (get().notifications || []).forEach((n) => {
      n.read = true;
      if (n.status === 'new') n.status = 'read';
    });
    save();
    emitNotificationsChanged();
    return listNotifications();
  };

  const migrateOrphanNotifications = () => {
    try {
      const raw = localStorage.getItem('naiosh_hub_notifications_v1');
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [];
      if (!items.length) return 0;
      let added = 0;
      items.forEach((n) => {
        const id = n.id || `orphan-${n.at || Date.now()}`;
        if ((get().notifications || []).some((x) => x.id === id || x.meta?.orphanId === id)) return;
        pushNotification({
          id,
          title: n.title || 'إشعار',
          body: n.body || n.message || '',
          reason: n.message || n.body || '',
          source: n.source || 'منصة',
          sourceName: n.source || 'منصة',
          link: n.link || n.href || 'dashboard.html#notifications',
          level: n.level || 'info',
          category: n.category || 'ops',
          read: !!n.read,
          at: n.at,
          meta: { orphanId: id, migrated: true },
        });
        added += 1;
      });
      localStorage.setItem('naiosh_hub_notifications_v1', JSON.stringify({ items: [], migratedAt: nowIso() }));
      return added;
    } catch (_) {
      return 0;
    }
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
  const issueDecision = (title, engine = 'AI Decision', impact = 'متوسط', extra = {}) => {
    if (typeof upsertCoreDecision === 'function') {
      return upsertCoreDecision(
        {
          title,
          engine,
          impact,
          sourceType: engine === 'AI Decision' ? 'AI Analysis' : engine === 'Anomaly' ? 'Anomaly' : 'يدوي',
          source: extra.source || 'محرك القرار',
          reason: extra.rationale || '',
          status: 'Pending Approval',
          owner: extra.by || 'مشغّل هوب',
        },
        extra.by || 'مشغّل هوب'
      );
    }
    const item = {
      id: uid('d'),
      title,
      engine,
      status: 'Pending Approval',
      impact,
      at: nowIso(),
      source: extra.source || 'محرك القرار',
      rationale: extra.rationale || 'مبني على مؤشرات القياس والمهام والتنبؤات النشطة',
      by: extra.by || 'مشغّل هوب',
    };
    get().core.decisions.unshift(item);
    pushDomainAudit(get().core, {
      action: 'issue_decision',
      detail: title,
      by: item.by,
      source: item.source,
      entityId: item.id,
    });
    pushFeed('decision', title);
    save();
    return item;
  };

  const executeDecision = (id, actor = 'مشغّل هوب') => {
    if (typeof executeCoreDecision === 'function') return executeCoreDecision(id, actor, true);
    const d = get().core.decisions.find((x) => x.id === id);
    if (!d) return null;
    d.status = 'Executed';
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
  const govBag = () => {
    const s = get();
    if (!s.governance || s.governance.schemaVersion !== 2) {
      if (window.HubGovernanceData?.seed) s.governance = window.HubGovernanceData.seed();
      else if (!s.governance) s.governance = { policies: [], schemaVersion: 1 };
    }
    return s.governance;
  };

  const recomputeGovKpis = (g = govBag()) => {
    if (window.HubGovernanceData?.recompute) return window.HubGovernanceData.recompute(g);
    return g;
  };

  const pushGovAudit = (entry = {}) => {
    const g = govBag();
    if (!Array.isArray(g.auditLog)) g.auditLog = [];
    const row = {
      id: entry.id || nextSecSeq(g.auditLog, 'GOV-TX'),
      user: entry.user || 'مشغّل هوب',
      action: entry.action || 'تعديل',
      entityType: entry.entityType || '',
      entityId: entry.entityId || '',
      entityLabel: entry.entityLabel || '',
      field: entry.field || '',
      oldValue: entry.oldValue ?? '',
      newValue: entry.newValue ?? '',
      at: nowIso(),
      source: entry.source || 'Manual',
    };
    g.auditLog.unshift(row);
    if (g.auditLog.length > 800) g.auditLog.length = 800;
    return row;
  };

  const addPolicy = (title, scope, extra = {}, actor = 'مشغّل هوب') => {
    const g = govBag();
    if (!Array.isArray(g.policies)) g.policies = [];
    const item = {
      id: uid('pol'),
      code: extra.code || `POL-${String(g.policies.length + 1).padStart(2, '0')}`,
      title: title || extra.title,
      description: extra.description || '',
      category: extra.category || 'Internal Governance',
      version: extra.version || '1.0',
      owner: extra.owner || actor,
      status: extra.status || 'Draft',
      scope: scope || extra.scope || '',
      effectiveDate: extra.effectiveDate || '',
      reviewDate: extra.reviewDate || '',
      requiresAck: !!extra.requiresAck,
      ackDeadline: extra.ackDeadline || '',
      appliesTo: extra.appliesTo || { type: 'company', ids: [], label: scope || 'كل الشركة' },
      assignments: extra.assignments || [],
      source: extra.source || 'Manual',
      createdBy: actor,
      createdAt: nowIso(),
      lastModifiedBy: actor,
      lastModifiedAt: nowIso(),
      ...pickCommonMeta(extra),
    };
    g.policies.unshift(item);
    pushGovAudit({
      user: actor,
      action: 'Policy Created',
      entityType: 'policy',
      entityId: item.id,
      entityLabel: item.title,
      newValue: item.status,
      source: item.source,
    });
    recomputeGovKpis(g);
    pushFeed('compliance', `مسودة سياسة: ${item.title}`);
    save();
    return item;
  };

  const updateGovPolicy = (id, patch = {}, actor = 'مشغّل هوب') => {
    const g = govBag();
    const p = (g.policies || []).find((x) => x.id === id);
    if (!p) return null;
    Object.keys(patch).forEach((k) => {
      if (patch[k] === undefined || String(patch[k]) === String(p[k])) return;
      pushGovAudit({
        user: actor,
        action: 'Policy Updated',
        entityType: 'policy',
        entityId: p.id,
        entityLabel: p.title,
        field: k,
        oldValue: p[k],
        newValue: patch[k],
      });
    });
    Object.assign(p, patch, { lastModifiedBy: actor, lastModifiedAt: nowIso() });
    recomputeGovKpis(g);
    save();
    return p;
  };

  const activatePolicy = (id, actor = 'مشغّل هوب') => {
    const p = updateGovPolicy(id, { status: 'Active' }, actor);
    if (p) pushFeed('compliance', `تفعيل ${p.code}: ${p.title}`);
    return p;
  };

  const assignPolicyToPeople = (policyId, personIds = [], actor = 'مشغّل هوب') => {
    const g = govBag();
    const p = (g.policies || []).find((x) => x.id === policyId);
    if (!p) return null;
    if (!Array.isArray(p.assignments)) p.assignments = [];
    personIds.forEach((pid) => {
      const person = (g.people || []).find((x) => x.id === pid);
      if (!person) return;
      if (p.assignments.some((a) => a.personId === pid)) return;
      p.assignments.push({
        id: uid('ack'),
        personId: pid,
        person: person.name,
        status: 'Sent',
        sentAt: nowIso(),
        viewedAt: '',
        acknowledgedAt: '',
      });
      if (!Array.isArray(person.policyIds)) person.policyIds = [];
      if (!person.policyIds.includes(p.id)) person.policyIds.push(p.id);
      pushGovAudit({
        user: actor,
        action: 'Assigned Policy',
        entityType: 'person',
        entityId: person.id,
        entityLabel: person.name,
        field: 'policy',
        newValue: p.code || p.title,
      });
    });
    save();
    return p;
  };

  const acknowledgePolicy = (policyId, personId, actor = 'مشغّل هوب') => {
    const g = govBag();
    const p = (g.policies || []).find((x) => x.id === policyId);
    const a = p?.assignments?.find((x) => x.personId === personId);
    if (!a) return null;
    a.status = 'Acknowledged';
    a.acknowledgedAt = nowIso();
    a.viewedAt = a.viewedAt || nowIso();
    pushGovAudit({
      user: actor,
      action: 'Policy Acknowledged',
      entityType: 'policy',
      entityId: policyId,
      entityLabel: p.title,
      field: 'assignment',
      newValue: a.person,
    });
    save();
    return a;
  };

  const addGovPerson = (payload = {}, actor = 'مشغّل هوب') => {
    const g = govBag();
    if (!Array.isArray(g.people)) g.people = [];
    const name = String(payload.name || '').trim();
    if (!name) return null;
    const item = {
      id: payload.id || nextSecSeq(g.people, 'GOV'),
      employeeId: payload.employeeId || '',
      name,
      officeNumber: payload.officeNumber || '',
      phone: payload.phone || '',
      extension: payload.extension || '',
      email: payload.email || '',
      title: payload.title || 'موظف',
      company: payload.company || 'نايوش هوب',
      branchId: payload.branchId || '',
      branch: payload.branch || '',
      departmentId: payload.departmentId || '',
      department: payload.department || '',
      section: payload.section || '',
      team: payload.team || '',
      platformId: payload.platformId || '',
      platform: payload.platform || '',
      manager: payload.manager || '',
      governanceManager: payload.governanceManager || '',
      governanceRole: payload.governanceRole || 'Employee',
      committeeIds: payload.committeeIds || [],
      authorityLevel: payload.authorityLevel || 'L1',
      approvalLimit: Number(payload.approvalLimit) || 0,
      complianceScore: Number(payload.complianceScore) || 0,
      riskLevel: payload.riskLevel || 'Low',
      status: payload.status || 'Active',
      source: payload.source || 'Manual',
      creationMethod: payload.creationMethod || 'Manual',
      createdBy: actor,
      createdAt: nowIso(),
      lastSynced: '',
      lastModifiedBy: actor,
      lastModifiedAt: nowIso(),
      externalId: payload.externalId || '',
      policyIds: [],
      avatar: payload.avatar || '',
    };
    g.people.unshift(item);
    pushGovAudit({
      user: actor,
      action: 'Person Added',
      entityType: 'person',
      entityId: item.id,
      entityLabel: item.name,
      source: item.source,
    });
    recomputeGovKpis(g);
    save();
    return item;
  };

  const updateGovPerson = (id, patch = {}, actor = 'مشغّل هوب') => {
    const g = govBag();
    const p = (g.people || []).find((x) => x.id === id);
    if (!p) return null;
    Object.keys(patch).forEach((k) => {
      if (patch[k] === undefined || String(patch[k]) === String(p[k])) return;
      pushGovAudit({
        user: actor,
        action: 'Person Updated',
        entityType: 'person',
        entityId: p.id,
        entityLabel: p.name,
        field: k,
        oldValue: p[k],
        newValue: patch[k],
      });
    });
    Object.assign(p, patch, { lastModifiedBy: actor, lastModifiedAt: nowIso() });
    recomputeGovKpis(g);
    save();
    return p;
  };

  const addGovBranch = (payload = {}, actor = 'مشغّل هوب') => {
    const g = govBag();
    if (!Array.isArray(g.branches)) g.branches = [];
    const item = {
      id: payload.id || nextSecSeq(g.branches, 'BR'),
      name: payload.name,
      address: payload.address || '',
      phone: payload.phone || '',
      manager: payload.manager || '',
      status: payload.status || 'Active',
      source: 'Manual',
      createdBy: actor,
      createdAt: nowIso(),
    };
    g.branches.unshift(item);
    pushGovAudit({ user: actor, action: 'Branch Added', entityType: 'branch', entityId: item.id, entityLabel: item.name });
    save();
    return item;
  };

  const addGovDepartment = (payload = {}, actor = 'مشغّل هوب') => {
    const g = govBag();
    if (!Array.isArray(g.departments)) g.departments = [];
    const item = {
      id: payload.id || nextSecSeq(g.departments, 'DEP'),
      name: payload.name,
      branchId: payload.branchId || '',
      branch: payload.branch || '',
      manager: payload.manager || '',
      status: 'Active',
      source: 'Manual',
      createdBy: actor,
      createdAt: nowIso(),
    };
    g.departments.unshift(item);
    pushGovAudit({ user: actor, action: 'Department Added', entityType: 'department', entityId: item.id, entityLabel: item.name });
    save();
    return item;
  };

  const addGovPlatform = (payload = {}, actor = 'مشغّل هوب') => {
    const g = govBag();
    if (!Array.isArray(g.platforms)) g.platforms = [];
    const item = {
      id: payload.id || nextSecSeq(g.platforms, 'PLT'),
      name: payload.name,
      owner: payload.owner || actor,
      departmentId: payload.departmentId || '',
      department: payload.department || '',
      branchId: payload.branchId || '',
      branch: payload.branch || '',
      status: 'Active',
      source: 'Manual',
      createdBy: actor,
      createdAt: nowIso(),
    };
    g.platforms.unshift(item);
    pushGovAudit({ user: actor, action: 'Platform Added', entityType: 'platform', entityId: item.id, entityLabel: item.name });
    save();
    return item;
  };

  const addComplianceRequirement = (payload = {}, actor = 'مشغّل هوب') => {
    const g = govBag();
    if (!Array.isArray(g.complianceRequirements)) g.complianceRequirements = [];
    const item = {
      id: payload.id || nextSecSeq(g.complianceRequirements, 'CMP'),
      name: payload.name,
      framework: payload.framework || 'Internal Governance',
      description: payload.description || '',
      appliesTo: payload.appliesTo || { type: 'company', label: 'كل الشركة' },
      owner: payload.owner || actor,
      reviewer: payload.reviewer || '',
      approver: payload.approver || '',
      evidenceRequired: payload.evidenceRequired || 'Document',
      frequency: payload.frequency || 'Yearly',
      measurement: payload.measurement || '',
      target: Number(payload.target) || 100,
      currentScore: Number(payload.currentScore) || 0,
      status: payload.status || 'New',
      evidence: [],
      source: 'Manual',
      createdBy: actor,
      createdAt: nowIso(),
    };
    g.complianceRequirements.unshift(item);
    pushGovAudit({ user: actor, action: 'Compliance Added', entityType: 'compliance', entityId: item.id, entityLabel: item.name });
    recomputeGovKpis(g);
    save();
    return item;
  };

  const addQualityStandard = (payload = {}, actor = 'مشغّل هوب') => {
    const g = govBag();
    if (!Array.isArray(g.standards)) g.standards = [];
    const item = {
      id: payload.id || nextSecSeq(g.standards, 'QS'),
      name: payload.name,
      description: payload.description || '',
      category: payload.category || 'Quality',
      appliesTo: payload.appliesTo || { type: 'company', label: 'الشركة' },
      measurementType: payload.measurementType || 'Percentage',
      target: Number(payload.target) || 100,
      warningThreshold: Number(payload.warningThreshold) || 90,
      criticalThreshold: Number(payload.criticalThreshold) || 80,
      currentValue: Number(payload.currentValue) || 0,
      frequency: payload.frequency || 'Monthly',
      dataSource: payload.dataSource || 'Manual Entry',
      calculation: payload.calculation || '',
      owner: payload.owner || actor,
      reviewer: payload.reviewer || '',
      status: payload.status || 'New',
      history: [],
      source: 'Manual',
      createdBy: actor,
      createdAt: nowIso(),
      level: payload.level || 'A',
    };
    g.standards.unshift(item);
    pushGovAudit({ user: actor, action: 'Quality Standard Added', entityType: 'quality', entityId: item.id, entityLabel: item.name });
    recomputeGovKpis(g);
    save();
    return item;
  };

  const addGovContract = (payload = {}, actor = 'مشغّل هوب') => {
    const g = govBag();
    if (!Array.isArray(g.contracts)) g.contracts = [];
    const item = {
      id: payload.id || nextSecSeq(g.contracts, 'CTR'),
      name: payload.name,
      party1: payload.party1 || 'نايوش هوب',
      party2: payload.party2 || '',
      relatedType: payload.relatedType || 'person',
      relatedId: payload.relatedId || '',
      relatedLabel: payload.relatedLabel || payload.party2 || '',
      type: payload.type || 'Employment',
      value: Number(payload.value) || 0,
      startDate: payload.startDate || nowIso().slice(0, 10),
      endDate: payload.endDate || '',
      owner: payload.owner || actor,
      status: payload.status || (payload.draft ? 'Draft' : 'Pending Approval'),
      renewal: payload.renewal || 'Manual',
      documents: payload.documents || [],
      source: 'Manual',
      createdBy: actor,
      createdAt: nowIso(),
      lastModifiedBy: actor,
      lastModifiedAt: nowIso(),
    };
    g.contracts.unshift(item);
    if (!Array.isArray(g.approvals)) g.approvals = [];
    if (item.status === 'Pending Approval') {
      g.approvals.unshift({
        id: nextSecSeq(g.approvals, 'APR'),
        type: 'Contract',
        relatedEntity: item.name,
        relatedId: item.id,
        requestedBy: actor,
        assignedTo: 'ليلى كريم',
        date: nowIso(),
        deadline: new Date(Date.now() + 3 * 86400000).toISOString(),
        status: 'Pending',
        source: 'Manual',
      });
    }
    pushGovAudit({ user: actor, action: 'Contract Created', entityType: 'contract', entityId: item.id, entityLabel: item.name });
    recomputeGovKpis(g);
    save();
    return item;
  };

  const issuePenaltyOrReward = (type, target, reason, points, extras = {}, actor = 'مشغّل هوب') => {
    const g = govBag();
    if (!Array.isArray(g.rewards)) g.rewards = [];
    if (!Array.isArray(g.penaltiesRewards)) g.penaltiesRewards = [];
    const item = {
      id: uid('pr'),
      beneficiaryId: extras.beneficiaryId || '',
      beneficiary: target,
      target,
      type: type === 'penalty' ? 'عقوبة' : extras.rewardType || 'نقاط',
      value: Math.abs(Number(points) || 0),
      points: Number(points),
      reason,
      source: extras.source || 'Manual',
      requestedBy: extras.requestedBy || actor,
      approvedBy: extras.approvedBy || '',
      grantedBy: extras.grantedBy || '',
      status: extras.status || (g.settings?.requireRewardApproval && type === 'reward' ? 'Pending' : 'Approved'),
      at: nowIso(),
      createdBy: actor,
      createdAt: nowIso(),
    };
    if (item.status === 'Approved' && type === 'reward') {
      item.approvedBy = item.approvedBy || actor;
      item.grantedBy = item.grantedBy || actor;
    }
    g.rewards.unshift(item);
    g.penaltiesRewards.unshift({
      id: item.id,
      type,
      target,
      reason,
      points: Number(points),
      at: item.at,
    });
    if (item.status === 'Pending') {
      if (!Array.isArray(g.approvals)) g.approvals = [];
      g.approvals.unshift({
        id: nextSecSeq(g.approvals, 'APR'),
        type: 'Reward',
        relatedEntity: `مكافأة ${target}`,
        relatedId: item.id,
        requestedBy: actor,
        assignedTo: 'ليلى كريم',
        date: nowIso(),
        deadline: new Date(Date.now() + 2 * 86400000).toISOString(),
        status: 'Pending',
        source: item.source,
      });
    }
    pushGovAudit({
      user: actor,
      action: type === 'reward' ? 'Reward Requested' : 'Violation/Penalty',
      entityType: 'reward',
      entityId: item.id,
      entityLabel: target,
      newValue: String(item.value),
      source: item.source,
    });
    recomputeGovKpis(g);
    pushFeed('compliance', `${type === 'reward' ? 'مكافأة' : 'عقوبة'}: ${target}`);
    save();
    return item;
  };

  const decideGovApproval = (id, decision, comment = '', actor = 'مشغّل هوب') => {
    const g = govBag();
    const a = (g.approvals || []).find((x) => x.id === id);
    if (!a) return null;
    a.status = decision === 'approve' ? 'Approved' : 'Rejected';
    a.decidedBy = actor;
    a.decidedAt = nowIso();
    a.comment = comment;
    if (a.type === 'Reward' && decision === 'approve') {
      const r = (g.rewards || []).find((x) => x.id === a.relatedId);
      if (r) {
        r.status = 'Approved';
        r.approvedBy = actor;
        r.grantedBy = actor;
      }
    }
    if (a.type === 'Contract' && decision === 'approve') {
      const c = (g.contracts || []).find((x) => x.id === a.relatedId);
      if (c) c.status = 'Active';
    }
    if (a.type === 'Policy' && decision === 'approve') {
      updateGovPolicy(a.relatedId, { status: 'Active' }, actor);
    }
    pushGovAudit({
      user: actor,
      action: decision === 'approve' ? 'Approval Accepted' : 'Approval Rejected',
      entityType: 'approval',
      entityId: a.id,
      entityLabel: a.relatedEntity,
      newValue: a.status,
    });
    recomputeGovKpis(g);
    save();
    return a;
  };

  const addGovViolation = (payload = {}, actor = 'مشغّل هوب') => {
    const g = govBag();
    if (!Array.isArray(g.violations)) g.violations = [];
    const item = {
      id: payload.id || nextSecSeq(g.violations, 'VIO'),
      type: payload.type || 'Compliance',
      personId: payload.personId || '',
      person: payload.person || '',
      relatedPolicy: payload.relatedPolicy || '',
      severity: payload.severity || 'Medium',
      description: payload.description || '',
      detectedBy: payload.detectedBy || actor,
      detectedAt: nowIso(),
      owner: payload.owner || actor,
      correctiveAction: payload.correctiveAction || '',
      deadline: payload.deadline || '',
      status: 'Open',
      source: payload.source || 'Manual',
      createdBy: actor,
      createdAt: nowIso(),
    };
    g.violations.unshift(item);
    pushGovAudit({ user: actor, action: 'Violation Created', entityType: 'violation', entityId: item.id, entityLabel: item.person || item.type });
    recomputeGovKpis(g);
    save();
    return item;
  };

  const addGovRisk = (payload = {}, actor = 'مشغّل هوب') => {
    const g = govBag();
    if (!Array.isArray(g.risks)) g.risks = [];
    const likelihood = Number(payload.likelihood) || 1;
    const impact = Number(payload.impact) || 1;
    const item = {
      id: payload.id || nextSecSeq(g.risks, 'RSK'),
      title: payload.title,
      category: payload.category || 'Governance',
      relatedEntity: payload.relatedEntity || '',
      likelihood,
      impact,
      riskScore: likelihood * impact,
      owner: payload.owner || actor,
      mitigation: payload.mitigation || '',
      status: 'Open',
      source: 'Manual',
      createdBy: actor,
      createdAt: nowIso(),
    };
    g.risks.unshift(item);
    pushGovAudit({ user: actor, action: 'Risk Created', entityType: 'risk', entityId: item.id, entityLabel: item.title });
    recomputeGovKpis(g);
    save();
    return item;
  };

  const addGovDecision = (payload = {}, actor = 'مشغّل هوب') => {
    const g = govBag();
    if (!Array.isArray(g.decisions)) g.decisions = [];
    const item = {
      id: payload.id || nextSecSeq(g.decisions, 'DEC'),
      title: payload.title,
      committeeId: payload.committeeId || '',
      committee: payload.committee || '',
      owner: payload.owner || actor,
      createdBy: actor,
      decisionDate: payload.decisionDate || nowIso().slice(0, 10),
      effectiveDate: payload.effectiveDate || '',
      appliesTo: payload.appliesTo || '',
      status: payload.status || 'Draft',
      source: 'Manual',
      createdAt: nowIso(),
    };
    g.decisions.unshift(item);
    pushGovAudit({ user: actor, action: 'Decision Created', entityType: 'decision', entityId: item.id, entityLabel: item.title });
    save();
    return item;
  };

  const addGovCommittee = (payload = {}, actor = 'مشغّل هوب') => {
    const g = govBag();
    if (!Array.isArray(g.committees)) g.committees = [];
    const item = {
      id: payload.id || nextSecSeq(g.committees, 'COM'),
      name: payload.name,
      chairperson: payload.chairperson || '',
      secretary: payload.secretary || '',
      members: payload.members || [],
      purpose: payload.purpose || '',
      authority: payload.authority || '',
      meetingFrequency: payload.meetingFrequency || 'شهري',
      status: 'Active',
      source: 'Manual',
      createdBy: actor,
      createdAt: nowIso(),
    };
    g.committees.unshift(item);
    pushGovAudit({ user: actor, action: 'Committee Created', entityType: 'committee', entityId: item.id, entityLabel: item.name });
    save();
    return item;
  };

  const addGovDocument = (payload = {}, actor = 'مشغّل هوب') => {
    const g = govBag();
    if (!Array.isArray(g.documents)) g.documents = [];
    const item = {
      id: payload.id || nextSecSeq(g.documents, 'DOC'),
      name: payload.name,
      type: payload.type || 'Other',
      owner: payload.owner || actor,
      version: payload.version || '1.0',
      relatedEntity: payload.relatedEntity || '',
      uploadedBy: actor,
      uploadedAt: nowIso(),
      status: 'Active',
      source: 'Manual',
    };
    g.documents.unshift(item);
    pushGovAudit({ user: actor, action: 'Document Uploaded', entityType: 'document', entityId: item.id, entityLabel: item.name });
    save();
    return item;
  };

  const updateGovSettings = (patch = {}, actor = 'مشغّل هوب') => {
    const g = govBag();
    if (!g.settings) g.settings = {};
    Object.assign(g.settings, patch);
    pushGovAudit({ user: actor, action: 'Settings Changed', entityType: 'settings', newValue: JSON.stringify(patch) });
    save();
    return g.settings;
  };

  const dismissGovHelp = () => {
    govBag().helpDismissed = true;
    save();
  };

  const addConstitutionArticle = (article, text, actor = 'مشغّل هوب') => {
    const g = govBag();
    if (!Array.isArray(g.constitution)) g.constitution = [];
    const item = { id: uid('con'), article, text };
    g.constitution.push(item);
    pushGovAudit({ user: actor, action: 'Constitution Updated', entityType: 'constitution', entityLabel: article, newValue: text });
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

  const wfBag = () => {
    const s = get();
    if (!s.workforce || s.workforce.schemaVersion !== 3) {
      s.workforce = seedWorkforce();
      recomputeWorkforceKpis(s.workforce);
    }
    return s.workforce;
  };

  const addWorkforceSavedView = (name, filters = {}, actor = 'مشغّل هوب') => {
    const wf = wfBag();
    if (!Array.isArray(wf.savedViews)) wf.savedViews = [];
    const view = {
      id: uid('wfv'),
      name: String(name || '').trim() || 'عرض محفوظ',
      filters: { ...filters },
    };
    wf.savedViews.push(view);
    pushWfAudit({ user: actor, action: 'حفظ عرض موظفين', newValue: view.name });
    save();
    return view;
  };

  const bulkTagEmployees = (ids = [], tag = '', actor = 'مشغّل هوب') => {
    const wf = wfBag();
    const set = new Set(ids);
    let n = 0;
    (wf.employees || []).forEach((e) => {
      if (!set.has(e.id)) return;
      if (!Array.isArray(e.tags)) e.tags = [];
      if (tag && !e.tags.includes(tag)) e.tags.push(tag);
      n += 1;
    });
    pushWfAudit({ user: actor, action: 'وسم جماعي', newValue: `${n} · ${tag}` });
    save();
    return n;
  };

  const pushWfAudit = (entry = {}) => {
    const wf = wfBag();
    if (!Array.isArray(wf.auditLog)) wf.auditLog = [];
    const row = {
      id: entry.id || nextSecSeq(wf.auditLog, 'TXN-WF'),
      user: entry.user || 'مشغّل هوب',
      action: entry.action || 'تعديل',
      employeeId: entry.employeeId || '',
      employee: entry.employee || '',
      at: nowIso(),
      oldValue: entry.oldValue ?? '',
      newValue: entry.newValue ?? '',
      source: entry.source || 'Manual',
    };
    wf.auditLog.unshift(row);
    if (wf.auditLog.length > 500) wf.auditLog.length = 500;
    return row;
  };

  const addEmployee = (payload = {}, actor = 'مشغّل هوب') => {
    const wf = wfBag();
    if (!Array.isArray(wf.employees)) wf.employees = [];
    const name = String(payload.name || '').trim();
    if (!name) return null;
    const item = {
      id: payload.id || nextSecSeq(wf.employees, 'EMP'),
      externalId: payload.externalId || '',
      name,
      email: payload.email || '',
      phone: payload.phone || '',
      avatar: payload.avatar || '',
      title: payload.title || payload.role || 'موظف',
      role: payload.role || payload.title || 'موظف',
      department: payload.department || '',
      section: payload.section || '',
      manager: payload.manager || '',
      joinDate: payload.joinDate || nowIso().slice(0, 10),
      employmentType: payload.employmentType || 'دوام كامل',
      workType: payload.workType || 'عن بعد',
      location: payload.location || '',
      attendance: payload.attendance || 'Online',
      hours: Number(payload.hours) || 7,
      productivity: Number(payload.productivity) || 70,
      score: Number(payload.score) || 70,
      points: Number(payload.points) || 0,
      status: payload.status || (payload.draft ? 'draft' : 'active'),
      warned: false,
      source: payload.source || 'Manual',
      createdBy: actor,
      createdAt: nowIso(),
      lastSynced: '',
      lastActivity: nowIso(),
      linkedUser: payload.linkedUser || payload.email || '',
      systemRole: payload.systemRole || 'employee',
      notes: [],
      documents: [],
      archived: false,
      assignee: '',
      ...pickCommonMeta(payload),
    };
    wf.employees.unshift(item);
    pushWfAudit({
      user: actor,
      action: 'إضافة موظف',
      employeeId: item.id,
      employee: item.name,
      newValue: item.status,
      source: item.source,
    });
    recomputeWorkforceKpis();
    pushFeed('decision', `موظف جديد: ${item.name} · ${item.title}`);
    save();
    return item;
  };

  const updateEmployee = (id, patch = {}, actor = 'مشغّل هوب') => {
    const e = wfBag().employees?.find((x) => x.id === id);
    if (!e) return null;
    Object.keys(patch).forEach((k) => {
      if (patch[k] === undefined || patch[k] === e[k]) return;
      pushWfAudit({
        user: actor,
        action: `تعديل موظف (${k})`,
        employeeId: e.id,
        employee: e.name,
        oldValue: String(e[k] ?? ''),
        newValue: String(patch[k] ?? ''),
      });
    });
    Object.assign(e, patch, { lastActivity: nowIso() });
    if (patch.title && !patch.role) e.role = patch.title;
    recomputeWorkforceKpis();
    save();
    return e;
  };

  const archiveEmployee = (id, actor = 'مشغّل هوب') => {
    const e = wfBag().employees?.find((x) => x.id === id);
    if (!e) return null;
    e.archived = true;
    e.status = 'inactive';
    pushWfAudit({ user: actor, action: 'أرشفة موظف', employeeId: e.id, employee: e.name, newValue: 'archived' });
    recomputeWorkforceKpis();
    save();
    return e;
  };

  const warnEmployee = (id, actor = 'مشغّل هوب') => {
    const e = wfBag().employees.find((x) => x.id === id);
    if (!e) return null;
    e.warned = true;
    e.status = e.productivity < 65 ? 'critical' : 'warning';
    pushWfAudit({ user: actor, action: 'إنذار موظف', employeeId: e.id, employee: e.name, newValue: e.status });
    pushFeed('alert', `إنذار مبكر: ${e.name}`);
    save();
    return e;
  };

  const rewardEmployee = (id, amount = 300, extras = {}, actor = 'مشغّل هوب') => {
    const wf = wfBag();
    const e = wf.employees.find((x) => x.id === id);
    if (!e) return null;
    const needsApproval = extras.requiresApproval ?? wf.settings?.requireRewardApproval;
    const item = {
      id: nextSecSeq(wf.rewards || [], 'RWD'),
      employeeId: e.id,
      employee: e.name,
      type: extras.type || 'نقاط',
      value: Number(extras.value ?? amount),
      points: Number(extras.points ?? (extras.type === 'نقاط' || !extras.type ? amount : 0)),
      reason: extras.reason || 'مكافأة تلقائية للأداء',
      source: extras.source || 'Manual',
      nominatedBy: extras.nominatedBy || actor,
      grantedBy: needsApproval ? '' : actor,
      approvedBy: '',
      approvalDate: '',
      status: needsApproval && !extras.forceGrant ? 'Pending Approval' : 'Approved',
      at: nowIso(),
      createdBy: actor,
    };
    if (!Array.isArray(wf.rewards)) wf.rewards = [];
    wf.rewards.unshift(item);
    if (item.status === 'Approved') {
      e.points = (e.points || 0) + (item.points || 0);
      e.score = Math.min(100, (e.score || 0) + 3);
      if (!Array.isArray(wf.pointsTx)) wf.pointsTx = [];
      if (item.points) {
        wf.pointsTx.unshift({
          id: nextSecSeq(wf.pointsTx, 'PTX'),
          employeeId: e.id,
          employee: e.name,
          type: 'earn',
          points: item.points,
          reason: item.reason,
          source: 'Reward',
          createdBy: actor,
          at: nowIso(),
        });
      }
      item.grantedBy = actor;
      item.approvedBy = actor;
      item.approvalDate = nowIso();
    }
    pushWfAudit({
      user: actor,
      action: item.status === 'Approved' ? 'منح مكافأة' : 'طلب مكافأة',
      employeeId: e.id,
      employee: e.name,
      newValue: `${item.type} ${item.value} · ${item.status}`,
      source: item.source,
    });
    recomputeWorkforceKpis();
    pushFeed('decision', `مكافأة ${e.name}: ${item.value}`);
    save();
    return item;
  };

  const decideReward = (id, decision, comment = '', actor = 'مشغّل هوب') => {
    const wf = wfBag();
    const r = wf.rewards?.find((x) => x.id === id);
    if (!r) return null;
    if (decision === 'reject' && !String(comment || '').trim()) return { error: 'التعليق إجباري عند الرفض' };
    const old = r.status;
    if (decision === 'approve') {
      r.status = 'Approved';
      r.approvedBy = actor;
      r.approvalDate = nowIso();
      r.grantedBy = r.grantedBy || actor;
      const e = wf.employees.find((x) => x.id === r.employeeId || x.name === r.employee);
      if (e && r.points) {
        e.points = (e.points || 0) + r.points;
        if (!Array.isArray(wf.pointsTx)) wf.pointsTx = [];
        wf.pointsTx.unshift({
          id: nextSecSeq(wf.pointsTx, 'PTX'),
          employeeId: e.id,
          employee: e.name,
          type: 'earn',
          points: r.points,
          reason: r.reason,
          source: 'Reward Approval',
          createdBy: actor,
          at: nowIso(),
        });
      }
    } else {
      r.status = 'Rejected';
      r.approvedBy = actor;
      r.approvalDate = nowIso();
      r.rejectComment = comment;
    }
    pushWfAudit({
      user: actor,
      action: decision === 'approve' ? 'اعتماد مكافأة' : 'رفض مكافأة',
      employeeId: r.employeeId,
      employee: r.employee,
      oldValue: old,
      newValue: r.status,
      source: r.source,
    });
    recomputeWorkforceKpis();
    save();
    return r;
  };

  const importEmployees = (rows = [], actor = 'مشغّل هوب') => {
    const created = [];
    let invalid = 0;
    let duplicates = 0;
    const wf = wfBag();
    rows.forEach((row) => {
      const name = String(row.name || '').trim();
      if (!name) {
        invalid += 1;
        return;
      }
      if ((wf.employees || []).some((e) => e.name === name && !e.archived)) {
        duplicates += 1;
        return;
      }
      created.push(
        addEmployee(
          {
            name,
            title: row.title || row.role || 'موظف',
            department: row.department || '',
            section: row.section || '',
            manager: row.manager || '',
            workType: row.workType || 'عن بعد',
            email: row.email || '',
            source: 'Excel Import',
          },
          actor
        )
      );
    });
    pushWfAudit({
      user: actor,
      action: 'استيراد موظفين',
      employeeId: '',
      employee: '',
      newValue: `imported=${created.length}; invalid=${invalid}; dup=${duplicates}`,
      source: 'Excel Import',
    });
    recomputeWorkforceKpis();
    save();
    return { created, invalid, duplicates };
  };

  const syncWorkforce = (actor = 'مشغّل هوب') => {
    const wf = wfBag();
    const conn = (wf.connections || [])[0];
    if (conn) {
      conn.lastSync = nowIso();
      conn.nextSync = new Date(Date.now() + 86400000).toISOString();
      conn.status = 'Connected';
      conn.syncedCount = (wf.employees || []).filter((e) => e.source === 'HR System').length;
    }
    (wf.employees || [])
      .filter((e) => e.source === 'HR System' || e.source === 'Integration')
      .forEach((e) => {
        e.lastSynced = nowIso();
      });
    pushWfAudit({ user: actor, action: 'مزامنة الموظفين', newValue: conn?.syncedCount || 0, source: 'HR System' });
    recomputeWorkforceKpis();
    save();
    return conn;
  };

  const updateWorkforceSettings = (patch = {}, actor = 'مشغّل هوب') => {
    const wf = wfBag();
    if (!wf.settings) wf.settings = {};
    Object.assign(wf.settings, patch);
    pushWfAudit({ user: actor, action: 'تعديل إعدادات القوى العاملة', newValue: JSON.stringify(patch) });
    save();
    return wf.settings;
  };

  const tickProductivity = () => {
    wfBag().employees.forEach((e) => {
      if (e.archived || e.status === 'leave' || e.status === 'inactive') return;
      const delta = Math.floor(Math.random() * 7) - 3;
      e.productivity = Math.max(40, Math.min(100, (e.productivity || 70) + delta));
      e.hours = Math.max(4, Math.min(9, +((e.hours || 7) + (Math.random() * 0.4 - 0.2)).toFixed(1)));
      e.score = Math.round(e.productivity * 0.7 + e.hours * 3);
      if (e.productivity < 65) e.status = 'critical';
      else if (e.productivity < 75) e.status = 'warning';
      else e.status = 'active';
      e.lastActivity = nowIso();
    });
    recomputeWorkforceKpis();
    pushFeed('decision', 'تحديث إنتاجية القوى العاملة');
    save();
  };

  const dismissWorkforceHelp = () => {
    wfBag().helpDismissed = true;
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
    const stamp = nowIso();
    const item = {
      id: uid('t'),
      title,
      details: String(extra.details || '').trim(),
      assignee,
      priority,
      status: extra.status || 'todo',
      quality: 0,
      project,
      dueDate: String(extra.dueDate || '').trim(),
      source: extra.source || 'إدخال يدوي',
      createdAt: stamp,
      updatedAt: stamp,
      createdBy: extra.createdBy || 'مشغّل هوب',
      ...pickCommonMeta(extra),
    };
    get().tasks.items.unshift(item);
    pushDomainAudit(get().tasks, {
      action: 'create',
      detail: `مهمة جديدة: ${title}`,
      by: item.createdBy,
      source: item.source,
      entityId: item.id,
    });
    pushFeed('decision', `مهمة جديدة: ${title}`);
    save();
    return item;
  };

  const updateTask = (id, patch = {}, actor = 'مشغّل هوب') => {
    const t = get().tasks.items.find((x) => x.id === id);
    if (!t) return null;
    const keys = [
      'title',
      'details',
      'assignee',
      'priority',
      'status',
      'project',
      'dueDate',
      'quality',
      'source',
      'companyName',
      'companyAddress',
      'party1Name',
      'party1Phone',
      'party2Name',
      'party2Phone',
      'branch',
      'incubator',
      'platform',
      'office',
      'docName',
      'imageName',
      'videoName',
    ];
    keys.forEach((k) => {
      if (patch[k] !== undefined) t[k] = patch[k];
    });
    t.updatedAt = nowIso();
    t.updatedBy = actor;
    pushDomainAudit(get().tasks, {
      action: 'update',
      detail: `تحديث مهمة: ${t.title}`,
      by: actor,
      source: t.source || 'Manual',
      entityId: t.id,
    });
    pushFeed('decision', `تحديث مهمة: ${t.title}`);
    recalculateMeasurement();
    save();
    return t;
  };

  const removeTask = (id, actor = 'مشغّل هوب') => {
    const list = get().tasks.items;
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) return null;
    const [t] = list.splice(idx, 1);
    pushDomainAudit(get().tasks, {
      action: 'delete',
      detail: `حذف مهمة: ${t.title}`,
      by: actor,
      source: t.source || 'Manual',
      entityId: t.id,
    });
    pushFeed('decision', `حذف مهمة: ${t.title}`);
    recalculateMeasurement();
    save();
    return t;
  };

  const updateTaskStatus = (id, status) => {
    const t = get().tasks.items.find((x) => x.id === id);
    if (!t) return null;
    t.status = status;
    t.updatedAt = nowIso();
    if (status === 'done') t.quality = 75 + Math.floor(Math.random() * 20);
    pushDomainAudit(get().tasks, {
      action: 'status',
      detail: `حالة مهمة → ${status}: ${t.title}`,
      by: 'مشغّل هوب',
      source: t.source || 'Manual',
      entityId: t.id,
    });
    pushFeed('decision', `تحديث مهمة (${status}): ${t.title}`);
    // measurement ripple
    recalculateMeasurement();
    save();
    return t;
  };

  const dismissTasksHelp = () => {
    const t = get().tasks;
    t.settings = t.settings || {};
    t.settings.helpDismissed = true;
    save();
    return t.settings;
  };

  const addMeasurementIndicator = (payload = {}, actor = 'مشغّل هوب') => {
    const m = get().measurement;
    if (!Array.isArray(m.indicators)) m.indicators = [];
    const item = {
      id: uid('mi'),
      name: String(payload.name || '').trim(),
      formula: String(payload.formula || '').trim() || 'manual',
      source: payload.source || 'إدخال يدوي',
      value: Number(payload.value) || 0,
      owner: payload.owner || actor,
      status: payload.status || 'active',
      updatedAt: nowIso(),
    };
    if (!item.name) return null;
    m.indicators.unshift(item);
    pushDomainAudit(m, {
      action: 'create',
      detail: `مؤشر قياس: ${item.name}`,
      by: actor,
      source: item.source,
      entityId: item.id,
    });
    save();
    return item;
  };

  const updateMeasurementIndicator = (id, patch = {}, actor = 'مشغّل هوب') => {
    const m = get().measurement;
    const row = (m.indicators || []).find((x) => x.id === id);
    if (!row) return null;
    ['name', 'formula', 'source', 'value', 'owner', 'status'].forEach((k) => {
      if (patch[k] !== undefined) row[k] = patch[k];
    });
    row.updatedAt = nowIso();
    pushDomainAudit(m, {
      action: 'update',
      detail: `تحديث مؤشر: ${row.name}`,
      by: actor,
      source: row.source,
      entityId: row.id,
    });
    save();
    return row;
  };

  const upsertIntegrationConnector = (payload = {}, actor = 'مشغّل هوب') => {
    const integ = get().integration;
    if (!Array.isArray(integ.connectors)) integ.connectors = [];
    let row = payload.id ? integ.connectors.find((x) => x.id === payload.id) : null;
    if (row) {
      ['name', 'type', 'status', 'direction', 'source'].forEach((k) => {
        if (payload[k] !== undefined) row[k] = payload[k];
      });
      row.updatedAt = nowIso();
      pushDomainAudit(integ, {
        action: 'update',
        detail: `تحديث موصل: ${row.name}`,
        by: actor,
        source: row.source || 'Manual',
        entityId: row.id,
      });
    } else {
      row = {
        id: uid('ic'),
        name: String(payload.name || '').trim() || 'موصل جديد',
        type: payload.type || 'internal',
        status: payload.status || 'disconnected',
        direction: payload.direction || 'ثنائي',
        source: payload.source || 'إدخال يدوي',
        lastSyncAt: null,
        createdAt: nowIso(),
      };
      integ.connectors.unshift(row);
      pushDomainAudit(integ, {
        action: 'create',
        detail: `موصل جديد: ${row.name}`,
        by: actor,
        source: row.source,
        entityId: row.id,
      });
    }
    save();
    return row;
  };

  const syncIntegrationConnector = (id, actor = 'مشغّل هوب') => {
    const integ = get().integration;
    const c = (integ.connectors || []).find((x) => x.id === id);
    if (!c) return null;
    c.lastSyncAt = nowIso();
    c.status = c.status === 'disconnected' ? 'connected' : c.status;
    if (!Array.isArray(integ.syncLog)) integ.syncLog = [];
    const log = {
      id: uid('sl'),
      connector: c.name,
      connectorId: c.id,
      status: 'success',
      detail: `مزامنة يدوية لـ ${c.name}`,
      at: c.lastSyncAt,
      source: 'Manual Sync',
      by: actor,
    };
    integ.syncLog.unshift(log);
    integ.syncLog = integ.syncLog.slice(0, 100);
    pushDomainAudit(integ, {
      action: 'sync',
      detail: log.detail,
      by: actor,
      source: 'Manual Sync',
      entityId: c.id,
    });
    save();
    return { connector: c, log };
  };

  const coreBag = () => {
    hydrateCoreIntelligence();
    return get().core;
  };

  const pushCoreHistory = (decision, entry) => {
    if (!decision) return;
    if (!Array.isArray(decision.history)) decision.history = [];
    decision.history.unshift({ at: nowIso(), ...entry });
    decision.history = decision.history.slice(0, 80);
  };

  const upsertCoreDecision = (payload = {}, actor = 'مشغّل هوب') => {
    const core = coreBag();
    if (!Array.isArray(core.decisions)) core.decisions = [];
    let row = payload.id ? core.decisions.find((x) => x.id === payload.id) : null;
    const stamp = nowIso();
    const locked = row && (row.status === 'Approved' || row.status === 'Executed');
    if (locked && payload.forceEdit) {
      // create revision copy
      const copy = Object.assign({}, row, {
        id: uid('d'),
        decisionId: nextSecSeq(core.decisions, 'DEC'),
        title: `${row.title} (مراجعة)`,
        status: 'Draft',
        approvedBy: '',
        createdAt: stamp,
        updatedAt: stamp,
        createdBy: actor,
        history: [{ at: stamp, action: 'revision', by: actor, detail: `نسخة معدّلة من ${row.decisionId}` }],
      });
      Object.assign(copy, {
        description: payload.description != null ? payload.description : copy.description,
        priority: payload.priority || copy.priority,
        owner: payload.owner || copy.owner,
        reason: payload.reason || copy.reason,
        rationale: payload.reason || copy.rationale,
        impact: payload.impact || copy.impact,
        reviewer: payload.reviewer || copy.reviewer,
        approver: payload.approver || copy.approver,
      });
      core.decisions.unshift(copy);
      pushDomainAudit(core, { action: 'decision_revision', detail: copy.title, by: actor, source: copy.sourceType, entityId: copy.id });
      save();
      return copy;
    }
    if (locked) return { error: 'لا يمكن تعديل قرار معتمد/منفّذ مباشرة — أنشئ نسخة معدّلة' };

    if (row) {
      Object.assign(row, {
        title: payload.title != null ? payload.title : row.title,
        description: payload.description != null ? payload.description : row.description,
        type: payload.type || row.type,
        category: payload.category || row.category,
        priority: payload.priority || row.priority,
        sourceType: payload.sourceType || row.sourceType,
        engine: payload.engine || row.engine,
        source: payload.source || row.source,
        impact: payload.impact || row.impact,
        confidence: payload.confidence != null ? Number(payload.confidence) : row.confidence,
        owner: payload.owner || row.owner,
        reviewer: payload.reviewer || row.reviewer,
        approver: payload.approver || row.approver,
        reason: payload.reason != null ? payload.reason : row.reason,
        rationale: payload.reason != null ? payload.reason : row.rationale,
        recommendation: payload.recommendation != null ? payload.recommendation : row.recommendation,
        sourceModules: payload.sourceModules || row.sourceModules,
        dataUsed: payload.dataUsed || row.dataUsed,
        model: payload.model || row.model,
        evidence: payload.evidence || row.evidence,
        preview: payload.preview || row.preview,
        expectedOutcome: payload.expectedOutcome != null ? payload.expectedOutcome : row.expectedOutcome,
        status: payload.status || row.status,
        updatedAt: stamp,
        sensitive: !!payload.sensitive || row.sensitive,
      });
      pushCoreHistory(row, { action: 'edited', by: actor, detail: 'تعديل القرار' });
      pushDomainAudit(core, { action: 'decision_edited', detail: row.title, by: actor, source: row.sourceType, entityId: row.id });
      save();
      return row;
    }

    const item = {
      id: uid('d'),
      decisionId: nextSecSeq(core.decisions, 'DEC'),
      title: String(payload.title || '').trim(),
      description: String(payload.description || '').trim(),
      type: payload.type || 'Operational',
      category: payload.category || 'General',
      priority: payload.priority || 'متوسط',
      sourceType: payload.sourceType || 'يدوي',
      engine: payload.engine || (payload.sourceType === 'AI Analysis' ? 'AI Decision' : payload.sourceType === 'Rule Engine' ? 'Rule Engine' : 'Manual'),
      source: payload.source || 'إدخال يدوي',
      impact: payload.impact || payload.priority || 'متوسط',
      confidence: Number(payload.confidence) || 70,
      createdBy: actor,
      approvedBy: '',
      owner: payload.owner || actor,
      reviewer: payload.reviewer || '',
      approver: payload.approver || '',
      status: payload.status || 'Draft',
      createdAt: stamp,
      updatedAt: stamp,
      at: stamp,
      reason: payload.reason || '',
      rationale: payload.reason || '',
      reasoning: payload.reasoning || [],
      recommendation: payload.recommendation || '',
      sourceModules: payload.sourceModules || [],
      dataUsed: payload.dataUsed || 'آخر 30 يوم',
      model: payload.model || 'Decision Model v2',
      evidence: payload.evidence || [],
      preview: payload.preview || { tasks: 0, users: 0, impactText: '—', affectedUsers: 0 },
      expectedOutcome: payload.expectedOutcome || '',
      actualOutcome: '',
      impactResult: '',
      feedback: null,
      history: [{ at: stamp, action: 'created', by: actor, detail: 'إنشاء قرار' }],
      sensitive: !!payload.sensitive,
    };
    if (!item.title) return { error: 'عنوان القرار مطلوب' };
    core.decisions.unshift(item);
    pushDomainAudit(core, { action: 'decision_created', detail: item.title, by: actor, source: item.sourceType, entityId: item.id });
    pushFeed('decision', item.title);
    save();
    return item;
  };

  const updateCoreDecisionStatus = (id, status, actor = 'مشغّل هوب', detail = '') => {
    const core = coreBag();
    const row = (core.decisions || []).find((x) => x.id === id);
    if (!row) return null;
    const prev = row.status;
    row.status = status;
    row.updatedAt = nowIso();
    if (status === 'Approved') row.approvedBy = actor;
    if (status === 'Rejected') row.approvedBy = '';
    pushCoreHistory(row, { action: status.toLowerCase().replace(/\s+/g, '_'), by: actor, detail: detail || `${prev} → ${status}` });
    pushDomainAudit(core, { action: 'decision_status', detail: `${row.title}: ${status}`, by: actor, source: row.sourceType, entityId: row.id });

    if (!Array.isArray(core.approvals)) core.approvals = [];
    if (status === 'Pending Review' || status === 'Pending Approval') {
      core.approvals.unshift({
        id: nextSecSeq(core.approvals, 'APR'),
        decisionRef: row.id,
        decisionId: row.decisionId,
        title: row.title,
        stage: status === 'Pending Review' ? 'Review' : 'Approval',
        assignee: status === 'Pending Review' ? row.reviewer || actor : row.approver || 'القائد الأعلى',
        status: 'Waiting',
        direction: 'inbox',
        at: nowIso(),
      });
    }
    save();
    return row;
  };

  const archiveCoreDecision = (id, actor = 'مشغّل هوب') => updateCoreDecisionStatus(id, 'Archived', actor, 'أرشفة');

  const deleteCoreDecision = (id, actor = 'مشغّل هوب') => {
    const core = coreBag();
    const row = (core.decisions || []).find((x) => x.id === id);
    if (!row) return null;
    if (row.status === 'Executed' || row.status === 'Approved') {
      return { error: 'القرارات المنفّذة/المعتمدة تُؤرشف فقط' };
    }
    core.decisions = core.decisions.filter((x) => x.id !== id);
    pushDomainAudit(core, { action: 'decision_deleted', detail: row.title, by: actor, source: row.sourceType, entityId: id });
    save();
    return { ok: true };
  };

  const upsertCoreRecommendation = (payload = {}, actor = 'مشغّل هوب') => {
    const core = coreBag();
    if (!Array.isArray(core.recommendations)) core.recommendations = [];
    let row = payload.id ? core.recommendations.find((x) => x.id === payload.id) : null;
    if (row) {
      Object.assign(row, payload, { updatedAt: nowIso() });
      pushDomainAudit(core, { action: 'recommendation_updated', detail: row.title, by: actor, source: row.source, entityId: row.id });
      save();
      return row;
    }
    const item = {
      id: nextSecSeq(core.recommendations, 'REC'),
      title: String(payload.title || '').trim(),
      source: payload.source || 'يدوي',
      reason: payload.reason || '',
      impact: payload.impact || 'متوسط',
      confidence: Number(payload.confidence) || 70,
      suggestedAction: payload.suggestedAction || '',
      owner: payload.owner || actor,
      status: payload.status || 'New',
      at: nowIso(),
    };
    if (!item.title) return { error: 'عنوان التوصية مطلوب' };
    core.recommendations.unshift(item);
    pushDomainAudit(core, { action: 'recommendation_created', detail: item.title, by: actor, source: item.source, entityId: item.id });
    save();
    return item;
  };

  const convertRecommendationToDecision = (id, actor = 'مشغّل هوب') => {
    const core = coreBag();
    const rec = (core.recommendations || []).find((x) => x.id === id);
    if (!rec) return null;
    const decision = upsertCoreDecision(
      {
        title: rec.title,
        description: rec.suggestedAction || rec.reason,
        reason: rec.reason,
        impact: rec.impact,
        confidence: rec.confidence,
        sourceType: 'Recommendation',
        engine: 'Recommendation',
        source: rec.source,
        owner: rec.owner,
        status: 'Draft',
        recommendation: rec.suggestedAction,
      },
      actor
    );
    if (decision?.error) return decision;
    rec.status = 'Converted';
    rec.linkedDecisionId = decision.id;
    pushDomainAudit(core, { action: 'recommendation_converted', detail: rec.title, by: actor, source: rec.source, entityId: rec.id });
    save();
    return decision;
  };

  const upsertCoreInsight = (payload = {}, actor = 'مشغّل هوب') => {
    const core = coreBag();
    if (!Array.isArray(core.insights)) core.insights = [];
    let row = payload.id ? core.insights.find((x) => x.id === payload.id) : null;
    if (row) {
      Object.assign(row, payload, { updatedAt: nowIso() });
      save();
      return row;
    }
    const item = {
      id: uid('ins'),
      insightId: nextSecSeq(core.insights, 'INS'),
      title: String(payload.title || '').trim(),
      category: payload.category || 'Operations',
      source: payload.source || 'إدخال يدوي',
      summary: payload.summary || payload.rationale || '',
      rationale: payload.rationale || payload.summary || '',
      severity: payload.severity || 'متوسط',
      confidence: Number(payload.confidence) || 70,
      generatedAt: nowIso(),
      at: nowIso(),
      status: payload.status || 'New',
      by: actor,
    };
    if (!item.title) return { error: 'عنوان الرؤية مطلوب' };
    core.insights.unshift(item);
    pushDomainAudit(core, { action: 'insight_created', detail: item.title, by: actor, source: item.source, entityId: item.id });
    save();
    return item;
  };

  const upsertCorePrediction = (payload = {}, actor = 'مشغّل هوب') => {
    const core = coreBag();
    if (!Array.isArray(core.predictions)) core.predictions = [];
    let row = payload.id ? core.predictions.find((x) => x.id === payload.id) : null;
    if (row) {
      Object.assign(row, payload);
      save();
      return row;
    }
    const item = {
      id: uid('p'),
      predictionId: nextSecSeq(core.predictions, 'PRD'),
      title: String(payload.title || payload.risk || '').trim(),
      risk: payload.title || payload.risk || '',
      target: payload.target || 'الإنتاجية',
      predictedValue: Number(payload.predictedValue) || Number(payload.probability) || 50,
      probability: Number(payload.predictedValue) || Number(payload.probability) || 50,
      confidence: Number(payload.confidence) || 80,
      period: payload.period || payload.eta || '7 أيام',
      eta: payload.period || payload.eta || '7 أيام',
      source: payload.source || 'Predictive Engine',
      model: payload.model || 'Forecast v1',
      severity: payload.severity || 'متوسط',
      generatedAt: nowIso(),
      status: payload.status || 'Active',
    };
    if (!item.title) return { error: 'عنوان التنبؤ مطلوب' };
    core.predictions.unshift(item);
    pushDomainAudit(core, { action: 'prediction_created', detail: item.title, by: actor, source: item.source, entityId: item.id });
    save();
    return item;
  };

  const upsertCoreAnomaly = (payload = {}, actor = 'مشغّل هوب') => {
    const core = coreBag();
    if (!Array.isArray(core.anomalies)) core.anomalies = [];
    let row = payload.id ? core.anomalies.find((x) => x.id === payload.id) : null;
    if (row) {
      Object.assign(row, payload);
      save();
      return row;
    }
    const item = {
      id: uid('a'),
      anomalyId: nextSecSeq(core.anomalies, 'ANM'),
      type: payload.type || 'Behavioral',
      source: payload.source || 'يدوي',
      signal: payload.signal || payload.metric || '',
      metric: payload.metric || payload.signal || 'Metric',
      expected: payload.expected || 'Baseline',
      actual: payload.actual || '',
      deviation: payload.deviation || '',
      score: Number(payload.score) || 70,
      severity: payload.severity || 'متوسط',
      detectedAt: nowIso(),
      owner: payload.owner || actor,
      status: payload.status || 'Open',
    };
    core.anomalies.unshift(item);
    pushDomainAudit(core, { action: 'anomaly_created', detail: item.metric, by: actor, source: item.source, entityId: item.id });
    save();
    return item;
  };

  const upsertCoreRule = (payload = {}, actor = 'مشغّل هوب') => {
    const core = coreBag();
    if (!Array.isArray(core.rules)) core.rules = [];
    let row = payload.id ? core.rules.find((x) => x.id === payload.id) : null;
    if (row) {
      Object.assign(row, payload, { updatedAt: nowIso() });
      pushDomainAudit(core, { action: 'rule_updated', detail: row.name, by: actor, source: 'Rule Engine', entityId: row.id });
      save();
      return row;
    }
    const item = {
      id: nextSecSeq(core.rules, 'RULE'),
      name: String(payload.name || '').trim(),
      sourceModule: payload.sourceModule || 'المهام',
      metric: payload.metric || '',
      operator: payload.operator || '>',
      value: Number(payload.value) || 0,
      extraConditions: payload.extraConditions || [],
      action: payload.action || 'Generate Recommendation',
      severity: payload.severity || 'High',
      priority: payload.priority || 'متوسط',
      owner: payload.owner || actor,
      status: payload.status || 'Active',
      at: nowIso(),
    };
    if (!item.name) return { error: 'اسم القاعدة مطلوب' };
    core.rules.unshift(item);
    pushDomainAudit(core, { action: 'rule_created', detail: item.name, by: actor, source: 'Rule Engine', entityId: item.id });
    save();
    return item;
  };

  const upsertCoreDataSource = (payload = {}, actor = 'مشغّل هوب') => {
    const core = coreBag();
    if (!Array.isArray(core.dataSources)) core.dataSources = [];
    let row = payload.id ? core.dataSources.find((x) => x.id === payload.id) : null;
    if (row) {
      Object.assign(row, payload);
      pushDomainAudit(core, { action: 'data_source_changed', detail: row.name, by: actor, source: row.type, entityId: row.id });
      save();
      return row;
    }
    const item = {
      id: nextSecSeq(core.dataSources, 'SRC'),
      name: String(payload.name || '').trim(),
      module: payload.module || '',
      type: payload.type || 'Internal Module',
      status: payload.status || 'Connected',
      lastSync: nowIso(),
      records: Number(payload.records) || 0,
      owner: payload.owner || actor,
    };
    if (!item.name) return { error: 'اسم المصدر مطلوب' };
    core.dataSources.unshift(item);
    pushDomainAudit(core, { action: 'data_source_created', detail: item.name, by: actor, source: item.type, entityId: item.id });
    save();
    return item;
  };

  const syncCoreDataSource = (id, actor = 'مشغّل هوب') => {
    const core = coreBag();
    const row = (core.dataSources || []).find((x) => x.id === id);
    if (!row) return null;
    row.lastSync = nowIso();
    row.records = (row.records || 0) + Math.floor(Math.random() * 5);
    row.status = row.status === 'Degraded' ? 'Connected' : row.status;
    pushDomainAudit(core, { action: 'data_source_sync', detail: row.name, by: actor, source: row.type, entityId: row.id });
    save();
    return row;
  };

  const testCoreDataSource = (id, actor = 'مشغّل هوب') => {
    const core = coreBag();
    const row = (core.dataSources || []).find((x) => x.id === id);
    if (!row) return null;
    row.status = 'Connected';
    row.lastSync = nowIso();
    pushDomainAudit(core, { action: 'data_source_test', detail: row.name, by: actor, source: row.type, entityId: row.id });
    save();
    return row;
  };

  const executeCoreDecision = (id, actor = 'مشغّل هوب', confirmed = true) => {
    const core = coreBag();
    const d = (core.decisions || []).find((x) => x.id === id);
    if (!d) return null;
    if (d.status !== 'Approved' && d.status !== 'Pending Approval' && d.status !== 'pending') {
      if (d.status === 'Executed') return { error: 'القرار منفّذ مسبقًا' };
      if (d.status === 'Draft' || d.status === 'Pending Review') return { error: 'يجب اعتماد القرار قبل التنفيذ' };
    }
    if (core.settings?.requireApprovalForSensitive && d.sensitive && d.status !== 'Approved') {
      return { error: 'قرار حسّاس — يلزم الاعتماد أولاً', needsApproval: true };
    }
    if (!confirmed) {
      return { preview: true, decision: d, message: `سيتم تنفيذ القرار على ${d.preview?.tasks || 0} مهمة و${d.preview?.users || d.preview?.affectedUsers || 0} مستخدم.` };
    }
    if (!Array.isArray(core.executions)) core.executions = [];
    const exec = {
      id: nextSecSeq(core.executions, 'EXEC'),
      decisionId: d.decisionId,
      decisionRef: d.id,
      decision: d.title,
      executedBy: actor,
      startedAt: nowIso(),
      completedAt: nowIso(),
      affectedRecords: d.preview?.tasks || 0,
      status: 'Success',
      result: d.preview?.impactText || 'تم التنفيذ',
      timeline: [
        { ok: true, text: 'القرار تم اعتماده' },
        { ok: true, text: 'تم تحميل البيانات' },
        { ok: true, text: 'تم التحقق من الشروط' },
        { ok: true, text: 'تم تطبيق التغييرات' },
        { ok: true, text: 'تم إرسال الإشعارات' },
        { ok: true, text: 'اكتمل التنفيذ' },
      ],
    };
    core.executions.unshift(exec);
    d.status = 'Executed';
    d.updatedAt = nowIso();
    d.actualOutcome = d.actualOutcome || d.expectedOutcome || exec.result;
    d.impactResult = d.impactResult || 'Pending Review';
    pushCoreHistory(d, { action: 'executed', by: actor, detail: exec.id });
    pushDomainAudit(core, { action: 'decision_executed', detail: `${d.title} · ${exec.id}`, by: actor, source: d.sourceType, entityId: d.id });
    pushFeed('decision', `تنفيذ: ${d.title}`);
    save();
    return { decision: d, execution: exec };
  };

  const retryCoreExecution = (id, actor = 'مشغّل هوب') => {
    const core = coreBag();
    const ex = (core.executions || []).find((x) => x.id === id);
    if (!ex) return null;
    ex.status = 'Success';
    ex.completedAt = nowIso();
    ex.result = (ex.result || '') + ' · أُعيدت المحاولة بنجاح';
    (ex.timeline || []).push({ ok: true, text: 'إعادة المحاولة نجحت' });
    pushDomainAudit(core, { action: 'execution_retry', detail: ex.id, by: actor, source: 'Execution', entityId: ex.id });
    save();
    return ex;
  };

  const decideCoreApproval = (id, decision, actor = 'مشغّل هوب', comment = '') => {
    const core = coreBag();
    const apr = (core.approvals || []).find((x) => x.id === id);
    if (!apr) return null;
    if (decision === 'reject' && !String(comment || '').trim()) return { error: 'التعليق إجباري عند الرفض' };
    apr.status = decision === 'approve' ? 'Approved' : decision === 'changes' ? 'Changes Requested' : 'Rejected';
    apr.decidedBy = actor;
    apr.comment = comment || '';
    apr.at = nowIso();
    apr.direction = 'done';
    if (apr.decisionRef) {
      updateCoreDecisionStatus(
        apr.decisionRef,
        decision === 'approve' ? 'Approved' : decision === 'changes' ? 'Draft' : 'Rejected',
        actor,
        comment || apr.status
      );
    }
    pushDomainAudit(core, { action: 'approval_' + decision, detail: apr.title, by: actor, source: 'Approvals', entityId: apr.id });
    save();
    return apr;
  };

  const setCoreDecisionFeedback = (id, rating, comment, actor = 'مشغّل هوب') => {
    const core = coreBag();
    const d = (core.decisions || []).find((x) => x.id === id);
    if (!d) return null;
    d.feedback = { rating, comment: comment || '', by: actor, at: nowIso() };
    pushCoreHistory(d, { action: 'feedback', by: actor, detail: rating });
    pushDomainAudit(core, { action: 'decision_feedback', detail: `${d.title}: ${rating}`, by: actor, source: 'Impact', entityId: d.id });
    save();
    return d;
  };

  const runCoreAnalysis = (actor = 'مشغّل هوب') => {
    const core = coreBag();
    const pred = upsertCorePrediction(
      {
        title: 'احتمالية انخفاض الإنتاجية خلال 7 أيام',
        target: 'الإنتاجية',
        predictedValue: 78,
        confidence: 88,
        period: '7 أيام',
        source: 'Predictive Engine',
        model: 'Forecast v1',
        severity: 'عالي',
      },
      actor
    );
    const insight = upsertCoreInsight(
      {
        title: 'إشارة تحليل جديدة من غرفة العمليات',
        summary: 'تشغيل التحليل كشف تركيز اختناقات في المهام والقوى العاملة.',
        source: 'Central Analysis',
        severity: 'متوسط',
        confidence: 81,
        category: 'Analysis',
      },
      actor
    );
    pushDomainAudit(core, { action: 'analysis_run', detail: 'تشغيل التحليل', by: actor, source: 'Analysis', entityId: pred?.id || '' });
    save();
    return { prediction: pred, insight };
  };

  const updateCoreSettings = (patch = {}, actor = 'مشغّل هوب') => {
    const core = coreBag();
    core.settings = Object.assign({}, core.settings || {}, patch);
    pushDomainAudit(core, { action: 'settings_updated', detail: Object.keys(patch).join(', '), by: actor, source: 'Settings' });
    save();
    return core.settings;
  };


  const addCoreInsight = (payload = {}, actor = 'مشغّل هوب') => {
    const core = get().core;
    if (!Array.isArray(core.insights)) core.insights = [];
    const item = {
      id: uid('ins'),
      title: String(payload.title || '').trim(),
      rationale: String(payload.rationale || '').trim(),
      source: payload.source || 'إدخال يدوي',
      confidence: Math.max(0, Math.min(100, Number(payload.confidence) || 60)),
      status: payload.status || 'open',
      at: nowIso(),
      by: actor,
    };
    if (!item.title) return null;
    core.insights.unshift(item);
    pushDomainAudit(core, {
      action: 'insight',
      detail: item.title,
      by: actor,
      source: item.source,
      entityId: item.id,
    });
    save();
    return item;
  };

  const closeCoreInsight = (id, actor = 'مشغّل هوب') => {
    const core = get().core;
    const row = (core.insights || []).find((x) => x.id === id);
    if (!row) return null;
    row.status = 'closed';
    pushDomainAudit(core, {
      action: 'close_insight',
      detail: row.title,
      by: actor,
      source: row.source,
      entityId: row.id,
    });
    save();
    return row;
  };

  // —— Batch B: Clients / Roles / Notifications helpers
  const clientsBag = () => {
    const s = get();
    if (!s.clientsMgmt || s.clientsMgmt.schemaVersion !== 2) s.clientsMgmt = seedClientsMgmt();
    return s.clientsMgmt;
  };

  const rolesBag = () => {
    const s = get();
    if (!s.rolesHub || s.rolesHub.schemaVersion !== 2) s.rolesHub = seedRolesHub();
    return s.rolesHub;
  };

  const recomputeClientCounters = (c) => {
    c.systemsCount = (c.systems || []).length;
    c.openOrders = (c.orders || []).filter((o) => o.status === 'open' || o.status === 'pending').length;
    c.walletTotal = Number(c.wallet?.total ?? c.walletTotal ?? 0);
    return c;
  };

  const upsertClient = (payload = {}, actor = 'مشغّل هوب') => {
    const bag = clientsBag();
    if (!Array.isArray(bag.clients)) bag.clients = [];
    let row = payload.id ? bag.clients.find((x) => x.id === payload.id) : null;
    const stamp = nowIso();
    if (row) {
      ['name', 'email', 'clientId', 'status', 'company', 'country', 'accountLevel', 'source'].forEach((k) => {
        if (payload[k] !== undefined) row[k] = payload[k];
      });
      if (payload.systems) row.systems = payload.systems;
      if (payload.internalNotes) row.internalNotes = payload.internalNotes;
      row.updatedAt = stamp;
      recomputeClientCounters(row);
      pushDomainAudit(bag, {
        action: 'update',
        detail: `تحديث عميل: ${row.name}`,
        by: actor,
        source: row.source || 'Manual',
        entityId: row.id,
      });
    } else {
      row = recomputeClientCounters({
        id: uid('cli'),
        clientId: payload.clientId || `CL-${1000 + bag.clients.length + 1}`,
        name: String(payload.name || '').trim() || 'عميل جديد',
        email: String(payload.email || '').trim().toLowerCase(),
        status: payload.status || 'pending',
        company: payload.company || '',
        country: payload.country || '',
        accountLevel: payload.accountLevel || 'standard',
        systems: payload.systems || [],
        orders: payload.orders || [],
        subscriptions: payload.subscriptions || [],
        invoices: payload.invoices || [],
        wallet: payload.wallet || { paid: 0, free: 0, total: 0, ledger: [] },
        tickets: payload.tickets || [],
        internalNotes: payload.internalNotes || [],
        lastLoginAt: payload.lastLoginAt || '',
        source: payload.source || 'إدخال يدوي',
        createdAt: stamp,
        updatedAt: stamp,
      });
      bag.clients.unshift(row);
      pushDomainAudit(bag, {
        action: 'create',
        detail: `عميل جديد: ${row.name}`,
        by: actor,
        source: row.source,
        entityId: row.id,
      });
    }
    save();
    return row;
  };

  const setClientStatus = (id, status, actor = 'مشغّل هوب') => {
    const bag = clientsBag();
    const row = (bag.clients || []).find((x) => x.id === id || x.email === id);
    if (!row) return null;
    row.status = status;
    row.updatedAt = nowIso();
    pushDomainAudit(bag, {
      action: 'status',
      detail: `${row.name} → ${status}`,
      by: actor,
      source: row.source || 'Manual',
      entityId: row.id,
    });
    save();
    return row;
  };

  const addClientNote = (id, note, actor = 'مشغّل هوب') => {
    const bag = clientsBag();
    const row = (bag.clients || []).find((x) => x.id === id || x.email === id);
    if (!row || !String(note || '').trim()) return null;
    if (!Array.isArray(row.internalNotes)) row.internalNotes = [];
    row.internalNotes.unshift({ by: actor, note: String(note).trim(), at: nowIso() });
    row.updatedAt = nowIso();
    pushDomainAudit(bag, {
      action: 'note',
      detail: `ملاحظة على ${row.name}`,
      by: actor,
      source: 'Internal Notes',
      entityId: row.id,
    });
    save();
    return row;
  };

  const assignClientSystem = (id, { code, name, plan } = {}, actor = 'مشغّل هوب') => {
    const bag = clientsBag();
    const row = (bag.clients || []).find((x) => x.id === id || x.email === id);
    if (!row || !code) return null;
    if (!Array.isArray(row.systems)) row.systems = [];
    row.systems.unshift({
      code: String(code).toUpperCase(),
      name: name || code,
      plan: plan || 'standard',
      status: 'active',
    });
    recomputeClientCounters(row);
    row.updatedAt = nowIso();
    pushDomainAudit(bag, {
      action: 'assign_system',
      detail: `${row.name} ← ${code}`,
      by: actor,
      source: 'Clients',
      entityId: row.id,
    });
    save();
    return row;
  };

  const upsertHubRole = (payload = {}, actor = 'مشغّل هوب') => {
    const bag = rolesBag();
    if (!Array.isArray(bag.roles)) bag.roles = [];
    let row = payload.id ? bag.roles.find((x) => x.id === payload.id) : null;
    const stamp = nowIso();
    if (row) {
      ['code', 'nameAr', 'level', 'status', 'source'].forEach((k) => {
        if (payload[k] !== undefined) row[k] = payload[k];
      });
      if (payload.systems) row.systems = payload.systems;
      if (payload.permissions) row.permissions = payload.permissions;
      row.updatedAt = stamp;
      pushDomainAudit(bag, {
        action: 'update',
        detail: `تحديث دور: ${row.nameAr}`,
        by: actor,
        source: row.source || 'Manual',
        entityId: row.id,
      });
    } else {
      row = {
        id: uid('role'),
        code: String(payload.code || '').trim() || `role_${Date.now().toString(36)}`,
        nameAr: String(payload.nameAr || '').trim() || 'دور جديد',
        level: payload.level || 'employee',
        systems: payload.systems || ['HUB'],
        permissions: payload.permissions || ['read'],
        status: payload.status || 'active',
        source: payload.source || 'إدخال يدوي',
        createdAt: stamp,
        updatedAt: stamp,
      };
      bag.roles.unshift(row);
      pushDomainAudit(bag, {
        action: 'create',
        detail: `دور جديد: ${row.nameAr}`,
        by: actor,
        source: row.source,
        entityId: row.id,
      });
    }
    save();
    return row;
  };

  const assignHubRole = (payload = {}, actor = 'مشغّل هوب') => {
    const bag = rolesBag();
    if (!Array.isArray(bag.assignments)) bag.assignments = [];
    const item = {
      id: uid('ras'),
      userEmail: String(payload.userEmail || '').trim().toLowerCase(),
      userName: String(payload.userName || '').trim() || payload.userEmail || 'مستخدم',
      roleCode: String(payload.roleCode || '').trim(),
      source: payload.source || 'Manual',
      at: nowIso(),
      by: actor,
    };
    if (!item.userEmail || !item.roleCode) return null;
    bag.assignments.unshift(item);
    pushDomainAudit(bag, {
      action: 'assign',
      detail: `${item.userName} ← ${item.roleCode}`,
      by: actor,
      source: item.source,
      entityId: item.id,
    });
    save();
    return item;
  };

  const removeNotification = (id, actor = 'مشغّل هوب') => {
    const s = get();
    if (!Array.isArray(s.notifications)) return null;
    const idx = s.notifications.findIndex((x) => x.id === id);
    if (idx < 0) return null;
    const [n] = s.notifications.splice(idx, 1);
    if (!s.notificationsWs) s.notificationsWs = { schemaVersion: 2, auditLog: [], settings: {} };
    pushDomainAudit(s.notificationsWs, {
      action: 'delete',
      detail: n.title,
      by: actor,
      source: n.sourceName || n.source,
      entityId: n.id,
    });
    save();
    emitNotificationsChanged();
    return n;
  };

  const createHubNotification = (payload = {}, actor = 'مشغّل هوب') => {
    const item = pushNotification({
      ...payload,
      source: payload.source || 'HUB',
      sourceName: payload.sourceName || 'غرفة العمليات',
    });
    if (item) {
      const s = get();
      if (!s.notificationsWs) s.notificationsWs = { schemaVersion: 2, auditLog: [], settings: {} };
      pushDomainAudit(s.notificationsWs, {
        action: 'create',
        detail: item.title,
        by: actor,
        source: item.sourceName,
        entityId: item.id,
      });
      save();
    }
    return item;
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
      { entity: 'الحوكمة', score: avg(Array.isArray(s.governance?.compliance) ? s.governance.compliance : [], 'rate'), level: 'L1' },
    ];
    s.measurement.scores.forEach((row) => {
      row.level = levelOf(row.score);
    });
    if (Array.isArray(s.measurement.indicators)) {
      const taskScore = s.measurement.scores.find((x) => x.entity === 'المهام')?.score || 0;
      const sysScore = s.measurement.scores.find((x) => x.entity === 'الأنظمة')?.score || 0;
      const govScore = s.measurement.scores.find((x) => x.entity === 'الحوكمة')?.score || 0;
      s.measurement.indicators.forEach((ind) => {
        if (/task/i.test(ind.formula) || /مهام/.test(ind.name)) ind.value = taskScore;
        else if (/system|health/i.test(ind.formula) || /أنظمة/.test(ind.name)) ind.value = sysScore;
        else if (/govern|compliance/i.test(ind.formula) || /حوكمة|امتثال/.test(ind.name)) ind.value = govScore;
        ind.updatedAt = nowIso();
      });
    }
    pushDomainAudit(s.measurement, {
      action: 'recalculate',
      detail: 'إعادة حساب الدرجات والمؤشرات',
      by: 'نظام القياس',
      source: 'Measurement Engine',
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
      source: 'System Generated',
      createdBy: 'نظام التقارير',
      body,
    };
    get().reports.generated.unshift(item);
    pushDomainAudit(get().reports, {
      action: 'generate',
      detail: item.title,
      by: item.createdBy,
      source: item.source,
      entityId: item.id,
    });
    recordActivity('report', `${item.title} جاهز للقائد الأعلى`, { type });
    save();
    return item;
  };

  // —— Integration
  const toggleConnector = (id) => {
    const c = get().integration.connectors.find((x) => x.id === id);
    if (!c) return null;
    c.status = c.status === 'connected' ? 'disconnected' : 'connected';
    pushDomainAudit(get().integration, {
      action: 'toggle',
      detail: `${c.name}: ${c.status}`,
      by: 'مشغّل هوب',
      source: c.source || 'Manual',
      entityId: c.id,
    });
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
    g.lastPingAt = nowIso();
    pushDomainAudit(get().integration, {
      action: 'ping',
      detail: `فحص بوابة · ${g.rps} RPS · ${g.latencyMs}ms`,
      by: 'مشغّل هوب',
      source: 'API Gateway',
    });
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

  const toggleMarketplaceSystem = (id, actor = 'مشغّل هوب') => {
    const sys = marketBag().catalog.find((x) => x.id === id);
    if (!sys) return null;
    const old = sys.status;
    let next = 'Active';
    if (normalizeMarketStatus(sys.status) === 'Active') next = 'Suspended';
    else if (normalizeMarketStatus(sys.status) === 'Suspended' || normalizeMarketStatus(sys.status) === 'Draft') next = 'Active';
    else if (normalizeMarketStatus(sys.status) === 'Archived') next = 'Active';
    else next = 'Active';
    return setMarketSystemStatus(id, next, actor) || Object.assign(sys, { status: next, updatedAt: nowIso() });
  };

  const normalizeMarketStatus = (s) => {
    const v = String(s || '').toLowerCase();
    if (v === 'active' || v === 'online') return 'Active';
    if (v === 'stopped' || v === 'suspended' || v === 'degraded') return 'Suspended';
    if (v === 'archived' || v === 'archive') return 'Archived';
    if (v === 'draft' || v === 'beta') return 'Draft';
    if (['Active', 'Suspended', 'Archived', 'Draft'].includes(s)) return s;
    return 'Active';
  };

  const enrichOneMarketSystem = (sys, i = 0) => {
    if (!sys || sys._smEnriched) return sys;
    const code = sys.code || sys.role || `SYS-${String(i + 1).padStart(5, '0')}`;
    const company = sys.companyName || `شركة ${sys.name || 'نايوش'} المحدودة`;
    const plan = sys.plan || (i % 3 === 0 ? 'Enterprise' : i % 3 === 1 ? 'Professional' : 'Basic');
    const seats = Number(sys.seatsAllowed) || (plan === 'Enterprise' ? 100 : plan === 'Professional' ? 50 : 20);
    const userCount = Number(sys.userCount) || Math.max(3, Math.min(seats, 5 + (i % 20)));
    sys.code = code;
    sys.description = sys.description || sys.desc || `نظام تشغيلي ضمن سوق نايوش هوب — ${sys.name || ''}`;
    sys.category = sys.category || sys.role || 'تشغيل';
    sys.owner = sys.owner || sys.assignee || ['سارة العتيبي', 'أحمد الراشد', 'نور فهد', 'مشغّل هوب'][i % 4];
    sys.status = normalizeMarketStatus(sys.status);
    sys.logo = sys.logo || '';
    sys.companyName = company;
    sys.companyNameEn = sys.companyNameEn || `NAIOSH ${code}`;
    sys.companyAddress = sys.companyAddress || 'الرياض · المملكة العربية السعودية';
    sys.companyPhone = sys.companyPhone || sys.party1Phone || `05${String(10000000 + i).slice(0, 8)}`;
    sys.companyPhone2 = sys.companyPhone2 || sys.party2Phone || '';
    sys.companyEmail = sys.companyEmail || `ops@${String(code).toLowerCase()}.naiosh.local`;
    sys.companyWebsite = sys.companyWebsite || 'https://naiosh.local';
    sys.plan = plan;
    sys.subscriptionStart = sys.subscriptionStart || '2026-01-01';
    sys.subscriptionEnd = sys.subscriptionEnd || '2026-12-31';
    sys.seatsAllowed = seats;
    sys.userCount = userCount;
    sys.subscriptionStatus = sys.subscriptionStatus || (sys.status === 'Active' ? 'Active' : 'Paused');
    sys.tenants = Number(sys.tenants) || Math.max(1, Math.floor(userCount / 5));
    sys.source = sys.source || (i % 5 === 0 ? 'Import' : i % 5 === 1 ? 'API' : i % 5 === 2 ? 'Integration' : i % 5 === 3 ? 'Template' : 'Manual');
    sys.createdBy = sys.createdBy || (sys.source === 'Manual' ? 'سارة العتيبي' : 'مزامنة السوق');
    sys.createdAt = sys.createdAt || new Date(Date.now() - (900 - i) * 3600000).toISOString();
    sys.updatedAt = sys.updatedAt || sys.createdAt;
    sys.creationMethod = sys.creationMethod || sys.source;
    sys.importedFrom = sys.importedFrom || (sys.source === 'Import' ? 'Excel Catalog' : '');
    sys.integrationSource = sys.integrationSource || (sys.source === 'Integration' || sys.source === 'API' ? 'Hub Connector' : '');
    sys.lastSync = sys.lastSync || new Date(Date.now() - (i % 48) * 3600000).toISOString();
    if (!Array.isArray(sys.users) || !sys.users.length) {
      sys.users = Array.from({ length: Math.min(userCount, 8) }, (_, u) => ({
        id: `MU-${code}-${u + 1}`,
        name: ['محمد أحمد', 'ليلى كريم', 'يوسف نادر', 'هند الراشد', 'فهد العتيبي', 'دانة الشمري', 'عمر حسن', 'ريم فهد'][u % 8],
        email: `user${u + 1}@${String(code).toLowerCase()}.local`,
        role: u === 0 ? 'Admin' : u % 3 === 0 ? 'Manager' : 'Operator',
        status: u % 7 === 0 ? 'Inactive' : 'Active',
        lastLogin: new Date(Date.now() - u * 7200000).toISOString(),
      }));
      sys.userCount = sys.users.length;
    }
    if (!Array.isArray(sys.integrations) || !sys.integrations.length) {
      sys.integrations = [
        { id: `INT-${code}-ERP`, name: 'ERP', type: 'API', direction: 'Bidirectional', status: 'Connected', lastSync: sys.lastSync },
        { id: `INT-${code}-CRM`, name: 'CRM', type: 'API', direction: 'Inbound', status: i % 4 === 0 ? 'Degraded' : 'Connected', lastSync: sys.lastSync },
      ];
    }
    if (!sys.settings) {
      sys.settings = {
        language: 'ar',
        timezone: 'Asia/Riyadh',
        notifications: true,
        dataRetentionDays: 365,
        auditEnabled: true,
        mfaRequired: false,
      };
    }
    if (!Array.isArray(sys.auditLog)) sys.auditLog = [];
    if (!Array.isArray(sys.activityLog)) {
      sys.activityLog = [
        { id: uid('sact'), type: 'Sync', text: 'مزامنة دورية', at: sys.lastSync, user: 'النظام' },
        { id: uid('sact'), type: 'Login', text: 'دخول مستخدم', at: sys.updatedAt, user: sys.users[0]?.name || 'مستخدم' },
      ];
    }
    sys._smEnriched = true;
    return sys;
  };

  const recomputeMarketKpis = (market = get().empire?.marketplace) => {
    if (!market) return market;
    const list = (market.catalog || []).filter((s) => !s.archived);
    market.totalSystems = list.length;
    market.activeSystems = list.filter((s) => normalizeMarketStatus(s.status) === 'Active').length;
    market.suspendedSystems = list.filter((s) => normalizeMarketStatus(s.status) === 'Suspended').length;
    market.draftSystems = list.filter((s) => normalizeMarketStatus(s.status) === 'Draft').length;
    market.archivedSystems = (market.catalog || []).filter((s) => s.archived || normalizeMarketStatus(s.status) === 'Archived').length;
    return market;
  };

  const hydrateSystemsMarketplace = () => {
    const empire = state?.empire;
    if (!empire) return false;
    if (!empire.marketplace) empire.marketplace = { catalog: [] };
    const market = empire.marketplace;
    let changed = false;
    if (market.schemaVersion !== 2) {
      market.schemaVersion = 2;
      market.helpDismissed = false;
      market.categories = market.categories || ['تشغيل', 'حوكمة', 'معرفة', 'مالية', 'موارد بشرية', 'تكامل', 'أخرى'];
      market.plans = market.plans || ['Basic', 'Professional', 'Enterprise'];
      market.settings = market.settings || {
        defaultPlan: 'Professional',
        defaultSeats: 25,
        requireApproval: false,
        pageSize: 25,
      };
      if (!Array.isArray(market.auditLog)) market.auditLog = [];
      if (!Array.isArray(market.activityLog)) market.activityLog = [];
      if (!Array.isArray(market.catalog)) market.catalog = [];
      changed = true;
    }
    (market.catalog || []).forEach((sys, i) => {
      const before = sys._smEnriched;
      enrichOneMarketSystem(sys, i);
      if (!before) changed = true;
    });
    // ensure the unified OS exists for the critical test scenario
    if (!(market.catalog || []).some((s) => String(s.name || '').includes('التشغيلي الموحد'))) {
      market.catalog.unshift(
        enrichOneMarketSystem(
          {
            id: uid('mk'),
            name: 'النظام التشغيلي الموحد',
            code: 'UOS',
            category: 'تشغيل',
            status: 'Active',
            source: 'Manual',
            createdBy: 'مشغّل هوب',
          },
          0
        )
      );
      changed = true;
    }
    // pad demo volume for pagination UX if catalog is small
    if ((market.catalog || []).filter((s) => !s.archived).length < 40) {
      const base = market.catalog.length;
      const cats = market.categories || ['تشغيل'];
      const plans = market.plans || ['Basic', 'Professional', 'Enterprise'];
      for (let i = base; i < 48; i++) {
        market.catalog.push(
          enrichOneMarketSystem(
            {
              id: uid('mk'),
              name: `نظام تشغيلي تجريبي ${i + 1}`,
              code: `DEMO-${String(i + 1).padStart(3, '0')}`,
              category: cats[i % cats.length],
              plan: plans[i % plans.length],
              status: i % 11 === 0 ? 'Draft' : i % 9 === 0 ? 'Suspended' : 'Active',
              source: ['Manual', 'Import', 'API', 'Integration', 'Template'][i % 5],
            },
            i
          )
        );
      }
      changed = true;
    }
    recomputeMarketKpis(market);
    return changed;
  };

  const marketBag = () => {
    const s = get();
    if (!s.empire) s.empire = {};
    if (!s.empire.marketplace) s.empire.marketplace = { catalog: [], schemaVersion: 0 };
    if (s.empire.marketplace.schemaVersion !== 2) {
      // allow hydrate when state already loaded
      const prev = state;
      state = s;
      hydrateSystemsMarketplace();
      state = prev || s;
    }
    return s.empire.marketplace;
  };

  const pushMarketAudit = (entry = {}) => {
    const market = marketBag();
    if (!Array.isArray(market.auditLog)) market.auditLog = [];
    const row = {
      id: entry.id || nextSecSeq(market.auditLog, 'SYS-TX'),
      user: entry.user || 'مشغّل هوب',
      action: entry.action || 'تعديل النظام',
      systemId: entry.systemId || '',
      system: entry.system || '',
      field: entry.field || '',
      oldValue: entry.oldValue ?? '',
      newValue: entry.newValue ?? '',
      at: nowIso(),
      source: entry.source || 'Manual',
    };
    market.auditLog.unshift(row);
    if (market.auditLog.length > 800) market.auditLog.length = 800;
    const sys = (market.catalog || []).find((x) => x.id === entry.systemId);
    if (sys) {
      if (!Array.isArray(sys.auditLog)) sys.auditLog = [];
      sys.auditLog.unshift({ ...row });
      if (sys.auditLog.length > 200) sys.auditLog.length = 200;
    }
    return row;
  };

  const pushMarketActivity = (entry = {}) => {
    const market = marketBag();
    if (!Array.isArray(market.activityLog)) market.activityLog = [];
    const row = {
      id: entry.id || uid('sact'),
      type: entry.type || 'Activity',
      text: entry.text || '',
      systemId: entry.systemId || '',
      system: entry.system || '',
      user: entry.user || 'النظام',
      at: nowIso(),
    };
    market.activityLog.unshift(row);
    if (market.activityLog.length > 500) market.activityLog.length = 500;
    const sys = (market.catalog || []).find((x) => x.id === entry.systemId);
    if (sys) {
      if (!Array.isArray(sys.activityLog)) sys.activityLog = [];
      sys.activityLog.unshift(row);
    }
    return row;
  };

  const updateMarketSystem = (id, patch = {}, actor = 'مشغّل هوب') => {
    const market = marketBag();
    const sys = (market.catalog || []).find((x) => x.id === id);
    if (!sys) return { error: 'النظام غير موجود' };
    const tracked = [
      'name',
      'code',
      'description',
      'category',
      'status',
      'owner',
      'logo',
      'companyName',
      'companyNameEn',
      'companyAddress',
      'companyPhone',
      'companyPhone2',
      'companyEmail',
      'companyWebsite',
      'plan',
      'subscriptionStart',
      'subscriptionEnd',
      'seatsAllowed',
      'subscriptionStatus',
    ];
    const changes = [];
    tracked.forEach((k) => {
      if (patch[k] === undefined) return;
      const oldVal = sys[k];
      const newVal = patch[k];
      if (String(oldVal ?? '') === String(newVal ?? '')) return;
      changes.push({ field: k, oldValue: oldVal, newValue: newVal });
    });
    if (patch.name !== undefined && !String(patch.name || '').trim()) {
      return { error: 'اسم النظام مطلوب', field: 'name' };
    }
    if (patch.companyName !== undefined && !String(patch.companyName || '').trim()) {
      return { error: 'اسم الشركة مطلوب', field: 'companyName' };
    }
    if (patch.code !== undefined && !String(patch.code || '').trim()) {
      return { error: 'رمز النظام مطلوب', field: 'code' };
    }
    Object.assign(sys, patch, { updatedAt: nowIso(), status: patch.status ? normalizeMarketStatus(patch.status) : sys.status });
    if (patch.companyName) sys.companyName = patch.companyName;
    changes.forEach((c) => {
      pushMarketAudit({
        user: actor,
        action: 'تعديل النظام',
        systemId: sys.id,
        system: sys.name,
        field: c.field,
        oldValue: c.oldValue,
        newValue: c.newValue,
      });
    });
    if (!changes.length && Object.keys(patch).length) {
      pushMarketAudit({
        user: actor,
        action: 'تعديل النظام',
        systemId: sys.id,
        system: sys.name,
        field: 'meta',
        newValue: 'updated',
      });
    }
    pushMarketActivity({ type: 'Update', text: `تحديث بيانات النظام (${changes.length} حقل)`, systemId: sys.id, system: sys.name, user: actor });
    recomputeMarketKpis(market);
    pushFeed('decision', `تحديث نظام السوق: ${sys.name}`);
    save();
    return { ok: true, system: sys, changes };
  };

  const setMarketSystemStatus = (id, status, actor = 'مشغّل هوب') => {
    const sys = marketBag().catalog.find((x) => x.id === id);
    if (!sys) return null;
    const next = normalizeMarketStatus(status);
    const old = sys.status;
    sys.status = next;
    if (next === 'Archived') sys.archived = true;
    if (next === 'Active') sys.archived = false;
    sys.updatedAt = nowIso();
    pushMarketAudit({
      user: actor,
      action: next === 'Suspended' ? 'إيقاف النظام' : next === 'Active' ? 'تفعيل النظام' : next === 'Archived' ? 'أرشفة النظام' : 'تغيير الحالة',
      systemId: sys.id,
      system: sys.name,
      field: 'status',
      oldValue: old,
      newValue: next,
    });
    recomputeMarketKpis();
    save();
    return sys;
  };

  const cloneMarketSystem = (id, actor = 'مشغّل هوب') => {
    const src = marketBag().catalog.find((x) => x.id === id);
    if (!src) return null;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = uid('mk');
    copy.name = `${src.name} (نسخة)`;
    copy.code = `${src.code || 'SYS'}-COPY`;
    copy.status = 'Draft';
    copy.createdAt = nowIso();
    copy.updatedAt = nowIso();
    copy.createdBy = actor;
    copy.source = 'Manual';
    copy.creationMethod = 'Manual';
    copy.auditLog = [];
    copy._smEnriched = true;
    marketBag().catalog.unshift(copy);
    pushMarketAudit({ user: actor, action: 'نسخ النظام', systemId: copy.id, system: copy.name, newValue: src.id });
    recomputeMarketKpis();
    save();
    return copy;
  };

  const addMarketSystemUser = (systemId, user = {}, actor = 'مشغّل هوب') => {
    const sys = marketBag().catalog.find((x) => x.id === systemId);
    if (!sys) return null;
    if (!Array.isArray(sys.users)) sys.users = [];
    const row = {
      id: uid('mu'),
      name: user.name || 'مستخدم جديد',
      email: user.email || '',
      role: user.role || 'Operator',
      status: user.status || 'Active',
      lastLogin: '',
    };
    sys.users.unshift(row);
    sys.userCount = sys.users.length;
    pushMarketAudit({ user: actor, action: 'إضافة مستخدم للنظام', systemId: sys.id, system: sys.name, newValue: row.email || row.name });
    save();
    return row;
  };

  const syncMarketIntegration = (systemId, integrationId, actor = 'مشغّل هوب') => {
    const sys = marketBag().catalog.find((x) => x.id === systemId);
    if (!sys) return null;
    const integ = (sys.integrations || []).find((x) => x.id === integrationId);
    if (!integ) return null;
    integ.lastSync = nowIso();
    integ.status = 'Connected';
    sys.lastSync = integ.lastSync;
    pushMarketActivity({ type: 'Sync', text: `مزامنة ${integ.name}`, systemId: sys.id, system: sys.name, user: actor });
    pushMarketAudit({ user: actor, action: 'مزامنة تكامل', systemId: sys.id, system: sys.name, field: integ.name, newValue: 'Connected' });
    save();
    return integ;
  };

  const testMarketIntegration = (systemId, integrationId, actor = 'مشغّل هوب') => {
    const sys = marketBag().catalog.find((x) => x.id === systemId);
    const integ = (sys?.integrations || []).find((x) => x.id === integrationId);
    if (!integ) return { ok: false, error: 'التكامل غير موجود' };
    integ.status = 'Connected';
    pushMarketActivity({ type: 'Test', text: `اختبار اتصال ${integ.name} ناجح`, systemId: sys.id, system: sys.name, user: actor });
    save();
    return { ok: true, integration: integ };
  };

  const updateMarketSettings = (patch = {}, actor = 'مشغّل هوب') => {
    const market = marketBag();
    if (!market.settings) market.settings = {};
    Object.assign(market.settings, patch);
    pushMarketAudit({ user: actor, action: 'تعديل إعدادات السوق', newValue: JSON.stringify(patch) });
    save();
    return market.settings;
  };

  const dismissMarketHelp = () => {
    marketBag().helpDismissed = true;
    save();
  };

  const importMarketSystems = (rows = [], actor = 'مشغّل هوب') => {
    const created = [];
    let invalid = 0;
    let duplicates = 0;
    const market = marketBag();
    rows.forEach((row) => {
      const name = String(row.name || '').trim();
      if (!name) {
        invalid += 1;
        return;
      }
      if ((market.catalog || []).some((s) => s.name === name && !s.archived)) {
        duplicates += 1;
        return;
      }
      created.push(
        addMarketSystem(
          {
            name,
            code: row.code || '',
            category: row.category || 'تشغيل',
            companyName: row.companyName || row.company || '',
            plan: row.plan || 'Professional',
            source: 'Import',
            creationMethod: 'Import',
            importedFrom: 'CSV/Excel',
          },
          actor
        )
      );
    });
    pushMarketAudit({ user: actor, action: 'استيراد أنظمة', newValue: `imported=${created.length}; invalid=${invalid}; dup=${duplicates}` });
    recomputeMarketKpis();
    save();
    return { created, invalid, duplicates };
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
    const normalized =
      window.HubPurchase?.normalizeIncomingPayload?.(payload) || payload || {};
    const title = normalized.title || normalized.name || '';
    if (!title) return null;
    const connectors = window.HubMarketplaceData?.MARKETPLACE_CONNECTORS || [];
    const marketplaces = Array.isArray(normalized.marketplaces)
      ? normalized.marketplaces
      : parseMarketplacePayload(normalized, connectors);
    const purchaseType = String(normalized.purchaseType || 'INTERNAL').toUpperCase() === 'EXTERNAL'
      ? 'EXTERNAL'
      : 'INTERNAL';
    const productUrl = (normalized.productUrl || normalized.url || '').trim();
    const item = {
      id: uid('st'),
      title,
      name: title,
      desc: normalized.desc || normalized.description || normalized.shortDesc || '',
      brand: normalized.brand || 'نايوش هوب',
      platform: normalized.platform || normalized.platformCode || 'هوب',
      price: Number(normalized.price != null ? normalized.price : normalized.priceUsd) || 0,
      currency: 'USD',
      points: Number(normalized.points) || 0,
      category: normalized.category || 'تشغيل',
      platformCode: normalized.platformCode || '',
      stock: Number(normalized.stock != null ? normalized.stock : normalized.quantity) || 10,
      sku: normalized.sku || `ST-${Date.now().toString().slice(-6)}`,
      itemKind: normalized.itemKind || normalized.kind || 'منتج',
      status: normalized.status === 'pending_review' ? 'pending_review' : 'active',
      badge: normalized.badge || (normalized.itemKind === 'خدمة' ? 'خدمة' : 'جديد'),
      marketplaces,
      purchaseType,
      productUrl: purchaseType === 'EXTERNAL' ? productUrl : '',
      storeId: normalized.storeId || '',
      storeName: normalized.storeName || '',
      submissionId: normalized.submissionId || '',
      mirrorToCatalog: normalized.mirrorToCatalog !== false,
      ...pickCommonMeta(normalized),
    };
    store.items.unshift(item);
    pushFeed('decision', `رفع على المتجر: ${item.title} · ${item.purchaseType}`);

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
        currency: 'USD',
        stock: item.stock,
        sold: 0,
        status: item.status === 'pending_review' ? 'بانتظار المراجعة' : 'متوفر',
        movement: 'متوسط',
        icon: item.itemKind === 'خدمة' ? 'fa-concierge-bell' : 'fa-bag-shopping',
        storeItemId: item.id,
        itemKind: item.itemKind,
        purchaseType: item.purchaseType,
        productUrl: item.productUrl,
        storeId: item.storeId,
        storeName: item.storeName,
        marketplaces: item.marketplaces,
        ...pickCommonMeta(normalized),
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
    if (ad.workflowStatus && !['active', 'approved'].includes(ad.workflowStatus)) return false;
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

  const nextAdCode = () => {
    const year = new Date().getFullYear();
    const listings = get().empire?.adsStudio?.listings || [];
    let max = 0;
    listings.forEach((ad) => {
      const m = String(ad.adCode || ad.id || '').match(new RegExp(`^AD-${year}-(\\d+)$`));
      if (m) max = Math.max(max, Number(m[1]));
    });
    return `AD-${year}-${String(max + 1).padStart(5, '0')}`;
  };

  const pushAdActivity = (ad, message, actor = 'نظام') => {
    if (!ad) return;
    if (!Array.isArray(ad.activity)) ad.activity = [];
    ad.activity.unshift({ at: nowIso(), message, actor });
  };

  const placementsToTargets = (placements = [], position = 'top') => {
    const list = Array.isArray(placements) ? placements : [];
    const targets = { home: false, offices: [], branches: [], incubators: [], platforms: [] };
    const places = [];
    list.forEach((p) => {
      const key = String(p || '').toLowerCase();
      if (key === 'home' || key === 'الصفحة الرئيسية') {
        targets.home = true;
        places.push('main_interface');
      } else if (key === 'products' || key === 'صفحة المنتجات') {
        targets.platforms = targets.platforms.length ? targets.platforms : ['*'];
        places.push('products');
      } else if (key === 'store' || key === 'المتجر') {
        targets.platforms = targets.platforms.length ? targets.platforms : ['*'];
        places.push('store');
      } else if (key === 'articles' || key === 'المقالات') {
        targets.home = true;
        places.push('articles');
      } else if (key === 'services' || key === 'الخدمات') {
        targets.platforms = targets.platforms.length ? targets.platforms : ['*'];
        places.push('services');
      } else if (key === 'incubators' || key === 'الحاضنات') {
        targets.incubators = ['*'];
        places.push('incubator_home');
      } else if (key === 'branches' || key === 'الفروع') {
        targets.branches = ['*'];
        places.push('branch_home');
      } else if (key === 'custom' || key === 'صفحة محددة') {
        targets.home = true;
        places.push('custom');
      }
    });
    if (position) places.push(`pos_${position}`);
    if (
      !targets.home &&
      !targets.offices.length &&
      !targets.branches.length &&
      !targets.incubators.length &&
      !targets.platforms.length
    ) {
      targets.home = true;
      places.push('main_interface');
    }
    return { publishTargets: targets, appearancePlaces: places };
  };

  const resolveWorkflowStatus = (ad) => {
    if (!ad) return 'draft';
    if (ad.workflowStatus) return ad.workflowStatus;
    if (ad.publishStatus === 'draft') return 'draft';
    if (ad.status === 'paused') return 'paused';
    if (ad.status === 'active') return 'active';
    if (ad.status === 'archived' || ad.status === 'deleted') return 'ended';
    return ad.status || 'draft';
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
    let appearancePlaces = normalizeList(payload.appearancePlaces);
    let socialShares = normalizeList(payload.socialShares);
    let publishTargets = normalizePublishTargets(payload);
    if (Array.isArray(payload.placements) && payload.placements.length) {
      const mapped = placementsToTargets(payload.placements, payload.position || 'top');
      publishTargets = mapped.publishTargets;
      appearancePlaces = mapped.appearancePlaces.concat(appearancePlaces);
    }
    if (
      !publishTargets.home &&
      !publishTargets.offices.length &&
      !publishTargets.branches.length &&
      !publishTargets.incubators.length &&
      !publishTargets.platforms.length
    ) {
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
        publishTargets.home = true;
      }
    }
    const productType = payload.productType || payload.itemKind || 'رقمية';
    const desc = payload.desc || payload.description || payload.content || payload.bodyText || '';
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
    const workflowStatus =
      payload.workflowStatus ||
      (publishStatus === 'draft'
        ? 'draft'
        : publishStatus === 'deferred'
          ? 'scheduled'
          : statusMap[publishStatus] === 'active'
            ? 'active'
            : 'paused');
    const actor =
      payload.createdBy ||
      window.HubAuth?.getUser?.()?.email ||
      window.HubAuth?.getUser?.()?.name ||
      'عميل';
    const ad = {
      id: uid('ad'),
      adCode: payload.adCode || nextAdCode(),
      title: payload.title,
      headline: payload.headline || payload.title || '',
      content: desc,
      desc,
      bodyText: payload.bodyText || desc,
      price: Number(payload.price) || 0,
      category: payload.category || 'عام',
      subcategory: payload.subcategory || '',
      productType,
      itemKind: productType,
      contentType: payload.contentType || 'image',
      mediaDataUrl: payload.mediaDataUrl || payload.imageDataUrl || '',
      mediaName: payload.mediaName || '',
      mediaSize: payload.mediaSize || 0,
      thumbnailDataUrl: payload.thumbnailDataUrl || '',
      destinationUrl: payload.destinationUrl || payload.ctaUrl || '',
      ctaLabel: payload.ctaLabel || '',
      fileAction: payload.fileAction || 'open',
      placements: Array.isArray(payload.placements) ? payload.placements.slice() : [],
      position: payload.position || 'top',
      audience: payload.audience || 'all',
      audienceDetail: payload.audienceDetail || '',
      scheduleMode: payload.scheduleMode || 'immediate',
      platformCode: payload.platformCode || '',
      productId: payload.productId || '',
      views: Number(payload.views) || 0,
      impressions: Number(payload.impressions) || 0,
      clicks: Number(payload.clicks) || 0,
      status: statusMap[publishStatus] || payload.status || 'active',
      publishStatus,
      workflowStatus,
      rejectionReason: payload.rejectionReason || '',
      requestId: payload.requestId || '',
      level: payload.level || 'متوسط',
      adLevel,
      type: adType,
      brand: payload.brand || payload.companyName || 'نايوش هوب',
      adStartDate: payload.adStartDate || '',
      adEndDate: payload.adEndDate || '',
      adStartTime: payload.adStartTime || '',
      adEndTime: payload.adEndTime || '',
      appearancePlaces,
      socialShares,
      publishTargets,
      scope: payload.scope || deriveAdScope(publishTargets),
      assignee: '',
      createdBy: actor,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      activity: [],
      ...pickCommonMeta(payload),
    };
    pushAdActivity(ad, 'تم إنشاء الإعلان', actor);
    if (workflowStatus === 'pending_review') pushAdActivity(ad, 'تم إرساله للمراجعة', actor);
    studio.listings.unshift(ad);
    const label =
      publishStatus === 'deferred'
        ? 'تأجيل نشر إعلان'
        : publishStatus === 'draft'
          ? 'مسودة إعلان'
          : workflowStatus === 'pending_review'
            ? 'إعلان بانتظار المراجعة'
            : 'إعلان جديد';
    pushFeed('decision', `${label}: ${ad.title}`);
    save();
    try {
      if (workflowStatus === 'pending_review' && window.HubCustomerRequests?.ensureForAd) {
        const req = window.HubCustomerRequests.ensureForAd(ad, actor);
        if (req?.id) {
          ad.requestId = req.id;
          save();
        }
      }
    } catch (_) {}
    return ad;
  };

  const updateAdListing = (id, patch = {}, actor = 'عميل') => {
    const ad = get().empire.adsStudio?.listings?.find((x) => x.id === id || x.adCode === id);
    if (!ad) return null;
    const next = Object.assign({}, patch);
    if (Array.isArray(next.placements) && next.placements.length) {
      const mapped = placementsToTargets(next.placements, next.position || ad.position || 'top');
      next.publishTargets = mapped.publishTargets;
      next.appearancePlaces = mapped.appearancePlaces;
      next.scope = deriveAdScope(mapped.publishTargets);
    }
    Object.assign(ad, next, { updatedAt: nowIso() });
    if (ad.status === 'active' && (patch.title || patch.mediaDataUrl || patch.destinationUrl || patch.placements)) {
      ad.workflowStatus = 'pending_review';
      ad.publishStatus = 'draft';
      ad.status = 'paused';
      pushAdActivity(ad, 'تعديل جوهري — بانتظار مراجعة التعديل', actor);
      try {
        if (window.HubCustomerRequests?.ensureForAd) {
          const req = window.HubCustomerRequests.ensureForAd(ad, actor);
          if (req?.id) ad.requestId = req.id;
        }
      } catch (_) {}
    } else {
      pushAdActivity(ad, 'تم حفظ التعديلات', actor);
    }
    save();
    return ad;
  };

  const setAdWorkflowStatus = (id, workflowStatus, extra = {}, actor = 'Admin') => {
    const ad = get().empire.adsStudio?.listings?.find((x) => x.id === id || x.adCode === id);
    if (!ad) return null;
    ad.workflowStatus = workflowStatus;
    ad.updatedAt = nowIso();
    if (workflowStatus === 'active' || workflowStatus === 'approved') {
      const start = ad.adStartDate ? new Date(ad.adStartDate) : null;
      const now = new Date();
      const startIsFuture = start && !Number.isNaN(start.getTime()) && start.getTime() > now.getTime();
      ad.approvedBy = extra.approvedBy || actor;
      ad.approvedAt = extra.approvedAt || nowIso();
      if (startIsFuture) {
        ad.workflowStatus = 'scheduled';
        ad.publishStatus = 'deferred';
        ad.status = 'paused';
        pushAdActivity(ad, 'تمت الموافقة — مجدول للبدء', actor);
      } else {
        ad.workflowStatus = 'active';
        ad.publishStatus = 'published';
        ad.status = 'active';
        pushAdActivity(ad, 'تمت الموافقة وبدأ النشر', actor);
      }
    } else if (workflowStatus === 'paused') {
      ad.status = 'paused';
      ad.publishStatus = ad.publishStatus === 'published' ? 'deferred' : ad.publishStatus;
      pushAdActivity(ad, 'تم إيقاف الإعلان', actor);
    } else if (workflowStatus === 'rejected') {
      ad.status = 'paused';
      ad.publishStatus = 'draft';
      ad.rejectionReason = extra.rejectionReason || ad.rejectionReason || '';
      pushAdActivity(ad, `مرفوض: ${ad.rejectionReason || 'بدون سبب'}`, actor);
    } else if (workflowStatus === 'ended' || workflowStatus === 'deleted') {
      ad.status = 'archived';
      ad.workflowStatus = workflowStatus === 'deleted' ? 'ended' : 'ended';
      pushAdActivity(ad, workflowStatus === 'deleted' ? 'تم حذف الإعلان' : 'انتهى الإعلان', actor);
    } else if (workflowStatus === 'pending_review') {
      ad.status = 'paused';
      ad.publishStatus = 'draft';
      pushAdActivity(ad, 'بانتظار المراجعة', actor);
    }
    Object.assign(ad, extra);
    save();
    return ad;
  };

  const toggleAd = (id) => {
    const ad = get().empire.adsStudio?.listings?.find((x) => x.id === id);
    if (!ad) return null;
    if (ad.status === 'active') {
      return setAdWorkflowStatus(id, 'paused', {}, 'عميل');
    }
    ad.status = 'active';
    ad.workflowStatus = 'active';
    ad.publishStatus = 'published';
    pushAdActivity(ad, 'تم تشغيل الإعلان', 'عميل');
    pushFeed('decision', `إعلان · ${ad.title}: active`);
    save();
    return ad;
  };

  const addEvent = (payload = {}) => {
    const studio = get().empire.eventsStudio;
    if (!studio) return null;
    if (!Array.isArray(studio.events)) studio.events = [];
    const year = new Date().getFullYear();
    const seq = studio.events.length + 1;
    const eventCode = payload.eventCode || `EVT-${year}-${String(seq).padStart(5, '0')}`;
    const pricing = payload.pricing === 'paid' || Number(payload.priceUsd) > 0 ? 'paid' : 'free';
    const workflowStatus = payload.workflowStatus || payload.status || 'draft';
    const event = {
      id: payload.id || uid('ev'),
      eventCode,
      name: payload.name || payload.title || 'فعالية',
      title: payload.name || payload.title || 'فعالية',
      category: payload.category || 'أخرى',
      summary: payload.summary || payload.description || '',
      description: payload.description || payload.summary || '',
      coverImage: payload.coverImage || payload.image || '',
      date: payload.date || today(),
      startTime: payload.startTime || payload.time || '18:00',
      endTime: payload.endTime || '',
      time: payload.startTime || payload.time || '18:00',
      attendanceType: payload.attendanceType || 'online',
      country: payload.country || '',
      city: payload.city || '',
      address: payload.address || '',
      mapsUrl: payload.mapsUrl || '',
      onlineUrl: payload.onlineUrl || '',
      locationLabel:
        payload.locationLabel ||
        (payload.attendanceType === 'online'
          ? 'أونلاين'
          : [payload.city, payload.country].filter(Boolean).join('، ') || payload.platform || '—'),
      requiresRegistration: payload.requiresRegistration !== false,
      pricing,
      priceUsd: pricing === 'paid' ? Number(payload.priceUsd) || 0 : 0,
      seats: payload.seats != null && payload.seats !== '' ? Number(payload.seats) : null,
      seatsTaken: Number(payload.seatsTaken) || 0,
      registrationEnds: payload.registrationEnds || '',
      organizerName: payload.organizerName || payload.speaker || 'منظم الفعالية',
      organizerEmail: payload.organizerEmail || '',
      organizerPhone: payload.organizerPhone || '',
      organizerWebsite: payload.organizerWebsite || '',
      speaker: payload.organizerName || payload.speaker || 'منظم الفعالية',
      platform: payload.platform || 'استوديو الفعاليات',
      type: payload.type || payload.category || 'فعالية',
      duration: payload.duration || '',
      department: payload.department || 'التسويق',
      assignee: payload.assignee || '',
      workflowStatus,
      status:
        workflowStatus === 'published' || workflowStatus === 'approved'
          ? 'قادمة'
          : workflowStatus === 'ended'
            ? 'منتهية'
            : workflowStatus === 'draft'
              ? 'مسودة'
              : workflowStatus === 'pending_review'
                ? 'بانتظار المراجعة'
                : workflowStatus === 'needs_changes'
                  ? 'تحتاج تعديل'
                  : workflowStatus === 'rejected'
                    ? 'مرفوض'
                    : workflowStatus === 'paused'
                      ? 'متوقف'
                      : payload.status || 'مسودة',
      createdBy: payload.createdBy || 'عميل',
      createdAt: payload.createdAt || nowIso(),
      updatedAt: nowIso(),
      requestId: payload.requestId || '',
      rejectionReason: payload.rejectionReason || '',
      changeRequestNote: payload.changeRequestNote || '',
      cancellationPolicy: payload.cancellationPolicy || 'يمكن الإلغاء قبل 24 ساعة من موعد الفعالية.',
      ...pickCommonMeta(payload),
    };
    studio.events.unshift(event);
    pushFeed('decision', `فعالية جديدة: ${event.name}`);
    save();
    try {
      if (event.workflowStatus === 'pending_review' && window.HubCustomerRequests?.ensureForEvent) {
        const req = window.HubCustomerRequests.ensureForEvent(event, event.createdBy || 'عميل');
        if (req?.id) {
          event.requestId = req.id;
          save();
        }
      }
    } catch (_) {}
    return event;
  };

  const updateEvent = (id, patch = {}, actor = 'عميل') => {
    const studio = get().empire.eventsStudio;
    if (!studio?.events) return null;
    const idx = studio.events.findIndex((e) => e.id === id || e.eventCode === id);
    if (idx < 0) return null;
    const prev = studio.events[idx];
    const next = Object.assign({}, prev, patch, { updatedAt: nowIso() });
    if (patch.name) next.title = patch.name;
    if (patch.startTime) next.time = patch.startTime;
    if (patch.pricing === 'free') next.priceUsd = 0;
    if (patch.workflowStatus) {
      const w = patch.workflowStatus;
      next.status =
        w === 'published' || w === 'approved'
          ? 'قادمة'
          : w === 'ended'
            ? 'منتهية'
            : w === 'draft'
              ? 'مسودة'
              : w === 'pending_review'
                ? 'بانتظار المراجعة'
                : w === 'needs_changes'
                  ? 'تحتاج تعديل'
                  : w === 'rejected'
                    ? 'مرفوض'
                    : w === 'paused'
                      ? 'متوقف'
                      : next.status;
    }
    studio.events[idx] = next;
    save();
    try {
      if (
        (next.workflowStatus === 'pending_review' || next.workflowStatus === 'published') &&
        window.HubCustomerRequests?.ensureForEvent
      ) {
        window.HubCustomerRequests.ensureForEvent(next, actor);
      }
    } catch (_) {}
    return next;
  };

  const setEventWorkflowStatus = (id, workflowStatus, extra = {}, actor = 'Admin') => {
    return updateEvent(id, Object.assign({ workflowStatus }, extra), actor);
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

  const addMarketSystem = (payload = {}, actor = 'مشغّل هوب') => {
    const market = marketBag();
    if (!market.catalog) market.catalog = [];
    const name = String(payload.name || '').trim();
    if (!name) return null;
    const item = enrichOneMarketSystem(
      {
        id: uid('mk'),
        name,
        code: payload.code || nextSecSeq(market.catalog, 'SYS'),
      category: payload.category || 'تشغيل',
      tenants: Number(payload.tenants) || 1,
        status: payload.status || (payload.draft ? 'Draft' : 'Active'),
        description: payload.description || '',
        owner: payload.owner || actor,
        companyName: payload.companyName || '',
        companyNameEn: payload.companyNameEn || '',
        companyAddress: payload.companyAddress || '',
        companyPhone: payload.companyPhone || '',
        companyPhone2: payload.companyPhone2 || '',
        companyEmail: payload.companyEmail || '',
        companyWebsite: payload.companyWebsite || '',
        plan: payload.plan || market.settings?.defaultPlan || 'Professional',
        seatsAllowed: Number(payload.seatsAllowed) || market.settings?.defaultSeats || 25,
        userCount: Number(payload.userCount) || 0,
        subscriptionStart: payload.subscriptionStart || nowIso().slice(0, 10),
        subscriptionEnd: payload.subscriptionEnd || '',
        source: payload.source || 'Manual',
        creationMethod: payload.creationMethod || payload.source || 'Manual',
        createdBy: actor,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        users: payload.users || [],
        integrations: payload.integrations || [],
      ...pickCommonMeta(payload),
      },
      market.catalog.length
    );
    market.catalog.unshift(item);
    pushMarketAudit({ user: actor, action: 'إنشاء نظام', systemId: item.id, system: item.name, newValue: item.status, source: item.source });
    pushMarketActivity({ type: 'Create', text: `إنشاء النظام ${item.name}`, systemId: item.id, system: item.name, user: actor });
    recomputeMarketKpis(market);
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

  const secBag = () => {
    const s = get();
    if (!s.infoSecurity || s.infoSecurity.schemaVersion !== 2) {
      s.infoSecurity = seedInfoSecurity();
    }
    return s.infoSecurity;
  };

  const pushSecurityAudit = (entry = {}) => {
    const sec = secBag();
    if (!Array.isArray(sec.auditLog)) sec.auditLog = [];
    const row = {
      id: uid('secaud'),
      user: entry.user || 'مشغّل هوب',
      action: entry.action || 'تعديل',
      entityType: entry.entityType || '',
      entityId: entry.entityId || '',
      entityLabel: entry.entityLabel || entry.entityId || '',
      at: nowIso(),
      oldValue: entry.oldValue ?? '',
      newValue: entry.newValue ?? '',
    };
    sec.auditLog.unshift(row);
    if (sec.auditLog.length > 500) sec.auditLog.length = 500;
    return row;
  };

  const pushSecurityNotice = (entry = {}) => {
    const sec = secBag();
    if (!Array.isArray(sec.notifications)) sec.notifications = [];
    const row = {
      id: uid('secn'),
      type: entry.type || 'info',
      title: entry.title || 'تنبيه أمني',
      body: entry.body || '',
      at: nowIso(),
      read: false,
      linkId: entry.linkId || '',
    };
    sec.notifications.unshift(row);
    if (sec.notifications.length > 100) sec.notifications.length = 100;
    pushNotification({
      source: 'SEC',
      sourceName: 'أمن المعلومات',
      title: row.title,
      body: row.body,
      level: entry.level || (entry.type === 'critical_incident' || entry.type === 'critical_risk' ? 'critical' : 'warning'),
      category: 'security',
      link: 'dashboard.html#info-security',
      meta: { linkId: row.linkId, type: row.type },
    });
    return row;
  };

  const riskLevelFromScore = (score) => {
    if (score >= 20) return 'حرج';
    if (score >= 12) return 'مرتفع';
    if (score >= 6) return 'متوسط';
    return 'منخفض';
  };

  const toggleSecurityControl = (id) => {
    const c = secBag().controls?.find((x) => x.id === id);
    if (!c) return null;
    const old = c.status;
    if (c.status === 'implemented' || c.status === 'active') c.status = 'needs_review';
    else if (c.status === 'partial') c.status = 'implemented';
    else if (c.status === 'not_implemented' || c.status === 'paused') c.status = 'partial';
    else c.status = 'implemented';
    pushSecurityAudit({
      user: 'مشغّل هوب',
      action: 'تعديل حالة ضابط',
      entityType: 'control',
      entityId: c.id,
      entityLabel: c.name,
      oldValue: old,
      newValue: c.status,
    });
    recomputeInfoSecurityKpis();
    pushFeed('alert', `أمن المعلومات · ${c.name}: ${c.status}`);
    save();
    return c;
  };

  const addSecurityIncident = (payload = {}, actor = 'مشغّل هوب') => {
    const sec = secBag();
    if (!Array.isArray(sec.incidents)) sec.incidents = [];
    const discoveredAt = payload.discoveredAt || nowIso();
    const slaHours = Number(payload.slaHours || ({ حرج: 4, مرتفع: 8, متوسط: 24, منخفض: 72 }[payload.severity] || 24));
    const item = {
      id: nextSecSeq(sec.incidents, 'INC'),
      title: payload.title || 'حادث أمني',
      type: payload.type || 'أخرى',
      severity: payload.severity || 'متوسط',
      status: payload.draft ? 'مسودة' : payload.status || 'جديد',
      department: payload.department || '',
      owner: payload.owner || '',
      discoveredAt,
      createdAt: nowIso(),
      source: payload.source || 'إدخال يدوي',
      description: payload.description || '',
      initialActions: payload.initialActions || '',
      sensitiveData: !!payload.sensitiveData,
      tags: Array.isArray(payload.tags)
        ? payload.tags
        : String(payload.tags || '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
      slaHours,
      slaDueAt: new Date(new Date(discoveredAt).getTime() + slaHours * 3600000).toISOString(),
      timeline: [{ at: nowIso(), by: actor, text: payload.draft ? 'حفظ كمسودة' : 'تسجيل الحادث' }],
      actionsTaken: payload.initialActions ? [{ at: nowIso(), by: actor, text: payload.initialActions }] : [],
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
      rootCause: '',
      resolution: '',
      correctiveActions: [],
      preventiveActions: [],
      notes: [],
      relatedRisks: payload.relatedRisks || [],
      relatedControls: payload.relatedControls || [],
      archived: false,
      draft: !!payload.draft,
    };
    sec.incidents.unshift(item);
    pushSecurityAudit({
      user: actor,
      action: item.draft ? 'حفظ مسودة حادث' : 'إنشاء حادث',
      entityType: 'incident',
      entityId: item.id,
      entityLabel: item.title,
      newValue: item.status,
    });
    if (!item.draft && (item.severity === 'حرج' || item.severity === 'مرتفع')) {
      pushSecurityNotice({
        type: item.severity === 'حرج' ? 'critical_incident' : 'incident',
        title: item.severity === 'حرج' ? 'تسجيل Incident حرج' : 'حادث أمني جديد',
        body: `${item.id} — ${item.title}`,
        linkId: item.id,
        level: item.severity === 'حرج' ? 'critical' : 'warning',
      });
    }
    if (item.owner) {
      pushSecurityNotice({
        type: 'assignment',
        title: 'تعيين حادث أمني',
        body: `تم تعيين ${item.id} إلى ${item.owner}`,
        linkId: item.id,
      });
    }
    recomputeInfoSecurityKpis();
    pushFeed('alert', `حادث أمني: ${item.id} · ${item.title}`);
    save();
    return item;
  };

  const updateSecurityIncident = (id, patch = {}, actor = 'مشغّل هوب') => {
    const sec = secBag();
    const inc = sec.incidents?.find((x) => x.id === id);
    if (!inc) return null;
    const tracked = ['status', 'severity', 'owner', 'title', 'type', 'department', 'source', 'description', 'rootCause', 'resolution'];
    tracked.forEach((key) => {
      if (patch[key] === undefined || patch[key] === inc[key]) return;
      pushSecurityAudit({
        user: actor,
        action: `تعديل ${key}`,
        entityType: 'incident',
        entityId: inc.id,
        entityLabel: inc.title,
        oldValue: String(inc[key] ?? ''),
        newValue: String(patch[key] ?? ''),
      });
      if (!Array.isArray(inc.timeline)) inc.timeline = [];
      inc.timeline.push({ at: nowIso(), by: actor, text: `تحديث ${key}: ${patch[key]}` });
    });
    Object.assign(inc, patch);
    if (patch.status === 'مغلق' || patch.status === 'closed') {
      inc.closedAt = nowIso();
      inc.status = 'مغلق';
    }
    if (Array.isArray(patch.correctiveActions)) inc.correctiveActions = patch.correctiveActions;
    if (Array.isArray(patch.preventiveActions)) inc.preventiveActions = patch.preventiveActions;
    if (Array.isArray(patch.relatedRisks)) inc.relatedRisks = patch.relatedRisks;
    if (Array.isArray(patch.relatedControls)) inc.relatedControls = patch.relatedControls;
    recomputeInfoSecurityKpis();
    save();
    return inc;
  };

  const closeSecurityIncident = (id, resolution = {}, actor = 'مشغّل هوب') => {
    const inc = secBag().incidents?.find((x) => x.id === id);
    if (!inc) return null;
    if (!resolution.rootCause || !resolution.resolution || !resolution.correctiveAction) {
      return { error: 'قبل الإغلاق يجب تسجيل السبب الجذري والحل والإجراء التصحيحي' };
    }
    const old = inc.status;
    inc.rootCause = resolution.rootCause;
    inc.resolution = resolution.resolution;
    if (!Array.isArray(inc.correctiveActions)) inc.correctiveActions = [];
    inc.correctiveActions.push(resolution.correctiveAction);
    if (resolution.preventiveAction) {
      if (!Array.isArray(inc.preventiveActions)) inc.preventiveActions = [];
      inc.preventiveActions.push(resolution.preventiveAction);
    }
    inc.status = 'مغلق';
    inc.closedAt = nowIso();
    if (!Array.isArray(inc.timeline)) inc.timeline = [];
    inc.timeline.push({ at: nowIso(), by: actor, text: 'إغلاق الحادث' });
    pushSecurityAudit({
      user: actor,
      action: 'إغلاق حادث',
      entityType: 'incident',
      entityId: inc.id,
      entityLabel: inc.title,
      oldValue: old,
      newValue: 'مغلق',
    });
    recomputeInfoSecurityKpis();
    pushFeed('alert', `إغلاق حادثة أمنية: ${inc.title}`);
    save();
    return inc;
  };

  const reopenSecurityIncident = (id, actor = 'مشغّل هوب') => {
    const inc = secBag().incidents?.find((x) => x.id === id);
    if (!inc) return null;
    const old = inc.status;
    inc.status = 'قيد التحقيق';
    inc.closedAt = '';
    if (!Array.isArray(inc.timeline)) inc.timeline = [];
    inc.timeline.push({ at: nowIso(), by: actor, text: 'إعادة فتح الحادث' });
    pushSecurityAudit({
      user: actor,
      action: 'إعادة فتح حادث',
      entityType: 'incident',
      entityId: inc.id,
      entityLabel: inc.title,
      oldValue: old,
      newValue: 'قيد التحقيق',
    });
    recomputeInfoSecurityKpis();
    save();
    return inc;
  };

  const addSecurityIncidentNote = (id, text, actor = 'مشغّل هوب') => {
    const inc = secBag().incidents?.find((x) => x.id === id);
    if (!inc || !text) return null;
    if (!Array.isArray(inc.notes)) inc.notes = [];
    inc.notes.push({ at: nowIso(), by: actor, text });
    if (!Array.isArray(inc.timeline)) inc.timeline = [];
    inc.timeline.push({ at: nowIso(), by: actor, text: `تعليق: ${text}` });
    pushSecurityAudit({
      user: actor,
      action: 'إضافة تعليق',
      entityType: 'incident',
      entityId: inc.id,
      entityLabel: inc.title,
      newValue: text,
    });
    save();
    return inc;
  };

  const addSecurityIncidentAction = (id, text, actor = 'مشغّل هوب') => {
    const inc = secBag().incidents?.find((x) => x.id === id);
    if (!inc || !text) return null;
    if (!Array.isArray(inc.actionsTaken)) inc.actionsTaken = [];
    inc.actionsTaken.push({ at: nowIso(), by: actor, text });
    if (!Array.isArray(inc.timeline)) inc.timeline = [];
    inc.timeline.push({ at: nowIso(), by: actor, text: `إجراء: ${text}` });
    pushSecurityAudit({
      user: actor,
      action: 'تسجيل إجراء',
      entityType: 'incident',
      entityId: inc.id,
      entityLabel: inc.title,
      newValue: text,
    });
    save();
    return inc;
  };

  const addSecurityAttachment = (entityType, id, fileName, actor = 'مشغّل هوب') => {
    const sec = secBag();
    const listKey = entityType === 'control' ? 'controls' : entityType === 'risk' ? 'risks' : 'incidents';
    const row = sec[listKey]?.find((x) => x.id === id);
    if (!row || !fileName) return null;
    if (!Array.isArray(row.attachments)) row.attachments = [];
    row.attachments.push({ name: fileName, at: nowIso(), by: actor });
    if (entityType === 'incident') {
      if (!Array.isArray(row.timeline)) row.timeline = [];
      row.timeline.push({ at: nowIso(), by: actor, text: `مرفق: ${fileName}` });
    }
    pushSecurityAudit({
      user: actor,
      action: 'إضافة مرفق',
      entityType,
      entityId: row.id,
      entityLabel: row.title || row.name,
      newValue: fileName,
    });
    save();
    return row;
  };

  const archiveSecurityIncident = (id, actor = 'مشغّل هوب') => {
    const inc = secBag().incidents?.find((x) => x.id === id);
    if (!inc) return null;
    inc.archived = true;
    pushSecurityAudit({
      user: actor,
      action: 'أرشفة حادث',
      entityType: 'incident',
      entityId: inc.id,
      entityLabel: inc.title,
      newValue: 'archived',
    });
    recomputeInfoSecurityKpis();
    save();
    return inc;
  };

  const addSecurityControl = (payload = {}, actor = 'مشغّل هوب') => {
    const sec = secBag();
    if (!Array.isArray(sec.controls)) sec.controls = [];
    const item = {
      id: nextSecSeq(sec.controls, 'CTRL'),
      name: payload.name || 'ضابط أمني',
      category: payload.category || 'متوسطة',
      framework: payload.framework || 'Internal Control',
      compliance: Number(payload.compliance || 0),
      status: payload.status || 'partial',
      owner: payload.owner || '',
      lastReview: payload.lastReview || today(),
      nextReview: payload.nextReview || '',
      description: payload.description || '',
      evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
      relatedRisks: payload.relatedRisks || [],
      relatedIncidents: payload.relatedIncidents || [],
      reviewHistory: [{ at: nowIso().slice(0, 10), by: actor, note: 'إنشاء الضابط' }],
      attachments: [],
      archived: false,
    };
    sec.controls.unshift(item);
    pushSecurityAudit({
      user: actor,
      action: 'إنشاء ضابط أمني',
      entityType: 'control',
      entityId: item.id,
      entityLabel: item.name,
      newValue: item.status,
    });
    recomputeInfoSecurityKpis();
    save();
    return item;
  };

  const updateSecurityControl = (id, patch = {}, actor = 'مشغّل هوب') => {
    const c = secBag().controls?.find((x) => x.id === id);
    if (!c) return null;
    ['name', 'category', 'framework', 'compliance', 'status', 'owner', 'nextReview', 'description'].forEach((key) => {
      if (patch[key] === undefined || patch[key] === c[key]) return;
      pushSecurityAudit({
        user: actor,
        action: `تعديل ضابط (${key})`,
        entityType: 'control',
        entityId: c.id,
        entityLabel: c.name,
        oldValue: String(c[key] ?? ''),
        newValue: String(patch[key] ?? ''),
      });
    });
    Object.assign(c, patch);
    if (patch.compliance !== undefined) c.compliance = Number(patch.compliance);
    recomputeInfoSecurityKpis();
    save();
    return c;
  };

  const archiveSecurityControl = (id, actor = 'مشغّل هوب') => {
    const c = secBag().controls?.find((x) => x.id === id);
    if (!c) return null;
    c.archived = true;
    pushSecurityAudit({
      user: actor,
      action: 'أرشفة ضابط',
      entityType: 'control',
      entityId: c.id,
      entityLabel: c.name,
      newValue: 'archived',
    });
    recomputeInfoSecurityKpis();
    save();
    return c;
  };

  const addSecurityRisk = (payload = {}, actor = 'مشغّل هوب') => {
    const sec = secBag();
    if (!Array.isArray(sec.risks)) sec.risks = [];
    const likelihood = Number(payload.likelihood || 1);
    const impact = Number(payload.impact || 1);
    const score = likelihood * impact;
    const item = {
      id: nextSecSeq(sec.risks, 'RISK'),
      name: payload.name || 'خطر أمني',
      category: payload.category || 'عام',
      likelihood,
      impact,
      score,
      level: riskLevelFromScore(score),
      department: payload.department || '',
      owner: payload.owner || '',
      treatmentPlan: payload.treatmentPlan || '',
      targetDate: payload.targetDate || '',
      status: payload.status || 'مفتوح',
      relatedControls: payload.relatedControls || [],
      relatedIncidents: payload.relatedIncidents || [],
      description: payload.description || '',
      attachments: [],
      archived: false,
    };
    sec.risks.unshift(item);
    pushSecurityAudit({
      user: actor,
      action: 'إنشاء خطر',
      entityType: 'risk',
      entityId: item.id,
      entityLabel: item.name,
      newValue: item.level,
    });
    if (item.level === 'حرج') {
      pushSecurityNotice({
        type: 'critical_risk',
        title: 'خطر حرج',
        body: `${item.id} — ${item.name}`,
        linkId: item.id,
        level: 'critical',
      });
    }
    recomputeInfoSecurityKpis();
    save();
    return item;
  };

  const updateSecurityRisk = (id, patch = {}, actor = 'مشغّل هوب') => {
    const r = secBag().risks?.find((x) => x.id === id);
    if (!r) return null;
    Object.keys(patch).forEach((key) => {
      if (patch[key] === undefined || patch[key] === r[key]) return;
      pushSecurityAudit({
        user: actor,
        action: `تعديل خطر (${key})`,
        entityType: 'risk',
        entityId: r.id,
        entityLabel: r.name,
        oldValue: String(r[key] ?? ''),
        newValue: String(patch[key] ?? ''),
      });
    });
    Object.assign(r, patch);
    if (patch.likelihood !== undefined || patch.impact !== undefined) {
      r.likelihood = Number(patch.likelihood ?? r.likelihood);
      r.impact = Number(patch.impact ?? r.impact);
      r.score = r.likelihood * r.impact;
      r.level = riskLevelFromScore(r.score);
    }
    recomputeInfoSecurityKpis();
    save();
    return r;
  };

  const archiveSecurityRisk = (id, actor = 'مشغّل هوب') => {
    const r = secBag().risks?.find((x) => x.id === id);
    if (!r) return null;
    r.archived = true;
    pushSecurityAudit({
      user: actor,
      action: 'أرشفة خطر',
      entityType: 'risk',
      entityId: r.id,
      entityLabel: r.name,
      newValue: 'archived',
    });
    recomputeInfoSecurityKpis();
    save();
    return r;
  };

  const markSecurityNoticeRead = (id) => {
    const n = secBag().notifications?.find((x) => x.id === id);
    if (!n) return null;
    n.read = true;
    save();
    return n;
  };

  const dgBag = () => {
    const s = get();
    if (!s.dataGovernance || s.dataGovernance.schemaVersion !== 2) {
      s.dataGovernance = seedDataGovernance();
    }
    return s.dataGovernance;
  };

  const pushDgAudit = (entry = {}) => {
    const dg = dgBag();
    if (!Array.isArray(dg.auditLog)) dg.auditLog = [];
    const row = {
      id: entry.id || nextSecSeq(dg.auditLog, 'TXN-DG'),
      user: entry.user || 'مشغّل هوب',
      action: entry.action || 'تعديل',
      module: entry.module || 'data-governance',
      entityType: entry.entityType || '',
      entityId: entry.entityId || '',
      entityLabel: entry.entityLabel || entry.entityId || '',
      at: nowIso(),
      oldValue: entry.oldValue ?? '',
      newValue: entry.newValue ?? '',
      status: entry.status || 'ok',
      session: entry.session || '',
    };
    dg.auditLog.unshift(row);
    if (dg.auditLog.length > 500) dg.auditLog.length = 500;
    return row;
  };

  const toggleDataCatalog = (id) => {
    const row = (dgBag().assets || dgBag().catalogs || []).find((x) => x.id === id);
    if (!row) return null;
    const old = row.status;
    if (row.status === 'approved' || row.status === 'active') row.status = 'review';
    else row.status = 'approved';
    pushDgAudit({ action: 'تغيير حالة أصل', entityType: 'asset', entityId: row.id, entityLabel: row.name, oldValue: old, newValue: row.status });
    recomputeDataGovernanceKpis();
    pushFeed('compliance', `حوكمة البيانات · ${row.name}: ${row.status}`);
    save();
    return row;
  };

  const activateDataPolicy = (id) => {
    const p = dgBag().policies?.find((x) => x.id === id);
    if (!p) return null;
    const old = p.status;
    p.status = 'active';
    pushDgAudit({ action: 'تفعيل سياسة', entityType: 'policy', entityId: p.id, entityLabel: p.name || p.title, oldValue: old, newValue: 'active' });
    pushFeed('compliance', `تفعيل سياسة بيانات: ${p.name || p.title}`);
    save();
    return p;
  };

  const addDataSource = (payload = {}, actor = 'مشغّل هوب') => {
    const dg = dgBag();
    if (!Array.isArray(dg.sources)) dg.sources = [];
    const item = {
      id: nextSecSeq(dg.sources, 'SRC'),
      name: payload.name || 'مصدر بيانات',
      type: payload.type || 'Other',
      system: payload.system || '',
      environment: payload.environment || 'Production',
      status: payload.status || 'connected',
      lastSync: nowIso(),
      assetsCount: 0,
      owner: payload.owner || '',
      syncMethod: payload.syncMethod || 'Manual',
      host: payload.host || '',
      port: Number(payload.port || 0),
      database: payload.database || '',
      authType: payload.authType || 'Service Account',
      schedule: payload.schedule || 'عند الطلب',
      archived: false,
    };
    dg.sources.unshift(item);
    pushDgAudit({ user: actor, action: 'إضافة مصدر بيانات', entityType: 'source', entityId: item.id, entityLabel: item.name, newValue: item.status });
    recomputeDataGovernanceKpis();
    save();
    return item;
  };

  const updateDataSource = (id, patch = {}, actor = 'مشغّل هوب') => {
    const s = dgBag().sources?.find((x) => x.id === id);
    if (!s) return null;
    Object.keys(patch).forEach((k) => {
      if (patch[k] === undefined || patch[k] === s[k]) return;
      pushDgAudit({ user: actor, action: `تعديل مصدر (${k})`, entityType: 'source', entityId: s.id, entityLabel: s.name, oldValue: String(s[k] ?? ''), newValue: String(patch[k] ?? '') });
    });
    Object.assign(s, patch);
    recomputeDataGovernanceKpis();
    save();
    return s;
  };

  const testDataSourceConnection = (id, actor = 'مشغّل هوب') => {
    const s = dgBag().sources?.find((x) => x.id === id);
    if (!s) return null;
    const old = s.status;
    // Demo: fail if type mentions expired/failed host patterns, else connect
    if (/fail|expired|bad/i.test(`${s.host} ${s.name}`)) s.status = 'failed';
    else if (s.status === 'failed') s.status = 'connected';
    else s.status = Math.random() > 0.15 ? 'connected' : 'failed';
    s.lastSync = nowIso();
    pushDgAudit({ user: actor, action: 'Test Connection', entityType: 'source', entityId: s.id, entityLabel: s.name, oldValue: old, newValue: s.status });
    recomputeDataGovernanceKpis();
    save();
    return s;
  };

  const scanDataSource = (id, actor = 'مشغّل هوب') => {
    const dg = dgBag();
    const s = dg.sources?.find((x) => x.id === id);
    if (!s) return null;
    if (s.status !== 'connected') return { error: 'الاتصال غير ناجح — اختبر الاتصال أولاً' };
    if (!Array.isArray(dg.assets)) dg.assets = [];
    const discovered = {
      id: nextSecSeq(dg.assets, 'AST'),
      name: `اكتشاف من ${s.name}`,
      businessName: `Scanned · ${s.name}`,
      type: 'Table',
      description: `أصل مكتشف تلقائياً عبر Scan للمصدر ${s.name}`,
      technicalDescription: `${s.database || s.host || s.name}.scanned_table`,
      sourceId: s.id,
      sourceName: s.name,
      system: s.system,
      database: s.database || '',
      schema: 'public',
      tableName: 'scanned_table',
      location: `${s.database || s.host}/scanned_table`,
      department: s.system || '',
      owner: s.owner || '',
      steward: '',
      technicalOwner: actor,
      classification: '',
      sensitivity: 'Operational',
      quality: 70,
      status: 'review',
      metadataCompletion: 40,
      retentionPolicy: '',
      tags: ['scanned'],
      fields: [
        { name: 'id', businessName: 'المعرّف', dataType: 'varchar', nullable: false, pk: true, classification: 'داخلي', sensitive: false, quality: 100 },
      ],
      lineage: {
        upstream: [{ id: uid('ln'), name: s.name, type: 'Source' }],
        node: { id: uid('ln'), name: `اكتشاف من ${s.name}`, type: 'Dataset' },
        downstream: [],
      },
      classifiedBy: '',
      classificationDate: '',
      nextReview: '',
      createdBy: actor,
      createdAt: nowIso(),
      updatedBy: actor,
      updatedAt: nowIso(),
      comments: [],
      attachments: [],
      archived: false,
      draft: false,
    };
    dg.assets.unshift(discovered);
    s.assetsCount = (s.assetsCount || 0) + 1;
    s.lastSync = nowIso();
    pushDgAudit({ user: actor, action: 'تشغيل Scan', entityType: 'source', entityId: s.id, entityLabel: s.name, newValue: discovered.id });
    recomputeDataGovernanceKpis();
    save();
    return { source: s, asset: discovered };
  };

  const addDataAsset = (payload = {}, actor = 'مشغّل هوب') => {
    const dg = dgBag();
    if (!Array.isArray(dg.assets)) dg.assets = [];
    const draft = !!payload.draft;
    const submit = !!payload.submitApproval;
    const item = {
      id: nextSecSeq(dg.assets, 'AST'),
      name: payload.name || 'أصل بيانات',
      businessName: payload.businessName || payload.name || '',
      type: payload.type || 'Table',
      description: payload.description || '',
      technicalDescription: payload.technicalDescription || '',
      sourceId: payload.sourceId || '',
      sourceName: payload.sourceName || '',
      system: payload.system || '',
      database: payload.database || '',
      schema: payload.schema || '',
      tableName: payload.tableName || '',
      location: payload.location || '',
      department: payload.department || '',
      owner: payload.owner || '',
      steward: payload.steward || '',
      technicalOwner: payload.technicalOwner || '',
      classification: payload.classification || '',
      sensitivity: payload.sensitivity || '',
      quality: Number(payload.quality || 70),
      status: draft ? 'draft' : submit ? 'pending_approval' : 'review',
      metadataCompletion: Number(payload.metadataCompletion || 50),
      retentionPolicy: payload.retentionPolicy || '',
      tags: Array.isArray(payload.tags)
        ? payload.tags
        : String(payload.tags || '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
      fields: Array.isArray(payload.fields) ? payload.fields : [],
      lineage: payload.lineage || {
        upstream: payload.sourceName ? [{ id: uid('ln'), name: payload.sourceName, type: 'Source' }] : [],
        node: { id: uid('ln'), name: payload.name || 'أصل', type: 'Dataset' },
        downstream: [],
      },
      classifiedBy: payload.classification ? actor : '',
      classificationDate: payload.classification ? nowIso().slice(0, 10) : '',
      nextReview: payload.nextReview || '',
      createdBy: actor,
      createdAt: nowIso(),
      updatedBy: actor,
      updatedAt: nowIso(),
      comments: [],
      attachments: [],
      archived: false,
      draft,
    };
    dg.assets.unshift(item);
    if (submit) {
      if (!Array.isArray(dg.approvals)) dg.approvals = [];
      dg.approvals.unshift({
        id: nextSecSeq(dg.approvals, 'APR'),
        type: 'اعتماد أصل بيانات',
        assetId: item.id,
        entityLabel: item.name,
        requestedBy: actor,
        assignedTo: item.owner || 'الحوكمة',
        date: nowIso(),
        status: 'pending',
        comment: '',
      });
    }
    pushDgAudit({
      user: actor,
      action: draft ? 'حفظ مسودة أصل' : submit ? 'إرسال أصل للاعتماد' : 'إضافة أصل بيانات',
      entityType: 'asset',
      entityId: item.id,
      entityLabel: item.name,
      newValue: item.status,
    });
    recomputeDataGovernanceKpis();
    save();
    return item;
  };

  const updateDataAsset = (id, patch = {}, actor = 'مشغّل هوب') => {
    const a = dgBag().assets?.find((x) => x.id === id);
    if (!a) return null;
    Object.keys(patch).forEach((k) => {
      if (patch[k] === undefined || patch[k] === a[k]) return;
      pushDgAudit({
        user: actor,
        action: `تعديل أصل (${k})`,
        entityType: 'asset',
        entityId: a.id,
        entityLabel: a.name,
        oldValue: typeof a[k] === 'object' ? JSON.stringify(a[k]) : String(a[k] ?? ''),
        newValue: typeof patch[k] === 'object' ? JSON.stringify(patch[k]) : String(patch[k] ?? ''),
      });
    });
    Object.assign(a, patch, { updatedBy: actor, updatedAt: nowIso() });
    recomputeDataGovernanceKpis();
    save();
    return a;
  };

  const archiveDataAsset = (id, actor = 'مشغّل هوب') => {
    const a = dgBag().assets?.find((x) => x.id === id);
    if (!a) return null;
    a.archived = true;
    pushDgAudit({ user: actor, action: 'أرشفة أصل بيانات', entityType: 'asset', entityId: a.id, entityLabel: a.name, newValue: 'archived' });
    recomputeDataGovernanceKpis();
    save();
    return a;
  };

  const addDgPolicy = (payload = {}, actor = 'مشغّل هوب') => {
    const dg = dgBag();
    if (!Array.isArray(dg.policies)) dg.policies = [];
    const item = {
      id: nextSecSeq(dg.policies, 'POL-DG'),
      name: payload.name || payload.title || 'سياسة بيانات',
      title: payload.title || payload.name || 'سياسة بيانات',
      category: payload.category || 'عام',
      appliesTo: payload.appliesTo || payload.scope || '',
      owner: payload.owner || actor,
      effectiveDate: payload.effectiveDate || nowIso().slice(0, 10),
      reviewDate: payload.reviewDate || '',
      status: payload.status || 'draft',
      version: payload.version || '1.0',
      scope: payload.scope || '',
    };
    dg.policies.unshift(item);
    pushDgAudit({ user: actor, action: 'إنشاء سياسة', entityType: 'policy', entityId: item.id, entityLabel: item.name, newValue: item.status });
    save();
    return item;
  };

  const updateDgPolicy = (id, patch = {}, actor = 'مشغّل هوب') => {
    const p = dgBag().policies?.find((x) => x.id === id);
    if (!p) return null;
    Object.assign(p, patch);
    pushDgAudit({ user: actor, action: 'تعديل سياسة', entityType: 'policy', entityId: p.id, entityLabel: p.name || p.title, newValue: p.status });
    save();
    return p;
  };

  const addQualityRule = (payload = {}, actor = 'مشغّل هوب') => {
    const dg = dgBag();
    if (!Array.isArray(dg.qualityRules)) dg.qualityRules = [];
    const item = {
      id: nextSecSeq(dg.qualityRules, 'QR'),
      name: payload.name || 'قاعدة جودة',
      assetId: payload.assetId || '',
      field: payload.field || '',
      ruleType: payload.ruleType || 'Completeness',
      condition: payload.condition || '',
      threshold: Number(payload.threshold || 95),
      severity: payload.severity || 'متوسط',
      owner: payload.owner || actor,
      schedule: payload.schedule || 'يومياً',
      passed: 0,
      failed: 0,
      lastRun: '',
      nextRun: '',
      status: 'active',
    };
    dg.qualityRules.unshift(item);
    pushDgAudit({ user: actor, action: 'إضافة قاعدة جودة', entityType: 'quality_rule', entityId: item.id, entityLabel: item.name, newValue: item.condition });
    save();
    return item;
  };

  const runQualityCheck = (ruleId, actor = 'مشغّل هوب') => {
    const dg = dgBag();
    const rule = dg.qualityRules?.find((x) => x.id === ruleId);
    if (!rule) return null;
    rule.passed = Math.floor(800 + Math.random() * 400);
    rule.failed = Math.floor(Math.random() * 40);
    rule.lastRun = nowIso();
    rule.nextRun = new Date(Date.now() + 86400000).toISOString();
    if (rule.failed > 0) {
      if (!Array.isArray(dg.qualityIssues)) dg.qualityIssues = [];
      const asset = dg.assets?.find((a) => a.id === rule.assetId);
      dg.qualityIssues.unshift({
        id: nextSecSeq(dg.qualityIssues, 'QI'),
        assetId: rule.assetId,
        dataset: asset?.name || rule.assetId,
        field: rule.field,
        ruleId: rule.id,
        rule: rule.name,
        severity: rule.severity,
        failedRecords: rule.failed,
        owner: rule.owner,
        detectedAt: nowIso(),
        status: 'New',
      });
    }
    pushDgAudit({ user: actor, action: 'تشغيل فحص جودة', entityType: 'quality_rule', entityId: rule.id, entityLabel: rule.name, newValue: `failed=${rule.failed}` });
    recomputeDataGovernanceKpis();
    save();
    return rule;
  };

  const updateQualityIssue = (id, patch = {}, actor = 'مشغّل هوب') => {
    const issue = dgBag().qualityIssues?.find((x) => x.id === id);
    if (!issue) return null;
    const old = issue.status;
    Object.assign(issue, patch);
    pushDgAudit({
      user: actor,
      action: patch.status ? `تحديث مشكلة جودة → ${patch.status}` : 'تحديث مشكلة جودة',
      entityType: 'quality_issue',
      entityId: issue.id,
      entityLabel: issue.rule || issue.id,
      oldValue: old,
      newValue: issue.status,
    });
    recomputeDataGovernanceKpis();
    save();
    return issue;
  };

  const decideDgApproval = (id, decision, comment = '', actor = 'مشغّل هوب') => {
    const dg = dgBag();
    const apr = dg.approvals?.find((x) => x.id === id);
    if (!apr) return null;
    if (decision === 'reject' && !String(comment || '').trim()) return { error: 'التعليق إجباري عند الرفض' };
    const old = apr.status;
    apr.status = decision === 'approve' ? 'approved' : decision === 'changes' ? 'changes_requested' : 'rejected';
    apr.comment = comment || '';
    apr.decidedBy = actor;
    apr.decidedAt = nowIso();
    if (apr.assetId && decision === 'approve') {
      const asset = dg.assets?.find((a) => a.id === apr.assetId);
      if (asset) {
        asset.status = 'approved';
        asset.updatedBy = actor;
        asset.updatedAt = nowIso();
      }
    }
    pushDgAudit({
      user: actor,
      action: decision === 'approve' ? 'اعتماد' : decision === 'changes' ? 'طلب تعديل' : 'رفض',
      entityType: 'approval',
      entityId: apr.id,
      entityLabel: apr.entityLabel,
      oldValue: old,
      newValue: apr.status,
    });
    recomputeDataGovernanceKpis();
    save();
    return apr;
  };

  const updateDgSettings = (patch = {}, actor = 'مشغّل هوب') => {
    const dg = dgBag();
    if (!dg.settings) dg.settings = {};
    Object.assign(dg.settings, patch);
    pushDgAudit({ user: actor, action: 'تعديل إعدادات حوكمة البيانات', entityType: 'settings', entityId: 'settings', entityLabel: 'Settings', newValue: JSON.stringify(patch) });
    save();
    return dg.settings;
  };

  const importDataAssets = (rows = [], actor = 'مشغّل هوب') => {
    const created = [];
    rows.forEach((row) => {
      created.push(
        addDataAsset(
          {
            name: row.name || row.assetName,
            type: row.type || 'Table',
            description: row.description || 'مستورد',
            system: row.system || '',
            department: row.department || '',
            owner: row.owner || '',
            steward: row.steward || '',
            classification: row.classification || '',
            sourceName: row.source || 'Import',
            draft: false,
          },
          actor
        )
      );
    });
    pushDgAudit({ user: actor, action: 'استيراد بيانات', entityType: 'import', entityId: `IMP-${Date.now()}`, entityLabel: `${created.length} أصل`, newValue: String(created.length) });
    recomputeDataGovernanceKpis();
    save();
    return created;
  };

  const autoBag = () => {
    const s = get();
    if (!s.systemsAutomation || s.systemsAutomation.schemaVersion !== 2) {
      s.systemsAutomation = seedSystemsAutomation();
    }
    return s.systemsAutomation;
  };

  const pushAutoAudit = (entry = {}) => {
    const sa = autoBag();
    if (!Array.isArray(sa.auditLog)) sa.auditLog = [];
    const row = {
      id: entry.id || nextSecSeq(sa.auditLog, 'TXN-AUTO'),
      user: entry.user || 'مشغّل هوب',
      action: entry.action || 'تعديل',
      automationId: entry.automationId || '',
      automationName: entry.automationName || '',
      at: nowIso(),
      oldValue: entry.oldValue ?? '',
      newValue: entry.newValue ?? '',
    };
    sa.auditLog.unshift(row);
    if (sa.auditLog.length > 500) sa.auditLog.length = 500;
    return row;
  };

  const findAutomation = (id) => {
    const sa = autoBag();
    return (sa.automations || sa.flows || []).find((x) => x.id === id) || null;
  };

  const toggleAutomationFlow = (id, actor = 'مشغّل هوب') => {
    const f = findAutomation(id);
    if (!f) return null;
    const old = f.status;
    f.status = f.status === 'active' ? 'paused' : 'active';
    f.updatedBy = actor;
    f.updatedAt = nowIso();
    pushAutoAudit({
      user: actor,
      action: f.status === 'active' ? 'تفعيل أتمتة' : 'إيقاف أتمتة',
      automationId: f.id,
      automationName: f.name,
      oldValue: old,
      newValue: f.status,
    });
    recomputeAutomationKpis();
    pushFeed('decision', `أتمتة · ${f.name}: ${f.status}`);
    save();
    return f;
  };

  const runAutomationFlow = (id, opts = {}, actor = 'مشغّل هوب') => {
    const sa = autoBag();
    const f = findAutomation(id);
    if (!f) return null;
    if (f.status === 'draft') return { error: 'لا يمكن تشغيل مسودة — فعّل الأتمتة أولاً' };
    if (!Array.isArray(sa.executions)) sa.executions = [];
    const start = nowIso();
    const steps = [];
    const actions = f.actions?.length
      ? f.actions
      : [{ type: 'run', label: 'تنفيذ الأتمتة' }];
    steps.push({ name: 'استلام المحفز', ok: true, at: start, detail: opts.triggeredBy || actor || 'تشغيل يدوي' });
    if (f.conditions?.length) {
      steps.push({
        name: 'فحص الشروط',
        ok: true,
        at: nowIso(),
        detail: f.conditions.map((c) => `${c.field} ${c.op} ${c.value}`).join(' AND '),
      });
    }
    let failed = false;
    let error = '';
    // Demo fail if LMS connection error and automation uses LMS
    const badConn = (sa.connections || []).find((c) => c.status === 'Error' && (f.systems || []).includes(c.system));
    actions.forEach((act, idx) => {
      const useFail = badConn && /مزامنة LMS|LMS/i.test(act.label || '') && !opts.forceSuccess;
      const forceFail = opts.forceFailStep === idx;
      const ok = !(useFail || forceFail);
      if (!ok && !failed) {
        failed = true;
        error = useFail ? badConn.lastError || 'فشل الاتصال' : `فشل في الخطوة: ${act.label}`;
      }
      steps.push({
        name: act.label || act.type,
        ok: !failed || (ok && !failed),
        at: nowIso(),
        detail: ok && !failed ? 'OK' : error || 'Failed',
      });
      if (failed && (f.errorHandling || 'stop') === 'stop') {
        // mark remaining as skipped conceptually by stopping
      }
    });
    if (!failed) {
      steps.push({ name: 'اكتمال التشغيل', ok: true, at: nowIso(), detail: 'Success' });
    }
    const end = nowIso();
    const durationSec = Math.max(0.5, Math.round((new Date(end) - new Date(start)) / 100) / 10);
    const exec = {
      id: nextSecSeq(sa.executions, 'RUN'),
      automationId: f.id,
      automationName: f.name,
      trigger: f.triggerLabel || f.trigger,
      triggeredBy: opts.triggeredBy || `تشغيل يدوي · ${actor}`,
      startTime: start,
      endTime: end,
      durationSec,
      steps,
      status: failed ? 'Failed' : 'Success',
      error,
    };
    sa.executions.unshift(exec);
    f.runs = (f.runs || 0) + 1;
    if (failed) f.failedRuns = (f.failedRuns || 0) + 1;
    else f.successRuns = (f.successRuns || 0) + 1;
    const total = (f.successRuns || 0) + (f.failedRuns || 0);
    f.successRate = total ? Math.round(((f.successRuns || 0) / total) * 100) : 100;
    f.lastRun = end;
    if (!failed) sa.savedHours = (sa.savedHours || 0) + 1;
    if (failed && f.status === 'active' && (f.systems || []).some((sys) => (sa.connections || []).find((c) => c.system === sys && c.status === 'Error'))) {
      f.status = 'error';
    }
    pushAutoAudit({
      user: actor,
      action: failed ? 'تشغيل فاشل' : 'تشغيل ناجح',
      automationId: f.id,
      automationName: f.name,
      newValue: exec.id,
    });
    recomputeAutomationKpis();
    pushFeed('decision', `تشغيل أتمتة: ${f.name} · ${exec.status}`);
    save();
    return exec;
  };

  const addAutomation = (payload = {}, actor = 'مشغّل هوب') => {
    const sa = autoBag();
    if (!Array.isArray(sa.automations)) sa.automations = [];
    const item = {
      id: nextSecSeq(sa.automations, 'AUTO'),
      name: payload.name || 'أتمتة جديدة',
      description: payload.description || '',
      module: payload.module || 'العمليات',
      triggerType: payload.triggerType || 'manual',
      triggerLabel: payload.triggerLabel || 'تشغيل يدوي',
      trigger: payload.triggerLabel || 'تشغيل يدوي',
      conditions: Array.isArray(payload.conditions) ? payload.conditions : [],
      actions: Array.isArray(payload.actions) ? payload.actions : [],
      systems: Array.isArray(payload.systems) ? payload.systems : [],
      system: (payload.systems || []).join(' · '),
      status: payload.draft ? 'draft' : payload.activate ? 'active' : 'draft',
      runs: 0,
      successRuns: 0,
      failedRuns: 0,
      successRate: 100,
      lastRun: '',
      nextRun: payload.schedule?.time ? '' : '',
      createdBy: actor,
      createdAt: nowIso(),
      creationMethod: payload.creationMethod || (payload.templateUsed ? 'Template' : 'إنشاء يدوي'),
      templateUsed: payload.templateUsed || '',
      sourceModule: payload.sourceModule || payload.module || '',
      updatedBy: actor,
      updatedAt: nowIso(),
      owner: payload.owner || actor,
      schedule: payload.schedule || null,
      retryPolicy: payload.retryPolicy || { retries: sa.settings?.defaultRetries || 3, waitMinutes: 5, onFail: 'notify' },
      errorHandling: payload.errorHandling || 'stop',
      timeoutSec: Number(payload.timeoutSec || 120),
      logging: true,
      sensitive: !!payload.sensitive,
      archived: false,
      draft: !!payload.draft && !payload.activate,
    };
    sa.automations.unshift(item);
    pushAutoAudit({
      user: actor,
      action: item.status === 'active' ? 'إنشاء وتفعيل أتمتة' : 'إنشاء أتمتة',
      automationId: item.id,
      automationName: item.name,
      newValue: item.status,
    });
    recomputeAutomationKpis();
    save();
    return item;
  };

  const updateAutomation = (id, patch = {}, actor = 'مشغّل هوب') => {
    const f = findAutomation(id);
    if (!f) return null;
    Object.keys(patch).forEach((k) => {
      if (patch[k] === undefined || patch[k] === f[k]) return;
      pushAutoAudit({
        user: actor,
        action: `تعديل أتمتة (${k})`,
        automationId: f.id,
        automationName: f.name,
        oldValue: typeof f[k] === 'object' ? JSON.stringify(f[k]) : String(f[k] ?? ''),
        newValue: typeof patch[k] === 'object' ? JSON.stringify(patch[k]) : String(patch[k] ?? ''),
      });
    });
    Object.assign(f, patch, { updatedBy: actor, updatedAt: nowIso() });
    if (Array.isArray(f.systems)) f.system = f.systems.join(' · ');
    if (f.triggerLabel) f.trigger = f.triggerLabel;
    recomputeAutomationKpis();
    save();
    return f;
  };

  const duplicateAutomation = (id, actor = 'مشغّل هوب') => {
    const f = findAutomation(id);
    if (!f) return null;
    return addAutomation(
      {
        ...f,
        name: `${f.name} (نسخة)`,
        draft: true,
        activate: false,
        creationMethod: 'إنشاء يدوي',
        templateUsed: f.id,
      },
      actor
    );
  };

  const archiveAutomation = (id, actor = 'مشغّل هوب') => {
    const f = findAutomation(id);
    if (!f) return null;
    f.archived = true;
    f.status = 'paused';
    pushAutoAudit({ user: actor, action: 'أرشفة أتمتة', automationId: f.id, automationName: f.name, newValue: 'archived' });
    recomputeAutomationKpis();
    save();
    return f;
  };

  const testAutomation = (id, actor = 'مشغّل هوب') => {
    const f = findAutomation(id) || id;
    const auto = typeof f === 'object' ? f : findAutomation(id);
    if (!auto) return { ok: false, error: 'الأتمتة غير موجودة', steps: [] };
    const steps = [];
    steps.push({ name: 'المحفز', ok: !!auto.triggerType || !!auto.triggerLabel, detail: auto.triggerLabel || auto.trigger });
    steps.push({
      name: 'الشروط',
      ok: true,
      detail: auto.conditions?.length ? auto.conditions.map((c) => `${c.field} ${c.op} ${c.value}`).join(' AND ') : 'بدون شروط',
    });
    (auto.actions || []).forEach((a) => {
      const missing = !a.type && !a.label;
      steps.push({ name: a.label || a.type || 'إجراء', ok: !missing, detail: missing ? 'إجراء غير مكتمل' : 'جاهز' });
    });
    if (!(auto.actions || []).length) steps.push({ name: 'الإجراءات', ok: false, detail: 'لا توجد إجراءات' });
    const ok = steps.every((s) => s.ok);
    pushAutoAudit({
      user: actor,
      action: 'اختبار أتمتة',
      automationId: auto.id || '',
      automationName: auto.name || '',
      newValue: ok ? 'نجح الاختبار' : 'فشل الاختبار',
    });
    save();
    return { ok, steps, message: ok ? 'تم الاختبار بنجاح' : 'فشل الاختبار — راجع الخطوات' };
  };

  const retryExecution = (execId, actor = 'مشغّل هوب') => {
    const sa = autoBag();
    const ex = sa.executions?.find((x) => x.id === execId);
    if (!ex) return null;
    return runAutomationFlow(ex.automationId, { triggeredBy: `إعادة تشغيل ${execId}`, forceSuccess: true }, actor);
  };

  const updateAutomationQueue = (id, patch = {}, actor = 'مشغّل هوب') => {
    const q = autoBag().queue?.find((x) => x.id === id);
    if (!q) return null;
    Object.assign(q, patch);
    pushAutoAudit({ user: actor, action: 'تحديث طابور', automationId: q.automationId || '', automationName: q.name, newValue: q.status });
    recomputeAutomationKpis();
    save();
    return q;
  };

  const runQueueItem = (id, actor = 'مشغّل هوب') => {
    const q = autoBag().queue?.find((x) => x.id === id);
    if (!q) return null;
    const exec = q.automationId ? runAutomationFlow(q.automationId, { triggeredBy: `طابور ${q.id}` }, actor) : null;
    q.status = 'done';
    recomputeAutomationKpis();
    save();
    return exec;
  };

  const testAutomationConnection = (id, actor = 'مشغّل هوب') => {
    const c = autoBag().connections?.find((x) => x.id === id);
    if (!c) return null;
    const old = c.status;
    c.status = /error|expired|fail/i.test(`${c.lastError || ''} ${c.status}`) && c.status === 'Error' ? 'Connected' : c.status === 'Connected' ? 'Connected' : 'Connected';
    if (/LMS/i.test(c.system) && Math.random() < 0.3) {
      c.status = 'Error';
      c.lastError = 'Authentication expired';
    } else {
      c.status = 'Connected';
      c.lastError = '';
    }
    c.lastChecked = nowIso();
    pushAutoAudit({ user: actor, action: 'Test Connection', automationId: '', automationName: c.system, oldValue: old, newValue: c.status });
    // clear error status on automations if connection recovered
    if (c.status === 'Connected') {
      (autoBag().automations || []).forEach((a) => {
        if (a.status === 'error' && (a.systems || []).includes(c.system)) a.status = 'active';
      });
    }
    recomputeAutomationKpis();
    save();
    return c;
  };

  const updateAutomationSettings = (patch = {}, actor = 'مشغّل هوب') => {
    const sa = autoBag();
    if (!sa.settings) sa.settings = {};
    Object.assign(sa.settings, patch);
    pushAutoAudit({ user: actor, action: 'تعديل إعدادات الأتمتة', automationId: '', automationName: 'Settings', newValue: JSON.stringify(patch) });
    save();
    return sa.settings;
  };

  const dismissAutomationHelp = () => {
    autoBag().helpDismissed = true;
    save();
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
    cmd.ws = cmd.ws || { schemaVersion: 2, auditLog: [], settings: {} };
    pushDomainAudit(cmd.ws, {
      action: 'refresh',
      detail: 'تحديث مؤشرات مركز التحكم',
      by: 'غرفة العمليات',
      source: 'Command Center',
    });
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
    defaultSettings,
    getSettings,
    saveSettings,
    resetSettings,
    kpis,
    pushFeed,
    pushNotification,
    listNotifications,
    unreadNotificationsCount,
    markNotificationRead,
    markNotificationUnread,
    archiveNotification,
    markAllNotificationsRead,
    migrateOrphanNotifications,
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
    updateGovPolicy,
    activatePolicy,
    assignPolicyToPeople,
    acknowledgePolicy,
    addGovPerson,
    updateGovPerson,
    addGovBranch,
    addGovDepartment,
    addGovPlatform,
    addComplianceRequirement,
    addQualityStandard,
    addGovContract,
    issuePenaltyOrReward,
    decideGovApproval,
    addGovViolation,
    addGovRisk,
    addGovDecision,
    addGovCommittee,
    addGovDocument,
    updateGovSettings,
    dismissGovHelp,
    recomputeGovKpis,
    pushGovAudit,
    addConstitutionArticle,
    addBranch,
    addEmployee,
    updateEmployee,
    archiveEmployee,
    warnEmployee,
    rewardEmployee,
    decideReward,
    importEmployees,
    syncWorkforce,
    updateWorkforceSettings,
    addWorkforceSavedView,
    bulkTagEmployees,
    recomputeWorkforceKpis,
    pushWfAudit,
    tickProductivity,
    dismissWorkforceHelp,
    syncSystem,
    syncAllSystems,
    addTask,
    updateTask,
    removeTask,
    updateTaskStatus,
    dismissTasksHelp,
    addMeasurementIndicator,
    updateMeasurementIndicator,
    upsertIntegrationConnector,
    syncIntegrationConnector,
    hydrateCoreIntelligence,
    coreBag,
    upsertCoreDecision,
    updateCoreDecisionStatus,
    archiveCoreDecision,
    deleteCoreDecision,
    convertRecommendationToDecision,
    upsertCoreRecommendation,
    upsertCoreInsight,
    upsertCorePrediction,
    upsertCoreAnomaly,
    upsertCoreRule,
    upsertCoreDataSource,
    syncCoreDataSource,
    testCoreDataSource,
    executeCoreDecision,
    retryCoreExecution,
    decideCoreApproval,
    setCoreDecisionFeedback,
    runCoreAnalysis,
    updateCoreSettings,
    addCoreInsight,
    closeCoreInsight,
    upsertClient,
    setClientStatus,
    addClientNote,
    assignClientSystem,
    upsertHubRole,
    assignHubRole,
    removeNotification,
    createHubNotification,
    hydrateClientsBatchDomains,
    clientsBag,
    rolesBag,
    pushDomainAudit,
    hydrateOpsCommandDomains,
    recalculateMeasurement,
    generateReport,
    toggleConnector,
    pingGateway,
    advanceCoreModule,
    advancePriority,
    topupWallet,
    burnPoints,
    toggleMarketplaceSystem,
    updateMarketSystem,
    setMarketSystemStatus,
    cloneMarketSystem,
    addMarketSystemUser,
    syncMarketIntegration,
    testMarketIntegration,
    updateMarketSettings,
    dismissMarketHelp,
    importMarketSystems,
    recomputeMarketKpis,
    pushMarketAudit,
    hydrateSystemsMarketplace,
    addIncubator,
    registerApp,
    toggleApp,
    placeStoreOrder,
    addStoreItem,
    linkStoreMarketplace,
    addAdListing,
    updateAdListing,
    setAdWorkflowStatus,
    resolveWorkflowStatus,
    nextAdCode,
    listAdsFor,
    adMatchesScope,
    adMatchesTarget,
    toggleAd,
    addEvent,
    updateEvent,
    setEventWorkflowStatus,
    addProduct,
    addMarketSystem,
    addPlatform,
    toggleSecurityControl,
    closeSecurityIncident,
    reopenSecurityIncident,
    addSecurityIncident,
    updateSecurityIncident,
    addSecurityIncidentNote,
    addSecurityIncidentAction,
    addSecurityAttachment,
    archiveSecurityIncident,
    addSecurityControl,
    updateSecurityControl,
    archiveSecurityControl,
    addSecurityRisk,
    updateSecurityRisk,
    archiveSecurityRisk,
    markSecurityNoticeRead,
    recomputeInfoSecurityKpis,
    pushSecurityAudit,
    toggleDataCatalog,
    activateDataPolicy,
    recomputeDataGovernanceKpis,
    pushDgAudit,
    addDataSource,
    updateDataSource,
    testDataSourceConnection,
    scanDataSource,
    addDataAsset,
    updateDataAsset,
    archiveDataAsset,
    addDgPolicy,
    updateDgPolicy,
    addQualityRule,
    runQualityCheck,
    updateQualityIssue,
    decideDgApproval,
    updateDgSettings,
    importDataAssets,
    toggleAutomationFlow,
    runAutomationFlow,
    recomputeAutomationKpis,
    pushAutoAudit,
    addAutomation,
    updateAutomation,
    duplicateAutomation,
    archiveAutomation,
    testAutomation,
    retryExecution,
    updateAutomationQueue,
    runQueueItem,
    testAutomationConnection,
    updateAutomationSettings,
    dismissAutomationHelp,
    entityAction,
    getEntity,
    refreshCommandStats,
    REPORT_TITLES,
  };
})();

window.HubStore = HubStore;
