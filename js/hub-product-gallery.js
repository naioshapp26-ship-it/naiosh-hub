/**
 * معرض المواقع الجاهزة — وجه كبير · أنظمة واضحة · حركة
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

  const visualHtml = (s, index) => {
    const live = s.live || window.HubLiveSystems?.isLive?.(s.launchCode);
    const badges = `
      ${live ? `<span class="hub-gallery-live"><i class="fas fa-circle"></i> مباشر</span>` : ''}
      <span class="hub-gallery-index">${String(index + 1).padStart(2, '0')}</span>
    `;
    if (s.face || s.logo) {
      return `<div class="hub-gallery-visual has-face tone-${esc(s.tone || 'hub')}">
        ${s.face ? `<img class="hub-site-face" src="${esc(s.face)}" alt="${esc(s.nameAr)}" loading="lazy" />` : ''}
        ${s.logo ? `<img class="hub-site-logo" src="${esc(s.logo)}" alt="شعار ${esc(s.nameAr)}" loading="lazy" />` : ''}
        ${badges}
      </div>`;
    }
    const rows = (s.preview || [])
      .map(
        (r) =>
          `<div class="hub-phone-row"><span class="hub-phone-dot"><i class="fas ${esc(r.icon)}"></i></span>${esc(r.label)}</div>`
      )
      .join('');
    const kpis = (s.kpi || [])
      .map((k) => `<span><b>${esc(k.b)}</b>${esc(k.s)}</span>`)
      .join('');
    return `<div class="hub-gallery-visual tone-${esc(s.tone || 'hub')}">
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
        ${badges}
      </div>`;
  };

  const cardHtml = (s, index) => {
    const href =
      s.launchCode && window.HubLauncher?.getDirectLaunchUrl
        ? window.HubLauncher.getDirectLaunchUrl(s.launchCode)
        : s.href;
    return `<a class="hub-gallery-shot" href="${esc(href)}" data-ready-site="${esc(s.id)}" style="--i:${index}"${
      s.launchCode ? ` data-launch-code="${esc(s.launchCode)}" data-launch-mode="hub"` : ''
    }>
      ${visualHtml(s, index)}
      <div class="hub-gallery-copy">
        <span class="tag">${esc(s.tag || 'موقع جاهز')}</span>
        <h3>${esc(s.nameAr)}</h3>
        <p>${esc(s.desc || '')}</p>
        <span class="hub-gallery-enter"><i class="fas fa-bolt"></i> ادخل النظام الآن</span>
      </div>
    </a>`;
  };

  if (sites.length) {
    track.innerHTML = sites.map(cardHtml).join('');
  }

  const head = document.querySelector('.hub-product-gallery-head > div');
  if (head && !head.querySelector('.hub-gallery-kicker')) {
    const kicker = document.createElement('p');
    kicker.className = 'hub-gallery-kicker';
    kicker.innerHTML = '<i class="fas fa-bolt"></i> أنظمة حية · وجه الموقع الحقيقي';
    head.prepend(kicker);
  }

  const headP = document.querySelector('.hub-product-gallery-head p:not(.hub-gallery-kicker)');
  if (headP) {
    headP.textContent = 'كل نظام بوجهه ولوجوه — مرّر، اختَر، وادخل مباشرة بدون تشتيت.';
  }
  const headH = document.querySelector('.hub-product-gallery-head h2');
  if (headH) headH.textContent = 'مواقع نايوش الجاهزة';

  const foot = document.querySelector('.hub-gallery-foot span');
  if (foot) {
    foot.textContent = 'مرّر للتصفح · الأنظمة المباشرة معلَّمة · اضغط للدخول فورًا';
  }

  // نقاط التنقل
  let dots = document.querySelector('.hub-gallery-dots');
  if (!dots) {
    dots = document.createElement('div');
    dots.className = 'hub-gallery-dots';
    dots.setAttribute('aria-label', 'مؤشر المعرض');
    track.parentElement?.appendChild(dots);
  }
  const cards = () => [...track.querySelectorAll('.hub-gallery-shot')];
  const paintDots = () => {
    const list = cards();
    dots.innerHTML = list
      .map((_, i) => `<button type="button" aria-label="البطاقة ${i + 1}" data-dot="${i}"></button>`)
      .join('');
  };
  paintDots();

  const step = () => {
    const card = track.querySelector('.hub-gallery-shot');
    if (!card) return 320;
    const styles = window.getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap || '20') || 20;
    return card.getBoundingClientRect().width + gap;
  };

  const activeIndex = () => {
    const list = cards();
    if (!list.length) return 0;
    const left = track.scrollLeft;
    let best = 0;
    let bestDist = Infinity;
    list.forEach((card, i) => {
      const dist = Math.abs(card.offsetLeft - left);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  };

  const updateButtons = () => {
    const max = track.scrollWidth - track.clientWidth - 4;
    if (prev) prev.disabled = track.scrollLeft <= 4;
    if (next) next.disabled = track.scrollLeft >= max;
    const idx = activeIndex();
    dots.querySelectorAll('button').forEach((b, i) => b.classList.toggle('is-active', i === idx));
  };

  prev?.addEventListener('click', () => {
    track.scrollBy({ left: step(), behavior: 'smooth' });
  });
  next?.addEventListener('click', () => {
    track.scrollBy({ left: -step(), behavior: 'smooth' });
  });
  dots.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-dot]');
    if (!btn) return;
    const card = cards()[Number(btn.dataset.dot)];
    card?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  });
  track.addEventListener('scroll', () => requestAnimationFrame(updateButtons), { passive: true });
  window.addEventListener('resize', updateButtons);
  updateButtons();

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
