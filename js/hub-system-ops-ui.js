/**
 * واجهة تنفيذ آلية تشغيل الأنظمة
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-system-ops]');
  if (!root || !window.HubSystemOps || !window.HubSystemOpsSpec) return;

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const params = new URLSearchParams(location.search);
  let tab = params.get('tab') || 'panel';
  let user = localStorage.getItem('naiosh_system_ops_user') || 'مالك تجريبي';
  let systemCode = window.HubSystemOps.read().activeSystem || 'ERP';

  const toast = (msg) => {
    let el = document.getElementById('sysops-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sysops-toast';
      el.className = 'sysops-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('is-on'), 2600);
  };

  const branchOrHqOptions = () => {
    const branches = window.HubBranchesData?.BRANCHES || [];
    if (branches.length) {
      return branches.map((b) => {
        const isHq = String(b.code || '').toUpperCase() === 'HQ' || /مقر|المكتب الرئيسي/i.test(b.nameAr || '');
        const label = isHq ? 'المكتب الرئيسي' : b.nameAr;
        const value = isHq ? 'المكتب الرئيسي' : b.nameAr;
        return { value, label: `${label}${b.erpCode ? ` · ${b.erpCode}` : ''}` };
      });
    }
    return [
      { value: 'المكتب الرئيسي', label: 'المكتب الرئيسي' },
      { value: 'السعودية', label: 'السعودية' },
      { value: 'مصر', label: 'مصر' },
      { value: 'الإمارات', label: 'الإمارات' },
    ];
  };

  const incubatorOptions = () => {
    const list = window.HubIncubatorsData?.INCUBATORS || [];
    if (list.length) {
      return list.map((i) => ({
        value: i.name,
        label: `${i.num ? `INC-${String(i.num).padStart(3, '0')} · ` : ''}${i.name}`,
      }));
    }
    return [
      { value: 'التعليم والتعلم', label: 'التعليم والتعلم' },
      { value: 'التسويق الرقمي', label: 'التسويق الرقمي' },
      { value: 'عالم الأعمال', label: 'عالم الأعمال' },
    ];
  };

  const selectOptionsHtml = (items, placeholder) =>
    `<option value="">${esc(placeholder)}</option>${items
      .map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`)
      .join('')}`;

  const grantHierarchyFields = () => `
    <label>الفرع أو المكتب الرئيسي
      <select name="branchOrHq" required>${selectOptionsHtml(branchOrHqOptions(), '— اختر فرعًا أو المكتب الرئيسي —')}</select>
    </label>
    <label>الحاضنة
      <select name="incubator" required>${selectOptionsHtml(incubatorOptions(), '— اختر الحاضنة —')}</select>
    </label>
    <label>اسم المنصة
      <input name="platformName" required placeholder="اسم المنصة" />
    </label>`;

  const systems = ['ERP', 'NAIS', 'LAW', 'ACADEMY', 'FIT', 'LMS', 'CRM'];

  const paintKpis = () => {
    const box = root.querySelector('[data-ops-kpis]');
    if (!box) return;
    const s = window.HubSystemOps.stats();
    box.innerHTML = [
      ['دومينات فرعية', s.subdomains],
      ['هياكل ممنوحة', s.structures],
      ['أدوار', s.roles],
      ['عضويات', s.memberships],
      ['شهادات', s.certificates],
      ['صفحات', s.pages],
      ['إيجارات', s.rentals],
      ['ERPI فعّال', s.erpiOn],
      ['قانوني فعّال', s.lawOn],
      ['أصول', s.assets],
      ['وفر التكلفة', s.costSaving],
    ]
      .map(([l, n]) => `<article class="sysops-kpi"><strong>${esc(String(n))}</strong><span>${esc(l)}</span></article>`)
      .join('');
  };

  const paintSidebar = () => {
    const nav = root.querySelector('[data-ops-sidebar]');
    if (!nav) return;
    const items = window.HubSystemOps.sidebarFor(user, systemCode);
    const onRolesPage = /roles-permissions\.html/i.test(window.location.pathname || '');
    nav.innerHTML = items
      .map((i) => {
        const t = (i.href.match(/tab=([^&]+)/) || [])[1] || (i.id === 'home' ? 'panel' : '');
        const isExternalPage = /\.html(?:$|\?)/i.test(i.href) && !/system-ops\.html/i.test(i.href);
        const active =
          (i.id === 'roles' && (onRolesPage || tab === 'access')) ||
          (!isExternalPage && (t === tab || (i.id === 'home' && tab === 'panel')));
        const icon = i.icon ? `fas ${esc(i.icon)}` : 'fas fa-angle-left';
        const tabAttr = isExternalPage ? '' : ` data-tab-link="${esc(t || 'panel')}"`;
        return `<a class="${active ? 'is-active' : ''}" href="${esc(i.href)}"${tabAttr}><i class="${icon}"></i> ${esc(i.label)}</a>`;
      })
      .join('');
  };

  const paintCaps = () => {
    const box = root.querySelector('[data-ops-caps]');
    if (!box) return;
    box.innerHTML = window.HubSystemOpsSpec.CAPABILITIES.map(
      (c) => `<article class="sysops-cap" data-cap="${esc(c.id)}">
        <i class="fas ${esc(c.icon)}"></i>
        <div><strong>${esc(c.label)}</strong><small>${esc(c.group)}</small></div>
      </article>`
    ).join('');
  };

  const section = (title, body) =>
    `<section class="sysops-section"><h2>${esc(title)}</h2>${body}</section>`;

  const listRows = (rows, render) =>
    rows.length ? `<div class="sysops-list">${rows.map(render).join('')}</div>` : '<p class="sysops-empty">لا توجد عناصر بعد.</p>';

  const paintPanel = () => {
    const host = root.querySelector('[data-ops-main]');
    if (!host) return;
    const state = window.HubSystemOps.read();
    const perms = window.HubSystemOps.permsFor(user, systemCode);

    if (tab === 'panel') {
      host.innerHTML =
        section(
          'لوحة التحكم حسب الأدوار والصلاحيات',
          `<div class="sysops-form-row">
            <label>المستخدم الحالي<input data-user-input value="${esc(user)}" /></label>
            <label>النظام
              <select data-system-select>${systems
                .map((c) => `<option value="${c}" ${c === systemCode ? 'selected' : ''}>${c}</option>`)
                .join('')}</select>
            </label>
            <button type="button" class="btn btn-primary" data-open-tenant><i class="fas fa-cube"></i> افتح نظام المستأجر</button>
          </div>
          <p class="sysops-note">الصلاحيات الحالية: <b>${esc(perms.join(' · ') || 'قراءة افتراضية')}</b></p>
          <div class="sysops-actions">
            <a class="btn btn-secondary" href="info-center.html">مركز معلومات هوب</a>
            <a class="btn btn-secondary" href="ads.html">صفحات الإعلانات</a>
            <a class="btn btn-secondary" href="packages.html">باقات الاشتراك</a>
            <a class="btn btn-secondary" href="products.html">منتجات نايوش</a>
            <a class="btn btn-secondary" href="login.html">إنشاء حساب / دخول</a>
          </div>`
        ) +
        section(
          'سجل التشغيل',
          listRows(state.opsLog.slice(0, 12), (l) => `<article><strong>${esc(l.action)}</strong><span>${esc(l.detail)}</span><small>${esc(l.at)}</small></article>`)
        );
      return;
    }

    if (tab === 'grants') {
      host.innerHTML =
        section(
          'منح دومين فرعي للمستأجرين',
          `<form class="sysops-form" data-form="subdomain">
            <label>اسم المستأجر
              <input name="tenantName" required placeholder="اسم المستأجر" />
            </label>
            ${grantHierarchyFields()}
            <label>النظام
              <select name="systemCode">${systems.map((c) => `<option>${c}</option>`).join('')}</select>
            </label>
            <label>النطاق الأساسي
              <input name="baseDomain" value="naiosh.app" />
            </label>
            <button type="submit" class="btn btn-primary">منح صب دومين</button>
          </form>
          ${listRows(
            state.subdomains.slice(0, 20),
            (r) =>
              `<article><strong>${esc(r.grantId || '')} · ${esc(r.host)}</strong><span>${esc(r.tenantName)} · ${esc(r.systemCode)} · ${esc(r.branchOrHq || '—')} · ${esc(r.incubator || '—')} · ${esc(r.platformName || '—')}</span></article>`
          )}`
        ) +
        section(
          'منح فروع · حاضنات · منصات · مكاتب إلكترونية',
          `<form class="sysops-form" data-form="structure">
            <select name="type">${window.HubSystemOpsSpec.STRUCTURE_TYPES.map(
              (t) => `<option value="${esc(t.id)}">${esc(t.nameAr)}</option>`
            ).join('')}</select>
            <input name="nameAr" required placeholder="الاسم" />
            <input name="tenantName" placeholder="المستأجر" value="مستأجر تجريبي" />
            <select name="systemCode">${systems.map((c) => `<option>${c}</option>`).join('')}</select>
            <button class="btn btn-primary">منح</button>
          </form>
          ${listRows(state.structures.slice(0, 20), (r) => `<article><strong>${esc(r.grantId || '')} · ${esc(r.nameAr)}</strong><span>${esc(r.type)} · ${esc(r.tenantName)} · ${esc(r.systemCode)}</span></article>`)}`
        ) +
        section(
          'استئجار منصة + دومين فرعي',
          `<form class="sysops-form" data-form="rent">
            ${grantHierarchyFields()}
            <label>المستأجر
              <input name="tenantName" placeholder="المستأجر" />
            </label>
            <label>النظام
              <select name="systemCode">${systems.map((c) => `<option>${c}</option>`).join('')}</select>
            </label>
            <button type="submit" class="btn btn-primary">استأجر وامنح الدومين</button>
          </form>
          ${listRows(
            state.rentals.slice(0, 20),
            (r) =>
              `<article><strong>${esc(r.platformName || r.nameAr)}</strong><span>${esc(r.host)} · ${esc(r.branchOrHq || '—')} · ${esc(r.incubator || '—')} · ${esc(r.status)}</span></article>`
          )}`
        );
      return;
    }

    if (tab === 'access') {
      host.innerHTML =
        section(
          'إدارة الأدوار والصلاحيات',
          `<p class="sysops-note">نفس صفحة ERP بالكامل: الأدوار · مصفوفة الصلاحيات · المستخدمون · سجل التدقيق · صفحات المكاتب والمستأجرين · القائمة حسب نوع الحساب.</p>
          <div class="sysops-actions">
            <a class="btn btn-primary" href="roles-permissions.html"><i class="fas fa-shield-alt"></i> فتح إدارة الأدوار والصلاحيات</a>
            <a class="btn btn-secondary" href="roles-permissions.html?tab=permissions">مصفوفة صلاحيات الأنظمة</a>
            <a class="btn btn-secondary" href="roles-permissions.html?tab=users">المستخدمون وتعيين الأدوار</a>
          </div>`
        ) +
        section(
          'تعيين سريع داخل غرفة التشغيل',
          `<form class="sysops-form" data-form="role">
            <input name="user" required placeholder="اسم المستخدم" value="${esc(user)}" />
            <select name="roleId">${window.HubSystemOpsSpec.ROLES.map(
              (r) => `<option value="${esc(r.id)}">${esc(r.nameAr)} (${esc(r.perms.join(','))})</option>`
            ).join('')}</select>
            <select name="systemCode">${systems.map((c) => `<option>${c}</option>`).join('')}</select>
            <button class="btn btn-primary">تعيين الدور</button>
          </form>
          ${listRows(state.roleAssignments.slice(0, 30), (r) => `<article><strong>${esc(r.user)}</strong><span>${esc(r.roleName)} · ${esc(r.systemCode)} · ${esc((r.perms || []).join(' · '))}</span></article>`)}`
        ) +
        section(
          'تسجيل العضويات ومنح الصلاحيات وشهادات العضوية',
          `<form class="sysops-form" data-form="membership">
            <input name="name" required placeholder="اسم العضو" />
            <input name="email" type="email" placeholder="البريد" />
            <select name="plan"><option>زائر</option><option selected>تشغيلي</option><option>سيادي</option></select>
            <select name="systemCode">${systems.map((c) => `<option>${c}</option>`).join('')}</select>
            <button class="btn btn-primary">تسجيل + إصدار شهادة</button>
          </form>
          ${listRows(state.memberships.slice(0, 15), (m) => `<article><strong>${esc(m.name)}</strong><span>${esc(m.plan)} · ${esc(m.systemCode)} · ${esc(m.status)}</span></article>`)}
          <h3>الشهادات</h3>
          ${listRows(state.certificates.slice(0, 15), (c) => `<article><strong>${esc(c.title)}</strong><span>${esc(c.systemCode)}</span></article>`)}`
        );
      return;
    }

    if (tab === 'catalog') {
      host.innerHTML =
        section(
          'منتجات نايوش المعروضة في النظام',
          `<div class="sysops-chips">${window.HubSystemOpsSpec.NAIOSH_PRODUCTS.map((p) => `<span>${esc(p)}</span>`).join('')}
            <a class="btn btn-secondary" href="products.html">فتح المنتجات</a>
            <a class="btn btn-secondary" href="apps.html">فتح الأنظمة</a>
          </div>`
        ) +
        section(
          'خدمات نايوش',
          `<div class="sysops-chips">${window.HubSystemOpsSpec.NAIOSH_SERVICES.map((p) => `<span>${esc(p)}</span>`).join('')}
            <a class="btn btn-secondary" href="branches.html">الفروع</a>
            <a class="btn btn-secondary" href="incubators.html">الحاضنات</a>
            <a class="btn btn-secondary" href="packages.html">الاشتراكات</a>
          </div>`
        ) +
        section(
          'باقات الاشتراكات · الأسعار',
          `<a class="btn btn-primary" href="packages.html">فتح الباقات والأسعار</a>
           <a class="btn btn-secondary" href="membership.html">العضوية</a>
           <a class="btn btn-secondary" href="store.html">المتجر</a>`
        );
      return;
    }

    if (tab === 'blog') {
      host.innerHTML = section(
        'مدونة النظام · المقالات والمنشورات',
        `<form class="sysops-form" data-form="blog">
          <input name="title" required placeholder="عنوان المقال" />
          <textarea name="body" rows="3" placeholder="المحتوى / الثقافة المجتمعية"></textarea>
          <select name="systemCode">${systems.map((c) => `<option>${c}</option>`).join('')}</select>
          <button class="btn btn-primary">نشر</button>
          <a class="btn btn-secondary" href="blog.html">مدونة هوب العامة</a>
        </form>
        ${listRows(state.blogPosts.slice(0, 20), (p) => `<article><strong>${esc(p.title)}</strong><span>${esc(p.body)}</span><small>${esc(p.systemCode)}</small></article>`)}`
      );
      return;
    }

    if (tab === 'pages') {
      host.innerHTML = section(
        'أنشئ صفحتك على النظام وعلى هوب',
        `<form class="sysops-form" data-form="page">
          <input name="title" required placeholder="عنوان الصفحة" />
          <select name="kind"><option value="tenant">صفحة مستأجر</option><option value="facility">منشأة</option><option value="brand">هوية</option></select>
          <select name="systemCode">${systems.map((c) => `<option>${c}</option>`).join('')}</select>
          <button class="btn btn-primary">إنشاء على النظام وهوب</button>
        </form>
        ${listRows(state.pages.slice(0, 20), (p) => `<article><strong>${esc(p.title)}</strong><span>${esc(p.kind)} · ${esc(p.systemCode)}</span>
          <div class="sysops-inline"><a href="${esc(p.hubUrl)}">على هوب</a> · <a href="${esc(p.systemUrl)}">على النظام</a></div></article>`)}`
      );
      return;
    }

    if (tab === 'erpi') {
      host.innerHTML = section(
        'نظام ERPI · وحدات التشغيل المحوكمة',
        `<p class="sysops-note">إدارة استراتيجية تربط مكونات النظام حسب طبيعة النظام — فعّل كل وحدة لتعمل داخل مسار التشغيل.</p>
        <div class="sysops-modules">${window.HubSystemOpsSpec.ERPI_MODULES.map((m) => {
          const on = !!state.erpiActive[m];
          return `<button type="button" class="sysops-mod ${on ? 'is-on' : ''}" data-erpi="${esc(m)}">${esc(m)}</button>`;
        }).join('')}</div>`
      );
      return;
    }

    if (tab === 'law') {
      host.innerHTML =
        section(
          'الوحدات القانونية · حسب الأدوار والصلاحيات',
          `<div class="sysops-modules">${window.HubSystemOpsSpec.LAW_MODULES.map((m) => {
            const on = !!state.lawActive[m];
            return `<button type="button" class="sysops-mod ${on ? 'is-on' : ''}" data-law="${esc(m)}">${esc(m)}</button>`;
          }).join('')}</div>`
        ) +
        section(
          'التصنيف القانوني التشغيلي',
          `<div class="sysops-modules sysops-modules--dense">${window.HubSystemOpsSpec.LAW_TAXONOMY.map((m) => {
            const on = !!state.lawTaxonomyActive[m];
            return `<button type="button" class="sysops-mod ${on ? 'is-on' : ''}" data-law-tax="${esc(m)}">${esc(m)}</button>`;
          }).join('')}</div>`
        );
      return;
    }

    if (tab === 'assets') {
      host.innerHTML =
        section(
          'السيطرة على مقدرات المستأجرين والأصول',
          `<form class="sysops-form" data-form="asset">
            <input name="tenantName" required placeholder="المستأجر / المنشأة" />
            <select name="kind"><option>فرع</option><option>موظف</option><option>أصل ثابت</option><option>مؤسسة</option><option>منصة</option></select>
            <input name="nameAr" required placeholder="اسم الأصل / المورد" />
            <input name="value" type="number" placeholder="قيمة" value="0" />
            <button class="btn btn-primary">تسجيل تحت السيطرة</button>
          </form>
          ${listRows(state.assets.slice(0, 30), (a) => `<article><strong>${esc(a.nameAr)}</strong><span>${esc(a.tenantName)} · ${esc(a.kind)} · ${Number(a.value).toLocaleString('en-US')}</span></article>`)}`
        ) +
        section(
          'منظمة متكاملة لخفض التكاليف',
          `<form class="sysops-form" data-form="cost">
            <input name="title" required placeholder="إجراء خفض تكلفة" />
            <input name="saving" type="number" placeholder="الوفر المتوقع" value="1000" />
            <button class="btn btn-primary">تسجيل إجراء</button>
          </form>
          ${listRows(state.costActions.slice(0, 20), (c) => `<article><strong>${esc(c.title)}</strong><span>وفر ${Number(c.saving).toLocaleString('en-US')}</span></article>`)}`
        );
      return;
    }

    if (tab === 'tenant') {
      host.innerHTML = section(
        'أيقونة النظام الخاص بالمستأجر · مكان تشغيل المنشآت',
        `<div class="sysops-actions">
          ${systems
            .map(
              (c) =>
                `<button type="button" class="btn btn-primary" data-launch-code="${c}"><i class="fas fa-cube"></i> ${esc(
                  window.HubLauncher?.SYSTEM_META?.[c]?.nameAr || c
                )}</button>`
            )
            .join('')}
        </div>
        <p class="sysops-note">مكان تشغيل للمنشآت والشركات والمصانع والمتاجر والمشاريع — وتنفيذ كل عمليات المنشأة من لوحة النظام حسب الصلاحية.</p>
        <div class="sysops-actions">
          <a class="btn btn-secondary" href="office.html">مكتب المستأجر في هوب</a>
          <a class="btn btn-secondary" href="platforms.html">المنصات</a>
          <a class="btn btn-secondary" href="branches.html">الفروع</a>
          <a class="btn btn-secondary" href="incubators.html">الحاضنات</a>
        </div>`
      );
      return;
    }

    host.innerHTML = section('لوحة التشغيل', '<p>اختر قسمًا من المنيو الجانبي.</p>');
  };

  const paint = () => {
    paintKpis();
    paintSidebar();
    paintCaps();
    paintPanel();
    const title = root.querySelector('[data-ops-title]');
    if (title) title.textContent = `آلية تشغيل الأنظمة · ${systemCode}`;
  };

  root.addEventListener('click', (e) => {
    const tabLink = e.target.closest('[data-tab-link]');
    if (tabLink) {
      e.preventDefault();
      tab = tabLink.dataset.tabLink || 'panel';
      history.replaceState({}, '', `system-ops.html?tab=${encodeURIComponent(tab)}`);
      paint();
      return;
    }
    const openTenant = e.target.closest('[data-open-tenant]');
    if (openTenant) {
      window.HubSystemOps.openTenantSystem(systemCode);
      return;
    }
    const launch = e.target.closest('[data-launch-code]');
    if (launch) {
      window.HubSystemOps.openTenantSystem(launch.dataset.launchCode);
      return;
    }
    const erpi = e.target.closest('[data-erpi]');
    if (erpi) {
      const name = erpi.dataset.erpi;
      const on = !window.HubSystemOps.read().erpiActive[name];
      window.HubSystemOps.toggleErpi(name, on);
      toast(on ? `تم تفعيل: ${name}` : `تم إيقاف: ${name}`);
      paint();
      return;
    }
    const law = e.target.closest('[data-law]');
    if (law) {
      const name = law.dataset.law;
      const on = !window.HubSystemOps.read().lawActive[name];
      window.HubSystemOps.toggleLaw(name, on);
      toast(on ? `تم تفعيل: ${name}` : `تم إيقاف: ${name}`);
      paint();
      return;
    }
    const tax = e.target.closest('[data-law-tax]');
    if (tax) {
      const name = tax.dataset.lawTax;
      const on = !window.HubSystemOps.read().lawTaxonomyActive[name];
      window.HubSystemOps.toggleLawTaxonomy(name, on);
      toast(on ? `تم تفعيل: ${name}` : `تم إيقاف: ${name}`);
      paint();
      return;
    }
    const cap = e.target.closest('[data-cap]');
    if (cap) {
      const map = {
        'subdomain-center': 'grants',
        'subdomain-grant': 'grants',
        'grant-structure': 'grants',
        'grant-structure-2': 'grants',
        'rent-platform': 'grants',
        'roles-perms': 'access',
        membership: 'access',
        'account-login': 'access',
        'sidebar-access': 'panel',
        'control-panel': 'panel',
        'role-panel': 'panel',
        'show-products': 'catalog',
        'show-services': 'catalog',
        packages: 'catalog',
        'ads-pages': 'catalog',
        'system-blog': 'blog',
        'info-center': 'panel',
        'create-page': 'pages',
        'tenant-system-icon': 'tenant',
        'facility-ops': 'tenant',
        'exec-ops': 'tenant',
        erpi: 'erpi',
        legal: 'law',
        'tenant-control': 'assets',
        'cost-org': 'assets',
      };
      tab = map[cap.dataset.cap] || 'panel';
      history.replaceState({}, '', `system-ops.html?tab=${encodeURIComponent(tab)}`);
      paint();
    }
  });

  root.addEventListener('change', (e) => {
    if (e.target.matches('[data-system-select]')) {
      systemCode = e.target.value;
      window.HubSystemOps.setActiveSystem(systemCode);
      paint();
    }
    if (e.target.matches('[data-user-input]')) {
      user = e.target.value.trim() || user;
      localStorage.setItem('naiosh_system_ops_user', user);
      paint();
    }
  });

  root.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const fd = new FormData(form);
    const type = form.dataset.form;
    if (type === 'subdomain') {
      const row = window.HubSystemOps.grantSubdomain({
        tenantName: fd.get('tenantName'),
        systemCode: fd.get('systemCode'),
        baseDomain: fd.get('baseDomain'),
        branchOrHq: fd.get('branchOrHq'),
        incubator: fd.get('incubator'),
        platformName: fd.get('platformName'),
      });
      toast(`تم منح الدومين: ${row.grantId || ''} · ${row.host} · ${row.platformName || ''}`);
    }
    if (type === 'structure') {
      const row = window.HubSystemOps.grantStructure({
        type: fd.get('type'),
        nameAr: fd.get('nameAr'),
        tenantName: fd.get('tenantName'),
        systemCode: fd.get('systemCode'),
      });
      toast(`تم منح الهيكل: ${row.grantId || ''} · ${row.nameAr || ''}`);
    }
    if (type === 'rent') {
      const r = window.HubSystemOps.rentPlatform({
        nameAr: fd.get('platformName'),
        tenantName: fd.get('tenantName'),
        systemCode: fd.get('systemCode'),
        branchOrHq: fd.get('branchOrHq'),
        incubator: fd.get('incubator'),
        platformName: fd.get('platformName'),
      });
      toast(`تم الاستئجار: ${r.rental.host} · ${r.rental.platformName || ''}`);
    }
    if (type === 'role') {
      const row = window.HubSystemOps.assignRole({
        user: fd.get('user'),
        roleId: fd.get('roleId'),
        systemCode: fd.get('systemCode'),
      });
      user = row.user;
      localStorage.setItem('naiosh_system_ops_user', user);
      toast(`تم تعيين: ${row.roleName}`);
    }
    if (type === 'membership') {
      const r = window.HubSystemOps.registerMembership({
        name: fd.get('name'),
        email: fd.get('email'),
        plan: fd.get('plan'),
        systemCode: fd.get('systemCode'),
      });
      toast(`عضوية + شهادة: ${r.cert.title}`);
    }
    if (type === 'blog') {
      window.HubSystemOps.publishPost({
        title: fd.get('title'),
        body: fd.get('body'),
        systemCode: fd.get('systemCode'),
      });
      toast('تم النشر');
    }
    if (type === 'page') {
      const p = window.HubSystemOps.createPage({
        title: fd.get('title'),
        kind: fd.get('kind'),
        systemCode: fd.get('systemCode'),
      });
      toast(`تم إنشاء الصفحة: ${p.title}`);
    }
    if (type === 'asset') {
      window.HubSystemOps.registerAsset({
        tenantName: fd.get('tenantName'),
        kind: fd.get('kind'),
        nameAr: fd.get('nameAr'),
        value: fd.get('value'),
      });
      toast('تم تسجيل الأصل تحت السيطرة');
    }
    if (type === 'cost') {
      window.HubSystemOps.recordCostAction({ title: fd.get('title'), saving: fd.get('saving') });
      toast('تم تسجيل إجراء خفض التكلفة');
    }
    form.reset();
    paint();
  });

  paint();
})();
