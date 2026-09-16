/**
 * Access Governance 360 — Dashboard workspace UI
 * Replaces legacy HubRolesWS (read/write/admin table)
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
    systemCode: null,
    q: '',
    selectedUser: null,
    wizard: null,
    drawer: null,
    crumb: [],
  };

  const NAV = [
    { id: 'overview', label: 'نظرة عامة', icon: 'fa-gauge-high' },
    { id: 'users', label: 'المستخدمون 360', icon: 'fa-id-badge' },
    { id: 'positions', label: 'المناصب', icon: 'fa-sitemap' },
    { id: 'roles', label: 'الأدوار', icon: 'fa-user-shield' },
    { id: 'permissions', label: 'الصلاحيات', icon: 'fa-key' },
    { id: 'authorities', label: 'السلطات', icon: 'fa-scale-balanced' },
    { id: 'scopes', label: 'النطاقات', icon: 'fa-location-dot' },
    { id: 'matrix', label: 'مصفوفة الوصول', icon: 'fa-table-cells' },
    { id: 'assignments', label: 'التعيينات', icon: 'fa-link' },
    { id: 'requests', label: 'طلبات الوصول', icon: 'fa-inbox' },
    { id: 'delegations', label: 'التفويضات', icon: 'fa-handshake' },
    { id: 'temporary', label: 'الوصول المؤقت', icon: 'fa-hourglass-half' },
    { id: 'reviews', label: 'المراجعة والإلغاء', icon: 'fa-clipboard-check' },
    { id: 'sod', label: 'فصل المهام', icon: 'fa-shield-halved' },
    { id: 'audit', label: 'سجل التدقيق', icon: 'fa-clock-rotate-left' },
    { id: 'myaccess', label: 'صلاحياتي', icon: 'fa-user-check' },
  ];

  const badge = (text, cls = '') => `<span class="ag-badge ${cls}">${esc(text)}</span>`;
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

  const filterRows = (rows, fields) => {
    const q = String(ui.q || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => fields.some((f) => String(r[f] ?? '').toLowerCase().includes(q)));
  };

  const renderLevels = () => {
    const systems = state().systems || [];
    return `
      <section class="ag-levels" aria-label="مستويات الحوكمة">
        <article class="ag-level-card ag-level-empire">
          <div class="ag-level-no">المستوى 01</div>
          <h3>إمبراطورية نايوش</h3>
          <p class="ag-en">NAIOSHAI EMPIRE</p>
          <p>المستوى السيادي الأعلى · Scope: EMPIRE / GLOBAL</p>
          <button type="button" class="ag-btn ag-btn-primary" data-action="ag-level" data-level="EMPIRE">إدارة المستوى</button>
        </article>
        <article class="ag-level-card ag-level-hub">
          <div class="ag-level-no">المستوى 02</div>
          <h3>NAIOSHAI HUB 360</h3>
          <p class="ag-en">HUB-GLOBAL</p>
          <p>Users · Roles · Permissions · Authorities · Scopes · Systems · Workflow · Audit</p>
          <button type="button" class="ag-btn ag-btn-primary" data-action="ag-level" data-level="HUB">إدارة المستوى</button>
        </article>
        <article class="ag-level-card ag-level-sys">
          <div class="ag-level-no">المستوى 03</div>
          <h3>الأنظمة</h3>
          <p class="ag-en">SYSTEMS · ${systems.length} مسجّل</p>
          <p>من كتالوج HUB الفعلي — بدون قائمة ثابتة في الواجهة.</p>
          <button type="button" class="ag-btn ag-btn-primary" data-action="ag-level" data-level="SYSTEMS">إدارة الأنظمة</button>
        </article>
      </section>`;
  };

  const renderArchitecture = () => `
    <section class="ag-arch" aria-label="Architecture">
      <h3 class="ag-section-title">معمارية الوصول</h3>
      <p class="ag-note">Isolation فعّال: System Admin لا يصبح HUB Admin، وHUB Admin لا يصبح Empire Admin تلقائيًا.</p>
      <ol class="ag-arch-flow">
        <li>NAIOSHAI EMPIRE</li><li>NAIOSHAI HUB 360</li><li>SYSTEMS</li><li>POSITIONS</li>
        <li>ROLES</li><li>SCOPES</li><li>PERMISSIONS</li><li>AUTHORITIES</li><li>ACCESS</li>
      </ol>
    </section>`;

  const renderStats = () => {
    const s = engine().dashboardStats();
    const cards = [
      ['users', 'إجمالي المستخدمين', s.users, 'users'],
      ['positions', 'المناصب', s.positions, 'positions'],
      ['roles', 'الأدوار', s.roles, 'roles'],
      ['effectiveAccess', 'الوصول الفعال', s.effectiveAccess, 'assignments'],
      ['requests', 'طلبات الوصول', s.requests, 'requests'],
      ['activeDelegations', 'التفويضات النشطة', s.activeDelegations, 'delegations'],
      ['temporaryAccess', 'الوصول المؤقت', s.temporaryAccess, 'temporary'],
      ['needsReview', 'تحتاج مراجعة', s.needsReview, 'reviews'],
      ['expiringSoon', 'تنتهي قريبًا', s.expiringSoon, 'temporary'],
      ['suspended', 'الوصول المعلق', s.suspended, 'reviews'],
      ['revoked', 'الوصول الملغى', s.revoked, 'reviews'],
      ['sodConflicts', 'تعارضات SoD', s.sodConflicts, 'sod'],
      ['orphanedAccess', 'Orphaned Access', s.orphanedAccess, 'reviews'],
    ];
    return `
      <section class="ag-stats" aria-label="Dashboard الحوكمة">
        <h3 class="ag-section-title">لوحة حوكمة الوصول</h3>
        <div class="ag-stats-grid">
          ${cards
            .map(
              ([, label, value, tab]) => `
            <button type="button" class="ag-stat" data-action="ag-tab" data-tab="${esc(tab)}">
              <strong>${esc(value)}</strong>
              <span>${esc(label)}</span>
            </button>`
            )
            .join('')}
        </div>
      </section>`;
  };

  const renderNav = () => `
    <nav class="ag-nav" aria-label="تنقل حوكمة الوصول">
      ${NAV.map(
        (t) =>
          `<button type="button" class="ag-nav-btn ${ui.tab === t.id ? 'is-on' : ''}" data-action="ag-tab" data-tab="${esc(t.id)}">
            <i class="fas ${esc(t.icon)}"></i><span>${esc(t.label)}</span>
          </button>`
      ).join('')}
    </nav>`;

  const searchBar = (placeholder) => `
    <div class="ag-toolbar">
      <input type="search" class="ag-search" id="ag-q" value="${esc(ui.q)}" placeholder="${esc(placeholder)}" aria-label="بحث" />
      <button type="button" class="ag-btn" data-action="ag-search">بحث</button>
      <button type="button" class="ag-btn ag-btn-primary" data-action="ag-wizard-open"><i class="fas fa-plus"></i> تعيين وصول</button>
    </div>`;

  const renderOverview = () => {
    const report = state().migrationReport;
    const orphans = engine().dashboardStats().orphans || [];
    return `
      ${renderLevels()}
      ${renderArchitecture()}
      ${renderStats()}
      <section class="ag-panel">
        <h3 class="ag-section-title">Needs Action</h3>
        ${
          orphans.length
            ? `<ul class="ag-list">${orphans
                .slice(0, 12)
                .map(
                  (o) =>
                    `<li><strong>${esc(o.type)}</strong> · ${esc(o.detail)} · ${badge(o.severity, 'ag-badge-warn')} · ${esc(o.action)}</li>`
                )
                .join('')}</ul>`
            : `<p class="ag-empty">لا عناصر تحتاج إجراء الآن.</p>`
        }
      </section>
      ${
        report
          ? `<section class="ag-panel">
              <h3 class="ag-section-title">Migration Report</h3>
              <p>أدوار قديمة: ${report.legacyRoles?.length || 0} · تعيينات: ${report.legacyAssignments?.length || 0} · مستخدمون مُرحَّلون: ${report.mappedUsers?.length || 0} · Audit محفوظ: ${report.preservedAudit || 0}</p>
            </section>`
          : ''
      }`;
  };

  const renderSystemsLevel = () => {
    const systems = state().systems || [];
    return `
      <section class="ag-panel">
        <h3 class="ag-section-title">الأنظمة المسجّلة (HUB-SYS / Ops Catalog)</h3>
        <div class="ag-cards">
          ${systems
            .map(
              (s) => `
            <article class="ag-card">
              <h4>${esc(s.nameAr)}</h4>
              <p class="ag-en">${esc(s.code)} · ${esc(s.level || 'SYSTEM')}</p>
              <p>${badge(s.status || 'active')}</p>
              <button type="button" class="ag-btn" data-action="ag-open-system" data-code="${esc(s.code)}">إدارة النظام</button>
            </article>`
            )
            .join('')}
        </div>
      </section>`;
  };

  const renderTable = (headers, rowsHtml) => `
    <div class="ag-table-wrap"><table class="ag-table">
      <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rowsHtml || `<tr><td colspan="${headers.length}" class="ag-empty">لا بيانات</td></tr>`}</tbody>
    </table></div>`;

  const renderPositions = () => {
    const rows = filterRows(state().positions || [], ['code', 'nameAr', 'nameEn', 'orgLevel']);
    return `
      <section class="ag-panel">
        <h3 class="ag-section-title">المناصب · Position Catalog</h3>
        <p class="ag-lead">يجيب عن: ما موقع هذا الشخص مؤسسيًا؟ إنشاء منصب لا يمنح أي Permission تلقائيًا.</p>
        ${searchBar('ابحث في المناصب...')}
        ${renderTable(
          ['الرمز', 'الاسم', 'English', 'المستوى', 'الأدوار المؤهلة', 'الحالة', ''],
          rows
            .map(
              (p) => `<tr>
                <td><code>${esc(p.code)}</code></td>
                <td>${esc(p.nameAr)}</td>
                <td>${esc(p.nameEn)}</td>
                <td>${badge(p.orgLevel)}</td>
                <td>${esc((p.eligibleRoles || []).join(' · '))}</td>
                <td>${badge(p.status, p.status === 'active' ? 'ag-badge-ok' : '')}</td>
                <td><button type="button" class="ag-btn ag-btn-sm" data-action="ag-view-pos" data-code="${esc(p.code)}">عرض</button></td>
              </tr>`
            )
            .join('')
        )}
      </section>`;
  };

  const renderRoles = () => {
    const rows = filterRows(state().roles || [], ['code', 'nameAr', 'nameEn', 'level', 'source']);
    return `
      <section class="ag-panel">
        <h3 class="ag-section-title">الأدوار · Role Catalog</h3>
        <p class="ag-lead">Position ≠ Role — الدور يحدد ماذا يؤدي المستخدم داخل سياق/نظام محدد.</p>
        ${searchBar('ابحث في الأدوار...')}
        ${renderTable(
          ['Role Code', 'الاسم', 'المستوى', 'الأنظمة', 'Scope', 'المصدر', ''],
          rows
            .map(
              (r) => `<tr>
                <td><code>${esc(r.code)}</code></td>
                <td>${esc(r.nameAr)}<div class="ag-muted">${esc(r.nameEn)}</div></td>
                <td>${badge(r.level)}</td>
                <td>${esc((r.applicableSystems || []).join(' · '))}</td>
                <td>${esc(r.defaultScopeType)}</td>
                <td>${esc(r.source)}</td>
                <td><button type="button" class="ag-btn ag-btn-sm" data-action="ag-view-role" data-code="${esc(r.code)}">عرض</button></td>
              </tr>`
            )
            .join('')
        )}
      </section>`;
  };

  const renderPermissions = () => {
    const rows = filterRows(state().permissions || [], ['code', 'resource', 'action', 'nameAr']);
    return `
      <section class="ag-panel">
        <h3 class="ag-section-title">قاموس الصلاحيات · Permission Dictionary</h3>
        <p class="ag-lead">RESOURCE + ACTION — بدل read/write/admin فقط.</p>
        ${searchBar('ابحث في الصلاحيات...')}
        ${renderTable(
          ['Permission', 'Resource', 'Action', 'الاسم'],
          rows
            .slice(0, 120)
            .map(
              (p) => `<tr>
                <td><code>${esc(p.code)}</code></td>
                <td>${esc(p.resource)}</td>
                <td>${badge(p.action)}</td>
                <td>${esc(p.nameAr)}</td>
              </tr>`
            )
            .join('')
        )}
      </section>`;
  };

  const renderAuthorities = () => {
    const rows = state().authorities || [];
    return `
      <section class="ag-panel">
        <h3 class="ag-section-title">السلطات · Authority Management</h3>
        <p class="ag-lead">Permission ≠ Authority — APPROVE بلا حد سلطة لا يكفي للاعتماد المالي.</p>
        ${renderTable(
          ['Authority', 'النوع', 'الأدوار', 'الحد', 'الحالة'],
          rows
            .map(
              (a) => `<tr>
                <td><strong>${esc(a.nameAr)}</strong><div class="ag-muted"><code>${esc(a.code)}</code></div></td>
                <td>${badge(a.type)}</td>
                <td>${esc((a.eligibleRoles || []).join(' · '))}</td>
                <td>${a.limits?.maximum == null ? 'غير محدود' : esc(a.limits.maximum) + ' ' + esc(a.limits.currency || '')}</td>
                <td>${badge(a.status, 'ag-badge-ok')}</td>
              </tr>`
            )
            .join('')
        )}
      </section>`;
  };

  const renderScopes = () => {
    const rows = state().scopes || [];
    return `
      <section class="ag-panel">
        <h3 class="ag-section-title">النطاقات · Scope Management</h3>
        <p class="ag-lead">أين يمارس المستخدم الدور/الصلاحية؟ Manager في Alexandria ≠ Manager في Cairo.</p>
        ${renderTable(
          ['Scope', 'النوع', 'الاسم', 'الكيان', 'الحالة'],
          rows
            .map(
              (s) => `<tr>
                <td><code>${esc(s.code)}</code></td>
                <td>${badge(s.type)}</td>
                <td>${esc(s.nameAr)}</td>
                <td>${esc(s.entityRef)}</td>
                <td>${badge(s.status)}</td>
              </tr>`
            )
            .join('')
        )}
      </section>`;
  };

  const renderMatrix = () => {
    const grants = filterRows(state().grants || [], ['naioshId', 'roleCode', 'system', 'scopeCode', 'status']);
    return `
      <section class="ag-panel">
        <h3 class="ag-section-title">مصفوفة الوصول · Master Access Matrix</h3>
        <p class="ag-lead">POSITION → ROLE → SCOPE → PERMISSION → AUTHORITY</p>
        ${searchBar('فلتر: مستخدم / دور / نظام / نطاق...')}
        ${renderTable(
          ['المستخدم', 'المنصب', 'الدور', 'النظام', 'النطاق', 'الصلاحيات', 'السلطة', 'الحالة'],
          grants
            .map(
              (g) => `<tr>
                <td><code>${esc(g.naioshId)}</code></td>
                <td>${esc(g.positionCode || '—')}</td>
                <td>${esc(g.roleCode)}</td>
                <td>${esc(g.system)}</td>
                <td>${esc(g.scopeCode)}</td>
                <td class="ag-clip">${esc((g.permissions || []).slice(0, 4).join(', '))}${(g.permissions || []).length > 4 ? '…' : ''}</td>
                <td>${esc((g.authorityCodes || []).join(' · ') || '—')}</td>
                <td>${badge(g.status, g.status === 'ACTIVE' ? 'ag-badge-ok' : 'ag-badge-warn')}</td>
              </tr>`
            )
            .join('')
        )}
      </section>`;
  };

  const renderUsers = () => {
    const rows = filterRows(state().identities || [], ['naioshId', 'name', 'email', 'userType']);
    const detail = ui.selectedUser ? engine().effectiveAccess(ui.selectedUser) : null;
    const explanation = ui.drawer?.type === 'why' ? engine().explainPermission(state(), ui.selectedUser, ui.drawer.permission, ui.drawer.opts || {}) : null;
    return `
      <section class="ag-panel">
        <h3 class="ag-section-title">المستخدمون 360 · User Access 360</h3>
        ${searchBar('NAIOSHAI ID / اسم / بريد / منصب / دور...')}
        <div class="ag-split">
          <div>
            ${renderTable(
              ['NAIOSH ID', 'الاسم', 'النوع', 'الحالة', ''],
              rows
                .map(
                  (u) => `<tr class="${ui.selectedUser === u.naioshId ? 'is-selected' : ''}">
                    <td><code>${esc(u.naioshId)}</code></td>
                    <td>${esc(u.name)}<div class="ag-muted">${esc(u.email)}</div></td>
                    <td>${badge(u.userType)}</td>
                    <td>${badge(u.status, u.status === 'active' ? 'ag-badge-ok' : 'ag-badge-warn')}</td>
                    <td><button type="button" class="ag-btn ag-btn-sm" data-action="ag-select-user" data-id="${esc(u.naioshId)}">فتح</button></td>
                  </tr>`
                )
                .join('')
            )}
          </div>
          <div class="ag-user360">
            ${
              detail
                ? `
              <h4>${esc(detail.identity.name)}</h4>
              <p><code>${esc(detail.identity.naioshId)}</code> · ${badge(detail.status)}</p>
              <p class="ag-muted">Verification: ${esc(detail.identity.verificationStatus)} · Positions: ${esc((detail.identity.positions || []).join(', '))}</p>
              <div class="ag-block"><strong>NAIOSHAI EMPIRE</strong><pre>${esc(JSON.stringify(detail.empire, null, 2))}</pre></div>
              <div class="ag-block"><strong>NAIOSHAI HUB 360</strong><pre>${esc(JSON.stringify(detail.hub, null, 2))}</pre></div>
              <div class="ag-block"><strong>SYSTEMS</strong><pre>${esc(JSON.stringify(detail.systems, null, 2))}</pre></div>
              <p>Effective Permissions: ${esc(detail.permissions.join(' · ') || '—')}</p>
              <div class="ag-actions-row">
                <button type="button" class="ag-btn ag-btn-primary" data-action="ag-why" data-perm="finance_approvals.approve" data-system="ERP" data-scope="BRANCH-ALEX">لماذا لديه هذه الصلاحية؟</button>
                <button type="button" class="ag-btn" data-action="ag-suspend-user">تعليق</button>
              </div>
              ${
                explanation
                  ? `<div class="ag-explain"><h5>Access Explanation</h5>
                      <p>Result: <strong>${esc(explanation.result)}</strong> · ${esc(explanation.reason || '')}</p>
                      <ol>${(explanation.chain || []).map((c) => `<li><strong>${esc(c.step)}</strong>: ${esc(c.value)}</li>`).join('')}</ol>
                    </div>`
                  : ''
              }`
                : `<p class="ag-empty">اختر مستخدمًا لعرض Effective Access.</p>`
            }
          </div>
        </div>
      </section>`;
  };

  const renderAssignments = () => renderMatrix().replace('مصفوفة الوصول · Master Access Matrix', 'التعيينات · Access Grants');

  const renderRequests = () => {
    const rows = state().requests || [];
    return `
      <section class="ag-panel">
        <h3 class="ag-section-title">طلبات الوصول · Access Request Center</h3>
        <div class="ag-toolbar">
          <button type="button" class="ag-btn ag-btn-primary" data-action="ag-request-demo">+ طلب وصول تجريبي</button>
        </div>
        ${
          rows.length
            ? renderTable(
                ['Request ID', 'المستخدم', 'الدور', 'النظام', 'النطاق', 'الحالة', ''],
                rows
                  .map(
                    (r) => `<tr>
                      <td><code>${esc(r.requestId)}</code></td>
                      <td>${esc(r.naioshId)}</td>
                      <td>${esc(r.roleCode)}</td>
                      <td>${esc(r.system)}</td>
                      <td>${esc(r.scopeCode)}</td>
                      <td>${badge(r.status)}</td>
                      <td>
                        <button type="button" class="ag-btn ag-btn-sm" data-action="ag-req-approve" data-id="${esc(r.id)}">موافقة</button>
                        <button type="button" class="ag-btn ag-btn-sm" data-action="ag-req-reject" data-id="${esc(r.id)}">رفض</button>
                      </td>
                    </tr>`
                  )
                  .join('')
              )
            : `<p class="ag-empty">لا طلبات. يمكن إنشاء طلب عبر الزر أعلاه أو معالج التعيين.</p>`
        }
      </section>`;
  };

  const renderDelegations = () => {
    const rows = state().delegations || [];
    return `
      <section class="ag-panel">
        <h3 class="ag-section-title">مركز التفويضات</h3>
        <p class="ag-lead">المساعد لا يرث صلاحيات المدير. لا يوجد Permanent Delegation افتراضيًا.</p>
        <div class="ag-toolbar"><button type="button" class="ag-btn ag-btn-primary" data-action="ag-dlg-demo">إنشاء تفويض تجريبي</button></div>
        ${renderTable(
          ['المفوِّض', 'المفوَّض', 'الصلاحية', 'النظام', 'النطاق', 'إلى', 'الحالة'],
          rows
            .map(
              (d) => `<tr>
                <td>${esc(d.delegatorNaioshId)}</td>
                <td>${esc(d.delegateNaioshId)}</td>
                <td>${esc((d.permissions || []).join(', '))}</td>
                <td>${esc(d.system)}</td>
                <td>${esc(d.scopeCode)}</td>
                <td>${fmt(d.endDate)}</td>
                <td>${badge(d.status)}</td>
              </tr>`
            )
            .join('')
        )}
      </section>`;
  };

  const renderTemporary = () => {
    const rows = state().temporaryAccess || [];
    engine().processTemporaryExpiry(state());
    return `
      <section class="ag-panel">
        <h3 class="ag-section-title">الوصول المؤقت</h3>
        <p class="ag-lead">عند انتهاء End Date يتم AUTO REVOKE فعليًا من المحرك.</p>
        <div class="ag-toolbar"><button type="button" class="ag-btn ag-btn-primary" data-action="ag-tmp-demo">منح وصول مؤقت 48 ساعة</button></div>
        ${renderTable(
          ['Grant', 'المستخدم', 'Permission', 'النظام', 'من', 'إلى', 'الحالة'],
          rows
            .map(
              (t) => `<tr>
                <td><code>${esc(t.grantId)}</code></td>
                <td>${esc(t.naioshId)}</td>
                <td>${esc(t.permission)}</td>
                <td>${esc(t.system)}</td>
                <td>${fmt(t.startDate)}</td>
                <td>${fmt(t.endDate)}</td>
                <td>${badge(t.status, t.status === 'ACTIVE' ? 'ag-badge-ok' : 'ag-badge-warn')}</td>
              </tr>`
            )
            .join('')
        )}
      </section>`;
  };

  const renderReviews = () => {
    const orphans = engine().detectOrphans();
    const revokes = state().revocations || [];
    return `
      <section class="ag-panel">
        <h3 class="ag-section-title">المراجعة والإلغاء · Orphaned Access</h3>
        <h4>Needs Action</h4>
        ${
          orphans.length
            ? `<ul class="ag-list">${orphans
                .map(
                  (o) =>
                    `<li>${badge(o.severity, 'ag-badge-warn')} <strong>${esc(o.type)}</strong> — ${esc(o.detail)}
                    ${o.grantId ? `<button type="button" class="ag-btn ag-btn-sm" data-action="ag-revoke" data-id="${esc(o.grantId)}">سحب</button>` : ''}</li>`
                )
                .join('')}</ul>`
            : `<p class="ag-empty">لا Orphaned Access.</p>`
        }
        <h4>سجل الإلغاء</h4>
        ${renderTable(
          ['Grant', 'السبب', 'بواسطة', 'الوقت'],
          revokes
            .map(
              (r) => `<tr>
                <td><code>${esc(r.grantId)}</code></td>
                <td>${esc(r.reason)}</td>
                <td>${esc(r.by)}</td>
                <td>${fmt(r.at)}</td>
              </tr>`
            )
            .join('')
        )}
      </section>`;
  };

  const renderSod = () => {
    const rules = state().sodRules || [];
    const conflicts = state().sodConflicts || [];
    return `
      <section class="ag-panel">
        <h3 class="ag-section-title">Separation of Duties</h3>
        ${renderTable(
          ['Rule', 'الصلاحيات المتعارضة', 'الإجراء', 'الخطورة'],
          rules
            .map(
              (r) => `<tr>
                <td><code>${esc(r.code)}</code><div>${esc(r.nameAr)}</div></td>
                <td>${esc((r.conflictingPermissions || []).join(' → '))}</td>
                <td>${badge(r.action)}</td>
                <td>${badge(r.risk, 'ag-badge-warn')}</td>
              </tr>`
            )
            .join('')
        )}
        <h4>تعارضات مسجّلة</h4>
        ${
          conflicts.length
            ? `<ul class="ag-list">${conflicts
                .slice(0, 20)
                .map((c) => `<li><code>${esc(c.conflictId)}</code> · ${esc(c.user || '')} · ${esc(c.requiredAction || c.risk || '')}</li>`)
                .join('')}</ul>`
            : `<p class="ag-empty">لا تعارضات مسجّلة بعد.</p>`
        }
        <div class="ag-toolbar">
          <button type="button" class="ag-btn" data-action="ag-sod-test">اختبار SoD: منشئ يحاول الاعتماد</button>
        </div>
      </section>`;
  };

  const renderAudit = () => {
    const rows = filterRows(state().audit || [], ['action', 'actor', 'targetUser', 'permission', 'system', 'reason']);
    return `
      <section class="ag-panel">
        <h3 class="ag-section-title">سجل تدقيق الوصول</h3>
        ${searchBar('ابحث في أحداث التدقيق...')}
        ${renderTable(
          ['الوقت', 'Actor', 'Target', 'Action', 'Permission', 'النظام', 'السبب'],
          rows
            .slice(0, 100)
            .map(
              (e) => `<tr>
                <td>${fmt(e.timestamp)}</td>
                <td>${esc(e.actor)}</td>
                <td>${esc(e.targetUser || '—')}</td>
                <td>${esc(e.action)}</td>
                <td>${esc(e.permission || '—')}</td>
                <td>${esc(e.system || '—')}</td>
                <td>${esc(e.reason || '—')}</td>
              </tr>`
            )
            .join('')
        )}
      </section>`;
  };

  const renderMyAccess = (user) => {
    const ref = user?.email || user?.naioshId || state().identities?.[0]?.naioshId;
    const eff = ref ? engine().effectiveAccess(ref) : null;
    if (!eff) {
      return `<section class="ag-panel"><h3 class="ag-section-title">صلاحياتي</h3><p class="ag-empty">لا توجد هوية مرتبطة بالحساب الحالي. افتح «المستخدمون 360».</p></section>`;
    }
    return `
      <section class="ag-panel">
        <h3 class="ag-section-title">صلاحياتي · My Access</h3>
        <p>${esc(eff.identity.name)} · <code>${esc(eff.identity.naioshId)}</code></p>
        <p><strong>مناصبي:</strong> ${esc((eff.identity.positions || []).join(' · ') || '—')}</p>
        <p><strong>أنظمتي:</strong> ${esc(Object.keys(eff.systems || {}).join(' · ') || '—')}</p>
        <p><strong>صلاحياتي:</strong> ${esc(eff.permissions.join(' · ') || '—')}</p>
        <p><strong>سلطاتي:</strong> ${esc(eff.authorities.join(' · ') || '—')}</p>
        <p><strong>نطاقاتي:</strong> ${esc(eff.scopes.join(' · ') || '—')}</p>
      </section>`;
  };

  const renderWizard = () => {
    if (!ui.wizard) return '';
    const w = ui.wizard;
    const st = state();
    const steps = ['المستخدم', 'المستوى', 'المنصب', 'الدور', 'النطاق', 'الصلاحيات', 'السلطة', 'المدة', 'السبب', 'معاينة'];
    return `
      <div class="ag-modal" role="dialog" aria-modal="true">
        <div class="ag-modal-card">
          <header><h3>معالج تعيين الوصول</h3><button type="button" class="ag-btn" data-action="ag-wizard-close">إغلاق</button></header>
          <div class="ag-wizard-steps">${steps.map((s, i) => `<span class="${w.step === i + 1 ? 'is-on' : ''}">${i + 1}. ${esc(s)}</span>`).join('')}</div>
          <div class="ag-wizard-body">
            ${
              w.step === 1
                ? `<label>المستخدم</label><select id="ag-w-user">${(st.identities || [])
                    .map((u) => `<option value="${esc(u.naioshId)}" ${w.naioshId === u.naioshId ? 'selected' : ''}>${esc(u.name)} (${esc(u.naioshId)})</option>`)
                    .join('')}</select>`
                : ''
            }
            ${
              w.step === 2
                ? `<label>المستوى</label><select id="ag-w-level">
                    <option value="EMPIRE">Empire</option><option value="HUB" selected>HUB</option><option value="SYSTEM">System</option>
                  </select>
                  <label>النظام</label><select id="ag-w-system">${(st.systems || [])
                    .map((s) => `<option value="${esc(s.code)}">${esc(s.nameAr)}</option>`)
                    .join('')}</select>`
                : ''
            }
            ${
              w.step === 3
                ? `<label>المنصب</label><select id="ag-w-pos">${(st.positions || [])
                    .map((p) => `<option value="${esc(p.code)}">${esc(p.nameAr)}</option>`)
                    .join('')}</select>`
                : ''
            }
            ${
              w.step === 4
                ? `<label>الدور (Eligible فقط)</label><select id="ag-w-role">${(st.roles || [])
                    .filter((r) => !w.positionCode || !r.eligiblePositions?.length || r.eligiblePositions.includes(w.positionCode))
                    .map((r) => `<option value="${esc(r.code)}">${esc(r.nameAr)}</option>`)
                    .join('')}</select>`
                : ''
            }
            ${
              w.step === 5
                ? `<label>النطاق</label><select id="ag-w-scope">${(st.scopes || [])
                    .map((s) => `<option value="${esc(s.code)}">${esc(s.nameAr)}</option>`)
                    .join('')}</select>`
                : ''
            }
            ${
              w.step === 6
                ? `<p class="ag-muted">تُؤخذ صلاحيات الدور الافتراضية مع إمكانية التخصيص لاحقًا.</p>`
                : ''
            }
            ${
              w.step === 7
                ? `<label>السلطة</label><select id="ag-w-auth"><option value="">—</option>${(st.authorities || [])
                    .map((a) => `<option value="${esc(a.code)}">${esc(a.nameAr)}</option>`)
                    .join('')}</select>`
                : ''
            }
            ${
              w.step === 8
                ? `<label>Start</label><input id="ag-w-start" type="datetime-local" />
                   <label>Expiry</label><input id="ag-w-exp" type="datetime-local" />
                   <label>Review</label><input id="ag-w-rev" type="datetime-local" />`
                : ''
            }
            ${w.step === 9 ? `<label>Purpose / Reason *</label><textarea id="ag-w-reason" rows="3"></textarea>` : ''}
            ${
              w.step === 10
                ? `<pre class="ag-preview">${esc(
                    JSON.stringify(
                      {
                        user: w.naioshId,
                        level: w.governanceLevel,
                        system: w.system,
                        position: w.positionCode,
                        role: w.roleCode,
                        scope: w.scopeCode,
                        authority: w.authorityCodes,
                        purpose: w.purpose,
                      },
                      null,
                      2
                    )
                  )}</pre>`
                : ''
            }
          </div>
          <footer>
            ${w.step > 1 ? `<button type="button" class="ag-btn" data-action="ag-wizard-prev">السابق</button>` : ''}
            ${w.step < 10 ? `<button type="button" class="ag-btn ag-btn-primary" data-action="ag-wizard-next">التالي</button>` : ''}
            ${w.step === 10 ? `<button type="button" class="ag-btn ag-btn-primary" data-action="ag-wizard-submit">تفعيل</button>` : ''}
          </footer>
        </div>
      </div>`;
  };

  const renderBody = (ctx = {}) => {
    if (ui.level === 'SYSTEMS' && ui.tab === 'overview') return renderSystemsLevel();
    if (ui.level === 'EMPIRE' && ui.tab === 'overview') {
      return `<section class="ag-panel"><h3 class="ag-section-title">إمبراطورية نايوش</h3>
        <p>المناصب والأدوار السيادية فقط (Isolation عن HUB/Systems).</p>
        ${renderTable(
          ['المنصب', 'الأدوار المؤهلة'],
          (state().positions || [])
            .filter((p) => p.orgLevel === 'EMPIRE')
            .map((p) => `<tr><td>${esc(p.nameAr)}</td><td>${esc((p.eligibleRoles || []).join(' · '))}</td></tr>`)
            .join('')
        )}</section>`;
    }
    if (ui.level === 'HUB' && ui.tab === 'overview') {
      return `<section class="ag-panel"><h3 class="ag-section-title">NAIOSHAI HUB 360</h3>
        <p>Scope: HUB-GLOBAL — إدارة الوصول المركزي للهوب.</p>
        ${renderStats()}</section>`;
    }
    switch (ui.tab) {
      case 'overview':
        return renderOverview();
      case 'users':
        return renderUsers();
      case 'positions':
        return renderPositions();
      case 'roles':
        return renderRoles();
      case 'permissions':
        return renderPermissions();
      case 'authorities':
        return renderAuthorities();
      case 'scopes':
        return renderScopes();
      case 'matrix':
        return renderMatrix();
      case 'assignments':
        return renderAssignments();
      case 'requests':
        return renderRequests();
      case 'delegations':
        return renderDelegations();
      case 'temporary':
        return renderTemporary();
      case 'reviews':
        return renderReviews();
      case 'sod':
        return renderSod();
      case 'audit':
        return renderAudit();
      case 'myaccess':
        return renderMyAccess(ctx.user);
      default:
        return renderOverview();
    }
  };

  const render = (ctx = {}) => {
    engine().processTemporaryExpiry(state());
    const crumbs = ['حوكمة الوصول', ui.level || 'نظرة عامة', ui.systemCode, NAV.find((n) => n.id === ui.tab)?.label].filter(Boolean);
    return `
      <div class="ag-root" data-ag-root>
        <header class="ag-hero">
          <div>
            <p class="ag-kicker">Access Governance 360</p>
            <h2>حوكمة الوصول والأدوار</h2>
            <p class="ag-desc">إدارة مركزية لهويات المستخدمين ومناصبهم وأدوارهم ونطاقات عملهم وصلاحياتهم وسلطاتهم والتفويضات ودورة حياة الوصول عبر إمبراطورية نايوش وNAIOSHAI HUB 360 والأنظمة التابعة.</p>
            <nav class="ag-crumbs" aria-label="breadcrumb">${crumbs.map((c) => `<span>${esc(c)}</span>`).join('<i>›</i>')}</nav>
          </div>
          <div class="ag-hero-actions">
            <a class="ag-btn" href="roles-permissions.html" target="_blank">الصفحة الكاملة (Legacy UX)</a>
            <button type="button" class="ag-btn ag-btn-primary" data-action="ag-wizard-open"><i class="fas fa-plus"></i> تعيين وصول</button>
          </div>
        </header>
        ${renderNav()}
        <div class="ag-main">${renderBody(ctx)}</div>
        ${renderWizard()}
      </div>`;
  };

  const readWizardFields = () => {
    const w = ui.wizard;
    if (!w) return;
    const val = (id) => document.getElementById(id)?.value;
    if (w.step === 1) w.naioshId = val('ag-w-user');
    if (w.step === 2) {
      w.governanceLevel = val('ag-w-level');
      w.system = val('ag-w-system');
    }
    if (w.step === 3) w.positionCode = val('ag-w-pos');
    if (w.step === 4) w.roleCode = val('ag-w-role');
    if (w.step === 5) w.scopeCode = val('ag-w-scope');
    if (w.step === 7) w.authorityCodes = val('ag-w-auth') ? [val('ag-w-auth')] : [];
    if (w.step === 8) {
      w.startDate = val('ag-w-start') ? new Date(val('ag-w-start')).toISOString() : null;
      w.expiryDate = val('ag-w-exp') ? new Date(val('ag-w-exp')).toISOString() : null;
      w.reviewDate = val('ag-w-rev') ? new Date(val('ag-w-rev')).toISOString() : null;
    }
    if (w.step === 9) w.purpose = val('ag-w-reason');
  };

  const handle = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const actor = user?.name || user?.email || 'مشغّل هوب';

    if (action === 'ag-tab') {
      ui.tab = btn.dataset.tab || 'overview';
      ui.level = null;
      return true;
    }
    if (action === 'ag-level') {
      ui.level = btn.dataset.level;
      ui.tab = 'overview';
      return true;
    }
    if (action === 'ag-open-system') {
      ui.systemCode = btn.dataset.code;
      ui.tab = 'matrix';
      ui.q = btn.dataset.code;
      return true;
    }
    if (action === 'ag-search') {
      ui.q = document.getElementById('ag-q')?.value || '';
      return true;
    }
    if (action === 'ag-select-user') {
      ui.selectedUser = btn.dataset.id;
      ui.drawer = null;
      return true;
    }
    if (action === 'ag-why') {
      ui.drawer = { type: 'why', permission: btn.dataset.perm, opts: { system: btn.dataset.system, scopeCode: btn.dataset.scope } };
      return true;
    }
    if (action === 'ag-suspend-user') {
      try {
        engine().suspendIdentity(ui.selectedUser, actor, 'Suspended from Access Governance UI');
        toast?.('تم تعليق المستخدم — Effective Access توقف');
      } catch (e) {
        toast?.(e.message || 'فشل التعليق');
      }
      return true;
    }
    if (action === 'ag-revoke') {
      try {
        engine().revokeGrant(btn.dataset.id, actor, 'Revoked from review');
        toast?.('تم سحب الوصول مع تسجيل Audit');
      } catch (e) {
        toast?.(e.message || 'فشل السحب');
      }
      return true;
    }
    if (action === 'ag-wizard-open') {
      ui.wizard = { step: 1, naioshId: state().identities?.[0]?.naioshId };
      return true;
    }
    if (action === 'ag-wizard-close') {
      ui.wizard = null;
      return true;
    }
    if (action === 'ag-wizard-next') {
      readWizardFields();
      ui.wizard.step = Math.min(10, (ui.wizard.step || 1) + 1);
      return true;
    }
    if (action === 'ag-wizard-prev') {
      readWizardFields();
      ui.wizard.step = Math.max(1, (ui.wizard.step || 1) - 1);
      return true;
    }
    if (action === 'ag-wizard-submit') {
      readWizardFields();
      try {
        const w = ui.wizard;
        engine().createGrant(
          {
            naioshId: w.naioshId,
            positionCode: w.positionCode,
            roleCode: w.roleCode,
            system: w.system || 'HUB',
            scopeCode: w.scopeCode || 'HUB-GLOBAL',
            authorityCodes: w.authorityCodes || [],
            purpose: w.purpose || 'Wizard grant',
            startDate: w.startDate,
            expiryDate: w.expiryDate,
            reviewDate: w.reviewDate,
            governanceLevel: w.governanceLevel || 'HUB',
          },
          actor
        );
        ui.wizard = null;
        ui.tab = 'assignments';
        toast?.('تم تفعيل Grant بعد التحقق');
      } catch (e) {
        toast?.(e.message || 'فشل التعيين');
      }
      return true;
    }
    if (action === 'ag-request-demo') {
      window.HubAccessGovStore.update((st) => {
        const u = st.identities[0];
        if (!u) return st;
        st.requests.unshift({
          id: window.HubAccessGovStore.uid('acr'),
          requestId: `ACR-${new Date().getFullYear()}-${String(st.requests.length + 1).padStart(5, '0')}`,
          naioshId: u.naioshId,
          roleCode: 'REPORT_VIEWER',
          system: 'ERP',
          scopeCode: 'BRANCH-CAIRO',
          permissions: ['customer_requests.view'],
          authorityCodes: [],
          reason: 'طلب عرض تقارير فرع القاهرة',
          requestedBy: actor,
          date: window.HubAccessGovStore.nowIso(),
          approver: null,
          status: 'Pending',
        });
        return st;
      }, actor);
      toast?.('تم إنشاء طلب ACR');
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
            engine().createGrant(
              {
                naioshId: row.naioshId,
                roleCode: row.roleCode,
                system: row.system,
                scopeCode: row.scopeCode,
                permissions: row.permissions,
                purpose: row.reason,
                governanceLevel: 'SYSTEM',
              },
              actor
            );
            row.status = 'Granted';
          } catch (_) {}
        }
        window.HubAccessGovStore.pushAudit(st, {
          actor,
          targetUser: row.naioshId,
          action: action === 'ag-req-approve' ? 'ACCESS_REQUEST_APPROVED' : 'ACCESS_REQUEST_REJECTED',
          requestId: row.requestId,
          reason: row.reason,
        });
        return st;
      }, actor);
      toast?.(action === 'ag-req-approve' ? 'تمت الموافقة' : 'تم الرفض');
      return true;
    }
    if (action === 'ag-dlg-demo') {
      const ids = state().identities || [];
      if (ids.length < 2) {
        // create assistant identity
        window.HubAccessGovStore.update((st) => {
          st.identities.push({
            id: window.HubAccessGovStore.uid('id'),
            naioshId: 'NAI-ASSIST-001',
            name: 'مساعد مدير الفرع',
            email: 'assistant@naiosh.example',
            userType: 'STAFF',
            verificationStatus: 'VERIFIED',
            status: 'active',
            positions: [],
            createdAt: window.HubAccessGovStore.nowIso(),
            updatedAt: window.HubAccessGovStore.nowIso(),
          });
          return st;
        });
      }
      const st2 = state();
      const manager = st2.identities.find((i) => i.naioshId === 'NAI-USER-0025') || st2.identities[0];
      const assistant = st2.identities.find((i) => i.naioshId === 'NAI-ASSIST-001') || st2.identities[1];
      try {
        engine().createDelegation(
          {
            delegatorNaioshId: manager.naioshId,
            delegateNaioshId: assistant.naioshId,
            permission: 'customer_requests.view',
            system: 'ERP',
            scopeCode: 'BRANCH-ALEX',
            purpose: 'تغطية مؤقتة للعرض فقط',
            endDate: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
          },
          actor
        );
        toast?.('تم التفويض بصلاحية واحدة فقط');
      } catch (e) {
        toast?.(e.message);
      }
      return true;
    }
    if (action === 'ag-tmp-demo') {
      const u = state().identities?.[0];
      if (!u) return true;
      try {
        engine().createTemporaryAccess(
          {
            naioshId: u.naioshId,
            system: 'ERP',
            permission: 'finance_approvals.approve',
            authorityCode: 'FIN_APPROVE_25K',
            scopeCode: 'BRANCH-ALEX',
            endDate: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
            reason: 'اعتماد طارئ 48 ساعة',
          },
          actor
        );
        toast?.('تم منح وصول مؤقت — سيتم إلغاؤه تلقائيًا بعد المدة');
      } catch (e) {
        toast?.(e.message);
      }
      return true;
    }
    if (action === 'ag-sod-test') {
      const u = state().identities.find((i) => i.naioshId === 'NAI-USER-0025') || state().identities[0];
      const res = engine().authorize({
        naioshId: u?.naioshId,
        permission: 'customer_requests.approve',
        system: 'ERP',
        scopeCode: 'BRANCH-ALEX',
        transactionId: 'TX-DEMO-1',
        transactionCreatorId: u?.id,
      });
      toast?.(`SoD قرار: ${res.decision} — ${res.reason}`);
      return true;
    }
    if (action === 'ag-view-pos' || action === 'ag-view-role') {
      toast?.(action === 'ag-view-pos' ? `منصب ${btn.dataset.code}` : `دور ${btn.dataset.code}`);
      return true;
    }
    return false;
  };

  window.HubAccessGovUI = { render, handle, ui, NAV };
})();
