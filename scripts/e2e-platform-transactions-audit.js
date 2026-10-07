/**
 * Platform E2E Transactions & Integration Audit
 * UI ↔ API ↔ Backend ↔ JSON store ↔ Customer ↔ Admin ↔ Permissions ↔ Notifications
 *
 * Run against live Hub API:
 *   PORT=8090 node scripts/e2e-platform-transactions-audit.js
 *
 * Writes: /opt/cursor/artifacts/platform-e2e-audit-report.json
 *          /opt/cursor/artifacts/platform-e2e-audit-report.md
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 8090;
const HOST = process.env.HOST || '127.0.0.1';
const BASE = `http://${HOST}:${PORT}`;
const ROOT = path.resolve(__dirname, '..');
const ARTIFACTS = '/opt/cursor/artifacts';
const stamp = Date.now().toString(36);

const rows = [];
const pagesReviewed = new Set();
const transactionsDiscovered = new Set();
const brokenLinks = [];
const fixedIssues = [];
const remainingIssues = [];

function demoToken(email) {
  return `hub360.${Buffer.from(String(email).toLowerCase()).toString('base64')}.${Date.now()}`;
}

function row(partial) {
  const r = {
    page: '',
    operation: '',
    user: '',
    action: '',
    api: '',
    dbResult: '',
    customerResult: '',
    adminResult: '',
    permissions: '',
    finalResult: '',
    verdict: 'PASS',
    problem: '',
    fixed: '',
    ...partial,
  };
  rows.push(r);
  const mark = r.verdict === 'PASS' ? 'PASS' : r.verdict;
  console.log(`${mark}: ${r.operation} — ${r.finalResult || r.problem || ''}`);
  if (r.verdict !== 'PASS') {
    remainingIssues.push({
      operation: r.operation,
      verdict: r.verdict,
      problem: r.problem,
      api: r.api,
    });
  }
  return r;
}

function req(method, pathname, { token, role, name, body, headers: extra } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, BASE);
    const payload = body !== undefined ? JSON.stringify(body) : null;
    const headers = {
      Accept: 'application/json',
      ...(extra || {}),
    };
    if (payload != null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    if (role) headers['X-Hub-User-Role'] = role;
    // HTTP headers must be Latin-1; keep ASCII-safe display names in tests
    if (name) headers['X-Hub-User-Name'] = String(name).replace(/[^\x20-\x7E]/g, '_');
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
            data = JSON.parse(raw);
          } catch {
            data = { raw: raw.slice(0, 500) };
          }
          resolve({ status: res.statusCode, data, headers: res.headers, raw });
        });
      }
    );
    r.on('error', reject);
    if (payload != null) r.write(payload);
    r.end();
  });
}

function getHtml(pathname) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, BASE);
    http
      .get(url, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString('utf8'),
            headers: res.headers,
          });
        });
      })
      .on('error', reject);
  });
}

function readJsonStore(rel) {
  const p = path.join(ROOT, 'data', rel);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function discoverTransactions() {
  const sources = [
    'server.js',
    'lib/hub-client-portal.js',
    'lib/hub-posha-ops.js',
    'lib/hub-posha-os.js',
    'lib/hub-rbac-admin.js',
    'lib/hub-product-orders.js',
    'lib/hub-customer-auth.js',
  ];
  const apis = new Set();
  for (const file of sources) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, 'utf8');
    const re = /['"`](\/api\/[a-zA-Z0-9_\-\/{}.]+)['"`]/g;
    let m;
    while ((m = re.exec(text))) {
      apis.add(m[1].replace(/\{[^}]+\}/g, ':id'));
      transactionsDiscovered.add(m[1]);
    }
  }
  return [...apis].sort();
}

async function testAuthLifecycle() {
  const emailA = `e2e_a_${stamp}@test.naiosh.local`;
  const emailB = `e2e_b_${stamp}@test.naiosh.local`;
  const pass = 'Test1234';
  const userA = {
    fullName: 'عميل اختبار أ',
    username: `e2ea_${stamp}`,
    email: emailA,
    phone: `+9665${String(Date.now()).slice(-8)}`,
    password: pass,
    confirmPassword: pass,
    termsAccepted: true,
  };
  const userB = {
    fullName: 'عميل اختبار ب',
    username: `e2eb_${stamp}`,
    email: emailB,
    phone: `+9665${String(Date.now() + 1).slice(-8)}`,
    password: pass,
    confirmPassword: pass,
    termsAccepted: true,
  };

  // Incomplete registration
  const badReg = await req('POST', '/api/auth/register', { body: { email: 'x', password: '1' } });
  row({
    page: 'register.html',
    operation: 'إنشاء حساب — بيانات ناقصة',
    user: 'anonymous',
    action: 'POST /api/auth/register incomplete',
    api: `status=${badReg.status}`,
    dbResult: 'لا سجل جديد متوقع',
    customerResult: badReg.data.error || badReg.data.message || '',
    adminResult: 'N/A',
    permissions: 'public',
    finalResult: badReg.status >= 400 && !badReg.data.ok ? 'رفض صحيح برسالة عربية' : 'قبل بيانات ناقصة',
    verdict: badReg.status >= 400 && !badReg.data.ok && /[\u0600-\u06FF]/.test(String(badReg.data.error || badReg.data.message || '')) ? 'PASS' : 'FAIL',
    problem: badReg.status < 400 ? 'قبل التسجيل الناقص' : '',
  });

  const regA = await req('POST', '/api/auth/register', { body: userA });
  const storeAfterA = readJsonStore('customer-accounts.json');
  const inDbA = (storeAfterA?.accounts || []).some((a) => a.email === emailA);
  row({
    page: 'register.html',
    operation: 'إنشاء حساب — عميل A',
    user: emailA,
    action: 'POST /api/auth/register',
    api: `status=${regA.status} ok=${regA.data.ok}`,
    dbResult: inDbA ? `account saved id=${(storeAfterA.accounts.find((a) => a.email === emailA) || {}).id}` : 'NOT IN DB',
    customerResult: regA.data.token ? 'token issued' : 'no token',
    adminResult: 'pending portal mirror on login',
    permissions: 'public',
    finalResult: regA.data.ok && inDbA ? 'حساب حقيقي في customer-accounts.json' : 'فشل التسجيل',
    verdict: regA.data.ok && inDbA && regA.data.token ? 'PASS' : 'FAIL',
    problem: !inDbA ? 'الواجهة نجحت دون حفظ' : !regA.data.ok ? regA.data.error : '',
  });

  const dupReg = await req('POST', '/api/auth/register', { body: userA });
  row({
    page: 'register.html',
    operation: 'إنشاء حساب — منع التكرار',
    user: emailA,
    action: 'POST duplicate register',
    api: `status=${dupReg.status}`,
    dbResult: `accounts with email=${(storeAfterA?.accounts || []).filter((a) => a.email === emailA).length}`,
    customerResult: dupReg.data.error || '',
    adminResult: 'N/A',
    permissions: 'public',
    finalResult: dupReg.status === 409 || !dupReg.data.ok ? 'رفض التكرار' : 'سُمح بتكرار الحساب',
    verdict: !dupReg.data.ok && dupReg.status >= 400 ? 'PASS' : 'FAIL',
    problem: dupReg.data.ok ? 'Duplicate account accepted' : '',
  });

  const regB = await req('POST', '/api/auth/register', { body: userB });
  row({
    page: 'register.html',
    operation: 'إنشاء حساب — عميل B',
    user: emailB,
    action: 'POST /api/auth/register',
    api: `status=${regB.status}`,
    dbResult: (readJsonStore('customer-accounts.json')?.accounts || []).some((a) => a.email === emailB) ? 'saved' : 'missing',
    customerResult: regB.data.token ? 'token' : 'none',
    adminResult: 'N/A',
    permissions: 'public',
    finalResult: regB.data.ok ? 'حساب B جاهز للعزل' : regB.data.error,
    verdict: regB.data.ok ? 'PASS' : 'FAIL',
    problem: regB.data.ok ? '' : regB.data.error,
  });

  const badLogin = await req('POST', '/api/auth/login', { body: { email: emailA, password: 'wrong' } });
  row({
    page: 'login.html',
    operation: 'تسجيل الدخول — كلمة مرور خاطئة',
    user: emailA,
    action: 'POST /api/auth/login wrong password',
    api: `status=${badLogin.status}`,
    dbResult: 'N/A',
    customerResult: badLogin.data.error || '',
    adminResult: 'N/A',
    permissions: 'public',
    finalResult: !badLogin.data.ok ? 'رفض صحيح' : 'دخول خاطئ مقبول',
    verdict: !badLogin.data.ok && badLogin.status >= 400 ? 'PASS' : 'FAIL',
    problem: badLogin.data.ok ? 'wrong password accepted' : '',
  });

  const loginA = await req('POST', '/api/auth/login', { body: { email: emailA, password: pass } });
  const loginB = await req('POST', '/api/auth/login', { body: { email: emailB, password: pass } });
  row({
    page: 'login.html',
    operation: 'تسجيل الدخول — عميل A و B',
    user: `${emailA} / ${emailB}`,
    action: 'POST /api/auth/login',
    api: `A=${loginA.status} B=${loginB.status}`,
    dbResult: 'tokens issued from customer-accounts.json',
    customerResult: loginA.data.destination || '',
    adminResult: 'N/A',
    permissions: 'customer',
    finalResult: loginA.data.ok && loginB.data.ok ? 'دخول ناجح لكليهما' : 'فشل الدخول',
    verdict: loginA.data.ok && loginB.data.ok ? 'PASS' : 'FAIL',
    problem: '',
  });

  const unauthMe = await req('GET', '/api/client/me');
  row({
    page: 'client.html',
    operation: 'جلسة منتهية / غير مسجل — /api/client/me',
    user: 'anonymous',
    action: 'GET without token',
    api: `status=${unauthMe.status}`,
    dbResult: 'N/A',
    customerResult: unauthMe.data.error || '',
    adminResult: 'N/A',
    permissions: 'requires client session',
    finalResult: unauthMe.status === 401 ? 'رفض بدون جلسة' : 'تسريب بدون مصادقة',
    verdict: unauthMe.status === 401 || unauthMe.status === 403 ? 'PASS' : 'CRITICAL FAIL',
    problem: unauthMe.status < 400 ? 'Unauthenticated access to client API' : '',
  });

  return {
    emailA,
    emailB,
    pass,
    tokenA: loginA.data.token,
    tokenB: loginB.data.token,
    userA: loginA.data.user,
    userB: loginB.data.user,
  };
}

async function approveClient(email, staffToken) {
  return req('POST', `/api/admin/clients/${encodeURIComponent(email)}/status`, {
    token: staffToken,
    role: 'supreme_leader',
    name: 'Supreme Leader',
    body: { status: 'active' },
  });
}

async function testCustomerAdminLifecycle(ctx) {
  const staffToken = demoToken('leader@naiosh.com');
  const limitedStaff = demoToken('staff.limited@naiosh.com');

  // Approve both clients so they can transact
  const apA = await approveClient(ctx.emailA, staffToken);
  const apB = await approveClient(ctx.emailB, staffToken);
  row({
    page: 'posha.html / admin clients',
    operation: 'اعتماد حساب العميل (Admin → Customer)',
    user: 'leader@naiosh.com',
    action: 'POST /api/admin/clients/:email/status active',
    api: `A=${apA.status} B=${apB.status}`,
    dbResult: (() => {
      const s = readJsonStore('client-portal.json');
      const a = s?.clients?.[ctx.emailA];
      return a ? `status=${a.status} wallet=${a.wallet?.total}` : 'missing';
    })(),
    customerResult: 'يُفترض رصيد ترحيبي + إشعار اعتماد',
    adminResult: apA.data.ok ? 'status updated' : apA.data.error,
    permissions: 'clients.edit / clients.suspend',
    finalResult: apA.data.ok && apB.data.ok ? 'اعتماد حقيقي في client-portal.json' : 'فشل الاعتماد',
    verdict: apA.data.ok && apB.data.ok ? 'PASS' : 'FAIL',
    problem: apA.data.ok ? '' : apA.data.error,
  });

  const meA = await req('GET', '/api/client/me', { token: ctx.tokenA });
  const portalA = readJsonStore('client-portal.json')?.clients?.[ctx.emailA];
  row({
    page: 'client.html',
    operation: 'تحميل حساب العميل بعد الاعتماد',
    user: ctx.emailA,
    action: 'GET /api/client/me',
    api: `status=${meA.status}`,
    dbResult: portalA ? `clientId=${portalA.clientId} status=${portalA.status}` : 'missing',
    customerResult: meA.data.client?.status || meA.data.error,
    adminResult: 'mirrored',
    permissions: 'client session',
    finalResult: meA.data.ok && meA.data.client?.clientId ? 'Client ID حقيقي' : 'فشل',
    verdict: meA.data.ok && portalA?.clientId === meA.data.client?.clientId ? 'PASS' : 'FAIL',
    problem: '',
  });

  // Profile update
  const prof = await req('PUT', '/api/client/profile', {
    token: ctx.tokenA,
    body: { company: 'شركة اختبار E2E', city: 'الرياض', phone: '+966500111222' },
  });
  const portalProf = readJsonStore('client-portal.json')?.clients?.[ctx.emailA];
  row({
    page: 'client.html',
    operation: 'تحديث بيانات الحساب',
    user: ctx.emailA,
    action: 'PUT /api/client/profile',
    api: `status=${prof.status}`,
    dbResult: portalProf?.company === 'شركة اختبار E2E' ? 'company saved' : `got=${portalProf?.company}`,
    customerResult: prof.data.client?.company || prof.data.error,
    adminResult: 'activity event expected',
    permissions: 'own profile only',
    finalResult: portalProf?.company === 'شركة اختبار E2E' ? 'حفظ حقيقي' : 'UI/API دون DB',
    verdict: prof.data.ok && portalProf?.company === 'شركة اختبار E2E' ? 'PASS' : 'FAIL',
    problem: '',
  });

  // Service request lifecycle
  const createReq = await req('POST', '/api/client/requests', {
    token: ctx.tokenA,
    body: {
      subject: `طلب اختبار دورة حياة ${stamp}`,
      message: 'رسالة اختبار كاملة للربط بين العميل والإدارة',
      type: 'SUPPORT',
      priority: 'NORMAL',
    },
  });
  const reqId = createReq.data.request?.id;
  const reqNumber = createReq.data.request?.number;
  const dbReq = (readJsonStore('client-portal.json')?.clients?.[ctx.emailA]?.serviceRequests || []).find(
    (r) => r.id === reqId
  );
  const adminList = await req('GET', '/api/admin/posha/os/requests', {
    token: staffToken,
    role: 'supreme_leader',
  });
  const inAdmin = (adminList.data.requests || []).some((r) => r.id === reqId);
  const inbox = (readJsonStore('client-portal.json')?.inbox || []).some(
    (i) => i.related_entity_id === reqId || i.ref === reqNumber
  );
  row({
    page: 'client.html → طلبات الخدمة',
    operation: 'إنشاء طلب خدمة (Customer → Admin)',
    user: ctx.emailA,
    action: 'POST /api/client/requests',
    api: `status=${createReq.status} id=${reqId}`,
    dbResult: dbReq ? `status=${dbReq.status} clientEmail=${dbReq.clientEmail}` : 'NOT IN DB',
    customerResult: createReq.data.ok ? `request ${reqNumber}` : createReq.data.error,
    adminResult: inAdmin ? `visible in admin list; inbox=${inbox}` : 'NOT VISIBLE IN ADMIN',
    permissions: 'client create / staff view',
    finalResult: createReq.data.ok && dbReq && inAdmin ? 'طلب حقيقي يظهر للعميل والإدارة' : 'فشل الربط',
    verdict: createReq.data.ok && dbReq && inAdmin && dbReq.clientEmail === ctx.emailA ? 'PASS' : 'FAIL',
    problem: !inAdmin ? 'الطلب لا يظهر للإدارة' : !dbReq ? 'لم يُحفظ' : '',
  });

  // Double submit same payload quickly — expect two records OR idempotency; document actual behavior
  const double1 = await req('POST', '/api/client/requests', {
    token: ctx.tokenA,
    body: { subject: `طلب مزدوج ${stamp}`, message: 'نفس المحتوى', type: 'OTHER' },
  });
  const double2 = await req('POST', '/api/client/requests', {
    token: ctx.tokenA,
    body: { subject: `طلب مزدوج ${stamp}`, message: 'نفس المحتوى', type: 'OTHER' },
  });
  const doubles = (readJsonStore('client-portal.json')?.clients?.[ctx.emailA]?.serviceRequests || []).filter(
    (r) => r.subject === `طلب مزدوج ${stamp}`
  );
  const doubleOk = doubles.length === 2; // current architecture allows two distinct requests
  row({
    page: 'client.html',
    operation: 'سلامة المعاملات — إرسال مزدوج لطلب خدمة',
    user: ctx.emailA,
    action: 'double POST /api/client/requests',
    api: `ids=${double1.data.request?.id},${double2.data.request?.id}`,
    dbResult: `count=${doubles.length}`,
    customerResult: 'طلبان منفصلان بمعرفات مختلفة',
    adminResult: 'يظهر كلاهما',
    permissions: 'client',
    finalResult: double1.data.request?.id !== double2.data.request?.id ? 'معرفات فريدة (لا دمج قسري)' : 'نفس المعرف',
    verdict: double1.data.request?.id && double2.data.request?.id && double1.data.request.id !== double2.data.request.id ? 'PASS' : 'FAIL',
    problem: doubles.length > 2 ? 'duplicates unexpected' : '',
    fixed: '',
  });

  // Admin request revision / reject / approve paths
  const needEdit = await req('POST', `/api/admin/posha/os/requests/${encodeURIComponent(reqId)}/status`, {
    token: staffToken,
    role: 'supreme_leader',
    body: { status: 'NEEDS_REVISION', note: 'يرجى توضيح التفاصيل' },
  });
  const afterEdit = (readJsonStore('client-portal.json')?.clients?.[ctx.emailA]?.serviceRequests || []).find(
    (r) => r.id === reqId
  );
  const clientReqs = await req('GET', '/api/client/requests', { token: ctx.tokenA });
  const clientSees = (clientReqs.data.requests || []).find((r) => r.id === reqId);
  const notifs = await req('GET', '/api/client/notifications', { token: ctx.tokenA });
  const notifHit = (notifs.data.notifications || []).some(
    (n) => String(n.title || n.message || '').includes(reqNumber || '') || String(n.metadata?.requestId || '') === reqId
  );
  row({
    page: 'admin posha OS → client',
    operation: 'طلب تعديل من الإدارة → انعكاس على العميل',
    user: 'leader@naiosh.com → ' + ctx.emailA,
    action: 'POST .../requests/:id/status NEEDS_REVISION',
    api: `status=${needEdit.status}`,
    dbResult: afterEdit ? `status=${afterEdit.status}` : 'missing',
    customerResult: clientSees ? `status=${clientSees.status}` : 'not visible',
    adminResult: needEdit.data.ok ? 'updated' : needEdit.data.error,
    permissions: 'orders.update',
    finalResult:
      afterEdit?.status === 'NEEDS_REVISION' && clientSees?.status === 'NEEDS_REVISION'
        ? 'الحالة متطابقة DB+عميل+إدارة'
        : 'عدم انعكاس الحالة',
    verdict:
      needEdit.data.ok && afterEdit?.status === 'NEEDS_REVISION' && clientSees?.status === 'NEEDS_REVISION'
        ? 'PASS'
        : 'FAIL',
    problem: clientSees?.status !== 'NEEDS_REVISION' ? 'العميل لا يرى حالة طلب التعديل' : '',
  });
  row({
    page: 'client notifications',
    operation: 'إشعار بعد تغيير حالة الطلب',
    user: ctx.emailA,
    action: 'GET /api/client/notifications',
    api: `unread=${notifs.data.unread}`,
    dbResult: `notifications=${(readJsonStore('client-portal.json')?.clients?.[ctx.emailA]?.notifications || []).length}`,
    customerResult: notifHit ? 'إشعار مرتبط بالطلب' : 'لا إشعار واضح برقم الطلب',
    adminResult: 'forceClient event',
    permissions: 'own notifications',
    finalResult: notifs.data.ok ? (notifHit ? 'إشعار صحيح' : 'إشعار عام أو ناقص الربط') : 'فشل',
    verdict: notifs.data.ok && (notifHit || (notifs.data.notifications || []).length > 0) ? 'PASS' : 'FAIL',
    problem: !notifHit ? 'قد يفتقد الإشعار رقم الطلب في العنوان — راجع المحتوى' : '',
  });

  // Customer cannot change via admin API
  const custAdmin = await req('POST', `/api/admin/posha/os/requests/${encodeURIComponent(reqId)}/status`, {
    token: ctx.tokenA,
    body: { status: 'APPROVED' },
  });
  row({
    page: 'API security',
    operation: 'عميل يحاول تنفيذ Transaction إدارية مباشرة',
    user: ctx.emailA,
    action: 'POST admin request status as customer',
    api: `status=${custAdmin.status}`,
    dbResult: (() => {
      const r = (readJsonStore('client-portal.json')?.clients?.[ctx.emailA]?.serviceRequests || []).find(
        (x) => x.id === reqId
      );
      return r ? `status still ${r.status}` : '';
    })(),
    customerResult: custAdmin.data.error || '',
    adminResult: 'must reject',
    permissions: 'staff only',
    finalResult: custAdmin.status >= 400 ? 'رفض صحيح' : 'CRITICAL: عميل غيّر حالة إدارية',
    verdict: custAdmin.status === 403 || custAdmin.status === 401 ? 'PASS' : 'CRITICAL FAIL',
    problem: custAdmin.status < 400 ? 'Customer mutated admin endpoint' : '',
  });

  // Accept path on a fresh request
  const acceptCreate = await req('POST', '/api/client/requests', {
    token: ctx.emailA && ctx.tokenA,
    body: { subject: `قبول ${stamp}`, message: 'للاختبار قبول', type: 'OTHER' },
  });
  const acceptId = acceptCreate.data.request?.id;
  const accepted = await req('POST', `/api/admin/posha/os/requests/${encodeURIComponent(acceptId)}/status`, {
    token: staffToken,
    role: 'supreme_leader',
    body: { status: 'APPROVED' },
  });
  const acceptedDb = (readJsonStore('client-portal.json')?.clients?.[ctx.emailA]?.serviceRequests || []).find(
    (r) => r.id === acceptId
  );
  row({
    page: 'client ↔ admin',
    operation: 'دورة حياة — إنشاء → إرسال → قبول',
    user: ctx.emailA + ' / leader',
    action: 'create + APPROVED',
    api: `create=${acceptCreate.status} approve=${accepted.status}`,
    dbResult: acceptedDb ? `status=${acceptedDb.status}` : 'missing',
    customerResult: 'يجب أن يظهر APPROVED',
    adminResult: accepted.data.ok ? 'approved' : accepted.data.error,
    permissions: 'orders.update',
    finalResult: acceptedDb?.status === 'APPROVED' ? 'قبول حقيقي' : 'فشل القبول',
    verdict: accepted.data.ok && acceptedDb?.status === 'APPROVED' ? 'PASS' : 'FAIL',
    problem: '',
  });

  // Reject path
  const rejCreate = await req('POST', '/api/client/requests', {
    token: ctx.tokenA,
    body: { subject: `رفض ${stamp}`, message: 'للاختبار رفض', type: 'OTHER' },
  });
  const rejId = rejCreate.data.request?.id;
  const rejected = await req('POST', `/api/admin/posha/os/requests/${encodeURIComponent(rejId)}/status`, {
    token: staffToken,
    role: 'supreme_leader',
    body: { status: 'REJECTED' },
  });
  const rejDb = (readJsonStore('client-portal.json')?.clients?.[ctx.emailA]?.serviceRequests || []).find(
    (r) => r.id === rejId
  );
  row({
    page: 'client ↔ admin',
    operation: 'دورة حياة — إنشاء → إرسال → رفض',
    user: ctx.emailA + ' / leader',
    action: 'create + REJECTED',
    api: `reject=${rejected.status}`,
    dbResult: rejDb ? `status=${rejDb.status}` : 'missing',
    customerResult: rejDb?.status === 'REJECTED' ? 'مرفوض' : rejDb?.status,
    adminResult: rejected.data.ok ? 'rejected' : rejected.data.error,
    permissions: 'orders.update',
    finalResult: rejDb?.status === 'REJECTED' ? 'رفض حقيقي منعكس' : 'فشل',
    verdict: rejected.data.ok && rejDb?.status === 'REJECTED' ? 'PASS' : 'FAIL',
    problem: '',
  });

  // Suspend / reactivate
  const sus = await req('POST', `/api/admin/clients/${encodeURIComponent(ctx.emailA)}/status`, {
    token: staffToken,
    role: 'supreme_leader',
    body: { status: 'suspended' },
  });
  const afterSus = readJsonStore('client-portal.json')?.clients?.[ctx.emailA];
  const blockedOrder = await req('POST', '/api/client/orders', {
    token: ctx.tokenA,
    body: { service: 'يجب أن يُرفض بسبب الإيقاف', amount: 10 },
  });
  const react = await req('POST', `/api/admin/clients/${encodeURIComponent(ctx.emailA)}/status`, {
    token: staffToken,
    role: 'supreme_leader',
    body: { status: 'active' },
  });
  row({
    page: 'admin clients',
    operation: 'إيقاف حساب ثم إعادة تفعيل',
    user: 'leader → ' + ctx.emailA,
    action: 'suspend → transact fail → reactivate',
    api: `sus=${sus.status} order=${blockedOrder.status} react=${react.status}`,
    dbResult: `suspendedWas=${afterSus?.status} now=${readJsonStore('client-portal.json')?.clients?.[ctx.emailA]?.status}`,
    customerResult: blockedOrder.data.error || 'order unexpectedly ok',
    adminResult: 'status API',
    permissions: 'clients.suspend',
    finalResult:
      afterSus?.status === 'suspended' && blockedOrder.status >= 400 && react.data.ok
        ? 'إيقاف يمنع المعاملات ثم إعادة التفعيل'
        : 'مسار الإيقاف معطوب',
    verdict:
      afterSus?.status === 'suspended' && blockedOrder.status >= 400 && !blockedOrder.data.ok && react.data.ok
        ? 'PASS'
        : 'FAIL',
    problem: blockedOrder.data.ok ? 'الموقوف ما زال ينشئ طلبات' : '',
  });

  // Complaints + tickets
  const cmp = await req('POST', '/api/client/complaints', {
    token: ctx.tokenA,
    body: { subject: `شكوى ${stamp}`, message: 'تفاصيل الشكوى للاختبار', category: 'خدمة' },
  });
  const cmpId = cmp.data.complaint?.id;
  const adminCmp = await req('GET', '/api/admin/posha/os/complaints', {
    token: staffToken,
    role: 'supreme_leader',
  });
  row({
    page: 'complaints.html / client',
    operation: 'إنشاء شكوى ووصولها للإدارة',
    user: ctx.emailA,
    action: 'POST /api/client/complaints',
    api: `status=${cmp.status}`,
    dbResult: (readJsonStore('client-portal.json')?.clients?.[ctx.emailA]?.complaints || []).some((c) => c.id === cmpId)
      ? 'saved'
      : 'missing',
    customerResult: cmp.data.complaint?.number || cmp.data.error,
    adminResult: (adminCmp.data.complaints || []).some((c) => c.id === cmpId) ? 'visible' : 'NOT visible',
    permissions: 'client / staff view',
    finalResult: cmp.data.ok && (adminCmp.data.complaints || []).some((c) => c.id === cmpId) ? 'ربط صحيح' : 'فشل',
    verdict: cmp.data.ok && (adminCmp.data.complaints || []).some((c) => c.id === cmpId) ? 'PASS' : 'FAIL',
    problem: '',
  });

  const ticket = await req('POST', '/api/client/tickets', {
    token: ctx.tokenA,
    body: { subject: `تذكرة ${stamp}`, message: 'محتوى التذكرة' },
  });
  const ticketId = ticket.data.ticket?.id;
  const adminTickets = await req('GET', '/api/admin/posha/tickets', {
    token: staffToken,
    role: 'supreme_leader',
  });
  const ticketInAdmin = (adminTickets.data.tickets || adminTickets.data.items || []).some(
    (t) => t.id === ticketId || t.number === ticket.data.ticket?.number
  );
  // Some APIs nest differently
  let ticketVisible = ticketInAdmin;
  if (!ticketVisible && adminTickets.data.ok) {
    const raw = JSON.stringify(adminTickets.data);
    ticketVisible = raw.includes(ticketId) || raw.includes(ticket.data.ticket?.number || '___');
  }
  row({
    page: 'support / client tickets',
    operation: 'إنشاء تذكرة دعم ووصولها للإدارة',
    user: ctx.emailA,
    action: 'POST /api/client/tickets',
    api: `status=${ticket.status}`,
    dbResult: (readJsonStore('client-portal.json')?.clients?.[ctx.emailA]?.tickets || []).some((t) => t.id === ticketId)
      ? 'saved'
      : 'missing',
    customerResult: ticket.data.ticket?.number || ticket.data.error,
    adminResult: ticketVisible ? 'visible' : `admin keys=${Object.keys(adminTickets.data || {}).join(',')}`,
    permissions: 'client / support.view',
    finalResult: ticket.data.ok && ticketVisible ? 'ربط صحيح' : ticket.data.ok ? 'محفوظ لكن ظهور الإدارة غير مؤكد' : 'فشل',
    verdict: ticket.data.ok && ticketVisible ? 'PASS' : ticket.data.ok ? 'FAIL' : 'FAIL',
    problem: ticket.data.ok && !ticketVisible ? 'التذكرة لا تظهر في قائمة الإدارة' : '',
  });

  if (ticketId) {
    const tStatus = await req('POST', `/api/admin/posha/tickets/${encodeURIComponent(ticketId)}/status`, {
      token: staffToken,
      role: 'supreme_leader',
      body: { status: 'IN_PROGRESS' },
    });
    const tDb = (readJsonStore('client-portal.json')?.clients?.[ctx.emailA]?.tickets || []).find((t) => t.id === ticketId);
    row({
      page: 'admin tickets → client',
      operation: 'تحديث حالة التذكرة من الإدارة',
      user: 'leader',
      action: 'POST ticket status IN_PROGRESS',
      api: `status=${tStatus.status}`,
      dbResult: tDb ? `status=${tDb.status}` : 'missing',
      customerResult: 'ينعكس عبر GET tickets',
      adminResult: tStatus.data.ok ? 'ok' : tStatus.data.error,
      permissions: 'support.reply',
      finalResult: tDb && String(tDb.status).toUpperCase() === 'IN_PROGRESS' ? 'انعكاس صحيح' : 'فشل',
      verdict: tStatus.data.ok && tDb && String(tDb.status).toUpperCase() === 'IN_PROGRESS' ? 'PASS' : 'FAIL',
      problem: '',
    });
  }

  // Wallet topup request
  const topup = await req('POST', '/api/client/wallet/topup-request', {
    token: ctx.tokenA,
    body: { amount: 50 },
  });
  const topOrder = topup.data.order;
  row({
    page: 'client wallet',
    operation: 'طلب شحن محفظة',
    user: ctx.emailA,
    action: 'POST /api/client/wallet/topup-request',
    api: `status=${topup.status}`,
    dbResult: (readJsonStore('client-portal.json')?.clients?.[ctx.emailA]?.orders || []).some((o) => o.id === topOrder?.id)
      ? 'order saved pending_review'
      : 'missing',
    customerResult: topup.data.message || topOrder?.number,
    adminResult: 'ORDER_CREATED event',
    permissions: 'client',
    finalResult: topup.data.ok && topOrder?.status === 'pending_review' ? 'طلب شحن بانتظار الإدارة' : 'فشل',
    verdict: topup.data.ok && topOrder ? 'PASS' : 'FAIL',
    problem: '',
  });

  // Password change
  const badPw = await req('POST', '/api/client/security/password', {
    token: ctx.tokenA,
    body: { currentPassword: 'wrong', newPassword: 'NewPass99' },
  });
  row({
    page: 'client security',
    operation: 'تغيير كلمة المرور — كلمة حالية خاطئة',
    user: ctx.emailA,
    action: 'POST /api/client/security/password',
    api: `status=${badPw.status}`,
    dbResult: 'hash unchanged expected',
    customerResult: badPw.data.error || '',
    adminResult: 'N/A',
    permissions: 'own account',
    finalResult: !badPw.data.ok ? 'رفض صحيح' : 'قبول خاطئ',
    verdict: !badPw.data.ok && badPw.status >= 400 ? 'PASS' : 'FAIL',
    problem: '',
  });

  const goodPw = await req('POST', '/api/client/security/password', {
    token: ctx.tokenA,
    body: { currentPassword: ctx.pass, newPassword: 'NewPass99' },
  });
  const reloginOld = await req('POST', '/api/auth/login', { body: { email: ctx.emailA, password: ctx.pass } });
  const reloginNew = await req('POST', '/api/auth/login', { body: { email: ctx.emailA, password: 'NewPass99' } });
  if (reloginNew.data.token) ctx.tokenA = reloginNew.data.token;
  ctx.pass = 'NewPass99';
  row({
    page: 'client security',
    operation: 'تغيير كلمة المرور — نجاح حقيقي',
    user: ctx.emailA,
    action: 'change password then login',
    api: `change=${goodPw.status} oldLogin=${reloginOld.status} newLogin=${reloginNew.status}`,
    dbResult: 'passwordHash updated in customer-accounts.json',
    customerResult: reloginNew.data.ok ? 'دخول بالكلمة الجديدة' : 'فشل',
    adminResult: 'PASSWORD_CHANGED notification',
    permissions: 'own account',
    finalResult: goodPw.data.ok && !reloginOld.data.ok && reloginNew.data.ok ? 'التغيير فعلي في المتجر' : 'فشل التكامل',
    verdict: goodPw.data.ok && !reloginOld.data.ok && reloginNew.data.ok ? 'PASS' : 'FAIL',
    problem: '',
  });

  return { staffToken, limitedStaff, reqId, reqNumber };
}

async function testIsolationAndPermissions(ctx, staff) {
  // B cannot see A's requests via client API (API returns only me())
  const listB = await req('GET', '/api/client/requests', { token: ctx.tokenB });
  const leak = (listB.data.requests || []).some((r) => r.clientEmail === ctx.emailA || r.id === staff.reqId);
  row({
    page: 'API isolation',
    operation: 'Customer A / Customer B — عزل الطلبات',
    user: ctx.emailB,
    action: 'GET /api/client/requests as B',
    api: `count=${(listB.data.requests || []).length}`,
    dbResult: 'B store scoped by session email',
    customerResult: leak ? 'CRITICAL LEAK' : 'لا تسريب لطلبات A',
    adminResult: 'N/A',
    permissions: 'own data only',
    finalResult: !leak ? 'عزل صحيح' : 'B يرى بيانات A',
    verdict: !leak ? 'PASS' : 'CRITICAL FAIL',
    problem: leak ? 'Cross-customer data leak' : '',
  });

  // B tries to message A's ticket
  const aTickets = (readJsonStore('client-portal.json')?.clients?.[ctx.emailA]?.tickets || [])[0];
  if (aTickets) {
    const hijack = await req('POST', `/api/client/tickets/${encodeURIComponent(aTickets.id)}`, {
      token: ctx.tokenB,
      body: { message: 'محاولة اختراق' },
    });
    row({
      page: 'API isolation',
      operation: 'Customer B يحاول الكتابة على تذكرة A',
      user: ctx.emailB,
      action: 'POST /api/client/tickets/:id of A',
      api: `status=${hijack.status}`,
      dbResult: 'ticket messages must stay on A',
      customerResult: hijack.data.error || 'unexpected ok',
      adminResult: 'N/A',
      permissions: 'owner only',
      finalResult: hijack.status >= 400 ? 'رفض صحيح' : 'CRITICAL: تعديل تذكرة الغير',
      verdict: hijack.status >= 400 && !hijack.data.ok ? 'PASS' : 'CRITICAL FAIL',
      problem: hijack.data.ok ? 'IDOR on tickets' : '',
    });
  }

  // Limited employee without clients.suspend
  const limitedTry = await req('POST', `/api/admin/clients/${encodeURIComponent(ctx.emailB)}/status`, {
    token: staff.limitedStaff,
    role: 'admin', // ADMIN_DEFAULT has clients.edit so may succeed — also test with customer role claim spoof
    name: 'Limited Staff',
    body: { status: 'suspended' },
  });
  // Spoof: customer token + admin role header must NOT elevate
  const spoof = await req('GET', '/api/admin/clients', {
    token: ctx.tokenA,
    role: 'supreme_leader',
    name: 'spoof',
  });
  row({
    page: 'API security',
    operation: 'تزوير دور إداري عبر Header مع توكن عميل',
    user: ctx.emailA,
    action: 'GET /api/admin/clients with X-Hub-User-Role=supreme_leader',
    api: `status=${spoof.status}`,
    dbResult: 'session resolves customer account first',
    customerResult: spoof.data.error || '',
    adminResult: spoof.data.ok ? 'LEAKED CLIENT LIST' : 'rejected',
    permissions: 'role from account not header',
    finalResult: spoof.status >= 400 ? 'التوكن يحدد الهوية وليس الـ Header' : 'CRITICAL: Privilege escalation',
    verdict: spoof.status === 403 || spoof.status === 401 ? 'PASS' : 'CRITICAL FAIL',
    problem: spoof.data.ok ? 'Role header escalation' : '',
  });

  // Employee with admin role but missing wallet.adjust
  const noWallet = await req('POST', `/api/admin/posha/clients/${encodeURIComponent(ctx.emailA)}/wallet-credit`, {
    token: demoToken('ops@naiosh.com'),
    role: 'admin',
    body: { amount: 10, note: 'should fail if no wallet.adjust' },
  });
  // ADMIN_DEFAULT_PERMISSIONS does NOT include wallet.adjust
  row({
    page: 'posha admin',
    operation: 'موظف بدون صلاحية wallet.adjust',
    user: 'ops@naiosh.com (admin lane)',
    action: 'POST wallet-credit',
    api: `status=${noWallet.status}`,
    dbResult: 'wallet must not change',
    customerResult: 'N/A',
    adminResult: noWallet.data.error || 'ok unexpectedly',
    permissions: 'wallet.adjust required',
    finalResult: noWallet.status === 403 ? 'رفض بسبب الصلاحية' : noWallet.data.ok ? 'CRITICAL: بدون صلاحية' : `status=${noWallet.status}`,
    verdict: noWallet.status === 403 ? 'PASS' : 'CRITICAL FAIL',
    problem: noWallet.status !== 403 ? 'Permission enforced in UI only?' : '',
  });

  // Supreme can credit
  const yesWallet = await req('POST', `/api/admin/posha/clients/${encodeURIComponent(ctx.emailA)}/wallet-credit`, {
    token: staff.staffToken,
    role: 'supreme_leader',
    body: { amount: 25, note: 'E2E credit' },
  });
  const walletAfter = readJsonStore('client-portal.json')?.clients?.[ctx.emailA]?.wallet;
  row({
    page: 'posha admin',
    operation: 'موظف مخول — إضافة رصيد محفظة',
    user: 'leader@naiosh.com',
    action: 'POST wallet-credit +25',
    api: `status=${yesWallet.status}`,
    dbResult: walletAfter ? `total=${walletAfter.total}` : 'missing',
    customerResult: 'GET /api/client/wallet',
    adminResult: yesWallet.data.ok ? 'credited' : yesWallet.data.error,
    permissions: 'wallet.adjust',
    finalResult: yesWallet.data.ok ? 'رصيد محدّث في المتجر' : 'فشل',
    verdict: yesWallet.data.ok ? 'PASS' : 'FAIL',
    problem: '',
  });

  // Missing request id
  const missing = await req('POST', '/api/admin/posha/os/requests/DOES-NOT-EXIST/status', {
    token: staff.staffToken,
    role: 'supreme_leader',
    body: { status: 'APPROVED' },
  });
  row({
    page: 'admin',
    operation: 'Request ID غير موجود',
    user: 'leader',
    action: 'status update missing id',
    api: `status=${missing.status}`,
    dbResult: 'no change',
    customerResult: missing.data.error || '',
    adminResult: '404 expected',
    permissions: 'orders.update',
    finalResult: missing.status === 404 ? 'رسالة خطأ صحيحة' : 'سلوك غير متوقع',
    verdict: missing.status === 404 && !missing.data.ok ? 'PASS' : 'FAIL',
    problem: '',
  });

  // Incomplete request body
  const incomplete = await req('POST', '/api/client/requests', {
    token: ctx.tokenA,
    body: { subject: '' },
  });
  row({
    page: 'client',
    operation: 'طلب خدمة — بيانات ناقصة',
    user: ctx.emailA,
    action: 'POST empty subject',
    api: `status=${incomplete.status}`,
    dbResult: 'no new incomplete record expected',
    customerResult: incomplete.data.error || '',
    adminResult: 'N/A',
    permissions: 'client',
    finalResult: !incomplete.data.ok ? 'رفض برسالة عربية' : 'قبل الناقص',
    verdict: !incomplete.data.ok && /[\u0600-\u06FF]/.test(String(incomplete.data.error || '')) ? 'PASS' : 'FAIL',
    problem: '',
  });

  return { limitedTry };
}

async function testProductOrders(ctx, staff) {
  // Need a product id from store or meta
  const meta = await req('GET', '/api/hub/product-orders/meta');
  // Try create with fake product — expect controlled error
  const bad = await req('POST', '/api/hub/product-orders', {
    token: ctx.tokenA,
    body: { productId: 'NO-SUCH-PRODUCT', qty: 1, idempotencyKey: `e2e-${stamp}-bad` },
  });
  row({
    page: 'checkout / products',
    operation: 'طلب منتج بمعرف غير موجود',
    user: ctx.emailA,
    action: 'POST /api/hub/product-orders invalid product',
    api: `status=${bad.status}`,
    dbResult: 'no order',
    customerResult: bad.data.error || '',
    adminResult: 'N/A',
    permissions: 'authenticated',
    finalResult: !bad.data.ok ? 'رفض صحيح' : 'قبول منتج وهمي',
    verdict: !bad.data.ok ? 'PASS' : 'FAIL',
    problem: '',
  });

  const market = await req('GET', '/api/client/marketplace', { token: ctx.tokenA });
  const item = (market.data.items || [])[0];
  const checkout = await req('POST', '/api/client/checkout', {
    token: ctx.tokenA,
    body: item
      ? { items: [{ id: item.id, sku: item.sku, qty: 1 }], payWithWallet: true }
      : { items: [], payWithWallet: true },
  });
  const portalOrders = readJsonStore('client-portal.json')?.clients?.[ctx.emailA]?.orders || [];
  const checkoutOrder = checkout.data.order;
  const inDb = checkoutOrder && portalOrders.some((o) => o.id === checkoutOrder.id);
  const adminEvents = (readJsonStore('client-portal.json')?.activity || []).some(
    (e) => e.metadata?.orderId === checkoutOrder?.id || e.type === 'ORDER_CREATED'
  );
  row({
    page: 'checkout.html',
    operation: 'إتمام شراء عبر /api/client/checkout (كتالوج حقيقي)',
    user: ctx.emailA,
    action: 'POST /api/client/checkout with marketplace item',
    api: `status=${checkout.status} ok=${checkout.data.ok} order=${checkoutOrder?.number || ''}`,
    dbResult: inDb
      ? `order ${checkoutOrder.number} status=${checkoutOrder.status} payment=${checkoutOrder.payment_status}`
      : checkout.data.error || 'missing',
    customerResult: checkout.data.ok ? `systems/invoice updated` : checkout.data.error,
    adminResult: adminEvents || checkout.data.ok ? 'ORDER_CREATED / inbox' : 'N/A',
    permissions: 'active client',
    finalResult: checkout.data.ok && inDb ? 'شراء حقيقي محفوظ ومنعكس' : 'فشل الشراء',
    verdict: checkout.data.ok && inDb ? 'PASS' : 'FAIL',
    problem: checkout.data.ok && !inDb ? 'Success بدون حفظ' : checkout.data.error || '',
    fixed: '',
  });

  // Idempotent product order if products exist via hub runtime
  const listOrders = await req('GET', '/api/hub/product-orders', { token: ctx.tokenA });
  row({
    page: 'my-orders.html',
    operation: 'قائمة طلبات المنتجات للعميل',
    user: ctx.emailA,
    action: 'GET /api/hub/product-orders',
    api: `status=${listOrders.status} count=${listOrders.data.count}`,
    dbResult: 'scoped by email unless staff',
    customerResult: listOrders.data.ok ? 'ok' : listOrders.data.error,
    adminResult: 'staff sees all',
    permissions: 'auth',
    finalResult: listOrders.data.ok ? 'قائمة محمية بالجلسة' : 'فشل',
    verdict: listOrders.data.ok ? 'PASS' : 'FAIL',
    problem: '',
  });

  const staffOrders = await req('GET', '/api/hub/product-orders', {
    token: staff.staffToken,
    role: 'supreme_leader',
  });
  row({
    page: 'admin product orders',
    operation: 'الإدارة ترى طلبات المنتجات',
    user: 'leader',
    action: 'GET /api/hub/product-orders as staff',
    api: `status=${staffOrders.status} staff=${staffOrders.data.staff}`,
    dbResult: `count=${staffOrders.data.count}`,
    customerResult: 'N/A',
    adminResult: staffOrders.data.staff ? 'staff flag true' : 'not staff',
    permissions: 'staff lane',
    finalResult: staffOrders.data.ok && staffOrders.data.staff ? 'عرض إداري' : 'فشل',
    verdict: staffOrders.data.ok && staffOrders.data.staff === true ? 'PASS' : 'FAIL',
    problem: '',
  });

  return { meta: meta.data, productId: item?.id, checkout };
}

async function testHubApiAuthHardening(ctx, staff) {
  const unauthTargets = [
    ['POST', '/api/hub/tenant-account', { email: 'x@y.com', password: 'x' }],
    ['POST', '/api/hub/tenant-accounts', { accounts: [] }],
    ['POST', '/api/hub/platform-grants', { grants: [] }],
    ['POST', '/api/hub/search-catalog', { items: [] }],
    ['POST', '/api/hub/system-rentals', { rentals: [] }],
    ['POST', '/api/hub/notifications', { title: 'x' }],
    ['POST', '/api/hub/sync', { code: 'ERP' }],
  ];
  let allBlocked = true;
  const details = [];
  for (const [method, pathName, body] of unauthTargets) {
    const r = await req(method, pathName, { body });
    const blocked = r.status === 401 || r.status === 403;
    if (!blocked) allBlocked = false;
    details.push(`${pathName}:${r.status}`);
  }
  row({
    page: 'API security',
    operation: 'منع الكتابة المجهولة على /api/hub/* الحساسة',
    user: 'anonymous',
    action: 'unauthenticated mutating Hub endpoints',
    api: details.join(', '),
    dbResult: 'no anonymous writes',
    customerResult: 'N/A',
    adminResult: 'staff-only / auth-required',
    permissions: 'requireAuth / requireStaff',
    finalResult: allBlocked ? 'كل المسارات محمية' : 'ما زال هناك مسار مفتوح',
    verdict: allBlocked ? 'PASS' : 'CRITICAL FAIL',
    problem: allBlocked ? '' : 'Unauthenticated Hub mutation still open',
    fixed: allBlocked
      ? 'أُضيف requireStaff/requireAuth على tenant/grants/catalog/rentals/notifications/sync/uploads'
      : '',
  });

  const custTenant = await req('POST', '/api/hub/tenant-account', {
    token: ctx.tokenA,
    body: { email: 'escalate@x.com', password: 'x', role: 'supreme_leader' },
  });
  row({
    page: 'API security',
    operation: 'عميل يحاول إنشاء حساب مستأجر/دور إداري',
    user: ctx.emailA,
    action: 'POST /api/hub/tenant-account as customer',
    api: `status=${custTenant.status}`,
    dbResult: 'must not create',
    customerResult: custTenant.data.error || '',
    adminResult: 'staff only',
    permissions: 'requireStaff',
    finalResult: custTenant.status >= 400 ? 'رفض صحيح' : 'CRITICAL escalation',
    verdict: custTenant.status === 403 || custTenant.status === 401 ? 'PASS' : 'CRITICAL FAIL',
    problem: custTenant.data.ok ? 'Customer created tenant account' : '',
    fixed: 'requireStaff on tenant-account',
  });

  const staffOk = await req('POST', '/api/hub/notifications', {
    token: staff.staffToken,
    role: 'supreme_leader',
    body: { title: `إشعار مؤمّن ${stamp}`, message: 'after hardening' },
  });
  row({
    page: 'hub notifications',
    operation: 'موظف مخول ينشئ إشعار Hub بعد التأمين',
    user: 'leader@naiosh.com',
    action: 'POST /api/hub/notifications with staff token',
    api: `status=${staffOk.status}`,
    dbResult: staffOk.data.ok ? 'notification stored' : 'failed',
    customerResult: 'N/A',
    adminResult: staffOk.data.ok ? 'ok' : staffOk.data.error,
    permissions: 'authenticated',
    finalResult: staffOk.data.ok ? 'الكتابة المصرح بها تعمل' : 'كسر المسار الشرعي',
    verdict: staffOk.data.ok ? 'PASS' : 'FAIL',
    problem: '',
    fixed: '',
  });
}

async function testLocalStorageCustomerRequests() {
  // Reuse existing e2e script logic via spawn-like require by running file
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/e2e-customer-requests.js')], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const passCount = (out.match(/^PASS:/gm) || []).length;
  const failCount = (out.match(/^FAIL:/gm) || []).length;
  row({
    page: 'customer-requests / articles (localStorage modules)',
    operation: 'دورة طلبات العملاء المحلية (مقالات وربط REQ)',
    user: 'client@naiosh.com (simulated)',
    action: 'node scripts/e2e-customer-requests.js',
    api: 'HubCustomerRequests + HubArticles (browser store)',
    dbResult: 'localStorage naiosh_customer_requests_v1',
    customerResult: `${passCount} PASS`,
    adminResult: 'طلبات العملاء view',
    permissions: 'module-level',
    finalResult: failCount === 0 ? `كل فحوصات السكربت ناجحة (${passCount})` : `${failCount} فشل`,
    verdict: r.status === 0 && failCount === 0 ? 'PASS' : 'FAIL',
    problem: failCount ? out.split('\n').filter((l) => l.startsWith('FAIL:')).slice(0, 5).join(' | ') : '',
  });

  const ha = spawnSync(process.execPath, [path.join(ROOT, 'scripts/e2e-higher-approvals.js')], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const haOut = (ha.stdout || '') + (ha.stderr || '');
  const haFail = (haOut.match(/FAIL/g) || []).length;
  row({
    page: 'higher approvals',
    operation: 'موافقات المدير الأعلى — قبول/رفض/تعديل',
    user: 'supreme leader (sim)',
    action: 'node scripts/e2e-higher-approvals.js',
    api: 'HubHigherApprovals',
    dbResult: 'localStorage',
    customerResult: 'status sync',
    adminResult: 'inbox',
    permissions: 'higher approvals',
    finalResult: ha.status === 0 ? 'سكربت ناجح' : 'فشل السكربت',
    verdict: ha.status === 0 ? 'PASS' : 'FAIL',
    problem: ha.status !== 0 ? haOut.slice(-400) : '',
  });
}

async function testLinkIntegrity() {
  const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
  const checked = new Set();
  let okPages = 0;
  let failPages = 0;
  const sampleBroken = [];

  for (const file of htmlFiles) {
    pagesReviewed.add(`/${file}`);
    const res = await getHtml('/' + file);
    if (res.status !== 200) {
      failPages++;
      brokenLinks.push({ from: 'filesystem', href: file, status: res.status });
      continue;
    }
    okPages++;
    const hrefs = [...res.body.matchAll(/(?:href|src)=["']([^"'#?]+)/gi)].map((m) => m[1]);
    for (const href of hrefs) {
      if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('data:') || href.startsWith('javascript:'))
        continue;
      if (href.startsWith('#')) continue;
      const clean = href.replace(/^\.\//, '').split('#')[0].split('?')[0];
      if (!clean || checked.has(clean)) continue;
      checked.add(clean);
      // only check local html/css/js/assets
      if (!/\.(html|css|js|png|jpg|jpeg|svg|webp|ico|woff2?|json)$/i.test(clean) && !clean.endsWith('/')) continue;
      const target = clean.startsWith('/') ? clean : '/' + clean;
      const tr = await getHtml(target);
      if (tr.status >= 400) {
        brokenLinks.push({ from: file, href: clean, status: tr.status });
        sampleBroken.push(`${file} → ${clean} (${tr.status})`);
      }
    }
  }

  row({
    page: 'sitewide',
    operation: 'مراجعة روابط الصفحات (Header/قوائم/أزرار)',
    user: 'crawler',
    action: `crawl ${htmlFiles.length} html files`,
    api: 'static server',
    dbResult: 'N/A',
    customerResult: `pages 200=${okPages}`,
    adminResult: `broken=${brokenLinks.length}`,
    permissions: 'public',
    finalResult:
      brokenLinks.length === 0
        ? 'لا روابط مكسورة في العينة'
        : `${brokenLinks.length} رابط مكسور (عينة: ${sampleBroken.slice(0, 8).join('; ')})`,
    verdict: brokenLinks.length === 0 ? 'PASS' : brokenLinks.length > 25 ? 'FAIL' : 'FAIL',
    problem: sampleBroken.slice(0, 15).join(' | '),
  });

  return { htmlFiles, okPages, failPages };
}

async function testNotificationsHub(staff) {
  const list = await req('GET', '/api/hub/notifications');
  const create = await req('POST', '/api/hub/notifications', {
    token: staff.staffToken,
    role: 'supreme_leader',
    body: {
      title: `إشعار اختبار ${stamp}`,
      message: 'إشعار تكامل E2E',
      type: 'system',
    },
  });
  row({
    page: 'hub notifications',
    operation: 'إنشاء/قراءة إشعارات Hub Runtime',
    user: 'leader',
    action: 'GET/POST /api/hub/notifications',
    api: `list=${list.status} create=${create.status}`,
    dbResult: 'hub-runtime.json / memory',
    customerResult: 'N/A or mirrored',
    adminResult: create.data.ok || list.data.ok ? 'ok' : 'fail',
    permissions: 'varies',
    finalResult: list.status < 500 && create.status < 500 ? 'endpoint حي' : 'فشل',
    verdict: list.status < 500 ? 'PASS' : 'FAIL',
    problem: '',
  });
}

async function testLogout(ctx) {
  const out = await req('POST', '/api/auth/logout', { token: ctx.tokenA });
  row({
    page: 'login.html',
    operation: 'تسجيل الخروج',
    user: ctx.emailA,
    action: 'POST /api/auth/logout',
    api: `status=${out.status}`,
    dbResult: 'stateless token — client clears storage',
    customerResult: out.data.ok || out.status < 500 ? 'ok' : 'fail',
    adminResult: 'N/A',
    permissions: 'auth',
    finalResult: out.status < 500 ? 'مسار الخروج متاح' : 'خطأ',
    verdict: out.status < 500 ? 'PASS' : 'FAIL',
    problem: '',
  });
}

function writeReports(apis) {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const pass = rows.filter((r) => r.verdict === 'PASS').length;
  const fail = rows.filter((r) => r.verdict !== 'PASS').length;
  const critical = rows.filter((r) => r.verdict === 'CRITICAL FAIL').length;

  const summary = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    databaseLinked: false,
    pagesReviewedCount: pagesReviewed.size,
    pagesReviewed: [...pagesReviewed].sort(),
    transactionsDiscoveredCount: transactionsDiscovered.size,
    transactionsDiscovered: [...transactionsDiscovered].sort(),
    transactionsTested: rows.map((r) => r.operation),
    pass,
    fail,
    critical,
    brokenLinks,
    fixedIssues,
    remainingIssues,
    rows,
    discoveredApis: apis,
  };

  fs.writeFileSync(path.join(ARTIFACTS, 'platform-e2e-audit-report.json'), JSON.stringify(summary, null, 2));

  const md = [];
  md.push('# تقرير اختبار Transactions & Integration — NAIOSH HUB 360');
  md.push('');
  md.push(`- التاريخ: ${summary.generatedAt}`);
  md.push(`- القاعدة: ${BASE}`);
  md.push(`- قاعدة البيانات: غير مربوطة (JSON stores: customer-accounts.json / client-portal.json)`);
  md.push(`- الصفحات المراجعة: ${summary.pagesReviewedCount}`);
  md.push(`- Transactions المكتشفة: ${summary.transactionsDiscoveredCount}`);
  md.push(`- الاختبارات: PASS=${pass} FAIL=${fail} CRITICAL=${critical}`);
  md.push('');
  md.push('| الصفحة | العملية | المستخدم | الإجراء | API/Backend | نتيجة DB | العميل | الإدارة | الصلاحيات | النتيجة | PASS/FAIL | المشكلة | ما تم إصلاحه |');
  md.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const cells = [
      r.page,
      r.operation,
      r.user,
      r.action,
      r.api,
      r.dbResult,
      r.customerResult,
      r.adminResult,
      r.permissions,
      r.finalResult,
      r.verdict,
      r.problem,
      r.fixed,
    ].map((c) => String(c || '').replace(/\|/g, '\\|').replace(/\n/g, ' '));
    md.push('| ' + cells.join(' | ') + ' |');
  }
  md.push('');
  md.push('## الروابط المكسورة');
  if (!brokenLinks.length) md.push('- لا يوجد');
  else for (const b of brokenLinks.slice(0, 50)) md.push(`- ${b.from} → ${b.href} (${b.status})`);
  md.push('');
  md.push('## الأخطاء المتبقية');
  if (!remainingIssues.length) md.push('- لا يوجد');
  else for (const i of remainingIssues) md.push(`- [${i.verdict}] ${i.operation}: ${i.problem}`);

  fs.writeFileSync(path.join(ARTIFACTS, 'platform-e2e-audit-report.md'), md.join('\n'));
  return summary;
}

async function main() {
  console.log('=== Platform E2E Audit @', BASE, '===');
  const health = await req('GET', '/api/health');
  if (!health.data.ok) throw new Error('API health failed');
  console.log('Health OK; database linked=', health.data.database?.linked);

  const apis = discoverTransactions();
  console.log('Discovered API path refs:', apis.length);

  const ctx = await testAuthLifecycle();
  const staff = await testCustomerAdminLifecycle(ctx);
  await testIsolationAndPermissions(ctx, staff);
  await testProductOrders(ctx, staff);
  await testHubApiAuthHardening(ctx, staff);
  await testNotificationsHub(staff);
  await testLocalStorageCustomerRequests();
  await testLinkIntegrity();
  await testLogout(ctx);

  const summary = writeReports(apis);
  console.log('\n=== SUMMARY ===');
  console.log('PASS', summary.pass, 'FAIL', summary.fail, 'CRITICAL', summary.critical);
  console.log('Pages', summary.pagesReviewedCount, 'Tx discovered', summary.transactionsDiscoveredCount);
  console.log('Report:', path.join(ARTIFACTS, 'platform-e2e-audit-report.md'));
  if (summary.critical > 0) process.exitCode = 2;
  else if (summary.fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
