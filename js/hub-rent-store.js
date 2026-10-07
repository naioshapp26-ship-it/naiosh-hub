/**
 * مخزن استئجار الأنظمة من HUB — صلاحيات الظهور + طلبات + صب دومين + Adapter ERP
 */
(() => {
  'use strict';

  const KEY = 'naiosh_hub_system_rentals_v1';
  const GUEST_SCOPE_KEY = 'naiosh_hub_rent_guest_scope';
  const API = '/api/hub/system-rentals';
  const ERP_VALIDATE = '/api/hub/adapters/erp/validate-subdomain';
  const ERP_PROVISION = '/api/hub/adapters/erp/provision';
  const BASE_DOMAIN = 'naiosh.app';
  const RESERVED = new Set(['www', 'app', 'api', 'admin', 'saas', 'hub', 'mail', 'ftp']);
  const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

  /** Per-tab guest scope so Guest B never inherits Guest A localStorage PII */
  const guestBrowserScope = () => {
    try {
      let scope = sessionStorage.getItem(GUEST_SCOPE_KEY);
      if (!scope) {
        scope = `gs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        sessionStorage.setItem(GUEST_SCOPE_KEY, scope);
      }
      return scope;
    } catch {
      return `gs-ephemeral-${Date.now().toString(36)}`;
    }
  };

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

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  const isValidPhone = (phone) => {
    const raw = String(phone || '').trim();
    const digits = raw.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15 && /^\+?[0-9]+$/.test(raw);
  };

  const authHeaders = (extra = {}) =>
    window.HubAuth?.authHeaders?.({ 'Content-Type': 'application/json', ...extra }) || {
      'Content-Type': 'application/json',
      ...extra,
    };

  /** Staff-only full sync — guests must never overwrite the shared store */
  const syncRemote = async (state) => {
    if (!window.HubAuth?.isStaff?.()) return;
    try {
      await fetch(API, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(publicState(state)),
      });
    } catch {
      /* offline ok */
    }
  };

  const pushRentalToServer = async (rental, { idempotencyKey = '' } = {}) => {
    const res = await fetch(`${API}/submit`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        idempotencyKey,
        customerId: '',
        owner: {
          name: rental.adminName,
          email: rental.adminEmail,
          phone: rental.adminPhone,
        },
        rental: {
          companyName: rental.companyName,
          slug: rental.slug,
          subdomain: rental.slug,
          adminName: rental.adminName,
          adminPhone: rental.adminPhone,
          adminEmail: rental.adminEmail,
          plan: rental.plan,
          systems: rental.systems,
          payMethod: rental.payMethod,
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const err = new Error(data.error || 'تعذر حفظ طلب الاستئجار على الخادم');
      err.status = res.status;
      err.field = data.field;
      err.code = data.code;
      throw err;
    }
    return data;
  };

  const hydrate = async () => {
    const logged = !!window.HubAuth?.isLoggedIn?.();
    const sessionEmail = String(window.HubAuth?.getUser?.()?.email || '')
      .trim()
      .toLowerCase();
    const scope = guestBrowserScope();
    try {
      const res = await fetch(API, { cache: 'no-store', headers: authHeaders({ Accept: 'application/json' }) });
      if (!res.ok) return readLocal();
      const data = await res.json();
      if (data?.ok && data?.state) {
        const local = readLocal();
        const remoteRentals = Array.isArray(data.state.rentals) ? data.state.rentals : [];
        const pwdMap = Object.fromEntries(
          (local.rentals || []).filter((r) => r.adminPassword).map((r) => [r.id, r.adminPassword])
        );
        // Anonymous/public responses intentionally omit other guests' rentals.
        // Keep only THIS tab's guest-scoped local rentals (or the logged-in customer's own).
        const remoteIds = new Set(remoteRentals.map((r) => r.id));
        const localMine = (local.rentals || []).filter((r) => {
          if (remoteIds.has(r.id)) return false;
          if (!r.adminEmail && !r.guestContactId && !r.requestId) return false;
          if (logged && sessionEmail) {
            return String(r.adminEmail || '').toLowerCase() === sessionEmail;
          }
          return r.guestBrowserScope === scope;
        });
        const merged = {
          ...blank(),
          visibility: data.state.visibility || local.visibility || {},
          rentals: [
            ...remoteRentals.map((r) => (pwdMap[r.id] ? { ...r, adminPassword: pwdMap[r.id] } : r)),
            ...localMine,
          ],
        };
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

  const submitRental = async (payload = {}) => {
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
    const idempotencyKey = String(payload.idempotencyKey || '').trim();

    if (!companyName || !adminName || !adminPhone || !adminEmail || !adminPassword) {
      return { ok: false, error: 'يرجى ملء جميع الحقول المطلوبة *', field: !adminEmail ? 'email' : !adminPhone ? 'phone' : 'name' };
    }
    if (!isValidEmail(adminEmail)) return { ok: false, error: 'البريد الإلكتروني غير صالح', field: 'email' };
    if (!isValidPhone(adminPhone)) return { ok: false, error: 'رقم الهاتف غير صالح', field: 'phone' };
    if (adminPassword.length < 8) return { ok: false, error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' };
    if (!slugCheck.available) return { ok: false, error: slugCheck.message || 'النطاق الفرعي غير صالح' };
    if (!systems.length) return { ok: false, error: 'اختر نظامًا واحدًا على الأقل' };

    const allowed = visibleCodesFor(adminEmail);
    const blocked = systems.filter((c) => !allowed.includes(c));
    if (blocked.length) {
      return { ok: false, error: `الأنظمة غير مسموحة لصلاحياتك: ${blocked.join(', ')}` };
    }

    const logged = !!window.HubAuth?.isLoggedIn?.();
    const sessionUser = window.HubAuth?.getUser?.() || {};
    const isCustomer = logged && ['customer', 'client'].includes(String(sessionUser.role || '').toLowerCase());

    let serverRental = null;
    try {
      const pushed = await pushRentalToServer(
        {
          companyName,
          slug: slugCheck.slug,
          adminName,
          adminPhone,
          adminEmail,
          plan,
          systems,
          payMethod,
        },
        { idempotencyKey }
      );
      serverRental = pushed.rental;
    } catch (err) {
      return { ok: false, error: err.message || 'تعذر إرسال الطلب', field: err.field, code: err.code };
    }

    const now = new Date().toISOString();
    const ownerType = serverRental.ownerType || (isCustomer ? 'Customer' : 'Guest');
    const rental = {
      id: serverRental.id,
      requestId: serverRental.requestId,
      ownerType,
      customerId: serverRental.customerId || '',
      guestContactId: serverRental.guestContactId || '',
      guestBrowserScope: ownerType === 'Guest' ? guestBrowserScope() : '',
      isGuest: ownerType === 'Guest',
      companyName,
      slug: slugCheck.slug,
      host: slugCheck.host,
      adminName: serverRental.adminName || adminName,
      adminPhone: serverRental.adminPhone || adminPhone,
      adminEmail: serverRental.adminEmail || adminEmail,
      adminPassword,
      plan,
      planLabel: PLAN_META[plan].label,
      amount: PLAN_META[plan].amount,
      systems,
      payMethod,
      status: serverRental.status || 'pending',
      statusLabel: serverRental.statusLabel || 'بانتظار المراجعة',
      erp: null,
      sourceModule: 'سجل أنظمة هوب',
      requestType: 'System Rental',
      createdAt: serverRental.createdAt || now,
      updatedAt: now,
      submittedAt: serverRental.submittedAt || now,
      idempotencyKey: idempotencyKey || null,
    };

    const state = readLocal();
    const idx = state.rentals.findIndex((r) => r.id === rental.id || r.requestId === rental.requestId);
    if (idx >= 0) state.rentals[idx] = { ...state.rentals[idx], ...rental };
    else state.rentals.unshift(rental);
    saveLocal(state);
    return { ok: true, rental, duplicate: false };
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

  const patchRentalStatus = async (id, status, { reason = '' } = {}) => {
    const res = await fetch(`${API}/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status, reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const err = new Error(data.error || 'تعذر تحديث حالة الطلب');
      err.status = res.status;
      throw err;
    }
    return data.rental;
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
    const row = state.rentals.find((r) => String(r.id) === String(id) || String(r.requestId) === String(id));
    if (!row) return { ok: false, error: 'الطلب غير موجود' };

    row.status = 'provisioning';
    row.updatedAt = new Date().toISOString();
    saveLocal(state);

    try {
      await patchRentalStatus(row.id || id, 'provisioning');
    } catch (err) {
      // Staff-only on server; local provision may still proceed for legacy flows
      if (err.status && err.status !== 403) {
        row.status = 'pending';
        saveLocal(state);
        return { ok: false, error: err.message };
      }
    }

    const erp = await provisionErp(row);
    if (!erp.ok) {
      row.status = 'pending';
      row.erpError = erp.error;
      saveLocal(state);
      try {
        await patchRentalStatus(row.id || id, 'pending');
      } catch {
        /* ignore */
      }
      syncRemote(state);
      return { ok: false, error: erp.error, pendingPayment: erp.pendingPayment, paymentUrl: erp.paymentUrl };
    }

    if (erp.erp) row.erp = erp.erp;
    applyLocalActivation(row);
    saveLocal(state);
    try {
      const serverRow = await patchRentalStatus(row.id || id, 'active');
      if (serverRow) {
        row.status = serverRow.status || row.status;
        row.statusLabel = serverRow.statusLabel || row.statusLabel;
        row.approvedAt = serverRow.approvedAt || row.approvedAt;
        row.adminEmail = serverRow.adminEmail || row.adminEmail;
        row.adminPhone = serverRow.adminPhone || row.adminPhone;
        row.adminName = serverRow.adminName || row.adminName;
        row.guestContactId = serverRow.guestContactId || row.guestContactId;
        row.requestId = serverRow.requestId || row.requestId;
        saveLocal(state);
      }
    } catch (err) {
      if (err.status === 403) {
        syncRemote(state);
      } else {
        return { ok: false, error: err.message || 'تم التجهيز محليًا لكن فشل اعتماد الخادم' };
      }
    }
    syncRemote(state);
    return { ok: true, rental: row };
  };

  const rejectRental = async (id, reason = '') => {
    const state = readLocal();
    const row = state.rentals.find((r) => String(r.id) === String(id) || String(r.requestId) === String(id));
    if (!row) return { ok: false, error: 'الطلب غير موجود' };
    try {
      const serverRow = await patchRentalStatus(row.id || id, 'rejected', { reason });
      row.status = serverRow.status || 'rejected';
      row.statusLabel = serverRow.statusLabel || 'مرفوض';
      row.rejectReason = serverRow.rejectReason || String(reason || '').trim();
    } catch (err) {
      if (err.status !== 403) return { ok: false, error: err.message };
      row.status = 'rejected';
      row.rejectReason = String(reason || '').trim();
    }
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
    if (key) return all.filter((r) => String(r.adminEmail || '').toLowerCase() === key);
    // Guests without login: only this tab's scoped bookings — never other guests' PII
    const scope = guestBrowserScope();
    return all.filter((r) => r.guestBrowserScope === scope);
  };

  /** رابط فتح النظام المستأجر عبر جسر SSO في هوب */
  const buildOpenUrl = async (rental, { systemCode } = {}) => {
    if (!rental) return { ok: false, error: 'لا يوجد طلب' };
    if (rental.status !== 'active') {
      return { ok: false, error: 'الاستئجار غير مفعّل بعد' };
    }
    const code = String(systemCode || rental.systems?.[0] || 'ERP').toUpperCase();
    const erpOrigin = 'https://web-production-419e2.up.railway.app';

    let directTarget;
    let viaExpected = 'direct';

    if (code === 'ERP') {
      // لا تفتح مسار ERP إلا بعد تجهيز مستأجر حقيقي — وإلا يظهر «المستأجر غير موجود»
      if (!rental.erp?.loginUrl && !rental.erp?.hostPath) {
        return {
          ok: false,
          error: 'مستأجر ERP غير مجهّز بعد — أعد التفعيل أو راجع ربط ERP',
        };
      }
      if (rental.slug) {
        directTarget = `${erpOrigin}/t/${encodeURIComponent(rental.slug)}/login-page.html?login=1&tenant=${encodeURIComponent(rental.slug)}`;
      } else {
        directTarget = rental.erp.loginUrl;
      }
      viaExpected = 'hub-sso-bridge';
    } else {
      directTarget =
        window.HubLiveSystems?.url?.(code) ||
        `apps.html#${code.toLowerCase()}`;
      viaExpected = window.HubLiveSystems?.url?.(code) ? 'hub-sso-bridge' : 'hub-catalog';
    }

    // لا تزرع جلسة دائمة من بيانات الحجز — ذلك يسرّب هوية زائر لزائر لاحق في نفس المتصفح.
    // SSO ticket أدناه يكفي لفتح النظام دون تلوث نموذج الحجز التالي.

    const ticket = await window.HubAuth?.issueHubTicket?.({
      email: rental.adminEmail || window.HubAuth?.getUser?.()?.email,
      name: rental.adminName || rental.companyName,
      systemCode: code,
      tenant: code === 'ERP' ? rental.slug : rental.slug || '',
      subdomain: code === 'ERP' ? rental.slug : rental.slug || '',
      rentalId: rental.id,
      permissions: ['read', 'write'],
    });

    if (ticket?.ok && ticket.token) {
      const bridge = new URL('sso-bridge.html', window.location.href);
      bridge.searchParams.set('token', ticket.token);
      if (ticket.sig) bridge.searchParams.set('sig', ticket.sig);
      return {
        ok: true,
        url: bridge.pathname + bridge.search,
        absoluteUrl: bridge.toString(),
        targetUrl: directTarget,
        tenantHome: code === 'ERP' ? rental.erp?.loginUrl || `${erpOrigin}/t/${rental.slug}` : directTarget,
        ticket,
        via: viaExpected,
      };
    }

    // سقوط آمن: افتح الهدف مباشرة مع باراميترات SSO إن وُجدت
    let base = directTarget;
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
      tenantHome: code === 'ERP' ? rental.erp?.loginUrl || (rental.slug ? `${erpOrigin}/t/${rental.slug}` : '') : directTarget,
      ticket: ticket?.ok ? ticket : null,
      via: 'direct',
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
    isValidEmail,
    isValidPhone,
    pushRentalToServer,
    guestBrowserScope,
    patchRentalStatus,
  };
})();