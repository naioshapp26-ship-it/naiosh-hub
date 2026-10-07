/**
 * Customer Store Upload Wizard
 * Steps: store → product → price/url → media → review → success
 * Currency: USD only. Stores from HubStoresRegistry.
 */
(function () {
  'use strict';

  var STEPS = [
    { id: 'place', label: '1. أين يُباع؟' },
    { id: 'product', label: '2. المنتج' },
    { id: 'link', label: '3. الرابط' },
    { id: 'media', label: '4. الصور' },
    { id: 'review', label: '5. المراجعة' }
  ];

  /** اسم صفحة/قسم متجر المبيعات — يُستخدم للعنوان الظاهر وعنوان المتصفح */
  var SALES_STORE_PAGE_TITLE = 'متجر المبيعات | نايوش هوب 360';
  /** عنوان العملية داخل الصفحة — لا يُستبدل باسم الصفحة */
  var UPLOAD_PROCESS_TITLE = 'إضافة منتج للمراجعة';

  var CATEGORY_LABELS = {
    electronics: 'إلكترونيات',
    fashion: 'أزياء',
    home: 'منزل',
    beauty: 'تجميل',
    other: 'أخرى'
  };

  function categoryLabel(value) {
    var key = String(value || '').trim();
    return CATEGORY_LABELS[key] || key || '—';
  }

  var HUB_HOME_URL = 'https://www.naioshai.com/'; // روابط خارجية للمتاجر فقط — لا يُستخدم لبطاقة داخل نايوش
  var NAIOSH_PRODUCTS_HASH = '#naiosh-products';

  var SUBMIT_LOCK = { busy: false };
  var state = {
    step: 0,
    purchaseType: 'INTERNAL', // INTERNAL | EXTERNAL — داخل نايوش افتراضيًا
    storeId: '',
    customStoreName: '',
    customStoreWebsite: '',
    productName: '',
    category: '',
    brand: '',
    sku: '',
    shortDesc: '',
    fullDesc: '',
    quantity: '1',
    condition: 'new',
    priceUsd: '',
    productUrl: '',
    images: [],
    attachments: [],
    submissionId: '',
    productId: '',
    requestId: '',
    ownerType: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    ownerCompany: '',
    idempotencyKey: '',
    submitError: '',
    urlError: '',
    urlOk: false
  };

  function isLoggedIn() {
    return !!(window.HubAuth && HubAuth.isLoggedIn && HubAuth.isLoggedIn());
  }

  function currentUser() {
    return (window.HubAuth && HubAuth.getUser && HubAuth.getUser()) || null;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  }

  function isValidPhone(phone) {
    var raw = String(phone || '').trim();
    var digits = raw.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15 && /^\+?[0-9]+$/.test(raw);
  }

  function authHeaders() {
    var headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    var token = (window.HubAuth && HubAuth.getToken && HubAuth.getToken()) || '';
    var user = currentUser() || {};
    if (token) {
      headers.Authorization = 'Bearer ' + token;
      headers['X-Hub-Token'] = token;
    }
    if (user.role && /^[\x00-\x7F]+$/.test(String(user.role))) {
      headers['X-Hub-User-Role'] = String(user.role);
    }
    return headers;
  }

  function ensureIdempotency() {
    if (!state.idempotencyKey) {
      state.idempotencyKey =
        'prd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }
    return state.idempotencyKey;
  }

  function fillOwnerFromSession() {
    if (!isLoggedIn()) return;
    var user = currentUser() || {};
    state.ownerName = state.ownerName || user.name || user.fullName || '';
    state.ownerEmail = user.email || state.ownerEmail || '';
    state.ownerPhone = state.ownerPhone || user.phone || '';
    state.ownerCompany = state.ownerCompany || user.company || '';
  }

  function loginResumeUrl() {
    return 'login.html?next=' + encodeURIComponent('store.html#upload');
  }

  function signupResumeUrl() {
    return 'create-account.html?next=' + encodeURIComponent('store.html#upload');
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(msg, type) {
    if (window.HubUI && typeof HubUI.toast === 'function') HubUI.toast(msg, type || 'info');
    else try { alert(msg); } catch (e) {}
  }

  function registry() {
    return window.HubStoresRegistry || null;
  }

  function stores() {
    var reg = registry();
    if (!reg) return [];
    if (typeof reg.listActive === 'function') return reg.listActive();
    return (reg.list({ includeDisabled: false }) || []).filter(function (s) {
      return s.status !== 'disabled';
    });
  }

  function selectedStore() {
    var reg = registry();
    return reg && state.storeId ? reg.get(state.storeId) : null;
  }

  function storeKey(s) {
    return (s && (s.store_id || s.storeId || s.id)) || '';
  }

  function storeName(s) {
    return (s && (s.nameAr || s.name || s.display_name)) || '';
  }

  function storeUrl(s) {
    return (s && (s.website_url || s.websiteUrl)) || '';
  }

  function storeLogoHtml(s) {
    var logo = s && s.logo;
    if (logo && (logo.indexOf('data:') === 0 || logo.indexOf('http') === 0 || logo.indexOf('/') === 0)) {
      return '<img src="' + esc(logo) + '" alt="">';
    }
    if (s && s.icon) {
      return '<i class="' + esc(s.icon) + '" aria-hidden="true"></i>';
    }
    return esc((storeName(s) || '?').charAt(0));
  }

  function findForm() {
    return document.getElementById('store-upload-form') ||
      document.querySelector('#store-upload-panel form') ||
      document.querySelector('.store-upload-form');
  }

  function findPanel() {
    return document.getElementById('store-upload-panel') ||
      document.querySelector('[data-store-upload-panel]') ||
      (findForm() && findForm().closest('.panel, .card, section, .store-panel'));
  }

  function hideLegacyOps() {
    var root = findPanel() || document;
    root.querySelectorAll('[data-ops-mechanism], .ops-mechanism, .common-meta, .hub-common-meta').forEach(function (el) {
      el.hidden = true;
      el.style.display = 'none';
    });
    root.querySelectorAll('label, .field-label, .form-label').forEach(function (el) {
      var t = (el.textContent || '').trim();
      if (t.indexOf('آلية التشغيل') !== -1 || t.indexOf('آلية التشغيل') !== -1) {
        var wrap = el.closest('.form-row, .field, .form-group, label') || el.parentElement;
        if (wrap) {
          wrap.hidden = true;
          wrap.style.display = 'none';
        }
      }
    });
  }

  function renderShell() {
    var form = findForm();
    var panel = findPanel();
    var wrap = document.getElementById('su-wizard-root') ||
      (panel && panel.querySelector('.su-wizard-wrap'));

    if (!wrap) {
      if (!form && !panel) return false;
      var host = panel || (form && form.parentElement);
      if (!host) return false;
      wrap = document.createElement('div');
      wrap.className = 'su-wizard-wrap';
      wrap.id = 'su-wizard-root';
      if (form) {
        form.hidden = true;
        form.setAttribute('aria-hidden', 'true');
        form.style.display = 'none';
        form.parentNode.insertBefore(wrap, form);
      } else {
        host.appendChild(wrap);
      }
    }

    hideLegacyOps();
    if (form) {
      form.hidden = true;
      form.style.display = 'none';
    }

    wrap.innerHTML = buildWizardHtml();
    bindWizard(wrap);
    return true;
  }

  function buildWizardHtml() {
    if (state.submissionId || state.requestId) {
      var isCustomer = state.ownerType === 'Customer';
      return (
        '<div class="su-wizard">' +
          '<div class="su-success">' +
            '<h3>تم إرسال المنتج للمراجعة بنجاح.</h3>' +
            '<p>رقم الطلب</p>' +
            '<code>' + esc(state.requestId || state.submissionId) + '</code>' +
            '<p>رقم المنتج</p>' +
            '<code>' + esc(state.productId || '—') + '</code>' +
            '<p>الحالة: بانتظار المراجعة</p>' +
            (isCustomer
              ? '<p>يمكنك متابعة الطلب من حسابك.</p>'
              : '<p>تم تسجيل الطلب كزائر ببيانات التواصل التي أدخلتها. سنتواصل معك عبر البريد أو الهاتف عند تحديث الحالة.</p>') +
            '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
              (isCustomer
                ? '<a class="btn btn-primary" href="client.html">متابعة طلبي</a>'
                : '') +
              '<a class="btn ' + (isCustomer ? 'btn-outline' : 'btn-primary') + '" href="store.html">العودة للمتجر</a>' +
              '<button type="button" class="btn btn-outline" data-su-new>رفع منتج جديد</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }

    var stepsHtml = STEPS.map(function (s, i) {
      var cls = 'su-step';
      if (i === state.step) cls += ' is-on';
      else if (i < state.step) cls += ' is-done';
      return '<button type="button" class="' + cls + '" data-su-goto="' + i + '">' + esc(s.label) + '</button>';
    }).join('');

    return (
      '<div class="su-wizard">' +
        '<div class="su-wizard-head">' +
          '<div class="su-wizard-head-top">' +
            '<h1 class="su-page-title">' + esc(SALES_STORE_PAGE_TITLE) + '</h1>' +
            '<div class="su-process-block">' +
              '<h2><i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i> ' + esc(UPLOAD_PROCESS_TITLE) + '</h2>' +
              '<p>أضف منتجك من هنا. بعد الإرسال يذهب للإدارة للمراجعة، وبعد القبول يظهر في المتجر للزوار.</p>' +
              '<button type="button" class="btn btn-outline su-help-btn" data-su-help title="كيف أضيف منتجاً؟">؟ كيف أضيف منتجاً؟</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="su-steps">' + stepsHtml + '</div>' +
        '<div class="su-body">' + stepBodyHtml() + '</div>' +
        '<div class="su-actions">' + actionsHtml() + '</div>' +
      '</div>'
    );
  }

  function stepBodyHtml() {
    var id = STEPS[state.step].id;
    if (id === 'place') return placeStepHtml();
    if (id === 'product') return productStepHtml();
    if (id === 'link') return linkStepHtml();
    if (id === 'media') return mediaStepHtml();
    return reviewStepHtml();
  }

  function placeStepHtml() {
    var list = stores();
    var internalSelected = state.purchaseType === 'INTERNAL';
    var cards =
      '<article class="su-store-card' +
      (internalSelected ? ' is-selected' : '') +
      '" data-place="INTERNAL">' +
      '<div class="su-store-brand-link" role="img" aria-label="داخل NAIOSH">' +
      '<div class="su-store-logo" style="background:#d70000"><i class="fas fa-store" aria-hidden="true"></i></div>' +
      '<div class="su-store-name">داخل NAIOSH</div>' +
      '</div>' +
      '<div class="su-store-actions">' +
      '<button type="button" class="btn btn-primary" data-su-place="INTERNAL">' +
      (internalSelected ? 'محدد ✓' : 'اختيار') +
      '</button>' +
      '<button type="button" class="btn btn-outline" data-su-view-naiosh-products title="عرض المنتجات المباعة داخل نايوش">دخول متجر نايوش</button>' +
      '</div></article>';

    cards += list
      .map(function (s) {
        var id = storeKey(s);
        var selected = state.purchaseType === 'EXTERNAL' && state.storeId === id;
        var url = storeUrl(s);
        return (
          '<article class="su-store-card' +
          (selected ? ' is-selected' : '') +
          '" data-store-id="' +
          esc(id) +
          '">' +
          '<div class="su-store-logo" style="background:' +
          esc(s.color || '#111') +
          '">' +
          storeLogoHtml(s) +
          '</div>' +
          '<div class="su-store-name">' +
          esc(storeName(s)) +
          '</div>' +
          '<div class="su-store-actions">' +
          '<button type="button" class="btn btn-primary" data-su-select="' +
          esc(id) +
          '">' +
          (selected ? 'محدد ✓' : 'اختيار') +
          '</button>' +
          (url
            ? '<a class="btn btn-outline" href="' +
              esc(url) +
              '" target="_blank" rel="noopener noreferrer" data-su-open>فتح الموقع ↗</a>'
            : '') +
          '</div></article>'
        );
      })
      .join('');

    return (
      '<section class="su-card">' +
      '<h3>أين سيتم بيع المنتج؟</h3>' +
      '<p class="su-hint">اختر المكان الذي يستطيع العميل شراء المنتج منه.</p>' +
      '<p class="su-hint" style="margin-top:-8px">الخطوة ' +
      (state.step + 1) +
      ' من ' +
      STEPS.length +
      '</p>' +
      '<div class="su-stores-grid">' +
      cards +
      '<button type="button" class="su-store-card su-store-add" data-su-add-store>+ متجر آخر</button>' +
      '</div></section>'
    );
  }

  function productStepHtml() {
    return (
      '<section class="su-card">' +
        '<h3>بيانات المنتج</h3>' +
        '<p class="su-hint">الخطوة ' + (state.step + 1) + ' من ' + STEPS.length + ' — أدخل فقط المعلومات الأساسية. السعر بالدولار الأمريكي.</p>' +
        '<div class="su-fields">' +
          field('productName', 'اسم المنتج *', 'text', state.productName, true) +
          fieldSelect('category', 'الفئة *', state.category, [
            ['', 'اختر الفئة'],
            ['electronics', 'إلكترونيات'],
            ['fashion', 'أزياء'],
            ['home', 'منزل'],
            ['beauty', 'تجميل'],
            ['other', 'أخرى']
          ]) +
          field('shortDesc', 'وصف مختصر *', 'textarea', state.shortDesc, true, true) +
          '<label class="su-field">' +
            '<span>السعر بالدولار *</span>' +
            '<div class="su-price-row">' +
              '<input type="number" min="0.01" step="0.01" inputmode="decimal" data-su-field="priceUsd" value="' + esc(state.priceUsd) + '" placeholder="49.99">' +
              '<span class="su-price-currency">USD</span>' +
            '</div>' +
            '<small style="font-weight:650;color:#667085">أدخل السعر بالدولار الأمريكي.</small>' +
          '</label>' +
          field('brand', 'الماركة (اختياري)', 'text', state.brand) +
          field('quantity', 'الكمية المتاحة', 'number', state.quantity) +
        '</div>' +
      '</section>'
    );
  }

  function linkStepHtml() {
    if (state.purchaseType !== 'EXTERNAL') {
      return (
        '<section class="su-card">' +
          '<h3>رابط الشراء</h3>' +
          '<p class="su-hint">هذا المنتج يُباع داخل نايوش — لا تحتاج رابط متجر خارجي.</p>' +
        '</section>'
      );
    }
    var store = selectedStore();
    var name = store ? storeName(store) : 'المتجر';
    var url = storeUrl(store);
    return (
      '<section class="su-card">' +
        '<h3>أضف رابط المنتج على ' + esc(name) + '</h3>' +
        '<p class="su-hint">افتح ' + esc(name) + '، انسخ رابط صفحة المنتج، ثم الصقه هنا. الخطوة ' + (state.step + 1) + ' من ' + STEPS.length + '</p>' +
        '<div class="su-fields">' +
          '<label class="su-field full">' +
            '<span>رابط المنتج على المتجر *</span>' +
            '<div class="su-url-row">' +
              '<input type="url" data-su-field="productUrl" value="' + esc(state.productUrl) + '" placeholder="https://...">' +
              (url
                ? '<a class="btn btn-outline" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">فتح ' + esc(name) + ' ↗</a>'
                : '') +
              '<button type="button" class="btn btn-outline" data-su-check-url>فحص الرابط</button>' +
            '</div>' +
            '<small style="font-weight:650;color:#667085">انسخ رابط المنتج من شريط عنوان المتصفح.</small>' +
            (state.urlOk ? '<p style="color:#15803d;font-weight:800;margin:0">✓ الرابط صالح</p>' : '') +
            (state.urlError ? '<p class="su-error">' + esc(state.urlError) + '</p>' : '') +
          '</label>' +
        '</div>' +
      '</section>'
    );
  }

  function mediaStepHtml() {
    var previews = state.images.map(function (img, i) {
      return (
        '<div class="su-preview' + (i === 0 ? ' is-cover' : '') + '">' +
          '<img src="' + esc(img.dataUrl) + '" alt="">' +
          '<button type="button" data-su-rm-img="' + i + '">حذف</button>' +
        '</div>'
      );
    }).join('');

    var files = state.attachments.map(function (f, i) {
      return (
        '<div style="display:flex;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid #eee;border-radius:10px;margin-top:8px">' +
          '<span style="font-weight:800;font-size:14px">' + esc(f.name) + '</span>' +
          '<button type="button" class="btn btn-outline" data-su-rm-file="' + i + '">حذف</button>' +
        '</div>'
      );
    }).join('');

    return (
      '<section class="su-card">' +
        '<h3>صور المنتج</h3>' +
        '<p class="su-hint">اسحب الصور هنا أو اضغط للاختيار. الصورة الأولى هي الرئيسية.</p>' +
        '<div class="su-drop" data-su-drop="images" tabindex="0">' +
          '<strong>اسحب الصور هنا أو اضغط للاختيار</strong>' +
          '<span>PNG / JPG — الصورة الأولى رئيسية</span>' +
          '<input type="file" accept="image/*" multiple hidden data-su-file="images">' +
        '</div>' +
        '<div class="su-previews">' + previews + '</div>' +
      '</section>' +
      '<section class="su-card">' +
        '<h3>مرفقات إضافية</h3>' +
        '<p class="su-hint">اختياري: PDF، Datasheet، Manual، Certificate</p>' +
        '<div class="su-drop" data-su-drop="files" tabindex="0">' +
          '<strong>اسحب الملفات هنا أو اضغط للاختيار</strong>' +
          '<span>PDF / DOC / صور</span>' +
          '<input type="file" accept=".pdf,.doc,.docx,image/*" multiple hidden data-su-file="files">' +
        '</div>' +
        files +
      '</section>'
    );
  }

  function reviewStepHtml() {
    fillOwnerFromSession();
    var store = selectedStore();
    var logged = isLoggedIn();
    var ownerEmailReadonly = logged && state.ownerEmail ? ' readonly' : '';
    var howBuy =
      state.purchaseType === 'EXTERNAL'
        ? (store ? storeName(store) : 'المتجر') +
          ' → العميل يشاهد المنتج في NAIOSh → يضغط «الشراء من المتجر» → ينتقل إلى المتجر → يكمل الشراء هناك.'
        : 'داخل NAIOSh → إضافة للسلة أو اشترِ الآن → الدفع داخل نايوش → تأكيد الطلب.';
    return (
      '<section class="su-card">' +
        '<h3>مراجعة قبل الإرسال</h3>' +
        '<p class="su-hint">الخطوة ' + (state.step + 1) + ' من ' + STEPS.length + ' — تحقق من البيانات ثم أرسل للمراجعة.</p>' +
        '<div class="su-review-grid">' +
          reviewItem('نوع الشراء', state.purchaseType === 'EXTERNAL' ? 'خارجي' : 'داخل NAIOSh') +
          reviewItem('المتجر', state.purchaseType === 'INTERNAL' ? 'NAIOSh' : store ? storeName(store) : '—') +
          reviewItem('اسم المنتج', state.productName || '—') +
          reviewItem('السعر', state.priceUsd ? ('$' + state.priceUsd + ' USD') : '—') +
          reviewItem('الرابط', state.purchaseType === 'EXTERNAL' ? state.productUrl || '—' : '— (شراء داخلي)') +
          reviewItem('الفئة', categoryLabel(state.category)) +
          reviewItem('الصور', String(state.images.length)) +
        '</div>' +
        '<div class="hub-purchase-steps" style="margin-top:16px"><strong>كيف سيشتري العميل؟</strong><p style="margin:8px 0 0;font-weight:700;line-height:1.7">' +
          esc(howBuy) +
        '</p></div>' +
        '<p class="su-hint" style="margin-top:12px;color:#026aa2;font-weight:800">بعد الضغط على «إرسال للمراجعة» لن يظهر المنتج فوراً في المتجر — تنتظر الإدارة قبوله أولاً.</p>' +
      '</section>' +
      '<section class="su-card" style="margin-top:14px">' +
        '<h3>بيانات صاحب المنتج</h3>' +
        (logged
          ? '<p class="su-hint">سيتم ربط المنتج بحسابك الحالي كعميل مسجّل. راجع بيانات التواصل قبل الإرسال حتى تستطيع الإدارة التواصل معك.</p>'
          : '<p class="su-hint">أنت تزور كزائر. نطلب الاسم والبريد والهاتف حتى تتواصل الإدارة معك بشأن مراجعة المنتج — لن يتم إنشاء حساب تلقائياً.</p>') +
        '<div class="su-form-grid">' +
          field('ownerName', 'الاسم الكامل *', 'text', state.ownerName, true, true) +
          '<label class="full"><span>البريد الإلكتروني *</span><input type="email" data-su-field="ownerEmail" dir="ltr" value="' +
          esc(state.ownerEmail) +
          '"' +
          ownerEmailReadonly +
          ' required></label>' +
          field('ownerPhone', 'رقم الهاتف *', 'tel', state.ownerPhone, true) +
          field('ownerCompany', 'اسم الشركة / الجهة / المتجر', 'text', state.ownerCompany, false) +
        '</div>' +
        (logged
          ? '<p style="margin:10px 0 0;color:#027a48;font-weight:800">نوع صاحب الطلب: عميل</p>'
          : '<p style="margin:10px 0 0;color:#b54708;font-weight:800">نوع صاحب الطلب: زائر</p>' +
            '<div style="margin-top:12px;padding:12px;border-radius:10px;background:#fff7ed;border:1px solid #fdba74">' +
              '<p style="margin:0 0 10px;font-weight:700">لمتابعة حالة المنتج لاحقاً من حسابك، سجّل الدخول أو أنشئ حساباً. مسودة المنتج محفوظة ولن تُفقد.</p>' +
              '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
                '<a class="btn btn-primary" href="' + esc(loginResumeUrl()) + '">تسجيل الدخول</a>' +
                '<a class="btn btn-outline" href="' + esc(signupResumeUrl()) + '">إنشاء حساب</a>' +
              '</div>' +
            '</div>') +
        (state.submitError ? '<p class="su-error" style="color:#b42318;font-weight:700;margin-top:10px">' + esc(state.submitError) + '</p>' : '') +
      '</section>'
    );
  }

  function reviewItem(label, value) {
    return '<article><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></article>';
  }

  function conditionLabel(v) {
    if (v === 'used') return 'مستعمل';
    if (v === 'refurbished') return 'مجدّد';
    return 'جديد';
  }

  function field(key, label, type, value, required, full) {
    var tag = type === 'textarea'
      ? '<textarea data-su-field="' + key + '"' + (required ? ' required' : '') + '>' + esc(value) + '</textarea>'
      : '<input type="' + type + '" data-su-field="' + key + '" value="' + esc(value) + '"' + (required ? ' required' : '') + '>';
    return '<label class="' + (full ? 'full ' : '') + '"><span>' + esc(label) + '</span>' + tag + '</label>';
  }

  function fieldSelect(key, label, value, options) {
    var opts = options.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (value === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');
    return '<label><span>' + esc(label) + '</span><select data-su-field="' + key + '">' + opts + '</select></label>';
  }

  function actionsHtml() {
    var last = state.step === STEPS.length - 1;
    var left = '<button type="button" class="btn btn-outline" data-su-cancel>إلغاء</button>';
    if (state.step > 0) {
      left += '<button type="button" class="btn btn-outline" data-su-back>رجوع</button>';
    }
    var right = '<button type="button" class="btn btn-outline" data-su-draft>حفظ كمسودة</button>';
    if (last) {
      right += '<button type="button" class="btn btn-outline" data-su-preview>معاينة</button>';
      right += '<button type="button" class="btn btn-primary" data-su-submit>إرسال المنتج للمراجعة</button>';
    } else {
      right += '<button type="button" class="btn btn-primary" data-su-next>التالي</button>';
    }
    return '<div style="display:flex;gap:8px;flex-wrap:wrap">' + left + '</div><div style="display:flex;gap:8px;flex-wrap:wrap">' + right + '</div>';
  }

  function syncFields(root) {
    root.querySelectorAll('[data-su-field]').forEach(function (el) {
      var key = el.getAttribute('data-su-field');
      if (!key) return;
      state[key] = el.value;
    });
  }

  function validateStep() {
    state.urlError = '';
    if (state.step === 0) {
      if (!state.purchaseType) {
        toast('اختر أين سيتم بيع المنتج', 'error');
        return false;
      }
      if (state.purchaseType === 'EXTERNAL' && !state.storeId) {
        toast('اختر المتجر الخارجي', 'error');
        return false;
      }
    }
    if (state.step === 1) {
      if (!String(state.productName || '').trim()) {
        toast('اسم المنتج مطلوب', 'error');
        return false;
      }
      if (!String(state.category || '').trim()) {
        toast('الفئة مطلوبة', 'error');
        return false;
      }
      if (!String(state.shortDesc || '').trim()) {
        toast('الوصف المختصر مطلوب', 'error');
        return false;
      }
      var price = Number(state.priceUsd);
      if (!(price > 0) || !isFinite(price)) {
        toast('أدخل سعراً صحيحاً بالدولار أكبر من 0', 'error');
        return false;
      }
    }
    if (state.step === 2 && state.purchaseType === 'EXTERNAL') {
      var reg = registry();
      var check = reg ? reg.validateProductUrl(state.productUrl, state.storeId) : { ok: !!(window.HubPurchase && HubPurchase.isHttpUrl(state.productUrl)) };
      if (!check.ok) {
        state.urlError = check.message || 'الرابط غير صالح أو لا يبدو تابعاً للمتجر المختار.';
        state.urlOk = false;
        toast(state.urlError, 'error');
        return false;
      }
      state.urlOk = true;
    }
    return true;
  }

  function resetState() {
    state = {
      step: 0,
      purchaseType: 'INTERNAL',
      storeId: '',
      customStoreName: '',
      customStoreWebsite: '',
      productName: '',
      category: '',
      brand: '',
      sku: '',
      shortDesc: '',
      fullDesc: '',
      quantity: '1',
      condition: 'new',
      priceUsd: '',
      productUrl: '',
      images: [],
      attachments: [],
      submissionId: '',
      productId: '',
      requestId: '',
      ownerType: '',
      ownerName: '',
      ownerEmail: '',
      ownerPhone: '',
      ownerCompany: '',
      idempotencyKey: '',
      submitError: '',
      urlError: '',
      urlOk: false
    };
    ensureIdempotency();
  }

  function saveDraft(silent) {
    try {
      localStorage.setItem('naiosh_store_upload_draft_v1', JSON.stringify({
        step: state.step,
        purchaseType: state.purchaseType,
        storeId: state.storeId,
        productName: state.productName,
        category: state.category,
        brand: state.brand,
        sku: state.sku,
        shortDesc: state.shortDesc,
        fullDesc: state.fullDesc,
        quantity: state.quantity,
        condition: state.condition,
        priceUsd: state.priceUsd,
        productUrl: state.productUrl,
        ownerName: state.ownerName,
        ownerEmail: state.ownerEmail,
        ownerPhone: state.ownerPhone,
        ownerCompany: state.ownerCompany,
        idempotencyKey: ensureIdempotency(),
        images: state.images.slice(0, 4),
        attachments: state.attachments.slice(0, 4)
      }));
      if (!silent) toast('تم حفظ المسودة', 'success');
    } catch (e) {
      if (!silent) toast('تعذر حفظ المسودة', 'error');
    }
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem('naiosh_store_upload_draft_v1');
      if (!raw) return;
      var d = JSON.parse(raw);
      Object.keys(d).forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(state, k)) state[k] = d[k];
      });
      fillOwnerFromSession();
      ensureIdempotency();
    } catch (e) {}
  }

  function validateOwner() {
    fillOwnerFromSession();
    if (!String(state.ownerName || '').trim()) {
      state.submitError = 'الاسم الكامل مطلوب';
      return false;
    }
    if (!isValidEmail(state.ownerEmail)) {
      state.submitError = 'البريد الإلكتروني غير صالح';
      return false;
    }
    if (!isValidPhone(state.ownerPhone)) {
      state.submitError = 'رقم الهاتف غير صالح';
      return false;
    }
    state.submitError = '';
    return true;
  }

  function readFiles(fileList, kind) {
    var files = Array.prototype.slice.call(fileList || []);
    files.forEach(function (file) {
      var reader = new FileReader();
      reader.onload = function () {
        if (kind === 'images') {
          state.images.push({ name: file.name, dataUrl: reader.result });
        } else {
          state.attachments.push({ name: file.name, dataUrl: reader.result });
        }
        renderShell();
      };
      reader.readAsDataURL(file);
    });
  }

  function applyServerSubmission(submission, request) {
    if (!submission) return;
    state.submissionId = submission.requestId;
    state.requestId = submission.requestId;
    state.productId = submission.productId;
    state.ownerType = submission.ownerType || '';
    var reg = registry();
    if (reg && typeof reg.createSubmission === 'function') {
      try {
        reg.createSubmission({
          id: submission.requestId,
          storeId: submission.storeId,
          storeName: submission.storeName,
          title: submission.title,
          productUrl: submission.productUrl,
          priceUsd: submission.priceUsd,
          category: submission.category,
          brand: submission.brand,
          sku: submission.sku,
          summary: submission.summary,
          description: submission.description,
          quantity: submission.quantity,
          condition: submission.condition,
          images: submission.images,
          attachments: submission.attachments,
          status: 'بانتظار المراجعة',
          customer: submission.ownerName,
          productId: submission.productId,
          ownerType: submission.ownerType,
          ownerEmail: submission.ownerEmail,
          ownerPhone: submission.ownerPhone,
          ownerCompany: submission.ownerCompany,
          customerId: submission.customerId,
          guestContactId: submission.guestContactId
        });
      } catch (e) {}
    }
    if (window.HubCustomerRequests) {
      if (request && HubCustomerRequests.upsertServerProductRequest) {
        HubCustomerRequests.upsertServerProductRequest(request);
      } else if (HubCustomerRequests.ensureForProduct) {
        HubCustomerRequests.ensureForProduct(submission, submission.ownerName);
      }
    }
    try {
      if (window.HubStore && typeof HubStore.addStoreItem === 'function') {
        HubStore.addStoreItem({
          title: submission.title,
          name: submission.title,
          marketplace: submission.storeId,
          storeId: submission.storeId,
          storeName: submission.storeName || 'NAIOSh',
          url: submission.productUrl || '',
          productUrl: submission.productUrl || '',
          price: submission.priceUsd,
          currency: 'USD',
          category: submission.category,
          brand: submission.brand,
          sku: submission.sku,
          description: submission.summary,
          quantity: submission.quantity || 1,
          stock: submission.quantity || 1,
          condition: submission.condition,
          submissionId: submission.requestId,
          productId: submission.productId,
          images: submission.images || [],
          imageDataUrl: (submission.images && submission.images[0] && submission.images[0].dataUrl) || '',
          purchaseType: submission.purchaseType || 'INTERNAL',
          status: 'pending_review',
          mirrorToCatalog: true
        });
      }
    } catch (e2) {}
  }

  function submitProduct() {
    if (SUBMIT_LOCK.busy) return;
    if (!validateStep()) {
      renderShell();
      return;
    }
    if (!validateOwner()) {
      state.step = STEPS.length - 1;
      renderShell();
      return;
    }
    SUBMIT_LOCK.busy = true;
    state.submitError = '';
    saveDraft(true);
    renderShell();

    var store = selectedStore();
    var price = Number(state.priceUsd);
    var body = {
      idempotencyKey: ensureIdempotency(),
      customerId: '',
      owner: {
        name: String(state.ownerName || '').trim(),
        email: String(state.ownerEmail || '').trim().toLowerCase(),
        phone: String(state.ownerPhone || '').trim(),
        company: String(state.ownerCompany || '').trim()
      },
      product: {
        title: state.productName,
        productName: state.productName,
        category: state.category,
        brand: state.brand,
        sku: state.sku,
        summary: state.shortDesc,
        shortDesc: state.shortDesc,
        description: state.fullDesc || state.shortDesc,
        quantity: Number(state.quantity) || 1,
        condition: state.condition,
        priceUsd: price,
        purchaseType: state.purchaseType || 'INTERNAL',
        storeId: state.storeId,
        store_id: state.storeId,
        storeName: store ? storeName(store) : state.purchaseType === 'INTERNAL' ? 'NAIOSh' : '',
        productUrl: state.purchaseType === 'EXTERNAL' ? state.productUrl : '',
        images: state.images,
        attachments: state.attachments
      }
    };

    fetch('/api/hub/product-submissions', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { res: res, data: data };
        });
      })
      .then(function (pack) {
        if (!pack.res.ok || !pack.data.ok || !pack.data.submission) {
          throw new Error((pack.data && pack.data.error) || 'تعذر إرسال المنتج.');
        }
        applyServerSubmission(pack.data.submission, pack.data.request);
        try { localStorage.removeItem('naiosh_store_upload_draft_v1'); } catch (e2) {}
        toast('تم إرسال المنتج للمراجعة بنجاح.', 'success');
        try {
          if (window.HubMarketPages && typeof window.HubMarketPages.refreshStore === 'function') {
            window.HubMarketPages.refreshStore();
          }
        } catch (e3) {}
      })
      .catch(function (err) {
        state.submitError = (err && err.message) || 'تعذر إرسال المنتج.';
        toast(state.submitError, 'error');
      })
      .finally(function () {
        SUBMIT_LOCK.busy = false;
        renderShell();
      });
  }

  function openHelp() {
    var html =
      '<div class="su-modal-overlay" data-su-modal>' +
        '<div class="su-modal" role="dialog" aria-modal="true">' +
          '<h3>كيف أضيف منتجاً؟</h3>' +
          '<ol style="padding-inline-start:1.2rem;line-height:1.9;font-weight:700;color:#303848">' +
            '<li>اختر أين يُباع المنتج (داخل نايوش أو متجر خارجي).</li>' +
            '<li>أدخل اسم المنتج والفئة والوصف والسعر بالدولار.</li>' +
            '<li>أضف صورة واحدة على الأقل إن أمكن.</li>' +
            '<li>أدخل بيانات صاحب المنتج للتواصل.</li>' +
            '<li>أرسل للمراجعة — بعد قبول الإدارة يظهر في المتجر.</li>' +
          '</ol>' +
          '<div class="su-modal-actions"><button type="button" class="btn btn-primary" data-su-close-modal>حسناً</button></div>' +
        '</div>' +
      '</div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function openAddStoreWizard() {
    var draft = {
      step: 0,
      name: '',
      displayName: '',
      description: '',
      website_url: '',
      logo: '',
      linkMode: 'external_only',
      requiresUrl: 'yes',
      audience: 'all'
    };

    function paint() {
      var existing = document.querySelector('[data-su-add-modal]');
      if (existing) existing.remove();

      var body = '';
      if (draft.step === 0) {
        body =
          '<label class="su-field"><span>اسم المتجر *</span><input data-as="name" value="' + esc(draft.name) + '"></label>' +
          '<label class="su-field"><span>اسم العرض</span><input data-as="displayName" value="' + esc(draft.displayName) + '"></label>' +
          '<label class="su-field"><span>وصف مختصر</span><textarea data-as="description">' + esc(draft.description) + '</textarea></label>';
      } else if (draft.step === 1) {
        body =
          '<label class="su-field"><span>Official Website URL *</span><input data-as="website_url" placeholder="https://store.example.com" value="' + esc(draft.website_url) + '"></label>';
      } else if (draft.step === 2) {
        body =
          '<label class="su-field"><span>شعار المتجر</span><input type="file" accept="image/*" data-as-logo>' +
          (draft.logo ? '<img src="' + esc(draft.logo) + '" alt="" style="width:64px;height:64px;border-radius:12px;margin-top:8px;object-fit:cover">' : '') +
          '</label>';
      } else if (draft.step === 3) {
        body =
          '<label class="su-field"><span>إعدادات الربط</span><select data-as="linkMode">' +
            '<option value="external_only"' + (draft.linkMode === 'external_only' ? ' selected' : '') + '>External Link Only</option>' +
            '<option value="manual"' + (draft.linkMode === 'manual' ? ' selected' : '') + '>Manual Product Link</option>' +
            '<option value="api"' + (draft.linkMode === 'api' ? ' selected' : '') + '>API Integration</option>' +
            '<option value="marketplace"' + (draft.linkMode === 'marketplace' ? ' selected' : '') + '>Marketplace Integration</option>' +
          '</select></label>';
      } else if (draft.step === 4) {
        body =
          '<label class="su-field"><span>Requires Product URL</span><select data-as="requiresUrl">' +
            '<option value="yes"' + (draft.requiresUrl === 'yes' ? ' selected' : '') + '>Yes</option>' +
            '<option value="no"' + (draft.requiresUrl === 'no' ? ' selected' : '') + '>No</option>' +
          '</select></label>' +
          '<p class="su-hint">العملة الافتراضية ثابتة: USD</p>';
      } else if (draft.step === 5) {
        body =
          '<label class="su-field"><span>من يستطيع استخدام هذا المتجر؟</span><select data-as="audience">' +
            '<option value="all"' + (draft.audience === 'all' ? ' selected' : '') + '>All Customers</option>' +
            '<option value="plans"' + (draft.audience === 'plans' ? ' selected' : '') + '>Specific Plans</option>' +
            '<option value="roles"' + (draft.audience === 'roles' ? ' selected' : '') + '>Specific Roles</option>' +
          '</select></label>';
      } else {
        body =
          '<div class="su-review-grid">' +
            reviewItem('الاسم', draft.name) +
            reviewItem('الموقع', draft.website_url) +
            reviewItem('الربط', draft.linkMode) +
            reviewItem('العملة', 'USD') +
          '</div>';
      }

      var titles = ['معلومات المتجر', 'الموقع', 'Logo', 'إعدادات الربط', 'إعدادات المنتجات', 'الصلاحيات', 'مراجعة'];
      var html =
        '<div class="su-modal-overlay" data-su-add-modal data-su-modal>' +
          '<div class="su-modal">' +
            '<h3>إضافة متجر جديد — ' + esc(titles[draft.step] || '') + '</h3>' +
            '<div class="su-fields" style="grid-template-columns:1fr">' + body + '</div>' +
            '<div class="su-modal-actions">' +
              '<button type="button" class="btn btn-outline" data-su-close-modal>إلغاء</button>' +
              (draft.step > 0 ? '<button type="button" class="btn btn-outline" data-as-back>رجوع</button>' : '') +
              (draft.step < 6
                ? '<button type="button" class="btn btn-primary" data-as-next>التالي</button>'
                : '<button type="button" class="btn btn-primary" data-as-save>حفظ المتجر</button>') +
            '</div>' +
          '</div>' +
        '</div>';
      document.body.insertAdjacentHTML('beforeend', html);
      var modal = document.querySelector('[data-su-add-modal]');
      bindAddStoreModal(modal, draft, paint);
    }

    paint();
  }

  function bindAddStoreModal(modal, draft, paint) {
    if (!modal) return;
    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.closest('[data-su-close-modal]')) modal.remove();
    });
    modal.querySelectorAll('[data-as]').forEach(function (el) {
      el.addEventListener('input', function () {
        draft[el.getAttribute('data-as')] = el.value;
      });
      el.addEventListener('change', function () {
        draft[el.getAttribute('data-as')] = el.value;
      });
    });
    var logoInput = modal.querySelector('[data-as-logo]');
    if (logoInput) {
      logoInput.addEventListener('change', function () {
        var file = logoInput.files && logoInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          draft.logo = reader.result;
          paint();
        };
        reader.readAsDataURL(file);
      });
    }
    var back = modal.querySelector('[data-as-back]');
    if (back) back.addEventListener('click', function () {
      draft.step -= 1;
      paint();
    });
    var next = modal.querySelector('[data-as-next]');
    if (next) next.addEventListener('click', function () {
      if (draft.step === 0 && !String(draft.name || '').trim()) {
        toast('اسم المتجر مطلوب', 'error');
        return;
      }
      if (draft.step === 1) {
        try {
          var u = new URL(String(draft.website_url || '').trim());
          if (!/^https?:$/.test(u.protocol)) throw new Error('bad');
        } catch (err) {
          toast('أدخل رابط موقع رسمي صالح', 'error');
          return;
        }
      }
      draft.step += 1;
      paint();
    });
    var save = modal.querySelector('[data-as-save]');
    if (save) save.addEventListener('click', function () {
      var reg = registry();
      if (!reg) {
        toast('سجل المتاجر غير متاح', 'error');
        return;
      }
      try {
        var created = reg.addStore({
          name: draft.name,
          display_name: draft.displayName || draft.name,
          description: draft.description,
          website_url: draft.website_url,
          logo: draft.logo,
          link_mode: draft.linkMode,
          requires_product_url: draft.requiresUrl === 'yes',
          default_currency: 'USD',
          audience: draft.audience,
          status: 'active'
        });
        state.storeId = storeKey(created) || state.storeId;
        modal.remove();
        toast('تم حفظ المتجر', 'success');
        renderShell();
      } catch (err) {
        toast((err && err.message) || 'تعذر حفظ المتجر', 'error');
      }
    });
  }

  function bindWizard(root) {
    root.querySelectorAll('[data-su-goto]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncFields(root);
        var i = Number(btn.getAttribute('data-su-goto'));
        if (i <= state.step) {
          state.step = i;
          renderShell();
        }
      });
    });

    root.querySelectorAll('[data-su-select]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        state.purchaseType = 'EXTERNAL';
        state.storeId = btn.getAttribute('data-su-select');
        renderShell();
      });
    });

    root.querySelectorAll('[data-su-place]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        state.purchaseType = btn.getAttribute('data-su-place') || 'INTERNAL';
        state.storeId = '';
        state.productUrl = '';
        renderShell();
      });
    });

    root.querySelectorAll('[data-su-view-naiosh-products]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        // لا تغادر الصفحة ولا تفتح Home — انتقل لقسم المنتجات داخل نفس المتجر
        if (window.HubMarketPages && typeof window.HubMarketPages.showNaioshInternalProducts === 'function') {
          window.HubMarketPages.showNaioshInternalProducts({ scroll: true });
        } else {
          var section = document.getElementById('naiosh-products');
          if (section) {
            try {
              history.replaceState(null, '', NAIOSH_PRODUCTS_HASH);
            } catch (err) {}
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    });

    root.querySelectorAll('.su-store-card[data-place]').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('a, button')) return;
        state.purchaseType = card.getAttribute('data-place') || 'INTERNAL';
        state.storeId = '';
        renderShell();
      });
    });

    root.querySelectorAll('.su-store-card[data-store-id]').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('a, button')) return;
        state.purchaseType = 'EXTERNAL';
        state.storeId = card.getAttribute('data-store-id');
        renderShell();
      });
    });

    var checkUrl = root.querySelector('[data-su-check-url]');
    if (checkUrl) {
      checkUrl.addEventListener('click', function () {
        syncFields(root);
        var reg = registry();
        var check = reg
          ? reg.validateProductUrl(state.productUrl, state.storeId)
          : { ok: !!(window.HubPurchase && HubPurchase.isHttpUrl(state.productUrl)) };
        state.urlOk = !!check.ok;
        state.urlError = check.ok ? '' : check.message || 'الرابط غير صالح أو لا يبدو تابعاً للمتجر المختار.';
        renderShell();
      });
    }

    root.querySelectorAll('[data-su-field]').forEach(function (el) {
      el.addEventListener('input', function () {
        state[el.getAttribute('data-su-field')] = el.value;
        if (el.getAttribute('data-su-field') === 'productUrl') state.urlError = '';
      });
    });

    var next = root.querySelector('[data-su-next]');
    if (next) next.addEventListener('click', function () {
      syncFields(root);
      if (!validateStep()) {
        renderShell();
        return;
      }
      var nextStep = Math.min(state.step + 1, STEPS.length - 1);
      // Skip external URL step for INTERNAL products
      if (STEPS[nextStep] && STEPS[nextStep].id === 'link' && state.purchaseType === 'INTERNAL') {
        nextStep = Math.min(nextStep + 1, STEPS.length - 1);
      }
      state.step = nextStep;
      renderShell();
    });

    var back = root.querySelector('[data-su-back]');
    if (back) back.addEventListener('click', function () {
      syncFields(root);
      var prev = Math.max(0, state.step - 1);
      if (STEPS[state.step] && STEPS[state.step].id === 'media' && state.purchaseType === 'INTERNAL') {
        // skip link step backwards too
        prev = Math.max(0, state.step - 2);
      }
      state.step = prev;
      renderShell();
    });

    var cancel = root.querySelector('[data-su-cancel]');
    if (cancel) cancel.addEventListener('click', function () {
      if (confirm('إلغاء رفع المنتج؟')) {
        resetState();
        renderShell();
      }
    });

    var draftBtn = root.querySelector('[data-su-draft]');
    if (draftBtn) draftBtn.addEventListener('click', function () {
      syncFields(root);
      saveDraft();
    });

    var preview = root.querySelector('[data-su-preview]');
    if (preview) preview.addEventListener('click', function () {
      syncFields(root);
      toast('هذه معاينة المراجعة الحالية', 'info');
    });

    var submit = root.querySelector('[data-su-submit]');
    if (submit) {
      if (SUBMIT_LOCK.busy) submit.setAttribute('disabled', 'disabled');
      submit.addEventListener('click', function () {
        if (SUBMIT_LOCK.busy) return;
        syncFields(root);
        saveDraft(true);
        submitProduct();
      });
    }

    var help = root.querySelector('[data-su-help]');
    if (help) help.addEventListener('click', openHelp);

    var addStore = root.querySelector('[data-su-add-store]');
    if (addStore) addStore.addEventListener('click', openAddStoreWizard);

    var neu = root.querySelector('[data-su-new]');
    if (neu) neu.addEventListener('click', function () {
      resetState();
      renderShell();
    });

    root.querySelectorAll('[data-su-drop]').forEach(function (zone) {
      var kind = zone.getAttribute('data-su-drop');
      var input = zone.querySelector('input[type="file"]');
      zone.addEventListener('click', function () {
        if (input) input.click();
      });
      zone.addEventListener('dragover', function (e) {
        e.preventDefault();
      });
      zone.addEventListener('drop', function (e) {
        e.preventDefault();
        readFiles(e.dataTransfer.files, kind === 'images' ? 'images' : 'files');
      });
      if (input) {
        input.addEventListener('change', function () {
          readFiles(input.files, kind === 'images' ? 'images' : 'files');
          input.value = '';
        });
      }
    });

    root.querySelectorAll('[data-su-rm-img]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        state.images.splice(Number(btn.getAttribute('data-su-rm-img')), 1);
        renderShell();
      });
    });

    root.querySelectorAll('[data-su-rm-file]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        state.attachments.splice(Number(btn.getAttribute('data-su-rm-file')), 1);
        renderShell();
      });
    });
  }

  document.addEventListener('click', function (e) {
    var close = e.target.closest('[data-su-close-modal]');
    if (close) {
      var modal = close.closest('[data-su-modal]');
      if (modal) modal.remove();
    }
  });

  function syncPageTitle() {
    if (document.title !== SALES_STORE_PAGE_TITLE) {
      document.title = SALES_STORE_PAGE_TITLE;
    }
    document.querySelectorAll('[data-sales-store-page-title]').forEach(function (el) {
      el.textContent = SALES_STORE_PAGE_TITLE;
    });
  }

  function boot() {
    syncPageTitle();
    loadDraft();
    if (!renderShell()) {
      setTimeout(boot, 200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.HubStoreUploadWizard = {
    refresh: renderShell,
    getState: function () { return state; },
    pageTitle: SALES_STORE_PAGE_TITLE,
    processTitle: UPLOAD_PROCESS_TITLE
  };
})();
