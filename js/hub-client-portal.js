/**
 * مركز العميل | Naiosh Hub — Client Portal SPA
 * Uses client.html shell + /api/client/* (ownership from session token).
 */
(function () {
  'use strict';

  var NAV = [
    { id: 'home', label: 'الرئيسية', icon: 'fa-house' },
    { id: 'systems', label: 'أنظمتي', icon: 'fa-cubes' },
    { id: 'orders', label: 'طلباتي', icon: 'fa-receipt' },
    { id: 'subscriptions', label: 'اشتراكاتي', icon: 'fa-rotate' },
    { id: 'wallet', label: 'المحفظة', icon: 'fa-wallet' },
    { id: 'invoices', label: 'الفواتير', icon: 'fa-file-invoice' },
    { id: 'support', label: 'الدعم', icon: 'fa-headset' },
    { id: 'notifications', label: 'الإشعارات', icon: 'fa-bell' },
    { id: 'marketplace', label: 'استكشف الخدمات', icon: 'fa-store' },
    { id: 'profile', label: 'حسابي', icon: 'fa-user' },
    { id: 'security', label: 'الأمان', icon: 'fa-shield-halved' }
  ];

  var TITLES = {
    home: ['الرئيسية', 'حسابك وخدماتك في مكان واحد'],
    systems: ['أنظمتي', 'الأنظمة والخدمات المرتبطة بحسابك'],
    orders: ['طلباتي', 'تتبع حالة طلباتك'],
    subscriptions: ['اشتراكاتي', 'الباقات والتجديد'],
    wallet: ['المحفظة', 'رصيدك ونقاطك'],
    invoices: ['الفواتير والمدفوعات', 'الفواتير والمدفوعات الخاصة بك'],
    support: ['مركز الدعم', 'تذاكر ومساعدة'],
    notifications: ['الإشعارات', 'تنبيهات حسابك'],
    marketplace: ['استكشف الخدمات', 'منتجات وأنظمة نايوش'],
    profile: ['حسابي', 'بياناتك الشخصية'],
    security: ['الأمان', 'كلمة المرور والجلسات']
  };

  var STATUS_AR = {
    active: 'نشط',
    pending: 'قيد الانتظار',
    expired: 'منتهي',
    suspended: 'موقوف',
    under_setup: 'قيد الإعداد',
    pending_review: 'قيد المراجعة',
    approved: 'مقبول',
    in_progress: 'قيد التنفيذ',
    completed: 'مكتمل',
    rejected: 'مرفوض',
    cancelled: 'ملغى',
    open: 'مفتوحة',
    OPEN: 'مفتوحة',
    IN_PROGRESS: 'قيد المعالجة',
    WAITING_FOR_CLIENT: 'بانتظار ردك',
    RESOLVED: 'تم الحل',
    CLOSED: 'مغلقة',
    waiting_customer: 'بانتظار ردك',
    resolved: 'تم الحل',
    closed: 'مغلقة',
    paid: 'مدفوعة',
    unpaid: 'غير مدفوعة',
    overdue: 'متأخرة',
    refunded: 'مسترجعة',
    medium: 'متوسطة',
    NORMAL: 'عادية',
    HIGH: 'عالية',
    LOW: 'منخفضة',
    URGENT: 'عاجلة',
    high: 'عالية',
    low: 'منخفضة',
    normal: 'عادية'
  };

  var state = { home: null, page: 'home', cache: {} };

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function statusLabel(s) {
    return STATUS_AR[String(s || '').toLowerCase()] || s || '—';
  }

  function statusMod(s) {
    var v = String(s || '').toLowerCase();
    if (['active', 'paid', 'completed', 'approved', 'resolved', 'done'].indexOf(v) >= 0) return '';
    if (['pending', 'under_setup', 'in_progress', 'open', 'waiting_customer', 'unpaid', 'current'].indexOf(v) >= 0) return 'is-warn';
    return 'is-off';
  }

  function money(n, cur) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    return v.toLocaleString('ar-SA') + (cur === 'USD' ? ' $' : ' ر.س');
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return String(iso).slice(0, 10);
    }
  }

  function getUser() {
    try {
      if (window.HubAuth && typeof HubAuth.getUser === 'function') return HubAuth.getUser();
    } catch (e) {}
    try {
      return JSON.parse(localStorage.getItem('hubUser') || sessionStorage.getItem('hubUser') || 'null');
    } catch (e2) {
      return null;
    }
  }

  function getToken() {
    try {
      if (window.HubAuth && typeof HubAuth.getToken === 'function') return HubAuth.getToken();
    } catch (e) {}
    return localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || '';
  }

  function authHeaders() {
    var user = getUser() || {};
    var h = { Accept: 'application/json', 'Content-Type': 'application/json' };
    var token = getToken();
    if (token) h.Authorization = 'Bearer ' + token;
    if (user.role) h['X-Hub-User-Role'] = String(user.role);
    if (user.email) h['X-Hub-User-Email'] = String(user.email);
    if (user.name) {
      try { h['X-Hub-User-Name'] = encodeURIComponent(String(user.name)); } catch (e) {}
    }
    return h;
  }

  function toast(msg) {
    var el = $('cp-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2800);
  }

  function logout() {
    try {
      if (window.HubAuth && HubAuth.clearSession) HubAuth.clearSession();
      else {
        localStorage.removeItem('hubAuthToken');
        localStorage.removeItem('hubUser');
        sessionStorage.removeItem('hubAuthToken');
        sessionStorage.removeItem('hubUser');
      }
    } catch (e) {}
    window.location.href = 'login.html';
  }

  function ensureClient() {
    var token = getToken();
    var user = getUser();
    if (!token || !user) {
      window.location.href = 'login.html?next=' + encodeURIComponent('client.html');
      return false;
    }
    var role = String(user.role || '').toLowerCase();
    if (role === 'supreme_leader' || role === 'chief_engineer' || role === 'admin' || role === 'super_admin') {
      window.location.href = 'dashboard.html';
      return false;
    }
    if (role !== 'customer' && role !== 'client' && role !== 'platform_owner' && role !== 'client_user') {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  async function api(path, options) {
    var opts = options || {};
    var res = await fetch(path, {
      method: opts.method || 'GET',
      headers: authHeaders(),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin'
    });
    var data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (res.status === 401) {
      logout();
      throw new Error('انتهت الجلسة');
    }
    if (res.status === 403) throw new Error(data.error || 'غير مصرح');
    if (!res.ok || data.ok === false) throw new Error(data.error || data.message || ('HTTP ' + res.status));
    return data;
  }

  function pageId() {
    var h = (location.hash || '#home').replace(/^#/, '').split('?')[0];
    return NAV.some(function (n) { return n.id === h; }) ? h : 'home';
  }

  function go(id) {
    if (location.hash !== '#' + id) location.hash = id;
    else render();
  }

  function buildNav() {
    var nav = $('cp-nav');
    if (!nav) return;
    nav.innerHTML = NAV.map(function (n) {
      return '<a href="#' + n.id + '" data-nav="' + n.id + '"><i class="fas ' + n.icon + '"></i><span>' + n.label + '</span></a>';
    }).join('');
    nav.addEventListener('click', function (e) {
      var a = e.target.closest('[data-nav]');
      if (!a) return;
      e.preventDefault();
      document.body.classList.remove('cp-nav-open');
      go(a.getAttribute('data-nav'));
    });
  }

  function updateChrome() {
    var page = state.page;
    var title = TITLES[page] || TITLES.home;
    if ($('cp-title')) $('cp-title').textContent = title[0];
    if ($('cp-sub')) $('cp-sub').textContent = title[1];
    document.querySelectorAll('#cp-nav a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-nav') === page);
    });
    var welcome = (state.home && state.home.welcome) || {};
    var user = getUser() || {};
    if ($('cp-user-name')) $('cp-user-name').textContent = welcome.name || user.name || 'عميل';
    if ($('cp-user-id')) $('cp-user-id').textContent = welcome.clientId || user.email || '';
    var unread = (state.home && state.home.summary && state.home.summary.unreadNotifications) || 0;
    var badge = $('cp-badge');
    if (badge) {
      if (unread > 0) {
        badge.hidden = false;
        badge.textContent = String(unread > 99 ? '99+' : unread);
      } else {
        badge.hidden = true;
      }
    }
  }

  function empty(icon, title, desc, cta, href) {
    return '<div class="cp-empty">' +
      '<i class="fas ' + icon + '" style="font-size:28px;color:var(--cp-red);margin-bottom:8px"></i>' +
      '<h4>' + esc(title) + '</h4><p>' + esc(desc) + '</p>' +
      (cta ? '<p style="margin-top:12px"><a class="cp-btn cp-btn-primary" href="#' + href + '" data-nav="' + href + '">' + esc(cta) + '</a></p>' : '') +
      '</div>';
  }

  function systemCard(sys) {
    var logo = sys.logo || 'assets/logo-hub.jpeg';
    var openUrl = sys.url || '#';
    if (window.HubAuth && HubAuth.attachSsoParams && sys.code) {
      try { openUrl = HubAuth.attachSsoParams(openUrl, sys.code); } catch (e) {}
    }
    return '<article class="cp-sys">' +
      '<div class="cp-sys-top">' +
        '<img src="' + esc(logo) + '" alt="" />' +
        '<div><strong>' + esc(sys.name) + '</strong><small>' + esc(sys.plan || '—') + '</small></div>' +
        '<span class="cp-badge-status ' + statusMod(sys.status) + '">' + esc(statusLabel(sys.status)) + '</span>' +
      '</div>' +
      '<p style="margin:0;color:var(--cp-muted);font-size:13px;font-weight:700">' + esc(sys.description || '') + '</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px;font-weight:800;color:var(--cp-muted)">' +
        (sys.activatedAt ? '<span>التفعيل: ' + esc(fmtDate(sys.activatedAt)) + '</span>' : '') +
        (sys.expiresAt ? '<span>الانتهاء: ' + esc(fmtDate(sys.expiresAt)) + '</span>' : '') +
      '</div>' +
      '<div class="cp-actions">' +
        '<a class="cp-btn cp-btn-primary" href="' + esc(openUrl) + '">فتح النظام</a>' +
        '<a class="cp-btn" href="#systems" data-nav="systems">التفاصيل</a>' +
      '</div></article>';
  }

  function renderHome(home) {
    home = home || {};
    var w = home.welcome || {};
    var s = home.summary || {};
    var systems = (home.systems || []).slice().sort(function (a, b) {
      return (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1);
    });
    var actions = home.actionRequired || [];
    var orders = home.recentOrders || [];
    var billing = home.upcomingBilling || {};
    var notifs = home.notifications || [];

    var welcome =
      '<section class="cp-welcome">' +
        '<h2>مرحبًا، ' + esc(w.name || 'عميلنا') + ' 👋</h2>' +
        '<p>كل خدماتك وأنظمتك في مكان واحد</p>' +
        '<div class="cp-welcome-meta">' +
          '<span class="cp-chip">رقم العميل: ' + esc(w.clientId || '—') + '</span>' +
          '<span class="cp-chip">المستوى: ' + esc(w.accountLevel || 'أساسي') + '</span>' +
          '<span class="cp-chip">' + esc(statusLabel(w.status || 'active')) + '</span>' +
        '</div></section>';

    var summary =
      '<div class="cp-summary">' +
        '<a href="#systems" data-nav="systems"><span>أنظمتي</span><strong>' + (s.systemsActive || 0) + ' أنظمة مفعلة</strong></a>' +
        '<a href="#orders" data-nav="orders"><span>طلباتي المفتوحة</span><strong>' + (s.openOrders || 0) + ' طلب قيد التنفيذ</strong></a>' +
        '<a href="#wallet" data-nav="wallet"><span>الرصيد / النقاط</span><strong>' + (s.walletTotal || 0) + ' نقطة</strong></a>' +
        '<a href="#invoices" data-nav="invoices"><span>الفواتير المستحقة</span><strong>' + (s.unpaidInvoices || 0) + '</strong></a>' +
      '</div>';

    var actionHtml = '<section class="cp-card"><div class="cp-card-head"><h3>مطلوب منك</h3></div>';
    if (!actions.length) {
      actionHtml += '<div class="cp-ok-box"><i class="fas fa-circle-check"></i> كل شيء تمام، لا توجد إجراءات مطلوبة منك حاليًا.</div>';
    } else {
      actionHtml += '<div class="cp-action-box">' + actions.map(function (a) {
        var link = a.type === 'invoice' ? 'invoices' : a.type === 'ticket' ? 'support' : a.type === 'renewal' ? 'subscriptions' : 'home';
        return '<article><div><strong>' + esc(a.title) + '</strong></div><a class="cp-link" href="#' + link + '" data-nav="' + link + '">متابعة</a></article>';
      }).join('') + '</div>';
    }
    actionHtml += '</section>';

    var sysHtml = '<section class="cp-card"><div class="cp-card-head"><h3>أنظمتي</h3><a class="cp-link" href="#systems" data-nav="systems">عرض الكل</a></div>';
    if (!systems.length) {
      sysHtml += empty('fa-cubes', 'ليس لديك أنظمة مفعلة حتى الآن', 'استكشف خدمات نايوش وابدأ بطلب نظامك الأول.', 'استكشف الأنظمة', 'marketplace');
    } else {
      sysHtml += '<div class="cp-sys-grid">' + systems.slice(0, 4).map(systemCard).join('') + '</div>';
    }
    sysHtml += '</section>';

    var ordHtml = '<section class="cp-card"><div class="cp-card-head"><h3>أحدث الطلبات</h3><a class="cp-link" href="#orders" data-nav="orders">عرض جميع الطلبات</a></div>';
    if (!orders.length) ordHtml += '<p style="color:var(--cp-muted);font-weight:700;margin:0">لا توجد طلبات بعد.</p>';
    else {
      ordHtml += '<div class="cp-list">' + orders.map(function (o) {
        return '<div class="cp-row"><div><strong>' + esc(o.number) + '</strong><small>' + esc(o.service) + ' · ' + esc(fmtDate(o.date || o.createdAt)) + '</small></div>' +
          '<span class="cp-badge-status ' + statusMod(o.status) + '">' + esc(statusLabel(o.status)) + '</span></div>';
      }).join('') + '</div>';
    }
    ordHtml += '</section>';

    var billHtml = '';
    var renewals = billing.renewals || [];
    var unpaid = billing.unpaid || [];
    if (renewals.length || unpaid.length) {
      billHtml = '<section class="cp-card"><div class="cp-card-head"><h3>الفوترة القادمة</h3></div><div class="cp-list">';
      renewals.forEach(function (r) {
        billHtml += '<div class="cp-row"><div><strong>تجديد: ' + esc(r.systemName) + '</strong><small>' + esc(r.plan) + '</small></div><span>' + esc(fmtDate(r.renewsAt)) + '</span></div>';
      });
      unpaid.forEach(function (inv) {
        billHtml += '<div class="cp-row"><div><strong>فاتورة ' + esc(inv.number) + '</strong><small>' + esc(statusLabel(inv.status)) + '</small></div><span>' + money(inv.amount, inv.currency) + '</span></div>';
      });
      billHtml += '</div></section>';
    }

    var nHtml = '<section class="cp-card"><div class="cp-card-head"><h3>آخر الإشعارات</h3><a class="cp-link" href="#notifications" data-nav="notifications">عرض كل الإشعارات</a></div>';
    if (!notifs.length) nHtml += '<p style="color:var(--cp-muted);font-weight:700;margin:0">لا إشعارات جديدة.</p>';
    else {
      nHtml += '<div class="cp-list">' + notifs.map(function (n) {
        return '<div class="cp-row"><div><strong>' + esc(n.title) + '</strong><small>' + esc(n.body || '') + '</small></div><small>' + esc(fmtDate(n.at || n.createdAt)) + '</small></div>';
      }).join('') + '</div>';
    }
    nHtml += '</section>';

    var support =
      '<section class="cp-card" style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">' +
        '<div><h3 style="margin:0 0 4px">تحتاج مساعدة؟</h3><p style="margin:0;color:var(--cp-muted);font-weight:700">فريق الدعم جاهز لمساعدتك.</p></div>' +
        '<a class="cp-btn cp-btn-primary" href="#support" data-nav="support">فتح تذكرة دعم</a>' +
      '</section>';

    return welcome + summary + actionHtml + sysHtml + ordHtml + billHtml + nHtml + support;
  }

  function renderSystems(list) {
    if (!list.length) return empty('fa-cubes', 'ليس لديك أنظمة مفعلة حتى الآن', 'استكشف خدمات نايوش واطلب تفعيل نظامك.', 'استكشف الأنظمة', 'marketplace');
    return '<section class="cp-card"><div class="cp-card-head"><h3>أنظمتي</h3></div><div class="cp-sys-grid">' + list.map(systemCard).join('') + '</div></section>';
  }

  function renderOrders(list) {
    if (!list.length) return empty('fa-receipt', 'لا توجد طلبات', 'عند تقديم طلب سيظهر هنا مع تتبع حالته.', 'استكشف الخدمات', 'marketplace');
    return '<section class="cp-card"><div class="cp-card-head"><h3>طلباتي</h3></div><div class="cp-list">' + list.map(function (o) {
      var tl = (o.timeline || []).map(function (t) {
        return '<li style="margin:4px 0"><strong>' + esc(t.label || statusLabel(t.status)) + '</strong> · <small>' + esc(fmtDate(t.at)) + '</small></li>';
      }).join('');
      return '<article class="cp-row" style="align-items:flex-start;flex-direction:column">' +
        '<div style="display:flex;width:100%;justify-content:space-between;gap:8px"><div><strong>' + esc(o.number) + '</strong><small>' + esc(o.service) + '</small></div>' +
        '<span class="cp-badge-status ' + statusMod(o.status) + '">' + esc(statusLabel(o.status)) + '</span></div>' +
        '<div style="display:flex;gap:12px;font-size:12px;font-weight:800;color:var(--cp-muted)"><span>' + esc(fmtDate(o.date)) + '</span><span>' + money(o.amount, o.currency) + '</span></div>' +
        (tl ? '<ul style="margin:8px 0 0;padding:0 18px 0 0;width:100%">' + tl + '</ul>' : '') +
        '</article>';
    }).join('') + '</div></section>';
  }

  function renderSubs(list) {
    if (!list.length) return empty('fa-rotate', 'لا توجد اشتراكات', 'ستظهر اشتراكات أنظمتك هنا.', null, null);
    return '<section class="cp-card"><div class="cp-card-head"><h3>اشتراكاتي</h3></div><div class="cp-sys-grid">' + list.map(function (s) {
      return '<article class="cp-sys"><strong>' + esc(s.systemName) + '</strong>' +
        '<div>الباقة: <strong>' + esc(s.plan) + '</strong></div>' +
        '<div class="cp-actions"><span class="cp-badge-status ' + statusMod(s.status) + '">' + esc(statusLabel(s.status)) + '</span><span style="font-weight:800">' + money(s.price) + '</span></div>' +
        '<small style="font-weight:800;color:var(--cp-muted)">البداية: ' + esc(fmtDate(s.startedAt)) + ' · التجديد: ' + esc(fmtDate(s.renewsAt)) + '</small>' +
        '<small style="font-weight:800;color:var(--cp-muted)">التجديد التلقائي: ' + (s.autoRenew ? 'مفعّل' : 'غير مفعّل') + '</small>' +
        '<div class="cp-actions"><button type="button" class="cp-btn" disabled>تجديد</button><button type="button" class="cp-btn" disabled>ترقية الباقة</button></div></article>';
    }).join('') + '</div></section>';
  }

  function renderWallet(w) {
    w = w || {};
    var ledger = w.ledger || [];
    return '<section class="cp-card"><div class="cp-card-head"><h3>محفظتي</h3></div>' +
      '<div class="cp-summary" style="margin-bottom:14px">' +
        '<div class="cp-card" style="box-shadow:none"><span>الرصيد المدفوع</span><strong style="color:var(--cp-red);font-size:1.4rem;display:block;margin-top:6px">' + (w.paid || 0) + '</strong></div>' +
        '<div class="cp-card" style="box-shadow:none"><span>الرصيد المجاني</span><strong style="color:var(--cp-red);font-size:1.4rem;display:block;margin-top:6px">' + (w.free || 0) + '</strong></div>' +
        '<div class="cp-card" style="box-shadow:none"><span>إجمالي النقاط</span><strong style="color:var(--cp-red);font-size:1.4rem;display:block;margin-top:6px">' + (w.total || 0) + '</strong></div>' +
      '</div>' +
      '<div class="cp-actions" style="margin-bottom:14px"><button type="button" class="cp-btn cp-btn-primary" id="cp-topup">طلب شحن الرصيد</button></div>' +
      '<h4 style="margin:0 0 10px">آخر العمليات</h4>' +
      (ledger.length
        ? '<div class="cp-list">' + ledger.map(function (t) {
            return '<div class="cp-row"><div><strong>' + esc(t.note || t.type) + '</strong><small>' + esc(fmtDate(t.at)) + '</small></div><strong>' + (t.type === 'debit' ? '−' : '+') + t.amount + '</strong></div>';
          }).join('') + '</div>'
        : '<p style="color:var(--cp-muted);font-weight:700">لا عمليات بعد.</p>') +
      '<p style="margin-top:12px;color:var(--cp-muted);font-size:12px;font-weight:700">لا يمكن تعديل الرصيد يدويًا من حساب العميل.</p></section>';
  }

  function renderInvoices(list) {
    if (!list.length) return empty('fa-file-invoice', 'لا توجد فواتير', 'ستظهر فواتيرك هنا عند إصدارها.', null, null);
    return '<section class="cp-card"><div class="cp-card-head"><h3>الفواتير والمدفوعات</h3></div><div class="cp-list">' + list.map(function (inv) {
      return '<div class="cp-row"><div><strong>' + esc(inv.number) + '</strong><small>' + esc(fmtDate(inv.date)) + ' · ' + money(inv.amount, inv.currency) + '</small></div>' +
        '<div class="cp-actions"><span class="cp-badge-status ' + statusMod(inv.status) + '">' + esc(statusLabel(inv.status)) + '</span>' +
        ((inv.status === 'unpaid' || inv.status === 'overdue')
          ? '<button type="button" class="cp-btn cp-btn-primary" data-pay-inv="' + esc(inv.id) + '">ادفع الآن</button>'
          : '<span class="cp-muted">مدفوعة</span>') +
        '</div></div>';
    }).join('') + '</div></section>';
  }

  function renderSupport(list, systems) {
    var opts = (systems || []).map(function (s) {
      return '<option value="' + esc(s.code || s.id) + '">' + esc(s.name) + '</option>';
    }).join('');
    var form =
      '<form class="cp-form" id="cp-ticket-form" style="margin-bottom:18px">' +
        '<h4 style="margin:0">فتح تذكرة دعم</h4>' +
        '<div class="cp-field"><label>الموضوع</label><input name="subject" required maxlength="120"></div>' +
        '<div class="cp-field"><label>القسم</label><select name="department"><option>دعم فني</option><option>فوترة</option><option>مبيعات</option><option>عام</option></select></div>' +
        '<div class="cp-field"><label>الأولوية</label><select name="priority"><option value="NORMAL">عادية</option><option value="HIGH">عالية</option><option value="LOW">منخفضة</option><option value="URGENT">عاجلة</option></select></div>' +
        '<div class="cp-field"><label>النظام المتعلق</label><select name="systemCode"><option value="">— عام —</option>' + opts + '</select></div>' +
        '<div class="cp-field"><label>الرسالة</label><textarea name="message" required rows="4" maxlength="4000"></textarea></div>' +
        '<button type="submit" class="cp-btn cp-btn-primary">إرسال التذكرة</button>' +
      '</form>';
    var tickets = !list.length
      ? '<p style="color:var(--cp-muted);font-weight:700">لا تذاكر دعم بعد.</p>'
      : list.map(function (t) {
          var msgs = (t.messages || []).map(function (m) {
            return '<div style="border:1px solid var(--cp-line);border-radius:10px;padding:10px;margin-top:8px"><strong>' + ((m.from === 'client' || m.sender_role === 'client') ? 'أنت' : 'الدعم') + '</strong><p style="margin:4px 0">' + esc(m.message || m.body) + '</p><small>' + esc(fmtDate(m.at || m.created_at)) + '</small></div>';
          }).join('');
          var st = String(t.status || '').toLowerCase();
          var canReply = st !== 'closed' && st !== 'resolved';
          return '<article class="cp-card" style="box-shadow:none;margin-top:10px">' +
            '<div style="display:flex;justify-content:space-between;gap:8px"><strong>' + esc((t.number ? t.number + ' · ' : '') + t.subject) + '</strong><span class="cp-badge-status ' + statusMod(t.status) + '">' + esc(statusLabel(t.status)) + '</span></div>' +
            '<small style="font-weight:800;color:var(--cp-muted)">' + esc(t.department || t.category || '') + ' · ' + esc(fmtDate(t.createdAt || t.created_at)) + '</small>' +
            msgs +
            (canReply
              ? '<form class="cp-reply-form" data-id="' + esc(t.id) + '" style="display:flex;gap:8px;margin-top:10px"><input name="message" required placeholder="اكتب ردك…" style="flex:1;border:1px solid var(--cp-line);border-radius:12px;padding:10px;font:inherit"><button class="cp-btn" type="submit">رد</button></form>'
              : '') +
            '</article>';
        }).join('');
    return '<section class="cp-card"><div class="cp-card-head"><h3>مركز الدعم</h3></div>' + form + '<h4>تذاكري</h4>' + tickets + '</section>';
  }

  function renderNotifications(list) {
    return '<section class="cp-card"><div class="cp-card-head"><h3>الإشعارات</h3><button type="button" class="cp-btn" id="cp-read-all">تعليم الكل كمقروء</button></div>' +
      (!list.length
        ? empty('fa-bell', 'لا إشعارات', 'ستصلك تنبيهات الطلبات والفواتير هنا.', null, null)
        : '<div class="cp-list">' + list.map(function (n) {
            return '<button type="button" class="cp-row" data-nid="' + esc(n.id) + '" style="width:100%;text-align:right;cursor:pointer;background:' + (n.read ? '#fff' : '#fff7f7') + '">' +
              '<div><strong>' + esc(n.title) + '</strong><small>' + esc(n.body || '') + '</small></div><small>' + esc(fmtDate(n.at || n.createdAt)) + '</small></button>';
          }).join('') + '</div>') +
      '</section>';
  }

  function renderMarketplace(list) {
    if (!list.length) return empty('fa-store', 'لا خدمات متاحة حاليًا', 'عد لاحقًا لاستكشاف أنظمة نايوش.', null, null);
    return '<section class="cp-card"><div class="cp-card-head"><h3>استكشف خدمات نايوش</h3></div><div class="cp-sys-grid">' + list.map(function (p) {
      return '<article class="cp-sys">' +
        '<div class="cp-sys-top"><img src="' + esc(p.logo || 'assets/logo-hub.jpeg') + '" alt="" /><div><strong>' + esc(p.name) + '</strong><small>' + esc(p.priceLabel || 'حسب الطلب') + '</small></div></div>' +
        '<p style="margin:0;color:var(--cp-muted);font-size:13px;font-weight:700">' + esc(p.description || '') + '</p>' +
        '<div class="cp-actions">' +
          '<button type="button" class="cp-btn cp-btn-primary" data-order-svc="' + esc(p.name) + '" data-order-amt="' + esc(String(p.priceFrom || 0)) + '">اطلب الآن</button>' +
          '<a class="cp-btn" href="' + esc(p.moreUrl || p.ctaUrl || 'products.html') + '">اعرف المزيد</a>' +
        '</div></article>';
    }).join('') + '</div></section>';
  }

  function renderProfile(p) {
    p = p || {};
    return '<section class="cp-card"><div class="cp-card-head"><h3>حسابي</h3></div>' +
      '<form class="cp-form" id="cp-profile-form">' +
        '<div class="cp-field"><label>الاسم</label><input name="name" value="' + esc(p.name || '') + '" required></div>' +
        '<div class="cp-field"><label>البريد</label><input value="' + esc(p.email || '') + '" disabled></div>' +
        '<div class="cp-field"><label>الهاتف</label><input name="phone" value="' + esc(p.phone || '') + '"></div>' +
        '<div class="cp-field"><label>الشركة / المنظمة</label><input name="company" value="' + esc(p.company || '') + '"></div>' +
        '<div class="cp-field"><label>الدولة</label><input name="country" value="' + esc(p.country || '') + '"></div>' +
        '<div class="cp-field"><label>اللغة</label><select name="language"><option value="ar"' + (p.language !== 'en' ? ' selected' : '') + '>العربية</option><option value="en"' + (p.language === 'en' ? ' selected' : '') + '>English</option></select></div>' +
        '<button type="submit" class="cp-btn cp-btn-primary">حفظ التغييرات</button>' +
      '</form></section>';
  }

  function renderSecurity(sec) {
    sec = sec || {};
    var sessions = sec.sessions || [];
    var failed = sec.failedLogins || [];
    return '<section class="cp-card"><div class="cp-card-head"><h3>الأمان</h3></div>' +
      '<form class="cp-form" id="cp-password-form">' +
        '<h4 style="margin:0">تغيير كلمة المرور</h4>' +
        '<div class="cp-field"><label>كلمة المرور الحالية</label><input type="password" name="currentPassword" required autocomplete="current-password"></div>' +
        '<div class="cp-field"><label>كلمة المرور الجديدة</label><input type="password" name="newPassword" required minlength="8" autocomplete="new-password"></div>' +
        '<button type="submit" class="cp-btn cp-btn-primary">تحديث كلمة المرور</button>' +
      '</form>' +
      '<div style="margin-top:18px;border-top:1px solid var(--cp-line);padding-top:14px">' +
        '<h4 style="margin:0 0 8px">آخر تسجيل دخول</h4>' +
        '<p style="margin:0;font-weight:700;color:var(--cp-muted)">' + esc(fmtDate(sec.lastLoginAt)) + '</p>' +
        '<h4 style="margin:16px 0 8px">الجلسات النشطة</h4>' +
        (sessions.length
          ? '<div class="cp-list">' + sessions.map(function (s) {
              return '<div class="cp-row"><div><strong>' + esc(s.device || 'جهاز') + '</strong><small>' + esc(s.browser || '') + (s.ip ? ' · ' + esc(s.ip) : '') + (s.current ? ' · الحالية' : '') + '</small></div><small>' + esc(fmtDate(s.at)) + '</small></div>';
            }).join('') + '</div>'
          : '<p style="color:var(--cp-muted);font-weight:700">لا جلسات مسجّلة بعد.</p>') +
        '<div class="cp-actions" style="margin-top:12px"><button type="button" class="cp-btn" id="cp-logout-others">تسجيل الخروج من الأجهزة الأخرى</button></div>' +
        '<h4 style="margin:16px 0 8px">تنبيهات أمنية</h4>' +
        (failed.length
          ? '<div class="cp-list">' + failed.slice(0, 5).map(function (f) {
              return '<div class="cp-row"><div><strong>محاولة فاشلة</strong><small>' + esc(f.reason || '') + '</small></div><small>' + esc(fmtDate(f.at)) + '</small></div>';
            }).join('') + '</div>'
          : '<p style="color:var(--cp-muted);font-weight:700">لا تنبيهات.</p>') +
        '<p style="margin:12px 0 0;font-size:12px;font-weight:700;color:var(--cp-muted)">المصادقة الثنائية (2FA) — البنية جاهزة للتفعيل لاحقًا</p>' +
      '</div></section>';
  }

  async function load(page) {
    if (page === 'home') {
      var h = await api('/api/client/home');
      state.home = h.home || h;
      return state.home;
    }
    var map = {
      systems: '/api/client/systems',
      orders: '/api/client/orders',
      subscriptions: '/api/client/subscriptions',
      wallet: '/api/client/wallet',
      invoices: '/api/client/invoices',
      support: '/api/client/tickets',
      notifications: '/api/client/notifications',
      marketplace: '/api/client/marketplace',
      profile: '/api/client/me',
      security: '/api/client/security'
    };
    var data = await api(map[page]);
    state.cache[page] = data;
    return data;
  }

  function bind(page) {
    document.querySelectorAll('#cp-root [data-nav]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        var id = el.getAttribute('data-nav');
        if (!id) return;
        if (el.tagName === 'A' && el.getAttribute('href') && el.getAttribute('href').charAt(0) === '#') {
          e.preventDefault();
        }
        go(id);
      });
    });

    if (page === 'wallet') {
      var top = $('cp-topup');
      if (top) top.addEventListener('click', async function () {
        var amt = prompt('أدخل عدد النقاط المطلوب شحنها:', '100');
        if (!amt) return;
        try {
          await api('/api/client/wallet/topup-request', { method: 'POST', body: { amount: Number(amt) } });
          toast('تم إرسال طلب الشحن للإدارة');
          state.cache.orders = null;
          state.home = null;
        } catch (err) {
          toast(err.message || 'تعذر الطلب');
        }
      });
    }

    if (page === 'invoices') {
      document.querySelectorAll('[data-pay-inv]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          try {
            await api('/api/client/invoices/pay', { method: 'POST', body: { id: btn.getAttribute('data-pay-inv') } });
            toast('تم دفع الفاتورة من المحفظة');
            state.cache.invoices = null;
            state.cache.wallet = null;
            state.home = null;
            await render();
          } catch (err) {
            toast(err.message || 'تعذر الدفع');
          }
        });
      });
    }

    if (page === 'marketplace') {
      document.querySelectorAll('[data-order-svc]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          try {
            await api('/api/client/orders', {
              method: 'POST',
              body: {
                service: btn.getAttribute('data-order-svc'),
                amount: Number(btn.getAttribute('data-order-amt') || 0)
              }
            });
            toast('تم إنشاء الطلب بنجاح');
            state.cache.orders = null;
            state.home = null;
            go('orders');
          } catch (err) {
            toast(err.message || 'تعذر إنشاء الطلب');
          }
        });
      });
    }

    if (page === 'support') {
      var form = $('cp-ticket-form');
      if (form) {
        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          var fd = new FormData(form);
          try {
            await api('/api/client/tickets', {
              method: 'POST',
              body: {
                subject: fd.get('subject'),
                department: fd.get('department'),
                priority: fd.get('priority'),
                systemCode: fd.get('systemCode') || '',
                message: fd.get('message')
              }
            });
            toast('تم فتح التذكرة بنجاح');
            state.cache.support = null;
            state.home = null;
            await render();
          } catch (err) {
            toast(err.message || 'تعذر الإرسال');
          }
        });
      }
      document.querySelectorAll('.cp-reply-form').forEach(function (rf) {
        rf.addEventListener('submit', async function (e) {
          e.preventDefault();
          var id = rf.getAttribute('data-id');
          var input = rf.querySelector('input[name="message"]');
          try {
            await api('/api/client/tickets/' + encodeURIComponent(id), {
              method: 'POST',
              body: { message: input.value }
            });
            toast('تم إرسال الرد');
            state.cache.support = null;
            await render();
          } catch (err) {
            toast(err.message || 'تعذر الرد');
          }
        });
      });
    }

    if (page === 'notifications') {
      var all = $('cp-read-all');
      if (all) {
        all.addEventListener('click', async function () {
          try {
            await api('/api/client/notifications/read', { method: 'POST', body: { all: true } });
            state.cache.notifications = null;
            state.home = null;
            await render();
          } catch (err) {
            toast(err.message);
          }
        });
      }
      document.querySelectorAll('#cp-root [data-nid]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var id = btn.getAttribute('data-nid');
          try {
            await api('/api/client/notifications/read', { method: 'POST', body: { id: id } });
            btn.style.background = '#fff';
            if (state.home && state.home.summary) {
              state.home.summary.unreadNotifications = Math.max(0, (state.home.summary.unreadNotifications || 1) - 1);
              updateChrome();
            }
          } catch (e) {}
        });
      });
    }

    if (page === 'profile') {
      var pf = $('cp-profile-form');
      if (pf) {
        pf.addEventListener('submit', async function (e) {
          e.preventDefault();
          var fd = new FormData(pf);
          try {
            await api('/api/client/profile', {
              method: 'PUT',
              body: {
                name: fd.get('name'),
                phone: fd.get('phone'),
                company: fd.get('company'),
                country: fd.get('country'),
                language: fd.get('language')
              }
            });
            toast('تم حفظ البيانات');
            state.home = null;
            state.cache.profile = null;
            await load('home').catch(function () {});
            updateChrome();
          } catch (err) {
            toast(err.message || 'تعذر الحفظ');
          }
        });
      }
    }

    if (page === 'security') {
      var sf = $('cp-password-form');
      if (sf) {
        sf.addEventListener('submit', async function (e) {
          e.preventDefault();
          var fd = new FormData(sf);
          try {
            await api('/api/client/security/password', {
              method: 'POST',
              body: {
                currentPassword: fd.get('currentPassword'),
                newPassword: fd.get('newPassword')
              }
            });
            toast('تم تحديث كلمة المرور');
            sf.reset();
          } catch (err) {
            toast(err.message || 'تعذر التحديث');
          }
        });
      }
      var lo = $('cp-logout-others');
      if (lo) {
        lo.addEventListener('click', async function () {
          try {
            await api('/api/client/security/logout-others', { method: 'POST', body: {} });
            toast('تم إنهاء الجلسات الأخرى');
            state.cache.security = null;
            await render();
          } catch (err) {
            toast(err.message || 'تعذر التنفيذ');
          }
        });
      }
    }
  }

  async function render() {
    state.page = pageId();
    updateChrome();
    var root = $('cp-root');
    root.innerHTML = '<div class="cp-card"><div class="cp-skeleton"></div><div class="cp-skeleton" style="margin-top:10px;width:70%"></div></div>';
    try {
      if (!state.home) {
        try { await load('home'); } catch (e) {}
      }
      var data = await load(state.page);
      var html = '';
      switch (state.page) {
        case 'home': html = renderHome(data); break;
        case 'systems': html = renderSystems(data.systems || []); break;
        case 'orders': html = renderOrders(data.orders || []); break;
        case 'subscriptions': html = renderSubs(data.subscriptions || []); break;
        case 'wallet': html = renderWallet(data.wallet || data); break;
        case 'invoices': html = renderInvoices(data.invoices || []); break;
        case 'support':
          html = renderSupport(data.tickets || [], (state.home && state.home.systems) || []);
          break;
        case 'notifications': html = renderNotifications(data.notifications || []); break;
        case 'marketplace': html = renderMarketplace(data.items || []); break;
        case 'profile': html = renderProfile(data.client || data); break;
        case 'security': html = renderSecurity(data.security || data); break;
        default: html = renderHome(state.home);
      }
      root.innerHTML = html;
      bind(state.page);
      updateChrome();
    } catch (err) {
      root.innerHTML = '<section class="cp-card"><h3>تعذر تحميل الصفحة</h3><p>' + esc(err.message || '') + '</p>' +
        '<button type="button" class="cp-btn cp-btn-primary" id="cp-retry">إعادة المحاولة</button></section>';
      var r = $('cp-retry');
      if (r) r.addEventListener('click', render);
    }
  }

  function boot() {
    if (!ensureClient()) return;
    buildNav();
    $('cp-logout') && $('cp-logout').addEventListener('click', logout);
    $('cp-menu') && $('cp-menu').addEventListener('click', function () {
      document.body.classList.toggle('cp-nav-open');
    });
    $('cp-bell') && $('cp-bell').addEventListener('click', function () { go('notifications'); });
    document.addEventListener('click', function (e) {
      if (!document.body.classList.contains('cp-nav-open')) return;
      if (e.target.closest('.cp-sidebar') || e.target.closest('#cp-menu')) return;
      document.body.classList.remove('cp-nav-open');
    });
    window.addEventListener('hashchange', render);
    render();
    setInterval(function () {
      api('/api/client/notifications').then(function (d) {
        var unread = d.unread || (d.notifications || []).filter(function (n) { return !n.read; }).length;
        if (state.home && state.home.summary) state.home.summary.unreadNotifications = unread;
        updateChrome();
      }).catch(function () {});
    }, 20000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
