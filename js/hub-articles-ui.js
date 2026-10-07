/**
 * Customer articles UI — blog.html
 * Single-page submit (no stepper) · my articles · article detail
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
    view: 'home',
    draftId: '',
    successId: '',
    detailId: '',
    errors: {},
    autosaveAt: '',
    helpOpen: false,
    submitting: false,
    saving: false,
    submitLockKey: '',
    creating: null,
    formError: '',
    form: {},
    coverLocal: '',
    videoLocal: '',
    coverProgress: 0,
    videoProgress: 0,
    extraProgress: 0,
    lastVideoFile: null,
    lastCoverFile: null,
  };

  const loggedIn = () => !!window.HubAuth?.isLoggedIn?.();

  const draft = () => (ui.draftId ? A()?.get(ui.draftId) : null);

  async function ensureDraft() {
    if (ui.creating) return ui.creating;
    if (!loggedIn()) return null;
    if (ui.draftId) {
      const existing = A()?.get(ui.draftId);
      if (existing) return existing;
      try {
        const row = await A().loadOne(ui.draftId);
        if (row) return row;
      } catch (_) {}
    }
    ui.creating = (async () => {
      const u = window.HubAuth?.getUser?.();
      const row = await A().createDraft(
        {
          authorName: u?.name || u?.fullName || '',
          authorEmail: u?.email || '',
          sessionId,
        },
        u?.name || 'زائر'
      );
      ui.draftId = row.id;
      setHash(`submit/${row.id}`);
      return row;
    })();
    try {
      return await ui.creating;
    } finally {
      ui.creating = null;
    }
  }

  const statusClass = (st) => {
    if (st === 'Draft') return 'is-draft';
    if (st === 'Pending Review') return 'is-pending';
    if (st === 'Under Review') return 'is-review';
    if (st === 'Needs Changes') return 'is-needs';
    if (st === 'Published' || st === 'Approved') return 'is-ok';
    if (st === 'Rejected') return 'is-needs';
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
    id: extra.id || '',
    name: file.name,
    mime: file.type || extra.mime || '',
    size: file.size || extra.size || 0,
    url: extra.url || '',
    uploadedAt: extra.uploadedAt || new Date().toISOString(),
    status: extra.status || 'local',
  });

  const formatSize = (n) => {
    const b = Number(n) || 0;
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.m4v'];

  const validateExt = (name, list) => {
    const lower = String(name || '').toLowerCase();
    return (list || []).some((ext) => lower.endsWith(ext));
  };

  const maxBytes = () => window.HubUploadLimits?.MAX_FILE_BYTES || 1500 * 1024 * 1024;

  function snapshotForm() {
    const root = document.getElementById('art-wizard');
    if (!root) return ui.form || {};
    const fields = collectForm(root);
    ui.form = Object.assign({}, ui.form || {}, fields);
    const row = draft();
    if (row) Object.assign(row, fields);
    return ui.form;
  }

  async function persistPatch(patch) {
    const fields = snapshotForm();
    return A().update(ui.draftId, Object.assign({}, fields, patch || {}));
  }

  function collectForm(root) {
    if (!root) return ui.form || {};
    const tags = root.querySelector('[name="tags"]')?.value || '';
    return {
      title: root.querySelector('[name="title"]')?.value?.trim() || '',
      category: root.querySelector('[name="category"]')?.value?.trim() || '',
      summary: root.querySelector('[name="summary"]')?.value?.trim() || '',
      authorName: root.querySelector('[name="authorName"]')?.value?.trim() || '',
      company: root.querySelector('[name="company"]')?.value?.trim() || '',
      body: root.querySelector('[name="body"]')?.value || '',
      tags,
    };
  }

  function validateRequired(fields) {
    const errors = {};
    if (!fields.title) errors.title = 'عنوان المقال مطلوب.';
    if (!fields.category) errors.category = 'يرجى اختيار التصنيف.';
    if (!fields.summary) errors.summary = 'النبذة المختصرة مطلوبة.';
    if (!String(fields.body || '').trim()) errors.body = 'محتوى المقال مطلوب.';
    return errors;
  }

  function field(name, label, control, required = false, hint = '') {
    const err = ui.errors[name];
    return `<div class="art-field ${err ? 'has-error' : ''}">
      <label>${esc(label)}${required ? ' <span class="req">*</span>' : ''}</label>
      ${control}
      ${hint ? `<small class="art-hint-inline">${esc(hint)}</small>` : ''}
      <div class="err">${esc(err || '')}</div>
    </div>`;
  }

  function mediaStatusLabel(status) {
    if (status === 'uploading') return 'جارٍ الرفع';
    if (status === 'ok' || status === 'ready') return 'تم الرفع';
    if (status === 'error') return 'فشل الرفع';
    return 'بانتظار الرفع';
  }

  function coverUrl(a) {
    return ui.coverLocal || a?.coverImage?.url || '';
  }
  function videoUrl(a) {
    return ui.videoLocal || a?.video?.url || '';
  }

  function renderCoverZone(a) {
    const f = a.coverImage;
    const url = coverUrl(a);
    const uploading = f?.status === 'uploading';
    const failed = f?.status === 'error';
    return `<section class="art-media-card" data-zone="cover">
      <h3>صورة المقال</h3>
      <p class="art-zone-lead">اختر صورة من الجهاز. الصيغ: JPG · PNG · WEBP · GIF — حتى ${esc(String(A()?.settings?.()?.maxCoverMb || 1500))} ميجابايت.</p>
      ${
        url
          ? `<div class="art-media-preview"><img src="${esc(url)}" alt="معاينة صورة المقال" /></div>`
          : `<div class="art-drop art-drop-lg">
              <strong>اسحب الصورة هنا أو اختر من الجهاز</strong>
              <p>ستظهر معاينة فورية قبل الإرسال.</p>
            </div>`
      }
      ${
        f
          ? `<div class="art-file-card ${failed ? 'is-error' : uploading ? 'is-busy' : ''}">
              <div>
                <div>${esc(f.name || 'صورة')}</div>
                <small>${esc(f.mime || 'صورة')} · ${esc(formatSize(f.size))}</small>
                <div class="ok">${esc(mediaStatusLabel(f.status))}${uploading ? ` · ${ui.coverProgress || 0}%` : ''}</div>
                ${uploading ? `<div class="art-progress"><span style="width:${Number(ui.coverProgress) || 0}%"></span></div>` : ''}
              </div>
              <div class="art-footer-end">
                ${failed ? `<button type="button" class="btn btn-secondary btn-sm" data-art="retry-cover">إعادة المحاولة</button>` : ''}
                <button type="button" class="btn btn-ghost btn-sm" data-art="pick-cover">استبدال</button>
                <button type="button" class="btn btn-dark btn-sm" data-art="clear-cover">حذف</button>
              </div>
            </div>`
          : `<button type="button" class="btn btn-primary" data-art="pick-cover"><i class="fas fa-image"></i> اختيار صورة</button>`
      }
      <input type="file" hidden data-art-cover accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" />
    </section>`;
  }

  function renderVideoZone(a) {
    const f = a.video;
    const url = videoUrl(a);
    const uploading = f?.status === 'uploading';
    const failed = f?.status === 'error';
    return `<section class="art-media-card" data-zone="video">
      <h3>فيديو المقال</h3>
      <p class="art-zone-lead">رفع فيديو فعلي من الجهاز عبر نظام المرفقات الموحّد (حتى 1500 ميجابايت). الصيغ: MP4 · WEBM · MOV.</p>
      ${
        url && (f?.status === 'ok' || f?.status === 'ready' || ui.videoLocal)
          ? `<div class="art-media-preview"><video src="${esc(url)}" controls playsinline></video></div>`
          : `<div class="art-drop art-drop-lg">
              <strong>اختر فيديو من الجهاز</strong>
              <p>يظهر اسم الملف والحجم وتقدّم الرفع هنا.</p>
            </div>`
      }
      ${
        f
          ? `<div class="art-file-card ${failed ? 'is-error' : uploading ? 'is-busy' : ''}">
              <div>
                <div>${esc(f.name || 'فيديو')}</div>
                <small>${esc(f.mime || 'فيديو')} · ${esc(formatSize(f.size))}</small>
                <div class="ok">${esc(mediaStatusLabel(f.status))}${uploading ? ` · ${ui.videoProgress || 0}%` : ''}</div>
                ${uploading || failed ? `<div class="art-progress"><span style="width:${Number(ui.videoProgress) || 0}%"></span></div>` : ''}
              </div>
              <div class="art-footer-end">
                ${failed ? `<button type="button" class="btn btn-secondary btn-sm" data-art="retry-video">إعادة المحاولة</button>` : ''}
                <button type="button" class="btn btn-ghost btn-sm" data-art="pick-video">استبدال</button>
                <button type="button" class="btn btn-dark btn-sm" data-art="clear-video">حذف</button>
              </div>
            </div>`
          : `<button type="button" class="btn btn-primary" data-art="pick-video"><i class="fas fa-video"></i> اختيار فيديو</button>`
      }
      <input type="file" hidden data-art-video accept=".mp4,.webm,.mov,.m4v,video/mp4,video/webm,video/quicktime" />
    </section>`;
  }

  function renderExtraZone(a) {
    const list = a.attachments || [];
    return `<section class="art-media-card" data-zone="extra">
      <h3>مرفقات إضافية</h3>
      <p class="art-zone-lead">صور أو ملفات داعمة عبر نظام المرفقات الموحّد.</p>
      <button type="button" class="btn btn-secondary" data-art="pick-extra"><i class="fas fa-paperclip"></i> إضافة مرفق</button>
      <input type="file" hidden data-art-extra />
      ${
        list.length
          ? list
              .map(
                (f, i) => `<div class="art-file-card">
                  <div>
                    <div>${esc(f.name)}</div>
                    <small>${esc(formatSize(f.size))} · ${esc(mediaStatusLabel(f.status))}</small>
                  </div>
                  <button type="button" class="btn btn-ghost btn-sm" data-art="clear-extra" data-idx="${i}">حذف</button>
                </div>`
              )
              .join('')
          : '<p class="art-zone-lead">لا مرفقات إضافية بعد.</p>'
      }
    </section>`;
  }

  function renderPreview(a) {
    const snippet = String(a.body || '').trim().slice(0, 280);
    const extras = (a.attachments || []).map((f) => f.name).join(' · ');
    return `<section class="art-preview art-preview-inline" id="art-live-preview">
      <h3>معاينة قبل الإرسال</h3>
      ${coverUrl(a) ? `<img src="${esc(coverUrl(a))}" alt="" />` : ''}
      <h4>${esc(a.title || 'بدون عنوان')}</h4>
      <div class="meta">${esc(a.authorName || '—')} · ${esc(a.category || '—')} · ${esc(a.company || '')}</div>
      <p><strong>النبذة:</strong> ${esc(a.summary || '—')}</p>
      <p><strong>جزء من المحتوى:</strong> ${esc(snippet || '—')}</p>
      <p><strong>الفيديو:</strong> ${a.video ? `${esc(a.video.name || 'فيديو')} · ${esc(mediaStatusLabel(a.video.status))}` : 'لا يوجد'}</p>
      <p><strong>المرفقات:</strong> ${esc(extras || 'لا يوجد')}</p>
    </section>`;
  }

  function renderLoginGate() {
    const next = encodeURIComponent('blog.html#submit');
    return `<div class="art-shell art-submit-page">
      <h2>إرسال مقال جديد</h2>
      <p class="art-step-lead">يلزم تسجيل الدخول لرفع المقال وربطه بحسابك وطلب المراجعة.</p>
      <div class="art-footer">
        <a class="btn btn-primary" href="login.html?next=${next}">تسجيل الدخول</a>
        <button type="button" class="btn btn-ghost" data-art="goto-home">العودة للمقالات</button>
      </div>
    </div>`;
  }

  function renderSuccess(a) {
    return `<div class="art-success">
      <div class="big"><i class="fas fa-check"></i></div>
      <h2>تم إرسال المقال للمراجعة بنجاح</h2>
      <p>رقم الطلب</p>
      <code>${esc(a.requestId || a.id)}</code>
      <p>رقم المقال: <code>${esc(a.id)}</code></p>
      <p>الحالة: <strong>${esc(a.statusAr || 'بانتظار المراجعة')}</strong></p>
      <div class="art-success-actions">
        <button type="button" class="btn btn-primary" data-art="open-detail" data-id="${esc(a.id)}">عرض المقال</button>
        <button type="button" class="btn btn-secondary" data-art="goto-mine">مقالاتي</button>
        <button type="button" class="btn btn-ghost" data-art="start-submit">إرسال مقال آخر</button>
      </div>
    </div>`;
  }

  function renderForm(a) {
    const cats = A().CATEGORIES.map(
      (c) => `<option value="${esc(c)}" ${a.category === c ? 'selected' : ''}>${esc(c)}</option>`
    ).join('');
    const busy = ui.submitting || a.coverImage?.status === 'uploading' || a.video?.status === 'uploading';
    return `<div class="art-shell art-submit-page" id="art-wizard">
      <div class="art-submit-head">
        <div>
          <h2>إرسال مقال جديد</h2>
          <p class="art-step-lead">صفحة واحدة متصلة — اكتب المحتوى وارفع الصورة والفيديو ثم أرسل للمراجعة.</p>
          ${a.id ? `<p class="art-step-lead">رقم المقال: <code>${esc(a.id)}</code></p>` : ''}
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-art="help">؟ كيف أرسل مقالاً؟</button>
      </div>
      ${
        ui.helpOpen
          ? `<aside class="art-help-card"><div><strong>كيف أرسل مقالاً؟</strong>
              <p>أكمل البيانات والمحتوى والمرفقات في هذه الصفحة ثم اضغط «إرسال للمراجعة». سيُنشأ رقم طلب ويصل إلى مكتب المحتوى — وليس مباشرة إلى موافقات المدير الأعلى.</p></div></aside>`
          : ''
      }
      ${ui.formError ? `<p class="art-form-error">${esc(ui.formError)}</p>` : ''}
      <div class="art-submit-grid">
        <div class="art-submit-main">
          <section class="art-section">
            <h3>بيانات المقال</h3>
            <div class="art-form art-form-wide">
              ${field('title', 'عنوان المقال', `<input name="title" value="${esc(a.title || '')}" placeholder="مثال: كيف تخفض تكاليف التشغيل خلال 30 يوماً" />`, true)}
              ${field('summary', 'نبذة مختصرة', `<textarea name="summary" placeholder="اكتب ملخصاً قصيراً يوضح فكرة المقال...">${esc(a.summary || '')}</textarea>`, true)}
            </div>
          </section>
          <section class="art-section">
            <h3>محتوى المقال</h3>
            ${ui.errors.body ? `<p class="art-field has-error"><span class="err" style="display:block">${esc(ui.errors.body)}</span></p>` : ''}
            <div class="art-editor">
              <div class="art-editor-tools">
                <button type="button" data-art-fmt="bold"><b>B</b></button>
                <button type="button" data-art-fmt="h2">عنوان فرعي</button>
                <button type="button" data-art-fmt="ul">قائمة</button>
                <button type="button" data-art-fmt="link">رابط</button>
              </div>
              <textarea name="body" placeholder="اكتب مقالك هنا... يكفي سطر واحد لاختبار الإرسال.">${esc(a.body || '')}</textarea>
            </div>
          </section>
          ${renderPreview(a)}
          <div class="art-autosave">${ui.autosaveAt ? `✓ تم الحفظ تلقائياً ${esc(ui.autosaveAt)}` : ''}</div>
          ${a.changeRequestNote ? `<div class="art-review-note"><strong>سبب طلب التعديل</strong><p>${esc(a.changeRequestNote)}</p></div>` : ''}
          <div class="art-footer art-footer-submit">
            <button type="button" class="btn btn-ghost" data-art="cancel">إلغاء</button>
            <div class="art-footer-end">
              <button type="button" class="btn btn-secondary" data-art="save-draft" ${ui.saving ? 'disabled' : ''}>حفظ كمسودة</button>
              <button type="button" class="btn btn-primary" data-art="submit" ${busy ? 'disabled' : ''}><i class="fas fa-paper-plane"></i> إرسال للمراجعة</button>
            </div>
          </div>
        </div>
        <aside class="art-submit-side">
          <section class="art-section">
            <h3>التصنيف والكاتب</h3>
            <div class="art-form art-form-wide">
              ${field('category', 'التصنيف', `<select name="category"><option value="">اختر التصنيف</option>${cats}</select>`, true)}
              ${field('authorName', 'اسم الكاتب', `<input name="authorName" value="${esc(a.authorName || '')}" />`)}
              ${field('company', 'الجهة / الشركة', `<input name="company" value="${esc(a.company || '')}" placeholder="اختياري" />`)}
              ${field('tags', 'وسوم', `<input name="tags" value="${esc((a.tags || []).join(', '))}" placeholder="تشغيل, تكاليف, فروع" />`)}
            </div>
          </section>
          ${renderCoverZone(a)}
          ${renderVideoZone(a)}
          ${renderExtraZone(a)}
        </aside>
      </div>
    </div>`;
  }

  const renderSubmit = () => {
    if (!A()) return `<div class="art-shell"><p>تعذّر تحميل نظام المقالات.</p></div>`;
    if (ui.view === 'success' && ui.successId) {
      const a = A().get(ui.successId);
      return `<div class="art-shell">${a ? renderSuccess(a) : '<p>المقال غير موجود</p>'}</div>`;
    }
    if (!loggedIn()) return renderLoginGate();
    if (!draft()) {
      return `<div class="art-shell art-submit-page"><p class="art-step-lead">جاري إنشاء المسودة…</p></div>`;
    }
    return renderForm(Object.assign({}, draft(), ui.form || {}));
  };

  const renderMine = () => {
    const u = window.HubAuth?.getUser?.();
    const rows = A().list({ mine: true, email: u?.email, sessionId });
    return `<div class="art-shell">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
        <div>
          <h2 style="margin:0">مقالاتي</h2>
          <p class="art-step-lead">تابع حالة كل مقال — مسودة → بانتظار المراجعة → تحت المراجعة → يحتاج تعديل / مرفوض / منشور.</p>
        </div>
        <button type="button" class="btn btn-primary" data-art="start-submit"><i class="fas fa-plus"></i> ارفع مقالك</button>
      </div>
      <div class="art-table-wrap">
        <table class="art-table">
          <thead><tr>
            <th>رقم المقال</th><th>رقم الطلب</th><th>العنوان</th><th>التصنيف</th><th>تاريخ الإرسال</th><th>الحالة</th><th>الإجراءات</th>
          </tr></thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map((a) => {
                      const actions = [];
                      if (a.status === 'Draft') {
                        actions.push(`<button type="button" class="btn btn-primary btn-sm" data-art="edit" data-id="${esc(a.id)}">تعديل</button>`);
                        actions.push(`<button type="button" class="btn btn-secondary btn-sm" data-art="send-now" data-id="${esc(a.id)}">إرسال</button>`);
                      } else if (a.status === 'Needs Changes') {
                        actions.push(`<button type="button" class="btn btn-primary btn-sm" data-art="open-detail" data-id="${esc(a.id)}">عرض الملاحظات</button>`);
                        actions.push(`<button type="button" class="btn btn-secondary btn-sm" data-art="edit" data-id="${esc(a.id)}">تعديل وإعادة الإرسال</button>`);
                      } else if (a.status === 'Published') {
                        actions.push(`<a class="btn btn-primary btn-sm" href="#posts">عرض المقال</a>`);
                        actions.push(`<button type="button" class="btn btn-ghost btn-sm" data-art="open-detail" data-id="${esc(a.id)}">التفاصيل</button>`);
                      } else {
                        actions.push(`<button type="button" class="btn btn-primary btn-sm" data-art="open-detail" data-id="${esc(a.id)}">عرض</button>`);
                      }
                      return `<tr>
                        <td><code>${esc(a.id)}</code></td>
                        <td><code>${esc(a.requestId || '—')}</code></td>
                        <td>${esc(a.title || '—')}</td>
                        <td>${esc(a.category || '—')}</td>
                        <td>${fmt(a.submittedAt || a.createdAt)}</td>
                        <td><span class="art-chip ${statusClass(a.status)}">${esc(a.statusAr || a.status)}</span></td>
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
    if (!a) return `<div class="art-shell"><p>المقال غير موجود أو غير مصرح لك بعرضه.</p><button class="btn btn-ghost" data-art="goto-mine">مقالاتي</button></div>`;
    const timeline = a.timeline || [];
    let currentFound = false;
    const note = a.changeRequestNote || a.reviewNotes || a.rejectionReason || '';
    return `<div class="art-shell">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div>
          <p class="art-step-lead" style="margin:0">رقم المقال <code>${esc(a.id)}</code>${a.requestId ? ` · طلب <code>${esc(a.requestId)}</code>` : ''}</p>
          <h2 style="margin:6px 0">${esc(a.title || 'بدون عنوان')}</h2>
          <p><span class="art-chip ${statusClass(a.status)}">${esc(a.statusAr)}</span> · ${esc(A().customerPhase(a))}</p>
        </div>
        <div class="art-footer-end">
          ${a.status === 'Draft' || a.status === 'Needs Changes' ? `<button type="button" class="btn btn-primary" data-art="edit" data-id="${esc(a.id)}">تعديل وإعادة الإرسال</button>` : ''}
          ${a.status === 'Needs Changes' ? `<button type="button" class="btn btn-secondary" data-art="resubmit" data-id="${esc(a.id)}">إعادة الإرسال</button>` : ''}
          <button type="button" class="btn btn-ghost" data-art="goto-mine">مقالاتي</button>
        </div>
      </div>
      ${note && (a.status === 'Needs Changes' || a.status === 'Rejected') ? `<div class="art-review-note"><strong>${a.status === 'Rejected' ? 'سبب الرفض' : 'سبب التعديل'}</strong><p>${esc(note)}</p></div>` : ''}
      <div class="art-detail-grid" style="margin-top:16px">
        <div class="art-card">
          <h4>المحتوى</h4>
          <p><strong>التصنيف:</strong> ${esc(a.category)}</p>
          <p><strong>الكاتب:</strong> ${esc(a.authorName || '—')}</p>
          <p><strong>الملخص:</strong> ${esc(a.summary)}</p>
          ${a.coverImage?.url ? `<img src="${esc(a.coverImage.url)}" alt="" style="max-width:100%;border-radius:12px;margin:10px 0" />` : ''}
          ${a.video?.url ? `<video src="${esc(a.video.url)}" controls style="max-width:100%;border-radius:12px;margin:10px 0"></video>` : ''}
          ${a.body ? `<div style="white-space:pre-wrap;margin-top:10px">${esc(a.body)}</div>` : ''}
          ${(a.attachments || []).map((f) => `<p><i class="fas fa-paperclip"></i> ${esc(f.name)}</p>`).join('')}
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

  const ART_PAGE_TITLE = 'المدونة | نايوش هوب 360';

  const renderHomeHero = () => {
    document.title = ART_PAGE_TITLE;
    const hero = document.querySelector('[data-art-hero]');
    if (!hero) return;
    hero.innerHTML = `
      <p class="hub-feature-kicker" style="color:rgba(255,214,220,.95)"><i class="fas fa-blog"></i> مقالات تشغيلية</p>
      <h1>المدونة | نايوش هوب 360</h1>
      <p class="art-lead">مقالات تُشغّل — مش كلام عام. كل مقالة تنتهي بخطوة عملية داخل هوب: فرع · رصيد · دردشة · منصات.</p>
      <p class="art-hint">أرسل مقالك من صفحة واحدة، وسنراجعه في مكتب المحتوى قبل النشر.</p>
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
      grid.innerHTML = `<aside class="art-help-card art-posts-empty">
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
        const cover = post.coverImage?.url
          ? `<img src="${esc(post.coverImage.url)}" alt="" style="width:100%;height:140px;object-fit:cover;border-radius:12px;margin-bottom:10px" />`
          : '';
        return `<article class="hub-feature-card${featured}">
          ${cover}
          <div class="hub-feature-card-top">
            <span class="hub-feature-icon"><i class="fas fa-newspaper"></i></span>
            <h3>${esc(post.title || 'مقال')}</h3>
          </div>
          <p>${esc(post.body || '')}</p>
          <small style="display:block;margin-top:8px;color:#6b7280;font-weight:700">${esc(post.authorName || '')} · ${esc(post.category || '')} · ${fmt(post.publishedAt || post.at)}</small>
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
    document.body.classList.toggle('art-mode-submit', ui.view === 'submit' || ui.view === 'success');
    if (ui.view === 'submit' || ui.view === 'success') host.innerHTML = renderSubmit();
    else if (ui.view === 'mine') host.innerHTML = renderMine();
    else if (ui.view === 'detail') host.innerHTML = renderDetail(ui.detailId);
    else {
      host.innerHTML = `<aside class="art-help-card">
        <span class="hub-feature-purpose-mark"><i class="fas fa-circle-question"></i></span>
        <div><strong>كيف يعمل رفع المقال؟</strong>
          <p>اضغط «ارفع مقالك» → أكمل البيانات والمحتوى والمرفقات في صفحة واحدة → أرسل للمراجعة. يصل الطلب إلى مكتب المحتوى وصندوق طلبات العملاء.</p>
        </div>
      </aside>`;
    }
    paintPosts();
    renderHomeHero();
  }

  function paint() {
    snapshotForm();
    paintApp();
  }

  function updatePreviewDom() {
    const root = document.getElementById('art-wizard');
    if (!root) return;
    const a = Object.assign({}, draft() || {}, collectForm(root));
    const box = document.getElementById('art-live-preview');
    if (!box) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = renderPreview(a);
    if (tmp.firstElementChild) box.replaceWith(tmp.firstElementChild);
  }

  async function autoSaveFromDom() {
    const root = document.getElementById('art-wizard');
    if (!root || !ui.draftId || ui.submitting) return;
    const fields = collectForm(root);
    try {
      await A().update(ui.draftId, fields);
      ui.autosaveAt = new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
      const el = root.querySelector('.art-autosave');
      if (el) el.textContent = `✓ تم الحفظ تلقائياً ${ui.autosaveAt}`;
    } catch (_) {}
  }

  async function uploadViaHub(file, onProgress) {
    const check = window.HubUploadLimits?.assertFile?.(file);
    if (check && !check.ok) throw new Error(check.error);
    if (file.size > maxBytes()) throw new Error(`الحجم الأقصى ${Math.round(maxBytes() / 1024 / 1024)} ميجابايت`);
    if (!window.HubUploadLimits?.uploadFile) throw new Error('مكوّن الرفع غير متاح');
    const up = await window.HubUploadLimits.uploadFile(file, { onProgress });
    return {
      id: up.id || up.filename || '',
      name: up.name || file.name,
      mime: up.mime || file.type,
      size: up.size || file.size,
      url: up.url,
      uploadedAt: new Date().toISOString(),
      status: 'ok',
    };
  }

  async function attachCover(file) {
    if (!validateExt(file.name, IMAGE_EXTS)) {
      alert('صيغة الصورة غير مدعومة. المسموح: JPG · PNG · WEBP · GIF');
      return;
    }
    if (file.size > maxBytes()) {
      alert(`الحجم الأقصى للصورة ${Math.round(maxBytes() / 1024 / 1024)} ميجابايت`);
      return;
    }
    ui.lastCoverFile = file;
    if (ui.coverLocal) URL.revokeObjectURL(ui.coverLocal);
    ui.coverLocal = URL.createObjectURL(file);
    ui.coverProgress = 0;
    const meta = fileMeta(file, { status: 'uploading' });
    await persistPatch({ coverImage: meta });
    paint();
    try {
      const up = await uploadViaHub(file, (pct) => {
        ui.coverProgress = pct;
        const bar = document.querySelector('[data-zone="cover"] .art-progress span');
        if (bar) bar.style.width = `${pct}%`;
        const lbl = document.querySelector('[data-zone="cover"] .ok');
        if (lbl) lbl.textContent = `جارٍ الرفع · ${pct}%`;
      });
      await persistPatch({ coverImage: up });
    } catch (e) {
      await persistPatch({ coverImage: fileMeta(file, { status: 'error' }) });
      alert(e?.message || 'فشل رفع الصورة');
    }
    paint();
  }

  async function attachVideo(file) {
    if (!validateExt(file.name, VIDEO_EXTS)) {
      alert('صيغة الفيديو غير مدعومة. المسموح: MP4 · WEBM · MOV');
      return;
    }
    if (file.size > maxBytes()) {
      alert(`الحجم الأقصى للفيديو ${Math.round(maxBytes() / 1024 / 1024)} ميجابايت`);
      return;
    }
    ui.lastVideoFile = file;
    if (ui.videoLocal) URL.revokeObjectURL(ui.videoLocal);
    ui.videoLocal = URL.createObjectURL(file);
    ui.videoProgress = 0;
    const meta = fileMeta(file, { status: 'uploading' });
    await persistPatch({ video: meta });
    paint();
    try {
      const up = await uploadViaHub(file, (pct) => {
        ui.videoProgress = pct;
        const bar = document.querySelector('[data-zone="video"] .art-progress span');
        if (bar) bar.style.width = `${pct}%`;
        const lbl = document.querySelector('[data-zone="video"] .ok');
        if (lbl) lbl.textContent = `جارٍ الرفع · ${pct}%`;
      });
      await persistPatch({ video: up });
    } catch (e) {
      await persistPatch({ video: fileMeta(file, { status: 'error' }) });
      alert(e?.message || 'فشل رفع الفيديو');
    }
    paint();
  }

  async function attachExtra(file) {
    const article = draft();
    const list = [...(article?.attachments || [])];
    let meta = fileMeta(file, { status: 'uploading' });
    list.push(meta);
    await persistPatch({ attachments: list });
    paint();
    try {
      const up = await uploadViaHub(file);
      const next = [...(A().get(ui.draftId)?.attachments || list)];
      next[next.length - 1] = up;
      await persistPatch({ attachments: next });
    } catch (e) {
      alert(e?.message || 'فشل رفع المرفق');
    }
    paint();
  }

  async function submitCurrent() {
    if (ui.submitting) return;
    const root = document.getElementById('art-wizard');
    const live = collectForm(root);
    const a = Object.assign({}, draft() || {}, live);
    const fields = {
      title: live.title || a.title || '',
      category: live.category || a.category || '',
      summary: live.summary || a.summary || '',
      authorName: live.authorName || a.authorName || '',
      company: live.company || a.company || '',
      body: live.body || a.body || '',
      tags: live.tags || a.tags || [],
    };
    const errors = validateRequired(fields);
    ui.errors = errors;
    ui.formError = '';
    if (Object.keys(errors).length) {
      paint();
      return;
    }
    const media = draft() || a;
    if (media?.coverImage?.status === 'uploading') {
      ui.formError = 'انتظر اكتمال رفع صورة المقال قبل الإرسال.';
      paint();
      return;
    }
    if (media?.video?.status === 'uploading') {
      ui.formError = 'انتظر اكتمال رفع فيديو المقال قبل الإرسال.';
      paint();
      return;
    }
    if (media?.coverImage?.status === 'error') {
      ui.formError = 'فشل رفع الصورة — احذفها أو أعد المحاولة.';
      paint();
      return;
    }
    if (media?.video?.status === 'error') {
      ui.formError = 'فشل رفع الفيديو — احذف أو أعد المحاولة قبل الإرسال.';
      paint();
      return;
    }
    ui.submitting = true;
    if (!ui.submitLockKey) ui.submitLockKey = `art-submit-${ui.draftId}-${Date.now()}`;
    paint();
    try {
      await persistPatch(fields);
      const result = await A().submit(ui.draftId, null, { idempotencyKey: ui.submitLockKey });
      if (!result.ok) throw new Error(result.error || 'تعذر الإرسال');
      ui.view = 'success';
      ui.successId = result.article.id;
      ui.submitting = false;
      ui.submitLockKey = '';
      setHash(`success/${result.article.id}`);
      paint();
    } catch (e) {
      ui.submitting = false;
      ui.formError = e?.message || 'تعذر إرسال المقال';
      paint();
    }
  }

  async function onAction(e) {
    const btn = e.target.closest('[data-art]');
    if (!btn) return;
    const act = btn.getAttribute('data-art');
    const id = btn.getAttribute('data-id');
    const root = document.getElementById('art-wizard');

    if (act === 'start-submit') {
      ui.view = 'submit';
      ui.errors = {};
      ui.formError = '';
      ui.form = {};
      ui.submitLockKey = '';
      ui.coverLocal = '';
      ui.videoLocal = '';
      const current = ui.draftId ? A()?.get(ui.draftId) : null;
      if (!current || current.status !== 'Draft') ui.draftId = '';
      setHash(ui.draftId ? `submit/${ui.draftId}` : 'submit');
      paint();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (loggedIn()) {
        try {
          await ensureDraft();
          paint();
        } catch (err) {
          ui.formError = err?.message || 'تعذر إنشاء المسودة';
          paint();
        }
      }
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
      ui.saving = true;
      try {
        await autoSaveFromDom();
        alert('تم حفظ المسودة. تجدها في مقالاتي.');
      } catch (err) {
        alert(err?.message || 'تعذر حفظ المسودة');
      } finally {
        ui.saving = false;
      }
      return;
    }
    if (act === 'pick-cover') {
      root?.querySelector('[data-art-cover]')?.click();
      return;
    }
    if (act === 'pick-video') {
      root?.querySelector('[data-art-video]')?.click();
      return;
    }
    if (act === 'pick-extra') {
      root?.querySelector('[data-art-extra]')?.click();
      return;
    }
    if (act === 'retry-cover' && ui.lastCoverFile) {
      await attachCover(ui.lastCoverFile);
      return;
    }
    if (act === 'retry-video' && ui.lastVideoFile) {
      await attachVideo(ui.lastVideoFile);
      return;
    }
    if (act === 'clear-cover') {
      if (ui.coverLocal) URL.revokeObjectURL(ui.coverLocal);
      ui.coverLocal = '';
      ui.lastCoverFile = null;
      await persistPatch({ coverImage: null });
      paint();
      return;
    }
    if (act === 'clear-video') {
      if (ui.videoLocal) URL.revokeObjectURL(ui.videoLocal);
      ui.videoLocal = '';
      ui.lastVideoFile = null;
      await persistPatch({ video: null });
      paint();
      return;
    }
    if (act === 'clear-extra') {
      const idx = Number(btn.getAttribute('data-idx'));
      const list = [...(draft()?.attachments || [])];
      list.splice(idx, 1);
      await persistPatch({ attachments: list });
      paint();
      return;
    }
    if (act === 'submit' || act === 'send-now') {
      if (act === 'send-now') ui.draftId = id;
      await submitCurrent();
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
      ui.submitLockKey = '';
      setHash(`submit/${id}`);
      paint();
      return;
    }
    if (act === 'resubmit') {
      ui.draftId = id;
      ui.submitLockKey = `art-submit-${id}-${Date.now()}`;
      await submitCurrent();
      return;
    }
  }

  function onChange(e) {
    const t = e.target;
    if (t.matches('[data-art-cover]') && t.files?.[0]) attachCover(t.files[0]);
    if (t.matches('[data-art-video]') && t.files?.[0]) attachVideo(t.files[0]);
    if (t.matches('[data-art-extra]') && t.files?.[0]) attachExtra(t.files[0]);
  }

  function onFmt(e) {
    const btn = e.target.closest('[data-art-fmt]');
    if (!btn) return;
    const ta = document.querySelector('#art-wizard textarea[name="body"]');
    if (!ta) return;
    const kind = btn.getAttribute('data-art-fmt');
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = ta.value.slice(start, end) || 'نص';
    let insert = sel;
    if (kind === 'bold') insert = `**${sel}**`;
    if (kind === 'h2') insert = `\n## ${sel}\n`;
    if (kind === 'ul') insert = `\n- ${sel}\n`;
    if (kind === 'link') insert = `[${sel}](https://)`;
    ta.value = ta.value.slice(0, start) + insert + ta.value.slice(end);
    autoSaveFromDom();
    updatePreviewDom();
  }

  async function boot() {
    if (!document.getElementById('art-app')) return;
    readHash();
    paint();
    if ((location.hash || '').includes('submit') && loggedIn()) {
      try {
        await ensureDraft();
        paint();
      } catch (err) {
        ui.formError = err?.message || 'تعذر إنشاء المسودة';
        paint();
      }
    }
    document.addEventListener('click', onAction);
    document.addEventListener('click', onFmt);
    document.addEventListener('change', onChange);
    document.addEventListener('input', (e) => {
      if (e.target.closest('#art-wizard')) {
        clearTimeout(boot._t);
        boot._t = setTimeout(() => {
          autoSaveFromDom();
          updatePreviewDom();
        }, 700);
      }
    });
    window.addEventListener('hashchange', () => {
      readHash();
      paint();
      if (ui.view === 'submit' && loggedIn() && !draft()) {
        ensureDraft()
          .then(() => paint())
          .catch(() => paint());
      }
    });
    window.addEventListener('hub-articles-changed', () => {
      if (ui.view === 'mine' || ui.view === 'detail' || ui.view === 'home' || ui.view === 'success') paint();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.HubArticlesUI = { paint, ui };
})();
