/**
 * In-memory login rate limiting — temporary throttle, not permanent lockout.
 * Does not reveal whether an email exists.
 */
'use strict';

const WINDOW_MS = Number(process.env.HUB_LOGIN_RATE_WINDOW_MS || 15 * 60 * 1000);
const MAX_ATTEMPTS = Number(process.env.HUB_LOGIN_RATE_MAX || 12);
const LOCK_MS = Number(process.env.HUB_LOGIN_LOCK_MS || 5 * 60 * 1000);

/** ip|email -> { fails: [{t}], lockedUntil } */
const buckets = new Map();

function key(ip, email) {
  return `${String(ip || 'unknown')}|${String(email || '').toLowerCase()}`;
}

function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || req.socket?.remoteAddress || '';
}

function check(req, email) {
  const k = key(clientIp(req), email);
  const now = Date.now();
  let b = buckets.get(k);
  if (!b) return { ok: true };
  if (b.lockedUntil && b.lockedUntil > now) {
    const secs = Math.ceil((b.lockedUntil - now) / 1000);
    return {
      ok: false,
      status: 429,
      error: `محاولات كثيرة. أعد المحاولة بعد ${secs} ثانية.`,
      retryAfter: secs,
    };
  }
  b.fails = (b.fails || []).filter((t) => now - t < WINDOW_MS);
  if (b.fails.length >= MAX_ATTEMPTS) {
    b.lockedUntil = now + LOCK_MS;
    buckets.set(k, b);
    return {
      ok: false,
      status: 429,
      error: `محاولات كثيرة. أعد المحاولة بعد ${Math.ceil(LOCK_MS / 1000)} ثانية.`,
      retryAfter: Math.ceil(LOCK_MS / 1000),
    };
  }
  return { ok: true };
}

function fail(req, email) {
  const k = key(clientIp(req), email);
  const now = Date.now();
  let b = buckets.get(k) || { fails: [] };
  b.fails = (b.fails || []).filter((t) => now - t < WINDOW_MS);
  b.fails.push(now);
  if (b.fails.length >= MAX_ATTEMPTS) b.lockedUntil = now + LOCK_MS;
  buckets.set(k, b);
}

function success(req, email) {
  buckets.delete(key(clientIp(req), email));
}

module.exports = { check, fail, success, clientIp };
