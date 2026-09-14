/**
 * Purchase Type + External Store open helpers
 * INTERNAL = checkout inside NAIOSh
 * EXTERNAL = confirm then open real marketplace product URL
 */
(function () {
  'use strict';

  var HTTP_RE = /^https?:\/\//i;

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isHttpUrl(url) {
    var u = String(url || '').trim();
    if (!u || !HTTP_RE.test(u)) return false;
    try {
      var parsed = new URL(u);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  function connectorById(id) {
    var list = (window.HubMarketplaceData && window.HubMarketplaceData.MARKETPLACE_CONNECTORS) || [];
    return list.find(function (c) {
      return c.id === id || c.storeId === id;
    }) || null;
  }

  function externalLinkFromItem(item) {
    if (!item) return null;
    var direct =
      item.productUrl ||
      item.externalUrl ||
      item.buyUrl ||
      item.url ||
      '';
    if (isHttpUrl(direct)) {
      return {
        url: String(direct).trim(),
        storeId: item.storeId || item.marketplace || '',
        storeName: item.storeName || item.marketplaceName || 'المتجر',
        storeNameAr: item.storeNameAr || item.storeName || 'المتجر الخارجي',
      };
    }
    var links = item.marketplaces || [];
    for (var i = 0; i < links.length; i++) {
      var m = links[i];
      if (!isHttpUrl(m && m.url)) continue;
      var meta = connectorById(m.id) || {};
      return {
        url: String(m.url).trim(),
        storeId: m.id || meta.storeId || '',
        storeName: m.name || meta.name || 'Store',
        storeNameAr: m.nameAr || meta.nameAr || m.name || 'المتجر',
      };
    }
    return null;
  }

  function resolvePurchaseType(item) {
    if (!item) return 'INTERNAL';
    var explicit = String(item.purchaseType || item.purchase_type || '').toUpperCase();
    if (explicit === 'EXTERNAL' || explicit === 'INTERNAL') return explicit;
    if (externalLinkFromItem(item)) return 'EXTERNAL';
    return 'INTERNAL';
  }

  function formatUsd(amount) {
    var n = Number(amount);
    if (!isFinite(n)) n = 0;
    try {
      return (
        '$' +
        n.toLocaleString('en-US', {
          minimumFractionDigits: n % 1 ? 2 : 0,
          maximumFractionDigits: 2,
        })
      );
    } catch (e) {
      return '$' + n;
    }
  }

  function availabilityLabel(item) {
    var stock = Number(item && item.stock);
    var status = String((item && item.status) || '').toLowerCase();
    if (status === 'archived' || status === 'disabled' || status === 'غير متاح') return 'غير متاح';
    if (isFinite(stock) && stock <= 0) return 'غير متاح';
    return 'متاح';
  }

  function storeLabel(item) {
    var type = resolvePurchaseType(item);
    if (type === 'INTERNAL') return 'NAIOSh';
    var ext = externalLinkFromItem(item);
    return (ext && (ext.storeNameAr || ext.storeName)) || item.storeNameAr || item.storeName || 'متجر خارجي';
  }

  function safeOpenExternal(url) {
    var u = String(url || '').trim();
    if (!isHttpUrl(u)) {
      return { ok: false, error: 'رابط الشراء غير متوفر حالياً.' };
    }
    var opened = window.open(u, '_blank', 'noopener,noreferrer');
    if (!opened) {
      // Popup blocked — fall back to same-tab navigation only after confirm already done
      try {
        window.location.assign(u);
        return { ok: true, fallback: true };
      } catch (e) {
        return { ok: false, error: 'تعذر فتح رابط المتجر. اسمح بالنوافذ المنبثقة أو انسخ الرابط يدوياً.' };
      }
    }
    try {
      opened.opener = null;
    } catch (e2) {}
    return { ok: true };
  }

  function closeConfirm() {
    var el = document.getElementById('hub-purchase-confirm');
    if (el) el.remove();
  }

  function confirmExternalOpen(item, opts) {
    opts = opts || {};
    var ext = externalLinkFromItem(item);
    if (!ext || !isHttpUrl(ext.url)) {
      return Promise.resolve({ ok: false, error: 'رابط الشراء غير متوفر حالياً.' });
    }
    var storeName = ext.storeNameAr || ext.storeName || 'المتجر';
    return new Promise(function (resolve) {
      closeConfirm();
      var html =
        '<div class="hub-purchase-confirm" id="hub-purchase-confirm" role="dialog" aria-modal="true">' +
        '<div class="hub-purchase-confirm__card">' +
        '<h3>إتمام الشراء على ' +
        esc(storeName) +
        '</h3>' +
        '<p>هذا المنتج يُباع من خلال <strong>' +
        esc(storeName) +
        '</strong>. ستنتقل الآن إلى موقع المتجر لإكمال عملية الشراء والدفع.</p>' +
        '<p class="hub-purchase-confirm__hint">لن يتم الدفع داخل نايوش لهذه العملية.</p>' +
        '<div class="hub-purchase-confirm__actions">' +
        '<button type="button" class="btn btn-outline" data-pc-cancel>إلغاء</button>' +
        '<button type="button" class="btn btn-primary" data-pc-open>فتح ' +
        esc(storeName) +
        ' ↗</button>' +
        '</div></div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
      var root = document.getElementById('hub-purchase-confirm');
      var finish = function (result) {
        closeConfirm();
        resolve(result);
      };
      root.querySelector('[data-pc-cancel]').addEventListener('click', function () {
        finish({ ok: false, cancelled: true });
      });
      root.querySelector('[data-pc-open]').addEventListener('click', function () {
        var opened = safeOpenExternal(ext.url);
        if (!opened.ok) {
          finish(opened);
          return;
        }
        finish({ ok: true, url: ext.url, storeName: storeName });
      });
      root.addEventListener('click', function (e) {
        if (e.target === root) finish({ ok: false, cancelled: true });
      });
      if (typeof opts.onShow === 'function') opts.onShow(root);
    });
  }

  function purchaseStepsHtml(item) {
    var type = resolvePurchaseType(item);
    if (type === 'EXTERNAL') {
      return (
        '<div class="hub-purchase-steps" aria-label="طريقة الشراء">' +
        '<strong>طريقة الشراء</strong>' +
        '<ol>' +
        '<li>راجع المنتج والسعر</li>' +
        '<li>اضغط «الانتقال إلى المتجر»</li>' +
        '<li>أكمل الشراء والدفع على موقع المتجر</li>' +
        '<li>ارجع إلى نايوش لمتابعة المنتج/الطلب إذا كانت المتابعة مدعومة</li>' +
        '</ol></div>'
      );
    }
    return (
      '<div class="hub-purchase-steps" aria-label="طريقة الشراء">' +
      '<strong>طريقة الشراء داخل نايوش</strong>' +
      '<ol>' +
      '<li>راجع المنتج</li>' +
      '<li>أضف للسلة أو اشترِ الآن</li>' +
      '<li>أكمل الدفع داخل نايوش</li>' +
      '<li>استلم تأكيد الطلب ورقم الطلب</li>' +
      '</ol></div>'
    );
  }

  function cardActionsHtml(item, opts) {
    opts = opts || {};
    var type = resolvePurchaseType(item);
    var id = item.id || item.sku || '';
    var ext = externalLinkFromItem(item);
    var detailsHref = opts.detailsHref || '';
    var html = '';

    if (detailsHref) {
      html +=
        '<a class="btn-mini" href="' +
        esc(detailsHref) +
        '"><i class="fas fa-eye"></i> عرض التفاصيل</a>';
    }

    if (type === 'EXTERNAL') {
      if (!ext || !isHttpUrl(ext.url)) {
        html +=
          '<span class="hub-purchase-unavailable">رابط الشراء غير متوفر حالياً.</span>';
        return html;
      }
      var label = 'الشراء من ' + (ext.storeNameAr || ext.storeName || 'المتجر') + ' ↗';
      html +=
        '<button type="button" class="btn-mini primary" data-external-buy="' +
        esc(id) +
        '" data-external-url="' +
        esc(ext.url) +
        '" title="سيتم تحويلك إلى موقع المتجر لإتمام عملية الشراء.">' +
        '<i class="fas fa-arrow-up-right-from-square"></i> ' +
        esc(label) +
        '</button>' +
        '<small class="hub-purchase-cta-hint">سيتم تحويلك إلى موقع المتجر لإتمام عملية الشراء.</small>';
      return html;
    }

    html +=
      '<button type="button" class="btn-mini" data-cart="' +
      esc(id) +
      '"><i class="fas fa-basket-shopping"></i> أضف للسلة</button>';
    html +=
      '<button type="button" class="btn-mini primary" data-buy="' +
      esc(id) +
      '"><i class="fas fa-cart-plus"></i> اشترِ الآن</button>';
    return html;
  }

  function wireDocumentClicks(getItemById) {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-external-buy]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var id = btn.getAttribute('data-external-buy');
      var url = btn.getAttribute('data-external-url');
      var item =
        (typeof getItemById === 'function' && getItemById(id)) ||
        ({
          id: id,
          purchaseType: 'EXTERNAL',
          productUrl: url,
          marketplaces: url ? [{ id: 'custom', nameAr: 'المتجر', url: url }] : [],
        });
      confirmExternalOpen(item).then(function (res) {
        if (res.cancelled) return;
        if (!res.ok && window.HubUI && HubUI.toast) HubUI.toast(res.error || 'تعذر فتح المتجر', 'error');
        else if (!res.ok) try { alert(res.error || 'تعذر فتح المتجر'); } catch (err) {}
      });
    });
  }

  function normalizeIncomingPayload(payload) {
    var p = Object.assign({}, payload || {});
    var type = String(p.purchaseType || p.purchase_type || '').toUpperCase();
    var productUrl = p.productUrl || p.product_url || p.url || '';
    var storeId = p.storeId || p.store_id || p.marketplace || '';
    var storeName = p.storeName || p.store_name || '';

    if (!type) {
      type = isHttpUrl(productUrl) || storeId ? 'EXTERNAL' : 'INTERNAL';
    }
    p.purchaseType = type === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL';
    p.currency = 'USD';

    if (p.purchaseType === 'EXTERNAL' && isHttpUrl(productUrl)) {
      p.productUrl = String(productUrl).trim();
      var meta = connectorById(storeId) || {};
      var mpId = meta.id || storeId || 'custom';
      if (!Array.isArray(p.marketplaces) || !p.marketplaces.length) {
        p.marketplaces = [
          {
            id: mpId,
            name: storeName || meta.name || mpId,
            nameAr: storeName || meta.nameAr || meta.name || 'متجر خارجي',
            url: p.productUrl,
            status: 'linked',
          },
        ];
      }
    }
    return p;
  }

  window.HubPurchase = {
    isHttpUrl: isHttpUrl,
    resolvePurchaseType: resolvePurchaseType,
    externalLinkFromItem: externalLinkFromItem,
    formatUsd: formatUsd,
    availabilityLabel: availabilityLabel,
    storeLabel: storeLabel,
    safeOpenExternal: safeOpenExternal,
    confirmExternalOpen: confirmExternalOpen,
    purchaseStepsHtml: purchaseStepsHtml,
    cardActionsHtml: cardActionsHtml,
    wireDocumentClicks: wireDocumentClicks,
    normalizeIncomingPayload: normalizeIncomingPayload,
  };
})();
