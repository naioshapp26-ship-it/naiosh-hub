/**
 * NAIOSH Universal Search — بحث موحّد: حاضنات · منصات · أنظمة.
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
      if (app.kind === 'sovereign') return; // covered by platforms
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
        return { ...item, score };
      })
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'ar'));
  };

  const stats = () => {
    const catalog = collectCatalog();
    return {
      all: catalog.length,
      incubator: catalog.filter((i) => i.type === 'incubator').length,
      platform: catalog.filter((i) => i.type === 'platform').length,
      system: catalog.filter((i) => i.type === 'system').length,
    };
  };

  window.HubUniversalSearch = { search, stats, collectCatalog, esc, norm };
})();
