/**
 * NAIOSH HUB 360 — Batch B: Customers & Permissions Workspaces
 * clients · posha · roles · notifications · rent-admin · side-projects
 */
(() => {
  'use strict';

  const Kit = () => window.HubWsKit;
  const store = () => window.HubStore;

  /* ───────── Clients Management ───────── */
  const clUi = {
    tab: 'list',
    page: 1,
    pageSize: 10,
    filters: { q: '', status: '' },
    modal: null,
    drawer: null,
    helpOpen: false,
    editId: null,
    kpiFocus: '',
    detailTab: 'overview',
    permissions: null,
    permissionsLoaded: false,
    saving: false,
    idemKey: null,
    loadError: '',
  };

  const authHeaders = () => {
    const token = localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || '';
    const userRaw = localStorage.getItem('hubUser') || sessionStorage.getItem('hubUser');
    let role = '';
    try {
      role = userRaw ? JSON.parse(userRaw).role || '' : '';
    } catch {
      role = '';
    }
    const h = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (token) h.Authorization = `Bearer ${token}`;
    if (role) h['X-Hub-User-Role'] = role;
    return h;
  };

  const ensurePermissions = (user) => {
    if (clUi.permissionsLoaded && Array.isArray(clUi.permissions)) return Promise.resolve(clUi.permissions);
    return fetch('/api/auth/me', { headers: authHeaders(), cache: 'no-store' })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        if (data?.ok && Array.isArray(data.permissions)) {
          clUi.permissions = data.permissions;
        } else {
          // Fallback: chief_engineer / admin operational create (pre-session hydrate)
          const role = String(user?.role || '').toLowerCase();
          clUi.permissions =
            role === 'supreme_leader' || role === 'super_admin'
              ? ['clients.create', 'clients.view', 'clients.edit', 'permissions.manage']
              : role === 'chief_engineer' || role === 'admin'
                ? ['clients.create', 'clients.view', 'clients.edit']
                : [];
        }
        clUi.permissionsLoaded = true;
        return clUi.permissions;
      })
      .catch(() => {
        clUi.permissions = [];
        clUi.permissionsLoaded = true;
        return clUi.permissions;
      });
  };

  const canCreateClient = (user) => {
    if (Array.isArray(clUi.permissions)) return clUi.permissions.includes('clients.create');
    const role = String(user?.role || '').toLowerCase();
    return ['supreme_leader', 'super_admin', 'chief_engineer', 'admin'].includes(role);
  };

  const syncClientsFromApi = () => {
    return fetch('/api/admin/clients', { headers: authHeaders(), cache: 'no-store' })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        if (!data?.ok || !Array.isArray(data.clients)) return;
        const bag = store().clientsBag?.();
        if (!bag) return;
        if (!Array.isArray(bag.clients)) bag.clients = [];
        data.clients.forEach((apiRow) => {
          const email = String(apiRow.email || '').toLowerCase();
          if (!email) return;
          let row = bag.clients.find((c) => String(c.email || '').toLowerCase() === email);
          if (!row) {
            row = {
              id: `cli-api-${apiRow.clientId || email}`,
              clientId: apiRow.clientId || '',
              name: apiRow.name || email,
              email,
              status: apiRow.status || 'pending',
              company: apiRow.company || '',
              country: apiRow.country || '',
              phone: apiRow.phone || '',
              accountLevel: apiRow.accountLevel || 'standard',
              systems: [],
              orders: [],
              subscriptions: [],
              invoices: [],
              wallet: { paid: 0, free: 0, total: Number(apiRow.walletTotal) || 0, ledger: [] },
              tickets: [],
              internalNotes: [],
              lastLoginAt: apiRow.lastLoginAt || '',
              source: apiRow.source || 'API',
              createdAt: apiRow.createdAt || '',
              updatedAt: apiRow.createdAt || '',
              createdByEmployeeId: apiRow.createdByEmployeeId || '',
              createdByEmail: apiRow.createdByEmail || '',
              systemsCount: apiRow.systemsCount || 0,
              openOrders: apiRow.openOrders || 0,
              walletTotal: apiRow.walletTotal || 0,
            };
            bag.clients.unshift(row);
          } else {
            row.clientId = apiRow.clientId || row.clientId;
            row.name = apiRow.name || row.name;
            row.status = apiRow.status || row.status;
            row.createdByEmployeeId = apiRow.createdByEmployeeId || row.createdByEmployeeId || '';
            row.createdByEmail = apiRow.createdByEmail || row.createdByEmail || '';
            if (apiRow.company) row.company = apiRow.company;
            if (apiRow.country) row.country = apiRow.country;
            if (apiRow.phone) row.phone = apiRow.phone;
          }
        });
        store().save?.();
      })
      .catch(() => null);
  };
  const CL_TABS = [
    { id: 'list', label: 'العملاء', icon: 'fa-users' },
    { id: 'audit', label: 'سجل العمليات', icon: 'fa-clock-rotate-left' },
    { id: 'settings', label: 'الإعدادات', icon: 'fa-gear' },
  ];

  const filterClients = (list) => {
    const f = clUi.filters;
    return (list || []).filter((c) => {
      if (clUi.kpiFocus === 'pending' && c.status !== 'pending') return false;
      if (clUi.kpiFocus === 'suspended' && c.status !== 'suspended') return false;
      if (clUi.kpiFocus === 'active' && c.status !== 'active') return false;
      if (f.status && c.status !== f.status) return false;
      if (f.q) {
        const hay = `${c.name} ${c.email} ${c.clientId} ${c.company}`.toLowerCase();
        if (!hay.includes(f.q.toLowerCase())) return false;
      }
      return true;
    });
  };

  const clientForm = (item = {}) => {
    const K = Kit();
    const creating = !clUi.editId;
    return `
      <div class="grid-2">
        <div class="field"><label>الاسم *</label><input id="cl-name" value="${K.esc(item.name || '')}" ${clUi.saving ? 'disabled' : ''} /></div>
        <div class="field"><label>البريد *</label><input id="cl-email" type="email" value="${K.esc(item.email || '')}" ${clUi.saving || !!clUi.editId ? 'disabled' : ''} /></div>
        <div class="field"><label>الهاتف ${creating ? '' : ''}</label><input id="cl-phone" value="${K.esc(item.phone || '')}" placeholder="05xxxxxxxx" ${clUi.saving ? 'disabled' : ''} /></div>
        <div class="field"><label>رقم العميل</label><input id="cl-clientId" value="${K.esc(item.clientId || '')}" placeholder="يُنشأ تلقائيًا" ${creating ? 'disabled' : ''} /></div>
        <div class="field"><label>الحالة</label>
          <select id="cl-status" ${clUi.saving ? 'disabled' : ''}>${['active', 'pending', 'suspended'].map((s) => `<option value="${s}" ${item.status === s ? 'selected' : ''}>${K.esc(window.HubI18n?.status?.(s) || s)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>الشركة</label><input id="cl-company" value="${K.esc(item.company || '')}" ${clUi.saving ? 'disabled' : ''} /></div>
        <div class="field"><label>الدولة</label><input id="cl-country" value="${K.esc(item.country || '')}" ${clUi.saving ? 'disabled' : ''} /></div>
        <div class="field"><label>المصدر</label>
          <select id="cl-source" ${clUi.saving ? 'disabled' : ''}>${['إدخال يدوي', 'System Generated', 'Integration', 'POSHA', 'Register'].map((s) => `<option value="${K.esc(s)}" ${(item.source || 'إدخال يدوي') === s ? 'selected' : ''}>${K.esc(window.HubI18n?.label?.(s) || s)}</option>`).join('')}</select>
        </div>
      </div>
      ${item.createdByEmployeeId ? `<p class="muted" style="margin-top:8px">أُنشئ بواسطة: <strong>${K.esc(item.createdByEmployeeId)}</strong></p>` : ''}`;
  };

  const renderClientDrawer = (c) => {
    const K = Kit();
    const tab = clUi.detailTab;
    const tabs = ['overview', 'systems', 'orders', 'wallet', 'tickets', 'notes'];
    const tabBtns = tabs
      .map((t) => `<button type="button" class="btn btn-sm ${tab === t ? 'btn-primary' : 'btn-ghost'}" data-action="cl-detail-tab" data-tab="${t}">${t}</button>`)
      .join('');
    let body = '';
    if (tab === 'overview') {
      body = `<div class="kpi-grid">
        <article class="kpi"><span>أنظمة</span><strong>${(c.systems || []).length}</strong></article>
        <article class="kpi"><span>طلبات</span><strong>${(c.orders || []).length}</strong></article>
        <article class="kpi"><span>المحفظة</span><strong>${c.wallet?.total ?? c.walletTotal ?? 0}</strong></article>
        <article class="kpi"><span>تذاكر</span><strong>${(c.tickets || []).length}</strong></article>
      </div>
      <p class="muted">${K.esc(c.company || '—')} · ${K.esc(c.country || '—')} · مصدر: ${K.esc(window.HubI18n?.label?.(c.source) || c.source || '—')}</p>
      <div class="toolbar">
        <button type="button" class="btn btn-sm btn-dark" data-action="cl-status" data-id="${c.id}" data-status="active">تفعيل</button>
        <button type="button" class="btn btn-sm btn-ghost" data-action="cl-status" data-id="${c.id}" data-status="suspended">تعطيل</button>
        <button type="button" class="btn btn-sm btn-primary" data-action="cl-edit" data-id="${c.id}">تعديل</button>
      </div>`;
    } else if (tab === 'systems') {
      body = `<div class="toolbar">
          <input id="cl-sys-code" placeholder="كود النظام" />
          <input id="cl-sys-name" placeholder="الاسم" />
          <button type="button" class="btn btn-primary btn-sm" data-action="cl-assign-sys" data-id="${c.id}">تعيين</button>
        </div>
        <ul class="feed">${(c.systems || []).map((s) => `<li><b>${K.esc(window.HubI18n?.system?.(s.code||s.name)||s.name||s.code)}</b> · ${K.esc(window.HubI18n?.plan?.(s.plan)||s.plan)} · ${K.esc(window.HubI18n?.status?.(s.status)||s.status)}</li>`).join('') || '<li>لا أنظمة</li>'}</ul>`;
    } else if (tab === 'orders') {
      body = `<ul class="feed">${(c.orders || []).map((o) => `<li><b>${K.esc(o.number)}</b> ${K.esc(o.service)} · ${K.esc(o.status)}</li>`).join('') || '<li>لا طلبات</li>'}</ul>`;
    } else if (tab === 'wallet') {
      body = `<p><b>إجمالي:</b> ${c.wallet?.total ?? c.walletTotal ?? 0}</p>
        <ul class="feed">${(c.wallet?.ledger || []).map((l) => `<li>${K.esc(l.note)} · ${K.esc(l.type)} ${l.amount}</li>`).join('') || '<li>لا عمليات</li>'}</ul>`;
    } else if (tab === 'tickets') {
      body = `<ul class="feed">${(c.tickets || []).map((t) => `<li><b>${K.esc(t.subject)}</b> · ${K.esc(t.status)}</li>`).join('') || '<li>لا تذاكر</li>'}</ul>`;
    } else {
      body = `<div class="toolbar">
          <input id="cl-note" placeholder="ملاحظة داخلية (لا يراها العميل)" style="flex:1" />
          <button type="button" class="btn btn-primary btn-sm" data-action="cl-add-note" data-id="${c.id}">إضافة</button>
        </div>
        <ul class="feed">${(c.internalNotes || []).map((n) => `<li><b>${K.esc(n.by)}</b>: ${K.esc(n.note)} <small>${K.fmtTime(n.at)}</small></li>`).join('') || '<li>لا ملاحظات</li>'}</ul>`;
    }
    return `<div class="toolbar" style="flex-wrap:wrap;margin-bottom:10px">${tabBtns}</div>${body}`;
  };

  const renderClients = (ctx = {}) => {
    const { user } = ctx;
    const K = Kit();
    if (!clUi.permissionsLoaded) {
      ensurePermissions(user).then(() => {
        syncClientsFromApi().finally(() => window.hubRerender?.());
      });
    }
    const allowCreate = canCreateClient(user);
    const bag = store().clientsBag?.() || store().get()?.clientsMgmt || { clients: [], auditLog: [], settings: {} };
    const filtered = filterClients(bag.clients || []);
    const pg = K.paginate(filtered, clUi.page, clUi.pageSize);
    clUi.page = pg.page;
    const needs = (bag.clients || [])
      .filter((c) => c.status === 'pending' || c.status === 'suspended' || (c.tickets || []).some((t) => t.status === 'open'))
      .slice(0, 8)
      .map((c) => ({ text: `${c.status === 'pending' ? 'بانتظار التفعيل' : c.status === 'suspended' ? 'موقوف' : 'تذكرة مفتوحة'}: ${c.name}`, tab: 'list', id: c.id }));

    const kpis = [
      { key: 'total', label: 'العملاء', value: (bag.clients || []).length, tab: 'list' },
      { key: 'active', label: 'نشط', value: (bag.clients || []).filter((c) => c.status === 'active').length, tab: 'list' },
      { key: 'pending', label: 'معلّق', value: (bag.clients || []).filter((c) => c.status === 'pending').length, tab: 'list' },
      { key: 'suspended', label: 'موقوف', value: (bag.clients || []).filter((c) => c.status === 'suspended').length, tab: 'list' },
      { key: 'needs', label: 'يتطلب إجراء', value: needs.length, tab: 'list' },
    ];

    const createBtn = allowCreate
      ? `<button type="button" class="btn btn-primary" data-action="cl-create"><i class="fas fa-plus"></i> إضافة عميل جديد</button>`
      : `<button type="button" class="btn btn-ghost" disabled title="ليست لديك صلاحية إنشاء عميل">إضافة عميل جديد</button>`;
    const createBtnSm = allowCreate
      ? `<button type="button" class="btn btn-primary btn-sm" data-action="cl-create"><i class="fas fa-plus"></i> إضافة عميل جديد</button>`
      : `<button type="button" class="btn btn-ghost btn-sm" disabled title="ليست لديك صلاحية إنشاء عميل">إضافة عميل جديد</button>`;

    let body = '';
    if (clUi.tab === 'list') {
      body = `${K.renderNeeds('cl', needs)}
        <article class="card" style="margin-top:12px">
          <div class="toolbar" style="flex-wrap:wrap">
            <div class="field"><label>بحث</label><input data-cl-change="q" value="${K.esc(clUi.filters.q)}" placeholder="اسم / بريد / رقم" /></div>
            <div class="field"><label>الحالة</label>
              <select data-cl-change="status"><option value="">الكل</option>
                ${['active', 'pending', 'suspended'].map((s) => `<option value="${s}" ${clUi.filters.status === s ? 'selected' : ''}>${window.HubI18n?.status?.(s) || s}</option>`).join('')}
              </select>
            </div>
            ${createBtn}
          </div>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>العميل</th><th>الحالة</th><th>أنظمة</th><th>طلبات</th><th>المحفظة</th><th>المصدر</th><th>بواسطة</th><th></th></tr></thead>
            <tbody>${
              pg.rows.length
                ? pg.rows
                    .map(
                      (c) => `<tr>
                        <td><strong>${K.esc(c.name)}</strong><br/><small>${K.esc(c.email)} · ${K.esc(c.clientId || '')}</small></td>
                        <td>${K.badge(window.HubI18n?.status?.(c.status) || c.status, c.status === 'active' ? 'badge-black' : c.status === 'pending' ? 'badge-gray' : 'badge-red')}</td>
                        <td>${c.systemsCount || (c.systems || []).length}</td>
                        <td>${c.openOrders ?? (c.orders || []).length}</td>
                        <td>${Number(c.walletTotal ?? c.wallet?.total ?? 0).toLocaleString('en-US')}</td>
                        <td>${K.sourceBadge(c.source)}</td>
                        <td><small>${K.esc(c.createdByEmployeeId || '—')}</small></td>
                        <td class="toolbar" style="margin:0;gap:4px">
                          <button type="button" class="btn btn-sm btn-primary" data-action="cl-open" data-id="${c.id}">360</button>
                          <button type="button" class="btn btn-sm btn-ghost" data-action="cl-edit" data-id="${c.id}">تعديل</button>
                        </td>
                      </tr>`
                    )
                    .join('')
                : '<tr><td colspan="8" class="empty">لا عملاء — أنشئ عميلاً جديدًا</td></tr>'
            }</tbody>
          </table></div>
          ${K.renderPager('cl', pg.page, pg.pages, pg.total)}
        </article>`;
    } else if (clUi.tab === 'audit') {
      body = `<article class="card">${K.renderAuditTable(bag.auditLog || [])}</article>`;
    } else {
      body = `<article class="card"><p>إدارة العملاء مربوطة بواجهة الإدارة والصلاحية <code>clients.create</code> لإنشاء عملاء حقيقيين في الخادم مع سجل تدقيق.</p></article>`;
    }

    const modal = clUi.modal
      ? K.renderModal('cl', {
          title: clUi.editId ? 'تعديل عميل' : 'إضافة عميل جديد',
          bodyHtml: clientForm(clUi.modal.data || {}),
          footerHtml: `<button type="button" class="btn btn-ghost" data-action="cl-modal-close" ${clUi.saving ? 'disabled' : ''}>إلغاء</button>
            <button type="button" class="btn btn-primary" data-action="cl-save" ${clUi.saving ? 'disabled' : ''}>${clUi.saving ? 'جاري الحفظ…' : 'إنشاء / حفظ'}</button>`,
        })
      : '';
    const drawer = clUi.drawer
      ? K.renderDrawer('cl', { title: clUi.drawer.title, bodyHtml: clUi.drawer.bodyHtml })
      : '';

    return `<div class="hub-ops-ws hub-clients-ws">
      ${K.renderHeader({
        prefix: 'cl',
        title: 'إدارة العملاء',
        subtitle: 'العملاء 360 · أنظمة · طلبات · محفظة · ملاحظات داخلية · تدقيق',
        icon: 'fa-user-tie',
        actionsHtml: `${createBtnSm}
          <button type="button" class="btn btn-ghost btn-sm" data-action="cl-help-open"><i class="fas fa-circle-question"></i></button>`,
      })}
      ${K.renderKpis('cl', kpis, clUi.kpiFocus)}
      ${K.renderTabs('cl', CL_TABS, clUi.tab)}
      ${body}
      ${K.renderHelp('cl', {
        title: 'دليل إدارة العملاء',
        dismissed: !!bag.settings?.helpDismissed,
        open: clUi.helpOpen,
        bodyHtml: `<p>أنشئ عميلاً بصلاحية clients.create، افتح ملف 360، وعيّن نظامًا. كل إنشاء يُسجَّل في التدقيق مع رقم الموظف المنشئ.</p>`,
      })}
      ${modal}${drawer}
    </div>`;
  };

  const handleClients = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const K = Kit();
    const actor = user?.employeeNo || K.actorName(user);
    if (action === 'cl-tab') {
      clUi.tab = btn.dataset.tab || 'list';
      return true;
    }
    if (action === 'cl-kpi') {
      clUi.kpiFocus = ['active', 'pending', 'suspended'].includes(btn.dataset.key) ? btn.dataset.key : '';
      if (btn.dataset.tab) clUi.tab = btn.dataset.tab;
      clUi.page = 1;
      return true;
    }
    if (action === 'cl-page') {
      clUi.page = Number(btn.dataset.page) || 1;
      return true;
    }
    if (action === 'cl-create') {
      if (!canCreateClient(user)) {
        toast?.('ليست لديك صلاحية إنشاء عميل جديد.');
        return true;
      }
      clUi.editId = null;
      clUi.saving = false;
      clUi.idemKey = `cl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      clUi.modal = { data: { status: 'pending', source: 'إدخال يدوي' } };
      return true;
    }
    if (action === 'cl-edit') {
      const row = (store().clientsBag()?.clients || []).find((x) => x.id === btn.dataset.id);
      if (!row) return true;
      clUi.editId = row.id;
      clUi.saving = false;
      clUi.modal = { data: { ...row } };
      return true;
    }
    if (action === 'cl-open') {
      const row = (store().clientsBag()?.clients || []).find((x) => x.id === btn.dataset.id);
      if (!row) return true;
      clUi.detailTab = 'overview';
      clUi.drawer = { title: `${row.name} · ${row.clientId || ''}`, bodyHtml: renderClientDrawer(row), id: row.id };
      return true;
    }
    if (action === 'cl-detail-tab') {
      clUi.detailTab = btn.dataset.tab || 'overview';
      const row = (store().clientsBag()?.clients || []).find((x) => x.id === clUi.drawer?.id);
      if (row) clUi.drawer = { title: `${row.name} · ${row.clientId || ''}`, bodyHtml: renderClientDrawer(row), id: row.id };
      return true;
    }
    if (action === 'cl-modal-close' || action === 'cl-drawer-close') {
      if (clUi.saving) return true;
      if (action === 'cl-modal-close') {
        clUi.modal = null;
        clUi.idemKey = null;
      }
      if (action === 'cl-drawer-close') clUi.drawer = null;
      return true;
    }
    if (action === 'cl-save') {
      if (clUi.saving) return true;
      const payload = {
        id: clUi.editId || undefined,
        name: K.qVal('cl-name'),
        email: K.qVal('cl-email'),
        phone: K.qVal('cl-phone'),
        clientId: K.qVal('cl-clientId'),
        status: K.qVal('cl-status'),
        company: K.qVal('cl-company'),
        country: K.qVal('cl-country'),
        source: K.qVal('cl-source'),
      };
      if (!payload.name || !payload.email) {
        toast?.('الاسم والبريد مطلوبان');
        return true;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        toast?.('صيغة البريد الإلكتروني غير صحيحة.');
        return true;
      }

      // Edit stays local (profile patch); create must go through Backend + clients.create
      if (clUi.editId) {
        store().upsertClient?.(payload, actor);
        clUi.modal = null;
        clUi.editId = null;
        toast?.('تم حفظ العميل');
        return true;
      }

      if (!canCreateClient(user)) {
        toast?.('ليست لديك صلاحية إنشاء عميل جديد.');
        return true;
      }

      clUi.saving = true;
      clUi.modal = { data: { ...payload } };
      const idem = clUi.idemKey || `cl-${Date.now().toString(36)}`;
      (async () => {
        try {
          const res = await fetch('/api/admin/clients', {
            method: 'POST',
            headers: { ...authHeaders(), 'X-Idempotency-Key': idem },
            body: JSON.stringify({
              name: payload.name,
              email: payload.email,
              phone: payload.phone,
              status: payload.status,
              company: payload.company,
              country: payload.country,
              source: payload.source,
              idempotencyKey: idem,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) {
            throw new Error(data.error || 'تعذر إنشاء العميل');
          }
          const c = data.client || {};
          store().upsertClient?.(
            {
              name: c.name || payload.name,
              email: c.email || payload.email,
              clientId: c.clientId,
              status: c.status || payload.status,
              company: c.company || payload.company,
              country: c.country || payload.country,
              phone: c.phone || payload.phone,
              source: payload.source || 'إدخال يدوي',
              createdByEmployeeId: c.createdByEmployeeId || data.createdByEmployeeId || user?.employeeNo || '',
              createdByEmail: c.createdByEmail || user?.email || '',
            },
            actor
          );
          clUi.modal = null;
          clUi.editId = null;
          clUi.idemKey = null;
          toast?.(`تم إنشاء العميل بنجاح. ${c.clientId || ''}`.trim());
          await syncClientsFromApi();
        } catch (err) {
          toast?.(err.message || 'تعذر إنشاء العميل');
        } finally {
          clUi.saving = false;
          window.hubRerender?.();
        }
      })();
      return true;
    }
    if (action === 'cl-status') {
      store().setClientStatus?.(btn.dataset.id, btn.dataset.status, actor);
      toast?.('تحدّثت حالة العميل');
      if (clUi.drawer?.id) {
        const row = (store().clientsBag()?.clients || []).find((x) => x.id === clUi.drawer.id);
        if (row) clUi.drawer.bodyHtml = renderClientDrawer(row);
      }
      return true;
    }
    if (action === 'cl-assign-sys') {
      store().assignClientSystem?.(btn.dataset.id, { code: K.qVal('cl-sys-code'), name: K.qVal('cl-sys-name') }, actor);
      toast?.('تم تعيين النظام');
      const row = (store().clientsBag()?.clients || []).find((x) => x.id === btn.dataset.id);
      if (row && clUi.drawer) {
        clUi.drawer.id = row.id;
        clUi.drawer.bodyHtml = renderClientDrawer(row);
      }
      return true;
    }
    if (action === 'cl-add-note') {
      store().addClientNote?.(btn.dataset.id, K.qVal('cl-note'), actor);
      toast?.('أُضيفت الملاحظة');
      const row = (store().clientsBag()?.clients || []).find((x) => x.id === btn.dataset.id);
      if (row && clUi.drawer) {
        clUi.drawer.id = row.id;
        clUi.drawer.bodyHtml = renderClientDrawer(row);
      }
      return true;
    }
    if (action === 'cl-help-open') {
      clUi.helpOpen = true;
      return true;
    }
    if (action === 'cl-help-dismiss') {
      const bag = store().clientsBag?.();
      if (bag) {
        bag.settings = bag.settings || {};
        bag.settings.helpDismissed = true;
        store().save?.();
      }
      clUi.helpOpen = false;
      return true;
    }
    return false;
  };

  const handleClientsChange = (el) => {
    const key = el.getAttribute('data-cl-change');
    if (!key) return false;
    clUi.filters[key] = el.value;
    clUi.page = 1;
    return true;
  };

  /* ───────── Notifications ───────── */
  const ntUi = { tab: 'inbox', helpOpen: false, filters: { q: '', level: '', unread: '' }, page: 1, pageSize: 15 };
  const NT_TABS = [
    { id: 'inbox', label: 'الصندوق', icon: 'fa-bell' },
    { id: 'audit', label: 'سجل العمليات', icon: 'fa-clock-rotate-left' },
    { id: 'settings', label: 'الإعدادات', icon: 'fa-gear' },
  ];

  const renderNotifications = (ctx = {}) => {
    if (window.HubNotificationsCenter?.render) return window.HubNotificationsCenter.render(ctx);
    return '<div class="empty">تعذر تحميل مركز الإشعارات</div>';
  };

  const handleNotifications = (action, btn, ctx = {}) => {
    if (window.HubNotificationsCenter?.handle) return window.HubNotificationsCenter.handle(action, btn, ctx);
    return false;
  };

  const handleNotificationsChange = (el) => {
    if (window.HubNotificationsCenter?.handleChange) return window.HubNotificationsCenter.handleChange(el);
    return false;
  };

  /* ───────── Side project registrations ───────── */
  const spUi = { tab: 'inbox', helpOpen: false, drawer: null, filters: { status: '', q: '' }, page: 1, pageSize: 10 };
  const SP_TABS = [
    { id: 'inbox', label: 'الطلبات', icon: 'fa-inbox' },
    { id: 'audit', label: 'سجل العمليات', icon: 'fa-clock-rotate-left' },
    { id: 'settings', label: 'الإعدادات', icon: 'fa-gear' },
  ];

  const renderSideProjects = () => {
    const K = Kit();
    const api = window.HubSideProjectRegistrations;
    const list = api?.read?.() || [];
    const counts = api?.counts?.() || { total: list.length, byStatus: {}, newCount: 0 };
    const statuses = api?.STATUSES || ['جديد', 'قيد المتابعة', 'تم التواصل', 'مقبول', 'مرفوض', 'مغلق'];
    const meta = store().get()?.sideProjectsWs || { auditLog: [], settings: {} };
    const filtered = list.filter((r) => {
      if (spUi.filters.status && r.status !== spUi.filters.status) return false;
      if (spUi.filters.q) {
        const hay = `${r.projectName} ${r.ownerName} ${r.email} ${r.phone}`.toLowerCase();
        if (!hay.includes(spUi.filters.q.toLowerCase())) return false;
      }
      return true;
    });
    const pg = K.paginate(filtered, spUi.page, spUi.pageSize);
    spUi.page = pg.page;
    const needs = list
      .filter((r) => r.status === 'جديد' || r.status === 'قيد المتابعة')
      .slice(0, 8)
      .map((r) => ({ text: `${r.status}: ${r.projectName}`, tab: 'inbox', id: r.id }));

    const kpis = [
      { key: 'total', label: 'الكل', value: counts.total || 0, tab: 'inbox' },
      { key: 'new', label: 'جديد', value: counts.byStatus?.['جديد'] || 0, tab: 'inbox' },
      { key: 'follow', label: 'متابعة', value: counts.byStatus?.['قيد المتابعة'] || 0, tab: 'inbox' },
      { key: 'contacted', label: 'تم التواصل', value: counts.byStatus?.['تم التواصل'] || 0, tab: 'inbox' },
      { key: 'needs', label: 'يتطلب إجراء', value: needs.length, tab: 'inbox' },
    ];

    let body = '';
    if (spUi.tab === 'inbox') {
      body = `${K.renderNeeds('sp', needs)}
        <div class="toolbar" style="flex-wrap:wrap;margin-top:10px">
          <a class="btn btn-ghost" href="side-project-registrations.html"><i class="fas fa-inbox"></i> الصندوق الكامل</a>
          <a class="btn btn-ghost" href="side-projects.html" target="_blank"><i class="fas fa-lightbulb"></i> صفحة المشاريع</a>
          <div class="field"><label>بحث</label><input data-sp-change="q" value="${K.esc(spUi.filters.q)}" /></div>
          <div class="field"><label>الحالة</label>
            <select data-sp-change="status"><option value="">الكل</option>
              ${statuses.map((s) => `<option ${spUi.filters.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <article class="card" style="margin-top:10px">
          <div class="table-wrap"><table class="data">
            <thead><tr><th>المشروع</th><th>صاحب المشروع</th><th>التواصل</th><th>الحالة</th><th>التاريخ</th><th></th></tr></thead>
            <tbody>${
              pg.rows.length
                ? pg.rows
                    .map((r) => {
                      const phone = (r.phone || '').replace(/\s+/g, '');
                      const wa = phone ? `https://wa.me/${phone.replace(/[^\d+]/g, '').replace(/^0/, '966')}` : '';
                      return `<tr>
                        <td><strong>${K.esc(r.projectName)}</strong></td>
                        <td>${K.esc(r.ownerName)}</td>
                        <td>${r.phone ? `<a href="tel:${K.esc(phone)}">${K.esc(r.phone)}</a><br/>` : ''}${r.email ? `<a href="mailto:${K.esc(r.email)}">${K.esc(r.email)}</a>` : ''}${wa ? `<br/><a class="btn btn-sm btn-ghost" href="${K.esc(wa)}" target="_blank" rel="noopener">واتساب</a>` : ''}</td>
                        <td>
                          <select data-sp-status="${K.esc(r.id)}">
                            ${statuses.map((s) => `<option value="${K.esc(s)}" ${s === (r.status || 'جديد') ? 'selected' : ''}>${K.esc(s)}</option>`).join('')}
                          </select>
                        </td>
                        <td>${K.fmtTime(r.createdAt)}</td>
                        <td class="toolbar" style="margin:0;gap:4px">
                          <button type="button" class="btn btn-sm btn-primary" data-action="sp-details" data-id="${K.esc(r.id)}">تفاصيل</button>
                          <button type="button" class="btn btn-sm btn-dark" data-action="sp-contacted" data-id="${K.esc(r.id)}">تم التواصل</button>
                        </td>
                      </tr>`;
                    })
                    .join('')
                : '<tr><td colspan="6" class="empty">لا طلبات بعد</td></tr>'
            }</tbody>
          </table></div>
          ${K.renderPager('sp', pg.page, pg.pages, pg.total)}
        </article>`;
    } else if (spUi.tab === 'audit') {
      body = `<article class="card">${K.renderAuditTable(meta.auditLog || [])}</article>`;
    } else {
      body = `<article class="card"><p>الطلبات تُحفظ محليًا عبر HubSideProjectRegistrations وتظهر فور إرسالها من صفحة المشاريع الجانبية.</p></article>`;
    }

    const drawer = spUi.drawer
      ? K.renderDrawer('sp', { title: spUi.drawer.title, bodyHtml: spUi.drawer.bodyHtml })
      : '';

    return `<div class="hub-ops-ws hub-side-projects-ws">
      ${K.renderHeader({
        prefix: 'sp',
        title: 'طلبات تسجيل المشاريع',
        subtitle: 'صندوق الوارد · متابعة · تواصل · تدقيق',
        icon: 'fa-inbox',
        actionsHtml: `<button type="button" class="btn btn-ghost btn-sm" data-action="sp-help-open"><i class="fas fa-circle-question"></i></button>`,
      })}
      ${K.renderKpis('sp', kpis, '')}
      ${K.renderTabs('sp', SP_TABS, spUi.tab)}
      ${body}
      ${K.renderHelp('sp', {
        title: 'دليل طلبات المشاريع',
        dismissed: !!meta.settings?.helpDismissed,
        open: spUi.helpOpen,
        bodyHtml: `<p>حدّث الحالة، سجّل «تم التواصل»، وافتح التفاصيل. كل تغيير يُوثَّق في سجل التدقيق وفي ملاحظات الطلب.</p>`,
      })}
      ${drawer}
    </div>`;
  };

  const handleSideProjects = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const K = Kit();
    const api = window.HubSideProjectRegistrations;
    const meta = () => {
      const s = store().get();
      if (!s.sideProjectsWs) s.sideProjectsWs = { schemaVersion: 2, auditLog: [], settings: {} };
      return s.sideProjectsWs;
    };
    if (action === 'sp-tab') {
      spUi.tab = btn.dataset.tab || 'inbox';
      return true;
    }
    if (action === 'sp-kpi') {
      if (btn.dataset.key === 'new') spUi.filters.status = 'جديد';
      else if (btn.dataset.key === 'follow') spUi.filters.status = 'قيد المتابعة';
      else if (btn.dataset.key === 'contacted') spUi.filters.status = 'تم التواصل';
      else spUi.filters.status = '';
      if (btn.dataset.tab) spUi.tab = btn.dataset.tab;
      return true;
    }
    if (action === 'sp-page') {
      spUi.page = Number(btn.dataset.page) || 1;
      return true;
    }
    if (action === 'sp-details') {
      const rec = api?.get?.(btn.dataset.id);
      if (!rec) {
        toast?.('الطلب غير موجود');
        return true;
      }
      spUi.drawer = {
        title: rec.projectName,
        bodyHtml: api.detailsHtml?.(rec) || `<p>${K.esc(rec.ownerName)}</p>`,
      };
      return true;
    }
    if (action === 'sp-contacted') {
      api?.setStatus?.(btn.dataset.id, 'تم التواصل', 'تم التواصل من غرفة العمليات');
      store().pushDomainAudit?.(meta(), {
        action: 'contacted',
        detail: btn.dataset.id,
        by: K.actorName(user),
        source: 'Side Projects',
        entityId: btn.dataset.id,
      });
      store().save?.();
      toast?.('تم تسجيل التواصل');
      return true;
    }
    if (action === 'sp-drawer-close') {
      spUi.drawer = null;
      return true;
    }
    if (action === 'sp-help-open') {
      spUi.helpOpen = true;
      return true;
    }
    if (action === 'sp-help-dismiss') {
      meta().settings.helpDismissed = true;
      spUi.helpOpen = false;
      store().save?.();
      return true;
    }
    return false;
  };

  const handleSideProjectsChange = (el) => {
    const statusId = el.getAttribute('data-sp-status');
    if (statusId && window.HubSideProjectRegistrations?.setStatus) {
      window.HubSideProjectRegistrations.setStatus(statusId, el.value, `تحديث الحالة إلى ${el.value}`);
      const s = store().get();
      if (!s.sideProjectsWs) s.sideProjectsWs = { schemaVersion: 2, auditLog: [], settings: {} };
      store().pushDomainAudit?.(s.sideProjectsWs, {
        action: 'status',
        detail: `${statusId} → ${el.value}`,
        by: 'مشغّل هوب',
        source: 'Side Projects',
        entityId: statusId,
      });
      store().save?.();
      return true;
    }
    const key = el.getAttribute('data-sp-change');
    if (!key) return false;
    spUi.filters[key] = el.value;
    spUi.page = 1;
    return true;
  };

  /* ───────── إدارة فريق العمل والصلاحيات ───────── */
  const rlUi = { helpOpen: false };

  const renderRoles = (ctx = {}) => {
    if (window.HubTeamOpsUI && window.HubTeamOpsUI.render) {
      return '<div class="hub-ops-ws hub-roles-ws hub-team-ops-ws">' + window.HubTeamOpsUI.render(ctx) + '</div>';
    }
    if (window.HubAccessGovUI && window.HubAccessGovUI.render) {
      return '<div class="hub-ops-ws hub-roles-ws hub-access-gov-ws">' + window.HubAccessGovUI.render(ctx) + '</div>';
    }
    return '<div class="empty">تعذّر تحميل إدارة فريق العمل والصلاحيات</div>';
  };

  const handleRoles = (action, btn, ctx = {}) => {
    const a = String(action || '');
    if (a.startsWith('hto-') && window.HubTeamOpsUI?.handle) {
      return window.HubTeamOpsUI.handle(action, btn, ctx);
    }
    if (a.startsWith('ag-') && window.HubAccessGovUI?.handle) {
      return window.HubAccessGovUI.handle(action, btn, ctx);
    }
    return false;
  };

  /* ───────── Rent / Super-admin approval ───────── */
  const rnUi = { tab: 'pending', helpOpen: false };
  const RN_TABS = [
    { id: 'pending', label: 'بانتظار الاعتماد', icon: 'fa-hourglass' },
    { id: 'all', label: 'كل الطلبات', icon: 'fa-list' },
    { id: 'audit', label: 'سجل العمليات', icon: 'fa-clock-rotate-left' },
  ];

  const renderRentAdmin = () => {
    const K = Kit();
    const grants = window.HubPlatformGrants?.listGrants?.() || [];
    const meta = store().get()?.rentAdminWs || { auditLog: [], settings: {} };
    const pending = grants.filter((g) => g.status === 'pending');
    const needs = pending.slice(0, 10).map((g) => ({
      text: `طلب اعتماد: ${g.adminName || g.companyName || g.host}`,
      tab: 'pending',
      id: g.id,
    }));
    const kpis = [
      { key: 'pending', label: 'بانتظار', value: pending.length, tab: 'pending' },
      { key: 'active', label: 'مفعّل', value: grants.filter((g) => g.status === 'active').length, tab: 'all' },
      { key: 'rejected', label: 'مرفوض', value: grants.filter((g) => g.status === 'rejected').length, tab: 'all' },
      { key: 'needs', label: 'يتطلب إجراء', value: needs.length, tab: 'pending' },
    ];
    const statusAr = { pending: 'بانتظار', provisioning: 'تجهيز', active: 'مفعّل', rejected: 'مرفوض' };
    const rows = rnUi.tab === 'pending' ? pending : grants;

    let body = '';
    if (rnUi.tab === 'audit') {
      body = `<article class="card">${K.renderAuditTable(meta.auditLog || [])}</article>`;
    } else {
      body = `${rnUi.tab === 'pending' ? K.renderNeeds('rn', needs) : ''}
        <div class="toolbar" style="margin-top:10px">
          <a class="btn btn-ghost" href="rent-admin.html" target="_blank"><i class="fas fa-up-right-from-square"></i> الصفحة الكاملة</a>
          <a class="btn btn-ghost" href="register.html" target="_blank"><i class="fas fa-user-plus"></i> سجل معنا</a>
          <button type="button" class="btn btn-dark" data-action="rn-refresh"><i class="fas fa-rotate"></i> تحديث</button>
        </div>
        <article class="card" style="margin-top:10px">
          ${
            rows.length
              ? rows
                  .map(
                    (g) => `<div style="border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px">
                      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
                        <b>${K.esc(g.adminName || g.companyName || 'طلب')}</b>
                        ${K.badge(statusAr[g.status] || g.status, g.status === 'active' ? 'badge-black' : g.status === 'pending' ? 'badge-red' : 'badge-outline')}
                      </div>
                      <p class="muted" style="margin:6px 0">الفرع: ${K.esc(g.branchLabel || g.branch || '—')} · الحاضنة: ${K.esc(g.incubatorLabel || g.incubator || '—')}</p>
                      <p class="muted">المنصة: ${K.esc(g.platformLabel || g.platform || '—')} · النظام: ${K.esc(g.requestedSystemLabel || g.requestedSystem || '—')}</p>
                      <p class="muted">${K.esc(g.adminEmail || '')} · <span dir="ltr">${K.esc(g.host || '')}</span></p>
                      <div class="toolbar" style="margin-top:8px">
                        ${
                          g.status === 'pending'
                            ? `<button type="button" class="btn btn-primary btn-sm" data-action="rn-approve" data-id="${K.esc(g.id)}"><i class="fas fa-check"></i> اعتماد</button>
                               <button type="button" class="btn btn-dark btn-sm" data-action="rn-reject" data-id="${K.esc(g.id)}"><i class="fas fa-xmark"></i> رفض</button>`
                            : g.status === 'active'
                              ? `<a class="btn btn-ghost btn-sm" href="dashboard.html#roles-permissions">إدارة فريق العمل والصلاحيات</a>`
                              : ''
                        }
                      </div>
                    </div>`
                  )
                  .join('')
              : '<div class="empty">لا طلبات — صاحب المنصة يرسل من «سجل معنا».</div>'
          }
        </article>`;
    }

    return `<div class="hub-ops-ws hub-rent-ws">
      ${K.renderHeader({
        prefix: 'rn',
        title: 'موافقات المدير الأعلى',
        subtitle: 'مراجعة واعتماد العمليات الحساسة قبل التنفيذ',
        icon: 'fa-user-shield',
        actionsHtml: `<button type="button" class="btn btn-ghost btn-sm" data-action="rn-help-open"><i class="fas fa-circle-question"></i></button>`,
      })}
      ${K.renderKpis('rn', kpis, '')}
      ${K.renderTabs('rn', RN_TABS, rnUi.tab)}
      ${body}
      ${K.renderHelp('rn', {
        title: 'دليل موافقات المدير الأعلى',
        dismissed: !!meta.settings?.helpDismissed,
        open: rnUi.helpOpen,
        bodyHtml: `<p>اعتمد أو ارفض الطلبات الحساسة هنا. إدارة الأدوار نفسها تتم من «إدارة فريق العمل والصلاحيات».</p>`,
      })}
    </div>`;
  };

  const handleRentAdmin = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const K = Kit();
    const meta = () => {
      const s = store().get();
      if (!s.rentAdminWs) s.rentAdminWs = { schemaVersion: 2, auditLog: [], settings: {} };
      return s.rentAdminWs;
    };
    if (action === 'rn-tab') {
      rnUi.tab = btn.dataset.tab || 'pending';
      return true;
    }
    if (action === 'rn-kpi') {
      if (btn.dataset.tab) rnUi.tab = btn.dataset.tab;
      return true;
    }
    if (action === 'rn-refresh') {
      window.HubPlatformGrants?.hydrate?.();
      toast?.('جاري التحديث');
      return true;
    }
    if (action === 'rn-approve') {
      const res = window.HubPlatformGrants?.approveGrant?.(btn.dataset.id);
      if (!res?.ok) {
        toast?.(res?.error || 'فشل الاعتماد — تأكد من تحميل وحدة المنح');
        return true;
      }
      const g = res.grant;
      if (g?.adminEmail && (g.requestedSystem || g.platform)) {
        store().grantSubscription?.({
          email: g.adminEmail,
          systemCode: g.requestedSystem || g.platform,
          plan: 'standard',
          permissions: ['read', 'write'],
        });
      }
      store().pushDomainAudit?.(meta(), {
        action: 'approve',
        detail: g?.adminEmail || btn.dataset.id,
        by: K.actorName(user),
        source: 'Rent Admin',
        entityId: btn.dataset.id,
      });
      store().save?.();
      toast?.('تم الاعتماد ومنح النظام');
      return true;
    }
    if (action === 'rn-reject') {
      const res = window.HubPlatformGrants?.rejectGrant?.(btn.dataset.id);
      if (!res?.ok) {
        toast?.(res?.error || 'فشل الرفض');
        return true;
      }
      store().pushDomainAudit?.(meta(), {
        action: 'reject',
        detail: btn.dataset.id,
        by: K.actorName(user),
        source: 'Rent Admin',
        entityId: btn.dataset.id,
      });
      store().save?.();
      toast?.('رُفض الطلب');
      return true;
    }
    if (action === 'rn-help-open') {
      rnUi.helpOpen = true;
      return true;
    }
    if (action === 'rn-help-dismiss') {
      meta().settings.helpDismissed = true;
      rnUi.helpOpen = false;
      store().save?.();
      return true;
    }
    return false;
  };

  /* ───────── Posha clients (wrap existing ops center) ───────── */
  const psUi = { tab: 'ops', helpOpen: false, openInnerTab: '' };

  const renderPoshaNeeds = (needs) => {
    const esc = Kit().esc;
    if (!needs.length) {
      return `<section class="posha-ws-section posha-ws-needs is-clear">
        <div class="posha-ws-section-head">
          <h3><i class="fas fa-circle-check"></i> يحتاج إلى إجراء</h3>
          <span class="posha-ws-pill is-ok">واضح</span>
        </div>
        <p class="posha-ws-empty">لا عناصر تحتاج إجراء الآن.</p>
      </section>`;
    }
    return `<section class="posha-ws-section posha-ws-needs is-alert">
      <div class="posha-ws-section-head">
        <h3><i class="fas fa-bolt"></i> يحتاج إلى إجراء <span class="posha-ws-count">${needs.length}</span></h3>
        <span class="posha-ws-pill is-alert">يتطلب تدخل</span>
      </div>
      <ul class="posha-ws-needs-list">
        ${needs
          .slice(0, 10)
          .map(
            (it) => `<li>
              <div class="posha-ws-need-main">
                <strong>${esc(it.text)}</strong>
                <div class="posha-ws-need-meta">
                  <span>${esc(it.kind || 'تنبيه')}</span>
                  <span>${esc(it.client || '—')}</span>
                  <span>${esc(it.priority || 'عادي')}</span>
                  <span>${esc(it.when || 'الآن')}</span>
                </div>
              </div>
              <button type="button" class="btn btn-sm btn-primary" data-action="ps-need" data-inner="${esc(it.inner || 'overview')}" data-tab="ops">معالجة</button>
            </li>`
          )
          .join('')}
      </ul>
    </section>`;
  };

  const renderPosha = () => {
    const K = Kit();
    const esc = K.esc;
    const meta = store().get()?.poshaClientsWs || { auditLog: [], settings: {} };
    const clients = store().clientsBag?.()?.clients || [];
    const poshaish = clients.filter((c) => (c.systems || []).some((s) => String(s.code || '').toUpperCase() === 'POSHA') || c.source === 'POSHA');
    const activeN = poshaish.filter((c) => c.status === 'active').length;
    const inactiveN = poshaish.filter((c) => c.status !== 'active').length;
    const reqK = window.HubCustomerRequests?.kpis?.() || { neu: 0, open: 0, pendingReview: 0, needsAction: 0 };
    const pendingReqs = reqK.needsAction || reqK.pendingReview || reqK.neu || 0;
    const live = window.HubPoshaClients?.state || {};
    const summary = live.summary || {};
    const openTickets = summary.openTickets || (live.tickets || []).length || 0;
    const openIssues = summary.openIssues || (live.issues || []).length || 0;
    const paymentIssues = summary.paymentIssues || 0;

    const needs = [
      ...poshaish
        .filter((c) => c.status !== 'active')
        .map((c) => ({
          text: `عميل هوب يحتاج متابعة: ${c.name}`,
          kind: 'عميل',
          client: c.name,
          priority: 'عالية',
          when: 'متابعة',
          inner: 'clients',
        })),
      ...(pendingReqs
        ? [
            {
              text: `${pendingReqs} طلبات عملاء تحتاج إجراء في الصندوق الموحد`,
              kind: 'طلب',
              client: 'صندوق الطلبات',
              priority: 'عالية',
              when: 'مراجعة',
              inner: 'orders',
            },
          ]
        : []),
    ];
    if (!window.HubPoshaClients) {
      needs.push({
        text: 'وحدة عملاء هوب غير محمّلة',
        kind: 'نظام',
        client: '—',
        priority: 'حرج',
        when: 'الآن',
        inner: 'overview',
      });
    }

    const kpisRow1 = [
      { label: 'إجمالي العملاء', value: poshaish.length || summary.totalClients || 0, inner: 'clients' },
      { label: 'العملاء النشطون', value: activeN || summary.activeClients || 0, inner: 'clients' },
      { label: 'العملاء غير النشطين', value: inactiveN, inner: 'clients' },
      { label: 'طلبات جديدة', value: reqK.neu || 0, inner: 'orders' },
    ];
    const kpisRow2 = [
      { label: 'يحتاج إلى إجراء', value: needs.length, inner: 'orders' },
      { label: 'تذاكر مفتوحة', value: openTickets, inner: 'support' },
      { label: 'فواتير تحتاج مراجعة', value: paymentIssues, inner: 'overview' },
      { label: 'مشاكل تحتاج تدخل', value: openIssues, inner: 'issues' },
    ];

    let body = '';
    if (psUi.tab === 'ops') {
      body = `<div id="posha-mount" class="posha-ws-mount"></div>`;
    } else if (psUi.tab === 'audit') {
      body = `<section class="posha-ws-section"><div class="posha-ws-section-head"><h3>سجل العمليات</h3></div>${K.renderAuditTable(meta.auditLog || [])}</section>`;
    } else {
      body = `<section class="posha-ws-section">
        <div class="posha-ws-section-head"><h3>الإعدادات</h3></div>
        <p>مركز عمليات عملاء هوب يعمل داخل المنصة. سجّل أي تدخل يدوي في سجل العمليات عند الحاجة.</p>
        <div class="posha-ws-actions">
          <button type="button" class="btn btn-primary" data-action="ps-audit-note">تسجيل مراجعة يدوية</button>
          <button type="button" class="btn btn-ghost" data-action="ps-open-inner" data-inner="req-settings" data-tab="ops">إعدادات الطلبات</button>
        </div>
      </section>`;
    }

    return `<div class="hub-ops-ws hub-posha-ws hub-posha-ws--v2">
      <header class="posha-ws-header">
        <div class="posha-ws-header-text">
          <p class="posha-ws-kicker"><i class="fas fa-building-user"></i> NAIOSH HUB</p>
          <h1 class="posha-ws-title">عملاء هوب</h1>
          <p class="posha-ws-sub">إدارة العملاء والطلبات والدعم والتنبيهات من مكان واحد</p>
        </div>
        <div class="posha-ws-header-actions">
          <button type="button" class="btn btn-primary btn-sm" data-action="ps-refresh"><i class="fas fa-rotate"></i> تحديث</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="ps-tab" data-tab="settings"><i class="fas fa-gear"></i> الإعدادات</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="ps-tab" data-tab="audit"><i class="fas fa-clock-rotate-left"></i> سجل العمليات</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="ps-help-open" title="دليل"><i class="fas fa-circle-question"></i></button>
        </div>
      </header>

      <section class="posha-ws-section">
        <div class="posha-ws-section-head">
          <h3>ملخص العملاء</h3>
          ${psUi.tab !== 'ops' ? `<button type="button" class="btn btn-ghost btn-sm" data-action="ps-tab" data-tab="ops">العودة للعمليات</button>` : ''}
        </div>
        <div class="posha-ws-kpi-grid">
          ${[...kpisRow1, ...kpisRow2]
            .map(
              (k) => `<button type="button" class="posha-ws-kpi" data-action="ps-open-inner" data-inner="${esc(k.inner)}" data-tab="ops">
                <span>${esc(k.label)}</span><strong>${esc(String(k.value))}</strong>
              </button>`
            )
            .join('')}
        </div>
      </section>

      ${psUi.tab === 'ops' ? renderPoshaNeeds(needs) : ''}
      ${body}
      ${K.renderHelp('ps', {
        title: 'دليل عملاء هوب',
        dismissed: !!meta.settings?.helpDismissed,
        open: psUi.helpOpen,
        bodyHtml: `<p>استخدم التبويبات للتنقل بين العملاء والطلبات والدعم. «يحتاج إلى إجراء» يجمع ما يستحق تدخلك أولاً.</p>`,
      })}
    </div>`;
  };

  const handlePosha = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const K = Kit();
    const meta = () => {
      const s = store().get();
      if (!s.poshaClientsWs) s.poshaClientsWs = { schemaVersion: 2, auditLog: [], settings: {} };
      return s.poshaClientsWs;
    };
    if (action === 'ps-tab') {
      psUi.tab = btn.dataset.tab || 'ops';
      return true;
    }
    if (action === 'ps-kpi' || action === 'ps-open-inner' || action === 'ps-need') {
      psUi.tab = 'ops';
      const inner = btn.dataset.inner || 'overview';
      psUi.openInnerTab = inner;
      if (window.HubPoshaClients?.state) {
        window.HubPoshaClients.state.tab = inner;
        if (inner === 'orders') window.HubPoshaClients.state.reqView = 'active';
        if (inner === 'approved') {
          window.HubPoshaClients.state.tab = 'approved';
          window.HubPoshaClients.state.reqView = 'approved';
        }
      }
      return true;
    }
    if (action === 'ps-refresh') {
      psUi.tab = 'ops';
      window.HubPoshaClients?.refresh?.();
      toast?.('تم التحديث');
      return true;
    }
    if (action === 'ps-audit-note') {
      store().pushDomainAudit?.(meta(), {
        action: 'manual_review',
        detail: 'مراجعة يدوية لمركز عملاء هوب',
        by: K.actorName(user),
        source: 'POSHA Ops',
      });
      store().save?.();
      toast?.('سُجّلت المراجعة');
      psUi.tab = 'audit';
      return true;
    }
    if (action === 'ps-help-open') {
      psUi.helpOpen = true;
      return true;
    }
    if (action === 'ps-help-dismiss') {
      meta().settings.helpDismissed = true;
      psUi.helpOpen = false;
      store().save?.();
      return true;
    }
    return false;
  };

  window.HubClientsWS = { render: renderClients, handle: handleClients, handleChange: handleClientsChange, ui: clUi };
  window.HubNotificationsWS = {
    render: renderNotifications,
    handle: handleNotifications,
    handleChange: handleNotificationsChange,
    ui: ntUi,
  };
  window.HubSideProjectsWS = {
    render: renderSideProjects,
    handle: handleSideProjects,
    handleChange: handleSideProjectsChange,
    ui: spUi,
  };
  window.HubRolesWS = { render: renderRoles, handle: handleRoles, ui: rlUi };
  window.HubRentAdminWS = { render: renderRentAdmin, handle: handleRentAdmin, ui: rnUi };
  window.HubPoshaWS = { render: renderPosha, handle: handlePosha, ui: psUi };
})();
