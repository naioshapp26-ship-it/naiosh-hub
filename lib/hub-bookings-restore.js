/**
 * Railway-internal safe restore for the two approved missing platform bookings.
 *
 * Uses DATABASE_URL / DATABASE_PRIVATE_URL already linked on the service
 * (postgres.railway.internal). Never requires a public DB URL.
 *
 * When HUB_SAFE_RESTORE_TWO_BOOKINGS=1 (or legacy HUB_RESTORE_TWO_BOOKINGS=1):
 *  0) If both approved ids already present (or audit completed) → no-op (no delete, no rewrite)
 *  1) Full Postgres backup (pg_dump -Fc when available, else logical JSON of all public tables)
 *  2) Verify backup
 *  3) Add-only restore of the two approved booking ids
 *  4) Persist audit; refuse if any existing id would be lost
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { restoreMissingBookingsOnly } = require('./hub-platform-booking');

const META_KEY = 'platform_bookings_v1';
const AUDIT_KEY = 'platform_bookings_restore_audit_v1';
const FIXTURE = path.join(__dirname, '..', 'scripts', 'fixtures', 'restore-two-bookings.json');
const ALLOWED = ['pb-mv5po1cv-x1he3', 'pb-mv5oximx-9f46e'];

function flagEnabled() {
  return (
    String(process.env.HUB_SAFE_RESTORE_TWO_BOOKINGS || '') === '1' ||
    String(process.env.HUB_RESTORE_TWO_BOOKINGS || '') === '1'
  );
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function redactDbUrl(u) {
  return String(u || '').replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}

async function readMetaBookings(withClient) {
  const r = await withClient(async (client) => {
    const q = await client.query(`SELECT value FROM hub_meta WHERE key = $1 LIMIT 1`, [META_KEY]);
    if (!q.rows[0]?.value) return { version: 1, bookings: [] };
    const value = q.rows[0].value;
    return typeof value === 'string' ? JSON.parse(value) : value;
  });
  return {
    version: r?.version || 1,
    bookings: Array.isArray(r?.bookings) ? r.bookings : [],
    updatedAt: r?.updatedAt || null,
  };
}

async function writeMetaBookings(withClient, state) {
  const payload = {
    version: state.version || 1,
    updatedAt: new Date().toISOString(),
    bookings: Array.isArray(state.bookings) ? state.bookings.slice(0, 500) : [],
  };
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO hub_meta (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [META_KEY, JSON.stringify(payload)]
    );
  });
  return payload;
}

async function writeAudit(withClient, audit) {
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO hub_meta (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [AUDIT_KEY, JSON.stringify(audit)]
    );
  });
}

async function readAudit(withClient) {
  return withClient(async (client) => {
    const q = await client.query(`SELECT value FROM hub_meta WHERE key = $1 LIMIT 1`, [AUDIT_KEY]);
    if (!q.rows[0]?.value) return null;
    const value = q.rows[0].value;
    return typeof value === 'string' ? JSON.parse(value) : value;
  });
}

function hasPgDump() {
  const r = spawnSync('which', ['pg_dump'], { encoding: 'utf8' });
  return r.status === 0 && String(r.stdout || '').trim().length > 0;
}

/**
 * Prefer native pg_dump custom format (full DB). Falls back to null if binary missing.
 */
function pgDumpBackup(databaseUrl) {
  if (!hasPgDump()) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = process.env.HUB_BACKUP_DIR || '/tmp/naiosh-hub-backups';
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `full-pgdump-${stamp}.dump`);
  const dump = spawnSync(
    'pg_dump',
    [databaseUrl, '--format=custom', '--no-owner', '--no-acl', `--file=${filePath}`],
    { encoding: 'utf8', timeout: 10 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 }
  );
  if (dump.status !== 0 || !fs.existsSync(filePath)) {
    throw new Error(`pg_dump failed: ${(dump.stderr || dump.stdout || '').slice(0, 400)}`);
  }
  const list = spawnSync('pg_restore', ['--list', filePath], {
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (list.status !== 0) {
    throw new Error(`pg_restore --list failed: ${(list.stderr || '').slice(0, 400)}`);
  }
  const toc = list.stdout || '';
  if (!/hub_meta/i.test(toc)) {
    throw new Error('pg_dump archive missing hub_meta — refusing restore');
  }
  const bytes = fs.statSync(filePath).size;
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  return {
    kind: 'pg_dump_custom',
    filePath,
    bytes,
    sha256,
    verified: true,
    tocHasHubMeta: true,
    tableCount: (toc.match(/^;/gm) || []).length || undefined,
  };
}

/**
 * Full logical backup of all base tables in public schema (Node/pg — works without pg_dump).
 */
async function fullLogicalBackup(withClient) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = process.env.HUB_BACKUP_DIR || '/tmp/naiosh-hub-backups';
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `full-logical-${stamp}.json`);

  const tables = await withClient(async (client) => {
    const r = await client.query(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'
       ORDER BY tablename`
    );
    return r.rows.map((row) => row.tablename);
  });

  if (!tables.length) throw new Error('no public tables found for backup');
  if (!tables.includes('hub_meta')) throw new Error('hub_meta missing — refusing backup/restore');

  const tableData = {};
  const counts = {};
  for (const table of tables) {
    const rows = await withClient(async (client) => {
      const r = await client.query(`SELECT * FROM public.${quoteIdent(table)}`);
      return r.rows;
    });
    tableData[table] = rows;
    counts[table] = rows.length;
  }

  const payload = {
    kind: 'naiosh-hub-full-logical-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    tableCount: tables.length,
    tables,
    counts,
    data: tableData,
  };
  const raw = JSON.stringify(payload);
  const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  fs.writeFileSync(filePath, raw, 'utf8');

  return {
    kind: 'logical_json',
    filePath,
    bytes: Buffer.byteLength(raw),
    sha256,
    tableCount: tables.length,
    counts,
    tables,
  };
}

async function verifyLogicalBackup(withClient, backupMeta) {
  const raw = fs.readFileSync(backupMeta.filePath, 'utf8');
  const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  if (sha256 !== backupMeta.sha256) return { ok: false, error: 'checksum_mismatch' };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, error: 'json_parse_failed', detail: err.message };
  }
  if (parsed.kind !== 'naiosh-hub-full-logical-backup') return { ok: false, error: 'unexpected_kind' };
  if (!parsed.tables?.includes('hub_meta')) return { ok: false, error: 'hub_meta_missing_in_backup' };
  for (const table of parsed.tables) {
    const live = await withClient(async (client) => {
      const r = await client.query(`SELECT COUNT(*)::int AS n FROM public.${quoteIdent(table)}`);
      return r.rows[0].n;
    });
    const dumped = Number(parsed.counts?.[table] ?? -1);
    if (live !== dumped) {
      return { ok: false, error: 'row_count_mismatch', table, live, dumped };
    }
  }
  return {
    ok: true,
    kind: 'logical_json',
    tableCount: parsed.tableCount,
    hubMetaRows: parsed.counts.hub_meta,
    bytes: backupMeta.bytes,
    sha256,
    filePath: backupMeta.filePath,
  };
}

function loadApprovedFixture() {
  if (!fs.existsSync(FIXTURE)) throw new Error(`fixture missing: ${FIXTURE}`);
  const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const bookings = (fixture.bookings || []).filter((b) => ALLOWED.includes(b.id));
  if (bookings.length !== ALLOWED.length) {
    throw new Error(`fixture must contain exactly ids: ${ALLOWED.join(', ')}`);
  }
  for (const b of bookings) {
    if (!b.email || !b.branch || b.lat == null || b.lng == null || !b.createdAt) {
      throw new Error(`fixture row incomplete: ${b.id}`);
    }
  }
  return bookings;
}

function mirrorDisk(bookings) {
  try {
    const diskPath = path.join(__dirname, '..', 'data', 'platform-bookings.json');
    fs.mkdirSync(path.dirname(diskPath), { recursive: true });
    fs.writeFileSync(
      diskPath,
      JSON.stringify({ version: 1, bookings, updatedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch {
    /* ignore */
  }
}

/**
 * Main operator entry — safe Railway-internal restore.
 * Safe to leave flag on briefly: re-runs become no-op once ids exist / audit completed.
 * Never deletes or overwrites existing booking ids.
 */
async function runSafeRailwayRestore() {
  if (!flagEnabled()) {
    return { ran: false, reason: 'flag_off' };
  }

  const { getDatabaseUrl, withClient } = require('../db/migrate');
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return { ran: false, reason: 'no_database' };
  }

  const startedAt = new Date().toISOString();
  console.warn('[bookings-safe-restore] START — check existing → full backup → add-only restore');

  // 0) Idempotent early exit — do NOT rewrite or re-backup if work already done
  const currentEarly = await readMetaBookings(withClient);
  const earlyIds = currentEarly.bookings.map((b) => b.id);
  const alreadyHaveAll = ALLOWED.every((id) => earlyIds.includes(id));
  const priorAudit = await readAudit(withClient);
  if (alreadyHaveAll) {
    const audit = {
      at: startedAt,
      ok: true,
      stage: 'already_present',
      message: 'approved ids already in Postgres — no backup rewrite, no data change',
      beforeIds: earlyIds,
      afterIds: earlyIds,
      addedIds: [],
      totalCount: earlyIds.length,
      priorAuditStage: priorAudit?.stage || null,
      unsetFlag: 'HUB_SAFE_RESTORE_TWO_BOOKINGS',
      dbHint: redactDbUrl(databaseUrl).includes('railway.internal') ? 'internal' : 'configured',
    };
    await writeAudit(withClient, audit);
    console.warn(
      '[bookings-safe-restore] OK already present (no-op) — UNSET HUB_SAFE_RESTORE_TWO_BOOKINGS'
    );
    return { ran: true, ok: true, alreadyPresent: true, addedIds: [], totalCount: earlyIds.length, audit };
  }

  // 1–2) Full backup + verify
  let backupMeta;
  let verified;
  try {
    const native = (() => {
      try {
        return pgDumpBackup(databaseUrl);
      } catch (err) {
        console.warn('[bookings-safe-restore] pg_dump unavailable/failed, using logical JSON:', err.message);
        return null;
      }
    })();
    if (native) {
      backupMeta = native;
      verified = {
        ok: true,
        kind: 'pg_dump_custom',
        bytes: native.bytes,
        sha256: native.sha256,
        filePath: native.filePath,
        tocHasHubMeta: true,
      };
    } else {
      backupMeta = await fullLogicalBackup(withClient);
      verified = await verifyLogicalBackup(withClient, backupMeta);
    }
  } catch (err) {
    console.error('[bookings-safe-restore] BACKUP FAILED:', err.message);
    return { ran: false, reason: 'backup_failed', error: err.message };
  }

  if (!verified?.ok) {
    console.error('[bookings-safe-restore] BACKUP VERIFY FAILED:', verified);
    await writeAudit(withClient, {
      at: startedAt,
      ok: false,
      stage: 'backup_verify',
      verified,
      backup: {
        kind: backupMeta?.kind,
        filePath: backupMeta?.filePath,
        bytes: backupMeta?.bytes,
        sha256: backupMeta?.sha256,
      },
    });
    return { ran: false, reason: 'backup_verify_failed', verified };
  }
  console.warn(
    `[bookings-safe-restore] backup OK kind=${verified.kind || backupMeta.kind} bytes=${verified.bytes} sha256=${String(verified.sha256).slice(0, 12)}…`
  );

  // 3) Add-only restore
  let candidates;
  try {
    candidates = loadApprovedFixture();
  } catch (err) {
    console.error('[bookings-safe-restore] FIXTURE FAILED:', err.message);
    return { ran: false, reason: 'fixture_failed', error: err.message };
  }

  const current = await readMetaBookings(withClient);
  const beforeIds = current.bookings.map((b) => b.id);
  const { bookings, added } = restoreMissingBookingsOnly(current.bookings, candidates, {
    allowIds: ALLOWED,
  });
  const afterSet = new Set(bookings.map((b) => b.id));
  const lost = beforeIds.filter((id) => !afterSet.has(id));
  if (lost.length) {
    console.error('[bookings-safe-restore] ABORT — would lose existing ids', lost);
    await writeAudit(withClient, {
      at: startedAt,
      ok: false,
      stage: 'precheck',
      lost,
      beforeIds,
      backup: {
        kind: backupMeta.kind,
        filePath: backupMeta.filePath,
        sha256: backupMeta.sha256,
        bytes: backupMeta.bytes,
      },
    });
    return { ran: false, reason: 'would_lose_existing', lost };
  }

  // Race: another instance may have restored between early check and now
  if (!added.length) {
    const audit = {
      at: startedAt,
      ok: true,
      stage: 'already_present',
      message: 'both approved ids already present after backup — no write',
      beforeIds,
      afterIds: beforeIds,
      addedIds: [],
      totalCount: beforeIds.length,
      backup: {
        kind: backupMeta.kind,
        filePath: backupMeta.filePath,
        sha256: backupMeta.sha256,
        bytes: backupMeta.bytes,
        verified: true,
      },
      unsetFlag: 'HUB_SAFE_RESTORE_TWO_BOOKINGS',
    };
    await writeAudit(withClient, audit);
    console.warn('[bookings-safe-restore] OK already present — UNSET HUB_SAFE_RESTORE_TWO_BOOKINGS');
    return { ran: true, ok: true, alreadyPresent: true, addedIds: [], totalCount: beforeIds.length, audit };
  }

  await writeMetaBookings(withClient, { version: current.version || 1, bookings });
  mirrorDisk(bookings);

  const after = await readMetaBookings(withClient);
  const afterIds = after.bookings.map((b) => b.id);
  const preserved = beforeIds.every((id) => afterIds.includes(id));
  const restoredOk = ALLOWED.every((id) => afterIds.includes(id));

  const audit = {
    at: startedAt,
    finishedAt: new Date().toISOString(),
    ok: preserved && restoredOk,
    stage: 'restored',
    beforeIds,
    afterIds,
    addedIds: added.map((b) => b.id),
    totalCount: afterIds.length,
    preservedExisting: preserved,
    approvedIdsPresent: restoredOk,
    completed: preserved && restoredOk,
    backup: {
      kind: backupMeta.kind,
      filePath: backupMeta.filePath,
      sha256: backupMeta.sha256,
      bytes: backupMeta.bytes,
      tableCount: backupMeta.tableCount,
      verified: true,
    },
    unsetFlag: 'HUB_SAFE_RESTORE_TWO_BOOKINGS',
  };
  await writeAudit(withClient, audit);

  if (!audit.ok) {
    console.error('[bookings-safe-restore] VERIFY FAILED after write', {
      preserved,
      restoredOk,
      totalCount: afterIds.length,
    });
    return { ran: true, ok: false, reason: 'post_verify_failed', audit };
  }

  console.warn(
    `[bookings-safe-restore] OK added=${audit.addedIds.join(',')} total=${audit.totalCount} — UNSET HUB_SAFE_RESTORE_TWO_BOOKINGS now`
  );
  return { ran: true, ok: true, addedIds: audit.addedIds, totalCount: audit.totalCount, audit };
}

/** @deprecated alias */
async function maybeBootRestoreTwoBookings() {
  return runSafeRailwayRestore();
}

module.exports = {
  META_KEY,
  AUDIT_KEY,
  ALLOWED,
  flagEnabled,
  runSafeRailwayRestore,
  maybeBootRestoreTwoBookings,
  readMetaBookings,
  writeMetaBookings,
  readAudit,
  fullLogicalBackup,
  verifyLogicalBackup,
  loadApprovedFixture,
  hasPgDump,
};
