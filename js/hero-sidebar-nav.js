(() => {
  'use strict';

  /**
   * منيو جانبي في الهيرو — مواقع جاهزة · اضغط تدخل مباشرة
   * كونزو مستبعد
   */
  const fromCatalog = () => {
    const list = window.HubReadySites?.sidebarSites?.() || [];
    if (list.length) {
      return list.map((s) => ({
        label: s.sidebar.label,
        href: s.href,
        icon: s.sidebar.icon || s.icon,
        launchCode: s.launchCode || '',
        id: s.id,
      }));
    }
    return [
      { label: 'فرعي', href: 'branches.html', icon: 'fa-code-branch' },
      { label: 'حاضنتي', href: 'incubators.html', icon: 'fa-seedling' },
      { label: 'منصتي', href: 'platforms.html', icon: 'fa-layer-group' },
      { label: 'مكتبي', href: 'dashboard.html#operating', icon: 'fa-briefcase' },
      { label: 'اعلاناتي', href: 'ads.html', icon: 'fa-bullhorn' },
      { label: 'منتجاتي', href: 'products.html', icon: 'fa-box-open' },
      { label: 'شراكاتي', href: 'store.html', icon: 'fa-handshake' },
      { label: 'عملائي', href: 'systems/crm.html?from=hub&return=index.html', icon: 'fa-users', launchCode: 'CRM' },
      { label: 'اخرى', href: 'apps.html', icon: 'fa-ellipsis' },
    ];
  };

  const renderSidebar = () => {
    const nav = document.querySelector('.hero-sidebar[data-hero-sidebar]');
    if (!nav) return;
    const pages = fromCatalog().filter((p) => !window.HubReadySites?.isExcluded?.(p.label));

    nav.innerHTML = pages
      .map(
        (item) => `<a class="hero-sidebar-item" href="${item.href}" title="ادخل ${item.label} مباشرة"${
          item.launchCode ? ` data-launch-code="${item.launchCode}" data-launch-mode="hub"` : ''
        }>
        <span class="hero-sidebar-icon" aria-hidden="true"><i class="fas ${item.icon}"></i></span>
        <span class="hero-sidebar-label">${item.label}</span>
      </a>`
      )
      .join('');

    nav.addEventListener('click', (e) => {
      const a = e.target.closest('[data-launch-code]');
      if (!a || !window.HubLauncher?.launch) return;
      e.preventDefault();
      window.HubLauncher.launch(a.dataset.launchCode, { mode: 'hub' });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderSidebar);
  } else {
    renderSidebar();
  }
})();
