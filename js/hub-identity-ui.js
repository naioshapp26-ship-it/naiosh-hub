/**
 * هوية نايوش — مركز إدارة الهوية (مربوط بـ HubAccessGov + فريق العمل)
 * لا يكرر نظام الصلاحيات؛ يفتح #roles-permissions للمصدر المعتمد.
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
  const ag = () => window.HubAccessGovStore?.get?.() || { identities: [], grants: [], roles: [], permissions: [], systems: [], managedSystems: [], audit: [] };
  const eng = () => window.HubAccessGov;

  const ui = {
    view: 'home', // home | users | sso | mfa | accounts | matrix | detail
    q: '',
    type: '',
    status: '',
    openId: null,
    matrixEmp: '',
    matrixSystem: '',
    modal: null,
    note: '',
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
    try {
      const clients = window.HubStore?.get?.()?.clients || window.HubStore?.clientsBag?.()?.clients || [];
      const hit = clients.find((c) => c.email && id.email && String(c.email).toLowerCase() === String(id.email).toLowerCase());
      return hit?.clientId || hit?.id || hit?.customerNo || '';
    } catch {
      return '';
    }
  };

  const accountTypeAr = (id) => {
    if (id?.userType === 'STAFF' || id?.isEmployee) return id?.employeeNo ? 'موظف' : 'مستخدم موظّف';
    if (id?.userType === 'CUSTOMER') return 'عميل';
    return 'مستخدم';
  };

  const statusAr = (s) =>
    ({ active: 'نشط', suspended: 'موقوف', archived: 'مؤرشف', revoked: 'ملغى' }[s] || s || '—');

  const identities = () => (ag().identities || []).slice();

  const filteredIdentities = () => {
    let rows = identities();
    if (ui.type === 'staff') rows = rows.filter((i) => i.userType === 'STAFF' || i.isEmployee);
    if (ui.type === 'customer') rows = rows.filter((i) => i.userType === 'CUSTOMER' && !i.isEmployee);
    if (ui.status) rows = rows.filter((i) => String(i.status || 'active') === ui.status);
    if (ui.q) {
      const q = ui.q.toLowerCase();
      rows = rows.filter((i) =>
        [i.name, i.naioshId, i.employeeNo, i.email, clientNoOf(i)]
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
    return {
      users: rows.length,
      staff: rows.filter((i) => i.userType === 'STAFF' || i.isEmployee).length,
      customers: rows.filter((i) => i.userType === 'CUSTOMER' && !i.isEmployee).length,
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
      return r === 'SUPER_ADMIN' || r === 'HUB_ADMIN' || r === 'SUPREME_LEADER' || r === 'ADMIN' || r === 'SUPREME_LEADER';
    } catch {
      const r = String(user?.role || user?.roleCode || '').toUpperCase();
      return r === 'SUPER_ADMIN' || r === 'HUB_ADMIN' || r === 'ADMIN';
    }
  };

  const cards = (k) => [
    {
      id: 'users',
      icon: 'fa-user-plus',
      title: 'تسجيل المستخدمين',
      desc: 'عرض وإدارة الحسابات المسجلة في هوية نايوش.',
      stat: `${k.users} حساب`,
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
      desc: 'إدارة حالة وبيانات حسابات الهوية وربط العميل/الموظف.',
      stat: `${k.staff} موظف · ${k.customers} عميل`,
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
      <article><span>الحسابات</span><strong>${k.users}</strong></article>
      <article><span>موظفون</span><strong>${k.staff}</strong></article>
      <article><span>تحقق ثنائي مفعّل</span><strong>${k.mfaOn}</strong></article>
      <article><span>أنظمة الدخول الموحد</span><strong>${k.ssoSystems}</strong></article>
      <article class="${k.sensitiveUnprotected ? 'is-warn' : ''}"><span>حسابات حساسة بلا تحقق</span><strong>${k.sensitiveUnprotected}</strong></article>
    </div>
    ${k.sensitiveUnprotected && k.requireMfa ? `<p class="idn-banner is-warn">السياسة تلزم التحقق الثنائي للحسابات الإدارية — يوجد ${k.sensitiveUnprotected} حسابًا غير محمي.</p>` : ''}
    <h2 class="idn-section-title">مكونات الهوية</h2>
    <p class="idn-section-sub">كل بطاقة تفتح إدارة فعلية. الصلاحيات تُدار من مصدر واحد فقط.</p>
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
    <p class="idn-footnote">ملاحظة أمنية: تسجيل الدخول الموحد يثبت الهوية فقط؛ الوصول لكل نظام يخضع للصلاحيات الفعلية في الحوكمة. تحدي التحقق الثنائي عند تسجيل الدخول يعتمد على إعدادات الخادم — هنا تُدار حالة التفعيل والسياسة.</p>
  `;

  const filtersBar = (extra = '') => `
    <div class="idn-toolbar">
      <button type="button" class="btn btn-ghost btn-sm" data-action="idn-view" data-view="home"><i class="fas fa-arrow-right"></i> العودة</button>
      <input type="search" data-idn-q placeholder="بحث: الاسم · رقم نايوش · رقم موظف · رقم عميل · البريد" value="${esc(ui.q)}" />
      <select data-idn-type>
        <option value="">كل الأنواع</option>
        <option value="staff" ${ui.type === 'staff' ? 'selected' : ''}>موظف</option>
        <option value="customer" ${ui.type === 'customer' ? 'selected' : ''}>عميل</option>
      </select>
      <select data-idn-status>
        <option value="">كل الحالات</option>
        <option value="active" ${ui.status === 'active' ? 'selected' : ''}>نشط</option>
        <option value="suspended" ${ui.status === 'suspended' ? 'selected' : ''}>موقوف</option>
        <option value="archived" ${ui.status === 'archived' ? 'selected' : ''}>مؤرشف</option>
      </select>
      <button type="button" class="btn btn-dark btn-sm" data-action="idn-filter">تصفية</button>
      ${extra}
    </div>`;

  const renderUsersTable = (rows, mode = 'users') => {
    if (!rows.length) return `<div class="idn-empty"><p>لا توجد حسابات مطابقة.</p></div>`;
    return `<div class="idn-table-wrap"><table class="idn-table">
      <thead><tr>
        <th>اسم المستخدم</th><th>رقم نايوش</th><th>رقم العميل</th><th>رقم الموظف</th>
        <th>البريد</th><th>نوع الحساب</th><th>تاريخ التسجيل</th><th>آخر دخول</th>
        <th>الحالة</th><th>التحقق الثنائي</th><th>الإجراءات</th>
      </tr></thead>
      <tbody>${rows
        .map((i) => {
          const sec = secOf(i.naioshId);
          return `<tr>
            <td>${esc(i.name || '—')}</td>
            <td dir="ltr"><code>${esc(i.naioshId || '—')}</code></td>
            <td dir="ltr">${esc(clientNoOf(i) || '—')}</td>
            <td dir="ltr">${esc(i.employeeNo || '—')}</td>
            <td dir="ltr">${esc(i.email || '—')}</td>
            <td>${esc(accountTypeAr(i))}</td>
            <td>${esc(fmt(i.createdAt))}</td>
            <td>${esc(fmt(sec.lastLoginAt || i.updatedAt))}</td>
            <td>${esc(statusAr(i.status || 'active'))}</td>
            <td>${sec.mfaEnabled ? 'مفعّل' : 'غير مفعّل'}</td>
            <td class="idn-acts">
              <button type="button" class="btn btn-primary btn-sm" data-action="idn-detail" data-id="${esc(i.naioshId)}">عرض الحساب</button>
              ${
                mode === 'accounts'
                  ? i.status === 'suspended'
                    ? `<button type="button" class="btn btn-dark btn-sm" data-action="idn-reactivate" data-id="${esc(i.naioshId)}">إعادة تفعيل</button>`
                    : `<button type="button" class="btn btn-ghost btn-sm" data-action="idn-suspend" data-id="${esc(i.naioshId)}">إيقاف</button>`
                  : ''
              }
            </td>
          </tr>`;
        })
        .join('')}</tbody></table></div>`;
  };

  const renderDetail = (id) => {
    const i = eng()?.findIdentity?.(id) || identities().find((x) => x.naioshId === id);
    if (!i) return `<div class="idn-empty"><p>الحساب غير موجود.</p><button type="button" class="btn btn-ghost" data-action="idn-view" data-view="accounts">رجوع</button></div>`;
    const sec = secOf(i.naioshId);
    const grants = (ag().grants || []).filter((g) => g.naioshId === i.naioshId || g.identityId === i.id);
    const active = grants.filter((g) => String(g.status).toUpperCase() === 'ACTIVE');
    const systems = [...new Set(active.map((g) => g.system).filter(Boolean))];
    const roles = [...new Set(active.map((g) => g.roleCode).filter(Boolean))];
    const perms = [...new Set(active.flatMap((g) => g.permissions || []))];
    const audit = (ag().audit || ag().auditLog || [])
      .filter((a) => a.naioshId === i.naioshId || a.targetNaioshId === i.naioshId || a.employeeNo === i.employeeNo)
      .slice(0, 12);
    return `<div class="idn-detail">
      <div class="idn-toolbar">
        <button type="button" class="btn btn-ghost btn-sm" data-action="idn-view" data-view="accounts"><i class="fas fa-arrow-right"></i> رجوع</button>
        <a class="btn btn-dark btn-sm" href="#roles-permissions">إدارة فريق العمل والصلاحيات</a>
      </div>
      <h2>${esc(i.name || 'حساب')}</h2>
      <section class="idn-block"><h3>1) بيانات الهوية</h3>
        <ul class="idn-dl">
          <li><span>رقم نايوش</span><strong dir="ltr">${esc(i.naioshId)}</strong></li>
          <li><span>البريد</span><strong dir="ltr">${esc(i.email || '—')}</strong></li>
          <li><span>نوع الحساب</span><strong>${esc(accountTypeAr(i))}</strong></li>
          <li><span>الحالة</span><strong>${esc(statusAr(i.status || 'active'))}</strong></li>
          <li><span>تاريخ التسجيل</span><strong>${esc(fmt(i.createdAt))}</strong></li>
        </ul>
      </section>
      <section class="idn-block"><h3>2) بيانات العميل</h3>
        <p>${clientNoOf(i) ? `رقم العميل: <code dir="ltr">${esc(clientNoOf(i))}</code>` : 'ليس عميلًا مرتبطًا في سجل العملاء، أو لم يُربط بريده بعد.'}</p>
      </section>
      <section class="idn-block"><h3>3) بيانات الموظف</h3>
        <p>${i.employeeNo ? `رقم الموظف: <code dir="ltr">${esc(i.employeeNo)}</code> · الهوية الأساسية تبقى حتى مع تغيير الدور.` : 'ليس موظفًا رسميًا بعد (لا رقم موظف).'}</p>
      </section>
      <section class="idn-block"><h3>4) الأنظمة المسموح بها</h3>
        <p>${systems.length ? systems.map((s) => `<span class="idn-pill">${esc(s)}</span>`).join(' ') : 'لا أنظمة ممنوحة.'}</p>
        <p class="idn-muted">إخفاء النظام من القائمة لا يكفي — الحوكمة تمنع الوصول إن لم توجد صلاحية.</p>
      </section>
      <section class="idn-block"><h3>5) الأدوار</h3>
        <p>${roles.length ? roles.map((r) => `<span class="idn-pill">${esc(r)}</span>`).join(' ') : '—'}</p>
      </section>
      <section class="idn-block"><h3>6) الصلاحيات</h3>
        <p class="idn-perms">${perms.length ? perms.map((p) => `<code>${esc(p)}</code>`).join(' ') : '—'}</p>
      </section>
      <section class="idn-block"><h3>7) التحقق الثنائي</h3>
        <p>${sec.mfaEnabled ? `مفعّل · الطريقة: ${esc(sec.mfaMethod || 'تطبيق/رمز')} · منذ ${esc(fmt(sec.mfaEnabledAt))}` : 'غير مفعّل'}</p>
        <div class="idn-acts">
          ${
            sec.mfaEnabled
              ? `<button type="button" class="btn btn-ghost btn-sm" data-action="idn-mfa-off" data-id="${esc(i.naioshId)}">إيقاف التحقق الثنائي</button>`
              : `<button type="button" class="btn btn-primary btn-sm" data-action="idn-mfa-on" data-id="${esc(i.naioshId)}">تفعيل التحقق الثنائي</button>`
          }
        </div>
      </section>
      <section class="idn-block"><h3>8) سجل تسجيل الدخول</h3>
        <p>آخر دخول مسجّل في الهوية: ${esc(fmt(sec.lastLoginAt || i.updatedAt))}</p>
        <p class="idn-muted">سجل الجلسات التفصيلي يعتمد على خادم الجلسات إن وُجد — لا تُعرض أسرار أو رموز استرداد.</p>
      </section>
      <section class="idn-block"><h3>9) أنشطة أمنية</h3>
        ${
          audit.length
            ? `<ul class="idn-feed">${audit.map((a) => `<li>${esc(fmt(a.at || a.createdAt))} · ${esc(a.action || a.type || 'حدث')} · ${esc(a.actor || a.by || '')}</li>`).join('')}</ul>`
            : '<p class="idn-muted">لا أنشطة أمنية مسجّلة لهذا الحساب في سجل الحوكمة.</p>'
        }
      </section>
    </div>`;
  };

  const renderSso = () => {
    const rows = ssoStore().systems || [];
    return `${filtersBar(`<button type="button" class="btn btn-primary btn-sm" data-action="idn-sso-add"><i class="fas fa-plus"></i> إضافة نظام</button>`).replace('data-idn-type', 'data-idn-type hidden').replace('data-idn-status', 'data-idn-status hidden')}
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
    return `${filtersBar('')}
      <div class="idn-kpis">
        <article><span>مفعّل</span><strong>${k.mfaOn}</strong></article>
        <article><span>غير مفعّل</span><strong>${k.mfaOff}</strong></article>
        <article class="is-warn"><span>حسابات حساسة بلا حماية</span><strong>${k.sensitiveUnprotected}</strong></article>
        <article><span>سياسة الإلزام</span><strong>${k.requireMfa ? 'نعم' : 'لا'}</strong></article>
      </div>
      <p class="idn-banner">لا تُعرض الرموز السرية أو بيانات الاسترداد. التفعيل هنا يسجّل حالة الحساب؛ تحدي الدخول الفعلي يعتمد على إعدادات الخادم عند تفعيل السياسة.</p>
      <div class="idn-table-wrap"><table class="idn-table">
        <thead><tr>
          <th>المستخدم</th><th>رقم نايوش</th><th>نوع الحساب</th><th>حالة التحقق</th>
          <th>الطريقة</th><th>تاريخ التفعيل</th><th>آخر تحقق</th><th>الإجراءات</th>
        </tr></thead>
        <tbody>${rows
          .map((i) => {
            const sec = secOf(i.naioshId);
            return `<tr>
              <td>${esc(i.name)}</td>
              <td dir="ltr"><code>${esc(i.naioshId)}</code></td>
              <td>${esc(accountTypeAr(i))}</td>
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

    const roleLabel = (code) => (ag().roles || []).find((r) => r.code === code)?.nameAr || code || '—';

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
          ? `<div class="idn-banner">الموظف: <b>${esc(emp.name)}</b> · رقم: <code dir="ltr">${esc(emp.employeeNo || '—')}</code> · الأدوار: ${esc(
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
              : `<tr><td colspan="${ACTION_COLS.length + 2}">لا صلاحيات مطابقة. امنح صلاحية من إدارة فريق العمل ثم أعد التحميل.</td></tr>`
          }
        </tbody>
      </table></div>
      ${
        emp
          ? `<section class="idn-block"><h3>تمييز مصدر الصلاحية</h3>
            <ul class="idn-feed">${grants
              .map((g) => {
                const inherited = (g.permissions || []).length ? 'موروثة من الدور / ممنوحة بالتعيين' : '—';
                return `<li><b>${esc(g.system)}</b> · دور ${esc(roleLabel(g.roleCode))} · ${esc(inherited)} · ${(g.permissions || []).map((p) => `<code>${esc(p)}</code>`).join(' ')}</li>`;
              })
              .join('')}</ul>
            <p class="idn-muted">الاستثناءات/السحب تظهر عند إلغاء التعيين من الإدارة المركزية (الحالة REVOKED).</p>
          </section>`
          : ''
      }`;
  };

  const renderModal = () => {
    const m = ui.modal;
    if (!m) return '';
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
            <p class="idn-muted">لا تُدخل مفاتيح أو أسرارًا في هذا النموذج. التكامل يستخدم تذاكر/جلسة هوب الحالية.</p>
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
    else if (ui.view === 'users') body = filtersBar('') + renderUsersTable(filteredIdentities(), 'users');
    else if (ui.view === 'accounts') body = filtersBar('') + renderUsersTable(filteredIdentities(), 'accounts');
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
          <p class="idn-sub">هوية موحّدة · حساب · صفة · موظف عند التعيين · ثم الأدوار والصلاحيات من المصدر المركزي.</p>
        </div>
        <div class="idn-header-actions">
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
    ui.q = document.querySelector('[data-idn-q]')?.value || ui.q;
    ui.type = document.querySelector('[data-idn-type]')?.value || ui.type;
    ui.status = document.querySelector('[data-idn-status]')?.value || ui.status;
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
      return true;
    }
    if (action === 'idn-filter') {
      readFilters();
      return true;
    }
    if (action === 'idn-detail') {
      ui.openId = btn.dataset.id;
      ui.view = 'detail';
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
        title: 'إيقاف الحساب',
        body: 'سيتم إيقاف وصول الحساب. إن كانت العملية حساسة قد تتطلب موافقة المدير الأعلى حسب السياسة.',
        okLabel: 'إيقاف',
        next: 'suspend',
        id: btn.dataset.id,
      };
      return true;
    }
    if (action === 'idn-reactivate') {
      try {
        eng()?.reactivateIdentity?.(btn.dataset.id, user?.name || 'مشغّل هوب', 'إعادة تفعيل من هوية نايوش');
        toast?.('أُعيد تفعيل الحساب');
      } catch (e) {
        toast?.(e.message || 'تعذر التفعيل');
      }
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
          toast?.('تم إيقاف الحساب');
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

  window.HubIdentityUI = { render, handle, handleChange, ui, liveKpis, secOf };
})();
