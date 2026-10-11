/**
 * Server-side short-clip / reel processor using ffmpeg.
 * Cuts a source video, optional text overlay + cover frame, saves output via hub-uploads + media library.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const JOBS_DIR = path.join(__dirname, '..', 'data', 'reel-jobs');
const OUT_DIR = path.join(__dirname, '..', 'data', 'uploads');

const jobs = new Map(); // in-memory progress for polling

function nowIso() {
  return new Date().toISOString();
}

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function ensureDirs() {
  for (const d of [JOBS_DIR, OUT_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

function ffmpegAvailable() {
  try {
    const { execFileSync } = require('child_process');
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function resolveSourcePath(uploadIdOrPath) {
  const hubUploads = require('./hub-uploads');
  const id = String(uploadIdOrPath || '').replace(/^\/uploads\//, '').trim();
  if (!id) return null;
  const p = hubUploads.resolveUploadPath?.(id);
  if (p && fs.existsSync(p)) return p;
  // Nested / alternate refs
  const alt = path.join(OUT_DIR, id);
  if (fs.existsSync(alt)) return alt;
  return null;
}

function runFfmpeg(args, onProgress) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let err = '';
    child.stderr.on('data', (d) => {
      err += d.toString();
      if (onProgress) onProgress(String(d));
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve({ ok: true });
      else reject(new Error(err.trim() || `ffmpeg exit ${code}`));
    });
  });
}

function escapeDrawtext(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .slice(0, 80);
}

/**
 * Process a reel cut job.
 * @returns {{ jobId, status, outputUploadId?, outputUrl?, mediaId?, error? }}
 */
async function processReel({
  sourceUploadId,
  startSec = 0,
  endSec = 15,
  aspect = '9:16',
  title = '',
  coverAtSec = null,
  ownerEmail = '',
  campaignId = '',
  eventId = '',
  session = null,
}) {
  if (!ffmpegAvailable()) fail(503, 'معالج الفيديو (ffmpeg) غير متاح على الخادم');
  const src = resolveSourcePath(sourceUploadId);
  if (!src) fail(404, 'ملف المصدر غير موجود على القرص — ارفع الفيديو أولاً');

  const start = Math.max(0, Number(startSec) || 0);
  let end = Number(endSec);
  if (!Number.isFinite(end) || end <= start) end = start + 15;
  const duration = Math.min(90, Math.max(1, end - start)); // cap 90s short clip

  const jobId = `REELJOB-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  ensureDirs();
  const outName = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}.mp4`;
  const outPath = path.join(OUT_DIR, outName);
  const coverName = outName.replace(/\.mp4$/i, '-cover.jpg');
  const coverPath = path.join(OUT_DIR, coverName);

  const job = {
    id: jobId,
    status: 'processing',
    progress: 5,
    sourceUploadId,
    start,
    end,
    duration,
    title,
    aspect,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    error: '',
    outputUploadId: '',
    outputUrl: '',
    coverUrl: '',
    mediaId: '',
  };
  jobs.set(jobId, job);

  try {
    // Scale/crop for aspect
    let vf = 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';
    if (aspect === '1:1') vf = 'scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080';
    if (aspect === '16:9') vf = 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720';
    if (title) {
      vf += `,drawtext=text='${escapeDrawtext(title)}':fontcolor=white:fontsize=42:borderw=2:bordercolor=black:x=(w-text_w)/2:y=h*0.12`;
    }

    job.progress = 20;
    job.updatedAt = nowIso();
    await runFfmpeg([
      '-ss',
      String(start),
      '-i',
      src,
      '-t',
      String(duration),
      '-vf',
      vf,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      outPath,
    ]);

    job.progress = 70;
    const coverTime = coverAtSec != null ? Number(coverAtSec) : start + Math.min(1, duration / 2);
    try {
      await runFfmpeg(['-ss', String(coverTime), '-i', outPath, '-frames:v', '1', '-q:v', '3', coverPath]);
      job.coverUrl = `/uploads/${coverName}`;
    } catch {
      job.coverUrl = '';
    }

    job.progress = 85;
    // Persist blob to DB when available
    try {
      const hubUploads = require('./hub-uploads');
      const buf = fs.readFileSync(outPath);
      await hubUploads.persistBlobToDb({
        storageRef: outName,
        mime: 'video/mp4',
        originalName: title ? `${title}.mp4` : outName,
        ownerEmail,
        buffer: buf,
      });
    } catch {
      /* disk remains source of truth */
    }

    job.outputUploadId = outName;
    job.outputUrl = `/uploads/${outName}`;

    // Register in unified media library
    try {
      const mediaLib = require('./hub-media-library');
      const store = mediaLib.readStore();
      const reg = mediaLib.registerItem(
        store,
        {
          uploadId: outName,
          url: job.outputUrl,
          mime: 'video/mp4',
          originalName: title || outName,
          kind: 'reel',
          status: 'ready',
          durationSec: duration,
          coverUrl: job.coverUrl,
          sourceStudio: 'reel',
          campaignId,
          eventId,
          sizeBytes: fs.statSync(outPath).size,
        },
        session || { email: ownerEmail, name: ownerEmail },
        null
      );
      if (campaignId) mediaLib.attachUsage(store, reg.item.id, { type: 'campaign', refId: campaignId, label: title });
      if (eventId) mediaLib.attachUsage(store, reg.item.id, { type: 'event', refId: eventId, label: title });
      mediaLib.writeStore(store);
      job.mediaId = reg.item.id;
    } catch (err) {
      console.warn('[hub-reel-processor] media library:', err.message);
    }

    job.status = 'ready';
    job.progress = 100;
    job.updatedAt = nowIso();
    return { ...job };
  } catch (err) {
    job.status = 'failed';
    job.error = err.message || String(err);
    job.updatedAt = nowIso();
    try {
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    } catch {
      /* ignore */
    }
    throw Object.assign(new Error(job.error), { status: 500, job });
  }
}

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

async function handleApi(req, res, pathname, { sendJson, readBody, requireAuth }) {
  const session = await requireAuth(req, res);
  if (!session) return true;

  try {
    if (pathname === '/api/hub/reels/capabilities' && req.method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        ffmpeg: ffmpegAvailable(),
        maxDurationSec: 90,
        aspects: ['9:16', '1:1', '16:9'],
        aiFeatures: {
          autoCaptions: false,
          voiceOver: false,
          generativeVideo: false,
          note: 'خصائص الذكاء الاصطناعي غير متصلة — لا تُعرض كعاملة',
        },
      });
      return true;
    }

    if (pathname === '/api/hub/reels/process' && req.method === 'POST') {
      const body = await readBody(req);
      const sourceUploadId = String(body.sourceUploadId || body.uploadId || '').replace(/^\/uploads\//, '');
      if (!sourceUploadId) {
        sendJson(res, 400, { ok: false, error: 'sourceUploadId مطلوب' });
        return true;
      }
      try {
        const result = await processReel({
          sourceUploadId,
          startSec: body.startSec,
          endSec: body.endSec,
          aspect: body.aspect || '9:16',
          title: body.title || '',
          coverAtSec: body.coverAtSec,
          ownerEmail: session.email,
          campaignId: body.campaignId || '',
          eventId: body.eventId || '',
          session,
        });
        sendJson(res, 201, { ok: true, reel: result });
      } catch (err) {
        sendJson(res, err.status || 500, { ok: false, error: err.message, job: err.job || null });
      }
      return true;
    }

    {
      const m = pathname.match(/^\/api\/hub\/reels\/jobs\/([^/]+)$/);
      if (m && req.method === 'GET') {
        const job = getJob(decodeURIComponent(m[1]));
        if (!job) {
          sendJson(res, 404, { ok: false, error: 'المهمة غير موجودة' });
          return true;
        }
        sendJson(res, 200, { ok: true, job });
        return true;
      }
    }

    sendJson(res, 404, { ok: false, error: 'مسار الريلز غير معروف' });
  } catch (err) {
    sendJson(res, err.status || 500, { ok: false, error: err.message || 'خطأ معالجة الريلز' });
  }
  return true;
}

module.exports = {
  ffmpegAvailable,
  processReel,
  getJob,
  handleApi,
  resolveSourcePath,
};
