/**
 * طلبات منح المنصة — مجانًا بعد موافقة أدمن هوب · بدون دفع
 */
(() => {
  'use strict';

  const KEY = 'naiosh_hub_platform_grants_v1';
  const API = '/api/hub/platform-grants';
  const BASE_DOMAIN = 'naiosh.app';
  const RESERVED = new Set(['www', 'app', 'api', 'admin', 'saas', 'hub', 'mail', 'ftp']);
  const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  const FREE_QUOTA = 300;

  const blank = () => ({
    version: 1,
    grants: [],
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
      window.dispatchEvent?.(new CustomEvent('hub:platform-grants', { detail: state }));
    } catch {
      /* ignore */
    }
    return state;
  };

  const uid = (p = 'pgrant') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const publicState = (state) => ({
    version: state.version || 1,
    grants: (state.grants || []).map((g) => {
      const copy = { ...g };
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
        const remote = Array.isArray(data.state.grants) ? data.state.grants : [];
        const pwdMap = Object.fromEntries(
          (local.grants || []).filter((g) => g.adminPassword).map((g) => [g.id, g.adminPassword])
        );
        const merged = {
          ...blank(),
          ...data.state,
          grants: remote.map((g) => (pwdMap[g.id] ? { ...g, adminPassword: pwdMap[g.id] } : g)),
        };
        const remoteIds = new Set(merged.grants.map((g) => g.id));
        (local.grants || []).forEach((g) => {
          if (!remoteIds.has(g.id)) merged.grants.unshift(g);
        });
        return saveLocal(merged);
      }
    } catch {
      /* local */
    }
    return readLocal();
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
    const taken = readLocal().grants.some(
      (g) => g.slug === val && ['pending', 'active'].includes(g.status)
    );
    if (taken) return { ok: false, available: false, message: 'غير متاح — مستخدم في طلب منصة آخر' };
    try {
      const rentTaken = window.HubRentStore?.listRentals?.()?.some(
        (r) => r.slug === val && ['pending', 'active', 'provisioning'].includes(r.status)
      );
      if (rentTaken) return { ok: false, available: false, message: 'غير متاح — مستخدم في استئجار نظام' };
    } catch {
      /* ignore */
    }
    return { ok: true, available: true, message: 'متاح في هوب', slug: val, host: `${val}.${BASE_DOMAIN}` };
  };

  const listGrants = () =>
    readLocal()
      .grants.slice()
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));

  const getGrant = (id) => listGrants().find((g) => String(g.id) === String(id)) || null;

  const activeGrantFor = (email = '') => {
    const key = String(email || '').trim().toLowerCase();
    if (!key) return null;
    return listGrants().find((g) => g.status === 'active' && String(g.adminEmail || '').toLowerCase() === key) || null;
  };

  const ACCOUNTS_KEY = 'naiosh_hub_tenant_accounts_v1';

  const readAccounts = () => {
    try {
      const list = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };

  const saveAccounts = (list) => {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
    return list;
  };

  const findAccount = (email = '') => {
    const key = String(email || '').trim().toLowerCase();
    if (!key) return null;
    return readAccounts().find((a) => String(a.email || '').toLowerCase() === key) || null;
  };

  const upsertAccount = (account) => {
    const email = String(account.email || '').trim().toLowerCase();
    if (!email) return null;
    const list = readAccounts().filter((a) => String(a.email || '').toLowerCase() !== email);
    list.unshift({ ...account, email });
    saveAccounts(list);
    syncAccountsRemote(list);
    return list[0];
  };

  const syncAccountsRemote = async (accounts) => {
    const payload = (accounts || readAccounts()).map((a) => ({
      email: a.email,
      password: a.password,
      name: a.name,
      role: a.role,
      systemCode: a.systemCode,
      host: a.host,
      grantId: a.grantId,
      status: a.status,
      approvedAt: a.approvedAt,
    }));
    try {
      await fetch('/api/hub/tenant-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 1, accounts: payload }),
      });
    } catch {
      /* offline ok */
    }
  };

  /** يعيد بناء حسابات المستأجرين من الطلبات المفعّلة ويرفعها للسيرفر */
  const syncAccountsFromGrants = () => {
    listGrants()
      .filter((g) => g.status === 'active' && g.adminEmail && g.adminPassword)
      .forEach((g) => {
        const email = String(g.adminEmail).trim().toLowerCase();
        const existing = findAccount(email);
        if (existing?.status === 'active') return;
        upsertAccount({
          email,
          password: g.adminPassword,
          name: g.adminName || g.companyName || email,
          role: 'platform_owner',
          systemCode: g.grantedSystemCode || g.requestedSystem || '',
          host: g.host || '',
          grantId: g.id,
          status: 'active',
          approvedAt: g.approvedAt || g.updatedAt,
        });
      });
    return syncAccountsRemote(readAccounts());
  };

  const ensureTenantLogin = async (payload = {}) => {
    const email = String(payload.email || '').trim().toLowerCase();
    const password = String(payload.password || '');
    const grant = payload.grant || grantForEmail(email);
    if (!email || !password) return { ok: false, error: 'الإيميل وكلمة المرور مطلوبان' };
    if (!grant || grant.status !== 'active') return { ok: false, error: 'لا يوجد طلب مفعّل لهذا الإيميل' };
    const account = {
      email,
      password,
      name: grant.adminName || grant.companyName || email,
      role: 'platform_owner',
      systemCode: grant.grantedSystemCode || grant.requestedSystem || '',
      host: grant.host || '',
      grantId: grant.id,
      status: 'active',
      approvedAt: grant.approvedAt || grant.updatedAt,
    };
    upsertAccount(account);
    try {
      await fetch('/api/hub/tenant-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(account),
      });
    } catch {
      /* local ok */
    }
    return { ok: true, email };
  };

  const grantForEmail = (email = '') => {
    const key = String(email || '').trim().toLowerCase();
    if (!key) return null;
    return (
      listGrants().find((g) => String(g.adminEmail || '').toLowerCase() === key) ||
      null
    );
  };

  const submitRequest = (payload = {}) => {
    const adminName = String(payload.adminName || payload.fullName || '').trim();
    const adminPhone = String(payload.adminPhone || payload.phone || '').trim();
    const adminEmail = String(payload.adminEmail || payload.email || '').trim().toLowerCase();
    const adminPassword = String(payload.adminPassword || payload.password || '');
    const platform = String(payload.platform || '').trim();
    const platformLabel = String(payload.platformLabel || platform).trim();
    const companyName = String(payload.companyName || platformLabel || adminName).trim();
    const slugCheck = validateSubdomain(payload.slug || payload.subdomain);
    const country = String(payload.country || '').trim();
    const branch = String(payload.branch || '').trim();
    const branchLabel = String(payload.branchLabel || branch).trim();
    const incubator = String(payload.incubator || '').trim();
    const incubatorLabel = String(payload.incubatorLabel || incubator).trim();
    const requestedSystem = String(payload.requestedSystem || payload.systemCode || '').trim().toUpperCase();
    const requestedSystemLabel = String(payload.requestedSystemLabel || requestedSystem).trim();
    const notes = String(payload.notes || '').trim();
    const source = String(payload.source || (payload.branch || payload.incubator ? 'register' : 'platform')).trim() || 'platform';

    if (!adminName || !adminPhone || !adminEmail || !adminPassword) {
      return { ok: false, error: 'يرجى ملء جميع الحقول المطلوبة' };
    }
    if (adminPassword.length < 8) return { ok: false, error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' };
    if (!slugCheck.available) return { ok: false, error: slugCheck.message || 'النطاق الفرعي غير صالح' };
    if (!platform) return { ok: false, error: 'اختر اسم المنصة' };
    if (source === 'register') {
      if (!country) return { ok: false, error: 'اختر الدولة' };
      if (!branch) return { ok: false, error: 'اختر اسم الفرع' };
      if (!incubator) return { ok: false, error: 'اختر اسم الحاضنة' };
      if (!requestedSystem) return { ok: false, error: 'اختر النظام الذي تريد تشغيله' };
    }

    const now = new Date().toISOString();
    const grant = {
      id: uid('pgrant'),
      kind: source === 'register' ? 'signup' : 'platform',
      source,
      companyName,
      slug: slugCheck.slug,
      host: slugCheck.host,
      adminName,
      adminPhone,
      adminEmail,
      adminPassword,
      country,
      branch,
      branchLabel,
      incubator,
      incubatorLabel,
      platform,
      platformLabel,
      requestedSystem,
      requestedSystemLabel,
      notes,
      plan: 'free',
      planLabel: 'باقة مجانية',
      freeQuota: FREE_QUOTA,
      freeRemaining: FREE_QUOTA,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    const state = readLocal();
    state.grants = state.grants || [];
    state.grants.unshift(grant);
    saveLocal(state);
    syncRemote(state);

    try {
      window.HubStore?.pushFeed?.(
        'decision',
        `طلب سجل معنا بانتظار السوبر أدمن: ${platformLabel} · ${requestedSystem} · ${adminName}`
      );
      window.HubStore?.pushNotification?.({
        source: 'HUB',
        sourceName: 'نايوش هوب',
        title: 'طلب تسجيل بانتظار الموافقة',
        body: `${adminName} · ${platformLabel} · ${requestedSystem} · ${slugCheck.host}`,
        level: 'info',
        category: 'signup',
        link: 'rent-admin.html',
      });
    } catch {
      /* ignore */
    }

    return { ok: true, grant };
  };

  const approveGrant = (id) => {
    const state = readLocal();
    const row = (state.grants || []).find((g) => String(g.id) === String(id));
    if (!row) return { ok: false, error: 'الطلب غير موجود' };
    if (row.status === 'active') return { ok: true, grant: row };
    if (row.status === 'rejected') return { ok: false, error: 'الطلب مرفوض مسبقًا' };

    row.status = 'active';
    row.plan = 'free';
    row.planLabel = 'باقة مجانية';
    row.freeQuota = Number(row.freeQuota) || FREE_QUOTA;
    row.freeRemaining = Number(row.freeRemaining ?? row.freeQuota) || FREE_QUOTA;
    row.approvedAt = new Date().toISOString();
    row.updatedAt = row.approvedAt;
    const password = row.adminPassword || '';
    delete row.adminPassword;

    const systemCode = String(row.requestedSystem || row.platform || 'ERP').toUpperCase();
    const tenantName = row.adminName || row.companyName;
    const email = String(row.adminEmail || '').toLowerCase();

    try {
      if (window.HubSystemOps?.grantSubdomain) {
        window.HubSystemOps.grantSubdomain({
          tenantName: row.companyName || tenantName,
          systemCode,
          baseDomain: BASE_DOMAIN,
          slug: row.slug,
          branchOrHq: row.branchLabel || row.branch || '',
          incubator: row.incubatorLabel || row.incubator || '',
          platformName: row.platformLabel || row.platform || '',
        });
      }
    } catch {
      /* ignore */
    }

    try {
      window.HubSystemOps?.grantStructure?.({
        type: 'platform',
        nameAr: row.platformLabel || row.platform || row.companyName,
        tenantName: tenantName,
        systemCode,
      });
    } catch {
      /* ignore */
    }

    try {
      window.HubSystemOps?.assignRole?.({
        user: email || tenantName,
        roleId: 'owner',
        systemCode,
      });
    } catch {
      /* ignore */
    }

    try {
      window.HubSystemOps?.registerMembership?.({
        name: tenantName,
        email,
        plan: 'تشغيلي',
        systemCode,
      });
    } catch {
      /* ignore */
    }

    try {
      const granted = window.HubStore?.grantSubscription?.({
        email,
        systemCode,
        plan: 'standard',
        permissions: ['read', 'write'],
        source: 'signup-approve',
      });
      row.systemGranted = Boolean(granted?.id);
      row.grantedSystemCode = granted?.systemCode || systemCode;
      if (!granted) row.systemGrantError = window.HubStore?.grantSubscription ? 'grant returned null' : 'HubStore missing';
    } catch (err) {
      row.systemGranted = false;
      row.systemGrantError = String(err?.message || err);
    }

    try {
      if (email && password) {
        upsertAccount({
          email,
          password,
          name: tenantName,
          role: 'platform_owner',
          systemCode,
          host: row.host,
          grantId: row.id,
          status: 'active',
          approvedAt: row.approvedAt,
        });
      }
    } catch {
      /* ignore */
    }

    try {
      const freeKey = 'hubFreeBalancePoints';
      const cur = Number(localStorage.getItem(freeKey));
      if (!Number.isFinite(cur) || cur <= 0) {
        localStorage.setItem(freeKey, String(row.freeRemaining || FREE_QUOTA));
      }
      window.HubHeroBalance?.render?.();
    } catch {
      /* ignore */
    }

    try {
      window.HubStore?.pushFeed?.(
        'decision',
        `اعتماد سجل معنا: ${row.platformLabel || row.platform} · نظام ${systemCode} · ${row.companyName}`
      );
      window.HubStore?.pushNotification?.({
        source: 'HUB',
        sourceName: 'نايوش هوب',
        title: `تم منح نظام ${systemCode}`,
        body: `الدومين ${row.host} وصلاحيات التشغيل لصاحب المنصة ${email || tenantName}`,
        level: 'success',
        category: 'subscription',
        link: 'roles-permissions.html',
      });
    } catch {
      /* ignore */
    }

    saveLocal(state);
    syncRemote(state);
    return { ok: true, grant: row };
  };

  const rejectGrant = (id) => {
    const state = readLocal();
    const row = (state.grants || []).find((g) => String(g.id) === String(id));
    if (!row) return { ok: false, error: 'الطلب غير موجود' };
    row.status = 'rejected';
    row.updatedAt = new Date().toISOString();
    delete row.adminPassword;
    saveLocal(state);
    syncRemote(state);
    return { ok: true, grant: row };
  };

  /** هل يمكن استخدام المنصة؟ إن نفدت الباقة المجانية → اشحن رصيدك */
  const canUsePlatform = (email = '') => {
    const grant = activeGrantFor(email);
    if (!grant) {
      return { ok: false, reason: 'none', message: 'لا منصة مفعّلة — أرسل طلبًا وانتظر موافقة الأدمن' };
    }

    const freePts = (() => {
      try {
        if (typeof window.HubHeroBalance?.readFree === 'function') return window.HubHeroBalance.readFree();
      } catch {
        /* fall through */
      }
      const n = Number(localStorage.getItem('hubFreeBalancePoints'));
      return Number.isFinite(n) ? n : Number(grant.freeRemaining) || 0;
    })();

    const paidPts = (() => {
      try {
        if (typeof window.HubHeroBalance?.paidBalance === 'function') return window.HubHeroBalance.paidBalance();
      } catch {
        /* fall through */
      }
      return Number(localStorage.getItem('hubPaidBalancePoints')) || 0;
    })();

    if (freePts > 0 || paidPts > 0) {
      return {
        ok: true,
        grant,
        freePts,
        paidPts,
        message: freePts > 0 ? 'باقة مجانية نشطة' : 'رصيد مدفوع نشط',
      };
    }

    return {
      ok: false,
      reason: 'exhausted',
      grant,
      freePts: 0,
      paidPts: 0,
      message: 'انتهت الباقة المجانية — اشحن رصيدك للمتابعة',
    };
  };

  const consumeFreePoint = (email = '', amount = 1) => {
    const amt = Math.max(1, Math.floor(Number(amount) || 1));
    const gate = canUsePlatform(email);
    if (!gate.ok) return gate;

    const freeKey = 'hubFreeBalancePoints';
    let freePts = gate.freePts;
    if (freePts > 0) {
      freePts = Math.max(0, freePts - amt);
      localStorage.setItem(freeKey, String(freePts));
      window.HubHeroBalance?.render?.();
    }

    const state = readLocal();
    const row = (state.grants || []).find((g) => String(g.id) === String(gate.grant.id));
    if (row) {
      row.freeRemaining = freePts;
      row.updatedAt = new Date().toISOString();
      saveLocal(state);
    }

    if (freePts <= 0 && (gate.paidPts || 0) <= 0) {
      return {
        ok: false,
        reason: 'exhausted',
        grant: row || gate.grant,
        message: 'انتهت الباقة المجانية — اشحن رصيدك للمتابعة',
      };
    }
    return { ok: true, freePts, grant: row || gate.grant };
  };

  window.HubPlatformGrants = {
    BASE_DOMAIN,
    FREE_QUOTA,
    ACCOUNTS_KEY,
    hydrate,
    normalizeSlug,
    validateSubdomain,
    listGrants,
    getGrant,
    activeGrantFor,
    grantForEmail,
    syncAccountsFromGrants,
    ensureTenantLogin,
    submitRequest,
    approveGrant,
    rejectGrant,
    canUsePlatform,
    consumeFreePoint,
    findAccount,
  };
})();
