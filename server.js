const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 3600;
const ROOT = __dirname;

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

function serveStatic(req, res) {
  let pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) {
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
  const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL || '';
  if (!databaseUrl) {
    return { linked: false, status: 'missing', message: 'DATABASE_URL غير موجودة' };
  }

  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    });
    await client.connect();
    const result = await client.query('select 1 as ok');
    await client.end();
    return {
      linked: true,
      status: 'connected',
      message: 'قاعدة البيانات متصلة',
      ok: result.rows[0]?.ok === 1,
    };
  } catch (error) {
    return {
      linked: true,
      status: 'error',
      message: error.message || 'فشل الاتصال بقاعدة البيانات',
    };
  }
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;

  if (pathname === '/api/health') {
    const db = await checkDatabase();
    return send(
      res,
      200,
      JSON.stringify({
        ok: true,
        service: 'naiosh-hub',
        database: db,
        time: new Date().toISOString(),
      }),
      {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      }
    );
  }

  serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Naiosh Hub listening on 0.0.0.0:${PORT}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL ? 'set' : 'not set'}`);
});
