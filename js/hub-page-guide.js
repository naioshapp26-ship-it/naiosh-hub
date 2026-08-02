(() => {
  const PAGE_GUIDES = {
    home: {
      test: (path) => path.endsWith('/') || path.endsWith('/index.html') || path === '' || /index\.html?$/.test(path),
      title: 'دليل نايوش هوب',
      subtitle: 'تعرّف على الصفحة الرئيسية وطبقات المنصة وغرفة العمليات.',
      purpose: 'الصفحة الرئيسية تعرض هوية نايوش هوب 360، الطبقات التشغيلية، تدفق النظام، ومسارات التنفيذ.',
      tips: [
        'استخدم روابط الشريط العلوي للانتقال السريع بين الأقسام.',
        'زر «غرفة العمليات» يفتح لوحة السيادة التشغيلية بعد تسجيل الدخول.',
        'قسم الانضمام أسفل الصفحة لاستقبال طلبات الحسابات الجديدة.',
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
      purpose: 'غرفة العمليات تعرض مؤشرات الأداء، الطبقات، المحاور، والتقارير السيادية للمنصة.',
      tips: [
        'تنقّل بين الطبقات من القائمة الجانبية.',
        'استخدم «إعادة حساب» لتحديث المؤشرات بعد أي تغيير.',
        'زر الرجوع أعلى الصفحة يعيدك للصفحة السابقة أو الرئيسية.',
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
