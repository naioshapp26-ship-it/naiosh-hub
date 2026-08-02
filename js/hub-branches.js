(() => {
  const data = window.HubBranchesData;
  const grid = document.getElementById('branchGrid');
  if (!data || !grid) return;

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const toast = (msg) => {
    if (window.HubActions?.toast) return window.HubActions.toast(msg);
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

  const render = () => {
    const list =
      window.HubStore?.get?.()?.empire?.organization?.worldBranches?.length
        ? window.HubStore.get().empire.organization.worldBranches
        : data.BRANCHES;

    grid.innerHTML = list
      .map((b) => {
        const searchKey = `${b.nameAr || ''} ${b.nameEn || ''} ${b.code || ''}`;
        const actions =
          window.HubActions?.rowHtml?.('branches', b.id, {
            extra: '',
          }) || '';
        return `<article class="branch-card" data-id="${esc(b.id)}" data-branch="${esc(searchKey)}" data-type="${esc(b.type)}">
          <div class="branch-card-top">
            <span class="branch-badge">${esc(b.type)}</span>
            <img class="branch-flag" alt="${esc(b.flagAlt || b.nameAr)}" src="${esc(b.flag)}" />
          </div>
          <div class="branch-content">
            <h3 class="branch-title">${esc(b.nameAr)} <span>${esc(b.nameEn)}</span></h3>
            <p class="branch-hours"><i class="fas fa-clock"></i> ${esc(b.hours)}</p>
            <div class="branch-actions">
              <button type="button" class="branch-btn primary" data-branch-act="book" data-id="${esc(b.id)}" aria-label="احجز زيارة - ${esc(b.nameAr)}">احجز زيارة</button>
              <button type="button" class="branch-btn" data-branch-act="view" data-id="${esc(b.id)}" aria-label="عرض الفرع - ${esc(b.nameAr)}">عرض الفرع</button>
            </div>
            ${actions ? `<div class="branch-card-actions">${actions}</div>` : ''}
          </div>
        </article>`;
      })
      .join('');
  };

  const getBranchWord = (count) => {
    if (count === 1) return 'فرع';
    if (count === 2) return 'فرعين';
    return 'فروع';
  };

  const applyFilters = () => {
    const searchInput = document.getElementById('branchSearch');
    const typeFilter = document.getElementById('branchTypeFilter');
    const status = document.getElementById('branchFilterStatus');
    const cards = Array.from(document.querySelectorAll('.branch-card'));
    const query = (searchInput?.value || '').trim().toLowerCase();
    const type = typeFilter?.value || 'all';
    let visibleCount = 0;
    cards.forEach((card) => {
      const branchText = (card.getAttribute('data-branch') || '').toLowerCase();
      const branchType = card.getAttribute('data-type') || '';
      const matchesSearch = !query || branchText.includes(query);
      const matchesType = type === 'all' || branchType === type;
      const isVisible = matchesSearch && matchesType;
      card.style.display = isVisible ? '' : 'none';
      if (isVisible) visibleCount += 1;
    });
    if (status) status.textContent = `تم عرض ${visibleCount} ${getBranchWord(visibleCount)}`;
  };

  const findBranch = (id) => {
    const list =
      window.HubStore?.get?.()?.empire?.organization?.worldBranches || data.BRANCHES;
    return list.find((b) => String(b.id) === String(id));
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-branch-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.branchAct;
    const branch = findBranch(id);
    if (!branch) return toast('الفرع غير موجود');

    if (act === 'view') {
      if (window.HubActions?.openView && window.HubStore?.getEntity?.('branches', id)) {
        return window.HubActions.openView('branches', id);
      }
      toast(`فرع ${branch.nameAr} · ${branch.type} · ${branch.hours}`);
      return;
    }
    if (act === 'book') {
      toast(`تم تسجيل طلب زيارة لفرع ${branch.nameAr}`);
      window.HubStore?.pushFeed?.('decision', `حجز زيارة فرع: ${branch.nameAr}`);
    }
  });

  const searchInput = document.getElementById('branchSearch');
  const typeFilter = document.getElementById('branchTypeFilter');
  const allButton = document.getElementById('branchFilterAll');

  searchInput?.addEventListener('input', applyFilters);
  typeFilter?.addEventListener('change', applyFilters);
  allButton?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    if (typeFilter) typeFilter.value = 'all';
    applyFilters();
  });

  document.getElementById('to-top')?.addEventListener('click', () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });

  window.hubRerender = () => {
    render();
    applyFilters();
  };

  render();
  applyFilters();
})();
