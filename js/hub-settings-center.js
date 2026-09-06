/**
 * Settings Admin Control Center — guided UX for HubStore internal settings.
 */
(function () {
  'use strict';

  var HELP = {
    identity: 'هذه الأسماء تظهر للمستخدمين في القائمة الجانبية وعناوين المنصة.',
    colors: 'اختر ألوان علامتك. شاهد النتيجة في المعاينة ثم اضغط حفظ.',
    logos: 'ارفع شعارًا بخلفية شفافة إن أمكن (PNG). الشعار الرئيسي يظهر في الشريط الجانبي.',
    banners: 'أضف بنرًا بصورة أو رابط فيديو، حدّد مكان الظهور والتواريخ، ثم فعّله واحفظ.',
    session: 'مدة الجلسة تحدد متى يُطلب تسجيل الدخول مجددًا عند الخمول.',
    maintenance: 'وضع الصيانة يعرض شريط تنبيه أعلى غرفة العمليات دون إيقاف الصفحات.',
  };

  var LOCATIONS = [
    { id: 'homepage', label: 'الصفحة الرئيسية' },
    { id: 'dashboard', label: 'غرفة العمليات' },
    { id: 'login', label: 'صفحة الدخول' },
    { id: 'promo', label: 'ترويجي' },
    { id: 'announce', label: 'إعلان' },
  ];

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtSaved(iso) {
    if (!iso) return 'لم يُحفظ بعد';
    try {
      return new Date(iso).toLocaleString('ar-EG');
    } catch (e) {
      return String(iso);
    }
  }

  function field(opts) {
    var key = opts.key;
    var label = opts.label;
    var help = opts.help || '';
    var type = opts.type || 'text';
    var value = opts.value == null ? '' : opts.value;
    var options = opts.options || [];
    var search = opts.search || '';
    var control = '';
    if (type === 'select') {
      control =
        '<select data-set="' +
        esc(key) +
        '">' +
        options
          .map(function (o) {
            return (
              '<option value="' +
              esc(o.value) +
              '"' +
              (String(value) === String(o.value) ? ' selected' : '') +
              '>' +
              esc(o.label) +
              '</option>'
            );
          })
          .join('') +
        '</select>';
    } else if (type === 'textarea') {
      control =
        '<textarea data-set="' +
        esc(key) +
        '" rows="' +
        (opts.rows || 3) +
        '">' +
        esc(value) +
        '</textarea>';
    } else {
      control =
        '<input data-set="' +
        esc(key) +
        '" type="' +
        esc(type) +
        '" value="' +
        esc(value) +
        '"' +
        (opts.min != null ? ' min="' + opts.min + '"' : '') +
        (opts.max != null ? ' max="' + opts.max + '"' : '') +
        ' />';
    }
    return (
      '<div class="sac-field" data-search="' +
      esc(label + ' ' + help + ' ' + search + ' ' + key) +
      '"><label>' +
      esc(label) +
      '</label>' +
      (help ? '<p class="sac-help">' + esc(help) + '</p>' : '') +
      control +
      '</div>'
    );
  }

  function toggle(key, title, help, on, search) {
    return (
      '<label class="sac-toggle' +
      (on ? ' is-on' : '') +
      '" data-search="' +
      esc(title + ' ' + help + ' ' + (search || '')) +
      '"><input type="checkbox" data-set="' +
      esc(key) +
      '"' +
      (on ? ' checked' : '') +
      ' /><span class="sac-toggle-ui" aria-hidden="true"><i></i></span><span class="sac-toggle-copy"><strong>' +
      esc(title) +
      '</strong><small>' +
      esc(help) +
      '</small></span><span class="sac-toggle-state">' +
      (on ? 'مفعّل' : 'إيقاف') +
      '</span></label>'
    );
  }

  var COLOR_DEFAULTS = {
    primaryColor: '#d70000',
    secondaryColor: '#0a0a0a',
    accentColor: '#8a000c',
    bgColor: '#f4f4f5',
    textColor: '#111111',
    surfaceColor: '#ffffff',
  };

  function colorRow(key, label, help, value) {
    var def = COLOR_DEFAULTS[key] || '#d70000';
    var v = value || def;
    return (
      '<div class="sac-color" data-search="' +
      esc(label + ' ' + help + ' لون') +
      '"><div><strong>' +
      esc(label) +
      '</strong><p>' +
      esc(help) +
      '</p></div><div class="sac-color-controls"><input type="color" data-color-for="' +
      esc(key) +
      '" value="' +
      esc(v) +
      '" aria-label="' +
      esc(label) +
      '" /><input type="text" class="sac-hex" data-set="' +
      esc(key) +
      '" value="' +
      esc(v) +
      '" maxlength="7" /><span class="sac-swatch" data-swatch-for="' +
      esc(key) +
      '" style="background:' +
      esc(v) +
      '"></span><button type="button" class="btn btn-ghost sac-mini" data-action="reset-color" data-color-key="' +
      esc(key) +
      '" data-default="' +
      esc(def) +
      '">إعادة</button></div></div>'
    );
  }

  function mediaCard(key, title, help, value, recommend) {
    return (
      '<div class="sac-media" data-media-key="' +
      esc(key) +
      '" data-search="' +
      esc(title + ' ' + help + ' شعار صورة') +
      '"><div class="sac-media-head"><div><strong>' +
      esc(title) +
      '</strong><p>' +
      esc(help) +
      '</p><small>' +
      esc(recommend) +
      '</small></div><div class="sac-media-actions"><label class="btn btn-ghost sac-mini" style="cursor:pointer">رفع / استبدال<input type="file" hidden accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg" data-media-upload="' +
      esc(key) +
      '" /></label><button type="button" class="btn btn-ghost sac-mini" data-action="clear-media" data-media-key="' +
      esc(key) +
      '"' +
      (value ? '' : ' disabled') +
      '>إزالة</button></div></div><div class="sac-media-preview' +
      (value ? ' has-img' : '') +
      '">' +
      (value
        ? '<img src="' + esc(value) + '" alt="' + esc(title) + '" />'
        : '<div class="sac-drop"><i class="fas fa-cloud-arrow-up"></i><span>اسحب صورة أو اضغط رفع</span></div>') +
      '</div><input type="hidden" data-set="' +
      esc(key) +
      '" value="' +
      esc(value || '') +
      '" /><p class="sac-media-status" data-media-status="' +
      esc(key) +
      '"></p></div>'
    );
  }

  function bannerCard(b) {
    var loc = '—';
    for (var i = 0; i < LOCATIONS.length; i++) {
      if (LOCATIONS[i].id === b.location) loc = LOCATIONS[i].label;
    }
    return (
      '<article class="sac-banner-card" data-banner-id="' +
      esc(b.id) +
      '" data-search="بنر ' +
      esc(b.name) +
      ' ' +
      esc(b.title) +
      '"><div class="sac-banner-preview">' +
      (b.imageDataUrl
        ? '<img src="' + esc(b.imageDataUrl) + '" alt="" />'
        : b.videoUrl
          ? '<div class="sac-banner-video"><i class="fas fa-film"></i></div>'
          : '<div class="sac-banner-empty">بدون وسائط</div>') +
      '<span class="sac-badge ' +
      (b.enabled ? 'ok' : 'off') +
      '">' +
      (b.enabled ? 'مفعّل' : 'متوقف') +
      '</span></div><div class="sac-banner-meta"><strong>' +
      esc(b.name || 'بنر') +
      '</strong><small>' +
      esc(b.title || '—') +
      '</small><div class="sac-banner-chips"><span>' +
      esc(loc) +
      '</span><span>ترتيب ' +
      esc(b.order) +
      '</span></div></div><div class="sac-banner-actions"><button type="button" class="btn btn-ghost sac-mini" data-action="toggle-banner" data-banner-id="' +
      esc(b.id) +
      '">' +
      (b.enabled ? 'إيقاف' : 'تفعيل') +
      '</button><button type="button" class="btn btn-ghost sac-mini" data-action="edit-banner" data-banner-id="' +
      esc(b.id) +
      '">تعديل</button><button type="button" class="btn btn-ghost sac-mini" data-action="duplicate-banner" data-banner-id="' +
      esc(b.id) +
      '">نسخ</button><button type="button" class="btn btn-ghost sac-mini danger" data-action="delete-banner" data-banner-id="' +
      esc(b.id) +
      '">حذف</button></div></article>'
    );
  }

  function section(id, icon, title, desc, affect, body, helpKey) {
    return (
      '<section class="sac-section card" id="sac-' +
      esc(id) +
      '" data-sac-section="' +
      esc(id) +
      '"><header class="sac-section-head"><div class="sac-section-icon"><i class="fas ' +
      esc(icon) +
      '"></i></div><div><h3>' +
      esc(title) +
      '</h3><p>' +
      esc(desc) +
      '</p>' +
      (affect ? '<div class="sac-affect"><i class="fas fa-eye"></i> يؤثر على: ' + esc(affect) + '</div>' : '') +
      '</div>' +
      (helpKey
        ? '<button type="button" class="btn btn-ghost sac-mini" data-action="settings-help" data-help-key="' +
          esc(helpKey) +
          '"><i class="fas fa-circle-question"></i> كيف تستخدم؟</button>'
        : '') +
      '</header><div class="sac-section-body">' +
      body +
      '</div></section>'
    );
  }

  function previewBlock(s) {
    var logo = s.logoMain || 'assets/logo-hub.jpeg';
    var banners = Array.isArray(s.banners) ? s.banners : [];
    var bnr = null;
    for (var i = 0; i < banners.length; i++) {
      if (banners[i].enabled && banners[i].imageDataUrl) {
        bnr = banners[i];
        break;
      }
    }
    return (
      '<aside class="sac-preview card" id="sac-live-preview"><header class="sac-preview-head"><div><h3>معاينة مباشرة</h3><p>شاهد كيف ستظهر التغييرات قبل حفظها.</p></div></header><div class="sac-preview-stage" style="--sac-primary:' +
      esc(s.primaryColor) +
      ';--sac-secondary:' +
      esc(s.secondaryColor) +
      ';--sac-accent:' +
      esc(s.accentColor) +
      ';--sac-bg:' +
      esc(s.bgColor) +
      ';--sac-text:' +
      esc(s.textColor) +
      ';--sac-surface:' +
      esc(s.surfaceColor) +
      '"><div class="sac-mini-app"><div class="sac-mini-side"><div class="sac-mini-brand"><img data-preview-logo src="' +
      esc(logo) +
      '" alt="" /><div><strong data-preview-name>' +
      esc(s.orgNameEn || 'NAIOSH HUB') +
      '</strong><span data-preview-tag>' +
      esc(s.orgTagline || '') +
      '</span></div></div><div class="sac-mini-nav"><i></i><i></i><i class="on"></i><i></i></div></div><div class="sac-mini-main"><div class="sac-mini-top"><span data-preview-title>' +
      esc(s.orgNameAr || 'نايوش هوب') +
      '</span><button type="button" class="sac-mini-btn">إجراء رئيسي</button></div><div class="sac-mini-banner" data-preview-banner>' +
      (bnr ? '<img src="' + esc(bnr.imageDataUrl) + '" alt="" />' : '<span>مثال بنر ترويجي</span>') +
      '</div><div class="sac-mini-card"><strong>بطاقة نموذجية</strong><p>نص توضيحي بلون الواجهة الحالي.</p><a href="#" onclick="return false">رابط مهم</a></div><div class="sac-mini-toast">تنبيه نجاح ✓</div></div></div></div></aside>'
    );
  }

  function render(s, shopCats) {
    s = s || {};
    var banners = Array.isArray(s.banners) ? s.banners.slice().sort(function (a, b) {
      return Number(a.order) - Number(b.order);
    }) : [];
    var cats = shopCats && shopCats.length ? shopCats : [{ id: 'الكل', name: 'كل المنتجات' }];
    var catOpts = cats.map(function (c) {
      return { value: c.id, label: c.name || c.id };
    });

    var nav = [
      ['overview', 'fa-gauge', 'نظرة عامة'],
      ['identity', 'fa-building', 'هوية المنشأة'],
      ['brand', 'fa-palette', 'الهوية البصرية'],
      ['logos', 'fa-image', 'الشعار والصور'],
      ['banners', 'fa-panorama', 'البنرات والفيديو'],
      ['locale', 'fa-globe', 'اللغة والمنطقة'],
      ['interface', 'fa-compass', 'الواجهة'],
      ['notify', 'fa-bell', 'الإشعارات'],
      ['ai', 'fa-robot', 'الذكاء الاصطناعي'],
      ['security', 'fa-shield-halved', 'الأمان'],
      ['ops', 'fa-gears', 'التشغيل'],
      ['advanced', 'fa-screwdriver-wrench', 'متقدم'],
    ]
      .map(function (item, i) {
        return (
          '<button type="button" class="' +
          (i === 0 ? 'is-active' : '') +
          '" data-action="sac-jump" data-target="' +
          item[0] +
          '"><i class="fas ' +
          item[1] +
          '"></i> ' +
          item[2] +
          '</button>'
        );
      })
      .join('');

    return (
      '<div class="sac" id="settings-admin-center" data-dirty="0">' +
      '<header class="sac-hero"><div><div class="empire-banner-kicker"><i class="fas fa-sliders"></i> SYSTEM SETTINGS</div><h2>إعدادات النظام</h2><p>تحكم في هوية المنصة، المظهر، المحتوى المرئي، اللغة، والإعدادات العامة من مكان واحد.</p></div><div class="sac-hero-actions"><button type="button" class="btn btn-primary" data-action="save-settings"><i class="fas fa-floppy-disk"></i> حفظ التغييرات</button><button type="button" class="btn btn-ghost" data-action="export-settings"><i class="fas fa-download"></i> تصدير</button></div></header>' +
      '<div class="sac-dirty hidden" id="sac-dirty-bar" role="status"><strong>لديك تغييرات غير محفوظة</strong><div><button type="button" class="btn btn-primary" data-action="save-settings">حفظ التغييرات</button><button type="button" class="btn btn-ghost" data-action="discard-settings">تجاهل التغييرات</button></div></div>' +
      '<div class="sac-summary"><article><span>المنشأة</span><strong data-sum-org>' +
      esc(s.orgNameAr) +
      '</strong><small data-sum-org-en>' +
      esc(s.orgNameEn) +
      '</small></article><article class="sac-sum-logo"><span>الشعار</span><img data-sum-logo src="' +
      esc(s.logoMain || 'assets/logo-hub.jpeg') +
      '" alt="" /></article><article><span>الثيم</span><strong class="sac-sum-swatches"><i style="background:' +
      esc(s.primaryColor) +
      '"></i><i style="background:' +
      esc(s.secondaryColor) +
      '"></i><i style="background:' +
      esc(s.accentColor) +
      '"></i></strong><small>أساسي / ثانوي / تمييز</small></article><article><span>اللغة</span><strong>' +
      esc(s.locale === 'en' ? 'English' : 'العربية') +
      '</strong><small>' +
      esc(s.currency) +
      ' · ' +
      esc(s.timezone) +
      '</small></article><article><span>آخر حفظ</span><strong style="font-size:14px">' +
      esc(fmtSaved(s.updatedAt)) +
      '</strong><small>' +
      (s.maintenanceMode ? 'وضع صيانة' : 'تشغيل عادي') +
      '</small></article></div>' +
      '<div class="sac-toolbar"><div class="sac-search"><i class="fas fa-magnifying-glass"></i><input type="search" id="sac-search" placeholder="ابحث في الإعدادات… الشعار، اللون، العملة، البنر…" aria-label="ابحث في الإعدادات" /></div><p class="sac-search-hint" id="sac-search-hint" hidden>لا نتائج مطابقة — جرّب كلمة أخرى.</p></div>' +
      '<div class="sac-layout"><nav class="sac-nav" aria-label="أقسام الإعدادات">' +
      nav +
      '</nav><div class="sac-main">' +
      section('overview', 'fa-gauge-high', 'نظرة عامة', 'ملخص سريع ومعاينة حية للتغييرات.', 'كل أجزاء المنصة بعد الحفظ', previewBlock(s)) +
      section(
        'identity',
        'fa-building',
        'هوية المنشأة',
        'الاسم والشعار النصي كما يراه المستخدمون.',
        'القائمة الجانبية وعناوين النظام',
        '<div class="sac-grid-2">' +
          field({
            key: 'orgNameAr',
            label: 'الاسم بالعربي',
            help: 'الاسم الذي سيظهر للمستخدمين داخل المنصة.',
            value: s.orgNameAr,
            search: 'منشأة',
          }) +
          field({
            key: 'orgNameEn',
            label: 'الاسم بالإنجليزي',
            help: 'يُستخدم في الشريط الجانبي والعرض الإنجليزي.',
            value: s.orgNameEn,
          }) +
          '</div>' +
          field({
            key: 'orgTagline',
            label: 'الشعار / النص تحت الاسم',
            help: 'جملة قصيرة تحت اسم المنصة.',
            value: s.orgTagline,
          }),
        'identity'
      ) +
      section(
        'brand',
        'fa-palette',
        'الهوية البصرية',
        'خصص ألوان المنصة لتوافق علامتك.',
        'الأزرار والروابط والخلفيات والبطاقات',
        '<div class="sac-colors">' +
          colorRow('primaryColor', 'اللون الأساسي', 'الأزرار الرئيسية والروابط المهمة.', s.primaryColor) +
          colorRow('secondaryColor', 'اللون الثانوي', 'خلفيات داكنة وهيكل الواجهة.', s.secondaryColor) +
          colorRow('accentColor', 'لون التمييز', 'للتأكيدات والحالات الخاصة.', s.accentColor) +
          colorRow('bgColor', 'لون الخلفية', 'خلفية صفحات غرفة العمليات.', s.bgColor) +
          colorRow('textColor', 'لون النص', 'النصوص الأساسية.', s.textColor) +
          colorRow('surfaceColor', 'لون البطاقات', 'خلفية البطاقات والصناديق.', s.surfaceColor) +
          '</div>',
        'colors'
      ) +
      section(
        'logos',
        'fa-image',
        'الشعار والصور',
        'أصول الهوية البصرية وأماكن ظهورها.',
        'الهيدر والقائمة وصفحة الدخول',
        '<div class="sac-media-grid">' +
          mediaCard('logoMain', 'الشعار الرئيسي', 'يظهر في الهيدر والقائمة الجانبية.', s.logoMain, 'PNG/SVG شفاف · حتى 800KB') +
          mediaCard('logoLight', 'شعار للخلفيات الداكنة', 'نسخة فاتحة على خلفيات سوداء.', s.logoLight, 'PNG شفاف · حتى 800KB') +
          mediaCard('logoDark', 'شعار للخلفيات الفاتحة', 'نسخة داكنة على خلفيات بيضاء.', s.logoDark, 'PNG شفاف · حتى 800KB') +
          mediaCard('faviconUrl', 'أيقونة المتصفح', 'أيقونة تبويب المتصفح.', s.faviconUrl, 'PNG مربّع 64×64') +
          mediaCard('loginImage', 'صورة صفحة الدخول', 'خلفية أو صورة شاشة الدخول.', s.loginImage, 'JPG/WEBP · حتى 1.2MB') +
          mediaCard('dashboardImage', 'صورة لوحة التحكم', 'صورة اختيارية لرأس غرفة العمليات.', s.dashboardImage, 'JPG/WEBP · حتى 1.2MB') +
          '</div>',
        'logos'
      ) +
      section(
        'banners',
        'fa-panorama',
        'البنرات والمحتوى المرئي',
        'أدر بنرات الصفحات والإعلانات بسهولة.',
        'المواضع التي تختارها لكل بنر',
        '<div class="sac-banner-toolbar"><p>كل بنر بطاقة واضحة: معاينة، مكان العرض، الحالة، والتواريخ.</p><button type="button" class="btn btn-primary" data-action="add-banner"><i class="fas fa-plus"></i> إضافة بنر جديد</button></div><div class="sac-banner-list" id="sac-banner-list">' +
          (banners.length
            ? banners.map(bannerCard).join('')
            : '<p class="sac-empty">لا توجد بنرات بعد — اضغط «إضافة بنر جديد».</p>') +
          '</div><input type="hidden" data-set="banners" id="sac-banners-json" value="' +
          esc(JSON.stringify(banners)) +
          '" />' +
          bannerModalHtml(),
        'banners'
      ) +
      section(
        'locale',
        'fa-globe',
        'اللغة والمنطقة والعملة',
        'عرض التواريخ والأوقات والعملة ولغة الواجهة.',
        'التقارير والتنبيهات والأسعار',
        '<div class="sac-grid-2">' +
          field({
            key: 'locale',
            label: 'لغة الواجهة',
            help: 'اللغة الأساسية لغرفة العمليات.',
            type: 'select',
            value: s.locale,
            options: [
              { value: 'ar', label: 'العربية' },
              { value: 'en', label: 'English' },
            ],
          }) +
          field({
            key: 'timezone',
            label: 'المنطقة الزمنية',
            help: 'تؤثر على أوقات العمليات والتقارير.',
            type: 'select',
            value: s.timezone,
            options: [
              { value: 'Asia/Riyadh', label: 'الرياض' },
              { value: 'Asia/Dubai', label: 'دبي' },
              { value: 'Africa/Cairo', label: 'القاهرة' },
              { value: 'Asia/Kuwait', label: 'الكويت' },
              { value: 'UTC', label: 'UTC' },
            ],
          }) +
          field({
            key: 'dateFormat',
            label: 'صيغة التاريخ',
            help: 'كيف تظهر التواريخ في السجلات.',
            type: 'select',
            value: s.dateFormat,
            options: [
              { value: 'ar-EG', label: 'عربي (يوم شهر)' },
              { value: 'ar-SA', label: 'عربي — السعودية' },
              { value: 'en-GB', label: 'English (DD/MM)' },
              { value: 'en-US', label: 'English (US)' },
            ],
          }) +
          field({
            key: 'currency',
            label: 'العملة المعروضة',
            help: 'العملة الافتراضية للأسعار.',
            type: 'select',
            value: s.currency,
            options: [
              { value: 'USD', label: 'دولار USD' },
              { value: 'SAR', label: 'ريال SAR' },
              { value: 'AED', label: 'درهم AED' },
            ],
          }) +
          '</div>'
      ) +
      section(
        'interface',
        'fa-compass',
        'الواجهة والتنقل',
        'خيارات تسهّل الاستخدام اليومي.',
        'القائمة الجانبية والحركة',
        toggle('compactSidebar', 'قائمة جانبية مضغوطة', 'تصغّر الشريط الجانبي لإظهار مساحة أكبر للمحتوى.', !!s.compactSidebar) +
          toggle('reduceMotion', 'تقليل الحركة', 'يوقف التحريكات لواجهة أهدأ.', !!s.reduceMotion)
      ) +
      section(
        'notify',
        'fa-bell',
        'الإشعارات',
        'أنواع التنبيهات في مركز إشعارات هوب.',
        'مركز الإشعارات',
        toggle('notifyInApp', 'إشعارات داخل هوب', 'إن أُوقفت لن تُضاف تنبيهات جديدة إلى مركز الإشعارات.', !!s.notifyInApp) +
          toggle('notifyEmail', 'إشعارات البريد (سياسة)', 'تُحفظ كسياسة للنظام — الإرسال الفعلي عند ربط البريد.', !!s.notifyEmail) +
          toggle('notifySecurity', 'تنبيهات الأمن', 'حوادث حرجة وتصنيفات أمنية.', !!s.notifySecurity) +
          toggle('notifyOps', 'تنبيهات التشغيل', 'فئة ops في مركز الإشعارات.', !!s.notifyOps)
      ) +
      section(
        'ai',
        'fa-robot',
        'الذكاء الاصطناعي والمساعد',
        'المساعد الذكي والتدفق الحي للنشاط.',
        'زر الروبوت وسجل النشاط',
        toggle('aiAssistantEnabled', 'المساعد الذكي', 'الزر العائم للروبوت داخل المنصة.', !!s.aiAssistantEnabled, 'ذكاء روبوت') +
          toggle('liveFeedEnabled', 'التدفق الحي', 'سجل النشاط اللحظي في لوحة النظرة العامة.', !!s.liveFeedEnabled)
      ) +
      section(
        'security',
        'fa-shield-halved',
        'الأمن والجلسات',
        'حماية الدخول ومدة الجلسة.',
        'تسجيل الدخول والخروج التلقائي',
        field({
          key: 'sessionMinutes',
          label: 'مدة الجلسة (دقيقة)',
          help: 'بعد هذه المدة من الخمول قد يُطلب تسجيل الدخول مجددًا.',
          type: 'number',
          min: 5,
          max: 1440,
          value: s.sessionMinutes,
          search: 'جلسة',
        }) +
          toggle('autoLogoutIdle', 'خروج تلقائي عند الخمول', 'يغلق الجلسة بعد انتهاء المدة دون نشاط.', !!s.autoLogoutIdle) +
          toggle('requireMfa', 'إلزام التحقق المتعدد MFA', 'سياسة داخلية تُعرض للمشغّلين.', !!s.requireMfa),
        'session'
      ) +
      section(
        'ops',
        'fa-gears',
        'التشغيل والمزامنة',
        'جدولة المزامنة والمنح والرفع والمتجر.',
        'غرفة العمليات والمتجر',
        '<div class="sac-grid-2">' +
          field({
            key: 'autoSyncMinutes',
            label: 'مزامنة تلقائية كل (دقيقة)',
            help: 'صفر = إيقاف الجدولة. الافتراضي 15.',
            type: 'number',
            min: 0,
            max: 1440,
            value: s.autoSyncMinutes,
          }) +
          field({
            key: 'defaultGrantPlan',
            label: 'خطة المنح الافتراضية',
            help: 'عند منح اشتراك نظام جديد.',
            type: 'select',
            value: s.defaultGrantPlan,
            options: [
              { value: 'standard', label: 'standard' },
              { value: 'professional', label: 'professional' },
              { value: 'enterprise', label: 'enterprise' },
            ],
          }) +
          field({
            key: 'activityRetainDays',
            label: 'احتفاظ سجل النشاط (يوم)',
            help: 'بعدها يمكن تنظيف السجلات القديمة.',
            type: 'number',
            min: 7,
            max: 3650,
            value: s.activityRetainDays,
          }) +
          field({
            key: 'maxUploadMb',
            label: 'الرفع والملفات — الحد الأقصى (ميجابايت)',
            help: 'سقف النظام 150MB.',
            type: 'number',
            min: 1,
            max: 150,
            value: s.maxUploadMb,
            search: 'رفع',
          }) +
          field({
            key: 'shopDefaultCategory',
            label: 'المتجر والمنتجات — التصنيف الافتراضي',
            help: 'يُفتح افتراضيًا في المنتجات.',
            type: 'select',
            value: s.shopDefaultCategory,
            options: catOpts,
          }) +
          '</div><label class="sac-toggle is-locked"><input type="checkbox" data-set="excludeKonzoo" checked disabled /><span class="sac-toggle-ui"><i></i></span><span class="sac-toggle-copy"><strong>استبعاد كونزو من المنتجات</strong><small>سياسة ثابتة في هوب.</small></span><span class="sac-toggle-state">ثابت</span></label>' +
          toggle('searchIndexEnabled', 'البحث والتسجيل — فهرس المحتوى', 'إن أُوقف لا يظهر محتوى إدارة البحث في المحرك الشامل.', !!s.searchIndexEnabled) +
          toggle('allowPublicRegister', 'السماح بالتسجيل العام', 'سياسة «سجل معنا» للمستأجرين الجدد.', !!s.allowPublicRegister)
      ) +
      section(
        'advanced',
        'fa-screwdriver-wrench',
        'إعدادات متقدمة وحساسة',
        'الصيانة والاستيراد/التصدير وإعادة الضبط.',
        'شريط الصيانة ونسخة الإعدادات',
        toggle('maintenanceMode', 'تفعيل وضع الصيانة', 'يظهر شريط تنبيه أعلى غرفة العمليات.', !!s.maintenanceMode, 'صيانة') +
          field({
            key: 'maintenanceMessage',
            label: 'رسالة الصيانة',
            help: 'النص الذي يراه المشغّلون على شريط التنبيه.',
            type: 'textarea',
            rows: 3,
            value: s.maintenanceMessage,
          }) +
          '<div class="sac-danger card"><h4><i class="fas fa-triangle-exclamation"></i> منطقة حساسة</h4><p>التصفير يعيد القيم الافتراضية فقط دون مسح بقية بيانات هوب.</p><div class="settings-actions"><button type="button" class="btn btn-primary" data-action="save-settings"><i class="fas fa-floppy-disk"></i> حفظ</button><button type="button" class="btn btn-dark" data-action="export-settings"><i class="fas fa-download"></i> تصدير JSON</button><label class="btn btn-ghost" style="cursor:pointer"><i class="fas fa-upload"></i> استيراد JSON<input id="settings-import" type="file" accept="application/json,.json" hidden data-hub-skip-limit /></label><button type="button" class="btn btn-ghost danger" data-action="reset-settings"><i class="fas fa-rotate-left"></i> إعادة للافتراضي</button></div></div><p class="sac-help">صفحات الإدارة المرتبطة:</p><div class="settings-links" style="margin-top:12px"><a class="btn btn-ghost" href="roles-permissions.html"><i class="fas fa-shield-alt"></i> الأدوار والصلاحيات</a><a class="btn btn-ghost" href="search-admin.html"><i class="fas fa-magnifying-glass"></i> إدارة محرك البحث</a><a class="btn btn-ghost" href="system-ops.html"><i class="fas fa-server"></i> تشغيل الأنظمة</a><a class="btn btn-ghost" href="rent-admin.html"><i class="fas fa-key"></i> موافقة السوبر أدمن</a></div>',
        'maintenance'
      ) +
      '</div></div></div>'
    );
  }

  function bannerModalHtml() {
    return (
      '<div class="sac-modal hidden" id="sac-banner-modal" role="dialog" aria-modal="true"><div class="sac-modal-card"><header><h4 id="sac-banner-modal-title">بنر جديد</h4><button type="button" class="btn btn-ghost sac-mini" data-action="close-banner-modal" aria-label="إغلاق">✕</button></header><div class="sac-grid-2"><div class="sac-field"><label>اسم البنر</label><input id="bnr-name" /></div><div class="sac-field"><label>مكان العرض</label><select id="bnr-location">' +
      LOCATIONS.map(function (l) {
        return '<option value="' + esc(l.id) + '">' + esc(l.label) + '</option>';
      }).join('') +
      '</select></div><div class="sac-field"><label>العنوان</label><input id="bnr-title" /></div><div class="sac-field"><label>ترتيب الظهور</label><input id="bnr-order" type="number" min="1" value="1" /></div><div class="sac-field sac-span-2"><label>الوصف</label><textarea id="bnr-desc" rows="2"></textarea></div><div class="sac-field"><label>نص الزر</label><input id="bnr-btn-text" /></div><div class="sac-field"><label>رابط الزر</label><input id="bnr-btn-url" placeholder="https://" /></div><div class="sac-field"><label>تاريخ البداية</label><input id="bnr-start" type="date" /></div><div class="sac-field"><label>تاريخ النهاية</label><input id="bnr-end" type="date" /></div><div class="sac-field sac-span-2"><label>رابط فيديو (اختياري)</label><input id="bnr-video" placeholder="https://..." /></div><div class="sac-field sac-span-2"><label>صورة البنر</label><input id="bnr-image-file" type="file" accept="image/*" /><input type="hidden" id="bnr-image-data" /><div class="sac-modal-preview" id="bnr-image-preview"></div></div><label class="sac-toggle"><input type="checkbox" id="bnr-enabled" checked /><span class="sac-toggle-ui"><i></i></span><span class="sac-toggle-copy"><strong>تفعيل البنر</strong><small>إن أُوقف لن يظهر للمستخدمين.</small></span></label></div><footer><button type="button" class="btn btn-ghost" data-action="close-banner-modal">إلغاء</button><button type="button" class="btn btn-primary" data-action="save-banner-modal">حفظ البنر</button></footer><input type="hidden" id="bnr-edit-id" value="" /></div></div>'
    );
  }

  function collectDraft(root) {
    var patch = {};
    root.querySelectorAll('[data-set]').forEach(function (el) {
      var key = el.dataset.set;
      if (!key || el.disabled) return;
      if (key === 'banners') {
        try {
          patch.banners = JSON.parse(el.value || '[]');
        } catch (e) {
          patch.banners = [];
        }
        return;
      }
      patch[key] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return patch;
  }

  function markDirty(root, dirty) {
    var center = root.querySelector('#settings-admin-center') || root;
    center.dataset.dirty = dirty ? '1' : '0';
    var bar = root.querySelector('#sac-dirty-bar');
    if (bar) bar.classList.toggle('hidden', !dirty);
  }

  function readBanners(root) {
    try {
      return JSON.parse(root.querySelector('#sac-banners-json').value || '[]');
    } catch (e) {
      return [];
    }
  }

  function writeBanners(root, list) {
    var input = root.querySelector('#sac-banners-json');
    if (input) input.value = JSON.stringify(list || []);
    var wrap = root.querySelector('#sac-banner-list');
    if (wrap) {
      wrap.innerHTML = list && list.length ? list.map(bannerCard).join('') : '<p class="sac-empty">لا توجد بنرات بعد — اضغط «إضافة بنر جديد».</p>';
    }
    markDirty(root, true);
    refreshPreview(root);
  }

  function refreshPreview(root) {
    var d = collectDraft(root);
    var stage = root.querySelector('.sac-preview-stage');
    if (stage) {
      stage.style.setProperty('--sac-primary', d.primaryColor || '#d70000');
      stage.style.setProperty('--sac-secondary', d.secondaryColor || '#0a0a0a');
      stage.style.setProperty('--sac-accent', d.accentColor || '#8a000c');
      stage.style.setProperty('--sac-bg', d.bgColor || '#f4f4f5');
      stage.style.setProperty('--sac-text', d.textColor || '#111');
      stage.style.setProperty('--sac-surface', d.surfaceColor || '#fff');
    }
    var logo = d.logoMain || 'assets/logo-hub.jpeg';
    root.querySelectorAll('[data-preview-logo], [data-sum-logo]').forEach(function (img) {
      img.src = logo;
    });
    var name = root.querySelector('[data-preview-name]');
    if (name) name.textContent = d.orgNameEn || 'NAIOSH HUB';
    var tag = root.querySelector('[data-preview-tag]');
    if (tag) tag.textContent = d.orgTagline || '';
    var title = root.querySelector('[data-preview-title]');
    if (title) title.textContent = d.orgNameAr || 'نايوش هوب';
    var sumOrg = root.querySelector('[data-sum-org]');
    if (sumOrg) sumOrg.textContent = d.orgNameAr || '';
    var sumEn = root.querySelector('[data-sum-org-en]');
    if (sumEn) sumEn.textContent = d.orgNameEn || '';
    var bannerBox = root.querySelector('[data-preview-banner]');
    if (bannerBox) {
      var hit = (d.banners || []).find(function (b) {
        return b.enabled && b.imageDataUrl;
      });
      bannerBox.innerHTML = hit ? '<img src="' + esc(hit.imageDataUrl) + '" alt="" />' : '<span>مثال بنر ترويجي</span>';
    }
  }

  function applyLiveChrome(root) {
    var d = collectDraft(root);
    var r = document.documentElement;
    if (d.primaryColor) r.style.setProperty('--hub-brand-primary', d.primaryColor);
    if (d.secondaryColor) r.style.setProperty('--hub-brand-secondary', d.secondaryColor);
    if (d.accentColor) r.style.setProperty('--hub-brand-accent', d.accentColor);
    if (d.bgColor) r.style.setProperty('--hub-brand-bg', d.bgColor);
    if (d.textColor) r.style.setProperty('--hub-brand-text', d.textColor);
    if (d.surfaceColor) r.style.setProperty('--hub-brand-surface', d.surfaceColor);
    var brandImg = document.querySelector('.sidebar-brand img');
    if (brandImg && d.logoMain) brandImg.src = d.logoMain;
    if (d.faviconUrl) {
      var fav = document.querySelector('link[rel="icon"]');
      if (!fav) {
        fav = document.createElement('link');
        fav.rel = 'icon';
        document.head.appendChild(fav);
      }
      fav.href = d.faviconUrl;
    }
  }

  function readFileAsDataUrl(file, maxBytes) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('لا ملف'));
      if (file.size > maxBytes) return reject(new Error('الحجم أكبر من المسموح (' + Math.round(maxBytes / 1024) + 'KB)'));
      if (!/^image\//.test(file.type) && !/\.(png|jpe?g|webp|svg)$/i.test(file.name || '')) {
        return reject(new Error('صيغة غير مدعومة. استخدم PNG أو JPG أو WEBP أو SVG.'));
      }
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ''));
      };
      reader.onerror = function () {
        reject(new Error('تعذّر قراءة الملف'));
      };
      reader.readAsDataURL(file);
    });
  }

  function openBannerModal(root, banner) {
    var modal = root.querySelector('#sac-banner-modal');
    if (!modal) return;
    root.querySelector('#sac-banner-modal-title').textContent = banner ? 'تعديل البنر' : 'بنر جديد';
    root.querySelector('#bnr-edit-id').value = banner && banner.id ? banner.id : '';
    root.querySelector('#bnr-name').value = (banner && banner.name) || '';
    root.querySelector('#bnr-title').value = (banner && banner.title) || '';
    root.querySelector('#bnr-desc').value = (banner && banner.description) || '';
    root.querySelector('#bnr-btn-text').value = (banner && banner.buttonText) || '';
    root.querySelector('#bnr-btn-url').value = (banner && banner.buttonUrl) || '';
    root.querySelector('#bnr-location').value = (banner && banner.location) || 'homepage';
    root.querySelector('#bnr-start').value = (banner && banner.startDate) || '';
    root.querySelector('#bnr-end').value = (banner && banner.endDate) || '';
    root.querySelector('#bnr-order').value = (banner && banner.order) || 1;
    root.querySelector('#bnr-video').value = (banner && banner.videoUrl) || '';
    root.querySelector('#bnr-image-data').value = (banner && banner.imageDataUrl) || '';
    root.querySelector('#bnr-enabled').checked = banner ? banner.enabled !== false : true;
    root.querySelector('#bnr-image-preview').innerHTML =
      banner && banner.imageDataUrl ? '<img src="' + esc(banner.imageDataUrl) + '" alt="" />' : '';
    modal.classList.remove('hidden');
  }

  function closeBannerModal(root) {
    var modal = root.querySelector('#sac-banner-modal');
    if (modal) modal.classList.add('hidden');
  }

  function bind(root, api) {
    api = api || {};
    var toast = api.toast;
    var onRequestRender = api.onRequestRender;
    if (!root.querySelector('#settings-admin-center')) return;

    function setStatus(key, msg, ok) {
      var el = root.querySelector('[data-media-status="' + key + '"]');
      if (!el) return;
      el.textContent = msg || '';
      el.classList.toggle('ok', !!ok);
      el.classList.toggle('err', !!msg && !ok);
    }

    root.addEventListener('input', function (e) {
      if (!e.target.closest('#settings-admin-center')) return;
      if (e.target.id === 'sac-search') {
        var q = e.target.value.trim().toLowerCase();
        var hits = 0;
        root.querySelectorAll('[data-search]').forEach(function (el) {
          var show = !q || (el.getAttribute('data-search') || '').toLowerCase().indexOf(q) !== -1;
          el.classList.toggle('sac-search-hide', !show);
          if (show) hits += 1;
        });
        root.querySelectorAll('.sac-section').forEach(function (sec) {
          var any = Array.prototype.some.call(sec.querySelectorAll('[data-search]'), function (el) {
            return !el.classList.contains('sac-search-hide');
          });
          sec.classList.toggle('sac-search-hide', !!q && !any);
        });
        var hint = root.querySelector('#sac-search-hint');
        if (hint) hint.hidden = !q || hits > 0;
        return;
      }
      if (e.target.matches('[data-color-for]')) {
        var key = e.target.dataset.colorFor;
        var hex = root.querySelector('[data-set="' + key + '"]');
        if (hex) hex.value = e.target.value;
        var sw = root.querySelector('[data-swatch-for="' + key + '"]');
        if (sw) sw.style.background = e.target.value;
      }
      if (e.target.classList.contains('sac-hex')) {
        var hkey = e.target.dataset.set;
        var val = e.target.value.trim();
        if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)) {
          var picker = root.querySelector('[data-color-for="' + hkey + '"]');
          if (picker) {
            picker.value =
              val.length === 4 ? '#' + val[1] + val[1] + val[2] + val[2] + val[3] + val[3] : val;
          }
          var sw2 = root.querySelector('[data-swatch-for="' + hkey + '"]');
          if (sw2) sw2.style.background = val;
        }
      }
      if (e.target.matches('[data-set]') || e.target.matches('[data-color-for]')) {
        markDirty(root, true);
        refreshPreview(root);
        applyLiveChrome(root);
        if (e.target.type === 'checkbox') {
          var lab = e.target.closest('.sac-toggle');
          if (lab && !lab.classList.contains('is-locked')) {
            lab.classList.toggle('is-on', e.target.checked);
            var st = lab.querySelector('.sac-toggle-state');
            if (st) st.textContent = e.target.checked ? 'مفعّل' : 'إيقاف';
          }
        }
      }
    });

    root.addEventListener('change', function (e) {
      var upload = e.target.closest('[data-media-upload]');
      if (upload && upload.files && upload.files[0]) {
        var ukey = upload.dataset.mediaUpload;
        var max = ukey.indexOf('logo') !== -1 || ukey === 'faviconUrl' ? 800 * 1024 : 1200 * 1024;
        readFileAsDataUrl(upload.files[0], max)
          .then(function (dataUrl) {
            var hidden = root.querySelector('.sac-media[data-media-key="' + ukey + '"] [data-set="' + ukey + '"]');
            if (hidden) hidden.value = dataUrl;
            var box = root.querySelector('.sac-media[data-media-key="' + ukey + '"] .sac-media-preview');
            if (box) {
              box.classList.add('has-img');
              box.innerHTML = '<img src="' + dataUrl + '" alt="" />';
            }
            setStatus(ukey, 'تم تجهيز الصورة — احفظ التغييرات.', true);
            markDirty(root, true);
            refreshPreview(root);
            applyLiveChrome(root);
          })
          .catch(function (err) {
            setStatus(ukey, err.message || 'فشل الرفع', false);
            if (toast) toast(err.message || 'فشل الرفع');
          });
        upload.value = '';
      }
      var bnrFile = e.target.closest('#bnr-image-file');
      if (bnrFile && bnrFile.files && bnrFile.files[0]) {
        readFileAsDataUrl(bnrFile.files[0], 1200 * 1024)
          .then(function (dataUrl) {
            root.querySelector('#bnr-image-data').value = dataUrl;
            root.querySelector('#bnr-image-preview').innerHTML = '<img src="' + dataUrl + '" alt="" />';
          })
          .catch(function (err) {
            if (toast) toast(err.message || 'فشل رفع صورة البنر');
          });
      }
    });

    root.addEventListener('click', function (e) {
      var jump = e.target.closest('[data-action="sac-jump"]');
      if (jump) {
        root.querySelectorAll('.sac-nav button').forEach(function (b) {
          b.classList.toggle('is-active', b === jump);
        });
        var target = root.querySelector('#sac-' + jump.dataset.target);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      var helpBtn = e.target.closest('[data-action="settings-help"]');
      if (helpBtn) {
        if (toast) toast(HELP[helpBtn.dataset.helpKey] || 'اتبع النص التوضيحي بجانب كل حقل ثم احفظ.');
        return;
      }

      var resetColor = e.target.closest('[data-action="reset-color"]');
      if (resetColor) {
        var ckey = resetColor.dataset.colorKey;
        var def = resetColor.dataset.default || '#d70000';
        var hexEl = root.querySelector('[data-set="' + ckey + '"]');
        var pickerEl = root.querySelector('[data-color-for="' + ckey + '"]');
        var swEl = root.querySelector('[data-swatch-for="' + ckey + '"]');
        if (hexEl) hexEl.value = def;
        if (pickerEl) pickerEl.value = def;
        if (swEl) swEl.style.background = def;
        markDirty(root, true);
        refreshPreview(root);
        applyLiveChrome(root);
        return;
      }

      var clearMedia = e.target.closest('[data-action="clear-media"]');
      if (clearMedia) {
        var mkey = clearMedia.dataset.mediaKey;
        var hidden = root.querySelector('.sac-media[data-media-key="' + mkey + '"] [data-set="' + mkey + '"]');
        if (hidden) hidden.value = '';
        var box = root.querySelector('.sac-media[data-media-key="' + mkey + '"] .sac-media-preview');
        if (box) {
          box.classList.remove('has-img');
          box.innerHTML =
            '<div class="sac-drop"><i class="fas fa-cloud-arrow-up"></i><span>اسحب صورة أو اضغط رفع</span></div>';
        }
        setStatus(mkey, 'تمت الإزالة — احفظ للتأكيد.', true);
        markDirty(root, true);
        refreshPreview(root);
        applyLiveChrome(root);
        return;
      }

      if (e.target.closest('[data-action="add-banner"]')) {
        openBannerModal(root, null);
        return;
      }
      if (e.target.closest('[data-action="close-banner-modal"]')) {
        closeBannerModal(root);
        return;
      }
      if (e.target.closest('[data-action="save-banner-modal"]')) {
        var name = (root.querySelector('#bnr-name').value || '').trim();
        if (!name) return toast && toast('اسم البنر مطلوب');
        var url = (root.querySelector('#bnr-btn-url').value || '').trim();
        if (url && !/^https?:\/\//i.test(url) && url.charAt(0) !== '/') {
          return toast && toast('أدخل رابطًا صحيحًا يبدأ بـ http أو /');
        }
        var list = readBanners(root);
        var editId = root.querySelector('#bnr-edit-id').value || '';
        var row = {
          id: editId || 'bnr-' + Date.now().toString(36),
          name: name,
          title: (root.querySelector('#bnr-title').value || '').trim(),
          description: (root.querySelector('#bnr-desc').value || '').trim(),
          buttonText: (root.querySelector('#bnr-btn-text').value || '').trim(),
          buttonUrl: url || '',
          location: root.querySelector('#bnr-location').value || 'homepage',
          startDate: root.querySelector('#bnr-start').value || '',
          endDate: root.querySelector('#bnr-end').value || '',
          order: Number(root.querySelector('#bnr-order').value) || 1,
          videoUrl: (root.querySelector('#bnr-video').value || '').trim(),
          imageDataUrl: root.querySelector('#bnr-image-data').value || '',
          enabled: !!root.querySelector('#bnr-enabled').checked,
        };
        var idx = -1;
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === row.id) idx = i;
        }
        if (idx >= 0) list[idx] = row;
        else list.push(row);
        writeBanners(root, list);
        closeBannerModal(root);
        if (toast) toast('تم تجهيز البنر — احفظ التغييرات');
        return;
      }

      var card = e.target.closest('[data-banner-id]');
      var bid = card && card.dataset.bannerId;
      if (bid && e.target.closest('[data-action="edit-banner"]')) {
        var found = readBanners(root).filter(function (b) {
          return b.id === bid;
        })[0];
        if (found) openBannerModal(root, found);
        return;
      }
      if (bid && e.target.closest('[data-action="toggle-banner"]')) {
        writeBanners(
          root,
          readBanners(root).map(function (b) {
            return b.id === bid ? Object.assign({}, b, { enabled: !b.enabled }) : b;
          })
        );
        return;
      }
      if (bid && e.target.closest('[data-action="duplicate-banner"]')) {
        var list2 = readBanners(root);
        var src = list2.filter(function (b) {
          return b.id === bid;
        })[0];
        if (!src) return;
        list2.push(
          Object.assign({}, src, {
            id: 'bnr-' + Date.now().toString(36),
            name: src.name + ' (نسخة)',
            enabled: false,
          })
        );
        writeBanners(root, list2);
        return;
      }
      if (bid && e.target.closest('[data-action="delete-banner"]')) {
        if (!confirm('حذف هذا البنر؟ يمكنك التراجع بتجاهل التغييرات قبل الحفظ.')) return;
        writeBanners(
          root,
          readBanners(root).filter(function (b) {
            return b.id !== bid;
          })
        );
        return;
      }

      if (e.target.closest('[data-action="discard-settings"]')) {
        if (!confirm('تجاهل كل التغييرات غير المحفوظة؟')) return;
        if (onRequestRender) onRequestRender();
      }
    });
  }

  window.HubSettingsCenter = {
    render: render,
    bind: bind,
    collectDraft: collectDraft,
    applyLiveChrome: applyLiveChrome,
    HELP: HELP,
  };
})();
