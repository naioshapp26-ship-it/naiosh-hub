(() => {
  const ACTIONS = [
    { key: 'view', title: 'معاينة', icon: 'fa-eye', cls: 'hub-act-view' },
    { key: 'edit', title: 'تعديل', icon: 'fa-pen', cls: 'hub-act-edit' },
    { key: 'assign', title: 'تعيين', icon: 'fa-user-check', cls: 'hub-act-assign' },
    { key: 'delete', title: 'حذف', icon: 'fa-trash', cls: 'hub-act-delete' },
    { key: 'archive', title: 'أرشفة', icon: 'fa-archive', cls: 'hub-act-archive' },
  ];

  const ENTITY_LABELS = {
    apps: 'نظام',
    store: 'منتج / خدمة متجر',
    ads: 'إعلان',
    events: 'فعالية',
    products: 'منتج',
    incubators: 'حاضنة',
    tasks: 'مهمة',
    employees: 'موظف',
    policies: 'سياسة',
    systems: 'نظام سوق',
    connectors: 'موصل',
    platforms: 'منصة',
    branches: 'فرع',
    offices: 'مكتب إلكتروني',
    generic: 'سجل',
  };

  const FIELD_LABELS = {
    id: 'المعرّف',
    sku: 'الرمز',
    code: 'الكود',
    name: 'الاسم',
    nameAr: 'الاسم',
    title: 'العنوان',
    brand: 'العلامة',
    platform: 'المنصة',
    platformCode: 'كود المنصة',
    category: 'التصنيف',
    subcategory: 'التصنيف الفرعي',
    productType: 'نوع المنتج',
    itemKind: 'النوع',
    price: 'السعر',
    points: 'النقاط',
    stock: 'المخزون',
    sold: 'المبيعات',
    status: 'الحالة',
    publishStatus: 'حالة النشر',
    movement: 'الحركة',
    desc: 'شرح مبسط عن المنتج',
    description: 'شرح مبسط عن المنتج',
    adStartDate: 'تاريخ بداية الإعلان',
    adEndDate: 'تاريخ نهاية الإعلان',
    appearancePlaces: 'مكان ظهور الإعلان',
    socialShares: 'مشاركة منصات نايوش',
    publishTargets: 'مكان رفع الإعلان',
    companyName: 'اسم الشركة',
    companyAddress: 'عنوان الشركة',
    content: 'المحتوى',
    badge: 'الوسم',
    type: 'النوع',
    kind: 'النوع',
    date: 'التاريخ',
    time: 'الوقت',
    duration: 'المدة',
    speaker: 'المتحدث',
    department: 'القسم',
    assignee: 'المسؤول المعيّن',
    assignNote: 'ملاحظة التعيين',
    assignedAt: 'وقت التعيين',
    health: 'الصحة',
    views: 'المشاهدات',
    level: 'المستوى',
    sector: 'القطاع',
    members: 'الأعضاء',
    offices: 'المكاتب',
    platforms: 'المنصات',
    url: 'الرابط',
    icon: 'الأيقونة',
    priority: 'الأولوية',
    project: 'المشروع',
    quality: 'الجودة',
    scope: 'النطاق',
    role: 'الدور',
    hours: 'الساعات',
    productivity: 'الإنتاجية',
    score: 'الدرجة',
    warned: 'إنذار سابق',
    nameEn: 'الاسم الإنجليزي',
    flagAlt: 'وصف العلم',
    archivedAt: 'تاريخ الأرشفة',
    party1Name: 'طرف أول',
    party1Phone: 'جوال الطرف الأول',
    party2Name: 'طرف ثاني',
    party2Phone: 'جوال الطرف الثاني',
    branch: 'الفرع',
    incubator: 'الحاضنة',
    office: 'المكتب',
    docName: 'مستند',
    imageName: 'صورة',
    videoName: 'فيديو',
  };

  const HIDDEN_KEYS = new Set(['icon', 'flag', 'imageDataUrl']);

  const COMMON_META_KEYS = [
    'companyName',
    'companyAddress',
    'party1Name',
    'party1Phone',
    'party2Name',
    'party2Phone',
    'branch',
    'incubator',
    'platform',
    'office',
    'docName',
    'imageName',
    'videoName',
    'imageDataUrl',
  ];

  const optionList = (items, fallback) => {
    const list = (items || []).filter(Boolean);
    if (!list.length) return fallback;
    return list;
  };

  const hierarchyOptions = () => {
    const store = window.HubStore?.get?.();
    const branches = optionList(
      (store?.empire?.organization?.worldBranches || []).map((b) => b.nameAr || b.name),
      ['المقر الرئيسي', 'السعودية', 'مصر', 'الإمارات']
    );
    const incubators = optionList(
      (store?.empire?.organization?.incubators || []).map((i) => i.name),
      ['حاضنة تقنية', 'حاضنة سياحة', 'حاضنة صحة']
    );
    const platforms = optionList(
      (window.HubSovereignPlatforms?.list || store?.empire?.organization?.platforms || []).map(
        (p) => p.nameAr || p.name || p.code
      ),
      ['النظام التشغيلي الموحد', 'إدارة الموارد', 'التسويق والهوية']
    );
    const offices = ['المكتب الرئيسي', 'المكتب التشغيلي', 'المكتب الرقمي', 'مكتب الفروع'];
    return { branches, incubators, platforms, offices };
  };

  const selectHtml = (id, label, options, value = '', required = false) => `
    <label>${esc(label)}
      <select id="hub-field-${esc(id)}" ${required ? 'required' : ''}>
        <option value="">— اختر —</option>
        ${options
          .map((o) => `<option value="${esc(o)}" ${o === value ? 'selected' : ''}>${esc(o)}</option>`)
          .join('')}
      </select>
    </label>`;

  const commonMetaFormHtml = (values = {}) => {
    const opts = hierarchyOptions();
    return `
      <div class="hub-form-block hub-common-meta">
        <h4><i class="fas fa-sitemap"></i> الشركة · الأطراف · الفرع · الحاضنة · المنصة · المرفقات</h4>
        <div class="hub-form-grid">
          <label>اسم الشركة
            <input id="hub-field-companyName" type="text" value="${esc(values.companyName || '')}" required placeholder="اسم الشركة المقدِّمة للمنتج" />
          </label>
          <label>عنوان الشركة
            <input id="hub-field-companyAddress" type="text" value="${esc(values.companyAddress || '')}" required placeholder="العنوان / المدينة" />
          </label>
          <label>طرف أول
            <input id="hub-field-party1Name" type="text" value="${esc(values.party1Name || '')}" required placeholder="اسم الطرف الأول" />
          </label>
          <label>رقم جوال الطرف الأول
            <input id="hub-field-party1Phone" type="tel" value="${esc(values.party1Phone || '')}" required placeholder="05xxxxxxxx" />
          </label>
          <label>طرف ثاني
            <input id="hub-field-party2Name" type="text" value="${esc(values.party2Name || '')}" required placeholder="اسم الطرف الثاني" />
          </label>
          <label>رقم جوال الطرف الثاني
            <input id="hub-field-party2Phone" type="tel" value="${esc(values.party2Phone || '')}" required placeholder="05xxxxxxxx" />
          </label>
          ${selectHtml('branch', 'الفرع (من قائمة الفروع)', opts.branches, values.branch || '', true)}
          ${selectHtml('incubator', 'الحاضنة (من قائمة الحاضنات)', opts.incubators, values.incubator || '', true)}
          ${selectHtml('platform', 'المنصة (من قائمة المنصات)', opts.platforms, values.platform || '', true)}
          ${selectHtml('office', 'المكتب', opts.offices, values.office || '', true)}
        </div>
        <div class="hub-upload-grid">
          <label class="hub-upload-card">رفع ملف / مستند
            <input id="hub-field-docFile" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*" />
            <small>${esc(values.docName || 'PDF · Word · Excel')}</small>
          </label>
          <label class="hub-upload-card">رفع صورة
            <input id="hub-field-imageFile" type="file" accept="image/*" />
            <small>${esc(values.imageName || 'PNG · JPG · WEBP')}</small>
          </label>
          <label class="hub-upload-card">رفع فيديو
            <input id="hub-field-videoFile" type="file" accept="video/*" />
            <small>${esc(values.videoName || 'MP4 · MOV · WEBM')}</small>
          </label>
        </div>
      </div>`;
  };

  const readFileMeta = (input) =>
    new Promise((resolve) => {
      const file = input?.files?.[0];
      if (!file) return resolve(null);
      const base = { name: file.name, type: file.type, size: file.size, dataUrl: '' };
      if (file.type.startsWith('image/') && file.size <= 1_500_000) {
        const reader = new FileReader();
        reader.onload = () => resolve({ ...base, dataUrl: String(reader.result || '') });
        reader.onerror = () => resolve(base);
        reader.readAsDataURL(file);
        return;
      }
      resolve(base);
    });

  const collectCommonMeta = async (fallback = {}) => {
    const val = (id) => document.getElementById(`hub-field-${id}`)?.value.trim() || '';
    const companyName = val('companyName');
    const companyAddress = val('companyAddress');
    const party1Name = val('party1Name');
    const party1Phone = val('party1Phone');
    const party2Name = val('party2Name');
    const party2Phone = val('party2Phone');
    const branch = val('branch');
    const incubator = val('incubator');
    const platform = val('platform');
    const office = val('office');
    if (!companyName) return { error: 'اسم الشركة مطلوب' };
    if (!companyAddress) return { error: 'عنوان الشركة مطلوب' };
    if (!party1Name) return { error: 'طرف أول مطلوب' };
    if (!party1Phone) return { error: 'جوال الطرف الأول مطلوب' };
    if (!party2Name) return { error: 'طرف ثاني مطلوب' };
    if (!party2Phone) return { error: 'جوال الطرف الثاني مطلوب' };
    if (!branch) return { error: 'الفرع مطلوب' };
    if (!incubator) return { error: 'الحاضنة مطلوبة' };
    if (!platform) return { error: 'المنصة مطلوبة' };
    if (!office) return { error: 'المكتب مطلوب' };

    const [doc, image, video] = await Promise.all([
      readFileMeta(document.getElementById('hub-field-docFile')),
      readFileMeta(document.getElementById('hub-field-imageFile')),
      readFileMeta(document.getElementById('hub-field-videoFile')),
    ]);

    return {
      companyName,
      companyAddress,
      party1Name,
      party1Phone,
      party2Name,
      party2Phone,
      branch,
      incubator,
      platform,
      office,
      docName: doc?.name || fallback.docName || '',
      imageName: image?.name || fallback.imageName || '',
      videoName: video?.name || fallback.videoName || '',
      imageDataUrl: image?.dataUrl || fallback.imageDataUrl || '',
    };
  };

  const metaColumnsHeader = () =>
    `<th>طرف أول</th><th>جوال ١</th><th>طرف ثاني</th><th>جوال ٢</th><th>الفرع</th><th>الحاضنة</th><th>المنصة</th><th>المكتب</th><th>مرفقات</th>`;

  const metaCells = (item = {}) => {
    const parts = [];
    if (item.docName) parts.push(`<i class="fas fa-file-lines" title="${esc(item.docName)}"></i>`);
    if (item.imageName) parts.push(`<i class="fas fa-image" title="${esc(item.imageName)}"></i>`);
    if (item.videoName) parts.push(`<i class="fas fa-video" title="${esc(item.videoName)}"></i>`);
    const files = parts.length ? parts.join(' ') : '—';
    return `<td>${esc(item.party1Name || '—')}</td>
      <td>${esc(item.party1Phone || '—')}</td>
      <td>${esc(item.party2Name || '—')}</td>
      <td>${esc(item.party2Phone || '—')}</td>
      <td>${esc(item.branch || '—')}</td>
      <td>${esc(item.incubator || '—')}</td>
      <td>${esc(item.platform || '—')}</td>
      <td>${esc(item.office || '—')}</td>
      <td title="${esc([item.docName, item.imageName, item.videoName].filter(Boolean).join(' · '))}">${files}</td>`;
  };

  const metaCardLine = (item = {}) => {
    if (!item.party1Name && !item.branch) return '';
    return `<div class="hub-meta-line">
      <span>${esc(item.party1Name || '—')} / ${esc(item.party2Name || '—')}</span>
      <span>${esc(item.branch || '—')} · ${esc(item.incubator || '—')}</span>
      <span>${esc(item.platform || '—')} · ${esc(item.office || '—')}</span>
    </div>`;
  };

  const toast = (msg) => {
    let el = document.getElementById('hub-toast-mini');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hub-toast-mini';
      el.className = 'hub-toast-mini';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2200);
  };

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const rowHtml = (entity, id, opts = {}) => {
    const extra = opts.extra || '';
    const buttons = ACTIONS.map(
      (a) =>
        `<button type="button" class="hub-act ${a.cls}" data-hub-act="${a.key}" data-entity="${entity}" data-id="${id}" title="${a.title}" aria-label="${a.title}"><i class="fas ${a.icon}"></i></button>`
    ).join('');
    return `<div class="hub-row-actions" data-entity="${entity}" data-id="${id}">${buttons}${extra}</div>`;
  };

  const toolbarHtml = (entity, label) => {
    const name = label || `إضافة ${ENTITY_LABELS[entity] || 'سجل'}`;
    return `<div class="hub-page-actions" data-entity="${entity}">
      <button type="button" class="hub-page-act" data-hub-act="add" data-entity="${entity}"><i class="fas fa-plus"></i> ${name}</button>
    </div>`;
  };

  const ensurePageToolbar = () => {
    const page = document.body?.dataset?.marketPage || document.body?.dataset?.hubEntity;
    if (!page) return;
    // platforms page is a read-only sovereign catalog — no CRUD toolbar
    const map = {
      apps: 'apps',
      store: 'store',
      ads: 'ads',
      events: 'events',
      products: 'products',
      branches: 'branches',
      incubators: 'incubators',
      platforms: 'platforms',
    };
    const entity = map[page];
    if (!entity) return;
    if (document.querySelector(`.hub-page-actions[data-entity="${entity}"]`)) return;
    const host =
      document.querySelector('.market-hero') ||
      document.querySelector('.shop-top') ||
      document.querySelector('.products-hero') ||
      document.querySelector('.branches-head') ||
      document.querySelector('.branches-showcase') ||
      document.querySelector('.incubators-hero-head') ||
      document.querySelector('.incubators-hero') ||
      document.querySelector('.platforms-hero') ||
      document.querySelector('main .container') ||
      document.querySelector('main');
    if (!host) return;
    const bar = document.createElement('div');
    bar.innerHTML = toolbarHtml(entity);
    const node = bar.firstElementChild;
    if (
      host.classList.contains('market-hero') ||
      host.classList.contains('shop-top') ||
      host.classList.contains('products-hero') ||
      host.classList.contains('branches-head') ||
      host.classList.contains('branches-showcase') ||
      host.classList.contains('incubators-hero-head') ||
      host.classList.contains('incubators-hero') ||
      host.classList.contains('platforms-hero')
    ) {
      host.appendChild(node);
    } else {
      host.prepend(node);
    }
  };

  const afterChange = (entity, action, id) => {
    window.dispatchEvent(new CustomEvent('hub-data-changed', { detail: { entity, action, id } }));
    if (typeof window.hubRerender === 'function') window.hubRerender();
    else setTimeout(() => location.reload(), 350);
  };

  const recordTitle = (item) => item?.nameAr || item?.title || item?.name || item?.sku || item?.code || item?.id || 'سجل';

  const detailsGrid = (item) => {
    if (!item) return '<p class="hub-modal-empty">لا توجد بيانات لهذا السجل.</p>';
    const rows = Object.entries(item)
      .filter(([k, v]) => !HIDDEN_KEYS.has(k) && v !== undefined && v !== null && v !== '')
      .map(([k, v]) => {
        const label = FIELD_LABELS[k] || k;
        const val = typeof v === 'object' ? JSON.stringify(v) : v;
        return `<div class="hub-detail-row"><span>${esc(label)}</span><strong>${esc(val)}</strong></div>`;
      })
      .join('');
    return `<div class="hub-detail-grid">${rows}</div>`;
  };

  const ensureModal = () => {
    let modal = document.getElementById('hub-erp-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'hub-erp-modal';
    modal.className = 'hub-erp-modal';
    modal.innerHTML = `
      <div class="hub-erp-dialog" role="dialog" aria-modal="true" aria-labelledby="hub-erp-modal-title">
        <header class="hub-erp-head">
          <div>
            <p class="hub-erp-kicker" id="hub-erp-modal-kicker">تفاصيل السجل</p>
            <h3 id="hub-erp-modal-title">نموذج</h3>
          </div>
          <button type="button" class="hub-erp-close" data-hub-modal-close aria-label="إغلاق"><i class="fas fa-xmark"></i></button>
        </header>
        <div class="hub-erp-body" id="hub-erp-modal-body"></div>
        <footer class="hub-erp-foot" id="hub-erp-modal-foot"></footer>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('[data-hub-modal-close]')) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });
    return modal;
  };

  const closeModal = () => {
    const modal = document.getElementById('hub-erp-modal');
    if (modal) modal.classList.remove('open');
  };

  const openModal = ({ title, kicker, body, foot }) => {
    const modal = ensureModal();
    document.getElementById('hub-erp-modal-title').textContent = title;
    document.getElementById('hub-erp-modal-kicker').textContent = kicker || 'نموذج نايوش هوب';
    document.getElementById('hub-erp-modal-body').innerHTML = body;
    document.getElementById('hub-erp-modal-foot').innerHTML = foot || '';
    modal.classList.add('open');
    return modal;
  };

  const openView = (entity, id) => {
    const item = window.HubStore?.getEntity?.(entity, id);
    if (!item) return toast('السجل غير موجود');
    openModal({
      title: recordTitle(item),
      kicker: `معاينة · ${ENTITY_LABELS[entity] || 'سجل'}`,
      body: detailsGrid(item),
      foot: `
        <button type="button" class="hub-erp-btn ghost" data-hub-modal-close>إغلاق</button>
        <button type="button" class="hub-erp-btn teal" data-hub-modal-go="assign" data-entity="${esc(entity)}" data-id="${esc(id)}"><i class="fas fa-user-check"></i> تعيين</button>
        <button type="button" class="hub-erp-btn blue" data-hub-modal-go="edit" data-entity="${esc(entity)}" data-id="${esc(id)}"><i class="fas fa-pen"></i> تعديل</button>`,
    });
  };

  const openAssign = (entity, id) => {
    const item = window.HubStore?.getEntity?.(entity, id);
    if (!item) return toast('السجل غير موجود');
    openModal({
      title: `تعيين · ${recordTitle(item)}`,
      kicker: `نموذج تعيين ${ENTITY_LABELS[entity] || 'سجل'}`,
      body: `
        ${detailsGrid(item)}
        <div class="hub-form-block">
          <h4><i class="fas fa-user-check"></i> بيانات التعيين</h4>
          <label>اسم المسؤول المعيّن
            <input id="hub-assign-name" type="text" value="${esc(item.assignee || '')}" placeholder="مثال: أحمد محمد — غرفة العمليات" />
          </label>
          <label>ملاحظة التعيين
            <textarea id="hub-assign-note" rows="3" placeholder="اكتب تفاصيل المهمة أو سبب التعيين…">${esc(item.assignNote || '')}</textarea>
          </label>
        </div>`,
      foot: `
        <button type="button" class="hub-erp-btn ghost" data-hub-modal-close>إلغاء</button>
        <button type="button" class="hub-erp-btn teal" id="hub-assign-save" data-entity="${esc(entity)}" data-id="${esc(id)}"><i class="fas fa-check"></i> حفظ التعيين</button>`,
    });
    document.getElementById('hub-assign-save')?.addEventListener('click', () => {
      const assignee = document.getElementById('hub-assign-name')?.value.trim();
      const assignNote = document.getElementById('hub-assign-note')?.value.trim();
      if (!assignee) return toast('اكتب اسم المسؤول');
      const ok = window.HubStore.entityAction(entity, id, 'assign', { assignee, assignNote });
      if (!ok) return toast('تعذّر التعيين');
      closeModal();
      toast(`تم التعيين إلى ${assignee}`);
      afterChange(entity, 'assign', id);
    });
  };

  const openEdit = (entity, id) => {
    const item = window.HubStore?.getEntity?.(entity, id);
    if (!item) return toast('السجل غير موجود');
    const current = recordTitle(item);
    const extraFields =
      entity === 'employees'
        ? `<label>الدور
            <input id="hub-edit-role" type="text" value="${esc(item.role || '')}" />
          </label>`
        : '';
    openModal({
      title: `تعديل · ${current}`,
      kicker: `نموذج تعديل ${ENTITY_LABELS[entity] || 'سجل'}`,
      body: `
        ${detailsGrid(item)}
        <div class="hub-form-block">
          <h4><i class="fas fa-pen"></i> تعديل البيانات</h4>
          <label>الاسم / العنوان
            <input id="hub-edit-title" type="text" value="${esc(current)}" />
          </label>
          ${extraFields}
        </div>
        ${commonMetaFormHtml(item)}`,
      foot: `
        <button type="button" class="hub-erp-btn ghost" data-hub-modal-close>إلغاء</button>
        <button type="button" class="hub-erp-btn blue" id="hub-edit-save" data-entity="${esc(entity)}" data-id="${esc(id)}"><i class="fas fa-check"></i> حفظ التعديل</button>`,
    });
    document.getElementById('hub-edit-save')?.addEventListener('click', async () => {
      const title = document.getElementById('hub-edit-title')?.value.trim();
      if (!title) return toast('العنوان مطلوب');
      const meta = await collectCommonMeta(item);
      if (meta.error) return toast(meta.error);
      const patch = { title, ...meta };
      if (entity === 'employees') {
        patch.role = document.getElementById('hub-edit-role')?.value.trim() || item.role || 'تشغيل';
      }
      const ok = window.HubStore.entityAction(entity, id, 'edit', patch);
      if (!ok) return toast('تعذّر التعديل');
      closeModal();
      toast('تم التعديل');
      afterChange(entity, 'edit', id);
    });
  };

  const openConfirm = (entity, id, action) => {
    const item = window.HubStore?.getEntity?.(entity, id);
    if (!item) return toast('السجل غير موجود');
    const isDelete = action === 'delete';
    openModal({
      title: isDelete ? `حذف · ${recordTitle(item)}` : `أرشفة · ${recordTitle(item)}`,
      kicker: isDelete ? 'تأكيد الحذف' : 'تأكيد الأرشفة',
      body: `
        ${detailsGrid(item)}
        <div class="hub-form-block warn">
          <p>${isDelete ? 'سيتم حذف السجل نهائيًا من القائمة.' : 'سيتم أرشفة السجل وإخفاؤه من العرض النشط.'}</p>
        </div>`,
      foot: `
        <button type="button" class="hub-erp-btn ghost" data-hub-modal-close>إلغاء</button>
        <button type="button" class="hub-erp-btn ${isDelete ? 'red' : 'slate'}" id="hub-confirm-save"><i class="fas ${isDelete ? 'fa-trash' : 'fa-archive'}"></i> تأكيد</button>`,
    });
    document.getElementById('hub-confirm-save')?.addEventListener('click', () => {
      const ok = window.HubStore.entityAction(entity, id, action);
      if (!ok) return toast(isDelete ? 'تعذّر الحذف' : 'تعذّرت الأرشفة');
      closeModal();
      toast(isDelete ? 'تم الحذف' : 'تمت الأرشفة');
      afterChange(entity, action, id);
    });
  };

  const ADD_FORMS = {
    apps: {
      title: 'إضافة نظام',
      fields: [
        { id: 'nameAr', label: 'اسم النظام', required: true },
        { id: 'code', label: 'رمز النظام', value: 'SYS', required: true },
        { id: 'category', label: 'التصنيف', value: 'أنظمة نايوش' },
        { id: 'url', label: 'رابط التشغيل المباشر', value: 'systems/erp.html' },
      ],
      save: (v) =>
        window.HubStore.registerApp({
          nameAr: v.nameAr,
          code: v.code,
          kind: 'system',
          category: v.category || 'أنظمة نايوش',
          url: v.url || `systems/${String(v.code || 'sys').toLowerCase()}.html`,
          launchUrl: v.url || `systems/${String(v.code || 'sys').toLowerCase()}.html`,
          standaloneUrl: v.url || `systems/${String(v.code || 'sys').toLowerCase()}.html`,
          ...v,
        }),
    },
    systems: {
      title: 'إضافة نظام للسوق',
      fields: [
        { id: 'name', label: 'اسم النظام', required: true },
        { id: 'category', label: 'التصنيف', value: 'تشغيل' },
      ],
      save: (v) => window.HubStore.addMarketSystem?.(v),
    },
    store: {
      title: 'رفع منتج / خدمة على المتجر',
      fields: [
        { id: 'title', label: 'اسم المنتج أو الخدمة', required: true },
        { id: 'brand', label: 'العلامة', value: 'نايوش هوب' },
        {
          id: 'category',
          label: 'التصنيف الرئيسي',
          type: 'select',
          required: true,
          optionsFrom: 'storeCategories',
          value: 'تشغيل',
        },
        {
          id: 'itemKind',
          label: 'النوع',
          type: 'select',
          required: true,
          options: [
            { value: 'منتج', label: 'منتج' },
            { value: 'خدمة', label: 'خدمة' },
          ],
          value: 'منتج',
        },
        { id: 'price', label: 'السعر', value: '1000', type: 'number', required: true },
        { id: 'stock', label: 'المخزون', value: '20', type: 'number' },
        { id: 'points', label: 'النقاط', value: '50', type: 'number' },
        { id: 'sku', label: 'رمز SKU', value: '' },
        { id: 'platformCode', label: 'رمز المنصة', value: 'ACADEMY' },
        { id: 'desc', label: 'الوصف', value: '' },
      ],
      includeMarketplaces: true,
      save: (v) => window.HubStore.addStoreItem({ ...v, name: v.title, mirrorToCatalog: true }),
    },
    ads: {
      title: 'رفع إعلان نايوش',
      fields: [
        { id: 'title', label: 'عنوان الإعلان', required: true },
        { id: 'brand', label: 'العلامة / العلامة التجارية', value: 'نايوش هوب' },
        {
          id: 'adLevel',
          label: 'المستوى التشغيلي',
          type: 'select',
          required: true,
          optionsFrom: 'adOrgLevels',
          value: 'platform',
        },
        {
          id: 'productType',
          label: 'نوع المنتج',
          type: 'select',
          required: true,
          options: [
            { value: 'رقمية', label: 'رقمية' },
            { value: 'خدمية', label: 'خدمية' },
            { value: 'عينية', label: 'عينية' },
          ],
          value: 'رقمية',
        },
        {
          id: 'category',
          label: 'التصنيف',
          type: 'select',
          required: true,
          optionsFrom: 'storeCategories',
          value: 'إعلانات',
        },
        {
          id: 'subcategory',
          label: 'التصنيف الفرعي',
          type: 'select',
          optionsFrom: 'subcategories',
          value: '',
        },
        { id: 'price', label: 'السعر', value: '1000', type: 'number' },
        { id: 'adStartDate', label: 'تاريخ بداية الإعلان', type: 'date', required: true, value: new Date().toISOString().slice(0, 10) },
        { id: 'adEndDate', label: 'تاريخ نهاية الإعلان', type: 'date', required: true, value: '' },
        { id: 'desc', label: 'شرح مبسط عن المنتج / الإعلان', type: 'textarea', required: true, value: '' },
      ],
      includeProductExtras: true,
      includeAdTargets: true,
      save: (v) => window.HubStore.addAdListing?.(v),
    },
    events: {
      title: 'إضافة فعالية',
      fields: [
        { id: 'name', label: 'اسم الفعالية', required: true },
        { id: 'description', label: 'الوصف', value: 'فعالية من هوب' },
        { id: 'date', label: 'التاريخ', type: 'date', value: new Date().toISOString().slice(0, 10) },
      ],
      save: (v) => window.HubStore.addEvent({ ...v, status: 'قادمة' }),
    },
    products: {
      title: 'رفع منتج نايوش',
      fields: [
        { id: 'name', label: 'اسم المنتج', required: true },
        { id: 'brand', label: 'العلامة / العلامة التجارية', value: 'نايوش هوب' },
        {
          id: 'productType',
          label: 'نوع المنتج',
          type: 'select',
          required: true,
          options: [
            { value: 'رقمية', label: 'رقمية' },
            { value: 'خدمية', label: 'خدمية' },
            { value: 'عينية', label: 'عينية' },
          ],
          value: 'رقمية',
        },
        {
          id: 'category',
          label: 'التصنيف',
          type: 'select',
          required: true,
          optionsFrom: 'storeCategories',
          value: 'تشغيل',
        },
        {
          id: 'subcategory',
          label: 'التصنيف الفرعي',
          type: 'select',
          optionsFrom: 'subcategories',
          value: '',
        },
        { id: 'price', label: 'السعر', value: '1000', type: 'number' },
        { id: 'stock', label: 'المخزون', value: '20', type: 'number' },
        { id: 'sku', label: 'رمز SKU', value: '' },
        { id: 'adStartDate', label: 'تاريخ بداية الإعلان', type: 'date', required: true, value: new Date().toISOString().slice(0, 10) },
        { id: 'adEndDate', label: 'تاريخ نهاية الإعلان', type: 'date', required: true, value: '' },
        { id: 'desc', label: 'شرح مبسط عن المنتج', type: 'textarea', required: true, value: '' },
      ],
      includeProductExtras: true,
      save: (v) =>
        window.HubStore.addProduct?.({
          ...v,
          itemKind: v.productType,
          icon: v.productType === 'خدمية' ? 'fa-concierge-bell' : v.productType === 'عينية' ? 'fa-box' : 'fa-cloud',
        }),
    },
    incubators: {
      title: 'إضافة حاضنة',
      fields: [
        { id: 'name', label: 'اسم الحاضنة', required: true },
        { id: 'sector', label: 'القطاع', value: 'عام' },
      ],
      save: (v) => window.HubStore.addIncubator(v.name, v.sector || 'عام', v),
    },
    tasks: {
      title: 'إضافة مهمة',
      fields: [
        { id: 'title', label: 'عنوان المهمة', required: true },
        { id: 'assignee', label: 'المسؤول', value: 'فريق هوب' },
        { id: 'priority', label: 'الأولوية', value: 'عادي' },
      ],
      save: (v) => window.HubStore.addTask(v.title, v.assignee || 'فريق هوب', v.priority || 'عادي', v.project || 'تشغيل يومي', v),
    },
    employees: {
      title: 'إضافة موظف',
      fields: [
        { id: 'name', label: 'اسم الموظف', required: true },
        { id: 'role', label: 'الدور', value: 'تشغيل', required: true },
        { id: 'hours', label: 'ساعات العمل', value: '8', type: 'number' },
        { id: 'productivity', label: 'الإنتاجية %', value: '75', type: 'number' },
      ],
      save: (v) =>
        window.HubStore.addEmployee({
          name: v.name,
          role: v.role,
          hours: v.hours,
          productivity: v.productivity,
          score: v.productivity,
          ...v,
        }),
    },
    branches: {
      title: 'إضافة فرع',
      fields: [
        { id: 'nameAr', label: 'اسم الدولة / الفرع', required: true },
        { id: 'nameEn', label: 'الاسم بالإنجليزية', value: '' },
        { id: 'code', label: 'رمز الدولة', value: 'XX', required: true },
        { id: 'type', label: 'نوع الفرع', value: 'مكاتب خاصة' },
        { id: 'hours', label: 'ساعات العمل', value: 'من 9:00 صباحًا إلى 6:00 مساءً' },
      ],
      save: (v) => window.HubStore.addBranch(v),
    },
    policies: {
      title: 'إضافة سياسة',
      fields: [
        { id: 'title', label: 'عنوان السياسة', required: true },
        { id: 'scope', label: 'النطاق', value: 'عام' },
      ],
      save: (v) => window.HubStore.addPolicy(v.title, v.scope || 'عام', v),
    },
    platforms: {
      title: 'إضافة منصة',
      fields: [
        { id: 'nameAr', label: 'اسم المنصة', required: true },
        { id: 'code', label: 'رمز المنصة', value: 'PLT', required: true },
        { id: 'role', label: 'الدور', value: 'تشغيل' },
      ],
      save: (v) => window.HubStore.addPlatform?.(v),
    },
    offices: {
      title: 'منح مكتب إلكتروني',
      fields: [
        { id: 'nameAr', label: 'اسم المكتب الإلكتروني', required: true },
        { id: 'manager', label: 'المسؤول', value: '' },
        { id: 'type', label: 'النوع', value: 'إلكتروني' },
      ],
      save: (v) => window.HubStore.addOffice?.(v),
    },
  };

  const resolveFieldOptions = (field, ctx = {}) => {
    if (Array.isArray(field.options)) return field.options;
    if (field.optionsFrom === 'storeCategories') {
      return (
        window.HubMarketplaceData?.storeCategoryOptions?.() ||
        (window.HubMarketplaceData?.SHOP_CATEGORIES || [])
          .filter((c) => c.id !== 'الكل')
          .map((c) => ({ value: c.id, label: c.name }))
      );
    }
    if (field.optionsFrom === 'subcategories') {
      const cat = ctx.category || document.getElementById('hub-add-category')?.value || '';
      const subs = window.HubMarketplaceData?.subcategoriesFor?.(cat) || [];
      return subs.map((s) => ({ value: s, label: s }));
    }
    if (field.optionsFrom === 'productTypes') {
      return (window.HubMarketplaceData?.PRODUCT_TYPES || []).map((t) => ({ value: t.value, label: t.label }));
    }
    if (field.optionsFrom === 'adOrgLevels') {
      return (window.HubMarketplaceData?.AD_ORG_LEVELS || []).map((l) => ({
        value: l.id,
        label: `${l.nameAr} — ${l.adType}`,
      }));
    }
    return [];
  };

  const fieldHtml = (f, ctx = {}) => {
    if (f.type === 'select') {
      const opts = resolveFieldOptions(f, ctx);
      return `<label>${esc(f.label)}
        <select id="hub-add-${esc(f.id)}" ${f.required ? 'required' : ''}>
          <option value="">— اختر —</option>
          ${opts
            .map((o) => {
              const val = typeof o === 'string' ? o : o.value;
              const lab = typeof o === 'string' ? o : o.label;
              return `<option value="${esc(val)}" ${String(val) === String(f.value || '') ? 'selected' : ''}>${esc(lab)}</option>`;
            })
            .join('')}
        </select>
      </label>`;
    }
    if (f.type === 'textarea') {
      return `<label class="full-span">${esc(f.label)}
        <textarea id="hub-add-${esc(f.id)}" rows="3" ${f.required ? 'required' : ''}>${esc(f.value || '')}</textarea>
      </label>`;
    }
    return `<label>${esc(f.label)}
      <input id="hub-add-${esc(f.id)}" type="${f.type || 'text'}" value="${esc(f.value || '')}" ${f.required ? 'required' : ''} />
    </label>`;
  };

  const multiSelectBlockHtml = (title, hint, idPrefix, items, iconClass = 'fa-check') => `
    <div class="hub-form-block hub-multi-block">
      <h4><i class="fas ${esc(iconClass)}"></i> ${esc(title)}</h4>
      <p class="hub-form-hint">${esc(hint)}</p>
      <div class="hub-multi-grid" id="${esc(idPrefix)}-grid">
        ${items
          .map(
            (it) => `<label class="hub-multi-chip">
              <input type="checkbox" data-multi="${esc(idPrefix)}" value="${esc(it.id)}" />
              <span><i class="${esc(it.icon || 'fa-circle')}"></i> ${esc(it.nameAr || it.label || it.id)}</span>
            </label>`
          )
          .join('')}
      </div>
    </div>`;

  const productExtrasFormHtml = (opts = {}) => {
    const places = opts.places || window.HubMarketplaceData?.AD_APPEARANCE_PLACES || [];
    const socials = window.HubMarketplaceData?.HUB_SOCIAL_PLATFORMS || [];
    return (
      multiSelectBlockHtml(
        opts.placesTitle || 'مكان ظهور الإعلان',
        opts.placesHint || 'يمكن اختيار أكثر من مكان ظهور للمنتج داخل هوب',
        'appear',
        places,
        'fa-map-location-dot'
      ) +
      multiSelectBlockHtml(
        'مشاركة بمنصات تواصل نايوش هوب',
        'اختر منصة أو أكثر — أو «كل المنصات»',
        'social',
        socials,
        'fa-share-nodes'
      )
    );
  };

  const groupMultiHtml = (title, idPrefix, options, selectAllLabel) => `
    <div class="hub-ad-target-group">
      <div class="hub-ad-target-head">
        <strong>${esc(title)}</strong>
        <label class="hub-ad-select-all">
          <input type="checkbox" data-ad-select-all="${esc(idPrefix)}" />
          ${esc(selectAllLabel)}
        </label>
      </div>
      <div class="hub-multi-grid" data-ad-group="${esc(idPrefix)}">
        ${options
          .map(
            (name) => `<label class="hub-multi-chip">
              <input type="checkbox" data-ad-target="${esc(idPrefix)}" value="${esc(name)}" />
              <span>${esc(name)}</span>
            </label>`
          )
          .join('')}
      </div>
    </div>`;

  const adTargetsFormHtml = () => {
    const opts = hierarchyOptions();
    return `<div class="hub-form-block hub-ad-targets-block">
      <h4><i class="fas fa-layer-group"></i> خيارات العرض — نظام متعدد الطبقات</h4>
      <p class="hub-form-hint">اعرض في الواجهة الرئيسية و/أو المكتب و/أو المنصة و/أو الحاضنة و/أو الفرع — يمكن اختيار الكل أو عناصر محددة</p>
      <label class="hub-multi-chip hub-ad-home-chip">
        <input type="checkbox" id="hub-ad-target-home" value="home" />
        <span><i class="fas fa-house"></i> عرض في الواجهة الرئيسية</span>
      </label>
      ${groupMultiHtml('المكتب', 'offices', opts.offices, 'كل المكاتب')}
      ${groupMultiHtml('المنصة', 'platforms', opts.platforms, 'كل المنصات')}
      ${groupMultiHtml('الحاضنة', 'incubators', opts.incubators, 'كل الحاضنات')}
      ${groupMultiHtml('الفرع', 'branches', opts.branches, 'كل الفروع')}
    </div>`;
  };

  const collectAdTargets = () => {
    const home = !!document.getElementById('hub-ad-target-home')?.checked;
    const pick = (prefix) => {
      const all = document.querySelector(`input[data-ad-select-all="${prefix}"]`)?.checked;
      if (all) return ['*'];
      return Array.from(document.querySelectorAll(`input[data-ad-target="${prefix}"]:checked`)).map((el) => el.value);
    };
    return {
      home,
      offices: pick('offices'),
      branches: pick('branches'),
      incubators: pick('incubators'),
      platforms: pick('platforms'),
    };
  };

  const wireAdTargetSelectAll = () => {
    document.querySelectorAll('input[data-ad-select-all]').forEach((master) => {
      master.addEventListener('change', () => {
        const prefix = master.dataset.adSelectAll;
        document.querySelectorAll(`input[data-ad-target="${prefix}"]`).forEach((el) => {
          el.checked = master.checked;
          el.disabled = master.checked;
        });
      });
    });
  };

  const marketplaceFormHtml = () => {
    const list = window.HubMarketplaceData?.MARKETPLACE_CONNECTORS || [];
    if (!list.length) return '';
    return `<div class="hub-form-block hub-marketplace-block">
      <h4><i class="fas fa-link"></i> ربط بمواقع البيع المباشر</h4>
      <p class="hub-form-hint">اربط المنتج/الخدمة بأمازون · علي بابا · تيمو · شي إن · نون · وأي متجر كبير</p>
      <div class="hub-mp-grid">
        ${list
          .map(
            (m) => `<div class="hub-mp-row" data-mp="${esc(m.id)}">
              <label class="hub-mp-check">
                <input type="checkbox" id="hub-add-mp_${esc(m.id)}" value="1" />
                <span><i class="${esc(m.icon)}"></i> ${esc(m.nameAr)}</span>
              </label>
              <input id="hub-add-mp_url_${esc(m.id)}" type="url" placeholder="${esc(m.placeholder || 'https://...')}" />
            </div>`
          )
          .join('')}
      </div>
      <div class="hub-form-grid" style="margin-top:10px">
        <label>اسم متجر إضافي
          <input id="hub-add-mp_custom_name" type="text" placeholder="مثال: سوق · ترينديول · جوميا" />
        </label>
        <label>رابط المتجر الإضافي
          <input id="hub-add-mp_url_custom" type="url" placeholder="https://..." />
        </label>
      </div>
    </div>`;
  };

  const fillSubcategories = (category, selected = '') => {
    const sel = document.getElementById('hub-add-subcategory');
    if (!sel) return;
    const subs = window.HubMarketplaceData?.subcategoriesFor?.(category) || [];
    sel.innerHTML =
      `<option value="">${subs.length ? '— اختر الفرعي —' : '— لا توجد قائمة فرعية —'}</option>` +
      subs.map((s) => `<option value="${esc(s)}" ${s === selected ? 'selected' : ''}>${esc(s)}</option>`).join('');
  };

  const collectMulti = (prefix) =>
    Array.from(document.querySelectorAll(`input[data-multi="${prefix}"]:checked`)).map((el) => el.value);

  const saveProductForm = async (form, publishStatus) => savePublishableForm('products', form, publishStatus);

  const savePublishableForm = async (entity, form, publishStatus) => {
    const values = {};
    for (const f of form.fields) {
      values[f.id] = document.getElementById(`hub-add-${f.id}`)?.value.trim() || '';
      if (f.required && !values[f.id]) return toast(`${f.label} مطلوب`);
    }
    if (values.adStartDate && values.adEndDate && values.adEndDate < values.adStartDate) {
      return toast('تاريخ نهاية الإعلان يجب أن يكون بعد البداية');
    }
    const appearancePlaces = collectMulti('appear');
    const socialShares = collectMulti('social');
    if (form.includeProductExtras && !appearancePlaces.length) {
      return toast('اختر مكان ظهور واحد على الأقل');
    }
    if (form.includeProductExtras && !socialShares.length) {
      return toast('اختر منصة تواصل واحدة على الأقل أو كل المنصات');
    }
    if (socialShares.includes('all')) {
      values.socialShares = (window.HubMarketplaceData?.HUB_SOCIAL_PLATFORMS || [])
        .filter((s) => s.id !== 'all')
        .map((s) => s.id);
    } else {
      values.socialShares = socialShares;
    }
    values.appearancePlaces = appearancePlaces;
    values.publishStatus = publishStatus;

    if (form.includeAdTargets) {
      const publishTargets = collectAdTargets();
      const hasTarget =
        publishTargets.home ||
        publishTargets.offices.length ||
        publishTargets.branches.length ||
        publishTargets.incubators.length ||
        publishTargets.platforms.length;
      if (!hasTarget) return toast('اختر خيار عرض: الواجهة الرئيسية أو مكتب/منصة/حاضنة/فرع');
      values.publishTargets = publishTargets;
      values.publishHome = publishTargets.home;
      values.targetOffices = publishTargets.offices;
      values.targetBranches = publishTargets.branches;
      values.targetIncubators = publishTargets.incubators;
      values.targetPlatforms = publishTargets.platforms;
      if (values.adLevel) {
        values.type = window.HubMarketplaceData?.adTypeForLevel?.(values.adLevel) || values.type;
      }
    }

    const meta = await collectCommonMeta();
    if (meta.error) return toast(meta.error);
    Object.assign(values, meta);
    if (!values.brand && values.companyName) values.brand = values.companyName;
    if (entity === 'ads' && !values.content) values.content = values.desc || '';
    const ok = form.save(values);
    if (!ok) return toast('تعذّرت الإضافة');
    closeModal();
    const noun = entity === 'ads' ? 'الإعلان' : 'المنتج';
    const msg =
      publishStatus === 'deferred'
        ? `تم تأجيل نشر ${noun}`
        : publishStatus === 'draft'
          ? `تم حفظ مسودة ${noun}`
          : `تم حفظ ونشر ${noun}`;
    toast(msg);
    afterChange(entity, 'add');
  };

  const openAdd = (entity) => {
    const form = ADD_FORMS[entity];
    if (!form) return toast('استخدم نموذج الإضافة في الصفحة');
    const isPublishable = entity === 'products' || entity === 'ads';
    const defaultEnd = new Date();
    defaultEnd.setDate(defaultEnd.getDate() + 30);
    if (isPublishable) {
      const endField = form.fields.find((f) => f.id === 'adEndDate');
      if (endField && !endField.value) endField.value = defaultEnd.toISOString().slice(0, 10);
    }
    const kickers = {
      products: 'منتجات رقمية · خدمية · عينية — توجيه حسب التصنيف والنوع عبر الفروع والحاضنات والمنصات',
      ads: 'إدارة إعلانات متعددة الطبقات: مكتب · منصة · حاضنة · فرع — مع خيارات العرض ومكان الظهور على الواجهة الرئيسية',
      store: 'نموذج رفع على المتجر — مطابق لنموذج المنتجات',
    };
    openModal({
      title: form.title,
      kicker: kickers[entity] || 'نموذج إضافة جديد — حقول هوب الإلزامية',
      body: `<div class="hub-form-block">
        <h4><i class="fas fa-plus-circle"></i> بيانات ${esc(ENTITY_LABELS[entity] || 'السجل')}</h4>
        <div class="hub-form-grid">
        ${form.fields.map((f) => fieldHtml(f)).join('')}
        </div>
      </div>
      ${form.includeAdTargets ? adTargetsFormHtml() : ''}
      ${
        form.includeProductExtras
          ? productExtrasFormHtml(
              form.includeAdTargets
                ? {
                    places: window.HubMarketplaceData?.AD_LAYER_APPEARANCE || [],
                    placesTitle: 'مكان الظهور',
                    placesHint: 'الواجهة الرئيسية · الصفحة الرئيسية للمكتب / المنصة / الحاضنة / الفرع',
                  }
                : {}
            )
          : ''
      }
      ${form.includeMarketplaces ? marketplaceFormHtml() : ''}
      ${commonMetaFormHtml()}`,
      foot: isPublishable
        ? `
        <button type="button" class="hub-erp-btn ghost" data-hub-modal-close title="إلغاء"><i class="fas fa-xmark"></i> إلغاء</button>
        <button type="button" class="hub-erp-btn slate" id="hub-add-defer" title="تأجيل النشر"><i class="fas fa-clock"></i> تأجيل النشر</button>
        <button type="button" class="hub-erp-btn red" id="hub-add-save" title="حفظ"><i class="fas fa-floppy-disk"></i> حفظ</button>`
        : `
        <button type="button" class="hub-erp-btn ghost" data-hub-modal-close><i class="fas fa-xmark"></i> إلغاء</button>
        <button type="button" class="hub-erp-btn red" id="hub-add-save"><i class="fas fa-cloud-arrow-up"></i> ${entity === 'store' ? 'رفع على المتجر' : 'حفظ'}</button>`,
    });

    // cascading subcategory
    const catSel = document.getElementById('hub-add-category');
    if (catSel) {
      fillSubcategories(catSel.value);
      catSel.addEventListener('change', () => fillSubcategories(catSel.value));
    }

    if (form.includeAdTargets) {
      wireAdTargetSelectAll();
      const levelSel = document.getElementById('hub-add-adLevel');
      const applyLevelHint = () => {
        const meta = window.HubMarketplaceData?.adLevelMeta?.(levelSel?.value);
        if (!meta?.appearance) return;
        const chip = document.querySelector(`input[data-multi="appear"][value="${meta.appearance}"]`);
        if (chip) chip.checked = true;
      };
      levelSel?.addEventListener('change', applyLevelHint);
      applyLevelHint();
    }

    // social "all" exclusivity
    document.getElementById('social-grid')?.addEventListener('change', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || t.dataset.multi !== 'social') return;
      if (t.value === 'all' && t.checked) {
        document.querySelectorAll('input[data-multi="social"]').forEach((el) => {
          if (el !== t) el.checked = false;
        });
      } else if (t.value !== 'all' && t.checked) {
        const all = document.querySelector('input[data-multi="social"][value="all"]');
        if (all) all.checked = false;
      }
    });

    document.getElementById('hub-add-save')?.addEventListener('click', async () => {
      if (isPublishable) return savePublishableForm(entity, form, 'published');
      const values = {};
      for (const f of form.fields) {
        values[f.id] = document.getElementById(`hub-add-${f.id}`)?.value.trim() || '';
        if (f.required && !values[f.id]) return toast(`${f.label} مطلوب`);
      }
      if (form.includeMarketplaces) {
        const list = window.HubMarketplaceData?.MARKETPLACE_CONNECTORS || [];
        list.forEach((m) => {
          const checked = document.getElementById(`hub-add-mp_${m.id}`)?.checked;
          values[`mp_${m.id}`] = checked ? '1' : '';
          values[`mp_url_${m.id}`] = document.getElementById(`hub-add-mp_url_${m.id}`)?.value.trim() || '';
        });
        values.mp_custom_name = document.getElementById('hub-add-mp_custom_name')?.value.trim() || '';
        values.mp_url_custom = document.getElementById('hub-add-mp_url_custom')?.value.trim() || '';
      }
      const meta = await collectCommonMeta();
      if (meta.error) return toast(meta.error);
      Object.assign(values, meta);
      const ok = form.save(values);
      if (!ok) return toast('تعذّرت الإضافة');
      closeModal();
      toast(entity === 'store' ? 'تم رفع المنتج/الخدمة على المتجر' : 'تمت الإضافة مع بيانات الأطراف والهيكل');
      afterChange(entity, 'add');
    });

    document.getElementById('hub-add-defer')?.addEventListener('click', async () => {
      if (isPublishable) return savePublishableForm(entity, form, 'deferred');
    });
  };

  const handleRow = (action, entity, id) => {
    if (!window.HubStore?.getEntity) return toast('المخزن غير جاهز');
    if (action === 'view') return openView(entity, id);
    if (action === 'assign') return openAssign(entity, id);
    if (action === 'edit') return openEdit(entity, id);
    if (action === 'delete' || action === 'archive') return openConfirm(entity, id, action);
  };

  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-hub-modal-go]');
    if (go) {
      e.preventDefault();
      handleRow(go.dataset.hubModalGo, go.dataset.entity, go.dataset.id);
      return;
    }
    const btn = e.target.closest('[data-hub-act]');
    if (!btn) return;
    e.preventDefault();
    const action = btn.dataset.hubAct;
    const entity = btn.dataset.entity || btn.closest('[data-entity]')?.dataset.entity || 'generic';
    const id = btn.dataset.id;
    if (action === 'add') openAdd(entity);
    else if (id) handleRow(action, entity, id);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensurePageToolbar, { once: true });
  } else {
    ensurePageToolbar();
  }

  window.HubActions = {
    ACTIONS,
    ENTITY_LABELS,
    COMMON_META_KEYS,
    rowHtml,
    toolbarHtml,
    toast,
    ensurePageToolbar,
    openView,
    openAssign,
    openEdit,
    openAdd,
    closeModal,
    metaColumnsHeader,
    metaCells,
    metaCardLine,
    commonMetaFormHtml,
  };
})();
