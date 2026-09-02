/**
 * حقول مرفقات موحّدة لكل نماذج الخدمات: رابط · نص/PDF · صورة · فيديو.
 */
(() => {
  'use strict';

  const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif';
  const DOC_ACCEPT = '.txt,.md,.pdf,.doc,.docx,application/pdf,text/plain';
  const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov';

  const FIELDS_HTML = `<div class="hub-attach-grid" data-hub-attach-fields>
  <label>إضافة رابط
    <input name="attachLink" type="url" inputmode="url" placeholder="https://" data-hub-attach="link" />
  </label>
  <label>رفع ملف نص / PDF
    <input name="attachDoc" type="file" accept="${DOC_ACCEPT}" data-hub-attach="doc" />
  </label>
  <label>رفع صورة
    <input name="attachImage" type="file" accept="${IMAGE_ACCEPT}" data-hub-attach="image" data-ns-image />
  </label>
  <label>رفع فيديو
    <input name="attachVideo" type="file" accept="${VIDEO_ACCEPT}" data-hub-attach="video" data-ns-video />
  </label>
  <p class="hub-attach-status" data-hub-attach-status hidden role="status"></p>
  <div class="hub-attach-preview" data-hub-attach-preview hidden></div>
</div>`;

  const esc = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const isSvgFile = (file) => {
    const name = String(file?.name || '').toLowerCase();
    const mime = String(file?.type || '').toLowerCase();
    return mime.includes('svg') || name.endsWith('.svg');
  };

  const isLoggedIn = () => !!(window.HubAuth && window.HubAuth.isLoggedIn && window.HubAuth.isLoggedIn());

  const inlineMaxBytes = () => window.HubUploadLimits?.INLINE_DATA_URL_MAX_BYTES || 1.5 * 1024 * 1024;

  const pendingOf = (form) => {
    if (!form) return { link: '', doc: null, image: null, video: null };
    if (!form._hubAttachPending) {
      form._hubAttachPending = { link: '', doc: null, image: null, video: null };
    }
    return form._hubAttachPending;
  };

  const setStatus = (form, msg, isError = false) => {
    const el = form?.querySelector('[data-hub-attach-status]');
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = msg;
    el.style.color = isError ? '#991b1b' : '#065f46';
  };

  const renderPreview = (form) => {
    const box = form?.querySelector('[data-hub-attach-preview]');
    if (!box) return;
    const pending = pendingOf(form);
    const link = String(form.querySelector('[data-hub-attach="link"]')?.value || pending.link || '').trim();
    const bits = [];
    if (link) {
      bits.push(
        `<a class="hub-attach-chip" href="${esc(link)}" target="_blank" rel="noopener noreferrer">رابط مرفق</a>`
      );
    }
    if (pending.doc) {
      bits.push(`<span class="hub-attach-chip">ملف: ${esc(pending.doc.name || 'مستند')}</span>`);
    }
    if (pending.image?.url) {
      bits.push(`<img src="${esc(pending.image.url)}" alt="صورة مرفقة" />`);
    }
    if (pending.video?.url) {
      bits.push(`<video src="${esc(pending.video.url)}" controls playsinline></video>`);
    }
    box.innerHTML = bits.join('');
    box.hidden = !bits.length;
  };

  const readDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('فشل قراءة الملف'));
      reader.readAsDataURL(file);
    });

  const ingest = async (file, kind, { onProgress } = {}) => {
    if (!file) throw new Error('لا ملف');
    if (isSvgFile(file)) throw new Error('ملفات SVG غير مسموحة');
    const limits = window.HubUploadLimits;
    if (limits?.assertFile) {
      const check = limits.assertFile(file);
      if (!check.ok) throw new Error(check.error);
    }
    const cap = inlineMaxBytes();
    const video = kind === 'video' || String(file.type || '').startsWith('video/');
    if (isLoggedIn() && limits?.uploadFile) {
      try {
        const uploaded = await limits.uploadFile(file, { onProgress });
        return { url: uploaded.url, mime: uploaded.mime || file.type, name: file.name, size: file.size };
      } catch (err) {
        if (file.size > cap || video) throw err;
      }
    } else if (file.size > cap || video) {
      throw new Error('سجّل الدخول لرفع فيديو أو ملفات أكبر من الحد المحلي');
    }
    if (file.size > cap) throw new Error('الملف أكبر من الحد المحلي للمعاينة');
    const url = await readDataUrl(file);
    return { url, mime: file.type, name: file.name, size: file.size };
  };

  const collect = (form) => {
    const pending = pendingOf(form);
    const link = String(form?.querySelector('[data-hub-attach="link"]')?.value || pending.link || '').trim();
    return {
      attachLink: link,
      attachDoc: pending.doc || null,
      attachImage: pending.image || null,
      attachVideo: pending.video || null,
    };
  };

  const toStored = (collected = {}) => ({
    attachLink: String(collected.attachLink || '').trim(),
    attachDocUrl: String(collected.attachDoc?.url || '').trim(),
    attachDocName: String(collected.attachDoc?.name || '').trim(),
    attachImageUrl: String(collected.attachImage?.url || '').trim(),
    attachVideoUrl: String(collected.attachVideo?.url || '').trim(),
  });

  const reset = (form) => {
    if (form) form._hubAttachPending = { link: '', doc: null, image: null, video: null };
    setStatus(form, '');
    renderPreview(form);
  };

  const bind = (form) => {
    if (!form || form.dataset.hubAttachBound === '1') return pendingOf(form);
    const wrap = form.querySelector('[data-hub-attach-fields]');
    if (!wrap) return pendingOf(form);
    form.dataset.hubAttachBound = '1';

    wrap.querySelector('[data-hub-attach="link"]')?.addEventListener('input', (event) => {
      pendingOf(form).link = String(event.target.value || '').trim();
      renderPreview(form);
    });

    ['doc', 'image', 'video'].forEach((kind) => {
      wrap.querySelector(`[data-hub-attach="${kind}"]`)?.addEventListener('change', async (event) => {
        const input = event.target;
        const file = input.files?.[0];
        if (!file) return;
        try {
          setStatus(form, `جاري رفع ${file.name}…`);
          const media = await ingest(file, kind, {
            onProgress: (pct) => setStatus(form, `جاري الرفع… ${pct}%`),
          });
          pendingOf(form)[kind] = media;
          renderPreview(form);
          setStatus(form, 'تم رفع الملف');
        } catch (err) {
          input.value = '';
          setStatus(form, err.message || 'فشل رفع الملف', true);
        }
      });
    });

    return pendingOf(form);
  };

  const mountAll = (root = document) => {
    root.querySelectorAll?.('form').forEach((form) => bind(form));
  };

  window.HubFormAttachments = {
    IMAGE_ACCEPT,
    DOC_ACCEPT,
    VIDEO_ACCEPT,
    FIELDS_HTML,
    isSvgFile,
    ingest,
    collect,
    toStored,
    reset,
    bind,
    mountAll,
  };

  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mountAll(document), { once: true });
  } else {
    mountAll(document);
  }
})();
