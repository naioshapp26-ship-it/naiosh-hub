/**
 * Marketing campaigns studio — file-backed SoT with in-process lock (atomic writes).
 * Optional Postgres hub_meta mirror. Staff-only. No demo/hardcoded campaigns.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const DATA_PATH = path.join(__dirname, '..', 'data', 'marketing-campaigns.json');
const META_KEY = 'marketing_campaigns';

const PERMS = {
  view: 'campaigns.view',
  create: 'campaigns.create',
  edit: 'campaigns.edit',
  content: 'campaigns.content',
  upload: 'campaigns.upload',
  review: 'campaigns.review',
  approve: 'campaigns.approve',
  budget: 'campaigns.budget',
  publish: 'campaigns.publish',
  pause: 'campaigns.pause',
  reports: 'campaigns.reports',
  delete: 'campaigns.delete',
};

const ALL_PERMS = Object.values(PERMS);

const CAMPAIGN_STATUSES = [
  'draft',
  'preparing',
  'pending_review',
  'needs_changes',
  'approved',
  'scheduled',
  'active',
  'paused',
  'completed',
  'cancelled',
  'archived',
];

const STATUS_LABEL = {
  draft: 'مسودة',
  preparing: 'قيد الإعداد',
  pending_review: 'بانتظار المراجعة',
  needs_changes: 'تحتاج تعديل',
  approved: 'معتمدة',
  scheduled: 'مجدولة',
  active: 'نشطة',
  paused: 'متوقفة مؤقتًا',
  completed: 'مكتملة',
  cancelled: 'ملغاة',
  archived: 'مؤرشفة',
};

const CONTENT_STATUS_LABEL = {
  draft: 'مسودة',
  ready_review: 'جاهز للمراجعة',
  pending_review: 'بانتظار الموافقة',
  approved: 'معتمد',
  scheduled: 'مجدول',
  published: 'منشور',
  publish_failed: 'فشل النشر',
  cancelled: 'ملغي',
};

const CAMPAIGN_TYPES = [
  'حملة مبيعات',
  'حملة تعريفية',
  'إطلاق منتج',
  'إطلاق خدمة',
  'فعالية',
  'حملة تسجيل',
  'حملة اشتراكات',
  'حملة محتوى',
  'حملة إعادة استهداف',
  'حملة موسمية',
  'حملة توعية',
  'حملة علاقات عامة',
  'أخرى',
];

const GOALS = [
  { id: 'sales', label: 'زيادة المبيعات', unit: 'عملية شراء' },
  { id: 'leads', label: 'زيادة العملاء المحتملين', unit: 'عميل محتمل' },
  { id: 'signups', label: 'زيادة التسجيلات', unit: 'تسجيل' },
  { id: 'visits', label: 'زيادة الزيارات', unit: 'زيارة' },
  { id: 'awareness', label: 'زيادة الوعي', unit: 'وصول' },
  { id: 'engagement', label: 'زيادة التفاعل', unit: 'تفاعل' },
  { id: 'views', label: 'زيادة المشاهدات', unit: 'مشاهدة' },
  { id: 'event', label: 'الترويج لفعالية', unit: 'تسجيل فعالية' },
  { id: 'product', label: 'الترويج لمنتج', unit: 'نقرة منتج' },
  { id: 'service', label: 'الترويج لخدمة', unit: 'طلب خدمة' },
  { id: 'custom', label: 'هدف مخصص', unit: 'وحدة' },
];

const CHANNELS = [
  { id: 'website', label: 'الموقع', connected: true, mode: 'internal' },
  { id: 'email', label: 'البريد الإلكتروني', connected: false, mode: 'manual' },
  { id: 'inapp', label: 'رسائل داخل النظام', connected: true, mode: 'internal' },
  { id: 'instagram', label: 'Instagram', connected: false, mode: 'manual' },
  { id: 'facebook', label: 'Facebook', connected: false, mode: 'manual' },
  { id: 'tiktok', label: 'TikTok', connected: false, mode: 'manual' },
  { id: 'youtube', label: 'YouTube', connected: false, mode: 'manual' },
  { id: 'linkedin', label: 'LinkedIn', connected: false, mode: 'manual' },
  { id: 'x', label: 'X', connected: false, mode: 'manual' },
  { id: 'whatsapp', label: 'WhatsApp', connected: false, mode: 'manual' },
  { id: 'google', label: 'Google', connected: false, mode: 'manual' },
  { id: 'other', label: 'منصات أخرى', connected: false, mode: 'manual' },
];

const CONTENT_TYPES = [
  { id: 'text', label: 'نص' },
  { id: 'image', label: 'صورة' },
  { id: 'video', label: 'فيديو' },
  { id: 'short', label: 'فيديو قصير' },
  { id: 'ad', label: 'إعلان' },
  { id: 'post', label: 'منشور' },
  { id: 'story', label: 'قصة' },
  { id: 'banner', label: 'بانر' },
  { id: 'file', label: 'ملف' },
  { id: 'link', label: 'رابط' },
  { id: 'email', label: 'محتوى بريد إلكتروني' },
];

const TRANSITIONS = {
  draft: ['preparing', 'pending_review', 'cancelled'],
  preparing: ['pending_review', 'draft', 'cancelled'],
  pending_review: ['approved', 'needs_changes', 'cancelled'],
  needs_changes: ['pending_review', 'cancelled'],
  approved: ['scheduled', 'active', 'cancelled', 'completed'],
  scheduled: ['active', 'paused', 'cancelled', 'completed'],
  active: ['paused', 'completed', 'cancelled'],
  paused: ['active', 'cancelled', 'completed'],
  completed: ['archived'],
  cancelled: ['archived'],
  archived: [],
};

function nowIso() {
  return new Date().toISOString();
}

function emptyStore() {
  return {
    version: 1,
    seq: { campaign: 0, content: 0, asset: 0, clip: 0, audience: 0, expense: 0, result: 0, pub: 0 },
    campaigns: [],
    activity: [],
    idempotency: {},
    updatedAt: nowIso(),
  };
}

let lock = Promise.resolve();
function withLock(fn) {
  const run = lock.then(fn, fn);
  lock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function ensureDir() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readStore() {
  ensureDir();
  if (!fs.existsSync(DATA_PATH)) {
    const s = emptyStore();
    writeStore(s);
    return s;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    if (!raw || !Array.isArray(raw.campaigns)) return emptyStore();
    raw.seq = raw.seq || emptyStore().seq;
    raw.activity = raw.activity || [];
    raw.idempotency = raw.idempotency || {};
    return raw;
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  ensureDir();
  store.updatedAt = nowIso();
  const tmp = DATA_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_PATH);
  mirrorMeta(store).catch(() => {});
}

async function mirrorMeta(store) {
  try {
    const { getDatabaseUrl } = require('../db/migrate');
    const databaseUrl = getDatabaseUrl();
    if (!databaseUrl) return;
    const { Client } = require('pg');
    const client = new Client({
      connectionString: databaseUrl,
      ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? false : { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query(
      `INSERT INTO hub_meta (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [META_KEY, JSON.stringify({ version: store.version, seq: store.seq, campaigns: store.campaigns, updatedAt: store.updatedAt })]
    );
    for (const c of store.campaigns) {
      await client.query(
        `INSERT INTO hub_marketing_campaigns (id, name, status, payload, owner_email, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, COALESCE($6::timestamptz, NOW()), NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           status = EXCLUDED.status,
           payload = EXCLUDED.payload,
           owner_email = EXCLUDED.owner_email,
           updated_at = NOW()`,
        [c.id, c.name, c.status, JSON.stringify(c), c.ownerEmail || '', c.createdAt || null]
      );
    }
    await client.end();
  } catch {
    /* optional */
  }
}

function nextCode(store, kind, prefix) {
  store.seq[kind] = Number(store.seq[kind] || 0) + 1;
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(store.seq[kind]).padStart(6, '0')}`;
}

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function actorOf(session) {
  return {
    email: session?.email || '',
    name: session?.name || session?.email || 'موظف',
    role: session?.role || '',
    employeeNo: session?.employeeNo || session?.userId || '',
  };
}

function pushActivity(store, campaign, actor, action, detail, extra = {}) {
  const row = {
    id: `act-${crypto.randomBytes(4).toString('hex')}`,
    campaignId: campaign?.id || extra.campaignId || '',
    at: nowIso(),
    action,
    detail: detail || '',
    actorName: actor.name,
    actorEmail: actor.email,
    employeeNo: actor.employeeNo || '',
    before: extra.before ?? null,
    after: extra.after ?? null,
  };
  store.activity.unshift(row);
  if (store.activity.length > 2000) store.activity.length = 2000;
  if (campaign) {
    campaign.activity = campaign.activity || [];
    campaign.activity.unshift(row);
    if (campaign.activity.length > 400) campaign.activity.length = 400;
    campaign.updatedAt = row.at;
  }
  return row;
}

function notify(title, body, link, meta) {
  try {
    const hubRuntime = require('../db/hub-runtime');
    hubRuntime.addNotification({
      source: 'CAMPAIGNS',
      sourceName: 'استوديو الحملات التسويقية',
      title,
      body,
      level: 'info',
      category: 'marketing',
      link: link || 'marketing-campaigns-studio.html',
      meta: meta || null,
    });
  } catch {
    /* optional */
  }
}

function findCampaign(store, id) {
  return store.campaigns.find((c) => c.id === id) || null;
}

function requireCampaign(store, id) {
  const c = findCampaign(store, id);
  if (!c) fail(404, 'الحملة غير موجودة');
  return c;
}

function assertPerm(session, perm) {
  const hubSession = require('./hub-session');
  if (!hubSession.hasPermission(session, perm)) fail(403, 'ليست لديك صلاحية هذه العملية');
}

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

function blankCampaign(id, actor) {
  return {
    id,
    name: '',
    description: '',
    type: 'حملة محتوى',
    goal: '',
    goalLabel: '',
    goalTarget: null,
    goalUnit: '',
    startDate: '',
    endDate: '',
    ownerName: actor.name,
    ownerEmail: actor.email,
    department: 'التسويق',
    priority: 'متوسطة',
    notes: '',
    status: 'draft',
    changeRequestNote: '',
    budget: {
      total: 0,
      currency: 'USD',
      contentCost: 0,
      adCost: 0,
      otherCost: 0,
      spent: 0,
    },
    audiences: [],
    links: [],
    channels: [],
    contents: [],
    assets: [],
    clips: [],
    expenses: [],
    results: [],
    publications: [],
    activity: [],
    report: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    createdBy: actor.email,
    createdByName: actor.name,
  };
}

function remainingOf(c) {
  const b = c.budget || {};
  const spent = Number(b.spent || 0) + (c.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
  const total = Number(b.total || 0);
  return { spent, remaining: total - spent, ratio: total ? spent / total : 0 };
}

function computeMetrics(c) {
  const results = c.results || [];
  const views = results.reduce((s, r) => s + Number(r.views || 0), 0);
  const reach = results.reduce((s, r) => s + Number(r.reach || 0), 0);
  const clicks = results.reduce((s, r) => s + Number(r.clicks || 0), 0);
  const visits = results.reduce((s, r) => s + Number(r.visits || 0), 0);
  const leads = results.reduce((s, r) => s + Number(r.leads || 0), 0);
  const signups = results.reduce((s, r) => s + Number(r.signups || 0), 0);
  const sales = results.reduce((s, r) => s + Number(r.sales || 0), 0);
  const conversions = results.reduce((s, r) => s + Number(r.conversions || 0), 0);
  const spend = results.reduce((s, r) => s + Number(r.spend || 0), 0) + remainingOf(c).spent;
  const available = {};
  if (results.length) {
    available.views = views;
    available.reach = reach;
    available.clicks = clicks;
    available.visits = visits;
    available.leads = leads;
    available.signups = signups;
    available.sales = sales;
    available.conversions = conversions;
    available.spend = spend;
  }
  const kpis = {};
  if (views && clicks) kpis.ctr = clicks / views;
  if (clicks && conversions) kpis.conversionRate = conversions / clicks;
  if (leads && spend) kpis.costPerLead = spend / leads;
  if (conversions && spend) kpis.costPerAcquisition = spend / conversions;
  if (sales && spend) kpis.roas = sales / spend;
  if (spend && sales) kpis.roi = (sales - spend) / spend;
  const target = Number(c.goalTarget || 0);
  let achieved = 0;
  if (c.goal === 'sales') achieved = sales;
  else if (c.goal === 'leads') achieved = leads;
  else if (c.goal === 'signups') achieved = signups;
  else if (c.goal === 'visits') achieved = visits;
  else if (c.goal === 'views') achieved = views;
  else if (c.goal === 'engagement') achieved = clicks;
  else achieved = conversions || leads || sales;
  const goalProgress = target ? achieved / target : null;
  return { available, kpis, achieved, goalProgress, hasResults: results.length > 0 };
}

function publicCampaign(c, { full = false } = {}) {
  const money = remainingOf(c);
  const metrics = computeMetrics(c);
  const base = {
    id: c.id,
    name: c.name,
    description: c.description,
    type: c.type,
    goal: c.goal,
    goalLabel: c.goalLabel,
    goalTarget: c.goalTarget,
    goalUnit: c.goalUnit,
    startDate: c.startDate,
    endDate: c.endDate,
    ownerName: c.ownerName,
    ownerEmail: c.ownerEmail,
    department: c.department,
    priority: c.priority,
    notes: c.notes,
    status: c.status,
    statusLabel: STATUS_LABEL[c.status] || c.status,
    changeRequestNote: c.changeRequestNote || '',
    budget: { ...c.budget, spent: money.spent, remaining: money.remaining, ratio: money.ratio },
    channelCount: (c.channels || []).length,
    contentCount: (c.contents || []).length,
    assetCount: (c.assets || []).length,
    updatedAt: c.updatedAt,
    createdAt: c.createdAt,
    metrics,
  };
  if (!full) return base;
  return {
    ...base,
    audiences: c.audiences || [],
    links: c.links || [],
    channels: c.channels || [],
    contents: c.contents || [],
    assets: c.assets || [],
    clips: c.clips || [],
    expenses: c.expenses || [],
    results: c.results || [],
    publications: c.publications || [],
    activity: c.activity || [],
    report: c.report || null,
  };
}

function loadMarketplace() {
  try {
    const file = path.join(__dirname, '..', 'js', 'hub-marketplace-data.js');
    const code = fs.readFileSync(file, 'utf8');
    const sandbox = { window: {}, console };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox.window.HubMarketplaceData || {};
  } catch {
    return {};
  }
}

function catalogs() {
  const md = loadMarketplace();
  let products = [];
  try {
    products = require('./hub-product-orders')
      .loadCatalog()
      .slice(0, 80)
      .map((p) => ({ id: p.id, label: p.name || p.title, sku: p.sku, kind: 'product' }));
  } catch {
    products = (md.PRODUCT_CATALOG || []).slice(0, 80).map((p) => ({
      id: p.id,
      label: p.name || p.title,
      sku: p.sku,
      kind: 'product',
    }));
  }
  const services = [
    { id: 'svc-ads', label: 'إدارة الحملات الإعلانية', kind: 'service' },
    { id: 'svc-consulting', label: 'الاستشارات', kind: 'service' },
    { id: 'svc-subscriptions', label: 'الاشتراكات', kind: 'service' },
    { id: 'svc-branches', label: 'إدارة الفروع', kind: 'service' },
    { id: 'svc-incubators', label: 'برامج الحاضنات', kind: 'service' },
    { id: 'svc-customers', label: 'خدمة العملاء', kind: 'service' },
  ];
  const events = (md.EVENTS || []).map((e) => ({ id: e.id, label: e.name, kind: 'event', date: e.date }));
  const platforms = (md.APPS || []).slice(0, 40).map((a) => ({
    id: a.code || a.id,
    label: a.nameAr || a.name || a.code,
    kind: 'platform',
  }));
  return { products, services, events, platforms };
}

function listAlerts(store) {
  const now = Date.now();
  const alerts = [];
  for (const c of store.campaigns) {
    if (c.status === 'archived' || c.status === 'cancelled') continue;
    const start = c.startDate ? Date.parse(c.startDate) : NaN;
    const end = c.endDate ? Date.parse(c.endDate) : NaN;
    if (Number.isFinite(start) && start - now < 48 * 3600 * 1000 && start > now && c.status !== 'active') {
      alerts.push({
        id: `start-${c.id}`,
        campaignId: c.id,
        title: `حملة ستبدأ قريبًا: ${c.name || c.id}`,
        kind: 'start',
      });
    }
    if (Number.isFinite(end) && end - now < 48 * 3600 * 1000 && end > now) {
      alerts.push({
        id: `end-${c.id}`,
        campaignId: c.id,
        title: `حملة ستنتهي قريبًا: ${c.name || c.id}`,
        kind: 'end',
      });
    }
    if (c.status === 'pending_review') {
      alerts.push({
        id: `rev-${c.id}`,
        campaignId: c.id,
        title: `محتوى/حملة تنتظر المراجعة: ${c.name || c.id}`,
        kind: 'review',
      });
    }
    if (c.status === 'needs_changes' && c.changeRequestNote) {
      alerts.push({
        id: `chg-${c.id}`,
        campaignId: c.id,
        title: `طلب تعديل: ${c.name || c.id}`,
        kind: 'changes',
      });
    }
    const money = remainingOf(c);
    if (money.ratio >= 0.8 && money.total > 0) {
      alerts.push({
        id: `bud-${c.id}`,
        campaignId: c.id,
        title: `ميزانية اقتربت من الحد: ${c.name || c.id}`,
        kind: 'budget',
      });
    }
    if (!(c.contents || []).length && c.status !== 'draft') {
      alerts.push({
        id: `noc-${c.id}`,
        campaignId: c.id,
        title: `حملة بلا محتوى: ${c.name || c.id}`,
        kind: 'content',
      });
    }
    if (!(c.channels || []).length && c.status !== 'draft') {
      alerts.push({
        id: `nch-${c.id}`,
        campaignId: c.id,
        title: `حملة بلا قناة نشر: ${c.name || c.id}`,
        kind: 'channel',
      });
    }
    const m = computeMetrics(c);
    if (c.status === 'active' && m.hasResults && m.goalProgress != null && m.goalProgress < 0.4) {
      alerts.push({
        id: `goal-${c.id}`,
        campaignId: c.id,
        title: `الحملة لم تحقق الهدف المتوقع: ${c.name || c.id}`,
        kind: 'goal',
      });
    }
    (c.contents || []).forEach((ct) => {
      if (ct.status === 'publish_failed') {
        alerts.push({
          id: `fail-${ct.id}`,
          campaignId: c.id,
          contentId: ct.id,
          title: `فشل النشر: ${ct.title || ct.id}`,
          kind: 'publish_failed',
        });
      }
    });
  }
  return alerts;
}

function summary(store) {
  const list = store.campaigns.filter((c) => c.status !== 'archived');
  const count = (st) => list.filter((c) => c.status === st).length;
  const money = list.reduce(
    (acc, c) => {
      const m = remainingOf(c);
      acc.total += Number(c.budget?.total || 0);
      acc.spent += m.spent;
      return acc;
    },
    { total: 0, spent: 0 }
  );
  const today = new Date().toISOString().slice(0, 10);
  const scheduledToday = list.reduce(
    (n, c) => n + (c.contents || []).filter((x) => x.scheduleDate === today && x.status === 'scheduled').length,
    0
  );
  const pendingContent = list.reduce(
    (n, c) => n + (c.contents || []).filter((x) => x.status === 'pending_review' || x.status === 'ready_review').length,
    0
  );
  const endingSoon = listAlerts(store).filter((a) => a.kind === 'end').length;
  const goalRates = list
    .map((c) => computeMetrics(c))
    .filter((m) => m.hasResults && m.goalProgress != null)
    .map((m) => m.goalProgress);
  const goalAvg = goalRates.length ? goalRates.reduce((a, b) => a + b, 0) / goalRates.length : null;
  return {
    active: count('active'),
    pendingReview: count('pending_review'),
    scheduled: count('scheduled'),
    completed: count('completed'),
    drafts: count('draft') + count('preparing'),
    budgetTotal: money.total,
    budgetSpent: money.spent,
    scheduledToday,
    pendingContent: pendingContent + count('pending_review'),
    endingSoon,
    goalAvg,
    videos: list.reduce((n, c) => n + (c.assets || []).filter((a) => a.kind === 'video').length, 0),
    clips: list.reduce((n, c) => n + (c.clips || []).length, 0),
    campaignCount: list.length,
  };
}

function applyPatch(c, body) {
  const fields = [
    'name',
    'description',
    'type',
    'goal',
    'goalLabel',
    'goalUnit',
    'startDate',
    'endDate',
    'ownerName',
    'department',
    'priority',
    'notes',
  ];
  const before = {};
  const after = {};
  for (const f of fields) {
    if (body[f] != null) {
      before[f] = c[f];
      c[f] = typeof body[f] === 'string' ? String(body[f]).trim() : body[f];
      after[f] = c[f];
    }
  }
  if (body.goalTarget != null) {
    before.goalTarget = c.goalTarget;
    c.goalTarget = body.goalTarget === '' ? null : Number(body.goalTarget);
    after.goalTarget = c.goalTarget;
  }
  if (body.goal) {
    const g = GOALS.find((x) => x.id === body.goal);
    if (g) {
      c.goalLabel = c.goalLabel || g.label;
      c.goalUnit = c.goalUnit || g.unit;
    }
  }
  return { before, after };
}

function createCampaign(store, body, actor, idempotencyKey) {
  if (idempotencyKey && store.idempotency[idempotencyKey]) {
    const existing = findCampaign(store, store.idempotency[idempotencyKey]);
    if (existing) return existing;
  }
  const name = String(body.name || '').trim();
  if (!name) fail(400, 'اسم الحملة مطلوب');
  const id = nextCode(store, 'campaign', 'CMP');
  const c = blankCampaign(id, actor);
  applyPatch(c, body);
  c.name = name;
  if (Array.isArray(body.audiences)) {
    c.audiences = body.audiences.map((a) => ({
      id: nextCode(store, 'audience', 'AUD'),
      type: a.type || 'جمهور جديد',
      region: a.region || '',
      age: a.age || '',
      interests: a.interests || '',
      sector: a.sector || '',
      customerType: a.customerType || '',
      traits: a.traits || '',
      notes: a.notes || '',
    }));
  }
  if (Array.isArray(body.links)) {
    c.links = body.links.map((l, i) => ({
      id: `lnk-${i + 1}-${crypto.randomBytes(2).toString('hex')}`,
      kind: l.kind || 'external',
      refId: l.refId || l.id || '',
      label: l.label || '',
      url: l.url || '',
    }));
  }
  if (Array.isArray(body.channels)) {
    c.channels = body.channels
      .map((ch) => {
        const def = CHANNELS.find((x) => x.id === (ch.id || ch));
        if (!def) return null;
        return { ...def, enabled: true };
      })
      .filter(Boolean);
  }
  if (body.budget && typeof body.budget === 'object') {
    c.budget = {
      total: Number(body.budget.total || 0),
      currency: body.budget.currency || 'USD',
      contentCost: Number(body.budget.contentCost || 0),
      adCost: Number(body.budget.adCost || 0),
      otherCost: Number(body.budget.otherCost || 0),
      spent: 0,
    };
  }
  store.campaigns.unshift(c);
  if (idempotencyKey) store.idempotency[idempotencyKey] = c.id;
  pushActivity(store, c, actor, 'created', 'تم إنشاء الحملة', { after: { id: c.id, name: c.name } });
  notify('حملة جديدة', `${c.name} · ${c.id}`, `marketing-campaigns-studio.html#campaign=${c.id}`, { campaignId: c.id });
  return c;
}

function setStatus(store, c, next, actor, note) {
  if (c.status === next) return c;
  if (!canTransition(c.status, next)) fail(409, `لا يمكن نقل الحالة من ${STATUS_LABEL[c.status]} إلى ${STATUS_LABEL[next]}`);
  const before = c.status;
  c.status = next;
  if (next === 'needs_changes') c.changeRequestNote = String(note || '').trim();
  if (next === 'pending_review' || next === 'approved') c.changeRequestNote = next === 'approved' ? '' : c.changeRequestNote;
  pushActivity(store, c, actor, 'status', `الحالة: ${STATUS_LABEL[before]} ← ${STATUS_LABEL[next]}`, {
    before,
    after: next,
    note: note || '',
  });
  if (next === 'pending_review') {
    notify('حملة بانتظار المراجعة', `${c.name} · ${c.id}`, `marketing-campaigns-studio.html#campaign=${c.id}`, {
      campaignId: c.id,
    });
  }
  if (next === 'needs_changes') {
    notify('طلب تعديل على حملة', `${c.name}: ${note || ''}`, `marketing-campaigns-studio.html#campaign=${c.id}`, {
      campaignId: c.id,
    });
  }
  if (next === 'approved') notify('تم اعتماد الحملة', `${c.name} · ${c.id}`, `marketing-campaigns-studio.html#campaign=${c.id}`);
  return c;
}

function calendarItems(store, from, to) {
  const items = [];
  for (const c of store.campaigns) {
    if (c.startDate) {
      items.push({
        id: `cstart-${c.id}`,
        campaignId: c.id,
        title: `بداية: ${c.name || c.id}`,
        date: c.startDate,
        kind: 'start',
        status: c.status,
      });
    }
    if (c.endDate) {
      items.push({
        id: `cend-${c.id}`,
        campaignId: c.id,
        title: `نهاية: ${c.name || c.id}`,
        date: c.endDate,
        kind: 'end',
        status: c.status,
      });
    }
    (c.contents || []).forEach((ct) => {
      if (ct.scheduleDate) {
        items.push({
          id: `sch-${ct.id}`,
          campaignId: c.id,
          contentId: ct.id,
          title: ct.title || ct.id,
          date: ct.scheduleDate,
          time: ct.scheduleTime || '',
          channel: ct.channel || '',
          kind: 'schedule',
          status: ct.status,
        });
      }
    });
    (c.publications || []).forEach((p) => {
      items.push({
        id: `pub-${p.id}`,
        campaignId: c.id,
        title: `نشر: ${p.platform || ''}`,
        date: (p.at || '').slice(0, 10),
        kind: 'publish',
        status: 'published',
      });
    });
    if (c.status === 'pending_review') {
      items.push({
        id: `rev-${c.id}`,
        campaignId: c.id,
        title: `مراجعة: ${c.name || c.id}`,
        date: (c.updatedAt || '').slice(0, 10),
        kind: 'review',
        status: c.status,
      });
    }
  }
  return items.filter((it) => {
    if (from && it.date < from) return false;
    if (to && it.date > to) return false;
    return !!it.date;
  });
}

function filterList(store, q) {
  let list = store.campaigns.slice();
  const status = String(q.status || '').trim();
  const type = String(q.type || '').trim();
  const owner = String(q.owner || '').trim();
  const channel = String(q.channel || '').trim();
  const search = String(q.q || q.search || '').trim().toLowerCase();
  const link = String(q.link || '').trim();
  if (status) list = list.filter((c) => c.status === status);
  if (type) list = list.filter((c) => c.type === type);
  if (owner) list = list.filter((c) => (c.ownerEmail || '').includes(owner) || (c.ownerName || '').includes(owner));
  if (channel) list = list.filter((c) => (c.channels || []).some((ch) => ch.id === channel));
  if (link) list = list.filter((c) => (c.links || []).some((l) => l.refId === link || l.label === link));
  if (search) {
    list = list.filter((c) =>
      [c.id, c.name, c.ownerName, c.ownerEmail, c.type].join(' ').toLowerCase().includes(search)
    );
  }
  const from = String(q.from || '').trim();
  const to = String(q.to || '').trim();
  if (from) list = list.filter((c) => !c.startDate || c.startDate >= from);
  if (to) list = list.filter((c) => !c.endDate || c.endDate <= to);
  return list;
}

function meta() {
  return {
    statuses: CAMPAIGN_STATUSES.map((id) => ({ id, label: STATUS_LABEL[id] })),
    contentStatuses: Object.keys(CONTENT_STATUS_LABEL).map((id) => ({ id, label: CONTENT_STATUS_LABEL[id] })),
    types: CAMPAIGN_TYPES,
    goals: GOALS,
    channels: CHANNELS,
    contentTypes: CONTENT_TYPES,
    permissions: PERMS,
    currency: 'USD',
  };
}

function handleAction(store, c, action, body, actor) {
  const note = String(body.note || body.reason || '').trim();
  switch (action) {
    case 'submit':
    case 'send_review':
      if (!c.goal) fail(400, 'حدد هدفًا قابلاً للقياس قبل الإرسال للمراجعة');
      if (!c.goalTarget) fail(400, 'القيمة المستهدفة مطلوبة');
      if (!(c.channels || []).length) fail(400, 'اختر قناة نشر واحدة على الأقل');
      if (!(c.contents || []).length) fail(400, 'أضف عنصر محتوى واحدًا على الأقل قبل المراجعة');
      setStatus(store, c, c.status === 'draft' || c.status === 'needs_changes' || c.status === 'preparing' ? 'pending_review' : 'pending_review', actor, note);
      (c.contents || []).forEach((ct) => {
        if (ct.status === 'draft' || ct.status === 'ready_review') ct.status = 'pending_review';
      });
      return c;
    case 'approve':
      setStatus(store, c, 'approved', actor, note);
      (c.contents || []).forEach((ct) => {
        if (ct.status === 'pending_review') ct.status = 'approved';
      });
      return c;
    case 'request_changes':
      if (!note) fail(400, 'سبب طلب التعديل مطلوب');
      setStatus(store, c, 'needs_changes', actor, note);
      return c;
    case 'reject':
      if (!note) fail(400, 'سبب الرفض مطلوب');
      setStatus(store, c, 'cancelled', actor, note);
      return c;
    case 'activate':
    case 'start':
      setStatus(store, c, 'active', actor, note);
      return c;
    case 'schedule_campaign':
      setStatus(store, c, 'scheduled', actor, note);
      return c;
    case 'pause':
      setStatus(store, c, 'paused', actor, note);
      return c;
    case 'resume':
      setStatus(store, c, 'active', actor, note);
      return c;
    case 'complete':
    case 'finish':
      setStatus(store, c, 'completed', actor, note);
      return c;
    case 'archive':
      setStatus(store, c, 'archived', actor, note);
      return c;
    case 'cancel':
      setStatus(store, c, 'cancelled', actor, note);
      return c;
    case 'delete':
      if (c.status !== 'draft' && c.status !== 'cancelled' && c.status !== 'archived') {
        fail(409, 'لا يمكن حذف حملة غير مسودة/ملغاة/مؤرشفة');
      }
      store.campaigns = store.campaigns.filter((x) => x.id !== c.id);
      pushActivity(store, null, actor, 'deleted', `تم حذف الحملة ${c.id}`, { campaignId: c.id, before: c.id });
      return { deleted: true, id: c.id };
    case 'duplicate': {
      const copy = JSON.parse(JSON.stringify(c));
      copy.id = nextCode(store, 'campaign', 'CMP');
      copy.name = `${c.name} (نسخة)`;
      copy.status = 'draft';
      copy.createdAt = nowIso();
      copy.updatedAt = nowIso();
      copy.createdBy = actor.email;
      copy.publications = [];
      copy.results = [];
      copy.report = null;
      copy.activity = [];
      copy.contents = (copy.contents || []).map((ct) => {
        ct.id = nextCode(store, 'content', 'CNT');
        ct.status = 'draft';
        return ct;
      });
      store.campaigns.unshift(copy);
      pushActivity(store, copy, actor, 'duplicated', `نُسخت من ${c.id}`);
      return copy;
    }
    default:
      fail(400, 'إجراء غير معروف');
  }
}

async function handleApi(req, res, pathname, { sendJson, readBody, requireStaff }) {
  const session = requireStaff(req, res, PERMS.view);
  if (!session) return true;

  const qs = (() => {
    try {
      return Object.fromEntries(new URL(req.url, 'http://local').searchParams.entries());
    } catch {
      return {};
    }
  })();

  try {
    if (pathname === '/api/hub/marketing-campaigns/meta' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, meta: meta(), me: { email: session.email, name: session.name, role: session.role, permissions: session.permissions } });
      return true;
    }
    if (pathname === '/api/hub/marketing-campaigns/catalogs' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, catalogs: catalogs() });
      return true;
    }
    if (pathname === '/api/hub/marketing-campaigns/summary' && req.method === 'GET') {
      const store = readStore();
      sendJson(res, 200, { ok: true, summary: summary(store), alerts: listAlerts(store) });
      return true;
    }
    if (pathname === '/api/hub/marketing-campaigns/calendar' && req.method === 'GET') {
      const store = readStore();
      sendJson(res, 200, { ok: true, items: calendarItems(store, qs.from, qs.to) });
      return true;
    }
    if (pathname === '/api/hub/marketing-campaigns/activity' && req.method === 'GET') {
      const store = readStore();
      const items = qs.campaignId ? store.activity.filter((a) => a.campaignId === qs.campaignId) : store.activity;
      sendJson(res, 200, { ok: true, items: items.slice(0, 300) });
      return true;
    }
    if (pathname === '/api/hub/marketing-campaigns/videos' && req.method === 'GET') {
      const store = readStore();
      const videos = [];
      store.campaigns.forEach((c) =>
        (c.assets || [])
          .filter((a) => a.kind === 'video' || a.kind === 'short')
          .forEach((a) => videos.push({ ...a, campaignId: c.id, campaignName: c.name }))
      );
      sendJson(res, 200, { ok: true, items: videos });
      return true;
    }
    if (pathname === '/api/hub/marketing-campaigns/clips' && req.method === 'GET') {
      const store = readStore();
      const clips = [];
      store.campaigns.forEach((c) => (c.clips || []).forEach((cl) => clips.push({ ...cl, campaignId: c.id, campaignName: c.name })));
      sendJson(res, 200, { ok: true, items: clips });
      return true;
    }

    if (pathname === '/api/hub/marketing-campaigns' && req.method === 'GET') {
      const store = readStore();
      const list = filterList(store, qs).map((c) => publicCampaign(c));
      sendJson(res, 200, { ok: true, items: list, count: list.length });
      return true;
    }

    if (pathname === '/api/hub/marketing-campaigns' && req.method === 'POST') {
      assertPerm(session, PERMS.create);
      const body = await readBody(req);
      const key = String(req.headers['idempotency-key'] || body.idempotencyKey || '').trim();
      const created = await withLock(() => {
        const store = readStore();
        const c = createCampaign(store, body || {}, actorOf(session), key);
        writeStore(store);
        return c;
      });
      sendJson(res, 201, { ok: true, campaign: publicCampaign(created, { full: true }) });
      return true;
    }

    const m = pathname.match(/^\/api\/hub\/marketing-campaigns\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?(?:\/([^/]+))?$/);
    if (!m) {
      sendJson(res, 404, { ok: false, error: 'المسار غير موجود' });
      return true;
    }
    const campaignId = decodeURIComponent(m[1]);
    const part = m[2] || '';
    const subId = m[3] ? decodeURIComponent(m[3]) : '';
    const tail = m[4] || '';

    if (!part && req.method === 'GET') {
      const store = readStore();
      const c = requireCampaign(store, campaignId);
      sendJson(res, 200, { ok: true, campaign: publicCampaign(c, { full: true }) });
      return true;
    }

    if (!part && (req.method === 'PUT' || req.method === 'PATCH')) {
      assertPerm(session, PERMS.edit);
      const body = await readBody(req);
      const updated = await withLock(() => {
        const store = readStore();
        const c = requireCampaign(store, campaignId);
        const diff = applyPatch(c, body || {});
        pushActivity(store, c, actorOf(session), 'updated', 'تم تعديل بيانات الحملة', diff);
        writeStore(store);
        return c;
      });
      sendJson(res, 200, { ok: true, campaign: publicCampaign(updated, { full: true }) });
      return true;
    }

    if (part === 'action' && req.method === 'POST') {
      const body = await readBody(req);
      const action = String(body.action || '').trim();
      const permMap = {
        submit: PERMS.edit,
        send_review: PERMS.edit,
        approve: PERMS.approve,
        request_changes: PERMS.approve,
        reject: PERMS.approve,
        activate: PERMS.pause,
        start: PERMS.pause,
        schedule_campaign: PERMS.publish,
        pause: PERMS.pause,
        resume: PERMS.pause,
        complete: PERMS.pause,
        finish: PERMS.pause,
        archive: PERMS.delete,
        cancel: PERMS.pause,
        delete: PERMS.delete,
        duplicate: PERMS.create,
      };
      assertPerm(session, permMap[action] || PERMS.edit);
      const result = await withLock(() => {
        const store = readStore();
        const c = requireCampaign(store, campaignId);
        const out = handleAction(store, c, action, body || {}, actorOf(session));
        writeStore(store);
        return out;
      });
      if (result && result.deleted) {
        sendJson(res, 200, { ok: true, deleted: true, id: result.id });
        return true;
      }
      sendJson(res, 200, { ok: true, campaign: publicCampaign(result, { full: true }) });
      return true;
    }

    const mutateChild = async (fn) => {
      const out = await withLock(() => {
        const store = readStore();
        const c = requireCampaign(store, campaignId);
        const ret = fn(store, c);
        writeStore(store);
        return ret;
      });
      sendJson(res, 200, { ok: true, campaign: publicCampaign(out, { full: true }) });
    };

    if (part === 'audiences' && req.method === 'POST') {
      assertPerm(session, PERMS.edit);
      const body = await readBody(req);
      await mutateChild((store, c) => {
        const row = {
          id: nextCode(store, 'audience', 'AUD'),
          type: body.type || 'جمهور جديد',
          region: body.region || '',
          age: body.age || '',
          interests: body.interests || '',
          sector: body.sector || '',
          customerType: body.customerType || '',
          traits: body.traits || '',
          notes: body.notes || '',
        };
        c.audiences.push(row);
        pushActivity(store, c, actorOf(session), 'audience_add', `شريحة جمهور ${row.id}`);
        return c;
      });
      return true;
    }
    if (part === 'audiences' && subId && req.method === 'DELETE') {
      assertPerm(session, PERMS.edit);
      await mutateChild((store, c) => {
        c.audiences = (c.audiences || []).filter((a) => a.id !== subId);
        pushActivity(store, c, actorOf(session), 'audience_del', `حذف شريحة ${subId}`);
        return c;
      });
      return true;
    }
    if (part === 'links' && req.method === 'POST') {
      assertPerm(session, PERMS.edit);
      const body = await readBody(req);
      await mutateChild((store, c) => {
        c.links.push({
          id: `lnk-${crypto.randomBytes(3).toString('hex')}`,
          kind: body.kind || 'external',
          refId: body.refId || body.id || '',
          label: body.label || '',
          url: body.url || '',
        });
        pushActivity(store, c, actorOf(session), 'link_add', body.label || body.refId || 'ربط عنصر');
        return c;
      });
      return true;
    }
    if (part === 'links' && subId && req.method === 'DELETE') {
      assertPerm(session, PERMS.edit);
      await mutateChild((store, c) => {
        c.links = (c.links || []).filter((a) => a.id !== subId);
        return c;
      });
      return true;
    }
    if (part === 'budget' && req.method === 'PUT') {
      assertPerm(session, PERMS.budget);
      const body = await readBody(req);
      await mutateChild((store, c) => {
        const before = { ...c.budget };
        c.budget = {
          total: Number(body.total ?? c.budget.total ?? 0),
          currency: body.currency || c.budget.currency || 'USD',
          contentCost: Number(body.contentCost ?? c.budget.contentCost ?? 0),
          adCost: Number(body.adCost ?? c.budget.adCost ?? 0),
          otherCost: Number(body.otherCost ?? c.budget.otherCost ?? 0),
          spent: Number(c.budget.spent || 0),
          channelBudgets: Array.isArray(body.channelBudgets)
            ? body.channelBudgets
            : c.budget.channelBudgets || [],
        };
        pushActivity(store, c, actorOf(session), 'budget', 'تم تعديل الميزانية', { before, after: c.budget });
        return c;
      });
      return true;
    }
    if (part === 'expenses' && req.method === 'POST') {
      assertPerm(session, PERMS.budget);
      const body = await readBody(req);
      await mutateChild((store, c) => {
        c.expenses.push({
          id: nextCode(store, 'expense', 'EXP'),
          amount: Number(body.amount || 0),
          note: body.note || '',
          channel: body.channel || '',
          at: nowIso(),
          by: actorOf(session).email,
        });
        pushActivity(store, c, actorOf(session), 'expense', `مصروف ${body.amount || 0}`);
        return c;
      });
      return true;
    }
    if (part === 'channels' && req.method === 'PUT') {
      assertPerm(session, PERMS.edit);
      const body = await readBody(req);
      await mutateChild((store, c) => {
        const ids = Array.isArray(body.ids) ? body.ids : [];
        c.channels = CHANNELS.filter((ch) => ids.includes(ch.id)).map((ch) => ({ ...ch, enabled: true }));
        pushActivity(store, c, actorOf(session), 'channels', `القنوات: ${c.channels.map((x) => x.label).join('، ')}`);
        return c;
      });
      return true;
    }
    if (part === 'contents' && req.method === 'POST' && !subId) {
      assertPerm(session, PERMS.content);
      const body = await readBody(req);
      await mutateChild((store, c) => {
        const row = {
          id: nextCode(store, 'content', 'CNT'),
          type: body.type || 'text',
          title: String(body.title || '').trim() || 'محتوى بدون عنوان',
          body: String(body.body || '').trim(),
          channel: body.channel || '',
          timezone: body.timezone || 'Asia/Riyadh',
          scheduleDate: body.scheduleDate || '',
          scheduleTime: body.scheduleTime || '',
          status: 'draft',
          assetIds: Array.isArray(body.assetIds) ? body.assetIds : [],
          createdAt: nowIso(),
          createdBy: actorOf(session).email,
        };
        c.contents.push(row);
        pushActivity(store, c, actorOf(session), 'content_add', `${row.id} · ${row.title}`);
        return c;
      });
      return true;
    }
    if (part === 'contents' && subId && req.method === 'PUT') {
      assertPerm(session, PERMS.content);
      const body = await readBody(req);
      await mutateChild((store, c) => {
        const ct = (c.contents || []).find((x) => x.id === subId);
        if (!ct) fail(404, 'عنصر المحتوى غير موجود');
        ['title', 'body', 'type', 'channel', 'timezone', 'scheduleDate', 'scheduleTime'].forEach((k) => {
          if (body[k] != null) ct[k] = body[k];
        });
        if (Array.isArray(body.assetIds)) ct.assetIds = body.assetIds;
        pushActivity(store, c, actorOf(session), 'content_edit', subId);
        return c;
      });
      return true;
    }
    if (part === 'contents' && subId && tail === 'action' && req.method === 'POST') {
      const body = await readBody(req);
      const action = String(body.action || '').trim();
      if (['approve', 'request_changes', 'reject'].includes(action)) assertPerm(session, PERMS.approve);
      else if (action === 'publish') assertPerm(session, PERMS.publish);
      else assertPerm(session, PERMS.content);
      await mutateChild((store, c) => {
        const ct = (c.contents || []).find((x) => x.id === subId);
        if (!ct) fail(404, 'عنصر المحتوى غير موجود');
        if (action === 'submit') ct.status = 'pending_review';
        else if (action === 'approve') ct.status = 'approved';
        else if (action === 'schedule') {
          if (!ct.scheduleDate) fail(400, 'تاريخ الجدولة مطلوب');
          ct.status = 'scheduled';
          if (c.status === 'approved') setStatus(store, c, 'scheduled', actorOf(session));
        } else if (action === 'publish') {
          ct.status = 'published';
        } else if (action === 'fail') ct.status = 'publish_failed';
        else if (action === 'cancel') ct.status = 'cancelled';
        else fail(400, 'إجراء محتوى غير معروف');
        pushActivity(store, c, actorOf(session), 'content_status', `${ct.id} ← ${CONTENT_STATUS_LABEL[ct.status]}`);
        return c;
      });
      return true;
    }
    if (part === 'assets' && req.method === 'POST') {
      assertPerm(session, PERMS.upload);
      const body = await readBody(req);
      if (!body.url || !body.uploadId) fail(400, 'ملف الرفع غير مكتمل');
      await mutateChild((store, c) => {
        const kind = String(body.kind || 'file');
        const row = {
          id: nextCode(store, 'asset', 'AST'),
          kind,
          name: body.name || 'ملف',
          mime: body.mime || '',
          size: Number(body.size || 0),
          url: body.url,
          uploadId: body.uploadId,
          duration: body.duration || '',
          campaignId: c.id,
          contentId: body.contentId || '',
          uploadedBy: actorOf(session).email,
          uploadedByName: actorOf(session).name,
          uploadedAt: nowIso(),
          status: 'ready',
        };
        c.assets.push(row);
        if (body.contentId) {
          const ct = (c.contents || []).find((x) => x.id === body.contentId);
          if (ct) ct.assetIds = [...new Set([...(ct.assetIds || []), row.id])];
        }
        pushActivity(store, c, actorOf(session), 'asset_add', `${row.id} · ${row.name}`);
        return c;
      });
      return true;
    }
    if (part === 'assets' && subId && req.method === 'PUT') {
      assertPerm(session, PERMS.upload);
      const body = await readBody(req);
      await mutateChild((store, c) => {
        const a = (c.assets || []).find((x) => x.id === subId);
        if (!a) fail(404, 'الملف غير موجود');
        if (body.name != null) a.name = String(body.name).trim() || a.name;
        if (body.duration != null) a.duration = body.duration;
        if (body.status != null) a.status = body.status;
        pushActivity(store, c, actorOf(session), 'asset_edit', subId);
        return c;
      });
      return true;
    }
    if (part === 'assets' && subId && req.method === 'DELETE') {
      assertPerm(session, PERMS.delete);
      await mutateChild((store, c) => {
        c.assets = (c.assets || []).filter((a) => a.id !== subId);
        pushActivity(store, c, actorOf(session), 'asset_del', subId);
        return c;
      });
      return true;
    }
    if (part === 'clips' && req.method === 'POST') {
      assertPerm(session, PERMS.content);
      const body = await readBody(req);
      await mutateChild((store, c) => {
        const row = {
          id: nextCode(store, 'clip', 'CLIP'),
          title: body.title || 'مقطع قصير',
          sourceAssetId: body.sourceAssetId || '',
          assetId: body.assetId || body.sourceAssetId || '',
          duration: body.duration || '',
          platform: body.platform || '',
          status: 'ready',
          createdAt: nowIso(),
          createdBy: actorOf(session).email,
          thumbnail: body.thumbnail || '',
        };
        c.clips.push(row);
        pushActivity(store, c, actorOf(session), 'clip_add', `${row.id} · ${row.title}`);
        return c;
      });
      return true;
    }
    if (part === 'publish' && req.method === 'POST') {
      assertPerm(session, PERMS.publish);
      const body = await readBody(req);
      await mutateChild((store, c) => {
        const platform = String(body.platform || '').trim();
        if (!platform) fail(400, 'المنصة مطلوبة');
        const def = CHANNELS.find((x) => x.id === platform);
        const row = {
          id: nextCode(store, 'pub', 'PUB'),
          platform,
          platformLabel: def?.label || platform,
          mode: def?.mode || 'manual',
          url: body.url || '',
          note: body.note || '',
          contentId: body.contentId || '',
          at: nowIso(),
          by: actorOf(session).email,
          byName: actorOf(session).name,
        };
        c.publications.push(row);
        if (body.contentId) {
          const ct = (c.contents || []).find((x) => x.id === body.contentId);
          if (ct) ct.status = 'published';
        }
        if (c.status === 'approved' || c.status === 'scheduled') setStatus(store, c, 'active', actorOf(session));
        pushActivity(store, c, actorOf(session), 'published', `تسجيل نشر على ${row.platformLabel}`);
        return c;
      });
      return true;
    }
    if (part === 'results' && req.method === 'POST') {
      assertPerm(session, PERMS.reports);
      const body = await readBody(req);
      await mutateChild((store, c) => {
        const row = {
          id: nextCode(store, 'result', 'RES'),
          platform: body.platform || '',
          date: body.date || new Date().toISOString().slice(0, 10),
          views: Number(body.views || 0),
          reach: Number(body.reach || 0),
          clicks: Number(body.clicks || 0),
          visits: Number(body.visits || 0),
          leads: Number(body.leads || 0),
          signups: Number(body.signups || 0),
          sales: Number(body.sales || 0),
          conversions: Number(body.conversions || 0),
          spend: Number(body.spend || 0),
          enteredBy: actorOf(session).email,
          enteredByName: actorOf(session).name,
          enteredAt: nowIso(),
        };
        c.results.push(row);
        pushActivity(store, c, actorOf(session), 'results', `نتائج ${row.platform || ''} ${row.date}`);
        return c;
      });
      return true;
    }
    if (part === 'report' && req.method === 'POST') {
      assertPerm(session, PERMS.reports);
      await mutateChild((store, c) => {
        const m = computeMetrics(c);
        const money = remainingOf(c);
        c.report = {
          generatedAt: nowIso(),
          generatedBy: actorOf(session).email,
          campaignId: c.id,
          status: c.status,
          budget: { ...c.budget, ...money },
          metrics: m,
          publications: (c.publications || []).length,
          contents: (c.contents || []).length,
          summary: `${c.name} · ${c.id} · ${STATUS_LABEL[c.status]}`,
        };
        pushActivity(store, c, actorOf(session), 'report', 'تم إنشاء التقرير النهائي');
        return c;
      });
      return true;
    }

    sendJson(res, 404, { ok: false, error: 'المسار غير موجود' });
    return true;
  } catch (err) {
    sendJson(res, err.status || 500, { ok: false, error: err.message || 'تعذر تنفيذ العملية' });
    return true;
  }
}

module.exports = {
  PERMS,
  ALL_PERMS,
  handleApi,
  readStore,
  publicCampaign,
};
