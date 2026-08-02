const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { checkEnvironment } = require('./db/env-check');
const { getDatabaseUrl, migrate, listTables } = require('./db/migrate');

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
