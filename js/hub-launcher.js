/**
 * Hub Launcher — فتح الأنظمة مباشرة من هوب أو بشكل منفرد
 * مع فحص الاشتراك/الصلاحية وتمرير جلسة NAIOSH ID
 */
(() => {
  const SYSTEM_META = {
    ERP: { nameAr: 'نايوش إي آر بي', icon: 'fa-sitemap', domain: 'naiosherp.com', color: '#b91c1c' },
    LAW: { nameAr: 'نايوش لو', icon: 'fa-gavel', domain: 'naioshlaw.com', color: '#1e3a5f' },
    FIT: { nameAr: 'نايوش فيت', icon: 'fa-dumbbell', domain: 'naioshfit.com', color: '#0f766e' },
    NAIS: { nameAr: 'نايس', icon: 'fa-chart-line', domain: 'naioshhub360.com', color: '#9f1239' },
    ACADEMY: { nameAr: 'أكاديمية نايوش', icon: 'fa-chalkboard-user', domain: 'edunaiosh.com', color: '#7c2d12' },
    LMS: { nameAr: 'نظام التعلم', icon: 'fa-laptop-code', domain: 'edunaiosh.com', color: '#1d4ed8' },
    CRM: { nameAr: 'إدارة علاقات العملاء', icon: 'fa-handshake', domain: 'naioshhub360.com', color: '#854d0e' },
  };

  const systemPath = (code) => `systems/${String(code || '').toLowerCase()}.html`;

  const normalizeApp = (app = {}) => {
    const code = String(app.code || '').toUpperCase();
    const meta = SYSTEM_META[code] || {};
    const launchUrl = app.launchUrl || (SYSTEM_META[code] ? systemPath(code) : app.url || 'apps.html');
    const standaloneUrl = app.standaloneUrl || launchUrl;
    const hubPath = app.hubPath || (code ? `apps.html#${code.toLowerCase()}` : 'apps.html');
    return {
      ...meta,
      ...app,
      code,
      nameAr: app.nameAr || meta.nameAr || code,
      icon: app.icon || meta.icon || 'fa-cube',
      launchUrl,
      standaloneUrl,
      hubPath,
      url: app.url && !String(app.url).includes('apps.html#') ? app.url : launchUrl,
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
    if (SYSTEM_META[code]) return normalizeApp({ code, ...SYSTEM_META[code] });
    return null;
  };

  const withLaunchParams = (url, { from = 'hub', returnUrl, systemCode = '' } = {}) => {
    try {
      const u = new URL(url, window.location.href);
      u.searchParams.set('from', from);
      if (returnUrl) u.searchParams.set('return', returnUrl);
      u.searchParams.set('hub', '1');
      let href = u.pathname + u.search + u.hash;
      if (window.HubAuth?.attachSsoParams) {
        href = window.HubAuth.attachSsoParams(href, systemCode || u.searchParams.get('system') || '');
      }
      return href;
    } catch (_) {
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
    try {
      const u = new URL(app.standaloneUrl || app.launchUrl || app.url, window.location.href);
      u.searchParams.set('mode', 'standalone');
      u.searchParams.delete('from');
      u.searchParams.delete('hub');
      let href = u.pathname + u.search + u.hash;
      if (window.HubAuth?.attachSsoParams) href = window.HubAuth.attachSsoParams(href, app.code);
      return href;
    } catch (_) {
      const base = app.standaloneUrl || app.launchUrl || app.url;
      const join = base.includes('?') ? '&' : '?';
      return `${base}${join}mode=standalone`;
    }
  };

  const gateAccess = (app, { mode = 'hub', silent = false } = {}) => {
    if (!app) return { ok: false, reason: 'missing' };
    // التشغيل المنفرد للتجربة مسموح بدون بوابة صارمة؛ عبر هوب يلزم جلسة + صلاحية
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
    if (target === '_blank') window.open(href, '_blank', 'noopener');
    else window.location.href = href;
    return href;
  };

  const openButtonsHtml = (appLike, { compact = false } = {}) => {
    const app = findApp(appLike);
    if (!app) return '';
    const direct = getDirectLaunchUrl(app);
    const solo = getStandaloneUrl(app);
    if (compact) {
      return `<a class="btn-mini primary hub-launch-direct" href="${direct}" data-launch-code="${app.code}" data-launch-mode="hub"><i class="fas fa-arrow-up-right-from-square"></i> فتح النظام</a>`;
    }
    return `
      <a class="btn-mini primary hub-launch-direct" href="${direct}" data-launch-code="${app.code}" data-launch-mode="hub" title="تشغيل عبر هوب — انتقال مباشر للنظام">
        <i class="fas fa-bolt"></i> فتح عبر هوب
      </a>
      <a class="btn-mini hub-launch-solo" href="${solo}" data-launch-code="${app.code}" data-launch-mode="standalone" title="تشغيل منفرد بدون هوب">
        <i class="fas fa-window-restore"></i> منفرد
      </a>`;
  };

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-launch-code]');
    if (!a) return;
    const mode = a.dataset.launchMode || 'hub';
    if (mode === 'standalone') return; // allow default navigation
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
  };
})();
