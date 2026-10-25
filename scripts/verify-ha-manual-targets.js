/**
 * Verify operator-decided HA targets from /opt/cursor/artifacts/launch-ha-manual-targets.json
 * Uses e2e staff (read + admin deny) only — never needs Super Admin password.
 *
 *   node scripts/verify-ha-manual-targets.js
 */
'use strict';

const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const BASE = String(process.env.HUB_E2E_BASE || 'https://naiosh-hub-production.up.railway.app').replace(/\/$/, '');
const TARGETS = '/opt/cursor/artifacts/launch-ha-manual-targets.json';
const staffEmail = 'e2e-branches@naiosh.test';
const staffPass = crypto
  .createHash('sha256')
  .update(`naiosh-hub-e2e-staff-v1|${staffEmail}|EMP-E2E-BR`)
  .digest('base64url')
  .slice(0, 28);

function req(method, path, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body != null ? JSON.stringify(body) : null;
    const u = new URL(path, BASE);
    const r = https.request(
      {
        method,
        hostname: u.hostname,
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
          let json = null;
          try {
            json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch (_) {}
          resolve({ status: res.statusCode, json });
        });
      }
    );
    r.on('error', reject);
    r.setTimeout(45000, () => r.destroy(new Error('timeout')));
    if (payload) r.write(payload);
    r.end();
  });
}

async function main() {
  const targets = JSON.parse(fs.readFileSync(TARGETS, 'utf8'));
  const aprA = targets.approve.approvalId;
  const aprR = targets.reject.approvalId;
  const regId = targets.approve.originId;
  const rentId = targets.reject.originId;
  const cases = [];
  const mark = (name, ok, detail) => {
    cases.push({ name, result: ok ? 'PASS' : 'FAIL', detail: String(detail || '') });
    console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  };

  const login = await req('POST', '/api/auth/login', { body: { email: staffEmail, password: staffPass } });
  const token = login.json?.token;
  mark('staff_login', !!token, `status=${login.status}`);

  const list = await req('GET', '/api/hub/higher-approvals', { token });
  const rows = list.json?.requests || [];
  const rowA = rows.find((r) => r.id === aprA);
  const rowR = rows.find((r) => r.id === aprR);
  mark('approve_ha_status', !!rowA && rowA.status === 'approved', `status=${rowA?.status}`);
  mark('reject_ha_status', !!rowR && rowR.status === 'rejected', `status=${rowR?.status}`);

  const decisions = list.json?.decisions || [];
  const decA = decisions.find((d) => d.requestId === aprA || d.approvalId === aprA) || rowA?.history?.slice(-1)?.[0];
  const decR = decisions.find((d) => d.requestId === aprR || d.approvalId === aprR) || rowR?.history?.slice(-1)?.[0];
  mark('audit_approve_present', !!(decA || (rowA?.decidedAt && rowA?.decidedBy)), `decidedAt=${rowA?.decidedAt} by=${rowA?.decidedBy}`);
  mark('audit_reject_present', !!(decR || (rowR?.decidedAt && rowR?.rejectReason)), `reason=${rowR?.rejectReason || ''}`);

  const grants = await req('GET', '/api/hub/platform-grants', { token });
  const g = (grants.json?.state?.grants || []).find((x) => x.id === regId);
  mark('approve_origin_active', !!g && ['active', 'مفعّل'].includes(String(g.status)), `grant=${g?.status}`);

  const rentals = await req('GET', '/api/hub/system-rentals', { token });
  const rentList = rentals.json?.rentals || rentals.json?.items || [];
  const rent = rentList.find((x) => x.id === rentId);
  mark(
    'reject_origin_rejected',
    !!rent && /reject|مرفوض/i.test(String(rent.status) + String(rent.statusLabel || '')),
    `rental=${rent?.status}`
  );

  const replay = await req('POST', `/api/hub/higher-approvals/${encodeURIComponent(aprA)}/decide`, {
    token,
    body: { action: 'approve', note: 'replay-as-admin-should-403-first' },
  });
  mark('admin_replay_denied', replay.status === 403, `status=${replay.status}`);

  // Customer visibility via my-grant if email known
  // (staff path already proves origin). Also check register list status.
  const regList = await req('GET', '/api/hub/register-requests', { token });
  const regRow = (regList.json?.requests || []).find((r) => r.id === regId);
  mark(
    'customer_facing_grant_status',
    !!regRow && ['active', 'مفعّل', 'approved'].includes(String(regRow.status)),
    `registerList=${regRow?.status}`
  );

  const report = {
    at: new Date().toISOString(),
    subjects: { aprA, aprR, regId, rentId },
    pass: cases.filter((c) => c.result === 'PASS').length,
    fail: cases.filter((c) => c.result === 'FAIL').length,
    cases,
  };
  report.fullPass = report.fail === 0;
  fs.writeFileSync('/opt/cursor/artifacts/launch-ha-manual-verify.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ fullPass: report.fullPass, pass: report.pass, fail: report.fail }, null, 2));
  process.exit(report.fullPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
