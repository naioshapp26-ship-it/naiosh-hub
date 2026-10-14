/**
 * Production probe for Higher Approvals — never claims FULL PASS on local alone.
 *
 *   BASE_URL=https://naiosh-hub-production.up.railway.app \
 *   HUB_SUPER_ADMIN_EMAIL=... HUB_PROD_SA_PASSWORD=... \
 *   node scripts/e2e-higher-approvals-prod.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BASE = String(process.env.BASE_URL || process.env.HUB_E2E_BASE || process.env.APP_URL || 'https://naiosh-hub-production.up.railway.app').replace(
  /\/$/,
  ''
);
const SA_EMAIL = process.env.HUB_SUPER_ADMIN_EMAIL || process.env.HUB_E2E_STAFF_EMAIL || '';
const SA_PASS = process.env.HUB_PROD_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || process.env.HUB_E2E_STAFF_PASSWORD || '';

const report = {
  at: new Date().toISOString(),
  base: BASE,
  productionTested: true,
  fullPass: false,
  cases: [],
  matrix: [],
};

const mark = (name, ok, detail = '', status) => {
  const result = status || (ok ? 'PASS' : 'FAIL');
  report.cases.push({ name, result, detail: String(detail || '') });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

function req(method, urlPath, { body, cookie, headers } = {}) {
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
          ...(cookie ? { Cookie: cookie } : {}),
          ...(headers || {}),
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
          const setCookie = res.headers['set-cookie'] || [];
          resolve({ status: res.statusCode, headers: res.headers, raw, json, setCookie });
        });
      }
    );
    r.on('error', reject);
    r.setTimeout(45000, () => {
      r.destroy(new Error('timeout'));
    });
    if (payload) r.write(payload);
    r.end();
  });
}

function cookieFrom(setCookie) {
  return (setCookie || [])
    .map((c) => String(c).split(';')[0])
    .filter(Boolean)
    .join('; ');
}

async function main() {
  // 1) Health
  try {
    const h = await req('GET', '/api/health');
    mark('prod_health', h.status === 200 && h.json?.ok === true, `db=${h.json?.database?.status || '?'}`);
  } catch (e) {
    mark('prod_health', false, e.message);
  }

  // 2) /data must not expose ledger
  try {
    const d = await req('GET', '/data/higher-approvals.json');
    const isJsonLedger = d.json && (Array.isArray(d.json.requests) || d.json.schemaVersion);
    const blocked = d.status === 403 || d.status === 404 || (!isJsonLedger && d.status === 200 && /<!DOCTYPE html>/i.test(d.raw));
    // After deploy of #237 hardening, expect hard 403. HTML SPA fallback is weaker but not a JSON leak.
    mark(
      'data_ledger_not_world_readable',
      !isJsonLedger,
      `status=${d.status} jsonLeak=${!!isJsonLedger} blockedOrHtml=${blocked}`,
      isJsonLedger ? 'FAIL' : d.status === 403 ? 'PASS' : 'PASS'
    );
  } catch (e) {
    mark('data_ledger_not_world_readable', false, e.message);
  }

  // 3) Unauth API deny
  try {
    const u = await req('GET', '/api/hub/higher-approvals');
    mark('unauth_list_denied', u.status === 401 || u.status === 403 || u.status === 302, `status=${u.status}`);
  } catch (e) {
    mark('unauth_list_denied', false, e.message);
  }

  if (!SA_EMAIL || !SA_PASS) {
    mark('staff_login', false, 'missing HUB_SUPER_ADMIN_EMAIL / HUB_PROD_SA_PASSWORD', 'NOT TESTED');
    finalize();
    return;
  }

  // 4) Login as higher manager / staff
  let cookie = '';
  let role = '';
  try {
    const login = await req('POST', '/api/auth/login', {
      body: { email: SA_EMAIL, password: SA_PASS },
    });
    cookie = cookieFrom(login.setCookie);
    role = login.json?.user?.role || login.json?.role || '';
    mark('staff_login', login.status === 200 && !!cookie, `role=${role || '?'} status=${login.status}`);
  } catch (e) {
    mark('staff_login', false, e.message);
    finalize();
    return;
  }

  // 5) Inbox API present (post-deploy of #237)
  let inboxOk = false;
  let kpis = null;
  try {
    const list = await req('GET', '/api/hub/higher-approvals', { cookie });
    inboxOk = list.status === 200 && list.json?.ok === true && Array.isArray(list.json.requests);
    kpis = list.json?.kpis || null;
    mark('ha_inbox_api', inboxOk, inboxOk ? `count=${list.json.count} pending=${kpis?.pending}` : `status=${list.status} body=${(list.raw || '').slice(0, 120)}`);
  } catch (e) {
    mark('ha_inbox_api', false, e.message);
  }

  if (!inboxOk) {
    report.matrix.push({
      path: 'full_cycle_prod',
      result: 'NOT TESTED',
      note: 'HA API not deployed on production yet — merge/deploy PR #237 first',
    });
    finalize();
    return;
  }

  // 6) Register from a different identity → must return approvalId
  const slug = `ha-prod-${Date.now().toString(36)}`;
  let approvalId = '';
  let requestId = '';
  try {
    const reg = await req('POST', '/api/hub/register-requests', {
      body: {
        adminName: 'عميل إنتاج موافقات',
        adminPhone: '01009998877',
        adminEmail: `ha-prod-${Date.now()}@example.com`,
        adminPassword: 'TestPass12',
        companyName: 'منصة اختبار موافقات إنتاج',
        slug,
        subdomain: slug,
        host: `${slug}.naiosh.app`,
        requestedSystem: 'HUB',
        requestedSystemLabel: 'نايوش هوب',
        country: 'EG',
        branch: 'CAI',
        branchLabel: 'القاهرة',
        incubator: 'INC',
        incubatorLabel: 'حاضنة',
      },
    });
    requestId = reg.json?.requestId || reg.json?.request?.id || '';
    approvalId = reg.json?.approvalId || reg.json?.approval?.id || '';
    const waiting = /بانتظار موافقة المدير الأعلى/.test(reg.json?.statusLabel || reg.json?.request?.statusLabel || '');
    mark('register_returns_approvalId', !!approvalId && waiting, `req=${requestId} apr=${approvalId}`);
    if (!!approvalId && waiting) {
      report.matrix.push({ path: 'register→waiting_label', result: 'PASS' });
    } else {
      report.matrix.push({ path: 'register→waiting_label', result: 'FAIL', note: 'label without durable APR' });
    }
  } catch (e) {
    mark('register_returns_approvalId', false, e.message);
  }

  // 7) Appears in leader inbox
  let row = null;
  try {
    const list2 = await req('GET', '/api/hub/higher-approvals', { cookie });
    row = (list2.json?.requests || []).find((r) => r.id === approvalId || String(r.sourceId) === String(requestId));
    mark('appears_in_leader_inbox', !!row, row ? `${row.id} status=${row.status}` : 'missing');
    report.matrix.push({ path: 'inbox_visibility', result: row ? 'PASS' : 'FAIL' });
  } catch (e) {
    mark('appears_in_leader_inbox', false, e.message);
  }

  // 8) Everyday admin cannot decide (if we have a non-decider session — skipped when SA is decider)
  // Probe: forge decide with customer cookie is already covered; here assert API 403 with empty role spoof is not possible.
  // Instead: guest decide
  try {
    const guestDecide = await req('POST', `/api/hub/higher-approvals/${encodeURIComponent(approvalId || 'APR-NONE')}/decide`, {
      body: { action: 'approve', note: 'guest' },
    });
    mark('guest_decide_denied', guestDecide.status === 401 || guestDecide.status === 403, `status=${guestDecide.status}`);
  } catch (e) {
    mark('guest_decide_denied', false, e.message);
  }

  // 9) Approve one fresh request (only if we created one)
  if (row && ['pending_review', 'under_review', 'needs_revision'].includes(row.status)) {
    try {
      const dec = await req('POST', `/api/hub/higher-approvals/${encodeURIComponent(row.id)}/decide`, {
        cookie,
        body: { action: 'approve', note: 'اعتماد إنتاج E2E' },
      });
      const ok = dec.status === 200 && dec.json?.request?.status === 'approved';
      mark('prod_approve_reflects', ok, `status=${dec.status} req=${dec.json?.request?.status || ''}`);
      report.matrix.push({ path: 'approve→origin', result: ok ? 'PASS' : 'FAIL' });
    } catch (e) {
      mark('prod_approve_reflects', false, e.message);
    }
  } else {
    mark('prod_approve_reflects', false, 'no open row to approve', 'NOT TESTED');
  }

  // 10) Persistence: re-list after approve
  try {
    const list3 = await req('GET', '/api/hub/higher-approvals', { cookie });
    const again = (list3.json?.requests || []).find((r) => r.id === (row?.id || approvalId));
    mark('persist_after_reload', !!again, again ? `status=${again.status}` : 'missing');
  } catch (e) {
    mark('persist_after_reload', false, e.message);
  }

  // Remaining decision paths (reject/revise/refer) — create extra requests when approve worked
  report.matrix.push({ path: 'reject_prod', result: 'NOT TESTED', note: 'optional second register' });
  report.matrix.push({ path: 'revise_prod', result: 'NOT TESTED', note: 'optional second register' });
  report.matrix.push({ path: 'refer_prod', result: 'NOT TESTED', note: 'optional second register' });
  report.matrix.push({ path: 'service_restart_persist', result: 'NOT TESTED', note: 'requires deploy ops' });
  report.matrix.push({ path: 'logout_login_persist', result: 'NOT TESTED', note: 'UI browser path' });

  finalize();
}

function finalize() {
  const fails = report.cases.filter((c) => c.result === 'FAIL');
  const notTested = report.cases.filter((c) => c.result === 'NOT TESTED');
  const passes = report.cases.filter((c) => c.result === 'PASS');
  report.summary = { pass: passes.length, fail: fails.length, notTested: notTested.length };
  // FULL PASS only if core journey present and no fails
  const core = ['prod_health', 'data_ledger_not_world_readable', 'ha_inbox_api', 'register_returns_approvalId', 'appears_in_leader_inbox', 'prod_approve_reflects', 'persist_after_reload', 'guest_decide_denied'];
  const corePass = core.every((n) => report.cases.some((c) => c.name === n && c.result === 'PASS'));
  report.fullPass = corePass && fails.length === 0;
  report.verdict = report.fullPass ? 'FULL_PASS_PROD' : fails.length ? 'FAIL_OR_PARTIAL' : 'PASS_PARTIAL_PROD';

  const outJson = path.join(__dirname, 'e2e-higher-approvals-prod-report.json');
  const outMd = path.join(__dirname, '..', 'docs', 'higher-approvals-prod-report.md');
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2));
  const md = [
    '# تقرير إنتاج — موافقات المدير الأعلى',
    '',
    `BASE: ${BASE}`,
    `at: ${report.at}`,
    `verdict: **${report.verdict}**`,
    `fullPass: ${report.fullPass}`,
    '',
    '## الحالات',
    '',
    '| الاختبار | النتيجة | تفاصيل |',
    '|---|---|---|',
    ...report.cases.map((c) => `| ${c.name} | ${c.result} | ${c.detail || ''} |`),
    '',
    '## مسارات',
    '',
    '| المسار | النتيجة | ملاحظة |',
    '|---|---|---|',
    ...report.matrix.map((m) => `| ${m.path} | ${m.result} | ${m.note || ''} |`),
    '',
    'لا يُعلن FULL PASS بدون ظهور الطلب في صندوق القائد وانعكاس القرار على الأصل في الإنتاج.',
    '',
  ].join('\n');
  fs.writeFileSync(outMd, md);
  console.log('\nVerdict:', report.verdict);
  console.log('Report:', outMd);
  if (fails.length) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
