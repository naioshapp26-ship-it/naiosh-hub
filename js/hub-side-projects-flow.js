/**
 * رحلة بدء المشروع الجانبي:
 * اختر مشروعًا → الدور → الاحتياج → تقييم الجاهزية → ابدأ المشروع
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-side-projects-page]');
  if (!root) return;

  const FLOW_KEY = 'naiosh_sp_start_flow_v1';
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

  const state = {
    project: null,
    role: '',
    roleOther: '',
    needs: [],
    needOther: '',
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

  const save = () => {
    try {
      localStorage.setItem(
        FLOW_KEY,
        JSON.stringify({
          projectId: state.project?.id || '',
          projectTitle: state.project?.title || '',
          categoryId: state.project?.categoryId || '',
          categoryName: state.project?.categoryName || '',
          mode: state.project?.mode || '',
          role: state.role,
          roleOther: state.roleOther,
          needs: state.needs,
          needOther: state.needOther,
          assessment: state.assessment,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (_) {}
  };

  const setStep = (n) => {
    els.steps?.querySelectorAll('[data-sp-flow-step]').forEach((li) => {
      const i = Number(li.getAttribute('data-sp-flow-step'));
      li.classList.toggle('is-current', i === n);
      li.classList.toggle('is-done', i < n);
    });
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

  const paintAssessQs = () => {
    if (!els.assessQs) return;
    const title = state.project?.title || 'المشروع المختار';
    if (els.assessLead) {
      els.assessLead.textContent = `أجب عن جاهزيتك لمشروع «${title}».`;
    }
    els.assessQs.innerHTML = ASSESS_QS.map(
      (item) => `<label class="sp-field">
        <span>${esc(item.q)}</span>
        <select data-sp-assess="${esc(item.id)}" required>
          <option value="">— اختر —</option>
          ${item.options.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
        </select>
      </label>`
    ).join('');
  };

  const paintReview = () => {
    if (!els.review || !els.reviewBody || !state.assessment) {
      if (els.review) els.review.hidden = true;
      return;
    }
    els.review.hidden = false;
    const needs = resolvedNeeds().join(' · ') || '—';
    els.reviewBody.innerHTML = `
      <div><dt>المشروع</dt><dd>${esc(state.project?.title || '—')}</dd></div>
      <div><dt>نوع المشروع</dt><dd>${esc(state.project?.mode || state.project?.categoryName || '—')}</dd></div>
      <div><dt>دورك</dt><dd>${esc(resolvedRole() || '—')}</dd></div>
      <div><dt>ما تحتاجه من نايوش</dt><dd>${esc(needs)}</dd></div>
      <div><dt>نتيجة تقييم الجاهزية</dt><dd>${esc(state.assessment.label)} (${state.assessment.score}%)</dd></div>`;
  };

  const syncStartEnabled = () => {
    const ok =
      !!state.project &&
      !!resolvedRole() &&
      resolvedNeeds().length > 0 &&
      !!state.assessment;
    if (els.startBtn) els.startBtn.disabled = !ok;
    paintReview();
    if (ok) setStep(5);
    else if (state.assessment) setStep(4);
    else if (resolvedRole() && resolvedNeeds().length) setStep(4);
    else if (resolvedRole()) setStep(3);
    else if (state.project) setStep(2);
    else setStep(1);
  };

  const paint = () => {
    const has = !!state.project;
    if (els.empty) els.empty.hidden = has;
    if (els.picked) els.picked.hidden = !has;
    if (els.fields) els.fields.hidden = !has;
    if (els.name) els.name.textContent = state.project?.title || '—';
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
    if (has) paintAssessQs();
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
    syncStartEnabled();
    save();
  };

  const selectProject = (project) => {
    if (!project) return;
    state.project = {
      id: project.id,
      title: project.title,
      categoryId: project.categoryId,
      categoryName: project.categoryName || '',
      mode: project.mode || project.projectType || '',
      capital: project.capital || '',
    };
    state.assessment = null;
    paint();
    setStep(2);
    document.getElementById('sp-flow')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast(`تم اختيار المشروع: ${project.title}`);
    try {
      window.HubSideProjectsJourney?.mark?.('ideaChosen', true);
      window.HubSideProjectsJourney?.mark?.('selectedProjectId', project.id);
      window.HubSideProjectsApi?.setSelected?.(project);
    } catch (_) {}
  };

  const runAssessment = () => {
    if (!state.project) return toast('اختر مشروعًا أولًا');
    if (!resolvedRole()) return toast('حدد دورك في المشروع');
    if (!resolvedNeeds().length) return toast('حدد ما تحتاجه من نايوش');

    const answers = {};
    let missing = false;
    ASSESS_QS.forEach((item) => {
      const sel = els.assessQs?.querySelector(`[data-sp-assess="${item.id}"]`);
      const v = String(sel?.value || '').trim();
      if (!v) missing = true;
      answers[item.id] = v;
    });
    if (missing) return toast('أكمل كل أسئلة تقييم الجاهزية');

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
    setStep(5);
    toast(label);
    try {
      window.HubSideProjectsJourney?.mark?.('detailsDone', true);
    } catch (_) {}
  };

  const startProject = () => {
    if (!state.project) return toast('اختر مشروعًا أولًا');
    const role = resolvedRole();
    const needs = resolvedNeeds();
    if (!role) return toast('حدد دورك');
    if (!needs.length) return toast('حدد احتياجك من نايوش');
    if (!state.assessment) return toast('أكمل تقييم الجاهزية أولًا');

    const auth = window.HubStore?.getAuth?.() || null;
    const ownerName =
      auth?.name || auth?.displayName || auth?.userName || auth?.fullName || 'عميل نايوش';
    const phone = auth?.phone || auth?.mobile || '';
    const email = auth?.email || '';

    const payload = {
      projectId: state.project.id,
      projectName: state.project.title,
      categoryId: state.project.categoryId,
      categoryName: state.project.categoryName,
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
      status: 'جديد',
    };

    if (!regApi?.create) {
      return toast('تعذر إنشاء المشروع — حدّث الصفحة وحاول مجددًا');
    }

    const result = regApi.create(payload);
    if (!result?.ok) {
      // إذا ناقص تواصل — افتح نموذج التسجيل مع البيانات المعبأة
      try {
        window.HubSideProjectsApi?.openRegister?.(state.project, {
          ...payload,
          status: 'مسودة',
        });
      } catch (_) {}
      if (els.msg) {
        els.msg.hidden = false;
        els.msg.textContent =
          result?.error ||
          'أكمل بيانات التواصل (الجوال أو البريد) لإتمام بدء المشروع.';
      }
      return toast(result?.error || 'أكمل بيانات التواصل لإتمام البدء');
    }

    try {
      window.HubSideProjectsJourney?.mark?.('started', true);
      window.HubSideProjectsApi?.openProject?.(state.project.id);
    } catch (_) {}

    if (els.msg) {
      els.msg.hidden = false;
      els.msg.innerHTML = `تم بدء مشروعك بنجاح.<br/>رقم المشروع: <strong dir="ltr">${esc(result.record.id)}</strong><br/>الحالة: ${esc(result.record.status)} · الخطوة التالية: متابعة الطلب من «مشاريعي».`;
    }
    toast('تم بدء مشروعك بنجاح');
    document.getElementById('sp-my-projects')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      window.dispatchEvent(new CustomEvent('hub-sp-registrations-changed'));
    } catch (_) {}
  };

  // API for catalog selection
  window.HubSideProjectsFlow = {
    selectProject,
    getState: () => ({ ...state, project: state.project ? { ...state.project } : null }),
  };

  // Events
  root.querySelector('[data-sp-flow-change]')?.addEventListener('click', () => {
    document.getElementById('sp-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  els.role?.addEventListener('change', () => {
    state.role = els.role.value;
    state.assessment = null;
    paint();
  });
  els.roleOther?.addEventListener('input', () => {
    state.roleOther = els.roleOther.value;
    syncStartEnabled();
    save();
  });
  els.needs?.addEventListener('change', () => {
    state.needs = [...els.needs.querySelectorAll('input[type="checkbox"]:checked')].map((c) => c.value);
    state.assessment = null;
    paint();
  });
  els.needOther?.addEventListener('input', () => {
    state.needOther = els.needOther.value;
    syncStartEnabled();
    save();
  });
  root.querySelector('[data-sp-flow-assess-run]')?.addEventListener('click', runAssessment);
  root.querySelector('[data-sp-flow-edit]')?.addEventListener('click', () => {
    state.assessment = null;
    paint();
    setStep(2);
    els.role?.focus();
  });
  els.startBtn?.addEventListener('click', startProject);

  root.querySelector('[data-sp-open-howto]')?.addEventListener('click', () => {
    const modal = document.getElementById('sp-howto-modal');
    const body = document.querySelector('[data-sp-howto-list]');
    if (body) {
      body.innerHTML = `
        <li>اختر مشروعًا من القائمة.</li>
        <li>حدد دورك وما تحتاجه من نايوش.</li>
        <li>أكمل تقييم الجاهزية.</li>
        <li>راجع البيانات ثم اضغط «ابدأ المشروع».</li>
      `;
    }
    if (modal) modal.hidden = false;
  });

  // Restore
  try {
    const saved = JSON.parse(localStorage.getItem(FLOW_KEY) || '{}');
    if (saved?.projectId && window.HubSideProjectsData?.projects) {
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
        state.role = saved.role || '';
        state.roleOther = saved.roleOther || '';
        state.needs = Array.isArray(saved.needs) ? saved.needs : [];
        state.needOther = saved.needOther || '';
        state.assessment = saved.assessment || null;
      }
    }
  } catch (_) {}

  paint();
})();
