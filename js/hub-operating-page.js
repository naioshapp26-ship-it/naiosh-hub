(() => {
  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const principles = window.HubOperatingModel?.PRINCIPLES || [];
  const root = document.getElementById('op-principles');
  if (root) {
    root.innerHTML = principles
      .map(
        (p) => `<article class="op-card">
        <div class="op-card-top">
          <span class="op-card-num">${p.id}</span>
          <i class="fas ${esc(p.icon)}"></i>
          <h3>${esc(p.title)}</h3>
        </div>
        <p class="summary">${esc(p.summary)}</p>
        <p class="detail">${esc(p.detail)}</p>
      </article>`
      )
      .join('');
  }

  const sysGrid = document.getElementById('op-systems-grid');
  if (sysGrid && window.HubLauncher?.SYSTEM_META) {
    sysGrid.innerHTML = Object.entries(window.HubLauncher.SYSTEM_META)
      .map(([code, meta]) => {
        const href = window.HubLauncher.getDirectLaunchUrl(code);
        return `<button type="button" class="op-system-btn" data-launch-code="${esc(code)}" data-launch-mode="hub">
          <i class="fas ${esc(meta.icon)}" style="background:${esc(meta.color)}"></i>
          <strong>${esc(meta.nameAr)}</strong>
          <small>${esc(code)} · ${esc(meta.domain)}</small>
        </button>
        <a class="sr-only" href="${esc(href)}">${esc(meta.nameAr)}</a>`;
      })
      .join('');
    sysGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-launch-code]');
      if (!btn) return;
      window.HubLauncher.launch(btn.dataset.launchCode, { mode: 'hub' });
    });
  }

  const map = document.getElementById('op-services-map');
  if (map && window.HubOperatingModel?.SYSTEM_SERVICES) {
    map.innerHTML = Object.entries(window.HubOperatingModel.SYSTEM_SERVICES)
      .map(([code, list]) => {
        const name = window.HubLauncher?.SYSTEM_META?.[code]?.nameAr || code;
        return `<article class="op-service-group">
          <h3><i class="fas ${esc(window.HubLauncher?.SYSTEM_META?.[code]?.icon || 'fa-cube')}"></i> ${esc(name)} <small style="color:#9ca3af;font-weight:700">(${esc(code)})</small></h3>
          <div class="op-service-chips">
            ${list.map((s) => `<span><i class="fas ${esc(s.icon)}"></i> ${esc(s.nameAr)}</span>`).join('')}
          </div>
        </article>`;
      })
      .join('');
  }
})();
