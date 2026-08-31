/**
 * NAIOSH Universal Search Orchestrator
 * فروع · حاضنات · منصات · دومينات · أنظمة · محتوى + Intent Engine
 */
(() => {
  'use strict';

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/[^\u0600-\u06FFa-z0-9\s#.-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const padId = (prefix, num) => `${prefix}-${String(Number(num) || 0).padStart(3, '0')}`;

  const readOps = () => {
    try {
      return JSON.parse(localStorage.getItem('naiosh_system_ops_v1') || '{}') || {};
    } catch {
      return {};
    }
  };

  const SUGGESTED_LISTS = [
    {
      id: 'branches',
      type: 'branch',
      label: 'جميع الفروع',
      icon: 'fa-code-branch',
      lead: 'قائمة كل فروع نايوش مع رقم الفرع',
    },
    {
      id: 'incubators',
      type: 'incubator',
      label: 'جميع الحاضنات',
      icon: 'fa-seedling',
      lead: 'قائمة كل الحاضنات مع معرف رقم الحاضنة',
    },
    {
      id: 'platforms',
      type: 'platform',
      label: 'جميع المنصات',
      icon: 'fa-layer-group',
      lead: 'قائمة كل المنصات مع رقم المنصة',
    },
    {
      id: 'knowledge',
      type: 'knowledge',
      label: 'صفحات مركز المعلومات',
      icon: 'fa-circle-info',
      lead: 'كل صفحات مركز المعرفة تظهر هنا في محرك البحث',
    },
  ];

  const collectCatalog = () => {
    const items = [];
    const ops = readOps();

    (window.HubBranchesData?.BRANCHES || []).forEach((br, idx) => {
      const num = Number(String(br.erpCode || '').replace(/\D/g, '')) || idx + 1;
      const grantId = br.erpCode || padId('BR', num);
      items.push({
        id: br.id,
        type: 'branch',
        typeAr: 'فرع',
        icon: 'fa-code-branch',
        title: br.nameAr || br.nameEn || br.code,
        subtitle: `${br.nameEn || ''} · ${br.type || 'فرع'}`.trim(),
        meta: grantId,
        num,
        grantId,
        href: `branches.html#${encodeURIComponent(br.id)}`,
        keywords: [br.nameAr, br.nameEn, br.code, br.erpCode, grantId, 'فرع', 'فروع', 'branch', String(num)]
          .filter(Boolean)
          .join(' '),
      });
    });

    (window.HubIncubatorsData?.INCUBATORS || []).forEach((inc) => {
      const num = Number(inc.num) || 0;
      const grantId = padId('INC', num);
      items.push({
        id: inc.id,
        type: 'incubator',
        typeAr: 'حاضنة',
        icon: inc.icon || 'fa-seedling',
        title: inc.name,
        subtitle: inc.sector || 'حاضنة قطاعية',
        meta: grantId,
        num,
        grantId,
        href: `incubators.html#${encodeURIComponent(inc.id)}`,
        keywords: [inc.name, inc.sector, grantId, 'حاضنة', 'حاضنات', 'incubator', String(num)].join(' '),
      });
    });

    const platforms = window.HubSovereignPlatforms?.list || [];
    platforms.forEach((p, idx) => {
      const num = Number(p.num) || idx + 1;
      const grantId = padId('PLT', num);
      items.push({
        id: `plat-${p.code}`,
        type: 'platform',
        typeAr: 'منصة',
        icon: p.icon || 'fa-layer-group',
        title: p.nameAr || p.name,
        subtitle: p.role || 'منصة سيادية',
        meta: `${grantId} · ${p.code}`,
        num,
        grantId,
        code: p.code,
        href: `platforms.html#${String(p.code).toLowerCase()}`,
        keywords: [p.nameAr, p.name, p.code, p.role, p.desc, p.category, grantId, 'منصة', 'منصات', 'platform', String(num)]
          .filter(Boolean)
          .join(' '),
      });
    });

    (ops.subdomains || []).forEach((sd, idx) => {
      const num = Number(sd.num) || idx + 1;
      const grantId = sd.grantId || padId('SD', num);
      items.push({
        id: sd.id || `sd-${grantId}`,
        type: 'subdomain',
        typeAr: 'دومين فرعي',
        icon: 'fa-globe',
        title: sd.host || `${sd.slug}.naiosh.app`,
        subtitle: `${sd.tenantName || 'مستأجر'} · ${sd.systemCode || 'ERP'} · ${sd.branchOrHq || '—'} · ${sd.incubator || '—'} · ${sd.platformName || '—'}`,
        meta: grantId,
        num,
        grantId,
        href: `system-ops.html#grants`,
        keywords: [
          sd.host,
          sd.slug,
          sd.tenantName,
          sd.systemCode,
          sd.branchOrHq,
          sd.incubator,
          sd.platformName,
          grantId,
          'دومين',
          'دومين فرعي',
          'صب دومين',
          'subdomain',
          String(num),
        ]
          .filter(Boolean)
          .join(' '),
      });
    });

    (ops.structures || []).forEach((st, idx) => {
      const kind = st.type || 'platform';
      const type =
        kind === 'incubator' ? 'incubator' : kind === 'branch' ? 'branch' : kind === 'platform' ? 'platform' : 'content';
      const typeAr =
        kind === 'incubator' ? 'حاضنة ممنوحة' : kind === 'branch' ? 'فرع ممنوح' : kind === 'platform' ? 'منصة ممنوحة' : 'هيكل ممنوح';
      const prefix = kind === 'incubator' ? 'INC' : kind === 'platform' ? 'PLT' : kind === 'branch' ? 'BR' : 'GR';
      const num = Number(st.num) || idx + 1;
      const grantId = st.grantId || padId(prefix, num);
      items.push({
        id: st.id || `grant-${grantId}`,
        type,
        typeAr,
        icon: kind === 'incubator' ? 'fa-seedling' : kind === 'branch' ? 'fa-code-branch' : 'fa-layer-group',
        title: st.nameAr || grantId,
        subtitle: `ممنوح لـ ${st.tenantName || 'مستأجر'} · ${st.systemCode || ''}`,
        meta: grantId,
        num,
        grantId,
        granted: true,
        href: `system-ops.html#grants`,
        keywords: [st.nameAr, st.tenantName, st.systemCode, grantId, typeAr, 'منح', String(num)].filter(Boolean).join(' '),
      });
    });

    const apps = window.HubMarketplaceData?.APPS || [];
    apps.forEach((app) => {
      if (app.kind === 'sovereign') return;
      const href =
        app.launchUrl ||
        app.url ||
        window.HubLauncher?.systemPath?.(app.code) ||
        `apps.html#${String(app.code).toLowerCase()}`;
      items.push({
        id: `sys-${app.code}`,
        type: 'system',
        typeAr: app.kind === 'studio' ? 'استوديو' : 'نظام',
        icon: app.icon || 'fa-cube',
        title: app.nameAr,
        subtitle: app.category || (app.kind === 'studio' ? 'استوديو هوب' : 'نظام تشغيلي'),
        meta: app.code,
        href,
        keywords: [app.nameAr, app.name, app.code, app.category, app.kind, 'نظام', 'system', 'استوديو'].filter(Boolean).join(' '),
      });
    });

    const custom = window.HubSearchCatalog?.toSearchItems?.() || [];
    custom.forEach((c) => items.push(c));

    const infoPages = window.HubInfoCenterPages?.toSearchItems?.() || [];
    infoPages.forEach((p) => items.push(p));

    items.push({
      id: 'hub-side-projects',
      type: 'content',
      typeAr: 'مشاريع',
      icon: 'fa-lightbulb',
      title: 'المشاريع الجانبية',
      subtitle: 'إبدأ التحدي مع نفسك اولا',
      meta: 'Side Projects · Opportunity',
      href: 'side-projects.html#sp-client-intro',
      keywords:
        'مشاريع جانبية مشروع جانبي side projects قناتي تحدي نايوش دخل إضافي منزلي متنقل موسمي فرصة opportunity engine رأس مال قليل',
    });

    items.push({
      id: 'hub-register',
      type: 'content',
      typeAr: 'تسجيل',
      icon: 'fa-user-plus',
      title: 'سجل معنا',
      subtitle: 'صاحب المنصة يعبّئ الفرع والحاضنة والمنصة — السوبر أدمن يوافق فقط',
      meta: 'Register',
      href: 'register.html',
      keywords: 'سجل معنا تسجيل منصة فرع حاضنة دومين موافقة سوبر أدمن صاحب المنصة',
    });

    items.push({
      id: 'hub-systems-instructions',
      type: 'content',
      typeAr: 'تعليمات',
      icon: 'fa-book-open',
      title: 'تعليمات أنظمة نايوش',
      subtitle: 'قواعد منح الفروع والحاضنات والمنصات والمكاتب والأنظمة',
      meta: 'Instructions',
      href: 'systems-instructions.html',
      keywords: 'تعليمات أنظمة منح فرع حاضنة منصة مكتب نظام',
    });

    return items;
  };

  /**
   * Orchestrated search:
   * query + optional typeFilter + optional intentId
   * returns { results, intent, followUps, query }
   */
  const search = (query, typeFilter = 'all', options = {}) => {
    const intentsApi = window.HubSearchIntents;
    const qRaw = String(query || '').trim();
    const q = norm(qRaw);
    const intent =
      (options.intentId && intentsApi?.byId?.(options.intentId)) ||
      (options.intent !== undefined ? options.intent : intentsApi?.detectIntent?.(qRaw)) ||
      null;

    const preferredTypes = intent?.routes?.types?.filter((t) => t !== 'all') || [];
    let effectiveType = typeFilter;
    // إذا لم يختر المستخدم فلترًا يدويًا وكان للنية نوع واحد واضح
    if (typeFilter === 'all' && preferredTypes.length === 1) {
      effectiveType = preferredTypes[0];
    }

    const catalog = collectCatalog();
    const routed = intent && intentsApi?.destinationCards ? intentsApi.destinationCards(intent) : [];
    const pool = [...routed, ...catalog];

    const results = pool
      .filter((item) => {
        if (effectiveType !== 'all' && item.type !== effectiveType && item.source !== 'intent-route') return false;
        if (!q) return true;
        // لنتائج التوجيه: تظهر دائمًا مع النية
        if (item.source === 'intent-route') return true;
        const hay = norm(`${item.keywords} ${item.title} ${item.subtitle} ${item.meta} ${item.grantId || ''}`);
        // نية نشطة: مرّر إن طابقت أي توكن من الاستعلام أو كلمات النية
        if (intent) {
          const tokens = q.split(' ').filter(Boolean);
          const intentKws = (intent.routes?.keywords || []).map((k) => norm(k)).filter(Boolean);
          const hitQuery = !tokens.length || tokens.some((t) => hay.includes(t));
          const hitIntent = intentKws.some((k) => hay.includes(k));
          return hitQuery || hitIntent || preferredTypes.includes(item.type);
        }
        return q.split(' ').every((t) => !t || hay.includes(t));
      })
      .map((item) => {
        const t = norm(item.title);
        let score = item.matchScore || 1;
        const why = [...(item.why || [])];
        if (q && t === q) score += 20;
        else if (q && t.startsWith(q)) score += 12;
        else if (q && t.includes(q)) score += 8;
        if (q && norm(item.meta) === q) score += 14;
        if (q && norm(item.grantId || '') === q) score += 16;
        if (q && String(item.num || '') === q.replace(/^#/, '')) score += 12;
        if (q && norm(item.subtitle).includes(q)) score += 4;
        if (item.source === 'admin-catalog' && q) score += 2;

        if (intent && intentsApi?.scoreAgainstIntent) {
          const intentScore = intentsApi.scoreAgainstIntent(item, intent, q);
          score += intentScore.score;
          why.push(...(intentScore.why || []));
        }

        const matchScore = Math.max(1, Math.min(99, Math.round(score)));
        return { ...item, score, matchScore, why: why.slice(0, 5), intentId: intent?.id || item.intentId || null };
      })
      .sort((a, b) => b.score - a.score || Number(a.num || 0) - Number(b.num || 0) || a.title.localeCompare(b.title, 'ar'));

    return {
      results,
      intent,
      followUps: intent?.followUps || [],
      query: qRaw,
      typeFilter: effectiveType,
    };
  };

  /** توافق خلفي: searchLegacy يعيد مصفوفة فقط */
  const searchItems = (query, typeFilter = 'all', options = {}) => search(query, typeFilter, options).results;

  const stats = () => {
    const catalog = collectCatalog();
    const count = (type) => catalog.filter((i) => i.type === type).length;
    return {
      all: catalog.length,
      branch: count('branch'),
      incubator: count('incubator'),
      platform: count('platform'),
      subdomain: count('subdomain'),
      system: count('system'),
      content: count('content'),
      knowledge: count('knowledge'),
      image: count('image'),
      file: count('file'),
      video: count('video'),
      custom: catalog.filter((i) => i.source === 'admin-catalog').length,
      intents: window.HubSearchIntents?.INTENTS?.length || 0,
    };
  };

  window.HubUniversalSearch = {
    search: searchItems,
    searchOrchestrated: search,
    stats,
    collectCatalog,
    suggestedLists: SUGGESTED_LISTS,
    esc,
    norm,
  };
})();
