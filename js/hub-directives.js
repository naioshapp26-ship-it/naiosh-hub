/**
 * نظام التوجيه المركزي NCDE — ملف 08
 * localStorage: hubDirectives
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'hubDirectives';
  const ID_PREFIX = 'NCDE-2026-';

  const STATUSES = [
    { id: 'draft', label: 'مسودة' },
    { id: 'issued', label: 'صادر' },
    { id: 'in_progress', label: 'قيد التنفيذ' },
    { id: 'done', label: 'منفّذ' },
    { id: 'evaluated', label: 'مقيّم' },
    { id: 'closed', label: 'مغلق' },
  ];

  const SEED = [
    {
      id: 'NCDE-2026-00001',
      type: 'قرار',
      title: 'اعتماد NAIOSH HUB 360 كمركز التشغيل والتكامل المركزي',
      scope: 'إمبراطورية',
      assignee: 'الإدارة المركزية',
      dueDate: '2026-06-30',
      status: 'in_progress',
      createdAt: '2026-01-15T08:00:00.000Z',
    },
    {
      id: 'NCDE-2026-00002',
      type: 'تكليف',
      title: 'تنفيذ مركز المعرفة والتشغيل والتعلم في جميع الحاضنات',
      scope: 'حاضنة',
      assignee: 'مديرو الحاضنات',
      dueDate: '2026-09-01',
      status: 'issued',
      createdAt: '2026-02-01T10:00:00.000Z',
    },
    {
      id: 'NCDE-2026-00003',
      type: 'تحديث نظام',
      title: 'شهادة توافق مع HUB 360 لكل مشروع برمجي جديد',
      scope: 'منصة',
      assignee: 'فريق الهندسة',
      dueDate: '2026-12-31',
      status: 'draft',
      createdAt: '2026-03-10T14:00:00.000Z',
    },
  ];

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];

  let statusFilter = 'all';

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

  const ensureSeed = () => {
    const existing = readAll();
    if (existing && existing.length) return existing;
    saveAll(SEED);
    return SEED.slice();
  };

  const nextId = (list) => {
    const nums = list
      .map((d) => d.id)
      .filter((id) => id.startsWith(ID_PREFIX))
      .map((id) => parseInt(id.replace(ID_PREFIX, ''), 10))
      .filter((n) => !Number.isNaN(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return `${ID_PREFIX}${String(max + 1).padStart(5, '0')}`;
  };

  const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label || id;

  const renderKpis = (list) => {
    const root = qs('[data-dir-kpis]');
    if (!root) return;
    const open = list.filter((d) => d.status !== 'closed').length;
    root.innerHTML = [
      { n: list.length, l: 'توجيه' },
      { n: list.filter((d) => d.status === 'in_progress').length, l: 'قيد التنفيذ' },
      { n: list.filter((d) => d.status === 'done' || d.status === 'evaluated').length, l: 'منفّذ/مقيّم' },
      { n: open, l: 'مفتوح' },
      { n: list.filter((d) => d.status === 'closed').length, l: 'مغلق' },
    ]
      .map((i) => `<article class="dir-kpi"><strong>${i.n}</strong><span>${i.l}</span></article>`)
      .join('');
  };

  const renderFilters = () => {
    const root = qs('[data-dir-filters]');
    if (!root) return;
    root.innerHTML = [
      { id: 'all', label: 'الكل' },
      ...STATUSES.map((s) => ({ id: s.id, label: s.label })),
    ]
      .map(
        (f, i) =>
          `<button type="button" class="${i === 0 ? 'is-active' : ''}" data-dir-status="${f.id}">${f.label}</button>`
      )
      .join('');
  };

  const renderList = () => {
    const list = ensureSeed();
    const root = qs('[data-dir-list]');
    if (!root) return;
    renderKpis(list);
    const q = (qs('[data-dir-q]')?.value || '').trim().toLowerCase();
    const rows = list
      .filter((d) => statusFilter === 'all' || d.status === statusFilter)
      .filter((d) => {
        if (!q) return true;
        const hay = `${d.id} ${d.title} ${d.type} ${d.scope} ${d.assignee}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!rows.length) {
      root.innerHTML = '<div class="dir-empty">لا توجد توجيهات مطابقة.</div>';
      return;
    }

    root.innerHTML = rows
      .map(
        (d) => `
      <article class="dir-card" data-dir-id="${d.id}">
        <header>
          <span class="dir-id">${d.id}</span>
          <h3>${d.title}</h3>
        </header>
        <div class="dir-meta">
          <span><i class="fas fa-tag"></i> ${d.type}</span>
          <span><i class="fas fa-globe"></i> ${d.scope}</span>
          <span><i class="fas fa-user"></i> ${d.assignee}</span>
          <span><i class="fas fa-calendar"></i> ${d.dueDate}</span>
        </div>
        <div class="dir-status" role="group" aria-label="حالة التوجيه">
          ${STATUSES.map(
            (s) =>
              `<button type="button" class="${d.status === s.id ? 'is-current' : ''}" data-dir-set="${s.id}">${s.label}</button>`
          ).join('')}
        </div>
      </article>`
      )
      .join('');
  };

  const updateStatus = (id, status) => {
    const list = ensureSeed();
    const idx = list.findIndex((d) => d.id === id);
    if (idx === -1) return;
    list[idx].status = status;
    saveAll(list);
    renderList();
  };

  const addDirective = (data) => {
    const list = ensureSeed();
    const entry = {
      id: nextId(list),
      type: data.type,
      title: data.title.trim(),
      scope: data.scope,
      assignee: data.assignee.trim(),
      dueDate: data.dueDate,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    list.unshift(entry);
    saveAll(list);
    renderList();
  };

  const init = () => {
    if (!qs('[data-dir-root]')) return;
    ensureSeed();
    renderFilters();
    renderList();

    qs('[data-dir-form]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      addDirective({
        type: fd.get('type'),
        title: fd.get('title'),
        scope: fd.get('scope'),
        assignee: fd.get('assignee'),
        dueDate: fd.get('dueDate'),
      });
      e.target.reset();
    });

    qs('[data-dir-q]')?.addEventListener('input', renderList);

    qs('[data-dir-filters]')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-dir-status]');
      if (!btn) return;
      qsa('[data-dir-filters] button').forEach((b) => b.classList.toggle('is-active', b === btn));
      statusFilter = btn.getAttribute('data-dir-status');
      renderList();
    });

    qs('[data-dir-list]')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-dir-set]');
      if (!btn) return;
      const card = btn.closest('[data-dir-id]');
      if (!card) return;
      updateStatus(card.getAttribute('data-dir-id'), btn.getAttribute('data-dir-set'));
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.HubDirectives = { STATUSES, SEED };
})();
