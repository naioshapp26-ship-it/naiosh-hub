/**
 * Headless Chrome E2E for product checkout UI
 * Run: node scripts/e2e-checkout-browser.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const OUT = path.join('/opt/cursor/artifacts');
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  // Products page — no free-entry banner
  await page.goto(`${BASE}/products.html`, { waitUntil: 'networkidle2' });
  const bannerText = await page.evaluate(() => document.body.innerText);
  assert.ok(!bannerText.includes('دخول فوري مجاني'), 'free-entry banner must be gone');
  await page.screenshot({ path: path.join(OUT, 'products_no_free_entry_banner.png'), fullPage: false });

  // Login
  await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle2' });
  await page.type('#email', 'client@naiosh.com');
  await page.type('#password', 'Hub@360');
  const remember = await page.$('#rememberMe');
  if (remember) await page.click('#rememberMe');
  await page.click('#loginBtn');
  await page.waitForFunction(() => {
    try {
      return !!(localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken'));
    } catch {
      return false;
    }
  }, { timeout: 20000 });
  // Allow redirect settle
  await new Promise((r) => setTimeout(r, 800));

  // Buy Now link present and points to checkout
  await page.goto(`${BASE}/products.html`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-buy-now], a[href*="checkout.html?product="]', { timeout: 15000 });
  const buyHref = await page.$eval(
    'a[href*="checkout.html?product="]',
    (a) => a.getAttribute('href')
  );
  assert.ok(buyHref.includes('checkout.html?product='), `buy href=${buyHref}`);

  // Full checkout via Buy Now navigation
  await page.click('a[href*="checkout.html?product=pr-erp-1"], a[href*="product=pr-erp-1"]');
  await page.waitForFunction(() => location.pathname.includes('checkout'), { timeout: 10000 });
  await page.waitForSelector('#co-product-name', { timeout: 10000 });
  const name = await page.$eval('#co-product-name', (el) => el.textContent.trim());
  assert.ok(name.includes('إي آر بي') || name.length > 3, `product name=${name}`);

  // Step 1 → Continue
  await page.click('[data-panel="1"] [data-co-next]');
  await page.waitForSelector('[data-panel="2"]:not([hidden])', { timeout: 5000 });

  // Customer form should be visible if logged in
  const email = await page.$eval('#co-email', (el) => el.value);
  assert.equal(email, 'client@naiosh.com');
  await page.click('[data-panel="2"] [data-co-next]');
  await page.waitForSelector('[data-panel="3"]:not([hidden])', { timeout: 5000 });

  await page.click('#co-terms');
  await page.click('[data-panel="3"] [data-co-next]');
  await page.waitForSelector('[data-panel="4"]:not([hidden])', { timeout: 5000 });

  await page.screenshot({ path: path.join(OUT, 'checkout_demo_payment_step.png') });

  await page.click('#co-pay-confirm');
  await page.waitForSelector('[data-panel="5"]:not([hidden])', { timeout: 15000 });
  const successText = await page.$eval('#co-success', (el) => el.innerText);
  assert.ok(successText.includes('تم استلام طلبك بنجاح'), successText);
  const orderMatch = successText.match(/ORD-\d{4}-\d{5}/);
  assert.ok(orderMatch, `missing order id in: ${successText}`);
  const orderId = orderMatch[0];
  await page.screenshot({ path: path.join(OUT, 'checkout_success_order.png') });

  // My orders
  await page.goto(`${BASE}/my-orders.html`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.hub-order-card, #mo-list', { timeout: 10000 });
  const ordersText = await page.$eval('#mo-list', (el) => el.innerText);
  assert.ok(ordersText.includes(orderId), `my-orders missing ${orderId}: ${ordersText}`);
  await page.screenshot({ path: path.join(OUT, 'my_orders_list.png') });

  // Cart path
  await page.goto(`${BASE}/products.html`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-cart-product]', { timeout: 10000 });
  await page.click('[data-cart-product="pr-erp-2"], [data-cart-product]');
  await page.goto(`${BASE}/cart.html`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('a[href="checkout.html?source=cart"]', { timeout: 5000 });
  await page.click('a[href="checkout.html?source=cart"]');
  await page.waitForFunction(() => location.search.includes('source=cart'), { timeout: 10000 });
  await page.waitForSelector('#co-product-name', { timeout: 10000 });
  await page.screenshot({ path: path.join(OUT, 'checkout_from_cart.png') });

  // Mobile viewport
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}/checkout.html?product=pr-erp-3`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#co-stepper', { timeout: 10000 });
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  assert.ok(scrollWidth <= clientWidth + 2, `horizontal scroll mobile: ${scrollWidth} > ${clientWidth}`);
  await page.screenshot({ path: path.join(OUT, 'checkout_mobile_stepper.png') });

  console.log(`ok: browser checkout e2e — order ${orderId}`);
  await browser.close();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
