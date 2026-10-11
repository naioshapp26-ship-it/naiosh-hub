/**
 * Tiny sticky-ish round-robin reverse proxy for multi-instance capacity tests.
 * Upstream ports: HUB_UPSTREAMS=8791,8792,8793  LISTEN=8790
 */
'use strict';

const http = require('http');

const LISTEN = Number(process.env.LISTEN || 8790);
const UPSTREAMS = String(process.env.HUB_UPSTREAMS || '8791,8792,8793')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => n > 0);

let rr = 0;
const server = http.createServer((req, res) => {
  const port = UPSTREAMS[rr % UPSTREAMS.length];
  rr += 1;
  const headers = { ...req.headers, host: `127.0.0.1:${port}` };
  const proxy = http.request(
    {
      hostname: '127.0.0.1',
      port,
      path: req.url,
      method: req.method,
      headers,
    },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    }
  );
  proxy.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: `upstream ${port}: ${err.message}` }));
  });
  req.pipe(proxy);
});

server.listen(LISTEN, '127.0.0.1', () => {
  console.log(`LB listening on ${LISTEN} -> ${UPSTREAMS.join(',')}`);
});
