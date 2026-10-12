#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { mergeBookingsById, restoreMissingBookingsOnly } = require('../lib/hub-platform-booking');

const disk = [
  { id: 'a', createdAt: '2026-10-12T10:00:00.000Z', branch: 'disk-a' },
  { id: 'b', createdAt: '2026-10-12T11:00:00.000Z', branch: 'disk-b' },
];
const db = [
  { id: 'b', createdAt: '2026-10-12T12:00:00.000Z', branch: 'db-b-newer' },
  { id: 'c', createdAt: '2026-10-12T09:00:00.000Z', branch: 'db-c' },
];

const merged = mergeBookingsById(disk, db);
assert.strictEqual(merged.length, 3, 'union keeps all ids');
assert.deepStrictEqual(
  merged.map((x) => x.id).sort(),
  ['a', 'b', 'c'],
  'ids a,b,c'
);
assert.strictEqual(merged.find((x) => x.id === 'b').branch, 'db-b-newer', 'newer wins on conflict');
assert.strictEqual(merged.find((x) => x.id === 'a').branch, 'disk-a', 'disk-only kept');

const wiped = mergeBookingsById([{ id: 'only-disk', createdAt: '2026-10-12T08:00:00.000Z' }], []);
assert.strictEqual(wiped.length, 1, 'empty db must not wipe disk');

const emptyDisk = mergeBookingsById([], db);
assert.strictEqual(emptyDisk.length, 2, 'empty disk keeps db');

const current = [
  { id: 'keep-1', branch: 'current-1' },
  { id: 'keep-2', branch: 'current-2' },
];
const candidates = [
  { id: 'keep-1', branch: 'should-not-overwrite' },
  { id: 'pb-mv5po1cv-x1he3', branch: 'restored-a' },
  { id: 'other', branch: 'not-allowed' },
];
const { bookings, added } = restoreMissingBookingsOnly(current, candidates, {
  allowIds: ['pb-mv5po1cv-x1he3', 'pb-mv5oximx-9f46e'],
});
assert.strictEqual(added.length, 1);
assert.strictEqual(added[0].id, 'pb-mv5po1cv-x1he3');
assert.strictEqual(bookings.find((b) => b.id === 'keep-1').branch, 'current-1', 'no overwrite');
assert.ok(bookings.some((b) => b.id === 'keep-2'));
assert.ok(!bookings.some((b) => b.id === 'other'));

console.log('PASS | mergeBookingsById + restoreMissingBookingsOnly unit');
process.exit(0);
