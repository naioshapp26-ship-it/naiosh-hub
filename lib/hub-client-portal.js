/**
 * Client Portal store + API — data isolated by authenticated client email.
 * Never trusts client_id from the request body for ownership.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const hubSession = require('./hub-session');
const customerAuth = require('./hub-customer-auth');

function posha() {
  return require('./hub-posha-ops');
}

function os() {
  return require('./hub-posha-os');
}

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const STORE_PATH = path.join(DATA_DIR, 'client-portal.json');

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function blankClient(email, name = '') {
  const now = new Date().toISOString();
  return {
    email: String(email || '').toLowerCase(),
    name: name || email,
    status: 'pending',
    lifecycle: 'PENDING_APPROVAL',
    accountLevel: 'أساسي',
    clientId: `CL-${crypto.createHash('sha1').update(String(email).toLowerCase()).digest('hex').slice(0, 8).toUpperCase()}`,
    company: '',
    country: 'فلسطين',
    language: 'ar',
    avatarUrl: '',
    systems: [],
    orders: [],
    subscriptions: [],
    wallet: { paid: 0, free: 0, total: 0, ledger: [] },
    invoices: [],
    tickets: [],
    notifications: [],
    activity: [],
    internalNotes: [],
    serviceRequests: [],
    complaints: [],
    onboarding: os().defaultOnboarding(),
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    const seed = blankStore();
    // Demo client for testing
    const demoEmail = 'client@naiosh.com';
    seed.clients[demoEmail] = {
      ...blankClient(demoEmail, 'أحمد العميل'),
      status: 'active',
      lifecycle: 'ACTIVE',
      company: 'مؤسسة تجريبية',
      accountLevel: 'احترافي',
      wallet: { paid: 0, free: 1000, total: 1000, ledger: [] },
      systems: [
        {
          id: uid('sys'),
          code: 'ERP',
          name: 'نايوش إي آر بي',
          description: 'إدارة الموارد والمبيعات',
          logo: 'assets/logo-hub.jpeg',
          status: 'active',
          plan: 'احترافي',
          activatedAt: new Date(Date.now() - 40 * 864e5).toISOString(),
          expiresAt: new Date(Date.now() + 320 * 864e5).toISOString(),
          url: 'systems/erp.html',
        },
        {
          id: uid('sys'),
          code: 'CRM',
          name: 'إدارة العملاء',
          description: 'متابعة العملاء والفرص',
          logo: 'assets/logo-hub.jpeg',
          status: 'active',
          plan: 'أساسي',
          activatedAt: new Date(Date.now() - 20 * 864e5).toISOString(),
          expiresAt: new Date(Date.now() + 160 * 864e5).toISOString(),
          url: 'systems/crm.html',
        },
        {
          id: uid('sys'),
          code: 'LMS',
          name: 'نظام التعلم',
          description: 'دورات وتدريب فريقك',
          logo: 'assets/logo-hub.jpeg',
          status: 'under_setup',
          plan: 'أساسي',
          activatedAt: new Date().toISOString(),
          expiresAt: null,
          url: 'systems/lms.html',
        },
      ],
      orders: [
        {
          id: uid('ord'),
          number: 'ORD-10021',
          service: 'باقة ERP احترافية',
          date: new Date(Date.now() - 5 * 864e5).toISOString(),
          amount: 499,
          currency: 'USD',
          status: 'in_progress',
          timeline: [
            { at: new Date(Date.now() - 5 * 864e5).toISOString(), label: 'تم استلام الطلب', status: 'done' },
            { at: new Date(Date.now() - 4 * 864e5).toISOString(), label: 'قيد المراجعة', status: 'done' },
            { at: new Date(Date.now() - 2 * 864e5).toISOString(), label: 'قيد التنفيذ', status: 'current' },
            { at: null, label: 'مكتمل', status: 'pending' },
          ],
        },
        {
          id: uid('ord'),
          number: 'ORD-10008',
          service: 'تفعيل نظام CRM',
          date: new Date(Date.now() - 25 * 864e5).toISOString(),
          amount: 199,
          currency: 'USD',
          status: 'completed',
          timeline: [
            { at: new Date(Date.now() - 25 * 864e5).toISOString(), label: 'تم استلام الطلب', status: 'done' },
            { at: new Date(Date.now() - 24 * 864e5).toISOString(), label: 'معتمد', status: 'done' },
            { at: new Date(Date.now() - 22 * 864e5).toISOString(), label: 'مكتمل', status: 'done' },
          ],
        },
      ],
      subscriptions: [
        {
          id: uid('sub'),
          systemCode: 'ERP',
          systemName: 'نايوش إي آر بي',
          plan: 'احترافي',
          price: 499,
          startedAt: new Date(Date.now() - 40 * 864e5).toISOString(),
          renewsAt: new Date(Date.now() + 320 * 864e5).toISOString(),
          status: 'active',
          autoRenew: true,
        },
        {
          id: uid('sub'),
          systemCode: 'CRM',
          systemName: 'إدارة العملاء',
          plan: 'أساسي',
          price: 199,
          startedAt: new Date(Date.now() - 20 * 864e5).toISOString(),
          renewsAt: new Date(Date.now() + 160 * 864e5).toISOString(),
          status: 'active',
          autoRenew: false,
        },
      ],
      wallet: {
        paid: 150,
        free: 300,
        total: 450,
        ledger: [
          { id: uid('led'), at: new Date(Date.now() - 10 * 864e5).toISOString(), type: 'credit', amount: 300, note: 'رصيد ترحيبي مجاني' },
          { id: uid('led'), at: new Date(Date.now() - 8 * 864e5).toISOString(), type: 'credit', amount: 200, note: 'شحن رصيد' },
          { id: uid('led'), at: new Date(Date.now() - 3 * 864e5).toISOString(), type: 'debit', amount: 50, note: 'خصم طلب خدمة' },
        ],
      },
      invoices: [
        {
          id: uid('inv'),
          number: 'INV-5001',
          amount: 199,
          currency: 'USD',
          date: new Date(Date.now() - 12 * 864e5).toISOString(),
          status: 'paid',
          dueAt: new Date(Date.now() - 5 * 864e5).toISOString(),
        },
        {
          id: uid('inv'),
          number: 'INV-5012',
          amount: 499,
          currency: 'USD',
          date: new Date(Date.now() - 2 * 864e5).toISOString(),
          status: 'unpaid',
          dueAt: new Date(Date.now() + 5 * 864e5).toISOString(),
        },
      ],
      tickets: [
        {
          id: uid('tkt'),
          subject: 'مساعدة في إعداد ERP',
          systemCode: 'ERP',
          department: 'دعم فني',
          priority: 'medium',
          status: 'waiting_customer',
          createdAt: new Date(Date.now() - 1 * 864e5).toISOString(),
          messages: [
            { id: uid('msg'), at: new Date(Date.now() - 1 * 864e5).toISOString(), from: 'client', body: 'أحتاج مساعدة في ربط الفرع.' },
            { id: uid('msg'), at: new Date(Date.now() - 0.5 * 864e5).toISOString(), from: 'support', body: 'من فضلك أرسل صورة من إعدادات الفرع.' },
          ],
        },
      ],
      notifications: [
        {
          id: uid('ntf'),
          title: 'تم تفعيل نظام CRM',
          body: 'نظام إدارة العملاء أصبح نشطًا على حسابك.',
          at: new Date(Date.now() - 20 * 864e5).toISOString(),
          read: true,
          kind: 'system',
        },
        {
          id: uid('ntf'),
          title: 'فاتورة جديدة',
          body: 'فاتورة INV-5012 بانتظار الدفع.',
          at: new Date(Date.now() - 2 * 864e5).toISOString(),
          read: false,
          kind: 'billing',
        },
        {
          id: uid('ntf'),
          title: 'رد على تذكرة الدعم',
          body: 'فريق الدعم بانتظار ردك على تذكرة إعداد ERP.',
          at: new Date(Date.now() - 0.5 * 864e5).toISOString(),
          read: false,
          kind: 'support',
        },
      ],
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2), 'utf8');
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return {
      version: 1,
      clients: raw.clients && typeof raw.clients === 'object' ? raw.clients : {},
      activity: Array.isArray(raw.activity) ? raw.activity : [],
      adminNotifications: Array.isArray(raw.adminNotifications) ? raw.adminNotifications : [],
      issues: Array.isArray(raw.issues) ? raw.issues : [],
      catalog: Array.isArray(raw.catalog) ? raw.catalog : [],
      inbox: Array.isArray(raw.inbox) ? raw.inbox : [],
      tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
      automations: Array.isArray(raw.automations) ? raw.automations : [],
      meta: raw.meta && typeof raw.meta === 'object' ? raw.meta : { ticketSeq: 1000, orderSeq: 10000 },
      updatedAt: raw.updatedAt || new Date().toISOString(),
    };
  } catch {
    return blankStore();
  }
}

function blankStore() {
  return {
    version: 1,
    clients: {},
    activity: [],
    adminNotifications: [],
    issues: [],
    catalog: [],
    inbox: [],
    tasks: [],
    automations: [],
    meta: { ticketSeq: 1000, orderSeq: 10000 },
    updatedAt: new Date().toISOString(),
  };
}

function writeStore(store) {
  ensureStore();
  store.updatedAt = new Date().toISOString();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  return store;
}

function logActivity(store, entry) {
  store.activity = [
    {
      id: uid('act'),
      at: new Date().toISOString(),
      ...entry,
    },
    ...(store.activity || []),
  ].slice(0, 500);
}

function ensureClient(store, email, name = '') {
  const key = String(email || '').toLowerCase();
  if (!store.clients[key]) {
    store.clients[key] = blankClient(key, name);
    const isDemo = key === 'client@naiosh.com';
    if (isDemo) {
      store.clients[key].status = 'active';
      store.clients[key].lifecycle = 'ACTIVE';
      store.clients[key].wallet = { paid: 0, free: 1000, total: 1000, ledger: [] };
      store.clients[key].wallet.ledger.push({
        id: uid('led'),
        at: new Date().toISOString(),
        type: 'credit',
        amount: 1000,
        note: 'رصيد تجريبي',
      });
    }
    try {
      const osMod = os();
      osMod.syncOnboarding(store.clients[key]);
      osMod.ensureOsArrays(store);
      posha().emitEvent(store, {
        type: 'CLIENT_REGISTERED',
        clientEmail: key,
        actorId: key,
        actorRole: 'client',
        title: `عميل جديد: ${store.clients[key].name}`,
        message: isDemo ? 'حساب تجريبي' : 'بانتظار موافقة الإدارة',
        metadata: { clientId: store.clients[key].clientId, status: store.clients[key].status },
        forceAdmin: true,
      });
      if (!isDemo) {
        store.inbox.unshift({
          id: uid('inbox'),
          status: 'NEW',
          assigned_to: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          kind: 'REGISTRATION',
          title: `تسجيل عميل جديد — ${store.clients[key].name}`,
          clientEmail: key,
          clientName: store.clients[key].name,
          priority: 'HIGH',
          related_entity_type: 'client',
          related_entity_id: store.clients[key].clientId,
          ref: store.clients[key].clientId,
        });
      }
    } catch (e) {
      /* event engine optional during early boot */
    }
  } else if (name && (!store.clients[key].name || store.clients[key].name === key)) {
    store.clients[key].name = name;
  }
  if (!store.clients[key].onboarding) {
    try {
      store.clients[key].onboarding = os().defaultOnboarding();
      os().syncOnboarding(store.clients[key]);
    } catch (e) {
      /* ignore */
    }
  }
  return store.clients[key];
}

function assertClientCanTransact(client) {
  if (!client) {
    const err = new Error('العميل غير موجود');
    err.status = 404;
    throw err;
  }
  if (client.status === 'suspended') {
    const err = new Error('الحساب موقوف — تواصل مع الدعم');
    err.status = 403;
    throw err;
  }
  if (client.status === 'pending') {
    const err = new Error('حسابك بانتظار موافقة الإدارة قبل استخدام المتجر والمدفوعات');
    err.status = 403;
    throw err;
  }
}

function publicClient(client, { includeInternal = false } = {}) {
  if (!client) return null;
  const unread = (client.notifications || []).filter((n) => !n.read).length;
  const openOrders = (client.orders || []).filter((o) => !['completed', 'cancelled', 'rejected'].includes(o.status)).length;
  const unpaidInvoices = (client.invoices || []).filter((i) => i.status === 'unpaid' || i.status === 'overdue');
  const actionRequired = [];
  unpaidInvoices.forEach((inv) =>
    actionRequired.push({ type: 'invoice', id: inv.id, title: `فاتورة ${inv.number} تحتاج الدفع`, amount: inv.amount })
  );
  (client.subscriptions || [])
    .filter((s) => s.renewsAt && new Date(s.renewsAt) - Date.now() < 30 * 864e5)
    .forEach((s) =>
      actionRequired.push({ type: 'renewal', id: s.id, title: `اشتراك ${s.systemName} يقترب من التجديد`, renewsAt: s.renewsAt })
    );
  (client.tickets || [])
    .filter((t) => t.status === 'waiting_customer')
    .forEach((t) => actionRequired.push({ type: 'ticket', id: t.id, title: `تذكرة تنتظر ردك: ${t.subject}` }));

  const out = {
    email: client.email,
    name: client.name,
    status: client.status,
    lifecycle: client.lifecycle || null,
    accountLevel: client.accountLevel,
    clientId: client.clientId,
    company: client.company,
    country: client.country,
    language: client.language,
    avatarUrl: client.avatarUrl,
    phone: client.phone || '',
    lastLoginAt: client.lastLoginAt,
    createdAt: client.createdAt,
    systems: client.systems || [],
    orders: client.orders || [],
    subscriptions: client.subscriptions || [],
    wallet: {
      paid: client.wallet?.paid || 0,
      free: client.wallet?.free || 0,
      total: client.wallet?.total || 0,
      ledger: client.wallet?.ledger || [],
    },
    invoices: client.invoices || [],
    tickets: client.tickets || [],
    notifications: client.notifications || [],
    unreadNotifications: unread,
    openOrders,
    unpaidCount: unpaidInvoices.length,
    actionRequired,
    onboarding: client.onboarding || null,
    pendingApproval: client.status === 'pending',
  };
  if (includeInternal) {
    out.internalNotes = client.internalNotes || [];
    out.activity = client.activity || [];
  }
  return out;
}

function marketplaceCatalog() {
  return os().catalog().map((item) => ({
    id: item.id,
    sku: item.sku,
    code: item.sku,
    type: item.type,
    name: item.name,
    description: item.description,
    price: item.price,
    priceFrom: item.price,
    priceLabel: item.price != null ? `${item.price}$` : 'حسب الطلب',
    currency: item.currency || 'USD',
    plan: item.plan || '',
    category: item.category,
    logo: 'assets/logo-hub.jpeg',
    ctaUrl: 'client.html#marketplace',
    moreUrl: 'client.html#marketplace',
    available: item.available !== false,
  }));
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

function touchLogin(email, name, meta) {
  meta = meta || {};
  const store = readStore();
  const client = ensureClient(store, email, name);
  client.lastLoginAt = new Date().toISOString();
  client.updatedAt = client.lastLoginAt;
  client.sessions = client.sessions || [];
  client.sessions.unshift({
    id: uid('sess'),
    device: meta.device || 'متصفح ويب',
    browser: meta.browser || 'Web',
    ip: meta.ip || '',
    at: client.lastLoginAt,
    current: true,
  });
  client.sessions = client.sessions.slice(0, 20);
  try {
    posha().emitEvent(store, {
      type: 'CLIENT_LOGIN',
      clientEmail: email,
      actorId: email,
      actorRole: 'client',
      title: 'تسجيل دخول',
      message: `${client.name} دخل إلى مركز العميل`,
      metadata: { ip: meta.ip || '' },
    });
  } catch (e) {
    logActivity(store, { action: 'LOGIN', user_id: email, actor_id: email, metadata: { lane: 'CLIENT' } });
  }
  writeStore(store);
  return client;
}

async function ensureDemoClientAccount() {
  const email = 'client@naiosh.com';
  if (!customerAuth.findByEmail(email)) {
    await customerAuth.register({
      fullName: 'أحمد العميل',
      username: 'ahmed_client',
      email,
      phone: '+970599000001',
      password: 'Hub@360',
      confirmPassword: 'Hub@360',
      termsAccepted: true,
      governorate: 'رام الله',
      city: 'رام الله',
    });
  }
  // Ensure portal file exists with seeded demo profile
  ensureStore();
  const store = readStore();
  if (!store.clients[email] || !(store.clients[email].systems || []).length) {
    // Re-read from freshly seeded file if blank, else inject minimal demo systems
    ensureClient(store, email, 'أحمد العميل');
    store.clients[email].status = 'active';
    store.clients[email].lifecycle = 'ACTIVE';
    if (!(store.clients[email].systems || []).length) {
      store.clients[email].systems = [
        {
          id: uid('sys'),
          code: 'ERP',
          name: 'نايوش إي آر بي',
          description: 'إدارة الموارد والمبيعات',
          logo: 'assets/logo-hub.jpeg',
          status: 'active',
          plan: 'احترافي',
          activatedAt: new Date(Date.now() - 40 * 864e5).toISOString(),
          expiresAt: new Date(Date.now() + 320 * 864e5).toISOString(),
          url: 'systems/erp.html',
        },
      ];
      store.clients[email].name = 'أحمد العميل';
      store.clients[email].wallet = store.clients[email].wallet || { paid: 0, free: 1000, total: 1000, ledger: [] };
      if ((store.clients[email].wallet.total || 0) < 200) {
        store.clients[email].wallet.free = (store.clients[email].wallet.free || 0) + 800;
        store.clients[email].wallet.total =
          (store.clients[email].wallet.paid || 0) + (store.clients[email].wallet.free || 0);
      }
    }
    writeStore(store);
  }
  // Always keep demo operable
  if (store.clients[email]) {
    store.clients[email].status = 'active';
    if ((store.clients[email].wallet?.total || 0) < 100) {
      store.clients[email].wallet = store.clients[email].wallet || { paid: 0, free: 0, total: 0, ledger: [] };
      store.clients[email].wallet.free = (store.clients[email].wallet.free || 0) + 500;
      store.clients[email].wallet.total =
        (store.clients[email].wallet.paid || 0) + (store.clients[email].wallet.free || 0);
    }
    writeStore(store);
  }
}

async function handleClientApi(req, res, pathname) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return true;
  }

  // Admin clients management under /api/admin/clients* handled separately
  if (!pathname.startsWith('/api/client')) return false;

  let session;
  try {
    session = hubSession.requireClient(req);
  } catch (err) {
    sendJson(res, err.status || 401, { ok: false, success: false, error: err.message });
    return true;
  }

  const store = readStore();
  const client = ensureClient(store, session.email, session.name);
  // Always bind to session email — ignore any client_id from query/body for ownership
  const me = () => store.clients[session.email];

  if (pathname === '/api/client/me' && req.method === 'GET') {
    client.lastLoginAt = client.lastLoginAt || new Date().toISOString();
    writeStore(store);
    sendJson(res, 200, { ok: true, success: true, client: publicClient(me()) });
    return true;
  }

  if (pathname === '/api/client/home' && req.method === 'GET') {
    try {
      os().persistLifecycle(me());
      writeStore(store);
    } catch (e) {
      /* ignore */
    }
    const view = publicClient(me());
    if (view.status === 'pending') {
      view.actionRequired = [
        { type: 'approval', id: 'pending', title: 'حسابك بانتظار موافقة الإدارة' },
        ...(view.actionRequired || []),
      ];
    }
    sendJson(res, 200, {
      ok: true,
      success: true,
      home: {
        welcome: {
          name: view.name,
          clientId: view.clientId,
          accountLevel: view.accountLevel,
          status: view.status,
          lifecycle: view.lifecycle,
        },
        summary: {
          systemsActive: (view.systems || []).filter((s) => s.status === 'active').length,
          systemsTotal: (view.systems || []).length,
          openOrders: view.openOrders,
          walletTotal: view.wallet.total,
          unpaidInvoices: view.unpaidCount,
          unreadNotifications: view.unreadNotifications,
        },
        systems: (view.systems || []).slice().sort((a, b) => (a.status === 'active' ? -1 : 1)),
        actionRequired: view.actionRequired || [],
        onboarding: view.onboarding,
        recentOrders: (view.orders || []).slice(0, 5),
        upcomingBilling: {
          renewals: (view.subscriptions || [])
            .filter((s) => s.renewsAt)
            .sort((a, b) => new Date(a.renewsAt) - new Date(b.renewsAt))
            .slice(0, 3),
          unpaid: (view.invoices || []).filter((i) => i.status === 'unpaid' || i.status === 'overdue').slice(0, 3),
        },
        notifications: (view.notifications || []).slice(0, 5),
        marketplace: marketplaceCatalog().slice(0, 4),
      },
    });
    return true;
  }

  if (pathname === '/api/client/systems' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, systems: me().systems || [] });
    return true;
  }

  if (pathname === '/api/client/orders' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, orders: me().orders || [] });
    return true;
  }

  if (pathname === '/api/client/subscriptions' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, subscriptions: me().subscriptions || [] });
    return true;
  }

  if (pathname === '/api/client/wallet' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, wallet: me().wallet });
    return true;
  }

  if (pathname === '/api/client/invoices' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, invoices: me().invoices || [] });
    return true;
  }

  if (pathname === '/api/client/notifications' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      notifications: me().notifications || [],
      unread: (me().notifications || []).filter((n) => !n.read).length,
    });
    return true;
  }

  if (pathname === '/api/client/notifications/read' && req.method === 'POST') {
    const body = await readBody(req);
    const c = me();
    if (body.all) {
      (c.notifications || []).forEach((n) => {
        n.read = true;
      });
    } else if (body.id) {
      const n = (c.notifications || []).find((x) => x.id === body.id);
      if (n) n.read = true;
    }
    writeStore(store);
    sendJson(res, 200, { ok: true, unread: (c.notifications || []).filter((n) => !n.read).length });
    return true;
  }

  if (pathname === '/api/client/tickets' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, tickets: me().tickets || [] });
    return true;
  }

  if (pathname === '/api/client/tickets' && req.method === 'POST') {
    const body = await readBody(req);
    const subject = String(body.subject || '').trim();
    const message = String(body.message || body.body || '').trim();
    if (!subject || !message) {
      sendJson(res, 400, { ok: false, error: 'العنوان والرسالة مطلوبان' });
      return true;
    }
    const ticket = posha().createTicket(store, me(), body, session);
    writeStore(store);
    sendJson(res, 201, { ok: true, ticket });
    return true;
  }

  if (pathname.startsWith('/api/client/tickets/') && req.method === 'POST') {
    const id = pathname.split('/').pop();
    const body = await readBody(req);
    const ticket = (me().tickets || []).find((t) => t.id === id || t.number === id);
    if (!ticket) {
      sendJson(res, 404, { ok: false, error: 'التذكرة غير موجودة' });
      return true;
    }
    try {
      posha().addTicketMessage(store, me(), ticket, body, session, 'client');
    } catch (e) {
      sendJson(res, e.status || 400, { ok: false, error: e.message });
      return true;
    }
    writeStore(store);
    sendJson(res, 200, { ok: true, ticket });
    return true;
  }

  if (pathname === '/api/client/orders' && req.method === 'POST') {
    try {
      assertClientCanTransact(me());
    } catch (e) {
      sendJson(res, e.status || 403, { ok: false, error: e.message });
      return true;
    }
    const body = await readBody(req);
    const service = String(body.service || body.name || '').trim();
    if (!service) {
      sendJson(res, 400, { ok: false, error: 'اسم الخدمة مطلوب' });
      return true;
    }
    const number = posha().nextOrderNumber(store);
    const order = {
      id: uid('ord'),
      number,
      service,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      amount: Number(body.amount || 0),
      currency: body.currency || 'USD',
      status: 'pending_review',
      timeline: [
        { at: new Date().toISOString(), label: 'تم استلام الطلب', status: 'done' },
        { at: null, label: 'قيد المراجعة', status: 'current' },
      ],
    };
    me().orders = me().orders || [];
    me().orders.unshift(order);
    posha().emitEvent(store, {
      type: 'ORDER_CREATED',
      clientEmail: session.email,
      actorId: session.email,
      actorRole: 'client',
      title: `طلب جديد ${number}`,
      message: `${me().name}: ${service}`,
      metadata: { orderId: order.id },
    });
    writeStore(store);
    sendJson(res, 201, { ok: true, order });
    return true;
  }

  if (pathname === '/api/client/invoices/pay' && req.method === 'POST') {
    try {
      assertClientCanTransact(me());
    } catch (e) {
      sendJson(res, e.status || 403, { ok: false, error: e.message });
      return true;
    }
    const body = await readBody(req);
    const inv = (me().invoices || []).find((i) => i.id === body.id || i.number === body.id);
    if (!inv) {
      sendJson(res, 404, { ok: false, error: 'الفاتورة غير موجودة' });
      return true;
    }
    if (String(inv.status).toLowerCase() === 'paid') {
      sendJson(res, 400, { ok: false, error: 'الفاتورة مدفوعة مسبقًا' });
      return true;
    }
    const payment = os().payInvoiceFromWallet(store, me(), inv, session);
    if (!payment.ok) {
      writeStore(store);
      sendJson(res, 400, { ok: false, error: payment.error || 'فشل الدفع' });
      return true;
    }
    if (inv.orderId) {
      const order = (me().orders || []).find((o) => o.id === inv.orderId);
      if (order && !['COMPLETED', 'completed', 'CANCELLED', 'cancelled'].includes(order.status)) {
        os().fulfillPaidOrder(store, me(), order, session);
      }
    }
    writeStore(store);
    sendJson(res, 200, { ok: true, invoice: inv, wallet: me().wallet });
    return true;
  }

  if (pathname === '/api/client/checkout' && req.method === 'POST') {
    try {
      assertClientCanTransact(me());
    } catch (e) {
      sendJson(res, e.status || 403, { ok: false, error: e.message });
      return true;
    }
    const body = await readBody(req);
    try {
      os().ensureOsArrays(store);
      const result = os().checkout(store, me(), body, session);
      writeStore(store);
      sendJson(res, 201, { ok: true, ...result });
    } catch (e) {
      sendJson(res, e.status || 400, { ok: false, error: e.message || 'فشل إتمام الشراء' });
    }
    return true;
  }

  if (pathname === '/api/client/subscriptions/renew' && req.method === 'POST') {
    try {
      assertClientCanTransact(me());
    } catch (e) {
      sendJson(res, e.status || 403, { ok: false, error: e.message });
      return true;
    }
    const body = await readBody(req);
    try {
      const result = os().renewSubscription(store, me(), body.id || body.subscriptionId, session);
      writeStore(store);
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.error || 'فشل التجديد', invoice: result.invoice });
        return true;
      }
      sendJson(res, 200, { ok: true, ...result });
    } catch (e) {
      sendJson(res, e.status || 400, { ok: false, error: e.message });
    }
    return true;
  }

  if (pathname === '/api/client/requests' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, requests: me().serviceRequests || [] });
    return true;
  }

  if (pathname === '/api/client/requests' && req.method === 'POST') {
    const body = await readBody(req);
    const subject = String(body.subject || body.title || '').trim();
    const message = String(body.message || body.body || '').trim();
    if (!subject || !message) {
      sendJson(res, 400, { ok: false, error: 'العنوان والرسالة مطلوبان' });
      return true;
    }
    const request = os().createServiceRequest(store, me(), body, session);
    writeStore(store);
    sendJson(res, 201, { ok: true, request });
    return true;
  }

  if (pathname === '/api/client/complaints' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, complaints: me().complaints || [] });
    return true;
  }

  if (pathname === '/api/client/complaints' && req.method === 'POST') {
    const body = await readBody(req);
    const subject = String(body.subject || body.title || '').trim();
    const message = String(body.message || body.body || '').trim();
    if (!subject || !message) {
      sendJson(res, 400, { ok: false, error: 'العنوان والرسالة مطلوبان' });
      return true;
    }
    const complaint = os().createComplaint(store, me(), body, session);
    writeStore(store);
    sendJson(res, 201, { ok: true, complaint });
    return true;
  }

  if (pathname === '/api/client/wallet/topup-request' && req.method === 'POST') {
    const body = await readBody(req);
    const amount = Number(body.amount || 0);
    if (amount <= 0) {
      sendJson(res, 400, { ok: false, error: 'أدخل مبلغًا صالحًا' });
      return true;
    }
    const number = posha().nextOrderNumber(store);
    const order = {
      id: uid('ord'),
      number,
      service: `طلب شحن محفظة (${amount} نقطة)`,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      amount,
      currency: 'PTS',
      status: 'pending_review',
      timeline: [{ at: new Date().toISOString(), label: 'طلب شحن بانتظار موافقة الإدارة', status: 'current' }],
    };
    me().orders = me().orders || [];
    me().orders.unshift(order);
    posha().emitEvent(store, {
      type: 'ORDER_CREATED',
      clientEmail: session.email,
      actorId: session.email,
      actorRole: 'client',
      title: `طلب شحن محفظة ${number}`,
      message: `${me().name} طلب شحن ${amount} نقطة`,
      metadata: { orderId: order.id, kind: 'wallet_topup' },
    });
    writeStore(store);
    sendJson(res, 201, { ok: true, order, message: 'تم إرسال طلب الشحن للإدارة' });
    return true;
  }

  if (pathname === '/api/client/profile' && req.method === 'PUT') {
    const body = await readBody(req);
    const c = me();
    if (body.name != null) c.name = String(body.name).trim() || c.name;
    if (body.company != null) c.company = String(body.company).trim();
    if (body.country != null) c.country = String(body.country).trim();
    if (body.phone != null) c.phone = String(body.phone).trim();
    if (body.language != null) c.language = String(body.language).trim() || 'ar';
    c.updatedAt = new Date().toISOString();
    posha().emitEvent(store, {
      type: 'CLIENT_PROFILE_UPDATED',
      clientEmail: session.email,
      actorId: session.email,
      actorRole: 'client',
      title: 'تحديث بيانات العميل',
      message: `${c.name} حدّث ملفه الشخصي`,
      metadata: {},
    });
    writeStore(store);
    sendJson(res, 200, { ok: true, client: publicClient(c) });
    return true;
  }

  if (pathname === '/api/client/security' && req.method === 'GET') {
    const c = me();
    sendJson(res, 200, {
      ok: true,
      security: {
        lastLoginAt: c.lastLoginAt,
        sessions: c.sessions || [],
        failedLogins: c.failedLogins || [],
        twoFactorEnabled: !!c.twoFactorEnabled,
      },
      client: publicClient(c),
    });
    return true;
  }

  if (pathname === '/api/client/security/logout-others' && req.method === 'POST') {
    const c = me();
    c.sessions = (c.sessions || []).filter((s) => s.current);
    posha().emitEvent(store, {
      type: 'PASSWORD_CHANGED',
      clientEmail: session.email,
      actorId: session.email,
      actorRole: 'client',
      title: 'تم إنهاء الجلسات الأخرى',
      message: 'تم تسجيل الخروج من الأجهزة الأخرى',
      metadata: { kind: 'logout_others' },
      forceClient: true,
    });
    // Re-tag event type via activity only — use generic activity without wrong type label
    writeStore(store);
    sendJson(res, 200, { ok: true, sessions: c.sessions });
    return true;
  }

  if (pathname === '/api/client/security/password' && req.method === 'POST') {
    const body = await readBody(req);
    const current = String(body.currentPassword || '');
    const next = String(body.newPassword || '');
    if (next.length < 4) {
      sendJson(res, 400, { ok: false, error: 'كلمة المرور الجديدة قصيرة جدًا' });
      return true;
    }
    const account = customerAuth.findByEmail(session.email);
    if (!account) {
      sendJson(res, 400, { ok: false, error: 'تغيير كلمة المرور متاح لحسابات العملاء المسجّلة' });
      return true;
    }
    const ok = await customerAuth.verifyPassword(current, account.passwordHash);
    if (!ok) {
      me().failedLogins = me().failedLogins || [];
      me().failedLogins.unshift({ at: new Date().toISOString(), reason: 'password_change_failed' });
      writeStore(store);
      sendJson(res, 401, { ok: false, error: 'كلمة المرور الحالية غير صحيحة' });
      return true;
    }
    const storeAccounts = customerAuth.readStore();
    const row = storeAccounts.accounts.find((a) => a.email === account.email);
    row.passwordHash = await customerAuth.hashPassword(next);
    row.updatedAt = new Date().toISOString();
    customerAuth.writeStore(storeAccounts);
    me().sessions = [{ id: uid('sess'), device: 'الجلسة الحالية', browser: 'Web', ip: '', at: new Date().toISOString(), current: true }];
    posha().emitEvent(store, {
      type: 'PASSWORD_CHANGED',
      clientEmail: session.email,
      actorId: session.email,
      actorRole: 'client',
      title: 'تم تغيير كلمة المرور',
      message: 'تم تحديث كلمة مرور حسابك بنجاح',
      metadata: {},
    });
    writeStore(store);
    sendJson(res, 200, { ok: true, message: 'تم تغيير كلمة المرور' });
    return true;
  }

  if (pathname === '/api/client/marketplace' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, items: marketplaceCatalog() });
    return true;
  }

  sendJson(res, 404, { ok: false, error: `Client route not found: ${pathname}` });
  return true;
}

async function handleAdminClientsApi(req, res, pathname) {
  if (!pathname.startsWith('/api/admin/clients')) return false;
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return true;
  }

  let session;
  try {
    session = hubSession.requireStaff(req, 'clients.view');
  } catch (err) {
    sendJson(res, err.status || 403, { ok: false, success: false, error: err.message });
    return true;
  }

  const store = readStore();

  if (pathname === '/api/admin/clients' && req.method === 'GET') {
    const list = Object.values(store.clients || {}).map((c) => ({
      email: c.email,
      name: c.name,
      status: c.status,
      clientId: c.clientId,
      accountLevel: c.accountLevel,
      systemsCount: (c.systems || []).length,
      openOrders: (c.orders || []).filter((o) => !['completed', 'cancelled', 'rejected'].includes(o.status)).length,
      walletTotal: c.wallet?.total || 0,
      lastLoginAt: c.lastLoginAt,
      createdAt: c.createdAt,
    }));
    sendJson(res, 200, { ok: true, success: true, clients: list, total: list.length });
    return true;
  }

  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  // /api/admin/clients/:email
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'clients' && parts[3] && !parts[4] && req.method === 'GET') {
    const email = decodeURIComponent(parts[3]).toLowerCase();
    const client = store.clients[email];
    if (!client) {
      sendJson(res, 404, { ok: false, error: 'العميل غير موجود' });
      return true;
    }
    sendJson(res, 200, { ok: true, client: publicClient(client, { includeInternal: true }) });
    return true;
  }

  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'clients' && parts[3] && parts[4] === 'assign-system' && req.method === 'POST') {
    if (!hubSession.hasPermission(session, 'systems.assign')) {
      sendJson(res, 403, { ok: false, error: 'ليست لديك صلاحية تعيين الأنظمة' });
      return true;
    }
    const email = decodeURIComponent(parts[3]).toLowerCase();
    const body = await readBody(req);
    const client = ensureClient(store, email);
    const code = String(body.code || body.systemCode || '').toUpperCase();
    if (!code) {
      sendJson(res, 400, { ok: false, error: 'كود النظام مطلوب' });
      return true;
    }
    if (!(client.systems || []).some((s) => s.code === code)) {
      client.systems.unshift({
        id: uid('sys'),
        code,
        name: body.name || code,
        description: body.description || '',
        logo: 'assets/logo-hub.jpeg',
        status: body.status || 'active',
        plan: body.plan || 'أساسي',
        activatedAt: new Date().toISOString(),
        expiresAt: body.expiresAt || null,
        url: body.url || `systems/${code.toLowerCase()}.html`,
      });
    }
    logActivity(store, {
      action: 'SYSTEM_ASSIGNED',
      user_id: email,
      actor_id: session.email,
      metadata: { code },
    });
    writeStore(store);
    sendJson(res, 200, { ok: true, client: publicClient(client, { includeInternal: true }) });
    return true;
  }

  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'clients' && parts[3] && parts[4] === 'status' && req.method === 'POST') {
    if (!hubSession.hasPermission(session, 'clients.suspend') && !hubSession.hasPermission(session, 'clients.edit')) {
      sendJson(res, 403, { ok: false, error: 'ليست لديك صلاحية تعديل حالة العميل' });
      return true;
    }
    const email = decodeURIComponent(parts[3]).toLowerCase();
    const body = await readBody(req);
    const client = store.clients[email];
    if (!client) {
      sendJson(res, 404, { ok: false, error: 'العميل غير موجود' });
      return true;
    }
    client.status = String(body.status || client.status);
    if (client.status === 'suspended') {
      posha().emitEvent(store, {
        type: 'ACCOUNT_SUSPENDED',
        clientEmail: email,
        actorId: session.email,
        actorRole: 'admin',
        title: 'إيقاف حساب عميل',
        message: client.name,
        metadata: {},
        forceIssue: true,
        issueSeverity: 'HIGH',
      });
    }
    if (client.status === 'active' || client.status === 'approved') {
      client.status = 'active';
      posha().emitEvent(store, {
        type: 'CLIENT_APPROVED',
        clientEmail: email,
        actorId: session.email,
        actorRole: 'admin',
        title: 'تم اعتماد حسابك',
        message: 'يمكنك الآن استخدام المتجر والأنظمة',
        metadata: { clientId: client.clientId },
        forceClient: true,
      });
      // Welcome credit on first approval
      if (!client.welcomeCredited) {
        client.wallet = client.wallet || { paid: 0, free: 0, total: 0, ledger: [] };
        client.wallet.free = (Number(client.wallet.free) || 0) + 300;
        client.wallet.total = (Number(client.wallet.paid) || 0) + (Number(client.wallet.free) || 0);
        client.wallet.ledger = client.wallet.ledger || [];
        client.wallet.ledger.unshift({
          id: uid('led'),
          at: new Date().toISOString(),
          type: 'credit',
          amount: 300,
          note: 'رصيد ترحيبي بعد الاعتماد',
        });
        client.welcomeCredited = true;
        posha().emitEvent(store, {
          type: 'WALLET_CREDITED',
          clientEmail: email,
          actorId: session.email,
          actorRole: 'admin',
          title: 'رصيد ترحيبي +300',
          message: 'بعد اعتماد الحساب',
          metadata: {},
        });
      }
      (store.inbox || []).forEach((i) => {
        if (i.kind === 'REGISTRATION' && i.clientEmail === email) {
          i.status = 'RESOLVED';
          i.updated_at = new Date().toISOString();
        }
      });
    }
    try {
      os().persistLifecycle(client);
    } catch (e) {
      /* ignore */
    }
    writeStore(store);
    sendJson(res, 200, { ok: true, client: publicClient(client, { includeInternal: true }) });
    return true;
  }

  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'clients' && parts[3] && parts[4] === 'notes' && req.method === 'POST') {
    const email = decodeURIComponent(parts[3]).toLowerCase();
    const body = await readBody(req);
    const client = ensureClient(store, email);
    const note = String(body.note || body.body || '').trim();
    if (!note) {
      sendJson(res, 400, { ok: false, error: 'الملاحظة مطلوبة' });
      return true;
    }
    client.internalNotes = client.internalNotes || [];
    client.internalNotes.unshift({
      id: uid('note'),
      at: new Date().toISOString(),
      by: session.email,
      note,
    });
    writeStore(store);
    sendJson(res, 200, { ok: true, notes: client.internalNotes });
    return true;
  }

  sendJson(res, 404, { ok: false, error: `Admin clients route not found: ${pathname}` });
  return true;
}

module.exports = {
  STORE_PATH,
  readStore,
  writeStore,
  ensureClient,
  publicClient,
  touchLogin,
  ensureDemoClientAccount,
  handleClientApi,
  handleAdminClientsApi,
  marketplaceCatalog,
};
