/**
 * Live FX rates (USD base) with disk cache.
 * Provider: open.er-api.com (no API key for USD latest).
 * Display conversion only — payment settlement currencies are separate.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const CACHE_PATH = path.join(__dirname, '..', 'data', 'fx-rates-usd.json');
const CACHE_TTL_MS = Math.max(15 * 60 * 1000, Number(process.env.HUB_FX_CACHE_TTL_MS || 60 * 60 * 1000));
const PROVIDER_URL = process.env.HUB_FX_PROVIDER_URL || 'https://open.er-api.com/v6/latest/USD';

let memoryCache = null;

function readDisk() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeDisk(payload) {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.warn('[fx] cache write failed:', err.message);
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 12000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`FX HTTP ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('FX timeout'));
    });
  });
}

function normalizeProvider(data) {
  const rates = data && (data.rates || data.conversion_rates);
  if (!rates || typeof rates !== 'object' || !rates.USD) {
    throw new Error('FX payload missing rates');
  }
  const updatedAt =
    data.time_last_update_utc ||
    data.time_last_update_unix ||
    data.date ||
    new Date().toISOString();
  return {
    base: 'USD',
    rates: Object.fromEntries(
      Object.entries(rates).map(([k, v]) => [String(k).toUpperCase(), Number(v)]).filter(([, v]) => Number.isFinite(v) && v > 0)
    ),
    provider: data.provider || 'open.er-api.com',
    updatedAt: typeof updatedAt === 'number' ? new Date(updatedAt * 1000).toISOString() : String(updatedAt),
    fetchedAt: new Date().toISOString(),
  };
}

async function refreshRates() {
  const raw = await fetchJson(PROVIDER_URL);
  const normalized = normalizeProvider(raw);
  memoryCache = normalized;
  writeDisk(normalized);
  return normalized;
}

async function getRates({ force } = {}) {
  const now = Date.now();
  if (!force && memoryCache && memoryCache.fetchedAt) {
    const age = now - Date.parse(memoryCache.fetchedAt);
    if (Number.isFinite(age) && age < CACHE_TTL_MS) return memoryCache;
  }
  const disk = readDisk();
  if (!force && disk && disk.fetchedAt) {
    const age = now - Date.parse(disk.fetchedAt);
    if (Number.isFinite(age) && age < CACHE_TTL_MS) {
      memoryCache = disk;
      return disk;
    }
  }
  try {
    return await refreshRates();
  } catch (err) {
    if (disk && disk.rates) {
      memoryCache = { ...disk, stale: true, error: err.message };
      return memoryCache;
    }
    if (memoryCache && memoryCache.rates) {
      return { ...memoryCache, stale: true, error: err.message };
    }
    throw err;
  }
}

/** Currency decimal places (display). ISO-4217 subset. */
const CURRENCY_DECIMALS = {
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  CLF: 4,
  UYI: 0,
  VND: 0,
  JPY: 0,
  KRW: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
};

function decimalsFor(code) {
  const c = String(code || 'USD').toUpperCase();
  if (Object.prototype.hasOwnProperty.call(CURRENCY_DECIMALS, c)) return CURRENCY_DECIMALS[c];
  return 2;
}

function convertFromUsd(amountUsd, currency, rates) {
  const code = String(currency || 'USD').toUpperCase();
  const usd = Number(amountUsd);
  if (!Number.isFinite(usd)) return null;
  if (code === 'USD') {
    return { currency: 'USD', amount: usd, rate: 1, decimals: decimalsFor('USD') };
  }
  const rate = rates && rates[code];
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const decimals = decimalsFor(code);
  const factor = 10 ** decimals;
  const amount = Math.round(usd * rate * factor) / factor;
  return { currency: code, amount, rate, decimals };
}

module.exports = {
  getRates,
  refreshRates,
  convertFromUsd,
  decimalsFor,
  CACHE_TTL_MS,
};
