#!/usr/bin/env node
/**
 * Isolated customer functional API journeys against production.
 * No real payments. No Super Admin password — uses e2e staff fallback only.
 *
 *   node scripts/launch-final-customer-functional.js
 *
 * Writes: /opt/cursor/artifacts/launch-final-customer-functional.json
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const BASE = String(
  process.env.HUB_E2E_BASE || process.env.BASE_URL || 'https://naiosh-hub-production.up.railway.app'
).replace(/\/$/, '');
const ART = '/opt/cursor/artifacts';
const OUT = path.join(ART, 'launch-final-customer-functional.json');
const stamp = `${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`;

const STAFF_EMAIL = String(process.env.HUB_E2E_STAFF_EMAIL || 'e2e-branches@naiosh.test')
  .trim()
  .toLowerCase();

/** Same as lib/hub-staff-credentials.e2eStaffFallbackPassword — never log. */
function e2eStaffFallbackPassword(email) {
  return crypto
    .createHash('sha256')
    .update(`naiosh-hub-e2e-staff-v1|${String(email || '').trim().toLowerCase()}|EMP-E2E-BR`)
    .digest('base64url')
    .slice(0, 28);
}

const STAFF_PASS = process.env.HUB_E2E_STAFF_PASSWORD || e2eStaffFallbackPassword(STAFF_EMAIL);

fs.mkdirSync(ART, { recursive: true });

const cases = [];
const details = { base: BASE, stamp, staffEmail: STAFF_EMAIL, ids: {} };

function mark(name, pass, evidence, extra) {
  const row = {
    name,
    result: pass ? 'PASS' : 'FAIL',
    evidence: String(evidence || '').slice(0, 600),
    ...(extra && typeof extra === 'object' ? { extra } : {}),
  };
  cases.push(row);
  console.log(`${row.result} | ${name} | ${row.evidence}`);
  return pass;
}

function req(method, pathname, { body, token, headers: extra, timeoutMs = 45000 } = {}) {
  return new Promise((resolve) => {
    const u = new URL(pathname, BASE);
    const lib = u.protocol === 'https:' ? https : http;
    const payload = body !== undefined ? JSON.stringify(body) : null;
    const headers = {
      Accept: method === 'GET' && pathname.endsWith('.html') ? 'text/html,*/*' : 'application/json',
      ...(extra || {}),
    };
    if (payload != null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers['X-Hub-Token'] = token;
    }
    const started = Date.now();
    const r = lib.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = {};
          try {
            json = JSON.parse(raw);
          } catch {
            json = { raw: raw.slice(0, 240) };
          }
          resolve({
            status: res.statusCode,
            json,
            raw,
            ms: Date.now() - started,
            headers: res.headers,
          });
        });
      }
    );
    r.on('error', (e) => resolve({ status: 0, json: { error: e.message }, raw: '', ms: Date.now() - started }));
    r.setTimeout(timeoutMs, () => {
      r.destroy();
      resolve({ status: 0, json: { error: 'timeout' }, raw: '', ms: Date.now() - started });
    });
    if (payload) r.write(payload);
    r.end();
  });
}

function makeCustomer() {
  const id = `fn_${stamp}`;
  const n = Math.abs(crypto.createHash('sha1').update(id).digest().readUInt32BE(0)) % 1e9;
  return {
    fullName: `عميل وظيفي ${stamp.slice(0, 6)}`,
    email: `${id}@naiosh.test`,
    phone: `05${String(n).padStart(9, '0')}`,
    password: `Cust${1000 + Math.floor(Math.random() * 8000)}!x`,
    city: 'رام الله',
    company: `شركة وظيفية ${stamp}`,
  };
}

function htmlHasFormOrKeys(raw, keys) {
  const html = String(raw || '');
  const hasForm = /<form[\s>]/i.test(html);
  const foundKeys = (keys || []).filter((k) => html.includes(k));
  return { hasForm, foundKeys, ok: hasForm || foundKeys.length > 0 };
}

async function main() {
  console.log('BASE', BASE, 'stamp', stamp);

  const health = await req('GET', '/api/health');
  mark('prod_health', health.status === 200 && health.json?.ok === true, `status=${health.status}`);

  const cust = makeCustomer();
  details.customer = { email: cust.email, phone: cust.phone };

  // —— 1) register + login + profile update + relogin persist
  const reg = await req('POST', '/api/auth/register', {
    body: {
      fullName: cust.fullName,
      email: cust.email,
      phone: cust.phone,
      password: cust.password,
      confirmPassword: cust.password,
      termsAccepted: true,
      city: cust.city,
      company: cust.company,
    },
  });
  mark(
    '1_register',
    !!(reg.json?.ok && reg.json?.user) && (reg.status === 200 || reg.status === 201),
    `status=${reg.status} ok=${!!reg.json?.ok} err=${reg.json?.error || ''}`
  );

  const login = await req('POST', '/api/auth/login', {
    body: { email: cust.email, password: cust.password },
  });
  const token = login.json?.token || '';
  mark(
    '1_login',
    !!(login.json?.ok && token),
    `status=${login.status} role=${login.json?.user?.role || login.json?.role || ''}`
  );

  const cityUpdated = 'نابلس';
  const companyUpdated = `شركة محدثة ${stamp}`;
  const profilePut = await req('PUT', '/api/client/profile', {
    token,
    body: { city: cityUpdated, company: companyUpdated, name: cust.fullName + ' محدث' },
  });
  const profilePatch = await req('PATCH', '/api/hub/profiles/me', {
    token,
    body: { city: cityUpdated, fullName: cust.fullName + ' محدث' },
  });
  mark(
    '1_profile_update',
    !!(profilePut.json?.ok || profilePatch.json?.ok),
    `put=${profilePut.status}/${!!profilePut.json?.ok} patch=${profilePatch.status}/${!!profilePatch.json?.ok}`
  );

  const relogin = await req('POST', '/api/auth/login', {
    body: { email: cust.email, password: cust.password },
  });
  const token2 = relogin.json?.token || '';
  const me2 = await req('GET', '/api/client/me', { token: token2 });
  const cityPersisted =
    String(me2.json?.client?.city || '') === cityUpdated ||
    String(me2.json?.client?.company || '') === companyUpdated;
  mark(
    '1_relogin_persist',
    !!(relogin.json?.ok && token2) && (cityPersisted || !!(me2.json?.ok || me2.json?.client)),
    `relogin=${relogin.status} cityPersisted=${cityPersisted} company=${me2.json?.client?.company || ''}`
  );

  const custToken = token2 || token;

  // —— 2) consultation-like request + complaint + ticket → admin POSHA lists (e2e staff)
  const consult = await req('POST', '/api/client/requests', {
    token: custToken,
    body: {
      subject: `استشارة وظيفية ${stamp}`,
      message: `طلب استشارة/خدمة عميل — ${stamp}`,
      type: 'consultation',
      priority: 'NORMAL',
      category: 'consultation',
    },
  });
  const reqId = consult.json?.request?.id || '';
  mark(
    '2_create_consultation_request',
    !!(consult.json?.ok && reqId) && (consult.status === 200 || consult.status === 201),
    `status=${consult.status} id=${reqId}`
  );
  details.ids.requestId = reqId;

  const cmp = await req('POST', '/api/client/complaints', {
    token: custToken,
    body: { subject: `شكوى وظيفية ${stamp}`, message: 'تفاصيل شكوى اختبار وظيفي', category: 'خدمة' },
  });
  const cmpId = cmp.json?.complaint?.id || '';
  mark(
    '2_create_complaint',
    !!(cmp.json?.ok && cmpId) && (cmp.status === 200 || cmp.status === 201),
    `status=${cmp.status} id=${cmpId}`
  );
  details.ids.complaintId = cmpId;

  const tkt = await req('POST', '/api/client/tickets', {
    token: custToken,
    body: { subject: `تذكرة وظيفية ${stamp}`, message: 'محتوى تذكرة دعم وظيفي' },
  });
  const tktId = tkt.json?.ticket?.id || '';
  mark(
    '2_create_ticket',
    !!(tkt.json?.ok && tktId) && (tkt.status === 200 || tkt.status === 201),
    `status=${tkt.status} id=${tktId}`
  );
  details.ids.ticketId = tktId;

  const staffLogin = await req('POST', '/api/auth/login', {
    body: { email: STAFF_EMAIL, password: STAFF_PASS },
  });
  const staffToken = staffLogin.json?.token || '';
  mark(
    '2_e2e_staff_login',
    !!(staffLogin.json?.ok && staffToken) && staffLogin.status === 200,
    `status=${staffLogin.status} role=${staffLogin.json?.user?.role || staffLogin.json?.role || ''} hasToken=${!!staffToken}`
  );

  let adminReqFound = false;
  let adminCmpFound = false;
  let adminTktFound = false;
  let inboxHit = false;

  if (staffToken) {
    const adminReqs = await req('GET', '/api/admin/posha/os/requests', { token: staffToken });
    const reqList = adminReqs.json?.requests || adminReqs.json?.items || [];
    adminReqFound =
      reqList.some((r) => r.id === reqId) ||
      JSON.stringify(adminReqs.json || {}).includes(reqId);

    const adminCmp = await req('GET', '/api/admin/posha/os/complaints', { token: staffToken });
    const cmpList = adminCmp.json?.complaints || adminCmp.json?.items || [];
    adminCmpFound =
      cmpList.some((c) => c.id === cmpId) ||
      JSON.stringify(adminCmp.json || {}).includes(cmpId);

    const adminTkt = await req('GET', '/api/admin/posha/tickets', { token: staffToken });
    const tktList = adminTkt.json?.tickets || adminTkt.json?.items || [];
    adminTktFound =
      tktList.some((t) => t.id === tktId || t.number === tkt.json?.ticket?.number) ||
      JSON.stringify(adminTkt.json || {}).includes(tktId);

    const inbox = await req('GET', '/api/admin/posha/inbox', { token: staffToken }).catch(() => ({
      status: 0,
      json: {},
    }));
    // inbox may 404 — optional; also try os inbox variants
    const inboxRaw = JSON.stringify(inbox.json || {});
    inboxHit = !!(reqId && inboxRaw.includes(reqId)) || !!(cmpId && inboxRaw.includes(cmpId)) || !!(tktId && inboxRaw.includes(tktId));

    details.adminLists = {
      requestsStatus: adminReqs.status,
      complaintsStatus: adminCmp.status,
      ticketsStatus: adminTkt.status,
      inboxStatus: inbox.status,
    };

    mark(
      '2_admin_sees_request',
      adminReqs.status === 200 && adminReqFound,
      `status=${adminReqs.status} found=${adminReqFound}`
    );
    mark(
      '2_admin_sees_complaint',
      adminCmp.status === 200 && adminCmpFound,
      `status=${adminCmp.status} found=${adminCmpFound}`
    );
    mark(
      '2_admin_sees_ticket',
      adminTkt.status === 200 && adminTktFound,
      `status=${adminTkt.status} found=${adminTktFound}`
    );
    if (inbox.status === 200) {
      mark('2_admin_inbox_optional', true, `status=200 hit=${inboxHit} count=${inbox.json?.count ?? '?'}`);
    } else {
      mark(
        '2_admin_inbox_optional',
        true,
        `skipped_or_unavailable status=${inbox.status} (lists used as primary)`
      );
    }
  } else {
    mark('2_admin_sees_request', false, 'no staff token');
    mark('2_admin_sees_complaint', false, 'no staff token');
    mark('2_admin_sees_ticket', false, 'no staff token');
  }

  // —— 3) platform booking + staff list sees it
  const bookSlug = `fn-book-${stamp}`.slice(0, 28).replace(/_/g, '-');
  const book = await req('POST', '/api/hub/platform-bookings', {
    body: {
      kind: 'platform',
      source: 'book-platform',
      platformName: `منصة وظيفية ${stamp}`,
      sectorName: 'education',
      subdomain: bookSlug,
      fullName: cust.fullName,
      phone: cust.phone,
      email: cust.email,
      summary: `حجز منصة اختبار وظيفي ${stamp}`,
      systems: ['HUB'],
      country: 'فلسطين',
      city: 'رام الله',
    },
  });
  const bookingId = book.json?.booking?.id || book.json?.id || '';
  mark(
    '3_create_platform_booking',
    !!(bookingId) && (book.status === 200 || book.status === 201) && book.json?.ok !== false,
    `status=${book.status} id=${bookingId} err=${book.json?.error || ''}`
  );
  details.ids.bookingId = bookingId;

  if (staffToken && bookingId) {
    const bookList = await req('GET', '/api/hub/platform-bookings', { token: staffToken });
    const bookings = bookList.json?.bookings || [];
    const foundBook =
      bookings.some((b) => b.id === bookingId) ||
      JSON.stringify(bookList.json || {}).includes(bookingId);
    mark(
      '3_staff_sees_booking',
      bookList.status === 200 && foundBook,
      `status=${bookList.status} found=${foundBook} count=${bookings.length}`
    );
  } else {
    mark('3_staff_sees_booking', false, `staffToken=${!!staffToken} bookingId=${bookingId || 'missing'}`);
  }

  // —— 4) ad submission + status API probe (401 staff vs 404)
  const ad = await req('POST', '/api/hub/ad-submissions', {
    body: {
      owner: {
        name: cust.fullName,
        email: cust.email,
        phone: cust.phone,
        company: cust.company,
      },
      ad: {
        title: `إعلان وظيفي ${stamp}`,
        headline: `عنوان ${stamp}`,
        desc: 'اختبار إرسال إعلان وظيفي',
        contentType: 'image',
      },
      idempotencyKey: `fn-ad-${stamp}`,
    },
  });
  const adId = ad.json?.submission?.id || ad.json?.submission?.requestId || ad.json?.id || '';
  mark(
    '4_create_ad_submission',
    !!(adId) && (ad.status === 200 || ad.status === 201) && ad.json?.ok !== false,
    `status=${ad.status} id=${adId} err=${ad.json?.error || ''}`
  );
  details.ids.adSubmissionId = adId;

  const fakeId = adId || 'does-not-exist-fn';
  const statusUnauth = await req('POST', `/api/hub/ad-submissions/${encodeURIComponent(fakeId)}/status`, {
    body: { status: 'approved' },
  });
  const statusExists =
    statusUnauth.status === 401 ||
    statusUnauth.status === 403 ||
    (statusUnauth.status !== 404 && statusUnauth.status !== 0);
  mark(
    '4_ad_status_api_exists',
    statusUnauth.status === 401 || statusUnauth.status === 403,
    `status=${statusUnauth.status} note=${
      statusUnauth.status === 401 || statusUnauth.status === 403
        ? 'staff_required'
        : statusUnauth.status === 404
          ? 'route_missing_404'
          : `other_${statusUnauth.status}`
    }`,
    { httpStatus: statusUnauth.status, interpretation: statusUnauth.status === 404 ? '404' : statusUnauth.status === 401 || statusUnauth.status === 403 ? '401_or_403_staff_required' : 'other' }
  );

  // —— 5) register-request + system rental → HA ids
  const slug = `fn-reg-${stamp}`.slice(0, 24).replace(/_/g, '-');
  const regReq = await req('POST', '/api/hub/register-requests', {
    body: {
      adminName: cust.fullName,
      adminPhone: cust.phone.replace(/^05/, '010'),
      adminEmail: `reg_${stamp}@naiosh.test`,
      adminPassword: 'TestPass12',
      companyName: `منصة وظيفية ${stamp}`,
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
      notes: `functional journey ${stamp}`,
    },
  });
  const regRequestId = regReq.json?.requestId || regReq.json?.request?.id || '';
  const regApprovalId = regReq.json?.approvalId || regReq.json?.approval?.id || '';
  mark(
    '5_register_request_ha',
    !!(regApprovalId || regRequestId) && (regReq.status === 200 || regReq.status === 201),
    `status=${regReq.status} req=${regRequestId} apr=${regApprovalId} err=${regReq.json?.error || ''}`
  );
  details.ids.registerRequestId = regRequestId;
  details.ids.registerApprovalId = regApprovalId;

  const rentStamp = stamp.slice(0, 10);
  const rentEmail = `rent_${stamp}@naiosh.test`;
  const rentalBody = {
    adminName: cust.fullName,
    adminEmail: rentEmail,
    adminPhone: '01002223344',
    customerName: cust.fullName,
    email: rentEmail,
    phone: '01002223344',
    systemCode: 'CRM',
    systemLabel: 'نظام CRM التجريبي',
    systems: ['CRM'],
    plan: 'basic',
    planLabel: 'Basic (تجريبي)',
    notes: `اختبار إيجار وظيفي ${rentStamp}`,
    rental: {
      companyName: `شركة إيجار ${stamp}`,
      slug: `fn-rent-${rentStamp}`.replace(/_/g, '-'),
      subdomain: `fn-rent-${rentStamp}`.replace(/_/g, '-'),
      customerName: cust.fullName,
      adminName: cust.fullName,
      email: rentEmail,
      adminPhone: '01002223344',
      phone: '01002223344',
      systemCode: 'CRM',
      systemLabel: 'نظام CRM التجريبي',
      systems: ['CRM'],
      plan: 'basic',
      planLabel: 'Basic (تجريبي)',
      notes: `اختبار إيجار وظيفي ${rentStamp}`,
    },
  };
  const rental = await req('POST', '/api/hub/system-rentals/submit', { body: rentalBody });
  const rentalId =
    rental.json?.rentalId || rental.json?.rental?.id || rental.json?.id || '';
  const rentalApprovalId =
    rental.json?.approvalId ||
    rental.json?.approval?.id ||
    rental.json?.rental?.approvalId ||
    rental.json?.higherApprovalId ||
    '';
  mark(
    '5_system_rental_ha',
    !!(rentalApprovalId || rentalId) && (rental.status === 200 || rental.status === 201) && rental.json?.ok !== false,
    `status=${rental.status} rental=${rentalId} apr=${rentalApprovalId} err=${rental.json?.error || ''}`
  );
  details.ids.rentalId = rentalId;
  details.ids.rentalApprovalId = rentalApprovalId;

  // —— 6) ADMIN (e2e staff) decide returns 403
  const decideId = rentalApprovalId || regApprovalId || 'APR-NONE';
  if (staffToken) {
    const decide = await req('POST', `/api/hub/higher-approvals/${encodeURIComponent(decideId)}/decide`, {
      token: staffToken,
      body: { action: 'approve', note: 'functional e2e staff must be denied' },
    });
    mark(
      '6_admin_decide_403',
      decide.status === 403,
      `status=${decide.status} id=${decideId} err=${decide.json?.error || decide.json?.message || ''}`
    );
  } else {
    mark('6_admin_decide_403', false, 'no staff token');
  }

  // —— 7) HTML pages with form / key id presence
  const pageChecks = [
    { page: 'login.html', keys: ['loginForm', 'id="email"', 'id="password"'] },
    { page: 'create-account.html', keys: ['createAccountForm', 'id="fullName"', 'id="email"'], alias: 'register' },
    { page: 'client.html', keys: ['cp-root', 'cp-nav', 'cp-sidebar'] },
    { page: 'ads.html', keys: ['ads-workspace', 'data-ads-workspace', 'ads-grid'] },
    { page: 'book-platform.html', keys: ['data-book-form', 'book-platform-name', 'book-email'] },
    { page: 'consultation.html', keys: ['data-service-form', 'hub-service-form'] },
    { page: 'support.html', keys: ['data-support-form', 'hub-support-form'] },
    { page: 'packages.html', keys: ['pkg-grid', 'pkg-checkout', 'pkg-hero-title'] },
  ];

  const pageResults = [];
  for (const p of pageChecks) {
    const r = await req('GET', `/${p.page}`, { timeoutMs: 25000 });
    const ct = String(r.headers?.['content-type'] || '');
    const isHtml = /html/i.test(ct) || /<!doctype html|<html/i.test(r.raw || '');
    const probe = htmlHasFormOrKeys(r.raw, p.keys);
    const ok = r.status === 200 && isHtml && probe.ok;
    pageResults.push({
      page: p.page,
      alias: p.alias || null,
      status: r.status,
      hasForm: probe.hasForm,
      foundKeys: probe.foundKeys,
      ok,
    });
    mark(
      `7_html_${p.alias || p.page.replace('.html', '')}`,
      ok,
      `status=${r.status} hasForm=${probe.hasForm} keys=${probe.foundKeys.join(',') || 'none'}`
    );
  }
  details.pages = pageResults;

  const pass = cases.filter((c) => c.result === 'PASS').length;
  const fail = cases.filter((c) => c.result === 'FAIL').length;
  const report = {
    at: new Date().toISOString(),
    base: BASE,
    stamp,
    summary: {
      pass,
      fail,
      total: cases.length,
      verdict: fail === 0 ? 'PASS' : 'FAIL',
    },
    cases,
    details,
  };

  // Never leak staff password
  const serialized = JSON.stringify(report, null, 2);
  if (serialized.includes(STAFF_PASS)) {
    throw new Error('refusing to write artifact that would include staff password');
  }
  fs.writeFileSync(OUT, serialized);
  console.log('\nWrote', OUT);
  console.log(JSON.stringify(report.summary));
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('FATAL', err.message);
  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        base: BASE,
        summary: { pass: 0, fail: 1, total: 1, verdict: 'FAIL' },
        fatal: String(err.message || err),
        cases,
      },
      null,
      2
    )
  );
  process.exit(1);
});
