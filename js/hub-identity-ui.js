/**
 * هوية نايوش — السجل المركزي للمستخدمين والهويات
 * مصدر الحقيقة: HubAccessGovStore / HubAccessGov (+ ربط العملاء من HubStore)
 */
(() => {
  'use strict';

  const SEC_KEY = 'naiosh_hub_identity_security_v1';
  const SSO_KEY = 'naiosh_hub_sso_registry_v1';

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

  const secOf = (naioshId) => {
    const s = secStore();
    return s.byNaioshId[naioshId] || { mfaEnabled: false, mfaMethod: '', mfaEnabledAt: '', lastVerifiedAt: '', lastLoginAt: '' };
  };

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
    (window.HubOpsCatalog?.listSystems?.() || window.HubOpsCatalog?.systems || []).forEach((s) =>
      push({ code: s.code, nameAr: s.name || s.nameAr, loginUrl: s.href || `apps.html#${String(s.code || '').toLowerCase()}` })
    );
    (ag().managedSystems || []).forEach((s) => push({ code: s.code, nameAr: s.nameAr || s.name, loginUrl: s.loginUrl }));
    (ag().systems || []).forEach((s) => {
      if (typeof s === 'string') push({ code: s, nameAr: s });
      else push({ code: s.code, nameAr: s.nameAr || s.name });
    });
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
      const clients = window.HubStore?.clientsBag?.()?.clients || window.HubStore?.get?.()?.clientsMgmt?.clients || [];
      const hit = clients.find((c) => c.email && id.email && String(c.email).toLowerCase() === String(id.email).toLowerCase());
      return hit?.clientId || hit?.customerNo || '';
    } catch {
      return '';
    }
  };

  const userKindAr = (id) => {
    const code = id?.userKind;
    if (code && kinds()[code]?.labelAr) return kinds()[code].labelAr;
    if (id?.userType === 'CUSTOMER' && !id?.isEmployee && !id?.employeeNo) return 'عميل';
    if (id?.userType === 'STAFF' || id?.isEmployee || id?.employeeNo) return 'موظف';
    return 'مستخدم';
  };

  const roleLabel = (code) => (ag().roles || []).find((r) => r.code === code)?.nameAr || code || '—';

  const primaryRolesOf = (id) => {
    const grants = (ag().grants || []).filter((g) => (g.naioshId === id.naioshId || g.identityId === id.id) && String(g.status).toUpperCase() === 'ACTIVE');
    return [...new Set(grants.map((g) => g.roleCode).filter(Boolean))];
  };

  const primaryRoleAr = (id) => {
    const roles = primaryRolesOf(id);
    if (!roles.length) return '—';
    return roles.map(roleLabel).join(' · ');
  };

  const statusAr = (s) =>
    ({ active: 'نشط', suspended: 'موقوف', archived: 'مؤرشف', revoked: 'ملغى' }[s] || s || '—');

  const dash = (v) => {
    const s = String(v ?? '').trim();
    return s ? s : '—';
  };

  const copyBtn = (value, label) => {
    if (!value) return '—';
    return `<span class="idn-id" dir="ltr" title="${esc(label || value)}"><code>${esc(value)}</code><button type="button" class="idn-copy" data-action="idn-copy" data-copy="${esc(value)}" title="نسخ">⧉</button></span>`;
  };

  const identities = () => (ag().identities || []).slice();

  const affOpts = () => eng()?.listAffiliationOptions?.() || { orgs: [], branches: [], departments: [], roles: [], kinds: kinds() };

  const filteredIdentities = () => {
    let rows = identities();
    if (ui.type) rows = rows.filter((i) => String(i.userKind || '') === ui.type || (ui.type === 'CUSTOMER' && i.userType === 'CUSTOMER' && !i.employeeNo));
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
      return grants.some((g) => g.roleCode === 'SUPER_ADMIN' || g.roleCode === 'HUB_ADMIN' || (g.permissions || []).includes('access_governance.manage'));
    });
    const sensitiveUnprotected = sensitive.filter((i) => !sec[i.naioshId]?.mfaEnabled).length;
    const requireMfa = !!(window.HubStore?.get?.()?.settings?.requireMfa || window.HubSiteSettings?.get?.()?.mfaRequired);
    const withOrg = rows.filter((i) => i.orgName).length;
    return {
      users: rows.length,
      staff: rows.filter((i) => i.userType === 'STAFF' || i.isEmployee || i.employeeNo).length,
      customers: rows.filter((i) => !!clientNoOf(i)).length,
      orgs: withOrg,
      mfaOn,
      mfaOff: Math.max(0, rows.length - mfaOn),
      ssoSystems: ssoStore().systems.filter((s) => s.ssoStatus === 'enabled').length,
      sensitiveUnprotected,
      requireMfa,
    };
  };

  const canManage = (user) => {
    try {
      if (!user) return false;
      const role = String(user.role || user.roleCode || '').toLowerCase();
      if (role === 'customer' || role === 'client' || role === 'client_user' || role === 'platform_customer') return false;
      const d = eng()?.authorize?.({
        naioshId: user.naioshId || user.email,
        permission: 'access_governance.view',
        system: 'HUB',
      });
      if (d?.decision === 'ALLOW') return true;
      const d2 = eng()?.authorize?.({
        naioshId: user.naioshId || user.email,
        permission: 'users.view',
        system: 'HUB',
      });
      if (d2?.decision === 'ALLOW') return true;
      const r = String(user.role || user.roleCode || '').toUpperCase();
      return r === 'SUPER_ADMIN' || r === 'HUB_ADMIN' || r === 'SUPREME_LEADER' || r === 'ADMIN';
    } catch {
      const r = String(user?.role || user?.roleCode || '').toUpperCase();
      return r === 'SUPER_ADMIN' || r === 'HUB_ADMIN' || r === 'ADMIN';
    }
  };

  const cards = (k) => [
    {
      id: 'users',
      icon: 'fa-users',
      title: 'المستخدمون والهويات',
      desc: 'إدارة حسابات وهويات المستخدمين المرتبطين بنايوش والمؤسسات والفروع، ومعرفة جهة كل مستخدم ونوعه وحالة حسابه.',
      stat: `${k.users} هوية`,
      status: 'جاهز',
    },
    {
      id: 'sso',
      icon: 'fa-right-to-bracket',
      title: 'تسجيل الدخول الموحد',
      desc: 'إدارة الأنظمة المرتبطة بهوية واحدة — دون منح صلاحيات تلقائية.',
      stat: `${k.ssoSystems} نظام`,
      status: 'جاهز',
    },
    {
      id: 'mfa',
      icon: 'fa-shield-halved',
      title: 'التحقق الثنائي',
      desc: 'حالة التحقق الثنائي للحسابات والحسابات الحساسة غير المحمية.',
      stat: `${k.mfaOn} مفعّل`,
      status: k.requireMfa ? 'سياسة مفعّلة' : 'سياسة اختيارية',
    },
    {
      id: 'accounts',
      icon: 'fa-id-card',
      title: 'إدارة الحسابات',
      desc: 'إيقاف وإعادة تفعيل الوصول دون حذف الهويات المرتبطة.',
      stat: `${k.staff} موظف · ${k.customers} بصفة عميل`,
      status: 'جاهز',
    },
    {
      id: 'permissions',
      icon: 'fa-user-shield',
      title: 'إدارة الصلاحيات',
      desc: 'يفتح النظام المركزي المعتمد: إدارة فريق العمل والصلاحيات.',
      stat: 'مصدر واحد',
      status: 'مرتبط',
      href: '#roles-permissions',
    },
    {
      id: 'matrix',
      icon: 'fa-table-cells',
      title: 'مصفوفة الصلاحيات',
      desc: 'عرض وتحليل الصلاحيات الفعلية حسب الموظف والنظام والدور.',
      stat: 'من الحوكمة',
      status: 'جاهز',
    },
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
    ${k.sensitiveUnprotected && k.requireMfa ? `<p class="idn-banner is-warn">السياسة تلزم التحقق الثنائي للحسابات الإدارية — يوجد ${k.sensitiveUnprotected} حسابًا غير محمي.</p>` : ''}
    <h2 class="idn-section-title">إدارة الهوية</h2>
    <p class="idn-section-sub">هوية موحّدة — الحساب والصفة والارتباط المؤسسي من هنا؛ الأدوار والصلاحيات من المصدر المركزي.</p>
    <div class="idn-cards">
      ${cards(k)
        .map(
          (c) => `<article class="idn-card">
          <div class="idn-card-icon"><i class="fas ${c.icon}"></i></div>
          <div class="idn-card-body">
            <h3>${esc(c.title)}</h3>
            <p>${esc(c.desc)}</p>
            <div class="idn-card-meta"><span>${esc(c.stat)}</span><span class="idn-pill">${esc(c.status)}</span></div>
          </div>
          ${
            c.href
              ? `<a class="btn btn-primary btn-sm" href="${esc(c.href)}">فتح الإدارة</a>`
              : `<button type="button" class="btn btn-primary btn-sm" data-action="idn-view" data-view="${esc(c.id)}">فتح الإدارة</button>`
          }
        </article>`
        )
        .join('')}
    </div>
    <p class="idn-footnote">ملاحظة أمنية: تسجيل الدخول الموحد يثبت الهوية فقط؛ مستوى الوصول يُحدَّد من الحوكمة. إلغاء صفة موظف لا يحذف حساب العميل إن وُجد.</p>
  `;

  const kindOptions = () => {
    const k = kinds();
    return Object.values(k)
      .map((x) => `<option value="${esc(x.code)}" ${ui.type === x.code ? 'selected' : ''}>${esc(x.labelAr)}</option>`)
      .join('');
  };

  const filtersBar = (extra = '', mode = 'users') => {
    const opts = affOpts();
    const showAff = mode === 'users' || mode === 'accounts';
    return `
    <div class="idn-toolbar idn-toolbar-main">
      <button type="button" class="btn btn-ghost btn-sm" data-action="idn-view" data-view="home"><i class="fas fa-arrow-right"></i> العودة</button>
      ${
        showAff
          ? `<button type="button" class="btn btn-primary btn-sm" data-action="idn-add-open"><i class="fas fa-plus"></i> إضافة مستخدم</button>`
          : ''
      }
      <input type="search" data-idn-q placeholder="بحث: الاسم · رقم نايوش · رقم عميل · رقم موظف · البريد" value="${esc(ui.q)}" />
      ${extra}
    </div>
    ${
      showAff
        ? `<div class="idn-toolbar idn-filters">
      <select data-idn-type>
        <option value="">كل أنواع المستخدم</option>
        ${kindOptions()}
      </select>
      <select data-idn-org>
        <option value="">كل المؤسسات</option>
        ${(opts.orgs || []).map((o) => `<option value="${esc(o.name)}" ${ui.org === o.name ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
      </select>
      <select data-idn-branch>
        <option value="">كل الفروع</option>
        ${(opts.branches || []).map((b) => `<option value="${esc(b)}" ${ui.branch === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}
      </select>
      <select data-idn-department>
        <option value="">كل الأقسام</option>
        ${(opts.departments || []).map((d) => `<option value="${esc(d)}" ${ui.department === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}
      </select>
      <select data-idn-role>
        <option value="">كل الأدوار</option>
        ${(opts.roles || []).map((r) => `<option value="${esc(r.code)}" ${ui.role === r.code ? 'selected' : ''}>${esc(r.nameAr)}</option>`).join('')}
      </select>
      <select data-idn-status>
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

  const actionsMenu = (i, mode) => {
    const open = ui.menuId === i.naioshId;
    return `<div class="idn-act-menu ${open ? 'is-open' : ''}">
      <button type="button" class="btn btn-primary btn-sm" data-action="idn-menu-toggle" data-id="${esc(i.naioshId)}">الإجراءات ▾</button>
      <div class="idn-act-dropdown" ${open ? '' : 'hidden'}>
        <button type="button" data-action="idn-detail" data-id="${esc(i.naioshId)}">عرض التفاصيل</button>
        <button type="button" data-action="idn-edit-open" data-id="${esc(i.naioshId)}">تعديل</button>
        <button type="button" data-action="idn-affil-open" data-id="${esc(i.naioshId)}">إدارة الارتباط</button>
        <a href="#roles-permissions">إدارة الدور والصلاحيات</a>
        ${
          i.status === 'suspended'
            ? `<button type="button" data-action="idn-reactivate" data-id="${esc(i.naioshId)}">إعادة التفعيل</button>`
            : `<button type="button" data-action="idn-suspend" data-id="${esc(i.naioshId)}">إيقاف الوصول</button>`
        }
      </div>
    </div>`;
  };

  const renderUserRow = (i, mode) => {
    const sec = secOf(i.naioshId);
    const cNo = clientNoOf(i);
    return `<tr data-naiosh="${esc(i.naioshId)}">
      <td class="col-user" data-label="المستخدم">${esc(dash(i.name))}</td>
      <td class="col-nai" data-label="رقم نايوش">${copyBtn(i.naioshId, 'رقم نايوش')}</td>
      <td class="col-cli" data-label="رقم العميل">${cNo ? copyBtn(cNo, 'رقم العميل') : '—'}</td>
      <td class="col-emp" data-label="رقم الموظف">${i.employeeNo ? copyBtn(i.employeeNo, 'رقم الموظف') : '—'}</td>
      <td class="col-mail" data-label="البريد الإلكتروني" dir="ltr" title="${esc(i.email || '')}">${esc(dash(i.email))}</td>
      <td class="col-kind" data-label="نوع المستخدم">${esc(userKindAr(i))}</td>
      <td class="col-org" data-label="المؤسسة / الجهة">${esc(dash(i.orgName))}</td>
      <td class="col-branch" data-label="الفرع">${esc(dash(i.branchName))}</td>
      <td class="col-dept" data-label="القسم">${esc(dash(i.department))}</td>
      <td class="col-job" data-label="المسمى الوظيفي">${esc(dash(i.jobTitle))}</td>
      <td class="col-role" data-label="الدور" title="${esc(primaryRoleAr(i))}">${esc(primaryRoleAr(i))}</td>
      <td class="col-status" data-label="الحالة"><span class="idn-status is-${esc(i.status || 'active')}">${esc(statusAr(i.status || 'active'))}</span></td>
      <td class="col-login" data-label="آخر دخول">${esc(fmt(sec.lastLoginAt || i.updatedAt))}</td>
      <td class="col-acts" data-label="الإجراءات">${actionsMenu(i, mode)}</td>
    </tr>`;
  };

  const renderUserCards = (rows, mode) => {
    if (!rows.length) return '';
    return `<div class="idn-mobile-cards">${rows
      .map((i) => {
        const cNo = clientNoOf(i);
        return `<article class="idn-mcard">
          <header><strong>${esc(dash(i.name))}</strong><span class="idn-status is-${esc(i.status || 'active')}">${esc(statusAr(i.status || 'active'))}</span></header>
          <dl>
            <div><dt>رقم نايوش</dt><dd dir="ltr">${esc(dash(i.naioshId))}</dd></div>
            <div><dt>رقم العميل</dt><dd dir="ltr">${esc(cNo || '—')}</dd></div>
            <div><dt>رقم الموظف</dt><dd dir="ltr">${esc(i.employeeNo || '—')}</dd></div>
            <div><dt>البريد</dt><dd dir="ltr">${esc(dash(i.email))}</dd></div>
            <div><dt>النوع</dt><dd>${esc(userKindAr(i))}</dd></div>
            <div><dt>المؤسسة</dt><dd>${esc(dash(i.orgName))}</dd></div>
            <div><dt>الفرع</dt><dd>${esc(dash(i.branchName))}</dd></div>
            <div><dt>القسم</dt><dd>${esc(dash(i.department))}</dd></div>
            <div><dt>الدور</dt><dd>${esc(primaryRoleAr(i))}</dd></div>
          </dl>
          <footer>${actionsMenu(i, mode)}</footer>
        </article>`;
      })
      .join('')}</div>`;
  };

  const renderUsersTable = (rows, mode = 'users') => {
    if (!rows.length) return `<div class="idn-empty"><p>لا توجد هويات مطابقة.</p></div>`;
    return `${renderUserCards(rows, mode)}
    <div class="idn-table-wrap idn-registry-wrap"><table class="idn-table idn-registry">
      <thead><tr>
        <th class="col-user">المستخدم</th>
        <th class="col-nai">رقم نايوش</th>
        <th class="col-cli">رقم العميل</th>
        <th class="col-emp">رقم الموظف</th>
        <th class="col-mail">البريد الإلكتروني</th>
        <th class="col-kind">نوع المستخدم</th>
        <th class="col-org">المؤسسة / الجهة</th>
        <th class="col-branch">الفرع</th>
        <th class="col-dept">القسم</th>
        <th class="col-job">المسمى الوظيفي</th>
        <th class="col-role">الدور</th>
        <th class="col-status">الحالة</th>
        <th class="col-login">آخر دخول</th>
        <th class="col-acts">الإجراءات</th>
      </tr></thead>
      <tbody>${rows.map((i) => renderUserRow(i, mode)).join('')}</tbody>
    </table></div>`;
  };

  const renderUsersView = (mode = 'users') => {
    const rows = filteredIdentities();
    return `<div class="idn-users-head">
      <div>
        <h2 class="idn-section-title">${mode === 'accounts' ? 'إدارة الحسابات' : 'المستخدمون والهويات'}</h2>
        <p class="idn-section-sub">إدارة حسابات وهويات المستخدمين المرتبطين بنايوش والمؤسسات والفروع، ومعرفة جهة كل مستخدم ونوعه وحالة حسابه.</p>
      </div>
    </div>
    ${filtersBar('', mode)}
    <p class="idn-muted idn-count">عرض ${rows.length} من ${identities().length} هوية</p>
    ${renderUsersTable(rows, mode)}`;
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
    const audit = (ag().audit || ag().auditLog || [])
      .filter((a) => a.naioshId === i.naioshId || a.targetNaioshId === i.naioshId || a.employeeNo === i.employeeNo)
      .slice(0, 12);

    const field = (label, value, ltr = false) => {
      if (value == null || value === '') return '';
      return `<li><span>${esc(label)}</span><strong ${ltr ? 'dir="ltr"' : ''}>${esc(value)}</strong></li>`;
    };

    return `<div class="idn-detail">
      <div class="idn-toolbar">
        <button type="button" class="btn btn-ghost btn-sm" data-action="idn-view" data-view="users"><i class="fas fa-arrow-right"></i> رجوع</button>
        <button type="button" class="btn btn-dark btn-sm" data-action="idn-edit-open" data-id="${esc(i.naioshId)}">تعديل</button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="idn-affil-open" data-id="${esc(i.naioshId)}">إدارة الارتباط</button>
        <a class="btn btn-ghost btn-sm" href="#roles-permissions">إدارة الدور والصلاحيات</a>
      </div>
      <h2>ملف المستخدم</h2>
      <p class="idn-sub">${esc(i.name || '')} · ${esc(userKindAr(i))} · ${esc(statusAr(i.status || 'active'))}</p>

      <section class="idn-block"><h3>الهوية الأساسية</h3>
        <ul class="idn-dl">
          ${field('الاسم', i.name)}
          ${field('رقم نايوش', i.naioshId, true)}
          ${field('البريد', i.email, true)}
          ${field('الهاتف', i.phone, true)}
          ${field('الدولة', i.country)}
          ${i.nationality ? field('الجنسية', i.nationality) : ''}
          ${field('حالة الحساب', statusAr(i.status || 'active'))}
          ${field('نوع المستخدم', userKindAr(i))}
        </ul>
      </section>

      <section class="idn-block"><h3>الارتباط المؤسسي</h3>
        ${
          i.orgName || i.branchName || i.department || i.jobTitle || i.employeeNo
            ? `<ul class="idn-dl">
          ${field('المؤسسة / الجهة', i.orgName)}
          ${field('الفرع', i.branchName)}
          ${field('القسم', i.department)}
          ${field('المسمى', i.jobTitle)}
          ${field('رقم الموظف', i.employeeNo, true)}
        </ul>`
            : '<p class="idn-muted">لا يوجد ارتباط مؤسسي مسجّل لهذه الهوية.</p>'
        }
      </section>

      <section class="idn-block"><h3>صفة العميل</h3>
        ${
          cNo
            ? `<ul class="idn-dl">
          ${field('رقم العميل', cNo, true)}
          ${field('حالة العميل', i.clientStatus || 'نشط')}
        </ul>`
            : '<p class="idn-muted">ليست له صفة عميل في السجل الحالي.</p>'
        }
      </section>

      <section class="idn-block"><h3>الوصول والصلاحيات</h3>
        <ul class="idn-dl">
          <li><span>الدور</span><strong>${esc(roles.length ? roles.map(roleLabel).join(' · ') : '—')}</strong></li>
          <li><span>الأنظمة المسموح بها</span><strong>${esc(systems.length ? systems.join(' · ') : '—')}</strong></li>
          <li><span>حالة الوصول</span><strong>${esc(statusAr(i.status || 'active'))}</strong></li>
        </ul>
        <p class="idn-perms">${perms.length ? perms.map((p) => `<code>${esc(p)}</code>`).join(' ') : '<span class="idn-muted">لا صلاحيات مباشرة مسجّلة — راجع إدارة فريق العمل.</span>'}</p>
      </section>

      <section class="idn-block"><h3>النشاط</h3>
        <ul class="idn-dl">
          ${field('تاريخ إنشاء الحساب', fmt(i.createdAt))}
          ${field('آخر دخول', fmt(sec.lastLoginAt || i.updatedAt))}
          ${field('آخر تعديل', fmt(i.updatedAt))}
        </ul>
        ${
          audit.length
            ? `<ul class="idn-feed">${audit.map((a) => `<li>${esc(fmt(a.at || a.createdAt))} · ${esc(a.action || a.type || 'حدث')} · ${esc(a.actor || a.by || '')}</li>`).join('')}</ul>`
            : ''
        }
      </section>
    </div>`;
  };

  const blankDraft = () => ({
    name: '',
    email: '',
    phone: '',
    country: 'السعودية',
    userKind: 'INTERNAL',
    orgId: '',
    orgName: '',
    branchName: '',
    department: '',
    jobTitle: '',
    roleCode: 'HUB_EMPLOYEE',
    permissions: [],
    systems: ['HUB'],
  });

  const renderAddWizard = () => {
    const m = ui.modal;
    if (!m || m.kind !== 'add-user') return '';
    const d = ui.addDraft || blankDraft();
    const step = ui.addStep || 1;
    const opts = affOpts();
    const kindList = Object.values(kinds());
    const needsOrg = !!(kinds()[d.userKind]?.needsOrg);

    let body = '';
    if (step === 1) {
      body = `<div class="idn-wizard-grid">
        <label>الاسم<input data-f="name" value="${esc(d.name)}" required /></label>
        <label>البريد الإلكتروني<input data-f="email" type="email" dir="ltr" value="${esc(d.email)}" required /></label>
        <label>الهاتف<input data-f="phone" dir="ltr" value="${esc(d.phone)}" /></label>
        <label>الدولة<input data-f="country" value="${esc(d.country)}" /></label>
      </div>`;
    } else if (step === 2) {
      body = `<div class="idn-kind-grid">
        ${kindList
          .map(
            (k) => `<label class="idn-kind-card ${d.userKind === k.code ? 'is-on' : ''}">
            <input type="radio" name="userKind" data-f="userKind" value="${esc(k.code)}" ${d.userKind === k.code ? 'checked' : ''} />
            <strong>${esc(k.labelAr)}</strong>
          </label>`
          )
          .join('')}
      </div>
      <p class="idn-muted">نوع المستخدم يصف علاقته بالمنظومة — وهو مختلف عن الدور والصلاحيات.</p>`;
    } else if (step === 3) {
      body = needsOrg
        ? `<div class="idn-wizard-grid">
        <label>المؤسسة / الجهة
          <select data-f="orgName">
            <option value="">— اختر —</option>
            ${(opts.orgs || []).map((o) => `<option value="${esc(o.name)}" data-org-id="${esc(o.id)}" ${d.orgName === o.name ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
          </select>
        </label>
        <label>الفرع
          <select data-f="branchName">
            <option value="">—</option>
            ${(opts.branches || []).map((b) => `<option value="${esc(b)}" ${d.branchName === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}
          </select>
        </label>
        <label>القسم
          <select data-f="department">
            <option value="">—</option>
            ${(opts.departments || []).map((x) => `<option value="${esc(x)}" ${d.department === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}
          </select>
        </label>
        <label>المسمى الوظيفي<input data-f="jobTitle" value="${esc(d.jobTitle)}" list="idn-jobs" />
          <datalist id="idn-jobs">${(opts.jobTitles || []).map((j) => `<option value="${esc(j)}"></option>`).join('')}</datalist>
        </label>
      </div>`
        : `<div class="idn-wizard-grid">
        <label>المؤسسة / الجهة (اختياري)
          <select data-f="orgName">
            <option value="">— بدون —</option>
            ${(opts.orgs || []).map((o) => `<option value="${esc(o.name)}" ${d.orgName === o.name ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
          </select>
        </label>
        <label>الفرع (اختياري)
          <select data-f="branchName">
            <option value="">—</option>
            ${(opts.branches || []).map((b) => `<option value="${esc(b)}" ${d.branchName === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}
          </select>
        </label>
        <label>القسم<input data-f="department" value="${esc(d.department)}" /></label>
        <label>المسمى الوظيفي<input data-f="jobTitle" value="${esc(d.jobTitle)}" /></label>
      </div>
      <p class="idn-muted">للموظف الداخلي يمكن ربطه بنايوش أو ترك الارتباط فارغًا.</p>`;
    } else if (step === 4) {
      body = `<div class="idn-wizard-grid">
        <label>الدور
          <select data-f="roleCode">
            ${(opts.roles || []).map((r) => `<option value="${esc(r.code)}" ${d.roleCode === r.code ? 'selected' : ''}>${esc(r.nameAr)}</option>`).join('')}
          </select>
        </label>
        <label>الأنظمة المسموح بها
          <select data-f="systems" multiple size="4">
            ${(ag().systems || []).map((s) => {
              const code = typeof s === 'string' ? s : s.code;
              const name = typeof s === 'string' ? s : s.nameAr || s.code;
              const sel = (d.systems || []).includes(code) ? 'selected' : '';
              return `<option value="${esc(code)}" ${sel}>${esc(name)}</option>`;
            }).join('')}
          </select>
        </label>
      </div>
      <p class="idn-muted">التعديل التفصيلي للصلاحيات يتم من «إدارة فريق العمل والصلاحيات» بعد الحفظ.</p>`;
    } else {
      const kLabel = kinds()[d.userKind]?.labelAr || d.userKind;
      body = `<ul class="idn-dl idn-review">
        <li><span>الاسم</span><strong>${esc(d.name)}</strong></li>
        <li><span>البريد</span><strong dir="ltr">${esc(d.email)}</strong></li>
        <li><span>الهاتف</span><strong dir="ltr">${esc(d.phone || '—')}</strong></li>
        <li><span>الدولة</span><strong>${esc(d.country || '—')}</strong></li>
        <li><span>نوع المستخدم</span><strong>${esc(kLabel)}</strong></li>
        <li><span>المؤسسة</span><strong>${esc(d.orgName || '—')}</strong></li>
        <li><span>الفرع</span><strong>${esc(d.branchName || '—')}</strong></li>
        <li><span>القسم</span><strong>${esc(d.department || '—')}</strong></li>
        <li><span>المسمى</span><strong>${esc(d.jobTitle || '—')}</strong></li>
        <li><span>الدور</span><strong>${esc(roleLabel(d.roleCode))}</strong></li>
      </ul>`;
    }

    const titles = ['الهوية', 'نوع المستخدم', 'الارتباط', 'الوصول', 'مراجعة وحفظ'];
    return `<div class="idn-modal-backdrop" data-action="idn-modal-cancel">
      <div class="idn-modal idn-modal-lg" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
        <header>
          <h3>إضافة مستخدم · ${esc(titles[step - 1] || '')}</h3>
          <button type="button" class="idn-modal-x" data-action="idn-modal-cancel">×</button>
        </header>
        <div class="idn-steps">${titles.map((t, i) => `<span class="${i + 1 === step ? 'is-on' : i + 1 < step ? 'is-done' : ''}">${i + 1}. ${esc(t)}</span>`).join('')}</div>
        <div class="idn-modal-body">${body}${m.error ? `<p class="idn-error">${esc(m.error)}</p>` : ''}</div>
        <footer>
          <button type="button" class="btn btn-ghost" data-action="idn-modal-cancel">إلغاء</button>
          ${step > 1 ? `<button type="button" class="btn btn-ghost" data-action="idn-add-prev">السابق</button>` : ''}
          ${step < 5 ? `<button type="button" class="btn btn-primary" data-action="idn-add-next">التالي</button>` : `<button type="button" class="btn btn-primary" data-action="idn-add-save">حفظ</button>`}
        </footer>
      </div>
    </div>`;
  };

  const renderEditModal = () => {
    const m = ui.modal;
    if (!m || (m.kind !== 'edit-user' && m.kind !== 'affil-user')) return '';
    const i = eng()?.findIdentity?.(m.id);
    if (!i) return '';
    const opts = affOpts();
    const isAffil = m.kind === 'affil-user';
    return `<div class="idn-modal-backdrop" data-action="idn-modal-cancel">
      <div class="idn-modal idn-modal-lg" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
        <header><h3>${isAffil ? 'إدارة الارتباط' : 'تعديل المستخدم'} — ${esc(i.name)}</h3>
          <button type="button" class="idn-modal-x" data-action="idn-modal-cancel">×</button></header>
        <div class="idn-modal-body">
          ${
            !isAffil
              ? `<div class="idn-wizard-grid">
            <label>الاسم<input data-f="name" value="${esc(i.name || '')}" /></label>
            <label>البريد<input data-f="email" dir="ltr" value="${esc(i.email || '')}" /></label>
            <label>الهاتف<input data-f="phone" dir="ltr" value="${esc(i.phone || '')}" /></label>
            <label>الدولة<input data-f="country" value="${esc(i.country || '')}" /></label>
            <label>نوع المستخدم
              <select data-f="userKind">
                ${Object.values(kinds())
                  .map((k) => `<option value="${esc(k.code)}" ${i.userKind === k.code ? 'selected' : ''}>${esc(k.labelAr)}</option>`)
                  .join('')}
              </select>
            </label>
          </div>`
              : ''
          }
          <div class="idn-wizard-grid">
            <label>المؤسسة / الجهة
              <select data-f="orgName">
                <option value="">—</option>
                ${(opts.orgs || []).map((o) => `<option value="${esc(o.name)}" ${i.orgName === o.name ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
              </select>
            </label>
            <label>الفرع
              <select data-f="branchName">
                <option value="">—</option>
                ${(opts.branches || []).map((b) => `<option value="${esc(b)}" ${i.branchName === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}
              </select>
            </label>
            <label>القسم<input data-f="department" value="${esc(i.department || '')}" /></label>
            <label>المسمى الوظيفي<input data-f="jobTitle" value="${esc(i.jobTitle || '')}" /></label>
            ${
              isAffil
                ? `<label>الدور (عبر الحوكمة)
              <select data-f="roleCode">
                <option value="">— بدون تغيير —</option>
                ${(opts.roles || []).map((r) => `<option value="${esc(r.code)}">${esc(r.nameAr)}</option>`).join('')}
              </select>
            </label>`
                : ''
            }
          </div>
          <p class="idn-muted">رقم نايوش: <code dir="ltr">${esc(i.naioshId)}</code>
            ${i.employeeNo ? ` · رقم الموظف: <code dir="ltr">${esc(i.employeeNo)}</code>` : ''}
            ${clientNoOf(i) ? ` · رقم العميل: <code dir="ltr">${esc(clientNoOf(i))}</code>` : ''}
            — لا تُحذف صفة العميل عند تعديل الارتباط الوظيفي.</p>
          ${m.error ? `<p class="idn-error">${esc(m.error)}</p>` : ''}
        </div>
        <footer>
          <button type="button" class="btn btn-ghost" data-action="idn-modal-cancel">إلغاء</button>
          <button type="button" class="btn btn-primary" data-action="idn-edit-save">${isAffil ? 'حفظ الارتباط' : 'حفظ التعديل'}</button>
        </footer>
      </div>
    </div>`;
  };

  const renderSso = () => {
    const rows = ssoStore().systems || [];
    return `${filtersBar(`<button type="button" class="btn btn-primary btn-sm" data-action="idn-sso-add"><i class="fas fa-plus"></i> إضافة نظام</button>`, 'sso')}
      <p class="idn-banner">تسجيل الدخول الموحد يتحقق من الهوية ثم يتحقق من صلاحية الوصول للنظام المطلوب — وجود هوية صالحة لا يعني دخول كل الأنظمة.</p>
      <div class="idn-table-wrap"><table class="idn-table">
        <thead><tr>
          <th>اسم النظام</th><th>الرابط</th><th>حالة الربط</th><th>الدخول الموحد</th>
          <th>آخر اتصال</th><th>آخر دخول</th><th>المستخدمون</th><th>الحالة</th><th>الإجراءات</th>
        </tr></thead>
        <tbody>${rows
          .map((s) => {
            const usersN = (ag().grants || []).filter((g) => g.system === s.code && String(g.status).toUpperCase() === 'ACTIVE').length;
            return `<tr>
              <td>${esc(s.nameAr)} <small class="idn-muted" dir="ltr">${esc(s.code)}</small></td>
              <td dir="ltr"><a href="${esc(s.loginUrl)}" target="_blank" rel="noopener">${esc(s.loginUrl)}</a></td>
              <td>${esc(s.linkStatus === 'linked' ? 'مربوط' : 'غير مربوط')}</td>
              <td>${esc(s.ssoStatus === 'enabled' ? 'مفعّل' : 'متوقف')}</td>
              <td>${esc(fmt(s.lastConnectAt))}</td>
              <td>${esc(fmt(s.lastLoginAt))}</td>
              <td>${usersN}</td>
              <td>${esc(s.serviceStatus === 'active' ? 'نشط' : 'متوقف')}</td>
              <td class="idn-acts">
                <button type="button" class="btn btn-primary btn-sm" data-action="idn-sso-open" data-id="${esc(s.id)}">فتح عبر الدخول الموحد</button>
                <button type="button" class="btn btn-ghost btn-sm" data-action="idn-sso-toggle" data-id="${esc(s.id)}">${s.ssoStatus === 'enabled' ? 'إيقاف' : 'تفعيل'}</button>
              </td>
            </tr>`;
          })
          .join('')}</tbody>
      </table></div>`;
  };

  const renderMfa = (k) => {
    const rows = filteredIdentities();
    return `${filtersBar('', 'mfa')}
      <div class="idn-kpis">
        <article><span>مفعّل</span><strong>${k.mfaOn}</strong></article>
        <article><span>غير مفعّل</span><strong>${k.mfaOff}</strong></article>
        <article class="is-warn"><span>حسابات حساسة بلا حماية</span><strong>${k.sensitiveUnprotected}</strong></article>
        <article><span>سياسة الإلزام</span><strong>${k.requireMfa ? 'نعم' : 'لا'}</strong></article>
      </div>
      <p class="idn-banner">لا تُعرض الرموز السرية أو بيانات الاسترداد.</p>
      <div class="idn-table-wrap"><table class="idn-table">
        <thead><tr>
          <th>المستخدم</th><th>رقم نايوش</th><th>نوع المستخدم</th><th>حالة التحقق</th>
          <th>الطريقة</th><th>تاريخ التفعيل</th><th>آخر تحقق</th><th>الإجراءات</th>
        </tr></thead>
        <tbody>${rows
          .map((i) => {
            const sec = secOf(i.naioshId);
            return `<tr>
              <td>${esc(i.name)}</td>
              <td dir="ltr"><code>${esc(i.naioshId)}</code></td>
              <td>${esc(userKindAr(i))}</td>
              <td>${sec.mfaEnabled ? 'مفعّل' : 'غير مفعّل'}</td>
              <td>${esc(sec.mfaMethod || '—')}</td>
              <td>${esc(fmt(sec.mfaEnabledAt))}</td>
              <td>${esc(fmt(sec.lastVerifiedAt))}</td>
              <td>${
                sec.mfaEnabled
                  ? `<button type="button" class="btn btn-ghost btn-sm" data-action="idn-mfa-off" data-id="${esc(i.naioshId)}">إيقاف</button>`
                  : `<button type="button" class="btn btn-primary btn-sm" data-action="idn-mfa-on" data-id="${esc(i.naioshId)}">تفعيل</button>`
              }</td>
            </tr>`;
          })
          .join('')}</tbody>
      </table></div>`;
  };

  const ACTION_COLS = [
    { key: 'view', label: 'عرض', match: /\.view$|^view$/i },
    { key: 'create', label: 'إضافة', match: /\.(create|submit)$/i },
    { key: 'edit', label: 'تعديل', match: /\.edit$/i },
    { key: 'delete', label: 'حذف', match: /\.(delete|remove)$/i },
    { key: 'publish', label: 'نشر', match: /\.publish$/i },
    { key: 'approve', label: 'اعتماد', match: /\.(approve|assign|manage)$/i },
  ];

  const renderMatrix = () => {
    const employees = (eng()?.listEmployees?.() || identities().filter((i) => i.employeeNo)).slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));
    const emp = ui.matrixEmp ? eng()?.findIdentity?.(ui.matrixEmp) : null;
    const systems = [...new Set((ag().grants || []).map((g) => g.system).filter(Boolean))];
    let grants = (ag().grants || []).filter((g) => String(g.status).toUpperCase() === 'ACTIVE');
    if (emp) grants = grants.filter((g) => g.naioshId === emp.naioshId || g.identityId === emp.id);
    if (ui.matrixSystem) grants = grants.filter((g) => g.system === ui.matrixSystem);

    const bySystem = {};
    grants.forEach((g) => {
      const sys = g.system || 'HUB';
      if (!bySystem[sys]) bySystem[sys] = new Set();
      (g.permissions || []).forEach((p) => bySystem[sys].add(p));
    });

    return `<div class="idn-toolbar">
        <button type="button" class="btn btn-ghost btn-sm" data-action="idn-view" data-view="home"><i class="fas fa-arrow-right"></i> العودة</button>
        <select data-idn-matrix-emp>
          <option value="">كل الموظفين / المنح</option>
          ${employees.map((e) => `<option value="${esc(e.naioshId)}" ${ui.matrixEmp === e.naioshId ? 'selected' : ''}>${esc(e.name)} · ${esc(e.employeeNo || '')}</option>`).join('')}
        </select>
        <select data-idn-matrix-sys>
          <option value="">كل الأنظمة</option>
          ${systems.map((s) => `<option value="${esc(s)}" ${ui.matrixSystem === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
        </select>
        <button type="button" class="btn btn-dark btn-sm" data-action="idn-matrix-apply">تطبيق</button>
        <a class="btn btn-primary btn-sm" href="#roles-permissions">تعديل من إدارة الصلاحيات</a>
      </div>
      ${
        emp
          ? `<div class="idn-banner">الموظف: <b>${esc(emp.name)}</b> · رقم: <code dir="ltr">${esc(emp.employeeNo || '—')}</code> · المؤسسة: ${esc(emp.orgName || '—')} · الأدوار: ${esc(
              [...new Set(grants.map((g) => roleLabel(g.roleCode)))].join(' · ') || '—'
            )}</div>`
          : ''
      }
      <div class="idn-table-wrap"><table class="idn-table idn-matrix">
        <thead><tr><th>النظام</th>${ACTION_COLS.map((c) => `<th>${esc(c.label)}</th>`).join('')}<th>تفاصيل</th></tr></thead>
        <tbody>
          ${
            Object.keys(bySystem).length
              ? Object.entries(bySystem)
                  .map(([sys, set]) => {
                    const list = [...set];
                    return `<tr>
                      <td>${esc(sys)}</td>
                      ${ACTION_COLS.map((c) => {
                        const hit = list.some((p) => c.match.test(p));
                        return `<td class="${hit ? 'is-yes' : 'is-no'}">${hit ? '✓' : '—'}</td>`;
                      }).join('')}
                      <td class="idn-muted">${esc(list.slice(0, 8).join(' · '))}${list.length > 8 ? '…' : ''}</td>
                    </tr>`;
                  })
                  .join('')
              : `<tr><td colspan="${ACTION_COLS.length + 2}">لا صلاحيات مطابقة.</td></tr>`
          }
        </tbody>
      </table></div>`;
  };

  const renderModal = () => {
    const m = ui.modal;
    if (!m) return '';
    if (m.kind === 'add-user') return renderAddWizard();
    if (m.kind === 'edit-user' || m.kind === 'affil-user') return renderEditModal();
    if (m.kind === 'sso-add') {
      const systems = window.HubOpsCatalog?.listSystems?.() || [];
      return `<div class="idn-modal-backdrop" data-action="idn-modal-cancel">
        <div class="idn-modal" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
          <header><h3>إضافة نظام لتسجيل الدخول الموحد</h3><button type="button" class="idn-modal-x" data-action="idn-modal-cancel">×</button></header>
          <div class="idn-modal-body">
            <label>اسم النظام<input data-f="nameAr" value="${esc(m.nameAr || '')}" /></label>
            <label>النظام المرتبط
              <select data-f="code">
                ${systems.map((s) => `<option value="${esc(s.code)}">${esc(s.name || s.code)}</option>`).join('')}
                <option value="CUSTOM">مخصص…</option>
              </select>
            </label>
            <label>رمز مخصص (إن لزم)<input data-f="customCode" dir="ltr" placeholder="SYSCODE" /></label>
            <label>رابط الدخول<input data-f="loginUrl" dir="ltr" placeholder="https://..." /></label>
            <label>طريقة المصادقة
              <select data-f="authMethod">
                <option value="hub-ticket">تذكرة هوب (الموجودة)</option>
                <option value="session">جلسة هوب</option>
              </select>
            </label>
            <label>ملاحظات<textarea data-f="notes" rows="2"></textarea></label>
            <p class="idn-muted">لا تُدخل مفاتيح أو أسرارًا في هذا النموذج.</p>
            ${m.error ? `<p class="idn-error">${esc(m.error)}</p>` : ''}
          </div>
          <footer>
            <button type="button" class="btn btn-ghost" data-action="idn-modal-cancel">إلغاء</button>
            <button type="button" class="btn btn-primary" data-action="idn-modal-ok">حفظ</button>
          </footer>
        </div>
      </div>`;
    }
    if (m.kind === 'confirm') {
      return `<div class="idn-modal-backdrop" data-action="idn-modal-cancel">
        <div class="idn-modal" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
          <header><h3>${esc(m.title || 'تأكيد')}</h3><button type="button" class="idn-modal-x" data-action="idn-modal-cancel">×</button></header>
          <div class="idn-modal-body"><p>${esc(m.body || '')}</p>${m.error ? `<p class="idn-error">${esc(m.error)}</p>` : ''}</div>
          <footer>
            <button type="button" class="btn btn-ghost" data-action="idn-modal-cancel">إلغاء</button>
            <button type="button" class="btn btn-primary" data-action="idn-modal-ok">${esc(m.okLabel || 'تأكيد')}</button>
          </footer>
        </div>
      </div>`;
    }
    return '';
  };

  const render = (ctx = {}) => {
    const { user } = ctx;
    if (!canManage(user)) return `<div class="hub-idn-ws">${renderDenied()}</div>`;
    const k = liveKpis();
    let body = '';
    if (ui.view === 'home') body = renderHome(k);
    else if (ui.view === 'users') body = renderUsersView('users');
    else if (ui.view === 'accounts') body = renderUsersView('accounts');
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
          <a class="btn btn-ghost btn-sm" href="#rent-admin">موافقات المدير الأعلى</a>
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
    ui.org = document.querySelector('[data-idn-org]')?.value ?? ui.org;
    ui.branch = document.querySelector('[data-idn-branch]')?.value ?? ui.branch;
    ui.department = document.querySelector('[data-idn-department]')?.value ?? ui.department;
    ui.role = document.querySelector('[data-idn-role]')?.value ?? ui.role;
  };

  const readDraftFields = () => {
    const box = document.querySelector('.idn-modal');
    if (!box) return ui.addDraft || blankDraft();
    const d = { ...(ui.addDraft || blankDraft()) };
    box.querySelectorAll('[data-f]').forEach((el) => {
      const key = el.getAttribute('data-f');
      if (el.tagName === 'SELECT' && el.multiple) {
        d[key] = [...el.selectedOptions].map((o) => o.value);
      } else if (el.type === 'radio') {
        if (el.checked) d[key] = el.value;
      } else {
        d[key] = el.value;
      }
    });
    const orgSel = box.querySelector('[data-f="orgName"]');
    if (orgSel?.selectedOptions?.[0]) {
      d.orgId = orgSel.selectedOptions[0].getAttribute('data-org-id') || d.orgId || '';
    }
    ui.addDraft = d;
    return d;
  };

  const handle = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
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
    if (action === 'idn-filter') {
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
      if (v && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(v).then(() => toast?.('تم النسخ')).catch(() => toast?.(v));
      } else toast?.(v);
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
      ui.modal = { kind: 'add-user', error: '' };
      ui.menuId = null;
      return true;
    }
    if (action === 'idn-add-prev') {
      readDraftFields();
      ui.addStep = Math.max(1, (ui.addStep || 1) - 1);
      ui.modal = { ...(ui.modal || { kind: 'add-user' }), error: '' };
      return true;
    }
    if (action === 'idn-add-next') {
      const d = readDraftFields();
      const step = ui.addStep || 1;
      if (step === 1 && (!d.name?.trim() || !d.email?.trim())) {
        ui.modal = { kind: 'add-user', error: 'الاسم والبريد مطلوبان' };
        return true;
      }
      if (step === 2 && !d.userKind) {
        ui.modal = { kind: 'add-user', error: 'اختر نوع المستخدم' };
        return true;
      }
      if (step === 3 && kinds()[d.userKind]?.needsOrg && !d.orgName) {
        ui.modal = { kind: 'add-user', error: 'المؤسسة مطلوبة لهذا النوع' };
        return true;
      }
      ui.addStep = Math.min(5, step + 1);
      ui.modal = { kind: 'add-user', error: '' };
      return true;
    }
    if (action === 'idn-add-save') {
      const d = readDraftFields();
      try {
        const actor = user?.name || user?.email || 'مشغّل هوب';
        if (d.orgName === 'نايوش' && !d.orgId) d.orgId = 'ORG-NAIOSH';
        eng()?.createUserIdentity?.(
          {
            name: d.name,
            email: d.email,
            phone: d.phone,
            country: d.country,
            userKind: d.userKind,
            orgId: d.orgId,
            orgName: d.orgName,
            branchName: d.branchName,
            department: d.department,
            jobTitle: d.jobTitle,
            roleCode: d.roleCode,
            systems: d.systems,
            reason: 'إضافة من سجل الهويات',
          },
          actor
        );
        ui.modal = null;
        ui.addDraft = null;
        ui.view = 'users';
        toast?.('تم حفظ الهوية في السجل المركزي');
      } catch (e) {
        ui.modal = { kind: 'add-user', error: e.message || 'تعذر الحفظ' };
      }
      return true;
    }
    if (action === 'idn-edit-open') {
      ui.modal = { kind: 'edit-user', id: btn.dataset.id, error: '' };
      ui.menuId = null;
      return true;
    }
    if (action === 'idn-affil-open') {
      ui.modal = { kind: 'affil-user', id: btn.dataset.id, error: '' };
      ui.menuId = null;
      return true;
    }
    if (action === 'idn-edit-save') {
      const m = ui.modal;
      const box = document.querySelector('.idn-modal');
      if (!m || !box) return true;
      const patch = {};
      box.querySelectorAll('[data-f]').forEach((el) => {
        const key = el.getAttribute('data-f');
        if (key === 'roleCode') return;
        if (el.tagName === 'SELECT' && el.multiple) patch[key] = [...el.selectedOptions].map((o) => o.value);
        else patch[key] = el.value;
      });
      try {
        const actor = user?.name || 'مشغّل هوب';
        if (patch.orgName === 'نايوش') patch.orgId = 'ORG-NAIOSH';
        else if (patch.orgName) {
          const hit = (eng()?.listOrganizations?.() || []).find((o) => o.name === patch.orgName);
          if (hit) patch.orgId = hit.id;
        }
        eng()?.updateIdentity?.(m.id, { ...patch, reason: m.kind === 'affil-user' ? 'تحديث الارتباط المؤسسي' : 'تعديل ملف المستخدم' }, actor);
        const roleCode = box.querySelector('[data-f="roleCode"]')?.value;
        if (roleCode && m.kind === 'affil-user') {
          const id = eng()?.findIdentity?.(m.id);
          const existing = (ag().grants || []).find((g) => g.naioshId === m.id && String(g.status).toUpperCase() === 'ACTIVE');
          if (existing) {
            eng()?.updateGrant?.(existing.id || existing.grantId, { roleCode, reason: 'تغيير الدور من إدارة الهوية' }, actor);
          } else if (id) {
            eng()?.createGrant?.(
              {
                naioshId: id.naioshId,
                roleCode,
                system: 'HUB',
                scopeCode: 'HUB-GLOBAL',
                purpose: 'تعيين دور من إدارة الهوية',
              },
              actor
            );
          }
        }
        ui.modal = null;
        toast?.('تم حفظ التغييرات في السجل');
      } catch (e) {
        ui.modal = { ...m, error: e.message || 'تعذر الحفظ' };
      }
      return true;
    }
    if (action === 'idn-matrix-apply') {
      ui.matrixEmp = document.querySelector('[data-idn-matrix-emp]')?.value || '';
      ui.matrixSystem = document.querySelector('[data-idn-matrix-sys]')?.value || '';
      return true;
    }
    if (action === 'idn-mfa-on') {
      patchSec(btn.dataset.id, { mfaEnabled: true, mfaMethod: 'تطبيق مصادقة', mfaEnabledAt: nowIso(), lastVerifiedAt: nowIso() });
      toast?.('تم تفعيل حالة التحقق الثنائي للحساب');
      return true;
    }
    if (action === 'idn-mfa-off') {
      ui.modal = {
        kind: 'confirm',
        title: 'إيقاف التحقق الثنائي',
        body: 'هل تريد إيقاف حالة التحقق الثنائي لهذا الحساب؟',
        okLabel: 'تأكيد الإيقاف',
        next: 'mfa-off',
        id: btn.dataset.id,
      };
      return true;
    }
    if (action === 'idn-suspend') {
      ui.modal = {
        kind: 'confirm',
        title: 'إيقاف الوصول',
        body: 'سيتم إيقاف وصول الحساب دون حذف الهوية أو صفة العميل إن وُجدت.',
        okLabel: 'إيقاف الوصول',
        next: 'suspend',
        id: btn.dataset.id,
      };
      ui.menuId = null;
      return true;
    }
    if (action === 'idn-reactivate') {
      try {
        eng()?.reactivateIdentity?.(btn.dataset.id, user?.name || 'مشغّل هوب', 'إعادة تفعيل من هوية نايوش');
        toast?.('أُعيد تفعيل الحساب');
      } catch (e) {
        toast?.(e.message || 'تعذر التفعيل');
      }
      ui.menuId = null;
      return true;
    }
    if (action === 'idn-sso-add') {
      ui.modal = { kind: 'sso-add', nameAr: '', error: '' };
      return true;
    }
    if (action === 'idn-sso-toggle') {
      const s = ssoStore();
      const row = s.systems.find((x) => x.id === btn.dataset.id);
      if (row) {
        row.ssoStatus = row.ssoStatus === 'enabled' ? 'disabled' : 'enabled';
        saveSso(s);
        toast?.(row.ssoStatus === 'enabled' ? 'فُعّل الدخول الموحد' : 'أُوقف الدخول الموحد');
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
      const url = window.HubAuth?.attachSsoParams?.(row.loginUrl, row.code) || row.loginUrl;
      window.open(url, '_blank', 'noopener');
      toast?.('فُتح الرابط بجلسة الدخول الموحد إن وُجدت');
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
        let code = box?.querySelector('[data-f="code"]')?.value;
        const custom = box?.querySelector('[data-f="customCode"]')?.value?.trim();
        if (code === 'CUSTOM') code = custom;
        code = String(code || '').toUpperCase();
        const loginUrl = box?.querySelector('[data-f="loginUrl"]')?.value?.trim();
        const authMethod = box?.querySelector('[data-f="authMethod"]')?.value || 'hub-ticket';
        const notes = box?.querySelector('[data-f="notes"]')?.value || '';
        if (!nameAr || !code || !loginUrl) {
          ui.modal = { ...m, error: 'الاسم والرمز ورابط الدخول مطلوبة' };
          return true;
        }
        const s = ssoStore();
        if (s.systems.some((x) => x.code === code)) {
          ui.modal = { ...m, error: 'النظام مسجّل مسبقًا' };
          return true;
        }
        s.systems.push({
          id: `sso-${code}-${Date.now().toString(36)}`,
          code,
          nameAr,
          loginUrl,
          linkedSystem: code,
          linkStatus: 'linked',
          ssoStatus: 'enabled',
          authMethod,
          serviceStatus: 'active',
          lastConnectAt: '',
          lastLoginAt: '',
          notes,
          createdAt: nowIso(),
        });
        saveSso(s);
        ui.modal = null;
        toast?.('أُضيف النظام لتسجيل الدخول الموحد');
        return true;
      }
      if (m.kind === 'confirm' && m.next === 'mfa-off') {
        patchSec(m.id, { mfaEnabled: false, mfaMethod: '', mfaEnabledAt: '' });
        ui.modal = null;
        toast?.('أُوقف التحقق الثنائي');
        return true;
      }
      if (m.kind === 'confirm' && m.next === 'suspend') {
        const id = eng()?.findIdentity?.(m.id);
        const grants = (ag().grants || []).filter((g) => g.naioshId === m.id && String(g.status).toUpperCase() === 'ACTIVE');
        const sensitive = grants.some((g) => ['SUPER_ADMIN', 'HUB_ADMIN'].includes(g.roleCode) || (g.permissions || []).some((p) => /manage|assign/i.test(p)));
        if (sensitive && window.HubHigherApprovals?.createRequest) {
          window.HubHigherApprovals.createRequest(
            {
              type: 'sensitive_op',
              typeLabel: 'إيقاف حساب حساس',
              subjectName: id?.name || m.id,
              subjectEmployeeNo: id?.employeeNo || '',
              subjectNaioshId: m.id,
              system: 'HUB',
              systemLabel: 'هوية نايوش',
              affectedLabel: id?.name || m.id,
              reason: 'طلب إيقاف حساب ذي صلاحيات حساسة',
              currentDisplay: `الحالة: ${statusAr(id?.status || 'active')}`,
              requestedDisplay: 'الحالة: موقوف',
              applyPayload: { action: 'suspend', naioshId: m.id },
              requiresHigherManagerApproval: true,
            },
            user
          );
          ui.modal = null;
          ui.note = 'أُنشئ طلب موافقة في موافقات المدير الأعلى — لم يُنفَّذ الإيقاف بعد.';
          toast?.('أُرسل لموافقات المدير الأعلى');
          return true;
        }
        try {
          eng()?.suspendIdentity?.(m.id, user?.name || 'مشغّل هوب', 'إيقاف من هوية نايوش');
          ui.modal = null;
          toast?.('تم إيقاف الوصول');
        } catch (e) {
          ui.modal = { ...m, error: e.message || 'تعذر الإيقاف' };
        }
        return true;
      }
      return true;
    }
    return false;
  };

  const handleChange = () => false;

  window.HubIdentityUI = { render, handle, handleChange, ui, liveKpis, secOf, userKindAr, clientNoOf, filteredIdentities };
})();
