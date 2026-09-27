/**
 * هوية نايوش — سجل المستخدمين والهويات
 * Schema موحّد: إنشاء / تعديل / جدول / تفاصيل / فلاتر
 * مصدر الحقيقة: HubAccessGovStore عبر HubAccessGov
 */
(() => {
  'use strict';

  const SEC_KEY = 'naiosh_hub_identity_security_v1';
  const SSO_KEY = 'naiosh_hub_sso_registry_v1';

  /** Schema موحّد — مصدر واحد لكل العروض */
  const IDENTITY_SCHEMA = {
    name: { label: 'الاسم الكامل', required: true, inTable: 'user', inForm: 1 },
    naioshId: { label: 'رقم نايوش', auto: true, inTable: 'ids' },
    email: { label: 'البريد الإلكتروني', required: true, inTable: 'user', inForm: 1 },
    phone: { label: 'الهاتف', inForm: 1, inDetail: true },
    country: { label: 'الدولة', inForm: 1, inDetail: true },
    userKind: { label: 'نوع المستخدم', required: true, inTable: 'kind', inForm: 1 },
    status: { label: 'الحالة', inTable: 'status', inForm: 1 },
    clientNo: { label: 'رقم العميل', auto: true, inTable: 'ids', inForm: 2 },
    employeeNo: { label: 'رقم الموظف', auto: true, inTable: 'ids', inForm: 2 },
    alsoCustomer: { label: 'صفة عميل إضافية', inForm: 2 },
    orgId: { label: 'معرّف المؤسسة', inForm: 3 },
    orgName: { label: 'المؤسسة / الجهة', inTable: 'org', inForm: 3 },
    branchName: { label: 'الفرع', inTable: 'org', inForm: 3 },
    department: { label: 'القسم', inTable: 'job', inForm: 3 },
    jobTitle: { label: 'المسمى الوظيفي', inTable: 'job', inForm: 3 },
    roleCode: { label: 'الدور', inTable: 'role', inForm: 4 },
    systems: { label: 'الأنظمة المسموح بها', inForm: 4 },
  };

  const esc = (v = '') =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fmt = (iso) => {
    if (!iso) return '—';
    try {
      if (window.HubFormat?.dateTime) return window.HubFormat.dateTime(iso);
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '—';
      const p = (n) => String(n).padStart(2, '0');
      const h = d.getHours();
      const ap = h >= 12 ? 'م' : 'ص';
      return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(h % 12 || 12)}:${p(d.getMinutes())} ${ap}`;
    } catch {
      return '—';
    }
  };

  const nowIso = () => new Date().toISOString();
  const ag = () => window.HubAccessGovStore?.get?.() || { identities: [], grants: [], roles: [], permissions: [], systems: [], managedSystems: [], audit: [], scopes: [] };
  const eng = () => window.HubAccessGov;
  const kinds = () => window.HubAccessGovStore?.USER_KINDS || {};

  const ui = {
    view: 'home',
    q: '',
    type: '',
    status: '',
    org: '',
    branch: '',
    department: '',
    role: '',
    openId: null,
    matrixEmp: '',
    matrixSystem: '',
    modal: null,
    note: '',
    addStep: 1,
    addDraft: null,
    menuId: null,
    editMode: false,
  };

  const loadJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const saveJson = (key, val) => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  };

  const secStore = () => {
    const s = loadJson(SEC_KEY, { byNaioshId: {} });
    if (!s.byNaioshId) s.byNaioshId = {};
    return s;
  };
  const saveSec = (s) => saveJson(SEC_KEY, s);
  const secOf = (naioshId) => secStore().byNaioshId[naioshId] || { mfaEnabled: false, mfaMethod: '', mfaEnabledAt: '', lastVerifiedAt: '', lastLoginAt: '' };
  const patchSec = (naioshId, patch) => {
    const s = secStore();
    s.byNaioshId[naioshId] = { ...secOf(naioshId), ...patch, updatedAt: nowIso() };
    saveSec(s);
    return s.byNaioshId[naioshId];
  };

  const defaultSso = () => {
    const systems = [];
    const seen = new Set();
    const push = (row) => {
      const code = String(row.code || '').toUpperCase();
      if (!code || seen.has(code)) return;
      seen.add(code);
      systems.push({
        id: `sso-${code}`,
        code,
        nameAr: row.nameAr || row.name || code,
        loginUrl: row.loginUrl || row.href || `sso-bridge.html?system=${encodeURIComponent(code)}`,
        linkedSystem: code,
        linkStatus: 'linked',
        ssoStatus: 'enabled',
        authMethod: 'hub-ticket',
        serviceStatus: 'active',
        lastConnectAt: '',
        lastLoginAt: '',
        notes: '',
        createdAt: nowIso(),
      });
    };
    push({ code: 'HUB', nameAr: 'نايوش هوب 360', loginUrl: 'dashboard.html' });
    (window.HubOpsCatalog?.listSystems?.() || []).forEach((s) => push({ code: s.code, nameAr: s.name || s.nameAr, loginUrl: s.href }));
    (ag().managedSystems || []).forEach((s) => push({ code: s.code, nameAr: s.nameAr || s.name, loginUrl: s.loginUrl }));
    (ag().systems || []).forEach((s) => (typeof s === 'string' ? push({ code: s, nameAr: s }) : push({ code: s.code, nameAr: s.nameAr || s.name })));
    return { schemaVersion: 1, systems };
  };
  const ssoStore = () => {
    let s = loadJson(SSO_KEY, null);
    if (!s || !Array.isArray(s.systems) || !s.systems.length) {
      s = defaultSso();
      saveJson(SSO_KEY, s);
    }
    return s;
  };
  const saveSso = (s) => saveJson(SSO_KEY, s);

  const clientNoOf = (id) => {
    if (id?.clientNo) return id.clientNo;
    try {
      const clients = window.HubStore?.clientsBag?.()?.clients || [];
      const hit = clients.find((c) => c.email && id.email && String(c.email).toLowerCase() === String(id.email).toLowerCase());
      return hit?.clientId || '';
    } catch {
      return '';
    }
  };

  const userKindAr = (id) => {
    const code = id?.userKind;
    if (code && kinds()[code]?.labelAr) return kinds()[code].labelAr;
    if (id?.userType === 'CUSTOMER' && !id?.employeeNo) return 'عميل';
    if (id?.employeeNo || id?.isEmployee) return 'موظف';
    return 'مستخدم';
  };

  const roleLabel = (code) => (ag().roles || []).find((r) => r.code === code)?.nameAr || code || '—';
  const primaryRolesOf = (id) => {
    const grants = (ag().grants || []).filter((g) => (g.naioshId === id.naioshId || g.identityId === id.id) && String(g.status).toUpperCase() === 'ACTIVE');
    return [...new Set(grants.map((g) => g.roleCode).filter(Boolean))];
  };
  const primaryRoleAr = (id) => {
    const roles = primaryRolesOf(id);
    return roles.length ? roles.map(roleLabel).join(' · ') : '—';
  };
  const primaryRoleCode = (id) => primaryRolesOf(id)[0] || '';

  const statusAr = (s) => ({ active: 'نشط', suspended: 'موقوف', archived: 'مؤرشف', revoked: 'ملغى' }[s] || s || '—');
  const dash = (v) => (String(v ?? '').trim() ? String(v).trim() : '—');

  const copyChip = (value, label) => {
    if (!value) return '';
    return `<span class="idn-chip" dir="ltr" title="${esc(label || value)}"><span class="idn-chip-k">${esc(label)}</span><code>${esc(value)}</code><button type="button" class="idn-copy" data-action="idn-copy" data-copy="${esc(value)}" title="نسخ">⧉</button></span>`;
  };

  const identities = () => (ag().identities || []).slice();
  const affOpts = () => eng()?.listAffiliationOptions?.() || { orgs: [], structure: [], branches: [], departments: [], roles: [], jobTitles: [], kinds: kinds() };

  const kindNeedsEmployee = (code) => !!(kinds()[code]?.needsEmployee);
  const kindNeedsOrg = (code) => !!(kinds()[code]?.needsOrg);
  const kindNeedsClient = (code, alsoCustomer) => code === 'CUSTOMER' || code === 'MEMBER' || !!alsoCustomer;

  const blankDraft = (from) => {
    if (from) {
      return {
        name: from.name || '',
        email: from.email || '',
        phone: from.phone || '',
        country: from.country || 'السعودية',
        userKind: from.userKind || (from.employeeNo ? 'INTERNAL' : 'CUSTOMER'),
        status: from.status || 'active',
        alsoCustomer: !!(from.clientNo && from.employeeNo),
        orgId: from.orgId || '',
        orgName: from.orgName || '',
        branchName: from.branchName || '',
        department: from.department || '',
        jobTitle: from.jobTitle || '',
        roleCode: primaryRoleCode(from) || 'HUB_EMPLOYEE',
        systems: (() => {
          const g = (ag().grants || []).filter((x) => x.naioshId === from.naioshId && String(x.status).toUpperCase() === 'ACTIVE');
          return [...new Set(g.map((x) => x.system).filter(Boolean))];
        })(),
        naioshId: from.naioshId || '',
        clientNo: clientNoOf(from) || '',
        employeeNo: from.employeeNo || '',
        editId: from.naioshId,
      };
    }
    return {
      name: '',
      email: '',
      phone: '',
      country: 'السعودية',
      userKind: 'INTERNAL',
      status: 'active',
      alsoCustomer: false,
      orgId: 'ORG-NAIOSH',
      orgName: 'نايوش',
      branchName: '',
      department: '',
      jobTitle: '',
      roleCode: 'HUB_EMPLOYEE',
      systems: ['HUB'],
      naioshId: '',
      clientNo: '',
      employeeNo: '',
      editId: '',
    };
  };

  const branchesForOrg = (orgName, orgId) => {
    const st = affOpts().structure || [];
    const hit = st.find((o) => o.name === orgName || o.id === orgId);
    return hit?.branches || [];
  };
  const deptsFor = (orgName, orgId, branchName) => {
    const br = branchesForOrg(orgName, orgId).find((b) => b.name === branchName);
    return br?.departments || [];
  };

  const filteredIdentities = () => {
    let rows = identities();
    if (ui.type) rows = rows.filter((i) => String(i.userKind || '') === ui.type);
    if (ui.status) rows = rows.filter((i) => String(i.status || 'active') === ui.status);
    if (ui.org) rows = rows.filter((i) => String(i.orgName || '') === ui.org || String(i.orgId || '') === ui.org);
    if (ui.branch) rows = rows.filter((i) => String(i.branchName || '') === ui.branch);
    if (ui.department) rows = rows.filter((i) => String(i.department || '') === ui.department);
    if (ui.role) rows = rows.filter((i) => primaryRolesOf(i).includes(ui.role));
    if (ui.q) {
      const q = ui.q.toLowerCase();
      rows = rows.filter((i) =>
        [i.name, i.naioshId, i.employeeNo, i.email, clientNoOf(i), i.orgName, i.branchName, i.department, i.jobTitle]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    return rows;
  };

  const liveKpis = () => {
    const rows = identities();
    const sec = secStore().byNaioshId;
    const mfaOn = rows.filter((i) => sec[i.naioshId]?.mfaEnabled).length;
    const sensitive = rows.filter((i) => {
      const grants = (ag().grants || []).filter((g) => g.naioshId === i.naioshId && String(g.status).toUpperCase() === 'ACTIVE');
      return grants.some((g) => ['SUPER_ADMIN', 'HUB_ADMIN'].includes(g.roleCode) || (g.permissions || []).includes('access_governance.manage'));
    });
    return {
      users: rows.length,
      staff: rows.filter((i) => i.employeeNo || i.isEmployee).length,
      customers: rows.filter((i) => !!clientNoOf(i)).length,
      orgs: rows.filter((i) => i.orgName).length,
      mfaOn,
      mfaOff: Math.max(0, rows.length - mfaOn),
      ssoSystems: ssoStore().systems.filter((s) => s.ssoStatus === 'enabled').length,
      sensitiveUnprotected: sensitive.filter((i) => !sec[i.naioshId]?.mfaEnabled).length,
      requireMfa: !!(window.HubStore?.get?.()?.settings?.requireMfa),
    };
  };

  const canManage = (user) => {
    try {
      if (!user) return false;
      const role = String(user.role || user.roleCode || '').toLowerCase();
      if (['customer', 'client', 'client_user', 'platform_customer'].includes(role)) return false;
      const r = String(user.role || user.roleCode || '').toUpperCase();
      if (['SUPER_ADMIN', 'HUB_ADMIN', 'SUPREME_LEADER', 'ADMIN'].includes(r) || role === 'supreme_leader') return true;
      const d = eng()?.authorize?.({ naioshId: user.naioshId || user.email, permission: 'users.view', system: 'HUB' });
      return d?.decision === 'ALLOW';
    } catch {
      return true;
    }
  };

  const cards = (k) => [
    { id: 'users', icon: 'fa-users', title: 'المستخدمون والهويات', desc: 'إدارة حسابات وهويات المستخدمين المرتبطين بنايوش والمؤسسات والفروع، ومعرفة جهة كل مستخدم ونوعه وحالة حسابه.', stat: `${k.users} هوية`, status: 'جاهز' },
    { id: 'sso', icon: 'fa-right-to-bracket', title: 'تسجيل الدخول الموحد', desc: 'إدارة الأنظمة المرتبطة بهوية واحدة — دون منح صلاحيات تلقائية.', stat: `${k.ssoSystems} نظام`, status: 'جاهز' },
    { id: 'mfa', icon: 'fa-shield-halved', title: 'التحقق الثنائي', desc: 'حالة التحقق الثنائي للحسابات والحسابات الحساسة غير المحمية.', stat: `${k.mfaOn} مفعّل`, status: k.requireMfa ? 'سياسة مفعّلة' : 'سياسة اختيارية' },
    { id: 'accounts', icon: 'fa-id-card', title: 'إدارة الحسابات', desc: 'إيقاف وإعادة تفعيل الوصول دون حذف الهويات المرتبطة.', stat: `${k.staff} موظف · ${k.customers} بصفة عميل`, status: 'جاهز' },
    { id: 'permissions', icon: 'fa-user-shield', title: 'إدارة الصلاحيات', desc: 'يفتح النظام المركزي المعتمد: إدارة فريق العمل والصلاحيات.', stat: 'مصدر واحد', status: 'مرتبط', href: '#roles-permissions' },
    { id: 'matrix', icon: 'fa-table-cells', title: 'مصفوفة الصلاحيات', desc: 'عرض وتحليل الصلاحيات الفعلية حسب الموظف والنظام والدور.', stat: 'من الحوكمة', status: 'جاهز' },
  ];

  const renderDenied = () => `<div class="idn-empty"><h3>غير مصرح</h3><p>هذه الوحدة للموظفين المخوّلين بإدارة الهوية فقط.</p></div>`;

  const renderHome = (k) => `
    <div class="idn-kpis">
      <article><span>الهويات</span><strong>${k.users}</strong></article>
      <article><span>بصفة موظف</span><strong>${k.staff}</strong></article>
      <article><span>بصفة عميل</span><strong>${k.customers}</strong></article>
      <article><span>مرتبطون بمؤسسة</span><strong>${k.orgs}</strong></article>
      <article class="${k.sensitiveUnprotected ? 'is-warn' : ''}"><span>حسابات حساسة بلا تحقق</span><strong>${k.sensitiveUnprotected}</strong></article>
    </div>
    <h2 class="idn-section-title">إدارة الهوية</h2>
    <p class="idn-section-sub">هوية موحّدة — الحساب والصفة والارتباط المؤسسي من هنا؛ الأدوار والصلاحيات من المصدر المركزي.</p>
    <div class="idn-cards">${cards(k)
      .map(
        (c) => `<article class="idn-card">
        <div class="idn-card-icon"><i class="fas ${c.icon}"></i></div>
        <div class="idn-card-body"><h3>${esc(c.title)}</h3><p>${esc(c.desc)}</p>
          <div class="idn-card-meta"><span>${esc(c.stat)}</span><span class="idn-pill">${esc(c.status)}</span></div></div>
        ${c.href ? `<a class="btn btn-primary btn-sm" href="${esc(c.href)}">فتح الإدارة</a>` : `<button type="button" class="btn btn-primary btn-sm" data-action="idn-view" data-view="${esc(c.id)}">فتح الإدارة</button>`}
      </article>`
      )
      .join('')}</div>`;

  const filterBranchOptions = () => {
    if (ui.org) return branchesForOrg(ui.org, ui.org).map((b) => b.name);
    return affOpts().branches || [];
  };
  const filterDeptOptions = () => {
    if (ui.org && ui.branch) return deptsFor(ui.org, ui.org, ui.branch);
    return affOpts().departments || [];
  };

  const filtersBar = (mode = 'users') => {
    const opts = affOpts();
    const show = mode === 'users' || mode === 'accounts';
    return `
    <div class="idn-toolbar idn-toolbar-main">
      <button type="button" class="btn btn-ghost btn-sm" data-action="idn-view" data-view="home"><i class="fas fa-arrow-right"></i> العودة</button>
      ${show ? `<button type="button" class="btn btn-primary btn-sm" data-action="idn-add-open"><i class="fas fa-plus"></i> إضافة مستخدم</button>` : ''}
      <input type="search" data-idn-q placeholder="بحث: الاسم · رقم نايوش · رقم عميل · رقم موظف · البريد" value="${esc(ui.q)}" />
    </div>
    ${
      show
        ? `<div class="idn-toolbar idn-filters">
      <select data-idn-type data-action-change="idn-live-filter">
        <option value="">كل أنواع المستخدم</option>
        ${Object.values(kinds())
          .map((x) => `<option value="${esc(x.code)}" ${ui.type === x.code ? 'selected' : ''}>${esc(x.labelAr)}</option>`)
          .join('')}
      </select>
      <select data-idn-org data-action-change="idn-live-filter">
        <option value="">كل المؤسسات</option>
        ${(opts.orgs || []).map((o) => `<option value="${esc(o.name)}" ${ui.org === o.name ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
      </select>
      <select data-idn-branch data-action-change="idn-live-filter">
        <option value="">كل الفروع</option>
        ${filterBranchOptions()
          .map((b) => `<option value="${esc(b)}" ${ui.branch === b ? 'selected' : ''}>${esc(b)}</option>`)
          .join('')}
      </select>
      <select data-idn-department data-action-change="idn-live-filter">
        <option value="">كل الأقسام</option>
        ${filterDeptOptions()
          .map((d) => `<option value="${esc(d)}" ${ui.department === d ? 'selected' : ''}>${esc(d)}</option>`)
          .join('')}
      </select>
      <select data-idn-role data-action-change="idn-live-filter">
        <option value="">كل الأدوار</option>
        ${(opts.roles || []).map((r) => `<option value="${esc(r.code)}" ${ui.role === r.code ? 'selected' : ''}>${esc(r.nameAr)}</option>`).join('')}
      </select>
      <select data-idn-status data-action-change="idn-live-filter">
        <option value="">كل الحالات</option>
        <option value="active" ${ui.status === 'active' ? 'selected' : ''}>نشط</option>
        <option value="suspended" ${ui.status === 'suspended' ? 'selected' : ''}>موقوف</option>
        <option value="archived" ${ui.status === 'archived' ? 'selected' : ''}>مؤرشف</option>
      </select>
      <button type="button" class="btn btn-dark btn-sm" data-action="idn-filter">تصفية</button>
      <button type="button" class="btn btn-ghost btn-sm" data-action="idn-filter-clear">مسح الفلاتر</button>
    </div>`
        : ''
    }`;
  };

  const actionsMenu = (i) => {
    const open = ui.menuId === i.naioshId;
    return `<div class="idn-act-menu ${open ? 'is-open' : ''}">
      <button type="button" class="btn btn-ghost btn-sm idn-act-trigger" data-action="idn-menu-toggle" data-id="${esc(i.naioshId)}" aria-label="الإجراءات">⋮</button>
      <div class="idn-act-dropdown" ${open ? '' : 'hidden'}>
        <button type="button" data-action="idn-detail" data-id="${esc(i.naioshId)}">عرض التفاصيل</button>
        <button type="button" data-action="idn-edit-open" data-id="${esc(i.naioshId)}">تعديل</button>
        <button type="button" data-action="idn-affil-open" data-id="${esc(i.naioshId)}">إدارة الارتباط</button>
        <a href="#roles-permissions">إدارة الدور والصلاحيات</a>
        ${
          i.status === 'suspended'
            ? `<button type="button" data-action="idn-reactivate" data-id="${esc(i.naioshId)}">إعادة التفعيل</button>`
            : i.status !== 'archived'
              ? `<button type="button" data-action="idn-suspend" data-id="${esc(i.naioshId)}">إيقاف الوصول</button>`
              : ''
        }
        ${i.status !== 'archived' ? `<button type="button" data-action="idn-archive" data-id="${esc(i.naioshId)}">أرشفة</button>` : ''}
      </div>
    </div>`;
  };

  const renderCompoundRow = (i) => {
    const cNo = clientNoOf(i);
    const seed = i.registrySeed || i.dataSource === 'registry-seed' || i.dataSource === 'seed';
    return `<tr data-naiosh="${esc(i.naioshId)}">
      <td class="col-user">
        <div class="idn-cell-stack">
          <strong class="idn-name">${esc(dash(i.name))}${seed ? ' <span class="idn-seed" title="بيانات تجريبية من السجل">تجريبي</span>' : ''}</strong>
          <span class="idn-email" dir="ltr" title="${esc(i.email || '')}">${esc(dash(i.email))}
            ${i.email ? `<button type="button" class="idn-copy" data-action="idn-copy" data-copy="${esc(i.email)}" title="نسخ البريد">⧉</button>` : ''}
          </span>
        </div>
      </td>
      <td class="col-ids">
        <div class="idn-cell-stack idn-ids">
          ${copyChip(i.naioshId, 'نايوش')}
          ${cNo ? copyChip(cNo, 'عميل') : ''}
          ${i.employeeNo ? copyChip(i.employeeNo, 'موظف') : ''}
          ${!cNo && !i.employeeNo ? '<span class="idn-muted">—</span>' : ''}
        </div>
      </td>
      <td class="col-kind"><span class="idn-kind">${esc(userKindAr(i))}</span></td>
      <td class="col-org">
        <div class="idn-cell-stack">
          <strong>${esc(dash(i.orgName))}</strong>
          <span class="idn-muted">${esc(dash(i.branchName))}</span>
        </div>
      </td>
      <td class="col-job">
        <div class="idn-cell-stack">
          <span>${esc(dash(i.department))}</span>
          <span class="idn-muted">${esc(dash(i.jobTitle))}</span>
        </div>
      </td>
      <td class="col-role" title="${esc(primaryRoleAr(i))}">${esc(primaryRoleAr(i))}</td>
      <td class="col-status"><span class="idn-status is-${esc(i.status || 'active')}">${esc(statusAr(i.status || 'active'))}</span></td>
      <td class="col-acts">${actionsMenu(i)}</td>
    </tr>`;
  };

  const renderUserCards = (rows) =>
    `<div class="idn-mobile-cards">${rows
      .map((i) => {
        const cNo = clientNoOf(i);
        return `<article class="idn-mcard">
          <header><strong>${esc(dash(i.name))}</strong><span class="idn-status is-${esc(i.status || 'active')}">${esc(statusAr(i.status || 'active'))}</span></header>
          <dl>
            <div><dt>رقم نايوش</dt><dd dir="ltr">${esc(dash(i.naioshId))}</dd></div>
            <div><dt>النوع</dt><dd>${esc(userKindAr(i))}</dd></div>
            <div><dt>المؤسسة</dt><dd>${esc(dash(i.orgName))}</dd></div>
            ${cNo ? `<div><dt>رقم العميل</dt><dd dir="ltr">${esc(cNo)}</dd></div>` : ''}
            ${i.employeeNo ? `<div><dt>رقم الموظف</dt><dd dir="ltr">${esc(i.employeeNo)}</dd></div>` : ''}
          </dl>
          <footer>
            <button type="button" class="btn btn-primary btn-sm" data-action="idn-detail" data-id="${esc(i.naioshId)}">عرض التفاصيل</button>
            ${actionsMenu(i)}
          </footer>
        </article>`;
      })
      .join('')}</div>`;

  const renderUsersTable = (rows) => {
    if (!rows.length) return `<div class="idn-empty"><p>لا توجد هويات مطابقة.</p></div>`;
    return `${renderUserCards(rows)}
    <div class="idn-table-wrap idn-registry-wrap">
      <table class="idn-table idn-registry idn-compound">
        <thead><tr>
          <th class="col-user">المستخدم</th>
          <th class="col-ids">المعرفات</th>
          <th class="col-kind">النوع</th>
          <th class="col-org">الجهة</th>
          <th class="col-job">الوظيفة</th>
          <th class="col-role">الدور</th>
          <th class="col-status">الحالة</th>
          <th class="col-acts">الإجراءات</th>
        </tr></thead>
        <tbody>${rows.map(renderCompoundRow).join('')}</tbody>
      </table>
    </div>`;
  };

  const renderUsersView = (mode = 'users') => {
    const rows = filteredIdentities();
    return `<div class="idn-users-head">
      <h2 class="idn-section-title">${mode === 'accounts' ? 'إدارة الحسابات' : 'المستخدمون والهويات'}</h2>
      <p class="idn-section-sub">إدارة حسابات وهويات المستخدمين المرتبطين بنايوش والمؤسسات والفروع، ومعرفة جهة كل مستخدم ونوعه وحالة حسابه.</p>
    </div>
    ${filtersBar(mode)}
    <p class="idn-muted idn-count">عرض ${rows.length} من ${identities().length} هوية</p>
    ${renderUsersTable(rows)}`;
  };

  const field = (label, value, ltr = false) => {
    if (value == null || value === '') return '';
    return `<li><span>${esc(label)}</span><strong ${ltr ? 'dir="ltr"' : ''}>${esc(value)}</strong></li>`;
  };

  const renderDetail = (id) => {
    const i = eng()?.findIdentity?.(id) || identities().find((x) => x.naioshId === id);
    if (!i) return `<div class="idn-empty"><p>الهوية غير موجودة.</p><button type="button" class="btn btn-ghost" data-action="idn-view" data-view="users">رجوع</button></div>`;
    const sec = secOf(i.naioshId);
    const grants = (ag().grants || []).filter((g) => g.naioshId === i.naioshId || g.identityId === i.id);
    const active = grants.filter((g) => String(g.status).toUpperCase() === 'ACTIVE');
    const systems = [...new Set(active.map((g) => g.system).filter(Boolean))];
    const roles = [...new Set(active.map((g) => g.roleCode).filter(Boolean))];
    const perms = [...new Set(active.flatMap((g) => g.permissions || []))];
    const cNo = clientNoOf(i);
    return `<div class="idn-detail">
      <div class="idn-toolbar">
        <button type="button" class="btn btn-ghost btn-sm" data-action="idn-view" data-view="users"><i class="fas fa-arrow-right"></i> رجوع</button>
        <button type="button" class="btn btn-dark btn-sm" data-action="idn-edit-open" data-id="${esc(i.naioshId)}">تعديل</button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="idn-affil-open" data-id="${esc(i.naioshId)}">إدارة الارتباط</button>
        <a class="btn btn-ghost btn-sm" href="#roles-permissions">إدارة الدور والصلاحيات</a>
      </div>
      <h2>ملف المستخدم</h2>
      <p class="idn-sub">${esc(i.name || '')} · ${esc(userKindAr(i))} · ${esc(statusAr(i.status || 'active'))}</p>
      <section class="idn-block"><h3>الهوية</h3>
        <ul class="idn-dl">
          ${field('الاسم', i.name)}
          ${field('رقم نايوش', i.naioshId, true)}
          ${field('البريد', i.email, true)}
          ${field('الهاتف', i.phone, true)}
          ${field('الدولة', i.country)}
        </ul>
      </section>
      <section class="idn-block"><h3>المعرفات</h3>
        <ul class="idn-dl">
          ${cNo ? field('رقم العميل', cNo, true) : '<li><span>رقم العميل</span><strong>—</strong></li>'}
          ${i.employeeNo ? field('رقم الموظف', i.employeeNo, true) : '<li><span>رقم الموظف</span><strong>—</strong></li>'}
        </ul>
      </section>
      <section class="idn-block"><h3>الارتباط</h3>
        <ul class="idn-dl">
          ${field('نوع المستخدم', userKindAr(i))}
          ${field('المؤسسة / الجهة', i.orgName || '—')}
          ${field('الفرع', i.branchName || '—')}
          ${field('القسم', i.department || '—')}
          ${field('المسمى الوظيفي', i.jobTitle || '—')}
        </ul>
      </section>
      <section class="idn-block"><h3>الوصول</h3>
        <ul class="idn-dl">
          <li><span>الدور</span><strong>${esc(roles.length ? roles.map(roleLabel).join(' · ') : '—')}</strong></li>
          <li><span>الأنظمة المتاحة</span><strong>${esc(systems.length ? systems.join(' · ') : '—')}</strong></li>
        </ul>
        <p class="idn-perms">${perms.length ? perms.map((p) => `<code>${esc(p)}</code>`).join(' ') : '<span class="idn-muted">—</span>'}</p>
      </section>
      <section class="idn-block"><h3>الحساب</h3>
        <ul class="idn-dl">
          ${field('الحالة', statusAr(i.status || 'active'))}
          ${field('تاريخ الإنشاء', fmt(i.createdAt))}
          ${field('آخر دخول', fmt(sec.lastLoginAt || i.updatedAt))}
          ${field('آخر تعديل', fmt(i.updatedAt))}
        </ul>
      </section>
    </div>`;
  };

  const renderWizardBody = (d, step, isEdit) => {
    const opts = affOpts();
    const needsOrg = kindNeedsOrg(d.userKind);
    const needsEmp = kindNeedsEmployee(d.userKind);
    const needsCli = kindNeedsClient(d.userKind, d.alsoCustomer);
    const branchList = branchesForOrg(d.orgName, d.orgId);
    const deptList = deptsFor(d.orgName, d.orgId, d.branchName);

    if (step === 1) {
      return `<div class="idn-wizard-grid">
        <label>اسم المستخدم / الاسم الكامل *<input data-f="name" value="${esc(d.name)}" required /></label>
        <label>البريد الإلكتروني *<input data-f="email" type="email" dir="ltr" value="${esc(d.email)}" required /></label>
        <label>الهاتف<input data-f="phone" dir="ltr" value="${esc(d.phone)}" /></label>
        <label>الدولة<input data-f="country" value="${esc(d.country)}" /></label>
        <label>نوع المستخدم *
          <select data-f="userKind">
            ${Object.values(kinds())
              .map((k) => `<option value="${esc(k.code)}" ${d.userKind === k.code ? 'selected' : ''}>${esc(k.labelAr)}</option>`)
              .join('')}
          </select>
        </label>
        <label>الحالة
          <select data-f="status">
            <option value="active" ${d.status === 'active' ? 'selected' : ''}>نشط</option>
            <option value="suspended" ${d.status === 'suspended' ? 'selected' : ''}>موقوف</option>
          </select>
        </label>
      </div>
      <p class="idn-banner idn-auto-note">رقم نايوش: ${
        isEdit && d.naioshId ? `<code dir="ltr">${esc(d.naioshId)}</code> (ثابت)` : 'سيتم إنشاؤه تلقائيًا بعد الحفظ'
      }</p>`;
    }
    if (step === 2) {
      return `<div class="idn-ids-step">
        <div class="idn-auto-box">
          <h4>رقم العميل</h4>
          <p>${
            needsCli
              ? isEdit && d.clientNo
                ? `موجود: <code dir="ltr">${esc(d.clientNo)}</code>`
                : 'سيُنشأ تلقائيًا بعد الحفظ (حسب نوع المستخدم / صفة العميل).'
              : 'غير مطلوب لهذا النوع — سيظهر — في السجل.'
          }</p>
        </div>
        <div class="idn-auto-box">
          <h4>رقم الموظف</h4>
          <p>${
            needsEmp
              ? isEdit && d.employeeNo
                ? `موجود: <code dir="ltr">${esc(d.employeeNo)}</code>`
                : 'سيُنشأ تلقائيًا بعد الحفظ.'
              : 'غير مطلوب لهذا النوع — سيظهر — في السجل.'
          }</p>
        </div>
        ${
          needsEmp
            ? `<label class="idn-check"><input type="checkbox" data-f="alsoCustomer" ${d.alsoCustomer ? 'checked' : ''} /> الاحتفاظ بصفة عميل أيضًا (رقم نايوش + رقم عميل + رقم موظف)</label>`
            : ''
        }
        <p class="idn-muted">لا يُطلب إدخال الأرقام يدويًا — النظام يولّدها ويحفظها في السجل المركزي.</p>
      </div>`;
    }
    if (step === 3) {
      return `<div class="idn-wizard-grid">
        <label>المؤسسة / الجهة ${needsOrg ? '*' : ''}
          <select data-f="orgName" data-cascade="org">
            <option value="">${needsOrg ? '— اختر —' : '— بدون —'}</option>
            ${(opts.orgs || [])
              .map((o) => `<option value="${esc(o.name)}" data-org-id="${esc(o.id)}" ${d.orgName === o.name ? 'selected' : ''}>${esc(o.name)}</option>`)
              .join('')}
          </select>
        </label>
        <label>الفرع
          <select data-f="branchName" data-cascade="branch">
            <option value="">—</option>
            ${branchList.map((b) => `<option value="${esc(b.name)}" ${d.branchName === b.name ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}
          </select>
        </label>
        <label>القسم
          <select data-f="department">
            <option value="">—</option>
            ${(deptList.length ? deptList : opts.departments || []).map((x) => `<option value="${esc(x)}" ${d.department === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}
          </select>
        </label>
        <label>المسمى الوظيفي
          <input data-f="jobTitle" value="${esc(d.jobTitle)}" list="idn-jobs-list" />
          <datalist id="idn-jobs-list">${(opts.jobTitles || []).map((j) => `<option value="${esc(j)}"></option>`).join('')}</datalist>
        </label>
      </div>
      <p class="idn-muted">القوائم مترابطة: المؤسسة → الفرع → القسم من مصدر المؤسسات/الهيكل.</p>`;
    }
    if (step === 4) {
      return `<div class="idn-wizard-grid">
        <label>الدور *
          <select data-f="roleCode">
            ${(opts.roles || []).map((r) => `<option value="${esc(r.code)}" ${d.roleCode === r.code ? 'selected' : ''}>${esc(r.nameAr)}</option>`).join('')}
          </select>
        </label>
        <label>الأنظمة المسموح بالوصول إليها
          <select data-f="systems" multiple size="5">
            ${(ag().systems || [])
              .map((s) => {
                const code = typeof s === 'string' ? s : s.code;
                const name = typeof s === 'string' ? s : s.nameAr || s.code;
                return `<option value="${esc(code)}" ${(d.systems || []).includes(code) ? 'selected' : ''}>${esc(name)}</option>`;
              })
              .join('')}
          </select>
        </label>
      </div>
      <p class="idn-muted">نوع المستخدم ≠ الدور. الدور يُحفظ كمنحة في حوكمة الوصول.</p>`;
    }
    const kLabel = kinds()[d.userKind]?.labelAr || d.userKind;
    return `<ul class="idn-dl idn-review">
      <li><span>الاسم</span><strong>${esc(d.name)}</strong></li>
      <li><span>رقم نايوش</span><strong>${isEdit && d.naioshId ? esc(d.naioshId) : 'سيتم إنشاؤه تلقائيًا'}</strong></li>
      <li><span>رقم العميل</span><strong>${needsCli ? (d.clientNo || 'سيُنشأ تلقائيًا') : '—'}</strong></li>
      <li><span>رقم الموظف</span><strong>${needsEmp ? (d.employeeNo || 'سيُنشأ تلقائيًا') : '—'}</strong></li>
      <li><span>البريد</span><strong dir="ltr">${esc(d.email)}</strong></li>
      <li><span>الهاتف</span><strong dir="ltr">${esc(d.phone || '—')}</strong></li>
      <li><span>الدولة</span><strong>${esc(d.country || '—')}</strong></li>
      <li><span>نوع المستخدم</span><strong>${esc(kLabel)}</strong></li>
      <li><span>المؤسسة</span><strong>${esc(d.orgName || '—')}</strong></li>
      <li><span>الفرع</span><strong>${esc(d.branchName || '—')}</strong></li>
      <li><span>القسم</span><strong>${esc(d.department || '—')}</strong></li>
      <li><span>المسمى</span><strong>${esc(d.jobTitle || '—')}</strong></li>
      <li><span>الدور</span><strong>${esc(roleLabel(d.roleCode))}</strong></li>
      <li><span>الحالة</span><strong>${esc(statusAr(d.status))}</strong></li>
    </ul>`;
  };

  const renderUserWizard = () => {
    const m = ui.modal;
    if (!m || (m.kind !== 'add-user' && m.kind !== 'edit-user')) return '';
    const isEdit = m.kind === 'edit-user';
    const d = ui.addDraft || blankDraft();
    const step = ui.addStep || 1;
    const titles = ['الهوية الأساسية', 'الأرقام والارتباطات', 'الجهة والعمل', 'الدور والصلاحيات', 'المراجعة والحفظ'];
    return `<div class="idn-modal-backdrop" data-action="idn-modal-cancel">
      <div class="idn-modal idn-modal-lg" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
        <header>
          <h3>${isEdit ? 'تعديل مستخدم' : 'إضافة مستخدم'} · ${esc(titles[step - 1])}</h3>
          <button type="button" class="idn-modal-x" data-action="idn-modal-cancel">×</button>
        </header>
        <div class="idn-steps">${titles.map((t, i) => `<span class="${i + 1 === step ? 'is-on' : i + 1 < step ? 'is-done' : ''}">${i + 1}. ${esc(t)}</span>`).join('')}</div>
        <div class="idn-modal-body">${renderWizardBody(d, step, isEdit)}${m.error ? `<p class="idn-error">${esc(m.error)}</p>` : ''}</div>
        <footer>
          <button type="button" class="btn btn-ghost" data-action="idn-modal-cancel">إلغاء</button>
          ${step > 1 ? `<button type="button" class="btn btn-ghost" data-action="idn-add-prev">السابق</button>` : ''}
          ${step < 5 ? `<button type="button" class="btn btn-primary" data-action="idn-add-next">التالي</button>` : `<button type="button" class="btn btn-primary" data-action="idn-add-save">${isEdit ? 'حفظ التعديل' : 'حفظ المستخدم'}</button>`}
        </footer>
      </div>
    </div>`;
  };

  /* SSO / MFA / Matrix — مختصر مع الإبقاء على الوظائف */
  const renderSso = () => {
    const rows = ssoStore().systems || [];
    return `${filtersBar('sso').replace('إضافة مستخدم', '')}
      <div class="idn-toolbar"><button type="button" class="btn btn-primary btn-sm" data-action="idn-sso-add"><i class="fas fa-plus"></i> إضافة نظام</button></div>
      <div class="idn-table-wrap"><table class="idn-table">
        <thead><tr><th>اسم النظام</th><th>الرابط</th><th>الدخول الموحد</th><th>المستخدمون</th><th>الإجراءات</th></tr></thead>
        <tbody>${rows
          .map((s) => {
            const usersN = (ag().grants || []).filter((g) => g.system === s.code && String(g.status).toUpperCase() === 'ACTIVE').length;
            return `<tr>
              <td>${esc(s.nameAr)} <small class="idn-muted" dir="ltr">${esc(s.code)}</small></td>
              <td dir="ltr">${esc(s.loginUrl)}</td>
              <td>${s.ssoStatus === 'enabled' ? 'مفعّل' : 'متوقف'}</td>
              <td>${usersN}</td>
              <td class="idn-acts">
                <button type="button" class="btn btn-primary btn-sm" data-action="idn-sso-open" data-id="${esc(s.id)}">فتح</button>
                <button type="button" class="btn btn-ghost btn-sm" data-action="idn-sso-toggle" data-id="${esc(s.id)}">${s.ssoStatus === 'enabled' ? 'إيقاف' : 'تفعيل'}</button>
              </td>
            </tr>`;
          })
          .join('')}</tbody></table></div>`;
  };

  const renderMfa = (k) => {
    const rows = filteredIdentities();
    return `${filtersBar('mfa')}
      <div class="idn-kpis">
        <article><span>مفعّل</span><strong>${k.mfaOn}</strong></article>
        <article><span>غير مفعّل</span><strong>${k.mfaOff}</strong></article>
      </div>
      <div class="idn-table-wrap"><table class="idn-table">
        <thead><tr><th>المستخدم</th><th>رقم نايوش</th><th>النوع</th><th>حالة التحقق</th><th>الإجراءات</th></tr></thead>
        <tbody>${rows
          .map((i) => {
            const sec = secOf(i.naioshId);
            return `<tr>
              <td>${esc(i.name)}</td>
              <td dir="ltr"><code>${esc(i.naioshId)}</code></td>
              <td>${esc(userKindAr(i))}</td>
              <td>${sec.mfaEnabled ? 'مفعّل' : 'غير مفعّل'}</td>
              <td>${
                sec.mfaEnabled
                  ? `<button type="button" class="btn btn-ghost btn-sm" data-action="idn-mfa-off" data-id="${esc(i.naioshId)}">إيقاف</button>`
                  : `<button type="button" class="btn btn-primary btn-sm" data-action="idn-mfa-on" data-id="${esc(i.naioshId)}">تفعيل</button>`
              }</td>
            </tr>`;
          })
          .join('')}</tbody></table></div>`;
  };

  const renderMatrix = () => {
    const employees = (eng()?.listEmployees?.() || identities().filter((i) => i.employeeNo)).slice();
    const emp = ui.matrixEmp ? eng()?.findIdentity?.(ui.matrixEmp) : null;
    let grants = (ag().grants || []).filter((g) => String(g.status).toUpperCase() === 'ACTIVE');
    if (emp) grants = grants.filter((g) => g.naioshId === emp.naioshId);
    const bySystem = {};
    grants.forEach((g) => {
      const sys = g.system || 'HUB';
      if (!bySystem[sys]) bySystem[sys] = new Set();
      (g.permissions || []).forEach((p) => bySystem[sys].add(p));
    });
    return `<div class="idn-toolbar">
      <button type="button" class="btn btn-ghost btn-sm" data-action="idn-view" data-view="home">العودة</button>
      <select data-idn-matrix-emp>${employees.map((e) => `<option value="${esc(e.naioshId)}" ${ui.matrixEmp === e.naioshId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
      <button type="button" class="btn btn-dark btn-sm" data-action="idn-matrix-apply">تطبيق</button>
      <a class="btn btn-primary btn-sm" href="#roles-permissions">تعديل من إدارة الصلاحيات</a>
    </div>
    <div class="idn-table-wrap"><table class="idn-table"><thead><tr><th>النظام</th><th>الصلاحيات</th></tr></thead>
      <tbody>${
        Object.keys(bySystem).length
          ? Object.entries(bySystem)
              .map(([sys, set]) => `<tr><td>${esc(sys)}</td><td class="idn-muted">${esc([...set].slice(0, 12).join(' · '))}</td></tr>`)
              .join('')
          : '<tr><td colspan="2">لا صلاحيات مطابقة.</td></tr>'
      }</tbody></table></div>`;
  };

  const renderModal = () => {
    const m = ui.modal;
    if (!m) return '';
    if (m.kind === 'add-user' || m.kind === 'edit-user') return renderUserWizard();
    if (m.kind === 'sso-add') {
      return `<div class="idn-modal-backdrop" data-action="idn-modal-cancel"><div class="idn-modal" onclick="event.stopPropagation()">
        <header><h3>إضافة نظام</h3><button type="button" class="idn-modal-x" data-action="idn-modal-cancel">×</button></header>
        <div class="idn-modal-body">
          <label>اسم النظام<input data-f="nameAr" /></label>
          <label>الرمز<input data-f="code" dir="ltr" /></label>
          <label>رابط الدخول<input data-f="loginUrl" dir="ltr" /></label>
          ${m.error ? `<p class="idn-error">${esc(m.error)}</p>` : ''}
        </div>
        <footer><button type="button" class="btn btn-ghost" data-action="idn-modal-cancel">إلغاء</button>
        <button type="button" class="btn btn-primary" data-action="idn-modal-ok">حفظ</button></footer>
      </div></div>`;
    }
    if (m.kind === 'confirm') {
      return `<div class="idn-modal-backdrop" data-action="idn-modal-cancel"><div class="idn-modal" onclick="event.stopPropagation()">
        <header><h3>${esc(m.title || 'تأكيد')}</h3><button type="button" class="idn-modal-x" data-action="idn-modal-cancel">×</button></header>
        <div class="idn-modal-body"><p>${esc(m.body || '')}</p>${m.error ? `<p class="idn-error">${esc(m.error)}</p>` : ''}</div>
        <footer><button type="button" class="btn btn-ghost" data-action="idn-modal-cancel">إلغاء</button>
        <button type="button" class="btn btn-primary" data-action="idn-modal-ok">${esc(m.okLabel || 'تأكيد')}</button></footer>
      </div></div>`;
    }
    return '';
  };

  const render = (ctx = {}) => {
    const { user } = ctx;
    if (!canManage(user)) return `<div class="hub-idn-ws">${renderDenied()}</div>`;
    const k = liveKpis();
    let body = '';
    if (ui.view === 'home') body = renderHome(k);
    else if (ui.view === 'users' || ui.view === 'accounts') body = renderUsersView(ui.view);
    else if (ui.view === 'sso') body = renderSso();
    else if (ui.view === 'mfa') body = renderMfa(k);
    else if (ui.view === 'matrix') body = renderMatrix();
    else if (ui.view === 'detail') body = renderDetail(ui.openId);
    else body = renderHome(k);

    return `<div class="hub-idn-ws">
      <header class="idn-header">
        <div>
          <p class="idn-kicker"><i class="fas fa-id-card"></i> هوية نايوش</p>
          <h1>إدارة الهوية</h1>
          <p class="idn-sub">السجل المركزي للهويات والحسابات — من هو الشخص، تابع لأي جهة، وما صفته وحالة حسابه.</p>
        </div>
        <div class="idn-header-actions">
          <button type="button" class="btn btn-primary btn-sm" data-action="idn-view" data-view="users">المستخدمون والهويات</button>
          <a class="btn btn-ghost btn-sm" href="#roles-permissions">فريق العمل والصلاحيات</a>
        </div>
      </header>
      ${ui.note ? `<p class="idn-banner">${esc(ui.note)}</p>` : ''}
      ${body}
      ${renderModal()}
    </div>`;
  };

  const readFilters = () => {
    ui.q = document.querySelector('[data-idn-q]')?.value ?? ui.q;
    ui.type = document.querySelector('[data-idn-type]')?.value ?? ui.type;
    ui.status = document.querySelector('[data-idn-status]')?.value ?? ui.status;
    const org = document.querySelector('[data-idn-org]')?.value;
    if (org !== undefined) {
      if (org !== ui.org) {
        ui.branch = '';
        ui.department = '';
      }
      ui.org = org;
    }
    const branch = document.querySelector('[data-idn-branch]')?.value;
    if (branch !== undefined) {
      if (branch !== ui.branch) ui.department = '';
      ui.branch = branch;
    }
    ui.department = document.querySelector('[data-idn-department]')?.value ?? ui.department;
    ui.role = document.querySelector('[data-idn-role]')?.value ?? ui.role;
  };

  const readDraftFields = () => {
    const box = document.querySelector('.idn-modal');
    if (!box) return ui.addDraft || blankDraft();
    const d = { ...(ui.addDraft || blankDraft()) };
    box.querySelectorAll('[data-f]').forEach((el) => {
      const key = el.getAttribute('data-f');
      if (el.type === 'checkbox') d[key] = el.checked;
      else if (el.tagName === 'SELECT' && el.multiple) d[key] = [...el.selectedOptions].map((o) => o.value);
      else d[key] = el.value;
    });
    const orgSel = box.querySelector('[data-f="orgName"]');
    if (orgSel?.selectedOptions?.[0]) {
      d.orgId = orgSel.selectedOptions[0].getAttribute('data-org-id') || d.orgId || '';
    }
    ui.addDraft = d;
    return d;
  };

  const saveIdentityFromDraft = (actor) => {
    const d = readDraftFields();
    const needsOrg = kindNeedsOrg(d.userKind);
    if (!d.name?.trim() || !d.email?.trim()) throw new Error('الاسم والبريد مطلوبان');
    if (!d.userKind) throw new Error('نوع المستخدم مطلوب');
    if (needsOrg && !d.orgName) throw new Error('المؤسسة مطلوبة لهذا النوع');
    if (d.orgName === 'نايوش' && !d.orgId) d.orgId = 'ORG-NAIOSH';

    if (d.editId) {
      eng()?.updateIdentity?.(
        d.editId,
        {
          name: d.name,
          email: d.email,
          phone: d.phone,
          country: d.country,
          userKind: d.userKind,
          status: d.status,
          orgId: d.orgId,
          orgName: d.orgName,
          branchName: d.branchName,
          department: d.department,
          jobTitle: d.jobTitle,
          roleCode: d.roleCode,
          alsoCustomer: d.alsoCustomer,
          alsoEmployee: kindNeedsEmployee(d.userKind),
          reason: 'تعديل من سجل الهويات',
        },
        actor
      );
      return eng()?.findIdentity?.(d.editId);
    }

    return eng()?.createUserIdentity?.(
      {
        name: d.name,
        email: d.email,
        phone: d.phone,
        country: d.country,
        userKind: d.userKind,
        status: d.status,
        orgId: d.orgId,
        orgName: d.orgName,
        branchName: d.branchName,
        department: d.department,
        jobTitle: d.jobTitle,
        roleCode: d.roleCode,
        systems: d.systems?.length ? d.systems : ['HUB'],
        alsoCustomer: d.alsoCustomer,
        dataSource: 'user-created',
        reason: 'إضافة من سجل الهويات',
      },
      actor
    );
  };

  const handle = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const actor = user?.name || user?.email || 'مشغّل هوب';
    if (!canManage(user) && action !== 'idn-view') {
      toast?.('غير مصرح');
      return true;
    }

    if (action === 'idn-view') {
      ui.view = btn.dataset.view || 'home';
      ui.openId = null;
      ui.note = '';
      ui.modal = null;
      ui.menuId = null;
      return true;
    }
    if (action === 'idn-filter' || action === 'idn-live-filter' || action === 'idn-live-search') {
      readFilters();
      ui.menuId = null;
      return true;
    }
    if (action === 'idn-filter-clear') {
      ui.q = '';
      ui.type = '';
      ui.status = '';
      ui.org = '';
      ui.branch = '';
      ui.department = '';
      ui.role = '';
      return true;
    }
    if (action === 'idn-copy') {
      const v = btn.dataset.copy || '';
      if (v && navigator.clipboard?.writeText) navigator.clipboard.writeText(v).then(() => toast?.('تم النسخ')).catch(() => toast?.(v));
      else toast?.(v);
      return true;
    }
    if (action === 'idn-menu-toggle') {
      ui.menuId = ui.menuId === btn.dataset.id ? null : btn.dataset.id;
      return true;
    }
    if (action === 'idn-detail') {
      ui.openId = btn.dataset.id;
      ui.view = 'detail';
      ui.menuId = null;
      return true;
    }
    if (action === 'idn-add-open') {
      ui.addStep = 1;
      ui.addDraft = blankDraft();
      ui.editMode = false;
      ui.modal = { kind: 'add-user', error: '' };
      ui.menuId = null;
      return true;
    }
    if (action === 'idn-edit-open' || action === 'idn-affil-open') {
      const id = eng()?.findIdentity?.(btn.dataset.id);
      if (!id) {
        toast?.('المستخدم غير موجود');
        return true;
      }
      ui.addStep = action === 'idn-affil-open' ? 3 : 1;
      ui.addDraft = blankDraft(id);
      ui.editMode = true;
      ui.modal = { kind: 'edit-user', error: '', id: btn.dataset.id };
      ui.menuId = null;
      return true;
    }
    if (action === 'idn-add-prev') {
      readDraftFields();
      ui.addStep = Math.max(1, (ui.addStep || 1) - 1);
      ui.modal = { ...(ui.modal || { kind: ui.editMode ? 'edit-user' : 'add-user' }), error: '' };
      return true;
    }
    if (action === 'idn-add-next') {
      const d = readDraftFields();
      const step = ui.addStep || 1;
      const kind = ui.modal?.kind || (ui.editMode ? 'edit-user' : 'add-user');
      if (step === 1 && (!d.name?.trim() || !d.email?.trim() || !d.userKind)) {
        ui.modal = { kind, error: 'الاسم والبريد ونوع المستخدم مطلوبة' };
        return true;
      }
      if (step === 3 && kindNeedsOrg(d.userKind) && !d.orgName) {
        ui.modal = { kind, error: 'المؤسسة مطلوبة لهذا النوع' };
        return true;
      }
      // إعادة بناء قوائم الفرع عند تغيير المؤسسة
      if (step === 3) {
        const validBranches = branchesForOrg(d.orgName, d.orgId).map((b) => b.name);
        if (d.branchName && validBranches.length && !validBranches.includes(d.branchName)) d.branchName = '';
        const validDepts = deptsFor(d.orgName, d.orgId, d.branchName);
        if (d.department && validDepts.length && !validDepts.includes(d.department)) d.department = '';
        ui.addDraft = d;
      }
      ui.addStep = Math.min(5, step + 1);
      ui.modal = { kind, error: '' };
      return true;
    }
    if (action === 'idn-add-save') {
      try {
        const created = saveIdentityFromDraft(actor);
        ui.modal = null;
        ui.addDraft = null;
        ui.view = 'users';
        ui.note = created?.naioshId ? `تم الحفظ · رقم نايوش: ${created.naioshId}${created.employeeNo ? ` · موظف: ${created.employeeNo}` : ''}${created.clientNo ? ` · عميل: ${created.clientNo}` : ''}` : 'تم الحفظ';
        toast?.(ui.editMode ? 'تم حفظ التعديل في السجل المركزي' : 'تم حفظ المستخدم في السجل المركزي');
        ui.editMode = false;
      } catch (e) {
        ui.modal = { kind: ui.editMode ? 'edit-user' : 'add-user', error: e.message || 'تعذر الحفظ' };
      }
      return true;
    }
    if (action === 'idn-matrix-apply') {
      ui.matrixEmp = document.querySelector('[data-idn-matrix-emp]')?.value || '';
      return true;
    }
    if (action === 'idn-mfa-on') {
      patchSec(btn.dataset.id, { mfaEnabled: true, mfaMethod: 'تطبيق مصادقة', mfaEnabledAt: nowIso(), lastVerifiedAt: nowIso() });
      toast?.('تم تفعيل التحقق الثنائي');
      return true;
    }
    if (action === 'idn-mfa-off') {
      ui.modal = { kind: 'confirm', title: 'إيقاف التحقق الثنائي', body: 'تأكيد إيقاف التحقق الثنائي؟', okLabel: 'تأكيد', next: 'mfa-off', id: btn.dataset.id };
      return true;
    }
    if (action === 'idn-suspend') {
      ui.modal = { kind: 'confirm', title: 'إيقاف الوصول', body: 'إيقاف وصول الحساب دون حذف الهوية أو صفة العميل.', okLabel: 'إيقاف', next: 'suspend', id: btn.dataset.id };
      ui.menuId = null;
      return true;
    }
    if (action === 'idn-archive') {
      ui.modal = { kind: 'confirm', title: 'أرشفة', body: 'أرشفة الهوية مع الإبقاء على سجل التدقيق. لن تُحذف صفة العميل إن وُجدت.', okLabel: 'أرشفة', next: 'archive', id: btn.dataset.id };
      ui.menuId = null;
      return true;
    }
    if (action === 'idn-reactivate') {
      try {
        eng()?.reactivateIdentity?.(btn.dataset.id, actor, 'إعادة تفعيل من هوية نايوش');
        toast?.('أُعيد تفعيل الحساب');
      } catch (e) {
        toast?.(e.message || 'تعذر التفعيل');
      }
      ui.menuId = null;
      return true;
    }
    if (action === 'idn-sso-add') {
      ui.modal = { kind: 'sso-add', error: '' };
      return true;
    }
    if (action === 'idn-sso-toggle') {
      const s = ssoStore();
      const row = s.systems.find((x) => x.id === btn.dataset.id);
      if (row) {
        row.ssoStatus = row.ssoStatus === 'enabled' ? 'disabled' : 'enabled';
        saveSso(s);
        toast?.(row.ssoStatus === 'enabled' ? 'فُعّل' : 'أُوقف');
      }
      return true;
    }
    if (action === 'idn-sso-open') {
      const s = ssoStore();
      const row = s.systems.find((x) => x.id === btn.dataset.id);
      if (!row) return true;
      row.lastConnectAt = nowIso();
      row.lastLoginAt = nowIso();
      saveSso(s);
      window.open(window.HubAuth?.attachSsoParams?.(row.loginUrl, row.code) || row.loginUrl, '_blank', 'noopener');
      return true;
    }
    if (action === 'idn-modal-cancel') {
      ui.modal = null;
      return true;
    }
    if (action === 'idn-modal-ok') {
      const m = ui.modal;
      if (!m) return true;
      if (m.kind === 'sso-add') {
        const box = document.querySelector('.idn-modal');
        const nameAr = box?.querySelector('[data-f="nameAr"]')?.value?.trim();
        const code = String(box?.querySelector('[data-f="code"]')?.value || '').toUpperCase();
        const loginUrl = box?.querySelector('[data-f="loginUrl"]')?.value?.trim();
        if (!nameAr || !code || !loginUrl) {
          ui.modal = { ...m, error: 'كل الحقول مطلوبة' };
          return true;
        }
        const s = ssoStore();
        s.systems.push({ id: `sso-${code}`, code, nameAr, loginUrl, linkedSystem: code, linkStatus: 'linked', ssoStatus: 'enabled', authMethod: 'hub-ticket', serviceStatus: 'active', lastConnectAt: '', lastLoginAt: '', notes: '', createdAt: nowIso() });
        saveSso(s);
        ui.modal = null;
        toast?.('أُضيف النظام');
        return true;
      }
      if (m.next === 'mfa-off') {
        patchSec(m.id, { mfaEnabled: false, mfaMethod: '', mfaEnabledAt: '' });
        ui.modal = null;
        toast?.('أُوقف التحقق الثنائي');
        return true;
      }
      if (m.next === 'suspend') {
        try {
          eng()?.suspendIdentity?.(m.id, actor, 'إيقاف من هوية نايوش');
          ui.modal = null;
          toast?.('تم إيقاف الوصول');
        } catch (e) {
          ui.modal = { ...m, error: e.message || 'تعذر الإيقاف' };
        }
        return true;
      }
      if (m.next === 'archive') {
        try {
          eng()?.archiveIdentity?.(m.id, actor, 'أرشفة من هوية نايوش');
          ui.modal = null;
          toast?.('تمت الأرشفة');
        } catch (e) {
          ui.modal = { ...m, error: e.message || 'تعذر الأرشفة' };
        }
        return true;
      }
      return true;
    }
    return false;
  };

  const handleChange = (el) => {
    const act = el?.getAttribute?.('data-action-change');
    if (act === 'idn-live-search' || act === 'idn-live-filter') {
      readFilters();
      return true;
    }
    // cascade inside wizard
    if (el?.getAttribute?.('data-cascade') === 'org' || el?.getAttribute?.('data-cascade') === 'branch') {
      readDraftFields();
      return true;
    }
    return false;
  };

  window.HubIdentityUI = {
    render,
    handle,
    handleChange,
    ui,
    liveKpis,
    secOf,
    userKindAr,
    clientNoOf,
    filteredIdentities,
    IDENTITY_SCHEMA,
    blankDraft,
  };
})();
