/**
 * عملاء بوشا — shared ops layer (single source of truth on client-portal store).
 * CLIENT <-> store <-> ADMIN
 */
'use strict';

const hubSession = require('./hub-session');
const crypto = require('crypto');

function portal() {
  // Lazy require avoids circular init with hub-client-portal
  return require('./hub-client-portal');
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function nextTicketNumber(store) {
  store.meta = store.meta || {};
  store.meta.ticketSeq = Number(store.meta.ticketSeq || 1000) + 1;
  return `TKT-${store.meta.ticketSeq}`;
}

function nextOrderNumber(store) {
  store.meta = store.meta || {};
  store.meta.orderSeq = Number(store.meta.orderSeq || 10000) + 1;
  return `ORD-${store.meta.orderSeq}`;
}

function normalizeStore(store) {
  store.clients = store.clients || {};
  store.activity = Array.isArray(store.activity) ? store.activity : [];
  store.adminNotifications = Array.isArray(store.adminNotifications) ? store.adminNotifications : [];
  store.issues = Array.isArray(store.issues) ? store.issues : [];
  store.meta = store.meta || { ticketSeq: 1000, orderSeq: 10000 };
  return store;
}

/**
 * Event catalog: activity / clientNotif / adminNotif / issue
 */
const EVENT_POLICY = {
  CLIENT_REGISTERED: { activity: true, client: false, admin: true, issue: false },
  CLIENT_LOGIN: { activity: true, client: false, admin: false, issue: false },
  CLIENT_PROFILE_UPDATED: { activity: true, client: false, admin: true, issue: false },
  TICKET_CREATED: { activity: true, client: true, admin: true, issue: false },
  TICKET_MESSAGE_CREATED: { activity: true, client: true, admin: true, issue: false },
  TICKET_STATUS_CHANGED: { activity: true, client: true, admin: false, issue: false },
  ORDER_CREATED: { activity: true, client: true, admin: true, issue: false },
  ORDER_STATUS_CHANGED: { activity: true, client: true, admin: false, issue: false },
  PAYMENT_SUCCEEDED: { activity: true, client: true, admin: true, issue: false },
  PAYMENT_FAILED: { activity: true, client: true, admin: true, issue: true },
  SUBSCRIPTION_CREATED: { activity: true, client: true, admin: true, issue: false },
  SUBSCRIPTION_EXPIRING: { activity: true, client: true, admin: true, issue: true },
  SYSTEM_ASSIGNED: { activity: true, client: true, admin: false, issue: false },
  SYSTEM_ACTIVATED: { activity: true, client: true, admin: false, issue: false },
  SYSTEM_SUSPENDED: { activity: true, client: true, admin: false, issue: true },
  WALLET_CREDITED: { activity: true, client: true, admin: false, issue: false },
  WALLET_DEBITED: { activity: true, client: true, admin: false, issue: false },
  PASSWORD_CHANGED: { activity: true, client: true, admin: false, issue: false },
  ACCOUNT_SUSPENDED: { activity: true, client: true, admin: true, issue: true },
  SUSPICIOUS_LOGIN: { activity: true, client: true, admin: true, issue: true },
};

function deepLinkFor(type, meta = {}) {
  if (type.startsWith('TICKET')) return { entityType: 'ticket', entityId: meta.ticketId || meta.id, adminHash: 'posha-clients', adminTab: 'support' };
  if (type.startsWith('ORDER')) return { entityType: 'order', entityId: meta.orderId || meta.id, adminHash: 'posha-clients', adminTab: 'orders' };
  if (type.startsWith('SYSTEM')) return { entityType: 'system', entityId: meta.systemCode || meta.id, adminHash: 'posha-clients', adminTab: 'systems' };
  if (type.startsWith('WALLET') || type.startsWith('PAYMENT')) return { entityType: 'wallet', entityId: meta.id, adminHash: 'posha-clients', adminTab: 'wallet' };
  return { entityType: 'client', entityId: meta.clientEmail || meta.client_id, adminHash: 'posha-clients', adminTab: 'overview' };
}

function pushClientActivity(client, entry) {
  client.activity = client.activity || [];
  client.activity.unshift({
    id: uid('cact'),
    at: new Date().toISOString(),
    ...entry,
  });
  client.activity = client.activity.slice(0, 200);
}

function emitEvent(store, {
  type,
  clientEmail,
  actorId,
  actorRole = 'system',
  title,
  message,
  metadata = {},
  forceAdmin = false,
  forceClient = false,
  forceIssue = false,
  issueSeverity = 'WARNING',
}) {
  normalizeStore(store);
  const policy = EVENT_POLICY[type] || { activity: true, client: false, admin: false, issue: false };
  const client = clientEmail ? store.clients[String(clientEmail).toLowerCase()] : null;
  const link = deepLinkFor(type, { ...metadata, clientEmail });
  const at = new Date().toISOString();

  // Never log secrets
  const safeMeta = { ...metadata };
  delete safeMeta.password;
  delete safeMeta.token;
  delete safeMeta.passwordHash;
  delete safeMeta.otp;
  delete safeMeta.card;

  if (policy.activity) {
    store.activity.unshift({
      id: uid('act'),
      at,
      action: type,
      type,
      user_id: clientEmail || null,
      clientEmail: clientEmail || null,
      actor_id: actorId,
      actorRole,
      title: title || type,
      message: message || '',
      metadata: safeMeta,
      related_entity_type: link.entityType,
      related_entity_id: link.entityId,
    });
    store.activity = store.activity.slice(0, 1000);
    if (client) {
      pushClientActivity(client, {
        type,
        title: title || type,
        message: message || '',
        actor_id: actorId,
        actorRole,
        metadata: safeMeta,
      });
    }
  }

  const notifyClient = forceClient || policy.client;
  if (notifyClient && client) {
    // Avoid duplicate client notif for same ticket message from self
    const skipSelf =
      type === 'TICKET_MESSAGE_CREATED' && actorRole === 'client' && String(actorId).toLowerCase() === String(clientEmail).toLowerCase();
    if (!skipSelf) {
      client.notifications = client.notifications || [];
      client.notifications.unshift({
        id: uid('ntf'),
        title: title || type,
        body: message || '',
        at,
        read: false,
        kind: type.split('_')[0].toLowerCase(),
        type,
        related_entity_type: link.entityType,
        related_entity_id: link.entityId,
        deepLink: link.entityType === 'ticket' ? '#support' : link.entityType === 'order' ? '#orders' : '#home',
      });
      client.notifications = client.notifications.slice(0, 200);
    }
  }

  const notifyAdmin = forceAdmin || policy.admin;
  if (notifyAdmin) {
    // Avoid duplicate: if client sends ticket message, admin gets it; if admin sends, client gets it (not admin again for own reply unless force)
    const skipAdminSelf = type === 'TICKET_MESSAGE_CREATED' && (actorRole === 'admin' || actorRole === 'super_admin');
    if (!skipAdminSelf || forceAdmin) {
      store.adminNotifications.unshift({
        id: uid('antf'),
        recipient_role: 'ADMIN',
        client_id: client?.clientId || null,
        clientEmail: clientEmail || null,
        type,
        title: title || type,
        message: message || '',
        related_entity_type: link.entityType,
        related_entity_id: link.entityId,
        is_read: false,
        created_at: at,
        deepLink: {
          hash: 'posha-clients',
          email: clientEmail,
          tab: link.adminTab,
          entityId: link.entityId,
        },
      });
      store.adminNotifications = store.adminNotifications.slice(0, 500);
    }
  }

  if (forceIssue || policy.issue) {
    store.issues.unshift({
      id: uid('iss'),
      severity: issueSeverity,
      status: 'OPEN',
      type,
      title: title || type,
      message: message || '',
      clientEmail: clientEmail || null,
      clientId: client?.clientId || null,
      related_entity_type: link.entityType,
      related_entity_id: link.entityId,
      assigned_admin_id: null,
      created_at: at,
      updated_at: at,
      notes: [],
    });
    store.issues = store.issues.slice(0, 300);
  }

  return { ok: true };
}

function clientRow(c) {
  const openTickets = (c.tickets || []).filter((t) => !['resolved', 'closed', 'RESOLVED', 'CLOSED'].includes(String(t.status))).length;
  const openOrders = (c.orders || []).filter((o) => !['completed', 'cancelled', 'rejected'].includes(o.status)).length;
  const unpaid = (c.invoices || []).filter((i) => i.status === 'unpaid' || i.status === 'overdue').length;
  const hasAlert = unpaid > 0 || openTickets > 0 || c.status === 'suspended' || (c.systems || []).some((s) => s.status === 'suspended');
  return {
    email: c.email,
    name: c.name,
    phone: c.phone || '',
    company: c.company || '',
    status: c.status,
    clientId: c.clientId,
    accountLevel: c.accountLevel,
    systemsCount: (c.systems || []).length,
    systems: (c.systems || []).map((s) => ({ code: s.code, name: s.name, status: s.status })),
    openOrders,
    openTickets,
    subscriptionsCount: (c.subscriptions || []).length,
    walletTotal: c.wallet?.total || 0,
    unpaidInvoices: unpaid,
    lastLoginAt: c.lastLoginAt,
    createdAt: c.createdAt,
    hasAlert,
    isNew: c.createdAt && Date.now() - new Date(c.createdAt).getTime() < 7 * 864e5,
  };
}

function buildSummary(store) {
  normalizeStore(store);
  const clients = Object.values(store.clients || {});
  const allTickets = clients.flatMap((c) => (c.tickets || []).map((t) => ({ ...t, clientEmail: c.email })));
  const openTickets = allTickets.filter((t) => !['resolved', 'closed', 'RESOLVED', 'CLOSED'].includes(String(t.status)));
  const pendingOrders = clients.reduce(
    (n, c) => n + (c.orders || []).filter((o) => ['pending', 'pending_review', 'in_progress', 'under_review'].includes(o.status)).length,
    0
  );
  const openIssues = (store.issues || []).filter((i) => i.status === 'OPEN' || i.status === 'INVESTIGATING');
  const paymentIssues = clients.reduce(
    (n, c) => n + (c.invoices || []).filter((i) => i.status === 'overdue' || i.status === 'unpaid').length,
    0
  );
  return {
    totalClients: clients.length,
    activeClients: clients.filter((c) => c.status === 'active').length,
    suspendedClients: clients.filter((c) => c.status === 'suspended').length,
    newClients: clients.filter((c) => c.createdAt && Date.now() - new Date(c.createdAt).getTime() < 7 * 864e5).length,
    pendingOrders,
    openTickets: openTickets.length,
    openIssues: openIssues.length,
    paymentIssues,
    unreadAdminNotifications: (store.adminNotifications || []).filter((n) => !n.is_read).length,
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-User-Id, x-user-id, X-Hub-Token, X-Hub-User-Role, X-Hub-User-Name, X-Hub-User-Email',
  });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function createTicket(store, client, payload, session) {
  normalizeStore(store);
  const number = nextTicketNumber(store);
  const ticket = {
    id: uid('tkt'),
    number,
    ticket_number: number,
    client_id: client.clientId,
    clientEmail: client.email,
    subject: String(payload.subject || '').trim(),
    category: String(payload.department || payload.category || 'دعم فني'),
    department: String(payload.department || payload.category || 'دعم فني'),
    priority: String(payload.priority || 'NORMAL').toUpperCase().replace('MEDIUM', 'NORMAL'),
    related_system_id: String(payload.systemCode || payload.related_system_id || '').toUpperCase(),
    systemCode: String(payload.systemCode || '').toUpperCase(),
    status: 'OPEN',
    assigned_admin_id: null,
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    messages: [
      {
        id: uid('msg'),
        ticket_id: null,
        sender_id: session.email,
        sender_role: 'client',
        from: 'client',
        message: String(payload.message || payload.body || '').trim(),
        body: String(payload.message || payload.body || '').trim(),
        attachment: payload.attachment || null,
        created_at: new Date().toISOString(),
        at: new Date().toISOString(),
        read_at: null,
      },
    ],
  };
  ticket.messages[0].ticket_id = ticket.id;
  client.tickets = client.tickets || [];
  client.tickets.unshift(ticket);
  emitEvent(store, {
    type: 'TICKET_CREATED',
    clientEmail: client.email,
    actorId: session.email,
    actorRole: 'client',
    title: `تذكرة دعم جديدة ${ticket.number}`,
    message: `${client.name}: ${ticket.subject}`,
    metadata: { ticketId: ticket.id, ticketNumber: ticket.number, priority: ticket.priority },
  });
  if (ticket.priority === 'URGENT' || ticket.priority === 'HIGH') {
    emitEvent(store, {
      type: 'TICKET_CREATED',
      clientEmail: client.email,
      actorId: session.email,
      actorRole: 'client',
      title: `تذكرة ${ticket.priority}: ${ticket.subject}`,
      message: ticket.number,
      metadata: { ticketId: ticket.id },
      forceIssue: true,
      issueSeverity: ticket.priority === 'URGENT' ? 'CRITICAL' : 'HIGH',
      forceAdmin: false,
      forceClient: false,
    });
  }
  return ticket;
}

function addTicketMessage(store, client, ticket, body, session, role) {
  const text = String(body.message || body.body || '').trim();
  if (!text) throw Object.assign(new Error('الرسالة مطلوبة'), { status: 400 });
  const msg = {
    id: uid('msg'),
    ticket_id: ticket.id,
    sender_id: session.email,
    sender_role: role,
    from: role === 'client' ? 'client' : 'support',
    message: text,
    body: text,
    attachment: body.attachment || null,
    created_at: new Date().toISOString(),
    at: new Date().toISOString(),
    read_at: null,
  };
  ticket.messages = ticket.messages || [];
  ticket.messages.push(msg);
  ticket.updatedAt = msg.at;
  ticket.updated_at = msg.at;
  if (role === 'client') {
    ticket.status = ticket.status === 'WAITING_FOR_CLIENT' || ticket.status === 'waiting_customer' ? 'IN_PROGRESS' : ticket.status;
  } else {
    ticket.status = 'WAITING_FOR_CLIENT';
  }
  emitEvent(store, {
    type: 'TICKET_MESSAGE_CREATED',
    clientEmail: client.email,
    actorId: session.email,
    actorRole: role,
    title: role === 'client' ? `رسالة جديدة من العميل على ${ticket.number || ticket.id}` : `رد الدعم على ${ticket.number || ticket.id}`,
    message: text.slice(0, 160),
    metadata: { ticketId: ticket.id, ticketNumber: ticket.number, messageId: msg.id },
  });
  return msg;
}

async function handlePoshaAdminApi(req, res, pathname) {
  if (!pathname.startsWith('/api/admin/posha')) return false;
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return true;
  }

  let session;
  try {
    session = hubSession.requireStaff(req, 'clients.view');
  } catch (err) {
    sendJson(res, err.status || 403, { ok: false, error: err.message });
    return true;
  }

  const store = normalizeStore(portal().readStore());
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  // api admin posha ...

  if (pathname === '/api/admin/posha/summary' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, summary: buildSummary(store) });
    return true;
  }

  if (pathname === '/api/admin/posha/clients' && req.method === 'GET') {
    const list = Object.values(store.clients).map(clientRow);
    sendJson(res, 200, { ok: true, clients: list, total: list.length, summary: buildSummary(store) });
    return true;
  }

  if (parts[3] === 'clients' && parts[4] && !parts[5] && req.method === 'GET') {
    const email = decodeURIComponent(parts[4]).toLowerCase();
    const client = store.clients[email];
    if (!client) {
      sendJson(res, 404, { ok: false, error: 'العميل غير موجود' });
      return true;
    }
    const pub = portal().publicClient(client, { includeInternal: true });
    sendJson(res, 200, {
      ok: true,
      client: pub,
      timeline: (client.activity || []).slice(0, 50),
      row: clientRow(client),
    });
    return true;
  }

  if (pathname === '/api/admin/posha/tickets' && req.method === 'GET') {
    if (!hubSession.hasPermission(session, 'support.view')) {
      sendJson(res, 403, { ok: false, error: 'ليست لديك صلاحية الدعم' });
      return true;
    }
    const tickets = Object.values(store.clients).flatMap((c) =>
      (c.tickets || []).map((t) => ({
        ...t,
        clientEmail: c.email,
        clientName: c.name,
        clientId: c.clientId,
      }))
    );
    tickets.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    sendJson(res, 200, { ok: true, tickets });
    return true;
  }

  if (parts[3] === 'tickets' && parts[4] && parts[5] === 'reply' && req.method === 'POST') {
    if (!hubSession.hasPermission(session, 'support.reply')) {
      sendJson(res, 403, { ok: false, error: 'ليست لديك صلاحية الرد' });
      return true;
    }
    const ticketId = decodeURIComponent(parts[4]);
    const body = await readBody(req);
    let found = null;
    let owner = null;
    for (const c of Object.values(store.clients)) {
      const t = (c.tickets || []).find((x) => x.id === ticketId || x.number === ticketId);
      if (t) {
        found = t;
        owner = c;
        break;
      }
    }
    if (!found) {
      sendJson(res, 404, { ok: false, error: 'التذكرة غير موجودة' });
      return true;
    }
    try {
      addTicketMessage(store, owner, found, body, session, session.lane === 'SUPER_ADMIN' ? 'super_admin' : 'admin');
    } catch (e) {
      sendJson(res, e.status || 400, { ok: false, error: e.message });
      return true;
    }
    portal().writeStore(store);
    sendJson(res, 200, { ok: true, ticket: found });
    return true;
  }

  if (parts[3] === 'tickets' && parts[4] && parts[5] === 'status' && req.method === 'POST') {
    if (!hubSession.hasPermission(session, 'support.reply')) {
      sendJson(res, 403, { ok: false, error: 'ليست لديك صلاحية تحديث التذكرة' });
      return true;
    }
    const ticketId = decodeURIComponent(parts[4]);
    const body = await readBody(req);
    let found = null;
    let owner = null;
    for (const c of Object.values(store.clients)) {
      const t = (c.tickets || []).find((x) => x.id === ticketId || x.number === ticketId);
      if (t) {
        found = t;
        owner = c;
        break;
      }
    }
    if (!found) {
      sendJson(res, 404, { ok: false, error: 'التذكرة غير موجودة' });
      return true;
    }
    const prev = found.status;
    found.status = String(body.status || found.status).toUpperCase();
    found.updatedAt = new Date().toISOString();
    found.updated_at = found.updatedAt;
    if (body.assigned_admin_id) found.assigned_admin_id = body.assigned_admin_id;
    emitEvent(store, {
      type: 'TICKET_STATUS_CHANGED',
      clientEmail: owner.email,
      actorId: session.email,
      actorRole: 'admin',
      title: `تحديث حالة التذكرة ${found.number || found.id}`,
      message: `${prev} → ${found.status}`,
      metadata: { ticketId: found.id, ticketNumber: found.number, status: found.status },
    });
    portal().writeStore(store);
    sendJson(res, 200, { ok: true, ticket: found });
    return true;
  }

  if (parts[3] === 'clients' && parts[4] && parts[5] === 'order-status' && req.method === 'POST') {
    if (!hubSession.hasPermission(session, 'orders.update')) {
      sendJson(res, 403, { ok: false, error: 'ليست لديك صلاحية الطلبات' });
      return true;
    }
    const email = decodeURIComponent(parts[4]).toLowerCase();
    const body = await readBody(req);
    const client = store.clients[email];
    const order = (client?.orders || []).find((o) => o.id === body.orderId || o.number === body.orderId);
    if (!order) {
      sendJson(res, 404, { ok: false, error: 'الطلب غير موجود' });
      return true;
    }
    const prev = order.status;
    order.status = String(body.status || order.status);
    order.timeline = order.timeline || [];
    order.timeline.push({ at: new Date().toISOString(), label: `تحديث الحالة إلى ${order.status}`, status: 'done' });
    emitEvent(store, {
      type: 'ORDER_STATUS_CHANGED',
      clientEmail: email,
      actorId: session.email,
      actorRole: 'admin',
      title: `تحديث الطلب ${order.number}`,
      message: `${prev} → ${order.status}`,
      metadata: { orderId: order.id, status: order.status },
    });
    portal().writeStore(store);
    sendJson(res, 200, { ok: true, order });
    return true;
  }

  if (parts[3] === 'clients' && parts[4] && parts[5] === 'wallet-credit' && req.method === 'POST') {
    if (!hubSession.hasPermission(session, 'wallet.adjust')) {
      sendJson(res, 403, { ok: false, error: 'ليست لديك صلاحية المحفظة' });
      return true;
    }
    const email = decodeURIComponent(parts[4]).toLowerCase();
    const body = await readBody(req);
    const client = portal().ensureClient(store, email);
    const amount = Number(body.amount || 0);
    if (!amount || amount <= 0) {
      sendJson(res, 400, { ok: false, error: 'مبلغ غير صالح' });
      return true;
    }
    client.wallet = client.wallet || { paid: 0, free: 0, total: 0, ledger: [] };
    client.wallet.paid += amount;
    client.wallet.total = (client.wallet.paid || 0) + (client.wallet.free || 0);
    client.wallet.ledger.unshift({
      id: uid('led'),
      at: new Date().toISOString(),
      type: 'credit',
      amount,
      note: body.note || 'شحن من الإدارة',
    });
    emitEvent(store, {
      type: 'WALLET_CREDITED',
      clientEmail: email,
      actorId: session.email,
      actorRole: 'admin',
      title: 'تمت إضافة رصيد لمحفظتك',
      message: `+${amount} نقطة`,
      metadata: { amount },
    });
    portal().writeStore(store);
    sendJson(res, 200, { ok: true, wallet: client.wallet });
    return true;
  }

  if (parts[3] === 'clients' && parts[4] && parts[5] === 'activate-system' && req.method === 'POST') {
    if (!hubSession.hasPermission(session, 'systems.assign')) {
      sendJson(res, 403, { ok: false, error: 'ليست لديك صلاحية تعيين الأنظمة' });
      return true;
    }
    const email = decodeURIComponent(parts[4]).toLowerCase();
    const body = await readBody(req);
    const client = portal().ensureClient(store, email);
    const code = String(body.code || body.systemCode || '').toUpperCase();
    if (!code) {
      sendJson(res, 400, { ok: false, error: 'كود النظام مطلوب' });
      return true;
    }
    let sys = (client.systems || []).find((s) => s.code === code);
    if (!sys) {
      sys = {
        id: uid('sys'),
        code,
        name: body.name || code,
        description: body.description || '',
        logo: 'assets/logo-hub.jpeg',
        status: 'active',
        plan: body.plan || 'أساسي',
        activatedAt: new Date().toISOString(),
        expiresAt: body.expiresAt || null,
        url: body.url || `systems/${code.toLowerCase()}.html`,
      };
      client.systems = client.systems || [];
      client.systems.unshift(sys);
      emitEvent(store, {
        type: 'SYSTEM_ASSIGNED',
        clientEmail: email,
        actorId: session.email,
        actorRole: 'admin',
        title: `تم تعيين نظام ${sys.name}`,
        message: `الباقة: ${sys.plan}`,
        metadata: { systemCode: code },
      });
    } else {
      sys.status = 'active';
      emitEvent(store, {
        type: 'SYSTEM_ACTIVATED',
        clientEmail: email,
        actorId: session.email,
        actorRole: 'admin',
        title: `تم تفعيل نظام ${sys.name}`,
        message: 'نظامك أصبح نشطًا',
        metadata: { systemCode: code },
      });
    }
    portal().writeStore(store);
    sendJson(res, 200, { ok: true, systems: client.systems });
    return true;
  }

  if (pathname === '/api/admin/posha/events' && req.method === 'GET') {
    if (!hubSession.hasPermission(session, 'client_activity.view') && !hubSession.hasPermission(session, 'clients.view')) {
      sendJson(res, 403, { ok: false, error: 'ليست لديك صلاحية الأحداث' });
      return true;
    }
    sendJson(res, 200, { ok: true, events: store.activity.slice(0, 200) });
    return true;
  }

  if (pathname === '/api/admin/posha/issues' && req.method === 'GET') {
    if (!hubSession.hasPermission(session, 'issues.view') && !hubSession.hasPermission(session, 'clients.view')) {
      sendJson(res, 403, { ok: false, error: 'ليست لديك صلاحية المشاكل' });
      return true;
    }
    sendJson(res, 200, { ok: true, issues: store.issues });
    return true;
  }

  if (parts[3] === 'issues' && parts[4] && parts[5] === 'status' && req.method === 'POST') {
    if (!hubSession.hasPermission(session, 'issues.manage') && !hubSession.hasPermission(session, 'clients.edit')) {
      sendJson(res, 403, { ok: false, error: 'ليست لديك صلاحية تحديث المشاكل' });
      return true;
    }
    const id = decodeURIComponent(parts[4]);
    const body = await readBody(req);
    const issue = store.issues.find((i) => i.id === id);
    if (!issue) {
      sendJson(res, 404, { ok: false, error: 'المشكلة غير موجودة' });
      return true;
    }
    if (body.status) issue.status = String(body.status).toUpperCase();
    if (body.assigned_admin_id) issue.assigned_admin_id = body.assigned_admin_id;
    if (body.note) {
      issue.notes = issue.notes || [];
      issue.notes.unshift({ at: new Date().toISOString(), by: session.email, note: String(body.note) });
    }
    issue.updated_at = new Date().toISOString();
    portal().writeStore(store);
    sendJson(res, 200, { ok: true, issue });
    return true;
  }

  if (pathname === '/api/admin/posha/notifications' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      notifications: store.adminNotifications.slice(0, 100),
      unread: store.adminNotifications.filter((n) => !n.is_read).length,
    });
    return true;
  }

  if (pathname === '/api/admin/posha/notifications/read' && req.method === 'POST') {
    const body = await readBody(req);
    if (body.all) store.adminNotifications.forEach((n) => { n.is_read = true; });
    else if (body.id) {
      const n = store.adminNotifications.find((x) => x.id === body.id);
      if (n) n.is_read = true;
    }
    portal().writeStore(store);
    sendJson(res, 200, { ok: true, unread: store.adminNotifications.filter((n) => !n.is_read).length });
    return true;
  }

  sendJson(res, 404, { ok: false, error: `Posha route not found: ${pathname}` });
  return true;
}

module.exports = {
  normalizeStore,
  emitEvent,
  createTicket,
  addTicketMessage,
  buildSummary,
  clientRow,
  nextOrderNumber,
  nextTicketNumber,
  handlePoshaAdminApi,
  EVENT_POLICY,
  uid,
};
