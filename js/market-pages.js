(() => {
  const page = document.body.dataset.marketPage;
  const data = window.HubMarketplaceData;
  const store = window.HubStore;
  if (!page || !data) return;

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const money = (n) => (window.HubCurrency?.format ? window.HubCurrency.format(n) : `${Number(n) || 0}$`);

  const prefersReducedMotion = () =>
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scrollToResults = (el) => {
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    });
  };

  const toast = (msg) => {
    let el = document.getElementById('market-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'market-toast';
      el.className = 'market-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.classList.remove('is-visible');
    }, 2200);
  };

  const setStat = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };

  const actions = (entity, id) => (window.HubActions ? window.HubActions.rowHtml(entity, id) : '');
  const metaLine = (item) => (window.HubActions?.metaCardLine ? window.HubActions.metaCardLine(item) : '');

  const renderApps = () => {
    const apps = store?.get?.().empire?.apps || data.APPS.map((a) => ({ ...a, id: a.code }));
    const root = document.getElementById('market-grid');
    const tabs = document.getElementById('market-tabs');
    if (!root) return;
    const cats = ['الكل', 'أنظمة نايوش', ...Array.from(new Set(apps.map((a) => a.category))).filter((c) => c !== 'أنظمة نايوش')];
    let active = 'أنظمة نايوش';
    const launcher = window.HubLauncher;

    const paint = () => {
      const list = (active === 'الكل' ? apps : apps.filter((a) => a.category === active)).filter((a) => {
        if (a.status === 'archived') return false;
        // أنظمة نايوش: اعرض الشغّالة فقط (دومين حي)
        if (a.kind === 'system' || a.category === 'أنظمة نايوش') {
          return Boolean(window.HubLiveSystems?.isLive?.(a.code));
        }
        return true;
      });
      root.innerHTML = list
        .map((a) => {
          const app = launcher?.normalizeApp?.(a) || a;
          const isSystem = app.kind === 'system';
          const openHtml = launcher
            ? launcher.openButtonsHtml(app, { compact: !isSystem })
            : `<a class="btn-mini primary" href="${esc(app.url || 'apps.html')}"><i class="fas fa-arrow-left"></i> فتح</a>`;
          const site = window.HubReadySites?.findByLaunchCode?.(a.code || a.launchCode);
          const media =
            site?.face || site?.logo
              ? `<div class="card-media has-face">${
                  site.face
                    ? `<img class="card-face" src="${esc(site.face)}" alt="${esc(a.nameAr)}" loading="lazy" />`
                    : ''
                }${
                  site.logo
                    ? `<img class="card-logo" src="${esc(site.logo)}" alt="شعار ${esc(a.nameAr)}" loading="lazy" />`
                    : ''
                }</div>`
              : `<div class="card-icon"><i class="fas ${esc(a.icon || 'fa-cube')}"></i></div>`;
          return `<article class="market-card" id="${esc((a.code || '').toLowerCase())}">
            ${media}
            <span class="badge-soft">${esc(a.category)}</span>
            <h3>${esc(a.nameAr)}</h3>
            <p>${
              isSystem
                ? 'اضغط للانتقال مباشرة إلى النظام نفسه — يعمل عبر هوب أو بشكل منفرد، ويرفع إشعاراته ومعلوماته إلى هوب.'
                : 'أي نظام نايوش يمكنه الظهور هنا والارتباط بهوب للتشغيل الموحد.'
            }</p>
            <div class="meta">${a.status === 'active' ? 'متاح الآن' : 'قيد التجهيز'}${a.health ? ` · صحة ${a.health}%` : ''}${a.assignee ? ` · معيّن: ${esc(a.assignee)}` : ''}${app.lastSyncAt ? ' · مُزامَن' : ''}</div>
            ${metaLine(a)}
            <div class="card-actions">
              ${openHtml}
            </div>
            ${actions('apps', a.id || a.code)}
          </article>`;
        })
        .join('');
    };

    if (tabs) {
      tabs.innerHTML = cats
        .map((c) => `<button type="button" class="market-tab${c === active ? ' is-active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`)
        .join('');
      tabs.onclick = (e) => {
        const btn = e.target.closest('[data-cat]');
        if (!btn) return;
        active = btn.dataset.cat;
        tabs.querySelectorAll('.market-tab').forEach((t) => t.classList.toggle('is-active', t.dataset.cat === active));
        paint();
        scrollToResults(root);
      };
    }
    setStat('stat-apps', apps.length);
    setStat('stat-active', apps.filter((a) => a.status === 'active').length);
    paint();

    root.addEventListener('click', (e) => {
      const link = e.target.closest('[data-launch-code]');
      if (!link || !window.HubStore?.recordLaunch) return;
      window.HubStore.recordLaunch(link.dataset.launchCode, link.dataset.launchMode || 'hub');
    });
  };

  const renderStore = () => {
    const rawItems = store?.get?.().empire?.salesStore?.items || data.STORE_ITEMS;
    const items = (rawItems || []).filter(
      (i) => !window.HubReadySites?.isExcluded?.(i.title) && !window.HubReadySites?.isExcluded?.(i.brand)
    );
    const root = document.getElementById('market-grid');
    const tabs = document.getElementById('market-tabs');
    if (!root) return;
    let active = 'الكل';
    const shopCats = data.SHOP_CATEGORIES || data.STORE_CATEGORIES.map((c) => ({ id: c, name: c, icon: 'fa-tag' }));
    const connectors = data.MARKETPLACE_CONNECTORS || [];

    const mpBadges = (item) => {
      const links = item.marketplaces || [];
      if (!links.length) return '';
      return `<div class="hub-mp-badges">${links
        .map((m) => {
          const meta = connectors.find((c) => c.id === m.id) || {};
          const label = m.nameAr || meta.nameAr || m.name || m.id;
          const featured = meta.featured ? ' is-featured' : '';
          const iconStyle = meta.color ? ` style="color:${esc(meta.color)}"` : '';
          const icon = `<i class="${esc(meta.icon || 'fas fa-store')}"${iconStyle}></i>`;
          if (m.url) {
            return `<a class="hub-mp-badge${featured}" data-mp="${esc(m.id)}" href="${esc(m.url)}" target="_blank" rel="noopener">${icon} ${esc(label)}</a>`;
          }
          return `<span class="hub-mp-badge draft${featured}" data-mp="${esc(m.id)}">${icon} ${esc(label)}</span>`;
        })
        .join('')}</div>`;
    };

    const paint = () => {
      const list = (active === 'الكل' ? items : items.filter((i) => i.category === active)).filter(
        (i) => i.status !== 'archived'
      );
      root.innerHTML = list.length
        ? list
            .map(
              (i) => {
                const site = window.HubReadySites?.siteForProduct?.(i);
                const media =
                  site?.face || site?.logo
                    ? `<div class="card-media has-face">${
                        site.face
                          ? `<img class="card-face" src="${esc(site.face)}" alt="${esc(site.nameAr || i.title)}" loading="lazy" />`
                          : ''
                      }${
                        site.logo
                          ? `<img class="card-logo" src="${esc(site.logo)}" alt="شعار ${esc(site.nameAr || i.title)}" loading="lazy" />`
                          : ''
                      }</div>`
                    : '';
                return `<article class="market-card">
            ${media}
            <span class="badge-soft">${esc(i.badge || i.itemKind || i.category)}</span>
            <h3>${esc(i.title)}</h3>
            <p>${esc(i.desc || '')}</p>
            <div class="price">${money(i.price)}</div>
            <div class="meta">${esc(i.itemKind || 'منتج')} · ${esc(i.brand || '—')} · نقاط: ${i.points || 0} · مخزون: ${i.stock}${i.assignee ? ` · معيّن: ${esc(i.assignee)}` : ''}</div>
            ${mpBadges(i)}
            ${metaLine(i)}
            <div class="card-actions">
              <button type="button" class="btn-mini" data-cart="${esc(i.id)}"><i class="fas fa-basket-shopping"></i> أضف للسلة</button>
              <button type="button" class="btn-mini primary" data-buy="${esc(i.id)}"><i class="fas fa-cart-plus"></i> اشترِ الآن</button>
              ${
                (() => {
                  if (!site) return '';
                  const href =
                    site.launchCode && window.HubLauncher?.getDirectLaunchUrl
                      ? window.HubLauncher.getDirectLaunchUrl(site.launchCode)
                      : site.href;
                  return `<a class="btn-mini" href="${esc(href)}" ${
                    site.launchCode ? `data-launch-code="${esc(site.launchCode)}" data-launch-mode="hub"` : ''
                  }><i class="fas fa-arrow-up-left"></i> ادخل الموقع</a>`;
                })()
              }
            </div>
            ${actions('store', i.id)}
          </article>`;
              }
            )
            .join('')
        : `<div class="shop-empty" style="grid-column:1/-1">لا توجد عناصر في هذا التصنيف — ارفع منتجًا أو خدمة من النموذج أعلاه.</div>`;
    };

    if (tabs) {
      tabs.innerHTML = shopCats
        .map(
          (c) =>
            `<button type="button" class="market-tab${c.id === active ? ' is-active' : ''}" data-cat="${esc(c.id)}"><i class="fas ${esc(c.icon || 'fa-tag')}"></i> ${esc(c.name)}</button>`
        )
        .join('');
      tabs.onclick = (e) => {
        const btn = e.target.closest('[data-cat]');
        if (!btn) return;
        active = btn.dataset.cat;
        tabs.querySelectorAll('.market-tab').forEach((t) => t.classList.toggle('is-active', t.dataset.cat === active));
        paint();
        scrollToResults(root);
      };
    }

    root.onclick = (e) => {
      const launch = e.target.closest('[data-launch-code]');
      if (launch && window.HubLauncher?.launch) {
        e.preventDefault();
        window.HubLauncher.launch(launch.dataset.launchCode, { mode: 'hub' });
        return;
      }
      const cartBtn = e.target.closest('[data-cart]');
      if (cartBtn && window.HubCart?.add) {
        const item = items.find((x) => String(x.id) === String(cartBtn.dataset.cart));
        if (item) {
          window.HubCart.add(item);
          toast(`أُضيف للسلة: ${item.title}`);
        }
        return;
      }
      const btn = e.target.closest('[data-buy]');
      if (!btn) return;
      if (window.HubReadySites?.buyThenOpen) {
        const result = window.HubReadySites.buyThenOpen(btn.dataset.buy);
        if (!result.ok) return toast(result.error || 'تعذّر إتمام الطلب');
        toast(`تم الشراء: ${result.order.title} — جاري فتح موقعك…`);
        paint();
        setStat('stat-orders', store.get().empire.salesStore.orders.length);
        setStat('stat-items', store.get().empire.salesStore.items.length);
        setTimeout(() => {
          if (result.site?.launchCode && window.HubLauncher?.launch) {
            window.HubLauncher.launch(result.site.launchCode, { mode: 'hub', force: true });
          } else if (result.openHref) {
            window.location.href = result.openHref;
          }
        }, 700);
        return;
      }
      if (!store?.placeStoreOrder) return;
      const order = store.placeStoreOrder(btn.dataset.buy, 'زائر المتجر');
      if (!order) return toast('تعذّر إتمام الطلب');
      toast(`تم الشراء: ${order.title}`);
      paint();
      setStat('stat-orders', store.get().empire.salesStore.orders.length);
      setStat('stat-items', store.get().empire.salesStore.items.length);
    };

    const mpCount = items.reduce((n, i) => n + (i.marketplaces?.length || 0), 0);
    setStat('stat-items', items.length);
    setStat('stat-orders', store?.get?.().empire?.salesStore?.orders?.length || 0);
    setStat('stat-cats', shopCats.length - 1);
    setStat('stat-mp', mpCount);
    paint();
  };

  const renderAds = () => {
    const scopeTitles = {
      home: 'إعلانات الواجهة الرئيسية',
      offices: 'إعلانات المكتب',
      branches: 'إعلانات الفرع',
      incubators: 'إعلانات الحاضنة',
      platforms: 'إعلانات المنصة',
      multi: 'إعلانات متعددة الطبقات',
    };
    const scopeParam = new URLSearchParams(window.location.search).get('scope') || '';
    const allListings = (store?.get?.().empire?.adsStudio?.listings || data.ADS).filter(
      (a) => a.status === 'active' && a.publishStatus !== 'deferred' && a.publishStatus !== 'draft'
    );
    const listings = scopeParam
      ? allListings.filter((a) =>
          window.HubStore?.adMatchesScope ? window.HubStore.adMatchesScope(a, scopeParam) : (a.scope || 'platforms') === scopeParam
        )
      : allListings;
    const root = document.getElementById('ads-grid');
    const tabs = document.getElementById('market-tabs');
    const catsRoot = document.getElementById('ads-cats');
    const heroTitle = document.querySelector('.market-hero h1');
    const heroDesc = document.querySelector('.market-hero p');
    if (!root) return;
    let active = 'all';

    if (heroTitle && scopeTitles[scopeParam]) {
      heroTitle.textContent = scopeTitles[scopeParam];
    }
    if (heroDesc && scopeTitles[scopeParam]) {
      heroDesc.textContent = `تشغيل إعلانات ${scopeTitles[scopeParam].replace('إعلانات ', '')} عبر نظام متعدد الطبقات — مكتب · منصة · حاضنة · فرع · الواجهة الرئيسية.`;
    }

    const targetBadge = (a) => {
      const t = a.publishTargets || {};
      const bits = [];
      if (t.home) bits.push('الواجهة الرئيسية');
      if ((t.offices || []).length) bits.push('مكتب');
      if ((t.platforms || []).length) bits.push('منصة');
      if ((t.incubators || []).length) bits.push('حاضنة');
      if ((t.branches || []).length) bits.push('فرع');
      if (!bits.length && a.scope) bits.push(scopeTitles[a.scope]?.replace('إعلانات ', '') || a.scope);
      return bits.join(' · ') || 'منصة';
    };

    const paint = () => {
      const list = active === 'all' ? listings : listings.filter((a) => a.category === active);
      root.innerHTML = list.length
        ? list
            .map((a) => {
              const levelMeta = window.HubMarketplaceData?.adLevelMeta?.(a.adLevel);
              const typeLabel = a.type || levelMeta?.adType || a.productType || 'إعلان';
              return `<article class="ads-item-card">
            <div class="ads-item-media">
              ${a.imageDataUrl ? `<img src="${esc(a.imageDataUrl)}" alt="" />` : `<i class="fas fa-rectangle-ad" style="font-size:28px"></i>`}
              <span>${esc(typeLabel)}</span>
              <small>${esc(levelMeta?.nameAr || a.adLevel || a.platformCode || '')}</small>
            </div>
            <div class="ads-item-body">
              <p class="ads-price">${money(a.price || 0)}</p>
              <h3 class="ads-item-title">${esc(a.title)}</h3>
              ${a.projectName ? `<p class="ads-meta"><i class="fas fa-compass"></i> المشروع: <strong>${esc(a.projectName)}</strong>${a.projectCategory ? ` · ${esc(a.projectCategory)}` : ''}</p>` : ''}
              <p class="ads-meta">${esc(a.desc || a.content || '')}</p>
              <p class="ads-meta" style="margin-top:8px">${esc(a.category || '')}${a.subcategory ? ' / ' + esc(a.subcategory) : ''} · ${esc(targetBadge(a))}</p>
              <p class="ads-meta">${Number(a.views || 0).toLocaleString('en-US')} مشاهدة${a.adStartDate ? ` · ${esc(a.adStartDate)} → ${esc(a.adEndDate || '—')}` : ''}</p>
              ${metaLine(a)}
              <div style="margin-top:10px">
                <a class="btn-mini primary" href="products.html">عرض المنتجات</a>
                <a class="btn-mini" href="store.html">المتجر</a>
              </div>
              ${actions('ads', a.id)}
            </div>
          </article>`;
            })
            .join('')
        : `<div class="shop-empty" style="grid-column:1/-1">لا توجد إعلانات في هذا النطاق حاليًا.</div>`;
    };

    if (catsRoot) {
      const scopes = window.HubMarketplaceData?.AD_PUBLISH_SCOPES || [
        { id: 'home', nameAr: 'الواجهة الرئيسية', icon: 'fa-house' },
        { id: 'offices', nameAr: 'المكتب', icon: 'fa-briefcase' },
        { id: 'platforms', nameAr: 'المنصة', icon: 'fa-layer-group' },
        { id: 'incubators', nameAr: 'الحاضنة', icon: 'fa-seedling' },
        { id: 'branches', nameAr: 'الفرع', icon: 'fa-code-branch' },
      ];
      catsRoot.innerHTML =
        scopes
          .map(
            (c) => `<a class="market-card" href="ads.html?scope=${esc(c.id)}" style="text-align:center;text-decoration:none">
          <div class="card-icon" style="margin:0 auto"><i class="fas ${esc(c.icon)}"></i></div>
          <h3>${esc(c.nameAr)}</h3>
        </a>`
          )
          .join('') +
        data.AD_CATEGORIES.filter((c) => c.id !== 'all')
          .map(
            (c) => `<button type="button" class="market-card" data-cat="${esc(c.id)}" style="cursor:pointer;text-align:center">
          <div class="card-icon" style="margin:0 auto"><i class="fas ${esc(c.icon)}"></i></div>
          <h3>${esc(c.name)}</h3>
        </button>`
          )
          .join('');
      catsRoot.className = 'ads-cats-grid';
      catsRoot.onclick = (e) => {
        const btn = e.target.closest('[data-cat]');
        if (!btn) return;
        active = btn.dataset.cat;
        paint();
        scrollToResults(root);
      };
    }

    if (tabs) {
      tabs.innerHTML = data.AD_CATEGORIES.map(
        (c) => `<button type="button" class="market-tab${c.id === active ? ' is-active' : ''}" data-cat="${esc(c.id)}">${esc(c.name)}</button>`
      ).join('');
      tabs.onclick = (e) => {
        const btn = e.target.closest('[data-cat]');
        if (!btn) return;
        active = btn.dataset.cat;
        tabs.querySelectorAll('.market-tab').forEach((t) => t.classList.toggle('is-active', t.dataset.cat === active));
        paint();
        scrollToResults(root);
      };
    }

    setStat('stat-ads', listings.length);
    setStat('stat-views', listings.reduce((s, a) => s + (a.views || 0), 0));
    paint();
  };

  const renderEvents = () => {
    const events = store?.get?.().empire?.eventsStudio?.events || data.EVENTS;
    const root = document.getElementById('market-grid');
    if (!root) return;
    root.innerHTML = events
      .filter((e) => e.status !== 'archived')
      .map(
        (e) => `<article class="market-card">
          <span class="badge-soft">${esc(e.status)}</span>
          <h3>${esc(e.name)}</h3>
          <p>${esc(e.description)}</p>
          <div class="meta">${esc(e.date)} · ${esc(e.time)} · ${esc(e.duration)}</div>
          <div class="meta">${esc(e.type)} · ${esc(e.speaker)} · ${esc(e.platform)}${e.assignee ? ` · معيّن: ${esc(e.assignee)}` : ''}</div>
          ${metaLine(e)}
          <div class="card-actions">
            <a class="btn-mini primary" href="dashboard.html#events-studio"><i class="fas fa-ticket"></i> إدارة من غرفة العمليات</a>
          </div>
          ${actions('events', e.id)}
        </article>`
      )
      .join('');
    setStat('stat-events', events.length);
    setStat('stat-upcoming', events.filter((e) => e.status === 'قادمة').length);
  };

  const renderProducts = () => {
    const fromStore = store?.get?.().empire?.productCatalog || [];
    const fromData = data?.PRODUCT_CATALOG || [];
    const byId = new Map();
    fromStore.forEach((p) => {
      if (p?.id) byId.set(String(p.id), p);
    });
    fromData.forEach((p) => {
      if (p?.id && !byId.has(String(p.id))) byId.set(String(p.id), p);
    });
    const raw = byId.size ? [...byId.values()] : fromData;
    const products = raw.filter((p) => {
      if (window.HubReadySites?.isExcluded?.(p.name) || window.HubReadySites?.isExcluded?.(p.brand)) return false;
      const site = window.HubReadySites?.siteForProduct?.(p);
      return Boolean(site && window.HubReadySites?.isLiveSite?.(site));
    });
    const cats = data.SHOP_CATEGORIES || [{ id: 'الكل', name: 'كل المنتجات', icon: 'fa-border-all' }];
    const strip = document.getElementById('shop-cat-strip');
    const side = document.getElementById('shop-side-list');
    const grid = document.getElementById('shop-grid');
    const label = document.getElementById('shop-result-label');
    const searchInput = document.getElementById('products-search');
    const form = document.getElementById('products-search-form');
    const viewGrid = document.getElementById('view-grid');
    const viewList = document.getElementById('view-list');
    if (!grid) return;

    let active = 'الكل';
    let view = 'grid';

    const countOf = (id) => (id === 'الكل' ? products.length : products.filter((p) => p.category === id).length);

    const isLiveLaunch = (code) => Boolean(code && window.HubLiveSystems?.isLive?.(code));

    const siteHref = (p) => {
      const site = window.HubReadySites?.siteForProduct?.(p);
      if (!site) return 'store.html';
      if (isLiveLaunch(site.launchCode) && window.HubLauncher?.getDirectLaunchUrl) {
        return window.HubLauncher.getDirectLaunchUrl(site.launchCode);
      }
      return site.href;
    };

    const fillSectors = () => {
      const root = document.getElementById('shop-sectors-list');
      if (!root) return;
      const sectors = (window.HubSectorLibrary?.list?.() || []).filter((s) => s.sectorId !== 'other');
      root.innerHTML = sectors
        .map((s) => {
          const q = encodeURIComponent(s.sectorNameAr || s.sectorName || '');
          return `<a href="incubators.html?q=${q}"><i class="fas ${esc(s.icon || 'fa-industry')}"></i> ${esc(
            s.sectorNameAr || s.sectorName
          )}</a>`;
        })
        .join('');
    };

    const wireBack = () => {
      const btn = document.getElementById('shop-side-back');
      if (!btn || btn.dataset.wired) return;
      btn.dataset.wired = '1';
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        try {
          if (document.referrer && new URL(document.referrer).origin === window.location.origin && window.history.length > 1) {
            window.history.back();
            return;
          }
        } catch (_) {
          /* fall through */
        }
        window.location.href = 'index.html';
      });
    };

    const paintChrome = () => {
      if (strip) {
        strip.innerHTML = cats
          .map(
            (c) => `<button type="button" class="shop-cat-chip${c.id === active ? ' is-active' : ''}" data-cat="${esc(c.id)}">
              <span class="thumb"><i class="fas ${esc(c.icon || 'fa-cube')}"></i></span>
              <span>${esc(c.name)}</span>
            </button>`
          )
          .join('');
      }
      if (side) {
        side.innerHTML = cats
          .map((c) => {
            const n = countOf(c.id);
            return `<label class="shop-side-item">
              <input type="radio" name="shop-cat" value="${esc(c.id)}" ${c.id === active ? 'checked' : ''} />
              <span>${esc(c.name)}</span>
              <small>(${n})</small>
            </label>`;
          })
          .join('');
      }
    };

    const paint = () => {
      const q = (searchInput?.value || '').trim().toLowerCase();
      const list = products.filter((p) => {
        if (p.status === 'archived' || p.status === 'مؤرشف') return false;
        if (active !== 'الكل' && p.category !== active) return false;
        if (!q) return true;
        const hay = `${p.sku} ${p.name} ${p.brand} ${p.platform} ${p.category}`.toLowerCase();
        return hay.includes(q);
      });

      const catName = cats.find((c) => c.id === active)?.name || active;
      if (label) label.textContent = `${catName} — ${list.length} عنصر`;

      grid.classList.toggle('is-list', view === 'list');
      grid.innerHTML = list.length
        ? list
            .map((p) => {
              const site = window.HubReadySites?.siteForProduct?.(p);
              const openUrl = siteHref(p);
              const buyUrl = `store.html?buy=${encodeURIComponent(p.sku || p.id)}&site=${encodeURIComponent(site?.id || '')}`;
              const media =
                site?.face || site?.logo
                  ? `<div class="shop-card-media has-face">${
                      site.face
                        ? `<img class="shop-face" src="${esc(site.face)}" alt="${esc(site.nameAr || p.name)}" loading="lazy" />`
                        : ''
                    }${
                      site.logo
                        ? `<img class="shop-logo" src="${esc(site.logo)}" alt="شعار ${esc(site.nameAr || p.name)}" loading="lazy" />`
                        : ''
                    }</div>`
                  : `<div class="shop-card-media"><div class="media-icon"><i class="fas ${esc(p.icon || 'fa-cube')}"></i></div></div>`;
              return `<article class="shop-card">
                ${media}
                <div class="shop-card-body">
                  <h3>${esc(p.name)}</h3>
                  <div class="shop-card-meta">${esc(p.productType || p.itemKind || 'رقمية')} · ${esc(p.category)}${p.subcategory ? ` / ${esc(p.subcategory)}` : ''} · ${esc(p.brand || '')}</div>
                  <div class="shop-card-price">${money(p.price)}</div>
                  <div class="shop-card-meta" style="margin-top:4px">${esc(p.status || 'متوفر')}${site ? ` · موقع: ${esc(site.nameAr)}` : ''}</div>
                  ${metaLine(p)}
                  <div class="shop-card-actions">
                    <button type="button" class="primary" data-cart-product="${esc(p.id || p.sku)}"><i class="fas fa-basket-shopping"></i> أضف للسلة</button>
                    <a class="primary" href="${esc(buyUrl)}"><i class="fas fa-cart-shopping"></i> اشتري</a>
                    <a href="${esc(openUrl)}" ${
                      isLiveLaunch(site?.launchCode)
                        ? `data-launch-code="${esc(site.launchCode)}" data-launch-mode="hub" target="_blank" rel="noopener"`
                        : ''
                    }><i class="fas fa-arrow-up-left"></i> ادخل الموقع</a>
                  </div>
                  ${actions('products', p.id)}
                </div>
              </article>`;
            })
            .join('')
        : `<div class="shop-empty">لا توجد منتجات في هذا التصنيف</div>`;
    };

    const setCategory = (id, { scroll = false } = {}) => {
      active = id || 'الكل';
      paintChrome();
      paint();
      if (scroll) {
        scrollToResults(document.getElementById('shop-results') || document.querySelector('.shop-content') || grid);
      }
    };

    strip?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat]');
      if (!btn) return;
      setCategory(btn.dataset.cat, { scroll: true });
    });

    side?.addEventListener('change', (e) => {
      const input = e.target.closest('input[name="shop-cat"]');
      if (!input) return;
      setCategory(input.value, { scroll: true });
    });

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      paint();
      scrollToResults(document.getElementById('shop-results') || grid);
    });
    searchInput?.addEventListener('input', paint);

    viewGrid?.addEventListener('click', () => {
      view = 'grid';
      viewGrid.classList.add('is-active');
      viewList?.classList.remove('is-active');
      paint();
    });
    viewList?.addEventListener('click', () => {
      view = 'list';
      viewList.classList.add('is-active');
      viewGrid?.classList.remove('is-active');
      paint();
    });

    grid.addEventListener('click', (e) => {
      const cartBtn = e.target.closest('[data-cart-product]');
      if (cartBtn && window.HubCart?.add) {
        const key = cartBtn.dataset.cartProduct;
        const p = products.find((x) => String(x.id) === key || String(x.sku) === key);
        if (p) {
          window.HubCart.add({
            id: p.id || p.sku,
            title: p.name,
            price: p.price,
            points: p.points || 0,
            platformCode: p.platformCode || '',
          });
          toast(`أُضيف للسلة: ${p.name}`);
        }
        return;
      }
      const launch = e.target.closest('[data-launch-code]');
      if (!launch || !window.HubLauncher?.launch) return;
      e.preventDefault();
      window.HubLauncher.launch(launch.dataset.launchCode, { mode: 'hub' });
    });

    fillSectors();
    wireBack();
    paintChrome();
    paint();
  };

  if (page === 'apps') renderApps();
  if (page === 'store') renderStore();
  if (page === 'ads') renderAds();
  if (page === 'events') renderEvents();
  if (page === 'products') renderProducts();

  // من المنتجات: store.html?buy=SKU → تمييز العنصر ومسار الشراء الواضح
  if (page === 'store') {
    const params = new URLSearchParams(window.location.search);
    const buyKey = params.get('buy');
    if (buyKey) {
      const items = store?.get?.().empire?.salesStore?.items || data.STORE_ITEMS || [];
      const match = items.find(
        (i) =>
          String(i.id) === buyKey ||
          String(i.sku || '') === buyKey ||
          String(i.title || '').includes(buyKey)
      );
      if (match) {
        setTimeout(() => {
          const cardBtn = document.querySelector(`[data-buy="${match.id}"]`);
          cardBtn?.closest('.market-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (cardBtn) cardBtn.style.boxShadow = '0 0 0 3px #dc2626';
          toast(`جاهز للشراء: ${match.title} — اضغط «اشترِ الآن» ثم ادخل موقعك`);
        }, 450);
      }
    }
  }
})();
