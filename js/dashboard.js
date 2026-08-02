(() => {
  const NAV = [
    { key: 'overview', icon: 'fa-satellite-dish', label: 'مركز التحكم' },
    { key: 'blueprint', icon: 'fa-sitemap', label: 'دستور المعمارية' },
    { key: 'platforms', icon: 'fa-layer-group', label: 'المنصات السيادية' },
    { key: 'apps', icon: 'fa-cubes', label: 'سجل الأنظمة' },
    { key: 'store', icon: 'fa-bag-shopping', label: 'متجر المبيعات' },
    { key: 'ads-studio', icon: 'fa-rectangle-ad', label: 'استوديو الإعلانات' },
    { key: 'events-studio', icon: 'fa-calendar-days', label: 'استوديو الفعاليات' },
    { key: 'identity', icon: 'fa-id-card', label: 'NAIOSH ID' },
    { key: 'organization', icon: 'fa-globe', label: 'الهيكل العالمي' },
    { key: 'incubators', icon: 'fa-building', label: 'الحاضنات' },
    { key: 'wallet', icon: 'fa-coins', label: 'محفظة النقاط' },
    { key: 'core', icon: 'fa-brain', label: 'العقل المركزي' },
    { key: 'governance', icon: 'fa-scale-balanced', label: 'الحوكمة' },
    { key: 'workforce', icon: 'fa-users-gear', label: 'القوى العاملة' },
    { key: 'systems', icon: 'fa-store', label: 'سوق الأنظمة' },
    { key: 'tasks', icon: 'fa-clipboard-list', label: 'المهام' },
    { key: 'measurement', icon: 'fa-chart-simple', label: 'القياس' },
    { key: 'reports', icon: 'fa-scroll', label: 'التقارير' },
    { key: 'integration', icon: 'fa-plug', label: 'التكامل' },
  ];

  const TITLES = {
    overview: ['مركز التحكم العالمي', 'الفروع · الحاضنات · المنصات · المتجر · الإعلانات · الفعاليات'],
    blueprint: ['دستور المعمارية الإمبراطورية', 'هوب مركزي — طبقات · محاور · أول 6 أشهر'],
    platforms: ['المنصات السيادية لنايوش 360', '18 منصة تشغّل هوب — من الدماغ المركزي إلى السلطة العليا'],
    apps: ['سجل أنظمة هوب', 'أي نظام نايوش يمكنه الظهور هنا والارتباط بالتشغيل الموحّد'],
    store: ['متجر المبيعات', 'منتجات المنصات · طلبات · نقاط المحفظة'],
    'ads-studio': ['استوديو الإعلانات', 'إعلانات منتجات المنصات — ظهور وميزانية ومشاهدات'],
    'events-studio': ['استوديو الفعاليات', 'فعاليات · بث · ورش · إدارة من غرفة العمليات'],
    identity: ['بوابة الهوية الرقمية', 'هوية موحّدة · دخول موحّد · أدوار'],
    organization: ['محرك الهيكل المؤسسي', 'دولة ← فرع ← حاضنة ← منصة ← مكتب إلكتروني'],
    incubators: ['إدارة الحاضنات', '100 حاضنة قطاعية · منصات · مكاتب · أعضاء'],
    wallet: ['اقتصاد النقاط', 'شحن · استهلاك · تسعير · فواتير'],
    core: ['العقل المركزي', 'قرار · تنبؤ · تحسين · شذوذ · خريطة معرفة'],
    governance: ['الحوكمة الدستورية', 'سياسات · امتثال · جودة · عقوبات/مكافآت · دستور'],
    workforce: ['القوى العاملة عن بُعد', 'تتبع · إنتاجية · إنذار · مكافآت'],
    systems: ['سوق الأنظمة التشغيلية', 'تفعيل · إيقاف · ربط'],
    tasks: ['المهام والمشاريع', 'توزيع · أولويات · اختناقات · جودة تنفيذ'],
    measurement: ['القياس الموحد', 'درجات · مستويات · مصفوفة · أثر العملاء'],
    reports: ['التقارير السيادية', 'يومي · أسبوعي · شهري · مخاطر · نمو · امتثال'],
    integration: ['الربط والتكامل', 'بوابة الربط · ناقل الأحداث · موصلات'],
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

  const $ = (sel, root = document) => root.querySelector(sel);
  const root = $('#panel-root');
  const toastEl = $('#toast');
  let current = (location.hash || '').replace(/^#/, '') || 'overview';
  if (!TITLES[current]) current = 'overview';
  let reportTab = 'daily';
  let govTab = 'policies';

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fmtTime = (iso) => {
    try {
      return new Date(iso).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
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
  $('#user-role').textContent =
    user.role === 'supreme_leader' ? 'القائد الأعلى' : user.role === 'chief_engineer' ? 'المهندسة مليكة' : user.role || 'عضو';

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

  $('#mobile-toggle').onclick = () => document.body.classList.toggle('nav-open');

  // —— Nav
  const renderNav = () => {
    $('#sidebar-nav').innerHTML = NAV.map(
      (n) =>
        `<a href="#${n.key}" data-panel="${n.key}" class="${n.key === current ? 'active' : ''}"><i class="fas ${n.icon}"></i> ${n.label}</a>`
    ).join('');
    $('#sidebar-nav').onclick = (e) => {
      const a = e.target.closest('a[data-panel]');
      if (!a) return;
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

  const activate = (key) => {
    current = TITLES[key] ? key : 'overview';
    history.replaceState(null, '', `#${current}`);
    $('#page-title').textContent = TITLES[current][0];
    $('#page-sub').textContent = TITLES[current][1];
    renderNav();
    render();
  };

  // —— Panels
  const renderOverview = () => {
    const s = HubStore.get();
    const k = HubStore.kpis();
    const lh = k.layerHealth;
    const cmd = s.empire?.command || {};
    return `
      <div class="empire-banner">
        <div>
          <strong>Central Digital Hub</strong>
          <p>ليس موقعًا — بل نظام التشغيل العالمي لإمبراطورية نايوش. أي مستخدم يدخل مرة واحدة ويصل فقط لما صُرّح له.</p>
        </div>
        <button class="btn btn-primary btn-sm" data-action="refresh-command"><i class="fas fa-rotate"></i> تحديث المؤشرات</button>
      </div>
      <div class="kpi-grid">
        <article class="kpi"><span>الفروع</span><strong>${k.branches}</strong><small>Branches</small></article>
        <article class="kpi"><span>الحاضنات</span><strong>${k.incubators}</strong><small>Incubators</small></article>
        <article class="kpi"><span>المنصات / الأنظمة</span><strong>${k.platforms}</strong><small>Platforms</small></article>
        <article class="kpi"><span>المتدربون</span><strong>${Number(k.trainees).toLocaleString('ar-EG')}</strong><small>Trainees</small></article>
        <article class="kpi"><span>خزينة النقاط</span><strong>${Number(k.treasury).toLocaleString('ar-EG')}</strong><small>Wallet</small></article>
        <article class="kpi"><span>جاهزية Core</span><strong>${k.coreReadyPct}%</strong><small>Core Platform</small></article>
        <article class="kpi"><span>استخدام الأنظمة</span><strong>${cmd.systemsUsagePct || 0}%</strong><small>Usage</small></article>
        <article class="kpi"><span>صحة الأنظمة</span><strong>${k.systemsHealth}%</strong><small>Health</small></article>
      </div>
      <div class="phase-cards">
        ${['phase1', 'phase2', 'phase3']
          .map((key) => {
            const p = s.timeline[key];
            return `<article class="phase-card">
              <h4>${esc(p.name)} · ${p.days} يوم</h4>
              <div>${bar(p.progress)}</div>
              <small style="color:var(--muted)">${p.progress}%</small>
              <ul>${p.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
            </article>`;
          })
          .join('')}
      </div>
      <div class="grid-2">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-bolt icon"></i> تدفق حي</span>
            <button class="btn btn-ghost btn-sm" data-action="refresh-feed"><i class="fas fa-rotate"></i></button>
          </h3>
          <ul class="feed">
            ${s.feed
              .slice(0, 10)
              .map((f) => `<li><b>${esc(f.type)}:</b> ${esc(f.text)}<small>${fmtTime(f.at)}</small></li>`)
              .join('')}
          </ul>
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-diagram-project icon"></i> صحة المحاور</span></h3>
          ${Object.entries({
            'الهوية NAIOSH ID': lh.identity,
            'الهيكل العالمي': lh.organization,
            'العقل المركزي': lh.core,
            الحوكمة: lh.governance,
            'محفظة النقاط': lh.wallet,
            الأنظمة: lh.systems,
            التكامل: lh.integration,
            القياس: lh.measurement,
          })
            .map(
              ([name, val]) => `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:4px"><span>${name}</span><span>${val}%</span></div>${bar(val)}</div>`
            )
            .join('')}
        </article>
      </div>
    `;
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
    const idn = HubStore.get().empire.identity;
    const bp = window.EmpireBlueprint;
    return `
      <div class="kpi-grid">
        <article class="kpi"><span>المستخدمون</span><strong>${idn.totalUsers.toLocaleString('ar-EG')}</strong><small>NAIOSH ID</small></article>
        <article class="kpi"><span>جلسات نشطة</span><strong>${idn.activeSessions}</strong><small>SSO</small></article>
        <article class="kpi"><span>تفعيل MFA</span><strong>${idn.mfaEnabledPct}%</strong><small>Security</small></article>
        <article class="kpi"><span>الدومينات المربوطة</span><strong>${idn.ssoDomains.length}</strong><small>Single Sign-On</small></article>
      </div>
      <div class="grid-2">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-shield-halved icon"></i> دومينات SSO</span></h3>
          <ul class="feed">${idn.ssoDomains.map((d) => `<li><b>SSO:</b> ${esc(d)}</li>`).join('')}</ul>
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-users icon"></i> مصفوفة الأدوار ولوحات التحكم</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>الدور</th><th>النطاق</th><th>المستخدمون</th></tr></thead>
            <tbody>
              ${idn.roles
                .map((r) => `<tr><td>${esc(r.nameAr)}</td><td>${esc(r.scope)}</td><td>${r.users.toLocaleString('ar-EG')}</td></tr>`)
                .join('')}
            </tbody>
          </table></div>
        </article>
      </div>
      <article class="card" style="margin-top:12px">
        <h3><span class="title-left"><i class="fas fa-key icon"></i> مكوّنات الهوية (من الدستور)</span></h3>
        <div class="chip-row">
          ${(bp?.getAxis('naiosh-id')?.components || []).map((c) => `<span class="chip">${esc(c)}</span>`).join('')}
        </div>
      </article>
    `;
  };

  const renderOrganization = () => {
    const org = HubStore.get().empire.organization;
    return `
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
    const groups = window.HubSovereignPlatforms?.byCategory?.() || [];
    return `
      <div class="kpi-grid">
        <article class="kpi"><span>منصات سيادية</span><strong>${list.length}</strong><small>منصات نايوش</small></article>
        <article class="kpi"><span>مجموعات</span><strong>${groups.length || 4}</strong><small>تصنيفات</small></article>
        <article class="kpi"><span>متصلة بهوب</span><strong>${list.length}</strong><small>متصلة الآن</small></article>
        <article class="kpi"><span>التكامل</span><strong>نشط</strong><small>طبقة الربط</small></article>
      </div>
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

  const renderApps = () => {
    const apps = HubStore.get().empire.apps || [];
    return `
      <div class="toolbar">
        <div class="field"><label>رمز النظام</label><input id="app-code" placeholder="LAW" /></div>
        <div class="field"><label>الاسم بالعربي</label><input id="app-name" placeholder="نظام جديد لنايوش" /></div>
        <div class="field"><label>التصنيف</label><input id="app-cat" placeholder="أنظمة نايوش" /></div>
        <div class="field"><label>الرابط</label><input id="app-url" placeholder="apps.html" /></div>
        <button class="btn btn-primary" data-action="register-app"><i class="fas fa-plus"></i> تسجيل نظام في هوب</button>
        <a class="btn btn-ghost" href="apps.html" target="_blank">فتح السجل العام</a>
      </div>
      <div class="kpi-grid">
        <article class="kpi"><span>أنظمة مسجّلة</span><strong>${apps.length}</strong><small>في هوب</small></article>
        <article class="kpi"><span>نشطة</span><strong>${apps.filter((a) => a.status === 'active').length}</strong><small>متاحة</small></article>
        <article class="kpi"><span>استوديوهات</span><strong>${apps.filter((a) => a.kind === 'studio').length}</strong><small>إعلانات · فعاليات · متجر</small></article>
        <article class="kpi"><span>سيادية</span><strong>${apps.filter((a) => a.kind === 'sovereign').length}</strong><small>منصات</small></article>
      </div>
      <article class="card" style="margin-top:12px">
        <h3><span class="title-left"><i class="fas fa-cubes icon"></i> أي نظام نايوش يظهر هنا</span></h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>الاسم</th><th>التصنيف</th><th>النوع</th><th>الصحة</th><th>الحالة</th><th></th></tr></thead>
          <tbody>
            ${apps
              .map(
                (a) => `<tr>
                  <td><strong>${esc(a.nameAr)}</strong></td>
                  <td>${esc(a.category)}</td>
                  <td>${esc(a.kind)}</td>
                  <td>${a.health || '—'}%</td>
                  <td>${badgeStatus(a.status)}</td>
                  <td>
                    <button class="btn btn-sm btn-dark" data-action="toggle-app" data-id="${a.id}">تفعيل/إيقاف</button>
                    <a class="btn btn-sm btn-ghost" href="${esc(a.url || 'apps.html')}">فتح</a>
                  </td>
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
    return `
      <div class="toolbar">
        <div class="field"><label>المنتج</label><input id="store-title" placeholder="اسم المنتج" /></div>
        <div class="field"><label>السعر</label><input id="store-price" type="number" value="500" /></div>
        <div class="field"><label>النقاط</label><input id="store-points" type="number" value="50" /></div>
        <div class="field"><label>منصة</label><input id="store-platform" placeholder="UOS" /></div>
        <button class="btn btn-primary" data-action="add-store-item"><i class="fas fa-plus"></i> إضافة منتج</button>
        <a class="btn btn-ghost" href="store.html" target="_blank">فتح المتجر</a>
      </div>
      <div class="kpi-grid">
        <article class="kpi"><span>منتجات</span><strong>${store.items.length}</strong><small>في المتجر</small></article>
        <article class="kpi"><span>طلبات</span><strong>${store.orders.length}</strong><small>مكتملة</small></article>
        <article class="kpi"><span>مخزون</span><strong>${store.items.reduce((s, i) => s + (i.stock || 0), 0)}</strong><small>وحدة</small></article>
        <article class="kpi"><span>إعلانات</span><strong>${(HubStore.get().empire.adsStudio?.listings || []).length}</strong><small>مرتبطة</small></article>
      </div>
      <div class="grid-2" style="margin-top:12px">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-bag-shopping icon"></i> المنتجات</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>المنتج</th><th>السعر</th><th>نقاط</th><th>مخزون</th><th></th></tr></thead>
            <tbody>
              ${store.items
                .map(
                  (i) => `<tr>
                    <td><strong>${esc(i.title)}</strong><br><small>${esc(i.platformCode || '')}</small></td>
                    <td>${Number(i.price).toLocaleString('ar-EG')}</td>
                    <td>${i.points}</td>
                    <td>${i.stock}</td>
                    <td><button class="btn btn-sm btn-primary" data-action="buy-store-item" data-id="${i.id}">بيع</button></td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table></div>
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-receipt icon"></i> الطلبات</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>المنتج</th><th>المشتري</th><th>المبلغ</th><th>الوقت</th></tr></thead>
            <tbody>
              ${store.orders
                .map(
                  (o) => `<tr>
                    <td>${esc(o.title)}</td>
                    <td>${esc(o.buyer)}</td>
                    <td>${Number(o.amount).toLocaleString('ar-EG')}</td>
                    <td>${fmtTime(o.at)}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table></div>
        </article>
      </div>
    `;
  };

  const renderAdsStudio = () => {
    const listings = HubStore.get().empire.adsStudio?.listings || [];
    return `
      <div class="toolbar">
        <div class="field"><label>عنوان الإعلان</label><input id="ad-title" placeholder="عرض منتج المنصة" /></div>
        <div class="field"><label>السعر</label><input id="ad-price" type="number" value="1000" /></div>
        <div class="field"><label>التصنيف</label><input id="ad-cat" placeholder="تشغيل" /></div>
        <div class="field"><label>منصة</label><input id="ad-platform" placeholder="UOS" /></div>
        <button class="btn btn-primary" data-action="add-ad"><i class="fas fa-plus"></i> نشر إعلان منتج</button>
        <a class="btn btn-ghost" href="ads.html" target="_blank">فتح استوديو الإعلانات</a>
      </div>
      <div class="kpi-grid">
        <article class="kpi"><span>إعلانات</span><strong>${listings.length}</strong><small>الكل</small></article>
        <article class="kpi"><span>نشطة</span><strong>${listings.filter((a) => a.status === 'active').length}</strong><small>ظاهرة</small></article>
        <article class="kpi"><span>مشاهدات</span><strong>${listings.reduce((s, a) => s + (a.views || 0), 0).toLocaleString('ar-EG')}</strong><small>تراكمي</small></article>
        <article class="kpi"><span>منتجات منصات</span><strong>${listings.filter((a) => a.type === 'منتج منصة').length}</strong><small>مهمة</small></article>
      </div>
      <article class="card" style="margin-top:12px">
        <h3><span class="title-left"><i class="fas fa-rectangle-ad icon"></i> إعلانات منتجات المنصات</span></h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>الإعلان</th><th>المنصة</th><th>السعر</th><th>مشاهدات</th><th>الحالة</th><th></th></tr></thead>
          <tbody>
            ${listings
              .map(
                (a) => `<tr>
                  <td><strong>${esc(a.title)}</strong><br><small>${esc(a.content || '')}</small></td>
                  <td>${esc(a.platformCode || '—')}</td>
                  <td>${Number(a.price || 0).toLocaleString('ar-EG')}</td>
                  <td>${Number(a.views || 0).toLocaleString('ar-EG')}</td>
                  <td>${badgeStatus(a.status)}</td>
                  <td><button class="btn btn-sm btn-dark" data-action="toggle-ad" data-id="${a.id}">تشغيل/إيقاف</button></td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table></div>
      </article>
    `;
  };

  const renderEventsStudio = () => {
    const events = HubStore.get().empire.eventsStudio?.events || [];
    return `
      <div class="toolbar">
        <div class="field"><label>اسم الفعالية</label><input id="ev-name" placeholder="قمة تشغيلية" /></div>
        <div class="field"><label>التاريخ</label><input id="ev-date" type="date" /></div>
        <div class="field"><label>الوقت</label><input id="ev-time" type="time" value="18:00" /></div>
        <div class="field"><label>النوع</label><input id="ev-type" placeholder="بث مباشر" /></div>
        <button class="btn btn-primary" data-action="add-event"><i class="fas fa-plus"></i> إنشاء فعالية</button>
        <a class="btn btn-ghost" href="events.html" target="_blank">فتح استوديو الفعاليات</a>
      </div>
      <div class="kpi-grid">
        <article class="kpi"><span>فعاليات</span><strong>${events.length}</strong><small>الكل</small></article>
        <article class="kpi"><span>قادمة</span><strong>${events.filter((e) => e.status === 'قادمة').length}</strong><small>مجدولة</small></article>
        <article class="kpi"><span>منتهية</span><strong>${events.filter((e) => e.status === 'منتهية').length}</strong><small>أرشيف</small></article>
        <article class="kpi"><span>مسودات</span><strong>${events.filter((e) => e.status === 'مسودة').length}</strong><small>قيد الإعداد</small></article>
      </div>
      <article class="card" style="margin-top:12px">
        <h3><span class="title-left"><i class="fas fa-calendar-days icon"></i> إدارة الفعاليات</span></h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>الفعالية</th><th>التاريخ</th><th>النوع</th><th>المتحدّث</th><th>الحالة</th></tr></thead>
          <tbody>
            ${events
              .map(
                (e) => `<tr>
                  <td><strong>${esc(e.name)}</strong><br><small>${esc(e.description || '')}</small></td>
                  <td>${esc(e.date)} ${esc(e.time)}</td>
                  <td>${esc(e.type)}</td>
                  <td>${esc(e.speaker)}</td>
                  <td>${badgeStatus(e.status)}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table></div>
      </article>
    `;
  };

  const renderIncubators = () => {
    const org = HubStore.get().empire.organization;
    return `
      <div class="toolbar">
        <div class="field"><label>اسم الحاضنة</label><input id="inc-name" placeholder="حاضنة القطاع…" /></div>
        <div class="field"><label>القطاع</label><input id="inc-sector" placeholder="تعليم / صحة / قانون…" /></div>
        <button class="btn btn-primary" data-action="add-incubator"><i class="fas fa-plus"></i> إنشاء حاضنة</button>
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>الحاضنة</th><th>القطاع</th><th>منصات</th><th>مكاتب</th><th>أعضاء</th><th>الصحة</th></tr></thead>
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
        <article class="kpi"><span>خزينة الإمبراطورية</span><strong>${w.treasury.toLocaleString('ar-EG')}</strong><small>نقطة</small></article>
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
                .map((x) => `<tr><td>${esc(x.owner)}</td><td>${x.balance.toLocaleString('ar-EG')}</td><td>${x.burn30d.toLocaleString('ar-EG')}</td></tr>`)
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
    const s = HubStore.get().core;
    const health = s.engineHealth;
    return `
      <div class="engine-grid" style="margin-bottom:12px">
        ${[
          ['Decision', health.decision],
          ['Predictive', health.predictive],
          ['Optimization', health.optimization],
          ['Anomaly', health.anomaly],
          ['Knowledge', health.knowledge],
        ]
          .map(([n, v]) => `<div class="engine-pill"><span>${n}</span><strong>${v}%</strong></div>`)
          .join('')}
      </div>
      <div class="toolbar">
        <div class="field"><label>قرار تشغيلي جديد</label><input id="decision-title" placeholder="مثال: إعادة توزيع فريق التكامل" /></div>
        <div class="field"><label>المحرك</label>
          <select id="decision-engine">
            <option>AI Decision</option><option>Predictive</option><option>Optimization</option><option>Anomaly</option>
          </select>
        </div>
        <button class="btn btn-primary" data-action="issue-decision"><i class="fas fa-microchip"></i> إصدار قرار</button>
        <button class="btn btn-dark" data-action="run-predict"><i class="fas fa-binoculars"></i> مسح تنبؤي</button>
      </div>
      <div class="grid-2">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-gavel icon"></i> القرارات</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>القرار</th><th>المحرك</th><th>الأثر</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              ${s.decisions
                .map(
                  (d) => `<tr>
                    <td>${esc(d.title)}</td><td>${esc(d.engine)}</td><td>${badgeStatus(d.impact)}</td><td>${badgeStatus(d.status)}</td>
                    <td>${d.status !== 'executed' ? `<button class="btn btn-sm btn-primary" data-action="exec-decision" data-id="${d.id}">تنفيذ</button>` : '—'}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table></div>
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-chart-line icon"></i> التنبؤات</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>المخاطر</th><th>الاحتمال</th><th>الموعد</th><th>الحدة</th></tr></thead>
            <tbody>
              ${s.predictions
                .map(
                  (p) => `<tr><td>${esc(p.risk)}</td><td>${p.probability}% ${bar(p.probability)}</td><td>${esc(p.eta)}</td><td>${badgeStatus(p.severity)}</td></tr>`
                )
                .join('')}
            </tbody>
          </table></div>
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-wand-magic-sparkles icon"></i> التحسينات</span></h3>
          ${s.optimizations
            .map(
              (o) => `<div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px">
                <b>${esc(o.target)}</b> · <span class="badge badge-red">${esc(o.gain)}</span>
                <div style="margin-top:6px;font-size:13px;color:var(--muted)">${esc(o.suggestion)}</div>
              </div>`
            )
            .join('')}
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-triangle-exclamation icon"></i> الشذوذ</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>المصدر</th><th>الإشارة</th><th>الدرجة</th><th></th></tr></thead>
            <tbody>
              ${s.anomalies
                .map(
                  (a) => `<tr>
                    <td>${esc(a.source)}</td><td>${esc(a.signal)}</td><td>${a.score} ${badgeStatus(a.status)}</td>
                    <td>${a.status !== 'closed' ? `<button class="btn btn-sm btn-dark" data-action="resolve-anomaly" data-id="${a.id}">إغلاق</button>` : '—'}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table></div>
        </article>
      </div>
      <article class="card" style="margin-top:12px">
        <h3><span class="title-left"><i class="fas fa-project-diagram icon"></i> Knowledge Graph</span></h3>
        <div class="kg">
          ${s.knowledgeGraph
            .map((k) => `<div class="kg-row"><span>${esc(k.from)}</span><span class="rel">${esc(k.rel)}</span><span>${esc(k.to)}</span></div>`)
            .join('')}
        </div>
      </article>
    `;
  };

  const renderGovernance = () => {
    const g = HubStore.get().governance;
    const tabs = [
      ['policies', 'السياسات'],
      ['compliance', 'الامتثال'],
      ['standards', 'معايير الجودة'],
      ['pr', 'عقوبات ومكافآت'],
      ['constitution', 'مستودع الدستور'],
    ];
    let body = '';
    if (govTab === 'policies') {
      body = `
        <div class="toolbar">
          <div class="field"><label>عنوان السياسة</label><input id="pol-title" placeholder="سياسة جديدة" /></div>
          <div class="field"><label>النطاق</label>
            <select id="pol-scope"><option>القوى العاملة</option><option>المهام</option><option>الأنظمة</option><option>التكامل</option></select>
          </div>
          <button class="btn btn-primary" data-action="add-policy">إضافة مسودة</button>
        </div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>الكود</th><th>العنوان</th><th>النطاق</th><th>الحالة</th><th></th></tr></thead>
          <tbody>${g.policies
            .map(
              (p) => `<tr>
                <td>${esc(p.code)}</td><td>${esc(p.title)}</td><td>${esc(p.scope)}</td><td>${badgeStatus(p.status)}</td>
                <td>${p.status !== 'active' ? `<button class="btn btn-sm btn-primary" data-action="activate-policy" data-id="${p.id}">تفعيل</button>` : '—'}</td>
              </tr>`
            )
            .join('')}</tbody>
        </table></div>`;
    } else if (govTab === 'compliance') {
      body = `<div class="table-wrap"><table class="data">
        <thead><tr><th>الكيان</th><th>نسبة الالتزام</th><th>المخالفات</th></tr></thead>
        <tbody>${g.compliance
          .map((c) => `<tr><td>${esc(c.entity)}</td><td>${c.rate}% ${bar(c.rate)}</td><td>${c.violations}</td></tr>`)
          .join('')}</tbody>
      </table></div>`;
    } else if (govTab === 'standards') {
      body = `<div class="grid-3">${g.standards
        .map(
          (s) => `<article class="card" style="padding:12px;border-top:3px solid var(--red)">
            <b>${esc(s.name)}</b> ${badgeStatus(s.level)}
            <p style="margin:8px 0 0;color:var(--muted);font-size:13px">${esc(s.description)}</p>
          </article>`
        )
        .join('')}</div>`;
    } else if (govTab === 'pr') {
      body = `
        <div class="toolbar">
          <div class="field"><label>النوع</label><select id="pr-type"><option value="reward">مكافأة</option><option value="penalty">عقوبة</option></select></div>
          <div class="field"><label>المستهدف</label><input id="pr-target" placeholder="اسم / مكتب" /></div>
          <div class="field"><label>السبب</label><input id="pr-reason" placeholder="السبب" /></div>
          <div class="field"><label>النقاط</label><input id="pr-points" type="number" value="20" /></div>
          <button class="btn btn-primary" data-action="issue-pr">إصدار</button>
        </div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>النوع</th><th>المستهدف</th><th>السبب</th><th>النقاط</th><th>الوقت</th></tr></thead>
          <tbody>${g.penaltiesRewards
            .map(
              (x) => `<tr><td>${badgeStatus(x.type === 'reward' ? 'active' : 'critical')}</td><td>${esc(x.target)}</td><td>${esc(x.reason)}</td><td>${x.points}</td><td>${fmtTime(x.at)}</td></tr>`
            )
            .join('')}</tbody>
        </table></div>`;
    } else {
      body = `
        <div class="toolbar">
          <div class="field"><label>المادة</label><input id="con-article" placeholder="المادة 3" /></div>
          <div class="field" style="flex:2"><label>النص</label><input id="con-text" placeholder="نص المادة..." /></div>
          <button class="btn btn-primary" data-action="add-constitution">إضافة</button>
        </div>
        ${g.constitution
          .map(
            (c) => `<div style="border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
              <b>${esc(c.article)}</b>
              <p style="margin:6px 0 0;color:var(--muted)">${esc(c.text)}</p>
            </div>`
          )
          .join('')}`;
    }

    return `
      <div class="tabs">
        ${tabs.map(([k, l]) => `<button class="tab ${govTab === k ? 'active' : ''}" data-action="gov-tab" data-tab="${k}">${l}</button>`).join('')}
      </div>
      <article class="card">${body}</article>
    `;
  };

  const renderWorkforce = () => {
    const w = HubStore.get().workforce;
    return `
      <div class="toolbar">
        <button class="btn btn-dark" data-action="tick-productivity"><i class="fas fa-heartbeat"></i> تحديث الإنتاجية اللحظية</button>
      </div>
      <div class="grid-2">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-users icon"></i> الموظفون</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>الاسم</th><th>الدور</th><th>ساعات</th><th>إنتاجية</th><th>درجة</th><th>حالة</th><th></th></tr></thead>
            <tbody>
              ${w.employees
                .map(
                  (e) => `<tr>
                    <td>${esc(e.name)}</td><td>${esc(e.role)}</td><td>${e.hours}</td>
                    <td>${e.productivity}% ${bar(e.productivity)}</td><td>${e.score}</td><td>${badgeStatus(e.status)}</td>
                    <td style="display:flex;gap:4px">
                      <button class="btn btn-sm btn-ghost" data-action="warn-emp" data-id="${e.id}">إنذار</button>
                      <button class="btn btn-sm btn-primary" data-action="reward-emp" data-id="${e.id}">مكافأة</button>
                    </td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table></div>
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-gift icon"></i> المكافآت التلقائية</span></h3>
          ${w.rewards.length
            ? w.rewards
                .map(
                  (r) => `<div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px">
                    <b>${esc(r.employee)}</b> · <span class="badge badge-red">${r.amount}</span>
                    <div style="font-size:12px;color:var(--muted);margin-top:4px">${esc(r.reason)} · ${fmtTime(r.at)}</div>
                  </div>`
                )
                .join('')
            : '<div class="empty">لا مكافآت بعد</div>'}
        </article>
      </div>
    `;
  };

  const renderSystems = () => {
    const s = HubStore.get().systems;
    const market = HubStore.get().empire.marketplace;
    return `
      <div class="toolbar">
        <button class="btn btn-primary" data-action="sync-all"><i class="fas fa-sync"></i> مزامنة كل الأنظمة</button>
      </div>
      <article class="card" style="margin-bottom:12px">
        <h3><span class="title-left"><i class="fas fa-store icon"></i> System Marketplace</span></h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>النظام</th><th>التصنيف</th><th>المستأجرون</th><th>الحالة</th><th></th></tr></thead>
          <tbody>
            ${market.catalog
              .map(
                (sys) => `<tr>
                  <td><strong>${esc(sys.name)}</strong></td>
                  <td>${esc(sys.category)}</td>
                  <td>${sys.tenants}</td>
                  <td>${badgeStatus(sys.status)}</td>
                  <td><button class="btn btn-sm btn-dark" data-action="toggle-market" data-id="${sys.id}">تفعيل/إيقاف</button></td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table></div>
      </article>
      <div class="grid-2">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-server icon"></i> صحة التشغيل اللحظية</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>النظام</th><th>الصحة</th><th>الحالة</th><th>آخر مزامنة</th><th></th></tr></thead>
            <tbody>
              ${s.registry
                .map(
                  (sys) => `<tr>
                    <td>${esc(sys.name)}</td><td>${sys.health}% ${bar(sys.health)}</td><td>${badgeStatus(sys.status)}</td>
                    <td>${fmtTime(sys.lastSync)}</td>
                    <td><button class="btn btn-sm btn-dark" data-action="sync-one" data-id="${sys.id}">مزامنة</button></td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table></div>
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-building icon"></i> العملاء / المؤسسات</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>العميل</th><th>أنظمة</th><th>الحالة</th></tr></thead>
            <tbody>
              ${s.clients
                .map((c) => `<tr><td>${esc(c.name)}</td><td>${c.systems}</td><td>${badgeStatus(c.status)}</td></tr>`)
                .join('')}
            </tbody>
          </table></div>
        </article>
      </div>
    `;
  };

  const renderTasks = () => {
    const t = HubStore.get().tasks;
    const people = HubStore.get().workforce.employees.map((e) => e.name);
    return `
      <div class="toolbar">
        <div class="field"><label>المهمة</label><input id="task-title" placeholder="عنوان المهمة" /></div>
        <div class="field"><label>المسؤول</label>
          <select id="task-assignee">${people.map((p) => `<option>${esc(p)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>الأولوية</label>
          <select id="task-priority"><option>عاجل</option><option>عالي</option><option selected>متوسط</option></select>
        </div>
        <div class="field"><label>المشروع</label><input id="task-project" value="تشغيل يومي" /></div>
        <button class="btn btn-primary" data-action="add-task">إضافة مهمة</button>
      </div>
      <div class="grid-2">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-list-check icon"></i> المهام</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>المهمة</th><th>المسؤول</th><th>أولوية</th><th>حالة</th><th>جودة</th><th></th></tr></thead>
            <tbody>
              ${t.items
                .map(
                  (item) => `<tr>
                    <td>${esc(item.title)}</td><td>${esc(item.assignee)}</td><td>${badgeStatus(item.priority)}</td>
                    <td>${badgeStatus(item.status)}</td><td>${item.quality || '—'}</td>
                    <td style="display:flex;gap:4px;flex-wrap:wrap">
                      ${item.status !== 'in_progress' && item.status !== 'done' ? `<button class="btn btn-sm btn-ghost" data-action="task-status" data-id="${item.id}" data-status="in_progress">بدء</button>` : ''}
                      ${item.status !== 'done' ? `<button class="btn btn-sm btn-primary" data-action="task-status" data-id="${item.id}" data-status="done">إتمام</button>` : ''}
                      ${item.status !== 'blocked' && item.status !== 'done' ? `<button class="btn btn-sm btn-dark" data-action="task-status" data-id="${item.id}" data-status="blocked">اختناق</button>` : ''}
                    </td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table></div>
        </article>
        <div style="display:grid;gap:12px">
          <article class="card">
            <h3><span class="title-left"><i class="fas fa-diagram-project icon"></i> المشاريع</span></h3>
            ${t.projects
              .map(
                (p) => `<div style="margin-bottom:12px">
                  <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800"><span>${esc(p.name)}</span><span>${p.progress}%</span></div>
                  <small style="color:var(--muted)">${esc(p.phase)} · ${esc(p.owner)}</small>
                  <div style="margin-top:6px">${bar(p.progress)}</div>
                </div>`
              )
              .join('')}
          </article>
          <article class="card">
            <h3><span class="title-left"><i class="fas fa-road-barrier icon"></i> الاختناقات</span></h3>
            ${t.bottlenecks
              .map(
                (b) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
                  <span><b>${esc(b.area)}</b><br/><small style="color:var(--muted)">${b.waitHours} ساعة انتظار</small></span>
                  ${badgeStatus(b.severity)}
                </div>`
              )
              .join('')}
          </article>
        </div>
      </div>
    `;
  };

  const renderMeasurement = () => {
    const m = HubStore.get().measurement;
    return `
      <div class="toolbar">
        <button class="btn btn-primary" data-action="recalc-measure"><i class="fas fa-calculator"></i> إعادة حساب الدرجات</button>
      </div>
      <div class="grid-3">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-star icon"></i> الدرجات الموحدة</span></h3>
          ${m.scores
            .map(
              (row) => `<div style="margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px">
                  <span>${esc(row.entity)}</span><span>${row.score} · ${badgeStatus(row.level)}</span>
                </div>
                ${bar(row.score)}
              </div>`
            )
            .join('')}
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-border-all icon"></i> مصفوفة الأداء</span></h3>
          ${m.matrix
            .map(
              (x) => `<div style="margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700"><span>${esc(x.axis)}</span><span>${x.value}</span></div>
                ${bar(x.value)}
              </div>`
            )
            .join('')}
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-handshake icon"></i> أثر العملاء</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>العميل</th><th>الأثر</th><th>الاتجاه</th></tr></thead>
            <tbody>
              ${m.clientImpact
                .map(
                  (c) => `<tr>
                    <td>${esc(c.client)}</td><td>${c.impact}% ${bar(c.impact)}</td>
                    <td>${c.trend === 'up' ? '<span class="badge badge-black">صاعد</span>' : '<span class="badge badge-red">هابط</span>'}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table></div>
        </article>
      </div>
    `;
  };

  const renderReports = () => {
    const r = HubStore.get().reports;
    const types = Object.keys(HubStore.REPORT_TITLES);
    const selected = r.generated.find((x) => x.type === reportTab) || r.generated[0];
    return `
      <div class="tabs">
        ${types
          .map(
            (t) =>
              `<button class="tab ${reportTab === t ? 'active' : ''}" data-action="report-tab" data-tab="${t}">${HubStore.REPORT_TITLES[t]}</button>`
          )
          .join('')}
      </div>
      <div class="toolbar">
        <button class="btn btn-primary" data-action="gen-report" data-type="${reportTab}"><i class="fas fa-file-lines"></i> توليد ${HubStore.REPORT_TITLES[reportTab]}</button>
      </div>
      <div class="grid-2">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-clock icon"></i> جدول التقارير</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>النوع</th><th>التالي</th></tr></thead>
            <tbody>${r.schedule.map((s) => `<tr><td>${esc(s.label)}</td><td>${esc(s.next)}</td></tr>`).join('')}</tbody>
          </table></div>
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-scroll icon"></i> التقارير المُولَّدة</span></h3>
          ${r.generated.length
            ? r.generated
                .slice(0, 8)
                .map(
                  (rep) => `<div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px">
                    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
                      <b>${esc(rep.title)}</b>${badgeStatus(rep.status)}
                    </div>
                    <small style="color:var(--muted)">${fmtTime(rep.at)}</small>
                    ${
                      rep.body
                        ? `<div class="report-body"><b>${esc(rep.body.date)}</b><br/>${esc(rep.body.summary)}<br/>
                      قرارات: ${rep.body.kpis?.decisionsToday ?? '—'} · امتثال: ${rep.body.kpis?.compliance ?? '—'}% · إنتاجية: ${rep.body.kpis?.productivity ?? '—'}%</div>`
                        : ''
                    }
                  </div>`
                )
                .join('')
            : '<div class="empty">لا تقارير بعد — اضغط توليد</div>'}
          ${selected ? '' : ''}
        </article>
      </div>
    `;
  };

  const renderIntegration = () => {
    const i = HubStore.get().integration;
    return `
      <div class="kpi-grid">
        <article class="kpi"><span>حالة البوابة</span><strong style="font-size:20px">${esc(i.gateway.status)}</strong><small>API Gateway</small></article>
        <article class="kpi"><span>الطلبات/ث</span><strong>${i.gateway.rps}</strong><small>RPS</small></article>
        <article class="kpi"><span>الكمون</span><strong>${i.gateway.latencyMs}ms</strong><small>Latency</small></article>
        <article class="kpi"><span>الأخطاء</span><strong>${i.gateway.errors}%</strong><small>Error rate</small></article>
      </div>
      <div class="toolbar">
        <button class="btn btn-primary" data-action="ping-gateway"><i class="fas fa-satellite-dish"></i> فحص البوابة</button>
      </div>
      <div class="grid-2">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-plug icon"></i> الموصلات</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>الموصل</th><th>النوع</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              ${i.connectors
                .map(
                  (c) => `<tr>
                    <td>${esc(c.name)}</td><td>${esc(c.type)}</td><td>${badgeStatus(c.status)}</td>
                    <td><button class="btn btn-sm btn-dark" data-action="toggle-connector" data-id="${c.id}">تبديل</button></td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table></div>
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-code icon"></i> مسارات API النشطة</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Method</th><th>Path</th><th>Calls</th></tr></thead>
            <tbody>
              ${i.apis.map((a) => `<tr><td><span class="badge badge-red">${esc(a.method)}</span></td><td>${esc(a.path)}</td><td>${a.calls}</td></tr>`).join('')}
            </tbody>
          </table></div>
        </article>
      </div>
    `;
  };

  const renderers = {
    overview: renderOverview,
    blueprint: renderBlueprint,
    platforms: renderPlatforms,
    apps: renderApps,
    store: renderStorePanel,
    'ads-studio': renderAdsStudio,
    'events-studio': renderEventsStudio,
    identity: renderIdentity,
    organization: renderOrganization,
    incubators: renderIncubators,
    wallet: renderWallet,
    core: renderCore,
    governance: renderGovernance,
    workforce: renderWorkforce,
    systems: renderSystems,
    tasks: renderTasks,
    measurement: renderMeasurement,
    reports: renderReports,
    integration: renderIntegration,
  };

  const render = () => {
    root.innerHTML = `<section class="panel active">${renderers[current]()}</section>`;
  };

  // —— Event delegation
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

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
        const assignee = $('#task-assignee')?.value;
        const priority = $('#task-priority')?.value;
        const project = $('#task-project')?.value.trim() || 'تشغيل يومي';
        if (!title) return toast('عنوان المهمة مطلوب');
        HubStore.addTask(title, assignee, priority, project);
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
        const url = $('#app-url')?.value.trim() || 'apps.html';
        if (!code || !nameAr) return toast('رمز النظام والاسم مطلوبان');
        HubStore.registerApp({ code, nameAr, category, url, kind: 'system', icon: 'fa-cube' });
        toast('تم تسجيل النظام في هوب');
        break;
      }
      case 'toggle-app':
        HubStore.toggleApp(id);
        toast('تحدّثت حالة النظام');
        break;
      case 'add-store-item': {
        const title = $('#store-title')?.value.trim();
        if (!title) return toast('اسم المنتج مطلوب');
        HubStore.addStoreItem({
          title,
          price: $('#store-price')?.value,
          points: $('#store-points')?.value,
          platformCode: $('#store-platform')?.value.trim(),
          desc: 'منتج مضاف من غرفة العمليات',
          category: 'تشغيل',
        });
        toast('أُضيف المنتج للمتجر');
        break;
      }
      case 'buy-store-item':
        if (!HubStore.placeStoreOrder(id, user.name || 'مشغّل هوب')) return toast('تعذّر البيع');
        toast('تم تسجيل عملية البيع');
        break;
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
      default:
        break;
    }
    renderNav();
    render();
  });

  const hash = (window.location.hash || '#overview').replace('#', '');
  activate(TITLES[hash] ? hash : 'overview');
})();
