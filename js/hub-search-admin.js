/**
 * واجهة أدمن كتالوج محرك البحث
 */
(() => {
  'use strict';

  const api = window.HubSearchCatalog;
  if (!api) return;

  const form = document.querySelector('[data-sca-form]');
  const listEl = document.querySelector('[data-sca-list]');
  const feedback = document.querySelector('[data-sca-feedback]');
  const preview = document.querySelector('[data-sca-preview]');
  const countEl = document.querySelector('[data-sca-count]');
  const fileInput = document.querySelector('[data-sca-file]');
  const idInput = form?.querySelector('[name="id"]');

  let pendingMedia = { mediaDataUrl: '', mediaName: '', mediaMime: '' };

  const showFeedback = (msg, isError = false) => {
    if (!feedback) return;
    feedback.hidden = false;
    feedback.textContent = msg;
    feedback.classList.toggle('is-error', !!isError);
  };

  const resetForm = () => {
    form?.reset();
    if (idInput) idInput.value = '';
    pendingMedia = { mediaDataUrl: '', mediaName: '', mediaMime: '' };
    if (preview) {
      preview.hidden = true;
      preview.innerHTML = '';
    }
  };

  const renderPreview = (dataUrl, mime = '') => {
    if (!preview) return;
    if (!dataUrl) {
      preview.hidden = true;
      preview.innerHTML = '';
      return;
    }
    preview.hidden = false;
    if (String(mime).startsWith('video/') || /\.mp4|\.webm/i.test(dataUrl.slice(0, 40))) {
      preview.innerHTML = `<video src="${dataUrl}" controls></video>`;
    } else if (String(mime).startsWith('image/') || dataUrl.startsWith('data:image')) {
      preview.innerHTML = `<img src="${dataUrl}" alt="معاينة" />`;
    } else {
      preview.innerHTML = `<p style="color:#fff;padding:12px;margin:0;font-weight:800">ملف جاهز للرفع: ${pendingMedia.mediaName || 'مرفق'}</p>`;
    }
  };

  const renderList = () => {
    const items = api.list();
    if (countEl) countEl.textContent = String(items.length);
    if (!listEl) return;
    if (!items.length) {
      listEl.innerHTML = '<p class="sca-hint">لا عناصر بعد — أضف أول محتوى من النموذج.</p>';
      return;
    }
    listEl.innerHTML = items
      .map((item) => {
        const section = item.section || item.kind;
        const sectionMeta = api.SECTION_META?.[section] || api.TYPE_META[item.kind] || {};
        const name = item.pageTitle || item.title;
        const thumb =
          item.mediaDataUrl && (item.kind === 'image' || String(item.mediaMime || '').startsWith('image/'))
            ? `<img src="${item.mediaDataUrl}" alt="${escapeHtml(name)}" />`
            : `<span class="sca-ico"><i class="fas ${sectionMeta.icon || 'fa-file'}"></i></span>`;
        return `<article class="sca-item" data-id="${item.id}">
          ${thumb}
          <div>
            <strong>${escapeHtml(name)}</strong>
            <small>${escapeHtml(sectionMeta.pageTitle || sectionMeta.typeAr || section)} · ${
          item.status === 'draft' ? 'مسودة' : 'منشور'
        }<br/>${escapeHtml(item.title)}${item.description ? ' — ' + escapeHtml(item.description) : ''}</small>
          </div>
          <div class="sca-item-actions">
            <a href="search-content.html?id=${encodeURIComponent(item.id)}" target="_blank" style="border:1px solid #e5e7eb;background:#fff;color:#111827;border-radius:999px;padding:7px 12px;font:inherit;font-size:12px;font-weight:800;text-decoration:none;display:inline-flex;align-items:center">عرض</a>
            <button type="button" data-sca-edit="${item.id}">تعديل</button>
            <button type="button" class="is-danger" data-sca-del="${item.id}">حذف</button>
          </div>
        </article>`;
      })
      .join('');
  };

  const escapeHtml = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await api.fileToDataUrl(file);
      pendingMedia = {
        mediaDataUrl: dataUrl,
        mediaName: file.name,
        mediaMime: file.type || '',
      };
      const kindSelect = form?.querySelector('[name="kind"]');
      const sectionSelect = form?.querySelector('[name="section"]');
      if (kindSelect) {
        if (file.type.startsWith('image/')) kindSelect.value = 'image';
        else if (file.type.startsWith('video/')) kindSelect.value = 'video';
        else kindSelect.value = 'file';
      }
      if (sectionSelect && (!sectionSelect.value || sectionSelect.value === 'content')) {
        sectionSelect.value = kindSelect?.value || 'file';
      }
      renderPreview(dataUrl, file.type);
      showFeedback(`تم تجهيز الملف: ${file.name}`);
    } catch (err) {
      showFeedback(err.message || 'فشل رفع الملف', true);
      fileInput.value = '';
    }
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const data = new FormData(form);
    const result = api.upsert({
      id: data.get('id') || undefined,
      section: data.get('section'),
      kind: data.get('kind'),
      pageTitle: data.get('pageTitle'),
      title: data.get('title'),
      description: data.get('description'),
      keywords: data.get('keywords'),
      href: data.get('href'),
      externalUrl: data.get('externalUrl'),
      status: data.get('status') || 'published',
      mediaDataUrl: pendingMedia.mediaDataUrl || data.get('mediaDataUrl') || '',
      mediaName: pendingMedia.mediaName || data.get('mediaName') || '',
      mediaMime: pendingMedia.mediaMime || data.get('mediaMime') || '',
      mediaUrl: data.get('mediaUrl') || '',
    });
    if (!result.ok) {
      showFeedback(result.error || 'تعذّر الحفظ', true);
      return;
    }
    const sync = await api.pushRemote();
    const section = result.item.section || result.item.kind;
    const pageName = api.SECTION_META?.[section]?.pageTitle || 'المحتوى';
    showFeedback(
      sync.ok
        ? `تم الحفظ في «${pageName}» — المسمّى: ${result.item.pageTitle || result.item.title}`
        : `تم الحفظ محليًا في «${pageName}» — افتح البحث أو صفحة التصنيف`
    );
    resetForm();
    renderList();
  });

  listEl?.addEventListener('click', (e) => {
    const editId = e.target.closest('[data-sca-edit]')?.getAttribute('data-sca-edit');
    const delId = e.target.closest('[data-sca-del]')?.getAttribute('data-sca-del');
    if (delId) {
      if (!confirm('حذف هذا العنصر من محرك البحث؟')) return;
      api.remove(delId);
      api.pushRemote();
      renderList();
      showFeedback('تم الحذف');
      return;
    }
    if (!editId) return;
    const item = api.get(editId);
    if (!item || !form) return;
    form.querySelector('[name="id"]').value = item.id;
    if (form.querySelector('[name="section"]')) {
      form.querySelector('[name="section"]').value = item.section || item.kind || 'content';
    }
    form.querySelector('[name="kind"]').value = item.kind;
    if (form.querySelector('[name="pageTitle"]')) {
      form.querySelector('[name="pageTitle"]').value = item.pageTitle || item.title || '';
    }
    form.querySelector('[name="title"]').value = item.title;
    form.querySelector('[name="description"]').value = item.description || '';
    form.querySelector('[name="keywords"]').value = item.keywords || '';
    form.querySelector('[name="href"]').value = item.href || '';
    form.querySelector('[name="externalUrl"]').value = item.externalUrl || '';
    form.querySelector('[name="mediaUrl"]').value = item.mediaUrl || '';
    form.querySelector('[name="status"]').value = item.status || 'published';
    pendingMedia = {
      mediaDataUrl: item.mediaDataUrl || '',
      mediaName: item.mediaName || '',
      mediaMime: item.mediaMime || '',
    };
    renderPreview(pendingMedia.mediaDataUrl, pendingMedia.mediaMime);
    showFeedback('وضع التعديل — عدّل ثم احفظ');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.querySelector('[data-sca-reset]')?.addEventListener('click', () => {
    resetForm();
    showFeedback('تم تفريغ النموذج');
  });

  document.querySelector('[data-sca-export]')?.addEventListener('click', () => {
    const blob = new Blob([api.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hub-search-catalog-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.querySelector('[data-sca-import]')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = api.importJson(text);
      await api.pushRemote();
      renderList();
      showFeedback(`تم استيراد ${result.count} عنصر`);
    } catch (err) {
      showFeedback(err.message || 'فشل الاستيراد', true);
    }
    e.target.value = '';
  });

  document.querySelector('[data-sca-open-search]')?.addEventListener('click', () => {
    // يفتح الصفحة الرئيسية مع إشارة لفتح البحث — أو يوجّه المستخدم
    window.open('index.html#open-search', '_blank');
  });

  document.querySelector('[data-sca-sync]')?.addEventListener('click', async () => {
    const pulled = await api.pullRemote();
    if (pulled.ok) {
      renderList();
      showFeedback(`تمت المزامنة من السيرفر (${pulled.count} عنصر)`);
      return;
    }
    const pushed = await api.pushRemote();
    showFeedback(pushed.ok ? 'تم الدفع إلى السيرفر' : 'السيرفر غير متاح — التخزين محلي فقط', !pushed.ok);
  });

  const boot = async () => {
    await api.pullRemote();
    renderList();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
