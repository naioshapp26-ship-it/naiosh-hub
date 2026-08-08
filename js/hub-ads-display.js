(() => {
  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const kindTitles = {
    home: 'إعلانات الواجهة الرئيسية',
    offices: 'إعلانات المكتب',
    platforms: 'إعلانات المنصة',
    incubators: 'إعلانات الحاضنة',
    branches: 'إعلانات الفرع',
  };

  const cardHtml = (a) => {
    const levelMeta = window.HubMarketplaceData?.adLevelMeta?.(a.adLevel);
    const typeLabel = a.type || levelMeta?.adType || a.productType || 'إعلان';
    return `<article class="hub-inline-ad">
    <div class="hub-inline-ad-media">
      ${a.imageDataUrl ? `<img src="${esc(a.imageDataUrl)}" alt="" />` : `<i class="fas fa-rectangle-ad"></i>`}
    </div>
    <div class="hub-inline-ad-body">
      <span class="hub-inline-ad-tag">${esc(typeLabel)}</span>
      <h3>${esc(a.title)}</h3>
      <p>${esc(a.desc || a.content || '')}</p>
      <div class="hub-inline-ad-foot">
        <strong>${Number(a.price || 0).toLocaleString('ar-EG')} ر.س</strong>
        <a href="ads.html?scope=${esc(a.adLevel === 'office' ? 'offices' : a.scope === 'multi' ? 'home' : a.scope || 'home')}">تفاصيل الإعلان</a>
      </div>
    </div>
  </article>`;
  };

  const renderInto = (selector, kind, name = '', opts = {}) => {
    const root = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!root) return 0;
    const listFn = window.HubStore?.listAdsFor;
    const ads = listFn
      ? listFn(kind, name)
      : (window.HubStore?.get?.().empire?.adsStudio?.listings || []).filter((a) => a.status === 'active');
    const limit = opts.limit || 6;
    const slice = ads.slice(0, limit);
    if (!slice.length) {
      if (opts.hideWhenEmpty !== false) {
        root.hidden = true;
        root.innerHTML = '';
      } else {
        root.hidden = false;
        root.innerHTML = `<p class="hub-inline-ads-empty">${esc(opts.emptyText || 'لا توجد إعلانات في هذا النطاق.')}</p>`;
      }
      return 0;
    }
    root.hidden = false;
    const title = opts.title || kindTitles[kind] || 'إعلانات نايوش';
    const scopeLink = kind === 'home' ? 'home' : kind;
    root.innerHTML = `
      <div class="hub-inline-ads-head">
        <h2>${esc(title)}</h2>
        <a href="ads.html?scope=${esc(scopeLink)}">كل الإعلانات</a>
      </div>
      <div class="hub-inline-ads-grid">${slice.map(cardHtml).join('')}</div>`;
    return slice.length;
  };

  const autoMount = () => {
    document.querySelectorAll('[data-hub-ads]').forEach((el) => {
      renderInto(el, el.dataset.hubAds || 'home', el.dataset.hubAdsName || '', {
        title: el.dataset.hubAdsTitle || undefined,
        limit: Number(el.dataset.hubAdsLimit) || 6,
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount, { once: true });
  } else {
    autoMount();
  }

  window.HubAdsDisplay = { renderInto, autoMount, cardHtml };
})();
