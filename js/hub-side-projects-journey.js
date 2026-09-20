/**
 * دليل التشغيل + رحلة المشروع لصفحة المشاريع الجانبية
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-side-projects-page]');
  if (!root) return;

  const JOURNEY_KEY = 'naiosh_sp_journey_v1';
  const regApi = window.HubSideProjectRegistrations;

  const STEPS = [
    {
      id: 'idea',
      title: 'اختر المشروع',
      desc: 'اختر مشروعًا من الكتالوج حسب التصنيف أو البحث.',
      action: 'تصفح المشاريع',
      target: '#sp-catalog',
    },
    {
      id: 'role',
      title: 'حدد دورك',
      desc: 'اختر دورك في المشروع من القائمة.',
      action: 'تحديد الدور',
      target: '#sp-flow',
    },
    {
      id: 'need',
      title: 'حدد احتياجك',
      desc: 'حدد كيف تريد أن تساعدك نايوش.',
      action: 'تحديد الاحتياج',
      target: '#sp-flow',
    },
    {
      id: 'assess',
      title: 'قيّم جاهزيتك',
      desc: 'أجب عن أسئلة الجاهزية المرتبطة بالمشروع.',
      action: 'تقييم الجاهزية',
      target: '#sp-flow',
    },
    {
      id: 'start',
      title: 'ابدأ المشروع',
      desc: 'راجع اختياراتك ثم أنشئ مشروعك فعليًا.',
      action: 'ابدأ المشروع',
      target: '#sp-flow',
    },
  ];

  const HOW_TO = [
    'اختر مشروعًا من القائمة المتاحة.',
    'حدد دورك في المشروع.',
    'حدد ما تحتاجه من نايوش.',
    'أكمل تقييم الجاهزية.',
    'راجع البيانات ثم اضغط «ابدأ المشروع».',
    'تابع الحالة من «مشاريعي».',
  ];

  const FULL_GUIDE = [
    {
      q: 'ما هي المشاريع الجانبية؟',
      a: 'أفكار ومسارات تشغيل جاهزة تساعدك على بدء مشروع بجانب عملك أو دراستك، مع دعم نايوش خطوة بخطوة.',
    },
    {
      q: 'كيف أبدأ؟',
      a: 'اختر مشروعًا من الكتالوج، حدد دورك واحتياجك، أكمل تقييم الجاهزية، ثم ابدأ المشروع.',
    },
    {
      q: 'هل أكتب اسم مشروع من عندي؟',
      a: 'لا — اختر من المشاريع المتاحة. إن احتجت مشروعًا غير موجود يمكنك طلبه عبر التواصل مع نايوش لاحقًا.',
    },
    {
      q: 'ماذا يعني قيّم جاهزيتك؟',
      a: 'أسئلة قصيرة عن الخبرة والوقت والميزانية والأدوات لتعرف إن كنت جاهزًا للبدء أو تحتاج تجهيزات.',
    },
    {
      q: 'ماذا يحدث بعد ابدأ المشروع؟',
      a: 'يُنشأ سجل مشروع مرتبط بحسابك ويظهر في «مشاريعي» للمتابعة.',
    },
  ];

  const readJourney = () => {
    try {
      return JSON.parse(localStorage.getItem(JOURNEY_KEY) || '{}') || {};
    } catch {
      return {};
    }
  };

  const writeJourney = (patch) => {
    const next = { ...readJourney(), ...patch, updatedAt: new Date().toISOString() };
    localStorage.setItem(JOURNEY_KEY, JSON.stringify(next));
    return next;
  };

  const mark = (key, value = true) => {
    writeJourney({ [key]: value });
    paint();
  };

  const scrollTo = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      history.replaceState(null, '', sel);
    } catch (_) {}
  };

  const computeProgress = () => {
    const j = readJourney();
    const flow = (() => {
      try {
        const raw =
          localStorage.getItem('naiosh_sp_start_flow_v2') ||
          localStorage.getItem('naiosh_sp_start_flow_v1') ||
          '{}';
        return JSON.parse(raw) || {};
      } catch {
        return {};
      }
    })();
    const live = (() => {
      try {
        return window.HubSideProjectsFlow?.getState?.() || null;
      } catch {
        return null;
      }
    })();
    const regs = regApi?.read?.() || [];
    const hasStarted = regs.some(
      (r) => r.status === 'بدأ المشروع' || (r.status && r.status !== 'مسودة' && r.refCode)
    );
    const hasProject = !!(live?.project?.id || flow.project?.id || flow.projectId || j.selectedProjectId || j.ideaChosen);
    const roleVal = live?.role || (flow.role === '__other__' ? flow.roleOther : flow.role) || '';
    const needsList = live?.needs || flow.needs || [];
    const hasNeeds = Array.isArray(needsList)
      ? needsList.some((n) => n && n !== '__other__') ||
        (needsList.includes('__other__') && String(flow.needOther || live?.needOther || '').trim())
      : false;
    const hasAssess = !!(live?.assessment || flow.assessment);
    const done = {
      idea: hasProject,
      role: !!String(roleVal || '').trim(),
      need: !!hasNeeds,
      assess: hasAssess,
      start: hasStarted || !!j.started,
    };
    const completed = STEPS.filter((s) => done[s.id]).length;
    const current = STEPS.find((s) => !done[s.id]) || STEPS[STEPS.length - 1];
    return { done, completed, total: STEPS.length, current };
  };

  const paintNowBanner = (prog) => {
    const el = root.querySelector('[data-sp-now]');
    if (!el) return;
    const cur = prog.current;
    const idx = STEPS.findIndex((s) => s.id === cur.id);
    const next = STEPS[idx + 1];
    el.innerHTML = `
      <div class="sp-now__label"><i class="fas fa-location-dot"></i> أين أنا الآن؟</div>
      <strong>أنت الآن في خطوة: ${cur.title}</strong>
      <p>${cur.desc}${next ? ` بعد إتمامها ستنتقل إلى: ${next.title}.` : ''}</p>
      <button type="button" class="btn btn-primary" data-sp-jump="${cur.target}">${cur.action}</button>`;
  };

  const paintJourney = () => {
    const list = root.querySelector('[data-sp-journey-list]');
    const meta = root.querySelector('[data-sp-journey-meta]');
    if (!list) return;
    const prog = computeProgress();
    if (meta) {
      meta.textContent = `أكملت ${prog.completed} من ${prog.total} خطوات`;
      meta.setAttribute('aria-valuenow', String(prog.completed));
      meta.setAttribute('aria-valuemax', String(prog.total));
    }
    list.innerHTML = STEPS.map((s, i) => {
      const state = prog.done[s.id] ? 'done' : prog.current.id === s.id ? 'current' : 'todo';
      const icon = state === 'done' ? 'fa-check' : state === 'current' ? 'fa-circle-dot' : 'fa-circle';
      return `<li class="sp-journey-step is-${state}">
        <span class="sp-journey-step__num" aria-hidden="true"><i class="fas ${icon}"></i> ${i + 1}</span>
        <div class="sp-journey-step__body">
          <strong>${s.title}</strong>
          <p>${s.desc}</p>
          <button type="button" class="btn btn-secondary" data-sp-jump="${s.target}">${s.action}</button>
        </div>
      </li>`;
    }).join('');
    paintNowBanner(prog);
  };

  const paint = () => paintJourney();

  const bind = () => {
    root.addEventListener('click', (e) => {
      const jump = e.target.closest('[data-sp-jump]');
      if (jump) {
        scrollTo(jump.getAttribute('data-sp-jump'));
        return;
      }
      if (e.target.closest('[data-sp-open-howto]')) {
        const modal = document.getElementById('sp-howto-modal');
        const body = document.querySelector('[data-sp-howto-list]');
        if (body) {
          body.innerHTML = HOW_TO.map((x) => `<li>${x}</li>`).join('');
        }
        if (modal) modal.hidden = false;
        return;
      }
      if (e.target.closest('[data-sp-open-guide]')) {
        const modal = document.getElementById('sp-ops-guide-modal');
        const body = document.querySelector('[data-sp-full-guide]');
        if (body) {
          body.innerHTML = FULL_GUIDE.map(
            (g) => `<article class="sp-guide-item"><h3>${g.q}</h3><p>${g.a}</p></article>`
          ).join('');
        }
        if (modal) modal.hidden = false;
        return;
      }
      if (e.target.closest('[data-sp-start-now]')) {
        document.querySelectorAll('[data-sp-guide-close],[data-sp-howto-close]').forEach((b) => {
          const m = b.closest('.sp-guide-modal, .sp-howto-modal');
          if (m) m.hidden = true;
        });
        scrollTo('#sp-catalog');
      }
      if (e.target.closest('[data-sp-guide-close],[data-sp-howto-close]')) {
        e.target.closest('.sp-guide-modal, .sp-howto-modal')?.setAttribute('hidden', '');
        const m = e.target.closest('.sp-guide-modal, .sp-howto-modal');
        if (m) m.hidden = true;
      }
    });
    window.addEventListener('hub-sp-journey-changed', paint);
    window.addEventListener('hub-sp-registrations-changed', paint);
    window.addEventListener('storage', paint);
  };

  window.HubSideProjectsJourney = { mark, read: readJourney, paint };

  bind();
  paint();
})();
