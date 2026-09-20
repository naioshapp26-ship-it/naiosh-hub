/**
 * دليل التشغيل + رحلة المشروع لصفحة المشاريع الجانبية
 * يربط الخطوات بالعناصر الفعلية في الصفحة دون إعادة تصميم.
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-side-projects-page]');
  if (!root) return;

  const JOURNEY_KEY = 'naiosh_sp_journey_v1';
  const regApi = window.HubSideProjectRegistrations;

  const STEPS = [
    {
      id: 'intro',
      title: 'التعرف على المشاريع الجانبية',
      desc: 'افهم الفكرة وأخبر نايوش عن تحديك واحتياجك.',
      action: 'ابدأ التعريف',
      target: '#sp-client-intro',
    },
    {
      id: 'type',
      title: 'اختيار نوع المشروع',
      desc: 'اختر التصنيف الأنسب (خاصة · خفيفة · منزلية أو كل القوائم).',
      action: 'اختيار نوع المشروع',
      target: '#sp-types',
    },
    {
      id: 'idea',
      title: 'اختيار الفكرة',
      desc: 'ابحث في القوائم واختر المشروع المناسب لك.',
      action: 'تصفح المشاريع',
      target: '#sp-catalog',
    },
    {
      id: 'start',
      title: 'بدء المشروع',
      desc: 'اضغط «ابدأ مشروعك» لفتح مسار التسجيل.',
      action: 'مشاريعي / التسجيل',
      target: '#sp-my-projects',
    },
    {
      id: 'details',
      title: 'إكمال البيانات',
      desc: 'أدخل بياناتك وخبراتك والمرفقات، ويمكنك الحفظ كمسودة.',
      action: 'فتح نموذج التسجيل',
      target: '#sp-registrations',
    },
    {
      id: 'review',
      title: 'المراجعة والإرسال',
      desc: 'راجع الملخص ثم أرسل المشروع لفريق نايوش.',
      action: 'طلبات التسجيل',
      target: '#sp-registrations',
    },
    {
      id: 'follow',
      title: 'متابعة الحالة',
      desc: 'تابع رقم الطلب وحالته من «مشاريعي»، ونفّذ التعديل إن طُلب.',
      action: 'مشاريعي',
      target: '#sp-my-projects',
    },
    {
      id: 'run',
      title: 'التشغيل بعد الموافقة',
      desc: 'بعد القبول يمكنك اختبار المشروع ومتابعة مسار التشغيل داخل هوب.',
      action: 'مشاريع قيد الاختبار',
      target: '#sp-opened',
    },
  ];

  const HOW_TO = [
    'اختر نوع المشروع.',
    'اختر الفكرة المناسبة من القائمة.',
    'اضغط «ابدأ مشروعك».',
    'أكمل البيانات المطلوبة (أو احفظ كمسودة).',
    'راجع بياناتك ثم أرسل المشروع.',
    'تابع الحالة من «مشاريعي».',
  ];

  const FULL_GUIDE = [
    {
      q: 'ما هي المشاريع الجانبية؟',
      a: 'أفكار ومسارات تشغيل جاهزة تساعدك على بدء مشروع بجانب عملك أو دراستك، مع دعم نايوش خطوة بخطوة.',
    },
    {
      q: 'كيف أبدأ؟',
      a: 'افتح «كيف أبدأ؟» أو ابدأ من التعريف، ثم اختر نوع المشروع والفكرة واضغط «ابدأ مشروعك».',
    },
    {
      q: 'كيف أختار نوع المشروع؟',
      a: 'من قسم «نوع المشروع» اختر خاصة أو خفيفة أو منزلية أو كل القوائم، ثم اقرأ وصف التصنيف.',
    },
    {
      q: 'كيف أكمل بيانات المشروع؟',
      a: 'نموذج التسجيل مقسوم لخطوات: اختيار المشروع، بياناتك، الخبرة، المرفقات، ثم المراجعة.',
    },
    {
      q: 'كيف أرسل المشروع؟',
      a: 'في خطوة المراجعة اضغط «إرسال المشروع». يصل الطلب لفريق نايوش برقم طلب وحالة واضحة.',
    },
    {
      q: 'ماذا يحدث بعد الإرسال؟',
      a: 'تظهر لك شاشة نجاح برقم الطلب، ويصل إشعار للإدارة للمتابعة والتواصل.',
    },
    {
      q: 'كيف أتابع المشروع؟',
      a: 'من قسم «مشاريعي» ترى الحالة وآخر تحديث والإجراء التالي.',
    },
    {
      q: 'كيف أتعامل مع طلب التعديل؟',
      a: 'إن ظهرت حالة «يحتاج تعديل» سترى سبب الطلب، ثم تعدّل وتعيد الإرسال.',
    },
    {
      q: 'متى يُعتبر المشروع مكتملًا؟',
      a: 'عند وصول الحالة إلى «مقبول» أو «مغلق» حسب قرار الإدارة، ويمكنك بعدها تشغيل مسار الاختبار.',
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
    const regs = regApi?.read?.() || [];
    const mine = regs.filter((r) => r.status !== 'مسودة' || r.ownerName || r.projectName);
    const hasDraft = regs.some((r) => r.status === 'مسودة');
    const hasSubmitted = regs.some((r) => r.status && r.status !== 'مسودة');
    const needsFix = regs.some((r) => r.status === 'يحتاج تعديل');
    const accepted = regs.some((r) => r.status === 'مقبول' || r.status === 'مغلق');
    const done = {
      intro: !!j.introDone || !!j.intakeDone,
      type: !!j.typeChosen,
      idea: !!j.ideaChosen || !!j.selectedProjectId,
      start: !!j.started || hasDraft || hasSubmitted,
      details: hasDraft || hasSubmitted || !!j.detailsDone,
      review: hasSubmitted,
      follow: hasSubmitted || needsFix,
      run: accepted || !!j.openedProject,
    };
    const completed = STEPS.filter((s) => done[s.id]).length;
    let current = STEPS.find((s) => !done[s.id]) || STEPS[STEPS.length - 1];
    if (needsFix) current = STEPS.find((s) => s.id === 'follow') || current;
    return { done, completed, total: STEPS.length, current, needsFix, mineCount: mine.length };
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

  const openModal = (id) => {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('sp-guide-open');
  };

  const closeModals = () => {
    document.querySelectorAll('[data-sp-guide-modal]').forEach((m) => {
      m.hidden = true;
    });
    document.body.classList.remove('sp-guide-open');
  };

  const paintHowTo = () => {
    const ol = document.querySelector('[data-sp-howto-list]');
    if (ol) ol.innerHTML = HOW_TO.map((t) => `<li>${t}</li>`).join('');
  };

  const paintFullGuide = () => {
    const box = document.querySelector('[data-sp-full-guide]');
    if (!box) return;
    box.innerHTML = FULL_GUIDE.map(
      (item) => `<article class="sp-guide-item"><h3>${item.q}</h3><p>${item.a}</p></article>`
    ).join('');
  };

  const paint = () => paintJourney();

  // Bind
  paintHowTo();
  paintFullGuide();
  paint();

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-sp-guide-close]')) {
      closeModals();
      return;
    }
    if (e.target.closest('[data-sp-open-howto]')) {
      openModal('sp-howto-modal');
      return;
    }
    if (e.target.closest('[data-sp-open-guide]')) {
      closeModals();
      openModal('sp-ops-guide-modal');
      return;
    }
    if (e.target.closest('[data-sp-start-now]')) {
      closeModals();
      mark('introDone', true);
      scrollTo('#sp-types');
      return;
    }
    const jump = e.target.closest('[data-sp-jump]');
    if (jump && root.contains(jump)) {
      const target = jump.getAttribute('data-sp-jump');
      closeModals();
      scrollTo(target);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModals();
  });

  window.addEventListener('hub-sp-registrations-changed', paint);
  window.addEventListener('hub-sp-journey-changed', paint);

  // Observe user actions from page
  root.querySelector('[data-sp-intake]')?.addEventListener('submit', () => mark('intakeDone', true));
  root.querySelector('[data-sp-type-tabs]')?.addEventListener('click', (e) => {
    if (e.target.closest('[data-sp-type]')) mark('typeChosen', true);
  });
  root.querySelector('[data-sp-cat-dir]')?.addEventListener('click', (e) => {
    if (e.target.closest('[data-sp-chip]')) mark('typeChosen', true);
  });

  window.HubSideProjectsJourney = {
    mark,
    read: readJourney,
    write: writeJourney,
    paint,
    STEPS,
    scrollTo,
  };
})();
