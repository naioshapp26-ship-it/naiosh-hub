/**
 * Product categories — file-backed store with optional Postgres mirror.
 * Single source of truth for shop filters + product forms.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_PATH = path.join(__dirname, '..', 'data', 'product-categories.json');

const DEFAULT_SEED = [
  { id: 'إي آر بي', name: 'إي آر بي', icon: 'fa-sitemap' },
  { id: 'نايس', name: 'نايس', icon: 'fa-chart-line' },
  { id: 'فيت', name: 'فيت', icon: 'fa-dumbbell' },
  { id: 'أكاديمية', name: 'أكاديمية', icon: 'fa-graduation-cap' },
  { id: 'قانونية', name: 'قانونية', icon: 'fa-gavel' },
  { id: 'سمارتكس', name: 'سمارتكس', icon: 'fa-video' },
  { id: 'إيديو سمارتكس', name: 'إيديو سمارتكس', icon: 'fa-graduation-cap' },
  { id: 'نايوش', name: 'نايوش', icon: 'fa-book-open-reader' },
  { id: 'نظام الأرشفة', name: 'نظام الأرشفة', icon: 'fa-box-archive' },
  { id: 'استديو الحملات التسويقية', name: 'استديو الحملات التسويقية', icon: 'fa-bullhorn' },
  { id: 'استوديو الفعاليات', name: 'استوديو الفعاليات', icon: 'fa-calendar-days' },
  { id: 'مركز المعلمين', name: 'مركز المعلمين', icon: 'fa-chalkboard-user' },
  { id: 'الإنترنت والأتمتة', name: 'الإنترنت والأتمتة', icon: 'fa-globe' },
  { id: 'إدارة المرافق', name: 'إدارة المرافق', icon: 'fa-building' },
  { id: 'سلاسل التوريد', name: 'سلاسل التوريد', icon: 'fa-truck' },
  { id: 'حاضنة السلامة', name: 'حاضنة السلامة', icon: 'fa-helmet-safety' },
  { id: 'إدارة العملاء CRM', name: 'إدارة العملاء CRM', icon: 'fa-handshake' },
  { id: 'الموارد البشرية', name: 'الموارد البشرية', icon: 'fa-users' },
  { id: 'القوائم والتقارير المالية', name: 'القوائم والتقارير المالية', icon: 'fa-file-invoice-dollar' },
  { id: 'المشتريات والطلبات', name: 'المشتريات والطلبات', icon: 'fa-cart-flatbed' },
  { id: 'إدارة الموظفين', name: 'إدارة الموظفين', icon: 'fa-id-badge' },
  { id: 'المهام', name: 'المهام', icon: 'fa-list-check' },
  { id: 'نظام الدفع', name: 'نظام الدفع', icon: 'fa-credit-card' },
  { id: 'المبيعات', name: 'المبيعات', icon: 'fa-cash-register' },
  { id: 'الدعم والتحصيل', name: 'الدعم والتحصيل', icon: 'fa-headset' },
];

const ALL_CATEGORY = { id: 'الكل', name: 'كل المنتجات', icon: 'fa-border-all', status: 'active', system: true };

function nowIso() {
  return new Date().toISOString();
}

function uid() {
  return `pcat-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function normalizeName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function nameKey(name) {
  return normalizeName(name).toLowerCase();
}

function ensureDir() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function seedItems() {
  const ts = nowIso();
  return DEFAULT_SEED.map((c) => ({
    id: c.id,
    name: c.name,
    description: '',
    icon: c.icon || 'fa-tag',
    status: 'active',
    system: true,
    createdAt: ts,
    updatedAt: ts,
  }));
}

function readStore() {
  ensureDir();
  if (!fs.existsSync(DATA_PATH)) {
    const items = seedItems();
    writeStore(items);
    return { version: 1, items };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
    if (!items.length) {
      const seeded = seedItems();
      writeStore(seeded);
      return { version: 1, items: seeded };
    }
    return { version: raw.version || 1, items };
  } catch {
    const items = seedItems();
    writeStore(items);
    return { version: 1, items };
  }
}

function writeStore(items) {
  ensureDir();
  fs.writeFileSync(
    DATA_PATH,
    JSON.stringify({ version: 1, updatedAt: nowIso(), items }, null, 2),
    'utf8'
  );
}

function list({ includeInactive = false } = {}) {
  const items = readStore().items.slice();
  const filtered = includeInactive ? items : items.filter((c) => c.status !== 'inactive');
  return {
    all: ALL_CATEGORY,
    items: filtered,
    shop: [ALL_CATEGORY, ...filtered.filter((c) => c.status !== 'inactive')],
  };
}

function findById(id) {
  return readStore().items.find((c) => String(c.id) === String(id)) || null;
}

function findByName(name, { excludeId } = {}) {
  const key = nameKey(name);
  if (!key) return null;
  return (
    readStore().items.find(
      (c) => nameKey(c.name) === key && (!excludeId || String(c.id) !== String(excludeId))
    ) || null
  );
}

function create({ name, description = '', icon = 'fa-tag', status = 'active' } = {}) {
  const cleanName = normalizeName(name);
  if (!cleanName) {
    const err = new Error('اسم التصنيف مطلوب.');
    err.status = 400;
    throw err;
  }
  if (cleanName === 'كل المنتجات' || cleanName === 'الكل') {
    const err = new Error('لا يمكن استخدام هذا الاسم.');
    err.status = 400;
    throw err;
  }
  if (findByName(cleanName)) {
    const err = new Error('يوجد تصنيف بهذا الاسم بالفعل.');
    err.status = 409;
    throw err;
  }
  const item = {
    id: uid(),
    name: cleanName,
    description: String(description || '').trim(),
    icon: String(icon || 'fa-tag').trim() || 'fa-tag',
    status: status === 'inactive' ? 'inactive' : 'active',
    system: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const store = readStore();
  store.items.push(item);
  writeStore(store.items);
  return item;
}

function update(id, patch = {}) {
  const store = readStore();
  const idx = store.items.findIndex((c) => String(c.id) === String(id));
  if (idx < 0) {
    const err = new Error('التصنيف غير موجود.');
    err.status = 404;
    throw err;
  }
  const current = store.items[idx];
  const next = { ...current };

  if (patch.name != null) {
    const cleanName = normalizeName(patch.name);
    if (!cleanName) {
      const err = new Error('اسم التصنيف مطلوب.');
      err.status = 400;
      throw err;
    }
    if (cleanName === 'كل المنتجات' || cleanName === 'الكل') {
      const err = new Error('لا يمكن استخدام هذا الاسم.');
      err.status = 400;
      throw err;
    }
    if (findByName(cleanName, { excludeId: id })) {
      const err = new Error('يوجد تصنيف بهذا الاسم بالفعل.');
      err.status = 409;
      throw err;
    }
    next.name = cleanName;
  }
  if (patch.description != null) next.description = String(patch.description || '').trim();
  if (patch.icon != null) next.icon = String(patch.icon || 'fa-tag').trim() || 'fa-tag';
  if (patch.status != null) next.status = patch.status === 'inactive' ? 'inactive' : 'active';
  next.updatedAt = nowIso();

  const oldId = current.id;
  // Keep stable id for custom cats; system cats keep their id (= legacy name key)
  store.items[idx] = next;
  writeStore(store.items);
  return { item: next, renamedFrom: oldId !== next.id ? oldId : current.name !== next.name ? current.name : null, previousName: current.name };
}

function remove(id, { replacementId } = {}) {
  const store = readStore();
  const idx = store.items.findIndex((c) => String(c.id) === String(id));
  if (idx < 0) {
    const err = new Error('التصنيف غير موجود.');
    err.status = 404;
    throw err;
  }
  const item = store.items[idx];
  let replacement = null;
  if (replacementId) {
    replacement = store.items.find((c) => String(c.id) === String(replacementId));
    if (!replacement || String(replacement.id) === String(id)) {
      const err = new Error('اختر تصنيفًا بديلًا صالحًا.');
      err.status = 400;
      throw err;
    }
  }
  store.items.splice(idx, 1);
  writeStore(store.items);
  return { deleted: item, replacement };
}

module.exports = {
  ALL_CATEGORY,
  DEFAULT_SEED,
  list,
  findById,
  findByName,
  create,
  update,
  remove,
  readStore,
};
