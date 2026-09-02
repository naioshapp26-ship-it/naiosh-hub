/**
 * ورشة نشر البحث — كتابة واضحة · رفع نص/PDF/صورة/فيديو · أقسام CRUD · أسئلة نايوش والباحث
 */
window.HubResearchPublish = (() => {
  'use strict';

  const KEY = 'hub-research-submissions';
  const NAIOSH_BANK = [
    'ما المشكلة التشغيلية التي يعالجها البحث؟',
    'ما التوصية القابلة للتنفيذ خلال 30 يومًا؟',
    'على أي محور من هوب ينطبق البحث (حاضنة · منصة · نظام · فرع)؟',
    'ما مؤشرات القياس التي تثبت نجاح التوصية؟',
    'من الجمهور المستهدف وكيف سيطبّق النتيجة؟',
    'ما المخاطر إن لم يُنفَّذ البحث؟',
    'ما المصادر أو التجارب التي استندت إليها؟',
    'كيف يتحول الملخص إلى خطوة داخل غرفة العمليات؟',
  ];

  const uid = (prefix = 'rs') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const nowIso = () => new Date().toISOString();

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const emptyDraft = () => ({
    id: uid(),
    title: '',
    section: 'content',
    summary: '',
    body: '',
    author: '',
    link: '',
    status: 'draft',
    at: nowIso(),
    updatedAt: nowIso(),
    parts: [],
    attachments: [],
    naioshQuestions: [],
    researcherQuestions: [],
  });

  const readAll = () => {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };

  const writeAll = (list) => {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 40)));
    return list;
  };

  const saveItem = (item) => {
    const list = readAll();
    const next = { ...item, updatedAt: nowIso() };
    const i = list.findIndex((x) => x.id === next.id);
    if (i >= 0) list[i] = next;
    else list.unshift(next);
    writeAll(list);
    return next;
  };

  const removeItem = (id) => writeAll(readAll().filter((x) => x.id !== id));

  const naioshReply = (q = '') => {
    const t = String(q || '');
    if (/رفع|ملف|pdf|صورة|فيديو|نص/i.test(t)) {
      return 'ارفع من مربعات المرفقات الأربعة: ملف نص، PDF، صورة، وفيديو — الحد حتى 150 ميجابايت. بعد الرفع يظهر الملف تحت المربع ويمكن حذفه.';
    }
    if (/قسم|فصل|تعديل|حذف|تصحيح|إضاف/i.test(t)) {
      return 'أقسام البحث تحت «هيكل البحث»: أضف قسمًا، صحّح النص، عدّل العنوان، أو احذف القسم. النص الكامل يبقى في مساحة الكتابة الكبيرة أعلى النموذج.';
    }
    if (/سؤال|نايوش|مراجع/i.test(t)) {
      return 'اضغط «اطرح أسئلة نايوش» ليظهر أكثر من سؤال تشغيلي. أجب كل سؤال في خانته. ولأسئلتك أنت استخدم عمود «أسئلة الباحث».';
    }
    if (/حاضن|منصة|فرع|تشغيل/i.test(t)) {
      return 'اربط البحث بمسار تشغيل واضح: حاضنة أو منصة أو فرع، واذكر خطوة واحدة يمكن تنفيذها من غرفة العمليات خلال 30 يومًا.';
    }
    if (/ملخص|عنوان|كيف أكتب/i.test(t)) {
      return 'العنوان يصف النتيجة لا الموضوع فقط. مساحة «نص البحث» للكتابة المطوّلة. الملخص فقرة قصيرة للنتيجة والتوصية حتى يظهر العدد في سيكشن الرئيسية بعد الإرسال.';
    }
    return 'اكتب البحث في المساحة الكبيرة، قسّمه إلى أقسام، وارفع المراجع (نص · PDF · صورة · فيديو). نايوش يطرح أسئلة تشغيلية ويمكنك طرح أسئلتك في العمود المقابل.';
  };

  const root = () => document.querySelector('[data-research-workspace]');

  const state = {
    current: emptyDraft(),
    uploading: false,
  };

  const $ = (sel, el = root()) => el?.querySelector(sel);
  const $$ = (sel, el = root()) => [...(el?.querySelectorAll(sel) || [])];

  const toast = (text, isError = false) => {
    const msg = $('#researchPublishMsg');
    if (!msg) return;
    msg.hidden = false;
    msg.textContent = text;
    msg.classList.toggle('is-error', !!isError);
  };

  const field = (name) => {
    const form = $('#researchPublishForm');
    return form?.elements?.namedItem?.(name) || form?.querySelector?.(`[name="${name}"]`);
  };

  const fillForm = (item) => {
    state.current = {
      ...emptyDraft(),
      ...item,
      parts: Array.isArray(item.parts) ? item.parts : [],
      attachments: Array.isArray(item.attachments) ? item.attachments : [],
      naioshQuestions: Array.isArray(item.naioshQuestions) ? item.naioshQuestions : [],
      researcherQuestions: Array.isArray(item.researcherQuestions) ? item.researcherQuestions : [],
    };
    const set = (name, value) => {
      const el = field(name);
      if (el) el.value = value || '';
    };
    set('title', state.current.title);
    set('section', state.current.section || 'content');
    set('summary', state.current.summary);
    set('body', state.current.body);
    set('author', state.current.author);
    set('link', state.current.link);
    renderParts();
    renderFiles();
    renderNaiosh();
    renderResearcherQs();
    renderDrafts();
  };

  const collectForm = () => {
    const val = (name) => String(field(name)?.value || '').trim();
    state.current.title = val('title');
    state.current.section = val('section') || 'content';
    state.current.summary = val('summary');
    state.current.body = val('body');
    state.current.author = val('author');
    state.current.link = val('link');
    return state.current;
  };

  const persistDraft = () => {
    const item = collectForm();
    if (!item.title && !item.body && !item.parts.length && !item.attachments.length) return item;
    if (!item.at) item.at = nowIso();
    return saveItem(item);
  };

  const renderDrafts = () => {
    const box = $('[data-rp-drafts]');
    if (!box) return;
    const list = readAll();
    if (!list.length) {
      box.innerHTML = '<p class="rp-empty">لا بحوث محفوظة بعد — ابدأ الكتابة ثم احفظ أو أرسل.</p>';
      return;
    }
    box.innerHTML = list
      .map((item) => {
        const active = item.id === state.current.id ? ' is-active' : '';
        const badge = item.status === 'pending' ? 'بانتظار المراجعة' : 'مسودة';
        const badgeCls = item.status === 'pending' ? ' is-pending' : '';
        return `<article class="rp-draft${active}" data-id="${esc(item.id)}">
          <div class="rp-item-head">
            <strong>${esc(item.title || 'بحث بلا عنوان')}</strong>
            <span class="rp-badge${badgeCls}">${badge}</span>
          </div>
          <small>${esc((item.summary || item.body || '').slice(0, 90))}${
          (item.summary || item.body || '').length > 90 ? '…' : ''
        }</small>
          <div class="rp-acts">
            <button type="button" class="btn btn-secondary" data-rp-edit="${esc(item.id)}"><i class="fas fa-pen"></i> تعديل</button>
            <button type="button" class="btn btn-secondary" data-rp-delete="${esc(item.id)}"><i class="fas fa-trash"></i> حذف</button>
          </div>
        </article>`;
      })
      .join('');
  };

  const renderParts = () => {
    const box = $('[data-rp-parts]');
    if (!box) return;
    const parts = state.current.parts || [];
    if (!parts.length) {
      box.innerHTML = '<p class="rp-empty">لا أقسام بعد — أضف قسمًا للنتائج أو المنهج أو التوصية.</p>';
      return;
    }
    box.innerHTML = parts
      .map(
        (p, i) => `<article class="rp-item" data-part="${esc(p.id)}">
          <div class="rp-item-head">
            <strong>قسم ${i + 1}</strong>
            <div class="rp-acts">
              <button type="button" class="btn btn-secondary" data-rp-part-fix="${esc(p.id)}"><i class="fas fa-spell-check"></i> تصحيح</button>
              <button type="button" class="btn btn-secondary" data-rp-part-edit="${esc(p.id)}"><i class="fas fa-pen"></i> تعديل</button>
              <button type="button" class="btn btn-secondary" data-rp-part-del="${esc(p.id)}"><i class="fas fa-trash"></i> حذف</button>
            </div>
          </div>
          <label class="rp-field">عنوان القسم
            <input data-rp-part-heading="${esc(p.id)}" value="${esc(p.heading || '')}" placeholder="مثال: النتائج التشغيلية" />
          </label>
          <label class="rp-field">نص القسم
            <textarea data-rp-part-body="${esc(p.id)}" rows="5" placeholder="اكتب هذا الجزء بوضوح…">${esc(p.body || '')}</textarea>
          </label>
        </article>`
      )
      .join('');
  };

  const kindMeta = {
    text: { icon: 'fa-file-lines', label: 'نص' },
    pdf: { icon: 'fa-file-pdf', label: 'PDF' },
    image: { icon: 'fa-image', label: 'صورة' },
    video: { icon: 'fa-video', label: 'فيديو' },
  };

  const renderFiles = () => {
    ['text', 'pdf', 'image', 'video'].forEach((kind) => {
      const box = $(`[data-rp-files="${kind}"]`);
      if (!box) return;
      const files = (state.current.attachments || []).filter((f) => f.kind === kind);
      if (!files.length) {
        box.innerHTML = '';
        return;
      }
      box.innerHTML = files
        .map((f) => {
          const url = f.url || '';
          const thumb = kind === 'image' && url ? `<img src="${esc(url)}" alt="" />` : '';
          const vid = kind === 'video' && url ? `<video src="${esc(url)}" muted></video>` : '';
          return `<div class="rp-file">
            ${thumb || vid || `<i class="fas ${kindMeta[kind].icon}"></i>`}
            <a href="${esc(url || '#')}" ${url ? 'target="_blank" rel="noopener"' : ''}>${esc(f.name || kindMeta[kind].label)}</a>
            <button type="button" class="btn btn-secondary" data-rp-file-del="${esc(f.id)}">حذف</button>
          </div>`;
        })
        .join('');
    });
  };

  const renderNaiosh = () => {
    const box = $('[data-rp-naiosh]');
    if (!box) return;
    const qs = state.current.naioshQuestions || [];
    if (!qs.length) {
      box.innerHTML = '<p class="rp-empty">لم تطرح نايوش أسئلة بعد — اضغط «اطرح أسئلة نايوش» لإضافة أكثر من سؤال.</p>';
      return;
    }
    box.innerHTML = qs
      .map(
        (q, i) => `<article class="rp-q" data-nq="${esc(q.id)}">
          <div class="rp-item-head">
            <strong>سؤال نايوش ${i + 1}</strong>
            <div class="rp-acts">
              <button type="button" class="btn btn-secondary" data-nq-del="${esc(q.id)}"><i class="fas fa-trash"></i> حذف</button>
            </div>
          </div>
          <label class="rp-field">نص السؤال
            <input data-nq-text="${esc(q.id)}" value="${esc(q.text || '')}" />
          </label>
          <label class="rp-field">إجابتك
            <textarea class="rp-answer" data-nq-answer="${esc(q.id)}" rows="3" placeholder="أجب بوضوح…">${esc(q.answer || '')}</textarea>
          </label>
        </article>`
      )
      .join('');
  };

  const renderResearcherQs = () => {
    const box = $('[data-rp-researcher]');
    if (!box) return;
    const qs = state.current.researcherQuestions || [];
    if (!qs.length) {
      box.innerHTML = '<p class="rp-empty">لا أسئلة من الباحث بعد — اكتب سؤالك وأرسله لنايوش.</p>';
      return;
    }
    box.innerHTML = qs
      .map(
        (q) => `<article class="rp-q" data-rq="${esc(q.id)}">
          <div class="rp-item-head">
            <strong>سؤال الباحث</strong>
            <div class="rp-acts">
              <button type="button" class="btn btn-secondary" data-rq-edit="${esc(q.id)}"><i class="fas fa-pen"></i> تعديل</button>
              <button type="button" class="btn btn-secondary" data-rq-del="${esc(q.id)}"><i class="fas fa-trash"></i> حذف</button>
            </div>
          </div>
          <p>${esc(q.text)}</p>
          <div class="rp-reply"><b>رد نايوش:</b> ${esc(q.reply || '')}</div>
        </article>`
      )
      .join('');
  };

  const addPart = () => {
    state.current.parts = state.current.parts || [];
    state.current.parts.push({ id: uid('part'), heading: '', body: '' });
    renderParts();
    persistDraft();
    const last = $$('[data-rp-part-heading]').pop();
    last?.focus();
  };

  const focusPart = (id, field) => {
    const sel = field === 'heading' ? `[data-rp-part-heading="${id}"]` : `[data-rp-part-body="${id}"]`;
    const el = $(sel);
    el?.focus();
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const addNaioshQuestions = (count = 3) => {
    state.current.naioshQuestions = state.current.naioshQuestions || [];
    const used = new Set(state.current.naioshQuestions.map((q) => q.text));
    const fresh = NAIOSH_BANK.filter((t) => !used.has(t));
    const pick = (fresh.length ? fresh : NAIOSH_BANK).slice(0, count);
    pick.forEach((text) => {
      state.current.naioshQuestions.push({ id: uid('nq'), text, answer: '', askedAt: nowIso() });
    });
    renderNaiosh();
    persistDraft();
  };

  const detectKind = (file, forced) => {
    if (forced) return forced;
    const name = String(file.name || '').toLowerCase();
    const mime = String(file.type || '').toLowerCase();
    if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(name)) return 'image';
    if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/.test(name)) return 'video';
    if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
    return 'text';
  };

  const showProgress = (pct) => {
    const bar = $('[data-rp-progress]');
    if (!bar) return;
    bar.hidden = pct == null;
    const i = bar.querySelector('i');
    if (i) i.style.width = `${Math.max(0, Math.min(100, pct || 0))}%`;
  };

  const ingest = async (file, kind) => {
    const limits = window.HubUploadLimits;
    if (limits?.assertFile) {
      const check = limits.assertFile(file);
      if (!check.ok) throw new Error(check.error);
    }
    if (limits?.uploadFile) {
      const uploaded = await limits.uploadFile(file, { onProgress: showProgress });
      return { url: uploaded.url, mime: uploaded.mime || file.type, name: file.name, size: file.size };
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('فشل قراءة الملف'));
      reader.readAsDataURL(file);
    });
    return { url: dataUrl, mime: file.type, name: file.name, size: file.size };
  };

  const onFile = async (input, forcedKind) => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const kind = detectKind(file, forcedKind);
    try {
      state.uploading = true;
      showProgress(8);
      toast(`جاري رفع ${file.name}…`);
      const media = await ingest(file, kind);
      state.current.attachments = state.current.attachments || [];
      state.current.attachments.push({
        id: uid('file'),
        kind,
        name: media.name,
        mime: media.mime,
        url: media.url,
        size: media.size,
      });
      if (kind === 'text' && file.size < 400000 && /\.(txt|md|csv)$/i.test(file.name)) {
        const text = await file.text();
        const body = field('body');
        if (body && text.trim()) {
          body.value = [body.value, text.trim()].filter(Boolean).join('\n\n');
          state.current.body = body.value;
        }
      }
      renderFiles();
      persistDraft();
      toast(`تم رفع ${file.name}`);
    } catch (err) {
      toast(err.message || 'تعذّر رفع الملف', true);
    } finally {
      state.uploading = false;
      showProgress(null);
    }
  };

  const bind = () => {
    const workspace = root();
    if (!workspace || workspace.dataset.bound) return;
    workspace.dataset.bound = '1';

    workspace.addEventListener('input', (e) => {
      const partH = e.target.closest('[data-rp-part-heading]');
      const partB = e.target.closest('[data-rp-part-body]');
      const nqT = e.target.closest('[data-nq-text]');
      const nqA = e.target.closest('[data-nq-answer]');
      if (partH) {
        const part = state.current.parts.find((p) => p.id === partH.dataset.rpPartHeading);
        if (part) part.heading = partH.value;
      }
      if (partB) {
        const part = state.current.parts.find((p) => p.id === partB.dataset.rpPartBody);
        if (part) part.body = partB.value;
      }
      if (nqT) {
        const q = state.current.naioshQuestions.find((x) => x.id === nqT.dataset.nqText);
        if (q) q.text = nqT.value;
      }
      if (nqA) {
        const q = state.current.naioshQuestions.find((x) => x.id === nqA.dataset.nqAnswer);
        if (q) q.answer = nqA.value;
      }
      clearTimeout(bind._save);
      bind._save = setTimeout(persistDraft, 450);
    });

    workspace.addEventListener('change', (e) => {
      const file = e.target.closest('[data-rp-upload]');
      if (file) onFile(file, file.dataset.rpUpload);
    });

    workspace.addEventListener('click', (e) => {
      const addPartBtn = e.target.closest('[data-rp-add-part]');
      const partDel = e.target.closest('[data-rp-part-del]');
      const partEdit = e.target.closest('[data-rp-part-edit]');
      const partFix = e.target.closest('[data-rp-part-fix]');
      const fileDel = e.target.closest('[data-rp-file-del]');
      const askNaiosh = e.target.closest('[data-rp-ask-naiosh]');
      const addNaiosh = e.target.closest('[data-rp-add-naiosh]');
      const nqDel = e.target.closest('[data-nq-del]');
      const askMine = e.target.closest('[data-rp-ask-mine]');
      const rqDel = e.target.closest('[data-rq-del]');
      const rqEdit = e.target.closest('[data-rq-edit]');
      const editDraft = e.target.closest('[data-rp-edit]');
      const delDraft = e.target.closest('[data-rp-delete]');
      const newDraft = e.target.closest('[data-rp-new]');
      const saveDraft = e.target.closest('[data-rp-save]');

      if (addPartBtn) addPart();
      if (partDel) {
        state.current.parts = state.current.parts.filter((p) => p.id !== partDel.dataset.rpPartDel);
        renderParts();
        persistDraft();
      }
      if (partEdit) focusPart(partEdit.dataset.rpPartEdit, 'heading');
      if (partFix) focusPart(partFix.dataset.rpPartFix, 'body');
      if (fileDel) {
        state.current.attachments = state.current.attachments.filter((f) => f.id !== fileDel.dataset.rpFileDel);
        renderFiles();
        persistDraft();
      }
      if (askNaiosh) addNaioshQuestions(3);
      if (addNaiosh) addNaioshQuestions(1);
      if (nqDel) {
        state.current.naioshQuestions = state.current.naioshQuestions.filter((q) => q.id !== nqDel.dataset.nqDel);
        renderNaiosh();
        persistDraft();
      }
      if (askMine) {
        const input = $('[data-rp-mine-q]');
        const text = String(input?.value || '').trim();
        if (!text) return toast('اكتب سؤالك أولاً', true);
        state.current.researcherQuestions = state.current.researcherQuestions || [];
        state.current.researcherQuestions.unshift({
          id: uid('rq'),
          text,
          reply: naioshReply(text),
          askedAt: nowIso(),
        });
        if (input) input.value = '';
        renderResearcherQs();
        persistDraft();
      }
      if (rqDel) {
        state.current.researcherQuestions = state.current.researcherQuestions.filter((q) => q.id !== rqDel.dataset.rqDel);
        renderResearcherQs();
        persistDraft();
      }
      if (rqEdit) {
        const q = state.current.researcherQuestions.find((x) => x.id === rqEdit.dataset.rqEdit);
        const input = $('[data-rp-mine-q]');
        if (q && input) {
          input.value = q.text;
          input.focus();
          state.current.researcherQuestions = state.current.researcherQuestions.filter((x) => x.id !== q.id);
          renderResearcherQs();
        }
      }
      if (editDraft) {
        const item = readAll().find((x) => x.id === editDraft.dataset.rpEdit);
        if (item) fillForm(item);
      }
      if (delDraft) {
        if (!confirm('حذف هذا البحث نهائيًا؟')) return;
        removeItem(delDraft.dataset.rpDelete);
        if (state.current.id === delDraft.dataset.rpDelete) fillForm(emptyDraft());
        else renderDrafts();
        toast('حُذف البحث');
      }
      if (newDraft) {
        persistDraft();
        fillForm(emptyDraft());
        toast('ورشة بحث جديدة');
      }
      if (saveDraft) {
        const item = persistDraft();
        if (!item.title) return toast('أدخل عنوان البحث قبل الحفظ', true);
        toast('حُفظت المسودة — يمكنك التعديل أو الإرسال للمراجعة');
        renderDrafts();
      }
    });

    $('#researchPublishForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const item = collectForm();
      if (!item.title) return toast('عنوان البحث مطلوب', true);
      if (!item.body && !item.parts.some((p) => p.body && p.body.trim()) && !item.attachments.length) {
        return toast('اكتب نص البحث أو أضف قسمًا أو ارفع ملفًا', true);
      }
      if (!item.author) return toast('اسمك / الجهة مطلوب', true);
      item.status = 'pending';
      item.at = item.at || nowIso();
      saveItem(item);
      renderDrafts();
      toast('تم استلام بحثك للمراجعة. سيظهر العدّاد في سيكشن الرئيسية.');
    });

    const existing = readAll()[0];
    if (existing && existing.status === 'draft') fillForm(existing);
    else {
      renderParts();
      renderFiles();
      renderNaiosh();
      renderResearcherQs();
      renderDrafts();
    }
  };

  const boot = () => bind();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  return {
    KEY,
    NAIOSH_BANK,
    naioshReply,
    readAll,
    saveItem,
    emptyDraft,
  };
})();
