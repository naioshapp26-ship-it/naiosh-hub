/**
 * Server-side validation for platform booking requests.
 * Must stay aligned with book-platform.html markers + js/hub-booking.js.
 */
'use strict';

const FIELD_LABELS = {
  platformName: 'اسم المنصة',
  sectorName: 'اسم القطاع',
  subdomain: 'الدومين الفرعي',
  fullName: 'الاسم',
  phone: 'رقم الجوال',
  email: 'الإيميل',
  country: 'الدولة',
  branch: 'الفرع',
  incubator: 'الحاضنة',
  summary: 'الشرح المختصر',
  systems: 'الأنظمة التشغيلية',
};

function requiredMsg(field) {
  const label = FIELD_LABELS[field] || field;
  if (field === 'systems') return 'اختر نظامًا تشغيليًا واحدًا على الأقل حسب حاجة العمل.';
  if (field === 'incubator') return 'الحاضنة مطلوبة.';
  if (field === 'email') return 'البريد الإلكتروني مطلوب.';
  if (field === 'country' || field === 'branch') return `${label} مطلوبة.`;
  return `${label} مطلوب.`;
}

/** Practical email check — rejects empty/spaces/missing TLD; allows + and multi-dot domains. */
function isValidEmail(email) {
  const e = String(email || '').trim();
  if (!e) return false;
  if (/\s/.test(e)) return false;
  if (/\.\./.test(e)) return false;
  // local@domain.tld — domain must contain a dot (rejects test@domain)
  return /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(
    e
  );
}

function fail(field, message) {
  const err = new Error(message || requiredMsg(field));
  err.status = 400;
  err.field = field;
  return err;
}

/**
 * @param {object} body
 * @returns {{ ok: true, booking: object } | never}
 */
function validateAndNormalize(body = {}) {
  const source = String(body.source || body.from || '').trim().toLowerCase();
  const isHq = source === 'hq';
  const kind = String(body.kind || 'platform').trim().toLowerCase() || 'platform';
  const isIncubator = kind === 'incubator';
  const isOffice = kind === 'office';
  const isPlatform = !isIncubator && !isOffice;

  let platformName = String(body.platformName || body.platform || '').trim();
  const sectorName = String(body.sectorName || '').trim();
  const subdomain = String(body.subdomain || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  const fullName = String(body.fullName || '').trim();
  const phone = String(body.phone || '').trim();
  const emailRaw = String(body.email || '').trim();
  const email = emailRaw.toLowerCase();
  const country = String(body.country || '').trim();
  const branchRaw = isHq ? '' : String(body.branchName || body.branchLabel || body.branch || '').trim();
  const branch = branchRaw;
  const incubator = isHq ? '' : String(body.incubator || '').trim();
  const summary = String(body.summary || '').trim();
  const systems = Array.isArray(body.systems) ? body.systems : [];
  const entitlements = body.opsEntitlements || null;
  const hasEnt = Array.isArray(entitlements?.grants) && entitlements.grants.length > 0;
  // Systems required for platform bookings (incl. HQ / from incubator), not for incubator/office grants
  const needsSystems = isPlatform && (isHq || source === 'incubator' || kind === 'platform');
  const city = String(body.city || '').trim();
  const address = String(body.address || body.formattedAddress || '').trim();
  const lat = body.lat != null && body.lat !== '' ? Number(body.lat) : null;
  const lng = body.lng != null && body.lng !== '' ? Number(body.lng) : null;
  const locationSource = String(body.locationSource || 'manual').trim().toLowerCase() || 'manual';

  // Derive a display title for non-platform kinds so staff lists stay readable
  if (!platformName && isIncubator) {
    platformName = String(body.incubatorLabel || incubator || 'حجز حاضنة').trim();
  }
  if (!platformName && isOffice) {
    platformName = String(body.officeName || branch || 'حجز مكتب').trim();
  }

  if (isPlatform && !platformName) throw fail('platformName');
  if (!sectorName) throw fail('sectorName');
  if (!subdomain) throw fail('subdomain');
  if (!fullName) throw fail('fullName');
  if (!phone) throw fail('phone');
  if (!email) throw fail('email', 'البريد الإلكتروني مطلوب.');
  if (!isValidEmail(emailRaw)) throw fail('email', 'يرجى إدخال بريد إلكتروني صحيح.');
  // Free-form branch/location — no catalog id required. Country may be filled from geo.
  if (isHq && !country) throw fail('country');
  if (!isHq && !branch) throw fail('branch', 'اكتب اسم الفرع التابع لك أو حدّد موقعك.');
  if (!isHq && isPlatform && !incubator) throw fail('incubator');
  if (isIncubator && !incubator) throw fail('incubator');
  if (needsSystems && !systems.length && !hasEnt) throw fail('systems');
  if (!summary) throw fail('summary');

  const booking = {
    id: `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    source: isHq ? 'hq' : source || (isIncubator ? 'incubator' : isOffice ? 'office' : 'generic'),
    platformName: platformName || (isIncubator ? incubator : branch) || kind,
    sectorName,
    subdomain,
    fullName,
    phone,
    email,
    country: country || '',
    branch,
    branchName: branch,
    branchLabel: branch,
    // Legacy catalog ids no longer required; keep empty for compatibility
    branchId: String(body.branchId || '').trim() || null,
    city,
    address,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    locationSource: ['manual', 'geolocation', 'map', 'mixed'].includes(locationSource)
      ? locationSource
      : 'manual',
    locationConfirmed: !!body.locationConfirmed,
    locationUpdatedAt: new Date().toISOString(),
    incubator,
    summary,
    systems,
    opsEntitlements: entitlements,
    profileFile: body.profileFile || null,
    imageFile: body.imageFile || null,
    videoFile: body.videoFile || null,
    createdAt: new Date().toISOString(),
  };

  return { ok: true, booking };
}

/**
 * Union bookings by id. Prefer the record with the newer createdAt/locationUpdatedAt.
 * Never drops an id that exists in either side — used by hydrate and recovery dry-run.
 */
function mergeBookingsById(a = [], b = []) {
  const map = new Map();
  const score = (row) => {
    const t = Date.parse(row?.locationUpdatedAt || row?.createdAt || 0);
    return Number.isFinite(t) ? t : 0;
  };
  for (const row of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    if (!row || !row.id) continue;
    const prev = map.get(row.id);
    if (!prev || score(row) >= score(prev)) map.set(row.id, row);
  }
  return [...map.values()].sort((x, y) => score(y) - score(x)).slice(0, 500);
}

module.exports = {
  FIELD_LABELS,
  requiredMsg,
  isValidEmail,
  validateAndNormalize,
  mergeBookingsById,
};
