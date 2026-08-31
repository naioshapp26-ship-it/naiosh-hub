/**
 * كتالوج خدماتنا — أسماء المربعات من شريحة ترتيب صفحات هوب
 * + خدمات يضيفها المستخدم (صور/فيديو حتى 150MB).
 */
(() => {
  'use strict';

  const KEY = 'naiosh_hub_services_catalog_v1';

  const DEFAULT_SERVICES = [
    { id: 'svc-studies', title: 'الدراسات', icon: 'fa-flask', relatedHref: 'publish-research.html', keywords: 'بحث دراسة دراسات' },
    { id: 'svc-free-consult', title: 'استشارة مجانية', icon: 'fa-comments', relatedHref: 'consultation.html', keywords: 'استشارة مجانية' },
    { id: 'svc-subscriptions', title: 'الاشتراكات', icon: 'fa-box', relatedHref: 'packages.html', keywords: 'باقات اشتراك' },
    { id: 'svc-branches', title: 'إدارة الفروع', icon: 'fa-code-branch', relatedHref: 'branches.html', keywords: 'فروع شبكة' },
    { id: 'svc-incubators', title: 'برامج الحاضنات', icon: 'fa-seedling', relatedHref: 'incubators.html', keywords: 'حاضنة برامج' },
    { id: 'svc-consulting', title: 'الاستشارات', icon: 'fa-user-tie', relatedHref: 'consultation.html', keywords: 'استشارات' },
    { id: 'svc-skills', title: 'إدارة المهارات', icon: 'fa-brain', relatedHref: 'courses.html', keywords: 'مهارات تدريب' },
    { id: 'svc-innovation', title: 'إدارة الابتكارات', icon: 'fa-lightbulb', keywords: 'ابتكار أفكار' },
    { id: 'svc-expertise', title: 'إدارة الخبرات', icon: 'fa-award', keywords: 'خبرات كفاءة' },
    { id: 'svc-talent', title: 'إدارة المواهب', icon: 'fa-star', keywords: 'مواهب كفاءات' },
    {
      id: 'svc-cost-cut',
      title: 'إدارة خفض التكاليف التشغيلية',
      icon: 'fa-chart-line',
      relatedHref: 'cost-reduction.html',
      keywords: 'تكاليف ساي فاي',
    },
    { id: 'svc-nocode', title: 'بناء الأنظمة بدون برمجة', icon: 'fa-cubes', keywords: 'بدون برمجة nocode' },
    { id: 'svc-cyber', title: 'الأمن السيبراني', icon: 'fa-shield-halved', keywords: 'أمن سيبراني حماية' },
    { id: 'svc-attachments', title: 'دمج المرفقات عند التحميل', icon: 'fa-paperclip', keywords: 'مرفقات تحميل' },
    { id: 'svc-bulk-msg', title: 'نظام الرسائل الجماعية', icon: 'fa-envelope-open-text', keywords: 'رسائل جماعية' },
    { id: 'svc-scanner', title: 'تكامل مع الماسح الضوئي', icon: 'fa-print', keywords: 'ماسح ضوئي سكانر' },
    { id: 'svc-quality-engine', title: 'محرك تقييم الجودة', icon: 'fa-gauge-high', relatedHref: 'quality.html', keywords: 'جودة تقييم' },
    { id: 'svc-chat', title: 'نظام الدردشة الكتابية', icon: 'fa-comment-dots', keywords: 'دردشة شات' },
    { id: 'svc-pmo', title: 'مكتب إدارة المشاريع', icon: 'fa-diagram-project', keywords: 'PMO مشاريع' },
    { id: 'svc-performance', title: 'إدارة الأداء المؤسسي', icon: 'fa-chart-pie', keywords: 'أداء مؤشرات' },
    { id: 'svc-ops-follow', title: 'متابعة العمليات', icon: 'fa-clipboard-list', relatedHref: 'operating.html', keywords: 'عمليات تشغيل' },
    { id: 'svc-ai-market', title: 'دراسة السوق عبر الذكاء الاصطناعي', icon: 'fa-robot', keywords: 'سوق ذكاء اصطناعي' },
    { id: 'svc-customers', title: 'خدمة العملاء', icon: 'fa-headset', relatedHref: 'support.html', keywords: 'عملاء دعم' },
    { id: 'svc-admin', title: 'الخدمات الإدارية', icon: 'fa-building', keywords: 'إدارية مكتب' },
    { id: 'svc-research', title: 'البحوث', icon: 'fa-microscope', relatedHref: 'publish-research.html', keywords: 'بحوث أبحاث' },
    { id: 'svc-consult-train', title: 'الاستشارات والتدريب', icon: 'fa-chalkboard-user', relatedHref: 'courses.html', keywords: 'تدريب استشارة' },
    { id: 'svc-risk', title: 'تقييم المخاطر', icon: 'fa-triangle-exclamation', keywords: 'مخاطر تقييم' },
    { id: 'svc-virtual-halls', title: 'القاعات الافتراضية', icon: 'fa-video', relatedHref: 'events.html', keywords: 'قاعات افتراضية' },
    { id: 'svc-feasibility', title: 'دراسات الجدوى', icon: 'fa-file-invoice-dollar', keywords: 'جدوى دراسة' },
    { id: 'svc-supportive', title: 'الخدمات المساندة', icon: 'fa-handshake-angle', keywords: 'مساندة دعم' },
    { id: 'svc-facilities', title: 'إدارة المرافق والفعاليات', icon: 'fa-calendar-check', relatedHref: 'events.html', keywords: 'مرافق فعاليات' },
    { id: 'svc-ads', title: 'إدارة الحملات الإعلانية', icon: 'fa-bullhorn', relatedHref: 'ads.html', keywords: 'إعلان حملات' },
    { id: 'svc-social', title: 'إدارة منصات التواصل', icon: 'fa-share-nodes', relatedHref: 'platforms.html', keywords: 'تواصل اجتماعي' },
    { id: 'svc-safety', title: 'خدمات الأمن والسلامة', icon: 'fa-helmet-safety', keywords: 'سلامة أمن' },
    { id: 'svc-supply', title: 'إدارة سلاسل الإمداد', icon: 'fa-truck', keywords: 'إمداد توريد' },
    { id: 'svc-tracking', title: 'تتبع الطلبات والشحنات', icon: 'fa-location-dot', keywords: 'شحن تتبع طلبات' },
    { id: 'svc-gov', title: 'الحوكمة والأتمتة', icon: 'fa-gears', keywords: 'حوكمة أتمتة' },
    { id: 'svc-audit', title: 'الجودة والتدقيق', icon: 'fa-clipboard-check', relatedHref: 'quality.html', keywords: 'تدقيق جودة' },
    { id: 'svc-ip', title: 'الملكية الفكرية', icon: 'fa-copyright', keywords: 'ملكية فكرية' },
    { id: 'svc-franchise', title: 'العقود والفرنشايز', icon: 'fa-file-contract', keywords: 'عقود فرنشايز' },
    { id: 'svc-sustain', title: 'الاستدامة', icon: 'fa-leaf', keywords: 'استدامة بيئة' },
    { id: 'svc-sysops', title: 'تشغيل الأنظمة', icon: 'fa-server', relatedHref: 'apps.html', keywords: 'تشغيل أنظمة' },
  ];

  const FALLBACK_POINTS = [
    'طلب الخدمة وربطها بحسابك داخل هوب',
    'متابعة الحالة من غرفة العمليات',
    'تسليم نتائج وتقارير واضحة',
    'دعم تشغيلي عند الحاجة',
  ];
  const FALLBACK_STEPS = [
    'افتح صفحة الخدمة واقرأ نطاق العمل',
    'اضغط اطلب هذه الخدمة وأدخل بياناتك',
    'فريق هوب يربط الطلب بالنظام ويتابع التنفيذ',
  ];

  const DETAILS = {
    'svc-studies': {
      description: 'إعداد دراسات تشغيلية وميدانية تساعد الإدارة على اتخاذ قرار مبني على بيانات داخل هوب، ثم نشرها للمراجعة في مركز المعرفة.',
      points: ['جمع متطلبات الدراسة ونطاق العمل', 'تحليل الوضع الحالي والفرص', 'تقرير تنفيذي مع توصيات قابلة للتنفيذ', 'خيار نشر الدراسة داخل هوب'],
      audience: 'للشركات والفرق التي تحتاج قرارًا موثّقًا قبل التوسع أو تغيير التشغيل.',
    },
    'svc-free-consult': {
      description: 'جلسة استشارة مجانية لفهم احتياجك وربطه بالمسار الصحيح: عضوية، حاضنة، منصة، مكتب، أو نظام حي.',
      points: ['تشخيص سريع للاحتياج', 'ترشيح المسار المناسب داخل هوب', 'خطوات تالية واضحة', 'تحويل إلى استشارة تشغيلية عند الحاجة'],
      audience: 'لأي عميل جديد يريد أن يعرف من أين يبدأ داخل نايوش هوب.',
    },
    'svc-subscriptions': {
      description: 'باقات الاشتراك تمنح صلاحية تشغيل واضحة: باقة واحدة = صلاحيات محددة تظهر في غرفة العمليات والمتجر.',
      points: ['عرض الباقات والأسعار', 'تفعيل الاشتراك من المتجر', 'ربط الصلاحيات بالحساب', 'متابعة التجديد والحالة'],
      audience: 'للمنشآت التي تريد تشغيلًا بصلاحيات واضحة دون تشتت.',
    },
    'svc-branches': {
      description: 'إدارة شبكة فروع نايوش: استعراض الفروع، اختيار الفرع، ثم الحجز والتشغيل من نفس الخريطة.',
      points: ['دليل الفروع حول العالم', 'بيانات الفرع وحالته', 'الحجز من الفرع إلى الحاضنة', 'ربط الفرع بالتشغيل اليومي'],
      audience: 'لإدارة الفروع والعملاء الذين يختارون موقع التشغيل.',
    },
    'svc-incubators': {
      description: 'برامج الحاضنات القطاعية بنفس قائمة وتصميم التشغيل — ابحث واحجز منصتك من الحاضنة المناسبة.',
      points: ['استعراض الحاضنات حسب المجال', 'تفاصيل البرنامج ومتطلباته', 'الحجز والربط بالمنصة', 'متابعة حالة الاحتضان'],
      audience: 'لرواد الأعمال والجهات التي تدخل برامج الاحتضان.',
    },
    'svc-consulting': {
      description: 'استشارات تشغيلية مربوطة بالنظام: العضوية، الحاضنة، المنصة، المكتب الإلكتروني، أو الأنظمة الحية.',
      points: ['تحديد النظام أو المسار', 'توصية تشغيلية موثّقة', 'متابعة من غرفة العمليات', 'ربط التوصية بالصلاحيات'],
      audience: 'للشركات التي تحتاج رأيًا تشغيليًا مربوطًا بما تستخدمه فعليًا.',
    },
    'svc-skills': {
      description: 'إدارة المهارات داخل هوب: تحديد الفجوات، مسارات التعلّم، وقياس الاكتساب عبر الدورات والدبلومات.',
      points: ['حصر المهارات المطلوبة للدور', 'ربط المهارة بمسار تعلّم', 'متابعة الاكتساب والتقدم', 'تقارير للكفاءة التشغيلية'],
      audience: 'لفلرق الموارد البشرية والتدريب ومديري التشغيل.',
    },
    'svc-innovation': {
      description: 'إدارة الابتكارات من الفكرة حتى التجربة: تسجيل المقترح، تقييمه، وربطه بفرصة تشغيل أو مشروع جانبي.',
      points: ['استقبال الأفكار وتوثيقها', 'تقييم الجدوى المبدئية', 'تحويل الفكرة إلى مسار عمل', 'متابعة التجربة والنتائج'],
      audience: 'للشركات التي تريد مسارًا واضحًا للابتكار داخل التشغيل لا خارجه.',
    },
    'svc-expertise': {
      description: 'بناء سجل الخبرات والكفاءات: من عمل ماذا، وأي نتائج تحققت، وكيف تُعاد الاستفادة داخل هوب.',
      points: ['توثيق الخبرات حسب المجال', 'ربط الخبرة بالمشروع أو النظام', 'إعادة استخدام الدروس المستفادة', 'إظهار الكفاءة في التقارير'],
      audience: 'للمنشآت التي تريد ذاكرة تشغيل لا تعتمد على الأشخاص فقط.',
    },
    'svc-talent': {
      description: 'إدارة المواهب: اكتشاف، تصنيف، وتطوير الكفاءات وربطها بالأدوار داخل هوب.',
      points: ['تصنيف المواهب حسب الدور', 'مواءمة الموهبة مع الاحتياج', 'خطط تطوير فردية', 'متابعة الأداء والبقاء'],
      audience: 'لفلرق التوظيف والتطوير التنظيمي.',
    },
    'svc-cost-cut': {
      description: 'خفض التكاليف التشغيلية عبر منصة ساي فاي: ميزانيات، بطاقات متحكم بها، وتتبع لحظي للمصروف.',
      points: ['ضبط الميزانية حسب مركز التكلفة', 'بطاقات شركات بضوابط', 'تتبع المصروف لحظة بلحظة', 'حوكمة الموافقات والمدفوعات'],
      audience: 'للمدير المالي والتشغيلي الذي يريد سيطرة على الإنفاق.',
    },
    'svc-nocode': {
      description: 'بناء أنظمة وإجراءات بدون برمجة: نماذج، مسارات موافقة، ولوحات متابعة داخل هوب.',
      points: ['تصميم الإجراء بصريًا', 'نماذج إدخال وموافقات', 'ربط الإجراء بالصلاحيات', 'تشغيل سريع دون انتظار تطوير'],
      audience: 'للمديرين الذين يحتاجون نظامًا تشغيليًا اليوم وليس بعد شهور.',
    },
    'svc-cyber': {
      description: 'الأمن السيبراني للتشغيل: حماية الحسابات، الصلاحيات، والبيانات الحساسة داخل هوب والأنظمة المرتبطة.',
      points: ['مراجعة الصلاحيات والوصول', 'سياسات كلمة المرور والجلسات', 'تنبيهات النشاط غير المعتاد', 'إرشادات للفرق عند الحوادث'],
      audience: 'لفلرق التقنية والحوكمة التي تحمي بيانات التشغيل.',
    },
    'svc-attachments': {
      description: 'دمج المرفقات عند التحميل: الصورة والمستند والفيديو تُرفع مرة وتظهر في السجل والبحث دون تكرار.',
      points: ['رفع حتى 150 ميجابايت', 'ربط المرفق بالسجل الصحيح', 'معاينة الصور والفيديو', 'ظهور المرفق في مركز البحث'],
      audience: 'لأي فريق يرفق ملفات تشغيل يوميًا ويريد أرشفة مرتبة.',
    },
    'svc-bulk-msg': {
      description: 'رسائل جماعية للعملاء أو الفرق: نص موحّد، جمهور محدد، وسجل إرسال داخل هوب.',
      points: ['اختيار الشريحة المستهدفة', 'صياغة الرسالة واعتمادها', 'الإرسال الجماعي', 'تقرير الوصول والحالة'],
      audience: 'لفلرق خدمة العملاء والتسويق الداخلي والتشغيل.',
    },
    'svc-scanner': {
      description: 'تكامل مع الماسح الضوئي لأرشفة العقود والفواتير والمستندات مباشرة في ملف العميل أو العملية.',
      points: ['ربط الماسح بمسار الأرشفة', 'تحويل الورق إلى ملف داخل هوب', 'تصنيف المستند تلقائيًا قدر الإمكان', 'البحث عن المستند لاحقًا'],
      audience: 'للمكاتب التي ما زالت تستلم ورقًا وتريد أرشفة رقمية.',
    },
    'svc-quality-engine': {
      description: 'محرك تقييم الجودة يقيس الالتزام بالمعايير ويظهر الفجوات قبل أن تتحول إلى شكوى أو خسارة.',
      points: ['مؤشرات جودة حسب الخدمة', 'تقييم دوري للعمليات', 'تنبيه عند الانحراف', 'ربط النتيجة بخطة تحسين'],
      audience: 'لفلرق الجودة ومديري التشغيل.',
    },
    'svc-chat': {
      description: 'دردشة كتابية داخل هوب للتواصل السريع بين العميل والفريق مع حفظ السياق في السجل.',
      points: ['محادثة مربوطة بالطلب', 'تحويل الدردشة إلى تذكرة عند الحاجة', 'سجل كامل للنقاش', 'إشعارات لغرفة العمليات'],
      audience: 'لفلرق الدعم والعملاء الذين يفضلون الكتابة على المكالمة.',
    },
    'svc-pmo': {
      description: 'مكتب إدارة المشاريع: نطاق، جدول، مسؤول، ومتابعة إنجاز داخل هوب دون تشتت الأدوات.',
      points: ['تسجيل المشروع وأهدافه', 'توزيع المهام والمسؤوليات', 'متابعة التقدم والمخاطر', 'تقارير حالة للإدارة'],
      audience: 'لفلرق المشاريع والمؤسسات التي تدير عدة مبادرات معًا.',
    },
    'svc-performance': {
      description: 'إدارة الأداء المؤسسي: أهداف، مؤشرات، ومراجعة دورية تظهر في لوحة واحدة.',
      points: ['تحديد الأهداف والمؤشرات', 'جمع النتائج من الأنظمة', 'مراجعة دورية مع المسؤول', 'إجراءات تصحيحية موثّقة'],
      audience: 'للإدارة التنفيذية ومديري القطاعات.',
    },
    'svc-ops-follow': {
      description: 'متابعة العمليات اليومية: ماذا يعمل الآن، أين التأخير، ومن المسؤول — مربوط بآلية تشغيل هوب.',
      points: ['لوحة حالة العمليات', 'تنبيهات التأخير', 'سجل الإجراءات', 'ربط العملية بالنظام المصدر'],
      audience: 'لغرفة العمليات ومديري المناوبات.',
    },
    'svc-ai-market': {
      description: 'دراسة السوق عبر الذكاء الاصطناعي: جمع إشارات السوق، تلخيصها، وتحويلها إلى توصية تشغيل داخل هوب.',
      points: ['تحديد سؤال السوق', 'جمع وتحليل الإشارات', 'ملخص تنفيذي عربي', 'توصيات قابلة للتجربة'],
      audience: 'لفلرق النمو والتسويق والإدارة التي تقرر قبل الدخول لسوق جديد.',
    },
    'svc-customers': {
      description: 'خدمة العملاء من الاستقبال حتى الإغلاق: طلبات، شكاوي، تذاكر دعم، ومتابعة SLA داخل هوب.',
      points: ['قناة موحّدة للطلبات', 'تصنيف الأولوية والحالة', 'تحويل للقسم المختص', 'إغلاق مع تقييم العميل'],
      audience: 'لفلرق خدمة العملاء والدعم وأي منشأة تستقبل استفسارات يومية.',
    },
    'svc-admin': {
      description: 'خدمات إدارية للعميل والمنشأة: معاملات، خطابات، متابعة مستندات، وأرشفة داخل هوب.',
      points: ['طلب المعاملة الإدارية', 'تتبع المستندات المطلوبة', 'اعتماد داخلي', 'تسليم وأرشفة الناتج'],
      audience: 'للمكاتب الإدارية وخدمات العملاء المؤسسية.',
    },
    'svc-research': {
      description: 'البحوث التشغيلية: سؤال بحث، منهج، نتائج، وخيار النشر داخل مركز المعرفة.',
      points: ['صياغة سؤال البحث', 'جمع البيانات من التشغيل', 'تحليل ونتائج', 'نشر أو حفظ داخلي'],
      audience: 'لفلرق التطوير والجودة والجهات التي توثّق المعرفة.',
    },
    'svc-consult-train': {
      description: 'استشارات مربوطة بتدريب عملي: توصية ثم مسار تعلّم حتى يكتسب الفريق المهارة المطلوبة.',
      points: ['تشخيص الاحتياج التدريبي', 'خطة استشارة + تدريب', 'تنفيذ الجلسات أو المسار', 'قياس الاكتساب بعد التنفيذ'],
      audience: 'للشركات التي تريد تغيير سلوك التشغيل لا تقريرًا يُحفظ فقط.',
    },
    'svc-risk': {
      description: 'تقييم المخاطر التشغيلية والمالية والتقنية، مع خطة معالجة مربوطة بالمسؤول داخل هوب.',
      points: ['حصر المخاطر حسب العملية', 'تقدير الأثر والاحتمال', 'خطة معالجة ومالك لكل خطر', 'متابعة الإغلاق'],
      audience: 'للحوكمة والإدارة التنفيذية وفرق الالتزام.',
    },
    'svc-virtual-halls': {
      description: 'قاعات افتراضية للاجتماعات والتدريب والفعاليات، مع حجز ورابط حضور من هوب.',
      points: ['حجز القاعة والوقت', 'دعوة الحضور', 'إدارة الجلسة', 'تسجيل أو ملخص بعد الانتهاء'],
      audience: 'لفلرق التدريب والفعاليات والاجتماعات عن بُعد.',
    },
    'svc-feasibility': {
      description: 'دراسات جدوى للمشاريع والمنتجات: تكاليف، عوائد، مخاطر، وتوصية ابدأ / لا تبدأ.',
      points: ['نطاق المشروع والافتراضات', 'تحليل التكلفة والعائد', 'سيناريوهات المخاطر', 'توصية قرار واضحة'],
      audience: 'للمستثمرين والإدارة قبل إطلاق مشروع أو فرع أو منتج.',
    },
    'svc-supportive': {
      description: 'خدمات مساندة تشغيلية: تنسيق، دعم لوجستي، ومتابعة مهام لا تقع تحت قسم واحد.',
      points: ['استقبال طلب المساندة', 'توزيع المهمة للجهة المناسبة', 'متابعة الإنجاز', 'إغلاق الطلب بتأكيد العميل'],
      audience: 'للتشغيل اليومي عندما تحتاج مهمة سريعة خارج المسارات الأساسية.',
    },
    'svc-facilities': {
      description: 'إدارة المرافق والفعاليات: المكان، الجدول، التجهيز، والتكلفة داخل هوب.',
      points: ['حصر المرافق المتاحة', 'تخطيط الفعالية ومتطلباتها', 'التنفيذ يوم الحدث', 'تقرير بعد الفعالية'],
      audience: 'لفلرق الفعاليات والمرافق والعلاقات العامة.',
    },
    'svc-ads': {
      description: 'إدارة الحملات الإعلانية من الفكرة حتى القياس، مع ربط الميزانية والحسابات داخل هوب.',
      points: ['تخطيط الحملة والقناة', 'ضبط الميزانية', 'متابعة الأداء', 'تقرير نتائج الحملة'],
      audience: 'لفلرق التسويق والإعلان التي تريد حوكمة للإنفاق الإعلاني.',
    },
    'svc-social': {
      description: 'إدارة منصات التواصل: المحتوى، الجدولة، والردود مع ربط الحسابات بمنصات هوب.',
      points: ['ربط المنصات', 'خطة محتوى', 'نشر وجدولة', 'متابعة التفاعل والردود'],
      audience: 'لفلرق التواصل الاجتماعي والعلامات التجارية.',
    },
    'svc-safety': {
      description: 'خدمات الأمن والسلامة للمنشأة والفعالية: تعليمات، بلاغات، ومتابعة الحوادث.',
      points: ['سياسات السلامة', 'تسجيل البلاغات', 'إجراءات الإخلاء أو التدخل', 'تقرير بعد الحادث'],
      audience: 'لفلرق الأمن والسلامة ومديري المواقع.',
    },
    'svc-supply': {
      description: 'إدارة سلاسل الإمداد: مورد، طلب شراء، استلام، ومخزون مربوط بالتشغيل.',
      points: ['تسجيل الموردين', 'طلبات الشراء', 'تتبع الاستلام', 'ربط التكلفة بمركز التشغيل'],
      audience: 'لفلرق المشتريات والمستودعات والتشغيل الميداني.',
    },
    'svc-tracking': {
      description: 'تتبع الطلبات والشحنات من الإنشاء حتى التسليم، مع حالة واضحة للعميل والفريق.',
      points: ['إنشاء الطلب أو الشحنة', 'تحديث الحالة في الطريق', 'تنبيه عند التأخير', 'تأكيد التسليم'],
      audience: 'لفلرق التوصيل والمبيعات وخدمة العملاء.',
    },
    'svc-gov': {
      description: 'الحوكمة والأتمتة: سياسات، موافقات، ومسارات تقلل العمل اليدوي وتوثّق القرار.',
      points: ['توثيق السياسات', 'مسارات موافقة واضحة', 'أتمتة الخطوات المتكررة', 'سجل قرار قابل للمراجعة'],
      audience: 'للإدارة والحوكمة والالتزام.',
    },
    'svc-audit': {
      description: 'الجودة والتدقيق: مراجعة الالتزام بالمعايير، ملاحظات، وخطط تصحيحية داخل هوب.',
      points: ['خطة التدقيق', 'تنفيذ المراجعة', 'تسجيل الملاحظات', 'متابعة الإغلاق التصحيحي'],
      audience: 'لفلرق الجودة والتدقيق الداخلي.',
    },
    'svc-ip': {
      description: 'الملكية الفكرية: تسجيل الأصول، حمايتها، وتتبع الاستخدام داخل مشاريع هوب.',
      points: ['حصر الأصول الفكرية', 'توثيق الملكية', 'تنبيهات الاستخدام', 'ربط الأصل بالمشروع'],
      audience: 'للشركات التي تنتج محتوى أو أنظمة أو علامات تجارية.',
    },
    'svc-franchise': {
      description: 'العقود والفرنشايز: نماذج تعاقد، التزامات، ومتابعة البنود التشغيلية بعد التوقيع.',
      points: ['نماذج العقود', 'متابعة البنود', 'التزامات الطرفين', 'تنبيهات التجديد'],
      audience: 'لفلرق التوسع القانوني والتشغيلي ونماذج الفرنشايز.',
    },
    'svc-sustain': {
      description: 'الاستدامة التشغيلية: مؤشرات بيئية وتشغيلية، مبادرات، وقياس الأثر داخل هوب.',
      points: ['تحديد مؤشرات الاستدامة', 'تسجيل المبادرات', 'قياس الأثر', 'تقرير للإدارة'],
      audience: 'للمنشآت التي تربط التشغيل بمعايير استدامة واضحة.',
    },
    'svc-sysops': {
      description: 'تشغيل الأنظمة من هوب: فتح النظام، صلاحياته، وخدماته فقط داخله مع بقاء هوب مركزًا موحّدًا.',
      points: ['دخول الأنظمة من أيقونة واحدة', 'خدمات النظام تظهر داخله فقط', 'تقارير الحالة إلى هوب', 'SSO وصلاحيات الاشتراك'],
      audience: 'لكل مستخدم يشغّل أنظمة نايوش يوميًا من غرفة العمليات.',
    },
  };

  const pageHref = (id) => `service.html?id=${encodeURIComponent(id)}`;

  const withDefaults = (item, custom = false) => {
    const extra = DETAILS[item.id] || {};
    const description = String(item.description || extra.description || '').trim();
    const points = Array.isArray(item.points) && item.points.length ? item.points : extra.points || FALLBACK_POINTS;
    const steps = Array.isArray(item.steps) && item.steps.length ? item.steps : extra.steps || FALLBACK_STEPS;
    const audience = String(item.audience || extra.audience || 'لأي منشأة تشغّل عبر نايوش هوب وتريد مسار خدمة واضح.').trim();
    return {
      id: item.id,
      title: String(item.title || '').trim(),
      icon: item.icon || 'fa-concierge-bell',
      description:
        description ||
        `خدمة ${String(item.title || '').trim()} داخل نايوش هوب: طلب، متابعة، وتسليم مربوط بغرفة العمليات.`,
      points,
      steps,
      audience,
      keywords: String(item.keywords || '').trim(),
      relatedHref: String(item.relatedHref || '').trim(),
      imageUrl: String(item.imageUrl || '').trim(),
      videoUrl: String(item.videoUrl || '').trim(),
      custom,
      href: pageHref(item.id),
    };
  };

  const readCustom = () => {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };

  const saveCustom = (list) => {
    localStorage.setItem(KEY, JSON.stringify(list));
    return list;
  };

  const uid = () => `svc-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const builtins = () => DEFAULT_SERVICES.map((s) => withDefaults(s, false));

  const customList = () => readCustom().map((s) => withDefaults(s, true));

  const list = () => [...customList(), ...builtins()];

  const get = (id) => list().find((s) => String(s.id) === String(id)) || null;

  const add = (payload = {}) => {
    const title = String(payload.title || '').trim();
    if (!title) return { ok: false, error: 'اسم الخدمة مطلوب' };
    const item = {
      id: payload.id || uid(),
      title,
      icon: String(payload.icon || 'fa-concierge-bell').trim() || 'fa-concierge-bell',
      description: String(payload.description || '').trim(),
      points: Array.isArray(payload.points) ? payload.points : undefined,
      audience: String(payload.audience || '').trim(),
      keywords: String(payload.keywords || title).trim(),
      relatedHref: String(payload.relatedHref || '').trim(),
      imageUrl: String(payload.imageUrl || '').trim(),
      videoUrl: String(payload.videoUrl || '').trim(),
      createdAt: new Date().toISOString(),
    };
    const all = readCustom();
    all.unshift(item);
    saveCustom(all);
    return { ok: true, item: withDefaults(item, true) };
  };

  const remove = (id) => {
    const next = readCustom().filter((s) => String(s.id) !== String(id));
    if (next.length === readCustom().length) return { ok: false, error: 'لا يمكن حذف الخدمات الأساسية' };
    saveCustom(next);
    return { ok: true };
  };

  const ingestFile = async (file, { onProgress } = {}) => {
    const limits = window.HubUploadLimits || {};
    if (!file) throw new Error('لا ملف');
    const check = limits.assertFile ? limits.assertFile(file) : { ok: true };
    if (!check.ok) throw new Error(check.error || 'حجم الملف غير مسموح');
    if (!limits.uploadFile) throw new Error('رفع الملفات يحتاج اتصالاً بالخادم');
    const uploaded = await limits.uploadFile(file, { onProgress });
    return { url: uploaded.url, mime: uploaded.mime || file.type, name: file.name };
  };

  const toSearchItems = () =>
    list().map((svc) => ({
      id: svc.id,
      type: 'service',
      typeAr: 'خدمة',
      icon: svc.icon,
      title: svc.title,
      pageTitle: svc.title,
      subtitle: svc.description || 'خدمة من كتالوج خدماتنا',
      meta: 'خدماتنا',
      href: svc.href,
      preview: svc.imageUrl || '',
      source: 'services',
      keywords: ['خدماتنا', 'خدمة', 'خدمات', svc.title, svc.keywords, svc.id].filter(Boolean).join(' '),
    }));

  window.HubServicesCatalog = {
    DEFAULT_SERVICES,
    KEY,
    pageHref,
    list,
    get,
    add,
    remove,
    ingestFile,
    toSearchItems,
  };
})();
