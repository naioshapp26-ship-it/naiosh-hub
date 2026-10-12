#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { mergeBookingsById } = require('../lib/hub-platform-booking');

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

console.log('PASS | mergeBookingsById unit');
process.exit(0);
