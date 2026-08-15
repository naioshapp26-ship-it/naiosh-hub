/**
 * صفحة عرض محتوى محرك البحث — مثل صفحة الحاضنة/المنصة
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-search-content]');
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const id = params.get('id') || (location.hash || '').replace(/^#/, '');
  const stage = root.querySelector('[data-sc-stage]');
  const library = root.querySelector('[data-sc-library]');

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const typeMeta = (kind) => window.HubSearchCatalog?.TYPE_META?.[kind] || { typeAr: 'محتوى', icon: 'fa-file-lines' };

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

    if (embed) {
      return `<div class="sc-media sc-media-video"><iframe src="${esc(embed)}" title="${esc(item.title)}" allowfullscreen loading="lazy"></iframe></div>`;
    }
    if (src && (item.kind === 'video' || mime.startsWith('video/'))) {
      return `<div class="sc-media sc-media-video"><video src="${esc(src)}" controls playsinline></video></div>`;
    }
    if (src && (item.kind === 'image' || mime.startsWith('image/') || src.startsWith('data:image'))) {
      return `<div class="sc-media sc-media-image"><img src="${esc(src)}" alt="${esc(item.title)}" /></div>`;
    }
    if (src && (item.kind === 'file' || mime.includes('pdf') || mime.includes('octet'))) {
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
    return `<div class="sc-media sc-media-empty"><i class="fas ${esc(typeMeta(item.kind).icon)}"></i><p>لا توجد وسائط مرفقة — المحتوى النصي أدناه.</p></div>`;
  };

  const renderDetail = (item) => {
    const meta = typeMeta(item.kind);
    document.title = `${item.title} | محتوى البحث | نايوش هوب`;
    if (stage) {
      stage.innerHTML = `
        <section class="sc-hero">
          <p class="sc-kicker"><i class="fas ${esc(meta.icon)}"></i> ${esc(meta.typeAr)} · محتوى محرك البحث</p>
          <h1>${esc(item.title)}</h1>
          <p class="sc-lead">${esc(item.description || 'محتوى منشور عبر إدارة محرك البحث')}</p>
          <div class="sc-chips">
            <span>${esc(meta.typeAr)}</span>
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
          <h2>عن هذا المحتوى</h2>
          <p>${esc(item.description || 'لا يوجد وصف إضافي.')}</p>
          ${
            item.href
              ? `<p><a class="btn btn-secondary" href="${esc(item.href)}"><i class="fas fa-link"></i> رابط مرتبط</a></p>`
              : ''
          }
          <div class="sc-actions">
            <a class="btn btn-primary" href="index.html#open-search"><i class="fas fa-magnifying-glass"></i> رجوع للبحث</a>
            <a class="btn btn-secondary" href="search-content.html"><i class="fas fa-layer-group"></i> كل المحتوى المرفوع</a>
            <a class="btn btn-secondary" href="search-admin.html"><i class="fas fa-sliders"></i> إدارة المحتوى</a>
          </div>
        </section>`;
    }
  };

  const renderLibrary = (items) => {
    document.title = 'مكتبة محتوى البحث | نايوش هوب';
    if (stage) {
      stage.innerHTML = `
        <section class="sc-hero">
          <p class="sc-kicker"><i class="fas fa-layer-group"></i> مكتبة محتوى محرك البحث</p>
          <h1>المحتوى المرفوع</h1>
          <p class="sc-lead">كل العناصر المنشورة من الأدمن — اضغط أي بطاقة لعرض الصورة/الملف/الفيديو مع النص.</p>
        </section>`;
    }
    if (!library) return;
    if (!items.length) {
      library.innerHTML = `<p class="sc-empty">لا محتوى منشور بعد — أضفه من <a href="search-admin.html">إدارة محرك البحث</a>.</p>`;
      return;
    }
    library.innerHTML = `<div class="sc-grid">${items
      .map((item) => {
        const meta = typeMeta(item.kind);
        const thumb =
          item.mediaDataUrl && (item.kind === 'image' || String(item.mediaMime || '').startsWith('image/'))
            ? `<img src="${esc(item.mediaDataUrl)}" alt="" />`
            : `<span class="sc-card-ico"><i class="fas ${esc(meta.icon)}"></i></span>`;
        return `<a class="sc-card" href="search-content.html?id=${encodeURIComponent(item.id)}">
          <div class="sc-card-media">${thumb}</div>
          <div class="sc-card-body">
            <em>${esc(meta.typeAr)}</em>
            <strong>${esc(item.title)}</strong>
            <small>${esc(item.description || '')}</small>
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
    renderLibrary(published);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
