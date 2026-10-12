/**
 * Org catalog for unified identity: incubators + platforms from Postgres.
 * Does not invent rows when the DB is empty (except one-time seed of platforms
 * from lib/catalog-platforms-seed.json into hub_platforms so they become registered).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PLATFORMS_SEED = path.join(__dirname, 'catalog-platforms-seed.json');

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(payload));
}

async function ensurePlatformsSeeded(withClient) {
  const count = await withClient(async (client) => {
    const r = await client.query(`SELECT COUNT(*)::int AS n FROM hub_platforms`);
    return r.rows[0].n;
  });
  if (count > 0) return { seeded: false, count };
  if (!fs.existsSync(PLATFORMS_SEED)) return { seeded: false, count: 0, missingSeed: true };
  const seed = JSON.parse(fs.readFileSync(PLATFORMS_SEED, 'utf8'));
  const platforms = Array.isArray(seed.platforms) ? seed.platforms : [];
  if (!platforms.length) return { seeded: false, count: 0 };
  await withClient(async (client) => {
    for (const p of platforms) {
      await client.query(
        `INSERT INTO hub_platforms (code, name_ar, name_en, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO NOTHING`,
        [p.code, p.name_ar || p.code, p.name_en || '', p.status || 'online']
      );
    }
  });
  const after = await withClient(async (client) => {
    const r = await client.query(`SELECT COUNT(*)::int AS n FROM hub_platforms`);
    return r.rows[0].n;
  });
  return { seeded: true, count: after };
}

async function listIncubators(withClient) {
  return withClient(async (client) => {
    const r = await client.query(
      `SELECT id::text AS id, name_ar, sector, status
       FROM hub_incubators
       WHERE status = 'active'
       ORDER BY name_ar ASC`
    );
    return r.rows;
  });
}

async function listPlatforms(withClient, { incubatorId } = {}) {
  // No incubator↔platform FK in schema yet — return all registered platforms.
  // incubatorId accepted for future filtering; ignored until relation exists.
  void incubatorId;
  return withClient(async (client) => {
    const r = await client.query(
      `SELECT id::text AS id, code, name_ar, name_en, status
       FROM hub_platforms
       WHERE status IS NOT NULL AND status <> 'offline'
       ORDER BY name_ar ASC`
    );
    return r.rows;
  });
}

async function resolveIncubator(withClient, idOrName) {
  const q = String(idOrName || '').trim();
  if (!q) return null;
  return withClient(async (client) => {
    const r = await client.query(
      `SELECT id::text AS id, name_ar, sector, status
       FROM hub_incubators
       WHERE id::text = $1 OR name_ar = $1
       LIMIT 1`,
      [q]
    );
    return r.rows[0] || null;
  });
}

async function resolvePlatform(withClient, codeOrId) {
  const q = String(codeOrId || '').trim();
  if (!q) return null;
  return withClient(async (client) => {
    const r = await client.query(
      `SELECT id::text AS id, code, name_ar, name_en, status
       FROM hub_platforms
       WHERE code = $1 OR id::text = $1
       LIMIT 1`,
      [q]
    );
    return r.rows[0] || null;
  });
}

/**
 * Validate client org affiliation against real catalog rows.
 */
async function validateClientOrg(withClient, body = {}) {
  const incubatorRaw = String(body.incubatorId || body.incubator || '').trim();
  const platformRaw = String(body.platformCode || body.platform || '').trim();
  const branch = String(body.branchName || body.branch || body.branchLabel || '').trim();
  const country = String(body.country || '').trim();
  const city = String(body.city || '').trim();

  if (!incubatorRaw) {
    return { ok: false, field: 'incubatorId', error: 'اختيار الحاضنة إلزامي للعميل.' };
  }
  if (!platformRaw) {
    return { ok: false, field: 'platformCode', error: 'اختيار المنصة إلزامي للعميل.' };
  }
  if (!branch) {
    return { ok: false, field: 'branch', error: 'اكتب اسم الفرع أو البلد التابع له.' };
  }

  const incubator = await resolveIncubator(withClient, incubatorRaw);
  if (!incubator) {
    return { ok: false, field: 'incubatorId', error: 'الحاضنة غير مسجلة في النظام.' };
  }
  const platform = await resolvePlatform(withClient, platformRaw);
  if (!platform) {
    return { ok: false, field: 'platformCode', error: 'المنصة غير مسجلة في النظام.' };
  }

  const lat = body.lat != null && body.lat !== '' ? Number(body.lat) : null;
  const lng = body.lng != null && body.lng !== '' ? Number(body.lng) : null;

  return {
    ok: true,
    affiliation: {
      incubatorId: incubator.id,
      incubatorName: incubator.name_ar,
      platformCode: platform.code,
      platformName: platform.name_ar,
      branch,
      branchName: branch,
      branchLabel: branch,
      country,
      city,
      address: String(body.address || '').trim(),
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      locationSource: String(body.locationSource || 'manual').trim() || 'manual',
      locationConfirmed: !!body.locationConfirmed,
    },
  };
}

function applyAffiliationToClient(client, affiliation) {
  if (!client || !affiliation) return client;
  client.incubatorId = affiliation.incubatorId || '';
  client.incubatorName = affiliation.incubatorName || '';
  client.platformCode = affiliation.platformCode || '';
  client.platformName = affiliation.platformName || '';
  client.branch = affiliation.branch || affiliation.branchName || '';
  client.branchName = affiliation.branchName || affiliation.branch || '';
  client.country = affiliation.country || client.country || '';
  client.city = affiliation.city || client.city || '';
  client.address = affiliation.address || client.address || '';
  client.lat = affiliation.lat;
  client.lng = affiliation.lng;
  client.locationSource = affiliation.locationSource || 'manual';
  client.locationConfirmed = !!affiliation.locationConfirmed;
  client.extras = {
    ...(client.extras || {}),
    orgAffiliation: {
      incubatorId: client.incubatorId,
      incubatorName: client.incubatorName,
      platformCode: client.platformCode,
      platformName: client.platformName,
      branch: client.branch,
      branchName: client.branchName,
      country: client.country,
      city: client.city,
      address: client.address,
      lat: client.lat,
      lng: client.lng,
      locationSource: client.locationSource,
      locationConfirmed: client.locationConfirmed,
    },
  };
  return client;
}

function hydrateAffiliationFromExtras(client) {
  if (!client) return client;
  const aff = client.extras?.orgAffiliation || client.orgAffiliation || null;
  if (!aff) return client;
  if (!client.incubatorId) client.incubatorId = aff.incubatorId || '';
  if (!client.incubatorName) client.incubatorName = aff.incubatorName || '';
  if (!client.platformCode) client.platformCode = aff.platformCode || '';
  if (!client.platformName) client.platformName = aff.platformName || '';
  if (!client.branch && !client.branchName) {
    client.branch = aff.branch || aff.branchName || '';
    client.branchName = aff.branchName || aff.branch || '';
  }
  if (client.lat == null && aff.lat != null) client.lat = aff.lat;
  if (client.lng == null && aff.lng != null) client.lng = aff.lng;
  return client;
}

async function handleOrgCatalogApi(req, res, pathname) {
  if (!pathname.startsWith('/api/hub/catalog/')) return false;
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return true;
  }
  const { getDatabaseUrl, withClient } = require('../db/migrate');
  if (!getDatabaseUrl()) {
    sendJson(res, 503, { ok: false, error: 'قاعدة البيانات غير متصلة — لا يمكن عرض الحاضنات/المنصات.' });
    return true;
  }

  try {
    if (pathname === '/api/hub/catalog/incubators' && req.method === 'GET') {
      const items = await listIncubators(withClient);
      sendJson(res, 200, {
        ok: true,
        count: items.length,
        incubators: items,
        empty: items.length === 0,
        message: items.length ? undefined : 'لا توجد حاضنات مسجّلة في قاعدة البيانات.',
      });
      return true;
    }
    if (pathname === '/api/hub/catalog/platforms' && req.method === 'GET') {
      await ensurePlatformsSeeded(withClient);
      const url = new URL(req.url, 'http://localhost');
      const incubatorId = String(url.searchParams.get('incubatorId') || '').trim();
      const items = await listPlatforms(withClient, { incubatorId });
      sendJson(res, 200, {
        ok: true,
        count: items.length,
        platforms: items,
        empty: items.length === 0,
        incubatorId: incubatorId || null,
        message: items.length ? undefined : 'لا توجد منصات مسجّلة في قاعدة البيانات.',
      });
      return true;
    }
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message || 'تعذر قراءة الكتالوج' });
    return true;
  }
  return false;
}

module.exports = {
  handleOrgCatalogApi,
  listIncubators,
  listPlatforms,
  ensurePlatformsSeeded,
  validateClientOrg,
  applyAffiliationToClient,
  hydrateAffiliationFromExtras,
  resolveIncubator,
  resolvePlatform,
};
