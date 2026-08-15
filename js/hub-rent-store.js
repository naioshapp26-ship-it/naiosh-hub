/**
 * مخزن استئجار الأنظمة من HUB — صلاحيات الظهور + طلبات + صب دومين
 */
(() => {
  'use strict';

  const KEY = 'naiosh_hub_system_rentals_v1';
  const API = '/api/hub/system-rentals';
  const BASE_DOMAIN = 'naiosh.app';
  const RESERVED = new Set(['www', 'app', 'api', 'admin', 'saas', 'hub', 'mail', 'ftp']);
  const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

  const PLAN_META = {
    basic: { label: 'Basic (مجاني)', amount: 'مجاني', price: 0 },
    pro: { label: 'Pro — $49/شهر', amount: '$49', price: 49 },
    enterprise: { label: 'Enterprise — $199/شهر', amount: '$199', price: 199 },
  };

  /** أنظمة قابلة للاستئجار عبر HUB (مرحلة أولى) */
  const RENTABLE_CODES = ['ERP', 'LAW', 'NAIS', 'FIT', 'ACADEMY', 'SMARTX', 'EDUSMARTX', 'EDUNAIOSH', 'LMS', 'CRM'];

  const blank = () => ({
    version: 1,
    visibility: {
      // email -> { codes: string[], mode: 'allow'|'deny-all' }
      // default: كل أنظمة RENTABLE ظاهرة للتجربة حتى يقيّدها الأدمن
    },
    rentals: [],
    updatedAt: new Date().toISOString(),
  });

  const readLocal = () => {
    try {
      return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
      return blank();
    }
  };

  const saveLocal = (state) => {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('hub:system-rentals', { detail: state }));
    return state;
  };

  const uid = (p = 'rent') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const syncRemote = async (state) => {
    try {
      await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
    } catch {
      /* offline ok */
    }
  };

  const hydrate = async () => {
    try {
      const res = await fetch(API, { cache: 'no-store' });
      if (!res.ok) return readLocal();
      const data = await res.json();
      if (data?.ok && data?.state) {
        return saveLocal({ ...blank(), ...data.state });
      }
    } catch {
      /* use local */
    }
    return readLocal();
  };

  const catalogSystems = () => {
    const apps = window.HubMarketplaceData?.APPS || [];
    const list = Array.isArray(apps) ? apps : [];
    const filtered = list.filter((a) => RENTABLE_CODES.includes(String(a.code || '').toUpperCase()));
    if (filtered.length) return filtered.map((a) => ({
      code: String(a.code).toUpperCase(),
      nameAr: a.nameAr || a.code,
      icon: a.icon || 'fa-cube',
      isLive: Boolean(a.isLive || window.HubLiveSystems?.isLive?.(a.code)),
    }));
    return RENTABLE_CODES.map((code) => ({
      code,
      nameAr: code,
      icon: 'fa-cube',
      isLive: Boolean(window.HubLiveSystems?.isLive?.(code)),
    }));
  };

  const visibleCodesFor = (email = '') => {
    const state = readLocal();
    const key = String(email || '').trim().toLowerCase();
    const rule = state.visibility?.[key];
    if (!rule) return RENTABLE_CODES.slice();
    if (rule.mode === 'deny-all') return [];
    const codes = Array.isArray(rule.codes) ? rule.codes.map((c) => String(c).toUpperCase()) : [];
    return codes.filter((c) => RENTABLE_CODES.includes(c));
  };

  const setVisibility = ({ email, codes = [], mode = 'allow' } = {}) => {
    const state = readLocal();
    const key = String(email || '').trim().toLowerCase();
    if (!key) return { ok: false, error: 'البريد مطلوب' };
    state.visibility = state.visibility || {};
    state.visibility[key] = {
      mode,
      codes: [...new Set((codes || []).map((c) => String(c).toUpperCase()))],
      updatedAt: new Date().toISOString(),
    };
    saveLocal(state);
    syncRemote(state);
    return { ok: true, rule: state.visibility[key] };
  };

  const normalizeSlug = (raw = '') =>
    String(raw)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 40);

  const validateSubdomain = (slug) => {
    const val = normalizeSlug(slug);
    if (!val) return { ok: false, available: false, message: 'أدخل النطاق الفرعي للتحقق من توفره' };
    if (val.length < 2) return { ok: false, available: false, message: 'أدخل حرفين على الأقل' };
    if (!SUBDOMAIN_RE.test(val) || RESERVED.has(val)) {
      return { ok: false, available: false, message: 'استخدم أحرفاً إنجليزية صغيرة وأرقاماً وشرطات فقط' };
    }
    const taken = readLocal().rentals.some(
      (r) => r.slug === val && ['pending', 'active', 'provisioning'].includes(r.status)
    );
    if (taken) return { ok: false, available: false, message: 'غير متاح' };
    // أيضاً من system-ops إن وُجد
    try {
      const ops = window.HubSystemOps?.read?.();
      if (ops?.subdomains?.some((s) => s.slug === val && s.status === 'active')) {
        return { ok: false, available: false, message: 'غير متاح' };
      }
    } catch {
      /* ignore */
    }
    return { ok: true, available: true, message: 'متاح!', slug: val, host: `${val}.${BASE_DOMAIN}` };
  };

  const listRentals = () =>
    readLocal()
      .rentals.slice()
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));

  const getRental = (id) => listRentals().find((r) => String(r.id) === String(id)) || null;

  const submitRental = (payload = {}) => {
    const companyName = String(payload.companyName || '').trim();
    const slugCheck = validateSubdomain(payload.slug || payload.subdomain);
    const adminName = String(payload.adminName || '').trim();
    const adminPhone = String(payload.adminPhone || '').trim();
    const adminEmail = String(payload.adminEmail || '').trim().toLowerCase();
    const plan = PLAN_META[payload.plan] ? payload.plan : 'basic';
    const systems = [...new Set((payload.systems || []).map((c) => String(c).toUpperCase()))].filter((c) =>
      RENTABLE_CODES.includes(c)
    );
    const payMethod = String(payload.payMethod || 'hub').trim();

    if (!companyName || !adminName || !adminPhone) {
      return { ok: false, error: 'يرجى ملء جميع الحقول المطلوبة *' };
    }
    if (!slugCheck.available) return { ok: false, error: slugCheck.message || 'النطاق الفرعي غير صالح' };
    if (!systems.length) return { ok: false, error: 'اختر نظامًا واحدًا على الأقل' };

    const allowed = visibleCodesFor(adminEmail);
    const blocked = systems.filter((c) => !allowed.includes(c));
    if (blocked.length) {
      return { ok: false, error: `الأنظمة غير مسموحة لصلاحياتك: ${blocked.join(', ')}` };
    }

    const now = new Date().toISOString();
    const rental = {
      id: uid('rent'),
      companyName,
      slug: slugCheck.slug,
      host: slugCheck.host,
      adminName,
      adminPhone,
      adminEmail,
      plan,
      planLabel: PLAN_META[plan].label,
      amount: PLAN_META[plan].amount,
      systems,
      payMethod,
      status: plan === 'basic' ? 'provisioning' : 'pending',
      createdAt: now,
      updatedAt: now,
    };

    const state = readLocal();
    state.rentals.unshift(rental);
    saveLocal(state);
    syncRemote(state);
    return { ok: true, rental };
  };

  const activateRental = (id) => {
    const state = readLocal();
    const row = state.rentals.find((r) => String(r.id) === String(id));
    if (!row) return { ok: false, error: 'الطلب غير موجود' };

    row.status = 'active';
    row.activatedAt = new Date().toISOString();
    row.updatedAt = row.activatedAt;

    // منح صب دومين عبر محرك تشغيل الأنظمة
    try {
      if (window.HubSystemOps?.grantSubdomain) {
        row.systems.forEach((code) => {
          window.HubSystemOps.grantSubdomain({
            tenantName: row.companyName,
            systemCode: code,
            baseDomain: BASE_DOMAIN,
            slug: row.slug,
          });
        });
      }
    } catch {
      /* keep rental active even if ops mock fails */
    }

    // اشتراكات HUB
    try {
      row.systems.forEach((code) => {
        window.HubStore?.grantSubscription?.({
          email: row.adminEmail,
          systemCode: code,
          plan: row.plan,
          permissions: ['read', 'write'],
        });
      });
    } catch {
      /* ignore */
    }

    saveLocal(state);
    syncRemote(state);
    return { ok: true, rental: row };
  };

  const rejectRental = (id, reason = '') => {
    const state = readLocal();
    const row = state.rentals.find((r) => String(r.id) === String(id));
    if (!row) return { ok: false, error: 'الطلب غير موجود' };
    row.status = 'rejected';
    row.rejectReason = String(reason || '').trim();
    row.updatedAt = new Date().toISOString();
    saveLocal(state);
    syncRemote(state);
    return { ok: true, rental: row };
  };

  window.HubRentStore = {
    KEY,
    BASE_DOMAIN,
    PLAN_META,
    RENTABLE_CODES,
    hydrate,
    read: readLocal,
    catalogSystems,
    visibleCodesFor,
    setVisibility,
    validateSubdomain,
    normalizeSlug,
    listRentals,
    getRental,
    submitRental,
    activateRental,
    rejectRental,
  };
})();
