/**
 * Hub Launcher — فتح الأنظمة مباشرة من هوب أو بشكل منفرد
 * مع فحص الاشتراك/الصلاحية وتمرير جلسة NAIOSH ID
 * الأنظمة الحية (HubLiveSystems) تفتح على الدومين الحقيقي
 */
(() => {
  // سجل الدومينات الحية — يُحدَّث عند وصول دومين من العميل
  if (!window.HubLiveSystems) {
    const LIVE = {
      ERP: {
        url: 'https://web-production-419e2.up.railway.app/',
        domain: 'web-production-419e2.up.railway.app',
        openInNewTab: true,
        label: 'نايوش إي آر بي (مباشر)',
      },
      NAIS: {
        url: 'https://nais-production.up.railway.app/',
        domain: 'nais-production.up.railway.app',
        openInNewTab: true,
        label: 'نايس (مباشر)',
      },
      LAW: {
        url: 'https://naiosh-law-production.up.railway.app/',
        domain: 'naiosh-law-production.up.railway.app',
        openInNewTab: true,
        label: 'نايوش لو (مباشر)',
      },
      ACADEMY: {
        url: 'https://betacdmy-production.up.railway.app/',
        domain: 'betacdmy-production.up.railway.app',
        openInNewTab: true,
        label: 'أكاديمية نايوش (مباشر)',
      },
      FIT: {
        url: 'https://naioshfit-production-f0b4.up.railway.app/',
        domain: 'naioshfit-production-f0b4.up.railway.app',
        openInNewTab: true,
        label: 'نايوش فيت (مباشر)',
      },
      SMARTX: {
        url: 'https://smrttx.com/',
        domain: 'smrttx.com',
        openInNewTab: true,
        label: 'سمارتكس (مباشر)',
      },
      EDUSMARTX: {
        url: 'https://edusmrttx.com/',
        domain: 'edusmrttx.com',
        openInNewTab: true,
        label: 'إيديو سمارتكس (مباشر)',
      },
      EDUNAIOSH: {
        url: 'https://edunaiosh.com/',
        domain: 'edunaiosh.com',
        openInNewTab: true,
        label: 'نايوش (مباشر)',
      },
    };
    window.HubLiveSystems = {
      LIVE,
      get: (code) => LIVE[String(code || '').toUpperCase()] || null,
      url: (code) => LIVE[String(code || '').toUpperCase()]?.url || null,
      isLive: (code) => Boolean(LIVE[String(code || '').toUpperCase()]?.url),
    };
  }

  const SYSTEM_META = {
    ERP: { nameAr: 'نايوش إي آر بي', icon: 'fa-sitemap', domain: 'naiosherp.com', color: '#b91c1c' },
    LAW: { nameAr: 'نايوش لو', icon: 'fa-gavel', domain: 'naioshlaw.com', color: '#1e3a5f' },
    FIT: { nameAr: 'نايوش فيت', icon: 'fa-dumbbell', domain: 'naioshfit.com', color: '#0f766e' },
    NAIS: { nameAr: 'نايس', icon: 'fa-chart-line', domain: 'naioshhub360.com', color: '#9f1239' },
    ACADEMY: { nameAr: 'أكاديمية نايوش', icon: 'fa-chalkboard-user', domain: 'betacdmy-production.up.railway.app', color: '#7c2d12' },
    SMARTX: { nameAr: 'سمارتكس', icon: 'fa-video', domain: 'smrttx.com', color: '#1d4ed8' },
    EDUSMARTX: { nameAr: 'إيديو سمارتكس', icon: 'fa-graduation-cap', domain: 'edusmrttx.com', color: '#7c3aed' },
    EDUNAIOSH: { nameAr: 'نايوش', icon: 'fa-book-open-reader', domain: 'edunaiosh.com', color: '#b91c1c' },
    LMS: { nameAr: 'نظام التعلم', icon: 'fa-laptop-code', domain: 'edunaiosh.com', color: '#1d4ed8' },
    CRM: { nameAr: 'إدارة علاقات العملاء', icon: 'fa-handshake', domain: 'naioshhub360.com', color: '#854d0e' },
  };

  const isAbsolute = (u) => /^https?:\/\//i.test(String(u || ''));

  const liveOf = (code) => window.HubLiveSystems?.get?.(code) || null;

  const systemPath = (code) => `systems/${String(code || '').toLowerCase()}.html`;

  const normalizeApp = (app = {}) => {
    const code = String(app.code || '').toUpperCase();
    const meta = SYSTEM_META[code] || {};
    const live = liveOf(code);
    const launchUrl =
      live?.url || app.launchUrl || (SYSTEM_META[code] ? systemPath(code) : app.url || 'apps.html');
    const standaloneUrl = live?.url || app.standaloneUrl || launchUrl;
    const hubPath = app.hubPath || (code ? `apps.html#${code.toLowerCase()}` : 'apps.html');
    const external = isAbsolute(launchUrl);
    return {
      ...meta,
      ...app,
      code,
      nameAr: app.nameAr || live?.label || meta.nameAr || code,
      icon: app.icon || meta.icon || 'fa-cube',
      domain: live?.domain || app.domain || meta.domain,
      launchUrl,
      standaloneUrl,
      hubPath,
      url: external ? launchUrl : app.url && !String(app.url).includes('apps.html#') ? app.url : launchUrl,
      liveUrl: live?.url || null,
      isLive: Boolean(live?.url),
      openInNewTab: live ? live.openInNewTab !== false : external,
      supportsStandalone: app.supportsStandalone !== false,
      launchViaHub: app.launchViaHub !== false,
    };
  };

  const findApp = (codeOrApp) => {
    if (codeOrApp && typeof codeOrApp === 'object') return normalizeApp(codeOrApp);
    const code = String(codeOrApp || '').toUpperCase();
    const fromStore = window.HubStore?.get?.()?.empire?.apps?.find((a) => a.code === code);
    if (fromStore) return normalizeApp(fromStore);
    const fromCatalog = window.HubMarketplaceData?.APPS?.find((a) => a.code === code);
    if (fromCatalog) return normalizeApp(fromCatalog);
    if (SYSTEM_META[code] || liveOf(code)) return normalizeApp({ code, ...SYSTEM_META[code] });
    return null;
  };

  const withLaunchParams = (url, { from = 'hub', returnUrl, systemCode = '', tenant = '', subdomain = '' } = {}) => {
    try {
      const u = new URL(url, window.location.href);
      const sameOrigin = u.origin === window.location.origin;
      if (from) u.searchParams.set('from', from);
      if (systemCode) u.searchParams.set('system', systemCode);
      if (tenant) u.searchParams.set('tenant', String(tenant).toLowerCase());
      if (subdomain) u.searchParams.set('subdomain', String(subdomain).toLowerCase());
      if (!sameOrigin) {
        // نظام حي خارجي — مرّر SSO كاملًا على الرابط المطلق
        const href = u.toString();
        if (window.HubAuth?.attachSsoParams) {
          return window.HubAuth.attachSsoParams(href, systemCode, { tenant, subdomain, from });
        }
        return href;
      }
      if (returnUrl) u.searchParams.set('return', returnUrl);
      u.searchParams.set('hub', '1');
      let href = u.pathname + u.search + u.hash;
      if (window.HubAuth?.attachSsoParams) {
        href = window.HubAuth.attachSsoParams(href, systemCode || u.searchParams.get('system') || '', {
          tenant,
          subdomain,
          from,
        });
      }
      return href;
    } catch (_) {
      if (isAbsolute(url)) return url;
      const join = url.includes('?') ? '&' : '?';
      return `${url}${join}from=${encodeURIComponent(from)}&hub=1`;
    }
  };

  /** رابط الفتح المباشر للنظام (من هوب) */
  const getDirectLaunchUrl = (codeOrApp) => {
    const app = findApp(codeOrApp);
    if (!app) return 'apps.html';
    return withLaunchParams(app.launchUrl || app.url, {
      from: 'hub',
      returnUrl: `${window.location.pathname}${window.location.search}${window.location.hash}` || 'dashboard.html#apps',
      systemCode: app.code,
    });
  };

  /** تشغيل منفرد بدون سياق هوب */
  const getStandaloneUrl = (codeOrApp) => {
    const app = findApp(codeOrApp);
    if (!app) return 'apps.html';
    const base = app.standaloneUrl || app.launchUrl || app.url;
    try {
      const u = new URL(base, window.location.href);
      if (u.origin !== window.location.origin) return u.toString();
      u.searchParams.set('mode', 'standalone');
      u.searchParams.delete('from');
      u.searchParams.delete('hub');
      let href = u.pathname + u.search + u.hash;
      if (window.HubAuth?.attachSsoParams) href = window.HubAuth.attachSsoParams(href, app.code);
      return href;
    } catch (_) {
      if (isAbsolute(base)) return base;
      const join = base.includes('?') ? '&' : '?';
      return `${base}${join}mode=standalone`;
    }
  };

  const gateAccess = (app, { mode = 'hub', silent = false } = {}) => {
    if (!app) return { ok: false, reason: 'missing' };
    // الأنظمة الحية الخارجية تُفتح فعلياً للعميل بدون بوابة صارمة
    if (app.isLive || (isAbsolute(app.launchUrl) && !String(app.launchUrl).includes(window.location.host))) {
      return { ok: true, reason: 'live-external' };
    }
    if (mode === 'standalone') return { ok: true, reason: 'standalone' };
    if (!window.HubAuth) return { ok: true, reason: 'no-auth-module' };
    if (!window.HubAuth.isLoggedIn()) {
      if (!silent) {
        window.HubAuth.requireLogin({
          next: getDirectLaunchUrl(app),
          system: app.code,
        });
      }
      return { ok: false, reason: 'login' };
    }
    const access = window.HubAuth.canAccessSystem(app.code, 'read');
    if (!access.ok) {
      if (!silent) {
        const msg =
          access.reason === 'subscription'
            ? `لا يوجد اشتراك نشط لنظام ${app.nameAr}. اشترك من المتجر أو اطلب المنح من هوب.`
            : `صلاحيتك لا تسمح بفتح ${app.nameAr}`;
        if (window.HubActions?.toast) window.HubActions.toast(msg);
        else window.alert(msg);
        window.HubStore?.recordActivity?.('deny', `رفض دخول ${app.code}: ${access.reason}`, { code: app.code });
      }
      return access;
    }
    return access;
  };

  const launch = (codeOrApp, { mode = 'hub', target = '_self', force = false } = {}) => {
    const app = findApp(codeOrApp);
    if (!app) return null;
    if (!force) {
      const gate = gateAccess(app, { mode });
      if (!gate.ok) return null;
    }
    const href = mode === 'standalone' ? getStandaloneUrl(app) : getDirectLaunchUrl(app);
    window.HubStore?.recordLaunch?.(app.code, mode);
    const useBlank = target === '_blank' || app.openInNewTab || app.isLive;
    if (useBlank) window.open(href, '_blank', 'noopener');
    else window.location.href = href;
    return href;
  };

  const openButtonsHtml = (appLike, { compact = false } = {}) => {
    const app = findApp(appLike);
    if (!app) return '';
    const direct = getDirectLaunchUrl(app);
    const solo = getStandaloneUrl(app);
    const blank = app.openInNewTab || app.isLive ? ' target="_blank" rel="noopener"' : '';
    const liveBadge = app.isLive ? ' · مباشر' : '';
    if (compact) {
      return `<a class="btn-mini primary hub-launch-direct" href="${direct}" data-launch-code="${app.code}" data-launch-mode="hub"${blank}><i class="fas fa-arrow-up-right-from-square"></i> فتح النظام${liveBadge}</a>`;
    }
    return `
      <a class="btn-mini primary hub-launch-direct" href="${direct}" data-launch-code="${app.code}" data-launch-mode="hub"${blank} title="تشغيل عبر هوب — انتقال مباشر للنظام">
        <i class="fas fa-bolt"></i> فتح عبر هوب${liveBadge}
      </a>
      <a class="btn-mini hub-launch-solo" href="${solo}" data-launch-code="${app.code}" data-launch-mode="standalone"${blank} title="تشغيل منفرد بدون هوب">
        <i class="fas fa-window-restore"></i> منفرد
      </a>`;
  };

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-launch-code]');
    if (!a) return;
    const mode = a.dataset.launchMode || 'hub';
    if (mode === 'standalone') {
      const app = findApp(a.dataset.launchCode);
      if (app?.isLive) {
        e.preventDefault();
        launch(app, { mode: 'standalone', target: '_blank', force: true });
      }
      return;
    }
    e.preventDefault();
    launch(a.dataset.launchCode, { mode, target: a.target === '_blank' ? '_blank' : '_self' });
  });

  window.HubLauncher = {
    SYSTEM_META,
    systemPath,
    normalizeApp,
    findApp,
    getDirectLaunchUrl,
    getStandaloneUrl,
    withLaunchParams,
    gateAccess,
    launch,
    openButtonsHtml,
    isAbsolute,
  };
})();
