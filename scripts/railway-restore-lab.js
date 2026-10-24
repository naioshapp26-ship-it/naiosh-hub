/**
 * Automate isolated restore-lab on Railway when RAILWAY_TOKEN is available.
 *
 * Safety hard-stops:
 * - Never restores onto a service whose name matches production postgres.
 * - Never mutates the Hub app DATABASE_URL.
 * - Destination URL must contain "restore-lab" before any write (pg_restore).
 * - Source dump is read-only (pg_dump).
 * - Does not wire Paymob/SMTP/webhooks onto the lab service.
 *
 * Required env:
 *   RAILWAY_TOKEN          — Account or project token with deploy scope
 * Optional:
 *   RAILWAY_PROJECT_ID     — otherwise first matching naiosh project is used
 *   RAILWAY_ENVIRONMENT_ID — defaults to production environment in project
 *   RESTORE_LAB_SERVICE_NAME — default naiosh-hub-restore-lab
 *   SKIP_CREATE=1          — only dump/restore if lab already exists
 *
 *   node scripts/railway-restore-lab.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const API = 'https://backboard.railway.app/graphql/v2';
const TOKEN = String(process.env.RAILWAY_TOKEN || process.env.RAILWAY_API_TOKEN || '').trim();
const LAB_NAME = String(process.env.RESTORE_LAB_SERVICE_NAME || 'naiosh-hub-restore-lab').trim();
const OUT = '/opt/cursor/artifacts/launch-railway-restore-lab.json';

const PROD_NAME_BLOCKLIST = [
  /^postgres$/i,
  /naiosh-hub-postgres/i,
  /production-db/i,
  /^PostgreSQL$/i,
];

function die(msg, code = 1) {
  const report = loadReport();
  report.error = msg;
  report.fullPass = false;
  saveReport(report);
  console.error(msg);
  process.exit(code);
}

function loadReport() {
  try {
    return JSON.parse(fs.readFileSync(OUT, 'utf8'));
  } catch {
    return { at: new Date().toISOString(), steps: [] };
  }
}

function saveReport(r) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(r, null, 2));
}

function step(report, name, ok, detail) {
  report.steps.push({ name, result: ok ? 'PASS' : 'FAIL', detail: String(detail || '') });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function gql(query, variables = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors?.length) {
    const msg = json.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json.data;
}

function looksProdDbName(name) {
  const n = String(name || '');
  if (/restore-lab/i.test(n)) return false;
  return PROD_NAME_BLOCKLIST.some((re) => re.test(n)) || (/postgres/i.test(n) && /prod/i.test(n));
}

function assertLabUrl(url, label) {
  if (!url) throw new Error(`${label} missing`);
  const u = new URL(url);
  const blob = url.toLowerCase();
  if (!blob.includes('restore-lab') && process.env.RESTORE_LAB_ALLOW !== '1') {
    throw new Error(`${label} refused: must contain restore-lab marker (got host=${u.hostname})`);
  }
  return u;
}

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed: ${(r.stderr || r.stdout || '').slice(0, 500)}`);
  }
  return r;
}

async function main() {
  const report = {
    at: new Date().toISOString(),
    mode: 'railway-restore-lab-isolated',
    safety: {
      neverRestoreOntoProduction: true,
      neverMutateAppDatabaseUrl: true,
      destinationCheckedBeforeWrite: true,
      notificationsWired: false,
      paymentsWired: false,
    },
    steps: [],
  };
  saveReport(report);

  if (!TOKEN) {
    step(report, 'railway_token', false, 'RAILWAY_TOKEN missing — cannot create/restore lab');
    saveReport(report);
    process.exit(2);
  }
  step(report, 'railway_token', true, 'present (value not logged)');

  let me;
  try {
    me = await gql(`query { me { id email name } }`);
    step(report, 'railway_auth', true, `user=${me.me?.email || me.me?.id || 'ok'}`);
  } catch (e) {
    // Project tokens may not support me {}
    try {
      const p = await gql(`query { projectToken { projectId environmentId } }`);
      step(report, 'railway_auth', true, `projectToken env=${p.projectToken?.environmentId}`);
      report.projectToken = p.projectToken;
    } catch (e2) {
      step(report, 'railway_auth', false, e.message || e2.message);
      saveReport(report);
      process.exit(1);
    }
  }

  // Resolve project
  let projectId = process.env.RAILWAY_PROJECT_ID || report.projectToken?.projectId;
  let environmentId = process.env.RAILWAY_ENVIRONMENT_ID || report.projectToken?.environmentId;

  if (!projectId) {
    const data = await gql(`
      query {
        projects {
          edges {
            node {
              id
              name
              environments { edges { node { id name } } }
              services { edges { node { id name } } }
            }
          }
        }
      }
    `);
    const projects = data.projects.edges.map((e) => e.node);
    const hit =
      projects.find((p) => /naiosh/i.test(p.name) && /hub/i.test(p.name)) ||
      projects.find((p) => /naiosh/i.test(p.name)) ||
      projects[0];
    if (!hit) die('No Railway project found for this token');
    projectId = hit.id;
    environmentId =
      environmentId ||
      hit.environments.edges.find((e) => /prod/i.test(e.node.name))?.node.id ||
      hit.environments.edges[0]?.node.id;
    report.project = { id: projectId, name: hit.name };
    report.servicesListed = hit.services.edges.map((e) => e.node.name);
    step(report, 'project_resolved', true, `name=${hit.name}`);
  } else {
    step(report, 'project_resolved', true, `id=${projectId}`);
  }

  // Fetch detailed project
  const proj = await gql(
    `
    query ($id: String!) {
      project(id: $id) {
        id
        name
        environments { edges { node { id name } } }
        services { edges { node { id name } } }
      }
    }
  `,
    { id: projectId }
  );
  const services = proj.project.services.edges.map((e) => e.node);
  report.servicesListed = services.map((s) => s.name);
  if (!environmentId) {
    environmentId =
      proj.project.environments.edges.find((e) => /prod/i.test(e.node.name))?.node.id ||
      proj.project.environments.edges[0]?.node.id;
  }
  report.environmentId = environmentId;

  const appService = services.find((s) => /naiosh-hub/i.test(s.name) && !/restore-lab/i.test(s.name) && !/postgres/i.test(s.name));
  const prodDb =
    services.find((s) => /postgres/i.test(s.name) && !/restore-lab/i.test(s.name) && !/restored/i.test(s.name)) ||
    services.find((s) => /^PostgreSQL$/i.test(s.name));
  let lab = services.find((s) => s.name === LAB_NAME || /restore-lab/i.test(s.name));

  if (!prodDb) {
    step(report, 'prod_db_identified', false, 'could not find production Postgres service');
    saveReport(report);
    process.exit(1);
  }
  if (looksProdDbName(LAB_NAME) || LAB_NAME === prodDb.name) {
    die('Refuse: lab name collides with production DB service');
  }
  step(report, 'prod_db_identified', true, `name=${prodDb.name} id=${prodDb.id}`);
  report.prodDbService = { id: prodDb.id, name: prodDb.name };
  report.appService = appService ? { id: appService.id, name: appService.name } : null;

  // Railway variables query variants differ by token type
  async function getServiceVariables(serviceId) {
    try {
      const data = await gql(
        `
        query ($projectId: String!, $environmentId: String!, $serviceId: String!) {
          variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
        }
      `,
        { projectId, environmentId, serviceId }
      );
      return data.variables || {};
    } catch (e) {
      // older shape
      const data = await gql(
        `
        query ($projectId: String!, $environmentId: String!) {
          variables(projectId: $projectId, environmentId: $environmentId)
        }
      `,
        { projectId, environmentId }
      );
      return data.variables || {};
    }
  }

  const crypto = require('crypto');
  function fp(url) {
    if (!url) return null;
    return crypto.createHash('sha256').update(String(url)).digest('hex').slice(0, 16);
  }

  let appVarsBefore = {};
  if (appService) {
    appVarsBefore = await getServiceVariables(appService.id);
    report.appDatabaseUrlFingerprintBefore = fp(appVarsBefore.DATABASE_URL);
    step(report, 'app_database_url_fingerprint', true, `sha16=${report.appDatabaseUrlFingerprintBefore || 'none'}`);
  }

  // Create lab postgres if missing
  if (!lab && process.env.SKIP_CREATE !== '1') {
    try {
      // Prefer template-based postgres
      const created = await gql(
        `
        mutation ($input: ServiceCreateInput!) {
          serviceCreate(input: $input) {
            id
            name
          }
        }
      `,
        {
          input: {
            projectId,
            name: LAB_NAME,
            source: { image: 'postgres:16' },
          },
        }
      );
      lab = created.serviceCreate;
      step(report, 'lab_service_create', true, `id=${lab.id} name=${lab.name}`);

      // Set basic postgres env (Railway official plugin is better; image needs POSTGRES_PASSWORD)
      const pwd = crypto.randomBytes(24).toString('hex');
      try {
        await gql(
          `
          mutation ($input: VariableCollectionUpsertInput!) {
            variableCollectionUpsert(input: $input)
          }
        `,
          {
            input: {
              projectId,
              environmentId,
              serviceId: lab.id,
              variables: {
                POSTGRES_PASSWORD: pwd,
                POSTGRES_USER: 'postgres',
                POSTGRES_DB: 'railway',
              },
            },
          }
        );
        step(report, 'lab_env_seed', true, 'POSTGRES_* set (values not logged)');
      } catch (e) {
        step(report, 'lab_env_seed', false, e.message);
      }
    } catch (e) {
      step(report, 'lab_service_create', false, e.message);
      saveReport(report);
      console.error(`
Cannot create Postgres via API with this token/mutation.
Required permission: Railway token that can create services in the naiosh-hub project
(Account token from https://railway.app/account/tokens with permission on the project,
 or Project token with deploy scope).
`);
      process.exit(1);
    }
  } else if (!lab) {
    step(report, 'lab_service_create', false, 'lab missing and SKIP_CREATE=1');
    saveReport(report);
    process.exit(1);
  } else {
    step(report, 'lab_service_create', true, `exists id=${lab.id}`);
  }
  report.labService = { id: lab.id, name: lab.name };

  // Wait / fetch URLs
  const prodVars = await getServiceVariables(prodDb.id);
  const labVars = await getServiceVariables(lab.id);
  const prodUrl = prodVars.DATABASE_PUBLIC_URL || prodVars.DATABASE_URL;
  const labUrl = labVars.DATABASE_PUBLIC_URL || labVars.DATABASE_URL;

  if (!prodUrl) {
    step(report, 'prod_url_resolved', false, 'no DATABASE_URL/PUBLIC on prod db service');
    saveReport(report);
    process.exit(1);
  }
  step(report, 'prod_url_resolved', true, `fp=${fp(prodUrl)} (value not logged)`);

  if (!labUrl) {
    step(
      report,
      'lab_url_resolved',
      false,
      'Lab has no DATABASE_URL yet. Prefer creating via Railway Postgres plugin (New → Database → PostgreSQL) named naiosh-hub-restore-lab, then re-run with RAILWAY_TOKEN.'
    );
    saveReport(report);
    process.exit(1);
  }

  // Destination check BEFORE any write
  try {
    assertLabUrl(labUrl, 'lab DATABASE_URL');
    if (fp(labUrl) === fp(prodUrl)) throw new Error('lab URL fingerprint equals production — abort');
    step(report, 'destination_precheck', true, `labFp=${fp(labUrl)} != prodFp=${fp(prodUrl)}`);
  } catch (e) {
    step(report, 'destination_precheck', false, e.message);
    saveReport(report);
    process.exit(1);
  }

  // Logical backup (read-only) + restore to lab only
  const dumpPath = `/tmp/naiosh-prod-${Date.now()}.dump`;
  try {
    run('pg_dump', [prodUrl, '--format=custom', '--no-owner', '--file', dumpPath]);
    step(report, 'pg_dump_prod_readonly', true, `bytes=${fs.statSync(dumpPath).size}`);
  } catch (e) {
    step(report, 'pg_dump_prod_readonly', false, e.message);
    saveReport(report);
    process.exit(1);
  }

  // Re-assert destination immediately before restore
  try {
    assertLabUrl(labUrl, 'lab DATABASE_URL');
    run('pg_restore', ['--clean', '--if-exists', '--no-owner', '--dbname', labUrl, dumpPath]);
    step(report, 'pg_restore_lab_only', true, 'restored into restore-lab');
  } catch (e) {
    step(report, 'pg_restore_lab_only', false, e.message);
    saveReport(report);
    process.exit(1);
  } finally {
    try {
      fs.unlinkSync(dumpPath);
    } catch (_) {}
  }

  // Verify app DATABASE_URL unchanged
  if (appService) {
    const appVarsAfter = await getServiceVariables(appService.id);
    const afterFp = fp(appVarsAfter.DATABASE_URL);
    const ok = afterFp === report.appDatabaseUrlFingerprintBefore;
    step(report, 'app_database_url_unchanged', ok, `before=${report.appDatabaseUrlFingerprintBefore} after=${afterFp}`);
    // Ensure app does not reference lab
    const wiredToLab =
      String(appVarsAfter.DATABASE_URL || '').toLowerCase().includes('restore-lab') ||
      afterFp === fp(labUrl);
    step(report, 'app_not_wired_to_lab', !wiredToLab, wiredToLab ? 'APP POINTS AT LAB — investigate' : 'ok');
  }

  // Run read-only verifier
  process.env.RESTORE_LAB_DATABASE_URL = labUrl;
  process.env.RESTORE_LAB_ALLOW = '1';
  const verify = spawnSync(process.execPath, [path.join(__dirname, 'verify-restore-lab.js')], {
    encoding: 'utf8',
    env: process.env,
  });
  step(report, 'verify_restore_lab_js', verify.status === 0, (verify.stdout || verify.stderr || '').split('\n').slice(-6).join(' | '));

  report.pass = report.steps.filter((s) => s.result === 'PASS').length;
  report.fail = report.steps.filter((s) => s.result === 'FAIL').length;
  report.fullPass = report.fail === 0;
  saveReport(report);
  console.log(JSON.stringify({ fullPass: report.fullPass, pass: report.pass, fail: report.fail, out: OUT }, null, 2));
  process.exit(report.fullPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
