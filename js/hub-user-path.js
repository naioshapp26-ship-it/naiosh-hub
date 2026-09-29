/**
 * مسار المستخدم | نايوش هوب 360 — خطوات عملية تسهّل الاستخدام
 */
(() => {
  'use strict';

  const PAGE_TITLE = 'مسار المستخدم | نايوش هوب 360';

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
      desc: 'فرعي · حاضنتي · مكتبي · إعلاناتي · منتجاتي · شراكاتي.',
      links: [
        { href: 'my-office.html', label: 'مكتبي' },
        { href: 'partnerships.html', label: 'شراكاتي' },
        { href: 'my-branch.html', label: 'فرعي' },
        { href: 'my-platform.html', label: 'منصتي' },
        { href: 'my-channel.html', label: 'قناتي' },
      ],
    },
    {
      id: 'learn',
      title: 'التعلّم والتوجيه للأنظمة',
      desc: 'دوراتي ودبلوماتي الخاصة ثم الأكاديمية.',
      links: [
        { href: 'my-courses.html', label: 'دوراتي' },
        { href: 'my-diplomas.html', label: 'دبلوماتي' },
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

  const ICONS = ['fa-house', 'fa-user-plus', 'fa-wallet', 'fa-briefcase', 'fa-graduation-cap', 'fa-headset'];

  const STATUS_LABEL = {
    done: 'مكتملة',
    current: 'الخطوة الحالية',
    next: 'الخطوة التالية',
    upcoming: 'قادمة',
  };

  const root = document.querySelector('[data-user-path]');
  if (!root) return;

  if (document.title !== PAGE_TITLE) document.title = PAGE_TITLE;

  window.HubTenant?.mountBanner?.(root);

  function isLoggedIn() {
    return !!(window.HubAuth && HubAuth.isLoggedIn && HubAuth.isLoggedIn());
  }

  function balancePoints() {
    return Number(localStorage.getItem('naiosh_hub_balance_points') || 300);
  }

  function cartCount() {
    return window.HubCart?.count?.() || 0;
  }

  function ticketCount() {
    return window.HubSupport?.read?.()?.length || 0;
  }

  /** حالة مبسّطة من بيانات الحساب الحالية بدون مصدر بيانات جديد */
  function resolveStates() {
    const logged = isLoggedIn();
    const hasTenant = !!(window.HubTenant?.read?.());
    const usedWallet = balancePoints() !== 300 || cartCount() > 0;
    const usedSupport = ticketCount() > 0;
    const flags = {
      land: true,
      join: logged,
      wallet: logged && usedWallet,
      tenant: logged && hasTenant,
      learn: false,
      ops: logged && usedSupport,
    };
    const order = STEPS.map((s) => s.id);
    let currentSet = false;
    let nextSet = false;
    const map = {};
    order.forEach((id) => {
      if (flags[id]) {
        map[id] = 'done';
        return;
      }
      if (!currentSet) {
        map[id] = 'current';
        currentSet = true;
        return;
      }
      if (!nextSet) {
        map[id] = 'next';
        nextSet = true;
        return;
      }
      map[id] = 'upcoming';
    });
    return map;
  }

  const tenant = window.HubTenant?.read?.();
  const kpis = root.querySelector('[data-user-path-kpis]');
  if (kpis) {
    kpis.innerHTML = `
      <article class="hub-feature-card"><h3>سياقك الآن</h3><p>${tenant?.nameAr || 'مستأجر تجريبي'}</p></article>
      <article class="hub-feature-card"><h3>الرصيد</h3><p>${balancePoints().toLocaleString('en-US')} نقطة</p></article>
      <article class="hub-feature-card"><h3>السلة</h3><p>${cartCount()} عنصر</p></article>
      <article class="hub-feature-card"><h3>تذاكر الدعم</h3><p>${ticketCount()}</p></article>`;
  }

  const list = root.querySelector('[data-user-path-steps]');
  if (list) {
    const states = resolveStates();
    list.innerHTML = STEPS.map((s, i) => {
      const st = states[s.id] || 'upcoming';
      return `<article class="hub-feature-card up-step-card is-${st}" data-up-step="${s.id}">
        <div class="hub-feature-card-top">
          <span class="up-step-num" aria-hidden="true">${i + 1}</span>
          <span class="hub-feature-icon"><i class="fas ${ICONS[i] || 'fa-circle'}"></i></span>
          <h3>${s.title}</h3>
        </div>
        <span class="up-step-status">${STATUS_LABEL[st] || STATUS_LABEL.upcoming}</span>
        <p>${s.desc}</p>
        <div class="hub-feature-actions">
          ${s.links.map((l) => `<a class="btn btn-secondary" href="${l.href}">${l.label}</a>`).join('')}
        </div>
      </article>`;
    }).join('');
  }
})();
