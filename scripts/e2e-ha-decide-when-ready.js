/**
 * Run HA approve+reject with real origin effects when HUB_E2E_HA_* is injected.
 * Never prints passwords.
 *
 *   HUB_E2E_HA_EMAIL=... HUB_E2E_HA_PASSWORD=... \
 *   node scripts/e2e-ha-decide-when-ready.js
 */
'use strict';

const fs = require('fs');
const https = require('https');
const http = require('http');

const BASE = String(process.env.HUB_E2E_BASE || 'https://naiosh-hub-production.up.railway.app').replace(/\/$/, '');
const EMAIL = process.env.HUB_E2E_HA_EMAIL || process.env.HUB_SUPER_ADMIN_EMAIL || '';
const PASS = process.env.HUB_E2E_HA_PASSWORD || process.env.HUB_PROD_SA_PASSWORD || '';

function req(method, urlPath, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
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
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
          } catch (_) {}
          resolve({ status: res.statusCode, json });
        });
      }
    );
    r.on('error', reject);
    r.setTimeout(60000, () => r.destroy(new Error('timeout')));
    if (payload) r.write(payload);
    r.end();
  });
}

async function main() {
  if (!EMAIL || !PASS) {
    console.log(
      JSON.stringify({
        ok: false,
        reason: 'missing_HUB_E2E_HA_EMAIL_or_PASSWORD',
        hint: 'Inject secrets; do not paste into chat',
      })
    );
    process.exit(2);
  }

  const report = { at: new Date().toISOString(), base: BASE, cases: [] };
  const mark = (name, ok, detail) => {
    report.cases.push({ name, result: ok ? 'PASS' : 'FAIL', detail: String(detail || '') });
    console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  };

  const login = await req('POST', '/api/auth/login', { body: { email: EMAIL, password: PASS } });
  const token = login.json?.token;
  const role = login.json?.user?.role;
  mark('ha_login', !!token, `status=${login.status} role=${role}`);
  if (!token) {
    fs.writeFileSync('/opt/cursor/artifacts/launch-ha-decide-result.json', JSON.stringify(report, null, 2));
    process.exit(1);
  }

  // Create fresh register + rental for isolated decide
  const stamp = Date.now();
  const slug = `ha${String(stamp).slice(-8)}`;
  const reg = await req('POST', '/api/hub/register-requests', {
    body: {
      adminName: 'HA Decide Probe',
      adminPhone: '079' + String(stamp).slice(-7),
      adminEmail: `ha_reg_${stamp}@naiosh.test`,
      adminPassword: 'HaDecide12!',
      companyName: 'HA Co',
      requestedSystem: 'ERP',
      plan: 'starter',
      slug,
      subdomain: slug,
    },
  });
  const regId = reg.json?.request?.id;
  const aprGrant = reg.json?.request?.approvalId || reg.json?.approvalId;
  mark('create_register_ha', !!regId && !!aprGrant, `${regId}/${aprGrant}`);

  const rslug = `hr${String(stamp).slice(-8)}`;
  const rent = await req('POST', '/api/hub/system-rentals/submit', {
    body: {
      adminName: 'HA Rent Probe',
      adminPhone: '078' + String(stamp).slice(-7),
      adminEmail: `ha_rent_${stamp}@naiosh.test`,
      adminPassword: 'HaDecide12!',
      companyName: 'HA Rent',
      systems: ['ERP'],
      slug: rslug,
      subdomain: rslug,
    },
  });
  const rentId = rent.json?.rental?.id;
  const aprRent = rent.json?.approvalId || rent.json?.rental?.approvalId;
  mark('create_rental_ha', !!rentId && !!aprRent, `${rentId}/${aprRent}`);

  const approve = await req('POST', `/api/hub/higher-approvals/${encodeURIComponent(aprGrant)}/decide`, {
    token,
    body: { action: 'approve', note: 'e2e approve effect' },
  });
  mark('approve_decide', approve.status === 200 && approve.json?.request?.status === 'approved', `status=${approve.status} ha=${approve.json?.request?.status}`);

  const grantGet = await req('GET', '/api/hub/platform-grants', { token });
  const grantRow = (grantGet.json?.state?.grants || []).find((g) => g.id === regId);
  mark('approve_origin_active', !!grantRow && ['active', 'مفعّل'].includes(String(grantRow.status)), `status=${grantRow?.status}`);

  const reject = await req('POST', `/api/hub/higher-approvals/${encodeURIComponent(aprRent)}/decide`, {
    token,
    body: { action: 'reject', note: 'e2e reject effect', reason: 'رفض اختبار معزول' },
  });
  mark('reject_decide', reject.status === 200 && reject.json?.request?.status === 'rejected', `status=${reject.status} ha=${reject.json?.request?.status}`);

  const rentGet = await req('GET', '/api/hub/system-rentals', { token });
  const rentals = rentGet.json?.rentals || rentGet.json?.items || [];
  const rentRow = rentals.find((r) => r.id === rentId);
  mark('reject_origin_rejected', !!rentRow && String(rentRow.status).toLowerCase().includes('reject'), `status=${rentRow?.status}`);

  // replay approve should not re-apply freely
  const replay = await req('POST', `/api/hub/higher-approvals/${encodeURIComponent(aprGrant)}/decide`, {
    token,
    body: { action: 'approve', note: 'replay' },
  });
  mark(
    'replay_blocked_or_noop',
    replay.status >= 400 || approve.json?.request?.status === 'approved',
    `status=${replay.status} err=${replay.json?.error || ''}`
  );

  // admin still denied
  const adminEmail = 'e2e-branches@naiosh.test';
  const adminPass = require('crypto')
    .createHash('sha256')
    .update(`naiosh-hub-e2e-staff-v1|${adminEmail}|EMP-E2E-BR`)
    .digest('base64url')
    .slice(0, 28);
  const adminLogin = await req('POST', '/api/auth/login', { body: { email: adminEmail, password: adminPass } });
  const adminTok = adminLogin.json?.token;
  const adminDecide = await req('POST', `/api/hub/higher-approvals/${encodeURIComponent(aprRent)}/decide`, {
    token: adminTok,
    body: { action: 'approve', note: 'should 403' },
  });
  mark('admin_decide_denied', adminDecide.status === 403, `status=${adminDecide.status}`);

  report.fullPass = report.cases.every((c) => c.result === 'PASS');
  report.subjects = { aprGrant, aprRent, regId, rentId };
  fs.writeFileSync('/opt/cursor/artifacts/launch-ha-decide-result.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ fullPass: report.fullPass, subjects: report.subjects }, null, 2));
  process.exit(report.fullPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
