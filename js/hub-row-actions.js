(() => {
  const ACTIONS = [
    { key: 'edit', title: 'تعديل', icon: 'fa-pen', cls: 'hub-act-edit' },
    { key: 'assign', title: 'تعيين', icon: 'fa-user-check', cls: 'hub-act-assign' },
    { key: 'delete', title: 'حذف', icon: 'fa-trash', cls: 'hub-act-delete' },
    { key: 'archive', title: 'أرشفة', icon: 'fa-archive', cls: 'hub-act-archive' },
  ];

  const ENTITY_LABELS = {
    apps: 'نظام',
    store: 'منتج متجر',
    ads: 'إعلان',
    events: 'فعالية',
    products: 'منتج',
    incubators: 'حاضنة',
    tasks: 'مهمة',
    policies: 'سياسة',
    systems: 'نظام سوق',
    connectors: 'موصل',
    platforms: 'منصة',
    generic: 'سجل',
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
    const map = {
      apps: 'apps',
      store: 'store',
      ads: 'ads',
      events: 'events',
      products: 'products',
      platforms: 'platforms',
    };
    const entity = map[page];
    if (!entity) return;
    if (document.querySelector(`.hub-page-actions[data-entity="${entity}"]`)) return;
    const host =
      document.querySelector('.market-hero') ||
      document.querySelector('.shop-top') ||
      document.querySelector('.products-hero') ||
      document.querySelector('main .container') ||
      document.querySelector('main');
    if (!host) return;
    const bar = document.createElement('div');
    bar.innerHTML = toolbarHtml(entity);
    const node = bar.firstElementChild;
    if (host.classList.contains('market-hero') || host.classList.contains('shop-top') || host.classList.contains('products-hero')) {
      host.appendChild(node);
    } else {
      host.prepend(node);
    }
  };

  const handleAdd = (entity) => {
    const store = window.HubStore;
    if (!store) return toast('المخزن غير جاهز');
    if (entity === 'apps') {
      const nameAr = prompt('اسم النظام بالعربية:');
      if (!nameAr) return;
      const code = prompt('رمز النظام (إنجليزي مختصر):', 'SYS') || 'SYS';
      store.registerApp({ nameAr, code, kind: 'system', category: 'أنظمة نايوش' });
      toast('تمت إضافة النظام');
    } else if (entity === 'store') {
      const title = prompt('اسم منتج المتجر:');
      if (!title) return;
      store.addStoreItem({ title, price: 500, points: 50, stock: 10 });
      toast('تمت إضافة المنتج');
    } else if (entity === 'ads') {
      const title = prompt('عنوان الإعلان:');
      if (!title) return;
      store.addAdListing({ title, price: 1000, category: 'عام', content: 'إعلان منتج منصة' });
      toast('نُشر الإعلان');
    } else if (entity === 'events') {
      const name = prompt('اسم الفعالية:');
      if (!name) return;
      store.addEvent({ name, description: 'فعالية من هوب', date: new Date().toISOString().slice(0, 10), status: 'قادمة' });
      toast('أُنشئت الفعالية');
    } else if (entity === 'products') {
      const name = prompt('اسم المنتج:');
      if (!name) return;
      store.addProduct?.({ name, brand: 'نايوش هوب', category: 'تشغيل', price: 1000, stock: 20 });
      toast('أُضيف المنتج للكتالوج');
    } else if (entity === 'incubators') {
      const name = prompt('اسم الحاضنة:');
      if (!name) return;
      store.addIncubator(name, 'عام');
      toast('أُنشئت الحاضنة');
    } else if (entity === 'tasks') {
      const title = prompt('عنوان المهمة:');
      if (!title) return;
      store.addTask(title, 'فريق هوب', 'عادي');
      toast('أُضيفت المهمة');
    } else if (entity === 'policies') {
      const title = prompt('عنوان السياسة:');
      if (!title) return;
      store.addPolicy(title, 'عام');
      toast('أُضيفت السياسة');
    } else {
      toast('استخدم نموذج الإضافة في الصفحة');
      return;
    }
    window.dispatchEvent(new CustomEvent('hub-data-changed', { detail: { entity, action: 'add' } }));
    if (typeof window.hubRerender === 'function') window.hubRerender();
    else setTimeout(() => location.reload(), 350);
  };

  const handleRow = (action, entity, id) => {
    const store = window.HubStore;
    if (!store?.entityAction) return toast('المخزن غير جاهز');
    if (action === 'edit') {
      const title = prompt('القيمة الجديدة (الاسم/العنوان):');
      if (!title) return;
      const ok = store.entityAction(entity, id, 'edit', { title });
      if (!ok) return toast('تعذّر التعديل');
      toast('تم التعديل');
    } else if (action === 'assign') {
      const assignee = prompt('تعيين إلى (اسم المسؤول):');
      if (!assignee) return;
      const ok = store.entityAction(entity, id, 'assign', { assignee });
      if (!ok) return toast('تعذّر التعيين');
      toast(`تم التعيين إلى ${assignee}`);
    } else if (action === 'delete') {
      if (!confirm('تأكيد حذف السجل؟')) return;
      const ok = store.entityAction(entity, id, 'delete');
      if (!ok) return toast('تعذّر الحذف');
      toast('تم الحذف');
    } else if (action === 'archive') {
      const ok = store.entityAction(entity, id, 'archive');
      if (!ok) return toast('تعذّرت الأرشفة');
      toast('تمت الأرشفة');
    } else {
      return;
    }
    window.dispatchEvent(new CustomEvent('hub-data-changed', { detail: { entity, action, id } }));
    if (typeof window.hubRerender === 'function') window.hubRerender();
    else setTimeout(() => location.reload(), 350);
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-hub-act]');
    if (!btn) return;
    e.preventDefault();
    const action = btn.dataset.hubAct;
    const entity = btn.dataset.entity || btn.closest('[data-entity]')?.dataset.entity || 'generic';
    const id = btn.dataset.id;
    if (action === 'add') handleAdd(entity);
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
    rowHtml,
    toolbarHtml,
    toast,
    ensurePageToolbar,
  };
})();
