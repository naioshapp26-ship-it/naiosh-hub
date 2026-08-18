/**
 * حاضنات العميل — تُمنح عبر الفرع التابع له عند الحجز/التسجيل
 * حاضنتي تعرض فقط حاضنات صاحب الإيميل، ليست كتالوج حاضنات هوب.
 */
(() => {
  'use strict';

  const KEY = 'naiosh_client_incubators_v1';
  const EMAIL_KEY = 'naiosh_client_incubator_email';
  const BOOKINGS_KEY = 'naiosh-hub-bookings';

  const blank = () => ({ version: 1, incubators: [], updatedAt: new Date().toISOString() });

  const uid = (p = 'cinc') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

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
    state.incubators = Array.isArray(state.incubators) ? state.incubators : [];
    localStorage.setItem(KEY, JSON.stringify(state));
    try {
      window.dispatchEvent?.(new CustomEvent('hub:client-incubators', { detail: state }));
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

  const list = () => read().incubators || [];

  const listForEmail = (email) => {
    const key = normEmail(email);
    if (!key) return [];
    return list().filter((row) => normEmail(row.email) === key);
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
    list()
      .filter((row) => String(row.branch || '') === String(branchId) && row.incubator)
      .forEach((row) => ids.add(String(row.incubator)));
    return ids;
  };

  /** حاضنات تابعة للفرع — توزيع ثابت + ما مُنح/حُجز على نفس الفرع */
  const incubatorsForBranch = (branchId) => {
    if (typeof window.HubClientPlatforms?.incubatorsForBranch === 'function') {
      return window.HubClientPlatforms.incubatorsForBranch(branchId) || [];
    }
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

  const catalogIncubator = (id) =>
    (window.HubIncubatorsData?.INCUBATORS || []).find((inc) => String(inc.id) === String(id)) || null;

  const grantFromBooking = (payload = {}) => {
    const email = normEmail(payload.email);
    const incubatorId = String(payload.incubator || '').trim();
    const catalog = catalogIncubator(incubatorId);
    const incubatorLabel = String(payload.incubatorLabel || catalog?.name || incubatorId).trim();
    const slug = String(payload.subdomain || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    if (!email) return { ok: false, error: 'الإيميل مطلوب' };
    if (!payload.branch) return { ok: false, error: 'اختر الفرع التابع له عند التسجيل' };
    if (!incubatorId) return { ok: false, error: 'اختر حاضنة تابعة للفرع' };

    const affiliated = incubatorsForBranch(payload.branch).some((inc) => String(inc.id) === incubatorId);
    if (!affiliated) {
      return { ok: false, error: 'الحاضنة يجب أن تكون تابعة للفرع المختار' };
    }

    let structureGrantId = '';
    let subdomainGrantId = '';
    const host = slug ? `${slug}.naiosh.app` : '';

    try {
      const structure = window.HubSystemOps?.grantStructure?.({
        type: 'incubator',
        nameAr: incubatorLabel,
        tenantName: payload.fullName || email,
        systemCode: 'HQ',
        refId: payload.branch || '',
      });
      structureGrantId = structure?.grantId || '';
    } catch {
      /* ignore */
    }

    try {
      const sd = window.HubSystemOps?.grantSubdomain?.({
        tenantName: payload.fullName || incubatorLabel,
        systemCode: 'HQ',
        slug,
        branchOrHq: payload.branchLabel || payload.branch || '',
        incubator: incubatorLabel,
        platformName: '',
      });
      subdomainGrantId = sd?.grantId || '';
    } catch {
      /* ignore */
    }

    const row = {
      id: uid('cinc'),
      source: payload.source || 'branch',
      email,
      fullName: String(payload.fullName || '').trim(),
      phone: String(payload.phone || '').trim(),
      incubator: incubatorId,
      incubatorLabel,
      incubatorNum: catalog?.num || null,
      sectorName: String(payload.sectorName || catalog?.sector || '').trim(),
      slug,
      host: host || (slug ? `${slug}.naiosh.app` : ''),
      country: String(payload.country || '').trim(),
      branch: String(payload.branch || '').trim(),
      branchLabel: String(payload.branchLabel || payload.branch || '').trim(),
      status: 'active',
      grantId: structureGrantId,
      subdomainGrantId,
      at: new Date().toISOString(),
    };

    const state = read();
    state.incubators = state.incubators || [];
    const dup = state.incubators.find(
      (x) => normEmail(x.email) === email && String(x.incubator) === incubatorId && String(x.branch) === String(row.branch)
    );
    if (dup) {
      Object.assign(dup, row, { id: dup.id });
      save(state);
      rememberEmail(email);
      return { ok: true, incubator: dup };
    }
    state.incubators.unshift(row);
    save(state);
    rememberEmail(email);

    try {
      window.HubStore?.pushFeed?.(
        'decision',
        `منح حاضنة عبر فرع: ${incubatorLabel} · ${row.branchLabel} · ${email}`
      );
    } catch {
      /* ignore */
    }

    return { ok: true, incubator: row };
  };

  window.HubClientIncubators = {
    KEY,
    EMAIL_KEY,
    incubatorsForBranch,
    list,
    listForEmail,
    grantFromBooking,
    rememberEmail,
    rememberedEmail,
    normEmail,
  };
})();
