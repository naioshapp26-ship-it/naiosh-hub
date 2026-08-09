/**
 * مكتبة سياسات نايوش — ملف 03
 * قالب سياسات الشركة ككائنات قابلة للبحث والربط بالحوكمة
 */
(() => {
  'use strict';

  const CATEGORIES = [
    { id: 'all', label: 'كل الفئات' },
    { id: 'integrity', label: 'نزاهة وحوكمة' },
    { id: 'hr', label: 'موارد بشرية' },
    { id: 'safety', label: 'أمن وسلامة' },
    { id: 'tech', label: 'تقنية وبيانات' },
    { id: 'compliance', label: 'امتثال نظامي' },
    { id: 'culture', label: 'ثقافة وسلوك' },
    { id: 'ops-finance', label: 'تشغيل ومالية' },
  ];

  const POLICIES = [
    { id: 'p01', cat: 'integrity', title: 'سياسة مكافحة الفساد والرشوة في العمل', summary: 'إدارة مخاطر الفساد بشكل استباقي: تعريف السلوكيات المحظورة، الهدايا، الإبلاغ، التحقيق، والإجراءات التأديبية.' },
    { id: 'p02', cat: 'integrity', title: 'سياسة أخلاقيات التسويق والمبيعات', summary: 'مصداقية الحملات والصفقات: عدم المبالغة أو التضليل، ضوابط الخصومات، وحماية الملكية الفكرية.' },
    { id: 'p03', cat: 'culture', title: 'سياسة مكافحة التحرش في بيئة العمل', summary: 'منع انتهاك الكرامة: تعريف التحرش، الإبلاغ الفوري، التحقيق، والعواقب التأديبية.' },
    { id: 'p04', cat: 'hr', title: 'سياسة تخطيط القوى العاملة', summary: 'الاستعداد للكفاءات المستقبلية: تخطيط الإحلال، أولويات التطوير والترقيات، والتنبؤ بالحركة الوظيفية.' },
    { id: 'p05', cat: 'hr', title: 'سياسة تقييم الوظائف ومقارنة الرواتب', summary: 'إطار نقاط لتقييم الدور لا شاغله: عدالة الرواتب والترقيات والتعيينات.' },
    { id: 'p06', cat: 'culture', title: 'سياسة احترام التنوع الثقافي ومكافحة التمييز', summary: 'بيئة احترام وتقدير: سلوكيات مطلوبة، ما يُعد تمييزاً، وإجراءات المواجهة.' },
    { id: 'p07', cat: 'tech', title: 'سياسة خصوصية وحماية البيانات', summary: 'حماية بيانات الموظفين والعملاء: الوصول، التخزين، التخلص، والاستجابة للاختراق.' },
    { id: 'p08', cat: 'safety', title: 'سياسة الأمن وإجراءات الدخول والخروج', summary: 'خط الدفاع الأول: التحقق من الهوية، المراقبة، التحكم في الوصول، وخطط الطوارئ.' },
    { id: 'p09', cat: 'culture', title: 'سياسة تكافؤ الفرص في العمل وعدم التمييز', summary: 'الجدارة أساس التمايز: مساواة، دعم ذوي الإعاقة، حظر التنمر والانتقام.' },
    { id: 'p10', cat: 'culture', title: 'سياسة المشاركة المجتمعية والعمل التطوعي', summary: 'أثر مجتمعي منظم: مشاركة الموظفين، الحوافز، وضوابط السلوك أثناء التطوع.' },
    { id: 'p11', cat: 'ops-finance', title: 'سياسة البيئة والاستدامة للشركات', summary: 'لا ضرر ولا ضرار: تدوير، طاقة نظيفة، تقليل نفايات، وتدريب على الاستدامة.' },
    { id: 'p12', cat: 'hr', title: 'سياسة الإجراءات التأديبية للموظفين', summary: 'مرجع موحّد للمخالفات والجزاءات مع الأساس القانوني وجدول الجزاءات.' },
    { id: 'p13', cat: 'tech', title: 'سياسة السرية وضوابط وسائل التواصل الاجتماعي', summary: 'حماية صورة الشركة وسرية البيانات على الحسابات الشخصية والرسمية.' },
    { id: 'p14', cat: 'safety', title: 'سياسة الطوارئ وإرشادات السلامة من الحريق', summary: 'استعداد، وقاية، استجابة، ثم توثيق وتحقيق بعد الأزمة.' },
    { id: 'p15', cat: 'safety', title: 'سياسة الصحة والسلامة المهنية', summary: 'تدابير وقائية، تصميم بيئة العمل، تدريب، وإبلاغ عن الحوادث.' },
    { id: 'p16', cat: 'hr', title: 'سياسة الإجازات', summary: 'أنواع الإجازات وضوابطها: سنوية، مرضية، وضع، أبوة، حج، ورسمية.' },
    { id: 'p17', cat: 'hr', title: 'سياسة مكافأة نهاية الخدمة', summary: 'أساس الحساب، حالات الاستحقاق الكلي/الجزئي، العلاقة بالعقود، وتوقيت الصرف.' },
    { id: 'p18', cat: 'hr', title: 'سياسة الاستقالة وفترة الإشعار', summary: 'خطوات الاستقالة، فترة الإشعار، سريان العقد، الرد، والعدول.' },
    { id: 'p19', cat: 'safety', title: 'سياسة إصابة العمل وتعويض العامل', summary: 'تعريف الإصابة، الإبلاغ، العلاج، التعويضات، والعودة للعمل.' },
    { id: 'p20', cat: 'culture', title: 'مدونة السلوك الوظيفي', summary: 'آداب مهنية: احترافية، احترام، التزام بالقوانين، وعواقب الإخلال.' },
    { id: 'p21', cat: 'compliance', title: 'سياسة الامتثال لنظام السعودة والتوطين', summary: 'التزام نطاقات ومستوى التوطين المستهدف وبرامج الدعم ذات الصلة.' },
    { id: 'p22', cat: 'hr', title: 'سياسة عقود العمل', summary: 'أنواع العقود، التحويل بينها، فترة التجربة، التجديد والإنهاء.' },
    { id: 'p23', cat: 'ops-finance', title: 'سياسة البدلات للموظفين', summary: 'سكن، نقل، اتصالات، طبيعة عمل، مسؤولية، طعام، تعليم — ضمن حدود معقولة.' },
    { id: 'p24', cat: 'safety', title: 'سياسة بيئة العمل الصحية', summary: 'تصميم مكان آمن وصحي، أماكن استراحة، وآلية التحسين المستمر.' },
    { id: 'p25', cat: 'hr', title: 'سياسة التدريب والتطوير', summary: 'تقييم احتياجات تدريبية، مساواة وشفافية، وتقييم ما بعد التدريب.' },
    { id: 'p26', cat: 'compliance', title: 'سياسة نقل كفالة وتصاريح العمل', summary: 'نقل الكفالة من/إلى الشركة، التسجيل الرسمي، وتوثيق العقود.' },
    { id: 'p27', cat: 'hr', title: 'سياسة تقييم الأداء الوظيفي', summary: 'وتيرة ومعايير التقييم، التظلم، وخطط التطوير الفردية.' },
    { id: 'p28', cat: 'hr', title: 'سياسة التغييرات التنظيمية وإعادة الهيكلة', summary: 'ضوابط التغيير، الاندماج/الاستحواذ، وحقوق الموظفين المتأثرين.' },
    { id: 'p29', cat: 'compliance', title: 'سياسة الامتثال لأنظمة الإقامات والتأشيرات', summary: 'إصدار وتجديد الإقامات والتأشيرات والتراخيص المهنية.' },
    { id: 'p30', cat: 'culture', title: 'سياسة حقوق المرأة في العمل', summary: 'بيئة عادلة وآمنة: أمومة، زواج، حماية من التحرش والتمييز.' },
    { id: 'p31', cat: 'culture', title: 'سياسة الباب المفتوح للتواصل', summary: 'إنصات فعّال: أوقات أسبوعية، قنوات مخصصة، وتواصل مهني بنّاء.' },
    { id: 'p32', cat: 'culture', title: 'سياسة الزي الرسمي للعمل', summary: 'معايير المظهر المهني وفق الثقافة والسياق (عمل / فعاليات).' },
    { id: 'p33', cat: 'tech', title: 'سياسة الاستخدام المقبول لموارد تقنية المعلومات', summary: 'أجهزة وبرامج وشبكات: مقبول/محظور، كلمات مرور، وسرية البيانات.' },
    { id: 'p34', cat: 'hr', title: 'سياسة القيادة والتوجيه التنفيذي', summary: 'اختيار القادة، الجدارات، الخلفاء، وبرامج اكتشاف القادة.' },
    { id: 'p35', cat: 'hr', title: 'سياسة قياس رضا الموظفين', summary: 'مسوح دورية صادقة لتحسين تجربة العمل اليومية.' },
    { id: 'p36', cat: 'ops-finance', title: 'سياسة رحلات العمل وتعويض المصاريف', summary: 'ترتيب الرحلات، النفقات المغطاة، والموافقات والحالات الخاصة.' },
    { id: 'p37', cat: 'ops-finance', title: 'سياسة استخدام سيارات الشركة', summary: 'قيادة آمنة، صيانة، وتقليل الحوادث لحماية الأصول والأرواح.' },
    { id: 'p38', cat: 'hr', title: 'سياسة التنقلات الداخلية للموظفين', summary: 'مسارات النقل الداخلي، الأهلية، وأثر النقل على الراتب.' },
    { id: 'p39', cat: 'hr', title: 'سياسة تصنيف الموظفين', summary: 'دوام كامل/جزئي، مؤقت، فريلانسر — حقوق وواجبات وإنهاء خدمة.' },
    { id: 'p40', cat: 'ops-finance', title: 'سياسة بطاقة الشركة وإدارة المصاريف', summary: 'إصدار واستخدام ومراقبة البطاقات ومنع الاحتيال.' },
    { id: 'p41', cat: 'hr', title: 'سياسة إطار الجدارات وتطوير المهارات', summary: 'فئات الجدارات ومستوياتها وتقييمها كنموذج عملي.' },
    { id: 'p42', cat: 'culture', title: 'سياسة تعزيز الترابط بين الفريق', summary: 'فعاليات اجتماعية منظمة، موافقات، وقواعد سلوك أثناء المشاركة.' },
    { id: 'p43', cat: 'integrity', title: 'سياسة شكاوى الموظفين والإبلاغ عن المخالفات', summary: 'تشجيع البلاغ، حماية المبلّغ، والتحقيق والمعالجة.' },
  ];

  const ACK_KEY = 'hubPolicyAcks';

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];

  const readAcks = () => {
    try {
      return JSON.parse(localStorage.getItem(ACK_KEY) || '[]');
    } catch (_) {
      return [];
    }
  };

  const saveAcks = (ids) => localStorage.setItem(ACK_KEY, JSON.stringify(ids));

  const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id;

  const renderKpis = () => {
    const root = qs('[data-pol-kpis]');
    if (!root) return;
    const acks = readAcks();
    root.innerHTML = [
      { n: POLICIES.length, l: 'سياسة في المكتبة' },
      { n: CATEGORIES.length - 1, l: 'فئات' },
      { n: acks.length, l: 'اطّلعتُ عليها' },
      { n: POLICIES.length - acks.length, l: 'متبقية' },
    ]
      .map((i) => `<article class="pol-kpi"><strong>${i.n}</strong><span>${i.l}</span></article>`)
      .join('');
  };

  const renderCats = () => {
    const root = qs('[data-pol-cats]');
    if (!root) return;
    root.innerHTML = CATEGORIES.map(
      (c, i) =>
        `<button type="button" class="${i === 0 ? 'is-active' : ''}" data-pol-cat="${c.id}">${c.label}</button>`
    ).join('');
  };

  const renderList = () => {
    const list = qs('[data-pol-list]');
    if (!list) return;
    const q = (qs('[data-pol-q]')?.value || '').trim().toLowerCase();
    const cat = qs('[data-pol-cats] .is-active')?.getAttribute('data-pol-cat') || 'all';
    const acks = readAcks();
    const rows = POLICIES.filter((p) => {
      const okC = cat === 'all' || p.cat === cat;
      const hay = `${p.title} ${p.summary}`.toLowerCase();
      return okC && (!q || hay.includes(q));
    });
    if (!rows.length) {
      list.innerHTML = '<div class="pol-empty">لا توجد سياسات مطابقة.</div>';
      return;
    }
    list.innerHTML = rows
      .map((p) => {
        const done = acks.includes(p.id);
        return `
        <article class="pol-card" data-id="${p.id}">
          <header>
            <h3>${p.title}</h3>
            <span class="pol-badge">${catLabel(p.cat)}</span>
          </header>
          <p>${p.summary}</p>
          <div class="pol-actions">
            <button type="button" class="primary" data-pol-ack="${p.id}">${done ? 'تم الاطلاع ✓' : 'أقرّ بالاطلاع'}</button>
            <a href="info-center.html">ربط بمركز المعرفة</a>
            <a href="quality.html">دليل الجودة</a>
          </div>
        </article>`;
      })
      .join('');
  };

  const bind = () => {
    qs('[data-pol-q]')?.addEventListener('input', renderList);
    qs('[data-pol-cats]')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pol-cat]');
      if (!btn) return;
      qsa('[data-pol-cat]').forEach((b) => b.classList.toggle('is-active', b === btn));
      renderList();
    });
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pol-ack]');
      if (!btn) return;
      const id = btn.getAttribute('data-pol-ack');
      const acks = readAcks();
      if (!acks.includes(id)) {
        acks.push(id);
        saveAcks(acks);
      }
      renderKpis();
      renderList();
    });
  };

  const init = () => {
    if (!qs('[data-pol-root]')) return;
    renderKpis();
    renderCats();
    renderList();
    bind();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.HubPolicies = { POLICIES, CATEGORIES, readAcks };
})();
