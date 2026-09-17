/**
 * موافقات المدير الأعلى — طابور موحّد للعمليات الحساسة
 * الصلاحية ≠ الموافقة: الطلب يُنشأ هنا ويُنفَّذ فقط بعد الاعتماد.
 */
(() => {
  'use strict';

  const KEY = 'naiosh_hub_higher_approvals_v1';
  const YEAR = () => new Date().getFullYear();

  const STATUS = {
    PENDING: 'pending_review',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    NEEDS_REVISION: 'needs_revision',
  };

  const STATUS_AR = {
    [STATUS.PENDING]: 'بانتظار المراجعة',
    [STATUS.APPROVED]: 'تمت الموافقة',
    [STATUS.REJECTED]: 'مرفوضة',
    [STATUS.NEEDS_REVISION]: 'أعيدت للتعديل',
  };

  const TYPE_AR = {
    platform_grant: 'اعتماد منصة / سجل معنا',
    system_rental: 'استئجار نظام',
    role_grant: 'تفعيل دور لموظف',
    role_change: 'تغيير دور موظف',
    permission_change: 'تعديل صلاحيات',
    system_access: 'منح وصول لنظام',
    sensitive_op: 'عملية حساسة',
  };

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

  const nowIso = () => new Date().toISOString();

  const blank = () => ({
    schemaVersion: 1,
    seq: 0,
    requests: [],
    decisions: [],
  });

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
      return parsed;
    } catch {
      return blank();
    }
  };

  let state = load();

  const save = () => {
    localStorage.setItem(KEY, JSON.stringify(state));
    try {
      window.dispatchEvent(new CustomEvent('hub-higher-approvals-changed', { detail: { count: state.requests.length } }));
    } catch (_) {}
    return state;
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
    if (!actor) return { name: 'نظام', employeeNo: '', email: '' };
    if (typeof actor === 'string') return { name: actor, employeeNo: '', email: '' };
    return {
      name: actor.name || actor.email || 'مشغّل هوب',
      employeeNo: actor.employeeNo || actor.empNo || '',
      email: actor.email || '',
      naioshId: actor.naioshId || actor.id || '',
    };
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
    if (['role_grant', 'role_change', 'permission_change', 'system_access'].includes(type) && (HIGH_ROLES.has(role) || perms.length)) {
      return HIGH_ROLES.has(role) || perms.some((p) => SENSITIVE_PERMS.has(p));
    }
    return false;
  };

  const findBySource = (sourceType, sourceId) =>
    state.requests.find((r) => r.sourceType === sourceType && r.sourceId === String(sourceId || ''));

  const pushDecision = (row) => {
    state.decisions.unshift(row);
    if (state.decisions.length > 500) state.decisions.length = 500;
  };

  const createRequest = (payload = {}, actor) => {
    const a = actorMeta(actor);
    const type = payload.type || 'sensitive_op';
    const silent = payload.silent === true;
    if (payload.sourceType && payload.sourceId) {
      const existing = findBySource(payload.sourceType, payload.sourceId);
      if (existing && [STATUS.PENDING, STATUS.NEEDS_REVISION].includes(existing.status)) {
        return existing;
      }
    }
    const row = {
      id: nextId(),
      type,
      typeLabel: payload.typeLabel || TYPE_AR[type] || type,
      status: STATUS.PENDING,
      requesterName: payload.requesterName || a.name,
      requesterEmployeeNo: payload.requesterEmployeeNo || a.employeeNo || '',
      requesterEmail: payload.requesterEmail || a.email || '',
      requesterNaioshId: payload.requesterNaioshId || a.naioshId || '',
      subjectName: payload.subjectName || '',
      subjectEmployeeNo: payload.subjectEmployeeNo || '',
      subjectNaioshId: payload.subjectNaioshId || '',
      workplace: payload.workplace || payload.systemLabel || '',
      system: payload.system || 'HUB',
      systemLabel: payload.systemLabel || payload.system || 'إدارة فريق العمل والصلاحيات',
      affectedLabel: payload.affectedLabel || payload.subjectName || payload.typeLabel || '—',
      reason: payload.reason || '',
      currentValue: payload.currentValue || null,
      requestedValue: payload.requestedValue || null,
      currentDisplay: payload.currentDisplay || '',
      requestedDisplay: payload.requestedDisplay || '',
      applyPayload: payload.applyPayload || null,
      sourceType: payload.sourceType || '',
      sourceId: payload.sourceId ? String(payload.sourceId) : '',
      revisionNote: '',
      rejectReason: '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      decidedAt: '',
      decidedBy: '',
      decidedByEmployeeNo: '',
      history: [
        {
          at: nowIso(),
          action: 'created',
          by: a.name,
          detail: 'إنشاء طلب موافقة',
        },
      ],
    };
    state.requests.unshift(row);
    save();
    if (!silent) {
      notify({
        title: 'طلب جديد يحتاج موافقتك',
        body: `طلب ${row.typeLabel} — ${row.subjectName || row.requesterName} يحتاج إلى مراجعتك.`,
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
    }
    return row;
  };

  const get = (id) => state.requests.find((r) => r.id === id) || null;

  const list = (opts = {}) => {
    ingestExternal();
    let rows = state.requests.slice();
    if (opts.status) rows = rows.filter((r) => r.status === opts.status);
    if (opts.q) {
      const q = String(opts.q).toLowerCase();
      rows = rows.filter((r) =>
        [r.id, r.typeLabel, r.requesterName, r.subjectName, r.subjectEmployeeNo, r.systemLabel, r.reason]
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
    return {
      pending: rows.filter((r) => r.status === STATUS.PENDING).length,
      approved: rows.filter((r) => r.status === STATUS.APPROVED).length,
      rejected: rows.filter((r) => r.status === STATUS.REJECTED).length,
      needsRevision: rows.filter((r) => r.status === STATUS.NEEDS_REVISION).length,
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
              sourceType: 'platform_grant',
              sourceId: g.id,
              requesterName: g.adminName || g.companyName || 'عميل',
              requesterEmail: g.adminEmail || '',
              subjectName: g.companyName || g.adminName || g.host || 'منصة',
              workplace: [g.branchLabel, g.incubatorLabel].filter(Boolean).join(' · '),
              system: g.requestedSystem || g.platform || 'HUB',
              systemLabel: g.requestedSystemLabel || g.platformLabel || 'سجل معنا',
              affectedLabel: g.host || g.companyName || g.id,
              reason: g.notes || 'طلب تسجيل منصة ومنح نظام',
              currentDisplay: 'لا وصول مفعّل بعد',
              requestedDisplay: `منح النظام: ${g.requestedSystemLabel || g.requestedSystem || '—'} · النطاق: ${g.host || '—'}`,
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
            sourceType: 'system_rental',
            sourceId: r.id,
            requesterName: r.customerName || r.email || 'عميل',
            requesterEmail: r.email || '',
            subjectName: r.systemLabel || r.systemCode || 'نظام',
            system: r.systemCode || '',
            systemLabel: r.systemLabel || r.systemCode || 'استئجار نظام',
            affectedLabel: r.systemLabel || r.id,
            reason: r.notes || 'طلب استئجار نظام',
            currentDisplay: 'غير مفعّل',
            requestedDisplay: `تفعيل: ${r.systemLabel || r.systemCode} · خطة: ${r.planLabel || r.plan || '—'}`,
            applyPayload: { rentalId: r.id },
          },
          { name: r.customerName || 'عميل', email: r.email }
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
    return { ok: true, detail: 'لا يوجد منفّذ مرتبط — سُجّلت الموافقة فقط' };
  };

  const approve = (id, actor, note = '') => {
    const req = get(id);
    if (!req) return { ok: false, error: 'الطلب غير موجود' };
    if (req.status !== STATUS.PENDING && req.status !== STATUS.NEEDS_REVISION) {
      return { ok: false, error: 'لا يمكن الموافقة على هذا الطلب في حالته الحالية' };
    }
    const a = actorMeta(actor);
    try {
      const applied = applyApproved(req, a);
      req.status = STATUS.APPROVED;
      req.updatedAt = nowIso();
      req.decidedAt = nowIso();
      req.decidedBy = a.name;
      req.decidedByEmployeeNo = a.employeeNo || '';
      req.history.push({ at: nowIso(), action: 'approved', by: a.name, detail: note || applied?.detail || 'موافقة' });
      pushDecision({
        id: `DEC-${req.id}-${Date.now()}`,
        requestId: req.id,
        type: req.type,
        typeLabel: req.typeLabel,
        requesterName: req.requesterName,
        subjectEmployeeNo: req.subjectEmployeeNo,
        decision: 'approved',
        decisionAr: STATUS_AR[STATUS.APPROVED],
        decidedBy: a.name,
        decidedByEmployeeNo: a.employeeNo || '',
        reason: note || '',
        requestedAt: req.createdAt,
        decidedAt: req.decidedAt,
      });
      save();
      notify({
        title: 'تمت الموافقة على طلبك',
        body: `طلب ${req.id} (${req.typeLabel}) تمت الموافقة عليه من ${a.name}.`,
        level: 'success',
        category: 'ops',
        source: 'HIGHER_APPROVALS',
        sourceName: 'موافقات المدير الأعلى',
        link: `dashboard.html#rent-admin?apr=${encodeURIComponent(req.id)}`,
        referenceType: 'higher_approval',
        referenceId: req.id,
        requestId: req.id,
        meta: { email: req.requesterEmail },
      });
      return { ok: true, request: req };
    } catch (e) {
      return { ok: false, error: e.message || 'فشل تنفيذ الموافقة' };
    }
  };

  const reject = (id, reason, actor) => {
    const req = get(id);
    if (!req) return { ok: false, error: 'الطلب غير موجود' };
    if (!String(reason || '').trim()) return { ok: false, error: 'سبب الرفض إلزامي' };
    if (req.status !== STATUS.PENDING && req.status !== STATUS.NEEDS_REVISION) {
      return { ok: false, error: 'لا يمكن رفض هذا الطلب في حالته الحالية' };
    }
    const a = actorMeta(actor);
    if (req.sourceType === 'platform_grant' || req.type === 'platform_grant') {
      try {
        window.HubPlatformGrants?.rejectGrant?.(req.sourceId || req.applyPayload?.grantId);
      } catch (_) {}
    }
    if (req.sourceType === 'system_rental' || req.type === 'system_rental') {
      try {
        window.HubRentStore?.rejectRental?.(req.sourceId || req.applyPayload?.rentalId, reason);
      } catch (_) {}
    }
    req.status = STATUS.REJECTED;
    req.rejectReason = String(reason).trim();
    req.updatedAt = nowIso();
    req.decidedAt = nowIso();
    req.decidedBy = a.name;
    req.decidedByEmployeeNo = a.employeeNo || '';
    req.history.push({ at: nowIso(), action: 'rejected', by: a.name, detail: req.rejectReason });
    pushDecision({
      id: `DEC-${req.id}-${Date.now()}`,
      requestId: req.id,
      type: req.type,
      typeLabel: req.typeLabel,
      requesterName: req.requesterName,
      subjectEmployeeNo: req.subjectEmployeeNo,
      decision: 'rejected',
      decisionAr: STATUS_AR[STATUS.REJECTED],
      decidedBy: a.name,
      decidedByEmployeeNo: a.employeeNo || '',
      reason: req.rejectReason,
      requestedAt: req.createdAt,
      decidedAt: req.decidedAt,
    });
    save();
    notify({
      title: 'رُفض طلب الموافقة',
      body: `طلب ${req.id}: ${req.rejectReason}`,
      level: 'error',
      category: 'ops',
      source: 'HIGHER_APPROVALS',
      sourceName: 'موافقات المدير الأعلى',
      link: `dashboard.html#rent-admin?apr=${encodeURIComponent(req.id)}`,
      referenceType: 'higher_approval',
      referenceId: req.id,
      requestId: req.id,
      meta: { email: req.requesterEmail },
    });
    return { ok: true, request: req };
  };

  const requestRevision = (id, note, actor) => {
    const req = get(id);
    if (!req) return { ok: false, error: 'الطلب غير موجود' };
    if (!String(note || '').trim()) return { ok: false, error: 'يجب توضيح المطلوب تعديله' };
    if (req.status !== STATUS.PENDING) return { ok: false, error: 'لا يمكن طلب تعديل في هذه الحالة' };
    const a = actorMeta(actor);
    req.status = STATUS.NEEDS_REVISION;
    req.revisionNote = String(note).trim();
    req.updatedAt = nowIso();
    req.history.push({ at: nowIso(), action: 'needs_revision', by: a.name, detail: req.revisionNote });
    pushDecision({
      id: `DEC-${req.id}-${Date.now()}`,
      requestId: req.id,
      type: req.type,
      typeLabel: req.typeLabel,
      requesterName: req.requesterName,
      subjectEmployeeNo: req.subjectEmployeeNo,
      decision: 'needs_revision',
      decisionAr: STATUS_AR[STATUS.NEEDS_REVISION],
      decidedBy: a.name,
      decidedByEmployeeNo: a.employeeNo || '',
      reason: req.revisionNote,
      requestedAt: req.createdAt,
      decidedAt: nowIso(),
    });
    save();
    notify({
      title: 'مطلوب تعديل طلبك',
      body: `طلب ${req.id}: ${req.revisionNote}`,
      level: 'warning',
      category: 'ops',
      source: 'HIGHER_APPROVALS',
      sourceName: 'موافقات المدير الأعلى',
      link: `dashboard.html#rent-admin?apr=${encodeURIComponent(req.id)}`,
      actionLabel: 'تعديل وإعادة الإرسال',
      needsAction: true,
      referenceType: 'higher_approval',
      referenceId: req.id,
      requestId: req.id,
      meta: { email: req.requesterEmail },
    });
    return { ok: true, request: req };
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

  /** واجهة مساعدة لإنشاء طلب تعيين دور من فريق العمل */
  const enqueueRoleAssignment = (payload = {}, actor) => {
    const type = payload.editGrantId ? 'role_change' : 'role_grant';
    const curRole = payload.currentRoleCode || '';
    const newRole = payload.roleCode || '';
    const curPerms = payload.currentPermissions || [];
    const newPerms = payload.permissions || [];
    return createRequest(
      {
        type,
        typeLabel: type === 'role_change' ? TYPE_AR.role_change : TYPE_AR.role_grant,
        requesterName: actorMeta(actor).name,
        requesterEmployeeNo: actorMeta(actor).employeeNo,
        requesterEmail: actorMeta(actor).email,
        requesterNaioshId: actorMeta(actor).naioshId,
        subjectName: payload.subjectName || '',
        subjectEmployeeNo: payload.subjectEmployeeNo || '',
        subjectNaioshId: payload.naioshId || '',
        workplace: payload.workplace || payload.system || 'HUB',
        system: payload.system || 'HUB',
        systemLabel: 'إدارة فريق العمل والصلاحيات',
        affectedLabel: `${payload.subjectName || payload.naioshId} · ${roleLabel(newRole)}`,
        reason: payload.reason || payload.purpose || 'طلب تعيين/تغيير دور يتطلب موافقة المدير الأعلى',
        currentDisplay: `الدور: ${roleLabel(curRole) || '—'}\nالصلاحيات: ${formatPerms(curPerms)}`,
        requestedDisplay: `الدور: ${roleLabel(newRole)}\nالصلاحيات: ${formatPerms(newPerms)}\nالنظام: ${payload.system || 'HUB'}`,
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

  window.HubHigherApprovals = {
    KEY,
    STATUS,
    STATUS_AR,
    TYPE_AR,
    HIGH_ROLES,
    SENSITIVE_PERMS,
    requiresHigherManagerApproval,
    reload: () => {
      state = load();
      ingestExternal();
      return state;
    },
    getState: () => state,
    list,
    listDecisions: () => state.decisions.slice(),
    get,
    kpis,
    createRequest,
    enqueueRoleAssignment,
    approve,
    reject,
    requestRevision,
    resubmit,
    ingestExternal,
    roleLabel,
    formatPerms,
    formatSystems,
  };

  ingestExternal();
})();
