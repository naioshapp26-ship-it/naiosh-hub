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
      { label: 'مكتبي', href: 'office.html', icon: 'fa-briefcase' },
      { label: 'اعلاناتي', href: 'ads.html', icon: 'fa-bullhorn' },
      { label: 'منتجاتي', href: 'products.html', icon: 'fa-box-open' },
      { label: 'شراكاتي', href: 'partnerships.html', icon: 'fa-handshake' },
      { label: 'مشاريع جانبية', href: 'side-projects.html', icon: 'fa-lightbulb' },
      { label: 'نظام التشغيل', href: 'global-os.html', icon: 'fa-network-wired' },
      { label: 'دورات', href: 'courses.html', icon: 'fa-chalkboard' },
      { label: 'دبلومات', href: 'diplomas.html', icon: 'fa-graduation-cap' },
      { label: 'عملائي', href: 'systems/crm.html?from=hub&return=index.html', icon: 'fa-users', launchCode: 'CRM' },
      { label: 'دردشة داخلية', href: 'chat.html', icon: 'fa-comments', chat: true },
      { label: 'اخرى', href: 'apps.html', icon: 'fa-ellipsis' },
    ];
  };

  const ensureLearningVisible = (pages) => {
    const list = pages.slice();
    const ensure = (label, href, icon, launchCode) => {
      if (list.some((p) => p.label === label || (href && (p.href || '').includes(href.replace(/\.html.*/, ''))))) return;
      const insertAt = list.findIndex((p) => p.label === 'عملائي' || p.label === 'دردشة داخلية' || /^اخرى$|^أخرى$/.test(String(p.label || '').trim()));
      list.splice(insertAt >= 0 ? insertAt : list.length, 0, { label, href, icon, launchCode });
    };
    // أيقونة واحدة للمشاريع الجانبية — توحيد الاسم القديم «محرك الفرص»
    let keptSp = false;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const isSp =
        (list[i].href || '').includes('side-projects') ||
        list[i].label === 'محرك الفرص' ||
        list[i].label === 'مشاريع جانبية' ||
        list[i].label === 'المشاريع الجانبية';
      if (!isSp) continue;
      if (keptSp) {
        list.splice(i, 1);
        continue;
      }
      list[i] = { ...list[i], label: 'مشاريع جانبية', href: 'side-projects.html', icon: 'fa-lightbulb' };
      keptSp = true;
    }
    ensure('شراكاتي', 'partnerships.html', 'fa-handshake');
    ensure('مشاريع جانبية', 'side-projects.html', 'fa-lightbulb');
    ensure('طلبات المشاريع', 'side-project-registrations.html', 'fa-inbox');
    ensure('نظام التشغيل', 'global-os.html', 'fa-network-wired');
    ensure('دورات', 'courses.html', 'fa-chalkboard');
    ensure('دبلومات', 'diplomas.html', 'fa-graduation-cap');
    return list;
  };

  const ensureChatBeforeOther = (pages) => {
    const list = pages.slice();
    const chatIdx = list.findIndex((p) => /دردشة/.test(p.label || ''));
    const otherIdx = list.findIndex((p) => /^اخرى$|^أخرى$/.test(String(p.label || '').trim()));
    const chatItem =
      chatIdx >= 0
        ? list.splice(chatIdx, 1)[0]
        : { label: 'دردشة داخلية', href: 'chat.html', icon: 'fa-comments', chat: true };

    if (otherIdx >= 0) {
      const insertAt = list.findIndex((p) => /^اخرى$|^أخرى$/.test(String(p.label || '').trim()));
      list.splice(insertAt >= 0 ? insertAt : list.length, 0, { ...chatItem, chat: true });
    } else {
      list.push({ ...chatItem, chat: true });
    }
    return list;
  };

  const renderSidebar = () => {
    const nav = document.querySelector('.hero-sidebar[data-hero-sidebar]');
    if (!nav) return;
    const pages = ensureChatBeforeOther(
      ensureLearningVisible(fromCatalog().filter((p) => !window.HubReadySites?.isExcluded?.(p.label)))
    );

    nav.innerHTML = pages
      .map(
        (item) => `<a class="hero-sidebar-item${item.chat || /دردشة/.test(item.label) ? ' hub-sidebar-chat' : ''}" href="${item.href}" title="ادخل ${item.label} مباشرة"${
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
