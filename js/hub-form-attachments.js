/**
 * مكوّن مرفقات موحّد لنايوش هوب 360
 * عنوان: المرفقات — رفع صورة · رفع ملف · رفع فيديو (متعدد، اختياري افتراضيًا)
 * حد الرفع عبر HubUploadLimits (حتى 1500 ميجابايت) مع شريط تقدم وإعادة محاولة.
 */
(() => {
  'use strict';

  const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif';
  const DOC_ACCEPT =
    '.txt,.md,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v';

  const STYLE_ID = 'hub-form-attachments-style';

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.hub-attach-block{margin:14px 0;padding:14px;border:1px solid rgba(15,23,42,.12);border-radius:14px;background:linear-gradient(180deg,rgba(248,250,252,.95),rgba(255,255,255,.98))}
.hub-attach-block h4{margin:0 0 6px;font-size:1.05rem;font-weight:800;color:#0f172a}
.hub-attach-block .hub-attach-lead{margin:0 0 12px;font-size:.88rem;color:#64748b;line-height:1.55}
.hub-attach-grid{display:grid;gap:12px;grid-template-columns:repeat(3,minmax(0,1fr))}
@media (max-width:820px){.hub-attach-grid{grid-template-columns:1fr}}
.hub-attach-zone{border:1px dashed rgba(148,163,184,.85);border-radius:12px;padding:12px;background:#fff;min-height:110px}
.hub-attach-zone strong{display:block;margin-bottom:8px;font-size:.92rem;color:#0f172a}
.hub-attach-zone input[type=file]{width:100%;font-size:.85rem}
.hub-attach-zone .hub-attach-hint{display:block;margin-top:6px;font-size:.75rem;color:#64748b}
.hub-attach-list{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.hub-attach-item{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0}
.hub-attach-item img,.hub-attach-item video{width:56px;height:56px;object-fit:cover;border-radius:8px;background:#0f172a}
.hub-attach-item .meta{flex:1;min-width:0;font-size:.82rem;line-height:1.45}
.hub-attach-item .meta b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hub-attach-item button{border:0;background:#fee2e2;color:#991b1b;border-radius:8px;padding:6px 10px;font-weight:700;cursor:pointer}
.hub-attach-status{margin-top:8px;font-size:.85rem;font-weight:700}
.hub-attach-progress{height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:8px}
.hub-attach-progress>i{display:block;height:100%;width:0;background:#b91c1c;transition:width .15s linear}
[data-theme=dark] .hub-attach-block,[data-theme="dark"] .hub-attach-block{background:rgba(15,23,42,.55);border-color:rgba(148,163,184,.25)}
[data-theme=dark] .hub-attach-block h4,[data-theme="dark"] .hub-attach-block h4{color:#f8fafc}
[data-theme=dark] .hub-attach-zone,[data-theme="dark"] .hub-attach-zone{background:rgba(2,6,23,.45)}
`;
    document.head.appendChild(style);
  };

  /** Legacy single-slot HTML (services/support pages) */
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

  const blockHtml = ({ required = false, showLink = false, multi = true, title = 'المرفقات' } = {}) => {
    const reqMark = required ? ' <span style="color:#b91c1c">*</span>' : '';
    const multiAttr = multi ? ' multiple' : '';
    return `<section class="hub-attach-block" data-hub-attach-block data-hub-attach-multi="${multi ? '1' : '0'}">
  <h4>${title}${reqMark}</h4>
  <p class="hub-attach-lead">ارفع صورًا أو ملفات أو فيديوهات (حتى 1500 ميجابايت للملف). المرفقات اختيارية${required ? ' — مطلوبة في هذا النموذج' : ''}.</p>
  <div class="hub-attach-grid" data-hub-attach-fields>
    <div class="hub-attach-zone">
      <strong>رفع صورة</strong>
      <input type="file" accept="${IMAGE_ACCEPT}" data-hub-attach="image" data-ns-image${multiAttr} />
      <span class="hub-attach-hint">PNG · JPG · WEBP · GIF</span>
    </div>
    <div class="hub-attach-zone">
      <strong>رفع ملف</strong>
      <input type="file" accept="${DOC_ACCEPT}" data-hub-attach="doc"${multiAttr} />
      <span class="hub-attach-hint">PDF · Office · ZIP · نص</span>
    </div>
    <div class="hub-attach-zone">
      <strong>رفع فيديو</strong>
      <input type="file" accept="${VIDEO_ACCEPT}" data-hub-attach="video" data-ns-video${multiAttr} />
      <span class="hub-attach-hint">MP4 · WEBM · MOV · حتى 1500MB</span>
    </div>
    ${
      showLink
        ? `<label style="grid-column:1/-1">إضافة رابط
      <input name="attachLink" type="url" inputmode="url" placeholder="https://" data-hub-attach="link" />
    </label>`
        : ''
    }
  </div>
  <div class="hub-attach-progress" data-hub-attach-progress hidden><i></i></div>
  <p class="hub-attach-status" data-hub-attach-status hidden role="status"></p>
  <div class="hub-attach-list" data-hub-attach-list></div>
  <div class="hub-attach-preview" data-hub-attach-preview hidden></div>
</section>`;
  };

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

  const sizeLabel = (n) => {
    const b = Number(n) || 0;
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const hostOf = (el) => {
    if (!el) return null;
    return el.closest?.('[data-hub-attach-block], form, [data-hub-attach-host]') || el;
  };

  const pendingOf = (host) => {
    if (!host) return { link: '', items: [], doc: null, image: null, video: null };
    if (!host._hubAttachPending) {
      host._hubAttachPending = { link: '', items: [], doc: null, image: null, video: null };
    }
    if (!Array.isArray(host._hubAttachPending.items)) host._hubAttachPending.items = [];
    return host._hubAttachPending;
  };

  const setStatus = (host, msg, isError = false) => {
    const el = host?.querySelector?.('[data-hub-attach-status]');
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

  const setProgress = (host, pct) => {
    const bar = host?.querySelector?.('[data-hub-attach-progress]');
    const fill = bar?.querySelector?.('i');
    if (!bar || !fill) return;
    if (pct == null || pct < 0) {
      bar.hidden = true;
      fill.style.width = '0%';
      return;
    }
    bar.hidden = false;
    fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  };

  const renderList = (host) => {
    const box = host?.querySelector?.('[data-hub-attach-list]');
    const preview = host?.querySelector?.('[data-hub-attach-preview]');
    if (!box) return;
    const pending = pendingOf(host);
    const items = pending.items || [];
    if (!items.length) {
      box.innerHTML = '';
      if (preview) {
        preview.hidden = true;
        preview.innerHTML = '';
      }
      return;
    }
    box.innerHTML = items
      .map((it, idx) => {
        const kindLabel = it.kind === 'image' ? 'صورة' : it.kind === 'video' ? 'فيديو' : 'ملف';
        const thumb =
          it.kind === 'image' && it.url
            ? `<img src="${esc(it.url)}" alt="" />`
            : it.kind === 'video' && it.url
              ? `<video src="${esc(it.url)}" muted playsinline></video>`
              : `<span style="width:56px;height:56px;display:grid;place-items:center;background:#e2e8f0;border-radius:8px;font-weight:800">${kindLabel[0]}</span>`;
        return `<div class="hub-attach-item" data-attach-idx="${idx}">
        ${thumb}
        <div class="meta"><b>${esc(it.name || 'مرفق')}</b>
          <span>${esc(kindLabel)} · ${esc(sizeLabel(it.size))} · ${esc(it.mime || '')}</span>
        </div>
        <button type="button" data-hub-attach-remove="${idx}" aria-label="إزالة المرفق">إزالة</button>
      </div>`;
      })
      .join('');

    if (preview) {
      const bits = items
        .filter((it) => it.kind === 'image' || it.kind === 'video')
        .map((it) =>
          it.kind === 'image'
            ? `<img src="${esc(it.url)}" alt="صورة مرفقة" />`
            : `<video src="${esc(it.url)}" controls playsinline></video>`
        );
      preview.innerHTML = bits.join('');
      preview.hidden = !bits.length;
    }
  };

  /** Legacy preview for single-slot FIELDS_HTML */
  const renderPreview = (form) => {
    const host = hostOf(form);
    if (host?.querySelector?.('[data-hub-attach-list]')) {
      renderList(host);
      return;
    }
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
    if (pending.doc) bits.push(`<span class="hub-attach-chip">ملف: ${esc(pending.doc.name || 'مستند')}</span>`);
    if (pending.image?.url) bits.push(`<img src="${esc(pending.image.url)}" alt="صورة مرفقة" />`);
    if (pending.video?.url) bits.push(`<video src="${esc(pending.video.url)}" controls playsinline></video>`);
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
        return {
          url: uploaded.url,
          id: uploaded.id || uploaded.storageRef || '',
          mime: uploaded.mime || file.type,
          name: file.name,
          size: file.size,
          kind: kind === 'doc' ? 'file' : kind,
        };
      } catch (err) {
        if (file.size > cap || video) throw err;
      }
    } else if (file.size > cap || video) {
      throw new Error('سجّل الدخول لرفع فيديو أو ملفات أكبر من الحد المحلي');
    }
    if (file.size > cap) throw new Error('الملف أكبر من الحد المحلي للمعاينة');
    const url = await readDataUrl(file);
    return { url, id: '', mime: file.type, name: file.name, size: file.size, kind: kind === 'doc' ? 'file' : kind };
  };

  const collect = (hostOrForm) => {
    const host = hostOf(hostOrForm) || hostOrForm;
    const pending = pendingOf(host);
    const link = String(host?.querySelector?.('[data-hub-attach="link"]')?.value || pending.link || '').trim();
    const items = Array.isArray(pending.items) ? pending.items.slice() : [];
    // Legacy single slots
    if (!items.length) {
      if (pending.doc) items.push({ ...pending.doc, kind: 'file' });
      if (pending.image) items.push({ ...pending.image, kind: 'image' });
      if (pending.video) items.push({ ...pending.video, kind: 'video' });
    }
    return {
      attachLink: link,
      attachDoc: pending.doc || items.find((i) => i.kind === 'file') || null,
      attachImage: pending.image || items.find((i) => i.kind === 'image') || null,
      attachVideo: pending.video || items.find((i) => i.kind === 'video') || null,
      items,
    };
  };

  const toStored = (collected = {}) => ({
    attachLink: String(collected.attachLink || '').trim(),
    attachDocUrl: String(collected.attachDoc?.url || '').trim(),
    attachDocName: String(collected.attachDoc?.name || '').trim(),
    attachImageUrl: String(collected.attachImage?.url || '').trim(),
    attachVideoUrl: String(collected.attachVideo?.url || '').trim(),
    attachments: Array.isArray(collected.items)
      ? collected.items.map((it) => ({
          id: it.id || '',
          url: it.url || '',
          name: it.name || '',
          mime: it.mime || '',
          size: it.size || 0,
          kind: it.kind || 'file',
        }))
      : [],
  });

  const reset = (hostOrForm) => {
    const host = hostOf(hostOrForm) || hostOrForm;
    if (host) host._hubAttachPending = { link: '', items: [], doc: null, image: null, video: null };
    setStatus(host, '');
    setProgress(host, -1);
    renderPreview(host);
    renderList(host);
  };

  const setItems = (hostOrForm, items = []) => {
    const host = hostOf(hostOrForm) || hostOrForm;
    if (!host) return;
    const pending = pendingOf(host);
    pending.items = (items || []).map((it) => ({
      id: it.id || it.storageRef || '',
      url: it.url || it.contentUrl || '',
      name: it.name || it.originalFileName || 'مرفق',
      mime: it.mime || it.mimeType || '',
      size: it.size || it.fileSize || 0,
      kind: it.kind || (it.category === 'image' ? 'image' : it.category === 'video' ? 'video' : 'file'),
    }));
    pending.doc = pending.items.find((i) => i.kind === 'file') || null;
    pending.image = pending.items.find((i) => i.kind === 'image') || null;
    pending.video = pending.items.find((i) => i.kind === 'video') || null;
    renderList(host);
    renderPreview(host);
  };

  const bind = (hostOrForm) => {
    const host = hostOf(hostOrForm) || hostOrForm;
    if (!host || host.dataset.hubAttachBound === '1') return pendingOf(host);
    const wrap = host.querySelector?.('[data-hub-attach-fields]');
    if (!wrap) return pendingOf(host);
    ensureStyles();
    host.dataset.hubAttachBound = '1';
    const multi = host.getAttribute?.('data-hub-attach-multi') === '1' || !!host.querySelector?.('[data-hub-attach-list]');

    wrap.querySelector('[data-hub-attach="link"]')?.addEventListener('input', (event) => {
      pendingOf(host).link = String(event.target.value || '').trim();
      renderPreview(host);
    });

    host.addEventListener('click', (event) => {
      const btn = event.target.closest?.('[data-hub-attach-remove]');
      if (!btn || !host.contains(btn)) return;
      const idx = Number(btn.getAttribute('data-hub-attach-remove'));
      const pending = pendingOf(host);
      if (!Number.isFinite(idx)) return;
      pending.items.splice(idx, 1);
      // refresh legacy singles
      pending.doc = pending.items.find((i) => i.kind === 'file') || null;
      pending.image = pending.items.find((i) => i.kind === 'image') || null;
      pending.video = pending.items.find((i) => i.kind === 'video') || null;
      renderList(host);
      renderPreview(host);
      setStatus(host, 'تمت إزالة المرفق');
    });

    ['doc', 'image', 'video'].forEach((kind) => {
      wrap.querySelector(`[data-hub-attach="${kind}"]`)?.addEventListener('change', async (event) => {
        const input = event.target;
        const files = Array.from(input.files || []);
        if (!files.length) return;
        const pending = pendingOf(host);
        try {
          for (let i = 0; i < files.length; i += 1) {
            const file = files[i];
            setStatus(host, `جاري رفع ${file.name}… (${i + 1}/${files.length})`);
            setProgress(host, 2);
            let media;
            let attempts = 0;
            while (attempts < 2) {
              attempts += 1;
              try {
                media = await ingest(file, kind, {
                  onProgress: (pct) => {
                    setProgress(host, pct);
                    setStatus(host, `جاري رفع ${file.name}… ${pct}%`);
                  },
                });
                break;
              } catch (err) {
                if (attempts >= 2) throw err;
                setStatus(host, `فشل الرفع — إعادة المحاولة…`, true);
                await new Promise((r) => setTimeout(r, 400));
              }
            }
            const item = { ...media, kind: kind === 'doc' ? 'file' : kind };
            if (multi) {
              const exists = pending.items.some(
                (x) => (x.id && item.id && x.id === item.id) || (x.name === item.name && x.size === item.size && x.url === item.url)
              );
              if (!exists) pending.items.push(item);
            } else {
              pending.items = pending.items.filter((x) => x.kind !== item.kind);
              pending.items.push(item);
            }
            pending[kind === 'doc' ? 'doc' : kind] = item;
          }
          renderList(host);
          renderPreview(host);
          setProgress(host, 100);
          setStatus(host, 'تم رفع المرفقات');
          setTimeout(() => setProgress(host, -1), 600);
        } catch (err) {
          setProgress(host, -1);
          setStatus(host, err.message || 'فشل رفع الملف', true);
        } finally {
          input.value = '';
        }
      });
    });

    return pendingOf(host);
  };

  const mount = (container, options = {}) => {
    if (!container) return null;
    ensureStyles();
    if (!container.querySelector('[data-hub-attach-block], [data-hub-attach-fields]')) {
      container.insertAdjacentHTML('beforeend', blockHtml(options));
    }
    container.setAttribute('data-hub-attach-host', '1');
    bind(container);
    return container;
  };

  /** Replace legacy single-slot grids with the multi block (progress + list + remove). */
  const upgradeForm = (form, options = {}) => {
    if (!form) return null;
    ensureStyles();
    const opts = { showLink: true, multi: true, title: 'المرفقات', ...options };
    const existingBlock = form.querySelector('[data-hub-attach-block]');
    if (existingBlock) {
      bind(existingBlock);
      return existingBlock;
    }
    const legacy = form.querySelector('[data-hub-attach-fields]');
    if (legacy) {
      const tmp = document.createElement('div');
      tmp.innerHTML = blockHtml(opts);
      const block = tmp.firstElementChild;
      legacy.replaceWith(block);
      bind(block);
      return block;
    }
    return mount(form, opts);
  };

  /**
   * Persist when session exists. Guests keep URLs in the local record only.
   * Returns { ok, persisted, skippedReason, items }.
   */
  const softPersistToEntity = async ({ entityType, entityId, ownerEmail, items } = {}) => {
    const list = Array.isArray(items) ? items.filter((it) => it && (it.id || it.url)) : [];
    if (!entityType || !entityId || !list.length) {
      return { ok: true, persisted: 0, skippedReason: 'empty', items: [] };
    }
    if (!isLoggedIn()) {
      return { ok: true, persisted: 0, skippedReason: 'login_required', items: list };
    }
    try {
      const out = await persistToEntity({ entityType, entityId, ownerEmail, items: list });
      return { ok: true, persisted: out.length, skippedReason: '', items: out };
    } catch (err) {
      return { ok: false, persisted: 0, skippedReason: err.message || 'persist_failed', items: [] };
    }
  };

  const mountAll = (root = document) => {
    ensureStyles();
    root.querySelectorAll?.('form').forEach((form) => bind(form));
    root.querySelectorAll?.('[data-hub-attach-block]').forEach((block) => bind(block));
  };

  /**
   * Bind uploaded items to a durable entity record (employeeNo, etc.).
   * Idempotent via Idempotency-Key per upload id.
   */
  const persistToEntity = async ({ entityType, entityId, ownerEmail, items } = {}) => {
    const list = Array.isArray(items) ? items : [];
    if (!entityType || !entityId || !list.length) return [];
    const headers = (window.HubAuth && HubAuth.authHeaders && HubAuth.authHeaders()) || {};
    const out = [];
    for (const it of list) {
      const uploadId = String(it.id || '')
        .replace(/^\/uploads\//, '')
        .trim();
      if (!uploadId && !it.url) continue;
      const key = `eatt-${entityType}-${entityId}-${uploadId || it.name}-${it.size || 0}`;
      const res = await fetch('/api/hub/entity-attachments', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify({
          entityType,
          entityId,
          category: it.kind === 'image' ? 'image' : it.kind === 'video' ? 'video' : 'file',
          uploadId,
          url: it.url,
          mime: it.mime,
          originalName: it.name,
          sizeBytes: it.size,
          ownerEmail: ownerEmail || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'فشل ربط المرفق بالسجل');
      out.push(data.item);
    }
    return out;
  };

  const loadEntityAttachments = async ({ entityType, entityId } = {}) => {
    if (!entityType || !entityId) return [];
    const headers = (window.HubAuth && HubAuth.authHeaders && HubAuth.authHeaders()) || {};
    const qs = new URLSearchParams({ entityType, entityId });
    const res = await fetch(`/api/hub/entity-attachments?${qs}`, { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return [];
    return data.items || [];
  };

  window.HubFormAttachments = {
    IMAGE_ACCEPT,
    DOC_ACCEPT,
    VIDEO_ACCEPT,
    FIELDS_HTML,
    blockHtml,
    isSvgFile,
    ingest,
    collect,
    toStored,
    reset,
    setItems,
    bind,
    mount,
    upgradeForm,
    softPersistToEntity,
    mountAll,
    persistToEntity,
    loadEntityAttachments,
    sizeLabel,
  };

  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mountAll(document), { once: true });
  } else {
    mountAll(document);
  }
})();
