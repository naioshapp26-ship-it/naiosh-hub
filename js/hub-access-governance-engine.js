/**
 * Access Governance 360 — authorization engine
 * Computes Effective Access and decisions: ALLOW | DENY | REQUIRE_APPROVAL | CONDITIONAL_ALLOW | ESCALATE
 */
(() => {
  'use strict';

  const Store = () => window.HubAccessGovStore;
  if (!Store) return;

  const activeStatuses = new Set(['ACTIVE', 'GRANTED', 'APPROVED']);

  const processTemporaryExpiry = (state) => {
    const now = Date.now();
    let changed = false;
    (state.temporaryAccess || []).forEach((t) => {
      if (t.status !== 'ACTIVE') return;
      if (t.endDate && new Date(t.endDate).getTime() <= now) {
        t.status = 'EXPIRED';
        t.revokedAt = Store().nowIso();
        t.revokeReason = 'AUTO_REVOKE';
        changed = true;
        const grant = (state.grants || []).find((g) => g.id === t.grantId || g.grantId === t.grantId);
        if (grant && grant.source === 'TEMPORARY') {
          grant.status = 'REVOKED';
          grant.updatedAt = Store().nowIso();
        }
        Store().pushAudit(state, {
          actor: 'system',
          targetUser: t.naioshId,
          action: 'TEMP_ACCESS_AUTO_REVOKE',
          oldValue: 'ACTIVE',
          newValue: 'EXPIRED',
          permission: t.permission,
          authority: t.authorityCode,
          scope: t.scopeCode,
          system: t.system,
          reason: 'End date reached',
          grantId: t.grantId,
        });
      }
    });
    (state.grants || []).forEach((g) => {
      if (g.status !== 'ACTIVE') return;
      if (g.expiryDate && new Date(g.expiryDate).getTime() <= now) {
        g.status = 'EXPIRED';
        g.updatedAt = Store().nowIso();
        changed = true;
        Store().pushAudit(state, {
          actor: 'system',
          targetUser: g.naioshId,
          action: 'GRANT_AUTO_EXPIRE',
          oldValue: 'ACTIVE',
          newValue: 'EXPIRED',
          grantId: g.grantId,
          system: g.system,
          reason: 'Grant expiry',
        });
      }
    });
    (state.delegations || []).forEach((d) => {
      if (d.status !== 'ACTIVE') return;
      if (d.endDate && new Date(d.endDate).getTime() <= now) {
        d.status = 'EXPIRED';
        changed = true;
        Store().pushAudit(state, {
          actor: 'system',
          targetUser: d.delegateNaioshId,
          action: 'DELEGATION_AUTO_EXPIRE',
          oldValue: 'ACTIVE',
          newValue: 'EXPIRED',
          delegationId: d.id,
          reason: 'Delegation end date',
        });
      }
    });
    if (changed) Store().save(state);
    return changed;
  };

  const findIdentity = (state, ref) => {
    if (!ref) return null;
    if (typeof ref === 'object') {
      return findIdentity(state, ref.employeeNo || ref.naioshId || ref.email || ref.id || ref.name);
    }
    const q = String(ref).toLowerCase();
    return (
      (state.identities || []).find(
        (i) =>
          i.id === ref ||
          String(i.employeeNo || '').toLowerCase() === q ||
          String(i.naioshId || '').toLowerCase() === q ||
          String(i.email || '').toLowerCase() === q ||
          String(i.name || '').toLowerCase() === q
      ) || null
    );
  };

  const nextEmployeeNo = (state) => {
    let max = 0;
    (state.identities || []).forEach((i) => {
      const m = String(i.employeeNo || '').match(/^EMP-(\d+)$/i);
      if (m) max = Math.max(max, Number(m[1]));
    });
    return `EMP-${String(max + 1).padStart(4, '0')}`;
  };

  /** رقم الموظف ثابت بعد الإنشاء — يُنشأ عند أول تعيين تشغيلي */
  const assignEmployeeNo = (state, identity, preferred = null) => {
    if (!identity) return null;
    if (identity.employeeNo) return identity.employeeNo;
    const want = preferred && /^EMP-\d+$/i.test(preferred) ? preferred.toUpperCase() : null;
    const taken = new Set((state.identities || []).map((i) => String(i.employeeNo || '').toUpperCase()).filter(Boolean));
    if (want && !taken.has(want)) {
      identity.employeeNo = want;
    } else {
      identity.employeeNo = nextEmployeeNo(state);
    }
    identity.updatedAt = Store().nowIso();
    return identity.employeeNo;
  };

  const auditTarget = (state, identityOrRef) => {
    const identity = typeof identityOrRef === 'object' && identityOrRef?.id
      ? identityOrRef
      : findIdentity(state, identityOrRef);
    if (!identity) {
      return {
        targetUser: String(identityOrRef || ''),
        targetName: null,
        employeeNo: null,
        naioshId: null,
        identityId: null,
      };
    }
    return {
      targetUser: identity.naioshId,
      targetName: identity.name,
      employeeNo: identity.employeeNo || null,
      naioshId: identity.naioshId,
      identityId: identity.id,
    };
  };

  const BOOTSTRAP_ACTORS = new Set(['مشغّل هوب', 'system', 'migration', 'system-bootstrap', 'bootstrap']);

  const isBootstrapActor = (actor) => BOOTSTRAP_ACTORS.has(String(actor || '').trim());

  const isSuspended = (state, identity) => {
    if (!identity || identity.status === 'suspended' || identity.status === 'revoked') return true;
    return (state.suspensions || []).some((s) => s.identityId === identity.id && s.status === 'ACTIVE');
  };

  const collectGrants = (state, identity) => {
    processTemporaryExpiry(state);
    const grants = (state.grants || []).filter(
      (g) => g.identityId === identity.id && activeStatuses.has(String(g.status || '').toUpperCase())
    );
    const temps = (state.temporaryAccess || []).filter(
      (t) => t.identityId === identity.id && t.status === 'ACTIVE' && (!t.endDate || new Date(t.endDate).getTime() > Date.now())
    );
    temps.forEach((t) => {
      grants.push({
        id: t.id,
        grantId: t.grantId || t.id,
        identityId: identity.id,
        naioshId: identity.naioshId,
        positionCode: t.positionCode || null,
        roleCode: t.roleCode || null,
        system: t.system,
        scopeCode: t.scopeCode,
        permissions: [t.permission].filter(Boolean),
        authorityCodes: t.authorityCode ? [t.authorityCode] : [],
        purpose: t.reason,
        grantedBy: t.grantor,
        approvedBy: t.approver,
        startDate: t.startDate,
        expiryDate: t.endDate,
        status: 'ACTIVE',
        source: 'TEMPORARY',
        governanceLevel: t.governanceLevel || 'SYSTEM',
      });
    });
    const dels = (state.delegations || []).filter(
      (d) => d.delegateIdentityId === identity.id && d.status === 'ACTIVE' && (!d.endDate || new Date(d.endDate).getTime() > Date.now())
    );
    dels.forEach((d) => {
      grants.push({
        id: d.id,
        grantId: d.id,
        identityId: identity.id,
        naioshId: identity.naioshId,
        positionCode: null,
        roleCode: d.roleCode || null,
        system: d.system,
        scopeCode: d.scopeCode,
        permissions: d.permissions || (d.permission ? [d.permission] : []),
        authorityCodes: d.authorityCode ? [d.authorityCode] : [],
        purpose: d.purpose,
        grantedBy: d.delegatorNaioshId,
        approvedBy: d.approver,
        startDate: d.startDate,
        expiryDate: d.endDate,
        status: 'ACTIVE',
        source: 'DELEGATION',
        restrictions: d.restrictions || [],
        governanceLevel: d.governanceLevel || 'SYSTEM',
      });
    });
    return grants;
  };

  const scopeMatches = (grantScope, requestedScope) => {
    if (!requestedScope) return true;
    if (!grantScope) return false;
    if (grantScope === requestedScope) return true;
    if (grantScope === 'GLOBAL') return true;
    if (grantScope === 'HUB-GLOBAL' && String(requestedScope).startsWith('HUB')) return true;
    return false;
  };

  const levelIsolationOk = (grant, requestedLevel) => {
    if (!requestedLevel) return true;
    const g = String(grant.governanceLevel || 'SYSTEM').toUpperCase();
    const r = String(requestedLevel).toUpperCase();
    if (g === r) return true;
    // Isolation: lower levels never elevate to higher
    if (r === 'EMPIRE' && g !== 'EMPIRE') return false;
    if (r === 'HUB' && g === 'SYSTEM') return false;
    return true;
  };

  const authorityAllows = (state, grant, amount) => {
    if (amount == null || amount === '') return { ok: true };
    const codes = grant.authorityCodes || [];
    if (!codes.length) {
      return { ok: false, decision: 'DENY', reason: 'PERMISSION_WITHOUT_AUTHORITY', required: 'Authority required for amount-based action' };
    }
    const authorities = (state.authorities || []).filter((a) => codes.includes(a.code) && a.status === 'active');
    if (!authorities.length) return { ok: false, decision: 'DENY', reason: 'AUTHORITY_NOT_FOUND' };
    const amt = Number(amount);
    for (const a of authorities) {
      const max = a.limits?.maximum;
      if (max == null) return { ok: true, authority: a };
      if (amt <= Number(max)) return { ok: true, authority: a };
    }
    const best = authorities[0];
    return {
      ok: false,
      decision: 'ESCALATE',
      reason: 'AUTHORITY_LIMIT_EXCEEDED',
      authority: best,
      limit: best.limits?.maximum,
      amount: amt,
    };
  };

  const checkSod = (state, identity, permission, context = {}) => {
    const grants = collectGrants(state, identity);
    const held = new Set(grants.flatMap((g) => g.permissions || []));
    held.add(permission);
    const conflicts = [];
    (state.sodRules || [])
      .filter((r) => r.status === 'active')
      .forEach((rule) => {
        // قواعد نفس المعاملة لا تُفعَّل إلا عند وجود transactionId
        if (rule.sameTransaction && !context.transactionId) return;
        const hit = (rule.conflictingPermissions || []).filter((p) => held.has(p));
        if (hit.length >= 2 && hit.includes(permission)) {
          conflicts.push({
            conflictId: `CF-${rule.code}-${identity.naioshId}`,
            rule,
            permissions: hit,
            risk: rule.risk,
            requiredAction: rule.action,
          });
        }
      });
    return conflicts;
  };

  const explainPermission = (state, identityRef, permission, opts = {}) => {
    const identity = findIdentity(state, identityRef);
    if (!identity) {
      return { result: 'DENY', reason: 'IDENTITY_NOT_FOUND', chain: [] };
    }
    if (isSuspended(state, identity)) {
      return { result: 'DENY', reason: 'USER_SUSPENDED', identity, chain: [] };
    }
    const grants = collectGrants(state, identity).filter((g) => {
      if (opts.system && g.system !== opts.system) return false;
      if (opts.scopeCode && !scopeMatches(g.scopeCode, opts.scopeCode)) return false;
      return (g.permissions || []).includes(permission);
    });
    if (!grants.length) {
      return { result: 'DENY', reason: 'NO_MATCHING_GRANT', identity, chain: [] };
    }
    const grant = grants[0];
    const role = (state.roles || []).find((r) => r.code === grant.roleCode);
    const position = (state.positions || []).find((p) => p.code === grant.positionCode);
    const authCode = (grant.authorityCodes || [])[0];
    const authority = (state.authorities || []).find((a) => a.code === authCode);
    return {
      result: 'ALLOWED',
      identity,
      chain: [
        { step: 'IDENTITY', value: identity.naioshId },
        { step: 'POSITION', value: position?.nameAr || grant.positionCode || '—' },
        { step: 'ROLE', value: role?.nameAr || grant.roleCode || '—' },
        { step: 'SYSTEM', value: grant.system },
        { step: 'SCOPE', value: grant.scopeCode },
        { step: 'PERMISSION', value: permission },
        { step: 'AUTHORITY', value: authority?.nameAr || authCode || '—' },
        { step: 'POLICY', value: 'POL-ACCESS-GOV-360' },
        { step: 'GRANT', value: grant.grantId },
        { step: 'RESULT', value: 'ALLOWED' },
      ],
      grant,
      role,
      position,
      authority,
    };
  };

  const authorize = (input = {}) => {
    const state = Store().get();
    processTemporaryExpiry(state);
    const {
      user,
      userId,
      naioshId,
      email,
      resource,
      action,
      permission,
      system,
      scopeCode,
      amount,
      governanceLevel,
      transactionId,
      transactionCreatorId,
    } = input;

    const perm =
      permission ||
      (resource && action ? `${resource}.${String(action).toLowerCase()}` : null) ||
      (resource && action ? `${resource}.${String(action).toUpperCase()}` : null);

    const base = {
      decision: 'DENY',
      reason: 'MISSING_INPUT',
      policy: 'POL-ACCESS-GOV-360',
      timestamp: Store().nowIso(),
    };

    if (!perm) return { ...base, reason: 'PERMISSION_REQUIRED' };

    const identity = findIdentity(state, naioshId || userId || email || user?.email || user?.naioshId || user?.id);
    if (!identity) return { ...base, reason: 'IDENTITY_NOT_FOUND', permission: perm };
    if (isSuspended(state, identity)) return { ...base, reason: 'USER_SUSPENDED', permission: perm, target: identity.naioshId };

    // SoD: creator cannot approve same transaction
    if (transactionId && transactionCreatorId && String(transactionCreatorId) === String(identity.id) && /approve/i.test(perm)) {
      const conflict = {
        conflictId: `CF-SELF-APPROVE-${transactionId}`,
        user: identity.naioshId,
        permissions: [perm],
        transaction: transactionId,
        policy: 'SOD-CREATE-APPROVE-PAY',
        risk: 'high',
        requiredAction: 'BLOCK',
      };
      state.sodConflicts = state.sodConflicts || [];
      state.sodConflicts.unshift({ ...conflict, at: Store().nowIso() });
      Store().save(state);
      return {
        ...base,
        decision: 'DENY',
        reason: 'SOD_CONFLICT',
        permission: perm,
        conflict,
        requiredApprover: 'OTHER_APPROVER',
      };
    }

    const conflicts = checkSod(state, identity, perm, { transactionId });
    if (conflicts.some((c) => c.requiredAction === 'BLOCK')) {
      return { ...base, decision: 'DENY', reason: 'SOD_CONFLICT', permission: perm, conflicts };
    }
    if (conflicts.some((c) => c.requiredAction === 'REQUIRE_APPROVAL')) {
      return {
        ...base,
        decision: 'REQUIRE_APPROVAL',
        reason: 'SOD_REQUIRE_APPROVAL',
        permission: perm,
        conflicts,
        requiredApprover: 'SECURITY',
      };
    }

    const grants = collectGrants(state, identity).filter((g) => {
      if (system && g.system !== system) return false;
      if (!levelIsolationOk(g, governanceLevel)) return false;
      if (scopeCode && !scopeMatches(g.scopeCode, scopeCode)) return false;
      return (g.permissions || []).includes(perm);
    });

    if (!grants.length) {
      return {
        ...base,
        decision: 'DENY',
        reason: 'NO_EFFECTIVE_PERMISSION',
        permission: perm,
        system: system || null,
        scope: scopeCode || null,
        target: identity.naioshId,
      };
    }

    // Prefer most specific grant
    const grant = grants.sort((a, b) => {
      const score = (g) => (g.scopeCode === scopeCode ? 2 : 0) + (g.source === 'TEMPORARY' ? 1 : 0);
      return score(b) - score(a);
    })[0];

    if (/approve/i.test(perm) || resource === 'finance_approvals') {
      const auth = authorityAllows(state, grant, amount);
      if (!auth.ok) {
        return {
          ...base,
          decision: auth.decision || 'DENY',
          reason: auth.reason,
          permission: perm,
          authority: auth.authority?.code || null,
          authorityLimit: auth.limit ?? null,
          amount: auth.amount ?? amount,
          scope: grant.scopeCode,
          system: grant.system,
          grantId: grant.grantId,
          requiredApprover: auth.decision === 'ESCALATE' ? 'FINANCE' : null,
          conditions: auth.authority?.conditions || [],
        };
      }
    }

    return {
      decision: 'ALLOW',
      reason: 'EFFECTIVE_ACCESS_MATCH',
      permission: perm,
      policy: 'POL-ACCESS-GOV-360',
      scope: grant.scopeCode,
      system: grant.system,
      authority: (grant.authorityCodes || [])[0] || null,
      grantId: grant.grantId,
      role: grant.roleCode,
      position: grant.positionCode,
      source: grant.source || 'GRANT',
      target: identity.naioshId,
      timestamp: Store().nowIso(),
    };
  };

  const effectiveAccess = (identityRef) => {
    const state = Store().get();
    processTemporaryExpiry(state);
    const identity = findIdentity(state, identityRef);
    if (!identity) return null;
    if (isSuspended(state, identity)) {
      return {
        identity,
        status: 'SUSPENDED',
        empire: [],
        hub: [],
        systems: {},
        permissions: [],
        authorities: [],
        scopes: [],
        grants: [],
      };
    }
    const grants = collectGrants(state, identity);
    const bySystem = {};
    const empire = [];
    const hub = [];
    grants.forEach((g) => {
      const row = {
        grantId: g.grantId,
        role: g.roleCode,
        position: g.positionCode,
        scope: g.scopeCode,
        permissions: g.permissions || [],
        authorities: g.authorityCodes || [],
        source: g.source || 'GRANT',
        expiryDate: g.expiryDate || null,
        governanceLevel: g.governanceLevel,
      };
      if (g.governanceLevel === 'EMPIRE') empire.push(row);
      else if (g.governanceLevel === 'HUB' || g.system === 'HUB') hub.push(row);
      const sys = g.system || 'UNKNOWN';
      if (!bySystem[sys]) bySystem[sys] = [];
      bySystem[sys].push(row);
    });
    return {
      identity,
      status: 'ACTIVE',
      empire,
      hub,
      systems: bySystem,
      permissions: [...new Set(grants.flatMap((g) => g.permissions || []))],
      authorities: [...new Set(grants.flatMap((g) => g.authorityCodes || []))],
      scopes: [...new Set(grants.map((g) => g.scopeCode).filter(Boolean))],
      grants,
      computedAt: Store().nowIso(),
    };
  };

  const detectOrphans = (state = Store().get()) => {
    const issues = [];
    (state.grants || []).forEach((g) => {
      if (!activeStatuses.has(String(g.status || '').toUpperCase())) return;
      const identity = (state.identities || []).find((i) => i.id === g.identityId);
      if (!identity) {
        issues.push({ type: 'ORPHANED_ACCESS', severity: 'high', grantId: g.grantId, detail: 'Grant بدون هوية', action: 'REVOKE' });
        return;
      }
      if (identity.status !== 'active') {
        issues.push({
          type: 'ORPHANED_ACCESS',
          severity: 'critical',
          grantId: g.grantId,
          user: identity.naioshId,
          detail: 'وصول فعال لهوية غير نشطة',
          action: 'REVOKE',
        });
      }
      if (g.positionCode && !(identity.positions || []).includes(g.positionCode)) {
        issues.push({
          type: 'ORPHANED_ROLE',
          severity: 'medium',
          grantId: g.grantId,
          user: identity.naioshId,
          detail: `دور ${g.roleCode} بدون منصب فعال ${g.positionCode}`,
          action: 'REVIEW',
        });
      }
    });
    (state.delegations || []).forEach((d) => {
      if (d.status !== 'ACTIVE') return;
      const delegator = (state.identities || []).find((i) => i.id === d.delegatorIdentityId || i.naioshId === d.delegatorNaioshId);
      if (!delegator || delegator.status !== 'active' || isSuspended(state, delegator)) {
        issues.push({
          type: 'ORPHANED_DELEGATION',
          severity: 'high',
          delegationId: d.id,
          detail: 'تفويض نشط بينما المفوِّض موقوف/غير موجود',
          action: 'REVOKE',
        });
      }
    });
    return issues;
  };

  const dashboardStats = () => {
    const state = Store().get();
    processTemporaryExpiry(state);
    const now = Date.now();
    const soon = now + 7 * 24 * 3600 * 1000;
    const grants = state.grants || [];
    const activeGrants = grants.filter((g) => activeStatuses.has(String(g.status || '').toUpperCase()));
    const orphans = detectOrphans(state);
    return {
      users: (state.identities || []).length,
      positions: (state.positions || []).filter((p) => p.status === 'active').length,
      roles: (state.roles || []).filter((r) => r.status === 'active').length,
      effectiveAccess: activeGrants.length,
      requests: (state.requests || []).filter((r) => r.status === 'Pending').length,
      activeDelegations: (state.delegations || []).filter((d) => d.status === 'ACTIVE').length,
      temporaryAccess: (state.temporaryAccess || []).filter((t) => t.status === 'ACTIVE').length,
      needsReview: orphans.length + (state.reviews || []).filter((r) => r.status === 'OPEN').length,
      expiringSoon: activeGrants.filter((g) => g.expiryDate && new Date(g.expiryDate).getTime() <= soon && new Date(g.expiryDate).getTime() > now).length,
      suspended: (state.suspensions || []).filter((s) => s.status === 'ACTIVE').length + (state.identities || []).filter((i) => i.status === 'suspended').length,
      revoked: grants.filter((g) => String(g.status).toUpperCase() === 'REVOKED').length,
      sodConflicts: (state.sodConflicts || []).length + orphans.filter((o) => o.type === 'ORPHANED_ROLE').length,
      orphanedAccess: orphans.filter((o) => /ORPHANED/.test(o.type)).length,
      orphans,
    };
  };

  const ROLE_POWER = {
    PLATFORM_CUSTOMER: 1,
    HUB_EMPLOYEE: 2,
    REPORT_VIEWER: 2,
    HUB_AUDITOR: 3,
    HUB_ADMIN: 4,
    SYSTEM_MANAGER: 5,
    BRANCH_MANAGER: 5,
    PLATFORM_MANAGER: 5,
    INCUBATOR_MANAGER: 5,
    SYSTEM_OWNER: 6,
    SUPER_ADMIN: 10,
  };

  const actorGrantPower = (state, actorIdentity, actorRef) => {
    if (!actorIdentity) {
      if (isBootstrapActor(actorRef)) return { isBootstrap: true, isSuper: true, perms: new Set(), maxRole: 10 };
      return { isBootstrap: false, isSuper: false, perms: new Set(), maxRole: 0, unknown: true };
    }
    const grants = collectGrants(state, actorIdentity);
    const perms = new Set();
    let maxRole = 0;
    let isSuper = false;
    grants.forEach((g) => {
      (g.permissions || []).forEach((p) => perms.add(p));
      maxRole = Math.max(maxRole, ROLE_POWER[g.roleCode] || 0);
      if (g.roleCode === 'SUPER_ADMIN' || (g.permissions || []).includes('access_governance.manage')) isSuper = true;
    });
    if (perms.has('access_governance.manage')) isSuper = true;
    return { isBootstrap: false, isSuper, perms, maxRole };
  };

  const assertCanAssign = (state, actor, roleCode, permissions = []) => {
    const actorIdentity = findIdentity(state, actor);
    const power = actorGrantPower(state, actorIdentity, actor);
    if (power.unknown) throw new Error('غير مصرح بتعيين الوصول');
    if (power.isBootstrap || power.isSuper) return;
    const decision = authorize({
      naioshId: actorIdentity?.naioshId || actor,
      permission: 'roles.assign',
      system: 'HUB',
      governanceLevel: 'HUB',
    });
    const canAssign =
      decision.decision === 'ALLOW' ||
      power.perms.has('roles.assign') ||
      power.perms.has('users.assign') ||
      power.perms.has('access_governance.manage');
    if (!canAssign) throw new Error('غير مصرح بتعيين الوصول');
    const targetPower = ROLE_POWER[roleCode] || 0;
    if (targetPower > power.maxRole) {
      throw new Error('لا يمكنك منح دور أعلى من حدود سلطتك');
    }
    const illegal = (permissions || []).filter((p) => !power.perms.has(p) && !power.perms.has('roles.manage'));
    if (illegal.length) {
      throw new Error('لا يمكنك منح صلاحيات أعلى من حدود سلطتك');
    }
  };

  const createGrant = (payload, actor = 'مشغّل هوب') => {
    return Store().update((state) => {
      const identity = findIdentity(state, payload.naioshId || payload.identityId || payload.email);
      if (!identity) throw new Error('المستخدم غير موجود');
      const role = (state.roles || []).find((r) => r.code === payload.roleCode);
      if (!role) throw new Error('الدور غير موجود');
      if (payload.positionCode && role.eligiblePositions?.length && !role.eligiblePositions.includes(payload.positionCode)) {
        throw new Error('الدور غير مؤهل لهذا المنصب');
      }
      const permissions = payload.permissions?.length ? payload.permissions.slice() : role.permissions.slice();
      assertCanAssign(state, actor, role.code, permissions);
      assignEmployeeNo(state, identity, payload.employeeNo || null);

      const grant = {
        id: Store().uid('grant'),
        grantId: `GRANT-${Date.now().toString(36).toUpperCase()}`,
        identityId: identity.id,
        naioshId: identity.naioshId,
        employeeNo: identity.employeeNo,
        positionCode: payload.positionCode || null,
        roleCode: role.code,
        system: payload.system,
        scopeCode: payload.scopeCode,
        permissions,
        authorityCodes: payload.authorityCodes || [],
        purpose: payload.purpose || '',
        grantedBy: actor,
        approvedBy: payload.approvedBy || actor,
        startDate: payload.startDate || Store().nowIso(),
        expiryDate: payload.expiryDate || null,
        reviewDate: payload.reviewDate || null,
        riskLevel: payload.riskLevel || 'medium',
        status: payload.status || 'ACTIVE',
        evidence: payload.evidence || {},
        governanceLevel: payload.governanceLevel || (payload.system === 'HUB' ? 'HUB' : 'SYSTEM'),
        createdAt: Store().nowIso(),
        updatedAt: Store().nowIso(),
      };
      state.grants.unshift(grant);
      if (payload.positionCode && !(identity.positions || []).includes(payload.positionCode)) {
        identity.positions = [...(identity.positions || []), payload.positionCode];
      }
      Store().pushAudit(state, {
        actor,
        ...auditTarget(state, identity),
        action: 'GRANT_CREATED',
        newValue: grant,
        role: grant.roleCode,
        permission: (grant.permissions || []).join(','),
        authority: (grant.authorityCodes || []).join(','),
        scope: grant.scopeCode,
        system: grant.system,
        reason: grant.purpose,
        grantId: grant.grantId,
      });
      return state;
    }, actor);
  };

  const revokeGrant = (grantId, actor = 'مشغّل هوب', reason = '') => {
    return Store().update((state) => {
      const grant = (state.grants || []).find((g) => g.id === grantId || g.grantId === grantId);
      if (!grant) throw new Error('Grant غير موجود');
      const old = { ...grant };
      grant.status = 'REVOKED';
      grant.updatedAt = Store().nowIso();
      grant.revokedBy = actor;
      grant.revokeReason = reason;
      (state.temporaryAccess || []).forEach((t) => {
        if (t.grantId === grant.grantId || t.grantId === grant.id) {
          t.status = 'REVOKED';
        }
      });
      (state.delegations || []).forEach((d) => {
        if (d.linkedGrantId === grant.grantId) d.status = 'REVOKED';
      });
      state.revocations = state.revocations || [];
      state.revocations.unshift({
        id: Store().uid('rev'),
        grantId: grant.grantId,
        identityId: grant.identityId,
        at: Store().nowIso(),
        by: actor,
        reason,
        cascades: ['roles', 'permissions', 'authorities', 'scopes', 'delegations', 'temporaryAccess'],
      });
      Store().pushAudit(state, {
        actor,
        ...auditTarget(state, grant.identityId || grant.naioshId),
        action: 'GRANT_REVOKED',
        oldValue: old,
        newValue: { status: 'REVOKED' },
        reason,
        grantId: grant.grantId,
        system: grant.system,
      });
      return state;
    }, actor);
  };

  const suspendIdentity = (identityRef, actor = 'مشغّل هوب', reason = '') => {
    return Store().update((state) => {
      const identity = findIdentity(state, identityRef);
      if (!identity) throw new Error('المستخدم غير موجود');
      identity.status = 'suspended';
      identity.updatedAt = Store().nowIso();
      state.suspensions = state.suspensions || [];
      state.suspensions.unshift({
        id: Store().uid('sus'),
        identityId: identity.id,
        naioshId: identity.naioshId,
        status: 'ACTIVE',
        reason,
        by: actor,
        at: Store().nowIso(),
      });
      Store().pushAudit(state, {
        actor,
        ...auditTarget(state, identity),
        action: 'USER_SUSPENDED',
        reason,
        system: 'HUB',
      });
      return state;
    }, actor);
  };

  const createTemporaryAccess = (payload, actor = 'مشغّل هوب') => {
    return Store().update((state) => {
      const identity = findIdentity(state, payload.naioshId || payload.identityId);
      if (!identity) throw new Error('المستخدم غير موجود');
      const row = {
        id: Store().uid('tmp'),
        grantId: `TMP-${Date.now().toString(36).toUpperCase()}`,
        identityId: identity.id,
        naioshId: identity.naioshId,
        system: payload.system,
        permission: payload.permission,
        authorityCode: payload.authorityCode || null,
        scopeCode: payload.scopeCode,
        roleCode: payload.roleCode || null,
        positionCode: payload.positionCode || null,
        startDate: payload.startDate || Store().nowIso(),
        endDate: payload.endDate,
        reason: payload.reason || '',
        grantor: actor,
        approver: payload.approver || actor,
        status: 'ACTIVE',
        governanceLevel: payload.governanceLevel || 'SYSTEM',
        createdAt: Store().nowIso(),
      };
      if (!row.endDate) throw new Error('End Date إلزامي للوصول المؤقت');
      state.temporaryAccess.unshift(row);
      Store().pushAudit(state, {
        actor,
        targetUser: identity.naioshId,
        action: 'TEMP_ACCESS_GRANTED',
        newValue: row,
        permission: row.permission,
        system: row.system,
        scope: row.scopeCode,
        reason: row.reason,
        grantId: row.grantId,
      });
      return state;
    }, actor);
  };

  const createDelegation = (payload, actor = 'مشغّل هوب') => {
    return Store().update((state) => {
      const delegator = findIdentity(state, payload.delegatorNaioshId || payload.delegatorId);
      const delegate = findIdentity(state, payload.delegateNaioshId || payload.delegateId);
      if (!delegator || !delegate) throw new Error('المفوِّض أو المفوَّض غير موجود');
      // Assistant never inherits full manager role — only explicit permissions
      const perms = payload.permissions || (payload.permission ? [payload.permission] : []);
      if (!perms.length) throw new Error('يجب تحديد صلاحية واحدة على الأقل');
      if (payload.endDate == null) throw new Error('التفويض يجب أن يكون مؤقتًا (End Date إلزامي)');
      const row = {
        id: Store().uid('dlg'),
        delegatorIdentityId: delegator.id,
        delegatorNaioshId: delegator.naioshId,
        delegateIdentityId: delegate.id,
        delegateNaioshId: delegate.naioshId,
        roleCode: payload.roleCode || null,
        permission: perms[0],
        permissions: perms,
        authorityCode: payload.authorityCode || null,
        scopeCode: payload.scopeCode,
        system: payload.system,
        purpose: payload.purpose || '',
        startDate: payload.startDate || Store().nowIso(),
        endDate: payload.endDate,
        conditions: payload.conditions || [],
        restrictions: payload.restrictions || ['NO_ROLE_INHERITANCE', 'NO_REDELEGATION'],
        approver: payload.approver || actor,
        status: 'ACTIVE',
        governanceLevel: payload.governanceLevel || 'SYSTEM',
        createdAt: Store().nowIso(),
      };
      state.delegations.unshift(row);
      Store().pushAudit(state, {
        actor,
        targetUser: delegate.naioshId,
        action: 'DELEGATION_CREATED',
        newValue: row,
        permission: perms.join(','),
        system: row.system,
        scope: row.scopeCode,
        reason: row.purpose,
        delegationId: row.id,
      });
      return state;
    }, actor);
  };

  const reactivateIdentity = (identityRef, actor = 'مشغّل هوب', reason = '') => {
    return Store().update((state) => {
      const identity = findIdentity(state, identityRef);
      if (!identity) throw new Error('المستخدم غير موجود');
      const old = identity.status;
      identity.status = 'active';
      identity.updatedAt = Store().nowIso();
      (state.suspensions || []).forEach((s) => {
        if (s.identityId === identity.id && s.status === 'ACTIVE') s.status = 'ENDED';
      });
      Store().pushAudit(state, {
        actor,
        ...auditTarget(state, identity),
        action: 'USER_REACTIVATED',
        oldValue: old,
        newValue: 'active',
        reason,
        system: 'HUB',
      });
      return state;
    }, actor);
  };

  const archiveIdentity = (identityRef, actor = 'مشغّل هوب', reason = '') => {
    return Store().update((state) => {
      const identity = findIdentity(state, identityRef);
      if (!identity) throw new Error('المستخدم غير موجود');
      const old = { ...identity };
      identity.status = 'archived';
      identity.updatedAt = Store().nowIso();
      (state.grants || []).forEach((g) => {
        if (g.identityId === identity.id && String(g.status).toUpperCase() === 'ACTIVE') {
          g.status = 'REVOKED';
          g.revokeReason = 'USER_ARCHIVED';
          g.updatedAt = Store().nowIso();
        }
      });
      Store().pushAudit(state, {
        actor,
        ...auditTarget(state, identity),
        action: 'USER_ARCHIVED',
        oldValue: old,
        newValue: { status: 'archived' },
        reason: reason || 'أرشفة المستخدم مع الاحتفاظ بسجل التدقيق',
        system: 'HUB',
      });
      return state;
    }, actor);
  };

  const updateIdentity = (identityRef, patch = {}, actor = 'مشغّل هوب') => {
    return Store().update((state) => {
      const identity = findIdentity(state, identityRef);
      if (!identity) throw new Error('المستخدم غير موجود');
      const old = { name: identity.name, email: identity.email };
      if (patch.name != null) identity.name = String(patch.name).trim();
      if (patch.email != null) identity.email = String(patch.email).trim();
      // رقم الموظف ثابت — لا يُعدَّل من تحديث الملف الشخصي
      identity.updatedAt = Store().nowIso();
      Store().pushAudit(state, {
        actor,
        ...auditTarget(state, identity),
        action: 'USER_PROFILE_UPDATED',
        oldValue: old,
        newValue: { name: identity.name, email: identity.email },
        reason: patch.reason || 'تعديل بيانات المستخدم',
        system: 'HUB',
      });
      return state;
    }, actor);
  };

  const updateGrant = (grantId, patch = {}, actor = 'مشغّل هوب') => {
    return Store().update((state) => {
      const grant = (state.grants || []).find((g) => g.id === grantId || g.grantId === grantId);
      if (!grant) throw new Error('التعيين غير موجود');
      const old = { ...grant };
      const nextRole = patch.roleCode || grant.roleCode;
      const nextPerms = Array.isArray(patch.permissions) ? patch.permissions.slice() : grant.permissions || [];
      assertCanAssign(state, actor, nextRole, nextPerms);
      ['positionCode', 'roleCode', 'system', 'scopeCode', 'purpose', 'governanceLevel', 'expiryDate', 'reviewDate'].forEach((k) => {
        if (patch[k] !== undefined) grant[k] = patch[k];
      });
      if (Array.isArray(patch.permissions)) grant.permissions = patch.permissions.slice();
      if (Array.isArray(patch.authorityCodes)) grant.authorityCodes = patch.authorityCodes.slice();
      if (patch.status) grant.status = patch.status;
      grant.updatedAt = Store().nowIso();
      const identity = findIdentity(state, grant.identityId);
      if (identity) {
        assignEmployeeNo(state, identity);
        grant.employeeNo = identity.employeeNo;
        if (grant.positionCode && !(identity.positions || []).includes(grant.positionCode)) {
          identity.positions = [...(identity.positions || []), grant.positionCode];
        }
      }
      Store().pushAudit(state, {
        actor,
        ...auditTarget(state, identity || grant.naioshId),
        action: 'GRANT_UPDATED',
        oldValue: old,
        newValue: grant,
        role: grant.roleCode,
        permission: (grant.permissions || []).join(','),
        scope: grant.scopeCode,
        system: grant.system,
        reason: patch.reason || 'تغيير التعيين',
        grantId: grant.grantId,
      });
      return state;
    }, actor);
  };

  const ensureIdentity = (payload = {}, actor = 'مشغّل هوب') => {
    let out = null;
    Store().update((state) => {
      let identity = findIdentity(state, payload.employeeNo || payload.naioshId || payload.email);
      if (identity) {
        out = identity;
        return state;
      }
      identity = {
        id: Store().uid('id'),
        naioshId: payload.naioshId || `NAI-${Date.now().toString(36).toUpperCase()}`,
        employeeNo: null,
        name: payload.name || payload.email,
        email: payload.email,
        userType: payload.userType || 'STAFF',
        verificationStatus: 'VERIFIED',
        status: 'active',
        positions: payload.positions || [],
        createdAt: Store().nowIso(),
        updatedAt: Store().nowIso(),
      };
      if (payload.asStaff || payload.employeeNo) {
        assignEmployeeNo(state, identity, payload.employeeNo || null);
      }
      state.identities.unshift(identity);
      Store().pushAudit(state, {
        actor,
        ...auditTarget(state, identity),
        action: 'USER_CREATED',
        newValue: identity,
        reason: payload.reason || 'إضافة مستخدم جديد',
        system: 'HUB',
      });
      out = identity;
      return state;
    }, actor);
    return out;
  };

  const ensureEmployeeNumbers = () => {
    return Store().update((state) => {
      const preferred = {
        'NAI-LEADER-001': 'EMP-0001',
        'NAI-USER-0025': 'EMP-0002',
        'NAI-MALIKA-001': 'EMP-0003',
      };
      const grantedIds = new Set(
        (state.grants || [])
          .filter((g) => String(g.status || '').toUpperCase() === 'ACTIVE' || String(g.status || '').toUpperCase() === 'REVOKED')
          .map((g) => g.identityId)
      );
      (state.identities || []).forEach((i) => {
        if (i.employeeNo) return;
        if (preferred[i.naioshId]) {
          const taken = (state.identities || []).some(
            (x) => x !== i && String(x.employeeNo || '').toUpperCase() === preferred[i.naioshId]
          );
          if (!taken) {
            i.employeeNo = preferred[i.naioshId];
            return;
          }
        }
        if (grantedIds.has(i.id) || i.userType === 'STAFF') {
          assignEmployeeNo(state, i);
        }
      });
      (state.grants || []).forEach((g) => {
        if (g.employeeNo) return;
        const id = findIdentity(state, g.identityId || g.naioshId);
        if (id?.employeeNo) g.employeeNo = id.employeeNo;
      });
      return state;
    }, 'system');
  };

  window.HubAccessGov = {
    authorize,
    effectiveAccess,
    explainPermission,
    dashboardStats,
    detectOrphans,
    processTemporaryExpiry,
    createGrant,
    revokeGrant,
    suspendIdentity,
    reactivateIdentity,
    archiveIdentity,
    updateIdentity,
    updateGrant,
    ensureIdentity,
    ensureEmployeeNumbers,
    assignEmployeeNo: (identityRef, preferred) => {
      let out = null;
      Store().update((state) => {
        const identity = findIdentity(state, identityRef);
        out = assignEmployeeNo(state, identity, preferred);
        return state;
      }, 'system');
      return out;
    },
    nextEmployeeNo: () => nextEmployeeNo(Store().get()),
    createTemporaryAccess,
    createDelegation,
    findIdentity: (ref) => findIdentity(Store().get(), ref),
    collectGrants: (ref) => {
      const state = Store().get();
      const identity = findIdentity(state, ref);
      return identity ? collectGrants(state, identity) : [];
    },
  };
})();
