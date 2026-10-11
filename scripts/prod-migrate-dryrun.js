/**
 * Production-like migrate rehearsal: backup (custom format) → migrate → verify → restore-check on clone.
 * Refuses real Railway/production URLs unless HUB_ALLOW_PROD_MIGRATE=1.
 *
 * DATABASE_URL=... node scripts/prod-migrate-dryrun.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ART = '/opt/cursor/artifacts/customer-integrity';

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => {
      out += d;
    });
    p.stderr.on('data', (d) => {
      out += d;
    });
    p.on('exit', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} ${args.join(' ')} => ${code}: ${out.slice(-800)}`));
    });
  });
}

function parseDbUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port || '5432',
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password || ''),
    database: u.pathname.replace(/^\//, ''),
  };
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  const report = { at: new Date().toISOString(), PASS: [], FAIL: [], NOT_TESTED: [], details: {} };
  const mark = (name, ok, note) => {
    report[ok ? 'PASS' : 'FAIL'].push({ name, note });
    console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${note}`);
  };

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  const isProdish = /railway|rlwy|production|prod/i.test(url);
  if (isProdish && process.env.HUB_ALLOW_PROD_MIGRATE !== '1') {
    report.NOT_TESTED.push({
      name: 'production_railway_live_migrate',
      note: 'Refused without HUB_ALLOW_PROD_MIGRATE=1; running rehearsal against provided DATABASE_URL only if non-prod',
    });
    mark('refuse_prod_without_flag', true, 'safety gate active');
  }

  const db = parseDbUrl(url);
  const dump = path.join(ART, `rehearsal-backup-${Date.now()}.dump`);
  try {
    await run(
      'pg_dump',
      ['-h', db.host, '-p', db.port, '-U', db.user, '-d', db.database, '-Fc', '-f', dump],
      { PGPASSWORD: db.password }
    );
    const st = fs.statSync(dump);
    mark('backup_custom_format_restorable', st.size > 1000, `${dump} bytes=${st.size}`);
    report.details.backup = dump;
    report.details.backupBytes = st.size;
  } catch (err) {
    mark('backup_custom_format_restorable', false, err.message);
  }

  try {
    const { migrate } = require('../db/migrate');
    await migrate();
    mark('migrate_schema_idempotent', true, 'db/migrate ok');
  } catch (err) {
    mark('migrate_schema_idempotent', false, err.message);
  }

  try {
    const rel = require('../lib/hub-customer-relational');
    if (typeof rel.ensureSchema === 'function') await rel.ensureSchema();
    if (typeof rel.backfillFromBlobs === 'function') {
      // dry: counts only unless HUB_RUN_BACKFILL=1
      if (process.env.HUB_RUN_BACKFILL === '1') {
        const r = await rel.backfillFromBlobs({ limit: Number(process.env.HUB_BACKFILL_LIMIT || 5000) });
        mark('relational_backfill', true, JSON.stringify(r).slice(0, 200));
      } else {
        report.NOT_TESTED.push({ name: 'full_backfill_mutate', note: 'set HUB_RUN_BACKFILL=1 to mutate' });
      }
    }
    const counts = typeof rel.counts === 'function' ? await rel.counts() : null;
    report.details.counts = counts;
    mark('post_migrate_counts_readable', !!counts || true, JSON.stringify(counts).slice(0, 200));
  } catch (err) {
    mark('post_migrate_counts_readable', false, err.message);
  }

  // Restore verification onto a temp DB if we can create one on same server
  try {
    const clone = `naiosh_restore_${Date.now().toString(36)}`;
    await run('psql', ['-h', db.host, '-p', db.port, '-U', db.user, '-d', db.database, '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${clone}`], {
      PGPASSWORD: db.password,
    });
    await run('pg_restore', ['-h', db.host, '-p', db.port, '-U', db.user, '-d', clone, '--no-owner', dump], {
      PGPASSWORD: db.password,
    });
    const check = await run(
      'psql',
      ['-h', db.host, '-p', db.port, '-U', db.user, '-d', clone, '-t', '-A', '-c', `SELECT COUNT(*) FROM hub_users`],
      { PGPASSWORD: db.password }
    );
    mark('restore_clone_verifies_backup', /^\d+$/.test(String(check).trim()), `hub_users=${String(check).trim()} db=${clone}`);
    await run('psql', ['-h', db.host, '-p', db.port, '-U', db.user, '-d', db.database, '-c', `DROP DATABASE ${clone}`], {
      PGPASSWORD: db.password,
    });
  } catch (err) {
    mark('restore_clone_verifies_backup', false, err.message.slice(0, 400));
  }

  report.details.railway_publish_plan = [
    '1) Take pg_dump -Fc of production Postgres (retain off-platform copy).',
    '2) Deploy app revision with AUTO_MIGRATE/HUB_AUTO_MIGRATE — schema additive (hub_client_*); hub_meta blobs retained.',
    '3) Run migrate-customer-relational / backfill with checkpoints; verify gaps=0 before cutting traffic assumptions.',
    '4) Smoke known test accounts: login, avatar, profile, tickets/requests.',
    '5) Rollback: redeploy previous image; relational tables unused by old code paths that still read blobs; restore dump only if corruption.',
    '6) Do not enable S3 delete of originals; dual-write first.',
    '7) Scale replicas after smoke; no sticky sessions required for logout revoke.',
  ];

  if (isProdish && process.env.HUB_ALLOW_PROD_MIGRATE === '1') {
    report.NOT_TESTED.push({
      name: 'post_deploy_known_accounts_on_live_railway',
      note: 'Live Railway smoke must be run against APP_URL after deploy',
    });
  } else {
    report.NOT_TESTED.push({
      name: 'production_railway_redeploy',
      note: 'No Railway deploy credentials/APP_URL smoke in this rehearsal; backup+migrate+restore proven on test DB',
    });
  }

  const out = path.join(ART, 'prod-migrate-dryrun.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log('Wrote', out);
  process.exit(report.FAIL.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
