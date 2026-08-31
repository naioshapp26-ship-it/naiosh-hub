/**
 * Hub RBAC Admin Store — نسخة تشغيلية من إدارة الأدوار والصلاحيات في ERP
 * تُستخدم لمنح الأنظمة في هوب عبر الأدوار ومستويات الصلاحيات.
 */
const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'data', 'hub-rbac.json');

const PERMISSION_LEVELS = [
  { code: 'NONE', name_ar: 'بدون صلاحية', name_en: 'None', color: '#94a3b8', priority: 0 },
  { code: 'VIEW', name_ar: 'عرض فقط', name_en: 'View', color: '#6B7280', priority: 1 },
  { code: 'READ_WRITE', name_ar: 'قراءة وكتابة', name_en: 'Read/Write', color: '#3B82F6', priority: 2 },
  { code: 'EXECUTIVE', name_ar: 'تنفيذي', name_en: 'Executive', color: '#8B5CF6', priority: 3 },
  { code: 'APPROVE', name_ar: 'اعتماد', name_en: 'Approve', color: '#F59E0B', priority: 4 },
  { code: 'FULL_ACCESS', name_ar: 'صلاحية كاملة', name_en: 'Full Access', color: '#EF4444', priority: 5 },
];

const SYSTEMS = [
  { code: 'HUB', name_ar: 'نايوش هوب', name_en: 'Naiosh Hub', description: 'غرفة العمليات المركزية' },
  { code: 'ERP', name_ar: 'نايوش إي آر بي', name_en: 'Naiosh ERP', description: 'نظام إدارة الموارد' },
  { code: 'LAW', name_ar: 'نايوش لو', name_en: 'Naiosh Law', description: 'النظام القانوني' },
  { code: 'FIT', name_ar: 'نايوش فيت', name_en: 'Naiosh FIT', description: 'اللياقة والصحة' },
  { code: 'NAIS', name_ar: 'نايس', name_en: 'NAIS', description: 'نظام نايس' },
  { code: 'ACADEMY', name_ar: 'أكاديمية نايوش', name_en: 'Academy', description: 'التعلم والتدريب' },
  { code: 'SMARTX', name_ar: 'سمارتكس', name_en: 'SmartX', description: 'منصة سمارتكس' },
  { code: 'EDUSMARTX', name_ar: 'إيديو سمارتكس', name_en: 'EduSmartX', description: 'التعليم الذكي' },
  { code: 'EDUNAIOSH', name_ar: 'إيديو نايوش', name_en: 'EduNaiosh', description: 'تعليم نايوش' },
  { code: 'CRM', name_ar: 'إدارة العملاء', name_en: 'CRM', description: 'نظام العملاء' },
  { code: 'LMS', name_ar: 'نظام التعلم', name_en: 'LMS', description: 'إدارة التعلم' },
];

const ROLE_SEED = [
  { code: 'SUPER_ADMIN', title_ar: 'سوبر آدمن', hierarchy_level: 0, level: 'HQ' },
  { code: 'IT_MANAGER', title_ar: 'مدير برمجيات وتكنولوجيا المعلومات', hierarchy_level: 1, level: 'HQ' },
  { code: 'HQ_EXECUTIVE_MANAGER', title_ar: 'مدير تنفيذي - المكتب الرئيسي', hierarchy_level: 1, level: 'HQ' },
  { code: 'HQ_FINANCIAL_MANAGER', title_ar: 'مدير مالي - المكتب الرئيسي', hierarchy_level: 1, level: 'HQ' },
  { code: 'HQ_MARKETING_MANAGER', title_ar: 'مدير تسويق - المكتب الرئيسي', hierarchy_level: 1, level: 'HQ' },
  { code: 'HQ_PROCUREMENT_MANAGER', title_ar: 'مدير مشتريات - المكتب الرئيسي', hierarchy_level: 1, level: 'HQ' },
  { code: 'HQ_PR_MANAGER', title_ar: 'مدير علاقات عامة - المكتب الرئيسي', hierarchy_level: 1, level: 'HQ' },
  { code: 'LEGAL_MANAGER', title_ar: 'مدير القانونية والاستشارات', hierarchy_level: 1, level: 'HQ' },
  { code: 'CONTENT_MANAGER', title_ar: 'مدير تحرير محتوى ومقالات', hierarchy_level: 2, level: 'HQ' },
  { code: 'INITIATIVES_MANAGER', title_ar: 'مدير المبادرات', hierarchy_level: 2, level: 'HQ' },
  { code: 'FREELANCER_MANAGER', title_ar: 'مدير فريلانسر', hierarchy_level: 2, level: 'HQ' },
  { code: 'EXECUTIVE_DESIGNER', title_ar: 'إداري تنفيذي مصمم', hierarchy_level: 2, level: 'HQ' },
  { code: 'EXECUTIVE_MARKETER', title_ar: 'إداري تنفيذي مسوق', hierarchy_level: 2, level: 'HQ' },
  { code: 'EXECUTIVE_SALES', title_ar: 'إداري تنفيذي مبيعات', hierarchy_level: 2, level: 'HQ' },
  { code: 'EXECUTIVE_CALLCENTER', title_ar: 'إداري تنفيذي كول سنتر', hierarchy_level: 2, level: 'HQ' },
  { code: 'EXECUTIVE_SOCIAL_MEDIA', title_ar: 'إداري تنفيذي منصات التواصل', hierarchy_level: 2, level: 'HQ' },
  { code: 'EDITOR', title_ar: 'محرر', hierarchy_level: 3, level: 'HQ' },
  { code: 'HQ_ADMIN', title_ar: 'مدير المكتب الرئيسي', hierarchy_level: 1, level: 'HQ' },
  { code: 'BRANCH_MANAGER', title_ar: 'مدير فرع', hierarchy_level: 2, level: 'BRANCH' },
  { code: 'ASSISTANT_BRANCH_MANAGER', title_ar: 'مساعد مدير فرع', hierarchy_level: 3, level: 'BRANCH' },
  { code: 'BRANCH_ADMIN', title_ar: 'إداري فرع', hierarchy_level: 3, level: 'BRANCH' },
  { code: 'INCUBATOR_MANAGER', title_ar: 'مدير حاضنة', hierarchy_level: 2, level: 'INCUBATOR' },
  { code: 'ASSISTANT_INCUBATOR_MANAGER', title_ar: 'مساعد مدير حاضنة', hierarchy_level: 3, level: 'INCUBATOR' },
  { code: 'INCUBATOR_ADMIN', title_ar: 'إداري حاضنة', hierarchy_level: 3, level: 'INCUBATOR' },
  { code: 'PLATFORM_MANAGER', title_ar: 'مدير منصة', hierarchy_level: 2, level: 'PLATFORM' },
  { code: 'ASSISTANT_PLATFORM_MANAGER', title_ar: 'مساعد مدير منصة', hierarchy_level: 3, level: 'PLATFORM' },
  { code: 'PLATFORM_ADMIN', title_ar: 'إداري منصة', hierarchy_level: 3, level: 'PLATFORM' },
  { code: 'OFFICE_EXECUTIVE', title_ar: 'مسؤول تنفيذي مكاتب', hierarchy_level: 2, level: 'OFFICE' },
  { code: 'OFFICE_ADMIN', title_ar: 'إداري تنفيذي مكاتب', hierarchy_level: 3, level: 'OFFICE' },
  { code: 'LOGISTICS_EMPLOYEE', title_ar: 'موظف لوجستيات', hierarchy_level: 4, level: 'ALL' },
  { code: 'PERMANENT_TRAINER', title_ar: 'مدرب دائم', hierarchy_level: 4, level: 'ALL' },
  { code: 'FREELANCER_TRAINER', title_ar: 'مدرب فريلانسر', hierarchy_level: 4, level: 'ALL' },
  { code: 'VOLUNTEER_TRAINER', title_ar: 'مدرب متطوع', hierarchy_level: 4, level: 'ALL' },
  { code: 'INITIATIVES_VOLUNTEER', title_ar: 'متطوع مبادرات', hierarchy_level: 4, level: 'ALL' },
];

const TENANT_PAGE_KEYS = [
  { key: 'dashboard', label: 'لوحة التحكم' },
  { key: 'products', label: 'المنتجات' },
  { key: 'services', label: 'الخدمات' },
  { key: 'finance', label: 'المالية' },
  { key: 'hr', label: 'الموارد البشرية' },
  { key: 'reports', label: 'التقارير' },
  { key: 'settings', label: 'الإعدادات' },
  { key: 'roles', label: 'الأدوار والصلاحيات' },
  { key: 'records-archive-home', label: 'نظام السجلات والأرشفة' },
  { key: 'information-center', label: 'مركز المعلومات' },
];

const DEFAULT_HOMEPAGE_SETTINGS = {
  theme: {
    primaryColor: '#d70000',
    secondaryColor: '#ff4f63',
    buttonColor: '#b10011',
    headerBgColor: '#ffffff',
    textColor: '#171a20',
  },
  typography: {
    headingColor: '#171a20',
    paragraphColor: '#5e636d',
    linkColor: '#1f232b',
  },
  logoUrl: '/assets/naiosh-logo.png',
  heroImageUrl: '/assets/hero-main.webp',
  heroImageMode: 'cover',
  heroMedia: {
    activeType: 'image',
    imageUrls: ['/assets/hero-main.webp'],
    imageCaptions: [''],
    activeImageIndex: 0,
    videoUrls: [],
    videoCaptions: [],
    videoDescriptions: [],
    activeVideoIndex: 0,
    videoUrl: '',
    autoPlaySlider: true,
    overlayStrength: 0.62,
  },
  announcementBar: {
    text: 'نايوش هوب 360 — غرفة العمليات المركزية',
    backgroundColor: '#1a0208',
    textColor: '#ffffff',
    speed: 28,
  },
  floatingCard: {
    title: 'تشغيل الأنظمة من هوب',
    description: 'إدارة الأدوار والصلاحيات ومنح الأنظمة للمستأجرين',
    primaryButtonText: 'تشغيل الأنظمة',
    primaryButtonLink: '/system-ops.html',
    secondaryButtonText: 'الأدوار',
    secondaryButtonLink: '/roles-permissions.html',
  },
  tourMedia: {
    activeType: 'image',
    imageUrl: '/assets/hero-main.webp',
    imagePublicId: null,
    videoUrl: '',
  },
};

function ensureDir() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultPermissionsForRole(code) {
  const level =
    code === 'SUPER_ADMIN'
      ? 'FULL_ACCESS'
      : /MANAGER|ADMIN|EXECUTIVE/.test(code)
        ? 'EXECUTIVE'
        : /TRAINER|EDITOR/.test(code)
          ? 'READ_WRITE'
          : 'VIEW';
  return SYSTEMS.map((s) => ({
    system_code: s.code,
    permission_level: code === 'SUPER_ADMIN' ? 'FULL_ACCESS' : level,
  }));
}

function buildTenantPageRegistry() {
  const systems = SYSTEMS.map((s, idx) => {
    const pages = [
      { key: s.code.toLowerCase(), label: s.name_ar },
      ...TENANT_PAGE_KEYS.map((p) => ({ key: `${s.code.toLowerCase()}__${p.key}`, label: `${s.name_ar} · ${p.label}` })),
    ];
    return {
      key: s.code.toLowerCase(),
      label: s.name_ar,
      pages,
      pageSource: 'hub',
      isPrimary: idx < 4,
    };
  });
  const primarySystems = systems.filter((s) => s.isPrimary);
  const otherSystems = systems.filter((s) => !s.isPrimary);
  return {
    systems: [...primarySystems, ...otherSystems],
    primarySystems,
    otherSystems,
    generatedAt: new Date().toISOString(),
  };
}

function blankStore() {
  const roles = ROLE_SEED.map((r, i) => ({
    id: i + 1,
    code: r.code,
    name_ar: r.title_ar,
    title_ar: r.title_ar,
    title_en: r.code,
    description: `دور ${r.title_ar} — منح أنظمة هوب`,
    hierarchy_level: r.hierarchy_level,
    min_approval_limit: 0,
    max_approval_limit: r.code === 'SUPER_ADMIN' ? null : r.hierarchy_level <= 1 ? 100000 : 10000,
    is_active: true,
    users_count: 0,
    systems_count: SYSTEMS.length,
    permissions: defaultPermissionsForRole(r.code),
    created_at: new Date().toISOString(),
  }));

  return {
    roles,
    users: [
      {
        id: 1,
        name: 'مسؤول هوب',
        email: 'admin@naiosh.app',
        entity_name: 'المقر الرئيسي',
        entity_id: 'HQ',
        tenant_type: 'HQ',
        job_title: 'Super Admin',
        requested_role_code: 'SUPER_ADMIN',
        is_active: true,
        role_code: 'SUPER_ADMIN',
        tenant_login_url: '',
        created_at: new Date().toISOString(),
      },
    ],
    audit: [],
    officePageAccess: {},
    tenantPageAccess: {},
    accountTypeSidebar: {},
    homepageSettings: { ...DEFAULT_HOMEPAGE_SETTINGS },
    heroMedia: [],
    updatedAt: new Date().toISOString(),
  };
}

function readStore() {
  try {
    ensureDir();
    if (!fs.existsSync(STORE_PATH)) {
      const seed = blankStore();
      fs.writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2));
      return seed;
    }
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    const seed = blankStore();
    return {
      ...seed,
      ...raw,
      roles: raw.roles?.length ? raw.roles : seed.roles,
      users: raw.users?.length ? raw.users : seed.users,
      homepageSettings: raw.homepageSettings || seed.homepageSettings,
      heroMedia: Array.isArray(raw.heroMedia) ? raw.heroMedia : [],
    };
  } catch {
    return blankStore();
  }
}

function writeStore(store) {
  ensureDir();
  store.updatedAt = new Date().toISOString();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  return store;
}

function logAudit(store, action, detail = '', entityType = 'roles', entityId = null) {
  store.audit = [
    {
      id: uid('aud'),
      created_at: new Date().toISOString(),
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: typeof detail === 'string' ? { detail } : detail,
      performed_by: 'hub-admin',
      at: new Date().toISOString(),
    },
    ...(store.audit || []),
  ].slice(0, 200);
}

function findRole(store, roleCode) {
  return (store.roles || []).find((r) => String(r.code) === String(roleCode) || String(r.id) === String(roleCode));
}

function enrichUser(store, user) {
  const role = findRole(store, user.role_code);
  return {
    ...user,
    current_role_name: role ? role.title_ar : null,
    current_role: role
      ? {
          role_id: role.code,
          role_code: role.code,
          role_name: role.title_ar,
        }
      : null,
  };
}

function resolveOffice(officeId) {
  const id = String(officeId || '').trim();
  return {
    id: Number.isFinite(Number(id)) ? Number(id) : null,
    name: `مكتب ${id}`,
    code: id.toUpperCase().startsWith('OFF') ? id.toUpperCase() : `OFF-${id}`,
    entity_id: id,
  };
}

function resolveTenant(tenantId) {
  const id = String(tenantId || '').trim();
  return {
    id: Number.isFinite(Number(id)) ? Number(id) : id,
    name: `مستأجر ${id}`,
    subdomain: id.includes('.') ? id : `${id}.naiosh.app`,
    entity_id: id,
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, x-user-id, X-File-Name, X-File-Type',
  });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function handleAdminApi(req, res, pathname) {
  if (!pathname.startsWith('/api/admin') && pathname !== '/api/auth/logout') return false;

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return true;
  }

  if (pathname === '/api/auth/logout') {
    sendJson(res, 200, { success: true });
    return true;
  }

  const store = readStore();
  const url = new URL(req.url, 'http://localhost');
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);

  // /api/admin/metadata
  if (pathname === '/api/admin/metadata' && req.method === 'GET') {
    sendJson(res, 200, {
      success: true,
      systems: SYSTEMS,
      permission_levels: PERMISSION_LEVELS,
      hierarchy_levels: [...new Set(store.roles.map((r) => r.hierarchy_level))].sort((a, b) => a - b),
    });
    return true;
  }

  // /api/admin/roles
  if (pathname === '/api/admin/roles' && req.method === 'GET') {
    const roles = store.roles.map((r) => ({
      ...r,
      users_count: store.users.filter((u) => u.role_code === r.code && u.is_active !== false).length,
      systems_count: (r.permissions || []).filter((p) => p.permission_level && p.permission_level !== 'NONE').length,
    }));
    sendJson(res, 200, { success: true, roles, total: roles.length });
    return true;
  }

  if (pathname === '/api/admin/roles' && req.method === 'POST') {
    const body = await readBody(req);
    const code = String(body.code || body.name || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
    if (!code) {
      sendJson(res, 400, { success: false, message: 'كود الدور مطلوب' });
      return true;
    }
    if (findRole(store, code)) {
      sendJson(res, 400, { success: false, message: 'الدور موجود مسبقًا' });
      return true;
    }
    const role = {
      id: Math.max(0, ...store.roles.map((r) => Number(r.id) || 0)) + 1,
      code,
      name_ar: body.title_ar || body.name_ar || code,
      title_ar: body.title_ar || body.name_ar || code,
      title_en: body.title_en || code,
      description: body.description || '',
      hierarchy_level: Number(body.hierarchy_level || 3),
      min_approval_limit: Number(body.min_approval_limit || 0),
      max_approval_limit: body.max_approval_limit == null || body.max_approval_limit === '' ? null : Number(body.max_approval_limit),
      is_active: body.is_active !== false,
      users_count: 0,
      systems_count: 0,
      permissions: defaultPermissionsForRole(code),
      created_at: new Date().toISOString(),
    };
    store.roles.push(role);
    logAudit(store, 'CREATE', { name: role.title_ar }, 'roles', role.code);
    writeStore(store);
    sendJson(res, 201, { success: true, role });
    return true;
  }

  // /api/admin/roles/:code
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'roles' && parts[3] && req.method === 'GET' && !parts[4]) {
    const role = findRole(store, parts[3]);
    if (!role) {
      sendJson(res, 404, { success: false, message: 'الدور غير موجود' });
      return true;
    }
    sendJson(res, 200, {
      success: true,
      role,
      permissions: role.permissions || [],
      users: store.users.filter((u) => u.role_code === role.code).map((u) => enrichUser(store, u)),
    });
    return true;
  }

  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'roles' && parts[3] && parts[4] === 'permissions' && req.method === 'PUT') {
    const role = findRole(store, parts[3]);
    if (!role) {
      sendJson(res, 404, { success: false, message: 'الدور غير موجود' });
      return true;
    }
    const body = await readBody(req);
    role.permissions = Array.isArray(body.permissions) ? body.permissions : role.permissions;
    role.systems_count = (role.permissions || []).filter((p) => p.permission_level && p.permission_level !== 'NONE').length;
    logAudit(store, 'UPDATE', { permissions: role.permissions.length }, 'role_permissions', role.code);
    writeStore(store);
    sendJson(res, 200, { success: true, role, permissions: role.permissions });
    return true;
  }

  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'roles' && parts[3] && req.method === 'PUT' && !parts[4]) {
    const role = findRole(store, parts[3]);
    if (!role) {
      sendJson(res, 404, { success: false, message: 'الدور غير موجود' });
      return true;
    }
    const body = await readBody(req);
    Object.assign(role, {
      title_ar: body.title_ar || role.title_ar,
      name_ar: body.title_ar || body.name_ar || role.name_ar,
      title_en: body.title_en || role.title_en,
      description: body.description != null ? body.description : role.description,
      hierarchy_level: body.hierarchy_level != null ? Number(body.hierarchy_level) : role.hierarchy_level,
      min_approval_limit: body.min_approval_limit != null ? Number(body.min_approval_limit) : role.min_approval_limit,
      max_approval_limit:
        body.max_approval_limit === '' || body.max_approval_limit == null
          ? role.max_approval_limit
          : Number(body.max_approval_limit),
      is_active: body.is_active != null ? Boolean(body.is_active) : role.is_active,
    });
    logAudit(store, 'UPDATE', { title: role.title_ar }, 'roles', role.code);
    writeStore(store);
    sendJson(res, 200, { success: true, role });
    return true;
  }

  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'roles' && parts[3] && req.method === 'DELETE' && !parts[4]) {
    const before = store.roles.length;
    store.roles = store.roles.filter((r) => String(r.code) !== String(parts[3]) && String(r.id) !== String(parts[3]));
    if (store.roles.length === before) {
      sendJson(res, 404, { success: false, message: 'الدور غير موجود' });
      return true;
    }
    logAudit(store, 'DELETE', {}, 'roles', parts[3]);
    writeStore(store);
    sendJson(res, 200, { success: true });
    return true;
  }

  // users list
  if (pathname === '/api/admin/users' && req.method === 'GET') {
    const q = String(url.searchParams.get('query') || '').toLowerCase();
    const active = url.searchParams.get('is_active');
    let users = store.users.slice();
    if (q) users = users.filter((u) => `${u.name} ${u.email} ${u.entity_name || ''} ${u.entity_id || ''}`.toLowerCase().includes(q));
    if (active === 'true') users = users.filter((u) => u.is_active !== false);
    if (active === 'false') users = users.filter((u) => u.is_active === false);
    sendJson(res, 200, {
      success: true,
      users: users.map((u) => enrichUser(store, u)),
      total_users: users.length,
    });
    return true;
  }

  if (pathname === '/api/admin/users' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.name || !body.email) {
      sendJson(res, 400, { success: false, message: 'الاسم والبريد مطلوبان' });
      return true;
    }
    const user = {
      id: Math.max(0, ...store.users.map((u) => Number(u.id) || 0)) + 1,
      name: body.name,
      email: body.email,
      entity_name: body.entity_name || '',
      entity_id: body.entity_id || '',
      tenant_type: body.tenant_type || 'HQ',
      job_title: body.job_title || '',
      requested_role_code: body.requested_role_code || body.role_code || '',
      is_active: body.is_active !== false,
      role_code: body.role_code || body.requested_role_code || null,
      tenant_login_url: body.tenant_login_url || '',
      created_at: new Date().toISOString(),
    };
    store.users.unshift(user);
    logAudit(store, 'CREATE', { email: user.email }, 'user_roles', String(user.id));
    writeStore(store);
    sendJson(res, 201, { success: true, user: enrichUser(store, user) });
    return true;
  }

  // users/:id
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'users' && parts[3] && !parts[4] && req.method === 'GET') {
    const user = store.users.find((u) => String(u.id) === String(parts[3]));
    if (!user) {
      sendJson(res, 404, { success: false, message: 'المستخدم غير موجود' });
      return true;
    }
    sendJson(res, 200, { success: true, user: enrichUser(store, user) });
    return true;
  }

  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'users' && parts[3] && !parts[4] && req.method === 'PUT') {
    const user = store.users.find((u) => String(u.id) === String(parts[3]));
    if (!user) {
      sendJson(res, 404, { success: false, message: 'المستخدم غير موجود' });
      return true;
    }
    const body = await readBody(req);
    Object.assign(user, {
      name: body.name != null ? body.name : user.name,
      email: body.email != null ? body.email : user.email,
      entity_name: body.entity_name != null ? body.entity_name : user.entity_name,
      entity_id: body.entity_id != null ? body.entity_id : user.entity_id,
      tenant_type: body.tenant_type != null ? body.tenant_type : user.tenant_type,
      job_title: body.job_title != null ? body.job_title : user.job_title,
      requested_role_code: body.requested_role_code != null ? body.requested_role_code : user.requested_role_code,
      is_active: body.is_active != null ? Boolean(body.is_active) : user.is_active,
    });
    if (body.role_code) user.role_code = body.role_code;
    logAudit(store, 'UPDATE', { email: user.email }, 'user_roles', String(user.id));
    writeStore(store);
    sendJson(res, 200, { success: true, user: enrichUser(store, user) });
    return true;
  }

  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'users' && parts[3] && !parts[4] && req.method === 'DELETE') {
    const before = store.users.length;
    store.users = store.users.filter((u) => String(u.id) !== String(parts[3]));
    if (store.users.length === before) {
      sendJson(res, 404, { success: false, message: 'المستخدم غير موجود' });
      return true;
    }
    logAudit(store, 'DELETE', {}, 'user_roles', parts[3]);
    writeStore(store);
    sendJson(res, 200, { success: true });
    return true;
  }

  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'users' && parts[3] && parts[4] === 'role' && req.method === 'POST') {
    const user = store.users.find((u) => String(u.id) === String(parts[3]));
    if (!user) {
      sendJson(res, 404, { success: false, message: 'المستخدم غير موجود' });
      return true;
    }
    const body = await readBody(req);
    user.role_code = body.role_code || body.roleCode || user.role_code;
    user.requested_role_code = user.role_code;
    logAudit(store, 'UPDATE', { role: user.role_code }, 'user_roles', String(user.id));
    writeStore(store);
    sendJson(res, 200, { success: true, user: enrichUser(store, user) });
    return true;
  }

  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'users' && parts[3] && parts[4] === 'role' && req.method === 'DELETE') {
    const user = store.users.find((u) => String(u.id) === String(parts[3]));
    if (!user) {
      sendJson(res, 404, { success: false, message: 'المستخدم غير موجود' });
      return true;
    }
    user.role_code = null;
    logAudit(store, 'DELETE', {}, 'user_roles', String(user.id));
    writeStore(store);
    sendJson(res, 200, { success: true, user: enrichUser(store, user) });
    return true;
  }

  // office page access
  if (pathname === '/api/admin/office-page-access' && req.method === 'GET') {
    const officeId = url.searchParams.get('office_id') || '';
    if (!officeId) {
      sendJson(res, 400, { success: false, message: 'office_id مطلوب' });
      return true;
    }
    const office = resolveOffice(officeId);
    const pages = store.officePageAccess[officeId] || TENANT_PAGE_KEYS.map((p) => p.key);
    sendJson(res, 200, { success: true, office, pages, registry: TENANT_PAGE_KEYS });
    return true;
  }
  if (pathname === '/api/admin/office-page-access' && req.method === 'POST') {
    const body = await readBody(req);
    const officeId = body.office_id || body.officeId || 'default';
    store.officePageAccess[officeId] = Array.isArray(body.pages) ? body.pages : [];
    logAudit(store, 'UPDATE', { officeId }, 'office_page_access', officeId);
    writeStore(store);
    sendJson(res, 200, { success: true });
    return true;
  }

  // tenant registry / access
  if (pathname === '/api/admin/tenant-page-registry' && req.method === 'GET') {
    sendJson(res, 200, { success: true, registry: buildTenantPageRegistry() });
    return true;
  }
  if (pathname === '/api/admin/tenant-page-access' && req.method === 'GET') {
    const tenantId = url.searchParams.get('tenant_id') || '';
    if (!tenantId) {
      sendJson(res, 400, { success: false, message: 'tenant_id مطلوب' });
      return true;
    }
    const tenant = resolveTenant(tenantId);
    const saved = store.tenantPageAccess[tenantId] || {};
    sendJson(res, 200, {
      success: true,
      tenant,
      pages: saved.pages || TENANT_PAGE_KEYS.map((p) => p.key),
      page_restrictions: saved.page_restrictions || {},
    });
    return true;
  }
  if (pathname === '/api/admin/tenant-page-access' && req.method === 'POST') {
    const body = await readBody(req);
    const tenantId = body.tenant_id || body.tenantId || 'default';
    store.tenantPageAccess[tenantId] = {
      pages: Array.isArray(body.pages) ? body.pages : [],
      page_restrictions: body.page_restrictions || body.pageRestrictions || {},
    };
    logAudit(store, 'UPDATE', { tenantId }, 'tenant_page_access', tenantId);
    writeStore(store);
    sendJson(res, 200, { success: true });
    return true;
  }

  // account type sidebar
  if (pathname === '/api/admin/account-type-sidebar' && req.method === 'GET') {
    const accountType = String(url.searchParams.get('account_type') || '').toUpperCase();
    if (!accountType) {
      sendJson(res, 400, { success: false, message: 'account_type مطلوب' });
      return true;
    }
    sendJson(res, 200, {
      success: true,
      account_type: accountType,
      pages: store.accountTypeSidebar[accountType] || [],
    });
    return true;
  }
  if (pathname === '/api/admin/account-type-sidebar' && req.method === 'POST') {
    const body = await readBody(req);
    const accountType = String(body.account_type || body.accountType || '').toUpperCase();
    const pages = Array.isArray(body.pages) ? body.pages : [];
    store.accountTypeSidebar[accountType] = pages;
    logAudit(store, 'UPDATE', { accountType, pages }, 'account_type_sidebar', accountType);
    writeStore(store);
    sendJson(res, 200, { success: true, account_type: accountType, pages });
    return true;
  }

  // audit-log
  if (pathname === '/api/admin/audit-log' && req.method === 'GET') {
    const limit = Math.min(200, Number(url.searchParams.get('limit') || 50));
    const logs = (store.audit || []).slice(0, limit);
    sendJson(res, 200, { success: true, logs, total: (store.audit || []).length, limit, offset: 0 });
    return true;
  }
  if (pathname === '/api/admin/audit' && req.method === 'GET') {
    sendJson(res, 200, { success: true, items: store.audit || [] });
    return true;
  }

  // homepage settings stubs (نفس واجهة ERP — تخزين محلي في هوب)
  if (pathname === '/api/admin/homepage-settings' && req.method === 'GET') {
    sendJson(res, 200, { success: true, settings: store.homepageSettings || DEFAULT_HOMEPAGE_SETTINGS });
    return true;
  }
  if (pathname === '/api/admin/homepage-settings' && req.method === 'PUT') {
    const body = await readBody(req);
    store.homepageSettings = { ...(store.homepageSettings || DEFAULT_HOMEPAGE_SETTINGS), ...body, theme: { ...DEFAULT_HOMEPAGE_SETTINGS.theme, ...(body.theme || {}) }, typography: { ...DEFAULT_HOMEPAGE_SETTINGS.typography, ...(body.typography || {}) } };
    writeStore(store);
    sendJson(res, 200, { success: true, settings: store.homepageSettings });
    return true;
  }
  if (pathname.startsWith('/api/admin/homepage-settings/') && (req.method === 'POST' || req.method === 'PUT')) {
    const action = pathname.split('/').pop();
    const body = await readBody(req);
    const fileUrl = String(body.url || body.logoUrl || body.heroImageUrl || body.heroVideoUrl || body.videoUrl || '').trim();
    const settings = {
      ...(store.homepageSettings || DEFAULT_HOMEPAGE_SETTINGS),
      heroMedia: {
        ...DEFAULT_HOMEPAGE_SETTINGS.heroMedia,
        ...((store.homepageSettings || DEFAULT_HOMEPAGE_SETTINGS).heroMedia || {}),
      },
      tourMedia: {
        ...DEFAULT_HOMEPAGE_SETTINGS.tourMedia,
        ...((store.homepageSettings || DEFAULT_HOMEPAGE_SETTINGS).tourMedia || {}),
      },
    };
    if (!fileUrl) {
      sendJson(res, 400, { success: false, message: 'رابط الملف مطلوب بعد الرفع' });
      return true;
    }
    const caption = String(body.heroCaption || body.title || body.caption || '').trim();
    if (action === 'logo') {
      settings.logoUrl = fileUrl;
      store.homepageSettings = settings;
      writeStore(store);
      sendJson(res, 200, { success: true, logoUrl: fileUrl, settings, message: 'تم حفظ الشعار' });
      return true;
    }
    if (action === 'hero-image') {
      const urls = Array.isArray(settings.heroMedia.imageUrls) ? settings.heroMedia.imageUrls.filter(Boolean) : [];
      urls.push(fileUrl);
      settings.heroMedia.imageUrls = urls;
      settings.heroMedia.activeImageIndex = urls.length - 1;
      const captions = Array.isArray(settings.heroMedia.imageCaptions) ? settings.heroMedia.imageCaptions.slice() : [];
      captions[urls.length - 1] = caption;
      settings.heroMedia.imageCaptions = captions;
      settings.heroImageUrl = fileUrl;
      store.homepageSettings = settings;
      writeStore(store);
      sendJson(res, 200, { success: true, heroImageUrl: fileUrl, settings, message: 'تم حفظ صورة Hero' });
      return true;
    }
    if (action === 'hero-video') {
      const urls = Array.isArray(settings.heroMedia.videoUrls) ? settings.heroMedia.videoUrls.filter(Boolean) : [];
      urls.push(fileUrl);
      settings.heroMedia.videoUrls = urls;
      settings.heroMedia.videoUrl = fileUrl;
      settings.heroMedia.activeType = 'video';
      settings.heroMedia.activeVideoIndex = urls.length - 1;
      const captions = Array.isArray(settings.heroMedia.videoCaptions) ? settings.heroMedia.videoCaptions.slice() : [];
      captions[urls.length - 1] = caption;
      settings.heroMedia.videoCaptions = captions;
      store.homepageSettings = settings;
      writeStore(store);
      sendJson(res, 200, { success: true, heroVideoUrl: fileUrl, settings, message: 'تم حفظ فيديو Hero' });
      return true;
    }
    if (action === 'tour-image') {
      settings.tourMedia.imageUrl = fileUrl;
      settings.tourMedia.activeType = 'image';
      store.homepageSettings = settings;
      writeStore(store);
      sendJson(res, 200, { success: true, tourImageUrl: fileUrl, settings, message: 'تم حفظ صورة الجولة' });
      return true;
    }
    if (action === 'tour-video') {
      settings.tourMedia.videoUrl = fileUrl;
      settings.tourMedia.activeType = 'video';
      store.homepageSettings = settings;
      writeStore(store);
      sendJson(res, 200, { success: true, tourVideoUrl: fileUrl, settings, message: 'تم حفظ فيديو الجولة' });
      return true;
    }
    sendJson(res, 200, { success: true, url: fileUrl, settings, message: 'تم الحفظ' });
    return true;
  }

  if (pathname === '/api/admin/hero-media' && req.method === 'GET') {
    sendJson(res, 200, { success: true, items: store.heroMedia || [], heroMediaList: store.heroMedia || [] });
    return true;
  }
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'hero-media') {
    sendJson(res, 200, { success: true, message: 'تم التحديث', heroMediaList: store.heroMedia || [] });
    return true;
  }

  sendJson(res, 404, { success: false, message: `Admin route not found: ${pathname}` });
  return true;
}

module.exports = {
  handleAdminApi,
  readStore,
  SYSTEMS,
  PERMISSION_LEVELS,
  ROLE_SEED,
};
