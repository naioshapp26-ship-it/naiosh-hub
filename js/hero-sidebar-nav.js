(() => {
  'use strict';

  /**
   * منيو جانبي في الهيرو — قناتي · دوراتي · دبلوماتي · بدون تكرار مع الهيرو/الهيدر
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
      { label: 'مكتبي', href: 'office.html', icon: 'fa-briefcase' },
      { label: 'اعلاناتي', href: 'ads.html', icon: 'fa-bullhorn' },
      { label: 'منتجاتي', href: 'products.html', icon: 'fa-box-open' },
      { label: 'شراكاتي', href: 'partnerships.html', icon: 'fa-handshake' },
      { label: 'قناتي', href: 'side-projects.html#sp-client-intro', icon: 'fa-lightbulb' },
      { label: 'دوراتي', href: 'courses.html', icon: 'fa-chalkboard' },
      { label: 'دبلوماتي', href: 'diplomas.html', icon: 'fa-graduation-cap' },
      { label: 'نظام التشغيل', href: 'global-os.html', icon: 'fa-network-wired' },
      { label: 'عملائي', href: 'systems/crm.html?from=hub&return=index.html', icon: 'fa-users', launchCode: 'CRM' },
      { label: 'دردشة داخلية', href: 'chat.html', icon: 'fa-comments', chat: true },
      { label: 'اخرى', href: 'apps.html', icon: 'fa-ellipsis' },
    ];
  };

  const renameChannelLabels = (pages) => {
    const list = pages.slice();
    for (let i = 0; i < list.length; i += 1) {
      const href = list[i].href || '';
      const label = list[i].label || '';
      if (
        href.includes('side-projects') ||
        label === 'محرك الفرص' ||
        label === 'مشاريع جانبية' ||
        label === 'المشاريع الجانبية'
      ) {
        list[i] = { ...list[i], label: 'قناتي', href: 'side-projects.html#sp-client-intro', icon: 'fa-lightbulb' };
      }
      if (href.includes('courses') || label === 'دورات') {
        list[i] = { ...list[i], label: 'دوراتي', href: 'courses.html', icon: list[i].icon || 'fa-chalkboard' };
      }
      if (href.includes('diplomas') || label === 'دبلومات') {
        list[i] = { ...list[i], label: 'دبلوماتي', href: 'diplomas.html', icon: list[i].icon || 'fa-graduation-cap' };
      }
      if (label === 'المنصات' || label === 'منصتي' || /(?:^|\/)platforms\.html/.test(href)) {
        list[i] = { ...list[i], label: 'منصتي', href: 'my-platform.html', icon: list[i].icon || 'fa-layer-group' };
      }
      if (label === 'حاضنتي' || label === 'الحاضنات' || /(?:^|\/)incubators\.html/.test(href)) {
        list[i] = { ...list[i], label: 'حاضنتي', href: 'my-incubator.html', icon: list[i].icon || 'fa-seedling' };
      }
    }
    let keptMine = false;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const isMine = list[i].label === 'منصتي' || (list[i].href || '').includes('my-platform');
      if (!isMine) continue;
      if (keptMine) {
        list.splice(i, 1);
        continue;
      }
      list[i] = { ...list[i], label: 'منصتي', href: 'my-platform.html', icon: list[i].icon || 'fa-layer-group' };
      keptMine = true;
    }
    let keptIncubator = false;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const isInc = list[i].label === 'حاضنتي' || (list[i].href || '').includes('my-incubator');
      if (!isInc) continue;
      if (keptIncubator) {
        list.splice(i, 1);
        continue;
      }
      list[i] = { ...list[i], label: 'حاضنتي', href: 'my-incubator.html', icon: list[i].icon || 'fa-seedling' };
      keptIncubator = true;
    }
    // أزل تكرار قناتي إن وُجد أكثر من مرة
    let keptChannel = false;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const isChannel =
        (list[i].href || '').includes('side-projects') ||
        list[i].label === 'قناتي' ||
        list[i].label === 'مشاريع جانبية';
      if (!isChannel) continue;
      if (keptChannel) {
        list.splice(i, 1);
        continue;
      }
      list[i] = { ...list[i], label: 'قناتي', href: 'side-projects.html#sp-client-intro', icon: 'fa-lightbulb' };
      keptChannel = true;
    }
    return list;
  };

  const ensureLearningVisible = (pages) => {
    const list = renameChannelLabels(pages);
    const ensure = (label, href, icon, launchCode) => {
      if (list.some((p) => p.label === label || (href && (p.href || '').includes(href.replace(/\.html.*/, ''))))) return;
      const insertAt = list.findIndex((p) => p.label === 'عملائي' || p.label === 'دردشة داخلية' || /^اخرى$|^أخرى$/.test(String(p.label || '').trim()));
      list.splice(insertAt >= 0 ? insertAt : list.length, 0, { label, href, icon, launchCode });
    };
    ensure('شراكاتي', 'partnerships.html', 'fa-handshake');
    ensure('حاضنتي', 'my-incubator.html', 'fa-seedling');
    ensure('منصتي', 'my-platform.html', 'fa-layer-group');
    ensure('قناتي', 'side-projects.html#sp-client-intro', 'fa-lightbulb');
    ensure('دوراتي', 'courses.html', 'fa-chalkboard');
    ensure('دبلوماتي', 'diplomas.html', 'fa-graduation-cap');
    ensure('طلبات المشاريع', 'side-project-registrations.html', 'fa-inbox');
    ensure('نظام التشغيل', 'global-os.html', 'fa-network-wired');
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
      ensureLearningVisible(
        fromCatalog()
          .filter((p) => !window.HubReadySites?.isExcluded?.(p.label))
          .filter((p) => p.label !== 'ابدأ رحلتك' && !(p.href || '').includes('rent-system.html'))
          .filter((p) => p.label !== 'أنظمتي')
      )
    );
    if (!pages.some((p) => p.label === 'سجل معنا' || (p.href || '').includes('register.html'))) {
      pages.unshift({ label: 'سجل معنا', href: 'register.html', icon: 'fa-user-plus' });
    }

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
