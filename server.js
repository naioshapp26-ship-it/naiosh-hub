const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { checkEnvironment } = require('./db/env-check');
const { getDatabaseUrl, migrate, listTables } = require('./db/migrate');
const hubRuntime = require('./db/hub-runtime');

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
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload, null, 2), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
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

function serveStatic(req, res) {
  let pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/') pathname = '/index.html';

  const filePath = resolveSafePath(pathname);
  if (!filePath) {
    return send(res, 403, 'Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (pathname !== '/index.html') {
        return fs.readFile(path.join(ROOT, 'index.html'), (e2, html) => {
          if (e2) return send(res, 404, 'Not Found');
          send(res, 200, html, { 'Content-Type': 'text/html; charset=utf-8' });
        });
      }
      return send(res, 404, 'Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
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
    await client.end();
    return {
      linked: true,
      status: 'connected',
      message: 'قاعدة البيانات متصلة',
      ok: result.rows[0]?.ok === 1,
      tables: tables.rows[0]?.n || 0,
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

async function handleHubApi(req, res, pathname) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return true;
  }

  if (pathname === '/api/hub/notifications' && req.method === 'GET') {
    const items = hubRuntime.listNotifications(100);
    sendJson(res, 200, { ok: true, count: items.length, unread: items.filter((n) => !n.read).length, items });
    return true;
  }

  if (pathname === '/api/hub/notifications' && req.method === 'POST') {
    const body = await readBody(req);
    const item = hubRuntime.addNotification(body);
    sendJson(res, 201, { ok: true, item });
    return true;
  }

  if (pathname === '/api/hub/notifications/read' && req.method === 'POST') {
    const body = await readBody(req);
    const items = hubRuntime.markRead(body.id, !!body.all);
    sendJson(res, 200, { ok: true, items });
    return true;
  }

  if (pathname === '/api/hub/sync' && req.method === 'POST') {
    const body = await readBody(req);
    const result = hubRuntime.ingestSync(body);
    sendJson(res, 200, { ok: true, ...result });
    return true;
  }

  if (pathname === '/api/hub/apps' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, apps: hubRuntime.listApps(), synced: hubRuntime.getSynced() });
    return true;
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
      return Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  };
  const writeCatalogFile = (items) => {
    ensureCatalogFile();
    fs.writeFileSync(
      catalogPath,
      JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), items }, null, 2),
      'utf8'
    );
  };

  if (pathname === '/api/hub/search-catalog' && req.method === 'GET') {
    const items = readCatalogFile();
    sendJson(res, 200, { ok: true, count: items.length, items });
    return true;
  }

  if (pathname === '/api/hub/search-catalog' && req.method === 'POST') {
    const body = await readBody(req);
    const items = Array.isArray(body?.items) ? body.items : [];
    writeCatalogFile(items);
    sendJson(res, 200, { ok: true, count: items.length });
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

  if (pathname.startsWith('/api/hub/')) {
    handleHubApi(req, res, pathname).catch((error) =>
      sendJson(res, error.status || 500, { ok: false, error: error.message || 'Hub API error' })
    );
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

  server.listen(PORT, HOST, () => {
    console.log(`Naiosh Hub listening on http://${HOST}:${PORT}`);
    console.log(`ROOT: ${ROOT}`);
  });
}

boot().catch((error) => {
  console.error('Boot failed:', error);
  process.exit(1);
});
