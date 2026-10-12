/**
 * Location / maps config + reverse/forward geocode.
 * Providers:
 *  - Google (optional) when GOOGLE_MAPS_* keys are set
 *  - OpenStreetMap Nominatim (default, no key) with rate-limit + cache
 * Leaflet/OSM map UI does not require Google keys.
 */
'use strict';

const BROWSER_KEY = () => String(process.env.GOOGLE_MAPS_BROWSER_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();
const SERVER_KEY = () => String(process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();

const NOMINATIM_UA =
  String(process.env.HUB_GEO_USER_AGENT || '').trim() ||
  'NaioshHub/1.0 (+https://naiosh-hub-production.up.railway.app; geo@naiosh.local)';

/** @type {Map<string, { at: number, value: object }>} */
const geoCache = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 500;
let lastNominatimAt = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function throttleNominatim() {
  const wait = 1100 - (Date.now() - lastNominatimAt);
  if (wait > 0) await sleep(wait);
  lastNominatimAt = Date.now();
}

function cacheGet(key) {
  const hit = geoCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    geoCache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  if (geoCache.size >= CACHE_MAX) {
    const first = geoCache.keys().next().value;
    if (first) geoCache.delete(first);
  }
  geoCache.set(key, { at: Date.now(), value });
}

function mapsStatus() {
  const browserKey = BROWSER_KEY();
  const serverKey = SERVER_KEY();
  const googleReady = !!(browserKey || serverKey);
  return {
    ok: true,
    mapsEnabled: true,
    browserMapsEnabled: true,
    geocodeEnabled: true,
    leafletEnabled: true,
    provider: googleReady && browserKey ? 'google' : 'osm-leaflet',
    geocodeProvider: serverKey ? 'google' : 'nominatim',
    browserKey: browserKey || '',
    googleAvailable: googleReady,
    earthLinkTemplate: 'https://www.openstreetmap.org/?mlat={lat}&mlon={lng}#map=16/{lat}/{lng}',
    attribution: '© OpenStreetMap contributors',
    note: serverKey
      ? 'خريطة تفاعلية متاحة (Google إن وُجد مفتاح المتصفح، وإلا OpenStreetMap) · التحويل الجغرافي عبر Google.'
      : 'خريطة تفاعلية عبر OpenStreetMap/Leaflet بدون مفاتيح · التحويل الجغرافي عبر Nominatim (مع حد معدّل وتخزين مؤقت). الكتابة اليدوية متاحة دائمًا.',
  };
}

function parseGoogleResult(result, lat, lng) {
  const comps = result?.address_components || [];
  const find = (type) => {
    const c = comps.find((x) => (x.types || []).includes(type));
    return c ? c.long_name : '';
  };
  return {
    ok: true,
    found: !!result,
    provider: 'google',
    lat: Number(lat),
    lng: Number(lng),
    formattedAddress: result?.formatted_address || '',
    country: find('country'),
    city: find('locality') || find('administrative_area_level_2') || find('administrative_area_level_1'),
    region: find('administrative_area_level_1'),
    placeId: result?.place_id || '',
  };
}

function parseNominatimResult(data, lat, lng) {
  const addr = data?.address || {};
  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.suburb ||
    addr.county ||
    addr.state ||
    '';
  return {
    ok: true,
    found: !!data,
    provider: 'nominatim',
    lat: Number(lat),
    lng: Number(lng),
    formattedAddress: data?.display_name || '',
    country: addr.country || '',
    city,
    region: addr.state || addr.region || '',
    placeId: data?.place_id != null ? String(data.place_id) : '',
  };
}

async function reverseViaGoogle(lat, lng) {
  const key = SERVER_KEY();
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(lat + ',' + lng)}&language=ar&key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    const err = new Error(data.error_message || `Geocoding failed: ${data.status}`);
    err.status = 502;
    throw err;
  }
  const result = (data.results && data.results[0]) || null;
  return parseGoogleResult(result, lat, lng);
}

async function reverseViaNominatim(lat, lng) {
  const cacheKey = `rev:${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true };

  await throttleNominatim();
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=jsonv2&accept-language=ar&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': NOMINATIM_UA,
    },
  });
  if (!res.ok) {
    const err = new Error(`Nominatim reverse failed (${res.status})`);
    err.status = 502;
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  const out = parseNominatimResult(data, lat, lng);
  cacheSet(cacheKey, out);
  return out;
}

async function reverseGeocode(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) {
    const err = new Error('إحداثيات غير صالحة');
    err.status = 400;
    throw err;
  }
  if (SERVER_KEY()) {
    try {
      return await reverseViaGoogle(la, ln);
    } catch (e) {
      // fall through to Nominatim
      if (e.status === 400) throw e;
    }
  }
  return reverseViaNominatim(la, ln);
}

async function forwardViaGoogle(query) {
  const key = SERVER_KEY();
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&language=ar&key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    const err = new Error(data.error_message || `Geocoding failed: ${data.status}`);
    err.status = 502;
    throw err;
  }
  const result = (data.results && data.results[0]) || null;
  if (!result) return { ok: true, found: false, provider: 'google' };
  const loc = result.geometry?.location || {};
  return { ok: true, found: true, ...parseGoogleResult(result, loc.lat, loc.lng) };
}

async function forwardViaNominatim(query) {
  const cacheKey = `fwd:${query.toLowerCase()}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true };

  await throttleNominatim();
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&accept-language=ar&addressdetails=1&limit=1`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': NOMINATIM_UA,
    },
  });
  if (!res.ok) {
    const err = new Error(`Nominatim search failed (${res.status})`);
    err.status = 502;
    throw err;
  }
  const arr = await res.json().catch(() => []);
  const data = Array.isArray(arr) ? arr[0] : null;
  if (!data) return { ok: true, found: false, provider: 'nominatim' };
  const out = {
    ok: true,
    found: true,
    ...parseNominatimResult(data, data.lat, data.lon),
  };
  cacheSet(cacheKey, out);
  return out;
}

async function forwardGeocode(query) {
  const q = String(query || '').trim();
  if (!q) {
    const err = new Error('أدخل عنوانًا أو اسم مكان');
    err.status = 400;
    throw err;
  }
  if (SERVER_KEY()) {
    try {
      return await forwardViaGoogle(q);
    } catch (e) {
      if (e.status === 400) throw e;
    }
  }
  return forwardViaNominatim(q);
}

function normalizeLocationPayload(body = {}) {
  const branchName = String(body.branchName || body.branch || body.branchLabel || '').trim();
  const country = String(body.country || '').trim();
  const city = String(body.city || '').trim();
  const address = String(body.address || body.formattedAddress || '').trim();
  const lat = body.lat != null && body.lat !== '' ? Number(body.lat) : null;
  const lng = body.lng != null && body.lng !== '' ? Number(body.lng) : null;
  const source = String(body.locationSource || body.source || 'manual').trim().toLowerCase();
  const allowed = new Set(['manual', 'geolocation', 'map', 'mixed']);
  return {
    branchName,
    branch: branchName,
    branchLabel: branchName,
    country,
    city,
    address,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    locationSource: allowed.has(source) ? source : 'manual',
    locationConfirmed: !!body.locationConfirmed,
    locationUpdatedAt: body.locationUpdatedAt || new Date().toISOString(),
    earthUrl:
      Number.isFinite(lat) && Number.isFinite(lng)
        ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
        : '',
  };
}

async function handleApi(req, res, pathname, { sendJson, readBody }) {
  if (pathname === '/api/hub/geo/config' && req.method === 'GET') {
    sendJson(res, 200, mapsStatus());
    return true;
  }
  if (pathname === '/api/hub/geo/reverse' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const out = await reverseGeocode(body?.lat, body?.lng);
      sendJson(res, 200, out);
    } catch (err) {
      sendJson(res, err.status || 500, { ok: false, error: err.message, code: err.code });
    }
    return true;
  }
  if (pathname === '/api/hub/geo/geocode' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const out = await forwardGeocode(body?.query || body?.address);
      sendJson(res, 200, out);
    } catch (err) {
      sendJson(res, err.status || 500, { ok: false, error: err.message, code: err.code });
    }
    return true;
  }
  return false;
}

module.exports = {
  mapsStatus,
  reverseGeocode,
  forwardGeocode,
  normalizeLocationPayload,
  handleApi,
};
