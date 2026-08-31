(() => {
  const data = window.HubIncubatorsData;
  const sectionsRoot = document.getElementById('incubatorsSections');
  const tabsRoot = document.getElementById('incubatorsTabs');
  if (!data || !sectionsRoot || !tabsRoot) return;

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const list =
    window.HubStore?.get?.()?.empire?.organization?.worldIncubators?.length
      ? window.HubStore.get().empire.organization.worldIncubators
      : data.INCUBATORS;

  const byNum = new Map(list.map((i) => [i.num || Number(String(i.id).replace(/\D/g, '')), i]));

  const incubators = data.NAMES.map((name, idx) => {
    const num = idx + 1;
    const id = `inc-${String(num).padStart(3, '0')}`;
    const stored = byNum.get(num);
    return stored
      ? {
          id: stored.id || id,
          num,
          name: stored.name || name,
          sector: stored.sector || stored.section,
          icon: stored.icon,
        }
      : {
          id,
          num,
          name,
          sector: data.SECTIONS.find((s) => num >= s.from && num <= s.to)?.title,
          icon: null,
        };
  });

  const statTotalIncubators = document.getElementById('statTotalIncubators');
  const statTotalSections = document.getElementById('statTotalSections');
  if (statTotalIncubators) statTotalIncubators.textContent = String(incubators.length);
  if (statTotalSections) statTotalSections.textContent = String(data.SECTIONS.length);

  const render = () => {
    sectionsRoot.innerHTML = '';
    tabsRoot.innerHTML = '';

    data.SECTIONS.forEach((sectionData, index) => {
      const groupItems = incubators.filter((i) => i.num >= sectionData.from && i.num <= sectionData.to);
      const section = document.createElement('section');
      section.className = 'incubator-group';
      section.id = `incubator-section-${index + 1}`;
      section.dataset.section = sectionData.title;

      const sectionHeader = document.createElement('header');
      sectionHeader.className = 'incubator-group-head';
      const sectionTitle = document.createElement('h3');
      sectionTitle.textContent = sectionData.title;
      const sectionCount = document.createElement('span');
      sectionCount.className = 'incubator-group-count';
      sectionCount.textContent = String(groupItems.length);
      sectionHeader.append(sectionTitle, sectionCount);

      const grid = document.createElement('div');
      grid.className = 'cards incubator-grid';

      groupItems.forEach((incubator) => {
        const cardId = incubator.id || `inc-${String(incubator.num).padStart(3, '0')}`;
        const card = document.createElement('article');
        card.className = 'card incubator-card';
        card.id = cardId;
        card.dataset.id = cardId;
        card.dataset.name = incubator.name;
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `فتح حاضنة ${incubator.name}`);
        const actions = window.HubActions?.rowHtml?.('incubators', cardId, { extra: '' }) || '';
        card.innerHTML = `
          <span class="incubator-number">${esc(incubator.num)}</span>
          <div class="icon-box"><i class="fas ${esc(sectionData.icon)}" aria-hidden="true"></i></div>
          <h3>${esc(incubator.name)}</h3>
          <p class="incubator-category">${esc(sectionData.title)}</p>
          ${actions ? `<div class="incubator-card-actions">${actions}</div>` : ''}
        `;
        const openCard = (e) => {
          if (e.target.closest('[data-hub-act], a, button')) return;
          openIncubator(cardId, { updateHash: true });
        };
        card.addEventListener('click', openCard);
        card.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          openCard(e);
        });
        grid.appendChild(card);
      });

      section.append(sectionHeader, grid);
      sectionsRoot.appendChild(section);

      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'incubators-tab';
      tab.setAttribute('role', 'tab');
      tab.textContent = sectionData.title;
      tab.addEventListener('click', () => {
        tabsRoot.querySelectorAll('.incubators-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      tabsRoot.appendChild(tab);
    });
  };

  const normalizeArabic = (value) =>
    String(value || '')
      .normalize('NFKD')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[إأآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .toLowerCase()
      .trim();

  const filterCards = () => {
    const query = normalizeArabic(document.getElementById('incubatorsSearchInput')?.value || '');
    sectionsRoot.querySelectorAll('.incubator-card').forEach((card) => {
      const title = normalizeArabic(card.querySelector('h3')?.textContent || '');
      card.style.display = !query || title.includes(query) ? '' : 'none';
    });
    sectionsRoot.querySelectorAll('.incubator-group').forEach((group) => {
      const visible = group.querySelectorAll('.incubator-card:not([style*="display: none"])');
      group.style.display = visible.length ? '' : 'none';
    });
  };

  document.getElementById('incubatorsSearchForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    filterCards();
  });
  document.getElementById('incubatorsSearchInput')?.addEventListener('input', filterCards);

  document.getElementById('to-top')?.addEventListener('click', () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });

  const clearFocus = () => {
    sectionsRoot.querySelectorAll('.incubator-card.is-hash-focus').forEach((el) => {
      el.classList.remove('is-hash-focus');
    });
  };

  const openIncubator = (rawId, { updateHash = false, openModal = true } = {}) => {
    const id = String(rawId || '')
      .replace(/^#/, '')
      .trim()
      .toLowerCase();
    if (!id || !/^inc-\d{3}$/i.test(id)) return false;

    const card =
      sectionsRoot.querySelector(`#${CSS.escape(id)}`) ||
      sectionsRoot.querySelector(`.incubator-card[data-id="${CSS.escape(id)}"]`);
    if (!card) return false;

    clearFocus();
    card.classList.add('is-hash-focus');
    card.style.display = '';
    const group = card.closest('.incubator-group');
    if (group) group.style.display = '';

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    card.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });

    if (updateHash && location.hash.replace(/^#/, '').toLowerCase() !== id) {
      history.replaceState(null, '', `#${id}`);
    }

    if (openModal && window.HubActions?.openView) {
      window.setTimeout(() => window.HubActions.openView('incubators', id), reduced ? 0 : 280);
    }
    return true;
  };

  const focusFromHash = () => {
    const hash = (location.hash || '').replace(/^#/, '').trim();
    if (!hash) {
      clearFocus();
      return;
    }
    openIncubator(hash, { updateHash: false, openModal: true });
  };

  window.hubRerender = () => {
    render();
    filterCards();
    focusFromHash();
  };

  window.addEventListener('hashchange', focusFromHash);

  render();
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');
  if (q) {
    const input = document.getElementById('incubatorsSearchInput');
    if (input) input.value = q;
  }
  filterCards();
  // Wait a tick so layout/fonts settle before scrolling to the deep-linked card.
  window.requestAnimationFrame(() => focusFromHash());
})();
