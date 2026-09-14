/**
 * NAIOSH HUB — Central Customer Requests Inbox
 * One record shared by Customer View (e.g. حلول نايوش → طلباتي)
 * and Admin View (عملاء بوشا → طلبات العملاء).
 */
(() => {
  'use strict';

  const KEY = 'naiosh_customer_requests_v1';
  const nowIso = () => new Date().toISOString();

  const nextSeq = (list, prefix) => {
    const year = new Date().getFullYear();
    const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
    let max = 0;
    (list || []).forEach((row) => {
      const m = String(row.id || row.requestId || '').match(re);
      if (m) max = Math.max(max, Number(m[1]));
    });
    return `${prefix}-${year}-${String(max + 1).padStart(5, '0')}`;
  };

  const DEFAULT_ROUTING = {
    'Solution Request': { department: 'Sales', assignedTo: 'Sales Desk' },
    'Consultation Request': { department: 'Consulting', assignedTo: 'Consulting Team' },
    'Quote Request': { department: 'Sales', assignedTo: 'Sales Desk' },
    'Quotation Request': { department: 'Sales', assignedTo: 'Sales Desk' },
    'Support Request': { department: 'Support', assignedTo: 'Support Team' },
    'Project Registration': { department: 'Projects', assignedTo: 'Projects Team' },
    'Cost Reduction Assessment': { department: 'Financial Consulting', assignedTo: 'Financial Consulting Team' },
    'Cost Reduction Request': { department: 'Financial Consulting', assignedTo: 'Financial Consulting Team' },
    'Product Request': { department: 'Sales', assignedTo: 'Sales Desk' },
    'Service Request': { department: 'Sales', assignedTo: 'Sales Desk' },
    'System Request': { department: 'Systems', assignedTo: 'Systems Team' },
    'Integration Request': { department: 'Systems', assignedTo: 'Systems Team' },
    'Contract Request': { department: 'Sales', assignedTo: 'Sales Desk' },
    'Training Request': { department: 'Consulting', assignedTo: 'Consulting Team' },
    'Event Request': { department: 'Sales', assignedTo: 'Sales Desk' },
    'Article Submission': { department: 'Content', assignedTo: 'Content Desk' },
    'Ad Submission': { department: 'Marketing', assignedTo: 'Ads Desk' },
    مقال: { department: 'Content', assignedTo: 'Content Desk' },
    'General Request': { department: 'Operations', assignedTo: 'Ops Desk' },
  };

  const TYPE_LABELS_AR = {
    'Article Submission': 'مقال',
    'Ad Submission': 'طلب نشر إعلان',
    'Solution Request': 'طلب حل',
    'Cost Reduction Assessment': 'خفض تكاليف',
    'Cost Reduction Request': 'خفض تكاليف',
    'Support Request': 'دعم',
    'Project Registration': 'تسجيل مشروع',
    'Consultation Request': 'استشارة',
    'General Request': 'طلب عام',
  };

  const STATUS_AR = {
    New: 'جديد',
    Viewed: 'تمت المشاهدة',
    Assigned: 'تم التعيين',
    'Pending Review': 'بانتظار المراجعة',
    'Under Review': 'قيد المراجعة',
    'Needs Changes': 'يحتاج تعديلات',
    'Waiting For Customer': 'بانتظار العميل',
    'Pending Approval': 'بانتظار الموافقة',
    'Proposal Sent': 'عرض مرسل',
    'In Progress': 'قيد التنفيذ',
    Approved: 'مقبول',
    Published: 'نشط',
    Unpublished: 'متوقف',
    Scheduled: 'مجدول',
    Active: 'نشط',
    Ended: 'منتهي',
    Completed: 'مكتمل',
    Rejected: 'مرفوض',
    Cancelled: 'ملغي',
    Archived: 'مؤرشف',
    Draft: 'مسودة',
  };

  const blank = () => ({
    schemaVersion: 1,
    requests: [],
    auditLog: [],
    settings: {
      routing: { ...DEFAULT_ROUTING },
      slaHours: { default: 4, high: 1, urgent: 1 },
      helpDismissed: false,
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
      if (!Array.isArray(parsed.requests)) parsed.requests = [];
      if (!Array.isArray(parsed.auditLog)) parsed.auditLog = [];
      parsed.settings = Object.assign(blank().settings, parsed.settings || {});
      parsed.settings.routing = Object.assign({}, DEFAULT_ROUTING, parsed.settings.routing || {});
      return parsed;
    } catch {
      return blank();
    }
  };

  let state = load();

  const save = () => {
    localStorage.setItem(KEY, JSON.stringify(state));
    try {
      window.dispatchEvent(new CustomEvent('hub-customer-requests-changed', { detail: { count: state.requests.length } }));
    } catch (_) {}
    return state;
  };

  const pushAudit = (entry = {}) => {
    const row = {
      id: nextSeq(state.auditLog, 'TX'),
      at: nowIso(),
      action: entry.action || 'update',
      requestId: entry.requestId || '',
      customer: entry.customer || '',
      sourceModule: entry.sourceModule || '',
      performedBy: entry.performedBy || 'نظام',
      oldStatus: entry.oldStatus || '',
      newStatus: entry.newStatus || '',
      oldValue: entry.oldValue || '',
      newValue: entry.newValue || '',
      detail: entry.detail || '',
    };
    state.auditLog.unshift(row);
    state.auditLog = state.auditLog.slice(0, 400);
    save();
    return row;
  };

  const routeFor = (requestType) => {
    const map = state.settings?.routing || DEFAULT_ROUTING;
    return map[requestType] || map['General Request'] || { department: 'Operations', assignedTo: 'Ops Desk' };
  };

  const slaHoursFor = (priority) => {
    const s = state.settings?.slaHours || {};
    const p = String(priority || '');
    if (p.includes('عاجل') || p.toLowerCase() === 'urgent') return s.urgent || 1;
    if (p.includes('مرتفع') || p.toLowerCase() === 'high') return s.high || 1;
    return s.default || 4;
  };

  const slaStatus = (req) => {
    if (['Completed', 'Cancelled', 'Rejected'].includes(req.status)) return 'Closed';
    const hours = slaHoursFor(req.priority);
    const start = new Date(req.createdAt || Date.now()).getTime();
    const elapsed = (Date.now() - start) / 3600000;
    if (elapsed > hours) return 'Overdue';
    if (elapsed > hours * 0.75) return 'Near SLA';
    return 'Within SLA';
  };

  const normalizeFromSolutions = (r) => {
    const type = r.requestType || 'Solution Request';
    const route = routeFor(type);
    return {
      id: r.id || r.requestId,
      requestId: r.requestId || r.id,
      customerId: r.customerId || '',
      customerName: r.customer?.name || r.customerName || '',
      company: r.customer?.company || r.company || '',
      phone: r.customer?.phone || r.phone || '',
      email: r.customer?.email || r.email || '',
      branch: r.customer?.branch || r.branch || '',
      requestType: type,
      title: r.title || r.solutionName || r.need || 'طلب',
      description: r.description || r.need || '',
      need: r.need || '',
      sourceModule: r.sourceModule || 'حلول نايوش',
      sourcePage: r.sourcePage || (r.requestType === 'Cost Reduction Assessment' ? 'برنامج خفض التكاليف' : 'كتالوج الحلول'),
      sourceUrl: r.sourceUrl || (r.requestType === 'Cost Reduction Assessment' ? 'cost-reduction.html' : 'naiosh-solutions.html'),
      sourceAction: r.sourceAction || 'إرسال طلب',
      relatedSolution: r.relatedSolution || r.solutionName || '',
      relatedProduct: r.relatedProduct || '',
      relatedService: r.relatedService || '',
      relatedProject: r.relatedProject || '',
      relatedSystem: r.relatedSystem || '',
      referenceType: r.referenceType || '',
      referenceId: r.referenceId || '',
      requestTypeLabel: r.requestTypeLabel || TYPE_LABELS_AR[type] || type,
      solutionId: r.solutionId || '',
      solutionName: r.solutionName || '',
      priority: r.priority || 'عادي',
      status: r.status === 'Draft' ? 'Draft' : r.status || 'New',
      assignedTo: r.assignedTo || route.assignedTo,
      department: r.department || route.department,
      salesOwner: r.salesOwner || route.assignedTo,
      consultant: r.consultant || '',
      approver: r.approver || '',
      approvedBy: r.approvedBy || '',
      approvedAt: r.approvedAt || '',
      publishedAt: r.publishedAt || '',
      createdBy: r.createdBy || r.requestedBy || 'عميل',
      requestedBy: r.requestedBy || r.createdBy || 'عميل',
      createdAt: r.createdAt || nowIso(),
      updatedAt: r.updatedAt || r.createdAt || nowIso(),
      channel: r.channel || 'Web',
      attachments: r.attachments || [],
      timeline: r.timeline || [],
      messages: r.messages || [],
      internalNotes: r.internalNotes || [],
      tasks: r.tasks || [],
      scopeType: r.scopeType || '',
      scopeDetail: r.scopeDetail || '',
      costMeta: r.costMeta || null,
      articleSnapshot: r.articleSnapshot || null,
      customer: r.customer || {
        name: r.customer?.name || r.customerName || '',
        company: r.customer?.company || r.company || '',
        phone: r.customer?.phone || r.phone || '',
        email: r.customer?.email || r.email || '',
        branch: r.customer?.branch || r.branch || '',
      },
      viewedAt: r.viewedAt || null,
      slaHours: r.slaHours || slaHoursFor(r.priority),
    };
  };

  const ingest = (raw, { silent } = {}) => {
    const item = normalizeFromSolutions(raw);
    if (!item.id) return null;
    const existing = state.requests.find((x) => x.id === item.id || x.requestId === item.requestId);
    if (existing) {
      // merge updates from same record (keep single id)
      Object.assign(existing, item, {
        timeline: item.timeline?.length ? item.timeline : existing.timeline,
        messages: item.messages?.length ? item.messages : existing.messages,
        attachments: item.attachments?.length ? item.attachments : existing.attachments,
        internalNotes: item.internalNotes?.length ? item.internalNotes : existing.internalNotes,
      });
      if (!silent) save();
      return existing;
    }
    state.requests.unshift(item);
    if (!silent) {
      pushAudit({
        action: 'Request Created',
        requestId: item.id,
        customer: item.company || item.customerName,
        sourceModule: item.sourceModule,
        performedBy: item.createdBy,
        newStatus: item.status,
        detail: item.title,
      });
      try {
        const bag = JSON.parse(localStorage.getItem('naiosh_hub_notifications_v1') || '{"items":[]}');
        if (!Array.isArray(bag.items)) bag.items = [];
        bag.items.unshift({
          id: `n-${Date.now()}`,
          title: `طلب جديد من ${item.company || item.customerName || 'عميل'}`,
          message: `${item.requestType}: ${item.title}`,
          at: nowIso(),
          read: false,
          source: item.sourceModule,
          link: `dashboard.html#posha-clients`,
        });
        bag.items = bag.items.slice(0, 100);
        localStorage.setItem('naiosh_hub_notifications_v1', JSON.stringify(bag));
      } catch (_) {}
    }
    save();
    return item;
  };

  /** Import legacy solutions + side-project registrations into the central inbox (same IDs). */
  const syncFromModules = () => {
    let changed = false;

    // Solutions workspace
    try {
      const sol = JSON.parse(localStorage.getItem('naiosh_solutions_workspace_v1') || 'null');
      (sol?.requests || []).forEach((r) => {
        const before = state.requests.length;
        const id = r.id || r.requestId;
        const had = state.requests.some((x) => x.id === id);
        ingest(
          {
            ...r,
            sourceModule: r.sourceModule || 'حلول نايوش',
            sourcePage: r.sourcePage || (String(r.requestType || '').includes('Cost') ? 'برنامج خفض التكاليف' : 'كتالوج الحلول'),
            sourceUrl: r.sourceUrl || (String(r.requestType || '').includes('Cost') ? 'cost-reduction.html' : 'naiosh-solutions.html'),
            sourceAction: r.sourceAction || 'إرسال طلب',
            title: r.solutionName || r.need || r.title,
            relatedSolution: r.solutionName,
          },
          { silent: true }
        );
        if (!had || state.requests.length !== before) changed = true;
      });
    } catch (_) {}

    // Side project registrations
    try {
      const regs = JSON.parse(localStorage.getItem('naiosh_side_project_registrations_v1') || '[]');
      (Array.isArray(regs) ? regs : []).forEach((r) => {
        const id = r.id || r.requestId || `SP-REG-${r.at || Date.now()}`;
        if (state.requests.some((x) => x.id === id || x.requestId === id)) return;
        ingest(
          {
            id,
            requestId: id,
            requestType: 'Project Registration',
            title: r.projectName || r.title || 'تسجيل مشروع جانبي',
            description: r.notes || r.description || '',
            need: r.notes || '',
            customer: {
              name: r.name || r.contactName || '',
              company: r.company || '',
              phone: r.phone || '',
              email: r.email || '',
              branch: r.branch || '',
            },
            status: r.status || 'New',
            priority: 'عادي',
            sourceModule: 'طلبات تسجيل المشاريع',
            sourcePage: 'side-projects / registrations',
            sourceUrl: 'side-project-registrations.html',
            sourceAction: 'تسجيل مشروع',
            relatedProject: r.projectName || '',
            channel: 'Web',
            createdAt: r.at || r.createdAt || nowIso(),
            updatedAt: r.updatedAt || r.at || nowIso(),
            createdBy: r.name || r.email || 'عميل',
            timeline: [{ at: r.at || nowIso(), by: r.name || 'عميل', text: 'تم إنشاء طلب التسجيل', key: 'created' }],
          },
          { silent: true }
        );
        changed = true;
      });
    } catch (_) {}

    // Articles submissions → central REQ linked by referenceId (no duplicate / no save churn)
    try {
      const artStore = JSON.parse(localStorage.getItem('naiosh_articles_v1') || 'null');
      let artStoreDirty = false;
      (artStore?.articles || []).forEach((a) => {
        if (!a?.id || a.status === 'Draft') return;
        const had = !!findByReference('Article', a.id) || !!(a.requestId && get(a.requestId));
        const row = ensureForArticle(a, a.authorName || a.createdBy || 'عميل', { silent: true });
        if (!row) return;
        if (!had) changed = true;
        if (a.requestId !== row.id) {
          a.requestId = row.id;
          artStoreDirty = true;
          changed = true;
        }
      });
      if (artStoreDirty) {
        try {
          localStorage.setItem('naiosh_articles_v1', JSON.stringify(artStore));
        } catch (_) {}
      }
    } catch (_) {}

    if (changed) save();
    return state.requests.length;
  };

  const create = (payload = {}, actor = 'عميل') => {
    const type = payload.requestType || 'General Request';
    const route = routeFor(type);
    let prefix = 'REQ';
    if (type === 'Cost Reduction Assessment' || type === 'Cost Reduction Request') prefix = 'COST';
    else if (String(type).includes('Solution') || type === 'Quote Request' || type === 'Consultation Request') prefix = 'SOL-REQ';
    else if (type === 'Project Registration') prefix = 'SP-REG';
    else if (type === 'Support Request') prefix = 'SUP';
    else if (type === 'Article Submission' || type === 'مقال') prefix = 'REQ';

    const id = payload.id || payload.requestId || nextSeq(state.requests, prefix);
    const stamp = nowIso();
    const item = normalizeFromSolutions({
      ...payload,
      id,
      requestId: id,
      requestType: type === 'مقال' ? 'Article Submission' : type,
      requestTypeLabel: payload.requestTypeLabel || TYPE_LABELS_AR[type] || TYPE_LABELS_AR[type === 'مقال' ? 'Article Submission' : type] || type,
      title: payload.title || payload.solutionName || payload.need || 'طلب عميل',
      description: payload.description || payload.need || '',
      need: payload.need || payload.description || '',
      sourceModule: payload.sourceModule || 'منصة نايوش',
      sourcePage: payload.sourcePage || '',
      sourceUrl: payload.sourceUrl || '',
      sourceAction: payload.sourceAction || 'Submit Request',
      relatedSolution: payload.relatedSolution || payload.solutionName || '',
      referenceType: payload.referenceType || '',
      referenceId: payload.referenceId || '',
      articleSnapshot: payload.articleSnapshot || null,
      status: payload.status || 'New',
      assignedTo: payload.assignedTo || route.assignedTo,
      department: payload.department || route.department,
      salesOwner: payload.salesOwner || route.assignedTo,
      createdBy: actor,
      requestedBy: actor,
      createdAt: payload.createdAt || stamp,
      updatedAt: payload.updatedAt || stamp,
      channel: payload.channel || 'Web',
      timeline: payload.timeline || [
        { at: stamp, by: actor, text: 'تم إنشاء الطلب', key: 'created' },
        { at: stamp, by: 'النظام', text: `تم التوجيه إلى ${route.department} · ${route.assignedTo}`, key: 'routed' },
      ],
      customer: payload.customer || {
        name: payload.customerName || '',
        company: payload.company || '',
        phone: payload.phone || '',
        email: payload.email || '',
        branch: payload.branch || '',
      },
    });

    // duplicate open check helper returned to caller
    const similar = findSimilarOpen(item);
    state.requests.unshift(item);
    pushAudit({
      action: 'Request Created',
      requestId: item.id,
      customer: item.company || item.customerName,
      sourceModule: item.sourceModule,
      performedBy: actor,
      newStatus: item.status,
      detail: `${item.requestType}: ${item.title}`,
    });
    save();
    item._similar = similar;
    return item;
  };

  const findSimilarOpen = (item) => {
    const open = ['New', 'Viewed', 'Assigned', 'Under Review', 'Waiting For Customer', 'Pending Approval', 'Proposal Sent', 'In Progress'];
    return (state.requests || []).find(
      (r) =>
        r.id !== item.id &&
        open.includes(r.status) &&
        (r.email || '').toLowerCase() === (item.email || item.customer?.email || '').toLowerCase() &&
        r.requestType === item.requestType &&
        (r.relatedSolution || r.title) === (item.relatedSolution || item.title)
    );
  };

  const get = (id) => (state.requests || []).find((r) => r.id === id || r.requestId === id);

  const findByReference = (referenceType, referenceId) =>
    (state.requests || []).find(
      (r) =>
        String(r.referenceType || '') === String(referenceType || '') &&
        String(r.referenceId || '') === String(referenceId || '')
    );

  const mapArticleStatus = (st) => {
    const m = {
      'Pending Review': 'Pending Review',
      'Under Review': 'Under Review',
      'Needs Changes': 'Needs Changes',
      Approved: 'Approved',
      Scheduled: 'Approved',
      Published: 'Published',
      Unpublished: 'Unpublished',
      Rejected: 'Rejected',
      Archived: 'Archived',
      Draft: 'Draft',
    };
    return m[st] || st || 'Pending Review';
  };

  const STATUS_RANK = {
    Draft: 0,
    New: 1,
    Viewed: 2,
    Assigned: 3,
    'Pending Review': 4,
    'Under Review': 5,
    'Needs Changes': 4,
    'Waiting For Customer': 4,
    'Pending Approval': 5,
    'In Progress': 6,
    Approved: 7,
    Scheduled: 7,
    Published: 8,
    Unpublished: 7,
    Completed: 8,
    Rejected: 9,
    Cancelled: 9,
    Archived: 10,
  };

  const ensureForAd = (ad, actor = 'عميل', { silent } = {}) => {
    if (!ad?.id) return null;
    if (ad.workflowStatus === 'draft' && !ad.requestId) return null;
    let row = findByReference('Ad', ad.id) || (ad.requestId ? get(ad.requestId) : null);
    const status =
      ad.workflowStatus === 'active' || ad.workflowStatus === 'approved' || ad.workflowStatus === 'scheduled'
        ? 'Approved'
        : ad.workflowStatus === 'rejected'
          ? 'Rejected'
          : ad.workflowStatus === 'paused'
            ? 'Unpublished'
            : 'Pending Review';
    const snapshot = {
      adId: ad.id,
      adCode: ad.adCode,
      title: ad.title,
      contentType: ad.contentType,
      placements: ad.placements,
      destinationUrl: ad.destinationUrl,
      ctaLabel: ad.ctaLabel,
      mediaDataUrl: ad.mediaDataUrl ? '[media]' : '',
      adStartDate: ad.adStartDate,
      adEndDate: ad.adEndDate,
      rejectionReason: ad.rejectionReason || '',
    };
    if (row) {
      const prevStatus = row.status;
      const nextStatus =
        silent && (STATUS_RANK[row.status] || 0) > (STATUS_RANK[status] || 0) ? row.status : status;
      Object.assign(row, {
        title: `طلب نشر إعلان: ${ad.title || ad.adCode || ad.id}`,
        description: ad.desc || ad.headline || '',
        status: nextStatus,
        requestType: 'Ad Submission',
        requestTypeLabel: 'طلب نشر إعلان',
        referenceType: 'Ad',
        referenceId: ad.id,
        sourceModule: 'إدارة الإعلانات',
        sourcePage: 'الإعلانات',
        sourceUrl: 'ads.html',
        sourceAction: 'نشر إعلان',
        department: row.department || 'Marketing',
        assignedTo: row.assignedTo || 'Ads Desk',
        adSnapshot: snapshot,
        updatedAt: nowIso(),
        customerName: ad.createdBy || row.customerName || actor,
        adPublishStatus: ad.workflowStatus || row.adPublishStatus || '',
      });
      if (status === 'Pending Review' && !silent && (prevStatus === 'Rejected' || prevStatus === 'Needs Changes')) {
        row.rejectionReason = '';
        row.rejectedBy = '';
        row.rejectedAt = '';
        row.timeline = row.timeline || [];
        row.timeline.push({ at: nowIso(), by: actor, text: 'إعادة إرسال للمراجعة', key: 'resubmitted' });
      }
      if (!silent) save();
      return row;
    }
    return create(
      {
        requestType: 'Ad Submission',
        requestTypeLabel: 'طلب نشر إعلان',
        title: `طلب نشر إعلان: ${ad.title || ad.adCode || ad.id}`,
        description: ad.desc || ad.headline || '',
        status: 'Pending Review',
        priority: 'متوسطة',
        sourceModule: 'إدارة الإعلانات',
        sourcePage: 'الإعلانات',
        sourceUrl: 'ads.html',
        sourceAction: 'نشر إعلان',
        referenceType: 'Ad',
        referenceId: ad.id,
        customerName: ad.createdBy || actor,
        assignedTo: 'Ads Desk',
        department: 'Marketing',
        channel: 'Web',
        adSnapshot: snapshot,
        createdAt: ad.createdAt || nowIso(),
        updatedAt: nowIso(),
      },
      actor
    );
  };

  const ensureForArticle = (article, actor = 'عميل', { silent } = {}) => {
    if (!article?.id) return null;
    if (article.status === 'Draft') return null;
    let row = findByReference('Article', article.id) || (article.requestId ? get(article.requestId) : null);
    let status = mapArticleStatus(article.status);
    /* Never downgrade an admin-advanced request during silent sync/backfill */
    if (row && silent) {
      const cur = STATUS_RANK[row.status] || 0;
      const next = STATUS_RANK[status] || 0;
      if (cur > next) status = row.status;
    }
    const snapshot = {
      articleId: article.id,
      title: article.title,
      category: article.category,
      summary: article.summary,
      authorName: article.authorName,
      body: article.body,
      coverImage: article.coverImage,
      articleFile: article.articleFile,
      attachments: article.attachments,
      submittedAt: article.submittedAt,
    };
    if (row) {
      Object.assign(row, {
        title: `مراجعة ونشر مقال: ${article.title || article.id}`,
        description: article.summary || String(article.body || '').slice(0, 280) || '',
        customerName: article.authorName || row.customerName,
        company: article.company || row.company,
        email: article.authorEmail || row.email,
        customerId: article.customerId || row.customerId,
        status,
        assignedTo: article.reviewer || row.assignedTo || 'Content Desk',
        department: row.department || 'Content',
        referenceType: 'Article',
        referenceId: article.id,
        requestType: 'Article Submission',
        requestTypeLabel: 'مقال',
        articleSnapshot: snapshot,
        updatedAt: article.updatedAt || nowIso(),
        publishedAt: article.publishedAt || row.publishedAt || '',
        customer: {
          name: article.authorName || row.customer?.name || '',
          company: article.company || row.customer?.company || '',
          email: article.authorEmail || row.customer?.email || '',
          phone: row.customer?.phone || '',
          branch: row.customer?.branch || '',
        },
      });
      if (!silent) save();
      return row;
    }
    return create(
      {
        requestType: 'Article Submission',
        requestTypeLabel: 'مقال',
        title: `مراجعة ونشر مقال: ${article.title || article.id}`,
        description: article.summary || String(article.body || '').slice(0, 280),
        need: article.summary || '',
        status,
        priority: 'متوسطة',
        sourceModule: 'المقالات',
        sourcePage: 'مقالات نايوش',
        sourceUrl: 'blog.html',
        sourceAction: 'رفع مقال',
        referenceType: 'Article',
        referenceId: article.id,
        customerId: article.customerId || '',
        customerName: article.authorName || '',
        company: article.company || '',
        email: article.authorEmail || '',
        assignedTo: article.reviewer || 'Content Desk',
        department: 'Content',
        channel: 'Web',
        articleSnapshot: snapshot,
        createdAt: article.submittedAt || article.createdAt || nowIso(),
        updatedAt: article.updatedAt || nowIso(),
        publishedAt: article.publishedAt || '',
        customer: {
          name: article.authorName || '',
          company: article.company || '',
          email: article.authorEmail || '',
          phone: '',
          branch: '',
        },
        timeline: [
          {
            at: article.submittedAt || nowIso(),
            by: actor,
            text: `تم ربط الطلب بالمقال ${article.id}`,
            key: 'linked',
          },
        ],
      },
      actor
    );
  };

  const mirrorToArticle = (row, actor = 'مشغّل') => {
    if (row?.referenceType !== 'Article' || !row.referenceId) return;
    if (row._syncingArticle) return;
    try {
      if (!window.HubArticles?.setStatus) return;
      const art = window.HubArticles.get(row.referenceId);
      if (!art) return;
      const target = (() => {
        const m = {
          'Pending Review': 'Pending Review',
          'Under Review': 'Under Review',
          'Needs Changes': 'Needs Changes',
          Approved: 'Approved',
          Published: 'Published',
          Unpublished: 'Unpublished',
          Rejected: 'Rejected',
          Archived: 'Archived',
          Completed: 'Published',
        };
        return m[row.status];
      })();
      if (!target || art.status === target) return;
      row._syncingArticle = true;
      window.HubArticles.setStatus(row.referenceId, target, actor, '', { skipRequestSync: true });
    } catch (_) {
    } finally {
      if (row) row._syncingArticle = false;
    }
  };

  const pushCustomerNotification = ({ title, message, link, source }) => {
    try {
      const bag = JSON.parse(localStorage.getItem('naiosh_hub_notifications_v1') || '{"items":[]}');
      if (!Array.isArray(bag.items)) bag.items = [];
      bag.items.unshift({
        id: `n-${Date.now()}`,
        title: title || 'إشعار',
        message: message || '',
        at: nowIso(),
        read: false,
        source: source || 'طلبات العملاء',
        link: link || '',
      });
      bag.items = bag.items.slice(0, 100);
      localStorage.setItem('naiosh_hub_notifications_v1', JSON.stringify(bag));
      window.dispatchEvent(new CustomEvent('hub-notifications-changed'));
    } catch (_) {}
  };

  const isPendingReview = (row) =>
    row && ['New', 'Pending Review', 'Under Review', 'Needs Changes'].includes(row.status);

  const approveAndPublish = (requestId, actor = 'مشغّل') => {
    const row = get(requestId);
    if (!row || row.referenceType !== 'Article') return null;
    const stamp = nowIso();
    row.approvedBy = actor;
    row.approvedAt = stamp;
    row.publishedAt = stamp;
    row.status = 'Published';
    row.updatedAt = stamp;
    row.timeline = row.timeline || [];
    row.timeline.push({ at: stamp, by: actor, text: 'موافقة ونشر المقال', key: 'approved_published' });
    pushAudit({
      action: 'Approved',
      requestId: row.id,
      performedBy: actor,
      oldStatus: 'Pending Review',
      newStatus: 'Published',
      customer: row.company || row.customerName,
      sourceModule: row.sourceModule,
      detail: row.referenceId,
    });
    pushAudit({
      action: 'Published',
      requestId: row.id,
      performedBy: actor,
      newStatus: 'Published',
      detail: row.referenceId,
    });
    pushCustomerNotification({
      title: 'تمت الموافقة على مقالك ونشره بنجاح',
      message: `Article ${row.referenceId} · Request ${row.id}`,
      source: 'المقالات',
      link: `blog.html#mine/${row.referenceId}`,
    });
    if (window.HubArticles?.publishNow) {
      row._syncingArticle = true;
      try {
        window.HubArticles.publishNow(row.referenceId, actor, { skipRequestSync: true });
        const art = window.HubArticles.get(row.referenceId);
        if (art) {
          art.requestId = row.id;
          window.HubArticles.update?.(row.referenceId, { requestId: row.id }, actor);
        }
      } finally {
        row._syncingArticle = false;
      }
    }
    save();
    return row;
  };

  const approveRequest = (requestId, actor = 'مشغّل') => {
    const row = get(requestId);
    if (!row) return null;
    if (row.referenceType === 'Article' || row.requestType === 'Article Submission') {
      return approveAndPublish(requestId, actor);
    }

    const stamp = nowIso();
    const old = row.status;
    row.approvedBy = actor;
    row.approvedAt = stamp;
    row.updatedAt = stamp;
    row.timeline = row.timeline || [];

    if (row.referenceType === 'Ad' || row.requestType === 'Ad Submission') {
      let adStatus = 'active';
      try {
        if (window.HubStore?.setAdWorkflowStatus && row.referenceId) {
          const updated = window.HubStore.setAdWorkflowStatus(
            row.referenceId,
            'active',
            { approvedBy: actor, approvedAt: stamp },
            actor
          );
          adStatus = updated?.workflowStatus || 'active';
          if (updated) updated.requestId = row.id;
        }
      } catch (_) {}
      row.status = 'Approved';
      row.adPublishStatus = adStatus;
      row.publishedAt = stamp;
      row.timeline.push({
        at: stamp,
        by: actor,
        text: adStatus === 'scheduled' ? 'موافقة — الإعلان مجدول' : 'موافقة ونشر الإعلان',
        key: 'approved_ad',
      });
      pushAudit({
        action: 'Approved',
        requestId: row.id,
        performedBy: actor,
        oldStatus: old,
        newStatus: row.status,
        customer: row.company || row.customerName,
        sourceModule: row.sourceModule,
        detail: `${row.referenceId} · ${adStatus}`,
      });
      pushCustomerNotification({
        title: 'تمت الموافقة على إعلانك',
        message: `${row.title || row.referenceId} · ${row.id}`,
        source: 'إدارة الإعلانات',
        link: 'ads.html',
      });
      save();
      return row;
    }

    // Generic product/service/other requests
    row.status = 'Approved';
    row.timeline.push({ at: stamp, by: actor, text: 'تمت الموافقة على الطلب', key: 'approved' });
    pushAudit({
      action: 'Approved',
      requestId: row.id,
      performedBy: actor,
      oldStatus: old,
      newStatus: 'Approved',
      customer: row.company || row.customerName,
      sourceModule: row.sourceModule,
      detail: row.referenceId || '',
    });
    pushCustomerNotification({
      title: 'تمت الموافقة على طلبك',
      message: `${row.title || row.id}`,
      source: row.sourceModule || 'طلبات العملاء',
      link: row.sourceUrl || 'dashboard.html#posha-clients',
    });
    save();
    return row;
  };

  const rejectRequest = (requestId, actor = 'مشغّل', reason = '', opts = {}) => {
    const row = get(requestId);
    if (!row) return null;
    const stamp = nowIso();
    const old = row.status;
    const note = String(reason || '').trim() || 'مرفوض';
    row.status = 'Rejected';
    row.rejectedBy = actor;
    row.rejectedAt = stamp;
    row.rejectionReason = note;
    row.allowResubmit = opts.allowResubmit !== false;
    row.updatedAt = stamp;
    row.timeline = row.timeline || [];
    row.timeline.push({ at: stamp, by: actor, text: `رفض: ${note}`, key: 'rejected' });
    pushAudit({
      action: 'Rejected',
      requestId: row.id,
      performedBy: actor,
      oldStatus: old,
      newStatus: 'Rejected',
      customer: row.company || row.customerName,
      sourceModule: row.sourceModule,
      detail: note,
    });

    if (row.referenceType === 'Article' && row.referenceId && window.HubArticles?.setStatus) {
      row._syncingArticle = true;
      try {
        window.HubArticles.setStatus(row.referenceId, 'Rejected', actor, note, { skipRequestSync: true });
      } finally {
        row._syncingArticle = false;
      }
    }
    if ((row.referenceType === 'Ad' || row.requestType === 'Ad Submission') && row.referenceId) {
      try {
        window.HubStore?.setAdWorkflowStatus?.(row.referenceId, 'rejected', { rejectionReason: note }, actor);
      } catch (_) {}
    }

    pushCustomerNotification({
      title:
        row.referenceType === 'Ad' || row.requestType === 'Ad Submission'
          ? 'تم رفض إعلانك'
          : row.referenceType === 'Article'
            ? 'تم رفض مقالك'
            : 'تم رفض طلبك',
      message: note,
      source: row.sourceModule || 'طلبات العملاء',
      link: row.sourceUrl || '',
    });
    try {
      addMessage(requestId, `سبب الرفض: ${note}`, actor, { internal: false });
    } catch (_) {}
    save();
    return row;
  };

  const pauseRequest = (requestId, actor = 'مشغّل') => {
    const row = get(requestId);
    if (!row) return null;
    const old = row.status;
    row.status = 'Unpublished';
    row.updatedAt = nowIso();
    row.timeline = row.timeline || [];
    row.timeline.push({ at: row.updatedAt, by: actor, text: 'إيقاف / إلغاء نشر', key: 'paused' });
    pushAudit({
      action: 'Request Paused',
      requestId: row.id,
      performedBy: actor,
      oldStatus: old,
      newStatus: 'Unpublished',
      detail: row.referenceId || '',
      customer: row.company || row.customerName,
      sourceModule: row.sourceModule,
    });
    if (row.referenceType === 'Article' && row.referenceId && window.HubArticles?.unpublish) {
      row._syncingArticle = true;
      try {
        window.HubArticles.unpublish(row.referenceId, actor, { skipRequestSync: true });
      } finally {
        row._syncingArticle = false;
      }
    }
    save();
    return row;
  };

  const resumeRequest = (requestId, actor = 'مشغّل') => {
    const row = get(requestId);
    if (!row) return null;
    if (row.referenceType === 'Article') return approveAndPublish(requestId, actor);
    if (row.referenceType === 'Ad' || row.requestType === 'Ad Submission') return approveRequest(requestId, actor);
    return updateStatus(requestId, 'In Progress', actor, 'إعادة تفعيل');
  };

  const archiveRequest = (requestId, actor = 'مشغّل') => {
    const row = get(requestId);
    if (!row) return null;
    const old = row.status;
    row.status = 'Archived';
    row.updatedAt = nowIso();
    row.timeline = row.timeline || [];
    row.timeline.push({ at: row.updatedAt, by: actor, text: 'أرشفة الطلب', key: 'archived' });
    pushAudit({
      action: 'Request Archived',
      requestId: row.id,
      performedBy: actor,
      oldStatus: old,
      newStatus: 'Archived',
      detail: row.referenceId || '',
    });
    if (row.referenceType === 'Article' && row.referenceId && window.HubArticles?.archive) {
      row._syncingArticle = true;
      try {
        window.HubArticles.archive(row.referenceId, actor, { skipRequestSync: true });
      } finally {
        row._syncingArticle = false;
      }
    }
    save();
    return row;
  };

  const editLinkedArticle = (requestId, patch = {}, actor = 'مشغّل') => {
    const row = get(requestId);
    if (!row || row.referenceType !== 'Article' || !row.referenceId) return null;
    const art = window.HubArticles?.get?.(row.referenceId);
    if (!art) return null;
    const oldTitle = art.title;
    const updated = window.HubArticles.update(row.referenceId, patch, actor);
    row.title = `مراجعة ونشر مقال: ${updated.title || row.referenceId}`;
    row.description = updated.summary || row.description;
    row.articleSnapshot = {
      articleId: updated.id,
      title: updated.title,
      category: updated.category,
      summary: updated.summary,
      authorName: updated.authorName,
      body: updated.body,
      coverImage: updated.coverImage,
      articleFile: updated.articleFile,
      attachments: updated.attachments,
      submittedAt: updated.submittedAt,
    };
    row.updatedAt = nowIso();
    row.timeline = row.timeline || [];
    row.timeline.push({ at: row.updatedAt, by: actor, text: 'تعديل المقال المنشور', key: 'edited' });
    pushAudit({
      action: 'Published Article Updated',
      requestId: row.id,
      performedBy: actor,
      oldValue: oldTitle,
      newValue: updated.title,
      detail: row.referenceId,
    });
    if (updated.status === 'Published') {
      try {
        window.HubArticles.publishNow?.(row.referenceId, actor, { skipRequestSync: true });
      } catch (_) {}
    }
    save();
    return { request: row, article: updated };
  };

  const list = (filter = {}) => {
    syncFromModules();
    return (state.requests || []).filter((r) => {
      if (filter.status && r.status !== filter.status) return false;
      if (filter.requestType && r.requestType !== filter.requestType) return false;
      if (filter.sourceModule && r.sourceModule !== filter.sourceModule) return false;
      if (filter.assignedTo && r.assignedTo !== filter.assignedTo) return false;
      if (filter.department && r.department !== filter.department) return false;
      if (filter.priority && r.priority !== filter.priority) return false;
      if (filter.email && (r.email || '').toLowerCase() !== String(filter.email).toLowerCase()) return false;
      if (filter.q) {
        const hay = `${r.id} ${r.customerId || ''} ${r.customerName} ${r.company} ${r.email} ${r.title} ${r.requestType} ${r.sourceModule} ${r.relatedSolution} ${r.referenceId || ''}`.toLowerCase();
        if (!hay.includes(String(filter.q).toLowerCase())) return false;
      }
      if (filter.view === 'new') return r.status === 'New';
      if (filter.view === 'active')
        return !['Completed', 'Cancelled', 'Rejected', 'Published', 'Archived', 'Approved'].includes(r.status);
      if (filter.view === 'pending_review')
        return ['Pending Review', 'Under Review', 'New'].includes(r.status);
      if (filter.view === 'approved') return ['Approved', 'Published', 'Unpublished'].includes(r.status);
      if (filter.view === 'paused') return r.status === 'Unpublished';
      if (filter.view === 'archived') return r.status === 'Archived';
      if (filter.view === 'rejected') return r.status === 'Rejected';
      if (filter.view === 'open') return !['Completed', 'Cancelled', 'Rejected', 'Published', 'Archived'].includes(r.status);
      if (filter.view === 'mine' && filter.actor) return r.assignedTo === filter.actor;
      if (filter.view === 'waiting') return r.status === 'Waiting For Customer' || r.status === 'Needs Changes';
      if (filter.view === 'overdue') return slaStatus(r) === 'Overdue';
      if (filter.view === 'done' || filter.view === 'completed')
        return ['Completed', 'Published'].includes(r.status);
      if (filter.view === 'articles')
        return r.requestType === 'Article Submission' || r.referenceType === 'Article';
      if (filter.view === 'today') {
        const d = new Date(r.createdAt).toDateString();
        return d === new Date().toDateString();
      }
      return true;
    });
  };

  const updateStatus = (id, status, actor = 'مشغّل', note = '', opts = {}) => {
    const row = get(id);
    if (!row) return null;
    const old = row.status;
    row.status = status;
    row.updatedAt = nowIso();
    if (!Array.isArray(row.timeline)) row.timeline = [];
    row.timeline.push({ at: row.updatedAt, by: actor, text: note || `تغيّر الحالة: ${STATUS_AR[old] || old} → ${STATUS_AR[status] || status}`, key: 'status' });
    pushAudit({
      action: 'Status Changed',
      requestId: row.id,
      customer: row.company || row.customerName,
      sourceModule: row.sourceModule,
      performedBy: actor,
      oldStatus: old,
      newStatus: status,
      oldValue: old,
      newValue: status,
    });
    mirrorToSolutions(row);
    if (!opts.skipArticleSync) mirrorToArticle(row, actor);
    save();
    return row;
  };

  const assign = (id, fields = {}, actor = 'مشغّل') => {
    const row = get(id);
    if (!row) return null;
    const old = row.assignedTo;
    Object.assign(row, fields);
    row.updatedAt = nowIso();
    if (row.status === 'New' || row.status === 'Viewed') row.status = 'Assigned';
    row.timeline.push({ at: row.updatedAt, by: actor, text: `تعيين: ${fields.assignedTo || fields.department || ''}`, key: 'assigned' });
    pushAudit({
      action: 'Request Assigned',
      requestId: row.id,
      customer: row.company || row.customerName,
      sourceModule: row.sourceModule,
      performedBy: actor,
      oldValue: old,
      newValue: fields.assignedTo || '',
      oldStatus: 'New',
      newStatus: row.status,
    });
    mirrorToSolutions(row);
    save();
    return row;
  };

  const markViewed = (id, actor = 'مشغّل') => {
    const row = get(id);
    if (!row) return null;
    if (row.status === 'New') {
      row.status = 'Viewed';
      row.viewedAt = nowIso();
      row.timeline.push({ at: row.viewedAt, by: actor, text: 'تمت مشاهدة الطلب', key: 'viewed' });
      pushAudit({ action: 'Request Viewed', requestId: row.id, performedBy: actor, oldStatus: 'New', newStatus: 'Viewed', customer: row.company, sourceModule: row.sourceModule });
      mirrorToSolutions(row);
      save();
    }
    return row;
  };

  const addMessage = (id, text, actor = 'عميل', { internal } = {}) => {
    const row = get(id);
    if (!row) return null;
    const msg = { at: nowIso(), by: actor, text, internal: !!internal };
    if (internal) {
      if (!Array.isArray(row.internalNotes)) row.internalNotes = [];
      row.internalNotes.push(msg);
    } else {
      if (!Array.isArray(row.messages)) row.messages = [];
      row.messages.push(msg);
    }
    row.updatedAt = nowIso();
    row.timeline.push({ at: row.updatedAt, by: actor, text: internal ? 'ملاحظة داخلية' : 'رسالة تواصل', key: internal ? 'note' : 'message' });
    pushAudit({ action: internal ? 'Comment Added' : 'Customer Contacted', requestId: row.id, performedBy: actor, customer: row.company, sourceModule: row.sourceModule, detail: text.slice(0, 80) });
    mirrorToSolutions(row);
    save();
    return row;
  };

  const addAttachment = (id, fileName, actor = 'عميل') => {
    const row = get(id);
    if (!row) return null;
    if (!Array.isArray(row.attachments)) row.attachments = [];
    row.attachments.push({ name: fileName, at: nowIso(), by: actor });
    row.updatedAt = nowIso();
    row.timeline.push({ at: row.updatedAt, by: actor, text: `مرفق: ${fileName}`, key: 'attachment' });
    pushAudit({ action: 'Attachment Added', requestId: row.id, performedBy: actor, customer: row.company, sourceModule: row.sourceModule, detail: fileName });
    mirrorToSolutions(row);
    save();
    return row;
  };

  const mirrorToSolutions = (row) => {
    try {
      const raw = localStorage.getItem('naiosh_solutions_workspace_v1');
      if (!raw) return;
      const sol = JSON.parse(raw);
      if (!Array.isArray(sol.requests)) sol.requests = [];
      const i = sol.requests.findIndex((x) => x.id === row.id || x.requestId === row.id);
      const mirrored = {
        id: row.id,
        requestId: row.requestId,
        requestType: row.requestType,
        solutionId: row.solutionId,
        solutionName: row.relatedSolution || row.solutionName || row.title,
        customer: row.customer || {
          name: row.customerName,
          company: row.company,
          phone: row.phone,
          email: row.email,
          branch: row.branch,
        },
        need: row.need || row.description,
        priority: row.priority,
        scopeType: row.scopeType,
        scopeDetail: row.scopeDetail,
        attachments: row.attachments,
        costMeta: row.costMeta,
        status: row.status,
        requestedBy: row.requestedBy || row.createdBy,
        assignedTo: row.assignedTo,
        salesOwner: row.salesOwner,
        consultant: row.consultant,
        approver: row.approver,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        timeline: row.timeline,
        messages: row.messages,
        tasks: row.tasks,
        sourceModule: row.sourceModule,
        sourcePage: row.sourcePage,
        sourceUrl: row.sourceUrl,
        sourceAction: row.sourceAction,
      };
      if (i >= 0) sol.requests[i] = mirrored;
      else if (String(row.sourceModule || '').includes('حلول') || String(row.sourceModule || '').includes('خفض') || String(row.id || '').startsWith('SOL-REQ') || String(row.id || '').startsWith('COST')) {
        sol.requests.unshift(mirrored);
      }
      localStorage.setItem('naiosh_solutions_workspace_v1', JSON.stringify(sol));
    } catch (_) {}
  };

  const kpis = () => {
    const all = state.requests || [];
    const closed = ['Completed', 'Cancelled', 'Rejected', 'Published', 'Archived'];
    const open = all.filter((r) => !closed.includes(r.status));
    return {
      total: all.length,
      neu: all.filter((r) => r.status === 'New').length,
      pendingReview: all.filter((r) => ['Pending Review', 'Under Review'].includes(r.status)).length,
      inProgress: all.filter((r) => ['In Progress', 'Assigned', 'Viewed'].includes(r.status)).length,
      needsAction: all.filter((r) =>
        ['New', 'Pending Review', 'Needs Changes'].includes(r.status) || slaStatus(r) === 'Overdue'
      ).length,
      approved: all.filter((r) => ['Approved', 'Published'].includes(r.status)).length,
      rejected: all.filter((r) => r.status === 'Rejected').length,
      open: open.length,
      overdue: all.filter((r) => slaStatus(r) === 'Overdue').length,
      completed: all.filter((r) => ['Completed', 'Published'].includes(r.status)).length,
      waiting: all.filter((r) => r.status === 'Waiting For Customer' || r.status === 'Needs Changes').length,
      unassigned: all.filter((r) => !r.assignedTo && !closed.includes(r.status)).length,
      articles: all.filter((r) => r.requestType === 'Article Submission' || r.referenceType === 'Article').length,
    };
  };

  const updateSettings = (patch = {}) => {
    state.settings = Object.assign({}, state.settings || {}, patch);
    if (patch.routing) state.settings.routing = Object.assign({}, DEFAULT_ROUTING, patch.routing);
    save();
    return state.settings;
  };

  syncFromModules();

  window.HubCustomerRequests = {
    KEY,
    STATUS_AR,
    DEFAULT_ROUTING,
    TYPE_LABELS_AR,
    reload: () => {
      state = load();
      syncFromModules();
      return state;
    },
    getState: () => state,
    syncFromModules,
    create,
    ingest,
    get,
    list,
    updateStatus,
    assign,
    markViewed,
    addMessage,
    addAttachment,
    findSimilarOpen,
    findByReference,
    ensureForArticle,
    ensureForAd,
    mapArticleStatus,
    approveAndPublish,
    approveRequest,
    rejectRequest,
    isPendingReview,
    pauseRequest,
    resumeRequest,
    archiveRequest,
    editLinkedArticle,
    slaStatus,
    kpis,
    listAudit: () => state.auditLog || [],
    pushAudit,
    updateSettings,
    getSettings: () => state.settings,
  };
})();
