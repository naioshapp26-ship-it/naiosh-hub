/**
 * سياسات نايوش هوب — مخزن + Workflow (مسودة → مراجعة → نشر)
 */
(function () {
  'use strict';

  var KEY = 'naiosh_hub_policies_v2';

  var CATEGORIES = [
    { id: 'all', label: 'جميع السياسات' },
    { id: 'ops', label: 'تشغيل' },
    { id: 'privacy', label: 'خصوصية' },
    { id: 'security', label: 'أمن' },
    { id: 'hr', label: 'موارد بشرية' },
    { id: 'finance', label: 'مالية' },
    { id: 'marketing', label: 'تسويق' },
    { id: 'data', label: 'بيانات' },
    { id: 'other', label: 'أخرى' },
  ];

  var STATUS = {
    draft: 'مسودة',
    pending_review: 'قيد المراجعة',
    needs_changes: 'تحتاج تعديل',
    rejected: 'مرفوضة',
    published: 'منشورة',
    archived: 'مؤرشفة',
  };

  var SEED = [
    { id: 'p01', cat: 'other', title: 'سياسة مكافحة الفساد والرشوة في العمل', summary: 'إدارة مخاطر الفساد بشكل استباقي: تعريف السلوكيات المحظورة، الهدايا، الإبلاغ، والتحقيق.' },
    { id: 'p02', cat: 'marketing', title: 'سياسة أخلاقيات التسويق والمبيعات', summary: 'مصداقية الحملات والصفقات: عدم المبالغة أو التضليل، وضوابط الخصومات.' },
    { id: 'p03', cat: 'hr', title: 'سياسة مكافحة التحرش في بيئة العمل', summary: 'منع انتهاك الكرامة: تعريف التحرش، الإبلاغ الفوري، والتحقيق.' },
    { id: 'p04', cat: 'hr', title: 'سياسة تخطيط القوى العاملة', summary: 'الاستعداد للكفاءات المستقبلية: تخطيط الإحلال وأولويات التطوير.' },
    { id: 'p05', cat: 'hr', title: 'سياسة تقييم الوظائف ومقارنة الرواتب', summary: 'إطار نقاط لتقييم الدور لا شاغله: عدالة الرواتب والترقيات.' },
    { id: 'p06', cat: 'other', title: 'سياسة احترام التنوع الثقافي ومكافحة التمييز', summary: 'بيئة احترام وتقدير: سلوكيات مطلوبة وإجراءات المواجهة.' },
    { id: 'p07', cat: 'privacy', title: 'سياسة خصوصية وحماية البيانات', summary: 'حماية بيانات الموظفين والعملاء: الوصول، التخزين، والاستجابة للاختراق.' },
    { id: 'p08', cat: 'security', title: 'سياسة الأمن وإجراءات الدخول والخروج', summary: 'التحقق من الهوية، المراقبة، التحكم في الوصول، وخطط الطوارئ.' },
    { id: 'p09', cat: 'hr', title: 'سياسة تكافؤ الفرص في العمل وعدم التمييز', summary: 'الجدارة أساس التمايز: مساواة ودعم ذوي الإعاقة.' },
    { id: 'p10', cat: 'other', title: 'سياسة المشاركة المجتمعية والعمل التطوعي', summary: 'أثر مجتمعي منظم: مشاركة الموظفين وضوابط السلوك أثناء التطوع.' },
    { id: 'p11', cat: 'ops', title: 'سياسة البيئة والاستدامة للشركات', summary: 'تدوير، طاقة نظيفة، تقليل نفايات، وتدريب على الاستدامة.' },
    { id: 'p12', cat: 'hr', title: 'سياسة الإجراءات التأديبية للموظفين', summary: 'مرجع موحّد للمخالفات والجزاءات مع جدول الجزاءات.' },
    { id: 'p13', cat: 'data', title: 'سياسة السرية وضوابط وسائل التواصل الاجتماعي', summary: 'حماية صورة الشركة وسرية البيانات على الحسابات الشخصية والرسمية.' },
    { id: 'p14', cat: 'security', title: 'سياسة الطوارئ وإرشادات السلامة من الحريق', summary: 'استعداد، وقاية، استجابة، ثم توثيق بعد الأزمة.' },
    { id: 'p15', cat: 'security', title: 'سياسة الصحة والسلامة المهنية', summary: 'تدابير وقائية، تدريب، وإبلاغ عن الحوادث.' },
    { id: 'p16', cat: 'hr', title: 'سياسة الإجازات', summary: 'أنواع الإجازات وضوابطها: سنوية، مرضية، وضع، وأبوة.' },
    { id: 'p17', cat: 'hr', title: 'سياسة مكافأة نهاية الخدمة', summary: 'أساس الحساب، حالات الاستحقاق، وتوقيت الصرف.' },
    { id: 'p18', cat: 'hr', title: 'سياسة الاستقالة وفترة الإشعار', summary: 'خطوات الاستقالة، فترة الإشعار، والعدول.' },
    { id: 'p19', cat: 'security', title: 'سياسة إصابة العمل وتعويض العامل', summary: 'تعريف الإصابة، الإبلاغ، العلاج، والعودة للعمل.' },
    { id: 'p20', cat: 'other', title: 'مدونة السلوك الوظيفي', summary: 'آداب مهنية: احترافية، احترام، والتزام بالقوانين.' },
    { id: 'p21', cat: 'ops', title: 'سياسة الامتثال لنظام السعودة والتوطين', summary: 'التزام نطاقات ومستوى التوطين المستهدف.' },
    { id: 'p22', cat: 'hr', title: 'سياسة عقود العمل', summary: 'أنواع العقود، فترة التجربة، التجديد والإنهاء.' },
    { id: 'p23', cat: 'finance', title: 'سياسة البدلات للموظفين', summary: 'سكن، نقل، اتصالات، وطبيعة عمل ضمن حدود معقولة.' },
    { id: 'p24', cat: 'ops', title: 'سياسة بيئة العمل الصحية', summary: 'تصميم مكان آمن وصحي وآلية التحسين المستمر.' },
    { id: 'p25', cat: 'hr', title: 'سياسة التدريب والتطوير', summary: 'تقييم احتياجات تدريبية ومساواة وشفافية.' },
    { id: 'p26', cat: 'ops', title: 'سياسة نقل كفالة وتصاريح العمل', summary: 'نقل الكفالة والتسجيل الرسمي وتوثيق العقود.' },
    { id: 'p27', cat: 'hr', title: 'سياسة تقييم الأداء الوظيفي', summary: 'معايير التقييم، التظلم، وخطط التطوير.' },
    { id: 'p28', cat: 'ops', title: 'سياسة التغييرات التنظيمية وإعادة الهيكلة', summary: 'ضوابط التغيير وحقوق الموظفين المتأثرين.' },
    { id: 'p29', cat: 'ops', title: 'سياسة الامتثال لأنظمة الإقامات والتأشيرات', summary: 'إصدار وتجديد الإقامات والتأشيرات.' },
    { id: 'p30', cat: 'hr', title: 'سياسة حقوق المرأة في العمل', summary: 'بيئة عادلة وآمنة: أمومة وحماية من التحرش.' },
    { id: 'p31', cat: 'other', title: 'سياسة الباب المفتوح للتواصل', summary: 'قنوات مخصصة وتواصل مهني بنّاء.' },
    { id: 'p32', cat: 'other', title: 'سياسة الزي الرسمي للعمل', summary: 'معايير المظهر المهني وفق السياق.' },
    { id: 'p33', cat: 'data', title: 'سياسة الاستخدام المقبول لموارد تقنية المعلومات', summary: 'أجهزة وبرامج وشبكات: مقبول ومحظور.' },
    { id: 'p34', cat: 'hr', title: 'سياسة القيادة والتوجيه التنفيذي', summary: 'اختيار القادة وبرامج اكتشاف القادة.' },
    { id: 'p35', cat: 'hr', title: 'سياسة قياس رضا الموظفين', summary: 'مسوح دورية لتحسين تجربة العمل.' },
    { id: 'p36', cat: 'finance', title: 'سياسة رحلات العمل وتعويض المصاريف', summary: 'ترتيب الرحلات والنفقات المغطاة.' },
    { id: 'p37', cat: 'ops', title: 'سياسة استخدام سيارات الشركة', summary: 'قيادة آمنة وصيانة وحماية الأصول.' },
    { id: 'p38', cat: 'hr', title: 'سياسة التنقلات الداخلية للموظفين', summary: 'مسارات النقل الداخلي وأثرها على الراتب.' },
    { id: 'p39', cat: 'hr', title: 'سياسة تصنيف الموظفين', summary: 'دوام كامل/جزئي ومؤقت وحقوق كل فئة.' },
    { id: 'p40', cat: 'finance', title: 'سياسة بطاقة الشركة وإدارة المصاريف', summary: 'إصدار ومراقبة البطاقات ومنع الاحتيال.' },
    { id: 'p41', cat: 'hr', title: 'سياسة إطار الجدارات وتطوير المهارات', summary: 'فئات الجدارات ومستوياتها وتقييمها.' },
    { id: 'p42', cat: 'other', title: 'سياسة تعزيز الترابط بين الفريق', summary: 'فعاليات اجتماعية منظمة وقواعد السلوك.' },
    { id: 'p43', cat: 'other', title: 'سياسة شكاوى الموظفين والإبلاغ عن المخالفات', summary: 'تشجيع البلاغ وحماية المبلّغ والتحقيق.' },
  ].map(function (p) {
    return Object.assign(
      {
        body: p.summary + '\n\nهذه نسخة منشورة من مكتبة السياسات. يمكن للإدارة تحديث المحتوى عبر إدارة السياسات.',
        version: '1.0',
        status: 'published',
        department: 'الحوكمة والجودة',
        keywords: '',
        effectiveAt: '2024-09-01',
        updatedAt: '2024-09-01T00:00:00.000Z',
        publishedAt: '2024-09-01T00:00:00.000Z',
        createdAt: '2024-09-01T00:00:00.000Z',
        createdBy: 'النظام',
        versions: [{ version: '1.0', at: '2024-09-01T00:00:00.000Z', note: 'إصدار أولي' }],
        fileName: '',
        fileDataUrl: '',
        seed: true,
      },
      p
    );
  });

  function nowIso() {
    return new Date().toISOString();
  }

  function blank() {
    return { schemaVersion: 2, policies: SEED.map(function (p) { return Object.assign({}, p, { versions: (p.versions || []).slice() }); }), updatedAt: nowIso() };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) {
        var s = blank();
        localStorage.setItem(KEY, JSON.stringify(s));
        return s;
      }
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.policies) || !parsed.policies.length) {
        var fresh = blank();
        localStorage.setItem(KEY, JSON.stringify(fresh));
        return fresh;
      }
      return parsed;
    } catch (e) {
      return blank();
    }
  }

  function save(state) {
    state.updatedAt = nowIso();
    localStorage.setItem(KEY, JSON.stringify(state));
    try {
      window.dispatchEvent(new CustomEvent('hub-policies-changed', { detail: state }));
    } catch (e) {}
    return state;
  }

  function uid() {
    return 'pol-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function canManage() {
    if (window.HubAuth && HubAuth.isStaff && HubAuth.isStaff()) return true;
    try {
      var u =
        (window.HubAuth && HubAuth.getUser && HubAuth.getUser()) ||
        JSON.parse(localStorage.getItem('hubUser') || sessionStorage.getItem('hubUser') || 'null');
      var role = String((u && u.role) || '').toLowerCase();
      return ['supreme_leader', 'chief_engineer', 'admin', 'super_admin', 'manager'].indexOf(role) !== -1;
    } catch (e) {
      return false;
    }
  }

  function actorName() {
    var u = window.HubAuth && HubAuth.getUser && HubAuth.getUser();
    return (u && (u.name || u.email)) || 'مستخدم';
  }

  function list(filter) {
    filter = filter || {};
    var state = load();
    var q = String(filter.q || '').trim().toLowerCase();
    var cat = filter.cat || 'all';
    var status = filter.status || '';
    var manage = Object.prototype.hasOwnProperty.call(filter, 'manage') ? !!filter.manage : canManage();
    return state.policies.filter(function (p) {
      if (!manage && p.status !== 'published') return false;
      if (status && p.status !== status) return false;
      if (cat && cat !== 'all' && p.cat !== cat) return false;
      if (!q) return true;
      var hay = [p.title, p.summary, p.body, p.keywords, p.department, p.id].join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function get(id) {
    return load().policies.find(function (p) {
      return p.id === id;
    });
  }

  function create(payload) {
    if (!canManage()) return null;
    var state = load();
    var row = {
      id: uid(),
      title: String(payload.title || '').trim(),
      cat: payload.cat || 'other',
      summary: String(payload.summary || '').trim(),
      body: String(payload.body || '').trim(),
      version: String(payload.version || '0.1').trim() || '0.1',
      status: 'draft',
      department: String(payload.department || '').trim() || 'غير محدد',
      keywords: String(payload.keywords || '').trim(),
      effectiveAt: payload.effectiveAt || '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      publishedAt: '',
      createdBy: actorName(),
      versions: [{ version: String(payload.version || '0.1'), at: nowIso(), note: 'إنشاء مسودة' }],
      fileName: payload.fileName || '',
      fileDataUrl: payload.fileDataUrl || '',
      seed: false,
    };
    if (!row.title || !row.summary || !row.body) return null;
    state.policies.unshift(row);
    save(state);
    return row;
  }

  function update(id, patch) {
    if (!canManage()) return null;
    var state = load();
    var idx = state.policies.findIndex(function (p) {
      return p.id === id;
    });
    if (idx < 0) return null;
    Object.assign(state.policies[idx], patch || {}, { updatedAt: nowIso() });
    save(state);
    return state.policies[idx];
  }

  function setStatus(id, status, note) {
    if (!canManage()) return null;
    if (!STATUS[status]) return null;
    var row = get(id);
    if (!row) return null;
    var patch = { status: status };
    if (status === 'published') patch.publishedAt = nowIso();
    if (note) {
      var versions = (row.versions || []).slice();
      versions.unshift({ version: row.version, at: nowIso(), note: note });
      patch.versions = versions;
    }
    return update(id, patch);
  }

  function remove(id) {
    if (!canManage()) return false;
    var state = load();
    var row = state.policies.find(function (p) {
      return p.id === id;
    });
    if (!row || row.seed) return false;
    if (row.status === 'published') return false;
    state.policies = state.policies.filter(function (p) {
      return p.id !== id;
    });
    save(state);
    return true;
  }

  function catLabel(id) {
    var c = CATEGORIES.find(function (x) {
      return x.id === id;
    });
    return (c && c.label) || id || '—';
  }

  function statusLabel(s) {
    return STATUS[s] || s || '—';
  }

  window.HubPoliciesStore = {
    KEY: KEY,
    CATEGORIES: CATEGORIES,
    STATUS: STATUS,
    SEED: SEED,
    load: load,
    list: list,
    get: get,
    create: create,
    update: update,
    setStatus: setStatus,
    remove: remove,
    canManage: canManage,
    catLabel: catLabel,
    statusLabel: statusLabel,
    reset: function () {
      return save(blank());
    },
  };
})();
