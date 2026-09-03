/**
 * قائمة قدرات نايوش هوب — ملف 07
 * «هوب = …» مع حالة التنفيذ وروابط الصفحات
 */
(() => {
  'use strict';

  const CORE_ITEMS = [
    { id: 'c01', label: 'الواجهة الرئيسية وصفحة الهبوط', status: 'done', href: 'index.html', hrefLabel: 'الرئيسية' },
    { id: 'c02', label: 'مركز تشغيل جميع أنظمة الإمبراطورية', status: 'partial', href: 'operating.html', hrefLabel: 'آلية التشغيل' },
    { id: 'c03', label: 'مركز الدخول على جميع الأنظمة', status: 'partial', href: 'login.html', hrefLabel: 'تسجيل الدخول' },
    { id: 'c04', label: 'منح الفروع والحاضنات والمنصات والمكاتب', status: 'partial', href: 'branches.html', hrefLabel: 'الفروع' },
    { id: 'c05', label: 'منح الصلاحيات والأدوار لجميع الأنظمة', status: 'partial', href: 'dashboard.html', hrefLabel: 'غرفة العمليات' },
    { id: 'c06', label: 'اشتراك أو شراء يمنح صلاحية الطبقة/النظام', status: 'partial', href: 'membership.html', hrefLabel: 'العضوية' },
    { id: 'c07', label: 'إظهار نشاط النظام عبر التقارير والصفحات', status: 'partial', href: 'dashboard.html', hrefLabel: 'التقارير' },
    { id: 'c08', label: 'الصفحة الرئيسية لإعلانات المنصات', status: 'partial', href: 'ads.html', hrefLabel: 'الإعلانات' },
    { id: 'c09', label: 'عرض جميع منتجات الإمبراطورية', status: 'partial', href: 'products.html', hrefLabel: 'المنتجات' },
    { id: 'c10', label: 'عرض جميع فعاليات الإمبراطورية', status: 'partial', href: 'events.html', hrefLabel: 'الفعاليات' },
    { id: 'c11', label: 'عرض الفروع · الحاضنات · المنصات · المكاتب', status: 'partial', href: 'platforms.html', hrefLabel: 'المنصات' },
    { id: 'c12', label: 'انضم لإمبراطورية نايوش / انضم لنظام المستأجر', status: 'partial', href: 'trial.html', hrefLabel: 'التجربة' },
    { id: 'c13', label: 'مركز المعلومات والسياسات والتشغيل', status: 'done', href: 'info-center.html', hrefLabel: 'مركز المعرفة' },
    { id: 'c14', label: 'المدونة العامة للإمبراطورية', status: 'partial', href: 'blog.html', hrefLabel: 'المدونة' },
    { id: 'c15', label: 'عرض باقات الاشتراك في جميع الأنظمة', status: 'partial', href: 'packages.html', hrefLabel: 'الباقات' },
    { id: 'c16', label: 'العضوية الموحدة لجميع الأنظمة والدومينات', status: 'partial', href: 'membership.html', hrefLabel: 'العضوية الموحدة' },
    { id: 'c17', label: 'عرض الدبلومات وإعادة التوجيه للأكاديمية', status: 'partial', href: 'systems/academy.html', hrefLabel: 'الأكاديمية' },
    { id: 'c18', label: 'عرض الدورات وإعادة التوجيه للنظام التدريبي', status: 'partial', href: 'systems/lms.html', hrefLabel: 'LMS' },
    { id: 'c19', label: 'الدردشة الداخلية الآمنة', status: 'partial', href: 'chat.html', hrefLabel: 'الدردشة' },
    { id: 'c20', label: 'غرفة العمليات · الصيانة والدعم الفني', status: 'partial', href: 'support.html', hrefLabel: 'الدعم والصيانة' },
    { id: 'c21', label: 'تسجيل الدخول للوحة التحكم والتوجيه للأنظمة', status: 'partial', href: 'login.html', hrefLabel: 'الدخول' },
    { id: 'c22', label: 'إنشاء حساب وتوحيد الدخول حسب الصلاحية', status: 'partial', href: 'login.html', hrefLabel: 'إنشاء حساب' },
    { id: 'c23', label: 'منح رصيد مجاني للمستخدم', status: 'partial', href: 'packages.html', hrefLabel: 'الرصيد المجاني' },
    { id: 'c24', label: 'شحن الرصيد الموحد لجميع الأنظمة', status: 'partial', href: 'packages.html', hrefLabel: 'شحن الرصيد' },
    { id: 'c25', label: 'الدخول المباشر لفرع المستأجر', status: 'partial', href: 'my-branch.html', hrefLabel: 'فرعي' },
    { id: 'c26', label: 'الدخول المباشر للحاضنة', status: 'partial', href: 'incubators.html', hrefLabel: 'الحاضنات' },
    { id: 'c27', label: 'الدخول المباشر لحاضنة المستأجر', status: 'partial', href: 'incubators.html', hrefLabel: 'حاضنة المستأجر' },
    { id: 'c28', label: 'الدخول المباشر لمنصة المستأجر', status: 'partial', href: 'platforms.html', hrefLabel: 'منصة المستأجر' },
    { id: 'c29', label: 'الدخول المباشر لمكتب موظفي المنصة', status: 'partial', href: 'office.html', hrefLabel: 'مكتبي' },
    { id: 'c30', label: 'الدخول المباشر لإعلانات المستأجر', status: 'partial', href: 'ads.html', hrefLabel: 'إعلانات المستأجر' },
    { id: 'c31', label: 'الدخول المباشر لمنتجات المستأجر', status: 'partial', href: 'products.html', hrefLabel: 'منتجات المستأجر' },
    { id: 'c32', label: 'الدخول المباشر لصفحة الشراكات', status: 'partial', href: 'partnerships.html', hrefLabel: 'شراكاتي' },
    { id: 'c33', label: 'الدخول المباشر لقائمة عملاء المستأجر', status: 'partial', href: 'systems/crm.html', hrefLabel: 'CRM' },
    { id: 'c34', label: 'الدخول المباشر لمنصة دورات المستأجر', status: 'partial', href: 'courses.html', hrefLabel: 'دورات المستأجر' },
    { id: 'c35', label: 'الدخول المباشر لمنصة دبلومات المستأجر', status: 'partial', href: 'diplomas.html', hrefLabel: 'دبلومات المستأجر' },
    { id: 'c36', label: 'الدخول المباشر للدردشة الخاصة بالمستأجر', status: 'partial', href: 'chat.html', hrefLabel: 'دردشة المستأجر' },
    { id: 'c37', label: 'سلة المشتريات من متاجر الإمبراطورية', status: 'partial', href: 'cart.html', hrefLabel: 'السلة' },
    { id: 'c38', label: 'الاطلاع على جميع مواقع الإمبراطورية', status: 'partial', href: 'apps.html', hrefLabel: 'استكشاف المواقع' },
    { id: 'c39', label: 'استكشاف منصات الأنظمة', status: 'partial', href: 'apps.html', hrefLabel: 'الأنظمة' },
    { id: 'c40', label: 'استعراض مواقع نايوش حسب الصلاحيات', status: 'partial', href: 'apps.html', hrefLabel: 'سجل الأنظمة' },
    { id: 'c41', label: 'ربط الفروع بالحاضنات والمنصات في بيئة واحدة', status: 'partial', href: 'user-path.html', hrefLabel: 'مسار المستخدم' },
    { id: 'c42', label: 'تدفق البيانات والمعلومات حسب الصلاحيات', status: 'partial', href: 'operating.html', hrefLabel: 'التدفق' },
    { id: 'c43', label: 'جميع المسارات التنفيذية للأنظمة', status: 'partial', href: 'ops-manuals.html', hrefLabel: 'الأدلة' },
    { id: 'c44', label: 'المنصات السيادية العالمية لنايوش 360', status: 'partial', href: 'platforms.html', hrefLabel: 'المنصات السيادية' },
    { id: 'c45', label: 'مراحل التأسيس · التشغيل · السيادية · مطبخ التشغيل', status: 'partial', href: 'operating.html', hrefLabel: 'المراحل' },
    { id: 'c46', label: 'ستوديو الفعاليات', status: 'partial', href: 'events.html', hrefLabel: 'الفعاليات' },
    { id: 'c47', label: 'استوديو التسويق الإلكتروني', status: 'partial', href: 'ads.html', hrefLabel: 'التسويق' },
    { id: 'c48', label: 'السياسات والإجراءات · الخصوصية · أمن المعلومات', status: 'done', href: 'policies.html', hrefLabel: 'السياسات' },
    { id: 'c49', label: 'رفع التقارير للمستشارين ودراسة المشاريع', status: 'missing', href: null, hrefLabel: null },
    { id: 'c50', label: 'طلب المساعدة المفتوحة من جميع الأعضاء', status: 'partial', href: 'support.html', hrefLabel: 'الدعم' },
    { id: 'c51', label: 'ثقافة المجتمعات وندوات المعرفة', status: 'partial', href: 'blog.html', hrefLabel: 'المجتمع' },
    { id: 'c52', label: 'مركز تدريب وتعليم واكتساب المهارات', status: 'partial', href: 'info-center.html', hrefLabel: 'التدريب' },
    { id: 'c53', label: 'دليل التشغيل لجميع الأنظمة والمنصات', status: 'done', href: 'ops-manuals.html', hrefLabel: 'الأدلة' },
    { id: 'c54', label: 'مركز الإشعارات', status: 'partial', href: 'dashboard.html', hrefLabel: 'الإشعارات' },
    { id: 'c55', label: 'مركز التحكم السيادي', status: 'partial', href: 'dashboard.html', hrefLabel: 'التحكم السيادي' },
    { id: 'c56', label: 'العاصمة السيادية والإدارية للإمبراطورية', status: 'partial', href: 'index.html', hrefLabel: 'العاصمة' },
    { id: 'c57', label: 'سجل العمليات للطبقات والمحاور السيادية', status: 'partial', href: 'directives.html', hrefLabel: 'سجل التوجيه' },
    { id: 'c58', label: 'الهيكل التنظيمي لجميع المكونات', status: 'partial', href: 'branches.html', hrefLabel: 'الهيكل' },
    { id: 'c59', label: 'محفظة وحاسبة النقاط والاشتراكات', status: 'partial', href: 'packages.html', hrefLabel: 'المحفظة' },
    { id: 'c60', label: 'العقل المركز لاتخاذ القرارات التشغيلية', status: 'partial', href: 'directives.html', hrefLabel: 'التوجيه المركزي' },
    { id: 'c61', label: 'الذكاء الاصطناعي للحلول التشغيلية', status: 'partial', href: 'info-center.html', hrefLabel: 'اسأل نايوش' },
    { id: 'c62', label: 'حوكمة البيانات', status: 'partial', href: 'quality.html', hrefLabel: 'الجودة' },
    { id: 'c63', label: 'الأتمتة الشمولية لجميع المكونات', status: 'partial', href: 'operating.html', hrefLabel: 'الأتمتة' },
    { id: 'c64', label: 'القياس الموحد ودرجات الأداء المئوية', status: 'partial', href: 'dashboard.html', hrefLabel: 'القياس' },
    { id: 'c65', label: 'وعاء استقبال وتصدير البيانات', status: 'partial', href: 'engine-specs.html', hrefLabel: 'التكامل' },
    { id: 'c66', label: 'المهام التنفيذية لجميع المستخدمين', status: 'partial', href: 'office.html', hrefLabel: 'مكتبي' },
    { id: 'c67', label: 'إصدار التقارير الرقابية وقياس الأداء', status: 'partial', href: 'dashboard.html', hrefLabel: 'التقارير الرقابية' },
    { id: 'c68', label: 'مؤشر الاختناقات وإيجاد الحلول', status: 'partial', href: 'support.html', hrefLabel: 'الدعم' },
    { id: 'c69', label: 'مزامنة الأنظمة واعتمادها وتوزيع الصلاحيات', status: 'partial', href: 'apps.html', hrefLabel: 'المزامنة' },
    { id: 'c70', label: 'التكامل والموائمة مع المكونات الداخلية والخارجية', status: 'partial', href: 'engine-specs.html', hrefLabel: 'المواصفات' },
    { id: 'c71', label: 'مسار المستخدم العملي لتسهيل التشغيل', status: 'done', href: 'user-path.html', hrefLabel: 'مسار المستخدم' },
  ];

  const ITEMS = [...(window.HubInfoCenterPages?.toChecklistItems?.() || []), ...CORE_ITEMS];

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];

  const statusLabel = (s) => ({ done: 'تم', partial: 'جزئي', missing: 'لسه' }[s] || s);

  let statusFilter = 'all';

  const renderKpis = () => {
    const root = qs('[data-hcl-kpis]');
    if (!root) return;
    const done = ITEMS.filter((i) => i.status === 'done').length;
    const partial = ITEMS.filter((i) => i.status === 'partial').length;
    const missing = ITEMS.filter((i) => i.status === 'missing').length;
    root.innerHTML = [
      { n: ITEMS.length, l: 'قدرة في القائمة' },
      { n: done, l: 'تم' },
      { n: partial, l: 'جزئي' },
      { n: missing, l: 'لسه' },
      { n: ITEMS.filter((i) => i.href).length, l: 'لها رابط' },
    ]
      .map((i) => `<article class="hcl-kpi"><strong>${i.n}</strong><span>${i.l}</span></article>`)
      .join('');
  };

  const renderList = () => {
    const list = qs('[data-hcl-list]');
    if (!list) return;
    const q = (qs('[data-hcl-q]')?.value || '').trim().toLowerCase();
    const rows = ITEMS.filter((item) => {
      const okS = statusFilter === 'all' || item.status === statusFilter;
      const hay = `${item.label} ${item.hrefLabel || ''} ${item.keywords || ''} ${item.href || ''} مركز المعلومات`.toLowerCase();
      return okS && (!q || hay.includes(q));
    });
    if (!rows.length) {
      list.innerHTML = '<div class="hcl-empty">لا توجد قدرات مطابقة.</div>';
      return;
    }
    list.innerHTML = rows
      .map(
        (item) => `
      <article class="hcl-card">
        <header>
          <h3>هوب = ${item.label}</h3>
          <span class="hcl-badge hcl-badge--${item.status}">${statusLabel(item.status)}</span>
        </header>
        <p>حالة التنفيذ في الموقع الحالي — ${statusLabel(item.status)}</p>
        ${item.href ? `<a class="hcl-link" href="${item.href}"><i class="fas fa-link"></i> ${item.hrefLabel}</a>` : '<span class="hcl-badge hcl-badge--missing">بلا رابط بعد</span>'}
      </article>`
      )
      .join('');
  };

  const init = () => {
    if (!qs('[data-hcl-root]')) return;
    renderKpis();
    renderList();
    qs('[data-hcl-q]')?.addEventListener('input', renderList);
    qsa('[data-hcl-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        qsa('[data-hcl-filter]').forEach((b) => b.classList.toggle('is-active', b === btn));
        statusFilter = btn.getAttribute('data-hcl-filter');
        renderList();
      });
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.HubChecklist = { ITEMS };
})();
