/**
 * كتالوج مواقع نايوش الجاهزة — شبكة منظمة (مصدر البيانات: HubReadySites)
 */
(() => {
  const track = document.getElementById('hub-gallery-track');
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

  let activeTag = 'الكل';

  const domainOf = (s) => {
    const live = window.HubLiveSystems?.get?.(s.launchCode);
    if (live?.domain) return live.domain;
    try {
      if (/^https?:\/\//i.test(s.href || '')) return new URL(s.href).hostname.replace(/^www\./, '');
    } catch (_) {}
    return s.barSub || '';
  };

  const visualHtml = (s, index) => {
    const live = s.live || window.HubLiveSystems?.isLive?.(s.launchCode);
    const badges = `
      ${live ? `<span class="hub-gallery-live"><i class="fas fa-circle"></i> متاح</span>` : ''}
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
    const domain = domainOf(s);
    return `<a class="hub-gallery-shot" href="${esc(href)}" data-ready-site="${esc(s.id)}" data-gallery-tag="${esc(s.tag || 'موقع جاهز')}"${
      s.launchCode ? ` data-launch-code="${esc(s.launchCode)}" data-launch-mode="hub"` : ''
    }>
      ${visualHtml(s, index)}
      <div class="hub-gallery-copy">
        <span class="tag">${esc(s.tag || 'موقع جاهز')}</span>
        <h3>${esc(s.nameAr)}</h3>
        ${domain ? `<div class="hub-gallery-domain" dir="ltr">${esc(domain)}</div>` : ''}
        <p>${esc(s.desc || '')}</p>
        <span class="hub-gallery-enter"><i class="fas fa-arrow-left"></i> ادخل النظام</span>
      </div>
    </a>`;
  };

  const visibleSites = () =>
    activeTag === 'الكل' ? sites : sites.filter((s) => (s.tag || 'موقع جاهز') === activeTag);

  const paintCards = () => {
    const list = visibleSites();
    track.innerHTML = list.length
      ? list.map((s, i) => cardHtml(s, sites.indexOf(s) >= 0 ? sites.indexOf(s) : i)).join('')
      : '<p class="hub-gallery-empty">لا أنظمة في هذا التصنيف حاليًا.</p>';
  };

  const paintFilters = () => {
    const box = document.querySelector('[data-hub-gallery-filters]');
    if (!box) return;
    const counts = {};
    sites.forEach((s) => {
      const t = s.tag || 'موقع جاهز';
      counts[t] = (counts[t] || 0) + 1;
    });
    const tags = Object.keys(counts);
    const hasGroup = tags.some((t) => counts[t] >= 2);
    if (!hasGroup || tags.length < 2) {
      box.hidden = true;
      box.innerHTML = '';
      activeTag = 'الكل';
      return;
    }
    box.hidden = false;
    const all = ['الكل', ...tags];
    box.innerHTML = all
      .map(
        (t) =>
          `<button type="button" class="hub-gallery-filter${t === activeTag ? ' is-active' : ''}" data-gallery-filter="${esc(t)}">${esc(t)}${t === 'الكل' ? '' : ` (${counts[t]})`}</button>`
      )
      .join('');
  };

  const head = document.querySelector('.hub-product-gallery-head > div');
  if (head && !head.querySelector('.hub-gallery-kicker')) {
    const kicker = document.createElement('p');
    kicker.className = 'hub-gallery-kicker';
    kicker.innerHTML = `<i class="fas fa-gem"></i> مجموعة الأنظمة الحية · ${sites.length} مواقع`;
    head.prepend(kicker);
  }

  const headP = document.querySelector('.hub-product-gallery-head p:not(.hub-gallery-kicker)');
  if (headP) {
    headP.textContent = 'كتالوج الأنظمة الجاهزة — اختر النظام وادخل مباشرة بوجهه الحقيقي.';
  }
  const headH = document.querySelector('.hub-product-gallery-head h2');
  if (headH) headH.textContent = 'مواقع نايوش الجاهزة';

  const foot = document.querySelector('.hub-gallery-foot span');
  if (foot) {
    foot.textContent = 'اختر النظام المناسب وادخل مباشرة · الأنظمة المباشرة معلَّمة';
  }

  paintFilters();
  paintCards();

  document.querySelector('[data-hub-gallery-filters]')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-gallery-filter]');
    if (!btn) return;
    activeTag = btn.getAttribute('data-gallery-filter') || 'الكل';
    paintFilters();
    paintCards();
  });

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
