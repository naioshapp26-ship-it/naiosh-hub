/**
 * صفحة عرض محتوى محرك البحث — تفاصيل عنصر أو مكتبة تصنيف بمسمّى واضح
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

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

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
    const lead = sec ? sec.pageLead : 'كل العناصر المنشورة من الأدمن حسب التصنيف — اضغط أي بطاقة لعرض المحتوى.';
    document.title = `${title} | محرك البحث | نايوش هوب`;
    if (stage) {
      stage.innerHTML = `
        ${sectionNav()}
        <section class="sc-hero">
          <p class="sc-kicker"><i class="fas ${esc(sec?.icon || 'fa-layer-group')}"></i> مكتبة محرك البحث</p>
          <h1>${esc(title)}</h1>
          <p class="sc-lead">${esc(lead)}</p>
        </section>`;
    }
    if (!library) return;
    if (!items.length) {
      library.innerHTML = `<p class="sc-empty">لا عناصر في «${esc(title)}» بعد — أضِف من <a href="search-admin.html">إدارة محرك البحث</a> واختر التصنيف المناسب.</p>`;
      return;
    }
    library.innerHTML = `<div class="sc-grid">${items
      .map((item) => {
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
      })
      .join('')}</div>`;
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
