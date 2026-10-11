/**
 * Durable JSON store mirrored to Postgres hub_meta.
 * Local file = cache; hub_meta = source of truth when DATABASE_URL is set.
 */
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * @param {{
 *   metaKey: string,
 *   storePath: string,
 *   blank: () => object,
 *   label?: string,
 *   preferDb?: (dbStore: object, fileStore: object) => boolean,
 * }} opts
 */
function createDurableMetaStore(opts) {
  const metaKey = opts.metaKey;
  const storePath = opts.storePath;
  const blank = opts.blank;
  const label = opts.label || metaKey;
  const preferDb =
    opts.preferDb ||
    ((dbStore, fileStore) => {
      const dbUpdated = Date.parse(dbStore?.updatedAt || 0) || 0;
      const fileUpdated = Date.parse(fileStore?.updatedAt || 0) || 0;
      const dbSize = JSON.stringify(dbStore || {}).length;
      const fileSize = JSON.stringify(fileStore || {}).length;
      return dbSize >= fileSize || dbUpdated >= fileUpdated;
    });

  let mem = null;
  let hydrated = false;
  let dbWriteQueue = Promise.resolve();
  let lastPersistError = null;
  /** Coalesce: only the latest pending store snapshot is written. */
  let pendingDbStore = null;
  let flushLoopRunning = false;

  function ensureDir() {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  function readFileStore() {
    ensureDir();
    if (!fs.existsSync(storePath)) {
      const b = blank();
      fs.writeFileSync(storePath, JSON.stringify(b, null, 2), 'utf8');
      return b;
    }
    try {
      return JSON.parse(fs.readFileSync(storePath, 'utf8'));
    } catch {
      return blank();
    }
  }

  function writeFileStore(store) {
    ensureDir();
    const next = { ...store, updatedAt: store.updatedAt || new Date().toISOString() };
    const tmp = `${storePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
    fs.renameSync(tmp, storePath);
    mem = next;
    return next;
  }

  function dbEnabled() {
    try {
      return !!require('../db/migrate').getDatabaseUrl();
    } catch {
      return false;
    }
  }

  async function loadFromDb() {
    if (!dbEnabled()) return null;
    try {
      const { withClient } = require('../db/migrate');
      return await withClient(async (client) => {
        const r = await client.query(`SELECT value FROM hub_meta WHERE key = $1 LIMIT 1`, [metaKey]);
        if (!r.rows[0]?.value) return null;
        const value = r.rows[0].value;
        return typeof value === 'string' ? JSON.parse(value) : value;
      });
    } catch (err) {
      console.warn(`[${label}] DB load skipped:`, err.message);
      return null;
    }
  }

  async function writePayloadToDb(store) {
    const { withClient } = require('../db/migrate');
    const payload = { ...store, updatedAt: store.updatedAt || new Date().toISOString() };
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO hub_meta (key, value, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [metaKey, JSON.stringify(payload)]
      );
    });
  }

  function persistToDb(store) {
    if (!dbEnabled()) return Promise.resolve({ ok: true, skipped: true });
    lastPersistError = null;
    pendingDbStore = store;
    if (flushLoopRunning) return dbWriteQueue;
    flushLoopRunning = true;
    dbWriteQueue = (async () => {
      try {
        while (pendingDbStore) {
          const snapshot = pendingDbStore;
          pendingDbStore = null;
          try {
            await writePayloadToDb(snapshot);
          } catch (err) {
            lastPersistError = err;
            console.warn(`[${label}] DB persist failed:`, err.message);
            throw err;
          }
        }
      } catch (err) {
        lastPersistError = err;
      } finally {
        flushLoopRunning = false;
        if (pendingDbStore) persistToDb(pendingDbStore);
      }
    })();
    return dbWriteQueue;
  }

  async function hydrateFromDb() {
    const fileStore = readFileStore();
    if (!dbEnabled()) {
      mem = fileStore;
      hydrated = true;
      return { ok: true, source: 'file', store: mem };
    }
    const fromDb = await loadFromDb();
    if (fromDb && preferDb(fromDb, fileStore)) {
      mem = writeFileStore(fromDb);
      hydrated = true;
      return { ok: true, source: 'db', store: mem };
    }
    mem = fileStore;
    hydrated = true;
    if (fromDb == null && fileStore) {
      await persistToDb(fileStore);
      await dbWriteQueue;
    }
    return { ok: true, source: fromDb ? 'file' : 'file_promoted', store: mem };
  }

  function readStore() {
    if (mem) return mem;
    mem = readFileStore();
    return mem;
  }

  function writeStore(store) {
    const next = writeFileStore({
      ...store,
      updatedAt: new Date().toISOString(),
    });
    persistToDb(next);
    return next;
  }

  async function writeStoreAndFlush(store) {
    const next = writeStore(store);
    await flushDurable();
    if (dbEnabled() && lastPersistError) {
      const err = new Error(`فشل الحفظ الدائم (${label}): ${lastPersistError.message}`);
      err.status = 503;
      err.code = 'DURABLE_PERSIST_FAILED';
      throw err;
    }
    return next;
  }

  async function flushDurable() {
    await dbWriteQueue;
    return { ok: !lastPersistError, error: lastPersistError ? lastPersistError.message : null };
  }

  function resetForTests() {
    mem = null;
    hydrated = false;
    lastPersistError = null;
    dbWriteQueue = Promise.resolve();
  }

  return {
    metaKey,
    storePath,
    dbEnabled,
    hydrateFromDb,
    readStore,
    writeStore,
    writeStoreAndFlush,
    flushDurable,
    loadFromDb,
    resetForTests,
    get hydrated() {
      return hydrated;
    },
  };
}

module.exports = { createDurableMetaStore };
