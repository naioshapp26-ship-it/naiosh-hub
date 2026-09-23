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
  let activeCap = '';

  /** كل مربع → تبويب + قسم مستهدف داخل الصفحة (بدون تكرار محتوى) */
  const CAP_TARGETS = {
    'subdomain-center': { external: 'rent-admin.html' },
    'subdomain-grant': { external: 'rent-admin.html' },
    'facility-ops': { tab: 'tenant', section: 'sysops-tenant-launch' },
    'exec-ops': { tab: 'tenant', section: 'sysops-tenant-launch' },
    'grant-structure': { tab: 'grants', section: 'sysops-grants-policy' },
    'grant-structure-2': { tab: 'grants', section: 'sysops-grants-structures' },
    'rent-platform': { tab: 'grants', section: 'sysops-grants-policy' },
    'roles-perms': { tab: 'access', section: 'sysops-access-roles' },
    membership: { tab: 'access', section: 'sysops-access-membership' },
    'account-login': { tab: 'access', section: 'sysops-access-roles' },
    'sidebar-access': { tab: 'panel', section: 'sysops-panel-control' },
    'control-panel': { tab: 'panel', section: 'sysops-panel-control' },
    'role-panel': { tab: 'panel', section: 'sysops-panel-control' },
    'info-center': { tab: 'panel', section: 'sysops-panel-control' },
    'show-products': { tab: 'catalog', section: 'sysops-catalog-products' },
    'show-services': { tab: 'catalog', section: 'sysops-catalog-services' },
    packages: { tab: 'catalog', section: 'sysops-catalog-packages' },
    'ads-pages': { tab: 'catalog', section: 'sysops-catalog-products' },
    'system-blog': { tab: 'blog', section: 'sysops-blog-workflow' },
    'create-page': { tab: 'pages', section: 'sysops-pages-create' },
    'tenant-system-icon': { tab: 'tenant', section: 'sysops-tenant-launch' },
    erpi: { tab: 'erpi', section: 'sysops-erpi-modules' },
    legal: { tab: 'law', section: 'sysops-law-modules' },
    'tenant-control': { tab: 'assets', section: 'sysops-assets-control' },
    'cost-org': { tab: 'assets', section: 'sysops-assets-cost' },
  };

  const headerOffset = () => {
    const nav = document.querySelector('.top-nav');
    return Math.ceil((nav?.getBoundingClientRect().height || 72) + 12);
  };

  const syncUrl = ({ push = false } = {}) => {
    const url = new URL(location.href);
    url.searchParams.set('tab', tab);
    if (activeCap && CAP_TARGETS[activeCap]?.section) {
      url.hash = CAP_TARGETS[activeCap].section;
    } else if (url.hash && url.hash.startsWith('#sysops-')) {
      /* keep existing deep section if still valid for tab */
    } else {
      url.hash = '';
    }
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (push) history.pushState({ tab, cap: activeCap }, '', next);
    else history.replaceState({ tab, cap: activeCap }, '', next);
  };

  const highlightSection = (el) => {
    if (!el) return;
    el.classList.remove('is-flash');
    // reflow to restart animation
    void el.offsetWidth;
    el.classList.add('is-flash');
    clearTimeout(highlightSection._t);
    highlightSection._t = setTimeout(() => el.classList.remove('is-flash'), 1600);
  };

  const scrollToTarget = (sectionId) => {
    const preferReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const target =
      (sectionId && root.querySelector(`#${CSS.escape(sectionId)}, [data-sysops-section="${sectionId}"]`)) ||
      root.querySelector('[data-ops-main] .sysops-section') ||
      root.querySelector('[data-ops-main]');
    if (!target) return;
    const desired = () => Math.max(0, target.getBoundingClientRect().top + window.scrollY - headerOffset());
    window.scrollTo({
      top: desired(),
      behavior: preferReduced ? 'auto' : 'smooth',
    });
    highlightSection(target.closest?.('.sysops-section') || target);
    // تأكيد الوصول بعد انتهاء الـ smooth (خصوصًا الأقسام السفلية القصيرة)
    clearTimeout(scrollToTarget._t);
    scrollToTarget._t = setTimeout(() => {
      const y = desired();
      if (Math.abs(window.scrollY - y) > 48) {
        window.scrollTo({ top: y, behavior: 'auto' });
      }
      highlightSection(target.closest?.('.sysops-section') || target);
    }, preferReduced ? 0 : 420);
  };

  const afterPaintScroll = (sectionId) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToTarget(sectionId));
    });
  };

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
    box.innerHTML = window.HubSystemOpsSpec.CAPABILITIES.map((c) => {
      const target = CAP_TARGETS[c.id];
      const sectionId = target?.section || '';
      const active = activeCap === c.id ? ' is-active' : '';
      return `<article class="sysops-cap${active}" data-cap="${esc(c.id)}" data-cap-section="${esc(sectionId)}" role="button" tabindex="0" aria-pressed="${activeCap === c.id ? 'true' : 'false'}">
        <i class="fas ${esc(c.icon)}" aria-hidden="true"></i>
        <div><strong>${esc(c.label)}</strong><small>${esc(c.group)}</small></div>
      </article>`;
    }).join('');
  };

  const section = (title, body, id = '') =>
    `<section class="sysops-section"${id ? ` id="${esc(id)}" data-sysops-section="${esc(id)}"` : ''}><h2>${esc(title)}</h2>${body}</section>`;

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
          </div>`,
          'sysops-panel-control'
        ) +
        section(
          'سجل التشغيل',
          listRows(state.opsLog.slice(0, 12), (l) => `<article><strong>${esc(l.action)}</strong><span>${esc(l.detail)}</span><small>${esc(l.at)}</small></article>`),
          'sysops-panel-log'
        );
      return;
    }

    if (tab === 'grants') {
      host.innerHTML =
        section(
          'منح الدومين ليس من تشغيل الأنظمة',
          `<p class="sysops-note">صاحب المنصة يعبّئ نموذج <strong>سجل معنا</strong> من الرئيسية. السوبر أدمن يوافق فقط من صفحة الموافقة — بعدها يُمنح الدومين والنظام من الأدوار والصلاحيات.</p>
          <div class="sysops-actions">
            <a class="btn btn-primary" href="register.html"><i class="fas fa-user-plus"></i> سجل معنا (للمستأجر)</a>
            <a class="btn btn-secondary" href="rent-admin.html"><i class="fas fa-user-shield"></i> موافقة السوبر أدمن</a>
            <a class="btn btn-secondary" href="dashboard.html#roles-permissions"><i class="fas fa-shield-alt"></i> إدارة فريق العمل والصلاحيات</a>
          </div>`,
          'sysops-grants-policy'
        ) +
        section(
          'الدومينات الممنوحة بعد الموافقة',
          listRows(
            state.subdomains.slice(0, 20),
            (r) =>
              `<article><strong>${esc(r.grantId || '')} · ${esc(r.host)}</strong><span>${esc(r.tenantName)} · ${esc(r.systemCode)} · ${esc(r.branchOrHq || '—')} · ${esc(r.incubator || '—')} · ${esc(r.platformName || '—')}</span></article>`
          ),
          'sysops-grants-domains'
        ) +
        section(
          'هياكل ممنوحة (فرع · حاضنة · منصة · مكتب)',
          listRows(state.structures.slice(0, 20), (r) => `<article><strong>${esc(r.grantId || '')} · ${esc(r.nameAr)}</strong><span>${esc(r.type)} · ${esc(r.tenantName)} · ${esc(r.systemCode)}</span></article>`),
          'sysops-grants-structures'
        );
      return;
    }

    if (tab === 'access') {
      host.innerHTML =
        section(
          'إدارة الأدوار والصلاحيات',
          `<p class="sysops-note">نفس صفحة ERP بالكامل: الأدوار · مصفوفة الصلاحيات · المستخدمون · سجل التدقيق · صفحات المكاتب والمستأجرين · القائمة حسب نوع الحساب.</p>
          <div class="sysops-actions">
            <a class="btn btn-primary" href="dashboard.html#roles-permissions"><i class="fas fa-shield-alt"></i> فتح إدارة فريق العمل والصلاحيات</a>
            <a class="btn btn-secondary" href="dashboard.html#identity">مصفوفة الصلاحيات (هوية نايوش)</a>
            <a class="btn btn-secondary" href="dashboard.html#roles-permissions">المستخدمون وتعيين الأدوار</a>
          </div>`,
          'sysops-access-roles'
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
          ${listRows(state.roleAssignments.slice(0, 30), (r) => `<article><strong>${esc(r.user)}</strong><span>${esc(r.roleName)} · ${esc(r.systemCode)} · ${esc((r.perms || []).join(' · '))}</span></article>`)}`,
          'sysops-access-assign'
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
          ${listRows(state.certificates.slice(0, 15), (c) => `<article><strong>${esc(c.title)}</strong><span>${esc(c.systemCode)}</span></article>`)}`,
          'sysops-access-membership'
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
          </div>`,
          'sysops-catalog-products'
        ) +
        section(
          'خدمات نايوش',
          `<div class="sysops-chips">${window.HubSystemOpsSpec.NAIOSH_SERVICES.map((p) => `<span>${esc(p)}</span>`).join('')}
            <a class="btn btn-secondary" href="branches.html">الفروع</a>
            <a class="btn btn-secondary" href="incubators.html">الحاضنات</a>
            <a class="btn btn-secondary" href="packages.html">الاشتراكات</a>
          </div>`,
          'sysops-catalog-services'
        ) +
        section(
          'باقات الاشتراكات · الأسعار',
          `<a class="btn btn-primary" href="packages.html">فتح الباقات والأسعار</a>
           <a class="btn btn-secondary" href="membership.html">العضوية</a>
           <a class="btn btn-secondary" href="store.html">المتجر</a>`,
          'sysops-catalog-packages'
        );
      return;
    }

    if (tab === 'blog') {
      const attachHtml = (p) => {
        const files = Array.isArray(p.attachments) ? p.attachments : [];
        if (!files.length) return '';
        return `<div class="sysops-inline">${files
          .map((f) =>
            f.url
              ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.name || 'مرفق')}</a>`
              : `<span>${esc(f.name || 'مرفق')}</span>`
          )
          .join(' · ')}</div>`;
      };
      const incoming =
        typeof window.HubArticles?.list === 'function'
          ? window.HubArticles.list({ incoming: true }).slice(0, 15)
          : [];
      host.innerHTML =
        section(
          'المقالات — فصل تجربة العميل عن التشغيل',
          `<p class="sysops-note"><strong>للعملاء:</strong> رفع المقال يتم عبر رحلة بسيطة في
            <a href="blog.html#submit" target="_blank" rel="noopener">صفحة المقالات ← ارفع مقالك</a>
            (بيانات → محتوى → مراجعة → إرسال). لا تطلب من العميل فتح هذه الشاشة التقنية.</p>
          <p class="sysops-note"><strong>للإدارة:</strong> راجع المقالات الواردة، عيّن مراجعاً، اطلب تعديلاً، اعتمد وانشر من
            <a href="dashboard.html#content-articles">غرفة العمليات ← المقالات الواردة</a>.
            آلية التشغيل تشغّل Workflow <code>WF-ARTICLE-01</code> في الخلفية.</p>
          <div class="sysops-inline" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px">
            <a class="btn btn-primary" href="blog.html#submit" target="_blank" rel="noopener">فتح رحلة إرسال المقال</a>
            <a class="btn btn-secondary" href="dashboard.html#content-articles">صندوق المقالات الواردة</a>
            <a class="btn btn-secondary" href="blog.html" target="_blank" rel="noopener">المدونة العامة</a>
          </div>`,
          'sysops-blog-workflow'
        ) +
        section(
          'المقالات الواردة (معاينة)',
          incoming.length
            ? listRows(
                incoming,
                (a) =>
                  `<article><strong>${esc(a.title)}</strong><span>${esc(a.authorName)} · ${esc(a.category)}</span>
                    <small>${esc(a.id)} · ${esc(a.statusAr)} · ${esc((a.submittedAt || '').slice(0, 10))}</small></article>`
              )
            : '<p class="sysops-note">لا مقالات واردة بعد — ستظهر هنا عند إرسال مقال من صفحة المدونة.</p>',
          'sysops-blog-incoming'
        ) +
        section(
          'نشر سريع داخلي (إدارة فقط — يتجاوز رحلة العميل)',
          `<p class="sysops-note">استخدم هذا فقط للنشر التشغيلي الداخلي. للعملاء استخدم رحلة «ارفع مقالك».</p>
        <form class="sysops-form" data-form="blog">
          <input name="title" required placeholder="عنوان المقال" />
          <textarea name="body" rows="5" placeholder="نص المقال"></textarea>
          <select name="systemCode">${systems.map((c) => `<option>${c}</option>`).join('')}</select>
          <label>مرفقات (اختياري)
            <input type="file" name="attachments" multiple />
          </label>
          <button class="btn btn-primary" type="submit">نشر داخلي على المدونة</button>
        </form>`,
          'sysops-blog-publish'
        ) +
        section(
          'المنشورات المنشورة',
          listRows(
            state.blogPosts.slice(0, 20),
            (p) =>
              `<article><strong>${esc(p.title)}</strong><span>${esc(p.body)}</span><small>${esc(p.systemCode)} · ${esc(
                (p.at || '').slice(0, 10)
              )}</small>${attachHtml(p)}</article>`
          ),
          'sysops-blog-posts'
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
          <div class="sysops-inline"><a href="${esc(p.hubUrl)}">على هوب</a> · <a href="${esc(p.systemUrl)}">على النظام</a></div></article>`)}`,
        'sysops-pages-create'
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
        }).join('')}</div>`,
        'sysops-erpi-modules'
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
          }).join('')}</div>`,
          'sysops-law-modules'
        ) +
        section(
          'التصنيف القانوني التشغيلي',
          `<div class="sysops-modules sysops-modules--dense">${window.HubSystemOpsSpec.LAW_TAXONOMY.map((m) => {
            const on = !!state.lawTaxonomyActive[m];
            return `<button type="button" class="sysops-mod ${on ? 'is-on' : ''}" data-law-tax="${esc(m)}">${esc(m)}</button>`;
          }).join('')}</div>`,
          'sysops-law-taxonomy'
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
          ${listRows(state.assets.slice(0, 30), (a) => `<article><strong>${esc(a.nameAr)}</strong><span>${esc(a.tenantName)} · ${esc(a.kind)} · ${Number(a.value).toLocaleString('en-US')}</span></article>`)}`,
          'sysops-assets-control'
        ) +
        section(
          'منظمة متكاملة لخفض التكاليف',
          `<form class="sysops-form" data-form="cost">
            <input name="title" required placeholder="إجراء خفض تكلفة" />
            <input name="saving" type="number" placeholder="الوفر المتوقع" value="1000" />
            <button class="btn btn-primary">تسجيل إجراء</button>
          </form>
          ${listRows(state.costActions.slice(0, 20), (c) => `<article><strong>${esc(c.title)}</strong><span>وفر ${Number(c.saving).toLocaleString('en-US')}</span></article>`)}`,
          'sysops-assets-cost'
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
        </div>`,
        'sysops-tenant-launch'
      );
      return;
    }

    host.innerHTML = section('لوحة التشغيل', '<p>اختر قسمًا من المنيو الجانبي.</p>', 'sysops-fallback');
  };

  const paint = ({ scroll = false, sectionId = '' } = {}) => {
    paintKpis();
    paintSidebar();
    paintCaps();
    paintPanel();
    const title = root.querySelector('[data-ops-title]');
    if (title) title.textContent = `آلية تشغيل الأنظمة · ${systemCode}`;
    if (scroll) afterPaintScroll(sectionId || CAP_TARGETS[activeCap]?.section || '');
  };

  const openCapability = (capId, { push = true } = {}) => {
    const target = CAP_TARGETS[capId];
    if (!target) {
      tab = 'panel';
      activeCap = capId;
      syncUrl({ push });
      paint({ scroll: true, sectionId: '' });
      return;
    }
    if (target.external) {
      window.location.href = target.external;
      return;
    }
    activeCap = capId;
    tab = target.tab || 'panel';
    syncUrl({ push });
    paint({ scroll: true, sectionId: target.section || '' });
  };

  const resolveCapFromHash = () => {
    const hash = String(location.hash || '').replace(/^#/, '');
    if (!hash) return '';
    const hit = Object.entries(CAP_TARGETS).find(([, t]) => t.section === hash);
    return hit ? hit[0] : '';
  };

  root.addEventListener('click', (e) => {
    const tabLink = e.target.closest('[data-tab-link]');
    if (tabLink) {
      e.preventDefault();
      tab = tabLink.dataset.tabLink || 'panel';
      activeCap =
        Object.entries(CAP_TARGETS).find(([, t]) => t.tab === tab && t.section)?.[0] || '';
      syncUrl({ push: true });
      paint({ scroll: true, sectionId: CAP_TARGETS[activeCap]?.section || '' });
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
      paint({ scroll: false });
      return;
    }
    const law = e.target.closest('[data-law]');
    if (law) {
      const name = law.dataset.law;
      const on = !window.HubSystemOps.read().lawActive[name];
      window.HubSystemOps.toggleLaw(name, on);
      toast(on ? `تم تفعيل: ${name}` : `تم إيقاف: ${name}`);
      paint({ scroll: false });
      return;
    }
    const tax = e.target.closest('[data-law-tax]');
    if (tax) {
      const name = tax.dataset.lawTax;
      const on = !window.HubSystemOps.read().lawTaxonomyActive[name];
      window.HubSystemOps.toggleLawTaxonomy(name, on);
      toast(on ? `تم تفعيل: ${name}` : `تم إيقاف: ${name}`);
      paint({ scroll: false });
      return;
    }
    const cap = e.target.closest('[data-cap]');
    if (cap) {
      e.preventDefault();
      openCapability(cap.dataset.cap, { push: true });
    }
  });

  root.addEventListener('keydown', (e) => {
    const cap = e.target.closest('[data-cap]');
    if (!cap) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openCapability(cap.dataset.cap, { push: true });
    }
  });

  const applyLocationState = ({ scroll = true, push = false } = {}) => {
    const q = new URLSearchParams(location.search);
    tab = q.get('tab') || tab || 'panel';
    const fromHash = resolveCapFromHash();
    if (fromHash) {
      activeCap = fromHash;
      if (CAP_TARGETS[fromHash]?.tab) tab = CAP_TARGETS[fromHash].tab;
    } else if (!activeCap || CAP_TARGETS[activeCap]?.tab !== tab) {
      activeCap =
        Object.entries(CAP_TARGETS).find(([, t]) => t.tab === tab && t.section)?.[0] || '';
    }
    syncUrl({ push });
    paint({
      scroll,
      sectionId: CAP_TARGETS[activeCap]?.section || String(location.hash || '').replace(/^#/, ''),
    });
  };

  window.addEventListener('popstate', () => applyLocationState({ scroll: true, push: false }));
  window.addEventListener('hashchange', () => {
    const fromHash = resolveCapFromHash();
    if (!fromHash) return;
    if (fromHash === activeCap && CAP_TARGETS[fromHash]?.tab === tab) {
      afterPaintScroll(CAP_TARGETS[fromHash].section);
      return;
    }
    openCapability(fromHash, { push: false });
  });

  root.addEventListener('change', (e) => {
    if (e.target.matches('[data-system-select]')) {
      systemCode = e.target.value;
      window.HubSystemOps.setActiveSystem(systemCode);
      paint({ scroll: false });
    }
    if (e.target.matches('[data-user-input]')) {
      user = e.target.value.trim() || user;
      localStorage.setItem('naiosh_system_ops_user', user);
      paint({ scroll: false });
    }
  });

  root.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const fd = new FormData(form);
    const type = form.dataset.form;
    if (type === 'subdomain' || type === 'rent') {
      toast('منح الدومين يتم بعد موافقة السوبر أدمن على طلب سجل معنا — ليس من تشغيل الأنظمة.');
      return;
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
      const btn = form.querySelector('button[type="submit"], button.btn-primary');
      const files = Array.from(form.querySelector('input[name="attachments"]')?.files || []);
      const attachments = [];
      try {
        if (btn) {
          btn.disabled = true;
          btn.textContent = files.length ? 'جاري الرفع…' : 'جاري النشر…';
        }
        for (const file of files) {
          if (window.HubUploadLimits?.uploadFile) {
            const uploaded = await window.HubUploadLimits.uploadFile(file);
            attachments.push({
              name: uploaded.name || file.name,
              url: uploaded.url,
              mime: uploaded.mime || file.type,
              size: uploaded.size || file.size,
            });
          } else {
            attachments.push({ name: file.name, url: '', mime: file.type, size: file.size });
          }
        }
        const post = window.HubSystemOps.publishPost({
          title: fd.get('title'),
          body: fd.get('body'),
          systemCode: fd.get('systemCode'),
          attachments,
        });
        if (!post) {
          toast('أدخل عنوان المقال');
          return;
        }
        toast(attachments.length ? `تم النشر مع ${attachments.length} مرفق` : 'تم النشر على المدونة');
      } catch (err) {
        toast(err?.message || 'فشل رفع المرفقات');
        return;
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'نشر على المدونة';
        }
      }
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
    paint({ scroll: false });
  });

  // Boot: honor ?tab= and #section without breaking query params
  {
    const fromHash = resolveCapFromHash();
    if (fromHash) {
      activeCap = fromHash;
      tab = CAP_TARGETS[fromHash]?.tab || tab;
    } else if (tab) {
      activeCap =
        Object.entries(CAP_TARGETS).find(([, t]) => t.tab === tab && t.section)?.[0] || '';
    }
    const shouldScroll = Boolean(fromHash || (params.get('tab') && params.get('tab') !== 'panel'));
    paint({
      scroll: shouldScroll,
      sectionId: CAP_TARGETS[activeCap]?.section || String(location.hash || '').replace(/^#/, ''),
    });
    syncUrl({ push: false });
  }
})();
