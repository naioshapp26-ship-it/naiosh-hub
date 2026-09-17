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
    const fromOps = window.HubOpsCatalog?.listSystems?.({ includeUmbrella: true }) || window.HubOpsCatalog?.get?.()?.systems;
    const normalize = (s) => ({
      code: s.code || s.id,
      nameAr: s.nameAr || s.name || s.shortName || s.code,
      nameEn: s.nameEn || s.shortName || s.code,
      level: s.isUmbrella || s.code === 'HUB' || s.level === 'HUB' ? 'HUB' : 'SYSTEM',
      status: s.status || 'active',
      classification: s.classification || (s.parentCode ? 'sub' : s.isUmbrella ? 'umbrella' : 'independent'),
      parentCode: s.parentCode || s.parentId || null,
      description: s.description || '',
      icon: s.icon || 'fa-cube',
      url: s.url || s.link || '',
      createdAt: s.createdAt || null,
      updatedAt: s.updatedAt || null,
      source: s.source || 'catalog',
    });
    if (Array.isArray(fromOps) && fromOps.length) {
      return fromOps.filter((s) => s && s.status !== 'archived').map(normalize);
    }
    return [
      { code: 'HUB', nameAr: 'نايوش هوب', nameEn: 'HUB', level: 'HUB', status: 'active', classification: 'umbrella', parentCode: null },
      { code: 'ERP', nameAr: 'نايوش إي آر بي', nameEn: 'ERP', level: 'SYSTEM', status: 'active', classification: 'independent', parentCode: null },
      { code: 'CRM', nameAr: 'إدارة العملاء', nameEn: 'CRM', level: 'SYSTEM', status: 'active', classification: 'independent', parentCode: null },
      { code: 'LMS', nameAr: 'نظام التعلم', nameEn: 'LMS', level: 'SYSTEM', status: 'active', classification: 'independent', parentCode: null },
      { code: 'LAW', nameAr: 'نايوش لو', nameEn: 'LAW', level: 'SYSTEM', status: 'active', classification: 'independent', parentCode: null },
      { code: 'FIT', nameAr: 'نايوش فيت', nameEn: 'FIT', level: 'SYSTEM', status: 'active', classification: 'independent', parentCode: null },
      { code: 'ACADEMY', nameAr: 'أكاديمية نايوش', nameEn: 'ACADEMY', level: 'SYSTEM', status: 'active', classification: 'independent', parentCode: null },
      { code: 'POSHA', nameAr: 'بوشا', nameEn: 'POSHA', level: 'SYSTEM', status: 'active', classification: 'independent', parentCode: null },
      { code: 'NAIS', nameAr: 'نايس', nameEn: 'NAIS', level: 'SYSTEM', status: 'active', classification: 'independent', parentCode: null },
      { code: 'SMARTX', nameAr: 'سمارتكس', nameEn: 'SMARTX', level: 'SYSTEM', status: 'active', classification: 'independent', parentCode: null },
      { code: 'SALES', nameAr: 'المبيعات', nameEn: 'SALES', level: 'SYSTEM', status: 'active', classification: 'sub', parentCode: 'ERP' },
      { code: 'MARKETING', nameAr: 'التسويق', nameEn: 'MARKETING', level: 'SYSTEM', status: 'active', classification: 'sub', parentCode: 'ERP' },
      { code: 'EVENTS', nameAr: 'استوديو الفعاليات', nameEn: 'EVENTS', level: 'SYSTEM', status: 'active', classification: 'independent', parentCode: null },
      { code: 'ADS', nameAr: 'استوديو الإعلانات', nameEn: 'ADS', level: 'SYSTEM', status: 'active', classification: 'independent', parentCode: null },
      { code: 'STORE', nameAr: 'المتجر', nameEn: 'STORE', level: 'SYSTEM', status: 'active', classification: 'independent', parentCode: null },
      { code: 'CONTENT', nameAr: 'المحتوى والمدونة', nameEn: 'CONTENT', level: 'SYSTEM', status: 'active', classification: 'independent', parentCode: null },
    ].map((s) => ({ ...s, description: '', icon: 'fa-cube', url: '', createdAt: null, updatedAt: null, source: 'seed' }));
  };

  const mergeSystemsState = (state) => {
    const base = listSystems();
    const managed = Array.isArray(state.managedSystems) ? state.managedSystems : [];
    const map = new Map();
    base.forEach((s) => map.set(s.code, { ...s }));
    managed.forEach((s) => {
      if (!s?.code) return;
      map.set(s.code, { ...(map.get(s.code) || {}), ...s, source: 'managed' });
    });
    return [...map.values()];
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
      ['articles', 'المقالات'],
      ['ads', 'الإعلانات'],
      ['events', 'الفعاليات'],
      ['products', 'المنتجات'],
      ['stores', 'المتجر'],
      ['content', 'المحتوى'],
      ['reports', 'التقارير'],
      ['notifications', 'الإشعارات'],
      ['search', 'محرك البحث'],
      ['sales', 'المبيعات'],
      ['marketing', 'التسويق'],
      ['settings', 'الإعدادات'],
    ];
    const actionsByResource = {
      access_governance: ['VIEW', 'MANAGE', 'CONFIGURE', 'AUDIT'],
      roles: ['VIEW', 'CREATE', 'EDIT', 'ASSIGN', 'SUSPEND', 'AUDIT', 'MANAGE', 'DELETE'],
      positions: ['VIEW', 'CREATE', 'EDIT', 'ASSIGN', 'AUDIT', 'MANAGE'],
      users: ['VIEW', 'CREATE', 'EDIT', 'SUSPEND', 'ASSIGN', 'AUDIT', 'MANAGE', 'DELETE'],
      customer_requests: ['VIEW', 'CREATE', 'EDIT', 'SUBMIT', 'APPROVE', 'REJECT', 'ASSIGN', 'EXPORT', 'MANAGE'],
      policies: ['VIEW', 'CREATE', 'EDIT', 'PUBLISH', 'APPROVE', 'AUDIT', 'DELETE'],
      finance_approvals: ['VIEW', 'APPROVE', 'REJECT', 'AUDIT'],
      systems: ['VIEW', 'CONFIGURE', 'MANAGE', 'EXECUTE', 'CREATE', 'EDIT', 'SUSPEND', 'DELETE'],
      audit: ['VIEW', 'EXPORT', 'AUDIT'],
      delegations: ['VIEW', 'CREATE', 'EDIT', 'SUSPEND', 'APPROVE'],
      workflow: ['VIEW', 'EXECUTE', 'ASSIGN', 'APPROVE'],
      articles: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'PUBLISH', 'APPROVE', 'REJECT', 'EXPORT'],
      ads: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'PUBLISH', 'APPROVE', 'REJECT', 'MANAGE'],
      events: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'PUBLISH', 'APPROVE', 'MANAGE'],
      products: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'PUBLISH', 'MANAGE', 'EXPORT'],
      stores: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUSPEND', 'MANAGE', 'CONFIGURE'],
      content: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'PUBLISH', 'APPROVE', 'MANAGE'],
      reports: ['VIEW', 'CREATE', 'EXPORT', 'AUDIT'],
      notifications: ['VIEW', 'CREATE', 'EDIT', 'MANAGE', 'CONFIGURE'],
      search: ['VIEW', 'CONFIGURE', 'MANAGE', 'AUDIT'],
      sales: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT', 'MANAGE'],
      marketing: ['VIEW', 'CREATE', 'EDIT', 'PUBLISH', 'MANAGE'],
      settings: ['VIEW', 'CONFIGURE', 'MANAGE', 'AUDIT'],
    };
    const actionAr = {
      VIEW: 'عرض',
      CREATE: 'إضافة',
      EDIT: 'تعديل',
      DELETE: 'حذف',
      APPROVE: 'اعتماد',
      ASSIGN: 'تعيين',
      SUSPEND: 'إيقاف',
      MANAGE: 'إدارة',
      AUDIT: 'تدقيق',
      CONFIGURE: 'إعدادات',
      EXECUTE: 'تشغيل',
      EXPORT: 'تصدير',
      SUBMIT: 'إرسال',
      REJECT: 'رفض',
      PUBLISH: 'نشر',
    };
    const out = [];
    resources.forEach(([code, nameAr]) => {
      (actionsByResource[code] || ['VIEW']).forEach((action) => {
        out.push({
          id: `perm-${code}-${action}`.toLowerCase(),
          code: `${code}.${action.toLowerCase()}`,
          resource: code,
          action,
          nameAr: `${actionAr[action] || action} — ${nameAr}`,
          nameEn: `${code}.${action}`,
          systemHint: code === 'sales' || code === 'marketing' ? 'ERP' : null,
          status: 'active',
        });
      });
    });
    return out;
  };

  const seedPositions = () => [
    { code: 'EMP_SUPREME_LEADER', nameAr: 'القائد الأعلى', nameEn: 'Supreme Leader', orgLevel: 'EMPIRE', parentEntity: 'NAIOSHAI_EMPIRE', eligibleRoles: ['SUPER_ADMIN'], status: 'active' },
    { code: 'EMP_GOVERNOR', nameAr: 'حاكم إمبراطوري', nameEn: 'Empire Governor', orgLevel: 'EMPIRE', parentEntity: 'NAIOSHAI_EMPIRE', eligibleRoles: ['SUPER_ADMIN'], status: 'active' },
    { code: 'HQ_MAIN_POS', nameAr: 'المقر الرئيسي', nameEn: 'Headquarters', orgLevel: 'HQ', parentEntity: 'HQ', eligibleRoles: [], status: 'active' },
    { code: 'HQ_OFFICE_POS', nameAr: 'المكتب الرئيسي', nameEn: 'Main Office', orgLevel: 'HQ', parentEntity: 'HQ', eligibleRoles: ['HQ_ADMIN', 'HQ_EXECUTIVE_MANAGER'], status: 'active' },
    { code: 'HUB_ADMIN_POS', nameAr: 'مشرف هوب', nameEn: 'Hub Admin', orgLevel: 'HUB', parentEntity: 'NAIOSHAI_HUB_360', eligibleRoles: ['HUB_ADMIN', 'HUB_AUDITOR'], status: 'active' },
    { code: 'HUB_AUDITOR_POS', nameAr: 'مدقق هوب', nameEn: 'Hub Auditor', orgLevel: 'HUB', parentEntity: 'NAIOSHAI_HUB_360', eligibleRoles: ['HUB_AUDITOR'], status: 'active' },
    { code: 'HUB_EMPLOYEE_POS', nameAr: 'موظف هوب', nameEn: 'Hub Employee', orgLevel: 'HUB', parentEntity: 'NAIOSHAI_HUB_360', eligibleRoles: ['HUB_EMPLOYEE'], status: 'active' },
    { code: 'BRANCH_MANAGER_POS', nameAr: 'الفرع', nameEn: 'Branch', orgLevel: 'BRANCH', parentEntity: 'BRANCH', eligibleRoles: ['BRANCH_MANAGER', 'REPORT_VIEWER', 'ASSISTANT_BRANCH_MANAGER', 'BRANCH_ADMIN'], status: 'active' },
    { code: 'INCUBATOR_MANAGER_POS', nameAr: 'الحاضنة', nameEn: 'Incubator', orgLevel: 'INCUBATOR', parentEntity: 'INCUBATOR', eligibleRoles: ['INCUBATOR_MANAGER', 'ASSISTANT_INCUBATOR_MANAGER', 'INCUBATOR_ADMIN'], status: 'active' },
    { code: 'PLATFORM_MANAGER_POS', nameAr: 'المنصة', nameEn: 'Platform', orgLevel: 'PLATFORM', parentEntity: 'PLATFORM', eligibleRoles: ['PLATFORM_MANAGER', 'ASSISTANT_PLATFORM_MANAGER', 'PLATFORM_ADMIN'], status: 'active' },
    { code: 'OFFICE_POS', nameAr: 'المكتب', nameEn: 'Office', orgLevel: 'OFFICE', parentEntity: 'OFFICE', eligibleRoles: ['OFFICE_EXECUTIVE', 'OFFICE_ADMIN'], status: 'active' },
    { code: 'INDEPENDENT_POS', nameAr: 'المستقل', nameEn: 'Independent', orgLevel: 'INDEPENDENT', parentEntity: 'INDEPENDENT', eligibleRoles: ['FREELANCER_MANAGER', 'FREELANCER_TRAINER'], status: 'active' },
    { code: 'SYSTEM_OWNER_POS', nameAr: 'مالك نظام', nameEn: 'System Owner', orgLevel: 'SYSTEM', parentEntity: 'SYSTEM', eligibleRoles: ['SYSTEM_OWNER', 'SYSTEM_MANAGER'], status: 'active' },
    { code: 'SUPERVISOR_POS', nameAr: 'المشرف', nameEn: 'Supervisor', orgLevel: 'SUPERVISOR', parentEntity: 'HUB', eligibleRoles: ['HUB_ADMIN', 'SYSTEM_MANAGER'], status: 'active' },
    { code: 'USER_POS', nameAr: 'المستخدم', nameEn: 'User', orgLevel: 'USER', parentEntity: 'HUB', eligibleRoles: ['HUB_EMPLOYEE', 'EDITOR'], status: 'active' },
    { code: 'VISITOR_POS', nameAr: 'الزائر', nameEn: 'Visitor', orgLevel: 'VISITOR', parentEntity: 'PLATFORM', eligibleRoles: ['PLATFORM_CUSTOMER'], status: 'active' },
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
    const allSys = ['HUB', 'ERP', 'CRM', 'LMS', 'LAW', 'FIT', 'ACADEMY', 'POSHA', 'NAIS', 'SMARTX', 'SALES', 'MARKETING', 'EVENTS', 'ADS', 'STORE', 'CONTENT'];
    const opsView = ['users.view', 'customer_requests.view', 'systems.view', 'workflow.execute'];
    const contentBase = ['articles.view', 'articles.create', 'articles.edit', 'content.view', 'content.create'];
    const core = [
      mk('SUPER_ADMIN', 'المدير الأعلى', 'Super Admin', 'EMPIRE', allSys, ['access_governance.manage', 'roles.manage', 'users.manage', 'systems.manage', 'audit.view', 'finance_approvals.approve', 'policies.publish', 'roles.assign', 'users.assign', 'settings.manage'], ['EMP_SUPREME_LEADER', 'EMP_GOVERNOR'], 'GLOBAL'),
      mk('HUB_ADMIN', 'مشرف', 'Hub Admin', 'HUB', ['HUB'], ['access_governance.view', 'roles.edit', 'users.assign', 'systems.configure', 'audit.view', 'delegations.create', 'customer_requests.view', 'customer_requests.approve'], ['HUB_ADMIN_POS', 'SUPERVISOR_POS'], 'HUB-GLOBAL'),
      mk('HUB_AUDITOR', 'مراجع', 'Hub Auditor', 'HUB', ['HUB', 'ERP'], ['audit.view', 'audit.export', 'roles.view', 'users.view', 'access_governance.view', 'customer_requests.view'], ['HUB_AUDITOR_POS'], 'HUB-GLOBAL'),
      mk('HUB_EMPLOYEE', 'موظف تشغيل', 'Hub Employee', 'HUB', ['HUB'], ['users.view', 'customer_requests.view', 'customer_requests.create'], ['HUB_EMPLOYEE_POS', 'USER_POS'], 'DEPARTMENT'),
      mk('BRANCH_MANAGER', 'مدير فرع', 'Branch Manager', 'SYSTEM', ['ERP', 'CRM', 'SALES'], ['customer_requests.view', 'customer_requests.approve', 'finance_approvals.approve', 'users.view', 'workflow.execute', 'sales.view', 'sales.approve'], ['BRANCH_MANAGER_POS'], 'BRANCH'),
      mk('REPORT_VIEWER', 'عارض تقارير', 'Report Viewer', 'SYSTEM', ['HUB', 'ERP'], ['users.view', 'audit.view', 'customer_requests.view', 'reports.view', 'reports.export'], ['BRANCH_MANAGER_POS', 'HUB_EMPLOYEE_POS'], 'BRANCH'),
      mk('INCUBATOR_MANAGER', 'مدير حاضنة', 'Incubator Manager', 'SYSTEM', ['HUB', 'ACADEMY'], ['users.view', 'systems.view', 'workflow.execute'], ['INCUBATOR_MANAGER_POS'], 'INCUBATOR'),
      mk('PLATFORM_MANAGER', 'مدير منصة', 'Platform Manager', 'SYSTEM', ['HUB', 'POSHA'], ['systems.configure', 'users.assign', 'customer_requests.approve'], ['PLATFORM_MANAGER_POS'], 'PLATFORM'),
      mk('SYSTEM_OWNER', 'مالك نظام', 'System Owner', 'SYSTEM', ['ERP', 'CRM', 'LMS', 'LAW', 'SALES', 'EVENTS', 'ADS', 'STORE', 'CONTENT'], ['systems.manage', 'roles.assign', 'audit.view'], ['SYSTEM_OWNER_POS'], 'SYSTEM'),
      mk('SYSTEM_MANAGER', 'مدير النظام', 'System Manager', 'SYSTEM', ['ERP', 'CRM', 'LMS', 'POSHA', 'SALES', 'MARKETING', 'EVENTS', 'ADS', 'STORE', 'CONTENT'], ['systems.configure', 'users.view', 'workflow.execute', 'customer_requests.view', 'customer_requests.edit', 'customer_requests.approve', 'customer_requests.reject'], ['SYSTEM_OWNER_POS'], 'SYSTEM'),
      mk('PLATFORM_CUSTOMER', 'عميل منصة', 'Platform Customer', 'SYSTEM', ['POSHA', 'ACADEMY', 'LMS'], ['customer_requests.view', 'customer_requests.create', 'customer_requests.submit'], ['CUSTOMER_POS', 'VISITOR_POS'], 'PLATFORM'),
    ];
    const extended = [
      ['IT_MANAGER', 'مدير برمجيات وتكنولوجيا المعلومات', 'HQ', ['HUB', 'SMARTX', 'NAIS'], ['systems.manage', 'systems.configure', 'users.manage', 'audit.view', 'search.manage'], ['HQ_OFFICE_POS']],
      ['HQ_EXECUTIVE_MANAGER', 'مدير تنفيذي - المكتب الرئيسي', 'HQ', ['HUB', 'ERP'], ['users.view', 'users.assign', 'systems.view', 'reports.view', 'workflow.approve'], ['HQ_OFFICE_POS', 'HQ_MAIN_POS']],
      ['HQ_FINANCIAL_MANAGER', 'مدير مالي - المكتب الرئيسي', 'HQ', ['ERP', 'HUB'], ['finance_approvals.view', 'finance_approvals.approve', 'reports.view', 'reports.export', 'audit.view'], ['HQ_OFFICE_POS']],
      ['HQ_MARKETING_MANAGER', 'مدير تسويق - المكتب الرئيسي', 'HQ', ['MARKETING', 'ADS', 'CONTENT', 'HUB'], ['marketing.view', 'marketing.manage', 'ads.manage', 'ads.publish', 'content.publish'], ['HQ_OFFICE_POS']],
      ['HQ_PROCUREMENT_MANAGER', 'مدير مشتريات - المكتب الرئيسي', 'HQ', ['ERP'], ['systems.view', 'workflow.execute', 'reports.view'], ['HQ_OFFICE_POS']],
      ['HQ_PR_MANAGER', 'مدير علاقات عامة - المكتب الرئيسي', 'HQ', ['CONTENT', 'ADS', 'HUB'], ['content.view', 'content.publish', 'ads.view', 'notifications.manage'], ['HQ_OFFICE_POS']],
      ['LEGAL_MANAGER', 'مدير القانونية والاستشارات', 'HQ', ['LAW', 'HUB'], ['policies.view', 'policies.approve', 'policies.publish', 'audit.view'], ['HQ_OFFICE_POS']],
      ['CONTENT_MANAGER', 'مدير تحرير محتوى ومقالات', 'HQ', ['CONTENT', 'ADS', 'EVENTS'], [...contentBase, 'articles.publish', 'articles.approve', 'content.manage'], ['HQ_OFFICE_POS', 'USER_POS']],
      ['INITIATIVES_MANAGER', 'مدير المبادرات', 'HQ', ['HUB', 'ACADEMY'], opsView.concat(['events.view', 'events.manage']), ['HQ_OFFICE_POS']],
      ['FREELANCER_MANAGER', 'مدير فريلانسر', 'HQ', ['HUB'], opsView.concat(['users.assign']), ['INDEPENDENT_POS']],
      ['EXECUTIVE_DESIGNER', 'إداري تنفيذي مصمم', 'HQ', ['CONTENT', 'ADS'], ['content.view', 'content.create', 'content.edit', 'ads.view', 'ads.create'], ['HQ_OFFICE_POS']],
      ['EXECUTIVE_MARKETER', 'إداري تنفيذي مسوق', 'HQ', ['MARKETING', 'ADS'], ['marketing.view', 'marketing.create', 'marketing.edit', 'ads.create', 'ads.publish'], ['HQ_OFFICE_POS']],
      ['EXECUTIVE_SALES', 'إداري تنفيذي مبيعات', 'HQ', ['SALES', 'CRM', 'STORE'], ['sales.view', 'sales.create', 'sales.edit', 'customer_requests.view', 'products.view'], ['HQ_OFFICE_POS']],
      ['EXECUTIVE_CALLCENTER', 'إداري تنفيذي كول سنتر', 'HQ', ['CRM', 'HUB'], ['customer_requests.view', 'customer_requests.create', 'customer_requests.edit', 'notifications.view'], ['HQ_OFFICE_POS']],
      ['EXECUTIVE_SOCIAL_MEDIA', 'إداري تنفيذي منصات التواصل', 'HQ', ['MARKETING', 'ADS', 'CONTENT'], ['marketing.view', 'ads.create', 'ads.publish', 'content.create'], ['PLATFORM_MANAGER_POS']],
      ['EDITOR', 'محرر', 'HQ', ['CONTENT', 'ADS'], ['articles.view', 'articles.create', 'articles.edit', 'content.view', 'content.edit'], ['USER_POS']],
      ['HQ_ADMIN', 'مدير المكتب الرئيسي', 'HQ', ['HUB', 'ERP'], ['users.view', 'users.assign', 'systems.view', 'workflow.execute'], ['HQ_OFFICE_POS', 'HQ_MAIN_POS']],
      ['ASSISTANT_BRANCH_MANAGER', 'مساعد مدير فرع', 'BRANCH', ['ERP', 'CRM'], opsView.concat(['customer_requests.approve']), ['BRANCH_MANAGER_POS']],
      ['BRANCH_ADMIN', 'إداري فرع', 'BRANCH', ['ERP', 'CRM'], opsView, ['BRANCH_MANAGER_POS']],
      ['ASSISTANT_INCUBATOR_MANAGER', 'مساعد مدير حاضنة', 'INCUBATOR', ['HUB', 'ACADEMY'], opsView, ['INCUBATOR_MANAGER_POS']],
      ['INCUBATOR_ADMIN', 'إداري حاضنة', 'INCUBATOR', ['HUB', 'ACADEMY'], opsView, ['INCUBATOR_MANAGER_POS']],
      ['ASSISTANT_PLATFORM_MANAGER', 'مساعد مدير منصة', 'PLATFORM', ['HUB', 'POSHA'], opsView.concat(['systems.configure']), ['PLATFORM_MANAGER_POS']],
      ['PLATFORM_ADMIN', 'إداري منصة', 'PLATFORM', ['HUB', 'POSHA'], opsView, ['PLATFORM_MANAGER_POS']],
      ['OFFICE_EXECUTIVE', 'مسؤول تنفيذي مكاتب', 'OFFICE', ['HUB'], opsView, ['OFFICE_POS']],
      ['OFFICE_ADMIN', 'إداري تنفيذي مكاتب', 'OFFICE', ['HUB'], opsView, ['OFFICE_POS']],
      ['LOGISTICS_EMPLOYEE', 'موظف لوجستيات', 'ALL', ['ERP', 'STORE'], ['products.view', 'stores.view', 'workflow.execute'], ['USER_POS']],
      ['PERMANENT_TRAINER', 'مدرب دائم', 'ALL', ['LMS', 'ACADEMY'], ['systems.view', 'users.view', 'workflow.execute'], ['USER_POS']],
      ['FREELANCER_TRAINER', 'مدرب فريلانسر', 'ALL', ['LMS', 'ACADEMY'], ['systems.view', 'users.view'], ['INDEPENDENT_POS']],
      ['VOLUNTEER_TRAINER', 'مدرب متطوع', 'ALL', ['ACADEMY'], ['systems.view'], ['INDEPENDENT_POS']],
      ['INITIATIVES_VOLUNTEER', 'متطوع مبادرات', 'ALL', ['HUB'], ['systems.view', 'events.view'], ['INDEPENDENT_POS']],
    ].map(([code, nameAr, level, systems, perms, positions]) =>
      mk(code, nameAr, code, level, systems, perms, positions, level === 'HQ' ? 'HUB-GLOBAL' : level)
    );
    return [...core, ...extended];
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
    managedSystems: [],
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
    let employeeNo = evt.employeeNo || null;
    let targetName = evt.targetName || null;
    if ((!employeeNo || !targetName) && evt.targetUser) {
      const id = (state.identities || []).find(
        (i) => i.naioshId === evt.targetUser || i.id === evt.targetUser || i.employeeNo === evt.targetUser
      );
      if (id) {
        employeeNo = employeeNo || id.employeeNo || null;
        targetName = targetName || id.name || null;
      }
    }
    state.audit.unshift({
      id: uid('evt'),
      timestamp: nowIso(),
      ...evt,
      employeeNo,
      targetName,
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

  const ensureEmployeeNumbers = (state) => {
    const preferred = {
      'NAI-LEADER-001': 'EMP-0001',
      'NAI-USER-0025': 'EMP-0002',
      'NAI-MALIKA-001': 'EMP-0003',
    };
    const STAFF_ROLES = new Set([
      'SUPER_ADMIN',
      'HUB_ADMIN',
      'HUB_AUDITOR',
      'HUB_EMPLOYEE',
      'SYSTEM_MANAGER',
      'SYSTEM_OWNER',
      'BRANCH_MANAGER',
      'REPORT_VIEWER',
      'INCUBATOR_MANAGER',
      'PLATFORM_MANAGER',
    ]);
    const CUSTOMER_ROLES = new Set(['PLATFORM_CUSTOMER']);
    state.retiredEmployeeNos = state.retiredEmployeeNos || [];
    const used = new Set();
    (state.identities || []).forEach((i) => {
      if (i.employeeNo) used.add(String(i.employeeNo).toUpperCase());
    });
    state.retiredEmployeeNos.forEach((c) => used.add(String(c).toUpperCase()));
    const nextNo = () => {
      let max = 0;
      used.forEach((c) => {
        const m = String(c).match(/^EMP-(\d+)$/i);
        if (m) max = Math.max(max, Number(m[1]));
      });
      let n = `EMP-${String(max + 1).padStart(4, '0')}`;
      while (used.has(n)) {
        max += 1;
        n = `EMP-${String(max).padStart(4, '0')}`;
      }
      used.add(n);
      return n;
    };

    (state.identities || []).forEach((i) => {
      const grants = (state.grants || []).filter((g) => g.identityId === i.id && String(g.status).toUpperCase() === 'ACTIVE');
      const hasStaffGrant = grants.some((g) => STAFF_ROLES.has(g.roleCode));
      const onlyCustomer = grants.length > 0 && grants.every((g) => CUSTOMER_ROLES.has(g.roleCode)) && !hasStaffGrant;

      if (onlyCustomer || (i.userType === 'CUSTOMER' && !hasStaffGrant && !i.isEmployee)) {
        if (i.userType === 'STAFF' && i.employeeNo) return;
        if (i.isEmployee && i.employeeNo) return;
        i.userType = 'CUSTOMER';
        i.isEmployee = false;
        if (i.employeeNo) {
          if (!state.retiredEmployeeNos.includes(i.employeeNo)) state.retiredEmployeeNos.push(i.employeeNo);
          used.add(String(i.employeeNo).toUpperCase());
          i.employeeNo = null;
        }
        return;
      }

      if (i.userType === 'STAFF' || i.isEmployee || hasStaffGrant || preferred[i.naioshId]) {
        i.userType = 'STAFF';
        i.isEmployee = true;
        if (!i.employeeNo) {
          const pref = preferred[i.naioshId];
          if (pref && !used.has(pref)) {
            i.employeeNo = pref;
            used.add(pref);
          } else {
            i.employeeNo = nextNo();
          }
        }
      }
    });

    (state.grants || []).forEach((g) => {
      if (!STAFF_ROLES.has(g.roleCode)) return;
      const id = (state.identities || []).find((x) => x.id === g.identityId || x.naioshId === g.naioshId);
      if (id?.employeeNo) g.employeeNo = id.employeeNo;
    });
    return state;
  };

  const ensureDemoIfEmpty = (state) => {
    const ensureUser = (spec) => {
      const existing = (state.identities || []).find((i) => i.email === spec.email || i.naioshId === spec.naioshId);
      if (existing) {
        if (spec.employeeNo && !existing.employeeNo) existing.employeeNo = spec.employeeNo;
        existing.userType = 'STAFF';
        existing.isEmployee = true;
        return existing;
      }
      const row = {
        id: uid('id'),
        naioshId: spec.naioshId,
        employeeNo: spec.employeeNo || null,
        name: spec.name,
        email: spec.email,
        userType: 'STAFF',
        isEmployee: true,
        verificationStatus: 'VERIFIED',
        status: 'active',
        positions: spec.positions || [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      state.identities.push(row);
      return row;
    };
    ensureUser({
      naioshId: 'NAI-MALIKA-001',
      employeeNo: 'EMP-0003',
      name: 'المهندسة مليكة',
      email: 'malika@naiosh.com',
      positions: [],
    });
    ensureUser({
      naioshId: 'NAI-LEADER-001',
      employeeNo: 'EMP-0001',
      name: 'القائد الأعلى',
      email: 'leader@naiosh.com',
      positions: ['EMP_SUPREME_LEADER'],
    });
    if (state.identities.length > 2 && state.grants.length) {
      ensureEmployeeNumbers(state);
      return state;
    }
    if (state.identities.some((i) => i.naioshId === 'NAI-USER-0025')) {
      ensureEmployeeNumbers(state);
      return state;
    }
    const id = uid('id');
    const naioshId = 'NAI-USER-0025';
    state.identities.push({
      id,
      naioshId,
      employeeNo: 'EMP-0002',
      name: 'مدير فرع الإسكندرية',
      email: 'branch.alex@naiosh.example',
      userType: 'STAFF',
      isEmployee: true,
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
      employeeNo: 'EMP-0002',
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
      employeeNo: 'EMP-0002',
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
    ensureEmployeeNumbers(state);
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

  const ensureCatalogFresh = (state) => {
    if (!Array.isArray(state.managedSystems)) state.managedSystems = [];
    state.systems = mergeSystemsState(state);
    // دمج أدوار/صلاحيات/مناصب الكتالوج دون حذف ما أضافه المدير
    const seedR = seedRoles();
    const haveR = new Set((state.roles || []).map((r) => r.code));
    seedR.forEach((r) => {
      if (!haveR.has(r.code)) state.roles.push(r);
    });
    const seedP = seedPermissions();
    const haveP = new Set((state.permissions || []).map((p) => p.code));
    seedP.forEach((p) => {
      if (!haveP.has(p.code)) state.permissions.push(p);
    });
    const seedPos = stampPos(seedPositions());
    const havePos = new Set((state.positions || []).map((p) => p.code));
    seedPos.forEach((p) => {
      if (!havePos.has(p.code)) state.positions.push(p);
    });
  };

  const save = (state) => {
    if (!Array.isArray(state.managedSystems)) state.managedSystems = [];
    state.systems = mergeSystemsState(state);
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
      ensureEmployeeNumbers(state);
      ensureCatalogFresh(state);
      save(state);
    } else {
      state.componentStatus = { ...COMPONENT_STATUS, ...(state.componentStatus || {}) };
      if (!Array.isArray(state.permissions) || !state.permissions.length) state.permissions = seedPermissions();
      if (!Array.isArray(state.sodRules) || !state.sodRules.length) state.sodRules = seedSodRules();
      const sod = (state.sodRules || []).find((r) => r.code === 'SOD-CREATE-APPROVE-PAY');
      if (sod && (sod.conflictingPermissions || []).includes('finance_approvals.approve')) {
        sod.conflictingPermissions = ['customer_requests.create', 'customer_requests.approve'];
      }
      ensureDemoIfEmpty(state);
      ensureEmployeeNumbers(state);
      ensureCatalogFresh(state);
      save(state);
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
    mergeSystemsState,
    emptyBag,
    migrateFromLegacy,
  };
})();
