/**
 * Pluggable object storage for large customer attachments.
 *
 * Backends (HUB_OBJECT_STORAGE_BACKEND):
 *   - db   (default): bytes in hub_upload_blobs (current durable path)
 *   - disk: local data/uploads only (ephemeral on Railway — not for prod alone)
 *   - s3  : S3-compatible (AWS/R2/MinIO) — write NEW objects when fully configured;
 *           never deletes db/disk originals until migration verified
 *
 * Cutover policy: dual-write when s3 is configured; reads try s3 then db then disk.
 * Do NOT delete old copies until an explicit verified migrate job succeeds.
 */
'use strict';

const fs = require('fs');
const path = require('path');

function backendName() {
  const b = String(process.env.HUB_OBJECT_STORAGE_BACKEND || 'db')
    .trim()
    .toLowerCase();
  return ['db', 'disk', 's3'].includes(b) ? b : 'db';
}

function s3Configured() {
  return !!(
    process.env.HUB_S3_BUCKET &&
    process.env.HUB_S3_ACCESS_KEY_ID &&
    process.env.HUB_S3_SECRET_ACCESS_KEY &&
    (process.env.HUB_S3_ENDPOINT || process.env.AWS_REGION || process.env.HUB_S3_REGION)
  );
}

function s3KeyFor(storageRef) {
  const prefix = String(process.env.HUB_S3_PREFIX || 'hub-uploads').replace(/\/+$/, '');
  return `${prefix}/${storageRef}`;
}

async function putObject({ storageRef, buffer, mime, originalName }) {
  const backend = backendName();
  const result = { backend, storageRef, dualWritten: [] };

  // Always keep db path available as rollback unless explicitly disk-only
  if (backend === 'db' || backend === 's3' || process.env.HUB_OBJECT_STORAGE_DUAL_WRITE === '1') {
    try {
      const hubUploads = require('./hub-uploads');
      const r = await hubUploads.persistBlobToDb({
        storageRef,
        mime,
        originalName,
        buffer,
      });
      if (r?.ok) result.dualWritten.push('db');
    } catch (err) {
      console.warn('[hub-object-storage] db put:', err.message);
    }
  }

  if (backend === 's3') {
    if (!s3Configured()) {
      result.s3Error = 'S3 env not fully configured; kept db/disk only';
      return result;
    }
    try {
      // Lazy require so environments without AWS SDK still boot
      const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
      const client = new S3Client({
        region: process.env.HUB_S3_REGION || process.env.AWS_REGION || 'auto',
        endpoint: process.env.HUB_S3_ENDPOINT || undefined,
        forcePathStyle: String(process.env.HUB_S3_FORCE_PATH_STYLE || '1') === '1',
        credentials: {
          accessKeyId: process.env.HUB_S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.HUB_S3_SECRET_ACCESS_KEY,
        },
      });
      await client.send(
        new PutObjectCommand({
          Bucket: process.env.HUB_S3_BUCKET,
          Key: s3KeyFor(storageRef),
          Body: buffer,
          ContentType: mime || 'application/octet-stream',
          Metadata: { originalName: String(originalName || '').slice(0, 200) },
        })
      );
      result.dualWritten.push('s3');
    } catch (err) {
      result.s3Error = err.message;
      console.warn('[hub-object-storage] s3 put failed (db retained):', err.message);
    }
  }

  return result;
}

async function getObject(storageRef) {
  const hubUploads = require('./hub-uploads');
  const backend = backendName();

  if (backend === 's3' && s3Configured()) {
    try {
      const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
      const client = new S3Client({
        region: process.env.HUB_S3_REGION || process.env.AWS_REGION || 'auto',
        endpoint: process.env.HUB_S3_ENDPOINT || undefined,
        forcePathStyle: String(process.env.HUB_S3_FORCE_PATH_STYLE || '1') === '1',
        credentials: {
          accessKeyId: process.env.HUB_S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.HUB_S3_SECRET_ACCESS_KEY,
        },
      });
      const out = await client.send(
        new GetObjectCommand({ Bucket: process.env.HUB_S3_BUCKET, Key: s3KeyFor(storageRef) })
      );
      const chunks = [];
      for await (const chunk of out.Body) chunks.push(chunk);
      return {
        buffer: Buffer.concat(chunks),
        mime: out.ContentType || 'application/octet-stream',
        source: 's3',
      };
    } catch (err) {
      console.warn('[hub-object-storage] s3 get miss, falling back:', err.message);
    }
  }

  // Prefer hydrate for app upload ids (rewrites bytes to disk); also read BYTEA directly
  // so S3-style keys / test refs stored only in hub_upload_blobs still survive restart.
  const fromDb = await hubUploads.hydrateBlobFromDb(storageRef);
  if (fromDb) {
    const filePath = fromDb.path || hubUploads.resolveUploadPath(storageRef);
    if (filePath && fs.existsSync(filePath)) {
      return { buffer: fs.readFileSync(filePath), mime: fromDb.mime, source: 'db' };
    }
  }
  try {
    const { getDatabaseUrl, withClient } = require('../db/migrate');
    if (getDatabaseUrl() && storageRef) {
      const row = await withClient(async (client) => {
        const r = await client.query(
          `SELECT mime, bytes FROM hub_upload_blobs WHERE storage_ref = $1 LIMIT 1`,
          [String(storageRef)]
        );
        return r.rows[0];
      });
      if (row?.bytes) {
        return {
          buffer: Buffer.isBuffer(row.bytes) ? row.bytes : Buffer.from(row.bytes),
          mime: row.mime || 'application/octet-stream',
          source: 'db',
        };
      }
    }
  } catch (err) {
    console.warn('[hub-object-storage] db get:', err.message);
  }

  const disk = hubUploads.resolveUploadPath(storageRef);
  if (disk && fs.existsSync(disk)) {
    return { buffer: fs.readFileSync(disk), mime: hubUploads.mimeForExt(path.extname(disk)), source: 'disk' };
  }
  return null;
}

function statusReport() {
  return {
    backend: backendName(),
    s3Configured: s3Configured(),
    dualWrite: process.env.HUB_OBJECT_STORAGE_DUAL_WRITE === '1' || backendName() === 's3',
    deleteOldCopies: false,
    note: 'Old db/disk copies are never deleted by this adapter until an explicit verified migration job runs.',
  };
}

module.exports = {
  backendName,
  s3Configured,
  putObject,
  getObject,
  statusReport,
  s3KeyFor,
};
