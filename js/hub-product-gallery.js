/**
 * معرض المواقع الجاهزة — لقطة لكل موقع · اضغط تدخل مباشرة
 */
(() => {
  const track = document.getElementById('hub-gallery-track');
  const prev = document.getElementById('hub-gallery-prev');
  const next = document.getElementById('hub-gallery-next');
  if (!track) return;

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const sites = (window.HubReadySites?.gallerySites?.() || []).filter(
    (s) => !window.HubReadySites?.isExcluded?.(s.nameAr)
  );

  const cardHtml = (s) => {
    const href =
      s.launchCode && window.HubLauncher?.getDirectLaunchUrl
        ? window.HubLauncher.getDirectLaunchUrl(s.launchCode)
        : s.href;
    const rows = (s.preview || [])
      .map(
        (r) =>
          `<div class="hub-phone-row"><span class="hub-phone-dot"><i class="fas ${esc(r.icon)}"></i></span>${esc(r.label)}</div>`
      )
      .join('');
    const kpis = (s.kpi || [])
      .map((k) => `<span><b>${esc(k.b)}</b>${esc(k.s)}</span>`)
      .join('');
    return `<a class="hub-gallery-shot" href="${esc(href)}" data-ready-site="${esc(s.id)}"${
      s.launchCode ? ` data-launch-code="${esc(s.launchCode)}" data-launch-mode="hub"` : ''
    }>
      <div class="hub-gallery-copy">
        <span class="tag">${esc(s.tag || 'موقع جاهز')}</span>
        <h3>${esc(s.nameAr)}</h3>
        <p>${esc(s.desc || '')}</p>
        <span class="hub-gallery-enter"><i class="fas fa-arrow-up-left"></i> اضغط للدخول مباشرة</span>
      </div>
      <div class="hub-gallery-visual tone-${esc(s.tone || 'hub')}">
        <div class="hub-phone" aria-hidden="true">
          <div class="hub-phone-notch"></div>
          <div class="hub-phone-screen">
            <div class="hub-phone-bar">${esc(s.bar || s.nameAr)}<small>${esc(s.barSub || '')}</small></div>
            <div class="hub-phone-body">
              ${kpis ? `<div class="hub-phone-kpi">${kpis}</div>` : ''}
              ${rows}
            </div>
          </div>
        </div>
      </div>
    </a>`;
  };

  if (sites.length) {
    track.innerHTML = sites.map(cardHtml).join('');
  }

  const headP = document.querySelector('.hub-product-gallery-head p');
  if (headP) {
    headP.textContent = `مواقع جاهزة عندنا — اضغط أي لقطة تدخل على الموقع مباشرة وتشتغل. (كونزو غير مدرج في المنتجات)`;
  }
  const headH = document.querySelector('.hub-product-gallery-head h2');
  if (headH) headH.textContent = 'مواقع نايوش الجاهزة';

  const foot = document.querySelector('.hub-gallery-foot span');
  if (foot) {
    foot.textContent = 'مرّر لاستعراض اللقطات · اضغط أي موقع للدخول فورًا · اشترِ من المتجر لتفعيل الصلاحية';
  }

  const step = () => {
    const card = track.querySelector('.hub-gallery-shot');
    if (!card) return 320;
    const styles = window.getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap || '16') || 16;
    return card.getBoundingClientRect().width + gap;
  };

  const updateButtons = () => {
    const max = track.scrollWidth - track.clientWidth - 4;
    if (prev) prev.disabled = track.scrollLeft <= 4;
    if (next) next.disabled = track.scrollLeft >= max;
  };

  prev?.addEventListener('click', () => {
    track.scrollBy({ left: step(), behavior: 'smooth' });
  });
  next?.addEventListener('click', () => {
    track.scrollBy({ left: -step(), behavior: 'smooth' });
  });
  track.addEventListener('scroll', () => requestAnimationFrame(updateButtons), { passive: true });
  window.addEventListener('resize', updateButtons);
  updateButtons();

  // فتح عبر هوب للأنظمة (مع صلاحية) — باقي الصفحات انتقال مباشر
  track.addEventListener('click', (e) => {
    const a = e.target.closest('[data-launch-code]');
    if (!a || !window.HubLauncher?.launch) return;
    e.preventDefault();
    window.HubLauncher.launch(a.dataset.launchCode, {
      mode: 'hub',
      force: window.HubLiveSystems?.isLive?.(a.dataset.launchCode),
    });
  });
})();
