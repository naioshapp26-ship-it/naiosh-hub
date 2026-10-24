/**
 * HMAC signing for hub360 session tokens.
 * Prevents forging hub360.cust.<email>.* tokens without SESSION_SECRET / HUB_TOKEN_SECRET.
 */
'use strict';

const crypto = require('crypto');

let warnedMissingSecret = false;

function getTokenSecret() {
  const fromEnv = String(process.env.SESSION_SECRET || process.env.HUB_TOKEN_SECRET || '').trim();
  if (fromEnv) return fromEnv;
  if (!global.__hubEphemeralTokenSecret) {
    global.__hubEphemeralTokenSecret = crypto.randomBytes(32).toString('hex');
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn(
        '[hub-token] SESSION_SECRET / HUB_TOKEN_SECRET missing — using ephemeral process secret. Set SESSION_SECRET on Railway for multi-instance stability.'
      );
    }
  }
  return global.__hubEphemeralTokenSecret;
}

function hmacHex(payload) {
  return crypto.createHmac('sha256', getTokenSecret()).update(payload).digest('base64url');
}

/** Append `.s<sig>` to an unsigned token body. */
function signTokenBody(body) {
  const base = String(body || '').replace(/\.s[A-Za-z0-9_-]+$/, '');
  const sig = hmacHex(base).slice(0, 32);
  return `${base}.s${sig}`;
}

/**
 * Verify `.s` signature. Returns { ok, body } where body is unsigned prefix.
 * Unsigned tokens are rejected (forgery class closed).
 */
function verifySignedToken(token) {
  const t = String(token || '');
  const m = t.match(/^(.*)\.s([A-Za-z0-9_-]{16,})$/);
  if (!m) {
    return { ok: false, error: 'جلسة غير موقعة — سجّل الدخول مجددًا' };
  }
  const body = m[1];
  const expected = hmacHex(body).slice(0, 32);
  const a = Buffer.from(m[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'جلسة غير صالحة' };
  }
  return { ok: true, body };
}

module.exports = {
  getTokenSecret,
  signTokenBody,
  verifySignedToken,
};
