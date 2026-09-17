/**
 * واجهة موافقات المدير الأعلى — مراجعة · موافقة · رفض · طلب تعديل
 */
(() => {
  'use strict';

  const HA = () => window.HubHigherApprovals;
  const fmt = (iso) => {
    if (!iso) return '—';
    try {
      if (window.HubFormat?.dateTime) return window.HubFormat.dateTime(iso);
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '—';
      const p = (n) => String(n).padStart(2, '0');
      const h = d.getHours();
      const ap = h >= 12 ? 'م' : 'ص';
      const h12 = h % 12 || 12;
      return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(h12)}:${p(d.getMinutes())} ${ap}`;
    } catch {
      return '—';
    }
  };

  const esc = (v = '') =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const ui = {
    tab: 'pending_review',
    q: '',
    openId: null,
    modal: null, // { kind: 'approve'|'reject'|'revise'|'password', id, error, value }
  };

  const parseDeepLink = () => {
    try {
      const hash = String(location.hash || '');
      const m = hash.match(/[?&]apr=([^&]+)/);
      if (m) {
        ui.openId = decodeURIComponent(m[1]);
        ui.tab = 'pending_review';
      }
    } catch (_) {}
  };

  const actorOf = (user) => ({
    name: user?.name || user?.email || 'المدير الأعلى',
    email: user?.email || '',
    employeeNo: user?.employeeNo || '',
    naioshId: user?.naioshId || user?.id || '',
  });

  const statusBadge = (status) => {
    const ar = HA()?.STATUS_AR?.[status] || status;
    const cls =
      status === 'pending_review'
        ? 'ha-badge is-pending'
        : status === 'approved'
          ? 'ha-badge is-ok'
          : status === 'rejected'
            ? 'ha-badge is-bad'
            : 'ha-badge is-warn';
    return `<span class="${cls}">${esc(ar)}</span>`;
  };

  const emptyState = () => `<div class="ha-empty">
      <i class="fas fa-clipboard-check"></i>
      <h3>لا توجد طلبات بانتظار موافقتك حاليًا.</h3>
      <p>ستظهر هنا العمليات الحساسة التي يرسلها الموظفون وتحتاج إلى اعتمادك قبل تنفيذها.</p>
      <p class="ha-empty-hint">إدارة الأدوار والصلاحيات تبقى في <a href="#roles-permissions">إدارة فريق العمل والصلاحيات</a> — هذه الصفحة للاعتماد فقط.</p>
    </div>`;

  const renderKpis = (k) => {
    const cards = [
      { key: 'pending_review', label: 'بانتظار المراجعة', value: k.pending, cls: 'is-pending' },
      { key: 'approved', label: 'تمت الموافقة', value: k.approved, cls: 'is-ok' },
      { key: 'rejected', label: 'مرفوضة', value: k.rejected, cls: 'is-bad' },
      { key: 'needs_revision', label: 'أعيدت للتعديل', value: k.needsRevision, cls: 'is-warn' },
    ];
    return `<div class="ha-kpis">${cards
      .map(
        (c) => `<button type="button" class="ha-kpi ${c.cls} ${ui.tab === c.key ? 'is-active' : ''}" data-action="ha-tab" data-tab="${c.key}">
        <span>${esc(c.label)}</span><strong>${esc(String(c.value))}</strong>
      </button>`
      )
      .join('')}</div>`;
  };

  const TABS = [
    { id: 'pending_review', label: 'بانتظار المراجعة' },
    { id: 'approved', label: 'تمت الموافقة' },
    { id: 'rejected', label: 'مرفوضة' },
    { id: 'needs_revision', label: 'أعيدت للتعديل' },
    { id: 'all', label: 'جميع الطلبات' },
    { id: 'audit', label: 'سجل الموافقات' },
  ];

  const renderTabs = () =>
    `<div class="ha-tabs" role="tablist">${TABS.map(
      (t) =>
        `<button type="button" class="ha-tab ${ui.tab === t.id ? 'is-active' : ''}" data-action="ha-tab" data-tab="${esc(t.id)}" role="tab">${esc(t.label)}</button>`
    ).join('')}</div>`;

  const filteredRows = () => {
    if (ui.tab === 'audit') return [];
    if (ui.tab === 'all') return HA().list({ q: ui.q });
    return HA().list({ status: ui.tab, q: ui.q });
  };

  const renderTable = (rows) => {
    if (!rows.length) return emptyState();
    return `<div class="ha-table-wrap"><table class="ha-table">
      <thead>
        <tr>
          <th>رقم طلب الموافقة</th>
          <th>نوع العملية</th>
          <th>مقدم الطلب</th>
          <th>رقم الموظف</th>
          <th>النظام</th>
          <th>العنصر المتأثر</th>
          <th>سبب الطلب</th>
          <th>تاريخ الطلب</th>
          <th>الحالة</th>
          <th>الإجراءات</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr class="${ui.openId === r.id ? 'is-open' : ''}">
            <td><code dir="ltr">${esc(r.id)}</code></td>
            <td>${esc(r.typeLabel)}</td>
            <td>${esc(r.requesterName || '—')}</td>
            <td dir="ltr">${esc(r.subjectEmployeeNo || r.requesterEmployeeNo || '—')}</td>
            <td>${esc(r.systemLabel || r.system || '—')}</td>
            <td>${esc(r.affectedLabel || '—')}</td>
            <td class="ha-reason">${esc(r.reason || '—')}</td>
            <td>${esc(fmt(r.createdAt))}</td>
            <td>${statusBadge(r.status)}</td>
            <td><button type="button" class="btn btn-primary btn-sm" data-action="ha-open" data-id="${esc(r.id)}"><i class="fas fa-search"></i> مراجعة الطلب</button></td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table></div>`;
  };

  const renderAudit = () => {
    const rows = HA().listDecisions();
    if (!rows.length) {
      return `<div class="ha-empty"><p>لا يوجد سجل موافقات بعد.</p></div>`;
    }
    return `<div class="ha-table-wrap"><table class="ha-table">
      <thead>
        <tr>
          <th>رقم الطلب</th>
          <th>نوع العملية</th>
          <th>مقدم الطلب</th>
          <th>رقم الموظف</th>
          <th>القرار</th>
          <th>المدير</th>
          <th>رقم موظف المدير</th>
          <th>السبب</th>
          <th>تاريخ الطلب</th>
          <th>تاريخ القرار</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (d) => `<tr>
            <td><code dir="ltr">${esc(d.requestId)}</code></td>
            <td>${esc(d.typeLabel)}</td>
            <td>${esc(d.requesterName || '—')}</td>
            <td dir="ltr">${esc(d.subjectEmployeeNo || '—')}</td>
            <td>${esc(d.decisionAr || d.decision)}</td>
            <td>${esc(d.decidedBy || '—')}</td>
            <td dir="ltr">${esc(d.decidedByEmployeeNo || '—')}</td>
            <td class="ha-reason">${esc(d.reason || '—')}</td>
            <td>${esc(fmt(d.requestedAt))}</td>
            <td>${esc(fmt(d.decidedAt))}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table></div>`;
  };

  const preLines = (text) =>
    esc(text || '—')
      .split('\n')
      .map((l) => l || ' ')
      .join('<br/>');

  const renderDetail = (r) => {
    if (!r) return '';
    const canAct = r.status === 'pending_review' || r.status === 'needs_revision';
    const canResubmit = r.status === 'needs_revision';
    return `<aside class="ha-detail" aria-label="مراجعة طلب الموافقة">
      <header class="ha-detail-head">
        <div>
          <p class="ha-kicker">مراجعة طلب الموافقة</p>
          <h2>${esc(r.typeLabel)} <code dir="ltr">${esc(r.id)}</code></h2>
          ${statusBadge(r.status)}
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-action="ha-close" aria-label="إغلاق">×</button>
      </header>
      <div class="ha-detail-grid">
        <div><span>مقدم الطلب</span><strong>${esc(r.requesterName || '—')}</strong></div>
        <div><span>رقم الموظف</span><strong dir="ltr">${esc(r.subjectEmployeeNo || r.requesterEmployeeNo || '—')}</strong></div>
        <div><span>الموظف المتأثر</span><strong>${esc(r.subjectName || '—')}</strong></div>
        <div><span>مكان العمل</span><strong>${esc(r.workplace || '—')}</strong></div>
        <div><span>النظام</span><strong>${esc(r.systemLabel || '—')}</strong></div>
        <div><span>تاريخ ووقت الطلب</span><strong>${esc(fmt(r.createdAt))}</strong></div>
      </div>
      <div class="ha-block">
        <h3>سبب الطلب</h3>
        <p>${esc(r.reason || '—')}</p>
        ${r.revisionNote ? `<p class="ha-note"><b>مطلوب تعديله:</b> ${esc(r.revisionNote)}</p>` : ''}
        ${r.rejectReason ? `<p class="ha-note is-bad"><b>سبب الرفض:</b> ${esc(r.rejectReason)}</p>` : ''}
      </div>
      <div class="ha-compare">
        <h3>التغيير المطلوب</h3>
        <div class="ha-compare-grid">
          <article>
            <h4>القيمة الحالية</h4>
            <div class="ha-pre">${preLines(r.currentDisplay)}</div>
          </article>
          <article>
            <h4>القيمة المطلوبة</h4>
            <div class="ha-pre">${preLines(r.requestedDisplay)}</div>
          </article>
        </div>
      </div>
      <div class="ha-actions">
        ${
          canAct
            ? `<button type="button" class="btn btn-primary" data-action="ha-modal" data-kind="approve" data-id="${esc(r.id)}"><i class="fas fa-check"></i> موافقة</button>
               <button type="button" class="btn btn-dark" data-action="ha-modal" data-kind="revise" data-id="${esc(r.id)}"><i class="fas fa-pen"></i> طلب تعديل</button>
               <button type="button" class="btn btn-ghost danger" data-action="ha-modal" data-kind="reject" data-id="${esc(r.id)}"><i class="fas fa-xmark"></i> رفض</button>`
            : ''
        }
        ${
          canResubmit
            ? `<button type="button" class="btn btn-primary" data-action="ha-resubmit" data-id="${esc(r.id)}"><i class="fas fa-paper-plane"></i> إعادة الإرسال للمراجعة</button>`
            : ''
        }
        <a class="btn btn-ghost" href="#roles-permissions">إدارة فريق العمل والصلاحيات</a>
      </div>
    </aside>`;
  };

  const renderModal = () => {
    const m = ui.modal;
    if (!m) return '';
    const req = HA().get(m.id);
    if (!req) return '';
    if (m.kind === 'approve') {
      return `<div class="ha-modal-backdrop" data-action="ha-modal-cancel">
        <div class="ha-modal" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
          <header><h3>هل تريد الموافقة على هذا الطلب؟</h3><button type="button" class="ha-modal-x" data-action="ha-modal-cancel">×</button></header>
          <div class="ha-modal-body">
            <p><b>${esc(req.typeLabel)}</b> · <code dir="ltr">${esc(req.id)}</code></p>
            <p>المتأثر: ${esc(req.subjectName || req.affectedLabel || '—')}</p>
            <p class="muted">بعد التأكيد سيتم تنفيذ التغيير فعليًا وتسجيله في سجل الموافقات.</p>
            ${m.error ? `<p class="ha-error">${esc(m.error)}</p>` : ''}
          </div>
          <footer>
            <button type="button" class="btn btn-ghost" data-action="ha-modal-cancel">إلغاء</button>
            <button type="button" class="btn btn-primary" data-action="ha-modal-ok">تأكيد الموافقة</button>
          </footer>
        </div>
      </div>`;
    }
    if (m.kind === 'reject') {
      return `<div class="ha-modal-backdrop" data-action="ha-modal-cancel">
        <div class="ha-modal" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
          <header><h3>رفض الطلب</h3><button type="button" class="ha-modal-x" data-action="ha-modal-cancel">×</button></header>
          <div class="ha-modal-body">
            <label>سبب الرفض <span class="req">*</span>
              <textarea data-ha-field="value" rows="4" placeholder="اكتب سبب الرفض بوضوح…">${esc(m.value || '')}</textarea>
            </label>
            ${m.error ? `<p class="ha-error">${esc(m.error)}</p>` : ''}
          </div>
          <footer>
            <button type="button" class="btn btn-ghost" data-action="ha-modal-cancel">إلغاء</button>
            <button type="button" class="btn btn-primary" data-action="ha-modal-ok">تأكيد الرفض</button>
          </footer>
        </div>
      </div>`;
    }
    if (m.kind === 'revise') {
      return `<div class="ha-modal-backdrop" data-action="ha-modal-cancel">
        <div class="ha-modal" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
          <header><h3>طلب تعديل</h3><button type="button" class="ha-modal-x" data-action="ha-modal-cancel">×</button></header>
          <div class="ha-modal-body">
            <label>ما المطلوب تعديله؟ <span class="req">*</span>
              <textarea data-ha-field="value" rows="4" placeholder="مثال: الدور المطلوب يحتوي على صلاحيات أعلى من المطلوب…">${esc(m.value || '')}</textarea>
            </label>
            ${m.error ? `<p class="ha-error">${esc(m.error)}</p>` : ''}
          </div>
          <footer>
            <button type="button" class="btn btn-ghost" data-action="ha-modal-cancel">إلغاء</button>
            <button type="button" class="btn btn-primary" data-action="ha-modal-ok">إرسال طلب التعديل</button>
          </footer>
        </div>
      </div>`;
    }
    if (m.kind === 'password') {
      return `<div class="ha-modal-backdrop" data-action="ha-modal-cancel">
        <div class="ha-modal" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
          <header><h3>تفعيل دخول العميل</h3><button type="button" class="ha-modal-x" data-action="ha-modal-cancel">×</button></header>
          <div class="ha-modal-body">
            <p>كلمة مرور الدخول للعميل: <b dir="ltr">${esc(m.email || '')}</b></p>
            <p class="muted">نفس كلمة السجل المدخلة أو كلمة جديدة لحفظ التعديل (8 أحرف على الأقل).</p>
            <label>كلمة المرور
              <input type="password" data-ha-field="value" value="${esc(m.value || '')}" autocomplete="new-password" />
            </label>
            ${m.error ? `<p class="ha-error">${esc(m.error)}</p>` : ''}
          </div>
          <footer>
            <button type="button" class="btn btn-ghost" data-action="ha-modal-cancel">إلغاء</button>
            <button type="button" class="btn btn-primary" data-action="ha-modal-ok">تأكيد</button>
          </footer>
        </div>
      </div>`;
    }
    return '';
  };

  const render = (ctx = {}) => {
    parseDeepLink();
    HA()?.reload?.();
    const k = HA()?.kpis?.() || { pending: 0, approved: 0, rejected: 0, needsRevision: 0, all: 0 };
    const rows = filteredRows();
    const open = ui.openId ? HA().get(ui.openId) : null;
    return `<div class="hub-ops-ws hub-ha-ws">
      <header class="ha-header">
        <div>
          <p class="ha-kicker"><i class="fas fa-user-shield"></i> NAIOSH HUB</p>
          <h1>موافقات المدير الأعلى</h1>
          <p class="ha-sub">مراجعة واعتماد العمليات الحساسة التي تتطلب موافقة المدير الأعلى قبل تنفيذها.</p>
        </div>
        <div class="ha-header-actions">
          <button type="button" class="btn btn-dark btn-sm" data-action="ha-refresh"><i class="fas fa-rotate"></i> تحديث</button>
          <a class="btn btn-ghost btn-sm" href="#roles-permissions"><i class="fas fa-shield-halved"></i> فريق العمل والصلاحيات</a>
        </div>
      </header>
      ${renderKpis(k)}
      ${renderTabs()}
      ${
        ui.tab !== 'audit'
          ? `<div class="ha-toolbar">
              <input type="search" placeholder="بحث برقم الطلب · النوع · مقدم الطلب · الموظف" value="${esc(ui.q)}" data-ha-q />
              <button type="button" class="btn btn-dark btn-sm" data-action="ha-search"><i class="fas fa-magnifying-glass"></i> تصفية</button>
            </div>`
          : ''
      }
      <div class="ha-layout ${open ? 'has-detail' : ''}">
        <div class="ha-main">${ui.tab === 'audit' ? renderAudit() : renderTable(rows)}</div>
        ${open ? renderDetail(open) : ''}
      </div>
      ${renderModal()}
    </div>`;
  };

  const readModalField = () => {
    const el = document.querySelector('.ha-modal [data-ha-field="value"]');
    return el ? el.value : ui.modal?.value || '';
  };

  const handle = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const actor = actorOf(user);

    if (action === 'ha-tab') {
      ui.tab = btn.dataset.tab || 'pending_review';
      ui.openId = null;
      return true;
    }
    if (action === 'ha-refresh') {
      HA()?.reload?.();
      window.HubPlatformGrants?.hydrate?.();
      toast?.('تم التحديث');
      return true;
    }
    if (action === 'ha-search') {
      const inp = document.querySelector('[data-ha-q]');
      ui.q = inp?.value || '';
      return true;
    }
    if (action === 'ha-open') {
      ui.openId = btn.dataset.id;
      return true;
    }
    if (action === 'ha-close') {
      ui.openId = null;
      return true;
    }
    if (action === 'ha-modal') {
      ui.modal = { kind: btn.dataset.kind, id: btn.dataset.id, value: '', error: '', email: btn.dataset.email || '' };
      return true;
    }
    if (action === 'ha-modal-cancel') {
      ui.modal = null;
      return true;
    }
    if (action === 'ha-modal-ok') {
      const m = ui.modal;
      if (!m) return true;
      const value = readModalField() || m.value || '';
      if (m.kind === 'approve') {
        const res = HA().approve(m.id, actor);
        if (!res.ok) {
          ui.modal = { ...m, error: res.error };
          return true;
        }
        ui.modal = null;
        ui.tab = 'approved';
        toast?.('تمت الموافقة وتنفيذ العملية');
        return true;
      }
      if (m.kind === 'reject') {
        const res = HA().reject(m.id, value, actor);
        if (!res.ok) {
          ui.modal = { ...m, value, error: res.error };
          return true;
        }
        ui.modal = null;
        ui.tab = 'rejected';
        toast?.('تم الرفض');
        return true;
      }
      if (m.kind === 'revise') {
        const res = HA().requestRevision(m.id, value, actor);
        if (!res.ok) {
          ui.modal = { ...m, value, error: res.error };
          return true;
        }
        ui.modal = null;
        ui.tab = 'needs_revision';
        toast?.('أُرسل طلب التعديل');
        return true;
      }
      if (m.kind === 'password') {
        if (!value || value.length < 8) {
          ui.modal = { ...m, value, error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' };
          return true;
        }
        const grant = window.HubPlatformGrants?.getGrant?.(m.id);
        const email = m.email || grant?.adminEmail;
        const ensure = window.HubPlatformGrants?.ensureTenantLogin;
        if (!ensure) {
          ui.modal = { ...m, value, error: 'وحدة تفعيل الدخول غير متاحة' };
          return true;
        }
        Promise.resolve(ensure({ email, password: value, grant })).then((res) => {
          if (!res?.ok) {
            ui.modal = { ...m, value, error: res?.error || 'فشل التفعيل' };
            window.dispatchEvent(new CustomEvent('hub-ha-rerender'));
            return;
          }
          ui.modal = null;
          toast?.(`تم تفعيل الدخول لـ ${email || ''}`);
          window.dispatchEvent(new CustomEvent('hub-ha-rerender'));
        });
        return true;
      }
      return true;
    }
    if (action === 'ha-resubmit') {
      const res = HA().resubmit(btn.dataset.id, {}, actor);
      if (!res.ok) {
        toast?.(res.error || 'تعذر إعادة الإرسال');
        return true;
      }
      ui.tab = 'pending_review';
      toast?.('أُعيد إرسال الطلب للمراجعة');
      return true;
    }
    return false;
  };

  const handleChange = () => false;

  window.HubHigherApprovalsUI = {
    render,
    handle,
    handleChange,
    ui,
    openRequest: (id) => {
      ui.openId = id;
      ui.tab = 'pending_review';
    },
  };

  /* توافق مع مفتاح rent-admin في لوحة التحكم */
  window.HubRentAdminWS = {
    render: (ctx) => window.HubHigherApprovalsUI.render(ctx),
    handle: (action, btn, ctx) => window.HubHigherApprovalsUI.handle(action, btn, ctx),
    handleChange: (e, ctx) => window.HubHigherApprovalsUI.handleChange(e, ctx),
    ui,
  };
})();
