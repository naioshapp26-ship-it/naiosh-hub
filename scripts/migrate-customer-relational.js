/**
 * Safe customer relational migration with backup + verify.
 *
 * DATABASE_URL=postgresql://hubtest:hubtest@127.0.0.1:5432/naiosh_hub_test \
 *   node scripts/migrate-customer-relational.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ART = '/opt/cursor/artifacts/customer-relational';
const ROOT = path.resolve(__dirname, '..');

function ensureArt() {
  fs.mkdirSync(ART, { recursive: true });
}

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    p.stdout.on('data', (d) => {
      out += d;
    });
    p.stderr.on('data', (d) => {
      out += d;
    });
    p.on('exit', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} failed (${code}): ${out.slice(-500)}`));
    });
  });
}

async function main() {
  ensureArt();
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  if (/railway|production/i.test(process.env.DATABASE_URL) && process.env.HUB_ALLOW_PROD_MIGRATE !== '1') {
    console.error('Refusing production DATABASE_URL without HUB_ALLOW_PROD_MIGRATE=1');
    process.exit(1);
  }

  const report = {
    at: new Date().toISOString(),
    PASS: [],
    FAIL: [],
    NOT_TESTED: [],
    details: {},
  };
  const mark = (name, pass, note) => report[pass ? 'PASS' : 'FAIL'].push({ name, note });

  const { migrate } = require('../db/migrate');
  await migrate();

  // Backup before mutate
  const dump = path.join(ART, `pre-migrate-${Date.now()}.dump`);
  try {
    const u = new URL(process.env.DATABASE_URL);
    await run(
      'pg_dump',
      ['-h', u.hostname, '-p', u.port || '5432', '-U', u.username, '-d', u.pathname.replace(/^\//, ''), '-Fc', '-f', dump],
      { PGPASSWORD: decodeURIComponent(u.password || '') }
    );
    mark('backup_before_migrate', true, dump);
    report.details.backup = dump;
  } catch (err) {
    mark('backup_before_migrate', false, err.message);
  }

  const rel = require('../lib/hub-customer-relational');
  report.details.before = await rel.counts();

  const mig = await rel.migrateFromBlobsAndBackfill({
    limit: Number(process.env.HUB_CUSTOMER_BACKFILL_LIMIT || 0),
  });
  report.details.migrate = mig.stats;
  mark('migrate_blobs_and_backfill', !!mig.ok, JSON.stringify(mig.stats?.after || {}));

  const integrity = await rel.verifyMigrationIntegrity();
  report.details.integrity = integrity;
  mark(
    'no_customer_without_portal_or_profile',
    !!integrity.ok,
    JSON.stringify(integrity.gaps || {})
  );

  // Blobs still present (rollback plan)
  const { withClient } = require('../db/migrate');
  const blobs = await withClient(async (c) => {
    const r = await c.query(
      `SELECT key, pg_column_size(value) AS bytes FROM hub_meta WHERE key = ANY($1::text[])`,
      [['client_portal_v1', 'profiles-360', 'client_attachments_v1']]
    );
    return r.rows;
  });
  report.details.legacyBlobsRetained = blobs;
  mark('legacy_blobs_retained_for_rollback', blobs.length >= 2, JSON.stringify(blobs));

  report.details.after = await rel.counts();
  report.verdict = report.FAIL.length === 0 ? 'PASS' : 'FAIL';
  fs.writeFileSync(path.join(ART, 'migrate-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.verdict === 'PASS' ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
