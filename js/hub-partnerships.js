/**
 * صفحة الشراكات — بدل توجيه شراكاتي للمتجر فقط
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-hub-partnerships]');
  if (!root) return;
  window.HubTenant?.mountBanner?.(root);

  const PARTNERS = [
    {
      title: 'شراكة تشغيل منصة',
      desc: 'اربط منصتك بهوب وفعّل الاشتراك والصلاحيات والرصيد الموحّد.',
      href: 'store.html',
      cta: 'اطلب من المتجر',
    },
    {
      title: 'شراكة أكاديمية / تدريب',
      desc: 'دورات ودبلومات عبر الأكاديمية مع إعادة توجيه للنظام الحي.',
      href: 'diplomas.html',
      cta: 'عرض الدبلومات',
    },
    {
      title: 'شراكة تسويق وإعلانات',
      desc: 'ظهور منتجاتك وإعلاناتك داخل هوب والفروع والمنصات.',
      href: 'ads.html',
      cta: 'استوديو الإعلانات',
    },
    {
      title: 'شراكة فروع وحاضنات',
      desc: 'انضم كفرع أو حاضنة ضمن شبكة نايوش العالمية.',
      href: 'trial.html',
      cta: 'ابدأ الانضمام',
    },
  ];

  const grid = root.querySelector('[data-partnerships-grid]');
  if (grid) {
    grid.innerHTML = PARTNERS.map(
      (p) => `<article class="hub-feature-card">
        <div class="hub-feature-card-top">
          <span class="hub-feature-icon"><i class="fas fa-handshake"></i></span>
          <h3>${p.title}</h3>
        </div>
        <p>${p.desc}</p>
        <div class="hub-feature-actions">
          <a class="btn btn-primary" href="${p.href}">${p.cta}</a>
          <a class="btn btn-secondary" href="office.html">عودة لمكتبي</a>
        </div>
      </article>`
    ).join('');
  }
})();
