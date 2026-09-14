/**
 * عملاء بوشا — Client Operations Center (Admin UI)
 */
(function () {
  'use strict';

  function authHeaders() {
    const h = { Accept: 'application/json', 'Content-Type': 'application/json' };
    const token = localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || '';
    const raw = localStorage.getItem('hubUser') || sessionStorage.getItem('hubUser');
    let user = null;
    try { user = raw ? JSON.parse(raw) : null; } catch (_) {}
    if (token) h.Authorization = `Bearer ${token}`;
    if (user?.role) h['X-Hub-User-Role'] = String(user.role);
    if (user?.email) h['X-Hub-User-Email'] = String(user.email);
    if (user?.name) {
      try { h['X-Hub-User-Name'] = encodeURIComponent(String(user.name)); } catch (_) {}
    }
    return h;
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: authHeaders(),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmt(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return String(iso).slice(0, 16);
    }
  }

  const state = {
    tab: 'overview',
    clients: [],
    summary: {},
    selectedEmail: null,
    detail: null,
    tickets: [],
    events: [],
    issues: [],
    notifications: [],
    filter: '',
    statusFilter: '',
    q: '',
    reqView: 'active',
    reqFilters: { q: '', status: '', type: '', source: '', assignee: '' },
    reqId: null,
    reqTab: 'overview',
    moreId: null,
  };

  function shell() {
    return `
      <div class="posha-ops" id="posha-ops">
        <div class="posha-head">
          <div>
            <h2><i class="fas fa-building-user"></i> عملاء بوشا</h2>
            <p>مركز عمليات العملاء · دعم · طلبات · مشاكل · أحداث · إشعارات</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="posha-refresh"><i class="fas fa-rotate"></i> تحديث</button>
        </div>
        <nav class="posha-subnav" id="posha-subnav">
          <button type="button" data-ptab="overview" class="is-active">نظرة عامة</button>
          <button type="button" data-ptab="clients">جميع العملاء</button>
          <button type="button" data-ptab="new">العملاء الجدد <span class="posha-badge" id="badge-new" hidden>0</span></button>
          <button type="button" data-ptab="orders">طلبات العملاء <span class="posha-badge" id="badge-orders" hidden>0</span></button>
          <button type="button" data-ptab="support">الدعم <span class="posha-badge" id="badge-support" hidden>0</span></button>
          <button type="button" data-ptab="issues">المشاكل والتنبيهات <span class="posha-badge" id="badge-issues" hidden>0</span></button>
          <button type="button" data-ptab="events">مركز الأحداث</button>
          <button type="button" data-ptab="notifications">الإشعارات <span class="posha-badge" id="badge-notif" hidden>0</span></button>
          <button type="button" data-ptab="req-settings">إعدادات الطلبات</button>
        </nav>
        <div id="posha-body" class="posha-body"><div class="posha-loading">جاري التحميل…</div></div>
        <div id="posha-drawer" class="posha-drawer" hidden></div>
      </div>`;
  }

  function setBadge(id, n) {
    const el = document.getElementById(id);
    if (!el) return;
    if (n > 0) {
      el.hidden = false;
      el.textContent = String(n);
    } else el.hidden = true;
  }

  function summaryCards(s) {
    s = s || {};
    const reqK = cr()?.kpis?.() || {};
    const cards = [
      ['إجمالي العملاء', s.totalClients || 0],
      ['النشطون', s.activeClients || 0],
      ['الموقوفون', s.suspendedClients || 0],
      ['الجدد', s.newClients || 0],
      ['طلبات تحتاج مراجعة', reqK.pendingReview || reqK.needsAction || s.pendingOrders || 0],
      ['تذاكر مفتوحة', s.openTickets || 0],
      ['مشاكل تحتاج تدخل', s.openIssues || 0],
      ['فواتير تحتاج مراجعة', s.paymentIssues || 0],
    ];
    return `<div class="posha-kpis">${cards.map(([l, v]) => `<article><span>${esc(l)}</span><strong>${v}</strong></article>`).join('')}</div>`;
  }

  function clientsTable(list) {
    if (!list.length) return '<p class="posha-muted">لا عملاء مطابقون.</p>';
    return `<div class="table-wrap"><table class="data-table posha-table">
      <thead><tr>
        <th>Client ID</th><th>العميل</th><th>الحالة</th><th>أنظمة</th><th>طلبات</th><th>تذاكر</th>
        <th>المحفظة</th><th>آخر دخول</th><th>تنبيه</th><th></th>
      </tr></thead>
      <tbody>${list.map((c) => `<tr>
        <td>${esc(c.clientId)}</td>
        <td><strong>${esc(c.name)}</strong><br><small>${esc(c.email)}${c.phone ? ' · ' + esc(c.phone) : ''}${c.company ? '<br>' + esc(c.company) : ''}</small></td>
        <td><span class="chip">${esc(c.status)}</span></td>
        <td>${c.systemsCount || 0}</td>
        <td>${c.openOrders || 0}</td>
        <td>${c.openTickets || 0}</td>
        <td>${Number(c.walletTotal || 0).toLocaleString('en-US')}</td>
        <td>${fmt(c.lastLoginAt)}</td>
        <td>${c.hasAlert ? '<span class="posha-alert">!</span>' : '—'}</td>
        <td><button type="button" class="btn btn-primary btn-sm" data-open-posha="${esc(c.email)}">فتح 360</button></td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  function filterBar() {
    return `<div class="posha-filters">
      <input id="posha-q" type="search" placeholder="بحث: اسم · Client ID · بريد · هاتف" value="${esc(state.q)}" />
      <select id="posha-status">
        <option value="">كل الحالات</option>
        <option value="active" ${state.statusFilter === 'active' ? 'selected' : ''}>Active</option>
        <option value="pending" ${state.statusFilter === 'pending' ? 'selected' : ''}>Pending</option>
        <option value="suspended" ${state.statusFilter === 'suspended' ? 'selected' : ''}>Suspended</option>
        <option value="new">New</option>
        <option value="tickets">Has Open Tickets</option>
        <option value="orders">Has Pending Orders</option>
        <option value="payments">Has Payment Issues</option>
        <option value="alerts">Has Alerts</option>
      </select>
    </div>`;
  }

  function filteredClients() {
    let list = state.clients.slice();
    const q = state.q.trim().toLowerCase();
    if (q) {
      list = list.filter((c) =>
        [c.name, c.email, c.clientId, c.phone, c.company].some((x) => String(x || '').toLowerCase().includes(q))
      );
    }
    const f = state.statusFilter;
    if (f === 'active' || f === 'pending' || f === 'suspended') list = list.filter((c) => c.status === f);
    if (f === 'new') list = list.filter((c) => c.isNew);
    if (f === 'tickets') list = list.filter((c) => c.openTickets > 0);
    if (f === 'orders') list = list.filter((c) => c.openOrders > 0);
    if (f === 'payments') list = list.filter((c) => c.unpaidInvoices > 0);
    if (f === 'alerts') list = list.filter((c) => c.hasAlert);
    return list;
  }

  async function open360(email) {
    state.selectedEmail = email;
    const drawer = document.getElementById('posha-drawer');
    drawer.hidden = false;
    drawer.innerHTML = '<div class="posha-loading">تحميل ملف العميل…</div>';
    try {
      const data = await api(`/api/admin/posha/clients/${encodeURIComponent(email)}`);
      state.detail = data;
      paintDrawer();
    } catch (e) {
      drawer.innerHTML = `<p class="posha-err">${esc(e.message)}</p>`;
    }
  }

  function paintDrawer() {
    const drawer = document.getElementById('posha-drawer');
    const c = state.detail?.client;
    if (!c) return;
    const tl = (state.detail.timeline || []).slice(0, 30);
    drawer.innerHTML = `
      <div class="posha-drawer-inner">
        <div class="posha-drawer-head">
          <div>
            <h3>${esc(c.name)} · ${esc(c.clientId)}</h3>
            <p>${esc(c.email)} · ${esc(c.phone || '—')} · ${esc(c.status)} · انضمام ${fmt(c.createdAt)} · آخر دخول ${fmt(c.lastLoginAt)}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="posha-close-drawer">إغلاق</button>
        </div>
        <div class="posha-tabs" id="posha-ctabs">
          ${['overview','systems','orders','subscriptions','invoices','wallet','support','notifications','activity','security','notes']
            .map((t) => `<button type="button" data-ctab="${t}">${t}</button>`).join('')}
        </div>
        <div id="posha-ctab-body"></div>
      </div>`;
    document.getElementById('posha-close-drawer').onclick = () => { drawer.hidden = true; };
    const paint = (tab) => {
      document.querySelectorAll('#posha-ctabs button').forEach((b) => b.classList.toggle('is-active', b.dataset.ctab === tab));
      const body = document.getElementById('posha-ctab-body');
      if (tab === 'overview') {
        body.innerHTML = `<div class="posha-kpis mini">
          <article><span>أنظمة</span><strong>${(c.systems||[]).length}</strong></article>
          <article><span>طلبات</span><strong>${(c.orders||[]).length}</strong></article>
          <article><span>تذاكر</span><strong>${(c.tickets||[]).length}</strong></article>
          <article><span>محفظة</span><strong>${c.wallet?.total||0}</strong></article>
        </div>
        <h4>Timeline</h4>
        <ul class="posha-timeline">${tl.map((e) => `<li><strong>${esc(e.type||e.title)}</strong> — ${esc(e.message||e.title||'')}<small>${fmt(e.at)} · ${esc(e.actor_id||'')}</small></li>`).join('') || '<li>لا أحداث</li>'}</ul>`;
      } else if (tab === 'systems') {
        body.innerHTML = `<div class="posha-actions">
          <input id="ps-code" placeholder="ERP" /><input id="ps-name" placeholder="اسم النظام" />
          <button class="btn btn-primary btn-sm" id="ps-act">تفعيل / تعيين</button>
        </div>
        <ul class="feed">${(c.systems||[]).map((s)=>`<li><b>${esc(s.name)}</b> · ${esc(s.plan)} · ${esc(s.status)}</li>`).join('')||'<li>لا أنظمة</li>'}</ul>`;
        document.getElementById('ps-act').onclick = async () => {
          try {
            await api(`/api/admin/posha/clients/${encodeURIComponent(c.email)}/activate-system`, {
              method: 'POST', body: { code: document.getElementById('ps-code').value, name: document.getElementById('ps-name').value }
            });
            open360(c.email); refresh();
          } catch (e) { alert(e.message); }
        };
      } else if (tab === 'orders') {
        body.innerHTML = `<ul class="feed">${(c.orders||[]).map((o)=>`<li>
          <b>${esc(o.number)}</b> ${esc(o.service)} · ${esc(o.status)}
          <select data-order="${esc(o.id)}" class="posha-order-status">
            ${['pending_review','in_progress','approved','completed','rejected','cancelled'].map((s)=>`<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </li>`).join('')||'<li>لا طلبات</li>'}</ul>`;
        body.querySelectorAll('.posha-order-status').forEach((sel) => {
          sel.onchange = async () => {
            try {
              await api(`/api/admin/posha/clients/${encodeURIComponent(c.email)}/order-status`, {
                method: 'POST', body: { orderId: sel.dataset.order, status: sel.value }
              });
              open360(c.email);
            } catch (e) { alert(e.message); }
          };
        });
      } else if (tab === 'subscriptions') {
        body.innerHTML = `<ul class="feed">${(c.subscriptions||[]).map((s)=>`<li><b>${esc(s.systemName)}</b> · ${esc(s.plan)} · ${esc(s.status)}</li>`).join('')||'<li>—</li>'}</ul>`;
      } else if (tab === 'invoices') {
        body.innerHTML = `<ul class="feed">${(c.invoices||[]).map((i)=>`<li><b>${esc(i.number)}</b> · ${i.amount} · ${esc(i.status)}</li>`).join('')||'<li>—</li>'}</ul>`;
      } else if (tab === 'wallet') {
        body.innerHTML = `<p><b>مدفوع:</b> ${c.wallet?.paid||0} · <b>مجاني:</b> ${c.wallet?.free||0} · <b>الإجمالي:</b> ${c.wallet?.total||0}</p>
          <div class="posha-actions"><input id="pw-amt" type="number" min="1" placeholder="مبلغ الشحن" />
          <input id="pw-note" placeholder="ملاحظة" /><button class="btn btn-primary btn-sm" id="pw-go">إضافة رصيد</button></div>
          <ul class="feed">${(c.wallet?.ledger||[]).slice(0,10).map((l)=>`<li>${esc(l.note)} · ${l.type} ${l.amount}</li>`).join('')}</ul>`;
        document.getElementById('pw-go').onclick = async () => {
          try {
            await api(`/api/admin/posha/clients/${encodeURIComponent(c.email)}/wallet-credit`, {
              method: 'POST', body: { amount: Number(document.getElementById('pw-amt').value), note: document.getElementById('pw-note').value }
            });
            open360(c.email); refresh();
          } catch (e) { alert(e.message); }
        };
      } else if (tab === 'support') {
        body.innerHTML = (c.tickets||[]).map((t) => `
          <article class="posha-ticket">
            <div><strong>${esc(t.number||t.id)}</strong> — ${esc(t.subject)}
              <span class="chip">${esc(t.status)}</span>
              <select data-tstatus="${esc(t.id)}">
                ${['OPEN','IN_PROGRESS','WAITING_FOR_CLIENT','RESOLVED','CLOSED'].map((s)=>`<option ${String(t.status).toUpperCase()===s?'selected':''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="posha-thread">${(t.messages||[]).map((m)=>`<div class="posha-msg"><b>${esc(m.sender_role||m.from)}</b>: ${esc(m.message||m.body)}<small>${fmt(m.at||m.created_at)}</small></div>`).join('')}</div>
            <form data-treply="${esc(t.id)}" class="posha-reply"><input name="message" required placeholder="رد الإدارة…" /><button class="btn btn-primary btn-sm">إرسال</button></form>
          </article>`).join('') || '<p>لا تذاكر</p>';
        body.querySelectorAll('[data-tstatus]').forEach((sel) => {
          sel.onchange = async () => {
            try {
              await api(`/api/admin/posha/tickets/${encodeURIComponent(sel.dataset.tstatus)}/status`, { method: 'POST', body: { status: sel.value } });
              open360(c.email); refresh();
            } catch (e) { alert(e.message); }
          };
        });
        body.querySelectorAll('[data-treply]').forEach((form) => {
          form.onsubmit = async (e) => {
            e.preventDefault();
            const msg = new FormData(form).get('message');
            try {
              await api(`/api/admin/posha/tickets/${encodeURIComponent(form.dataset.treply)}/reply`, { method: 'POST', body: { message: msg } });
              open360(c.email); refresh();
            } catch (err) { alert(err.message); }
          };
        });
      } else if (tab === 'notifications') {
        body.innerHTML = `<ul class="feed">${(c.notifications||[]).slice(0,20).map((n)=>`<li><b>${esc(n.title)}</b> — ${esc(n.body||'')}<small>${fmt(n.at)}</small></li>`).join('')||'<li>—</li>'}</ul>`;
      } else if (tab === 'activity') {
        body.innerHTML = `<ul class="posha-timeline">${tl.map((e)=>`<li><strong>${esc(e.type)}</strong> ${esc(e.message||'')}<small>${fmt(e.at)}</small></li>`).join('')||'<li>—</li>'}</ul>`;
      } else if (tab === 'security') {
        body.innerHTML = `<p>آخر دخول: ${fmt(c.lastLoginAt)}</p>
          <ul class="feed">${(c.sessions||[]).map((s)=>`<li>${esc(s.device)} · ${esc(s.browser)} · ${esc(s.ip||'—')}<small>${fmt(s.at)}</small></li>`).join('')||'<li>لا جلسات مخزّنة</li>'}</ul>
          <p class="posha-muted">كلمات المرور والـtokens غير مرئية للإدارة.</p>`;
      } else if (tab === 'notes') {
        body.innerHTML = `<form id="posha-note-form" class="posha-reply"><input name="note" required placeholder="ملاحظة داخلية" /><button class="btn btn-primary btn-sm">إضافة</button></form>
          <ul class="feed">${(c.internalNotes||[]).map((n)=>`<li><b>${esc(n.by)}</b>: ${esc(n.note)}<small>${fmt(n.at)}</small></li>`).join('')||'<li>—</li>'}</ul>`;
        document.getElementById('posha-note-form').onsubmit = async (e) => {
          e.preventDefault();
          try {
            await api(`/api/admin/clients/${encodeURIComponent(c.email)}/notes`, { method: 'POST', body: { note: new FormData(e.target).get('note') } });
            open360(c.email);
          } catch (err) { alert(err.message); }
        };
      }
    };
    document.querySelectorAll('#posha-ctabs button').forEach((b) => b.onclick = () => paint(b.dataset.ctab));
    paint('overview');
  }

  function cr() {
    return window.HubCustomerRequests;
  }

  function statusAr(st) {
    return (cr()?.STATUS_AR && cr().STATUS_AR[st]) || st || '—';
  }

  function actor() {
    try {
      const u = window.HubAuth?.getUser?.() || JSON.parse(localStorage.getItem('hubUser') || '{}');
      return u?.name || u?.email || 'مشغّل بوشا';
    } catch {
      return 'مشغّل بوشا';
    }
  }

  function requestsKpisHtml() {
    const k = cr()?.kpis?.() || {};
    const cards = [
      ['كل الطلبات', k.total || 0, 'all'],
      ['طلبات جديدة', k.neu || 0, 'new'],
      ['بانتظار المراجعة', k.pendingReview || 0, 'pending_review'],
      ['قيد المعالجة', k.inProgress || 0, 'open'],
      ['تحتاج إجراء', k.needsAction || 0, 'pending_review'],
      ['تمت الموافقة', k.approved || 0, 'approved'],
      ['مرفوضة', k.rejected || 0, 'rejected'],
      ['مكتملة', k.completed || 0, 'completed'],
    ];
    return `<div class="posha-kpis posha-req-kpis">${cards
      .map(
        ([l, v, view]) =>
          `<button type="button" class="posha-kpi-btn" data-req-view="${esc(view)}"><span>${esc(l)}</span><strong>${v}</strong></button>`
      )
      .join('')}</div>`;
  }

  function needsActionHtml() {
    const k = cr()?.kpis?.() || {};
    const items = [];
    if (k.neu) items.push({ text: `${k.neu} طلبات جديدة`, view: 'new' });
    if (k.pendingReview) items.push({ text: `${k.pendingReview} بانتظار المراجعة`, view: 'pending_review' });
    if (k.overdue) items.push({ text: `${k.overdue} طلب تجاوز SLA`, view: 'overdue' });
    if (k.waiting) items.push({ text: `${k.waiting} بانتظار العميل / تعديل`, view: 'waiting' });
    if (!items.length) return '';
    return `<div class="posha-needs">
      <h3><i class="fas fa-bolt"></i> يحتاج إلى إجراء</h3>
      <ul>${items.map((i) => `<li><button type="button" data-req-view="${esc(i.view)}">${esc(i.text)}</button></li>`).join('')}</ul>
    </div>`;
  }

  function filteredCentralRequests() {
    if (!cr()) return [];
    const f = state.reqFilters;
    const view = state.reqView === 'all' ? '' : state.reqView;
    return cr().list({
      q: f.q,
      status: f.status,
      requestType: f.type,
      sourceModule: f.source,
      assignedTo: f.assignee,
      view: view || undefined,
    });
  }

  function renderRequestsInbox() {
    if (!cr()) {
      return `<div class="posha-err">وحدة الطلبات المركزية غير محمّلة. حدّث الصفحة.</div>`;
    }
    cr().syncFromModules?.();
    const rows = filteredCentralRequests();
    const all = cr().list({});
    const types = [...new Set(all.map((r) => r.requestType).filter(Boolean))];
    const sources = [...new Set(all.map((r) => r.sourceModule).filter(Boolean))];
    const assignees = [...new Set(all.map((r) => r.assignedTo).filter(Boolean))];
    const views = [
      ['active', 'الطلبات النشطة'],
      ['pending_review', 'بانتظار المراجعة'],
      ['approved', 'تمت الموافقة عليها'],
      ['paused', 'موقوفة'],
      ['archived', 'مؤرشفة'],
      ['rejected', 'المرفوضة'],
      ['completed', 'المكتملة'],
      ['all', 'كل الطلبات'],
      ['articles', 'المقالات فقط'],
      ['new', 'جديدة'],
      ['waiting', 'تحتاج تعديلات'],
    ];

    if (state.reqId) return renderRequestDetail(state.reqId);

    return `
      ${requestsKpisHtml()}
      ${needsActionHtml()}
      <div class="posha-req-head">
        <h3>طلبات العملاء — Central Inbox</h3>
        <button type="button" class="btn btn-primary btn-sm" data-req-create><i class="fas fa-plus"></i> إنشاء طلب</button>
      </div>
      <div class="posha-saved-views">${views
        .map(([id, label]) => `<button type="button" class="chip ${state.reqView === id ? 'is-on' : ''}" data-req-view="${id}">${label}</button>`)
        .join('')}</div>
      <div class="posha-filters posha-req-filters">
        <input data-req-filter="q" type="search" placeholder="بحث: Request ID · Article ID · عميل · موضوع · مصدر" value="${esc(state.reqFilters.q)}" />
        <select data-req-filter="status"><option value="">كل الحالات</option>${Object.entries(cr().STATUS_AR || {})
          .map(([k, v]) => `<option value="${esc(k)}" ${state.reqFilters.status === k ? 'selected' : ''}>${esc(v)}</option>`)
          .join('')}</select>
        <select data-req-filter="type"><option value="">نوع الطلب</option>${types.map((t) => `<option value="${esc(t)}" ${state.reqFilters.type === t ? 'selected' : ''}>${esc((cr().TYPE_LABELS_AR || {})[t] || t)}</option>`).join('')}</select>
        <select data-req-filter="source"><option value="">المصدر</option>${sources.map((t) => `<option value="${esc(t)}" ${state.reqFilters.source === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <select data-req-filter="assignee"><option value="">المسؤول</option>${assignees.map((t) => `<option value="${esc(t)}" ${state.reqFilters.assignee === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
      </div>
      <div class="table-wrap posha-req-table-wrap"><table class="data-table posha-table posha-req-table">
        <thead><tr>
          <th>Request ID</th><th>نوع الطلب</th><th>العميل</th><th>العنوان / الموضوع</th>
          <th>القسم</th><th>المصدر</th><th>Reference ID</th>
          <th>تاريخ الطلب</th><th>الحالة</th><th>المسؤول</th><th>الأولوية</th><th>آخر تحديث</th><th>الإجراءات</th>
        </tr></thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map((r) => {
                    const typeLabel = r.requestTypeLabel || (cr().TYPE_LABELS_AR || {})[r.requestType] || r.requestType;
                    const isArt = r.referenceType === 'Article' || r.requestType === 'Article Submission';
                    const artActs = isArt && !['Published', 'Rejected', 'Archived'].includes(r.status)
                      ? `<button type="button" class="btn btn-primary btn-sm" data-req-approve-publish="${esc(r.id)}">موافقة ونشر</button>`
                      : '';
                    return `<tr>
                      <td><code>${esc(r.requestId || r.id)}</code></td>
                      <td>${esc(typeLabel)}</td>
                      <td><button type="button" class="btn btn-ghost btn-sm" data-open-posha="${esc(r.email || '')}">${esc(r.customerName || r.customer?.name || '—')}</button>
                        <br><small>${esc(r.customerId || '—')}</small></td>
                      <td>${esc(r.title || '—')}</td>
                      <td>${esc(r.department || '—')}</td>
                      <td><span class="chip">${esc(r.sourceModule || '—')}</span><br><small>${esc(r.sourcePage || '')}</small></td>
                      <td>${r.referenceId ? `<code>${esc(r.referenceId)}</code>` : '—'}</td>
                      <td>${fmt(r.createdAt)}</td>
                      <td><span class="chip">${esc(statusAr(r.status))}</span></td>
                      <td>${esc(r.assignedTo || '—')}</td>
                      <td>${esc(r.priority)}</td>
                      <td>${fmt(r.updatedAt)}</td>
                      <td class="posha-req-actions">
                        <button type="button" class="btn btn-primary btn-sm" data-req-open="${esc(r.id)}">عرض</button>
                        ${artActs}
                        <button type="button" class="btn btn-ghost btn-sm" data-req-status="${esc(r.id)}">الحالة</button>
                        <button type="button" class="btn btn-ghost btn-sm" data-req-more="${esc(r.id)}">⋮</button>
                      </td>
                    </tr>`;
                  })
                  .join('')
              : '<tr><td colspan="13" class="posha-muted">لا طلبات مطابقة — أي طلب من المقالات أو حلول نايوش أو غيرها يظهر هنا تلقائياً.</td></tr>'
          }
        </tbody>
      </table></div>`;
  }

  function renderRequestDetail(id) {
    const r = cr()?.get(id);
    if (!r) return `<p class="posha-err">الطلب غير موجود</p><button type="button" class="btn btn-ghost" data-req-back>رجوع</button>`;
    cr().markViewed?.(id, actor());
    const tab = state.reqTab;
    const isArt = r.referenceType === 'Article' || r.requestType === 'Article Submission';
    const art = isArt && r.referenceId ? window.HubArticles?.get?.(r.referenceId) : null;
    const snap = art || r.articleSnapshot || {};
    const tabs = [
      ['overview', 'نظرة عامة'],
      ['source', 'مصدر الطلب'],
      ...(isArt ? [['article', 'المقال']] : []),
      ['comms', 'التواصل'],
      ['notes', 'ملاحظات داخلية'],
      ['files', 'المرفقات'],
      ['timeline', 'Timeline'],
      ['audit', 'سجل العمليات'],
    ];
    let body = '';
    if (tab === 'overview') {
      body = `<div class="posha-req-grid">
        <article>
          <h4>بيانات العميل</h4>
          <ul class="feed">
            <li><b>الاسم:</b> <button type="button" class="btn btn-ghost btn-sm" data-open-posha="${esc(r.email || '')}">${esc(r.customerName || r.customer?.name || '—')}</button></li>
            <li><b>Client ID:</b> ${esc(r.customerId || '—')}</li>
            <li><b>الشركة:</b> ${esc(r.company || '—')}</li>
            <li><b>الهاتف:</b> ${esc(r.phone || '—')}</li>
            <li><b>البريد:</b> ${esc(r.email || '—')}</li>
            <li><b>الفرع:</b> ${esc(r.branch || '—')}</li>
          </ul>
          <button type="button" class="btn btn-dark btn-sm" data-open-posha="${esc(r.email || '')}">فتح ملف العميل</button>
        </article>
        <article>
          <h4>بيانات الطلب</h4>
          <ul class="feed">
            <li><b>النوع:</b> ${esc(r.requestTypeLabel || r.requestType)}</li>
            <li><b>الموضوع:</b> ${esc(r.title)}</li>
            <li><b>الوصف:</b> ${esc(r.description || r.need || '—')}</li>
            <li><b>Reference:</b> ${esc(r.referenceType || '—')} · <code>${esc(r.referenceId || '—')}</code></li>
            <li><b>الأولوية:</b> ${esc(r.priority)}</li>
            <li><b>Channel:</b> ${esc(r.channel || 'Web')}</li>
            <li><b>SLA:</b> ${esc(cr().slaStatus(r))}</li>
          </ul>
        </article>
        <article>
          <h4>المسؤولون</h4>
          <ul class="feed">
            <li><b>Assigned To:</b> ${esc(r.assignedTo || '—')}</li>
            <li><b>Department:</b> ${esc(r.department || '—')}</li>
            <li><b>Approved By:</b> ${esc(r.approvedBy || '—')}</li>
            <li><b>Approved At:</b> ${fmt(r.approvedAt)}</li>
            <li><b>Created By:</b> ${esc(r.createdBy || '—')}</li>
          </ul>
        </article>
      </div>`;
    } else if (tab === 'article' && isArt) {
      body = `<div class="posha-req-grid">
        <article style="grid-column:1/-1">
          <h4>بيانات المقال المرتبطة</h4>
          <ul class="feed">
            <li><b>Article ID:</b> <code>${esc(r.referenceId || snap.articleId || '—')}</code></li>
            <li><b>العنوان:</b> ${esc(snap.title || '—')}</li>
            <li><b>التصنيف:</b> ${esc(snap.category || '—')}</li>
            <li><b>الكاتب:</b> ${esc(snap.authorName || '—')}</li>
            <li><b>الملخص:</b> ${esc(snap.summary || '—')}</li>
            <li><b>تاريخ الإرسال:</b> ${fmt(snap.submittedAt || r.createdAt)}</li>
          </ul>
          ${snap.body ? `<div style="white-space:pre-wrap;background:#f9fafb;padding:12px;border-radius:10px;margin-top:8px">${esc(snap.body)}</div>` : ''}
          ${snap.articleFile ? `<p style="margin-top:8px"><i class="fas fa-paperclip"></i> ${esc(snap.articleFile.name)}</p>` : ''}
          <div class="posha-req-actions" style="margin-top:12px">
            <a class="btn btn-dark btn-sm" href="blog.html#mine/${esc(r.referenceId || '')}" target="_blank" rel="noopener">فتح المقال</a>
            <a class="btn btn-ghost btn-sm" href="blog.html#mine/${esc(r.referenceId || '')}" target="_blank" rel="noopener">معاينة المقال</a>
          </div>
        </article>
      </div>`;
    } else if (tab === 'source') {
      body = `<ul class="feed">
        <li><b>Source Module:</b> ${esc(r.sourceModule)}</li>
        <li><b>Source Page:</b> ${esc(r.sourcePage)}</li>
        <li><b>Source Action:</b> ${esc(r.sourceAction)}</li>
        <li><b>Reference Type:</b> ${esc(r.referenceType || '—')}</li>
        <li><b>Reference ID:</b> <code>${esc(r.referenceId || '—')}</code></li>
        <li><b>Channel:</b> ${esc(r.channel)}</li>
        <li><b>Created At:</b> ${fmt(r.createdAt)}</li>
      </ul>
      ${r.sourceUrl ? `<a class="btn btn-dark btn-sm" href="${esc(r.sourceUrl)}" target="_blank" rel="noopener">فتح الصفحة الأصلية</a>` : ''}`;
    } else if (tab === 'comms') {
      body = `<ul class="feed">${(r.messages || [])
        .map((m) => `<li><b>${esc(m.by)}</b>: ${esc(m.text)} <small>${fmt(m.at)}</small></li>`)
        .join('') || '<li>لا رسائل</li>'}</ul>
        <div class="posha-reply"><input id="posha-req-msg" placeholder="رسالة للعميل" /><button type="button" class="btn btn-primary btn-sm" data-req-send-msg="${esc(r.id)}">إرسال</button></div>`;
    } else if (tab === 'notes') {
      body = `<ul class="feed">${(r.internalNotes || [])
        .map((m) => `<li><b>${esc(m.by)}</b>: ${esc(m.text)} <small>${fmt(m.at)}</small></li>`)
        .join('') || '<li>لا ملاحظات داخلية</li>'}</ul>
        <div class="posha-reply"><input id="posha-req-note" placeholder="ملاحظة داخلية (لا يراها العميل)" /><button type="button" class="btn btn-dark btn-sm" data-req-send-note="${esc(r.id)}">حفظ</button></div>`;
    } else if (tab === 'files') {
      body = `<ul class="feed">${(r.attachments || [])
        .map((a) => `<li>${esc(a.name)} · ${esc(a.by)} <small>${fmt(a.at)}</small></li>`)
        .join('') || '<li>لا مرفقات</li>'}</ul>
        <button type="button" class="btn btn-dark btn-sm" data-req-att="${esc(r.id)}">إضافة مرفق</button>`;
    } else if (tab === 'timeline') {
      body = `<ol class="posha-timeline">${(r.timeline || [])
        .map((t) => `<li><b>${esc(t.text)}</b><small>${esc(t.by)} · ${fmt(t.at)}</small></li>`)
        .join('')}</ol>`;
    } else {
      const logs = (cr().listAudit() || []).filter((a) => a.requestId === r.id);
      body = `<div class="table-wrap"><table class="data-table posha-table"><thead><tr><th>TX</th><th>Action</th><th>By</th><th>Old→New</th><th>At</th></tr></thead>
        <tbody>${logs.map((a) => `<tr><td><code>${esc(a.id)}</code></td><td>${esc(a.action)}</td><td>${esc(a.performedBy)}</td><td>${esc(a.oldStatus || a.oldValue || '—')} → ${esc(a.newStatus || a.newValue || '—')}</td><td>${fmt(a.at)}</td></tr>`).join('') || '<tr><td colspan="5">لا سجل</td></tr>'}</tbody></table></div>`;
    }

    const artActions = isArt
      ? `
        ${!['Published', 'Rejected', 'Archived', 'Unpublished'].includes(r.status) ? `<button type="button" class="btn btn-primary btn-sm" data-req-approve-publish="${esc(r.id)}">✓ موافقة ونشر</button>` : ''}
        ${['Published', 'Unpublished', 'Approved'].includes(r.status) ? `<button type="button" class="btn btn-dark btn-sm" data-req-art-edit="${esc(r.id)}">تعديل</button>` : ''}
        ${r.status === 'Published' ? `<button type="button" class="btn btn-ghost btn-sm" data-req-art-pause="${esc(r.id)}">إيقاف</button>` : ''}
        ${r.status === 'Unpublished' ? `<button type="button" class="btn btn-primary btn-sm" data-req-art-resume="${esc(r.id)}">إعادة نشر</button>` : ''}
        ${!['Archived'].includes(r.status) ? `<button type="button" class="btn btn-ghost btn-sm" data-req-art-archive="${esc(r.id)}">أرشفة</button>` : ''}
        ${!['Published', 'Rejected', 'Archived'].includes(r.status) ? `<button type="button" class="btn btn-dark btn-sm" data-req-art-changes="${esc(r.id)}">طلب تعديل</button>
        <button type="button" class="btn btn-ghost btn-sm" data-req-art-reject="${esc(r.id)}">رفض</button>` : ''}
        <a class="btn btn-ghost btn-sm" href="blog.html#mine/${esc(r.referenceId || '')}" target="_blank">فتح المقال</a>
      `
      : '';

    return `
      <div class="posha-req-detail-head">
        <div>
          <button type="button" class="btn btn-ghost btn-sm" data-req-back>← رجوع لصندوق الطلبات</button>
          <h3>${esc(r.requestId || r.id)} · ${esc(r.title)}</h3>
          <span class="chip">${esc(statusAr(r.status))}</span>
          <span class="chip">${esc(r.priority)}</span>
          <span class="chip">${esc(cr().slaStatus(r))}</span>
        </div>
        <div class="posha-req-actions">
          ${artActions}
          <button type="button" class="btn btn-dark btn-sm" data-req-assign="${esc(r.id)}">تعيين</button>
          <button type="button" class="btn btn-ghost btn-sm" data-req-status="${esc(r.id)}">تغيير الحالة</button>
          <button type="button" class="btn btn-ghost btn-sm" data-req-msg="${esc(r.id)}">التواصل مع العميل</button>
        </div>
      </div>
      <div class="posha-subnav posha-req-tabs">${tabs
        .map(([tid, label]) => `<button type="button" data-req-tab="${tid}" class="${tab === tid ? 'is-active' : ''}">${label}</button>`)
        .join('')}</div>
      <div class="posha-req-detail-body">${body}</div>`;
  }

  function renderReqSettings() {
    const s = cr()?.getSettings?.() || {};
    const routing = s.routing || {};
    return `<div class="posha-req-settings">
      <h3>إعدادات طلبات العملاء</h3>
      <p class="posha-muted">Routing Rules · SLA · Departments · Default Owners</p>
      <div class="table-wrap"><table class="data-table posha-table">
        <thead><tr><th>Request Type</th><th>Department</th><th>Default Owner</th></tr></thead>
        <tbody>${Object.entries(routing)
          .map(
            ([type, rule]) => `<tr>
              <td>${esc(type)}</td>
              <td><input data-route-dept="${esc(type)}" value="${esc(rule.department || '')}" /></td>
              <td><input data-route-owner="${esc(type)}" value="${esc(rule.assignedTo || '')}" /></td>
            </tr>`
          )
          .join('')}</tbody>
      </table></div>
      <div class="posha-filters" style="margin-top:12px">
        <label>SLA افتراضي (ساعات)<input id="posha-sla-default" type="number" value="${s.slaHours?.default ?? 4}" /></label>
        <label>SLA أولوية مرتفعة<input id="posha-sla-high" type="number" value="${s.slaHours?.high ?? 1}" /></label>
      </div>
      <button type="button" class="btn btn-primary" data-req-save-settings>حفظ الإعدادات</button>
    </div>`;
  }

  function wireRequestsUi(body) {
    body.querySelectorAll('[data-req-view]').forEach((btn) => {
      btn.onclick = () => {
        state.reqView = btn.getAttribute('data-req-view') || 'all';
        state.reqId = null;
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-filter]').forEach((el) => {
      el.onchange = el.oninput = () => {
        state.reqFilters[el.getAttribute('data-req-filter')] = el.value;
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-open]').forEach((btn) => {
      btn.onclick = () => {
        state.reqId = btn.getAttribute('data-req-open');
        state.reqTab = 'overview';
        state.moreId = null;
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-back]').forEach((btn) => {
      btn.onclick = () => {
        state.reqId = null;
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-tab]').forEach((btn) => {
      btn.onclick = () => {
        state.reqTab = btn.getAttribute('data-req-tab');
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-more]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-more');
        state.moreId = state.moreId === id ? null : id;
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-assign]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-assign');
        const name = window.prompt('Assigned To؟', cr()?.get(id)?.assignedTo || 'Sales Desk');
        if (!name) return;
        const dept = window.prompt('Department؟', cr()?.get(id)?.department || 'Sales') || 'Sales';
        cr()?.assign(id, { assignedTo: name, department: dept, salesOwner: name }, actor());
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-status]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-status');
        const statuses = Object.keys(cr()?.STATUS_AR || {});
        const next = window.prompt(`الحالة الجديدة:\n${statuses.join(' · ')}`, cr()?.get(id)?.status || 'Under Review');
        if (!next || !statuses.includes(next)) return alert('حالة غير معروفة');
        cr()?.updateStatus(id, next, actor());
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-approve-publish]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-approve-publish');
        const r = cr()?.get(id);
        if (!r) return;
        const ok = window.confirm(
          `هل تريد اعتماد ونشر هذا المقال؟\n\nRequest: ${r.id}\nArticle: ${r.referenceId || '—'}\nالعنوان: ${r.title || ''}\nالعميل: ${r.customerName || ''}`
        );
        if (!ok) return;
        cr()?.approveAndPublish?.(id, actor());
        state.reqView = 'approved';
        state.reqId = id;
        state.reqTab = 'overview';
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-art-edit]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-art-edit');
        const r = cr()?.get(id);
        const art = r?.referenceId ? window.HubArticles?.get?.(r.referenceId) : null;
        const title = window.prompt('عنوان المقال', art?.title || '');
        if (title === null) return;
        const summary = window.prompt('الملخص', art?.summary || '');
        if (summary === null) return;
        const bodyText = window.prompt('المحتوى', art?.body || '');
        if (bodyText === null) return;
        cr()?.editLinkedArticle?.(id, { title, summary, body: bodyText }, actor());
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-art-pause]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-art-pause');
        if (!window.confirm('إيقاف النشر (Unpublish) دون حذف الطلب؟')) return;
        cr()?.pauseRequest?.(id, actor());
        state.reqView = 'paused';
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-art-resume]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-art-resume');
        if (!window.confirm('إعادة نشر المقال؟')) return;
        cr()?.resumeRequest?.(id, actor());
        state.reqView = 'approved';
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-art-archive]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-art-archive');
        if (!window.confirm('أرشفة الطلب والمقال؟ السجل سيبقى محفوظاً.')) return;
        cr()?.archiveRequest?.(id, actor());
        state.reqView = 'archived';
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-art-changes]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-art-changes');
        const note = window.prompt('سبب طلب التعديل؟');
        if (!note) return;
        cr()?.updateStatus(id, 'Needs Changes', actor(), note);
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-art-reject]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-art-reject');
        const note = window.prompt('سبب الرفض؟');
        if (!note) return;
        cr()?.updateStatus(id, 'Rejected', actor(), note);
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-note]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-note');
        const text = window.prompt('ملاحظة داخلية؟');
        if (!text) return;
        cr()?.addMessage(id, text, actor(), { internal: true });
        state.moreId = null;
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-msg]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-msg');
        const text = window.prompt('رسالة للعميل؟');
        if (!text) return;
        cr()?.addMessage(id, text, actor(), { internal: false });
        cr()?.updateStatus(id, 'Waiting For Customer', actor(), 'تم التواصل مع العميل');
        state.moreId = null;
        if (state.reqId) state.reqTab = 'comms';
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-info]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-info');
        cr()?.updateStatus(id, 'Waiting For Customer', actor(), 'طلب معلومات إضافية من العميل');
        state.moreId = null;
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-att]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-att');
        const name = window.prompt('اسم المرفق؟');
        if (!name) return;
        cr()?.addAttachment(id, name, actor());
        state.moreId = null;
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-dept]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-dept');
        const dept = window.prompt('القسم؟', 'Sales');
        if (!dept) return;
        cr()?.assign(id, { department: dept }, actor());
        state.moreId = null;
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-task]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-task');
        const r = cr()?.get(id);
        window.HubStore?.addTask?.({
          title: `متابعة طلب ${r?.id}`,
          details: r?.title || '',
          assignee: r?.assignedTo || actor(),
          priority: r?.priority || 'متوسط',
          status: 'todo',
          source: 'Customer Requests',
        });
        cr()?.pushAudit?.({ action: 'Task Created', requestId: id, performedBy: actor(), detail: r?.title, customer: r?.company, sourceModule: r?.sourceModule });
        alert('أُنشئت مهمة في مركز المهام');
        state.moreId = null;
      };
    });
    body.querySelectorAll('[data-req-quote]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-quote');
        if (window.HubSolutions?.createQuotation) {
          const price = Number(window.prompt('السعر؟', '5000')) || 5000;
          window.HubSolutions.createQuotation(id, { price }, actor());
        }
        cr()?.updateStatus(id, 'Proposal Sent', actor(), 'إرسال عرض سعر');
        state.moreId = null;
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-close]').forEach((btn) => {
      btn.onclick = () => {
        cr()?.updateStatus(btn.getAttribute('data-req-close'), 'Completed', actor(), 'إغلاق الطلب');
        state.moreId = null;
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-cancel]').forEach((btn) => {
      btn.onclick = () => {
        if (!window.confirm('إلغاء الطلب؟')) return;
        cr()?.updateStatus(btn.getAttribute('data-req-cancel'), 'Cancelled', actor(), 'إلغاء');
        state.moreId = null;
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-send-msg]').forEach((btn) => {
      btn.onclick = () => {
        const text = document.getElementById('posha-req-msg')?.value?.trim();
        if (!text) return;
        cr()?.addMessage(btn.getAttribute('data-req-send-msg'), text, actor());
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-send-note]').forEach((btn) => {
      btn.onclick = () => {
        const text = document.getElementById('posha-req-note')?.value?.trim();
        if (!text) return;
        cr()?.addMessage(btn.getAttribute('data-req-send-note'), text, actor(), { internal: true });
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-create]')?.forEach?.((btn) => {
      btn.onclick = () => {
        const email = window.prompt('بريد العميل؟') || '';
        const name = window.prompt('اسم العميل؟') || '';
        const company = window.prompt('الشركة؟') || '';
        const title = window.prompt('موضوع الطلب؟') || 'طلب داخلي';
        const type = window.prompt('نوع الطلب؟', 'General Request') || 'General Request';
        const channel = window.prompt('القناة؟ (Web/Phone/Email/WhatsApp)', 'Phone') || 'Phone';
        cr()?.create(
          {
            requestType: type,
            title,
            description: title,
            need: title,
            sourceModule: 'عملاء بوشا',
            sourcePage: 'إنشاء يدوي',
            sourceAction: 'Admin Create',
            sourceUrl: 'dashboard.html#posha-clients',
            channel,
            customer: { name, company, email, phone: '', branch: '' },
            customerName: name,
            company,
            email,
          },
          actor()
        );
        paintBody();
      };
    });
    // fix create button - forEach on NodeList from querySelectorAll works; data-req-create is single
    const createBtn = body.querySelector('[data-req-create]');
    if (createBtn) {
      createBtn.onclick = () => {
        const email = window.prompt('بريد العميل؟') || '';
        const name = window.prompt('اسم العميل؟') || '';
        const company = window.prompt('الشركة؟') || '';
        const title = window.prompt('موضوع الطلب؟') || 'طلب داخلي';
        const type = window.prompt('نوع الطلب؟', 'General Request') || 'General Request';
        const channel = window.prompt('القناة؟ (Web/Phone/Email/WhatsApp)', 'Phone') || 'Phone';
        cr()?.create(
          {
            requestType: type,
            title,
            description: title,
            need: title,
            sourceModule: 'عملاء بوشا',
            sourcePage: 'إنشاء يدوي',
            sourceAction: 'Admin Create',
            sourceUrl: 'dashboard.html#posha-clients',
            channel,
            customer: { name, company, email, phone: '', branch: '' },
            customerName: name,
            company,
            email,
          },
          actor()
        );
        paintBody();
      };
    }
    body.querySelector('[data-req-save-settings]')?.addEventListener('click', () => {
      const routing = { ...(cr()?.getSettings()?.routing || {}) };
      body.querySelectorAll('[data-route-dept]').forEach((inp) => {
        const type = inp.getAttribute('data-route-dept');
        routing[type] = routing[type] || {};
        routing[type].department = inp.value;
      });
      body.querySelectorAll('[data-route-owner]').forEach((inp) => {
        const type = inp.getAttribute('data-route-owner');
        routing[type] = routing[type] || {};
        routing[type].assignedTo = inp.value;
      });
      cr()?.updateSettings({
        routing,
        slaHours: {
          default: Number(document.getElementById('posha-sla-default')?.value) || 4,
          high: Number(document.getElementById('posha-sla-high')?.value) || 1,
          urgent: Number(document.getElementById('posha-sla-high')?.value) || 1,
        },
      });
      alert('حُفظت الإعدادات');
    });
  }

  async function paintBody() {
    const body = document.getElementById('posha-body');
    if (!body) return;
    const s = state.summary || {};
    const reqK = cr()?.kpis?.() || {};
    setBadge('badge-new', s.newClients || 0);
    setBadge('badge-support', s.openTickets || 0);
    setBadge('badge-orders', reqK.needsAction || reqK.pendingReview || reqK.neu || 0);
    setBadge('badge-issues', s.openIssues || 0);
    setBadge('badge-notif', s.unreadAdminNotifications || 0);

    if (state.tab === 'overview') {
      body.innerHTML =
        summaryCards(s) +
        needsActionHtml() +
        `<h3>أحدث العملاء</h3>` +
        clientsTable(state.clients.slice(0, 8));
      wireRequestsUi(body);
    } else if (state.tab === 'clients' || state.tab === 'new') {
      if (state.tab === 'new') state.statusFilter = state.statusFilter || 'new';
      body.innerHTML = summaryCards(s) + filterBar() + clientsTable(filteredClients());
      wireFilters();
    } else if (state.tab === 'support') {
      body.innerHTML = `<h3>مركز الدعم</h3><ul class="feed">${state.tickets.map((t)=>`<li>
        <b>${esc(t.number||t.id)}</b> — ${esc(t.subject)} · ${esc(t.clientName)} (${esc(t.clientEmail)})
        <span class="chip">${esc(t.status)}</span>
        <button type="button" class="btn btn-ghost btn-sm" data-open-posha="${esc(t.clientEmail)}">فتح العميل</button>
      </li>`).join('') || '<li>لا تذاكر</li>'}</ul>`;
    } else if (state.tab === 'orders') {
      body.innerHTML = renderRequestsInbox();
      wireRequestsUi(body);
    } else if (state.tab === 'req-settings') {
      body.innerHTML = renderReqSettings();
      wireRequestsUi(body);
    } else if (state.tab === 'issues') {
      body.innerHTML = `<h3>المشاكل والتنبيهات</h3><ul class="feed">${state.issues.map((i)=>`<li>
        <span class="chip">${esc(i.severity)}</span> <b>${esc(i.title)}</b> — ${esc(i.message)}
        · ${esc(i.clientEmail||'')} · ${esc(i.status)}
        <select data-issue="${esc(i.id)}">
          ${['OPEN','INVESTIGATING','RESOLVED'].map((s)=>`<option ${i.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
        ${i.clientEmail?`<button type="button" class="btn btn-ghost btn-sm" data-open-posha="${esc(i.clientEmail)}">فتح العميل</button>`:''}
      </li>`).join('')||'<li>لا مشاكل مفتوحة</li>'}</ul>`;
      body.querySelectorAll('[data-issue]').forEach((sel) => {
        sel.onchange = async () => {
          try {
            await api(`/api/admin/posha/issues/${encodeURIComponent(sel.dataset.issue)}/status`, { method: 'POST', body: { status: sel.value } });
            refresh();
          } catch (e) { alert(e.message); }
        };
      });
    } else if (state.tab === 'events') {
      body.innerHTML = `<div class="posha-filters"><select id="posha-ev-filter">
        <option value="">All</option>
        ${['LOGIN','Support','Orders','Payments','Systems','Subscriptions','Security','Account'].map((x)=>`<option>${x}</option>`).join('')}
      </select></div>
      <ul class="feed" id="posha-ev-list">${state.events.slice(0,80).map(evHtml).join('')||'<li>—</li>'}</ul>`;
      document.getElementById('posha-ev-filter').onchange = (e) => {
        const v = e.target.value.toUpperCase();
        const list = !v ? state.events : state.events.filter((x) => String(x.type||x.action||'').toUpperCase().includes(v === 'LOGIN' ? 'LOGIN' : v === 'SUPPORT' ? 'TICKET' : v === 'ORDERS' ? 'ORDER' : v === 'PAYMENTS' ? 'PAYMENT' : v === 'SYSTEMS' ? 'SYSTEM' : v === 'SUBSCRIPTIONS' ? 'SUBSCRIPTION' : v === 'SECURITY' ? 'PASSWORD' : 'CLIENT'));
        document.getElementById('posha-ev-list').innerHTML = list.slice(0,80).map(evHtml).join('') || '<li>—</li>';
        wireOpens();
      };
    } else if (state.tab === 'notifications') {
      body.innerHTML = `<div class="posha-actions"><button class="btn btn-ghost btn-sm" id="posha-read-all">تعليم الكل كمقروء</button></div>
        <ul class="feed">${state.notifications.map((n)=>`<li class="${n.is_read?'':'unread'}">
          <b>${esc(n.title)}</b> — ${esc(n.message)} <small>${fmt(n.created_at)}</small>
          ${n.clientEmail?`<button type="button" class="btn btn-primary btn-sm" data-open-posha="${esc(n.clientEmail)}" data-nid="${esc(n.id)}">فتح</button>`:''}
        </li>`).join('')||'<li>لا إشعارات</li>'}</ul>`;
      document.getElementById('posha-read-all')?.addEventListener('click', async () => {
        await api('/api/admin/posha/notifications/read', { method: 'POST', body: { all: true } });
        refresh();
      });
    }
    wireOpens();
  }

  function evHtml(e) {
    return `<li><b>${esc(e.clientEmail||'—')}</b> · ${esc(e.type||e.action)} — ${esc(e.title||e.message||'')}
      <small>${fmt(e.at)} · ${esc(e.actor_id||'')}</small>
      ${e.clientEmail?`<button type="button" class="btn btn-ghost btn-sm" data-open-posha="${esc(e.clientEmail)}">فتح العميل</button>`:''}
    </li>`;
  }

  function wireFilters() {
    document.getElementById('posha-q')?.addEventListener('input', (e) => {
      state.q = e.target.value;
      paintBody();
    });
    document.getElementById('posha-status')?.addEventListener('change', (e) => {
      state.statusFilter = e.target.value;
      paintBody();
    });
  }

  function wireOpens() {
    document.querySelectorAll('[data-open-posha]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-nid');
        if (id) api('/api/admin/posha/notifications/read', { method: 'POST', body: { id } }).catch(() => {});
        open360(btn.getAttribute('data-open-posha'));
      };
    });
  }

  async function refresh() {
    try {
      const [clients, tickets, events, issues, notifs] = await Promise.all([
        api('/api/admin/posha/clients'),
        api('/api/admin/posha/tickets').catch(() => ({ tickets: [] })),
        api('/api/admin/posha/events').catch(() => ({ events: [] })),
        api('/api/admin/posha/issues').catch(() => ({ issues: [] })),
        api('/api/admin/posha/notifications').catch(() => ({ notifications: [], unread: 0 })),
      ]);
      state.clients = clients.clients || [];
      state.summary = clients.summary || {};
      state.tickets = tickets.tickets || [];
      state.events = events.events || [];
      state.issues = issues.issues || [];
      state.notifications = notifs.notifications || [];
      await paintBody();
      updateTopBell(state.summary.unreadAdminNotifications || notifs.unread || 0);
    } catch (e) {
      /* Central inbox must still work offline / without Posha API */
      state.clients = state.clients || [];
      state.summary = state.summary || {};
      state.tickets = state.tickets || [];
      state.events = state.events || [];
      state.issues = state.issues || [];
      state.notifications = state.notifications || [];
      if (state.tab === 'orders' || state.tab === 'req-settings' || state.tab === 'overview') {
        await paintBody();
        const body = document.getElementById('posha-body');
        if (body && state.tab !== 'orders' && state.tab !== 'req-settings') {
          body.insertAdjacentHTML('afterbegin', `<p class="posha-err">${esc(e.message)} — صندوق الطلبات المركزية متاح محلياً.</p>`);
        }
      } else {
        const body = document.getElementById('posha-body');
        if (body) {
          body.innerHTML = `<p class="posha-err">${esc(e.message)}</p>
            <p><button type="button" class="btn btn-primary btn-sm" data-ptab-fallback="orders">فتح طلبات العملاء</button></p>`;
          body.querySelector('[data-ptab-fallback]')?.addEventListener('click', () => {
            state.tab = 'orders';
            document.querySelectorAll('#posha-subnav button').forEach((b) => b.classList.toggle('is-active', b.dataset.ptab === 'orders'));
            paintBody();
          });
        }
      }
    }
  }

  function updateTopBell(n) {
    let bell = document.getElementById('posha-admin-bell');
    if (!bell) {
      const actions = document.querySelector('.topbar-actions');
      if (!actions) return;
      bell = document.createElement('button');
      bell.type = 'button';
      bell.id = 'posha-admin-bell';
      bell.className = 'btn btn-ghost btn-sm';
      bell.innerHTML = `<i class="fas fa-bell"></i> بوشا <span class="posha-badge" id="posha-top-badge" hidden>0</span>`;
      bell.onclick = () => {
        location.hash = 'posha-clients';
        state.tab = 'notifications';
        if (window.HubPoshaClients?.mount) {
          /* dashboard will remount on hash */
        }
      };
      actions.prepend(bell);
    }
    setBadge('posha-top-badge', n);
  }

  function mount(root) {
    if (!root) return;
    root.innerHTML = shell();
    document.getElementById('posha-refresh').onclick = refresh;
    document.getElementById('posha-subnav').onclick = (e) => {
      const btn = e.target.closest('[data-ptab]');
      if (!btn) return;
      state.tab = btn.dataset.ptab;
      state.reqId = '';
      state.moreId = '';
      if (state.tab !== 'new') state.statusFilter = '';
      document.querySelectorAll('#posha-subnav button').forEach((b) => b.classList.toggle('is-active', b === btn));
      paintBody();
    };
    if (!mount._crListen) {
      mount._crListen = true;
      window.addEventListener('hub-customer-requests-changed', () => {
        if (!document.getElementById('posha-ops')) return;
        if (state.tab === 'orders' || state.tab === 'overview' || state.tab === 'req-settings') paintBody();
        else {
          const reqK = cr()?.kpis?.() || {};
          setBadge('badge-orders', reqK.neu || 0);
        }
      });
    }
    refresh();
    if (!mount._poll) {
      mount._poll = setInterval(() => {
        if (document.getElementById('posha-ops')) refresh().catch(() => {});
        else api('/api/admin/posha/summary').then((d) => updateTopBell(d.summary?.unreadAdminNotifications || 0)).catch(() => {});
      }, 15000);
    }
  }

  window.HubPoshaClients = { mount, refresh, open360, state };
})();
