/**
 * Advertising Management Workspace
 * Create → Review → Approve → Publish → Edit → Pause → Resume → Delete
 */
(function () {
  'use strict';

  var root = document.getElementById('ads-workspace');
  if (!root) return;

  var STEPS = ['المحتوى', 'مكان الظهور', 'الجمهور', 'الجدولة', 'المراجعة'];
  var PLACES = [
    { id: 'home', label: 'الصفحة الرئيسية', hint: 'يظهر في المساحات الإعلانية بالصفحة الرئيسية.' },
    { id: 'products', label: 'صفحة المنتجات', hint: 'يظهر ضمن صفحات المنتجات.' },
    { id: 'store', label: 'المتجر', hint: 'يظهر في صفحات المتجر.' },
    { id: 'articles', label: 'المقالات', hint: 'يظهر بجانب المقالات.' },
    { id: 'services', label: 'الخدمات', hint: 'يظهر في صفحات الخدمات.' },
    { id: 'incubators', label: 'الحاضنات', hint: 'يظهر في صفحات الحاضنات.' },
    { id: 'branches', label: 'الفروع', hint: 'يظهر في صفحات الفروع.' },
    { id: 'custom', label: 'صفحة محددة', hint: 'اختر صفحة وموضعاً محدداً.' }
  ];
  var CTA_OPTIONS = [
    { value: '', label: 'بدون زر' },
    { value: 'اعرف المزيد', label: 'اعرف المزيد' },
    { value: 'تسوق الآن', label: 'تسوق الآن' },
    { value: 'سجل الآن', label: 'سجل الآن' },
    { value: 'تواصل معنا', label: 'تواصل معنا' }
  ];

  var ui = {
    section: 'mine',
    filter: 'all',
    q: '',
    typeFilter: '',
    wizardOpen: false,
    wizardStep: 0,
    editingId: '',
    successCode: '',
    drawerId: '',
    autosaveNote: '',
    showAdvancedAudience: false,
    errors: {}
  };

  var draft = blankDraft();

  function blankDraft() {
    return {
      contentType: 'image',
      title: '',
      headline: '',
      desc: '',
      bodyText: '',
      mediaDataUrl: '',
      mediaName: '',
      mediaSize: 0,
      thumbnailDataUrl: '',
      destinationUrl: '',
      ctaLabel: '',
      fileAction: 'open',
      placements: [],
      customPage: '',
      position: 'top',
      audience: 'all',
      audienceDetail: '',
      scheduleMode: 'immediate',
      adStartDate: '',
      adStartTime: '',
      adEndDate: '',
      adEndTime: ''
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
    else try { alert(msg); } catch (e) {}
  }

  function listings() {
    return (window.HubStore && HubStore.get && HubStore.get().empire.adsStudio.listings) || [];
  }

  function workflowOf(ad) {
    if (window.HubStore && HubStore.resolveWorkflowStatus) return HubStore.resolveWorkflowStatus(ad);
    return ad.workflowStatus || (ad.status === 'active' ? 'active' : ad.status === 'paused' ? 'paused' : 'draft');
  }

  function statusMeta(wf) {
    var map = {
      draft: { label: 'مسودة', cls: 'is-draft' },
      pending_review: { label: 'بانتظار المراجعة', cls: 'is-pending' },
      approved: { label: 'مقبول', cls: 'is-active' },
      scheduled: { label: 'مجدول', cls: 'is-scheduled' },
      active: { label: 'نشط', cls: 'is-active' },
      paused: { label: 'متوقف', cls: 'is-paused' },
      rejected: { label: 'مرفوض', cls: 'is-rejected' },
      ended: { label: 'منتهي', cls: 'is-ended' }
    };
    return map[wf] || { label: wf || '—', cls: 'is-draft' };
  }

  function contentTypeLabel(t) {
    return ({ image: 'صورة', video: 'فيديو', file: 'ملف', text: 'نص', link: 'رابط' }[t] || t || '—');
  }

  function placeLabels(ad) {
    var ids = ad.placements || [];
    if (!ids.length && ad.publishTargets && ad.publishTargets.home) ids = ['home'];
    return ids
      .map(function (id) {
        var p = PLACES.find(function (x) { return x.id === id; });
        return p ? p.label : id;
      })
      .join(' + ') || '—';
  }

  function counts() {
    var all = listings().filter(function (a) { return a.status !== 'deleted'; });
    var c = { all: all.length, active: 0, pending_review: 0, scheduled: 0, paused: 0, ended: 0 };
    all.forEach(function (a) {
      var w = workflowOf(a);
      if (w === 'active' || w === 'approved') c.active += 1;
      else if (w === 'pending_review') c.pending_review += 1;
      else if (w === 'scheduled') c.scheduled += 1;
      else if (w === 'paused' || w === 'draft') c.paused += 1;
      else if (w === 'ended' || w === 'rejected') c.ended += 1;
    });
    return c;
  }

  function filteredAds() {
    var q = String(ui.q || '').trim().toLowerCase();
    return listings().filter(function (a) {
      if (a.status === 'deleted') return false;
      var w = workflowOf(a);
      if (ui.filter === 'active' && !(w === 'active' || w === 'approved')) return false;
      if (ui.filter === 'pending_review' && w !== 'pending_review') return false;
      if (ui.filter === 'scheduled' && w !== 'scheduled') return false;
      if (ui.filter === 'paused' && !(w === 'paused' || w === 'draft')) return false;
      if (ui.filter === 'ended' && !(w === 'ended' || w === 'rejected')) return false;
      if (ui.typeFilter && a.contentType !== ui.typeFilter) return false;
      if (!q) return true;
      var hay = ((a.title || '') + ' ' + (a.adCode || '') + ' ' + (a.id || '')).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function perf() {
    var all = listings();
    var views = 0;
    var clicks = 0;
    var active = 0;
    all.forEach(function (a) {
      views += Number(a.views || a.impressions || 0);
      clicks += Number(a.clicks || 0);
      if (workflowOf(a) === 'active') active += 1;
    });
    var ctr = views ? ((clicks / views) * 100).toFixed(1) : '0.0';
    return { views: views, clicks: clicks, ctr: ctr, active: active };
  }

  function activityFeed() {
    var rows = [];
    listings().forEach(function (a) {
      (a.activity || []).slice(0, 3).forEach(function (ev) {
        rows.push({
          at: ev.at,
          message: (a.adCode || a.title) + ' — ' + ev.message,
          actor: ev.actor
        });
      });
    });
    rows.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    return rows.slice(0, 12);
  }

  function DRAFT_KEY() {
    return 'naiosh_ad_wizard_draft_v1';
  }

  function autosave() {
    try {
      localStorage.setItem(DRAFT_KEY(), JSON.stringify({ draft: draft, step: ui.wizardStep, editingId: ui.editingId }));
      ui.autosaveNote = '✓ تم حفظ المسودة';
    } catch (e) {
      ui.autosaveNote = '';
    }
  }

  function loadAutosave() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY());
      if (!raw) return;
      var bag = JSON.parse(raw);
      if (bag && bag.draft) {
        draft = Object.assign(blankDraft(), bag.draft);
        ui.wizardStep = bag.step || 0;
        ui.editingId = bag.editingId || '';
      }
    } catch (e) {}
  }

  function clearAutosave() {
    try { localStorage.removeItem(DRAFT_KEY()); } catch (e) {}
    ui.autosaveNote = '';
  }

  function openWizard(ad) {
    ui.wizardOpen = true;
    ui.wizardStep = 0;
    ui.errors = {};
    ui.successCode = '';
    ui.showAdvancedAudience = false;
    if (ad) {
      ui.editingId = ad.id;
      draft = {
        contentType: ad.contentType || 'image',
        title: ad.title || '',
        headline: ad.headline || ad.title || '',
        desc: ad.desc || '',
        bodyText: ad.bodyText || ad.content || '',
        mediaDataUrl: ad.mediaDataUrl || ad.imageDataUrl || '',
        mediaName: ad.mediaName || '',
        mediaSize: ad.mediaSize || 0,
        thumbnailDataUrl: ad.thumbnailDataUrl || '',
        destinationUrl: ad.destinationUrl || '',
        ctaLabel: ad.ctaLabel || '',
        fileAction: ad.fileAction || 'open',
        placements: (ad.placements || []).slice(),
        customPage: ad.customPage || '',
        position: ad.position || 'top',
        audience: ad.audience || 'all',
        audienceDetail: ad.audienceDetail || '',
        scheduleMode: ad.scheduleMode || 'immediate',
        adStartDate: ad.adStartDate || '',
        adStartTime: ad.adStartTime || '',
        adEndDate: ad.adEndDate || '',
        adEndTime: ad.adEndTime || ''
      };
    } else {
      ui.editingId = '';
      loadAutosave();
      if (!draft.title) draft = blankDraft();
    }
    render();
  }

  function closeWizard() {
    ui.wizardOpen = false;
    render();
  }

  function validateStep() {
    ui.errors = {};
    if (ui.wizardStep === 0) {
      if (!draft.title.trim()) ui.errors.title = 'اسم الإعلان مطلوب';
      if (!draft.headline.trim()) ui.errors.headline = 'عنوان الإعلان مطلوب';
      if (draft.contentType === 'image' && !draft.mediaDataUrl) ui.errors.media = 'الصورة مطلوبة';
      if (draft.contentType === 'video' && !draft.mediaDataUrl) ui.errors.media = 'الفيديو مطلوب';
      if (draft.contentType === 'file' && !draft.mediaDataUrl) ui.errors.media = 'الملف مطلوب';
      if (draft.contentType === 'text' && !String(draft.bodyText || '').trim()) ui.errors.bodyText = 'النص مطلوب';
      if (draft.ctaLabel && !String(draft.destinationUrl || '').trim()) {
        ui.errors.destinationUrl = 'رابط الوجهة مطلوب مع زر CTA';
      }
      if (draft.destinationUrl && !/^https?:\/\//i.test(draft.destinationUrl.trim())) {
        ui.errors.destinationUrl = 'أدخل رابطاً يبدأ بـ http أو https';
      }
    }
    if (ui.wizardStep === 1) {
      if (!draft.placements.length) ui.errors.placements = 'اختر مكان ظهور واحد على الأقل';
    }
    if (ui.wizardStep === 3 && draft.scheduleMode === 'scheduled') {
      if (!draft.adStartDate) ui.errors.adStartDate = 'تاريخ البداية مطلوب';
      if (!draft.adEndDate) ui.errors.adEndDate = 'تاريخ النهاية مطلوب';
      if (draft.adStartDate && draft.adEndDate && draft.adEndDate < draft.adStartDate) {
        ui.errors.adEndDate = 'تاريخ النهاية يجب أن يكون بعد البداية';
      }
    }
    return Object.keys(ui.errors).length === 0;
  }

  function submitDraft(asDraft) {
    if (!asDraft && !validateStep()) {
      ui.wizardStep = 0;
      for (var i = 0; i < STEPS.length; i++) {
        ui.wizardStep = i;
        if (!validateStep()) break;
      }
      render();
      return;
    }
    if (!asDraft) {
      ui.wizardStep = 4;
      if (!validateStep()) {
        render();
        return;
      }
    }
    var payload = {
      title: draft.title,
      headline: draft.headline,
      desc: draft.desc || draft.bodyText,
      bodyText: draft.bodyText,
      contentType: draft.contentType,
      mediaDataUrl: draft.mediaDataUrl,
      mediaName: draft.mediaName,
      mediaSize: draft.mediaSize,
      thumbnailDataUrl: draft.thumbnailDataUrl,
      destinationUrl: draft.destinationUrl,
      ctaLabel: draft.ctaLabel,
      fileAction: draft.fileAction,
      placements: draft.placements.slice(),
      position: draft.position,
      audience: draft.audience,
      audienceDetail: draft.audienceDetail,
      scheduleMode: draft.scheduleMode,
      adStartDate: draft.adStartDate,
      adStartTime: draft.adStartTime,
      adEndDate: draft.adEndDate,
      adEndTime: draft.adEndTime,
      publishStatus: 'draft',
      workflowStatus: asDraft ? 'draft' : 'pending_review',
      status: 'paused'
    };

    var ad;
    if (ui.editingId && HubStore.updateAdListing) {
      ad = HubStore.updateAdListing(ui.editingId, Object.assign({}, payload, {
        workflowStatus: asDraft ? workflowOf(listings().find(function (x) { return x.id === ui.editingId; })) : 'pending_review',
        publishStatus: asDraft ? undefined : 'draft',
        status: asDraft ? undefined : 'paused'
      }));
      if (!asDraft && HubStore.setAdWorkflowStatus) {
        ad = HubStore.setAdWorkflowStatus(ui.editingId, 'pending_review');
      }
    } else {
      ad = HubStore.addAdListing(payload);
    }

    if (!ad) {
      toast('تعذر حفظ الإعلان', 'error');
      return;
    }

    if (!asDraft && window.HubCustomerRequests && HubCustomerRequests.ensureForAd) {
      var req = HubCustomerRequests.ensureForAd(ad, ad.createdBy || 'عميل');
      if (req && req.id) {
        ad.requestId = req.id;
        if (HubStore.updateAdListing) HubStore.updateAdListing(ad.id, { requestId: req.id });
      }
    }

    clearAutosave();
    if (asDraft) {
      toast('تم حفظ المسودة', 'success');
      ui.wizardOpen = false;
    } else {
      ui.successCode = ad.adCode || ad.id;
      ui.wizardOpen = false;
    }
    render();
  }

  function render() {
    var c = counts();
    var p = perf();
    var ads = filteredAds();
    root.innerHTML =
      headHtml() +
      navHtml() +
      (ui.section === 'mine' || ui.section === 'summary' ? summaryHtml(c) + mineHtml(ads) : '') +
      (ui.section === 'perf' ? perfHtml(p) : '') +
      (ui.section === 'activity' || ui.section === 'requests' ? activityHtml() : '') +
      (ui.section === 'requests' ? requestsHtml() : '') +
      (ui.successCode ? successHtml() : '') +
      (ui.wizardOpen ? wizardHtml() : '') +
      (ui.drawerId ? drawerHtml() : '');
    bind();
  }

  function headHtml() {
    return (
      '<section class="ads-ws-head">' +
        '<div>' +
          '<h1>إدارة الإعلانات</h1>' +
          '<p>أنشئ إعلاناً جديداً وحدد أين يظهر ومتى يتم نشره، ثم تابع أداءه من مكان واحد.</p>' +
        '</div>' +
        '<div class="ads-ws-head-actions">' +
          '<button type="button" class="ads-ws-btn ghost" data-ads-help>؟ كيف أنشئ إعلاناً؟</button>' +
          '<a class="ads-ws-btn ghost" href="index.html#hub-ads" data-ads-preview>معاينة أماكن الإعلانات</a>' +
          '<button type="button" class="ads-ws-btn primary" data-ads-create><i class="fas fa-plus"></i> إضافة إعلان جديد</button>' +
        '</div>' +
      '</section>'
    );
  }

  function navHtml() {
    var items = [
      ['mine', 'إعلاناتي'],
      ['perf', 'الأداء'],
      ['requests', 'الطلبات'],
      ['activity', 'سجل النشاط']
    ];
    return (
      '<nav class="ads-ws-nav">' +
      items
        .map(function (it) {
          return (
            '<button type="button" class="' +
            (ui.section === it[0] || (ui.section === 'summary' && it[0] === 'mine') ? 'is-on' : '') +
            '" data-ads-section="' +
            it[0] +
            '">' +
            it[1] +
            '</button>'
          );
        })
        .join('') +
      '</nav>'
    );
  }

  function summaryHtml(c) {
    var cards = [
      ['all', 'إجمالي الإعلانات', c.all],
      ['active', 'نشطة', c.active],
      ['pending_review', 'بانتظار المراجعة', c.pending_review],
      ['scheduled', 'مجدولة', c.scheduled],
      ['paused', 'متوقفة', c.paused],
      ['ended', 'منتهية', c.ended]
    ];
    return (
      '<section class="ads-ws-section" id="ads-summary">' +
        '<h2>ملخص الإعلانات</h2>' +
        '<div class="ads-summary-grid">' +
        cards
          .map(function (x) {
            return (
              '<button type="button" class="ads-summary-card' +
              (ui.filter === x[0] ? ' is-on' : '') +
              '" data-ads-filter="' +
              x[0] +
              '"><strong>' +
              x[2] +
              '</strong><span>' +
              x[1] +
              '</span></button>'
            );
          })
          .join('') +
        '</div></section>'
    );
  }

  function mineHtml(ads) {
    var tabs = [
      ['all', 'الكل'],
      ['active', 'نشطة'],
      ['pending_review', 'بانتظار المراجعة'],
      ['scheduled', 'مجدولة'],
      ['paused', 'متوقفة'],
      ['ended', 'منتهية']
    ];
    return (
      '<section class="ads-ws-section" id="ads-mine">' +
        '<h2>إعلاناتي</h2>' +
        '<div class="ads-tabs">' +
        tabs
          .map(function (t) {
            return (
              '<button type="button" class="' +
              (ui.filter === t[0] ? 'is-on' : '') +
              '" data-ads-filter="' +
              t[0] +
              '">' +
              t[1] +
              '</button>'
            );
          })
          .join('') +
        '</div>' +
        '<div class="ads-toolbar">' +
          '<input type="search" data-ads-q value="' +
          esc(ui.q) +
          '" placeholder="ابحث باسم الإعلان أو رقم الإعلان...">' +
          '<select data-ads-type>' +
            '<option value="">نوع الإعلان</option>' +
            '<option value="image"' + (ui.typeFilter === 'image' ? ' selected' : '') + '>صورة</option>' +
            '<option value="video"' + (ui.typeFilter === 'video' ? ' selected' : '') + '>فيديو</option>' +
            '<option value="file"' + (ui.typeFilter === 'file' ? ' selected' : '') + '>ملف</option>' +
            '<option value="text"' + (ui.typeFilter === 'text' ? ' selected' : '') + '>نص</option>' +
          '</select>' +
        '</div>' +
        '<div class="ads-cards">' +
        (ads.length
          ? ads.map(cardHtml).join('')
          : '<div class="ads-empty">لا توجد إعلانات في هذا التصفية. اضغط «إضافة إعلان جديد» للبدء.</div>') +
        '</div></section>'
    );
  }

  function cardHtml(ad) {
    var w = workflowOf(ad);
    var meta = statusMeta(w);
    var media =
      ad.contentType === 'video' && ad.mediaDataUrl
        ? '<video src="' + esc(ad.mediaDataUrl) + '" muted></video>'
        : ad.mediaDataUrl
          ? '<img src="' + esc(ad.mediaDataUrl) + '" alt="">'
          : '<i class="fas fa-' +
            (ad.contentType === 'video' ? 'film' : ad.contentType === 'file' ? 'file-pdf' : ad.contentType === 'text' ? 'align-left' : 'image') +
            '"></i>';
    var views = Number(ad.views || ad.impressions || 0);
    var clicks = Number(ad.clicks || 0);
    var ctr = views ? ((clicks / views) * 100).toFixed(1) : '0.0';
    var pauseLabel = w === 'paused' || w === 'draft' ? 'تشغيل' : 'إيقاف';
    return (
      '<article class="ads-card" data-ad-id="' +
      esc(ad.id) +
      '">' +
      '<div class="ads-card-media">' +
      media +
      '</div>' +
      '<div class="ads-card-body">' +
      '<h3>' +
      esc(ad.title || 'بدون عنوان') +
      '</h3>' +
      '<div class="ads-meta-row">' +
      '<span>Ad ID: ' +
      esc(ad.adCode || ad.id) +
      '</span>' +
      '<span>النوع: ' +
      esc(contentTypeLabel(ad.contentType)) +
      '</span>' +
      '<span class="ads-badge ' +
      meta.cls +
      '">● ' +
      esc(meta.label) +
      '</span>' +
      '</div>' +
      '<div class="ads-meta-row">مكان الظهور: ' +
      esc(placeLabels(ad)) +
      '</div>' +
      '<div class="ads-meta-row">الفترة: ' +
      esc((ad.adStartDate || '—') + ' → ' + (ad.adEndDate || '—')) +
      '</div>' +
      (w === 'rejected' && ad.rejectionReason
        ? '<p class="ads-field-error">سبب الرفض: ' + esc(ad.rejectionReason) + '</p>'
        : '') +
      '<div class="ads-card-stats"><span>مشاهدات<br>' +
      views.toLocaleString('en-US') +
      '</span><span>نقرات<br>' +
      clicks.toLocaleString('en-US') +
      '</span><span>CTR<br>' +
      ctr +
      '%</span></div>' +
      '<div class="ads-card-actions">' +
      '<button type="button" class="ads-ws-btn ghost" data-ads-preview-one="' +
      esc(ad.id) +
      '">معاينة</button>' +
      '<button type="button" class="ads-ws-btn ghost" data-ads-edit="' +
      esc(ad.id) +
      '">تعديل</button>' +
      '<button type="button" class="ads-ws-btn ghost" data-ads-toggle="' +
      esc(ad.id) +
      '">' +
      pauseLabel +
      '</button>' +
      '<button type="button" class="ads-ws-btn ghost" data-ads-more="' +
      esc(ad.id) +
      '" title="المزيد">⋮</button>' +
      '</div></div></article>'
    );
  }

  function perfHtml(p) {
    return (
      '<section class="ads-ws-section" id="ads-perf">' +
        '<h2>أداء الإعلانات</h2>' +
        '<div class="ads-perf-grid">' +
          '<div class="ads-summary-card"><strong>' + p.views.toLocaleString('en-US') + '</strong><span>إجمالي المشاهدات</span></div>' +
          '<div class="ads-summary-card"><strong>' + p.clicks.toLocaleString('en-US') + '</strong><span>إجمالي النقرات</span></div>' +
          '<div class="ads-summary-card"><strong>' + p.ctr + '%</strong><span>CTR</span></div>' +
          '<div class="ads-summary-card"><strong>' + p.active + '</strong><span>الإعلانات النشطة</span></div>' +
        '</div>' +
        '<div class="ads-chart">المشاهدات والنقرات خلال آخر 30 يوم — تتحدث مع حركة الإعلانات الفعلية</div>' +
      '</section>'
    );
  }

  function activityHtml() {
    var rows = activityFeed();
    return (
      '<section class="ads-ws-section" id="ads-activity">' +
        '<h2>سجل النشاط</h2>' +
        '<div class="ads-activity">' +
        (rows.length
          ? rows
              .map(function (r) {
                return (
                  '<article><time>' +
                  esc(String(r.at || '').replace('T', ' ').slice(0, 16)) +
                  '</time>' +
                  esc(r.message) +
                  '</article>'
                );
              })
              .join('')
          : '<div class="ads-empty">لا يوجد نشاط بعد.</div>') +
        '</div></section>'
    );
  }

  function requestsHtml() {
    var reqs =
      (window.HubCustomerRequests &&
        HubCustomerRequests.list &&
        HubCustomerRequests.list({}).filter(function (r) {
          return r.requestType === 'Ad Submission' || r.referenceType === 'Ad';
        })) ||
      [];
    return (
      '<section class="ads-ws-section">' +
        '<h2>طلبات نشر الإعلانات</h2>' +
        '<p style="color:#667085;font-weight:700">تظهر أيضاً في عملاء بوشا → طلبات العملاء.</p>' +
        '<div class="ads-activity">' +
        (reqs.length
          ? reqs
              .slice(0, 20)
              .map(function (r) {
                return (
                  '<article><time>' +
                  esc(String(r.createdAt || '').slice(0, 16)) +
                  '</time><strong>' +
                  esc(r.id) +
                  '</strong> — ' +
                  esc(r.title) +
                  ' · ' +
                  esc(r.status) +
                  (window.HubAuth && HubAuth.isStaff && HubAuth.isStaff()
                    ? ' <button type="button" class="ads-ws-btn ghost" data-ads-approve-req="' +
                      esc(r.referenceId) +
                      '">موافقة</button> <button type="button" class="ads-ws-btn ghost" data-ads-reject-req="' +
                      esc(r.referenceId) +
                      '">رفض</button>'
                    : '') +
                  '</article>'
                );
              })
              .join('')
          : '<div class="ads-empty">لا توجد طلبات إعلانات حالياً.</div>') +
        '</div></section>'
    );
  }

  function successHtml() {
    return (
      '<section class="ads-ws-section ads-success">' +
        '<h2>✓ تم إرسال الإعلان للمراجعة</h2>' +
        '<p>رقم الإعلان</p>' +
        '<code>' +
        esc(ui.successCode) +
        '</code>' +
        '<p>الحالة: بانتظار المراجعة</p>' +
        '<p>سيظهر الإعلان تلقائياً بعد موافقة الإدارة وفي الموعد الذي حددته.</p>' +
        '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
          '<button type="button" class="ads-ws-btn primary" data-ads-clear-success>العودة إلى إعلاناتي</button>' +
        '</div></section>'
    );
  }

  function wizardHtml() {
    return (
      '<div class="ads-wizard-overlay" data-ads-wizard-overlay>' +
        '<div class="ads-wizard" role="dialog" aria-modal="true">' +
          '<div class="ads-wizard-head">' +
            '<h2>' +
            (ui.editingId ? 'تعديل الإعلان' : 'إنشاء إعلان جديد') +
            '</h2>' +
            '<p style="margin:8px 0 0;color:#667085;font-weight:700">الخطوة ' +
            (ui.wizardStep + 1) +
            ' من ' +
            STEPS.length +
            (ui.autosaveNote ? ' · <span class="ads-autosave">' + ui.autosaveNote + '</span>' : '') +
            '</p>' +
          '</div>' +
          '<div class="ads-wizard-steps">' +
          STEPS.map(function (s, i) {
            return '<span class="' + (i === ui.wizardStep ? 'is-on' : '') + '">' + (i + 1) + '. ' + s + '</span>';
          }).join('') +
          '</div>' +
          '<div class="ads-wizard-body">' +
          wizardBody() +
          '</div>' +
          '<div class="ads-wizard-foot">' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
              '<button type="button" class="ads-ws-btn ghost" data-ads-cancel>إلغاء</button>' +
              (ui.wizardStep > 0 ? '<button type="button" class="ads-ws-btn ghost" data-ads-back>رجوع</button>' : '') +
            '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
              '<button type="button" class="ads-ws-btn ghost" data-ads-save-draft>حفظ كمسودة</button>' +
              (ui.wizardStep < STEPS.length - 1
                ? '<button type="button" class="ads-ws-btn primary" data-ads-next>التالي</button>'
                : '<button type="button" class="ads-ws-btn primary" data-ads-submit>إرسال للمراجعة</button>') +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function wizardBody() {
    if (ui.wizardStep === 0) return stepContent();
    if (ui.wizardStep === 1) return stepPlaces();
    if (ui.wizardStep === 2) return stepAudience();
    if (ui.wizardStep === 3) return stepSchedule();
    return stepReview();
  }

  function stepContent() {
    var types = [
      ['image', '🖼 صورة'],
      ['video', '🎬 فيديو'],
      ['file', '📄 ملف'],
      ['text', '✍ نص'],
      ['link', '🔗 رابط']
    ];
    return (
      '<h3 style="margin:0">ماذا تريد أن تعرض في الإعلان؟</h3>' +
      '<div class="ads-type-grid">' +
      types
        .map(function (t) {
          return (
            '<button type="button" class="ads-type-card' +
            (draft.contentType === t[0] ? ' is-on' : '') +
            '" data-ads-type-pick="' +
            t[0] +
            '">' +
            t[1] +
            '</button>'
          );
        })
        .join('') +
      '</div>' +
      field('title', 'اسم الإعلان *', draft.title) +
      field('headline', 'عنوان الإعلان *', draft.headline) +
      (draft.contentType === 'text'
        ? fieldArea('bodyText', 'النص *', draft.bodyText)
        : fieldArea('desc', 'النص المختصر / الوصف', draft.desc)) +
      (draft.contentType === 'image' || draft.contentType === 'video' || draft.contentType === 'file'
        ? '<div class="ads-drop" data-ads-drop><strong>اسحب الملف هنا أو اضغط للاختيار</strong><div>' +
          (draft.contentType === 'image' ? 'PNG / JPG' : draft.contentType === 'video' ? 'MP4 / WebM' : 'PDF / DOC') +
          '</div><input type="file" hidden data-ads-file></div>' +
          (ui.errors.media ? '<p class="ads-field-error">' + esc(ui.errors.media) + '</p>' : '') +
          (draft.mediaDataUrl
            ? '<div class="ads-preview-box">' +
              (draft.contentType === 'video'
                ? '<video src="' + esc(draft.mediaDataUrl) + '" controls style="max-width:100%;max-height:220px"></video>'
                : draft.contentType === 'image'
                  ? '<img src="' + esc(draft.mediaDataUrl) + '" alt="" style="max-width:100%;max-height:220px;object-fit:contain">'
                  : '<strong>' + esc(draft.mediaName || 'ملف') + '</strong> · ' + ((draft.mediaSize / 1024 / 1024) || 0).toFixed(2) + ' MB') +
              '</div>'
            : '')
        : '') +
      (draft.contentType === 'file'
        ? '<label>الإجراء عند الضغط<select data-draft="fileAction">' +
          '<option value="open"' + (draft.fileAction === 'open' ? ' selected' : '') + '>فتح الملف</option>' +
          '<option value="download"' + (draft.fileAction === 'download' ? ' selected' : '') + '>تنزيل الملف</option>' +
          '<option value="link"' + (draft.fileAction === 'link' ? ' selected' : '') + '>الانتقال إلى رابط</option>' +
          '</select></label>'
        : '') +
      '<label>الرابط عند الضغط على الإعلان<input data-draft="destinationUrl" value="' +
      esc(draft.destinationUrl) +
      '" placeholder="https://..."></label>' +
      (ui.errors.destinationUrl ? '<p class="ads-field-error">' + esc(ui.errors.destinationUrl) + '</p>' : '') +
      '<label>CTA<select data-draft="ctaLabel">' +
      CTA_OPTIONS.map(function (o) {
        return '<option value="' + esc(o.value) + '"' + (draft.ctaLabel === o.value ? ' selected' : '') + '>' + esc(o.label) + '</option>';
      }).join('') +
      '</select></label>' +
      '<p style="margin:0;color:#667085;font-size:13px;font-weight:700">«تسوق الآن» زر داخل الإعلان فقط ويحتاج Destination URL.</p>'
    );
  }

  function stepPlaces() {
    return (
      '<h3 style="margin:0">أين تريد أن يظهر إعلانك؟</h3>' +
      '<div class="ads-place-grid">' +
      PLACES.map(function (p) {
        var on = draft.placements.indexOf(p.id) !== -1;
        return (
          '<button type="button" class="ads-place-card' +
          (on ? ' is-on' : '') +
          '" data-ads-place="' +
          p.id +
          '">' +
          esc(p.label) +
          '<small>' +
          esc(p.hint) +
          '</small></button>'
        );
      }).join('') +
      '</div>' +
      (ui.errors.placements ? '<p class="ads-field-error">' + esc(ui.errors.placements) + '</p>' : '') +
      (draft.placements.indexOf('custom') !== -1
        ? '<label>اختر الصفحة<input data-draft="customPage" value="' + esc(draft.customPage) + '" placeholder="مثال: packages.html"></label>'
        : '') +
      '<label>موضع الإعلان<select data-draft="position">' +
        '<option value="top"' + (draft.position === 'top' ? ' selected' : '') + '>أعلى الصفحة</option>' +
        '<option value="middle"' + (draft.position === 'middle' ? ' selected' : '') + '>وسط الصفحة</option>' +
        '<option value="bottom"' + (draft.position === 'bottom' ? ' selected' : '') + '>أسفل الصفحة</option>' +
        '<option value="sidebar"' + (draft.position === 'sidebar' ? ' selected' : '') + '>الشريط الجانبي</option>' +
      '</select></label>' +
      '<div><strong>معاينة مكان ظهور الإعلان</strong>' +
      '<div class="ads-mock-page" style="margin-top:8px">' +
        '<div class="slot' + (draft.position === 'top' ? ' is-hot' : '') + '">أعلى الصفحة</div>' +
        '<div class="slot' + (draft.position === 'middle' ? ' is-hot' : '') + '">وسط المحتوى</div>' +
        '<div class="slot' + (draft.position === 'sidebar' ? ' is-hot' : '') + '">الشريط الجانبي</div>' +
        '<div class="slot' + (draft.position === 'bottom' ? ' is-hot' : '') + '">أسفل الصفحة</div>' +
      '</div></div>'
    );
  }

  function stepAudience() {
    return (
      '<h3 style="margin:0">من تريد أن يرى الإعلان؟</h3>' +
      '<label><input type="radio" name="aud" data-draft-radio="audience" value="all"' +
      (draft.audience === 'all' ? ' checked' : '') +
      '> جميع الزوار</label>' +
      '<button type="button" class="ads-ws-btn ghost" data-ads-advanced-aud>استهداف متقدم</button>' +
      (ui.showAdvancedAudience
        ? '<div class="ads-place-grid">' +
          [
            ['registered', 'عملاء مسجلون'],
            ['guests', 'زوار'],
            ['platform', 'منصة معينة'],
            ['branch', 'فرع معين'],
            ['incubator', 'حاضنة معينة'],
            ['region', 'دولة/منطقة']
          ]
            .map(function (x) {
              return (
                '<button type="button" class="ads-place-card' +
                (draft.audience === x[0] ? ' is-on' : '') +
                '" data-draft-set-audience="' +
                x[0] +
                '">' +
                x[1] +
                '</button>'
              );
            })
            .join('') +
          '</div>' +
          '<label>تفاصيل الاستهداف<input data-draft="audienceDetail" value="' +
          esc(draft.audienceDetail) +
          '" placeholder="مثال: السعودية · منصة التعليم"></label>'
        : '')
    );
  }

  function stepSchedule() {
    return (
      '<h3 style="margin:0">متى تريد تشغيل الإعلان؟</h3>' +
      '<label><input type="radio" name="sch" data-draft-radio="scheduleMode" value="immediate"' +
      (draft.scheduleMode === 'immediate' ? ' checked' : '') +
      '> ابدأ فور الموافقة</label>' +
      '<label><input type="radio" name="sch" data-draft-radio="scheduleMode" value="scheduled"' +
      (draft.scheduleMode === 'scheduled' ? ' checked' : '') +
      '> جدولة الإعلان</label>' +
      (draft.scheduleMode === 'scheduled'
        ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
          field('adStartDate', 'تاريخ البداية *', draft.adStartDate, 'date') +
          field('adStartTime', 'وقت البداية', draft.adStartTime, 'time') +
          field('adEndDate', 'تاريخ النهاية *', draft.adEndDate, 'date') +
          field('adEndTime', 'وقت النهاية', draft.adEndTime, 'time') +
          '</div>' +
          '<p style="margin:0;color:#667085;font-weight:700">سيبدأ الإعلان تلقائياً في الموعد المحدد ويتوقف عند تاريخ النهاية.</p>'
        : '')
    );
  }

  function stepReview() {
    return (
      '<h3 style="margin:0">مراجعة قبل الإرسال</h3>' +
      '<div class="ads-preview-box">' +
        '<strong>' + esc(draft.title || '—') + '</strong><br>' +
        'النوع: ' + esc(contentTypeLabel(draft.contentType)) + '<br>' +
        'العنوان: ' + esc(draft.headline || '—') + '<br>' +
        'CTA: ' + esc(draft.ctaLabel || 'بدون') + '<br>' +
        'الرابط: ' + esc(draft.destinationUrl || '—') + '<br>' +
        'أماكن الظهور: ' + esc(draft.placements.map(function (id) {
          var p = PLACES.find(function (x) { return x.id === id; });
          return p ? p.label : id;
        }).join(' + ') || '—') + '<br>' +
        'الجمهور: ' + esc(draft.audience === 'all' ? 'جميع الزوار' : draft.audience) + '<br>' +
        'الجدول: ' + esc(draft.scheduleMode === 'immediate' ? 'فور الموافقة' : (draft.adStartDate + ' → ' + draft.adEndDate)) +
      '</div>'
    );
  }

  function field(key, label, value, type) {
    return (
      '<label>' +
      esc(label) +
      '<input type="' +
      (type || 'text') +
      '" data-draft="' +
      key +
      '" value="' +
      esc(value) +
      '">' +
      (ui.errors[key] ? '<p class="ads-field-error">' + esc(ui.errors[key]) + '</p>' : '') +
      '</label>'
    );
  }

  function fieldArea(key, label, value) {
    return (
      '<label>' +
      esc(label) +
      '<textarea data-draft="' +
      key +
      '">' +
      esc(value) +
      '</textarea>' +
      (ui.errors[key] ? '<p class="ads-field-error">' + esc(ui.errors[key]) + '</p>' : '') +
      '</label>'
    );
  }

  function drawerHtml() {
    var ad = listings().find(function (x) { return x.id === ui.drawerId; });
    if (!ad) return '';
    var acts = (ad.activity || [])
      .map(function (e) {
        return (
          '<article><time>' +
          esc(String(e.at || '').replace('T', ' ').slice(0, 16)) +
          '</time>' +
          esc(e.message) +
          '</article>'
        );
      })
      .join('') || '<div class="ads-empty">لا يوجد سجل</div>';
    return (
      '<div class="ads-drawer-overlay" data-ads-drawer-overlay>' +
        '<aside class="ads-drawer">' +
          '<button type="button" class="ads-ws-btn ghost" data-ads-close-drawer>إغلاق</button>' +
          '<h2 style="margin:12px 0">' +
          esc(ad.title) +
          '</h2>' +
          '<p><strong>' +
          esc(ad.adCode || ad.id) +
          '</strong> · ' +
          esc(statusMeta(workflowOf(ad)).label) +
          '</p>' +
          '<p>مكان الظهور: ' +
          esc(placeLabels(ad)) +
          '</p>' +
          '<p>الجمهور: ' +
          esc(ad.audience || 'all') +
          '</p>' +
          '<p>الجدول: ' +
          esc((ad.adStartDate || '—') + ' → ' + (ad.adEndDate || '—')) +
          '</p>' +
          '<h3>سجل النشاط</h3>' +
          '<div class="ads-activity">' +
          acts +
          '</div>' +
        '</aside></div>'
    );
  }

  function syncDraftFields(scope) {
    (scope || root).querySelectorAll('[data-draft]').forEach(function (el) {
      draft[el.getAttribute('data-draft')] = el.value;
    });
  }

  function readFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      draft.mediaDataUrl = reader.result;
      draft.mediaName = file.name;
      draft.mediaSize = file.size || 0;
      autosave();
      render();
    };
    reader.readAsDataURL(file);
  }

  function bind() {
    root.querySelectorAll('[data-ads-section]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.section = btn.getAttribute('data-ads-section');
        ui.successCode = '';
        render();
      });
    });
    root.querySelectorAll('[data-ads-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.filter = btn.getAttribute('data-ads-filter');
        ui.section = 'mine';
        render();
      });
    });
    var q = root.querySelector('[data-ads-q]');
    if (q) {
      q.addEventListener('input', function () {
        ui.q = q.value;
        render();
        var nq = root.querySelector('[data-ads-q]');
        if (nq) {
          nq.focus();
          nq.setSelectionRange(nq.value.length, nq.value.length);
        }
      });
    }
    var tf = root.querySelector('[data-ads-type]');
    if (tf) {
      tf.addEventListener('change', function () {
        ui.typeFilter = tf.value;
        render();
      });
    }
    var create = root.querySelector('[data-ads-create]');
    if (create) create.addEventListener('click', function () { openWizard(null); });
    var help = root.querySelector('[data-ads-help]');
    if (help) {
      help.addEventListener('click', function () {
        alert(
          '1) اضغط إضافة إعلان.\n2) أضف المحتوى.\n3) اختر مكان الظهور.\n4) حدد الجمهور والمدة.\n5) راجع الإعلان.\n6) أرسله للموافقة.\n7) بعد الموافقة يبدأ النشر.'
        );
      });
    }
    root.querySelectorAll('[data-ads-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ad = listings().find(function (x) { return x.id === btn.getAttribute('data-ads-edit'); });
        if (ad) openWizard(ad);
      });
    });
    root.querySelectorAll('[data-ads-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-ads-toggle');
        var ad = listings().find(function (x) { return x.id === id; });
        if (!ad) return;
        if (workflowOf(ad) === 'active') {
          if (!confirm('إيقاف الإعلان؟\nلن يظهر للمستخدمين حتى تقوم بتشغيله مرة أخرى.')) return;
          HubStore.setAdWorkflowStatus(id, 'paused');
        } else {
          HubStore.toggleAd(id);
        }
        render();
      });
    });
    root.querySelectorAll('[data-ads-preview-one]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.drawerId = btn.getAttribute('data-ads-preview-one');
        render();
      });
    });
    root.querySelectorAll('[data-ads-more]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-ads-more');
        var ad = listings().find(function (x) { return x.id === id; });
        if (!ad) return;
        var choice = prompt('اكتب رقم الإجراء:\n1 نسخ الإعلان\n2 إعادة جدولة\n3 عرض التفاصيل\n4 حذف', '3');
        if (choice === '1') {
          var copy = HubStore.addAdListing(
            Object.assign({}, ad, {
              id: undefined,
              adCode: undefined,
              title: (ad.title || '') + ' (نسخة)',
              publishStatus: 'draft',
              workflowStatus: 'draft',
              status: 'paused',
              requestId: '',
              activity: []
            })
          );
          toast(copy ? 'تم نسخ الإعلان' : 'تعذر النسخ', copy ? 'success' : 'error');
          render();
        } else if (choice === '2') {
          openWizard(ad);
          ui.wizardStep = 3;
          draft.scheduleMode = 'scheduled';
          render();
        } else if (choice === '3') {
          ui.drawerId = id;
          render();
        } else if (choice === '4') {
          if (!confirm('هل تريد حذف هذا الإعلان؟\n' + (ad.title || '') + '\nلا يمكن التراجع عن الحذف.')) return;
          HubStore.setAdWorkflowStatus(id, 'deleted');
          toast('تم حذف الإعلان', 'success');
          render();
        }
      });
    });
    root.querySelectorAll('[data-ads-approve-req]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-ads-approve-req');
        HubStore.setAdWorkflowStatus(id, 'active');
        var ad = listings().find(function (x) { return x.id === id; });
        if (ad && HubCustomerRequests && HubCustomerRequests.ensureForAd) HubCustomerRequests.ensureForAd(ad, 'Admin');
        toast('تمت الموافقة على الإعلان', 'success');
        render();
      });
    });
    root.querySelectorAll('[data-ads-reject-req]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-ads-reject-req');
        var reason = prompt('سبب الرفض:');
        if (reason == null) return;
        HubStore.setAdWorkflowStatus(id, 'rejected', { rejectionReason: reason || 'مرفوض' });
        var ad = listings().find(function (x) { return x.id === id; });
        if (ad && HubCustomerRequests && HubCustomerRequests.ensureForAd) HubCustomerRequests.ensureForAd(ad, 'Admin');
        render();
      });
    });
    var clearSuccess = root.querySelector('[data-ads-clear-success]');
    if (clearSuccess) {
      clearSuccess.addEventListener('click', function () {
        ui.successCode = '';
        ui.section = 'mine';
        render();
      });
    }
    var overlay = root.querySelector('[data-ads-wizard-overlay]');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeWizard();
      });
      syncDraftFields(overlay);
      overlay.querySelectorAll('[data-draft], [data-draft-radio]').forEach(function (el) {
        el.addEventListener('change', function () {
          if (el.hasAttribute('data-draft-radio')) draft[el.getAttribute('data-draft-radio')] = el.value;
          else draft[el.getAttribute('data-draft')] = el.value;
          autosave();
        });
        el.addEventListener('input', function () {
          if (el.hasAttribute('data-draft')) {
            draft[el.getAttribute('data-draft')] = el.value;
            autosave();
          }
        });
      });
      overlay.querySelectorAll('[data-ads-type-pick]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          draft.contentType = btn.getAttribute('data-ads-type-pick');
          autosave();
          render();
        });
      });
      overlay.querySelectorAll('[data-ads-place]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-ads-place');
          var i = draft.placements.indexOf(id);
          if (i === -1) draft.placements.push(id);
          else draft.placements.splice(i, 1);
          autosave();
          render();
        });
      });
      var drop = overlay.querySelector('[data-ads-drop]');
      var fileInput = overlay.querySelector('[data-ads-file]');
      if (drop && fileInput) {
        drop.addEventListener('click', function () { fileInput.click(); });
        drop.addEventListener('dragover', function (e) { e.preventDefault(); });
        drop.addEventListener('drop', function (e) {
          e.preventDefault();
          if (e.dataTransfer.files && e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', function () {
          if (fileInput.files && fileInput.files[0]) readFile(fileInput.files[0]);
        });
      }
      var adv = overlay.querySelector('[data-ads-advanced-aud]');
      if (adv) {
        adv.addEventListener('click', function () {
          ui.showAdvancedAudience = !ui.showAdvancedAudience;
          render();
        });
      }
      overlay.querySelectorAll('[data-draft-set-audience]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          draft.audience = btn.getAttribute('data-draft-set-audience');
          autosave();
          render();
        });
      });
      var next = overlay.querySelector('[data-ads-next]');
      if (next) {
        next.addEventListener('click', function () {
          syncDraftFields(overlay);
          if (!validateStep()) {
            render();
            return;
          }
          ui.wizardStep = Math.min(ui.wizardStep + 1, STEPS.length - 1);
          autosave();
          render();
        });
      }
      var back = overlay.querySelector('[data-ads-back]');
      if (back) {
        back.addEventListener('click', function () {
          syncDraftFields(overlay);
          ui.wizardStep = Math.max(0, ui.wizardStep - 1);
          render();
        });
      }
      var cancel = overlay.querySelector('[data-ads-cancel]');
      if (cancel) cancel.addEventListener('click', closeWizard);
      var saveDraft = overlay.querySelector('[data-ads-save-draft]');
      if (saveDraft) {
        saveDraft.addEventListener('click', function () {
          syncDraftFields(overlay);
          submitDraft(true);
        });
      }
      var submit = overlay.querySelector('[data-ads-submit]');
      if (submit) {
        submit.addEventListener('click', function () {
          syncDraftFields(overlay);
          submitDraft(false);
        });
      }
    }
    var drawerOverlay = root.querySelector('[data-ads-drawer-overlay]');
    if (drawerOverlay) {
      drawerOverlay.addEventListener('click', function (e) {
        if (e.target === drawerOverlay || e.target.closest('[data-ads-close-drawer]')) {
          ui.drawerId = '';
          render();
        }
      });
    }
  }

  // hash deep-link
  if (location.hash === '#wizard' || location.hash === '#upload') {
    openWizard(null);
  } else {
    render();
  }

  window.HubAdsWorkspace = {
    refresh: render,
    openWizard: openWizard,
    getDraft: function () { return draft; }
  };
})();
