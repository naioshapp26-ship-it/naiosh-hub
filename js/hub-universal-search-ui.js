/**
 * UI: الزر الأبيض في الهيرو → محرك البحث الشامل
 * قوائم مقترحة: جميع الفروع · الحاضنات · المنصات · الدومينات الفرعية الممنوحة
 */
(() => {
  'use strict';

  const searchApi = window.HubUniversalSearch;
  if (!searchApi) return;

  const esc = searchApi.esc;
  let filter = 'all';
  let open = false;

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
            <p>فروع · حاضنات · منصات · دومينات فرعية · أنظمة · محتوى</p>
          </div>
          <button type="button" class="hus-close" data-hus-close aria-label="إغلاق"><i class="fas fa-xmark"></i></button>
        </header>
        <div class="hus-stats" data-hus-stats></div>
        <div class="hus-toolbar">
          <label class="hus-input-wrap">
            <i class="fas fa-magnifying-glass"></i>
            <input type="search" data-hus-input placeholder="ابحث بالاسم أو الرقم: INC-001 · PLT-003 · SD-012 · BR-005…" autocomplete="off" />
          </label>
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
      <article><strong>${s.subdomain || 0}</strong><span>دومين فرعي</span></article>
      <article><strong>${s.system}</strong><span>نظام</span></article>`;
  };

  const renderSuggest = (modal) => {
    const box = modal.querySelector('[data-hus-suggest]');
    if (!box) return;
    const lists = searchApi.suggestedLists || [];
    const s = searchApi.stats();
    box.innerHTML = `
      <p class="hus-suggest-label"><i class="fas fa-list-ul"></i> قوائم مقترحة</p>
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

  const renderResults = (modal, query) => {
    renderSectionHead(modal);
    renderSuggest(modal);
    const list = searchApi.search(query, filter);
    const box = modal.querySelector('[data-hus-results]');
    if (!box) return;
    if (!list.length) {
      const emptyMsg =
        filter === 'subdomain'
          ? 'لا دومينات فرعية ممنوحة بعد — امنح دومينًا من تشغيل الأنظمة.'
          : `لا نتائج في «${esc(sectionLabel(filter).pageTitle)}».`;
      box.innerHTML = `<p class="hus-empty">${emptyMsg}</p>`;
      return;
    }
    box.innerHTML = list
      .slice(0, 120)
      .map(
        (item) => `<a class="hus-item" href="${esc(item.href)}">
          ${mediaThumb(item)}
          <span class="hus-item-body">
            <strong>${esc(item.pageTitle || item.title)}</strong>
            <small>${esc(item.subtitle)}</small>
          </span>
          <span class="hus-item-meta">
            <em class="hus-badge hus-badge-${esc(item.type)}">${esc(item.typeAr || typeBadge(item.type))}</em>
            <code title="المعرّف الرقمي">${esc(item.grantId || item.meta || '')}</code>
          </span>
        </a>`
      )
      .join('');
  };

  const applyFilter = (modal, nextFilter) => {
    filter = nextFilter || 'all';
    modal.querySelectorAll('[data-hus-filter]').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-hus-filter') === filter);
    });
    renderResults(modal, modal.querySelector('[data-hus-input]')?.value || '');
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
      const filterBtn = e.target.closest('[data-hus-filter]');
      if (filterBtn) {
        applyFilter(modal, filterBtn.getAttribute('data-hus-filter') || 'all');
        return;
      }
      const suggestBtn = e.target.closest('[data-hus-suggest-type]');
      if (suggestBtn) {
        applyFilter(modal, suggestBtn.getAttribute('data-hus-suggest-type') || 'all');
        modal.querySelector('[data-hus-input]')?.focus();
      }
    });
    modal.querySelector('[data-hus-input]')?.addEventListener('input', (e) => {
      renderResults(modal, e.target.value || '');
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
    card.setAttribute('aria-label', 'محرك البحث الشامل — فروع وحاضنات ومنصات ودومينات');
    card.innerHTML = `
      <div class="hero-float-icon" aria-hidden="true"><i class="fas fa-magnifying-glass"></i></div>
      <div class="hero-float-body">
        <strong class="hero-float-title">محرك البحث الشامل</strong>
        <span class="hero-float-desc">فروع · حاضنات · منصات · دومينات</span>
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
    if (location.hash === '#open-search') {
      setTimeout(() => setOpen(true), 120);
    }
    window.addEventListener('hashchange', () => {
      if (location.hash === '#open-search') setOpen(true);
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
