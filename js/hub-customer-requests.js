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
    'General Request': { department: 'Operations', assignedTo: 'Ops Desk' },
  };

  const STATUS_AR = {
    New: 'جديد',
    Viewed: 'تمت المشاهدة',
    Assigned: 'تم التعيين',
    'Under Review': 'قيد المراجعة',
    'Waiting For Customer': 'بانتظار العميل',
    'Pending Approval': 'بانتظار الموافقة',
    'Proposal Sent': 'عرض مرسل',
    'In Progress': 'قيد التنفيذ',
    Completed: 'مكتمل',
    Rejected: 'مرفوض',
    Cancelled: 'ملغي',
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
      solutionId: r.solutionId || '',
      solutionName: r.solutionName || '',
      priority: r.priority || 'عادي',
      status: r.status === 'Draft' ? 'Draft' : r.status || 'New',
      assignedTo: r.assignedTo || route.assignedTo,
      department: r.department || route.department,
      salesOwner: r.salesOwner || route.assignedTo,
      consultant: r.consultant || '',
      approver: r.approver || '',
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

    if (changed) save();
    return state.requests.length;
  };

  syncFromModules();

  const create = (payload = {}, actor = 'عميل') => {
    const type = payload.requestType || 'General Request';
    const route = routeFor(type);
    let prefix = 'REQ';
    if (type === 'Cost Reduction Assessment' || type === 'Cost Reduction Request') prefix = 'COST';
    else if (String(type).includes('Solution') || type === 'Quote Request' || type === 'Consultation Request') prefix = 'SOL-REQ';
    else if (type === 'Project Registration') prefix = 'SP-REG';
    else if (type === 'Support Request') prefix = 'SUP';

    const id = payload.id || payload.requestId || nextSeq(state.requests, prefix);
    const stamp = nowIso();
    const item = normalizeFromSolutions({
      ...payload,
      id,
      requestId: id,
      requestType: type,
      title: payload.title || payload.solutionName || payload.need || 'طلب عميل',
      description: payload.description || payload.need || '',
      need: payload.need || payload.description || '',
      sourceModule: payload.sourceModule || 'منصة نايوش',
      sourcePage: payload.sourcePage || '',
      sourceUrl: payload.sourceUrl || '',
      sourceAction: payload.sourceAction || 'Submit Request',
      relatedSolution: payload.relatedSolution || payload.solutionName || '',
      status: payload.status || 'New',
      assignedTo: payload.assignedTo || route.assignedTo,
      department: payload.department || route.department,
      salesOwner: payload.salesOwner || route.assignedTo,
      createdBy: actor,
      requestedBy: actor,
      createdAt: stamp,
      updatedAt: stamp,
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
        const hay = `${r.id} ${r.customerName} ${r.company} ${r.email} ${r.title} ${r.requestType} ${r.sourceModule} ${r.relatedSolution}`.toLowerCase();
        if (!hay.includes(String(filter.q).toLowerCase())) return false;
      }
      if (filter.view === 'new') return r.status === 'New';
      if (filter.view === 'open') return !['Completed', 'Cancelled', 'Rejected'].includes(r.status);
      if (filter.view === 'mine' && filter.actor) return r.assignedTo === filter.actor;
      if (filter.view === 'waiting') return r.status === 'Waiting For Customer';
      if (filter.view === 'overdue') return slaStatus(r) === 'Overdue';
      if (filter.view === 'done') return r.status === 'Completed';
      if (filter.view === 'today') {
        const d = new Date(r.createdAt).toDateString();
        return d === new Date().toDateString();
      }
      return true;
    });
  };

  const updateStatus = (id, status, actor = 'مشغّل', note = '') => {
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
    // mirror into solutions store if present (same id)
    mirrorToSolutions(row);
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
    const open = all.filter((r) => !['Completed', 'Cancelled', 'Rejected'].includes(r.status));
    return {
      total: all.length,
      neu: all.filter((r) => r.status === 'New').length,
      open: open.length,
      overdue: all.filter((r) => slaStatus(r) === 'Overdue').length,
      completed: all.filter((r) => r.status === 'Completed').length,
      waiting: all.filter((r) => r.status === 'Waiting For Customer').length,
      unassigned: all.filter((r) => r.status === 'New' && !r.assignedTo).length,
    };
  };

  const updateSettings = (patch = {}) => {
    state.settings = Object.assign({}, state.settings || {}, patch);
    if (patch.routing) state.settings.routing = Object.assign({}, DEFAULT_ROUTING, patch.routing);
    save();
    return state.settings;
  };

  window.HubCustomerRequests = {
    KEY,
    STATUS_AR,
    DEFAULT_ROUTING,
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
    slaStatus,
    kpis,
    listAudit: () => state.auditLog || [],
    pushAudit,
    updateSettings,
    getSettings: () => state.settings,
  };
})();
