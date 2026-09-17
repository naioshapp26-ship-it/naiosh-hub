/**
 * إدارة فريق العمل والصلاحيات — واجهة تشغيل مبسطة فوق HubAccessGov
 */
(() => {
  'use strict';

  const esc = (v = '') =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const ui = {
    tab: 'team',
    q: '',
    filters: { system: '', role: '', status: '' },
    page: 1,
    pageSize: 20,
    openMenu: null,
    selectedUser: null,
    wizard: null,
    confirm: null,
    success: null,
    pendingSensitive: null,
  };

  const OPS_ROLES = [
    { code: 'SUPER_ADMIN', nameAr: 'المدير الأعلى', desc: 'إدارة عليا للنطاقات المسموح بها.', positionCode: 'EMP_SUPREME_LEADER' },
    { code: 'SYSTEM_MANAGER', nameAr: 'مدير النظام', desc: 'إدارة النظام المحدد ومتابعة عملياته وفق الصلاحيات الممنوحة.', positionCode: 'SYSTEM_OWNER_POS' },
    { code: 'HUB_ADMIN', nameAr: 'مشرف', desc: 'متابعة ومراجعة العمليات داخل النظام المحدد.', positionCode: 'HUB_ADMIN_POS' },
    { code: 'HUB_EMPLOYEE', nameAr: 'موظف تشغيل', desc: 'تنفيذ المهام اليومية المسموح بها.', positionCode: 'HUB_EMPLOYEE_POS' },
    { code: 'HUB_AUDITOR', nameAr: 'مراجع', desc: 'عرض ومراجعة البيانات والطلبات دون إدارة كاملة.', positionCode: 'HUB_AUDITOR_POS' },
  ];

  const SENSITIVE = new Set([
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

  const PERM_AR = {
    'customer_requests.view': 'عرض العملاء',
    'customer_requests.create': 'إضافة عميل / طلب',
    'customer_requests.edit': 'تعديل بيانات العميل',
    'customer_requests.submit': 'إرسال الطلب',
    'customer_requests.approve': 'قبول الطلب',
    'customer_requests.reject': 'رفض الطلب',
    'customer_requests.assign': 'تعيين الطلب',
    'customer_requests.export': 'تصدير بيانات العملاء',
    'users.view': 'عرض بيانات الموظفين',
    'users.create': 'إضافة موظف',
    'users.edit': 'تعديل بيانات موظف',
    'users.suspend': 'إيقاف مستخدم',
    'users.assign': 'تعيين مستخدم',
    'users.manage': 'إدارة موظفي النظام',
    'users.audit': 'تدقيق المستخدمين',
    'roles.view': 'عرض الأدوار',
    'roles.create': 'إنشاء دور',
    'roles.edit': 'تعديل دور',
    'roles.assign': 'منح الصلاحيات',
    'roles.suspend': 'إيقاف دور',
    'roles.audit': 'تدقيق الأدوار',
    'roles.manage': 'إدارة الأدوار',
    'access_governance.view': 'عرض حوكمة الوصول',
    'access_governance.manage': 'إدارة فريق العمل',
    'access_governance.configure': 'تعديل إعدادات الحوكمة',
    'access_governance.audit': 'تدقيق الصلاحيات',
    'systems.view': 'عرض الأنظمة',
    'systems.configure': 'تعديل إعدادات النظام',
    'systems.manage': 'إدارة النظام',
    'systems.execute': 'تشغيل عمليات النظام',
    'audit.view': 'عرض سجل التدقيق',
    'audit.export': 'تصدير سجل التدقيق',
    'audit.audit': 'مراجعة التدقيق',
    'policies.view': 'عرض السياسات',
    'policies.publish': 'نشر السياسات',
    'policies.approve': 'اعتماد السياسات',
    'finance_approvals.view': 'عرض الاعتمادات المالية',
    'finance_approvals.approve': 'الموافقة النهائية المالية',
    'finance_approvals.reject': 'رفض اعتماد مالي',
    'workflow.view': 'عرض سير العمل',
    'workflow.execute': 'تنفيذ مهام التشغيل',
    'workflow.assign': 'تعيين مهام',
    'workflow.approve': 'اعتماد مهام',
    'delegations.create': 'إنشاء تفويض',
    'positions.view': 'عرض المناصب',
  };

  const ACTION_AR = {
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
    EXECUTE: 'تنفيذ',
    EXPORT: 'تصدير',
    SUBMIT: 'إرسال',
    REJECT: 'رفض',
    PUBLISH: 'نشر',
  };

  const SYSTEM_POOLS = {
    CRM: [
      'customer_requests.view',
      'customer_requests.create',
      'customer_requests.edit',
      'customer_requests.submit',
      'customer_requests.approve',
      'customer_requests.reject',
      'customer_requests.assign',
      'customer_requests.export',
      'users.view',
      'users.manage',
      'roles.assign',
      'systems.configure',
      'systems.manage',
      'workflow.execute',
      'audit.view',
    ],
    POSHA: [
      'customer_requests.view',
      'customer_requests.create',
      'customer_requests.edit',
      'customer_requests.approve',
      'customer_requests.reject',
      'users.view',
      'users.assign',
      'systems.configure',
      'audit.view',
    ],
    HUB: [
      'access_governance.view',
      'access_governance.manage',
      'roles.view',
      'roles.edit',
      'roles.assign',
      'roles.manage',
      'users.view',
      'users.assign',
      'users.manage',
      'users.suspend',
      'systems.view',
      'systems.configure',
      'systems.manage',
      'audit.view',
      'audit.export',
      'delegations.create',
      'customer_requests.view',
      'customer_requests.create',
      'workflow.execute',
      'policies.publish',
    ],
    ERP: ['systems.view', 'systems.configure', 'systems.manage', 'users.view', 'workflow.execute', 'finance_approvals.approve', 'audit.view', 'customer_requests.view'],
    LMS: ['systems.view', 'systems.configure', 'users.view', 'workflow.execute', 'audit.view'],
    LAW: ['systems.view', 'systems.configure', 'systems.manage', 'audit.view', 'policies.view', 'policies.approve'],
    FIT: ['systems.view', 'systems.configure', 'users.view', 'workflow.execute'],
    ACADEMY: ['systems.view', 'systems.configure', 'users.view', 'users.assign', 'customer_requests.view', 'workflow.execute'],
    NAIS: ['systems.view', 'systems.configure', 'users.view', 'audit.view'],
    SMARTX: ['systems.view', 'systems.configure', 'systems.execute', 'users.view'],
  };

  const PERM_GROUPS = [
    { id: 'view', title: 'العرض', match: /(^|\.)(view)$/i },
    { id: 'data', title: 'إدارة البيانات', match: /(create|edit|export|submit)$/i },
    { id: 'requests', title: 'إدارة الطلبات', match: /(approve|reject|assign)$/i },
    { id: 'admin', title: 'إدارة النظام', match: /(manage|configure|publish|suspend)$/i },
  ];

  const PANEL_BY_SYSTEM = {
    HUB: [
      'overview',
      'operating',
      'roles-permissions',
      'notifications',
      'site-settings',
      'settings',
      'search-admin',
      'content-articles',
      'side-project-regs',
      'store',
      'ads-studio',
      'events-studio',
      'apps',
      'systems',
      'tasks',
      'reports',
      'workforce',
    ],
    CRM: ['clients-mgmt', 'posha-clients', 'overview'],
    POSHA: ['posha-clients', 'clients-mgmt', 'overview', 'posha-os'],
    ERP: ['overview', 'apps', 'systems', 'tasks', 'reports'],
    LMS: ['overview', 'apps'],
    LAW: ['overview', 'governance', 'apps'],
    FIT: ['overview', 'apps'],
    ACADEMY: ['overview', 'apps', 'store'],
    NAIS: ['overview', 'apps'],
    SMARTX: ['overview', 'apps', 'systems-automation'],
  };

  const store = () => window.HubAccessGovStore.get();
  const engine = () => window.HubAccessGov;
  const nowIso = () => new Date().toISOString();

  const actorOf = (user) => {
    if (!user) return 'مشغّل هوب';
    if (user.role === 'supreme_leader' || user.role === 'chief_engineer' || user.role === 'platform_owner') {
      return 'مشغّل هوب';
    }
    return user.naioshId || user.email || user.name || 'مشغّل هوب';
  };

  const fmt = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return String(iso);
    }
  };

  const systems = () => {
    const fromAg = store().systems || [];
    const fromCat = window.HubOpsCatalog?.listSystems?.({ includeUmbrella: true }) || [];
    const map = new Map();
    fromAg.forEach((s) => {
      const code = s.code || s.id;
      if (!code) return;
      map.set(code, { code, nameAr: s.nameAr || s.name || code });
    });
    fromCat.forEach((s) => {
      const code = s.code || s.id;
      if (!code || map.has(code)) return;
      map.set(code, { code, nameAr: s.name || s.shortName || code });
    });
    if (!map.size) {
      [
        ['HUB', 'نايوش هوب 360'],
        ['CRM', 'إدارة العملاء'],
        ['POSHA', 'بوشا'],
      ].forEach(([code, nameAr]) => map.set(code, { code, nameAr }));
    }
    return [...map.values()];
  };

  const labelSys = (code) => systems().find((s) => s.code === code)?.nameAr || code || '—';
  const labelRole = (code) => {
    const ops = OPS_ROLES.find((r) => r.code === code);
    if (ops) return ops.nameAr;
    const r = (store().roles || []).find((x) => x.code === code);
    if (!r) return code || '—';
    if (r.code === 'SUPER_ADMIN') return 'المدير الأعلى';
    if (r.code === 'HUB_ADMIN') return 'مشرف';
    if (r.code === 'HUB_EMPLOYEE') return 'موظف تشغيل';
    if (r.code === 'HUB_AUDITOR') return 'مراجع';
    if (r.code === 'SYSTEM_MANAGER') return 'مدير النظام';
    return r.nameAr || code;
  };

  const permLabel = (code) => {
    if (PERM_AR[code]) return PERM_AR[code];
    const p = (store().permissions || []).find((x) => x.code === code);
    if (!p) return code;
    const act = ACTION_AR[p.action] || p.action;
    return p.nameAr?.includes('·') ? `${act} — ${String(p.resource || '').replace(/_/g, ' ')}` : p.nameAr || code;
  };

  const isSensitive = (code) => SENSITIVE.has(code) || /manage|assign|delete|publish|suspend|reject/i.test(code);

  const numberPerms = (codes = []) =>
    codes.map((code, i) => ({
      num: String(i + 1).padStart(2, '0'),
      code,
      label: permLabel(code),
      sensitive: isSensitive(code),
    }));

  const poolFor = (systemCode, roleCode) => {
    const pool = SYSTEM_POOLS[systemCode] || SYSTEM_POOLS.HUB;
    const role = (store().roles || []).find((r) => r.code === roleCode);
    const rolePerms = role?.permissions || [];
    const merged = [...new Set([...pool, ...rolePerms])];
    return merged.filter((code) => (store().permissions || []).some((p) => p.code === code) || PERM_AR[code] || pool.includes(code));
  };

  const primaryGrant = (identity) => {
    const grants = (store().grants || []).filter((g) => g.identityId === identity.id && String(g.status).toUpperCase() === 'ACTIVE');
    return grants[0] || null;
  };

  const teamRows = () => {
    let people = (store().identities || []).filter((u) => u.status !== 'archived');
    const q = String(ui.q || '').trim().toLowerCase();
    if (q) {
      people = people.filter((u) => [u.name, u.email, u.naioshId].some((x) => String(x || '').toLowerCase().includes(q)));
    }
    if (ui.filters.status) people = people.filter((u) => u.status === ui.filters.status);
    if (ui.filters.system || ui.filters.role) {
      people = people.filter((u) => {
        const grants = (store().grants || []).filter((g) => g.identityId === u.id && String(g.status).toUpperCase() === 'ACTIVE');
        if (!grants.length) return false;
        if (ui.filters.system && !grants.some((g) => g.system === ui.filters.system)) return false;
        if (ui.filters.role && !grants.some((g) => g.roleCode === ui.filters.role)) return false;
        return true;
      });
    }
    return people;
  };

  const badge = (text, cls = '') => `<span class="hto-badge ${cls}">${esc(text)}</span>`;
  const statusBadge = (s) => {
    if (s === 'suspended' || s === 'SUSPENDED') return badge('موقوف', 'is-warn');
    if (s === 'archived' || s === 'REVOKED') return badge('ملغى', 'is-muted');
    return badge('نشط', 'is-ok');
  };

  const clearFloat = () => document.querySelectorAll('.hto-float-menu').forEach((el) => el.remove());

  const placeOpenMenu = () => {
    clearFloat();
    const open = document.querySelector('.hto-more.is-open');
    if (!open || !ui.openMenu) return;
    const btn = open.querySelector('[data-action="hto-menu"]');
    const src = open.querySelector('.hto-more-menu');
    if (!btn || !src) return;
    const float = document.createElement('div');
    float.className = 'hto-float-menu';
    float.innerHTML = src.innerHTML;
    document.body.appendChild(float);
    const r = btn.getBoundingClientRect();
    const w = Math.max(200, float.offsetWidth || 200);
    const h = float.offsetHeight || 180;
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 10) top = Math.max(10, r.top - h - 6);
    let left = document.documentElement.dir === 'rtl' ? r.right - w : r.left;
    left = Math.max(10, Math.min(left, window.innerWidth - w - 10));
    float.style.top = `${Math.round(top)}px`;
    float.style.left = `${Math.round(left)}px`;
    float.addEventListener('click', (e) => {
      const t = e.target.closest('[data-action]');
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      const ok = window.HubTeamOpsUI.handle(t.getAttribute('data-action'), t, window.__htoCtx || {});
      if (ok && window.__htoRerender) window.__htoRerender();
    });
  };

  const afterPaint = (ctx = {}) => {
    window.__htoCtx = ctx;
    window.__htoRerender = ctx.rerender;
    requestAnimationFrame(placeOpenMenu);
    if (!window.__htoDocBound) {
      window.__htoDocBound = true;
      document.addEventListener('click', (e) => {
        if (e.target.closest('.hto-float-menu') || e.target.closest('[data-action="hto-menu"]')) return;
        if (ui.openMenu) {
          ui.openMenu = null;
          clearFloat();
        }
      });
    }
  };

  const rowActions = (u, g) => {
    const open = ui.openMenu === u.naioshId;
    return `<div class="hto-actions">
      <button type="button" class="hto-btn hto-btn-sm" data-action="hto-view" data-id="${esc(u.naioshId)}">عرض</button>
      <button type="button" class="hto-btn hto-btn-sm" data-action="hto-edit-grant" data-id="${esc(u.naioshId)}" data-gid="${esc(g?.grantId || '')}">تعديل</button>
      <div class="hto-more ${open ? 'is-open' : ''}">
        <button type="button" class="hto-btn hto-btn-sm" data-action="hto-menu" data-id="${esc(u.naioshId)}" title="المزيد" aria-label="المزيد">⋮</button>
        <div class="hto-more-menu">
          <button type="button" data-action="hto-view" data-id="${esc(u.naioshId)}">الصلاحيات</button>
          <button type="button" data-action="hto-edit-grant" data-id="${esc(u.naioshId)}" data-gid="${esc(g?.grantId || '')}">تغيير التعيين</button>
          ${
            u.status === 'suspended'
              ? `<button type="button" data-action="hto-reactivate" data-id="${esc(u.naioshId)}">إعادة التفعيل</button>`
              : `<button type="button" data-action="hto-confirm" data-kind="suspend" data-id="${esc(u.naioshId)}">إيقاف الوصول</button>`
          }
          ${
            g
              ? `<button type="button" data-action="hto-confirm" data-kind="revoke" data-id="${esc(g.grantId)}" data-user="${esc(u.name)}">إلغاء التعيين</button>`
              : `<button type="button" data-action="hto-wizard-open" data-user="${esc(u.naioshId)}">تعيين</button>`
          }
        </div>
      </div>
    </div>`;
  };

  const renderTeam = () => {
    const rows = teamRows();
    const pages = Math.max(1, Math.ceil(rows.length / ui.pageSize) || 1);
    ui.page = Math.min(ui.page, pages);
    const start = (ui.page - 1) * ui.pageSize;
    const pageRows = rows.slice(start, start + ui.pageSize);
    const sysOpts = systems();
    return `
      <section class="hto-panel">
        <div class="hto-panel-head">
          <div>
            <h3>فريق إدارة نايوش</h3>
            <p>الأشخاص المعيّنون لإدارة نايوش هوب وأنظمتها والصلاحيات الممنوحة لكل شخص.</p>
          </div>
          <button type="button" class="hto-btn hto-btn-primary" data-action="hto-wizard-open">+ تعيين موظف</button>
        </div>
        <div class="hto-toolbar">
          <input type="search" id="hto-q" value="${esc(ui.q)}" placeholder="ابحث بالاسم أو رقم نايوش أو البريد" />
          <select id="hto-f-sys"><option value="">النظام: الكل</option>${sysOpts.map((s) => `<option value="${esc(s.code)}" ${ui.filters.system === s.code ? 'selected' : ''}>${esc(s.nameAr)}</option>`).join('')}</select>
          <select id="hto-f-role"><option value="">الدور: الكل</option>${OPS_ROLES.map((r) => `<option value="${esc(r.code)}" ${ui.filters.role === r.code ? 'selected' : ''}>${esc(r.nameAr)}</option>`).join('')}</select>
          <select id="hto-f-status">
            <option value="">الحالة: الكل</option>
            <option value="active" ${ui.filters.status === 'active' ? 'selected' : ''}>نشط</option>
            <option value="suspended" ${ui.filters.status === 'suspended' ? 'selected' : ''}>موقوف</option>
          </select>
          <button type="button" class="hto-btn" data-action="hto-apply">تطبيق</button>
          <button type="button" class="hto-btn" data-action="hto-clear">مسح</button>
        </div>
        ${
          pageRows.length
            ? `<div class="hto-table-wrap"><table class="hto-table">
                <thead><tr>
                  <th>الموظف</th><th>رقم نايوش</th><th>مكان العمل</th><th>الدور</th><th>الصلاحيات</th><th>الحالة</th><th>آخر تعديل</th><th>الإجراءات</th>
                </tr></thead>
                <tbody>${pageRows
                  .map((u) => {
                    const g = primaryGrant(u);
                    const perms = g?.permissions || [];
                    return `<tr>
                      <td data-label="الموظف">
                        <button type="button" class="hto-user-link" data-action="hto-view" data-id="${esc(u.naioshId)}">
                          <span class="hto-avatar">${esc((u.name || '?').slice(0, 1))}</span>
                          <span><strong>${esc(u.name)}</strong><small>${esc(u.email || '')}</small></span>
                        </button>
                      </td>
                      <td data-label="رقم نايوش" class="hto-nowrap"><code>${esc(u.naioshId)}</code></td>
                      <td data-label="مكان العمل">${esc(g ? labelSys(g.system) : '—')}</td>
                      <td data-label="الدور"><span class="hto-chip">${esc(g ? labelRole(g.roleCode) : 'بدون تعيين')}</span></td>
                      <td data-label="الصلاحيات">${g ? `${perms.length} صلاحيات` : '—'}</td>
                      <td data-label="الحالة">${statusBadge(u.status)}</td>
                      <td data-label="آخر تعديل" class="hto-nowrap">${fmt(u.updatedAt || g?.updatedAt)}</td>
                      <td data-label="الإجراءات">${rowActions(u, g)}</td>
                    </tr>`;
                  })
                  .join('')}</tbody>
              </table></div>
              <div class="hto-pager">
                <span>عرض ${start + 1}–${Math.min(start + ui.pageSize, rows.length)} من ${rows.length}</span>
                <div class="hto-actions">
                  <button type="button" class="hto-btn" data-action="hto-page" data-page="${ui.page - 1}" ${ui.page <= 1 ? 'disabled' : ''}>السابق</button>
                  <button type="button" class="hto-btn" data-action="hto-page" data-page="${ui.page + 1}" ${ui.page >= pages ? 'disabled' : ''}>التالي</button>
                </div>
              </div>`
            : `<div class="hto-empty">
                <p>لا يوجد موظفون معيّنون حتى الآن.</p>
                <button type="button" class="hto-btn hto-btn-primary" data-action="hto-wizard-open">+ تعيين أول موظف</button>
              </div>`
        }
      </section>`;
  };

  const renderRoles = () => {
    const grants = store().grants || [];
    return `<section class="hto-panel">
      <div class="hto-panel-head">
        <div>
          <h3>الأدوار</h3>
          <p>أنشئ أدوارًا جاهزة تساعد على اقتراح مجموعة من الصلاحيات عند تعيين الموظفين.</p>
        </div>
      </div>
      <div class="hto-table-wrap"><table class="hto-table">
        <thead><tr><th>اسم الدور</th><th>الوصف</th><th>عدد الموظفين</th><th>عدد الصلاحيات الافتراضية</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
        <tbody>${OPS_ROLES.map((r) => {
          const full = (store().roles || []).find((x) => x.code === r.code);
          const usersN = new Set(grants.filter((g) => g.roleCode === r.code && String(g.status).toUpperCase() === 'ACTIVE').map((g) => g.identityId)).size;
          const permN = (full?.permissions || []).length;
          return `<tr>
            <td data-label="اسم الدور"><strong>${esc(r.nameAr)}</strong></td>
            <td data-label="الوصف">${esc(r.desc)}</td>
            <td data-label="عدد الموظفين">${usersN}</td>
            <td data-label="الصلاحيات الافتراضية">${permN}</td>
            <td data-label="الحالة">${badge('نشط', 'is-ok')}</td>
            <td data-label="الإجراءات"><button type="button" class="hto-btn hto-btn-sm" data-action="hto-role-view" data-code="${esc(r.code)}">عرض</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </section>`;
  };

  const renderAudit = () => {
    const rows = (store().audit || []).slice(0, 120);
    const actionAr = {
      GRANT_CREATED: 'تعيين / منح صلاحيات',
      GRANT_UPDATED: 'تعديل التعيين',
      GRANT_REVOKED: 'إلغاء التعيين',
      USER_SUSPENDED: 'إيقاف وصول',
      USER_REACTIVATED: 'إعادة تفعيل',
      USER_ARCHIVED: 'أرشفة',
      USER_CREATED: 'إضافة موظف',
      USER_PROFILE_UPDATED: 'تعديل بيانات',
      IDENTITY_UPDATED: 'تعديل بيانات',
    };
    return `<section class="hto-panel">
      <div class="hto-panel-head"><div>
        <h3>سجل الصلاحيات</h3>
        <p>سجل رقابي لكل عمليات التعيين والمنح والسحب والإيقاف. لا يمكن تعديله أو حذفه من هذه الشاشة.</p>
      </div></div>
      <div class="hto-table-wrap"><table class="hto-table">
        <thead><tr><th>التاريخ</th><th>الموظف</th><th>العملية</th><th>النظام</th><th>الصلاحية / الدور</th><th>تم بواسطة</th><th>التفاصيل</th></tr></thead>
        <tbody>${
          rows.length
            ? rows
                .map((a) => {
                  const permText = a.permission
                    ? String(a.permission)
                        .split(',')
                        .filter(Boolean)
                        .slice(0, 4)
                        .map((c) => permLabel(c.trim()))
                        .join('، ')
                    : a.role
                      ? labelRole(a.role)
                      : '—';
                  return `<tr>
                    <td data-label="التاريخ" class="hto-nowrap">${fmt(a.timestamp)}</td>
                    <td data-label="الموظف">${esc(a.targetUser || '—')}</td>
                    <td data-label="العملية">${esc(actionAr[a.action] || a.action)}</td>
                    <td data-label="النظام">${esc(a.system ? labelSys(a.system) : '—')}</td>
                    <td data-label="الصلاحية" class="hto-ellipsis" title="${esc(permText)}">${esc(permText)}</td>
                    <td data-label="تم بواسطة">${esc(a.actor || '—')}</td>
                    <td data-label="التفاصيل" class="hto-ellipsis">${esc(a.reason || '—')}</td>
                  </tr>`;
                })
                .join('')
            : `<tr><td colspan="7" class="hto-empty">لا أحداث مسجّلة بعد.</td></tr>`
        }</tbody>
      </table></div>
    </section>`;
  };

  const renderDrawer = () => {
    if (!ui.selectedUser) return '';
    const detail = engine().effectiveAccess(ui.selectedUser);
    const identity = detail?.identity;
    if (!identity) return '';
    const grants = (store().grants || []).filter((g) => g.identityId === identity.id);
    return `
      <div class="hto-drawer-backdrop" data-action="hto-drawer-close"></div>
      <aside class="hto-drawer" role="dialog" aria-label="بيانات الموظف">
        <header class="hto-drawer-head">
          <div>
            <h3>بيانات الموظف وصلاحياته</h3>
            <p class="hto-muted">${esc(identity.name)} · ${esc(identity.naioshId)}</p>
          </div>
          <button type="button" class="hto-btn" data-action="hto-drawer-close">إغلاق</button>
        </header>
        <div class="hto-drawer-body">
          <p><strong>البريد:</strong> ${esc(identity.email || '—')}</p>
          <p><strong>الحالة:</strong> ${statusBadge(identity.status)}</p>
          <h4>تعيينات الموظف</h4>
          ${
            grants.length
              ? grants
                  .map((g) => {
                    const nums = numberPerms(g.permissions || []);
                    return `<article class="hto-card">
                      <strong>${esc(labelSys(g.system))}</strong>
                      <p>الدور: ${esc(labelRole(g.roleCode))} · ${statusBadge(g.status)}</p>
                      <p>${(g.permissions || []).length} صلاحيات</p>
                      <ul class="hto-perm-list">${nums.map((p) => `<li>✓ ${esc(p.num)} — ${esc(p.label)}</li>`).join('')}</ul>
                      <div class="hto-actions" style="margin-top:8px">
                        <button type="button" class="hto-btn hto-btn-sm" data-action="hto-edit-grant" data-id="${esc(identity.naioshId)}" data-gid="${esc(g.grantId)}">تعديل</button>
                        ${
                          String(g.status).toUpperCase() === 'ACTIVE'
                            ? `<button type="button" class="hto-btn hto-btn-sm" data-action="hto-confirm" data-kind="revoke" data-id="${esc(g.grantId)}" data-user="${esc(identity.name)}">إلغاء التعيين</button>`
                            : ''
                        }
                      </div>
                    </article>`;
                  })
                  .join('')
              : `<p class="hto-empty">لا تعيينات. <button type="button" class="hto-btn hto-btn-primary" data-action="hto-wizard-open" data-user="${esc(identity.naioshId)}">تعيين الآن</button></p>`
          }
        </div>
        <div class="hto-drawer-actions">
          <button type="button" class="hto-btn" data-action="hto-edit-grant" data-id="${esc(identity.naioshId)}" data-gid="${esc(primaryGrant(identity)?.grantId || '')}">تعديل</button>
          ${
            identity.status === 'suspended'
              ? `<button type="button" class="hto-btn hto-btn-primary" data-action="hto-reactivate" data-id="${esc(identity.naioshId)}">إعادة التفعيل</button>`
              : `<button type="button" class="hto-btn" data-action="hto-confirm" data-kind="suspend" data-id="${esc(identity.naioshId)}">إيقاف الوصول</button>`
          }
        </div>
      </aside>`;
  };

  const renderPermChecks = (w) => {
    const pool = poolFor(w.system, w.roleCode);
    const selected = new Set(w.permissions?.length ? w.permissions : poolFor(w.system, w.roleCode).filter((c) => ((store().roles || []).find((r) => r.code === w.roleCode)?.permissions || []).includes(c)));
    if (!w.permissions?.length) {
      const roleDefaults = (store().roles || []).find((r) => r.code === w.roleCode)?.permissions || [];
      const defaults = pool.filter((c) => roleDefaults.includes(c));
      defaults.forEach((c) => selected.add(c));
    }
    const numbered = numberPerms(pool);
    const groups = PERM_GROUPS.map((g) => ({
      ...g,
      items: numbered.filter((p) => g.match.test(p.code)),
    })).filter((g) => g.items.length);
    const used = new Set(groups.flatMap((g) => g.items.map((i) => i.code)));
    const rest = numbered.filter((p) => !used.has(p.code));
    if (rest.length) groups.push({ id: 'other', title: 'صلاحيات أخرى', items: rest });

    return groups
      .map(
        (g) => `<div class="hto-check-group" data-group="${esc(g.id)}">
          <h5>${esc(g.title)}
            <button type="button" class="hto-btn hto-btn-sm" data-action="hto-select-group" data-group="${esc(g.id)}">تحديد الكل</button>
          </h5>
          ${g.items
            .map((p) => {
              const on = selected.has(p.code);
              return `<label class="hto-check ${p.sensitive ? 'is-sensitive' : ''}">
                <input type="checkbox" data-hto-perm="${esc(p.code)}" data-sensitive="${p.sensitive ? '1' : '0'}" ${on ? 'checked' : ''}/>
                <span>${esc(p.num)} — ${esc(p.label)}${p.sensitive ? ' · حساسة' : ''}</span>
              </label>`;
            })
            .join('')}
        </div>`
      )
      .join('');
  };

  const renderWizard = () => {
    if (!ui.wizard) return '';
    const w = ui.wizard;
    const steps = ['اختيار الموظف', 'مكان العمل', 'الدور', 'الصلاحيات', 'المراجعة'];
    const users = store().identities || [];
    const filtered = w.userQ
      ? users.filter((u) => [u.name, u.email, u.naioshId].some((x) => String(x || '').toLowerCase().includes(String(w.userQ).toLowerCase())))
      : users.filter((u) => u.status !== 'archived');
    const finalCodes = w.permissions?.length ? w.permissions : [];
    const list = numberPerms(finalCodes);
    const u = users.find((x) => x.naioshId === w.naioshId);

    return `<div class="hto-modal" role="dialog" aria-modal="true">
      <div class="hto-modal-card">
        <header><h3>${w.editGrantId ? 'تعديل التعيين' : 'تعيين موظف'}</h3><button type="button" class="hto-btn" data-action="hto-wizard-close">إغلاق</button></header>
        <div class="hto-steps">${steps.map((s, i) => `<span class="${w.step === i + 1 ? 'is-on' : ''}">${i + 1}. ${esc(s)}</span>`).join('')}</div>
        <div class="hto-wizard-body">
          ${
            w.step === 1
              ? `<h4>اختر الموظف</h4>
                 <p class="hto-lead">ابحث عن الشخص الذي تريد منحه صلاحية للعمل داخل نايوش.</p>
                 <input id="hto-w-q" value="${esc(w.userQ || '')}" placeholder="ابحث بالاسم أو رقم نايوش أو البريد الإلكتروني" />
                 <div class="hto-actions">
                   <button type="button" class="hto-btn" data-action="hto-wizard-search">بحث</button>
                   <button type="button" class="hto-btn" data-action="hto-add-user">+ إضافة مستخدم جديد</button>
                 </div>
                 <div class="hto-pick-list">${
                   filtered.slice(0, 50).map(
                     (row) => `<button type="button" class="hto-pick ${w.naioshId === row.naioshId ? 'is-on' : ''}" data-action="hto-wizard-pick-user" data-id="${esc(row.naioshId)}">
                       <span class="hto-avatar">${esc((row.name || '?').slice(0, 1))}</span>
                       <span><strong>${esc(row.name)}</strong><small>${esc(row.naioshId)} · ${esc(row.email || '')}</small></span>
                       <em>${row.status === 'active' ? 'نشط' : row.status === 'suspended' ? 'موقوف' : esc(row.status || '')}</em>
                     </button>`
                   ).join('') || '<p class="hto-empty">لا مستخدمين مطابقين</p>'
                 }</div>`
              : ''
          }
          ${
            w.step === 2
              ? `<h4>أين سيعمل هذا الموظف؟</h4>
                 <p class="hto-lead">اختر النظام أو القسم الذي سيكون الموظف مسؤولًا عنه. يمكن لنفس الشخص أن يكون له أكثر من تعيين.</p>
                 <div class="hto-pick-list">${systems()
                   .map(
                     (s) => `<button type="button" class="hto-pick ${w.system === s.code ? 'is-on' : ''}" data-action="hto-wizard-pick-sys" data-code="${esc(s.code)}">
                       <span><strong>${esc(s.nameAr)}</strong></span>
                     </button>`
                   )
                   .join('')}</div>`
              : ''
          }
          ${
            w.step === 3
              ? `<h4>ما دور الموظف؟</h4>
                 <p class="hto-lead">الدور يقترح صلاحيات افتراضية فقط — الصلاحيات النهائية تُحدَّد في الخطوة التالية.</p>
                 <div class="hto-pick-list">${OPS_ROLES.map(
                   (r) => `<button type="button" class="hto-pick ${w.roleCode === r.code ? 'is-on' : ''}" data-action="hto-wizard-pick-role" data-code="${esc(r.code)}">
                     <span><strong>${esc(r.nameAr)}</strong><small>${esc(r.desc)}</small></span>
                   </button>`
                 ).join('')}</div>`
              : ''
          }
          ${
            w.step === 4
              ? `<h4>ماذا يستطيع هذا الموظف أن يفعل؟</h4>
                 <p class="hto-lead">صلاحيات مرتبطة بـ «${esc(labelSys(w.system))}» فقط. الدور ليس صلاحية تلقائية.</p>
                 ${renderPermChecks(w)}
                 <p class="hto-warn">الصلاحيات الحساسة تسمح بعمليات مؤثرة داخل النظام — امنحها بحذر وبعد تأكيد.</p>`
              : ''
          }
          ${
            w.step === 5
              ? `<h4>راجع التعيين قبل التأكيد</h4>
                    <div class="hto-summary">
                      <p><strong>الموظف:</strong> ${esc(u?.name || w.naioshId)}</p>
                      <p><strong>رقم نايوش:</strong> ${esc(w.naioshId)}</p>
                      <p><strong>مكان العمل:</strong> ${esc(labelSys(w.system))}</p>
                      <p><strong>الدور:</strong> ${esc(labelRole(w.roleCode))}</p>
                      <p><strong>الحالة:</strong> نشط</p>
                      <p><strong>عدد الصلاحيات:</strong> ${list.length}</p>
                      <ul class="hto-perm-list">${list.map((p) => `<li>${esc(p.num)} — ${esc(p.label)}</li>`).join('')}</ul>
                    </div>`
              : ''
          }
        </div>
        <footer>
          ${w.step > 1 ? `<button type="button" class="hto-btn" data-action="hto-wizard-prev">رجوع للتعديل</button>` : '<span></span>'}
          ${w.step < 5 ? `<button type="button" class="hto-btn hto-btn-primary" data-action="hto-wizard-next">التالي</button>` : ''}
          ${w.step === 5 ? `<button type="button" class="hto-btn hto-btn-primary" data-action="hto-wizard-submit">تأكيد التعيين</button>` : ''}
        </footer>
      </div>
    </div>`;
  };

  const renderConfirm = () => {
    if (!ui.confirm) return '';
    const c = ui.confirm;
    let title = 'تأكيد';
    let body = '';
    if (c.kind === 'revoke') {
      title = 'تأكيد إلغاء التعيين';
      body = `سيتم إزالة ${esc(c.user || 'الموظف')} من هذا النظام وسحب الصلاحيات المرتبطة بهذا التعيين. لن يتم حذف حساب نايوش الخاص به.`;
    } else if (c.kind === 'suspend') {
      title = 'تأكيد إيقاف الوصول';
      body = 'سيتم إيقاف وصول هذا الموظف مؤقتًا مع الاحتفاظ بالتعيين والصلاحيات لإمكانية إعادة التفعيل.';
    } else if (c.kind === 'sensitive') {
      title = 'صلاحية إدارية حساسة';
      body = `هذه صلاحية إدارية حساسة (${esc(permLabel(c.code))}). منحها يسمح للموظف بتنفيذ عمليات مؤثرة داخل النظام.`;
    }
    return `<div class="hto-modal"><div class="hto-modal-card">
      <header><h3>${esc(title)}</h3><button type="button" class="hto-btn" data-action="hto-confirm-cancel">رجوع</button></header>
      <div class="hto-wizard-body"><p>${body}</p></div>
      <footer>
        <button type="button" class="hto-btn" data-action="hto-confirm-cancel">رجوع</button>
        <button type="button" class="hto-btn hto-btn-primary" data-action="hto-confirm-ok">تأكيد</button>
      </footer>
    </div></div>`;
  };

  const renderSuccess = () => {
    if (!ui.success) return '';
    return `<div class="hto-modal"><div class="hto-modal-card">
      <header><h3>تم بنجاح</h3><button type="button" class="hto-btn" data-action="hto-success-close">إغلاق</button></header>
      <div class="hto-wizard-body"><p>${esc(ui.success.message)}</p></div>
      <footer>
        ${ui.success.userId ? `<button type="button" class="hto-btn hto-btn-primary" data-action="hto-view" data-id="${esc(ui.success.userId)}">عرض الموظف</button>` : ''}
        <button type="button" class="hto-btn" data-action="hto-success-close">العودة لفريق العمل</button>
      </footer>
    </div></div>`;
  };

  const render = () => {
    const tabs = [
      ['team', 'فريق العمل'],
      ['assign', 'تعيين موظف'],
      ['roles', 'الأدوار'],
      ['audit', 'سجل الصلاحيات'],
    ];
    let body = '';
    if (ui.tab === 'team') body = renderTeam();
    else if (ui.tab === 'assign') {
      body = `<section class="hto-panel"><div class="hto-panel-head"><div>
        <h3>تعيين موظف</h3>
        <p>اختر الشخص، مكان العمل، الدور، ثم الصلاحيات — ثم راجع وأكّد ليُطبَّق الوصول فعليًا.</p>
      </div>
      <button type="button" class="hto-btn hto-btn-primary" data-action="hto-wizard-open">بدء التعيين</button>
      </div></section>`;
    } else if (ui.tab === 'roles') body = renderRoles();
    else body = renderAudit();

    return `
      <div class="hto-root" data-hto-root>
        <header class="hto-hero">
          <div>
            <h2>إدارة فريق العمل والصلاحيات</h2>
            <p>عيّن المسؤولين عن إدارة نايوش هوب وأنظمتها، وحدد لكل شخص مكان عمله ودوره والصلاحيات المسموح بها.</p>
          </div>
          <button type="button" class="hto-btn hto-btn-primary" data-action="hto-wizard-open">+ تعيين موظف</button>
        </header>
        <nav class="hto-tabs" aria-label="أقسام الصفحة">${tabs.map(([id, label]) => `<button type="button" class="hto-tab ${ui.tab === id ? 'is-on' : ''}" data-action="hto-tab" data-tab="${id}">${esc(label)}</button>`).join('')}</nav>
        <div class="hto-main">${body}</div>
        ${renderDrawer()}${renderWizard()}${renderConfirm()}${renderSuccess()}
      </div>`;
  };

  const readWizardPerms = () => {
    if (!ui.wizard) return;
    const checked = [...document.querySelectorAll('[data-hto-perm]:checked')].map((el) => el.getAttribute('data-hto-perm'));
    if (document.querySelectorAll('[data-hto-perm]').length) ui.wizard.permissions = checked;
  };

  const defaultPermsFor = (system, roleCode) => {
    const pool = poolFor(system, roleCode);
    const roleDefaults = (store().roles || []).find((r) => r.code === roleCode)?.permissions || [];
    const intersection = pool.filter((c) => roleDefaults.includes(c));
    return intersection.length ? intersection : pool.slice(0, 6);
  };

  const submitWizard = (ctx = {}) => {
    const { toast, user } = ctx;
    const actor = actorOf(user);
    readWizardPerms();
    const w = ui.wizard;
    if (!w?.naioshId) {
      toast?.('اختر موظفًا أولاً');
      return true;
    }
    const role = (store().roles || []).find((r) => r.code === w.roleCode);
    const ops = OPS_ROLES.find((r) => r.code === w.roleCode);
    const permissions = w.permissions?.length ? w.permissions : defaultPermsFor(w.system, w.roleCode);
    try {
      if (w.editGrantId) {
        engine().updateGrant(
          w.editGrantId,
          {
            roleCode: w.roleCode,
            system: w.system,
            permissions,
            reason: 'تعديل تعيين من إدارة فريق العمل',
          },
          actor
        );
        const name = engine().findIdentity(w.naioshId)?.name || w.naioshId;
        ui.success = { message: `تم تحديث صلاحيات ${name} بنجاح.`, userId: w.naioshId };
        toast?.('تم تحديث الصلاحيات بنجاح.');
      } else {
        engine().createGrant(
          {
            naioshId: w.naioshId,
            positionCode: ops?.positionCode || role?.eligiblePositions?.[0] || null,
            roleCode: w.roleCode,
            system: w.system || 'HUB',
            scopeCode: w.system === 'HUB' ? 'HUB-GLOBAL' : 'GLOBAL',
            permissions,
            purpose: 'تعيين من إدارة فريق العمل',
            governanceLevel: w.system === 'HUB' ? 'HUB' : w.roleCode === 'SUPER_ADMIN' ? 'EMPIRE' : 'SYSTEM',
          },
          actor
        );
        const name = engine().findIdentity(w.naioshId)?.name || w.naioshId;
        ui.success = { message: `تم تعيين ${name} بنجاح.`, userId: w.naioshId };
        toast?.('تم تعيين الموظف بنجاح.');
      }
      ui.selectedUser = w.naioshId;
      ui.wizard = null;
      ui.tab = 'team';
    } catch (e) {
      toast?.(e.message || 'تعذر حفظ الصلاحيات. لم يتم إجراء أي تغيير. حاول مرة أخرى.');
    }
    return true;
  };

  const handle = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const actor = actorOf(user);
    if (action !== 'hto-menu') {
      ui.openMenu = null;
      clearFloat();
    }

    if (action === 'hto-tab') {
      ui.tab = btn.dataset.tab || 'team';
      if (ui.tab === 'assign') {
        ui.wizard = { step: 1, naioshId: '', system: 'CRM', roleCode: 'SYSTEM_MANAGER', permissions: [], userQ: '' };
      }
      return true;
    }
    if (action === 'hto-apply') {
      ui.q = document.getElementById('hto-q')?.value || '';
      ui.filters.system = document.getElementById('hto-f-sys')?.value || '';
      ui.filters.role = document.getElementById('hto-f-role')?.value || '';
      ui.filters.status = document.getElementById('hto-f-status')?.value || '';
      ui.page = 1;
      return true;
    }
    if (action === 'hto-clear') {
      ui.q = '';
      ui.filters = { system: '', role: '', status: '' };
      ui.page = 1;
      return true;
    }
    if (action === 'hto-page') {
      const p = Number(btn.dataset.page || 1);
      if (p >= 1) ui.page = p;
      return true;
    }
    if (action === 'hto-menu') {
      ui.openMenu = ui.openMenu === btn.dataset.id ? null : btn.dataset.id;
      return true;
    }
    if (action === 'hto-view') {
      ui.selectedUser = btn.dataset.id;
      ui.success = null;
      ui.tab = 'team';
      return true;
    }
    if (action === 'hto-drawer-close') {
      ui.selectedUser = null;
      return true;
    }
    if (action === 'hto-role-view') {
      const role = (store().roles || []).find((r) => r.code === btn.dataset.code);
      const perms = numberPerms(role?.permissions || []);
      toast?.(`${labelRole(btn.dataset.code)}: ${perms.length} صلاحيات افتراضية`);
      return true;
    }
    if (action === 'hto-wizard-open') {
      ui.wizard = {
        step: 1,
        naioshId: btn.dataset.user || '',
        userQ: '',
        system: 'CRM',
        roleCode: 'SYSTEM_MANAGER',
        permissions: [],
      };
      ui.tab = 'assign';
      return true;
    }
    if (action === 'hto-wizard-close') {
      ui.wizard = null;
      return true;
    }
    if (action === 'hto-wizard-search') {
      ui.wizard.userQ = document.getElementById('hto-w-q')?.value || '';
      return true;
    }
    if (action === 'hto-wizard-pick-user') {
      ui.wizard.naioshId = btn.dataset.id;
      return true;
    }
    if (action === 'hto-wizard-pick-sys') {
      ui.wizard.system = btn.dataset.code;
      ui.wizard.permissions = [];
      return true;
    }
    if (action === 'hto-wizard-pick-role') {
      ui.wizard.roleCode = btn.dataset.code;
      ui.wizard.permissions = defaultPermsFor(ui.wizard.system, btn.dataset.code);
      return true;
    }
    if (action === 'hto-select-group') {
      const group = btn.dataset.group;
      document.querySelectorAll(`.hto-check-group[data-group="${group}"] [data-hto-perm]`).forEach((el) => {
        el.checked = true;
      });
      readWizardPerms();
      return true;
    }
    if (action === 'hto-wizard-next') {
      if (ui.wizard.step === 1 && !ui.wizard.naioshId) {
        toast?.('اختر موظفًا أولاً');
        return true;
      }
      if (ui.wizard.step === 2 && !ui.wizard.system) {
        toast?.('اختر مكان العمل');
        return true;
      }
      if (ui.wizard.step === 3 && !ui.wizard.roleCode) {
        toast?.('اختر الدور');
        return true;
      }
      if (ui.wizard.step === 3) {
        if (!ui.wizard.permissions?.length) ui.wizard.permissions = defaultPermsFor(ui.wizard.system, ui.wizard.roleCode);
      }
      if (ui.wizard.step === 4) {
        readWizardPerms();
        const sens = (ui.wizard.permissions || []).filter((c) => isSensitive(c));
        if (sens.length && !ui.wizard.sensitiveOk) {
          ui.confirm = { kind: 'sensitive', code: sens[0], next: 'wizard-step5' };
          return true;
        }
      }
      ui.wizard.step = Math.min(5, ui.wizard.step + 1);
      return true;
    }
    if (action === 'hto-wizard-prev') {
      if (ui.wizard.step === 5 || ui.wizard.step === 4) readWizardPerms();
      ui.wizard.step = Math.max(1, ui.wizard.step - 1);
      return true;
    }
    if (action === 'hto-wizard-submit') return submitWizard(ctx);
    if (action === 'hto-edit-grant') {
      const gid = btn.dataset.gid;
      if (!gid) {
        ui.wizard = { step: 1, naioshId: btn.dataset.id || '', system: 'CRM', roleCode: 'SYSTEM_MANAGER', permissions: [], userQ: '' };
        return true;
      }
      const g = (store().grants || []).find((x) => x.grantId === gid || x.id === gid);
      if (!g) {
        toast?.('التعيين غير موجود');
        return true;
      }
      ui.wizard = {
        step: 3,
        naioshId: btn.dataset.id || g.naioshId,
        system: g.system,
        roleCode: g.roleCode,
        permissions: (g.permissions || []).slice(),
        editGrantId: g.grantId,
        userQ: '',
      };
      ui.selectedUser = null;
      return true;
    }
    if (action === 'hto-add-user') {
      const name = window.prompt('اسم الموظف الجديد');
      if (!name) return true;
      const email = window.prompt('البريد الإلكتروني');
      if (!email) {
        toast?.('البريد مطلوب');
        return true;
      }
      try {
        const created = engine().ensureIdentity({ name, email }, actor);
        const id = created || engine().findIdentity(email);
        ui.wizard = ui.wizard || { step: 1, system: 'CRM', roleCode: 'SYSTEM_MANAGER', permissions: [] };
        ui.wizard.naioshId = id?.naioshId || '';
        ui.wizard.userQ = name;
        toast?.('تمت إضافة المستخدم — أكمل التعيين');
      } catch (e) {
        toast?.(e.message || 'تعذر إضافة المستخدم');
      }
      return true;
    }
    if (action === 'hto-confirm') {
      ui.confirm = { kind: btn.dataset.kind, id: btn.dataset.id, user: btn.dataset.user };
      return true;
    }
    if (action === 'hto-confirm-cancel') {
      ui.confirm = null;
      return true;
    }
    if (action === 'hto-confirm-ok') {
      try {
        const c = ui.confirm;
        if (c.kind === 'revoke') {
          engine().revokeGrant(c.id, actor, 'إلغاء تعيين من إدارة فريق العمل');
          toast?.('تم إلغاء التعيين وسحب صلاحيات النظام.');
        } else if (c.kind === 'suspend') {
          engine().suspendIdentity(c.id, actor, 'إيقاف من إدارة فريق العمل');
          toast?.('تم إيقاف الوصول.');
        } else if (c.kind === 'sensitive') {
          if (ui.wizard) {
            ui.wizard.sensitiveOk = true;
            ui.wizard.step = Math.min(5, ui.wizard.step + 1);
          }
        }
      } catch (e) {
        toast?.(e.message || 'تعذر إكمال العملية');
      }
      ui.confirm = null;
      return true;
    }
    if (action === 'hto-reactivate') {
      try {
        engine().reactivateIdentity(btn.dataset.id, actor, 'إعادة تفعيل');
        toast?.('تمت إعادة تفعيل الوصول.');
      } catch (e) {
        toast?.(e.message || 'تعذر إعادة التفعيل');
      }
      return true;
    }
    if (action === 'hto-success-close') {
      ui.success = null;
      ui.tab = 'team';
      return true;
    }
    return false;
  };

  const allowedPanelsForUser = (hubUser) => {
    if (!hubUser || !window.HubAccessGov) return null;
    if (hubUser.role === 'supreme_leader' || hubUser.role === 'chief_engineer' || hubUser.role === 'platform_owner') return null;
    const identity = engine().findIdentity(hubUser.naioshId || hubUser.email || hubUser.id);
    if (!identity) return null;
    if (identity.status === 'suspended') return new Set(['overview']);
    const detail = engine().effectiveAccess(identity.naioshId);
    const grants = (detail?.grants || []).filter((g) => String(g.status).toUpperCase() === 'ACTIVE');
    if (!grants.length) return null;
    if (grants.some((g) => g.roleCode === 'SUPER_ADMIN' || (g.permissions || []).includes('access_governance.manage'))) return null;
    const panels = new Set(['overview']);
    grants.forEach((g) => {
      (PANEL_BY_SYSTEM[g.system] || PANEL_BY_SYSTEM.HUB).forEach((p) => panels.add(p));
      if ((g.permissions || []).includes('access_governance.manage') || (g.permissions || []).includes('roles.assign')) {
        panels.add('roles-permissions');
      }
    });
    return panels;
  };

  window.HubTeamOpsUI = {
    render,
    handle,
    afterPaint,
    ui,
    OPS_ROLES,
    PANEL_BY_SYSTEM,
    allowedPanelsForUser,
    authorizeAction: (hubUser, permission, system) => {
      if (!window.HubAccessGov) return { decision: 'ALLOW', reason: 'NO_ENGINE' };
      if (hubUser?.role === 'supreme_leader' || hubUser?.role === 'chief_engineer') return { decision: 'ALLOW', reason: 'LEGACY_ADMIN' };
      return engine().authorize({
        naioshId: hubUser?.naioshId || hubUser?.email,
        email: hubUser?.email,
        permission,
        system: system || 'HUB',
      });
    },
  };
})();
