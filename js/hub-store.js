/**
 * Naiosh Hub 360 — Central Operational Store (Imperial Edition)
 * Driven by EmpireBlueprint: Core Platform + 12 axes + org hierarchy + wallet.
 * Persists to localStorage.
 */
const HubStore = (() => {
  const KEY = 'naioshHub360Store_v8';

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
        ssoDomains: ['naioshhub360.com', 'edunaiosh.com', 'naiosherp.com', 'naioshlaw.com', 'naioshfit.com'],
        mfaEnabledPct: 67,
        activeSessions: 412,
        roles: (bp?.dashboardsByRole || []).map((r, i) => ({
          ...r,
          users: [2, 14, 38, 96, 210, 540, 180, 8200][i] || 50,
        })),
      },
      organization: {
        chain: bp?.orgChain || ['دولة', 'فرع', 'حاضنة', 'منصة', 'مكتب إلكتروني'],
        countries: [
          { id: uid('co'), name: 'مصر', code: 'EG', branches: 4, status: 'active' },
          { id: uid('co'), name: 'السعودية', code: 'SA', branches: 3, status: 'active' },
          { id: uid('co'), name: 'الإمارات', code: 'AE', branches: 2, status: 'building' },
        ],
        branches: [
          { id: uid('br'), name: 'فرع القاهرة', country: 'مصر', incubators: 12, manager: 'أحمد منصور' },
          { id: uid('br'), name: 'فرع الرياض', country: 'السعودية', incubators: 9, manager: 'نورة العتيبي' },
          { id: uid('br'), name: 'فرع دبي', country: 'الإمارات', incubators: 5, manager: 'خالد الراشد' },
        ],
        incubators: [
          { id: uid('inc'), name: 'حاضنة التعليم الذكي', sector: 'تعليم', platforms: 6, offices: 14, members: 320, health: 91 },
          { id: uid('inc'), name: 'حاضنة الصحة الرقمية', sector: 'صحة', platforms: 4, offices: 9, members: 180, health: 86 },
          { id: uid('inc'), name: 'حاضنة القانون', sector: 'قانون', platforms: 3, offices: 7, members: 95, health: 88 },
          { id: uid('inc'), name: 'حاضنة التسويق', sector: 'تسويق', platforms: 5, offices: 11, members: 240, health: 79 },
          { id: uid('inc'), name: 'حاضنة التقنية', sector: 'تقنية', platforms: 8, offices: 18, members: 410, health: 94 },
        ],
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
        branches: 9,
        incubators: 100,
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
    };
  };

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
        { id: uid('t'), title: 'مراجعة سياسة POL-02', assignee: 'ليلى كريم', priority: 'عالي', status: 'in_progress', quality: 0, project: 'حوكمة Q1' },
        { id: uid('t'), title: 'مزامنة بيانات ERP', assignee: 'محمد حسن', priority: 'عاجل', status: 'blocked', quality: 0, project: 'تكامل الأنظمة' },
        { id: uid('t'), title: 'تقرير مخاطر أسبوعي', assignee: 'نور فهد', priority: 'متوسط', status: 'todo', quality: 0, project: 'تقارير سيادية' },
        { id: uid('t'), title: 'تحسين مسار Academy', assignee: 'سارة أحمد', priority: 'عالي', status: 'done', quality: 91, project: 'تشغيل Academy' },
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
    timeline: {
      phase1: { name: 'التأسيس', days: 30, progress: 42, items: ['العقل المركزي', 'الحوكمة', 'القياس الموحد'] },
      phase2: { name: 'التشغيل', days: 45, progress: 18, items: ['ربط الأنظمة', 'المهام', 'القوى العاملة'] },
      phase3: { name: 'السيادة', days: 30, progress: 5, items: ['التقارير السيادية', 'التكامل الخارجي', 'الإطلاق'] },
    },
  });

  let state = null;

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        state = JSON.parse(raw);
        if (!state.empire) {
          state.empire = seedEmpire();
          save();
        }
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

  // —— Governance
  const addPolicy = (title, scope) => {
    const item = {
      id: uid('pol'),
      code: `POL-${String(get().governance.policies.length + 1).padStart(2, '0')}`,
      title,
      status: 'draft',
      scope,
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
    save();
    return sys;
  };

  const syncAllSystems = () => {
    get().systems.registry.forEach((sys) => syncSystem(sys.id));
    return get().systems.registry;
  };

  // —— Tasks
  const addTask = (title, assignee, priority, project) => {
    const item = {
      id: uid('t'),
      title,
      assignee,
      priority,
      status: 'todo',
      quality: 0,
      project,
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
  };

  const generateReport = (type) => {
    const k = kpis();
    const body = {
      date: today(),
      kpis: k,
      summary:
        type === 'risk'
          ? `مخاطر مفتوحة: ${get().core.predictions.length} تنبؤ · ${get().core.anomalies.filter((a) => a.status !== 'closed').length} شذوذ`
          : type === 'compliance'
            ? `متوسط الامتثال ${k.compliance}%`
            : `قرارات منفّذة ${k.decisionsToday} · إنتاجية ${k.productivity}% · صحة أنظمة ${k.systemsHealth}%`,
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
    pushFeed('report', `${item.title} جاهز للقائد الأعلى`);
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

  const addIncubator = (name, sector) => {
    const item = {
      id: uid('inc'),
      name,
      sector: sector || 'عام',
      platforms: 0,
      offices: 0,
      members: 0,
      health: 70,
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
      url: manifest.url || 'apps.html',
      icon: manifest.icon || 'fa-cube',
      status: manifest.status || 'active',
      health: 88,
      registeredAt: nowIso(),
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
    pushFeed('decision', `طلب متجر: ${item.title}`);
    save();
    return order;
  };

  const addStoreItem = (payload) => {
    const store = get().empire.salesStore;
    if (!store) return null;
    const item = {
      id: uid('st'),
      title: payload.title,
      desc: payload.desc || '',
      price: Number(payload.price) || 0,
      points: Number(payload.points) || 0,
      category: payload.category || 'عام',
      platformCode: payload.platformCode || '',
      stock: Number(payload.stock) || 10,
      status: 'active',
      badge: payload.badge || 'جديد',
    };
    store.items.unshift(item);
    pushFeed('decision', `منتج جديد في المتجر: ${item.title}`);
    save();
    return item;
  };

  const addAdListing = (payload) => {
    const studio = get().empire.adsStudio;
    if (!studio) return null;
    const ad = {
      id: uid('ad'),
      title: payload.title,
      content: payload.content || '',
      price: Number(payload.price) || 0,
      category: payload.category || 'عام',
      platformCode: payload.platformCode || '',
      productId: payload.productId || '',
      views: 0,
      impressions: 0,
      clicks: 0,
      status: 'active',
      level: payload.level || 'متوسط',
      type: payload.type || 'منتج منصة',
    };
    studio.listings.unshift(ad);
    pushFeed('decision', `إعلان جديد: ${ad.title}`);
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
    };
    studio.events.unshift(event);
    pushFeed('decision', `فعالية جديدة: ${event.name}`);
    save();
    return event;
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
    issueDecision,
    executeDecision,
    resolveAnomaly,
    runPredictiveScan,
    addPolicy,
    activatePolicy,
    issuePenaltyOrReward,
    addConstitutionArticle,
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
    addAdListing,
    toggleAd,
    addEvent,
    refreshCommandStats,
    REPORT_TITLES,
  };
})();

window.HubStore = HubStore;
