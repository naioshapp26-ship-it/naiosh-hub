/**
 * واجهة خدماتنا: الشبكة + إضافة خدمة بصور وفيديو.
 */
(() => {
  'use strict';

  const api = window.HubServicesCatalog;
  if (!api) return;

  const esc = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const grid = document.querySelector('[data-ns-grid]');
  const dialog = document.querySelector('[data-ns-dialog]');
  const form = document.querySelector('[data-ns-form]');
  const feedback = document.querySelector('[data-ns-feedback]');
  const preview = document.querySelector('[data-ns-preview]');
  const imageInput = document.querySelector('[data-ns-image]');
  const videoInput = document.querySelector('[data-ns-video]');
  const countEl = document.querySelector('[data-ns-count]');
  const openBtns = document.querySelectorAll('[data-ns-open]');
  const closeBtns = document.querySelectorAll('[data-ns-close]');

  let pending = { imageUrl: '', videoUrl: '' };

  const showFeedback = (msg, isError = false) => {
    if (!feedback) return;
    feedback.hidden = false;
    feedback.textContent = msg;
    feedback.style.background = isError ? '#fef2f2' : '#ecfdf5';
    feedback.style.color = isError ? '#991b1b' : '#065f46';
  };

  const renderPreview = () => {
    if (!preview) return;
    const bits = [];
    if (pending.imageUrl) bits.push(`<img src="${esc(pending.imageUrl)}" alt="صورة الخدمة" />`);
    if (pending.videoUrl) bits.push(`<video src="${esc(pending.videoUrl)}" controls></video>`);
    preview.innerHTML = bits.join('');
    preview.hidden = !bits.length;
  };

  const renderGrid = () => {
    if (!grid) return;
    const items = api.list();
    if (countEl) countEl.textContent = `+${items.length} خدمة`;
    grid.innerHTML = items
      .map((svc) => {
        const media = svc.imageUrl
          ? `<span class="ns-card-media"><img src="${esc(svc.imageUrl)}" alt="" /></span>`
          : svc.videoUrl
            ? `<span class="ns-card-media"><video src="${esc(svc.videoUrl)}" muted></video></span>`
            : `<span class="ns-card-icon"><i class="fas ${esc(svc.icon)}"></i></span>`;
        const del = svc.custom
          ? `<button type="button" class="ns-card-del" data-ns-del="${esc(svc.id)}" aria-label="حذف الخدمة"><i class="fas fa-xmark"></i></button>`
          : '';
        return `<a class="ns-card" href="${esc(svc.href)}" data-ns-id="${esc(svc.id)}">
          ${del}
          ${media}
          <strong>${esc(svc.title)}</strong>
          <span class="ns-card-arrows" aria-hidden="true"><i class="fas fa-chevron-right"></i><i class="fas fa-chevron-left"></i></span>
        </a>`;
      })
      .join('');
  };

  const ingest = async (file, kind) => {
    if (!file) return;
    const maxMb = window.HubUploadLimits?.MAX_FILE_MB || 150;
    showFeedback(`جاري رفع ال${kind === 'image' ? 'صورة' : 'فيديو'} (حتى ${maxMb}MB)…`);
    const uploaded = await api.ingestFile(file, {
      onProgress: (pct) => showFeedback(`جاري الرفع… ${pct}%`),
    });
    if (kind === 'image') pending.imageUrl = uploaded.url;
    else pending.videoUrl = uploaded.url;
    renderPreview();
    showFeedback('تم رفع الملف');
  };

  const openDialog = () => {
    pending = { imageUrl: '', videoUrl: '' };
    form?.reset();
    renderPreview();
    if (feedback) feedback.hidden = true;
    dialog?.showModal();
  };

  const closeDialog = () => dialog?.close();

  openBtns.forEach((btn) => btn.addEventListener('click', openDialog));
  closeBtns.forEach((btn) => btn.addEventListener('click', closeDialog));

  imageInput?.addEventListener('change', async () => {
    try {
      await ingest(imageInput.files?.[0], 'image');
    } catch (err) {
      showFeedback(err.message || 'فشل رفع الصورة', true);
    }
  });

  videoInput?.addEventListener('change', async () => {
    try {
      await ingest(videoInput.files?.[0], 'video');
    } catch (err) {
      showFeedback(err.message || 'فشل رفع الفيديو', true);
    }
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const result = api.add({
      title: data.get('title'),
      description: data.get('description'),
      icon: data.get('icon') || 'fa-concierge-bell',
      imageUrl: pending.imageUrl,
      videoUrl: pending.videoUrl,
    });
    if (!result.ok) {
      showFeedback(result.error || 'تعذر إضافة الخدمة', true);
      return;
    }
    closeDialog();
    renderGrid();
  });

  grid?.addEventListener('click', (event) => {
    const del = event.target.closest('[data-ns-del]');
    if (!del) return;
    event.preventDefault();
    event.stopPropagation();
    if (!confirm('حذف هذه الخدمة؟')) return;
    api.remove(del.getAttribute('data-ns-del'));
    renderGrid();
  });

  const detailRoot = document.querySelector('[data-ns-detail]');
  if (detailRoot) {
    const id = new URLSearchParams(location.search).get('id');
    const svc = api.get(id);
    if (!svc) {
      detailRoot.innerHTML = '<p class="hub-service-empty">الخدمة غير موجودة. <a href="services.html">رجوع لخدماتنا</a></p>';
    } else {
      document.title = `${svc.title} | خدمات نايوش هوب`;
      const media = [];
      if (svc.imageUrl) media.push(`<img src="${esc(svc.imageUrl)}" alt="${esc(svc.title)}" />`);
      if (svc.videoUrl) media.push(`<video src="${esc(svc.videoUrl)}" controls playsinline></video>`);
      detailRoot.innerHTML = `
        <section class="hub-feature-hero">
          <p class="hub-feature-kicker"><i class="fas ${esc(svc.icon)}"></i> خدماتنا · صفحة مستقلة</p>
          <h1>${esc(svc.title)}</h1>
          <p>${esc(svc.description || 'خدمة تشغيلية مستقلة داخل نايوش هوب — اطلبها أو انتقل للصفحة المرتبطة.')}</p>
        </section>
        ${media.length ? `<div class="ns-detail-media">${media.join('')}</div>` : ''}
        <div class="hub-feature-actions">
          ${svc.relatedHref ? `<a class="btn btn-primary" href="${esc(svc.relatedHref)}">فتح الصفحة المرتبطة</a>` : ''}
          <a class="btn btn-primary" href="consultation.html">اطلب هذه الخدمة</a>
          <a class="btn btn-secondary" href="services.html">رجوع لخدماتنا</a>
        </div>`;
    }
  }

  renderGrid();
})();
