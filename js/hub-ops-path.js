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
      steps: ['تصفّح المنتج', 'اضغط «ادخل الموقع» للتجربة', 'أو «اشتري» → المتجر يفعّل الاشتراك ويفتح موقعك'],
    },
    store: {
      title: 'طريقة تشغيل المتجر',
      steps: ['اختر الباقة/المنتج', 'اضغط «اشترِ الآن»', 'بعد الشراء يظهر زر «ادخل موقعك» للتشغيل فورًا'],
    },
    ads: {
      title: 'طريقة تشغيل الإعلانات',
      steps: ['أضف إعلانًا', 'اختر مكان الرفع (رئيسية/فروع/حاضنات/منصات)', 'احفظ أو أجّل النشر'],
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
      steps: ['تسجيل دخول موحّد', 'اشتراك = صلاحية', 'أيقونة → دخول الموقع الجاهز'],
    },
  };

  const resolveKey = () => {
    const path = (window.location.pathname || '').toLowerCase();
    const page = document.body?.dataset?.marketPage || document.body?.dataset?.hubEntity || '';
    if (page && PATHS[page]) return page;
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
    el.className = 'hub-ops-path';
    el.setAttribute('aria-label', 'طريقة التشغيل');
    el.innerHTML = `
      <div class="hub-ops-path-inner">
        <strong><i class="fas fa-route"></i> ${cfg.title}</strong>
        <ol>${cfg.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
        <div class="hub-ops-path-links">
          <a href="store.html"><i class="fas fa-bag-shopping"></i> اشترِ الآن</a>
          <a href="operating.html"><i class="fas fa-gears"></i> آلية التشغيل</a>
          <a href="apps.html"><i class="fas fa-bolt"></i> ادخل موقعًا جاهزًا</a>
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
