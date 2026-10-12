#!/usr/bin/env node
/**
 * READ-ONLY bookings audit + recovery dry-run.
 * NEVER writes to production. NEVER replaces current bookings.
 *
 * Compares live prod GET /api/hub/platform-bookings (via E2E staff) against a local vault,
 * then simulates union-by-id (prod wins on same id).
 *
 * Usage:
 *   HUB_E2E_BASE=https://naiosh-hub-production.up.railway.app \
 *   HUB_E2E_STAFF_EMAIL=e2e-branches@naiosh.test \
 *   HUB_E2E_STAFF_PASSWORD=… \
 *   VAULT=/tmp/cursor-e2e/bookings-recovery-vault.json \
 *   node scripts/bookings-recovery-dryrun.js
 *
 * Optional APPLY=1 is intentionally rejected unless HUB_BOOKINGS_RESTORE_APPROVED=1
 * (still not implemented for prod write — exits with plan only).
 */
'use strict';

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { mergeBookingsById } = require('../lib/hub-platform-booking');

const BASE = (process.env.HUB_E2E_BASE || 'https://naiosh-hub-production.up.railway.app').replace(
  /\/$/,
  ''
);
const STAFF_EMAIL = process.env.HUB_E2E_STAFF_EMAIL || 'e2e-branches@naiosh.test';
const STAFF_PASS =
  process.env.HUB_E2E_STAFF_PASSWORD ||
  crypto
    .createHash('sha256')
    .update(`naiosh-hub-e2e-staff-v1|${STAFF_EMAIL.toLowerCase()}|EMP-E2E-BR`)
    .digest('base64url')
    .slice(0, 28);
const VAULT =
  process.env.VAULT ||
  process.env.BOOKINGS_VAULT ||
  '/tmp/cursor-e2e/bookings-recovery-vault.json';
const OUT_DIR = '/opt/cursor/artifacts';
const OUT = path.join(OUT_DIR, `bookings-recovery-dryrun-${Date.now()}.json`);

function req(method, p, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(p, BASE);
    const lib = u.protocol === 'https:' ? https : http;
    const payload = body != null ? JSON.stringify(body) : null;
    const r = lib.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        headers: {
          Accept: 'application/json',
          Origin: BASE,
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...(token ? { Authorization: `Bearer ${token}`, 'X-Hub-Token': token } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch {
            /* */
          }
          resolve({ status: res.statusCode, json, raw });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function classify(email) {
  const e = String(email || '').toLowerCase();
  if (e.startsWith('local.')) return 'local_agent';
  if (e.includes('prod.submit') || e.includes('osm.live')) return 'proven_prod_e2e';
  if (e.endsWith('@naiosh-test.com')) return 'local_or_fixture';
  return 'unknown';
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(VAULT)) {
    console.error(`Vault missing: ${VAULT}`);
    process.exit(1);
  }
  const vault = JSON.parse(fs.readFileSync(VAULT, 'utf8'));
  const candidates = Array.isArray(vault.candidates) ? vault.candidates : [];

  const login = await req('POST', '/api/auth/login', {
    body: { email: STAFF_EMAIL, password: STAFF_PASS, lane: 'staff' },
  });
  if (!login.json?.token) {
    console.error('Staff login failed', login.status, login.json?.error);
    process.exit(1);
  }
  const list = await req('GET', '/api/hub/platform-bookings', { token: login.json.token });
  const prod = Array.isArray(list.json?.bookings) ? list.json.bookings : [];
  const prodIds = new Set(prod.map((b) => b.id));

  const missing = candidates
    .filter((c) => c?.id && !prodIds.has(c.id))
    .map((c) => ({
      id: c.id,
      email: c.email,
      createdAt: c.createdAt,
      branch: c.branch || c.branchName,
      kind: c.kind,
      origin: classify(c.email),
      provenLostOnProd: classify(c.email) === 'proven_prod_e2e',
    }));
  const present = candidates.filter((c) => prodIds.has(c.id)).map((c) => c.id);

  // Dry-run union: prod first so prod wins on id conflict
  const simulated = mergeBookingsById(prod, candidates);
  const wouldAdd = simulated.filter((b) => !prodIds.has(b.id)).map((b) => b.id);
  const wouldKeepProd = prod.map((b) => b.id);
  const provenLost = missing.filter((m) => m.provenLostOnProd);

  if (String(process.env.APPLY || '') === '1') {
    console.error(
      'APPLY rejected: restore requires explicit operator approval + backup. This script is dry-run only.'
    );
    if (String(process.env.HUB_BOOKINGS_RESTORE_APPROVED || '') !== '1') {
      console.error('Also missing HUB_BOOKINGS_RESTORE_APPROVED=1');
    }
  }

  const report = {
    at: new Date().toISOString(),
    base: BASE,
    mode: 'dry-run',
    restoreApplied: false,
    overwritePerformed: false,
    prodCount: prod.length,
    vaultCandidates: candidates.length,
    prodIds: [...prodIds],
    presentInProdFromVault: present,
    missingFromProd: missing,
    provenProdLossCount: provenLost.length,
    provenProdLossIds: provenLost.map((m) => m.id),
    dryRunUnion: {
      resultingCount: simulated.length,
      wouldKeepCurrentProdIds: wouldKeepProd,
      wouldAddIds: wouldAdd,
      prodWinsOnConflict: true,
    },
    safetyPlan: [
      '1) Export backup of hub_meta.platform_bookings_v1 and data/platform-bookings.json from prod',
      '2) Review wouldAddIds — restore ONLY proven_prod_e2e (or owner-approved ids)',
      '3) Apply union-by-id (prod wins on conflict); never replace the whole array with vault',
      '4) Re-GET list and confirm current 2 + restored ids coexist',
      '5) Do not run APPLY without HUB_BOOKINGS_RESTORE_APPROVED=1 and a written backup path',
    ],
    hydrateFixNote:
      'server hydrate now merges disk∪db by id so a smaller DB snapshot cannot wipe a fuller disk file (and vice versa).',
    lossIsNotNormal: provenLost.length > 0,
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  // Also refresh the working audit copy
  try {
    fs.mkdirSync('/tmp/cursor-e2e', { recursive: true });
    fs.writeFileSync('/tmp/cursor-e2e/bookings-prod-vs-vault.json', JSON.stringify(report, null, 2));
  } catch {
    /* */
  }

  console.log(
    JSON.stringify(
      {
        prodCount: report.prodCount,
        provenProdLossCount: report.provenProdLossCount,
        provenProdLossIds: report.provenProdLossIds,
        wouldAddIds: report.dryRunUnion.wouldAddIds,
        restoreApplied: false,
        out: OUT,
      },
      null,
      2
    )
  );
  // Exit 2 if proven prod loss detected (signal for operators) — still dry-run
  process.exit(provenLost.length ? 2 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
