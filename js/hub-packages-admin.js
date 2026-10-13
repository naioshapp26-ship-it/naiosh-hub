/**
 * Admin: باقات الاشتراك والنقاط — dashboard panel
 */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function tokenHeaders() {
    var token =
      (window.HubAuth && window.HubAuth.getToken && window.HubAuth.getToken()) ||
      localStorage.getItem('hubToken') ||
      localStorage.getItem('token') ||
      '';
    var h = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (token) {
      h.Authorization = 'Bearer ' + token;
      h['X-Hub-Token'] = token;
    }
    return h;
  }

  async function api(path, opts) {
    var res = await fetch(path, Object.assign({ headers: tokenHeaders(), credentials: 'same-origin' }, opts || {}));
    var data = await res.json().catch(function () {
      return {};
    });
    data._status = res.status;
    return data;
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString('en-US');
  }

  async function mount(root) {
    if (!root) return;
    root.innerHTML = '<p style="padding:16px">جاري تحميل إدارة الباقات…</p>';
    var data = await api('/api/admin/packages/overview');
    if (!data.ok) {
      root.innerHTML = '<p style="padding:16px;color:#b91c1c">' + esc(data.error || 'تعذّر التحميل') + '</p>';
      return;
    }
    var stats = data.stats || {};
    var pay = data.payment || {};
    root.innerHTML =
      '<div class="pkg-admin" style="display:grid;gap:16px">' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px">' +
      '<span class="chip">طلبات: ' +
      fmt(stats.ordersTotal) +
      '</span>' +
      '<span class="chip">مكتملة: ' +
      fmt(stats.fulfilled) +
      '</span>' +
      '<span class="chip">بانتظار المراجعة: ' +
      fmt(stats.pendingReview) +
      '</span>' +
      '<span class="chip">بانتظار الدفع: ' +
      fmt(stats.awaitingPayment) +
      '</span>' +
      '<span class="chip">نقاط مباعة: ' +
      fmt(stats.pointsSold) +
      '</span>' +
      '<span class="chip">USD محصّل (مرجعي): ' +
      fmt(stats.usdCollected) +
      '</span>' +
      '<span class="chip">' +
      (pay.available
        ? 'بوابات: ' + ((pay.activeGatewayIds || []).join(' · ') || pay.gateway || 'مفعّلة')
        : 'الدفع الإلكتروني غير متاح') +
      '</span>' +
      '</div>' +
      (pay.gateways && pay.gateways.length
        ? '<section><h3>بوابات الدفع</h3><ul>' +
          pay.gateways
            .map(function (g) {
              return (
                '<li><strong>' +
                esc(g.nameAr) +
                '</strong> — ' +
                esc(g.statusAr) +
                ' · عملات: ' +
                esc((g.settlementCurrencies || []).join(', ')) +
                '</li>'
              );
            })
            .join('') +
          '</ul><p style="opacity:.85">' +
          esc(pay.recommendationAr || '') +
          '</p></section>'
        : '') +
      '<section><h3>الباقات</h3><div style="overflow:auto"><table class="table"><thead><tr><th>الباقة</th><th>النقاط</th><th>USD</th><th>النوع</th></tr></thead><tbody>' +
      (data.packages || [])
        .map(function (p) {
          return (
            '<tr><td>' +
            esc(p.nameAr) +
            '</td><td>' +
            fmt(p.points) +
            '</td><td>' +
            fmt(p.priceUsd) +
            '</td><td>' +
            esc(p.kind) +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div></section>' +
      '<section><h3>عمليات الشراء</h3><div style="overflow:auto"><table class="table"><thead><tr><th>مرجع</th><th>عميل</th><th>باقة</th><th>نقاط</th><th>حالة</th><th>دفع</th><th>إجراء</th></tr></thead><tbody id="pkg-admin-orders">' +
      (data.orders || [])
        .slice(0, 50)
        .map(function (o) {
          var actions = '';
          if (!o.credited && (o.status === 'pending_review' || o.status === 'awaiting_payment' || o.status === 'paid_pending_credit')) {
            actions =
              '<button type="button" class="btn btn-primary btn-sm" data-confirm="' +
              esc(o.ref) +
              '">تأكيد وإضافة</button> ' +
              '<button type="button" class="btn btn-secondary btn-sm" data-reject="' +
              esc(o.ref) +
              '">رفض</button>';
          } else if (o.credited) {
            actions = '<span>مُضاف</span>';
          }
          return (
            '<tr><td>' +
            esc(o.ref) +
            '</td><td>' +
            esc(o.clientEmail) +
            '</td><td>' +
            esc(o.packageNameAr) +
            '</td><td>' +
            fmt(o.points) +
            '</td><td>' +
            esc(o.status) +
            '</td><td>' +
            esc(o.paymentStatus) +
            '</td><td>' +
            actions +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div></section>' +
      '<section><h3>أرصدة العملاء (أعلى 50)</h3><div style="overflow:auto"><table class="table"><thead><tr><th>البريد</th><th>الاسم</th><th>مدفوع</th><th>مجاني</th><th>الإجمالي</th><th>مجانية؟</th></tr></thead><tbody>' +
      (data.wallets || [])
        .map(function (w) {
          return (
            '<tr><td>' +
            esc(w.email) +
            '</td><td>' +
            esc(w.name) +
            '</td><td>' +
            fmt(w.paid) +
            '</td><td>' +
            fmt(w.free) +
            '</td><td>' +
            fmt(w.total) +
            '</td><td>' +
            (w.freeClaimed ? 'نعم' : 'لا') +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div></section>' +
      '<section><h3>أسعار الخدمات بالنقاط</h3><p style="opacity:.8">تعديل يتطلب صلاحية wallet.adjust أو settings.manage</p><div style="overflow:auto"><table class="table"><thead><tr><th>الخدمة</th><th>النوع</th><th>النقاط</th></tr></thead><tbody id="pkg-admin-prices">' +
      (data.servicePointPrices || [])
        .map(function (s) {
          return (
            '<tr data-id="' +
            esc(s.id) +
            '"><td>' +
            esc(s.nameAr) +
            '</td><td>' +
            esc(s.type) +
            '</td><td><input type="number" min="0" step="1" value="' +
            Number(s.pointsCost || 0) +
            '" style="width:100px" data-price-input /></td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div><button type="button" class="btn btn-primary" id="pkg-admin-save-prices">حفظ أسعار الخدمات</button></section>' +
      '<section><h3>تعديل رصيد (تدقيق)</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;max-width:800px">' +
      '<input id="pkg-adj-email" placeholder="بريد العميل" />' +
      '<input id="pkg-adj-amount" type="number" min="1" placeholder="النقاط" />' +
      '<select id="pkg-adj-dir"><option value="credit">إضافة</option><option value="debit">خصم</option></select>' +
      '<select id="pkg-adj-bucket"><option value="paid">مدفوع</option><option value="free">مجاني</option></select>' +
      '<input id="pkg-adj-note" placeholder="سبب التعديل (إلزامي)" />' +
      '<button type="button" class="btn btn-secondary" id="pkg-adj-go">تنفيذ مع سجل تدقيق</button>' +
      '</div><p id="pkg-admin-msg" style="min-height:1.4em;font-weight:700"></p></section>' +
      '</div>';

    function msg(t, ok) {
      var el = root.querySelector('#pkg-admin-msg');
      if (el) {
        el.textContent = t || '';
        el.style.color = ok === false ? '#b91c1c' : ok ? '#166534' : '';
      }
    }

    root.querySelector('#pkg-admin-orders')?.addEventListener('click', async function (e) {
      var conf = e.target.closest('[data-confirm]');
      var rej = e.target.closest('[data-reject]');
      if (conf) {
        var note = prompt('ملاحظة التأكيد (اختياري)') || '';
        var r = await api('/api/admin/packages/confirm', {
          method: 'POST',
          body: JSON.stringify({ ref: conf.getAttribute('data-confirm'), note: note }),
        });
        msg(r.ok ? 'تم التأكيد وإضافة النقاط' : r.error || 'فشل', r.ok);
        if (r.ok) mount(root);
      }
      if (rej) {
        var note2 = prompt('سبب الرفض') || '';
        var r2 = await api('/api/admin/packages/reject', {
          method: 'POST',
          body: JSON.stringify({ ref: rej.getAttribute('data-reject'), note: note2 }),
        });
        msg(r2.ok ? 'تم الرفض' : r2.error || 'فشل', r2.ok);
        if (r2.ok) mount(root);
      }
    });

    root.querySelector('#pkg-admin-save-prices')?.addEventListener('click', async function () {
      var prices = [];
      root.querySelectorAll('#pkg-admin-prices tr[data-id]').forEach(function (tr) {
        var input = tr.querySelector('[data-price-input]');
        prices.push({ id: tr.getAttribute('data-id'), pointsCost: Number(input && input.value) });
      });
      var r = await api('/api/admin/packages/service-prices', {
        method: 'PUT',
        body: JSON.stringify({ prices: prices }),
      });
      msg(r.ok ? 'تم حفظ الأسعار' : r.error || 'فشل الحفظ', r.ok);
    });

    root.querySelector('#pkg-adj-go')?.addEventListener('click', async function () {
      var email = root.querySelector('#pkg-adj-email')?.value || '';
      var amount = root.querySelector('#pkg-adj-amount')?.value || '';
      var direction = root.querySelector('#pkg-adj-dir')?.value || 'credit';
      var bucket = root.querySelector('#pkg-adj-bucket')?.value || 'paid';
      var note = root.querySelector('#pkg-adj-note')?.value || '';
      if (!note.trim()) {
        msg('سبب التعديل إلزامي للسجل التدقيقي', false);
        return;
      }
      var r = await api('/api/admin/packages/adjust-wallet', {
        method: 'POST',
        body: JSON.stringify({ email: email, amount: amount, direction: direction, bucket: bucket, note: note }),
      });
      msg(r.ok ? 'تم التعديل · ' + (r.ref || '') : r.error || 'فشل', r.ok);
      if (r.ok) mount(root);
    });
  }

  window.HubPackagesAdmin = { mount: mount };
})();
