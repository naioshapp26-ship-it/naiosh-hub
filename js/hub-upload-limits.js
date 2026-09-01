/**
 * حد رفع موحّد لكل صفحات هوب: 150 ميجابايت للصور والملفات والفيديو.
 */
(() => {
  'use strict';

  const MAX_FILE_MB = 150;
  const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
  const INLINE_DATA_URL_MAX_BYTES = 1.5 * 1024 * 1024;
  const UPLOAD_URL = '/api/hub/uploads';

  const policyMaxMb = () => {
    const mb = Number(window.HubStore?.getSettings?.()?.maxUploadMb);
    if (Number.isFinite(mb) && mb > 0) return Math.min(MAX_FILE_MB, mb);
    return MAX_FILE_MB;
  };
  const policyMaxBytes = () => policyMaxMb() * 1024 * 1024;

  const sizeLabel = (bytes = policyMaxBytes()) => `${(bytes / 1024 / 1024).toFixed(0)}MB`;

  const sizeError = (file) =>
    `حجم الملف أكبر من ${sizeLabel()} — صغّره أو ضع رابطًا خارجيًا${file?.name ? ` (${file.name})` : ''}`;

  const assertFile = (file) => {
    if (!file) return { ok: false, error: 'لا ملف' };
    if (file.size > policyMaxBytes()) return { ok: false, error: sizeError(file) };
    return { ok: true };
  };

  const uploadFile = async (file, { onProgress } = {}) => {
    const check = assertFile(file);
    if (!check.ok) throw new Error(check.error);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', UPLOAD_URL);
      xhr.responseType = 'json';
      xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name || 'file'));
      xhr.setRequestHeader('X-File-Type', file.type || 'application/octet-stream');
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.upload.onprogress = (event) => {
        if (!onProgress || !event.lengthComputable) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        const data = xhr.response && typeof xhr.response === 'object' ? xhr.response : null;
        if (xhr.status === 413) {
          reject(new Error(sizeError(file)));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300 && data?.ok && data.url) {
          resolve(data);
          return;
        }
        reject(new Error(data?.error || 'فشل رفع الملف إلى السيرفر'));
      };
      xhr.onerror = () => reject(new Error('تعذر الاتصال بخادم الرفع'));
      xhr.onabort = () => reject(new Error('أُلغي الرفع'));
      xhr.send(file);
    });
  };

  const skipHint = (input) => {
    if (!input || input.type !== 'file') return true;
    if (input.hasAttribute('data-hub-skip-limit')) return true;
    if (input.hidden || input.hasAttribute('hidden')) return true;
    const accept = String(input.getAttribute('accept') || '').toLowerCase();
    if (accept.includes('json')) return true;
    return false;
  };

  const addHint = (input) => {
    if (skipHint(input)) return;
    if (input.parentElement?.querySelector('[data-hub-upload-hint]')) return;
    const hint = document.createElement('small');
    hint.setAttribute('data-hub-upload-hint', '');
    hint.textContent = `الحد الأقصى ${policyMaxMb()} ميجابايت للصورة والملف والفيديو`;
    input.insertAdjacentElement('afterend', hint);
  };

  const decorate = (root = document) => {
    root.querySelectorAll?.('input[type="file"]').forEach(addHint);
  };

  const notify = (msg) => {
    if (window.HubActions?.toast) return window.HubActions.toast(msg);
    alert(msg);
  };

  const install = () => {
    if (window.HubUploadLimits?.installed) return;
    if (!document.getElementById('hub-upload-limits-style')) {
      const style = document.createElement('style');
      style.id = 'hub-upload-limits-style';
      style.textContent =
        '[data-hub-upload-hint]{display:block;margin-top:6px;font-size:12px;font-weight:700;color:#6b7280;line-height:1.5}';
      document.head.appendChild(style);
    }

    document.addEventListener(
      'change',
      (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
        if (input.hasAttribute('data-hub-skip-limit')) return;
        const file = input.files?.[0];
        if (!file) return;
        const check = assertFile(file);
        if (check.ok) return;
        input.value = '';
        notify(check.error);
        input.dispatchEvent(new CustomEvent('hub-upload-rejected', { bubbles: true, detail: { error: check.error } }));
      },
      true
    );

    decorate(document);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.matches?.('input[type="file"]')) addHint(node);
          else decorate(node);
        });
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.HubUploadLimits.installed = true;
  };

  window.HubUploadLimits = {
    MAX_FILE_MB,
    MAX_FILE_BYTES,
    INLINE_DATA_URL_MAX_BYTES,
    UPLOAD_URL,
    sizeLabel,
    sizeError,
    assertFile,
    uploadFile,
    install,
    installed: false,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
