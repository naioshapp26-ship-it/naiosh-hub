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
  const typeTabs = root.querySelector('[data-sp-type-tabs]');
  const catDir = root.querySelector('[data-sp-cat-dir]');
  const searchEl = root.querySelector('[data-sp-search]');
  const openedEl = root.querySelector('[data-sp-opened]');
  const statsEl = root.querySelector('[data-sp-stats]');
  const pathEl = root.querySelector('[data-sp-path]');
  const toastEl = document.getElementById('sp-toast');
  const regModal = document.getElementById('sp-reg-modal');
  const regForm = document.querySelector('[data-sp-reg-form]');
  const regListEl = root.querySelector('[data-sp-reg-list]');
  const selectedBox = root.querySelector('[data-sp-selected-project]');
  const selectedNameEl = root.querySelector('[data-sp-selected-name]');

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
    { label: 'تصنيف المخاطر', icon: 'fa-shield-halved' },
    { label: 'متطلبات البداية', icon: 'fa-list-check' },
    { label: 'اختيار الفرصة', icon: 'fa-hand-pointer' },
    { label: 'تدريب مصغر', icon: 'fa-graduation-cap', href: 'courses.html' },
    { label: 'خطة تشغيل', icon: 'fa-clipboard-list', href: 'office.html' },
    { label: 'جدوى مبسطة', icon: 'fa-chart-line', href: 'incubators.html' },
    { label: 'التسعير', icon: 'fa-tags', href: 'store.html' },
    { label: 'الموردون', icon: 'fa-truck', href: 'systems/erp.html?from=hub&return=side-projects.html' },
    { label: 'Marketing Studio', icon: 'fa-bullhorn', href: 'ads.html' },
    { label: 'العملاء + CRM', icon: 'fa-users', href: 'systems/crm.html?from=hub&return=side-projects.html' },
    { label: 'قياس وتحسين', icon: 'fa-gauge-high', href: 'dashboard.html' },
    { label: 'حاضنة نايوش', icon: 'fa-seedling', href: 'incubators.html' },
  ];

  const OPS_STEPS = [
    { n: '1', label: 'تدريب مصغر Adaptive', href: 'courses.html', icon: 'fa-graduation-cap' },
    { n: '2', label: 'خطة تشغيل', href: 'office.html', icon: 'fa-clipboard-list' },
    { n: '3', label: 'دراسة جدوى مبسطة', href: 'incubators.html', icon: 'fa-chart-line' },
    { n: '4', label: 'التسعير', href: 'store.html', icon: 'fa-tags' },
    { n: '5', label: 'الموردون / ERP', href: 'systems/erp.html?from=hub&return=side-projects.html', icon: 'fa-truck' },
    { n: '6', label: 'Marketing Studio', href: 'ads.html', icon: 'fa-bullhorn' },
    { n: '7', label: 'CRM والعملاء', href: 'systems/crm.html?from=hub&return=side-projects.html', icon: 'fa-users' },
    { n: '8', label: 'قياس النتائج', href: 'dashboard.html', icon: 'fa-gauge-high' },
    { n: '9', label: 'تحسين المشروع', href: 'office.html', icon: 'fa-arrows-rotate' },
    { n: '10', label: 'التوسع للحاضنة', href: 'incubators.html', icon: 'fa-seedling' },
  ];

  let activeType = 'all';
  let pageByCat = {};

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

  const fileMeta = (input) => {
    const f = input?.files?.[0];
    if (!f) return null;
    return { name: f.name, size: f.size, type: f.type || '' };
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

  const paintRegistrations = () => {
    if (!regListEl) return;
    const list = readRegistrations();
    if (!list.length) {
      regListEl.innerHTML =
        '<p class="sp-empty">لا طلبات تسجيل بعد — اختر مشروعاً واضغط على أيقونة أو اسم المشروع لفتح نموذج التسجيل. الطلبات تُرسل لصفحة الفريق الداخلية.</p>';
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
            <p class="sp-reg-files">
              ملف: ${esc(r.fileDoc?.name || '—')} ·
              صورة: ${esc(r.fileImage?.name || '—')} ·
              فيديو: ${esc(r.fileVideo?.name || '—')}
            </p>
            ${r.currentWork ? `<p>عمل حالي: ${esc(r.currentWork)}</p>` : ''}
            ${r.commercialOrNotes ? `<p>ملاحظات / سجل: ${esc(r.commercialOrNotes)}</p>` : ''}
            <small>تاريخ التسجيل ${esc(new Date(r.createdAt).toLocaleString('ar-EG'))}</small>
          </div>
          <a class="btn btn-secondary" href="side-project-registrations.html">متابعة الفريق</a>
        </article>`
      )
      .join('');
    if (list.length > 8) {
      regListEl.insertAdjacentHTML(
        'beforeend',
        `<p class="sp-empty"><a href="side-project-registrations.html">عرض كل الطلبات (${list.length.toLocaleString('ar-EG')}) في صفحة الفريق</a></p>`
      );
    }
  };

  const closeRegModal = () => {
    if (!regModal) return;
    regModal.hidden = true;
    document.body.classList.remove('sp-reg-open');
  };

  const openRegModal = (project) => {
    if (!regModal || !regForm || !project) return;
    selectedProject = { id: project.id, title: project.title, categoryId: project.categoryId };
    paintSelectedProject();
    const idInput = regForm.querySelector('[data-sp-reg-project-id]');
    const nameInput = regForm.querySelector('[data-sp-reg-project-name]');
    if (idInput) idInput.value = project.id;
    if (nameInput) nameInput.value = project.title;
    regModal.hidden = false;
    document.body.classList.add('sp-reg-open');
    regForm.querySelector('[name="ownerName"]')?.focus();
  };

  const fillCountries = () => {
    const sel = regForm?.querySelector('[data-sp-reg-country]');
    if (!sel || sel.options.length > 1) return;
    sel.innerHTML =
      `<option value="">— اختر الدولة —</option>` +
      COUNTRIES.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  };

  const submitRegistration = (e) => {
    e.preventDefault();
    if (!regForm) return;
    if (!regApi?.create) return toast('نظام استقبال التسجيلات غير متاح');
    if (!regForm.checkValidity()) {
      regForm.reportValidity();
      return toast('أكمل حقول التسجيل المطلوبة');
    }
    const fd = new FormData(regForm);
    const phone = String(fd.get('phone') || '').trim();
    const email = String(fd.get('email') || '').trim();
    if (!phone && !email) {
      return toast('أضف رقم جوال أو بريداً إلكترونياً حتى يتمكن الفريق من التواصل معك');
    }
    const payload = {
      projectId: String(fd.get('projectId') || selectedProject?.id || ''),
      projectName: String(fd.get('projectName') || '').trim(),
      ownerName: String(fd.get('ownerName') || '').trim(),
      phone,
      email,
      preferredContact: String(fd.get('preferredContact') || '').trim(),
      country: String(fd.get('country') || '').trim(),
      education: String(fd.get('education') || '').trim(),
      experienceYears: Number(fd.get('experienceYears') || 0),
      experience1: String(fd.get('experience1') || '').trim(),
      experience2: String(fd.get('experience2') || '').trim(),
      experience3: String(fd.get('experience3') || '').trim(),
      fileDoc: fileMeta(regForm.querySelector('[name="fileDoc"]')),
      fileImage: fileMeta(regForm.querySelector('[name="fileImage"]')),
      fileVideo: fileMeta(regForm.querySelector('[name="fileVideo"]')),
      currentWork: String(fd.get('currentWork') || '').trim(),
      commercialOrNotes: String(fd.get('commercialOrNotes') || '').trim(),
    };
    const result = regApi.create(payload);
    if (!result?.ok) return toast(result?.error || 'تعذّر إرسال التسجيل');
    paintRegistrations();
    closeRegModal();
    regForm.reset();
    if (selectedProject) {
      const nameInput = regForm.querySelector('[data-sp-reg-project-name]');
      const idInput = regForm.querySelector('[data-sp-reg-project-id]');
      if (nameInput) nameInput.value = selectedProject.title;
      if (idInput) idInput.value = selectedProject.id;
    }
    toast(`تم إرسال التسجيل للفريق: ${result.record.projectName}`);
    document.getElementById('sp-registrations')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        ? 'تدريب مصغر ١–٣ أيام (Adaptive Microlearning)'
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
        : 'موردو مواد أولية · تغليف · لوجستيات خفيفة · Neg عبر ERP';
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
      <article><strong>${data.projects.length.toLocaleString('ar-EG')}</strong><span>مشروع في القوائم</span></article>
      <article><strong>${special.toLocaleString('ar-EG')}</strong><span>خاصة</span></article>
      <article><strong>${light.toLocaleString('ar-EG')}</strong><span>خفيفة</span></article>
      <article><strong>${home.toLocaleString('ar-EG')}</strong><span>منزلية</span></article>`;
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
        <button type="button" class="sp-card-icon sp-card-icon-btn" data-sp-register="${esc(p.id)}" title="تسجيل المشروع" aria-label="تسجيل المشروع ${esc(p.title)}">
          <i class="fas ${esc(
            data.categories.find((c) => c.id === p.categoryId)?.icon || 'fa-lightbulb'
          )}"></i>
        </button>
        <div>
          <h3>
            <button type="button" class="sp-card-title-btn" data-sp-register="${esc(p.id)}" title="تسجيل المشروع">
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
        <button type="button" class="btn btn-primary" data-sp-register="${esc(p.id)}"><i class="fas fa-file-signature"></i> تسجيل المشروع</button>
        <button type="button" class="btn btn-secondary" data-sp-open="${esc(p.id)}"><i class="fas fa-flask"></i> اختبر المشروع</button>
        <a class="btn btn-secondary" href="courses.html">تدريب</a>
        <a class="btn btn-secondary" href="ads.html">تسويق</a>
        <a class="btn btn-secondary" href="incubators.html">حاضنة</a>
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
    const allowed = new Set(catsForType(activeType).map((c) => c.id));
    let list = data.projects.filter((p) => allowed.has(p.categoryId));
    if (cat) list = list.filter((p) => p.categoryId === cat);
    if (q) list = list.filter((p) => `${p.title} ${p.section}`.toLowerCase().includes(q));
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
        <span>${count.toLocaleString('ar-EG')}</span>
      </button>`;
    }).join('');
  };

  const paintCatDir = () => {
    if (!catDir) return;
    const cats = catsForType(activeType);
    catDir.innerHTML = cats
      .map((c) => {
        const n = countByCat[c.id] || 0;
        const active = catFilter?.value === c.id ? ' is-active' : '';
        return `<button type="button" class="sp-cat-card${active}" data-sp-chip="${esc(c.id)}">
          <span class="sp-cat-card-icon"><i class="fas ${esc(c.icon)}"></i></span>
          <span class="sp-cat-card-copy">
            <strong>${esc(c.nameAr)}</strong>
            <small>${n.toLocaleString('ar-EG')} مشروع</small>
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
      cats.map((c) => `<option value="${esc(c.id)}">${esc(c.nameAr)} (${(countByCat[c.id] || 0).toLocaleString('ar-EG')})</option>`).join('');
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
        ? `عرض قائمة «${catName}» — ${list.length.toLocaleString('ar-EG')} مشروع`
        : `عرض نوع «${typeName}» — ${list.length.toLocaleString('ar-EG')} مشروع · اضغط قائمة أعلاه للتصفية`;
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
            <span>${all.length.toLocaleString('ar-EG')} مشروع</span>
          </header>
          <div class="sp-catalog-grid">
            ${shown.map((p) => projectCard(p)).join('')}
          </div>
          ${
            more > 0
              ? `<button type="button" class="btn btn-secondary sp-load-more" data-sp-more="${esc(id)}">عرض المزيد (${more.toLocaleString('ar-EG')})</button>`
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

  const paintOpened = () => {
    const list = readOpened();
    if (!openedEl) return;
    if (!list.length) {
      openedEl.innerHTML =
        '<p class="sp-empty">لا مشاريع قيد الاختبار بعد — تصفّح القوائم أو اقترح حسب ملفك ثم اضغط «اختبر المشروع».</p>';
      return;
    }
    openedEl.innerHTML = list
      .map((item) => {
        const p = data.projects.find((x) => x.id === item.id);
        return `<article class="sp-opened-card">
          <div class="sp-opened-main">
            <h3>${esc(item.title || p?.title || 'مشروع')}</h3>
            <small>بدأ الاختبار ${esc(new Date(item.openedAt).toLocaleString('ar-EG'))}</small>
            <p>مسار التشغيل: تعلّم ← خطة ← جدوى ← تسعير ← موردون ← تسويق ← CRM ← قياس ← تحسين ← حاضنة.</p>
            <ol class="sp-ops-steps">
              ${OPS_STEPS.map(
                (s) =>
                  `<li><a href="${esc(s.href)}"><span>${s.n}</span><i class="fas ${s.icon}" aria-hidden="true"></i>${esc(s.label)}</a></li>`
              ).join('')}
            </ol>
          </div>
          <div class="sp-card-actions">
            <a class="btn btn-primary" href="courses.html">تدريب</a>
            <a class="btn btn-secondary" href="ads.html">تسويق</a>
            <a class="btn btn-secondary" href="systems/crm.html?from=hub&return=side-projects.html">CRM</a>
            <a class="btn btn-secondary" href="systems/erp.html?from=hub&return=side-projects.html">ERP</a>
            <a class="btn btn-secondary" href="incubators.html">الحاضنات</a>
            <button type="button" class="btn btn-secondary" data-sp-remove="${esc(item.id)}">إزالة</button>
          </div>
        </article>`;
      })
      .join('');
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
    document.getElementById('sp-opened')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  paintPath();
  paintForm();
  paintStats();
  setType('all');
  paintOpened();
  fillCountries();
  paintRegistrations();
  paintSelectedProject();

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
  typeTabs?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sp-type]');
    if (!btn) return;
    setType(btn.getAttribute('data-sp-type') || 'all');
  });
  catDir?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sp-chip]');
    if (!btn || !catFilter) return;
    const id = btn.getAttribute('data-sp-chip') || '';
    catFilter.value = catFilter.value === id ? '' : id;
    pageByCat = {};
    paintCatDir();
    paintCatalog();
    document.getElementById('sp-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  regForm?.addEventListener('submit', submitRegistration);
  document.querySelectorAll('[data-sp-reg-close]').forEach((el) => {
    el.addEventListener('click', closeRegModal);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && regModal && !regModal.hidden) closeRegModal();
  });
  root.querySelector('[data-sp-open-reg-selected]')?.addEventListener('click', () => {
    if (!selectedProject) return toast('اختر مشروعاً أولاً من القائمة');
    const p = data.projects.find((x) => x.id === selectedProject.id) || selectedProject;
    openRegModal(p);
  });
  root.addEventListener('click', (e) => {
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
    if (openBtn) openProject(openBtn.getAttribute('data-sp-open'));
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
