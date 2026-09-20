/**
 * المشاريع الجانبية — تصفح قوائم العميل (خاصة · خفيفة · منزلية) + اقتراح حسب الملف
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-side-projects-page]');
  const data = window.HubSideProjectsData;
  if (!root || !data) return;

  const KEY = 'naiosh_opportunity_engine_v1';
  const LEGACY_KEY = 'naiosh_side_projects_opened_v1';
  const regApi = window.HubSideProjectRegistrations;
  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const formEl = root.querySelector('[data-sp-form]');
  const resultsPanel = root.querySelector('#sp-results');
  const resultsGrid = root.querySelector('[data-sp-results]');
  const resultsLead = root.querySelector('[data-sp-results-lead]');
  const catalogGrid = root.querySelector('[data-sp-catalog]');
  const catalogLead = root.querySelector('[data-sp-catalog-lead]');
  const catFilter = root.querySelector('[data-sp-cat-filter]');
  const capitalFilter = root.querySelector('[data-sp-capital-filter]');
  const modeFilter = root.querySelector('[data-sp-mode-filter]');
  const typeTabs = root.querySelector('[data-sp-type-tabs]');
  const catDir = root.querySelector('[data-sp-cat-dir]');
  const catHint = root.querySelector('[data-sp-cat-hint]');
  const searchEl = root.querySelector('[data-sp-search]');
  const openedEl = root.querySelector('[data-sp-opened]');
  const statsEl = root.querySelector('[data-sp-stats]');
  const pathEl = root.querySelector('[data-sp-path]');
  const toastEl = document.getElementById('sp-toast');
  const regModal = document.getElementById('sp-reg-modal');
  const regForm = document.querySelector('[data-sp-reg-form]');
  const regListEl = root.querySelector('[data-sp-reg-list]');
  const myListEl = root.querySelector('[data-sp-my-list]');
  const selectedBox = root.querySelector('[data-sp-selected-project]');
  const selectedNameEl = root.querySelector('[data-sp-selected-name]');
  const successModal = document.getElementById('sp-success-modal');
  const successBody = document.querySelector('[data-sp-success-body]');

  const COUNTRIES = [
    'المملكة العربية السعودية',
    'الإمارات العربية المتحدة',
    'الكويت',
    'قطر',
    'البحرين',
    'عُمان',
    'الأردن',
    'مصر',
    'العراق',
    'سوريا',
    'لبنان',
    'فلسطين',
    'اليمن',
    'المغرب',
    'الجزائر',
    'تونس',
    'ليبيا',
    'السودان',
    'موريتانيا',
    'تركيا',
    'أخرى',
  ];

  let selectedProject = null;

  const TYPE_GROUPS = [
    {
      id: 'all',
      nameAr: 'كل القوائم',
      icon: 'fa-border-all',
      categoryIds: null,
    },
    {
      id: 'special',
      nameAr: 'خاصة',
      icon: 'fa-star',
      categoryIds: ['executable', 'experts', 'low-capital', 'low-loss', 'events', 'emotions'],
    },
    {
      id: 'light',
      nameAr: 'خفيفة',
      icon: 'fa-feather',
      categoryIds: ['home-light', 'cart', 'summer', 'winter', 'malls'],
    },
    {
      id: 'home',
      nameAr: 'منزلية',
      icon: 'fa-house',
      categoryIds: ['home-light', 'home-women'],
    },
  ];

  const ENGINE_PATH = [
    { label: 'بيانات الشخص', icon: 'fa-id-card' },
    { label: 'تحليل الفرص', icon: 'fa-brain' },
    { label: 'اقتراح مناسب', icon: 'fa-lightbulb' },
    { label: 'اختيار الفرصة', icon: 'fa-hand-pointer' },
    { label: 'التدريب', icon: 'fa-graduation-cap' },
    { label: 'خطة التشغيل', icon: 'fa-clipboard-list' },
    { label: 'دراسة الجدوى', icon: 'fa-chart-line' },
    { label: 'الموارد', icon: 'fa-truck' },
    { label: 'التسويق', icon: 'fa-bullhorn' },
    { label: 'عملاء المشروع', icon: 'fa-users' },
    { label: 'القياس والتحسين', icon: 'fa-gauge-high' },
    { label: 'التوسع للحاضنة', icon: 'fa-seedling' },
  ];

  /** مراحل تشغيل المشروع → أداة موجودة + سياق المشروع (ليست اختصارات عامة) */
  const OPS_STAGES = [
    {
      id: 'learn',
      n: '1',
      stageLabel: 'التدريب',
      toolLabel: 'التدريب المصغّر',
      href: 'courses.html',
      icon: 'fa-graduation-cap',
      always: true,
    },
    {
      id: 'plan',
      n: '2',
      stageLabel: 'خطة التشغيل',
      toolLabel: 'خطة تشغيل المشروع',
      href: 'office.html',
      icon: 'fa-clipboard-list',
      always: true,
    },
    {
      id: 'feasibility',
      n: '3',
      stageLabel: 'دراسة الجدوى',
      toolLabel: 'دراسة جدوى مبسطة للمشروع',
      href: 'office.html',
      icon: 'fa-chart-line',
      always: true,
    },
    {
      id: 'resources',
      n: '4',
      stageLabel: 'تخطيط الموارد',
      toolLabel: 'موارد هذا المشروع',
      href: 'systems/erp.html',
      icon: 'fa-boxes-stacked',
      always: true,
    },
    {
      id: 'marketing',
      n: '5',
      stageLabel: 'التسويق',
      toolLabel: 'استوديو الحملات التسويقية للمشروع',
      href: 'ads.html',
      icon: 'fa-bullhorn',
      always: true,
    },
    {
      id: 'customers',
      n: '6',
      stageLabel: 'عملاء المشروع',
      toolLabel: 'العملاء المحتملون لهذا المشروع',
      href: 'systems/crm.html',
      icon: 'fa-users',
      always: true,
    },
    {
      id: 'measure',
      n: '7',
      stageLabel: 'قياس النتائج',
      toolLabel: 'قياس نتائج المشروع',
      href: 'office.html',
      icon: 'fa-gauge-high',
      always: true,
    },
    {
      id: 'improve',
      n: '8',
      stageLabel: 'تحسين المشروع',
      toolLabel: 'تحسين وتشغيل المشروع',
      href: 'office.html',
      icon: 'fa-arrows-rotate',
      always: true,
    },
    {
      id: 'incubator',
      n: '9',
      stageLabel: 'التوسع',
      toolLabel: 'الحاضنة المناسبة',
      href: 'incubators.html',
      icon: 'fa-seedling',
      always: true,
    },
    {
      id: 'sell',
      n: '10',
      stageLabel: 'بيع المنتج',
      toolLabel: 'رفع منتج للمتجر',
      href: 'store.html',
      icon: 'fa-store',
      always: false,
      when: (p) => {
        if (!p) return false;
        if (p.mode === 'رقمي') return true;
        const hay = `${p.title || ''} ${p.categoryName || ''} ${(p.skills || []).join(' ')}`;
        return /منتج|بيع|متجر|تجارة|متجر/.test(hay);
      },
    },
  ];

  const stagesForProject = (p) =>
    OPS_STAGES.filter((s) => s.always || (typeof s.when === 'function' && s.when(p)));

  const stationStatusLabel = (status) => {
    if (status === 'done') return 'مكتملة';
    if (status === 'current') return 'قيد العمل';
    return 'لم تبدأ';
  };
  const CAT_DESC = {
    'low-capital': 'مشاريع تبدأ برأس مال محدود مع إمكانية ربح جيدة عند الاختبار السريع.',
    'low-loss': 'مشاريع يمكن تشغيلها وإدارتها عبر الإنترنت دون موقع فعلي دائم.',
    events: 'أفكار مرتبطة بالمناسبات والأعياد والاحتفالات الموسمية.',
    executable: 'مشاريع عملية يمكن تنفيذها بسرعة بخطوات واضحة.',
    retirees: 'مناسبة لمن لديهم وقت مرن وخبرة حياتية أو مهنية.',
    summer: 'مشاريع تنشط في الصيف أو تعتمد على الموسم الصيفي.',
    experts: 'تتطلب مهارة أو خبرة عملية مسبقة لتحقيق نتائج أفضل.',
    accessible: 'تُختار حسب القدرة والمهارة المتاحة لديك.',
    malls: 'محطات أو أكشاك خفيفة داخل المولات والمواقع التجارية.',
    cart: 'مشاريع متنقلة تُدار من عربة صغيرة أو نقطة بيع خفيفة.',
    emotions: 'مشاريع مرتبطة بالمشاعر الإنسانية والهدايا والتجارب.',
    'home-light': 'مشاريع منزلية خفيفة لا تحتاج تجهيزات ثقيلة.',
    'home-women': 'مشاريع منزلية مناسبة للتشغيل من المنزل بمرونة.',
    winter: 'أفكار يمكن تنشيطها أو تشغيلها خلال فصل الشتاء.',
  };

  let activeType = 'all';
  let pageByCat = {};
  let regStep = 1;
  const REG_STEP_LABELS = [
    '',
    'اختيار المشروع',
    'البيانات الأساسية',
    'الخبرة والتفاصيل',
    'الاحتياجات والمرفقات',
    'المراجعة والإرسال',
  ];

  const PAGE_SIZE = 24;

  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 2600);
  };

  const readOpened = () => {
    try {
      const cur = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (cur.length) return cur;
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
      if (legacy.length) {
        localStorage.setItem(KEY, JSON.stringify(legacy));
        return legacy;
      }
      return [];
    } catch {
      return [];
    }
  };

  const writeOpened = (list) => {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 40)));
  };

  const readRegistrations = () => (regApi?.read ? regApi.read() : []);

  const fileMeta = async (input) => {
    const f = input?.files?.[0];
    if (!f) return null;
    const limits = window.HubUploadLimits;
    const check = limits?.assertFile ? limits.assertFile(f) : { ok: f.size <= 150 * 1024 * 1024 };
    if (!check.ok) throw new Error(check.error || 'حجم الملف أكبر من 150MB');
    let url = '';
    if (limits?.uploadFile) {
      const uploaded = await limits.uploadFile(f);
      url = uploaded.url || '';
    }
    return { name: f.name, size: f.size, type: f.type || '', url };
  };

  const paintSelectedProject = () => {
    if (!selectedBox || !selectedNameEl) return;
    if (!selectedProject) {
      selectedBox.hidden = true;
      selectedNameEl.textContent = '—';
      return;
    }
    selectedBox.hidden = false;
    selectedNameEl.textContent = selectedProject.title;
  };

  const journeyMark = (key, value = true) => {
    try {
      window.HubSideProjectsJourney?.mark?.(key, value);
      window.dispatchEvent(new CustomEvent('hub-sp-journey-changed'));
    } catch (_) {}
  };

  const progressForStatus = (status) => {
    const map = {
      مسودة: 20,
      جديد: 40,
      'قيد المتابعة': 55,
      'يحتاج تعديل': 50,
      'تم التواصل': 70,
      مقبول: 90,
      مرفوض: 100,
      مغلق: 100,
    };
    return map[status] || 10;
  };

  const nextActionFor = (r) => {
    if (r.status === 'مسودة') return { label: 'متابعة المسودة', action: 'resume', id: r.id };
    if (r.status === 'يحتاج تعديل') return { label: 'تعديل وإعادة الإرسال', action: 'revise', id: r.id };
    if (r.status === 'مقبول') return { label: 'اختبر المشروع', action: 'test', id: r.projectId };
    return { label: 'عرض التفاصيل', action: 'details', id: r.id };
  };

  const paintMyProjects = () => {
    if (!myListEl) return;
    const list = readRegistrations();
    if (!list.length) {
      myListEl.innerHTML =
        '<p class="sp-empty">لا مشاريع بعد — اختر فكرة من القائمة ثم اضغط «ابدأ مشروعك».</p>';
      return;
    }
    myListEl.innerHTML = list
      .map((r) => {
        const note = regApi?.latestAdminNote?.(r);
        const next = nextActionFor(r);
        const pct = progressForStatus(r.status);
        return `<article class="sp-my-card" data-id="${esc(r.id)}">
          <div class="sp-my-card__main">
            <div class="sp-my-card__top">
              <h3>${esc(r.projectName)}</h3>
              <span class="sp-status-pill">${esc(r.status || 'جديد')}</span>
            </div>
            <p class="sp-my-meta">رقم الطلب: <strong dir="ltr">${esc(r.id)}</strong></p>
            <p class="sp-my-meta">النوع / القطاع: ${esc(r.categoryName || '—')} · صاحب المشروع: ${esc(r.ownerName || '—')}</p>
            <p class="sp-my-meta">تاريخ الإنشاء: ${esc(new Date(r.createdAt).toLocaleString('en-US'))} · آخر تحديث: ${esc(new Date(r.updatedAt || r.createdAt).toLocaleString('en-US'))}</p>
            <div class="sp-progress"><span style="width:${pct}%"></span></div>
            <small>نسبة التقدم: ${pct}%</small>
            ${
              r.status === 'يحتاج تعديل' && note
                ? `<div class="sp-revise-box"><strong>سبب طلب التعديل:</strong><p>${esc(note.note)}</p></div>`
                : ''
            }
          </div>
          <div class="sp-my-card__actions">
            <button type="button" class="btn btn-primary" data-sp-my-action="${esc(next.action)}" data-sp-my-id="${esc(next.id)}">${esc(next.label)}</button>
          </div>
        </article>`;
      })
      .join('');
  };

  const paintRegistrations = () => {
    if (!regListEl) return;
    const list = readRegistrations().filter((r) => r.status !== 'مسودة');
    paintMyProjects();
    if (!list.length) {
      regListEl.innerHTML =
        '<p class="sp-empty">لا طلبات مُرسلة بعد — أكمل البيانات من «ابدأ مشروعك» ثم أرسل المشروع. الطلبات تصل لصفحة الفريق الداخلية.</p>';
      return;
    }
    regListEl.innerHTML = list
      .slice(0, 8)
      .map(
        (r) => `<article class="sp-reg-card">
          <div class="sp-reg-card-main">
            <h3>${esc(r.projectName)}</h3>
            <small>${esc(r.ownerName)} · ${esc(r.phone || '—')} · ${esc(r.email || '—')}</small>
            <p>${esc(r.country)} · ${esc(r.education)} · خبرة ${esc(String(r.experienceYears))} سنة · حالة: ${esc(r.status || 'جديد')}</p>
            <p class="sp-reg-exp">مجالات: ${esc([r.experience1, r.experience2, r.experience3].filter(Boolean).join(' · ') || '—')}</p>
            <small>رقم الطلب ${esc(r.id)} · تاريخ التسجيل ${esc(new Date(r.createdAt).toLocaleString('en-US'))}</small>
          </div>
          <a class="btn btn-secondary" href="#sp-my-projects">مشاريعي</a>
        </article>`
      )
      .join('');
    if (list.length > 8) {
      regListEl.insertAdjacentHTML(
        'beforeend',
        `<p class="sp-empty"><a href="#sp-my-projects">عرض كل المشاريع (${list.length.toLocaleString('en-US')})</a></p>`
      );
    }
  };

  const setRegStep = (step) => {
    regStep = Math.max(1, Math.min(5, step));
    regForm?.querySelectorAll('[data-sp-reg-step]').forEach((panel) => {
      const n = Number(panel.getAttribute('data-sp-reg-step'));
      const on = n === regStep;
      panel.hidden = !on;
      panel.classList.toggle('is-active', on);
    });
    const label = document.querySelector('[data-sp-reg-step-label]');
    if (label) label.textContent = `الخطوة ${regStep} من 5 — ${REG_STEP_LABELS[regStep] || ''}`;
    const prev = regForm?.querySelector('[data-sp-reg-prev]');
    const next = regForm?.querySelector('[data-sp-reg-next]');
    const submit = regForm?.querySelector('[data-sp-reg-submit]');
    if (prev) prev.hidden = regStep <= 1;
    if (next) next.hidden = regStep >= 5;
    if (submit) submit.hidden = regStep < 5;
    if (regStep === 5) paintRegReview();
  };

  const paintRegReview = () => {
    const box = regForm?.querySelector('[data-sp-reg-review]');
    if (!box || !regForm) return;
    const fd = new FormData(regForm);
    const rows = [
      ['اسم المشروع', fd.get('projectName')],
      ['صاحب المشروع', fd.get('ownerName')],
      ['الجوال', fd.get('phone')],
      ['البريد', fd.get('email')],
      ['التواصل المفضّل', fd.get('preferredContact')],
      ['الدولة', fd.get('country')],
      ['المستوى العلمي', fd.get('education')],
      ['سنوات الخبرة', fd.get('experienceYears')],
      ['مجال الخبرة 1', fd.get('experience1')],
      ['مجال الخبرة 2', fd.get('experience2') || '—'],
      ['مجال الخبرة 3', fd.get('experience3') || '—'],
      ['عمل حالي', fd.get('currentWork') || '—'],
      ['ملاحظات / سجل', fd.get('commercialOrNotes') || '—'],
    ];
    box.innerHTML = `<dl class="sp-reg-review-grid">${rows
      .map(
        ([k, v], i) =>
          `<div><dt>${esc(k)}</dt><dd>${esc(v || '—')}</dd><button type="button" class="btn btn-secondary btn-sm" data-sp-reg-edit-step="${i < 1 ? 1 : i < 5 ? 2 : i < 9 ? 3 : 4}">تعديل</button></div>`
      )
      .join('')}</dl>`;
  };

  const collectRegPayload = async ({ includeFiles = true } = {}) => {
    const fd = new FormData(regForm);
    let fileDoc;
    let fileImage;
    let fileVideo;
    if (includeFiles) {
      [fileDoc, fileImage, fileVideo] = await Promise.all([
        fileMeta(regForm.querySelector('[name="fileDoc"]')),
        fileMeta(regForm.querySelector('[name="fileImage"]')),
        fileMeta(regForm.querySelector('[name="fileVideo"]')),
      ]);
    }
    const cat = data.categories.find((c) => c.id === selectedProject?.categoryId);
    return {
      id: String(fd.get('registrationId') || '').trim() || undefined,
      projectId: String(fd.get('projectId') || selectedProject?.id || ''),
      projectName: String(fd.get('projectName') || '').trim(),
      ownerName: String(fd.get('ownerName') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      preferredContact: String(fd.get('preferredContact') || '').trim(),
      country: String(fd.get('country') || '').trim(),
      education: String(fd.get('education') || '').trim(),
      experienceYears: Number(fd.get('experienceYears') || 0),
      experience1: String(fd.get('experience1') || '').trim(),
      experience2: String(fd.get('experience2') || '').trim(),
      experience3: String(fd.get('experience3') || '').trim(),
      fileDoc,
      fileImage,
      fileVideo,
      currentWork: String(fd.get('currentWork') || '').trim(),
      commercialOrNotes: String(fd.get('commercialOrNotes') || '').trim(),
      categoryId: selectedProject?.categoryId || '',
      categoryName: cat?.nameAr || '',
    };
  };

  const fillRegFromRecord = (r) => {
    if (!regForm || !r) return;
    const set = (name, val) => {
      const el = regForm.querySelector(`[name="${name}"]`);
      if (el && val != null) el.value = val;
    };
    set('registrationId', r.id);
    set('projectId', r.projectId);
    set('projectName', r.projectName);
    set('ownerName', r.ownerName);
    set('phone', r.phone);
    set('email', r.email);
    set('preferredContact', r.preferredContact || 'جوال');
    set('country', r.country);
    set('education', r.education);
    set('experienceYears', r.experienceYears);
    set('experience1', r.experience1);
    set('experience2', r.experience2);
    set('experience3', r.experience3);
    set('currentWork', r.currentWork);
    set('commercialOrNotes', r.commercialOrNotes);
    selectedProject = {
      id: r.projectId,
      title: r.projectName,
      categoryId: r.categoryId,
    };
    paintSelectedProject();
  };

  const showSuccess = (record) => {
    if (!successModal || !successBody || !record) return;
    successBody.innerHTML = `
      <ul class="sp-success-list">
        <li><span>رقم المشروع / الطلب</span><strong dir="ltr">${esc(record.id)}</strong></li>
        <li><span>اسم المشروع</span><strong>${esc(record.projectName)}</strong></li>
        <li><span>تاريخ الإرسال</span><strong>${esc(new Date(record.submittedAt || record.updatedAt || record.createdAt).toLocaleString('en-US'))}</strong></li>
        <li><span>الحالة الحالية</span><strong>${esc(record.status)}</strong></li>
      </ul>`;
    successModal.hidden = false;
    document.body.classList.add('sp-success-open');
  };

  const closeSuccess = () => {
    if (!successModal) return;
    successModal.hidden = true;
    document.body.classList.remove('sp-success-open');
  };

  const closeRegModal = () => {
    if (!regModal) return;
    regModal.hidden = true;
    document.body.classList.remove('sp-reg-open');
  };

  const openRegModal = (project, record = null) => {
    if (!regModal || !regForm) return;
    fillCountries();
    if (record) {
      fillRegFromRecord(record);
    } else if (project) {
      regForm.reset();
      selectedProject = { id: project.id, title: project.title, categoryId: project.categoryId };
      paintSelectedProject();
      const idInput = regForm.querySelector('[data-sp-reg-project-id]');
      const nameInput = regForm.querySelector('[data-sp-reg-project-name]');
      const regId = regForm.querySelector('[data-sp-reg-id]');
      if (idInput) idInput.value = project.id;
      if (nameInput) nameInput.value = project.title;
      if (regId) regId.value = '';
    } else return;
    journeyMark('started', true);
    journeyMark('ideaChosen', true);
    journeyMark('selectedProjectId', selectedProject?.id || true);
    setRegStep(1);
    regModal.hidden = false;
    document.body.classList.add('sp-reg-open');
    regForm.querySelector('[name="projectName"]')?.focus();
  };

  const fillCountries = () => {
    const sel = regForm?.querySelector('[data-sp-reg-country]');
    if (!sel || sel.options.length > 1) return;
    sel.innerHTML =
      `<option value="">— اختر الدولة —</option>` +
      COUNTRIES.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  };

  const validateRegStep = (step) => {
    const panel = regForm?.querySelector(`[data-sp-reg-step="${step}"]`);
    if (!panel) return true;
    const fields = [...panel.querySelectorAll('input, select, textarea')].filter((el) => el.required);
    for (const el of fields) {
      if (!el.checkValidity()) {
        el.reportValidity();
        return false;
      }
    }
    if (step === 2) {
      const phone = String(regForm.querySelector('[name="phone"]')?.value || '').trim();
      const email = String(regForm.querySelector('[name="email"]')?.value || '').trim();
      if (!phone && !email) {
        toast('يرجى إدخال رقم جوال أو بريد إلكتروني.');
        return false;
      }
    }
    return true;
  };

  const saveDraftNow = async () => {
    if (!regApi?.saveDraft) return toast('حفظ المسودة غير متاح');
    try {
      const payload = await collectRegPayload({ includeFiles: true });
      const result = regApi.saveDraft(payload);
      if (!result?.ok) return toast(result?.error || 'تعذّر حفظ المسودة');
      const regId = regForm.querySelector('[data-sp-reg-id]');
      if (regId) regId.value = result.record.id;
      paintRegistrations();
      journeyMark('detailsDone', true);
      toast('تم حفظ المسودة بنجاح.');
    } catch (err) {
      toast(err.message || 'تعذّر حفظ المسودة');
    }
  };

  const submitRegistration = async (e) => {
    e.preventDefault();
    if (!regForm) return;
    if (!regApi?.create) return toast('نظام استقبال التسجيلات غير متاح');
    if (!validateRegStep(1) || !validateRegStep(2) || !validateRegStep(3)) {
      return toast('يرجى إكمال الحقول المطلوبة قبل الإرسال.');
    }
    toast('جاري تجهيز الإرسال...');
    try {
      const payload = await collectRegPayload({ includeFiles: true });
      const existingId = payload.id;
      const existing = existingId ? regApi.get?.(existingId) : null;
      let result;
      if (existing && (existing.status === 'يحتاج تعديل' || existing.status === 'مسودة')) {
        result = regApi.resubmit(existingId, payload);
      } else if (existingId && existing) {
        result = regApi.update(existingId, { ...payload, status: 'جديد' });
      } else {
        result = regApi.create({ ...payload, status: 'جديد' });
      }
      if (!result?.ok) return toast(result?.error || 'تعذّر إرسال المشروع');
      paintRegistrations();
      closeRegModal();
      journeyMark('detailsDone', true);
      showSuccess(result.record);
      toast('تم إرسال المشروع للمراجعة.');
      document.getElementById('sp-my-projects')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      toast(err.message || 'تعذّر إرسال المشروع');
    }
  };

  const countByCat = (() => {
    const map = {};
    data.categories.forEach((c) => {
      map[c.id] = 0;
    });
    data.projects.forEach((p) => {
      map[p.categoryId] = (map[p.categoryId] || 0) + 1;
    });
    return map;
  })();

  const typeOf = (id) => TYPE_GROUPS.find((t) => t.id === id) || TYPE_GROUPS[0];

  const catsForType = (typeId) => {
    const t = typeOf(typeId);
    if (!t.categoryIds) return data.categories.slice();
    const set = new Set(t.categoryIds);
    return data.categories.filter((c) => set.has(c.id));
  };

  const enrich = (p) => {
    const cat = data.categories.find((c) => c.id === p.categoryId);
    let riskLevel = 'متوسط';
    if (p.categoryId === 'low-loss' || p.capital === 'منخفض جدًا') riskLevel = 'منخفض';
    else if (p.difficulty === 'متقدم' || p.capital === 'مرتفع') riskLevel = 'مرتفع';
    else if (/منافسة|موسم|موقع/.test(p.risks || '')) riskLevel = 'متوسط–مرتفع';

    let season = 'على مدار السنة';
    if (p.categoryId === 'summer') season = 'صيفي';
    else if (p.categoryId === 'winter') season = 'شتوي';
    else if (p.categoryId === 'events' || p.categoryId === 'emotions') season = 'مناسبات وأعياد';

    let locationFit = 'مرن';
    if (p.homeOk && p.mode === 'رقمي') locationFit = 'منزل / عن بُعد';
    else if (p.categoryId === 'malls') locationFit = 'مول / موقع تجاري';
    else if (p.categoryId === 'cart') locationFit = 'متنقل';
    else if (p.mode === 'ميداني') locationFit = 'مدينة / ميداني';

    const revenueModel =
      p.mode === 'رقمي' ? 'خدمة / منتج رقمي متكرر' : p.mode === 'ميداني' ? 'مبيعات ميدانية / محطة' : 'مختلط (رقمي + ميداني)';

    const training =
      p.difficulty === 'سهل'
        ? 'تدريب مصغر ١–٣ أيام (تعلّم تكيّفي مختصر)'
        : p.difficulty === 'متوسط'
          ? 'مسار تعلّم قصير ١–٢ أسبوع'
          : 'تأهيل عملي مكثف + مرافقة';

    const startup = [
      `رأس مال: ${p.capital}`,
      p.licenses || 'مراجعة التراخيص المحلية',
      p.expenses || 'مصاريف تشغيل أولية',
    ].join(' · ');

    const pricing = `سعّر التجربة الأولى ضمن نطاق: ${p.revenue || 'حسب السوق'} — ابدأ بعرض صغير قابل للقياس`;
    const suppliers =
      p.mode === 'رقمي'
        ? 'أدوات رقمية · قوالب · منصات نشر · اشتراكات برمجية'
        : 'موردو مواد أولية · تغليف · لوجستيات خفيفة · تفاوض عبر نظام الموارد';
    const scale =
      p.categoryId === 'low-capital' || p.mode === 'رقمي'
        ? 'عالية — قابل للتوسع عبر الحاضنة والمنصات'
        : 'متوسطة — اختبر محليًا ثم وسّع';

    return {
      ...p,
      categoryName: cat?.nameAr || '',
      riskLevel,
      season,
      locationFit,
      revenueModel,
      training,
      startup,
      pricing,
      suppliers,
      scale,
      projectType: p.mode,
    };
  };

  const fieldHtml = (f) => {
    if (f.type === 'select') {
      return `<label class="sp-field">${esc(f.label)}
        <select name="${esc(f.id)}" required>
          <option value="">— اختر —</option>
          ${(f.options || []).map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
        </select>
      </label>`;
    }
    return `<label class="sp-field grow">${esc(f.label)}
      <input name="${esc(f.id)}" type="text" placeholder="${esc(f.placeholder || '')}" required />
    </label>`;
  };

  const paintPath = () => {
    if (!pathEl) return;
    pathEl.innerHTML = ENGINE_PATH.map((s) => {
      const inner = `<span class="sp-path-ico"><i class="fas ${s.icon}"></i></span><span>${esc(s.label)}</span>`;
      return `<li>${s.href ? `<a href="${esc(s.href)}">${inner}</a>` : inner}</li>`;
    }).join('');
  };

  const paintForm = () => {
    if (!formEl) return;
    formEl.innerHTML = `<div class="sp-form-grid">${(data.formFields || []).map(fieldHtml).join('')}</div>`;
  };

  const paintStats = () => {
    if (!statsEl) return;
    const special = typeOf('special').categoryIds.reduce((n, id) => n + (countByCat[id] || 0), 0);
    const light = typeOf('light').categoryIds.reduce((n, id) => n + (countByCat[id] || 0), 0);
    const home = typeOf('home').categoryIds.reduce((n, id) => n + (countByCat[id] || 0), 0);
    statsEl.innerHTML = `
      <article><strong>${data.projects.length.toLocaleString('en-US')}</strong><span>مشروع في القوائم</span></article>
      <article><strong>${special.toLocaleString('en-US')}</strong><span>خاصة</span></article>
      <article><strong>${light.toLocaleString('en-US')}</strong><span>خفيفة</span></article>
      <article><strong>${home.toLocaleString('en-US')}</strong><span>منزلية</span></article>`;
  };

  const scoreProject = (raw, answers) => {
    const p = enrich(raw);
    let score = 35;
    const reasons = [];

    if (answers.mode === 'مختلط' || p.mode === 'مختلط' || p.mode === answers.mode) {
      score += 18;
      reasons.push(`نوع ${p.mode}`);
    } else if ((answers.mode === 'رقمي' && p.homeOk) || (answers.mode === 'ميداني' && p.mode !== 'رقمي')) {
      score += 8;
    }

    const capOrder = { 'منخفض جدًا': 1, منخفض: 2, متوسط: 3, مرتفع: 4 };
    const need = capOrder[p.capital] || 2;
    const have = capOrder[answers.capital] || 2;
    if (have >= need) {
      score += 16;
      reasons.push(`رأس مال ${p.capital}`);
    } else if (have + 1 >= need) score += 7;
    else score -= 8;

    if (answers.home === 'نعم' && p.homeOk) {
      score += 10;
      reasons.push('يناسب المنزل');
    } else if (answers.home === 'مرن') score += 5;
    else if (answers.home === 'لا' && p.mode !== 'رقمي') score += 6;

    if (answers.location) {
      const loc = answers.location;
      if (loc.includes('منزل') && p.homeOk) {
        score += 10;
        reasons.push('موقع منزلي');
      } else if (loc.includes('مول') && p.categoryId === 'malls') {
        score += 14;
        reasons.push('يناسب المولات');
      } else if (loc.includes('متنقل') && p.categoryId === 'cart') {
        score += 14;
        reasons.push('يناسب العربات');
      } else if (loc.includes('رقمي') && (p.mode === 'رقمي' || p.homeOk)) {
        score += 10;
        reasons.push('موقع رقمي');
      } else if (loc.includes('مدينة') && p.mode !== 'رقمي') {
        score += 8;
        reasons.push('موقع ميداني');
      }
    }

    if (answers.season && answers.season !== 'على مدار السنة') {
      if (
        (answers.season === 'صيفي' && p.categoryId === 'summer') ||
        (answers.season === 'شتوي' && p.categoryId === 'winter') ||
        (answers.season.includes('مناسبات') && (p.categoryId === 'events' || p.categoryId === 'emotions'))
      ) {
        score += 12;
        reasons.push(`موسم ${p.season}`);
      }
    } else if (answers.season === 'على مدار السنة' && !['summer', 'winter'].includes(p.categoryId)) {
      score += 4;
    }

    if (answers.age === '٥١+' && (p.categoryId === 'retirees' || p.difficulty === 'سهل')) {
      score += 8;
      reasons.push('يناسب خبرة عمرية');
    } else if (answers.age === 'أقل من ٢٥' && p.mode === 'رقمي') score += 4;

    const expMap = { مبتدئ: 'سهل', متوسط: 'متوسط', خبير: 'متقدم' };
    if (expMap[answers.experience] === p.difficulty) {
      score += 10;
      reasons.push(`صعوبة ${p.difficulty}`);
    } else if (answers.experience === 'خبير') score += 5;
    else if (answers.experience === 'مبتدئ' && p.difficulty === 'سهل') score += 8;
    else if (answers.experience === 'مبتدئ' && p.difficulty === 'متقدم') score -= 6;

    const skills = String(answers.skills || '').toLowerCase();
    if (skills) {
      const hay = `${p.title} ${(p.skills || []).join(' ')} ${p.section} ${p.categoryName}`.toLowerCase();
      const tokens = skills.split(/[\s,،/+]+/).filter((t) => t.length > 2);
      const hits = tokens.filter((t) => hay.includes(t));
      if (hits.length) {
        score += Math.min(16, hits.length * 5);
        reasons.push(`مهارات: ${hits.slice(0, 3).join(' · ')}`);
      }
    }

    if (answers.income && /أكثر|١٠٠٠٠|10000/.test(answers.income) && /١٥٠٠٠|8000|١٠٠٠٠/.test(p.revenue || '')) {
      score += 5;
    }
    if (answers.hours && /٢٠\+|20\+/.test(answers.hours) && p.mode === 'ميداني') score += 3;
    if (answers.hours && /١–٥|1-5/.test(answers.hours) && p.mode === 'رقمي') score += 4;

    if (p.riskLevel === 'منخفض') {
      score += 4;
      reasons.push('مخاطرة منخفضة');
    }

    reasons.push(`مخاطر: ${p.riskLevel}`);
    return { score: Math.max(5, Math.min(99, Math.round(score))), reasons: reasons.slice(0, 5), p };
  };

  const detailRows = (p) => `
    <div class="sp-disclaimer">فرصة محتملة — ليست ضمان ربح. اختبر على نطاق صغير أولًا.</div>
    <div class="sp-detail-grid">
      <div><span>القائمة</span><strong>${esc(p.categoryName)}</strong></div>
      <div><span>نوع المشروع</span><strong>${esc(p.projectType)}</strong></div>
      <div><span>رأس المال</span><strong>${esc(p.capital)}</strong></div>
      <div><span>المهارات</span><strong>${esc((p.skills || []).join(' · '))}</strong></div>
      <div><span>الوقت</span><strong>${esc(p.hoursHint)}</strong></div>
      <div><span>الموقع المناسب</span><strong>${esc(p.locationFit)}</strong></div>
      <div><span>الموسم</span><strong>${esc(p.season)}</strong></div>
      <div><span>مستوى المخاطرة</span><strong class="sp-risk sp-risk-${p.riskLevel === 'منخفض' ? 'low' : p.riskLevel === 'مرتفع' ? 'high' : 'mid'}">${esc(p.riskLevel)}</strong></div>
      <div><span>نموذج الإيراد</span><strong>${esc(p.revenueModel)}</strong></div>
      <div><span>متطلبات التشغيل</span><strong>${esc(p.startup)}</strong></div>
      <div><span>التدريب المطلوب</span><strong>${esc(p.training)}</strong></div>
      <div><span>التسويق</span><strong>${esc((p.marketing || []).join(' · '))}</strong></div>
      <div><span>قابلية التوسع</span><strong>${esc(p.scale)}</strong></div>
      <div><span>إيراد تقديري ($)</span><strong>${esc(p.revenue)}</strong></div>
      <div><span>المصاريف</span><strong>${esc(p.expenses)}</strong></div>
      <div><span>التراخيص</span><strong>${esc(p.licenses)}</strong></div>
    </div>
    <div class="sp-plan">
      <strong>تقدير متطلبات البداية</strong>
      <p>${esc(p.startup)}</p>
      <strong>التسعير المقترح للاختبار</strong>
      <p>${esc(p.pricing)}</p>
      <strong>الموردون</strong>
      <p>${esc(p.suppliers)}</p>
      <strong>خطة بدء 30 يومًا</strong>
      <ol>${(p.plan30 || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <strong>أدوات مساعدة</strong>
      <p>${esc(p.aiTools)}</p>
    </div>`;

  const projectCard = (raw, opts = {}) => {
    const p = opts.p || enrich(raw);
    const score = opts.score != null ? `<span class="sp-score">${opts.score}%</span>` : '';
    const reasons = opts.reasons?.length
      ? `<p class="sp-reasons">${opts.reasons.map(esc).join(' · ')}</p>`
      : '';
    const compact = opts.compact !== false && opts.score == null;
    return `<article class="sp-card${compact ? ' is-compact' : ''}" data-id="${esc(p.id)}">
      <div class="sp-card-top">
        <button type="button" class="sp-card-icon sp-card-icon-btn" data-sp-register="${esc(p.id)}" title="ابدأ مشروعك" aria-label="ابدأ مشروعك ${esc(p.title)}">
          <i class="fas ${esc(
            data.categories.find((c) => c.id === p.categoryId)?.icon || 'fa-lightbulb'
          )}"></i>
        </button>
        <div>
          <h3>
            <button type="button" class="sp-card-title-btn" data-sp-register="${esc(p.id)}" title="ابدأ مشروعك">
              ${esc(p.title)}
            </button>
          </h3>
          <small>${esc(p.categoryName)}${p.section ? ` · ${esc(p.section)}` : ''}</small>
        </div>
        ${score}
      </div>
      <div class="sp-badges">
        <span>${esc(p.mode)}</span>
        <span>${esc(p.capital)}</span>
        <span>مخاطر ${esc(p.riskLevel)}</span>
        <span>${esc(p.season)}</span>
      </div>
      ${reasons}
      ${compact ? '' : detailRows(p)}
      <div class="sp-card-actions">
        ${compact ? `<button type="button" class="btn btn-secondary" data-sp-expand="${esc(p.id)}"><i class="fas fa-chevron-down"></i> التفاصيل</button>` : ''}
        <button type="button" class="btn btn-primary" data-sp-register="${esc(p.id)}"><i class="fas fa-play"></i> ابدأ مشروعك</button>
        <button type="button" class="btn btn-secondary" data-sp-open="${esc(p.id)}"><i class="fas fa-flask"></i> اختبر المشروع</button>
      </div>
      ${compact ? `<div class="sp-card-details" hidden>${detailRows(p)}</div>` : ''}
    </article>`;
  };

  const match = () => {
    if (formEl && !formEl.checkValidity()) {
      formEl.reportValidity();
      return toast('أكمل بيانات ملفك');
    }
    const answers = Object.fromEntries(new FormData(formEl).entries());
    const ranked = data.projects
      .map((raw) => scoreProject(raw, answers))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    if (resultsPanel) resultsPanel.hidden = false;
    if (resultsLead) {
      resultsLead.textContent = `تحليل ملفك (${answers.age || ''} · ${answers.location || ''} · رأس مال ${answers.capital} · ${answers.season || ''}) — أعلى 10 فرص محتملة للاختبار.`;
    }
    if (resultsGrid) {
      resultsGrid.innerHTML = ranked.map((r) => projectCard(r.p, { score: r.score, reasons: r.reasons, p: r.p, compact: false })).join('');
    }
    resultsPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('تم اقتراح 10 مشاريع مناسبة');
  };

  const filteredProjects = () => {
    const q = (searchEl?.value || '').trim().toLowerCase();
    const cat = catFilter?.value || '';
    const capital = capitalFilter?.value || '';
    const mode = modeFilter?.value || '';
    const allowed = new Set(catsForType(activeType).map((c) => c.id));
    let list = data.projects.filter((p) => allowed.has(p.categoryId));
    if (cat) list = list.filter((p) => p.categoryId === cat);
    if (capital) list = list.filter((p) => p.capital === capital);
    if (mode) list = list.filter((p) => p.mode === mode);
    if (q) {
      list = list.filter((p) => {
        const hay = `${p.title} ${p.section} ${(p.skills || []).join(' ')} ${p.customers || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  };

  const paintTypeTabs = () => {
    if (!typeTabs) return;
    typeTabs.innerHTML = TYPE_GROUPS.map((t) => {
      const count =
        t.id === 'all'
          ? data.projects.length
          : t.categoryIds.reduce((n, id) => n + (countByCat[id] || 0), 0);
      return `<button type="button" class="sp-type-tab${activeType === t.id ? ' is-active' : ''}" data-sp-type="${esc(t.id)}" role="tab" aria-selected="${activeType === t.id}">
        <i class="fas ${esc(t.icon)}" aria-hidden="true"></i>
        <strong>${esc(t.nameAr)}</strong>
        <span>${count.toLocaleString('en-US')}</span>
      </button>`;
    }).join('');
  };

  const paintCatDir = () => {
    if (!catDir) return;
    const cats = catsForType(activeType);
    const activeId = catFilter?.value || '';
    if (catHint) {
      if (activeId && CAT_DESC[activeId]) {
        const cat = data.categories.find((c) => c.id === activeId);
        catHint.hidden = false;
        catHint.innerHTML = `<strong>${esc(cat?.nameAr || '')}</strong><p>${esc(CAT_DESC[activeId])}</p>`;
      } else {
        catHint.hidden = true;
        catHint.innerHTML = '';
      }
    }
    catDir.innerHTML = cats
      .map((c) => {
        const n = countByCat[c.id] || 0;
        const active = activeId === c.id ? ' is-active' : '';
        const desc = CAT_DESC[c.id] ? `<em>${esc(CAT_DESC[c.id])}</em>` : '';
        return `<button type="button" class="sp-cat-card${active}" data-sp-chip="${esc(c.id)}">
          <span class="sp-cat-card-icon"><i class="fas ${esc(c.icon)}"></i></span>
          <span class="sp-cat-card-copy">
            <strong>${esc(c.nameAr)}</strong>
            <small>${n.toLocaleString('en-US')} مشروع</small>
            ${desc}
          </span>
        </button>`;
      })
      .join('');
  };

  const paintCatFilter = () => {
    if (!catFilter) return;
    const cats = catsForType(activeType);
    const prev = catFilter.value;
    catFilter.innerHTML =
      `<option value="">كل القوائم في النوع</option>` +
      cats.map((c) => `<option value="${esc(c.id)}">${esc(c.nameAr)} (${(countByCat[c.id] || 0).toLocaleString('en-US')})</option>`).join('');
    if (prev && cats.some((c) => c.id === prev)) catFilter.value = prev;
    else catFilter.value = '';
  };

  const paintCatalog = () => {
    const list = filteredProjects();
    const typeName = typeOf(activeType).nameAr;
    const catId = catFilter?.value || '';
    const catName = data.categories.find((c) => c.id === catId)?.nameAr;

    if (catalogLead) {
      catalogLead.textContent = catName
        ? `عرض قائمة «${catName}» — ${list.length.toLocaleString('en-US')} مشروع`
        : `عرض نوع «${typeName}» — ${list.length.toLocaleString('en-US')} مشروع · اضغط قائمة أعلاه للتصفية`;
    }

    if (!catalogGrid) return;
    if (!list.length) {
      catalogGrid.innerHTML = '<p class="sp-empty">لا مشاريع مطابقة — جرّب نوعًا أو بحثًا آخر.</p>';
      return;
    }

    const byCat = {};
    list.forEach((p) => {
      if (!byCat[p.categoryId]) byCat[p.categoryId] = [];
      byCat[p.categoryId].push(p);
    });

    const order = catsForType(activeType).map((c) => c.id);
    catalogGrid.innerHTML = order
      .filter((id) => byCat[id]?.length)
      .map((id) => {
        const cat = data.categories.find((c) => c.id === id);
        const all = byCat[id];
        const page = pageByCat[id] || 1;
        const shown = all.slice(0, page * PAGE_SIZE);
        const more = all.length - shown.length;
        return `<section class="sp-cat-group" data-cat-group="${esc(id)}">
          <header class="sp-cat-group-head">
            <h3><i class="fas ${esc(cat?.icon || 'fa-folder')}"></i> ${esc(cat?.nameAr || id)}</h3>
            <span>${all.length.toLocaleString('en-US')} مشروع</span>
          </header>
          <div class="sp-catalog-grid">
            ${shown.map((p) => projectCard(p)).join('')}
          </div>
          ${
            more > 0
              ? `<button type="button" class="btn btn-secondary sp-load-more" data-sp-more="${esc(id)}">عرض المزيد (${more.toLocaleString('en-US')})</button>`
              : ''
          }
        </section>`;
      })
      .join('');
  };

  const setType = (typeId, { resetCat = true } = {}) => {
    activeType = typeId || 'all';
    pageByCat = {};
    if (resetCat && catFilter) catFilter.value = '';
    paintTypeTabs();
    paintCatFilter();
    paintCatDir();
    paintCatalog();
  };

  const projectCtxPayload = (item, p) => {
    const cat = data.categories.find((c) => c.id === (p?.categoryId || item.categoryId));
    return {
      id: item.id || p?.id,
      title: item.title || p?.title || 'مشروع جانبي',
      categoryId: p?.categoryId || item.categoryId || '',
      categoryName: cat?.nameAr || p?.categoryName || '',
      mode: p?.mode || '',
    };
  };

  const openStageForProject = (item, p, stage) => {
    const ctxApi = window.HubSpProjectContext;
    const project = projectCtxPayload(item, p);
    if (!ctxApi?.openStation) {
      toast('تعذر فتح المرحلة — حدّث الصفحة وحاول مجددًا.');
      return;
    }
    if (!stage?.href) {
      toast('هذه الوظيفة غير متاحة لهذا المشروع حاليًا.');
      return;
    }
    ctxApi.openStation(stage.href, project, {
      stageId: stage.id,
      stage: stage.id,
      stageLabel: stage.stageLabel,
      tool: stage.toolLabel,
      label: stage.stageLabel,
    });
  };

  const paintOpened = () => {
    const list = readOpened();
    if (!openedEl) return;
    if (!list.length) {
      openedEl.innerHTML =
        '<p class="sp-empty">لا مشاريع قيد الاختبار بعد — تصفّح القوائم أو اقترح حسب ملفك ثم اضغط «اختبر المشروع».</p>';
      return;
    }
    const ctxApi = window.HubSpProjectContext;
    openedEl.innerHTML = list
      .map((item) => {
        const raw = data.projects.find((x) => x.id === item.id);
        const p = raw ? enrich(raw) : { id: item.id, title: item.title, categoryId: item.categoryId };
        const stages = stagesForProject(p);
        const stations = stages
          .map((s) => {
            const st = ctxApi?.getStationStatus?.(item.id, s.id) || 'todo';
            return `<button type="button" class="sp-station is-${esc(st)}" data-sp-stage="${esc(s.id)}" data-sp-project="${esc(item.id)}" title="${esc(s.toolLabel)}">
              <span class="sp-station__n">${esc(s.n)}</span>
              <i class="fas ${esc(s.icon)}" aria-hidden="true"></i>
              <strong>${esc(s.stageLabel)}</strong>
              <small>${esc(s.toolLabel)}</small>
              <em>${esc(stationStatusLabel(st))}</em>
            </button>`;
          })
          .join('');
        return `<article class="sp-opened-card" id="sp-opened-${esc(item.id)}" data-opened-id="${esc(item.id)}">
          <div class="sp-opened-main">
            <div class="sp-opened-head">
              <div>
                <h3>${esc(item.title || p?.title || 'مشروع')}</h3>
                <small>رقم المشروع: <b dir="ltr">${esc(item.id)}</b> · بدأ الاختبار ${esc(new Date(item.openedAt).toLocaleString('en-US'))}</small>
              </div>
              <button type="button" class="btn btn-secondary" data-sp-remove="${esc(item.id)}">إزالة من الاختبار</button>
            </div>
            <p class="sp-opened-lead">رحلة تشغيل هذا المشروع — كل محطة تفتح الأداة الصحيحة مع سياق المشروع، ثم يمكنك العودة إليه.</p>
            <div class="sp-stations" role="list">${stations}</div>
          </div>
          <div class="sp-card-actions sp-opened-shortcuts">
            <button type="button" class="btn btn-primary" data-sp-stage="learn" data-sp-project="${esc(item.id)}"><i class="fas fa-graduation-cap"></i> تدريب</button>
            <button type="button" class="btn btn-secondary" data-sp-stage="marketing" data-sp-project="${esc(item.id)}"><i class="fas fa-bullhorn"></i> تسويق</button>
            <button type="button" class="btn btn-secondary" data-sp-stage="customers" data-sp-project="${esc(item.id)}"><i class="fas fa-users"></i> عملاء المشروع</button>
            <button type="button" class="btn btn-secondary" data-sp-stage="resources" data-sp-project="${esc(item.id)}"><i class="fas fa-boxes-stacked"></i> موارد المشروع</button>
            <button type="button" class="btn btn-secondary" data-sp-stage="incubator" data-sp-project="${esc(item.id)}"><i class="fas fa-seedling"></i> الحاضنة</button>
          </div>
        </article>`;
      })
      .join('');

    // Deep-link focus: #sp-opened-<id>
    const hash = (location.hash || '').replace(/^#/, '');
    if (hash.startsWith('sp-opened-')) {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const openProject = (id) => {
    const p = data.projects.find((x) => x.id === id);
    if (!p) return toast('المشروع غير موجود');
    const list = readOpened().filter((x) => x.id !== id);
    list.unshift({
      id: p.id,
      title: p.title,
      categoryId: p.categoryId,
      openedAt: new Date().toISOString(),
    });
    writeOpened(list);
    paintOpened();
    paintStats();
    toast(`تم فتح المشروع للاختبار: ${p.title}`);
    try {
      history.replaceState(null, '', `#sp-opened-${encodeURIComponent(p.id)}`);
    } catch (_) {}
    document.getElementById(`sp-opened-${p.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const introRoot = root.querySelector('[data-sp-intro]');
  const introForm = root.querySelector('[data-sp-intake]');
  const introResults = root.querySelector('[data-sp-intro-results]');
  const introResultsGrid = root.querySelector('[data-sp-intro-results-grid]');
  const introResultsLead = root.querySelector('[data-sp-intro-results-lead]');
  const INTRO_KEY = 'naiosh_sp_client_intro_v1';

  const setIntroStep = (step) => {
    introRoot?.querySelectorAll('[data-sp-intro-step]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-sp-intro-step') === step);
    });
  };

  const readIntroDraft = () => {
    try {
      return JSON.parse(localStorage.getItem(INTRO_KEY) || '{}') || {};
    } catch {
      return {};
    }
  };

  const writeIntroDraft = (payload) => {
    try {
      localStorage.setItem(INTRO_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  };

  const fillIntroDraft = () => {
    if (!introForm) return;
    const draft = readIntroDraft();
    if (draft.project) introForm.project.value = draft.project;
    if (draft.role) introForm.role.value = draft.role;
    if (draft.need) introForm.need.value = draft.need;
  };

  const introAnswersFromForm = () => {
    const fd = new FormData(introForm);
    const project = String(fd.get('project') || '').trim();
    const role = String(fd.get('role') || '').trim();
    const need = String(fd.get('need') || '').trim();
    return {
      project,
      role,
      need,
      skills: [project, role, need].filter(Boolean).join(' · '),
      mode: /رقمي|اونلاين|أونلاين|online/i.test(`${project} ${need}`)
        ? 'رقمي'
        : /ميدان|محل|مول|عربة|منزلي|منزل/i.test(`${project} ${need}`)
          ? 'ميداني'
          : 'مختلط',
      capital: /بدون رأس|منخفض|رخيص|صفر/i.test(need) ? 'منخفض' : 'متوسط',
      home: /منزل|بيتي|من البيت/i.test(`${project} ${need}`) ? 'نعم' : 'مرن',
      experience: /مبتدئ/i.test(role) ? 'مبتدئ' : /خبير|محترف/i.test(role) ? 'خبير' : 'متوسط',
      location: /مول/i.test(`${project} ${need}`)
        ? 'مول / موقع تجاري'
        : /منزل|بيت/i.test(`${project} ${need}`)
          ? 'منزل'
          : /رقمي|اونلاين|أونلاين|online/i.test(`${project} ${need}`)
            ? 'عن بُعد / رقمي'
            : 'مدينة / حي',
      season: 'على مدار السنة',
      age: '٢٥–٣٥',
      hours: '٥–١٠',
      income: '٢٠٠٠–٥٠٠٠',
    };
  };

  const showIntroMatches = (answers, ranked) => {
    if (introResults) introResults.hidden = false;
    if (introResultsLead) {
      introResultsLead.textContent = `حسب تحديك «${answers.project}» ودورك «${answers.role}» واحتياجك «${answers.need}» — أعلى فرص للاختبار الآن.`;
    }
    if (introResultsGrid) {
      introResultsGrid.innerHTML = ranked
        .map((r) => projectCard(r.p, { score: r.score, reasons: r.reasons, p: r.p, compact: true }))
        .join('');
    }
    if (resultsPanel) resultsPanel.hidden = false;
    if (resultsLead) {
      resultsLead.textContent = `من تعريف العميل: ${answers.project} · ${answers.role} — أعلى 10 فرص.`;
    }
    if (resultsGrid) {
      resultsGrid.innerHTML = ranked.map((r) => projectCard(r.p, { score: r.score, reasons: r.reasons, p: r.p, compact: false })).join('');
    }
    // Prefill detailed profile form when present
    if (formEl) {
      const map = {
        skills: answers.skills,
        mode: answers.mode,
        capital: answers.capital,
        home: answers.home,
        experience: answers.experience,
        location: answers.location,
      };
      Object.entries(map).forEach(([name, value]) => {
        const el = formEl.elements?.namedItem?.(name);
        if (el && 'value' in el) el.value = value;
      });
    }
  };

  const runIntroMatch = ({ scrollToResults = true } = {}) => {
    if (!introForm) return;
    if (!introForm.checkValidity()) {
      introForm.reportValidity();
      setIntroStep('match');
      return toast('أكمل مشروعك ودورك وما تحتاجه من نايوش');
    }
    const answers = introAnswersFromForm();
    writeIntroDraft({ project: answers.project, role: answers.role, need: answers.need, at: Date.now() });
    const ranked = data.projects
      .map((raw) => scoreProject(raw, answers))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    setIntroStep('match');
    showIntroMatches(answers, ranked);
    if (scrollToResults) {
      introResults?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    toast('تم تقييم تحديك واقتراح فرص مناسبة');
  };

  const runIntroUnderstand = () => {
    setIntroStep('understand');
    setType('all');
    if (catFilter) catFilter.value = '';
    pageByCat = {};
    paintCatDir();
    paintCatalog();

    const samples = data.projects.slice(0, 6).map((raw) => {
      const p = enrich(raw);
      return { score: null, reasons: ['خلاصة سريعة'], p };
    });
    if (introResults) introResults.hidden = false;
    if (introResultsLead) {
      introResultsLead.textContent =
        'ملخصات مركّزة من القوائم — اضغط التفاصيل أو سجّل المشروع، أو أكمل النموذج أعلاه لترشيح أدق.';
    }
    if (introResultsGrid) {
      introResultsGrid.innerHTML = samples
        .map((r) => projectCard(r.p, { score: r.score, reasons: r.reasons, p: r.p, compact: true }))
        .join('');
    }
    introResults?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('ملخصات سريعة جاهزة — بدون قراءة طويلة');
  };

  const runIntroAct = () => {
    setIntroStep('act');
    const draft = readIntroDraft();
    if (draft.project && introForm && !introForm.project.value) {
      introForm.project.value = draft.project || '';
      introForm.role.value = draft.role || '';
      introForm.need.value = draft.need || '';
    }
    if (selectedProject) {
      document.getElementById('sp-path')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('مسار التشغيل جاهز — سجّل المشروع أو ابدأ الاختبار');
      return;
    }
    if (introResults && !introResults.hidden) {
      document.getElementById('sp-path')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('اختر مشروعًا من النتائج ثم سجّله للخطوة العملية');
      return;
    }
    if (introForm?.checkValidity()) {
      runIntroMatch({ scrollToResults: true });
      setTimeout(() => {
        document.getElementById('sp-path')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);
      return;
    }
    introForm?.project?.focus();
    toast('اكتب تحديك أولًا لنحوّله إلى خطوة عملية');
  };

  const focusClientIntro = () => {
    const hash = (location.hash || '').replace(/^#/, '');
    if (hash && hash !== 'sp-client-intro') return;
    const intro = document.getElementById('sp-client-intro');
    if (!intro) return;
    requestAnimationFrame(() => {
      intro.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  paintPath();
  paintForm();
  paintStats();
  setType('all');
  paintOpened();
  fillCountries();
  paintRegistrations();
  paintSelectedProject();
  fillIntroDraft();
  focusClientIntro();

  introForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    runIntroMatch();
  });
  introRoot?.addEventListener('click', (e) => {
    const stepBtn = e.target.closest('[data-sp-intro-step]');
    if (!stepBtn) return;
    const step = stepBtn.getAttribute('data-sp-intro-step');
    if (step === 'understand') runIntroUnderstand();
    else if (step === 'match') runIntroMatch();
    else if (step === 'act') runIntroAct();
  });

  root.querySelector('[data-sp-match]')?.addEventListener('click', match);
  root.querySelector('[data-sp-reset]')?.addEventListener('click', () => {
    formEl?.reset();
    if (resultsPanel) resultsPanel.hidden = true;
  });
  searchEl?.addEventListener('input', () => {
    pageByCat = {};
    paintCatalog();
  });
  catFilter?.addEventListener('change', () => {
    pageByCat = {};
    paintCatDir();
    paintCatalog();
  });
  capitalFilter?.addEventListener('change', () => {
    pageByCat = {};
    paintCatalog();
  });
  modeFilter?.addEventListener('change', () => {
    pageByCat = {};
    paintCatalog();
  });
  typeTabs?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sp-type]');
    if (!btn) return;
    setType(btn.getAttribute('data-sp-type') || 'all');
    journeyMark('typeChosen', true);
  });
  catDir?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sp-chip]');
    if (!btn || !catFilter) return;
    const id = btn.getAttribute('data-sp-chip') || '';
    catFilter.value = catFilter.value === id ? '' : id;
    pageByCat = {};
    paintCatDir();
    paintCatalog();
    journeyMark('typeChosen', true);
    document.getElementById('sp-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  regForm?.addEventListener('submit', submitRegistration);
  regForm?.querySelector('[data-sp-reg-next]')?.addEventListener('click', () => {
    if (!validateRegStep(regStep)) return toast('يرجى إكمال الحقول المطلوبة في هذه الخطوة.');
    setRegStep(regStep + 1);
  });
  regForm?.querySelector('[data-sp-reg-prev]')?.addEventListener('click', () => setRegStep(regStep - 1));
  regForm?.querySelector('[data-sp-reg-draft]')?.addEventListener('click', () => saveDraftNow());
  regForm?.addEventListener('click', (e) => {
    const edit = e.target.closest('[data-sp-reg-edit-step]');
    if (!edit) return;
    setRegStep(Number(edit.getAttribute('data-sp-reg-edit-step') || 1));
  });
  document.querySelectorAll('[data-sp-reg-close]').forEach((el) => {
    el.addEventListener('click', closeRegModal);
  });
  document.querySelectorAll('[data-sp-success-close]').forEach((el) => {
    el.addEventListener('click', closeSuccess);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && regModal && !regModal.hidden) closeRegModal();
    if (e.key === 'Escape' && successModal && !successModal.hidden) closeSuccess();
  });
  root.querySelector('[data-sp-open-reg-selected]')?.addEventListener('click', () => {
    if (!selectedProject) return toast('اختر مشروعاً أولاً من القائمة');
    const p = data.projects.find((x) => x.id === selectedProject.id) || selectedProject;
    openRegModal(p);
  });
  root.addEventListener('click', (e) => {
    const stageBtn = e.target.closest('[data-sp-stage][data-sp-project]');
    if (stageBtn) {
      const projectId = stageBtn.getAttribute('data-sp-project');
      const stageId = stageBtn.getAttribute('data-sp-stage');
      const item = readOpened().find((x) => x.id === projectId) || { id: projectId };
      const raw = data.projects.find((x) => x.id === projectId);
      const p = raw ? enrich(raw) : item;
      const stage = stagesForProject(p).find((s) => s.id === stageId) || OPS_STAGES.find((s) => s.id === stageId);
      if (!stage || (!stage.always && !(typeof stage.when === 'function' && stage.when(p)))) {
        toast('هذه الوظيفة غير متاحة لهذا المشروع حاليًا.');
        return;
      }
      openStageForProject(item, p, stage);
      return;
    }
    const myAct = e.target.closest('[data-sp-my-action]');
    if (myAct) {
      const action = myAct.getAttribute('data-sp-my-action');
      const id = myAct.getAttribute('data-sp-my-id');
      if (action === 'resume' || action === 'revise') {
        const rec = regApi?.get?.(id);
        if (!rec) return toast('الطلب غير موجود.');
        const p = data.projects.find((x) => x.id === rec.projectId) || {
          id: rec.projectId,
          title: rec.projectName,
          categoryId: rec.categoryId,
        };
        openRegModal(p, rec);
        return;
      }
      if (action === 'test') {
        if (id) openProject(id);
        return;
      }
      if (action === 'details') {
        regApi?.openDetails?.(id);
        return;
      }
    }
    const more = e.target.closest('[data-sp-more]');
    if (more) {
      const id = more.getAttribute('data-sp-more');
      pageByCat[id] = (pageByCat[id] || 1) + 1;
      paintCatalog();
      return;
    }
    const expand = e.target.closest('[data-sp-expand]');
    if (expand) {
      const card = expand.closest('.sp-card');
      const details = card?.querySelector('.sp-card-details');
      if (!details) return;
      const open = details.hasAttribute('hidden');
      if (open) details.removeAttribute('hidden');
      else details.setAttribute('hidden', '');
      expand.innerHTML = open
        ? '<i class="fas fa-chevron-up"></i> إخفاء'
        : '<i class="fas fa-chevron-down"></i> التفاصيل';
      return;
    }
    const regBtn = e.target.closest('[data-sp-register]');
    if (regBtn) {
      const id = regBtn.getAttribute('data-sp-register');
      const p = data.projects.find((x) => x.id === id);
      if (!p) return toast('المشروع غير موجود');
      openRegModal(p);
      return;
    }
    const openBtn = e.target.closest('[data-sp-open]');
    if (openBtn) {
      openProject(openBtn.getAttribute('data-sp-open'));
      journeyMark('openedProject', true);
    }
    const rm = e.target.closest('[data-sp-remove]');
    if (rm) {
      writeOpened(readOpened().filter((x) => x.id !== rm.getAttribute('data-sp-remove')));
      paintOpened();
      paintStats();
      toast('تمت الإزالة');
    }
    const regRm = e.target.closest('[data-sp-reg-remove]');
    if (regRm) {
      regApi?.remove?.(regRm.getAttribute('data-sp-reg-remove'));
      paintRegistrations();
      toast('تم حذف طلب التسجيل');
    }
  });
})();
