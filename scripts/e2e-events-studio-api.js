/**
 * API + integrity tests for events studio.
 * Run: node scripts/e2e-events-studio-api.js
 */
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

function tokenFor(email, customer) {
  if (customer) return `hub360.cust.${Buffer.from(email).toString('base64url')}.${Date.now()}`;
  return `hub360.${Buffer.from(email).toString('base64')}.${Date.now()}`;
}

function headers(email, role, extra) {
  const t = tokenFor(email, role === 'customer');
  return {
    Authorization: `Bearer ${t}`,
    'X-Hub-Token': t,
    'X-Hub-User-Role': role,
    'X-Hub-User-Name': email.split('@')[0],
    ...(extra || {}),
  };
}

function req(method, urlPath, { email = 'leader@naiosh.com', role = 'supreme_leader', body, headers: extra } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const payload = body != null ? JSON.stringify(body) : null;
    const h = headers(email, role, extra);
    if (payload) h['Content-Type'] = 'application/json';
    h['Content-Length'] = payload ? Buffer.byteLength(payload) : 0;
    const r = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: h,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = { raw: text };
          }
          resolve({ status: res.statusCode, json, text });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function main() {
  const results = [];
  const pass = (n, extra) => {
    results.push({ name: n, ok: true, extra });
    console.log('PASS', n, extra || '');
  };
  const fail = (n, e) => {
    results.push({ name: n, ok: false, err: String(e && e.message ? e.message : e) });
    console.log('FAIL', n, e);
  };

  const client = { email: 'client-events@naiosh.com', role: 'customer' };
  const other = { email: 'client-other@naiosh.com', role: 'customer' };
  const staff = { email: 'leader@naiosh.com', role: 'supreme_leader' };
  const today = new Date().toISOString().slice(0, 10);
  const runKey = 'e2e-' + Date.now();
  const end = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  let eventId = '';
  let requestId = '';
  let registrationId = '';

  try {
    const created = await req('POST', '/api/hub/events', {
      ...client,
      body: {
        name: 'ورشة اختبار دورة الفعالية',
        category: 'ورشة',
        summary: 'ملخص المسودة',
        description: 'وصف كامل للمسودة',
        startDate: today,
        startTime: '18:00',
        endDate: end,
        attendanceType: 'online',
        onlineUrl: 'https://meet.naiosh.com/evt-test',
        pricing: 'free',
        seats: 2,
        organizerName: 'عميل الاختبار',
        organizerEmail: client.email,
        requiresRegistration: true,
      },
      headers: { 'Idempotency-Key': runKey + '-create' },
    });
    assert.strictEqual(created.status, 201, JSON.stringify(created.json));
    eventId = created.json.event.id;
    assert.ok(/^EVT-\d{4}-\d{5}$/.test(eventId), eventId);
    assert.strictEqual(created.json.event.status, 'draft');
    pass('TEST1 create event', eventId);
  } catch (e) {
    fail('TEST1 create event', e);
  }

  try {
    const dup = await req('POST', '/api/hub/events', {
      ...client,
      body: { name: 'ورشة اختبار دورة الفعالية' },
      headers: { 'Idempotency-Key': runKey + '-create' },
    });
    assert.ok(dup.status === 201 || dup.status === 200);
    assert.strictEqual(dup.json.event.id, eventId);
    pass('idempotent create', eventId);
  } catch (e) {
    fail('idempotent create', e);
  }

  try {
    const got = await req('GET', '/api/hub/events/' + eventId, client);
    assert.strictEqual(got.status, 200);
    assert.strictEqual(got.json.event.status, 'draft');
    pass('TEST2/3 draft persists', got.json.event.status);
  } catch (e) {
    fail('TEST2/3 draft persists', e);
  }

  try {
    const edited = await req('PUT', '/api/hub/events/' + eventId, {
      ...client,
      body: { summary: 'ملخص بعد التعديل', description: 'وصف بعد تعديل المسودة' },
    });
    assert.strictEqual(edited.status, 200);
    assert.ok(edited.json.event.summary.includes('بعد التعديل'));
    pass('TEST4 edit draft', edited.json.event.summary);
  } catch (e) {
    fail('TEST4 edit draft', e);
  }

  try {
    const submitted = await req('POST', '/api/hub/events/' + eventId + '/action', {
      ...client,
      body: { action: 'submit' },
      headers: { 'Idempotency-Key': runKey + '-submit' },
    });
    assert.strictEqual(submitted.status, 200, JSON.stringify(submitted.json));
    assert.strictEqual(submitted.json.event.status, 'pending_review');
    requestId = submitted.json.event.requestId || submitted.json.request.requestId;
    assert.ok(/^EVT-REQ-\d{4}-\d{5}$/.test(requestId), requestId);
    pass('TEST5 submit review', requestId);
    pass('TEST6 Event+Request IDs', eventId + ' / ' + requestId);
  } catch (e) {
    fail('TEST5/6 submit', e);
  }

  try {
    const inbox = await req('GET', '/api/hub/events/requests', staff);
    assert.strictEqual(inbox.status, 200, JSON.stringify(inbox.json));
    const hit = (inbox.json.items || []).find((r) => r.requestId === requestId || r.eventId === eventId);
    assert.ok(hit, 'request missing in admin inbox');
    assert.strictEqual(hit.requestTypeLabel, 'طلب نشر فعالية');
    pass('TEST7/8 admin inbox', hit.requestId + ' · ' + hit.eventId);
  } catch (e) {
    fail('TEST7/8 admin inbox', e);
  }

  try {
    const deniedInbox = await req('GET', '/api/hub/events/requests', client);
    assert.ok(deniedInbox.status === 403 || deniedInbox.status === 401);
    pass('TEST21 customer denied admin requests', deniedInbox.status);
  } catch (e) {
    fail('TEST21 customer denied admin requests', e);
  }

  try {
    const changes = await req('POST', '/api/hub/events/' + eventId + '/action', {
      ...staff,
      body: { action: 'request_changes', note: 'أضف صورة غلاف أوضح' },
    });
    assert.strictEqual(changes.status, 200, JSON.stringify(changes.json));
    assert.strictEqual(changes.json.event.status, 'needs_changes');
    assert.ok(changes.json.event.changeRequestNote.includes('غلاف'));
    pass('TEST9 request changes', changes.json.event.changeRequestNote);
  } catch (e) {
    fail('TEST9 request changes', e);
  }

  try {
    const seen = await req('GET', '/api/hub/events/' + eventId, client);
    assert.strictEqual(seen.json.event.status, 'needs_changes');
    assert.ok(seen.json.event.changeRequestNote.includes('غلاف'));
    pass('TEST10 customer sees change reason', seen.json.event.changeRequestNote);
  } catch (e) {
    fail('TEST10 customer sees change reason', e);
  }

  try {
    await req('PUT', '/api/hub/events/' + eventId, { ...client, body: { summary: 'بعد إعادة الإرسال' } });
    const resub = await req('POST', '/api/hub/events/' + eventId + '/action', {
      ...client,
      body: { action: 'submit' },
    });
    assert.strictEqual(resub.json.event.status, 'pending_review');
    assert.strictEqual(resub.json.event.requestId, requestId);
    pass('TEST11 resubmit same request id', requestId);
  } catch (e) {
    fail('TEST11 resubmit', e);
  }

  try {
    const appr = await req('POST', '/api/hub/events/' + eventId + '/action', {
      ...staff,
      body: { action: 'approve' },
    });
    assert.strictEqual(appr.status, 200, JSON.stringify(appr.json));
    assert.strictEqual(appr.json.event.status, 'published');
    pass('TEST12 approve+publish', appr.json.event.status);
  } catch (e) {
    fail('TEST12 approve+publish', e);
  }

  try {
    const inbox2 = await req('GET', '/api/hub/events/requests', staff);
    const hit = (inbox2.json.items || []).find((r) => r.requestId === requestId);
    assert.ok(hit);
    assert.ok(hit.status === 'Approved' || hit.statusLabel === 'منشورة' || hit.statusLabel === 'تمت الموافقة');
    pass('TEST13 accepted request status', hit.status + ' / ' + hit.statusLabel);
  } catch (e) {
    fail('TEST13 accepted request', e);
  }

  try {
    const pub = await req('GET', '/api/hub/events/public', client);
    const hit = (pub.json.items || []).find((e) => e.id === eventId);
    assert.ok(hit, 'published event missing from public catalog');
    pass('TEST14/15 public catalog', hit.id);
  } catch (e) {
    fail('TEST14/15 public catalog', e);
  }

  try {
    const otherSee = await req('GET', '/api/hub/events/' + eventId, other);
    assert.strictEqual(otherSee.status, 200);
    pass('other customer can see published', otherSee.status);
  } catch (e) {
    fail('other customer can see published', e);
  }

  try {
    const reg = await req('POST', '/api/hub/events/' + eventId + '/register', {
      ...other,
      body: { name: 'عميل آخر' },
      headers: { 'Idempotency-Key': runKey + '-reg' },
    });
    assert.strictEqual(reg.status, 201, JSON.stringify(reg.json));
    registrationId = reg.json.registration.id;
    assert.ok(/^REG-\d{4}-\d{5}$/.test(registrationId), registrationId);
    assert.strictEqual(reg.json.registration.status, 'confirmed');
    pass('TEST16/17 free register', registrationId);
  } catch (e) {
    fail('TEST16/17 free register', e);
  }

  try {
    const dupReg = await req('POST', '/api/hub/events/' + eventId + '/register', {
      ...other,
      body: {},
      headers: { 'Idempotency-Key': runKey + '-reg' },
    });
    assert.ok(dupReg.status === 201 || dupReg.status === 200 || dupReg.status === 409);
    if (dupReg.json.registration) assert.strictEqual(dupReg.json.registration.id, registrationId);
    pass('register idempotent/duplicate', dupReg.status);
  } catch (e) {
    fail('register idempotent/duplicate', e);
  }

  try {
    const mine = await req('GET', '/api/hub/events/mine/registrations', other);
    const hit = (mine.json.items || []).find((r) => r.id === registrationId);
    assert.ok(hit);
    pass('TEST18 my registrations', hit.id);
  } catch (e) {
    fail('TEST18 my registrations', e);
  }

  try {
    const ev = await req('GET', '/api/hub/events/' + eventId, staff);
    assert.ok(Number(ev.json.event.seatsTaken) >= 1);
    const sum = await req('GET', '/api/hub/events/summary', staff);
    assert.ok(Number(sum.json.summary.registrations) >= 1);
    pass('TEST19 seats+stats', 'taken=' + ev.json.event.seatsTaken + ' regs=' + sum.json.summary.registrations);
  } catch (e) {
    fail('TEST19 seats+stats', e);
  }

  try {
    const draftB = await req('POST', '/api/hub/events', {
      ...client,
      body: { name: 'مسودة سرية للعميل الأول', attendanceType: 'online', onlineUrl: 'https://x.test', startDate: today },
    });
    const secretId = draftB.json.event.id;
    const peek = await req('GET', '/api/hub/events/' + secretId, other);
    assert.ok(peek.status === 403 || peek.status === 404, JSON.stringify(peek.json));
    pass('TEST20 isolation other customer 403', peek.status);
  } catch (e) {
    fail('TEST20 isolation', e);
  }

  try {
    const fakeApprove = await req('POST', '/api/hub/events/' + eventId + '/action', {
      ...other,
      body: { action: 'approve' },
    });
    assert.ok(fakeApprove.status === 403 || fakeApprove.status === 409, fakeApprove.status);
    pass('TEST21 customer cannot approve', fakeApprove.status);
  } catch (e) {
    fail('TEST21 customer cannot approve', e);
  }

  try {
    const empty = await req('POST', '/api/hub/events', { ...client, body: { name: '' } });
    assert.strictEqual(empty.status, 400);
    pass('validation empty name', empty.status);
  } catch (e) {
    fail('validation empty name', e);
  }

  try {
    const pubLog = await req('POST', '/api/hub/events/' + eventId + '/publish', {
      ...staff,
      body: { platform: 'instagram' },
    });
    assert.strictEqual(pubLog.status, 200, JSON.stringify(pubLog.json));
    const pubs = pubLog.json.event.publications || [];
    const last = pubs[pubs.length - 1];
    assert.ok(last);
    assert.ok(last.status === 'awaiting' || last.statusLabel.includes('يدوي') || last.statusLabel.includes('بانتظار'));
    assert.ok(last.status !== 'published' || last.mode === 'manual');
    pass('TEST25 no fake social publish', last.status + ' / ' + last.mode);
  } catch (e) {
    fail('TEST25 no fake social publish', e);
  }

  try {
    const web = await req('POST', '/api/hub/events/' + eventId + '/publish', {
      ...staff,
      body: { platform: 'website' },
    });
    const last = (web.json.event.publications || []).slice(-1)[0];
    assert.strictEqual(last.status, 'published');
    assert.strictEqual(last.mode, 'internal');
    pass('internal website publish', last.id);
  } catch (e) {
    fail('internal website publish', e);
  }

  try {
    const clip = await req('POST', '/api/hub/events/' + eventId + '/clips', {
      ...staff,
      body: { title: 'مقطع اختبار', start: 0, end: 12, sourceVideoId: '' },
    });
    assert.strictEqual(clip.status, 200, JSON.stringify(clip.json));
    const last = (clip.json.event.clips || []).slice(-1)[0];
    assert.ok(/^CLIP-\d{4}-\d{5}$/.test(last.id), last.id);
    pass('TEST24 clip metadata saved', last.id);
  } catch (e) {
    fail('TEST24 clip metadata', e);
  }

  try {
    const paid = await req('POST', '/api/hub/events', {
      ...client,
      body: {
        name: 'فعالية مدفوعة اختبار',
        startDate: today,
        attendanceType: 'online',
        onlineUrl: 'https://pay.test',
        pricing: 'paid',
        priceUsd: 25,
        seats: 5,
      },
    });
    await req('POST', '/api/hub/events/' + paid.json.event.id + '/action', { ...staff, body: { action: 'submit' } });
    await req('POST', '/api/hub/events/' + paid.json.event.id + '/action', { ...staff, body: { action: 'approve' } });
    const preg = await req('POST', '/api/hub/events/' + paid.json.event.id + '/register', { ...other, body: {} });
    assert.strictEqual(preg.json.registration.status, 'pending_payment');
    assert.ok(preg.json.registration.paymentNote);
    pass('paid event no fake payment', preg.json.registration.id + ' ' + preg.json.registration.status);
  } catch (e) {
    fail('paid event no fake payment', e);
  }

  const report = { eventId, requestId, registrationId, results, at: new Date().toISOString() };
  fs.writeFileSync(path.join(OUT, 'events-studio-api-report.json'), JSON.stringify(report, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log('\nSUMMARY', results.length - failed.length, '/', results.length, 'passed');
  console.log('IDS', { eventId, requestId, registrationId });
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
