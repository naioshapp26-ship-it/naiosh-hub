/**
 * NAIOSH OPPORTUNITY ENGINE — نظام اتخاذ قرار للفرص
 * القوائم = مادة خام · المخرج = فرصة قابلة للاختبار ثم تشغيل داخل هوب
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-side-projects-page]');
  const data = window.HubSideProjectsData;
  if (!root || !data) return;

  const KEY = 'naiosh_opportunity_engine_v1';
  const LEGACY_KEY = 'naiosh_side_projects_opened_v1';
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
  const catFilter = root.querySelector('[data-sp-cat-filter]');
  const catChips = root.querySelector('[data-sp-cat-chips]');
  const searchEl = root.querySelector('[data-sp-search]');
  const openedEl = root.querySelector('[data-sp-opened]');
  const statsEl = root.querySelector('[data-sp-stats]');
  const pathEl = root.querySelector('[data-sp-path]');
  const toastEl = document.getElementById('sp-toast');

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
    statsEl.innerHTML = `
      <article><strong>${data.projects.length.toLocaleString('ar-EG')}</strong><span>فرصة في قاعدة المعرفة</span></article>
      <article><strong>${data.categories.length}</strong><span>فئة قرار</span></article>
      <article><strong>10</strong><span>فرص مقترحة لكل ملف</span></article>
      <article><strong>${readOpened().length}</strong><span>قيد الاختبار</span></article>`;
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
      <div><span>الفئة</span><strong>${esc(p.categoryName)}</strong></div>
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
      <div><span>إيراد تقديري (USD)</span><strong>${esc(p.revenue)}</strong></div>
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
    return `<article class="sp-card" data-id="${esc(p.id)}">
      <div class="sp-card-top">
        <span class="sp-card-icon"><i class="fas ${esc(
          data.categories.find((c) => c.id === p.categoryId)?.icon || 'fa-compass'
        )}"></i></span>
        <div>
          <h3>${esc(p.title)}</h3>
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
      ${detailRows(p)}
      <div class="sp-card-actions">
        <button type="button" class="btn btn-primary" data-sp-open="${esc(p.id)}"><i class="fas fa-flask"></i> اختبر هذه الفرصة</button>
        <a class="btn btn-secondary" href="courses.html">تدريب مصغر</a>
        <a class="btn btn-secondary" href="ads.html">Marketing</a>
        <a class="btn btn-secondary" href="incubators.html">الحاضنات</a>
      </div>
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
      resultsLead.textContent = `تحليل ملفك (${answers.age || ''} · ${answers.location || ''} · رأس مال ${answers.capital} · ${answers.season || ''}) — أعلى 10 فرص محتملة للاختبار، وليست ضمان ربح.`;
    }
    if (resultsGrid) {
      resultsGrid.innerHTML = ranked.map((r) => projectCard(r.p, { score: r.score, reasons: r.reasons, p: r.p })).join('');
    }
    resultsPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('تم اقتراح 10 فرص قابلة للاختبار');
  };

  const paintCatalog = () => {
    const q = (searchEl?.value || '').trim().toLowerCase();
    const cat = catFilter?.value || '';
    let list = data.projects;
    if (cat) list = list.filter((p) => p.categoryId === cat);
    if (q) list = list.filter((p) => `${p.title} ${p.section}`.toLowerCase().includes(q));
    list = list.slice(0, 36);
    if (catalogGrid) {
      catalogGrid.innerHTML = list.length
        ? list.map((p) => projectCard(p)).join('')
        : '<p class="sp-empty">لا نتائج مطابقة في قاعدة المعرفة.</p>';
    }
  };

  const paintCatUi = () => {
    if (catFilter) {
      catFilter.innerHTML =
        `<option value="">كل الفئات</option>` +
        data.categories.map((c) => `<option value="${esc(c.id)}">${esc(c.nameAr)}</option>`).join('');
    }
    if (catChips) {
      catChips.innerHTML = data.categories
        .map(
          (c) =>
            `<button type="button" class="sp-chip" data-sp-chip="${esc(c.id)}"><i class="fas ${esc(c.icon)}"></i> ${esc(c.nameAr)}</button>`
        )
        .join('');
    }
  };

  const paintOpened = () => {
    const list = readOpened();
    if (!openedEl) return;
    if (!list.length) {
      openedEl.innerHTML =
        '<p class="sp-empty">لا فرص قيد الاختبار بعد — حلّل ملفك أو تصفّح قاعدة المعرفة ثم اضغط «اختبر هذه الفرصة».</p>';
      return;
    }
    openedEl.innerHTML = list
      .map((item) => {
        const p = data.projects.find((x) => x.id === item.id);
        return `<article class="sp-opened-card">
          <div class="sp-opened-main">
            <h3>${esc(item.title || p?.title || 'فرصة')}</h3>
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
            <a class="btn btn-primary" href="courses.html">Learning</a>
            <a class="btn btn-secondary" href="ads.html">Marketing</a>
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
    if (!p) return toast('الفرصة غير موجودة');
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
    toast(`تم فتح فرصة للاختبار: ${p.title}`);
    document.getElementById('sp-opened')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  paintPath();
  paintForm();
  paintStats();
  paintCatUi();
  paintCatalog();
  paintOpened();

  root.querySelector('[data-sp-match]')?.addEventListener('click', match);
  root.querySelector('[data-sp-reset]')?.addEventListener('click', () => {
    formEl?.reset();
    if (resultsPanel) resultsPanel.hidden = true;
  });
  searchEl?.addEventListener('input', () => paintCatalog());
  catFilter?.addEventListener('change', () => paintCatalog());
  catChips?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sp-chip]');
    if (!btn || !catFilter) return;
    catFilter.value = btn.getAttribute('data-sp-chip') || '';
    paintCatalog();
  });
  root.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-sp-open]');
    if (openBtn) openProject(openBtn.getAttribute('data-sp-open'));
    const rm = e.target.closest('[data-sp-remove]');
    if (rm) {
      writeOpened(readOpened().filter((x) => x.id !== rm.getAttribute('data-sp-remove')));
      paintOpened();
      paintStats();
      toast('تمت الإزالة');
    }
  });
})();
