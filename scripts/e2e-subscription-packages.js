/**
 * E2E: subscription packages + points wallet (no fake paid credit).
 */
'use strict';

const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.E2E_PACKAGES_PORT || 0) || 19300 + Math.floor(Math.random() * 500);
const BASE = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

function req(method, urlPath, { body, token, headers } = {}) {
  const u = new URL(urlPath, BASE);
  const lib = u.protocol === 'https:' ? https : http;
  const payload = body != null ? JSON.stringify(body) : null;
  return new Promise((resolve) => {
    const r = lib.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: {
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: 'Bearer ' + token, 'X-Hub-Token': token } : {}),
          ...(headers || {}),
        },
        timeout: 30000,
      },
      (res) => {
        const c = [];
        res.on('data', (d) => c.push(d));
        res.on('end', () => {
          const text = Buffer.concat(c).toString('utf8');
          let json = {};
          try {
            json = JSON.parse(text);
          } catch {
            json = { raw: text };
          }
          resolve({ status: res.statusCode, json, text });
        });
      }
    );
    r.on('error', (e) => resolve({ status: 0, json: { error: e.message } }));
    if (payload) r.write(payload);
    r.end();
  });
}

function mark(name, ok, detail) {
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + JSON.stringify(detail) : ''));
  return ok;
}

async function waitHealth(max = 40) {
  for (let i = 0; i < max; i++) {
    const h = await req('GET', '/api/health');
    if (h.status === 200) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function main() {
  let child = null;
  let started = false;
  if (!process.env.BASE_URL) {
    const env = {
      ...process.env,
      PORT: String(PORT),
      SCALE_PORT: String(PORT),
      HOST: '127.0.0.1',
      HUB_ALLOW_LEGACY_DEMO: '1',
      APP_URL: `http://127.0.0.1:${PORT}`,
    };
    // This suite asserts gateways are OFF unless explicitly configured for the test.
    delete env.BASE_URL;
    delete env.HUB_PAYMOB_STUB;
    delete env.PAYMOB_API_KEY;
    delete env.PAYMOB_INTEGRATION_ID;
    delete env.PAYMOB_HMAC_SECRET;
    delete env.PAYMOB_IFRAME_ID;
    delete env.STRIPE_SECRET_KEY;
    delete env.STRIPE_WEBHOOK_SECRET;
    child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    started = true;
    child.stdout.on('data', () => {});
    child.stderr.on('data', () => {});
  }

  let failed = 0;
  try {
    if (started && !(await waitHealth())) throw new Error('server not ready');

    const page = await req('GET', '/packages.html');
    const pageText = page.text || page.json.raw || '';
    failed += !mark(
      'packages_page',
      page.status === 200 &&
        (/باقات النقاط/.test(pageText) ||
          /باقات نايوش هوب 360/.test(pageText) ||
          /باقات الاشتراك/.test(pageText) ||
          /hub-packages\.js/.test(pageText) ||
          /الشراء متاح قريبًا/.test(pageText)),
      { status: page.status, sample: pageText.slice(0, 120) }
    )
      ? 1
      : 0;

    const cat = await req('GET', '/api/hub/packages');
    failed += !mark(
      'catalog_packages',
      cat.json.ok &&
        Array.isArray(cat.json.packages) &&
        cat.json.packages.length === 3 &&
        cat.json.packages.some((p) => p.id === 'free-300' && p.points === 300) &&
        cat.json.packages.some((p) => p.id === 'pack-6000' && p.priceUsd === 15 && p.points === 6000) &&
        cat.json.packages.some((p) => p.id === 'pack-16000' && p.priceUsd === 35 && p.points === 16000),
      { packages: (cat.json.packages || []).map((p) => p.id) }
    )
      ? 1
      : 0;

    // Own spawned server clears gateway secrets → payment must be unavailable (no fake "available").
    const expectPayAvailable = false;
    failed += !mark('payment_not_fake_available', cat.json.payment && cat.json.payment.available === expectPayAvailable, {
      available: cat.json.payment && cat.json.payment.available,
      stubMode: cat.json.payment && cat.json.payment.stubMode,
    })
      ? 1
      : 0;

    const countries = await req('GET', '/api/hub/packages/countries?q=سعود');
    failed += !mark('countries_search', countries.json.ok && (countries.json.countries || []).some((c) => c.currency === 'SAR'), {
      n: (countries.json.countries || []).length,
    })
      ? 1
      : 0;

    const fx = await req('GET', '/api/hub/packages/fx');
    failed += !mark('fx_live_or_cached', fx.json.ok && fx.json.base === 'USD' && fx.json.updatedAt, {
      provider: fx.json.provider,
      stale: fx.json.stale,
    })
      ? 1
      : 0;

    const quote = await req('POST', '/api/hub/packages/quote', { body: { packageId: 'pack-6000', currency: 'SAR' } });
    failed += !mark(
      'quote_server_price',
      quote.json.ok && quote.json.package.priceUsd === 15 && quote.json.package.points === 6000 && quote.json.display && quote.json.settlement,
      { display: quote.json.display, settlement: quote.json.settlement }
    )
      ? 1
      : 0;

    // Reject browser-trusted fake price: quote ignores client price
    const quoteTamper = await req('POST', '/api/hub/packages/quote', {
      body: { packageId: 'pack-6000', currency: 'USD', priceUsd: 1, points: 999999 },
    });
    failed += !mark(
      'reject_client_price_tamper',
      quoteTamper.json.ok && quoteTamper.json.package.priceUsd === 15 && quoteTamper.json.package.points === 6000,
      quoteTamper.json.package
    )
      ? 1
      : 0;

    // Unauthenticated claim/checkout
    const claimAnon = await req('POST', '/api/hub/packages/claim-free', { body: {} });
    failed += !mark('claim_requires_auth', claimAnon.status === 401, { status: claimAnon.status }) ? 1 : 0;

    const email = `pkg_${Date.now()}@t.local`;
    const pass = 'PkgTest123!';
    const phone = '05' + String(Date.now()).slice(-8);
    const reg = await req('POST', '/api/auth/register', {
      body: {
        email,
        password: pass,
        confirmPassword: pass,
        fullName: 'Package Tester',
        phone,
        termsAccepted: true,
      },
    });
    let token = reg.json.token || null;
    if (!token) {
      const login = await req('POST', '/api/auth/login', { body: { email, password: pass } });
      token = login.json.token || null;
      failed += !mark('register_then_login', Boolean(token) && (reg.json.ok || reg.json.success), {
        regStatus: reg.status,
        loginStatus: login.status,
        err: login.json.error || reg.json.error,
      })
        ? 1
        : 0;
    } else {
      failed += !mark('register_customer', true, { email }) ? 1 : 0;
    }

    if (token) {
      const claim1 = await req('POST', '/api/hub/packages/claim-free', { token, body: {} });
      failed += !mark(
        'claim_free_once',
        claim1.status === 200 &&
          claim1.json.ok === true &&
          claim1.json.wallet &&
          claim1.json.wallet.free >= 300 &&
          claim1.json.order &&
          claim1.json.order.ref,
        {
          status: claim1.status,
          free: claim1.json.wallet && claim1.json.wallet.free,
          ref: claim1.json.order && claim1.json.order.ref,
          err: claim1.json.error,
        }
      )
        ? 1
        : 0;

      const claim2 = await req('POST', '/api/hub/packages/claim-free', { token, body: {} });
      failed += !mark(
        'claim_free_idempotent',
        claim2.status === 409 && claim2.json.ok === false,
        { status: claim2.status, err: claim2.json.error }
      )
        ? 1
        : 0;

      const paid = await req('POST', '/api/hub/packages/checkout', {
        token,
        body: { packageId: 'pack-6000', currency: 'SAR', method: 'stripe' },
      });
      // Without Stripe: must NOT credit; should be 503 unavailable
      const noFake =
        !process.env.STRIPE_SECRET_KEY
          ? paid.status === 503 && !paid.json.ok
          : paid.json.ok && Boolean(paid.json.checkoutUrl);
      failed += !mark('paid_no_fake_success', noFake, { status: paid.status, err: paid.json.error }) ? 1 : 0;

      const manual = await req('POST', '/api/hub/packages/checkout', {
        token,
        body: { packageId: 'pack-6000', currency: 'USD', method: 'manual_review' },
      });
      failed += !mark(
        'manual_review_pending_no_credit',
        manual.json.ok && manual.json.pendingReview && manual.json.order && manual.json.order.status === 'pending_review',
        manual.json.order
      )
        ? 1
        : 0;

      const me = await req('GET', '/api/hub/packages/me', { token });
      failed += !mark('wallet_unchanged_after_pending', me.json.wallet && me.json.wallet.paid === 0, me.json.wallet) ? 1 : 0;
    }

    console.log(failed ? `REPORT fail=${failed}` : 'REPORT pass=all');
    process.exit(failed ? 2 : 0);
  } finally {
    if (child) child.kill('SIGTERM');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
