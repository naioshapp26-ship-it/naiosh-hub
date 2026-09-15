/**
 * نظام التوجيه المركزي NCDE — واجهة واضحة + CRUD
 * localStorage: hubDirectives
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'hubDirectives';
  const ID_PREFIX = 'DIR-2026-';
  const LEGACY_PREFIX = 'NCDE-2026-';

  const STATUSES = [
    { id: 'draft', label: 'مسودة', cls: 'is-draft' },
    { id: 'open', label: 'مفتوح', cls: 'is-open' },
    { id: 'in_progress', label: 'قيد التنفيذ', cls: 'is-progress' },
    { id: 'done', label: 'مكتمل', cls: 'is-done' },
    { id: 'late', label: 'متأخر', cls: 'is-late' },
    { id: 'cancelled', label: 'ملغي', cls: 'is-cancelled' },
  ];

  const STATUS_MAP = {
    draft: 'draft',
    issued: 'open',
    open: 'open',
    in_progress: 'in_progress',
    done: 'done',
    evaluated: 'done',
    closed: 'cancelled',
    cancelled: 'cancelled',
    late: 'late',
  };

  const SEED = [
    {
      id: 'DIR-2026-00001',
      type: 'قرار',
      title: 'اعتماد NAIOSH HUB 360 كمركز التشغيل والتكامل المركزي',
      scope: 'جميع المنظومة',
      assignee: 'الإدارة المركزية',
      issuer: 'الإدارة العليا',
      dueDate: '2026-06-30',
      status: 'in_progress',
      body: 'اعتماد هوب كمركز تشغيل وتكامل مركزي لجميع الأنظمة والمنصات.',
      createdAt: '2026-01-15T08:00:00.000Z',
      history: [{ at: '2026-01-15T08:00:00.000Z', text: 'إصدار التوجيه', by: 'النظام' }],
    },
    {
      id: 'DIR-2026-00002',
      type: 'تكليف',
      title: 'تنفيذ مركز المعلومات في جميع الحاضنات',
      scope: 'حاضنة',
      assignee: 'مديرو الحاضنات',
      issuer: 'غرفة العمليات',
      dueDate: '2026-09-01',
      status: 'open',
      body: 'تفعيل مركز المعلومات والسياسات والأدلة داخل كل حاضنة.',
      createdAt: '2026-02-01T10:00:00.000Z',
      history: [{ at: '2026-02-01T10:00:00.000Z', text: 'إصدار التوجيه', by: 'النظام' }],
    },
    {
      id: 'DIR-2026-00003',
      type: 'تحديث نظام',
      title: 'شهادة توافق مع HUB 360 لكل مشروع برمجي جديد',
      scope: 'منصة',
      assignee: 'فريق الهندسة',
      issuer: 'الهندسة',
      dueDate: '2026-12-31',
      status: 'draft',
      body: 'إلزام المشاريع الجديدة بشهادة توافق HUB قبل الإطلاق.',
      createdAt: '2026-03-10T14:00:00.000Z',
      history: [{ at: '2026-03-10T14:00:00.000Z', text: 'إنشاء مسودة', by: 'النظام' }],
    },
    {
      id: 'DIR-2026-00004',
      type: 'تعميم',
      title: 'الامتثال لجميع أنواع السياسات',
      scope: 'جميع المنظومة',
      assignee: 'الإدارة',
      issuer: 'الحوكمة',
      dueDate: '2026-09-20',
      status: 'open',
      body: 'الالتزام الكامل بمكتبة سياسات نايوش هوب في جميع الوحدات.',
      createdAt: '2026-04-01T09:00:00.000Z',
      history: [{ at: '2026-04-01T09:00:00.000Z', text: 'إصدار التعميم', by: 'النظام' }],
    },
  ];

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];

  let statusFilter = 'all';
  let ui = { viewId: '', editId: '', menuId: '' };

  const nowIso = () => new Date().toISOString();

  const esc = (v) =>
    String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fmtDate = (iso) => {
    if (!iso) return '—';
    try {
      const raw = String(iso).trim();
      const d = /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? new Date(`${raw}T12:00:00`)
        : new Date(raw);
      if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
      return d.toLocaleDateString('ar-EG');
    } catch (_) {
      return String(iso).slice(0, 10);
    }
  };

  const normalizeStatus = (raw, dueDate) => {
    let s = STATUS_MAP[raw] || raw || 'draft';
    if (['draft', 'open', 'in_progress', 'done', 'cancelled'].includes(s) && dueDate) {
      const due = new Date(dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!Number.isNaN(due.getTime()) && due < today && s !== 'done' && s !== 'cancelled') {
        return 'late';
      }
    }
    return s;
  };

  const statusMeta = (id) => STATUSES.find((s) => s.id === id) || { id, label: id, cls: 'is-draft' };

  const readAll = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  };

  const saveAll = (list) => localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

  const normalizeRow = (d) => {
    const status = normalizeStatus(d.status, d.dueDate);
    return {
      ...d,
      status,
      scope: d.scope || 'عامة',
      issuer: d.issuer || d.createdBy || 'الإدارة',
      body: d.body || d.description || '',
      history: Array.isArray(d.history) ? d.history : [{ at: d.createdAt || nowIso(), text: 'تسجيل التوجيه', by: 'النظام' }],
      updatedAt: d.updatedAt || d.createdAt || nowIso(),
    };
  };

  const ensureSeed = () => {
    let existing = readAll();
    if (!existing || !existing.length) {
      saveAll(SEED);
      return SEED.map(normalizeRow);
    }
    existing = existing.map((d) => {
      let id = d.id;
      if (String(id).startsWith(LEGACY_PREFIX)) {
        id = id.replace(LEGACY_PREFIX, ID_PREFIX);
      }
      return normalizeRow({ ...d, id });
    });
    saveAll(existing);
    return existing;
  };

  const nextId = (list) => {
    const nums = list
      .map((d) => d.id)
      .filter((id) => String(id).startsWith(ID_PREFIX) || String(id).startsWith(LEGACY_PREFIX))
      .map((id) => parseInt(String(id).replace(ID_PREFIX, '').replace(LEGACY_PREFIX, ''), 10))
      .filter((n) => !Number.isNaN(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return `${ID_PREFIX}${String(max + 1).padStart(5, '0')}`;
  };

  const pushHistory = (row, text, by = 'مشغّل') => {
    const history = Array.isArray(row.history) ? row.history.slice() : [];
    history.unshift({ at: nowIso(), text, by });
    row.history = history;
    row.updatedAt = nowIso();
  };

  const renderKpis = (list) => {
    const root = qs('[data-dir-kpis]');
    if (!root) return;
    root.innerHTML = [
      { n: list.length, l: 'توجيه' },
      { n: list.filter((d) => d.status === 'in_progress').length, l: 'قيد التنفيذ' },
      { n: list.filter((d) => d.status === 'done').length, l: 'مكتمل' },
      { n: list.filter((d) => d.status === 'open' || d.status === 'late').length, l: 'مفتوح/متأخر' },
      { n: list.filter((d) => d.status === 'cancelled').length, l: 'ملغي' },
    ]
      .map((i) => `<article class="dir-kpi"><strong>${i.n}</strong><span>${i.l}</span></article>`)
      .join('');
  };

  const renderFilters = () => {
    const root = qs('[data-dir-filters]');
    if (!root) return;
    const items = [{ id: 'all', label: 'الكل' }, ...STATUSES];
    root.innerHTML = items
      .map(
        (f) =>
          `<button type="button" class="${statusFilter === f.id ? 'is-active' : ''}" data-dir-status="${f.id}">${f.label}</button>`
      )
      .join('');
  };

  const badgeHtml = (status) => {
    const meta = statusMeta(status);
    return `<span class="dir-badge ${meta.cls}"><span class="dot" aria-hidden="true"></span>${esc(meta.label)}</span>`;
  };

  const cardHtml = (d) => {
    const openMenu = ui.menuId === d.id;
    return `
      <article class="dir-card" data-dir-id="${esc(d.id)}">
        <div class="dir-card-head">
          <h3>${esc(d.title)}</h3>
          ${badgeHtml(d.status)}
        </div>
        <div class="dir-meta-grid">
          <div class="dir-meta-item"><span class="k">رقم التوجيه</span><span class="v">${esc(d.id)}</span></div>
          <div class="dir-meta-item"><span class="k">النوع</span><span class="v">${esc(d.type)}</span></div>
          <div class="dir-meta-item"><span class="k">النطاق</span><span class="v">${esc(d.scope)}</span></div>
          <div class="dir-meta-item"><span class="k">المسؤول</span><span class="v">${esc(d.assignee)}</span></div>
          <div class="dir-meta-item"><span class="k">تاريخ الإنشاء</span><span class="v">${esc(fmtDate(d.createdAt))}</span></div>
          <div class="dir-meta-item"><span class="k">تاريخ الاستحقاق</span><span class="v">${esc(fmtDate(d.dueDate))}</span></div>
        </div>
        <div class="dir-actions">
          <button type="button" class="dir-btn primary" data-dir-view="${esc(d.id)}"><i class="fas fa-eye"></i> عرض التفاصيل</button>
          <button type="button" class="dir-btn" data-dir-edit="${esc(d.id)}"><i class="fas fa-pen"></i> تعديل</button>
          <div class="dir-menu ${openMenu ? 'is-open' : ''}">
            <button type="button" class="dir-btn" data-dir-menu="${esc(d.id)}"><i class="fas fa-ellipsis"></i> الإجراءات</button>
            <div class="dir-menu-panel" role="menu">
              <button type="button" data-dir-status-pick="${esc(d.id)}" data-status="open">تغيير الحالة → مفتوح</button>
              <button type="button" data-dir-status-pick="${esc(d.id)}" data-status="in_progress">تغيير الحالة → قيد التنفيذ</button>
              <button type="button" data-dir-status-pick="${esc(d.id)}" data-status="done"><i class="fas fa-check"></i> إتمام</button>
              <button type="button" data-dir-status-pick="${esc(d.id)}" data-status="cancelled">إغلاق / إلغاء</button>
              <button type="button" data-dir-del="${esc(d.id)}" style="color:#b91c1c"><i class="fas fa-trash"></i> حذف</button>
            </div>
          </div>
        </div>
      </article>`;
  };

  const viewModal = () => {
    if (!ui.viewId) return '';
    const d = ensureSeed().find((x) => x.id === ui.viewId);
    if (!d) return '';
    return `
      <div class="dir-modal-overlay" data-dir-view-overlay>
        <div class="dir-modal" role="dialog" aria-modal="true">
          <button type="button" class="dir-btn" data-dir-close-view>إغلاق</button>
          <h2 style="margin-top:12px">${esc(d.title)}</h2>
          ${badgeHtml(d.status)}
          <div class="dir-detail-grid">
            <p><strong>رقم التوجيه:</strong> ${esc(d.id)}</p>
            <p><strong>النوع:</strong> ${esc(d.type)}</p>
            <p><strong>من أصدره:</strong> ${esc(d.issuer || '—')}</p>
            <p><strong>المسؤول عنه:</strong> ${esc(d.assignee)}</p>
            <p><strong>النطاق:</strong> ${esc(d.scope)}</p>
            <p><strong>تاريخ الإصدار:</strong> ${esc(fmtDate(d.createdAt))}</p>
            <p><strong>تاريخ الاستحقاق:</strong> ${esc(fmtDate(d.dueDate))}</p>
            <p><strong>وصف/محتوى التوجيه:</strong><br>${esc(d.body || 'لا يوجد وصف إضافي.').replace(/\n/g, '<br>')}</p>
            <p><strong>المرفقات:</strong> ${d.attachmentName ? esc(d.attachmentName) : 'لا توجد'}</p>
          </div>
          <div class="dir-history">
            <strong>سجل التحديثات</strong>
            <ul>${(d.history || [])
              .map((h) => `<li>${esc(fmtDate(h.at))} — ${esc(h.text)} · ${esc(h.by || '')}</li>`)
              .join('')}</ul>
          </div>
          <div class="dir-actions" style="margin-top:16px">
            <button type="button" class="dir-btn primary" data-dir-edit="${esc(d.id)}">تعديل</button>
            <button type="button" class="dir-btn" data-dir-close-view>إغلاق</button>
          </div>
        </div>
      </div>`;
  };

  const editModal = () => {
    if (!ui.editId) return '';
    const d = ensureSeed().find((x) => x.id === ui.editId);
    if (!d) return '';
    const statusOpts = STATUSES.filter((s) => s.id !== 'late')
      .map((s) => `<option value="${s.id}" ${d.status === s.id || (d.status === 'late' && s.id === 'open') ? 'selected' : ''}>${s.label}</option>`)
      .join('');
    return `
      <div class="dir-modal-overlay" data-dir-edit-overlay>
        <div class="dir-modal" role="dialog" aria-modal="true">
          <h2>تعديل التوجيه</h2>
          <label>العنوان</label><input data-dir-e="title" value="${esc(d.title)}" />
          <label>النوع</label>
          <select data-dir-e="type">
            ${['أمر', 'قرار', 'تعميم', 'سياسة', 'إجراء', 'تكليف', 'طلب تنفيذ', 'تحديث نظام']
              .map((t) => `<option ${d.type === t ? 'selected' : ''}>${t}</option>`)
              .join('')}
          </select>
          <label>النطاق</label>
          <select data-dir-e="scope">
            ${['عامة', 'جميع المنظومة', 'إمبراطورية', 'دولة', 'فرع', 'حاضنة', 'منصة']
              .map((t) => `<option ${d.scope === t ? 'selected' : ''}>${t}</option>`)
              .join('')}
          </select>
          <label>المسؤول</label><input data-dir-e="assignee" value="${esc(d.assignee)}" />
          <label>تاريخ الاستحقاق</label><input type="date" data-dir-e="dueDate" value="${esc((d.dueDate || '').slice(0, 10))}" />
          <label>الحالة</label><select data-dir-e="status">${statusOpts}</select>
          <label>محتوى التوجيه</label><textarea data-dir-e="body">${esc(d.body || '')}</textarea>
          <div class="dir-actions" style="margin-top:16px">
            <button type="button" class="dir-btn" data-dir-close-edit>إلغاء</button>
            <button type="button" class="dir-btn primary" data-dir-save-edit>حفظ التعديلات</button>
          </div>
        </div>
      </div>`;
  };

  const renderList = () => {
    const list = ensureSeed();
    const root = qs('[data-dir-list]');
    if (!root) return;
    renderKpis(list);
    renderFilters();
    const q = (qs('[data-dir-q]')?.value || '').trim().toLowerCase();
    const rows = list
      .filter((d) => statusFilter === 'all' || d.status === statusFilter)
      .filter((d) => {
        if (!q) return true;
        const hay = `${d.id} ${d.title} ${d.type} ${d.scope} ${d.assignee} ${d.body || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    root.innerHTML = rows.length
      ? rows.map(cardHtml).join('')
      : '<div class="dir-empty">لا توجد توجيهات مطابقة.</div>';

    const mount = qs('[data-dir-modals]');
    if (mount) mount.innerHTML = viewModal() + editModal();
    bindDynamic();
  };

  const updateStatus = (id, status) => {
    const list = ensureSeed();
    const idx = list.findIndex((d) => d.id === id);
    if (idx === -1) return;
    list[idx].status = status;
    pushHistory(list[idx], `تغيير الحالة إلى ${statusMeta(status).label}`);
    saveAll(list);
    ui.menuId = '';
    renderList();
  };

  const removeDirective = (id) => {
    if (!confirm('حذف هذا التوجيه نهائيًا؟')) return;
    const list = ensureSeed().filter((d) => d.id !== id);
    saveAll(list);
    ui.menuId = '';
    ui.viewId = '';
    ui.editId = '';
    renderList();
  };

  const addDirective = (data) => {
    const list = ensureSeed();
    const entry = normalizeRow({
      id: nextId(list),
      type: data.type,
      title: data.title.trim(),
      scope: data.scope,
      assignee: data.assignee.trim(),
      issuer: data.issuer || 'مشغّل النظام',
      dueDate: data.dueDate,
      body: data.body || '',
      status: 'open',
      createdAt: nowIso(),
      history: [{ at: nowIso(), text: 'إصدار التوجيه', by: 'مشغّل النظام' }],
    });
    list.unshift(entry);
    saveAll(list);
    renderList();
    return entry;
  };

  const saveEdit = () => {
    const id = ui.editId;
    const list = ensureSeed();
    const idx = list.findIndex((d) => d.id === id);
    if (idx < 0) return;
    const overlay = qs('[data-dir-edit-overlay]');
    if (!overlay) return;
    const get = (k) => overlay.querySelector(`[data-dir-e="${k}"]`)?.value || '';
    list[idx].title = get('title').trim();
    list[idx].type = get('type');
    list[idx].scope = get('scope');
    list[idx].assignee = get('assignee').trim();
    list[idx].dueDate = get('dueDate');
    list[idx].status = get('status') || list[idx].status;
    list[idx].body = get('body');
    pushHistory(list[idx], 'تعديل بيانات التوجيه');
    saveAll(list.map(normalizeRow));
    ui.editId = '';
    renderList();
  };

  const bindDynamic = () => {
    qsa('[data-dir-view]').forEach((btn) => {
      btn.onclick = () => {
        ui.viewId = btn.getAttribute('data-dir-view');
        ui.menuId = '';
        renderList();
      };
    });
    qsa('[data-dir-edit]').forEach((btn) => {
      btn.onclick = () => {
        ui.editId = btn.getAttribute('data-dir-edit');
        ui.viewId = '';
        ui.menuId = '';
        renderList();
      };
    });
    qsa('[data-dir-menu]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-dir-menu');
        ui.menuId = ui.menuId === id ? '' : id;
        renderList();
      };
    });
    qsa('[data-dir-status-pick]').forEach((btn) => {
      btn.onclick = () => updateStatus(btn.getAttribute('data-dir-status-pick'), btn.getAttribute('data-status'));
    });
    qsa('[data-dir-del]').forEach((btn) => {
      btn.onclick = () => removeDirective(btn.getAttribute('data-dir-del'));
    });
    const viewOv = qs('[data-dir-view-overlay]');
    if (viewOv) {
      viewOv.onclick = (e) => {
        if (e.target === viewOv || e.target.closest('[data-dir-close-view]')) {
          ui.viewId = '';
          renderList();
        }
      };
    }
    const editOv = qs('[data-dir-edit-overlay]');
    if (editOv) {
      editOv.onclick = (e) => {
        if (e.target === editOv || e.target.closest('[data-dir-close-edit]')) {
          ui.editId = '';
          renderList();
        }
      };
      qs('[data-dir-save-edit]')?.addEventListener('click', saveEdit);
    }
  };

  const init = () => {
    if (!qs('[data-dir-root]')) return;
    ensureSeed();
    renderList();

    qs('[data-dir-form]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const entry = addDirective({
        type: fd.get('type'),
        title: fd.get('title'),
        scope: fd.get('scope'),
        assignee: fd.get('assignee'),
        dueDate: fd.get('dueDate'),
        body: fd.get('body') || '',
      });
      e.target.reset();
      if (entry) {
        ui.viewId = entry.id;
        renderList();
      }
    });

    qs('[data-dir-q]')?.addEventListener('input', renderList);

    qs('[data-dir-filters]')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-dir-status]');
      if (!btn) return;
      statusFilter = btn.getAttribute('data-dir-status');
      renderList();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dir-menu') && ui.menuId) {
        ui.menuId = '';
        renderList();
      }
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.HubDirectives = { STATUSES, SEED, ensureSeed, addDirective, updateStatus };
})();
