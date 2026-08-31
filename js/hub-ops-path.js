/**
 * شريط طريقة التشغيل على صفحات الواجهة — يسهّل على العميل
 */
(() => {
  const PATHS = {
    home: {
      title: 'طريقة التشغيل على الرئيسية',
      steps: ['اضغط موقع جاهز من المعرض أو الشريط الجانبي', 'تدخل الموقع مباشرة', 'اشترِ من المتجر لتفعيل صلاحية كاملة'],
    },
    products: {
      title: 'طريقة تشغيل المنتجات',
      headline: 'دخول فوري مجاني.. دون الحاجة إلى بطاقة ائتمانية',
      steps: ['تصفّح المنتج', 'اضغط «ادخل الموقع» للتجربة', 'أو «اشترِ» — المتجر يفعّل الاشتراك ويفتح موقعك'],
      links: [
        { href: 'store.html', icon: 'fa-cart-shopping', label: 'اشتر الآن' },
        { href: 'operating.html', icon: 'fa-bolt', label: 'طريقة التشغيل' },
        { href: 'apps.html', icon: 'fa-power-off', label: 'ادخل موقعك جاهزاً' },
      ],
    },
    store: {
      title: 'طريقة تشغيل المتجر',
      steps: ['اختر الباقة/المنتج', 'اضغط «اشترِ الآن»', 'بعد الشراء يظهر زر «ادخل موقعك» للتشغيل فورًا'],
    },
    ads: {
      title: 'طريقة تشغيل الإعلانات',
      steps: [
        'اختر المستوى: مكتب · منصة · حاضنة · فرع',
        'حدّد خيارات العرض (واجهة رئيسية / كل الطبقة أو عناصر)',
        'اختر مكان الظهور على الصفحة الرئيسية للمستوى ثم انشر',
      ],
    },
    events: {
      title: 'طريقة تشغيل الفعاليات',
      steps: ['استعرض الفعاليات', 'اربطها بالمتجر أو المنصة', 'تابع الحالة من هوب'],
    },
    apps: {
      title: 'طريقة تشغيل الأنظمة',
      steps: ['اضغط أيقونة النظام', 'يفتح الموقع الجاهز مباشرة', 'ارفع بياناته وإشعاراته لهوب'],
    },
    platforms: {
      title: 'طريقة تشغيل المنصات',
      steps: ['اختر منصتك', 'ادخل التفاصيل', 'اربطها بالفروع والحاضنات من هوب'],
    },
    branches: {
      title: 'طريقة تشغيل الفروع',
      steps: ['ابحث عن فرعك', 'ادخل صفحة الفرع', 'اربط الإعلانات والمنتجات من هوب'],
    },
    incubators: {
      title: 'طريقة تشغيل الحاضنات',
      steps: ['اختر الحاضنة', 'ادخل البرنامج', 'أنشئ إعلانًا أو منتجًا مرتبطًا'],
    },
    operating: {
      title: 'آلية التشغيل الكاملة',
      steps: ['سجّل دخول موحّد', 'افتح تشغيل الأنظمة ونفّذ المنح والأدوار', 'فعّل وحدات ERPI/القانونية وادخل النظام الحي'],
    },
    'system-ops': {
      title: 'تشغيل الأنظمة من ملف العميل',
      steps: ['امنح دومين فرعي أو هيكل', 'عيّن الأدوار والصلاحيات', 'فعّل وحدات ERPI والقانونية وافتح نظام المستأجر'],
    },
  };

  const resolveKey = () => {
    const path = (window.location.pathname || '').toLowerCase();
    const page = document.body?.dataset?.marketPage || document.body?.dataset?.hubEntity || '';
    if (page && PATHS[page]) return page;
    if (path.includes('system-ops') || path.includes('system_ops')) return 'system-ops';
    if (path.includes('operating')) return 'operating';
    if (path.includes('product')) return 'products';
    if (path.includes('store')) return 'store';
    if (path.includes('ads')) return 'ads';
    if (path.includes('event')) return 'events';
    if (path.includes('apps')) return 'apps';
    if (path.includes('platform')) return 'platforms';
    if (path.includes('branch')) return 'branches';
    if (path.includes('incubator')) return 'incubators';
    if (path.endsWith('/') || path.includes('index')) return 'home';
    return '';
  };

  const mount = () => {
    const key = resolveKey();
    const cfg = PATHS[key];
    if (!cfg) return;
    if (document.querySelector('.hub-ops-path')) return;

    const el = document.createElement('aside');
    el.className = cfg.headline ? 'hub-ops-path hub-ops-path--instant' : 'hub-ops-path';
    el.setAttribute('aria-label', cfg.headline || 'طريقة التشغيل');
    const links = cfg.links || [
      { href: 'store.html', icon: 'fa-bag-shopping', label: 'اشترِ الآن' },
      { href: 'operating.html', icon: 'fa-gears', label: 'آلية التشغيل' },
      { href: 'apps.html', icon: 'fa-bolt', label: 'ادخل موقعًا جاهزًا' },
    ];
    const stepsBlock = cfg.headline
      ? `<div class="hub-instant-steps">
          <strong><i class="fas fa-route"></i> ${cfg.title}</strong>
          <ol>${cfg.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
        </div>`
      : `<strong><i class="fas fa-route"></i> ${cfg.title}</strong>
        <ol>${cfg.steps.map((s) => `<li>${s}</li>`).join('')}</ol>`;
    const headline = cfg.headline ? `<h2 class="hub-instant-title">${cfg.headline}</h2>` : '';
    el.innerHTML = `
      <div class="hub-ops-path-inner${cfg.headline ? ' hub-instant-entry' : ''}">
        ${headline}
        ${stepsBlock}
        <div class="hub-ops-path-links">
          ${links
            .map((l) => `<a href="${l.href}"><i class="fas ${l.icon}"></i> ${l.label}</a>`)
            .join('')}
        </div>
      </div>`;

    const host =
      document.querySelector('.market-hero') ||
      document.querySelector('.shop-top') ||
      document.querySelector('.products-hero') ||
      document.querySelector('.branches-head') ||
      document.querySelector('.incubators-hero') ||
      document.querySelector('.op-hero') ||
      document.querySelector('.hub-product-gallery') ||
      document.querySelector('main.container') ||
      document.querySelector('main');

    if (host?.parentElement && host.classList.contains('hub-product-gallery')) {
      host.parentElement.insertBefore(el, host);
    } else if (host) {
      host.insertAdjacentElement('afterend', el);
    } else {
      document.body.prepend(el);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
