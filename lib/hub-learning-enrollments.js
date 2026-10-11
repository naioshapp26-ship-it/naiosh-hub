/**
 * Server-side learning enrollments for Profile 360.
 * Browser HubClientLearning (localStorage) is NOT authoritative for the hub API.
 * This store holds enrollments linked to an account email when recorded via API / admin.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const STORE_PATH = path.join(DATA_DIR, 'learning-enrollments.json');

function now() {
  return new Date().toISOString();
}

function uid() {
  return `lrn-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function normEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function blank() {
  return { version: 1, enrollment: [], updatedAt: now() };
}

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return blank();
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return {
      version: 1,
      enrollment: Array.isArray(raw.enrollment) ? raw.enrollment : [],
      updatedAt: raw.updatedAt || now(),
    };
  } catch {
    return blank();
  }
}

function writeStore(store) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  store.updatedAt = now();
  const tmp = `${STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, STORE_PATH);
}

function listForEmail(email, kind) {
  const e = normEmail(email);
  if (!e) return [];
  return readStore().enrollment.filter(
    (row) => normEmail(row.email) === e && (!kind || row.kind === kind) && row.status !== 'removed'
  );
}

function enroll({ email, kind = 'course', itemId, title, level, duration, source = 'api', progress } = {}) {
  const e = normEmail(email);
  const k = kind === 'diploma' ? 'diploma' : 'course';
  const id = String(itemId || '').trim();
  if (!e || !id) return { ok: false, error: 'البريد ومعرّف البرنامج مطلوبان' };
  const store = readStore();
  const exists = store.enrollment.find(
    (row) => normEmail(row.email) === e && row.kind === k && String(row.itemId) === id && row.status !== 'removed'
  );
  if (exists) {
    if (title) exists.title = title;
    if (progress != null) exists.progress = progress;
    exists.updatedAt = now();
    writeStore(store);
    return { ok: true, enrollment: listForEmail(e, k), item: exists };
  }
  const row = {
    id: uid(),
    email: e,
    kind: k,
    itemId: id,
    title: String(title || id).trim(),
    level: level || '',
    duration: duration || '',
    progress: progress != null ? progress : null,
    source: source || 'api',
    status: 'active',
    at: now(),
    updatedAt: now(),
  };
  store.enrollment.unshift(row);
  writeStore(store);
  return { ok: true, enrollment: listForEmail(e, k), item: row };
}

function summaryForProfile(email) {
  const courses = listForEmail(email, 'course');
  const diplomas = listForEmail(email, 'diploma');
  const all = [...courses, ...diplomas];
  if (!all.length) {
    return {
      courses: null,
      diplomas: null,
      progress: null,
      source: 'server',
      connected: false,
    };
  }
  const withProgress = all.filter((r) => r.progress != null && r.progress !== '');
  const avg =
    withProgress.length > 0
      ? Math.round(withProgress.reduce((s, r) => s + Number(r.progress || 0), 0) / withProgress.length)
      : null;
  return {
    courses: courses.map((c) => ({
      id: c.itemId,
      name: c.title,
      status: c.status || 'active',
      progress: c.progress,
      at: c.at,
    })),
    diplomas: diplomas.map((c) => ({
      id: c.itemId,
      name: c.title,
      status: c.status || 'active',
      at: c.at,
    })),
    progress: avg,
    source: 'server',
    connected: true,
  };
}

module.exports = {
  listForEmail,
  enroll,
  summaryForProfile,
  readStore,
};
