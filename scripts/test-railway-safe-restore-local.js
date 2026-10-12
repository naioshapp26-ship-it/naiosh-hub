#!/usr/bin/env node
/**
 * Local verification of full logical backup + add-only restore against DATABASE_URL.
 * Does not touch production. Skips if no local DATABASE_URL.
 */
'use strict';

const assert = require('assert');
const restore = require('../lib/hub-bookings-restore');
const { getDatabaseUrl, withClient, closePool } = require('../db/migrate');

async function main() {
  if (!getDatabaseUrl() || !/127\.0\.0\.1|localhost/.test(getDatabaseUrl())) {
    console.log('SKIP | local DATABASE_URL not available');
    process.exit(0);
  }

  const backup = await restore.fullLogicalBackup(withClient);
  assert.ok(backup.bytes > 100, 'backup has content');
  assert.ok(backup.tables.includes('hub_meta'), 'hub_meta in backup');

  const verified = await restore.verifyLogicalBackup(withClient, backup);
  assert.strictEqual(verified.ok, true, JSON.stringify(verified));

  const fixture = restore.loadApprovedFixture();
  assert.strictEqual(fixture.length, 2);

  const before = await restore.readMetaBookings(withClient);
  const keep = before.bookings.slice();
  // Simulate prod: ensure our two ids are absent, keep others
  const stripped = keep.filter((b) => !restore.ALLOWED.includes(b.id));
  // Seed two fake "current" rows if empty
  const seed =
    stripped.length > 0
      ? stripped
      : [
          { id: 'pb-keep-local-1', createdAt: '2026-10-12T21:00:00.000Z', branch: 'keep-1' },
          { id: 'pb-keep-local-2', createdAt: '2026-10-12T21:01:00.000Z', branch: 'keep-2' },
        ];
  await restore.writeMetaBookings(withClient, { version: 1, bookings: seed });

  process.env.HUB_SAFE_RESTORE_TWO_BOOKINGS = '1';
  const result = await restore.runSafeRailwayRestore();
  assert.ok(result.ran, 'ran');
  assert.ok(result.ok !== false, JSON.stringify(result));
  assert.ok(result.totalCount >= 4 || (result.alreadyPresent && result.totalCount >= 2), 'count');

  const after = await restore.readMetaBookings(withClient);
  const ids = after.bookings.map((b) => b.id);
  for (const id of seed.map((b) => b.id)) assert.ok(ids.includes(id), 'preserved ' + id);
  for (const id of restore.ALLOWED) assert.ok(ids.includes(id), 'restored ' + id);

  // Restore previous local state
  await restore.writeMetaBookings(withClient, { version: 1, bookings: keep });

  console.log('PASS | railway safe restore local (backup+verify+add-only)');
  await closePool();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('FAIL', err);
  try {
    await closePool();
  } catch {
    /* */
  }
  process.exit(1);
});
