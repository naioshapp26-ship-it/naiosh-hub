(() => {
  const PAGE_GUIDES = {
    home: {
      test: (path) => path.endsWith('/') || path.endsWith('/index.html') || path === '' || /index\.html?$/.test(path),
      title: 'دليل نايوش هوب',
      subtitle: 'تعرّف على الصفحة الرئيسية وطبقات المنصة وغرفة العمليات.',
      purpose: 'الصفحة الرئيسية تعرض هوية نايوش هوب 360، الطبقات التشغيلية، تدفق النظام، ومسارات التنفيذ.',
      tips: [
        'الهيرو بنفس ترتيب نايوش ERP: صورة · عنوان وأزرار · قائمة جانبية.',
        'تحت الهيرو: معرض المواقع الجاهزة — اضغط أي لقطة تدخل مباشرة.',
        'الشريط الجانبي (فرعي · حاضنتي · منصتي…) يفتح الموقع فورًا.',
        'من المتجر: اشترِ الآن → تفعيل → ادخل موقعك. كونزو غير مدرج.',
        'زر «غرفة العمليات» يفتح لوحة السيادة التشغيلية بعد تسجيل الدخول.',
      ],
    },
    login: {
      test: (path) => path.includes('login'),
      title: 'دليل تسجيل الدخول',
      subtitle: 'ادخل بحسابك للوصول إلى غرفة العمليات.',
      purpose: 'تُستخدم هذه الصفحة للمصادقة ودخول المستخدمين المصرّح لهم إلى نايوش هوب.',
      tips: [
        'تأكد من صحة البريد وكلمة المرور قبل الإرسال.',
        'يمكنك العودة للرئيسية من رابط أسفل النموذج.',
        'بعد الدخول الناجح ستنتقل مباشرة إلى غرفة العمليات.',
      ],
    },
    dashboard: {
      test: (path) => path.includes('dashboard'),
      title: 'دليل غرفة العمليات',
      subtitle: 'لوحة السيادة اللحظية لإمبراطورية نايوش.',
      purpose: 'غرفة العمليات تعرض مؤشرات الأداء، الطبقات، المحاور، والمنصات السيادية والتقارير.',
      tips: [
        'تنقّل بين الطبقات والمنصات من القائمة الجانبية.',
        'استخدم «إعادة حساب» لتحديث المؤشرات بعد أي تغيير.',
        'زر الرجوع أعلى الصفحة يعيدك للصفحة السابقة أو الرئيسية.',
      ],
    },
    platforms: {
      test: (path) => path.includes('platforms'),
      title: 'دليل المنصات السيادية',
      subtitle: 'ثمانية عشر منصة تشغّل نايوش هوب 360.',
      purpose: 'صفحة كتالوج المنصات السيادية بالعربية — من الدماغ المركزي إلى السلطة العليا.',
      tips: [
        'استخدم التبويبات أعلى الصفحة للانتقال بين مجموعات المنصات.',
        'كل بطاقة تعرض الكود والدور السيادي ووصف المنصة.',
        'من غرفة العمليات يمكنك متابعة حالة المنصات لحظيًا.',
      ],
    },
    branches: {
      test: (path) => path.includes('branches'),
      title: 'دليل الفروع',
      subtitle: 'فروع نايوش حول العالم — بحث وتصفية حسب النوع.',
      purpose: 'عرض شبكة الفروع العالمية بنفس تصميم نايوش ERP مع الدول والأعلام وساعات العمل.',
      tips: [
        'ابحث بالدولة أو اسم الفرع من شريط البحث.',
        'صفِّ حسب النوع: مكاتب خاصة · حاضنة أعمال · مسرعة أعمال.',
        'احجز زيارة أو اعرض تفاصيل الفرع من بطاقة كل دولة.',
      ],
    },
    incubators: {
      test: (path) => path.includes('incubators'),
      title: 'دليل الحاضنات',
      subtitle: '100 حاضنة قطاعية مرتبة حسب الأقسام.',
      purpose: 'نفس صفحة حاضنات نايوش ERP: تبويبات أقسام، بحث، وبطاقات مرقّمة.',
      tips: [
        'استخدم تبويبات الأقسام للانتقال السريع.',
        'ابحث باسم الحاضنة من شريط البحث.',
        'من غرفة العمليات يمكنك إدارة الحاضنات تشغيليًا.',
      ],
    },
    apps: {
      test: (path) => path.includes('apps'),
      title: 'دليل سجل الأنظمة',
      subtitle: 'أي نظام نايوش يظهر في هوب.',
      purpose: 'سجل موحّد للمنصات والاستوديوهات والأنظمة الخارجية المرتبطة بهوب.',
      tips: ['سجّل نظامًا جديدًا من غرفة العمليات.', 'افتح الروابط للانتقال للمتجر أو الإعلانات أو الفعاليات.'],
    },
    products: {
      test: (path) => path.includes('products'),
      title: 'دليل متجر المنتجات',
      subtitle: 'تصنيفات · شبكة منتجات · بحث — زي أسلوب hub360.',
      purpose: 'عرض منتجات نايوش هوب بتصنيفات أفقية وقائمة جانبية وشبكة بطاقات.',
      tips: [
        'اضغط «ادخل الموقع» لفتح الموقع الجاهز مباشرة.',
        'اضغط «اشتري» للذهاب للمتجر وتفعيل الاشتراك ثم الدخول.',
        'كونزو غير مدرج ضمن منتجات هوب.',
      ],
    },
    store: {
      test: (path) => path.includes('store'),
      title: 'دليل متجر المبيعات',
      subtitle: 'اشترِ → تفعيل → ادخل موقعك.',
      purpose: 'متجر مبيعات نايوش: الشراء يفعّل الصلاحية ويفتح الموقع الجاهز فورًا.',
      tips: [
        'اضغط «اشترِ الآن» ثم يفتح موقعك تلقائيًا.',
        'زر «ادخل الموقع» يجرب الموقع بدون انتظار.',
        'كونزو مستبعد من المنتجات والمواقع المعروضة.',
      ],
    },
    ads: {
      test: (path) => path.includes('ads'),
      title: 'دليل استوديو الإعلانات',
      subtitle: 'إعلانات منتجات المنصات.',
      purpose: 'عرض وإدارة إعلانات المنتجات المرتبطة بالمنصات السيادية وأنظمة نايوش.',
      tips: ['فلتر حسب التصنيف.', 'ارجع للمتجر لشراء المنتج المعلن.'],
    },
    events: {
      test: (path) => path.includes('events'),
      title: 'دليل استوديو الفعاليات',
      subtitle: 'فعاليات وبث وورش داخل هوب.',
      purpose: 'إدارة الفعاليات وربطها بالمنصات والمتجر والتسويق.',
      tips: ['أنشئ فعالية من غرفة العمليات.', 'تابع الحالة: قادمة / منتهية / مسودة.'],
    },
    courses: {
      test: (path) => path.includes('courses'),
      title: 'دليل الدورات',
      subtitle: 'كتالوج دورات أكاديمية نايوش العملية.',
      purpose: 'عرض الدورات والمسارات والمخرجات مع التسجيل عبر المتجر ودخول الأكاديمية.',
      tips: [
        'تصفّح البطاقات لمعرفة المستوى والمدة والمخرجات.',
        'اضغط «سجّل الآن» للشراء من المتجر بالنقاط أو الدفع.',
        'استخدم المسارات الجاهزة إن لم تعرف من أين تبدأ.',
        '«افتح الأكاديمية» ينقلك لنظام التشغيل نفسه.',
      ],
    },
    diplomas: {
      test: (path) => path.includes('diplomas'),
      title: 'دليل الدبلومات',
      subtitle: 'دبلومات معتمدة بمشاريع تخرج تطبيقية.',
      purpose: 'مسارات دبلوم أطول لبناء قادة تشغيل وحوكمة وبيانات داخل منظومة هوب.',
      tips: [
        'قارن المدة والنقاط قبل التسجيل.',
        'كل دبلوم ينتهي بمشروع يُقاس في غرفة العمليات.',
        'يمكنك البدء بدورة قصيرة من صفحة الدورات ثم الانتقال للدبلوم.',
      ],
    },
  };

  const normalizeText = (value) => (value || '').toString().replace(/\s+/g, ' ').trim();

  const cleanTitle = (value) => {
    if (!value) return 'الصفحة الحالية';
    const trimmed = value.split('|')[0].split('—')[0].split('-')[0].trim();
    return trimmed.replace(/[^A-Za-z0-9\u0600-\u06FF\s()]/g, '').trim() || 'الصفحة الحالية';
  };

  const resolveGuide = () => {
    const path = (window.location.pathname || '').replace(/\\/g, '/').toLowerCase();
    const match = Object.values(PAGE_GUIDES).find((item) => item.test(path));
    if (match) return match;
    return {
      title: `دليل ${cleanTitle(document.title)}`,
      subtitle: 'شرح موجز يساعدك على فهم الصفحة وخطوات الاستخدام.',
      purpose: `تُستخدم هذه الصفحة لـ ${cleanTitle(document.title)}.`,
      tips: ['استخدم زر الرجوع للعودة، ودليل الصفحة لفهم الأزرار والحقول.'],
    };
  };

  const describeButton = (label) => {
    const normalized = normalizeText(label).toLowerCase();
    if (!normalized) return 'تنفيذ الإجراء الموضح على الزر.';
    if (normalized.includes('دخول') || normalized.includes('login')) return 'تسجيل الدخول إلى الحساب.';
    if (normalized.includes('خروج') || normalized.includes('logout')) return 'إنهاء الجلسة الحالية.';
    if (normalized.includes('حساب') || normalized.includes('انضم')) return 'طلب إنشاء حساب أو الانضمام للمنصة.';
    if (normalized.includes('عمليات') || normalized.includes('dashboard')) return 'فتح غرفة العمليات المباشرة.';
    if (normalized.includes('إعادة') || normalized.includes('تحديث')) return 'تحديث البيانات المعروضة.';
    if (normalized.includes('تصفير') || normalized.includes('reset')) return 'إعادة ضبط البيانات التجريبية.';
    if (normalized.includes('حفظ') || normalized.includes('save')) return 'حفظ التغييرات.';
    if (normalized.includes('رجوع') || normalized.includes('عودة')) return 'العودة للصفحة السابقة.';
    return 'تنفيذ الإجراء الموضح على الزر.';
  };

  const collectButtons = () => {
    const labels = [];
    document.querySelectorAll('button, a.auth-btn, a.law-btn-primary, a.law-btn-ghost, a.btn').forEach((el) => {
      if (el.id === 'hub-guide-button' || el.id === 'hub-back-button' || el.id === 'hub-guide-close') return;
      const label = normalizeText(el.textContent);
      if (!label || label.length > 40) return;
      if (!labels.includes(label)) labels.push(label);
    });
    return labels.slice(0, 5).map((label) => `${label}: ${describeButton(label)}`);
  };

  const collectFields = () => {
    const labels = [];
    document.querySelectorAll('label').forEach((labelEl) => {
      const label = normalizeText(labelEl.textContent);
      if (!label || label.length > 40) return;
      if (!labels.includes(label)) labels.push(label);
    });
    if (labels.length < 2) {
      document.querySelectorAll('input[placeholder], textarea[placeholder], select').forEach((input) => {
        const placeholder = normalizeText(input.getAttribute('placeholder'));
        const label = placeholder || normalizeText(input.getAttribute('aria-label'));
        if (!label || label.length > 40) return;
        if (!labels.includes(label)) labels.push(label);
      });
    }
    return labels.slice(0, 4).map((label) => `${label}: لإدخال أو تصفية البيانات المرتبطة بالحقل.`);
  };

  const buildSection = (title, items) => {
    const section = document.createElement('div');
    section.className = 'hub-guide-section';
    const header = document.createElement('h3');
    header.textContent = title;
    section.appendChild(header);
    const list = document.createElement('ul');
    items.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
    section.appendChild(list);
    return section;
  };

  const init = () => {
    if (document.getElementById('hub-guide-root')) return;

    const root = document.createElement('div');
    root.id = 'hub-guide-root';
    root.innerHTML = `
      <button id="hub-guide-button" class="hub-guide-button" type="button" aria-label="دليل تعريفي">دليل</button>
      <div id="hub-guide-overlay" class="hub-guide-overlay" aria-hidden="true"></div>
      <aside id="hub-guide-panel" class="hub-guide-panel" role="dialog" aria-modal="true" aria-hidden="true">
        <div class="hub-guide-header">
          <div>
            <div id="hub-guide-title" class="hub-guide-title"></div>
            <div id="hub-guide-subtitle" class="hub-guide-subtitle"></div>
          </div>
          <button id="hub-guide-close" class="hub-guide-close" type="button" aria-label="إغلاق الدليل">×</button>
        </div>
        <div id="hub-guide-body" class="hub-guide-body"></div>
      </aside>
    `;
    document.body.appendChild(root);

    const button = document.getElementById('hub-guide-button');
    const panel = document.getElementById('hub-guide-panel');
    const overlay = document.getElementById('hub-guide-overlay');
    const titleEl = document.getElementById('hub-guide-title');
    const subtitleEl = document.getElementById('hub-guide-subtitle');
    const bodyEl = document.getElementById('hub-guide-body');
    const closeButton = document.getElementById('hub-guide-close');

    const updateGuide = () => {
      const guide = resolveGuide();
      titleEl.textContent = guide.title;
      subtitleEl.textContent = guide.subtitle;
      button.setAttribute('aria-label', guide.title);

      bodyEl.innerHTML = '';
      bodyEl.appendChild(buildSection('الهدف من الصفحة', [guide.purpose]));
      bodyEl.appendChild(
        buildSection(
          'أهم الإجراءات',
          collectButtons().length ? collectButtons() : ['لا توجد أزرار تشغيل ظاهرة في هذه الصفحة.']
        )
      );
      bodyEl.appendChild(
        buildSection(
          'الحقول والفلاتر',
          collectFields().length ? collectFields() : ['لا توجد حقول إدخال بارزة في هذه الصفحة.']
        )
      );
      bodyEl.appendChild(buildSection('نصائح سريعة', guide.tips || ['استخدم زر الرجوع ودليل الصفحة للتنقّل بثقة.']));
    };

    const setOpen = (isOpen) => {
      document.body.classList.toggle('hub-guide-open', isOpen);
      panel.setAttribute('aria-hidden', String(!isOpen));
      overlay.setAttribute('aria-hidden', String(!isOpen));
    };

    button.addEventListener('click', () => {
      updateGuide();
      setOpen(true);
    });
    closeButton.addEventListener('click', () => setOpen(false));
    overlay.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setOpen(false);
    });

    updateGuide();
  };

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
