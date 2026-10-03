/**
 * E2E: client portal attachments for support / complaints / requests.
 * Verifies create → upload (image/pdf/video) → list → content → refresh → admin → isolation.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8090';
const TMP = '/tmp/client-attach-e2e';
fs.mkdirSync(TMP, { recursive: true });

function staffHeaders(email = 'leader@naiosh.com') {
  const token = `hub360.${Buffer.from(email).toString('base64')}.${Date.now()}`;
  return {
    Authorization: `Bearer ${token}`,
    'X-Hub-Token': token,
    'X-Hub-User-Role': 'supreme_leader',
    'X-Hub-User-Name': 'Leader',
  };
}

async function loginCustomer(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  assert.ok(data.ok && data.token, `login failed for ${email}: ${data.error || res.status}`);
  return data;
}

function custHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Hub-Token': token,
    'X-Hub-User-Role': 'customer',
    'Content-Type': 'application/json',
  };
}

async function json(method, urlPath, { token, body, staff } = {}) {
  const headers = staff ? { ...staffHeaders(), 'Content-Type': 'application/json' } : custHeaders(token);
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function upload(token, entityType, entityId, category, filePath, mime, name) {
  const buf = fs.readFileSync(filePath);
  const qs = `?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}&category=${encodeURIComponent(category)}`;
  const res = await fetch(`${BASE}/api/client/attachments${qs}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Hub-Token': token,
      'X-Hub-User-Role': 'customer',
      'X-File-Name': encodeURIComponent(name),
      'X-File-Type': mime,
      'Content-Type': mime,
      'X-Entity-Type': entityType,
      'X-Entity-Id': entityId,
      'X-Attach-Category': category,
    },
    body: buf,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function fetchContent(url, token, staff = false) {
  const headers = staff ? staffHeaders() : { Authorization: `Bearer ${token}`, 'X-Hub-Token': token, 'X-Hub-User-Role': 'customer' };
  const res = await fetch(`${BASE}${url}`, { headers });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, size: buf.length, buf };
}

function makeFiles() {
  const img = path.join(TMP, 'problem.png');
  // minimal PNG 1x1
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
    'hex'
  );
  fs.writeFileSync(img, png);
  const pdf = path.join(TMP, 'report.pdf');
  fs.writeFileSync(pdf, '%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
  const video = path.join(TMP, 'explain.mp4');
  // tiny fake mp4 bytes (server accepts by extension/mime)
  fs.writeFileSync(video, Buffer.concat([Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]), crypto.randomBytes(64)]));
  return { img, pdf, video };
}

(async () => {
  const report = [];
  const files = makeFiles();

  // Limits endpoint requires auth — use customer after login
  const a = await loginCustomer('client@naiosh.com', 'Hub@360');
  const limits = await json('GET', '/api/client/attachments/limits', { token: a.token });
  assert.strictEqual(limits.data.maxMb, 1500, 'max 1500MB');
  report.push({ step: 'limits=1500MB', result: 'PASS' });

  // Create ticket
  const ticketRes = await json('POST', '/api/client/tickets', {
    token: a.token,
    body: {
      subject: 'مساعدة في إعداد ERP',
      department: 'دعم فني',
      priority: 'NORMAL',
      message: 'أحتاج مساعدة في ربط الفرع',
    },
  });
  assert.strictEqual(ticketRes.status, 201, 'ticket created');
  const ticketId = ticketRes.data.ticket.id;
  const ticketNumber = ticketRes.data.ticket.number;
  assert.ok(ticketId, 'ticket id');
  report.push({ step: 'create ticket', id: ticketNumber || ticketId, result: 'PASS' });

  // Upload 3 attachments
  const upImg = await upload(a.token, 'ticket', ticketId, 'image', files.img, 'image/png', 'صورة المشكلة.png');
  assert.strictEqual(upImg.status, 201, 'image upload');
  const upPdf = await upload(a.token, 'ticket', ticketId, 'file', files.pdf, 'application/pdf', 'التقرير.pdf');
  assert.strictEqual(upPdf.status, 201, 'pdf upload');
  const upVid = await upload(a.token, 'ticket', ticketId, 'video', files.video, 'video/mp4', 'شرح المشكلة.mp4');
  assert.strictEqual(upVid.status, 201, 'video upload');
  report.push({ step: 'upload image+pdf+video', result: 'PASS' });

  // List in my tickets
  const list1 = await json('GET', '/api/client/tickets', { token: a.token });
  const t1 = (list1.data.tickets || []).find((t) => t.id === ticketId);
  assert.ok(t1, 'ticket in list');
  assert.strictEqual((t1.attachments || []).length, 3, '3 attachments after upload');
  report.push({ step: 'my tickets shows 3 attachments', result: 'PASS' });

  // Refresh (re-get)
  const list2 = await json('GET', '/api/client/tickets', { token: a.token });
  const t2 = (list2.data.tickets || []).find((t) => t.id === ticketId);
  assert.strictEqual((t2.attachments || []).length, 3, 'still 3 after refresh');
  report.push({ step: 'refresh keeps attachments', result: 'PASS' });

  // Open each attachment as owner
  for (const att of t2.attachments) {
    const content = await fetchContent(att.contentUrl, a.token);
    assert.strictEqual(content.status, 200, `owner open ${att.originalFileName}`);
    assert.ok(content.size > 0, 'non-empty content');
  }
  report.push({ step: 'owner can open all 3 files', result: 'PASS' });

  // Public /uploads blocked
  const storageRef = require('../lib/hub-client-attachments').canAccessAttachment(t2.attachments[0].id, {
    email: 'client@naiosh.com',
  }).attachment.storageRef;
  const pub = await fetch(`${BASE}/uploads/${storageRef}`);
  assert.ok(pub.status === 403 || pub.status === 404, 'public upload blocked');
  report.push({ step: 'public /uploads blocked', result: 'PASS' });

  // Admin sees ticket + attachments
  const adminTickets = await json('GET', '/api/admin/posha/tickets', { staff: true });
  assert.strictEqual(adminTickets.status, 200, 'admin tickets');
  const admT = (adminTickets.data.tickets || []).find((t) => t.id === ticketId);
  assert.ok(admT, 'admin sees ticket');
  assert.strictEqual((admT.attachments || []).length, 3, 'admin sees 3 attachments');
  for (const att of admT.attachments) {
    const content = await fetchContent(att.adminContentUrl || att.contentUrl.replace('/api/client/', '/api/admin/posha/'), a.token, true);
    // use staff headers via flag
    const staffContent = await fetch(`${BASE}${att.adminContentUrl}`, { headers: staffHeaders() });
    assert.strictEqual(staffContent.status, 200, `admin open ${att.originalFileName}`);
  }
  report.push({ step: 'admin sees ticket + opens files', result: 'PASS' });

  // Isolation: register temporary customer B or use another account
  const bEmail = `clientb_${Date.now()}@naiosh.test`;
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'عميل بي',
      username: `userb_${Date.now().toString(36)}`,
      email: bEmail,
      phone: `+97059${String(Date.now()).slice(-7)}`,
      password: 'Hub@360Test',
      confirmPassword: 'Hub@360Test',
      termsAccepted: true,
      acceptTerms: true,
    }),
  }).then((r) => r.json());
  assert.ok(reg.ok || reg.token || reg.user, `register B: ${JSON.stringify(reg).slice(0, 200)}`);
  const bLogin = reg.token
    ? reg
    : await loginCustomer(bEmail, 'Hub@360Test');
  const bToken = bLogin.token;
  const steal = await fetchContent(t2.attachments[0].contentUrl, bToken);
  assert.strictEqual(steal.status, 403, 'customer B cannot open A attachment');
  const bList = await json('GET', '/api/client/tickets', { token: bToken });
  assert.ok(!(bList.data.tickets || []).some((t) => t.id === ticketId), 'B does not see A ticket');
  report.push({ step: 'CUSTOMER-B isolation', result: 'PASS' });

  // Complaints path
  const cmp = await json('POST', '/api/client/complaints', {
    token: a.token,
    body: { category: 'تقني', subject: 'شكوى مع مرفق', message: 'تفاصيل الشكوى', priority: 'HIGH' },
  });
  assert.strictEqual(cmp.status, 201);
  const cmpId = cmp.data.complaint.id;
  const cmpUp = await upload(a.token, 'complaint', cmpId, 'image', files.img, 'image/png', 'اثبات.png');
  assert.strictEqual(cmpUp.status, 201);
  const cmpList = await json('GET', '/api/client/complaints', { token: a.token });
  const cmpRow = (cmpList.data.complaints || []).find((c) => c.id === cmpId);
  assert.ok((cmpRow.attachments || []).length >= 1);
  const adminCmp = await json('GET', '/api/admin/posha/os/complaints', { staff: true });
  assert.ok((adminCmp.data.complaints || []).some((c) => c.id === cmpId && (c.attachments || []).length >= 1));
  report.push({ step: 'complaints attachments', result: 'PASS' });

  // Service requests path
  const req = await json('POST', '/api/client/requests', {
    token: a.token,
    body: { type: 'TECHNICAL_SETUP', subject: 'طلب خدمة مع مرفق', message: 'تفاصيل الطلب', priority: 'NORMAL' },
  });
  assert.strictEqual(req.status, 201);
  const reqId = req.data.request.id;
  const reqUp = await upload(a.token, 'request', reqId, 'file', files.pdf, 'application/pdf', 'ملاحظات.pdf');
  assert.strictEqual(reqUp.status, 201);
  const reqList = await json('GET', '/api/client/requests', { token: a.token });
  const reqRow = (reqList.data.requests || []).find((r) => r.id === reqId);
  assert.ok((reqRow.attachments || []).length >= 1);
  const adminReq = await json('GET', '/api/admin/posha/os/requests', { staff: true });
  assert.ok((adminReq.data.requests || []).some((r) => r.id === reqId && (r.attachments || []).length >= 1));
  report.push({ step: 'service request attachments', result: 'PASS' });

  // Frontend source checks
  const portalJs = fs.readFileSync(path.join(__dirname, '..', 'js/hub-client-portal.js'), 'utf8');
  assert.ok(portalJs.includes('المرفقات'), 'UI label');
  assert.ok(portalJs.includes('إضافة صورة') && portalJs.includes('إضافة ملف') && portalJs.includes('إضافة فيديو'));
  assert.ok(portalJs.includes('cp-ticket-form') && portalJs.includes('attachmentsFieldHtml'));
  assert.ok(!/wallet|invoices|security/.test(portalJs.match(/attachmentsFieldHtml\(/g) ? 'ok' : ''), 'sanity');
  assert.ok(portalJs.includes("attachmentsFieldHtml('cp-ticket-form')"));
  assert.ok(portalJs.includes("attachmentsFieldHtml('cp-complaint-form')"));
  assert.ok(portalJs.includes("attachmentsFieldHtml('cp-request-form')"));
  assert.ok(!portalJs.includes("attachmentsFieldHtml('cp-password-form')"));
  report.push({ step: 'UI only on support/complaints/requests', result: 'PASS' });

  console.log(JSON.stringify({ ok: true, ticketId, ticketNumber, report }, null, 2));
})().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
