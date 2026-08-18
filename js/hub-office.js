/**
 * المكتب الإلكتروني للمستأجر
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-hub-office]');
  if (!root) return;

  window.HubTenant?.mountBanner?.(root);
  const t = window.HubTenant?.read?.() || {};

  const shortcuts = [
    { href: 'system-ops.html', icon: 'fa-gears', label: 'تشغيل النظام', desc: 'دومين · أدوار · ERPI · قانونية' },
    { href: 'branches.html', icon: 'fa-code-branch', label: 'فرعي', desc: 'دخول مباشر لفرع المستأجر' },
    { href: 'incubators.html', icon: 'fa-seedling', label: 'حاضنتي', desc: 'حاضنة المستأجر' },
    { href: 'ads.html', icon: 'fa-bullhorn', label: 'إعلاناتي', desc: 'إعلانات المستأجر' },
    { href: 'products.html', icon: 'fa-box-open', label: 'منتجاتي', desc: 'منتجات المستأجر' },
    { href: 'partnerships.html', icon: 'fa-handshake', label: 'شراكاتي', desc: 'صفحة الشراكات' },
    { href: 'side-projects.html', icon: 'fa-lightbulb', label: 'قناتي', desc: 'اكتشاف فرصة دخل مناسبة لملفك' },
    { href: 'side-project-registrations.html', icon: 'fa-inbox', label: 'طلبات تسجيل المشاريع', desc: 'استقبال ومتابعة تسجيلات أصحاب المشاريع' },
    { href: 'global-os.html', icon: 'fa-network-wired', label: 'نظام التشغيل', desc: 'المعمارية · سجل 41 · تكامل · AI' },
    { href: 'system-ops.html', icon: 'fa-gears', label: 'تشغيل الأنظمة', desc: 'تنفيذ بنود النظام = على هوب' },
    { href: 'courses.html', icon: 'fa-chalkboard', label: 'دوراتي', desc: 'دورات المستخدم/المدرب' },
    { href: 'diplomas.html', icon: 'fa-graduation-cap', label: 'دبلوماتي', desc: 'دبلومات المتدرب/المدرب' },
    { href: 'chat.html', icon: 'fa-comments', label: 'دردشتي', desc: 'دردشة المستأجر وعملائه' },
    { href: 'register.html', icon: 'fa-user-plus', label: 'سجل معنا', desc: 'صاحب المنصة يعبّئ النموذج — السوبر أدمن يوافق فقط' },
    { href: 'apps.html', icon: 'fa-grid-2', label: 'سجل الأنظمة', desc: 'كتالوج أنظمة هوب' },
    { href: 'cart.html', icon: 'fa-cart-shopping', label: 'سلتي', desc: 'سلة المشتريات' },
    { href: 'support.html', icon: 'fa-headset', label: 'الدعم', desc: 'طلبات الصيانة والدعم' },
  ];

  const live = ['ERP', 'NAIS', 'LAW', 'ACADEMY', 'FIT']
    .filter((c) => window.HubLiveSystems?.isLive?.(c))
    .map((c) => {
      const meta = window.HubLauncher?.SYSTEM_META?.[c] || { nameAr: c, icon: 'fa-cube' };
      return { code: c, ...meta };
    });

  const title = root.querySelector('[data-office-title]');
  if (title) title.textContent = `مكتب ${t.nameAr || 'المستأجر'}`;

  const grid = root.querySelector('[data-office-shortcuts]');
  if (grid) {
    grid.innerHTML = shortcuts
      .map(
        (s) => `<a class="hub-feature-card" href="${s.href}">
          <div class="hub-feature-card-top">
            <span class="hub-feature-icon"><i class="fas ${s.icon}"></i></span>
            <h3>${s.label}</h3>
          </div>
          <p>${s.desc}</p>
        </a>`
      )
      .join('');
  }

  const systems = root.querySelector('[data-office-systems]');
  if (systems) {
    systems.innerHTML = live.length
      ? live
          .map(
            (s) => `<button type="button" class="btn btn-primary" data-launch-code="${s.code}">
              <i class="fas ${s.icon || 'fa-cube'}"></i> ${s.nameAr}
            </button>`
          )
          .join('')
      : '<p>لا توجد أنظمة حية مسجّلة بعد.</p>';
    systems.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-launch-code]');
      if (!btn || !window.HubLauncher?.launch) return;
      window.HubLauncher.launch(btn.dataset.launchCode, { mode: 'hub', force: true });
    });
  }

  const tasks = root.querySelector('[data-office-tasks]');
  if (tasks) {
    const tickets = window.HubSupport?.read?.() || [];
    const open = tickets.filter((x) => x.status !== 'مغلق').slice(0, 5);
    tasks.innerHTML = open.length
      ? open
          .map(
            (tkt) => `<article class="hub-feature-card">
              <h3>${tkt.title}</h3>
              <p>${tkt.status} · ${tkt.system} · ${tkt.priority}</p>
              <a class="btn btn-secondary" href="support.html">متابعة</a>
            </article>`
          )
          .join('')
      : '<p class="hub-feature-section-lead">لا توجد تذاكر مفتوحة — يمكنك فتح تذكرة من صفحة الدعم.</p>';
  }
})();
