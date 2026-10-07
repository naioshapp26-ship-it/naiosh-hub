const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream');
const { URL } = require('url');
const { checkEnvironment } = require('./db/env-check');
const { getDatabaseUrl, migrate, listTables } = require('./db/migrate');
const hubRuntime = require('./db/hub-runtime');
const erpAdapter = require('./lib/erp-saas-adapter');
const hubSso = require('./lib/hub-sso');
const { handleAdminApi } = require('./lib/hub-rbac-admin');
const hubUploads = require('./lib/hub-uploads');
const hubRegisterAttachments = require('./lib/hub-register-attachments');
const customerAuth = require('./lib/hub-customer-auth');
const hubSession = require('./lib/hub-session');
const hubClientPortal = require('./lib/hub-client-portal');
const hubPoshaOps = require('./lib/hub-posha-ops');
const hubPoshaOs = require('./lib/hub-posha-os');
const productCategories = require('./lib/hub-product-categories');
const productOrders = require('./lib/hub-product-orders');
const platformBooking = require('./lib/hub-platform-booking');
const adSubmissions = require('./lib/hub-ad-submissions');
const productSubmissions = require('./lib/hub-product-submissions');
const systemRentals = require('./lib/hub-system-rentals');
const hubSystemSettings = require('./lib/hub-system-settings');
const hubMarketingCampaigns = require('./lib/hub-marketing-campaigns');
const hubEvents = require('./lib/hub-events');
const hubArticles = require('./lib/hub-articles');

const PORT = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 8080;
const HOST = '0.0.0.0';
const ROOT = path.resolve(__dirname);
const AUTO_MIGRATE = String(process.env.HUB_AUTO_MIGRATE || 'true').toLowerCase() !== 'false';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.pdf': 'application/pdf',
};

const GZIP_EXTS = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt', '.xml', '.mjs']);
const LONG_CACHE_EXTS = new Set(['.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.woff', '.woff2', '.ico']);

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, payload, extraHeaders = {}) {
  send(res, status, JSON.stringify(payload, null, 2), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Hub-Token, X-Hub-User-Role, X-Hub-User-Name, X-File-Name, X-File-Type, Idempotency-Key',
    ...extraHeaders,
  });
}

const JSON_BODY_MAX_BYTES = 32 * 1024 * 1024;

function readBody(req, { maxBytes = JSON_BODY_MAX_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let received = 0;
    req.on('data', (c) => {
      received += c.length;
      if (received > maxBytes) {
        req.destroy();
        const err = new Error('حجم الطلب أكبر من المسموح');
        err.status = 413;
        reject(err);
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function resolveSafePath(pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, relative || 'index.html');
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (filePath !== ROOT && !filePath.startsWith(rootWithSep)) {
    return null;
  }
  return filePath;
}

function cacheControlFor(ext) {
  if (ext === '.html') return 'no-cache';
  if (LONG_CACHE_EXTS.has(ext)) return 'public, max-age=86400, stale-while-revalidate=604800';
  return 'public, max-age=300';
}

function streamFile(filePath, res, headers, useGzip) {
  const src = fs.createReadStream(filePath);
  if (useGzip) {
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
    pipeline(src, zlib.createGzip({ level: 6 }), res, (err) => {
      if (err && !res.headersSent) send(res, 500, 'Compression error');
    });
    return;
  }
  res.writeHead(200, headers);
  pipeline(src, res, (err) => {
    if (err && !res.headersSent) send(res, 500, 'Read error');
  });
}

function serveStatic(req, res) {
  let pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/') pathname = '/index.html';

  const filePath = resolveSafePath(pathname);
  if (!filePath) {
    return send(res, 403, 'Forbidden');
  }

  const adminPages = new Set([
    'dashboard.html',
    'roles-permissions.html',
    'search-admin.html',
    'rent-admin.html',
    'ops-catalog-admin.html',
    'side-project-registrations.html',
  ]);
  const base = path.basename(filePath).toLowerCase();
  if (adminPages.has(base)) {
    const session = hubSession.resolveSession(req);
    if (session.ok && hubSession.isClientLane(session.lane) && !hubSession.isStaffLane(session.lane)) {
      const html =
        '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<title>غير مصرح</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;800&display=swap" rel="stylesheet">' +
        '<style>body{font-family:Cairo,sans-serif;background:#fff5f5;color:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}' +
        '.box{background:#fff;border:1px solid #fecaca;border-radius:16px;padding:28px;max-width:420px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.06)}' +
        'a{color:#d70000;font-weight:800;text-decoration:none}</style></head><body><div class="box">' +
        '<h1 style="margin:0 0 10px">ليس لديك صلاحية للوصول إلى هذه الصفحة.</h1>' +
        '<p style="margin:0 0 16px;color:#555;font-weight:700">هذه الصفحة مخصصة لفريق التشغيل فقط.</p>' +
        '<a href="/client.html">العودة إلى مركز العميل</a></div></body></html>';
      return send(res, 403, html, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    }
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      if (pathname !== '/index.html') {
        const fallback = path.join(ROOT, 'index.html');
        return fs.stat(fallback, (e2, st2) => {
          if (e2 || !st2.isFile()) return send(res, 404, 'Not Found');
          const headers = {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          };
          const accept = String(req.headers['accept-encoding'] || '');
          streamFile(fallback, res, headers, /\bgzip\b/.test(accept));
        });
      }
      return send(res, 404, 'Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const accept = String(req.headers['accept-encoding'] || '');
    const useGzip = GZIP_EXTS.has(ext) && /\bgzip\b/.test(accept) && stat.size >= 1024;
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': cacheControlFor(ext),
    };
    streamFile(filePath, res, headers, useGzip);
  });
}

async function checkDatabase() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return { linked: false, status: 'missing', message: 'DATABASE_URL غير موجودة' };
  }

  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: databaseUrl,
      ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? false : { rejectUnauthorized: false },
    });
    await client.connect();
    const result = await client.query('select 1 as ok');
    const tables = await client.query(`
      SELECT COUNT(*)::int AS n
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    let hubOrders = null;
    try {
      const orders = await client.query('SELECT COUNT(*)::int AS n FROM hub_orders');
      hubOrders = orders.rows[0]?.n || 0;
    } catch {
      hubOrders = null;
    }
    await client.end();
    return {
      linked: true,
      status: 'connected',
      message: 'قاعدة البيانات متصلة',
      ok: result.rows[0]?.ok === 1,
      tables: tables.rows[0]?.n || 0,
      hubOrders,
    };
  } catch (error) {
    return {
      linked: true,
      status: 'error',
      message: error.message || 'فشل الاتصال بقاعدة البيانات',
    };
  }
}


function buildAiAgentReply(message = '', meta = {}) {
  const q = String(message || '').toLowerCase();
  const rules = [
    { keys: ['متجر', 'شراء', 'باقة', 'سعر', 'store'], text: 'افتح متجر المبيعات، اختر المنتج، ثم اشترِ الآن. الأسعار بالدولار مثل 400$.' },
    { keys: ['غرفة', 'عمليات', 'dashboard'], text: 'غرفة العمليات تحتاج تسجيل دخول، ومنها تدير المتجر والإعلانات والفروع والمؤشرات.' },
    { keys: ['فرع', 'فروع'], text: 'من صفحة الفروع ابحث بالدولة أو صفِّ حسب النوع ثم اعرض التفاصيل.' },
    { keys: ['حاضن'], text: 'الحاضنات تربط مشروعك بقطاع ومنصة ومكتب تشغيلي داخل هوب.' },
    { keys: ['دورة', 'دبلوم', 'أكاديم'], text: 'سجّل الدورات/الدبلومات عبر المتجر ثم ادخل الأكاديمية بعد التفعيل.' },
    { keys: ['إعلان', 'اعلان'], text: 'استوديو الإعلانات ينشر عروض المنتجات والمنصات حسب المستوى التشغيلي.' },
    { keys: ['مشروع', 'جانبي'], text: 'محرك المشاريع الجانبية يقترح فرصًا حسب رأس المال والمهارات مع مسار اختبار.' },
    { keys: ['نظام', 'أنظمة', 'apps', 'fit', 'فيت'], text: 'من الأنظمة أو المواقع الجاهزة افتح النظام المطلوب بعد تفعيل الاشتراك من المتجر.' },
  ];
  const hit = rules.find((r) => r.keys.some((k) => q.includes(String(k).toLowerCase())));
  const base = hit
    ? hit.text
    : 'أنا وكيل نايوش هوب: أوجّهك للمتجر والأنظمة والدورات والفروع والحاضنات وغرفة العمليات. اكتب طلبك بوضوح.';
  const mode = meta.guest ? 'وضع الضيف' : 'وضع مسجّل';
  return `${base}\n\n(${mode} · صفحة: ${meta.path || '/'})`;
}

function requireHubStaffOrReject(req, res, permission = null) {
  try {
    return hubSession.requireStaff(req, permission);
  } catch (err) {
    sendJson(res, err.status || 403, { ok: false, success: false, error: err.message || 'غير مصرح' });
    return null;
  }
}

function requireHubAuthOrReject(req, res) {
  try {
    return hubSession.requireAuth(req);
  } catch (err) {
    sendJson(res, err.status || 401, { ok: false, success: false, error: err.message || 'مطلوب تسجيل الدخول' });
    return null;
  }
}

async function handleHubApi(req, res, pathname) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return true;
  }

  if (pathname.startsWith('/api/hub/articles')) {
    await hubArticles.handleApi(req, res, pathname, {
      sendJson,
      readBody,
      requireStaff: requireHubStaffOrReject,
      requireAuth: requireHubAuthOrReject,
    });
    return true;
  }

  if (pathname.startsWith('/api/hub/events')) {
    await hubEvents.handleApi(req, res, pathname, {
      sendJson,
      readBody,
      requireStaff: requireHubStaffOrReject,
      requireAuth: requireHubAuthOrReject,
    });
    return true;
  }

  if (pathname.startsWith('/api/hub/marketing-campaigns')) {
    await hubMarketingCampaigns.handleApi(req, res, pathname, {
      sendJson,
      readBody,
      requireStaff: requireHubStaffOrReject,
    });
    return true;
  }

  if (pathname === '/api/hub/notifications' && req.method === 'GET') {
    const items = hubRuntime.listNotifications(100);
    sendJson(res, 200, { ok: true, count: items.length, unread: items.filter((n) => !n.read).length, items });
    return true;
  }

  if (pathname === '/api/hub/notifications' && req.method === 'POST') {
    if (!requireHubAuthOrReject(req, res)) return true;
    const body = await readBody(req);
    const item = hubRuntime.addNotification(body);
    sendJson(res, 201, { ok: true, item });
    return true;
  }

  if (pathname === '/api/hub/notifications/read' && req.method === 'POST') {
    if (!requireHubAuthOrReject(req, res)) return true;
    const body = await readBody(req);
    const items = hubRuntime.markRead(body.id, !!body.all);
    sendJson(res, 200, { ok: true, items });
    return true;
  }

  if (pathname === '/api/hub/sync' && req.method === 'POST') {
    if (!requireHubAuthOrReject(req, res)) return true;
    const body = await readBody(req);
    const result = hubRuntime.ingestSync(body);
    sendJson(res, 200, { ok: true, ...result });
    return true;
  }

  if (pathname === '/api/hub/apps' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, apps: hubRuntime.listApps(), synced: hubRuntime.getSynced() });
    return true;
  }

  if (pathname === '/api/hub/apps' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const result = hubRuntime.registerApp(body || {});
      sendJson(res, 201, { ok: true, app: result.app });
    } catch (err) {
      sendJson(res, err.status || 400, {
        ok: false,
        error: err.message || 'تعذر إضافة النظام.',
        field: err.field,
      });
    }
    return true;
  }

  // —— منتجات الكتالوج + طلبات الشراء (Checkout) ——
  const productMatch = pathname.match(/^\/api\/hub\/products\/([^/]+)$/);
  if (productMatch && req.method === 'GET') {
    const product = productOrders.publicProduct(productOrders.findProduct(decodeURIComponent(productMatch[1])));
    if (!product) {
      sendJson(res, 404, { ok: false, error: 'تعذر تحميل بيانات المنتج. حاول مرة أخرى.' });
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      product,
      statusLabels: productOrders.STATUS_LABELS,
      paymentLabels: productOrders.PAYMENT_LABELS,
    });
    return true;
  }

  if (pathname === '/api/hub/product-orders/meta' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      orderStatuses: productOrders.ORDER_STATUSES,
      statusLabels: productOrders.STATUS_LABELS,
      paymentLabels: productOrders.PAYMENT_LABELS,
    });
    return true;
  }

  if (pathname === '/api/hub/product-orders' && req.method === 'GET') {
    let session;
    try {
      session = hubSession.requireAuth(req);
    } catch (err) {
      sendJson(res, err.status || 401, { ok: false, error: err.message || 'يرجى تسجيل الدخول لإكمال الشراء.' });
      return true;
    }
    const staff = hubSession.isStaffLane(session.lane);
    const orders = productOrders.listOrders({ email: session.email, staff });
    sendJson(res, 200, {
      ok: true,
      staff,
      count: orders.length,
      orders,
      statusLabels: productOrders.STATUS_LABELS,
      paymentLabels: productOrders.PAYMENT_LABELS,
    });
    return true;
  }

  if (pathname === '/api/hub/product-orders' && req.method === 'POST') {
    let session;
    try {
      session = hubSession.requireAuth(req);
    } catch (err) {
      sendJson(res, err.status || 401, { ok: false, error: 'يرجى تسجيل الدخول لإكمال الشراء.' });
      return true;
    }
    const body = await readBody(req);
    try {
      const customer = {
            id: session.userId || session.id || session.email,
            clientId: (() => {
              try {
                const st = hubClientPortal.readStore();
                return hubClientPortal.ensureClient(st, session.email, session.name)?.clientId;
              } catch {
                return session.email;
              }
            })(),
            email: session.email,
        name: body?.customer?.name || body?.customerName || session.name || session.fullName || session.email,
        phone: body?.customer?.phone || body?.customerPhone || session.phone || '',
        country: body?.customer?.country || body?.customerCountry || session.country || '',
        company: body?.customer?.company || body?.customerCompany || '',
      };
      const lines = Array.isArray(body?.items) && body.items.length
        ? body.items
        : [{ productId: body?.productId, qty: body?.qty || 1, clientPrice: body?.clientPrice }];
      const created = [];
      const persistJobs = [];
      const baseKey = String(body?.idempotencyKey || '').trim();
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] || {};
        const result = productOrders.createOrder({
          productId: line.productId || body?.productId,
          qty: line.qty || 1,
          customer,
          paymentMode: body?.paymentMode === 'demo' ? 'demo' : 'demo',
          source: body?.source === 'cart' ? 'cart' : 'buy_now',
          idempotencyKey: baseKey ? `${baseKey}:${i}:${line.productId || body?.productId}` : undefined,
          clientPrice: line.clientPrice != null ? line.clientPrice : body?.clientPrice,
        });
        created.push(result);
        if (result?.persisted) persistJobs.push(result.persisted);
      }
      const persistResults = persistJobs.length ? await Promise.all(persistJobs) : [];
      const dbPersisted = persistResults.length > 0 && persistResults.every((r) => r && r.ok);
      try {
        const portalStore = hubClientPortal.readStore();
        created.forEach((c) => {
          const order = c?.order;
          if (!order) return;
          hubPoshaOps.emitEvent(portalStore, {
            type: 'ORDER_CREATED',
            clientEmail: order.customerEmail,
            actorId: session.email,
            actorRole: 'client',
            title: 'تم إنشاء طلبك',
            message: `طلب ${order.number} — ${order.productName}`,
            metadata: { orderId: order.id, orderNumber: order.number, invoiceNumber: order.invoiceNumber },
            forceClient: true,
            forceAdmin: true,
          });
        });
        hubClientPortal.writeStore(portalStore);
      } catch {
        /* notification must not fail checkout */
      }
      sendJson(res, 201, {
        ok: true,
        duplicate: created.every((c) => c.duplicate),
        dbPersisted,
        order: created[0]?.order || null,
        orders: created.map((c) => c.order),
        statusLabels: productOrders.STATUS_LABELS,
        paymentLabels: productOrders.PAYMENT_LABELS,
      });
    } catch (err) {
      sendJson(res, err.status || 400, {
        ok: false,
        error: err.message || 'تعذر إنشاء الطلب.',
        code: err.code || undefined,
        officialPrice: err.officialPrice,
      });
    }
    return true;
  }

  const orderMatch = pathname.match(/^\/api\/hub\/product-orders\/([^/]+)(?:\/(status))?$/);
  if (orderMatch) {
    const orderId = decodeURIComponent(orderMatch[1]);
    const isStatus = orderMatch[2] === 'status';

    if (req.method === 'GET' && !isStatus) {
      let session;
      try {
        session = hubSession.requireAuth(req);
      } catch (err) {
        sendJson(res, err.status || 401, { ok: false, error: err.message || 'Unauthorized' });
        return true;
      }
      try {
        const order = productOrders.getOrder(orderId);
        productOrders.assertCanView(order, session);
        sendJson(res, 200, {
          ok: true,
          order,
          statusLabels: productOrders.STATUS_LABELS,
          paymentLabels: productOrders.PAYMENT_LABELS,
        });
      } catch (err) {
        sendJson(res, err.status || 400, { ok: false, error: err.message || 'تعذر تحميل الطلب' });
      }
      return true;
    }

    if (isStatus && (req.method === 'PATCH' || req.method === 'POST')) {
      let session;
      try {
        session = hubSession.requireStaff(req);
      } catch (err) {
        sendJson(res, err.status || 403, { ok: false, error: err.message || 'Forbidden' });
        return true;
      }
      const body = await readBody(req);
      try {
        const order = productOrders.updateOrderStatus(orderId, body?.status || body?.orderStatus, session);
        sendJson(res, 200, {
          ok: true,
          order,
          statusLabels: productOrders.STATUS_LABELS,
          paymentLabels: productOrders.PAYMENT_LABELS,
        });
      } catch (err) {
        sendJson(res, err.status || 400, { ok: false, error: err.message || 'تعذر تحديث الحالة' });
      }
      return true;
    }
  }

  // —— إعدادات النظام (مصدر مركزي: ملف + hub_meta اختياريًا) ——
  if (pathname === '/api/hub/system-settings' && req.method === 'GET') {
    const url = new URL(req.url, 'http://local');
    const wantPublic = String(url.searchParams.get('public') || '') === '1';
    if (wantPublic) {
      const settings = await hubSystemSettings.getSettings();
      sendJson(res, 200, { ok: true, public: true, brand: hubSystemSettings.getPublicBrand(settings) });
      return true;
    }
    let session;
    try {
      session = hubSession.requireStaff(req);
    } catch (err) {
      sendJson(res, err.status || 403, { ok: false, error: err.message || 'غير مصرح بقراءة إعدادات النظام' });
      return true;
    }
    const settings = await hubSystemSettings.getSettings();
    sendJson(res, 200, {
      ok: true,
      settings,
      labels: hubSystemSettings.KEY_LABELS,
      sections: hubSystemSettings.KEY_SECTIONS,
      actor: { email: session.email, name: session.name, role: session.role },
      storage: { file: hubSystemSettings.DATA_PATH, metaKey: hubSystemSettings.META_KEY },
    });
    return true;
  }

  if (pathname === '/api/hub/system-settings' && (req.method === 'PUT' || req.method === 'POST')) {
    let session;
    try {
      session = hubSession.requireStaff(req);
    } catch (err) {
      console.error('[system-settings] unauthorized save attempt', err.message);
      sendJson(res, err.status || 403, {
        ok: false,
        error: 'تعذر حفظ التغييرات، يرجى المحاولة مرة أخرى.',
        detail: err.message || 'غير مصرح',
      });
      return true;
    }
    try {
      const body = await readBody(req);
      const patch = body?.settings && typeof body.settings === 'object' ? body.settings : body || {};
      const actor = {
        email: session.email,
        name: session.name || session.email,
        employeeNo: body?.employeeNo || session.userId || session.email,
        userId: session.userId,
        role: session.role,
      };
      const result = await hubSystemSettings.saveSettings(patch, actor);
      sendJson(res, 200, {
        ok: true,
        message: 'تم حفظ التغييرات بنجاح',
        settings: result.settings,
        changedKeys: result.changedKeys,
        auditEntries: result.auditEntries,
        storage: result.storage,
      });
    } catch (err) {
      console.error('[system-settings] save failed', err);
      sendJson(res, err.status || 500, {
        ok: false,
        error: 'تعذر حفظ التغييرات، يرجى المحاولة مرة أخرى.',
      });
    }
    return true;
  }

  if (pathname === '/api/hub/system-settings/reset' && req.method === 'POST') {
    let session;
    try {
      session = hubSession.requireStaff(req);
    } catch (err) {
      sendJson(res, err.status || 403, {
        ok: false,
        error: 'تعذر حفظ التغييرات، يرجى المحاولة مرة أخرى.',
        detail: err.message || 'غير مصرح',
      });
      return true;
    }
    try {
      const body = await readBody(req).catch(() => ({}));
      const actor = {
        email: session.email,
        name: session.name || session.email,
        employeeNo: body?.employeeNo || session.userId || session.email,
        userId: session.userId,
        role: session.role,
      };
      const result = await hubSystemSettings.resetSettings(actor);
      sendJson(res, 200, {
        ok: true,
        message: 'تم حفظ التغييرات بنجاح',
        settings: result.settings,
        changedKeys: result.changedKeys,
        auditEntries: result.auditEntries,
        storage: result.storage,
      });
    } catch (err) {
      console.error('[system-settings] reset failed', err);
      sendJson(res, 500, { ok: false, error: 'تعذر حفظ التغييرات، يرجى المحاولة مرة أخرى.' });
    }
    return true;
  }

  // —— تصنيفات المنتجات (مصدر مركزي) ——
  if (pathname === '/api/hub/product-categories' && req.method === 'GET') {
    let includeInactive = String(new URL(req.url, 'http://local').searchParams.get('includeInactive') || '') === '1';
    let isStaff = false;
    try {
      hubSession.requireStaff(req);
      isStaff = true;
    } catch {
      includeInactive = false;
    }
    const data = productCategories.list({ includeInactive: includeInactive && isStaff });
    sendJson(res, 200, {
      ok: true,
      canManage: isStaff,
      count: data.items.length,
      all: data.all,
      items: isStaff ? data.items : data.items.filter((c) => c.status !== 'inactive'),
      shop: data.shop,
    });
    return true;
  }

  if (pathname === '/api/hub/product-categories' && req.method === 'POST') {
    try {
      hubSession.requireStaff(req);
    } catch (err) {
      sendJson(res, err.status || 403, { ok: false, error: err.message || 'Forbidden' });
      return true;
    }
    const body = await readBody(req);
    try {
      const item = productCategories.create(body || {});
      sendJson(res, 201, { ok: true, item });
    } catch (err) {
      sendJson(res, err.status || 400, { ok: false, error: err.message || 'تعذر إنشاء التصنيف' });
    }
    return true;
  }

  const catMatch = pathname.match(/^\/api\/hub\/product-categories\/([^/]+)(?:\/(delete))?$/);
  if (catMatch) {
    const catId = decodeURIComponent(catMatch[1]);
    const isDeletePath = catMatch[2] === 'delete' || req.method === 'DELETE';

    if (req.method === 'PATCH' || (req.method === 'POST' && !isDeletePath && pathname.endsWith('/update'))) {
      try {
        hubSession.requireStaff(req);
      } catch (err) {
        sendJson(res, err.status || 403, { ok: false, error: err.message || 'Forbidden' });
        return true;
      }
      const body = await readBody(req);
      try {
        const result = productCategories.update(catId, body || {});
        sendJson(res, 200, { ok: true, ...result });
      } catch (err) {
        sendJson(res, err.status || 400, { ok: false, error: err.message || 'تعذر تحديث التصنيف' });
      }
      return true;
    }

    if (isDeletePath && (req.method === 'DELETE' || req.method === 'POST')) {
      try {
        hubSession.requireStaff(req);
      } catch (err) {
        sendJson(res, err.status || 403, { ok: false, error: err.message || 'Forbidden' });
        return true;
      }
      const body = await readBody(req).catch(() => ({}));
      const productCount = Number(body?.productCount || 0);
      const replacementId = body?.replacementId || body?.replacementCategoryId || '';
      if (productCount > 0 && !replacementId) {
        sendJson(res, 409, {
          ok: false,
          error: `هذا التصنيف مرتبط بـ ${productCount} منتجات. اختر تصنيفًا بديلًا لنقل المنتجات إليه قبل الحذف.`,
          needsReplacement: true,
          productCount,
        });
        return true;
      }
      try {
        const result = productCategories.remove(catId, { replacementId });
        sendJson(res, 200, {
          ok: true,
          deleted: result.deleted,
          replacement: result.replacement,
          reassignFrom: result.deleted?.id,
          reassignTo: result.replacement?.id || null,
        });
      } catch (err) {
        sendJson(res, err.status || 400, { ok: false, error: err.message || 'تعذر حذف التصنيف' });
      }
      return true;
    }
  }

  if (pathname.startsWith('/api/hub/synced/') && req.method === 'GET') {
    const code = pathname.split('/').pop();
    sendJson(res, 200, { ok: true, item: hubRuntime.getSynced(code) });
    return true;
  }

  // —— كتالوج محرك البحث (أدمن) ——
  const catalogPath = path.join(ROOT, 'data', 'search-catalog.json');
  const ensureCatalogFile = () => {
    const dir = path.dirname(catalogPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(catalogPath)) {
      fs.writeFileSync(catalogPath, JSON.stringify({ version: 1, items: [] }, null, 2), 'utf8');
    }
  };
  const readCatalogFile = () => {
    ensureCatalogFile();
    try {
      const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
      const config = raw?.config && typeof raw.config === 'object' ? raw.config : null;
      return { items, config };
    } catch {
      return { items: [], config: null };
    }
  };
  const writeCatalogFile = (items, config) => {
    ensureCatalogFile();
    let prevConfig = null;
    try {
      const prev = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      prevConfig = prev?.config || null;
    } catch (_) {}
    fs.writeFileSync(
      catalogPath,
      JSON.stringify(
        {
          version: 1,
          updatedAt: new Date().toISOString(),
          items,
          config: config && typeof config === 'object' ? config : prevConfig,
        },
        null,
        2
      ),
      'utf8'
    );
  };

  if (pathname === '/api/hub/search-catalog' && req.method === 'GET') {
    const { items, config } = readCatalogFile();
    sendJson(res, 200, { ok: true, count: items.length, items, config });
    return true;
  }

  if (pathname === '/api/hub/search-catalog' && req.method === 'POST') {
    if (!requireHubStaffOrReject(req, res)) return true;
    const body = await readBody(req);
    const items = Array.isArray(body?.items) ? body.items : [];
    const config = body?.config && typeof body.config === 'object' ? body.config : undefined;
    writeCatalogFile(items, config);
    sendJson(res, 200, { ok: true, count: items.length });
    return true;
  }

  if (pathname === '/api/hub/ad-submissions' && req.method === 'GET') {
    let session;
    try {
      session = hubSession.requireAuth(req);
    } catch (err) {
      sendJson(res, err.status || 401, { ok: false, error: err.message || 'مطلوب تسجيل الدخول' });
      return true;
    }
    const staff = hubSession.isStaffLane(session.lane);
    const list = adSubmissions.listSubmissions({ email: session.email, staff });
    sendJson(res, 200, {
      ok: true,
      staff,
      count: list.length,
      submissions: list,
      requests: list.map((s) => adSubmissions.toAdminRequest(s)),
    });
    return true;
  }

  if (pathname === '/api/hub/ad-submissions' && req.method === 'POST') {
    const body = await readBody(req);
    const session = hubSession.resolveSession(req);
    const authed = session.ok ? session : null;
    try {
      const result = adSubmissions.createSubmission({
        session: authed,
        guestContact: body?.owner || body?.guestContact || body?.contact || null,
        ad: body?.ad || body || {},
        idempotencyKey: body?.idempotencyKey || '',
        claimedCustomerId: body?.customerId || body?.claimedCustomerId || '',
      });
      const persistResults = result.persisted ? await result.persisted : { ok: false };
      try {
        if (result.submission && !result.duplicate) {
          const portalStore = hubClientPortal.readStore();
          hubPoshaOps.emitEvent(portalStore, {
            type: 'AD_SUBMISSION_CREATED',
            clientEmail: result.submission.ownerEmail,
            actorId: result.submission.ownerEmail,
            actorRole: result.submission.ownerType === 'Customer' ? 'client' : 'guest',
            title: 'طلب نشر إعلان',
            message: `طلب ${result.submission.requestId} — ${result.submission.title}`,
            metadata: {
              requestId: result.submission.requestId,
              adId: result.submission.adId,
              adCode: result.submission.adCode,
              ownerType: result.submission.ownerType,
              customerId: result.submission.customerId,
              guestContactId: result.submission.guestContactId,
            },
            forceClient: result.submission.ownerType === 'Customer',
            forceAdmin: true,
          });
          hubClientPortal.writeStore(portalStore);
        }
      } catch {
        /* notification must not fail submit */
      }
      sendJson(res, result.duplicate ? 200 : 201, {
        ok: true,
        duplicate: !!result.duplicate,
        dbPersisted: !!(persistResults && persistResults.ok),
        submission: result.submission,
        request: adSubmissions.toAdminRequest(result.submission),
      });
    } catch (err) {
      sendJson(res, err.status || 400, {
        ok: false,
        error: err.message || 'تعذر إرسال الإعلان.',
        field: err.field,
        code: err.code,
      });
    }
    return true;
  }

  const adSubMatch = pathname.match(/^\/api\/hub\/ad-submissions\/([^/]+)$/);
  if (adSubMatch && req.method === 'GET') {
    let session;
    try {
      session = hubSession.requireAuth(req);
    } catch (err) {
      sendJson(res, err.status || 401, { ok: false, error: err.message || 'مطلوب تسجيل الدخول' });
      return true;
    }
    try {
      const submission = adSubmissions.getSubmission(decodeURIComponent(adSubMatch[1]));
      adSubmissions.assertCanView(submission, session);
      sendJson(res, 200, {
        ok: true,
        submission,
        request: adSubmissions.toAdminRequest(submission),
      });
    } catch (err) {
      sendJson(res, err.status || 400, { ok: false, error: err.message || 'تعذر تحميل الطلب' });
    }
    return true;
  }

  if (pathname === '/api/hub/product-submissions/published' && req.method === 'GET') {
    const list = productSubmissions.listPublished();
    sendJson(res, 200, {
      ok: true,
      count: list.length,
      items: list.map((s) => productSubmissions.toStoreItem(s)).filter(Boolean),
      submissions: list.map((s) => ({
        productId: s.productId,
        requestId: s.requestId,
        title: s.title,
        status: s.status,
        publishedAt: s.publishedAt || s.approvedAt || s.updatedAt,
      })),
    });
    return true;
  }

  if (pathname === '/api/hub/product-submissions' && req.method === 'GET') {
    let session;
    try {
      session = hubSession.requireAuth(req);
    } catch (err) {
      sendJson(res, err.status || 401, { ok: false, error: err.message || 'مطلوب تسجيل الدخول' });
      return true;
    }
    const staff = hubSession.isStaffLane(session.lane);
    const list = productSubmissions.listSubmissions({ email: session.email, staff });
    sendJson(res, 200, {
      ok: true,
      staff,
      count: list.length,
      submissions: list,
      requests: list.map((s) => productSubmissions.toAdminRequest(s)),
    });
    return true;
  }

  if (pathname === '/api/hub/product-submissions' && req.method === 'POST') {
    const body = await readBody(req);
    const session = hubSession.resolveSession(req);
    const authed = session.ok ? session : null;
    try {
      const result = productSubmissions.createSubmission({
        session: authed,
        guestContact: body?.owner || body?.guestContact || body?.contact || null,
        product: body?.product || body || {},
        idempotencyKey: body?.idempotencyKey || '',
        claimedCustomerId: body?.customerId || body?.claimedCustomerId || '',
      });
      const persistResults = result.persisted ? await result.persisted : { ok: false };
      try {
        if (result.submission && !result.duplicate) {
          const portalStore = hubClientPortal.readStore();
          hubPoshaOps.emitEvent(portalStore, {
            type: 'PRODUCT_SUBMISSION_CREATED',
            clientEmail: result.submission.ownerEmail,
            actorId: result.submission.ownerEmail,
            actorRole: result.submission.ownerType === 'Customer' ? 'client' : 'guest',
            title: 'طلب إضافة منتج',
            message: `طلب ${result.submission.requestId} — ${result.submission.title}`,
            metadata: {
              requestId: result.submission.requestId,
              productId: result.submission.productId,
              ownerType: result.submission.ownerType,
              customerId: result.submission.customerId,
              guestContactId: result.submission.guestContactId,
            },
            forceClient: result.submission.ownerType === 'Customer',
            forceAdmin: true,
          });
          hubClientPortal.writeStore(portalStore);
        }
      } catch {
        /* notification must not fail submit */
      }
      sendJson(res, result.duplicate ? 200 : 201, {
        ok: true,
        duplicate: !!result.duplicate,
        dbPersisted: !!(persistResults && persistResults.ok),
        submission: result.submission,
        request: productSubmissions.toAdminRequest(result.submission),
      });
    } catch (err) {
      sendJson(res, err.status || 400, {
        ok: false,
        error: err.message || 'تعذر إرسال المنتج.',
        field: err.field,
        code: err.code,
      });
    }
    return true;
  }

  const prdSubMatch = pathname.match(/^\/api\/hub\/product-submissions\/([^/]+)(?:\/(status))?$/);
  if (prdSubMatch) {
    const subId = decodeURIComponent(prdSubMatch[1]);
    const isStatus = prdSubMatch[2] === 'status';

    if (req.method === 'GET' && !isStatus) {
      let session;
      try {
        session = hubSession.requireAuth(req);
      } catch (err) {
        sendJson(res, err.status || 401, { ok: false, error: err.message || 'مطلوب تسجيل الدخول' });
        return true;
      }
      try {
        const submission = productSubmissions.getSubmission(subId);
        productSubmissions.assertCanView(submission, session);
        sendJson(res, 200, {
          ok: true,
          submission,
          request: productSubmissions.toAdminRequest(submission),
        });
      } catch (err) {
        sendJson(res, err.status || 400, { ok: false, error: err.message || 'تعذر تحميل الطلب' });
      }
      return true;
    }

    if (isStatus && (req.method === 'PATCH' || req.method === 'POST')) {
      let session;
      try {
        session = hubSession.requireStaff(req);
      } catch (err) {
        sendJson(res, err.status || 403, { ok: false, error: err.message || 'Forbidden' });
        return true;
      }
      const body = await readBody(req);
      try {
        const submission = productSubmissions.updateStatus(subId, String(body?.status || ''), session, {
          reason: body?.reason || body?.note || '',
        });
        sendJson(res, 200, {
          ok: true,
          submission,
          request: productSubmissions.toAdminRequest(submission),
        });
      } catch (err) {
        sendJson(res, err.status || 400, { ok: false, error: err.message || 'تعذر تحديث الحالة' });
      }
      return true;
    }
  }

  if (pathname === '/api/hub/uploads' && req.method === 'POST') {
    if (!requireHubAuthOrReject(req, res)) return true;
    try {
      const saved = await hubUploads.saveRequestToFile(req);
      sendJson(res, 201, { ok: true, ...saved, maxBytes: hubUploads.MAX_UPLOAD_BYTES, maxMb: hubUploads.MAX_UPLOAD_MB });
    } catch (error) {
      if (!res.headersSent) {
        sendJson(res, error.status || 500, { ok: false, error: error.message || 'فشل رفع الملف' });
      }
      if (error.status === 413) req.destroy();
    }
    return true;
  }

  if (pathname === '/api/hub/upload-limits' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      maxMb: hubUploads.MAX_UPLOAD_MB,
      maxBytes: hubUploads.MAX_UPLOAD_BYTES,
      videoMaxMb: hubUploads.MAX_UPLOAD_MB,
      videoMaxBytes: hubUploads.MAX_UPLOAD_BYTES,
    });
    return true;
  }

  // —— طلبات «سجل معنا» + المرفقات المرتبطة بنفس Request ID ——
  if (pathname === '/api/hub/register-requests' && req.method === 'POST') {
    const body = await readBody(req);
    const adminName = String(body?.adminName || body?.fullName || '').trim();
    const adminPhone = String(body?.adminPhone || body?.phone || '').trim();
    const adminEmail = String(body?.adminEmail || body?.email || '').trim().toLowerCase();
    const adminPassword = String(body?.adminPassword || body?.password || '');
    const subdomain = String(body?.subdomain || body?.slug || '').trim().toLowerCase();
    if (!adminName || !adminPhone || !adminEmail || !adminPassword) {
      sendJson(res, 400, { ok: false, error: 'يرجى ملء جميع الحقول المطلوبة' });
      return true;
    }
    if (adminPassword.length < 8) {
      sendJson(res, 400, { ok: false, error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
      return true;
    }
    if (!subdomain || subdomain.length < 2) {
      sendJson(res, 400, { ok: false, error: 'النطاق الفرعي غير صالح' });
      return true;
    }
    const { request, uploadToken } = hubRegisterAttachments.createRegisterRequest({
      ...body,
      adminName,
      adminPhone,
      adminEmail,
      adminPassword,
      subdomain,
      slug: subdomain,
      host: body?.host || `${subdomain}.naiosh.app`,
    });
    sendJson(res, 201, {
      ok: true,
      requestId: request.id,
      status: request.status,
      statusLabel: request.statusLabel,
      uploadToken,
      request: hubRegisterAttachments.publicRequest(request),
    });
    return true;
  }

  const registerReqMatch = pathname.match(/^\/api\/hub\/register-requests\/([^/]+)(?:\/(attachments(?:\/([^/]+))?)?)?$/);
  if (registerReqMatch) {
    const requestId = decodeURIComponent(registerReqMatch[1]);
    const sub = registerReqMatch[2] || '';
    const attachmentId = registerReqMatch[3] ? decodeURIComponent(registerReqMatch[3]) : '';

    if (req.method === 'GET' && !sub) {
      const token = String(req.headers['x-register-upload-token'] || '').trim();
      let staff = false;
      try {
        const session = hubSession.requireStaff(req);
        staff = !!session;
      } catch {
        staff = false;
      }
      const bundle = hubRegisterAttachments.getRequestBundle(requestId, { uploadToken: token, staff });
      if (!bundle.ok) {
        sendJson(res, bundle.status || 403, { ok: false, error: bundle.error });
        return true;
      }
      sendJson(res, 200, bundle);
      return true;
    }

    if (req.method === 'POST' && sub === 'attachments') {
      const token = String(req.headers['x-register-upload-token'] || '').trim();
      const category = String(req.headers['x-attachment-category'] || req.headers['x-file-category'] || '').trim().toLowerCase();
      try {
        const attachment = await hubRegisterAttachments.saveAttachmentFromRequest(req, {
          requestId,
          uploadToken: token,
          category: category || undefined,
        });
        sendJson(res, 201, {
          ok: true,
          attachment,
          contentUrl: `/api/hub/register-attachments/${encodeURIComponent(attachment.id)}/content`,
          maxBytes: hubUploads.MAX_UPLOAD_BYTES,
          maxMb: hubUploads.MAX_UPLOAD_MB,
        });
      } catch (error) {
        if (!res.headersSent) {
          sendJson(res, error.status || 500, { ok: false, error: error.message || 'فشل رفع المرفق', code: error.code });
        }
        try {
          req.resume();
          // أغلق فقط عند رفض الحجم حتى لا يعلق السيرفر بانتظار باقي Content-Length
          if (error.status === 413) req.destroy();
        } catch {
          /* ignore */
        }
      }
      return true;
    }

    if (req.method === 'DELETE' && attachmentId) {
      const token = String(req.headers['x-register-upload-token'] || '').trim();
      let staff = false;
      try {
        hubSession.requireStaff(req);
        staff = true;
      } catch {
        staff = false;
      }
      const result = hubRegisterAttachments.deleteAttachment(attachmentId, { uploadToken: token, staff });
      if (!result.ok) {
        sendJson(res, result.status || 403, { ok: false, error: result.error });
        return true;
      }
      sendJson(res, 200, { ok: true });
      return true;
    }
  }

  const registerAttMatch = pathname.match(/^\/api\/hub\/register-attachments\/([^/]+)(?:\/(content))?$/);
  if (registerAttMatch) {
    const attachmentId = decodeURIComponent(registerAttMatch[1]);
    const wantContent = registerAttMatch[2] === 'content';
    const token = String(req.headers['x-register-upload-token'] || '').trim();
    let session = null;
    try {
      session = hubSession.resolveSession(req);
      if (!session.ok) session = null;
    } catch {
      session = null;
    }
    const access = hubRegisterAttachments.canAccessAttachment(attachmentId, session, token);
    if (!access.ok) {
      sendJson(res, access.status || 403, { ok: false, error: access.error });
      return true;
    }
    if (req.method === 'GET' && !wantContent) {
      sendJson(res, 200, {
        ok: true,
        attachment: access.attachment,
        contentUrl: `/api/hub/register-attachments/${encodeURIComponent(attachmentId)}/content`,
      });
      return true;
    }
    if (req.method === 'GET' && wantContent) {
      const filePath = hubUploads.resolveUploadPath(access.attachment.storageRef);
      if (!filePath || !fs.existsSync(filePath)) {
        sendJson(res, 404, { ok: false, error: 'الملف غير موجود في التخزين' });
        return true;
      }
      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime = access.attachment.mimeType || hubUploads.mimeForExt(ext) || 'application/octet-stream';
      const disposition =
        access.attachment.category === 'image' || access.attachment.category === 'video' || mime === 'application/pdf'
          ? 'inline'
          : 'attachment';
      const original = String(access.attachment.originalFileName || access.attachment.fileName || 'file').replace(/"/g, '');
      streamFile(
        filePath,
        res,
        {
          'Content-Type': mime,
          'Content-Length': String(stat.size),
          'Cache-Control': 'private, no-store',
          'Content-Disposition': `${disposition}; filename="${original}"`,
          'X-Content-Type-Options': 'nosniff',
        },
        false
      );
      return true;
    }
  }

  if (pathname === '/api/hub/system-rentals' && req.method === 'GET') {
    const session = hubSession.resolveSession(req);
    const state = systemRentals.listForSession(session.ok ? session : null);
    sendJson(res, 200, { ok: true, state, staff: !!(session.ok && hubSession.isStaffLane(session.lane)) });
    return true;
  }

  if (pathname === '/api/hub/system-rentals/submit' && req.method === 'POST') {
    const body = await readBody(req);
    const session = hubSession.resolveSession(req);
    const authed = session.ok ? session : null;
    try {
      const result = systemRentals.createRental({
        session: authed,
        contact: body?.owner || body?.contact || {
          name: body?.adminName || body?.rental?.adminName,
          email: body?.adminEmail || body?.rental?.adminEmail,
          phone: body?.adminPhone || body?.rental?.adminPhone,
        },
        rental: body?.rental || body || {},
        idempotencyKey: body?.idempotencyKey || '',
        claimedCustomerId: body?.customerId || body?.claimedCustomerId || '',
      });
      sendJson(res, result.duplicate ? 200 : 201, {
        ok: true,
        duplicate: !!result.duplicate,
        rental: result.rental,
      });
    } catch (err) {
      sendJson(res, err.status || 400, {
        ok: false,
        error: err.message || 'تعذر إرسال طلب الاستئجار.',
        field: err.field,
        code: err.code,
      });
    }
    return true;
  }

  const rentStatusMatch = pathname.match(/^\/api\/hub\/system-rentals\/([^/]+)\/status$/);
  if (rentStatusMatch && (req.method === 'PATCH' || req.method === 'POST')) {
    let session;
    try {
      session = hubSession.requireStaff(req);
    } catch (err) {
      sendJson(res, err.status || 403, { ok: false, error: err.message || 'Forbidden' });
      return true;
    }
    const body = await readBody(req);
    try {
      const rental = systemRentals.updateRentalStatus(
        decodeURIComponent(rentStatusMatch[1]),
        String(body?.status || ''),
        session,
        { reason: body?.reason || body?.note || '' }
      );
      sendJson(res, 200, { ok: true, rental });
    } catch (err) {
      sendJson(res, err.status || 400, { ok: false, error: err.message || 'تعذر تحديث الحالة' });
    }
    return true;
  }

  if (pathname === '/api/hub/system-rentals' && req.method === 'POST') {
    // Staff-only full-store replace (legacy admin sync)
    let session;
    try {
      session = hubSession.requireStaff(req);
    } catch (err) {
      sendJson(res, err.status || 403, { ok: false, error: err.message || 'Forbidden' });
      return true;
    }
    const body = await readBody(req);
    try {
      const state = systemRentals.replaceStoreForStaff(body, session);
      sendJson(res, 200, { ok: true, count: state.rentals.length, state });
    } catch (err) {
      sendJson(res, err.status || 400, { ok: false, error: err.message || 'تعذر الحفظ' });
    }
    return true;
  }

  const platformGrantsPath = path.join(ROOT, 'data', 'platform-grants.json');
  const ensurePlatformGrantsFile = () => {
    const dir = path.dirname(platformGrantsPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(platformGrantsPath)) {
      fs.writeFileSync(platformGrantsPath, JSON.stringify({ version: 1, grants: [] }, null, 2), 'utf8');
    }
  };
  const readPlatformGrantsFile = () => {
    ensurePlatformGrantsFile();
    try {
      return JSON.parse(fs.readFileSync(platformGrantsPath, 'utf8'));
    } catch {
      return { version: 1, grants: [] };
    }
  };
  const writePlatformGrantsFile = (state) => {
    ensurePlatformGrantsFile();
    fs.writeFileSync(
      platformGrantsPath,
      JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
  };

  if (pathname === '/api/hub/platform-grants' && req.method === 'GET') {
    const state = readPlatformGrantsFile();
    sendJson(res, 200, { ok: true, state });
    return true;
  }

  if (pathname === '/api/hub/platform-grants' && req.method === 'POST') {
    if (!requireHubStaffOrReject(req, res)) return true;
    const body = await readBody(req);
    const state = {
      version: 1,
      grants: Array.isArray(body?.grants) ? body.grants : [],
    };
    writePlatformGrantsFile(state);
    sendJson(res, 200, { ok: true, count: state.grants.length });
    return true;
  }

  const platformBookingsPath = path.join(ROOT, 'data', 'platform-bookings.json');
  const ensurePlatformBookingsFile = () => {
    const dir = path.dirname(platformBookingsPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(platformBookingsPath)) {
      fs.writeFileSync(platformBookingsPath, JSON.stringify({ version: 1, bookings: [] }, null, 2), 'utf8');
    }
  };
  const readPlatformBookingsFile = () => {
    ensurePlatformBookingsFile();
    try {
      return JSON.parse(fs.readFileSync(platformBookingsPath, 'utf8'));
    } catch {
      return { version: 1, bookings: [] };
    }
  };
  const writePlatformBookingsFile = (state) => {
    ensurePlatformBookingsFile();
    fs.writeFileSync(
      platformBookingsPath,
      JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
  };

  if (pathname === '/api/hub/platform-bookings' && req.method === 'POST') {
    let session;
    try {
      session = hubSession.requireAuth(req);
    } catch (err) {
      sendJson(res, err.status || 401, {
        ok: false,
        error: 'يلزم تسجيل الدخول لإرسال طلب حجز المنصة.',
        code: 'login_required',
      });
      return true;
    }
    const body = await readBody(req);
    try {
      // Bind booking to the authenticated identity — never trust client-supplied customerId
      const sessionEmail = String(session.email || '').trim().toLowerCase();
      if (sessionEmail) {
        body.email = sessionEmail;
        body.customerId = session.userId || sessionEmail;
      }
      const { booking } = platformBooking.validateAndNormalize(body || {});
      booking.customerId = body.customerId || session.userId || sessionEmail;
      booking.customerEmail = sessionEmail;
      const state = readPlatformBookingsFile();
      state.bookings = Array.isArray(state.bookings) ? state.bookings : [];
      // Idempotency: same authenticated customer + subdomain within a short window → one booking
      const subdomain = String(booking.subdomain || '');
      const recent = state.bookings.find(
        (b) =>
          String(b.customerEmail || b.email || '').toLowerCase() === sessionEmail &&
          String(b.subdomain || '') === subdomain &&
          Date.now() - Date.parse(b.createdAt || 0) < 2 * 60 * 1000
      );
      if (recent) {
        sendJson(res, 200, { ok: true, booking: recent, duplicate: true });
        return true;
      }
      state.bookings.unshift(booking);
      state.bookings = state.bookings.slice(0, 500);
      writePlatformBookingsFile(state);
      sendJson(res, 201, { ok: true, booking });
    } catch (err) {
      sendJson(res, err.status || 400, {
        ok: false,
        error: err.message || 'تعذر تسجيل حجز المنصة.',
        field: err.field,
      });
    }
    return true;
  }

  if (pathname === '/api/hub/my-grant' && req.method === 'GET') {
    const session = requireHubAuthOrReject(req, res);
    if (!session) return true;
    const email = String(new URL(req.url, 'http://localhost').searchParams.get('email') || '')
      .trim()
      .toLowerCase();
    if (!email) {
      sendJson(res, 400, { ok: false, error: 'أدخل الإيميل' });
      return true;
    }
    // Prevent IDOR: clients may only query their own email; staff may query any
    if (hubSession.isClientLane(session.lane) && session.email !== email) {
      sendJson(res, 403, { ok: false, error: 'لا يمكنك الاطلاع على طلبات عميل آخر' });
      return true;
    }
    const state = readPlatformGrantsFile();
    const grant =
      (state.grants || [])
        .filter((g) => String(g.adminEmail || '').toLowerCase() === email)
        .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))[0] ||
      null;
    if (!grant) {
      sendJson(res, 404, { ok: false, error: 'لا يوجد طلب «سجل معنا» لهذا الإيميل' });
      return true;
    }
    const safe = { ...grant };
    delete safe.adminPassword;
    sendJson(res, 200, { ok: true, grant: safe });
    return true;
  }

  const tenantAccountsPath = path.join(ROOT, 'data', 'tenant-accounts.json');
  const ensureTenantAccountsFile = () => {
    const dir = path.dirname(tenantAccountsPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(tenantAccountsPath)) {
      fs.writeFileSync(tenantAccountsPath, JSON.stringify({ version: 1, accounts: [] }, null, 2), 'utf8');
    }
  };
  const readTenantAccountsFile = () => {
    ensureTenantAccountsFile();
    try {
      return JSON.parse(fs.readFileSync(tenantAccountsPath, 'utf8'));
    } catch {
      return { version: 1, accounts: [] };
    }
  };
  const writeTenantAccountsFile = (state) => {
    ensureTenantAccountsFile();
    fs.writeFileSync(
      tenantAccountsPath,
      JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
  };

  if (pathname === '/api/hub/tenant-accounts' && req.method === 'POST') {
    if (!requireHubStaffOrReject(req, res)) return true;
    const body = await readBody(req);
    const accounts = Array.isArray(body?.accounts) ? body.accounts : [];
    writeTenantAccountsFile({ version: 1, accounts });
    sendJson(res, 200, { ok: true, count: accounts.length });
    return true;
  }

  if (pathname === '/api/hub/tenant-account' && req.method === 'POST') {
    if (!requireHubStaffOrReject(req, res)) return true;
    const body = await readBody(req);
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!email || !password) {
      sendJson(res, 400, { ok: false, error: 'الإيميل وكلمة المرور مطلوبان' });
      return true;
    }
    const state = readTenantAccountsFile();
    const accounts = (state.accounts || []).filter((a) => String(a.email || '').toLowerCase() !== email);
    accounts.unshift({
      email,
      password,
      name: String(body?.name || email).trim(),
      role: body?.role || 'platform_owner',
      systemCode: String(body?.systemCode || '').toUpperCase(),
      host: String(body?.host || '').trim(),
      grantId: body?.grantId || '',
      status: body?.status || 'active',
      approvedAt: body?.approvedAt || new Date().toISOString(),
    });
    writeTenantAccountsFile({ version: 1, accounts });
    sendJson(res, 200, { ok: true, email });
    return true;
  }

  if (pathname === '/api/hub/tenant-login' && req.method === 'POST') {
    const body = await readBody(req);
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!email || !password) {
      sendJson(res, 400, { ok: false, error: 'البريد وكلمة المرور مطلوبان' });
      return true;
    }
    const state = readTenantAccountsFile();
    const account = (state.accounts || []).find(
      (a) => String(a.email || '').toLowerCase() === email && a.status === 'active'
    );
    if (!account || account.password !== password) {
      sendJson(res, 401, { ok: false, error: 'بيانات الدخول غير صحيحة' });
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      user: {
        email: account.email,
        name: account.name || account.email,
        role: account.role || 'platform_owner',
        platform: 'naiosh-hub-360',
        systemCode: account.systemCode || '',
        host: account.host || '',
      },
    });
    return true;
  }

  // —— محوّل ERP: تحقق نطاق / تجهيز مستأجر ——
  if (pathname === '/api/hub/adapters/erp/config' && req.method === 'GET') {
    try {
      const config = await erpAdapter.getConfig();
      sendJson(res, 200, { ok: true, erpBase: erpAdapter.DEFAULT_ERP_BASE, config });
    } catch (error) {
      sendJson(res, 502, { ok: false, error: error.message });
    }
    return true;
  }

  if (pathname === '/api/hub/adapters/erp/validate-subdomain' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const result = await erpAdapter.validateSubdomain(body?.subdomain || body?.slug);
      sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      sendJson(res, 502, { ok: false, available: false, error: error.message });
    }
    return true;
  }

  if (pathname === '/api/hub/adapters/erp/provision' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const result = await erpAdapter.provisionTenant(body || {});
      sendJson(res, result.ok ? 200 : result.pendingPayment ? 202 : 400, result);
    } catch (error) {
      sendJson(res, 502, { ok: false, error: error.message || 'ERP adapter failure' });
    }
    return true;
  }

  // —— SSO tickets ——
  if (pathname === '/api/hub/sso/issue' && req.method === 'POST') {
    const body = await readBody(req);
    const result = hubSso.issue(body || {});
    sendJson(res, result.ok ? 200 : 400, result);
    return true;
  }

  if (pathname === '/api/hub/sso/verify' && req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token') || '';
    const consume = url.searchParams.get('consume') === '1';
    const sig = url.searchParams.get('sig') || '';
    const result = hubSso.verify(token, { consume, sig });
    sendJson(res, result.ok ? 200 : 404, result);
    return true;
  }

  if (pathname === '/api/hub/sso/verify' && req.method === 'POST') {
    const body = await readBody(req);
    const result = hubSso.verify(body?.token, {
      consume: Boolean(body?.consume),
      sig: body?.sig || '',
    });
    sendJson(res, result.ok ? 200 : 404, result);
    return true;
  }

  // جسر SSO: تحقق ثم JSON أو إعادة توجيه 302 لصفحة دخول النظام
  if (pathname === '/api/hub/sso/bridge' && (req.method === 'GET' || req.method === 'POST')) {
    const url = new URL(req.url, 'http://localhost');
    const body = req.method === 'POST' ? await readBody(req) : {};
    const token = String(body?.token || url.searchParams.get('token') || '').trim();
    const sig = String(body?.sig || url.searchParams.get('sig') || '').trim();
    const consume =
      body?.consume === true ||
      body?.consume === 1 ||
      url.searchParams.get('consume') === '1';
    const wantJson =
      url.searchParams.get('format') === 'json' ||
      String(req.headers.accept || '').includes('application/json');
    const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim();
    const hubOrigin = `${proto}://${host}`;
    const result = hubSso.bridge(token, { consume, sig, hubOrigin });
    if (!result.ok) {
      sendJson(res, 404, result);
      return true;
    }
    if (wantJson || req.method === 'POST') {
      sendJson(res, 200, result);
      return true;
    }
    res.writeHead(302, {
      Location: result.targetUrl,
      'Cache-Control': 'no-store',
    });
    res.end();
    return true;
  }

  return false;
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;

  if (pathname === '/api/health') {
    Promise.all([checkDatabase(), Promise.resolve(checkEnvironment())])
      .then(([db, env]) => {
        sendJson(res, 200, {
          ok: true,
          service: process.env.APP_NAME || 'naiosh-hub',
          env: process.env.NODE_ENV || 'development',
          database: db,
          environment: {
            ok: env.ok,
            failed: env.failed,
          },
          hubRuntime: {
            notifications: hubRuntime.listNotifications(5).length,
            apps: hubRuntime.listApps().length,
          },
          time: new Date().toISOString(),
        });
      })
      .catch((error) => sendJson(res, 500, { ok: false, error: error.message }));
    return;
  }

  if (pathname === '/api/env-check') {
    sendJson(res, 200, checkEnvironment());
    return;
  }

  if (pathname === '/api/db/migrate' && (req.method === 'POST' || req.method === 'GET')) {
    migrate()
      .then((result) => sendJson(res, 200, { ok: true, migrated: true, ...result }))
      .catch((error) =>
        sendJson(res, error.code === 'NO_DATABASE_URL' ? 503 : 500, {
          ok: false,
          error: error.message,
        })
      );
    return;
  }

  if (pathname === '/api/db/tables') {
    listTables()
      .then((result) => sendJson(res, 200, { ok: true, ...result }))
      .catch((error) =>
        sendJson(res, error.code === 'NO_DATABASE_URL' ? 503 : 500, {
          ok: false,
          error: error.message,
        })
      );
    return;
  }


  if (pathname === '/api/sectors' && req.method === 'GET') {
    try {
      const libPath = path.join(ROOT, 'js', 'hub-sector-library.js');
      const src = fs.readFileSync(libPath, 'utf8');
      // expose lightweight catalog extracted from comments/ids in file via runtime mirror
      const sectors = [
        'energy','construction','health','finance','industry','agriculture','education','tourism','logistics','digital',
        'osh','sustainability','facilities','realestate','retail','professional','events','media','transport','home-economy',
        'personal','crafts','sports','creative','other'
      ];
      sendJson(res, 200, {
        ok: true,
        engine: 'NAIOSH UNIVERSAL SECTOR OPPORTUNITY ENGINE',
        rule: 'sector = configuration package, not new engine code',
        count: sectors.length,
        endpoints: [
          '/api/sectors',
          '/api/sectors/{id}',
          '/api/sectors/discover',
        ],
        sectors,
      });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (pathname === '/api/sectors/discover' && req.method === 'POST') {
    readBody(req)
      .then((body) => {
        const q = String(body.query || body.message || '').toLowerCase();
        const map = [
          { id: 'energy', keys: ['طاقة', 'كهرباء', 'تكييف', 'energy', 'صيانة المعدات', 'معدات'] },
          { id: 'construction', keys: ['بناء', 'تشييد', 'تشطيب', 'construction'] },
          { id: 'health', keys: ['صحة', 'رعاية', 'health'] },
          { id: 'agriculture', keys: ['زراعة', 'غذاء', 'agriculture'] },
          { id: 'digital', keys: ['تقنية', 'رقمي', 'أتمتة', 'digital', 'برمجة'] },
          { id: 'osh', keys: ['سلامة', 'مخاطر', 'osh'] },
          { id: 'logistics', keys: ['لوجست', 'توصيل', 'أسطول', 'logistics'] },
          { id: 'tourism', keys: ['سياحة', 'ضيافة', 'tourism'] },
        ];
        const hits = map.filter((m) => m.keys.some((k) => q.includes(k.toLowerCase()))).map((m) => m.id);
        sendJson(res, 200, {
          ok: true,
          query: body.query || body.message || '',
          sectors: hits,
          note: 'Full scoring runs in HubUniversalOpportunityEngine on the client; this API mirrors discovery routing for systems.',
        });
      })
      .catch((error) => sendJson(res, 400, { ok: false, message: error.message }));
    return;
  }

  if (pathname.startsWith('/api/sectors/') && req.method === 'GET') {
    const id = pathname.split('/')[3];
    sendJson(res, 200, {
      ok: true,
      id,
      paths: {
        skills: `/api/sectors/${id}/skills`,
        occupations: `/api/sectors/${id}/occupations`,
        opportunities: `/api/sectors/${id}/opportunities`,
        projects: `/api/sectors/${id}/projects`,
        partners: `/api/sectors/${id}/partners`,
        compliance: `/api/sectors/${id}/compliance`,
        safety: `/api/sectors/${id}/safety`,
        learning: `/api/sectors/${id}/learning`,
        kpis: `/api/sectors/${id}/kpis`,
      },
      message: 'Sector details are served from HubSectorLibrary configuration packages in the Hub client.',
    });
    return;
  }

  if (pathname === '/api/ai-agent/chat' && req.method === 'POST') {
    readBody(req)
      .then((body) => {
        const response = buildAiAgentReply(body.message, {
          guest: !!body.guest,
          path: body.path || '/',
        });
        sendJson(res, 200, { ok: true, response, language: body.language || 'ar' });
      })
      .catch((error) => sendJson(res, 400, { ok: false, message: error.message || 'Invalid JSON body' }));
    return;
  }

  if (pathname === '/api/ai-agent/chat' && req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (pathname === '/api/auth/register' && req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (pathname === '/api/auth/register' && req.method === 'POST') {
    readBody(req)
      .then(async (body) => {
        const result = await customerAuth.register(body || {});
        if (result.ok && result.user?.email) {
          try {
            const store = hubClientPortal.readStore();
            const portalClient = hubClientPortal.ensureClient(
              store,
              result.user.email,
              result.user.name || result.user.fullName
            );
            if (result.user.phone) portalClient.phone = result.user.phone;
            portalClient.status = portalClient.status === 'pending' ? 'active' : portalClient.status;
            portalClient.lastLoginAt = portalClient.lastLoginAt || new Date().toISOString();
            hubPoshaOps.emitEvent(store, {
              type: 'CLIENT_REGISTERED',
              clientEmail: result.user.email,
              actorId: result.user.email,
              actorRole: 'client',
              title: 'عميل جديد قام بالتسجيل',
              message: `${result.user.name || result.user.fullName || result.user.email} انضم إلى نايوش هوب`,
              metadata: {},
            });
            hubClientPortal.writeStore(store);
          } catch {
            /* ignore */
          }
        }
        sendJson(
          res,
          result.status || (result.ok ? 201 : 400),
          {
            success: !!result.ok,
            ok: !!result.ok,
            message: result.message || result.error || '',
            error: result.ok ? undefined : result.error,
            field: result.field,
            strength: result.strength,
            token: result.token,
            user: result.user,
            destination: result.ok ? 'client.html' : undefined,
          },
          result.ok && result.token ? { 'Set-Cookie': hubSession.sessionCookieHeader(result.token) } : {}
        );
      })
      .catch((error) => {
        const status = error.status || 400;
        sendJson(res, status, {
          success: false,
          ok: false,
          error: status === 413 ? 'حجم الطلب أكبر من المسموح' : 'حدث خطأ أثناء إنشاء الحساب. حاول مرة أخرى.',
        });
      });
    return;
  }

  if (pathname === '/api/auth/login' && req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    readBody(req)
      .then(async (body) => {
        const result = await customerAuth.login({
          email: body?.email,
          password: body?.password,
        });
        if (result.ok && result.user?.email) {
          try {
            hubClientPortal.touchLogin(result.user.email, result.user.name || result.user.fullName);
          } catch {
            /* ignore */
          }
        }
        sendJson(
          res,
          result.status || (result.ok ? 200 : 401),
          {
            success: !!result.ok,
            ok: !!result.ok,
            message: result.message || result.error || '',
            error: result.ok ? undefined : result.error,
            token: result.token,
            user: result.user,
            destination: result.ok ? hubSession.postLoginDestination(result.user?.role || 'customer') : undefined,
          },
          result.ok && result.token ? { 'Set-Cookie': hubSession.sessionCookieHeader(result.token) } : {}
        );
      })
      .catch((error) => {
        const status = error.status || 400;
        sendJson(res, status, {
          success: false,
          ok: false,
          error: status === 413 ? 'حجم الطلب أكبر من المسموح' : 'بيانات الدخول غير صحيحة.',
        });
      });
    return;
  }

  if (pathname.startsWith('/api/client')) {
    hubClientPortal
      .handleClientApi(req, res, pathname)
      .catch((error) => sendJson(res, error.status || 500, { ok: false, error: error.message || 'Client API error' }));
    return;
  }

  if (pathname.startsWith('/api/admin/posha/os') || pathname.startsWith('/api/posha')) {
    hubPoshaOs
      .handlePoshaOsApi(req, res, pathname)
      .catch((error) => sendJson(res, error.status || 500, { ok: false, error: error.message || 'POSHA OS API error' }));
    return;
  }

  if (pathname.startsWith('/api/admin/posha')) {
    hubPoshaOps
      .handlePoshaAdminApi(req, res, pathname)
      .catch((error) => sendJson(res, error.status || 500, { ok: false, error: error.message || 'Posha API error' }));
    return;
  }

  if (pathname.startsWith('/api/admin/clients')) {
    hubClientPortal
      .handleAdminClientsApi(req, res, pathname)
      .catch((error) => sendJson(res, error.status || 500, { ok: false, error: error.message || 'Admin clients API error' }));
    return;
  }

  if (pathname.startsWith('/api/admin') || pathname === '/api/auth/logout') {
    // Soft auth: require staff for mutating admin routes (except logout/OPTIONS)
    if (pathname !== '/api/auth/logout' && req.method !== 'OPTIONS' && req.method !== 'GET') {
      try {
        hubSession.requireStaff(req);
      } catch (err) {
        sendJson(res, err.status || 403, { ok: false, success: false, error: err.message || 'Forbidden' });
        return;
      }
    } else if (pathname !== '/api/auth/logout' && req.method === 'GET' && pathname !== '/api/admin/metadata') {
      try {
        hubSession.requireStaff(req);
      } catch (err) {
        sendJson(res, err.status || 403, { ok: false, success: false, error: err.message || 'Forbidden' });
        return;
      }
    }
    handleAdminApi(req, res, pathname).catch((error) =>
      sendJson(res, error.status || 500, { ok: false, success: false, error: error.message || 'Admin API error' })
    );
    return;
  }

  if (pathname.startsWith('/api/hub/')) {
    handleHubApi(req, res, pathname).catch((error) =>
      sendJson(res, error.status || 500, { ok: false, error: error.message || 'Hub API error' })
    );
    return;
  }

  if (pathname.startsWith(`${hubUploads.PUBLIC_PREFIX}/`) && req.method === 'GET') {
    const id = path.basename(pathname);
    const filePath = hubUploads.resolveUploadPath(id);
    if (!filePath) {
      send(res, 400, 'Bad request');
      return;
    }
    // مرفقات التسجيل / العميل خاصة — لا تُخدم عبر الرابط العام
    if (hubRegisterAttachments.isPrivateStorageRef(id) || require('./lib/hub-client-attachments').isPrivateStorageRef(id)) {
      sendJson(res, 403, { ok: false, error: 'هذا المرفق خاص — استخدم واجهة الإدارة أو رابط المرفقات المصرّح' });
      return;
    }
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        send(res, 404, 'Not Found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      streamFile(
        filePath,
        res,
        {
          'Content-Type': hubUploads.mimeForExt(ext) || MIME[ext] || 'application/octet-stream',
          'Cache-Control': 'public, max-age=86400',
          'Content-Length': String(stat.size),
        },
        false
      );
    });
    return;
  }

  serveStatic(req, res);
});

server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

async function boot() {
  const env = checkEnvironment();
  console.log(`Naiosh Hub env checks: ${env.ok ? 'OK' : 'ISSUES'} (${env.failed.join(', ') || 'none'})`);
  console.log(
    `DATABASE_URL: ${getDatabaseUrl() ? 'set' : 'not set'} | AUTO_MIGRATE: ${AUTO_MIGRATE}`
  );

  if (AUTO_MIGRATE && getDatabaseUrl()) {
    try {
      const result = await migrate();
      console.log(`DB migrate OK — ${result.count} tables`);
    } catch (error) {
      console.error('DB migrate failed:', error.message);
    }
  }

    try {
      const hyd = await productOrders.hydrateFromDb();
      if (hyd?.ok) console.log(`hub_orders hydrated from database (${hyd.count || 0})`);
    } catch (error) {
      console.error('hub_orders hydrate skipped:', error.message);
    }

    try {
      const adHyd = await adSubmissions.hydrateFromDb();
      if (adHyd?.ok) console.log(`hub_ad_submissions hydrated from database (${adHyd.count || 0})`);
    } catch (error) {
      console.error('hub_ad_submissions hydrate skipped:', error.message);
    }

    try {
      const prdHyd = await productSubmissions.hydrateFromDb();
      if (prdHyd?.ok) console.log(`hub_product_submissions hydrated from database (${prdHyd.count || 0})`);
    } catch (error) {
      console.error('hub_product_submissions hydrate skipped:', error.message);
    }

    try {
      await hubClientPortal.ensureDemoClientAccount();
    console.log('Demo client ready: client@naiosh.com');
  } catch (error) {
    console.error('Demo client seed skipped:', error.message);
  }

  server.requestTimeout = 30 * 60 * 1000;
  server.headersTimeout = 31 * 60 * 1000;
  server.timeout = 30 * 60 * 1000;
  server.listen(PORT, HOST, () => {
    console.log(`Naiosh Hub listening on http://${HOST}:${PORT}`);
    console.log(`ROOT: ${ROOT}`);
    console.log(`Upload limit: ${hubUploads.MAX_UPLOAD_MB}MB`);
    try {
      hubPoshaOs.startPoshaSchedulers();
      console.log('POSHA schedulers started (subscription expiry + SLA)');
    } catch (e) {
      console.error('POSHA schedulers failed:', e.message);
    }
  });
}

boot().catch((error) => {
  console.error('Boot failed:', error);
  process.exit(1);
});
