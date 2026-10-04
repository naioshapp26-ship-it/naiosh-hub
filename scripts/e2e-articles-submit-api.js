/**
 * API + integrity tests for articles submit / review / publish.
 * Run: node scripts/e2e-articles-submit-api.js
 */
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

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

function req(method, urlPath, { email = 'leader@naiosh.com', role = 'supreme_leader', body, headers: extra, raw, type } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const payload = raw != null ? raw : body != null ? JSON.stringify(body) : null;
    const h = headers(email, role, extra);
    if (payload && !raw) h['Content-Type'] = type || 'application/json';
    if (raw) h['Content-Type'] = type || 'application/octet-stream';
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

function makeTinyMp4() {
  const dest = path.join(OUT, 'art-test.mp4');
  const { spawnSync } = require('child_process');
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-f', 'lavfi', '-i', 'color=c=red:s=64x64:d=0.2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dest],
    { encoding: 'utf8' }
  );
  if (r.status === 0 && fs.existsSync(dest)) return fs.readFileSync(dest);
  // Fallback: minimal ISO BMFF with ftyp+mdat (may not play, still a .mp4 payload)
  return Buffer.concat([
    Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0, 0x69, 0x73, 0x6f, 0x6d, 0x6d, 0x70, 0x34, 0x31]),
    Buffer.from([0, 0, 0, 8, 0x6d, 0x64, 0x61, 0x74]),
  ]);
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

  const client = { email: 'client-articles@naiosh.com', role: 'customer' };
  const other = { email: 'client-articles-other@naiosh.com', role: 'customer' };
  const staff = { email: 'leader@naiosh.com', role: 'supreme_leader' };
  const runKey = 'art-e2e-' + Date.now();
  let articleId = '';
  let requestId = '';
  let coverId = '';
  let videoId = '';

  try {
    const created = await req('POST', '/api/hub/articles', {
      ...client,
      body: {
        title: '',
        authorName: 'عميل المقالات',
        authorEmail: client.email,
      },
      headers: { 'Idempotency-Key': runKey + '-create' },
    });
    assert.strictEqual(created.status, 201, JSON.stringify(created.json));
    articleId = created.json.article.id;
    assert.ok(/^ART-\d{4}-\d{5}$/.test(articleId), articleId);
    assert.strictEqual(created.json.article.status, 'draft');
    pass('create draft', articleId);
  } catch (e) {
    fail('create draft', e);
  }

  try {
    const dup = await req('POST', '/api/hub/articles', {
      ...client,
      body: { title: 'أخرى' },
      headers: { 'Idempotency-Key': runKey + '-create' },
    });
    assert.ok(dup.status === 201 || dup.status === 200);
    assert.strictEqual(dup.json.article.id, articleId);
    pass('idempotent create', articleId);
  } catch (e) {
    fail('idempotent create', e);
  }

  try {
    const empty = await req('POST', '/api/hub/articles/' + articleId + '/action', {
      ...client,
      body: { action: 'submit' },
    });
    assert.strictEqual(empty.status, 400, JSON.stringify(empty.json));
    pass('submit without title/category', empty.json.error);
  } catch (e) {
    fail('submit without title/category', e);
  }

  try {
    const cover = await req('POST', '/api/hub/uploads', {
      ...client,
      raw: PNG,
      type: 'image/png',
      headers: { 'X-File-Name': encodeURIComponent('cover-test.png'), 'X-File-Type': 'image/png' },
    });
    assert.ok(cover.status === 201 || cover.status === 200, JSON.stringify(cover.json));
    assert.ok(cover.json.url);
    coverId = cover.json.id;
    pass('upload cover', cover.json.url);
  } catch (e) {
    fail('upload cover', e);
  }

  try {
    const mp4 = makeTinyMp4();
    const video = await req('POST', '/api/hub/uploads', {
      ...client,
      raw: mp4,
      type: 'video/mp4',
      headers: { 'X-File-Name': encodeURIComponent('article-test.mp4'), 'X-File-Type': 'video/mp4' },
    });
    assert.ok(video.status === 201 || video.status === 200, JSON.stringify(video.json));
    assert.ok(video.json.url);
    videoId = video.json.id;
    pass('upload video', video.json.url);
  } catch (e) {
    fail('upload video', e);
  }

  try {
    const badImg = await req('PUT', '/api/hub/articles/' + articleId, {
      ...client,
      body: { coverImage: { name: 'virus.exe', mime: 'application/x-msdownload', url: '/uploads/x.exe', status: 'ok' } },
    });
    assert.strictEqual(badImg.status, 400, JSON.stringify(badImg.json));
    pass('reject unsupported image', badImg.json.error);
  } catch (e) {
    fail('reject unsupported image', e);
  }

  try {
    const badVid = await req('PUT', '/api/hub/articles/' + articleId, {
      ...client,
      body: { video: { name: 'clip.txt', mime: 'text/plain', url: '/uploads/x.txt', status: 'ok' } },
    });
    assert.strictEqual(badVid.status, 400, JSON.stringify(badVid.json));
    pass('reject unsupported video', badVid.json.error);
  } catch (e) {
    fail('reject unsupported video', e);
  }

  try {
    const patched = await req('PUT', '/api/hub/articles/' + articleId, {
      ...client,
      body: {
        title: 'مقال تجريبي E2E لمسار الموافقات',
        category: 'تشغيل',
        summary: 'نبذة مختصرة لاختبار مسار المقال من العميل إلى مكتب المحتوى.',
        body: 'سطر محتوى تجريبي واحد يكفي للإرسال.',
        authorName: 'عميل المقالات',
        company: 'نايوش للاختبار',
        coverImage: {
          id: coverId,
          name: 'cover-test.png',
          mime: 'image/png',
          size: PNG.length,
          url: '/uploads/' + coverId,
          status: 'ok',
        },
        video: {
          id: videoId,
          name: 'article-test.mp4',
          mime: 'video/mp4',
          url: '/uploads/' + videoId,
          status: 'ok',
        },
      },
    });
    assert.strictEqual(patched.status, 200, JSON.stringify(patched.json));
    pass('save article fields+media', patched.json.article.title);
  } catch (e) {
    fail('save article fields+media', e);
  }

  try {
    const submitted = await req('POST', '/api/hub/articles/' + articleId + '/action', {
      ...client,
      body: { action: 'submit' },
      headers: { 'Idempotency-Key': runKey + '-submit' },
    });
    assert.strictEqual(submitted.status, 200, JSON.stringify(submitted.json));
    assert.strictEqual(submitted.json.article.status, 'pending_review');
    requestId = submitted.json.article.requestId || submitted.json.request.requestId;
    assert.ok(/^ART-REQ-\d{4}-\d{5}$/.test(requestId), requestId);
    pass('submit for review', requestId);
  } catch (e) {
    fail('submit for review', e);
  }

  try {
    const dupSub = await req('POST', '/api/hub/articles/' + articleId + '/action', {
      ...client,
      body: { action: 'submit' },
      headers: { 'Idempotency-Key': runKey + '-submit' },
    });
    assert.ok(dupSub.status === 200);
    assert.strictEqual(dupSub.json.article.id, articleId);
    assert.strictEqual(dupSub.json.article.requestId, requestId);
    pass('double submit same request', requestId);
  } catch (e) {
    fail('double submit same request', e);
  }

  try {
    const inbox = await req('GET', '/api/hub/articles/requests', staff);
    assert.strictEqual(inbox.status, 200, JSON.stringify(inbox.json));
    const hit = (inbox.json.items || []).find((r) => r.requestId === requestId || r.articleId === articleId);
    assert.ok(hit, 'request missing in content desk inbox');
    assert.strictEqual(hit.sourceModule, 'المقالات');
    assert.ok(hit.articleSnapshot && hit.articleSnapshot.coverImage);
    assert.ok(hit.articleSnapshot.video);
    pass('admin content inbox', hit.requestId + ' · ' + hit.articleId);
  } catch (e) {
    fail('admin content inbox', e);
  }

  try {
    const denied = await req('GET', '/api/hub/articles/requests', client);
    assert.ok(denied.status === 403 || denied.status === 401);
    pass('customer denied admin requests', denied.status);
  } catch (e) {
    fail('customer denied admin requests', e);
  }

  try {
    const peek = await req('GET', '/api/hub/articles/' + articleId, other);
    assert.ok(peek.status === 403 || peek.status === 404, JSON.stringify(peek.json));
    pass('other customer cannot open article', peek.status);
  } catch (e) {
    fail('other customer cannot open article', e);
  }

  try {
    const fake = await req('POST', '/api/hub/articles/' + articleId + '/action', {
      ...other,
      body: { action: 'publish' },
    });
    assert.ok(fake.status === 403 || fake.status === 401, fake.status);
    pass('other customer cannot publish', fake.status);
  } catch (e) {
    fail('other customer cannot publish', e);
  }

  try {
    const noNote = await req('POST', '/api/hub/articles/' + articleId + '/action', {
      ...staff,
      body: { action: 'request_changes' },
    });
    assert.strictEqual(noNote.status, 400);
    pass('request changes requires reason', noNote.json.error);
  } catch (e) {
    fail('request changes requires reason', e);
  }

  try {
    const chg = await req('POST', '/api/hub/articles/' + articleId + '/action', {
      ...staff,
      body: { action: 'request_changes', note: 'أضف مثالاً تشغيلياً أوضح' },
    });
    assert.strictEqual(chg.status, 200, JSON.stringify(chg.json));
    assert.strictEqual(chg.json.article.status, 'needs_changes');
    pass('request changes', chg.json.article.changeRequestNote);
  } catch (e) {
    fail('request changes', e);
  }

  try {
    const seen = await req('GET', '/api/hub/articles/' + articleId, client);
    assert.strictEqual(seen.json.article.status, 'needs_changes');
    assert.ok(seen.json.article.changeRequestNote.includes('تشغيلي'));
    assert.ok(seen.json.article.coverImage && seen.json.article.coverImage.url);
    assert.ok(seen.json.article.video && seen.json.article.video.url);
    pass('customer sees change reason + media kept', seen.json.article.changeRequestNote);
  } catch (e) {
    fail('customer sees change reason + media kept', e);
  }

  try {
    await req('PUT', '/api/hub/articles/' + articleId, {
      ...client,
      body: { body: 'سطر محتوى تجريبي واحد يكفي للإرسال.\nبعد التعديل.' },
    });
    const resub = await req('POST', '/api/hub/articles/' + articleId + '/action', {
      ...client,
      body: { action: 'submit' },
      headers: { 'Idempotency-Key': runKey + '-resubmit' },
    });
    assert.strictEqual(resub.json.article.status, 'pending_review');
    assert.strictEqual(resub.json.article.requestId, requestId);
    pass('resubmit same request id', requestId);
  } catch (e) {
    fail('resubmit', e);
  }

  try {
    const appr = await req('POST', '/api/hub/articles/' + articleId + '/action', {
      ...staff,
      body: { action: 'publish' },
    });
    assert.strictEqual(appr.status, 200, JSON.stringify(appr.json));
    assert.strictEqual(appr.json.article.status, 'published');
    pass('approve+publish', appr.json.article.status);
  } catch (e) {
    fail('approve+publish', e);
  }

  try {
    const pub = await req('GET', '/api/hub/articles/public');
    const hit = (pub.json.items || []).find((a) => a.id === articleId);
    assert.ok(hit, 'published article missing from public list');
    pass('public catalog', hit.id);
  } catch (e) {
    fail('public catalog', e);
  }

  try {
    const clientView = await req('GET', '/api/hub/articles/' + articleId, client);
    assert.strictEqual(clientView.json.article.status, 'published');
    pass('customer status published', clientView.json.article.status);
  } catch (e) {
    fail('customer status published', e);
  }

  const report = { articleId, requestId, coverId, videoId, results };
  fs.writeFileSync(path.join(OUT, 'articles-api-e2e.json'), JSON.stringify(report, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log('\nSUMMARY', results.length - failed.length + '/' + results.length, 'articleId=' + articleId, 'requestId=' + requestId);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
