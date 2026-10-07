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

  const COUNTRIES = [
    'المملكة العربية السعودية',
    'الإمارات العربية المتحدة',
    'الكويت',
    'قطر',
    'البحرين',
    'عُمان',
    'الأردن',
    'مصر',
    'العراق',
    'سوريا',
    'لبنان',
    'فلسطين',
    'اليمن',
    'المغرب',
    'الجزائر',
    'تونس',
    'ليبيا',
    'السودان',
    'موريتانيا',
    'تركيا',
    'أخرى',
  ];

  const COUNTRY_ALIASES = {
    'المملكة العربية السعودية': ['السعودية'],
    'الإمارات العربية المتحدة': ['الإمارات'],
    إنجلترا: ['إنجلترا', 'بريطانيا'],
    أمريكا: ['أمريكا', 'الولايات المتحدة'],
  };

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

  const countryList = () => {
    const fromBranches = (window.HubBranchesData?.COUNTRIES || []).map((c) => c.nameAr);
    const seen = new Set();
    const out = [];
    [...fromBranches, ...COUNTRIES].forEach((name) => {
      const n = String(name || '').trim();
      if (!n || seen.has(n)) return;
      seen.add(n);
      out.push(n);
    });
    return out;
  };

  const branchMatchesCountry = (branch, country) => {
    if (!country) return false;
    const aliases = COUNTRY_ALIASES[country] || [];
    const hay = [branch.nameAr, branch.nameEn, branch.code].map((x) => String(x || '').trim()).filter(Boolean);
    const needles = [country, ...aliases];
    return hay.some((n) => needles.some((c) => c && (n === c || n.includes(c) || c.includes(n))));
  };

  const branchOptions = (country = '') => {
    const list = window.HubBranchesData?.BRANCHES || [];
    if (!country) return [];
    const matched = list.filter((b) => b.code !== 'HQ' && branchMatchesCountry(b, country));
    if (matched.length) {
      return matched.map((b) => ({
        id: b.id,
        label: `${b.nameAr}${b.type ? ` — ${b.type}` : ''}`,
      }));
    }
    return [{ id: `br-${country}`, label: `فرع ${country}` }];
  };

  const lockBranch = (placeholder) => {
    const el = form?.querySelector('[name="branch"]');
    if (!el) return;
    fillSelect(el, [], placeholder);
    el.disabled = true;
  };

  const unlockBranch = (country, selected) => {
    const el = form?.querySelector('[name="branch"]');
    if (!el) return;
    const options = branchOptions(country);
    fillSelect(el, options, 'اختر اسم الفرع', selected);
    el.disabled = !country;
    if (options.length === 1 && country) el.value = options[0].id;
  };

  const incubatorOptions = () => {
    const list = window.HubIncubatorsData?.INCUBATORS || [];
    if (list.length) {
      return list.slice(0, 80).map((inc) => ({
        id: inc.id,
        label: `${inc.num ? `${inc.num}. ` : ''}${inc.name}${inc.sector ? ` — ${inc.sector}` : ''}`,
      }));
    }
    return [
      { id: 'inc-edu', label: 'التعليم والتعلم' },
      { id: 'inc-digital', label: 'التسويق الرقمي' },
      { id: 'inc-health', label: 'الصحة والجمال' },
      { id: 'inc-business', label: 'عالم الأعمال' },
    ];
  };

  const platformOptions = () => {
    const list = window.HubSovereignPlatforms?.list || [];
    if (list.length) {
      return list.map((p) => ({
        id: p.code,
        label: `${p.nameAr}${p.role ? ` — ${p.role}` : ''}`,
      }));
    }
    return [
      { id: 'core', label: 'المنصة المركزية' },
      { id: 'ops', label: 'منصة التشغيل' },
      { id: 'gov', label: 'منصة الحوكمة' },
    ];
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

  const fillForm = () => {
    const params = new URLSearchParams(window.location.search);
    fillSelect(form?.querySelector('[name="country"]'), countryList(), 'اختر الدولة', params.get('country') || '');
    fillSelect(form?.querySelector('[name="incubator"]'), incubatorOptions(), 'اختر اسم الحاضنة', params.get('incubator') || '');
    fillSelect(form?.querySelector('[name="platform"]'), platformOptions(), 'اختر اسم المنصة', params.get('platform') || params.get('code') || '');
    fillSelect(form?.querySelector('[name="requestedSystem"]'), systemOptions(), 'اختر النظام', params.get('system') || '');
    const country = params.get('country') || '';
    if (country) unlockBranch(country, params.get('branch') || '');
    else lockBranch('اختر الدولة أولاً');
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
      country: String(fd.get('country') || '').trim(),
      branch: String(fd.get('branch') || '').trim(),
      branchLabel: selectedLabel('branch'),
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
      if (statusEl) {
        statusEl.textContent = 'أدخل النطاق الفرعي للتحقق من توفره';
        statusEl.className = 'hub-book-subdomain-status';
      }
    } catch (err) {
      toast(err?.message || 'تعذّر إرسال الطلب', false);
      // لا تمسح بيانات النموذج أو المرفقات عند فشل رفع ملف واحد
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

  const bind = async () => {
    fillForm();
    bindAttachments();

    const suffix = root.querySelector('[data-subdomain-suffix]');
    if (suffix && grants()) suffix.textContent = `.${grants().BASE_DOMAIN}`;

    form?.querySelector('[name="country"]')?.addEventListener('change', (event) => {
      const country = String(event.target.value || '').trim();
      if (!country) lockBranch('اختر الدولة أولاً');
      else unlockBranch(country);
    });

    let timer = null;
    form?.querySelector('[name="subdomain"]')?.addEventListener('input', () => {
      clearTimeout(timer);
      subdomainOk = false;
      if (statusEl) {
        statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ التحقق…';
        statusEl.className = 'hub-book-subdomain-status';
      }
      timer = setTimeout(checkSubdomain, 400);
    });

    form?.addEventListener('submit', onSubmit);
    try {
      await grants()?.hydrate?.();
    } catch {
      /* local ok */
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
