/**
 * NAIOSH SIDE BUSINESS HUB — نموذج فتح مشاريع جانبية + اقتراح ومطابقة
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-side-projects-page]');
  const data = window.HubSideProjectsData;
  if (!root || !data) return;

  const KEY = 'naiosh_side_projects_opened_v1';
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
  const toastEl = document.getElementById('sp-toast');

  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 2400);
  };

  const readOpened = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  };

  const writeOpened = (list) => {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 40)));
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

  const paintForm = () => {
    if (!formEl) return;
    formEl.innerHTML = `<div class="sp-form-grid">${(data.formFields || []).map(fieldHtml).join('')}</div>`;
  };

  const paintStats = () => {
    if (!statsEl) return;
    statsEl.innerHTML = `
      <article><strong>${data.projects.length.toLocaleString('ar-EG')}</strong><span>فكرة مشروع</span></article>
      <article><strong>${data.categories.length}</strong><span>قائمة من ملف العميل</span></article>
      <article><strong>10</strong><span>اقتراحات لكل ملف</span></article>
      <article><strong>${readOpened().length}</strong><span>مشاريع مفتوحة</span></article>`;
  };

  const scoreProject = (p, answers) => {
    let score = 40;
    const reasons = [];

    if (answers.mode === 'مختلط' || p.mode === 'مختلط' || p.mode === answers.mode) {
      score += 22;
      reasons.push(`نمط ${p.mode}`);
    } else if ((answers.mode === 'رقمي' && p.homeOk) || (answers.mode === 'ميداني' && p.mode !== 'رقمي')) {
      score += 10;
    }

    const capOrder = { 'منخفض جدًا': 1, منخفض: 2, متوسط: 3, مرتفع: 4 };
    const need = capOrder[p.capital] || 2;
    const have = capOrder[answers.capital] || 2;
    if (have >= need) {
      score += 18;
      reasons.push(`رأس مال ${p.capital}`);
    } else if (have + 1 >= need) score += 8;

    if (answers.home === 'نعم' && p.homeOk) {
      score += 12;
      reasons.push('يناسب العمل من المنزل');
    } else if (answers.home === 'مرن') score += 6;
    else if (answers.home === 'لا' && p.mode !== 'رقمي') score += 8;

    const expMap = { مبتدئ: 'سهل', متوسط: 'متوسط', خبير: 'متقدم' };
    if (expMap[answers.experience] === p.difficulty) {
      score += 12;
      reasons.push(`صعوبة ${p.difficulty}`);
    } else if (answers.experience === 'خبير') score += 6;
    else if (answers.experience === 'مبتدئ' && p.difficulty === 'سهل') score += 10;

    const skills = String(answers.skills || '').toLowerCase();
    if (skills) {
      const hay = `${p.title} ${(p.skills || []).join(' ')} ${p.section}`.toLowerCase();
      const tokens = skills.split(/[\s,،/+]+/).filter((t) => t.length > 2);
      const hits = tokens.filter((t) => hay.includes(t));
      if (hits.length) {
        score += Math.min(18, hits.length * 6);
        reasons.push(`مهارات: ${hits.slice(0, 3).join(' · ')}`);
      }
    }

    if (answers.income && /١٠٠٠٠|10000|أكثر/.test(answers.income) && /١٥٠٠٠|8000|١٠٠٠٠/.test(p.revenue || '')) {
      score += 6;
    }
    if (answers.hours && /٢٠\+|20\+/.test(answers.hours) && p.mode === 'ميداني') score += 4;
    if (answers.hours && /١–٥|1-5/.test(answers.hours) && p.mode === 'رقمي') score += 4;

    return { score: Math.min(99, Math.round(score)), reasons };
  };

  const detailRows = (p) => `
    <div class="sp-detail-grid">
      <div><span>رأس المال</span><strong>${esc(p.capital)}</strong></div>
      <div><span>المهارات</span><strong>${esc((p.skills || []).join(' · '))}</strong></div>
      <div><span>وقت التشغيل</span><strong>${esc(p.hoursHint)}</strong></div>
      <div><span>الصعوبة</span><strong>${esc(p.difficulty)}</strong></div>
      <div><span>العملاء</span><strong>${esc(p.customers)}</strong></div>
      <div><span>الإيرادات</span><strong>${esc(p.revenue)}</strong></div>
      <div><span>المصاريف</span><strong>${esc(p.expenses)}</strong></div>
      <div><span>المخاطر</span><strong>${esc(p.risks)}</strong></div>
      <div><span>التراخيص</span><strong>${esc(p.licenses)}</strong></div>
      <div><span>أدوات AI</span><strong>${esc(p.aiTools)}</strong></div>
    </div>
    <div class="sp-plan">
      <strong>خطة بدء 30 يومًا</strong>
      <ol>${(p.plan30 || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <strong>تسويق</strong>
      <p>${esc((p.marketing || []).join(' · '))}</p>
      <strong>نموذج مالي مبسط</strong>
      <p>${esc(p.revenue)} — مع ضبط المصاريف: ${esc(p.expenses)}</p>
    </div>`;

  const projectCard = (p, opts = {}) => {
    const cat = data.categories.find((c) => c.id === p.categoryId);
    const score = opts.score != null ? `<span class="sp-score">${opts.score}%</span>` : '';
    const reasons = opts.reasons?.length
      ? `<p class="sp-reasons">${opts.reasons.map(esc).join(' · ')}</p>`
      : '';
    return `<article class="sp-card" data-id="${esc(p.id)}">
      <div class="sp-card-top">
        <span class="sp-card-icon"><i class="fas ${esc(cat?.icon || 'fa-lightbulb')}"></i></span>
        <div>
          <h3>${esc(p.title)}</h3>
          <small>${esc(cat?.nameAr || '')}${p.section ? ` · ${esc(p.section)}` : ''}</small>
        </div>
        ${score}
      </div>
      <div class="sp-badges">
        <span>${esc(p.mode)}</span>
        <span>${esc(p.capital)}</span>
        <span>${esc(p.difficulty)}</span>
      </div>
      ${reasons}
      ${detailRows(p)}
      <div class="sp-card-actions">
        <button type="button" class="btn btn-primary" data-sp-open="${esc(p.id)}"><i class="fas fa-folder-plus"></i> فتح المشروع</button>
        <a class="btn btn-secondary" href="incubators.html">الحاضنات</a>
        <a class="btn btn-secondary" href="store.html">المتجر</a>
      </div>
    </article>`;
  };

  const match = () => {
    if (!formEl?.reportValidity?.() && formEl && !formEl.checkValidity()) {
      formEl.reportValidity();
      return toast('أكمل حقول النموذج');
    }
    const fd = new FormData(formEl);
    const answers = Object.fromEntries(fd.entries());
    const ranked = data.projects
      .map((p) => {
        const r = scoreProject(p, answers);
        return { p, ...r };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    if (resultsPanel) resultsPanel.hidden = false;
    if (resultsLead) {
      resultsLead.textContent = `تم تحليل ملفك (${answers.mode} · رأس مال ${answers.capital} · خبرة ${answers.experience}) — هذه أعلى 10 ملاءمة.`;
    }
    if (resultsGrid) {
      resultsGrid.innerHTML = ranked.map((r) => projectCard(r.p, { score: r.score, reasons: r.reasons })).join('');
    }
    resultsPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('تم اقتراح أفضل 10 مشاريع');
  };

  const paintCatalog = () => {
    const q = (searchEl?.value || '').trim().toLowerCase();
    const cat = catFilter?.value || '';
    let list = data.projects;
    if (cat) list = list.filter((p) => p.categoryId === cat);
    if (q) list = list.filter((p) => `${p.title} ${p.section}`.toLowerCase().includes(q));
    list = list.slice(0, 48);
    if (catalogGrid) {
      catalogGrid.innerHTML = list.length
        ? list.map((p) => projectCard(p)).join('')
        : '<p class="sp-empty">لا نتائج مطابقة.</p>';
    }
  };

  const paintCatUi = () => {
    if (catFilter) {
      catFilter.innerHTML =
        `<option value="">كل التصنيفات</option>` +
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
      openedEl.innerHTML = '<p class="sp-empty">لم تفتح أي مشروع بعد — استخدم النموذج أو الكتالوج ثم اضغط «فتح المشروع».</p>';
      return;
    }
    openedEl.innerHTML = list
      .map((item) => {
        const p = data.projects.find((x) => x.id === item.id);
        return `<article class="sp-opened-card">
          <div>
            <h3>${esc(item.title || p?.title || 'مشروع')}</h3>
            <small>فُتح ${esc(new Date(item.openedAt).toLocaleString('ar-EG'))}</small>
            <p>المسار المقترح: دراسة جدوى مبسطة → هوية → تسويق → CRM → فواتير → تدريب → قياس ربحية.</p>
          </div>
          <div class="sp-card-actions">
            <a class="btn btn-primary" href="systems/crm.html?from=hub&return=side-projects.html">CRM</a>
            <a class="btn btn-secondary" href="ads.html">Marketing</a>
            <a class="btn btn-secondary" href="courses.html">تدريب</a>
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
    toast(`تم فتح المشروع: ${p.title}`);
    document.getElementById('sp-opened')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
