/**
 * موافقات المدير الأعلى — مصدر الحقيقة على السيرفر (ملف + Postgres).
 * يمنع ضياع الطلبات بين متصفحات مختلفة ويمنع نجاح التسجيل دون سجل موافقة.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE_PATH = path.join(__dirname, '..', 'data', 'higher-approvals.json');
const SEQ_PATH = path.join(__dirname, '..', 'data', 'higher-approvals-seq.json');
const META_KEY = 'higher_approvals_v1';

const STATUS = {
  PENDING: 'pending_review',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  NEEDS_REVISION: 'needs_revision',
  REFERRED: 'referred',
};

const OPEN_STATUSES = new Set([STATUS.PENDING, STATUS.UNDER_REVIEW, STATUS.NEEDS_REVISION]);
/** Block new tickets for a source while one is still in the leader/specialist pipeline */
const BLOCK_NEW_SOURCE_STATUSES = new Set([
  STATUS.PENDING,
  STATUS.UNDER_REVIEW,
  STATUS.NEEDS_REVISION,
  STATUS.REFERRED,
]);

const STATUS_AR = {
  [STATUS.PENDING]: 'بانتظار المراجعة',
  [STATUS.UNDER_REVIEW]: 'تحت المراجعة',
  [STATUS.APPROVED]: 'تمت الموافقة',
  [STATUS.REJECTED]: 'مرفوضة',
  [STATUS.NEEDS_REVISION]: 'أعيدت للتعديل',
  [STATUS.REFERRED]: 'أُحيلت للمختص',
};

const TYPE_AR = {
  platform_grant: 'اعتماد إضافة منصة',
  system_rental: 'اعتماد استئجار نظام',
  role_grant: 'اعتماد إضافة صلاحيات موظف',
  role_change: 'اعتماد تغيير صلاحيات موظف',
  permission_change: 'تعديل صلاحيات',
  system_access: 'منح وصول لنظام',
  identity_suspend: 'إيقاف حساب موظف',
  reward_approval: 'اعتماد مكافأة موظف',
  sensitive_op: 'عملية حساسة',
};

const SOURCE_AR = {
  team_ops: 'إدارة فريق العمل والصلاحيات',
  platform_grants: 'سجل معنا / منح المنصات',
  rent_store: 'استئجار الأنظمة',
  workforce: 'القوى العاملة',
  identity: 'هوية نايوش',
  store: 'المتجر',
  finance: 'المالية',
  systems: 'إدارة الأنظمة',
  projects: 'إدارة المشاريع',
  clients: 'إدارة العملاء',
};

const DECIDER_ROLES = new Set([
  'supreme_leader',
  'chief_engineer',
  'platform_owner',
  'super_admin',
  'SUPER_ADMIN',
  'admin',
  'empire_governor',
  'EMPIRE_GOVERNOR',
]);

let mem = null;
let hydrated = false;
let dbWriteQueue = Promise.resolve();
let lastPersistError = null;

function nowIso() {
  return new Date().toISOString();
}

function blank() {
  return {
    schemaVersion: 3,
    seq: 0,
    year: new Date().getFullYear(),
    requests: [],
    decisions: [],
    updatedAt: nowIso(),
  };
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function dbEnabled() {
  try {
    return !!require('../db/migrate').getDatabaseUrl();
  } catch {
    return false;
  }
}

function readFileStore() {
  ensureDir(STORE_PATH);
  if (!fs.existsSync(STORE_PATH)) {
    const b = blank();
    fs.writeFileSync(STORE_PATH, JSON.stringify(b, null, 2), 'utf8');
    return b;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return {
      ...blank(),
      ...raw,
      requests: Array.isArray(raw.requests) ? raw.requests : [],
      decisions: Array.isArray(raw.decisions) ? raw.decisions : [],
    };
  } catch {
    return blank();
  }
}

function writeFileStore(store) {
  ensureDir(STORE_PATH);
  const next = { ...store, updatedAt: nowIso() };
  const tmp = `${STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmp, STORE_PATH);
  mem = next;
  return next;
}

function nextIdSync(store) {
  const year = new Date().getFullYear();
  if (Number(store.year) !== year) {
    store.year = year;
    store.seq = 0;
  }
  store.seq = Number(store.seq || 0) + 1;
  ensureDir(SEQ_PATH);
  fs.writeFileSync(SEQ_PATH, JSON.stringify({ year: store.year, n: store.seq }, null, 2), 'utf8');
  return `APR-${store.year}-${String(store.seq).padStart(5, '0')}`;
}

function normalizeRequest(r) {
  if (!r || typeof r !== 'object') return r;
  if (!r.title) r.title = r.typeLabel || r.affectedLabel || 'طلب موافقة';
  if (!r.sourceModule) r.sourceModule = r.sourceType || 'HUB';
  if (!r.sourceModuleLabel) {
    r.sourceModuleLabel = SOURCE_AR[r.sourceModule] || r.systemLabel || r.workplace || 'النظام';
  }
  if (!r.operation) r.operation = r.type || 'sensitive_op';
  if (!r.operationLabel) r.operationLabel = r.typeLabel || TYPE_AR[r.operation] || r.operation;
  if (!r.priority) r.priority = 'normal';
  if (!r.department) r.department = r.workplace || r.sourceModuleLabel || '';
  if (!Array.isArray(r.history)) r.history = [];
  if (!Array.isArray(r.attachments)) r.attachments = [];
  return r;
}

function actorMeta(actor) {
  if (!actor) return { name: 'نظام', employeeNo: '', email: '', role: '', naioshId: '' };
  if (typeof actor === 'string') return { name: actor, employeeNo: '', email: '', role: '', naioshId: '' };
  return {
    name: actor.name || actor.email || 'مشغّل هوب',
    employeeNo: actor.employeeNo || actor.empNo || '',
    email: String(actor.email || '').toLowerCase(),
    naioshId: actor.naioshId || actor.id || '',
    role: actor.role || actor.roleCode || '',
  };
}

function canDecide(actor) {
  const a = actorMeta(actor);
  const role = String(a.role || '').toLowerCase();
  if (DECIDER_ROLES.has(a.role) || DECIDER_ROLES.has(role)) return true;
  if (role === 'customer' || role === 'client' || role === 'client_user') return false;
  if (a.employeeNo && String(a.employeeNo).indexOf('EMP-') === 0) {
    if (role.includes('leader') || role.includes('owner') || role === 'admin') return true;
  }
  return false;
}

function publicRequest(row) {
  if (!row) return null;
  const copy = normalizeRequest({ ...row });
  if (copy.applyPayload && typeof copy.applyPayload === 'object') {
    const ap = { ...copy.applyPayload };
    delete ap.adminPassword;
    copy.applyPayload = ap;
  }
  return copy;
}

async function persistRowToPg(row) {
  if (!dbEnabled() || !row?.id) return { ok: true, skipped: true };
  const { withClient } = require('../db/migrate');
  await withClient(async (client) => {
    // If another open/referred row already owns this source, update that row instead of inserting a clash.
    if (row.sourceType && row.sourceId && BLOCK_NEW_SOURCE_STATUSES.has(row.status || STATUS.PENDING)) {
      const existing = await client.query(
        `SELECT id FROM hub_higher_approvals
          WHERE source_type = $1 AND source_id = $2
            AND status IN ('pending_review','under_review','needs_revision','referred')
            AND id <> $3
          LIMIT 1`,
        [row.sourceType, String(row.sourceId), row.id]
      );
      if (existing.rows[0]?.id) {
        await client.query(
          `UPDATE hub_higher_approvals
              SET status = $2, operation = $3, source_module = $4, priority = $5,
                  requester_email = $6, subject_naiosh_id = $7, title = $8,
                  payload = $9::jsonb, updated_at = NOW(),
                  decided_at = $10::timestamptz, decided_by = $11
            WHERE id = $1`,
          [
            existing.rows[0].id,
            row.status || STATUS.PENDING,
            row.operation || row.type || 'sensitive_op',
            row.sourceModule || '',
            row.priority || 'normal',
            String(row.requesterEmail || '').toLowerCase(),
            row.subjectNaioshId || '',
            row.title || '',
            JSON.stringify({ ...row, id: existing.rows[0].id }),
            row.decidedAt || null,
            row.decidedBy || null,
          ]
        );
        return;
      }
    }
    await client.query(
      `INSERT INTO hub_higher_approvals (
         id, source_type, source_id, status, operation, source_module, priority,
         requester_email, subject_naiosh_id, title, payload, created_at, updated_at,
         decided_at, decided_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,
         COALESCE($12::timestamptz, NOW()), NOW(),
         $13::timestamptz, $14
       )
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         operation = EXCLUDED.operation,
         source_module = EXCLUDED.source_module,
         priority = EXCLUDED.priority,
         requester_email = EXCLUDED.requester_email,
         subject_naiosh_id = EXCLUDED.subject_naiosh_id,
         title = EXCLUDED.title,
         payload = EXCLUDED.payload,
         updated_at = NOW(),
         decided_at = EXCLUDED.decided_at,
         decided_by = EXCLUDED.decided_by`,
      [
        row.id,
        row.sourceType || '',
        row.sourceId ? String(row.sourceId) : '',
        row.status || STATUS.PENDING,
        row.operation || row.type || 'sensitive_op',
        row.sourceModule || '',
        row.priority || 'normal',
        String(row.requesterEmail || '').toLowerCase(),
        row.subjectNaioshId || '',
        row.title || '',
        JSON.stringify(row),
        row.createdAt || null,
        row.decidedAt || null,
        row.decidedBy || null,
      ]
    );
  });
  return { ok: true };
}

async function persistDecisionToPg(dec) {
  if (!dbEnabled() || !dec?.id) return { ok: true, skipped: true };
  const { withClient } = require('../db/migrate');
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO hub_higher_approval_decisions (
         id, request_id, decision, decided_by, decided_by_employee_no, reason,
         before_status, after_status, payload, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb, COALESCE($10::timestamptz, NOW()))
       ON CONFLICT (id) DO NOTHING`,
      [
        dec.id,
        dec.requestId,
        dec.decision,
        dec.decidedBy || '',
        dec.decidedByEmployeeNo || '',
        dec.reason || '',
        dec.beforeStatus || '',
        dec.afterStatus || '',
        JSON.stringify(dec),
        dec.decidedAt || null,
      ]
    );
  });
  return { ok: true };
}

async function persistMetaBlob(store) {
  if (!dbEnabled()) return { ok: true, skipped: true };
  const { withClient } = require('../db/migrate');
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO hub_meta (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [META_KEY, JSON.stringify(store)]
    );
  });
  return { ok: true };
}

function enqueuePersist(store) {
  lastPersistError = null;
  dbWriteQueue = dbWriteQueue
    .then(async () => {
      if (!dbEnabled()) return;
      for (const row of store.requests || []) {
        await persistRowToPg(row);
      }
      for (const dec of store.decisions || []) {
        await persistDecisionToPg(dec);
      }
      await persistMetaBlob(store);
    })
    .catch((err) => {
      lastPersistError = err;
      console.warn('[higher-approvals] persist failed:', err.message);
    });
  return dbWriteQueue;
}

async function flushDurable() {
  await dbWriteQueue;
  if (dbEnabled() && lastPersistError) {
    const err = new Error(`فشل الحفظ الدائم للموافقات: ${lastPersistError.message}`);
    err.status = 503;
    err.code = 'DURABLE_PERSIST_FAILED';
    throw err;
  }
  return { ok: true };
}

async function ensureTables() {
  if (!dbEnabled()) return;
  const { withClient } = require('../db/migrate');
  await withClient(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS hub_higher_approvals (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL DEFAULT '',
        source_id TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending_review',
        operation TEXT NOT NULL DEFAULT 'sensitive_op',
        source_module TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL DEFAULT 'normal',
        requester_email TEXT NOT NULL DEFAULT '',
        subject_naiosh_id TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '',
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        decided_at TIMESTAMPTZ,
        decided_by TEXT
      )`);
    await client.query(`CREATE INDEX IF NOT EXISTS hub_higher_approvals_status_idx ON hub_higher_approvals (status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS hub_higher_approvals_created_idx ON hub_higher_approvals (created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS hub_higher_approvals_source_idx ON hub_higher_approvals (source_type, source_id)`);
    await client.query(`
      DELETE FROM hub_higher_approvals a
        USING hub_higher_approvals b
       WHERE a.source_id <> ''
         AND a.source_type = b.source_type
         AND a.source_id = b.source_id
         AND a.id <> b.id
         AND a.status IN ('pending_review', 'under_review', 'needs_revision', 'referred')
         AND b.status IN ('pending_review', 'under_review', 'needs_revision', 'referred')
         AND (
           a.created_at < b.created_at
           OR (a.created_at = b.created_at AND a.id < b.id)
         )`);
    await client.query(`DROP INDEX IF EXISTS hub_higher_approvals_open_source_uidx`);
    await client.query(`
      CREATE UNIQUE INDEX hub_higher_approvals_open_source_uidx
        ON hub_higher_approvals (source_type, source_id)
        WHERE source_id <> '' AND status IN ('pending_review', 'under_review', 'needs_revision', 'referred')`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS hub_higher_approval_decisions (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL REFERENCES hub_higher_approvals(id) ON DELETE CASCADE,
        decision TEXT NOT NULL,
        decided_by TEXT,
        decided_by_employee_no TEXT DEFAULT '',
        reason TEXT DEFAULT '',
        before_status TEXT DEFAULT '',
        after_status TEXT DEFAULT '',
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await client.query(`
      CREATE INDEX IF NOT EXISTS hub_higher_approval_decisions_req_idx
        ON hub_higher_approval_decisions (request_id, created_at DESC)`);
  });
}

async function hydrateFromDb() {
  const fileStore = readFileStore();
  if (!dbEnabled()) {
    mem = fileStore;
    hydrated = true;
    return { ok: true, source: 'file', store: mem };
  }
  try {
    await ensureTables();
    const { withClient } = require('../db/migrate');
    const fromRows = await withClient(async (client) => {
      const r = await client.query(
        `SELECT payload, status, decided_at, decided_by, updated_at
         FROM hub_higher_approvals
         ORDER BY created_at DESC
         LIMIT 2000`
      );
      return r.rows;
    });
    const byId = new Map();
    (fileStore.requests || []).forEach((row) => {
      if (row?.id) byId.set(row.id, normalizeRequest(row));
    });
    for (const pg of fromRows) {
      let row = null;
      if (pg.payload && typeof pg.payload === 'object' && !Array.isArray(pg.payload)) {
        row = { ...pg.payload };
      } else if (typeof pg.payload === 'string') {
        try {
          row = JSON.parse(pg.payload);
        } catch {
          row = null;
        }
      }
      if (!row?.id) continue;
      row.status = pg.status || row.status;
      if (pg.decided_at) row.decidedAt = pg.decided_at;
      if (pg.decided_by) row.decidedBy = pg.decided_by;
      const prev = byId.get(row.id);
      byId.set(row.id, normalizeRequest(prev ? { ...prev, ...row } : row));
    }

    let decisions = Array.isArray(fileStore.decisions) ? fileStore.decisions.slice() : [];
    try {
      const decRows = await withClient(async (client) => {
        const r = await client.query(
          `SELECT payload FROM hub_higher_approval_decisions ORDER BY created_at DESC LIMIT 2000`
        );
        return r.rows;
      });
      const dMap = new Map(decisions.filter((d) => d?.id).map((d) => [d.id, d]));
      for (const dr of decRows) {
        let d = dr.payload;
        if (typeof d === 'string') {
          try {
            d = JSON.parse(d);
          } catch {
            d = null;
          }
        }
        if (d?.id) dMap.set(d.id, d);
      }
      decisions = [...dMap.values()];
    } catch (_) {
      /* decisions table may be empty on first boot */
    }

    const merged = {
      ...blank(),
      ...fileStore,
      requests: [...byId.values()].sort((a, b) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      ),
      decisions: decisions.sort((a, b) => String(b.decidedAt || b.createdAt || '').localeCompare(String(a.decidedAt || a.createdAt || ''))),
    };
    mem = writeFileStore(merged);
    hydrated = true;
    return { ok: true, source: 'db', store: mem, count: merged.requests.length };
  } catch (err) {
    console.warn('[higher-approvals] hydrate skipped:', err.message);
    mem = fileStore;
    hydrated = true;
    return { ok: false, error: err.message, store: mem };
  }
}

async function ensureHydrated() {
  if (hydrated && mem) return mem;
  await hydrateFromDb();
  return mem || readFileStore();
}

function readStore() {
  if (mem) return mem;
  mem = readFileStore();
  return mem;
}

function writeStore(store) {
  const next = writeFileStore(store);
  enqueuePersist(next);
  return next;
}

function findBySource(store, sourceType, sourceId) {
  const sid = String(sourceId || '');
  if (!sourceType || !sid) return null;
  return (
    (store.requests || []).find(
      (r) =>
        r.sourceType === sourceType &&
        String(r.sourceId) === sid &&
        BLOCK_NEW_SOURCE_STATUSES.has(r.status)
    ) || null
  );
}

function findById(store, id) {
  return (store.requests || []).find((r) => r.id === id) || null;
}

function buildRequest(payload = {}, actor) {
  const a = actorMeta(actor);
  const type = payload.type || payload.operation || 'sensitive_op';
  const sourceModule = payload.sourceModule || payload.sourceType || 'HUB';
  const sourceModuleLabel =
    payload.sourceModuleLabel || SOURCE_AR[sourceModule] || payload.systemLabel || 'النظام';
  const operation = payload.operation || type;
  const operationLabel = payload.operationLabel || payload.typeLabel || TYPE_AR[type] || type;
  const title = payload.title || `${operationLabel}${payload.subjectName ? ` — ${payload.subjectName}` : ''}`;
  return normalizeRequest({
    id: payload.id || null,
    title,
    type,
    typeLabel: payload.typeLabel || TYPE_AR[type] || type,
    status: payload.status || STATUS.PENDING,
    priority: payload.priority || 'normal',
    sourceModule,
    sourceModuleLabel,
    operation,
    operationLabel,
    department: payload.department || sourceModuleLabel,
    branch: payload.branch || payload.branchLabel || '',
    org: payload.org || payload.companyName || payload.workplace || '',
    requesterName: payload.requesterName || a.name,
    requesterEmployeeNo: payload.requesterEmployeeNo || a.employeeNo || '',
    requesterEmail: payload.requesterEmail || a.email || '',
    requesterNaioshId: payload.requesterNaioshId || a.naioshId || '',
    subjectName: payload.subjectName || '',
    subjectEmployeeNo: payload.subjectEmployeeNo || '',
    subjectNaioshId: payload.subjectNaioshId || '',
    workplace: payload.workplace || payload.systemLabel || '',
    system: payload.system || 'HUB',
    systemLabel: payload.systemLabel || payload.system || sourceModuleLabel,
    affectedLabel: payload.affectedLabel || payload.subjectName || payload.typeLabel || '—',
    reason: payload.reason || '',
    currentValue: payload.currentValue || null,
    requestedValue: payload.requestedValue || null,
    currentDisplay: payload.currentDisplay || '',
    requestedDisplay: payload.requestedDisplay || '',
    impactIfApproved:
      payload.impactIfApproved ||
      (payload.requestedDisplay
        ? `سيتم تطبيق: ${String(payload.requestedDisplay).replace(/\n/g, ' · ')}`
        : 'سيتم تنفيذ العملية المرتبطة بهذا الطلب فور الاعتماد.'),
    impactIfRejected: payload.impactIfRejected || 'لن تُنفَّذ العملية وستبقى الحالة كما هي قبل الطلب.',
    applyPayload: payload.applyPayload || null,
    sourceType: payload.sourceType || '',
    sourceId: payload.sourceId ? String(payload.sourceId) : '',
    sourceLink: payload.sourceLink || '',
    attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    referredTo: payload.referredTo || '',
    referredToLabel: payload.referredToLabel || '',
    revisionNote: '',
    rejectReason: '',
    createdAt: payload.createdAt || nowIso(),
    updatedAt: nowIso(),
    decidedAt: '',
    decidedBy: '',
    decidedByEmployeeNo: '',
    history: Array.isArray(payload.history)
      ? payload.history
      : [
          {
            at: nowIso(),
            action: 'created',
            by: a.name,
            detail: `إنشاء طلب موافقة من ${sourceModuleLabel}`,
          },
        ],
  });
}

function notifyRuntime(payload) {
  try {
    const hubRuntime = require('../db/hub-runtime');
    return hubRuntime.addNotification({
      title: payload.title,
      body: payload.body,
      level: payload.level || 'warning',
      category: payload.category || 'ops',
      source: payload.source || 'HIGHER_APPROVALS',
      sourceName: payload.sourceName || 'موافقات المدير الأعلى',
      link: payload.link || 'dashboard.html#rent-admin',
      actionLabel: payload.actionLabel,
      actionLink: payload.actionLink,
      needsAction: !!payload.needsAction,
      referenceType: 'higher_approval',
      referenceId: payload.referenceId,
      requestId: payload.requestId,
      targetEmail: payload.targetEmail || payload.meta?.email || '',
      meta: payload.meta || {},
    });
  } catch (err) {
    console.warn('[higher-approvals] notify failed:', err.message);
    return null;
  }
}

/**
 * Create (or return existing open) approval. Flushes to Postgres when available.
 * Throws on durable persist failure so callers can fail the originating request.
 */
async function createRequest(payload = {}, actor, opts = {}) {
  await ensureHydrated();
  const store = readStore();
  if (payload.sourceType && payload.sourceId) {
    const existing = findBySource(store, payload.sourceType, payload.sourceId);
    if (existing) return { ok: true, request: publicRequest(existing), deduped: true };
  }
  const row = buildRequest(payload, actor);
  if (!row.id) row.id = nextIdSync(store);
  // Race-safe: if id collision, bump
  while (findById(store, row.id)) {
    row.id = nextIdSync(store);
  }
  store.requests.unshift(row);
  writeStore(store);
  if (opts.flush !== false) {
    await flushDurable();
  }
  if (opts.silent !== true && payload.silent !== true) {
    notifyRuntime({
      title: `طلب جديد لاعتماد ${row.operationLabel}`,
      body: `${row.title} · المصدر: ${row.sourceModuleLabel} · مقدم الطلب: ${row.requesterName}`,
      level: 'warning',
      needsAction: true,
      link: `dashboard.html#rent-admin?apr=${encodeURIComponent(row.id)}`,
      actionLabel: 'مراجعة الطلب',
      actionLink: `dashboard.html#rent-admin?apr=${encodeURIComponent(row.id)}`,
      referenceId: row.id,
      requestId: row.id,
    });
  }
  return { ok: true, request: publicRequest(row), deduped: false };
}

function platformGrantPayload(grant) {
  if (!grant?.id) return null;
  return {
    type: 'platform_grant',
    typeLabel: TYPE_AR.platform_grant,
    title: `اعتماد إضافة منصة — ${grant.companyName || grant.platformLabel || grant.host || grant.id}`,
    sourceModule: 'platform_grants',
    sourceModuleLabel: SOURCE_AR.platform_grants,
    operation: 'platform_grant',
    operationLabel: 'اعتماد إضافة منصة',
    sourceType: 'platform_grant',
    sourceId: grant.id,
    sourceLink: 'dashboard.html#rent-admin',
    requesterName: grant.adminName || grant.companyName || 'عميل',
    requesterEmail: grant.adminEmail || '',
    subjectName: grant.companyName || grant.adminName || grant.host || 'منصة',
    workplace: [grant.branchLabel, grant.incubatorLabel].filter(Boolean).join(' · '),
    branch: grant.branchLabel || grant.branch || '',
    org: grant.companyName || grant.platformLabel || '',
    department: 'منح المنصات',
    priority: 'high',
    system: grant.requestedSystem || grant.platform || 'HUB',
    systemLabel: grant.requestedSystemLabel || grant.platformLabel || 'سجل معنا',
    affectedLabel: grant.host || grant.companyName || grant.id,
    reason: grant.notes || 'طلب تسجيل منصة ومنح نظام',
    currentDisplay: 'لا وصول مفعّل بعد',
    requestedDisplay: `منح النظام: ${grant.requestedSystemLabel || grant.requestedSystem || '—'} · النطاق: ${grant.host || '—'}`,
    impactIfApproved: `سيتم تفعيل منحة المنصة ${grant.host || grant.id} ومنح النظام للمسؤول ${grant.adminEmail || ''}.`,
    impactIfRejected: 'لن يُفعَّل وصول المنصة.',
    applyPayload: { grantId: grant.id },
    attachments: Array.isArray(grant.attachments) ? grant.attachments : [],
    createdAt: grant.createdAt,
  };
}

async function enqueuePlatformGrant(grant, actor, opts = {}) {
  const payload = platformGrantPayload(grant);
  if (!payload) return { ok: false, error: 'منحة غير صالحة' };
  return createRequest(payload, actor || { name: grant.adminName || 'عميل', email: grant.adminEmail }, opts);
}

function systemRentalPayload(rental) {
  if (!rental?.id) return null;
  return {
    type: 'system_rental',
    typeLabel: TYPE_AR.system_rental,
    title: `اعتماد استئجار نظام — ${rental.systemLabel || rental.systemCode || rental.id}`,
    sourceModule: 'rent_store',
    sourceModuleLabel: SOURCE_AR.rent_store,
    operation: 'system_rental',
    operationLabel: 'اعتماد استئجار نظام',
    sourceType: 'system_rental',
    sourceId: rental.id,
    sourceLink: 'dashboard.html#rent-admin',
    requesterName: rental.customerName || rental.email || 'عميل',
    requesterEmail: rental.email || '',
    subjectName: rental.systemLabel || rental.systemCode || 'نظام',
    system: rental.systemCode || '',
    systemLabel: rental.systemLabel || rental.systemCode || 'استئجار نظام',
    affectedLabel: rental.systemLabel || rental.id,
    reason: rental.notes || 'طلب استئجار نظام',
    priority: 'normal',
    department: 'استئجار الأنظمة',
    currentDisplay: 'غير مفعّل',
    requestedDisplay: `تفعيل: ${rental.systemLabel || rental.systemCode} · خطة: ${rental.planLabel || rental.plan || '—'}`,
    impactIfApproved: `سيتم تفعيل إيجار النظام ${rental.systemLabel || rental.systemCode} للعميل ${rental.customerName || rental.email || ''}.`,
    impactIfRejected: 'لن يُفعَّل الإيجار وسيُرفض الطلب في سجل الاستئجار.',
    applyPayload: { rentalId: rental.id },
    createdAt: rental.createdAt,
  };
}

async function enqueueSystemRental(rental, actor, opts = {}) {
  const payload = systemRentalPayload(rental);
  if (!payload) return { ok: false, error: 'إيجار غير صالح' };
  return createRequest(payload, actor || { name: rental.customerName || 'عميل', email: rental.email }, opts);
}

function updatePlatformGrantStatus(grantId, status, statusLabel) {
  try {
    const grantsPath = path.join(__dirname, '..', 'data', 'platform-grants.json');
    if (!fs.existsSync(grantsPath)) return false;
    const raw = JSON.parse(fs.readFileSync(grantsPath, 'utf8'));
    const grants = Array.isArray(raw.grants) ? raw.grants : [];
    const row = grants.find((g) => String(g.id) === String(grantId));
    if (!row) return false;
    row.status = status;
    row.statusLabel = statusLabel || status;
    row.updatedAt = nowIso();
    if (status === 'active') row.approvedAt = row.updatedAt;
    if (status === 'rejected') row.rejectedAt = row.updatedAt;
    fs.writeFileSync(
      grantsPath,
      JSON.stringify({ ...raw, grants, updatedAt: nowIso() }, null, 2),
      'utf8'
    );
    // also update register-attachments store
    try {
      const regPath = path.join(__dirname, '..', 'data', 'register-attachments.json');
      if (fs.existsSync(regPath)) {
        const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
        const req = (reg.requests || []).find((r) => String(r.id) === String(grantId));
        if (req) {
          req.status = status === 'active' ? 'active' : status;
          req.statusLabel = statusLabel || req.statusLabel;
          req.updatedAt = nowIso();
          fs.writeFileSync(regPath, JSON.stringify({ ...reg, updatedAt: nowIso() }, null, 2), 'utf8');
        }
      }
    } catch (_) {}
    return true;
  } catch (err) {
    console.warn('[higher-approvals] grant status update failed:', err.message);
    return false;
  }
}

function updateSystemRentalStatus(rentalId, status) {
  try {
    const systemRentals = require('./hub-system-rentals');
    if (typeof systemRentals.setStatus === 'function') {
      return systemRentals.setStatus(rentalId, status);
    }
    if (typeof systemRentals.updateStatus === 'function') {
      return systemRentals.updateStatus(rentalId, status);
    }
  } catch (_) {}
  return false;
}

function pushDecision(store, row, decision, actor, reason, beforeStatus) {
  const a = actorMeta(actor);
  const dec = {
    id: `DEC-${row.id}-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    requestId: row.id,
    type: row.type,
    typeLabel: row.typeLabel,
    title: row.title,
    sourceModule: row.sourceModule,
    sourceModuleLabel: row.sourceModuleLabel,
    operation: row.operation,
    operationLabel: row.operationLabel,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    requesterName: row.requesterName,
    subjectEmployeeNo: row.subjectEmployeeNo,
    decision,
    decisionAr: STATUS_AR[row.status] || decision,
    decidedBy: a.name,
    decidedByEmployeeNo: a.employeeNo || '',
    reason: reason || '',
    beforeStatus,
    afterStatus: row.status,
    requestedAt: row.createdAt,
    decidedAt: row.decidedAt || nowIso(),
  };
  store.decisions.unshift(dec);
  if (store.decisions.length > 1000) store.decisions.length = 1000;
  return dec;
}

async function decide(id, action, actor, opts = {}) {
  await ensureHydrated();
  if (!canDecide(actor)) {
    const err = new Error('ليست لديك صلاحية اعتماد/رفض طلبات المدير الأعلى');
    err.status = 403;
    throw err;
  }
  const store = readStore();
  const req = findById(store, id);
  if (!req) {
    const err = new Error('الطلب غير موجود');
    err.status = 404;
    throw err;
  }
  const a = actorMeta(actor);
  const note = String(opts.note || opts.reason || '').trim();
  const beforeStatus = req.status;

  if (action === 'start_review') {
    if (req.status === STATUS.PENDING) {
      req.status = STATUS.UNDER_REVIEW;
      req.updatedAt = nowIso();
      req.history.push({ at: nowIso(), action: 'under_review', by: a.name, detail: 'بدأ المدير مراجعة الطلب' });
      writeStore(store);
      await flushDurable();
    }
    return { ok: true, request: publicRequest(req) };
  }

  if (action === 'approve') {
    if (![STATUS.PENDING, STATUS.UNDER_REVIEW, STATUS.NEEDS_REVISION].includes(req.status)) {
      const err = new Error('لا يمكن الموافقة على هذا الطلب في حالته الحالية');
      err.status = 409;
      throw err;
    }
    // Domain side-effects on server where possible
    if (req.sourceType === 'platform_grant' || req.type === 'platform_grant') {
      updatePlatformGrantStatus(req.sourceId || req.applyPayload?.grantId, 'active', 'مفعّل');
    }
    if (req.sourceType === 'system_rental' || req.type === 'system_rental') {
      updateSystemRentalStatus(req.sourceId || req.applyPayload?.rentalId, 'active');
    }
    req.status = STATUS.APPROVED;
    req.updatedAt = nowIso();
    req.decidedAt = nowIso();
    req.decidedBy = a.name;
    req.decidedByEmployeeNo = a.employeeNo || '';
    req.history.push({ at: nowIso(), action: 'approved', by: a.name, detail: note || 'موافقة' });
    const dec = pushDecision(store, req, 'approved', a, note, beforeStatus);
    writeStore(store);
    await flushDurable();
    notifyRuntime({
      title: 'تمت الموافقة على طلبك',
      body: `طلب ${req.id} (${req.operationLabel || req.typeLabel}) تمت الموافقة عليه من ${a.name}.`,
      level: 'success',
      link: `dashboard.html#rent-admin?apr=${encodeURIComponent(req.id)}`,
      referenceId: req.id,
      requestId: req.id,
      targetEmail: req.requesterEmail,
      meta: { email: req.requesterEmail },
    });
    return { ok: true, request: publicRequest(req), decision: dec, applyOnClient: true };
  }

  if (action === 'reject') {
    if (!note) {
      const err = new Error('سبب الرفض إلزامي');
      err.status = 400;
      throw err;
    }
    if (![STATUS.PENDING, STATUS.UNDER_REVIEW, STATUS.NEEDS_REVISION].includes(req.status)) {
      const err = new Error('لا يمكن رفض هذا الطلب في حالته الحالية');
      err.status = 409;
      throw err;
    }
    if (req.sourceType === 'platform_grant' || req.type === 'platform_grant') {
      updatePlatformGrantStatus(req.sourceId || req.applyPayload?.grantId, 'rejected', 'مرفوض');
    }
    if (req.sourceType === 'system_rental' || req.type === 'system_rental') {
      updateSystemRentalStatus(req.sourceId || req.applyPayload?.rentalId, 'rejected');
    }
    req.status = STATUS.REJECTED;
    req.rejectReason = note;
    req.updatedAt = nowIso();
    req.decidedAt = nowIso();
    req.decidedBy = a.name;
    req.decidedByEmployeeNo = a.employeeNo || '';
    req.history.push({ at: nowIso(), action: 'rejected', by: a.name, detail: note });
    const dec = pushDecision(store, req, 'rejected', a, note, beforeStatus);
    writeStore(store);
    await flushDurable();
    notifyRuntime({
      title: 'رُفض طلب الموافقة',
      body: `طلب ${req.id}: ${note}`,
      level: 'error',
      link: `dashboard.html#rent-admin?apr=${encodeURIComponent(req.id)}`,
      referenceId: req.id,
      requestId: req.id,
      targetEmail: req.requesterEmail,
      meta: { email: req.requesterEmail },
    });
    return { ok: true, request: publicRequest(req), decision: dec };
  }

  if (action === 'revise' || action === 'needs_revision') {
    if (!note) {
      const err = new Error('يجب توضيح المطلوب تعديله');
      err.status = 400;
      throw err;
    }
    if (req.status !== STATUS.PENDING && req.status !== STATUS.UNDER_REVIEW) {
      const err = new Error('لا يمكن طلب تعديل في هذه الحالة');
      err.status = 409;
      throw err;
    }
    req.status = STATUS.NEEDS_REVISION;
    req.revisionNote = note;
    req.updatedAt = nowIso();
    req.history.push({ at: nowIso(), action: 'needs_revision', by: a.name, detail: note });
    const dec = pushDecision(store, req, 'needs_revision', a, note, beforeStatus);
    writeStore(store);
    await flushDurable();
    notifyRuntime({
      title: 'مطلوب تعديل طلبك',
      body: `طلب ${req.id}: ${note}`,
      level: 'warning',
      needsAction: true,
      link: `dashboard.html#rent-admin?apr=${encodeURIComponent(req.id)}`,
      actionLabel: 'تعديل وإعادة الإرسال',
      referenceId: req.id,
      requestId: req.id,
      targetEmail: req.requesterEmail,
      meta: { email: req.requesterEmail },
    });
    return { ok: true, request: publicRequest(req), decision: dec };
  }

  if (action === 'refer') {
    const referredTo = String(opts.referredTo || opts.assignee || '').trim();
    const referredToLabel = String(opts.referredToLabel || opts.assigneeLabel || referredTo).trim();
    if (!referredTo && !note) {
      const err = new Error('حدد المختص أو سبب الإحالة');
      err.status = 400;
      throw err;
    }
    if (![STATUS.PENDING, STATUS.UNDER_REVIEW, STATUS.NEEDS_REVISION].includes(req.status)) {
      const err = new Error('لا يمكن إحالة هذا الطلب في حالته الحالية');
      err.status = 409;
      throw err;
    }
    req.status = STATUS.REFERRED;
    req.referredTo = referredTo;
    req.referredToLabel = referredToLabel;
    req.updatedAt = nowIso();
    req.decidedAt = nowIso();
    req.decidedBy = a.name;
    req.decidedByEmployeeNo = a.employeeNo || '';
    req.history.push({
      at: nowIso(),
      action: 'referred',
      by: a.name,
      detail: `إحالة إلى ${referredToLabel || referredTo}${note ? ` — ${note}` : ''}`,
    });
    const dec = pushDecision(store, req, 'referred', a, note || `إحالة إلى ${referredToLabel || referredTo}`, beforeStatus);
    writeStore(store);
    await flushDurable();
    notifyRuntime({
      title: 'أُحيل طلب موافقة إليك',
      body: `طلب ${req.id} أُحيل إلى ${referredToLabel || referredTo} من ${a.name}.`,
      level: 'info',
      needsAction: true,
      link: `dashboard.html#rent-admin?apr=${encodeURIComponent(req.id)}`,
      referenceId: req.id,
      requestId: req.id,
      targetEmail: referredTo.includes('@') ? referredTo : '',
      meta: { email: referredTo.includes('@') ? referredTo : '' },
    });
    return { ok: true, request: publicRequest(req), decision: dec };
  }

  if (action === 'resubmit') {
    if (req.status !== STATUS.NEEDS_REVISION && req.status !== STATUS.REFERRED) {
      const err = new Error('الطلب ليس بانتظار تعديل/إعادة');
      err.status = 409;
      throw err;
    }
    if (opts.patch && typeof opts.patch === 'object') {
      ['reason', 'requestedValue', 'requestedDisplay', 'applyPayload', 'currentValue', 'currentDisplay', 'attachments'].forEach(
        (k) => {
          if (opts.patch[k] != null) req[k] = opts.patch[k];
        }
      );
    }
    req.status = STATUS.PENDING;
    req.revisionNote = '';
    req.updatedAt = nowIso();
    req.history.push({ at: nowIso(), action: 'resubmitted', by: a.name, detail: 'إعادة إرسال بعد التعديل' });
    writeStore(store);
    await flushDurable();
    notifyRuntime({
      title: 'طلب جديد يحتاج موافقتك',
      body: `أُعيد إرسال طلب ${req.id} (${req.typeLabel}) بعد التعديل.`,
      level: 'warning',
      needsAction: true,
      link: `dashboard.html#rent-admin?apr=${encodeURIComponent(req.id)}`,
      referenceId: req.id,
      requestId: req.id,
    });
    return { ok: true, request: publicRequest(req) };
  }

  const err = new Error(`إجراء غير معروف: ${action}`);
  err.status = 400;
  throw err;
}

function list(opts = {}) {
  const store = readStore();
  let rows = (store.requests || []).slice().map((r) => normalizeRequest({ ...r }));
  if (opts.status === 'pending_review') {
    rows = rows.filter((r) => r.status === STATUS.PENDING || r.status === STATUS.UNDER_REVIEW);
  } else if (opts.status) {
    rows = rows.filter((r) => r.status === opts.status);
  }
  if (opts.sourceModule) {
    rows = rows.filter((r) => r.sourceModule === opts.sourceModule || r.sourceType === opts.sourceModule);
  }
  if (opts.type) rows = rows.filter((r) => r.type === opts.type || r.operation === opts.type);
  if (opts.priority) rows = rows.filter((r) => r.priority === opts.priority);
  if (opts.q) {
    const q = String(opts.q).toLowerCase();
    rows = rows.filter((r) =>
      [
        r.id,
        r.title,
        r.typeLabel,
        r.operationLabel,
        r.sourceModuleLabel,
        r.requesterName,
        r.subjectName,
        r.subjectEmployeeNo,
        r.requesterEmployeeNo,
        r.requesterNaioshId,
        r.systemLabel,
        r.reason,
        r.branch,
        r.org,
        r.sourceId,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }
  return rows.map(publicRequest);
}

function kpis() {
  const rows = readStore().requests || [];
  return {
    pending: rows.filter((r) => r.status === STATUS.PENDING || r.status === STATUS.UNDER_REVIEW).length,
    underReview: rows.filter((r) => r.status === STATUS.UNDER_REVIEW).length,
    approved: rows.filter((r) => r.status === STATUS.APPROVED).length,
    rejected: rows.filter((r) => r.status === STATUS.REJECTED).length,
    needsRevision: rows.filter((r) => r.status === STATUS.NEEDS_REVISION).length,
    referred: rows.filter((r) => r.status === STATUS.REFERRED).length,
    all: rows.length,
  };
}

function listDecisions() {
  return (readStore().decisions || []).slice();
}

function get(id) {
  return publicRequest(findById(readStore(), id));
}

/**
 * Backfill missing approval rows from durable origin stores (platform grants, rentals).
 * Never auto-approves or deletes.
 */
async function backfillOrphans() {
  await ensureHydrated();
  const report = { scanned: 0, created: 0, skipped: 0, errors: [] };

  // Platform grants / register requests
  try {
    const grantsPath = path.join(__dirname, '..', 'data', 'platform-grants.json');
    if (fs.existsSync(grantsPath)) {
      const raw = JSON.parse(fs.readFileSync(grantsPath, 'utf8'));
      const grants = Array.isArray(raw.grants) ? raw.grants : [];
      for (const g of grants) {
        if (!g?.id) continue;
        report.scanned += 1;
        if (!['pending', 'provisioning'].includes(g.status)) {
          report.skipped += 1;
          continue;
        }
        // Skip if any prior approval exists for this source (including referred/closed).
        const prior = (readStore().requests || []).find(
          (r) => r.sourceType === 'platform_grant' && String(r.sourceId) === String(g.id)
        );
        if (prior) {
          report.skipped += 1;
          continue;
        }
        try {
          const res = await enqueuePlatformGrant(g, { name: g.adminName || 'عميل', email: g.adminEmail }, { silent: true });
          if (res.deduped) report.skipped += 1;
          else if (res.ok) report.created += 1;
        } catch (err) {
          report.errors.push({ id: g.id, error: err.message });
        }
      }
    }
  } catch (err) {
    report.errors.push({ source: 'platform_grants', error: err.message });
  }

  // Register attachments store (may have pending without grant mirror)
  try {
    const regPath = path.join(__dirname, '..', 'data', 'register-attachments.json');
    if (fs.existsSync(regPath)) {
      const raw = JSON.parse(fs.readFileSync(regPath, 'utf8'));
      const requests = Array.isArray(raw.requests) ? raw.requests : [];
      for (const g of requests) {
        if (!g?.id || !['pending', 'provisioning'].includes(g.status)) continue;
        report.scanned += 1;
        const prior = (readStore().requests || []).find(
          (r) => r.sourceType === 'platform_grant' && String(r.sourceId) === String(g.id)
        );
        if (prior) {
          report.skipped += 1;
          continue;
        }
        try {
          const res = await enqueuePlatformGrant(g, { name: g.adminName || 'عميل', email: g.adminEmail }, { silent: true });
          if (res.deduped) report.skipped += 1;
          else if (res.ok) report.created += 1;
        } catch (err) {
          report.errors.push({ id: g.id, error: err.message });
        }
      }
    }
  } catch (err) {
    report.errors.push({ source: 'register_attachments', error: err.message });
  }

  // System rentals
  try {
    const systemRentals = require('./hub-system-rentals');
    const listFn = systemRentals.list || systemRentals.listRentals || systemRentals.readAll;
    const rentals = typeof listFn === 'function' ? listFn() : [];
    for (const r of rentals || []) {
      if (!r?.id || r.status !== 'pending') continue;
      report.scanned += 1;
      try {
        const res = await enqueueSystemRental(r, { name: r.customerName || 'عميل', email: r.email }, { silent: true });
        if (res.deduped) report.skipped += 1;
        else if (res.ok) report.created += 1;
      } catch (err) {
        report.errors.push({ id: r.id, error: err.message });
      }
    }
  } catch (err) {
    report.errors.push({ source: 'system_rentals', error: err.message });
  }

  await flushDurable();
  return { ok: true, ...report, kpis: kpis() };
}

async function handleApi(req, res, pathname, { sendJson, readBody, requireStaff }) {
  if (!pathname.startsWith('/api/hub/higher-approvals')) return false;

  await ensureHydrated();

  if (pathname === '/api/hub/higher-approvals' && req.method === 'GET') {
    const session = await requireStaff(req, res);
    if (!session) return true;
    const url = new URL(req.url, 'http://localhost');
    const rows = list({
      status: url.searchParams.get('status') || undefined,
      sourceModule: url.searchParams.get('sourceModule') || undefined,
      type: url.searchParams.get('type') || undefined,
      priority: url.searchParams.get('priority') || undefined,
      q: url.searchParams.get('q') || undefined,
    });
    sendJson(res, 200, {
      ok: true,
      kpis: kpis(),
      count: rows.length,
      requests: rows,
      decisions: listDecisions().slice(0, 200),
    });
    return true;
  }

  if (pathname === '/api/hub/higher-approvals/kpis' && req.method === 'GET') {
    const session = await requireStaff(req, res);
    if (!session) return true;
    sendJson(res, 200, { ok: true, kpis: kpis() });
    return true;
  }

  if (pathname === '/api/hub/higher-approvals/backfill' && req.method === 'POST') {
    const session = await requireStaff(req, res);
    if (!session) return true;
    const report = await backfillOrphans();
    sendJson(res, 200, report);
    return true;
  }

  if (pathname === '/api/hub/higher-approvals' && req.method === 'POST') {
    // Creating an approval may be done by staff OR by trusted server paths.
    // Public register uses enqueuePlatformGrant directly — this endpoint requires auth.
    const session = await requireStaff(req, res);
    if (!session) return true;
    const body = await readBody(req);
    try {
      const result = await createRequest(body || {}, {
        name: session.name || session.email,
        email: session.email,
        employeeNo: session.employeeNo,
        naioshId: session.naioshId,
        role: session.role,
      });
      sendJson(res, result.deduped ? 200 : 201, result);
    } catch (err) {
      sendJson(res, err.status || 500, { ok: false, error: err.message || 'تعذر إنشاء طلب الموافقة' });
    }
    return true;
  }

  const match = pathname.match(/^\/api\/hub\/higher-approvals\/([^/]+)(?:\/(decide|resubmit))?$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    const sub = match[2] || '';

    if (req.method === 'GET' && !sub) {
      const session = await requireStaff(req, res);
      if (!session) return true;
      const row = get(id);
      if (!row) {
        sendJson(res, 404, { ok: false, error: 'الطلب غير موجود' });
        return true;
      }
      sendJson(res, 200, { ok: true, request: row });
      return true;
    }

    if (req.method === 'POST' && (sub === 'decide' || sub === 'resubmit')) {
      const session = await requireStaff(req, res);
      if (!session) return true;
      const body = await readBody(req);
      const actor = {
        name: session.name || session.email,
        email: session.email,
        employeeNo: session.employeeNo,
        naioshId: session.naioshId,
        role: session.role,
      };
      try {
        const action = sub === 'resubmit' ? 'resubmit' : String(body?.action || '').trim();
        const result = await decide(id, action, actor, {
          note: body?.note || body?.reason,
          reason: body?.reason || body?.note,
          referredTo: body?.referredTo || body?.assignee,
          referredToLabel: body?.referredToLabel || body?.assigneeLabel,
          patch: body?.patch,
        });
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, err.status || 500, { ok: false, error: err.message || 'تعذر تنفيذ القرار' });
      }
      return true;
    }
  }

  sendJson(res, 404, { ok: false, error: 'مسار الموافقات غير موجود' });
  return true;
}

function resetForTests() {
  mem = null;
  hydrated = false;
  lastPersistError = null;
  dbWriteQueue = Promise.resolve();
}

module.exports = {
  STATUS,
  STATUS_AR,
  TYPE_AR,
  SOURCE_AR,
  DECIDER_ROLES,
  canDecide,
  ensureHydrated,
  hydrateFromDb,
  createRequest,
  enqueuePlatformGrant,
  enqueueSystemRental,
  decide,
  list,
  listDecisions,
  get,
  kpis,
  backfillOrphans,
  handleApi,
  publicRequest,
  platformGrantPayload,
  flushDurable,
  resetForTests,
  readStore,
};
