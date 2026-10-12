/**
 * Google Maps / Geocoding proxy + public config.
 * Browser key (referrer-restricted) may be exposed; server key never is.
 */
'use strict';

const BROWSER_KEY = () => String(process.env.GOOGLE_MAPS_BROWSER_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();
const SERVER_KEY = () => String(process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();

function mapsStatus() {
  const browserKey = BROWSER_KEY();
  const serverKey = SERVER_KEY();
  return {
    ok: true,
    mapsEnabled: !!(browserKey || serverKey),
    browserMapsEnabled: !!browserKey,
    geocodeEnabled: !!serverKey,
    browserKey: browserKey || '',
    earthLinkTemplate: 'https://earth.google.com/web/@{lat},{lng},100a,1000d,35y,0h,0t,0r',
    note: !browserKey && !serverKey
      ? 'خدمات Google Maps غير مفعّلة — يمكن كتابة اسم الفرع يدويًا دون خريطة.'
      : !serverKey
        ? 'مفتاح المتصفح متاح للخريطة؛ التحويل العكسي عبر المتصفح إن وُجد Geocoder.'
        : 'خرائط Google مفعّلة عبر مفاتيح البيئة.',
  };
}

async function reverseGeocode(lat, lng) {
  const key = SERVER_KEY();
  if (!key) {
    const err = new Error('خدمة التحويل الجغرافي غير مفعّلة على الخادم');
    err.status = 503;
    err.code = 'GEOCODE_DISABLED';
    throw err;
  }
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) {
    const err = new Error('إحداثيات غير صالحة');
    err.status = 400;
    throw err;
  }
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(la + ',' + ln)}&language=ar&key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    const err = new Error(data.error_message || `Geocoding failed: ${data.status}`);
    err.status = 502;
    throw err;
  }
  const result = (data.results && data.results[0]) || null;
  return parseGeocodeResult(result, la, ln);
}

async function forwardGeocode(query) {
  const key = SERVER_KEY();
  if (!key) {
    const err = new Error('خدمة التحويل الجغرافي غير مفعّلة على الخادم');
    err.status = 503;
    err.code = 'GEOCODE_DISABLED';
    throw err;
  }
  const q = String(query || '').trim();
  if (!q) {
    const err = new Error('أدخل عنوانًا أو اسم مكان');
    err.status = 400;
    throw err;
  }
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&language=ar&key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    const err = new Error(data.error_message || `Geocoding failed: ${data.status}`);
    err.status = 502;
    throw err;
  }
  const result = (data.results && data.results[0]) || null;
  if (!result) return { ok: true, found: false };
  const loc = result.geometry?.location || {};
  return { ok: true, found: true, ...parseGeocodeResult(result, loc.lat, loc.lng) };
}

function parseGeocodeResult(result, lat, lng) {
  const comps = result?.address_components || [];
  const find = (type) => {
    const c = comps.find((x) => (x.types || []).includes(type));
    return c ? c.long_name : '';
  };
  return {
    ok: true,
    found: !!result,
    lat: Number(lat),
    lng: Number(lng),
    formattedAddress: result?.formatted_address || '',
    country: find('country'),
    city: find('locality') || find('administrative_area_level_2') || find('administrative_area_level_1'),
    region: find('administrative_area_level_1'),
    placeId: result?.place_id || '',
  };
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
        ? `https://earth.google.com/web/@${lat},${lng},100a,1000d,35y,0h,0t,0r`
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
