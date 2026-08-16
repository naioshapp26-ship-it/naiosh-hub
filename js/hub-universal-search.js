/**
 * NAIOSH Universal Search — بحث موحّد:
 * فروع · حاضنات · منصات · دومينات فرعية ممنوحة · أنظمة · محتوى الأدمن.
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
      id: 'subdomains',
      type: 'subdomain',
      label: 'كل دومين فرعي ممنوح',
      icon: 'fa-globe',
      lead: 'الدومينات الفرعية الممنوحة مع رقم الدومين',
    },
  ];

  const collectCatalog = () => {
    const items = [];
    const ops = readOps();

    // —— الفروع ——
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

    // —— الحاضنات (معرف رقم حاضنة) ——
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

    // —— المنصات (رقم منصة) ——
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

    // —— دومينات فرعية ممنوحة ——
    (ops.subdomains || []).forEach((sd, idx) => {
      const num = Number(sd.num) || idx + 1;
      const grantId = sd.grantId || padId('SD', num);
      items.push({
        id: sd.id || `sd-${grantId}`,
        type: 'subdomain',
        typeAr: 'دومين فرعي',
        icon: 'fa-globe',
        title: sd.host || `${sd.slug}.naiosh.app`,
        subtitle: `${sd.tenantName || 'مستأجر'} · ${sd.systemCode || 'ERP'}`,
        meta: grantId,
        num,
        grantId,
        href: `system-ops.html#grants`,
        keywords: [
          sd.host,
          sd.slug,
          sd.tenantName,
          sd.systemCode,
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

    // —— هياكل ممنوحة (حاضنة/منصة/فرع إضافية) ——
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

    // —— الأنظمة ——
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

    // محتوى يضيفه الأدمن
    const custom = window.HubSearchCatalog?.toSearchItems?.() || [];
    custom.forEach((c) => items.push(c));

    items.push({
      id: 'hub-side-projects',
      type: 'content',
      typeAr: 'مشاريع',
      icon: 'fa-lightbulb',
      title: 'المشاريع الجانبية',
      subtitle: 'ابدأ من التحدي الذي أمامك، وليس من الكتاب',
      meta: 'Side Projects',
      href: 'side-projects.html#sp-client-intro',
      keywords:
        'مشاريع جانبية مشروع جانبي side projects قناتي تحدي نايوش افهم الفكرة خذ ما يناسب حوّلها إلى خطوة تعريف العميل',
    });

    return items;
  };

  const search = (query, typeFilter = 'all') => {
    const q = norm(query);
    return collectCatalog()
      .filter((item) => {
        if (typeFilter !== 'all' && item.type !== typeFilter) return false;
        if (!q) return true;
        const hay = norm(`${item.keywords} ${item.title} ${item.subtitle} ${item.meta} ${item.grantId || ''}`);
        return q.split(' ').every((t) => !t || hay.includes(t));
      })
      .map((item) => {
        const t = norm(item.title);
        let score = 1;
        if (q && t === q) score += 20;
        else if (q && t.startsWith(q)) score += 12;
        else if (q && t.includes(q)) score += 8;
        if (q && norm(item.meta) === q) score += 14;
        if (q && norm(item.grantId || '') === q) score += 16;
        if (q && String(item.num || '') === q.replace(/^#/, '')) score += 12;
        if (q && norm(item.subtitle).includes(q)) score += 4;
        if (item.source === 'admin-catalog' && q) score += 2;
        return { ...item, score };
      })
      .sort((a, b) => b.score - a.score || Number(a.num || 0) - Number(b.num || 0) || a.title.localeCompare(b.title, 'ar'));
  };

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
      image: count('image'),
      file: count('file'),
      video: count('video'),
      custom: catalog.filter((i) => i.source === 'admin-catalog').length,
    };
  };

  window.HubUniversalSearch = {
    search,
    stats,
    collectCatalog,
    suggestedLists: SUGGESTED_LISTS,
    esc,
    norm,
  };
})();
