/**
 * فرعي — فروع العميل فقط (المرتبطة بحجزه أو تسجيله)
 * كتالوج كل الفروع يبقى في الهيدر: الفروع → branches.html
 */
(() => {
  'use strict';

  const KEY = 'naiosh_client_branches_v1';
  const EMAIL_KEY = 'naiosh_client_branch_email';
  const BOOKINGS_KEY = 'naiosh-hub-bookings';
  const INC_KEY = 'naiosh_client_incubators_v1';
  const PLT_KEY = 'naiosh_client_platforms_v1';
  const GRANTS_KEY = 'naiosh_hub_platform_grants_v1';

  const blank = () => ({ version: 1, branches: [], updatedAt: new Date().toISOString() });
  const uid = (p = 'cbr') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const normEmail = (v) => String(v || '').trim().toLowerCase();

  const readJson = (key, fallback) => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '');
      return raw || fallback;
    } catch {
      return fallback;
    }
  };

  const read = () => {
    try {
      return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
      return blank();
    }
  };

  const save = (state) => {
    state.updatedAt = new Date().toISOString();
    state.branches = Array.isArray(state.branches) ? state.branches : [];
    localStorage.setItem(KEY, JSON.stringify(state));
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

  const catalog = () => window.HubBranchesData?.BRANCHES || [];

  const resolveMeta = (id, label) => {
    const list = catalog();
    const hit =
      list.find((b) => String(b.id) === String(id)) ||
      list.find((b) => String(b.code) === String(id)) ||
      list.find((b) => String(b.nameAr || '') === String(label || '')) ||
      null;
    return hit;
  };

  const addHit = (map, { email, branch, branchLabel, source }) => {
    const key = normEmail(email);
    const id = String(branch || '').trim();
    if (!key || !id) return;
    const meta = resolveMeta(id, branchLabel);
    const uidKey = `${key}::${id}`;
    if (map.has(uidKey)) return;
    map.set(uidKey, {
      id: uid(),
      email: key,
      branch: id,
      branchLabel: String(branchLabel || meta?.nameAr || id).trim(),
      nameEn: meta?.nameEn || '',
      type: meta?.type || '',
      hours: meta?.hours || '',
      flag: meta?.flag || '',
      source: source || 'booking',
    });
  };

  const collectForEmail = (email) => {
    const key = normEmail(email);
    if (!key) return [];
    const map = new Map();

    (read().branches || []).forEach((row) => {
      if (normEmail(row.email) === key) addHit(map, row);
    });

    const bookings = readJson(BOOKINGS_KEY, []);
    (Array.isArray(bookings) ? bookings : []).forEach((row) => {
      if (normEmail(row.email) !== key) return;
      addHit(map, {
        email: key,
        branch: row.branch,
        branchLabel: row.branchLabel,
        source: 'booking',
      });
    });

    const incubators = readJson(INC_KEY, {}).incubators || [];
    incubators.forEach((row) => {
      if (normEmail(row.email) !== key) return;
      addHit(map, {
        email: key,
        branch: row.branch,
        branchLabel: row.branchLabel,
        source: 'incubator',
      });
    });

    const platforms = readJson(PLT_KEY, {}).platforms || [];
    platforms.forEach((row) => {
      if (normEmail(row.email) !== key) return;
      addHit(map, {
        email: key,
        branch: row.branch,
        branchLabel: row.branchLabel,
        source: 'platform',
      });
    });

    const grants = readJson(GRANTS_KEY, {}).grants || [];
    grants.forEach((row) => {
      if (normEmail(row.adminEmail || row.email) !== key) return;
      addHit(map, {
        email: key,
        branch: row.branch,
        branchLabel: row.branchLabel,
        source: 'register',
      });
    });

    return [...map.values()];
  };

  const listForEmail = (email) => collectForEmail(email);

  const grantFromBooking = (payload = {}) => {
    const email = normEmail(payload.email);
    const branch = String(payload.branch || '').trim();
    if (!email || !branch) return { ok: false, error: 'الإيميل والفرع مطلوبان' };
    const state = read();
    const exists = (state.branches || []).some(
      (row) => normEmail(row.email) === email && String(row.branch) === branch
    );
    if (!exists) {
      const meta = resolveMeta(branch, payload.branchLabel);
      state.branches.unshift({
        id: uid(),
        email,
        branch,
        branchLabel: String(payload.branchLabel || meta?.nameAr || branch).trim(),
        nameEn: meta?.nameEn || '',
        type: meta?.type || '',
        hours: meta?.hours || '',
        flag: meta?.flag || '',
        source: payload.source || 'booking',
        createdAt: new Date().toISOString(),
      });
      save(state);
    }
    rememberEmail(email);
    return { ok: true, branches: listForEmail(email) };
  };

  window.HubClientBranches = {
    KEY,
    listForEmail,
    grantFromBooking,
    rememberEmail,
    rememberedEmail,
  };
})();
