/**
 * كتالوج أكاديمية نايوش — دورات · دبلومات · مسارات تعلم
 * يُعرض في courses.html و diplomas.html ويُغذي متجر الأكاديمية.
 */
(() => {
  'use strict';

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const COURSES = [
    {
      id: 'course-ops',
      storeId: 'st-ac-1',
      title: 'دورة التشغيل السيادي',
      level: 'تأسيسي',
      duration: '٤ أسابيع',
      hours: '١٦ ساعة',
      points: 80,
      price: 650,
      audience: 'مدراء تشغيل · مسؤولو فروع',
      icon: 'fa-gears',
      outcomes: ['تشغيل مكتب إلكتروني داخل هوب', 'قراءة مؤشرات غرفة العمليات', 'تفعيل مسار فرع أو منصة'],
      modules: ['مدخل هوب 360', 'المكتب الإلكتروني', 'الرصيد والنقاط', 'لوحة التشغيل اليومية'],
      desc: 'مسار عملي يحوّل المبتدئ إلى مشغّل واثق لأنظمة نايوش داخل هوب — من الدخول الموحّد حتى رفع البيانات.',
    },
    {
      id: 'course-gov',
      storeId: 'st-ac-2',
      title: 'دورة الحوكمة والامتثال',
      level: 'متوسط',
      duration: '٥ أسابيع',
      hours: '٢٠ ساعة',
      points: 100,
      price: 890,
      audience: 'مسؤولو جودة · حوكمة · امتثال',
      icon: 'fa-scale-balanced',
      outcomes: ['بناء سياسة امتثال للمنصة', 'ربط التقارير بجودة التشغيل', 'إعداد مسار مراجعة دوري'],
      modules: ['إطار الحوكمة', 'الضوابط التشغيلية', 'تقارير الامتثال', 'حالة دراسية حية'],
      desc: 'برنامج معتمد يضبط الامتثال داخل الفروع والمنصات، ويربط الجودة بقرارات غرفة العمليات.',
    },
    {
      id: 'course-trainers',
      storeId: 'st-ac-3',
      title: 'ورشة المدربين السياديين',
      level: 'متقدم',
      duration: '٣ أسابيع',
      hours: '١٢ ساعة',
      points: 150,
      price: 1200,
      audience: 'مدربون · قادة معرفة',
      icon: 'fa-chalkboard-user',
      outcomes: ['تصميم ورشة تشغيلية', 'تقييم المتدربين داخل LMS', 'إصدار شهادات عبر الأكاديمية'],
      modules: ['تصميم المحتوى', 'تيسير الجلسات', 'التقييم والشهادات', 'ربط المتجر بالتسجيل'],
      desc: 'ورشة مكثّفة لتأهيل مدربين يشغّلون دورات نايوش داخل الأكاديمية والمتجر الموحّد.',
    },
    {
      id: 'course-crm',
      storeId: 'st-ac-4',
      title: 'دورة إدارة العملاء CRM',
      level: 'تأسيسي',
      duration: '٣ أسابيع',
      hours: '١٢ ساعة',
      points: 90,
      price: 720,
      audience: 'مبيعات · دعم · علاقات',
      icon: 'fa-users',
      outcomes: ['بناء خط مبيعات', 'متابعة العملاء المحتملين', 'ربط الدعم بإشعارات هوب'],
      modules: ['العملاء المحتملون', 'خط الأنابيب', 'الدعم والتذاكر', 'تقارير التحويل'],
      desc: 'تعلّم تشغيل CRM نايوش من داخل هوب: من أول عميل محتمل حتى إغلاق الصفقة والدعم.',
    },
    {
      id: 'course-data',
      storeId: 'st-ac-5',
      title: 'دورة قراءة لوحات البيانات',
      level: 'متوسط',
      duration: '٤ أسابيع',
      hours: '١٤ ساعة',
      points: 110,
      price: 950,
      audience: 'محللون · قادة قرار',
      icon: 'fa-chart-line',
      outcomes: ['قراءة KPI لحظي', 'كشف الشذوذ مبكرًا', 'تقرير أسبوعي لغرفة العمليات'],
      modules: ['مؤشرات السيادة', 'التنبؤات', 'الشذوذ', 'تقرير القرار'],
      desc: 'مسار يحوّل الأرقام إلى قرارات: قراءة لوحات نايوش، التنبؤ، والتنبيه قبل تفاقم المخاطر.',
    },
    {
      id: 'course-security',
      storeId: 'st-ac-6',
      title: 'دورة أمن الهوية والصلاحيات',
      level: 'متوسط',
      duration: '٣ أسابيع',
      hours: '١٠ ساعات',
      points: 120,
      price: 980,
      audience: 'أمن معلومات · مسؤولو أنظمة',
      icon: 'fa-shield-halved',
      outcomes: ['ضبط SSO وNAIOSH ID', 'تصميم صلاحيات RBAC', 'مراجعة وصول الاشتراكات'],
      modules: ['الهوية الموحّدة', 'الصلاحيات', 'الاشتراك والوصول', 'مراجعة أمنية'],
      desc: 'دورة عملية لحماية الدخول الموحّد والصلاحيات عبر هوب دون تعطيل التشغيل اليومي.',
    },
  ];

  const DIPLOMAS = [
    {
      id: 'dip-ops-leader',
      storeId: 'st-dip-1',
      title: 'دبلوم قيادة التشغيل',
      level: 'احترافي',
      duration: '١٢ أسبوعًا',
      hours: '٤٨ ساعة',
      points: 420,
      price: 3800,
      audience: 'مديرو فروع · قادة منصات',
      icon: 'fa-flag',
      outcomes: ['قيادة مكتب إلكتروني متعدد الأنظمة', 'خطة تشغيل ربع سنوية', 'تقارير سيادة لغرفة العمليات'],
      tracks: ['تشغيل هوب', 'الحوكمة', 'القيادة الميدانية', 'مشروع تخرج تطبيقي'],
      desc: 'مسار دبلوم يبني قائد تشغيل قادر على إدارة فرع أو منصة داخل منظومة نايوش من البداية للنضج.',
    },
    {
      id: 'dip-governance',
      storeId: 'st-dip-2',
      title: 'دبلوم الحوكمة المؤسسية',
      level: 'احترافي',
      duration: '١٤ أسبوعًا',
      hours: '٥٦ ساعة',
      points: 480,
      price: 4200,
      audience: 'لجان امتثال · جودة · تدقيق',
      icon: 'fa-landmark',
      outcomes: ['إطار حوكمة كامل للمنصة', 'دليل سياسات وإجراءات', 'لوحة امتثال مرتبطة بالـKPI'],
      tracks: ['الإطار النظري', 'الضوابط', 'التدقيق الداخلي', 'مشروع امتثال حي'],
      desc: 'دبلوم معتمد يعمّق الامتثال والجودة ويربط السياسات بتشغيل الأنظمة داخل هوب.',
    },
    {
      id: 'dip-digital-office',
      storeId: 'st-dip-3',
      title: 'دبلوم المكتب الإلكتروني',
      level: 'تطبيقي',
      duration: '١٠ أسابيع',
      hours: '٤٠ ساعة',
      points: 360,
      price: 3100,
      audience: 'منسقو مكاتب · إداريون',
      icon: 'fa-briefcase',
      outcomes: ['تشغيل مكتب إلكتروني يوميًا', 'إدارة الطلبات والإشعارات', 'ربط الفروع والحاضنات'],
      tracks: ['المكتب والهوية', 'الخدمات', 'التكامل', 'مشروع مكتب حي'],
      desc: 'مسار دبلوم يركّز على تشغيل المكتب الإلكتروني كوحدة إنتاج يومية داخل نايوش هوب.',
    },
    {
      id: 'dip-academy-trainer',
      storeId: 'st-dip-4',
      title: 'دبلوم إعداد المدرب المعتمد',
      level: 'متقدم',
      duration: '١٢ أسبوعًا',
      hours: '٤٤ ساعة',
      points: 400,
      price: 3500,
      audience: 'مدربون · مسؤولو معرفة',
      icon: 'fa-user-graduate',
      outcomes: ['تصميم منهج دورة كاملة', 'إدارة تقييمات LMS', 'إصدار شهادات عبر الأكاديمية'],
      tracks: ['تصميم التعلم', 'التيسير', 'التقييم', 'مشروع منهج منشور'],
      desc: 'يؤهّل مدربًا معتمدًا لبناء وتيسير دورات نايوش وربطها بالمتجر والشهادات.',
    },
    {
      id: 'dip-data-decision',
      storeId: 'st-dip-5',
      title: 'دبلوم قرارات البيانات',
      level: 'احترافي',
      duration: '١١ أسبوعًا',
      hours: '٤٢ ساعة',
      points: 390,
      price: 3400,
      audience: 'محللو قرار · قادة تشغيل',
      icon: 'fa-brain',
      outcomes: ['نموذج قرار مبني على KPI', 'نظام تنبيه مبكر', 'تقرير سيادي شهري'],
      tracks: ['مؤشرات', 'تنبؤ', 'مخاطر', 'مشروع لوحة قرار'],
      desc: 'دبلوم يربط تحليل البيانات بقرارات غرفة العمليات — من اللوحة إلى التنفيذ.',
    },
    {
      id: 'dip-ecosystem',
      storeId: 'st-dip-6',
      title: 'دبلوم منظومة هوب المتكاملة',
      level: 'سيادي',
      duration: '١٦ أسبوعًا',
      hours: '٦٤ ساعة',
      points: 560,
      price: 5200,
      audience: 'قادة إمبراطورية · مدراء عموم',
      icon: 'fa-sitemap',
      outcomes: ['خريطة تشغيل للمنظومة كاملة', 'خطة تكامل أنظمة', 'حوكمة اشتراكات وصلاحيات'],
      tracks: ['الطبقات', 'الأنظمة', 'التكامل', 'مشروع خريطة سيادة'],
      desc: 'أعلى مسار دبلوم: فهم وتشغيل طبقات نايوش هوب 360 كمنظومة واحدةة بلا تكرار.',
    },
  ];

  const COURSE_PATHS = [
    {
      title: 'مسار المشغّل الجديد',
      desc: 'من أول دخول لهوب حتى تشغيل يومي واثق.',
      steps: ['دورة التشغيل السيادي', 'دورة إدارة العملاء', 'ورشة المدربين (اختياري)'],
      cta: { label: 'ابدأ المسار', href: 'store.html?buy=st-ac-1' },
    },
    {
      title: 'مسار الحوكمة والجودة',
      desc: 'ضبط الامتثال وربط التقارير بغرفة العمليات.',
      steps: ['دورة الحوكمة والامتثال', 'دورة قراءة لوحات البيانات', 'دورة أمن الهوية'],
      cta: { label: 'اشترِ دورة الحوكمة', href: 'store.html?buy=st-ac-2' },
    },
    {
      title: 'مسار قائد المعرفة',
      desc: 'تأهيل مدربين ومحتوى قابل للنشر في الأكاديمية.',
      steps: ['ورشة المدربين السياديين', 'دورة التشغيل', 'الانتقال لدبلوم المدرب'],
      cta: { label: 'سجّل الورشة', href: 'store.html?buy=st-ac-3' },
    },
  ];

  const DIPLOMA_PATHS = [
    {
      title: 'مسار قائد الفرع',
      desc: 'دبلوم تشغيل + مكتب إلكتروني لقيادة فرع أو منصة.',
      steps: ['دبلوم قيادة التشغيل', 'دبلوم المكتب الإلكتروني', 'مشروع تخرج ميداني'],
      cta: { label: 'سجّل دبلوم التشغيل', href: 'store.html?buy=st-dip-1' },
    },
    {
      title: 'مسار الامتثال السيادي',
      desc: 'حوكمة عميقة مرتبطة بمؤشرات القرار.',
      steps: ['دبلوم الحوكمة المؤسسية', 'دبلوم قرارات البيانات', 'لوحة امتثال حية'],
      cta: { label: 'سجّل دبلوم الحوكمة', href: 'store.html?buy=st-dip-2' },
    },
    {
      title: 'مسار المنظومة الكاملة',
      desc: 'لمن يقود أكثر من نظام ويريد خريطة سيادة بلا تكرار.',
      steps: ['دبلوم منظومة هوب', 'دبلوم إعداد المدرب', 'اعتماد سيادي'],
      cta: { label: 'سجّل الدبلوم السيادي', href: 'store.html?buy=st-dip-6' },
    },
  ];

  const metaRow = (item) => `
    <div class="hub-learn-meta" aria-label="تفاصيل البرنامج">
      <span><i class="fas fa-layer-group"></i> ${esc(item.level)}</span>
      <span><i class="fas fa-calendar"></i> ${esc(item.duration)}</span>
      <span><i class="fas fa-clock"></i> ${esc(item.hours)}</span>
      <span><i class="fas fa-user"></i> ${esc(item.audience)}</span>
    </div>
  `;

  const listBlock = (title, items) => `
    <div class="hub-learn-list">
      <strong>${esc(title)}</strong>
      <ul>${(items || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    </div>
  `;

  const renderProgramCard = (item, kind) => {
    const listTitle = kind === 'diploma' ? 'مسارات الدبلوم' : 'المحاور';
    const listItems = kind === 'diploma' ? item.tracks : item.modules;
    return `
      <article class="hub-feature-card hub-learn-card" data-learn-id="${esc(item.id)}">
        <div class="hub-learn-card-top">
          <span class="hub-learn-icon" aria-hidden="true"><i class="fas ${esc(item.icon)}"></i></span>
          <h3>${esc(item.title)}</h3>
        </div>
        <div class="price"><i class="fas fa-coins"></i> ${esc(String(item.points))} نقطة · ${esc(String(item.price))} ج.م</div>
        ${metaRow(item)}
        <p>${esc(item.desc)}</p>
        ${listBlock('ماذا تتقن؟', item.outcomes)}
        ${listBlock(listTitle, listItems)}
        <div class="hub-feature-actions">
          <a class="btn btn-primary" href="store.html?buy=${encodeURIComponent(item.storeId)}"><i class="fas fa-cart-plus"></i> سجّل الآن</a>
          <a class="btn btn-secondary" href="systems/academy.html?from=hub&return=${kind === 'diploma' ? 'diplomas' : 'courses'}.html#${kind === 'diploma' ? 'diplomas' : 'courses'}"><i class="fas fa-chalkboard-user"></i> افتح الأكاديمية</a>
        </div>
      </article>
    `;
  };

  const renderPathCard = (path) => `
    <article class="hub-feature-card">
      <h3>${esc(path.title)}</h3>
      <p>${esc(path.desc)}</p>
      ${listBlock('خطوات المسار', path.steps)}
      <div class="hub-feature-actions">
        <a class="btn btn-primary" href="${esc(path.cta.href)}">${esc(path.cta.label)}</a>
      </div>
    </article>
  `;

  const renderValueCards = (items) =>
    items
      .map(
        (v) => `
      <article class="hub-feature-card">
        <h3><i class="fas ${esc(v.icon)}"></i> ${esc(v.title)}</h3>
        <p>${esc(v.desc)}</p>
      </article>`
      )
      .join('');

  const mountCoursesPage = () => {
    const root = document.querySelector('[data-learn-page="courses"]');
    if (!root) return;

    const values = root.querySelector('[data-learn-values]');
    const catalog = root.querySelector('[data-learn-catalog]');
    const paths = root.querySelector('[data-learn-paths]');
    if (values) {
      values.innerHTML = renderValueCards([
        {
          icon: 'fa-bolt',
          title: 'تعلّم يتحوّل لتشغيل',
          desc: 'كل دورة مربوطة بأنظمة هوب الحقيقية: متجر، مكتب، غرفة عمليات — لا محتوى نظري معزول.',
        },
        {
          icon: 'fa-certificate',
          title: 'تسجيل واعتماد واضح',
          desc: 'سجّل بالنقاط أو الدفع عبر المتجر الموحّد، وادخل الأكاديمية بنفس هوية نايوش.',
        },
        {
          icon: 'fa-route',
          title: 'مسارات لا دورات مبعثرة',
          desc: 'مسارات جاهزة للمشغّل والحوكمة والمدرب — تعرف من أين تبدأ وإلى أين تصل.',
        },
      ]);
    }
    if (catalog) catalog.innerHTML = COURSES.map((c) => renderProgramCard(c, 'course')).join('');
    if (paths) paths.innerHTML = COURSE_PATHS.map(renderPathCard).join('');
  };

  const mountDiplomasPage = () => {
    const root = document.querySelector('[data-learn-page="diplomas"]');
    if (!root) return;

    const values = root.querySelector('[data-learn-values]');
    const catalog = root.querySelector('[data-learn-catalog]');
    const paths = root.querySelector('[data-learn-paths]');
    if (values) {
      values.innerHTML = renderValueCards([
        {
          icon: 'fa-graduation-cap',
          title: 'دبلوم = قدرة قيادية',
          desc: 'مسارات طويلة بمشاريع تخرج تطبيقية على فروع ومنصات حقيقية داخل هوب.',
        },
        {
          icon: 'fa-award',
          title: 'اعتماد مرتبط بالتشغيل',
          desc: 'التخرج يعني إثبات مهارة تشغيلية قابلة للقياس في غرفة العمليات — لا شهادة ورقية فقط.',
        },
        {
          icon: 'fa-sitemap',
          title: 'من المكتب إلى المنظومة',
          desc: 'اختر دبلوم المكتب أو الحوكمة أو المنظومة الكاملة حسب دورك في إمبراطورية نايوش.',
        },
      ]);
    }
    if (catalog) catalog.innerHTML = DIPLOMAS.map((d) => renderProgramCard(d, 'diploma')).join('');
    if (paths) paths.innerHTML = DIPLOMA_PATHS.map(renderPathCard).join('');
  };

  const storeItemsFromCatalog = () => {
    const mapItem = (item, kind) => ({
      id: item.storeId,
      title: item.title,
      desc: item.desc,
      price: item.price,
      points: item.points,
      category: 'أكاديمية',
      platformCode: 'ACADEMY',
      stock: kind === 'diploma' ? 60 : 160,
      status: 'active',
      badge: kind === 'diploma' ? 'دبلوم' : 'دورة',
      itemKind: 'خدمة',
      brand: 'أكاديمية نايوش',
      learnKind: kind,
      learnId: item.id,
    });
    return [...COURSES.map((c) => mapItem(c, 'course')), ...DIPLOMAS.map((d) => mapItem(d, 'diploma'))];
  };

  const mount = () => {
    mountCoursesPage();
    mountDiplomasPage();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  window.HubLearningCatalog = {
    COURSES,
    DIPLOMAS,
    COURSE_PATHS,
    DIPLOMA_PATHS,
    storeItemsFromCatalog,
    mount,
  };
})();
