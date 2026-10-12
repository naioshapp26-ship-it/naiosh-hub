/**
 * حد رفع موحّد لكل صفحات هوب: 1500 ميجابايت (≈1.5GB) للصور والملفات والفيديو.
 */
(() => {
  'use strict';

  const MAX_FILE_MB = 1500;
  const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
  const INLINE_DATA_URL_MAX_BYTES = 1.5 * 1024 * 1024;
  const UPLOAD_URL = '/api/hub/uploads';

  const policyMaxMb = () => {
    const mb = Number(window.HubStore?.getSettings?.()?.maxUploadMb);
    // Prefer the platform hard limit (1500). Stale settings from older installs (e.g. 150) must not block video.
    if (Number.isFinite(mb) && mb >= MAX_FILE_MB) return Math.min(mb, MAX_FILE_MB);
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

  const authHeaders = () => {
    try {
      return (window.HubAuth && HubAuth.authHeaders && HubAuth.authHeaders()) || {};
    } catch {
      return {};
    }
  };

  const uploadSimple = (file, { onProgress, signal, url, headers } = {}) =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('أُلغي الرفع'));
        return;
      }
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url || UPLOAD_URL);
      xhr.responseType = 'json';
      xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name || 'file'));
      xhr.setRequestHeader('X-File-Type', file.type || 'application/octet-stream');
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      const auth = authHeaders();
      if (auth.Authorization) xhr.setRequestHeader('Authorization', auth.Authorization);
      if (auth['X-Hub-Token']) xhr.setRequestHeader('X-Hub-Token', auth['X-Hub-Token']);
      if (auth['X-Hub-User-Role']) xhr.setRequestHeader('X-Hub-User-Role', auth['X-Hub-User-Role']);
      if (headers && typeof headers === 'object') {
        Object.entries(headers).forEach(([k, v]) => {
          if (v != null && v !== '') xhr.setRequestHeader(k, String(v));
        });
      }
      const onAbort = () => {
        try {
          xhr.abort();
        } catch {
          /* ignore */
        }
      };
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      xhr.upload.onprogress = (event) => {
        if (!onProgress || !event.lengthComputable) return;
        onProgress(Math.round((event.loaded / event.total) * 100), event.loaded, event.total);
      };
      xhr.onload = () => {
        if (signal) signal.removeEventListener('abort', onAbort);
        const data = xhr.response && typeof xhr.response === 'object' ? xhr.response : null;
        if (xhr.status === 413) {
          reject(new Error(sizeError(file)));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300 && data?.ok && (data.url || data.attachment)) {
          resolve(data);
          return;
        }
        reject(new Error(data?.error || 'فشل رفع الملف إلى السيرفر'));
      };
      xhr.onerror = () => {
        if (signal) signal.removeEventListener('abort', onAbort);
        reject(new Error('تعذر الاتصال بخادم الرفع'));
      };
      xhr.onabort = () => {
        if (signal) signal.removeEventListener('abort', onAbort);
        reject(new Error('أُلغي الرفع'));
      };
      xhr.send(file);
    });

  const CHUNK_THRESHOLD = 4 * 1024 * 1024;

  const putChunk = (uploadId, index, blob, { signal, headers } = {}) =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('أُلغي الرفع'));
        return;
      }
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', `${UPLOAD_URL}/${encodeURIComponent(uploadId)}/chunk?index=${index}`);
      xhr.responseType = 'json';
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      const auth = authHeaders();
      if (auth.Authorization) xhr.setRequestHeader('Authorization', auth.Authorization);
      if (auth['X-Hub-Token']) xhr.setRequestHeader('X-Hub-Token', auth['X-Hub-Token']);
      if (headers && typeof headers === 'object') {
        Object.entries(headers).forEach(([k, v]) => {
          if (v != null && v !== '') xhr.setRequestHeader(k, String(v));
        });
      }
      const onAbort = () => {
        try {
          xhr.abort();
        } catch {
          /* ignore */
        }
      };
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      xhr.onload = () => {
        if (signal) signal.removeEventListener('abort', onAbort);
        const data = xhr.response && typeof xhr.response === 'object' ? xhr.response : null;
        if (xhr.status >= 200 && xhr.status < 300 && data?.ok) {
          resolve(data);
          return;
        }
        reject(new Error(data?.error || `فشل رفع الجزء ${index}`));
      };
      xhr.onerror = () => {
        if (signal) signal.removeEventListener('abort', onAbort);
        reject(new Error('تعذر الاتصال بخادم الرفع'));
      };
      xhr.onabort = () => {
        if (signal) signal.removeEventListener('abort', onAbort);
        reject(new Error('أُلغي الرفع'));
      };
      xhr.send(blob);
    });

  const uploadResumable = async (file, { onProgress, signal, headers, resumeUploadId } = {}) => {
    const check = assertFile(file);
    if (!check.ok) throw new Error(check.error);
    const auth = authHeaders();
    let uploadId = resumeUploadId || '';
    let chunkSize = CHUNK_THRESHOLD;
    let totalChunks = Math.ceil(file.size / chunkSize) || 1;
    let missing = [];

    if (uploadId) {
      const stRes = await fetch(`${UPLOAD_URL}/${encodeURIComponent(uploadId)}/status`, {
        headers: { ...auth, Accept: 'application/json' },
        signal,
      });
      const st = await stRes.json().catch(() => ({}));
      if (stRes.ok && st.ok) {
        chunkSize = st.chunkSize || chunkSize;
        totalChunks = st.totalChunks || totalChunks;
        missing = Array.isArray(st.missingIndexes) ? st.missingIndexes : [];
        if (st.status === 'complete' && st.url) return { ok: true, id: st.finalId, url: st.url, name: file.name, size: file.size, resumed: true };
      } else {
        uploadId = '';
      }
    }

    if (!uploadId) {
      const initRes = await fetch(`${UPLOAD_URL}/init`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json', Accept: 'application/json', ...(headers || {}) },
        body: JSON.stringify({ name: file.name, mime: file.type || 'application/octet-stream', size: file.size }),
        signal,
      });
      const init = await initRes.json().catch(() => ({}));
      if (!initRes.ok || !init.ok || !init.uploadId) throw new Error(init.error || 'تعذر بدء الرفع المجزأ');
      uploadId = init.uploadId;
      chunkSize = init.chunkSize || chunkSize;
      totalChunks = init.totalChunks || totalChunks;
      missing = Array.from({ length: totalChunks }, (_, i) => i);
    }

    const sendIndex = async (index) => {
      const start = index * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const blob = file.slice(start, end);
      let attempts = 0;
      while (attempts < 3) {
        attempts += 1;
        try {
          await putChunk(uploadId, index, blob, { signal, headers });
          return;
        } catch (err) {
          if (attempts >= 3 || signal?.aborted) throw err;
          await new Promise((r) => setTimeout(r, 400 * attempts));
        }
      }
    };

    for (let n = 0; n < missing.length; n += 1) {
      if (signal?.aborted) throw new Error('أُلغي الرفع');
      const index = missing[n];
      await sendIndex(index);
      if (onProgress) {
        const done = n + 1;
        onProgress(Math.round((done / missing.length) * 100), Math.min(file.size, done * chunkSize), file.size);
      }
    }

    const doneRes = await fetch(`${UPLOAD_URL}/${encodeURIComponent(uploadId)}/complete`, {
      method: 'POST',
      headers: { ...auth, Accept: 'application/json', ...(headers || {}) },
      signal,
    });
    const data = await doneRes.json().catch(() => ({}));
    if (!doneRes.ok || !data.ok || !(data.url || data.id)) throw new Error(data.error || 'تعذر إكمال الرفع المجزأ');
    if (onProgress) onProgress(100, file.size, file.size);
    return data;
  };

  const uploadFile = async (file, { onProgress, signal, url, headers, forceSimple, resumeUploadId } = {}) => {
    const check = assertFile(file);
    if (!check.ok) throw new Error(check.error);
    if (forceSimple || url || file.size < CHUNK_THRESHOLD) {
      return uploadSimple(file, { onProgress, signal, url, headers });
    }
    try {
      return await uploadResumable(file, { onProgress, signal, headers, resumeUploadId });
    } catch (err) {
      // Fallback to simple stream if resumable endpoints unavailable
      if (/404|تعذر بدء|Not Found/i.test(String(err.message || ''))) {
        return uploadSimple(file, { onProgress, signal, url, headers });
      }
      throw err;
    }
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
    hint.textContent = `الحد الأقصى ${policyMaxMb()} ميجابايت — معظم أنواع الملفات مسموحة`;
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
    CHUNK_THRESHOLD,
    sizeLabel,
    sizeError,
    assertFile,
    uploadFile,
    uploadSimple,
    uploadResumable,
    install,
    installed: false,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
