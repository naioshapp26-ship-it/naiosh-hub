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

  const renderApps = () => {
    const apps = store?.get?.().empire?.apps || data.APPS.map((a) => ({ ...a, id: a.code }));
    const root = document.getElementById('market-grid');
    const tabs = document.getElementById('market-tabs');
    if (!root) return;
    const cats = ['الكل', ...Array.from(new Set(apps.map((a) => a.category)))];
    let active = 'الكل';

    const paint = () => {
      const list = (active === 'الكل' ? apps : apps.filter((a) => a.category === active)).filter(
        (a) => a.status !== 'archived'
      );
      root.innerHTML = list
        .map(
          (a) => `<article class="market-card" id="${esc((a.code || '').toLowerCase())}">
            <div class="card-icon"><i class="fas ${esc(a.icon || 'fa-cube')}"></i></div>
            <span class="badge-soft">${esc(a.category)}</span>
            <h3>${esc(a.nameAr)}</h3>
            <p>أي نظام نايوش يمكنه الظهور هنا والارتباط بهوب للتشغيل الموحد.</p>
            <div class="meta">${a.status === 'active' ? 'متاح الآن' : 'قيد التجهيز'}${a.health ? ` · صحة ${a.health}%` : ''}${a.assignee ? ` · معيّن: ${esc(a.assignee)}` : ''}</div>
            <div class="card-actions">
              <a class="btn-mini primary" href="${esc(a.url || 'apps.html')}"><i class="fas fa-arrow-left"></i> فتح</a>
            </div>
            ${actions('apps', a.id || a.code)}
          </article>`
        )
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
      };
    }
    setStat('stat-apps', apps.length);
    setStat('stat-active', apps.filter((a) => a.status === 'active').length);
    paint();
  };

  const renderStore = () => {
    const items = store?.get?.().empire?.salesStore?.items || data.STORE_ITEMS;
    const root = document.getElementById('market-grid');
    const tabs = document.getElementById('market-tabs');
    if (!root) return;
    let active = 'الكل';
    const cats = data.STORE_CATEGORIES;

    const paint = () => {
      const list = (active === 'الكل' ? items : items.filter((i) => i.category === active)).filter(
        (i) => i.status !== 'archived'
      );
      root.innerHTML = list
        .map(
          (i) => `<article class="market-card">
            <span class="badge-soft">${esc(i.badge || i.category)}</span>
            <h3>${esc(i.title)}</h3>
            <p>${esc(i.desc)}</p>
            <div class="price">${Number(i.price).toLocaleString('ar-EG')} ر.س</div>
            <div class="meta">نقاط: ${i.points} · مخزون: ${i.stock} · منصة: ${esc(i.platformCode || '—')}${i.assignee ? ` · معيّن: ${esc(i.assignee)}` : ''}</div>
            <div class="card-actions">
              <button type="button" class="btn-mini primary" data-buy="${esc(i.id)}"><i class="fas fa-cart-plus"></i> اشترِ الآن</button>
              <a class="btn-mini" href="ads.html"><i class="fas fa-rectangle-ad"></i> إعلان المنتج</a>
            </div>
            ${actions('store', i.id)}
          </article>`
        )
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
      };
    }

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-buy]');
      if (!btn || !store?.placeStoreOrder) return;
      const order = store.placeStoreOrder(btn.dataset.buy, 'زائر المتجر');
      if (!order) return toast('تعذّر إتمام الطلب');
      toast(`تم الشراء: ${order.title}`);
      paint();
      setStat('stat-orders', store.get().empire.salesStore.orders.length);
      setStat('stat-items', store.get().empire.salesStore.items.length);
    });

    setStat('stat-items', items.length);
    setStat('stat-orders', store?.get?.().empire?.salesStore?.orders?.length || 0);
    paint();
  };

  const renderAds = () => {
    const scopeTitles = {
      branches: 'اعلانات الفروع',
      incubators: 'اعلانات الحاضنات',
      platforms: 'اعلانات المنصات',
    };
    const scopeParam = new URLSearchParams(window.location.search).get('scope') || '';
    const allListings = (store?.get?.().empire?.adsStudio?.listings || data.ADS).filter((a) => a.status === 'active');
    const listings = scopeParam
      ? allListings.filter((a) => (a.scope || 'platforms') === scopeParam)
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
      heroDesc.textContent = `عرض إعلانات ${scopeTitles[scopeParam].replace('اعلانات ', '')} داخل هوب — مرتبطة بالتشغيل والمبيعات والظهور الموحّد.`;
    }

    const paint = () => {
      const list = active === 'all' ? listings : listings.filter((a) => a.category === active);
      root.innerHTML = list.length
        ? list
            .map(
              (a) => `<article class="ads-item-card">
            <div class="ads-item-media">
              <i class="fas fa-rectangle-ad" style="font-size:28px"></i>
              <span>${esc(a.type || 'إعلان')}</span>
              <small>${esc(a.platformCode || '')}</small>
            </div>
            <div class="ads-item-body">
              <p class="ads-price">${Number(a.price || 0).toLocaleString('ar-EG')} ر.س</p>
              <h3 class="ads-item-title">${esc(a.title)}</h3>
              <p class="ads-meta">${esc(a.content)}</p>
              <p class="ads-meta" style="margin-top:8px">${Number(a.views || 0).toLocaleString('ar-EG')} مشاهدة · ${esc(a.category)}</p>
              <div style="margin-top:10px">
                <a class="btn-mini primary" href="products.html">عرض المنتجات</a>
                <a class="btn-mini" href="store.html">المتجر</a>
              </div>
              ${actions('ads', a.id)}
            </div>
          </article>`
            )
            .join('')
        : `<div class="shop-empty" style="grid-column:1/-1">لا توجد إعلانات في هذا النطاق حاليًا.</div>`;
    };

    if (catsRoot) {
      catsRoot.innerHTML = data.AD_CATEGORIES.map(
        (c) => `<button type="button" class="market-card" data-cat="${esc(c.id)}" style="cursor:pointer;text-align:center">
          <div class="card-icon" style="margin:0 auto"><i class="fas ${esc(c.icon)}"></i></div>
          <h3>${esc(c.name)}</h3>
        </button>`
      ).join('');
      catsRoot.className = 'ads-cats-grid';
      catsRoot.onclick = (e) => {
        const btn = e.target.closest('[data-cat]');
        if (!btn) return;
        active = btn.dataset.cat;
        paint();
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
    const products = store?.get?.().empire?.productCatalog || data?.PRODUCT_CATALOG || [];
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
            .map(
              (p) => `<article class="shop-card">
                <div class="shop-card-media"><div class="media-icon"><i class="fas ${esc(p.icon || 'fa-cube')}"></i></div></div>
                <div class="shop-card-body">
                  <h3>${esc(p.name)}</h3>
                  <div class="shop-card-meta">${esc(p.brand)} · ${esc(p.category)}</div>
                  <div class="shop-card-price">${Number(p.price).toLocaleString('ar-EG')} ر.س</div>
                  <div class="shop-card-actions">
                    <a class="primary" href="store.html">شراء</a>
                    <a href="ads.html">إعلان</a>
                  </div>
                  ${actions('products', p.id)}
                </div>
              </article>`
            )
            .join('')
        : `<div class="shop-empty">لا توجد منتجات في هذا التصنيف</div>`;
    };

    const setCategory = (id) => {
      active = id || 'الكل';
      paintChrome();
      paint();
    };

    strip?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat]');
      if (!btn) return;
      setCategory(btn.dataset.cat);
    });

    side?.addEventListener('change', (e) => {
      const input = e.target.closest('input[name="shop-cat"]');
      if (!input) return;
      setCategory(input.value);
    });

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      paint();
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

    paintChrome();
    paint();
  };

  if (page === 'apps') renderApps();
  if (page === 'store') renderStore();
  if (page === 'ads') renderAds();
  if (page === 'events') renderEvents();
  if (page === 'products') renderProducts();
})();
