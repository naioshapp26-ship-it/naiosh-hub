/**
 * منظومة الأدلة التشغيلية — ملف 05
 * لكل إجراء: من يدخل؟ ماذا يرى؟ ماذا يفعل؟ ماذا بعد؟ من يراقب؟
 */
(() => {
  'use strict';

  const MATRIX = [
    { role: 'Super Admin', access: 'جميع المكونات' },
    { role: 'مدير HUB', access: 'التشغيل المركزي' },
    { role: 'مدير فرع', access: 'فرعه فقط' },
    { role: 'مدير حاضنة', access: 'حاضنته' },
    { role: 'مدير منصة', access: 'منصته' },
    { role: 'مدير مكتب', access: 'مكتبه' },
    { role: 'موظف', access: 'ما يحتاجه لعمله' },
    { role: 'مدرب', access: 'أنظمة التدريب' },
    { role: 'متدرب', access: 'ملفه التدريبي' },
    { role: 'عميل', access: 'خدماته' },
    { role: 'زائر', access: 'المحتوى العام' },
  ];

  const MANUALS = [
    {
      id: 'admin',
      title: 'دليل مدير النظام / Super Admin',
      audience: 'مدير النظام · التشغيل · الحوكمة',
      href: 'dashboard.html',
      hrefLabel: 'غرفة العمليات',
      procedures: [
        {
          title: 'إنشاء مستخدم وربطه بالهيكل',
          who: 'مدير HUB / Super Admin',
          sees: 'الهوية · الفروع · الحاضنات · الأدوار',
          does: 'إنشاء حساب → ربط فرع/حاضنة/منصة/مكتب → تعيين دور وأنظمة',
          after: 'NAIOSH ID مفعّل · أيقونات الأنظمة تظهر حسب الصلاحية',
          watches: 'سجل الدخول · تدقيق الصلاحيات',
        },
        {
          title: 'إدارة الاشتراكات والنقاط',
          who: 'مدير HUB · المالية',
          sees: 'باقات · محافظ · معاملات',
          does: 'منح مجاني / شحن / خصم / إرجاع · تنبيه انخفاض الرصيد',
          after: 'تحديث الرصيد وسجل Transaction',
          watches: 'تقارير الاستهلاك · الفواتير',
        },
        {
          title: 'مراقبة الأنظمة والأعطال',
          who: 'مدير التشغيل',
          sees: 'حالة الأنظمة · تذاكر · أداء',
          does: 'استقبال تذكرة → أولوية → توزيع → إغلاق → تقييم',
          after: 'SLA محدّث · درس مستفاد',
          watches: 'زمن الاستجابة · تكرار الأعطال',
        },
      ],
    },
    {
      id: 'branch',
      title: 'دليل مدير الفرع',
      audience: 'مدير الفرع',
      href: 'branches.html',
      hrefLabel: 'الفروع',
      procedures: [
        {
          title: 'اعتماد حاضنة جديدة',
          who: 'مدير الفرع',
          sees: 'طلبات الحاضنات ضمن فرعه',
          does: 'مراجعة الطلب → اعتماد → تعيين مدير حاضنة',
          after: 'حاضنة جاهزة للتخصيص وربط المنصات',
          watches: 'مؤشرات الفرع · جاهزية الحاضنات',
        },
      ],
    },
    {
      id: 'incubator',
      title: 'دليل مدير الحاضنة',
      audience: 'مدير الحاضنة',
      href: 'incubators.html',
      hrefLabel: 'الحاضنات',
      procedures: [
        {
          title: 'إنشاء منصات ومكاتب',
          who: 'مدير الحاضنة',
          sees: 'منصات الحاضنة · المكاتب · الأنظمة الممنوحة',
          does: 'إنشاء منصة → مكاتب → ربط أنظمة → صلاحيات',
          after: 'منصة تشغيلية بمكاتب نشطة',
          watches: 'استخدام المنصات · أخطاء الصلاحيات',
        },
      ],
    },
    {
      id: 'platform',
      title: 'دليل مدير المنصة',
      audience: 'مدير المنصة',
      href: 'platforms.html',
      hrefLabel: 'المنصات',
      procedures: [
        {
          title: 'تشغيل خدمات المنصة',
          who: 'مدير المنصة',
          sees: 'مكاتب المنصة · الخدمات · المستخدمون',
          does: 'تفعيل خدمة → تعيين مسؤول مكتب → متابعة',
          after: 'خدمة متاحة للمستخدمين المخوّلين',
          watches: 'حجم الاستخدام · رضا',
        },
      ],
    },
    {
      id: 'office',
      title: 'دليل مدير المكتب الإلكتروني',
      audience: 'مدير المكتب',
      href: 'dashboard.html',
      hrefLabel: 'غرفة العمليات',
      procedures: [
        {
          title: 'تنفيذ طلبات المكتب',
          who: 'مدير المكتب / موظف',
          sees: 'طوابير الطلبات الخاصة بالمكتب',
          does: 'استلام → تنفيذ → إغلاق مع نتيجة',
          after: 'سجل عملية مكتمل',
          watches: 'زمن الإنجاز · جودة الإغلاق',
        },
      ],
    },
    {
      id: 'trainer',
      title: 'دليل المدرب',
      audience: 'مدرب',
      href: 'info-center.html',
      hrefLabel: 'مركز المعرفة',
      procedures: [
        {
          title: 'نشر مسار تدريبي',
          who: 'مدرب',
          sees: 'المسارات · المتعلمون · نتائج الاختبار',
          does: 'ربط دليل تشغيلي بدورة → اختبار → عتبة إتقان',
          after: 'متعلمون بدرجة مهارة قابلة لمنح صلاحية',
          watches: 'نسبة الإكمال · متوسط الإتقان',
        },
      ],
    },
    {
      id: 'trainee',
      title: 'دليل المتدرب',
      audience: 'متدرب',
      href: 'info-center.html',
      hrefLabel: 'مسارات التعلّم',
      procedures: [
        {
          title: 'إكمال مسار وإثبات المهارة',
          who: 'متدرب',
          sees: 'دوراته · ملفه · المحاكاة',
          does: 'وحدات → اختبار → محاكاة عملية',
          after: 'درجة إتقان · أهلية صلاحية إن تجاوز العتبة',
          watches: 'المتدرب نفسه + المدرب',
        },
      ],
    },
    {
      id: 'client',
      title: 'دليل العميل',
      audience: 'عميل',
      href: 'store.html',
      hrefLabel: 'المتجر',
      procedures: [
        {
          title: 'طلب خدمة واستهلاك نقاط',
          who: 'عميل مسجّل',
          sees: 'خدماته · رصيده · حالة الطلب',
          does: 'اختيار خدمة → تأكيد → خصم نقاط',
          after: 'تنفيذ الخدمة أو تذكرة دعم',
          watches: 'رضا العميل · استهلاك النقاط',
        },
      ],
    },
    {
      id: 'support',
      title: 'دليل الدعم الفني',
      audience: 'الدعم الفني',
      href: 'dashboard.html',
      hrefLabel: 'غرفة العمليات',
      procedures: [
        {
          title: 'معالجة تذكرة دعم',
          who: 'وكيل دعم',
          sees: 'التذاكر · الأولوية · النظام المتأثر',
          does: 'تصنيف → حل / تصعيد → إغلاق مع تقييم',
          after: 'سجل حل + تحديث FAQ إن تكرر',
          watches: 'SLA · تكرار المشكلة',
        },
      ],
    },
    {
      id: 'user',
      title: 'دليل المستخدم العام',
      audience: 'موظف / مستخدم يومي',
      href: 'apps.html',
      hrefLabel: 'تطبيقاتي',
      procedures: [
        {
          title: 'الدخول واستخدام الأنظمة المسموحة',
          who: 'مستخدم بصلاحية',
          sees: 'أيقونات أنظمته فقط',
          does: 'دخول موحّد → فتح نظام → تنفيذ مهمة',
          after: 'نشاط يُرفع لهوب (تقارير/إشعارات)',
          watches: 'مديره المباشر · غرفة العمليات',
        },
      ],
    },
  ];

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];

  const renderMatrix = () => {
    const root = qs('[data-ops-matrix]');
    if (!root) return;
    root.innerHTML = `
      <table>
        <thead><tr><th>الدور</th><th>ما يستطيع الوصول إليه</th></tr></thead>
        <tbody>
          ${MATRIX.map((r) => `<tr><td>${r.role}</td><td>${r.access}</td></tr>`).join('')}
        </tbody>
      </table>
      <p class="ops-note">الصلاحية = الدور + الموقع التنظيمي + النظام + الوظيفة — ليست بالاسم فقط.</p>`;
  };

  const renderNav = () => {
    const root = qs('[data-ops-nav]');
    if (!root) return;
    root.innerHTML = MANUALS.map(
      (m, i) => `<button type="button" class="${i === 0 ? 'is-active' : ''}" data-ops-manual="${m.id}">${m.title}</button>`
    ).join('');
  };

  const renderManual = (id) => {
    const m = MANUALS.find((x) => x.id === id) || MANUALS[0];
    const root = qs('[data-ops-detail]');
    if (!root || !m) return;
    root.innerHTML = `
      <header class="ops-detail-head">
        <div>
          <h2>${m.title}</h2>
          <p>موجّه إلى: ${m.audience}</p>
        </div>
        <a class="primary" href="${m.href}">${m.hrefLabel}</a>
      </header>
      ${m.procedures
        .map(
          (p) => `
        <article class="ops-proc">
          <h3>${p.title}</h3>
          <dl>
            <div><dt>من يدخل؟</dt><dd>${p.who}</dd></div>
            <div><dt>ماذا يرى؟</dt><dd>${p.sees}</dd></div>
            <div><dt>ماذا يفعل؟</dt><dd>${p.does}</dd></div>
            <div><dt>ماذا بعد التنفيذ؟</dt><dd>${p.after}</dd></div>
            <div><dt>من يراقب؟</dt><dd>${p.watches}</dd></div>
          </dl>
        </article>`
        )
        .join('')}`;
  };

  const renderKpis = () => {
    const root = qs('[data-ops-kpis]');
    if (!root) return;
    const procs = MANUALS.reduce((n, m) => n + m.procedures.length, 0);
    root.innerHTML = [
      { n: MANUALS.length, l: 'أدلة تشغيلية' },
      { n: procs, l: 'إجراءات موثّقة' },
      { n: MATRIX.length, l: 'أدوار في المصفوفة' },
    ]
      .map((i) => `<article class="ops-kpi"><strong>${i.n}</strong><span>${i.l}</span></article>`)
      .join('');
  };

  const init = () => {
    if (!qs('[data-ops-root]')) return;
    renderKpis();
    renderMatrix();
    renderNav();
    renderManual(MANUALS[0].id);
    qs('[data-ops-nav]')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ops-manual]');
      if (!btn) return;
      qsa('[data-ops-manual]').forEach((b) => b.classList.toggle('is-active', b === btn));
      renderManual(btn.getAttribute('data-ops-manual'));
    });
    qs('[data-ops-q]')?.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      qsa('[data-ops-manual]').forEach((btn) => {
        const m = MANUALS.find((x) => x.id === btn.getAttribute('data-ops-manual'));
        const hay = `${m?.title} ${m?.audience} ${m?.procedures.map((p) => p.title).join(' ')}`.toLowerCase();
        btn.hidden = Boolean(q) && !hay.includes(q);
      });
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.HubOpsManuals = { MANUALS, MATRIX };
})();
