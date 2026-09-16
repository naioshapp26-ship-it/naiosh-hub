/**
 * إدارة محرك بحث نايوش — لوحة مدمجة في dashboard.html#search-admin
 * تعتمد على HubSearchCatalog + HubUniversalSearch (نفس الفهرس العام)
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
    tab: 'indexed',
    q: '',
    filters: { section: '', status: '', visible: '' },
    page: 1,
    pageSize: 20,
    selectedId: null,
    openMenu: null,
    testQ: '',
    testResults: null,
    addSource: '',
    addPickId: '',
    previewId: null,
  };

  const cat = () => window.HubSearchCatalog;
  const searchApi = () => window.HubUniversalSearch;

  const fmt = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return String(iso);
    }
  };

  const STATUS_AR = {
    published: 'منشور',
    draft: 'مسودة',
    hidden: 'مخفي',
    indexed: 'تمت الفهرسة',
    pending: 'بانتظار الفهرسة',
    failed: 'فشل في الفهرسة',
  };

  const badge = (t, cls = '') => `<span class="hsa-badge ${cls}">${esc(t)}</span>`;

  const filteredRows = () => {
    let rows = cat()?.list?.() || [];
    if (ui.filters.section) rows = rows.filter((r) => r.section === ui.filters.section);
    if (ui.filters.status === 'failed') rows = rows.filter((r) => r.indexStatus === 'failed');
    if (ui.filters.status === 'pending') rows = rows.filter((r) => r.indexStatus === 'pending');
    if (ui.filters.status === 'indexed') rows = rows.filter((r) => r.indexStatus === 'indexed' || !r.indexStatus);
    if (ui.filters.visible === '1') rows = rows.filter((r) => r.searchVisible !== false);
    if (ui.filters.visible === '0') rows = rows.filter((r) => r.searchVisible === false);
    const q = String(ui.q || '').trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        [r.title, r.description, r.keywords, r.href, r.sourceLabel].join(' ').toLowerCase().includes(q)
      );
    }
    return rows;
  };

  const sourceCandidates = () => {
    const out = [];
    try {
      (window.HubArticles?.list?.() || window.HubArticles?.all?.() || []).forEach((a) => {
        if (String(a.status).toLowerCase() === 'published' || a.status === 'Published') {
          out.push({
            id: a.id,
            title: a.title,
            description: a.summary || a.excerpt || '',
            href: `blog.html#${encodeURIComponent(a.id)}`,
            keywords: a.title,
            sourceType: 'article',
            sourceLabel: 'المقالات',
            section: 'content',
          });
        }
      });
    } catch (_) {}
    try {
      (window.HubInfoCenterPages?.list?.() || []).forEach((p) => {
        out.push({
          id: p.id || p.slug,
          title: p.titleAr || p.title,
          description: p.summary || '',
          href: p.href || `info-center.html#${p.id || p.slug}`,
          keywords: p.titleAr || p.title,
          sourceType: 'info',
          sourceLabel: 'مركز معلومات نايوش هوب',
          section: 'content',
        });
      });
    } catch (_) {}
    try {
      (window.HubServicesCatalog?.list?.() || []).forEach((s) => {
        out.push({
          id: s.id || s.code,
          title: s.nameAr || s.title,
          description: s.descriptionAr || s.description || '',
          href: s.href || `services.html#${s.id || s.code}`,
          keywords: s.nameAr || s.title,
          sourceType: 'service',
          sourceLabel: 'الخدمات',
          section: 'content',
        });
      });
    } catch (_) {}
    return out;
  };

  const renderDrawer = () => {
    if (!ui.selectedId) return '';
    const row = cat()?.get?.(ui.selectedId);
    if (!row) return '';
    return `
      <div class="hsa-drawer-backdrop" data-action="sa-drawer-close"></div>
      <aside class="hsa-drawer" role="dialog">
        <header class="hsa-drawer-head">
          <h3>تفاصيل نتيجة البحث</h3>
          <button type="button" class="hsa-btn" data-action="sa-drawer-close">إغلاق</button>
        </header>
        <div class="hsa-drawer-body">
          <p><strong>العنوان:</strong> ${esc(row.title)}</p>
          <p><strong>نوع المحتوى:</strong> ${esc(cat()?.SECTION_META?.[row.section]?.typeAr || row.kind)}</p>
          <p><strong>المصدر:</strong> ${esc(row.sourceLabel || row.sourceType || '—')}</p>
          <p><strong>الرابط الأصلي:</strong> <a href="${esc(row.href || cat().viewUrl(row.id))}" target="_blank" rel="noopener">${esc(row.href || cat().viewUrl(row.id))}</a></p>
          <p><strong>الوصف:</strong> ${esc(row.description || '—')}</p>
          <p><strong>الكلمات المفتاحية:</strong> ${esc(row.keywords || '—')}</p>
          <p><strong>التصنيف:</strong> ${esc(row.category || '—')}</p>
          <p><strong>حالة المصدر:</strong> ${badge(STATUS_AR[row.status] || row.status)}</p>
          <p><strong>حالة الفهرسة:</strong> ${badge(STATUS_AR[row.indexStatus] || 'تمت الفهرسة', row.indexStatus === 'failed' ? 'is-bad' : 'is-ok')}</p>
          <p><strong>يظهر في البحث؟</strong> ${row.searchVisible === false ? 'لا' : 'نعم'}</p>
          <p><strong>أول فهرسة:</strong> ${esc(fmt(row.firstIndexedAt))}</p>
          <p><strong>آخر فهرسة:</strong> ${esc(fmt(row.indexedAt))}</p>
        </div>
        <div class="hsa-drawer-actions">
          <a class="hsa-btn" href="${esc(row.href || cat().viewUrl(row.id))}" target="_blank" rel="noopener">فتح المصدر</a>
          <button type="button" class="hsa-btn" data-action="sa-preview" data-id="${esc(row.id)}">معاينة نتيجة البحث</button>
          <button type="button" class="hsa-btn" data-action="sa-reindex" data-id="${esc(row.id)}">إعادة الفهرسة</button>
          <button type="button" class="hsa-btn" data-action="sa-toggle-visible" data-id="${esc(row.id)}">${row.searchVisible === false ? 'إظهار في البحث' : 'إخفاء من البحث'}</button>
        </div>
      </aside>`;
  };

  const renderPreview = () => {
    if (!ui.previewId) return '';
    const row = cat()?.get?.(ui.previewId);
    if (!row) return '';
    return `<div class="hsa-modal"><div class="hsa-modal-card">
      <header><h3>معاينة نتيجة البحث</h3><button type="button" class="hsa-btn" data-action="sa-preview-close">إغلاق</button></header>
      <article class="hsa-preview-hit">
        ${row.mediaUrl || row.mediaDataUrl ? `<img src="${esc(row.mediaUrl || row.mediaDataUrl)}" alt="" />` : ''}
        <div>
          <strong>${esc(row.title)}</strong>
          <p>${esc(row.description || '')}</p>
          <small>${esc(cat()?.SECTION_META?.[row.section]?.typeAr || 'محتوى')} · ${esc(row.sourceLabel || '')}</small>
          <div class="hsa-muted">${esc(row.href || cat().viewUrl(row.id))}</div>
        </div>
      </article>
    </div></div>`;
  };

  const renderIndexed = () => {
    const rows = filteredRows();
    const pages = Math.max(1, Math.ceil(rows.length / ui.pageSize) || 1);
    ui.page = Math.min(ui.page, pages);
    const start = (ui.page - 1) * ui.pageSize;
    const pageRows = rows.slice(start, start + ui.pageSize);
    return `
      <div class="hsa-toolbar">
        <input type="search" id="hsa-q" value="${esc(ui.q)}" placeholder="ابحث بعنوان أو كلمة مفتاحية أو رابط" />
        <select id="hsa-f-section">
          <option value="">نوع المحتوى</option>
          ${Object.entries(cat()?.SECTION_META || {}).map(([k, v]) => `<option value="${k}" ${ui.filters.section === k ? 'selected' : ''}>${esc(v.typeAr)}</option>`).join('')}
        </select>
        <select id="hsa-f-status">
          <option value="">حالة الفهرسة</option>
          <option value="indexed" ${ui.filters.status === 'indexed' ? 'selected' : ''}>تمت الفهرسة</option>
          <option value="pending" ${ui.filters.status === 'pending' ? 'selected' : ''}>بانتظار</option>
          <option value="failed" ${ui.filters.status === 'failed' ? 'selected' : ''}>فشل</option>
        </select>
        <select id="hsa-f-visible">
          <option value="">حالة الظهور</option>
          <option value="1" ${ui.filters.visible === '1' ? 'selected' : ''}>ظاهر</option>
          <option value="0" ${ui.filters.visible === '0' ? 'selected' : ''}>مخفي</option>
        </select>
        <button type="button" class="hsa-btn" data-action="sa-apply">تطبيق</button>
        <button type="button" class="hsa-btn" data-action="sa-clear">مسح</button>
      </div>
      <div class="hsa-table-wrap"><table class="hsa-table">
        <thead><tr>
          <th>العنوان</th><th>نوع المحتوى</th><th>المصدر</th><th>التصنيف</th><th>حالة النشر</th><th>حالة الفهرسة</th><th>آخر فهرسة</th><th>الظهور</th><th>الإجراءات</th>
        </tr></thead>
        <tbody>
          ${
            pageRows.length
              ? pageRows
                  .map((r) => {
                    const open = ui.openMenu === r.id;
                    return `<tr>
                      <td><strong class="hsa-ellipsis" title="${esc(r.title)}">${esc(r.title)}</strong></td>
                      <td>${esc(cat()?.SECTION_META?.[r.section]?.typeAr || r.kind)}</td>
                      <td class="hsa-ellipsis">${esc(r.sourceLabel || '—')}</td>
                      <td>${esc(r.category || '—')}</td>
                      <td>${badge(STATUS_AR[r.status] || r.status)}</td>
                      <td>${badge(STATUS_AR[r.indexStatus] || 'تمت الفهرسة', r.indexStatus === 'failed' ? 'is-bad' : 'is-ok')}</td>
                      <td class="hsa-nowrap">${esc(fmt(r.indexedAt || r.updatedAt))}</td>
                      <td>${r.searchVisible === false ? badge('مخفي', 'is-bad') : badge('ظاهر', 'is-ok')}</td>
                      <td><div class="hsa-actions">
                        <button type="button" class="hsa-btn" data-action="sa-view" data-id="${esc(r.id)}">عرض</button>
                        <button type="button" class="hsa-btn" data-action="sa-toggle-visible" data-id="${esc(r.id)}">إعدادات</button>
                        <div class="hsa-more ${open ? 'is-open' : ''}">
                          <button type="button" class="hsa-btn" data-action="sa-menu" data-id="${esc(r.id)}">⋮</button>
                          <div class="hsa-more-menu">
                            <button type="button" data-action="sa-reindex" data-id="${esc(r.id)}">إعادة الفهرسة</button>
                            <button type="button" data-action="sa-toggle-visible" data-id="${esc(r.id)}">${r.searchVisible === false ? 'إظهار في البحث' : 'إخفاء من البحث'}</button>
                            <a href="${esc(r.href || cat().viewUrl(r.id))}" target="_blank" rel="noopener">فتح المصدر الأصلي</a>
                            <button type="button" class="is-danger" data-action="sa-remove" data-id="${esc(r.id)}">إزالة من الفهرس</button>
                          </div>
                        </div>
                      </div></td>
                    </tr>`;
                  })
                  .join('')
              : `<tr><td colspan="9" class="hsa-empty">لا عناصر مفهرسة بعد — أضف محتوى أو فعّل الفهرسة التلقائية.</td></tr>`
          }
        </tbody>
      </table></div>
      <div class="hsa-pager">
        <span>عرض ${rows.length ? start + 1 : 0}–${Math.min(start + ui.pageSize, rows.length)} من ${rows.length}</span>
        <div>
          <button type="button" class="hsa-btn" data-action="sa-page" data-page="${ui.page - 1}" ${ui.page <= 1 ? 'disabled' : ''}>السابق</button>
          <button type="button" class="hsa-btn" data-action="sa-page" data-page="${ui.page + 1}" ${ui.page >= pages ? 'disabled' : ''}>التالي</button>
        </div>
      </div>`;
  };

  const renderIssues = () => {
    const rows = (cat()?.list?.() || []).filter(
      (r) => r.indexStatus === 'failed' || !r.href || r.indexStatus === 'pending'
    );
    return `<div class="hsa-table-wrap"><table class="hsa-table">
      <thead><tr><th>المشكلة</th><th>المصدر</th><th>السبب</th><th>آخر محاولة</th><th>الإجراء</th></tr></thead>
      <tbody>${
        rows.length
          ? rows
              .map(
                (r) => `<tr>
                  <td>${esc(r.title)}</td>
                  <td>${esc(r.sourceLabel || '—')}</td>
                  <td>${esc(r.indexError || (!r.href ? 'رابط غير صالح' : r.indexStatus === 'pending' ? 'بانتظار الفهرسة' : 'فشل فهرسة'))}</td>
                  <td>${esc(fmt(r.indexedAt || r.updatedAt))}</td>
                  <td class="hsa-actions">
                    <button type="button" class="hsa-btn" data-action="sa-reindex" data-id="${esc(r.id)}">إعادة المحاولة</button>
                    <a class="hsa-btn" href="${esc(r.href || '#')}" target="_blank" rel="noopener">فتح المصدر</a>
                    <button type="button" class="hsa-btn" data-action="sa-toggle-visible" data-id="${esc(r.id)}">إخفاء</button>
                  </td>
                </tr>`
              )
              .join('')
          : `<tr><td colspan="5" class="hsa-empty">لا مشاكل فهرسة حالياً.</td></tr>`
      }</tbody>
    </table></div>`;
  };

  const renderAudit = () => {
    const rows = cat()?.readAudit?.() || [];
    return `<div class="hsa-table-wrap"><table class="hsa-table">
      <thead><tr><th>التاريخ</th><th>المنفّذ</th><th>العنصر</th><th>الإجراء</th><th>النتيجة</th></tr></thead>
      <tbody>${
        rows.length
          ? rows
              .map(
                (a) => `<tr>
                  <td>${esc(fmt(a.at))}</td>
                  <td>${esc(a.by || '—')}</td>
                  <td>${esc(a.title || a.itemId || '—')}</td>
                  <td>${esc(a.action || '—')}</td>
                  <td>${esc(a.result || '—')}</td>
                </tr>`
              )
              .join('')
          : `<tr><td colspan="5" class="hsa-empty">لا عمليات مسجّلة بعد.</td></tr>`
      }</tbody>
    </table></div>`;
  };

  const renderAnalytics = () => {
    const empty = (cat()?.readEmptyQueries?.() || []).filter((x) => !x.ignored);
    return `
      <section class="hsa-panel">
        <h3>عمليات بحث بدون نتائج</h3>
        <p class="hsa-lead">تظهر هنا عبارات بحثها العملاء ولم يجدوا نتيجة — بدون بيانات شخصية.</p>
        <div class="hsa-table-wrap"><table class="hsa-table">
          <thead><tr><th>عبارة البحث</th><th>عدد المرات</th><th>آخر بحث</th><th>الإجراء</th></tr></thead>
          <tbody>${
            empty.length
              ? empty
                  .map(
                    (e) => `<tr>
                      <td>${esc(e.query)}</td>
                      <td>${esc(e.count || 1)}</td>
                      <td>${esc(fmt(e.lastAt))}</td>
                      <td class="hsa-actions">
                        <button type="button" class="hsa-btn" data-action="sa-test-set" data-q="${esc(e.query)}">البحث عن محتوى مناسب</button>
                        <button type="button" class="hsa-btn" data-action="sa-empty-ignore" data-q="${esc(e.query)}">تجاهل</button>
                      </td>
                    </tr>`
                  )
                  .join('')
              : `<tr><td colspan="4" class="hsa-empty">لم يتم جمع بيانات استخدام البحث بعد.</td></tr>`
          }</tbody>
        </table></div>
      </section>`;
  };

  const renderSettings = () => {
    const s = cat()?.defaultSettings?.() || {};
    return `<section class="hsa-panel">
      <h3>إعدادات الفهرسة التلقائية</h3>
      <p class="hsa-lead">عند النشر المعتمد يُضاف المحتوى تلقائياً إلى نفس فهرس محرك بحث نايوش.</p>
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
            فهرسة تلقائية: ${esc(label)}
          </label>`
        )
        .join('')}
      <button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-save-settings">حفظ الإعدادات</button>
    </section>`;
  };

  const renderTest = () => {
    const results = ui.testResults?.results || [];
    return `<section class="hsa-panel">
      <h3>اختبار محرك البحث</h3>
      <p class="hsa-lead">يستخدم نفس محرك بحث نايوش في الواجهة العامة.</p>
      <div class="hsa-toolbar">
        <input type="search" id="hsa-test-q" value="${esc(ui.testQ)}" placeholder="اكتب كلمة للبحث..." />
        <button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-test-run">بحث</button>
      </div>
      <div class="hsa-test-results">
        ${
          ui.testResults
            ? results.length
              ? results
                  .slice(0, 20)
                  .map(
                    (r) => `<article class="hsa-preview-hit">
                      <div>
                        <strong>${esc(r.title)}</strong>
                        <p>${esc(r.subtitle || '')}</p>
                        <small>${esc(r.typeAr || r.type || '')} · ${esc(r.sourceLabel || r.source || 'فهرس نايوش')}</small>
                        <div><a href="${esc(r.href || '#')}" target="_blank" rel="noopener">${esc(r.href || '')}</a></div>
                      </div>
                    </article>`
                  )
                  .join('')
              : `<p class="hsa-empty">لا نتائج لهذه العبارة.</p>`
            : `<p class="hsa-muted">أدخل كلمة وجرّب البحث.</p>`
        }
      </div>
    </section>`;
  };

  const renderAdd = () => {
    const candidates = sourceCandidates().filter((c) => !ui.addSource || c.sourceType === ui.addSource);
    const pick = candidates.find((c) => String(c.id) === String(ui.addPickId));
    return `<section class="hsa-panel">
      <h3>إضافة إلى محرك البحث</h3>
      <p class="hsa-lead">اختر عنصراً موجوداً في المنصة — بدون إعادة كتابة المحتوى.</p>
      <div class="hsa-toolbar">
        <select id="hsa-add-source">
          <option value="">كل المصادر</option>
          <option value="article" ${ui.addSource === 'article' ? 'selected' : ''}>مقال</option>
          <option value="info" ${ui.addSource === 'info' ? 'selected' : ''}>محتوى معلوماتي</option>
          <option value="service" ${ui.addSource === 'service' ? 'selected' : ''}>خدمة</option>
        </select>
        <button type="button" class="hsa-btn" data-action="sa-add-refresh">تحديث القائمة</button>
      </div>
      <div class="hsa-table-wrap"><table class="hsa-table">
        <thead><tr><th>العنوان</th><th>المصدر</th><th></th></tr></thead>
        <tbody>${
          candidates.length
            ? candidates
                .slice(0, 40)
                .map(
                  (c) => `<tr>
                    <td>${esc(c.title)}</td>
                    <td>${esc(c.sourceLabel)}</td>
                    <td><button type="button" class="hsa-btn ${ui.addPickId === c.id ? 'hsa-btn-primary' : ''}" data-action="sa-add-pick" data-id="${esc(c.id)}" data-source="${esc(c.sourceType)}">اختيار</button></td>
                  </tr>`
                )
                .join('')
            : `<tr><td colspan="3" class="hsa-empty">لا عناصر متاحة من هذا المصدر حالياً.</td></tr>`
        }</tbody>
      </table></div>
      ${
        pick
          ? `<div class="hsa-summary">
              <p><strong>${esc(pick.title)}</strong></p>
              <p>${esc(pick.description || '')}</p>
              <p>${esc(pick.href)}</p>
              <button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-add-confirm">إضافة إلى محرك البحث</button>
            </div>`
          : ''
      }
    </section>`;
  };

  const render = () => {
    const st = cat()?.stats?.() || { total: 0, published: 0, pending: 0, failed: 0, hidden: 0, sources: 0 };
    const tabs = [
      ['indexed', 'المحتوى المفهرس'],
      ['add', 'إضافة إلى محرك البحث'],
      ['test', 'اختبار محرك البحث'],
      ['issues', 'مشاكل الفهرسة'],
      ['empty', 'تحليلات البحث'],
      ['audit', 'سجل العمليات'],
      ['settings', 'إعدادات الفهرسة'],
    ];
    let body = '';
    if (ui.tab === 'indexed') body = renderIndexed();
    else if (ui.tab === 'add') body = renderAdd();
    else if (ui.tab === 'test') body = renderTest();
    else if (ui.tab === 'issues') body = renderIssues();
    else if (ui.tab === 'empty') body = renderAnalytics();
    else if (ui.tab === 'audit') body = renderAudit();
    else body = renderSettings();

    return `
      <div class="hsa-root" data-hsa-root>
        <header class="hsa-hero">
          <div>
            <h2>إدارة محرك بحث نايوش</h2>
            <p>إدارة المحتوى الذي يظهر في محرك بحث نايوش، ومتابعة الفهرسة والمصادر وحالة ظهور كل عنصر.</p>
          </div>
          <div class="hsa-hero-actions">
            <button type="button" class="hsa-btn hsa-btn-primary" data-action="sa-tab" data-tab="add">+ إضافة إلى محرك البحث</button>
            <a class="hsa-btn" href="search.html" target="_blank" rel="noopener">فتح محرك بحث نايوش</a>
            <a class="hsa-btn" href="search-admin.html">الصفحة التفصيلية</a>
          </div>
        </header>
        <div class="hsa-stats">
          <div class="hsa-stat"><strong>${st.total}</strong><span>إجمالي المفهرس</span></div>
          <div class="hsa-stat"><strong>${st.published}</strong><span>منشور في البحث</span></div>
          <div class="hsa-stat"><strong>${st.pending}</strong><span>بانتظار الفهرسة</span></div>
          <div class="hsa-stat"><strong>${st.failed}</strong><span>فشل في الفهرسة</span></div>
          <div class="hsa-stat"><strong>${st.hidden}</strong><span>موقوف من البحث</span></div>
          <div class="hsa-stat"><strong>${st.sources}</strong><span>مصادر المحتوى</span></div>
        </div>
        <nav class="hsa-tabs">${tabs.map(([id, label]) => `<button type="button" class="hsa-tab ${ui.tab === id ? 'is-on' : ''}" data-action="sa-tab" data-tab="${id}">${esc(label)}</button>`).join('')}</nav>
        <div class="hsa-main">${body}</div>
        ${renderDrawer()}${renderPreview()}
      </div>`;
  };

  const placeOpenMenu = () => {
    document.querySelectorAll('.hsa-float-menu').forEach((el) => el.remove());
    const open = document.querySelector('.hsa-more.is-open');
    if (!open || !ui.openMenu) return;
    const btn = open.querySelector('[data-action="sa-menu"]');
    const srcMenu = open.querySelector('.hsa-more-menu');
    if (!btn || !srcMenu) return;
    const float = document.createElement('div');
    float.className = 'hsa-float-menu';
    float.setAttribute('role', 'menu');
    float.innerHTML = srcMenu.innerHTML;
    document.body.appendChild(float);
    const r = btn.getBoundingClientRect();
    const menuW = Math.max(200, float.offsetWidth || 200);
    const menuH = float.offsetHeight || 180;
    let top = r.bottom + 6;
    if (top + menuH > window.innerHeight - 10) top = Math.max(10, r.top - menuH - 6);
    let left = document.documentElement.dir === 'rtl' ? r.right - menuW : r.left;
    left = Math.max(10, Math.min(left, window.innerWidth - menuW - 10));
    float.style.top = `${Math.round(top)}px`;
    float.style.left = `${Math.round(left)}px`;
    float.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action], a[href]');
      if (!target) return;
      if (target.tagName === 'A') return;
      e.preventDefault();
      e.stopPropagation();
      const action = target.getAttribute('data-action');
      const handled = handle(action, target, window.__hubSaCtx || {});
      if (handled && typeof window.__hubSaRerender === 'function') window.__hubSaRerender();
    });
  };

  const afterPaint = (ctx = {}) => {
    window.__hubSaCtx = ctx;
    window.__hubSaRerender = ctx.rerender;
    requestAnimationFrame(() => placeOpenMenu());
  };

  const clearFloatMenus = () => {
    document.querySelectorAll('.hsa-float-menu').forEach((el) => el.remove());
  };

  const handle = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const actor = user?.name || user?.email || 'مشغّل هوب';
    if (action !== 'sa-menu') {
      ui.openMenu = null;
      clearFloatMenus();
    }

    if (action === 'sa-tab') {
      ui.tab = btn.dataset.tab || 'indexed';
      return true;
    }
    if (action === 'sa-apply') {
      ui.q = document.getElementById('hsa-q')?.value || '';
      ui.filters.section = document.getElementById('hsa-f-section')?.value || '';
      ui.filters.status = document.getElementById('hsa-f-status')?.value || '';
      ui.filters.visible = document.getElementById('hsa-f-visible')?.value || '';
      ui.page = 1;
      return true;
    }
    if (action === 'sa-clear') {
      ui.q = '';
      ui.filters = { section: '', status: '', visible: '' };
      ui.page = 1;
      return true;
    }
    if (action === 'sa-page') {
      const p = Number(btn.dataset.page || 1);
      if (p >= 1) ui.page = p;
      return true;
    }
    if (action === 'sa-menu') {
      const id = btn.dataset.id;
      ui.openMenu = ui.openMenu === id ? null : id;
      if (!ui.openMenu) clearFloatMenus();
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
      const row = cat()?.get?.(btn.dataset.id);
      if (!row) return true;
      const nextVisible = row.searchVisible === false;
      cat()?.setSearchVisible?.(btn.dataset.id, nextVisible, actor);
      if (!nextVisible) {
        window.HubStore?.pushNotification?.({
          title: 'تم إخفاء عنصر من محرك البحث',
          body: `العنصر «${row.title}» لم يعد يظهر في نتائج البحث العامة.`,
          reason: 'تم إيقاف الظهور من إدارة محرك بحث نايوش.',
          source: 'محرك بحث نايوش',
          sourceName: 'محرك بحث نايوش',
          type: 'search',
          typeLabel: 'محرك البحث',
          needsAction: false,
          link: 'dashboard.html#search-admin',
          priority: 'low',
        });
      }
      toast?.(nextVisible ? 'ظهر في البحث' : 'أُخفي من البحث');
      return true;
    }
    if (action === 'sa-reindex') {
      cat()?.reindex?.(btn.dataset.id, actor);
      toast?.('تمت إعادة الفهرسة');
      return true;
    }
    if (action === 'sa-remove') {
      const row = cat()?.get?.(btn.dataset.id);
      cat()?.removeFromIndex?.(btn.dataset.id, actor);
      if (ui.selectedId === btn.dataset.id) ui.selectedId = null;
      toast?.('أُزيل من الفهرس — المصدر الأصلي لم يُحذف');
      if (row) {
        window.HubStore?.pushNotification?.({
          title: 'إزالة من فهرس البحث',
          body: `أُزيل «${row.title}» من فهرس محرك بحث نايوش.`,
          reason: 'إجراء إداري من لوحة إدارة محرك البحث.',
          source: 'محرك بحث نايوش',
          sourceName: 'محرك بحث نايوش',
          type: 'search',
          typeLabel: 'محرك البحث',
          link: 'dashboard.html#search-admin',
          needsAction: false,
        });
      }
      return true;
    }
    if (action === 'sa-test-run') {
      ui.testQ = document.getElementById('hsa-test-q')?.value || ui.testQ;
      ui.testResults = searchApi()?.searchOrchestrated?.(ui.testQ) || { results: [] };
      ui.tab = 'test';
      return true;
    }
    if (action === 'sa-test-set') {
      ui.testQ = btn.dataset.q || '';
      ui.tab = 'test';
      ui.testResults = searchApi()?.searchOrchestrated?.(ui.testQ) || { results: [] };
      return true;
    }
    if (action === 'sa-empty-ignore') {
      const list = cat()?.readEmptyQueries?.() || [];
      const row = list.find((x) => x.query === btn.dataset.q);
      if (row) row.ignored = true;
      localStorage.setItem(cat().EMPTY_Q_KEY, JSON.stringify(list));
      toast?.('تم التجاهل');
      return true;
    }
    if (action === 'sa-add-refresh') {
      ui.addSource = document.getElementById('hsa-add-source')?.value || '';
      return true;
    }
    if (action === 'sa-add-pick') {
      ui.addPickId = btn.dataset.id;
      ui.addSource = btn.dataset.source || ui.addSource;
      return true;
    }
    if (action === 'sa-add-confirm') {
      const pick = sourceCandidates().find((c) => String(c.id) === String(ui.addPickId));
      if (!pick) {
        toast?.('اختر عنصراً أولاً');
        return true;
      }
      cat()?.upsertFromSource?.(
        {
          id: `${pick.sourceType}-${pick.id}`,
          sourceType: pick.sourceType,
          sourceId: pick.id,
          sourceLabel: pick.sourceLabel,
          section: pick.section || 'content',
          kind: 'content',
          title: pick.title,
          description: pick.description,
          keywords: pick.keywords,
          href: pick.href,
          category: pick.sourceLabel,
          status: 'published',
          searchVisible: true,
        },
        actor
      );
      ui.tab = 'indexed';
      ui.addPickId = '';
      toast?.('أُضيف إلى محرك البحث');
      return true;
    }
    if (action === 'sa-save-settings') {
      const next = { ...(cat()?.defaultSettings?.() || {}) };
      document.querySelectorAll('[data-sa-setting]').forEach((el) => {
        next[el.getAttribute('data-sa-setting')] = !!el.checked;
      });
      cat()?.saveSettings?.(next);
      toast?.('تم حفظ إعدادات الفهرسة');
      return true;
    }
    return false;
  };

  window.HubSearchAdminWS = { render, handle, afterPaint, ui };
})();
