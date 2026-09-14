/**
 * NAIOSH HUB — Articles submission + review workflow
 * Customer View: blog.html (wizard / مقالاتي)
 * Admin View: dashboard #content-articles + آلية التشغيل
 * One Article record — no duplicates.
 */
(() => {
  'use strict';

  const KEY = 'naiosh_articles_v1';
  const nowIso = () => new Date().toISOString();

  const CATEGORIES = [
    'إدارة',
    'تشغيل',
    'تقنية',
    'مالية',
    'حوكمة',
    'موارد بشرية',
    'تسويق',
    'ريادة أعمال',
    'أخرى',
  ];

  const STATUS = {
    Draft: 'مسودة',
    'Pending Review': 'بانتظار المراجعة',
    'Under Review': 'قيد المراجعة',
    'Needs Changes': 'يحتاج تعديلات',
    Approved: 'تم الاعتماد',
    Scheduled: 'مجدول للنشر',
    Published: 'منشور',
    Unpublished: 'موقوف',
    Rejected: 'مرفوض',
    Archived: 'مؤرشف',
  };

  const CUSTOMER_SAFE = new Set(Object.keys(STATUS));

  const nextSeq = (list, prefix) => {
    const year = new Date().getFullYear();
    const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
    let max = 0;
    (list || []).forEach((row) => {
      const m = String(row.id || row.runId || '').match(re);
      if (m) max = Math.max(max, Number(m[1]));
    });
    return `${prefix}-${year}-${String(max + 1).padStart(5, '0')}`;
  };

  const blank = () => ({
    schemaVersion: 1,
    articles: [],
    runs: [],
    auditLog: [],
    settings: {
      maxArticleMb: 15,
      maxCoverMb: 5,
      articleExts: ['.docx', '.pdf', '.txt'],
      coverExts: ['.jpg', '.jpeg', '.png', '.webp'],
      defaultReviewer: 'Content Desk',
      workflowId: 'WF-ARTICLE-01',
      workflowName: 'مراجعة ونشر المقالات',
    },
  });

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        const s = blank();
        localStorage.setItem(KEY, JSON.stringify(s));
        return s;
      }
      const parsed = JSON.parse(raw);
      if (!parsed.schemaVersion) Object.assign(parsed, blank());
      if (!Array.isArray(parsed.articles)) parsed.articles = [];
      if (!Array.isArray(parsed.runs)) parsed.runs = [];
      if (!Array.isArray(parsed.auditLog)) parsed.auditLog = [];
      parsed.settings = Object.assign(blank().settings, parsed.settings || {});
      return parsed;
    } catch {
      return blank();
    }
  };

  let state = load();

  const save = () => {
    localStorage.setItem(KEY, JSON.stringify(state));
    try {
      window.dispatchEvent(new CustomEvent('hub-articles-changed', { detail: { count: state.articles.length } }));
    } catch (_) {}
    return state;
  };

  const pushAudit = (entry = {}) => {
    const row = {
      id: nextSeq(state.auditLog, 'TX'),
      at: nowIso(),
      action: entry.action || 'update',
      articleId: entry.articleId || '',
      runId: entry.runId || '',
      performedBy: entry.performedBy || 'نظام',
      oldValue: entry.oldValue || '',
      newValue: entry.newValue || '',
      detail: entry.detail || '',
    };
    state.auditLog.unshift(row);
    state.auditLog = state.auditLog.slice(0, 500);
    return row;
  };

  const timelineStep = (key, label, done, at, comment) => ({
    key,
    label,
    done: !!done,
    at: at || '',
    comment: comment || '',
  });

  const defaultTimeline = () => [
    timelineStep('draft', 'تم إنشاء المسودة', false),
    timelineStep('content', 'تم رفع المحتوى', false),
    timelineStep('submitted', 'تم إرسال المقال', false),
    timelineStep('review', 'قيد المراجعة', false),
    timelineStep('decision', 'الاعتماد', false),
    timelineStep('publish', 'النشر', false),
  ];

  const markTimeline = (article, key, comment, at = nowIso()) => {
    article.timeline = article.timeline || defaultTimeline();
    const step = article.timeline.find((t) => t.key === key);
    if (step) {
      step.done = true;
      step.at = at;
      if (comment) step.comment = comment;
    }
  };

  const currentUser = () => {
    try {
      return window.HubAuth?.getUser?.() || null;
    } catch {
      return null;
    }
  };

  const actorName = (fallback = 'زائر') => {
    const u = currentUser();
    return (u && (u.name || u.fullName || u.email)) || fallback;
  };

  const get = (id) => state.articles.find((a) => a.id === id || a.articleId === id) || null;

  const list = (filter = {}) => {
    let rows = state.articles.slice();
    if (filter.status) rows = rows.filter((a) => a.status === filter.status);
    if (filter.authorEmail) {
      const em = String(filter.authorEmail).toLowerCase();
      rows = rows.filter((a) => String(a.authorEmail || '').toLowerCase() === em);
    }
    if (filter.mine) {
      const u = currentUser();
      const em = String(u?.email || filter.email || '').toLowerCase();
      const name = String(u?.name || '').toLowerCase();
      rows = rows.filter(
        (a) =>
          (em && String(a.authorEmail || '').toLowerCase() === em) ||
          (name && String(a.authorName || '').toLowerCase() === name) ||
          a.createdBySession === filter.sessionId
      );
    }
    if (filter.q) {
      const q = String(filter.q).toLowerCase();
      rows = rows.filter(
        (a) =>
          String(a.id).toLowerCase().includes(q) ||
          String(a.title || '').toLowerCase().includes(q) ||
          String(a.authorName || '').toLowerCase().includes(q) ||
          String(a.category || '').toLowerCase().includes(q)
      );
    }
    if (filter.incoming) {
      rows = rows.filter((a) =>
        ['Pending Review', 'Under Review', 'Needs Changes', 'Approved', 'Scheduled'].includes(a.status)
      );
    }
    if (filter.published) rows = rows.filter((a) => a.status === 'Published');
    return rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  };

  const createDraft = (fields = {}, actor) => {
    const id = nextSeq(state.articles, 'ART');
    const u = currentUser();
    const article = {
      id,
      articleId: id,
      title: String(fields.title || '').trim(),
      category: String(fields.category || '').trim(),
      summary: String(fields.summary || '').trim(),
      authorName: String(fields.authorName || u?.name || u?.fullName || '').trim() || actorName(actor),
      authorEmail: String(fields.authorEmail || u?.email || '').trim(),
      company: String(fields.company || '').trim(),
      tags: Array.isArray(fields.tags)
        ? fields.tags
        : String(fields.tags || '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
      contentMode: fields.contentMode || '',
      body: String(fields.body || ''),
      articleFile: fields.articleFile || null,
      coverImage: fields.coverImage || null,
      attachments: Array.isArray(fields.attachments) ? fields.attachments : [],
      status: 'Draft',
      statusAr: STATUS.Draft,
      reviewer: '',
      reviewNotes: '',
      publishedAt: '',
      scheduledAt: '',
      workflowId: state.settings.workflowId,
      workflowName: state.settings.workflowName,
      runId: '',
      sourceModule: 'المقالات',
      sourcePage: 'blog.html#submit',
      channel: 'Web',
      createdBy: actor || actorName(),
      createdBySession: fields.sessionId || '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      submittedAt: '',
      requestId: '',
      timeline: defaultTimeline(),
      messages: [],
    };
    markTimeline(article, 'draft', 'مسودة أولية');
    state.articles.unshift(article);
    pushAudit({
      action: 'Article Created',
      articleId: id,
      performedBy: article.createdBy,
      newValue: 'Draft',
    });
    save();
    return article;
  };

  const update = (id, patch = {}, actor) => {
    const article = get(id);
    if (!article) return null;
    const prev = { ...article };
    Object.keys(patch).forEach((k) => {
      if (patch[k] !== undefined) article[k] = patch[k];
    });
    article.updatedAt = nowIso();
    article.statusAr = STATUS[article.status] || article.status;
    if (article.body || article.articleFile) markTimeline(article, 'content', 'تم حفظ المحتوى');
    pushAudit({
      action: 'Article Updated',
      articleId: article.id,
      performedBy: actor || actorName(),
      detail: Object.keys(patch).join(', '),
      oldValue: prev.status,
      newValue: article.status,
    });
    save();
    return article;
  };

  const startRun = (article, actor) => {
    const runId = nextSeq(state.runs, 'RUN');
    const run = {
      runId,
      workflowId: state.settings.workflowId,
      workflowName: state.settings.workflowName,
      articleId: article.id,
      trigger: 'New Article Submitted',
      status: 'Waiting for Review',
      currentStep: 'مراجعة المحتوى',
      startedAt: nowIso(),
      completedAt: '',
      performedBy: actor || actorName(),
      steps: [
        { name: 'استقبال المقال', status: 'done', at: nowIso() },
        { name: 'التحقق من البيانات', status: 'done', at: nowIso() },
        { name: 'إنشاء Article ID', status: 'done', at: nowIso(), output: article.id },
        { name: 'إشعار فريق المحتوى', status: 'done', at: nowIso() },
        { name: 'تعيين مراجع', status: 'pending', owner: state.settings.defaultReviewer },
        { name: 'انتظار القرار', status: 'pending' },
        { name: 'اعتماد / طلب تعديل', status: 'pending' },
        { name: 'النشر', status: 'pending' },
        { name: 'إرسال إشعار', status: 'pending' },
      ],
    };
    state.runs.unshift(run);
    article.runId = runId;
    article.reviewer = article.reviewer || state.settings.defaultReviewer;
    return run;
  };

  const submit = (id, actor) => {
    const article = get(id);
    if (!article) return { ok: false, error: 'المقال غير موجود' };
    if (!article.title?.trim()) return { ok: false, error: 'عنوان المقال مطلوب.' };
    if (!article.category?.trim()) return { ok: false, error: 'يرجى اختيار التصنيف.' };
    if (!article.summary?.trim()) return { ok: false, error: 'النبذة المختصرة مطلوبة.' };
    if (!String(article.body || '').trim() && !article.articleFile) {
      return { ok: false, error: 'يرجى كتابة المقال أو رفع ملف.' };
    }
    const who = actor || actorName();
    article.status = 'Pending Review';
    article.statusAr = STATUS['Pending Review'];
    article.submittedAt = nowIso();
    article.updatedAt = article.submittedAt;
    markTimeline(article, 'content', 'محتوى جاهز');
    markTimeline(article, 'submitted', 'أُرسل للمراجعة');
    markTimeline(article, 'review', 'بانتظار فريق المحتوى');
    const run = startRun(article, who);
    pushAudit({
      action: 'Article Submitted',
      articleId: article.id,
      runId: run.runId,
      performedBy: who,
      oldValue: 'Draft',
      newValue: 'Pending Review',
    });
    save();
    try {
      if (window.HubCustomerRequests?.ensureForArticle) {
        const req = window.HubCustomerRequests.ensureForArticle(article, who);
        if (req?.id) {
          article.requestId = req.id;
          save();
        }
      }
    } catch (_) {}
    return { ok: true, article, run, requestId: article.requestId };
  };

  const setStatus = (id, status, actor, note = '', opts = {}) => {
    const article = get(id);
    if (!article || !STATUS[status]) return null;
    const old = article.status;
    article.status = status;
    article.statusAr = STATUS[status];
    article.updatedAt = nowIso();
    if (note) article.reviewNotes = note;
    const run = state.runs.find((r) => r.runId === article.runId);
    if (status === 'Under Review') {
      markTimeline(article, 'review', note || 'بدأت المراجعة');
      if (run) {
        run.status = 'In Progress';
        run.currentStep = 'مراجعة المحتوى';
        const step = run.steps.find((s) => s.name === 'تعيين مراجع');
        if (step) {
          step.status = 'done';
          step.at = nowIso();
        }
      }
    }
    if (status === 'Needs Changes') {
      if (run) {
        run.status = 'Waiting for Author';
        run.currentStep = 'بانتظار تعديلات الكاتب';
      }
    }
    if (status === 'Approved') {
      markTimeline(article, 'decision', note || 'تم الاعتماد');
      if (run) {
        run.status = 'Ready to Publish';
        run.currentStep = 'جاهز للنشر';
        run.steps.forEach((s) => {
          if (['انتظار القرار', 'اعتماد / طلب تعديل', 'تعيين مراجع'].includes(s.name)) {
            s.status = 'done';
            s.at = s.at || nowIso();
          }
        });
      }
    }
    if (status === 'Scheduled') {
      article.scheduledAt = note || article.scheduledAt || nowIso();
      if (run) {
        run.status = 'Scheduled';
        run.currentStep = 'مجدول للنشر';
      }
    }
    if (status === 'Published') {
      article.publishedAt = nowIso();
      markTimeline(article, 'decision', 'معتمد');
      markTimeline(article, 'publish', 'تم النشر');
      if (run) {
        run.status = 'Completed';
        run.currentStep = 'منشور';
        run.completedAt = nowIso();
        run.steps.forEach((s) => {
          s.status = 'done';
          s.at = s.at || nowIso();
        });
      }
      mirrorToPublicBlog(article);
    }
    if (status === 'Unpublished') {
      unpublishFromPublicBlog(article.id);
      if (run) {
        run.status = 'Paused';
        run.currentStep = 'موقوف عن النشر';
      }
    }
    if (status === 'Archived') {
      unpublishFromPublicBlog(article.id);
      if (run) {
        run.status = 'Archived';
        run.completedAt = nowIso();
        run.currentStep = 'مؤرشف';
      }
    }
    if (status === 'Rejected') {
      if (run) {
        run.status = 'Rejected';
        run.completedAt = nowIso();
        run.currentStep = 'مرفوض';
      }
    }
    pushAudit({
      action: 'Status Changed',
      articleId: article.id,
      runId: article.runId,
      performedBy: actor || actorName(),
      oldValue: old,
      newValue: status,
      detail: note,
    });
    save();
    if (!opts.skipRequestSync) {
      try {
        if (window.HubCustomerRequests?.ensureForArticle) {
          const req = window.HubCustomerRequests.ensureForArticle(article, actor || actorName());
          if (req?.id && article.requestId !== req.id) {
            article.requestId = req.id;
            save();
          }
          if (req?.id && window.HubCustomerRequests.updateStatus && req.status !== window.HubCustomerRequests.mapArticleStatus?.(status)) {
            /* ensureForArticle already synced status */
          }
        }
      } catch (_) {}
    }
    return article;
  };

  const assignReviewer = (id, reviewer, actor) => {
    const article = get(id);
    if (!article) return null;
    const old = article.reviewer;
    article.reviewer = reviewer;
    article.updatedAt = nowIso();
    if (article.status === 'Pending Review') {
      article.status = 'Under Review';
      article.statusAr = STATUS['Under Review'];
    }
    const run = state.runs.find((r) => r.runId === article.runId);
    if (run) {
      run.currentStep = 'مراجعة المحتوى';
      run.status = 'In Progress';
      const step = run.steps.find((s) => s.name === 'تعيين مراجع');
      if (step) {
        step.status = 'done';
        step.owner = reviewer;
        step.at = nowIso();
      }
    }
    pushAudit({
      action: 'Reviewer Assigned',
      articleId: article.id,
      runId: article.runId,
      performedBy: actor || actorName(),
      oldValue: old,
      newValue: reviewer,
    });
    save();
    return article;
  };

  const requestChanges = (id, note, actor) => setStatus(id, 'Needs Changes', actor, note);
  const approve = (id, actor, note) => setStatus(id, 'Approved', actor, note || '');
  const reject = (id, note, actor) => setStatus(id, 'Rejected', actor, note);
  const publishNow = (id, actor, opts = {}) => setStatus(id, 'Published', actor, 'نشر فوري', opts);
  const unpublish = (id, actor, opts = {}) => setStatus(id, 'Unpublished', actor, 'إيقاف النشر', opts);
  const archive = (id, actor, opts = {}) => setStatus(id, 'Archived', actor, 'أرشفة', opts);
  const schedule = (id, whenIso, actor) => {
    const article = setStatus(id, 'Scheduled', actor, whenIso);
    if (article) article.scheduledAt = whenIso;
    save();
    return article;
  };

  const resubmit = (id, actor) => {
    const article = get(id);
    if (!article) return null;
    article.status = 'Pending Review';
    article.statusAr = STATUS['Pending Review'];
    article.updatedAt = nowIso();
    article.submittedAt = nowIso();
    markTimeline(article, 'submitted', 'إعادة إرسال بعد التعديل');
    markTimeline(article, 'review', 'بانتظار المراجعة مجدداً');
    if (!article.runId) startRun(article, actor);
    else {
      const run = state.runs.find((r) => r.runId === article.runId);
      if (run) {
        run.status = 'Waiting for Review';
        run.currentStep = 'مراجعة المحتوى';
      }
    }
    pushAudit({
      action: 'Article Resubmitted',
      articleId: article.id,
      runId: article.runId,
      performedBy: actor || actorName(),
    });
    save();
    try {
      window.HubCustomerRequests?.ensureForArticle?.(article, actor || actorName());
    } catch (_) {}
    return article;
  };

  const remove = (id, actor) => {
    const article = get(id);
    if (!article) return false;
    if (article.status !== 'Draft') return false;
    state.articles = state.articles.filter((a) => a.id !== id);
    pushAudit({ action: 'Article Deleted', articleId: id, performedBy: actor || actorName() });
    save();
    return true;
  };

  const mirrorToPublicBlog = (article) => {
    try {
      if (!window.HubSystemOps?.publishPost) return;
      const existing = (window.HubSystemOps.read?.()?.blogPosts || []).find(
        (p) => p.articleId === article.id || p.id === article.id
      );
      if (existing) {
        existing.title = article.title;
        existing.body = article.summary || article.body?.slice(0, 500);
        existing.published = true;
        existing.at = article.publishedAt || nowIso();
        const st = window.HubSystemOps.read();
        window.HubSystemOps.save?.(st);
        return;
      }
      const post = window.HubSystemOps.publishPost({
        title: article.title,
        body: article.summary || String(article.body || '').slice(0, 600),
        systemCode: 'CONTENT',
        attachments: [
          ...(article.articleFile ? [article.articleFile] : []),
          ...(article.attachments || []),
        ],
      });
      if (post) {
        post.articleId = article.id;
        const st = window.HubSystemOps.read();
        const row = (st.blogPosts || []).find((p) => p.id === post.id);
        if (row) row.articleId = article.id;
        window.HubSystemOps.save?.(st);
      }
    } catch (_) {}
  };

  const unpublishFromPublicBlog = (articleId) => {
    try {
      const st = window.HubSystemOps?.read?.();
      if (!st?.blogPosts) return;
      st.blogPosts.forEach((p) => {
        if (p.articleId === articleId || p.id === articleId) p.published = false;
      });
      window.HubSystemOps.save?.(st);
    } catch (_) {}
  };

  const listPublished = (limit = 40) => {
    const fromStore = list({ published: true }).slice(0, limit);
    if (fromStore.length) {
      return fromStore.map((a) => ({
        id: a.id,
        articleId: a.id,
        title: a.title,
        body: a.summary || a.body,
        category: a.category,
        authorName: a.authorName,
        coverImage: a.coverImage,
        attachments: a.attachments || [],
        at: a.publishedAt || a.updatedAt,
        published: true,
        systemCode: 'CONTENT',
      }));
    }
    if (typeof window.HubSystemOps?.listPublishedPosts === 'function') {
      return window.HubSystemOps.listPublishedPosts(limit);
    }
    return [];
  };

  const kpis = () => {
    const all = state.articles;
    return {
      total: all.length,
      draft: all.filter((a) => a.status === 'Draft').length,
      pending: all.filter((a) => a.status === 'Pending Review').length,
      review: all.filter((a) => a.status === 'Under Review').length,
      needs: all.filter((a) => a.status === 'Needs Changes').length,
      approved: all.filter((a) => a.status === 'Approved' || a.status === 'Scheduled').length,
      published: all.filter((a) => a.status === 'Published').length,
      incoming: all.filter((a) =>
        ['Pending Review', 'Under Review', 'Needs Changes', 'Approved', 'Scheduled'].includes(a.status)
      ).length,
    };
  };

  const getRun = (runId) => state.runs.find((r) => r.runId === runId) || null;
  const listRuns = () => state.runs.slice();
  const listAudit = (articleId) =>
    articleId ? state.auditLog.filter((t) => t.articleId === articleId) : state.auditLog.slice();

  const customerPhase = (article) => {
    if (!article) return '';
    const map = {
      Draft: 'مسودة — أكمل البيانات ثم أرسل',
      'Pending Review': 'المرحلة الحالية: بانتظار المراجعة',
      'Under Review': 'المرحلة الحالية: قيد المراجعة',
      'Needs Changes': 'المرحلة الحالية: يحتاج تعديلات منك',
      Approved: 'المرحلة الحالية: تم الاعتماد — بانتظار النشر',
      Scheduled: 'المرحلة الحالية: مجدول للنشر',
      Published: 'المرحلة الحالية: منشور',
      Rejected: 'المرحلة الحالية: مرفوض',
      Archived: 'مؤرشف',
    };
    return map[article.status] || article.statusAr || article.status;
  };

  window.HubArticles = {
    KEY,
    CATEGORIES,
    STATUS,
    CUSTOMER_SAFE,
    createDraft,
    update,
    submit,
    get,
    list,
    listPublished,
    setStatus,
    assignReviewer,
    requestChanges,
    approve,
    reject,
    publishNow,
    unpublish,
    archive,
    schedule,
    resubmit,
    remove,
    kpis,
    getRun,
    listRuns,
    listAudit,
    customerPhase,
    settings: () => state.settings,
    saveSettings: (patch) => {
      state.settings = Object.assign({}, state.settings, patch || {});
      save();
      return state.settings;
    },
    linkCustomerRequests: () => {
      try {
        window.HubCustomerRequests?.syncFromModules?.();
        state.articles.forEach((a) => {
          if (a.status === 'Draft') return;
          const req = window.HubCustomerRequests?.ensureForArticle?.(a, a.authorName || 'عميل');
          if (req?.id && a.requestId !== req.id) {
            a.requestId = req.id;
          }
        });
        save();
      } catch (_) {}
    },
  };

  try {
    if (window.HubCustomerRequests) window.HubArticles.linkCustomerRequests();
  } catch (_) {}
})();
