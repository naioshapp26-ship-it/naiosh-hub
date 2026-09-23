/**
 * E2E: Product checkout — Buy Now → Order → My Orders → Admin → ownership/price/idempotency
 * Run: node scripts/e2e-product-checkout.js
 */
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = Number(process.env.PORT) || 8080;
const BASE = `http://127.0.0.1:${PORT}`;
const root = path.join(__dirname, '..');

function req(method, pathname, { token, role, name, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, BASE);
    const payload = body != null ? JSON.stringify(body) : null;
    const headers = { Accept: 'application/json' };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    if (role) headers['X-Hub-User-Role'] = role;
    if (name) headers['X-Hub-User-Name'] = name;
    const r = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let data = {};
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch {
            data = { raw };
          }
          resolve({ status: res.statusCode, data });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function staffToken(email = 'admin@naiosh.com') {
  return `hub360.${Buffer.from(email).toString('base64')}.${Date.now()}`;
}

function clientToken(email) {
  return `hub360.cust.${Buffer.from(email).toString('base64url')}.${Date.now()}`;
}

async function main() {
  // Static wiring
  const market = fs.readFileSync(path.join(root, 'js/market-pages.js'), 'utf8');
  assert.ok(market.includes('checkout.html?product='), 'Buy Now links to checkout');
  assert.ok(market.includes('data-enter-site'), 'Enter site is gated');
  assert.ok(market.includes('data-buy-now'), 'Buy Now marker present');

  const ops = fs.readFileSync(path.join(root, 'js/hub-ops-path.js'), 'utf8');
  assert.ok(ops.includes("if (key === 'products') return"), 'instant-entry banner skipped on products');

  assert.ok(fs.existsSync(path.join(root, 'checkout.html')), 'checkout.html exists');
  assert.ok(fs.existsSync(path.join(root, 'my-orders.html')), 'my-orders.html exists');
  assert.ok(fs.existsSync(path.join(root, 'js/hub-checkout.js')), 'hub-checkout.js exists');
  assert.ok(fs.existsSync(path.join(root, 'lib/hub-product-orders.js')), 'hub-product-orders.js exists');

  const cartPage = fs.readFileSync(path.join(root, 'js/hub-cart-page.js'), 'utf8');
  assert.ok(cartPage.includes('checkout.html?source=cart'), 'cart checkout goes to checkout');

  // Health
  const health = await req('GET', '/api/health');
  assert.equal(health.status, 200);

  // Product lookup
  const product = await req('GET', '/api/hub/products/pr-erp-1');
  assert.equal(product.status, 200, 'product fetch ok');
  assert.equal(product.data.ok, true);
  assert.equal(product.data.product.id, 'pr-erp-1');
  assert.equal(product.data.product.price, 4800);
  assert.equal(product.data.product.available, true);

  // Unavailable product
  const fake = await req('GET', '/api/hub/products/does-not-exist-xyz');
  assert.equal(fake.status, 404);

  // Anonymous create blocked
  const anon = await req('POST', '/api/hub/product-orders', {
    body: { productId: 'pr-erp-1', qty: 1, paymentMode: 'demo' },
  });
  assert.equal(anon.status, 401);

  // Client A creates order
  const tokenA = clientToken('client@naiosh.com');
  const idem = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const created = await req('POST', '/api/hub/product-orders', {
    token: tokenA,
    body: {
      productId: 'pr-erp-1',
      qty: 1,
      paymentMode: 'demo',
      source: 'buy_now',
      idempotencyKey: idem,
      clientPrice: 4800,
      customer: { name: 'أحمد العميل', phone: '+970599000001', country: 'فلسطين' },
    },
  });
  assert.equal(created.status, 201, `create order: ${JSON.stringify(created.data)}`);
  assert.equal(created.data.ok, true);
  assert.ok(created.data.order?.number?.match(/^ORD-\d{4}-\d{5}$/), 'Order ID format');
  assert.equal(created.data.order.productId, 'pr-erp-1');
  assert.equal(created.data.order.unitPrice, 4800);
  assert.equal(created.data.order.total, 4800);
  assert.equal(created.data.order.paymentStatus, 'demo_paid');
  const orderId = created.data.order.id;
  const orderNumber = created.data.order.number;

  // Double submit same idempotency → same order
  const dup = await req('POST', '/api/hub/product-orders', {
    token: tokenA,
    body: {
      productId: 'pr-erp-1',
      qty: 1,
      paymentMode: 'demo',
      source: 'buy_now',
      idempotencyKey: idem,
      clientPrice: 4800,
      customer: { name: 'أحمد العميل' },
    },
  });
  assert.equal(dup.status, 201);
  assert.equal(dup.data.duplicate, true);
  assert.equal(dup.data.order.id, orderId);

  // Price tamper rejected
  const tamper = await req('POST', '/api/hub/product-orders', {
    token: tokenA,
    body: {
      productId: 'pr-erp-1',
      qty: 1,
      paymentMode: 'demo',
      idempotencyKey: `tamper-${idem}`,
      clientPrice: 1,
      customer: { name: 'أحمد العميل' },
    },
  });
  assert.equal(tamper.status, 400);
  assert.equal(tamper.data.code, 'PRICE_MISMATCH');
  assert.equal(tamper.data.officialPrice, 4800);

  // Unavailable purchase
  const badBuy = await req('POST', '/api/hub/product-orders', {
    token: tokenA,
    body: {
      productId: 'nope-archived',
      qty: 1,
      paymentMode: 'demo',
      idempotencyKey: `bad-${idem}`,
    },
  });
  assert.equal(badBuy.status, 400);

  // Client A lists own orders
  const mine = await req('GET', '/api/hub/product-orders', { token: tokenA });
  assert.equal(mine.status, 200);
  assert.ok(mine.data.orders.some((o) => o.id === orderId));

  // Client A can view own order
  const viewA = await req('GET', `/api/hub/product-orders/${orderNumber}`, { token: tokenA });
  assert.equal(viewA.status, 200);
  assert.equal(viewA.data.order.id, orderId);

  // Client B cannot view A's order
  // Ensure B account exists via register or token for different email without account → still auth as customer lane
  const tokenB = clientToken('other-customer@example.com');
  // other-customer may not be in customer-accounts — session falls back to role customer
  const viewB = await req('GET', `/api/hub/product-orders/${orderId}`, {
    token: tokenB,
    role: 'customer',
  });
  assert.equal(viewB.status, 403, `B must not see A order: ${JSON.stringify(viewB.data)}`);

  // Staff sees all + can update status
  const staff = staffToken();
  const adminList = await req('GET', '/api/hub/product-orders', {
    token: staff,
    role: 'admin',
    name: 'Admin',
  });
  assert.equal(adminList.status, 200);
  assert.equal(adminList.data.staff, true);
  assert.ok(adminList.data.orders.some((o) => o.id === orderId));

  const statusUp = await req('POST', `/api/hub/product-orders/${orderId}/status`, {
    token: staff,
    role: 'admin',
    body: { status: 'under_review' },
  });
  assert.equal(statusUp.status, 200, JSON.stringify(statusUp.data));
  assert.equal(statusUp.data.order.orderStatus, 'under_review');

  const viewAfter = await req('GET', `/api/hub/product-orders/${orderId}`, { token: tokenA });
  assert.equal(viewAfter.status, 200);
  assert.equal(viewAfter.data.order.orderStatus, 'under_review');

  // Cart multi-item
  const cartKey = `cart-${idem}`;
  const cartOrder = await req('POST', '/api/hub/product-orders', {
    token: tokenA,
    body: {
      source: 'cart',
      paymentMode: 'demo',
      idempotencyKey: cartKey,
      items: [
        { productId: 'pr-erp-2', qty: 1, clientPrice: 3200 },
        { productId: 'pr-erp-3', qty: 2, clientPrice: 2100 },
      ],
      customer: { name: 'أحمد العميل' },
    },
  });
  assert.equal(cartOrder.status, 201, JSON.stringify(cartOrder.data));
  assert.equal(cartOrder.data.orders.length, 2);
  assert.equal(cartOrder.data.orders[0].source, 'cart');
  assert.equal(cartOrder.data.orders[1].total, 4200);

  // Persist file exists
  const ordersFile = path.join(root, 'data/product-orders.json');
  assert.ok(fs.existsSync(ordersFile), 'orders persisted to disk');
  const disk = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
  assert.ok(disk.orders.some((o) => o.id === orderId));

  console.log(`ok: product checkout e2e — order ${orderNumber}, cart lines ${cartOrder.data.orders.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
