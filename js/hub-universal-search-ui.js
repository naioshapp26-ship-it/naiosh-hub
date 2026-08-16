/**
 * UI: محرك البحث الشامل + كلمات البداية (Intent Starters)
 * كل بداية = Intent ID تشغيلي يوجّه النتائج.
 */
(() => {
  'use strict';

  const searchApi = window.HubUniversalSearch;
  const intentsApi = window.HubSearchIntents;
  if (!searchApi) return;

  const esc = searchApi.esc;
  let filter = 'all';
  let open = false;
  let activeIntentId = null;

  const ensureModal = () => {
    let modal = document.getElementById('hub-universal-search-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'hub-universal-search-modal';
    modal.className = 'hus-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="hus-backdrop" data-hus-close tabindex="-1"></div>
      <div class="hus-panel" role="dialog" aria-modal="true" aria-labelledby="hus-title">
        <header class="hus-head">
          <div>
            <h2 id="hus-title"><i class="fas fa-magnifying-glass"></i> محرك البحث الشامل</h2>
            <p>NAIOSH SMART SEARCH · كلمات البداية تفهم النية وتوجّه المحركات</p>
          </div>
          <button type="button" class="hus-close" data-hus-close aria-label="إغلاق"><i class="fas fa-xmark"></i></button>
        </header>
        <div class="hus-stats" data-hus-stats></div>
        <div class="hus-toolbar">
          <p class="hus-ask-label"><i class="fas fa-comments"></i> ماذا تبحث اليوم؟</p>
          <div class="hus-starters" data-hus-starters aria-label="كلمات البداية الذكية"></div>
          <label class="hus-input-wrap">
            <i class="fas fa-magnifying-glass"></i>
            <input type="search" data-hus-input placeholder="اكتب ما تفكر فيه… وسيساعدك NAIOSH HUB في تحديد ما تبحث عنه" autocomplete="off" />
          </label>
          <div class="hus-intent-bar" data-hus-intent-bar hidden></div>
          <div class="hus-followups" data-hus-followups hidden></div>
          <div class="hus-suggest" data-hus-suggest aria-label="قوائم مقترحة"></div>
          <div class="hus-filters" role="tablist" aria-label="تصفية النوع">
            <button type="button" class="is-active" data-hus-filter="all">الكل</button>
            <button type="button" data-hus-filter="branch">فروع</button>
            <button type="button" data-hus-filter="incubator">حاضنات</button>
            <button type="button" data-hus-filter="platform">منصات</button>
            <button type="button" data-hus-filter="subdomain">دومينات فرعية</button>
            <button type="button" data-hus-filter="system">أنظمة</button>
            <button type="button" data-hus-filter="content">محتوى</button>
            <button type="button" data-hus-filter="image">صور</button>
            <button type="button" data-hus-filter="file">ملفات</button>
            <button type="button" data-hus-filter="video">فيديو</button>
          </div>
        </div>
        <div class="hus-section-head" data-hus-section-head hidden></div>
        <div class="hus-results" data-hus-results></div>
        <footer class="hus-foot">
          <a href="side-projects.html#sp-client-intro"><i class="fas fa-lightbulb"></i> المشاريع الجانبية</a>
          <a href="search-admin.html"><i class="fas fa-sliders"></i> إدارة محتوى البحث (أدمن)</a>
          <a href="search-content.html" data-hus-library-link><i class="fas fa-folder-open"></i> صفحات التصنيفات</a>
        </footer>
      </div>`;
    document.body.appendChild(modal);
    return modal;
  };

  const typeBadge = (type) => {
    if (type === 'incubator') return 'حاضنة';
    if (type === 'platform') return 'منصة';
    if (type === 'branch') return 'فرع';
    if (type === 'subdomain') return 'دومين فرعي';
    if (type === 'content') return 'محتوى';
    if (type === 'image') return 'صورة';
    if (type === 'file') return 'ملف';
    if (type === 'video') return 'فيديو';
    return 'نظام';
  };

  const renderStats = (modal) => {
    const s = searchApi.stats();
    const el = modal.querySelector('[data-hus-stats]');
    if (!el) return;
    el.innerHTML = `
      <article><strong>${s.all}</strong><span>إجمالي</span></article>
      <article><strong>${s.branch || 0}</strong><span>فرع</span></article>
      <article><strong>${s.incubator}</strong><span>حاضنة</span></article>
      <article><strong>${s.platform}</strong><span>منصة</span></article>
      <article><strong>${s.system}</strong><span>نظام</span></article>
      <article><strong>${s.intents || 0}</strong><span>نية بحث</span></article>`;
  };

  const renderStarters = (modal) => {
    const box = modal.querySelector('[data-hus-starters]');
    if (!box || !intentsApi?.PRIMARY_STARTERS) return;
    box.innerHTML = intentsApi.PRIMARY_STARTERS.map(
      (s) => `<button type="button" class="hus-starter${activeIntentId === s.intentId ? ' is-active' : ''}" data-hus-intent="${esc(s.intentId)}" data-hus-starter="${esc(s.starter)}">
        <i class="fas ${esc(s.icon)}" aria-hidden="true"></i>
        <span>${esc(s.label)}</span>
      </button>`
    ).join('');
  };

  const renderIntentBar = (modal, intent) => {
    const bar = modal.querySelector('[data-hus-intent-bar]');
    if (!bar) return;
    if (!intent) {
      bar.hidden = true;
      bar.innerHTML = '';
      return;
    }
    bar.hidden = false;
    bar.innerHTML = `
      <div class="hus-intent-chip">
        <strong><i class="fas fa-bullseye"></i> ${esc(intent.label)}</strong>
        <code>${esc(intent.id)}</code>
        <span>${esc(intent.explain || '')}</span>
      </div>
      <button type="button" class="hus-intent-clear" data-hus-clear-intent>مسح النية</button>`;
  };

  const renderFollowUps = (modal, followUps, baseQuery) => {
    const box = modal.querySelector('[data-hus-followups]');
    if (!box) return;
    if (!followUps?.length) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    box.innerHTML = `
      <p class="hus-followups-label"><i class="fas fa-sitemap"></i> حدّد أكثر (بحث متعدد المراحل)</p>
      <div class="hus-followups-grid">
        ${followUps
          .map(
            (f) =>
              `<button type="button" class="hus-followup" data-hus-follow-intent="${esc(f.intentId || '')}" data-hus-follow-append="${esc(f.append || '')}">${esc(f.label)}</button>`
          )
          .join('')}
      </div>`;
    box.dataset.baseQuery = baseQuery || '';
  };

  const renderSuggest = (modal) => {
    const box = modal.querySelector('[data-hus-suggest]');
    if (!box) return;
    const lists = searchApi.suggestedLists || [];
    const s = searchApi.stats();
    box.innerHTML = `
      <p class="hus-suggest-label"><i class="fas fa-list-ul"></i> قوائم سريعة</p>
      <div class="hus-suggest-grid">
        ${lists
          .map((list) => {
            const count =
              list.type === 'branch'
                ? s.branch
                : list.type === 'incubator'
                  ? s.incubator
                  : list.type === 'platform'
                    ? s.platform
                    : list.type === 'subdomain'
                      ? s.subdomain
                      : 0;
            return `<button type="button" class="hus-suggest-card${filter === list.type ? ' is-active' : ''}" data-hus-suggest-type="${esc(list.type)}">
              <span class="hus-suggest-ico" aria-hidden="true"><i class="fas ${esc(list.icon)}"></i></span>
              <span class="hus-suggest-copy">
                <strong>${esc(list.label)}</strong>
                <small>${esc(list.lead)}</small>
              </span>
              <em>${Number(count || 0).toLocaleString('ar-EG')}</em>
            </button>`;
          })
          .join('')}
      </div>`;
  };

  const mediaThumb = (item) => {
    if (item.preview && (item.type === 'image' || String(item.mediaMime || '').startsWith('image/'))) {
      return `<span class="hus-item-thumb"><img src="${esc(item.preview)}" alt="" /></span>`;
    }
    return `<span class="hus-item-ico"><i class="fas ${esc(item.icon)}"></i></span>`;
  };

  const sectionLabel = (type) => {
    const map = window.HubSearchCatalog?.SECTION_META || {};
    if (map[type]?.pageTitle) return map[type];
    if (type === 'all') return { pageTitle: 'الكل', pageLead: 'كل نتائج محرك البحث', icon: 'fa-border-all' };
    if (type === 'branch') return { pageTitle: 'الفروع', pageLead: 'جميع الفروع مع رقم الفرع', icon: 'fa-code-branch' };
    if (type === 'incubator')
      return { pageTitle: 'الحاضنات', pageLead: 'جميع الحاضنات مع معرف رقم الحاضنة', icon: 'fa-seedling' };
    if (type === 'platform') return { pageTitle: 'المنصات', pageLead: 'جميع المنصات مع رقم المنصة', icon: 'fa-layer-group' };
    if (type === 'subdomain')
      return { pageTitle: 'الدومينات الفرعية', pageLead: 'كل دومين فرعي ممنوح مع رقمه', icon: 'fa-globe' };
    return { pageTitle: typeBadge(type), pageLead: '', icon: 'fa-folder' };
  };

  const renderSectionHead = (modal) => {
    const head = modal.querySelector('[data-hus-section-head]');
    const lib = modal.querySelector('[data-hus-library-link]');
    if (!head) return;
    const meta = sectionLabel(filter);
    if (filter === 'all') {
      head.hidden = true;
      head.innerHTML = '';
      if (lib) lib.href = 'search-content.html';
      return;
    }
    head.hidden = false;
    head.innerHTML = `
      <div>
        <strong><i class="fas ${esc(meta.icon || 'fa-folder')}"></i> ${esc(meta.pageTitle)}</strong>
        <span>${esc(meta.pageLead || `نتائج تصنيف ${meta.pageTitle}`)}</span>
      </div>
      <a href="search-content.html?type=${encodeURIComponent(filter)}">فتح صفحة ${esc(meta.pageTitle)}</a>`;
    if (lib) lib.href = `search-content.html?type=${encodeURIComponent(filter)}`;
  };

  const runSearch = (modal, query) => {
    const orchestrate = searchApi.searchOrchestrated || ((q, t, o) => ({ results: searchApi.search(q, t), intent: null, followUps: [], query: q }));
    return orchestrate(query, filter, { intentId: activeIntentId || undefined });
  };

  const renderResults = (modal, query) => {
    renderSectionHead(modal);
    renderStarters(modal);
    renderSuggest(modal);
    const pack = runSearch(modal, query);
    if (!activeIntentId && pack.intent) activeIntentId = pack.intent.id;
    renderIntentBar(modal, pack.intent || (activeIntentId && intentsApi?.byId?.(activeIntentId)));
    renderFollowUps(modal, pack.followUps, pack.query || query);

    const list = pack.results || [];
    const box = modal.querySelector('[data-hus-results]');
    if (!box) return;
    if (!list.length) {
      const emptyMsg =
        filter === 'subdomain'
          ? 'لا دومينات فرعية ممنوحة بعد — امنح دومينًا من تشغيل الأنظمة.'
          : `لا نتائج في «${esc(sectionLabel(filter).pageTitle)}». جرّب كلمة بداية أو اكتب سؤالك بحرية.`;
      box.innerHTML = `<p class="hus-empty">${emptyMsg}</p>`;
      return;
    }
    box.innerHTML = list
      .slice(0, 120)
      .map((item) => {
        const why =
          item.why && item.why.length
            ? `<span class="hus-why" title="${esc(item.why.join(' · '))}"><i class="fas fa-circle-info"></i> لماذا؟</span>`
            : '';
        const score =
          item.matchScore != null
            ? `<span class="hus-match" title="NAIOSH Match Score">${esc(String(item.matchScore))}%</span>`
            : '';
        return `<a class="hus-item${item.source === 'intent-route' ? ' is-route' : ''}" href="${esc(item.href)}">
          ${mediaThumb(item)}
          <span class="hus-item-body">
            <strong>${esc(item.pageTitle || item.title)}</strong>
            <small>${esc(item.subtitle)}</small>
          </span>
          <span class="hus-item-meta">
            ${score}
            ${why}
            <em class="hus-badge hus-badge-${esc(item.type)}">${esc(item.typeAr || typeBadge(item.type))}</em>
            <code title="المعرّف">${esc(item.grantId || item.meta || '')}</code>
          </span>
        </a>`;
      })
      .join('');
  };

  const applyFilter = (modal, nextFilter) => {
    filter = nextFilter || 'all';
    modal.querySelectorAll('[data-hus-filter]').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-hus-filter') === filter);
    });
    renderResults(modal, modal.querySelector('[data-hus-input]')?.value || '');
  };

  const applyIntent = (modal, intentId, starterText) => {
    activeIntentId = intentId || null;
    const input = modal.querySelector('[data-hus-input]');
    const intent = intentsApi?.byId?.(intentId);
    if (input && starterText != null) {
      // لا تمسح نص المستخدم إن كان يكمل الجملة
      if (!input.value || intent?.starters?.some((s) => input.value.startsWith(s))) {
        input.value = starterText;
      } else if (!input.value.includes(starterText)) {
        input.value = starterText;
      }
    }
    filter = 'all';
    modal.querySelectorAll('[data-hus-filter]').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-hus-filter') === 'all');
    });
    renderResults(modal, input?.value || starterText || '');
    input?.focus();
  };

  const setOpen = (next) => {
    const modal = ensureModal();
    open = next;
    modal.hidden = !open;
    document.body.classList.toggle('hus-open', open);
    if (open) {
      renderStats(modal);
      const input = modal.querySelector('[data-hus-input]');
      renderResults(modal, input?.value || '');
      setTimeout(() => input?.focus(), 50);
    }
  };

  const wireModal = () => {
    const modal = ensureModal();
    modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-hus-close]')) setOpen(false);
      if (e.target.closest('[data-hus-clear-intent]')) {
        activeIntentId = null;
        renderResults(modal, modal.querySelector('[data-hus-input]')?.value || '');
        return;
      }
      const filterBtn = e.target.closest('[data-hus-filter]');
      if (filterBtn) {
        applyFilter(modal, filterBtn.getAttribute('data-hus-filter') || 'all');
        return;
      }
      const suggestBtn = e.target.closest('[data-hus-suggest-type]');
      if (suggestBtn) {
        activeIntentId = null;
        applyFilter(modal, suggestBtn.getAttribute('data-hus-suggest-type') || 'all');
        modal.querySelector('[data-hus-input]')?.focus();
        return;
      }
      const starterBtn = e.target.closest('[data-hus-intent]');
      if (starterBtn) {
        applyIntent(
          modal,
          starterBtn.getAttribute('data-hus-intent'),
          starterBtn.getAttribute('data-hus-starter') || ''
        );
        return;
      }
      const followBtn = e.target.closest('[data-hus-follow-append]');
      if (followBtn) {
        const append = followBtn.getAttribute('data-hus-follow-append') || '';
        const nextIntent = followBtn.getAttribute('data-hus-follow-intent') || activeIntentId;
        const input = modal.querySelector('[data-hus-input]');
        const base = (input?.value || modal.querySelector('[data-hus-followups]')?.dataset.baseQuery || '').trim();
        const nextQ = `${base} ${append}`.replace(/\s+/g, ' ').trim();
        if (input) input.value = nextQ;
        activeIntentId = nextIntent;
        renderResults(modal, nextQ);
      }
    });
    modal.querySelector('[data-hus-input]')?.addEventListener('input', (e) => {
      const val = e.target.value || '';
      const detected = intentsApi?.detectIntent?.(val);
      if (!val.trim()) activeIntentId = null;
      else if (detected) activeIntentId = detected.id;
      renderResults(modal, val);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) setOpen(false);
    });
  };

  const upgradeFloatCard = () => {
    const card = document.getElementById('hero-float-card');
    if (!card) return;

    card.classList.add('is-search-trigger');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', 'محرك البحث الشامل — كلمات بداية ذكية');
    card.innerHTML = `
      <div class="hero-float-icon" aria-hidden="true"><i class="fas fa-magnifying-glass"></i></div>
      <div class="hero-float-body">
        <strong class="hero-float-title">محرك البحث الشامل</strong>
        <span class="hero-float-desc">ماذا تبحث اليوم؟ · نية ذكية</span>
      </div>`;

    const openSearch = (e) => {
      e.preventDefault();
      setOpen(true);
    };
    card.addEventListener('click', openSearch);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') openSearch(e);
    });
  };

  const init = async () => {
    try {
      await window.HubSearchCatalog?.pullRemote?.();
    } catch {
      /* offline / no API */
    }
    wireModal();
    upgradeFloatCard();
    const openFromHash = () => {
      const hash = location.hash || '';
      if (hash.startsWith('#open-search')) {
        const params = new URLSearchParams(hash.replace(/^#open-search\/?/, '').replace(/^\?/, ''));
        // support #open-search?intent=PROJECT_SEEK
        const qs = hash.includes('?') ? new URLSearchParams(hash.split('?')[1]) : params;
        const intent = qs.get('intent');
        setOpen(true);
        if (intent) {
          const modal = ensureModal();
          const meta = intentsApi?.byId?.(intent);
          applyIntent(modal, intent, meta?.starters?.[0] || '');
        }
      }
    };
    if (location.hash.startsWith('#open-search')) setTimeout(openFromHash, 120);
    window.addEventListener('hashchange', openFromHash);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
