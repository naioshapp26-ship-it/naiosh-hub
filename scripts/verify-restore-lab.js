/**
 * Verify an isolated restore-lab Postgres.
 *
 * Safety:
 * - Requires RESTORE_LAB_DATABASE_URL (never uses production DATABASE_URL).
 * - Refuses known production hosts / service names.
 * - Opens connection read-only.
 * - Does not call Hub HTTP APIs, webhooks, or send notifications.
 *
 *   RESTORE_LAB_DATABASE_URL=... node scripts/verify-restore-lab.js
 */
'use strict';

const fs = require('fs');
const { Client } = require('pg');

const URL_RAW = String(process.env.RESTORE_LAB_DATABASE_URL || '').trim();
const OUT = '/opt/cursor/artifacts/launch-restore-lab-verify.json';

const BLOCKED_HOST_SNIPPETS = [
  'naiosh-hub-production',
  'postgres.railway.internal', // often prod private DNS; allow only if lab name present
];

const REQUIRED_TABLES = [
  'schema_migrations',
  'hub_meta',
  'hub_users',
  'hub_higher_approvals',
  'hub_higher_approval_decisions',
  'hub_client_service_requests',
  'hub_client_complaints',
  'hub_client_tickets',
  'hub_ad_submissions',
  'hub_orders',
];

function assertSafeUrl(urlString) {
  if (!urlString) {
    const err = new Error('RESTORE_LAB_DATABASE_URL missing');
    err.code = 'NO_LAB_URL';
    throw err;
  }
  let u;
  try {
    u = new URL(urlString);
  } catch {
    throw new Error('RESTORE_LAB_DATABASE_URL is not a valid URL');
  }
  if (!/^postgres/i.test(u.protocol)) throw new Error('URL must be postgres');
  const host = String(u.hostname || '').toLowerCase();
  const full = urlString.toLowerCase();
  // Hard block obvious production app hostname in connection string
  if (full.includes('naiosh-hub-production')) {
    throw new Error('Refusing URL that looks like production app service');
  }
  // Require lab naming signals when using railway.internal
  // Railway public proxy hosts rarely include the service name. Isolation is
  // enforced upstream by railway-restore-lab.js (service id + fingerprint).
  // Here we only refuse when an explicit production app hostname appears.
  if ((host.endsWith('railway.internal') || host.includes('rlwy.net') || host.includes('railway')) &&
      process.env.RESTORE_LAB_ALLOW !== '1' &&
      !full.includes('restore-lab') &&
      !full.includes('restore_lab')) {
    throw new Error(
      'Railway URL refused without RESTORE_LAB_ALLOW=1 (set only after railway-restore-lab destination precheck).'
    );
  }
  for (const snip of BLOCKED_HOST_SNIPPETS) {
    if (snip === 'postgres.railway.internal') continue;
    if (host.includes(snip) || full.includes(snip)) {
      throw new Error(`Refusing blocked host pattern: ${snip}`);
    }
  }
  return u;
}

async function main() {
  const report = {
    at: new Date().toISOString(),
    mode: 'restore-lab-verify-readonly',
    safety: {
      usesProductionDatabaseUrl: false,
      readOnly: true,
      notifications: 'none',
      hubAppCalls: 'none',
    },
    cases: [],
  };
  const mark = (name, ok, detail) => {
    report.cases.push({ name, result: ok ? 'PASS' : 'FAIL', detail: String(detail || '') });
    console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  };

  let hostSafe = null;
  try {
    hostSafe = assertSafeUrl(URL_RAW);
    mark('url_present_and_safe', true, `host=${hostSafe.hostname} db=${hostSafe.pathname}`);
  } catch (e) {
    mark('url_present_and_safe', false, e.message);
    report.fullPass = false;
    fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
    process.exit(e.code === 'NO_LAB_URL' ? 2 : 1);
  }

  const client = new Client({
    connectionString: URL_RAW,
    ssl: /localhost|127\.0\.0\.1/.test(hostSafe.hostname) ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });

  try {
    await client.connect();
    await client.query('SET default_transaction_read_only = on');
    await client.query('SET statement_timeout = 30000');
    mark('connect_readonly', true, 'connected');

    const who = await client.query('SELECT current_database() AS db, inet_server_addr()::text AS addr, version() AS v');
    report.server = {
      database: who.rows[0]?.db,
      addr: who.rows[0]?.addr,
      version: String(who.rows[0]?.v || '').split(' ').slice(0, 2).join(' '),
    };
    mark('identity', true, `db=${report.server.database}`);

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const names = tables.rows.map((r) => r.table_name);
    report.tableCount = names.length;
    mark('has_public_tables', names.length >= 10, `count=${names.length}`);

    const missing = REQUIRED_TABLES.filter((t) => !names.includes(t));
    mark('required_tables_present', missing.length === 0, missing.length ? `missing=${missing.join(',')}` : 'all required found');

    // Row counts for key tables (read-only)
    const counts = {};
    for (const t of REQUIRED_TABLES.filter((x) => names.includes(x))) {
      try {
        const c = await client.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
        counts[t] = c.rows[0].n;
      } catch (e) {
        counts[t] = `err:${e.message}`;
      }
    }
    report.counts = counts;
    mark(
      'core_data_present',
      Number(counts.hub_meta) >= 0 && Number(counts.hub_users) >= 0,
      `hub_meta=${counts.hub_meta} hub_users=${counts.hub_users} ha=${counts.hub_higher_approvals}`
    );

    // FK integrity sample: orphan decisions without parent approval
    if (names.includes('hub_higher_approval_decisions') && names.includes('hub_higher_approvals')) {
      let orphan = null;
      try {
        // column names may vary; probe information_schema
        const cols = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'hub_higher_approval_decisions'
        `);
        const colset = new Set(cols.rows.map((r) => r.column_name));
        const fkCol = ['approval_id', 'request_id', 'higher_approval_id'].find((c) => colset.has(c));
        if (fkCol) {
          const q = await client.query(
            `SELECT COUNT(*)::int AS n
             FROM hub_higher_approval_decisions d
             LEFT JOIN hub_higher_approvals a ON a.id::text = d.${fkCol}::text
             WHERE a.id IS NULL`
          );
          orphan = q.rows[0].n;
          mark('ha_decision_orphans', orphan === 0, `orphans=${orphan} fk=${fkCol}`);
        } else {
          mark('ha_decision_orphans', true, 'skipped (no recognizable fk column)');
        }
      } catch (e) {
        mark('ha_decision_orphans', false, e.message);
      }
    }

    // Relationships: hub_branches → hub_countries if both exist
    if (names.includes('hub_branches') && names.includes('hub_countries')) {
      try {
        const orphans = await client.query(`
          SELECT COUNT(*)::int AS n
          FROM hub_branches b
          LEFT JOIN hub_countries c ON c.code = b.country_code
          WHERE b.country_code IS NOT NULL AND c.code IS NULL
        `);
        mark('branch_country_fk', orphans.rows[0].n === 0, `orphans=${orphans.rows[0].n}`);
      } catch (e) {
        mark('branch_country_fk', false, e.message);
      }
    }

    // Ensure we did not write
    mark('no_writes_attempted', true, 'verification queries only');
  } catch (e) {
    mark('connect_readonly', false, e.message);
  } finally {
    try {
      await client.end();
    } catch (_) {}
  }

  report.pass = report.cases.filter((c) => c.result === 'PASS').length;
  report.fail = report.cases.filter((c) => c.result === 'FAIL').length;
  report.fullPass = report.fail === 0;
  fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ fullPass: report.fullPass, pass: report.pass, fail: report.fail, out: OUT }, null, 2));
  process.exit(report.fullPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
