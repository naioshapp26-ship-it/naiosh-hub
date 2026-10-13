/**
 * Prove package orders survive process restart via Postgres hub_package_orders (+ hub_meta).
 * Also asserts payment stays unavailable without merchant keys.
 */
'use strict';

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.E2E_PKG_DURABILITY_PORT || 19780);
const BASE = `http://127.0.0.1:${PORT}`;
const SA_EMAIL = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || 'E2eSaPaymobTest!99';

function req(method, urlPath, { body, token } = {}) {
  const u = new URL(urlPath, BASE);
  const payload = body != null ? JSON.stringify(body) : null;
  return new Promise((resolve) => {
    const r = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: {
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: 'Bearer ' + token, 'X-Hub-Token': token } : {}),
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
            json = { raw: text.slice(0, 2000) };
          }
          resolve({ status: res.statusCode, json });
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

function startServer() {
  const env = {
    ...process.env,
    PORT: String(PORT),
    HOST: '127.0.0.1',
    NODE_ENV: 'development',
    APP_URL: BASE,
    HUB_ALLOW_LEGACY_DEMO: '1',
    HUB_SUPER_ADMIN_INITIAL_PASSWORD: SA_PASS,
    HUB_SUPER_ADMIN_FORCE_PASSWORD_RESET: '1',
  };
  // Payment must stay OFF — no gateway secrets
  delete env.HUB_PAYMOB_STUB;
  delete env.PAYMOB_API_KEY;
  delete env.PAYMOB_INTEGRATION_ID;
  delete env.PAYMOB_HMAC_SECRET;
  delete env.PAYMOB_IFRAME_ID;
  delete env.HUB_PAYMOB_LIVE;
  delete env.STRIPE_SECRET_KEY;
  delete env.BASE_URL;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return child;
}

async function waitHealth(max = 60) {
  for (let i = 0; i < max; i++) {
    const h = await req('GET', '/api/health');
    if (h.status === 200) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function stopServer(child) {
  if (!child || child.killed) return;
  child.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 800));
  try {
    child.kill('SIGKILL');
  } catch {
    /* */
  }
  await new Promise((r) => setTimeout(r, 400));
}

async function pgHasRef(ref) {
  try {
    const { getPool, getDatabaseUrl } = require('../db/migrate');
    if (!getDatabaseUrl()) return { ok: false, skipped: true };
    const pool = getPool();
    const r = await pool.query(`SELECT id, ref, status, credited, payload FROM hub_package_orders WHERE ref = $1 LIMIT 1`, [
      ref,
    ]);
    return { ok: true, row: r.rows[0] || null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required for this durability test');
    process.exit(2);
  }

  let failed = 0;
  let child = startServer();
  try {
    if (!(await waitHealth())) throw new Error('server1 not ready');

    const cat = await req('GET', '/api/hub/packages');
    failed += !mark('payment_unavailable_without_keys', cat.json.payment && cat.json.payment.available === false, {
      available: cat.json.payment && cat.json.payment.available,
      ids: cat.json.payment && cat.json.payment.activeGatewayIds,
    })
      ? 1
      : 0;

    const email = `dur_${Date.now()}@t.local`;
    const password = 'DurTest123!';
    const reg = await req('POST', '/api/auth/register', {
      body: {
        email,
        password,
        confirmPassword: password,
        fullName: 'Durability Tester',
        phone: '01' + String(Date.now()).slice(-9),
        termsAccepted: true,
      },
    });
    let token = reg.json.token;
    if (!token) {
      const login = await req('POST', '/api/auth/login', { body: { email, password } });
      token = login.json.token;
    }
    failed += !mark('client_register', Boolean(token), { email }) ? 1 : 0;

    const claim = await req('POST', '/api/hub/packages/claim-free', { token, body: {} });
    const freeRef = claim.json.order && claim.json.order.ref;
    failed += !mark(
      'claim_free_order',
      claim.status === 200 && claim.json.ok === true && freeRef && claim.json.wallet && claim.json.wallet.free >= 300,
      {
        status: claim.status,
        ref: freeRef,
        free: claim.json.wallet && claim.json.wallet.free,
        err: claim.json.error,
      }
    )
      ? 1
      : 0;

    const claimAgain = await req('POST', '/api/hub/packages/claim-free', { token, body: {} });
    failed += !mark(
      'claim_free_no_repeat',
      claimAgain.status === 409 && claimAgain.json.ok === false,
      { status: claimAgain.status, err: claimAgain.json.error }
    )
      ? 1
      : 0;

    const manual = await req('POST', '/api/hub/packages/checkout', {
      token,
      body: { packageId: 'pack-6000', currency: 'EGP', countryCode: 'EG', method: 'manual_review' },
    });
    const paidRef = manual.json.order && manual.json.order.ref;
    failed += !mark('manual_order_no_credit', manual.json.ok && paidRef && manual.json.pendingReview, {
      ref: paidRef,
      status: manual.json.order && manual.json.order.status,
    })
      ? 1
      : 0;

    // Deny paymob without keys
    const paymobDenied = await req('POST', '/api/hub/packages/checkout', {
      token,
      body: { packageId: 'pack-6000', currency: 'EGP', method: 'paymob' },
    });
    failed += !mark('paymob_denied_without_merchant', paymobDenied.status === 503 && !paymobDenied.json.ok, {
      status: paymobDenied.status,
      err: paymobDenied.json.error,
    })
      ? 1
      : 0;

    // Flush window
    await new Promise((r) => setTimeout(r, 600));
    const pg1 = await pgHasRef(paidRef);
    failed += !mark('postgres_row_after_create', pg1.ok && pg1.row && pg1.row.ref === paidRef, {
      skipped: pg1.skipped,
      err: pg1.error,
      status: pg1.row && pg1.row.status,
    })
      ? 1
      : 0;

    const pgFree = await pgHasRef(freeRef);
    failed += !mark('postgres_row_free_grant', pgFree.ok && pgFree.row && pgFree.row.credited === true, {
      credited: pgFree.row && pgFree.row.credited,
    })
      ? 1
      : 0;

    // Simulate redeploy: stop server, prove Postgres can rebuild empty in-memory list, then restart
    await stopServer(child);
    child = null;

    // In-process (separate from child): empty list → hydrate from hub_package_orders
    // eslint-disable-next-line global-require
    const portal = require('../lib/hub-client-portal');
    // eslint-disable-next-line global-require
    const pkgs = require('../lib/hub-subscription-packages');
    const scratch = { packageOrders: [], clients: {} };
    const hyd = await pkgs.hydratePackageOrdersFromPg(scratch, { persist: false });
    failed += !mark(
      'postgres_hydrate_rebuilds_orders',
      hyd.ok &&
        Array.isArray(scratch.packageOrders) &&
        scratch.packageOrders.some((o) => o.ref === paidRef) &&
        scratch.packageOrders.some((o) => o.ref === freeRef),
      { count: hyd.count, merged: hyd.merged, sample: scratch.packageOrders.slice(0, 3).map((o) => o.ref) }
    )
      ? 1
      : 0;

    child = startServer();
    if (!(await waitHealth())) throw new Error('server2 not ready');

    const me = await req('GET', '/api/hub/packages/me', { token });
    const orders = me.json.packageOrders || me.json.orders || [];
    failed += !mark(
      'orders_survive_restart_api',
      me.json.ok &&
        orders.some((o) => o.ref === paidRef) &&
        orders.some((o) => o.ref === freeRef && (o.credited || o.status === 'fulfilled')),
      { n: orders.length, refs: orders.map((o) => o.ref).slice(0, 8) }
    )
      ? 1
      : 0;

    failed += !mark(
      'wallet_survives_restart',
      me.json.wallet && me.json.wallet.free >= 300 && me.json.wallet.paid === 0,
      me.json.wallet
    )
      ? 1
      : 0;

    const saLogin = await req('POST', '/api/auth/login', {
      body: { email: SA_EMAIL, password: SA_PASS, lane: 'staff' },
    });
    const saTok = saLogin.json.token;
    failed += !mark('admin_login_after_restart', Boolean(saTok), { status: saLogin.status }) ? 1 : 0;

    if (saTok) {
      const overview = await req('GET', '/api/admin/packages/overview', { token: saTok });
      failed += !mark(
        'admin_sees_persisted_orders',
        overview.json.ok &&
          Array.isArray(overview.json.orders) &&
          overview.json.orders.some((o) => o.ref === paidRef) &&
          overview.json.orders.some((o) => o.ref === freeRef),
        { total: overview.json.stats && overview.json.stats.ordersTotal }
      )
        ? 1
        : 0;

      // Reject without permission path already covered elsewhere; confirm invoice/ledger path via wallet adjust deny for anon
      const anon = await req('GET', '/api/admin/packages/overview');
      failed += !mark('admin_gate_after_restart', anon.status === 401 || anon.status === 403, { status: anon.status })
        ? 1
        : 0;

      // Confirm manual order → credit once
      const confirm = await req('POST', '/api/admin/packages/confirm', {
        token: saTok,
        body: { ref: paidRef, note: 'durability confirm' },
      });
      const me2 = await req('GET', '/api/hub/packages/me', { token });
      failed += !mark(
        'admin_confirm_credits_once',
        confirm.json.ok && me2.json.wallet && me2.json.wallet.paid >= 6000,
        { paid: me2.json.wallet && me2.json.wallet.paid, dup: confirm.json.duplicate }
      )
        ? 1
        : 0;

      const confirm2 = await req('POST', '/api/admin/packages/confirm', {
        token: saTok,
        body: { ref: paidRef, note: 'replay confirm' },
      });
      const me3 = await req('GET', '/api/hub/packages/me', { token });
      failed += !mark(
        'admin_confirm_idempotent',
        confirm2.json.ok && confirm2.json.duplicate === true && me3.json.wallet.paid === me2.json.wallet.paid,
        { paid: me3.json.wallet && me3.json.wallet.paid }
      )
        ? 1
        : 0;

      // Failed electronic payment still unavailable
      const stillDenied = await req('POST', '/api/hub/packages/checkout', {
        token,
        body: { packageId: 'pack-16000', method: 'paymob' },
      });
      failed += !mark('still_no_paymob_without_keys', stillDenied.status === 503, { status: stillDenied.status })
        ? 1
        : 0;
    }

    console.log(failed ? `REPORT fail=${failed}` : 'REPORT durability_pass=all (not production FULL PASS)');
    process.exit(failed ? 2 : 0);
  } finally {
    await stopServer(child);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
