/**
 * Server-side session revocation for hub360.* tokens (customer + demo staff).
 * Logout must invalidate the presented token so it cannot call APIs afterwards.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const STORE_PATH = path.join(DATA_DIR, 'hub-revoked-tokens.json');
/** Match hub_session Max-Age (30 days) + buffer */
const TTL_MS = 35 * 24 * 60 * 60 * 1000;

let mem = new Map(); // tokenHash -> expiresAt
let loaded = false;

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(STORE_PATH)) {
      fs.writeFileSync(STORE_PATH, JSON.stringify({ version: 1, items: [] }, null, 2), 'utf8');
    }
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    const now = Date.now();
    (Array.isArray(raw.items) ? raw.items : []).forEach((it) => {
      if (it && it.hash && Number(it.expiresAt) > now) {
        mem.set(String(it.hash), Number(it.expiresAt));
      }
    });
  } catch {
    mem = new Map();
  }
}

function persist() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const now = Date.now();
    const items = [];
    for (const [hash, expiresAt] of mem.entries()) {
      if (expiresAt > now) items.push({ hash, expiresAt });
      else mem.delete(hash);
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify({ version: 1, items, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
  } catch {
    /* best effort */
  }
}

function revokeToken(token) {
  const t = String(token || '').trim();
  if (!t || !t.startsWith('hub360.')) return false;
  ensureLoaded();
  const hash = tokenHash(t);
  mem.set(hash, Date.now() + TTL_MS);
  persist();
  return true;
}

function isRevoked(token) {
  const t = String(token || '').trim();
  if (!t) return false;
  ensureLoaded();
  const hash = tokenHash(t);
  const exp = mem.get(hash);
  if (!exp) return false;
  if (exp <= Date.now()) {
    mem.delete(hash);
    return false;
  }
  return true;
}

module.exports = {
  revokeToken,
  isRevoked,
  tokenHash,
  STORE_PATH,
};
