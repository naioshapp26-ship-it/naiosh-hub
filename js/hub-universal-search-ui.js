/**
 * UI: محرك البحث الشامل + كلمات البداية (Intent Starters)
 * الصفحة الكاملة: search.html — الزر في الهيرو يفتح الصفحة وليس نافذة.
 */
(() => {
  'use strict';

  const searchApi = window.HubUniversalSearch;
  const intentsApi = window.HubSearchIntents;
  if (!searchApi) return;

  const esc = searchApi.esc;
  const SEARCH_PAGE = 'search.html';
  let filter = 'all';
  let activeIntentId = null;

  const pageRoot = () => document.querySelector('[data-hus-page]');
  const isSearchPage = () => !!pageRoot();

  const shellMarkup = ({ pageMode }) => `
    <header class="hus-head">
      <div>
        <h1 id="hus-title" class="hus-title"><i class="fas fa-magnifying-glass"></i> محرك البحث الشامل</h1>
        <p>NAIOSH SMART SEARCH · كلمات البداية تفهم النية وتوجّه المحركات</p>
      </div>
      ${
        pageMode
          ? `<a class="hus-back" href="index.html" aria-label="العودة للرئيسية"><i class="fas fa-house"></i> الرئيسية</a>`
          : `<button type="button" class="hus-close" data-hus-close aria-label="إغلاق"><i class="fas fa-xmark"></i></button>`
      }
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
        <button type="button" data-hus-filter="knowledge">مركز المعلومات</button>
        <button type="button" data-hus-filter="content">محتوى</button>
        <button type="button" data-hus-filter="image">صور</button>
        <button type="button" data-hus-filter="file">ملفات</button>
        <button type="button" data-hus-filter="video">فيديو</button>
      </div>
    </div>
    <div class="hus-section-head" data-hus-section-head hidden></div>
    <div class="hus-results" data-hus-results></div>
    <footer class="hus-foot">
      <a href="info-center.html"><i class="fas fa-circle-info"></i> مركز المعلومات</a>
      <a href="side-projects.html#sp-client-intro"><i class="fas fa-lightbulb"></i> المشاريع الجانبية</a>
      <a href="search-admin.html"><i class="fas fa-sliders"></i> إدارة محتوى البحث (أدمن)</a>
      <a href="search-content.html" data-hus-library-link><i class="fas fa-folder-open"></i> صفحات التصنيفات</a>
    </footer>`;

  const ensureShell = () => {
    const page = pageRoot();
    if (page) {
      if (!page.dataset.husReady) {
        page.innerHTML = shellMarkup({ pageMode: true });
        page.dataset.husReady = '1';
      }
      return page;
    }
    return null;
  };

  const typeBadge = (type) => {
    if (type === 'incubator') return 'حاضنة';
    if (type === 'platform') return 'منصة';
    if (type === 'branch') return 'فرع';
    if (type === 'subdomain') return 'دومين فرعي';
    if (type === 'content') return 'محتوى';
    if (type === 'knowledge') return 'مركز المعلومات';
    if (type === 'image') return 'صورة';
    if (type === 'file') return 'ملف';
    if (type === 'video') return 'فيديو';
    return 'نظام';
  };

  const renderStats = (root) => {
    const s = searchApi.stats();
    const el = root.querySelector('[data-hus-stats]');
    if (!el) return;
    el.innerHTML = `
      <article><strong>${s.all}</strong><span>إجمالي</span></article>
      <article><strong>${s.branch || 0}</strong><span>فرع</span></article>
      <article><strong>${s.incubator}</strong><span>حاضنة</span></article>
      <article><strong>${s.platform}</strong><span>منصة</span></article>
      <article><strong>${s.system}</strong><span>نظام</span></article>
      <article><strong>${s.knowledge || 0}</strong><span>مركز معلومات</span></article>
      <article><strong>${s.intents || 0}</strong><span>نية بحث</span></article>`;
  };

  const renderStarters = (root) => {
    const box = root.querySelector('[data-hus-starters]');
    if (!box || !intentsApi?.PRIMARY_STARTERS) return;
    box.innerHTML = intentsApi.PRIMARY_STARTERS.map(
      (s) => `<button type="button" class="hus-starter${activeIntentId === s.intentId ? ' is-active' : ''}" data-hus-intent="${esc(s.intentId)}" data-hus-starter="${esc(s.starter)}">
        <i class="fas ${esc(s.icon)}" aria-hidden="true"></i>
        <span>${esc(s.label)}</span>
      </button>`
    ).join('');
  };

  const renderIntentBar = (root, intent) => {
    const bar = root.querySelector('[data-hus-intent-bar]');
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

  const renderFollowUps = (root, followUps, baseQuery) => {
    const box = root.querySelector('[data-hus-followups]');
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

  const renderSuggest = (root) => {
    const box = root.querySelector('[data-hus-suggest]');
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
                      : list.type === 'knowledge'
                        ? s.knowledge
                        : 0;
            return `<button type="button" class="hus-suggest-card${filter === list.type ? ' is-active' : ''}" data-hus-suggest-type="${esc(list.type)}">
              <span class="hus-suggest-ico" aria-hidden="true"><i class="fas ${esc(list.icon)}"></i></span>
              <span class="hus-suggest-copy">
                <strong>${esc(list.label)}</strong>
                <small>${esc(list.lead)}</small>
              </span>
              <em>${Number(count || 0).toLocaleString('en-US')}</em>
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
    if (type === 'knowledge')
      return {
        pageTitle: 'مركز المعلومات',
        pageLead: 'جميع صفحات مركز المعرفة تظهر في محرك البحث',
        icon: 'fa-circle-info',
      };
    return { pageTitle: typeBadge(type), pageLead: '', icon: 'fa-folder' };
  };

  const renderSectionHead = (root) => {
    const head = root.querySelector('[data-hus-section-head]');
    const lib = root.querySelector('[data-hus-library-link]');
    if (!head) return;
    const meta = sectionLabel(filter);
    if (filter === 'all') {
      head.hidden = true;
      head.innerHTML = '';
      if (lib) lib.href = 'search-content.html';
      return;
    }
    head.hidden = false;
    const libraryHref =
      filter === 'knowledge' ? 'info-center.html' : `search-content.html?type=${encodeURIComponent(filter)}`;
    head.innerHTML = `
      <div>
        <strong><i class="fas ${esc(meta.icon || 'fa-folder')}"></i> ${esc(meta.pageTitle)}</strong>
        <span>${esc(meta.pageLead || `نتائج تصنيف ${meta.pageTitle}`)}</span>
      </div>
      <a href="${esc(libraryHref)}">${filter === 'knowledge' ? 'فتح مركز المعلومات' : `فتح صفحة ${esc(meta.pageTitle)}`}</a>`;
    if (lib) lib.href = libraryHref;
  };

  const runSearch = (root, query) => {
    const orchestrate =
      searchApi.searchOrchestrated || ((q, t) => ({ results: searchApi.search(q, t), intent: null, followUps: [], query: q }));
    return orchestrate(query, filter, { intentId: activeIntentId || undefined });
  };

  const renderResults = (root, query) => {
    renderSectionHead(root);
    renderStarters(root);
    renderSuggest(root);
    const pack = runSearch(root, query);
    if (!activeIntentId && pack.intent) activeIntentId = pack.intent.id;
    renderIntentBar(root, pack.intent || (activeIntentId && intentsApi?.byId?.(activeIntentId)));
    renderFollowUps(root, pack.followUps, pack.query || query);

    const list = pack.results || [];
    const box = root.querySelector('[data-hus-results]');
    if (!box) return;
    if (!list.length) {
        const emptyMsg =
        filter === 'subdomain'
          ? 'لا دومينات فرعية ممنوحة بعد — امنح دومينًا من تشغيل الأنظمة.'
          : filter === 'knowledge'
            ? 'لا صفحات لمركز المعلومات في النتائج. افتح مركز المعرفة من الرابط أعلاه.'
          : `لا نتائج في «${esc(sectionLabel(filter).pageTitle)}». جرّب كلمة بداية أو اكتب سؤالك بحرية.`;
      box.innerHTML = `<p class="hus-empty">${emptyMsg}</p>`;
      return;
    }
    box.innerHTML = list
      .slice(0, 200)
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

  const applyFilter = (root, nextFilter) => {
    filter = nextFilter || 'all';
    root.querySelectorAll('[data-hus-filter]').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-hus-filter') === filter);
    });
    renderResults(root, root.querySelector('[data-hus-input]')?.value || '');
  };

  const applyIntent = (root, intentId, starterText) => {
    activeIntentId = intentId || null;
    const input = root.querySelector('[data-hus-input]');
    const intent = intentsApi?.byId?.(intentId);
    if (input && starterText != null) {
      if (!input.value || intent?.starters?.some((s) => input.value.startsWith(s))) {
        input.value = starterText;
      } else if (!input.value.includes(starterText)) {
        input.value = starterText;
      }
    }
    filter = 'all';
    root.querySelectorAll('[data-hus-filter]').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-hus-filter') === 'all');
    });
    renderResults(root, input?.value || starterText || '');
    input?.focus();
  };

  const wireShell = (root) => {
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-hus-clear-intent]')) {
        activeIntentId = null;
        renderResults(root, root.querySelector('[data-hus-input]')?.value || '');
        return;
      }
      const filterBtn = e.target.closest('[data-hus-filter]');
      if (filterBtn) {
        applyFilter(root, filterBtn.getAttribute('data-hus-filter') || 'all');
        return;
      }
      const suggestBtn = e.target.closest('[data-hus-suggest-type]');
      if (suggestBtn) {
        activeIntentId = null;
        applyFilter(root, suggestBtn.getAttribute('data-hus-suggest-type') || 'all');
        root.querySelector('[data-hus-input]')?.focus();
        return;
      }
      const starterBtn = e.target.closest('[data-hus-intent]');
      if (starterBtn) {
        applyIntent(root, starterBtn.getAttribute('data-hus-intent'), starterBtn.getAttribute('data-hus-starter') || '');
        return;
      }
      const followBtn = e.target.closest('[data-hus-follow-append]');
      if (followBtn) {
        const append = followBtn.getAttribute('data-hus-follow-append') || '';
        const nextIntent = followBtn.getAttribute('data-hus-follow-intent') || activeIntentId;
        const input = root.querySelector('[data-hus-input]');
        const base = (input?.value || root.querySelector('[data-hus-followups]')?.dataset.baseQuery || '').trim();
        const nextQ = `${base} ${append}`.replace(/\s+/g, ' ').trim();
        if (input) input.value = nextQ;
        activeIntentId = nextIntent;
        renderResults(root, nextQ);
      }
    });
    root.querySelector('[data-hus-input]')?.addEventListener('input', (e) => {
      const val = e.target.value || '';
      const detected = intentsApi?.detectIntent?.(val);
      if (!val.trim()) activeIntentId = null;
      else if (detected) activeIntentId = detected.id;
      renderResults(root, val);
    });
  };

  const searchUrl = (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') qs.set(k, v);
    });
    const q = qs.toString();
    return q ? `${SEARCH_PAGE}?${q}` : SEARCH_PAGE;
  };

  const upgradeFloatCard = () => {
    const card = document.getElementById('hero-float-card');
    if (!card) return;

    const href = searchUrl();
    const html = `
      <div class="hero-float-icon" aria-hidden="true"><i class="fas fa-magnifying-glass"></i></div>
      <div class="hero-float-body">
        <strong class="hero-float-title">محرك البحث الشامل</strong>
        <span class="hero-float-desc">افتح الصفحة الكاملة · نية ذكية</span>
      </div>`;

    if (card.tagName === 'A') {
      card.classList.add('is-search-trigger');
      card.href = href;
      card.setAttribute('aria-label', 'محرك البحث الشامل — صفحة كاملة');
      card.innerHTML = html;
      return;
    }

    const link = document.createElement('a');
    link.id = card.id;
    link.className = `${card.className} is-search-trigger`.trim();
    link.href = href;
    link.setAttribute('aria-label', 'محرك البحث الشامل — صفحة كاملة');
    link.innerHTML = html;
    card.replaceWith(link);
  };

  const redirectLegacyHash = () => {
    const hash = location.hash || '';
    if (!hash.startsWith('#open-search')) return false;
    const qs = hash.includes('?') ? new URLSearchParams(hash.split('?')[1]) : new URLSearchParams();
    const intent = qs.get('intent');
    location.replace(searchUrl(intent ? { intent } : {}));
    return true;
  };

  const bootPage = () => {
    const root = ensureShell();
    if (!root) return;
    wireShell(root);
    renderStats(root);

    const params = new URLSearchParams(location.search);
    const intent = params.get('intent');
    const q = params.get('q') || '';
    if (intent) {
      const meta = intentsApi?.byId?.(intent);
      applyIntent(root, intent, meta?.starters?.[0] || q || '');
    } else {
      const input = root.querySelector('[data-hus-input]');
      if (input && q) input.value = q;
      renderResults(root, q);
    }
    setTimeout(() => root.querySelector('[data-hus-input]')?.focus(), 50);
  };

  const init = async () => {
    try {
      await window.HubSearchCatalog?.pullRemote?.();
    } catch {
      /* offline / no API */
    }

    if (isSearchPage()) {
      bootPage();
      return;
    }

    if (redirectLegacyHash()) return;
    upgradeFloatCard();
    window.addEventListener('hashchange', () => {
      redirectLegacyHash();
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
