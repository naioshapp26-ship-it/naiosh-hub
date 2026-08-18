/**
 * مكتبة الأوصاف الوظيفية — ملف 09
 */
(() => {
  'use strict';

  const CATEGORIES = [
    { id: 'all', label: 'كل الفئات' },
    { id: 'sales', label: 'مبيعات' },
    { id: 'finance', label: 'مالية' },
    { id: 'tech', label: 'تقنية' },
    { id: 'admin', label: 'إدارية' },
    { id: 'medical', label: 'طبية' },
    { id: 'legal', label: 'قانونية' },
    { id: 'production', label: 'إنتاج' },
    { id: 'creative', label: 'إبداع' },
    { id: 'logistics', label: 'لوجستية' },
    { id: 'leadership', label: 'قيادة' },
  ];

  const ROLES = [
    { id: 'r01', title: 'عاملة منزلية', cat: 'admin', summary: 'تعرف على دور العاملة المنزلية: المهام اليومية، المهارات المطلوبة، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلة العمل.' },
    { id: 'r02', title: 'طبيب عام', cat: 'medical', summary: 'تعرف على دور طبيب عام: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، وأهم نصائح مقابلات العمل.' },
    { id: 'r03', title: 'مستشار قانوني', cat: 'legal', summary: 'تعرف على دور مستشار قانوني: المهام والمهارات، التدرج الوظيفي، متوسط الرواتب، أسئلة المقابلة، والفرق بينه وبين موظف المبيعات.' },
    { id: 'r04', title: 'مشرف إنتاج', cat: 'production', summary: 'تعرف على دور مشرف إنتاج: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r05', title: 'مدير حسابات', cat: 'finance', summary: 'تعرف على دور مدير حسابات: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r06', title: 'مراقب مخزون', cat: 'logistics', summary: 'تعرف على وظيفة مراقب مخزون: أهم مهامه، استراتيجيات إدارة المخزون بفعالية، تخفيض التكاليف، وأمثلة عملية.' },
    { id: 'r07', title: 'مصمم فيديو', cat: 'creative', summary: 'تعرف على دور مصمم فيديو: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r08', title: 'مصمم موشن جرافيك', cat: 'creative', summary: 'تعرف على دور مصمم موشن جرافيك: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r09', title: 'مشرف مبيعات', cat: 'sales', summary: 'تعرف على دور مشرف مبيعات: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r10', title: 'ممثل مبيعات', cat: 'sales', summary: 'تعرف على دور ممثل مبيعات: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r11', title: 'مدير مبيعات', cat: 'sales', summary: 'تعرف على دور مدير المبيعات: أهمية استراتيجياته في تحقيق الإيرادات، مواجهة التحديات، وأسئلة مقابلة العمل.' },
    { id: 'r12', title: 'تنفيذي مبيعات', cat: 'sales', summary: 'اكتشف كل ما تحتاج معرفته عن تنفيذي المبيعات: المهام، المؤهلات، المهارات، وأسئلة مقابلة العمل.' },
    { id: 'r13', title: 'استشاري مبيعات', cat: 'sales', summary: 'تعرف على دور استشاري المبيعات: المهام والمهارات، التدرج الوظيفي، متوسط الرواتب، أسئلة المقابلة، والفرق بينه وبين موظف المبيعات.' },
    { id: 'r14', title: 'منسق مبيعات', cat: 'sales', summary: 'تعرف على دور منسق مبيعات: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r15', title: 'مندوب مبيعات', cat: 'sales', summary: 'تعرف على دور مندوب مبيعات: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r16', title: 'محاسب', cat: 'finance', summary: 'تعرف على دور محاسب: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r17', title: 'مدير مشتريات', cat: 'logistics', summary: 'تعرف على دور مدير المشتريات: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r18', title: 'مندوب مشتريات', cat: 'logistics', summary: 'تعرف على دور مندوب مشتريات: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r19', title: 'مسؤول مشتريات', cat: 'logistics', summary: 'تعرف على دور مسؤول مشتريات: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r20', title: 'مدير العلاقات العامة', cat: 'admin', summary: 'اكتشف وظيفة مدير العلاقات العامة: أبرز مهامه ومؤهلاته، التدرجات الوظيفية، متوسط الرواتب، وأسئلة المقابلة.' },
    { id: 'r21', title: 'أخصائي علاقات عامة', cat: 'admin', summary: 'تعرف على دور أخصائي علاقات عامة: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r22', title: 'مدير إنتاج', cat: 'production', summary: 'تعرف على دور مدير إنتاج: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r23', title: 'أخصائي موارد بشرية', cat: 'admin', summary: 'تعرف على دور أخصائي موارد بشرية: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r24', title: 'المدير العام', cat: 'leadership', summary: 'تعرف على مهام ومؤهلات المدير العام، التدرج الوظيفي، متوسط الرواتب، وأسئلة المقابلة مع مقارنة بالمدير التنفيذي.' },
    { id: 'r25', title: 'إداري', cat: 'admin', summary: 'تعرف على دور إداري: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r26', title: 'مهندس ميكانيكي', cat: 'tech', summary: 'تعرف على دور مهندس الميكانيكا في تصميم وتطوير الأنظمة الميكانيكية: مهامه، مؤهلاته، مهاراته، وأسئلة المقابلات.' },
    { id: 'r27', title: 'فني ميكانيكي', cat: 'tech', summary: 'تعرف على دور فني الميكانيكا: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r28', title: 'مدير التسويق', cat: 'sales', summary: 'تعرف على دور مدير التسويق: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r29', title: 'أخصائي تسويق', cat: 'sales', summary: 'تعرف على دور أخصائي تسويق: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r30', title: 'محاسب قانوني', cat: 'finance', summary: 'تعرف على مهام المحاسب القانوني والمؤهلات والمهارات، والفرق بينه وبين المحاسب المالي والإداري.' },
    { id: 'r31', title: 'باحث قانوني', cat: 'legal', summary: 'تعرف على دور الباحث القانوني: مهامه، مؤهلاته، مهاراته، رواتب الباحثين القانونيين، ونصائح مقابلات العمل.' },
    { id: 'r32', title: 'سكرتير قانوني', cat: 'legal', summary: 'تعرف على دور سكرتير قانوني: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r33', title: 'المدير الطبي', cat: 'medical', summary: 'تعرف على دور المدير الطبي: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r34', title: 'محاسب مبيعات', cat: 'finance', summary: 'تعرف على مهام محاسب المبيعات ومؤهلاته ومهاراته، والفرق بينه وبين المحاسب العام.' },
    { id: 'r35', title: 'محاسب مالي', cat: 'finance', summary: 'تعرف على مهام المحاسب المالي في المؤسسات ومؤهلاته ومهاراته والفروق بينه وبين المحاسبين الآخرين.' },
    { id: 'r36', title: 'مدير مالي', cat: 'finance', summary: 'تعرف على دور المدير المالي: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، وأسئلة مقابلة العمل.' },
    { id: 'r37', title: 'مستشار مالي', cat: 'finance', summary: 'تعرف على دور مستشار مالي: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r38', title: 'محلل مالي', cat: 'finance', summary: 'تعرف على مهام المحلل المالي والمؤهلات المطلوبة والمهارات اللازمة، والتدرج الوظيفي وأهم أسئلة المقابلات.' },
    { id: 'r39', title: 'مساعد إداري', cat: 'admin', summary: 'تعرف على دور مساعد إداري: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r40', title: 'موظف استقبال', cat: 'admin', summary: 'تعرف على دور موظف استقبال: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r41', title: 'مدير التصوير', cat: 'creative', summary: 'تعرف على دور مدير التصوير: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r42', title: 'مخرج أفلام', cat: 'creative', summary: 'تعرف على دور مخرج أفلام: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r43', title: 'سائق توصيل', cat: 'logistics', summary: 'اكتشف كل ما يخص وظيفة سائق توصيل: المهام، المؤهلات، المهارات، التدرج الوظيفي، متوسط الرواتب، ونصائح المقابلة.' },
    { id: 'r44', title: 'مندوب توصيل', cat: 'logistics', summary: 'تعرف على دور مندوب توصيل: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r45', title: 'محلل بيانات', cat: 'tech', summary: 'تعرف على دور محلل البيانات: مهامه، مؤهلاته، التدرج الوظيفي، الراتب، وأهم الأسئلة والنصائح لمقابلات العمل.' },
    { id: 'r46', title: 'مسؤول التزام', cat: 'legal', summary: 'تعرف على دور مسؤول التزام: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r47', title: 'الرئيس التنفيذي', cat: 'leadership', summary: 'تعرف على دور الرئيس التنفيذي: مهامه، المؤهلات والخبرات، التدرج الوظيفي، متوسط الرواتب، ونصائح مقابلات العمل.' },
    { id: 'r48', title: 'طاهي', cat: 'production', summary: 'تعرّف على دور الطاهي في المطاعم والفنادق: مهامه اليومية، أهم مهاراته ومؤهلاته، التدرج الوظيفي، ومتوسط الراتب.' },
  ];

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];

  const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id;

  const buildTemplate = (role) => `وصف وظيفي — ${role.title}
══════════════════════════════

1. ملخص الدور
${role.summary}

2. المهام الرئيسية
• تنفيذ المسؤوليات اليومية المرتبطة بـ ${role.title}
• التنسيق مع الفرق الداخلية والخارجية
• الالتزام بسياسات الشركة ومعايير الجودة
• إعداد التقارير الدورية للإدارة المباشرة

3. المؤهلات والخبرات
• مؤهل تعليمي مناسب للتخصص
• خبرة عملية في مجال ${catLabel(role.cat)}
• إجادة استخدام الأدوات والأنظمة ذات الصلة

4. المهارات المطلوبة
• مهارات تواصل وعرض
• العمل ضمن فريق
• حل المشكلات واتخاذ القرار
• الالتزام بالمواعيد والجودة

5. التدرج الوظيفي
• مستوى مبتدئ → متوسط → متقدم → قيادي (حسب السياسة الداخلية)

6. مؤشرات الأداء (KPI)
• جودة المخرجات
• الالتزام بالمواعيد
• رضا العملاء/الإدارة

7. أسئلة مقابلة مقترحة
• ما خبرتك السابقة في ${role.title}؟
• كيف تتعامل مع ضغط العمل والمواعيد النهائية؟
• ما أكبر إنجاز حققته في دور مشابه؟

— نموذج من مكتبة نايوش هوب 360
`;

  const showToast = () => {
    const toast = qs('[data-jr-toast]');
    if (!toast) return;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.hidden = true;
    }, 2200);
  };

  const markCopied = (btn) => {
    if (!btn) return;
    qsa('[data-jr-copy]').forEach((b) => {
      b.classList.remove('is-copied');
      b.innerHTML = '<i class="fas fa-copy"></i> نسخ نموذج وصف وظيفي';
    });
    btn.classList.add('is-copied');
    btn.innerHTML = '<i class="fas fa-check"></i> تم النسخ';
  };

  const copyTemplate = async (roleId, btn) => {
    const role = ROLES.find((r) => r.id === roleId);
    if (!role) return;
    const text = buildTemplate(role);
    try {
      await navigator.clipboard.writeText(text);
      markCopied(btn);
      showToast();
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      markCopied(btn);
      showToast();
    }
  };

  const renderKpis = () => {
    const root = qs('[data-jr-kpis]');
    if (!root) return;
    root.innerHTML = [
      { n: ROLES.length, l: 'مهنة في المكتبة' },
      { n: CATEGORIES.length - 1, l: 'فئات' },
      { n: ROLES.filter((r) => r.cat === 'sales').length, l: 'مبيعات/تسويق' },
      { n: ROLES.filter((r) => r.cat === 'finance').length, l: 'مالية' },
    ]
      .map((i) => `<article class="jr-kpi"><strong>${i.n}</strong><span>${i.l}</span></article>`)
      .join('');
  };

  const renderCats = () => {
    const root = qs('[data-jr-cats]');
    if (!root) return;
    root.innerHTML = CATEGORIES.map(
      (c, i) =>
        `<button type="button" class="${i === 0 ? 'is-active' : ''}" data-jr-cat="${c.id}">${c.label}</button>`
    ).join('');
  };

  const renderList = () => {
    const list = qs('[data-jr-list]');
    if (!list) return;
    const q = (qs('[data-jr-q]')?.value || '').trim().toLowerCase();
    const cat = qs('[data-jr-cats] .is-active')?.getAttribute('data-jr-cat') || 'all';
    const rows = ROLES.filter((r) => {
      const okC = cat === 'all' || r.cat === cat;
      const hay = `${r.title} ${r.summary}`.toLowerCase();
      return okC && (!q || hay.includes(q));
    });
    if (!rows.length) {
      list.innerHTML = '<div class="jr-empty">لا توجد مهن مطابقة.</div>';
      return;
    }
    list.innerHTML = rows
      .map(
        (r) => `
      <article class="jr-card">
        <header>
          <h3>${r.title}</h3>
          <span class="jr-cat">${catLabel(r.cat)}</span>
        </header>
        <p>${r.summary}</p>
        <button type="button" class="jr-copy" data-jr-copy="${r.id}">
          <i class="fas fa-copy"></i> نسخ نموذج وصف وظيفي
        </button>
      </article>`
      )
      .join('');
  };

  const init = () => {
    if (!qs('[data-jr-root]')) return;
    renderKpis();
    renderCats();
    renderList();
    qs('[data-jr-q]')?.addEventListener('input', renderList);
    qs('[data-jr-cats]')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-jr-cat]');
      if (!btn) return;
      qsa('[data-jr-cats] button').forEach((b) => b.classList.toggle('is-active', b === btn));
      renderList();
    });
    qs('[data-jr-list]')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-jr-copy]');
      if (!btn) return;
      copyTemplate(btn.getAttribute('data-jr-copy'), btn);
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.HubJobRoles = { ROLES, CATEGORIES, buildTemplate };
})();
