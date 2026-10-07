/**
 * Marketing campaigns studio UI — staff-only operational workspace.
 */
(function () {
  'use strict';

  var root = document.getElementById('mcs-root');
  if (!root) return;

  var state = {
    section: 'dashboard',
    meta: null,
    catalogs: null,
    summary: null,
    alerts: [],
    items: [],
    videos: [],
    clips: [],
    activity: [],
    calendar: [],
    calMonth: new Date(),
    calView: 'month',
    campaign: null,
    detailTab: 'overview',
    wizardStep: 0,
    wizardOpen: false,
    wizard: blankWizard(),
    filters: { q: '', status: '', type: '', owner: '', channel: '', from: '', to: '' },
    dirty: false,
    saveNote: '',
    busy: false,
    error: '',
  };

  var WIZARD_STEPS = ['الأساسيات', 'الهدف', 'الجمهور', 'الربط', 'الميزانية', 'القنوات', 'المراجعة'];

  function blankWizard() {
    return {
      name: '',
      description: '',
      type: 'حملة محتوى',
      goal: 'leads',
      goalTarget: 100,
      goalUnit: 'عميل محتمل',
      startDate: '',
      endDate: '',
      department: 'التسويق',
      ownerName: '',
      priority: 'متوسطة',
      notes: '',
      audienceType: 'جمهور جديد',
      region: '',
      age: '',
      interests: '',
      sector: '',
      customerType: '',
      traits: '',
      linkKind: 'product',
      linkId: '',
      linkUrl: '',
      budgetTotal: 0,
      contentCost: 0,
      adCost: 0,
      otherCost: 0,
      channelIds: ['website'],
    };
  }

  function lat(v) {
    return String(v == null ? '' : v).replace(/[٠-٩]/g, function (d) {
      return '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)];
    });
  }
  function num(v) {
    var n = Number(v || 0);
    return lat(n.toLocaleString('en-US'));
  }
  function fmtDate(v) {
    if (!v) return '—';
    var d = String(v).slice(0, 10).split('-');
    if (d.length !== 3) return lat(v);
    return lat(d[2] + '/' + d[1] + '/' + d[0]);
  }
  function fmtTime(v) {
    return lat(v || '—');
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
    el.className = 'mcs-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2800);
  }
  function can(perm) {
    var list = (state.meta && state.meta.me && state.meta.me.permissions) || [];
    var role = String((window.HubAuth && HubAuth.getUser && HubAuth.getUser() && HubAuth.getUser().role) || '').toLowerCase();
    if (role === 'supreme_leader' || role === 'super_admin') return true;
    return list.indexOf(perm) !== -1;
  }
  function headers(extra) {
    var h = (window.HubAuth && HubAuth.authHeaders && HubAuth.authHeaders(extra || {})) || extra || {};
    return h;
  }
  async function api(path, opts) {
    opts = opts || {};
    var h = headers(opts.headers || {});
    if (opts.body && !(opts.body instanceof ArrayBuffer) && !(opts.body instanceof Uint8Array) && !opts.raw) {
      h['Content-Type'] = 'application/json';
    }
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

  function setSection(sec) {
    state.section = sec;
    state.wizardOpen = sec === 'create';
    if (sec !== 'detail') state.campaign = null;
    location.hash = 'section=' + sec;
    render();
  }

  async function refreshAll() {
    state.error = '';
    try {
      var meta = await api('/api/hub/marketing-campaigns/meta');
      state.meta = { ...(meta.meta || {}), me: meta.me };
      var cat = await api('/api/hub/marketing-campaigns/catalogs');
      state.catalogs = cat.catalogs;
      var sum = await api('/api/hub/marketing-campaigns/summary');
      state.summary = sum.summary;
      state.alerts = sum.alerts || [];
      var qs = new URLSearchParams();
      if (state.filters.q) qs.set('q', state.filters.q);
      if (state.filters.status) qs.set('status', state.filters.status);
      if (state.filters.type) qs.set('type', state.filters.type);
      if (state.filters.owner) qs.set('owner', state.filters.owner);
      if (state.filters.channel) qs.set('channel', state.filters.channel);
      if (state.filters.from) qs.set('from', state.filters.from);
      if (state.filters.to) qs.set('to', state.filters.to);
      var list = await api('/api/hub/marketing-campaigns' + (qs.toString() ? '?' + qs : ''));
      state.items = list.items || [];
      var vids = await api('/api/hub/marketing-campaigns/videos');
      state.videos = vids.items || [];
      var clips = await api('/api/hub/marketing-campaigns/clips');
      state.clips = clips.items || [];
      var act = await api('/api/hub/marketing-campaigns/activity');
      state.activity = act.items || [];
      var from = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth(), 1).toISOString().slice(0, 10);
      var to = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + 1, 0).toISOString().slice(0, 10);
      var cal = await api('/api/hub/marketing-campaigns/calendar?from=' + from + '&to=' + to);
      state.calendar = cal.items || [];
    } catch (err) {
      state.error = err.message || String(err);
    }
    render();
  }

  async function openCampaign(id) {
    var data = await api('/api/hub/marketing-campaigns/' + encodeURIComponent(id));
    state.campaign = data.campaign;
    state.section = 'detail';
    state.detailTab = 'overview';
    location.hash = 'campaign=' + id;
    render();
  }

  function badge(status, label) {
    var cls = status === 'active' || status === 'approved' || status === 'published' ? 'active'
      : status === 'pending_review' || status === 'needs_changes' ? 'pending'
      : status === 'cancelled' || status === 'publish_failed' ? 'danger' : '';
    return '<span class="mcs-badge ' + cls + '">' + esc(label || status) + '</span>';
  }

  function hero() {
    var back = window.__HUB_STUDIO_BACK__ || 'dashboard.html#overview';
    return (
      '<header class="mcs-hero">' +
        '<div><h1>استوديو الحملات التسويقية</h1>' +
        '<p>إنشاء الحملات وتشغيلها ومراجعتها وقياسها من مكان واحد — كل سجل مرتبط برقم الحملة.</p></div>' +
        '<div class="mcs-hero-actions">' +
          '<a class="mcs-btn ghost" href="' + esc(back) + '"><i class="fas fa-arrow-right"></i> رجوع إلى لوحة التحكم</a>' +
          (can('campaigns.create') ? '<button class="mcs-btn primary" data-mcs="new"><i class="fas fa-plus"></i> حملة جديدة</button>' : '') +
          '<button class="mcs-btn ghost" data-mcs="upload-only"><i class="fas fa-cloud-arrow-up"></i> رفع محتوى</button>' +
        '</div></header>'
    );
  }

  function nav() {
    var items = [
      ['dashboard', 'fa-chart-pie', 'لوحة الاستوديو'],
      ['create', 'fa-plus', 'إنشاء حملة'],
      ['manage', 'fa-layer-group', 'إدارة الحملات'],
      ['calendar', 'fa-calendar-days', 'تقويم الحملات'],
      ['activity', 'fa-clock-rotate-left', 'سجل الحملات'],
      ['videos', 'fa-photo-film', 'مكتبة الفيديو'],
      ['reels', 'fa-scissors', 'صانع المقاطع القصيرة'],
      ['clips', 'fa-film', 'مكتبة المقاطع القصيرة'],
      ['publish', 'fa-share-nodes', 'النشر على المنصات'],
      ['record', 'fa-circle-dot', 'التصوير بالزر الذكي'],
    ];
    return (
      '<nav class="mcs-nav">' +
      items
        .map(function (it) {
          return (
            '<button type="button" class="' +
            (state.section === it[0] ? 'is-on' : '') +
            '" data-sec="' +
            it[0] +
            '"><i class="fas ' +
            it[1] +
            '"></i>' +
            it[2] +
            '</button>'
          );
        })
        .join('') +
      '</nav>'
    );
  }

  function dashboardHtml() {
    var s = state.summary || {};
    var cards = [
      ['active', 'الحملات النشطة', s.active, 'active'],
      ['pending_review', 'بانتظار الموافقة', s.pendingReview, 'pending_review'],
      ['scheduled', 'حملات مجدولة', s.scheduled, 'scheduled'],
      ['completed', 'حملات مكتملة', s.completed, 'completed'],
      ['budget', 'إجمالي الميزانيات', num(s.budgetTotal), ''],
      ['spent', 'المصروف', num(s.budgetSpent), ''],
      ['today', 'محتوى مجدول اليوم', s.scheduledToday, 'scheduled'],
      ['reviewc', 'محتوى ينتظر المراجعة', s.pendingContent, 'pending_review'],
      ['ending', 'تنتهي قريبًا', s.endingSoon, ''],
      ['goal', 'نسبة تحقيق الأهداف', s.goalAvg == null ? 'لا توجد بيانات متاحة' : lat((s.goalAvg * 100).toFixed(0)) + '%', ''],
    ];
    return (
      '<section class="mcs-panel">' +
        '<h2>ملخص الاستوديو</h2>' +
        '<div class="mcs-kpis">' +
        cards
          .map(function (c) {
            return (
              '<article class="mcs-kpi" data-filter-status="' +
              esc(c[3]) +
              '"><strong>' +
              lat(c[2] == null ? 0 : c[2]) +
              '</strong><span>' +
              esc(c[1]) +
              '</span></article>'
            );
          })
          .join('') +
        '</div>' +
        '<div class="mcs-alerts">' +
        (state.alerts.length
          ? state.alerts
              .map(function (a) {
                return (
                  '<div class="mcs-alert" data-open="' +
                  esc(a.campaignId) +
                  '">' +
                  esc(a.title) +
                  '</div>'
                );
              })
              .join('')
          : '<div class="mcs-empty">لا توجد تنبيهات تشغيلية حاليًا.</div>') +
        '</div>' +
        latestTable() +
      '</section>'
    );
  }

  function latestTable() {
    var rows = (state.items || []).slice(0, 8);
    if (!rows.length) return '<div class="mcs-empty">لا توجد حملات حتى الآن — أنشئ حملتك الأولى</div>';
    return (
      '<h3>آخر الحملات المضافة</h3>' +
      '<div style="overflow:auto"><table class="mcs-table"><thead><tr>' +
      '<th>رقم الحملة</th><th>اسم الحملة</th><th>النوع</th><th>المسؤول</th><th>الحالة</th><th>آخر تحديث</th>' +
      '</tr></thead><tbody>' +
      rows
        .map(function (c) {
          return (
            '<tr data-open="' +
            esc(c.id) +
            '"><td>' +
            esc(c.id) +
            '</td><td>' +
            esc(c.name) +
            '</td><td>' +
            esc(c.type) +
            '</td><td>' +
            esc(c.ownerName) +
            '</td><td>' +
            badge(c.status, c.statusLabel) +
            '</td><td>' +
            fmtDate(c.updatedAt) +
            ' ' +
            fmtTime((c.updatedAt || '').slice(11, 16)) +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>'
    );
  }

  function wizardHtml() {
    var w = state.wizard;
    var step = state.wizardStep;
    var body = '';
    if (step === 0) {
      body =
        field('name', 'اسم الحملة', w.name) +
        area('description', 'وصف الحملة', w.description) +
        sel('type', 'نوع الحملة', (state.meta.types || []), w.type) +
        field('department', 'القسم/الجهة', w.department) +
        field('startDate', 'تاريخ البداية', w.startDate, 'date') +
        field('endDate', 'تاريخ النهاية', w.endDate, 'date') +
        sel('priority', 'الأولوية', ['منخفضة', 'متوسطة', 'مرتفعة'], w.priority) +
        field('ownerName', 'المسؤول عن الحملة', w.ownerName) +
        area('notes', 'ملاحظات', w.notes);
    } else if (step === 1) {
      body =
        sel(
          'goal',
          'الهدف',
          (state.meta.goals || []).map(function (g) { return g.id + '|' + g.label; }),
          w.goal
        ) +
        field('goalTarget', 'القيمة المستهدفة', w.goalTarget, 'number') +
        field('goalUnit', 'وحدة القياس', w.goalUnit);
    } else if (step === 2) {
      body =
        sel('audienceType', 'نوع الجمهور', ['عملاء حاليون', 'عملاء محتملون', 'جمهور جديد'], w.audienceType) +
        field('region', 'المنطقة', w.region) +
        field('age', 'العمر (إن كان مشروعًا)', w.age) +
        field('sector', 'القطاع', w.sector) +
        field('customerType', 'نوع العميل', w.customerType) +
        field('interests', 'الاهتمامات', w.interests) +
        field('traits', 'خصائص الجمهور', w.traits);
    } else if (step === 3) {
      var cat = state.catalogs || {};
      var pool =
        w.linkKind === 'service'
          ? cat.services
          : w.linkKind === 'event'
            ? cat.events
            : w.linkKind === 'platform'
              ? cat.platforms
              : cat.products;
      var opts = (pool || []).map(function (p) { return p.id + '|' + p.label; });
      body =
        sel('linkKind', 'نوع الربط', ['product|منتج', 'service|خدمة', 'event|فعالية', 'platform|منصة', 'external|رابط خارجي'], w.linkKind) +
        (w.linkKind === 'external'
          ? field('linkUrl', 'رابط خارجي', w.linkUrl)
          : sel('linkId', 'العنصر المرتبط', opts.length ? opts : ['|لا توجد عناصر'], w.linkId));
    } else if (step === 4) {
      body =
        field('budgetTotal', 'الميزانية الإجمالية (USD)', w.budgetTotal, 'number') +
        field('contentCost', 'تكلفة المحتوى', w.contentCost, 'number') +
        field('adCost', 'تكلفة الإعلان', w.adCost, 'number') +
        field('otherCost', 'تكاليف أخرى', w.otherCost, 'number');
    } else if (step === 5) {
      body =
        '<div class="mcs-span-2 mcs-chips">' +
        (state.meta.channels || [])
          .map(function (ch) {
            return (
              '<button type="button" class="mcs-chip' +
              (w.channelIds.indexOf(ch.id) >= 0 ? ' is-on' : '') +
              '" data-ch="' +
              esc(ch.id) +
              '">' +
              esc(ch.label) +
              ' · ' +
              (ch.connected ? 'متصلة' : 'تحتاج نشرًا يدويًا') +
              '</button>'
            );
          })
          .join('') +
        '</div>';
    } else {
      body =
        '<div class="mcs-span-2"><p>اسم الحملة: <strong>' +
        esc(w.name) +
        '</strong></p><p>الهدف: ' +
        esc(w.goal) +
        ' / ' +
        lat(w.goalTarget) +
        ' ' +
        esc(w.goalUnit) +
        '</p><p>القنوات: ' +
        esc(w.channelIds.join('، ')) +
        '</p></div>';
    }
    return (
      '<section class="mcs-panel"><h2>إنشاء حملة جديدة</h2>' +
      '<div class="mcs-steps">' +
      WIZARD_STEPS.map(function (s, i) {
        return '<span class="' + (i === step ? 'is-on' : '') + '">' + lat(i + 1) + '. ' + s + '</span>';
      }).join('') +
      '</div>' +
      '<div class="mcs-form" data-wizard-form>' +
      body +
      '</div>' +
      '<div class="mcs-actions" style="margin-top:12px">' +
      (step > 0 ? '<button class="mcs-btn light" data-wiz="back">رجوع</button>' : '') +
      '<button class="mcs-btn light" data-wiz="draft">حفظ كمسودة</button>' +
      (step < WIZARD_STEPS.length - 1
        ? '<button class="mcs-btn primary" data-wiz="next">التالي</button>'
        : '<button class="mcs-btn primary" data-wiz="save">إنشاء الحملة</button>') +
      '</div></section>'
    );
  }

  function field(key, label, val, type) {
    return (
      '<label>' +
      esc(label) +
      '<input data-w="' +
      key +
      '" type="' +
      (type || 'text') +
      '" value="' +
      esc(val) +
      '"></label>'
    );
  }
  function area(key, label, val) {
    return '<label class="mcs-span-2">' + esc(label) + '<textarea data-w="' + key + '">' + esc(val) + '</textarea></label>';
  }
  function sel(key, label, opts, val) {
    return (
      '<label>' +
      esc(label) +
      '<select data-w="' +
      key +
      '">' +
      opts
        .map(function (o) {
          var id = String(o).split('|')[0];
          var lab = String(o).split('|')[1] || id;
          return '<option value="' + esc(id) + '"' + (String(val) === id ? ' selected' : '') + '>' + esc(lab) + '</option>';
        })
        .join('') +
      '</select></label>'
    );
  }

  function manageHtml() {
    var types = state.meta.types || [];
    var statuses = state.meta.statuses || [];
    var rows = state.items || [];
    return (
      '<section class="mcs-panel"><h2>إدارة الحملات</h2>' +
      '<div class="mcs-form">' +
      '<label>بحث<input data-filter="q" value="' +
      esc(state.filters.q) +
      '" placeholder="رقم الحملة أو الاسم أو المسؤول"></label>' +
      '<label>الحالة<select data-filter="status"><option value="">الكل</option>' +
      statuses.map(function (s) { return '<option value="' + esc(s.id) + '"' + (state.filters.status === s.id ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join('') +
      '</select></label>' +
      '<label>النوع<select data-filter="type"><option value="">الكل</option>' +
      types.map(function (t) { return '<option value="' + esc(t) + '"' + (state.filters.type === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') +
      '</select></label>' +
      '<label>المسؤول<input data-filter="owner" value="' + esc(state.filters.owner) + '"></label>' +
      '<label>القناة<select data-filter="channel"><option value="">الكل</option>' +
      (state.meta.channels || []).map(function (ch) { return '<option value="' + esc(ch.id) + '"' + (state.filters.channel === ch.id ? ' selected' : '') + '>' + esc(ch.label) + '</option>'; }).join('') +
      '</select></label>' +
      '<label>من تاريخ<input data-filter="from" type="date" value="' + esc(state.filters.from) + '"></label>' +
      '<label>إلى تاريخ<input data-filter="to" type="date" value="' + esc(state.filters.to) + '"></label></div>' +
      (rows.length
        ? '<div style="overflow:auto;margin-top:12px"><table class="mcs-table"><thead><tr>' +
          '<th>رقم الحملة</th><th>اسم الحملة</th><th>النوع</th><th>الهدف</th><th>المسؤول</th><th>البداية</th><th>النهاية</th><th>الميزانية</th><th>المصروف</th><th>التقدم</th><th>الحالة</th><th>آخر تحديث</th><th>إجراءات</th>' +
          '</tr></thead><tbody>' +
          rows
            .map(function (c) {
              return (
                '<tr><td>' +
                esc(c.id) +
                '</td><td><a href="#campaign=' +
                esc(c.id) +
                '" data-open="' +
                esc(c.id) +
                '">' +
                esc(c.name) +
                '</a></td><td>' +
                esc(c.type) +
                '</td><td>' +
                esc(c.goalLabel || c.goal || '—') +
                '</td><td>' +
                esc(c.ownerName) +
                '</td><td>' +
                fmtDate(c.startDate) +
                '</td><td>' +
                fmtDate(c.endDate) +
                '</td><td>' +
                num(c.budget && c.budget.total) +
                '</td><td>' +
                num(c.budget && c.budget.spent) +
                '</td><td>' +
                (c.metrics && c.metrics.goalProgress != null
                  ? lat((Number(c.metrics.goalProgress) * 100).toFixed(0)) + '%'
                  : 'لا توجد بيانات متاحة') +
                '</td><td>' +
                badge(c.status, c.statusLabel) +
                '</td><td>' +
                fmtDate(c.updatedAt) +
                ' ' +
                fmtTime((c.updatedAt || '').slice(11, 16)) +
                '</td><td class="mcs-actions"><button class="mcs-btn light" data-open="' +
                esc(c.id) +
                '"><i class="fas fa-eye"></i> عرض</button></td></tr>'
              );
            })
            .join('') +
          '</tbody></table></div>'
        : '<div class="mcs-empty">لا توجد حملات حتى الآن — أنشئ حملتك الأولى</div>') +
      '</section>'
    );
  }

  function calendarHtml() {
    var y = state.calMonth.getFullYear();
    var m = state.calMonth.getMonth();
    var first = new Date(y, m, 1).getDay();
    var days = new Date(y, m + 1, 0).getDate();
    var cells = [];
    var i;
    for (i = 0; i < first; i++) cells.push('<div class="day"></div>');
    for (i = 1; i <= days; i++) {
      var ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(i).padStart(2, '0');
      var hits = (state.calendar || []).filter(function (x) { return x.date === ds; });
      cells.push(
        '<div class="day"><strong>' +
          lat(i) +
          '</strong>' +
          hits
            .map(function (h) {
              return '<span class="hit" data-open="' + esc(h.campaignId) + '">' + esc(h.title) + '</span>';
            })
            .join('') +
          '</div>'
      );
    }
    return (
      '<section class="mcs-panel"><h2>تقويم الحملات</h2>' +
      '<div class="mcs-actions"><button class="mcs-btn light" data-cal="-1">السابق</button>' +
      '<button class="mcs-btn light' + (state.calView === 'day' ? ' primary' : '') + '" data-cal-view="day">اليوم</button>' +
      '<button class="mcs-btn light' + (state.calView === 'week' ? ' primary' : '') + '" data-cal-view="week">الأسبوع</button>' +
      '<button class="mcs-btn light' + (state.calView === 'month' ? ' primary' : '') + '" data-cal-view="month">الشهر</button>' +
      '<strong>' +
      lat(m + 1) +
      '/' +
      lat(y) +
      '</strong>' +
      '<button class="mcs-btn light" data-cal="1">التالي</button></div>' +
      (state.calView === 'month'
        ? '<div class="mcs-cal">' + cells.join('') + '</div>'
        : calendarListHtml()) +
      '</section>'
    );
  }

  function calendarListHtml() {
    var y = state.calMonth.getFullYear();
    var m = state.calMonth.getMonth();
    var d = state.calMonth.getDate();
    var from;
    var to;
    if (state.calView === 'day') {
      from = to = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    } else {
      var start = new Date(y, m, d - ((new Date(y, m, d).getDay() + 6) % 7));
      var end = new Date(start);
      end.setDate(start.getDate() + 6);
      from = start.toISOString().slice(0, 10);
      to = end.toISOString().slice(0, 10);
    }
    var hits = (state.calendar || []).filter(function (x) { return x.date >= from && x.date <= to; });
    if (!hits.length) return '<div class="mcs-empty">لا توجد أحداث في هذا النطاق.</div>';
    return (
      '<table class="mcs-table"><thead><tr><th>التاريخ</th><th>النوع</th><th>العنوان</th><th>الحملة</th></tr></thead><tbody>' +
      hits
        .map(function (h) {
          var kind =
            h.kind === 'start'
              ? 'بداية حملة'
              : h.kind === 'end'
                ? 'نهاية حملة'
                : h.kind === 'schedule'
                  ? 'منشور مجدول'
                  : h.kind === 'review'
                    ? 'موعد مراجعة'
                    : h.kind === 'publish'
                      ? 'موعد نشر'
                      : h.kind;
          return (
            '<tr data-open="' +
            esc(h.campaignId) +
            '"><td>' +
            fmtDate(h.date) +
            (h.time ? ' ' + fmtTime(h.time) : '') +
            '</td><td>' +
            esc(kind) +
            '</td><td>' +
            esc(h.title) +
            '</td><td>' +
            esc(h.campaignId) +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table>'
    );
  }

  function videosHtml() {
    if (!state.videos.length) return '<section class="mcs-panel"><h2>مكتبة الفيديو</h2><div class="mcs-empty">لا توجد فيديوهات مرفوعة بعد.</div></section>';
    return (
      '<section class="mcs-panel"><h2>مكتبة الفيديو</h2><div style="overflow:auto"><table class="mcs-table"><thead><tr>' +
      '<th>معاينة</th><th>الاسم</th><th>رقم الحملة</th><th>المدة</th><th>الحجم</th><th>تاريخ الرفع</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>' +
      state.videos
        .map(function (v) {
          return (
            '<tr><td>' +
            (v.url ? '<video src="' + esc(v.url) + '" muted style="width:96px;height:54px;object-fit:cover;border-radius:8px"></video>' : '—') +
            '</td><td>' +
            esc(v.name) +
            '</td><td><button class="mcs-btn light" data-open="' +
            esc(v.campaignId) +
            '">' +
            esc(v.campaignId) +
            '</button></td><td>' +
            lat(v.duration || '—') +
            '</td><td>' +
            lat(((v.size || 0) / 1024 / 1024).toFixed(2)) +
            ' MB</td><td>' +
            fmtDate(v.uploadedAt) +
            '</td><td>' +
            esc(v.status || 'جاهز') +
            '</td><td class="mcs-actions">' +
            '<a class="mcs-btn light" href="' + esc(v.url) + '" target="_blank"><i class="fas fa-play"></i> مشاهدة</a>' +
            '<a class="mcs-btn light" href="' + esc(v.url) + '" download><i class="fas fa-download"></i> تنزيل</a>' +
            '<button class="mcs-btn light" data-vid-use="' + esc(v.id) + '" data-vid-camp="' + esc(v.campaignId) + '">استخدام في محتوى</button>' +
            (can('campaigns.upload') ? '<button class="mcs-btn light" data-vid-edit="' + esc(v.id) + '" data-vid-camp="' + esc(v.campaignId) + '">تعديل البيانات</button>' : '') +
            (can('campaigns.delete') ? '<button class="mcs-btn danger" data-vid-del="' + esc(v.id) + '" data-vid-camp="' + esc(v.campaignId) + '">حذف</button>' : '') +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div></section>'
    );
  }

  function reelsHtml() {
    return (
      '<section class="mcs-panel"><h2>صانع المقاطع القصيرة</h2>' +
      '<p>لا يوجد محرر فيديو داخلي. ارفع الفيديو المصدر ثم احفظ بيانات المقطع القصير واربطه بالحملة.</p>' +
      '<div class="mcs-form">' +
      '<label>الحملة<select data-clip-campaign>' +
      (state.items || []).map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.id + ' — ' + c.name) + '</option>'; }).join('') +
      '</select></label>' +
      '<label>اسم المقطع<input data-clip-title></label>' +
      '<label>المدة (ثوانٍ)<input data-clip-dur type="number"></label>' +
      '<label>المنصة المستهدفة<select data-clip-platform>' +
      (state.meta.channels || []).map(function (ch) { return '<option value="' + esc(ch.id) + '">' + esc(ch.label) + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="mcs-span-2">ملف المقطع القصير<input type="file" accept="video/*" data-clip-file></label>' +
      '</div>' +
      '<button class="mcs-btn primary" data-mcs="make-clip"><i class="fas fa-scissors"></i> حفظ المقطع في المكتبة</button>' +
      '</section>'
    );
  }

  function clipsHtml() {
    if (!state.clips.length) return '<section class="mcs-panel"><h2>مكتبة المقاطع القصيرة</h2><div class="mcs-empty">لا توجد مقاطع قصيرة بعد.</div></section>';
    return (
      '<section class="mcs-panel"><h2>مكتبة المقاطع القصيرة</h2><table class="mcs-table"><thead><tr>' +
      '<th>معاينة</th><th>الاسم</th><th>رقم الحملة</th><th>المدة</th><th>المنصة</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>' +
      state.clips
        .map(function (c) {
          return (
            '<tr><td>' +
            (c.thumbnail || c.url
              ? '<img src="' + esc(c.thumbnail || c.url) + '" alt="" style="width:72px;height:40px;object-fit:cover;border-radius:8px">'
              : '—') +
            '</td><td>' +
            esc(c.title) +
            '</td><td><button class="mcs-btn light" data-open="' +
            esc(c.campaignId) +
            '">' +
            esc(c.campaignId) +
            '</button></td><td>' +
            lat(c.duration || '—') +
            '</td><td>' +
            esc(c.platform) +
            '</td><td>' +
            esc(c.status) +
            '</td><td>' +
            fmtDate(c.createdAt) +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></section>'
    );
  }

  function publishHtml() {
    var ch = state.meta.channels || [];
    return (
      '<section class="mcs-panel"><h2>النشر على المنصات</h2>' +
      '<div class="mcs-chips">' +
      ch
        .map(function (c) {
          return (
            '<span class="mcs-chip">' +
            esc(c.label) +
            ' · ' +
            (c.connected ? 'متصلة' : 'غير متصلة / نشر يدوي') +
            '</span>'
          );
        })
        .join('') +
      '</div>' +
      '<div class="mcs-form" style="margin-top:12px">' +
      '<label>الحملة<select data-pub-campaign>' +
      (state.items || []).map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.id + ' — ' + c.name) + '</option>'; }).join('') +
      '</select></label>' +
      '<label>المنصة<select data-pub-platform>' +
      ch.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.label) + '</option>'; }).join('') +
      '</select></label>' +
      '<label>رابط المنشور<input data-pub-url placeholder="https://..."></label>' +
      '<label>ملاحظة<input data-pub-note></label></div>' +
      '<button class="mcs-btn primary" data-mcs="log-publish"><i class="fas fa-check"></i> تسجيل «تم النشر»</button>' +
      '</section>'
    );
  }

  function recordHtml() {
    return (
      '<section class="mcs-panel"><h2>التصوير بالزر الذكي</h2>' +
      '<p>يسجّل من كاميرا الجهاز إن توفرت، ثم يرفع الملف إلى الحملة المختارة.</p>' +
      '<div class="mcs-form"><label>الحملة<select data-rec-campaign>' +
      (state.items || []).map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.id + ' — ' + c.name) + '</option>'; }).join('') +
      '</select></label></div>' +
      '<video id="mcs-preview" muted playsinline style="max-width:100%;background:#000;border-radius:12px"></video>' +
      '<div class="mcs-actions" style="margin-top:8px">' +
      '<button class="mcs-btn primary" data-mcs="rec-start"><i class="fas fa-circle"></i> بدء التسجيل</button>' +
      '<button class="mcs-btn light" data-mcs="rec-stop">إيقاف ورفع</button>' +
      '</div></section>'
    );
  }

  function activityHtml() {
    if (!state.activity.length) return '<section class="mcs-panel"><h2>سجل الحملات</h2><div class="mcs-empty">لا يوجد نشاط بعد.</div></section>';
    return (
      '<section class="mcs-panel"><h2>سجل الحملات</h2><table class="mcs-table"><thead><tr>' +
      '<th>التاريخ</th><th>الوقت</th><th>رقم الحملة</th><th>العملية</th><th>الموظف</th><th>التفاصيل</th></tr></thead><tbody>' +
      state.activity
        .map(function (a) {
          return (
            '<tr><td>' +
            fmtDate(a.at) +
            '</td><td>' +
            fmtTime((a.at || '').slice(11, 16)) +
            '</td><td>' +
            esc(a.campaignId) +
            '</td><td>' +
            esc(a.action) +
            '</td><td>' +
            esc(a.actorName) +
            (a.employeeNo ? ' · ' + esc(a.employeeNo) : '') +
            '</td><td>' +
            esc(a.detail) +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></section>'
    );
  }

  function metricLabel(k) {
    return (
      {
        views: 'المشاهدات',
        reach: 'الوصول',
        clicks: 'النقرات',
        visits: 'الزيارات',
        leads: 'العملاء المحتملون',
        signups: 'التسجيلات',
        sales: 'المبيعات',
        conversions: 'التحويلات',
        spend: 'المصروف',
      }[k] || k
    );
  }

  function contentStatusLabel(st) {
    var map = ((state.meta && state.meta.contentStatuses) || []).reduce(function (a, x) {
      a[x.id] = x.label;
      return a;
    }, {});
    return map[st] || st;
  }

  function detailHtml() {
    var c = state.campaign;
    if (!c) return '<section class="mcs-panel"><div class="mcs-empty">اختر حملة لعرض التفاصيل.</div></section>';
    var tabs = [
      ['overview', 'نظرة عامة'],
      ['content', 'المحتوى'],
      ['audience', 'الجمهور'],
      ['links', 'الربط'],
      ['channels', 'القنوات'],
      ['budget', 'الميزانية'],
      ['schedule', 'الجدول'],
      ['files', 'الملفات'],
      ['approvals', 'الموافقات'],
      ['performance', 'الأداء'],
      ['reports', 'التقارير'],
      ['log', 'سجل النشاط'],
    ];
    var body = '';
    if (state.detailTab === 'overview') {
      body =
        '<p><strong data-campaign-id="' +
        esc(c.id) +
        '">' +
        esc(c.id) +
        '</strong> · ' +
        badge(c.status, c.statusLabel) +
        ' · المسؤول: ' +
        esc(c.ownerName || '—') +
        '</p>' +
        '<div class="mcs-form">' +
        '<label>الوصف<textarea data-edit="description">' +
        esc(c.description || '') +
        '</textarea></label></div>' +
        '<div class="mcs-savebar" data-savebar>' +
        (state.saveNote || (state.dirty ? 'هناك تغييرات غير محفوظة' : 'تم الحفظ')) +
        '</div>' +
        (can('campaigns.edit') ? '<button class="mcs-btn primary" data-mcs="save-desc"><i class="fas fa-floppy-disk"></i> حفظ التعديل</button>' : '') +
        (c.changeRequestNote ? '<p class="mcs-alert">سبب طلب التعديل: ' + esc(c.changeRequestNote) + '</p>' : '') +
        actionsHtml(c);
    } else if (state.detailTab === 'content') {
      body =
        '<div class="mcs-form">' +
        '<label>عنوان المحتوى<input data-ct-title></label>' +
        '<label>النوع<select data-ct-type>' +
        (state.meta.contentTypes || []).map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.label) + '</option>'; }).join('') +
        '</select></label>' +
        '<label class="mcs-span-2">النص<textarea data-ct-body></textarea></label></div>' +
        (can('campaigns.content') ? '<button class="mcs-btn primary" data-mcs="add-content"><i class="fas fa-plus"></i> إنشاء عنصر محتوى</button>' : '') +
        '<table class="mcs-table"><thead><tr><th>رقم المحتوى</th><th>العنوان</th><th>النوع</th><th>الحالة</th><th>جدولة</th><th>إجراءات</th></tr></thead><tbody>' +
        (c.contents || [])
          .map(function (ct) {
            return (
              '<tr><td>' +
              esc(ct.id) +
              '</td><td>' +
              esc(ct.title) +
              '</td><td>' +
              esc(ct.type) +
              '</td><td>' +
              badge(ct.status, contentStatusLabel(ct.status)) +
              '</td><td>' +
              fmtDate(ct.scheduleDate) +
              ' ' +
              fmtTime(ct.scheduleTime) +
              '</td><td><button class="mcs-btn light" data-ct-act="submit" data-cid="' +
              esc(ct.id) +
              '">إرسال للمراجعة</button> <button class="mcs-btn light" data-ct-sch="' +
              esc(ct.id) +
              '">جدولة</button></td></tr>'
            );
          })
          .join('') +
        '</tbody></table>';
    } else if (state.detailTab === 'audience') {
      body =
        '<div class="mcs-form"><label>نوع الجمهور<input data-aud-type value="جمهور جديد"></label><label>المنطقة<input data-aud-region></label><label>القطاع<input data-aud-sector></label><label class="mcs-span-2">الاهتمامات<input data-aud-int></label><label class="mcs-span-2">ملاحظات الاستهداف<input data-aud-notes></label></div>' +
        (can('campaigns.edit') ? '<button class="mcs-btn primary" data-mcs="add-aud"><i class="fas fa-user-plus"></i> حفظ شريحة جمهور</button>' : '') +
        '<ul>' +
        (c.audiences || []).map(function (a) { return '<li>' + esc(a.id) + ' · ' + esc(a.type) + ' · ' + esc(a.region || '') + ' · ' + esc(a.interests || '') + '</li>'; }).join('') +
        '</ul>';
    } else if (state.detailTab === 'links') {
      var cat = state.catalogs || {};
      var all = []
        .concat((cat.products || []).map(function (p) { return Object.assign({ kind: 'product' }, p); }))
        .concat((cat.services || []).map(function (p) { return Object.assign({ kind: 'service' }, p); }))
        .concat((cat.events || []).map(function (p) { return Object.assign({ kind: 'event' }, p); }))
        .concat((cat.platforms || []).map(function (p) { return Object.assign({ kind: 'platform' }, p); }));
      body =
        '<div class="mcs-form"><label>النوع<select data-lnk-kind><option value="product">منتج</option><option value="service">خدمة</option><option value="event">فعالية</option><option value="platform">منصة</option><option value="external">رابط خارجي</option></select></label>' +
        '<label>العنصر<select data-lnk-ref>' +
        all.map(function (p) { return '<option value="' + esc(p.id) + '" data-kind="' + esc(p.kind) + '">' + esc(p.label) + '</option>'; }).join('') +
        '</select></label>' +
        '<label>رابط خارجي<input data-lnk-url></label></div>' +
        (can('campaigns.edit') ? '<button class="mcs-btn primary" data-mcs="add-link"><i class="fas fa-link"></i> ربط عنصر</button>' : '') +
        '<ul>' +
        (c.links || []).map(function (l) { return '<li>' + esc(l.kind) + ' · ' + esc(l.label || l.refId) + (l.url ? ' · ' + esc(l.url) : '') + '</li>'; }).join('') +
        '</ul>';
    } else if (state.detailTab === 'channels') {
      body =
        '<div class="mcs-chips">' +
        (state.meta.channels || [])
          .map(function (ch) {
            var on = (c.channels || []).some(function (x) { return x.id === ch.id; });
            return '<button type="button" class="mcs-chip' + (on ? ' is-on' : '') + '" data-toggle-ch="' + esc(ch.id) + '">' + esc(ch.label) + ' · ' + (ch.connected ? 'متصلة' : 'تحتاج نشرًا يدويًا') + '</button>';
          })
          .join('') +
        '</div>' +
        (can('campaigns.edit') ? '<button class="mcs-btn primary" data-mcs="save-ch" style="margin-top:8px"><i class="fas fa-floppy-disk"></i> حفظ القنوات</button>' : '');
    } else if (state.detailTab === 'budget') {
      var b = c.budget || {};
      body =
        '<p>الميزانية: ' +
        num(b.total) +
        ' USD · المصروف: ' +
        num(b.spent) +
        ' · المتبقي: ' +
        num(b.remaining) +
        ' · الاستهلاك: ' +
        (b.total ? lat((Number(b.ratio || 0) * 100).toFixed(0)) + '%' : 'لا توجد بيانات متاحة') +
        '</p>' +
        '<div class="mcs-form"><label>الإجمالي<input data-bud="total" type="number" value="' +
        esc(b.total || 0) +
        '"></label><label>تكلفة المحتوى<input data-bud="contentCost" type="number" value="' +
        esc(b.contentCost || 0) +
        '"></label><label>تكلفة الإعلان<input data-bud="adCost" type="number" value="' +
        esc(b.adCost || 0) +
        '"></label><label>أخرى<input data-bud="otherCost" type="number" value="' +
        esc(b.otherCost || 0) +
        '"></label></div>' +
        (can('campaigns.budget') ? '<button class="mcs-btn primary" data-mcs="save-bud"><i class="fas fa-floppy-disk"></i> حفظ الميزانية</button>' : '') +
        '<div class="mcs-form" style="margin-top:10px"><label>مصروف فعلي<input data-exp-amt type="number"></label><label>ملاحظة<input data-exp-note></label></div>' +
        (can('campaigns.budget') ? '<button class="mcs-btn light" data-mcs="add-exp">تسجيل مصروف</button>' : '');
    } else if (state.detailTab === 'schedule') {
      body =
        '<div class="mcs-form"><label>رقم المحتوى<select data-sch-cid>' +
        (c.contents || []).map(function (ct) { return '<option value="' + esc(ct.id) + '">' + esc(ct.id) + '</option>'; }).join('') +
        '</select></label><label>التاريخ<input type="date" data-sch-date></label><label>الوقت<input type="time" data-sch-time value="14:00"></label><label>المنطقة الزمنية<input data-sch-tz value="Asia/Riyadh"></label></div>' +
        '<button class="mcs-btn primary" data-mcs="do-sch"><i class="fas fa-clock"></i> حفظ الجدولة</button>';
    } else if (state.detailTab === 'files') {
      body =
        '<div class="mcs-drop" data-drop="1">اسحب الملف هنا أو اختر ملفًا<input type="file" data-file></div>' +
        '<table class="mcs-table"><thead><tr><th>الاسم</th><th>النوع</th><th>الحجم</th><th>الرافع</th><th>التاريخ</th><th></th></tr></thead><tbody>' +
        (c.assets || [])
          .map(function (a) {
            return (
              '<tr><td>' +
              esc(a.name) +
              '</td><td>' +
              esc(a.kind) +
              '</td><td>' +
              lat(((a.size || 0) / 1024 / 1024).toFixed(2)) +
              ' MB</td><td>' +
              esc(a.uploadedByName || a.uploadedBy) +
              '</td><td>' +
              fmtDate(a.uploadedAt) +
              '</td><td><a href="' +
              esc(a.url) +
              '" target="_blank">معاينة</a> <a href="' +
              esc(a.url) +
              '" download>تنزيل</a>' +
              (can('campaigns.delete') ? ' <button class="mcs-btn danger" data-asset-del="' + esc(a.id) + '">حذف</button>' : '') +
              '</td></tr>'
            );
          })
          .join('') +
        '</tbody></table>';
    } else if (state.detailTab === 'approvals') {
      body =
        '<div class="mcs-actions">' +
        (can('campaigns.edit') ? '<button class="mcs-btn primary" data-act="submit"><i class="fas fa-paper-plane"></i> إرسال للمراجعة</button>' : '') +
        (can('campaigns.approve') ? '<button class="mcs-btn light" data-act="request_changes"><i class="fas fa-pen"></i> طلب تعديل</button>' : '') +
        (can('campaigns.approve') ? '<button class="mcs-btn primary" data-act="approve"><i class="fas fa-check"></i> اعتماد</button>' : '') +
        (can('campaigns.approve') ? '<button class="mcs-btn danger" data-act="reject"><i class="fas fa-xmark"></i> رفض</button>' : '') +
        '</div>' +
        '<label>ملاحظة / السبب<textarea data-act-note></textarea></label>';
    } else if (state.detailTab === 'performance') {
      var m = c.metrics || {};
      var av = m.available || {};
      body = m.hasResults
        ? '<div class="mcs-kpis">' +
          Object.keys(av)
            .map(function (k) {
              return '<article class="mcs-kpi"><strong>' + num(av[k]) + '</strong><span>' + esc(metricLabel(k)) + '</span></article>';
            })
            .join('') +
          '</div>' +
          '<p>نسبة النقر (CTR): ' +
          (m.kpis && m.kpis.ctr != null ? lat((m.kpis.ctr * 100).toFixed(2)) + '%' : 'لا توجد بيانات متاحة') +
          '</p>' +
          '<p>معدل التحويل: ' +
          (m.kpis && m.kpis.conversionRate != null ? lat((m.kpis.conversionRate * 100).toFixed(2)) + '%' : 'لا توجد بيانات متاحة') +
          '</p>' +
          '<p>تكلفة العميل المحتمل: ' +
          (m.kpis && m.kpis.costPerLead != null ? lat(m.kpis.costPerLead.toFixed(2)) : 'لا توجد بيانات متاحة') +
          '</p>' +
          '<p>تكلفة الاكتساب: ' +
          (m.kpis && m.kpis.costPerAcquisition != null ? lat(m.kpis.costPerAcquisition.toFixed(2)) : 'لا توجد بيانات متاحة') +
          '</p>' +
          '<p>العائد على الإنفاق الإعلاني: ' +
          (m.kpis && m.kpis.roas != null ? lat(m.kpis.roas.toFixed(2)) : 'لا توجد بيانات متاحة') +
          '</p>' +
          '<p>العائد على الاستثمار: ' +
          (m.kpis && m.kpis.roi != null ? lat((m.kpis.roi * 100).toFixed(2)) + '%' : 'لا توجد بيانات متاحة') +
          '</p>' +
          '<p>نسبة تحقيق الهدف: ' +
          (m.goalProgress != null ? lat((m.goalProgress * 100).toFixed(0)) + '%' : 'لا توجد بيانات متاحة') +
          '</p>'
        : '<div class="mcs-empty">لا توجد بيانات متاحة</div>';
      body +=
        '<h3>تسجيل نتائج يدوية</h3><div class="mcs-form">' +
        '<label>المنصة<select data-res-pl>' +
        (state.meta.channels || []).map(function (ch) { return '<option value="' + esc(ch.id) + '">' + esc(ch.label) + '</option>'; }).join('') +
        '</select></label>' +
        '<label>التاريخ<input type="date" data-res-date></label>' +
        '<label>المشاهدات<input type="number" data-res-views></label>' +
        '<label>النقرات<input type="number" data-res-clicks></label>' +
        '<label>عملاء محتملون<input type="number" data-res-leads></label>' +
        '<label>مبيعات<input type="number" data-res-sales></label>' +
        '<label>المصروف<input type="number" data-res-spend></label></div>' +
        (can('campaigns.reports') ? '<button class="mcs-btn primary" data-mcs="add-res"><i class="fas fa-chart-line"></i> حفظ النتائج</button>' : '');
    } else if (state.detailTab === 'reports') {
      body =
        (c.report
          ? '<p>آخر تقرير: ' + fmtDate(c.report.generatedAt) + ' · ' + esc(c.report.summary) + '</p>'
          : '<div class="mcs-empty">لا يوجد تقرير نهائي بعد.</div>') +
        (can('campaigns.reports') ? '<button class="mcs-btn primary" data-mcs="mk-report"><i class="fas fa-file-lines"></i> إنشاء التقرير النهائي</button>' : '');
    } else {
      body =
        '<table class="mcs-table"><thead><tr><th>الوقت</th><th>العملية</th><th>الموظف</th><th>التفاصيل</th></tr></thead><tbody>' +
        (c.activity || [])
          .map(function (a) {
            return '<tr><td>' + fmtDate(a.at) + ' ' + fmtTime((a.at || '').slice(11, 16)) + '</td><td>' + esc(a.action) + '</td><td>' + esc(a.actorName) + (a.employeeNo ? ' · ' + esc(a.employeeNo) : '') + '</td><td>' + esc(a.detail) + (a.before && a.after ? ' · من/إلى محفوظ' : '') + '</td></tr>';
          })
          .join('') +
        '</tbody></table>';
    }
    return (
      '<section class="mcs-panel mcs-detail" data-campaign-page data-campaign-id="' +
      esc(c.id) +
      '">' +
      '<div class="mcs-actions"><button class="mcs-btn light" data-close-x><i class="fas fa-arrow-right"></i> رجوع للقائمة</button></div>' +
      '<h2>' +
      esc(c.name) +
      ' ' +
      badge(c.status, c.statusLabel) +
      '</h2>' +
      '<p><strong data-campaign-id="' +
      esc(c.id) +
      '">' +
      esc(c.id) +
      '</strong>' +
      (c.changeRequestNote ? ' · سبب طلب التعديل: ' + esc(c.changeRequestNote) : '') +
      '</p>' +
      '<div class="mcs-tabs">' +
      tabs
        .map(function (t) {
          return '<button class="' + (state.detailTab === t[0] ? 'is-on' : '') + '" data-dtab="' + t[0] + '">' + t[1] + '</button>';
        })
        .join('') +
      '</div>' +
      body +
      '</section>'
    );
  }

  function actionsHtml(c) {
    var btns = [];
    if (can('campaigns.edit')) btns.push('<button class="mcs-btn light" data-act="submit"><i class="fas fa-paper-plane"></i> إرسال للمراجعة</button>');
    if (can('campaigns.approve')) btns.push('<button class="mcs-btn light" data-act="approve"><i class="fas fa-check"></i> اعتماد</button>');
    if (can('campaigns.pause')) {
      btns.push('<button class="mcs-btn light" data-act="activate"><i class="fas fa-play"></i> تشغيل</button>');
      btns.push('<button class="mcs-btn light" data-act="pause"><i class="fas fa-pause"></i> إيقاف مؤقت</button>');
      btns.push('<button class="mcs-btn light" data-act="resume"><i class="fas fa-play"></i> استئناف</button>');
      btns.push('<button class="mcs-btn light" data-act="complete"><i class="fas fa-flag-checkered"></i> إنهاء</button>');
    }
    if (can('campaigns.delete')) btns.push('<button class="mcs-btn light" data-act="archive"><i class="fas fa-box-archive"></i> أرشفة</button>');
    if (can('campaigns.create')) btns.push('<button class="mcs-btn light" data-act="duplicate"><i class="fas fa-copy"></i> نسخ الحملة</button>');
    if (can('campaigns.reports')) btns.push('<button class="mcs-btn light" data-dtab="reports"><i class="fas fa-file-lines"></i> عرض التقرير</button>');
    if (can('campaigns.delete') && (c.status === 'draft' || c.status === 'cancelled' || c.status === 'archived')) {
      btns.push('<button class="mcs-btn danger" data-act="delete"><i class="fas fa-trash"></i> حذف</button>');
    }
    return '<div class="mcs-actions" style="margin-top:10px">' + btns.join('') + '</div>';
  }

  function render() {
    if (!state.meta) {
      root.innerHTML = '<div class="mcs-empty">' + esc(state.error || 'جارٍ تحميل استوديو الحملات…') + '</div>';
      return;
    }
    var main = '';
    if (state.section === 'dashboard') main = dashboardHtml();
    else if (state.section === 'create') main = wizardHtml();
    else if (state.section === 'manage') main = manageHtml();
    else if (state.section === 'calendar') main = calendarHtml();
    else if (state.section === 'videos') main = videosHtml();
    else if (state.section === 'reels') main = reelsHtml();
    else if (state.section === 'clips') main = clipsHtml();
    else if (state.section === 'publish') main = publishHtml();
    else if (state.section === 'record') main = recordHtml();
    else if (state.section === 'detail') main = detailHtml();
    else main = activityHtml();
    root.innerHTML = hero() + nav() + (state.error ? '<div class="mcs-alert">' + esc(state.error) + '</div>' : '') + main;
  }

  function collectWizard() {
    root.querySelectorAll('[data-w]').forEach(function (el) {
      var k = el.getAttribute('data-w');
      state.wizard[k] = el.type === 'number' ? Number(el.value || 0) : el.value;
    });
  }

  async function saveWizard(asDraft) {
    if (state.busy) return;
    collectWizard();
    var w = state.wizard;
    if (!w.name) { toast('اسم الحملة مطلوب'); return; }
    state.busy = true;
    try {
    var goal = (state.meta.goals || []).find(function (g) { return g.id === w.goal; });
    var payload = {
      name: w.name,
      description: w.description,
      type: w.type,
      goal: w.goal,
      goalLabel: goal ? goal.label : w.goal,
      goalTarget: w.goalTarget,
      goalUnit: w.goalUnit || (goal && goal.unit) || '',
      startDate: w.startDate,
      endDate: w.endDate,
      department: w.department,
      priority: w.priority,
      notes: w.notes,
      audiences: [{ type: w.audienceType, region: w.region, age: w.age, interests: w.interests, sector: w.sector, customerType: w.customerType, traits: w.traits }],
      links: w.linkKind === 'external' && w.linkUrl
        ? [{ kind: 'external', url: w.linkUrl, label: w.linkUrl }]
        : w.linkId
          ? [{ kind: w.linkKind, refId: w.linkId, label: w.linkId }]
          : [],
      budget: { total: w.budgetTotal, contentCost: w.contentCost, adCost: w.adCost, otherCost: w.otherCost, currency: 'USD' },
      channels: w.channelIds,
      idempotencyKey: 'wiz-' + Date.now() + '-' + Math.random().toString(16).slice(2),
    };
    if (w.ownerName) payload.ownerName = w.ownerName;
    var created = await api('/api/hub/marketing-campaigns', { method: 'POST', body: payload, headers: { 'Idempotency-Key': payload.idempotencyKey } });
    toast('تم إنشاء ' + created.campaign.id + (asDraft ? ' كمسودة' : ''));
    state.wizard = blankWizard();
    state.wizardStep = 0;
    await refreshAll();
    await openCampaign(created.campaign.id);
    } catch (err) {
      toast(err.message || String(err));
    } finally {
      state.busy = false;
    }
  }

  async function doAction(action) {
    if (!state.campaign) return;
    if (state.busy) return;
    var note = (root.querySelector('[data-act-note]') && root.querySelector('[data-act-note]').value) || '';
    if ((action === 'request_changes' || action === 'reject') && !note) {
      note = prompt('اكتب السبب:') || '';
      if (!note) return;
    }
    if (action === 'delete' && !confirm('حذف الحملة نهائيًا؟')) return;
    state.busy = true;
    try {
    var data = await api('/api/hub/marketing-campaigns/' + encodeURIComponent(state.campaign.id) + '/action', {
      method: 'POST',
      body: { action: action, note: note },
    });
    if (data.deleted) {
      state.campaign = null;
      toast('تم حذف الحملة');
      await refreshAll();
      setSection('manage');
      return;
    }
    state.campaign = data.campaign;
    toast('تم تنفيذ الإجراء');
    await refreshAll();
    if (data.campaign) {
      state.campaign = data.campaign;
      state.section = 'detail';
    }
    render();
    } finally {
      state.busy = false;
    }
  }

  var recChunks = [];
  var recRecorder = null;

  root.addEventListener('click', async function (e) {
    var t = e.target.closest('[data-sec],[data-mcs],[data-open],[data-wiz],[data-ch],[data-act],[data-dtab],[data-close-x],[data-filter-status],[data-cal],[data-cal-view],[data-toggle-ch],[data-ct-act],[data-ct-sch],[data-drop],[data-vid-use],[data-vid-edit],[data-vid-del],[data-asset-del]');
    if (!t) {
      if (e.target.hasAttribute('data-close-detail') && !e.target.closest('[data-drawer]')) {
        state.campaign = null;
        location.hash = 'section=' + state.section;
        render();
      }
      return;
    }
    try {
      if (t.hasAttribute('data-sec')) setSection(t.getAttribute('data-sec'));
      else if (t.getAttribute('data-mcs') === 'new') setSection('create');
      else if (t.getAttribute('data-mcs') === 'upload-only') setSection('videos');
      else if (t.hasAttribute('data-open')) await openCampaign(t.getAttribute('data-open'));
      else if (t.hasAttribute('data-filter-status')) {
        state.filters.status = t.getAttribute('data-filter-status');
        state.section = 'manage';
        await refreshAll();
      } else if (t.hasAttribute('data-wiz')) {
        collectWizard();
        var wact = t.getAttribute('data-wiz');
        if (wact === 'next') state.wizardStep = Math.min(state.wizardStep + 1, WIZARD_STEPS.length - 1);
        if (wact === 'back') state.wizardStep = Math.max(0, state.wizardStep - 1);
        if (wact === 'draft' || wact === 'save') await saveWizard(wact === 'draft');
        else render();
      } else if (t.hasAttribute('data-ch')) {
        var id = t.getAttribute('data-ch');
        var i = state.wizard.channelIds.indexOf(id);
        if (i >= 0) state.wizard.channelIds.splice(i, 1);
        else state.wizard.channelIds.push(id);
        collectWizard();
        render();
      } else if (t.hasAttribute('data-dtab')) {
        state.detailTab = t.getAttribute('data-dtab');
        render();
      } else if (t.hasAttribute('data-close-x')) {
        state.campaign = null;
        setSection('manage');
      } else if (t.hasAttribute('data-cal-view')) {
        state.calView = t.getAttribute('data-cal-view');
        render();
      } else if (t.hasAttribute('data-act')) await doAction(t.getAttribute('data-act'));
      else if (t.hasAttribute('data-cal')) {
        state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + Number(t.getAttribute('data-cal')), 1);
        await refreshAll();
      } else if (t.getAttribute('data-mcs') === 'save-desc') {
        var desc = root.querySelector('[data-edit="description"]').value;
        var saved = await api('/api/hub/marketing-campaigns/' + encodeURIComponent(state.campaign.id), { method: 'PUT', body: { description: desc } });
        state.campaign = saved.campaign;
        state.saveNote = 'تم الحفظ';
        state.dirty = false;
        toast('تم الحفظ');
        render();
      } else if (t.getAttribute('data-mcs') === 'add-content') {
        var payload = {
          title: (root.querySelector('[data-ct-title]') || {}).value,
          type: (root.querySelector('[data-ct-type]') || {}).value,
          body: (root.querySelector('[data-ct-body]') || {}).value,
        };
        var out = await api('/api/hub/marketing-campaigns/' + encodeURIComponent(state.campaign.id) + '/contents', { method: 'POST', body: payload });
        state.campaign = out.campaign;
        toast('تم إنشاء المحتوى');
        render();
      } else if (t.hasAttribute('data-ct-act')) {
        var cid = t.getAttribute('data-cid');
        var r = await api('/api/hub/marketing-campaigns/' + encodeURIComponent(state.campaign.id) + '/contents/' + cid + '/action', { method: 'POST', body: { action: t.getAttribute('data-ct-act') } });
        state.campaign = r.campaign;
        render();
      } else if (t.hasAttribute('data-ct-sch') || t.getAttribute('data-mcs') === 'do-sch') {
        var scid = t.getAttribute('data-ct-sch') || (root.querySelector('[data-sch-cid]') || {}).value;
        var sdate = (root.querySelector('[data-sch-date]') || {}).value;
        var stime = (root.querySelector('[data-sch-time]') || {}).value || '14:00';
        if (!sdate) sdate = prompt('تاريخ الجدولة (YYYY-MM-DD)') || '';
        if (!sdate) return;
        await api('/api/hub/marketing-campaigns/' + encodeURIComponent(state.campaign.id) + '/contents/' + scid, { method: 'PUT', body: { scheduleDate: sdate, scheduleTime: stime } });
        var rs = await api('/api/hub/marketing-campaigns/' + encodeURIComponent(state.campaign.id) + '/contents/' + scid + '/action', { method: 'POST', body: { action: 'schedule' } });
        state.campaign = rs.campaign;
        toast('تمت الجدولة');
        render();
      } else if (t.getAttribute('data-mcs') === 'add-aud') {
        var aud = await api('/api/hub/marketing-campaigns/' + encodeURIComponent(state.campaign.id) + '/audiences', {
          method: 'POST',
          body: {
            type: (root.querySelector('[data-aud-type]') || {}).value,
            region: (root.querySelector('[data-aud-region]') || {}).value,
            interests: (root.querySelector('[data-aud-int]') || {}).value,
            sector: (root.querySelector('[data-aud-sector]') || {}).value,
            notes: (root.querySelector('[data-aud-notes]') || {}).value,
          },
        });
        state.campaign = aud.campaign;
        render();
      } else if (t.getAttribute('data-mcs') === 'add-link') {
        var lnk = await api('/api/hub/marketing-campaigns/' + encodeURIComponent(state.campaign.id) + '/links', {
          method: 'POST',
          body: {
            kind: (root.querySelector('[data-lnk-kind]') || {}).value,
            refId: (root.querySelector('[data-lnk-ref]') || {}).value,
            label: (root.querySelector('[data-lnk-ref]') || {}).value,
            url: (root.querySelector('[data-lnk-url]') || {}).value,
          },
        });
        state.campaign = lnk.campaign;
        toast('تم الربط');
        render();
      } else if (t.getAttribute('data-mcs') === 'save-ch') {
        var ids = [...root.querySelectorAll('[data-toggle-ch].is-on')].map(function (x) { return x.getAttribute('data-toggle-ch'); });
        var chs = await api('/api/hub/marketing-campaigns/' + encodeURIComponent(state.campaign.id) + '/channels', { method: 'PUT', body: { ids: ids } });
        state.campaign = chs.campaign;
        toast('حُفظت القنوات');
        render();
      } else if (t.hasAttribute('data-toggle-ch')) {
        t.classList.toggle('is-on');
      } else if (t.getAttribute('data-mcs') === 'save-bud') {
        var bud = {};
        root.querySelectorAll('[data-bud]').forEach(function (el) { bud[el.getAttribute('data-bud')] = Number(el.value || 0); });
        var bres = await api('/api/hub/marketing-campaigns/' + encodeURIComponent(state.campaign.id) + '/budget', { method: 'PUT', body: bud });
        state.campaign = bres.campaign;
        toast('حُفظت الميزانية');
        render();
      } else if (t.getAttribute('data-mcs') === 'add-exp') {
        var ex = await api('/api/hub/marketing-campaigns/' + encodeURIComponent(state.campaign.id) + '/expenses', {
          method: 'POST',
          body: { amount: Number((root.querySelector('[data-exp-amt]') || {}).value || 0), note: (root.querySelector('[data-exp-note]') || {}).value },
        });
        state.campaign = ex.campaign;
        render();
      } else if (t.getAttribute('data-drop') === '1') {
        if (e.target && e.target.hasAttribute('data-file')) return;
        var inp = t.querySelector('[data-file]');
        if (inp) inp.click();
      } else if (t.hasAttribute('data-asset-del')) {
        await api('/api/hub/marketing-campaigns/' + encodeURIComponent(state.campaign.id) + '/assets/' + t.getAttribute('data-asset-del'), { method: 'DELETE' });
        await openCampaign(state.campaign.id);
        toast('تم حذف الملف');
      } else if (t.hasAttribute('data-vid-use')) {
        var campU = t.getAttribute('data-vid-camp');
        var outU = await api('/api/hub/marketing-campaigns/' + encodeURIComponent(campU) + '/contents', {
          method: 'POST',
          body: { title: 'محتوى من فيديو المكتبة', type: 'video', assetIds: [t.getAttribute('data-vid-use')] },
        });
        toast('أُنشئ المحتوى ' + ((outU.campaign.contents || []).slice(-1)[0] || {}).id);
        await openCampaign(campU);
      } else if (t.hasAttribute('data-vid-edit')) {
        var nn = prompt('اسم الملف:') || '';
        if (!nn) return;
        await api('/api/hub/marketing-campaigns/' + encodeURIComponent(t.getAttribute('data-vid-camp')) + '/assets/' + t.getAttribute('data-vid-edit'), { method: 'PUT', body: { name: nn } });
        await refreshAll();
        toast('تم التعديل');
      } else if (t.hasAttribute('data-vid-del')) {
        await api('/api/hub/marketing-campaigns/' + encodeURIComponent(t.getAttribute('data-vid-camp')) + '/assets/' + t.getAttribute('data-vid-del'), { method: 'DELETE' });
        await refreshAll();
        toast('تم الحذف');
      } else if (t.getAttribute('data-mcs') === 'add-res') {
        var rr = await api('/api/hub/marketing-campaigns/' + encodeURIComponent(state.campaign.id) + '/results', {
          method: 'POST',
          body: {
            platform: (root.querySelector('[data-res-pl]') || {}).value,
            date: (root.querySelector('[data-res-date]') || {}).value,
            views: Number((root.querySelector('[data-res-views]') || {}).value || 0),
            clicks: Number((root.querySelector('[data-res-clicks]') || {}).value || 0),
            leads: Number((root.querySelector('[data-res-leads]') || {}).value || 0),
            sales: Number((root.querySelector('[data-res-sales]') || {}).value || 0),
            spend: Number((root.querySelector('[data-res-spend]') || {}).value || 0),
          },
        });
        state.campaign = rr.campaign;
        toast('حُفظت النتائج');
        render();
      } else if (t.getAttribute('data-mcs') === 'mk-report') {
        var rp = await api('/api/hub/marketing-campaigns/' + encodeURIComponent(state.campaign.id) + '/report', { method: 'POST', body: {} });
        state.campaign = rp.campaign;
        toast('تم إنشاء التقرير');
        render();
      } else if (t.getAttribute('data-mcs') === 'log-publish') {
        var pid = (root.querySelector('[data-pub-campaign]') || {}).value;
        var pub = await api('/api/hub/marketing-campaigns/' + encodeURIComponent(pid) + '/publish', {
          method: 'POST',
          body: {
            platform: (root.querySelector('[data-pub-platform]') || {}).value,
            url: (root.querySelector('[data-pub-url]') || {}).value,
            note: (root.querySelector('[data-pub-note]') || {}).value,
          },
        });
        toast('تم تسجيل النشر · ' + pub.campaign.id);
        await refreshAll();
      } else if (t.getAttribute('data-mcs') === 'make-clip') {
        var camp = (root.querySelector('[data-clip-campaign]') || {}).value;
        var fileEl = root.querySelector('[data-clip-file]');
        var assetId = '';
        if (fileEl && fileEl.files && fileEl.files[0]) {
          var up = await uploadFile(fileEl.files[0]);
          var as = await api('/api/hub/marketing-campaigns/' + encodeURIComponent(camp) + '/assets', {
            method: 'POST',
            body: { kind: 'short', name: fileEl.files[0].name, mime: fileEl.files[0].type, size: fileEl.files[0].size, url: up.url, uploadId: up.id },
          });
          assetId = (as.campaign.assets.slice(-1)[0] || {}).id;
        }
        await api('/api/hub/marketing-campaigns/' + encodeURIComponent(camp) + '/clips', {
          method: 'POST',
          body: {
            title: (root.querySelector('[data-clip-title]') || {}).value,
            duration: (root.querySelector('[data-clip-dur]') || {}).value,
            platform: (root.querySelector('[data-clip-platform]') || {}).value,
            assetId: assetId,
          },
        });
        toast('حُفظ المقطع');
        await refreshAll();
      } else if (t.getAttribute('data-mcs') === 'rec-start') {
        if (!navigator.mediaDevices || !window.MediaRecorder) { toast('التسجيل غير مدعوم في هذا المتصفح'); return; }
        var stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        var v = document.getElementById('mcs-preview');
        if (v) v.srcObject = stream;
        recChunks = [];
        recRecorder = new MediaRecorder(stream);
        recRecorder.ondataavailable = function (ev) { if (ev.data.size) recChunks.push(ev.data); };
        recRecorder.start();
        toast('بدأ التسجيل');
      } else if (t.getAttribute('data-mcs') === 'rec-stop') {
        if (!recRecorder) return;
        await new Promise(function (resolve) {
          recRecorder.onstop = resolve;
          recRecorder.stop();
        });
        var blob = new Blob(recChunks, { type: 'video/webm' });
        var file = new File([blob], 'smart-record.webm', { type: 'video/webm' });
        var campId = (root.querySelector('[data-rec-campaign]') || {}).value;
        var up2 = await uploadFile(file);
        await api('/api/hub/marketing-campaigns/' + encodeURIComponent(campId) + '/assets', {
          method: 'POST',
          body: { kind: 'video', name: file.name, mime: file.type, size: file.size, url: up2.url, uploadId: up2.id },
        });
        toast('تم رفع التسجيل');
        await refreshAll();
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
    if (e.target.hasAttribute('data-file') && e.target.files && e.target.files[0] && state.campaign) {
      try {
        var file = e.target.files[0];
        var up = await uploadFile(file);
        var kind = file.type.indexOf('video') === 0 ? 'video' : file.type.indexOf('image') === 0 ? 'image' : 'file';
        var out = await api('/api/hub/marketing-campaigns/' + encodeURIComponent(state.campaign.id) + '/assets', {
          method: 'POST',
          body: { kind: kind, name: file.name, mime: file.type, size: file.size, url: up.url, uploadId: up.id },
        });
        state.campaign = out.campaign;
        state.section = 'detail';
        toast('تم رفع الملف');
        render();
      } catch (err) {
        toast(err.message || String(err));
      }
    }
  });

  root.addEventListener('input', function (e) {
    if (e.target && e.target.hasAttribute('data-edit')) {
      state.dirty = true;
      state.saveNote = 'هناك تغييرات غير محفوظة';
      var bar = root.querySelector('[data-savebar]');
      if (bar) bar.textContent = state.saveNote;
    }
  });

  root.addEventListener('dragover', function (e) {
    if (e.target.closest('[data-drop]')) {
      e.preventDefault();
    }
  });
  root.addEventListener('drop', async function (e) {
    var zone = e.target.closest('[data-drop]');
    if (!zone || !state.campaign) return;
    e.preventDefault();
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    try {
      var up = await uploadFile(file);
      var kind = file.type.indexOf('video') === 0 ? 'video' : file.type.indexOf('image') === 0 ? 'image' : 'file';
      var out = await api('/api/hub/marketing-campaigns/' + encodeURIComponent(state.campaign.id) + '/assets', {
        method: 'POST',
        body: { kind: kind, name: file.name, mime: file.type, size: file.size, url: up.url, uploadId: up.id },
      });
      state.campaign = out.campaign;
      state.section = 'detail';
      toast('تم رفع الملف');
      render();
    } catch (err) {
      toast(err.message || String(err));
    }
  });

  window.addEventListener('hashchange', function () {
    var h = location.hash.replace(/^#/, '');
    if (h.indexOf('campaign=') === 0) openCampaign(h.split('=')[1]).catch(function () {});
    else if (h.indexOf('section=') === 0) {
      state.section = h.split('=')[1];
      render();
    }
  });

  refreshAll().then(function () {
    var h = location.hash.replace(/^#/, '');
    if (h.indexOf('campaign=') === 0) return openCampaign(h.split('=')[1]);
    if (h.indexOf('section=') === 0) setSection(h.split('=')[1]);
  });
})();
