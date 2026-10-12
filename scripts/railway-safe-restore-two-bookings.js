#!/usr/bin/env node
/**
 * CANCELLED for production use — experimental bookings restore is no longer requested.
 * Refuses to run unless HUB_ALLOW_EXPERIMENTAL_RESTORE=1 is set deliberately.
 */
'use strict';

if (String(process.env.HUB_ALLOW_EXPERIMENTAL_RESTORE || '') !== '1') {
  console.error(
    '[railway-safe-restore] CANCELLED — experimental restore disabled. Do not set HUB_SAFE_RESTORE_TWO_BOOKINGS on Railway.'
  );
  process.exit(0);
}

process.env.HUB_SAFE_RESTORE_TWO_BOOKINGS =
  process.env.HUB_SAFE_RESTORE_TWO_BOOKINGS || process.env.HUB_RESTORE_TWO_BOOKINGS || '1';

const restore = require('../lib/hub-bookings-restore');

restore
  .runSafeRailwayRestore()
  .then((result) => {
    const safe = {
      ran: result.ran,
      ok: result.ok,
      reason: result.reason,
      addedIds: result.addedIds,
      totalCount: result.totalCount,
      alreadyPresent: result.alreadyPresent,
      backupSha: result.audit?.backup?.sha256,
      backupBytes: result.audit?.backup?.bytes,
      afterIds: result.audit?.afterIds,
    };
    console.log(JSON.stringify(safe, null, 2));
    if (!result.ran && result.reason === 'flag_off') process.exit(0);
    if (result.ran && result.ok !== false) process.exit(0);
    process.exit(1);
  })
  .catch((err) => {
    console.error('[railway-safe-restore] fatal:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    try {
      const { closePool } = require('../db/migrate');
      await closePool();
    } catch {
      /* ignore */
    }
  });
