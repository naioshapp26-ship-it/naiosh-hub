/**
 * NAIOSH Universal Search — بحث موحّد: حاضنات · منصات · أنظمة · محتوى الأدمن.
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
      .replace(/[^\u0600-\u06FFa-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const collectCatalog = () => {
    const items = [];

    (window.HubIncubatorsData?.INCUBATORS || []).forEach((inc) => {
      items.push({
        id: inc.id,
        type: 'incubator',
        typeAr: 'حاضنة',
        icon: inc.icon || 'fa-seedling',
        title: inc.name,
        subtitle: inc.sector || 'حاضنة قطاعية',
        meta: `#${inc.num}`,
        href: `incubators.html#${encodeURIComponent(inc.id)}`,
        keywords: [inc.name, inc.sector, 'حاضنة', 'incubator', String(inc.num)].join(' '),
      });
    });

    const platforms = window.HubSovereignPlatforms?.list || [];
    platforms.forEach((p) => {
      items.push({
        id: `plat-${p.code}`,
        type: 'platform',
        typeAr: 'منصة',
        icon: p.icon || 'fa-layer-group',
        title: p.nameAr || p.name,
        subtitle: p.role || 'منصة سيادية',
        meta: p.code,
        href: `platforms.html#${String(p.code).toLowerCase()}`,
        keywords: [p.nameAr, p.name, p.code, p.role, p.desc, p.category, 'منصة', 'platform'].filter(Boolean).join(' '),
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

    // محتوى يضيفه الأدمن من صفحة إدارة محرك البحث
    const custom = window.HubSearchCatalog?.toSearchItems?.() || [];
    custom.forEach((c) => items.push(c));

    // صفحة المشاريع الجانبية — تعريف مباشر للعميل
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
        const hay = norm(`${item.keywords} ${item.title} ${item.subtitle} ${item.meta}`);
        return q.split(' ').every((t) => !t || hay.includes(t));
      })
      .map((item) => {
        const t = norm(item.title);
        let score = 1;
        if (q && t === q) score += 20;
        else if (q && t.startsWith(q)) score += 12;
        else if (q && t.includes(q)) score += 8;
        if (q && norm(item.meta) === q) score += 10;
        if (q && norm(item.subtitle).includes(q)) score += 4;
        if (item.source === 'admin-catalog' && q) score += 2;
        return { ...item, score };
      })
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'ar'));
  };

  const stats = () => {
    const catalog = collectCatalog();
    const count = (type) => catalog.filter((i) => i.type === type).length;
    return {
      all: catalog.length,
      incubator: count('incubator'),
      platform: count('platform'),
      system: count('system'),
      content: count('content'),
      image: count('image'),
      file: count('file'),
      video: count('video'),
      custom: catalog.filter((i) => i.source === 'admin-catalog').length,
    };
  };

  window.HubUniversalSearch = { search, stats, collectCatalog, esc, norm };
})();
