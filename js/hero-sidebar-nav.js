(() => {
  'use strict';

  /**
   * منيو جانبي في الهيرو — حسب دليل الاستخدام:
   * فرعي · حاضنتي · منصتي · مكتبي · اعلاناتي · منتجاتي · قناتي · طلبات المشاريع · نظام التشغيل · شراكاتي · عملائي · دوراتي · دبلوماتي · دردشة · اخرى
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
      { label: 'فرعي', href: 'my-branch.html', icon: 'fa-code-branch' },
      { label: 'حاضنتي', href: 'my-incubator.html', icon: 'fa-seedling' },
      { label: 'منصتي', href: 'my-platform.html', icon: 'fa-layer-group' },
      { label: 'مكتبي', href: 'my-office.html', icon: 'fa-briefcase' },
      { label: 'اعلاناتي', href: 'ads.html', icon: 'fa-bullhorn' },
      { label: 'منتجاتي', href: 'products.html', icon: 'fa-box-open' },
      { label: 'قناتي', href: 'my-channel.html', icon: 'fa-video' },
      { label: 'طلبات المشاريع', href: 'side-project-registrations.html', icon: 'fa-inbox' },
      { label: 'نظام التشغيل', href: 'global-os.html', icon: 'fa-network-wired' },
      { label: 'شراكاتي', href: 'partnerships.html', icon: 'fa-handshake' },
      { label: 'عملائي', href: 'systems/crm.html?from=hub&return=index.html', icon: 'fa-users', launchCode: 'CRM' },
      { label: 'دوراتي', href: 'my-courses.html', icon: 'fa-chalkboard' },
      { label: 'دبلوماتي', href: 'my-diplomas.html', icon: 'fa-graduation-cap' },
      { label: 'دردشة داخلية', href: 'chat.html', icon: 'fa-comments', chat: true },
      { label: 'اخرى', href: 'apps.html', icon: 'fa-ellipsis' },
    ];
  };

  const dedupeBy = (list, pred, rewrite) => {
    let kept = false;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (!pred(list[i])) continue;
      if (kept) {
        list.splice(i, 1);
        continue;
      }
      list[i] = rewrite(list[i]);
      kept = true;
    }
  };

  const renameChannelLabels = (pages) => {
    const list = pages.slice();
    for (let i = 0; i < list.length; i += 1) {
      const href = list[i].href || '';
      const label = list[i].label || '';
      if (label === 'المنصات' || label === 'منصتي' || /(?:^|\/)platforms\.html/.test(href)) {
        list[i] = { ...list[i], label: 'منصتي', href: 'my-platform.html', icon: list[i].icon || 'fa-layer-group' };
      }
      if (label === 'حاضنتي' || label === 'الحاضنات' || /(?:^|\/)incubators\.html/.test(href)) {
        list[i] = { ...list[i], label: 'حاضنتي', href: 'my-incubator.html', icon: list[i].icon || 'fa-seedling' };
      }
      if (label === 'فرعي' || label === 'الفروع' || /(?:^|\/)branches\.html/.test(href)) {
        list[i] = { ...list[i], label: 'فرعي', href: 'my-branch.html', icon: list[i].icon || 'fa-code-branch' };
      }
      if (label === 'مكتبي' || /(?:^|\/)office\.html/.test(href) || /(?:^|\/)my-office\.html/.test(href)) {
        list[i] = { ...list[i], label: 'مكتبي', href: 'my-office.html', icon: list[i].icon || 'fa-briefcase' };
      }
      if (
        label === 'قناتي' ||
        label === 'محرك الفرص' ||
        label === 'مشاريع جانبية' ||
        label === 'المشاريع الجانبية' ||
        href.includes('side-projects') ||
        href.includes('my-channel')
      ) {
        // مشاريع جانبية ليست قناتي — قناتي = قناة فيديو خاصة
        if (href.includes('side-project-registrations')) continue;
        list[i] = { ...list[i], label: 'قناتي', href: 'my-channel.html', icon: 'fa-video' };
      }
      if (href.includes('courses') || label === 'دورات' || label === 'دوراتي') {
        if (href.includes('my-courses') || label === 'دوراتي' || label === 'دورات') {
          list[i] = { ...list[i], label: 'دوراتي', href: 'my-courses.html', icon: list[i].icon || 'fa-chalkboard' };
        }
      }
      if (href.includes('diplomas') || label === 'دبلومات' || label === 'دبلوماتي') {
        list[i] = { ...list[i], label: 'دبلوماتي', href: 'my-diplomas.html', icon: list[i].icon || 'fa-graduation-cap' };
      }
    }

    dedupeBy(
      list,
      (item) => item.label === 'منصتي' || (item.href || '').includes('my-platform'),
      (item) => ({ ...item, label: 'منصتي', href: 'my-platform.html', icon: item.icon || 'fa-layer-group' })
    );
    dedupeBy(
      list,
      (item) => item.label === 'حاضنتي' || (item.href || '').includes('my-incubator'),
      (item) => ({ ...item, label: 'حاضنتي', href: 'my-incubator.html', icon: item.icon || 'fa-seedling' })
    );
    dedupeBy(
      list,
      (item) => item.label === 'فرعي' || (item.href || '').includes('my-branch'),
      (item) => ({ ...item, label: 'فرعي', href: 'my-branch.html', icon: item.icon || 'fa-code-branch' })
    );
    dedupeBy(
      list,
      (item) => item.label === 'مكتبي' || (item.href || '').includes('my-office'),
      (item) => ({ ...item, label: 'مكتبي', href: 'my-office.html', icon: item.icon || 'fa-briefcase' })
    );
    dedupeBy(
      list,
      (item) => item.label === 'قناتي' || (item.href || '').includes('my-channel'),
      (item) => ({ ...item, label: 'قناتي', href: 'my-channel.html', icon: 'fa-video' })
    );
    dedupeBy(
      list,
      (item) => item.label === 'دوراتي' || (item.href || '').includes('my-courses'),
      (item) => ({ ...item, label: 'دوراتي', href: 'my-courses.html', icon: item.icon || 'fa-chalkboard' })
    );
    dedupeBy(
      list,
      (item) => item.label === 'دبلوماتي' || (item.href || '').includes('my-diplomas'),
      (item) => ({ ...item, label: 'دبلوماتي', href: 'my-diplomas.html', icon: item.icon || 'fa-graduation-cap' })
    );
    return list;
  };

  const ensureLearningVisible = (pages) => {
    const list = renameChannelLabels(pages);
    const ensure = (label, href, icon, launchCode) => {
      if (list.some((p) => p.label === label || (href && (p.href || '').includes(href.replace(/\.html.*/, ''))))) return;
      const insertAt = list.findIndex((p) => p.label === 'عملائي' || p.label === 'دردشة داخلية' || /^اخرى$|^أخرى$/.test(String(p.label || '').trim()));
      list.splice(insertAt >= 0 ? insertAt : list.length, 0, { label, href, icon, launchCode });
    };
    ensure('فرعي', 'my-branch.html', 'fa-code-branch');
    ensure('حاضنتي', 'my-incubator.html', 'fa-seedling');
    ensure('منصتي', 'my-platform.html', 'fa-layer-group');
    ensure('مكتبي', 'my-office.html', 'fa-briefcase');
    ensure('اعلاناتي', 'ads.html', 'fa-bullhorn');
    ensure('منتجاتي', 'products.html', 'fa-box-open');
    ensure('قناتي', 'my-channel.html', 'fa-video');
    ensure('طلبات المشاريع', 'side-project-registrations.html', 'fa-inbox');
    ensure('نظام التشغيل', 'global-os.html', 'fa-network-wired');
    ensure('شراكاتي', 'partnerships.html', 'fa-handshake');
    ensure('عملائي', 'systems/crm.html?from=hub&return=index.html', 'fa-users', 'CRM');
    ensure('دوراتي', 'my-courses.html', 'fa-chalkboard');
    ensure('دبلوماتي', 'my-diplomas.html', 'fa-graduation-cap');
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
          .filter((p) => p.label !== 'سجل معنا' && !(p.href || '').includes('register.html'))
          .filter((p) => !(p.href || '').includes('side-projects.html') || (p.href || '').includes('side-project-registrations'))
      )
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
