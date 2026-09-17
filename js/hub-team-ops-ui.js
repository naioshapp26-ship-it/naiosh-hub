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
    drawerMode: 'overview', // overview | perms
    wizard: null,
    form: null,
    confirm: null,
    success: null,
    pendingSensitive: null,
  };

  const bindFormsApi = () => {
    window.__htoFormsApi = {
      esc,
      store,
      engine,
      systems,
      allPositions,
      allRoles,
      allPerms,
      permLabel,
      actorOf: (user) => user?.name || user?.email || 'مشغّل هوب',
      toast: (...args) => window.__htoCtx?.toast?.(...args),
      user: () => window.__htoCtx?.user,
    };
  };

  const OPS_ROLES = null; // يُستبدل بكتالوج الأدوار الكامل من المخزن

  const allRoles = () => (store().roles || []).filter((r) => r.status !== 'archived' && r.code !== 'PLATFORM_CUSTOMER');
  const allPerms = () => (store().permissions || []).filter((p) => p.status !== 'inactive');
  const allPositions = () => (store().positions || []).filter((p) => p.status !== 'archived' && p.code !== 'CUSTOMER_POS');
  const classAr = (c) => ({ independent: 'نظام مستقل', sub: 'نظام فرعي', umbrella: 'نظام رئيسي', main: 'نظام رئيسي' }[c] || c || '—');

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
      'identity',
      'rent-admin',
    ],
    CRM: ['clients-mgmt', 'posha-clients', 'overview'],
    POSHA: ['posha-clients', 'clients-mgmt', 'overview'],
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
    if (window.HubFormat?.formatDateTime) return window.HubFormat.formatDateTime(iso);
    try {
      return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', numberingSystem: 'latn' });
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
    const r = (store().roles || []).find((x) => x.code === code);
    if (!r) return code || '—';
    if (r.code === 'SUPER_ADMIN') return 'المدير الأعلى';
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
    const role = (store().roles || []).find((r) => r.code === roleCode);
    const rolePerms = role?.permissions || [];
    const sysPool = SYSTEM_POOLS[systemCode] || [];
    const catalog = allPerms().map((p) => p.code);
    const byHint = allPerms()
      .filter((p) => !p.systemHint || p.systemHint === systemCode || systemCode === 'HUB')
      .map((p) => p.code);
    const merged = [...new Set([...rolePerms, ...sysPool, ...byHint.slice(0, 80), ...catalog.filter((c) => rolePerms.includes(c))])];
    return merged.length ? merged : catalog.slice(0, 40);
  };

  const primaryGrant = (identity) => {
    const grants = (store().grants || []).filter((g) => g.identityId === identity.id && String(g.status).toUpperCase() === 'ACTIVE');
    return grants[0] || null;
  };

  const empNoOf = (u) => u?.employeeNo || '—';

  const isEmployee = (u) => window.HubAccessGov?.isEmployeeIdentity?.(u) || (u?.userType === 'STAFF' && !!u?.employeeNo && u.status !== 'archived');

  const matchIdentityQ = (u, q) => {
    const needle = String(q || '').trim().toLowerCase();
    if (!needle) return true;
    return [u.name, u.email, u.naioshId, u.employeeNo].some((x) => String(x || '').toLowerCase().includes(needle));
  };

  const teamRows = () => {
    // الموظفون فقط — لا عملاء المنصة
    let people = (store().identities || []).filter((u) => isEmployee(u));
    const q = String(ui.q || '').trim().toLowerCase();
    if (q) people = people.filter((u) => matchIdentityQ(u, q));
    if (ui.filters.status) people = people.filter((u) => u.status === ui.filters.status);
    if (ui.filters.system || ui.filters.role) {
      people = people.filter((u) => {
        const grants = (store().grants || []).filter((g) => g.identityId === u.id && String(g.status).toUpperCase() === 'ACTIVE');
        if (ui.filters.role === '__none__') return !grants.length;
        if (!grants.length) return false;
        if (ui.filters.system && !grants.some((g) => g.system === ui.filters.system)) return false;
        if (ui.filters.role && ui.filters.role !== '__none__' && !grants.some((g) => g.roleCode === ui.filters.role)) return false;
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

  const clearFloat = () => {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.hto-float-menu').forEach((el) => el.remove());
  };

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
    bindFormsApi();
    window.HubTeamOpsForms?.afterPaintForm?.(ui);
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
    if (!g) {
      return `<div class="hto-actions">
        <button type="button" class="hto-btn hto-btn-sm hto-btn-primary" data-action="hto-wizard-open" data-user="${esc(u.naioshId)}">تعيين</button>
        <button type="button" class="hto-btn hto-btn-sm" data-action="hto-view" data-id="${esc(u.naioshId)}">عرض</button>
        <button type="button" class="hto-btn hto-btn-sm" data-action="hto-edit-grant" data-id="${esc(u.naioshId)}" data-gid="">تعديل</button>
      </div>`;
    }
    return `<div class="hto-actions">
      <button type="button" class="hto-btn hto-btn-sm" data-action="hto-view" data-id="${esc(u.naioshId)}">عرض</button>
      <button type="button" class="hto-btn hto-btn-sm" data-action="hto-edit-grant" data-id="${esc(u.naioshId)}" data-gid="${esc(g?.grantId || '')}">تعديل</button>
      <button type="button" class="hto-btn hto-btn-sm" data-action="hto-perms" data-id="${esc(u.naioshId)}">الصلاحيات</button>
      <div class="hto-more ${open ? 'is-open' : ''}">
        <button type="button" class="hto-btn hto-btn-sm" data-action="hto-menu" data-id="${esc(u.naioshId)}" title="المزيد" aria-label="المزيد">⋮</button>
        <div class="hto-more-menu">
          <button type="button" data-action="hto-edit-grant" data-id="${esc(u.naioshId)}" data-gid="${esc(g?.grantId || '')}">تغيير التعيين</button>
          ${
            u.status === 'suspended'
              ? `<button type="button" data-action="hto-reactivate" data-id="${esc(u.naioshId)}">إعادة التفعيل</button>`
              : `<button type="button" data-action="hto-confirm" data-kind="suspend" data-id="${esc(u.naioshId)}">إيقاف الوصول</button>`
          }
          <button type="button" data-action="hto-confirm" data-kind="revoke" data-id="${esc(g.grantId)}" data-user="${esc(u.name)}">إلغاء التعيين</button>
          <button type="button" data-action="hto-copy-emp" data-emp="${esc(u.employeeNo || '')}">نسخ رقم الموظف</button>
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
          <button type="button" class="hto-btn hto-btn-primary" data-action="hto-add-employee">+ إضافة موظف</button>
        </div>
        <div class="hto-toolbar">
          <input type="search" id="hto-q" value="${esc(ui.q)}" placeholder="ابحث بالاسم أو رقم الموظف أو رقم نايوش أو البريد" />
          <select id="hto-f-sys"><option value="">النظام: الكل</option>${sysOpts.map((s) => `<option value="${esc(s.code)}" ${ui.filters.system === s.code ? 'selected' : ''}>${esc(s.nameAr)}</option>`).join('')}</select>
          <select id="hto-f-role"><option value="">الدور: الكل</option>${allRoles().map((r) => `<option value="${esc(r.code)}" ${ui.filters.role === r.code ? 'selected' : ''}>${esc(r.nameAr)}</option>`).join('')}</select>
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
            ? `<div class="hto-table-wrap"><table class="hto-table hto-table-team">
                <thead><tr>
                  <th>الموظف</th><th>رقم الموظف</th><th>رقم نايوش</th><th>مكان العمل</th><th>النظام</th><th>الدور</th><th>الصلاحيات</th><th>الحالة</th><th>آخر تعديل</th><th>الإجراءات</th>
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
                      <td data-label="رقم الموظف" class="hto-nowrap">
                        ${
                          u.employeeNo
                            ? `<button type="button" class="hto-emp-link" data-action="hto-view" data-id="${esc(u.naioshId)}" title="فتح ملف الموظف"><code class="hto-emp">${esc(u.employeeNo)}</code></button>`
                            : '—'
                        }
                      </td>
                      <td data-label="رقم نايوش" class="hto-nowrap"><code>${esc(u.naioshId)}</code></td>
                      <td data-label="مكان العمل">${esc(g?.positionCode ? allPositions().find((p) => p.code === g.positionCode)?.nameAr || g.positionCode : '—')}</td>
                      <td data-label="النظام">${esc(g ? labelSys(g.system) : '—')}</td>
                      <td data-label="الدور"><span class="hto-chip">${esc(g ? labelRole(g.roleCode) : 'بدون تعيين')}</span></td>
                      <td data-label="الصلاحيات">${g ? `${perms.length} صلاحيات` : 'لا توجد صلاحيات'}</td>
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
                <button type="button" class="hto-btn hto-btn-primary" data-action="hto-add-employee">+ إضافة أول موظف</button>
              </div>`
        }
      </section>`;
  };

  const renderSystems = () => {
    const q = String(ui.q || '').trim().toLowerCase();
    let rows = systems().slice();
    if (q) rows = rows.filter((s) => [s.code, s.nameAr, s.classification, s.parentCode].some((x) => String(x || '').toLowerCase().includes(q)));
    const grants = store().grants || [];
    const roles = store().roles || [];
    const perms = store().permissions || [];
    return `<section class="hto-panel">
      <div class="hto-panel-head">
        <div><h3>الأنظمة</h3><p>أنظمة تشغيل ديناميكية — مستقلة أو فرعية — قابلة للإضافة والتعيين عليها.</p></div>
        <div class="hto-actions">
          <button type="button" class="hto-btn" data-action="hto-add-workplace">+ إضافة مكان عمل</button>
          <button type="button" class="hto-btn hto-btn-primary" data-action="hto-add-system">+ إضافة نظام</button>
        </div>
      </div>
      <div class="hto-toolbar">
        <input type="search" id="hto-q" value="${esc(ui.q)}" placeholder="ابحث عن نظام…" />
        <button type="button" class="hto-btn" data-action="hto-apply">تطبيق</button>
      </div>
      <div class="hto-table-wrap"><table class="hto-table">
        <thead><tr><th>رمز النظام</th><th>اسم النظام</th><th>التصنيف</th><th>النظام الأب</th><th>الموظفون</th><th>الأدوار</th><th>الصلاحيات</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
        <tbody>${
          rows.length
            ? rows
                .map((s) => {
                  const empN = new Set(grants.filter((g) => g.system === s.code && String(g.status).toUpperCase() === 'ACTIVE').map((g) => g.identityId)).size;
                  const roleN = roles.filter((r) => (r.applicableSystems || []).includes(s.code)).length;
                  const permN = perms.filter((p) => !p.systemHint || p.systemHint === s.code).length;
                  return `<tr>
                    <td data-label="الرمز"><code>${esc(s.code)}</code></td>
                    <td data-label="الاسم"><strong>${esc(s.nameAr)}</strong></td>
                    <td data-label="التصنيف">${esc(classAr(s.classification))}</td>
                    <td data-label="الأب">${esc(s.parentCode ? labelSys(s.parentCode) : '—')}</td>
                    <td data-label="الموظفون">${empN}</td>
                    <td data-label="الأدوار">${roleN}</td>
                    <td data-label="الصلاحيات">${permN}</td>
                    <td data-label="الحالة">${badge(s.status === 'active' ? 'فعال' : 'موقوف', s.status === 'active' ? 'is-ok' : 'is-warn')}</td>
                    <td data-label="الإجراءات" class="hto-actions">
                      <button type="button" class="hto-btn hto-btn-sm" data-action="hto-edit-system" data-code="${esc(s.code)}">تعديل</button>
                      <button type="button" class="hto-btn hto-btn-sm" data-action="hto-toggle-system" data-code="${esc(s.code)}" data-next="${s.status === 'active' ? 'inactive' : 'active'}">${s.status === 'active' ? 'إيقاف' : 'تفعيل'}</button>
                    </td>
                  </tr>`;
                })
                .join('')
            : '<tr><td colspan="9">لا أنظمة مطابقة.</td></tr>'
        }</tbody>
      </table></div>
      <p class="hto-muted">الإجمالي الحقيقي: ${systems().length} نظامًا</p>
      <div class="hto-panel-head" style="margin-top:24px">
        <div><h3>أماكن / مستويات العمل</h3><p>كتالوج ديناميكي لأماكن العمل والمستويات التنظيمية.</p></div>
        <button type="button" class="hto-btn hto-btn-primary" data-action="hto-add-workplace">+ إضافة مكان عمل</button>
      </div>
      <div class="hto-table-wrap"><table class="hto-table">
        <thead><tr><th>الرمز</th><th>الاسم</th><th>النوع</th><th>الأب</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
        <tbody>${
          allPositions().length
            ? allPositions()
                .map(
                  (p) => `<tr>
                    <td><code>${esc(p.code)}</code></td>
                    <td><strong>${esc(p.nameAr)}</strong></td>
                    <td>${esc(p.orgLevel || '—')}</td>
                    <td>${esc(p.parentEntity || '—')}</td>
                    <td>${badge(p.status === 'active' || !p.status ? 'نشط' : 'موقوف', p.status === 'inactive' ? 'is-warn' : 'is-ok')}</td>
                    <td><button type="button" class="hto-btn hto-btn-sm" data-action="hto-edit-workplace" data-code="${esc(p.code)}">تعديل</button></td>
                  </tr>`
                )
                .join('')
            : '<tr><td colspan="6">لا أماكن عمل مسجلة.</td></tr>'
        }</tbody>
      </table></div>
    </section>`;
  };

  const renderRoles = () => {
    const grants = store().grants || [];
    const q = String(ui.q || '').trim().toLowerCase();
    let roles = allRoles();
    if (q) roles = roles.filter((r) => [r.code, r.nameAr, r.level].some((x) => String(x || '').toLowerCase().includes(q)));
    if (ui.filters.system) roles = roles.filter((r) => (r.applicableSystems || []).includes(ui.filters.system));
    const pages = Math.max(1, Math.ceil(roles.length / ui.pageSize) || 1);
    ui.page = Math.min(ui.page, pages);
    const start = (ui.page - 1) * ui.pageSize;
    const pageRows = roles.slice(start, start + ui.pageSize);
    return `<section class="hto-panel">
      <div class="hto-panel-head">
        <div><h3>الأدوار</h3><p>كتالوج الأدوار الكامل من المصدر الأساسي مع إمكانية إضافة أدوار جديدة.</p></div>
        <button type="button" class="hto-btn hto-btn-primary" data-action="hto-add-role">+ إضافة دور</button>
      </div>
      <div class="hto-toolbar">
        <input type="search" id="hto-q" value="${esc(ui.q)}" placeholder="ابحث في الأدوار…" />
        <select id="hto-f-sys"><option value="">النظام: الكل</option>${systems().map((s) => `<option value="${esc(s.code)}" ${ui.filters.system === s.code ? 'selected' : ''}>${esc(s.nameAr)}</option>`).join('')}</select>
        <button type="button" class="hto-btn" data-action="hto-apply">تطبيق</button>
        <button type="button" class="hto-btn" data-action="hto-clear">مسح</button>
      </div>
      <div class="hto-table-wrap"><table class="hto-table">
        <thead><tr><th>رمز الدور</th><th>اسم الدور</th><th>المستوى</th><th>الأنظمة</th><th>الصلاحيات</th><th>الموظفون</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
        <tbody>${pageRows
          .map((r) => {
            const usersN = new Set(grants.filter((g) => g.roleCode === r.code && String(g.status).toUpperCase() === 'ACTIVE').map((g) => g.identityId)).size;
            const permN = (r.permissions || []).length;
            return `<tr>
              <td data-label="الرمز"><code>${esc(r.code)}</code></td>
              <td data-label="الاسم"><strong>${esc(r.nameAr)}</strong><div class="hto-muted">${esc(r.description || r.source || '')}</div></td>
              <td data-label="المستوى">${esc(r.level || '—')}</td>
              <td data-label="الأنظمة">${esc((r.applicableSystems || []).map(labelSys).join('، ') || '—')}</td>
              <td data-label="الصلاحيات">${permN}</td>
              <td data-label="الموظفون">${usersN}</td>
              <td data-label="الحالة">${badge(r.status === 'active' ? 'نشط' : 'موقوف', r.status === 'active' ? 'is-ok' : 'is-warn')}</td>
              <td data-label="الإجراءات" class="hto-actions">
                <button type="button" class="hto-btn hto-btn-sm" data-action="hto-edit-role" data-code="${esc(r.code)}">تعديل</button>
                <button type="button" class="hto-btn hto-btn-sm" data-action="hto-role-view" data-code="${esc(r.code)}">عرض</button>
              </td>
            </tr>`;
          })
          .join('')}</tbody>
      </table></div>
      <div class="hto-pager"><span>عرض ${roles.length ? start + 1 : 0}–${Math.min(start + ui.pageSize, roles.length)} من ${roles.length}</span>
        <div class="hto-actions">
          <button type="button" class="hto-btn" data-action="hto-page" data-page="${ui.page - 1}" ${ui.page <= 1 ? 'disabled' : ''}>السابق</button>
          <button type="button" class="hto-btn" data-action="hto-page" data-page="${ui.page + 1}" ${ui.page >= pages ? 'disabled' : ''}>التالي</button>
        </div>
      </div>
    </section>`;
  };

  const renderPermissions = () => {
    const q = String(ui.q || '').trim().toLowerCase();
    let perms = allPerms();
    if (q) perms = perms.filter((p) => [p.code, p.nameAr, p.resource, p.action].some((x) => String(x || '').toLowerCase().includes(q)));
    if (ui.filters.system) {
      perms = perms.filter((p) => !p.systemHint || p.systemHint === ui.filters.system || p.resource === String(ui.filters.system).toLowerCase());
    }
    const grants = store().grants || [];
    const roles = store().roles || [];
    const pages = Math.max(1, Math.ceil(perms.length / ui.pageSize) || 1);
    ui.page = Math.min(ui.page, pages);
    const start = (ui.page - 1) * ui.pageSize;
    const pageRows = perms.slice(start, start + ui.pageSize);
    return `<section class="hto-panel">
      <div class="hto-panel-head">
        <div><h3>الصلاحيات</h3><p>كتالوج الصلاحيات الكامل من المصدر الأساسي — بدون اختصار.</p></div>
        <button type="button" class="hto-btn hto-btn-primary" data-action="hto-add-perm">+ إضافة صلاحية</button>
      </div>
      <div class="hto-toolbar">
        <input type="search" id="hto-q" value="${esc(ui.q)}" placeholder="ابحث في الصلاحيات…" />
        <select id="hto-f-sys"><option value="">النظام: الكل</option>${systems().map((s) => `<option value="${esc(s.code)}" ${ui.filters.system === s.code ? 'selected' : ''}>${esc(s.nameAr)}</option>`).join('')}</select>
        <button type="button" class="hto-btn" data-action="hto-apply">تطبيق</button>
      </div>
      <div class="hto-table-wrap"><table class="hto-table">
        <thead><tr><th>الرمز</th><th>اسم الصلاحية</th><th>القسم</th><th>العملية</th><th>الأدوار</th><th>الموظفون</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
        <tbody>${pageRows
          .map((p) => {
            const roleN = roles.filter((r) => (r.permissions || []).includes(p.code)).length;
            const empN = new Set(grants.filter((g) => (g.permissions || []).includes(p.code) && String(g.status).toUpperCase() === 'ACTIVE').map((g) => g.identityId)).size;
            return `<tr>
              <td data-label="الرمز"><code>${esc(p.code)}</code></td>
              <td data-label="الاسم"><strong>${esc(permLabel(p.code))}</strong></td>
              <td data-label="القسم">${esc(p.resource || '—')}</td>
              <td data-label="العملية">${esc(ACTION_AR[p.action] || p.action || '—')}</td>
              <td data-label="الأدوار">${roleN}</td>
              <td data-label="الموظفون">${empN}</td>
              <td data-label="الحالة">${badge(p.status === 'active' ? 'نشطة' : 'موقوفة', p.status === 'active' ? 'is-ok' : 'is-warn')}</td>
              <td data-label="الإجراءات" class="hto-actions">
                <button type="button" class="hto-btn hto-btn-sm" data-action="hto-edit-perm" data-code="${esc(p.code)}">تعديل</button>
                <button type="button" class="hto-btn hto-btn-sm" data-action="hto-confirm" data-kind="deactivate-perm" data-id="${esc(p.code)}" data-roles="${roleN}" data-emps="${empN}">إيقاف</button>
              </td>
            </tr>`;
          })
          .join('')}</tbody>
      </table></div>
      <div class="hto-pager"><span>عرض ${perms.length ? start + 1 : 0}–${Math.min(start + ui.pageSize, perms.length)} من ${perms.length}</span>
        <div class="hto-actions">
          <button type="button" class="hto-btn" data-action="hto-page" data-page="${ui.page - 1}" ${ui.page <= 1 ? 'disabled' : ''}>السابق</button>
          <button type="button" class="hto-btn" data-action="hto-page" data-page="${ui.page + 1}" ${ui.page >= pages ? 'disabled' : ''}>التالي</button>
        </div>
      </div>
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
      USER_CREATED: 'إضافة حساب',
      EMPLOYEE_REGISTERED: 'تسجيل / تعيين كموظف',
      USER_PROFILE_UPDATED: 'تعديل بيانات',
      IDENTITY_UPDATED: 'تعديل بيانات',
    };
    return `<section class="hto-panel">
      <div class="hto-panel-head"><div>
        <h3>سجل الصلاحيات</h3>
        <p>سجل رقابي لكل عمليات التعيين والمنح والسحب والإيقاف. لا يمكن تعديله أو حذفه من هذه الشاشة.</p>
      </div></div>
      <div class="hto-table-wrap"><table class="hto-table">
        <thead><tr><th>التاريخ</th><th>رقم الموظف</th><th>الموظف</th><th>العملية</th><th>النظام</th><th>الصلاحية / الدور</th><th>تم بواسطة</th><th>التفاصيل</th></tr></thead>
        <tbody>${
          rows.length
            ? rows
                .map((a) => {
                  const id = (store().identities || []).find(
                    (i) => i.naioshId === a.targetUser || i.employeeNo === a.employeeNo || i.id === a.identityId
                  );
                  const emp = a.employeeNo || id?.employeeNo || '—';
                  const name = a.targetName || id?.name || a.targetUser || '—';
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
                    <td data-label="رقم الموظف" class="hto-nowrap"><code class="hto-emp">${esc(emp)}</code></td>
                    <td data-label="الموظف">${esc(name)}</td>
                    <td data-label="العملية">${esc(actionAr[a.action] || a.action)}</td>
                    <td data-label="النظام">${esc(a.system ? labelSys(a.system) : '—')}</td>
                    <td data-label="الصلاحية" class="hto-ellipsis" title="${esc(permText)}">${esc(permText)}</td>
                    <td data-label="تم بواسطة">${esc(a.actor || '—')}</td>
                    <td data-label="التفاصيل" class="hto-ellipsis">${esc(a.reason || '—')}</td>
                  </tr>`;
                })
                .join('')
            : `<tr><td colspan="8" class="hto-empty">لا أحداث مسجّلة بعد.</td></tr>`
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
    const g = primaryGrant(identity) || grants[0];
    const pool = g ? poolFor(g.system, g.roleCode) : [];
    const granted = new Set(g?.permissions || []);
    const permRows = numberPerms(pool.length ? pool : [...granted]);

    if (ui.drawerMode === 'perms') {
      return `
      <div class="hto-drawer-backdrop" data-action="hto-drawer-close"></div>
      <aside class="hto-drawer" role="dialog" aria-label="صلاحيات الموظف">
        <header class="hto-drawer-head">
          <div>
            <h3>صلاحيات ${esc(identity.name)}</h3>
            <p class="hto-muted">رقم الموظف: <code class="hto-emp">${esc(empNoOf(identity))}</code> · رقم نايوش: ${esc(identity.naioshId)}</p>
          </div>
          <button type="button" class="hto-btn" data-action="hto-drawer-close">إغلاق</button>
        </header>
        <div class="hto-drawer-body">
          <p><strong>مكان العمل:</strong> ${esc(g?.positionCode ? allPositions().find((p) => p.code === g.positionCode)?.nameAr || g.positionCode : '—')}</p>
          <p><strong>النظام:</strong> ${esc(g ? labelSys(g.system) : '—')}</p>
          <p><strong>الدور:</strong> ${esc(g ? labelRole(g.roleCode) : '—')}</p>
          <div class="hto-table-wrap"><table class="hto-table">
            <thead><tr><th>رقم الصلاحية</th><th>الصلاحية</th><th>الحالة</th></tr></thead>
            <tbody>${
              permRows.length
                ? permRows
                    .map(
                      (p) => `<tr>
                      <td><code>${esc(p.num)}</code></td>
                      <td>${esc(p.label)}</td>
                      <td>${granted.has(p.code) ? badge('ممنوحة', 'is-ok') : badge('غير ممنوحة', 'is-muted')}</td>
                    </tr>`
                    )
                    .join('')
                : `<tr><td colspan="3" class="hto-empty">لا صلاحيات مرتبطة بهذا التعيين</td></tr>`
            }</tbody>
          </table></div>
        </div>
        <div class="hto-drawer-actions">
          <button type="button" class="hto-btn hto-btn-primary" data-action="hto-edit-grant" data-id="${esc(identity.naioshId)}" data-gid="${esc(g?.grantId || '')}">تعديل الصلاحيات</button>
          <button type="button" class="hto-btn" data-action="hto-view" data-id="${esc(identity.naioshId)}">العودة للتعيينات</button>
        </div>
      </aside>`;
    }

    return `
      <div class="hto-drawer-backdrop" data-action="hto-drawer-close"></div>
      <aside class="hto-drawer" role="dialog" aria-label="بيانات الموظف">
        <header class="hto-drawer-head">
          <div>
            <h3>بيانات الموظف وصلاحياته</h3>
            <p class="hto-muted">${esc(identity.name)}</p>
          </div>
          <button type="button" class="hto-btn" data-action="hto-drawer-close">إغلاق</button>
        </header>
        <div class="hto-drawer-body">
          <p><strong>رقم الموظف:</strong> <code class="hto-emp">${esc(empNoOf(identity))}</code>
            ${identity.employeeNo ? `<button type="button" class="hto-btn hto-btn-sm" data-action="hto-copy-emp" data-emp="${esc(identity.employeeNo)}">نسخ</button>` : ''}</p>
          <p><strong>رقم نايوش:</strong> ${esc(identity.naioshId)}</p>
          <p><strong>البريد:</strong> ${esc(identity.email || '—')}</p>
          <p><strong>الحالة:</strong> ${statusBadge(identity.status)}</p>
          <h4>تعيينات الموظف</h4>
          ${
            grants.length
              ? grants
                  .map((row) => {
                    const nums = numberPerms(row.permissions || []);
                    return `<article class="hto-card">
                      <strong>${esc(labelSys(row.system))}</strong>
                      <p>الدور: ${esc(labelRole(row.roleCode))} · ${statusBadge(row.status)}</p>
                      <p>${(row.permissions || []).length} صلاحيات: ${nums.map((p) => p.num).join('، ') || '—'}</p>
                      <div class="hto-actions" style="margin-top:8px">
                        <button type="button" class="hto-btn hto-btn-sm" data-action="hto-perms" data-id="${esc(identity.naioshId)}" data-gid="${esc(row.grantId)}">عرض الصلاحيات</button>
                        <button type="button" class="hto-btn hto-btn-sm" data-action="hto-edit-grant" data-id="${esc(identity.naioshId)}" data-gid="${esc(row.grantId)}">تعديل</button>
                        ${
                          String(row.status).toUpperCase() === 'ACTIVE'
                            ? `<button type="button" class="hto-btn hto-btn-sm" data-action="hto-confirm" data-kind="revoke" data-id="${esc(row.grantId)}" data-user="${esc(identity.name)}">إلغاء التعيين</button>`
                            : ''
                        }
                      </div>
                    </article>`;
                  })
                  .join('')
              : `<p class="hto-empty">لا تعيينات بعد — الحالة: بدون تعيين / لا توجد صلاحيات.
                  <button type="button" class="hto-btn hto-btn-primary" data-action="hto-wizard-open" data-user="${esc(identity.naioshId)}">تعيين الآن</button></p>`
          }
          <h4>سجل التغييرات</h4>
          <ul class="hto-perm-list">${
            (store().audit || [])
              .filter((a) => a.employeeNo === identity.employeeNo || a.targetUser === identity.naioshId || a.identityId === identity.id)
              .slice(0, 12)
              .map((a) => `<li>${esc(fmt(a.timestamp))} — ${esc(a.action)} — ${esc(a.actor || '')}</li>`)
              .join('') || '<li>لا أحداث بعد</li>'
          }</ul>
        </div>
        <div class="hto-drawer-actions">
          <button type="button" class="hto-btn" data-action="hto-edit-employee" data-id="${esc(identity.naioshId)}">تعديل البيانات</button>
          <button type="button" class="hto-btn" data-action="hto-perms" data-id="${esc(identity.naioshId)}">الصلاحيات</button>
          <button type="button" class="hto-btn" data-action="hto-edit-grant" data-id="${esc(identity.naioshId)}" data-gid="${esc(primaryGrant(identity)?.grantId || '')}">تعديل التعيين</button>
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
    const steps = ['تحديد الموظف', 'مكان العمل', 'الدور', 'الصلاحيات', 'المراجعة'];
    const users = store().identities || [];
    const qNeedle = String(w.userQ || w.empQ || '').trim();
    const filtered = qNeedle
      ? users.filter((row) => row.status !== 'archived' && matchIdentityQ(row, qNeedle))
      : users.filter((row) => isEmployee(row) || (w.naioshId && row.naioshId === w.naioshId));
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
              ? `<h4>تحديد الموظف</h4>
                 <p class="hto-lead">ابحث برقم الموظف أو الحساب الموجود. العملاء لا يظهرون في فريق العمل إلا بعد «تعيين كموظف» مع توليد رقم موظف فريد.</p>
                 <label class="hto-field-label">رقم الموظف</label>
                 <input id="hto-w-emp" value="${esc(w.empQ || '')}" placeholder="مثال: EMP-0003" />
                 <div class="hto-actions">
                   <button type="button" class="hto-btn hto-btn-primary" data-action="hto-wizard-find-emp">بحث برقم الموظف</button>
                 </div>
                 <label class="hto-field-label">أو ابحث عن شخص موجود (موظف أو حساب نايوش)</label>
                 <input id="hto-w-q" value="${esc(w.userQ || '')}" placeholder="ابحث بالاسم / رقم نايوش / رقم الموظف / البريد" />
                 <div class="hto-actions">
                   <button type="button" class="hto-btn" data-action="hto-wizard-search">بحث</button>
                   <button type="button" class="hto-btn" data-action="hto-add-employee">+ تسجيل موظف جديد</button>
                 </div>
                 ${
                   u
                     ? `<div class="hto-summary">
                          <p><strong>المحدد:</strong> ${esc(u.name)}</p>
                          <p><strong>رقم الموظف:</strong> <code class="hto-emp">${esc(empNoOf(u))}</code></p>
                          <p><strong>رقم نايوش:</strong> ${esc(u.naioshId)}</p>
                          <p><strong>البريد:</strong> ${esc(u.email || '—')}</p>
                          <p><strong>النوع:</strong> ${isEmployee(u) ? 'موظف' : 'حساب موجود — يحتاج تعيين كموظف'}</p>
                          ${
                            !isEmployee(u)
                              ? `<button type="button" class="hto-btn hto-btn-primary" data-action="hto-promote-employee" data-id="${esc(u.naioshId)}">تعيين كموظف (توليد رقم موظف)</button>`
                              : ''
                          }
                        </div>`
                     : ''
                 }
                 <div class="hto-pick-list">${
                   filtered.slice(0, 50).map(
                     (row) => `<button type="button" class="hto-pick ${w.naioshId === row.naioshId ? 'is-on' : ''}" data-action="hto-wizard-pick-user" data-id="${esc(row.naioshId)}">
                       <span class="hto-avatar">${esc((row.name || '?').slice(0, 1))}</span>
                       <span><strong>${esc(row.name)}</strong><small>${esc(isEmployee(row) ? empNoOf(row) : 'ليس موظفًا بعد')} · ${esc(row.naioshId)} · ${esc(row.email || '')}</small></span>
                       <em>${isEmployee(row) ? 'موظف' : 'حساب'}</em>
                     </button>`
                   ).join('') || '<p class="hto-empty">لا مستخدمين مطابقين</p>'
                 }</div>`
              : ''
          }
          ${
            w.step === 2
              ? `<h4>مكان العمل والنظام</h4>
                 <p class="hto-lead">اختر مستوى/مكان العمل ثم النظام التشغيلي الذي سيعمل عليه الموظف.</p>
                 <h5>مكان / مستوى العمل</h5>
                 <div class="hto-pick-list">${allPositions()
                   .map(
                     (p) => `<button type="button" class="hto-pick ${w.positionCode === p.code ? 'is-on' : ''}" data-action="hto-wizard-pick-pos" data-code="${esc(p.code)}">
                       <span><strong>${esc(p.nameAr)}</strong><small>${esc(p.orgLevel || '')}</small></span>
                     </button>`
                   )
                   .join('')}</div>
                 <h5>النظام</h5>
                 <div class="hto-pick-list">${systems()
                   .map(
                     (s) => `<button type="button" class="hto-pick ${w.system === s.code ? 'is-on' : ''}" data-action="hto-wizard-pick-sys" data-code="${esc(s.code)}">
                       <span><strong>${esc(s.nameAr)}</strong><small>${esc(classAr(s.classification))}${s.parentCode ? ` · يتبع ${labelSys(s.parentCode)}` : ''}</small></span>
                     </button>`
                   )
                   .join('')}</div>`
              : ''
          }
          ${
            w.step === 3
              ? `<h4>ما دور الموظف؟</h4>
                 <p class="hto-lead">يُعرض كل الأدوار المسجّلة المتوافقة مع مكان العمل والنظام المختار — بدون قائمة ثابتة.</p>
                 <div class="hto-pick-list">${(allRoles().filter((r) => {
                   if (w.system && (r.applicableSystems || []).length && !(r.applicableSystems || []).includes(w.system)) return false;
                   if (w.positionCode && (r.eligiblePositions || []).length && !(r.eligiblePositions || []).includes(w.positionCode)) return false;
                   return true;
                 }).length
                   ? allRoles()
                       .filter((r) => {
                         if (w.system && (r.applicableSystems || []).length && !(r.applicableSystems || []).includes(w.system)) return false;
                         if (w.positionCode && (r.eligiblePositions || []).length && !(r.eligiblePositions || []).includes(w.positionCode)) return false;
                         return true;
                       })
                       .map(
                         (r) => `<button type="button" class="hto-pick ${w.roleCode === r.code ? 'is-on' : ''}" data-action="hto-wizard-pick-role" data-code="${esc(r.code)}">
                     <span><strong>${esc(r.nameAr)}</strong><small>${esc(r.description || (r.applicableSystems || []).map(labelSys).join(' · ') || r.level || '')}</small></span>
                   </button>`
                       )
                       .join('')
                   : '<p class="hto-empty">لا أدوار مطابقة للنظام/مكان العمل — أضف دورًا من تبويب الأدوار أو اختر نظامًا آخر.</p>')}</div>`
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
                      <p><strong>رقم الموظف:</strong> <code class="hto-emp">${esc(empNoOf(u))}</code></p>
                      <p><strong>رقم نايوش:</strong> ${esc(w.naioshId)}</p>
                      <p><strong>مكان العمل:</strong> ${esc(allPositions().find((p) => p.code === w.positionCode)?.nameAr || w.positionCode || '—')}</p>
                      <p><strong>النظام:</strong> ${esc(labelSys(w.system))}</p>
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
          ${w.step === 5 ? `<button type="button" class="hto-btn hto-btn-primary" data-action="hto-wizard-submit">${w.editGrantId ? 'حفظ الصلاحيات' : 'تأكيد التعيين'}</button>` : ''}
        </footer>
      </div>
    </div>`;
  };

  const renderConfirm = () => {
    if (!ui.confirm) return '';
    const c = ui.confirm;
    let title = 'تأكيد';
    let body = '';
    let primary = 'تأكيد';
    let altAction = '';
    if (c.kind === 'revoke') {
      title = 'تأكيد إلغاء التعيين';
      body = `سيتم إزالة ${esc(c.user || 'الموظف')} من هذا النظام وسحب الصلاحيات المرتبطة بهذا التعيين. لن يتم حذف حساب نايوش الخاص به.`;
    } else if (c.kind === 'suspend') {
      title = 'تأكيد إيقاف الوصول';
      body = 'سيتم إيقاف وصول هذا الموظف مؤقتًا مع الاحتفاظ بالتعيين والصلاحيات لإمكانية إعادة التفعيل.';
    } else if (c.kind === 'sensitive') {
      title = 'صلاحية إدارية حساسة';
      body = `هذه صلاحية إدارية حساسة (${esc(permLabel(c.code))}). منحها يسمح للموظف بتنفيذ عمليات مؤثرة داخل النظام.`;
    } else if (c.kind === 'disable-system') {
      title = 'إيقاف النظام؟';
      body = `هل تريد إيقاف النظام «${esc(c.name || c.id)}»؟ لن يظهر في قوائم التعيين الجديدة ويمكن إعادة تفعيله لاحقًا.`;
      primary = 'إيقاف النظام';
    } else if (c.kind === 'deactivate-perm') {
      const roles = Number(c.roles || 0);
      const emps = Number(c.emps || 0);
      title = 'هل تريد حذف هذه الصلاحية؟';
      body = `هذه الصلاحية مرتبطة بـ ${roles} أدوار و${emps} موظفًا. الحذف المباشر قد يكسر علاقات موجودة — يُفضَّل إيقاف الصلاحية بدلًا من حذفها.`;
      primary = 'إيقاف الصلاحية';
      altAction = `<button type="button" class="hto-btn" data-action="hto-confirm-cancel">إلغاء</button>`;
    } else if (c.kind === 'delete-perm') {
      title = 'تأكيد حذف الصلاحية';
      body = 'سيتم حذف الصلاحية من الكتالوج. إذا كانت مرتبطة بأدوار أو موظفين لن يُنفَّذ الحذف.';
    }
    return `<div class="hto-modal"><div class="hto-modal-card">
      <header><h3>${esc(title)}</h3><button type="button" class="hto-modal-x" data-action="hto-confirm-cancel" aria-label="إغلاق">×</button></header>
      <div class="hto-wizard-body"><p>${body}</p></div>
      <footer>
        ${altAction || `<button type="button" class="hto-btn" data-action="hto-confirm-cancel">إلغاء</button>`}
        <button type="button" class="hto-btn hto-btn-primary" data-action="hto-confirm-ok">${esc(primary)}</button>
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
      ['systems', 'الأنظمة'],
      ['roles', 'الأدوار'],
      ['permissions', 'الصلاحيات'],
      ['audit', 'سجل الصلاحيات'],
    ];
    let body = '';
    if (ui.tab === 'team') body = renderTeam();
    else if (ui.tab === 'systems') body = renderSystems();
    else if (ui.tab === 'roles') body = renderRoles();
    else if (ui.tab === 'permissions') body = renderPermissions();
    else body = renderAudit();

    const heroCta =
      ui.tab === 'systems'
        ? `<div class="hto-actions"><button type="button" class="hto-btn" data-action="hto-add-workplace">+ إضافة مكان عمل</button><button type="button" class="hto-btn hto-btn-primary" data-action="hto-add-system">+ إضافة نظام</button></div>`
        : ui.tab === 'roles'
          ? `<button type="button" class="hto-btn hto-btn-primary" data-action="hto-add-role">+ إضافة دور</button>`
          : ui.tab === 'permissions'
            ? `<button type="button" class="hto-btn hto-btn-primary" data-action="hto-add-perm">+ إضافة صلاحية</button>`
            : ui.tab === 'audit'
              ? ''
              : `<button type="button" class="hto-btn hto-btn-primary" data-action="hto-add-employee">+ إضافة موظف</button>`;

    const counts = {
      systems: systems().length,
      roles: allRoles().length,
      perms: allPerms().length,
      staff: (store().identities || []).filter((i) => isEmployee(i)).length,
    };

    bindFormsApi();
    return `
      <div class="hto-root" data-hto-root>
        <header class="hto-hero">
          <div>
            <h2>إدارة فريق العمل والصلاحيات</h2>
            <p>مركز ديناميكي: أنظمة ← أماكن عمل ← أدوار ← صلاحيات ← موظفون ← سجل.</p>
            <p class="hto-kpis-inline"><span>الأنظمة: <strong>${counts.systems}</strong></span> · <span>الأدوار: <strong>${counts.roles}</strong></span> · <span>الصلاحيات: <strong>${counts.perms}</strong></span> · <span>الموظفون: <strong>${counts.staff}</strong></span></p>
          </div>
          ${heroCta}
        </header>
        <nav class="hto-tabs" aria-label="أقسام الصفحة">${tabs.map(([id, label]) => `<button type="button" class="hto-tab ${ui.tab === id ? 'is-on' : ''}" data-action="hto-tab" data-tab="${id}">${esc(label)}</button>`).join('')}</nav>
        <div class="hto-main">${body}</div>
        ${renderDrawer()}${renderWizard()}${window.HubTeamOpsForms?.renderFormModal?.(ui) || ''}${renderConfirm()}${renderSuccess()}
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
    const permissions = w.permissions?.length ? w.permissions : defaultPermsFor(w.system, w.roleCode);
    const identity = engine().findIdentity(w.naioshId);
    const existingGrant = w.editGrantId
      ? (store().grants || []).find((g) => g.grantId === w.editGrantId || g.id === w.editGrantId)
      : null;

    const needsApproval = window.HubHigherApprovals?.requiresHigherManagerApproval?.({
      type: w.editGrantId ? 'role_change' : 'role_grant',
      roleCode: w.roleCode,
      permissions,
    });

    if (needsApproval && window.HubHigherApprovals?.enqueueRoleAssignment) {
      try {
        engine().registerEmployee({ naioshId: w.naioshId }, actor);
      } catch (_) {}
      const ticket = window.HubHigherApprovals.enqueueRoleAssignment(
        {
          naioshId: w.naioshId,
          subjectName: identity?.name || w.naioshId,
          subjectEmployeeNo: identity?.employeeNo || '',
          roleCode: w.roleCode,
          system: w.system || 'HUB',
          positionCode: w.positionCode || role?.eligiblePositions?.[0] || null,
          permissions,
          editGrantId: w.editGrantId || null,
          currentRoleCode: existingGrant?.roleCode || '',
          currentPermissions: existingGrant?.permissions || [],
          reason: w.editGrantId ? 'طلب تعديل تعيين يتطلب موافقة المدير الأعلى' : 'طلب تفعيل دور يتطلب موافقة المدير الأعلى',
          scopeCode: w.system === 'HUB' ? 'HUB-GLOBAL' : 'GLOBAL',
          governanceLevel: w.system === 'HUB' ? 'HUB' : w.roleCode === 'SUPER_ADMIN' ? 'EMPIRE' : 'SYSTEM',
        },
        { name: actor, email: user?.email, employeeNo: user?.employeeNo, naioshId: user?.naioshId }
      );
      ui.success = {
        message: `لم يُنفَّذ التعيين بعد. أُنشئ طلب موافقة ${ticket.id} ويظهر في «موافقات المدير الأعلى».`,
        userId: w.naioshId,
      };
      ui.wizard = null;
      ui.tab = 'team';
      toast?.(`أُرسل طلب الموافقة ${ticket.id}`);
      return true;
    }

    try {
      // ضمان أن الهدف موظف برقم قبل حفظ التعيين
      engine().registerEmployee({ naioshId: w.naioshId }, actor);
      if (w.editGrantId) {
        engine().updateGrant(
          w.editGrantId,
          {
            roleCode: w.roleCode,
            system: w.system,
            positionCode: w.positionCode || role?.eligiblePositions?.[0] || null,
            permissions,
            reason: 'تعديل تعيين من إدارة فريق العمل',
          },
          actor
        );
        const name = engine().findIdentity(w.naioshId)?.name || w.naioshId;
        const emp = engine().findIdentity(w.naioshId)?.employeeNo;
        ui.success = { message: `تم تحديث صلاحيات ${name}${emp ? ` (${emp})` : ''} بنجاح.`, userId: w.naioshId };
        toast?.('تم تحديث الصلاحيات بنجاح.');
      } else {
        engine().createGrant(
          {
            naioshId: w.naioshId,
            positionCode: w.positionCode || role?.eligiblePositions?.[0] || null,
            roleCode: w.roleCode,
            system: w.system || 'HUB',
            scopeCode: w.system === 'HUB' ? 'HUB-GLOBAL' : 'GLOBAL',
            permissions,
            purpose: 'تعيين من إدارة فريق العمل',
            governanceLevel: w.system === 'HUB' ? 'HUB' : w.roleCode === 'SUPER_ADMIN' ? 'EMPIRE' : 'SYSTEM',
          },
          actor
        );
        const id = engine().findIdentity(w.naioshId);
        ui.success = {
          message: `تم تعيين ${id?.name || w.naioshId} بنجاح.${id?.employeeNo ? ` رقم الموظف: ${id.employeeNo}` : ''}`,
          userId: w.naioshId,
        };
        toast?.('تم تعيين الموظف بنجاح.');
      }
      ui.selectedUser = w.naioshId;
      ui.drawerMode = 'overview';
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
    bindFormsApi();
    window.__htoFormsApi.toast = toast;
    window.__htoFormsApi.user = () => user;
    window.__htoFormsApi.engine = engine;
    if (action !== 'hto-menu') {
      ui.openMenu = null;
      clearFloat();
    }

    if (window.HubTeamOpsForms?.handleFormAction?.(action, btn, ui, ctx)) return true;

    if (action === 'hto-tab') {
      ui.tab = btn.dataset.tab || 'team';
      ui.page = 1;
      ui.q = '';
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
      ui.drawerMode = 'overview';
      ui.success = null;
      ui.tab = 'team';
      return true;
    }
    if (action === 'hto-perms') {
      ui.selectedUser = btn.dataset.id;
      ui.drawerMode = 'perms';
      ui.success = null;
      ui.tab = 'team';
      return true;
    }
    if (action === 'hto-copy-emp') {
      const emp = btn.dataset.emp || '';
      if (!emp) {
        toast?.('لا يوجد رقم موظف بعد');
        return true;
      }
      try {
        navigator.clipboard?.writeText?.(emp);
        toast?.(`تم نسخ رقم الموظف ${emp}`);
      } catch (_) {
        toast?.(emp);
      }
      return true;
    }
    if (action === 'hto-drawer-close') {
      ui.selectedUser = null;
      ui.drawerMode = 'overview';
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
        empQ: '',
        system: 'CRM',
        positionCode: '',
        roleCode: 'SYSTEM_MANAGER',
        permissions: [],
      };
      ui.tab = 'team';
      return true;
    }
    if (action === 'hto-wizard-close') {
      ui.wizard = null;
      return true;
    }
    if (action === 'hto-wizard-search') {
      ui.wizard.userQ = document.getElementById('hto-w-q')?.value || '';
      ui.wizard.empQ = document.getElementById('hto-w-emp')?.value || ui.wizard.empQ || '';
      return true;
    }
    if (action === 'hto-wizard-find-emp') {
      const empQ = String(document.getElementById('hto-w-emp')?.value || '').trim();
      ui.wizard.empQ = empQ;
      if (!empQ) {
        toast?.('أدخل رقم الموظف');
        return true;
      }
      const found = engine().findIdentity(empQ);
      if (!found) {
        toast?.('لا يوجد موظف بهذا الرقم');
        return true;
      }
      ui.wizard.naioshId = found.naioshId;
      ui.wizard.userQ = found.employeeNo || found.name;
      toast?.(`تم تحديد ${found.name} (${found.employeeNo || 'بدون رقم بعد'})`);
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
    if (action === 'hto-wizard-pick-pos') {
      ui.wizard.positionCode = btn.dataset.code;
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
      if (ui.wizard.step === 1) {
        if (!ui.wizard.naioshId) {
          toast?.('اختر موظفًا أولاً');
          return true;
        }
        const id = engine().findIdentity(ui.wizard.naioshId);
        if (!isEmployee(id)) {
          try {
            engine().registerEmployee({ naioshId: ui.wizard.naioshId }, actor);
            toast?.(`تم تعيينه كموظف برقم ${engine().findIdentity(ui.wizard.naioshId)?.employeeNo}`);
          } catch (e) {
            toast?.(e.message || 'يجب تعيينه كموظف قبل المتابعة');
            return true;
          }
        }
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
    if (action === 'hto-add-user' || action === 'hto-add-employee') {
      window.HubTeamOpsForms.openForm(ui, 'employee');
      ui.tab = 'team';
      return true;
    }
    if (action === 'hto-edit-employee') {
      const id = engine().findIdentity(btn.dataset.id);
      if (!id) return true;
      window.HubTeamOpsForms.openForm(ui, 'employee', {
        name: id.name,
        email: id.email,
        employeeNo: id.employeeNo,
        naioshId: id.naioshId,
        phone: id.phone || '',
        photo: id.photo || '',
      });
      return true;
    }
    if (action === 'hto-promote-employee') {
      try {
        const promoted = engine().registerEmployee({ naioshId: btn.dataset.id }, actor);
        if (!promoted?.employeeNo) throw new Error('لا يمكن حفظ موظف بدون رقم موظف');
        if (ui.wizard) {
          ui.wizard.naioshId = promoted.naioshId;
          ui.wizard.userQ = promoted.employeeNo;
        }
        toast?.(`تم تعيينه كموظف: ${promoted.employeeNo}`);
      } catch (e) {
        toast?.(e.message || 'تعذر التعيين كموظف');
      }
      return true;
    }
    if (action === 'hto-confirm') {
      ui.confirm = {
        kind: btn.dataset.kind,
        id: btn.dataset.id,
        user: btn.dataset.user,
        name: btn.dataset.name,
        roles: btn.dataset.roles,
        emps: btn.dataset.emps,
        code: btn.dataset.code,
      };
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
        } else if (c.kind === 'disable-system') {
          const cur = systems().find((s) => s.code === c.id);
          if (cur) engine().upsertManagedSystem({ ...cur, status: 'inactive' }, actor);
          toast?.('تم إيقاف النظام');
        } else if (c.kind === 'deactivate-perm' || c.kind === 'delete-perm') {
          const cur = (store().permissions || []).find((p) => p.code === c.id);
          if (cur) {
            engine().upsertPermission({ ...cur, system: cur.systemHint, status: 'inactive' }, actor);
            toast?.('تم إيقاف الصلاحية بدلًا من حذفها');
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
    if (action === 'hto-add-system') {
      window.HubTeamOpsForms.openForm(ui, 'system');
      return true;
    }
    if (action === 'hto-edit-system') {
      const cur = systems().find((s) => s.code === btn.dataset.code);
      if (!cur) return true;
      window.HubTeamOpsForms.openForm(ui, 'system', { ...cur });
      return true;
    }
    if (action === 'hto-toggle-system') {
      const code = btn.dataset.code;
      const next = btn.dataset.next || 'inactive';
      const cur = systems().find((s) => s.code === code);
      if (!cur) return true;
      if (next !== 'active') {
        ui.confirm = { kind: 'disable-system', id: code, name: cur.nameAr };
        return true;
      }
      try {
        engine().upsertManagedSystem({ ...cur, status: next }, actor);
        toast?.('تم تفعيل النظام');
      } catch (e) {
        toast?.(e.message || 'تعذر تغيير الحالة');
      }
      return true;
    }
    if (action === 'hto-add-role') {
      window.HubTeamOpsForms.openForm(ui, 'role');
      return true;
    }
    if (action === 'hto-edit-role') {
      const cur = (store().roles || []).find((r) => r.code === btn.dataset.code);
      if (!cur) return true;
      window.HubTeamOpsForms.openForm(ui, 'role', { ...cur, systems: cur.applicableSystems || [] });
      return true;
    }
    if (action === 'hto-add-perm') {
      window.HubTeamOpsForms.openForm(ui, 'permission');
      return true;
    }
    if (action === 'hto-edit-perm') {
      const cur = (store().permissions || []).find((p) => p.code === btn.dataset.code);
      if (!cur) return true;
      window.HubTeamOpsForms.openForm(ui, 'permission', {
        ...cur,
        system: cur.systemHint || '',
        directGrant: cur.directGrant === false ? 'no' : 'yes',
      });
      return true;
    }
    if (action === 'hto-add-workplace') {
      window.HubTeamOpsForms.openForm(ui, 'workplace');
      return true;
    }
    if (action === 'hto-edit-workplace') {
      const cur = (store().positions || []).find((p) => p.code === btn.dataset.code);
      if (!cur) return true;
      window.HubTeamOpsForms.openForm(ui, 'workplace', { ...cur });
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
    OPS_ROLES: allRoles,
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
