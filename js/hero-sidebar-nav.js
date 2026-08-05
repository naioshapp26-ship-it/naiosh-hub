(() => {
  'use strict';

  /**
   * منيو جانبي في الهيرو — بيانات هوب الشخصية + أيقونات واضحة
   */
  const SIDE_PAGES = [
    { label: 'فرعي', href: 'branches.html', icon: 'fa-code-branch' },
    { label: 'حاضنتي', href: 'incubators.html', icon: 'fa-seedling' },
    { label: 'منصتي', href: 'platforms.html', icon: 'fa-layer-group' },
    { label: 'مكتبي', href: 'dashboard.html', icon: 'fa-briefcase' },
    { label: 'اعلاناتي', href: 'ads.html', icon: 'fa-bullhorn' },
    { label: 'منتجاتي', href: 'products.html', icon: 'fa-box-open' },
    { label: 'شراكاتي', href: 'store.html', icon: 'fa-handshake' },
    { label: 'عملائي', href: 'apps.html#crm', icon: 'fa-users' },
    { label: 'اخرى', href: 'apps.html', icon: 'fa-ellipsis' },
  ];

  const renderSidebar = () => {
    const nav = document.querySelector('.hero-sidebar[data-hero-sidebar]');
    if (!nav) return;

    nav.innerHTML = SIDE_PAGES.map(
      (item) => `<a class="hero-sidebar-item" href="${item.href}">
        <span class="hero-sidebar-icon" aria-hidden="true"><i class="fas ${item.icon}"></i></span>
        <span class="hero-sidebar-label">${item.label}</span>
      </a>`
    ).join('');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderSidebar);
  } else {
    renderSidebar();
  }
})();
