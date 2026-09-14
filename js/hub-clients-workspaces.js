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
    return `
      <div class="grid-2">
        <div class="field"><label>الاسم *</label><input id="cl-name" value="${K.esc(item.name || '')}" /></div>
        <div class="field"><label>البريد *</label><input id="cl-email" type="email" value="${K.esc(item.email || '')}" /></div>
        <div class="field"><label>رقم العميل</label><input id="cl-clientId" value="${K.esc(item.clientId || '')}" /></div>
        <div class="field"><label>الحالة</label>
          <select id="cl-status">${['active', 'pending', 'suspended'].map((s) => `<option value="${s}" ${item.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        </div>
        <div class="field"><label>الشركة</label><input id="cl-company" value="${K.esc(item.company || '')}" /></div>
        <div class="field"><label>الدولة</label><input id="cl-country" value="${K.esc(item.country || '')}" /></div>
        <div class="field"><label>المصدر</label>
          <select id="cl-source">${['إدخال يدوي', 'System Generated', 'Integration', 'POSHA', 'Register'].map((s) => `<option ${ (item.source || 'إدخال يدوي') === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        </div>
      </div>`;
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
      <p class="muted">${K.esc(c.company || '—')} · ${K.esc(c.country || '—')} · مصدر: ${K.esc(c.source || '—')}</p>
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
        <ul class="feed">${(c.systems || []).map((s) => `<li><b>${K.esc(s.name || s.code)}</b> · ${K.esc(s.plan)} · ${K.esc(s.status)}</li>`).join('') || '<li>لا أنظمة</li>'}</ul>`;
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
    const K = Kit();
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
      { key: 'needs', label: 'Needs Action', value: needs.length, tab: 'list' },
    ];

    let body = '';
    if (clUi.tab === 'list') {
      body = `${K.renderNeeds('cl', needs)}
        <article class="card" style="margin-top:12px">
          <div class="toolbar" style="flex-wrap:wrap">
            <div class="field"><label>بحث</label><input data-cl-change="q" value="${K.esc(clUi.filters.q)}" placeholder="اسم / بريد / رقم" /></div>
            <div class="field"><label>الحالة</label>
              <select data-cl-change="status"><option value="">الكل</option>
                ${['active', 'pending', 'suspended'].map((s) => `<option value="${s}" ${clUi.filters.status === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <button type="button" class="btn btn-primary" data-action="cl-create"><i class="fas fa-plus"></i> عميل جديد</button>
          </div>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>العميل</th><th>الحالة</th><th>أنظمة</th><th>طلبات</th><th>المحفظة</th><th>المصدر</th><th></th></tr></thead>
            <tbody>${
              pg.rows.length
                ? pg.rows
                    .map(
                      (c) => `<tr>
                        <td><strong>${K.esc(c.name)}</strong><br/><small>${K.esc(c.email)} · ${K.esc(c.clientId || '')}</small></td>
                        <td>${K.badge(c.status, c.status === 'active' ? 'badge-black' : c.status === 'pending' ? 'badge-gray' : 'badge-red')}</td>
                        <td>${c.systemsCount || (c.systems || []).length}</td>
                        <td>${c.openOrders ?? (c.orders || []).length}</td>
                        <td>${Number(c.walletTotal ?? c.wallet?.total ?? 0).toLocaleString('en-US')}</td>
                        <td>${K.sourceBadge(c.source)}</td>
                        <td class="toolbar" style="margin:0;gap:4px">
                          <button type="button" class="btn btn-sm btn-primary" data-action="cl-open" data-id="${c.id}">360</button>
                          <button type="button" class="btn btn-sm btn-ghost" data-action="cl-edit" data-id="${c.id}">تعديل</button>
                        </td>
                      </tr>`
                    )
                    .join('')
                : '<tr><td colspan="7" class="empty">لا عملاء — أنشئ عميلاً جديدًا</td></tr>'
            }</tbody>
          </table></div>
          ${K.renderPager('cl', pg.page, pg.pages, pg.total)}
        </article>`;
    } else if (clUi.tab === 'audit') {
      body = `<article class="card">${K.renderAuditTable(bag.auditLog || [])}</article>`;
    } else {
      body = `<article class="card"><p>إدارة العملاء تعمل محليًا في هوب مع مصدر وتدقيق. يمكن مزامنة API لاحقًا دون كسر الواجهة.</p></article>`;
    }

    const modal = clUi.modal
      ? K.renderModal('cl', {
          title: clUi.editId ? 'تعديل عميل' : 'عميل جديد',
          bodyHtml: clientForm(clUi.modal.data || {}),
          footerHtml: `<button type="button" class="btn btn-ghost" data-action="cl-modal-close">إلغاء</button>
            <button type="button" class="btn btn-primary" data-action="cl-save">حفظ</button>`,
        })
      : '';
    const drawer = clUi.drawer
      ? K.renderDrawer('cl', { title: clUi.drawer.title, bodyHtml: clUi.drawer.bodyHtml })
      : '';

    return `<div class="hub-ops-ws hub-clients-ws">
      ${K.renderHeader({
        prefix: 'cl',
        title: 'إدارة العملاء',
        subtitle: 'Clients 360 · أنظمة · طلبات · محفظة · ملاحظات داخلية · تدقيق',
        icon: 'fa-user-tie',
        actionsHtml: `<button type="button" class="btn btn-primary btn-sm" data-action="cl-create"><i class="fas fa-plus"></i> جديد</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="cl-help-open"><i class="fas fa-circle-question"></i></button>`,
      })}
      ${K.renderKpis('cl', kpis, clUi.kpiFocus)}
      ${K.renderTabs('cl', CL_TABS, clUi.tab)}
      ${body}
      ${K.renderHelp('cl', {
        title: 'دليل إدارة العملاء',
        dismissed: !!bag.settings?.helpDismissed,
        open: clUi.helpOpen,
        bodyHtml: `<p>أنشئ عميلاً، افتح ملف 360، عيّن نظامًا، وأضف ملاحظات داخلية. كل إجراء يُسجَّل في Audit مع المصدر.</p>`,
      })}
      ${modal}${drawer}
    </div>`;
  };

  const handleClients = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const K = Kit();
    const actor = K.actorName(user);
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
      clUi.editId = null;
      clUi.modal = { data: { status: 'pending', source: 'إدخال يدوي' } };
      return true;
    }
    if (action === 'cl-edit') {
      const row = (store().clientsBag()?.clients || []).find((x) => x.id === btn.dataset.id);
      if (!row) return true;
      clUi.editId = row.id;
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
      if (action === 'cl-modal-close') clUi.modal = null;
      if (action === 'cl-drawer-close') clUi.drawer = null;
      return true;
    }
    if (action === 'cl-save') {
      const payload = {
        id: clUi.editId || undefined,
        name: K.qVal('cl-name'),
        email: K.qVal('cl-email'),
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
      store().upsertClient?.(payload, actor);
      clUi.modal = null;
      clUi.editId = null;
      toast?.('تم حفظ العميل');
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

  const renderNotifications = () => {
    const K = Kit();
    const notes = store().listNotifications?.() || [];
    const meta = store().get()?.notificationsWs || { auditLog: [], settings: {} };
    const unread = notes.filter((n) => !n.read);
    const filtered = notes.filter((n) => {
      if (ntUi.filters.unread === '1' && n.read) return false;
      if (ntUi.filters.level && n.level !== ntUi.filters.level) return false;
      if (ntUi.filters.q) {
        const hay = `${n.title} ${n.body} ${n.sourceName} ${n.source}`.toLowerCase();
        if (!hay.includes(ntUi.filters.q.toLowerCase())) return false;
      }
      return true;
    });
    const pg = K.paginate(filtered, ntUi.page, ntUi.pageSize);
    ntUi.page = pg.page;
    const needs = unread.slice(0, 8).map((n) => ({ text: n.title, tab: 'inbox', id: n.id }));
    const kpis = [
      { key: 'all', label: 'الكل', value: notes.length, tab: 'inbox' },
      { key: 'unread', label: 'غير مقروء', value: unread.length, tab: 'inbox' },
      { key: 'sources', label: 'مصادر', value: new Set(notes.map((n) => n.source)).size, tab: 'inbox' },
      { key: 'needs', label: 'Needs Action', value: needs.length, tab: 'inbox' },
    ];

    let body = '';
    if (ntUi.tab === 'inbox') {
      body = `${K.renderNeeds('nt', needs)}
        <div class="toolbar" style="flex-wrap:wrap;margin-top:10px">
          <button type="button" class="btn btn-primary" data-action="nt-mark-all"><i class="fas fa-check-double"></i> تعليم الكل مقروء</button>
          <button type="button" class="btn btn-dark" data-action="nt-demo"><i class="fas fa-plus"></i> إشعار جديد</button>
          <div class="field"><label>بحث</label><input data-nt-change="q" value="${K.esc(ntUi.filters.q)}" /></div>
          <div class="field"><label>غير مقروء فقط</label>
            <select data-nt-change="unread"><option value="">الكل</option><option value="1" ${ntUi.filters.unread === '1' ? 'selected' : ''}>نعم</option></select>
          </div>
        </div>
        <article class="card" style="margin-top:10px">
          <div class="table-wrap"><table class="data">
            <thead><tr><th>المصدر</th><th>العنوان</th><th>التفاصيل</th><th>النوع</th><th>الوقت</th><th>الحالة</th><th></th></tr></thead>
            <tbody>${
              pg.rows.length
                ? pg.rows
                    .map(
                      (n) => `<tr>
                        <td><strong>${K.esc(n.sourceName || n.source)}</strong><br/><small>${K.esc(n.source)}</small></td>
                        <td>${K.esc(n.title)}</td>
                        <td>${K.esc(n.body || '—')}</td>
                        <td>${K.esc(n.level)} · ${K.esc(n.category)}</td>
                        <td>${K.fmtTime(n.at)}</td>
                        <td>${n.read ? K.badge('مقروء', 'badge-black') : K.badge('جديد', 'badge-red')}</td>
                        <td class="toolbar" style="margin:0;gap:4px">
                          ${n.read ? '' : `<button type="button" class="btn btn-sm btn-dark" data-action="nt-read" data-id="${n.id}">مقروء</button>`}
                          ${n.link ? `<a class="btn btn-sm btn-ghost" href="${K.esc(n.link)}">فتح</a>` : ''}
                          <button type="button" class="btn btn-sm btn-ghost" data-action="nt-delete" data-id="${n.id}">حذف</button>
                        </td>
                      </tr>`
                    )
                    .join('')
                : '<tr><td colspan="7" class="empty">لا إشعارات مطابقة</td></tr>'
            }</tbody>
          </table></div>
          ${K.renderPager('nt', pg.page, pg.pages, pg.total)}
        </article>`;
    } else if (ntUi.tab === 'audit') {
      body = `<article class="card">${K.renderAuditTable(meta.auditLog || [])}</article>`;
    } else {
      body = `<article class="card"><p>إشعارات هوب موحّدة من كل الأنظمة. إعدادات الإشعارات العامة من «إعدادات داخلية».</p></article>`;
    }

    return `<div class="hub-ops-ws hub-notifications-ws">
      ${K.renderHeader({
        prefix: 'nt',
        title: 'مركز إشعارات هوب',
        subtitle: 'صندوق موحّد · مصدر · مقروء/غير مقروء · تدقيق',
        icon: 'fa-bell',
        actionsHtml: `<button type="button" class="btn btn-ghost btn-sm" data-action="nt-help-open"><i class="fas fa-circle-question"></i></button>`,
      })}
      ${K.renderKpis('nt', kpis, '')}
      ${K.renderTabs('nt', NT_TABS, ntUi.tab)}
      ${body}
      ${K.renderHelp('nt', {
        title: 'دليل الإشعارات',
        dismissed: !!meta.settings?.helpDismissed,
        open: ntUi.helpOpen,
        bodyHtml: `<p>كل تنبيه من الأنظمة يصل هنا مع المصدر. علّم كمقروء أو احذف مع بقاء الأثر في سجل العمليات.</p>`,
      })}
    </div>`;
  };

  const handleNotifications = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const K = Kit();
    if (action === 'nt-tab') {
      ntUi.tab = btn.dataset.tab || 'inbox';
      return true;
    }
    if (action === 'nt-kpi') {
      if (btn.dataset.key === 'unread') ntUi.filters.unread = '1';
      else ntUi.filters.unread = '';
      if (btn.dataset.tab) ntUi.tab = btn.dataset.tab;
      return true;
    }
    if (action === 'nt-page') {
      ntUi.page = Number(btn.dataset.page) || 1;
      return true;
    }
    if (action === 'nt-mark-all') {
      store().markAllNotificationsRead?.();
      const meta = store().get().notificationsWs || (store().get().notificationsWs = { schemaVersion: 2, auditLog: [], settings: {} });
      store().pushDomainAudit?.(meta, { action: 'mark_all', detail: 'تعليم الكل كمقروء', by: K.actorName(user), source: 'Notifications' });
      store().save?.();
      toast?.('تم تعليم الكل كمقروء');
      return true;
    }
    if (action === 'nt-read') {
      store().markNotificationRead?.(btn.dataset.id);
      toast?.('مقروء');
      return true;
    }
    if (action === 'nt-delete') {
      store().removeNotification?.(btn.dataset.id, K.actorName(user));
      toast?.('حُذف الإشعار');
      return true;
    }
    if (action === 'nt-demo') {
      store().createHubNotification?.(
        {
          title: 'إشعار من غرفة العمليات',
          body: 'تأكيد أن مركز الإشعارات يستقبل تنبيهات كل الأنظمة.',
          level: 'info',
          category: 'system',
          link: 'dashboard.html#notifications',
        },
        K.actorName(user)
      );
      toast?.('أُضيف إشعار');
      return true;
    }
    if (action === 'nt-help-open') {
      ntUi.helpOpen = true;
      return true;
    }
    if (action === 'nt-help-dismiss') {
      const meta = store().get().notificationsWs;
      if (meta) {
        meta.settings = meta.settings || {};
        meta.settings.helpDismissed = true;
        store().save?.();
      }
      ntUi.helpOpen = false;
      return true;
    }
    return false;
  };

  const handleNotificationsChange = (el) => {
    const key = el.getAttribute('data-nt-change');
    if (!key) return false;
    ntUi.filters[key] = el.value;
    ntUi.page = 1;
    return true;
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
      { key: 'needs', label: 'Needs Action', value: needs.length, tab: 'inbox' },
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
        subtitle: 'Inbox · متابعة · تواصل · تدقيق',
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
        bodyHtml: `<p>حدّث الحالة، سجّل «تم التواصل»، وافتح التفاصيل. كل تغيير يُوثَّق في Audit وفي ملاحظات الطلب.</p>`,
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

  /* ───────── Roles ───────── */
  const rlUi = { tab: 'roles', helpOpen: false, modal: null, editId: null, assignOpen: false };
  const RL_TABS = [
    { id: 'roles', label: 'الأدوار', icon: 'fa-shield-alt' },
    { id: 'matrix', label: 'المصفوفة', icon: 'fa-table' },
    { id: 'users', label: 'التعيينات', icon: 'fa-users' },
    { id: 'audit', label: 'سجل العمليات', icon: 'fa-clock-rotate-left' },
  ];

  const renderRoles = () => {
    const K = Kit();
    const bag = store().rolesBag?.() || { roles: [], assignments: [], auditLog: [], settings: {} };
    const roles = bag.roles || [];
    const assignments = bag.assignments || [];
    const needs = roles.filter((r) => r.status !== 'active').map((r) => ({ text: `دور غير نشط: ${r.nameAr}`, tab: 'roles', id: r.id }));
    if (!assignments.length) needs.push({ text: 'لا تعيينات مستخدمين بعد', tab: 'users' });

    const kpis = [
      { key: 'roles', label: 'الأدوار', value: roles.length, tab: 'roles' },
      { key: 'assign', label: 'التعيينات', value: assignments.length, tab: 'users' },
      { key: 'admin', label: 'أدوار إدارية', value: roles.filter((r) => r.level === 'admin').length, tab: 'roles' },
      { key: 'needs', label: 'Needs Action', value: needs.length, tab: 'roles' },
    ];

    let body = '';
    if (rlUi.tab === 'roles') {
      body = `${K.renderNeeds('rl', needs)}
        <div class="toolbar" style="margin-top:10px">
          <button type="button" class="btn btn-primary" data-action="rl-create"><i class="fas fa-plus"></i> دور</button>
          <a class="btn btn-ghost" href="roles-permissions.html" target="_blank"><i class="fas fa-up-right-from-square"></i> الصفحة الكاملة</a>
        </div>
        <article class="card" style="margin-top:10px">
          <div class="table-wrap"><table class="data">
            <thead><tr><th>الرمز</th><th>الاسم</th><th>المستوى</th><th>الأنظمة</th><th>الصلاحيات</th><th>المصدر</th><th></th></tr></thead>
            <tbody>${roles
              .map(
                (r) => `<tr>
                  <td><code>${K.esc(r.code)}</code></td>
                  <td>${K.esc(r.nameAr)}</td>
                  <td>${K.badge(r.level, 'badge-outline')}</td>
                  <td>${K.esc((r.systems || []).join(' · '))}</td>
                  <td>${K.esc((r.permissions || []).join(' · '))}</td>
                  <td>${K.sourceBadge(r.source)}</td>
                  <td><button type="button" class="btn btn-sm btn-ghost" data-action="rl-edit" data-id="${r.id}">تعديل</button></td>
                </tr>`
              )
              .join('')}</tbody>
          </table></div>
        </article>`;
    } else if (rlUi.tab === 'matrix') {
      const systems = [...new Set(roles.flatMap((r) => r.systems || []))];
      body = `<article class="card"><div class="table-wrap"><table class="data">
        <thead><tr><th>الدور</th>${systems.map((s) => `<th>${K.esc(s)}</th>`).join('')}</tr></thead>
        <tbody>${roles
          .map(
            (r) => `<tr>
              <td>${K.esc(r.nameAr)}</td>
              ${systems.map((s) => `<td>${(r.systems || []).includes(s) ? K.badge((r.permissions || []).join('/') || 'read', 'badge-black') : '—'}</td>`).join('')}
            </tr>`
          )
          .join('')}</tbody>
      </table></div>
      <p class="muted" style="margin-top:8px">المصفوفة التشغيلية داخل هوب — للتفاصيل المتقدمة افتح الصفحة الكاملة.</p></article>`;
    } else if (rlUi.tab === 'users') {
      body = `<article class="card">
        <div class="toolbar" style="flex-wrap:wrap">
          <div class="field"><label>الاسم</label><input id="rl-user-name" /></div>
          <div class="field"><label>البريد</label><input id="rl-user-email" type="email" /></div>
          <div class="field"><label>الدور</label>
            <select id="rl-user-role">${roles.map((r) => `<option value="${K.esc(r.code)}">${K.esc(r.nameAr)}</option>`).join('')}</select>
          </div>
          <button type="button" class="btn btn-primary" data-action="rl-assign">تعيين</button>
        </div>
        <div class="table-wrap" style="margin-top:10px"><table class="data">
          <thead><tr><th>المستخدم</th><th>البريد</th><th>الدور</th><th>المصدر</th><th>الوقت</th></tr></thead>
          <tbody>${
            assignments
              .map(
                (a) => `<tr>
                  <td>${K.esc(a.userName)}</td><td>${K.esc(a.userEmail)}</td>
                  <td>${K.esc(a.roleCode)}</td><td>${K.sourceBadge(a.source)}</td><td>${K.fmtTime(a.at)}</td>
                </tr>`
              )
              .join('') || '<tr><td colspan="5" class="empty">لا تعيينات</td></tr>'
          }</tbody>
        </table></div>
      </article>`;
    } else {
      body = `<article class="card">${K.renderAuditTable(bag.auditLog || [])}</article>`;
    }

    const modal = rlUi.modal
      ? K.renderModal('rl', {
          title: rlUi.editId ? 'تعديل دور' : 'دور جديد',
          bodyHtml: `
            <div class="field"><label>الرمز *</label><input id="rl-code" value="${K.esc(rlUi.modal.data?.code || '')}" /></div>
            <div class="field"><label>الاسم *</label><input id="rl-name" value="${K.esc(rlUi.modal.data?.nameAr || '')}" /></div>
            <div class="field"><label>المستوى</label>
              <select id="rl-level">${['admin', 'manager', 'auditor', 'employee', 'customer'].map((l) => `<option ${rlUi.modal.data?.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
            </div>
            <div class="field"><label>الأنظمة (مفصولة بفاصلة)</label><input id="rl-systems" value="${K.esc((rlUi.modal.data?.systems || []).join(','))}" /></div>
            <div class="field"><label>الصلاحيات (مفصولة بفاصلة)</label><input id="rl-perms" value="${K.esc((rlUi.modal.data?.permissions || []).join(','))}" /></div>`,
          footerHtml: `<button type="button" class="btn btn-ghost" data-action="rl-modal-close">إلغاء</button>
            <button type="button" class="btn btn-primary" data-action="rl-save">حفظ</button>`,
        })
      : '';

    return `<div class="hub-ops-ws hub-roles-ws">
      ${K.renderHeader({
        prefix: 'rl',
        title: 'إدارة الأدوار والصلاحيات',
        subtitle: 'أدوار هوب · مصفوفة أنظمة · تعيينات · تدقيق',
        icon: 'fa-shield-alt',
        actionsHtml: `<button type="button" class="btn btn-primary btn-sm" data-action="rl-create"><i class="fas fa-plus"></i> دور</button>
          <a class="btn btn-ghost btn-sm" href="roles-permissions.html" target="_blank"><i class="fas fa-up-right-from-square"></i></a>`,
      })}
      ${K.renderKpis('rl', kpis, '')}
      ${K.renderTabs('rl', RL_TABS, rlUi.tab)}
      ${body}
      ${K.renderHelp('rl', {
        title: 'دليل الأدوار',
        dismissed: !!bag.settings?.helpDismissed,
        open: rlUi.helpOpen,
        bodyHtml: `<p>عرّف الأدوار وصلاحيات الأنظمة هنا داخل هوب. الصفحة الكاملة تبقى متاحة للتفاصيل المتقدمة (ERP parity).</p>`,
      })}
      ${modal}
    </div>`;
  };

  const handleRoles = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const K = Kit();
    const actor = K.actorName(user);
    if (action === 'rl-tab') {
      rlUi.tab = btn.dataset.tab || 'roles';
      return true;
    }
    if (action === 'rl-kpi') {
      if (btn.dataset.tab) rlUi.tab = btn.dataset.tab;
      return true;
    }
    if (action === 'rl-create') {
      rlUi.editId = null;
      rlUi.modal = { data: { level: 'employee', systems: ['HUB'], permissions: ['read'], source: 'إدخال يدوي' } };
      return true;
    }
    if (action === 'rl-edit') {
      const row = (store().rolesBag()?.roles || []).find((x) => x.id === btn.dataset.id);
      if (!row) return true;
      rlUi.editId = row.id;
      rlUi.modal = { data: { ...row } };
      return true;
    }
    if (action === 'rl-modal-close') {
      rlUi.modal = null;
      return true;
    }
    if (action === 'rl-save') {
      const payload = {
        id: rlUi.editId || undefined,
        code: K.qVal('rl-code'),
        nameAr: K.qVal('rl-name'),
        level: K.qVal('rl-level'),
        systems: K.qVal('rl-systems')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        permissions: K.qVal('rl-perms')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        source: 'إدخال يدوي',
      };
      if (!payload.code || !payload.nameAr) {
        toast?.('الرمز والاسم مطلوبان');
        return true;
      }
      store().upsertHubRole?.(payload, actor);
      rlUi.modal = null;
      toast?.('تم حفظ الدور');
      return true;
    }
    if (action === 'rl-assign') {
      const item = store().assignHubRole?.(
        {
          userName: K.qVal('rl-user-name'),
          userEmail: K.qVal('rl-user-email'),
          roleCode: K.qVal('rl-user-role'),
        },
        actor
      );
      if (!item) {
        toast?.('البريد والدور مطلوبان');
        return true;
      }
      toast?.('تم التعيين');
      return true;
    }
    if (action === 'rl-help-open') {
      rlUi.helpOpen = true;
      return true;
    }
    if (action === 'rl-help-dismiss') {
      const bag = store().rolesBag?.();
      if (bag) {
        bag.settings = bag.settings || {};
        bag.settings.helpDismissed = true;
        store().save?.();
      }
      rlUi.helpOpen = false;
      return true;
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
      { key: 'needs', label: 'Needs Action', value: needs.length, tab: 'pending' },
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
                              ? `<a class="btn btn-ghost btn-sm" href="roles-permissions.html" target="_blank">الأدوار والصلاحيات</a>`
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
        title: 'موافقة السوبر أدمن',
        subtitle: 'اعتماد طلبات سجل معنا · منح النظام · تدقيق',
        icon: 'fa-key',
        actionsHtml: `<button type="button" class="btn btn-ghost btn-sm" data-action="rn-help-open"><i class="fas fa-circle-question"></i></button>`,
      })}
      ${K.renderKpis('rn', kpis, '')}
      ${K.renderTabs('rn', RN_TABS, rnUi.tab)}
      ${body}
      ${K.renderHelp('rn', {
        title: 'دليل موافقة السوبر أدمن',
        dismissed: !!meta.settings?.helpDismissed,
        open: rnUi.helpOpen,
        bodyHtml: `<p>اعتمد الطلب لمنح النظام والاشتراك، أو ارفضه. بعدها أكمل الأدوار من صفحة الصلاحيات إن لزم.</p>`,
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
  const psUi = { tab: 'ops', helpOpen: false };
  const PS_TABS = [
    { id: 'ops', label: 'عمليات بوشا', icon: 'fa-building-user' },
    { id: 'audit', label: 'سجل العمليات', icon: 'fa-clock-rotate-left' },
    { id: 'settings', label: 'الإعدادات', icon: 'fa-gear' },
  ];

  const renderPosha = () => {
    const K = Kit();
    const meta = store().get()?.poshaClientsWs || { auditLog: [], settings: {} };
    const clients = store().clientsBag?.()?.clients || [];
    const poshaish = clients.filter((c) => (c.systems || []).some((s) => String(s.code || '').toUpperCase() === 'POSHA') || c.source === 'POSHA');
    const reqK = window.HubCustomerRequests?.kpis?.() || { neu: 0, open: 0, pendingReview: 0, needsAction: 0 };
    const pendingReqs = reqK.needsAction || reqK.pendingReview || reqK.neu || 0;
    const needs = [
      ...poshaish.filter((c) => c.status !== 'active').map((c) => ({ text: `عميل بوشا يحتاج متابعة: ${c.name}`, tab: 'ops' })),
      ...(pendingReqs
        ? [{ text: `${pendingReqs} طلبات عملاء تحتاج إجراء في الصندوق الموحد`, tab: 'ops' }]
        : []),
    ];
    if (!window.HubPoshaClients) needs.push({ text: 'وحدة عملاء بوشا غير محمّلة', tab: 'ops' });

    const kpis = [
      { key: 'local', label: 'عملاء مرتبطون ببوشا', value: poshaish.length, tab: 'ops' },
      { key: 'pending', label: 'غير نشط', value: poshaish.filter((c) => c.status !== 'active').length, tab: 'ops' },
      { key: 'reqs', label: 'طلبات تحتاج مراجعة', value: pendingReqs, tab: 'ops' },
      { key: 'needs', label: 'Needs Action', value: needs.length, tab: 'ops' },
    ];

    let body = '';
    if (psUi.tab === 'ops') {
      body = `${K.renderNeeds('ps', needs)}
        <div id="posha-mount" class="card" style="margin-top:12px;padding:0;border:0;background:transparent;box-shadow:none"></div>`;
    } else if (psUi.tab === 'audit') {
      body = `<article class="card">${K.renderAuditTable(meta.auditLog || [])}</article>`;
    } else {
      body = `<article class="card"><p>مركز عمليات بوشا يعمل داخل هوب. سجّل أي تدخل يدوي من غرفة العمليات في Audit عند الحاجة.</p>
        <button type="button" class="btn btn-dark" data-action="ps-audit-note">تسجيل مراجعة يدوية</button></article>`;
    }

    return `<div class="hub-ops-ws hub-posha-ws">
      ${K.renderHeader({
        prefix: 'ps',
        title: 'عملاء بوشا',
        subtitle: 'مركز عمليات · دعم · طلبات · مشاكل · أحداث · إشعارات',
        icon: 'fa-building-user',
        actionsHtml: `<button type="button" class="btn btn-ghost btn-sm" data-action="ps-help-open"><i class="fas fa-circle-question"></i></button>`,
      })}
      ${K.renderKpis('ps', kpis, '')}
      ${K.renderTabs('ps', PS_TABS, psUi.tab)}
      ${body}
      ${K.renderHelp('ps', {
        title: 'دليل عملاء بوشا',
        dismissed: !!meta.settings?.helpDismissed,
        open: psUi.helpOpen,
        bodyHtml: `<p>تبويب العمليات يشغّل مركز بوشا التشغيلي. Needs Action يربط العملاء المحليين غير النشطين.</p>`,
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
    if (action === 'ps-kpi') {
      if (btn.dataset.tab) psUi.tab = btn.dataset.tab;
      return true;
    }
    if (action === 'ps-audit-note') {
      store().pushDomainAudit?.(meta(), {
        action: 'manual_review',
        detail: 'مراجعة يدوية لمركز عملاء بوشا',
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
