/**
 * منصات العميل — ربط المنصات الممنوحة عبر حاضنة تابعة لفرع بصفحة «منصتي»
 * لا تُعرض هنا منصات هوب العامة؛ فقط منصات صاحب الإيميل.
 */
(() => {
  'use strict';

  const KEY = 'naiosh_client_platforms_v1';
  const EMAIL_KEY = 'naiosh_client_platform_email';
  const BOOKINGS_KEY = 'naiosh-hub-bookings';

  const SYSTEM_OPTIONS = [
    { code: 'ERP', label: 'نايوش إي آر بي' },
    { code: 'NAIS', label: 'نايس — ذكاء التشغيل' },
    { code: 'LAW', label: 'نايوش لو — النظام القانوني' },
    { code: 'ACADEMY', label: 'أكاديمية نايوش' },
    { code: 'FIT', label: 'نايوش فيت' },
    { code: 'CRM', label: 'إدارة علاقات العملاء' },
    { code: 'LMS', label: 'نظام التعلم' },
    { code: 'SMARTX', label: 'سمارتكس — اجتماعات وقاعات' },
  ];

  const blank = () => ({ version: 1, platforms: [], updatedAt: new Date().toISOString() });

  const uid = (p = 'cplt') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const normEmail = (v) => String(v || '').trim().toLowerCase();

  const read = () => {
    try {
      return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
      return blank();
    }
  };

  const save = (state) => {
    state.updatedAt = new Date().toISOString();
    state.platforms = Array.isArray(state.platforms) ? state.platforms : [];
    localStorage.setItem(KEY, JSON.stringify(state));
    try {
      window.dispatchEvent?.(new CustomEvent('hub:client-platforms', { detail: state }));
    } catch {
      /* ignore */
    }
    return state;
  };

  const rememberEmail = (email) => {
    const key = normEmail(email);
    if (!key) return;
    try {
      localStorage.setItem(EMAIL_KEY, key);
    } catch {
      /* ignore */
    }
  };

  const rememberedEmail = () => {
    try {
      return normEmail(localStorage.getItem(EMAIL_KEY) || '');
    } catch {
      return '';
    }
  };

  const list = () => read().platforms || [];

  const listForEmail = (email) => {
    const key = normEmail(email);
    if (!key) return [];
    return list().filter((p) => normEmail(p.email) === key);
  };

  const systemOptions = () => {
    const fromMarket = (window.HubMarketplaceData?.APPS || []).filter((a) => a.kind === 'system');
    if (fromMarket.length) {
      return fromMarket.map((a) => ({ code: String(a.code).toUpperCase(), label: a.nameAr || a.code }));
    }
    return SYSTEM_OPTIONS.slice();
  };

  const branchPool = () =>
    (window.HubBranchesData?.BRANCHES || []).filter((b) => String(b.code || '').toUpperCase() !== 'HQ');

  const bookedIncubatorIdsForBranch = (branchId) => {
    const ids = new Set();
    try {
      const bookings = JSON.parse(localStorage.getItem(BOOKINGS_KEY) || '[]');
      (Array.isArray(bookings) ? bookings : []).forEach((row) => {
        if (String(row?.branch || '') !== String(branchId)) return;
        if (row.incubator) ids.add(String(row.incubator));
      });
    } catch {
      /* ignore */
    }
    try {
      (window.HubSystemOps?.read?.()?.structures || []).forEach((row) => {
        if (row?.type !== 'incubator') return;
        if (String(row.refId || '') === String(branchId) || String(row.branchId || '') === String(branchId)) {
          if (row.refId || row.id) ids.add(String(row.refId || row.id));
        }
      });
    } catch {
      /* ignore */
    }
    return ids;
  };

  /** حاضنات تابعة للفرع المختار — توزيع ثابت + ما حُجز سابقًا على نفس الفرع */
  const incubatorsForBranch = (branchId) => {
    const all = window.HubIncubatorsData?.INCUBATORS || [];
    if (!branchId || !all.length) return [];
    const pool = branchPool();
    const idx = pool.findIndex((b) => String(b.id) === String(branchId));
    const n = Math.max(1, pool.length);
    const slot = idx >= 0 ? idx : 0;
    const affiliated = all.filter((inc) => (Number(inc.num || 0) - 1) % n === slot % n);
    const extraIds = bookedIncubatorIdsForBranch(branchId);
    const seen = new Set(affiliated.map((inc) => inc.id));
    const extras = all.filter((inc) => extraIds.has(String(inc.id)) && !seen.has(inc.id));
    return affiliated.concat(extras);
  };

  const grantSystems = (email, systems) => {
    const granted = [];
    (systems || []).forEach((sys) => {
      const code = String(sys.code || sys || '').toUpperCase();
      if (!code) return;
      const label = sys.label || code;
      try {
        window.HubStore?.grantSubscription?.({
          email,
          systemCode: code,
          plan: 'standard',
          permissions: ['read', 'write'],
          source: 'incubator-booking',
        });
      } catch {
        /* ignore */
      }
      granted.push({ code, label });
    });
    return granted;
  };

  const grantFromBooking = (payload = {}) => {
    const email = normEmail(payload.email);
    const platformName = String(payload.platformName || payload.platform || '').trim();
    const slug = String(payload.subdomain || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    const systemsIn = Array.isArray(payload.systems) ? payload.systems : [];
    if (!email || !platformName) return { ok: false, error: 'الإيميل واسم المنصة مطلوبان' };
    if (!payload.branch) return { ok: false, error: 'اختر الفرع' };
    if (!payload.incubator) return { ok: false, error: 'اختر حاضنة تابعة للفرع' };
    if (!systemsIn.length) return { ok: false, error: 'اختر الأنظمة التشغيلية حسب حاجة العمل' };

    const systems = grantSystems(email, systemsIn);
    const primary = systems[0]?.code || 'ERP';
    const host = slug ? `${slug}.naiosh.app` : '';
    let structureGrantId = '';
    let subdomainGrantId = '';

    try {
      const structure = window.HubSystemOps?.grantStructure?.({
        type: 'platform',
        nameAr: platformName,
        tenantName: payload.fullName || email,
        systemCode: primary,
        refId: payload.incubator || '',
      });
      structureGrantId = structure?.grantId || '';
    } catch {
      /* ignore */
    }

    try {
      const sd = window.HubSystemOps?.grantSubdomain?.({
        tenantName: payload.fullName || platformName,
        systemCode: primary,
        slug,
        branchOrHq: payload.branchLabel || payload.branch || '',
        incubator: payload.incubatorLabel || payload.incubator || '',
        platformName,
      });
      subdomainGrantId = sd?.grantId || '';
    } catch {
      /* ignore */
    }

    const row = {
      id: uid('cplt'),
      source: payload.source || 'incubator',
      email,
      fullName: String(payload.fullName || '').trim(),
      phone: String(payload.phone || '').trim(),
      platformName,
      slug,
      host: host || (slug ? `${slug}.naiosh.app` : ''),
      country: String(payload.country || '').trim(),
      branch: String(payload.branch || '').trim(),
      branchLabel: String(payload.branchLabel || payload.branch || '').trim(),
      incubator: String(payload.incubator || '').trim(),
      incubatorLabel: String(payload.incubatorLabel || payload.incubator || '').trim(),
      sectorName: String(payload.sectorName || '').trim(),
      systems,
      status: 'active',
      grantId: structureGrantId,
      subdomainGrantId,
      at: new Date().toISOString(),
    };

    const state = read();
    state.platforms = state.platforms || [];
    state.platforms.unshift(row);
    save(state);
    rememberEmail(email);

    try {
      window.HubStore?.pushFeed?.(
        'decision',
        `منح منصة عبر حاضنة: ${platformName} · ${row.incubatorLabel} · ${email}`
      );
    } catch {
      /* ignore */
    }

    return { ok: true, platform: row };
  };

  window.HubClientPlatforms = {
    KEY,
    EMAIL_KEY,
    SYSTEM_OPTIONS,
    systemOptions,
    incubatorsForBranch,
    list,
    listForEmail,
    grantFromBooking,
    rememberEmail,
    rememberedEmail,
    normEmail,
  };
})();
