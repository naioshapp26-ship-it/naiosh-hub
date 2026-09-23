(() => {
  const NAV = [
    { key: 'overview', icon: 'fa-satellite-dish', label: 'مركز التحكم' },
    { key: 'operating', icon: 'fa-gears', label: 'آلية التشغيل' },
    { key: 'posha-clients', icon: 'fa-building-user', label: 'عملاء هوب' },
    { key: 'site-settings', icon: 'fa-gear', label: 'إعدادات الموقع' },
    { key: 'clients-mgmt', icon: 'fa-user-tie', label: 'إدارة العملاء' },
    { key: 'roles-permissions', icon: 'fa-shield-halved', label: 'إدارة فريق العمل والصلاحيات' },
    { key: 'notifications', icon: 'fa-bell', label: 'مركز إشعارات نايوش هوب' },
    { key: 'side-project-regs', icon: 'fa-inbox', label: 'طلبات تسجيل المشاريع' },
    { key: 'content-articles', icon: 'fa-newspaper', label: 'المقالات الواردة' },
    { key: 'search-admin', icon: 'fa-magnifying-glass', label: 'إدارة محرك بحث نايوش' },
    { key: 'rent-admin', icon: 'fa-user-shield', label: 'موافقات المدير الأعلى' },
    { key: 'blueprint', icon: 'fa-sitemap', label: 'دستور المعمارية' },
    { key: 'platforms', icon: 'fa-layer-group', label: 'المنصات السيادية' },
    { key: 'apps', icon: 'fa-cubes', label: 'سجل الأنظمة' },
    { key: 'products', icon: 'fa-boxes-stacked', label: 'عرض المنتجات' },
    { key: 'store', icon: 'fa-bag-shopping', label: 'متجر المبيعات' },
    { key: 'ads-studio', icon: 'fa-bullhorn', label: 'استوديو الحملات التسويقية', href: 'ads.html' },
    { key: 'events-studio', icon: 'fa-calendar-days', label: 'استوديو الفعاليات الذكي', href: 'events.html' },
    { key: 'identity', icon: 'fa-id-card', label: 'هوية نايوش' },
    { key: 'organization', icon: 'fa-globe', label: 'الهيكل العالمي' },
    { key: 'incubators', icon: 'fa-building', label: 'الحاضنات' },
    { key: 'wallet', icon: 'fa-coins', label: 'محفظة النقاط' },
    { key: 'core', icon: 'fa-brain', label: 'العقل المركزي' },
    { key: 'governance', icon: 'fa-scale-balanced', label: 'الحوكمة' },
    { key: 'info-security', icon: 'fa-shield-halved', label: 'أمن المعلومات' },
    { key: 'data-governance', icon: 'fa-database', label: 'حوكمة البيانات' },
    { key: 'systems-automation', icon: 'fa-robot', label: 'أتمتة الأنظمة' },
    { key: 'workforce', icon: 'fa-users-gear', label: 'القوى العاملة' },
    { key: 'systems', icon: 'fa-store', label: 'سوق الأنظمة' },
    { key: 'tasks', icon: 'fa-clipboard-list', label: 'المهام' },
    { key: 'measurement', icon: 'fa-chart-simple', label: 'القياس' },
    { key: 'reports', icon: 'fa-scroll', label: 'التقارير' },
    { key: 'integration', icon: 'fa-plug', label: 'التكامل' },
    { key: 'settings', icon: 'fa-sliders', label: 'إعدادات النظام' },
  ];

  const TITLES = {
    overview: ['مركز التحكم العالمي', 'KPIs قابلة للنقر · Needs Action · مصدر · سجل عمليات'],
    operating: ['آلية تشغيل نايوش هوب', 'اشتراكات · مكاتب · خدمات موحّدة · نشاط · تدقيق'],
    core: ['العقل المركزي — Central Intelligence', 'قرارات · توصيات · رؤى · تنبؤات · شذوذ · قواعد · تنفيذ · موافقات'],
    tasks: ['إدارة المهام', 'CRUD · مصدر · تدقيق · لوحة حالات · Needs Action'],
    measurement: ['القياس الموحّد', 'درجات · مؤشرات بصيغة · إعادة حساب موثّقة'],
    reports: ['مركز التقارير', 'توليد · عرض · تصدير JSON · جدول · تدقيق'],
    integration: ['التكامل والبوابة', 'موصلات · مزامنة · API · فحص بوابة · تدقيق'],
    'posha-clients': ['عملاء هوب', 'إدارة العملاء والطلبات والدعم والتنبيهات من مكان واحد'],
    'site-settings': ['إعدادات الموقع', 'إدارة إعدادات المنصة والمتاجر والطلبات والدفع والإعلانات والتكاملات والأمان من مكان واحد'],
    'clients-mgmt': ['إدارة العملاء', 'Clients 360 · CRUD · مصدر · ملاحظات داخلية · تدقيق'],
    'roles-permissions': ['إدارة فريق العمل والصلاحيات', 'عيّن المسؤولين عن إدارة نايوش هوب وأنظمتها، وحدد لكل شخص مكان عمله ودوره والصلاحيات المسموح بها.'],
    notifications: ['مركز إشعارات نايوش هوب', 'مصدر واضح · سبب · إجراء · طلب مرتبط'],
    'side-project-regs': ['طلبات تسجيل المشاريع', 'Inbox · متابعة · تواصل · تدقيق'],
    'content-articles': ['المقالات الواردة', 'مراجعة · اعتماد · نشر · Workflow Runs'],
    'search-admin': ['إدارة محرك بحث نايوش', 'فهرسة · ظهور · اختبار نفس محرك العميل'],
    'rent-admin': ['موافقات المدير الأعلى', 'مراجعة واعتماد العمليات الحساسة قبل التنفيذ'],
    blueprint: ['دستور المعمارية الإمبراطورية', 'هوب مركزي — طبقات · محاور · أول 6 أشهر'],
    platforms: ['المنصات السيادية لنايوش 360', '18 منصة تشغّل هوب — من الدماغ المركزي إلى السلطة العليا'],
    apps: ['سجل أنظمة هوب', 'أي نظام نايوش يمكنه الظهور هنا والارتباط بالتشغيل الموحّد'],
    products: ['عرض المنتجات', 'بحث · علامة · سعر · مخزون · حركة البيع'],
    store: ['متجر المبيعات', 'باقات البيع · طلبات · نقاط المحفظة'],
    'ads-studio': ['استوديو الحملات التسويقية', 'نسخة ERP كاملة — حملات · تسجيل · مقاطع · نشر'],
    'events-studio': ['استوديو الفعاليات الذكي', 'نسخة ERP كاملة — فعاليات · بث · ورش · إدارة'],
    identity: ['هوية نايوش', 'إدارة الهوية · الدخول الموحد · التحقق الثنائي · ربط الصلاحيات المركزية'],
    organization: ['محرك الهيكل المؤسسي', 'دولة ← فرع ← حاضنة ← منصة ← مكتب إلكتروني'],
    incubators: ['إدارة الحاضنات', '100 حاضنة قطاعية · منصات · مكاتب · أعضاء'],
    wallet: ['اقتصاد النقاط', 'شحن · استهلاك · تسعير · فواتير'],
    governance: ['الحوكمة المؤسسية 360', 'أشخاص · سياسات · امتثال · جودة · عقود · مكافآت · موافقات · تدقيق'],
    'info-security': ['أمن المعلومات', 'حماية · إدارة · حوادث · مخاطر · ضوابط · تقارير'],
    'data-governance': ['حوكمة البيانات', 'كتالوج · مصادر · جودة · رحلة البيانات · سياسات · اعتمادات'],
    'systems-automation': ['أتمتة الأنظمة', 'إنشاء · تشغيل · قوالب · سجل عمليات · اتصالات'],
    workforce: ['القوى العاملة', 'موظفين أولاً · بحث وفلاتر · Pagination · ملف موظف · مكافآت واعتماد · مزامنة HR'],
    systems: ['سوق الأنظمة التشغيلية', 'إضافة · تعديل فعلي · مستخدمون · اشتراك · تكاملات · سجل تغييرات'],
    settings: ['إعدادات النظام', 'مركز التحكم في إعدادات المنصة: عامة · مستخدمون · متجر · طلبات · أمان · سجل التغييرات'],
  };

  const token = localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken');
  const rawUser = localStorage.getItem('hubUser') || sessionStorage.getItem('hubUser');
  if (!token || !rawUser) {
    window.location.href = 'login.html';
    return;
  }

  let user;
  try {
    user = JSON.parse(rawUser);
  } catch {
    window.location.href = 'login.html';
    return;
  }

  // CLIENT / غير موظف — ممنوع دخول غرفة العمليات حتى بالرابط المباشر
  const dashGate =
    window.HubAuth?.canAccessDashboard?.(user) ||
    (user.role === 'customer' || user.role === 'client' || user.role === 'client_user'
      ? { ok: false, redirect: 'client.html', message: 'ليس لديك صلاحية للوصول إلى هذه الصفحة.' }
      : { ok: true });
  if (!dashGate.ok) {
    try {
      sessionStorage.setItem('hubAuthFlash', dashGate.message || 'ليس لديك صلاحية للوصول إلى هذه الصفحة.');
    } catch (_) {}
    window.location.replace(dashGate.redirect || 'client.html');
    return;
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const root = $('#panel-root');
  const toastEl = $('#toast');
  let current = (() => {
    const raw = (location.hash || '').replace(/^#/, '') || 'overview';
    return raw.split('?')[0].split('&')[0] || 'overview';
  })();
  if (!TITLES[current]) current = 'overview';
  let reportTab = 'daily';
  let govTab = 'policies';

  const rowActs = (entity, id) => (window.HubActions ? window.HubActions.rowHtml(entity, id) : '');
  const pageActs = (entity, label) => (window.HubActions ? window.HubActions.toolbarHtml(entity, label) : '');
  const metaHead = () => (window.HubActions?.metaColumnsHeader ? window.HubActions.metaColumnsHeader() : '');
  const metaCells = (item) => (window.HubActions?.metaCells ? window.HubActions.metaCells(item) : '');

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  /** عملة موحّدة بالدولار — مثال: 400$ */
  const money = (n) =>
    window.HubCurrency?.format ? window.HubCurrency.format(n) : `${Number(n) || 0}$`;

  const fmtTime = (iso) => {
    if (window.HubFormat?.formatDateTime) return window.HubFormat.formatDateTime(iso);
    try {
      const s = HubStore.getSettings?.() || {};
      return new Date(iso).toLocaleString(s.dateFormat || 'en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        numberingSystem: 'latn',
        timeZone: s.timezone || 'Asia/Riyadh',
      });
    } catch {
      return iso;
    }
  };

  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 2600);
  };

  const badgeStatus = (status) => {
    const map = {
      executed: 'badge-black',
      pending: 'badge-red',
      active: 'badge-black',
      draft: 'badge-gray',
      online: 'badge-black',
      degraded: 'badge-red',
      offline: 'badge-red',
      connected: 'badge-black',
      partial: 'badge-red',
      disconnected: 'badge-gray',
      warning: 'badge-red',
      critical: 'badge-red',
      open: 'badge-red',
      investigating: 'badge-gray',
      closed: 'badge-black',
      todo: 'badge-gray',
      in_progress: 'badge-red',
      blocked: 'badge-red',
      done: 'badge-black',
      ready: 'badge-black',
      building: 'badge-red',
      planned: 'badge-gray',
      queued: 'badge-gray',
      deferred: 'badge-outline',
      stopped: 'badge-red',
      beta: 'badge-gray',
      paused: 'badge-gray',
      scheduled: 'badge-red',
      review: 'badge-red',
      قادمة: 'badge-black',
      منتهية: 'badge-gray',
      مسودة: 'badge-red',
      مكتمل: 'badge-black',
      عالي: 'badge-red',
      عاجل: 'badge-red',
      متوسط: 'badge-gray',
    };
    return `<span class="badge ${map[status] || 'badge-outline'}">${esc(status)}</span>`;
  };

  const bar = (pct) => `<div class="bar"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;

  // —— Auth UI
  $('#user-name').textContent = user.name || user.email || 'مستخدم';
  $('#user-role').textContent = window.HubI18n?.role?.(user.role) ||
    (user.role === 'supreme_leader'
      ? 'القائد الأعلى'
      : user.role === 'chief_engineer'
        ? 'المهندسة مليكة'
        : user.role === 'customer'
          ? 'عميل'
          : user.role === 'platform_owner'
            ? 'صاحب منصة'
            : user.role || 'عضو');

  $('#logout-btn').onclick = () => {
    localStorage.removeItem('hubAuthToken');
    localStorage.removeItem('hubUser');
    sessionStorage.removeItem('hubAuthToken');
    sessionStorage.removeItem('hubUser');
    window.location.href = 'login.html';
  };

  $('#btn-reset').onclick = () => {
    if (!confirm('تصفير كل بيانات غرفة العمليات وإعادة البذرة الأولية؟')) return;
    HubStore.reset();
    toast('تمت إعادة تهيئة المنصة');
    render();
  };

  $('#btn-recalc').onclick = () => {
    HubStore.tickProductivity();
    HubStore.recalculateMeasurement();
    HubStore.pingGateway();
    toast('أُعيد حساب القياس والإنتاجية');
    render();
  };

  let idleWatch = null;
  let syncWatch = null;
  let lastActivityAt = Date.now();
  const markActivity = () => {
    lastActivityAt = Date.now();
  };
  document.addEventListener('pointerdown', markActivity);
  document.addEventListener('keydown', markActivity);

  const applyDashboardChrome = () => {
    const s = HubStore.getSettings?.() || {};
    const brandStrong = document.querySelector('.sidebar-brand strong');
    const brandSpan = document.querySelector('.sidebar-brand span');
    const brandImg = document.querySelector('.sidebar-brand img');
    if (brandStrong) brandStrong.textContent = s.orgNameEn || 'NAIOSH HUB';
    if (brandSpan) brandSpan.textContent = s.orgTagline || '360 · Imperial';
    if (brandImg && s.logoMain) brandImg.src = s.logoMain;

    const rootStyle = document.documentElement.style;
    if (s.primaryColor) {
      rootStyle.setProperty('--red', s.primaryColor);
      rootStyle.setProperty('--hub-brand-primary', s.primaryColor);
    }
    if (s.secondaryColor) rootStyle.setProperty('--hub-brand-secondary', s.secondaryColor);
    if (s.accentColor) {
      rootStyle.setProperty('--red-dark', s.accentColor);
      rootStyle.setProperty('--hub-brand-accent', s.accentColor);
    }
    if (s.bgColor) rootStyle.setProperty('--hub-brand-bg', s.bgColor);
    if (s.textColor) rootStyle.setProperty('--hub-brand-text', s.textColor);
    if (s.surfaceColor) rootStyle.setProperty('--hub-brand-surface', s.surfaceColor);
    if (s.faviconUrl) {
      let fav = document.querySelector('link[rel="icon"]');
      if (!fav) {
        fav = document.createElement('link');
        fav.rel = 'icon';
        document.head.appendChild(fav);
      }
      fav.href = s.faviconUrl;
    }

    document.body.classList.toggle('hub-compact-sidebar', !!s.compactSidebar);
    document.body.classList.toggle('hub-reduce-motion', !!s.reduceMotion);
    document.body.classList.toggle('hub-ai-off', s.aiAssistantEnabled === false);

    const main = document.querySelector('.main');
    let banner = document.getElementById('hub-maintenance-banner');
    if (s.maintenanceMode) {
      if (!banner && main) {
        banner = document.createElement('div');
        banner.id = 'hub-maintenance-banner';
        banner.className = 'hub-maintenance-banner';
        banner.setAttribute('role', 'status');
        main.insertBefore(banner, main.firstChild);
      }
      if (banner) {
        banner.innerHTML = `<i class="fas fa-triangle-exclamation"></i> <strong>وضع الصيانة</strong> — ${esc(
          s.maintenanceMessage || 'المنصة تحت الصيانة'
        )}`;
      }
    } else if (banner) {
      banner.remove();
    }

    if (idleWatch) {
      clearInterval(idleWatch);
      idleWatch = null;
    }
    const sessionMs = Math.max(5, Number(s.sessionMinutes) || 480) * 60 * 1000;
    if (s.autoLogoutIdle) {
      idleWatch = setInterval(() => {
        if (Date.now() - lastActivityAt > sessionMs) {
          $('#logout-btn')?.click();
        }
      }, 15000);
    }

    if (syncWatch) {
      clearInterval(syncWatch);
      syncWatch = null;
    }
    const syncMins = Number(s.autoSyncMinutes) || 0;
    if (syncMins > 0 && HubStore.syncAllSystems) {
      syncWatch = setInterval(() => {
        HubStore.syncAllSystems();
      }, syncMins * 60 * 1000);
    }
  };

  $('#mobile-toggle').onclick = () => document.body.classList.toggle('nav-open');

  document.addEventListener('click', (e) => {
    if (!document.body.classList.contains('nav-open')) return;
    if (e.target.closest('.sidebar') || e.target.closest('#mobile-toggle')) return;
    document.body.classList.remove('nav-open');
  });

  // —— Nav
  const STAFF_ONLY_NAV = new Set([
    'posha-clients',
    'site-settings',
    'clients-mgmt',
    'roles-permissions',
    'rent-admin',
    'identity',
    'search-admin',
    'side-project-regs',
    'content-articles',
    'settings',
  ]);
  const buildVisibleNav = () => {
    let list =
      user.role === 'customer' || user.role === 'client' || user.role === 'client_user'
        ? NAV.filter((n) => !STAFF_ONLY_NAV.has(n.key) && !n.href)
        : NAV.slice();
    try {
      const allowed = window.HubTeamOpsUI?.allowedPanelsForUser?.(user);
      if (allowed instanceof Set) {
        list = list.filter((n) => allowed.has(n.key));
      }
    } catch (_) {}
    return list;
  };

  const renderNav = () => {
    const visibleNav = buildVisibleNav();
    $('#sidebar-nav').innerHTML = visibleNav.map((n) => {
      const href = n.href || `#${n.key}`;
      const active = n.key === current ? 'active' : '';
      return `<a href="${href}" data-panel="${n.key}" ${n.href ? 'data-external="1"' : ''} class="${active}"><i class="fas ${n.icon}"></i> ${n.label}</a>`;
    }).join('');
    $('#sidebar-nav').onclick = (e) => {
      const a = e.target.closest('a[data-panel]');
      if (!a) return;
      if (a.dataset.external === '1') {
        try {
          const ret = studioReturnTarget();
          sessionStorage.setItem('hubStudioReturn', ret);
          localStorage.setItem('hubStudioReturn', ret);
        } catch (_) {}
        document.body.classList.remove('nav-open');
        return;
      }
      e.preventDefault();
      activate(a.dataset.panel);
      document.body.classList.remove('nav-open');
    };

    const tl = HubStore.get().timeline;
    const p0 = HubStore.get().empire?.priorities?.[0];
    $('#sidebar-phase').innerHTML = `
      <strong>أول 6 أشهر</strong>
      <div>${p0 ? `P${p0.order}: ${esc(p0.axis)} · ${p0.progress}%` : `${esc(tl.phase1.name)} · ${tl.phase1.progress}%`}</div>
      ${bar(p0 ? p0.progress : tl.phase1.progress)}
    `;
  };

  const studioReturnTarget = () => {
    const from = current && current !== 'ads-studio' && current !== 'events-studio' ? current : 'overview';
    return `dashboard.html#${from}`;
  };

  const activate = (key) => {
    // الاستوديوهات تُفتح صفحات كاملة — لا تُعرض داخل لوحة التحكم
    if (key === 'ads-studio' || key === 'events-studio') {
      try {
        const allowed = window.HubTeamOpsUI?.allowedPanelsForUser?.(user);
        if (allowed instanceof Set && !allowed.has(key)) {
          toast?.('ليس لديك صلاحية لفتح هذا الاستوديو.');
          key = 'overview';
        } else {
          const ret = studioReturnTarget();
          sessionStorage.setItem('hubStudioReturn', ret);
          localStorage.setItem('hubStudioReturn', ret);
          window.location.href = key === 'ads-studio' ? 'ads.html' : 'events.html';
          return;
        }
      } catch (_) {
        window.location.href = key === 'ads-studio' ? 'ads.html' : 'events.html';
        return;
      }
    }
    let next = TITLES[key] ? key : 'overview';
    try {
      const allowed = window.HubTeamOpsUI?.allowedPanelsForUser?.(user);
      if (allowed instanceof Set && !allowed.has(next)) {
        next = allowed.has('overview') ? 'overview' : [...allowed][0] || 'overview';
        toast?.('ليس لديك صلاحية لفتح هذا القسم.');
      }
    } catch (_) {}
    current = next;
    history.replaceState(null, '', `#${current}`);
    $('#page-title').textContent = TITLES[current][0];
    $('#page-sub').textContent = TITLES[current][1];
    renderNav();
    applyDashboardChrome();
    render();
  };

  // —— Panels
  const renderOverview = () => {
    if (window.HubOverview?.render) {
      return HubOverview.render({ user, toast, esc, bar, badgeStatus, fmtTime });
    }
    return '<div class="empty">تعذر تحميل مركز التحكم</div>';
  };

  const renderBlueprint = () => {
    const bp = window.EmpireBlueprint;
    const e = HubStore.get().empire;
    if (!bp) return `<article class="card"><p>تعذّر تحميل دستور المعمارية.</p></article>`;
    return `
      <article class="card empire-verdict">
        <h3><span class="title-left"><i class="fas fa-crown icon"></i> ${esc(bp.philosophy.title)}</span></h3>
        <p class="lead">${esc(bp.philosophy.subtitle)}</p>
        <p>${esc(bp.philosophy.verdict)}</p>
        <p class="muted">${esc(bp.philosophy.capitalMetaphor)}</p>
      </article>
      <h3 class="section-label">الطبقات الخمس</h3>
      <div class="phase-cards">
        ${bp.fiveLayers
          .map(
            (l) => `<article class="phase-card">
              <h4>${esc(l.nameAr)}</h4>
              <small>${esc(l.name)}</small>
              <ul>${l.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
            </article>`
          )
          .join('')}
      </div>
      <h3 class="section-label">Core Platform — لا نظام قبل اكتمالها</h3>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>المكوّن</th><th>الوصف</th><th>الحالة</th><th>التقدم</th><th></th></tr></thead>
        <tbody>
          ${e.coreModules
            .map(
              (m) => `<tr>
                <td><strong>${esc(m.name)}</strong></td>
                <td>${esc(m.nameAr)}</td>
                <td>${badgeStatus(m.status)}</td>
                <td style="min-width:120px">${bar(m.progress)} <small>${m.progress}%</small></td>
                <td><button class="btn btn-sm btn-primary" data-action="advance-core" data-id="${m.id}">تقدّم</button></td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table></div>
      <h3 class="section-label">أول 6 أشهر — أولويات المبرمجين</h3>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>#</th><th>المحور</th><th>ملاحظة</th><th>الحالة</th><th>التقدم</th><th></th></tr></thead>
        <tbody>
          ${e.priorities
            .map(
              (p) => `<tr>
                <td>${p.order}</td>
                <td><strong>${esc(p.axis)}</strong></td>
                <td>${esc(p.note)}</td>
                <td>${badgeStatus(p.status)}</td>
                <td style="min-width:120px">${bar(p.progress)} <small>${p.progress}%</small></td>
                <td><button class="btn btn-sm btn-dark" data-action="advance-priority" data-id="${p.order}">دفع</button></td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table></div>
      <h3 class="section-label">12 محورًا رئيسيًا</h3>
      <div class="axis-grid">
        ${bp.twelveAxes
          .map((a) => {
            const st = e.axes.find((x) => x.id === a.id);
            return `<article class="axis-card">
              <div class="axis-num">0${a.priority}</div>
              <h4>${esc(a.nameAr)}</h4>
              <small>${esc(a.name)}</small>
              <div>${bar(st?.progress || 0)}</div>
              <ul>${a.components.slice(0, 4).map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
              ${badgeStatus(st?.status || 'planned')}
            </article>`;
          })
          .join('')}
      </div>
      <div class="grid-2" style="margin-top:14px">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-folder-tree icon"></i> شجرة المنصة</span></h3>
          <ul class="stack-tree">
            ${bp.stackTree
              .map(
                (n) => `<li><strong>${esc(n.nameAr)}</strong> <span>${esc(n.name)}</span><em>${n.children.join(' · ')}</em></li>`
              )
              .join('')}
          </ul>
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-file-lines icon"></i> وثائق قبل الكود</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>الوثيقة</th><th>الحالة</th></tr></thead>
            <tbody>
              ${e.docs.map((d) => `<tr><td>${esc(d.name)}</td><td>${badgeStatus(d.status)}</td></tr>`).join('')}
            </tbody>
          </table></div>
          <p class="muted" style="margin-top:10px">لا تسويق ولا ذكاء اصطناعي قبل اكتمال الأساسات (Core → Identity → Hierarchy → Roles → Dashboard → Gateway).</p>
        </article>
      </div>
    `;
  };

  const renderIdentity = () => {
    if (window.HubIdentityUI?.render) {
      return HubIdentityUI.render({ user, toast, esc, fmtTime });
    }
    return '<div class="empty">تعذر تحميل وحدة هوية نايوش</div>';
  };

  const renderOrganization = () => {
    const org = HubStore.get().empire.organization;
    return `
      <div class="toolbar">
        <a class="btn btn-primary" href="branches.html" target="_blank"><i class="fas fa-code-branch"></i> فتح صفحة الفروع العالمية</a>
        <a class="btn btn-primary" href="incubators.html" target="_blank"><i class="fas fa-seedling"></i> فتح صفحة الحاضنات</a>
      </div>
      <div class="chain-row">
        ${org.chain.map((c, i) => `<span class="chain-node">${esc(c)}</span>${i < org.chain.length - 1 ? '<i class="fas fa-arrow-left chain-arrow"></i>' : ''}`).join('')}
      </div>
      <div class="grid-2">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-flag icon"></i> الدول</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>الدولة</th><th>الكود</th><th>الفروع</th><th>الحالة</th></tr></thead>
            <tbody>
              ${org.countries
                .map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.code)}</td><td>${c.branches}</td><td>${badgeStatus(c.status)}</td></tr>`)
                .join('')}
            </tbody>
          </table></div>
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-code-branch icon"></i> الفروع</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>الفرع</th><th>الدولة</th><th>حاضنات</th><th>المدير</th></tr></thead>
            <tbody>
              ${org.branches
                .map((b) => `<tr><td>${esc(b.name)}</td><td>${esc(b.country)}</td><td>${b.incubators}</td><td>${esc(b.manager)}</td></tr>`)
                .join('')}
            </tbody>
          </table></div>
        </article>
      </div>
      <article class="card" style="margin-top:12px">
        <h3><span class="title-left"><i class="fas fa-layer-group icon"></i> المنصات السيادية</span></h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>الرقم</th><th>المنصة</th><th>الدور</th><th>الحالة</th></tr></thead>
          <tbody>
            ${org.platforms
              .map(
                (p, idx) => `<tr>
                  <td><strong>منصة ${String(idx + 1).padStart(2, '0')}</strong></td>
                  <td>${esc(p.nameAr || p.name)}</td>
                  <td>${esc(p.role || p.incubator || '—')}</td>
                  <td>${badgeStatus(p.status)}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table></div>
      </article>
    `;
  };

  const renderPlatforms = () => {
    const list = window.HubSovereignPlatforms?.list || HubStore.get().empire.organization.platforms || [];
    const custom = HubStore.get().empire.organization.platforms || [];
    const groups = window.HubSovereignPlatforms?.byCategory?.() || [];
    return `
      <div class="toolbar">
        ${pageActs('platforms', 'إضافة منصة')}
        <a class="btn btn-ghost" href="platforms.html" target="_blank"><i class="fas fa-layer-group"></i> فتح صفحة المنصات</a>
      </div>
      <div class="kpi-grid">
        <article class="kpi"><span>منصات سيادية</span><strong>${list.length}</strong><small>منصات نايوش</small></article>
        <article class="kpi"><span>مجموعات</span><strong>${groups.length || 4}</strong><small>تصنيفات</small></article>
        <article class="kpi"><span>متصلة بهوب</span><strong>${list.length}</strong><small>متصلة الآن</small></article>
        <article class="kpi"><span>مضافة من هوب</span><strong>${custom.length}</strong><small>سجلات تشغيل</small></article>
      </div>
      <article class="card" style="margin-top:12px">
        <h3><span class="title-left"><i class="fas fa-layer-group icon"></i> سجل المنصات التشغيلي</span></h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>المنصة</th><th>الرمز</th><th>الدور</th><th>الحالة</th>${metaHead()}<th></th></tr></thead>
          <tbody>
            ${custom.length
              ? custom
                  .map(
                    (p) => `<tr>
                      <td><strong>${esc(p.nameAr || p.name)}</strong></td>
                      <td>${esc(p.code || '—')}</td>
                      <td>${esc(p.role || '—')}</td>
                      <td>${badgeStatus(p.status)}</td>
                      ${metaCells(p)}
                      <td>${rowActs('platforms', p.id)}</td>
                    </tr>`
                  )
                  .join('')
              : `<tr><td colspan="14" class="empty">لا منصات مضافة بعد — استخدم زر إضافة</td></tr>`}
          </tbody>
        </table></div>
      </article>
      ${(groups.length
        ? groups
        : [{ label: 'المنصات السيادية', platforms: list }]
      )
        .map(
          (g) => `
        <article class="card" style="margin-top:12px">
          <h3><span class="title-left"><i class="fas fa-layer-group icon"></i> ${esc(g.label)}</span>
            <span class="badge badge-red">${(g.platforms || []).length}</span>
          </h3>
          <div class="phase-cards">
            ${(g.platforms || [])
              .map(
                (p) => `<article class="phase-card">
                  <small>${esc(p.name || p.nameAr)}</small>
                  <h4>${esc(p.nameAr || p.name)}</h4>
                  <p style="margin:4px 0 0;color:var(--muted);font-size:12px"><strong>${esc(p.role || '')}</strong></p>
                  <p style="margin:6px 0 0;color:var(--muted);font-size:12px">${esc(p.desc || '')}</p>
                </article>`
              )
              .join('')}
          </div>
        </article>`
        )
        .join('')}
    `;
  };

  const renderNotifications = () => {
    if (window.HubNotificationsWS?.render) {
      return HubNotificationsWS.render({ user, toast, esc, bar, badgeStatus, fmtTime });
    }
    return '<div class="empty">تعذر تحميل مركز الإشعارات</div>';
  };


  const renderSideProjectRegs = () => {
    if (window.HubSideProjectsWS?.render) {
      return HubSideProjectsWS.render({ user, toast, esc, bar, badgeStatus, fmtTime });
    }
    return '<div class="empty">تعذر تحميل طلبات المشاريع</div>';
  };


  const renderApps = () => {
    const apps = HubStore.get().empire.apps || [];
    const launcher = window.HubLauncher;
    return `
      <div class="toolbar">
        ${pageActs('apps', 'إضافة')}
        <div class="field"><label>رمز النظام</label><input id="app-code" placeholder="LAW" /></div>
        <div class="field"><label>الاسم بالعربي</label><input id="app-name" placeholder="نظام جديد لنايوش" /></div>
        <div class="field"><label>التصنيف</label><input id="app-cat" placeholder="أنظمة نايوش" /></div>
        <div class="field"><label>رابط التشغيل المباشر</label><input id="app-url" placeholder="systems/erp.html" /></div>
        <button class="btn btn-primary" data-action="register-app"><i class="fas fa-plus"></i> تسجيل سريع</button>
        <a class="btn btn-ghost" href="apps.html" target="_blank">فتح السجل العام</a>
      </div>
      <div class="kpi-grid">
        <article class="kpi"><span>أنظمة مسجّلة</span><strong>${apps.length}</strong><small>في هوب</small></article>
        <article class="kpi"><span>نشطة</span><strong>${apps.filter((a) => a.status === 'active').length}</strong><small>متاحة</small></article>
        <article class="kpi"><span>استوديوهات</span><strong>${apps.filter((a) => a.kind === 'studio').length}</strong><small>إعلانات · فعاليات · متجر</small></article>
        <article class="kpi"><span>سيادية</span><strong>${apps.filter((a) => a.kind === 'sovereign').length}</strong><small>منصات</small></article>
      </div>
      <article class="card" style="margin-top:12px">
        <h3><span class="title-left"><i class="fas fa-cubes icon"></i> اضغط النظام → انتقال مباشر إليه</span>
          <span class="badge badge-red">Hub Launch</span>
        </h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>الاسم</th><th>التصنيف</th><th>النوع</th><th>الصحة</th><th>آخر مزامنة</th><th>الحالة</th><th>تشغيل</th>${metaHead()}<th></th></tr></thead>
          <tbody>
            ${apps
              .map((a) => {
                const app = launcher?.normalizeApp?.(a) || a;
                const direct = launcher ? launcher.getDirectLaunchUrl(app) : app.url || 'apps.html';
                const solo = launcher ? launcher.getStandaloneUrl(app) : app.url || 'apps.html';
                return `<tr>
                  <td><strong>${esc(a.nameAr)}</strong><br><small>${esc(a.code)}</small></td>
                  <td>${esc(a.category)}</td>
                  <td>${esc(a.kind)}</td>
                  <td>${a.health || '—'}%</td>
                  <td>${a.lastSyncAt ? fmtTime(a.lastSyncAt) : '—'}</td>
                  <td>${badgeStatus(a.status)}</td>
                  <td style="white-space:nowrap">
                    <a class="btn btn-sm btn-primary" href="${esc(direct)}" title="تشغيل عبر هوب"><i class="fas fa-bolt"></i> فتح النظام</a>
                    <a class="btn btn-sm btn-ghost" href="${esc(solo)}" title="تشغيل منفرد">منفرد</a>
                  </td>
                  ${metaCells(a)}
                  <td>
                    <button class="btn btn-sm btn-dark" data-action="toggle-app" data-id="${a.id}">تفعيل/إيقاف</button>
                    ${rowActs('apps', a.id)}
                  </td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table></div>
      </article>
    `;
  };

  const renderProductsPanel = () => {
    const catalog = HubStore.get().empire.productCatalog || [];
    return `
      <div class="toolbar">
        ${pageActs('products', 'إضافة منتج')}
        <a class="btn btn-ghost" href="products.html" target="_blank"><i class="fas fa-boxes-stacked"></i> فتح عرض المنتجات</a>
        <a class="btn btn-ghost" href="store.html" target="_blank">المتجر</a>
        <a class="btn btn-ghost" href="ads.html" target="_blank">الإعلانات</a>
      </div>
      <div class="kpi-grid">
        <article class="kpi"><span>منتجات</span><strong>${catalog.length}</strong><small>في الكتالوج</small></article>
        <article class="kpi"><span>علامات</span><strong>${new Set(catalog.map((p) => p.brand)).size}</strong><small>تجارية</small></article>
        <article class="kpi"><span>مخزون</span><strong>${catalog.reduce((s, p) => s + (p.stock || 0), 0).toLocaleString('en-US')}</strong><small>وحدة</small></article>
        <article class="kpi"><span>مبيعات</span><strong>${catalog.reduce((s, p) => s + (p.sold || 0), 0).toLocaleString('en-US')}</strong><small>تراكمي</small></article>
      </div>
      <article class="card" style="margin-top:12px">
        <h3><span class="title-left"><i class="fas fa-boxes-stacked icon"></i> كتالوج المنتجات</span></h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>الرمز</th><th>المنتج</th><th>العلامة</th><th>المنصة</th><th>السعر ($)</th><th>المخزون</th><th>المبيعات</th><th>الحركة</th><th>الحالة</th>${metaHead()}<th>إجراءات</th></tr></thead>
          <tbody>
            ${catalog
              .map(
                (p) => `<tr>
                  <td><strong>${esc(p.sku)}</strong></td>
                  <td>${esc(p.name)}<br><small>${esc(p.category)}</small></td>
                  <td>${esc(p.brand)}</td>
                  <td>${esc(p.platform)}</td>
                  <td>${money(p.price)}</td>
                  <td>${p.stock}</td>
                  <td>${Number(p.sold).toLocaleString('en-US')}</td>
                  <td>${esc(p.movement)}</td>
                  <td>${esc(p.status)}</td>
                  ${metaCells(p)}
                  <td>${rowActs('products', p.id)}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table></div>
      </article>
    `;
  };

  const renderStorePanel = () => {
    const store = HubStore.get().empire.salesStore || { items: [], orders: [] };
    const cats = window.HubProductCategories?.optionsForForms?.() ||
      (window.HubMarketplaceData?.SHOP_CATEGORIES || []).filter((c) => c.id !== 'الكل').map((c) => ({ value: c.id, label: c.name })) ||
      (window.HubMarketplaceData?.SHOP_CATEGORIES || []).filter((c) => c.id !== 'الكل');
    // normalize to {id,name} for select
    const catRows = cats.map((c) => (c.value != null ? { id: c.value, name: c.label } : c));
    const mpLinked = store.items.reduce((n, i) => n + (i.marketplaces?.length || 0), 0);
    return `
      <div class="toolbar">
        ${pageActs('store', 'رفع على المتجر')}
        <div class="field"><label>الاسم</label><input id="store-title" placeholder="منتج أو خدمة" /></div>
        <div class="field"><label>التصنيف</label>
          <select id="store-cat">${catRows.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>النوع</label>
          <select id="store-kind"><option value="منتج">منتج</option><option value="خدمة">خدمة</option></select>
        </div>
        <div class="field"><label>السعر ($)</label><input id="store-price" type="number" value="500" /></div>
        <div class="field"><label>النقاط</label><input id="store-points" type="number" value="50" /></div>
        <div class="field"><label>منصة</label><input id="store-platform" placeholder="ACADEMY" value="ACADEMY" /></div>
        <button class="btn btn-primary" data-action="add-store-item"><i class="fas fa-cloud-arrow-up"></i> رفع</button>
        <a class="btn btn-ghost" href="store.html" target="_blank">فتح المتجر</a>
      </div>
      <div class="kpi-grid">
        <article class="kpi"><span>منتجات / خدمات</span><strong>${store.items.length}</strong><small>في المتجر</small></article>
        <article class="kpi"><span>طلبات</span><strong>${store.orders.length}</strong><small>مكتملة</small></article>
        <article class="kpi"><span>مخزون</span><strong>${store.items.reduce((s, i) => s + (i.stock || 0), 0)}</strong><small>وحدة</small></article>
        <article class="kpi"><span>روابط أسواق</span><strong>${mpLinked}</strong><small>Amazon · Noon…</small></article>
      </div>
      <div class="grid-2" style="margin-top:12px">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-bag-shopping icon"></i> المتجر الموحّد (نفس أكاديمية نايوش)</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>الاسم</th><th>النوع</th><th>التصنيف</th><th>السعر ($)</th><th>أسواق</th><th>مخزون</th>${metaHead()}<th></th></tr></thead>
            <tbody>
              ${store.items
                .map(
                  (i) => `<tr>
                    <td><strong>${esc(i.title)}</strong><br><small>${esc(i.brand || i.platformCode || '')}</small></td>
                    <td>${esc(i.itemKind || 'منتج')}</td>
                    <td>${esc(i.category)}</td>
                    <td>${money(i.price)}</td>
                    <td>${(i.marketplaces || []).map((m) => m.nameAr || m.name).join(' · ') || '—'}</td>
                    <td>${i.stock}</td>
                    ${metaCells(i)}
                    <td><button class="btn btn-sm btn-primary" data-action="buy-store-item" data-id="${i.id}">بيع</button>${rowActs('store', i.id)}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table></div>
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-receipt icon"></i> الطلبات (متجر محلي)</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>المنتج</th><th>المشتري</th><th>المبلغ ($)</th><th>الوقت</th></tr></thead>
            <tbody>
              ${store.orders
                .map(
                  (o) => `<tr>
                    <td>${esc(o.title)}</td>
                    <td>${esc(o.buyer)}</td>
                    <td>${money(o.amount)}</td>
                    <td>${fmtTime(o.at)}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table></div>
        </article>
      </div>
      <article class="card hub-admin-orders-wrap" style="margin-top:12px">
        <h3><span class="title-left"><i class="fas fa-bag-shopping icon"></i> طلبات شراء المنتجات (Checkout)</span></h3>
        <p class="muted" style="margin:0 0 8px">الطلبات القادمة من «اشترِ الآن» والسلة — مصدر الملف على الخادم.</p>
        <div id="hub-product-orders-admin"><div class="empty">جاري تحميل الطلبات…</div></div>
      </article>
    `;
  };

  const renderAdsStudio = () => {
    window.location.href = 'ads.html';
    return '<div class="empty">جاري فتح استوديو الحملات التسويقية…</div>';
  };

  const renderEventsStudio = () => {
    window.location.href = 'events.html';
    return '<div class="empty">جاري فتح استوديو الفعاليات الذكي…</div>';
  };


  const renderIncubators = () => {
    const org = HubStore.get().empire.organization;
    return `
      <div class="toolbar">
        ${pageActs('incubators', 'إضافة حاضنة')}
        <a class="btn btn-ghost" href="incubators.html" target="_blank"><i class="fas fa-seedling"></i> فتح صفحة الحاضنات</a>
        <div class="field"><label>اسم الحاضنة</label><input id="inc-name" placeholder="حاضنة القطاع…" /></div>
        <div class="field"><label>القطاع</label><input id="inc-sector" placeholder="تعليم / صحة / قانون…" /></div>
        <button class="btn btn-primary" data-action="add-incubator"><i class="fas fa-plus"></i> إنشاء سريع</button>
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>الحاضنة</th><th>القطاع</th><th>منصات</th><th>مكاتب</th><th>أعضاء</th><th>الصحة</th>${metaHead()}<th>إجراءات</th></tr></thead>
        <tbody>
          ${org.incubators
            .map(
              (i) => `<tr>
                <td><strong>${esc(i.name)}</strong></td>
                <td>${esc(i.sector)}</td>
                <td>${i.platforms}</td>
                <td>${i.offices}</td>
                <td>${i.members}</td>
                <td style="min-width:110px">${bar(i.health)} <small>${i.health}%</small></td>
                ${metaCells(i)}
                <td>${rowActs('incubators', i.id)}</td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table></div>
    `;
  };

  const renderWallet = () => {
    const w = HubStore.get().empire.wallet;
    return `
      <div class="kpi-grid">
        <article class="kpi"><span>خزينة الإمبراطورية</span><strong>${w.treasury.toLocaleString('en-US')}</strong><small>نقطة</small></article>
        <article class="kpi"><span>محافظ نشطة</span><strong>${w.wallets.length}</strong><small>Wallets</small></article>
        <article class="kpi"><span>خدمات مسعّرة</span><strong>${w.pricing.length}</strong><small>Pricing</small></article>
        <article class="kpi"><span>حركات السجل</span><strong>${w.ledger.length}</strong><small>Ledger</small></article>
      </div>
      <div class="toolbar">
        <div class="field"><label>المحفظة</label>
          <select id="wallet-owner">${w.wallets.map((x) => `<option>${esc(x.owner)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>المبلغ</label><input id="wallet-amount" type="number" value="1000" /></div>
        <button class="btn btn-primary" data-action="wallet-topup"><i class="fas fa-plus"></i> شحن</button>
        <button class="btn btn-dark" data-action="wallet-burn"><i class="fas fa-fire"></i> استهلاك</button>
      </div>
      <div class="grid-2">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-wallet icon"></i> المحافظ</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>المالك</th><th>الرصيد</th><th>استهلاك 30 يوم</th></tr></thead>
            <tbody>
              ${w.wallets
                .map((x) => `<tr><td>${esc(x.owner)}</td><td>${x.balance.toLocaleString('en-US')}</td><td>${x.burn30d.toLocaleString('en-US')}</td></tr>`)
                .join('')}
            </tbody>
          </table></div>
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-tags icon"></i> تسعير الخدمات</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>الخدمة</th><th>التكلفة بالنقاط</th></tr></thead>
            <tbody>${w.pricing.map((p) => `<tr><td>${esc(p.service)}</td><td>${p.cost}</td></tr>`).join('')}</tbody>
          </table></div>
          <h3 style="margin-top:14px"><span class="title-left"><i class="fas fa-receipt icon"></i> السجل</span></h3>
          <ul class="feed">
            ${w.ledger
              .slice(0, 8)
              .map((l) => `<li><b>${esc(l.type)}:</b> ${esc(l.party)} · ${l.amount} — ${esc(l.note)}<small>${fmtTime(l.at)}</small></li>`)
              .join('')}
          </ul>
        </article>
      </div>
    `;
  };

  const renderCore = () => {
    if (window.HubCoreWS?.render) {
      return HubCoreWS.render({ user, toast, esc, bar, badgeStatus, fmtTime });
    }
    return '<div class="empty">تعذر تحميل العقل المركزي</div>';
  };

  const renderGovernance = () => {
    if (window.HubGovernance?.render) {
      return HubGovernance.render({ user, toast, esc, bar, badgeStatus, fmtTime });
    }
    return '<div class="empty">تعذر تحميل وحدة الحوكمة المؤسسية 360</div>';
  };

  const renderWorkforce = () => {
    if (window.HubWorkforce?.render) {
      return HubWorkforce.render({ user, toast, esc, bar, badgeStatus, fmtTime });
    }
    return '<div class="empty">تعذر تحميل وحدة القوى العاملة</div>';
  };

  const renderSystems = () => {
    if (window.HubSystemsMarket?.render) {
      return HubSystemsMarket.render({ user, toast, esc, bar, badgeStatus, fmtTime });
    }
    return '<div class="empty">تعذر تحميل وحدة سوق الأنظمة</div>';
  };

  const renderTasks = () => {
    if (window.HubTasksWS?.render) {
      return HubTasksWS.render({ user, toast, esc, bar, badgeStatus, fmtTime });
    }
    return '<div class="empty">تعذر تحميل وحدة المهام</div>';
  };

  const renderMeasurement = () => {
    if (window.HubMeasurementWS?.render) {
      return HubMeasurementWS.render({ user, toast, esc, bar, badgeStatus, fmtTime });
    }
    return '<div class="empty">تعذر تحميل وحدة القياس</div>';
  };

  const renderReports = () => {
    if (window.HubReportsWS?.render) {
      return HubReportsWS.render({ user, toast, esc, bar, badgeStatus, fmtTime });
    }
    return '<div class="empty">تعذر تحميل وحدة التقارير</div>';
  };

  const renderIntegration = () => {
    if (window.HubIntegrationWS?.render) {
      return HubIntegrationWS.render({ user, toast, esc, bar, badgeStatus, fmtTime });
    }
    return '<div class="empty">تعذر تحميل وحدة التكامل</div>';
  };

  const renderInfoSecurity = () => {
    if (window.HubInfoSecurity?.render) {
      return HubInfoSecurity.render({ user, toast, esc, bar, badgeStatus, fmtTime });
    }
    return `<div class="empty">تعذّر تحميل وحدة أمن المعلومات. تأكد من تحميل js/hub-info-security.js</div>`;
  };

  const renderDataGovernance = () => {
    if (window.HubDataGovernance?.render) {
      return HubDataGovernance.render({ user, toast, esc, bar, badgeStatus, fmtTime });
    }
    return `<div class="empty">تعذّر تحميل وحدة حوكمة البيانات. تأكد من تحميل js/hub-data-governance.js</div>`;
  };

  const renderSystemsAutomation = () => {
    if (window.HubSystemsAutomation?.render) {
      return HubSystemsAutomation.render({ user, toast, esc, bar, badgeStatus, fmtTime });
    }
    return `<div class="empty">تعذّر تحميل وحدة أتمتة الأنظمة. تأكد من تحميل js/hub-systems-automation.js</div>`;
  };

  const renderOperating = () => {
    if (window.HubOperatingWS?.render) {
      return HubOperatingWS.render({ user, toast, esc, bar, badgeStatus, fmtTime });
    }
    return '<div class="empty">تعذر تحميل آلية التشغيل</div>';
  };

  const renderClientsMgmt = () => {
    if (window.HubClientsWS?.render) {
      return HubClientsWS.render({ user, toast, esc, bar, badgeStatus, fmtTime });
    }
    return '<div class="empty">تعذر تحميل إدارة العملاء</div>';
  };


  const renderSettings = () => {
    const s = HubStore.getSettings();
    const shopCats = window.HubMarketplaceData?.SHOP_CATEGORIES || [{ id: 'الكل', name: 'كل المنتجات' }];
    if (window.HubSettingsCenter?.render) {
      return window.HubSettingsCenter.render(s, shopCats);
    }
    // Fallback if settings center script failed to load
    return `<div class="card"><h3>إعدادات النظام</h3><p class="settings-lead">تعذّر تحميل مركز الإعدادات. أعد تحميل الصفحة.</p></div>`;
  };

  const SETTINGS_UI_ACTIONS = new Set([
    'sac-jump',
    'settings-help',
    'reset-color',
    'clear-media',
    'add-banner',
    'close-banner-modal',
    'save-banner-modal',
    'toggle-banner',
    'edit-banner',
    'duplicate-banner',
    'delete-banner',
    'discard-settings',
  ]);

  const renderers = {
    overview: renderOverview,
    operating: renderOperating,
    'posha-clients': () => (window.HubPoshaWS?.render ? HubPoshaWS.render({ user, toast, esc, bar, badgeStatus, fmtTime }) : '<div class="empty">تعذر تحميل عملاء هوب</div>'),
    'site-settings': () => (window.HubSiteSettingsUI?.render ? HubSiteSettingsUI.render() : '<div class="empty">تعذر تحميل إعدادات الموقع</div>'),
    'clients-mgmt': renderClientsMgmt,
    notifications: renderNotifications,
    'side-project-regs': renderSideProjectRegs,
    'content-articles': () => `<div id="articles-admin-mount"></div>`,
    'search-admin': () =>
      window.HubSearchAdminWS?.render
        ? HubSearchAdminWS.render({ user, toast, esc, bar, badgeStatus, fmtTime })
        : `<div class="empty">تعذر تحميل إدارة محرك بحث نايوش</div>`,
    'roles-permissions': () => (window.HubRolesWS?.render ? HubRolesWS.render({ user, toast, esc, bar, badgeStatus, fmtTime }) : '<div class="empty">تعذر تحميل الأدوار</div>'),
    'rent-admin': () => (window.HubRentAdminWS?.render ? HubRentAdminWS.render({ user, toast, esc, bar, badgeStatus, fmtTime }) : '<div class="empty">تعذر تحميل موافقات المدير الأعلى</div>'),
    blueprint: renderBlueprint,
    platforms: renderPlatforms,
    apps: renderApps,
    products: renderProductsPanel,
    store: renderStorePanel,
    'ads-studio': renderAdsStudio,
    'events-studio': renderEventsStudio,
    identity: renderIdentity,
    organization: renderOrganization,
    incubators: renderIncubators,
    wallet: renderWallet,
    core: renderCore,
    governance: renderGovernance,
    'info-security': renderInfoSecurity,
    'data-governance': renderDataGovernance,
    'systems-automation': renderSystemsAutomation,
    workforce: renderWorkforce,
    systems: renderSystems,
    tasks: renderTasks,
    measurement: renderMeasurement,
    reports: renderReports,
    integration: renderIntegration,
    settings: renderSettings,
  };

  const PRODUCT_ORDER_STATUS_LABELS = {
    received: 'تم استلام الطلب',
    payment_confirmed: 'تم تأكيد الدفع',
    under_review: 'قيد المراجعة',
    confirmed: 'تم التأكيد',
    in_progress: 'قيد التنفيذ',
    completed: 'مكتمل',
    cancelled: 'ملغي',
  };

  const authHeadersJson = () => {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const token = window.HubAuth?.getToken?.() || '';
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers['X-Hub-Token'] = token;
    }
    return headers;
  };

  const loadProductOrdersAdmin = async () => {
    const mount = document.getElementById('hub-product-orders-admin');
    if (!mount) return;
    try {
      const res = await fetch('/api/hub/product-orders', { headers: authHeadersJson(), cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        mount.innerHTML = `<div class="empty">${esc(data.error || 'تعذر تحميل طلبات المنتجات')}</div>`;
        return;
      }
      const orders = data.orders || [];
      const labels = data.statusLabels || PRODUCT_ORDER_STATUS_LABELS;
      if (!orders.length) {
        mount.innerHTML = '<div class="empty">لا توجد طلبات شراء منتجات بعد</div>';
        return;
      }
      const statusOpts = Object.keys(labels)
        .map((k) => `<option value="${esc(k)}">${esc(labels[k])}</option>`)
        .join('');
      mount.innerHTML = `<div class="table-wrap"><table class="data">
        <thead><tr>
          <th>رقم الطلب</th><th>العميل</th><th>المنتج</th><th>Product ID</th>
          <th>السعر</th><th>الإجمالي</th><th>الدفع</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th>
        </tr></thead>
        <tbody>
          ${orders
            .map((o) => {
              const pay =
                (data.paymentLabels && data.paymentLabels[o.paymentStatus]) || o.paymentStatus;
              return `<tr data-pord="${esc(o.id)}">
                <td><strong>${esc(o.number)}</strong></td>
                <td>${esc(o.customerName)}<br><small>${esc(o.customerEmail)}</small><br><small>ID: ${esc(o.customerId)}</small></td>
                <td>${esc(o.productName)}</td>
                <td><code>${esc(o.productId)}</code></td>
                <td>${money(o.unitPrice)}</td>
                <td>${money(o.total)}</td>
                <td>${esc(pay)}</td>
                <td>${esc(labels[o.orderStatus] || o.orderStatus)}</td>
                <td>${fmtTime(o.createdAt)}</td>
                <td>
                  <select data-pord-status="${esc(o.id)}" style="max-width:140px">${statusOpts.replace(
                    `value="${o.orderStatus}"`,
                    `value="${o.orderStatus}" selected`
                  )}</select>
                  <button type="button" class="btn btn-sm btn-primary" data-action="pord-set-status" data-id="${esc(o.id)}">تطبيق</button>
                  <button type="button" class="btn btn-sm btn-dark" data-action="pord-confirm" data-id="${esc(o.id)}">تأكيد</button>
                  <button type="button" class="btn btn-sm" data-action="pord-progress" data-id="${esc(o.id)}">تجهيز</button>
                  <button type="button" class="btn btn-sm btn-primary" data-action="pord-complete" data-id="${esc(o.id)}">إكمال</button>
                  <button type="button" class="btn btn-sm btn-ghost" data-action="pord-cancel" data-id="${esc(o.id)}">إلغاء</button>
                </td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table></div>`;
      // mark selected options correctly
      mount.querySelectorAll('[data-pord-status]').forEach((sel) => {
        const row = orders.find((o) => o.id === sel.getAttribute('data-pord-status'));
        if (row) sel.value = row.orderStatus;
      });
    } catch (err) {
      mount.innerHTML = `<div class="empty">${esc(err.message || 'تعذر تحميل الطلبات')}</div>`;
    }
  };

  const updateProductOrderStatus = async (id, status) => {
    const res = await fetch(`/api/hub/product-orders/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      headers: authHeadersJson(),
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || 'تعذر تحديث الحالة');
    return data.order;
  };

  const render = () => {
    root.innerHTML = `<section class="panel active">${renderers[current]()}</section>`;
    if (current === 'posha-clients' && window.HubPoshaClients?.mount) {
      const mount = document.getElementById('posha-mount');
      if (mount) window.HubPoshaClients.mount(mount);
    }
    if (current === 'site-settings' && window.HubSiteSettingsUI?.mount) {
      const mount = document.getElementById('site-settings-mount');
      if (mount) window.HubSiteSettingsUI.mount(mount);
    }
    if (current === 'content-articles' && window.HubArticlesAdmin?.mount) {
      const mount = document.getElementById('articles-admin-mount');
      if (mount) window.HubArticlesAdmin.mount(mount);
    }
    if (current === 'store') {
      loadProductOrdersAdmin();
    }
    if (current === 'settings' && window.HubSettingsCenter?.bind) {
      window.HubSettingsCenter.bind(root, {
        toast,
        onRequestRender: () => {
          applyDashboardChrome();
          render();
        },
      });
    }
    if (current === 'notifications' && window.HubNotificationsCenter?.afterPaint) {
      HubNotificationsCenter.afterPaint({
        user,
        toast,
        rerender: () => {
          renderNav();
          render();
        },
      });
    }
    if (current === 'search-admin' && window.HubSearchAdminWS?.afterPaint) {
      HubSearchAdminWS.afterPaint({
        user,
        toast,
        rerender: () => {
          renderNav();
          render();
        },
      });
    }
    if (current === 'roles-permissions' && window.HubTeamOpsUI?.afterPaint) {
      HubTeamOpsUI.afterPaint({
        user,
        toast,
        rerender: () => {
          renderNav();
          render();
        },
      });
    }
  };
  window.hubRerender = () => render();

  // —— Event delegation
  root.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-nav]');
    if (navBtn?.dataset?.nav) {
      activate(navBtn.dataset.nav);
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (SETTINGS_UI_ACTIONS.has(action)) return;

    if (String(action || '').startsWith('sec-') && window.HubInfoSecurity?.handle) {
      const handled = HubInfoSecurity.handle(action, btn, { user, toast, esc, $ });
      if (handled) {
        renderNav();
        render();
        return;
      }
    }

    if (String(action || '').startsWith('dg-') && window.HubDataGovernance?.handle) {
      const handled = HubDataGovernance.handle(action, btn, { user, toast, esc, $ });
      if (handled) {
        renderNav();
        render();
        return;
      }
    }

    if (String(action || '').startsWith('auto-') && window.HubSystemsAutomation?.handle) {
      const handled = HubSystemsAutomation.handle(action, btn, { user, toast, esc, $ });
      if (handled) {
        renderNav();
        render();
        return;
      }
    }

    if (String(action || '').startsWith('wf-') && window.HubWorkforce?.handle) {
      const handled = HubWorkforce.handle(action, btn, { user, toast, esc, $ });
      if (handled) {
        renderNav();
        render();
        return;
      }
    }

    if (String(action || '').startsWith('sm-') && window.HubSystemsMarket?.handle) {
      const handled = HubSystemsMarket.handle(action, btn, { user, toast, esc, $ });
      if (handled) {
        renderNav();
        render();
        return;
      }
    }

    if (String(action || '').startsWith('gov-') && window.HubGovernance?.handle) {
      const handled = HubGovernance.handle(action, btn, { user, toast, esc, $ });
      if (handled) {
        renderNav();
        render();
        return;
      }
    }

    const opsHandlers = [
      ['ov-', 'HubOverview'],
      ['op-', 'HubOperatingWS'],
      ['tk-', 'HubTasksWS'],
      ['ms-', 'HubMeasurementWS'],
      ['rp-', 'HubReportsWS'],
      ['ig-', 'HubIntegrationWS'],
      ['cr-', 'HubCoreWS'],
      ['cl-', 'HubClientsWS'],
      ['nt-', 'HubNotificationsWS'],
      ['sa-', 'HubSearchAdminWS'],
      ['sp-', 'HubSideProjectsWS'],
      ['hto-', 'HubRolesWS'],
      ['ag-', 'HubRolesWS'],
      ['rl-', 'HubRolesWS'],
      ['rn-', 'HubRentAdminWS'],
      ['ha-', 'HubRentAdminWS'],
      ['idn-', 'HubIdentityUI'],
      ['ps-', 'HubPoshaWS'],
    ];
    for (const [prefix, name] of opsHandlers) {
      if (String(action || '').startsWith(prefix) && window[name]?.handle) {
        const handled = window[name].handle(action, btn, { user, toast, esc, $ });
        if (handled) {
          renderNav();
          render();
          return;
        }
      }
    }

    switch (action) {
      case 'issue-decision': {
        const title = $('#decision-title')?.value.trim();
        const engine = $('#decision-engine')?.value;
        if (!title) return toast('اكتب نص القرار');
        HubStore.issueDecision(title, engine);
        toast('صدر قرار تشغيلي');
        break;
      }
      case 'exec-decision':
        HubStore.executeDecision(id);
        toast('تم تنفيذ القرار');
        break;
      case 'run-predict':
        HubStore.runPredictiveScan();
        toast('اكتمل المسح التنبؤي');
        break;
      case 'resolve-anomaly':
        HubStore.resolveAnomaly(id);
        toast('أُغلق الشذوذ');
        break;
      case 'gov-tab':
        govTab = btn.dataset.tab;
        break;
      case 'add-policy': {
        const title = $('#pol-title')?.value.trim();
        const scope = $('#pol-scope')?.value;
        if (!title) return toast('عنوان السياسة مطلوب');
        HubStore.addPolicy(title, scope);
        toast('أُضيفت مسودة سياسة');
        break;
      }
      case 'activate-policy':
        HubStore.activatePolicy(id);
        toast('فُعّلت السياسة');
        break;
      case 'issue-pr': {
        const type = $('#pr-type')?.value;
        const target = $('#pr-target')?.value.trim();
        const reason = $('#pr-reason')?.value.trim();
        let points = Number($('#pr-points')?.value || 0);
        if (!target || !reason) return toast('أكمل بيانات العقوبة/المكافأة');
        if (type === 'penalty' && points > 0) points = -Math.abs(points);
        if (type === 'reward') points = Math.abs(points);
        HubStore.issuePenaltyOrReward(type, target, reason, points);
        toast('تم الإصدار');
        break;
      }
      case 'add-constitution': {
        const article = $('#con-article')?.value.trim();
        const text = $('#con-text')?.value.trim();
        if (!article || !text) return toast('أكمل المادة والنص');
        HubStore.addConstitutionArticle(article, text);
        toast('أُضيفت مادة للدستور');
        break;
      }
      case 'tick-productivity':
        HubStore.tickProductivity();
        toast('تحدّثت الإنتاجية');
        break;
      case 'warn-emp':
        HubStore.warnEmployee(id);
        toast('صدر إنذار مبكر');
        break;
      case 'reward-emp':
        HubStore.rewardEmployee(id);
        toast('صرفت مكافأة تلقائية');
        break;
      case 'sync-all':
        HubStore.syncAllSystems();
        toast('تمت مزامنة كل الأنظمة');
        break;
      case 'sync-one':
        HubStore.syncSystem(id);
        toast('تمت المزامنة');
        break;
      case 'add-task': {
        const title = $('#task-title')?.value.trim();
        const details = $('#task-details')?.value.trim() || '';
        const assignee = $('#task-assignee')?.value;
        const priority = $('#task-priority')?.value;
        const project = $('#task-project')?.value.trim() || 'تشغيل يومي';
        const dueDate = $('#task-due')?.value || '';
        if (!title) return toast('عنوان المهمة مطلوب');
        HubStore.addTask(title, assignee, priority, project, { details, dueDate });
        toast('أُضيفت مهمة');
        break;
      }
      case 'task-status':
        HubStore.updateTaskStatus(id, btn.dataset.status);
        toast('تحدّثت حالة المهمة');
        break;
      case 'recalc-measure':
        HubStore.recalculateMeasurement();
        toast('أُعيد حساب القياس الموحد');
        break;
      case 'report-tab':
        reportTab = btn.dataset.tab;
        break;
      case 'gen-report':
        HubStore.generateReport(btn.dataset.type || reportTab);
        toast('التقرير جاهز للقائد الأعلى');
        break;
      case 'grant-sub': {
        const email = $('#op-sub-email')?.value.trim();
        const systemCode = $('#op-sub-system')?.value;
        const plan = $('#op-sub-plan')?.value.trim() || HubStore.getSettings?.()?.defaultGrantPlan || 'standard';
        if (!email || !systemCode) {
          toast('أدخل البريد والنظام');
          return;
        }
        HubStore.grantSubscription({ email, systemCode, plan, permissions: ['read', 'write'] });
        toast(`تم منح اشتراك ${systemCode}`);
        break;
      }
      case 'revoke-sub':
        HubStore.revokeSubscription(id);
        toast('أُلغي الاشتراك');
        break;
      case 'ping-gateway':
        HubStore.pingGateway();
        toast('فحص البوابة اكتمل');
        break;
      case 'toggle-connector':
        HubStore.toggleConnector(id);
        toast('تبدّلت حالة الموصل');
        break;
      case 'refresh-feed':
        toast('التدفق محدّث');
        break;
      case 'refresh-command':
        HubStore.refreshCommandStats();
        toast('تحدّث مركز التحكم');
        break;
      case 'advance-core':
        HubStore.advanceCoreModule(id);
        toast('تقدّم مكوّن Core Platform');
        break;
      case 'advance-priority':
        HubStore.advancePriority(id);
        toast('دُفعت أولوية التنفيذ');
        break;
      case 'add-incubator': {
        const name = $('#inc-name')?.value.trim();
        const sector = $('#inc-sector')?.value.trim();
        if (!name) return toast('اسم الحاضنة مطلوب');
        HubStore.addIncubator(name, sector);
        toast('أُنشئت حاضنة');
        break;
      }
      case 'wallet-topup': {
        const owner = $('#wallet-owner')?.value;
        const amount = $('#wallet-amount')?.value;
        if (!HubStore.topupWallet(owner, amount)) return toast('تعذّر الشحن');
        toast('تم شحن المحفظة');
        break;
      }
      case 'wallet-burn': {
        const owner = $('#wallet-owner')?.value;
        const amount = $('#wallet-amount')?.value;
        if (!HubStore.burnPoints(owner, amount)) return toast('رصيد غير كافٍ أو مبلغ غير صالح');
        toast('تم استهلاك النقاط');
        break;
      }
      case 'toggle-market':
        HubStore.toggleMarketplaceSystem(id);
        toast('تحدّثت حالة النظام في السوق');
        break;
      case 'register-app': {
        const code = $('#app-code')?.value.trim();
        const nameAr = $('#app-name')?.value.trim();
        const category = $('#app-cat')?.value.trim() || 'أنظمة نايوش';
        const url = $('#app-url')?.value.trim() || (code ? `systems/${code.toLowerCase()}.html` : 'apps.html');
        if (!code || !nameAr) return toast('رمز النظام والاسم مطلوبان');
        HubStore.registerApp({
          code,
          nameAr,
          category,
          url,
          launchUrl: url,
          standaloneUrl: url,
          hubPath: `apps.html#${code.toLowerCase()}`,
          kind: 'system',
          icon: 'fa-cube',
          supportsStandalone: true,
          launchViaHub: true,
        });
        toast('تم تسجيل النظام في هوب');
        break;
      }
      case 'toggle-app':
        HubStore.toggleApp(id);
        toast('تحدّثت حالة النظام');
        break;
      case 'mark-all-notifications':
        HubStore.markAllNotificationsRead?.();
        toast('تم تعليم كل الإشعارات كمقروءة');
        break;
      case 'read-notification':
        HubStore.markNotificationRead?.(id);
        toast('تم تعليم الإشعار كمقروء');
        break;
      case 'demo-hub-notification':
        HubStore.pushNotification?.({
          source: 'HUB',
          sourceName: 'غرفة العمليات',
          title: 'إشعار تجريبي من هوب',
          body: 'هذا يؤكد أن مركز الإشعارات الموحّد يستقبل تنبيهات كل الأنظمة.',
          level: 'info',
          category: 'system',
          link: 'dashboard.html#notifications',
        });
        toast('أُضيف إشعار إلى هوب');
        break;
      case 'sp-reg-contacted':
        window.HubSideProjectRegistrations?.setStatus?.(id, 'تم التواصل', 'تم التواصل من غرفة العمليات');
        toast('تم تسجيل التواصل مع صاحب المشروع');
        break;
      case 'sp-reg-details': {
        const rec = window.HubSideProjectRegistrations?.openDetails?.(id);
        if (!rec) toast('الطلب غير موجود');
        return;
      }
      case 'add-store-item': {
        const title = $('#store-title')?.value.trim();
        if (!title) return toast('اسم المنتج أو الخدمة مطلوب');
        HubStore.addStoreItem({
          title,
          price: $('#store-price')?.value,
          points: $('#store-points')?.value,
          platformCode: $('#store-platform')?.value.trim() || 'ACADEMY',
          category: $('#store-cat')?.value || 'أكاديمية',
          itemKind: $('#store-kind')?.value || 'منتج',
          brand: 'أكاديمية نايوش',
          desc: 'مرفوع من غرفة العمليات — متجر موحّد مع الأكاديمية',
          mirrorToCatalog: true,
        });
        toast('تم الرفع على المتجر');
        break;
      }
      case 'buy-store-item':
        if (!HubStore.placeStoreOrder(id, user.name || 'مشغّل هوب')) return toast('تعذّر البيع');
        toast('تم تسجيل عملية البيع');
        break;
      case 'pord-set-status': {
        const sel = root.querySelector(`[data-pord-status="${id}"]`);
        const status = sel?.value;
        if (!status) return toast('اختر حالة');
        updateProductOrderStatus(id, status)
          .then(() => {
            toast('تم تحديث حالة الطلب');
            loadProductOrdersAdmin();
          })
          .catch((err) => toast(err.message || 'تعذر التحديث'));
        return;
      }
      case 'pord-confirm':
        updateProductOrderStatus(id, 'confirmed')
          .then(() => {
            toast('تم تأكيد الطلب');
            loadProductOrdersAdmin();
          })
          .catch((err) => toast(err.message || 'تعذر التأكيد'));
        return;
      case 'pord-progress':
        updateProductOrderStatus(id, 'in_progress')
          .then(() => {
            toast('قيد التجهيز');
            loadProductOrdersAdmin();
          })
          .catch((err) => toast(err.message || 'تعذر التحديث'));
        return;
      case 'pord-complete':
        updateProductOrderStatus(id, 'completed')
          .then(() => {
            toast('اكتمل الطلب');
            loadProductOrdersAdmin();
          })
          .catch((err) => toast(err.message || 'تعذر الإكمال'));
        return;
      case 'pord-cancel':
        updateProductOrderStatus(id, 'cancelled')
          .then(() => {
            toast('أُلغي الطلب');
            loadProductOrdersAdmin();
          })
          .catch((err) => toast(err.message || 'تعذر الإلغاء'));
        return;
      case 'add-ad': {
        const title = $('#ad-title')?.value.trim();
        if (!title) return toast('عنوان الإعلان مطلوب');
        HubStore.addAdListing({
          title,
          content: 'إعلان منتج منصة من استوديو الإعلانات',
          price: $('#ad-price')?.value,
          category: $('#ad-cat')?.value.trim() || 'تشغيل',
          platformCode: $('#ad-platform')?.value.trim(),
          type: 'منتج منصة',
        });
        toast('نُشر إعلان المنتج');
        break;
      }
      case 'toggle-ad':
        HubStore.toggleAd(id);
        toast('تحدّثت حالة الإعلان');
        break;
      case 'add-event': {
        const name = $('#ev-name')?.value.trim();
        if (!name) return toast('اسم الفعالية مطلوب');
        HubStore.addEvent({
          name,
          description: 'فعالية مُدارة من استوديو الفعاليات في هوب',
          date: $('#ev-date')?.value || undefined,
          time: $('#ev-time')?.value || undefined,
          type: $('#ev-type')?.value.trim() || 'بث مباشر',
        });
        toast('أُنشئت الفعالية');
        break;
      }
      case 'save-settings': {
        const patch = window.HubSettingsCenter?.collectDraft
          ? window.HubSettingsCenter.collectDraft(root)
          : (() => {
              const p = {};
              root.querySelectorAll('[data-set]').forEach((el) => {
                const key = el.dataset.set;
                if (!key || el.disabled) return;
                p[key] = el.type === 'checkbox' ? el.checked : el.value;
              });
              return p;
            })();
        const hexKeys = ['primaryColor', 'secondaryColor', 'accentColor', 'bgColor', 'textColor', 'surfaceColor'];
        for (const k of hexKeys) {
          if (patch[k] && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(patch[k]))) {
            toast(`يرجى إدخال لون صحيح بصيغة HEX للحقل: ${k}`);
            return;
          }
        }
        HubStore.saveSettings(patch);
        applyDashboardChrome();
        toast('تم حفظ التغييرات بنجاح ✓');
        break;
      }
      case 'reset-settings': {
        if (!confirm('إعادة كل الإعدادات الداخلية إلى القيم الافتراضية؟')) return;
        HubStore.resetSettings();
        applyDashboardChrome();
        toast('أُعيدت الإعدادات للافتراضي');
        break;
      }
      case 'export-settings': {
        const blob = new Blob([JSON.stringify(HubStore.getSettings(), null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'naiosh-hub-settings.json';
        a.click();
        URL.revokeObjectURL(a.href);
        toast('تم تنزيل ملف الإعدادات');
        return;
      }
      default:
        break;
    }
    renderNav();
    render();
  });

  root.addEventListener('change', (e) => {
    const importInput = e.target.closest('#settings-import');
    if (importInput?.files?.[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result || '{}'));
          if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid');
          HubStore.saveSettings(data);
          applyDashboardChrome();
          toast('تم استيراد الإعدادات');
          renderNav();
          render();
        } catch {
          toast('ملف إعدادات غير صالح');
        }
      };
      reader.readAsText(importInput.files[0]);
      importInput.value = '';
      return;
    }
    const secEl = e.target.closest('[data-sec-change]');
    if (secEl && window.HubInfoSecurity?.handleChange) {
      if (HubInfoSecurity.handleChange(secEl)) {
        render();
      }
      return;
    }
    const dgEl = e.target.closest('[data-dg-change]');
    if (dgEl && window.HubDataGovernance?.handleChange) {
      if (HubDataGovernance.handleChange(dgEl)) {
        render();
      }
      return;
    }
    const autoEl = e.target.closest('[data-auto-change]');
    if (autoEl && window.HubSystemsAutomation?.handleChange) {
      if (HubSystemsAutomation.handleChange(autoEl)) {
        render();
      }
      return;
    }
    const wfEl = e.target.closest('[data-wf-change]');
    if (wfEl && window.HubWorkforce?.handleChange) {
      if (HubWorkforce.handleChange(wfEl)) {
        render();
      }
      return;
    }
    const smEl = e.target.closest('[data-sm-change]');
    if (smEl && window.HubSystemsMarket?.handleChange) {
      if (HubSystemsMarket.handleChange(smEl)) {
        render();
      }
      return;
    }
    const govEl = e.target.closest('[data-gov-change]');
    if (govEl && window.HubGovernance?.handleChange) {
      if (HubGovernance.handleChange(govEl)) {
        render();
      }
      return;
    }
    const tkEl = e.target.closest('[data-tk-change]');
    if (tkEl && window.HubTasksWS?.handleChange) {
      if (HubTasksWS.handleChange(tkEl)) {
        render();
      }
      return;
    }
    const crEl = e.target.closest('[data-cr-change]');
    if (crEl && window.HubCoreWS?.handleChange) {
      if (HubCoreWS.handleChange(crEl)) {
        render();
      }
      return;
    }
    const clEl = e.target.closest('[data-cl-change]');
    if (clEl && window.HubClientsWS?.handleChange) {
      if (HubClientsWS.handleChange(clEl)) {
        render();
      }
      return;
    }
    const ntEl = e.target.closest('[data-nt-change]');
    if (ntEl && window.HubNotificationsWS?.handleChange) {
      if (HubNotificationsWS.handleChange(ntEl)) {
        render();
      }
      return;
    }
    const spEl = e.target.closest('[data-sp-change], [data-sp-status]');
    if (spEl && window.HubSideProjectsWS?.handleChange) {
      if (HubSideProjectsWS.handleChange(spEl)) {
        render();
      }
      return;
    }
    if (e.target.closest?.('[data-ha-q]') || e.target.matches?.('[data-ha-field="value"]')) {
      return;
    }
    const sel = e.target.closest('[data-action="sp-reg-status"]');
    if (!sel) return;
    const id = sel.dataset.id;
    const status = sel.value;
    window.HubSideProjectRegistrations?.setStatus?.(id, status, `تحديث الحالة من غرفة العمليات إلى ${status}`);
    toast(`تم تحديث الحالة: ${status}`);
    render();
  });

  const panelFromHash = () => {
    const raw = (window.location.hash || '#overview').replace(/^#/, '');
    const key = raw.split('?')[0].split('&')[0] || 'overview';
    return TITLES[key] ? key : 'overview';
  };

  const hash = panelFromHash();
  activate(hash);

  window.addEventListener('hashchange', () => {
    const next = panelFromHash();
    if (next !== current) activate(next);
  });

  window.addEventListener('hub-notifications-changed', () => {
    if (current === 'notifications' || current === 'search-admin') {
      try {
        render();
      } catch (_) {}
    }
  });

  window.addEventListener('hub-ha-rerender', () => {
    if (current === 'rent-admin') {
      try {
        render();
      } catch (_) {}
    }
  });

  window.addEventListener('hub-higher-approvals-changed', () => {
    if (current === 'rent-admin') {
      try {
        render();
      } catch (_) {}
    }
  });
})();
