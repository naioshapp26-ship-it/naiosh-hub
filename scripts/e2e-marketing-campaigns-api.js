/**
 * API + integrity tests for marketing campaigns studio.
 * Run: node scripts/e2e-marketing-campaigns-api.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';

function tokenFor(email) {
  return `hub360.${Buffer.from(email).toString('base64')}.${Date.now()}`;
}

function headers(email, role, extra) {
  const t = tokenFor(email);
  return {
    Authorization: `Bearer ${t}`,
    'X-Hub-Token': t,
    'X-Hub-User-Role': role,
    'X-Hub-User-Name': email.split('@')[0],
    ...(extra || {}),
  };
}

function req(method, urlPath, { email = 'leader@naiosh.com', role = 'supreme_leader', body, headers: extra, raw, type } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const payload = raw || (body != null ? JSON.stringify(body) : null);
    const h = headers(email, role, extra);
    if (payload && !raw) h['Content-Type'] = 'application/json';
    if (type) h['Content-Type'] = type;
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
          try { json = JSON.parse(text); } catch { json = { raw: text }; }
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

  try {
    const denied = await req('GET', '/api/hub/marketing-campaigns', { email: 'client@naiosh.com', role: 'customer' });
    assert.ok(denied.status === 403 || denied.status === 401, JSON.stringify(denied.json));
    pass('permissions deny customer', denied.status);
  } catch (e) { fail('permissions deny customer', e); }

  try {
    const unauth = await req('GET', '/api/hub/marketing-campaigns', { email: '', role: '' });
    // empty email still sends a token of empty base64 - may 401
    pass('unauth probe', unauth.status);
  } catch (e) { fail('unauth probe', e); }

  try {
    const empty = await req('POST', '/api/hub/marketing-campaigns', { body: { name: '' } });
    assert.ok(empty.status >= 400);
    pass('reject empty name', empty.status);
  } catch (e) { fail('reject empty name', e); }

  try {
    const cust = await req('POST', '/api/hub/marketing-campaigns', {
      email: 'client@naiosh.com',
      role: 'customer',
      body: { name: 'حملة عميل' },
    });
    assert.ok(cust.status === 403 || cust.status === 401);
    pass('customer cannot create', cust.status);
  } catch (e) { fail('customer cannot create', e); }

  let campaignId = '';
  let contentId = '';
  try {
    const idem = 'e2e-' + Date.now();
    const created = await req('POST', '/api/hub/marketing-campaigns', {
      body: {
        name: 'اختبار دورة الحملة التسويقية',
        description: 'مسودة أولى',
        type: 'حملة محتوى',
        goal: 'leads',
        goalTarget: 50,
        goalUnit: 'عميل محتمل',
        startDate: '2026-10-04',
        endDate: '2026-10-31',
        channels: ['website', 'instagram'],
        budget: { total: 1000, contentCost: 200, adCost: 700, otherCost: 100 },
      },
      extra: { 'Idempotency-Key': idem },
      headers: { 'Idempotency-Key': idem },
    });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    campaignId = created.json.campaign.id;
    assert.ok(/^CMP-\d{4}-\d{6}$/.test(campaignId), campaignId);
    const dup = await req('POST', '/api/hub/marketing-campaigns', {
      body: { name: 'اختبار دورة الحملة التسويقية' },
      headers: { 'Idempotency-Key': idem },
    });
    assert.equal(dup.json.campaign.id, campaignId);
    pass('create + idempotency', campaignId);
    const noContent = await req('POST', '/api/hub/marketing-campaigns', {
      body: { name: 'بدون محتوى ' + Date.now(), goal: 'leads', goalTarget: 10, channels: ['website'] },
    });
    const tmpId = noContent.json.campaign.id;
    const badSub = await req('POST', `/api/hub/marketing-campaigns/${tmpId}/action`, { body: { action: 'submit' } });
    assert.ok(badSub.status >= 400);
    const still = await req('GET', `/api/hub/marketing-campaigns/${tmpId}`);
    assert.equal(still.json.campaign.status, 'draft');
    pass('submit without content rolls back status', still.json.campaign.status);
  } catch (e) { fail('create + idempotency', e); }

  try {
    const listed = await req('GET', '/api/hub/marketing-campaigns?q=' + encodeURIComponent('اختبار دورة'));
    assert.ok((listed.json.items || []).some((c) => c.id === campaignId));
    pass('list after create / refresh equivalent');
  } catch (e) { fail('list after create', e); }

  try {
    const edited = await req('PUT', `/api/hub/marketing-campaigns/${campaignId}`, {
      body: { description: 'وصف بعد التعديل' },
    });
    assert.equal(edited.json.campaign.description, 'وصف بعد التعديل');
    const again = await req('GET', `/api/hub/marketing-campaigns/${campaignId}`);
    assert.equal(again.json.campaign.description, 'وصف بعد التعديل');
    pass('edit persists');
  } catch (e) { fail('edit persists', e); }

  try {
    await req('POST', `/api/hub/marketing-campaigns/${campaignId}/audiences`, {
      body: { type: 'عملاء محتملون', region: 'السعودية', interests: 'تشغيل' },
    });
    await req('PUT', `/api/hub/marketing-campaigns/${campaignId}/budget`, {
      body: { total: 1500, contentCost: 200, adCost: 1000, otherCost: 300 },
    });
    await req('PUT', `/api/hub/marketing-campaigns/${campaignId}/channels`, {
      body: { ids: ['website', 'instagram'] },
    });
    const link = await req('POST', `/api/hub/marketing-campaigns/${campaignId}/links`, {
      body: { kind: 'product', refId: 'pr-erp-1', label: 'إي آر بي' },
    });
    assert.ok(link.json.campaign.links.length);
    pass('audience budget channels links');
  } catch (e) { fail('audience budget channels links', e); }

  try {
    const ct = await req('POST', `/api/hub/marketing-campaigns/${campaignId}/contents`, {
      body: { title: 'منشور الاختبار', type: 'image', body: 'نص إعلاني' },
    });
    contentId = ct.json.campaign.contents[0].id;
    assert.ok(/^CNT-\d{4}-\d{6}$/.test(contentId), contentId);
    pass('content id', contentId);
  } catch (e) { fail('content id', e); }

  try {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    const up = await req('POST', '/api/hub/uploads', {
      raw: png,
      type: 'image/png',
      headers: { 'X-File-Name': 'test-ad.png', 'X-File-Type': 'image/png' },
    });
    assert.equal(up.status, 201, JSON.stringify(up.json));
    const asset = await req('POST', `/api/hub/marketing-campaigns/${campaignId}/assets`, {
      body: { kind: 'image', name: 'test-ad.png', mime: 'image/png', size: png.length, url: up.json.url, uploadId: up.json.id, contentId },
    });
    assert.ok(asset.json.campaign.assets.length);
    const mp4 = Buffer.from('AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAA', 'base64');
    const upv = await req('POST', '/api/hub/uploads', {
      raw: mp4,
      type: 'video/mp4',
      headers: { 'X-File-Name': 'test-ad.mp4', 'X-File-Type': 'video/mp4' },
    });
    await req('POST', `/api/hub/marketing-campaigns/${campaignId}/assets`, {
      body: { kind: 'video', name: 'test-ad.mp4', mime: 'video/mp4', size: mp4.length, url: upv.json.url, uploadId: upv.json.id },
    });
    pass('upload image+video', up.json.url);
  } catch (e) { fail('upload image+video', e); }

  try {
    const sub = await req('POST', `/api/hub/marketing-campaigns/${campaignId}/action`, { body: { action: 'submit' } });
    assert.equal(sub.json.campaign.status, 'pending_review');
    pass('submit review');
    const chg = await req('POST', `/api/hub/marketing-campaigns/${campaignId}/action`, {
      body: { action: 'request_changes', note: 'أضف صورة أوضح' },
    });
    assert.equal(chg.json.campaign.status, 'needs_changes');
    assert.ok(chg.json.campaign.changeRequestNote.includes('أضف'));
    pass('request changes');
    const sub2 = await req('POST', `/api/hub/marketing-campaigns/${campaignId}/action`, { body: { action: 'submit' } });
    assert.equal(sub2.json.campaign.status, 'pending_review');
    const ap = await req('POST', `/api/hub/marketing-campaigns/${campaignId}/action`, { body: { action: 'approve' } });
    assert.equal(ap.json.campaign.status, 'approved');
    pass('approve');
  } catch (e) { fail('review workflow', e); }

  try {
    await req('PUT', `/api/hub/marketing-campaigns/${campaignId}/contents/${contentId}`, {
      body: { scheduleDate: '2026-10-10', scheduleTime: '14:00', channel: 'instagram' },
    });
    const sch = await req('POST', `/api/hub/marketing-campaigns/${campaignId}/contents/${contentId}/action`, {
      body: { action: 'schedule' },
    });
    assert.equal(sch.json.campaign.status, 'scheduled');
    const cal = await req('GET', '/api/hub/marketing-campaigns/calendar?from=2026-10-01&to=2026-10-31');
    assert.ok((cal.json.items || []).some((x) => x.contentId === contentId || x.campaignId === campaignId));
    pass('schedule + calendar');
  } catch (e) { fail('schedule + calendar', e); }

  try {
    const pub = await req('POST', `/api/hub/marketing-campaigns/${campaignId}/publish`, {
      body: { platform: 'instagram', url: 'https://instagram.com/p/test', note: 'نشر يدوي', contentId },
    });
    assert.ok(pub.json.campaign.publications.length);
    pass('manual publish log');
  } catch (e) { fail('manual publish log', e); }

  try {
    const resu = await req('POST', `/api/hub/marketing-campaigns/${campaignId}/results`, {
      body: { platform: 'instagram', date: '2026-10-11', views: 1000, clicks: 80, leads: 12, sales: 200, spend: 50 },
    });
    assert.ok(resu.json.campaign.metrics.hasResults);
    pass('results + metrics');
  } catch (e) { fail('results + metrics', e); }

  try {
    await req('POST', `/api/hub/marketing-campaigns/${campaignId}/action`, { body: { action: 'complete' } });
    const rep = await req('POST', `/api/hub/marketing-campaigns/${campaignId}/report`, { body: {} });
    assert.ok(rep.json.campaign.report);
    const arch = await req('POST', `/api/hub/marketing-campaigns/${campaignId}/action`, { body: { action: 'archive' } });
    assert.equal(arch.json.campaign.status, 'archived');
    pass('complete report archive');
  } catch (e) { fail('complete report archive', e); }

  try {
    const act = await req('GET', `/api/hub/marketing-campaigns/activity?campaignId=${campaignId}`);
    const keys = (act.json.items || []).map((x) => x.action);
    assert.ok(keys.includes('created'));
    assert.ok(keys.includes('status'));
    pass('activity log', keys.slice(0, 8).join(','));
  } catch (e) { fail('activity log', e); }

  try {
    const bad = await req('POST', `/api/hub/marketing-campaigns/${campaignId}/action`, { body: { action: 'approve' } });
    assert.ok(bad.status >= 400);
    pass('illegal transition blocked', bad.status);
  } catch (e) { fail('illegal transition blocked', e); }

  const store = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'marketing-campaigns.json'), 'utf8'));
  const camp = store.campaigns.find((c) => c.id === campaignId);
  assert.ok(camp, 'campaign missing from store');
  const orphanContents = (camp.contents || []).filter((c) => !c.id.startsWith('CNT-'));
  assert.equal(orphanContents.length, 0);

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, campaignId, contentId, results }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
