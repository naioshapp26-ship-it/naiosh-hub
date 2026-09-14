/**
 * Customer articles UI — blog.html
 * Views: home CTAs · submit wizard (4 steps) · my articles · article detail
 */
(() => {
  'use strict';

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fmt = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return String(iso).slice(0, 16);
    }
  };

  const A = () => window.HubArticles;
  const sessionId = (() => {
    const k = 'naiosh_art_session';
    let id = sessionStorage.getItem(k);
    if (!id) {
      id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(k, id);
    }
    return id;
  })();

  const ui = {
    view: 'home', // home | submit | mine | detail | success
    step: 1,
    draftId: '',
    successId: '',
    detailId: '',
    contentMode: '',
    errors: {},
    autosaveAt: '',
    helpOpen: false,
  };

  const draft = () => (ui.draftId ? A()?.get(ui.draftId) : null);

  const ensureDraft = () => {
    if (ui.draftId && A()?.get(ui.draftId)) return A().get(ui.draftId);
    const u = window.HubAuth?.getUser?.();
    const row = A().createDraft(
      {
        authorName: u?.name || u?.fullName || '',
        authorEmail: u?.email || '',
        sessionId,
      },
      u?.name || 'زائر'
    );
    ui.draftId = row.id;
    return row;
  };

  const collectStep1 = (root) => {
    const title = root.querySelector('[name="title"]')?.value?.trim() || '';
    const category = root.querySelector('[name="category"]')?.value?.trim() || '';
    const summary = root.querySelector('[name="summary"]')?.value?.trim() || '';
    const authorName = root.querySelector('[name="authorName"]')?.value?.trim() || '';
    const company = root.querySelector('[name="company"]')?.value?.trim() || '';
    const tags = root.querySelector('[name="tags"]')?.value || '';
    const errors = {};
    if (!title) errors.title = 'عنوان المقال مطلوب.';
    if (!category) errors.category = 'يرجى اختيار التصنيف.';
    if (!summary) errors.summary = 'النبذة المختصرة مطلوبة.';
    ui.errors = errors;
    if (Object.keys(errors).length) return null;
    return A().update(
      ui.draftId,
      { title, category, summary, authorName, company, tags },
      authorName || 'كاتب'
    );
  };

  const collectStep2 = (root) => {
    const body = root.querySelector('[name="body"]')?.value || '';
    const article = draft();
    const patch = { body, contentMode: ui.contentMode || article?.contentMode || 'write' };
    A().update(ui.draftId, patch);
    const row = A().get(ui.draftId);
    if (!String(row.body || '').trim() && !row.articleFile) {
      ui.errors = { content: 'يرجى كتابة المقال أو رفع ملف.' };
      return null;
    }
    ui.errors = {};
    return row;
  };

  const statusClass = (st) => {
    if (st === 'Draft') return 'is-draft';
    if (st === 'Pending Review') return 'is-pending';
    if (st === 'Under Review') return 'is-review';
    if (st === 'Needs Changes') return 'is-needs';
    if (st === 'Published' || st === 'Approved') return 'is-ok';
    return '';
  };

  const readHash = () => {
    const h = (location.hash || '').replace(/^#/, '');
    if (h.startsWith('success')) {
      ui.view = 'success';
      const m = h.match(/success\/(ART-[\w-]+)/);
      if (m) ui.successId = m[1];
      return;
    }
    if (h.startsWith('submit')) {
      ui.view = 'submit';
      const m = h.match(/submit\/(ART-[\w-]+)/);
      if (m) ui.draftId = m[1];
      return;
    }
    if (h.startsWith('mine')) {
      const m = h.match(/mine\/(ART-[\w-]+)/);
      if (m) {
        ui.view = 'detail';
        ui.detailId = m[1];
      } else ui.view = 'mine';
      return;
    }
    if (h === 'posts' || h === '') ui.view = 'home';
  };

  const setHash = (h) => {
    if (location.hash.replace(/^#/, '') === h) return;
    location.hash = h;
  };

  const fileMeta = (file, extra = {}) => ({
    name: file.name,
    mime: file.type || '',
    size: file.size || 0,
    url: extra.url || '',
    uploadedAt: new Date().toISOString(),
    status: extra.status || 'local',
  });

  const formatSize = (n) => {
    const b = Number(n) || 0;
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  const acceptArticle = () => A()?.settings?.()?.articleExts?.join(',') || '.docx,.pdf,.txt';
  const acceptCover = () => A()?.settings?.()?.coverExts?.join(',') || '.jpg,.jpeg,.png,.webp';

  const validateExt = (name, list) => {
    const lower = String(name || '').toLowerCase();
    return (list || []).some((ext) => lower.endsWith(ext));
  };

  async function attachArticleFile(file) {
    const settings = A().settings();
    const max = (settings.maxArticleMb || 15) * 1024 * 1024;
    if (!validateExt(file.name, settings.articleExts)) {
      alert('الصيغ المسموحة: DOCX · PDF · TXT');
      return;
    }
    if (file.size > max) {
      alert(`الحجم الأقصى ${settings.maxArticleMb} ميجابايت`);
      return;
    }
    let meta = fileMeta(file, { status: 'uploading' });
    A().update(ui.draftId, { articleFile: meta, contentMode: 'file' });
    ui.contentMode = 'file';
    try {
      if (window.HubUploadLimits?.uploadFile) {
        const up = await window.HubUploadLimits.uploadFile(file);
        meta = fileMeta(file, { url: up.url, status: 'ok' });
        meta.name = up.name || file.name;
        meta.size = up.size || file.size;
        meta.mime = up.mime || file.type;
      } else {
        meta.status = 'ok';
      }
      A().update(ui.draftId, { articleFile: meta, contentMode: 'file' });
    } catch (e) {
      meta.status = 'error';
      A().update(ui.draftId, { articleFile: meta });
      alert(e?.message || 'فشل الرفع');
    }
    paint();
  }

  async function attachCover(file) {
    const settings = A().settings();
    const max = (settings.maxCoverMb || 5) * 1024 * 1024;
    if (!validateExt(file.name, settings.coverExts)) {
      alert('صورة الغلاف: JPG · PNG · WEBP');
      return;
    }
    if (file.size > max) {
      alert(`الحجم الأقصى لصورة الغلاف ${settings.maxCoverMb} ميجابايت`);
      return;
    }
    let meta = fileMeta(file, { status: 'uploading' });
    A().update(ui.draftId, { coverImage: meta });
    try {
      if (window.HubUploadLimits?.uploadFile) {
        const up = await window.HubUploadLimits.uploadFile(file);
        meta = fileMeta(file, { url: up.url, status: 'ok' });
      } else {
        const dataUrl = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        meta.url = String(dataUrl);
        meta.status = 'ok';
      }
      A().update(ui.draftId, { coverImage: meta });
    } catch (e) {
      alert(e?.message || 'فشل رفع الصورة');
    }
    paint();
  }

  async function attachExtra(file) {
    const article = draft();
    const list = [...(article?.attachments || [])];
    let meta = fileMeta(file, { status: 'ok' });
    try {
      if (window.HubUploadLimits?.uploadFile) {
        const up = await window.HubUploadLimits.uploadFile(file);
        meta = fileMeta(file, { url: up.url, status: 'ok' });
      }
    } catch (_) {}
    list.push(meta);
    A().update(ui.draftId, { attachments: list });
    paint();
  }

  const stepperHtml = (step) => {
    const items = [
      [1, 'بيانات المقال'],
      [2, 'المحتوى'],
      [3, 'المراجعة'],
      [4, 'الإرسال'],
    ];
    return `<div class="art-stepper" aria-label="خطوات الإرسال">
      ${items
        .map(([n, label]) => {
          const cls = n < step ? 'is-done' : n === step ? 'is-current' : '';
          return `<div class="art-step ${cls}"><span>${n}</span>${esc(label)}</div>`;
        })
        .join('')}
    </div>
    <p class="art-step-lead">الخطوة ${step} من 4 — ${esc(items[step - 1][1])}</p>`;
  };

  const field = (name, label, control, required = false) => {
    const err = ui.errors[name];
    return `<div class="art-field ${err ? 'has-error' : ''}">
      <label>${esc(label)}${required ? ' <span class="req">*</span>' : ''}</label>
      ${control}
      <div class="err">${esc(err || '')}</div>
    </div>`;
  };

  const renderStep1 = (a) => {
    const cats = A().CATEGORIES.map(
      (c) => `<option value="${esc(c)}" ${a.category === c ? 'selected' : ''}>${esc(c)}</option>`
    ).join('');
    return `
      ${stepperHtml(1)}
      <h2>بيانات المقال</h2>
      <p class="art-step-lead">ابدأ بالمعلومات الأساسية للمقال.</p>
      <div class="art-form">
        ${field('title', 'عنوان المقال', `<input name="title" value="${esc(a.title || '')}" placeholder="مثال: كيف تخفض تكاليف التشغيل خلال 30 يوماً" />`, true)}
        ${field('category', 'التصنيف', `<select name="category"><option value="">اختر التصنيف</option>${cats}</select>`, true)}
        ${field('summary', 'نبذة مختصرة', `<textarea name="summary" placeholder="اكتب ملخصاً قصيراً يوضح فكرة المقال...">${esc(a.summary || '')}</textarea>`, true)}
        ${field('authorName', 'الكاتب', `<input name="authorName" value="${esc(a.authorName || '')}" />`)}
        ${field('company', 'الجهة / الشركة (اختياري)', `<input name="company" value="${esc(a.company || '')}" />`)}
        ${field('tags', 'Tags (اختياري)', `<input name="tags" value="${esc((a.tags || []).join(', '))}" placeholder="تشغيل, تكاليف, فروع" />`)}
      </div>
      <div class="art-autosave">${ui.autosaveAt ? `✓ تم الحفظ تلقائياً ${esc(ui.autosaveAt)}` : ''}</div>
      <div class="art-footer">
        <button type="button" class="btn btn-ghost" data-art="cancel">إلغاء</button>
        <div class="art-footer-end">
          <button type="button" class="btn btn-secondary" data-art="save-draft">حفظ كمسودة</button>
          <button type="button" class="btn btn-primary" data-art="next-1">التالي: إضافة المحتوى ←</button>
        </div>
      </div>`;
  };

  const renderFileZone = (a) => {
    const f = a.articleFile;
    const settings = A().settings();
    return `<div class="art-drop">
      <strong>رفع ملف المقال</strong>
      <p>الصيغ المقبولة: DOCX · PDF · TXT — الحد الأقصى ${esc(String(settings.maxArticleMb))} ميجابايت.<br>
      الصور يمكن أن تكون داخل الملف، أو ارفع صورة غلاف منفصلة بالأسفل. يمكنك استبدال الملف لاحقاً.</p>
      <button type="button" class="btn btn-primary" data-art="pick-file"><i class="fas fa-file-arrow-up"></i> اختيار ملف</button>
      <input type="file" hidden data-art-file accept="${esc(acceptArticle())}" />
      ${
        f
          ? `<div class="art-file-card">
              <div>
                <div>${esc(f.name)}</div>
                <small>${esc(f.mime || 'ملف')} · ${esc(formatSize(f.size))}</small>
                <div class="ok">${f.status === 'ok' ? '✓ تم الرفع بنجاح' : f.status === 'uploading' ? 'جاري الرفع…' : 'بانتظار الرفع'}</div>
              </div>
              <div class="art-footer-end">
                ${f.url ? `<a class="btn btn-ghost btn-sm" href="${esc(f.url)}" target="_blank" rel="noopener">معاينة</a>` : ''}
                <button type="button" class="btn btn-ghost btn-sm" data-art="pick-file">استبدال</button>
                <button type="button" class="btn btn-dark btn-sm" data-art="clear-file">حذف</button>
              </div>
            </div>`
          : ''
      }
    </div>`;
  };

  const renderStep2 = (a) => {
    const mode = ui.contentMode || a.contentMode || '';
    return `
      ${stepperHtml(2)}
      <h2>أضف محتوى المقال</h2>
      <p class="art-step-lead">يمكنك كتابة المقال مباشرة أو رفعه كملف.</p>
      <div class="art-mode-pick">
        <button type="button" class="art-mode ${mode === 'write' ? 'is-on' : ''}" data-art="mode-write">✍ كتابة المقال<small>محرر نص بسيط</small></button>
        <button type="button" class="art-mode ${mode === 'file' ? 'is-on' : ''}" data-art="mode-file">↑ رفع ملف<small>DOCX · PDF · TXT</small></button>
      </div>
      ${ui.errors.content ? `<p class="art-field has-error"><span class="err" style="display:block">${esc(ui.errors.content)}</span></p>` : ''}
      ${
        mode === 'write'
          ? `<div class="art-editor">
              <div class="art-editor-tools">
                <button type="button" data-art-fmt="bold"><b>B</b></button>
                <button type="button" data-art-fmt="h2">عنوان فرعي</button>
                <button type="button" data-art-fmt="ul">قائمة</button>
                <button type="button" data-art-fmt="link">رابط</button>
              </div>
              <textarea name="body" placeholder="اكتب مقالك هنا...">${esc(a.body || '')}</textarea>
            </div>`
          : mode === 'file'
            ? renderFileZone(a)
            : `<p class="art-step-lead">اختر طريقة إضافة المحتوى أعلاه للمتابعة.</p>`
      }
      <div class="art-form" style="margin-top:18px">
        <div class="art-field">
          <label>صورة المقال الرئيسية (اختياري)</label>
          <button type="button" class="btn btn-secondary btn-sm" data-art="pick-cover">رفع صورة</button>
          <input type="file" hidden data-art-cover accept="${esc(acceptCover())}" />
          ${
            a.coverImage
              ? `<div class="art-file-card"><span>${esc(a.coverImage.name)} · ${esc(formatSize(a.coverImage.size))}</span>
                  <button type="button" class="btn btn-ghost btn-sm" data-art="clear-cover">حذف</button></div>`
              : ''
          }
        </div>
        <div class="art-field">
          <label>مرفقات إضافية (اختياري)</label>
          <button type="button" class="btn btn-secondary btn-sm" data-art="pick-extra">إضافة مرفق</button>
          <input type="file" hidden data-art-extra />
          ${(a.attachments || []).map((f) => `<div class="art-file-card"><span>${esc(f.name)}</span></div>`).join('')}
        </div>
      </div>
      <div class="art-autosave">${ui.autosaveAt ? `✓ تم الحفظ تلقائياً ${esc(ui.autosaveAt)}` : ''}</div>
      <div class="art-footer">
        <button type="button" class="btn btn-ghost" data-art="prev">→ السابق</button>
        <div class="art-footer-end">
          <button type="button" class="btn btn-secondary" data-art="save-draft">حفظ كمسودة</button>
          <button type="button" class="btn btn-primary" data-art="next-2">التالي: المراجعة ←</button>
        </div>
      </div>`;
  };

  const checklist = (a) => {
    const items = [
      [!!a.title, 'تم إدخال العنوان', 'title'],
      [!!a.category, 'تم اختيار التصنيف', 'category'],
      [!!(a.body || a.articleFile), 'تم إضافة المحتوى', 'content'],
      [!!a.authorName, 'تم إضافة بيانات الكاتب', 'author'],
      [!!a.coverImage, 'صورة المقال', 'cover', true],
    ];
    return `<ul class="art-check">${items
      .map(([ok, label, , optional]) => {
        if (ok) return `<li><span class="ok">✓</span> ${esc(label)}</li>`;
        if (optional) {
          return `<li><span class="bad">✕</span> صورة المقال غير مضافة
            <button type="button" class="btn btn-ghost btn-sm" data-art="goto-2">إضافة الآن</button></li>`;
        }
        return `<li><span class="bad">✕</span> ${esc(label)}</li>`;
      })
      .join('')}</ul>`;
  };

  const renderStep3 = (a) => `
    ${stepperHtml(3)}
    <h2>راجع مقالك قبل الإرسال</h2>
    <p class="art-step-lead">تأكد أن كل شيء صحيح — بعد الإرسال سيصل لفريق المحتوى للمراجعة.</p>
    <div class="art-preview">
      ${a.coverImage?.url ? `<img src="${esc(a.coverImage.url)}" alt="" style="max-width:100%;border-radius:12px;margin-bottom:12px" />` : ''}
      <h3>${esc(a.title || 'بدون عنوان')}</h3>
      <div class="meta">${esc(a.authorName || '—')} · ${esc(a.category || '—')} · ${esc(a.company || '')}</div>
      <p><strong>الملخص:</strong> ${esc(a.summary || '—')}</p>
      ${a.body ? `<div style="white-space:pre-wrap;margin-top:12px;font-weight:600">${esc(a.body)}</div>` : ''}
      ${a.articleFile ? `<p style="margin-top:12px"><i class="fas fa-paperclip"></i> ملف: ${esc(a.articleFile.name)}</p>` : ''}
      ${(a.attachments || []).length ? `<p>مرفقات: ${esc(a.attachments.map((f) => f.name).join(' · '))}</p>` : ''}
    </div>
    ${checklist(a)}
    <div class="art-footer">
      <button type="button" class="btn btn-ghost" data-art="prev">رجوع للتعديل</button>
      <div class="art-footer-end">
        <button type="button" class="btn btn-secondary" data-art="save-draft">حفظ كمسودة</button>
        <button type="button" class="btn btn-primary" data-art="submit"><i class="fas fa-paper-plane"></i> إرسال للمراجعة</button>
      </div>
    </div>`;

  const renderSuccess = (a) => `
    <div class="art-success">
      <div class="big"><i class="fas fa-check"></i></div>
      <h2>تم إرسال مقالك بنجاح</h2>
      <p>رقم المقال</p>
      <code>${esc(a.id)}</code>
      <p>الحالة: <strong>${esc(a.statusAr || 'بانتظار المراجعة')}</strong></p>
      <p>تم استلام المقال وسيتم مراجعته قبل النشر. يمكنك متابعة حالته من صفحة مقالاتي.</p>
      <div class="art-success-actions">
        <button type="button" class="btn btn-primary" data-art="open-detail" data-id="${esc(a.id)}">متابعة المقال</button>
        <button type="button" class="btn btn-secondary" data-art="goto-mine">مقالاتي</button>
        <button type="button" class="btn btn-ghost" data-art="goto-home">العودة للمقالات</button>
      </div>
    </div>`;

  const renderSubmit = () => {
    if (!A()) return `<div class="art-shell"><p>تعذّر تحميل نظام المقالات.</p></div>`;
    if (ui.view === 'success' && ui.successId) {
      const a = A().get(ui.successId);
      return `<div class="art-shell">${a ? renderSuccess(a) : '<p>المقال غير موجود</p>'}</div>`;
    }
    const a = ensureDraft();
    let body = '';
    if (ui.step === 1) body = renderStep1(a);
    else if (ui.step === 2) body = renderStep2(a);
    else body = renderStep3(a);
    return `<div class="art-shell" id="art-wizard">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
        <h2 style="margin:0">إرسال مقال جديد</h2>
        <button type="button" class="btn btn-ghost btn-sm" data-art="help">؟ كيف أرسل مقالاً؟</button>
      </div>
      ${
        ui.helpOpen
          ? `<aside class="art-help-card"><div><strong>كيف أرسل مقالاً؟</strong>
              <p>1) أدخل بيانات المقال.<br>2) اكتب المحتوى أو ارفع ملفاً.<br>3) راجع المقال.<br>4) أرسله للمراجعة.<br>5) تابع حالته من «مقالاتي».</p></div></aside>`
          : ''
      }
      ${body}
    </div>`;
  };

  const renderMine = () => {
    const u = window.HubAuth?.getUser?.();
    const rows = A().list({ mine: true, email: u?.email, sessionId });
    return `<div class="art-shell">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
        <div>
          <h2 style="margin:0">مقالاتي</h2>
          <p class="art-step-lead">تابع حالة كل مقال أرسلته — من المسودة حتى النشر.</p>
        </div>
        <button type="button" class="btn btn-primary" data-art="start-submit"><i class="fas fa-plus"></i> ارفع مقالك</button>
      </div>
      <div class="art-table-wrap">
        <table class="art-table">
          <thead><tr>
            <th>Article ID</th><th>العنوان</th><th>التصنيف</th><th>تاريخ الإرسال</th><th>الحالة</th><th>آخر تحديث</th><th>الإجراءات</th>
          </tr></thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map((a) => {
                      const actions = [];
                      if (a.status === 'Draft') {
                        actions.push(`<button type="button" class="btn btn-primary btn-sm" data-art="edit" data-id="${esc(a.id)}">تعديل</button>`);
                        actions.push(`<button type="button" class="btn btn-ghost btn-sm" data-art="open-detail" data-id="${esc(a.id)}">معاينة</button>`);
                        actions.push(`<button type="button" class="btn btn-secondary btn-sm" data-art="send-now" data-id="${esc(a.id)}">إرسال</button>`);
                        actions.push(`<button type="button" class="btn btn-dark btn-sm" data-art="delete" data-id="${esc(a.id)}">حذف</button>`);
                      } else if (a.status === 'Needs Changes') {
                        actions.push(`<button type="button" class="btn btn-primary btn-sm" data-art="open-detail" data-id="${esc(a.id)}">عرض الملاحظات</button>`);
                        actions.push(`<button type="button" class="btn btn-secondary btn-sm" data-art="edit" data-id="${esc(a.id)}">تعديل وإعادة الإرسال</button>`);
                      } else if (a.status === 'Published') {
                        actions.push(`<a class="btn btn-primary btn-sm" href="#posts">عرض المقال</a>`);
                        actions.push(`<button type="button" class="btn btn-ghost btn-sm" data-art="open-detail" data-id="${esc(a.id)}">التفاصيل</button>`);
                      } else {
                        actions.push(`<button type="button" class="btn btn-primary btn-sm" data-art="open-detail" data-id="${esc(a.id)}">عرض</button>`);
                        actions.push(`<button type="button" class="btn btn-ghost btn-sm" data-art="open-detail" data-id="${esc(a.id)}">متابعة</button>`);
                      }
                      return `<tr>
                        <td><code>${esc(a.id)}</code></td>
                        <td>${esc(a.title || '—')}</td>
                        <td>${esc(a.category || '—')}</td>
                        <td>${fmt(a.submittedAt || a.createdAt)}</td>
                        <td><span class="art-chip ${statusClass(a.status)}">${esc(a.statusAr || a.status)}</span></td>
                        <td>${fmt(a.updatedAt)}</td>
                        <td>${actions.join(' ')}</td>
                      </tr>`;
                    })
                    .join('')
                : '<tr><td colspan="7">لا مقالات بعد — ابدأ برفع مقالك الأول.</td></tr>'
            }
          </tbody>
        </table>
      </div>
      <div class="art-footer"><button type="button" class="btn btn-ghost" data-art="goto-home">العودة للمقالات</button></div>
    </div>`;
  };

  const renderDetail = (id) => {
    const a = A().get(id);
    if (!a) return `<div class="art-shell"><p>المقال غير موجود.</p><button class="btn btn-ghost" data-art="goto-mine">مقالاتي</button></div>`;
    const timeline = a.timeline || [];
    let currentFound = false;
    return `<div class="art-shell">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div>
          <p class="art-step-lead" style="margin:0">رقم المقال <code>${esc(a.id)}</code></p>
          <h2 style="margin:6px 0">${esc(a.title || 'بدون عنوان')}</h2>
          <p><span class="art-chip ${statusClass(a.status)}">${esc(a.statusAr)}</span> · ${esc(A().customerPhase(a))}</p>
        </div>
        <div class="art-footer-end">
          ${a.status === 'Draft' || a.status === 'Needs Changes' ? `<button type="button" class="btn btn-primary" data-art="edit" data-id="${esc(a.id)}">تعديل</button>` : ''}
          ${a.status === 'Needs Changes' ? `<button type="button" class="btn btn-secondary" data-art="resubmit" data-id="${esc(a.id)}">إعادة الإرسال</button>` : ''}
          <button type="button" class="btn btn-ghost" data-art="goto-mine">مقالاتي</button>
        </div>
      </div>
      <div class="art-detail-grid" style="margin-top:16px">
        <div class="art-card">
          <h4>المحتوى</h4>
          <p><strong>التصنيف:</strong> ${esc(a.category)}</p>
          <p><strong>الملخص:</strong> ${esc(a.summary)}</p>
          ${a.body ? `<div style="white-space:pre-wrap;margin-top:10px">${esc(a.body)}</div>` : ''}
          ${a.articleFile ? `<p><i class="fas fa-paperclip"></i> ${esc(a.articleFile.name)}</p>` : ''}
          ${a.reviewNotes ? `<div style="margin-top:14px;padding:12px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca"><strong>ملاحظات المراجعة</strong><p>${esc(a.reviewNotes)}</p></div>` : ''}
        </div>
        <div class="art-card">
          <h4>حالة المقال</h4>
          <ul class="art-timeline">
            ${timeline
              .map((t) => {
                let cls = '';
                if (t.done) cls = 'is-done';
                else if (!currentFound) {
                  cls = 'is-current';
                  currentFound = true;
                }
                return `<li class="${cls}">${esc(t.label)}${t.at ? `<small>${fmt(t.at)}</small>` : ''}${t.comment ? `<small>${esc(t.comment)}</small>` : ''}</li>`;
              })
              .join('')}
          </ul>
        </div>
      </div>
    </div>`;
  };

  const renderHomeHero = () => {
    const hero = document.querySelector('[data-art-hero]');
    if (!hero) return;
    hero.innerHTML = `
      <p class="hub-feature-kicker" style="color:rgba(255,214,220,.95)"><i class="fas fa-newspaper"></i> مقالات تشغيلية</p>
      <h1>مقالات تُشغّل — مش كلام عام</h1>
      <p class="art-lead">كل مقالة تنتهي بخطوة عملية داخل هوب: فرع · رصيد · دردشة · منصات.</p>
      <p class="art-hint">أرسل مقالك في خطوات بسيطة، وسنراجعه قبل النشر.</p>
      <div class="art-hero-actions">
        <button type="button" class="btn btn-primary" data-art="start-submit"><i class="fas fa-plus"></i> ارفع مقالك</button>
        <button type="button" class="btn btn-secondary" data-art="goto-mine"><i class="fas fa-folder-open"></i> مقالاتي</button>
        <a class="btn btn-secondary" href="#posts"><i class="fas fa-book-open"></i> تصفح المقالات</a>
      </div>`;
  };

  function paintPosts() {
    const grid = document.querySelector('[data-blog-posts]');
    if (!grid) return;
    const posts = A()?.listPublished?.(40) || [];
    if (!posts.length) {
      grid.innerHTML = `<aside class="art-help-card" style="grid-column:1/-1">
        <span class="hub-feature-purpose-mark"><i class="fas fa-pen-to-square"></i></span>
        <div><strong>لا مقالات منشورة بعد</strong>
          <p>كن أول من يرسل مقالاً عبر زر «ارفع مقالك» — بعد المراجعة والاعتماد سيظهر هنا.</p>
          <button type="button" class="btn btn-primary btn-sm" data-art="start-submit">ارفع مقالك</button>
        </div>
      </aside>`;
      return;
    }
    grid.innerHTML = posts
      .map((post, index) => {
        const featured = index === 0 ? ' hub-feature-card--featured' : '';
        return `<article class="hub-feature-card${featured}">
          <div class="hub-feature-card-top">
            <span class="hub-feature-icon"><i class="fas fa-newspaper"></i></span>
            <h3>${esc(post.title || 'مقال')}</h3>
          </div>
          <p>${esc(post.body || '')}</p>
          <small style="display:block;margin-top:8px;color:#6b7280;font-weight:700">${esc(post.authorName || '')} · ${esc(post.category || '')} · ${fmt(post.at)}</small>
          <div class="hub-feature-actions" style="margin-top:12px">
            <a class="btn btn-primary" href="#posts">اقرأ</a>
          </div>
        </article>`;
      })
      .join('');
  }

  function paintApp() {
    const host = document.getElementById('art-app');
    if (!host) return;
    if (ui.view === 'submit' || ui.view === 'success') host.innerHTML = renderSubmit();
    else if (ui.view === 'mine') host.innerHTML = renderMine();
    else if (ui.view === 'detail') host.innerHTML = renderDetail(ui.detailId);
    else {
      host.innerHTML = `<aside class="art-help-card">
        <span class="hub-feature-purpose-mark"><i class="fas fa-circle-question"></i></span>
        <div><strong>كيف يعمل رفع المقال؟</strong>
          <p>اضغط «ارفع مقالك» → أدخل البيانات → أضف المحتوى → راجع → أرسل للمراجعة. لا تحتاج التعامل مع آلية التشغيل؛ النظام يشغّل المراجعة تلقائياً في الخلفية.</p>
        </div>
      </aside>`;
    }
    paintPosts();
    renderHomeHero();
  }

  function paint() {
    paintApp();
  }

  function autoSaveFromDom() {
    const root = document.getElementById('art-wizard');
    if (!root || !ui.draftId) return;
    if (ui.step === 1) {
      A().update(ui.draftId, {
        title: root.querySelector('[name="title"]')?.value || '',
        category: root.querySelector('[name="category"]')?.value || '',
        summary: root.querySelector('[name="summary"]')?.value || '',
        authorName: root.querySelector('[name="authorName"]')?.value || '',
        company: root.querySelector('[name="company"]')?.value || '',
        tags: root.querySelector('[name="tags"]')?.value || '',
      });
    } else if (ui.step === 2) {
      const body = root.querySelector('[name="body"]')?.value;
      if (body !== undefined) A().update(ui.draftId, { body });
    }
    ui.autosaveAt = new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
    const el = root.querySelector('.art-autosave');
    if (el) el.textContent = `✓ تم الحفظ تلقائياً ${ui.autosaveAt}`;
  }

  function onAction(e) {
    const btn = e.target.closest('[data-art]');
    if (!btn) return;
    const act = btn.getAttribute('data-art');
    const id = btn.getAttribute('data-id');
    const root = document.getElementById('art-wizard');

    if (act === 'start-submit') {
      ui.view = 'submit';
      ui.step = 1;
      ui.draftId = '';
      ui.errors = {};
      ui.contentMode = '';
      ensureDraft();
      setHash(`submit/${ui.draftId}`);
      paint();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (act === 'goto-mine') {
      ui.view = 'mine';
      setHash('mine');
      paint();
      return;
    }
    if (act === 'goto-home') {
      ui.view = 'home';
      setHash('posts');
      paint();
      return;
    }
    if (act === 'cancel') {
      ui.view = 'home';
      setHash('posts');
      paint();
      return;
    }
    if (act === 'help') {
      ui.helpOpen = !ui.helpOpen;
      paint();
      return;
    }
    if (act === 'save-draft') {
      autoSaveFromDom();
      alert('تم حفظ المسودة. تجدها في مقالاتي.');
      return;
    }
    if (act === 'next-1') {
      if (!collectStep1(root)) {
        paint();
        return;
      }
      ui.step = 2;
      paint();
      return;
    }
    if (act === 'next-2') {
      if (!collectStep2(root)) {
        paint();
        return;
      }
      ui.step = 3;
      paint();
      return;
    }
    if (act === 'prev') {
      if (ui.step === 3) {
        autoSaveFromDom();
        ui.step = 2;
      } else if (ui.step === 2) {
        autoSaveFromDom();
        ui.step = 1;
      }
      paint();
      return;
    }
    if (act === 'goto-2') {
      ui.step = 2;
      paint();
      return;
    }
    if (act === 'mode-write') {
      ui.contentMode = 'write';
      A().update(ui.draftId, { contentMode: 'write' });
      paint();
      return;
    }
    if (act === 'mode-file') {
      ui.contentMode = 'file';
      A().update(ui.draftId, { contentMode: 'file' });
      paint();
      return;
    }
    if (act === 'pick-file') {
      root?.querySelector('[data-art-file]')?.click();
      return;
    }
    if (act === 'pick-cover') {
      root?.querySelector('[data-art-cover]')?.click();
      return;
    }
    if (act === 'pick-extra') {
      root?.querySelector('[data-art-extra]')?.click();
      return;
    }
    if (act === 'clear-file') {
      A().update(ui.draftId, { articleFile: null });
      paint();
      return;
    }
    if (act === 'clear-cover') {
      A().update(ui.draftId, { coverImage: null });
      paint();
      return;
    }
    if (act === 'submit') {
      autoSaveFromDom();
      const result = A().submit(ui.draftId);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      ui.view = 'success';
      ui.successId = result.article.id;
      setHash(`success/${result.article.id}`);
      paint();
      return;
    }
    if (act === 'open-detail') {
      ui.view = 'detail';
      ui.detailId = id;
      setHash(`mine/${id}`);
      paint();
      return;
    }
    if (act === 'edit') {
      ui.view = 'submit';
      ui.draftId = id;
      ui.step = 1;
      ui.contentMode = A().get(id)?.contentMode || '';
      setHash(`submit/${id}`);
      paint();
      return;
    }
    if (act === 'send-now') {
      const result = A().submit(id);
      if (!result.ok) alert(result.error);
      else {
        ui.view = 'success';
        ui.successId = id;
        setHash(`success/${id}`);
        paint();
      }
      return;
    }
    if (act === 'resubmit') {
      A().resubmit(id);
      alert('أُعيد إرسال المقال للمراجعة.');
      paint();
      return;
    }
    if (act === 'delete') {
      if (confirm('حذف المسودة؟')) {
        A().remove(id);
        paint();
      }
    }
  }

  function onChange(e) {
    const t = e.target;
    if (t.matches('[data-art-file]') && t.files?.[0]) attachArticleFile(t.files[0]);
    if (t.matches('[data-art-cover]') && t.files?.[0]) attachCover(t.files[0]);
    if (t.matches('[data-art-extra]') && t.files?.[0]) attachExtra(t.files[0]);
  }

  function onFmt(e) {
    const btn = e.target.closest('[data-art-fmt]');
    if (!btn) return;
    const ta = document.querySelector('#art-wizard textarea[name="body"]');
    if (!ta) return;
    const fmt = btn.getAttribute('data-art-fmt');
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = ta.value.slice(start, end) || 'نص';
    let insert = sel;
    if (fmt === 'bold') insert = `**${sel}**`;
    if (fmt === 'h2') insert = `\n## ${sel}\n`;
    if (fmt === 'ul') insert = `\n- ${sel}\n`;
    if (fmt === 'link') insert = `[${sel}](https://)`;
    ta.value = ta.value.slice(0, start) + insert + ta.value.slice(end);
    autoSaveFromDom();
  }

  function boot() {
    if (!document.getElementById('art-app')) return;
    readHash();
    if ((location.hash || '').includes('submit') && !ui.draftId) ensureDraft();
    paint();
    document.addEventListener('click', onAction);
    document.addEventListener('click', onFmt);
    document.addEventListener('change', onChange);
    document.addEventListener('input', (e) => {
      if (e.target.closest('#art-wizard')) {
        clearTimeout(boot._t);
        boot._t = setTimeout(autoSaveFromDom, 700);
      }
    });
    window.addEventListener('hashchange', () => {
      readHash();
      paint();
    });
    window.addEventListener('hub-articles-changed', () => {
      if (ui.view === 'mine' || ui.view === 'detail' || ui.view === 'home') paint();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.HubArticlesUI = { paint, ui };
})();
