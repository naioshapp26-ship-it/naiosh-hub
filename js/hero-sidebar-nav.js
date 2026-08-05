(() => {
  'use strict';

  /**
   * منيو جانبي في الهيرو — نفس شكل ERP مع بيانات هوب + أيقونات قوية
   */
  const SIDE_PAGES = [
    { label: 'انظمتي', href: 'apps.html', icon: 'fa-cubes' },
    { label: 'اعلاناتي', href: 'ads.html', icon: 'fa-bullhorn' },
    { label: 'اعلانات الفروع', href: 'ads.html?scope=branches', icon: 'fa-earth-americas' },
    { label: 'اعلانات الحاضنات', href: 'ads.html?scope=incubators', icon: 'fa-seedling' },
    { label: 'اعلانات المنصات', href: 'ads.html?scope=platforms', icon: 'fa-diagram-project' },
    { label: 'خدماتي', href: 'store.html', icon: 'fa-handshake' },
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
