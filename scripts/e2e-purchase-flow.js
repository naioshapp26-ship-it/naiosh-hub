/**
 * E2E purchase + upload flow tests (Node / jsdom-lite via vm)
 * Run: node scripts/e2e-purchase-flow.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function createSandbox() {
  const local = { _d: Object.create(null) };
  const sandbox = {
    console,
    URL,
    setTimeout,
    clearTimeout,
    localStorage: {
      getItem(k) {
        return Object.prototype.hasOwnProperty.call(local._d, k) ? local._d[k] : null;
      },
      setItem(k, v) {
        local._d[k] = String(v);
      },
      removeItem(k) {
        delete local._d[k];
      },
    },
    document: {
      readyState: 'complete',
      body: {
        insertAdjacentHTML() {},
        appendChild() {},
      },
      getElementById() {
        return null;
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      addEventListener() {},
      createElement() {
        return { style: {}, setAttribute() {}, appendChild() {} };
      },
    },
    window: null,
    CustomEvent: function (n, o) {
      this.type = n;
      this.detail = o && o.detail;
    },
    openCalls: [],
  };
  sandbox.window = sandbox;
  sandbox.window.open = (url, target, feats) => {
    sandbox.openCalls.push({ url, target, feats });
    return { opener: null, closed: false };
  };
  sandbox.window.dispatchEvent = () => {};
  sandbox.window.addEventListener = () => {};
  sandbox.window.HubUI = { toast() {} };
  sandbox.window.HubAuth = { getUser: () => ({ email: 'test@naiosh.test' }), isStaff: () => true };
  return sandbox;
}

function loadCore(sandbox) {
  vm.createContext(sandbox);
  // Minimal marketplace connectors
  sandbox.window.HubMarketplaceData = {
    MARKETPLACE_CONNECTORS: [
      {
        id: 'amazon',
        storeId: 'STORE-AMAZON',
        name: 'Amazon',
        nameAr: 'أمازون',
        websiteUrl: 'https://www.amazon.com',
        domains: ['amazon.'],
        icon: 'fa-brands fa-amazon',
        color: '#ff9900',
      },
      {
        id: 'noon',
        storeId: 'STORE-NOON',
        name: 'Noon',
        nameAr: 'نون',
        websiteUrl: 'https://www.noon.com',
        domains: ['noon.com'],
        icon: 'fas fa-sun',
        color: '#f3ea48',
      },
    ],
  };

  // Minimal HubStore
  const empire = {
    salesStore: { items: [], orders: [] },
    productCatalog: [],
    activity: [],
    feed: [],
  };
  sandbox.window.HubStore = {
    get: () => ({ empire }),
    save: () => {},
    placeStoreOrder: (itemId, buyer) => {
      const item = empire.salesStore.items.find((x) => x.id === itemId);
      if (!item || item.stock < 1) return null;
      item.stock -= 1;
      const order = { id: 'ord-1', itemId, title: item.title, buyer, amount: item.price, at: new Date().toISOString() };
      empire.salesStore.orders.unshift(order);
      return order;
    },
    addStoreItem: null,
    recordActivity() {},
    pushFeed() {},
  };

  vm.runInContext(read('js/hub-stores-registry.js'), sandbox);
  vm.runInContext(read('js/hub-purchase.js'), sandbox);

  // Bind real addStoreItem using purchase normalize (inline subset)
  sandbox.window.HubStore.addStoreItem = (payload) => {
    const normalized = sandbox.window.HubPurchase.normalizeIncomingPayload(payload);
    const title = normalized.title || normalized.name;
    if (!title) return null;
    const item = {
      id: 'st-' + Date.now() + Math.random().toString(16).slice(2, 6),
      title,
      name: title,
      price: Number(normalized.price) || 0,
      currency: 'USD',
      stock: Number(normalized.stock) || 10,
      purchaseType: normalized.purchaseType,
      productUrl: normalized.productUrl || '',
      storeId: normalized.storeId || '',
      storeName: normalized.storeName || '',
      marketplaces: normalized.marketplaces || [],
      status: normalized.status === 'pending_review' ? 'pending_review' : 'active',
      submissionId: normalized.submissionId || '',
      category: normalized.category || 'other',
      desc: normalized.desc || '',
    };
    empire.salesStore.items.unshift(item);
    if (normalized.mirrorToCatalog !== false) {
      empire.productCatalog.unshift({
        id: 'pr-' + item.id,
        name: item.title,
        storeItemId: item.id,
        purchaseType: item.purchaseType,
        productUrl: item.productUrl,
        price: item.price,
        status: item.status === 'pending_review' ? 'بانتظار المراجعة' : 'متوفر',
        marketplaces: item.marketplaces,
      });
    }
    return item;
  };

  return empire;
}

function run() {
  const results = [];
  const pass = (name) => results.push({ name, ok: true });
  const fail = (name, err) => results.push({ name, ok: false, err: String(err && err.message ? err.message : err) });

  // TEST 1: Amazon product opens real URL (not blank)
  try {
    const sb = createSandbox();
    const empire = loadCore(sb);
    const item = sb.window.HubStore.addStoreItem({
      title: 'Amazon Test Headphones',
      purchaseType: 'EXTERNAL',
      storeId: 'STORE-AMAZON',
      storeName: 'Amazon',
      productUrl: 'https://www.amazon.com/dp/B0TEST123',
      price: 49.99,
      stock: 5,
    });
    assert.strictEqual(sb.window.HubPurchase.resolvePurchaseType(item), 'EXTERNAL');
    assert.ok(sb.window.HubPurchase.externalLinkFromItem(item).url.includes('amazon.com/dp/B0TEST123'));
    const open = sb.window.HubPurchase.safeOpenExternal(item.productUrl);
    assert.ok(open.ok);
    assert.strictEqual(sb.openCalls.length, 1);
    assert.strictEqual(sb.openCalls[0].url, 'https://www.amazon.com/dp/B0TEST123');
    assert.strictEqual(sb.openCalls[0].target, '_blank');
    assert.ok(String(sb.openCalls[0].feats || '').includes('noopener'));
    // CTA must not be blank-openable without URL
    const cta = sb.window.HubPurchase.cardActionsHtml(item);
    assert.ok(cta.includes('data-external-buy'));
    assert.ok(cta.includes('الشراء من'));
    assert.ok(!cta.includes('اشترِ الآن'));
    pass('TEST1 Amazon external open real URL');
  } catch (e) {
    fail('TEST1 Amazon external open real URL', e);
  }

  // TEST 2: No external URL → no external buy button
  try {
    const sb = createSandbox();
    loadCore(sb);
    const item = {
      id: 'x1',
      title: 'Broken External',
      purchaseType: 'EXTERNAL',
      productUrl: '',
      marketplaces: [{ id: 'amazon', nameAr: 'أمازون', url: '' }],
    };
    const cta = sb.window.HubPurchase.cardActionsHtml(item);
    assert.ok(cta.includes('رابط الشراء غير متوفر حالياً'));
    assert.ok(!cta.includes('data-external-buy'));
    const open = sb.window.HubPurchase.safeOpenExternal('');
    assert.ok(!open.ok);
    assert.strictEqual(sb.openCalls.length, 0);
    pass('TEST2 missing external URL hides CTA / blocks open');
  } catch (e) {
    fail('TEST2 missing external URL hides CTA / blocks open', e);
  }

  // TEST 3: INTERNAL buy stays internal
  try {
    const sb = createSandbox();
    const empire = loadCore(sb);
    const item = sb.window.HubStore.addStoreItem({
      title: 'Internal Course',
      purchaseType: 'INTERNAL',
      price: 99,
      stock: 3,
    });
    assert.strictEqual(sb.window.HubPurchase.resolvePurchaseType(item), 'INTERNAL');
    const cta = sb.window.HubPurchase.cardActionsHtml(item);
    assert.ok(cta.includes('اشترِ الآن'));
    assert.ok(cta.includes('أضف للسلة'));
    assert.ok(!cta.includes('data-external-buy'));
    const order = sb.window.HubStore.placeStoreOrder(item.id, 'buyer@test');
    assert.ok(order);
    assert.strictEqual(empire.salesStore.orders.length, 1);
    assert.strictEqual(sb.openCalls.length, 0);
    pass('TEST3 INTERNAL checkout does not open external site');
  } catch (e) {
    fail('TEST3 INTERNAL checkout does not open external site', e);
  }

  // TEST 4: Customer upload → admin approve → published
  try {
    const sb = createSandbox();
    const empire = loadCore(sb);
    const R = sb.window.HubStoresRegistry;
    const sub = R.createSubmission({
      storeId: 'STORE-NOON',
      storeName: 'Noon',
      title: 'Noon Product',
      productUrl: 'https://www.noon.com/product/xyz',
      priceUsd: 20,
      category: 'fashion',
    });
    assert.ok(String(sub.id).startsWith('PRD-REQ-'));
    assert.ok(sub.status.includes('انتظار') || sub.status === 'بانتظار المراجعة');
    const listed = sb.window.HubStore.addStoreItem({
      title: sub.title,
      purchaseType: 'EXTERNAL',
      storeId: 'STORE-NOON',
      storeName: 'Noon',
      productUrl: sub.productUrl,
      price: sub.priceUsd,
      submissionId: sub.id,
      status: 'pending_review',
    });
    assert.strictEqual(listed.status, 'pending_review');
    const approved = R.approveSubmission(sub.id, 'Admin');
    assert.strictEqual(approved.status, 'Approved/Published');
    const live = empire.salesStore.items.find((x) => x.submissionId === sub.id);
    assert.ok(live);
    assert.strictEqual(live.status, 'active');
    assert.strictEqual(sb.window.HubPurchase.resolvePurchaseType(live), 'EXTERNAL');
    pass('TEST4 upload → admin approve → published in store');
  } catch (e) {
    fail('TEST4 upload → admin approve → published in store', e);
  }

  // TEST 5: edit / disable / archive store
  try {
    const sb = createSandbox();
    loadCore(sb);
    const R = sb.window.HubStoresRegistry;
    const created = R.addStore({ name: 'Example Store', website_url: 'https://store.example.com' });
    assert.ok(String(created.store_id || created.storeId).startsWith('STORE-'));
    R.updateStore(created.store_id || created.storeId, { status: 'disabled' });
    assert.ok(!R.listActive().some((s) => (s.store_id || s.storeId) === (created.store_id || created.storeId)));
    R.updateStore(created.store_id || created.storeId, { status: 'active', name: 'Example Store 2' });
    const again = R.get(created.store_id || created.storeId);
    assert.strictEqual(again.status, 'active');
    R.updateStore(created.store_id || created.storeId, { status: 'archived' });
    assert.ok(!R.listActive().some((s) => (s.store_id || s.storeId) === (created.store_id || created.storeId)));
    pass('TEST5 store edit / disable / archive');
  } catch (e) {
    fail('TEST5 store edit / disable / archive', e);
  }

  // TEST 6: URL validation domain match + blank open guards
  try {
    const sb = createSandbox();
    loadCore(sb);
    const R = sb.window.HubStoresRegistry;
    assert.ok(R.validateProductUrl('https://www.amazon.com/dp/1', 'STORE-AMAZON').ok);
    assert.ok(!R.validateProductUrl('https://evil.com/x', 'STORE-AMAZON').ok);
    assert.ok(!sb.window.HubPurchase.safeOpenExternal('about:blank').ok);
    assert.ok(!sb.window.HubPurchase.safeOpenExternal('javascript:alert(1)').ok);
    assert.strictEqual(sb.openCalls.length, 0);
    pass('TEST6 URL validation + blank/js guards');
  } catch (e) {
    fail('TEST6 URL validation + blank/js guards', e);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  if (failed.length) process.exit(1);
}

run();
