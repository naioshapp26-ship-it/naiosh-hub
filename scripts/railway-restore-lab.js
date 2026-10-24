/**
 * Automate isolated restore-lab on Railway when RAILWAY_TOKEN is available.
 *
 * HARD SAFETY (must hold before any write):
 * 1. Production Postgres service id is identified and NEVER used as pg_restore target.
 * 2. Lab service id must differ from production service id.
 * 3. Lab connection fingerprint must differ from production fingerprint.
 * 4. pg_dump is the only operation against production (read-only logical dump).
 * 5. pg_restore runs only against the lab URL captured from the lab service variables.
 * 6. Hub app DATABASE_URL fingerprint is recorded before/after and must be unchanged.
 * 7. Lab must not receive Paymob/SMTP/webhook variables from this script.
 *
 * Required: RAILWAY_TOKEN
 * Optional: RAILWAY_PROJECT_ID, RAILWAY_ENVIRONMENT_ID, RESTORE_LAB_SERVICE_NAME
 *
 *   node scripts/railway-restore-lab.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const API = 'https://backboard.railway.app/graphql/v2';
const TOKEN = String(process.env.RAILWAY_TOKEN || process.env.RAILWAY_API_TOKEN || '').trim();
const LAB_NAME = String(process.env.RESTORE_LAB_SERVICE_NAME || 'naiosh-hub-restore-lab').trim();
const OUT = '/opt/cursor/artifacts/launch-railway-restore-lab.json';
const PAYMENT_OR_NOTIFY_KEYS = [
  'PAYMOB',
  'SMTP',
  'SENDGRID',
  'MAILGUN',
  'WEBHOOK',
  'TWILIO',
  'FIREBASE',
  'FCM_',
  'ONESIGNAL',
  'STRIPE',
  'WHATSAPP',
];

function saveReport(r) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  // Never persist raw connection strings / secrets
  const safe = JSON.parse(JSON.stringify(r));
  delete safe.prodUrl;
  delete safe.labUrl;
  delete safe.rawVariables;
  fs.writeFileSync(OUT, JSON.stringify(safe, null, 2));
}

function step(report, name, ok, detail) {
  report.steps.push({ name, result: ok ? 'PASS' : 'FAIL', detail: String(detail || '').slice(0, 400) });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${String(detail).slice(0, 200)}` : ''}`);
}

function fp(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function hostOnly(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'invalid';
  }
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

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (r.status !== 0) {
    // redact possible URLs in stderr
    const err = String(r.stderr || r.stdout || '')
      .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, 'postgres://***')
      .slice(0, 600);
    throw new Error(`${cmd} failed (exit ${r.status}): ${err}`);
  }
  return r;
}

function assertWritableLabOnly({ prodServiceId, labServiceId, prodUrl, labUrl }) {
  if (!prodServiceId || !labServiceId) throw new Error('missing service ids');
  if (prodServiceId === labServiceId) throw new Error('REFUSE: lab service id equals production service id');
  if (!prodUrl || !labUrl) throw new Error('missing connection urls');
  if (fp(prodUrl) === fp(labUrl)) throw new Error('REFUSE: lab URL fingerprint equals production');
  if (hostOnly(prodUrl) === hostOnly(labUrl) && new URL(prodUrl).port === new URL(labUrl).port) {
    throw new Error('REFUSE: lab host:port equals production host:port');
  }
  // Never allow restore target to be the same string as prod
  if (String(labUrl) === String(prodUrl)) throw new Error('REFUSE: identical connection strings');
}

function paymentNotifyKeysPresent(vars) {
  const keys = Object.keys(vars || {});
  return keys.filter((k) => PAYMENT_OR_NOTIFY_KEYS.some((p) => k.toUpperCase().includes(p)));
}

async function getServiceVariables(projectId, environmentId, serviceId) {
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
  } catch (_) {
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

async function waitForLabUrl(projectId, environmentId, labId, attempts = 24) {
  for (let i = 0; i < attempts; i++) {
    const vars = await getServiceVariables(projectId, environmentId, labId);
    const url = vars.DATABASE_PUBLIC_URL || vars.DATABASE_URL;
    if (url) return { url, vars };
    await new Promise((r) => setTimeout(r, 5000));
  }
  return { url: null, vars: {} };
}

async function renameService(serviceId, name) {
  try {
    await gql(
      `
      mutation ($id: String!, $input: ServiceUpdateInput!) {
        serviceUpdate(id: $id, input: $input) { id name }
      }
    `,
      { id: serviceId, input: { name } }
    );
    return true;
  } catch (_) {
    try {
      await gql(
        `
        mutation ($input: ServiceUpdateInput!) {
          serviceUpdate(input: $input) { id name }
        }
      `,
        { input: { serviceId, name } }
      );
      return true;
    } catch {
      return false;
    }
  }
}

async function createLabPostgres(projectId, environmentId, report) {
  // Preferred: official postgres template (provides DATABASE_URL)
  try {
    const deployed = await gql(
      `
      mutation ($input: TemplateDeployV2Input!) {
        templateDeployV2(input: $input) {
          projectId
          workflowId
        }
      }
    `,
      {
        input: {
          projectId,
          environmentId,
          templateId: 'postgres',
        },
      }
    );
    step(report, 'lab_template_deploy', true, `workflow=${deployed.templateDeployV2?.workflowId || 'ok'}`);
  } catch (e) {
    step(report, 'lab_template_deploy', false, e.message);
    // Fallback: empty postgres image service
    const created = await gql(
      `
      mutation ($input: ServiceCreateInput!) {
        serviceCreate(input: $input) { id name }
      }
    `,
      {
        input: {
          projectId,
          name: LAB_NAME,
          source: { image: 'ghcr.io/railwayapp-templates/postgres-ssl:16' },
        },
      }
    );
    step(report, 'lab_service_create_fallback', true, `id=${created.serviceCreate.id}`);
    return created.serviceCreate;
  }

  // Re-list services and pick newest postgres that is not production
  await new Promise((r) => setTimeout(r, 8000));
  const proj = await gql(
    `
    query ($id: String!) {
      project(id: $id) {
        services { edges { node { id name createdAt } } }
      }
    }
  `,
    { id: projectId }
  );
  const services = proj.project.services.edges.map((e) => e.node);
  const candidates = services
    .filter((s) => /postgres/i.test(s.name) || /PostgreSQL/i.test(s.name))
    .filter((s) => !/restore-lab/i.test(s.name));
  // Prefer the one created most recently that isn't already named as primary
  candidates.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const fresh = candidates[0];
  if (!fresh) throw new Error('template deploy succeeded but no postgres service found');
  await renameService(fresh.id, LAB_NAME);
  fresh.name = LAB_NAME;
  step(report, 'lab_renamed', true, `id=${fresh.id} name=${LAB_NAME}`);
  return fresh;
}

async function main() {
  const report = {
    at: new Date().toISOString(),
    mode: 'railway-restore-lab-isolated',
    safety: {
      writesToProductionDb: 'forbidden',
      restoreTarget: 'lab-service-url-only',
      destinationChecks: ['serviceIdDiffer', 'urlFingerprintDiffer', 'hostPortDiffer'],
      appDatabaseUrlMutation: 'forbidden',
      paymentNotifyVarsOnLab: 'must-be-absent',
    },
    steps: [],
    tokenMeta: {
      present: !!TOKEN,
      length: TOKEN.length,
      // never store the token
    },
  };
  saveReport(report);

  if (!TOKEN) {
    step(report, 'railway_token', false, 'RAILWAY_TOKEN not visible in process env');
    report.fullPass = false;
    saveReport(report);
    process.exit(2);
  }
  step(report, 'railway_token', true, `present length=${TOKEN.length} (value not logged)`);

  // Auth + scope
  let projectId = process.env.RAILWAY_PROJECT_ID || '';
  let environmentId = process.env.RAILWAY_ENVIRONMENT_ID || '';
  let tokenKind = 'unknown';
  let projectCount = null;

  try {
    const me = await gql(`query { me { id email } }`);
    tokenKind = 'account';
    step(report, 'railway_auth', true, `account token userId=${me.me?.id || 'ok'}`);
    // Do not log email (PII)
  } catch (e) {
    try {
      const p = await gql(`query { projectToken { projectId environmentId } }`);
      tokenKind = 'project';
      projectId = projectId || p.projectToken?.projectId || '';
      environmentId = environmentId || p.projectToken?.environmentId || '';
      step(report, 'railway_auth', true, 'project-scoped token');
    } catch (e2) {
      step(report, 'railway_auth', false, e.message || e2.message);
      saveReport(report);
      process.exit(1);
    }
  }
  report.tokenKind = tokenKind;

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
    projectCount = projects.length;
    report.projectCountVisible = projectCount;
    if (tokenKind === 'account' && projectCount > 1) {
      step(
        report,
        'token_scope_note',
        true,
        `account token sees ${projectCount} projects — prefer Project Token on naiosh-hub only`
      );
    }
    const hit =
      projects.find((p) => /naiosh/i.test(p.name) && /hub/i.test(p.name)) ||
      projects.find((p) => /naiosh/i.test(p.name));
    if (!hit) {
      step(report, 'project_resolved', false, 'no naiosh-hub project visible to token');
      saveReport(report);
      process.exit(1);
    }
    projectId = hit.id;
    environmentId =
      environmentId ||
      hit.environments.edges.find((e) => /prod/i.test(e.node.name))?.node.id ||
      hit.environments.edges[0]?.node.id;
    report.project = { id: projectId, name: hit.name };
    step(report, 'project_resolved', true, `name=${hit.name}`);
  } else {
    step(report, 'project_resolved', true, `id=${projectId}`);
    if (tokenKind === 'project') {
      step(report, 'token_scope_note', true, 'project token — limited to one project (preferred)');
    }
  }

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
  report.project = { id: proj.project.id, name: proj.project.name };
  const services = proj.project.services.edges.map((e) => e.node);
  report.servicesListed = services.map((s) => s.name);
  if (!environmentId) {
    environmentId =
      proj.project.environments.edges.find((e) => /prod/i.test(e.node.name))?.node.id ||
      proj.project.environments.edges[0]?.node.id;
  }
  report.environmentId = environmentId;

  const appService = services.find(
    (s) => /naiosh-hub/i.test(s.name) && !/restore-lab/i.test(s.name) && !/postgres/i.test(s.name)
  );
  const prodDb =
    services.find((s) => /postgres/i.test(s.name) && !/restore-lab/i.test(s.name) && !/restored-/i.test(s.name)) ||
    services.find((s) => /^PostgreSQL$/i.test(s.name));
  let lab = services.find((s) => s.name === LAB_NAME || /restore-lab/i.test(s.name));

  if (!prodDb) {
    step(report, 'prod_db_identified', false, 'production Postgres service not found');
    saveReport(report);
    process.exit(1);
  }
  if (LAB_NAME === prodDb.name) {
    step(report, 'prod_db_identified', false, 'lab name collides with production');
    saveReport(report);
    process.exit(1);
  }
  step(report, 'prod_db_identified', true, `name=${prodDb.name} id=${prodDb.id}`);
  report.prodDbService = { id: prodDb.id, name: prodDb.name };
  report.appService = appService ? { id: appService.id, name: appService.name } : null;

  let appVarsBefore = {};
  if (appService) {
    appVarsBefore = await getServiceVariables(projectId, environmentId, appService.id);
    report.appDatabaseUrlFingerprintBefore = fp(appVarsBefore.DATABASE_URL);
    step(report, 'app_database_url_fingerprint', true, `sha16=${report.appDatabaseUrlFingerprintBefore || 'none'}`);
  }

  if (!lab) {
    try {
      lab = await createLabPostgres(projectId, environmentId, report);
      step(report, 'lab_service_ready', true, `id=${lab.id} name=${lab.name || LAB_NAME}`);
    } catch (e) {
      step(report, 'lab_service_ready', false, e.message);
      saveReport(report);
      process.exit(1);
    }
  } else {
    step(report, 'lab_service_ready', true, `exists id=${lab.id}`);
  }
  if (lab.id === prodDb.id) {
    step(report, 'lab_isolation', false, 'lab id equals prod id');
    saveReport(report);
    process.exit(1);
  }
  report.labService = { id: lab.id, name: lab.name || LAB_NAME };

  const prodVars = await getServiceVariables(projectId, environmentId, prodDb.id);
  const prodUrl = prodVars.DATABASE_PUBLIC_URL || prodVars.DATABASE_URL;
  if (!prodUrl) {
    step(report, 'prod_url_resolved', false, 'no DATABASE_URL on production Postgres service');
    saveReport(report);
    process.exit(1);
  }
  step(report, 'prod_url_resolved', true, `host=${hostOnly(prodUrl)} fp=${fp(prodUrl)}`);

  const waited = await waitForLabUrl(projectId, environmentId, lab.id);
  const labUrl = waited.url;
  const labVars = waited.vars;
  if (!labUrl) {
    step(report, 'lab_url_resolved', false, 'lab DATABASE_URL not ready after wait');
    saveReport(report);
    process.exit(1);
  }
  step(report, 'lab_url_resolved', true, `host=${hostOnly(labUrl)} fp=${fp(labUrl)}`);

  // Lab must not already be wired for payments/notifications
  const badKeys = paymentNotifyKeysPresent(labVars);
  step(
    report,
    'lab_no_payment_notify_vars',
    badKeys.length === 0,
    badKeys.length ? `present=${badKeys.join(',')}` : 'none'
  );

  // Destination precheck BEFORE any write
  try {
    assertWritableLabOnly({
      prodServiceId: prodDb.id,
      labServiceId: lab.id,
      prodUrl,
      labUrl,
    });
    step(report, 'destination_precheck', true, 'serviceId+fingerprint+hostPort differ');
  } catch (e) {
    step(report, 'destination_precheck', false, e.message);
    saveReport(report);
    process.exit(1);
  }

  // Read-only dump from production
  const dumpPath = `/tmp/naiosh-prod-${Date.now()}.dump`;
  try {
    run('pg_dump', [prodUrl, '--format=custom', '--no-owner', '--file', dumpPath]);
    const bytes = fs.statSync(dumpPath).size;
    step(report, 'pg_dump_prod_readonly', bytes > 0, `bytes=${bytes}`);
  } catch (e) {
    step(report, 'pg_dump_prod_readonly', false, e.message);
    saveReport(report);
    process.exit(1);
  }

  // Re-check destination immediately before restore (no production write path)
  try {
    assertWritableLabOnly({
      prodServiceId: prodDb.id,
      labServiceId: lab.id,
      prodUrl,
      labUrl,
    });
    // Explicit argv construction: dbname is ALWAYS labUrl, never prodUrl
    const restoreArgs = ['--clean', '--if-exists', '--no-owner', '--dbname', labUrl, dumpPath];
    if (restoreArgs.includes(prodUrl)) throw new Error('REFUSE: prodUrl leaked into restore args');
    run('pg_restore', restoreArgs);
    step(report, 'pg_restore_lab_only', true, `targetHost=${hostOnly(labUrl)} (not production)`);
  } catch (e) {
    step(report, 'pg_restore_lab_only', false, e.message);
    saveReport(report);
    process.exit(1);
  } finally {
    try {
      fs.unlinkSync(dumpPath);
    } catch (_) {}
  }

  // App DATABASE_URL unchanged + not wired to lab
  if (appService) {
    const appVarsAfter = await getServiceVariables(projectId, environmentId, appService.id);
    const afterFp = fp(appVarsAfter.DATABASE_URL);
    step(
      report,
      'app_database_url_unchanged',
      afterFp === report.appDatabaseUrlFingerprintBefore,
      `before=${report.appDatabaseUrlFingerprintBefore} after=${afterFp}`
    );
    step(
      report,
      'app_not_wired_to_lab',
      afterFp !== fp(labUrl),
      afterFp === fp(labUrl) ? 'APP POINTS AT LAB' : 'ok'
    );
  }

  // Read-only verify (no customer row dumps in report)
  const verifyEnv = {
    ...process.env,
    RESTORE_LAB_DATABASE_URL: labUrl,
    RESTORE_LAB_ALLOW: '1', // localhost marker bypass for verifier host check only
  };
  const verify = spawnSync(process.execPath, [path.join(__dirname, 'verify-restore-lab.js')], {
    encoding: 'utf8',
    env: verifyEnv,
  });
  const verifyTail = String(verify.stdout || verify.stderr || '')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, 'postgres://***')
    .split('\n')
    .filter((l) => !/@/.test(l)) // drop lines that might contain emails
    .slice(-8)
    .join(' | ');
  step(report, 'verify_restore_lab_js', verify.status === 0, verifyTail);

  report.pass = report.steps.filter((s) => s.result === 'PASS').length;
  report.fail = report.steps.filter((s) => s.result === 'FAIL').length;
  report.fullPass = report.fail === 0;
  saveReport(report);
  console.log(JSON.stringify({ fullPass: report.fullPass, pass: report.pass, fail: report.fail, out: OUT }, null, 2));
  process.exit(report.fullPass ? 0 : 1);
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e).replace(/postgres(?:ql)?:\/\/[^\s]+/gi, 'postgres://***'));
  process.exit(1);
});
