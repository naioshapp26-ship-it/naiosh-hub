/**
 * رحلة بدء المشروع الجانبي — مصدر حالة واحد.
 * اختر مشروعًا → الدور → الاحتياج → تقييم الجاهزية → ابدأ المشروع
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-side-projects-page]');
  if (!root) return;

  const FLOW_KEY = 'naiosh_sp_start_flow_v2';
  const regApi = window.HubSideProjectRegistrations;

  const ASSESS_QS = [
    { id: 'experience', q: 'هل لديك خبرة في هذا المجال؟', options: ['نعم', 'قليلة', 'لا'] },
    { id: 'time', q: 'هل لديك الوقت المطلوب للمشروع؟', options: ['نعم', 'جزئيًا', 'لا'] },
    { id: 'budget', q: 'هل لديك الميزانية المطلوبة تقريبًا؟', options: ['نعم', 'جزئيًا', 'لا'] },
    { id: 'self', q: 'هل تستطيع تنفيذ المشروع بنفسك؟', options: ['نعم', 'مع مساعدة', 'لا'] },
    { id: 'team', q: 'هل تحتاج إلى فريق؟', options: ['لا', 'ربما', 'نعم'] },
    { id: 'tools', q: 'هل لديك الأدوات أو الموارد اللازمة؟', options: ['نعم', 'جزئيًا', 'لا'] },
    { id: 'level', q: 'ما مستوى خبرتك؟', options: ['مبتدئ', 'متوسط', 'خبير'] },
    { id: 'when', q: 'متى تريد البدء؟', options: ['الآن', 'خلال أسبوع', 'خلال شهر'] },
  ];

  /** مصدر الحالة الوحيد للرحلة */
  const state = {
    project: null,
    role: '',
    roleOther: '',
    needs: [],
    needOther: '',
    assessDraft: {},
    assessment: null,
  };

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const els = {
    steps: root.querySelector('[data-sp-flow-steps]'),
    empty: root.querySelector('[data-sp-flow-empty]'),
    picked: root.querySelector('[data-sp-flow-picked]'),
    name: root.querySelector('[data-sp-flow-project-name]'),
    meta: root.querySelector('[data-sp-flow-project-meta]'),
    fields: root.querySelector('[data-sp-flow-fields]'),
    role: root.querySelector('[data-sp-flow-role]'),
    roleOtherWrap: root.querySelector('[data-sp-flow-role-other-wrap]'),
    roleOther: root.querySelector('[data-sp-flow-role-other]'),
    needs: root.querySelector('[data-sp-flow-needs]'),
    needOtherWrap: root.querySelector('[data-sp-flow-need-other-wrap]'),
    needOther: root.querySelector('[data-sp-flow-need-other]'),
    assessQs: root.querySelector('[data-sp-flow-assess-qs]'),
    assessLead: root.querySelector('[data-sp-flow-assess-lead]'),
    assessResult: root.querySelector('[data-sp-flow-assess-result]'),
    review: root.querySelector('[data-sp-flow-review]'),
    reviewBody: root.querySelector('[data-sp-flow-review-body]'),
    startBtn: root.querySelector('[data-sp-flow-start]'),
    msg: root.querySelector('[data-sp-flow-msg]'),
  };

  const toast = (msg) => {
    const t = document.getElementById('sp-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2800);
  };

  const showMsg = (html, isError = false) => {
    if (!els.msg) return;
    els.msg.hidden = false;
    els.msg.classList.toggle('is-error', !!isError);
    els.msg.innerHTML = html;
  };

  const resolvedRole = () => {
    if (state.role === '__other__') return String(state.roleOther || '').trim();
    return String(state.role || '').trim();
  };

  const resolvedNeeds = () => {
    const list = (state.needs || []).filter((n) => n && n !== '__other__');
    if ((state.needs || []).includes('__other__') && String(state.needOther || '').trim()) {
      list.push(String(state.needOther).trim());
    }
    return list;
  };

  const stepStatus = () => {
    const hasProject = !!state.project?.id;
    const hasRole = !!resolvedRole();
    const hasNeeds = resolvedNeeds().length > 0;
    const hasAssess = !!state.assessment;
    const done = {
      1: hasProject,
      2: hasProject && hasRole,
      3: hasProject && hasRole && hasNeeds,
      4: hasProject && hasRole && hasNeeds && hasAssess,
      5: false,
    };
    let current = 1;
    if (!hasProject) current = 1;
    else if (!hasRole) current = 2;
    else if (!hasNeeds) current = 3;
    else if (!hasAssess) current = 4;
    else current = 5;
    return { done, current, hasProject, hasRole, hasNeeds, hasAssess };
  };

  const setStepUi = () => {
    const st = stepStatus();
    els.steps?.querySelectorAll('[data-sp-flow-step]').forEach((li) => {
      const i = Number(li.getAttribute('data-sp-flow-step'));
      li.classList.toggle('is-current', i === st.current);
      li.classList.toggle('is-done', !!st.done[i] && i !== st.current);
      if (i < st.current) li.classList.add('is-done');
      if (i === st.current) li.classList.remove('is-done');
    });
    if (els.startBtn) {
      const ready = !!(st.hasProject && st.hasRole && st.hasNeeds && st.hasAssess);
      els.startBtn.disabled = false;
      els.startBtn.classList.toggle('is-ready', ready);
      els.startBtn.setAttribute('aria-disabled', ready ? 'false' : 'true');
    }
  };

  const save = () => {
    try {
      localStorage.setItem(
        FLOW_KEY,
        JSON.stringify({
          project: state.project,
          role: state.role,
          roleOther: state.roleOther,
          needs: state.needs,
          needOther: state.needOther,
          assessDraft: state.assessDraft,
          assessment: state.assessment,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('hub-sp-journey-changed'));
    } catch (_) {}
  };

  const markCatalogSelection = () => {
    const id = state.project?.id || '';
    root.querySelectorAll('.sp-card.is-selected').forEach((card) => {
      if (card.getAttribute('data-id') === id) return;
      card.classList.remove('is-selected');
      const btn = card.querySelector('button.btn.btn-primary[data-sp-select]');
      if (btn) btn.innerHTML = '<i class="fas fa-check"></i> اختر هذا المشروع';
    });
    if (!id) return;
    let card = null;
    try {
      card = root.querySelector(`.sp-card[data-id="${CSS.escape(id)}"]`);
    } catch (_) {
      card = root.querySelector(`.sp-card[data-id="${id}"]`);
    }
    if (!card) return;
    card.classList.add('is-selected');
    const btn = card.querySelector('button.btn.btn-primary[data-sp-select]');
    if (btn && !btn.textContent.includes('تم اختيار')) {
      btn.innerHTML = '<i class="fas fa-check"></i> تم اختيار المشروع';
    }
  };

  const captureAssessDraft = () => {
    const draft = { ...(state.assessDraft || {}) };
    els.assessQs?.querySelectorAll('[data-sp-assess]').forEach((sel) => {
      const id = sel.getAttribute('data-sp-assess');
      if (id) draft[id] = sel.value;
    });
    state.assessDraft = draft;
  };

  const paintAssessQs = (force = false) => {
    if (!els.assessQs || !state.project) return;
    const title = state.project.title || 'المشروع المختار';
    if (els.assessLead) els.assessLead.textContent = `أجب عن جاهزيتك لمشروع «${title}».`;

    const existing = els.assessQs.querySelectorAll('[data-sp-assess]').length;
    if (!force && existing === ASSESS_QS.length) {
      // restore draft values only
      ASSESS_QS.forEach((item) => {
        const sel = els.assessQs.querySelector(`[data-sp-assess="${item.id}"]`);
        if (sel && state.assessDraft?.[item.id]) sel.value = state.assessDraft[item.id];
        if (sel && state.assessment?.answers?.[item.id]) sel.value = state.assessment.answers[item.id];
      });
      return;
    }

    els.assessQs.innerHTML = ASSESS_QS.map((item) => {
      const current = state.assessDraft?.[item.id] || state.assessment?.answers?.[item.id] || '';
      return `<label class="sp-field">
        <span>${esc(item.q)}</span>
        <select data-sp-assess="${esc(item.id)}" required>
          <option value="">— اختر —</option>
          ${item.options
            .map((o) => `<option value="${esc(o)}"${o === current ? ' selected' : ''}>${esc(o)}</option>`)
            .join('')}
        </select>
      </label>`;
    }).join('');
  };

  const paintReview = () => {
    if (!els.review || !els.reviewBody) return;
    if (!state.assessment || !state.project) {
      els.review.hidden = true;
      return;
    }
    els.review.hidden = false;
    const needs = resolvedNeeds().join(' · ') || '—';
    els.reviewBody.innerHTML = `
      <div><dt>المشروع</dt><dd>${esc(state.project.title)}</dd></div>
      <div><dt>نوع المشروع</dt><dd>${esc(state.project.mode || state.project.categoryName || '—')}</dd></div>
      <div><dt>دورك</dt><dd>${esc(resolvedRole() || '—')}</dd></div>
      <div><dt>ما تحتاجه من نايوش</dt><dd>${esc(needs)}</dd></div>
      <div><dt>نتيجة تقييم الجاهزية</dt><dd>${esc(state.assessment.label)} (${state.assessment.score}%)</dd></div>`;
  };

  const paint = () => {
    const has = !!(state.project && state.project.id);

    // مصدر واحد: إما فارغ أو مختار — لا الاثنين معًا
    if (els.empty) els.empty.hidden = has;
    if (els.picked) els.picked.hidden = !has;
    if (els.fields) els.fields.hidden = !has;

    if (els.name) els.name.textContent = has ? state.project.title : '—';
    if (els.meta) {
      const bits = [
        state.project?.categoryName,
        state.project?.mode,
        state.project?.capital ? `رأس مال ${state.project.capital}` : '',
      ].filter(Boolean);
      els.meta.textContent = bits.join(' · ');
    }

    if (els.role) els.role.value = state.role || '';
    if (els.roleOtherWrap) els.roleOtherWrap.hidden = state.role !== '__other__';
    if (els.roleOther) els.roleOther.value = state.roleOther || '';

    els.needs?.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = (state.needs || []).includes(cb.value);
    });
    if (els.needOtherWrap) els.needOtherWrap.hidden = !(state.needs || []).includes('__other__');
    if (els.needOther) els.needOther.value = state.needOther || '';

    if (has) paintAssessQs(false);

    if (state.assessment && els.assessResult) {
      els.assessResult.hidden = false;
      els.assessResult.innerHTML = `<strong>${esc(state.assessment.label)}</strong>
        <p>${esc(state.assessment.detail)}</p>
        ${
          state.assessment.gaps?.length
            ? `<ul>${state.assessment.gaps.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>`
            : ''
        }`;
    } else if (els.assessResult) {
      els.assessResult.hidden = true;
      els.assessResult.innerHTML = '';
    }

    paintReview();
    setStepUi();
    markCatalogSelection();
    save();
  };

  const selectProject = (project) => {
    if (!project?.id) return;
    const same = state.project?.id === project.id;
    state.project = {
      id: project.id,
      title: project.title,
      categoryId: project.categoryId,
      categoryName: project.categoryName || '',
      mode: project.mode || project.projectType || '',
      capital: project.capital || '',
    };
    if (!same) {
      state.assessment = null;
      state.assessDraft = {};
      paintAssessQs(true);
    }
    paint();
    document.getElementById('sp-flow')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast(`تم اختيار المشروع: ${project.title}`);
    try {
      window.HubSideProjectsJourney?.mark?.('ideaChosen', true);
      window.HubSideProjectsJourney?.mark?.('selectedProjectId', project.id);
      window.HubSideProjectsApi?.setSelected?.(project);
    } catch (_) {}
  };

  const runAssessment = () => {
    if (!state.project) return toast('يرجى اختيار مشروع أولًا');
    if (!resolvedRole()) return toast('يرجى تحديد دورك في المشروع أولًا');
    if (!resolvedNeeds().length) return toast('يرجى تحديد ما تحتاجه من نايوش أولًا');

    captureAssessDraft();
    const answers = {};
    let missing = false;
    ASSESS_QS.forEach((item) => {
      const sel = els.assessQs?.querySelector(`[data-sp-assess="${item.id}"]`);
      const v = String(sel?.value || state.assessDraft?.[item.id] || '').trim();
      if (!v) missing = true;
      answers[item.id] = v;
    });
    if (missing) return toast('أكمل كل أسئلة تقييم الجاهزية');

    state.assessDraft = { ...answers };
    let score = 0;
    const gaps = [];
    const scoreMap = {
      experience: { نعم: 14, قليلة: 8, لا: 2 },
      time: { نعم: 14, جزئيًا: 8, لا: 2 },
      budget: { نعم: 14, جزئيًا: 8, لا: 2 },
      self: { نعم: 12, 'مع مساعدة': 8, لا: 3 },
      team: { لا: 10, ربما: 7, نعم: 4 },
      tools: { نعم: 12, جزئيًا: 7, لا: 2 },
      level: { خبير: 12, متوسط: 8, مبتدئ: 4 },
      when: { الآن: 12, 'خلال أسبوع': 9, 'خلال شهر': 5 },
    };
    Object.entries(answers).forEach(([k, v]) => {
      score += scoreMap[k]?.[v] || 0;
    });
    if (answers.experience === 'لا') gaps.push('تحتاج تدريبًا أو مرافقة في المجال.');
    if (answers.time === 'لا') gaps.push('حدد وقتًا أسبوعيًا ثابتًا قبل البدء.');
    if (answers.budget === 'لا') gaps.push('راجع رأس المال المطلوب أو اختر مشروعًا أقل تكلفة.');
    if (answers.tools === 'لا') gaps.push('جهّز الأدوات/الموارد الأساسية أولًا.');
    if (answers.self === 'لا') gaps.push('ابحث عن شريك أو منفذ قبل الإطلاق.');

    score = Math.max(0, Math.min(100, score));
    let label = 'جاهز للبدء';
    let detail = 'اختياراتك تشير إلى جاهزية جيدة لبدء المشروع مع نايوش.';
    if (score < 55) {
      label = 'تحتاج بعض التجهيزات قبل البدء';
      detail = 'أكمل النقاط التالية ثم أعد التقييم أو ابدأ مع دعم نايوش.';
    } else if (score < 75) {
      label = 'جاهزية متوسطة — يمكن البدء مع متابعة';
      detail = 'يمكنك البدء، مع التركيز على نقاط التحسين أدناه.';
    }

    state.assessment = { score, label, detail, gaps, answers, at: new Date().toISOString() };
    paint();
    toast(label);
    try {
      window.HubSideProjectsJourney?.mark?.('detailsDone', true);
    } catch (_) {}
  };

  const startProject = () => {
    if (!state.project) return toast('يرجى اختيار مشروع أولًا');
    const role = resolvedRole();
    const needs = resolvedNeeds();
    if (!role) return toast('يرجى تحديد دورك في المشروع أولًا');
    if (!needs.length) return toast('يرجى تحديد ما تحتاجه من نايوش أولًا');
    if (!state.assessment) return toast('يرجى إكمال تقييم الجاهزية أولًا');
    if (!regApi?.create) return toast('تعذر إنشاء المشروع — حدّث الصفحة وحاول مجددًا');

    const auth = window.HubStore?.getAuth?.() || null;
    const ownerName =
      auth?.name || auth?.displayName || auth?.userName || auth?.fullName || 'عميل نايوش';
    const phone = auth?.phone || auth?.mobile || '';
    const email = auth?.email || '';
    const clientId = String(auth?.id || auth?.userId || auth?.uid || phone || email || 'guest').trim();

    const payload = {
      projectId: state.project.id,
      projectName: state.project.title,
      categoryId: state.project.categoryId,
      categoryName: state.project.categoryName,
      clientId,
      ownerName,
      phone,
      email,
      preferredContact: phone ? 'جوال' : email ? 'إيميل' : 'جوال',
      role,
      needs,
      needText: needs.join(' · '),
      assessmentScore: state.assessment.score,
      assessmentLabel: state.assessment.label,
      assessmentDetail: state.assessment.detail,
      assessmentGaps: state.assessment.gaps || [],
      assessmentAnswers: state.assessment.answers || {},
      commercialOrNotes: `الدور: ${role} | الاحتياج: ${needs.join(' · ')} | الجاهزية: ${state.assessment.label} (${state.assessment.score}%)`,
      status: 'بدأ المشروع',
      startedAt: new Date().toISOString(),
    };

    const result = regApi.create(payload);
    if (!result?.ok) {
      showMsg(result?.error || 'تعذر بدء المشروع. راجع البيانات وحاول مجددًا.', true);
      return toast(result?.error || 'تعذر بدء المشروع');
    }

    const rec = result.record;
    const ref = rec.refCode || rec.id;
    try {
      window.HubSideProjectsJourney?.mark?.('started', true);
      window.HubSideProjectsApi?.openProject?.(state.project.id);
    } catch (_) {}

    showMsg(
      `تم بدء مشروعك بنجاح.<br/>رقم المشروع: <strong dir="ltr">${esc(ref)}</strong><br/>اسم المشروع: ${esc(
        rec.projectName
      )}<br/>الحالة: ${esc(rec.status)}`
    );
    toast('تم بدء مشروعك بنجاح');

    // شاشة نجاح النظام إن وُجدت
    try {
      const successModal = document.getElementById('sp-success-modal');
      const successBody = document.querySelector('[data-sp-success-body]');
      if (successModal && successBody) {
        successBody.innerHTML = `
          <ul class="sp-success-list">
            <li><span>رقم المشروع</span><strong dir="ltr">${esc(ref)}</strong></li>
            <li><span>اسم المشروع</span><strong>${esc(rec.projectName)}</strong></li>
            <li><span>الحالة</span><strong>${esc(rec.status)}</strong></li>
            <li><span>دورك</span><strong>${esc(role)}</strong></li>
            <li><span>الجاهزية</span><strong>${esc(state.assessment.label)} (${state.assessment.score}%)</strong></li>
          </ul>
          <div class="sp-flow-actions" style="margin-top:12px">
            <a class="btn btn-primary" href="#sp-my-projects">الانتقال إلى مشروعي</a>
            <a class="btn btn-secondary" href="#sp-opened">عرض تفاصيل المشروع</a>
            <a class="btn btn-secondary" href="#sp-catalog">العودة إلى المشاريع</a>
          </div>`;
        successModal.hidden = false;
        document.body.classList.add('sp-success-open');
      }
    } catch (_) {}

    document.getElementById('sp-my-projects')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      window.dispatchEvent(new CustomEvent('hub-sp-registrations-changed'));
    } catch (_) {}
  };

  window.HubSideProjectsFlow = {
    selectProject,
    markCatalogSelection,
    getState: () => ({
      project: state.project ? { ...state.project } : null,
      role: resolvedRole(),
      needs: resolvedNeeds(),
      assessment: state.assessment,
      step: stepStatus(),
    }),
    paint,
  };

  root.querySelector('[data-sp-flow-change]')?.addEventListener('click', () => {
    document.getElementById('sp-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  els.role?.addEventListener('change', () => {
    state.role = els.role.value;
    if (state.role !== '__other__') state.roleOther = '';
    // لا تمسح التقييم إلا إذا تغيّر الدور جوهريًا بعد اكتماله
    paint();
  });
  els.roleOther?.addEventListener('input', () => {
    state.roleOther = els.roleOther.value;
    setStepUi();
    save();
  });
  els.needs?.addEventListener('change', () => {
    state.needs = [...els.needs.querySelectorAll('input[type="checkbox"]:checked')].map((c) => c.value);
    paint();
  });
  els.needOther?.addEventListener('input', () => {
    state.needOther = els.needOther.value;
    setStepUi();
    save();
  });
  els.assessQs?.addEventListener('change', () => {
    captureAssessDraft();
    save();
  });
  root.querySelector('[data-sp-flow-assess-run]')?.addEventListener('click', runAssessment);
  root.querySelector('[data-sp-flow-edit]')?.addEventListener('click', () => {
    els.role?.focus();
    document.getElementById('sp-flow')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  els.startBtn?.addEventListener('click', startProject);

  // Restore from single source
  try {
    const saved = JSON.parse(localStorage.getItem(FLOW_KEY) || localStorage.getItem('naiosh_sp_start_flow_v1') || '{}');
    if (saved?.project?.id) {
      state.project = saved.project;
    } else if (saved?.projectId && window.HubSideProjectsData?.projects) {
      const p = window.HubSideProjectsData.projects.find((x) => x.id === saved.projectId);
      if (p) {
        const cat = window.HubSideProjectsData.categories?.find((c) => c.id === p.categoryId);
        state.project = {
          id: p.id,
          title: p.title,
          categoryId: p.categoryId,
          categoryName: cat?.nameAr || saved.categoryName || '',
          mode: p.mode || saved.mode || '',
          capital: p.capital || '',
        };
      }
    }
    state.role = saved.role || '';
    state.roleOther = saved.roleOther || '';
    state.needs = Array.isArray(saved.needs) ? saved.needs : [];
    state.needOther = saved.needOther || '';
    state.assessDraft = saved.assessDraft || saved.assessment?.answers || {};
    state.assessment = saved.assessment || null;
  } catch (_) {}

  paint();
})();
