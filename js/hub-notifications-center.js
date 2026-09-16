/**
 * مركز إشعارات نايوش هوب — واجهة تشغيلية مربوطة بـ HubStore
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
    tab: 'all',
    q: '',
    filters: { source: '', type: '', status: '', priority: '' },
    page: 1,
    pageSize: 20,
    openMenu: null,
    selectedId: null,
  };

  const TYPE_TABS = [
    { id: 'all', label: 'الكل' },
    { id: 'customer_request', label: 'طلبات العملاء' },
    { id: 'approval', label: 'موافقات مطلوبة' },
    { id: 'system', label: 'إشعارات الأنظمة' },
    { id: 'payment', label: 'المدفوعات' },
    { id: 'article', label: 'المقالات' },
    { id: 'ad', label: 'الإعلانات' },
    { id: 'event', label: 'الفعاليات' },
    { id: 'store', label: 'المتجر' },
    { id: 'project', label: 'المشاريع' },
    { id: 'search', label: 'محرك البحث' },
    { id: 'security', label: 'الأمان' },
    { id: 'admin', label: 'التنبيهات الإدارية' },
  ];

  const PRIORITY_AR = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة', critical: 'حرجة' };
  const STATUS_AR = { new: 'جديد', read: 'مقروء', done: 'مكتمل', archived: 'مؤرشف', action_needed: 'يحتاج إجراء' };

  const fmt = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return String(iso);
    }
  };

  const store = () => window.HubStore;
  const allNotes = () => {
    try {
      store()?.migrateOrphanNotifications?.();
    } catch (_) {}
    return store()?.listNotifications?.() || [];
  };

  const inferType = (n) => {
    if (n.type && TYPE_TABS.some((t) => t.id === n.type)) return n.type;
    const hay = `${n.source || ''} ${n.sourceName || ''} ${n.category || ''} ${n.title || ''}`.toLowerCase();
    if (/مقال|article/.test(hay)) return 'article';
    if (/إعلان|ad/.test(hay)) return 'ad';
    if (/فعال|event/.test(hay)) return 'event';
    if (/متجر|store|cart/.test(hay)) return 'store';
    if (/مشروع|project/.test(hay)) return 'project';
    if (/بحث|search|فهرس/.test(hay)) return 'search';
    if (/أمن|security/.test(hay)) return 'security';
    if (/دفع|payment|wallet/.test(hay)) return 'payment';
    if (/طلب|customer|posha/.test(hay) || n.requestId) return 'customer_request';
    if (n.needsAction || n.category === 'ops') return 'approval';
    if (n.category === 'security') return 'security';
    return n.category === 'system' ? 'system' : 'admin';
  };

  const typeLabel = (n) => n.typeLabel || TYPE_TABS.find((t) => t.id === inferType(n))?.label || 'تنبيه';

  const badge = (text, cls = '') => `<span class="hnc-badge ${cls}">${esc(text)}</span>`;

  const priorityBadge = (p) => {
    const ar = PRIORITY_AR[p] || p || '—';
    const cls = p === 'high' || p === 'critical' ? 'is-high' : p === 'medium' ? 'is-med' : 'is-low';
    return badge(ar, cls);
  };

  const statusBadge = (n) => {
    if (n.archived) return badge('مؤرشف', 'is-muted');
    if (n.needsAction && !n.read) return badge('يحتاج إجراء', 'is-action');
    if (!n.read) return badge('جديد', 'is-new');
    return badge(STATUS_AR[n.status] || 'مقروء', 'is-muted');
  };

  const filtered = () => {
    let rows = allNotes();
    if (ui.tab !== 'all') rows = rows.filter((n) => inferType(n) === ui.tab);
    if (ui.filters.source) rows = rows.filter((n) => (n.sourceName || n.source) === ui.filters.source);
    if (ui.filters.type) rows = rows.filter((n) => inferType(n) === ui.filters.type);
    if (ui.filters.priority) rows = rows.filter((n) => n.priority === ui.filters.priority);
    if (ui.filters.status === 'unread') rows = rows.filter((n) => !n.read);
    if (ui.filters.status === 'action') rows = rows.filter((n) => n.needsAction && !n.read);
    if (ui.filters.status === 'read') rows = rows.filter((n) => n.read);
    const q = String(ui.q || '').trim().toLowerCase();
    if (q) {
      rows = rows.filter((n) =>
        [n.title, n.body, n.reason, n.sourceName, n.code, n.requestId, n.customerName, n.customerId]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    return rows;
  };

  const placeOpenMenu = () => {
    document.querySelectorAll('.hnc-float-menu').forEach((el) => el.remove());
    const open = document.querySelector('.hnc-more.is-open');
    if (!open || !ui.openMenu) return;
    const btn = open.querySelector('[data-action="nt-menu"]');
    const srcMenu = open.querySelector('.hnc-more-menu');
    if (!btn || !srcMenu) return;

    const float = document.createElement('div');
    float.className = 'hnc-float-menu';
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
      const target = e.target.closest('[data-action]');
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      const action = target.getAttribute('data-action');
      const fakeBtn = target;
      const handled = handle(action, fakeBtn, window.__hubNtCtx || {});
      if (handled && typeof window.__hubNtRerender === 'function') window.__hubNtRerender();
    });
  };

  const afterPaint = (ctx = {}) => {
    window.__hubNtCtx = ctx;
    window.__hubNtRerender = ctx.rerender;
    requestAnimationFrame(() => placeOpenMenu());
    if (!window.__hncMenuDocBound) {
      window.__hncMenuDocBound = true;
      document.addEventListener('click', (e) => {
        if (e.target.closest('.hnc-float-menu') || e.target.closest('[data-action="nt-menu"]')) return;
        if (ui.openMenu) {
          ui.openMenu = null;
          clearFloatMenus();
        }
      });
    }
  };

  const clearFloatMenus = () => {
    document.querySelectorAll('.hnc-float-menu').forEach((el) => el.remove());
  };

  const relatedLabel = (n) => {
    if (n.requestId) return `الطلب ${n.requestId}`;
    if (n.customerId) return `العميل ${n.customerId}`;
    if (n.referenceId) return `${n.referenceType || 'مرجع'} ${n.referenceId}`;
    return '—';
  };

  const actionButtons = (n) => {
    const open = ui.openMenu === n.id;
    return `<div class="hnc-actions">
      <button type="button" class="hnc-btn" data-action="nt-view" data-id="${esc(n.id)}">عرض</button>
      ${
        n.actionLink || n.link
          ? `<button type="button" class="hnc-btn hnc-btn-primary" data-action="nt-open-source" data-id="${esc(n.id)}">${esc(n.actionLabel || 'فتح المصدر')}</button>`
          : ''
      }
      <div class="hnc-more ${open ? 'is-open' : ''}">
        <button type="button" class="hnc-btn" data-action="nt-menu" data-id="${esc(n.id)}" title="المزيد">⋮</button>
        <div class="hnc-more-menu">
          ${
            n.read
              ? `<button type="button" data-action="nt-unread" data-id="${esc(n.id)}">تحديد كغير مقروء</button>`
              : `<button type="button" data-action="nt-read" data-id="${esc(n.id)}">تحديد كمقروء</button>`
          }
          <button type="button" data-action="nt-open-source" data-id="${esc(n.id)}">فتح المصدر</button>
          <button type="button" data-action="nt-archive" data-id="${esc(n.id)}">أرشفة</button>
          <button type="button" class="is-danger" data-action="nt-delete" data-id="${esc(n.id)}">حذف من الصندوق</button>
        </div>
      </div>
    </div>`;
  };

  const renderDrawer = () => {
    if (!ui.selectedId) return '';
    const n = allNotes().find((x) => x.id === ui.selectedId) || (store()?.get?.()?.notifications || []).find((x) => x.id === ui.selectedId);
    if (!n) return '';
    return `
      <div class="hnc-drawer-backdrop" data-action="nt-drawer-close"></div>
      <aside class="hnc-drawer" role="dialog" aria-label="تفاصيل الإشعار">
        <header class="hnc-drawer-head">
          <div>
            <h3>تفاصيل الإشعار</h3>
            <p class="hnc-muted">${esc(n.code || n.id)}</p>
          </div>
          <button type="button" class="hnc-btn" data-action="nt-drawer-close">إغلاق</button>
        </header>
        <div class="hnc-drawer-body">
          <p><strong>العنوان:</strong> ${esc(n.title)}</p>
          <p><strong>الوصف:</strong> ${esc(n.body || '—')}</p>
          <p><strong>المصدر:</strong> ${esc(n.sourceName || n.source)}</p>
          <p><strong>القسم/النظام:</strong> ${esc(n.section || typeLabel(n))}</p>
          <p><strong>سبب الإنشاء:</strong> ${esc(n.reason || n.body || '—')}</p>
          <p><strong>من قام بالعملية:</strong> ${esc(n.actorName || '—')}</p>
          <p><strong>العميل المرتبط:</strong> ${esc(n.customerName || '—')}</p>
          <p><strong>رقم العميل:</strong> ${esc(n.customerId || '—')}</p>
          <p><strong>رقم الطلب/المرجع:</strong> ${esc(n.requestId || n.referenceId || '—')}</p>
          <p><strong>التاريخ والوقت:</strong> ${esc(fmt(n.at))}</p>
          <p><strong>الأولوية:</strong> ${priorityBadge(n.priority)}</p>
          <p><strong>الحالة:</strong> ${statusBadge(n)}</p>
          <p><strong>الإجراء المطلوب:</strong> ${esc(n.actionLabel || (n.needsAction ? 'مراجعة' : 'لا يوجد'))}</p>
        </div>
        <div class="hnc-drawer-actions">
          ${n.actionLink || n.link ? `<button type="button" class="hnc-btn hnc-btn-primary" data-action="nt-open-source" data-id="${esc(n.id)}">${esc(n.actionLabel || 'فتح المصدر')}</button>` : ''}
          ${n.requestId ? `<button type="button" class="hnc-btn" data-action="nt-open-request" data-id="${esc(n.id)}">فتح الطلب</button>` : ''}
          ${n.customerId ? `<button type="button" class="hnc-btn" data-action="nt-open-customer" data-id="${esc(n.id)}">فتح العميل</button>` : ''}
          ${n.read ? '' : `<button type="button" class="hnc-btn" data-action="nt-read" data-id="${esc(n.id)}">تحديد كمقروء</button>`}
        </div>
      </aside>`;
  };

  const render = () => {
    const notes = allNotes();
    const rows = filtered();
    const unread = notes.filter((n) => !n.read).length;
    const needAction = notes.filter((n) => n.needsAction && !n.read).length;
    const high = notes.filter((n) => (n.priority === 'high' || n.priority === 'critical') && !n.read).length;
    const sources = [...new Set(notes.map((n) => n.sourceName || n.source).filter(Boolean))];
    const pages = Math.max(1, Math.ceil(rows.length / ui.pageSize) || 1);
    ui.page = Math.min(ui.page, pages);
    const start = (ui.page - 1) * ui.pageSize;
    const pageRows = rows.slice(start, start + ui.pageSize);

    return `
      <div class="hnc-root" data-hnc-root>
        <header class="hnc-hero">
          <div>
            <h2>مركز إشعارات نايوش هوب</h2>
            <p>تابع جميع التنبيهات والطلبات والأحداث القادمة من أنظمة وصفحات نايوش هوب، واعرف مصدر كل إشعار وسببه والإجراء المطلوب.</p>
          </div>
          <button type="button" class="hnc-btn hnc-btn-primary" data-action="nt-mark-all">تعليم الكل كمقروء</button>
        </header>
        <div class="hnc-stats">
          <button type="button" class="hnc-stat" data-action="nt-filter-quick" data-status=""><strong>${notes.length}</strong><span>كل الإشعارات</span></button>
          <button type="button" class="hnc-stat" data-action="nt-filter-quick" data-status="unread"><strong>${unread}</strong><span>غير المقروءة</span></button>
          <button type="button" class="hnc-stat" data-action="nt-filter-quick" data-status="action"><strong>${needAction}</strong><span>تحتاج إجراء</span></button>
          <button type="button" class="hnc-stat" data-action="nt-filter-quick" data-priority="high"><strong>${high}</strong><span>عالية الأولوية</span></button>
        </div>
        <nav class="hnc-tabs" aria-label="أنواع الإشعارات">
          ${TYPE_TABS.map((t) => `<button type="button" class="hnc-tab ${ui.tab === t.id ? 'is-on' : ''}" data-action="nt-type-tab" data-tab="${t.id}">${esc(t.label)}</button>`).join('')}
        </nav>
        <div class="hnc-toolbar">
          <input type="search" id="hnc-q" value="${esc(ui.q)}" placeholder="ابحث في الإشعارات..." />
          <select id="hnc-f-source"><option value="">المصدر</option>${sources.map((s) => `<option value="${esc(s)}" ${ui.filters.source === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
          <select id="hnc-f-type"><option value="">النوع</option>${TYPE_TABS.filter((t) => t.id !== 'all').map((t) => `<option value="${t.id}" ${ui.filters.type === t.id ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select>
          <select id="hnc-f-status">
            <option value="">الحالة</option>
            <option value="unread" ${ui.filters.status === 'unread' ? 'selected' : ''}>غير مقروء</option>
            <option value="action" ${ui.filters.status === 'action' ? 'selected' : ''}>يحتاج إجراء</option>
            <option value="read" ${ui.filters.status === 'read' ? 'selected' : ''}>مقروء</option>
          </select>
          <select id="hnc-f-priority">
            <option value="">الأولوية</option>
            <option value="high" ${ui.filters.priority === 'high' ? 'selected' : ''}>عالية</option>
            <option value="medium" ${ui.filters.priority === 'medium' ? 'selected' : ''}>متوسطة</option>
            <option value="low" ${ui.filters.priority === 'low' ? 'selected' : ''}>منخفضة</option>
          </select>
          <button type="button" class="hnc-btn" data-action="nt-apply">تطبيق</button>
          <button type="button" class="hnc-btn" data-action="nt-clear">مسح</button>
        </div>
        <div class="hnc-table-wrap">
          <table class="hnc-table">
            <thead><tr>
              <th>الإشعار</th><th>المصدر</th><th>السبب</th><th>مرتبط بـ</th><th>التاريخ والوقت</th><th>الأولوية</th><th>الحالة</th><th>الإجراءات</th>
            </tr></thead>
            <tbody>
              ${
                pageRows.length
                  ? pageRows
                      .map(
                        (n) => `<tr class="${n.read ? '' : 'is-unread'}">
                          <td>
                            <button type="button" class="hnc-title-btn" data-action="nt-view" data-id="${esc(n.id)}">
                              <strong>${esc(n.title)}</strong>
                              <small>${esc(n.code || '')} · ${esc(typeLabel(n))}</small>
                            </button>
                          </td>
                          <td>${esc(n.sourceName || n.source)}</td>
                          <td class="hnc-ellipsis" title="${esc(n.reason || n.body || '')}">${esc(n.reason || n.body || '—')}</td>
                          <td class="hnc-nowrap">${esc(relatedLabel(n))}</td>
                          <td class="hnc-nowrap">${esc(fmt(n.at))}</td>
                          <td>${priorityBadge(n.priority)}</td>
                          <td>${statusBadge(n)}</td>
                          <td>${actionButtons(n)}</td>
                        </tr>`
                      )
                      .join('')
                  : `<tr><td colspan="8" class="hnc-empty">لا إشعارات مطابقة</td></tr>`
              }
            </tbody>
          </table>
        </div>
        <div class="hnc-pager">
          <span>عرض ${rows.length ? start + 1 : 0}–${Math.min(start + ui.pageSize, rows.length)} من ${rows.length}</span>
          <div>
            <button type="button" class="hnc-btn" data-action="nt-page" data-page="${ui.page - 1}" ${ui.page <= 1 ? 'disabled' : ''}>السابق</button>
            <button type="button" class="hnc-btn" data-action="nt-page" data-page="${ui.page + 1}" ${ui.page >= pages ? 'disabled' : ''}>التالي</button>
          </div>
        </div>
        ${renderDrawer()}
      </div>`;
  };

  const openNote = (id) => {
    const n = (store()?.get?.()?.notifications || []).find((x) => x.id === id);
    if (!n) return;
    store()?.markNotificationRead?.(id);
    const link = n.actionLink || n.link || n.sourceLink;
    if (link) window.location.href = link;
  };

  const handle = (action, btn, ctx = {}) => {
    const { toast } = ctx;
    if (action !== 'nt-menu') {
      ui.openMenu = null;
      clearFloatMenus();
    }

    if (action === 'nt-type-tab') {
      ui.tab = btn.dataset.tab || 'all';
      ui.page = 1;
      return true;
    }
    if (action === 'nt-filter-quick') {
      ui.filters.status = btn.dataset.status || '';
      ui.filters.priority = btn.dataset.priority || '';
      ui.page = 1;
      return true;
    }
    if (action === 'nt-apply') {
      ui.q = document.getElementById('hnc-q')?.value || '';
      ui.filters.source = document.getElementById('hnc-f-source')?.value || '';
      ui.filters.type = document.getElementById('hnc-f-type')?.value || '';
      ui.filters.status = document.getElementById('hnc-f-status')?.value || '';
      ui.filters.priority = document.getElementById('hnc-f-priority')?.value || '';
      ui.page = 1;
      return true;
    }
    if (action === 'nt-clear') {
      ui.q = '';
      ui.filters = { source: '', type: '', status: '', priority: '' };
      ui.page = 1;
      return true;
    }
    if (action === 'nt-page') {
      const p = Number(btn.dataset.page || 1);
      if (p >= 1) ui.page = p;
      return true;
    }
    if (action === 'nt-menu') {
      const id = btn.dataset.id;
      ui.openMenu = ui.openMenu === id ? null : id;
      if (!ui.openMenu) clearFloatMenus();
      return true;
    }
    if (action === 'nt-view') {
      ui.selectedId = btn.dataset.id;
      store()?.markNotificationRead?.(btn.dataset.id);
      return true;
    }
    if (action === 'nt-drawer-close') {
      ui.selectedId = null;
      return true;
    }
    if (action === 'nt-read') {
      store()?.markNotificationRead?.(btn.dataset.id);
      toast?.('تم التحديد كمقروء');
      return true;
    }
    if (action === 'nt-unread') {
      store()?.markNotificationUnread?.(btn.dataset.id);
      toast?.('تم التحديد كغير مقروء');
      return true;
    }
    if (action === 'nt-archive') {
      store()?.archiveNotification?.(btn.dataset.id);
      if (ui.selectedId === btn.dataset.id) ui.selectedId = null;
      toast?.('تمت الأرشفة');
      return true;
    }
    if (action === 'nt-delete') {
      store()?.removeNotification?.(btn.dataset.id);
      if (ui.selectedId === btn.dataset.id) ui.selectedId = null;
      toast?.('حُذف من الصندوق');
      return true;
    }
    if (action === 'nt-mark-all') {
      store()?.markAllNotificationsRead?.();
      toast?.('تم تعليم الكل كمقروء');
      return true;
    }
    if (action === 'nt-open-source' || action === 'nt-open-request') {
      openNote(btn.dataset.id);
      return true;
    }
    if (action === 'nt-open-customer') {
      const n = (store()?.get?.()?.notifications || []).find((x) => x.id === btn.dataset.id);
      store()?.markNotificationRead?.(btn.dataset.id);
      window.location.href = `dashboard.html#posha-clients`;
      toast?.(n?.customerName ? `العميل: ${n.customerName}` : 'فتح العملاء');
      return true;
    }
    // legacy compatibility
    if (action === 'nt-tab' || action === 'nt-kpi' || action === 'nt-demo' || action === 'nt-help-open' || action === 'nt-help-dismiss') {
      if (action === 'nt-demo') {
        store()?.createHubNotification?.(
          {
            title: 'إشعار تجريبي من غرفة العمليات',
            body: 'تأكيد أن مركز الإشعارات يستقبل تنبيهات واضحة مع المصدر والسبب.',
            reason: 'اختبار يدوي من مركز الإشعارات',
            source: 'غرفة العمليات',
            sourceName: 'غرفة العمليات',
            type: 'admin',
            typeLabel: 'التنبيهات الإدارية',
            needsAction: false,
            link: 'dashboard.html#notifications',
          },
          'مشغّل'
        );
        toast?.('أُضيف إشعار');
      }
      return true;
    }
    return false;
  };

  const handleChange = (el) => {
    const key = el.getAttribute('data-nt-change');
    if (!key) return false;
    ui.filters[key] = el.value;
    ui.page = 1;
    return true;
  };

  window.HubNotificationsCenter = { render, handle, handleChange, afterPaint, ui, TYPE_TABS };
})();
