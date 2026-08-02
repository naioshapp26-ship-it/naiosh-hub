(() => {
  const NAV = [
    { key: 'overview', icon: 'fa-gauge-high', label: 'نظرة عامة' },
    { key: 'core', icon: 'fa-brain', label: 'العقل المركزي' },
    { key: 'governance', icon: 'fa-scale-balanced', label: 'الحوكمة' },
    { key: 'workforce', icon: 'fa-users-gear', label: 'القوى العاملة' },
    { key: 'systems', icon: 'fa-network-wired', label: 'الأنظمة' },
    { key: 'tasks', icon: 'fa-clipboard-list', label: 'المهام' },
    { key: 'measurement', icon: 'fa-chart-simple', label: 'القياس' },
    { key: 'reports', icon: 'fa-scroll', label: 'التقارير' },
    { key: 'integration', icon: 'fa-plug', label: 'التكامل' },
  ];

  const TITLES = {
    overview: ['غرفة العمليات', 'السيادة التشغيلية اللحظية — كل الطبقات'],
    core: ['العقل المركزي', 'قرار · تنبؤ · تحسين · شذوذ · خريطة معرفة'],
    governance: ['الحوكمة الدستورية', 'سياسات · امتثال · جودة · عقوبات/مكافآت · دستور'],
    workforce: ['القوى العاملة عن بُعد', 'تتبع · إنتاجية · إنذار · مكافآت'],
    systems: ['الأنظمة التشغيلية', 'LMS · LXP · ERP · POSHA · Academy · Fit · Workspace'],
    tasks: ['المهام والمشاريع', 'توزيع · أولويات · اختناقات · جودة تنفيذ'],
    measurement: ['القياس الموحد', 'درجات · مستويات · مصفوفة · أثر العملاء'],
    reports: ['التقارير السيادية', 'يومي · أسبوعي · شهري · مخاطر · نمو · امتثال'],
    integration: ['الربط والتكامل', 'API Gateway · داخلي · خارجي · AI · عملاء'],
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
  let current = 'overview';
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
    $('#sidebar-phase').innerHTML = `
      <strong>خطة التنفيذ</strong>
      <div>المرحلة الحالية: ${esc(tl.phase1.name)} · ${tl.phase1.progress}%</div>
      ${bar(tl.phase1.progress)}
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
    return `
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
      <div class="kpi-grid">
        <article class="kpi"><span>قرارات منفّذة</span><strong>${k.decisionsToday}</strong><small>العقل المركزي</small></article>
        <article class="kpi"><span>الامتثال</span><strong>${k.compliance}%</strong><small>الحوكمة</small></article>
        <article class="kpi"><span>الإنتاجية</span><strong>${k.productivity}%</strong><small>القوى العاملة</small></article>
        <article class="kpi"><span>صحة الأنظمة</span><strong>${k.systemsHealth}%</strong><small>التشغيل</small></article>
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
          <h3><span class="title-left"><i class="fas fa-diagram-project icon"></i> صحة الطبقات</span></h3>
          ${Object.entries({
            'العقل المركزي': lh.core,
            الحوكمة: lh.governance,
            'القوى العاملة': lh.workforce,
            الأنظمة: lh.systems,
            المهام: lh.tasks,
            القياس: lh.measurement,
            التقارير: lh.reports,
            التكامل: lh.integration,
          })
            .map(
              ([name, val]) => `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:4px"><span>${name}</span><span>${val}%</span></div>${bar(val)}</div>`
            )
            .join('')}
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
    return `
      <div class="toolbar">
        <button class="btn btn-primary" data-action="sync-all"><i class="fas fa-sync"></i> مزامنة كل الأنظمة</button>
      </div>
      <div class="grid-2">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-server icon"></i> سجل الأنظمة</span></h3>
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
      default:
        break;
    }
    renderNav();
    render();
  });

  const hash = (window.location.hash || '#overview').replace('#', '');
  activate(TITLES[hash] ? hash : 'overview');
})();
