/**
 * POSHA Company Operating System — modules beyond CRM:
 * catalog, checkout workflow, service requests, complaints,
 * unified inbox, lifecycle/health, command center, automation hooks.
 * Single source: data/client-portal.json (shared with Client Portal).
 */
'use strict';

const crypto = require('crypto');
const hubSession = require('./hub-session');

function portal() {
  return require('./hub-client-portal');
}
function posha() {
  return require('./hub-posha-ops');
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Hub-Token, X-Hub-User-Role, X-Hub-User-Name, X-Hub-User-Email',
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

/** Canonical catalog — PRODUCT / SERVICE / SYSTEM / BUNDLE */
function catalog() {
  return [
    {
      id: 'sys-erp',
      sku: 'ERP',
      type: 'SYSTEM',
      name: 'نايوش إي آر بي',
      description: 'إدارة الموارد والمبيعات والمخزون',
      price: 199,
      currency: 'USD',
      plan: 'احترافي',
      category: 'systems',
      available: true,
    },
    {
      id: 'sys-crm',
      sku: 'CRM',
      type: 'SYSTEM',
      name: 'إدارة العملاء',
      description: 'فرص · عملاء · متابعة',
      price: 99,
      currency: 'USD',
      plan: 'أساسي',
      category: 'systems',
      available: true,
    },
    {
      id: 'sys-law',
      sku: 'LAW',
      type: 'SYSTEM',
      name: 'نايوش لو',
      description: 'إدارة الملفات القانونية',
      price: 149,
      currency: 'USD',
      plan: 'احترافي',
      category: 'systems',
      available: true,
    },
    {
      id: 'svc-consult',
      sku: 'CONSULT',
      type: 'SERVICE',
      name: 'استشارة تشغيلية',
      description: 'جلسة استشارة مع فريق نايوش',
      price: 50,
      currency: 'USD',
      category: 'services',
      available: true,
    },
    {
      id: 'svc-train',
      sku: 'TRAIN',
      type: 'SERVICE',
      name: 'تدريب فريق',
      description: 'ورشة إعداد وتشغيل',
      price: 120,
      currency: 'USD',
      category: 'services',
      available: true,
    },
    {
      id: 'prd-kit',
      sku: 'KIT',
      type: 'PRODUCT',
      name: 'حزمة تشغيل رقمية',
      description: 'قوالب وسياسات جاهزة',
      price: 39,
      currency: 'USD',
      category: 'products',
      available: true,
    },
    {
      id: 'bnd-starter',
      sku: 'STARTER',
      type: 'BUNDLE',
      name: 'باقة الانطلاق',
      description: 'CRM + استشارة تشغيلية',
      price: 129,
      currency: 'USD',
      plan: 'انطلاق',
      category: 'bundles',
      available: true,
      includes: [
        { sku: 'CRM', type: 'SYSTEM', name: 'إدارة العملاء', plan: 'أساسي' },
        { sku: 'CONSULT', type: 'SERVICE', name: 'استشارة تشغيلية' },
      ],
    },
  ];
}

function defaultOnboarding() {
  return {
    percent: 0,
    steps: [
      { id: 'approved', label: 'اعتماد الحساب', done: false },
      { id: 'company', label: 'بيانات الشركة', done: false },
      { id: 'payment', label: 'أول دفعة / رصيد', done: false },
      { id: 'system', label: 'تعيين نظام', done: false },
      { id: 'first_login', label: 'أول دخول', done: false },
      { id: 'go_live', label: 'الانطلاق', done: false },
    ],
  };
}

function syncOnboarding(client) {
  if (!client) return null;
  client.onboarding = client.onboarding || defaultOnboarding();
  const steps = client.onboarding.steps;
  const mark = (id, done) => {
    const s = steps.find((x) => x.id === id);
    if (s && done) s.done = true;
  };
  mark('approved', client.status === 'active' || client.status === 'approved');
  mark('company', !!(client.company && String(client.company).trim()));
  mark('payment', (client.wallet?.total || 0) > 0 || (client.invoices || []).some((i) => i.status === 'paid'));
  mark('system', (client.systems || []).some((s) => s.status === 'active'));
  mark('first_login', !!client.lastLoginAt);
  mark('go_live', (client.systems || []).some((s) => s.status === 'active') && client.status === 'active');
  const done = steps.filter((s) => s.done).length;
  client.onboarding.percent = Math.round((done / steps.length) * 100);
  return client.onboarding;
}

function persistLifecycle(client) {
  if (!client) return null;
  const lifecycle = computeLifecycle(client);
  const health = computeHealth(client);
  client.lifecycle = lifecycle;
  client.health = health;
  client.lifecycleUpdatedAt = new Date().toISOString();
  syncOnboarding(client);
  return { lifecycle, health };
}

function computeLifecycle(client) {
  if (!client) return 'REGISTERED';
  if (client.status === 'suspended') return 'SUSPENDED';
  if (client.status === 'churned') return 'CHURNED';
  if (client.status === 'pending') return 'PENDING_APPROVAL';
  const onboarding = syncOnboarding(client);
  const subs = client.subscriptions || [];
  const hasExpiring = subs.some(
    (s) =>
      ['EXPIRING', 'expiring'].includes(String(s.status || '')) ||
      (s.renewsAt && new Date(s.renewsAt) - Date.now() < 30 * 864e5 && new Date(s.renewsAt) > Date.now())
  );
  const hasExpired = subs.some(
    (s) =>
      ['EXPIRED', 'expired'].includes(String(s.status || '')) ||
      (s.renewsAt && new Date(s.renewsAt) < Date.now())
  );
  const openCritical = (client.tickets || []).some((t) =>
    ['URGENT', 'HIGH', 'urgent', 'high'].includes(String(t.priority || '')) &&
    !['RESOLVED', 'CLOSED', 'resolved', 'closed'].includes(String(t.status || ''))
  );
  const unpaid = (client.invoices || []).some((i) => i.status === 'overdue');
  const openComplaints = (client.complaints || []).some(
    (c) => !['RESOLVED', 'CLOSED'].includes(String(c.status || '').toUpperCase())
  );
  if (unpaid || openCritical || openComplaints) return 'AT_RISK';
  if (hasExpired || hasExpiring) return 'RENEWAL_DUE';
  if (
    (client.systems || []).some((s) => s.status === 'under_setup') ||
    (onboarding && onboarding.percent < 100 && client.status === 'active')
  ) {
    return 'ONBOARDING';
  }
  if ((client.systems || []).length || (client.orders || []).some((o) => ['completed', 'COMPLETED'].includes(o.status))) {
    return 'ACTIVE';
  }
  if (client.status === 'active' && client.createdAt && Date.now() - new Date(client.createdAt).getTime() < 7 * 864e5) {
    return 'APPROVED';
  }
  return client.status === 'active' ? 'ACTIVE' : 'REGISTERED';
}

function computeHealth(client) {
  const reasons = [];
  let score = 100;
  const unpaid = (client.invoices || []).filter((i) => i.status === 'unpaid' || i.status === 'overdue');
  if (unpaid.some((i) => i.status === 'overdue')) {
    score -= 30;
    reasons.push('فواتير متأخرة');
  } else if (unpaid.length) {
    score -= 15;
    reasons.push('فواتير غير مدفوعة');
  }
  const urgent = (client.tickets || []).filter(
    (t) =>
      ['URGENT', 'HIGH'].includes(String(t.priority || '').toUpperCase()) &&
      !['RESOLVED', 'CLOSED'].includes(String(t.status || '').toUpperCase())
  );
  if (urgent.length) {
    score -= 25;
    reasons.push('تذاكر دعم عاجلة مفتوحة');
  }
  const expired = (client.subscriptions || []).filter(
    (s) => s.status === 'expired' || (s.renewsAt && new Date(s.renewsAt) < Date.now())
  );
  if (expired.length) {
    score -= 20;
    reasons.push('اشتراكات منتهية');
  }
  if (client.status === 'suspended') {
    score = Math.min(score, 20);
    reasons.push('الحساب موقوف');
  }
  let label = 'EXCELLENT';
  if (score < 40) label = 'AT_RISK';
  else if (score < 60) label = 'NEEDS_ATTENTION';
  else if (score < 80) label = 'GOOD';
  return { label, score: Math.max(0, score), reasons };
}

function ensureOsArrays(store) {
  posha().normalizeStore(store);
  const base = catalog();
  if (!Array.isArray(store.catalog) || !store.catalog.length) {
    store.catalog = base;
  } else {
    const have = new Set(store.catalog.map((c) => c.id));
    for (const item of base) {
      if (!have.has(item.id)) store.catalog.push(item);
    }
  }
  store.inbox = Array.isArray(store.inbox) ? store.inbox : [];
  store.tasks = Array.isArray(store.tasks) ? store.tasks : [];
  store.automations = Array.isArray(store.automations) ? store.automations : [];
  store.meta = store.meta || {};
  if (store.meta.slaUrgentHours == null) store.meta.slaUrgentHours = 2;
  return store;
}

function pushInbox(store, item) {
  store.inbox = store.inbox || [];
  store.inbox.unshift({
    id: uid('inbox'),
    status: 'NEW',
    assigned_to: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...item,
  });
  store.inbox = store.inbox.slice(0, 500);
}

function createServiceRequest(store, client, payload, session) {
  ensureOsArrays(store);
  const number = `REQ-${Date.now().toString().slice(-6)}`;
  const reqItem = {
    id: uid('req'),
    number,
    client_id: client.clientId,
    clientEmail: client.email,
    type: String(payload.type || payload.kind || 'OTHER').toUpperCase(),
    subject: String(payload.subject || payload.title || '').trim(),
    message: String(payload.message || payload.body || '').trim(),
    related_system: String(payload.systemCode || payload.system || '').toUpperCase(),
    priority: String(payload.priority || 'NORMAL').toUpperCase(),
    status: 'NEW',
    assigned_to: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    timeline: [{ at: new Date().toISOString(), label: 'تم استلام الطلب', by: session.email }],
  };
  client.serviceRequests = client.serviceRequests || [];
  client.serviceRequests.unshift(reqItem);
  pushInbox(store, {
    kind: 'SERVICE_REQUEST',
    title: reqItem.subject,
    clientEmail: client.email,
    clientName: client.name,
    priority: reqItem.priority,
    related_entity_type: 'request',
    related_entity_id: reqItem.id,
    ref: number,
  });
  posha().emitEvent(store, {
    type: 'REQUEST_CREATED',
    clientEmail: client.email,
    actorId: session.email,
    actorRole: 'client',
    title: `طلب خدمة ${number}`,
    message: reqItem.subject,
    metadata: { requestId: reqItem.id },
    forceAdmin: true,
  });
  // Auto task for staff
  store.tasks.unshift({
    id: uid('task'),
    title: `متابعة طلب ${number}`,
    description: reqItem.subject,
    assigned_to: null,
    created_by: 'automation',
    related_client: client.email,
    related_entity: reqItem.id,
    priority: reqItem.priority === 'URGENT' ? 'HIGH' : 'NORMAL',
    due_date: new Date(Date.now() + 2 * 864e5).toISOString(),
    status: 'OPEN',
    created_at: new Date().toISOString(),
  });
  return reqItem;
}

function createComplaint(store, client, payload, session) {
  ensureOsArrays(store);
  const number = `CMP-${Date.now().toString().slice(-6)}`;
  const item = {
    id: uid('cmp'),
    number,
    client_id: client.clientId,
    clientEmail: client.email,
    category: String(payload.category || 'عام'),
    subject: String(payload.subject || payload.title || '').trim(),
    message: String(payload.message || payload.body || '').trim(),
    related_system: String(payload.systemCode || payload.system || '').toUpperCase(),
    priority: String(payload.priority || 'NORMAL').toUpperCase(),
    status: 'OPEN',
    assigned_to: null,
    resolution: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    timeline: [{ at: new Date().toISOString(), label: 'تم فتح الشكوى', by: session.email }],
  };
  client.complaints = client.complaints || [];
  client.complaints.unshift(item);
  pushInbox(store, {
    kind: 'COMPLAINT',
    title: item.subject,
    clientEmail: client.email,
    clientName: client.name,
    priority: item.priority === 'URGENT' ? 'URGENT' : item.priority,
    related_entity_type: 'complaint',
    related_entity_id: item.id,
    ref: number,
  });
  posha().emitEvent(store, {
    type: 'COMPLAINT_CREATED',
    clientEmail: client.email,
    actorId: session.email,
    actorRole: 'client',
    title: `شكوى ${number}`,
    message: item.subject,
    metadata: { complaintId: item.id },
    forceAdmin: true,
    forceIssue: item.priority === 'URGENT' || item.priority === 'HIGH',
    issueSeverity: item.priority === 'URGENT' ? 'CRITICAL' : 'HIGH',
  });
  return item;
}

/**
 * Commerce checkout — Order → Invoice → (optional wallet pay) → Subscription/Activation
 */
function checkout(store, client, payload, session) {
  ensureOsArrays(store);
  const itemsIn = Array.isArray(payload.items) ? payload.items : [];
  const cat = store.catalog.length ? store.catalog : catalog();
  const lines = [];
  for (const raw of itemsIn) {
    const found = cat.find((c) => c.id === raw.id || c.sku === raw.sku || c.sku === raw.code);
    if (!found || found.available === false) continue;
    const qty = Math.max(1, Number(raw.qty || 1));
    lines.push({
      id: found.id,
      sku: found.sku,
      type: found.type,
      name: found.name,
      unitPrice: found.price,
      qty,
      total: found.price * qty,
      plan: found.plan || '',
    });
  }
  if (!lines.length) {
    const err = new Error('لا توجد عناصر صالحة في السلة');
    err.status = 400;
    throw err;
  }
  const total = lines.reduce((s, l) => s + l.total, 0);
  const number = posha().nextOrderNumber(store);
  const order = {
    id: uid('ord'),
    number,
    client_id: client.clientId,
    clientEmail: client.email,
    items: lines,
    service: lines.map((l) => l.name).join(' · '),
    subtotal: total,
    discount: 0,
    tax: 0,
    amount: total,
    total,
    currency: 'USD',
    payment_status: 'UNPAID',
    fulfillment_status: 'PENDING',
    status: 'PENDING',
    date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    timeline: [{ at: new Date().toISOString(), label: 'تم إنشاء الطلب من المتجر', status: 'done' }],
  };
  client.orders = client.orders || [];
  client.orders.unshift(order);

  const invNumber = `INV-${Date.now().toString().slice(-6)}`;
  const invoice = {
    id: uid('inv'),
    number: invNumber,
    orderId: order.id,
    amount: total,
    currency: order.currency,
    date: new Date().toISOString(),
    status: 'unpaid',
    dueAt: new Date(Date.now() + 7 * 864e5).toISOString(),
  };
  client.invoices = client.invoices || [];
  client.invoices.unshift(invoice);

  posha().emitEvent(store, {
    type: 'ORDER_CREATED',
    clientEmail: client.email,
    actorId: session.email,
    actorRole: 'client',
    title: `طلب متجر ${number}`,
    message: order.service,
    metadata: { orderId: order.id },
  });
  posha().emitEvent(store, {
    type: 'INVOICE_CREATED',
    clientEmail: client.email,
    actorId: 'system',
    actorRole: 'system',
    title: `فاتورة ${invNumber}`,
    message: `${total} ${order.currency}`,
    metadata: { invoiceId: invoice.id, orderId: order.id },
    forceClient: true,
  });

  const payWithWallet = !!payload.payWithWallet;
  let payment = null;
  if (payWithWallet) {
    payment = payInvoiceFromWallet(store, client, invoice, session);
    if (payment.ok) {
      fulfillPaidOrder(store, client, order, session);
    }
  } else {
    order.status = 'AWAITING_PAYMENT';
    order.timeline.push({ at: new Date().toISOString(), label: 'بانتظار الدفع', status: 'current' });
  }

  pushInbox(store, {
    kind: 'ORDER',
    title: `طلب ${number}`,
    clientEmail: client.email,
    clientName: client.name,
    priority: 'NORMAL',
    related_entity_type: 'order',
    related_entity_id: order.id,
    ref: number,
  });

  return { order, invoice, payment };
}

function debitWallet(wallet, amount, note, reference) {
  const w = wallet || { paid: 0, free: 0, total: 0, ledger: [] };
  const need = Number(amount || 0);
  const total = (Number(w.paid) || 0) + (Number(w.free) || 0);
  if (total < need) return { ok: false, wallet: w, error: 'رصيد المحفظة غير كافٍ' };
  let left = need;
  const fromFree = Math.min(Number(w.free) || 0, left);
  w.free = (Number(w.free) || 0) - fromFree;
  left -= fromFree;
  if (left > 0) w.paid = Math.max(0, (Number(w.paid) || 0) - left);
  w.total = (Number(w.paid) || 0) + (Number(w.free) || 0);
  w.ledger = Array.isArray(w.ledger) ? w.ledger : [];
  w.ledger.unshift({
    id: uid('led'),
    at: new Date().toISOString(),
    type: 'debit',
    amount: need,
    note: note || 'خصم',
    reference: reference || null,
  });
  return { ok: true, wallet: w };
}

function payInvoiceFromWallet(store, client, invoice, session) {
  const amount = Number(invoice.amount || 0);
  const debited = debitWallet(client.wallet, amount, `دفع فاتورة ${invoice.number}`, invoice.id);
  if (!debited.ok) {
    posha().emitEvent(store, {
      type: 'PAYMENT_FAILED',
      clientEmail: client.email,
      actorId: session.email,
      actorRole: 'client',
      title: `فشل دفع ${invoice.number}`,
      message: 'رصيد المحفظة غير كافٍ',
      metadata: { invoiceId: invoice.id },
      forceIssue: true,
      issueSeverity: 'HIGH',
    });
    return { ok: false, error: debited.error };
  }
  client.wallet = debited.wallet;
  invoice.status = 'paid';
  posha().emitEvent(store, {
    type: 'PAYMENT_SUCCEEDED',
    clientEmail: client.email,
    actorId: session.email,
    actorRole: 'client',
    title: `تم دفع ${invoice.number}`,
    message: `${amount}`,
    metadata: { invoiceId: invoice.id, orderId: invoice.orderId },
  });
  posha().emitEvent(store, {
    type: 'WALLET_DEBITED',
    clientEmail: client.email,
    actorId: session.email,
    actorRole: 'client',
    title: `خصم محفظة ${amount}`,
    message: `فاتورة ${invoice.number}`,
    metadata: { invoiceId: invoice.id },
  });
  return { ok: true, wallet: client.wallet };
}

function fulfillPaidOrder(store, client, order, session) {
  order.payment_status = 'PAID';
  order.status = 'IN_PROGRESS';
  order.timeline = order.timeline || [];
  order.timeline.push({ at: new Date().toISOString(), label: 'تم الدفع — بدء التنفيذ', status: 'done' });

  // Expand BUNDLE lines into SYSTEM/SERVICE/PRODUCT children for fulfillment
  const expandLines = [];
  for (const line of order.items || []) {
    if (line.type === 'BUNDLE') {
      const cat = (store.catalog && store.catalog.length ? store.catalog : catalog()).find(
        (c) => c.id === line.id || c.sku === line.sku
      );
      const includes = (cat && cat.includes) || line.includes || [];
      for (const inc of includes) {
        expandLines.push({
          id: inc.sku || inc.id,
          sku: inc.sku || inc.id,
          type: inc.type,
          name: inc.name || inc.sku,
          unitPrice: 0,
          qty: line.qty || 1,
          total: 0,
          plan: inc.plan || line.plan || '',
          fromBundle: line.sku,
        });
      }
      if (!includes.length) expandLines.push(line);
    } else {
      expandLines.push(line);
    }
  }

  for (const line of expandLines) {
    if (line.type === 'SYSTEM') {
      const code = line.sku;
      let sys = (client.systems || []).find((s) => s.code === code);
      if (!sys) {
        sys = {
          id: uid('sys'),
          code,
          name: line.name,
          description: '',
          logo: 'assets/logo-hub.jpeg',
          status: 'active',
          plan: line.plan || 'أساسي',
          activatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 365 * 864e5).toISOString(),
          url: `systems/${String(code).toLowerCase()}.html`,
        };
        client.systems = client.systems || [];
        client.systems.unshift(sys);
        posha().emitEvent(store, {
          type: 'SYSTEM_ASSIGNED',
          clientEmail: client.email,
          actorId: 'automation',
          actorRole: 'system',
          title: `تم تعيين نظام ${sys.name}`,
          message: 'ظهر في أنظمتي',
          metadata: { systemCode: code, orderId: order.id },
        });
      } else {
        sys.status = 'active';
        posha().emitEvent(store, {
          type: 'SYSTEM_ACTIVATED',
          clientEmail: client.email,
          actorId: 'automation',
          actorRole: 'system',
          title: `تم تفعيل ${sys.name}`,
          message: 'نظامك نشط',
          metadata: { systemCode: code },
        });
      }
      client.subscriptions = client.subscriptions || [];
      if (!client.subscriptions.some((s) => s.systemCode === code && ['active', 'ACTIVE', 'EXPIRING'].includes(String(s.status)))) {
        client.subscriptions.unshift({
          id: uid('sub'),
          systemCode: code,
          systemName: line.name,
          plan: line.plan || 'أساسي',
          price: line.unitPrice,
          startedAt: new Date().toISOString(),
          renewsAt: new Date(Date.now() + 365 * 864e5).toISOString(),
          status: 'active',
          autoRenew: false,
          orderId: order.id,
        });
        posha().emitEvent(store, {
          type: 'SUBSCRIPTION_CREATED',
          clientEmail: client.email,
          actorId: 'automation',
          actorRole: 'system',
          title: `اشتراك ${line.name}`,
          message: line.plan || '',
          metadata: { systemCode: code, orderId: order.id },
        });
      }
    } else if (line.type === 'SERVICE') {
      createServiceRequest(
        store,
        client,
        {
          type: 'SERVICE_FULFILLMENT',
          subject: `تنفيذ خدمة: ${line.name}`,
          message: `طلب مرتبط بالطلب ${order.number}`,
          priority: 'NORMAL',
        },
        session
      );
    }
  }

  const systemLines = expandLines.filter((l) => l.type === 'SYSTEM');
  const allSystems =
    !systemLines.length ||
    systemLines.every((l) => (client.systems || []).some((s) => s.code === l.sku && s.status === 'active'));
  if (allSystems) {
    order.status = 'COMPLETED';
    order.fulfillment_status = 'COMPLETED';
    order.timeline.push({ at: new Date().toISOString(), label: 'اكتمل التنفيذ', status: 'done' });
    posha().emitEvent(store, {
      type: 'ORDER_COMPLETED',
      clientEmail: client.email,
      actorId: session.email || 'automation',
      actorRole: session.role || 'system',
      title: `اكتمل الطلب ${order.number}`,
      message: order.service || '',
      metadata: { orderId: order.id },
    });
  }
  persistLifecycle(client);
  return order;
}

function commandCenter(store) {
  ensureOsArrays(store);
  const clients = Object.values(store.clients || {});
  const summary = posha().buildSummary(store);
  const renewals = [];
  clients.forEach((c) => {
    (c.subscriptions || []).forEach((s) => {
      if (
        ['EXPIRING', 'expiring', 'EXPIRED', 'expired'].includes(String(s.status || '')) ||
        (s.renewsAt && new Date(s.renewsAt) - Date.now() < 30 * 864e5)
      ) {
        renewals.push({
          clientEmail: c.email,
          clientName: c.name,
          systemName: s.systemName,
          renewsAt: s.renewsAt,
          status: s.status,
          subscriptionId: s.id,
        });
      }
    });
  });
  const pendingApproval = clients.filter((c) => c.status === 'pending').slice(0, 20);
  return {
    summary,
    pendingOrders: clients.flatMap((c) =>
      (c.orders || [])
        .filter((o) => ['PENDING', 'pending', 'pending_review', 'AWAITING_PAYMENT', 'IN_PROGRESS', 'in_progress'].includes(o.status))
        .map((o) => ({ ...o, clientEmail: c.email, clientName: c.name }))
    ).slice(0, 20),
    openTickets: clients.flatMap((c) =>
      (c.tickets || [])
        .filter((t) => !['RESOLVED', 'CLOSED', 'resolved', 'closed'].includes(String(t.status)))
        .map((t) => ({ ...t, clientEmail: c.email, clientName: c.name }))
    ).slice(0, 20),
    inboxNew: (store.inbox || []).filter((i) => i.status === 'NEW').slice(0, 20),
    openIssues: (store.issues || []).filter((i) => i.status === 'OPEN' || i.status === 'INVESTIGATING').slice(0, 20),
    renewals: renewals.slice(0, 20),
    overdueTasks: (store.tasks || []).filter((t) => t.status !== 'DONE' && t.due_date && new Date(t.due_date) < Date.now()).slice(0, 20),
    newClients: clients.filter((c) => c.isNew || (c.createdAt && Date.now() - new Date(c.createdAt).getTime() < 7 * 864e5)).slice(0, 10),
    pendingApproval,
    slaBreaches: (store.issues || []).filter((i) => i.type === 'SLA_BREACHED' && i.status !== 'RESOLVED').slice(0, 10),
  };
}

function enrichClientRow(c) {
  const persisted = persistLifecycle(c);
  const base = posha().clientRow(c);
  return {
    ...base,
    lifecycle: persisted.lifecycle,
    health: persisted.health.label,
    healthScore: persisted.health.score,
    healthReasons: persisted.health.reasons,
    onboardingPercent: (c.onboarding && c.onboarding.percent) || 0,
    openRequests: (c.serviceRequests || []).filter((r) => !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(r.status)).length,
    openComplaints: (c.complaints || []).filter((x) => x.status !== 'RESOLVED' && x.status !== 'CLOSED').length,
  };
}

/**
 * Idempotent subscription expiry sweep — Journey D
 */
function runSubscriptionExpirySweep(store) {
  ensureOsArrays(store);
  const now = Date.now();
  const windowMs = 14 * 864e5;
  let changed = 0;
  const hits = [];
  for (const client of Object.values(store.clients || {})) {
    for (const sub of client.subscriptions || []) {
      if (!sub.renewsAt) continue;
      const renewMs = new Date(sub.renewsAt).getTime();
      if (Number.isNaN(renewMs)) continue;

      if (renewMs < now && !['EXPIRED', 'expired', 'CANCELLED', 'cancelled'].includes(String(sub.status))) {
        sub.status = 'EXPIRED';
        sub.expiredAt = new Date().toISOString();
        const sys = (client.systems || []).find((s) => s.code === sub.systemCode);
        if (sys && sys.status === 'active') sys.status = 'expired';
        posha().emitEvent(store, {
          type: 'SUBSCRIPTION_EXPIRED',
          clientEmail: client.email,
          actorId: 'scheduler',
          actorRole: 'system',
          title: `انتهى اشتراك ${sub.systemName}`,
          message: 'يلزم التجديد لاستعادة الوصول',
          metadata: { subscriptionId: sub.id, systemCode: sub.systemCode },
          forceIssue: true,
          issueSeverity: 'HIGH',
        });
        // Follow-up task
        store.tasks.unshift({
          id: uid('task'),
          title: `متابعة تجديد ${sub.systemName}`,
          description: `اشتراك منتهٍ للعميل ${client.email}`,
          assigned_to: null,
          created_by: 'automation',
          related_client: client.email,
          related_entity: sub.id,
          priority: 'HIGH',
          due_date: new Date(Date.now() + 864e5).toISOString(),
          status: 'OPEN',
          created_at: new Date().toISOString(),
        });
        persistLifecycle(client);
        changed += 1;
        hits.push({ email: client.email, sub: sub.id, kind: 'EXPIRED' });
        continue;
      }

      if (
        renewMs >= now &&
        renewMs - now < windowMs &&
        ['active', 'ACTIVE', 'EXPIRING', 'expiring'].includes(String(sub.status || 'active'))
      ) {
        if (sub.expiryNotifiedAt) continue;
        sub.status = 'EXPIRING';
        sub.expiryNotifiedAt = new Date().toISOString();
        posha().emitEvent(store, {
          type: 'SUBSCRIPTION_EXPIRING',
          clientEmail: client.email,
          actorId: 'scheduler',
          actorRole: 'system',
          title: `اشتراك ${sub.systemName} يقترب من الانتهاء`,
          message: `التجديد في ${sub.renewsAt}`,
          metadata: { subscriptionId: sub.id, systemCode: sub.systemCode, renewsAt: sub.renewsAt },
          forceIssue: true,
          issueSeverity: 'WARNING',
        });
        persistLifecycle(client);
        changed += 1;
        hits.push({ email: client.email, sub: sub.id, kind: 'EXPIRING' });
      }
    }
  }
  return { changed, hits };
}

/** Lightweight SLA: urgent tickets unanswered > 2h */
function runSlaSweep(store) {
  ensureOsArrays(store);
  const limitMs = (store.meta && store.meta.slaUrgentHours ? Number(store.meta.slaUrgentHours) : 2) * 3600e3;
  let changed = 0;
  for (const client of Object.values(store.clients || {})) {
    for (const ticket of client.tickets || []) {
      const pri = String(ticket.priority || '').toUpperCase();
      if (!['URGENT', 'HIGH'].includes(pri)) continue;
      if (['RESOLVED', 'CLOSED', 'resolved', 'closed'].includes(String(ticket.status))) continue;
      if (ticket.slaBreachedAt) continue;
      const created = new Date(ticket.createdAt || ticket.created_at || 0).getTime();
      if (!created || Date.now() - created < limitMs) continue;
      const msgs = ticket.messages || [];
      const staffReplied = msgs.some((m) => m.byRole === 'admin' || m.byRole === 'staff' || m.sender === 'admin');
      if (staffReplied) continue;
      ticket.slaBreachedAt = new Date().toISOString();
      posha().emitEvent(store, {
        type: 'SLA_BREACHED',
        clientEmail: client.email,
        actorId: 'scheduler',
        actorRole: 'system',
        title: `خرق SLA — تذكرة ${ticket.number || ticket.id}`,
        message: ticket.subject || '',
        metadata: { ticketId: ticket.id, code: 'SLA_BREACHED' },
        forceIssue: true,
        issueSeverity: pri === 'URGENT' ? 'CRITICAL' : 'HIGH',
      });
      changed += 1;
    }
  }
  // Overdue tasks
  for (const task of store.tasks || []) {
    if (task.status === 'DONE' || task.overdueNotified) continue;
    if (task.due_date && new Date(task.due_date) < Date.now()) {
      task.overdueNotified = true;
      posha().emitEvent(store, {
        type: 'TASK_OVERDUE',
        clientEmail: task.related_client || null,
        actorId: 'scheduler',
        actorRole: 'system',
        title: `مهمة متأخرة: ${task.title}`,
        message: task.description || '',
        metadata: { taskId: task.id },
        forceIssue: true,
        issueSeverity: 'WARNING',
      });
      changed += 1;
    }
  }
  return { changed };
}

function renewSubscription(store, client, subscriptionId, session) {
  const sub = (client.subscriptions || []).find((s) => s.id === subscriptionId || s.systemCode === subscriptionId);
  if (!sub) {
    const err = new Error('الاشتراك غير موجود');
    err.status = 404;
    throw err;
  }
  const price = Number(sub.price || 0);
  const invNumber = `INV-${Date.now().toString().slice(-6)}`;
  const invoice = {
    id: uid('inv'),
    number: invNumber,
    orderId: null,
    subscriptionId: sub.id,
    amount: price,
    currency: 'USD',
    date: new Date().toISOString(),
    status: 'unpaid',
    dueAt: new Date(Date.now() + 3 * 864e5).toISOString(),
  };
  client.invoices = client.invoices || [];
  client.invoices.unshift(invoice);
  posha().emitEvent(store, {
    type: 'INVOICE_CREATED',
    clientEmail: client.email,
    actorId: session.email,
    actorRole: 'client',
    title: `فاتورة تجديد ${invNumber}`,
    message: `${sub.systemName} · ${price}`,
    metadata: { invoiceId: invoice.id, subscriptionId: sub.id },
    forceClient: true,
  });
  const payment = payInvoiceFromWallet(store, client, invoice, session);
  if (!payment.ok) {
    return { ok: false, invoice, payment, error: payment.error };
  }
  sub.status = 'active';
  sub.renewsAt = new Date(Date.now() + 365 * 864e5).toISOString();
  sub.expiryNotifiedAt = null;
  sub.lastRenewedAt = new Date().toISOString();
  const sys = (client.systems || []).find((s) => s.code === sub.systemCode);
  if (sys) {
    sys.status = 'active';
    sys.expiresAt = sub.renewsAt;
  }
  posha().emitEvent(store, {
    type: 'SUBSCRIPTION_RENEWED',
    clientEmail: client.email,
    actorId: session.email,
    actorRole: 'client',
    title: `تجديد اشتراك ${sub.systemName}`,
    message: `حتى ${sub.renewsAt}`,
    metadata: { subscriptionId: sub.id, invoiceId: invoice.id },
  });
  persistLifecycle(client);
  return { ok: true, subscription: sub, invoice, payment };
}

function globalSearch(store, q) {
  const query = String(q || '').trim().toLowerCase();
  if (!query) return { clients: [], orders: [], tickets: [], invoices: [], subscriptions: [], requests: [] };
  const clients = [];
  const orders = [];
  const tickets = [];
  const invoices = [];
  const subscriptions = [];
  const requests = [];
  const ordMatch = query.match(/^#?ord[-_]?(\w+)/i);
  for (const c of Object.values(store.clients || {})) {
    const hay = `${c.email} ${c.name} ${c.clientId} ${c.company || ''}`.toLowerCase();
    if (hay.includes(query) || (c.clientId && String(c.clientId).toLowerCase() === query)) {
      clients.push({ email: c.email, name: c.name, clientId: c.clientId, status: c.status });
    }
    for (const o of c.orders || []) {
      if (
        String(o.number || '').toLowerCase().includes(query.replace(/^#/, '')) ||
        String(o.id).toLowerCase() === query ||
        (ordMatch && String(o.number || '').toLowerCase().includes(ordMatch[1].toLowerCase()))
      ) {
        orders.push({ ...o, clientEmail: c.email, clientName: c.name });
      }
    }
    for (const t of c.tickets || []) {
      if (
        String(t.number || '').toLowerCase().includes(query.replace(/^#/, '')) ||
        String(t.subject || '').toLowerCase().includes(query) ||
        String(t.id) === query
      ) {
        tickets.push({ id: t.id, number: t.number, subject: t.subject, status: t.status, clientEmail: c.email });
      }
    }
    for (const inv of c.invoices || []) {
      if (String(inv.number || '').toLowerCase().includes(query.replace(/^#/, '')) || String(inv.id) === query) {
        invoices.push({ ...inv, clientEmail: c.email });
      }
    }
    for (const s of c.subscriptions || []) {
      if (String(s.systemName || '').toLowerCase().includes(query) || String(s.id) === query) {
        subscriptions.push({ ...s, clientEmail: c.email });
      }
    }
    for (const r of c.serviceRequests || []) {
      if (String(r.number || '').toLowerCase().includes(query.replace(/^#/, '')) || String(r.subject || '').toLowerCase().includes(query)) {
        requests.push({ ...r, clientEmail: c.email });
      }
    }
  }
  return {
    clients: clients.slice(0, 20),
    orders: orders.slice(0, 20),
    tickets: tickets.slice(0, 20),
    invoices: invoices.slice(0, 20),
    subscriptions: subscriptions.slice(0, 20),
    requests: requests.slice(0, 20),
  };
}

function buildReports(store) {
  ensureOsArrays(store);
  const clients = Object.values(store.clients || {});
  const orders = clients.flatMap((c) => c.orders || []);
  const invoices = clients.flatMap((c) => c.invoices || []);
  const tickets = clients.flatMap((c) => c.tickets || []);
  const paid = invoices.filter((i) => i.status === 'paid');
  const revenue = paid.reduce((s, i) => s + Number(i.amount || 0), 0);
  return {
    clients: {
      total: clients.length,
      active: clients.filter((c) => c.status === 'active').length,
      pending: clients.filter((c) => c.status === 'pending').length,
      suspended: clients.filter((c) => c.status === 'suspended').length,
    },
    orders: {
      total: orders.length,
      completed: orders.filter((o) => ['COMPLETED', 'completed'].includes(o.status)).length,
      pending: orders.filter((o) => !['COMPLETED', 'completed', 'CANCELLED', 'cancelled', 'REJECTED', 'rejected'].includes(o.status)).length,
    },
    revenue: { paidInvoices: paid.length, total: revenue, currency: 'USD' },
    subscriptions: {
      active: clients.reduce((n, c) => n + (c.subscriptions || []).filter((s) => String(s.status).toLowerCase() === 'active').length, 0),
      expiring: clients.reduce((n, c) => n + (c.subscriptions || []).filter((s) => String(s.status).toUpperCase() === 'EXPIRING').length, 0),
      expired: clients.reduce((n, c) => n + (c.subscriptions || []).filter((s) => String(s.status).toUpperCase() === 'EXPIRED').length, 0),
    },
    support: {
      open: tickets.filter((t) => !['RESOLVED', 'CLOSED', 'resolved', 'closed'].includes(String(t.status))).length,
      resolved: tickets.filter((t) => ['RESOLVED', 'CLOSED', 'resolved', 'closed'].includes(String(t.status))).length,
    },
    wallet: {
      totalBalance: clients.reduce((n, c) => n + Number(c.wallet?.total || 0), 0),
    },
    tasks: {
      open: (store.tasks || []).filter((t) => t.status !== 'DONE').length,
      overdue: (store.tasks || []).filter((t) => t.status !== 'DONE' && t.due_date && new Date(t.due_date) < Date.now()).length,
    },
    issues: {
      open: (store.issues || []).filter((i) => i.status === 'OPEN' || i.status === 'INVESTIGATING').length,
    },
  };
}

let _schedulersStarted = false;
function startPoshaSchedulers() {
  if (_schedulersStarted) return;
  _schedulersStarted = true;
  const tick = () => {
    try {
      const store = ensureOsArrays(portal().readStore());
      const a = runSubscriptionExpirySweep(store);
      const b = runSlaSweep(store);
      if (a.changed || b.changed) portal().writeStore(store);
      if (a.changed || b.changed) {
        console.log(`[POSHA] sweep: subs=${a.changed} sla=${b.changed}`);
      }
    } catch (e) {
      console.error('[POSHA] scheduler error:', e.message);
    }
  };
  // Run shortly after boot, then hourly
  setTimeout(tick, 5000);
  setInterval(tick, 60 * 60 * 1000);
}

async function handlePoshaOsApi(req, res, pathname) {
  if (!pathname.startsWith('/api/admin/posha/os') && !pathname.startsWith('/api/posha')) return false;
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return true;
  }

  // Public catalog for authenticated clients also served under /api/posha/catalog via client handler preferably
  if (pathname === '/api/posha/catalog' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, items: catalog() });
    return true;
  }

  if (!pathname.startsWith('/api/admin/posha/os')) return false;

  let session;
  try {
    session = hubSession.requireStaff(req, 'clients.view');
  } catch (err) {
    sendJson(res, err.status || 403, { ok: false, error: err.message });
    return true;
  }

  const store = ensureOsArrays(portal().readStore());
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);

  if (pathname === '/api/admin/posha/os/command' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, command: commandCenter(store) });
    return true;
  }

  if (pathname === '/api/admin/posha/os/clients' && req.method === 'GET') {
    const list = Object.values(store.clients || {}).map(enrichClientRow);
    sendJson(res, 200, { ok: true, clients: list, summary: posha().buildSummary(store) });
    return true;
  }

  if (pathname === '/api/admin/posha/os/catalog' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, items: store.catalog });
    return true;
  }

  if (pathname === '/api/admin/posha/os/inbox' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, inbox: store.inbox || [] });
    return true;
  }

  if (parts[4] === 'inbox' && parts[5] && parts[6] === 'assign' && req.method === 'POST') {
    const body = await readBody(req);
    const item = (store.inbox || []).find((i) => i.id === parts[5]);
    if (!item) {
      sendJson(res, 404, { ok: false, error: 'العنصر غير موجود' });
      return true;
    }
    item.assigned_to = body.assigned_to || session.email;
    item.status = body.status || 'ASSIGNED';
    item.updated_at = new Date().toISOString();
    portal().writeStore(store);
    sendJson(res, 200, { ok: true, item });
    return true;
  }

  if (pathname === '/api/admin/posha/os/requests' && req.method === 'GET') {
    const list = Object.values(store.clients || {}).flatMap((c) =>
      (c.serviceRequests || []).map((r) => ({ ...r, clientName: c.name }))
    );
    sendJson(res, 200, { ok: true, requests: list });
    return true;
  }

  if (parts[4] === 'requests' && parts[5] && parts[6] === 'status' && req.method === 'POST') {
    if (!hubSession.hasPermission(session, 'orders.update') && !hubSession.hasPermission(session, 'clients.edit')) {
      sendJson(res, 403, { ok: false, error: 'ليست لديك صلاحية' });
      return true;
    }
    const body = await readBody(req);
    let found = null;
    let owner = null;
    for (const c of Object.values(store.clients || {})) {
      const r = (c.serviceRequests || []).find((x) => x.id === parts[5] || x.number === parts[5]);
      if (r) {
        found = r;
        owner = c;
        break;
      }
    }
    if (!found) {
      sendJson(res, 404, { ok: false, error: 'الطلب غير موجود' });
      return true;
    }
    const prev = found.status;
    found.status = String(body.status || found.status).toUpperCase();
    found.updated_at = new Date().toISOString();
    found.timeline = found.timeline || [];
    found.timeline.push({ at: found.updated_at, label: `${prev} → ${found.status}`, by: session.email });
    posha().emitEvent(store, {
      type: 'REQUEST_STATUS_CHANGED',
      clientEmail: owner.email,
      actorId: session.email,
      actorRole: 'admin',
      title: `تحديث طلب ${found.number}`,
      message: found.status,
      metadata: { requestId: found.id },
      forceClient: true,
    });
    portal().writeStore(store);
    sendJson(res, 200, { ok: true, request: found });
    return true;
  }

  if (pathname === '/api/admin/posha/os/complaints' && req.method === 'GET') {
    const list = Object.values(store.clients || {}).flatMap((c) =>
      (c.complaints || []).map((r) => ({ ...r, clientName: c.name }))
    );
    sendJson(res, 200, { ok: true, complaints: list });
    return true;
  }

  if (parts[4] === 'complaints' && parts[5] && parts[6] === 'status' && req.method === 'POST') {
    if (!hubSession.hasPermission(session, 'orders.update') && !hubSession.hasPermission(session, 'clients.edit')) {
      sendJson(res, 403, { ok: false, error: 'ليست لديك صلاحية' });
      return true;
    }
    const body = await readBody(req);
    let found = null;
    let owner = null;
    for (const c of Object.values(store.clients || {})) {
      const r = (c.complaints || []).find((x) => x.id === parts[5] || x.number === parts[5]);
      if (r) {
        found = r;
        owner = c;
        break;
      }
    }
    if (!found) {
      sendJson(res, 404, { ok: false, error: 'الشكوى غير موجودة' });
      return true;
    }
    const prev = found.status;
    found.status = String(body.status || found.status).toUpperCase();
    found.resolution = body.resolution != null ? String(body.resolution) : found.resolution;
    found.updated_at = new Date().toISOString();
    found.timeline = found.timeline || [];
    found.timeline.push({ at: found.updated_at, label: `${prev} → ${found.status}`, by: session.email });
    // Sync inbox item
    (store.inbox || []).forEach((i) => {
      if (i.related_entity_id === found.id) {
        i.status = ['RESOLVED', 'CLOSED'].includes(found.status) ? 'RESOLVED' : i.status;
        i.updated_at = found.updated_at;
      }
    });
    posha().emitEvent(store, {
      type: 'COMPLAINT_STATUS_CHANGED',
      clientEmail: owner.email,
      actorId: session.email,
      actorRole: 'admin',
      title: `تحديث شكوى ${found.number}`,
      message: found.status,
      metadata: { complaintId: found.id },
      forceClient: true,
    });
    persistLifecycle(owner);
    portal().writeStore(store);
    sendJson(res, 200, { ok: true, complaint: found });
    return true;
  }

  if (pathname === '/api/admin/posha/os/tasks' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, tasks: store.tasks || [] });
    return true;
  }

  if (parts[4] === 'tasks' && parts[5] && parts[6] === 'assign' && req.method === 'POST') {
    const body = await readBody(req);
    const task = (store.tasks || []).find((t) => t.id === parts[5]);
    if (!task) {
      sendJson(res, 404, { ok: false, error: 'المهمة غير موجودة' });
      return true;
    }
    task.assigned_to = body.assigned_to || session.email;
    task.status = body.status || (task.status === 'OPEN' ? 'IN_PROGRESS' : task.status);
    task.updated_at = new Date().toISOString();
    posha().emitEvent(store, {
      type: 'TASK_ASSIGNED',
      clientEmail: task.related_client || null,
      actorId: session.email,
      actorRole: 'admin',
      title: `تعيين مهمة: ${task.title}`,
      message: task.assigned_to,
      metadata: { taskId: task.id },
    });
    portal().writeStore(store);
    sendJson(res, 200, { ok: true, task });
    return true;
  }

  if (parts[4] === 'tasks' && parts[5] && parts[6] === 'status' && req.method === 'POST') {
    const body = await readBody(req);
    const task = (store.tasks || []).find((t) => t.id === parts[5]);
    if (!task) {
      sendJson(res, 404, { ok: false, error: 'المهمة غير موجودة' });
      return true;
    }
    task.status = String(body.status || task.status).toUpperCase();
    task.updated_at = new Date().toISOString();
    if (task.status === 'DONE') {
      posha().emitEvent(store, {
        type: 'TASK_COMPLETED',
        clientEmail: task.related_client || null,
        actorId: session.email,
        actorRole: 'admin',
        title: `اكتملت مهمة: ${task.title}`,
        message: '',
        metadata: { taskId: task.id },
      });
    }
    portal().writeStore(store);
    sendJson(res, 200, { ok: true, task });
    return true;
  }

  if (parts[4] === 'inbox' && parts[5] && parts[6] === 'status' && req.method === 'POST') {
    const body = await readBody(req);
    const item = (store.inbox || []).find((i) => i.id === parts[5]);
    if (!item) {
      sendJson(res, 404, { ok: false, error: 'العنصر غير موجود' });
      return true;
    }
    item.status = String(body.status || item.status).toUpperCase();
    item.updated_at = new Date().toISOString();
    portal().writeStore(store);
    sendJson(res, 200, { ok: true, item });
    return true;
  }

  if (pathname === '/api/admin/posha/os/search' && req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    sendJson(res, 200, { ok: true, results: globalSearch(store, url.searchParams.get('q') || '') });
    return true;
  }

  if (pathname === '/api/admin/posha/os/reports' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, reports: buildReports(store) });
    return true;
  }

  if (pathname === '/api/admin/posha/os/sweep' && req.method === 'POST') {
    const a = runSubscriptionExpirySweep(store);
    const b = runSlaSweep(store);
    portal().writeStore(store);
    sendJson(res, 200, { ok: true, subscriptions: a, sla: b });
    return true;
  }

  if (pathname === '/api/admin/posha/os/map' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      map: {
        hub: ['Identity', 'SSO', 'Systems Registry', 'Permissions', 'Integration'],
        posha: [
          'Command Center',
          'CRM / العملاء',
          'Store / Catalog',
          'Orders',
          'Billing',
          'Subscriptions',
          'Support',
          'Service Requests',
          'Complaints',
          'Inbox',
          'Tasks',
          'Issues',
          'Events',
          'Notifications',
          'Reports',
          'Global Search',
          'SLA / Schedulers',
          'Onboarding',
        ],
        clientPortal: ['Home', 'Systems', 'Orders', 'Wallet', 'Support', 'Requests', 'Complaints', 'Notifications'],
      },
    });
    return true;
  }

  sendJson(res, 404, { ok: false, error: `POSHA OS route not found: ${pathname}` });
  return true;
}

module.exports = {
  catalog,
  computeLifecycle,
  computeHealth,
  checkout,
  createServiceRequest,
  createComplaint,
  fulfillPaidOrder,
  payInvoiceFromWallet,
  debitWallet,
  commandCenter,
  enrichClientRow,
  handlePoshaOsApi,
  ensureOsArrays,
  defaultOnboarding,
  syncOnboarding,
  persistLifecycle,
  runSubscriptionExpirySweep,
  runSlaSweep,
  renewSubscription,
  globalSearch,
  buildReports,
  startPoshaSchedulers,
};
