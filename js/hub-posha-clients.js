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
          <button type="button" data-ptab="support">الدعم <span class="posha-badge" id="badge-support" hidden>0</span></button>
          <button type="button" data-ptab="orders">الطلبات <span class="posha-badge" id="badge-orders" hidden>0</span></button>
          <button type="button" data-ptab="issues">المشاكل والتنبيهات <span class="posha-badge" id="badge-issues" hidden>0</span></button>
          <button type="button" data-ptab="events">مركز الأحداث</button>
          <button type="button" data-ptab="notifications">الإشعارات <span class="posha-badge" id="badge-notif" hidden>0</span></button>
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
    const cards = [
      ['إجمالي العملاء', s.totalClients || 0],
      ['النشطون', s.activeClients || 0],
      ['الموقوفون', s.suspendedClients || 0],
      ['الجدد', s.newClients || 0],
      ['طلبات تحتاج مراجعة', s.pendingOrders || 0],
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

  async function paintBody() {
    const body = document.getElementById('posha-body');
    if (!body) return;
    const s = state.summary || {};
    setBadge('badge-new', s.newClients || 0);
    setBadge('badge-support', s.openTickets || 0);
    setBadge('badge-orders', s.pendingOrders || 0);
    setBadge('badge-issues', s.openIssues || 0);
    setBadge('badge-notif', s.unreadAdminNotifications || 0);

    if (state.tab === 'overview') {
      body.innerHTML = summaryCards(s) + `<h3>أحدث العملاء</h3>` + clientsTable(state.clients.slice(0, 8));
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
      const orders = state.clients.flatMap((c) =>
        // need orders from detail — fetch lightweight from clients list only counts; load tickets already. Re-fetch clients full via tickets path or use events.
        []
      );
      // Load from tickets-like: get each? Better: use events filter ORDER
      const orderEvents = state.events.filter((e) => String(e.type||e.action||'').startsWith('ORDER'));
      body.innerHTML = `<h3>الطلبات (من الأحداث)</h3><ul class="feed">${orderEvents.slice(0,40).map((e)=>`<li>
        <b>${esc(e.clientEmail||'')}</b> — ${esc(e.title||e.type)} <small>${fmt(e.at)}</small>
        ${e.clientEmail?`<button type="button" class="btn btn-ghost btn-sm" data-open-posha="${esc(e.clientEmail)}">فتح</button>`:''}
      </li>`).join('')||'<li>لا أحداث طلبات</li>'}</ul>`;
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
      const body = document.getElementById('posha-body');
      if (body) body.innerHTML = `<p class="posha-err">${esc(e.message)}</p>`;
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
      if (state.tab !== 'new') state.statusFilter = '';
      document.querySelectorAll('#posha-subnav button').forEach((b) => b.classList.toggle('is-active', b === btn));
      paintBody();
    };
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
