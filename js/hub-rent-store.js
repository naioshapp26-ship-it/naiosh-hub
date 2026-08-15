/**
 * مخزن استئجار الأنظمة من HUB — صلاحيات الظهور + طلبات + صب دومين + Adapter ERP
 */
(() => {
  'use strict';

  const KEY = 'naiosh_hub_system_rentals_v1';
  const API = '/api/hub/system-rentals';
  const ERP_VALIDATE = '/api/hub/adapters/erp/validate-subdomain';
  const ERP_PROVISION = '/api/hub/adapters/erp/provision';
  const BASE_DOMAIN = 'naiosh.app';
  const RESERVED = new Set(['www', 'app', 'api', 'admin', 'saas', 'hub', 'mail', 'ftp']);
  const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

  const PLAN_META = {
    basic: { label: 'Basic (مجاني)', amount: 'مجاني', price: 0 },
    pro: { label: 'Pro — $49/شهر', amount: '$49', price: 49 },
    enterprise: { label: 'Enterprise — $199/شهر', amount: '$199', price: 199 },
  };

  const RENTABLE_CODES = ['ERP', 'LAW', 'NAIS', 'FIT', 'ACADEMY', 'SMARTX', 'EDUSMARTX', 'EDUNAIOSH', 'LMS', 'CRM'];

  const blank = () => ({
    version: 1,
    visibility: {},
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
    try {
      window.dispatchEvent?.(new CustomEvent('hub:system-rentals', { detail: state }));
    } catch {
      /* ignore */
    }
    return state;
  };

  const uid = (p = 'rent') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  /** لا ترفع كلمة المرور لملف السيرفر — تبقى محلية حتى التجهيز */
  const publicState = (state) => ({
    version: state.version || 1,
    visibility: state.visibility || {},
    rentals: (state.rentals || []).map((r) => {
      const copy = { ...r };
      delete copy.adminPassword;
      return copy;
    }),
  });

  const syncRemote = async (state) => {
    try {
      await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(publicState(state)),
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
        const local = readLocal();
        const remoteRentals = Array.isArray(data.state.rentals) ? data.state.rentals : [];
        // حافظ على كلمات المرور المحلية إن وُجدت لنفس الـ id
        const pwdMap = Object.fromEntries(
          (local.rentals || []).filter((r) => r.adminPassword).map((r) => [r.id, r.adminPassword])
        );
        const merged = {
          ...blank(),
          ...data.state,
          rentals: remoteRentals.map((r) => (pwdMap[r.id] ? { ...r, adminPassword: pwdMap[r.id] } : r)),
        };
        // أبقِ الطلبات المحلية الأحدث غير الموجودة في السيرفر
        const remoteIds = new Set(merged.rentals.map((r) => r.id));
        (local.rentals || []).forEach((r) => {
          if (!remoteIds.has(r.id)) merged.rentals.unshift(r);
        });
        return saveLocal(merged);
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
    if (filtered.length) {
      return filtered.map((a) => ({
        code: String(a.code).toUpperCase(),
        nameAr: a.nameAr || a.code,
        icon: a.icon || 'fa-cube',
        isLive: Boolean(a.isLive || window.HubLiveSystems?.isLive?.(a.code)),
      }));
    }
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

  const validateSubdomainLocal = (slug) => {
    const val = normalizeSlug(slug);
    if (!val) return { ok: false, available: false, message: 'أدخل النطاق الفرعي للتحقق من توفره' };
    if (val.length < 2) return { ok: false, available: false, message: 'أدخل حرفين على الأقل' };
    if (!SUBDOMAIN_RE.test(val) || RESERVED.has(val)) {
      return { ok: false, available: false, message: 'استخدم أحرفاً إنجليزية صغيرة وأرقاماً وشرطات فقط' };
    }
    const taken = readLocal().rentals.some(
      (r) => r.slug === val && ['pending', 'active', 'provisioning'].includes(r.status)
    );
    if (taken) return { ok: false, available: false, message: 'غير متاح في هوب' };
    try {
      const ops = window.HubSystemOps?.read?.();
      if (ops?.subdomains?.some((s) => s.slug === val && s.status === 'active')) {
        return { ok: false, available: false, message: 'غير متاح' };
      }
    } catch {
      /* ignore */
    }
    return { ok: true, available: true, message: 'متاح في هوب', slug: val, host: `${val}.${BASE_DOMAIN}` };
  };

  const validateSubdomain = (slug) => validateSubdomainLocal(slug);

  const validateSubdomainAsync = async (slug, { checkErp = true } = {}) => {
    const local = validateSubdomainLocal(slug);
    if (!local.available) return local;
    if (!checkErp) return { ...local, message: 'متاح في هوب' };
    try {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
      const res = await fetch(ERP_VALIDATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: local.slug }),
        signal: ctrl?.signal,
      });
      if (timer) clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      if (data?.available === false) {
        const msg = String(data.message || '');
        // حد محاولات ERP أو انشغال مؤقت → لا نمنع الحجز في هوب
        if (/محاولات|انتظر|rate|تجاوز|busy|timeout|تعذ/i.test(msg)) {
          return { ...local, message: 'متاح في هوب (ERP مشغول مؤقتًا)', erpDeferred: true };
        }
        return { ok: false, available: false, message: msg || 'غير متاح في ERP', slug: local.slug };
      }
      if (data?.available) {
        return {
          ok: true,
          available: true,
          message: 'متاح في هوب وERP',
          slug: local.slug,
          host: local.host,
          erpChecked: true,
        };
      }
      if (data?.degraded) {
        return { ...local, message: data.message || 'متاح في هوب (تحقق ERP مؤجل)', erpDeferred: true };
      }
    } catch {
      /* fallback local-only */
    }
    return { ...local, message: 'متاح في هوب (تعذّر التحقق من ERP مؤقتًا)' };
  };

  const listRentals = () =>
    readLocal()
      .rentals.slice()
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));

  const getRental = (id) => listRentals().find((r) => String(r.id) === String(id)) || null;

  const submitRental = (payload = {}) => {
    const companyName = String(payload.companyName || '').trim();
    const slugCheck = validateSubdomainLocal(payload.slug || payload.subdomain);
    const adminName = String(payload.adminName || '').trim();
    const adminPhone = String(payload.adminPhone || '').trim();
    const adminEmail = String(payload.adminEmail || '').trim().toLowerCase();
    const adminPassword = String(payload.adminPassword || '');
    const plan = PLAN_META[payload.plan] ? payload.plan : 'basic';
    const systems = [...new Set((payload.systems || []).map((c) => String(c).toUpperCase()))].filter((c) =>
      RENTABLE_CODES.includes(c)
    );
    const payMethod = String(payload.payMethod || 'hub').trim();

    if (!companyName || !adminName || !adminPhone || !adminPassword) {
      return { ok: false, error: 'يرجى ملء جميع الحقول المطلوبة *' };
    }
    if (adminPassword.length < 8) return { ok: false, error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' };
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
      adminPassword,
      plan,
      planLabel: PLAN_META[plan].label,
      amount: PLAN_META[plan].amount,
      systems,
      payMethod,
      status: plan === 'basic' ? 'provisioning' : 'pending',
      erp: null,
      createdAt: now,
      updatedAt: now,
    };

    const state = readLocal();
    state.rentals.unshift(rental);
    saveLocal(state);
    syncRemote(state);
    return { ok: true, rental };
  };

  const applyLocalActivation = (row) => {
    row.status = 'active';
    row.activatedAt = new Date().toISOString();
    row.updatedAt = row.activatedAt;
    delete row.adminPassword;

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
      /* ignore */
    }

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
  };

  const provisionErp = async (row) => {
    if (!(row.systems || []).includes('ERP')) {
      return { ok: true, skipped: true };
    }
    if (!row.adminPassword) {
      return { ok: false, error: 'كلمة المرور غير متوفرة لتجهيز ERP — أعد تقديم الطلب' };
    }
    const res = await fetch(ERP_PROVISION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subdomain: row.slug,
        companyName: row.companyName,
        plan: row.plan,
        adminName: row.adminName,
        adminPhone: row.adminPhone,
        adminEmail: row.adminEmail,
        adminPassword: row.adminPassword,
        systems: row.systems,
        payMethod: row.payMethod || 'hub',
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.pendingPayment) {
      return {
        ok: false,
        pendingPayment: true,
        paymentUrl: data.paymentUrl,
        token: data.token,
        error: data.message || 'يلزم دفع ERP',
      };
    }
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || data.message || 'فشل ربط ERP' };
    }
    return {
      ok: true,
      erp: {
        token: data.token,
        loginUrl: data.loginUrl,
        hostPath: data.hostPath,
        provisionedAt: new Date().toISOString(),
        message: data.message,
      },
    };
  };

  const activateRental = (id) => {
    const state = readLocal();
    const row = state.rentals.find((r) => String(r.id) === String(id));
    if (!row) return { ok: false, error: 'الطلب غير موجود' };
    applyLocalActivation(row);
    saveLocal(state);
    syncRemote(state);
    return { ok: true, rental: row };
  };

  const activateRentalAsync = async (id) => {
    const state = readLocal();
    const row = state.rentals.find((r) => String(r.id) === String(id));
    if (!row) return { ok: false, error: 'الطلب غير موجود' };

    row.status = 'provisioning';
    row.updatedAt = new Date().toISOString();
    saveLocal(state);

    const erp = await provisionErp(row);
    if (!erp.ok) {
      row.status = row.plan === 'basic' ? 'provisioning' : 'pending';
      row.erpError = erp.error;
      saveLocal(state);
      syncRemote(state);
      return { ok: false, error: erp.error, pendingPayment: erp.pendingPayment, paymentUrl: erp.paymentUrl };
    }

    if (erp.erp) row.erp = erp.erp;
    applyLocalActivation(row);
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
    delete row.adminPassword;
    saveLocal(state);
    syncRemote(state);
    return { ok: true, rental: row };
  };

  const listMine = (email = '') => {
    const key = String(email || window.HubAuth?.getUser?.()?.email || '')
      .trim()
      .toLowerCase();
    const all = listRentals().filter((r) => r.status === 'active' || r.status === 'pending' || r.status === 'provisioning');
    if (!key) return all;
    return all.filter((r) => String(r.adminEmail || '').toLowerCase() === key);
  };

  /** رابط فتح النظام المستأجر مع SSO من هوب */
  const buildOpenUrl = async (rental, { systemCode } = {}) => {
    if (!rental) return { ok: false, error: 'لا يوجد طلب' };
    const code = String(systemCode || rental.systems?.[0] || 'ERP').toUpperCase();
    const erpOrigin = 'https://web-production-419e2.up.railway.app';

    let base;
    if (code === 'ERP' && rental.slug) {
      // صفحة الدخول تحتفظ بـ query (مسار /t/{slug} يعمل redirect ويمسح المعاملات)
      base = `${erpOrigin}/login-page.html?tenant=${encodeURIComponent(rental.slug)}`;
    } else {
      base =
        rental.erp?.loginUrl ||
        window.HubLiveSystems?.url?.(code) ||
        `apps.html#${code.toLowerCase()}`;
    }

    // جلسة هوب خفيفة إن لم يكن مسجلاً — من بيانات الاستئجار
    if (!window.HubAuth?.isLoggedIn?.() && rental.adminEmail) {
      window.HubAuth?.setSession?.(
        {
          email: rental.adminEmail,
          name: rental.adminName || rental.companyName,
          role: 'tenant_admin',
        },
        `rent-${rental.id}`,
        { remember: true }
      );
    }

    const ticket = await window.HubAuth?.issueHubTicket?.({
      email: rental.adminEmail || window.HubAuth?.getUser?.()?.email,
      name: rental.adminName || rental.companyName,
      systemCode: code,
      tenant: rental.slug,
      subdomain: rental.slug,
      rentalId: rental.id,
      permissions: ['read', 'write'],
    });

    if (window.HubAuth?.attachSsoParams) {
      base = window.HubAuth.attachSsoParams(base, code, {
        tenant: rental.slug,
        subdomain: rental.slug,
        hubTicket: ticket?.token || '',
        hubSig: ticket?.sig || '',
        from: 'hub-rent',
      });
    } else if (window.HubLauncher?.withLaunchParams) {
      base = window.HubLauncher.withLaunchParams(base, {
        from: 'hub-rent',
        systemCode: code,
        tenant: rental.slug,
        subdomain: rental.slug,
      });
    }
    return {
      ok: true,
      url: base,
      tenantHome: rental.erp?.loginUrl || (rental.slug ? `${erpOrigin}/t/${rental.slug}` : ''),
      ticket: ticket?.ok ? ticket : null,
    };
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
    validateSubdomainAsync,
    normalizeSlug,
    listRentals,
    listMine,
    getRental,
    submitRental,
    activateRental,
    activateRentalAsync,
    rejectRental,
    provisionErp,
    buildOpenUrl,
  };
})();