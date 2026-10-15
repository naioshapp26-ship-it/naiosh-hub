/**
 * موافقات المدير الأعلى — طابور موحّد للعمليات الحساسة
 * الصلاحية ≠ الموافقة: الطلب يُنشأ هنا ويُنفَّذ فقط بعد الاعتماد.
 */
(() => {
  'use strict';

  const KEY = 'naiosh_hub_higher_approvals_v1';
  const API = '/api/hub/higher-approvals';
  const YEAR = () => new Date().getFullYear();
  let hydratePromise = null;
  let lastHydratedAt = 0;

  const STATUS = {
    PENDING: 'pending_review',
    UNDER_REVIEW: 'under_review',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    NEEDS_REVISION: 'needs_revision',
    REFERRED: 'referred',
  };

  const STATUS_AR = {
    [STATUS.PENDING]: 'بانتظار المراجعة',
    [STATUS.UNDER_REVIEW]: 'تحت المراجعة',
    [STATUS.APPROVED]: 'تمت الموافقة',
    [STATUS.REJECTED]: 'مرفوضة',
    [STATUS.NEEDS_REVISION]: 'أعيدت للتعديل',
    [STATUS.REFERRED]: 'أُحيلت للمختص',
  };

  const TYPE_AR = {
    platform_grant: 'اعتماد إضافة منصة',
    system_rental: 'اعتماد استئجار نظام',
    role_grant: 'اعتماد إضافة صلاحيات موظف',
    role_change: 'اعتماد تغيير صلاحيات موظف',
    permission_change: 'تعديل صلاحيات',
    system_access: 'منح وصول لنظام',
    identity_suspend: 'إيقاف حساب موظف',
    reward_approval: 'اعتماد مكافأة موظف',
    sensitive_op: 'عملية حساسة',
  };

  const SOURCE_AR = {
    team_ops: 'إدارة فريق العمل والصلاحيات',
    platform_grants: 'سجل معنا / منح المنصات',
    rent_store: 'استئجار الأنظمة',
    workforce: 'القوى العاملة',
    identity: 'هوية نايوش',
    store: 'المتجر',
    finance: 'المالية',
    systems: 'إدارة الأنظمة',
    projects: 'إدارة المشاريع',
    clients: 'إدارة العملاء',
  };

  const PRIORITY_AR = { high: 'مرتفعة', normal: 'عادية', low: 'منخفضة' };

  /** أدوار مرتفعة تحتاج موافقة المدير الأعلى (من الكتالوج الحالي) */
  const HIGH_ROLES = new Set(['SUPER_ADMIN', 'HUB_ADMIN', 'BRANCH_MANAGER', 'EMPIRE_GOVERNOR']);

  /** صلاحيات حساسة موجودة أصلًا في فريق العمل */
  const SENSITIVE_PERMS = new Set([
    'users.manage',
    'users.suspend',
    'roles.manage',
    'roles.assign',
    'access_governance.manage',
    'systems.manage',
    'policies.publish',
    'customer_requests.reject',
    'finance_approvals.approve',
  ]);

  const DECIDER_ROLES = new Set([
    'supreme_leader',
    'chief_engineer',
    'platform_owner',
    'super_admin',
    'SUPER_ADMIN',
    'empire_governor',
    'EMPIRE_GOVERNOR',
  ]);

  const nowIso = () => new Date().toISOString();

  const blank = () => ({
    schemaVersion: 2,
    seq: 0,
    requests: [],
    decisions: [],
  });

  const cleanLabel = (...parts) => {
    for (const p of parts) {
      const s = String(p == null ? '' : p).trim();
      if (s && s !== 'undefined' && s !== 'null') return s;
    }
    return '';
  };

  const rebuildImpactIfBroken = (r) => {
    const bad = (s) => !s || String(s).includes('undefined') || String(s).includes('null');
    if (r.type === 'system_rental' || r.sourceType === 'system_rental') {
      const system = cleanLabel(r.systemLabel, r.system, r.subjectName, r.affectedLabel, 'نظام');
      const customer = cleanLabel(r.requesterName, r.subjectEmployeeNo, r.requesterEmail, 'عميل');
      if (bad(r.impactIfApproved)) {
        r.impactIfApproved = `سيتم تفعيل إيجار النظام «${system}» للعميل «${customer}».`;
      }
      if (bad(r.requestedDisplay)) {
        r.requestedDisplay = `تفعيل: ${system}`;
      }
      if (bad(r.systemLabel)) r.systemLabel = system;
      if (bad(r.requesterName)) r.requesterName = customer;
    } else if (bad(r.impactIfApproved)) {
      r.impactIfApproved = r.requestedDisplay
        ? `سيتم تطبيق: ${String(r.requestedDisplay).replace(/\n/g, ' · ')}`
        : 'سيتم تنفيذ العملية المرتبطة بهذا الطلب فور الاعتماد.';
    }
    return r;
  };

  const normalizeRequest = (r) => {
    if (!r || typeof r !== 'object') return r;
    if (!r.title) r.title = r.typeLabel || r.affectedLabel || 'طلب موافقة';
    if (!r.sourceModule) r.sourceModule = r.sourceType || 'HUB';
    if (!r.sourceModuleLabel) {
      r.sourceModuleLabel =
        SOURCE_AR[r.sourceModule] || r.systemLabel || r.workplace || 'النظام';
    }
    if (!r.operation) r.operation = r.type || 'sensitive_op';
    if (!r.operationLabel) r.operationLabel = r.typeLabel || TYPE_AR[r.operation] || r.operation;
    if (!r.priority) r.priority = 'normal';
    if (!r.department) r.department = r.workplace || r.sourceModuleLabel || '';
    if (!r.branch) r.branch = '';
    if (!r.org) r.org = r.workplace || '';
    if (!r.impactIfApproved) {
      r.impactIfApproved = r.requestedDisplay
        ? `سيتم تطبيق: ${String(r.requestedDisplay).replace(/\n/g, ' · ')}`
        : 'سيتم تنفيذ العملية المرتبطة بهذا الطلب فور الاعتماد.';
    }
    if (!r.impactIfRejected) {
      r.impactIfRejected = 'لن تُنفَّذ العملية وستبقى الحالة كما هي قبل الطلب.';
    }
    if (!r.sourceLink) r.sourceLink = '';
    rebuildImpactIfBroken(r);
    return r;
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        const s = blank();
        localStorage.setItem(KEY, JSON.stringify(s));
        return s;
      }
      const parsed = JSON.parse(raw);
      if (!parsed.schemaVersion) Object.assign(parsed, blank());
      if (!Array.isArray(parsed.requests)) parsed.requests = [];
      if (!Array.isArray(parsed.decisions)) parsed.decisions = [];
      if (typeof parsed.seq !== 'number') parsed.seq = parsed.requests.length;
      parsed.requests.forEach(normalizeRequest);
      parsed.schemaVersion = Math.max(Number(parsed.schemaVersion) || 1, 2);
      return parsed;
    } catch {
      return blank();
    }
  };

  let state = load();
  let lastChangeFingerprint = '';

  const fingerprintState = (s) => {
    try {
      const reqs = (s.requests || [])
        .map((r) => `${r.id}:${r.status}:${r.updatedAt || r.decidedAt || ''}`)
        .sort()
        .join('|');
      const decs = (s.decisions || []).length;
      return `${reqs}#${decs}`;
    } catch {
      return String(Date.now());
    }
  };

  const save = ({ silent = false } = {}) => {
    localStorage.setItem(KEY, JSON.stringify(state));
    const fp = fingerprintState(state);
    if (!silent && fp !== lastChangeFingerprint) {
      lastChangeFingerprint = fp;
      try {
        window.dispatchEvent(
          new CustomEvent('hub-higher-approvals-changed', { detail: { count: state.requests.length } })
        );
      } catch (_) {}
    } else if (!lastChangeFingerprint) {
      lastChangeFingerprint = fp;
    }
    return state;
  };

  const authHeaders = (extra = {}) => {
    try {
      return window.HubAuth?.authHeaders?.(extra) || { ...extra };
    } catch {
      return { ...extra };
    }
  };

  const mergeServerState = (payload) => {
    const remoteReqs = Array.isArray(payload?.requests) ? payload.requests : [];
    const remoteDecs = Array.isArray(payload?.decisions) ? payload.decisions : [];
    const byId = new Map();
    // Server is source of truth; keep local-only rows that are not yet on server (offline draft).
    (state.requests || []).forEach((r) => {
      if (r?.id && r._localOnly) byId.set(r.id, normalizeRequest(r));
    });
    remoteReqs.forEach((r) => {
      if (r?.id) byId.set(r.id, normalizeRequest(r));
    });
    const dMap = new Map();
    remoteDecs.forEach((d) => {
      if (d?.id) dMap.set(d.id, d);
    });
    (state.decisions || []).forEach((d) => {
      if (d?.id && !dMap.has(d.id)) dMap.set(d.id, d);
    });
    state.requests = [...byId.values()].sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    );
    state.decisions = [...dMap.values()].sort((a, b) =>
      String(b.decidedAt || '').localeCompare(String(a.decidedAt || ''))
    );
    state.schemaVersion = Math.max(Number(state.schemaVersion) || 1, 3);
    save();
    return state;
  };

  const hydrateFromServer = async ({ force = false, backfill = false } = {}) => {
    const now = Date.now();
    if (!force && hydratePromise) return hydratePromise;
    if (!force && now - lastHydratedAt < 1500) return state;
    hydratePromise = (async () => {
      try {
        if (backfill) {
          await fetch(`${API}/backfill`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: '{}',
            cache: 'no-store',
          }).catch(() => null);
        }
        const res = await fetch(API, {
          method: 'GET',
          headers: authHeaders({ Accept: 'application/json' }),
          cache: 'no-store',
        });
        if (!res.ok) return state;
        const data = await res.json();
        if (data?.ok) mergeServerState(data);
        lastHydratedAt = Date.now();
        // Push any leftover local-only open tickets (staff drafts) into Postgres.
        try {
          await syncLocalOnlyToServer();
        } catch (_) {}
      } catch (_) {
        /* keep local cache */
      } finally {
        hydratePromise = null;
      }
      return state;
    })();
    return hydratePromise;
  };

  const postCreate = async (payload, actor) => {
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...payload,
          requesterName: payload.requesterName || actorMeta(actor).name,
          requesterEmail: payload.requesterEmail || actorMeta(actor).email,
          requesterEmployeeNo: payload.requesterEmployeeNo || actorMeta(actor).employeeNo,
          requesterNaioshId: payload.requesterNaioshId || actorMeta(actor).naioshId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.request) {
        const idx = state.requests.findIndex((r) => r.id === data.request.id);
        if (idx >= 0) state.requests[idx] = normalizeRequest({ ...data.request, _localOnly: false });
        else state.requests.unshift(normalizeRequest({ ...data.request, _localOnly: false }));
        // drop local-only duplicate by source
        if (data.request.sourceType && data.request.sourceId) {
          state.requests = state.requests.filter(
            (r) =>
              !(
                r._localOnly &&
                r.id !== data.request.id &&
                r.sourceType === data.request.sourceType &&
                String(r.sourceId) === String(data.request.sourceId)
              )
          );
        }
        save();
        return normalizeRequest({ ...data.request, _localOnly: false });
      }
      return { error: data.error || `فشل حفظ الموافقة (${res.status})` };
    } catch (e) {
      return { error: e.message || 'تعذر الاتصال بالسيرفر لحفظ الموافقة' };
    }
  };

  /** Push any local-only open tickets to Postgres (staff session). */
  const syncLocalOnlyToServer = async () => {
    const locals = (state.requests || []).filter(
      (r) =>
        r &&
        r._localOnly &&
        [STATUS.PENDING, STATUS.UNDER_REVIEW, STATUS.NEEDS_REVISION, STATUS.REFERRED].includes(r.status)
    );
    let synced = 0;
    for (const row of locals) {
      const remote = await postCreate({ ...row, silent: true, id: row.id }, {
        name: row.requesterName,
        email: row.requesterEmail,
        employeeNo: row.requesterEmployeeNo,
        naioshId: row.requesterNaioshId,
      });
      if (remote && !remote.error) synced += 1;
    }
    return { ok: true, synced, scanned: locals.length };
  };

  const postDecide = async (id, action, opts = {}) => {
    try {
      const res = await fetch(`${API}/${encodeURIComponent(id)}/decide`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action, ...opts }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || 'تعذر تنفيذ القرار على السيرفر' };
      if (data.request) {
        const idx = state.requests.findIndex((r) => r.id === id);
        if (idx >= 0) state.requests[idx] = normalizeRequest(data.request);
        else state.requests.unshift(normalizeRequest(data.request));
        save();
      }
      return { ok: true, ...data };
    } catch (e) {
      return { ok: false, error: e.message || 'تعذر الاتصال بالسيرفر' };
    }
  };

  const nextId = () => {
    state.seq = (state.seq || 0) + 1;
    return `APR-${YEAR()}-${String(state.seq).padStart(5, '0')}`;
  };

  const notify = (payload) => {
    try {
      return window.HubStore?.pushNotification?.(payload) || window.HubStore?.createHubNotification?.(payload);
    } catch {
      return null;
    }
  };

  const actorMeta = (actor) => {
    if (!actor) return { name: 'نظام', employeeNo: '', email: '', role: '' };
    if (typeof actor === 'string') return { name: actor, employeeNo: '', email: '', role: '' };
    return {
      name: actor.name || actor.email || 'مشغّل هوب',
      employeeNo: actor.employeeNo || actor.empNo || '',
      email: actor.email || '',
      naioshId: actor.naioshId || actor.id || '',
      role: actor.role || actor.roleCode || '',
    };
  };

  const canDecide = (actor) => {
    const a = actorMeta(actor);
    const role = String(a.role || '').toLowerCase();
    if (role === 'admin' || role === 'customer' || role === 'client' || role === 'client_user' || role === 'staff') {
      return false;
    }
    if (a.role || role) {
      if (DECIDER_ROLES.has(a.role) || DECIDER_ROLES.has(role)) return true;
      if (role && !DECIDER_ROLES.has(a.role) && !DECIDER_ROLES.has(role)) return false;
    }
    try {
      const u = window.HubAuth?.getUser?.() || JSON.parse(localStorage.getItem('hubUser') || '{}');
      const r = String(u?.role || '').toLowerCase();
      if (r === 'admin' || r === 'customer' || r === 'client' || r === 'client_user' || r === 'staff') return false;
      if (DECIDER_ROLES.has(u?.role) || DECIDER_ROLES.has(r)) return true;
      if (
        u?.employeeNo &&
        String(u.employeeNo).indexOf('EMP-') === 0 &&
        (r.includes('leader') || r.includes('owner') || r.includes('governor') || r.includes('supreme'))
      ) {
        return true;
      }
    } catch (_) {}
    return false;
  };

  const requiresHigherManagerApproval = (op = {}) => {
    if (op.requiresHigherManagerApproval === true || op.requiresApproval === true) return true;
    if (op.requiresHigherManagerApproval === false || op.requiresApproval === false) return false;
    const role = String(op.roleCode || op.requestedRole || op.toRole || '');
    if (HIGH_ROLES.has(role)) return true;
    const perms = Array.isArray(op.permissions) ? op.permissions : [];
    if (perms.some((p) => SENSITIVE_PERMS.has(p) || /manage|assign|delete|publish|suspend|reject/i.test(p))) return true;
    const sens = String(op.sensitivity || '').toLowerCase();
    if (sens === 'sensitive' || sens === 'critical') return true;
    const type = String(op.type || op.opType || '');
    if (['role_grant', 'role_change', 'permission_change', 'system_access', 'identity_suspend', 'reward_approval'].includes(type)) {
      return true;
    }
    return false;
  };

  const findBySource = (sourceType, sourceId) =>
    state.requests.find((r) => r.sourceType === sourceType && r.sourceId === String(sourceId || ''));

  const pushDecision = (row) => {
    state.decisions.unshift(row);
    if (state.decisions.length > 500) state.decisions.length = 500;
  };

  const buildLocalRow = (payload = {}, actor) => {
    const a = actorMeta(actor);
    const type = payload.type || 'sensitive_op';
    const sourceModule = payload.sourceModule || payload.sourceType || 'HUB';
    const sourceModuleLabel =
      payload.sourceModuleLabel || SOURCE_AR[sourceModule] || payload.systemLabel || 'النظام';
    const operation = payload.operation || type;
    const operationLabel = payload.operationLabel || payload.typeLabel || TYPE_AR[type] || type;
    const title = payload.title || `${operationLabel}${payload.subjectName ? ` — ${payload.subjectName}` : ''}`;
    return normalizeRequest({
      id: payload.id || nextId(),
      title,
      type,
      typeLabel: payload.typeLabel || TYPE_AR[type] || type,
      status: STATUS.PENDING,
      priority: payload.priority || 'normal',
      sourceModule,
      sourceModuleLabel,
      operation,
      operationLabel,
      department: payload.department || sourceModuleLabel,
      branch: payload.branch || payload.branchLabel || '',
      org: payload.org || payload.companyName || payload.workplace || '',
      requesterName: payload.requesterName || a.name,
      requesterEmployeeNo: payload.requesterEmployeeNo || a.employeeNo || '',
      requesterEmail: payload.requesterEmail || a.email || '',
      requesterNaioshId: payload.requesterNaioshId || a.naioshId || '',
      subjectName: payload.subjectName || '',
      subjectEmployeeNo: payload.subjectEmployeeNo || '',
      subjectNaioshId: payload.subjectNaioshId || '',
      workplace: payload.workplace || payload.systemLabel || '',
      system: payload.system || 'HUB',
      systemLabel: payload.systemLabel || payload.system || sourceModuleLabel,
      affectedLabel: payload.affectedLabel || payload.subjectName || payload.typeLabel || '—',
      reason: payload.reason || '',
      currentValue: payload.currentValue || null,
      requestedValue: payload.requestedValue || null,
      currentDisplay: payload.currentDisplay || '',
      requestedDisplay: payload.requestedDisplay || '',
      impactIfApproved: payload.impactIfApproved || '',
      impactIfRejected: payload.impactIfRejected || '',
      applyPayload: payload.applyPayload || null,
      sourceType: payload.sourceType || '',
      sourceId: payload.sourceId ? String(payload.sourceId) : '',
      sourceLink: payload.sourceLink || '',
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
      revisionNote: '',
      rejectReason: '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      decidedAt: '',
      decidedBy: '',
      decidedByEmployeeNo: '',
      _localOnly: true,
      history: [
        {
          at: nowIso(),
          action: 'created',
          by: a.name,
          detail: `إنشاء طلب موافقة من ${sourceModuleLabel}`,
        },
      ],
    });
  };

  const notifyCreated = (row) => {
    notify({
      title: `طلب جديد لاعتماد ${row.operationLabel}`,
      body: `${row.title} · المصدر: ${row.sourceModuleLabel} · مقدم الطلب: ${row.requesterName}${
        row.subjectEmployeeNo ? ` · ${row.subjectEmployeeNo}` : ''
      }`,
      level: 'warning',
      category: 'ops',
      source: 'HIGHER_APPROVALS',
      sourceName: 'موافقات المدير الأعلى',
      link: `dashboard.html#rent-admin?apr=${encodeURIComponent(row.id)}`,
      actionLabel: 'مراجعة الطلب',
      actionLink: `dashboard.html#rent-admin?apr=${encodeURIComponent(row.id)}`,
      needsAction: true,
      referenceType: 'higher_approval',
      referenceId: row.id,
      requestId: row.id,
    });
  };

  /**
   * Durable create: waits for Postgres/API before returning.
   * On failure rolls back the local draft so we never show success without an inbox row.
   */
  const createRequestAsync = async (payload = {}, actor) => {
    const silent = payload.silent === true;
    if (payload.sourceType && payload.sourceId) {
      const existing = findBySource(payload.sourceType, payload.sourceId);
      if (existing && [STATUS.PENDING, STATUS.UNDER_REVIEW, STATUS.NEEDS_REVISION, STATUS.REFERRED].includes(existing.status)) {
        if (existing._localOnly) {
          const remote = await postCreate({ ...existing, silent: true }, actor);
          if (remote && !remote.error) return remote;
        } else {
          return normalizeRequest(existing);
        }
      }
    }
    const row = buildLocalRow(payload, actor);
    state.requests.unshift(row);
    save();
    const remote = await postCreate({ ...payload, ...row, silent: true, id: row.id }, actor);
    if (!remote || remote.error) {
      state.requests = state.requests.filter((r) => r.id !== row.id);
      save();
      const err = new Error(remote?.error || 'تعذر حفظ طلب الموافقة على السيرفر — لم يُنشأ الطلب');
      err.code = 'HIGHER_APPROVAL_PERSIST_FAILED';
      throw err;
    }
    // Remove draft if server assigned a different id
    if (remote.id !== row.id) {
      state.requests = state.requests.filter((r) => r.id !== row.id);
      if (!state.requests.find((r) => r.id === remote.id)) state.requests.unshift(remote);
      save();
    }
    if (!silent) notifyCreated(remote);
    return remote;
  };

  /** Sync helper kept for offline/e2e — prefers durable path when staff session exists. */
  const createRequest = (payload = {}, actor) => {
    const silent = payload.silent === true;
    if (payload.sourceType && payload.sourceId) {
      const existing = findBySource(payload.sourceType, payload.sourceId);
      if (existing && [STATUS.PENDING, STATUS.UNDER_REVIEW, STATUS.NEEDS_REVISION, STATUS.REFERRED].includes(existing.status)) {
        return normalizeRequest(existing);
      }
    }
    const row = buildLocalRow(payload, actor);
    state.requests.unshift(row);
    save();
    const persist = postCreate({ ...payload, ...row, silent: true, id: row.id }, actor).then((remote) => {
      if (!remote || remote.error) {
        row._persistError = remote?.error || 'persist_failed';
        save();
        return null;
      }
      if (remote.id !== row.id) {
        state.requests = state.requests.filter((r) => r.id !== row.id);
        if (!state.requests.find((r) => r.id === remote.id)) state.requests.unshift(remote);
        save();
      } else {
        const idx = state.requests.findIndex((r) => r.id === remote.id);
        if (idx >= 0) state.requests[idx] = normalizeRequest({ ...remote, _localOnly: false });
        save();
      }
      return remote;
    });
    row._persistPromise = persist;
    if (!silent) notifyCreated(row);
    return row;
  };

  const get = (id) => state.requests.find((r) => r.id === id) || null;

  const list = (opts = {}) => {
    ingestExternal();
    let rows = state.requests.slice().map(normalizeRequest);
    if (opts.status === 'pending_review') {
      rows = rows.filter((r) => r.status === STATUS.PENDING || r.status === STATUS.UNDER_REVIEW);
    } else if (opts.status === 'under_review') {
      rows = rows.filter((r) => r.status === STATUS.UNDER_REVIEW);
    } else if (opts.status) {
      rows = rows.filter((r) => r.status === opts.status);
    }
    if (opts.sourceModule) {
      rows = rows.filter((r) => r.sourceModule === opts.sourceModule || r.sourceType === opts.sourceModule);
    }
    if (opts.type) rows = rows.filter((r) => r.type === opts.type || r.operation === opts.type);
    if (opts.priority) rows = rows.filter((r) => r.priority === opts.priority);
    if (opts.q) {
      const q = String(opts.q).toLowerCase();
      rows = rows.filter((r) =>
        [
          r.id,
          r.title,
          r.typeLabel,
          r.operationLabel,
          r.sourceModuleLabel,
          r.requesterName,
          r.subjectName,
          r.subjectEmployeeNo,
          r.requesterEmployeeNo,
          r.requesterNaioshId,
          r.systemLabel,
          r.reason,
          r.branch,
          r.org,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    return rows;
  };

  const kpis = () => {
    ingestExternal();
    const rows = state.requests;
    const awaitingDecision = rows.filter(
      (r) => r.status === STATUS.PENDING || r.status === STATUS.UNDER_REVIEW
    ).length;
    return {
      pending: awaitingDecision,
      awaitingDecision,
      underReview: rows.filter((r) => r.status === STATUS.UNDER_REVIEW).length,
      approved: rows.filter((r) => r.status === STATUS.APPROVED).length,
      rejected: rows.filter((r) => r.status === STATUS.REJECTED).length,
      needsRevision: rows.filter((r) => r.status === STATUS.NEEDS_REVISION).length,
      referred: rows.filter((r) => r.status === STATUS.REFERRED).length,
      all: rows.length,
    };
  };

  const formatSystems = (codes) => {
    if (!codes) return '—';
    if (Array.isArray(codes)) return codes.length ? codes.join(' · ') : '—';
    return String(codes);
  };

  const formatPerms = (codes) => {
    if (!Array.isArray(codes) || !codes.length) return '—';
    return codes.slice(0, 12).join(' · ') + (codes.length > 12 ? '…' : '');
  };

  const roleLabel = (code) => {
    try {
      const r = (window.HubAccessGovStore?.get?.()?.roles || []).find((x) => x.code === code);
      return r?.nameAr || r?.name || code || '—';
    } catch {
      return code || '—';
    }
  };

  /** استيعاب طلبات سجل معنا / الاستئجار كطلبات موافقة إن لم تكن مربوطة */
  const ingestExternal = () => {
    let changed = false;
    try {
      const grants = window.HubPlatformGrants?.listGrants?.() || [];
      grants.forEach((g) => {
        if (!g?.id) return;
        let ticket = findBySource('platform_grant', g.id);
        if (!ticket && (g.status === 'pending' || g.status === 'provisioning')) {
          ticket = createRequest(
            {
              silent: true,
              type: 'platform_grant',
              typeLabel: TYPE_AR.platform_grant,
              title: `اعتماد إضافة منصة — ${g.companyName || g.platformLabel || g.host || g.id}`,
              sourceModule: 'platform_grants',
              sourceModuleLabel: SOURCE_AR.platform_grants,
              operation: 'platform_grant',
              operationLabel: 'اعتماد إضافة منصة',
              sourceType: 'platform_grant',
              sourceId: g.id,
              sourceLink: 'dashboard.html#rent-admin',
              requesterName: g.adminName || g.companyName || 'عميل',
              requesterEmail: g.adminEmail || '',
              subjectName: g.companyName || g.adminName || g.host || 'منصة',
              workplace: [g.branchLabel, g.incubatorLabel].filter(Boolean).join(' · '),
              branch: g.branchLabel || g.branch || '',
              org: g.companyName || g.platformLabel || '',
              department: 'منح المنصات',
              priority: 'high',
              system: g.requestedSystem || g.platform || 'HUB',
              systemLabel: g.requestedSystemLabel || g.platformLabel || 'سجل معنا',
              affectedLabel: g.host || g.companyName || g.id,
              reason: g.notes || 'طلب تسجيل منصة ومنح نظام',
              currentDisplay: 'لا وصول مفعّل بعد',
              requestedDisplay: `منح النظام: ${g.requestedSystemLabel || g.requestedSystem || '—'} · النطاق: ${g.host || '—'}`,
              impactIfApproved: `سيتم تفعيل منحة المنصة ${g.host || g.id} ومنح النظام ${g.requestedSystemLabel || g.requestedSystem || ''} للمسؤول ${g.adminEmail || g.adminName || ''}.`,
              impactIfRejected: 'سيبقى طلب التسجيل معلّقًا/مرفوضًا ولن يُفعَّل وصول المنصة.',
              currentValue: { status: 'none' },
              requestedValue: {
                status: 'active',
                system: g.requestedSystem || g.platform,
                host: g.host,
                email: g.adminEmail,
              },
              applyPayload: { grantId: g.id },
            },
            { name: g.adminName || 'عميل', email: g.adminEmail }
          );
          // createRequest already notified — avoid double notify storms on hydrate by skipping if we just created
          changed = true;
          // undo the auto-notify spam on bulk ingest: mark silent by removing last if many — keep one notify is OK for new
          void ticket;
        } else if (ticket) {
          if (g.status === 'active' && ticket.status === STATUS.PENDING) {
            ticket.status = STATUS.APPROVED;
            ticket.updatedAt = nowIso();
            ticket.decidedAt = ticket.decidedAt || nowIso();
            ticket.decidedBy = ticket.decidedBy || 'مزامنة خارجية';
            changed = true;
          } else if (g.status === 'rejected' && ticket.status === STATUS.PENDING) {
            ticket.status = STATUS.REJECTED;
            ticket.updatedAt = nowIso();
            changed = true;
          }
        }
      });
    } catch (_) {}

    try {
      const rentals = window.HubRentStore?.listRentals?.() || [];
      rentals.forEach((r) => {
        if (!r?.id || r.status !== 'pending') return;
        if (findBySource('system_rental', r.id)) return;
        createRequest(
          {
            silent: true,
            type: 'system_rental',
            typeLabel: TYPE_AR.system_rental,
            title: `اعتماد استئجار نظام — ${r.systemLabel || r.systemCode || r.id}`,
            sourceModule: 'rent_store',
            sourceModuleLabel: SOURCE_AR.rent_store,
            operation: 'system_rental',
            operationLabel: 'اعتماد استئجار نظام',
            sourceType: 'system_rental',
            sourceId: r.id,
            requesterName: r.customerName || r.email || 'عميل',
            requesterEmail: r.email || '',
            subjectName: r.systemLabel || r.systemCode || 'نظام',
            system: r.systemCode || '',
            systemLabel: r.systemLabel || r.systemCode || 'استئجار نظام',
            affectedLabel: r.systemLabel || r.id,
            reason: r.notes || 'طلب استئجار نظام',
            priority: 'normal',
            department: 'استئجار الأنظمة',
            currentDisplay: 'غير مفعّل',
            requestedDisplay: `تفعيل: ${cleanLabel(r.systemLabel, r.systemCode, 'نظام')} · خطة: ${cleanLabel(r.planLabel, r.plan, '—')}`,
            impactIfApproved: `سيتم تفعيل إيجار النظام «${cleanLabel(r.systemLabel, r.systemCode, 'نظام')}» للعميل «${cleanLabel(r.customerName, r.adminName, r.email, 'عميل')}».`,
            impactIfRejected: 'لن يُفعَّل الإيجار وسيُرفض الطلب في سجل الاستئجار.',
            applyPayload: { rentalId: r.id },
          },
          { name: cleanLabel(r.customerName, r.adminName, 'عميل'), email: r.email || r.adminEmail || '' }
        );
        changed = true;
      });
    } catch (_) {}

    if (changed) save();
  };

  const applyApproved = (req, actor) => {
    const a = actorMeta(actor);
    if (req.type === 'platform_grant' || req.sourceType === 'platform_grant') {
      const gid = req.applyPayload?.grantId || req.sourceId;
      const res = window.HubPlatformGrants?.approveGrant?.(gid);
      if (!res?.ok) throw new Error(res?.error || 'فشل اعتماد المنصة');
      const g = res.grant;
      if (g?.adminEmail && (g.requestedSystem || g.platform)) {
        try {
          window.HubStore?.grantSubscription?.({
            email: g.adminEmail,
            systemCode: g.requestedSystem || g.platform,
            plan: 'standard',
            permissions: ['read', 'write'],
            source: 'higher-approval',
          });
        } catch (_) {}
      }
      return { ok: true, detail: 'تم اعتماد المنحة' };
    }
    if (req.type === 'system_rental' || req.sourceType === 'system_rental') {
      const rid = req.applyPayload?.rentalId || req.sourceId;
      const store = window.HubRentStore;
      const res = store?.activateRental?.(rid) || store?.applyLocalActivation?.(rid);
      if (res && res.ok === false) throw new Error(res.error || 'فشل تفعيل الإيجار');
      return { ok: true, detail: 'تم تفعيل الإيجار' };
    }
    if (req.type === 'role_grant' || req.type === 'role_change' || req.type === 'permission_change' || req.type === 'system_access') {
      const engine = window.HubAccessGov;
      const p = req.applyPayload || {};
      if (!engine?.createGrant && !engine?.updateGrant) throw new Error('محرك الصلاحيات غير متاح');
      // التنفيذ يتم بصلاحية النظام بعد اعتماد المدير الأعلى (actor بشري يُسجَّل في approvedBy)
      const applyActor = 'مشغّل هوب';
      if (p.editGrantId && engine.updateGrant) {
        engine.updateGrant(
          p.editGrantId,
          {
            roleCode: p.roleCode,
            system: p.system,
            positionCode: p.positionCode || null,
            permissions: p.permissions || [],
            reason: req.reason || 'اعتماد من موافقات المدير الأعلى',
            approvedBy: a.name,
          },
          applyActor
        );
      } else {
        engine.createGrant(
          {
            naioshId: p.naioshId,
            positionCode: p.positionCode || null,
            roleCode: p.roleCode,
            system: p.system || 'HUB',
            scopeCode: p.scopeCode || (p.system === 'HUB' ? 'HUB-GLOBAL' : 'GLOBAL'),
            permissions: p.permissions || [],
            purpose: req.reason || 'اعتماد من موافقات المدير الأعلى',
            governanceLevel: p.governanceLevel || (p.system === 'HUB' ? 'HUB' : 'SYSTEM'),
            approvedBy: a.name,
            grantedBy: a.name,
          },
          applyActor
        );
      }
      try {
        const s = window.HubAccessGovStore?.get?.();
        if (s && Array.isArray(s.auditLog)) {
          s.auditLog.unshift({
            at: nowIso(),
            action: 'higher_approval_apply',
            detail: `${req.id} · ${req.typeLabel}`,
            by: a.name,
          });
          window.HubAccessGovStore?.save?.();
        }
      } catch (_) {}
      return { ok: true, detail: 'تم تطبيق الدور/الصلاحيات' };
    }
    if (req.applyPayload?.action === 'suspend' && req.applyPayload?.naioshId) {
      const engine = window.HubAccessGov;
      if (!engine?.suspendIdentity) throw new Error('محرك الهوية غير متاح');
      engine.suspendIdentity(req.applyPayload.naioshId, a.name || 'مشغّل هوب', req.reason || 'اعتماد إيقاف حساب');
      return { ok: true, detail: 'تم إيقاف الحساب' };
    }
    if (req.type === 'reward_approval' || req.sourceType === 'workforce_reward') {
      const rewardId = req.applyPayload?.rewardId || req.sourceId;
      const res = window.HubStore?.decideReward?.(rewardId, 'approve', '', a.name);
      if (res?.error) throw new Error(res.error);
      if (!res) throw new Error('تعذر اعتماد المكافأة في القوى العاملة');
      return { ok: true, detail: 'تم اعتماد المكافأة وتطبيقها' };
    }
    return { ok: true, detail: 'لا يوجد منفّذ مرتبط — سُجّلت الموافقة فقط' };
  };

  const assertCanDecide = (actor) => {
    if (!canDecide(actor)) {
      throw new Error('ليست لديك صلاحية اعتماد/رفض طلبات المدير الأعلى');
    }
  };

  const startReview = (id, actor) => {
    const req = get(id);
    if (!req) return { ok: false, error: 'الطلب غير موجود' };
    if (!canDecide(actor)) return { ok: true, request: req, skipped: true };
    if (req.status !== STATUS.PENDING) return { ok: true, request: req };
    const a = actorMeta(actor);
    req.status = STATUS.UNDER_REVIEW;
    req.updatedAt = nowIso();
    req.history.push({ at: nowIso(), action: 'under_review', by: a.name, detail: 'بدأ المدير مراجعة الطلب' });
    save();
    void postDecide(id, 'start_review');
    return { ok: true, request: req };
  };

  const mergeServerRequest = (id, serverReq) => {
    if (!serverReq?.id) return get(id);
    const idx = state.requests.findIndex((r) => r.id === id);
    const next = normalizeRequest({ ...serverReq, _localOnly: false });
    if (idx >= 0) state.requests[idx] = next;
    else state.requests.unshift(next);
    save();
    return next;
  };

  const approve = async (id, actor, note = '') => {
    const req = get(id);
    if (!req) return { ok: false, error: 'الطلب غير موجود' };
    try {
      assertCanDecide(actor);
    } catch (e) {
      return { ok: false, error: e.message };
    }
    if (![STATUS.PENDING, STATUS.UNDER_REVIEW, STATUS.NEEDS_REVISION].includes(req.status)) {
      return { ok: false, error: 'لا يمكن الموافقة على هذا الطلب في حالته الحالية' };
    }
    const a = actorMeta(actor);
    const beforeStatus = req.status;
    // Durable server decision FIRST — never apply locally if API rejects.
    const server = await postDecide(id, 'approve', { note: note || '' });
    if (!server.ok) return { ok: false, error: server.error || 'تعذر اعتماد الطلب على السيرفر' };
    const live = mergeServerRequest(id, server.request) || req;
    try {
      const applied = applyApproved(live, a);
      live.status = STATUS.APPROVED;
      live.updatedAt = nowIso();
      live.decidedAt = live.decidedAt || nowIso();
      live.decidedBy = live.decidedBy || a.name;
      live.decidedByEmployeeNo = live.decidedByEmployeeNo || a.employeeNo || '';
      live.history = Array.isArray(live.history) ? live.history : [];
      if (!live.history.some((h) => h.action === 'approved' && h.at === live.decidedAt)) {
        live.history.push({ at: nowIso(), action: 'approved', by: a.name, detail: note || applied?.detail || 'موافقة' });
      }
      pushDecision({
        id: `DEC-${live.id}-${Date.now()}`,
        requestId: live.id,
        type: live.type,
        typeLabel: live.typeLabel,
        title: live.title,
        sourceModule: live.sourceModule,
        sourceModuleLabel: live.sourceModuleLabel,
        operation: live.operation,
        operationLabel: live.operationLabel,
        sourceType: live.sourceType,
        sourceId: live.sourceId,
        requesterName: live.requesterName,
        subjectEmployeeNo: live.subjectEmployeeNo,
        decision: 'approved',
        decisionAr: STATUS_AR[STATUS.APPROVED],
        decidedBy: a.name,
        decidedByEmployeeNo: a.employeeNo || '',
        reason: note || '',
        beforeStatus,
        afterStatus: STATUS.APPROVED,
        requestedAt: live.createdAt,
        decidedAt: live.decidedAt,
      });
      save();
      notify({
        title: 'تمت الموافقة على طلبك',
        body: `طلب ${live.id} (${live.operationLabel || live.typeLabel}) تمت الموافقة عليه من ${a.name}.`,
        level: 'success',
        category: 'ops',
        source: 'HIGHER_APPROVALS',
        sourceName: 'موافقات المدير الأعلى',
        link: `dashboard.html#rent-admin?apr=${encodeURIComponent(live.id)}`,
        referenceType: 'higher_approval',
        referenceId: live.id,
        requestId: live.id,
        meta: { email: live.requesterEmail },
      });
      return { ok: true, request: live, applied };
    } catch (e) {
      return { ok: false, error: e.message || 'فشل تنفيذ الموافقة بعد اعتماد السيرفر' };
    }
  };

  const reject = async (id, reason, actor) => {
    const req = get(id);
    if (!req) return { ok: false, error: 'الطلب غير موجود' };
    try {
      assertCanDecide(actor);
    } catch (e) {
      return { ok: false, error: e.message };
    }
    if (!String(reason || '').trim()) return { ok: false, error: 'سبب الرفض إلزامي' };
    if (![STATUS.PENDING, STATUS.UNDER_REVIEW, STATUS.NEEDS_REVISION].includes(req.status)) {
      return { ok: false, error: 'لا يمكن رفض هذا الطلب في حالته الحالية' };
    }
    const a = actorMeta(actor);
    const beforeStatus = req.status;
    const rejectReason = String(reason).trim();
    const server = await postDecide(id, 'reject', { reason: rejectReason, note: rejectReason });
    if (!server.ok) return { ok: false, error: server.error || 'تعذر رفض الطلب على السيرفر' };
    const live = mergeServerRequest(id, server.request) || req;
    if (live.sourceType === 'platform_grant' || live.type === 'platform_grant') {
      try {
        window.HubPlatformGrants?.rejectGrant?.(live.sourceId || live.applyPayload?.grantId);
      } catch (_) {}
    }
    if (live.sourceType === 'system_rental' || live.type === 'system_rental') {
      try {
        window.HubRentStore?.rejectRental?.(live.sourceId || live.applyPayload?.rentalId, rejectReason);
      } catch (_) {}
    }
    if (live.type === 'reward_approval' || live.sourceType === 'workforce_reward') {
      try {
        window.HubStore?.decideReward?.(live.applyPayload?.rewardId || live.sourceId, 'reject', rejectReason, a.name);
      } catch (_) {}
    }
    live.status = STATUS.REJECTED;
    live.rejectReason = rejectReason;
    live.updatedAt = nowIso();
    live.decidedAt = live.decidedAt || nowIso();
    live.decidedBy = live.decidedBy || a.name;
    live.decidedByEmployeeNo = live.decidedByEmployeeNo || a.employeeNo || '';
    live.history = Array.isArray(live.history) ? live.history : [];
    live.history.push({ at: nowIso(), action: 'rejected', by: a.name, detail: rejectReason });
    pushDecision({
      id: `DEC-${live.id}-${Date.now()}`,
      requestId: live.id,
      type: live.type,
      typeLabel: live.typeLabel,
      title: live.title,
      sourceModule: live.sourceModule,
      sourceModuleLabel: live.sourceModuleLabel,
      operation: live.operation,
      operationLabel: live.operationLabel,
      sourceType: live.sourceType,
      sourceId: live.sourceId,
      requesterName: live.requesterName,
      subjectEmployeeNo: live.subjectEmployeeNo,
      decision: 'rejected',
      decisionAr: STATUS_AR[STATUS.REJECTED],
      decidedBy: a.name,
      decidedByEmployeeNo: a.employeeNo || '',
      reason: rejectReason,
      beforeStatus,
      afterStatus: STATUS.REJECTED,
      requestedAt: live.createdAt,
      decidedAt: live.decidedAt,
    });
    save();
    notify({
      title: 'رُفض طلب الموافقة',
      body: `طلب ${live.id}: ${rejectReason}`,
      level: 'error',
      category: 'ops',
      source: 'HIGHER_APPROVALS',
      sourceName: 'موافقات المدير الأعلى',
      link: `dashboard.html#rent-admin?apr=${encodeURIComponent(live.id)}`,
      referenceType: 'higher_approval',
      referenceId: live.id,
      requestId: live.id,
      meta: { email: live.requesterEmail },
    });
    return { ok: true, request: live };
  };

  const requestRevision = async (id, note, actor) => {
    const req = get(id);
    if (!req) return { ok: false, error: 'الطلب غير موجود' };
    try {
      assertCanDecide(actor);
    } catch (e) {
      return { ok: false, error: e.message };
    }
    if (!String(note || '').trim()) return { ok: false, error: 'يجب توضيح المطلوب تعديله' };
    if (req.status !== STATUS.PENDING && req.status !== STATUS.UNDER_REVIEW) {
      return { ok: false, error: 'لا يمكن طلب تعديل في هذه الحالة' };
    }
    const a = actorMeta(actor);
    const revisionNote = String(note).trim();
    const server = await postDecide(id, 'revise', { note: revisionNote, reason: revisionNote });
    if (!server.ok) return { ok: false, error: server.error || 'تعذر طلب التعديل على السيرفر' };
    const live = mergeServerRequest(id, server.request) || req;
    live.status = STATUS.NEEDS_REVISION;
    live.revisionNote = revisionNote;
    live.updatedAt = nowIso();
    live.history = Array.isArray(live.history) ? live.history : [];
    live.history.push({ at: nowIso(), action: 'needs_revision', by: a.name, detail: revisionNote });
    pushDecision({
      id: `DEC-${live.id}-${Date.now()}`,
      requestId: live.id,
      type: live.type,
      typeLabel: live.typeLabel,
      requesterName: live.requesterName,
      subjectEmployeeNo: live.subjectEmployeeNo,
      decision: 'needs_revision',
      decisionAr: STATUS_AR[STATUS.NEEDS_REVISION],
      decidedBy: a.name,
      decidedByEmployeeNo: a.employeeNo || '',
      reason: revisionNote,
      requestedAt: live.createdAt,
      decidedAt: nowIso(),
    });
    save();
    notify({
      title: 'مطلوب تعديل طلبك',
      body: `طلب ${live.id}: ${revisionNote}`,
      level: 'warning',
      category: 'ops',
      source: 'HIGHER_APPROVALS',
      sourceName: 'موافقات المدير الأعلى',
      link: `dashboard.html#rent-admin?apr=${encodeURIComponent(live.id)}`,
      actionLabel: 'تعديل وإعادة الإرسال',
      needsAction: true,
      referenceType: 'higher_approval',
      referenceId: live.id,
      requestId: live.id,
      meta: { email: live.requesterEmail },
    });
    return { ok: true, request: live };
  };

  const refer = async (id, assignee, actor, note = '') => {
    const req = get(id);
    if (!req) return { ok: false, error: 'الطلب غير موجود' };
    try {
      assertCanDecide(actor);
    } catch (e) {
      return { ok: false, error: e.message };
    }
    const referredTo = String(assignee || '').trim();
    if (!referredTo && !String(note || '').trim()) {
      return { ok: false, error: 'حدد المختص أو سبب الإحالة' };
    }
    if (![STATUS.PENDING, STATUS.UNDER_REVIEW, STATUS.NEEDS_REVISION].includes(req.status)) {
      return { ok: false, error: 'لا يمكن إحالة هذا الطلب في حالته الحالية' };
    }
    const a = actorMeta(actor);
    const beforeStatus = req.status;
    const server = await postDecide(id, 'refer', {
      referredTo,
      referredToLabel: referredTo,
      note,
      reason: note,
    });
    if (!server.ok) return { ok: false, error: server.error || 'تعذر إحالة الطلب على السيرفر' };
    const live = mergeServerRequest(id, server.request) || req;
    live.status = STATUS.REFERRED;
    live.referredTo = referredTo;
    live.referredToLabel = referredTo;
    live.updatedAt = nowIso();
    live.decidedAt = live.decidedAt || nowIso();
    live.decidedBy = live.decidedBy || a.name;
    live.decidedByEmployeeNo = live.decidedByEmployeeNo || a.employeeNo || '';
    const detail = `إحالة إلى ${referredTo}${note ? ` — ${note}` : ''}`;
    live.history = Array.isArray(live.history) ? live.history : [];
    live.history.push({ at: nowIso(), action: 'referred', by: a.name, detail });
    pushDecision({
      id: `DEC-${live.id}-${Date.now()}`,
      requestId: live.id,
      type: live.type,
      typeLabel: live.typeLabel,
      requesterName: live.requesterName,
      decision: 'referred',
      decisionAr: STATUS_AR[STATUS.REFERRED],
      decidedBy: a.name,
      decidedByEmployeeNo: a.employeeNo || '',
      reason: note || detail,
      beforeStatus,
      afterStatus: STATUS.REFERRED,
      requestedAt: live.createdAt,
      decidedAt: live.decidedAt,
    });
    save();
    notify({
      title: 'أُحيل طلب موافقة',
      body: `طلب ${live.id} أُحيل إلى ${referredTo} من ${a.name}.`,
      level: 'info',
      category: 'ops',
      source: 'HIGHER_APPROVALS',
      sourceName: 'موافقات المدير الأعلى',
      link: `dashboard.html#rent-admin?apr=${encodeURIComponent(live.id)}`,
      needsAction: true,
      referenceType: 'higher_approval',
      referenceId: live.id,
      requestId: live.id,
    });
    return { ok: true, request: live };
  };

  const resubmit = (id, patch = {}, actor) => {
    const req = get(id);
    if (!req) return { ok: false, error: 'الطلب غير موجود' };
    if (req.status !== STATUS.NEEDS_REVISION) return { ok: false, error: 'الطلب ليس بانتظار تعديل' };
    const a = actorMeta(actor);
    if (patch.reason != null) req.reason = patch.reason;
    if (patch.requestedValue != null) req.requestedValue = patch.requestedValue;
    if (patch.requestedDisplay != null) req.requestedDisplay = patch.requestedDisplay;
    if (patch.applyPayload != null) req.applyPayload = patch.applyPayload;
    if (patch.currentValue != null) req.currentValue = patch.currentValue;
    if (patch.currentDisplay != null) req.currentDisplay = patch.currentDisplay;
    req.status = STATUS.PENDING;
    req.revisionNote = '';
    req.updatedAt = nowIso();
    req.history.push({ at: nowIso(), action: 'resubmitted', by: a.name, detail: 'إعادة إرسال بعد التعديل' });
    save();
    notify({
      title: 'طلب جديد يحتاج موافقتك',
      body: `أُعيد إرسال طلب ${req.id} (${req.typeLabel}) بعد التعديل.`,
      level: 'warning',
      category: 'ops',
      source: 'HIGHER_APPROVALS',
      sourceName: 'موافقات المدير الأعلى',
      link: `dashboard.html#rent-admin?apr=${encodeURIComponent(req.id)}`,
      actionLabel: 'مراجعة الطلب',
      needsAction: true,
      referenceType: 'higher_approval',
      referenceId: req.id,
      requestId: req.id,
    });
    return { ok: true, request: req };
  };

  /** واجهة مساعدة لإنشاء طلب تعيين دور من فريق العمل — دائم عبر السيرفر */
  const enqueueRoleAssignment = (payload = {}, actor) => {
    const type = payload.editGrantId ? 'role_change' : 'role_grant';
    const curRole = payload.currentRoleCode || '';
    const newRole = payload.roleCode || '';
    const curPerms = payload.currentPermissions || [];
    const newPerms = payload.permissions || [];
    const subject = payload.subjectName || payload.naioshId || '';
    const opLabel = type === 'role_change' ? 'تغيير صلاحيات موظف' : 'إضافة صلاحيات موظف';
    return createRequestAsync(
      {
        type,
        typeLabel: type === 'role_change' ? TYPE_AR.role_change : TYPE_AR.role_grant,
        title: `اعتماد ${opLabel} — ${subject}`,
        sourceModule: 'team_ops',
        sourceModuleLabel: SOURCE_AR.team_ops,
        operation: type,
        operationLabel: opLabel,
        department: 'الموارد البشرية',
        priority: HIGH_ROLES.has(newRole) ? 'high' : 'normal',
        sourceType: 'role_assignment',
        sourceId: payload.editGrantId || `${payload.naioshId}:${newRole}:${Date.now()}`,
        sourceLink: 'dashboard.html#roles-permissions',
        requesterName: actorMeta(actor).name,
        requesterEmployeeNo: actorMeta(actor).employeeNo,
        requesterEmail: actorMeta(actor).email,
        requesterNaioshId: actorMeta(actor).naioshId,
        subjectName: payload.subjectName || '',
        subjectEmployeeNo: payload.subjectEmployeeNo || '',
        subjectNaioshId: payload.naioshId || '',
        workplace: payload.workplace || payload.system || 'HUB',
        org: payload.workplace || '',
        branch: payload.branch || '',
        system: payload.system || 'HUB',
        systemLabel: SOURCE_AR.team_ops,
        affectedLabel: `${payload.subjectName || payload.naioshId} · ${roleLabel(newRole)}`,
        reason: payload.reason || payload.purpose || 'طلب تعيين/تغيير دور يتطلب موافقة المدير الأعلى',
        currentDisplay: `الدور: ${roleLabel(curRole) || '—'}\nالصلاحيات: ${formatPerms(curPerms)}`,
        requestedDisplay: `الدور: ${roleLabel(newRole)}\nالصلاحيات: ${formatPerms(newPerms)}\nالنظام: ${payload.system || 'HUB'}`,
        impactIfApproved: `سيتم منح الموظف ${payload.subjectEmployeeNo || payload.naioshId} دور «${roleLabel(newRole)}» وصلاحياته فور الاعتماد.`,
        impactIfRejected: 'لن يُطبَّق الدور أو الصلاحيات المطلوبة وستبقى صلاحيات الموظف كما هي.',
        currentValue: { roleCode: curRole, permissions: curPerms },
        requestedValue: { roleCode: newRole, permissions: newPerms, system: payload.system },
        applyPayload: {
          naioshId: payload.naioshId,
          roleCode: newRole,
          system: payload.system || 'HUB',
          positionCode: payload.positionCode || null,
          permissions: newPerms,
          editGrantId: payload.editGrantId || null,
          scopeCode: payload.scopeCode,
          governanceLevel: payload.governanceLevel,
        },
        roleCode: newRole,
        permissions: newPerms,
        requiresHigherManagerApproval: true,
      },
      actor
    );
  };

  const enqueueIdentitySuspend = (payload = {}, actor) => {
    const name = payload.subjectName || payload.naioshId || 'موظف';
    return createRequestAsync(
      {
        type: 'identity_suspend',
        typeLabel: TYPE_AR.identity_suspend,
        title: `اعتماد إيقاف حساب — ${name}`,
        sourceModule: payload.sourceModule || 'identity',
        sourceModuleLabel: SOURCE_AR[payload.sourceModule] || SOURCE_AR.identity,
        operation: 'identity_suspend',
        operationLabel: 'إيقاف حساب موظف',
        department: 'الهوية والوصول',
        priority: 'high',
        sourceType: 'identity_suspend',
        sourceId: payload.naioshId,
        sourceLink: payload.sourceLink || 'dashboard.html#identity',
        subjectName: name,
        subjectEmployeeNo: payload.subjectEmployeeNo || '',
        subjectNaioshId: payload.naioshId || '',
        reason: payload.reason || 'طلب إيقاف حساب يتطلب موافقة المدير الأعلى',
        currentDisplay: 'الحساب نشط',
        requestedDisplay: 'إيقاف الوصول إلى الأنظمة',
        impactIfApproved: `سيتم إيقاف وصول الهوية ${payload.naioshId} فور الاعتماد.`,
        impactIfRejected: 'سيبقى الحساب نشطًا ولن يُوقَف الوصول.',
        applyPayload: { action: 'suspend', naioshId: payload.naioshId },
        requiresHigherManagerApproval: true,
      },
      actor
    );
  };

  const enqueueRewardApproval = (payload = {}, actor) => {
    const name = payload.subjectName || payload.employeeName || 'موظف';
    return createRequestAsync(
      {
        type: 'reward_approval',
        typeLabel: TYPE_AR.reward_approval,
        title: `اعتماد مكافأة — ${name}`,
        sourceModule: 'workforce',
        sourceModuleLabel: SOURCE_AR.workforce,
        operation: 'reward_approval',
        operationLabel: 'اعتماد مكافأة موظف',
        department: 'القوى العاملة',
        priority: payload.priority || 'normal',
        sourceType: 'workforce_reward',
        sourceId: payload.rewardId,
        sourceLink: 'dashboard.html#workforce',
        subjectName: name,
        subjectEmployeeNo: payload.subjectEmployeeNo || payload.employeeId || '',
        reason: payload.reason || 'طلب مكافأة يتطلب موافقة المدير الأعلى',
        currentDisplay: 'لا مكافأة معتمدة بعد',
        requestedDisplay: `${payload.rewardType || 'مكافأة'}: ${payload.value || ''} · نقاط: ${payload.points || 0}`,
        impactIfApproved: `سيتم اعتماد مكافأة ${payload.rewardType || ''} للموظف ${name} وإضافة ${payload.points || 0} نقطة.`,
        impactIfRejected: 'لن تُمنح المكافأة ولن تُضاف النقاط.',
        applyPayload: { rewardId: payload.rewardId },
        requiresHigherManagerApproval: true,
      },
      actor
    );
  };

  const enqueuePlatformGrant = async (grant, actor) => {
    if (!grant?.id) return null;
    // Prefer durable server approval id returned from /api/hub/register-requests
    if (grant.approvalId) {
      const existing = get(grant.approvalId);
      if (existing && !existing._localOnly) return existing;
    }
    const bySource = findBySource('platform_grant', grant.id);
    if (bySource && !bySource._localOnly) return bySource;
    return createRequestAsync(
      {
        id: grant.approvalId || undefined,
        type: 'platform_grant',
        typeLabel: TYPE_AR.platform_grant,
        title: `اعتماد إضافة منصة — ${grant.companyName || grant.platformLabel || grant.host || grant.id}`,
        sourceModule: 'platform_grants',
        sourceModuleLabel: SOURCE_AR.platform_grants,
        operation: 'platform_grant',
        operationLabel: 'اعتماد إضافة منصة',
        sourceType: 'platform_grant',
        sourceId: grant.id,
        sourceLink: 'dashboard.html#rent-admin',
        requesterName: grant.adminName || grant.companyName || 'عميل',
        requesterEmail: grant.adminEmail || '',
        subjectName: grant.companyName || grant.adminName || grant.host || 'منصة',
        workplace: [grant.branchLabel, grant.incubatorLabel].filter(Boolean).join(' · '),
        branch: grant.branchLabel || grant.branch || '',
        org: grant.companyName || grant.platformLabel || '',
        department: 'منح المنصات',
        priority: 'high',
        system: grant.requestedSystem || grant.platform || 'HUB',
        systemLabel: grant.requestedSystemLabel || grant.platformLabel || 'سجل معنا',
        affectedLabel: grant.host || grant.companyName || grant.id,
        reason: grant.notes || 'طلب تسجيل منصة ومنح نظام',
        currentDisplay: 'لا وصول مفعّل بعد',
        requestedDisplay: `منح النظام: ${grant.requestedSystemLabel || grant.requestedSystem || '—'} · النطاق: ${grant.host || '—'}`,
        impactIfApproved: `سيتم تفعيل منحة المنصة ${grant.host || grant.id} ومنح النظام للمسؤول ${grant.adminEmail || ''}.`,
        impactIfRejected: 'لن يُفعَّل وصول المنصة.',
        applyPayload: { grantId: grant.id },
        attachments: Array.isArray(grant.attachments) ? grant.attachments : [],
      },
      actor || { name: grant.adminName || 'عميل', email: grant.adminEmail }
    );
  };

  window.HubHigherApprovals = {
    KEY,
    API,
    STATUS,
    STATUS_AR,
    TYPE_AR,
    SOURCE_AR,
    PRIORITY_AR,
    HIGH_ROLES,
    SENSITIVE_PERMS,
    DECIDER_ROLES,
    requiresHigherManagerApproval,
    canDecide,
    reload: () => {
      state = load();
      ingestExternal();
      return state;
    },
    hydrateFromServer,
    syncLocalOnlyToServer,
    getState: () => state,
    list,
    listDecisions: () => state.decisions.slice(),
    get,
    kpis,
    createRequest,
    createRequestAsync,
    enqueueRoleAssignment,
    enqueueIdentitySuspend,
    enqueueRewardApproval,
    enqueuePlatformGrant,
    startReview,
    approve,
    reject,
    requestRevision,
    refer,
    resubmit,
    ingestExternal,
    roleLabel,
    formatPerms,
    formatSystems,
  };

  ingestExternal();
  // Best-effort durable hydrate shortly after boot (staff session may arrive after scripts).
  try {
    const schedule = typeof setTimeout === 'function' ? setTimeout : null;
    if (schedule) {
      schedule(() => {
        try {
          void hydrateFromServer({ force: true, backfill: true });
        } catch (_) {}
      }, 400);
    }
  } catch (_) {}
})();
