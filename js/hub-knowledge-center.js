/**
 * مركز المعرفة والتشغيل والتعلم — ملف 01 + طبقات ملف 04
 * 6 طبقات: معرفة · تشغيل · تدريب · مهارات · اسأل نايوش · تحكم بالإصدارات
 */
(() => {
  'use strict';

  const PROFILE_KEY = 'hubKolLearnerProfile';
  const ROLE_KEY = 'hubKolViewRole';
  const ONBOARD_KEY = 'hubKolOnboardDismissed';

  const LAYERS = [
    { id: 'knowledge', label: '① المعرفة', tab: 'knowledge' },
    { id: 'operations', label: '② التشغيل', tab: 'operations' },
    { id: 'training', label: '③ التدريب', tab: 'learning' },
    { id: 'skills', label: '④ المهارات', tab: 'learning' },
    { id: 'ask', label: '⑤ اسأل نايوش', tab: 'knowledge', focus: 'ask' },
    { id: 'governance', label: '⑥ تحكم المعرفة', tab: 'knowledge', focus: 'gov' },
  ];

  const ROLES = [
    { id: 'all', label: 'كل الأدوار' },
    { id: 'trainee', label: 'متدرّب' },
    { id: 'incubator-manager', label: 'مدير حاضنة' },
    { id: 'branch-manager', label: 'مدير فرع' },
    { id: 'super-admin', label: 'Super Admin' },
  ];

  const TAXONOMY = [
    { id: 'empire', label: 'إمبراطورية نايوش' },
    { id: 'branch', label: 'فرع' },
    { id: 'incubator', label: 'حاضنة' },
    { id: 'platform', label: 'منصة' },
    { id: 'office', label: 'مكتب إلكتروني' },
    { id: 'system', label: 'نظام' },
    { id: 'procedure', label: 'إجراء / خدمة' },
  ];

  const KNOWLEDGE = [
    {
      id: 'k-hub-overview',
      title: 'ما هو نايوش هوب 360؟',
      type: 'دليل',
      level: 'empire',
      sector: 'تشغيل',
      role: 'الجميع',
      roles: ['all', 'trainee', 'incubator-manager', 'branch-manager', 'super-admin'],
      version: '1.0',
      status: 'معتمد',
      owner: 'مركز المعرفة',
      approver: 'الإدارة المركزية',
      reviewedAt: '2026-06-01',
      keywords: ['هوب', 'غرفة عمليات', 'هوية'],
      summary: 'غرفة العمليات المركزية لإمبراطورية نايوش: وضوح · قياس · سيطرة عبر Core Platform و NAIOSH ID.',
      links: [{ href: 'index.html', label: 'الرئيسية' }, { href: 'operating.html', label: 'آلية التشغيل' }],
    },
    {
      id: 'k-incubator-policy',
      title: 'سياسة إدارة الحاضنات',
      type: 'سياسة',
      level: 'incubator',
      sector: 'حاضنات',
      role: 'مدير حاضنة',
      roles: ['incubator-manager', 'branch-manager', 'super-admin'],
      version: '1.2',
      status: 'معتمد',
      owner: 'مدير نظام الحاضنات',
      approver: 'مدير الفرع',
      reviewedAt: '2026-07-15',
      keywords: ['حاضنة', 'سياسة', 'اعتماد'],
      summary: 'كائن معرفي يحدد قواعد إنشاء واعتماد وتشغيل الحاضنة والربط بالمنصات والمكاتب.',
      links: [{ href: 'incubators.html', label: 'الحاضنات' }, { href: 'policies.html', label: 'مكتبة السياسات' }],
    },
    {
      id: 'k-sso',
      title: 'الدخول الموحد والصلاحيات',
      type: 'إجراء',
      level: 'system',
      sector: 'هوية',
      role: 'مدير نظام',
      roles: ['branch-manager', 'super-admin', 'trainee'],
      version: '1.1',
      status: 'معتمد',
      owner: 'هوية نايوش',
      approver: 'Super Admin',
      reviewedAt: '2026-05-20',
      keywords: ['SSO', 'صلاحيات', 'أدوار', 'وصول'],
      summary: 'كيف تُنشأ الهوية الرقمية الموحدة وتربط بالموقع التنظيمي والأنظمة المسموح بها.',
      links: [{ href: 'login.html', label: 'تسجيل الدخول' }, { href: 'dashboard.html', label: 'غرفة العمليات' }],
    },
    {
      id: 'k-wallet',
      title: 'الرصيد والنقاط والاشتراك',
      type: 'دليل',
      level: 'system',
      sector: 'اقتصاد',
      role: 'مستخدم',
      roles: ['all', 'trainee', 'incubator-manager', 'branch-manager', 'super-admin'],
      version: '1.0',
      status: 'معتمد',
      owner: 'المحفظة',
      approver: 'الإدارة المالية',
      reviewedAt: '2026-04-10',
      keywords: ['رصيد', 'نقاط', 'باقات'],
      summary: 'منح رصيد مجاني، شحن الرصيد الموحد، وربط الاشتراك بصلاحية النظام.',
      links: [{ href: 'packages.html', label: 'الباقات' }, { href: 'store.html', label: 'المتجر' }],
    },
    {
      id: 'k-privacy',
      title: 'خصوصية وحماية البيانات',
      type: 'سياسة',
      level: 'empire',
      sector: 'حوكمة',
      role: 'الجميع',
      roles: ['all', 'trainee', 'incubator-manager', 'branch-manager', 'super-admin'],
      version: '1.0',
      status: 'قيد المراجعة',
      owner: 'حوكمة البيانات',
      approver: 'الإدارة المركزية',
      reviewedAt: '2026-08-01',
      keywords: ['خصوصية', 'بيانات', 'أمن'],
      summary: 'التزام حماية بيانات الموظفين والعملاء والأنظمة وإجراءات الوصول والتخزين والاختراق.',
      links: [{ href: 'policies.html', label: 'مكتبة السياسات' }, { href: 'quality.html', label: 'الجودة' }],
    },
  ];

  const OPERATIONS = [
    {
      id: 'op-create-incubator',
      title: 'تشغيل حاضنة جديدة',
      owner: 'مدير الفرع',
      permission: 'مدير فرع',
      goal: 'تفعيل حاضنة قطاعية جاهزة للتشغيل',
      system: 'الحاضنات / هوب',
      inputs: 'طلب · قطاع · مدير مقترح',
      output: 'حاضنة مفعّلة',
      risks: 'صلاحيات ناقصة · منصات بلا مكاتب',
      steps: [
        'طلب إنشاء حاضنة',
        'مراجعة الطلب',
        'اعتماد الفرع',
        'تخصيص الحاضنة',
        'إنشاء المنصات',
        'إنشاء المكاتب الإلكترونية',
        'تحديد الصلاحيات',
        'تفعيل الأنظمة',
        'اختبار الجاهزية',
        'التشغيل والمراقبة',
      ],
      links: [{ href: 'incubators.html', label: 'الحاضنات' }, { href: 'operating.html', label: 'دليل التشغيل' }],
    },
    {
      id: 'op-activate-system',
      title: 'تفعيل نظام لمستخدم',
      owner: 'مدير HUB',
      permission: 'مدير HUB / اشتراك',
      goal: 'منح صلاحية الدخول لنظام بعد الاشتراك أو المنح',
      system: 'المتجر / الهوية',
      inputs: 'مستخدم · نظام · اشتراك',
      output: 'أيقونة نظام مفتوحة',
      risks: 'اشتراك منتهٍ · دور خاطئ',
      steps: [
        'اختيار النظام',
        'التحقق من الاشتراك أو المنح',
        'ربط المستخدم بالكيان التنظيمي',
        'تعيين الدور',
        'فتح أيقونة النظام',
        'اختبار الدخول',
      ],
      links: [{ href: 'apps.html', label: 'الأنظمة' }, { href: 'store.html', label: 'المتجر' }],
    },
    {
      id: 'op-charge-balance',
      title: 'شحن الرصيد الموحد',
      owner: 'المستخدم',
      permission: 'مستخدم مسجّل',
      goal: 'شحن نقاط للاستخدام عبر أنظمة الإمبراطورية',
      system: 'المحفظة',
      inputs: 'مبلغ / باقة',
      output: 'رصيد مدفوع محدّث',
      risks: 'فشل دفع · رصيد معلّق',
      steps: ['فتح إشحن رصيد', 'اختيار الباقة أو المبلغ', 'تأكيد الشحن', 'تحديث الرصيد المدفوع'],
      links: [{ href: 'index.html#charge', label: 'إشحن رصيد' }, { href: 'dashboard.html', label: 'المحفظة' }],
    },
  ];

  const COURSES = [
    {
      id: 'c-incubator-manager',
      title: 'مدير الحاضنة — المستوى الأساسي',
      role: 'مدير حاضنة',
      skillGate: 80,
      units: [
        'التعريف بالحاضنة',
        'إدارة المنصات',
        'إدارة المكاتب',
        'إدارة المستخدمين',
        'الصلاحيات',
        'التقارير',
        'مؤشرات الأداء',
        'حل المشكلات',
      ],
      linkedOp: 'op-create-incubator',
      linkedKnowledge: 'k-incubator-policy',
      simulation: 'أنشئ حاضنة جديدة لقطاع الخدمات',
    },
    {
      id: 'c-hub-ops',
      title: 'تشغيل هوب 360 — أساسيات',
      role: 'موظف / مدير',
      skillGate: 70,
      units: ['ما هو هوب', 'الهوية الموحدة', 'الرصيد والاشتراك', 'غرفة العمليات', 'مركز المعرفة'],
      linkedOp: 'op-activate-system',
      linkedKnowledge: 'k-hub-overview',
      simulation: 'فعّل نظاماً لمستخدم بعد التحقق من الاشتراك',
    },
  ];

  const levelLabel = (id) => TAXONOMY.find((t) => t.id === id)?.label || id;

  const readProfile = () => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    const seed = {
      knowledge: 65,
      experience: 80,
      digital: 45,
      applied: 72,
      completed: [],
      skills: { 'مدير حاضنة': 0, 'تشغيل هوب': 40 },
      simulations: {},
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(seed));
    return seed;
  };

  const saveProfile = (p) => localStorage.setItem(PROFILE_KEY, JSON.stringify(p));

  const viewRole = () => localStorage.getItem(ROLE_KEY) || 'all';
  const setViewRole = (r) => localStorage.setItem(ROLE_KEY, r);

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];

  const activateTab = (tabId, focus) => {
    qsa('[data-kol-tab]').forEach((b) => {
      const on = b.getAttribute('data-kol-tab') === tabId;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    });
    qsa('[data-kol-panel]').forEach((p) => {
      p.classList.toggle('is-active', p.getAttribute('data-kol-panel') === tabId);
    });
    if (focus === 'ask') qs('[data-kol-ask-input]')?.focus();
    if (focus === 'gov') qs('[data-kol-gov-hint]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const renderLayers = () => {
    const root = qs('[data-kol-layers]');
    if (!root) return;
    root.innerHTML = LAYERS.map(
      (l) => `<button type="button" data-kol-layer="${l.id}" data-tab="${l.tab}" data-focus="${l.focus || ''}">${l.label}</button>`
    ).join('');
  };

  const renderOnboard = () => {
    const root = qs('[data-kol-onboard]');
    if (!root) return;
    if (localStorage.getItem(ONBOARD_KEY) === '1') {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    root.innerHTML = `
      <strong>الدليل يتبعك</strong>
      <p>مرحباً بك في مركز المعرفة والتشغيل. مهمتك الأولى المقترحة: فهم تشغيل الحاضنة ثم تجربة المحاكاة.</p>
      <div class="kol-onboard-actions">
        <button type="button" data-kol-start-path>ابدأ المسار السريع</button>
        <button type="button" data-kol-dismiss-onboard class="ghost">لاحقاً</button>
      </div>`;
  };

  const renderKpis = () => {
    const root = qs('[data-kol-kpis]');
    if (!root) return;
    const profile = readProfile();
    const approved = KNOWLEDGE.filter((k) => k.status === 'معتمد').length;
    const items = [
      { n: KNOWLEDGE.length, l: 'كائنات معرفة' },
      { n: OPERATIONS.length, l: 'قوالب تشغيل' },
      { n: COURSES.length, l: 'مسارات تعلّم' },
      { n: profile.completed.length, l: 'دورات مكتملة' },
      { n: approved, l: 'معرفة معتمدة' },
    ];
    root.innerHTML = items
      .map((i) => `<article class="kol-kpi"><strong>${i.n}</strong><span>${i.l}</span></article>`)
      .join('');
  };

  const renderKnowledge = () => {
    const list = qs('[data-kol-knowledge]');
    const q = (qs('[data-kol-q]')?.value || '').trim().toLowerCase();
    const level = qs('[data-kol-level]')?.value || '';
    const role = viewRole();
    if (!list) return;
    const rows = KNOWLEDGE.filter((k) => {
      const hay = `${k.title} ${k.summary} ${k.keywords.join(' ')} ${k.type} ${k.status}`.toLowerCase();
      const okQ = !q || hay.includes(q);
      const okL = !level || k.level === level;
      const okR =
        role === 'all' ||
        role === 'super-admin' ||
        (k.roles || []).includes(role) ||
        (k.roles || []).includes('all');
      return okQ && okL && okR;
    });
    if (!rows.length) {
      list.innerHTML = '<div class="kol-empty">لا توجد نتائج مطابقة لدورك أو بحثك.</div>';
      return;
    }
    list.innerHTML = rows
      .map(
        (k) => `
      <article class="kol-card" data-id="${k.id}">
        <h3>${k.title}</h3>
        <div class="kol-meta">
          <span>${k.type}</span>
          <span>${levelLabel(k.level)}</span>
          <span>${k.sector}</span>
          <span>${k.role}</span>
          <span>الإصدار ${k.version}</span>
          <span class="kol-status">${k.status}</span>
        </div>
        <p>${k.summary}</p>
        <p class="kol-gov" data-kol-gov-hint>المالك: ${k.owner} · الاعتماد: ${k.approver} · آخر مراجعة: ${k.reviewedAt}</p>
        <div class="kol-actions">
          ${k.links.map((l) => `<a class="primary" href="${l.href}">${l.label}</a>`).join('')}
        </div>
      </article>`
      )
      .join('');
  };

  const renderOperations = () => {
    const list = qs('[data-kol-ops]');
    if (!list) return;
    list.innerHTML = OPERATIONS.map(
      (op) => `
      <article class="kol-card">
        <h3>${op.title}</h3>
        <div class="kol-meta">
          <span>المسؤول: ${op.owner}</span>
          <span>الصلاحية: ${op.permission}</span>
          <span>${op.system}</span>
        </div>
        <p><strong>الهدف:</strong> ${op.goal}</p>
        <p><strong>المدخلات:</strong> ${op.inputs || '—'} · <strong>الناتج:</strong> ${op.output || '—'}</p>
        <p><strong>مخاطر:</strong> ${op.risks || '—'}</p>
        <ol class="kol-steps">
          ${op.steps.map((s, i) => `<li data-n="${i + 1}">${s}</li>`).join('')}
        </ol>
        <div class="kol-actions">
          ${op.links.map((l) => `<a class="primary" href="${l.href}">${l.label}</a>`).join('')}
        </div>
      </article>`
    ).join('');
  };

  const renderLearning = () => {
    const profileRoot = qs('[data-kol-profile]');
    const list = qs('[data-kol-courses]');
    const profile = readProfile();
    if (profileRoot) {
      profileRoot.innerHTML = `
        <article><strong>${profile.knowledge}%</strong><span>معرفة</span></article>
        <article><strong>${profile.experience}%</strong><span>خبرة</span></article>
        <article><strong>${profile.digital}%</strong><span>مهارة رقمية</span></article>
        <article><strong>${profile.applied}%</strong><span>قدرة تطبيقية</span></article>`;
    }
    if (!list) return;
    list.innerHTML = COURSES.map((c) => {
      const done = profile.completed.includes(c.id);
      const skill = profile.skills[c.role] || 0;
      const unlocked = skill >= c.skillGate;
      const sim = profile.simulations?.[c.id];
      return `
        <article class="kol-card">
          <h3>${c.title}</h3>
          <div class="kol-meta">
            <span>الدور: ${c.role}</span>
            <span>عتبة الإتقان: ${c.skillGate}%</span>
            <span>الحالي: ${skill}%</span>
            <span>${done ? 'مكتملة' : 'قيد المسار'}</span>
            <span>${unlocked ? 'صلاحية قابلة للفتح' : 'صلاحية مقيدة'}</span>
          </div>
          <p>وحدات المسار:</p>
          <ol class="kol-steps">
            ${c.units.map((u, i) => `<li data-n="${i + 1}">${u}</li>`).join('')}
          </ol>
          <p><strong>محاكاة عملية:</strong> ${c.simulation || '—'}</p>
          ${
            sim
              ? `<div class="kol-sim-score">معرفة ${sim.knowledge}% · تطبيق ${sim.apply}% · سرعة ${sim.speed}% · دقة ${sim.accuracy}% · <strong>النتيجة ${sim.final}%</strong></div>`
              : ''
          }
          <div class="kol-actions">
            <button type="button" class="primary" data-kol-complete="${c.id}">${done ? 'إعادة تقييم المهارة' : 'إكمال الاختبار وإتقان'}</button>
            <button type="button" data-kol-simulate="${c.id}">تشغيل محاكاة المهارة</button>
            <a href="operating.html">دليل التشغيل</a>
          </div>
        </article>`;
    }).join('');
  };

  const askAi = () => {
    const input = qs('[data-kol-ask-input]');
    const out = qs('[data-kol-ask-answer]');
    if (!input || !out) return;
    const q = input.value.trim();
    if (!q) {
      out.textContent = 'اكتب سؤالاً تشغيلياً معتمداً داخل نايوش.';
      return;
    }
    const hay = q.toLowerCase();
    if (hay.includes('لا أستطيع') || hay.includes('صلاح') || hay.includes('وصول')) {
      out.textContent =
        'تشخيص صلاحيات مقترح: تحقق من الدور الحالي، الاشتراك، وربط الكيان التنظيمي. الجهة المانحة عادة مدير HUB أو مدير الفرع. AI يقترح فقط — الاعتماد بشري.';
      return;
    }
    const hit =
      KNOWLEDGE.find((k) => `${k.title} ${k.summary} ${k.keywords.join(' ')}`.toLowerCase().includes(hay)) ||
      KNOWLEDGE.find((k) => k.keywords.some((w) => hay.includes(w.toLowerCase())));
    const op =
      OPERATIONS.find((o) => hay.includes('حاضنة') && o.id === 'op-create-incubator') ||
      OPERATIONS.find((o) => o.title.toLowerCase().includes(hay));
    if (!hit && !op) {
      out.textContent =
        'لم يُعثر على إجابة معتمدة في قاعدة المعرفة. سُجّل السؤال لتحسين FAQ الحي. الاعتماد النهائي يبقى للخبير المخوّل.';
      return;
    }
    const parts = [];
    if (hit) parts.push(`معرفة «${hit.title}» v${hit.version} (${hit.status}): ${hit.summary}`);
    if (op) parts.push(`إجراء مرتبط: ${op.title} — الناتج: ${op.output}`);
    const course = COURSES.find((c) => c.linkedKnowledge === hit?.id || c.linkedOp === op?.id);
    if (course) parts.push(`دورة مرتبطة: ${course.title}`);
    parts.push('AI يقترح فقط؛ الاعتماد النهائي بشري.');
    out.textContent = parts.join(' — ');
  };

  const completeCourse = (id) => {
    const course = COURSES.find((c) => c.id === id);
    if (!course) return;
    const profile = readProfile();
    if (!profile.completed.includes(id)) profile.completed.push(id);
    const current = profile.skills[course.role] || 0;
    profile.skills[course.role] = Math.min(100, Math.max(current, course.skillGate + 5));
    profile.knowledge = Math.min(100, profile.knowledge + 3);
    profile.applied = Math.min(100, profile.applied + 4);
    saveProfile(profile);
    renderKpis();
    renderLearning();
  };

  const runSimulation = (id) => {
    const course = COURSES.find((c) => c.id === id);
    if (!course) return;
    const profile = readProfile();
    if (!profile.simulations) profile.simulations = {};
    const knowledge = 80 + Math.floor(Math.random() * 15);
    const apply = 82 + Math.floor(Math.random() * 14);
    const speed = 75 + Math.floor(Math.random() * 18);
    const accuracy = 85 + Math.floor(Math.random() * 12);
    const final = Math.round((knowledge + apply + speed + accuracy) / 4);
    profile.simulations[id] = { knowledge, apply, speed, accuracy, final };
    profile.skills[course.role] = Math.min(100, Math.max(profile.skills[course.role] || 0, final));
    profile.applied = Math.min(100, profile.applied + 2);
    if (final >= course.skillGate && !profile.completed.includes(id)) profile.completed.push(id);
    saveProfile(profile);
    renderKpis();
    renderLearning();
  };

  const bindTabs = () => {
    qsa('[data-kol-tab]').forEach((btn) => {
      btn.addEventListener('click', () => activateTab(btn.getAttribute('data-kol-tab')));
    });
  };

  const bind = () => {
    bindTabs();
    qs('[data-kol-q]')?.addEventListener('input', renderKnowledge);
    qs('[data-kol-level]')?.addEventListener('change', renderKnowledge);
    qs('[data-kol-role]')?.addEventListener('change', (e) => {
      setViewRole(e.target.value);
      renderKnowledge();
    });
    qs('[data-kol-ask-btn]')?.addEventListener('click', askAi);
    qs('[data-kol-ask-input]')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') askAi();
    });
    qs('[data-kol-layers]')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-kol-layer]');
      if (!btn) return;
      qsa('[data-kol-layer]').forEach((b) => b.classList.toggle('is-active', b === btn));
      activateTab(btn.getAttribute('data-tab'), btn.getAttribute('data-focus'));
    });
    document.addEventListener('click', (e) => {
      const complete = e.target.closest('[data-kol-complete]');
      if (complete) completeCourse(complete.getAttribute('data-kol-complete'));
      const sim = e.target.closest('[data-kol-simulate]');
      if (sim) runSimulation(sim.getAttribute('data-kol-simulate'));
      if (e.target.closest('[data-kol-dismiss-onboard]')) {
        localStorage.setItem(ONBOARD_KEY, '1');
        renderOnboard();
      }
      if (e.target.closest('[data-kol-start-path]')) {
        localStorage.setItem(ONBOARD_KEY, '1');
        renderOnboard();
        activateTab('learning');
      }
    });
  };

  const init = () => {
    if (!qs('[data-kol-root]')) return;
    const level = qs('[data-kol-level]');
    if (level) {
      level.innerHTML =
        `<option value="">كل مستويات التصنيف</option>` +
        TAXONOMY.map((t) => `<option value="${t.id}">${t.label}</option>`).join('');
    }
    const role = qs('[data-kol-role]');
    if (role) {
      role.innerHTML = ROLES.map((r) => `<option value="${r.id}">${r.label}</option>`).join('');
      role.value = viewRole();
    }
    renderLayers();
    renderOnboard();
    renderKpis();
    renderKnowledge();
    renderOperations();
    renderLearning();
    bind();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.HubKnowledgeCenter = { KNOWLEDGE, OPERATIONS, COURSES, LAYERS, readProfile };
})();
