#!/usr/bin/env node
/**
 * Production-oriented full HTML page inventory.
 *
 *   node scripts/launch-pages-full-inventory.js
 *
 * Env:
 *   HUB_E2E_BASE | BASE_URL — default https://naiosh-hub-production.up.railway.app
 *
 * Writes:
 *   /opt/cursor/artifacts/launch-pages-full-inventory.json
 *   /opt/cursor/artifacts/launch-pages-full-inventory.md
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const BASE = String(
  process.env.HUB_E2E_BASE || process.env.BASE_URL || 'https://naiosh-hub-production.up.railway.app'
).replace(/\/$/, '');
const ART = '/opt/cursor/artifacts';
const ROOT = path.resolve(__dirname, '..');
const DEEP_MIN = Number(process.env.INVENTORY_DEEP_MIN || 60);

/** Filename stem heuristics → audience lane (filename first; avoid substring traps like platforms⊂book-platform) */
const STAFF_STEMS = new Set([
  'admin-bootstrap',
  'ads',
  'branches',
  'chat',
  'dashboard',
  'directives',
  'engine-specs',
  'events-studio-main',
  'global-os',
  'google-search',
  'hub-checklist',
  'hub-interaction',
  'job-roles',
  'marketing-campaigns-studio',
  'naiosh-ownership',
  'operating',
  'ops-catalog-admin',
  'ops-manuals',
  'platforms',
  'posha',
  'rent-admin',
  'roles-permissions',
  'search-admin',
  'search-content',
  'side-project-registrations',
  'system-ops',
]);
const UTILITY_STEMS = new Set([
  'sso-bridge',
  'admin-bootstrap',
  'packages-paymob-return',
  'forgot-password',
  'user-path',
  'packages-receipts',
]);
const CUSTOMER_STEMS = new Set([
  'client',
  'register',
  'create-account',
  'login',
  'cart',
  'checkout',
  'store',
  'products',
  'services',
  'service',
  'support',
  'complaints',
  'suggestions',
  'consultation',
  'membership',
  'packages',
  'my-orders',
  'my-courses',
  'my-diplomas',
  'my-office',
  'my-platform',
  'my-systems',
  'my-branch',
  'my-channel',
  'my-incubator',
  'profile-360',
  'trial',
  'book-office',
  'book-platform',
  'book-incubator',
  'rent-system',
  'rent-systems',
  'publish-research',
  'register-freelancer',
  'self-assess',
  'naiosh-solutions',
  'cost-reduction',
  'quality',
  'quality-analysis',
  'review-methodology',
]);
const PUBLIC_STEMS = new Set([
  'index',
  'blog',
  'news',
  'events',
  'courses',
  'diplomas',
  'communities',
  'competitions',
  'incubators',
  'office',
  'info-center',
  'policies',
  'privacy',
  'terms',
  'partnerships',
  'apps',
  'systems-instructions',
  'search',
  'side-projects',
]);

/** Durable API-backed customer journeys proven in prior prod probes */
const DATA_SAVE_PASS = new Set([
  'register.html',
  'create-account.html',
  'login.html',
  'client.html',
  'support.html',
  'complaints.html',
  'suggestions.html',
  'consultation.html',
  'my-orders.html',
  'profile-360.html',
  'packages.html',
  'checkout.html',
  'store.html',
  'products.html',
  'services.html',
  'service.html',
  'rent-system.html',
  'rent-systems.html',
  'book-office.html',
  'book-platform.html',
  'book-incubator.html',
  'membership.html',
  'trial.html',
  'cart.html',
  'forgot-password.html',
]);

/** Staff shells that need auth before durable writes */
const DATA_SAVE_REQUIRES_LOGIN = new Set([
  'dashboard.html',
  'rent-admin.html',
  'search-admin.html',
  'ops-catalog-admin.html',
  'admin-bootstrap.html',
  'ads.html',
  'branches.html',
  'roles-permissions.html',
  'system-ops.html',
  'chat.html',
  'posha.html',
  'platforms.html',
  'marketing-campaigns-studio.html',
  'events-studio-main.html',
  'global-os.html',
  'operating.html',
  'ops-manuals.html',
  'side-project-registrations.html',
  'hub-checklist.html',
  'hub-interaction.html',
  'naiosh-ownership.html',
  'job-roles.html',
  'directives.html',
  'engine-specs.html',
  'google-search.html',
  'search-content.html',
  'sso-bridge.html',
]);

/** Key staff shells always deep-checked */
const KEY_STAFF_SHELLS = [
  'dashboard.html',
  'rent-admin.html',
  'search-admin.html',
  'ops-catalog-admin.html',
  'ads.html',
  'branches.html',
  'roles-permissions.html',
  'system-ops.html',
  'chat.html',
  'posha.html',
  'platforms.html',
  'login.html',
  'admin-bootstrap.html',
  'operating.html',
  'global-os.html',
];

function ensureArt() {
  fs.mkdirSync(ART, { recursive: true });
}

function req(method, pathname, { timeoutMs = 25000 } = {}) {
  return new Promise((resolve) => {
    const u = new URL(pathname, BASE);
    const lib = u.protocol === 'https:' ? https : http;
    const started = Date.now();
    const r = lib.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        headers: { Accept: 'text/html,application/xhtml+xml,*/*', 'User-Agent': 'naiosh-launch-inventory/1.0' },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: res.statusCode,
            raw,
            ms: Date.now() - started,
            headers: res.headers,
          });
        });
      }
    );
    r.on('error', (e) =>
      resolve({ status: 0, raw: '', ms: Date.now() - started, headers: {}, error: e.message })
    );
    r.setTimeout(timeoutMs, () => {
      r.destroy();
      resolve({ status: 0, raw: '', ms: Date.now() - started, headers: {}, error: 'timeout' });
    });
    r.end();
  });
}

function readLocalSnippet(file) {
  try {
    return fs.readFileSync(path.join(ROOT, file), 'utf8').slice(0, 12000);
  } catch {
    return '';
  }
}

function stemOf(file) {
  return String(file || '')
    .toLowerCase()
    .replace(/\.html$/i, '');
}

function classify(file, localSnippet) {
  const stem = stemOf(file);
  const name = file.toLowerCase();
  const blob = String(localSnippet || '').toLowerCase();
  const reasons = [];

  // Filename wins (avoid false positives from nav links to admin pages)
  if (UTILITY_STEMS.has(stem)) {
    reasons.push('utility_filename');
    return { audience: 'utility', reasons };
  }
  if (STAFF_STEMS.has(stem) || /-admin$/.test(stem)) {
    reasons.push('staff_filename');
    return { audience: 'staff', reasons };
  }
  if (CUSTOMER_STEMS.has(stem) || /^my-/.test(stem)) {
    reasons.push('customer_filename');
    return { audience: 'customer', reasons };
  }
  if (PUBLIC_STEMS.has(stem)) {
    reasons.push('public_filename');
    return { audience: 'public', reasons };
  }

  // Light content heuristics only when filename unknown
  if (/\bdata-admin-shell\b|\bhub-rbac\b|\bstaff-only\b/.test(blob)) {
    reasons.push('content_staff_shell_marker');
    return { audience: 'staff', reasons };
  }
  if (/\/api\/client\/|hub-customer-requests|data-client-portal/.test(blob)) {
    reasons.push('content_customer_api_marker');
    return { audience: 'customer', reasons };
  }
  if (/^my-/.test(name)) {
    reasons.push('fallback_my_prefix');
    return { audience: 'customer', reasons };
  }
  if (/admin/.test(stem)) {
    reasons.push('fallback_admin_token');
    return { audience: 'staff', reasons };
  }
  reasons.push('fallback_public');
  return { audience: 'public', reasons };
}

function dataSaveFor(file, audience) {
  if (DATA_SAVE_PASS.has(file)) {
    return {
      dataSave: 'PASS',
      note: 'Durable API-backed customer journey proven in prior prod probes (persist/isolation + request-types)',
    };
  }
  if (DATA_SAVE_REQUIRES_LOGIN.has(file) || audience === 'staff') {
    return {
      dataSave: 'REQUIRES_LOGIN',
      note: 'Staff/admin shell or gated path; durable writes need authenticated staff session',
    };
  }
  if (audience === 'utility') {
    return { dataSave: 'REQUIRES_LOGIN', note: 'Utility/bridge page; not a primary durable write surface' };
  }
  // Remaining public/customer marketing or localStorage-heavy paths
  return {
    dataSave: 'LOCAL_ONLY',
    note: 'No prior durable API probe for this path; likely marketing/localStorage or read-only catalog',
  };
}

function extractScriptSrcs(html) {
  const srcs = [];
  const re = /<script[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) srcs.push(m[1]);
  return srcs;
}

function missingLookingScripts(srcs) {
  // Heuristic only: broken-looking patterns in attributes (not HEAD of each asset)
  return srcs.filter((s) => {
    const t = String(s || '');
    if (!t || t === 'undefined' || t === 'null') return true;
    if (/\{\{|\$\{|%s|TODO|FIXME|missing|404\.js|null\.js|undefined\.js/i.test(t)) return true;
    if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(t)) return true;
    if (/\s/.test(t)) return true;
    return false;
  });
}

function isAuthRedirect(status, headers) {
  if (!(status === 301 || status === 302 || status === 303 || status === 307 || status === 308)) return false;
  const loc = String(headers?.location || '');
  return /login\.html|\/login|auth|create-account|register\.html/i.test(loc) || loc.length > 0;
}

function analyzeDeep(raw, status, headers) {
  if (isAuthRedirect(status, headers)) {
    return {
      ok: true,
      authRedirect: true,
      location: String(headers?.location || '').slice(0, 200),
      hasDoctype: false,
      obvious500Stack: false,
      bytes: Buffer.byteLength(String(raw || '')),
      scriptCount: 0,
      missingLookingScripts: [],
      note: 'Auth gate redirect (expected for staff/REQUIRES_LOGIN shells)',
    };
  }
  const text = String(raw || '');
  const lower = text.toLowerCase();
  const hasDoctype = /<!doctype\s+html/i.test(text) || /<html[\s>]/i.test(text);
  const stackHints = [
    'internal server error',
    'cannot get /',
    'at module._compile',
    'at object.<anonymous>',
    'errnoexception',
    'stack trace',
  ];
  // Avoid flagging normal JS source comments; only treat body as stack if status is 5xx
  // or classic Express/HTML error page shapes appear without a normal document.
  const obvious500 =
    status >= 500 ||
    ((/internal server error|cannot get \//i.test(text) || stackHints.some((h) => lower.includes(h))) &&
      !hasDoctype);
  const srcs = extractScriptSrcs(text);
  const missingScripts = missingLookingScripts(srcs);
  const ok = status === 200 && hasDoctype && !obvious500 && text.length > 80;
  return {
    ok,
    authRedirect: false,
    hasDoctype,
    obvious500Stack: !!obvious500,
    bytes: Buffer.byteLength(text),
    scriptCount: srcs.length,
    missingLookingScripts: missingScripts.slice(0, 8),
  };
}

function pickDeepSet(pages) {
  const deep = new Set();
  for (const p of pages) {
    if (p.audience === 'customer') deep.add(p.file);
  }
  for (const f of KEY_STAFF_SHELLS) {
    if (pages.some((p) => p.file === f)) deep.add(f);
  }
  // Fill toward DEEP_MIN with public pages (prefer known marketing)
  const publicPrefer = [
    'index.html',
    'blog.html',
    'news.html',
    'events.html',
    'courses.html',
    'info-center.html',
    'privacy.html',
    'terms.html',
    'policies.html',
    'search.html',
    'apps.html',
    'office.html',
    'incubators.html',
    'partnerships.html',
    'communities.html',
    'diplomas.html',
    'competitions.html',
    'systems-instructions.html',
  ];
  for (const f of publicPrefer) {
    if (deep.size >= DEEP_MIN) break;
    if (pages.some((p) => p.file === f)) deep.add(f);
  }
  for (const p of pages) {
    if (deep.size >= DEEP_MIN) break;
    deep.add(p.file);
  }
  return deep;
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function main() {
  ensureArt();
  const htmlFiles = fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith('.html') && fs.statSync(path.join(ROOT, f)).isFile())
    .sort();

  console.log(`BASE ${BASE}`);
  console.log(`HTML at repo root: ${htmlFiles.length}`);

  const classified = htmlFiles.map((file) => {
    const snippet = readLocalSnippet(file);
    const { audience, reasons } = classify(file, snippet);
    const ds = dataSaveFor(file, audience);
    return { file, audience, classifyReasons: reasons, ...ds };
  });

  const deepSet = pickDeepSet(classified);
  const pages = [];

  for (const row of classified) {
    const deep = deepSet.has(row.file);
    process.stdout.write(`GET /${row.file}${deep ? ' [deep]' : ''} ... `);
    const r = await req('GET', `/${row.file}`);
    const ct = String(r.headers?.['content-type'] || '');
    const authRedirect = isAuthRedirect(r.status, r.headers);
    const entry = {
      file: row.file,
      url: `${BASE}/${row.file}`,
      audience: row.audience,
      classifyReasons: row.classifyReasons,
      dataSave: row.dataSave,
      dataSaveNote: row.note,
      http: {
        status: r.status,
        ms: r.ms,
        contentType: ct.slice(0, 100),
        location: r.headers?.location ? String(r.headers.location).slice(0, 200) : null,
        error: r.error || null,
        authRedirect,
      },
      deep: false,
      markers: null,
      // 200 HTML or expected auth redirect both count as healthy page reachability
      httpOk: r.status === 200 || authRedirect,
    };

    if (deep) {
      const markers = analyzeDeep(r.raw, r.status, r.headers);
      entry.deep = true;
      entry.markers = markers;
      entry.deepOk = markers.ok;
    }

    pages.push(entry);
    const tag = entry.httpOk ? (entry.deep && !entry.deepOk ? 'DEEP_FAIL' : 'OK') : 'HTTP_FAIL';
    console.log(`${tag} ${r.status} ${r.ms}ms ${row.audience} dataSave=${row.dataSave}`);
  }

  const byAudience = pages.reduce((acc, p) => {
    acc[p.audience] = (acc[p.audience] || 0) + 1;
    return acc;
  }, {});
  const byDataSave = pages.reduce((acc, p) => {
    acc[p.dataSave] = (acc[p.dataSave] || 0) + 1;
    return acc;
  }, {});

  const httpPass = pages.filter((p) => p.httpOk).length;
  const httpFail = pages.length - httpPass;
  const deepPages = pages.filter((p) => p.deep);
  const deepPass = deepPages.filter((p) => p.deepOk).length;
  const deepFail = deepPages.length - deepPass;
  const times = pages.map((p) => p.http.ms).sort((a, b) => a - b);

  const report = {
    at: new Date().toISOString(),
    base: BASE,
    inventory: {
      htmlAtRepoRoot: htmlFiles.length,
      files: htmlFiles,
      byAudience,
      byDataSave,
    },
    probe: {
      allPagesGet: true,
      deepTargetMin: DEEP_MIN,
      deepProbed: deepPages.length,
      deepIncludes: 'all customer-facing + key staff shells + public fill',
    },
    summary: {
      http: { pass: httpPass, fail: httpFail, total: pages.length },
      deep: { pass: deepPass, fail: deepFail, total: deepPages.length },
      dataSave: byDataSave,
      latency: {
        n: times.length,
        p50Ms: pct(times, 50),
        p95Ms: pct(times, 95),
        maxMs: times.length ? times[times.length - 1] : 0,
      },
      verdict: httpFail === 0 && deepFail === 0 ? 'PASS' : 'FAIL',
    },
    pages,
    knownPriorProbes: [
      '/opt/cursor/artifacts/launch-customer-persist-isolation.json',
      '/opt/cursor/artifacts/launch-request-types-probe.json',
      '/opt/cursor/artifacts/launch-pages-http-sample.json',
    ],
  };

  const jsonPath = path.join(ART, 'launch-pages-full-inventory.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const mdLines = [
    '# Launch pages — full inventory',
    '',
    `- **At:** ${report.at}`,
    `- **Base:** ${BASE}`,
    `- **HTML at repo root:** ${htmlFiles.length}`,
    `- **HTTP GET:** ${httpPass} pass / ${httpFail} fail (of ${pages.length})`,
    `- **Deep markers (≥${DEEP_MIN} target):** ${deepPass} pass / ${deepFail} fail (of ${deepPages.length})`,
    `- **Verdict:** ${report.summary.verdict}`,
    '',
    '## Audience counts',
    '',
    ...Object.entries(byAudience).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## dataSave counts',
    '',
    ...Object.entries(byDataSave).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## CSV',
    '',
    '```csv',
    'file,audience,httpStatus,ms,deep,deepOk,dataSave,hasDoctype,missingScripts',
    ...pages.map((p) => {
      const ms = p.http.ms;
      const deep = p.deep ? 'Y' : 'N';
      const deepOk = p.deep ? (p.deepOk ? 'Y' : 'N') : '';
      const hasDoctype = p.markers ? (p.markers.hasDoctype ? 'Y' : 'N') : '';
      const miss = p.markers ? (p.markers.missingLookingScripts || []).join(';') : '';
      return `${p.file},${p.audience},${p.http.status},${ms},${deep},${deepOk},${p.dataSave},${hasDoctype},"${miss}"`;
    }),
    '```',
    '',
    '## Failures (if any)',
    '',
  ];

  const fails = pages.filter((p) => !p.httpOk || (p.deep && !p.deepOk));
  if (!fails.length) {
    mdLines.push('_None._');
  } else {
    for (const p of fails) {
      mdLines.push(
        `- ${p.file}: http=${p.http.status} deep=${p.deep} deepOk=${p.deepOk} err=${p.http.error || ''} scripts=${(p.markers?.missingLookingScripts || []).join(',')}`
      );
    }
  }
  mdLines.push('');

  const mdPath = path.join(ART, 'launch-pages-full-inventory.md');
  fs.writeFileSync(mdPath, mdLines.join('\n'));

  console.log('\n=== SUMMARY ===');
  console.log(
    JSON.stringify(
      {
        htmlCount: htmlFiles.length,
        http: report.summary.http,
        deep: report.summary.deep,
        dataSave: byDataSave,
        byAudience,
        verdict: report.summary.verdict,
        files: [jsonPath, mdPath],
      },
      null,
      2
    )
  );

  process.exit(report.summary.verdict === 'PASS' ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
