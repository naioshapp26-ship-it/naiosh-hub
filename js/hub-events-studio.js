/**
 * Events studio — staff operations + customer catalog/create/register.
 * Single API SoT: /api/hub/events
 */
(function () {
  'use strict';

  var root = document.getElementById('ev-root');
  if (!root) return;

  var WIZARD_STEPS = ['المعلومات الأساسية', 'التاريخ والمكان', 'التسجيل', 'بيانات المنظم', 'المعاينة والمراجعة'];

  var state = {
    section: 'dashboard',
    meta: null,
    me: { staff: false, guest: true },
    summary: {},
    items: [],
    publicItems: [],
    videos: [],
    clips: [],
    activity: [],
    registrations: [],
    mineRegs: [],
    event: null,
    wizardOpen: false,
    wizardStep: 0,
    wizard: blankWizard(),
    filters: { q: '', status: '', upcoming: '' },
    busy: false,
    error: '',
    recRecorder: null,
    recChunks: [],
    recStream: null,
  };

  function blankWizard() {
    return {
      id: '',
      name: '',
      category: 'ورشة',
      summary: '',
      description: '',
      coverImage: '',
      startDate: '',
      startTime: '18:00',
      endDate: '',
      endTime: '',
      attendanceType: 'in_person',
      address: '',
      city: '',
      country: '',
      onlineUrl: '',
      mapsUrl: '',
      requiresRegistration: true,
      pricing: 'free',
      priceUsd: 0,
      seats: '',
      registrationEnds: '',
      organizerName: '',
      organizerEmail: '',
      organizerPhone: '',
      organizerWebsite: '',
    };
  }

  function lat(v) {
    return String(v == null ? '' : v).replace(/[٠-٩]/g, function (d) {
      return '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)];
    });
  }
  function usd(n) {
    return '\u202A$' + lat(Number(n || 0)) + '\u202C';
  }
  function num(v) {
    var n = Number(v || 0);
    if (!isFinite(n)) return lat(v);
    return lat(n.toLocaleString('en-US'));
  }
  function fmtDate(v) {
    if (!v) return '—';
    var d = String(v).slice(0, 10).split('-');
    if (d.length !== 3) return lat(v);
    return lat(d[2] + '/' + d[1] + '/' + d[0]);
  }
  function fmtTime(v) {
    if (!v) return '—';
    return lat(String(v).slice(0, 5));
  }
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function toast(msg) {
    var el = document.createElement('div');
    el.className = 'ev-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2800);
  }
  var HUB_HOME_URL = 'https://www.naioshai.com/';

  function isStaff() {
    return !!(state.me && state.me.staff);
  }
  function loggedIn() {
    return !!(window.HubAuth && HubAuth.isLoggedIn && HubAuth.isLoggedIn());
  }

  /**
   * Navigation context for the back button only — never grants admin powers.
   * Admin entry is set by the dashboard before opening the studio; public
   * referrers (home/hero/nav) force the external "back to home" path.
   */
  function resolveStudioEntry() {
    try {
      var ref = document.referrer || '';
      var fromDash = false;
      if (ref) {
        var u = new URL(ref, location.href);
        if (u.origin === location.origin && /\/dashboard\.html$/i.test(u.pathname)) {
          fromDash = true;
          sessionStorage.setItem('hubStudioEntry', 'admin');
        } else if (u.origin === location.origin || /naioshai\.com$/i.test(u.hostname)) {
          // Public site / hero / general nav → external studio
          sessionStorage.setItem('hubStudioEntry', 'public');
        }
      }
      if (fromDash) return 'admin';
      var entry = sessionStorage.getItem('hubStudioEntry') || '';
      if (entry === 'admin') return 'admin';
      return 'public';
    } catch (_) {
      return 'public';
    }
  }

  function isAdminStudioEntry() {
    return resolveStudioEntry() === 'admin' && isStaff();
  }

  function adminReturnHref() {
    var ret = 'dashboard.html#overview';
    try {
      var stored = sessionStorage.getItem('hubStudioReturn') || localStorage.getItem('hubStudioReturn') || '';
      if (/^dashboard\.html(#|$)/i.test(stored)) ret = stored;
    } catch (_) {}
    return ret;
  }

  function heroBackHtml() {
    if (isAdminStudioEntry()) {
      return (
        '<a class="ev-btn ghost" data-ev-back="admin" href="' +
        esc(adminReturnHref()) +
        '"><i class="fas fa-arrow-right"></i> رجوع إلى لوحة التحكم</a>'
      );
    }
    return (
      '<a class="ev-btn ghost" data-ev-back="home" href="' +
      esc(HUB_HOME_URL) +
      '"><i class="fas fa-house"></i> العودة للرئيسية</a>'
    );
  }
  function headers(extra) {
    return (window.HubAuth && HubAuth.authHeaders && HubAuth.authHeaders(extra || {})) || extra || {};
  }
  function idem() {
    return 'ev-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  async function api(path, opts) {
    opts = opts || {};
    var h = headers(opts.headers || {});
    if (opts.body && !opts.raw) h['Content-Type'] = 'application/json';
    var res = await fetch(path, {
      method: opts.method || 'GET',
      headers: h,
      body: opts.body && h['Content-Type'] === 'application/json' ? JSON.stringify(opts.body) : opts.body,
    });
    var data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(data.error || 'تعذر تنفيذ العملية');
    return data;
  }

  async function uploadFile(file) {
    if (window.HubUploadLimits && HubUploadLimits.uploadFile) {
      return HubUploadLimits.uploadFile(file);
    }
    var buf = await file.arrayBuffer();
    var h = headers({
      'X-File-Name': encodeURIComponent(file.name),
      'X-File-Type': file.type || 'application/octet-stream',
      'Content-Type': file.type || 'application/octet-stream',
    });
    var res = await fetch('/api/hub/uploads', { method: 'POST', headers: h, body: buf });
    var data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(data.error || 'فشل رفع الملف');
    return data;
  }

  function badge(status, label) {
    var cls = status === 'published' || status === 'approved' ? 'active'
      : status === 'pending_review' || status === 'needs_changes' || status === 'draft' ? 'pending'
      : status === 'rejected' || status === 'paused' ? 'danger' : '';
    return '<span class="ev-badge ' + cls + '">' + esc(label || status) + '</span>';
  }

  function attendanceLabel(t) {
    if (t === 'online') return 'أونلاين';
    if (t === 'hybrid') return 'هجين';
    return 'حضوري';
  }

  function pricingLabel(e) {
    if (e.pricing === 'paid') return 'مدفوعة · ' + usd(e.priceUsd);
    return 'مجانية';
  }

  function setSection(sec) {
    state.section = sec;
    state.wizardOpen = sec === 'create';
    if (sec !== 'detail') state.event = null;
    location.hash = 'section=' + sec;
    render();
  }

  function wizardFromEvent(e) {
    var w = blankWizard();
    Object.keys(w).forEach(function (k) {
      if (e[k] != null) w[k] = e[k];
    });
    w.id = e.id;
    w.seats = e.seats == null ? '' : e.seats;
    return w;
  }

  async function refreshAll() {
    state.error = '';
    try {
      var meta = await api('/api/hub/events/meta');
      state.meta = meta.meta || {};
      state.me = meta.me || { staff: false, guest: true };
      if (!loggedIn()) {
        var pub = await fetch('/api/hub/events/public').then(function (r) { return r.json(); });
        state.publicItems = pub.items || [];
        state.section = 'explore';
        render();
        return;
      }
      if (isStaff()) {
        var sum = await api('/api/hub/events/summary');
        state.summary = sum.summary || {};
        var qs = new URLSearchParams();
        if (state.filters.q) qs.set('q', state.filters.q);
        if (state.filters.status) qs.set('status', state.filters.status);
        if (state.filters.upcoming) qs.set('upcoming', '1');
        var list = await api('/api/hub/events' + (qs.toString() ? '?' + qs : ''));
        state.items = list.items || [];
        var vids = await api('/api/hub/events/videos');
        state.videos = vids.items || [];
        var clips = await api('/api/hub/events/clips');
        state.clips = clips.items || [];
        var act = await api('/api/hub/events/activity');
        state.activity = act.items || [];
        var regs = await api('/api/hub/events/registrations');
        state.registrations = regs.items || [];
      } else {
        var mine = await api('/api/hub/events?mine=1');
        state.items = mine.items || [];
        var pub2 = await api('/api/hub/events/public').catch(function () { return { items: [] }; });
        if (!pub2.items) {
          pub2 = await fetch('/api/hub/events/public').then(function (r) { return r.json(); }).catch(function () { return { items: [] }; });
        }
        state.publicItems = pub2.items || [];
        var myr = await api('/api/hub/events/mine/registrations');
        state.mineRegs = myr.items || [];
        var sum2 = await api('/api/hub/events/summary');
        state.summary = sum2.summary || {};
        if (['dashboard', 'videos', 'clips', 'clipmaker', 'publish', 'record', 'register-admin'].indexOf(state.section) >= 0) {
          state.section = 'explore';
        }
      }
    } catch (err) {
      state.error = err.message || String(err);
    }
    render();
  }

  async function openEvent(id) {
    var data = await api('/api/hub/events/' + encodeURIComponent(id));
    state.event = data.event;
    state.section = 'detail';
    location.hash = 'event=' + id;
    render();
  }

  function requireLoginMsg() {
    if (window.HubAuth && HubAuth.showGuestGate) {
      HubAuth.showGuestGate({ message: 'سجّل الدخول للمتابعة', next: 'events.html' });
      return false;
    }
    window.location.href = 'login.html?next=events.html';
    return false;
  }

  function hero() {
    var staff = isStaff();
    var adminEntry = isAdminStudioEntry();
    return (
      '<header class="ev-hero">' +
        '<div><h1>استوديو الفعاليات الذكي</h1>' +
        '<p>' + (staff
          ? 'إنشاء الفعاليات ومراجعتها ونشرها والتسجيل فيها من مصدر بيانات واحد.'
          : 'استكشف الفعاليات المنشورة، أنشئ فعاليتك، وتابع تسجيلاتك من حسابك.') +
        '</p></div>' +
        '<div class="ev-hero-actions">' +
          heroBackHtml() +
          (loggedIn()
            ? '<button class="ev-btn primary" data-ev="new"><i class="fas fa-plus"></i> إنشاء فعالية</button>'
            : '<button class="ev-btn primary" data-ev="login"><i class="fas fa-plus"></i> إنشاء فعالية</button>') +
          (staff ? '<button class="ev-btn ghost" data-sec="manage"><i class="fas fa-layer-group"></i> إدارة الفعاليات</button>' : '') +
          (staff ? '<button class="ev-btn ghost" data-ev="upload-video"><i class="fas fa-video"></i> رفع فيديو</button>' : '') +
          (!adminEntry && loggedIn() && !staff
            ? '<a class="ev-btn ghost" href="client.html"><i class="fas fa-user"></i> حسابي</a>'
            : '') +
        '</div></header>'
    );
  }

  function nav() {
    if (!loggedIn()) return '';
    if (!isStaff()) {
      var cust = [
        ['explore', 'fa-compass', 'استكشاف الفعاليات'],
        ['create', 'fa-plus', 'إنشاء فعالية'],
        ['mine', 'fa-folder-open', 'فعالياتي'],
        ['myregs', 'fa-ticket', 'تسجيلاتي'],
      ];
      return (
        '<nav class="ev-nav-primary">' +
        cust.map(function (it) {
          return '<button type="button" class="' + (state.section === it[0] ? 'is-on' : '') + '" data-sec="' + it[0] + '"><i class="fas ' + it[1] + '"></i> ' + it[2] + '</button>';
        }).join('') +
        '</nav>'
      );
    }
    var primary = [
      ['dashboard', 'لوحة الاستوديو'],
      ['create', 'إنشاء فعالية'],
      ['manage', 'إدارة الفعاليات'],
    ];
    var tools = [
      ['register-admin', 'fa-clipboard-list', 'تسجيل الفعاليات'],
      ['videos', 'fa-photo-film', 'مكتبة الفيديو'],
      ['clipmaker', 'fa-scissors', 'صانع المقاطع القصيرة'],
      ['clips', 'fa-film', 'مكتبة المقاطع القصيرة'],
      ['publish', 'fa-share-nodes', 'النشر والتوزيع'],
      ['record', 'fa-circle-dot', 'تصوير ريلز ذاتي'],
    ];
    return (
      '<nav class="ev-nav-primary">' +
      primary.map(function (it) {
        return '<button type="button" class="' + (state.section === it[0] ? 'is-on' : '') + '" data-sec="' + it[0] + '">' + it[1] + '</button>';
      }).join('') +
      '</nav>' +
      '<div class="ev-tools">' +
      tools.map(function (it) {
        return '<button type="button" class="' + (state.section === it[0] ? 'is-on' : '') + '" data-sec="' + it[0] + '"><i class="fas ' + it[1] + '"></i> ' + it[2] + '</button>';
      }).join('') +
      '</div>'
    );
  }

  function dashboardHtml() {
    var s = state.summary || {};
    var cards = [
      ['upcoming', 'فعاليات قادمة', s.upcoming, 'upcoming'],
      ['pending', 'فعاليات بانتظار المراجعة', s.pending, 'pending_review'],
      ['drafts', 'مسودات', s.drafts, 'draft'],
      ['videos', 'المقاطع المسجلة', s.videos, 'videos'],
      ['clips', 'مقاطع ريلز جاهزة', s.clipsReady, 'clips'],
    ];
    return (
      '<section class="ev-panel">' +
        '<h2>ملخص الاستوديو</h2>' +
        '<p class="ev-meta">هذه الأرقام تُحسب من قاعدة الفعاليات الفعلية — اضغط البطاقة لفتح القائمة.</p>' +
        '<div class="ev-kpis">' +
        cards.map(function (c) {
          return (
            '<article class="ev-kpi" data-kpi="' + esc(c[3]) + '"><strong>' +
            lat(c[2] == null ? 0 : c[2]) +
            '</strong><span>' + esc(c[1]) + '</span></article>'
          );
        }).join('') +
        '</div></section>' +
        latestTable()
    );
  }

  function latestTable() {
    var rows = (state.items || []).slice(0, 10);
    if (!rows.length) {
      return '<section class="ev-panel"><div class="ev-empty">لا توجد فعاليات مضافة حتى الآن.<br><button class="ev-btn primary" data-ev="new" style="margin-top:12px">إنشاء أول فعالية</button></div></section>';
    }
    return (
      '<section class="ev-panel"><h3>آخر الفعاليات المضافة</h3>' +
      '<div style="overflow:auto"><table class="ev-table"><thead><tr>' +
      '<th>الفعالية</th><th>رقم الفعالية</th><th>التاريخ</th><th>الوقت</th><th>نوع الحضور</th><th>الحالة</th><th>الإجراءات</th>' +
      '</tr></thead><tbody>' +
      rows.map(function (e) {
        return (
          '<tr data-open="' + esc(e.id) + '"><td>' + esc(e.name) + '</td><td><code>' + esc(e.id) +
          '</code></td><td>' + fmtDate(e.startDate) + '</td><td>' + fmtTime(e.startTime) +
          '</td><td>' + esc(e.attendanceLabel || attendanceLabel(e.attendanceType)) +
          '</td><td>' + badge(e.status, e.statusLabel) +
          '</td><td><button class="ev-btn light" data-open="' + esc(e.id) + '">عرض</button></td></tr>'
        );
      }).join('') +
      '</tbody></table></div></section>'
    );
  }

  function field(key, label, val, type) {
    return (
      '<label>' + esc(label) +
      '<input data-w="' + esc(key) + '" type="' + (type || 'text') + '" value="' + esc(val == null ? '' : val) + '"></label>'
    );
  }
  function area(key, label, val) {
    return '<label class="ev-span-2">' + esc(label) + '<textarea data-w="' + esc(key) + '" rows="4">' + esc(val || '') + '</textarea></label>';
  }
  function sel(key, label, opts, val) {
    return (
      '<label>' + esc(label) + '<select data-w="' + esc(key) + '">' +
      opts.map(function (o) {
        var id = String(o).split('|')[0];
        var lab = String(o).split('|')[1] || id;
        return '<option value="' + esc(id) + '"' + (String(val) === id ? ' selected' : '') + '>' + esc(lab) + '</option>';
      }).join('') +
      '</select></label>'
    );
  }

  function wizardHtml() {
    var w = state.wizard;
    var step = state.wizardStep;
    var cats = (state.meta && state.meta.categories) || ['مؤتمر', 'ورشة', 'ندوة', 'دورة', 'إطلاق', 'تدريب', 'معرض', 'بث مباشر', 'أخرى'];
    var body = '';
    if (step === 0) {
      body =
        field('name', 'اسم الفعالية', w.name) +
        sel('category', 'التصنيف', cats, w.category) +
        area('summary', 'وصف مختصر', w.summary) +
        area('description', 'الوصف الكامل', w.description) +
        '<label class="ev-span-2">صورة الغلاف' +
        (w.coverImage ? '<img src="' + esc(w.coverImage) + '" alt="" style="max-height:120px;border-radius:10px;margin:6px 0">' : '') +
        '<input type="file" accept="image/*" data-cover></label>';
    } else if (step === 1) {
      body =
        field('startDate', 'تاريخ البداية', w.startDate, 'date') +
        field('startTime', 'وقت البداية', w.startTime, 'time') +
        field('endDate', 'تاريخ النهاية', w.endDate, 'date') +
        field('endTime', 'وقت النهاية', w.endTime, 'time') +
        sel('attendanceType', 'نوع الحضور', ['in_person|حضوري', 'online|أونلاين', 'hybrid|هجين'], w.attendanceType) +
        (w.attendanceType !== 'online'
          ? field('address', 'العنوان', w.address) + field('city', 'المدينة', w.city) + field('country', 'الدولة', w.country) + field('mapsUrl', 'رابط الخريطة', w.mapsUrl)
          : '') +
        (w.attendanceType !== 'in_person' ? field('onlineUrl', 'رابط الانضمام', w.onlineUrl) : '');
    } else if (step === 2) {
      body =
        sel('requiresRegistration', 'هل تحتاج تسجيل؟', ['true|نعم', 'false|لا'], String(w.requiresRegistration !== false)) +
        sel('pricing', 'مجانية أم مدفوعة؟', ['free|مجانية', 'paid|مدفوعة'], w.pricing) +
        (w.pricing === 'paid' ? field('priceUsd', 'السعر بالدولار', w.priceUsd, 'number') : '') +
        field('seats', 'عدد المقاعد', w.seats, 'number') +
        field('registrationEnds', 'آخر موعد للتسجيل', w.registrationEnds, 'date');
    } else if (step === 3) {
      body =
        field('organizerName', 'اسم المنظم', w.organizerName) +
        field('organizerEmail', 'البريد الإلكتروني', w.organizerEmail) +
        field('organizerPhone', 'الهاتف', w.organizerPhone) +
        field('organizerWebsite', 'الموقع إن وجد', w.organizerWebsite);
    } else {
      body =
        '<div class="ev-span-2"><p><b>الاسم:</b> ' + esc(w.name) + '</p>' +
        '<p><b>التصنيف:</b> ' + esc(w.category) + '</p>' +
        '<p><b>التاريخ:</b> ' + fmtDate(w.startDate) + ' ' + fmtTime(w.startTime) + '</p>' +
        '<p><b>الحضور:</b> ' + esc(attendanceLabel(w.attendanceType)) + '</p>' +
        '<p><b>التسعير:</b> ' + (w.pricing === 'paid' ? 'مدفوعة · ' + usd(w.priceUsd) : 'مجانية') + '</p>' +
        (w.id ? '<p><b>رقم الفعالية:</b> <code>' + esc(w.id) + '</code></p>' : '<p class="ev-meta">سيُنشأ رقم الفعالية عند الحفظ.</p>') +
        '</div>';
    }
    return (
      '<section class="ev-panel" data-wizard>' +
      '<h2>إنشاء فعالية</h2>' +
      '<div class="ev-steps">' +
      WIZARD_STEPS.map(function (s, i) {
        return '<span class="' + (i === step ? 'is-on' : '') + '">' + lat(i + 1) + '. ' + s + '</span>';
      }).join('') +
      '</div>' +
      '<div class="ev-form">' + body + '</div>' +
      '<div class="ev-actions" style="margin-top:14px">' +
      (step > 0 ? '<button class="ev-btn light" data-wiz="back">السابق</button>' : '') +
      '<button class="ev-btn light" data-wiz="draft">حفظ كمسودة</button>' +
      '<button class="ev-btn light" data-wiz="preview">معاينة</button>' +
      (step < WIZARD_STEPS.length - 1
        ? '<button class="ev-btn primary" data-wiz="next">التالي</button>'
        : '<button class="ev-btn primary" data-wiz="submit">إرسال للمراجعة</button>') +
      '</div></section>'
    );
  }

  function manageHtml() {
    var rows = state.items || [];
    return (
      '<section class="ev-panel"><div class="ev-detail-head"><h2>إدارة الفعاليات</h2>' +
      '<button class="ev-btn primary" data-ev="new"><i class="fas fa-plus"></i> إضافة فعالية</button></div>' +
      '<div class="ev-form" style="margin-bottom:10px">' +
      '<label>بحث<input data-filter="q" value="' + esc(state.filters.q) + '" placeholder="اسم أو EVT-..."></label>' +
      '<label>الحالة<select data-filter="status"><option value="">الكل</option>' +
      ((state.meta && state.meta.statuses) || []).map(function (s) {
        return '<option value="' + esc(s.id) + '"' + (state.filters.status === s.id ? ' selected' : '') + '>' + esc(s.label) + '</option>';
      }).join('') +
      '</select></label></div>' +
      (!rows.length
        ? '<div class="ev-empty">لا توجد فعاليات مضافة حتى الآن.<br><button class="ev-btn primary" data-ev="new" style="margin-top:12px">إنشاء أول فعالية</button></div>'
        : '<div style="overflow:auto"><table class="ev-table"><thead><tr>' +
          '<th>رقم الفعالية</th><th>اسم الفعالية</th><th>التاريخ</th><th>نوع الحضور</th><th>السعر</th><th>التسجيلات</th><th>الحالة</th><th>آخر تحديث</th><th>الإجراءات</th>' +
          '</tr></thead><tbody>' +
          rows.map(function (e) {
            return (
              '<tr><td><code>' + esc(e.id) + '</code></td><td>' + esc(e.name) + '</td><td>' + fmtDate(e.startDate) +
              '</td><td>' + esc(e.attendanceLabel || attendanceLabel(e.attendanceType)) +
              '</td><td>' + esc(pricingLabel(e)) +
              '</td><td>' + lat(e.registrationsCount || 0) + (e.seats != null ? ' / ' + lat(e.seats) : '') +
              '</td><td>' + badge(e.status, e.statusLabel) +
              '</td><td>' + fmtDate(e.updatedAt) + ' ' + fmtTime((e.updatedAt || '').slice(11, 16)) +
              '</td><td class="ev-actions">' + rowActions(e) + '</td></tr>'
            );
          }).join('') +
          '</tbody></table></div>') +
      '</section>'
    );
  }

  function rowActions(e) {
    var html = '<button class="ev-btn light" data-open="' + esc(e.id) + '">عرض</button>';
    html += '<button class="ev-btn light" data-open="' + esc(e.id) + '">معاينة</button>';
    if (e.status === 'draft' || e.status === 'needs_changes') {
      html += '<button class="ev-btn light" data-act="edit" data-id="' + esc(e.id) + '">تعديل</button>';
      html += '<button class="ev-btn primary" data-act="submit" data-id="' + esc(e.id) + '">إرسال للمراجعة</button>';
    }
    if (e.status === 'published' && isStaff()) {
      html += '<button class="ev-btn light" data-act="pause" data-id="' + esc(e.id) + '">إيقاف</button>';
    }
    if (e.status === 'paused' && isStaff()) {
      html += '<button class="ev-btn light" data-act="resume" data-id="' + esc(e.id) + '">إعادة تفعيل</button>';
    }
    if (e.status === 'draft') {
      html += '<button class="ev-btn danger" data-act="delete" data-id="' + esc(e.id) + '">حذف</button>';
    } else if (isStaff() && e.status !== 'ended') {
      html += '<button class="ev-btn light" data-act="archive" data-id="' + esc(e.id) + '">أرشفة</button>';
    }
    return html;
  }

  function exploreHtml() {
    var rows = state.publicItems.length ? state.publicItems : (state.items || []).filter(function (e) { return e.status === 'published'; });
    if (!rows.length) {
      return '<section class="ev-panel"><div class="ev-empty">لا توجد فعاليات منشورة حالياً.</div></section>';
    }
    return (
      '<section class="ev-panel"><h2>الفعاليات المنشورة</h2>' +
      '<div class="ev-cards">' +
      rows.map(function (e) {
        var cta = e.full
          ? '<span class="ev-badge danger">اكتمل العدد</span>'
          : e.pricing === 'paid'
            ? 'احجز الآن – ' + usd(e.priceUsd)
            : 'سجل مجانًا';
        return (
          '<article class="ev-card" data-open="' + esc(e.id) + '"><h3>' + esc(e.name) + '</h3>' +
          '<p class="ev-meta"><code>' + esc(e.id) + '</code> · ' + fmtDate(e.startDate) + ' · ' + esc(e.attendanceLabel || attendanceLabel(e.attendanceType)) + '</p>' +
          '<p>' + esc(e.summary || '') + '</p>' +
          '<p>' + badge(e.status, e.statusLabel) + ' ' + esc(pricingLabel(e)) + '</p>' +
          '<p>' + (typeof cta === 'string' && cta.indexOf('اكتمل') >= 0 ? cta : '<span class="ev-btn primary">' + cta + '</span>') + '</p></article>'
        );
      }).join('') +
      '</div></section>'
    );
  }

  function detailHtml() {
    var e = state.event;
    if (!e) return '<div class="ev-empty">الفعالية غير موجودة</div>';
    var own = (e.ownerEmail || '').toLowerCase() === String((state.me && state.me.email) || '').toLowerCase();
    var cta = '';
    if (e.status === 'published' && e.requiresRegistration !== false) {
      if (e.full) cta = '<button class="ev-btn light" disabled>اكتمل العدد</button>';
      else if (e.pricing === 'paid') cta = '<button class="ev-btn primary" data-ev="register">احجز الآن – ' + usd(e.priceUsd) + '</button>';
      else cta = '<button class="ev-btn primary" data-ev="register">سجل مجانًا</button>';
    }
    var adminActs = '';
    if (isStaff() && e.status === 'pending_review') {
      adminActs =
        '<button class="ev-btn primary" data-act="approve" data-id="' + esc(e.id) + '">قبول ونشر</button>' +
        '<button class="ev-btn light" data-act="request_changes" data-id="' + esc(e.id) + '">طلب تعديل</button>' +
        '<button class="ev-btn danger" data-act="reject" data-id="' + esc(e.id) + '">رفض</button>';
    }
    return (
      '<section class="ev-panel" data-event-page data-event-id="' + esc(e.id) + '">' +
      '<div class="ev-detail-head"><div>' +
      '<h2>' + esc(e.name) + '</h2>' +
      '<p class="ev-meta"><code>' + esc(e.id) + '</code>' +
      (e.requestId ? ' · طلب: <code>' + esc(e.requestId) + '</code>' : '') +
      ' · ' + badge(e.status, e.statusLabel) + '</p></div>' +
      '<div class="ev-actions">' + cta + adminActs +
      ((e.status === 'draft' || e.status === 'needs_changes') && (own || isStaff())
        ? '<button class="ev-btn light" data-act="edit" data-id="' + esc(e.id) + '">تعديل</button>' +
          '<button class="ev-btn primary" data-act="submit" data-id="' + esc(e.id) + '">إرسال للمراجعة</button>'
        : '') +
      '</div></div>' +
      (e.changeRequestNote ? '<div class="ev-alert">سبب طلب التعديل: ' + esc(e.changeRequestNote) + '<br><button class="ev-btn primary" data-act="edit" data-id="' + esc(e.id) + '">تعديل وإعادة الإرسال</button></div>' : '') +
      (e.rejectionReason ? '<div class="ev-alert danger">سبب الرفض: ' + esc(e.rejectionReason) + '</div>' : '') +
      '<div class="ev-cards" style="margin-top:12px">' +
      '<article class="ev-card"><h3>التفاصيل</h3><p>' + esc(e.description || e.summary || '') + '</p>' +
      '<p>التصنيف: ' + esc(e.category) + '</p>' +
      '<p>التاريخ: ' + fmtDate(e.startDate) + ' ' + fmtTime(e.startTime) + '</p>' +
      '<p>الحضور: ' + esc(e.attendanceLabel) + '</p>' +
      (e.address ? '<p>المكان: ' + esc(e.address) + ' ' + esc(e.city || '') + '</p>' : '') +
      (e.onlineUrl ? '<p>رابط الانضمام: ' + esc(e.onlineUrl) + '</p>' : '') +
      '<p>التسعير: ' + esc(pricingLabel(e)) + '</p>' +
      '<p>المقاعد: ' + (e.seats == null ? 'غير محدودة' : lat(e.seatsTaken || 0) + ' / ' + lat(e.seats)) + '</p>' +
      '</article>' +
      '<article class="ev-card"><h3>المنظم</h3><p>' + esc(e.organizerName || e.ownerName || '') + '</p><p>' + esc(e.organizerEmail || e.ownerEmail || '') + '</p></article>' +
      '<article class="ev-card"><h3>المرفقات</h3>' +
      ((e.assets || []).length
        ? (e.assets || []).map(function (a) {
            return '<p><code>' + esc(a.id) + '</code> · ' + esc(a.name) + ' · <a href="' + esc(a.url) + '" target="_blank">عرض</a></p>';
          }).join('')
        : '<p class="ev-meta">لا مرفقات بعد.</p>') +
      ((own || isStaff()) && (e.status === 'draft' || e.status === 'needs_changes' || isStaff())
        ? '<label class="ev-drop">إضافة مرفق للفعالية<input type="file" data-file hidden></label>'
        : '') +
      '</article></div>' +
      (isStaff() || own
        ? '<h3>التسجيلات</h3>' + regsTable(e.registrations || []) +
          '<h3>النشاط</h3><ul>' + (e.activity || []).slice(0, 12).map(function (a) {
            return '<li>' + fmtDate(a.at) + ' ' + fmtTime((a.at || '').slice(11, 16)) + ' · ' + esc(a.detail || a.action) + '</li>';
          }).join('') + '</ul>'
        : '') +
      '</section>'
    );
  }

  function regsTable(rows) {
    if (!rows.length) return '<div class="ev-empty">لا تسجيلات بعد.</div>';
    return '<div style="overflow:auto"><table class="ev-table"><thead><tr><th>رقم التسجيل</th><th>الاسم</th><th>البريد</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td><code>' + esc(r.id) + '</code></td><td>' + esc(r.name) + '</td><td>' + esc(r.email) + '</td><td>' +
          esc(r.status === 'confirmed' ? 'مؤكد' : r.status === 'pending_payment' ? 'بانتظار الدفع' : r.status) +
          '</td><td>' + fmtDate(r.createdAt) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function videosHtml() {
    var rows = state.videos || [];
    return (
      '<section class="ev-panel"><h2>مكتبة الفيديو</h2>' +
      '<p class="ev-meta">كل فيديو مرتبط برقم فعالية. ارفع فيديو بعد اختيار الفعالية.</p>' +
      eventPick('video') +
      (!rows.length
        ? '<div class="ev-empty">لا توجد فيديوهات مرتبطة بفعاليات بعد.</div>'
        : '<div style="overflow:auto"><table class="ev-table"><thead><tr><th>رقم الفيديو</th><th>رقم الفعالية</th><th>اسم الفعالية</th><th>العنوان</th><th>النوع</th><th>الحجم</th><th>تاريخ الرفع</th><th>الحالة</th><th>صاحب الرفع</th><th>إجراءات</th></tr></thead><tbody>' +
          rows.map(function (v) {
            return '<tr><td><code>' + esc(v.id) + '</code></td><td><code>' + esc(v.eventId) + '</code></td><td>' + esc(v.eventName) +
              '</td><td>' + esc(v.name) + '</td><td>' + esc(v.kind || 'فيديو') +
              '</td><td>' + lat(v.size || 0) + '</td><td>' + fmtDate(v.uploadedAt) +
              '</td><td>' + esc(v.status === 'ready' ? 'جاهز' : v.status) +
              '</td><td>' + esc(v.uploadedByName || v.uploadedBy || '') +
              '</td><td><a class="ev-btn light" href="' + esc(v.url) + '" target="_blank">عرض / تشغيل</a> <a class="ev-btn light" href="' + esc(v.url) + '" download>تحميل</a></td></tr>';
          }).join('') + '</tbody></table></div>') +
      '</section>'
    );
  }

  function eventPick(kind) {
    var opts = (state.items || []).map(function (e) {
      return '<option value="' + esc(e.id) + '">' + esc(e.id + ' — ' + e.name) + '</option>';
    }).join('');
    if (!opts) return '<p class="ev-alert">أنشئ فعالية أولاً قبل رفع الملفات.</p>';
    return '<div class="ev-form"><label>اختر رقم الفعالية<select data-pick-event>' + opts + '</select></label>' +
      '<label>رفع ' + (kind === 'video' ? 'فيديو' : 'ملف') + '<input type="file" data-upload-kind="' + esc(kind) + '" ' + (kind === 'video' ? 'accept="video/*"' : '') + '></label></div>';
  }

  function clipmakerHtml() {
    return (
      '<section class="ev-panel"><h2>صانع المقاطع القصيرة</h2>' +
      '<div class="ev-alert">لا توجد معالجة فيديو أو ذكاء اصطناعي داخل النظام حالياً. يمكنك رفع مقطع جاهز وربطه بفعالية وفيديو مصدر، مع وقت البداية والنهاية.</div>' +
      eventPick('clip') +
      '<div class="ev-form">' +
      field('clipTitle', 'عنوان المقطع', '') +
      field('clipStart', 'وقت البداية (ثوانٍ)', '0', 'number') +
      field('clipEnd', 'وقت النهاية (ثوانٍ)', '15', 'number') +
      '<label>الفيديو المصدر<select data-clip-source>' +
      (state.videos || []).map(function (v) { return '<option value="' + esc(v.id) + '">' + esc(v.id + ' — ' + v.name) + '</option>'; }).join('') +
      '<option value="">بدون مصدر</option></select></label>' +
      '<label class="ev-span-2">ملف المقطع (اختياري)<input type="file" accept="video/*" data-clip-file></label>' +
      '</div>' +
      '<button class="ev-btn primary" data-ev="make-clip">حفظ المقطع</button>' +
      '</section>'
    );
  }

  function clipsHtml() {
    var rows = state.clips || [];
    return (
      '<section class="ev-panel"><h2>مكتبة المقاطع القصيرة</h2>' +
      (!rows.length
        ? '<div class="ev-empty">لا توجد مقاطع بعد. استخدم صانع المقاطع لحفظ مقطع مرتبط بفعالية.</div>'
        : '<div style="overflow:auto"><table class="ev-table"><thead><tr><th>رقم المقطع</th><th>رقم الفعالية</th><th>الفيديو المصدر</th><th>العنوان</th><th>المدة</th><th>الحالة</th><th>تاريخ الإنشاء</th></tr></thead><tbody>' +
          rows.map(function (c) {
            return '<tr><td><code>' + esc(c.id) + '</code></td><td><code>' + esc(c.eventId) + '</code></td><td><code>' + esc(c.sourceVideoId || '—') +
              '</code></td><td>' + esc(c.title) + '</td><td>' + lat(c.duration || '') +
              '</td><td>' + esc(c.status === 'ready' ? 'جاهز' : c.status === 'failed' ? 'فشل' : 'قيد المعالجة') +
              '</td><td>' + fmtDate(c.createdAt) + '</td></tr>';
          }).join('') + '</tbody></table></div>') +
      '</section>'
    );
  }

  function publishHtml() {
    var ch = (state.meta && state.meta.channels) || [];
    return (
      '<section class="ev-panel"><h2>النشر والتوزيع</h2>' +
      '<div class="ev-alert">لا يوجد تكامل API مع إنستغرام أو فيسبوك أو يوتيوب أو تيك توك. النشر الداخلي متاح على الموقع وداخل النظام فقط. أي منصة غير متصلة تُسجَّل يدوياً دون ادّعاء نجاح نشر وهمي.</div>' +
      eventPick('pub') +
      '<div class="ev-form"><label>المنصة<select data-pub-platform>' +
      ch.map(function (c) {
        return '<option value="' + esc(c.id) + '">' + esc(c.label) + ' — ' + (c.connected ? 'متصلة' : 'غير متصلة') + '</option>';
      }).join('') +
      '</select></label><label>رابط خارجي إن وُجد<input data-pub-url placeholder="https://"></label></div>' +
      '<button class="ev-btn primary" data-ev="publish">تسجيل محاولة النشر</button>' +
      '<h3 style="margin-top:16px">سجل النشر</h3>' +
      pubsTable() +
      '</section>'
    );
  }

  function pubsTable() {
    var rows = [];
    (state.items || []).forEach(function () {});
    /* publications live on event detail; list from activity */
    var pubs = (state.activity || []).filter(function (a) { return a.action === 'published' || a.action === 'publish_log'; });
    if (!pubs.length) return '<div class="ev-empty">لا توجد محاولات نشر مسجّلة.</div>';
    return '<ul>' + pubs.map(function (p) {
      return '<li><code>' + esc(p.eventId) + '</code> · ' + esc(p.detail) + ' · ' + fmtDate(p.at) + '</li>';
    }).join('') + '</ul>';
  }

  function recordHtml() {
    return (
      '<section class="ev-panel"><h2>تصوير ريلز ذاتي</h2>' +
      '<p class="ev-meta">يستخدم كاميرا الجهاز عبر المتصفح عند توفر الصلاحية. الناتج يُرفع إلى الفعالية المختارة.</p>' +
      eventPick('rec') +
      '<video id="ev-preview" autoplay muted playsinline style="width:100%;max-height:280px;background:#0f172a;border-radius:12px"></video>' +
      '<div class="ev-actions" style="margin-top:10px">' +
      '<button class="ev-btn primary" data-ev="rec-start">بدء التسجيل</button>' +
      '<button class="ev-btn light" data-ev="rec-stop">إيقاف</button>' +
      '<button class="ev-btn light" data-ev="rec-save">حفظ / رفع</button>' +
      '</div></section>'
    );
  }

  function registerAdminHtml() {
    var rows = state.registrations || [];
    return (
      '<section class="ev-panel"><h2>تسجيل الفعاليات</h2>' +
      '<p class="ev-meta">كل تسجيل مرتبط برقم فعالية ورقم عميل ورقم تسجيل فريد.</p>' +
      (!rows.length
        ? '<div class="ev-empty">لا توجد تسجيلات بعد.</div>'
        : '<div style="overflow:auto"><table class="ev-table"><thead><tr><th>رقم التسجيل</th><th>رقم الفعالية</th><th>الفعالية</th><th>العميل</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>' +
          rows.map(function (r) {
            return '<tr><td><code>' + esc(r.id) + '</code></td><td><code>' + esc(r.eventId) + '</code></td><td>' + esc(r.eventName) +
              '</td><td>' + esc(r.email) + '</td><td>' + esc(r.status === 'confirmed' ? 'مؤكد' : r.status === 'pending_payment' ? 'بانتظار الدفع' : r.status) +
              '</td><td>' + fmtDate(r.createdAt) + '</td></tr>';
          }).join('') + '</tbody></table></div>') +
      '</section>'
    );
  }

  function mineHtml() {
    var rows = state.items || [];
    return (
      '<section class="ev-panel"><h2>فعالياتي</h2>' +
      (rows.length ? '' : '<div class="ev-empty">لم تُنشئ أي فعالية بعد.<br><button class="ev-btn primary" data-ev="new" style="margin-top:12px">إنشاء أول فعالية</button></div>') +
      (rows.length ? '<div class="ev-cards">' + rows.map(function (e) {
        return '<article class="ev-card" data-open="' + esc(e.id) + '"><h3>' + esc(e.name) + '</h3><p><code>' + esc(e.id) + '</code></p><p>' +
          badge(e.status, e.statusLabel) + '</p>' +
          (e.changeRequestNote ? '<p class="ev-alert">تحتاج تعديل: ' + esc(e.changeRequestNote) + '</p>' : '') +
          '</article>';
      }).join('') + '</div>' : '') +
      '</section>'
    );
  }

  function myregsHtml() {
    var rows = state.mineRegs || [];
    return (
      '<section class="ev-panel"><h2>تسجيلاتي</h2>' +
      (!rows.length
        ? '<div class="ev-empty">لم تسجّل في أي فعالية بعد.</div>'
        : '<div style="overflow:auto"><table class="ev-table"><thead><tr><th>رقم التسجيل</th><th>رقم الفعالية</th><th>الفعالية</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>' +
          rows.map(function (r) {
            return '<tr data-open="' + esc(r.eventId) + '"><td><code>' + esc(r.id) + '</code></td><td><code>' + esc(r.eventId) +
              '</code></td><td>' + esc(r.eventName) + '</td><td>' +
              esc(r.status === 'confirmed' ? 'مؤكد' : r.status === 'pending_payment' ? 'بانتظار الدفع — بوابة الدفع غير متصلة' : r.status) +
              '</td><td>' + fmtDate(r.createdAt) + '</td></tr>';
          }).join('') + '</tbody></table></div>') +
      '</section>'
    );
  }

  function guestHtml() {
    return exploreHtml() +
      '<section class="ev-panel"><div class="ev-empty">سجّل الدخول لإنشاء فعالية أو التسجيل فيها.<br>' +
      '<button class="ev-btn primary" data-ev="login" style="margin-top:12px">تسجيل الدخول</button></div></section>';
  }

  function render() {
    var inner = '';
    if (state.error) inner += '<div class="ev-alert danger">' + esc(state.error) + '</div>';
    inner += hero() + nav();
    if (!loggedIn()) inner += guestHtml();
    else if (state.section === 'create') inner += wizardHtml();
    else if (state.section === 'detail') inner += detailHtml();
    else if (state.section === 'manage' && isStaff()) inner += manageHtml();
    else if (state.section === 'explore' || state.section === 'mine' && !isStaff() && false) inner += exploreHtml();
    else if (state.section === 'mine') inner += mineHtml();
    else if (state.section === 'myregs') inner += myregsHtml();
    else if (state.section === 'videos' && isStaff()) inner += videosHtml();
    else if (state.section === 'clipmaker' && isStaff()) inner += clipmakerHtml();
    else if (state.section === 'clips' && isStaff()) inner += clipsHtml();
    else if (state.section === 'publish' && isStaff()) inner += publishHtml();
    else if (state.section === 'record' && isStaff()) inner += recordHtml();
    else if (state.section === 'register-admin' && isStaff()) inner += registerAdminHtml();
    else if (isStaff()) inner += dashboardHtml();
    else inner += exploreHtml();
    root.innerHTML = inner;
  }

  function readWizard() {
    root.querySelectorAll('[data-w]').forEach(function (el) {
      var k = el.getAttribute('data-w');
      var v = el.value;
      if (k === 'requiresRegistration') state.wizard[k] = v === 'true';
      else if (k === 'priceUsd' || k === 'seats') state.wizard[k] = v === '' ? '' : Number(v);
      else state.wizard[k] = v;
    });
  }

  async function saveDraft() {
    if (state.busy) return;
    readWizard();
    if (!state.wizard.name) throw new Error('اسم الفعالية مطلوب');
    state.busy = true;
    try {
      var body = Object.assign({}, state.wizard);
      if (body.seats === '') body.seats = null;
      if (state.wizard.id) {
        var up = await api('/api/hub/events/' + encodeURIComponent(state.wizard.id), { method: 'PUT', body: body });
        state.wizard.id = up.event.id;
        toast('حُفظت المسودة · ' + up.event.id);
        return up.event;
      }
      var created = await api('/api/hub/events', {
        method: 'POST',
        body: body,
        headers: { 'Idempotency-Key': idem() },
      });
      state.wizard.id = created.event.id;
      toast('حُفظت المسودة · ' + created.event.id);
      return created.event;
    } finally {
      state.busy = false;
    }
  }

  async function doAction(id, action, extra) {
    if (state.busy) return;
    state.busy = true;
    try {
      var note = extra && extra.note;
      if (action === 'request_changes' && !note) {
        note = window.prompt('سبب طلب التعديل؟') || '';
        if (!note) throw new Error('سبب طلب التعديل مطلوب');
      }
      if (action === 'reject' && !note) {
        note = window.prompt('سبب الرفض؟') || '';
        if (!note) throw new Error('سبب الرفض مطلوب');
      }
      var out = await api('/api/hub/events/' + encodeURIComponent(id) + '/action', {
        method: 'POST',
        body: { action: action, note: note, reason: note },
        headers: { 'Idempotency-Key': idem() },
      });
      state.event = out.event;
      toast(out.event.statusLabel + ' · ' + out.event.id);
      await refreshAll();
      if (state.section === 'detail') await openEvent(id);
    } finally {
      state.busy = false;
    }
  }

  root.addEventListener('click', async function (e) {
    var t = e.target.closest('[data-ev],[data-sec],[data-open],[data-wiz],[data-act],[data-kpi],[data-cover],.ev-drop');
    if (!t) return;
    try {
      if (t.getAttribute('data-ev') === 'login') { requireLoginMsg(); return; }
      if (t.getAttribute('data-ev') === 'new' || t.getAttribute('data-ev') === 'add') {
        if (!loggedIn()) return requireLoginMsg();
        state.wizard = blankWizard();
        state.wizard.organizerEmail = (state.me && state.me.email) || '';
        state.wizard.organizerName = (state.me && state.me.name) || '';
        state.wizardStep = 0;
        setSection('create');
        return;
      }
      if (t.getAttribute('data-ev') === 'upload-video') {
        setSection('videos');
        return;
      }
      if (t.hasAttribute('data-sec')) {
        var sec = t.getAttribute('data-sec');
        if (sec === 'create') {
          state.wizard = blankWizard();
          state.wizard.organizerEmail = (state.me && state.me.email) || '';
          state.wizard.organizerName = (state.me && state.me.name) || '';
          state.wizardStep = 0;
        }
        setSection(sec);
        return;
      }
      if (t.hasAttribute('data-kpi')) {
        var k = t.getAttribute('data-kpi');
        if (k === 'videos') setSection('videos');
        else if (k === 'clips') setSection('clips');
        else if (k === 'upcoming') { state.filters.upcoming = '1'; state.filters.status = 'published'; setSection('manage'); await refreshAll(); }
        else if (k === 'pending_review' || k === 'draft') { state.filters.status = k; state.filters.upcoming = ''; setSection('manage'); await refreshAll(); }
        return;
      }
      if (t.hasAttribute('data-open')) {
        await openEvent(t.getAttribute('data-open'));
        return;
      }
      if (t.getAttribute('data-wiz') === 'back') { readWizard(); state.wizardStep = Math.max(0, state.wizardStep - 1); render(); return; }
      if (t.getAttribute('data-wiz') === 'next') { readWizard(); state.wizardStep = Math.min(WIZARD_STEPS.length - 1, state.wizardStep + 1); render(); return; }
      if (t.getAttribute('data-wiz') === 'draft') {
        var ev = await saveDraft();
        await refreshAll();
        if (ev) await openEvent(ev.id);
        return;
      }
      if (t.getAttribute('data-wiz') === 'preview') {
        readWizard();
        state.wizardStep = WIZARD_STEPS.length - 1;
        render();
        return;
      }
      if (t.getAttribute('data-wiz') === 'submit') {
        var saved = await saveDraft();
        await doAction(saved.id, 'submit');
        return;
      }
      if (t.hasAttribute('data-act')) {
        var act = t.getAttribute('data-act');
        var id = t.getAttribute('data-id');
        if (act === 'edit') {
          var data = await api('/api/hub/events/' + encodeURIComponent(id));
          state.wizard = wizardFromEvent(data.event);
          state.wizardStep = 0;
          setSection('create');
          return;
        }
        await doAction(id, act);
        return;
      }
      if (t.getAttribute('data-ev') === 'register') {
        if (!loggedIn()) return requireLoginMsg();
        if (state.busy) return;
        state.busy = true;
        try {
          var reg = await api('/api/hub/events/' + encodeURIComponent(state.event.id) + '/register', {
            method: 'POST',
            body: {},
            headers: { 'Idempotency-Key': idem() },
          });
          var r = reg.registration;
          if (r.status === 'pending_payment') toast('الحجز بانتظار الدفع — بوابة الدفع غير متصلة. رقم التسجيل: ' + r.id);
          else toast('تم التسجيل · ' + r.id);
          await openEvent(state.event.id);
        } finally { state.busy = false; }
        return;
      }
      if (t.getAttribute('data-ev') === 'make-clip') {
        var eid = (root.querySelector('[data-pick-event]') || {}).value;
        if (!eid) throw new Error('اختر فعالية');
        var fileEl = root.querySelector('[data-clip-file]');
        var assetId = '';
        if (fileEl && fileEl.files && fileEl.files[0]) {
          var up = await uploadFile(fileEl.files[0]);
          var as = await api('/api/hub/events/' + encodeURIComponent(eid) + '/assets', {
            method: 'POST',
            body: { kind: 'video', name: fileEl.files[0].name, mime: fileEl.files[0].type, size: fileEl.files[0].size, url: up.url, uploadId: up.id },
          });
          assetId = ((as.event.assets || []).slice(-1)[0] || {}).id;
        }
        await api('/api/hub/events/' + encodeURIComponent(eid) + '/clips', {
          method: 'POST',
          body: {
            title: (root.querySelector('[data-w="clipTitle"]') || {}).value,
            start: (root.querySelector('[data-w="clipStart"]') || {}).value,
            end: (root.querySelector('[data-w="clipEnd"]') || {}).value,
            sourceVideoId: (root.querySelector('[data-clip-source]') || {}).value,
            assetId: assetId,
          },
        });
        toast('حُفظ المقطع');
        await refreshAll();
        setSection('clips');
        return;
      }
      if (t.getAttribute('data-ev') === 'publish') {
        var pid = (root.querySelector('[data-pick-event]') || {}).value;
        await api('/api/hub/events/' + encodeURIComponent(pid) + '/publish', {
          method: 'POST',
          body: {
            platform: (root.querySelector('[data-pub-platform]') || {}).value,
            url: (root.querySelector('[data-pub-url]') || {}).value,
          },
        });
        toast('سُجّلت محاولة النشر');
        await refreshAll();
        return;
      }
      if (t.getAttribute('data-ev') === 'rec-start') {
        if (!navigator.mediaDevices || !window.MediaRecorder) { toast('التسجيل غير مدعوم في هذا المتصفح'); return; }
        var stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        state.recStream = stream;
        var v = document.getElementById('ev-preview');
        if (v) { v.srcObject = stream; v.play(); }
        state.recChunks = [];
        state.recRecorder = new MediaRecorder(stream);
        state.recRecorder.ondataavailable = function (ev) { if (ev.data.size) state.recChunks.push(ev.data); };
        state.recRecorder.start();
        toast('بدأ التسجيل');
        return;
      }
      if (t.getAttribute('data-ev') === 'rec-stop') {
        if (!state.recRecorder) return;
        await new Promise(function (resolve) {
          state.recRecorder.onstop = resolve;
          state.recRecorder.stop();
        });
        if (state.recStream) state.recStream.getTracks().forEach(function (tr) { tr.stop(); });
        toast('توقف التسجيل — اضغط حفظ/رفع');
        return;
      }
      if (t.getAttribute('data-ev') === 'rec-save') {
        if (!state.recChunks.length) throw new Error('لا يوجد تسجيل لحفظه');
        var blob = new Blob(state.recChunks, { type: 'video/webm' });
        var file = new File([blob], 'reels.webm', { type: 'video/webm' });
        var campId = (root.querySelector('[data-pick-event]') || {}).value;
        var up2 = await uploadFile(file);
        await api('/api/hub/events/' + encodeURIComponent(campId) + '/assets', {
          method: 'POST',
          body: { kind: 'video', name: file.name, mime: file.type, size: file.size, url: up2.url, uploadId: up2.id },
        });
        toast('تم رفع التسجيل وربطه بالفعالية');
        await refreshAll();
        setSection('videos');
        return;
      }
    } catch (err) {
      toast(err.message || String(err));
    }
  });

  root.addEventListener('change', async function (e) {
    var f = e.target.getAttribute('data-filter');
    if (f) {
      state.filters[f] = e.target.value;
      await refreshAll();
      return;
    }
    if (e.target.hasAttribute('data-cover') && e.target.files && e.target.files[0]) {
      try {
        var up = await uploadFile(e.target.files[0]);
        state.wizard.coverImage = up.url;
        toast('رُفعت صورة الغلاف');
        render();
      } catch (err) { toast(err.message || String(err)); }
      return;
    }
    if (e.target.hasAttribute('data-upload-kind') && e.target.files && e.target.files[0]) {
      try {
        var eid = (root.querySelector('[data-pick-event]') || {}).value;
        if (!eid) throw new Error('اختر رقم الفعالية أولاً');
        var file = e.target.files[0];
        var up = await uploadFile(file);
        var kind = e.target.getAttribute('data-upload-kind') === 'video' || file.type.indexOf('video') === 0 ? 'video' : file.type.indexOf('image') === 0 ? 'image' : 'file';
        await api('/api/hub/events/' + encodeURIComponent(eid) + '/assets', {
          method: 'POST',
          body: { kind: kind, name: file.name, mime: file.type, size: file.size, url: up.url, uploadId: up.id },
        });
        toast('تم رفع الملف وربطه بالفعالية ' + eid);
        await refreshAll();
      } catch (err) { toast(err.message || String(err)); }
      return;
    }
    if (e.target.hasAttribute('data-file') && e.target.files && e.target.files[0] && state.event) {
      try {
        var file = e.target.files[0];
        var up = await uploadFile(file);
        var kind = file.type.indexOf('video') === 0 ? 'video' : file.type.indexOf('image') === 0 ? 'image' : 'file';
        var out = await api('/api/hub/events/' + encodeURIComponent(state.event.id) + '/assets', {
          method: 'POST',
          body: { kind: kind, name: file.name, mime: file.type, size: file.size, url: up.url, uploadId: up.id },
        });
        state.event = out.event;
        toast('تم رفع المرفق');
        render();
      } catch (err) { toast(err.message || String(err)); }
    }
  });

  root.addEventListener('input', function (e) {
    if (e.target && e.target.hasAttribute('data-w')) {
      var k = e.target.getAttribute('data-w');
      state.wizard[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      if (k === 'attendanceType' || k === 'pricing' || k === 'requiresRegistration') {
        readWizard();
        render();
      }
    }
  });

  window.addEventListener('hashchange', function () {
    var h = location.hash.replace(/^#/, '');
    if (h.indexOf('event=') === 0) openEvent(h.split('=')[1]).catch(function () {});
    else if (h.indexOf('section=') === 0) {
      state.section = h.split('=')[1];
      render();
    }
  });

  // Resolve public vs admin back-button context before first paint.
  resolveStudioEntry();

  refreshAll().then(function () {
    var h = location.hash.replace(/^#/, '');
    if (h.indexOf('event=') === 0) return openEvent(h.split('=')[1]);
    if (h.indexOf('section=') === 0) setSection(h.split('=')[1]);
  });
})();
