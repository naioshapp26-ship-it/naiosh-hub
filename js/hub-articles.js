/**
 * NAIOSH HUB — Articles client.
 * Source of truth: /api/hub/articles (file/DB). localStorage is a cache only.
 */
(() => {
  'use strict';

  const KEY = 'naiosh_articles_v1';
  const CATEGORIES = ['إدارة', 'تشغيل', 'تقنية', 'مالية', 'حوكمة', 'موارد بشرية', 'تسويق', 'ريادة أعمال', 'أخرى'];
  const STATUS = {
    Draft: 'مسودة',
    'Pending Review': 'بانتظار المراجعة',
    'Under Review': 'تحت المراجعة',
    'Needs Changes': 'يحتاج تعديل',
    Approved: 'تمت الموافقة',
    Scheduled: 'مجدول للنشر',
    Published: 'منشور',
    Unpublished: 'موقوف',
    Rejected: 'مرفوض',
    Archived: 'مؤرشف',
  };
  const TO_LEGACY = {
    draft: 'Draft',
    pending_review: 'Pending Review',
    under_review: 'Under Review',
    needs_changes: 'Needs Changes',
    approved: 'Approved',
    published: 'Published',
    unpublished: 'Unpublished',
    rejected: 'Rejected',
    archived: 'Archived',
  };
  const FROM_LEGACY = Object.fromEntries(Object.entries(TO_LEGACY).map(([k, v]) => [v, k]));

  const nowIso = () => new Date().toISOString();

  const blankState = () => ({
    schemaVersion: 2,
    articles: [],
    runs: [],
    auditLog: [],
    settings: {
      maxArticleMb: 1500,
      maxCoverMb: 1500,
      maxVideoMb: 1500,
      articleExts: ['.docx', '.pdf', '.txt'],
      coverExts: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
      videoExts: ['.mp4', '.webm', '.mov', '.m4v'],
      defaultReviewer: 'Content Desk',
      workflowId: 'WF-ARTICLE-01',
      workflowName: 'مراجعة ونشر المقالات',
    },
  });

  let state = blankState();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.articles)) state.articles = parsed.articles;
    }
  } catch (_) {}

  const headers = (extra) => (window.HubAuth && HubAuth.authHeaders && HubAuth.authHeaders(extra || {})) || extra || {};

  async function api(path, opts) {
    opts = opts || {};
    const h = headers(opts.headers || {});
    if (opts.body && !opts.raw) h['Content-Type'] = 'application/json';
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: h,
      body: opts.body && h['Content-Type'] === 'application/json' ? JSON.stringify(opts.body) : opts.body,
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {}
    if (!res.ok) throw new Error(data.error || 'تعذر تنفيذ العملية');
    return data;
  }

  function toClient(a) {
    if (!a) return null;
    const status = TO_LEGACY[a.status] || a.status;
    return {
      ...a,
      articleId: a.id,
      status,
      statusAr: a.statusLabel || STATUS[status] || status,
      authorEmail: a.authorEmail || a.ownerEmail || '',
      createdBy: a.ownerName || a.authorName || '',
    };
  }

  function upsert(article) {
    const row = toClient(article);
    const i = state.articles.findIndex((x) => x.id === row.id);
    if (i >= 0) state.articles[i] = Object.assign({}, state.articles[i], row);
    else state.articles.unshift(row);
    persistCache();
    return state.articles[i >= 0 ? i : 0];
  }

  function persistCache() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 2, articles: state.articles, settings: state.settings }));
      window.dispatchEvent(new CustomEvent('hub-articles-changed', { detail: { count: state.articles.length } }));
    } catch (_) {}
  }

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
      rows = rows.filter((a) => String(a.authorEmail || a.ownerEmail || '').toLowerCase() === em);
    }
    if (filter.mine) {
      const u = currentUser();
      const em = String(u?.email || filter.email || '').toLowerCase();
      rows = rows.filter((a) => (em && String(a.authorEmail || a.ownerEmail || '').toLowerCase() === em) || a.createdBySession === filter.sessionId);
    }
    if (filter.q) {
      const q = String(filter.q).toLowerCase();
      rows = rows.filter((a) => `${a.id} ${a.title} ${a.authorName} ${a.category}`.toLowerCase().includes(q));
    }
    if (filter.incoming) {
      rows = rows.filter((a) => ['Pending Review', 'Under Review', 'Needs Changes', 'Approved', 'Scheduled'].includes(a.status));
    }
    if (filter.published) rows = rows.filter((a) => a.status === 'Published');
    return rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  };

  async function refreshFromApi(qs) {
    try {
      const pub = await fetch('/api/hub/articles/public').then((r) => r.json());
      (pub.items || []).forEach((a) => upsert(a));
    } catch (_) {}
    try {
      if (!window.HubAuth?.isLoggedIn?.()) return state;
      const data = await api('/api/hub/articles?full=1' + (qs || ''));
      (data.items || []).forEach((a) => upsert(a));
    } catch (_) {}
    return state;
  }

  async function loadOne(id) {
    const data = await api('/api/hub/articles/' + encodeURIComponent(id));
    return upsert(data.article);
  }

  async function createDraft(fields = {}, actor) {
    const u = currentUser();
    const body = {
      title: fields.title || '',
      category: fields.category || '',
      summary: fields.summary || '',
      authorName: fields.authorName || u?.name || u?.fullName || actorName(actor),
      authorEmail: fields.authorEmail || u?.email || '',
      company: fields.company || '',
      body: fields.body || '',
      tags: fields.tags || [],
    };
    const data = await api('/api/hub/articles', {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': fields.idempotencyKey || `art-new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    });
    return upsert(data.article);
  }

  async function update(id, patch = {}) {
    const data = await api('/api/hub/articles/' + encodeURIComponent(id), { method: 'PUT', body: patch });
    return upsert(data.article);
  }

  async function doAction(id, action, extra) {
    extra = extra || {};
    const data = await api('/api/hub/articles/' + encodeURIComponent(id) + '/action', {
      method: 'POST',
      body: { action, note: extra.note || extra.reason || '', reason: extra.note || extra.reason || '' },
      headers: {
        'Idempotency-Key': extra.idempotencyKey || `art-act-${action}-${id}`,
      },
    });
    const row = upsert(data.article);
    try {
      if (row.status !== 'Draft' && window.HubCustomerRequests?.ensureForArticle) {
        const req = window.HubCustomerRequests.ensureForArticle(row, actorName());
        if (req?.id && row.requestId !== req.id) {
          row.requestId = row.requestId || req.id;
          persistCache();
        }
      }
    } catch (_) {}
    return { ok: true, article: row, request: data.request, requestId: row.requestId };
  }

  async function submit(id, actor, extra) {
    return doAction(id, 'submit', extra);
  }

  const setStatus = (id, status, actor, note, opts) => {
    const action =
      status === 'Published' || status === 'Approved'
        ? 'publish'
        : status === 'Needs Changes'
          ? 'request_changes'
          : status === 'Rejected'
            ? 'reject'
            : status === 'Under Review'
              ? 'start_review'
              : status === 'Unpublished'
                ? 'unpublish'
                : '';
    const article = get(id);
    if (article && STATUS[status]) {
      article.status = status;
      article.statusAr = STATUS[status];
      if (note) {
        article.reviewNotes = note;
        if (status === 'Needs Changes') article.changeRequestNote = note;
        if (status === 'Rejected') article.rejectionReason = note;
      }
      persistCache();
    }
    if (action && !opts?.skipApi) {
      doAction(id, action, { note }).catch(() => {});
    } else if (!opts?.skipRequestSync) {
      try {
        window.HubCustomerRequests?.ensureForArticle?.(article, actor || actorName());
      } catch (_) {}
    }
    return article;
  };

  const approve = (id, actor) => setStatus(id, 'Approved', actor);
  const publishNow = (id, actor, opts) => {
    const a = setStatus(id, 'Published', actor, '', opts);
    return a;
  };
  const reject = (id, actor, note) => setStatus(id, 'Rejected', actor, note);
  const requestChanges = (id, note, actor) => setStatus(id, 'Needs Changes', actor, note);
  const resubmit = (id) => doAction(id, 'submit');
  const unpublish = (id, actor) => setStatus(id, 'Unpublished', actor);
  const archive = (id, actor) => setStatus(id, 'Archived', actor);
  const assignReviewer = (id, reviewer) => update(id, { reviewer }).catch(() => get(id));
  const schedule = (id) => get(id);
  const remove = () => null;

  const listPublished = (limit = 40) =>
    list({ published: true })
      .slice(0, limit)
      .map((a) => ({
        id: a.id,
        articleId: a.id,
        title: a.title,
        body: a.summary || a.body,
        category: a.category,
        authorName: a.authorName,
        coverImage: a.coverImage,
        video: a.video,
        publishedAt: a.publishedAt,
        published: true,
      }));

  const kpis = () => {
    const all = state.articles;
    return {
      total: all.length,
      pending: all.filter((a) => a.status === 'Pending Review' || a.status === 'Under Review').length,
      published: all.filter((a) => a.status === 'Published').length,
    };
  };

  const customerPhase = (article) => {
    if (!article) return '';
    const map = {
      Draft: 'مسودة — أكمل البيانات ثم أرسل',
      'Pending Review': 'المرحلة الحالية: بانتظار المراجعة',
      'Under Review': 'المرحلة الحالية: تحت المراجعة',
      'Needs Changes': 'المرحلة الحالية: يحتاج تعديل منك',
      Approved: 'المرحلة الحالية: تمت الموافقة — بانتظار النشر',
      Published: 'المرحلة الحالية: منشور',
      Rejected: 'المرحلة الحالية: مرفوض',
    };
    return map[article.status] || article.statusAr || article.status;
  };

  window.HubArticles = {
    KEY,
    CATEGORIES,
    STATUS,
    FROM_LEGACY,
    api,
    refreshFromApi,
    loadOne,
    createDraft,
    update,
    submit,
    doAction,
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
    getRun: () => null,
    listRuns: () => [],
    listAudit: () => [],
    customerPhase,
    settings: () => state.settings,
    saveSettings: (patch) => {
      state.settings = Object.assign({}, state.settings, patch || {});
      persistCache();
      return state.settings;
    },
    linkCustomerRequests: () => {
      try {
        state.articles.forEach((a) => {
          if (a.status === 'Draft') return;
          window.HubCustomerRequests?.ensureForArticle?.(a, a.authorName || 'عميل', { silent: true });
        });
      } catch (_) {}
    },
  };

  refreshFromApi().then(() => {
    try {
      window.HubArticles.linkCustomerRequests();
    } catch (_) {}
  });
})();
