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
  if (field === 'country' || field === 'branch') return `${label} مطلوبة.`;
  return `${label} مطلوب.`;
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

  const platformName = String(body.platformName || body.platform || '').trim();
  const sectorName = String(body.sectorName || '').trim();
  const subdomain = String(body.subdomain || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  const fullName = String(body.fullName || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const country = String(body.country || '').trim();
  const branch = isHq ? '' : String(body.branch || '').trim();
  const incubator = isHq ? '' : String(body.incubator || '').trim();
  const summary = String(body.summary || '').trim();
  const systems = Array.isArray(body.systems) ? body.systems : [];
  const entitlements = body.opsEntitlements || null;
  const hasEnt = Array.isArray(entitlements?.grants) && entitlements.grants.length > 0;
  const needsSystems = isHq || source === 'incubator' || kind === 'platform';

  if (!platformName) throw fail('platformName');
  if (!sectorName) throw fail('sectorName');
  if (!subdomain) throw fail('subdomain');
  if (!fullName) throw fail('fullName');
  if (!phone) throw fail('phone');
  if (!email) throw fail('email');
  if (!country) throw fail('country');
  if (!isHq && !branch) throw fail('branch');
  if (!isHq && !incubator) throw fail('incubator');
  if (needsSystems && !systems.length && !hasEnt) throw fail('systems');
  if (!summary) throw fail('summary');

  const booking = {
    id: `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    source: isHq ? 'hq' : source || 'generic',
    platformName,
    sectorName,
    subdomain,
    fullName,
    phone,
    email,
    country,
    branch,
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

module.exports = {
  FIELD_LABELS,
  requiredMsg,
  validateAndNormalize,
};
