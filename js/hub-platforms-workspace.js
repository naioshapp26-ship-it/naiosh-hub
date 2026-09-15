/**
 * Platforms Center — customer workspace (discover, access, request)
 */
(function () {
  'use strict';

  var root = document.getElementById('platforms-workspace');
  if (!root) return;

  var ACCESS_KEY = 'naiosh_platform_customer_access_v1';
  var FREE_OPEN = ['NMS', 'NCS'];
  var SOURCE_MODULE = 'منصات نايوش 360';
  var SOURCE_URL = 'platforms.html';

  /** Internal routes — never href="#", never blank operating landing */
  var PLATFORM_ROUTES = {
    UOS: 'global-os.html',
    KMS: 'dashboard.html#knowledge',
    CCS: 'dashboard.html#control',
    NAI: 'index.html',
    NERP: 'apps.html',
    NHR: 'office.html',
    NQMS: 'system-ops.html',
    NIMS: 'system-ops.html',
    NAMS: 'apps.html',
    NEMS: 'courses.html',
    NTS: 'apps.html',
    NCS: 'events.html',
    NMS: 'ads.html',
    NDS: 'dashboard.html',
    NFS: 'store.html',
    NOPS: 'apps.html',
    NIS: 'apps.html',
    NGS: 'system-ops.html',
  };

  var FRIENDLY_TABS = [
    { id: 'all', label: 'الكل' },
    { id: 'admin_ops', label: 'الإدارة والتشغيل' },
    { id: 'ecommerce', label: 'التجارة الإلكترونية' },
    { id: 'marketing', label: 'التسويق والمحتوى' },
    { id: 'data', label: 'البيانات والتحليلات' },
    { id: 'ai', label: 'الذكاء الاصطناعي' },
    { id: 'finance', label: 'المالية' },
    { id: 'hr', label: 'الموارد البشرية' },
    { id: 'security', label: 'الأمن' },
    { id: 'other', label: 'أخرى' },
  ];

  var FRIENDLY_CODES = {
    ecommerce: ['NERP', 'NFS'],
    marketing: ['NMS', 'NCS', 'NEMS'],
    data: ['NDS'],
    ai: ['NAI'],
    finance: ['NFS'],
    hr: ['NHR'],
    security: ['NQMS', 'NIMS', 'NGS'],
  };

  var ui = {
    q: '',
    friendlyTab: 'all',
    detailCode: '',
    accessCode: '',
    accessReason: '',
    accessUsage: '',
    accessResult: null,
    addOpen: false,
    addResult: null,
    addForm: blankAddForm(),
  };

  function blankAddForm() {
    return {
      name: '',
      url: '',
      category: 'operations',
      summary: '',
      reason: '',
      logo: '',
      notes: '',
    };
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(msg, type) {
    if (window.HubUI && HubUI.toast) HubUI.toast(msg, type || 'info');
    else if (window.HubActions && HubActions.toast) HubActions.toast(msg);
    else
      try {
        alert(msg);
      } catch (e) {}
  }

  function catalog() {
    return (window.HubSovereignPlatforms && HubSovereignPlatforms.list) || [];
  }

  function categoriesMap() {
    return (window.HubSovereignPlatforms && HubSovereignPlatforms.categories) || {};
  }

  function categoryLabel(catId) {
    var m = categoriesMap();
    return (m[catId] && m[catId].label) || catId || '—';
  }

  function currentUser() {
    return window.HubAuth && HubAuth.getUser ? HubAuth.getUser() : null;
  }

  function userEmail() {
    var u = currentUser();
    return u && u.email ? String(u.email).trim().toLowerCase() : '';
  }

  function actorName() {
    var u = currentUser();
    return u ? u.name || u.email || 'عميل' : 'عميل';
  }

  function isLoggedIn() {
    return window.HubAuth && HubAuth.isLoggedIn ? HubAuth.isLoggedIn() : false;
  }

  function isStaffUser() {
    return window.HubAuth && HubAuth.isStaff ? HubAuth.isStaff() : false;
  }

  function readAccessBag() {
    if (window.HubCustomerRequests && HubCustomerRequests.readPlatformAccessStore) {
      return HubCustomerRequests.readPlatformAccessStore();
    }
    try {
      var raw = localStorage.getItem(ACCESS_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      if (!parsed.byEmail) parsed.byEmail = {};
      return parsed;
    } catch (e) {
      return { byEmail: {} };
    }
  }

  function grantAccess(code, email) {
    var em = String(email || userEmail() || '').trim().toLowerCase();
    var c = String(code || '').trim().toUpperCase();
    if (!em || !c) return null;
    if (window.HubCustomerRequests && HubCustomerRequests.grantPlatformAccess) {
      return HubCustomerRequests.grantPlatformAccess(em, c);
    }
    var store = readAccessBag();
    var row = store.byEmail[em] || { codes: [], updatedAt: '' };
    var codes = Array.isArray(row.codes) ? row.codes.slice() : [];
    if (codes.indexOf(c) === -1) codes.push(c);
    row.codes = codes;
    row.updatedAt = new Date().toISOString();
    store.byEmail[em] = row;
    try {
      localStorage.setItem(ACCESS_KEY, JSON.stringify(store));
    } catch (e) {}
    return row;
  }

  function grantCodesForEmail(email) {
    var em = String(email || userEmail() || '').trim().toLowerCase();
    if (!em) return [];
    var bag = readAccessBag();
    var row = bag.byEmail[em];
    return row && Array.isArray(row.codes) ? row.codes.map(function (x) { return String(x).toUpperCase(); }) : [];
  }

  function grantFromHubGrants(email) {
    var em = String(email || userEmail() || '').trim().toLowerCase();
    if (!em || !window.HubPlatformGrants || !HubPlatformGrants.activeGrantFor) return null;
    return HubPlatformGrants.activeGrantFor(em);
  }

  function hasAccess(code, email) {
    var c = String(code || '').trim().toUpperCase();
    if (!c) return false;
    if (isStaffUser()) return true;
    if (FREE_OPEN.indexOf(c) !== -1) return true;

    var em = String(email || userEmail() || '').trim().toLowerCase();
    if (em && grantCodesForEmail(em).indexOf(c) !== -1) return true;

    var grant = em ? grantFromHubGrants(em) : null;
    if (grant) {
      var list = grant.platformCodes;
      if (!list || !list.length) return true;
      return list.some(function (x) {
        return String(x).toUpperCase() === c;
      });
    }
    return false;
  }

  function isSoon(p) {
    return String(p.status || '').toLowerCase() === 'soon' || String(p.status || '') === 'قريبًا';
  }

  function accessStatus(p, forMine) {
    if (isSoon(p)) return { key: 'soon', label: 'قريبًا', cls: 'is-soon' };
    if (hasAccess(p.code)) {
      return { key: 'open', label: forMine ? 'متاحة لك' : 'متاحة', cls: 'is-open' };
    }
    return { key: 'lock', label: 'تحتاج طلب وصول', cls: 'is-lock' };
  }

  function pendingAccessRequest(code) {
    if (!window.HubCustomerRequests || !HubCustomerRequests.list) return false;
    var em = userEmail();
    if (!em) return false;
    var c = String(code || '').toUpperCase();
    return HubCustomerRequests.list({}).some(function (r) {
      if (r.requestType !== 'Platform Access Request') return false;
      if (String(r.referenceId || '').toUpperCase() !== c) return false;
      if (String(r.email || '').toLowerCase() !== em) return false;
      return HubCustomerRequests.isPendingReview
        ? HubCustomerRequests.isPendingReview(r)
        : ['New', 'Pending Review', 'Under Review', 'Needs Changes'].indexOf(r.status) !== -1;
    });
  }

  function syncApprovedRequests() {
    if (!window.HubCustomerRequests || !HubCustomerRequests.list) return;
    var em = userEmail();
    if (!em) return;
    HubCustomerRequests.list({}).forEach(function (r) {
      if (r.requestType !== 'Platform Access Request') return;
      if (r.referenceType !== 'Platform') return;
      if (r.status !== 'Approved') return;
      if (String(r.email || '').toLowerCase() !== em) return;
      if (r.referenceId) grantAccess(r.referenceId, em);
    });
  }

  function minePlatforms() {
    return catalog().filter(function (p) {
      return hasAccess(p.code) && !isSoon(p);
    });
  }

  function matchesFriendly(p) {
    if (ui.friendlyTab === 'all') return true;
    if (ui.friendlyTab === 'admin_ops') {
      return (
        (p.category === 'operations' || p.category === 'core') &&
        FRIENDLY_CODES.marketing.indexOf(p.code) === -1 &&
        FRIENDLY_CODES.data.indexOf(p.code) === -1 &&
        FRIENDLY_CODES.ai.indexOf(p.code) === -1 &&
        FRIENDLY_CODES.finance.indexOf(p.code) === -1 &&
        FRIENDLY_CODES.hr.indexOf(p.code) === -1 &&
        FRIENDLY_CODES.security.indexOf(p.code) === -1 &&
        FRIENDLY_CODES.ecommerce.indexOf(p.code) === -1
      );
    }
    if (ui.friendlyTab === 'other') {
      var covered = false;
      Object.keys(FRIENDLY_CODES).forEach(function (k) {
        if (FRIENDLY_CODES[k].indexOf(p.code) !== -1) covered = true;
      });
      if (p.category === 'operations' || p.category === 'core') {
        if (
          FRIENDLY_CODES.marketing.indexOf(p.code) === -1 &&
          FRIENDLY_CODES.data.indexOf(p.code) === -1 &&
          FRIENDLY_CODES.ai.indexOf(p.code) === -1 &&
          FRIENDLY_CODES.finance.indexOf(p.code) === -1 &&
          FRIENDLY_CODES.hr.indexOf(p.code) === -1 &&
          FRIENDLY_CODES.security.indexOf(p.code) === -1 &&
          FRIENDLY_CODES.ecommerce.indexOf(p.code) === -1
        ) {
          covered = true;
        }
      }
      if (FRIENDLY_CODES.security.indexOf(p.code) !== -1) covered = true;
      return !covered;
    }
    var codes = FRIENDLY_CODES[ui.friendlyTab];
    return codes && codes.indexOf(p.code) !== -1;
  }

  function filteredCatalog() {
    var q = String(ui.q || '').trim().toLowerCase();
    return catalog().filter(function (p) {
      if (!matchesFriendly(p)) return false;
      if (!q) return true;
      var hay = (
        (p.code || '') +
        ' ' +
        (p.nameAr || '') +
        ' ' +
        (p.name || '') +
        ' ' +
        (p.role || '') +
        ' ' +
        (p.desc || '') +
        ' ' +
        categoryLabel(p.category)
      ).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function scrollToId(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      el.classList.add('is-scroll-target');
      setTimeout(function () {
        el.classList.remove('is-scroll-target');
      }, 1200);
    } catch (e) {}
  }

  function platformByCode(code) {
    return catalog().find(function (p) {
      return String(p.code).toUpperCase() === String(code).toUpperCase();
    });
  }

  function resolvePlatformHref(p) {
    if (!p) return '';
    var direct = p.href || p.url || p.launchUrl || p.standaloneUrl || '';
    if (direct && String(direct).trim() && String(direct).trim() !== '#') {
      return String(direct).trim();
    }
    var code = String(p.code || '').toUpperCase();
    if (PLATFORM_ROUTES[code]) return PLATFORM_ROUTES[code];
    if (window.HubLauncher && HubLauncher.findApp) {
      var app = HubLauncher.findApp(code);
      if (app && (app.launchUrl || app.url) && String(app.launchUrl || app.url) !== '#') {
        return app.launchUrl || app.url;
      }
    }
    return 'dashboard.html?platform=' + encodeURIComponent(code);
  }

  function openPlatform(code) {
    var p = platformByCode(code);
    if (!p || isSoon(p)) return;
    if (!hasAccess(code)) {
      toast('تحتاج موافقة للوصول إلى هذه المنصة', 'info');
      return;
    }
    var em = userEmail();
    var grant = em ? grantFromHubGrants(em) : null;
    var host = grant && grant.host ? String(grant.host).trim() : '';
    if (host) {
      var url = host.indexOf('http') === 0 ? host : 'https://' + host;
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    var href = resolvePlatformHref(p);
    if (!href || href === '#') {
      toast('رابط المنصة غير متاح حالياً', 'error');
      return;
    }
    if (/^https?:\/\//i.test(href)) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    window.location.href = href;
  }

  function requireLogin(nextHash) {
    if (isLoggedIn()) return true;
    if (window.HubAuth && HubAuth.requireLogin) {
      HubAuth.requireLogin({ next: location.pathname + location.search + (nextHash || '') });
    } else {
      toast('سجّل الدخول للمتابعة', 'info');
    }
    return false;
  }

  function submitAccessRequest() {
    var p = platformByCode(ui.accessCode);
    if (!p) return;
    if (!requireLogin('#platforms-catalog')) return;
    var em = userEmail();
    if (!em) {
      toast('أضف بريداً في حسابك', 'error');
      return;
    }
    if (!window.HubCustomerRequests || !HubCustomerRequests.create) {
      toast('وحدة الطلبات غير متاحة', 'error');
      return;
    }
    if (pendingAccessRequest(p.code)) {
      toast('لديك طلب وصول قيد المراجعة لهذه المنصة', 'info');
      return;
    }
    var reason = String(ui.accessReason || '').trim();
    if (!reason) {
      toast('اكتب سبب الطلب', 'error');
      return;
    }
    var usage = String(ui.accessUsage || '').trim();
    var desc = reason + (usage ? '\nالاستخدام المطلوب: ' + usage : '');
    var row = HubCustomerRequests.create(
      {
        requestType: 'Platform Access Request',
        requestTypeLabel: 'طلب وصول لمنصة',
        referenceType: 'Platform',
        referenceId: p.code,
        sourceModule: SOURCE_MODULE,
        sourceUrl: SOURCE_URL,
        title: 'طلب وصول — ' + (p.nameAr || p.code),
        description: desc,
        need: reason,
        status: 'Pending Review',
        email: em,
        customerName: actorName(),
        customer: { name: actorName(), email: em },
        platformName: p.nameAr || p.name || p.code,
        intendedUse: usage,
      },
      actorName()
    );
    ui.accessResult = {
      id: row.requestId || row.id,
      platform: p.nameAr || p.code,
      status: 'بانتظار المراجعة',
    };
    ui.accessReason = '';
    ui.accessUsage = '';
    toast('تم إرسال طلب الوصول بنجاح · ' + ui.accessResult.id, 'success');
    render();
  }

  function submitAddPlatform() {
    if (!requireLogin('#platforms-request')) return;
    var f = ui.addForm;
    if (
      !String(f.name || '').trim() ||
      !String(f.url || '').trim() ||
      !String(f.summary || '').trim() ||
      !String(f.reason || '').trim() ||
      !String(f.category || '').trim()
    ) {
      toast('أكمل الحقول المطلوبة', 'error');
      return;
    }
    if (!window.HubCustomerRequests || !HubCustomerRequests.create) {
      toast('وحدة الطلبات غير متاحة', 'error');
      return;
    }
    var em = userEmail();
    var row = HubCustomerRequests.create(
      {
        requestType: 'Platform Add Request',
        requestTypeLabel: 'طلب إضافة منصة',
        referenceType: 'Platform',
        referenceId: String(f.name).trim().slice(0, 40),
        sourceModule: SOURCE_MODULE,
        sourceUrl: SOURCE_URL,
        title: 'طلب إضافة منصة — ' + String(f.name).trim(),
        description: [
          f.summary,
          f.reason,
          'URL: ' + f.url,
          f.logo ? 'Logo: ' + f.logo : '',
          f.notes ? 'ملاحظات: ' + f.notes : '',
        ]
          .filter(Boolean)
          .join('\n'),
        need: f.reason,
        status: 'Pending Review',
        email: em,
        customerName: actorName(),
        customer: { name: actorName(), email: em },
        platformDraft: {
          name: f.name,
          url: f.url,
          category: f.category,
          summary: f.summary,
          reason: f.reason,
          logo: f.logo,
          notes: f.notes,
        },
      },
      actorName()
    );
    ui.addResult = {
      id: row.requestId || row.id,
      status: 'بانتظار المراجعة',
    };
    ui.addForm = blankAddForm();
    toast('تم إرسال طلب الإضافة · ' + ui.addResult.id, 'success');
    render();
  }

  function cardHtml(p, forMine) {
    var st = accessStatus(p, !!forMine);
    var pending = pendingAccessRequest(p.code);
    var actions = '';
    if (st.key === 'soon') {
      actions = '<button type="button" class="plt-ws-btn sm" disabled>قريبًا</button>';
    } else if (st.key === 'open') {
      actions =
        '<button type="button" class="plt-ws-btn sm primary" data-plt-open="' +
        esc(p.code) +
        '">فتح المنصة</button>' +
        '<button type="button" class="plt-ws-btn sm" data-plt-detail="' +
        esc(p.code) +
        '">التفاصيل</button>';
    } else if (pending) {
      actions =
        '<button type="button" class="plt-ws-btn sm" disabled>طلب قيد المراجعة</button>' +
        '<button type="button" class="plt-ws-btn sm" data-plt-detail="' +
        esc(p.code) +
        '">التفاصيل</button>';
    } else {
      actions =
        '<button type="button" class="plt-ws-btn sm primary" data-plt-access="' +
        esc(p.code) +
        '">طلب الوصول</button>' +
        '<button type="button" class="plt-ws-btn sm" data-plt-detail="' +
        esc(p.code) +
        '">التفاصيل</button>';
    }
    return (
      '<article class="plt-card">' +
      '<div class="plt-card-head">' +
      '<div class="plt-card-icon"><i class="fas ' +
      esc(p.icon || 'fa-cube') +
      '"></i></div>' +
      '<div>' +
      '<div class="plt-card-code">' +
      esc(p.code) +
      '</div>' +
      '<h3>' +
      esc(p.nameAr || p.name) +
      '</h3>' +
      '</div></div>' +
      '<span class="plt-chip">' +
      esc(categoryLabel(p.category)) +
      '</span>' +
      '<p class="plt-card-desc">' +
      esc(p.desc || '') +
      '</p>' +
      '<span class="plt-chip ' +
      st.cls +
      '">' +
      esc(st.label) +
      (pending ? ' · قيد المراجعة' : '') +
      '</span>' +
      '<div class="plt-card-actions">' +
      actions +
      '</div></article>'
    );
  }

  function tabsHtml(items, active) {
    return (
      '<div class="plt-ws-tabs" role="tablist">' +
      items
        .map(function (t) {
          return (
            '<button type="button" role="tab" class="' +
            (active === t.id ? 'is-on' : '') +
            '" data-plt-friendly="' +
            esc(t.id) +
            '">' +
            esc(t.label) +
            '</button>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function detailModalHtml() {
    var p = platformByCode(ui.detailCode);
    if (!p) return '';
    var st = accessStatus(p, true);
    var linked = hasAccess(p.code);
    var href = resolvePlatformHref(p);
    var cta =
      st.key === 'soon'
        ? '<button type="button" class="plt-ws-btn" disabled>قريبًا</button>'
        : st.key === 'open'
          ? '<button type="button" class="plt-ws-btn primary" data-plt-open="' + esc(p.code) + '">فتح المنصة</button>'
          : '<button type="button" class="plt-ws-btn primary" data-plt-access="' + esc(p.code) + '">طلب الوصول</button>';
    return (
      '<div class="plt-modal-overlay" data-plt-detail-overlay>' +
      '<div class="plt-modal wide" role="dialog" aria-modal="true">' +
      '<button type="button" class="plt-ws-btn sm ghost" data-plt-close-detail>إغلاق</button>' +
      '<div class="plt-card-head" style="margin-top:8px">' +
      '<div class="plt-card-icon"><i class="fas ' +
      esc(p.icon || 'fa-cube') +
      '"></i></div>' +
      '<div><div class="plt-card-code">' +
      esc(p.code) +
      '</div><h3>' +
      esc(p.nameAr || p.name) +
      '</h3></div></div>' +
      '<div class="plt-detail-grid">' +
      '<p><strong>ما هي المنصة؟</strong><br>' +
      esc(p.role || p.nameAr || '—') +
      '</p>' +
      '<p><strong>ماذا تقدم؟</strong><br>' +
      esc(p.desc || '—') +
      '</p>' +
      '<p><strong>لمن تناسب؟</strong><br>' +
      esc(linked ? 'مرتبطة بحسابك ويمكنك استخدامها الآن.' : 'للمؤسسات التي تحتاج ' + (p.role || 'هذه القدرة التشغيلية') + '.') +
      '</p>' +
      '<p><strong>أهم الوظائف</strong><br>' +
      esc(p.role || '—') +
      ' · ' +
      esc(categoryLabel(p.category)) +
      '</p>' +
      '<p><strong>طريقة الاستخدام</strong><br>اختر المنصة ← اطّلع على التفاصيل ← افتحها إن كانت متاحة أو اطلب الوصول.</p>' +
      '<p><strong>هل تحتاج صلاحية؟</strong><br>' +
      (st.key === 'open' ? 'لا — متاحة لك حالياً.' : st.key === 'soon' ? 'غير متاحة بعد.' : 'نعم — يلزم طلب وصول وموافقة.') +
      '</p>' +
      '<p><strong>مرتبطة بحسابك؟</strong><br>' +
      (linked ? 'نعم' : 'لا') +
      '</p>' +
      (href
        ? '<p><strong>رابط المنصة</strong><br><span dir="ltr">' + esc(href) + '</span></p>'
        : '') +
      '</div>' +
      '<span class="plt-chip ' +
      st.cls +
      '">' +
      esc(st.label) +
      '</span>' +
      '<div class="plt-modal-actions">' +
      cta +
      '</div></div></div>'
    );
  }

  function accessModalHtml() {
    if (ui.accessResult) {
      return (
        '<div class="plt-modal-overlay" data-plt-access-overlay>' +
        '<div class="plt-modal" role="dialog" aria-modal="true">' +
        '<h3>تم إرسال طلب الوصول بنجاح</h3>' +
        '<p class="plt-ws-lead">المنصة: <strong>' +
        esc(ui.accessResult.platform) +
        '</strong></p>' +
        '<p><strong>Request ID:</strong> <code dir="ltr">' +
        esc(ui.accessResult.id) +
        '</code></p>' +
        '<p><strong>الحالة:</strong> ' +
        esc(ui.accessResult.status) +
        '</p>' +
        '<div class="plt-modal-actions">' +
        '<button type="button" class="plt-ws-btn primary" data-plt-close-access>حسناً</button>' +
        '</div></div></div>'
      );
    }
    var p = platformByCode(ui.accessCode);
    if (!p) return '';
    return (
      '<div class="plt-modal-overlay" data-plt-access-overlay>' +
      '<div class="plt-modal" role="dialog" aria-modal="true">' +
      '<h3>طلب وصول لمنصة</h3>' +
      '<label>المنصة</label>' +
      '<input value="' +
      esc(p.nameAr || p.code) +
      '" readonly />' +
      '<label>العميل</label>' +
      '<input value="' +
      esc(actorName() + (userEmail() ? ' · ' + userEmail() : '')) +
      '" readonly />' +
      '<label for="plt-access-reason">سبب الطلب *</label>' +
      '<textarea id="plt-access-reason" data-plt-access-reason placeholder="لماذا تحتاج هذه المنصة؟">' +
      esc(ui.accessReason) +
      '</textarea>' +
      '<label for="plt-access-usage">الاستخدام المطلوب (اختياري)</label>' +
      '<textarea id="plt-access-usage" data-plt-access-usage placeholder="مثال: إدارة الحملات / تقارير شهرية">' +
      esc(ui.accessUsage) +
      '</textarea>' +
      '<div class="plt-modal-actions">' +
      '<button type="button" class="plt-ws-btn ghost" data-plt-close-access>إلغاء</button>' +
      '<button type="button" class="plt-ws-btn primary" data-plt-access-submit>إرسال الطلب</button>' +
      '</div></div></div>'
    );
  }

  function addModalHtml() {
    if (!ui.addOpen && !ui.addResult) return '';
    if (ui.addResult) {
      return (
        '<div class="plt-modal-overlay" data-plt-add-overlay>' +
        '<div class="plt-modal" role="dialog" aria-modal="true">' +
        '<h3>تم إرسال طلب إضافة المنصة</h3>' +
        '<p><strong>Request ID:</strong> <code dir="ltr">' +
        esc(ui.addResult.id) +
        '</code></p>' +
        '<p><strong>الحالة:</strong> ' +
        esc(ui.addResult.status) +
        '</p>' +
        '<div class="plt-modal-actions">' +
        '<button type="button" class="plt-ws-btn primary" data-plt-close-add>حسناً</button>' +
        '</div></div></div>'
      );
    }
    var cats = categoriesMap();
    var opts = Object.keys(cats)
      .map(function (k) {
        return (
          '<option value="' +
          esc(k) +
          '"' +
          (ui.addForm.category === k ? ' selected' : '') +
          '>' +
          esc(cats[k].label) +
          '</option>'
        );
      })
      .join('');
    return (
      '<div class="plt-modal-overlay" data-plt-add-overlay>' +
      '<div class="plt-modal wide" role="dialog" aria-modal="true">' +
      '<h3>طلب إضافة منصة</h3>' +
      '<label>اسم المنصة *</label><input data-plt-add="name" value="' +
      esc(ui.addForm.name) +
      '" />' +
      '<label>رابط المنصة *</label><input data-plt-add="url" value="' +
      esc(ui.addForm.url) +
      '" dir="ltr" placeholder="https://..." />' +
      '<label>التصنيف *</label><select data-plt-add="category">' +
      opts +
      '</select>' +
      '<label>وصف مختصر *</label><textarea data-plt-add="summary">' +
      esc(ui.addForm.summary) +
      '</textarea>' +
      '<label>سبب طلب الإضافة *</label><textarea data-plt-add="reason">' +
      esc(ui.addForm.reason) +
      '</textarea>' +
      '<label>شعار (اختياري — رابط)</label><input data-plt-add="logo" value="' +
      esc(ui.addForm.logo) +
      '" dir="ltr" />' +
      '<label>ملاحظات (اختياري)</label><textarea data-plt-add="notes">' +
      esc(ui.addForm.notes) +
      '</textarea>' +
      '<div class="plt-modal-actions">' +
      '<button type="button" class="plt-ws-btn ghost" data-plt-close-add>إلغاء</button>' +
      '<button type="button" class="plt-ws-btn primary" data-plt-add-submit>إرسال الطلب</button>' +
      '</div></div></div>'
    );
  }

  function stepHtml(n, title, text) {
    return (
      '<div class="plt-ws-step"><span class="plt-ws-step-num">' +
      n +
      '</span><div><strong>' +
      esc(title) +
      '</strong><span>' +
      esc(text) +
      '</span></div></div>'
    );
  }

  function faqItem(q, a) {
    return '<details><summary>' + esc(q) + '</summary><p>' + esc(a) + '</p></details>';
  }

  function render() {
    var all = catalog();
    var mine = minePlatforms();
    var list = filteredCatalog();
    var catCount = FRIENDLY_TABS.length - 1;

    root.innerHTML =
      '<section class="plt-ws-head">' +
      '<div>' +
      '<h1>منصات نايوش 360</h1>' +
      '<p>اكتشف منصات نايوش 360، تعرّف على وظيفة كل منصة، وادخل إلى الأدوات والخدمات المرتبطة بحسابك من مكان واحد.</p>' +
      '</div>' +
      '<div class="plt-ws-head-actions">' +
      '<button type="button" class="plt-ws-btn primary" data-plt-scroll="platforms-catalog">استكشف المنصات</button>' +
      '<button type="button" class="plt-ws-btn ghost" data-plt-scroll="platforms-mine">منصاتي</button>' +
      '<button type="button" class="plt-ws-btn ghost" data-plt-add-open><i class="fas fa-plus"></i> طلب إضافة منصة</button>' +
      '</div></section>' +
      '<section class="plt-ws-section" id="platforms-howto">' +
      '<h2>كيف تستخدم المنصات؟</h2>' +
      '<p class="plt-ws-lead">ثلاث خطوات بسيطة — بدون شراء عام أو مصطلحات معقدة.</p>' +
      '<div class="plt-ws-steps">' +
      stepHtml('1', 'اختر المنصة', 'ابحث أو اختر المنصة المناسبة لاحتياجك.') +
      stepHtml('2', 'اعرف التفاصيل', 'اطّلع على وظيفة المنصة والخدمات والصلاحيات المطلوبة.') +
      stepHtml('3', 'ابدأ الاستخدام', 'ادخل مباشرة إذا كانت متاحة، أو أرسل طلب وصول إذا كانت تحتاج موافقة.') +
      '</div></section>' +
      '<section class="plt-ws-stats" aria-label="ملخص سريع">' +
      '<button type="button" data-plt-scroll="platforms-catalog">' +
      esc(all.length) +
      ' منصة متاحة</button>' +
      '<span>·</span>' +
      '<button type="button" data-plt-scroll="platforms-browse">' +
      esc(catCount) +
      ' تصنيفات</button>' +
      '<span>·</span>' +
      '<button type="button" data-plt-scroll="platforms-mine">' +
      esc(mine.length) +
      ' منصة مرتبطة بحسابك</button>' +
      '</section>' +
      '<nav class="plt-ws-nav" aria-label="تنقل سريع">' +
      '<button type="button" data-plt-scroll="platforms-mine">منصاتي</button>' +
      '<button type="button" data-plt-scroll="platforms-catalog">استكشف المنصات</button>' +
      '<button type="button" data-plt-scroll="platforms-browse">التصنيفات</button>' +
      '<button type="button" data-plt-scroll="platforms-request">طلب منصة</button>' +
      '</nav>' +
      '<section class="plt-ws-section" id="platforms-browse">' +
      '<h2>البحث والتصنيفات</h2>' +
      '<p class="plt-ws-lead">ابحث بالاسم أو الخدمة، أو اختر تصنيفاً لتصفية القائمة فوراً.</p>' +
      '<div class="plt-ws-toolbar">' +
      '<input type="search" data-plt-q value="' +
      esc(ui.q) +
      '" placeholder="ابحث عن منصة أو خدمة..." aria-label="بحث المنصات" />' +
      '</div>' +
      '<p class="plt-ws-hint">مثال: ERP، CRM، إدارة مشاريع، تجارة إلكترونية...</p>' +
      tabsHtml(FRIENDLY_TABS, ui.friendlyTab) +
      '</section>' +
      '<section class="plt-ws-section" id="platforms-mine">' +
      '<h2>منصاتي</h2>' +
      '<p class="plt-ws-lead">المنصات التي تستطيع استخدامها الآن من حسابك.</p>' +
      '<div class="plt-ws-cards">' +
      (mine.length
        ? mine.map(function (p) {
            return cardHtml(p, true);
          }).join('')
        : '<div class="plt-empty"><i class="fas fa-layer-group"></i>لا توجد منصات مرتبطة بحسابك حتى الآن.' +
          '<div style="margin-top:14px"><button type="button" class="plt-ws-btn primary" data-plt-scroll="platforms-catalog">استكشف المنصات</button></div></div>') +
      '</div></section>' +
      '<section class="plt-ws-section" id="platforms-catalog">' +
      '<h2>جميع المنصات</h2>' +
      '<p class="plt-ws-lead">تصفّح المنصات حسب البحث والتصنيف أعلاه.</p>' +
      '<div class="plt-ws-cards">' +
      (list.length
        ? list
            .map(function (p) {
              return cardHtml(p, false);
            })
            .join('')
        : '<div class="plt-empty"><i class="fas fa-search"></i>لا توجد منصات مطابقة — غيّر البحث أو التصنيف.</div>') +
      '</div></section>' +
      '<section class="plt-ws-section" id="platforms-request">' +
      '<h2>طلب إضافة منصة</h2>' +
      '<p class="plt-ws-lead">هل تحتاج منصة غير موجودة في الدليل؟ أرسل طلباً ليراجعه فريق الأنظمة.</p>' +
      '<button type="button" class="plt-ws-btn primary" data-plt-add-open><i class="fas fa-plus"></i> طلب إضافة منصة</button>' +
      '</section>' +
      '<section class="plt-ws-section plt-faq" id="platforms-faq">' +
      '<h2>أسئلة شائعة</h2>' +
      faqItem(
        'كيف أحصل على وصول منصة؟',
        'اضغط «طلب الوصول» على المنصة المطلوبة. بعد موافقة الإدارة يُفعَّل الوصول في «منصاتي» ويظهر زر «فتح المنصة».'
      ) +
      faqItem(
        'هل كل المنصات تحتاج موافقة؟',
        'منصتا التسويق والاتصال (NMS و NCS) متاحتان للتجربة. باقي المنصات تتطلب طلب وصول أو منحة نشطة على حسابك.'
      ) +
      faqItem(
        'كيف أطلب إضافة منصة جديدة؟',
        'استخدم «طلب إضافة منصة» واملأ البيانات — يصل الطلب فوراً إلى بوشا ← طلبات العملاء.'
      ) +
      '</section>' +
      (document.getElementById('platform-ads') ? '<div id="platform-ads-mount"></div>' : '') +
      detailModalHtml() +
      accessModalHtml() +
      addModalHtml();

    mountAds();
    bind();
  }

  function mountAds() {
    var ads = document.getElementById('platform-ads');
    var mount = root.querySelector('#platform-ads-mount');
    if (ads && mount && !mount.contains(ads)) {
      ads.hidden = false;
      mount.appendChild(ads);
    }
  }

  function bind() {
    root.querySelectorAll('[data-plt-scroll]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        scrollToId(btn.getAttribute('data-plt-scroll'));
      });
    });
    root.querySelectorAll('[data-plt-friendly]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.friendlyTab = btn.getAttribute('data-plt-friendly') || 'all';
        render();
      });
    });
    var qEl = root.querySelector('[data-plt-q]');
    if (qEl) {
      qEl.addEventListener('input', function () {
        ui.q = qEl.value;
        render();
        var again = root.querySelector('[data-plt-q]');
        if (again) {
          again.focus();
          try {
            again.setSelectionRange(again.value.length, again.value.length);
          } catch (e) {}
        }
      });
    }
    root.querySelectorAll('[data-plt-detail]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.detailCode = btn.getAttribute('data-plt-detail') || '';
        ui.accessCode = '';
        ui.accessResult = null;
        render();
      });
    });
    root.querySelectorAll('[data-plt-open]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openPlatform(btn.getAttribute('data-plt-open'));
      });
    });
    root.querySelectorAll('[data-plt-access]').forEach(function (btn) {
      if (btn.hasAttribute('disabled')) return;
      btn.addEventListener('click', function () {
        if (!requireLogin('#platforms-catalog')) return;
        ui.detailCode = '';
        ui.accessCode = btn.getAttribute('data-plt-access') || '';
        ui.accessReason = '';
        ui.accessUsage = '';
        ui.accessResult = null;
        render();
      });
    });
    root.querySelectorAll('[data-plt-add-open]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!requireLogin('#platforms-request')) return;
        ui.addOpen = true;
        ui.addResult = null;
        render();
      });
    });

    var detailOv = root.querySelector('[data-plt-detail-overlay]');
    if (detailOv) {
      detailOv.addEventListener('click', function (e) {
        if (e.target === detailOv || e.target.closest('[data-plt-close-detail]')) {
          ui.detailCode = '';
          render();
        }
      });
    }
    var accessOv = root.querySelector('[data-plt-access-overlay]');
    if (accessOv) {
      accessOv.addEventListener('click', function (e) {
        if (e.target === accessOv || e.target.closest('[data-plt-close-access]')) {
          ui.accessCode = '';
          ui.accessResult = null;
          render();
        }
      });
      var ta = accessOv.querySelector('[data-plt-access-reason]');
      if (ta) {
        ta.addEventListener('input', function () {
          ui.accessReason = ta.value;
        });
      }
      var tu = accessOv.querySelector('[data-plt-access-usage]');
      if (tu) {
        tu.addEventListener('input', function () {
          ui.accessUsage = tu.value;
        });
      }
      var sub = accessOv.querySelector('[data-plt-access-submit]');
      if (sub) sub.addEventListener('click', submitAccessRequest);
    }
    var addOv = root.querySelector('[data-plt-add-overlay]');
    if (addOv) {
      addOv.addEventListener('click', function (e) {
        if (e.target === addOv || e.target.closest('[data-plt-close-add]')) {
          ui.addOpen = false;
          ui.addResult = null;
          render();
        }
      });
      addOv.querySelectorAll('[data-plt-add]').forEach(function (el) {
        el.addEventListener('input', function () {
          ui.addForm[el.getAttribute('data-plt-add')] = el.value;
        });
        el.addEventListener('change', function () {
          ui.addForm[el.getAttribute('data-plt-add')] = el.value;
        });
      });
      var addSub = addOv.querySelector('[data-plt-add-submit]');
      if (addSub) addSub.addEventListener('click', submitAddPlatform);
    }
  }

  function applyHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (
      h === 'platforms-mine' ||
      h === 'platforms-catalog' ||
      h === 'platforms-faq' ||
      h === 'platforms-browse' ||
      h === 'platforms-request' ||
      h === 'platforms-howto'
    ) {
      setTimeout(function () {
        scrollToId(h);
      }, 80);
    }
  }

  syncApprovedRequests();
  applyHash();
  render();

  window.addEventListener('hashchange', applyHash);
  window.addEventListener('hub-customer-requests-changed', function () {
    syncApprovedRequests();
    render();
  });
  window.addEventListener('hub-platform-access-changed', function () {
    render();
  });
  window.addEventListener('hub:auth', function () {
    syncApprovedRequests();
    render();
  });

  window.HubPlatformsWorkspace = {
    hasAccess: hasAccess,
    openPlatform: openPlatform,
    resolvePlatformHref: resolvePlatformHref,
    minePlatforms: minePlatforms,
    grantAccess: grantAccess,
  };
})();
