/**
 * One-shot / operator restore helpers for platform bookings.
 * Add-missing-only — never overwrites existing ids.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { restoreMissingBookingsOnly } = require('./hub-platform-booking');

const META_KEY = 'platform_bookings_v1';
const FIXTURE = path.join(__dirname, '..', 'scripts', 'fixtures', 'restore-two-bookings.json');
const ALLOWED = ['pb-mv5po1cv-x1he3', 'pb-mv5oximx-9f46e'];

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

/**
 * Boot hook: HUB_RESTORE_TWO_BOOKINGS=1 → merge the two approved missing ids, then no-op later.
 */
async function maybeBootRestoreTwoBookings() {
  if (String(process.env.HUB_RESTORE_TWO_BOOKINGS || '') !== '1') {
    return { ran: false, reason: 'flag_off' };
  }
  const { getDatabaseUrl, withClient } = require('../db/migrate');
  if (!getDatabaseUrl()) return { ran: false, reason: 'no_database' };
  if (!fs.existsSync(FIXTURE)) return { ran: false, reason: 'fixture_missing' };
  const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const candidates = (fixture.bookings || []).filter((b) => ALLOWED.includes(b.id));
  const current = await readMetaBookings(withClient);
  const beforeIds = current.bookings.map((b) => b.id);
  const { bookings, added } = restoreMissingBookingsOnly(current.bookings, candidates, {
    allowIds: ALLOWED,
  });
  const afterSet = new Set(bookings.map((b) => b.id));
  const lost = beforeIds.filter((id) => !afterSet.has(id));
  if (lost.length) {
    console.error('[bookings-restore] aborted — would lose existing ids', lost);
    return { ran: false, reason: 'would_lose_existing', lost };
  }
  if (!added.length) {
    console.warn('[bookings-restore] HUB_RESTORE_TWO_BOOKINGS=1 — both ids already present; unset the flag');
    return { ran: true, addedIds: [], totalCount: bookings.length, alreadyPresent: true };
  }
  await writeMetaBookings(withClient, { version: current.version || 1, bookings });
  // Mirror to disk if possible
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
  console.warn(
    `[bookings-restore] added ${added.length} missing booking(s): ${added.map((b) => b.id).join(', ')}. Unset HUB_RESTORE_TWO_BOOKINGS now.`
  );
  return { ran: true, addedIds: added.map((b) => b.id), totalCount: bookings.length };
}

module.exports = {
  META_KEY,
  ALLOWED,
  maybeBootRestoreTwoBookings,
  readMetaBookings,
  writeMetaBookings,
};
