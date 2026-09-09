/**
 * POSHA Company Operating System — staff shell (distinct from Hub ops room & Client Portal)
 */
(function () {
  'use strict';

  var NAV = [
    { group: 'الرئيسية' },
    { id: 'command', label: 'مركز القيادة', icon: 'fa-gauge-high' },
    { group: 'العملاء' },
    { id: 'clients', label: 'جميع العملاء', icon: 'fa-users' },
    { group: 'التجارة' },
    { id: 'catalog', label: 'المتجر / الكتالوج', icon: 'fa-store' },
    { group: 'خدمة العملاء' },
    { id: 'inbox', label: 'صندوق العملاء', icon: 'fa-inbox' },
    { id: 'requests', label: 'طلبات الخدمة', icon: 'fa-clipboard-list' },
    { id: 'complaints', label: 'الشكاوى', icon: 'fa-triangle-exclamation' },
    { group: 'العمل' },
    { id: 'tasks', label: 'المهام', icon: 'fa-list-check' },
    { group: 'التشغيل' },
    { id: 'issues', label: 'المشاكل والتنبيهات', icon: 'fa-bolt' },
    { id: 'events', label: 'مركز الأحداث', icon: 'fa-timeline' },
    { group: 'الإدارة' },
    { id: 'reports', label: 'التقارير', icon: 'fa-chart-column' },
    { id: 'search', label: 'بحث شامل', icon: 'fa-magnifying-glass' },
    { id: 'map', label: 'خريطة النظام', icon: 'fa-sitemap' }
  ];

  var TITLES = {
    command: ['مركز القيادة', 'ماذا يحدث الآن وما الذي يحتاج تدخلًا'],
    clients: ['العملاء', 'CRM داخل بوشا · دورة الحياة · الصحة'],
    catalog: ['المتجر والكتالوج', 'منتجات · خدمات · أنظمة · حزم'],
    inbox: ['صندوق العملاء', 'كل ما يحتاج تدخلًا بشريًا'],
    requests: ['طلبات الخدمة', 'منفصلة عن تذاكر الدعم'],
    complaints: ['الشكاوى', 'متابعة وحل'],
    tasks: ['المهام', 'تعيين ومتابعة'],
    issues: ['المشاكل والتنبيهات', 'تنبيهات تشغيلية'],
    events: ['مركز الأحداث', 'سجل الأحداث المركزية'],
    reports: ['التقارير', 'أرقام حقيقية من البيانات'],
    search: ['بحث شامل', 'عملاء · طلبات · تذاكر · فواتير'],
    map: ['خريطة النظام', 'HUB → POSHA → Modules']
  };

  var state = { page: 'command', cache: {} };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function toast(msg) {
    var el = $('pos-toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 2600);
  }
  function authHeaders() {
    var t = window.HubAuth && HubAuth.getToken ? HubAuth.getToken() : '';
    var u = window.HubAuth && HubAuth.getUser ? HubAuth.getUser() : {};
    return {
      Authorization: 'Bearer ' + t,
      'Content-Type': 'application/json',
      'X-Hub-Token': t,
      'X-Hub-User-Role': u.role || '',
      'X-Hub-User-Email': u.email || '',
      'X-Hub-User-Name': u.name || ''
    };
  }
  async function api(path, opts) {
    var res = await fetch(path, Object.assign({ headers: authHeaders() }, opts || {}));
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  }
  function fmt(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleString('ar'); } catch (e) { return String(d); }
  }
  function badge(status) {
    var s = String(status || '').toUpperCase();
    var cls = 'info';
    if (['OPEN', 'NEW', 'URGENT', 'CRITICAL', 'AT_RISK', 'FAILED'].some(function (x) { return s.indexOf(x) >= 0; })) cls = '';
    if (['DONE', 'COMPLETED', 'RESOLVED', 'CLOSED', 'ACTIVE', 'EXCELLENT', 'PAID'].some(function (x) { return s.indexOf(x) >= 0; })) cls = 'ok';
    if (['WAITING', 'ASSIGNED', 'IN_PROGRESS', 'GOOD', 'NEEDS', 'WARNING'].some(function (x) { return s.indexOf(x) >= 0; })) cls = 'warn';
    return '<span class="pos-badge ' + cls + '">' + esc(status || '—') + '</span>';
  }

  function buildNav() {
    var html = '';
    NAV.forEach(function (n) {
      if (n.group) {
        html += '<div class="pos-group">' + esc(n.group) + '</div>';
        return;
      }
      html += '<a href="#' + n.id + '" data-nav="' + n.id + '"><i class="fas ' + n.icon + '"></i>' + esc(n.label) + '</a>';
    });
    $('pos-nav').innerHTML = html;
    $('pos-nav').onclick = function (e) {
      var a = e.target.closest('a[data-nav]');
      if (!a) return;
      e.preventDefault();
      go(a.getAttribute('data-nav'));
      document.body.classList.remove('pos-nav-open');
    };
  }

  function go(page) {
    state.page = TITLES[page] ? page : 'command';
    location.hash = state.page;
    var t = TITLES[state.page];
    $('pos-title').textContent = t[0];
    $('pos-sub').textContent = t[1];
    document.querySelectorAll('#pos-nav a').forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('data-nav') === state.page);
    });
    render();
  }

  function renderCommand(cmd) {
    var s = (cmd && cmd.summary) || {};
    return '<div class="pos-kpis">' +
      '<article><span>طلبات معلّقة</span><strong>' + esc((cmd.pendingOrders || []).length) + '</strong></article>' +
      '<article><span>تذاكر مفتوحة</span><strong>' + esc((cmd.openTickets || []).length) + '</strong></article>' +
      '<article><span>صندوق جديد</span><strong>' + esc((cmd.inboxNew || []).length) + '</strong></article>' +
      '<article><span>مشاكل مفتوحة</span><strong>' + esc((cmd.openIssues || []).length) + '</strong></article>' +
      '</div>' +
      '<div class="pos-grid-2">' +
        '<section class="pos-card"><h3>اعتماد عملاء جدد</h3><div class="pos-list">' +
          ((cmd.pendingApproval || []).length ? cmd.pendingApproval.map(function (c) {
            return '<div class="pos-row"><div><strong>' + esc(c.name) + '</strong><small>' + esc(c.email) + '</small></div>' +
              '<div class="pos-actions"><button type="button" class="pos-btn primary" data-approve="' + esc(c.email) + '">اعتماد</button></div></div>';
          }).join('') : '<p class="pos-muted">لا عملاء بانتظار الاعتماد</p>') +
        '</div></section>' +
        '<section class="pos-card"><h3>مطلوب اليوم</h3><div class="pos-list">' +
          ((cmd.overdueTasks || []).length ? cmd.overdueTasks.map(function (t) {
            return '<div class="pos-row"><div><strong>' + esc(t.title) + '</strong><small>' + esc(t.related_client || '') + '</small></div>' + badge(t.priority) + '</div>';
          }).join('') : '<p class="pos-muted">لا مهام متأخرة</p>') +
        '</div></section>' +
        '<section class="pos-card"><h3>تجديدات قريبة</h3><div class="pos-list">' +
          ((cmd.renewals || []).length ? cmd.renewals.map(function (r) {
            return '<div class="pos-row"><div><strong>' + esc(r.systemName) + '</strong><small>' + esc(r.clientName) + ' · ' + esc(r.status || '') + ' · ' + esc(fmt(r.renewsAt)) + '</small></div></div>';
          }).join('') : '<p class="pos-muted">لا تجديدات خلال 30 يومًا</p>') +
        '</div></section>' +
      '</div>' +
      '<section class="pos-card"><h3>ملخص CRM</h3><p class="pos-muted">عملاء: ' + esc(s.totalClients || 0) +
        ' · نشط: ' + esc(s.activeClients || 0) +
        ' · تذاكر مفتوحة: ' + esc(s.openTickets || 0) +
        ' · مشاكل: ' + esc(s.openIssues || 0) +
        '</p><div class="pos-actions" style="margin-top:10px"><button type="button" class="pos-btn" id="pos-run-sweep">تشغيل فحص الاشتراكات/SLA</button></div></section>';
  }

  function renderClients(list) {
    return '<section class="pos-card"><h3>عملاء بوشا</h3>' +
      '<div class="pos-table-wrap"><table class="pos-table"><thead><tr>' +
      '<th>العميل</th><th>الحالة</th><th>Lifecycle</th><th>Health</th><th>تهيئة</th><th>أنظمة</th><th>طلبات</th><th>شكاوى</th><th></th>' +
      '</tr></thead><tbody>' +
      (list || []).map(function (c) {
        return '<tr>' +
          '<td><strong>' + esc(c.name) + '</strong><br><small>' + esc(c.email) + '</small></td>' +
          '<td>' + badge(c.status) + '</td>' +
          '<td>' + esc(c.lifecycle || '—') + '</td>' +
          '<td>' + badge(c.health || '—') + '<br><small>' + esc((c.healthReasons || []).join(' · ')) + '</small></td>' +
          '<td>' + esc((c.onboardingPercent || 0) + '%') + '</td>' +
          '<td>' + esc(c.systemsCount != null ? c.systemsCount : (c.systems || 0)) + '</td>' +
          '<td>' + esc(c.openRequests || 0) + '</td>' +
          '<td>' + esc(c.openComplaints || 0) + '</td>' +
          '<td class="pos-actions">' +
            (c.status === 'pending' ? '<button type="button" class="pos-btn primary" data-approve="' + esc(c.email) + '">اعتماد</button>' : '') +
            '<a class="pos-btn" href="dashboard.html#posha-clients" target="_blank">360</a>' +
          '</td></tr>';
      }).join('') +
      '</tbody></table></div></section>';
  }

  function renderCatalog(items) {
    return '<section class="pos-card"><h3>كتالوج المتجر</h3><div class="pos-list">' +
      (items || []).map(function (i) {
        return '<div class="pos-row"><div><strong>' + esc(i.name) + '</strong><small>' + esc(i.type) + ' · ' + esc(i.description) + '</small></div>' +
          '<div><strong>' + esc(i.price) + ' ' + esc(i.currency || 'USD') + '</strong><br>' + badge(i.available === false ? 'غير متاح' : 'متاح') + '</div></div>';
      }).join('') +
      '</div></section>';
  }

  function renderInbox(list) {
    return '<section class="pos-card"><h3>صندوق العملاء</h3><div class="pos-list" id="pos-inbox-list">' +
      ((list || []).length ? list.map(function (i) {
        return '<div class="pos-row" data-inbox="' + esc(i.id) + '"><div><strong>' + esc(i.title) + '</strong>' +
          '<small>' + esc(i.kind) + ' · ' + esc(i.clientName || i.clientEmail) + ' · ' + esc(i.ref || '') + '</small></div>' +
          '<div>' + badge(i.status) +
          '<div class="pos-actions">' +
          '<button type="button" class="pos-btn primary" data-assign="' + esc(i.id) + '">تعيين لي</button>' +
          '<button type="button" class="pos-btn" data-inbox-resolve="' + esc(i.id) + '">حل</button>' +
          (i.clientEmail ? '<a class="pos-btn" href="dashboard.html#posha-clients" target="_blank">العميل</a>' : '') +
          (i.related_entity_type === 'request' ? '<button type="button" class="pos-btn" data-nav-jump="requests">الطلب</button>' : '') +
          (i.related_entity_type === 'complaint' ? '<button type="button" class="pos-btn" data-nav-jump="complaints">الشكوى</button>' : '') +
          '</div></div></div>';
      }).join('') : '<p class="pos-muted">الصندوق فارغ</p>') +
      '</div></section>';
  }

  function renderRequests(list) {
    return '<section class="pos-card"><h3>طلبات الخدمة</h3><div class="pos-list">' +
      ((list || []).length ? list.map(function (r) {
        return '<div class="pos-row"><div><strong>' + esc(r.number) + ' — ' + esc(r.subject) + '</strong>' +
          '<small>' + esc(r.clientName || r.clientEmail) + ' · ' + esc(r.type) + '</small></div>' +
          '<div>' + badge(r.status) +
          '<div class="pos-actions">' +
          '<button type="button" class="pos-btn" data-req="' + esc(r.id) + '" data-st="UNDER_REVIEW">مراجعة</button>' +
          '<button type="button" class="pos-btn primary" data-req="' + esc(r.id) + '" data-st="IN_PROGRESS">تنفيذ</button>' +
          '<button type="button" class="pos-btn" data-req="' + esc(r.id) + '" data-st="COMPLETED">إكمال</button>' +
          '</div></div></div>';
      }).join('') : '<p class="pos-muted">لا طلبات خدمة</p>') +
      '</div></section>';
  }

  function renderComplaints(list) {
    return '<section class="pos-card"><h3>الشكاوى</h3><div class="pos-list">' +
      ((list || []).length ? list.map(function (c) {
        return '<div class="pos-row"><div><strong>' + esc(c.number) + ' — ' + esc(c.subject) + '</strong>' +
          '<small>' + esc(c.clientName || c.clientEmail) + ' · ' + esc(c.category) + '</small></div>' +
          '<div>' + badge(c.status) +
          '<div class="pos-actions">' +
          '<button type="button" class="pos-btn" data-cmp="' + esc(c.id) + '" data-st="IN_PROGRESS">متابعة</button>' +
          '<button type="button" class="pos-btn primary" data-cmp="' + esc(c.id) + '" data-st="RESOLVED">حل</button>' +
          '</div></div></div>';
      }).join('') : '<p class="pos-muted">لا شكاوى</p>') +
      '</div></section>';
  }

  function renderTasks(list) {
    return '<section class="pos-card"><h3>المهام</h3><div class="pos-list">' +
      ((list || []).length ? list.map(function (t) {
        return '<div class="pos-row"><div><strong>' + esc(t.title) + '</strong><small>استحقاق: ' + esc(fmt(t.due_date)) + ' · ' + esc(t.related_client || '') + ' · ' + esc(t.assigned_to || 'غير معيّن') + '</small></div>' +
          '<div>' + badge(t.status) +
          '<div class="pos-actions">' +
          '<button type="button" class="pos-btn" data-task-assign="' + esc(t.id) + '">تعيين لي</button>' +
          '<button type="button" class="pos-btn primary" data-task-done="' + esc(t.id) + '">إكمال</button>' +
          '</div></div></div>';
      }).join('') : '<p class="pos-muted">لا مهام</p>') +
      '</div></section>';
  }

  function renderReports(r) {
    r = r || {};
    function block(title, obj) {
      return '<section class="pos-card"><h3>' + esc(title) + '</h3><ul>' +
        Object.keys(obj || {}).map(function (k) {
          return '<li><strong>' + esc(k) + '</strong>: ' + esc(typeof obj[k] === 'object' ? JSON.stringify(obj[k]) : obj[k]) + '</li>';
        }).join('') + '</ul></section>';
    }
    return '<div class="pos-grid-2">' +
      block('العملاء', r.clients) +
      block('الطلبات', r.orders) +
      block('الإيرادات', r.revenue) +
      block('الاشتراكات', r.subscriptions) +
      block('الدعم', r.support) +
      block('المحفظة', r.wallet) +
      block('المهام', r.tasks) +
      block('المشاكل', r.issues) +
      '</div>';
  }

  function renderSearch() {
    return '<section class="pos-card"><h3>بحث شامل</h3>' +
      '<div class="pos-actions" style="margin-bottom:12px">' +
      '<input id="pos-q" placeholder="#ORD-1054 أو بريد أو Client ID" style="flex:1;min-width:200px;padding:8px 10px" />' +
      '<button type="button" class="pos-btn primary" id="pos-search-btn">بحث</button></div>' +
      '<div id="pos-search-results"><p class="pos-muted">اكتب ثم اضغط بحث</p></div></section>';
  }

  function renderIssues(list) {
    return '<section class="pos-card"><h3>المشاكل</h3><div class="pos-list">' +
      ((list || []).length ? list.map(function (i) {
        return '<div class="pos-row"><div><strong>' + esc(i.title) + '</strong><small>' + esc(i.message) + '</small></div>' + badge(i.severity) + '</div>';
      }).join('') : '<p class="pos-muted">لا مشاكل مفتوحة</p>') +
      '</div></section>';
  }

  function renderEvents(list) {
    return '<section class="pos-card"><h3>الأحداث</h3><div class="pos-list">' +
      ((list || []).slice(0, 40).map(function (e) {
        return '<div class="pos-row"><div><strong>' + esc(e.title || e.type || e.action) + '</strong>' +
          '<small>' + esc(e.clientEmail || '') + ' · ' + esc(fmt(e.at || e.created_at)) + '</small></div>' + badge(e.type || e.action) + '</div>';
      }).join('') || '<p class="pos-muted">لا أحداث</p>') +
      '</div></section>';
  }

  function renderMap(map) {
    map = map || {};
    function col(title, items) {
      return '<section class="pos-card"><h3>' + esc(title) + '</h3><ul>' +
        (items || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') +
        '</ul></section>';
    }
    return '<div class="pos-grid-2">' +
      col('NAIOSH HUB 360', map.hub) +
      col('POSHA Company OS', map.posha) +
      col('Client Portal', map.clientPortal) +
      '</div>';
  }

  async function loadPage() {
    var page = state.page;
    if (page === 'command') return api('/api/admin/posha/os/command').then(function (d) { return renderCommand(d.command); });
    if (page === 'clients') return api('/api/admin/posha/os/clients').then(function (d) { return renderClients(d.clients); });
    if (page === 'catalog') return api('/api/admin/posha/os/catalog').then(function (d) { return renderCatalog(d.items); });
    if (page === 'inbox') return api('/api/admin/posha/os/inbox').then(function (d) { return renderInbox(d.inbox); });
    if (page === 'requests') return api('/api/admin/posha/os/requests').then(function (d) { return renderRequests(d.requests); });
    if (page === 'complaints') return api('/api/admin/posha/os/complaints').then(function (d) { return renderComplaints(d.complaints); });
    if (page === 'tasks') return api('/api/admin/posha/os/tasks').then(function (d) { return renderTasks(d.tasks); });
    if (page === 'issues') return api('/api/admin/posha/issues').then(function (d) { return renderIssues(d.issues); });
    if (page === 'events') return api('/api/admin/posha/events').then(function (d) { return renderEvents(d.events || d.activity); });
    if (page === 'reports') return api('/api/admin/posha/os/reports').then(function (d) { return renderReports(d.reports); });
    if (page === 'search') return Promise.resolve(renderSearch());
    if (page === 'map') return api('/api/admin/posha/os/map').then(function (d) { return renderMap(d.map); });
    return Promise.resolve('<p class="pos-err">صفحة غير معروفة</p>');
  }

  async function render() {
    var root = $('pos-root');
    root.innerHTML = '<p class="pos-muted">جاري التحميل…</p>';
    try {
      root.innerHTML = await loadPage();
      bindActions();
    } catch (e) {
      root.innerHTML = '<p class="pos-err">' + esc(e.message) + '</p>';
    }
  }

  function bindActions() {
    document.querySelectorAll('[data-assign]').forEach(function (btn) {
      btn.onclick = async function () {
        try {
          await api('/api/admin/posha/os/inbox/' + btn.getAttribute('data-assign') + '/assign', {
            method: 'POST',
            body: JSON.stringify({})
          });
          toast('تم التعيين');
          render();
        } catch (e) { toast(e.message); }
      };
    });
    document.querySelectorAll('[data-inbox-resolve]').forEach(function (btn) {
      btn.onclick = async function () {
        try {
          await api('/api/admin/posha/os/inbox/' + btn.getAttribute('data-inbox-resolve') + '/status', {
            method: 'POST',
            body: JSON.stringify({ status: 'RESOLVED' })
          });
          toast('تم حل العنصر');
          render();
        } catch (e) { toast(e.message); }
      };
    });
    document.querySelectorAll('[data-nav-jump]').forEach(function (btn) {
      btn.onclick = function () { go(btn.getAttribute('data-nav-jump')); };
    });
    document.querySelectorAll('[data-req]').forEach(function (btn) {
      btn.onclick = async function () {
        try {
          await api('/api/admin/posha/os/requests/' + btn.getAttribute('data-req') + '/status', {
            method: 'POST',
            body: JSON.stringify({ status: btn.getAttribute('data-st') })
          });
          toast('تم تحديث الطلب');
          render();
        } catch (e) { toast(e.message); }
      };
    });
    document.querySelectorAll('[data-cmp]').forEach(function (btn) {
      btn.onclick = async function () {
        try {
          await api('/api/admin/posha/os/complaints/' + btn.getAttribute('data-cmp') + '/status', {
            method: 'POST',
            body: JSON.stringify({ status: btn.getAttribute('data-st') })
          });
          toast('تم تحديث الشكوى');
          render();
        } catch (e) { toast(e.message); }
      };
    });
    document.querySelectorAll('[data-task-assign]').forEach(function (btn) {
      btn.onclick = async function () {
        try {
          await api('/api/admin/posha/os/tasks/' + btn.getAttribute('data-task-assign') + '/assign', {
            method: 'POST',
            body: JSON.stringify({})
          });
          toast('تم تعيين المهمة');
          render();
        } catch (e) { toast(e.message); }
      };
    });
    document.querySelectorAll('[data-task-done]').forEach(function (btn) {
      btn.onclick = async function () {
        try {
          await api('/api/admin/posha/os/tasks/' + btn.getAttribute('data-task-done') + '/status', {
            method: 'POST',
            body: JSON.stringify({ status: 'DONE' })
          });
          toast('اكتملت المهمة');
          render();
        } catch (e) { toast(e.message); }
      };
    });
    document.querySelectorAll('[data-approve]').forEach(function (btn) {
      btn.onclick = async function () {
        try {
          await api('/api/admin/clients/' + encodeURIComponent(btn.getAttribute('data-approve')) + '/status', {
            method: 'POST',
            body: JSON.stringify({ status: 'active' })
          });
          toast('تم اعتماد العميل');
          render();
        } catch (e) { toast(e.message); }
      };
    });
    var sweep = $('pos-run-sweep');
    if (sweep) {
      sweep.onclick = async function () {
        try {
          var d = await api('/api/admin/posha/os/sweep', { method: 'POST', body: JSON.stringify({}) });
          toast('فحص: اشتراكات ' + ((d.subscriptions && d.subscriptions.changed) || 0) + ' · SLA ' + ((d.sla && d.sla.changed) || 0));
          render();
        } catch (e) { toast(e.message); }
      };
    }
    var sbtn = $('pos-search-btn');
    if (sbtn) {
      sbtn.onclick = async function () {
        var q = ($('pos-q') && $('pos-q').value) || '';
        try {
          var d = await api('/api/admin/posha/os/search?q=' + encodeURIComponent(q));
          var r = d.results || {};
          var html = '';
          function sec(title, items, fmtItem) {
            html += '<h4>' + esc(title) + '</h4><div class="pos-list">';
            if (!(items || []).length) html += '<p class="pos-muted">لا نتائج</p>';
            else html += items.map(fmtItem).join('');
            html += '</div>';
          }
          sec('عملاء', r.clients, function (c) {
            return '<div class="pos-row"><div><strong>' + esc(c.name) + '</strong><small>' + esc(c.email) + ' · ' + esc(c.clientId) + '</small></div>' + badge(c.status) + '</div>';
          });
          sec('طلبات', r.orders, function (o) {
            return '<div class="pos-row"><div><strong>' + esc(o.number) + '</strong><small>' + esc(o.clientEmail) + '</small></div>' + badge(o.status) + '</div>';
          });
          sec('تذاكر', r.tickets, function (t) {
            return '<div class="pos-row"><div><strong>' + esc(t.number || t.id) + '</strong><small>' + esc(t.subject) + '</small></div>' + badge(t.status) + '</div>';
          });
          sec('فواتير', r.invoices, function (i) {
            return '<div class="pos-row"><div><strong>' + esc(i.number) + '</strong><small>' + esc(i.clientEmail) + '</small></div>' + badge(i.status) + '</div>';
          });
          $('pos-search-results').innerHTML = html;
        } catch (e) { toast(e.message); }
      };
    }
  }

  function boot() {
    if (!window.HubAuth || !HubAuth.requireLogin()) return;
    if (HubAuth.isClient && HubAuth.isClient()) {
      location.replace('client.html');
      return;
    }
    if (!HubAuth.isStaff || !HubAuth.isStaff()) {
      location.replace('login.html');
      return;
    }
    var u = HubAuth.getUser() || {};
    $('pos-user-name').textContent = u.name || u.email || '—';
    $('pos-user-role').textContent = u.role || 'staff';
    buildNav();
    var hash = (location.hash || '#command').replace('#', '') || 'command';
    go(hash);
    $('pos-menu').onclick = function () { document.body.classList.toggle('pos-nav-open'); };
    $('pos-logout').onclick = function () {
      if (HubAuth.clearSession) HubAuth.clearSession();
      location.href = 'login.html';
    };
    window.addEventListener('hashchange', function () {
      go((location.hash || '#command').replace('#', ''));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
