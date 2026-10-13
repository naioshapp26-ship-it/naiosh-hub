/**
 * باقات الاشتراك والنقاط — client UI wired to /api/hub/packages/*
 */
(function () {
  'use strict';

  var state = {
    packages: [],
    services: [],
    payment: null,
    countries: [],
    currencies: [],
    quotes: {},
    selectedId: null,
    me: null,
    token: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function authHeaders() {
    var h = { Accept: 'application/json', 'Content-Type': 'application/json' };
    var token =
      state.token ||
      (window.HubAuth && window.HubAuth.getToken && window.HubAuth.getToken()) ||
      localStorage.getItem('hubToken') ||
      localStorage.getItem('token') ||
      '';
    if (token) {
      h.Authorization = 'Bearer ' + token;
      h['X-Hub-Token'] = token;
      state.token = token;
    }
    return h;
  }

  function fmtNum(n, decimals) {
    var d = decimals == null ? 2 : decimals;
    var x = Number(n);
    if (!Number.isFinite(x)) return '—';
    return x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function fmtPts(n) {
    return Number(n || 0).toLocaleString('en-US');
  }

  async function api(path, opts) {
    var res = await fetch(path, Object.assign({ headers: authHeaders(), credentials: 'same-origin' }, opts || {}));
    var data = {};
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    data._status = res.status;
    return data;
  }

  function setFeedback(msg, ok) {
    var el = $('pkg-feedback');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('is-error', ok === false);
    el.classList.toggle('is-ok', ok === true);
  }

  function renderStatus() {
    var box = $('pkg-status');
    if (!box) return;
    var pay = state.payment || {};
    var pills = [];
    pills.push(
      '<span class="pkg-pill ' +
        (pay.available ? 'is-ok' : 'is-warn') +
        '"><i class="fas ' +
        (pay.available ? 'fa-check-circle' : 'fa-triangle-exclamation') +
        '"></i> ' +
        (pay.available ? 'بوابة الدفع مفعّلة' : 'الدفع الإلكتروني غير متاح حاليًا') +
        '</span>'
    );
    pills.push(
      '<span class="pkg-pill"><i class="fas fa-university"></i> عملات التحصيل: ' +
        ((pay.settlementCurrencies || ['USD']).join(' · ') || 'USD') +
        '</span>'
    );
    if (state.me && state.me.authenticated) {
      pills.push('<span class="pkg-pill is-ok"><i class="fas fa-user-check"></i> مسجّل الدخول</span>');
    } else {
      pills.push(
        '<span class="pkg-pill"><i class="fas fa-user-lock"></i> <a href="login.html?next=packages.html" style="color:inherit;text-decoration:underline">تسجيل الدخول مطلوب للشراء</a></span>'
      );
    }
    box.innerHTML = pills.join('');
  }

  function renderWallet() {
    var box = $('pkg-wallet');
    if (!box) return;
    var w = state.me && state.me.wallet;
    if (!w) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.innerHTML =
      '<div>الرصيد المتاح: <strong>' +
      fmtPts(w.total) +
      '</strong> نقطة</div>' +
      '<div>مجاني: <strong>' +
      fmtPts(w.free) +
      '</strong></div>' +
      '<div>مدفوع: <strong>' +
      fmtPts(w.paid) +
      '</strong></div>' +
      (state.me.freeClaimed
        ? '<div class="pkg-pill">الباقة المجانية مُنحت مسبقًا</div>'
        : '<div class="pkg-pill is-ok">الباقة المجانية متاحة مرة واحدة</div>');
  }

  function fillSelects() {
    var cSel = $('pkg-country');
    var uSel = $('pkg-currency');
    if (!cSel || !uSel) return;
    var countries = state.countries || [];
    var currencies = state.currencies || [];
    cSel.innerHTML = countries
      .map(function (c) {
        return (
          '<option value="' +
          c.code +
          '" data-currency="' +
          c.currency +
          '">' +
          c.nameAr +
          ' (' +
          c.code +
          ') · ' +
          c.currency +
          '</option>'
        );
      })
      .join('');
    uSel.innerHTML = currencies
      .map(function (c) {
        return '<option value="' + c.code + '">' + c.code + ' — ' + (c.nameAr || c.nameEn || '') + '</option>';
      })
      .join('');

    var suggestCode = (state.me && state.me.suggestedCountryCode) || 'SA';
    var suggestCur = (state.me && state.me.suggestedCurrency) || 'SAR';
    if ([].some.call(cSel.options, function (o) { return o.value === suggestCode; })) cSel.value = suggestCode;
    if ([].some.call(uSel.options, function (o) { return o.value === suggestCur; })) uSel.value = suggestCur;
  }

  async function refreshQuotes() {
    var currency = $('pkg-currency') ? $('pkg-currency').value : 'USD';
    var countryCode = $('pkg-country') ? $('pkg-country').value : '';
    var meta = $('pkg-fx-meta');
    state.quotes = {};
    for (var i = 0; i < state.packages.length; i++) {
      var p = state.packages[i];
      var q = await api('/api/hub/packages/quote', {
        method: 'POST',
        body: JSON.stringify({ packageId: p.id, currency: currency, countryCode: countryCode }),
      });
      if (q.ok) state.quotes[p.id] = q;
    }
    var any = state.quotes[state.packages[0] && state.packages[0].id];
    if (meta && any && any.fx) {
      meta.innerHTML =
        'سعر الصرف من ' +
        (any.fx.provider || 'مزوّد') +
        '<br>تحديث: ' +
        (any.fx.updatedAt || '—') +
        (any.fx.stale ? ' <strong>(مخزّن مؤقتًا)</strong>' : '') +
        '<br>USD → ' +
        currency +
        ' = ' +
        fmtNum(any.fx.rate, 4);
    }
    renderCards();
  }

  function packageButtonLabel(p) {
    if (p.kind === 'free') {
      return state.me && state.me.freeClaimed ? 'تم المنح مسبقًا' : 'ابدأ مجانًا';
    }
    if (p.id === 'pack-6000' || Number(p.points) === 6000) {
      return 'اختر باقة 6,000 نقطة';
    }
    if (p.id === 'pack-16000' || Number(p.points) === 16000) {
      return 'اختر باقة 16,000 نقطة';
    }
    return 'اختر هذه الباقة';
  }

  function packageMeta(p) {
    if (p.kind === 'free') {
      return 'مرة واحدة لكل عميل مؤهل بعد التحقق. تُضاف إلى رصيدك المجاني مباشرة عند التأكيد.';
    }
    return (
      'شراء رصيد نقاط مرة واحدة — بدون اشتراك شهري أو تجديد تلقائي. ' +
      (p.descriptionAr || 'يُستخدم الرصيد في خدمات نايوش هوب المسجّلة بالنقاط.')
    );
  }

  function coverageHint(cost) {
    var c = Number(cost) || 0;
    if (c <= 0) return 'التكلفة غير محددة بعد.';
    if (c <= 300) return 'يمكن تغطيتها من الباقة المجانية (300 نقطة) أو أي شحن أعلى.';
    if (c <= 6000) return 'تحتاج باقة 6,000 نقطة أو أعلى (أو رصيدًا مكافئًا في المحفظة).';
    if (c <= 16000) return 'تناسب باقة 16,000 نقطة أو رصيدًا مدفوعًا مكافئًا.';
    return 'قد تحتاج أكثر من باقة واحدة أو رصيدًا متراكمًا حسب محفظتك.';
  }

  function renderCards() {
    var grid = $('pkg-grid');
    if (!grid) return;
    grid.innerHTML = state.packages
      .map(function (p, idx) {
        var q = state.quotes[p.id];
        var disp = q && q.display;
        var settle = q && q.settlement;
        var priceHtml =
          p.kind === 'free'
            ? '<div class="pkg-price">مجانًا</div>'
            : '<div class="pkg-price">' +
              fmtNum(disp ? disp.amount : p.priceUsd, disp ? disp.decimals : 2) +
              ' ' +
              (disp ? disp.currency : 'USD') +
              '<small>السعر المرجعي: ' +
              fmtNum(p.priceUsd, 2) +
              ' USD' +
              (settle && settle.currency !== (disp && disp.currency)
                ? ' · التحصيل: ' + fmtNum(settle.amount, settle.decimals) + ' ' + settle.currency
                : '') +
              '</small></div>';
        var btnLabel = packageButtonLabel(p);
        var disabled = p.kind === 'free' && state.me && state.me.freeClaimed ? ' disabled' : '';
        var featured = idx === 1 || p.id === 'pack-6000';
        return (
          '<article class="pkg-card' +
          (featured ? ' is-featured' : '') +
          '" data-id="' +
          p.id +
          '">' +
          '<span class="pkg-badge">الأكثر توازنًا</span>' +
          '<h2>' +
          p.nameAr +
          '</h2>' +
          '<div class="pkg-points">' +
          fmtPts(p.points) +
          ' <span>نقطة</span></div>' +
          priceHtml +
          '<p class="pkg-card-meta">' +
          packageMeta(p) +
          '</p>' +
          '<button type="button" class="btn btn-primary" data-select="' +
          p.id +
          '"' +
          disabled +
          '>' +
          btnLabel +
          '</button>' +
          '</article>'
        );
      })
      .join('');
  }

  function renderServices() {
    var grid = $('pkg-services-grid');
    var tb = document.querySelector('#pkg-services-table tbody');
    var rows = state.services || [];
    if (tb) {
      if (!rows.length) {
        tb.innerHTML = '<tr><td colspan="3">لا توجد أسعار خدمات مسجّلة بعد.</td></tr>';
      } else {
        tb.innerHTML = rows
          .map(function (s) {
            return (
              '<tr><td>' +
              (s.nameAr || s.id) +
              '</td><td>' +
              (s.type || '—') +
              '</td><td>' +
              fmtPts(s.pointsCost) +
              '</td></tr>'
            );
          })
          .join('');
      }
    }
    if (!grid) return;
    if (!rows.length) {
      grid.innerHTML =
        '<div class="pkg-svc-empty">لا توجد خدمات مربوطة بالمحفظة في سجل الأسعار الحالي. عند إضافة أسعار من الإدارة ستظهر هنا.</div>';
      return;
    }
    grid.innerHTML = rows
      .map(function (s) {
        var cost = Number(s.pointsCost) || 0;
        return (
          '<article class="pkg-svc">' +
          '<div class="pkg-svc-top">' +
          '<h3 class="pkg-svc-name">' +
          (s.nameAr || s.id) +
          '</h3>' +
          '<span class="pkg-svc-type">' +
          (s.type || 'SERVICE') +
          '</span>' +
          '</div>' +
          '<div class="pkg-svc-cost">' +
          fmtPts(cost) +
          ' <span>نقطة</span></div>' +
          '<p class="pkg-svc-fit">' +
          coverageHint(cost) +
          '</p>' +
          '</article>'
        );
      })
      .join('');
  }

  function openCheckout(packageId) {
    state.selectedId = packageId;
    var box = $('pkg-checkout');
    var dl = $('pkg-checkout-dl');
    var actions = $('pkg-checkout-actions');
    var p = state.packages.find(function (x) {
      return x.id === packageId;
    });
    var q = state.quotes[packageId];
    if (!box || !dl || !actions || !p) return;
    box.classList.add('is-open');
    setFeedback('');
    var settle = q && q.settlement;
    var disp = q && q.display;
    var fxNote = q && q.fx
      ? 'سعر الصرف: 1 USD = ' +
        fmtNum(settle && settle.rate != null ? settle.rate : q.fx.rate, 4) +
        ' ' +
        (settle ? settle.currency : '') +
        (q.fx.stale ? ' (مخزّن مؤقتًا)' : '') +
        ' · المصدر: ' +
        (q.fx.provider || '—')
      : '';
    dl.innerHTML =
      '<dt>الباقة</dt><dd>' +
      p.nameAr +
      '</dd>' +
      '<dt>النقاط</dt><dd>' +
      fmtPts(p.points) +
      '</dd>' +
      '<dt>السعر المرجعي</dt><dd>' +
      (p.kind === 'free' ? 'مجانًا' : fmtNum(p.priceUsd, 2) + ' USD') +
      '</dd>' +
      '<dt>سعر العرض (تقريبي)</dt><dd>' +
      (p.kind === 'free'
        ? '—'
        : fmtNum(disp ? disp.amount : p.priceUsd, disp ? disp.decimals : 2) +
          ' ' +
          (disp ? disp.currency : 'USD') +
          '<br><small style="opacity:.8">للعرض فقط — ليس بالضرورة مبلغ التحصيل</small>') +
      '</dd>' +
      '<dt>المبلغ النهائي للتحصيل</dt><dd style="font-size:1.15rem">' +
      (p.kind === 'free'
        ? '—'
        : '<strong>' +
          (settle ? fmtNum(settle.amount, settle.decimals) + ' ' + settle.currency : fmtNum(p.priceUsd, 2) + ' USD') +
          '</strong>' +
          (settle && settle.gateway ? ' عبر ' + settle.gateway : '') +
          '<br><small style="font-weight:700;opacity:.85">' +
          ((settle && settle.noteAr) || '') +
          '</small>' +
          (fxNote ? '<br><small style="opacity:.8">' + fxNote + '</small>' : '')) +
      '</dd>' +
      '<dt>تنبيه العملات</dt><dd>' +
      ((state.payment && state.payment.displaySettlementNoteAr) ||
        'عملة العرض ≠ عملة التحصيل. التحصيل يعتمد على البوابة ودولة التاجر.') +
      '</dd>' +
      '<dt>حالة البوابة</dt><dd>' +
      ((state.payment && state.payment.messageAr) || '') +
      (state.payment && state.payment.testMode ? ' <strong>(Test — بدون تحصيل حقيقي)</strong>' : '') +
      (state.payment && state.payment.liveChargesEnabled ? ' <strong>(Live)</strong>' : '') +
      '</dd>';

    var html = '';
    if (!(state.me && state.me.authenticated)) {
      html +=
        '<a class="btn btn-primary" href="login.html?next=packages.html"><i class="fas fa-right-to-bracket"></i> سجّل الدخول للمتابعة</a>' +
        '<a class="btn btn-secondary" href="register-freelancer.html">إنشاء حساب</a>';
    } else if (p.kind === 'free') {
      html +=
        '<button type="button" class="btn btn-primary" data-claim-free><i class="fas fa-gift"></i> تأكيد منح 300 نقطة</button>';
    } else {
      var active = (state.payment && state.payment.activeGatewayIds) || [];
      if (state.payment && state.payment.available) {
        if (active.indexOf('paymob') >= 0) {
          var payLabel =
            state.payment && state.payment.testMode
              ? 'الدفع التجريبي عبر Paymob (Test)'
              : state.payment && state.payment.liveChargesEnabled
                ? 'الدفع عبر Paymob'
                : 'الدفع عبر Paymob';
          html +=
            '<button type="button" class="btn btn-primary" data-pay="paymob"><i class="fas fa-credit-card"></i> ' +
            payLabel +
            (settle
              ? ' — ' + fmtNum(settle.amount, settle.decimals) + ' ' + settle.currency
              : '') +
            '</button>';
        }
        if (active.indexOf('stripe') >= 0) {
          html +=
            '<button type="button" class="btn btn-secondary" data-pay="stripe"><i class="fas fa-stripe"></i> الدفع عبر Stripe</button>';
        }
        if (!active.length) {
          html +=
            '<button type="button" class="btn btn-secondary" disabled><i class="fas fa-ban"></i> الدفع غير متاح حاليًا</button>';
        }
      } else {
        html +=
          '<button type="button" class="btn btn-secondary" disabled><i class="fas fa-ban"></i> الدفع غير متاح حاليًا — يلزم تفعيل حساب تاجر</button>';
      }
      html +=
        '<button type="button" class="btn btn-primary" data-pay="manual_review"><i class="fas fa-clipboard-check"></i> طلب شحن للمراجعة الإدارية</button>';
    }
    actions.innerHTML = html;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function claimFree() {
    setFeedback('جاري التحقق…');
    var res = await api('/api/hub/packages/claim-free', { method: 'POST', body: '{}' });
    if (res._status === 401) {
      location.href = res.loginUrl || 'login.html?next=packages.html';
      return;
    }
    if (!res.ok) {
      setFeedback(res.error || 'تعذّر المنح', false);
      return;
    }
    setFeedback('تم منح 300 نقطة · المرجع ' + (res.order && res.order.ref), true);
    await loadMe();
    renderWallet();
    renderCards();
  }

  async function checkout(method) {
    setFeedback('جاري إنشاء الطلب…');
    var res = await api('/api/hub/packages/checkout', {
      method: 'POST',
      body: JSON.stringify({
        packageId: state.selectedId,
        currency: $('pkg-currency') ? $('pkg-currency').value : 'USD',
        countryCode: $('pkg-country') ? $('pkg-country').value : '',
        method: method,
      }),
    });
    if (res._status === 401) {
      location.href = res.loginUrl || 'login.html?next=packages.html';
      return;
    }
    if (!res.ok) {
      setFeedback(res.error || 'تعذّر إنشاء الطلب', false);
      return;
    }
    if (res.checkoutUrl) {
      setFeedback('جارٍ التحويل لبوابة الدفع… لا تُضاف النقاط إلا بعد إشعار موثوق.', true);
      location.href = res.checkoutUrl;
      return;
    }
    setFeedback(
      (res.messageAr || 'تم إنشاء الطلب') +
        (res.order && res.order.ref ? ' · المرجع ' + res.order.ref : '') +
        ' — لن تُضاف النقاط قبل التأكيد.',
      true
    );
    await loadMe();
    renderWallet();
  }

  async function loadCountries(q) {
    var data = await api('/api/hub/packages/countries' + (q ? '?q=' + encodeURIComponent(q) : ''));
    if (data.ok) {
      state.countries = data.countries || [];
      state.currencies = data.currencies || [];
      fillSelects();
    }
  }

  async function loadMe() {
    var data = await api('/api/hub/packages/me');
    if (!data.ok) return;
    state.me = data;
    state.packages = data.packages || state.packages;
    state.services = data.servicePointPrices || state.services;
    state.payment = data.payment || state.payment;
  }

  async function loadCatalog() {
    var data = await api('/api/hub/packages');
    if (!data.ok) throw new Error(data.error || 'فشل تحميل الباقات');
    state.packages = data.packages || [];
    state.services = data.servicePointPrices || [];
    state.payment = data.payment || null;
  }

  async function checkReturnRef() {
    var params = new URLSearchParams(location.search);
    var ref = params.get('ref');
    if (!ref) return;
    if (params.get('paid') === '1') {
      var st = await api('/api/hub/packages/order-status?ref=' + encodeURIComponent(ref));
      openCheckout(st.order && st.order.packageId ? st.order.packageId : state.selectedId);
      setFeedback(st.noteAr || 'تم الرجوع من بوابة الدفع', st.order && st.order.credited ? true : false);
    } else if (params.get('cancel') === '1') {
      setFeedback('تم إلغاء الدفع. لم تُضف أي نقاط.', false);
      $('pkg-checkout').classList.add('is-open');
    }
  }

  function bind() {
    document.addEventListener('click', function (e) {
      var sel = e.target.closest('[data-select]');
      if (sel) {
        openCheckout(sel.getAttribute('data-select'));
        return;
      }
      if (e.target.closest('[data-claim-free]')) {
        claimFree();
        return;
      }
      var pay = e.target.closest('[data-pay]');
      if (pay) checkout(pay.getAttribute('data-pay'));
    });
    var cSel = $('pkg-country');
    var uSel = $('pkg-currency');
    var search = $('pkg-country-search');
    if (cSel) {
      cSel.addEventListener('change', function () {
        var opt = cSel.selectedOptions[0];
        var cur = opt && opt.getAttribute('data-currency');
        if (cur && uSel) uSel.value = cur;
        refreshQuotes();
      });
    }
    if (uSel) uSel.addEventListener('change', refreshQuotes);
    if (search) {
      var t = null;
      search.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(async function () {
          await loadCountries(search.value);
          await refreshQuotes();
        }, 250);
      });
    }
  }

  async function init() {
    bind();
    try {
      await loadCatalog();
      await loadMe();
      await loadCountries('');
      renderStatus();
      renderWallet();
      renderServices();
      await refreshQuotes();
      await checkReturnRef();
    } catch (err) {
      setFeedback(err.message || 'فشل التحميل', false);
      $('pkg-checkout').classList.add('is-open');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
