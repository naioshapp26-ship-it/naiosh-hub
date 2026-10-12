/**
 * سجل معنا — المستأجر يعبّئ النموذج + المرفقات ثم ينتظر موافقة السوبر أدمن
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-hub-register]');
  if (!root) return;

  if (String(new URLSearchParams(location.search).get('type') || '').toLowerCase() === 'freelancer') {
    location.replace('register-freelancer.html');
    return;
  }

  const form = root.querySelector('[data-register-form]');
  const feedback = root.querySelector('[data-register-feedback]');
  const statusEl = root.querySelector('[data-subdomain-status]');
  const attachStatus = root.querySelector('[data-reg-attach-status]');
  const submitBtn = root.querySelector('[data-reg-submit]');
  const grants = () => window.HubPlatformGrants;

  let subdomainOk = false;

  const IMAGE_ACCEPT = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', '.jpg', '.jpeg', '.png', '.webp']);
  const DOC_ACCEPT = new Set([
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.txt',
    'application/pdf',
    'text/plain',
  ]);
  const VIDEO_ACCEPT = new Set(['video/mp4', 'video/quicktime', 'video/webm', '.mp4', '.mov', '.webm']);
  const MAX_VIDEO_BYTES = () => window.HubUploadLimits?.MAX_FILE_BYTES || 1500 * 1024 * 1024;

  /** @type {{ id: string, category: string, file: File, previewUrl?: string, status: string, progress: number, error?: string, attachment?: object, controller?: AbortController }[]} */
  const pendingFiles = [];

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const toast = (msg, ok = false) => {
    if (!feedback) return;
    feedback.hidden = false;
    feedback.innerHTML = msg;
    feedback.classList.toggle('is-error', !ok);
    feedback.classList.toggle('is-ok', ok);
  };

  const setAttachStatus = (msg, isError = false) => {
    if (!attachStatus) return;
    if (!msg) {
      attachStatus.hidden = true;
      attachStatus.textContent = '';
      return;
    }
    attachStatus.hidden = false;
    attachStatus.textContent = msg;
    attachStatus.classList.toggle('is-error', !!isError);
  };

  const formatSize = (bytes) => {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };

  const extOf = (name = '') => {
    const m = String(name).toLowerCase().match(/(\.[a-z0-9]+)$/);
    return m ? m[1] : '';
  };

  const fileAllowed = (file, category) => {
    const mime = String(file?.type || '').toLowerCase();
    const ext = extOf(file?.name || '');
    if (category === 'image') return IMAGE_ACCEPT.has(mime) || IMAGE_ACCEPT.has(ext);
    if (category === 'document') return DOC_ACCEPT.has(mime) || DOC_ACCEPT.has(ext);
    if (category === 'video') return VIDEO_ACCEPT.has(mime) || VIDEO_ACCEPT.has(ext);
    return false;
  };

  const uid = () => `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const isUploading = () => pendingFiles.some((f) => f.status === 'uploading' || f.status === 'queued');

  const fillSelect = (el, options, placeholder, selected) => {
    if (!el) return;
    el.innerHTML =
      `<option value="">${esc(placeholder)}</option>` +
      options
        .map((o) => {
          const id = typeof o === 'string' ? o : o.id;
          const label = typeof o === 'string' ? o : o.label;
          return `<option value="${esc(id)}">${esc(label)}</option>`;
        })
        .join('');
    if (selected) {
      const has = options.some((o) => String(typeof o === 'string' ? o : o.id) === String(selected));
      if (has) el.value = String(selected);
    }
  };

  /** Real registered catalogs only — never invent incubator/platform options. */
  const loadCatalogOptions = async () => {
    const out = { incubators: [], platforms: [], incubatorMsg: '', platformMsg: '' };
    try {
      const incRes = await fetch('/api/hub/catalog/incubators', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const incData = await incRes.json().catch(() => ({}));
      out.incubators = (incData.incubators || []).map((inc) => ({
        id: inc.id,
        label: `${inc.name_ar || inc.id}${inc.sector ? ` — ${inc.sector}` : ''}`,
      }));
      if (!out.incubators.length) out.incubatorMsg = incData.message || 'لا توجد حاضنات مسجّلة في قاعدة البيانات.';
    } catch {
      out.incubatorMsg = 'تعذر تحميل الحاضنات من الخادم.';
    }
    try {
      const platRes = await fetch('/api/hub/catalog/platforms', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const platData = await platRes.json().catch(() => ({}));
      out.platforms = (platData.platforms || []).map((p) => ({
        id: p.code,
        label: `${p.name_ar || p.code}${p.code ? ` (${p.code})` : ''}`,
      }));
      if (!out.platforms.length) out.platformMsg = platData.message || 'لا توجد منصات مسجّلة في قاعدة البيانات.';
    } catch {
      out.platformMsg = 'تعذر تحميل المنصات من الخادم.';
    }
    return out;
  };

  const systemOptions = () => {
    const fromRent = window.HubRentStore?.catalogSystems?.() || [];
    if (fromRent.length) {
      return fromRent.map((s) => ({
        id: s.code,
        label: `${s.nameAr || s.code}${s.isLive ? ' — جاهز' : ''}`,
      }));
    }
    const apps = window.HubMarketplaceData?.APPS || [];
    const filtered = apps.filter((a) => a.code && a.kind !== 'sovereign');
    if (filtered.length) {
      return filtered.map((a) => ({ id: String(a.code).toUpperCase(), label: a.nameAr || a.code }));
    }
    return [
      { id: 'ERP', label: 'ERP' },
      { id: 'CRM', label: 'CRM' },
      { id: 'LMS', label: 'LMS' },
      { id: 'ACADEMY', label: 'Academy' },
    ];
  };

  const selectedLabel = (name) =>
    form?.querySelector(`[name="${name}"]`)?.selectedOptions?.[0]?.textContent?.trim() || '';

  const checkSubdomain = () => {
    const input = form?.querySelector('[name="subdomain"]');
    if (!input || !statusEl || !grants()) return;
    const raw = grants().normalizeSlug(input.value);
    input.value = raw;
    const res = grants().validateSubdomain(raw);
    subdomainOk = Boolean(res.available);
    statusEl.innerHTML = res.available
      ? `<i class="fas fa-circle-check"></i> ${esc(res.message)}`
      : raw
        ? `<i class="fas fa-circle-xmark"></i> ${esc(res.message)}`
        : esc(res.message);
    statusEl.className = `hub-book-subdomain-status ${res.available ? 'is-ok' : raw ? 'is-bad' : ''}`;
  };

  const fillForm = async () => {
    const params = new URLSearchParams(window.location.search);
    const geoHost = form?.querySelector('[data-hub-geo-branch]');
    if (geoHost && window.HubGeoBranch) {
      window.HubGeoBranch.mount(geoHost, {
        required: true,
        title: 'اكتب اسم الفرع التابع لك أو حدّد موقعك',
        values: {
          branchName: params.get('branchLabel') || (/^br-/i.test(params.get('branch') || '') ? '' : params.get('branch') || ''),
          country: params.get('country') || '',
          city: params.get('city') || '',
          lat: params.get('lat') || '',
          lng: params.get('lng') || '',
          locationSource: params.get('locationSource') || 'manual',
        },
      });
    }
    const catalog = await loadCatalogOptions();
    const incEl = form?.querySelector('[name="incubator"]');
    const platEl = form?.querySelector('[name="platform"]');
    fillSelect(incEl, catalog.incubators, catalog.incubators.length ? 'اختر حاضنة مسجّلة' : '— لا توجد حاضنات مسجّلة —', params.get('incubator') || '');
    fillSelect(platEl, catalog.platforms, catalog.platforms.length ? 'اختر منصة مسجّلة' : '— لا توجد منصات مسجّلة —', params.get('platform') || params.get('code') || '');
    if (incEl && !catalog.incubators.length) {
      incEl.setAttribute('disabled', 'disabled');
      const hint = document.createElement('p');
      hint.className = 'hub-book-feedback is-error';
      hint.style.marginTop = '6px';
      hint.textContent = catalog.incubatorMsg || 'لا يمكن التسجيل بدون حاضنات مسجّلة.';
      incEl.parentElement?.insertBefore(hint, incEl.nextSibling);
    }
    if (platEl && !catalog.platforms.length) {
      platEl.setAttribute('disabled', 'disabled');
      const hint = document.createElement('p');
      hint.className = 'hub-book-feedback is-error';
      hint.style.marginTop = '6px';
      hint.textContent = catalog.platformMsg || 'لا يمكن التسجيل بدون منصات مسجّلة.';
      platEl.parentElement?.insertBefore(hint, platEl.nextSibling);
    }
    fillSelect(form?.querySelector('[name="requestedSystem"]'), systemOptions(), 'اختر النظام', params.get('system') || '');
  };

  const categoryLabel = (cat) => {
    if (cat === 'image') return 'الصورة';
    if (cat === 'video') return 'الفيديو';
    return 'الملف';
  };

  const renderLists = () => {
    ['image', 'document', 'video'].forEach((category) => {
      const list = root.querySelector(`[data-reg-list="${category}"]`);
      if (!list) return;
      const items = pendingFiles.filter((f) => f.category === category);
      if (!items.length) {
        list.hidden = true;
        list.innerHTML = '';
        return;
      }
      list.hidden = false;
      list.innerHTML = items
        .map((item) => {
          const thumb =
            item.category === 'image' && item.previewUrl
              ? `<img class="hub-reg-file-thumb" src="${esc(item.previewUrl)}" alt="" />`
              : `<span class="hub-reg-file-thumb is-icon" aria-hidden="true"><i class="fas ${
                  item.category === 'video' ? 'fa-video' : item.category === 'image' ? 'fa-image' : 'fa-file'
                }"></i></span>`;
          const statusText =
            item.status === 'uploading'
              ? `جارٍ رفع ${categoryLabel(item.category)} — ${item.progress || 0}%`
              : item.status === 'ready'
                ? `تم رفع ${categoryLabel(item.category)} بنجاح`
                : item.status === 'error'
                  ? item.error || `تعذر رفع ${categoryLabel(item.category)}، حاول مرة أخرى.`
                  : item.status === 'queued'
                    ? 'بانتظار الرفع…'
                    : 'جاهز للإرسال';
          return `<li class="hub-reg-file-item ${item.status === 'error' ? 'is-error' : item.status === 'ready' ? 'is-ok' : ''}" data-file-id="${esc(item.id)}">
            ${thumb}
            <div class="hub-reg-file-meta">
              <strong title="${esc(item.file.name)}">${esc(item.file.name)}</strong>
              <small>${esc(item.file.type || extOf(item.file.name) || 'ملف')} · ${esc(formatSize(item.file.size))} · ${esc(statusText)}</small>
              ${
                item.status === 'uploading' || item.status === 'queued'
                  ? `<div class="hub-reg-file-progress" aria-hidden="true"><span style="width:${item.progress || 0}%"></span></div>`
                  : ''
              }
            </div>
            <div class="hub-reg-file-actions">
              ${
                item.status === 'uploading'
                  ? `<button type="button" data-cancel-file="${esc(item.id)}">إلغاء الرفع</button>`
                  : ''
              }
              ${
                item.status === 'error'
                  ? `<button type="button" data-retry-file="${esc(item.id)}">إعادة المحاولة</button>`
                  : ''
              }
              ${
                item.status !== 'uploading'
                  ? `<button type="button" class="is-danger" data-remove-file="${esc(item.id)}">حذف</button>`
                  : ''
              }
              ${
                item.category === 'image' && item.status !== 'uploading'
                  ? `<button type="button" data-replace-file="${esc(item.id)}">استبدال</button>`
                  : ''
              }
            </div>
          </li>`;
        })
        .join('');
    });
  };

  const addFiles = (category, fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    for (const file of files) {
      if (!fileAllowed(file, category)) {
        setAttachStatus(
          category === 'image'
            ? 'صيغة الصورة غير مدعومة (JPG/JPEG/PNG/WEBP)'
            : category === 'video'
              ? 'صيغة الفيديو غير مدعومة (MP4/MOV/WEBM)'
              : 'صيغة الملف غير مدعومة',
          true
        );
        continue;
      }
      if (file.size > MAX_VIDEO_BYTES()) {
        setAttachStatus(`حجم الملف أكبر من ${Math.round(MAX_VIDEO_BYTES() / 1024 / 1024)} MB`, true);
        continue;
      }
      const item = {
        id: uid(),
        category,
        file,
        status: 'pending',
        progress: 0,
      };
      if (category === 'image') {
        try {
          item.previewUrl = URL.createObjectURL(file);
        } catch {
          /* ignore */
        }
      }
      pendingFiles.push(item);
    }
    setAttachStatus('');
    renderLists();
  };

  const removeFile = (id) => {
    const idx = pendingFiles.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const item = pendingFiles[idx];
    if (item.controller) {
      try {
        item.controller.abort();
      } catch {
        /* ignore */
      }
    }
    if (item.previewUrl) {
      try {
        URL.revokeObjectURL(item.previewUrl);
      } catch {
        /* ignore */
      }
    }
    pendingFiles.splice(idx, 1);
    renderLists();
  };

  const replaceImage = (id) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      removeFile(id);
      addFiles('image', [file]);
    };
    input.click();
  };

  const createServerRequest = async (payload) => {
    const res = await fetch('/api/hub/register-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'تعذّر إنشاء طلب التسجيل على السيرفر');
    }
    return data;
  };

  const uploadOne = async (item, requestId, uploadToken) => {
    item.status = 'uploading';
    item.progress = 0;
    item.error = '';
    item.controller = new AbortController();
    renderLists();

    const label = categoryLabel(item.category);
    try {
      const data = await window.HubUploadLimits.uploadFile(item.file, {
        url: `/api/hub/register-requests/${encodeURIComponent(requestId)}/attachments`,
        headers: {
          'X-Register-Upload-Token': uploadToken,
          'X-Attachment-Category': item.category,
        },
        signal: item.controller.signal,
        onProgress: (pct) => {
          item.progress = pct;
          renderLists();
          setAttachStatus(`جارٍ رفع ${label} — ${pct}%`);
        },
      });
      item.status = 'ready';
      item.progress = 100;
      item.attachment = data.attachment || data;
      setAttachStatus(`تم رفع ${label} بنجاح`);
      renderLists();
      return item.attachment;
    } catch (err) {
      const aborted = String(err?.message || '').includes('أُلغي');
      item.status = aborted ? 'pending' : 'error';
      item.error = aborted ? '' : err?.message || `تعذر رفع ${label}، حاول مرة أخرى.`;
      if (!aborted) setAttachStatus(item.error, true);
      renderLists();
      if (!aborted) throw err;
      return null;
    } finally {
      item.controller = null;
    }
  };

  const uploadAll = async (requestId, uploadToken) => {
    const results = [];
    for (const item of pendingFiles) {
      if (item.status === 'ready' && item.attachment) {
        results.push(item.attachment);
        continue;
      }
      item.status = 'queued';
      renderLists();
      const att = await uploadOne(item, requestId, uploadToken);
      if (att) results.push(att);
      else if (item.status === 'error') {
        throw new Error(item.error || 'فشل رفع أحد المرفقات');
      }
    }
    return results;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!form || !grants()) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    checkSubdomain();
    if (!subdomainOk) {
      toast('تحقق من توفر النطاق الفرعي أولًا');
      return;
    }
    if (isUploading()) {
      toast('يرجى الانتظار حتى يكتمل رفع المرفقات.');
      setAttachStatus('يرجى الانتظار حتى يكتمل رفع المرفقات.', true);
      return;
    }

    const fd = new FormData(form);
    const geoHost = form?.querySelector('[data-hub-geo-branch]');
    const geo = window.HubGeoBranch?.validate?.(geoHost, { required: true });
    if (!geo?.ok) {
      toast(geo?.error || 'اكتب اسم الفرع التابع لك أو حدّد موقعك');
      return;
    }
    const g = geo.data || {};
    const payload = {
      source: 'register',
      companyName: selectedLabel('platform') || String(fd.get('fullName') || '').trim(),
      subdomain: String(fd.get('subdomain') || '').trim(),
      slug: String(fd.get('subdomain') || '').trim(),
      host: `${grants().normalizeSlug(String(fd.get('subdomain') || ''))}.${grants().BASE_DOMAIN}`,
      adminName: String(fd.get('fullName') || '').trim(),
      adminPhone: String(fd.get('phone') || '').trim(),
      adminEmail: String(fd.get('email') || '').trim(),
      adminPassword: String(fd.get('password') || ''),
      country: String(g.country || fd.get('country') || '').trim(),
      city: String(g.city || '').trim(),
      address: String(g.address || '').trim(),
      branch: String(g.branchName || fd.get('branch') || '').trim(),
      branchName: String(g.branchName || fd.get('branch') || '').trim(),
      branchLabel: String(g.branchName || fd.get('branch') || '').trim(),
      lat: g.lat != null ? g.lat : null,
      lng: g.lng != null ? g.lng : null,
      locationSource: g.locationSource || 'manual',
      locationConfirmed: !!g.locationConfirmed,
      incubator: String(fd.get('incubator') || '').trim(),
      incubatorLabel: selectedLabel('incubator'),
      platform: String(fd.get('platform') || '').trim(),
      platformLabel: selectedLabel('platform'),
      requestedSystem: String(fd.get('requestedSystem') || '').trim(),
      requestedSystemLabel: selectedLabel('requestedSystem'),
      notes: String(fd.get('notes') || '').trim(),
    };

    if (submitBtn) submitBtn.disabled = true;
    toast('جارٍ إنشاء طلب التسجيل…');

    try {
      // 1) إنشاء الطلب أولًا للحصول على Request ID ثم رفع المرفقات إليه
      const created = await createServerRequest(payload);
      const requestId = created.requestId;
      const uploadToken = created.uploadToken;

      let attachments = [];
      if (pendingFiles.length) {
        setAttachStatus('يرجى الانتظار حتى يكتمل رفع المرفقات.');
        toast('يرجى الانتظار حتى يكتمل رفع المرفقات.');
        attachments = await uploadAll(requestId, uploadToken);
      }

      // 2) مرآة محلية لمسار الموافقة الحالي (لوحة الإدارة / موافقات المدير الأعلى)
      const localRes = grants().submitRequest({
        ...payload,
        id: requestId,
        attachments: attachments.map((a) => ({
          id: a.id,
          category: a.category,
          fileName: a.fileName,
          originalFileName: a.originalFileName,
          fileType: a.fileType,
          mimeType: a.mimeType,
          fileSize: a.fileSize,
          storageRef: a.storageRef,
          uploadStatus: a.uploadStatus || 'ready',
          createdAt: a.createdAt,
          contentUrl: `/api/hub/register-attachments/${encodeURIComponent(a.id)}/content`,
        })),
      });

      if (String(fd.get('branch') || '').trim() && window.HubClientBranches?.grantFromBooking) {
        window.HubClientBranches.grantFromBooking({
          email: String(fd.get('email') || '').trim(),
          branch: String(fd.get('branch') || '').trim(),
          branchLabel: selectedLabel('branch'),
          source: 'register',
        });
      }

      const localOk = localRes?.ok !== false;
      toast(
        `<div class="hub-reg-success-box">تم إرسال طلب التسجيل بنجاح.<br/>رقم الطلب: <code dir="ltr">${esc(
          requestId
        )}</code><br/>حالة الطلب: بانتظار المراجعة${
          attachments.length ? `<br/>المرفقات: ${attachments.length}` : ''
        }${localOk ? '' : '<br/><small>تم الحفظ على السيرفر — حدّث لوحة الإدارة إن لزم.</small>'}</div>`,
        true
      );

      pendingFiles.splice(0, pendingFiles.length);
      renderLists();
      setAttachStatus('');
      form.reset();
      subdomainOk = false;
      fillForm();
      window.HubRegistrationGuard?.clearPlatformRegisterDraft?.();
      // Successful platform request is NOT an authenticated Hub session
      if (statusEl) {
        statusEl.textContent = 'أدخل النطاق الفرعي للتحقق من توفره';
        statusEl.className = 'hub-book-subdomain-status';
      }
    } catch (err) {
      toast(err?.message || 'تعذّر إرسال الطلب', false);
      // لا تمسح بيانات النموذج أو المرفقات عند فشل رفع ملف واحد
      // API failure must not leave auth residue that blocks later Login
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  };

  const bindAttachments = () => {
    root.querySelectorAll('[data-reg-drop]').forEach((zone) => {
      const category = zone.getAttribute('data-reg-drop');
      const input = zone.querySelector('[data-reg-input]');
      input?.addEventListener('change', () => {
        addFiles(category, input.files);
        input.value = '';
      });

      ['dragenter', 'dragover'].forEach((evt) => {
        zone.addEventListener(evt, (e) => {
          e.preventDefault();
          zone.classList.add('is-dragover');
        });
      });
      ['dragleave', 'drop'].forEach((evt) => {
        zone.addEventListener(evt, (e) => {
          e.preventDefault();
          zone.classList.remove('is-dragover');
        });
      });
      zone.addEventListener('drop', (e) => {
        const files = e.dataTransfer?.files;
        if (files?.length) addFiles(category, files);
      });
    });

    root.addEventListener('click', (event) => {
      const t = event.target;
      if (!(t instanceof HTMLElement)) return;
      const removeId = t.getAttribute('data-remove-file');
      if (removeId) {
        removeFile(removeId);
        return;
      }
      const cancelId = t.getAttribute('data-cancel-file');
      if (cancelId) {
        const item = pendingFiles.find((f) => f.id === cancelId);
        item?.controller?.abort();
        return;
      }
      const retryId = t.getAttribute('data-retry-file');
      if (retryId) {
        const item = pendingFiles.find((f) => f.id === retryId);
        if (item) {
          item.status = 'pending';
          item.error = '';
          item.progress = 0;
          renderLists();
          setAttachStatus('سيتم إعادة محاولة الرفع عند الإرسال.');
        }
        return;
      }
      const replaceId = t.getAttribute('data-replace-file');
      if (replaceId) replaceImage(replaceId);
    });
  };

  const collectRegisterDraft = () => {
    if (!form) return {};
    const fd = new FormData(form);
    return {
      fullName: String(fd.get('fullName') || ''),
      phone: String(fd.get('phone') || ''),
      email: String(fd.get('email') || ''),
      country: String(fd.get('country') || ''),
      branch: String(fd.get('branch') || ''),
      incubator: String(fd.get('incubator') || ''),
      platform: String(fd.get('platform') || ''),
      requestedSystem: String(fd.get('requestedSystem') || ''),
      subdomain: String(fd.get('subdomain') || ''),
      notes: String(fd.get('notes') || ''),
    };
  };

  const persistRegisterDraft = () => {
    // Draft ≠ Auth: never creates Customer/Employee/session/token
    window.HubRegistrationGuard?.savePlatformRegisterDraft?.(collectRegisterDraft());
  };

  const restoreRegisterDraft = () => {
    const fields = window.HubRegistrationGuard?.loadPlatformRegisterDraft?.();
    if (!fields || !form) return;
    Object.entries(fields).forEach(([name, value]) => {
      const el = form.querySelector(`[name="${name}"]`);
      if (!el || el.type === 'password' || value == null || value === '') return;
      if (name === 'branch' || name === 'country') {
        /* restored via HubGeoBranch mount values */
        return;
      }
      el.value = String(value);
    });
    const geoHost = form?.querySelector('[data-hub-geo-branch]');
    if (geoHost && window.HubGeoBranch && (fields.branch || fields.country)) {
      window.HubGeoBranch.mount(geoHost, {
        required: true,
        values: {
          branchName: fields.branchName || fields.branchLabel || fields.branch || '',
          country: fields.country || '',
          city: fields.city || '',
        },
      });
    }
  };

  const bind = async () => {
    fillForm();
    bindAttachments();
    window.HubRegistrationGuard?.assertNoAuthSideEffects?.();

    const suffix = root.querySelector('[data-subdomain-suffix]');
    if (suffix && grants()) suffix.textContent = `.${grants().BASE_DOMAIN}`;

    let timer = null;
    form?.querySelector('[name="subdomain"]')?.addEventListener('input', () => {
      clearTimeout(timer);
      subdomainOk = false;
      if (statusEl) {
        statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ التحقق…';
        statusEl.className = 'hub-book-subdomain-status';
      }
      timer = setTimeout(checkSubdomain, 400);
      persistRegisterDraft();
    });

    form?.querySelectorAll('input, select, textarea').forEach((el) => {
      if (el.name === 'password' || el.name === 'subdomain' || el.name === 'country') return;
      el.addEventListener('input', persistRegisterDraft);
      el.addEventListener('change', persistRegisterDraft);
    });

    // Login links from this page must allow any existing account (defect #10)
    root.querySelectorAll('a[href="login.html"], a[href="./login.html"]').forEach((a) => {
      a.setAttribute(
        'href',
        window.HubRegistrationGuard?.loginUrlFromRegistration?.({ from: 'register' }) ||
          'login.html?switch=1&from=register'
      );
    });
    document.querySelectorAll('header a[href="login.html"], header a[href="./login.html"]').forEach((a) => {
      a.setAttribute('href', 'login.html?switch=1&from=register');
    });

    form?.addEventListener('submit', onSubmit);
    try {
      await grants()?.hydrate?.();
    } catch {
      /* local ok */
    }
    restoreRegisterDraft();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
