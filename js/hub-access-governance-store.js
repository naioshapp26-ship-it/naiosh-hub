/**
 * Access Governance 360 — store + migration + catalogs
 * Identity ≠ Position ≠ Role ≠ Scope ≠ Permission ≠ Authority ≠ Access
 * localStorage: hubAccessGovV1 (mirrors into HubStore.rolesHub.accessGov when available)
 */
(() => {
  'use strict';

  const KEY = 'hubAccessGovV1';
  const SCHEMA = 1;

  const uid = (p = 'ag') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const nowIso = () => new Date().toISOString();

  const COMPONENT_STATUS = {
    positions: 'IMPLEMENTED',
    roles: 'IMPLEMENTED',
    permissions: 'IMPLEMENTED',
    authorities: 'IMPLEMENTED',
    scopes: 'IMPLEMENTED',
    grants: 'IMPLEMENTED',
    requests: 'IMPLEMENTED',
    delegations: 'IMPLEMENTED',
    temporaryAccess: 'IMPLEMENTED',
    effectiveAccess: 'IMPLEMENTED',
    authorize: 'IMPLEMENTED',
    sod: 'IMPLEMENTED',
    accessReview: 'IMPLEMENTED',
    audit: 'IMPLEMENTED',
    matrix: 'IMPLEMENTED',
    user360: 'IMPLEMENTED',
    assignmentWizard: 'IMPLEMENTED',
    myAccess: 'IMPLEMENTED',
    aiAgentsGov: 'PARTIALLY_IMPLEMENTED',
    serverApiSync: 'PARTIALLY_IMPLEMENTED',
  };

  const LEGACY_ROLE_MAP = {
    supreme_leader: { roleCode: 'SUPER_ADMIN', positionCode: 'EMP_SUPREME_LEADER', level: 'EMPIRE' },
    admin: { roleCode: 'HUB_ADMIN', positionCode: 'HUB_ADMIN_POS', level: 'HUB' },
    manager: { roleCode: 'BRANCH_MANAGER', positionCode: 'BRANCH_MANAGER_POS', level: 'SYSTEM' },
    auditor: { roleCode: 'HUB_AUDITOR', positionCode: 'HUB_AUDITOR_POS', level: 'HUB' },
    employee: { roleCode: 'HUB_EMPLOYEE', positionCode: 'HUB_EMPLOYEE_POS', level: 'HUB' },
    customer: { roleCode: 'PLATFORM_CUSTOMER', positionCode: 'CUSTOMER_POS', level: 'SYSTEM' },
  };

  const ACTION_SET = [
    'VIEW',
    'CREATE',
    'EDIT',
    'SUBMIT',
    'UPLOAD',
    'SEARCH',
    'EXPORT',
    'ASSIGN',
    'EXECUTE',
    'APPROVE',
    'REJECT',
    'PUBLISH',
    'SUSPEND',
    'CONFIGURE',
    'AUDIT',
    'MANAGE',
    'DELETE',
  ];

  const listSystems = () => {
    const fromOps = window.HubOpsCatalog?.listSystems?.() || window.HubOpsCatalog?.get?.()?.systems;
    if (Array.isArray(fromOps) && fromOps.length) {
      return fromOps
        .filter((s) => s && s.status !== 'archived')
        .map((s) => ({
          code: s.code || s.id,
          nameAr: s.name || s.shortName || s.code,
          nameEn: s.shortName || s.code,
          level: s.isUmbrella || s.code === 'HUB' ? 'HUB' : 'SYSTEM',
          status: s.status || 'active',
        }));
    }
    return [
      { code: 'HUB', nameAr: 'نايوش هوب', nameEn: 'HUB', level: 'HUB', status: 'active' },
      { code: 'ERP', nameAr: 'نايوش إي آر بي', nameEn: 'ERP', level: 'SYSTEM', status: 'active' },
      { code: 'CRM', nameAr: 'إدارة العملاء', nameEn: 'CRM', level: 'SYSTEM', status: 'active' },
      { code: 'LMS', nameAr: 'نظام التعلم', nameEn: 'LMS', level: 'SYSTEM', status: 'active' },
      { code: 'LAW', nameAr: 'نايوش لو', nameEn: 'LAW', level: 'SYSTEM', status: 'active' },
      { code: 'FIT', nameAr: 'نايوش فيت', nameEn: 'FIT', level: 'SYSTEM', status: 'active' },
      { code: 'ACADEMY', nameAr: 'أكاديمية نايوش', nameEn: 'ACADEMY', level: 'SYSTEM', status: 'active' },
      { code: 'POSHA', nameAr: 'بوشا', nameEn: 'POSHA', level: 'SYSTEM', status: 'active' },
      { code: 'NAIS', nameAr: 'نايس', nameEn: 'NAIS', level: 'SYSTEM', status: 'active' },
      { code: 'SMARTX', nameAr: 'سمارتكس', nameEn: 'SMARTX', level: 'SYSTEM', status: 'active' },
    ];
  };

  const seedPermissions = () => {
    const resources = [
      ['access_governance', 'حوكمة الوصول'],
      ['roles', 'الأدوار'],
      ['positions', 'المناصب'],
      ['users', 'المستخدمون'],
      ['customer_requests', 'طلبات العملاء'],
      ['policies', 'السياسات'],
      ['finance_approvals', 'اعتمادات مالية'],
      ['systems', 'الأنظمة'],
      ['audit', 'التدقيق'],
      ['delegations', 'التفويضات'],
      ['workflow', 'سير العمل'],
    ];
    const actionsByResource = {
      access_governance: ['VIEW', 'MANAGE', 'CONFIGURE', 'AUDIT'],
      roles: ['VIEW', 'CREATE', 'EDIT', 'ASSIGN', 'SUSPEND', 'AUDIT'],
      positions: ['VIEW', 'CREATE', 'EDIT', 'ASSIGN', 'AUDIT'],
      users: ['VIEW', 'CREATE', 'EDIT', 'SUSPEND', 'ASSIGN', 'AUDIT'],
      customer_requests: ['VIEW', 'CREATE', 'EDIT', 'SUBMIT', 'APPROVE', 'REJECT', 'ASSIGN', 'EXPORT'],
      policies: ['VIEW', 'CREATE', 'EDIT', 'PUBLISH', 'APPROVE', 'AUDIT'],
      finance_approvals: ['VIEW', 'APPROVE', 'REJECT', 'AUDIT'],
      systems: ['VIEW', 'CONFIGURE', 'MANAGE', 'EXECUTE'],
      audit: ['VIEW', 'EXPORT', 'AUDIT'],
      delegations: ['VIEW', 'CREATE', 'EDIT', 'SUSPEND', 'APPROVE'],
      workflow: ['VIEW', 'EXECUTE', 'ASSIGN', 'APPROVE'],
    };
    const out = [];
    resources.forEach(([code, nameAr]) => {
      (actionsByResource[code] || ['VIEW']).forEach((action) => {
        out.push({
          id: `perm-${code}-${action}`.toLowerCase(),
          code: `${code}.${action.toLowerCase()}`,
          resource: code,
          action,
          nameAr: `${nameAr} · ${action}`,
          nameEn: `${code}.${action}`,
          status: 'active',
        });
      });
    });
    return out;
  };

  const seedPositions = () => [
    { code: 'EMP_SUPREME_LEADER', nameAr: 'القائد الأعلى', nameEn: 'Supreme Leader', orgLevel: 'EMPIRE', parentEntity: 'NAIOSHAI_EMPIRE', eligibleRoles: ['SUPER_ADMIN'], status: 'active' },
    { code: 'EMP_GOVERNOR', nameAr: 'حاكم إمبراطوري', nameEn: 'Empire Governor', orgLevel: 'EMPIRE', parentEntity: 'NAIOSHAI_EMPIRE', eligibleRoles: ['SUPER_ADMIN'], status: 'active' },
    { code: 'HUB_ADMIN_POS', nameAr: 'مشرف هوب', nameEn: 'Hub Admin', orgLevel: 'HUB', parentEntity: 'NAIOSHAI_HUB_360', eligibleRoles: ['HUB_ADMIN', 'HUB_AUDITOR'], status: 'active' },
    { code: 'HUB_AUDITOR_POS', nameAr: 'مدقق هوب', nameEn: 'Hub Auditor', orgLevel: 'HUB', parentEntity: 'NAIOSHAI_HUB_360', eligibleRoles: ['HUB_AUDITOR'], status: 'active' },
    { code: 'HUB_EMPLOYEE_POS', nameAr: 'موظف هوب', nameEn: 'Hub Employee', orgLevel: 'HUB', parentEntity: 'NAIOSHAI_HUB_360', eligibleRoles: ['HUB_EMPLOYEE'], status: 'active' },
    { code: 'BRANCH_MANAGER_POS', nameAr: 'مدير فرع', nameEn: 'Branch Manager', orgLevel: 'BRANCH', parentEntity: 'BRANCH', eligibleRoles: ['BRANCH_MANAGER', 'REPORT_VIEWER'], status: 'active' },
    { code: 'INCUBATOR_MANAGER_POS', nameAr: 'مدير حاضنة', nameEn: 'Incubator Manager', orgLevel: 'INCUBATOR', parentEntity: 'INCUBATOR', eligibleRoles: ['INCUBATOR_MANAGER'], status: 'active' },
    { code: 'PLATFORM_MANAGER_POS', nameAr: 'مدير منصة', nameEn: 'Platform Manager', orgLevel: 'PLATFORM', parentEntity: 'PLATFORM', eligibleRoles: ['PLATFORM_MANAGER'], status: 'active' },
    { code: 'SYSTEM_OWNER_POS', nameAr: 'مالك نظام', nameEn: 'System Owner', orgLevel: 'SYSTEM', parentEntity: 'SYSTEM', eligibleRoles: ['SYSTEM_OWNER', 'SYSTEM_MANAGER'], status: 'active' },
    { code: 'CUSTOMER_POS', nameAr: 'عميل منصة', nameEn: 'Platform Customer', orgLevel: 'CUSTOMER', parentEntity: 'PLATFORM', eligibleRoles: ['PLATFORM_CUSTOMER'], status: 'active' },
  ].map((p) => ({
    id: uid('pos'),
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...p,
  }));

  const seedRoles = () => {
    const mk = (code, nameAr, nameEn, level, systems, permCodes, eligiblePositions, scopeType) => ({
      id: uid('role'),
      code,
      nameAr,
      nameEn,
      level,
      applicableSystems: systems,
      defaultScopeType: scopeType,
      permissions: permCodes,
      authorities: [],
      eligiblePositions,
      status: 'active',
      version: 1,
      source: 'Master Catalog',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      legacyCodes: [],
    });
    return [
      mk('SUPER_ADMIN', 'سوبر آدمن', 'Super Admin', 'EMPIRE', ['HUB', 'ERP', 'CRM', 'LMS', 'LAW', 'FIT', 'ACADEMY', 'POSHA'], ['access_governance.manage', 'roles.manage', 'users.manage', 'systems.manage', 'audit.view', 'finance_approvals.approve', 'policies.publish'], ['EMP_SUPREME_LEADER', 'EMP_GOVERNOR'], 'GLOBAL'),
      mk('HUB_ADMIN', 'مشرف هوب', 'Hub Admin', 'HUB', ['HUB'], ['access_governance.view', 'roles.edit', 'users.assign', 'systems.configure', 'audit.view', 'delegations.create'], ['HUB_ADMIN_POS'], 'HUB-GLOBAL'),
      mk('HUB_AUDITOR', 'مدقق هوب', 'Hub Auditor', 'HUB', ['HUB', 'ERP'], ['audit.view', 'audit.export', 'roles.view', 'users.view', 'access_governance.view'], ['HUB_AUDITOR_POS'], 'HUB-GLOBAL'),
      mk('HUB_EMPLOYEE', 'موظف هوب', 'Hub Employee', 'HUB', ['HUB'], ['users.view', 'customer_requests.view', 'customer_requests.create'], ['HUB_EMPLOYEE_POS'], 'DEPARTMENT'),
      mk('BRANCH_MANAGER', 'مدير فرع', 'Branch Manager', 'SYSTEM', ['ERP', 'CRM'], ['customer_requests.view', 'customer_requests.approve', 'finance_approvals.approve', 'users.view', 'workflow.execute'], ['BRANCH_MANAGER_POS'], 'BRANCH'),
      mk('REPORT_VIEWER', 'عارض تقارير', 'Report Viewer', 'SYSTEM', ['HUB', 'ERP'], ['users.view', 'audit.view', 'customer_requests.view'], ['BRANCH_MANAGER_POS', 'HUB_EMPLOYEE_POS'], 'BRANCH'),
      mk('INCUBATOR_MANAGER', 'مدير حاضنة', 'Incubator Manager', 'SYSTEM', ['HUB', 'ACADEMY'], ['users.view', 'systems.view', 'workflow.execute'], ['INCUBATOR_MANAGER_POS'], 'INCUBATOR'),
      mk('PLATFORM_MANAGER', 'مدير منصة', 'Platform Manager', 'SYSTEM', ['HUB', 'POSHA'], ['systems.configure', 'users.assign', 'customer_requests.approve'], ['PLATFORM_MANAGER_POS'], 'PLATFORM'),
      mk('SYSTEM_OWNER', 'مالك نظام', 'System Owner', 'SYSTEM', ['ERP', 'CRM', 'LMS', 'LAW'], ['systems.manage', 'roles.assign', 'audit.view'], ['SYSTEM_OWNER_POS'], 'SYSTEM'),
      mk('SYSTEM_MANAGER', 'مدير نظام', 'System Manager', 'SYSTEM', ['ERP', 'CRM', 'LMS'], ['systems.configure', 'users.view', 'workflow.execute'], ['SYSTEM_OWNER_POS'], 'SYSTEM'),
      mk('PLATFORM_CUSTOMER', 'عميل منصة', 'Platform Customer', 'SYSTEM', ['POSHA', 'ACADEMY', 'LMS'], ['customer_requests.view', 'customer_requests.create', 'customer_requests.submit'], ['CUSTOMER_POS'], 'PLATFORM'),
    ];
  };

  const seedAuthorities = () => [
    {
      id: uid('auth'),
      code: 'FIN_APPROVE_25K',
      nameAr: 'اعتماد مالي حتى 25,000',
      nameEn: 'Financial Approve ≤ 25,000',
      type: 'FINANCIAL',
      eligibleRoles: ['BRANCH_MANAGER', 'HUB_ADMIN', 'SUPER_ADMIN'],
      scopeTypes: ['BRANCH', 'HUB-GLOBAL', 'GLOBAL'],
      limits: { currency: 'SAR', maximum: 25000 },
      conditions: ['active_grant', 'scope_match'],
      approvalRequirement: 'NONE',
      status: 'active',
    },
    {
      id: uid('auth'),
      code: 'FIN_APPROVE_UNLIMITED',
      nameAr: 'اعتماد مالي غير محدود',
      nameEn: 'Unlimited Financial Approve',
      type: 'FINANCIAL',
      eligibleRoles: ['SUPER_ADMIN'],
      scopeTypes: ['GLOBAL'],
      limits: { currency: 'SAR', maximum: null },
      conditions: ['active_grant'],
      approvalRequirement: 'NONE',
      status: 'active',
    },
    {
      id: uid('auth'),
      code: 'ACCESS_GRANT_AUTHORITY',
      nameAr: 'سلطة منح الوصول',
      nameEn: 'Access Grant Authority',
      type: 'GOVERNANCE',
      eligibleRoles: ['SUPER_ADMIN', 'HUB_ADMIN'],
      scopeTypes: ['GLOBAL', 'HUB-GLOBAL'],
      limits: {},
      conditions: ['active_grant'],
      approvalRequirement: 'SECURITY',
      status: 'active',
    },
  ];

  const seedScopes = () => [
    { id: uid('scp'), code: 'GLOBAL', type: 'GLOBAL', nameAr: 'نطاق عالمي', nameEn: 'Global', entityRef: 'EMPIRE', status: 'active' },
    { id: uid('scp'), code: 'HUB-GLOBAL', type: 'HUB-GLOBAL', nameAr: 'نطاق هوب المركزي', nameEn: 'Hub Global', entityRef: 'HUB', status: 'active' },
    { id: uid('scp'), code: 'BRANCH-ALEX', type: 'BRANCH', nameAr: 'فرع الإسكندرية', nameEn: 'Alexandria Branch', entityRef: 'BRANCH:ALEX', status: 'active' },
    { id: uid('scp'), code: 'BRANCH-CAIRO', type: 'BRANCH', nameAr: 'فرع القاهرة', nameEn: 'Cairo Branch', entityRef: 'BRANCH:CAIRO', status: 'active' },
    { id: uid('scp'), code: 'SYS-ERP', type: 'SYSTEM', nameAr: 'نظام ERP', nameEn: 'ERP System', entityRef: 'ERP', status: 'active' },
    { id: uid('scp'), code: 'SYS-CRM', type: 'SYSTEM', nameAr: 'نظام CRM', nameEn: 'CRM System', entityRef: 'CRM', status: 'active' },
    { id: uid('scp'), code: 'PLATFORM-POSHA', type: 'PLATFORM', nameAr: 'منصة بوشا', nameEn: 'POSHA Platform', entityRef: 'POSHA', status: 'active' },
  ];

  const seedSodRules = () => [
    {
      id: uid('sod'),
      code: 'SOD-CREATE-APPROVE-PAY',
      nameAr: 'فصل إنشاء الاعتماد والدفع',
      conflictingPermissions: ['customer_requests.create', 'customer_requests.approve'],
      sameTransaction: true,
      risk: 'high',
      action: 'BLOCK',
      status: 'active',
    },
    {
      id: uid('sod'),
      code: 'SOD-GRANT-SELF',
      nameAr: 'منع منح صلاحية ذاتية بدون اعتماد',
      conflictingPermissions: ['roles.assign', 'access_governance.manage'],
      sameTransaction: false,
      risk: 'critical',
      action: 'REQUIRE_APPROVAL',
      status: 'active',
    },
  ];

  const stampPos = (list) =>
    list.map((p) => ({
      ...p,
      id: p.id || uid('pos'),
      version: p.version || 1,
      createdAt: p.createdAt || nowIso(),
      updatedAt: p.updatedAt || nowIso(),
    }));

  const emptyBag = () => ({
    schemaVersion: SCHEMA,
    migratedAt: null,
    componentStatus: { ...COMPONENT_STATUS },
    systems: listSystems(),
    positions: stampPos(seedPositions()),
    roles: seedRoles(),
    permissions: seedPermissions(),
    authorities: seedAuthorities(),
    scopes: seedScopes(),
    identities: [],
    grants: [],
    requests: [],
    delegations: [],
    temporaryAccess: [],
    reviews: [],
    suspensions: [],
    revocations: [],
    sodRules: seedSodRules(),
    sodConflicts: [],
    audit: [],
    agents: [],
    settings: { helpDismissed: false },
    migrationReport: null,
  });

  const pushAudit = (state, evt) => {
    if (!Array.isArray(state.audit)) state.audit = [];
    state.audit.unshift({
      id: uid('evt'),
      timestamp: nowIso(),
      ...evt,
    });
    if (state.audit.length > 800) state.audit.length = 800;
  };

  const readLegacyRolesHub = () => {
    try {
      const hs = window.HubStore?.rolesBag?.();
      if (hs) return hs;
    } catch (_) {}
    try {
      const raw = localStorage.getItem('hubStoreV1') || localStorage.getItem('naioshHubStore');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.rolesHub || null;
    } catch (_) {
      return null;
    }
  };

  const migrateFromLegacy = (state, legacy) => {
    const report = {
      at: nowIso(),
      legacyRoles: [],
      legacyAssignments: [],
      mappedRoles: [],
      mappedUsers: [],
      unmapped: [],
      preservedAudit: 0,
    };
    if (!legacy) {
      state.migrationReport = report;
      return state;
    }

    (legacy.roles || []).forEach((lr) => {
      report.legacyRoles.push({ code: lr.code, nameAr: lr.nameAr, permissions: lr.permissions, systems: lr.systems });
      const map = LEGACY_ROLE_MAP[lr.code];
      if (!map) {
        report.unmapped.push(lr.code);
        const code = String(lr.code || '').toUpperCase();
        if (!state.roles.some((r) => r.code === code || r.legacyCodes?.includes(lr.code))) {
          state.roles.push({
            id: uid('role'),
            code: code || uid('LEGACY'),
            nameAr: lr.nameAr || lr.code,
            nameEn: lr.code,
            level: 'HUB',
            applicableSystems: lr.systems || ['HUB'],
            defaultScopeType: 'HUB-GLOBAL',
            permissions: (lr.permissions || []).map((p) => {
              if (p === 'read') return 'users.view';
              if (p === 'write') return 'users.edit';
              if (p === 'admin') return 'access_governance.manage';
              if (p === 'audit') return 'audit.view';
              return `legacy.${p}`;
            }),
            authorities: [],
            eligiblePositions: [],
            status: lr.status || 'active',
            version: 1,
            source: 'Legacy Migration',
            legacyCodes: [lr.code],
            createdAt: lr.createdAt || nowIso(),
            updatedAt: nowIso(),
          });
          report.mappedRoles.push({ from: lr.code, to: code, mode: 'created' });
        }
        return;
      }
      const role = state.roles.find((r) => r.code === map.roleCode);
      if (role) {
        role.legacyCodes = Array.from(new Set([...(role.legacyCodes || []), lr.code]));
        report.mappedRoles.push({ from: lr.code, to: map.roleCode, mode: 'alias' });
      }
    });

    (legacy.assignments || []).forEach((a) => {
      report.legacyAssignments.push(a);
      const map = LEGACY_ROLE_MAP[a.roleCode] || { roleCode: String(a.roleCode || '').toUpperCase(), positionCode: null, level: 'HUB' };
      const identityId = uid('id');
      const naioshId = `NAI-${String(a.userEmail || a.userName || 'USER')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 8)
        .toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      const identity = {
        id: identityId,
        naioshId,
        name: a.userName || a.userEmail,
        email: a.userEmail,
        userType: map.level === 'SYSTEM' && map.roleCode === 'PLATFORM_CUSTOMER' ? 'CUSTOMER' : 'STAFF',
        verificationStatus: 'VERIFIED',
        status: 'active',
        positions: map.positionCode ? [map.positionCode] : [],
        createdAt: a.at || nowIso(),
        updatedAt: nowIso(),
        legacySource: a.source || 'Legacy',
      };
      state.identities.push(identity);

      const role = state.roles.find((r) => r.code === map.roleCode || (r.legacyCodes || []).includes(a.roleCode));
      const systems = role?.applicableSystems || ['HUB'];
      systems.forEach((sys) => {
        const scopeCode = sys === 'HUB' ? 'HUB-GLOBAL' : sys === 'ERP' ? 'SYS-ERP' : sys === 'CRM' ? 'SYS-CRM' : sys === 'POSHA' ? 'PLATFORM-POSHA' : 'HUB-GLOBAL';
        const grant = {
          id: uid('grant'),
          grantId: `GRANT-${Date.now().toString(36).toUpperCase()}`,
          identityId,
          naioshId,
          positionCode: map.positionCode || null,
          roleCode: role?.code || map.roleCode,
          system: sys,
          scopeCode,
          permissions: role?.permissions || [],
          authorityCodes: role?.code === 'BRANCH_MANAGER' ? ['FIN_APPROVE_25K'] : role?.code === 'SUPER_ADMIN' ? ['FIN_APPROVE_UNLIMITED', 'ACCESS_GRANT_AUTHORITY'] : role?.code === 'HUB_ADMIN' ? ['ACCESS_GRANT_AUTHORITY', 'FIN_APPROVE_25K'] : [],
          purpose: 'Migrated from legacy rolesHub',
          grantedBy: a.by || 'migration',
          approvedBy: a.by || 'migration',
          startDate: a.at || nowIso(),
          expiryDate: null,
          reviewDate: null,
          riskLevel: role?.level === 'EMPIRE' ? 'critical' : 'medium',
          status: 'ACTIVE',
          evidence: { legacyAssignmentId: a.id, legacyRoleCode: a.roleCode },
          governanceLevel: map.level,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        state.grants.push(grant);
      });
      report.mappedUsers.push({ email: a.userEmail, naioshId, role: map.roleCode });
    });

    (legacy.auditLog || []).forEach((row) => {
      pushAudit(state, {
        actor: row.by || 'legacy',
        targetUser: null,
        action: row.action || 'LEGACY_AUDIT',
        oldValue: null,
        newValue: row.detail || null,
        reason: 'Imported from rolesHub audit',
        system: 'HUB',
        requestId: null,
        grantId: null,
      });
      report.preservedAudit += 1;
    });

    state.migrationReport = report;
    state.migratedAt = nowIso();
    pushAudit(state, {
      actor: 'system',
      action: 'MIGRATION_COMPLETED',
      newValue: report,
      reason: 'Legacy rolesHub → Access Governance 360',
      system: 'HUB',
    });
    return state;
  };

  const ensureDemoIfEmpty = (state) => {
    if (state.identities.length) return state;
    const id = uid('id');
    const naioshId = 'NAI-USER-0025';
    state.identities.push({
      id,
      naioshId,
      name: 'مدير فرع الإسكندرية',
      email: 'branch.alex@naiosh.example',
      userType: 'STAFF',
      verificationStatus: 'VERIFIED',
      status: 'active',
      positions: ['BRANCH_MANAGER_POS'],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    state.grants.push({
      id: uid('grant'),
      grantId: 'GRANT-DEMO-ALEX',
      identityId: id,
      naioshId,
      positionCode: 'BRANCH_MANAGER_POS',
      roleCode: 'BRANCH_MANAGER',
      system: 'ERP',
      scopeCode: 'BRANCH-ALEX',
      permissions: ['customer_requests.view', 'customer_requests.approve', 'finance_approvals.approve', 'users.view', 'workflow.execute'],
      authorityCodes: ['FIN_APPROVE_25K'],
      purpose: 'تشغيل فرع الإسكندرية',
      grantedBy: 'SUPER_ADMIN',
      approvedBy: 'SUPER_ADMIN',
      startDate: nowIso(),
      expiryDate: null,
      reviewDate: null,
      riskLevel: 'high',
      status: 'ACTIVE',
      evidence: { seed: true },
      governanceLevel: 'SYSTEM',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    state.grants.push({
      id: uid('grant'),
      grantId: 'GRANT-DEMO-HUB-VIEW',
      identityId: id,
      naioshId,
      positionCode: 'BRANCH_MANAGER_POS',
      roleCode: 'REPORT_VIEWER',
      system: 'HUB',
      scopeCode: 'HUB-GLOBAL',
      permissions: ['users.view', 'audit.view', 'customer_requests.view'],
      authorityCodes: [],
      purpose: 'عرض تقارير هوب فقط',
      grantedBy: 'HUB_ADMIN',
      approvedBy: 'HUB_ADMIN',
      startDate: nowIso(),
      expiryDate: null,
      reviewDate: null,
      riskLevel: 'low',
      status: 'ACTIVE',
      evidence: { seed: true },
      governanceLevel: 'HUB',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    return state;
  };

  const loadRaw = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  };

  const save = (state) => {
    state.systems = listSystems();
    state.updatedAt = nowIso();
    localStorage.setItem(KEY, JSON.stringify(state));
    try {
      const bag = window.HubStore?.rolesBag?.();
      if (bag) {
        bag.accessGov = { schemaVersion: SCHEMA, syncedAt: nowIso() };
        bag.schemaVersion = 2;
        window.HubStore?.save?.();
      }
    } catch (_) {}
    return state;
  };

  const get = () => {
    let state = loadRaw();
    if (!state || state.schemaVersion !== SCHEMA) {
      state = emptyBag();
      const legacy = readLegacyRolesHub();
      migrateFromLegacy(state, legacy);
      ensureDemoIfEmpty(state);
      save(state);
    } else {
      state.systems = listSystems();
      state.componentStatus = { ...COMPONENT_STATUS, ...(state.componentStatus || {}) };
      if (!Array.isArray(state.permissions) || !state.permissions.length) state.permissions = seedPermissions();
      if (!Array.isArray(state.sodRules) || !state.sodRules.length) state.sodRules = seedSodRules();
      // refresh known SoD definition (safe patch)
      const sod = (state.sodRules || []).find((r) => r.code === 'SOD-CREATE-APPROVE-PAY');
      if (sod && (sod.conflictingPermissions || []).includes('finance_approvals.approve')) {
        sod.conflictingPermissions = ['customer_requests.create', 'customer_requests.approve'];
        save(state);
      }
    }
    return state;
  };

  const update = (mutator, actor = 'مشغّل هوب') => {
    const state = get();
    const result = mutator(state, { uid, nowIso, pushAudit, actor }) || state;
    save(result);
    return result;
  };

  window.HubAccessGovStore = {
    KEY,
    SCHEMA,
    ACTION_SET,
    LEGACY_ROLE_MAP,
    COMPONENT_STATUS,
    get,
    save,
    update,
    pushAudit,
    uid,
    nowIso,
    listSystems,
    emptyBag,
    migrateFromLegacy,
  };
})();
