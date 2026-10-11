const fs = require('fs');
const path = require('path');

function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL || '';
}

function sslFor(url) {
  if (!url) return false;
  if (/localhost|127\.0\.0\.1/.test(url)) return false;
  return { rejectUnauthorized: false };
}

let pool = null;
let poolUrl = '';

function getPool() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    const err = new Error('DATABASE_URL غير موجودة');
    err.code = 'NO_DATABASE_URL';
    throw err;
  }
  if (pool && poolUrl === databaseUrl) return pool;
  if (pool) {
    pool.end().catch(() => {});
    pool = null;
  }
  const { Pool } = require('pg');
  const max = Math.max(4, Number(process.env.HUB_PG_POOL_MAX || 20));
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: sslFor(databaseUrl),
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });
  pool.on('error', (err) => {
    console.warn('[db] pool error:', err.message);
  });
  poolUrl = databaseUrl;
  return pool;
}

async function withClient(fn) {
  const p = getPool();
  const client = await p.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function closePool() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
    poolUrl = '';
  }
}

async function runSqlFile(client, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await client.query(sql);
}

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const seedPath = path.join(__dirname, 'seed.sql');

  return withClient(async (client) => {
    await runSqlFile(client, schemaPath);
    await client.query(
      `INSERT INTO schema_migrations (name) VALUES ($1)
       ON CONFLICT (name) DO NOTHING`,
      ['001_hub_core_schema']
    );
    await runSqlFile(client, seedPath);
    await client.query(
      `INSERT INTO schema_migrations (name) VALUES ($1)
       ON CONFLICT (name) DO NOTHING`,
      ['002_hub_seed']
    );

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    return {
      ok: true,
      tables: tables.rows.map((r) => r.table_name),
      count: tables.rows.length,
    };
  });
}

async function listTables() {
  return withClient(async (client) => {
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const counts = {};
    for (const row of tables.rows) {
      const name = row.table_name;
      const c = await client.query(`SELECT COUNT(*)::int AS n FROM ${quoteIdent(name)}`);
      counts[name] = c.rows[0].n;
    }
    return { tables: tables.rows.map((r) => r.table_name), counts };
  });
}

function quoteIdent(name) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Invalid table name: ${name}`);
  }
  return `"${name}"`;
}

module.exports = {
  getDatabaseUrl,
  migrate,
  listTables,
  withClient,
  getPool,
  closePool,
};
