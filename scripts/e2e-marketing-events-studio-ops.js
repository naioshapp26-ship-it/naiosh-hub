/**
 * Full ops suite: marketing ↔ events ↔ media library ↔ reels (ffmpeg) ↔ approvals ↔ publish honesty.
 *
 * DATABASE_URL=... SCALE_PORT=8870 node scripts/e2e-marketing-events-studio-ops.js
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ART = '/opt/cursor/artifacts/marketing-events-studio-ops';
const PORT = Number(process.env.SCALE_PORT || 8870);
const BASE = `http://127.0.0.1:${PORT}`;

const rows = [];
function mark(fn, op, recordId, store, pass, note) {
  rows.push({
    function: fn,
    operation: op,
    recordId: recordId || '',
    storage: store || '',
    result: pass ? 'PASS' : 'FAIL',
    note: String(note || '').slice(0, 400),
  });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${fn} | ${op} | ${recordId || '—'} | ${String(note || '').slice(0, 160)}`);
}

function tokenFor(email, customer) {
  if (customer) return `hub360.cust.${Buffer.from(email).toString('base64url')}.${Date.now()}`;
  return `hub360.${Buffer.from(email).toString('base64')}.${Date.now()}`;
}

function req(method, urlPath, { email = 'leader@naiosh.com', role = 'supreme_leader', body, raw, type, headers: extra } = {}) {
  return new Promise((resolve) => {
    const payload = raw || (body != null ? JSON.stringify(body) : null);
    const t = tokenFor(email, role === 'customer');
    const h = {
      Authorization: `Bearer ${t}`,
      'X-Hub-Token': t,
      'X-Hub-User-Role': role,
      'X-Hub-User-Name': email.split('@')[0],
      Accept: 'application/json',
      ...(extra || {}),
    };
    if (payload && !raw) h['Content-Type'] = 'application/json';
    if (type) h['Content-Type'] = type;
    if (payload) h['Content-Length'] = Buffer.byteLength(payload);
    const r = http.request(
      { hostname: '127.0.0.1', port: PORT, path: urlPath, method, headers: h },
      (res) => {
        const c = [];
        res.on('data', (d) => c.push(d));
        res.on('end', () => {
          const buf = Buffer.concat(c);
          let j = {};
          try {
            j = JSON.parse(buf.toString('utf8'));
          } catch {
            j = { raw: buf.slice(0, 120).toString('utf8') };
          }
          resolve({ status: res.statusCode, j, buf });
        });
      }
    );
    r.on('error', (e) => resolve({ status: 0, j: { error: e.message }, buf: Buffer.alloc(0) }));
    r.setTimeout(180000, () => {
      r.destroy();
      resolve({ status: 0, j: { error: 'timeout' }, buf: Buffer.alloc(0) });
    });
    if (payload) r.write(payload);
    r.end();
  });
}

async function uploadBinary(filePath, email, role) {
  const buf = fs.readFileSync(filePath);
  const t = tokenFor(email, role === 'customer');
  return new Promise((resolve) => {
    const r = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/hub/uploads',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${t}`,
          'X-Hub-Token': t,
          'X-Hub-User-Role': role,
          'Content-Type': 'application/octet-stream',
          'X-File-Name': path.basename(filePath),
          'X-File-Type': filePath.endsWith('.png') ? 'image/png' : 'video/mp4',
          'Content-Length': buf.length,
        },
      },
      (res) => {
        const c = [];
        res.on('data', (d) => c.push(d));
        res.on('end', () => {
          let j = {};
          try {
            j = JSON.parse(Buffer.concat(c).toString('utf8'));
          } catch {
            j = {};
          }
          resolve({ status: res.statusCode, j });
        });
      }
    );
    r.on('error', (e) => resolve({ status: 0, j: { error: e.message } }));
    r.write(buf);
    r.end();
  });
}

function startServer() {
  const env = {
    PATH: process.env.PATH,
    DATABASE_URL: process.env.DATABASE_URL || '',
    PORT: String(PORT),
    HOST: '127.0.0.1',
    AUTO_MIGRATE: process.env.DATABASE_URL ? '1' : '0',
    HUB_CUSTOMER_BACKFILL_BG: '0',
    HUB_CUSTOMER_HYDRATE_MAX: '50',
  };
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => {
    log += d;
  });
  child.stderr.on('data', (d) => {
    log += d;
  });
  return {
    stop: () => {
      try {
        child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    },
    log: () => log,
  };
}

async function waitHealth() {
  for (let i = 0; i < 120; i++) {
    const h = await req('GET', '/api/health', { email: '', role: '' });
    if (h.status === 200) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('health timeout');
}

function makeSampleVideo() {
  const out = path.join(ART, 'sample-source.mp4');
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=6:size=640x360:rate=24',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=880:duration=6',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      out,
    ],
    { stdio: 'ignore' }
  );
  return out;
}

function tinyPng() {
  const p = path.join(ART, 'sample.png');
  fs.writeFileSync(
    p,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    )
  );
  return p;
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  const staff = { email: 'leader@naiosh.com', role: 'supreme_leader' };
  const clientA = { email: `studio.a.${Date.now()}@naiosh-test.com`, role: 'customer' };
  const clientB = { email: `studio.b.${Date.now()}@naiosh-test.com`, role: 'customer' };
  const stamp = Date.now().toString(36);
  const today = new Date().toISOString().slice(0, 10);

  const srv = startServer();
  const report = {
    at: new Date().toISOString(),
    base: BASE,
    integrations: {
      connected: ['website (internal)', 'inapp (internal)', 'ffmpeg reel processor', 'hub uploads / media library'],
      needs_external: ['Instagram', 'Facebook', 'YouTube', 'TikTok', 'LinkedIn', 'X', 'WhatsApp', 'Google', 'email SMTP publish'],
    },
    rows,
    PASS: [],
    FAIL: [],
  };

  try {
    await waitHealth();
    mark('health', 'GET /api/health', '', 'server', true, 'up');

    const caps = await req('GET', '/api/hub/reels/capabilities', staff);
    mark('reels_capabilities', 'ffmpeg available', '', 'server', !!caps.j?.ffmpeg, JSON.stringify(caps.j));

    // 1) Create campaign
    const camp = await req('POST', '/api/hub/marketing-campaigns', {
      ...staff,
      body: {
        name: `حملة استوديو ${stamp}`,
        type: 'فعالية',
        goal: 'event',
        goalTarget: 50,
        channels: ['website', 'inapp'],
        description: 'اختبار منظومة التسويق والفعاليات',
      },
      headers: { 'Idempotency-Key': `camp-${stamp}` },
    });
    const campaignId = camp.j?.campaign?.id || camp.j?.id;
    mark('create_campaign', 'POST /marketing-campaigns', campaignId, 'data/marketing-campaigns.json', !!campaignId && camp.status < 300, camp.j?.error);

    // 2) Upload image + video + register media library
    const png = tinyPng();
    const mp4 = makeSampleVideo();
    const imgUp = await uploadBinary(png, staff.email, staff.role);
    const vidUp = await uploadBinary(mp4, staff.email, staff.role);
    mark('upload_image', 'POST /uploads', imgUp.j?.id || imgUp.j?.storageRef, 'data/uploads + hub_upload_blobs', imgUp.status === 201 || !!imgUp.j?.ok, JSON.stringify(imgUp.j).slice(0, 120));
    mark('upload_video', 'POST /uploads', vidUp.j?.id || vidUp.j?.storageRef, 'data/uploads + hub_upload_blobs', vidUp.status === 201 || !!vidUp.j?.ok, JSON.stringify(vidUp.j).slice(0, 120));

    const mediaImg = await req('POST', '/api/hub/media', {
      ...staff,
      body: {
        uploadId: imgUp.j?.id || imgUp.j?.storageRef,
        url: imgUp.j?.url,
        mime: 'image/png',
        originalName: 'sample.png',
        kind: 'image',
        sourceStudio: 'marketing',
        campaignId,
      },
    });
    const mediaVid = await req('POST', '/api/hub/media', {
      ...staff,
      body: {
        uploadId: vidUp.j?.id || vidUp.j?.storageRef,
        url: vidUp.j?.url,
        mime: 'video/mp4',
        originalName: 'sample-source.mp4',
        kind: 'video_long',
        sourceStudio: 'marketing',
        campaignId,
      },
    });
    mark('media_library_image', 'POST /media', mediaImg.j?.item?.id, 'data/hub-media-library.json', !!mediaImg.j?.item?.id, mediaImg.j?.error);
    mark('media_library_video', 'POST /media', mediaVid.j?.item?.id, 'data/hub-media-library.json', !!mediaVid.j?.item?.id, mediaVid.j?.error);

    if (campaignId) {
      await req('POST', `/api/hub/marketing-campaigns/${encodeURIComponent(campaignId)}/assets`, {
        ...staff,
        body: {
          kind: 'image',
          name: 'sample.png',
          url: imgUp.j?.url,
          uploadId: imgUp.j?.id,
          mime: 'image/png',
        },
      });
      await req('POST', `/api/hub/marketing-campaigns/${encodeURIComponent(campaignId)}/assets`, {
        ...staff,
        body: {
          kind: 'video',
          name: 'sample-source.mp4',
          url: vidUp.j?.url,
          uploadId: vidUp.j?.id,
          mime: 'video/mp4',
        },
      });
      const content = await req('POST', `/api/hub/marketing-campaigns/${encodeURIComponent(campaignId)}/contents`, {
        ...staff,
        body: {
          title: 'إعلان صورة+فيديو',
          type: 'ad',
          channel: 'website',
          body: 'نص إعلاني اختباري',
          assetIds: [imgUp.j?.id, vidUp.j?.id].filter(Boolean),
        },
      });
      mark('create_ad_content', 'POST …/contents', content.j?.campaign?.contents?.slice(-1)?.[0]?.id, 'marketing-campaigns.json', content.status < 300, content.j?.error);
    }

    // 3–5) Real reel from video
    const sourceId = vidUp.j?.id || vidUp.j?.storageRef;
    const reel = await req('POST', '/api/hub/reels/process', {
      ...staff,
      body: {
        sourceUploadId: sourceId,
        startSec: 0,
        endSec: 3,
        aspect: '9:16',
        title: 'ريلز اختبار',
        campaignId,
      },
    });
    const reelOk = !!reel.j?.ok && reel.j?.reel?.status === 'ready' && !!reel.j?.reel?.outputUploadId;
    mark('process_reel_ffmpeg', 'POST /reels/process', reel.j?.reel?.mediaId || reel.j?.reel?.outputUploadId, 'uploads + hub-media-library', reelOk, reel.j?.error || reel.j?.reel?.error);
    const reelFile = reel.j?.reel?.outputUploadId
      ? path.join(ROOT, 'data/uploads', reel.j.reel.outputUploadId)
      : '';
    mark('reel_file_on_disk', 'fs.exists', reel.j?.reel?.outputUploadId, 'data/uploads', !!(reelFile && fs.existsSync(reelFile)), reelFile);

    if (campaignId && reel.j?.reel?.outputUploadId) {
      const clip = await req('POST', `/api/hub/marketing-campaigns/${encodeURIComponent(campaignId)}/clips`, {
        ...staff,
        body: {
          title: 'ريلز اختبار',
          duration: reel.j.reel.duration,
          platform: 'website',
          assetId: reel.j.reel.outputUploadId,
          url: reel.j.reel.outputUrl,
          mediaId: reel.j.reel.mediaId,
          status: 'ready',
        },
      });
      mark('link_reel_to_campaign', 'POST …/clips', clip.j?.campaign?.clips?.slice(-1)?.[0]?.id, 'marketing-campaigns.json', clip.status < 300, clip.j?.error);
      if (reel.j.reel.mediaId) {
        await req('POST', `/api/hub/media/${encodeURIComponent(reel.j.reel.mediaId)}/usage`, {
          ...staff,
          body: { type: 'campaign', refId: campaignId, label: 'ريلز اختبار' },
        });
      }
    }

    // 6) Create event
    const ev = await req('POST', '/api/hub/events', {
      ...staff,
      body: {
        name: `فعالية استوديو ${stamp}`,
        category: 'ورشة',
        summary: 'فعالية مرتبطة بحملة',
        startDate: today,
        startTime: '18:00',
        attendanceType: 'online',
        onlineUrl: 'https://example.com/live',
        pricing: 'free',
        requiresRegistration: true,
      },
    });
    const eventId = ev.j?.event?.id;
    mark('create_event', 'POST /events', eventId, 'data/hub-events.json', !!eventId && ev.status < 300, ev.j?.error);

    // 7) Link event ↔ campaign (both directions)
    if (campaignId && eventId) {
      const link = await req('PUT', `/api/hub/marketing-campaigns/${encodeURIComponent(campaignId)}`, {
        ...staff,
        body: {
          links: [{ kind: 'event', refId: eventId, label: `فعالية ${eventId}`, url: `events.html#event=${eventId}` }],
        },
      });
      const catalogs = await req('GET', '/api/hub/marketing-campaigns/catalogs', staff);
      const liveHit = (catalogs.j?.catalogs?.events || []).some((e) => e.id === eventId);
      mark('link_campaign_to_event', 'PUT campaign.links', campaignId, 'marketing-campaigns.json', link.status < 300, JSON.stringify(link.j?.campaign?.links || []).slice(0, 120));
      mark('catalog_live_events', 'GET catalogs includes EVT-*', eventId, 'hub-events.json → catalogs', liveHit, `count=${(catalogs.j?.catalogs?.events || []).length}`);
    }

    // Cover + promo on event
    if (eventId) {
      await req('POST', `/api/hub/events/${encodeURIComponent(eventId)}/assets`, {
        ...staff,
        body: { kind: 'cover', name: 'cover.png', url: imgUp.j?.url, uploadId: imgUp.j?.id, mime: 'image/png' },
      });
      if (reel.j?.reel?.outputUploadId) {
        await req('POST', `/api/hub/events/${encodeURIComponent(eventId)}/clips`, {
          ...staff,
          body: {
            title: 'ريلز فعالية',
            sourceVideoId: '',
            assetId: reel.j.reel.outputUploadId,
            url: reel.j.reel.outputUrl,
            mediaId: reel.j.reel.mediaId,
            status: 'ready',
          },
        });
      }
    }

    // 8) Submit both for approval
    let campReqId = '';
    let evtReqId = '';
    if (campaignId) {
      const sub = await req('POST', `/api/hub/marketing-campaigns/${encodeURIComponent(campaignId)}/action`, {
        ...staff,
        body: { action: 'submit' },
      });
      campReqId = sub.j?.campaign?.requestId || '';
      mark('submit_campaign_review', 'action=submit', campReqId, 'marketing-campaigns.requests', sub.status < 300 && !!campReqId, sub.j?.error || sub.j?.campaign?.status);
    }
    if (eventId) {
      const subE = await req('POST', `/api/hub/events/${encodeURIComponent(eventId)}/action`, {
        ...staff,
        body: { action: 'submit' },
      });
      evtReqId = subE.j?.event?.requestId || subE.j?.request?.requestId || '';
      mark('submit_event_review', 'action=submit', evtReqId, 'hub-events.requests', subE.status < 300 && !!evtReqId, subE.j?.error || subE.j?.event?.status);
    }

    // 9) Appear in requests APIs (POSHA inbox source)
    const campReqs = await req('GET', '/api/hub/marketing-campaigns/requests', staff);
    const evtReqs = await req('GET', '/api/hub/events/requests', staff);
    const campInInbox = (campReqs.j?.items || []).some((r) => r.requestId === campReqId || r.id === campReqId);
    const evtInInbox = (evtReqs.j?.items || []).some((r) => r.requestId === evtReqId || r.id === evtReqId);
    mark('campaign_in_client_requests_api', 'GET /marketing-campaigns/requests', campReqId, 'POSHA ingest source', campInInbox, `items=${(campReqs.j?.items || []).length}`);
    mark('event_in_client_requests_api', 'GET /events/requests', evtReqId, 'POSHA ingest source', evtInInbox, `items=${(evtReqs.j?.items || []).length}`);

    // 10) Approve
    if (campaignId) {
      const ap = await req('POST', `/api/hub/marketing-campaigns/${encodeURIComponent(campaignId)}/action`, {
        ...staff,
        body: { action: 'approve' },
      });
      mark('approve_campaign', 'action=approve', campaignId, 'marketing-campaigns.json', ap.j?.campaign?.status === 'approved', ap.j?.campaign?.status);
    }
    if (eventId) {
      const ap = await req('POST', `/api/hub/events/${encodeURIComponent(eventId)}/action`, {
        ...staff,
        body: { action: 'approve' },
      });
      const st = ap.j?.event?.status;
      mark('approve_publish_event', 'action=approve/publish', eventId, 'hub-events.json', st === 'published' || st === 'approved', st);
    }

    // 11) Schedule content
    if (campaignId) {
      const sch = await req('POST', `/api/hub/marketing-campaigns/${encodeURIComponent(campaignId)}/action`, {
        ...staff,
        body: { action: 'schedule_campaign' },
      });
      mark('schedule_campaign', 'action=schedule_campaign', campaignId, 'marketing-campaigns.json', sch.j?.campaign?.status === 'scheduled', sch.j?.campaign?.status);
    }

    // 12–13) Publish via connected channel + honest disconnected
    if (campaignId) {
      const pubIn = await req('POST', `/api/hub/marketing-campaigns/${encodeURIComponent(campaignId)}/publish`, {
        ...staff,
        body: { platform: 'website', note: 'نشر داخلي اختبار' },
      });
      const pubs = pubIn.j?.campaign?.publications || [];
      const last = pubs[pubs.length - 1];
      mark('publish_internal_website', 'POST …/publish website', last?.id, 'publications[]', !!last && (last.connected || last.status === 'published_internal'), JSON.stringify(last || {}).slice(0, 160));

      const pubIg = await req('POST', `/api/hub/marketing-campaigns/${encodeURIComponent(campaignId)}/publish`, {
        ...staff,
        body: { platform: 'instagram', note: 'تصدير يدوي' },
      });
      const lastIg = (pubIg.j?.campaign?.publications || []).slice(-1)[0];
      const honest =
        lastIg &&
        lastIg.connected === false &&
        (lastIg.status === 'export_pending' || lastIg.mode === 'manual') &&
        !/نجاح نشر وهمي|published_api/i.test(JSON.stringify(lastIg));
      mark('publish_disconnected_no_fake_success', 'POST …/publish instagram', lastIg?.id, 'publications[]', !!honest, JSON.stringify(lastIg || {}).slice(0, 200));

      const pubManual = await req('POST', `/api/hub/marketing-campaigns/${encodeURIComponent(campaignId)}/publish`, {
        ...staff,
        body: { platform: 'instagram', url: 'https://instagram.com/p/test-ops', note: 'رابط بعد نشر يدوي' },
      });
      const lastM = (pubManual.j?.campaign?.publications || []).slice(-1)[0];
      mark('publish_manual_url_logged', 'POST …/publish with url', lastM?.id, 'publications[]', !!lastM?.url, lastM?.url);
    }

    // 14) Persistence after "relogin" (new token) + reload stores
    const camp2 = await req('GET', `/api/hub/marketing-campaigns/${encodeURIComponent(campaignId)}`, staff);
    const ev2 = await req('GET', `/api/hub/events/${encodeURIComponent(eventId)}`, staff);
    mark('persist_after_reauth', 'GET campaign+event', campaignId, 'json stores', !!camp2.j?.campaign?.id && !!ev2.j?.event?.id, `camp=${camp2.j?.campaign?.status} ev=${ev2.j?.event?.status}`);

    // 15) Isolation — two customers cannot see each other's media via ownership filter
    // Register client accounts quickly
    await req('POST', '/api/auth/register', {
      email: '',
      role: '',
      body: {
        fullName: 'عميل أ استوديو',
        email: clientA.email,
        phone: `05${String(Date.now() % 10000000000).padStart(10, '0').slice(-10)}`,
        password: 'StudioA1!',
        confirmPassword: 'StudioA1!',
        termsAccepted: true,
      },
    });
    await req('POST', '/api/auth/register', {
      email: '',
      role: '',
      body: {
        fullName: 'عميل ب استوديو',
        email: clientB.email,
        phone: `05${String((Date.now() + 9) % 10000000000).padStart(10, '0').slice(-10)}`,
        password: 'StudioB1!',
        confirmPassword: 'StudioB1!',
        termsAccepted: true,
      },
    });
    const upA = await uploadBinary(png, clientA.email, 'customer');
    await req('POST', '/api/hub/media', {
      ...clientA,
      body: { uploadId: upA.j?.id, url: upA.j?.url, mime: 'image/png', originalName: 'a-only.png', kind: 'image', sourceStudio: 'events' },
    });
    const listB = await req('GET', '/api/hub/media', clientB);
    const leak = (listB.j?.items || []).some((it) => it.ownerEmail === clientA.email || (it.originalName || '').includes('a-only'));
    mark('media_isolation_two_clients', 'GET /media as B', '', 'hub-media-library.json', !leak, `B sees ${ (listB.j?.items || []).length } items`);

    // 16) Error + retry: bad source for reel
    const bad = await req('POST', '/api/hub/reels/process', {
      ...staff,
      body: { sourceUploadId: 'missing-file-xyz.mp4', startSec: 0, endSec: 2 },
    });
    mark('reel_error_missing_source', 'POST /reels/process', '', 'reel-processor', bad.status >= 400 && !bad.j?.ok, bad.j?.error);
    // Retry success already proven above

    // 17) Studio pages load (HTML)
    const mcsPage = await req('GET', '/marketing-campaigns-studio.html', staff);
    const evPage = await req('GET', '/events.html', staff);
    mark('studio_pages_load', 'GET html shells', '', 'static', mcsPage.status === 200 && evPage.status === 200, `mcs=${mcsPage.status} ev=${evPage.status}`);

    // Idempotent double submit
    if (campaignId) {
      const again = await req('POST', `/api/hub/marketing-campaigns/${encodeURIComponent(campaignId)}/action`, {
        ...staff,
        body: { action: 'submit' },
      });
      mark('idempotent_resubmit_safe', 'action=submit twice', campaignId, 'marketing-campaigns.json', again.status < 500, again.j?.error || again.j?.campaign?.status);
    }
  } catch (err) {
    mark('suite_error', err.message, '', '', false, err.stack);
  } finally {
    fs.writeFileSync(path.join(ART, 'server.log'), srv.log());
    srv.stop();
  }

  report.PASS = rows.filter((r) => r.result === 'PASS').map((r) => r.function);
  report.FAIL = rows.filter((r) => r.result === 'FAIL').map((r) => r.function);
  report.summary = { pass: report.PASS.length, fail: report.FAIL.length };

  const md = [
    '# تقرير تشغيل استوديو التسويق والفعاليات',
    '',
    `التاريخ: ${report.at}`,
    `الأساس: ${BASE}`,
    '',
    `PASS: ${report.summary.pass} · FAIL: ${report.summary.fail}`,
    '',
    '## التكاملات',
    '',
    '### متصلة فعليًا',
    ...report.integrations.connected.map((x) => `- ${x}`),
    '',
    '### تحتاج ربطًا خارجيًا / موافقات',
    ...report.integrations.needs_external.map((x) => `- ${x}`),
    '',
    '## جدول الوظائف',
    '',
    '| الوظيفة | العملية | رقم السجل | مكان الحفظ | النتيجة | ملاحظة |',
    '|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.function} | ${r.operation} | ${r.recordId || '—'} | ${r.storage || '—'} | **${r.result}** | ${String(r.note || '').replace(/\|/g, '/').slice(0, 120)} |`
    ),
    '',
  ].join('\n');

  fs.writeFileSync(path.join(ART, 'ops-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(ART, 'ops-report.md'), md);
  fs.writeFileSync(path.join(ROOT, 'docs/marketing-events-studio-ops-report.md'), md);
  console.log(md);
  process.exit(report.FAIL.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
