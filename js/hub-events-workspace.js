/**
 * Events Center — customer workspace (discover, register, create)
 */
(function () {
  'use strict';

  var root = document.getElementById('events-workspace');
  if (!root) return;

  var STEPS = ['التفاصيل', 'الموعد', 'المكان', 'التسعير', 'المراجعة'];
  var REG_KEY = 'naiosh_event_registrations_v1';
  var DRAFT_KEY = 'naiosh_event_wizard_draft_v1';

  var ATTENDANCE_LABELS = {
    online: 'أونلاين',
    in_person: 'حضوري',
    hybrid: 'مختلط'
  };

  var ui = {
    tab: 'explore',
    statFilter: '',
    q: '',
    categoryFilter: '',
    dateFilter: '',
    attendanceFilter: '',
    priceFilter: '',
    wizardOpen: false,
    wizardStep: 0,
    editingId: '',
    detailId: '',
    registerId: '',
    registerForm: { name: '', email: '', phone: '' },
    successNote: '',
    errors: {}
  };

  var draft = blankDraft();

  function blankDraft() {
    return {
      name: '',
      category: '',
      summary: '',
      description: '',
      coverImage: '',
      coverDataUrl: '',
      date: '',
      startTime: '18:00',
      endTime: '',
      duration: '',
      attendanceType: 'online',
      country: '',
      city: '',
      address: '',
      onlineUrl: '',
      mapsUrl: '',
      pricing: 'free',
      priceUsd: '',
      seats: '',
      registrationEnds: '',
      organizerName: '',
      organizerEmail: '',
      organizerPhone: '',
      cancellationPolicy: 'يمكن الإلغاء قبل 24 ساعة من موعد الفعالية.'
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

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function events() {
    return (window.HubStore && HubStore.get && HubStore.get().empire.eventsStudio.events) || [];
  }

  function workflowOf(ev) {
    if (ev.workflowStatus) return ev.workflowStatus;
    if (ev.status === 'قادمة') return 'published';
    if (ev.status === 'منتهية') return 'ended';
    if (ev.status === 'مسودة') return 'draft';
    return 'draft';
  }

  function statusMeta(wf) {
    var map = {
      published: { label: 'منشورة', cls: 'is-published' },
      approved: { label: 'منشورة', cls: 'is-published' },
      pending_review: { label: 'بانتظار المراجعة', cls: 'is-pending' },
      draft: { label: 'مسودة', cls: 'is-draft' },
      ended: { label: 'منتهية', cls: 'is-ended' },
      rejected: { label: 'مرفوضة', cls: 'is-rejected' },
      needs_changes: { label: 'تحتاج تعديل', cls: 'is-pending' },
      paused: { label: 'متوقفة', cls: 'is-draft' }
    };
    return map[wf] || { label: wf || '—', cls: 'is-draft' };
  }

  function normalizeLegacyEvents() {
    if (!window.HubStore || !HubStore.updateEvent) return;
    events().forEach(function (ev) {
      var patch = {};
      if (!ev.workflowStatus) {
        if (ev.status === 'قادمة') patch.workflowStatus = 'published';
        else if (ev.status === 'منتهية') patch.workflowStatus = 'ended';
        else if (ev.status === 'مسودة') patch.workflowStatus = 'draft';
        else patch.workflowStatus = 'draft';
      }
      if (!ev.pricing) patch.pricing = 'free';
      if (ev.pricing === 'free' && (ev.priceUsd == null || ev.priceUsd === '')) patch.priceUsd = 0;
      if (!ev.attendanceType) patch.attendanceType = 'online';
      if (ev.coverImage == null) patch.coverImage = '';
      if (Object.keys(patch).length) HubStore.updateEvent(ev.id, patch, 'system');
    });
  }

  function currentUser() {
    return window.HubAuth && HubAuth.getUser ? HubAuth.getUser() : null;
  }

  function isLoggedIn() {
    return window.HubAuth && HubAuth.isLoggedIn ? HubAuth.isLoggedIn() : false;
  }

  function actorName() {
    var u = currentUser();
    return u ? (u.name || u.email || 'عميل') : 'عميل';
  }

  function userKey(u) {
    if (!u) return '';
    return String(u.id || u.email || u.name || '');
  }

  function isOwner(ev) {
    var u = currentUser();
    if (!u) return false;
    var who = String(ev.createdBy || '').trim();
    if (!who) return false;
    return who === actorName() || who === String(u.email || '') || who === String(u.name || '');
  }

  function isPublished(ev) {
    var w = workflowOf(ev);
    return w === 'published' || w === 'approved';
  }

  function isEnded(ev) {
    if (workflowOf(ev) === 'ended') return true;
    if (ev.date && ev.date < todayStr()) return true;
    return false;
  }

  function isUpcoming(ev) {
    if (!isPublished(ev)) return false;
    if (isEnded(ev)) return false;
    return !ev.date || ev.date >= todayStr();
  }

  function placeLabel(ev) {
    if (ev.locationLabel) return ev.locationLabel;
    if (ev.attendanceType === 'online') return 'أونلاين';
    return [ev.city, ev.country].filter(Boolean).join('، ') || ev.platform || '—';
  }

  function priceLabel(ev) {
    if (ev.pricing === 'free' || !Number(ev.priceUsd)) return 'مجانية';
    return (window.HubCurrency && HubCurrency.format ? HubCurrency.format(ev.priceUsd) : '$' + ev.priceUsd);
  }

  function seatsLeft(ev) {
    if (ev.seats == null || ev.seats === '') return null;
    var taken = Number(ev.seatsTaken) || 0;
    return Math.max(0, Number(ev.seats) - taken);
  }

  function regBag() {
    try {
      var raw = localStorage.getItem(REG_KEY);
      if (!raw) return { items: [] };
      var bag = JSON.parse(raw);
      if (!bag.items) bag.items = [];
      return bag;
    } catch (e) {
      return { items: [] };
    }
  }

  function saveRegBag(bag) {
    try {
      localStorage.setItem(REG_KEY, JSON.stringify(bag));
    } catch (e) {}
  }

  function myRegistrations() {
    var u = currentUser();
    var bag = regBag().items || [];
    if (u) {
      var key = userKey(u);
      var email = String(u.email || '').toLowerCase();
      return bag.filter(function (r) {
        return r.userKey === key || String(r.email || '').toLowerCase() === email;
      });
    }
    // guest: show regs stored for this browser session emails in bag that match last form — fallback all recent local
    try {
      var last = sessionStorage.getItem('naiosh_evt_guest_email') || '';
      if (last) {
        return bag.filter(function (r) {
          return String(r.email || '').toLowerCase() === last.toLowerCase();
        });
      }
    } catch (e) {}
    return [];
  }

  function isRegistered(eventId) {
    return myRegistrations().some(function (r) {
      return r.eventId === eventId;
    });
  }

  function canRegister(ev) {
    if (!isPublished(ev)) return false;
    if (isEnded(ev)) return false;
    if (isRegistered(ev.id)) return false;
    var left = seatsLeft(ev);
    if (left != null && left <= 0) return false;
    if (ev.registrationEnds && ev.registrationEnds < todayStr()) return false;
    return ev.requiresRegistration !== false;
  }

  function registerCta(ev) {
    if (isEnded(ev)) return { label: 'انتهت الفعالية', disabled: true };
    if (!isPublished(ev)) return { label: 'التسجيل مغلق', disabled: true };
    if (isRegistered(ev.id)) return { label: 'أنت مسجّل', disabled: true };
    var left = seatsLeft(ev);
    if (left != null && left <= 0) return { label: 'اكتملت المقاعد', disabled: true };
    if (ev.registrationEnds && ev.registrationEnds < todayStr()) return { label: 'انتهى التسجيل', disabled: true };
    if (ev.pricing === 'paid' && Number(ev.priceUsd) > 0) {
      var p = window.HubCurrency && HubCurrency.format ? HubCurrency.format(ev.priceUsd) : '$' + ev.priceUsd;
      return { label: 'احجز الآن – ' + p, disabled: false, paid: true };
    }
    return { label: 'سجل مجانًا', disabled: false, paid: false };
  }

  function categoryOptions() {
    var set = {};
    events().forEach(function (ev) {
      var c = ev.category || ev.type;
      if (c) set[c] = true;
    });
    return Object.keys(set).sort();
  }

  function parseDateRange(filter) {
    var today = todayStr();
    if (!filter || filter === 'all') return null;
    if (filter === 'today') return { from: today, to: today };
    if (filter === 'upcoming') return { from: today, to: '' };
    var d = new Date();
    if (filter === 'week') {
      var end = new Date(d);
      end.setDate(end.getDate() + 7);
      return {
        from: today,
        to: end.getFullYear() + '-' + String(end.getMonth() + 1).padStart(2, '0') + '-' + String(end.getDate()).padStart(2, '0')
      };
    }
    if (filter === 'month') {
      var endM = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return {
        from: today,
        to: endM.getFullYear() + '-' + String(endM.getMonth() + 1).padStart(2, '0') + '-' + String(endM.getDate()).padStart(2, '0')
      };
    }
    return null;
  }

  function matchesDateFilter(ev, filter) {
    if (!filter || filter === 'all') return true;
    if (!ev.date) return filter === 'upcoming';
    var range = parseDateRange(filter);
    if (!range) return true;
    if (range.from && ev.date < range.from) return false;
    if (range.to && ev.date > range.to) return false;
    return true;
  }

  function matchesStatFilter(ev) {
    if (!ui.statFilter) return true;
    if (ui.statFilter === 'upcoming') return isUpcoming(ev);
    if (ui.statFilter === 'free') return ev.pricing === 'free' || !Number(ev.priceUsd);
    if (ui.statFilter === 'online') return ev.attendanceType === 'online';
    if (ui.statFilter === 'mine') {
      return myRegistrations().some(function (r) {
        return r.eventId === ev.id;
      });
    }
    return true;
  }

  function filteredEvents() {
    var q = String(ui.q || '').trim().toLowerCase();
    var list = events().slice();

    if (ui.tab === 'explore') {
      list = list.filter(function (ev) {
        return isPublished(ev) && !isEnded(ev);
      });
    } else if (ui.tab === 'upcoming') {
      list = list.filter(isUpcoming);
    } else if (ui.tab === 'mine') {
      var ids = {};
      myRegistrations().forEach(function (r) {
        ids[r.eventId] = true;
      });
      list = list.filter(function (ev) {
        return ids[ev.id];
      });
    } else if (ui.tab === 'created') {
      list = list.filter(isOwner);
    }

    return list.filter(function (ev) {
      if (ui.categoryFilter && (ev.category || ev.type) !== ui.categoryFilter) return false;
      if (ui.attendanceFilter && ev.attendanceType !== ui.attendanceFilter) return false;
      if (ui.priceFilter === 'free' && !(ev.pricing === 'free' || !Number(ev.priceUsd))) return false;
      if (ui.priceFilter === 'paid' && !(ev.pricing === 'paid' && Number(ev.priceUsd) > 0)) return false;
      if (!matchesDateFilter(ev, ui.dateFilter)) return false;
      if (!matchesStatFilter(ev)) return false;
      if (!q) return true;
      var hay = (
        (ev.name || '') +
        ' ' +
        (ev.description || '') +
        ' ' +
        (ev.category || '') +
        ' ' +
        (ev.type || '') +
        ' ' +
        (ev.eventCode || '')
      ).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function counts() {
    var all = events();
    var upcoming = all.filter(isUpcoming).length;
    var mine = myRegistrations().length;
    var free = all.filter(function (ev) {
      return isPublished(ev) && (ev.pricing === 'free' || !Number(ev.priceUsd));
    }).length;
    var online = all.filter(function (ev) {
      return isPublished(ev) && ev.attendanceType === 'online';
    }).length;
    return { upcoming: upcoming, mine: mine, free: free, online: online };
  }

  function autosave() {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ draft: draft, step: ui.wizardStep, editingId: ui.editingId })
      );
    } catch (e) {}
  }

  function loadAutosave() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
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
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
  }

  function openWizard(ev) {
    if (!isLoggedIn()) {
      if (window.HubAuth && HubAuth.requireLogin) {
        HubAuth.requireLogin({ next: location.pathname + location.search + '#mine-created' });
      } else {
        toast('سجّل الدخول لإنشاء فعالية', 'info');
      }
      return;
    }
    ui.wizardOpen = true;
    ui.wizardStep = 0;
    ui.errors = {};
    ui.successNote = '';
    if (ev) {
      ui.editingId = ev.id;
      draft = {
        name: ev.name || '',
        category: ev.category || ev.type || '',
        summary: ev.summary || '',
        description: ev.description || '',
        coverImage: ev.coverImage || '',
        coverDataUrl: ev.coverImage && String(ev.coverImage).indexOf('data:') === 0 ? ev.coverImage : '',
        date: ev.date || '',
        startTime: ev.startTime || ev.time || '18:00',
        endTime: ev.endTime || '',
        duration: ev.duration || '',
        attendanceType: ev.attendanceType || 'online',
        country: ev.country || '',
        city: ev.city || '',
        address: ev.address || '',
        onlineUrl: ev.onlineUrl || '',
        mapsUrl: ev.mapsUrl || '',
        pricing: ev.pricing || 'free',
        priceUsd: ev.priceUsd ? String(ev.priceUsd) : '',
        seats: ev.seats != null && ev.seats !== '' ? String(ev.seats) : '',
        registrationEnds: ev.registrationEnds || '',
        organizerName: ev.organizerName || ev.speaker || actorName(),
        organizerEmail: ev.organizerEmail || (currentUser() && currentUser().email) || '',
        organizerPhone: ev.organizerPhone || '',
        cancellationPolicy: ev.cancellationPolicy || blankDraft().cancellationPolicy
      };
    } else {
      ui.editingId = '';
      loadAutosave();
      if (!draft.name) {
        draft = blankDraft();
        draft.organizerName = actorName();
        draft.organizerEmail = (currentUser() && currentUser().email) || '';
      }
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
      if (!String(draft.name || '').trim()) ui.errors.name = 'اسم الفعالية مطلوب';
      if (!String(draft.category || '').trim()) ui.errors.category = 'التصنيف مطلوب';
      if (!String(draft.summary || draft.description || '').trim()) ui.errors.summary = 'وصف مختصر مطلوب';
    }
    if (ui.wizardStep === 1) {
      if (!draft.date) ui.errors.date = 'التاريخ مطلوب';
      if (!draft.startTime) ui.errors.startTime = 'وقت البداية مطلوب';
    }
    if (ui.wizardStep === 2) {
      if (draft.attendanceType === 'online' && !String(draft.onlineUrl || '').trim()) {
        ui.errors.onlineUrl = 'رابط البث أو الحضور مطلوب للفعاليات الأونلاين';
      }
      if (draft.attendanceType === 'in_person' && !String(draft.city || '').trim()) {
        ui.errors.city = 'المدينة مطلوبة للفعاليات الحضورية';
      }
    }
    if (ui.wizardStep === 3) {
      if (draft.pricing === 'paid' && !(Number(draft.priceUsd) > 0)) {
        ui.errors.priceUsd = 'أدخل سعراً أكبر من صفر';
      }
      if (draft.seats !== '' && !(Number(draft.seats) >= 0)) {
        ui.errors.seats = 'عدد المقاعد غير صالح';
      }
    }
    return Object.keys(ui.errors).length === 0;
  }

  function buildPayload(workflowStatus) {
    var pricing = draft.pricing === 'paid' && Number(draft.priceUsd) > 0 ? 'paid' : 'free';
    var cover = draft.coverDataUrl || draft.coverImage || '';
    return {
      name: String(draft.name || '').trim(),
      category: String(draft.category || '').trim(),
      type: String(draft.category || '').trim(),
      summary: String(draft.summary || '').trim(),
      description: String(draft.description || draft.summary || '').trim(),
      coverImage: cover,
      date: draft.date,
      startTime: draft.startTime,
      endTime: draft.endTime,
      time: draft.startTime,
      duration: draft.duration,
      attendanceType: draft.attendanceType,
      country: draft.country,
      city: draft.city,
      address: draft.address,
      onlineUrl: draft.onlineUrl,
      mapsUrl: draft.mapsUrl,
      pricing: pricing,
      priceUsd: pricing === 'paid' ? Number(draft.priceUsd) || 0 : 0,
      seats: draft.seats === '' ? null : Number(draft.seats),
      registrationEnds: draft.registrationEnds,
      organizerName: draft.organizerName || actorName(),
      organizerEmail: draft.organizerEmail,
      organizerPhone: draft.organizerPhone,
      speaker: draft.organizerName || actorName(),
      cancellationPolicy: draft.cancellationPolicy,
      workflowStatus: workflowStatus,
      createdBy: actorName()
    };
  }

  function submitDraft(asDraft) {
    if (!window.HubStore) {
      toast('تعذر الاتصال بالمخزن', 'error');
      return;
    }
    if (!asDraft) {
      ui.wizardStep = 4;
      for (var i = 0; i < STEPS.length; i++) {
        ui.wizardStep = i;
        if (!validateStep()) break;
      }
      ui.wizardStep = 4;
      if (!validateStep()) {
        render();
        return;
      }
    } else if (!validateStep() && ui.wizardStep === 0 && !String(draft.name || '').trim()) {
      ui.errors.name = 'اسم الفعالية مطلوب للمسودة';
      render();
      return;
    }

    var payload = buildPayload(asDraft ? 'draft' : 'pending_review');
    var ev;
    if (ui.editingId && HubStore.updateEvent) {
      ev = HubStore.updateEvent(ui.editingId, payload, actorName());
      if (!asDraft && HubStore.setEventWorkflowStatus) {
        ev = HubStore.setEventWorkflowStatus(ui.editingId, 'pending_review', {}, actorName());
      }
    } else if (HubStore.addEvent) {
      ev = HubStore.addEvent(payload);
    }

    if (!ev) {
      toast('تعذر حفظ الفعالية', 'error');
      return;
    }

    if (!asDraft) {
      if (HubStore.setEventWorkflowStatus) {
        ev = HubStore.setEventWorkflowStatus(ev.id, 'pending_review', {}, actorName());
      }
      if (window.HubCustomerRequests && HubCustomerRequests.ensureForEvent) {
        var req = HubCustomerRequests.ensureForEvent(ev, actorName());
        if (req && req.id && HubStore.updateEvent) {
          HubStore.updateEvent(ev.id, { requestId: req.id }, actorName());
        }
      }
      ui.successNote = 'تم إرسال الفعالية للمراجعة · ' + (ev.eventCode || ev.id);
      ui.tab = 'created';
    } else {
      toast('تم حفظ المسودة', 'success');
    }

    clearAutosave();
    ui.wizardOpen = false;
    ui.editingId = ev.id;
    render();
  }

  function openRegister(ev) {
    var cta = registerCta(ev);
    if (cta.disabled) return;
    var u = currentUser();
    ui.registerId = ev.id;
    ui.registerForm = {
      name: u ? u.name || '' : '',
      email: u ? u.email || '' : '',
      phone: '',
      tickets: '1'
    };
    render();
  }

  function nextRegId(bag) {
    var year = new Date().getFullYear();
    bag.seq = (bag.seq || 0) + 1;
    return 'REG-' + year + '-' + String(bag.seq).padStart(5, '0');
  }

  function submitRegistration() {
    var ev = events().find(function (x) {
      return x.id === ui.registerId;
    });
    if (!ev) return;
    ui.errors = {};
    if (!String(ui.registerForm.name || '').trim()) ui.errors.regName = 'الاسم مطلوب';
    if (!String(ui.registerForm.email || '').trim()) ui.errors.regEmail = 'البريد مطلوب';
    if (Object.keys(ui.errors).length) {
      render();
      return;
    }
    if (!canRegister(ev)) {
      toast('التسجيل غير متاح لهذه الفعالية', 'error');
      ui.registerId = '';
      render();
      return;
    }

    var bag = regBag();
    if (!Array.isArray(bag.items)) bag.items = [];
    var u = currentUser();
    var paid = ev.pricing === 'paid' && Number(ev.priceUsd) > 0;
    var reg = {
      id: nextRegId(bag),
      eventId: ev.id,
      eventCode: ev.eventCode,
      eventName: ev.name,
      userKey: userKey(u) || String(ui.registerForm.email).trim().toLowerCase(),
      name: String(ui.registerForm.name).trim(),
      email: String(ui.registerForm.email).trim(),
      phone: String(ui.registerForm.phone || '').trim(),
      tickets: Math.max(1, Number(ui.registerForm.tickets) || 1),
      paid: paid,
      amountUsd: Number(ev.priceUsd) || 0,
      status: paid ? 'pending_payment' : 'confirmed',
      registeredAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    if (paid) {
      // simulate successful payment confirmation for UX continuity
      reg.status = 'confirmed';
    }
    bag.items.unshift(reg);
    saveRegBag(bag);
    try {
      sessionStorage.setItem('naiosh_evt_guest_email', reg.email);
    } catch (e) {}

    if (HubStore.updateEvent) {
      HubStore.updateEvent(
        ev.id,
        { seatsTaken: (Number(ev.seatsTaken) || 0) + (reg.tickets || 1) },
        actorName()
      );
    }

    ui.registerId = '';
    ui.successReg = reg;
    ui.tab = 'mine';
    toast(paid ? 'تم تأكيد الحجز بنجاح' : 'تم تسجيلك في الفعالية بنجاح', 'success');
    render();
  }

  function applyHash() {
    var h = (location.hash || '').replace('#', '');
    if (h === 'mine') ui.tab = 'mine';
    else if (h === 'mine-created') ui.tab = 'created';
    else if (h === 'explore') ui.tab = 'explore';
  }

  function setTab(tab) {
    ui.tab = tab;
    var hash = '';
    if (tab === 'mine') hash = '#mine';
    else if (tab === 'created') hash = '#mine-created';
    else if (tab === 'explore') hash = '#explore';
    if (location.hash !== hash) {
      try {
        history.replaceState(null, '', location.pathname + location.search + hash);
      } catch (e) {
        location.hash = hash;
      }
    }
    render();
  }

  function scrollToSection() {
    var el = document.getElementById('evt-section');
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (_) {
      el.scrollIntoView(true);
    }
    try {
      el.classList.add('is-scroll-target');
      setTimeout(function () {
        el.classList.remove('is-scroll-target');
      }, 1200);
    } catch (_) {}
  }

  function render() {
    var c = counts();
    var list = filteredEvents();
    root.innerHTML =
      headHtml() +
      statsHtml(c) +
      navHtml() +
      sectionHtml(list) +
      (ui.successNote ? successHtml() : '') +
      (ui.detailId ? detailModalHtml() : '') +
      (ui.registerId ? registerModalHtml() : '') +
      (ui.wizardOpen ? wizardHtml() : '');
    bind();
  }

  function headHtml() {
    return (
      '<section class="evt-ws-head">' +
        '<div>' +
          '<h1>الفعاليات</h1>' +
          '<p>اكتشف الفعاليات القادمة وسجّل فيها، أو أنشئ فعاليتك الخاصة وتابعها بسهولة.</p>' +
        '</div>' +
        '<div class="evt-ws-head-actions">' +
          '<button type="button" class="evt-ws-btn ghost" data-evt-explore>استكشف الفعاليات</button>' +
          '<button type="button" class="evt-ws-btn primary" data-evt-create><i class="fas fa-plus"></i> أضف فعالية</button>' +
          '<button type="button" class="evt-ws-btn ghost" data-evt-tab="mine">فعالياتي</button>' +
        '</div>' +
      '</section>'
    );
  }

  function statsHtml(c) {
    var cards = [
      ['upcoming', 'القادمة', c.upcoming],
      ['mine', 'فعالياتي', c.mine],
      ['free', 'المجانية', c.free],
      ['online', 'Online', c.online]
    ];
    return (
      '<section class="evt-ws-section">' +
        '<div class="evt-summary-grid">' +
        cards
          .map(function (x) {
            return (
              '<button type="button" class="evt-summary-card' +
              (ui.statFilter === x[0] ? ' is-on' : '') +
              '" data-evt-stat="' +
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

  function navHtml() {
    var items = [
      ['explore', 'اكتشف'],
      ['upcoming', 'القادمة'],
      ['mine', 'فعالياتي'],
      ['created', 'التي أنشأتها']
    ];
    return (
      '<nav class="evt-ws-nav">' +
      items
        .map(function (it) {
          return (
            '<button type="button" class="' +
            (ui.tab === it[0] ? 'is-on' : '') +
            '" data-evt-tab="' +
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

  function emptyMessage() {
    if (ui.tab === 'mine') {
      return (
        '<div class="evt-empty"><i class="fas fa-ticket"></i>لم تسجّل في أي فعالية بعد.<br>استكشف الفعاليات القادمة وسجّل مجاناً أو احجز مقعدك.</div>'
      );
    }
    if (ui.tab === 'created') {
      return (
        '<div class="evt-empty"><i class="fas fa-calendar-plus"></i>لم تنشئ فعاليات بعد.<br>اضغط «أضف فعالية» لبدء مسودة وإرسالها للمراجعة.</div>'
      );
    }
    return (
      '<div class="evt-empty"><i class="fas fa-calendar-days"></i>لا توجد فعاليات مطابقة للبحث حالياً.<br>جرّب تغيير الفلاتر أو العودة لاحقاً.</div>'
    );
  }

  function sectionHtml(list) {
    var cats = categoryOptions();
    return (
      '<section class="evt-ws-section" id="evt-section">' +
        '<div class="evt-toolbar">' +
          '<input type="search" data-evt-q value="' +
          esc(ui.q) +
          '" placeholder="ابحث باسم الفعالية أو التصنيف...">' +
          '<select data-evt-category>' +
            '<option value="">كل التصنيفات</option>' +
            cats
              .map(function (c) {
                return (
                  '<option value="' +
                  esc(c) +
                  '"' +
                  (ui.categoryFilter === c ? ' selected' : '') +
                  '>' +
                  esc(c) +
                  '</option>'
                );
              })
              .join('') +
          '</select>' +
          '<select data-evt-date>' +
            '<option value="">كل المواعيد</option>' +
            '<option value="today"' + (ui.dateFilter === 'today' ? ' selected' : '') + '>اليوم</option>' +
            '<option value="week"' + (ui.dateFilter === 'week' ? ' selected' : '') + '>هذا الأسبوع</option>' +
            '<option value="month"' + (ui.dateFilter === 'month' ? ' selected' : '') + '>هذا الشهر</option>' +
            '<option value="upcoming"' + (ui.dateFilter === 'upcoming' ? ' selected' : '') + '>قادمة</option>' +
          '</select>' +
          '<select data-evt-attendance>' +
            '<option value="">نوع الحضور</option>' +
            '<option value="online"' + (ui.attendanceFilter === 'online' ? ' selected' : '') + '>أونلاين</option>' +
            '<option value="in_person"' + (ui.attendanceFilter === 'in_person' ? ' selected' : '') + '>حضوري</option>' +
            '<option value="hybrid"' + (ui.attendanceFilter === 'hybrid' ? ' selected' : '') + '>مختلط</option>' +
          '</select>' +
          '<select data-evt-price>' +
            '<option value="">السعر</option>' +
            '<option value="free"' + (ui.priceFilter === 'free' ? ' selected' : '') + '>مجانية</option>' +
            '<option value="paid"' + (ui.priceFilter === 'paid' ? ' selected' : '') + '>مدفوعة</option>' +
          '</select>' +
        '</div>' +
        '<div class="evt-cards">' +
        (list.length ? list.map(cardHtml).join('') : emptyMessage()) +
        '</div></section>'
    );
  }

  function cardHtml(ev) {
    var wf = workflowOf(ev);
    var meta = statusMeta(wf);
    var cta = registerCta(ev);
    var left = seatsLeft(ev);
    var media = ev.coverImage
      ? '<img src="' + esc(ev.coverImage) + '" alt="">'
      : '<i class="fas fa-calendar-days"></i>';
    var showOwnerBadge = ui.tab === 'created';
    var myReg =
      ui.tab === 'mine'
        ? myRegistrations().find(function (r) {
            return r.eventId === ev.id;
          })
        : null;
    var regStatusLabel =
      myReg && myReg.status === 'confirmed'
        ? 'مؤكد'
        : myReg && myReg.status === 'pending_payment'
          ? 'بانتظار الدفع'
          : myReg && myReg.status === 'cancelled'
            ? 'ملغي'
            : myReg && myReg.status === 'ended'
              ? 'انتهت'
              : '';
    return (
      '<article class="evt-card" data-evt-id="' +
      esc(ev.id) +
      '">' +
      '<div class="evt-card-media">' +
      media +
      '</div>' +
      '<div class="evt-card-body">' +
      '<h3>' +
      esc(ev.name) +
      '</h3>' +
      '<div class="evt-meta-row">' +
      '<span class="evt-chip">' +
      esc(ev.category || ev.type || 'فعالية') +
      '</span>' +
      '<span class="evt-chip">' +
      esc(ev.date || '—') +
      ' · ' +
      esc(ev.startTime || ev.time || '—') +
      '</span>' +
      '<span class="evt-chip' +
      (ev.attendanceType === 'online' ? ' is-online' : '') +
      '">' +
      esc(placeLabel(ev)) +
      '</span>' +
      '<span class="evt-chip ' +
      (ev.pricing === 'paid' && Number(ev.priceUsd) > 0 ? 'is-paid' : 'is-free') +
      '">' +
      esc(priceLabel(ev)) +
      '</span>' +
      (showOwnerBadge
        ? '<span class="evt-badge ' + meta.cls + '">' + esc(meta.label) + '</span>'
        : '') +
      (myReg
        ? '<span class="evt-badge is-published">' +
          esc(regStatusLabel || 'مؤكد') +
          '</span><span class="evt-chip">رقم التسجيل: ' +
          esc(myReg.id) +
          '</span>'
        : '') +
      (left != null ? '<span class="evt-chip">متبقّي ' + left + ' مقعد</span>' : '') +
      '</div>' +
      (ui.tab === 'created' && (wf === 'needs_changes' || wf === 'rejected') && (ev.changeRequestNote || ev.rejectionReason)
        ? '<p class="evt-field-error">السبب: ' + esc(ev.changeRequestNote || ev.rejectionReason) + '</p>'
        : '') +
      '<div class="evt-card-actions">' +
      '<button type="button" class="evt-ws-btn ghost sm" data-evt-detail="' +
      esc(ev.id) +
      '">عرض التفاصيل</button>' +
      (ui.tab === 'created' && (wf === 'draft' || wf === 'needs_changes' || wf === 'rejected')
        ? '<button type="button" class="evt-ws-btn ghost sm" data-evt-edit="' +
          esc(ev.id) +
          '">' +
          (wf === 'needs_changes' || wf === 'rejected' ? 'تعديل وإعادة الإرسال' : 'تعديل') +
          '</button>'
        : '') +
      (ui.tab === 'mine' && ev.onlineUrl
        ? '<a class="evt-ws-btn ghost sm" href="' +
          esc(ev.onlineUrl) +
          '" target="_blank" rel="noopener noreferrer">رابط الحضور</a>'
        : '') +
      (ui.tab !== 'mine' && ui.tab !== 'created'
        ? '<button type="button" class="evt-ws-btn primary sm"' +
          (cta.disabled ? ' disabled' : '') +
          ' data-evt-register="' +
          esc(ev.id) +
          '">' +
          esc(cta.label) +
          '</button>'
        : '') +
      '</div></div></article>'
    );
  }

  function detailModalHtml() {
    var ev = events().find(function (x) {
      return x.id === ui.detailId;
    });
    if (!ev) return '';
    var cta = registerCta(ev);
    var left = seatsLeft(ev);
    return (
      '<div class="evt-modal-overlay" data-evt-detail-overlay>' +
        '<div class="evt-modal" role="dialog" aria-modal="true">' +
          '<button type="button" class="evt-ws-btn ghost sm evt-modal-close" data-evt-close-detail>إغلاق</button>' +
          '<h2>' +
          esc(ev.name) +
          '</h2>' +
          '<p style="margin:0;color:#667085;font-weight:700">' +
          esc(ev.eventCode || ev.id) +
          ' · ' +
          esc(statusMeta(workflowOf(ev)).label) +
          '</p>' +
          (ev.coverImage
            ? '<p style="margin:12px 0"><img src="' +
              esc(ev.coverImage) +
              '" alt="" style="max-width:100%;border-radius:12px"></p>'
            : '') +
          '<div class="evt-detail-grid">' +
            detailRow('التصنيف', ev.category || ev.type) +
            detailRow('التاريخ', (ev.date || '—') + ' · ' + (ev.startTime || ev.time || '—')) +
            detailRow('المكان', placeLabel(ev)) +
            detailRow('الحضور', ATTENDANCE_LABELS[ev.attendanceType] || ev.attendanceType) +
            detailRow('السعر', priceLabel(ev)) +
            (left != null ? detailRow('المقاعد', 'متبقّي ' + left) : '') +
            detailRow('المنظم', ev.organizerName || ev.speaker) +
          '</div>' +
          '<p style="line-height:1.7;font-weight:650;color:#344054">' +
          esc(ev.description || ev.summary || '') +
          '</p>' +
          '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px">' +
            '<button type="button" class="evt-ws-btn primary"' +
            (cta.disabled ? ' disabled' : '') +
            ' data-evt-register="' +
            esc(ev.id) +
            '">' +
            esc(cta.label) +
            '</button>' +
            (isOwner(ev)
              ? '<button type="button" class="evt-ws-btn ghost" data-evt-edit="' +
                esc(ev.id) +
                '">تعديل الفعالية</button>'
              : '') +
          '</div>' +
        '</div></div>'
    );
  }

  function detailRow(label, value) {
    return '<div><strong>' + esc(label) + '</strong><span>' + esc(value == null ? '—' : value) + '</span></div>';
  }

  function registerModalHtml() {
    var ev = events().find(function (x) {
      return x.id === ui.registerId;
    });
    if (!ev) return '';
    var paid = ev.pricing === 'paid' && Number(ev.priceUsd) > 0;
    return (
      '<div class="evt-modal-overlay" data-evt-register-overlay>' +
        '<div class="evt-modal" role="dialog" aria-modal="true">' +
          '<button type="button" class="evt-ws-btn ghost sm evt-modal-close" data-evt-close-register>إغلاق</button>' +
          '<h2>' +
          (paid ? 'تأكيد الحجز' : 'التسجيل في الفعالية') +
          '</h2>' +
          '<p style="margin:0 0 12px;color:#667085;font-weight:700">' +
          esc(ev.name) +
          ' · ' +
          esc(priceLabel(ev)) +
          '</p>' +
          '<div class="evt-form-grid">' +
            fieldReg('regName', 'الاسم الكامل *', ui.registerForm.name) +
            fieldReg('regEmail', 'البريد الإلكتروني *', ui.registerForm.email, 'email') +
            fieldReg('regPhone', 'رقم الجوال', ui.registerForm.phone, 'tel') +
          '</div>' +
          (paid
            ? '<p style="font-size:13px;color:#667085;font-weight:700;margin:12px 0 0">سيتم محاكاة الدفع محلياً — لن يُخصم مبلغ حقيقي.</p>'
            : '') +
          '<div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">' +
            '<button type="button" class="evt-ws-btn primary" data-evt-register-submit>' +
            (paid ? 'تأكيد الحجز والدفع' : 'إتمام التسجيل') +
            '</button>' +
            '<button type="button" class="evt-ws-btn ghost" data-evt-close-register>إلغاء</button>' +
          '</div>' +
        '</div></div>'
    );
  }

  function fieldReg(key, label, value, type) {
    var errKey = key === 'regName' ? 'regName' : key === 'regEmail' ? 'regEmail' : '';
    return (
      '<label>' +
      esc(label) +
      '<input type="' +
      (type || 'text') +
      '" data-reg="' +
      key +
      '" value="' +
      esc(value) +
      '">' +
      (ui.errors[errKey] ? '<p class="evt-field-error">' + esc(ui.errors[errKey]) + '</p>' : '') +
      '</label>'
    );
  }

  function successHtml() {
    return (
      '<section class="evt-success-banner">' +
        '<span>' +
        esc(ui.successNote) +
        '</span>' +
        '<button type="button" class="evt-ws-btn ghost sm" data-evt-clear-success>حسناً</button>' +
      '</section>'
    );
  }

  function wizardHtml() {
    return (
      '<div class="evt-wizard-overlay" data-evt-wizard-overlay>' +
        '<div class="evt-wizard" role="dialog" aria-modal="true">' +
          '<h2>' +
          (ui.editingId ? 'تعديل الفعالية' : 'إنشاء فعالية جديدة') +
          '</h2>' +
          '<div class="evt-wizard-steps">' +
          STEPS.map(function (label, i) {
            var cls = i === ui.wizardStep ? 'is-on' : i < ui.wizardStep ? 'is-done' : '';
            return '<span class="' + cls + '">' + esc(label) + '</span>';
          }).join('') +
          '</div>' +
          '<div class="evt-form-grid">' +
          wizardStepBody() +
          '</div>' +
          '<div class="evt-wizard-foot">' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
              (ui.wizardStep > 0
                ? '<button type="button" class="evt-ws-btn ghost" data-evt-back>السابق</button>'
                : '') +
              '<button type="button" class="evt-ws-btn ghost" data-evt-cancel>إلغاء</button>' +
            '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
              '<button type="button" class="evt-ws-btn ghost" data-evt-save-draft>حفظ مسودة</button>' +
              (ui.wizardStep < STEPS.length - 1
                ? '<button type="button" class="evt-ws-btn primary" data-evt-next">التالي</button>'
                : '<button type="button" class="evt-ws-btn primary" data-evt-submit>إرسال للمراجعة</button>') +
            '</div>' +
          '</div>' +
        '</div></div>'
    );
  }

  function wizardStepBody() {
    if (ui.wizardStep === 0) return stepDetails();
    if (ui.wizardStep === 1) return stepSchedule();
    if (ui.wizardStep === 2) return stepLocation();
    if (ui.wizardStep === 3) return stepPricing();
    return stepReview();
  }

  function stepDetails() {
    var preview = draft.coverDataUrl || draft.coverImage;
    return (
      field('name', 'اسم الفعالية *', draft.name) +
      field('category', 'التصنيف *', draft.category) +
      fieldArea('summary', 'وصف مختصر *', draft.summary || draft.description) +
      fieldArea('description', 'تفاصيل إضافية', draft.description) +
      '<div class="evt-cover-drop" data-evt-cover-drop>' +
      (preview
        ? '<img src="' + esc(preview) + '" alt="">'
        : '<i class="fas fa-image"></i> اضغط لرفع صورة الغلاف (اختياري)') +
      '<input type="file" accept="image/*" hidden data-evt-cover-file></div>'
    );
  }

  function stepSchedule() {
    return (
      '<div class="evt-form-grid two">' +
      field('date', 'تاريخ الفعالية *', draft.date, 'date') +
      field('startTime', 'وقت البداية *', draft.startTime, 'time') +
      field('endTime', 'وقت النهاية', draft.endTime, 'time') +
      field('duration', 'المدة (مثال: 90 دقيقة)', draft.duration) +
      field('registrationEnds', 'آخر موعد للتسجيل', draft.registrationEnds, 'date') +
      '</div>'
    );
  }

  function stepLocation() {
    return (
      '<label>نوع الحضور<select data-draft="attendanceType">' +
        '<option value="online"' +
        (draft.attendanceType === 'online' ? ' selected' : '') +
        '>أونلاين</option>' +
        '<option value="in_person"' +
        (draft.attendanceType === 'in_person' ? ' selected' : '') +
        '>حضوري</option>' +
        '<option value="hybrid"' +
        (draft.attendanceType === 'hybrid' ? ' selected' : '') +
        '>مختلط</option>' +
      '</select></label>' +
      (draft.attendanceType !== 'in_person'
        ? field('onlineUrl', 'رابط البث / Zoom *', draft.onlineUrl, 'url')
        : '') +
      (draft.attendanceType !== 'online'
        ? '<div class="evt-form-grid two">' +
          field('country', 'الدولة', draft.country) +
          field('city', 'المدينة *', draft.city) +
          field('address', 'العنوان', draft.address) +
          field('mapsUrl', 'رابط الخريطة', draft.mapsUrl, 'url') +
          '</div>'
        : '')
    );
  }

  function stepPricing() {
    return (
      '<label>التسعير<select data-draft="pricing">' +
        '<option value="free"' +
        (draft.pricing === 'free' ? ' selected' : '') +
        '>مجانية</option>' +
        '<option value="paid"' +
        (draft.pricing === 'paid' ? ' selected' : '') +
        '>مدفوعة</option>' +
      '</select></label>' +
      (draft.pricing === 'paid' ? field('priceUsd', 'السعر بالدولار *', draft.priceUsd, 'number') : '') +
      field('seats', 'عدد المقاعد (اتركه فارغاً = غير محدود)', draft.seats, 'number') +
      '<div class="evt-form-grid two">' +
      field('organizerName', 'اسم المنظم', draft.organizerName) +
      field('organizerEmail', 'بريد المنظم', draft.organizerEmail, 'email') +
      field('organizerPhone', 'جوال المنظم', draft.organizerPhone, 'tel') +
      '</div>' +
      fieldArea('cancellationPolicy', 'سياسة الإلغاء', draft.cancellationPolicy)
    );
  }

  function stepReview() {
    var payload = buildPayload('pending_review');
    return (
      '<h3 style="margin:0">مراجعة قبل الإرسال</h3>' +
      '<div class="evt-preview-box">' +
        '<strong>' +
        esc(payload.name) +
        '</strong><br>' +
        'التصنيف: ' +
        esc(payload.category) +
        '<br>الموعد: ' +
        esc(payload.date) +
        ' · ' +
        esc(payload.startTime) +
        '<br>الحضور: ' +
        esc(ATTENDANCE_LABELS[payload.attendanceType] || payload.attendanceType) +
        '<br>السعر: ' +
        esc(payload.pricing === 'paid' ? priceLabel(payload) : 'مجانية') +
        '<br>المقاعد: ' +
        esc(payload.seats == null ? 'غير محدود' : String(payload.seats)) +
        '<br>الوصف: ' +
        esc(payload.summary) +
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
      (ui.errors[key] ? '<p class="evt-field-error">' + esc(ui.errors[key]) + '</p>' : '') +
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
      (ui.errors[key] ? '<p class="evt-field-error">' + esc(ui.errors[key]) + '</p>' : '') +
      '</label>'
    );
  }

  function syncDraftFields(scope) {
    (scope || root).querySelectorAll('[data-draft]').forEach(function (el) {
      draft[el.getAttribute('data-draft')] = el.value;
    });
  }

  function readCover(file) {
    var reader = new FileReader();
    reader.onload = function () {
      draft.coverDataUrl = reader.result;
      draft.coverImage = reader.result;
      autosave();
      render();
    };
    reader.readAsDataURL(file);
  }

  function bind() {
    root.querySelectorAll('[data-evt-explore]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.statFilter = '';
        setTab('explore');
        scrollToSection();
      });
    });
    root.querySelectorAll('[data-evt-create]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openWizard(null);
      });
    });
    root.querySelectorAll('[data-evt-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.statFilter = btn.getAttribute('data-evt-tab') === 'mine' ? 'mine' : ui.statFilter;
        setTab(btn.getAttribute('data-evt-tab'));
      });
    });
    root.querySelectorAll('[data-evt-stat]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var f = btn.getAttribute('data-evt-stat');
        ui.statFilter = ui.statFilter === f ? '' : f;
        if (f === 'mine') setTab('mine');
        else if (f === 'upcoming') setTab('upcoming');
        else render();
      });
    });
    var q = root.querySelector('[data-evt-q]');
    if (q) {
      q.addEventListener('input', function () {
        ui.q = q.value;
        render();
        var nq = root.querySelector('[data-evt-q]');
        if (nq) {
          nq.focus();
          nq.setSelectionRange(nq.value.length, nq.value.length);
        }
      });
    }
    ['category', 'date', 'attendance', 'price'].forEach(function (key) {
      var sel = root.querySelector('[data-evt-' + key + ']');
      if (!sel) return;
      sel.addEventListener('change', function () {
        if (key === 'category') ui.categoryFilter = sel.value;
        if (key === 'date') ui.dateFilter = sel.value;
        if (key === 'attendance') ui.attendanceFilter = sel.value;
        if (key === 'price') ui.priceFilter = sel.value;
        render();
      });
    });
    root.querySelectorAll('[data-evt-detail]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.detailId = btn.getAttribute('data-evt-detail');
        render();
      });
    });
    root.querySelectorAll('[data-evt-register]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-evt-register');
        var ev = events().find(function (x) {
          return x.id === id;
        });
        if (ev) openRegister(ev);
      });
    });
    root.querySelectorAll('[data-evt-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ev = events().find(function (x) {
          return x.id === btn.getAttribute('data-evt-edit');
        });
        if (ev) {
          ui.detailId = '';
          openWizard(ev);
        }
      });
    });
    var clearSuccess = root.querySelector('[data-evt-clear-success]');
    if (clearSuccess) {
      clearSuccess.addEventListener('click', function () {
        ui.successNote = '';
        render();
      });
    }

    var detailOverlay = root.querySelector('[data-evt-detail-overlay]');
    if (detailOverlay) {
      detailOverlay.addEventListener('click', function (e) {
        if (e.target === detailOverlay || e.target.closest('[data-evt-close-detail]')) {
          ui.detailId = '';
          render();
        }
      });
    }

    var registerOverlay = root.querySelector('[data-evt-register-overlay]');
    if (registerOverlay) {
      registerOverlay.addEventListener('click', function (e) {
        if (e.target === registerOverlay || e.target.closest('[data-evt-close-register]')) {
          ui.registerId = '';
          render();
        }
      });
      registerOverlay.querySelectorAll('[data-reg]').forEach(function (el) {
        el.addEventListener('input', function () {
          var k = el.getAttribute('data-reg');
          if (k === 'regName') ui.registerForm.name = el.value;
          if (k === 'regEmail') ui.registerForm.email = el.value;
          if (k === 'regPhone') ui.registerForm.phone = el.value;
        });
      });
      var regSubmit = registerOverlay.querySelector('[data-evt-register-submit]');
      if (regSubmit) regSubmit.addEventListener('click', submitRegistration);
    }

    var wizardOverlay = root.querySelector('[data-evt-wizard-overlay]');
    if (wizardOverlay) {
      wizardOverlay.addEventListener('click', function (e) {
        if (e.target === wizardOverlay) closeWizard();
      });
      syncDraftFields(wizardOverlay);
      wizardOverlay.querySelectorAll('[data-draft]').forEach(function (el) {
        el.addEventListener('change', function () {
          draft[el.getAttribute('data-draft')] = el.value;
          autosave();
          if (el.getAttribute('data-draft') === 'attendanceType' || el.getAttribute('data-draft') === 'pricing') {
            render();
          }
        });
        el.addEventListener('input', function () {
          draft[el.getAttribute('data-draft')] = el.value;
          autosave();
        });
      });
      var drop = wizardOverlay.querySelector('[data-evt-cover-drop]');
      var fileInput = wizardOverlay.querySelector('[data-evt-cover-file]');
      if (drop && fileInput) {
        drop.addEventListener('click', function () {
          fileInput.click();
        });
        fileInput.addEventListener('change', function () {
          if (fileInput.files && fileInput.files[0]) readCover(fileInput.files[0]);
        });
      }
      var back = wizardOverlay.querySelector('[data-evt-back]');
      if (back) {
        back.addEventListener('click', function () {
          syncDraftFields(wizardOverlay);
          ui.wizardStep = Math.max(0, ui.wizardStep - 1);
          render();
        });
      }
      var cancel = wizardOverlay.querySelector('[data-evt-cancel]');
      if (cancel) cancel.addEventListener('click', closeWizard);
      var next = wizardOverlay.querySelector('[data-evt-next]');
      if (next) {
        next.addEventListener('click', function () {
          syncDraftFields(wizardOverlay);
          if (!validateStep()) {
            render();
            return;
          }
          ui.wizardStep = Math.min(ui.wizardStep + 1, STEPS.length - 1);
          autosave();
          render();
        });
      }
      var saveDraftBtn = wizardOverlay.querySelector('[data-evt-save-draft]');
      if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', function () {
          syncDraftFields(wizardOverlay);
          submitDraft(true);
        });
      }
      var submitBtn = wizardOverlay.querySelector('[data-evt-submit]');
      if (submitBtn) {
        submitBtn.addEventListener('click', function () {
          syncDraftFields(wizardOverlay);
          submitDraft(false);
        });
      }
    }
  }

  normalizeLegacyEvents();
  applyHash();
  render();

  window.addEventListener('hashchange', function () {
    applyHash();
    render();
  });

  window.HubEventsWorkspace = {
    refresh: render,
    openWizard: openWizard,
    normalizeLegacyEvents: normalizeLegacyEvents
  };
})();
