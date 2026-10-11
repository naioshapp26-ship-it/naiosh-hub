/**
 * Server-side session revocation for hub360.* tokens (customer + demo staff).
 * Logout must invalidate the presented token so it cannot call APIs afterwards.
 * When DATABASE_URL is set, Postgres hub_revoked_tokens is shared across replicas
 * (no sticky-session dependency).
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
let hydratePromise = null;

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function dbEnabled() {
  try {
    return !!require('../db/migrate').getDatabaseUrl();
  } catch {
    return false;
  }
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
  if (dbEnabled()) {
    hydratePromise = hydrateFromDb().catch(() => {});
  }
}

async function hydrateFromDb() {
  if (!dbEnabled()) return;
  const { withClient } = require('../db/migrate');
  await withClient(async (client) => {
    const r = await client.query(
      `SELECT token_hash, EXTRACT(EPOCH FROM expires_at)*1000 AS exp
       FROM hub_revoked_tokens
       WHERE expires_at IS NULL OR expires_at > NOW()`
    );
    for (const row of r.rows) {
      const exp = Number(row.exp) || Date.now() + TTL_MS;
      mem.set(String(row.token_hash), exp);
    }
  });
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

async function persistDb(hash, expiresAt, email) {
  if (!dbEnabled()) return { ok: true, skipped: true };
  const { withClient } = require('../db/migrate');
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO hub_revoked_tokens (token_hash, email, revoked_at, expires_at)
       VALUES ($1,$2,NOW(),to_timestamp($3/1000.0))
       ON CONFLICT (token_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
      [hash, email || null, expiresAt]
    );
  });
  return { ok: true };
}

function revokeToken(token, email) {
  // Sync API kept for callers; fire-and-forget DB (prefer revokeTokenAsync on logout)
  const t = String(token || '').trim();
  if (!t || !t.startsWith('hub360.')) return false;
  ensureLoaded();
  const hash = tokenHash(t);
  const expiresAt = Date.now() + TTL_MS;
  mem.set(hash, expiresAt);
  persist();
  persistDb(hash, expiresAt, email).catch((err) => console.warn('[hub-token-revoke] db persist:', err.message));
  return true;
}

async function revokeTokenAsync(token, email) {
  const t = String(token || '').trim();
  if (!t || !t.startsWith('hub360.')) return false;
  ensureLoaded();
  const hash = tokenHash(t);
  const expiresAt = Date.now() + TTL_MS;
  mem.set(hash, expiresAt);
  persist();
  await persistDb(hash, expiresAt, email);
  return true;
}

function isRevokedLocal(token) {
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

/** Sync check — local mem only (may lag other replicas). */
function isRevoked(token) {
  return isRevokedLocal(token);
}

/** Async check — Postgres source of truth across replicas. */
async function isRevokedAsync(token) {
  const t = String(token || '').trim();
  if (!t) return false;
  if (isRevokedLocal(t)) return true;
  if (hydratePromise) {
    try {
      await hydratePromise;
    } catch {
      /* ignore */
    }
    if (isRevokedLocal(t)) return true;
  }
  if (!dbEnabled()) return false;
  try {
    const { withClient } = require('../db/migrate');
    const hash = tokenHash(t);
    const row = await withClient(async (client) => {
      const r = await client.query(
        `SELECT 1 FROM hub_revoked_tokens
         WHERE token_hash = $1 AND (expires_at IS NULL OR expires_at > NOW())
         LIMIT 1`,
        [hash]
      );
      return r.rows[0];
    });
    if (row) {
      mem.set(hash, Date.now() + TTL_MS);
      return true;
    }
  } catch (err) {
    console.warn('[hub-token-revoke] db check:', err.message);
  }
  return false;
}

module.exports = {
  revokeToken,
  revokeTokenAsync,
  isRevoked,
  isRevokedAsync,
  isRevokedLocal,
  tokenHash,
  STORE_PATH,
  hydrateFromDb,
};
