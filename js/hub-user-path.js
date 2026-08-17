/**
 * مسار المستخدم من ملف العميل — خطوات عملية تسهّل الاستخدام
 */
(() => {
  'use strict';

  const STEPS = [
    {
      id: 'land',
      title: 'الهبوط والواجهة',
      desc: 'ابدأ من الرئيسية: مواقع جاهزة · منتجات · أنظمة.',
      links: [
        { href: 'index.html', label: 'الرئيسية' },
        { href: 'products.html', label: 'المنتجات' },
        { href: 'apps.html', label: 'الأنظمة' },
      ],
    },
    {
      id: 'join',
      title: 'انضم وأنشئ حسابًا',
      desc: 'صاحب المنصة يعبّئ سجل معنا. السوبر أدمن يوافق ثم تُمنح الصلاحيات.',
      links: [
        { href: 'register.html', label: 'سجل معنا' },
        { href: 'membership.html', label: 'العضوية' },
        { href: 'trial.html', label: 'تجربة' },
      ],
    },
    {
      id: 'wallet',
      title: 'الرصيد والباقات',
      desc: 'رصيد مجاني ثم شحن موحّد أو اشتراك يفتح النظام.',
      links: [
        { href: 'packages.html', label: 'الباقات' },
        { href: 'index.html#charge', label: 'اشحن رصيد' },
        { href: 'cart.html', label: 'السلة' },
      ],
    },
    {
      id: 'tenant',
      title: 'مساحة المستأجر',
      desc: 'فرعي · حاضنتي · منصتي · مكتبي · إعلاناتي · منتجاتي · شراكاتي.',
      links: [
        { href: 'office.html', label: 'مكتبي' },
        { href: 'partnerships.html', label: 'شراكاتي' },
        { href: 'branches.html', label: 'فرعي' },
        { href: 'platforms.html', label: 'منصتي' },
      ],
    },
    {
      id: 'learn',
      title: 'التعلّم والتوجيه للأنظمة',
      desc: 'دورات ودبلومات ثم إعادة توجيه للأكاديمية / LMS / الأنظمة الحية.',
      links: [
        { href: 'courses.html', label: 'دورات' },
        { href: 'diplomas.html', label: 'دبلومات' },
        { href: 'systems/academy.html', label: 'الأكاديمية' },
      ],
    },
    {
      id: 'ops',
      title: 'التشغيل والدعم',
      desc: 'دردشة · غرفة عمليات · تذاكر صيانة · سياسات · أدلة.',
      links: [
        { href: 'chat.html', label: 'الدردشة' },
        { href: 'support.html', label: 'الدعم والصيانة' },
        { href: 'dashboard.html', label: 'غرفة العمليات' },
        { href: 'policies.html', label: 'السياسات' },
      ],
    },
  ];

  const root = document.querySelector('[data-user-path]');
  if (!root) return;

  window.HubTenant?.mountBanner?.(root);

  const tenant = window.HubTenant?.read?.();
  const kpis = root.querySelector('[data-user-path-kpis]');
  if (kpis) {
    kpis.innerHTML = `
      <article class="hub-feature-card"><h3>سياقك الآن</h3><p>${tenant?.nameAr || 'مستأجر تجريبي'}</p></article>
      <article class="hub-feature-card"><h3>الرصيد</h3><p>${Number(localStorage.getItem('naiosh_hub_balance_points') || 300).toLocaleString('en-US')} نقطة</p></article>
      <article class="hub-feature-card"><h3>السلة</h3><p>${window.HubCart?.count?.() || 0} عنصر</p></article>
      <article class="hub-feature-card"><h3>تذاكر الدعم</h3><p>${window.HubSupport?.read?.()?.length || 0}</p></article>`;
  }

  const list = root.querySelector('[data-user-path-steps]');
  if (list) {
    const icons = ['fa-house', 'fa-user-plus', 'fa-wallet', 'fa-briefcase', 'fa-graduation-cap', 'fa-headset'];
    list.innerHTML = STEPS.map(
      (s, i) => `<article class="hub-feature-card">
        <div class="hub-feature-card-top">
          <span class="hub-feature-icon"><i class="fas ${icons[i] || 'fa-circle'}"></i></span>
          <h3>${i + 1}. ${s.title}</h3>
        </div>
        <p>${s.desc}</p>
        <div class="hub-feature-actions">
          ${s.links.map((l) => `<a class="btn btn-secondary" href="${l.href}">${l.label}</a>`).join('')}
        </div>
      </article>`
    ).join('');
  }
})();
