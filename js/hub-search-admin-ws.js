/**
 * إدارة محرك البحث — لوحة مدمجة في dashboard.html#search-admin
 * مصدر الحقيقة: نفس HubUniversalSearch.collectCatalog الذي يغذّي search.html
 */
(() => {
  'use strict';

  const esc = (v = '') =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const ui = {
    tab: 'overview',
    q: '',
    filters: { type: '', source: '', visible: '' },
    page: 1,
    pageSize: 20,
    selectedId: null,
    previewId: null,
    addStep: 1,
    addType: '',
    addMode: '', // pick | form | new-service | custom
    addPickId: '',
    addForm: {
      title: '',
      href: '',
      description: '',
      keywords: '',
      category: '',
      searchVisible: true,
      icon: 'fa-compass',
    },
    intentEditId: null,
    lastMessage: '',
  };

  const cat = () => window.HubSearchCatalog;
  const cfg = () => window.HubSearchConfig;
  const searchApi = () => window.HubUniversalSearch;
  const engine = () => cat()?.DEFAULT_ENGINE || { id: 'naiosh', nameAr: 'محرك بحث نايوش' };

  const fmt = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return String(iso);
    }
  };

  const badge = (t, cls = '') => `<span class="hsa-badge ${cls}">${esc(t)}</span>`;

  /** أنواع يدعمها المحرك الحقيقي + محتوى مخصص */
  const ADDABLE_TYPES = [
    { id: 'service', label: 'خدمة', icon: 'fa-handshake', mode: 'service' },
    { id: 'branch', label: 'فرع (إظهار/إدارة ظهور)', icon: 'fa-code-branch', mode: 'pick-live', liveType: 'branch' },
    { id: 'incubator', label: 'حاضنة (إظهار/إدارة ظهور)', icon: 'fa-seedling', mode: 'pick-live', liveType: 'incubator' },
    { id: 'platform', label: 'منصة (إظهار/إدارة ظهور)', icon: 'fa-layer-group', mode: 'pick-live', liveType: 'platform' },
    { id: 'system', label: 'نظام (إظهار/إدارة ظهور)', icon: 'fa-cube', mode: 'pick-live', liveType: 'system' },
    { id: 'knowledge', label: 'مركز معلومات (إظهار)', icon: 'fa-circle-info', mode: 'pick-live', liveType: 'knowledge' },
    { id: 'product', label: 'منتج (فهرسة)', icon: 'fa-box', mode: 'pick', section: 'product' },
    { id: 'article', label: 'مقال (فهرسة)', icon: 'fa-newspaper', mode: 'pick', section: 'content' },
    { id: 'event', label: 'فعالية (فهرسة)', icon: 'fa-calendar-days', mode: 'pick', section: 'event' },
    { id: 'store', label: 'متجر (فهرسة)', icon: 'fa-bag-shopping', mode: 'pick', section: 'store' },
    { id: 'page', label: 'محتوى مخصص · صفحة', icon: 'fa-file', mode: 'form', section: 'page' },
    { id: 'link', label: 'محتوى مخصص · رابط', icon: 'fa-link', mode: 'form', section: 'link' },
  ];

  const liveCatalog = (includeHidden = true) => searchApi()?.collectCatalog?.({ includeHidden }) || [];

  const liveStats = () => searchApi()?.stats?.() || {};

  const sourceCandidates = (typeFilter = '') => {
    const out = [];
    const push = (item) => {
      if (!item?.id || !item?.title) return;
      if (typeFilter && item.sourceType !== typeFilter) return;
      out.push(item);
    };

    try {
      const products = window.HubStore?.get?.()?.empire?.productCatalog || [];
      products.forEach((p) =>
        push({
          id: p.id,
          title: p.name || p.title,
          description: p.desc || p.description || '',
          href: `products.html#${encodeURIComponent(p.id)}`,
          keywords: [p.name, p.brand, p.category, p.sku].filter(Boolean).join(' '),
          sourceType: 'product',
          sourceLabel: 'المنتجات',
          section: 'product',
          category: p.category || 'منتج',
        })
      );
    } catch (_) {}

    try {
      (window.HubArticles?.list?.() || window.HubArticles?.all?.() || []).forEach((a) => {
        const st = String(a.status || '').toLowerCase();
        if (st && st !== 'published' && a.status !== 'Published' && a.status !== 'منشور') return;
        push({
          id: a.id,
          title: a.title,
          description: a.summary || a.excerpt || '',
          href: `blog.html#${encodeURIComponent(a.id)}`,
          keywords: a.title,
          sourceType: 'article',
          sourceLabel: 'المقالات',
          section: 'content',
          category: a.category || 'مقال',
        });
      });
    } catch (_) {}

    try {
      const events = window.HubStore?.get?.()?.empire?.eventsStudio?.events || [];
      events.forEach((e) =>
        push({
          id: e.id,
          title: e.name || e.title,
          description: e.description || '',
          href: `events.html#${encodeURIComponent(e.id)}`,
          keywords: [e.name, e.type, e.description].filter(Boolean).join(' '),
          sourceType: 'event',
          sourceLabel: 'الفعاليات',
          section: 'event',
          category: e.type || 'فعالية',
        })
      );
    } catch (_) {}

    try {
      const storeItems = window.HubStore?.get?.()?.empire?.salesStore?.items || [];
      storeItems.forEach((i) =>
        push({
          id: i.id,
          title: i.title || i.name,
          description: i.desc || i.description || '',
          href: `store.html#${encodeURIComponent(i.id)}`,
          keywords: [i.title, i.brand, i.category].filter(Boolean).join(' '),
          sourceType: 'store',
          sourceLabel: 'المتجر',
          section: 'store',
          category: i.category || 'متجر',
        })
      );
    } catch (_) {}

    return out;
  };

  const liveCandidates = (type) =>
    liveCatalog(true)
      .filter((i) => i.type === type)
      .map((i) => ({
        id: i.id,
        title: i.title,
        description: i.subtitle || '',
        href: i.href,
        keywords: i.keywords,
        sourceType: i.type,
        sourceLabel: i.sourceLabel || i.typeAr,
        section: i.type,
        category: i.typeAr,
        searchVisible: i.searchVisible !== false,
      }));

  const searchSources = () => {
    const all = liveCatalog(true);
    const defs = [
      { id: 'branch', name: 'الفروع', kind: 'فروع', type: 'branch' },
      { id: 'incubator', name: 'الحاضنات', kind: 'حاضنات', type: 'incubator' },
      { id: 'platform', name: 'المنصات', kind: 'منصات', type: 'platform' },
      { id: 'system', name: 'الأنظمة', kind: 'أنظمة', type: 'system' },
      { id: 'service', name: 'الخدمات', kind: 'خدمات', type: 'service' },
      { id: 'knowledge', name: 'مركز المعلومات', kind: 'صفحات', type: 'knowledge' },
      { id: 'content', name: 'محتوى / مخصص', kind: 'محتوى', type: 'content' },
      { id: 'product', name: 'المنتجات', kind: 'منتجات', type: 'product' },
      { id: 'event', name: 'الفعاليات', kind: 'فعاليات', type: 'event' },
    ];
    return defs.map((d) => {
      const rows = all.filter((r) => r.type === d.type);
      const visible = rows.filter((r) => r.searchVisible !== false).length;
      return {
        ...d,
        available: rows.length,
        inIndex: visible,
        status: rows.length ? 'نشط' : 'فارغ',
        lastSync: '',
      };
    });
  };

  const filteredRows = () => {
    let rows = liveCatalog(true);
    if (ui.filters.type) rows = rows.filter((r) => r.type === ui.filters.type);
    if (ui.filters.source) {
      rows = rows.filter(
        (r) => r.source === ui.filters.source || r.sourceLabel === ui.filters.source || r.type === ui.filters.source
      );
    }
    if (ui.filters.visible === '1') rows = rows.filter((r) => r.searchVisible !== false);
    if (ui.filters.visible === '0') rows = rows.filter((r) => r.searchVisible === false);
    const q = String(ui.q || '').trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        [r.title, r.subtitle, r.keywords, r.href, r.sourceLabel, r.typeAr, r.meta].join(' ').toLowerCase().includes(q)
      );
    }
    return rows;
  };

  const findLive = (id) => liveCatalog(true).find((r) => String(r.id) === String(id)) || null;

  const setItemVisible = (id, visible, actor) => {
    const row = findLive(id);
    if (!row) return { ok: false, error: 'غير موجود' };
    if (row.source === 'admin-catalog') {
      return cat()?.setSearchVisible?.(id, visible, actor) || { ok: false };
    }
    return cfg()?.setHidden?.(id, !visible, actor) || { ok: false };
  };

  const renderDrawer = () => {
    if (!ui.selectedId) return '';
    const row = findLive(ui.selectedId);
    if (!row) return '';
    const vis = row.searchVisible !== false;
    return `
      <div class="hsa-drawer-backdrop" data-action="sa-drawer-close"></div>
      <aside class="hsa-drawer" role="dialog" aria-label="تفاصيل عنصر البحث">
        <header class="hsa-drawer-head">
          <h3>تفاصيل عنصر محرك البحث</h3>
          <button type="button" class="hsa-btn" data-action="sa-drawer-close" title="إغلاق">إغلاق</button>
        </header>
        <div class="hsa-drawer-body">
          <p><strong>العنوان:</strong> ${esc(row.title)}</p>
          <p><strong>النوع:</strong> ${esc(row.typeAr || row.type)}</p>
          <p><strong>المصدر:</strong> ${esc(row.sourceLabel || row.source || '—')}</p>
          <p><strong>الرابط:</strong> <a href="${esc(row.href || '#')}" target="_blank" rel="noopener">${esc(row.href || '—')}</a></p>
          <p><strong>الأصل:</strong> <a href="${esc(row.originHref || row.href || '#')}" target="_blank" rel="noopener">فتح العنصر الأصلي</a></p>
          <p><strong>حالة الظهور في البحث:</strong> ${vis ? badge('نشط', 'is-ok') : badge('متوقف', 'is-bad')}</p>
          <p><strong>ملاحظة:</strong> إيقاف الظهور لا يحذف الأصل من نظامه.</p>
        </div>
        <div class="hsa-drawer-actions">
          <button type="button" class="hsa-btn" data-action="sa-preview" data-id="${esc(row.id)}">معاينة</button>
          <a class="hsa-btn" href="${esc(row.originHref || row.href || '#')}" target="_blank" rel="noopener">فتح الأصل</a>
          <button type="button" class="hsa-btn" data-action="sa-toggle-visible" data-id="${esc(row.id)}">${vis ? 'إيقاف الظهور في البحث' : 'تفعيل الظهور في البحث'}</button>
        </div>
      </aside>`;
  };

  const renderPreview = () => {
    if (!ui.previewId) return '';
    const row =
      ui.previewId === 'draft'
        ? {
            title: ui.addForm.title,
            subtitle: ui.addForm.description,
            typeAr: ADDABLE_TYPES.find((t) => t.id === ui.addType)?.label || 'مخصص',
            sourceLabel: 'جديد',
            href: ui.addForm.href,
          }
        : findLive(ui.previewId);
    if (!row) return '';
    return `<div class="hsa-modal"><div class="hsa-modal-card">
      <header><h3>معاينة نتيجة البحث</h3><button type="button" class="hsa-btn" data-action="sa-preview-close">إغلاق</button></header>
      <p class="hsa-lead">هكذا يظهر العنصر في صفحة البحث:</p>
      <article class="hsa-preview-hit">
        <div>
          <strong>${esc(row.title)}</strong>
          <p>${esc(row.subtitle || row.description || '')}</p>
          <small>${esc(row.typeAr || '')} · ${esc(row.sourceLabel || '')}</small>
          <div class="hsa-muted">${esc(row.href || '')}</div>
        </div>
      </article>
    </div></div>`;
  };

  const renderLiveStats = () => {
    const s = liveStats();
    return `
    <div class="hsa-stats" role="group" aria-label="إحصائيات محرك البحث الشامل">
      <button type="button" class="hsa-stat" data-action="sa-stat" data-filter="" title="الإجمالي"><strong>${s.all || 0}</strong><span>إجمالي</span></button>
      <button type="button" class="hsa-stat" data-action="sa-stat" data-filter="type:branch"><strong>${s.branch || 0}</strong><span>فرع</span></button>
      <button type="button" class="hsa-stat" data-action="sa-stat" data-filter="type:incubator"><strong>${s.incubator || 0}</strong><span>حاضنة</span></button>
      <button type="button" class="hsa-stat" data-action="sa-stat" data-filter="type:platform"><strong>${s.platform || 0}</strong><span>منصة</span></button>
      <button type="button" class="hsa-stat" data-action="sa-stat" data-filter="type:system"><strong>${s.system || 0}</strong><span>نظام</span></button>
      <button type="button" class="hsa-stat" data-action="sa-stat" data-filter="type:knowledge"><strong>${s.knowledge || 0}</strong><span>مركز معلومات</span></button>
      <button type="button" class="hsa-stat" data-action="sa-stat" data-filter="type:service"><strong>${s.service || 0}</strong><span>خدمة</span></button>
      <button type="button" class="hsa-stat" data-action="sa-tab" data-tab="intents"><strong>${s.intents || 0}</strong><span>نية بحث</span></button>
    </div>`;
  };

  const renderOverview = () => {
    const s = liveStats();
    const eng = engine();
    const recent = liveCatalog(false).slice(0, 8);
    return `
      <section class="hsa-panel">
        <div class="hsa-engine-card">
          <div>
            <p class="hsa-kicker">لوحة إدارة محرك البحث الشامل</p>
            <h3>${esc(eng.nameAr)}</h3>
            <p class="hsa-lead">هذه الصفحة تدير نفس الفهرس الذي تقرأه <strong>صفحة البحث العامة</strong> — مصدر حقيقة واحد.</p>
            <p class="hsa-muted">الفروع · الحاضنات · المنصات · الأنظمة · الخدمات · مركز المعلومات · نوايا البحث · القوائم السريعة</p>
          </div>
          <div class="hsa-engine-actions">
            <a class="hsa-btn hsa-btn-primary" href="search.html" target="_blank" rel="noopener">فتح محرك البحث الشامل</a>
            <button type="button" class="hsa-btn" data-action="sa-tab" data-tab="add">+ إضافة إلى محرك البحث</button>
          </div>
        </div>
        ${renderLiveStats()}
        <div class="hsa-diff-grid">
          <article>
            <h4><i class="fas fa-database"></i> مصدر الحقيقة</h4>
            <p>الفهرس الحي ← البيانات الحيّة + إعدادات الظهور + المحتوى المخصص).</p>
          </article>
          <article>
            <h4><i class="fas fa-eye-slash"></i> إخفاء بلا حذف</h4>
            <p>إيقاف الظهور يخفي العنصر من صفحة البحث دون حذف الفرع/الخدمة/النظام الأصلي.</p>
          </article>
        </div>
        <h3 style="margin-top:16px">عيّنة من الفهرس الحي (الظاهرة للمستخدم)</h3>
        ${
          recent.length
            ? `<ul class="hsa-recent">${recent
                .map(
                  (r) =>
                    `<li><strong>${esc(r.title)}</strong> <span>${esc(r.typeAr || r.type)}</span> <button type="button" class="hsa-btn" data-action="sa-view" data-id="${esc(r.id)}">عرض</button></li>`
                )
                .join('')}</ul>`
            : `<div class="hsa-empty-box"><p>الفهرس فارغ حاليًا.</p></div>`
        }
        <p class="hsa-muted" style="margin-top:12px">الإجمالي الظاهر للمستخدم الآن: <strong>${s.all || 0}</strong> · خدمات: <strong>${s.service || 0}</strong> · نوايا: <strong>${s.intents || 0}</strong></p>
      </section>`;
  };

  const renderIndexed = () => {
    const rows = filteredRows();
    const pages = Math.max(1, Math.ceil(rows.length / ui.pageSize) || 1);
    ui.page = Math.min(ui.page, pages);
    const start = (ui.page - 1) * ui.pageSize;
    const pageRows = rows.slice(start, start + ui.pageSize);
    const types = [...new Set(liveCatalog(true).map((r) => r.type).filter(Boolean))];
    const sources = [...new Set(liveCatalog(true).map((r) => r.sourceLabel || r.source).filter(Boolean))];
    return `
      <section class="hsa-panel">
        <p class="hsa-lead">كل صف هنا عنصر من نفس فهرس صفحة البحث (بما في ذلك المخفي).</p>
        <div class="hsa-toolbar">
          <input type="search" id="hsa-q" value="${esc(ui.q)}" placeholder="ابحث بالعنوان أو المصدر..." title="بحث" />
          <select id="hsa-f-type" title="النوع">
            <option value="">كل الأنواع</option>
            ${types.map((t) => `<option value="${esc(t)}" ${ui.filters.type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
          </select>
          <select id="hsa-f-source" title="المصدر">
            <option value="">كل المصادر</option>
            ${sources.map((s) => `<option value="${esc(s)}" ${ui.filters.source === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
          </select>
          <select id="hsa-f-visible" title="الظهور">
            <option value="">الظهور: الكل</option>
            <option value="1" ${ui.filters.visible === '1' ? 'selected' : ''}>نشط في البحث</option>
            <option value="0" ${ui.filters.visible === '0' ? 'selected' : ''}>متوقف</option>
          </select>
          <button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-apply">تطبيق</button>
          <button type="button" class="hsa-btn" data-action="sa-clear">مسح</button>
          <button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-tab" data-tab="add">+ إضافة</button>
        </div>
        <div class="hsa-table-wrap"><table class="hsa-table">
          <thead><tr>
            <th>العنوان</th><th>النوع</th><th>المصدر</th><th>الرابط</th><th>الظهور</th><th>الإجراءات</th>
          </tr></thead>
          <tbody>${
            pageRows.length
              ? pageRows
                  .map((r) => {
                    const vis = r.searchVisible !== false;
                    return `<tr>
                      <td><strong>${esc(r.title)}</strong><div class="hsa-muted">${esc((r.subtitle || '').slice(0, 60))}</div></td>
                      <td>${esc(r.typeAr || r.type)}</td>
                      <td>${esc(r.sourceLabel || r.source || '—')}</td>
                      <td class="hsa-link-cell"><a href="${esc(r.href || '#')}" target="_blank" rel="noopener">${esc((r.href || '—').slice(0, 36))}</a></td>
                      <td>${vis ? badge('نشط', 'is-ok') : badge('متوقف', 'is-bad')}</td>
                      <td class="hsa-actions">
                        <button type="button" class="hsa-btn" data-action="sa-view" data-id="${esc(r.id)}">عرض</button>
                        <a class="hsa-btn" href="${esc(r.originHref || r.href || '#')}" target="_blank" rel="noopener">الأصل</a>
                        <button type="button" class="hsa-btn" data-action="sa-toggle-visible" data-id="${esc(r.id)}">${vis ? 'إيقاف' : 'تفعيل'}</button>
                      </td>
                    </tr>`;
                  })
                  .join('')
              : `<tr><td colspan="6" class="hsa-empty">لا نتائج مطابقة.</td></tr>`
          }</tbody>
        </table></div>
        ${
          pages > 1
            ? `<div class="hsa-pager">
                <button type="button" class="hsa-btn" data-action="sa-page" data-page="${ui.page - 1}" ${ui.page <= 1 ? 'disabled' : ''}>السابق</button>
                <span>${ui.page} / ${pages}</span>
                <button type="button" class="hsa-btn" data-action="sa-page" data-page="${ui.page + 1}" ${ui.page >= pages ? 'disabled' : ''}>التالي</button>
              </div>`
            : ''
        }
      </section>`;
  };

  const renderAddWizard = () => {
    const typeMeta = ADDABLE_TYPES.find((t) => t.id === ui.addType);
    let candidates = [];
    if (typeMeta?.mode === 'pick') candidates = sourceCandidates(ui.addType);
    if (typeMeta?.mode === 'pick-live') candidates = liveCandidates(typeMeta.liveType);
    if (typeMeta?.mode === 'service') {
      candidates = (window.HubServicesCatalog?.list?.() || []).map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description || '',
        href: s.href,
        keywords: s.keywords || s.title,
        sourceType: 'service',
        sourceLabel: 'الخدمات',
        section: 'service',
        category: 'خدمة',
        existsLive: true,
        custom: !!s.custom,
      }));
    }
    const pick = candidates.find((c) => String(c.id) === String(ui.addPickId));
    const steps = ['ماذا تريد إضافته؟', 'اختيار / إدخال', 'الظهور', 'مراجعة', 'تم'];

    let stepBody = '';
    if (ui.addStep === 1) {
      stepBody = `
        <p class="hsa-lead">ماذا تريد إضافته إلى محرك البحث؟</p>
        <div class="hsa-type-grid">
          ${ADDABLE_TYPES.map(
            (t) => `<button type="button" class="hsa-type-card ${ui.addType === t.id ? 'is-on' : ''}" data-action="sa-add-type" data-type="${t.id}">
              <i class="fas ${t.icon}"></i><strong>${esc(t.label)}</strong>
            </button>`
          ).join('')}
        </div>
        <p class="hsa-muted">الكيانات الحيّة (فرع/خدمة/…) تُدار بالظهور دون نسخ. المحتوى المخصص يُضاف عبر كتالوج البحث فقط.</p>`;
    } else if (ui.addStep === 2 && (typeMeta?.mode === 'pick' || typeMeta?.mode === 'pick-live' || typeMeta?.mode === 'service')) {
      const isService = typeMeta?.mode === 'service';
      stepBody = `
        <p class="hsa-lead">${
          isService
            ? 'اختر خدمة موجودة لإعادة إظهارها، أو أضف خدمة جديدة إلى كتالوج الخدمات (نفس مصدر صفحة البحث).'
            : `اختر ${esc(typeMeta.label)} من المصدر الحي.`
        }</p>
        ${
          isService
            ? `<div class="hsa-form-grid" style="margin-bottom:12px">
                <label>أو أضف خدمة جديدة
                  <input id="hsa-f-title" type="text" value="${esc(ui.addForm.title)}" placeholder="اسم الخدمة الجديدة" />
                </label>
                <label>وصف مختصر
                  <textarea id="hsa-f-desc" rows="2">${esc(ui.addForm.description)}</textarea>
                </label>
                <label>كلمات مفتاحية
                  <input id="hsa-f-kw" type="text" value="${esc(ui.addForm.keywords)}" />
                </label>
              </div>
              <p class="hsa-muted">إن ملأت اسم خدمة جديدة فستُضاف عبر HubServicesCatalog.add — وإلا اختر خدمة موجودة بالأسفل.</p>`
            : ''
        }
        <div class="hsa-table-wrap"><table class="hsa-table">
          <thead><tr><th>العنوان</th><th>المصدر</th><th>الظهور</th><th></th></tr></thead>
          <tbody>${
            candidates.length
              ? candidates
                  .slice(0, 80)
                  .map((c) => {
                    const live = findLive(c.id);
                    const vis = live ? live.searchVisible !== false : true;
                    return `<tr>
                      <td><strong>${esc(c.title)}</strong><div class="hsa-muted">${esc((c.description || '').slice(0, 70))}</div></td>
                      <td>${esc(c.sourceLabel)}</td>
                      <td>${vis ? badge('في البحث', 'is-ok') : badge('متوقف', 'is-bad')}</td>
                      <td><button type="button" class="hsa-btn ${ui.addPickId === String(c.id) ? 'hsa-btn-primary' : ''}" data-action="sa-add-pick" data-id="${esc(c.id)}">اختيار</button></td>
                    </tr>`;
                  })
                  .join('')
              : `<tr><td colspan="4" class="hsa-empty">لا عناصر.</td></tr>`
          }</tbody>
        </table></div>`;
    } else if (ui.addStep === 2 && typeMeta?.mode === 'form') {
      stepBody = `
        <p class="hsa-lead">إضافة محتوى مخصص (غير مرتبط بكيان نايوش موجود).</p>
        <div class="hsa-form-grid">
          <label>العنوان <input id="hsa-f-title" type="text" value="${esc(ui.addForm.title)}" required /></label>
          <label>الرابط <input id="hsa-f-href" type="url" value="${esc(ui.addForm.href)}" required /></label>
          <label>الوصف <textarea id="hsa-f-desc" rows="3">${esc(ui.addForm.description)}</textarea></label>
          <label>كلمات مفتاحية <input id="hsa-f-kw" type="text" value="${esc(ui.addForm.keywords)}" /></label>
        </div>`;
    } else if (ui.addStep === 3) {
      stepBody = `
        <p class="hsa-lead">حالة الظهور في محرك البحث الشامل.</p>
        <label class="hsa-check">
          <input type="checkbox" id="hsa-f-visible" ${ui.addForm.searchVisible !== false ? 'checked' : ''} />
          يظهر في صفحة البحث فور الحفظ
        </label>`;
    } else if (ui.addStep === 4 || ui.addStep === 5) {
      const title = ui.addForm.title || pick?.title || '';
      stepBody = `
        <p class="hsa-lead">${ui.addStep === 5 ? 'تم الربط بنفس فهرس المحرك.' : 'راجع قبل الحفظ.'}</p>
        <article class="hsa-preview-hit"><div>
          <strong>${esc(title)}</strong>
          <p>${esc(ui.addForm.description || pick?.description || '')}</p>
          <small>${esc(typeMeta?.label || '')}</small>
        </div></article>
        ${ui.lastMessage ? `<p class="hsa-success">${esc(ui.lastMessage)}</p>` : ''}`;
    }

    return `
      <section class="hsa-panel">
        <h3>+ إضافة إلى محرك البحث</h3>
        <ol class="hsa-steps">${steps
          .map(
            (s, i) =>
              `<li class="${ui.addStep === i + 1 ? 'is-on' : ui.addStep > i + 1 ? 'is-done' : ''}"><span>${i + 1}</span>${esc(s)}</li>`
          )
          .join('')}</ol>
        ${stepBody}
        <div class="hsa-wizard-actions">
          ${ui.addStep > 1 && ui.addStep < 5 ? `<button type="button" class="hsa-btn" data-action="sa-add-back">رجوع</button>` : ''}
          ${ui.addStep < 4 ? `<button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-add-next">التالي</button>` : ''}
          ${
            ui.addStep === 4
              ? `<button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-add-confirm">حفظ وفهرسة</button>`
              : ''
          }
          ${
            ui.addStep === 5
              ? `<button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-tab" data-tab="indexed">عرض الفهرس</button>
                 <button type="button" class="hsa-btn" data-action="sa-add-reset">إضافة أخرى</button>
                 <a class="hsa-btn" href="search.html?q=${encodeURIComponent(ui.addForm.title || pick?.title || '')}" target="_blank" rel="noopener">فتح صفحة البحث</a>`
              : ''
          }
        </div>
      </section>`;
  };

  const renderSources = () => {
    const sources = searchSources();
    return `
      <section class="hsa-panel">
        <h3>مصادر محرك البحث الشامل</h3>
        <p class="hsa-lead">هذه المصادر تغذي صفحة البحث مباشرة — العدّاد «مفهرس ظاهر» = ما يراه المستخدم.</p>
        <div class="hsa-table-wrap"><table class="hsa-table">
          <thead><tr><th>المصدر</th><th>النوع</th><th>في الفهرس</th><th>ظاهر</th><th>الحالة</th><th></th></tr></thead>
          <tbody>${sources
            .map(
              (s) => `<tr>
                <td><strong>${esc(s.name)}</strong></td>
                <td>${esc(s.kind)}</td>
                <td>${s.available}</td>
                <td>${s.inIndex}</td>
                <td>${badge(s.status, s.status === 'نشط' ? 'is-ok' : '')}</td>
                <td><button type="button" class="hsa-btn" data-action="sa-source-view" data-source="${esc(s.id)}">عرض</button></td>
              </tr>`
            )
            .join('')}</tbody>
        </table></div>
      </section>`;
  };

  const renderIntents = () => {
    const intents = window.HubSearchIntents?.allIntents?.() || window.HubSearchIntents?.INTENTS || [];
    return `
      <section class="hsa-panel">
        <div class="hsa-engine-actions" style="margin-bottom:12px">
          <button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-intent-new">+ إضافة نية بحث</button>
        </div>
        <h3>نوايا البحث — «ماذا تبحث اليوم؟»</h3>
        <p class="hsa-lead">أي تعديل هنا يظهر فورًا في صفحة البحث (نفس إعدادات النوايا والظهور).</p>
        ${
          ui.intentEditId === 'new' || (ui.intentEditId && ui.intentEditId.startsWith('edit:'))
            ? `<div class="hsa-form-grid" style="margin:12px 0;padding:12px;border:1px solid var(--border, #ddd);border-radius:8px">
                <label>النص الظاهر <input id="hsa-intent-label" type="text" value="${esc(ui.addForm.title)}" /></label>
                <label>الأيقونة (Font Awesome) <input id="hsa-intent-icon" type="text" value="${esc(ui.addForm.icon || 'fa-compass')}" /></label>
                <label>كلمات البداية (افصل بـ |) <input id="hsa-intent-starters" type="text" value="${esc(ui.addForm.keywords)}" /></label>
                <label>الشرح <input id="hsa-intent-explain" type="text" value="${esc(ui.addForm.description)}" /></label>
                <button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-intent-save">حفظ النية</button>
                <button type="button" class="hsa-btn" data-action="sa-intent-cancel">إلغاء</button>
              </div>`
            : ''
        }
        <div class="hsa-table-wrap"><table class="hsa-table">
          <thead><tr><th>النية</th><th>المعرّف</th><th>الحالة</th><th>مخصصة؟</th><th>الإجراءات</th></tr></thead>
          <tbody>${intents
            .map((i) => {
              const disabled = cfg()?.isIntentDisabled?.(i.id);
              return `<tr>
                <td><i class="fas ${esc(i.icon || 'fa-compass')}"></i> <strong>${esc(i.label)}</strong></td>
                <td><code>${esc(i.id)}</code></td>
                <td>${disabled ? badge('متوقفة', 'is-bad') : badge('نشطة', 'is-ok')}</td>
                <td>${i.custom ? 'نعم' : 'أساسية'}</td>
                <td class="hsa-actions">
                  <button type="button" class="hsa-btn" data-action="sa-intent-toggle" data-id="${esc(i.id)}">${disabled ? 'تفعيل' : 'إيقاف'}</button>
                  ${
                    i.custom
                      ? `<button type="button" class="hsa-btn" data-action="sa-intent-edit" data-id="${esc(i.id)}">تعديل</button>
                         <button type="button" class="hsa-btn hsa-btn-danger" data-action="sa-intent-remove" data-id="${esc(i.id)}">حذف</button>`
                      : `<button type="button" class="hsa-btn" data-action="sa-intent-edit" data-id="${esc(i.id)}">تعديل النص</button>`
                  }
                </td>
              </tr>`;
            })
            .join('')}</tbody>
        </table></div>
      </section>`;
  };

  const renderQuickLists = () => {
    const lists = cfg()?.getQuickLists?.() || [];
    return `
      <section class="hsa-panel">
        <h3>القوائم السريعة</h3>
        <p class="hsa-lead">تظهر في صفحة البحث تحت «قوائم سريعة» — الإظهار/الترتيب/العنوان من هنا.</p>
        <div class="hsa-table-wrap"><table class="hsa-table">
          <thead><tr><th>العنوان</th><th>النوع</th><th>الترتيب</th><th>الحد الأقصى</th><th>الظهور</th><th></th></tr></thead>
          <tbody>${lists
            .map(
              (q) => `<tr>
                <td><input data-ql-label="${esc(q.id)}" type="text" value="${esc(q.label)}" /></td>
                <td>${esc(q.type)}</td>
                <td><input data-ql-order="${esc(q.id)}" type="number" value="${esc(q.order)}" style="width:70px" /></td>
                <td><input data-ql-max="${esc(q.id)}" type="number" value="${esc(q.maxItems || 0)}" style="width:70px" title="0 = بلا حد" /></td>
                <td>${q.visible !== false ? badge('ظاهرة', 'is-ok') : badge('مخفية', 'is-bad')}</td>
                <td class="hsa-actions">
                  <button type="button" class="hsa-btn" data-action="sa-ql-toggle" data-id="${esc(q.id)}">${q.visible !== false ? 'إخفاء' : 'إظهار'}</button>
                  <button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-ql-save" data-id="${esc(q.id)}">حفظ</button>
                </td>
              </tr>`
            )
            .join('')}</tbody>
        </table></div>
      </section>`;
  };

  const renderSettings = () => {
    const s = cat()?.defaultSettings?.() || {};
    return `<section class="hsa-panel">
      <h3>إعدادات الفهرسة التلقائية</h3>
      <p class="hsa-lead">عند نشر محتوى معتمد يمكن إضافته تلقائيًا إلى فهرس المحرك (عبر كتالوج البحث للمحتوى غير الحيّ).</p>
      ${[
        ['autoIndexArticles', 'المقالات'],
        ['autoIndexEvents', 'الفعاليات'],
        ['autoIndexProducts', 'المنتجات'],
        ['autoIndexPages', 'الصفحات العامة'],
        ['autoIndexInfo', 'مركز المعلومات'],
      ]
        .map(
          ([key, label]) => `<label class="hsa-check">
            <input type="checkbox" data-sa-setting="${key}" ${s[key] !== false ? 'checked' : ''}/>
            فهرسة تلقائية عند النشر: ${esc(label)}
          </label>`
        )
        .join('')}
      <button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-save-settings">حفظ الإعدادات</button>
    </section>`;
  };

  const renderAudit = () => {
    const rows = cat()?.readAudit?.() || [];
    return `<section class="hsa-panel">
      <h3>سجل الفهرسة</h3>
      <div class="hsa-table-wrap"><table class="hsa-table">
        <thead><tr><th>العملية</th><th>العنصر</th><th>بواسطة</th><th>الوقت</th><th>النتيجة</th></tr></thead>
        <tbody>${
          rows.length
            ? rows
                .slice(0, 100)
                .map(
                  (a) => `<tr>
                    <td>${esc(a.action || '—')}</td>
                    <td>${esc(a.title || a.itemId || '—')}</td>
                    <td>${esc(a.by || '—')}</td>
                    <td>${esc(fmt(a.at))}</td>
                    <td>${badge(a.result || 'نجاح', a.result === 'فشل' ? 'is-bad' : 'is-ok')}</td>
                  </tr>`
                )
                .join('')
            : `<tr><td colspan="5" class="hsa-empty">لا عمليات بعد.</td></tr>`
        }</tbody>
      </table></div>
    </section>`;
  };

  const render = () => {
    const tabs = [
      ['overview', 'نظرة عامة'],
      ['indexed', 'فهرس المحرك'],
      ['add', 'إضافة'],
      ['sources', 'المصادر'],
      ['intents', 'نوايا البحث'],
      ['quicklists', 'القوائم السريعة'],
      ['settings', 'إعدادات'],
      ['audit', 'السجل'],
    ];
    let body = '';
    if (ui.tab === 'overview') body = renderOverview();
    else if (ui.tab === 'indexed') body = renderIndexed();
    else if (ui.tab === 'add') body = renderAddWizard();
    else if (ui.tab === 'sources') body = renderSources();
    else if (ui.tab === 'intents') body = renderIntents();
    else if (ui.tab === 'quicklists') body = renderQuickLists();
    else if (ui.tab === 'settings') body = renderSettings();
    else body = renderAudit();

    return `
      <div class="hsa-root" data-hsa-root>
        <header class="hsa-hero">
          <div>
            <h2>إدارة محرك البحث</h2>
            <p>لوحة التحكم لنفس «محرك البحث الشامل» في صفحة البحث — مصدر حقيقة موحّد.</p>
          </div>
          <div class="hsa-hero-actions">
            <button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-tab" data-tab="add">+ إضافة إلى محرك البحث</button>
            <a class="hsa-btn" href="search.html" target="_blank" rel="noopener">فتح صفحة البحث</a>
          </div>
        </header>
        ${ui.tab !== 'overview' ? renderLiveStats() : ''}
        <nav class="hsa-tabs" aria-label="أقسام إدارة محرك البحث">${tabs
          .map(
            ([id, label]) =>
              `<button type="button" class="hsa-tab ${ui.tab === id ? 'is-on' : ''}" data-action="sa-tab" data-tab="${id}">${esc(label)}</button>`
          )
          .join('')}</nav>
        <div class="hsa-main">${body}</div>
        ${renderDrawer()}${renderPreview()}
      </div>`;
  };

  const readAddFormFromDom = () => {
    const title = document.getElementById('hsa-f-title')?.value?.trim();
    const href = document.getElementById('hsa-f-href')?.value?.trim();
    const description = document.getElementById('hsa-f-desc')?.value?.trim();
    const keywords = document.getElementById('hsa-f-kw')?.value?.trim();
    const visibleEl = document.getElementById('hsa-f-visible');
    if (document.getElementById('hsa-f-title') && title !== undefined) ui.addForm.title = title;
    if (document.getElementById('hsa-f-href') && href !== undefined) ui.addForm.href = href;
    if (document.getElementById('hsa-f-desc') && description !== undefined) ui.addForm.description = description;
    if (document.getElementById('hsa-f-kw') && keywords !== undefined) ui.addForm.keywords = keywords;
    if (visibleEl) ui.addForm.searchVisible = !!visibleEl.checked;
  };

  const afterPaint = (ctx = {}) => {
    window.__hubSaCtx = ctx;
    window.__hubSaRerender = ctx.rerender;
  };

  const syncPersist = async () => {
    try {
      await cat()?.pushRemote?.();
    } catch (_) {}
    try {
      await cfg()?.pushRemote?.();
    } catch (_) {}
  };

  const handle = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const actor = user?.name || user?.email || 'مشغّل هوب';

    if (action === 'sa-tab') {
      ui.tab = btn.dataset.tab || 'overview';
      if (ui.tab === 'add' && ui.addStep !== 5) ui.lastMessage = '';
      return true;
    }
    if (action === 'sa-stat') {
      const f = btn.dataset.filter || '';
      ui.tab = 'indexed';
      ui.filters = { type: '', source: '', visible: '' };
      ui.q = '';
      ui.page = 1;
      if (f.startsWith('type:')) ui.filters.type = f.slice(5);
      return true;
    }
    if (action === 'sa-apply') {
      ui.q = document.getElementById('hsa-q')?.value || '';
      ui.filters.type = document.getElementById('hsa-f-type')?.value || '';
      ui.filters.source = document.getElementById('hsa-f-source')?.value || '';
      ui.filters.visible = document.getElementById('hsa-f-visible')?.value || '';
      ui.page = 1;
      return true;
    }
    if (action === 'sa-clear') {
      ui.q = '';
      ui.filters = { type: '', source: '', visible: '' };
      ui.page = 1;
      return true;
    }
    if (action === 'sa-page') {
      const p = Number(btn.dataset.page || 1);
      if (p >= 1) ui.page = p;
      return true;
    }
    if (action === 'sa-view') {
      ui.selectedId = btn.dataset.id;
      return true;
    }
    if (action === 'sa-drawer-close') {
      ui.selectedId = null;
      return true;
    }
    if (action === 'sa-preview') {
      ui.previewId = btn.dataset.id;
      return true;
    }
    if (action === 'sa-preview-close') {
      ui.previewId = null;
      return true;
    }
    if (action === 'sa-toggle-visible') {
      const row = findLive(btn.dataset.id);
      if (!row) return true;
      const nextVisible = row.searchVisible === false;
      setItemVisible(btn.dataset.id, nextVisible, actor);
      syncPersist();
      toast?.(nextVisible ? 'تم تفعيل الظهور في محرك البحث' : 'تم إيقاف الظهور في محرك البحث');
      return true;
    }
    if (action === 'sa-add-type') {
      ui.addType = btn.dataset.type || '';
      ui.addPickId = '';
      ui.addForm = { title: '', href: '', description: '', keywords: '', category: '', searchVisible: true, icon: 'fa-compass' };
      ui.addStep = 2;
      ui.lastMessage = '';
      return true;
    }
    if (action === 'sa-add-pick') {
      ui.addPickId = btn.dataset.id;
      const typeMeta = ADDABLE_TYPES.find((t) => t.id === ui.addType);
      let pick = null;
      if (typeMeta?.mode === 'service') {
        pick = (window.HubServicesCatalog?.list?.() || []).find((s) => String(s.id) === String(ui.addPickId));
        if (pick) {
          ui.addForm = {
            ...ui.addForm,
            title: pick.title,
            href: pick.href,
            description: pick.description || '',
            keywords: pick.keywords || pick.title,
            category: 'خدمة',
            searchVisible: true,
          };
        }
      } else if (typeMeta?.mode === 'pick-live') {
        pick = liveCandidates(typeMeta.liveType).find((c) => String(c.id) === String(ui.addPickId));
        if (pick) {
          ui.addForm = {
            ...ui.addForm,
            title: pick.title,
            href: pick.href,
            description: pick.description || '',
            keywords: pick.keywords || '',
            category: pick.category || '',
            searchVisible: true,
          };
        }
      } else {
        pick = sourceCandidates(ui.addType).find((c) => String(c.id) === String(ui.addPickId));
        if (pick) {
          ui.addForm = {
            ...ui.addForm,
            title: pick.title,
            href: pick.href,
            description: pick.description || '',
            keywords: pick.keywords || '',
            category: pick.category || '',
            searchVisible: true,
          };
        }
      }
      return true;
    }
    if (action === 'sa-add-back') {
      readAddFormFromDom();
      ui.addStep = Math.max(1, ui.addStep - 1);
      if (ui.addStep === 1) {
        ui.addType = '';
        ui.addPickId = '';
      }
      return true;
    }
    if (action === 'sa-add-next') {
      readAddFormFromDom();
      const typeMeta = ADDABLE_TYPES.find((t) => t.id === ui.addType);
      if (ui.addStep === 1 && !ui.addType) {
        toast?.('اختر النوع أولاً');
        return true;
      }
      if (ui.addStep === 2) {
        if (typeMeta?.mode === 'form') {
          if (!ui.addForm.title || !ui.addForm.href) {
            toast?.('العنوان والرابط مطلوبان');
            return true;
          }
        } else if (typeMeta?.mode === 'service') {
          if (!ui.addPickId && !ui.addForm.title) {
            toast?.('اختر خدمة أو أدخل اسم خدمة جديدة');
            return true;
          }
        } else if (!ui.addPickId) {
          toast?.('اختر عنصرًا');
          return true;
        }
      }
      ui.addStep = Math.min(4, ui.addStep + 1);
      return true;
    }
    if (action === 'sa-add-reset') {
      ui.addStep = 1;
      ui.addType = '';
      ui.addPickId = '';
      ui.addForm = { title: '', href: '', description: '', keywords: '', category: '', searchVisible: true, icon: 'fa-compass' };
      ui.lastMessage = '';
      ui.tab = 'add';
      return true;
    }
    if (action === 'sa-add-confirm') {
      readAddFormFromDom();
      const typeMeta = ADDABLE_TYPES.find((t) => t.id === ui.addType);
      const visible = ui.addForm.searchVisible !== false;
      let savedId = '';
      let savedTitle = ui.addForm.title;

      if (typeMeta?.mode === 'service') {
        const picked = ui.addPickId ? window.HubServicesCatalog?.get?.(ui.addPickId) : null;
        const newTitle = String(ui.addForm.title || '').trim();
        const useExisting = picked && (!newTitle || newTitle === String(picked.title || '').trim());
        if (useExisting) {
          setItemVisible(picked.id, visible, actor);
          savedId = picked.id;
          savedTitle = picked.title;
        } else if (newTitle) {
          const res = window.HubServicesCatalog?.add?.({
            title: newTitle,
            description: ui.addForm.description,
            keywords: ui.addForm.keywords || newTitle,
          });
          if (!res?.ok) {
            toast?.(res?.error || 'فشل إضافة الخدمة');
            return true;
          }
          savedId = res.item.id;
          savedTitle = res.item.title;
          if (!visible) setItemVisible(savedId, false, actor);
        } else {
          toast?.('اختر خدمة أو أدخل اسمًا جديدًا');
          return true;
        }
        cat()?.pushAudit?.({
          action: 'إضافة خدمة لمحرك البحث',
          itemId: savedId,
          title: savedTitle,
          by: actor,
          result: 'نجاح',
        });
      } else if (typeMeta?.mode === 'pick-live') {
        setItemVisible(ui.addPickId, visible, actor);
        savedId = ui.addPickId;
        savedTitle = findLive(ui.addPickId)?.title || ui.addForm.title;
      } else if (typeMeta?.mode === 'form') {
        const res = cat()?.upsert?.({
          section: typeMeta.section || 'page',
          kind: 'content',
          title: ui.addForm.title,
          description: ui.addForm.description,
          keywords: ui.addForm.keywords,
          href: ui.addForm.href,
          sourceType: ui.addType,
          sourceLabel: 'محتوى مخصص',
          category: typeMeta.label,
          status: 'published',
          searchVisible: visible,
          indexStatus: 'indexed',
          actor,
        });
        if (!res?.ok) {
          toast?.(res?.error || 'فشل الحفظ');
          return true;
        }
        savedId = res.item.id;
        savedTitle = res.item.title;
      } else if (typeMeta?.mode === 'pick') {
        const pick = sourceCandidates(ui.addType).find((c) => String(c.id) === String(ui.addPickId));
        const res = cat()?.upsertFromSource?.(
          {
            id: `${pick.sourceType}-${pick.id}`,
            sourceType: pick.sourceType,
            sourceId: pick.id,
            sourceLabel: pick.sourceLabel,
            section: pick.section || typeMeta.section,
            kind: 'content',
            title: ui.addForm.title || pick.title,
            description: ui.addForm.description || pick.description,
            keywords: ui.addForm.keywords || pick.keywords,
            href: ui.addForm.href || pick.href,
            category: ui.addForm.category || pick.category,
            status: 'published',
            searchVisible: visible,
            indexStatus: 'indexed',
          },
          actor
        );
        if (!res?.ok) {
          toast?.(res?.error || 'فشل الفهرسة');
          return true;
        }
        savedId = res.item.id;
        savedTitle = res.item.title;
      }

      ui.addForm.title = savedTitle;
      syncPersist();
      ui.lastMessage = visible
        ? `تمت الإضافة/التفعيل — العنصر جزء من فهرس صفحة البحث (${savedTitle}).`
        : 'تم الحفظ مع إيقاف الظهور — يمكنك تفعيله لاحقًا.';
      ui.addStep = 5;
      toast?.(ui.lastMessage);
      return true;
    }
    if (action === 'sa-source-view') {
      ui.tab = 'indexed';
      ui.filters = { type: btn.dataset.source || '', source: '', visible: '' };
      ui.page = 1;
      return true;
    }
    if (action === 'sa-intent-new') {
      ui.intentEditId = 'new';
      ui.addForm = { title: '', href: '', description: '', keywords: '', category: '', searchVisible: true, icon: 'fa-compass' };
      return true;
    }
    if (action === 'sa-intent-edit') {
      const intent = (window.HubSearchIntents?.allIntents?.() || []).find((i) => String(i.id) === String(btn.dataset.id));
      ui.intentEditId = `edit:${btn.dataset.id}`;
      ui.addForm = {
        title: intent?.label || '',
        icon: intent?.icon || 'fa-compass',
        keywords: (intent?.starters || []).join(' | '),
        description: intent?.explain || '',
        href: '',
        category: '',
        searchVisible: true,
      };
      return true;
    }
    if (action === 'sa-intent-cancel') {
      ui.intentEditId = null;
      return true;
    }
    if (action === 'sa-intent-save') {
      const label = document.getElementById('hsa-intent-label')?.value?.trim() || ui.addForm.title;
      const icon = document.getElementById('hsa-intent-icon')?.value?.trim() || 'fa-compass';
      const starters = document.getElementById('hsa-intent-starters')?.value || label;
      const explain = document.getElementById('hsa-intent-explain')?.value?.trim() || '';
      if (!label) {
        toast?.('نص النية مطلوب');
        return true;
      }
      if (ui.intentEditId === 'new') {
        cfg()?.upsertCustomIntent?.(
          { label, icon, starters, explain, group: 'primary', keywords: starters },
          actor
        );
      } else if (ui.intentEditId?.startsWith('edit:')) {
        const id = ui.intentEditId.slice(5);
        const existing = (window.HubSearchIntents?.allIntents?.() || []).find((i) => String(i.id) === id);
        if (existing?.custom) {
          cfg()?.upsertCustomIntent?.(
            {
              id,
              label,
              icon,
              starters,
              explain,
              group: existing.group || 'primary',
            },
            actor
          );
        } else {
          cfg()?.patchIntent?.(
            id,
            {
              label,
              icon,
              starters: String(starters)
                .split('|')
                .map((s) => s.trim())
                .filter(Boolean),
              explain,
            },
            actor
          );
        }
      }
      ui.intentEditId = null;
      syncPersist();
      toast?.('تم حفظ نية البحث');
      return true;
    }
    if (action === 'sa-intent-toggle') {
      const id = btn.dataset.id;
      const disabled = cfg()?.isIntentDisabled?.(id);
      cfg()?.setIntentDisabled?.(id, !disabled, actor);
      syncPersist();
      toast?.(disabled ? 'تم تفعيل النية' : 'تم إيقاف النية');
      return true;
    }
    if (action === 'sa-intent-remove') {
      if (!confirm('حذف نية البحث المخصصة؟')) return true;
      cfg()?.removeCustomIntent?.(btn.dataset.id, actor);
      syncPersist();
      toast?.('تم الحذف');
      return true;
    }
    if (action === 'sa-ql-toggle') {
      const id = btn.dataset.id;
      const list = cfg()?.getQuickLists?.()?.find((q) => q.id === id);
      cfg()?.setQuickList?.(id, { visible: !(list?.visible !== false) }, actor);
      syncPersist();
      toast?.('تم تحديث القائمة السريعة');
      return true;
    }
    if (action === 'sa-ql-save') {
      const id = btn.dataset.id;
      const label = document.querySelector(`[data-ql-label="${id}"]`)?.value?.trim();
      const order = Number(document.querySelector(`[data-ql-order="${id}"]`)?.value || 0);
      const maxItems = Number(document.querySelector(`[data-ql-max="${id}"]`)?.value || 0);
      cfg()?.setQuickList?.(id, { label, order, maxItems }, actor);
      syncPersist();
      toast?.('تم حفظ القائمة السريعة');
      return true;
    }
    if (action === 'sa-save-settings') {
      const next = { ...(cat()?.defaultSettings?.() || {}) };
      document.querySelectorAll('[data-sa-setting]').forEach((el) => {
        next[el.getAttribute('data-sa-setting')] = !!el.checked;
      });
      cat()?.saveSettings?.(next);
      toast?.('تم حفظ الإعدادات');
      return true;
    }
    return false;
  };

  window.HubSearchAdminWS = {
    render,
    handle,
    afterPaint,
    ui,
    sourceCandidates,
    searchSources,
    ADDABLE_TYPES,
    liveCatalog,
    liveStats,
  };
})();
