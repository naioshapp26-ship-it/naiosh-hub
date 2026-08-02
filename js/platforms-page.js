(() => {
  const catalog = window.HubSovereignPlatforms;
  if (!catalog) return;

  const tabsRoot = document.getElementById('platformsTabs');
  const sectionsRoot = document.getElementById('platformsSections');
  const countEl = document.getElementById('stat-count');
  if (countEl) countEl.textContent = String(catalog.count);

  if (!tabsRoot || !sectionsRoot) return;

  const groups = catalog.byCategory();

  groups.forEach((group, idx) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'products-tab';
    tab.textContent = group.label;
    tab.addEventListener('click', () => {
      document.getElementById(`ps-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    tabsRoot.appendChild(tab);

    const section = document.createElement('section');
    section.className = 'product-section';
    section.id = `ps-${idx}`;

    const head = document.createElement('div');
    head.className = 'product-section-head';
    head.innerHTML = `
      <div class="section-icon"><i class="fas ${group.icon}"></i></div>
      <h2>${group.label}</h2>
      <span class="product-section-count">${group.platforms.length} منصة</span>
    `;
    section.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'product-grid';

    group.platforms.forEach((p) => {
      const card = document.createElement('article');
      card.className = 'product-card';
      card.setAttribute('aria-label', `${p.code} — ${p.nameAr}`);
      card.innerHTML = `
        <div class="card-icon"><i class="fas ${p.icon}"></i></div>
        <span class="platform-code">${p.code}</span>
        <h3>${p.nameAr}</h3>
        <div class="platform-role">${p.role}</div>
        <p>${p.desc}</p>
        <span class="card-btn"><i class="fas fa-satellite"></i> ${p.name}</span>
      `;
      grid.appendChild(card);
    });

    section.appendChild(grid);
    sectionsRoot.appendChild(section);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08 }
  );
  document.querySelectorAll('.product-card').forEach((c) => observer.observe(c));

  const sectionEls = groups.map((_, i) => document.getElementById(`ps-${i}`));
  const tabEls = tabsRoot.querySelectorAll('.products-tab');
  const activateTab = () => {
    let current = 0;
    sectionEls.forEach((el, i) => {
      if (el && el.getBoundingClientRect().top <= 120) current = i;
    });
    tabEls.forEach((t, i) => t.classList.toggle('active', i === current));
  };
  window.addEventListener('scroll', activateTab, { passive: true });
  activateTab();

  document.getElementById('to-top')?.addEventListener('click', () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });
})();
