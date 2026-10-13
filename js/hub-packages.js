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

  function paymentAvailable() {
    return !!(state.payment && state.payment.available);
  }

  function renderStatus() {
    var box = $('pkg-status');
    if (!box) return;
    if (paymentAvailable()) {
      box.innerHTML =
        '<span class="pkg-pill is-ok"><i class="fas fa-check-circle"></i> الشراء الإلكتروني متاح</span>';
      return;
    }
    box.innerHTML =
      '<span class="pkg-pill is-warn"><i class="fas fa-clock"></i> الشراء متاح قريبًا</span>' +
      '<span class="pkg-pill is-ok"><i class="fas fa-gift"></i> الباقة المجانية متاحة للمستحقين</span>';
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
      '<div>رصيدك: <strong>' +
      fmtPts(w.total) +
      '</strong> نقطة</div>' +
      (state.me.freeClaimed
        ? '<span class="pkg-pill">حصلت على الباقة المجانية</span>'
        : '<span class="pkg-pill is-ok">يمكنك الحصول على 300 نقطة مجانًا</span>');
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
          '</option>'
        );
      })
      .join('');
    uSel.innerHTML = currencies
      .map(function (c) {
        return '<option value="' + c.code + '">' + (c.nameAr || c.nameEn || c.code) + '</option>';
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
    state.quotes = {};
    for (var i = 0; i < state.packages.length; i++) {
      var p = state.packages[i];
      var q = await api('/api/hub/packages/quote', {
        method: 'POST',
        body: JSON.stringify({ packageId: p.id, currency: currency, countryCode: countryCode }),
      });
      if (q.ok) state.quotes[p.id] = q;
    }
    // FX provider/timestamps stay server-side — never shown to clients.
    renderCards();
  }

  function packageMeta(p) {
    if (p.kind === 'free') return 'مرة واحدة للمستحقين بعد تسجيل الدخول.';
    return 'رصيد يُستخدم في خدمات نايوش هوب بالنقاط.';
  }

  function coverageHint(cost) {
    var c = Number(cost) || 0;
    if (c <= 0) return '';
    if (c <= 300) return 'تكفي لها الباقة المجانية أو أي باقة أعلى.';
    if (c <= 6000) return 'تناسب باقة 6,000 نقطة أو أعلى.';
    if (c <= 16000) return 'تناسب باقة 16,000 نقطة.';
    return 'قد تحتاج رصيدًا أكبر من باقة واحدة.';
  }

  function renderCards() {
    var grid = $('pkg-grid');
    if (!grid) return;
    var canPay = paymentAvailable();
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
              '<small>' +
              (settle && settle.amount != null
                ? 'السعر عند الشراء: ' + fmtNum(settle.amount, settle.decimals) + ' ' + settle.currency
                : 'السعر: ' + fmtNum(p.priceUsd, 2) + ' دولار') +
              '</small></div>';
        var featured = idx === 1 || p.id === 'pack-6000';
        var actionHtml = '';
        if (p.kind === 'free') {
          var claimed = state.me && state.me.freeClaimed;
          actionHtml =
            '<button type="button" class="btn btn-primary" data-select="' +
            p.id +
            '"' +
            (claimed ? ' disabled' : '') +
            '>' +
            (claimed ? 'تم الحصول عليها' : 'ابدأ مجانًا') +
            '</button>';
        } else if (canPay) {
          actionHtml =
            '<button type="button" class="btn btn-primary" data-select="' +
            p.id +
            '">اختر هذه الباقة</button>';
        } else {
          actionHtml = '<div class="pkg-soon" role="status">الشراء متاح قريبًا</div>';
        }
        return (
          '<article class="pkg-card' +
          (featured ? ' is-featured' : '') +
          '" data-id="' +
          p.id +
          '">' +
          '<span class="pkg-badge">الأنسب لكثيرين</span>' +
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
          actionHtml +
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
    var title = $('pkg-checkout-title');
    var p = state.packages.find(function (x) {
      return x.id === packageId;
    });
    var q = state.quotes[packageId];
    if (!box || !dl || !actions || !p) return;

    // Paid packages: do not open a fake checkout when payment is unavailable.
    if (p.kind !== 'free' && !paymentAvailable()) {
      box.classList.remove('is-open');
      setFeedback('الشراء متاح قريبًا. يمكنك الحصول على الباقة المجانية إن كنت مستحقًا.', false);
      return;
    }

    box.classList.add('is-open');
    setFeedback('');
    if (title) title.textContent = p.kind === 'free' ? 'الحصول على الباقة المجانية' : 'تأكيد الشراء';
    var settle = q && q.settlement;
    var disp = q && q.display;
    dl.innerHTML =
      '<dt>الباقة</dt><dd>' +
      p.nameAr +
      '</dd>' +
      '<dt>النقاط</dt><dd>' +
      fmtPts(p.points) +
      '</dd>' +
      (p.kind === 'free'
        ? '<dt>السعر</dt><dd>مجانًا</dd>'
        : '<dt>السعر المعروض</dt><dd>' +
          fmtNum(disp ? disp.amount : p.priceUsd, disp ? disp.decimals : 2) +
          ' ' +
          (disp ? disp.currency : 'USD') +
          '</dd>' +
          '<dt>المبلغ النهائي</dt><dd style="font-size:1.15rem"><strong>' +
          (settle
            ? fmtNum(settle.amount, settle.decimals) + ' ' + settle.currency
            : fmtNum(p.priceUsd, 2) + ' دولار') +
          '</strong></dd>');

    var html = '';
    if (!(state.me && state.me.authenticated)) {
      html +=
        '<a class="btn btn-primary" href="login.html?next=packages.html"><i class="fas fa-right-to-bracket"></i> سجّل الدخول للمتابعة</a>' +
        '<a class="btn btn-secondary" href="register-freelancer.html">إنشاء حساب</a>';
    } else if (p.kind === 'free') {
      html +=
        '<button type="button" class="btn btn-primary" data-claim-free><i class="fas fa-gift"></i> تأكيد الحصول على 300 نقطة</button>';
    } else {
      var active = (state.payment && state.payment.activeGatewayIds) || [];
      if (paymentAvailable()) {
        if (active.indexOf('paymob') >= 0) {
          html +=
            '<button type="button" class="btn btn-primary" data-pay="paymob"><i class="fas fa-credit-card"></i> ادفع الآن' +
            (settle ? ' — ' + fmtNum(settle.amount, settle.decimals) + ' ' + settle.currency : '') +
            '</button>';
        }
        if (active.indexOf('stripe') >= 0) {
          html +=
            '<button type="button" class="btn btn-secondary" data-pay="stripe"><i class="fas fa-credit-card"></i> ادفع الآن</button>';
        }
        if (!active.length) {
          html += '<div class="pkg-soon" role="status">الشراء متاح قريبًا</div>';
        }
      } else {
        html += '<div class="pkg-soon" role="status">الشراء متاح قريبًا</div>';
      }
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
