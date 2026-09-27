/**
 * إدارة محرك البحث — لوحة مدمجة في dashboard.html#search-admin
 * مصدر الحقيقة: HubSearchCatalog → يظهر في HubUniversalSearch (search.html)
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
    filters: { section: '', source: '', status: '', visible: '' },
    page: 1,
    pageSize: 20,
    selectedId: null,
    openMenu: null,
    previewId: null,
    addStep: 1,
    addType: '',
    addPickId: '',
    addForm: {
      title: '',
      href: '',
      description: '',
      keywords: '',
      category: '',
      searchVisible: true,
    },
    lastMessage: '',
  };

  const cat = () => window.HubSearchCatalog;
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

  const STATUS_AR = {
    published: 'نشط',
    draft: 'مسودة',
    hidden: 'متوقف',
    indexed: 'مفهرس',
    pending: 'بانتظار الفهرسة',
    failed: 'فشل',
    updating: 'جاري التحديث',
  };

  const badge = (t, cls = '') => `<span class="hsa-badge ${cls}">${esc(t)}</span>`;

  /** أنواع يمكن إضافتها — فقط ما يدعمه النظام فعليًا */
  const ADDABLE_TYPES = [
    { id: 'product', label: 'منتج', icon: 'fa-box', section: 'product', mode: 'pick' },
    { id: 'article', label: 'مقال', icon: 'fa-newspaper', section: 'content', mode: 'pick' },
    { id: 'event', label: 'فعالية', icon: 'fa-calendar-days', section: 'event', mode: 'pick' },
    { id: 'system', label: 'نظام', icon: 'fa-cube', section: 'system', mode: 'pick' },
    { id: 'platform', label: 'منصة', icon: 'fa-layer-group', section: 'platform', mode: 'pick' },
    { id: 'service', label: 'خدمة', icon: 'fa-handshake', section: 'service', mode: 'pick' },
    { id: 'store', label: 'متجر', icon: 'fa-bag-shopping', section: 'store', mode: 'pick' },
    { id: 'info', label: 'صفحة معلومات', icon: 'fa-circle-info', section: 'content', mode: 'pick' },
    { id: 'page', label: 'صفحة', icon: 'fa-file', section: 'page', mode: 'form' },
    { id: 'link', label: 'رابط خارجي', icon: 'fa-link', section: 'link', mode: 'form' },
  ];

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
      const apps = window.HubStore?.get?.()?.empire?.apps || [];
      apps.forEach((a) =>
        push({
          id: a.id || a.code,
          title: a.nameAr || a.name,
          description: a.category || '',
          href: a.launchUrl || a.url || `apps.html#${encodeURIComponent(a.code || a.id)}`,
          keywords: [a.nameAr, a.name, a.code, a.category].filter(Boolean).join(' '),
          sourceType: 'system',
          sourceLabel: 'الأنظمة',
          section: 'system',
          category: a.category || 'نظام',
        })
      );
    } catch (_) {}

    try {
      const platforms =
        window.HubSovereignPlatforms?.list || window.HubStore?.get?.()?.empire?.organization?.platforms || [];
      platforms.forEach((p, idx) =>
        push({
          id: p.id || p.code || `plt-${idx}`,
          title: p.nameAr || p.name,
          description: p.role || '',
          href: `platforms.html#${encodeURIComponent(p.code || p.id || '')}`,
          keywords: [p.nameAr, p.name, p.code, p.role].filter(Boolean).join(' '),
          sourceType: 'platform',
          sourceLabel: 'المنصات',
          section: 'platform',
          category: 'منصة',
        })
      );
    } catch (_) {}

    try {
      (window.HubServicesCatalog?.list?.() || []).forEach((s) =>
        push({
          id: s.id || s.code,
          title: s.nameAr || s.title,
          description: s.descriptionAr || s.description || '',
          href: s.href || `services.html#${encodeURIComponent(s.id || s.code)}`,
          keywords: s.nameAr || s.title,
          sourceType: 'service',
          sourceLabel: 'الخدمات',
          section: 'service',
          category: 'خدمة',
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

    try {
      (window.HubInfoCenterPages?.list?.() || window.HubInfoCenterPages?.PAGES || []).forEach((p) =>
        push({
          id: p.id || p.slug,
          title: p.title || p.titleAr,
          description: p.subtitle || p.summary || '',
          href: p.href || `info-center.html#${p.id || p.slug}`,
          keywords: [p.title, p.shortTitle, p.keywords].filter(Boolean).join(' '),
          sourceType: 'info',
          sourceLabel: 'مركز المعلومات',
          section: 'content',
          category: 'معلومات',
        })
      );
    } catch (_) {}

    return out;
  };

  /** مصادر البحث = من أين تأتي البيانات للمحرك */
  const searchSources = () => {
    const indexed = cat()?.list?.() || [];
    const countFor = (sourceType) => indexed.filter((r) => r.sourceType === sourceType).length;
    const defs = [
      { id: 'product', name: 'المنتجات', kind: 'منتجات', gather: () => sourceCandidates('product') },
      { id: 'article', name: 'المقالات', kind: 'محتوى', gather: () => sourceCandidates('article') },
      { id: 'event', name: 'الفعاليات', kind: 'فعاليات', gather: () => sourceCandidates('event') },
      { id: 'system', name: 'الأنظمة', kind: 'أنظمة', gather: () => sourceCandidates('system') },
      { id: 'platform', name: 'المنصات', kind: 'منصات', gather: () => sourceCandidates('platform') },
      { id: 'service', name: 'الخدمات', kind: 'خدمات', gather: () => sourceCandidates('service') },
      { id: 'store', name: 'المتجر', kind: 'متجر', gather: () => sourceCandidates('store') },
      { id: 'info', name: 'مركز المعلومات', kind: 'صفحات', gather: () => sourceCandidates('info') },
      {
        id: 'page',
        name: 'صفحات مخصصة',
        kind: 'صفحات',
        gather: () => indexed.filter((r) => r.sourceType === 'page' || r.section === 'page'),
      },
      {
        id: 'link',
        name: 'روابط خارجية',
        kind: 'روابط',
        gather: () => indexed.filter((r) => r.sourceType === 'link' || r.section === 'link'),
      },
    ];
    return defs.map((d) => {
      const available = typeof d.gather === 'function' ? d.gather().length : 0;
      const inIndex = countFor(d.id);
      const last = indexed
        .filter((r) => r.sourceType === d.id)
        .map((r) => r.indexedAt || r.updatedAt || '')
        .filter(Boolean)
        .sort()
        .reverse()[0];
      return {
        ...d,
        available,
        inIndex,
        status: inIndex > 0 || available > 0 ? 'نشط' : 'فارغ',
        lastSync: last || '',
      };
    });
  };

  const filteredRows = () => {
    let rows = cat()?.list?.() || [];
    if (ui.filters.section) rows = rows.filter((r) => r.section === ui.filters.section);
    if (ui.filters.source) {
      rows = rows.filter(
        (r) => r.sourceType === ui.filters.source || r.sourceLabel === ui.filters.source
      );
    }
    if (ui.filters.status === 'failed') rows = rows.filter((r) => r.indexStatus === 'failed');
    else if (ui.filters.status === 'pending') rows = rows.filter((r) => r.indexStatus === 'pending');
    else if (ui.filters.status === 'indexed')
      rows = rows.filter((r) => r.indexStatus === 'indexed' || !r.indexStatus);
    if (ui.filters.visible === '1') rows = rows.filter((r) => r.searchVisible !== false);
    if (ui.filters.visible === '0') rows = rows.filter((r) => r.searchVisible === false);
    const q = String(ui.q || '').trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        [r.title, r.description, r.keywords, r.href, r.sourceLabel, r.category].join(' ').toLowerCase().includes(q)
      );
    }
    return rows;
  };

  const alreadyIndexed = (sourceType, sourceId) => {
    const id = `${sourceType}-${sourceId}`;
    return !!(cat()?.get?.(id) || (cat()?.list?.() || []).find((r) => r.sourceType === sourceType && String(r.sourceId) === String(sourceId)));
  };

  const renderDrawer = () => {
    if (!ui.selectedId) return '';
    const row = cat()?.get?.(ui.selectedId);
    if (!row) return '';
    return `
      <div class="hsa-drawer-backdrop" data-action="sa-drawer-close"></div>
      <aside class="hsa-drawer" role="dialog" aria-label="تفاصيل عنصر البحث">
        <header class="hsa-drawer-head">
          <h3>تفاصيل عنصر البحث</h3>
          <button type="button" class="hsa-btn" data-action="sa-drawer-close" title="إغلاق">إغلاق</button>
        </header>
        <div class="hsa-drawer-body">
          <p><strong>العنوان:</strong> ${esc(row.title)}</p>
          <p><strong>النوع:</strong> ${esc(cat()?.SECTION_META?.[row.section]?.typeAr || row.kind)}</p>
          <p><strong>المصدر:</strong> ${esc(row.sourceLabel || row.sourceType || '—')}</p>
          <p><strong>الرابط:</strong> <a href="${esc(row.href || cat().viewUrl(row.id))}" target="_blank" rel="noopener">${esc(row.href || cat().viewUrl(row.id))}</a></p>
          <p><strong>الوصف:</strong> ${esc(row.description || '—')}</p>
          <p><strong>الكلمات المفتاحية:</strong> ${esc(row.keywords || '—')}</p>
          <p><strong>التصنيف:</strong> ${esc(row.category || '—')}</p>
          <p><strong>حالة الظهور:</strong> ${row.searchVisible === false ? badge('متوقف', 'is-bad') : badge('نشط', 'is-ok')}</p>
          <p><strong>حالة الفهرسة:</strong> ${badge(STATUS_AR[row.indexStatus] || 'مفهرس', row.indexStatus === 'failed' ? 'is-bad' : 'is-ok')}</p>
          ${row.indexError ? `<p><strong>سبب الفشل:</strong> ${esc(row.indexError)}</p>` : ''}
          <p><strong>آخر تحديث:</strong> ${esc(fmt(row.updatedAt || row.indexedAt))}</p>
        </div>
        <div class="hsa-drawer-actions">
          <button type="button" class="hsa-btn" data-action="sa-preview" data-id="${esc(row.id)}" title="معاينة نتيجة البحث">معاينة نتيجة البحث</button>
          <button type="button" class="hsa-btn" data-action="sa-reindex" data-id="${esc(row.id)}" title="إعادة الفهرسة">إعادة الفهرسة</button>
          <button type="button" class="hsa-btn" data-action="sa-toggle-visible" data-id="${esc(row.id)}" title="${row.searchVisible === false ? 'تفعيل الظهور' : 'إيقاف الظهور'}">${row.searchVisible === false ? 'تفعيل الظهور' : 'إيقاف الظهور'}</button>
          <button type="button" class="hsa-btn hsa-btn-danger" data-action="sa-remove" data-id="${esc(row.id)}" title="حذف من محرك البحث فقط">حذف من محرك البحث</button>
        </div>
      </aside>`;
  };

  const renderPreview = () => {
    if (!ui.previewId) return '';
    const row = cat()?.get?.(ui.previewId) || null;
    const draft =
      row ||
      (ui.addForm.title
        ? {
            title: ui.addForm.title,
            description: ui.addForm.description,
            category: ui.addForm.category,
            href: ui.addForm.href,
            sourceLabel: ADDABLE_TYPES.find((t) => t.id === ui.addType)?.label || 'مخصص',
            section: ui.addType || 'content',
          }
        : null);
    if (!draft) return '';
    return `<div class="hsa-modal"><div class="hsa-modal-card">
      <header><h3>معاينة نتيجة البحث</h3><button type="button" class="hsa-btn" data-action="sa-preview-close" title="إغلاق">إغلاق</button></header>
      <p class="hsa-lead">هكذا سيظهر العنصر تقريبًا للمستخدم في محرك بحث نايوش:</p>
      <article class="hsa-preview-hit">
        <div>
          <strong>${esc(draft.title)}</strong>
          <p>${esc(draft.description || '')}</p>
          <small>${esc(cat()?.SECTION_META?.[draft.section]?.typeAr || draft.category || 'محتوى')} · ${esc(draft.sourceLabel || '')}</small>
          <div class="hsa-muted">${esc(draft.href || '')}</div>
        </div>
      </article>
    </div></div>`;
  };

  const renderStats = (st) => `
    <div class="hsa-stats" role="group" aria-label="إحصائيات محرك البحث">
      <button type="button" class="hsa-stat" data-action="sa-stat" data-filter="" title="عرض كل المحتوى"><strong>${st.total}</strong><span>إجمالي المحتوى</span></button>
      <button type="button" class="hsa-stat" data-action="sa-stat" data-filter="visible:1" title="المحتوى النشط في البحث"><strong>${st.active ?? st.published}</strong><span>المحتوى النشط</span></button>
      <button type="button" class="hsa-stat" data-action="sa-stat" data-filter="status:pending" title="بانتظار الفهرسة"><strong>${st.pending}</strong><span>بانتظار الفهرسة</span></button>
      <button type="button" class="hsa-stat" data-action="sa-stat" data-filter="status:failed" title="فشل الفهرسة"><strong>${st.failed}</strong><span>فشل الفهرسة</span></button>
      <button type="button" class="hsa-stat" data-action="sa-tab" data-tab="sources" title="مصادر البحث"><strong>${st.sources}</strong><span>مصادر البحث</span></button>
      <button type="button" class="hsa-stat" data-action="sa-tab" data-tab="audit" title="آخر تحديث"><strong>${st.lastIndexedAt ? fmt(st.lastIndexedAt).split(',')[0] : '—'}</strong><span>آخر تحديث</span></button>
    </div>`;

  const renderOverview = () => {
    const st = cat()?.stats?.() || {};
    const eng = engine();
    const recent = (cat()?.list?.() || []).slice(0, 5);
    return `
      <section class="hsa-panel">
        <div class="hsa-engine-card">
          <div>
            <p class="hsa-kicker">محرك البحث (مكان ظهور النتائج للمستخدم)</p>
            <h3>${esc(eng.nameAr)}</h3>
            <p class="hsa-lead">${esc(eng.description || 'محرك البحث الشامل في نايوش هوب.')}</p>
            <p class="hsa-muted">لا توجد محركات أخرى مدعومة حاليًا — لذلك لا تظهر قائمة اختيار فارغة.</p>
          </div>
          <div class="hsa-engine-actions">
            <a class="hsa-btn hsa-btn-primary" href="search.html" target="_blank" rel="noopener" title="فتح محرك بحث نايوش">فتح محرك بحث نايوش</a>
            <button type="button" class="hsa-btn" data-action="sa-tab" data-tab="add" title="إضافة محتوى">+ إضافة محتوى</button>
            <button type="button" class="hsa-btn" data-action="sa-tab" data-tab="sources" title="إدارة المصادر">إدارة المصادر</button>
          </div>
        </div>
        <div class="hsa-diff-grid">
          <article>
            <h4><i class="fas fa-magnifying-glass"></i> محرك البحث</h4>
            <p>هو المكان الذي ينفّذ البحث للمستخدم ويعرض النتائج (صفحة search.html).</p>
          </article>
          <article>
            <h4><i class="fas fa-database"></i> مصدر البحث</h4>
            <p>هو مكان البيانات: منتجات، مقالات، فعاليات، أنظمة… تتم فهرستها هنا لتظهر في المحرك.</p>
          </article>
        </div>
        ${renderStats(st)}
        <h3 style="margin-top:16px">أحدث المحتوى المفهرس</h3>
        ${
          recent.length
            ? `<ul class="hsa-recent">${recent
                .map(
                  (r) =>
                    `<li><strong>${esc(r.title)}</strong> <span>${esc(r.sourceLabel || r.sourceType || '')}</span> <button type="button" class="hsa-btn" data-action="sa-view" data-id="${esc(r.id)}" title="عرض">عرض</button></li>`
                )
                .join('')}</ul>`
            : `<div class="hsa-empty-box">
                <p>لا يوجد محتوى مضاف إلى محرك البحث حتى الآن.</p>
                <button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-tab" data-tab="add">+ إضافة أول محتوى</button>
              </div>`
        }
      </section>`;
  };

  const renderIndexed = () => {
    const rows = filteredRows();
    const pages = Math.max(1, Math.ceil(rows.length / ui.pageSize) || 1);
    ui.page = Math.min(ui.page, pages);
    const start = (ui.page - 1) * ui.pageSize;
    const pageRows = rows.slice(start, start + ui.pageSize);
    const sources = [...new Set((cat()?.list?.() || []).map((r) => r.sourceLabel || r.sourceType).filter(Boolean))];
    return `
      <section class="hsa-panel">
        <div class="hsa-toolbar">
          <input type="search" id="hsa-q" value="${esc(ui.q)}" placeholder="ابحث بالعنوان أو الرابط أو المصدر..." title="بحث" />
          <select id="hsa-f-section" title="فلتر النوع">
            <option value="">كل الأنواع</option>
            ${Object.entries(cat()?.SECTION_META || {})
              .map(([k, v]) => `<option value="${k}" ${ui.filters.section === k ? 'selected' : ''}>${esc(v.typeAr)}</option>`)
              .join('')}
          </select>
          <select id="hsa-f-source" title="فلتر المصدر">
            <option value="">كل المصادر</option>
            ${sources
              .map((s) => `<option value="${esc(s)}" ${ui.filters.source === s ? 'selected' : ''}>${esc(s)}</option>`)
              .join('')}
          </select>
          <select id="hsa-f-status" title="فلتر حالة الفهرسة">
            <option value="">كل الحالات</option>
            <option value="indexed" ${ui.filters.status === 'indexed' ? 'selected' : ''}>مفهرس</option>
            <option value="pending" ${ui.filters.status === 'pending' ? 'selected' : ''}>بانتظار الفهرسة</option>
            <option value="failed" ${ui.filters.status === 'failed' ? 'selected' : ''}>فشل الفهرسة</option>
          </select>
          <select id="hsa-f-visible" title="فلتر الظهور">
            <option value="">الظهور: الكل</option>
            <option value="1" ${ui.filters.visible === '1' ? 'selected' : ''}>نشط</option>
            <option value="0" ${ui.filters.visible === '0' ? 'selected' : ''}>متوقف</option>
          </select>
          <button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-apply" title="تطبيق الفلاتر">تطبيق</button>
          <button type="button" class="hsa-btn" data-action="sa-clear" title="مسح الفلاتر">مسح الفلاتر</button>
          <button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-tab" data-tab="add" title="إضافة محتوى">+ إضافة محتوى</button>
        </div>
        <div class="hsa-table-wrap"><table class="hsa-table">
          <thead><tr>
            <th>العنوان</th><th>النوع</th><th>المصدر</th><th>التصنيف</th><th>الرابط</th><th>حالة الظهور</th><th>حالة الفهرسة</th><th>آخر تحديث</th><th>الإجراءات</th>
          </tr></thead>
          <tbody>${
            pageRows.length
              ? pageRows
                  .map((r) => {
                    const vis = r.searchVisible === false;
                    return `<tr>
                      <td><strong>${esc(r.title)}</strong></td>
                      <td>${esc(cat()?.SECTION_META?.[r.section]?.typeAr || r.kind || '—')}</td>
                      <td>${esc(r.sourceLabel || r.sourceType || '—')}</td>
                      <td>${esc(r.category || '—')}</td>
                      <td class="hsa-link-cell"><a href="${esc(r.href || '#')}" target="_blank" rel="noopener" title="فتح الرابط">${esc((r.href || '—').slice(0, 40))}</a></td>
                      <td>${vis ? badge('متوقف', 'is-bad') : badge('نشط', 'is-ok')}</td>
                      <td>${badge(STATUS_AR[r.indexStatus] || 'مفهرس', r.indexStatus === 'failed' ? 'is-bad' : r.indexStatus === 'pending' ? '' : 'is-ok')}</td>
                      <td>${esc(fmt(r.updatedAt || r.indexedAt))}</td>
                      <td class="hsa-actions">
                        <button type="button" class="hsa-btn" data-action="sa-view" data-id="${esc(r.id)}" title="عرض">عرض</button>
                        <button type="button" class="hsa-btn" data-action="sa-preview" data-id="${esc(r.id)}" title="تعديل بيانات البحث / معاينة">معاينة</button>
                        <button type="button" class="hsa-btn" data-action="sa-reindex" data-id="${esc(r.id)}" title="إعادة الفهرسة">إعادة الفهرسة</button>
                        <button type="button" class="hsa-btn" data-action="sa-toggle-visible" data-id="${esc(r.id)}" title="${vis ? 'تفعيل الظهور' : 'إيقاف الظهور'}">${vis ? 'تفعيل الظهور' : 'إيقاف الظهور'}</button>
                        <button type="button" class="hsa-btn hsa-btn-danger" data-action="sa-remove" data-id="${esc(r.id)}" title="حذف من محرك البحث دون حذف المصدر">حذف من البحث</button>
                      </td>
                    </tr>`;
                  })
                  .join('')
              : `<tr><td colspan="9" class="hsa-empty">${
                  (cat()?.list?.() || []).length
                    ? 'لا توجد نتائج مطابقة للفلاتر المحددة.'
                    : 'لا يوجد محتوى مضاف إلى محرك البحث حتى الآن.'
                }</td></tr>`
          }</tbody>
        </table></div>
        ${
          pages > 1
            ? `<div class="hsa-pager">
                <button type="button" class="hsa-btn" data-action="sa-page" data-page="${ui.page - 1}" ${ui.page <= 1 ? 'disabled' : ''} title="السابق">السابق</button>
                <span>${ui.page} / ${pages}</span>
                <button type="button" class="hsa-btn" data-action="sa-page" data-page="${ui.page + 1}" ${ui.page >= pages ? 'disabled' : ''} title="التالي">التالي</button>
              </div>`
            : ''
        }
      </section>`;
  };

  const renderAddWizard = () => {
    const typeMeta = ADDABLE_TYPES.find((t) => t.id === ui.addType);
    const candidates = ui.addType && typeMeta?.mode === 'pick' ? sourceCandidates(ui.addType) : [];
    const pick = candidates.find((c) => String(c.id) === String(ui.addPickId));
    const steps = [
      'اختيار نوع المحتوى',
      'اختيار المحتوى أو إدخال الرابط',
      'بيانات الظهور في البحث',
      'المراجعة',
      'إضافة وفهرسة',
    ];

    let stepBody = '';
    if (ui.addStep === 1) {
      stepBody = `
        <p class="hsa-lead">ماذا تريد أن تضيف إلى محرك البحث؟</p>
        <div class="hsa-type-grid">
          ${ADDABLE_TYPES.map(
            (t) => `<button type="button" class="hsa-type-card ${ui.addType === t.id ? 'is-on' : ''}" data-action="sa-add-type" data-type="${t.id}" title="${esc(t.label)}">
              <i class="fas ${t.icon}"></i><strong>${esc(t.label)}</strong>
            </button>`
          ).join('')}
        </div>`;
    } else if (ui.addStep === 2 && typeMeta?.mode === 'pick') {
      stepBody = `
        <p class="hsa-lead">اختر ${esc(typeMeta.label)} موجودًا في النظام — بدون إعادة كتابة البيانات.</p>
        <div class="hsa-table-wrap"><table class="hsa-table">
          <thead><tr><th>العنوان</th><th>المصدر</th><th>الحالة</th><th></th></tr></thead>
          <tbody>${
            candidates.length
              ? candidates
                  .slice(0, 60)
                  .map((c) => {
                    const inIdx = alreadyIndexed(c.sourceType, c.id);
                    return `<tr>
                      <td><strong>${esc(c.title)}</strong><div class="hsa-muted">${esc((c.description || '').slice(0, 80))}</div></td>
                      <td>${esc(c.sourceLabel)}</td>
                      <td>${inIdx ? badge('موجود في الفهرس') : badge('غير مفهرس', 'is-ok')}</td>
                      <td><button type="button" class="hsa-btn ${ui.addPickId === String(c.id) ? 'hsa-btn-primary' : ''}" data-action="sa-add-pick" data-id="${esc(c.id)}" title="اختيار">اختيار</button></td>
                    </tr>`;
                  })
                  .join('')
              : `<tr><td colspan="4" class="hsa-empty">لا عناصر متاحة من هذا المصدر حاليًا.</td></tr>`
          }</tbody>
        </table></div>
        ${
          pick
            ? `<div class="hsa-summary"><p><strong>المحدد:</strong> ${esc(pick.title)}</p><p>${esc(pick.description || '')}</p><p class="hsa-muted">${esc(pick.href)}</p></div>`
            : ''
        }`;
    } else if (ui.addStep === 2 && typeMeta?.mode === 'form') {
      stepBody = `
        <p class="hsa-lead">${ui.addType === 'link' ? 'أدخل بيانات الرابط الخارجي.' : 'أدخل بيانات الصفحة.'}</p>
        <div class="hsa-form-grid">
          <label>اسم ${ui.addType === 'link' ? 'المصدر' : 'الصفحة'}
            <input id="hsa-f-title" type="text" value="${esc(ui.addForm.title)}" required />
          </label>
          <label>الرابط
            <input id="hsa-f-href" type="url" value="${esc(ui.addForm.href)}" placeholder="https://..." required />
          </label>
        </div>`;
    } else if (ui.addStep === 3) {
      const base = pick || ui.addForm;
      stepBody = `
        <p class="hsa-lead">حدّد كيف يظهر العنصر في نتائج البحث.</p>
        <div class="hsa-form-grid">
          <label>عنوان نتيجة البحث
            <input id="hsa-f-title" type="text" value="${esc(ui.addForm.title || base.title || '')}" />
          </label>
          <label>الوصف المختصر
            <textarea id="hsa-f-desc" rows="3">${esc(ui.addForm.description || base.description || '')}</textarea>
          </label>
          <label>الكلمات المفتاحية
            <input id="hsa-f-kw" type="text" value="${esc(ui.addForm.keywords || base.keywords || '')}" />
          </label>
          <label>التصنيف
            <input id="hsa-f-cat" type="text" value="${esc(ui.addForm.category || base.category || typeMeta?.label || '')}" />
          </label>
          <label>الرابط
            <input id="hsa-f-href" type="text" value="${esc(ui.addForm.href || base.href || '')}" />
          </label>
          <label class="hsa-check">
            <input type="checkbox" id="hsa-f-visible" ${ui.addForm.searchVisible !== false ? 'checked' : ''} />
            يظهر في محرك بحث نايوش فور الإضافة
          </label>
        </div>`;
    } else if (ui.addStep === 4 || ui.addStep === 5) {
      const title = ui.addForm.title || pick?.title || '';
      const desc = ui.addForm.description || pick?.description || '';
      const href = ui.addForm.href || pick?.href || '';
      stepBody = `
        <p class="hsa-lead">راجع البيانات قبل الإضافة والفهرسة.</p>
        <article class="hsa-preview-hit">
          <div>
            <strong>${esc(title)}</strong>
            <p>${esc(desc)}</p>
            <small>${esc(typeMeta?.label || '')} · ${esc(pick?.sourceLabel || typeMeta?.label || '')}</small>
            <div class="hsa-muted">${esc(href)}</div>
            <p>الظهور: <strong>${ui.addForm.searchVisible === false ? 'متوقف' : 'نشط'}</strong></p>
          </div>
        </article>
        ${ui.lastMessage ? `<p class="hsa-success">${esc(ui.lastMessage)}</p>` : ''}`;
    }

    return `
      <section class="hsa-panel">
        <h3>إضافة محتوى إلى محرك بحث نايوش</h3>
        <ol class="hsa-steps">${steps
          .map(
            (s, i) =>
              `<li class="${ui.addStep === i + 1 ? 'is-on' : ui.addStep > i + 1 ? 'is-done' : ''}"><span>${i + 1}</span>${esc(s)}</li>`
          )
          .join('')}</ol>
        ${stepBody}
        <div class="hsa-wizard-actions">
          ${ui.addStep > 1 && ui.addStep < 5 ? `<button type="button" class="hsa-btn" data-action="sa-add-back" title="رجوع">رجوع</button>` : ''}
          ${
            ui.addStep < 4
              ? `<button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-add-next" title="التالي">التالي</button>`
              : ''
          }
          ${
            ui.addStep === 4
              ? `<button type="button" class="hsa-btn" data-action="sa-preview-draft" title="معاينة نتيجة البحث">معاينة نتيجة البحث</button>
                 <button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-add-confirm" title="إضافة وفهرسة">إضافة وفهرسة</button>`
              : ''
          }
          ${
            ui.addStep === 5
              ? `<button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-tab" data-tab="indexed" title="عرض المحتوى المفهرس">عرض المحتوى المفهرس</button>
                 <button type="button" class="hsa-btn" data-action="sa-add-reset" title="إضافة محتوى آخر">إضافة محتوى آخر</button>
                 <a class="hsa-btn" href="search.html?q=${encodeURIComponent(ui.addForm.title || '')}" target="_blank" rel="noopener" title="فتح محرك بحث نايوش">فتح محرك بحث نايوش</a>`
              : ''
          }
        </div>
      </section>`;
  };

  const renderSources = () => {
    const sources = searchSources();
    const eng = engine();
    return `
      <section class="hsa-panel">
        <div class="hsa-engine-card hsa-engine-card--compact">
          <div>
            <p class="hsa-kicker">محرك البحث</p>
            <h3>${esc(eng.nameAr)}</h3>
            <p class="hsa-muted">محدد تلقائيًا — النظام يدعم محركًا واحدًا فقط حاليًا.</p>
          </div>
        </div>
        <h3>مصادر البحث</h3>
        <p class="hsa-lead">المصادر هي أماكن البيانات التي يمكن فهرستها في محرك بحث نايوش.</p>
        <div class="hsa-table-wrap"><table class="hsa-table">
          <thead><tr>
            <th>اسم المصدر</th><th>النوع</th><th>عناصر متاحة</th><th>مفهرس</th><th>حالة المصدر</th><th>آخر فهرسة</th><th>الإجراءات</th>
          </tr></thead>
          <tbody>${
            sources.length
              ? sources
                  .map(
                    (s) => `<tr>
                      <td><strong>${esc(s.name)}</strong></td>
                      <td>${esc(s.kind)}</td>
                      <td>${s.available}</td>
                      <td>${s.inIndex}</td>
                      <td>${badge(s.status, s.status === 'نشط' ? 'is-ok' : '')}</td>
                      <td>${esc(fmt(s.lastSync))}</td>
                      <td class="hsa-actions">
                        <button type="button" class="hsa-btn" data-action="sa-source-view" data-source="${esc(s.id)}" title="عرض المحتوى المفهرس من هذا المصدر">عرض</button>
                        <button type="button" class="hsa-btn" data-action="sa-source-manage" data-source="${esc(s.id)}" title="إدارة / إضافة من هذا المصدر">إدارة</button>
                        <button type="button" class="hsa-btn" data-action="sa-source-sync" data-source="${esc(s.id)}" title="مزامنة الآن">مزامنة الآن</button>
                        <button type="button" class="hsa-btn" data-action="sa-source-reindex" data-source="${esc(s.id)}" title="إعادة الفهرسة">إعادة الفهرسة</button>
                      </td>
                    </tr>`
                  )
                  .join('')
              : `<tr><td colspan="7" class="hsa-empty">لم يتم ربط أي مصادر بحث حتى الآن.</td></tr>`
          }</tbody>
        </table></div>
      </section>`;
  };

  const renderSettings = () => {
    const s = cat()?.defaultSettings?.() || {};
    return `<section class="hsa-panel">
      <h3>إعدادات البحث</h3>
      <p class="hsa-lead">عند نشر محتوى معتمد يمكن إضافته تلقائيًا إلى نفس فهرس محرك بحث نايوش.</p>
      <div class="hsa-engine-card hsa-engine-card--compact">
        <div>
          <p class="hsa-kicker">محرك البحث المستخدم</p>
          <h3>${esc(engine().nameAr)}</h3>
        </div>
      </div>
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
      <button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-save-settings" title="حفظ الإعدادات">حفظ الإعدادات</button>
    </section>`;
  };

  const renderAudit = () => {
    const rows = cat()?.readAudit?.() || [];
    return `<section class="hsa-panel">
      <h3>سجل الفهرسة</h3>
      <p class="hsa-lead">سجل إداري لكل عمليات الإضافة والتعديل والإيقاف وإعادة الفهرسة.</p>
      <div class="hsa-table-wrap"><table class="hsa-table">
        <thead><tr><th>العملية</th><th>العنصر</th><th>من قام بالعملية</th><th>التاريخ والوقت</th><th>النتيجة</th><th>التفاصيل</th></tr></thead>
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
                    <td>${esc(a.detail || a.reason || '—')}</td>
                  </tr>`
                )
                .join('')
            : `<tr><td colspan="6" class="hsa-empty">لا عمليات مسجّلة بعد.</td></tr>`
        }</tbody>
      </table></div>
    </section>`;
  };

  const render = () => {
    const st = cat()?.stats?.() || { total: 0, published: 0, pending: 0, failed: 0, hidden: 0, sources: 0 };
    const tabs = [
      ['overview', 'نظرة عامة'],
      ['indexed', 'المحتوى المفهرس'],
      ['add', 'إضافة محتوى'],
      ['sources', 'مصادر البحث'],
      ['settings', 'إعدادات البحث'],
      ['audit', 'سجل الفهرسة'],
    ];
    let body = '';
    if (ui.tab === 'overview') body = renderOverview();
    else if (ui.tab === 'indexed') body = renderIndexed();
    else if (ui.tab === 'add') body = renderAddWizard();
    else if (ui.tab === 'sources') body = renderSources();
    else if (ui.tab === 'settings') body = renderSettings();
    else body = renderAudit();

    return `
      <div class="hsa-root" data-hsa-root>
        <header class="hsa-hero">
          <div>
            <h2>إدارة محرك البحث</h2>
            <p>من هنا يمكنك تحديد وإدارة المحتوى الذي يظهر في محرك بحث نايوش، وإضافة مصادر البحث ومتابعة حالة الفهرسة.</p>
          </div>
          <div class="hsa-hero-actions">
            <button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-tab" data-tab="add" title="إضافة محتوى">+ إضافة محتوى</button>
            <a class="hsa-btn" href="search.html" target="_blank" rel="noopener" title="فتح محرك بحث نايوش">فتح محرك بحث نايوش</a>
          </div>
        </header>
        ${ui.tab !== 'overview' ? renderStats(st) : ''}
        <nav class="hsa-tabs" aria-label="أقسام إدارة محرك البحث">${tabs
          .map(
            ([id, label]) =>
              `<button type="button" class="hsa-tab ${ui.tab === id ? 'is-on' : ''}" data-action="sa-tab" data-tab="${id}" title="${esc(label)}">${esc(label)}</button>`
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
    const category = document.getElementById('hsa-f-cat')?.value?.trim();
    const visibleEl = document.getElementById('hsa-f-visible');
    if (title !== undefined && document.getElementById('hsa-f-title')) ui.addForm.title = title;
    if (href !== undefined && document.getElementById('hsa-f-href')) ui.addForm.href = href;
    if (description !== undefined && document.getElementById('hsa-f-desc')) ui.addForm.description = description;
    if (keywords !== undefined && document.getElementById('hsa-f-kw')) ui.addForm.keywords = keywords;
    if (category !== undefined && document.getElementById('hsa-f-cat')) ui.addForm.category = category;
    if (visibleEl) ui.addForm.searchVisible = !!visibleEl.checked;
  };

  const placeOpenMenu = () => {
    document.querySelectorAll('.hsa-float-menu').forEach((el) => el.remove());
  };

  const afterPaint = (ctx = {}) => {
    window.__hubSaCtx = ctx;
    window.__hubSaRerender = ctx.rerender;
    requestAnimationFrame(() => placeOpenMenu());
  };

  const clearFloatMenus = () => {
    document.querySelectorAll('.hsa-float-menu').forEach((el) => el.remove());
  };

  const syncSource = async (sourceId, actor, toast) => {
    const typeMeta = ADDABLE_TYPES.find((t) => t.id === sourceId);
    if (!typeMeta || typeMeta.mode !== 'pick') {
      toast?.('هذا المصدر يُدار يدويًا عبر إضافة صفحة أو رابط');
      return 0;
    }
    const list = sourceCandidates(sourceId);
    let n = 0;
    list.forEach((pick) => {
      cat()?.upsertFromSource?.(
        {
          id: `${pick.sourceType}-${pick.id}`,
          sourceType: pick.sourceType,
          sourceId: pick.id,
          sourceLabel: pick.sourceLabel,
          section: pick.section || typeMeta.section,
          kind: 'content',
          title: pick.title,
          description: pick.description,
          keywords: pick.keywords,
          href: pick.href,
          category: pick.category || pick.sourceLabel,
          status: 'published',
          searchVisible: true,
          indexStatus: 'indexed',
        },
        actor
      );
      n += 1;
    });
    if (n) {
      try {
        await cat()?.pushRemote?.();
      } catch (_) {}
    }
    return n;
  };

  const handle = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const actor = user?.name || user?.email || 'مشغّل هوب';
    if (action !== 'sa-menu') {
      ui.openMenu = null;
      clearFloatMenus();
    }

    if (action === 'sa-tab') {
      ui.tab = btn.dataset.tab || 'overview';
      if (ui.tab === 'add' && ui.addStep === 5) {
        /* keep success step */
      } else if (ui.tab === 'add') {
        ui.lastMessage = '';
      }
      return true;
    }
    if (action === 'sa-stat') {
      const f = btn.dataset.filter || '';
      ui.tab = 'indexed';
      ui.filters = { section: '', source: '', status: '', visible: '' };
      ui.q = '';
      ui.page = 1;
      if (f.startsWith('status:')) ui.filters.status = f.slice(7);
      if (f.startsWith('visible:')) ui.filters.visible = f.slice(8);
      return true;
    }
    if (action === 'sa-apply') {
      ui.q = document.getElementById('hsa-q')?.value || '';
      ui.filters.section = document.getElementById('hsa-f-section')?.value || '';
      ui.filters.source = document.getElementById('hsa-f-source')?.value || '';
      ui.filters.status = document.getElementById('hsa-f-status')?.value || '';
      ui.filters.visible = document.getElementById('hsa-f-visible')?.value || '';
      ui.page = 1;
      return true;
    }
    if (action === 'sa-clear') {
      ui.q = '';
      ui.filters = { section: '', source: '', status: '', visible: '' };
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
    if (action === 'sa-preview-draft') {
      readAddFormFromDom();
      ui.previewId = 'draft';
      return true;
    }
    if (action === 'sa-toggle-visible') {
      const row = cat()?.get?.(btn.dataset.id);
      if (!row) return true;
      const nextVisible = row.searchVisible === false;
      cat()?.setSearchVisible?.(btn.dataset.id, nextVisible, actor);
      try {
        cat()?.pushRemote?.();
      } catch (_) {}
      toast?.(nextVisible ? 'تم تفعيل الظهور في محرك البحث' : 'تم إيقاف الظهور في محرك البحث');
      return true;
    }
    if (action === 'sa-reindex') {
      const row = cat()?.get?.(btn.dataset.id);
      if (row?.indexStatus === 'failed') {
        cat()?.upsert?.({ ...row, indexStatus: 'indexed', indexError: '', indexedAt: new Date().toISOString(), actor });
        toast?.('تمت إعادة المحاولة والفهرسة');
      } else {
        cat()?.reindex?.(btn.dataset.id, actor);
        toast?.('تمت إعادة الفهرسة');
      }
      return true;
    }
    if (action === 'sa-remove') {
      if (!confirm('حذف هذا العنصر من محرك البحث فقط؟\nلن يُحذف المصدر الأصلي من النظام.')) return true;
      cat()?.removeFromIndex?.(btn.dataset.id, actor);
      if (ui.selectedId === btn.dataset.id) ui.selectedId = null;
      toast?.('أُزيل من محرك البحث — المصدر الأصلي لم يُحذف');
      return true;
    }
    if (action === 'sa-add-type') {
      ui.addType = btn.dataset.type || '';
      ui.addPickId = '';
      ui.addForm = { title: '', href: '', description: '', keywords: '', category: '', searchVisible: true };
      ui.addStep = 2;
      ui.lastMessage = '';
      return true;
    }
    if (action === 'sa-add-pick') {
      ui.addPickId = btn.dataset.id;
      const pick = sourceCandidates(ui.addType).find((c) => String(c.id) === String(ui.addPickId));
      if (pick) {
        ui.addForm = {
          title: pick.title,
          href: pick.href,
          description: pick.description || '',
          keywords: pick.keywords || '',
          category: pick.category || pick.sourceLabel || '',
          searchVisible: true,
        };
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
        toast?.('اختر نوع المحتوى أولاً');
        return true;
      }
      if (ui.addStep === 2) {
        if (typeMeta?.mode === 'pick' && !ui.addPickId) {
          toast?.('اختر عنصرًا من القائمة');
          return true;
        }
        if (typeMeta?.mode === 'form') {
          if (!ui.addForm.title || !ui.addForm.href) {
            toast?.('الاسم والرابط مطلوبان');
            return true;
          }
        }
      }
      if (ui.addStep === 3 && !ui.addForm.title) {
        toast?.('عنوان نتيجة البحث مطلوب');
        return true;
      }
      ui.addStep = Math.min(4, ui.addStep + 1);
      return true;
    }
    if (action === 'sa-add-reset') {
      ui.addStep = 1;
      ui.addType = '';
      ui.addPickId = '';
      ui.addForm = { title: '', href: '', description: '', keywords: '', category: '', searchVisible: true };
      ui.lastMessage = '';
      ui.tab = 'add';
      return true;
    }
    if (action === 'sa-add-confirm') {
      readAddFormFromDom();
      const typeMeta = ADDABLE_TYPES.find((t) => t.id === ui.addType);
      const pick =
        typeMeta?.mode === 'pick'
          ? sourceCandidates(ui.addType).find((c) => String(c.id) === String(ui.addPickId))
          : null;
      const title = ui.addForm.title || pick?.title;
      if (!title) {
        toast?.('العنوان مطلوب');
        return true;
      }
      const payload = {
        id: pick ? `${pick.sourceType}-${pick.id}` : undefined,
        sourceType: pick?.sourceType || ui.addType,
        sourceId: pick?.id || '',
        sourceLabel: pick?.sourceLabel || typeMeta?.label || 'مخصص',
        section: typeMeta?.section || 'content',
        kind: 'content',
        title,
        description: ui.addForm.description || pick?.description || '',
        keywords: ui.addForm.keywords || pick?.keywords || title,
        href: ui.addForm.href || pick?.href || '',
        category: ui.addForm.category || pick?.category || typeMeta?.label || '',
        status: 'published',
        searchVisible: ui.addForm.searchVisible !== false,
        indexStatus: 'indexed',
      };
      const res = pick
        ? cat()?.upsertFromSource?.(payload, actor)
        : cat()?.upsert?.({ ...payload, actor });
      if (!res?.ok && res?.error) {
        toast?.(res.error);
        return true;
      }
      try {
        cat()?.pushRemote?.();
      } catch (_) {}
      ui.lastMessage =
        payload.searchVisible === false
          ? 'تمت إضافة المحتوى وهو متوقف عن الظهور — يمكنك تفعيله لاحقًا.'
          : 'تمت إضافة المحتوى إلى محرك بحث نايوش بنجاح.';
      ui.addStep = 5;
      toast?.(ui.lastMessage);
      return true;
    }
    if (action === 'sa-source-view') {
      ui.tab = 'indexed';
      ui.filters = { section: '', source: btn.dataset.source || '', status: '', visible: '' };
      // map source id to sourceLabel where needed
      const src = searchSources().find((s) => s.id === btn.dataset.source);
      if (src) ui.filters.source = src.name;
      ui.page = 1;
      return true;
    }
    if (action === 'sa-source-manage') {
      ui.tab = 'add';
      ui.addStep = 2;
      ui.addType = btn.dataset.source || '';
      ui.addPickId = '';
      ui.lastMessage = '';
      return true;
    }
    if (action === 'sa-source-sync') {
      Promise.resolve(syncSource(btn.dataset.source, actor, toast)).then((n) => {
        toast?.(n ? `تمت مزامنة ${n} عنصرًا إلى محرك البحث` : 'لا عناصر للمزامنة');
        if (typeof window.__hubSaRerender === 'function') window.__hubSaRerender();
      });
      return true;
    }
    if (action === 'sa-source-reindex') {
      const sourceId = btn.dataset.source;
      const rows = (cat()?.list?.() || []).filter((r) => r.sourceType === sourceId);
      rows.forEach((r) => cat()?.reindex?.(r.id, actor));
      toast?.(rows.length ? `أُعيدت فهرسة ${rows.length} عنصرًا` : 'لا عناصر مفهرسة لهذا المصدر');
      return true;
    }
    if (action === 'sa-save-settings') {
      const next = { ...(cat()?.defaultSettings?.() || {}) };
      document.querySelectorAll('[data-sa-setting]').forEach((el) => {
        next[el.getAttribute('data-sa-setting')] = !!el.checked;
      });
      cat()?.saveSettings?.(next);
      toast?.('تم حفظ إعدادات البحث');
      return true;
    }
    return false;
  };

  window.HubSearchAdminWS = { render, handle, afterPaint, ui, sourceCandidates, searchSources, ADDABLE_TYPES };
})();
