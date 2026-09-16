/**
 * حوكمة الوصول والأدوار — واجهة تشغيلية عربية بالكامل
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
    tab: 'overview',
    level: null,
    q: '',
    filters: { level: '', status: '', role: '' },
    selectedUser: null,
    wizard: null,
    confirm: null,
    editProfile: null,
    changeGrant: null,
    success: null,
    permView: null,
  };

  const NAV = [
    { id: 'overview', label: 'نظرة عامة', icon: 'fa-gauge-high' },
    { id: 'users', label: 'المستخدمون', icon: 'fa-users' },
    { id: 'positions', label: 'المناصب', icon: 'fa-sitemap' },
    { id: 'roles', label: 'الأدوار', icon: 'fa-user-shield' },
    { id: 'permissions', label: 'الصلاحيات', icon: 'fa-key' },
    { id: 'authorities', label: 'السلطات', icon: 'fa-scale-balanced' },
    { id: 'scopes', label: 'نطاقات العمل', icon: 'fa-location-dot' },
    { id: 'matrix', label: 'مصفوفة الوصول', icon: 'fa-table-cells' },
    { id: 'assignments', label: 'التعيينات', icon: 'fa-link' },
    { id: 'requests', label: 'طلبات الوصول', icon: 'fa-inbox' },
    { id: 'delegations', label: 'التفويضات', icon: 'fa-handshake' },
    { id: 'temporary', label: 'الوصول المؤقت', icon: 'fa-hourglass-half' },
    { id: 'reviews', label: 'المراجعة والإلغاء', icon: 'fa-clipboard-check' },
    { id: 'sod', label: 'فصل المهام', icon: 'fa-shield-halved' },
    { id: 'audit', label: 'سجل التدقيق', icon: 'fa-clock-rotate-left' },
  ];

  const STATUS_AR = {
    active: 'نشط',
    ACTIVE: 'نشط',
    suspended: 'موقوف',
    SUSPENDED: 'موقوف',
    archived: 'مؤرشف',
    Pending: 'بانتظار الموافقة',
    Approved: 'تمت الموافقة',
    Rejected: 'مرفوض',
    Granted: 'تم المنح',
    EXPIRED: 'منتهي',
    Expired: 'منتهي',
    REVOKED: 'ملغي',
    Revoked: 'ملغي',
    TEMPORARY: 'مؤقت',
  };

  const LEVEL_AR = {
    EMPIRE: 'إمبراطورية نايوش',
    HUB: 'نايوش هوب 360',
    SYSTEM: 'نظام محدد',
    SYSTEMS: 'الأنظمة',
  };

  const ACTION_AR = {
    VIEW: 'عرض',
    CREATE: 'إضافة',
    EDIT: 'تعديل',
    DELETE: 'حذف',
    APPROVE: 'اعتماد',
    REJECT: 'رفض',
    PUBLISH: 'نشر',
    SUSPEND: 'إيقاف',
    MANAGE: 'إدارة',
    ASSIGN: 'تعيين',
    EXECUTE: 'تنفيذ',
    EXPORT: 'تصدير',
    AUDIT: 'تدقيق',
    CONFIGURE: 'إعدادات',
    SUBMIT: 'إرسال',
    UPLOAD: 'رفع',
    SEARCH: 'بحث',
  };

  const badge = (text, cls = '') => `<span class="ag-badge ${cls}">${esc(text)}</span>`;
  const statusBadge = (s) => {
    const ar = STATUS_AR[s] || s || '—';
    const ok = /نشط|تمت|تم المنح/.test(ar);
    const warn = /موقوف|منتهي|ملغي|مؤرشف|بانتظار/.test(ar);
    return badge(ar, ok ? 'ag-badge-ok' : warn ? 'ag-badge-warn' : '');
  };
  const fmt = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return String(iso);
    }
  };
  const state = () => window.HubAccessGovStore.get();
  const engine = () => window.HubAccessGov;

  const labelPos = (code) => (state().positions || []).find((p) => p.code === code)?.nameAr || code || '—';
  const labelRole = (code) => (state().roles || []).find((r) => r.code === code)?.nameAr || code || '—';
  const labelScope = (code) => (state().scopes || []).find((s) => s.code === code)?.nameAr || code || '—';
  const labelSys = (code) => (state().systems || []).find((s) => s.code === code)?.nameAr || code || '—';
  const labelPerm = (code) => {
    const p = (state().permissions || []).find((x) => x.code === code);
    if (!p) return code;
    const act = ACTION_AR[p.action] || p.action;
    return `${p.nameAr || act}`;
  };
  const levelOfGrant = (g) => LEVEL_AR[g.governanceLevel] || (g.system === 'HUB' ? LEVEL_AR.HUB : LEVEL_AR.SYSTEM);

  const primaryGrant = (identity) => {
    const grants = (state().grants || []).filter(
      (g) => g.identityId === identity.id && String(g.status).toUpperCase() === 'ACTIVE'
    );
    return grants[0] || null;
  };

  const renderQuickActions = () => `
    <section class="ag-quick" aria-label="إجراءات سريعة">
      <h3 class="ag-section-title">ماذا تريد أن تفعل؟</h3>
      <div class="ag-quick-grid">
        <button type="button" class="ag-quick-card ag-quick-main" data-action="ag-wizard-open">
          <i class="fas fa-user-plus"></i><strong>+ تعيين مستخدم</strong>
          <span>اختر مستخدمًا وعيّن منصبه ودوره وصلاحياته خطوة بخطوة</span>
        </button>
        <button type="button" class="ag-quick-card" data-action="ag-tab" data-tab="users">
          <i class="fas fa-users"></i><strong>إدارة المستخدمين</strong>
          <span>عرض كل المستخدمين وتعديل تعييناتهم</span>
        </button>
        <button type="button" class="ag-quick-card" data-action="ag-tab" data-tab="permissions">
          <i class="fas fa-key"></i><strong>مراجعة الصلاحيات</strong>
          <span>راجع قاموس الصلاحيات وامنح أو ألغِ وصولًا</span>
        </button>
        <button type="button" class="ag-quick-card" data-action="ag-add-user">
          <i class="fas fa-id-card"></i><strong>إضافة مستخدم جديد</strong>
        </button>
        <button type="button" class="ag-quick-card" data-action="ag-tab" data-tab="users" data-focus="edit">
          <i class="fas fa-pen"></i><strong>تعديل مستخدم</strong>
        </button>
        <button type="button" class="ag-quick-card" data-action="ag-wizard-open">
          <i class="fas fa-arrows-rotate"></i><strong>تغيير منصب أو دور</strong>
        </button>
        <button type="button" class="ag-quick-card" data-action="ag-tab" data-tab="permissions">
          <i class="fas fa-unlock"></i><strong>منح صلاحية</strong>
        </button>
        <button type="button" class="ag-quick-card" data-action="ag-tab" data-tab="users" data-focus="suspend">
          <i class="fas fa-ban"></i><strong>إيقاف وصول</strong>
        </button>
        <button type="button" class="ag-quick-card" data-action="ag-tab" data-tab="assignments">
          <i class="fas fa-link-slash"></i><strong>إلغاء تعيين</strong>
        </button>
        <button type="button" class="ag-quick-card" data-action="ag-tab" data-tab="users">
          <i class="fas fa-magnifying-glass"></i><strong>مراجعة صلاحيات مستخدم</strong>
        </button>
      </div>
      <div class="ag-hero-actions" style="margin-top:12px">
        <button type="button" class="ag-btn ag-btn-primary" data-action="ag-wizard-open"><i class="fas fa-plus"></i> تعيين مستخدم</button>
        <button type="button" class="ag-btn" data-action="ag-tab" data-tab="users">إدارة المستخدمين</button>
        <button type="button" class="ag-btn" data-action="ag-tab" data-tab="permissions">مراجعة الصلاحيات</button>
      </div>
    </section>`;

  const countByLevel = (level) => {
    const grants = (state().grants || []).filter((g) => String(g.status).toUpperCase() === 'ACTIVE');
    if (level === 'EMPIRE') return grants.filter((g) => g.governanceLevel === 'EMPIRE').length;
    if (level === 'HUB') return grants.filter((g) => g.governanceLevel === 'HUB' || g.system === 'HUB').length;
    return grants.filter((g) => g.governanceLevel === 'SYSTEM').length;
  };

  const renderLevels = () => {
    const systems = state().systems || [];
    const posN = (state().positions || []).length;
    const roleN = (state().roles || []).length;
    return `
      <section class="ag-levels" aria-label="مستويات الإدارة">
        <article class="ag-level-card ag-level-empire">
          <div class="ag-level-no">المستوى 01</div>
          <h3>إمبراطورية نايوش</h3>
          <p>المستوى السيادي الأعلى لإدارة المناصب والأدوار المركزية.</p>
          <p class="ag-muted">المستخدمون النشطون: ${countByLevel('EMPIRE')} · المناصب: ${posN} · الأدوار: ${roleN}</p>
          <div class="ag-actions-row">
            <button type="button" class="ag-btn ag-btn-sm" data-action="ag-tab" data-tab="users">المستخدمون</button>
            <button type="button" class="ag-btn ag-btn-sm" data-action="ag-tab" data-tab="positions">المناصب والأدوار</button>
            <button type="button" class="ag-btn ag-btn-sm ag-btn-primary" data-action="ag-wizard-open" data-level="EMPIRE">تعيين مستخدم</button>
          </div>
        </article>
        <article class="ag-level-card ag-level-hub">
          <div class="ag-level-no">المستوى 02</div>
          <h3>نايوش هوب 360</h3>
          <p>إدارة المستخدمين والأدوار والصلاحيات والسلطات ونطاقات العمل والتدقيق داخل الهوب.</p>
          <p class="ag-muted">المستخدمون النشطون: ${countByLevel('HUB')}</p>
          <div class="ag-actions-row">
            <button type="button" class="ag-btn ag-btn-sm" data-action="ag-tab" data-tab="users">المستخدمون</button>
            <button type="button" class="ag-btn ag-btn-sm" data-action="ag-tab" data-tab="roles">المناصب والأدوار</button>
            <button type="button" class="ag-btn ag-btn-sm ag-btn-primary" data-action="ag-wizard-open" data-level="HUB">تعيين مستخدم</button>
          </div>
        </article>
        <article class="ag-level-card ag-level-sys">
          <div class="ag-level-no">المستوى 03</div>
          <h3>الأنظمة</h3>
          <p>المستوى التشغيلي للأنظمة المسجّلة (${systems.length} نظام).</p>
          <p class="ag-muted">تعيينات الأنظمة: ${countByLevel('SYSTEM')}</p>
          <div class="ag-actions-row">
            <button type="button" class="ag-btn ag-btn-sm" data-action="ag-level" data-level="SYSTEMS">عرض الأنظمة</button>
            <button type="button" class="ag-btn ag-btn-sm" data-action="ag-tab" data-tab="users">المستخدمون</button>
            <button type="button" class="ag-btn ag-btn-sm ag-btn-primary" data-action="ag-wizard-open" data-level="SYSTEM">تعيين مستخدم</button>
          </div>
        </article>
      </section>`;
  };

  const renderArchitecture = () => `
    <section class="ag-arch">
      <h3 class="ag-section-title">شرح مختصر للمعمارية</h3>
      <p class="ag-note">صلاحيات النظام لا تنتقل تلقائيًا إلى الهوب، وصلاحيات الهوب لا تنتقل تلقائيًا إلى الإمبراطورية.</p>
      <ol class="ag-arch-flow">
        <li>إمبراطورية نايوش</li><li>نايوش هوب 360</li><li>الأنظمة</li><li>المناصب</li>
        <li>الأدوار</li><li>نطاق العمل</li><li>الصلاحيات</li><li>السلطات</li><li>الوصول</li>
      </ol>
    </section>`;

  const renderStats = () => {
    const s = engine().dashboardStats();
    const cards = [
      ['users', 'إجمالي المستخدمين', s.users],
      ['positions', 'المناصب', s.positions],
      ['roles', 'الأدوار', s.roles],
      ['assignments', 'الوصول الفعال', s.effectiveAccess],
      ['requests', 'طلبات الوصول', s.requests],
      ['delegations', 'التفويضات النشطة', s.activeDelegations],
      ['temporary', 'الوصول المؤقت', s.temporaryAccess],
      ['reviews', 'تحتاج مراجعة', s.needsReview],
      ['temporary', 'تنتهي قريبًا', s.expiringSoon],
      ['reviews', 'الوصول الموقوف', s.suspended],
      ['reviews', 'الوصول الملغى', s.revoked],
      ['sod', 'تعارضات فصل المهام', s.sodConflicts],
      ['reviews', 'وصول يتيم', s.orphanedAccess],
    ];
    return `
      <section class="ag-stats">
        <h3 class="ag-section-title">لوحة حوكمة الوصول</h3>
        <div class="ag-stats-grid">
          ${cards
            .map(
              ([tab, label, value]) => `
            <button type="button" class="ag-stat" data-action="ag-tab" data-tab="${esc(tab)}">
              <strong>${esc(value)}</strong><span>${esc(label)}</span>
            </button>`
            )
            .join('')}
        </div>
      </section>`;
  };

  const renderNav = () => `
    <nav class="ag-nav" aria-label="أقسام الصفحة">
      ${NAV.map(
        (t) =>
          `<button type="button" class="ag-nav-btn ${ui.tab === t.id ? 'is-on' : ''}" data-action="ag-tab" data-tab="${esc(t.id)}">
            <i class="fas ${esc(t.icon)}"></i><span>${esc(t.label)}</span>
          </button>`
      ).join('')}
    </nav>`;

  const searchBar = (ph) => `
    <div class="ag-toolbar">
      <input type="search" class="ag-search" id="ag-q" value="${esc(ui.q)}" placeholder="${esc(ph)}" />
      <button type="button" class="ag-btn" data-action="ag-search">بحث</button>
      <button type="button" class="ag-btn" data-action="ag-clear-filters">مسح الفلاتر</button>
      <button type="button" class="ag-btn ag-btn-primary" data-action="ag-wizard-open"><i class="fas fa-plus"></i> تعيين مستخدم</button>
    </div>`;

  const table = (headers, rows) => `
    <div class="ag-table-wrap"><table class="ag-table">
      <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows || `<tr><td colspan="${headers.length}" class="ag-empty">لا بيانات</td></tr>`}</tbody>
    </table></div>`;

  const userActions = (u, g) => `
    <div class="ag-row-actions">
      <button type="button" class="ag-btn ag-btn-sm" data-action="ag-select-user" data-id="${esc(u.naioshId)}">عرض</button>
      <button type="button" class="ag-btn ag-btn-sm" data-action="ag-edit-user" data-id="${esc(u.naioshId)}">تعديل</button>
      <button type="button" class="ag-btn ag-btn-sm" data-action="ag-change-grant" data-id="${esc(u.naioshId)}" data-gid="${esc(g?.grantId || '')}">تغيير التعيين</button>
      <button type="button" class="ag-btn ag-btn-sm" data-action="ag-user-perms" data-id="${esc(u.naioshId)}">الصلاحيات</button>
      ${
        u.status === 'suspended'
          ? `<button type="button" class="ag-btn ag-btn-sm" data-action="ag-reactivate" data-id="${esc(u.naioshId)}">إعادة تفعيل</button>`
          : `<button type="button" class="ag-btn ag-btn-sm" data-action="ag-confirm" data-kind="suspend" data-id="${esc(u.naioshId)}">إيقاف</button>`
      }
      ${
        g
          ? `<button type="button" class="ag-btn ag-btn-sm" data-action="ag-confirm" data-kind="revoke" data-id="${esc(g.grantId)}" data-user="${esc(u.name)}">إلغاء التعيين</button>`
          : `<button type="button" class="ag-btn ag-btn-sm" data-action="ag-wizard-open" data-user="${esc(u.naioshId)}">تعيين</button>`
      }
      <button type="button" class="ag-btn ag-btn-sm ag-btn-danger" data-action="ag-confirm" data-kind="archive" data-id="${esc(u.naioshId)}" data-user="${esc(u.name)}">أرشفة</button>
    </div>`;

  const renderUsers = () => {
    let rows = state().identities || [];
    const q = String(ui.q || '').trim().toLowerCase();
    if (q) rows = rows.filter((u) => [u.name, u.email, u.naioshId].some((x) => String(x || '').toLowerCase().includes(q)));
    if (ui.filters.status) rows = rows.filter((u) => u.status === ui.filters.status);
    const detail = ui.selectedUser ? engine().effectiveAccess(ui.selectedUser) : null;
    const identity = detail?.identity;

    return `
      <section class="ag-panel">
        <h3 class="ag-section-title">المستخدمون</h3>
        <p class="ag-lead">من هنا تدير تعيينات كل مستخدم: عرض، تعديل، تغيير الدور، الصلاحيات، إيقاف، إلغاء التعيين، أو أرشفة الحساب.</p>
        ${searchBar('ابحث بالاسم أو رقم نايوش أو البريد...')}
        <div class="ag-filters">
          <label>الحالة
            <select id="ag-f-status">
              <option value="">الكل</option>
              <option value="active" ${ui.filters.status === 'active' ? 'selected' : ''}>نشط</option>
              <option value="suspended" ${ui.filters.status === 'suspended' ? 'selected' : ''}>موقوف</option>
              <option value="archived" ${ui.filters.status === 'archived' ? 'selected' : ''}>مؤرشف</option>
            </select>
          </label>
          <button type="button" class="ag-btn" data-action="ag-apply-filters">تطبيق</button>
        </div>
        <div class="ag-split">
          <div>
            ${table(
              ['المستخدم', 'رقم نايوش', 'المستوى', 'المنصب', 'الدور', 'نطاق العمل', 'الحالة', 'تاريخ التعيين', 'آخر تحديث', 'الإجراءات'],
              rows
                .map((u) => {
                  const g = primaryGrant(u);
                  return `<tr class="${ui.selectedUser === u.naioshId ? 'is-selected' : ''}">
                    <td><strong>${esc(u.name)}</strong><div class="ag-muted">${esc(u.email)}</div></td>
                    <td><code>${esc(u.naioshId)}</code></td>
                    <td>${esc(g ? levelOfGrant(g) : '—')}</td>
                    <td>${esc(g ? labelPos(g.positionCode) : '—')}</td>
                    <td>${esc(g ? labelRole(g.roleCode) : '—')}</td>
                    <td>${esc(g ? labelScope(g.scopeCode) : '—')}</td>
                    <td>${statusBadge(u.status)}</td>
                    <td>${fmt(g?.startDate || u.createdAt)}</td>
                    <td>${fmt(u.updatedAt)}</td>
                    <td>${userActions(u, g)}</td>
                  </tr>`;
                })
                .join('')
            )}
          </div>
          <div class="ag-user360">
            ${
              identity
                ? renderUserDetail(identity, detail)
                : `<p class="ag-empty">اختر مستخدمًا من الجدول أو اضغط «عرض» لإدارة كل عملياته من مكان واحد.</p>`
            }
          </div>
        </div>
      </section>`;
  };

  const renderUserDetail = (identity, detail) => {
    const grants = (state().grants || []).filter((g) => g.identityId === identity.id);
    const audit = (state().audit || []).filter((a) => a.targetUser === identity.naioshId).slice(0, 12);
    return `
      <h4>بيانات المستخدم وصلاحياته</h4>
      <p><strong>${esc(identity.name)}</strong> · ${statusBadge(detail.status === 'SUSPENDED' ? 'suspended' : identity.status)}</p>
      <p class="ag-muted">رقم نايوش: <code>${esc(identity.naioshId)}</code><br>البريد: ${esc(identity.email)}</p>
      <div class="ag-actions-row">
        <button type="button" class="ag-btn ag-btn-sm" data-action="ag-edit-user" data-id="${esc(identity.naioshId)}">تعديل البيانات</button>
        <button type="button" class="ag-btn ag-btn-sm ag-btn-primary" data-action="ag-wizard-open" data-user="${esc(identity.naioshId)}">تعيين / تغيير التعيين</button>
        <button type="button" class="ag-btn ag-btn-sm" data-action="ag-user-perms" data-id="${esc(identity.naioshId)}">الصلاحيات</button>
      </div>
      <h5>التعيينات الحالية</h5>
      ${
        grants.length
          ? `<ul class="ag-list">${grants
              .map(
                (g) => `<li>
                  <strong>${esc(levelOfGrant(g))}</strong> · ${esc(labelSys(g.system))}<br>
                  المنصب: ${esc(labelPos(g.positionCode))} · الدور: ${esc(labelRole(g.roleCode))}<br>
                  النطاق: ${esc(labelScope(g.scopeCode))} · ${statusBadge(g.status)}
                  <div class="ag-row-actions" style="margin-top:6px">
                    <button type="button" class="ag-btn ag-btn-sm" data-action="ag-change-grant" data-id="${esc(identity.naioshId)}" data-gid="${esc(g.grantId)}">تعديل</button>
                    <button type="button" class="ag-btn ag-btn-sm" data-action="ag-change-grant" data-id="${esc(identity.naioshId)}" data-gid="${esc(g.grantId)}">تغيير الدور</button>
                    <button type="button" class="ag-btn ag-btn-sm" data-action="ag-user-perms" data-id="${esc(identity.naioshId)}">تغيير الصلاحيات</button>
                    ${
                      String(g.status).toUpperCase() === 'ACTIVE'
                        ? `<button type="button" class="ag-btn ag-btn-sm" data-action="ag-confirm" data-kind="revoke" data-id="${esc(g.grantId)}" data-user="${esc(identity.name)}">إلغاء التعيين</button>`
                        : ''
                    }
                  </div>
                </li>`
              )
              .join('')}</ul>`
          : `<p class="ag-empty">لا تعيينات. <button type="button" class="ag-btn ag-btn-sm ag-btn-primary" data-action="ag-wizard-open" data-user="${esc(identity.naioshId)}">تعيين الآن</button></p>`
      }
      <h5>الأنظمة المسموح بها</h5>
      <p>${esc(Object.keys(detail.systems || {}).map(labelSys).join(' · ') || '—')}</p>
      <h5>الصلاحيات الفعلية</h5>
      <p>${esc((detail.permissions || []).map(labelPerm).join(' · ') || '—')}</p>
      <h5>السلطات</h5>
      <p>${esc((detail.authorities || []).join(' · ') || '—')}</p>
      <h5>سجل التغييرات</h5>
      <ul class="ag-list">${audit.map((a) => `<li>${fmt(a.timestamp)} — ${esc(a.action)} — ${esc(a.actor)} — ${esc(a.reason || '')}</li>`).join('') || '<li class="ag-empty">لا أحداث بعد</li>'}</ul>`;
  };

  const renderCatalog = (kind) => {
    if (kind === 'positions') {
      const rows = state().positions || [];
      return `<section class="ag-panel"><h3 class="ag-section-title">المناصب</h3><p class="ag-lead">المنصب يحدد الموقع المؤسسي فقط — لا يمنح صلاحيات تلقائيًا.</p>
        ${table(
          ['الاسم', 'المستوى التنظيمي', 'الأدوار المؤهلة', 'الحالة', 'الإجراءات'],
          rows
            .map(
              (p) => `<tr>
                <td><strong>${esc(p.nameAr)}</strong></td>
                <td>${esc(p.orgLevel === 'EMPIRE' ? 'إمبراطورية نايوش' : p.orgLevel === 'HUB' ? 'نايوش هوب 360' : p.orgLevel)}</td>
                <td>${esc((p.eligibleRoles || []).map(labelRole).join(' · '))}</td>
                <td>${statusBadge(p.status)}</td>
                <td class="ag-row-actions">
                  <button type="button" class="ag-btn ag-btn-sm" data-action="ag-toast" data-msg="عرض المنصب: ${esc(p.nameAr)}">عرض</button>
                  <button type="button" class="ag-btn ag-btn-sm" data-action="ag-wizard-open">تعيين مستخدم</button>
                  <button type="button" class="ag-btn ag-btn-sm" data-action="ag-tab" data-tab="roles">إدارة الأدوار</button>
                </td>
              </tr>`
            )
            .join('')
        )}</section>`;
    }
    if (kind === 'roles') {
      return `<section class="ag-panel"><h3 class="ag-section-title">الأدوار</h3>
        ${table(
          ['الاسم', 'المستوى', 'الأنظمة', 'نطاق العمل الافتراضي', 'الحالة', 'الإجراءات'],
          (state().roles || [])
            .map(
              (r) => `<tr>
                <td><strong>${esc(r.nameAr)}</strong></td>
                <td>${esc(LEVEL_AR[r.level] || r.level)}</td>
                <td>${esc((r.applicableSystems || []).map(labelSys).join(' · '))}</td>
                <td>${esc(labelScope(r.defaultScopeType) === r.defaultScopeType ? (r.defaultScopeType === 'HUB-GLOBAL' ? 'نايوش هوب 360' : r.defaultScopeType === 'GLOBAL' ? 'جميع نايوش' : r.defaultScopeType) : labelScope(r.defaultScopeType))}</td>
                <td>${statusBadge(r.status)}</td>
                <td class="ag-row-actions">
                  <button type="button" class="ag-btn ag-btn-sm" data-action="ag-wizard-open">تعيين لمستخدم</button>
                  <button type="button" class="ag-btn ag-btn-sm" data-action="ag-tab" data-tab="permissions">إدارة الصلاحيات</button>
                </td>
              </tr>`
            )
            .join('')
        )}</section>`;
    }
    if (kind === 'permissions') {
      return `<section class="ag-panel"><h3 class="ag-section-title">الصلاحيات</h3>
        <p class="ag-lead">قاموس الصلاحيات بالعربية. لمنح صلاحية لمستخدم افتحه من جدول المستخدمين.</p>
        <div class="ag-toolbar"><button type="button" class="ag-btn ag-btn-primary" data-action="ag-wizard-open">+ منح صلاحية عبر تعيين</button></div>
        ${table(
          ['الصلاحية', 'المورد', 'الإجراء', 'الحالة', 'الإجراءات'],
          (state().permissions || [])
            .slice(0, 80)
            .map(
              (p) => `<tr>
                <td>${esc(p.nameAr)}</td>
                <td>${esc(p.resource)}</td>
                <td>${esc(ACTION_AR[p.action] || p.action)}</td>
                <td>${statusBadge(p.status)}</td>
                <td><button type="button" class="ag-btn ag-btn-sm" data-action="ag-wizard-open">تعيين</button></td>
              </tr>`
            )
            .join('')
        )}</section>`;
    }
    if (kind === 'authorities') {
      return `<section class="ag-panel"><h3 class="ag-section-title">السلطات</h3>
        ${table(
          ['السلطة', 'النوع', 'الحد', 'الحالة', 'الإجراءات'],
          (state().authorities || [])
            .map(
              (a) => `<tr>
                <td><strong>${esc(a.nameAr)}</strong></td>
                <td>${esc(a.type === 'FINANCIAL' ? 'مالية' : 'حوكمة')}</td>
                <td>${a.limits?.maximum == null ? 'غير محدود' : esc(a.limits.maximum)}</td>
                <td>${statusBadge(a.status)}</td>
                <td><button type="button" class="ag-btn ag-btn-sm" data-action="ag-wizard-open">تعيين</button></td>
              </tr>`
            )
            .join('')
        )}</section>`;
    }
    if (kind === 'scopes') {
      return `<section class="ag-panel"><h3 class="ag-section-title">نطاقات العمل</h3>
        ${table(
          ['النطاق', 'النوع', 'الحالة', 'الإجراءات'],
          (state().scopes || [])
            .map(
              (s) => `<tr>
                <td><strong>${esc(s.nameAr)}</strong></td>
                <td>${esc(s.type === 'GLOBAL' ? 'جميع نايوش' : s.type === 'HUB-GLOBAL' ? 'نايوش هوب فقط' : s.type === 'BRANCH' ? 'فرع محدد' : s.type === 'SYSTEM' ? 'نظام محدد' : s.type)}</td>
                <td>${statusBadge(s.status)}</td>
                <td><button type="button" class="ag-btn ag-btn-sm" data-action="ag-wizard-open">تعيين</button></td>
              </tr>`
            )
            .join('')
        )}</section>`;
    }
    return '';
  };

  const renderAssignments = () => {
    const rows = (state().grants || []).filter((g) => {
      if (!ui.q) return true;
      const q = ui.q.toLowerCase();
      return [g.naioshId, g.roleCode, g.system, labelRole(g.roleCode)].some((x) => String(x).toLowerCase().includes(q));
    });
    return `<section class="ag-panel"><h3 class="ag-section-title">التعيينات</h3>
      ${searchBar('ابحث في التعيينات...')}
      ${table(
        ['المستخدم', 'المستوى', 'المنصب', 'الدور', 'النظام', 'النطاق', 'الحالة', 'الإجراءات'],
        rows
          .map((g) => {
            const u = (state().identities || []).find((i) => i.id === g.identityId);
            return `<tr>
              <td>${esc(u?.name || g.naioshId)}</td>
              <td>${esc(levelOfGrant(g))}</td>
              <td>${esc(labelPos(g.positionCode))}</td>
              <td>${esc(labelRole(g.roleCode))}</td>
              <td>${esc(labelSys(g.system))}</td>
              <td>${esc(labelScope(g.scopeCode))}</td>
              <td>${statusBadge(g.status)}</td>
              <td class="ag-row-actions">
                <button type="button" class="ag-btn ag-btn-sm" data-action="ag-select-user" data-id="${esc(g.naioshId)}">عرض</button>
                <button type="button" class="ag-btn ag-btn-sm" data-action="ag-change-grant" data-id="${esc(g.naioshId)}" data-gid="${esc(g.grantId)}">تعديل</button>
                ${
                  String(g.status).toUpperCase() === 'ACTIVE'
                    ? `<button type="button" class="ag-btn ag-btn-sm" data-action="ag-confirm" data-kind="revoke" data-id="${esc(g.grantId)}" data-user="${esc(u?.name || '')}">إلغاء التعيين</button>`
                    : `<button type="button" class="ag-btn ag-btn-sm" data-action="ag-reactivate-grant" data-id="${esc(g.grantId)}">إعادة تفعيل</button>`
                }
              </td>
            </tr>`;
          })
          .join('')
      )}</section>`;
  };

  const renderMatrix = () => renderAssignments().replace('التعيينات', 'مصفوفة الوصول');

  const renderSimpleList = (title, rowsHtml) => `<section class="ag-panel"><h3 class="ag-section-title">${esc(title)}</h3>${rowsHtml}</section>`;

  const renderOverview = () => {
    if (ui.level === 'SYSTEMS') {
      return `<section class="ag-panel"><h3 class="ag-section-title">الأنظمة المسجّلة</h3>
        <div class="ag-cards">${(state().systems || [])
          .map(
            (s) => `<article class="ag-card"><h4>${esc(s.nameAr)}</h4>
              <p>${statusBadge(s.status || 'active')}</p>
              <button type="button" class="ag-btn ag-btn-primary" data-action="ag-wizard-open" data-level="SYSTEM" data-system="${esc(s.code)}">تعيين مستخدم على هذا النظام</button>
            </article>`
          )
          .join('')}</div></section>`;
    }
    return `${renderQuickActions()}${renderLevels()}${renderArchitecture()}${renderStats()}`;
  };

  const renderWizard = () => {
    if (!ui.wizard) return '';
    const w = ui.wizard;
    const st = state();
    const steps = ['اختيار المستخدم', 'مستوى الإدارة', 'المنصب', 'الدور', 'نطاق العمل', 'الصلاحيات', 'مدة التعيين', 'مراجعة التعيين'];
    const users = st.identities || [];
    const filteredUsers = w.userQ
      ? users.filter((u) => [u.name, u.email, u.naioshId].some((x) => String(x).toLowerCase().includes(String(w.userQ).toLowerCase())))
      : users;
    const roles = (st.roles || []).filter((r) => {
      if (w.positionCode && r.eligiblePositions?.length && !r.eligiblePositions.includes(w.positionCode)) return false;
      if (w.governanceLevel === 'EMPIRE' && r.level !== 'EMPIRE') return false;
      if (w.governanceLevel === 'HUB' && r.level === 'SYSTEM') return false;
      return true;
    });
    const role = roles.find((r) => r.code === w.roleCode) || roles[0];
    const permOptions = (role?.permissions || []).map((code) => {
      const p = (st.permissions || []).find((x) => x.code === code);
      return { code, label: p ? p.nameAr : code, action: p?.action };
    });

    return `
      <div class="ag-modal" role="dialog" aria-modal="true">
        <div class="ag-modal-card">
          <header><h3>تعيين مستخدم</h3><button type="button" class="ag-btn" data-action="ag-wizard-close">إغلاق</button></header>
          <div class="ag-wizard-steps">${steps.map((s, i) => `<span class="${w.step === i + 1 ? 'is-on' : ''}">${i + 1}. ${esc(s)}</span>`).join('')}</div>
          <div class="ag-wizard-body">
            ${
              w.step === 1
                ? `<label>ابحث بالاسم أو رقم نايوش أو البريد</label>
                   <input id="ag-w-userq" value="${esc(w.userQ || '')}" placeholder="مثال: مليكة" />
                   <button type="button" class="ag-btn" data-action="ag-wizard-search-user">بحث</button>
                   <label>اختر المستخدم</label>
                   <select id="ag-w-user">${filteredUsers
                     .map((u) => `<option value="${esc(u.naioshId)}" ${w.naioshId === u.naioshId ? 'selected' : ''}>${esc(u.name)} — ${esc(u.naioshId)}</option>`)
                     .join('')}</select>`
                : ''
            }
            ${
              w.step === 2
                ? `<p>أين تريد تعيين هذا المستخدم؟</p>
                   <label class="ag-radio"><input type="radio" name="ag-lvl" value="EMPIRE" ${w.governanceLevel === 'EMPIRE' ? 'checked' : ''}/> إمبراطورية نايوش</label>
                   <label class="ag-radio"><input type="radio" name="ag-lvl" value="HUB" ${!w.governanceLevel || w.governanceLevel === 'HUB' ? 'checked' : ''}/> نايوش هوب 360</label>
                   <label class="ag-radio"><input type="radio" name="ag-lvl" value="SYSTEM" ${w.governanceLevel === 'SYSTEM' ? 'checked' : ''}/> نظام محدد</label>
                   <label>النظام (إذا اخترت نظامًا محددًا)</label>
                   <select id="ag-w-system">${(st.systems || [])
                     .map((s) => `<option value="${esc(s.code)}" ${w.system === s.code ? 'selected' : ''}>${esc(s.nameAr)}</option>`)
                     .join('')}</select>`
                : ''
            }
            ${
              w.step === 3
                ? `<label>اختر المنصب</label>
                   <select id="ag-w-pos">${(st.positions || [])
                     .map((p) => `<option value="${esc(p.code)}" ${w.positionCode === p.code ? 'selected' : ''}>${esc(p.nameAr)}</option>`)
                     .join('')}</select>`
                : ''
            }
            ${
              w.step === 4
                ? `<label>اختر الدور المتاح لهذا المنصب والمستوى</label>
                   <select id="ag-w-role">${roles
                     .map((r) => `<option value="${esc(r.code)}" ${w.roleCode === r.code ? 'selected' : ''}>${esc(r.nameAr)}</option>`)
                     .join('')}</select>`
                : ''
            }
            ${
              w.step === 5
                ? `<label>نطاق العمل</label>
                   <select id="ag-w-scope">${(st.scopes || [])
                     .map((s) => `<option value="${esc(s.code)}" ${w.scopeCode === s.code ? 'selected' : ''}>${esc(s.nameAr)}</option>`)
                     .join('')}</select>`
                : ''
            }
            ${
              w.step === 6
                ? `<p>الصلاحيات المرتبطة بالدور (يمكن تعديلها لاحقًا من صفحة المستخدم):</p>
                   <div class="ag-checks">${permOptions
                     .map((p) => {
                       const checked = !(w.permissions && !w.permissions.includes(p.code));
                       return `<label class="ag-check"><input type="checkbox" data-perm="${esc(p.code)}" ${checked ? 'checked' : ''}/> ${esc(ACTION_AR[p.action] || '')} — ${esc(p.label)}</label>`;
                     })
                     .join('')}</div>`
                : ''
            }
            ${
              w.step === 7
                ? `<label class="ag-radio"><input type="radio" name="ag-dur" value="perm" ${!w.temporary ? 'checked' : ''}/> دائم حتى يتم إلغاؤه</label>
                   <label class="ag-radio"><input type="radio" name="ag-dur" value="temp" ${w.temporary ? 'checked' : ''}/> مؤقت</label>
                   <label>من تاريخ</label><input type="datetime-local" id="ag-w-start" />
                   <label>إلى تاريخ</label><input type="datetime-local" id="ag-w-exp" />`
                : ''
            }
            ${
              w.step === 8
                ? (() => {
                    const u = users.find((x) => x.naioshId === w.naioshId);
                    return `<div class="ag-summary">
                      <p><strong>المستخدم:</strong> ${esc(u?.name || w.naioshId)}</p>
                      <p><strong>المستوى:</strong> ${esc(LEVEL_AR[w.governanceLevel] || LEVEL_AR.HUB)}</p>
                      <p><strong>المنصب:</strong> ${esc(labelPos(w.positionCode))}</p>
                      <p><strong>الدور:</strong> ${esc(labelRole(w.roleCode))}</p>
                      <p><strong>نطاق العمل:</strong> ${esc(labelScope(w.scopeCode))}</p>
                      <p><strong>النظام:</strong> ${esc(labelSys(w.system || 'HUB'))}</p>
                      <p><strong>نوع التعيين:</strong> ${w.temporary ? 'مؤقت' : 'دائم'}</p>
                    </div>`;
                  })()
                : ''
            }
          </div>
          <footer>
            ${w.step > 1 ? `<button type="button" class="ag-btn" data-action="ag-wizard-prev">السابق</button>` : '<span></span>'}
            ${w.step < 8 ? `<button type="button" class="ag-btn ag-btn-primary" data-action="ag-wizard-next">التالي</button>` : ''}
            ${w.step === 8 ? `<button type="button" class="ag-btn ag-btn-primary" data-action="ag-wizard-submit">تأكيد التعيين</button>` : ''}
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
      body = `أنت على وشك إلغاء تعيين ${esc(c.user || 'المستخدم')}. لن يتم حذف حساب المستخدم، ولكن سيتم سحب الوصول الناتج عن هذا التعيين. هل تريد المتابعة؟`;
    } else if (c.kind === 'suspend') {
      title = 'تأكيد إيقاف الوصول';
      body = `سيتم إيقاف وصول المستخدم مؤقتًا حتى إعادة التفعيل.`;
    } else if (c.kind === 'archive') {
      title = 'تأكيد أرشفة المستخدم';
      body = `هل أنت متأكد من أرشفة المستخدم ${esc(c.user || '')}؟ سيتم سحب التعيينات النشطة مع الاحتفاظ بسجل التدقيق. لن يُحذف التاريخ السابق.`;
    }
    return `<div class="ag-modal"><div class="ag-modal-card">
      <header><h3>${esc(title)}</h3><button type="button" class="ag-btn" data-action="ag-confirm-cancel">إلغاء</button></header>
      <p>${body}</p>
      <footer>
        <button type="button" class="ag-btn" data-action="ag-confirm-cancel">رجوع</button>
        <button type="button" class="ag-btn ag-btn-primary" data-action="ag-confirm-ok">تأكيد</button>
      </footer>
    </div></div>`;
  };

  const renderSuccess = () => {
    if (!ui.success) return '';
    return `<div class="ag-modal"><div class="ag-modal-card">
      <h3>تم بنجاح</h3>
      <p>${esc(ui.success.message)}</p>
      <footer>
        ${ui.success.userId ? `<button type="button" class="ag-btn ag-btn-primary" data-action="ag-select-user" data-id="${esc(ui.success.userId)}">عرض المستخدم</button>` : ''}
        <button type="button" class="ag-btn" data-action="ag-success-close">العودة إلى المستخدمين</button>
      </footer>
    </div></div>`;
  };

  const renderEditProfile = () => {
    if (!ui.editProfile) return '';
    const u = engine().findIdentity(ui.editProfile);
    if (!u) return '';
    return `<div class="ag-modal"><div class="ag-modal-card">
      <header><h3>تعديل بيانات المستخدم</h3><button type="button" class="ag-btn" data-action="ag-edit-close">إغلاق</button></header>
      <p class="ag-note">لتغيير المنصب أو الدور استخدم «تغيير التعيين» — هذا النموذج للبيانات الأساسية فقط.</p>
      <label>الاسم</label><input id="ag-edit-name" value="${esc(u.name)}" />
      <label>البريد</label><input id="ag-edit-email" value="${esc(u.email)}" />
      <footer><button type="button" class="ag-btn ag-btn-primary" data-action="ag-edit-save">حفظ</button></footer>
    </div></div>`;
  };

  const renderChangeGrant = () => {
    if (!ui.changeGrant) return '';
    const g = (state().grants || []).find((x) => x.grantId === ui.changeGrant.grantId);
    if (!g) return '';
    return `<div class="ag-modal"><div class="ag-modal-card">
      <header><h3>تغيير التعيين</h3><button type="button" class="ag-btn" data-action="ag-change-close">إغلاق</button></header>
      <label>المنصب</label><select id="ag-cg-pos">${(state().positions || [])
        .map((p) => `<option value="${esc(p.code)}" ${g.positionCode === p.code ? 'selected' : ''}>${esc(p.nameAr)}</option>`)
        .join('')}</select>
      <label>الدور</label><select id="ag-cg-role">${(state().roles || [])
        .map((r) => `<option value="${esc(r.code)}" ${g.roleCode === r.code ? 'selected' : ''}>${esc(r.nameAr)}</option>`)
        .join('')}</select>
      <label>نطاق العمل</label><select id="ag-cg-scope">${(state().scopes || [])
        .map((s) => `<option value="${esc(s.code)}" ${g.scopeCode === s.code ? 'selected' : ''}>${esc(s.nameAr)}</option>`)
        .join('')}</select>
      <footer><button type="button" class="ag-btn ag-btn-primary" data-action="ag-change-save">حفظ التغيير</button></footer>
    </div></div>`;
  };

  const renderUserPerms = () => {
    if (!ui.permView) return '';
    const eff = engine().effectiveAccess(ui.permView);
    if (!eff) return '';
    const all = state().permissions || [];
    return `<div class="ag-modal"><div class="ag-modal-card ag-modal-wide">
      <header><h3>صلاحيات ${esc(eff.identity.name)}</h3><button type="button" class="ag-btn" data-action="ag-perm-close">إغلاق</button></header>
      <div class="ag-toolbar"><button type="button" class="ag-btn ag-btn-primary" data-action="ag-wizard-open" data-user="${esc(eff.identity.naioshId)}">+ منح صلاحية</button></div>
      ${table(
        ['الصلاحية', 'الحالة', 'مصدر الصلاحية', 'نطاقها', 'الإجراءات'],
        all
          .slice(0, 40)
          .map((p) => {
            const allowed = (eff.permissions || []).includes(p.code);
            const g = (eff.grants || []).find((x) => (x.permissions || []).includes(p.code));
            return `<tr>
              <td>${esc(p.nameAr)}</td>
              <td>${allowed ? badge('مسموح', 'ag-badge-ok') : badge('غير مسموح', 'ag-badge-warn')}</td>
              <td>${esc(allowed ? (g?.source === 'DELEGATION' ? 'تفويض' : g?.source === 'TEMPORARY' ? 'وصول مؤقت' : `دور ${labelRole(g?.roleCode)}`) : '—')}</td>
              <td>${esc(allowed ? labelScope(g?.scope) : '—')}</td>
              <td>${allowed ? `<button type="button" class="ag-btn ag-btn-sm" data-action="ag-toast" data-msg="لإلغاء صلاحية مرتبطة بدور: غيّر التعيين أو ألغِه">إلغاء</button>` : '—'}</td>
            </tr>`;
          })
          .join('')
      )}
    </div></div>`;
  };

  const renderBody = () => {
    switch (ui.tab) {
      case 'overview':
        return renderOverview();
      case 'users':
        return renderUsers();
      case 'positions':
        return renderCatalog('positions');
      case 'roles':
        return renderCatalog('roles');
      case 'permissions':
        return renderCatalog('permissions');
      case 'authorities':
        return renderCatalog('authorities');
      case 'scopes':
        return renderCatalog('scopes');
      case 'matrix':
        return renderMatrix();
      case 'assignments':
        return renderAssignments();
      case 'requests':
        return renderSimpleList(
          'طلبات الوصول',
          table(
            ['رقم الطلب', 'المستخدم', 'الدور', 'الحالة', 'الإجراءات'],
            (state().requests || [])
              .map(
                (r) => `<tr>
                  <td>${esc(r.requestId)}</td><td>${esc(r.naioshId)}</td><td>${esc(labelRole(r.roleCode))}</td>
                  <td>${statusBadge(r.status)}</td>
                  <td class="ag-row-actions">
                    <button type="button" class="ag-btn ag-btn-sm" data-action="ag-req-approve" data-id="${esc(r.id)}">موافقة</button>
                    <button type="button" class="ag-btn ag-btn-sm" data-action="ag-req-reject" data-id="${esc(r.id)}">رفض</button>
                  </td>
                </tr>`
              )
              .join('')
          )
        );
      case 'delegations':
        return renderSimpleList(
          'التفويضات',
          table(
            ['المفوِّض', 'المفوَّض', 'الصلاحية', 'إلى', 'الحالة', 'الإجراءات'],
            (state().delegations || [])
              .map(
                (d) => `<tr>
                  <td>${esc(d.delegatorNaioshId)}</td><td>${esc(d.delegateNaioshId)}</td>
                  <td>${esc(labelPerm(d.permission))}</td><td>${fmt(d.endDate)}</td><td>${statusBadge(d.status)}</td>
                  <td><button type="button" class="ag-btn ag-btn-sm" data-action="ag-toast" data-msg="استخدم صفحة المستخدم لإدارة التفويض">عرض</button></td>
                </tr>`
              )
              .join('')
          )
        );
      case 'temporary':
        return renderSimpleList(
          'الوصول المؤقت',
          table(
            ['المستخدم', 'الصلاحية', 'إلى', 'الحالة', 'الإجراءات'],
            (state().temporaryAccess || [])
              .map(
                (t) => `<tr>
                  <td>${esc(t.naioshId)}</td><td>${esc(labelPerm(t.permission))}</td>
                  <td>${fmt(t.endDate)}</td><td>${statusBadge(t.status)}</td>
                  <td><button type="button" class="ag-btn ag-btn-sm" data-action="ag-select-user" data-id="${esc(t.naioshId)}">عرض</button></td>
                </tr>`
              )
              .join('')
          )
        );
      case 'reviews':
        return renderSimpleList(
          'المراجعة والإلغاء',
          `<ul class="ag-list">${(engine().detectOrphans() || [])
            .map((o) => `<li>${statusBadge(o.severity)} ${esc(o.detail)} ${o.grantId ? `<button type="button" class="ag-btn ag-btn-sm" data-action="ag-confirm" data-kind="revoke" data-id="${esc(o.grantId)}">سحب</button>` : ''}</li>`)
            .join('') || '<li class="ag-empty">لا عناصر للمراجعة</li>'}</ul>`
        );
      case 'sod':
        return renderSimpleList(
          'فصل المهام',
          table(
            ['القاعدة', 'الإجراء', 'الخطورة'],
            (state().sodRules || [])
              .map(
                (r) => `<tr><td>${esc(r.nameAr)}</td><td>${esc(r.action === 'BLOCK' ? 'منع' : 'يتطلب موافقة')}</td><td>${esc(r.risk === 'high' ? 'مرتفع' : r.risk === 'critical' ? 'حرج' : r.risk)}</td></tr>`
              )
              .join('')
          )
        );
      case 'audit':
        return renderSimpleList(
          'سجل التدقيق',
          table(
            ['الوقت', 'المنفّذ', 'المستخدم المستهدف', 'الإجراء', 'السبب'],
            (state().audit || [])
              .slice(0, 80)
              .map(
                (e) =>
                  `<tr><td>${fmt(e.timestamp)}</td><td>${esc(e.actor)}</td><td>${esc(e.targetUser || '—')}</td><td>${esc(e.action)}</td><td>${esc(e.reason || '—')}</td></tr>`
              )
              .join('')
          )
        );
      default:
        return renderOverview();
    }
  };

  const render = () => {
    engine().processTemporaryExpiry(state());
    return `
      <div class="ag-root" data-ag-root>
        <header class="ag-hero">
          <div>
            <h2>حوكمة الوصول والأدوار</h2>
            <p class="ag-desc">من هنا يمكنك تعيين المستخدمين في المناصب والأدوار، وتحديد صلاحياتهم ونطاق عملهم، وتعديل أو إيقاف أو إلغاء وصولهم إلى أنظمة نايوش.</p>
          </div>
        </header>
        ${renderNav()}
        <div class="ag-main">${renderBody()}</div>
        ${renderWizard()}${renderConfirm()}${renderSuccess()}${renderEditProfile()}${renderChangeGrant()}${renderUserPerms()}
      </div>`;
  };

  const readWizard = () => {
    const w = ui.wizard;
    if (!w) return;
    const val = (id) => document.getElementById(id)?.value;
    if (w.step === 1) {
      w.userQ = val('ag-w-userq') || w.userQ;
      w.naioshId = val('ag-w-user') || w.naioshId;
    }
    if (w.step === 2) {
      const lvl = document.querySelector('input[name="ag-lvl"]:checked')?.value || 'HUB';
      w.governanceLevel = lvl;
      w.system = lvl === 'HUB' ? 'HUB' : lvl === 'EMPIRE' ? 'HUB' : val('ag-w-system') || w.system || 'ERP';
    }
    if (w.step === 3) w.positionCode = val('ag-w-pos');
    if (w.step === 4) w.roleCode = val('ag-w-role');
    if (w.step === 5) w.scopeCode = val('ag-w-scope');
    if (w.step === 6) {
      w.permissions = [...document.querySelectorAll('[data-perm]:checked')].map((el) => el.getAttribute('data-perm'));
    }
    if (w.step === 7) {
      w.temporary = document.querySelector('input[name="ag-dur"]:checked')?.value === 'temp';
      const s = val('ag-w-start');
      const e = val('ag-w-exp');
      w.startDate = s ? new Date(s).toISOString() : null;
      w.expiryDate = e ? new Date(e).toISOString() : null;
    }
  };

  const handle = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const actor = user?.name || user?.email || 'مشغّل هوب';

    if (action === 'ag-tab') {
      ui.tab = btn.dataset.tab || 'overview';
      ui.level = null;
      ui.selectedUser = null;
      return true;
    }
    if (action === 'ag-level') {
      ui.level = btn.dataset.level;
      ui.tab = 'overview';
      return true;
    }
    if (action === 'ag-search') {
      ui.q = document.getElementById('ag-q')?.value || '';
      return true;
    }
    if (action === 'ag-clear-filters') {
      ui.q = '';
      ui.filters = { level: '', status: '', role: '' };
      return true;
    }
    if (action === 'ag-apply-filters') {
      ui.filters.status = document.getElementById('ag-f-status')?.value || '';
      return true;
    }
    if (action === 'ag-select-user') {
      ui.selectedUser = btn.dataset.id;
      ui.tab = 'users';
      ui.success = null;
      return true;
    }
    if (action === 'ag-toast') {
      toast?.(btn.dataset.msg || '');
      return true;
    }
    if (action === 'ag-wizard-open') {
      ui.wizard = {
        step: 1,
        naioshId: btn.dataset.user || state().identities.find((i) => /مليكة|malika/i.test(i.name + i.email))?.naioshId || state().identities[0]?.naioshId,
        governanceLevel: btn.dataset.level || 'HUB',
        system: btn.dataset.system || 'HUB',
        temporary: false,
      };
      return true;
    }
    if (action === 'ag-wizard-close') {
      ui.wizard = null;
      return true;
    }
    if (action === 'ag-wizard-search-user') {
      ui.wizard.userQ = document.getElementById('ag-w-userq')?.value || '';
      return true;
    }
    if (action === 'ag-wizard-next') {
      readWizard();
      ui.wizard.step = Math.min(8, ui.wizard.step + 1);
      if (ui.wizard.step === 4 && !ui.wizard.roleCode) {
        const roles = state().roles || [];
        ui.wizard.roleCode = roles.find((r) => !ui.wizard.positionCode || !r.eligiblePositions?.length || r.eligiblePositions.includes(ui.wizard.positionCode))?.code;
      }
      return true;
    }
    if (action === 'ag-wizard-prev') {
      readWizard();
      ui.wizard.step = Math.max(1, ui.wizard.step - 1);
      return true;
    }
    if (action === 'ag-wizard-submit') {
      readWizard();
      try {
        const w = ui.wizard;
        const role = (state().roles || []).find((r) => r.code === w.roleCode);
        engine().createGrant(
          {
            naioshId: w.naioshId,
            positionCode: w.positionCode,
            roleCode: w.roleCode,
            system: w.system || 'HUB',
            scopeCode: w.scopeCode || (w.governanceLevel === 'HUB' ? 'HUB-GLOBAL' : 'GLOBAL'),
            permissions: w.permissions?.length ? w.permissions : role?.permissions,
            purpose: 'تعيين من واجهة الحوكمة',
            startDate: w.startDate,
            expiryDate: w.temporary ? w.expiryDate : null,
            governanceLevel: w.governanceLevel || 'HUB',
            authorityCodes: role?.code === 'BRANCH_MANAGER' || role?.code === 'HUB_ADMIN' ? ['FIN_APPROVE_25K'] : role?.code === 'SUPER_ADMIN' ? ['FIN_APPROVE_UNLIMITED'] : [],
          },
          actor
        );
        const name = engine().findIdentity(w.naioshId)?.name || w.naioshId;
        ui.wizard = null;
        ui.tab = 'users';
        ui.selectedUser = w.naioshId;
        ui.success = { message: `تم تعيين ${name} بنجاح.`, userId: w.naioshId };
        toast?.('تم التعيين');
      } catch (e) {
        toast?.(e.message || 'فشل التعيين');
      }
      return true;
    }
    if (action === 'ag-success-close') {
      ui.success = null;
      ui.tab = 'users';
      return true;
    }
    if (action === 'ag-confirm') {
      ui.confirm = { kind: btn.dataset.kind, id: btn.dataset.id, user: btn.dataset.user };
      return true;
    }
    if (action === 'ag-confirm-cancel') {
      ui.confirm = null;
      return true;
    }
    if (action === 'ag-confirm-ok') {
      try {
        const c = ui.confirm;
        if (c.kind === 'revoke') {
          engine().revokeGrant(c.id, actor, 'إلغاء تعيين من الواجهة');
          toast?.('تم إلغاء التعيين — الحساب ما زال موجودًا');
        } else if (c.kind === 'suspend') {
          engine().suspendIdentity(c.id, actor, 'إيقاف من الواجهة');
          toast?.('تم إيقاف الوصول');
        } else if (c.kind === 'archive') {
          engine().archiveIdentity(c.id, actor, 'أرشفة من الواجهة');
          toast?.('تمت أرشفة المستخدم مع الاحتفاظ بالتدقيق');
          if (ui.selectedUser === c.id) ui.selectedUser = null;
        }
      } catch (e) {
        toast?.(e.message);
      }
      ui.confirm = null;
      return true;
    }
    if (action === 'ag-reactivate') {
      try {
        engine().reactivateIdentity(btn.dataset.id, actor, 'إعادة تفعيل');
        toast?.('تمت إعادة التفعيل');
      } catch (e) {
        toast?.(e.message);
      }
      return true;
    }
    if (action === 'ag-reactivate-grant') {
      try {
        engine().updateGrant(btn.dataset.id, { status: 'ACTIVE', reason: 'إعادة تفعيل التعيين' }, actor);
        toast?.('أُعيد تفعيل التعيين');
      } catch (e) {
        toast?.(e.message);
      }
      return true;
    }
    if (action === 'ag-edit-user') {
      ui.editProfile = btn.dataset.id;
      return true;
    }
    if (action === 'ag-edit-close') {
      ui.editProfile = null;
      return true;
    }
    if (action === 'ag-edit-save') {
      try {
        engine().updateIdentity(
          ui.editProfile,
          { name: document.getElementById('ag-edit-name')?.value, email: document.getElementById('ag-edit-email')?.value },
          actor
        );
        ui.editProfile = null;
        toast?.('تم حفظ البيانات');
      } catch (e) {
        toast?.(e.message);
      }
      return true;
    }
    if (action === 'ag-change-grant') {
      const gid = btn.dataset.gid;
      if (!gid) {
        ui.wizard = { step: 1, naioshId: btn.dataset.id, governanceLevel: 'HUB', system: 'HUB' };
        return true;
      }
      ui.changeGrant = { grantId: gid, userId: btn.dataset.id };
      return true;
    }
    if (action === 'ag-change-close') {
      ui.changeGrant = null;
      return true;
    }
    if (action === 'ag-change-save') {
      try {
        const roleCode = document.getElementById('ag-cg-role')?.value;
        const role = (state().roles || []).find((r) => r.code === roleCode);
        engine().updateGrant(
          ui.changeGrant.grantId,
          {
            positionCode: document.getElementById('ag-cg-pos')?.value,
            roleCode,
            scopeCode: document.getElementById('ag-cg-scope')?.value,
            permissions: role?.permissions,
            reason: 'تغيير التعيين من الواجهة',
          },
          actor
        );
        ui.changeGrant = null;
        toast?.('تم تحديث التعيين وانعكس على الوصول الفعلي');
      } catch (e) {
        toast?.(e.message);
      }
      return true;
    }
    if (action === 'ag-user-perms') {
      ui.permView = btn.dataset.id;
      return true;
    }
    if (action === 'ag-perm-close') {
      ui.permView = null;
      return true;
    }
    if (action === 'ag-add-user') {
      const name = window.prompt('اسم المستخدم الجديد');
      if (!name) return true;
      const email = window.prompt('البريد الإلكتروني') || `${Date.now()}@naiosh.example`;
      try {
        engine().ensureIdentity({ name, email }, actor);
        ui.tab = 'users';
        toast?.('تمت إضافة المستخدم — يمكنك الآن تعيينه');
      } catch (e) {
        toast?.(e.message);
      }
      return true;
    }
    if (action === 'ag-req-approve' || action === 'ag-req-reject') {
      window.HubAccessGovStore.update((st) => {
        const row = st.requests.find((r) => r.id === btn.dataset.id);
        if (!row) return st;
        row.status = action === 'ag-req-approve' ? 'Approved' : 'Rejected';
        row.approver = actor;
        if (action === 'ag-req-approve') {
          try {
            engine().createGrant({ naioshId: row.naioshId, roleCode: row.roleCode, system: row.system, scopeCode: row.scopeCode, permissions: row.permissions, purpose: row.reason, governanceLevel: 'SYSTEM' }, actor);
            row.status = 'Granted';
          } catch (_) {}
        }
        return st;
      }, actor);
      toast?.(action === 'ag-req-approve' ? 'تمت الموافقة' : 'تم الرفض');
      return true;
    }
    return false;
  };

  window.HubAccessGovUI = { render, handle, ui, NAV };
})();
