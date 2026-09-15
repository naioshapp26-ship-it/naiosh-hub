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
    const ctrl = new AbortController();
    const ms = opts.timeoutMs == null ? 8000 : opts.timeoutMs;
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(path, {
        method: opts.method || 'GET',
        headers: authHeaders(),
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        const errMsg =
          typeof data.error === 'string'
            ? data.error
            : data.error && typeof data.error === 'object'
              ? data.error.message || JSON.stringify(data.error)
              : `HTTP ${res.status}`;
        throw new Error(errMsg || `HTTP ${res.status}`);
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  function errText(e) {
    if (!e) return 'خطأ غير معروف';
    if (typeof e === 'string') return e;
    if (e.name === 'AbortError') return 'انتهت مهلة الاتصال بالخادم';
    if (e.message && e.message !== '[object Object]') return String(e.message);
    try {
      return JSON.stringify(e);
    } catch (_) {
      return 'تعذر تحميل البيانات';
    }
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
    const primary = [
      ['overview', 'نظرة عامة'],
      ['clients', 'العملاء'],
      ['orders', 'طلبات العملاء', 'badge-orders'],
      ['approved', 'الطلبات المقبولة'],
      ['support', 'الدعم', 'badge-support'],
    ];
    const more = [
      ['new', 'العملاء الجدد', 'badge-new'],
      ['issues', 'المشاكل والتنبيهات', 'badge-issues'],
      ['events', 'مركز الأحداث'],
      ['notifications', 'الإشعارات', 'badge-notif'],
      ['req-settings', 'إعدادات الطلبات'],
    ];
    const moreTab = more.some(([id]) => state.tab === id);
    return `
      <div class="posha-ops" id="posha-ops">
        <nav class="posha-mainnav" id="posha-subnav">
          <div class="posha-mainnav-primary">
            ${primary
              .map(
                ([id, label, badge]) =>
                  `<button type="button" data-ptab="${id}" class="${state.tab === id ? 'is-active' : ''}">${label}${
                    badge ? ` <span class="posha-badge" id="${badge}" hidden>0</span>` : ''
                  }</button>`
              )
              .join('')}
            <div class="posha-more">
              <button type="button" class="posha-more-toggle ${moreTab ? 'is-current' : ''}" id="posha-more-toggle" aria-expanded="false" aria-haspopup="true">
                المزيد <i class="fas fa-chevron-down"></i>
              </button>
              <div class="posha-more-panel" id="posha-more-panel" hidden>
                ${more
                  .map(
                    ([id, label, badge]) =>
                      `<button type="button" data-ptab="${id}" class="${state.tab === id ? 'is-active' : ''}">${label}${
                        badge ? ` <span class="posha-badge" id="${badge}" hidden>0</span>` : ''
                      }</button>`
                  )
                  .join('')}
              </div>
            </div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="posha-refresh"><i class="fas fa-rotate"></i> تحديث</button>
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
    const pendingReview = reqK.pendingReview || reqK.needsAction || 0;
    const cards = [
      ['إجمالي العملاء', s.totalClients || state.clients.length || 0],
      ['النشطون', s.activeClients || 0],
      ['الموقوفون', s.suspendedClients || 0],
      ['الجدد', s.newClients || 0],
      ['طلبات تحتاج مراجعة', pendingReview],
      ['تذاكر مفتوحة', s.openTickets || state.tickets.length || 0],
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
      <input id="posha-q" type="search" placeholder="بحث عن عميل..." value="${esc(state.q)}" />
      <select id="posha-status">
        <option value="">كل الحالات</option>
        <option value="active" ${state.statusFilter === 'active' ? 'selected' : ''}>نشط</option>
        <option value="pending" ${state.statusFilter === 'pending' ? 'selected' : ''}>قيد التفعيل</option>
        <option value="suspended" ${state.statusFilter === 'suspended' ? 'selected' : ''}>موقوف</option>
        <option value="new" ${state.statusFilter === 'new' ? 'selected' : ''}>جديد</option>
        <option value="tickets" ${state.statusFilter === 'tickets' ? 'selected' : ''}>لديه تذاكر</option>
        <option value="orders" ${state.statusFilter === 'orders' ? 'selected' : ''}>لديه طلبات</option>
        <option value="payments" ${state.statusFilter === 'payments' ? 'selected' : ''}>مشاكل دفع</option>
        <option value="alerts" ${state.statusFilter === 'alerts' ? 'selected' : ''}>تنبيهات</option>
      </select>
    </div>`;
  }

  function overviewHtml() {
    const latestReqs = cr()?.list?.({ view: 'active' })?.slice(0, 6) || [];
    const latestClients = state.clients.slice(0, 6);
    const latestEvents = (state.events || []).slice(0, 8);
    return `
      <section class="posha-panel">
        <div class="posha-panel-head">
          <h3>أحدث طلبات العملاء</h3>
          <button type="button" class="btn btn-ghost btn-sm" data-ptab-jump="orders">عرض الكل</button>
        </div>
        ${
          latestReqs.length
            ? `<div class="table-wrap"><table class="data-table posha-table">
                <thead><tr><th>Request ID</th><th>العميل</th><th>النوع</th><th>الحالة</th><th></th></tr></thead>
                <tbody>${latestReqs
                  .map(
                    (r) => `<tr>
                  <td>${esc(r.id)}</td>
                  <td>${esc(r.customerName || r.company || '—')}</td>
                  <td>${esc((cr().TYPE_LABELS_AR || {})[r.requestType] || r.requestType || '—')}</td>
                  <td><span class="chip">${esc((cr().STATUS_AR || {})[r.status] || r.status)}</span></td>
                  <td><button type="button" class="btn btn-ghost btn-sm" data-req-open="${esc(r.id)}">عرض</button></td>
                </tr>`
                  )
                  .join('')}</tbody></table></div>`
            : `<p class="posha-ws-empty">لا توجد طلبات عملاء جديدة. <button type="button" class="btn btn-ghost btn-sm" data-ptab-jump="orders">عرض كل الطلبات</button></p>`
        }
      </section>
      <section class="posha-panel">
        <div class="posha-panel-head">
          <h3>أحدث العملاء</h3>
          <button type="button" class="btn btn-ghost btn-sm" data-ptab-jump="clients">عرض الكل</button>
        </div>
        ${clientsTable(latestClients)}
      </section>
      <section class="posha-panel">
        <div class="posha-panel-head">
          <h3>آخر الأنشطة</h3>
          <button type="button" class="btn btn-ghost btn-sm" data-ptab-jump="events">مركز الأحداث</button>
        </div>
        <ul class="feed posha-activity">${latestEvents.map(evHtml).join('') || '<li class="posha-muted">لا أنشطة حديثة.</li>'}</ul>
      </section>`;
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

  function displayReqStatus(r) {
    if (!r) return '—';
    if (requestKind(r) === 'ad') {
      const ad = findAd(r.referenceId);
      const w = ad?.workflowStatus || r.adPublishStatus || '';
      if (w === 'scheduled') return 'مجدول';
      if (w === 'active') return 'نشط';
      if (w === 'paused' && r.status === 'Approved') return 'متوقف';
      if (w === 'ended') return 'منتهي';
      if (w === 'rejected' || r.status === 'Rejected') return 'مرفوض';
      if (w === 'pending_review' || isPendingReq(r)) return 'بانتظار المراجعة';
    }
    if (r.status === 'Approved') return 'مقبول';
    if (r.status === 'Published') return 'نشط';
    if (r.status === 'Unpublished') return 'متوقف';
    return statusAr(r.status);
  }

  function moreMenuHtml(r) {
    if (state.moreId !== r.id) return '';
    const sourceHref = r.sourceUrl || (requestKind(r) === 'ad' ? 'ads.html' : requestKind(r) === 'article' ? 'blog.html' : '');
    return `<div class="posha-more-menu" role="menu">
      <button type="button" data-req-open="${esc(r.id)}" data-req-tab-pref="timeline">سجل الطلب</button>
      <button type="button" data-req-copy-id="${esc(r.requestId || r.id)}">نسخ Request ID</button>
      <button type="button" data-open-posha="${esc(r.email || '')}">فتح العميل</button>
      ${sourceHref ? `<a href="${esc(sourceHref)}" target="_blank" rel="noopener">فتح المصدر</a>` : ''}
      <button type="button" data-req-delete="${esc(r.id)}">حذف</button>
    </div>`;
  }

  function openRejectModal(r) {
    document.getElementById('posha-reject-modal')?.remove();
    const title =
      requestKind(r) === 'ad'
        ? 'رفض طلب نشر الإعلان'
        : requestKind(r) === 'article'
          ? 'رفض طلب نشر المقال'
          : 'رفض الطلب';
    const modal = document.createElement('div');
    modal.id = 'posha-reject-modal';
    modal.className = 'posha-modal-overlay';
    modal.innerHTML = `<div class="posha-modal" role="dialog" aria-modal="true">
      <h3>${esc(title)}</h3>
      <p class="posha-muted">${esc(r.title || r.requestId || r.id)}</p>
      <label class="posha-field"><span>سبب الرفض *</span>
        <textarea id="posha-reject-reason" rows="4" placeholder="اكتب سبب الرفض للعميل..."></textarea>
      </label>
      <label class="posha-check"><input type="checkbox" id="posha-reject-resubmit" checked /> السماح للعميل بالتعديل وإعادة الإرسال</label>
      <div class="posha-modal-actions">
        <button type="button" class="btn btn-ghost" data-reject-cancel>إلغاء</button>
        <button type="button" class="btn btn-danger" data-reject-confirm>تأكيد الرفض</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('[data-reject-cancel]').onclick = close;
    modal.onclick = (e) => {
      if (e.target === modal) close();
    };
    modal.querySelector('[data-reject-confirm]').onclick = () => {
      const reason = String(modal.querySelector('#posha-reject-reason')?.value || '').trim();
      if (!reason) {
        alert('سبب الرفض مطلوب');
        return;
      }
      const allow = !!modal.querySelector('#posha-reject-resubmit')?.checked;
      cr()?.rejectRequest?.(r.id, actor(), reason, { allowResubmit: allow }) ||
        cr()?.updateStatus?.(r.id, 'Rejected', actor(), reason);
      close();
      state.reqView = 'rejected';
      state.reqId = null;
      state.moreId = null;
      paintBody();
      try {
        document.dispatchEvent(new CustomEvent('posha-counters-refresh'));
      } catch (_) {}
    };
    setTimeout(() => modal.querySelector('#posha-reject-reason')?.focus(), 30);
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
    const cards =
      state.tab === 'approved'
        ? [
            ['إجمالي المقبولة', k.approved || 0, 'approved'],
            ['قيد التنفيذ', k.inProgress || 0, 'open'],
            ['موقوفة', (cr().list({ view: 'paused' }) || []).length, 'paused'],
            ['مكتملة', k.completed || 0, 'completed'],
          ]
        : [
            ['الكل', k.total || 0, 'all'],
            ['جديد', k.neu || 0, 'new'],
            ['بانتظار المراجعة', k.pendingReview || 0, 'pending_review'],
            ['قيد المعالجة', k.inProgress || 0, 'open'],
            ['يحتاج تعديل', k.waiting || 0, 'waiting'],
            ['مرفوض', k.rejected || 0, 'rejected'],
          ];
    return `<div class="posha-subtabs">${cards
      .map(
        ([l, v, view]) =>
          `<button type="button" class="posha-subtab ${state.reqView === view ? 'is-on' : ''}" data-req-view="${esc(view)}"><span>${esc(l)}</span><strong>${v}</strong></button>`
      )
      .join('')}</div>`;
  }

  function needsActionHtml() {
    return '';
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

  function requestKind(r) {
    if (!r) return 'general';
    if (r.referenceType === 'Ad' || r.requestType === 'Ad Submission') return 'ad';
    if (r.referenceType === 'Event' || r.requestType === 'Event Submission') return 'event';
    if (r.referenceType === 'Article' || r.requestType === 'Article Submission') return 'article';
    if (
      r.referenceType === 'Platform' ||
      r.requestType === 'Platform Access Request' ||
      r.requestType === 'Platform Add Request'
    )
      return 'platform';
    if (String(r.requestType || '').toLowerCase().includes('product') || r.referenceType === 'Product') return 'product';
    if (String(r.requestType || '').toLowerCase().includes('service') || r.referenceType === 'Service') return 'service';
    return 'general';
  }

  function isPendingReq(r) {
    return cr()?.isPendingReview?.(r) || ['New', 'Pending Review', 'Under Review', 'Needs Changes'].includes(r?.status);
  }

  function findAd(refId) {
    if (!refId) return null;
    const list = window.HubStore?.get?.()?.empire?.adsStudio?.listings || [];
    return list.find((x) => x.id === refId || x.adCode === refId) || null;
  }

  function primaryReqActionsHtml(r) {
    if (!r) return '';
    const pending = isPendingReq(r);
    const kind = requestKind(r);
    const openBtn = `<button type="button" class="btn btn-dark btn-sm" data-req-open="${esc(r.id)}">عرض التفاصيل</button>`;
    const moreBtn = `<button type="button" class="btn btn-ghost btn-sm" data-req-more="${esc(r.id)}" title="المزيد">⋮</button>${moreMenuHtml(r)}`;
    if (!pending) {
      if (state.tab === 'approved') {
        const ad = kind === 'ad' ? findAd(r.referenceId) : null;
        const extra =
          kind === 'ad' && ad?.status === 'active'
            ? `<a class="btn btn-ghost btn-sm" href="index.html" target="_blank" rel="noopener">معاينة الإعلان على الموقع</a>`
            : '';
        return `<div class="posha-req-actions-inner">${openBtn}
          <button type="button" class="btn btn-ghost btn-sm" data-req-edit-linked="${esc(r.id)}">تعديل</button>
          <button type="button" class="btn btn-ghost btn-sm" data-req-pause-linked="${esc(r.id)}">إيقاف</button>
          <button type="button" class="btn btn-ghost btn-sm" data-req-delete="${esc(r.id)}">حذف</button>
          ${moreBtn}
          ${extra}</div>`;
      }
      return `<div class="posha-req-actions-inner">${openBtn}${moreBtn}</div>`;
    }
    const approveLabel =
      kind === 'platform' && r.requestType === 'Platform Access Request'
        ? '✓ منح الوصول'
        : kind === 'ad' || kind === 'article' || kind === 'event'
          ? '✓ قبول'
          : '✓ قبول';
    return `<div class="posha-req-actions-inner">${openBtn}
      <button type="button" class="btn btn-primary btn-sm" data-req-approve="${esc(r.id)}">${approveLabel}</button>
      <button type="button" class="btn btn-danger btn-sm" data-req-reject="${esc(r.id)}">✕ رفض</button>
      ${moreBtn}</div>`;
  }

  function renderRequestsTable(rows) {
    const approvedTab = state.tab === 'approved';
    return `<div class="table-wrap posha-req-table-wrap"><table class="data-table posha-table posha-req-table">
        <thead><tr>
          <th>Request ID</th><th>نوع الطلب</th><th>العميل</th><th>العنوان / الموضوع</th>
          <th>المصدر</th><th>Reference ID</th>
          <th>تاريخ الطلب</th>${approvedTab ? '<th>تاريخ الموافقة</th>' : ''}
          <th>الحالة</th><th>المسؤول</th><th>الإجراءات</th>
        </tr></thead>
        <tbody>
          ${rows
            .map((r) => {
              const typeLabel = r.requestTypeLabel || (cr().TYPE_LABELS_AR || {})[r.requestType] || r.requestType;
              const rk = requestKind(r);
              const sourceHref =
                r.sourceUrl ||
                (rk === 'ad' ? 'ads.html' : rk === 'article' ? 'blog.html' : rk === 'platform' ? 'platforms.html' : '');
              const refHref =
                rk === 'ad'
                  ? `ads.html#ad=${encodeURIComponent(r.referenceId || '')}`
                  : rk === 'article'
                    ? `blog.html#mine/${encodeURIComponent(r.referenceId || '')}`
                    : rk === 'platform'
                      ? `platforms.html#platforms-catalog`
                      : '';
              return `<tr data-req-row="${esc(r.id)}">
                      <td><code>${esc(r.requestId || r.id)}</code></td>
                      <td>${esc(typeLabel)}<br><small class="posha-muted">${esc(r.channel || 'عميل')}</small></td>
                      <td><button type="button" class="btn btn-ghost btn-sm" data-open-posha="${esc(r.email || '')}">${esc(r.customerName || r.customer?.name || '—')}</button>
                        <br><small>${esc(r.company || r.customerId || '—')}</small></td>
                      <td>${esc(r.title || '—')}</td>
                      <td>${
                        sourceHref
                          ? `<a class="chip" href="${esc(sourceHref)}" target="_blank" rel="noopener">${esc(r.sourceModule || '—')}</a>`
                          : `<span class="chip">${esc(r.sourceModule || '—')}</span>`
                      }</td>
                      <td>${
                        r.referenceId
                          ? refHref
                            ? `<a href="${esc(refHref)}" target="_blank" rel="noopener"><code>${esc(r.referenceId)}</code></a>`
                            : `<button type="button" class="btn btn-ghost btn-sm" data-req-open-ref="${esc(r.id)}"><code>${esc(r.referenceId)}</code></button>`
                          : '—'
                      }</td>
                      <td>${fmt(r.createdAt)}</td>
                      ${approvedTab ? `<td>${fmt(r.approvedAt)}</td>` : ''}
                      <td><span class="chip">${esc(displayReqStatus(r))}</span></td>
                      <td>${esc(r.assignedTo || '—')}</td>
                      <td class="posha-req-actions">${primaryReqActionsHtml(r)}</td>
                    </tr>`;
            })
            .join('')}
        </tbody>
      </table></div>`;
  }

  function renderRequestsInbox() {
    if (!cr()) {
      return `<div class="posha-err">وحدة الطلبات المركزية غير محمّلة. حدّث الصفحة.</div>`;
    }
    cr().syncFromModules?.();
    if (state.tab === 'approved' && !['approved', 'paused', 'completed', 'open'].includes(state.reqView)) {
      state.reqView = 'approved';
    }
    const rows = filteredCentralRequests();
    const all = cr().list({});
    const types = [...new Set(all.map((r) => r.requestType).filter(Boolean))];
    const sources = [...new Set(all.map((r) => r.sourceModule).filter(Boolean))];
    const assignees = [...new Set(all.map((r) => r.assignedTo).filter(Boolean))];

    if (state.reqId) return renderRequestDetail(state.reqId);

    const title = state.tab === 'approved' ? 'الطلبات المقبولة' : 'طلبات العملاء';
    return `
      <section class="posha-panel">
        <div class="posha-panel-head">
          <h3>${title}</h3>
          <div class="posha-ws-actions">
            ${state.tab !== 'approved' ? `<button type="button" class="btn btn-primary btn-sm" data-req-create><i class="fas fa-plus"></i> إنشاء طلب</button>` : ''}
          </div>
        </div>
        ${requestsKpisHtml()}
        <div class="posha-filters posha-req-filters">
          <input data-req-filter="q" type="search" placeholder="بحث: Request ID · Article ID · عميل · موضوع · مصدر" value="${esc(state.reqFilters.q)}" />
          <select data-req-filter="status"><option value="">كل الحالات</option>${Object.entries(cr().STATUS_AR || {})
            .map(([k, v]) => `<option value="${esc(k)}" ${state.reqFilters.status === k ? 'selected' : ''}>${esc(v)}</option>`)
            .join('')}</select>
          <select data-req-filter="type"><option value="">نوع الطلب</option>${types.map((t) => `<option value="${esc(t)}" ${state.reqFilters.type === t ? 'selected' : ''}>${esc((cr().TYPE_LABELS_AR || {})[t] || t)}</option>`).join('')}</select>
          <select data-req-filter="source"><option value="">المصدر</option>${sources.map((t) => `<option value="${esc(t)}" ${state.reqFilters.source === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
          <select data-req-filter="assignee"><option value="">المسؤول</option>${assignees.map((t) => `<option value="${esc(t)}" ${state.reqFilters.assignee === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        </div>
        ${
          rows.length
            ? renderRequestsTable(rows)
            : `<p class="posha-ws-empty">لا توجد طلبات في هذا العرض. <button type="button" class="btn btn-ghost btn-sm" data-req-view="all">عرض كل الطلبات</button></p>`
        }
      </section>`;
  }

  function renderRequestDetail(id) {
    const r = cr()?.get(id);
    if (!r) return `<p class="posha-err">الطلب غير موجود</p><button type="button" class="btn btn-ghost" data-req-back>رجوع</button>`;
    cr().markViewed?.(id, actor());
    const tab = state.reqTab;
    const kind = requestKind(r);
    const isArt = kind === 'article';
    const isAd = kind === 'ad';
    const isPlatform = kind === 'platform';
    const art = isArt && r.referenceId ? window.HubArticles?.get?.(r.referenceId) : null;
    const ad = isAd ? findAd(r.referenceId) : null;
    const snap = art || r.articleSnapshot || {};
    const adSnap = ad || r.adSnapshot || {};
    const draft = r.platformDraft || {};
    const platformName =
      r.platformName || draft.name || (isPlatform ? r.referenceId : '') || '';
    const tabs = [
      ['overview', 'نظرة عامة'],
      ['source', 'مصدر الطلب'],
      ...(isArt ? [['article', 'المقال']] : []),
      ...(isAd ? [['ad', 'الإعلان']] : []),
      ...(isPlatform ? [['platform', 'المنصة']] : []),
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
            <li><b>Request ID:</b> <code>${esc(r.requestId || r.id)}</code></li>
            <li><b>النوع:</b> ${esc(r.requestTypeLabel || r.requestType)}</li>
            ${isPlatform ? `<li><b>اسم المنصة:</b> ${esc(platformName || '—')}</li>` : ''}
            <li><b>الموضوع:</b> ${esc(r.title)}</li>
            <li><b>الوصف / سبب الطلب:</b> ${esc(r.description || r.need || '—')}</li>
            ${r.intendedUse ? `<li><b>الاستخدام المطلوب:</b> ${esc(r.intendedUse)}</li>` : ''}
            <li><b>Reference:</b> ${esc(r.referenceType || '—')} · <code>${esc(r.referenceId || '—')}</code></li>
            <li><b>المصدر:</b> ${esc(r.sourceModule || '—')}</li>
            <li><b>تاريخ الطلب:</b> ${fmt(r.createdAt)}</li>
            <li><b>الحالة:</b> ${esc(displayReqStatus(r))}</li>
            <li><b>الأولوية:</b> ${esc(r.priority)}</li>
            ${r.rejectionReason ? `<li><b>سبب الرفض:</b> ${esc(r.rejectionReason)}</li>` : ''}
          </ul>
        </article>
        <article>
          <h4>المسؤولون</h4>
          <ul class="feed">
            <li><b>Assigned To:</b> ${esc(r.assignedTo || '—')}</li>
            <li><b>Department:</b> ${esc(r.department || '—')}</li>
            <li><b>Approved By:</b> ${esc(r.approvedBy || '—')}</li>
            <li><b>Approved At:</b> ${fmt(r.approvedAt)}</li>
            <li><b>Rejected By:</b> ${esc(r.rejectedBy || '—')}</li>
            <li><b>Created By:</b> ${esc(r.createdBy || '—')}</li>
          </ul>
        </article>
      </div>`;
    } else if (tab === 'ad' && isAd) {
      const places = Array.isArray(adSnap.placements) ? adSnap.placements.join(' · ') : '—';
      const media =
        adSnap.mediaDataUrl && adSnap.contentType === 'video'
          ? `<video src="${esc(adSnap.mediaDataUrl)}" controls style="max-width:100%;max-height:280px;border-radius:12px"></video>`
          : adSnap.mediaDataUrl && adSnap.contentType !== 'file'
            ? `<img src="${esc(adSnap.mediaDataUrl)}" alt="" style="max-width:100%;max-height:280px;border-radius:12px;object-fit:contain" />`
            : adSnap.mediaName
              ? `<p><i class="fas fa-paperclip"></i> ${esc(adSnap.mediaName)}</p>`
              : '<p class="posha-muted">لا توجد معاينة وسائط</p>';
      body = `<div class="posha-req-grid">
        <article style="grid-column:1/-1">
          <h4>معاينة الإعلان قبل القرار</h4>
          <div style="margin:10px 0">${media}</div>
          <ul class="feed">
            <li><b>Ad ID:</b> <code>${esc(adSnap.adCode || adSnap.id || r.referenceId || '—')}</code></li>
            <li><b>اسم الإعلان:</b> ${esc(adSnap.title || '—')}</li>
            <li><b>نوع الإعلان:</b> ${esc(adSnap.contentType || '—')}</li>
            <li><b>عنوان الإعلان:</b> ${esc(adSnap.headline || '—')}</li>
            <li><b>النص:</b> ${esc(adSnap.desc || adSnap.bodyText || '—')}</li>
            <li><b>CTA:</b> ${esc(adSnap.ctaLabel || 'بدون')}</li>
            <li><b>Destination URL:</b> ${adSnap.destinationUrl ? `<a href="${esc(adSnap.destinationUrl)}" target="_blank" rel="noopener noreferrer">${esc(adSnap.destinationUrl)}</a>` : '—'}</li>
            <li><b>مكان الظهور:</b> ${esc(places)}</li>
            <li><b>الجمهور:</b> ${esc(adSnap.audience || 'all')}</li>
            <li><b>تاريخ البداية:</b> ${esc(adSnap.adStartDate || 'فور الموافقة')}</li>
            <li><b>تاريخ النهاية:</b> ${esc(adSnap.adEndDate || '—')}</li>
            <li><b>حالة الإعلان:</b> ${esc(adSnap.workflowStatus || adSnap.status || '—')}</li>
          </ul>
          <div class="posha-req-actions" style="margin-top:12px">
            <a class="btn btn-dark btn-sm" href="ads.html" target="_blank" rel="noopener">فتح إدارة الإعلانات</a>
          </div>
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
    } else if (tab === 'platform' && isPlatform) {
      body = `<div class="posha-req-grid">
        <article style="grid-column:1/-1">
          <h4>${r.requestType === 'Platform Add Request' ? 'طلب إضافة منصة' : 'طلب وصول لمنصة'}</h4>
          <ul class="feed">
            <li><b>اسم المنصة:</b> ${esc(platformName || '—')}</li>
            <li><b>رمز / مرجع:</b> <code>${esc(r.referenceId || '—')}</code></li>
            <li><b>نوع الطلب:</b> ${esc(r.requestTypeLabel || r.requestType)}</li>
            <li><b>المصدر:</b> ${esc(r.sourceModule || '—')}</li>
            <li><b>سبب الطلب:</b> ${esc(r.need || r.description || '—')}</li>
            ${r.intendedUse ? `<li><b>الاستخدام المطلوب:</b> ${esc(r.intendedUse)}</li>` : ''}
            ${draft.url ? `<li><b>رابط المنصة:</b> <a href="${esc(draft.url)}" target="_blank" rel="noopener noreferrer">${esc(draft.url)}</a></li>` : ''}
            ${draft.category ? `<li><b>التصنيف:</b> ${esc(draft.category)}</li>` : ''}
            ${draft.summary ? `<li><b>الوصف:</b> ${esc(draft.summary)}</li>` : ''}
            ${draft.notes ? `<li><b>ملاحظات:</b> ${esc(draft.notes)}</li>` : ''}
            <li><b>تاريخ الطلب:</b> ${fmt(r.createdAt)}</li>
            <li><b>الحالة:</b> ${esc(displayReqStatus(r))}</li>
          </ul>
          <div class="posha-req-actions" style="margin-top:12px">
            <a class="btn btn-dark btn-sm" href="platforms.html#platforms-catalog" target="_blank" rel="noopener">فتح صفحة المنصات</a>
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

    const pending = isPendingReq(r);
    const approveLabel =
      kind === 'platform' && r.requestType === 'Platform Access Request'
        ? '✓ منح الوصول'
        : kind === 'platform'
          ? '✓ قبول الطلب'
          : '✓ قبول ونشر';
    const decisionActions = pending
      ? `
        <button type="button" class="btn btn-ghost btn-sm" data-req-reject="${esc(r.id)}">رفض الطلب</button>
        <button type="button" class="btn btn-dark btn-sm" data-req-edit-linked="${esc(r.id)}">طلب معلومات</button>
        <button type="button" class="btn btn-primary btn-sm" data-req-approve="${esc(r.id)}">${approveLabel}</button>
      `
      : primaryReqActionsHtml(r);

    return `
      <div class="posha-req-detail-head">
        <div>
          <button type="button" class="btn btn-ghost btn-sm" data-req-back>← رجوع لصندوق الطلبات</button>
          <h3>${esc(r.requestId || r.id)} · ${esc(r.title)}</h3>
          <span class="chip">${esc(displayReqStatus(r))}</span>
          <span class="chip">${esc(r.priority)}</span>
          <span class="chip">${esc(cr().slaStatus(r))}</span>
        </div>
        <div class="posha-req-actions">${decisionActions}</div>
      </div>
      <div class="posha-subtabs" id="posha-req-tabs">${tabs
        .map(([k, l]) => `<button type="button" class="posha-subtab ${tab === k ? 'is-on' : ''}" data-req-tab="${esc(k)}">${esc(l)}</button>`)
        .join('')}</div>
      <section class="posha-panel">${body}</section>`;
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
        const id = btn.getAttribute('data-req-open');
        state.reqId = id;
        const r = cr()?.get(id);
        const kind = requestKind(r);
        const pref = btn.getAttribute('data-req-tab-pref');
        state.reqTab = pref || (kind === 'ad' ? 'ad' : kind === 'article' ? 'article' : 'overview');
        state.moreId = null;
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-copy-id]').forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-req-copy-id') || '';
        try {
          await navigator.clipboard.writeText(id);
          alert('تم نسخ Request ID');
        } catch (_) {
          window.prompt('انسخ Request ID', id);
        }
        state.moreId = null;
      };
    });
    body.querySelectorAll('[data-req-delete]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-delete');
        if (!window.confirm('حذف / أرشفة هذا الطلب؟ السجل يبقى محفوظاً.')) return;
        cr()?.archiveRequest?.(id, actor()) || cr()?.updateStatus?.(id, 'Archived', actor(), 'حذف');
        state.moreId = null;
        state.reqId = null;
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
    body.querySelectorAll('[data-req-approve], [data-req-approve-publish]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-approve') || btn.getAttribute('data-req-approve-publish');
        const r = cr()?.get(id);
        if (!r) return;
        const kind = requestKind(r);
        const ad = kind === 'ad' ? findAd(r.referenceId) : null;
        const places = Array.isArray(ad?.placements) ? ad.placements.join(' · ') : '—';
        const ok = window.confirm(
          kind === 'ad'
            ? `الموافقة على نشر الإعلان؟\n\nالإعلان: ${ad?.title || r.title || '—'}\nالعميل: ${r.customerName || '—'}\nأماكن الظهور: ${places}\nالبداية: ${ad?.adStartDate || 'فور الموافقة'}\nالنهاية: ${ad?.adEndDate || '—'}`
            : kind === 'event'
              ? `الموافقة على نشر الفعالية؟\n\n${r.title || r.id}\nالعميل: ${r.customerName || '—'}`
              : kind === 'article'
                ? `هل تريد اعتماد ونشر هذا المقال؟\n\nRequest: ${r.id}\nArticle: ${r.referenceId || '—'}\nالعنوان: ${r.title || ''}\nالعميل: ${r.customerName || ''}`
                : kind === 'platform'
                  ? r.requestType === 'Platform Access Request'
                    ? `منح الوصول للمنصة؟\n\nالمنصة: ${r.referenceId || '—'}\nالعميل: ${r.customerName || '—'}\n${r.title || ''}`
                    : `الموافقة على طلب إضافة منصة؟\n\n${r.title || '—'}\nالعميل: ${r.customerName || '—'}`
                  : `الموافقة على الطلب؟\n\n${r.title || r.id}\nالعميل: ${r.customerName || '—'}`
        );
        if (!ok) return;
        const result = cr()?.approveRequest?.(id, actor()) || cr()?.approveAndPublish?.(id, actor());
        if (!result) return alert('تعذر إتمام الموافقة');
        state.tab = 'approved';
        state.reqView = 'approved';
        state.reqId = null;
        state.moreId = null;
        paintBody();
        try {
          document.dispatchEvent(new CustomEvent('posha-counters-refresh'));
        } catch (_) {}
      };
    });
    body.querySelectorAll('[data-req-reject], [data-req-art-reject]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-reject') || btn.getAttribute('data-req-art-reject');
        const r = cr()?.get(id);
        if (!r) return;
        openRejectModal(r);
      };
    });
    body.querySelectorAll('[data-req-open-ref]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-open-ref');
        state.reqId = id;
        const r = cr()?.get(id);
        state.reqTab = requestKind(r) === 'ad' ? 'ad' : requestKind(r) === 'article' ? 'article' : 'overview';
        paintBody();
      };
    });
    body.querySelectorAll('[data-req-edit-linked]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-edit-linked');
        const r = cr()?.get(id);
        if (!r) return;
        if (requestKind(r) === 'ad') {
          window.open('ads.html#wizard', '_blank');
          return;
        }
        if (requestKind(r) === 'article') {
          const artBtn = document.createElement('button');
          artBtn.setAttribute('data-req-art-edit', id);
          body.querySelector('[data-req-art-edit]')?.click?.();
          // fallback prompt edit
          const art = r.referenceId ? window.HubArticles?.get?.(r.referenceId) : null;
          const title = window.prompt('عنوان', art?.title || r.title || '');
          if (title === null) return;
          cr()?.editLinkedArticle?.(id, { title }, actor());
          paintBody();
        }
      };
    });
    body.querySelectorAll('[data-req-pause-linked]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-req-pause-linked');
        const r = cr()?.get(id);
        if (!r) return;
        if (!window.confirm('إيقاف هذا العنصر؟')) return;
        if (requestKind(r) === 'ad' && r.referenceId) {
          window.HubStore?.setAdWorkflowStatus?.(r.referenceId, 'paused', {}, actor());
          cr()?.updateStatus?.(id, 'Unpublished', actor(), 'إيقاف الإعلان');
        } else {
          cr()?.pauseRequest?.(id, actor());
        }
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

  function closeMoreMenu() {
    const panel = document.getElementById('posha-more-panel');
    const toggle = document.getElementById('posha-more-toggle');
    if (panel) panel.hidden = true;
    if (toggle) {
      const moreIds = ['new', 'issues', 'events', 'notifications', 'req-settings'];
      toggle.classList.toggle('is-current', moreIds.includes(state.tab));
      toggle.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  }

  function jumpTab(tab) {
    if (!tab) return;
    state.tab = tab;
    state.reqId = '';
    state.moreId = '';
    if (tab === 'approved') state.reqView = 'approved';
    if (tab === 'orders' && state.reqView === 'approved') state.reqView = 'active';
    if (tab !== 'new') state.statusFilter = '';
    document.querySelectorAll('#posha-subnav [data-ptab]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.ptab === state.tab);
    });
    closeMoreMenu();
    paintBody();
  }

  let _painting = false;
  async function paintBody() {
    if (_painting) return;
    _painting = true;
    const body = document.getElementById('posha-body');
    if (!body) {
      _painting = false;
      return;
    }
    try {
      cr()?.syncFromModules?.();
      window.HubArticles?.linkCustomerRequests?.();
    } catch (_) {}
    const s = state.summary || {};
    const reqK = cr()?.kpis?.() || {};
    const badgeN = reqK.needsAction || reqK.pendingReview || reqK.neu || 0;
    setBadge('badge-new', s.newClients || 0);
    setBadge('badge-support', s.openTickets || state.tickets.length || 0);
    setBadge('badge-orders', badgeN);
    setBadge('badge-issues', s.openIssues || 0);
    setBadge('badge-notif', s.unreadAdminNotifications || 0);

    try {
    if (state.tab === 'overview') {
      body.innerHTML = overviewHtml();
      wireRequestsUi(body);
      body.querySelectorAll('[data-ptab-jump]').forEach((btn) => {
        btn.onclick = () => jumpTab(btn.getAttribute('data-ptab-jump'));
      });
    } else if (state.tab === 'clients' || state.tab === 'new') {
      if (state.tab === 'new') state.statusFilter = state.statusFilter || 'new';
      body.innerHTML = `<section class="posha-panel">
        <div class="posha-panel-head"><h3>${state.tab === 'new' ? 'العملاء الجدد' : 'العملاء'}</h3></div>
        ${filterBar()}
        ${clientsTable(filteredClients())}
      </section>`;
      wireFilters();
    } else if (state.tab === 'support') {
      const openT = state.tickets.filter((t) => !/closed|resolved|مغلق/i.test(String(t.status || '')));
      const closedT = state.tickets.filter((t) => /closed|resolved|مغلق/i.test(String(t.status || '')));
      body.innerHTML = `<section class="posha-panel">
        <div class="posha-panel-head"><h3>الدعم</h3></div>
        <div class="posha-subtabs">
          <div class="posha-subtab is-on"><span>تذاكر مفتوحة</span><strong>${openT.length}</strong></div>
          <div class="posha-subtab"><span>تذاكر مغلقة</span><strong>${closedT.length}</strong></div>
          <div class="posha-subtab"><span>الإجمالي</span><strong>${state.tickets.length}</strong></div>
        </div>
        <ul class="feed">${state.tickets.map((t)=>`<li>
          <b>${esc(t.number||t.id)}</b> — ${esc(t.subject)} · ${esc(t.clientName)} (${esc(t.clientEmail)})
          <span class="chip">${esc(t.status)}</span>
          <button type="button" class="btn btn-ghost btn-sm" data-open-posha="${esc(t.clientEmail)}">فتح العميل</button>
        </li>`).join('') || '<li class="posha-ws-empty">لا تذاكر دعم حالياً.</li>'}</ul>
      </section>`;
    } else if (state.tab === 'orders' || state.tab === 'approved') {
      if (!cr()) {
        body.innerHTML = `<div class="posha-err">تعذر تحميل طلبات العملاء — وحدة HubCustomerRequests غير محمّلة.
          <button type="button" class="btn btn-primary btn-sm" id="posha-retry-orders">إعادة المحاولة</button></div>`;
        document.getElementById('posha-retry-orders')?.addEventListener('click', () => paintBody());
      } else {
        if (state.tab === 'approved' && state.reqView === 'active') state.reqView = 'approved';
        body.innerHTML = renderRequestsInbox();
        wireRequestsUi(body);
      }
    } else if (state.tab === 'req-settings') {
      body.innerHTML = `<section class="posha-panel">${renderReqSettings()}</section>`;
      wireRequestsUi(body);
    } else if (state.tab === 'issues') {
      const sev = (x) => String(x || '').toUpperCase();
      const groups = [
        ['Critical', state.issues.filter((i) => /CRIT/i.test(sev(i.severity)))],
        ['High', state.issues.filter((i) => /HIGH/i.test(sev(i.severity)))],
        ['Medium', state.issues.filter((i) => /MED/i.test(sev(i.severity)))],
        ['Low', state.issues.filter((i) => /LOW/i.test(sev(i.severity)) || !i.severity)],
      ];
      body.innerHTML = `<section class="posha-panel">
        <div class="posha-panel-head"><h3>المشاكل والتنبيهات</h3></div>
        <div class="posha-subtabs">${groups.map(([l, arr]) => `<div class="posha-subtab"><span>${l}</span><strong>${arr.length}</strong></div>`).join('')}</div>
        <ul class="feed">${state.issues.map((i)=>`<li>
        <span class="chip">${esc(i.severity)}</span> <b>${esc(i.title)}</b> — ${esc(i.message)}
        · ${esc(i.clientEmail||'')} · ${esc(i.status)}
        <select data-issue="${esc(i.id)}">
          ${['OPEN','INVESTIGATING','RESOLVED'].map((st)=>`<option ${i.status===st?'selected':''}>${st}</option>`).join('')}
        </select>
        ${i.clientEmail?`<button type="button" class="btn btn-ghost btn-sm" data-open-posha="${esc(i.clientEmail)}">فتح العميل</button>`:''}
      </li>`).join('')||'<li class="posha-ws-empty">لا مشاكل مفتوحة.</li>'}</ul>
      </section>`;
      body.querySelectorAll('[data-issue]').forEach((sel) => {
        sel.onchange = async () => {
          try {
            await api(`/api/admin/posha/issues/${encodeURIComponent(sel.dataset.issue)}/status`, { method: 'POST', body: { status: sel.value } });
            refresh();
          } catch (e) { alert(errText(e)); }
        };
      });
    } else if (state.tab === 'events') {
      body.innerHTML = `<section class="posha-panel">
        <div class="posha-panel-head"><h3>مركز الأحداث</h3></div>
        <div class="posha-filters"><select id="posha-ev-filter">
          <option value="">الكل</option>
          ${['LOGIN','Support','Orders','Payments','Systems','Subscriptions','Security','Account'].map((x)=>`<option>${x}</option>`).join('')}
        </select></div>
        <ul class="feed" id="posha-ev-list">${state.events.slice(0,80).map(evHtml).join('')||'<li>—</li>'}</ul>
      </section>`;
      document.getElementById('posha-ev-filter').onchange = (e) => {
        const v = e.target.value.toUpperCase();
        const list = !v ? state.events : state.events.filter((x) => String(x.type||x.action||'').toUpperCase().includes(v === 'LOGIN' ? 'LOGIN' : v === 'SUPPORT' ? 'TICKET' : v === 'ORDERS' ? 'ORDER' : v === 'PAYMENTS' ? 'PAYMENT' : v === 'SYSTEMS' ? 'SYSTEM' : v === 'SUBSCRIPTIONS' ? 'SUBSCRIPTION' : v === 'SECURITY' ? 'PASSWORD' : 'CLIENT'));
        document.getElementById('posha-ev-list').innerHTML = list.slice(0,80).map(evHtml).join('') || '<li>—</li>';
        wireOpens();
      };
    } else if (state.tab === 'notifications') {
      body.innerHTML = `<section class="posha-panel">
        <div class="posha-panel-head">
          <h3>الإشعارات</h3>
          <button class="btn btn-ghost btn-sm" id="posha-read-all">علم الكل كمقروء</button>
        </div>
        <ul class="feed">${state.notifications.map((n)=>`<li class="${n.is_read?'':'unread'}">
          <b>${esc(n.title)}</b> — ${esc(n.message)} <small>${fmt(n.created_at)}</small>
          ${n.clientEmail?`<button type="button" class="btn btn-primary btn-sm" data-open-posha="${esc(n.clientEmail)}" data-nid="${esc(n.id)}">فتح</button>`:''}
        </li>`).join('')||'<li class="posha-ws-empty">لا إشعارات.</li>'}</ul>
      </section>`;
      document.getElementById('posha-read-all')?.addEventListener('click', async () => {
        try {
          await api('/api/admin/posha/notifications/read', { method: 'POST', body: { all: true } });
          refresh();
        } catch (e) {
          alert(errText(e));
        }
      });
    }
    wireOpens();
    } catch (paintErr) {
      body.innerHTML = `<div class="posha-err">تعذر عرض القسم: ${esc(errText(paintErr))}
        <button type="button" class="btn btn-primary btn-sm" id="posha-retry-paint">إعادة المحاولة</button></div>`;
      document.getElementById('posha-retry-paint')?.addEventListener('click', () => paintBody());
    } finally {
      _painting = false;
    }
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

  let _refreshInFlight = null;
  let _lastApiWarn = '';

  async function refresh() {
    if (_refreshInFlight) return _refreshInFlight;
    const bodyEl = document.getElementById('posha-body');
    if (bodyEl && !state.clients.length && bodyEl.querySelector('.posha-loading')) {
      /* keep initial loader until first paint */
    }
    _refreshInFlight = (async () => {
      let apiWarn = '';
      try {
        const soft = (p) =>
          api(p).catch((e) => {
            apiWarn = apiWarn || errText(e);
            return null;
          });
        const [clients, tickets, events, issues, notifs] = await Promise.all([
          soft('/api/admin/posha/clients'),
          soft('/api/admin/posha/tickets'),
          soft('/api/admin/posha/events'),
          soft('/api/admin/posha/issues'),
          soft('/api/admin/posha/notifications'),
        ]);
        if (clients) {
          state.clients = clients.clients || [];
          state.summary = clients.summary || {};
        } else {
          state.clients = state.clients || [];
          state.summary = state.summary || {};
        }
        state.tickets = tickets?.tickets || state.tickets || [];
        state.events = events?.events || state.events || [];
        state.issues = issues?.issues || state.issues || [];
        state.notifications = notifs?.notifications || state.notifications || [];
        _lastApiWarn = apiWarn;
        await paintBody();
        if (apiWarn && bodyEl) {
          const warn = document.createElement('p');
          warn.className = 'posha-err';
          const soft =
            /path could not be found|404|Not Found|انتهت مهلة/i.test(apiWarn)
              ? 'تعذر الاتصال بخادم بوشا (API غير متاح حالياً)'
              : apiWarn;
          warn.textContent = `${soft} — صندوق الطلبات المركزية متاح محلياً.`;
          const body = document.getElementById('posha-body');
          if (body && !body.querySelector('.posha-err')) body.prepend(warn);
        }
        updateTopBell(state.summary.unreadAdminNotifications || notifs?.unread || 0);
      } catch (e) {
        state.clients = state.clients || [];
        state.summary = state.summary || {};
        state.tickets = state.tickets || [];
        state.events = state.events || [];
        state.issues = state.issues || [];
        state.notifications = state.notifications || [];
        try {
          await paintBody();
        } catch (_) {}
        const body = document.getElementById('posha-body');
        if (body && !body.querySelector('.posha-err')) {
          const warn = document.createElement('p');
          warn.className = 'posha-err';
          warn.textContent = `${errText(e)} — صندوق الطلبات المركزية متاح محلياً.`;
          body.prepend(warn);
        }
      } finally {
        _refreshInFlight = null;
        const still = document.getElementById('posha-body');
        if (still?.querySelector('.posha-loading')) {
          try {
            await paintBody();
          } catch (_) {
            still.innerHTML = `<div class="posha-err">تعذر تحميل الصفحة.
              <button type="button" class="btn btn-primary btn-sm" id="posha-retry-refresh">إعادة المحاولة</button></div>`;
            document.getElementById('posha-retry-refresh')?.addEventListener('click', () => refresh());
          }
        }
      }
    })();
    return _refreshInFlight;
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
    const keepTab = state.tab || 'overview';
    root.innerHTML = shell();
    state.tab = keepTab;
    document.querySelectorAll('#posha-subnav [data-ptab]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.ptab === state.tab);
    });
    document.getElementById('posha-refresh').onclick = () => refresh();
    document.getElementById('posha-more-toggle')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const panel = document.getElementById('posha-more-panel');
      const toggle = e.currentTarget;
      if (!panel) return;
      const willOpen = panel.hidden;
      panel.hidden = !willOpen;
      toggle.classList.toggle('is-open', willOpen);
      toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
    if (!mount._moreOutside) {
      mount._moreOutside = true;
      document.addEventListener('click', (e) => {
        if (!document.getElementById('posha-ops')) return;
        if (e.target.closest('.posha-more')) return;
        closeMoreMenu();
      });
    }
    document.getElementById('posha-subnav').onclick = (e) => {
      const btn = e.target.closest('[data-ptab]');
      if (!btn) return;
      jumpTab(btn.dataset.ptab);
    };
    closeMoreMenu();
    if (!mount._crListen) {
      mount._crListen = true;
      window.addEventListener('hub-customer-requests-changed', () => {
        if (!document.getElementById('posha-ops')) return;
        if (_painting || _refreshInFlight) {
          const reqK = cr()?.kpis?.() || {};
          setBadge('badge-orders', reqK.needsAction || reqK.pendingReview || reqK.neu || 0);
          return;
        }
        const reqK = cr()?.kpis?.() || {};
        const n = reqK.needsAction || reqK.pendingReview || reqK.neu || 0;
        setBadge('badge-orders', n);
        if (state.tab === 'orders' || state.tab === 'approved' || state.tab === 'overview' || state.tab === 'req-settings') paintBody();
      });
    }
    refresh();
    if (!mount._poll) {
      mount._poll = setInterval(() => {
        if (!document.getElementById('posha-ops')) return;
        if (_refreshInFlight) return;
        refresh().catch(() => {});
      }, 30000);
    }
  }

  window.HubPoshaClients = { mount, refresh, open360, state };
})();
