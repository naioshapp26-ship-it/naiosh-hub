/**
 * صفحة عرض محتوى محرك البحث — تفاصيل عنصر أو مكتبة تصنيف بمسمّى واضح
 * مع بحث بالموضوع ووضع بطاقات / قائمة
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-search-content]');
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const id = params.get('id') || '';
  const type = params.get('type') || '';
  const stage = root.querySelector('[data-sc-stage]');
  const library = root.querySelector('[data-sc-library]');
  const VIEW_KEY = 'hub-search-content-view';

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const normalize = (value) =>
    String(value || '')
      .normalize('NFKD')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[إأآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  const sectionMeta = (key) =>
    window.HubSearchCatalog?.SECTION_META?.[key] || {
      typeAr: 'محتوى',
      pageTitle: 'المحتوى',
      pageLead: 'محتوى محرك البحث',
      icon: 'fa-file-lines',
    };

  const mediaMeta = (kind) => window.HubSearchCatalog?.MEDIA_META?.[kind] || { typeAr: 'محتوى', icon: 'fa-file-lines' };

  const youtubeEmbed = (url) => {
    const u = String(url || '');
    const m =
      u.match(/[?&]v=([^&]+)/) ||
      u.match(/youtu\.be\/([^?&]+)/) ||
      u.match(/youtube\.com\/embed\/([^?&]+)/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : '';
  };

  const mediaBlock = (item) => {
    const src = item.mediaDataUrl || item.mediaUrl || '';
    const mime = item.mediaMime || '';
    const embed = youtubeEmbed(item.externalUrl);
    const kind = item.kind || 'content';

    if (embed) {
      return `<div class="sc-media sc-media-video"><iframe src="${esc(embed)}" title="${esc(item.pageTitle || item.title)}" allowfullscreen loading="lazy"></iframe></div>`;
    }
    if (src && (kind === 'video' || mime.startsWith('video/'))) {
      return `<div class="sc-media sc-media-video"><video src="${esc(src)}" controls playsinline></video></div>`;
    }
    if (src && (kind === 'image' || mime.startsWith('image/') || src.startsWith('data:image'))) {
      return `<div class="sc-media sc-media-image"><img src="${esc(src)}" alt="${esc(item.pageTitle || item.title)}" /></div>`;
    }
    if (src && (kind === 'file' || mime.includes('pdf') || mime.includes('octet'))) {
      return `<div class="sc-media sc-media-file">
        <a class="btn btn-primary" href="${esc(src)}" download="${esc(item.mediaName || 'file')}" target="_blank" rel="noopener">
          <i class="fas fa-download"></i> تحميل الملف ${esc(item.mediaName || '')}
        </a>
        ${mime.includes('pdf') || src.startsWith('data:application/pdf') ? `<iframe class="sc-pdf" src="${esc(src)}" title="معاينة الملف"></iframe>` : ''}
      </div>`;
    }
    if (item.externalUrl) {
      return `<div class="sc-media sc-media-link"><a class="btn btn-secondary" href="${esc(item.externalUrl)}" target="_blank" rel="noopener"><i class="fas fa-up-right-from-square"></i> فتح الرابط الخارجي</a></div>`;
    }
    return `<div class="sc-media sc-media-empty"><i class="fas ${esc(mediaMeta(kind).icon)}"></i><p>لا توجد وسائط مرفقة — المحتوى النصي أدناه.</p></div>`;
  };

  const sectionNav = () => {
    const sections = window.HubSearchCatalog?.SECTION_META || {};
    return `<nav class="sc-type-nav" aria-label="تصنيفات المحتوى">
      <a href="search-content.html" class="${!type ? 'is-active' : ''}">الكل</a>
      ${Object.entries(sections)
        .map(
          ([key, meta]) =>
            `<a href="search-content.html?type=${encodeURIComponent(key)}" class="${type === key ? 'is-active' : ''}">${esc(meta.pageTitle)}</a>`
        )
        .join('')}
    </nav>`;
  };

  /** بوابات تفاعلية — صف هادئ منفصل عن فلاتر التصنيف حتى لا يصير زحمة */
  const PORTALS = [
    { href: 'competitions.html', label: 'مسابقات', icon: 'fa-trophy' },
    { href: 'news.html', label: 'آخر الأخبار', icon: 'fa-newspaper' },
    { href: 'publish-research.html', label: 'انشر بحثك', icon: 'fa-flask' },
    { href: 'self-assess.html', label: 'قيّم نفسك', icon: 'fa-clipboard-check' },
    { href: 'communities.html', label: 'المجتمعات', icon: 'fa-people-group' },
  ];

  const portalsNav = () => {
    const path = (location.pathname.split('/').pop() || '').toLowerCase();
    return `<nav class="sc-portals" aria-label="بوابات تفاعلية">
      <span class="sc-portals-label"><i class="fas fa-compass" aria-hidden="true"></i> استكشف</span>
      <div class="sc-portals-links">
        ${PORTALS.map((p) => {
          const active = path === p.href.toLowerCase() ? ' is-active' : '';
          return `<a class="sc-portal${active}" href="${esc(p.href)}"><i class="fas ${esc(p.icon)}" aria-hidden="true"></i>${esc(p.label)}</a>`;
        }).join('')}
      </div>
    </nav>`;
  };

  const getViewMode = () => {
    const saved = localStorage.getItem(VIEW_KEY);
    return saved === 'list' ? 'list' : 'cards';
  };

  const setViewMode = (mode) => {
    localStorage.setItem(VIEW_KEY, mode === 'list' ? 'list' : 'cards');
  };

  const itemMatches = (item, query) => {
    if (!query) return true;
    const hay = normalize(
      [item.pageTitle, item.title, item.description, item.keywords, item.mediaName, item.section, item.kind]
        .filter(Boolean)
        .join(' ')
    );
    return query.split(/\s+/).filter(Boolean).every((token) => hay.includes(token));
  };

  const cardHtml = (item) => {
    const itemSec = sectionMeta(item.section || item.kind);
    const name = item.pageTitle || item.title;
    const thumb =
      item.mediaDataUrl && (item.kind === 'image' || String(item.mediaMime || '').startsWith('image/'))
        ? `<img src="${esc(item.mediaDataUrl)}" alt="${esc(name)}" />`
        : `<span class="sc-card-ico"><i class="fas ${esc(itemSec.icon)}"></i></span>`;
    return `<a class="sc-card" href="search-content.html?id=${encodeURIComponent(item.id)}">
      <div class="sc-card-media">${thumb}</div>
      <div class="sc-card-body">
        <em>${esc(itemSec.pageTitle)}</em>
        <strong>${esc(name)}</strong>
        <small>${esc(item.description || item.title || '')}</small>
      </div>
    </a>`;
  };

  const listRowHtml = (item) => {
    const itemSec = sectionMeta(item.section || item.kind);
    const name = item.pageTitle || item.title;
    const kindLabel = mediaMeta(item.kind).typeAr;
    return `<a class="sc-list-row" href="search-content.html?id=${encodeURIComponent(item.id)}">
      <span class="sc-list-ico" aria-hidden="true"><i class="fas ${esc(itemSec.icon)}"></i></span>
      <span class="sc-list-main">
        <strong>${esc(name)}</strong>
        <small>${esc(item.description || item.title || 'اضغط لعرض المنشور')}</small>
      </span>
      <span class="sc-list-meta">
        <em>${esc(itemSec.pageTitle)}</em>
        <span>${esc(kindLabel)}</span>
      </span>
      <span class="sc-list-open" aria-hidden="true"><i class="fas fa-chevron-left"></i></span>
    </a>`;
  };

  const renderLibraryItems = (items, query, viewMode) => {
    if (!library) return;
    const filtered = items.filter((item) => itemMatches(item, query));
    const countEl = root.querySelector('[data-sc-count]');
    if (countEl) {
      countEl.textContent = query
        ? `عرض ${filtered.length} من ${items.length}`
        : `${items.length} منشور`;
    }

    if (!items.length) {
      library.innerHTML = `<p class="sc-empty">لا عناصر بعد — أضِف من <a href="search-admin.html">إدارة محرك البحث</a> واختر التصنيف المناسب.</p>`;
      return;
    }
    if (!filtered.length) {
      library.innerHTML = `<p class="sc-empty">لا نتائج لـ «${esc(query)}» — جرّب كلمة أخرى أو امسح البحث.</p>`;
      return;
    }

    if (viewMode === 'list') {
      library.innerHTML = `<div class="sc-list" role="list">${filtered.map(listRowHtml).join('')}</div>`;
      return;
    }
    library.innerHTML = `<div class="sc-grid">${filtered.map(cardHtml).join('')}</div>`;
  };

  const bindLibraryControls = (items) => {
    const searchInput = root.querySelector('[data-sc-search]');
    const clearBtn = root.querySelector('[data-sc-search-clear]');
    const viewBtns = root.querySelectorAll('[data-sc-view]');

    const refresh = () => {
      const query = normalize(searchInput?.value || '');
      const viewMode = getViewMode();
      viewBtns.forEach((btn) => {
        const active = btn.getAttribute('data-sc-view') === viewMode;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      if (clearBtn) clearBtn.hidden = !String(searchInput?.value || '').trim();
      renderLibraryItems(items, query, viewMode);
    };

    searchInput?.addEventListener('input', refresh);
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        refresh();
      }
    });
    clearBtn?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      searchInput?.focus();
      refresh();
    });
    viewBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        setViewMode(btn.getAttribute('data-sc-view') || 'cards');
        refresh();
      });
    });

    refresh();
  };

  const renderDetail = (item) => {
    const sec = sectionMeta(item.section || item.kind);
    const displayName = item.pageTitle || item.title;
    document.title = `${displayName} | ${sec.pageTitle} | نايوش هوب`;
    if (stage) {
      stage.innerHTML = `
        ${sectionNav()}
        <section class="sc-hero">
          <p class="sc-kicker"><i class="fas ${esc(sec.icon)}"></i> ${esc(sec.pageTitle)} · ${esc(sec.typeAr)}</p>
          <h1>${esc(displayName)}</h1>
          <p class="sc-lead">${esc(item.description || item.title || sec.pageLead)}</p>
          <div class="sc-chips">
            <span>${esc(sec.pageTitle)}</span>
            <span>${esc(mediaMeta(item.kind).typeAr)}</span>
            ${item.mediaName ? `<span>${esc(item.mediaName)}</span>` : ''}
            ${(item.keywords || '')
              .split(/[\s,،]+/)
              .filter(Boolean)
              .slice(0, 8)
              .map((k) => `<span>${esc(k)}</span>`)
              .join('')}
          </div>
        </section>
        ${mediaBlock(item)}
        <section class="sc-body">
          <h2>عن «${esc(displayName)}»</h2>
          <p>${esc(item.description || 'لا يوجد وصف إضافي.')}</p>
          ${item.href ? `<p><a class="btn btn-secondary" href="${esc(item.href)}"><i class="fas fa-link"></i> رابط مرتبط</a></p>` : ''}
          <div class="sc-actions">
            <a class="btn btn-primary" href="index.html#open-search"><i class="fas fa-magnifying-glass"></i> رجوع للبحث</a>
            <a class="btn btn-secondary" href="search-content.html?type=${encodeURIComponent(item.section || item.kind || 'content')}"><i class="fas fa-folder-open"></i> صفحة ${esc(sec.pageTitle)}</a>
            <a class="btn btn-secondary" href="search-admin.html"><i class="fas fa-sliders"></i> إدارة المحتوى</a>
          </div>
        </section>`;
    }
  };

  const renderLibrary = (items, sectionKey) => {
    const sec = sectionKey ? sectionMeta(sectionKey) : null;
    const title = sec ? sec.pageTitle : 'كل المحتوى المرفوع';
    const lead = sec ? sec.pageLead : 'كل العناصر المنشورة من الأدمن حسب التصنيف — ابحث أو اعرض كقائمة، ثم اضغط الموضوع لفتح المنشور.';
    document.title = `${title} | محرك البحث | نايوش هوب`;
    if (stage) {
      stage.innerHTML = `
        ${sectionNav()}
        ${portalsNav()}
        <section class="sc-hero">
          <p class="sc-kicker"><i class="fas ${esc(sec?.icon || 'fa-layer-group')}"></i> مكتبة محرك البحث</p>
          <h1>${esc(title)}</h1>
          <p class="sc-lead">${esc(lead)}</p>
        </section>
        <div class="sc-toolbar" role="search">
          <label class="sc-search">
            <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
            <input data-sc-search type="search" placeholder="ابحث عن موضوع أو وصف أو كلمة مفتاحية…" aria-label="بحث في المنشورات" autocomplete="off" />
            <button type="button" class="sc-search-clear" data-sc-search-clear hidden aria-label="مسح البحث"><i class="fas fa-xmark"></i></button>
          </label>
          <div class="sc-toolbar-side">
            <span class="sc-count" data-sc-count></span>
            <div class="sc-view-toggle" role="group" aria-label="طريقة العرض">
              <button type="button" class="sc-view-btn" data-sc-view="cards" aria-pressed="true" title="عرض بطاقات">
                <i class="fas fa-grip" aria-hidden="true"></i> بطاقات
              </button>
              <button type="button" class="sc-view-btn" data-sc-view="list" aria-pressed="false" title="عرض قائمة">
                <i class="fas fa-list-ul" aria-hidden="true"></i> قائمة
              </button>
            </div>
          </div>
        </div>`;
    }
    bindLibraryControls(items);
  };

  const boot = async () => {
    try {
      await window.HubSearchCatalog?.pullRemote?.();
    } catch {
      /* ignore */
    }
    const published = (window.HubSearchCatalog?.list?.() || []).filter((x) => x.status !== 'draft');
    if (id) {
      const item = window.HubSearchCatalog?.get?.(id);
      if (!item || item.status === 'draft') {
        if (stage) {
          stage.innerHTML = `<section class="sc-hero"><h1>المحتوى غير موجود</h1><p class="sc-lead">العنصر محذوف أو مسودة. <a href="search-content.html">عرض المكتبة</a></p></section>`;
        }
        return;
      }
      renderDetail(item);
      if (library) library.innerHTML = '';
      return;
    }

    const filtered = type
      ? published.filter((x) => (x.section || x.kind) === type || x.kind === type)
      : published;
    renderLibrary(filtered, type || '');
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
