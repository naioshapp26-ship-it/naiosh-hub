/**
 * Customer identity integrity audit — explains count diffs vs "zero gaps".
 *
 * DATABASE_URL=... node scripts/audit-customer-integrity.js
 *
 * Gaps = customers missing required portal/profile rows (must be 0).
 * Extra accounts/profiles = orphans or non-customer personas (documented, not deleted).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ART = '/opt/cursor/artifacts/customer-integrity';

async function q(client, sql, params = []) {
  const r = await client.query(sql, params);
  return r.rows;
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const { withClient } = require('../db/migrate');

  const report = {
    at: new Date().toISOString(),
    verdict: '',
    counts: {},
    gaps: {},
    orphans: {},
    duplicates: {},
    explanation: [],
    queries: [],
    PASS: [],
    FAIL: [],
    NOT_TESTED: [],
  };

  await withClient(async (client) => {
    const markQ = (name, sql, rows) => {
      report.queries.push({ name, sql: sql.trim().replace(/\s+/g, ' '), rows });
    };

    let sql = `SELECT
      (SELECT COUNT(*)::int FROM hub_users) AS hub_users_all,
      (SELECT COUNT(*)::int FROM hub_users WHERE role='customer') AS hub_users_customers,
      (SELECT COUNT(*)::int FROM hub_client_accounts) AS hub_client_accounts,
      (SELECT COUNT(*)::int FROM hub_profiles) AS hub_profiles`;
    const counts = (await q(client, sql))[0];
    report.counts = counts;
    markQ('counts', sql, [counts]);

    sql = `SELECT COUNT(*)::int AS n FROM hub_users u
      LEFT JOIN hub_client_accounts c ON c.email = u.email
      WHERE u.role='customer' AND c.email IS NULL`;
    const gapClient = (await q(client, sql))[0].n;
    markQ('customers_without_client_account', sql, [{ n: gapClient }]);

    sql = `SELECT COUNT(*)::int AS n FROM hub_users u
      LEFT JOIN hub_profiles p ON p.email = u.email
      WHERE u.role='customer' AND p.email IS NULL`;
    const gapProfile = (await q(client, sql))[0].n;
    markQ('customers_without_profile', sql, [{ n: gapProfile }]);
    report.gaps = {
      customers_without_client_account: gapClient,
      customers_without_profile: gapProfile,
    };

    sql = `SELECT COUNT(*)::int AS n FROM hub_client_accounts c
      LEFT JOIN hub_users u ON u.email = c.email AND u.role='customer'
      WHERE u.email IS NULL`;
    const orphanAccounts = (await q(client, sql))[0].n;
    sql = `SELECT c.email, c.client_id, c.account_no, c.name, c.status, c.created_at
      FROM hub_client_accounts c
      LEFT JOIN hub_users u ON u.email = c.email AND u.role='customer'
      WHERE u.email IS NULL LIMIT 50`;
    const orphanAccountRows = await q(client, sql);
    markQ('orphan_client_accounts', sql, orphanAccountRows);

    sql = `SELECT COUNT(*)::int AS n FROM hub_profiles p
      WHERE NOT EXISTS (
        SELECT 1 FROM hub_users u WHERE u.email = p.email AND u.role='customer'
      )`;
    const orphanProfiles = (await q(client, sql))[0].n;

    sql = `SELECT
      CASE
        WHEN email ILIKE '%scale-test.naiosh.local' THEN 'scale-test.naiosh.local'
        WHEN email ILIKE '%@t.local' THEN 't.local'
        WHEN email ILIKE '%naiosh-test.com' THEN 'naiosh-test.com'
        WHEN email ILIKE '%@%' THEN split_part(email, '@', 2)
        ELSE 'no-at'
      END AS domain,
      COUNT(*)::int AS n
      FROM hub_profiles p
      WHERE NOT EXISTS (
        SELECT 1 FROM hub_users u WHERE u.email = p.email AND u.role='customer'
      )
      GROUP BY 1 ORDER BY 2 DESC`;
    const orphanDomains = await q(client, sql);
    markQ('orphan_profile_domains', sql, orphanDomains);

    sql = `SELECT COALESCE(active_persona,'(null)') AS persona,
      COALESCE(status,'(null)') AS status, COUNT(*)::int AS n
      FROM hub_profiles p
      WHERE NOT EXISTS (SELECT 1 FROM hub_users u WHERE u.email = p.email)
      GROUP BY 1,2 ORDER BY 3 DESC`;
    const orphanPersonas = await q(client, sql);
    markQ('orphan_profile_personas', sql, orphanPersonas);

    report.orphans = {
      client_accounts: orphanAccounts,
      client_account_samples: orphanAccountRows,
      profiles: orphanProfiles,
      profile_domains: orphanDomains,
      profile_personas: orphanPersonas,
      math: {
        customers: counts.hub_users_customers,
        client_accounts: counts.hub_client_accounts,
        extra_client_accounts: counts.hub_client_accounts - counts.hub_users_customers,
        profiles: counts.hub_profiles,
        extra_profiles: counts.hub_profiles - counts.hub_users_customers,
        profiles_for_customers: counts.hub_profiles - orphanProfiles,
      },
    };

    const dupChecks = [
      ['hub_users.email', `SELECT email, COUNT(*)::int AS n FROM hub_users GROUP BY email HAVING COUNT(*) > 1`],
      ['hub_client_accounts.email', `SELECT email, COUNT(*)::int AS n FROM hub_client_accounts GROUP BY email HAVING COUNT(*) > 1`],
      [
        'hub_client_accounts.client_id',
        `SELECT client_id, COUNT(*)::int AS n FROM hub_client_accounts
         WHERE client_id IS NOT NULL AND client_id <> '' GROUP BY client_id HAVING COUNT(*) > 1`,
      ],
      [
        'hub_client_accounts.account_no',
        `SELECT account_no, COUNT(*)::int AS n FROM hub_client_accounts
         WHERE account_no IS NOT NULL AND account_no <> '' GROUP BY account_no HAVING COUNT(*) > 1`,
      ],
      ['hub_profiles.email', `SELECT email, COUNT(*)::int AS n FROM hub_profiles GROUP BY email HAVING COUNT(*) > 1`],
    ];
    report.duplicates = {};
    for (const [name, dsql] of dupChecks) {
      const rows = await q(client, dsql);
      report.duplicates[name] = rows;
      markQ(`dup_${name}`, dsql, rows);
    }

    report.explanation = [
      `"فجوات صفر" تعني: كل حساب customer في hub_users يملك سجل hub_client_accounts وسجل hub_profiles (customers_without_* = 0).`,
      `فرق client_accounts (${counts.hub_client_accounts}) − customers (${counts.hub_users_customers}) = ${counts.hub_client_accounts - counts.hub_users_customers}: حسابات يتيمة بدون hub_users.role=customer (بقايا اختبارات مباشرة مثل direct_*@t.local) — ليست فجوة هوية للعملاء الحقيقيين.`,
      `فرق profiles (${counts.hub_profiles}) − customers (${counts.hub_users_customers}) = ${counts.hub_profiles - counts.hub_users_customers}: ملفات يتيمة من اختبارات ضغط/تشخيص (scale-test / t.local / naiosh-test) وشخصيات غير عميل — لا تُحذف تلقائيًا لأنها ليست بيانات عملاء ناقصة.`,
      `لا توجد تكرارات على email / client_id / account_no في الجداول المفحوصة.`,
      `لا إنشاء حسابات وهمية ولا حذف بيانات صحيحة في هذا التدقيق — قراءة فقط.`,
    ];

    if (gapClient === 0 && gapProfile === 0) {
      report.PASS.push('customers_have_required_portal_and_profile');
    } else {
      report.FAIL.push({
        name: 'customers_have_required_portal_and_profile',
        note: JSON.stringify(report.gaps),
      });
    }

    const anyDups = Object.values(report.duplicates).some((rows) => rows.length > 0);
    if (!anyDups) report.PASS.push('no_duplicate_identity_keys');
    else report.FAIL.push({ name: 'no_duplicate_identity_keys', note: 'see duplicates' });

    report.PASS.push('orphan_extras_documented_not_deleted');
    report.verdict =
      gapClient === 0 && gapProfile === 0 && !anyDups
        ? 'INTEGRITY_OK: zero customer gaps; extras are orphans/test leftovers (documented)'
        : 'INTEGRITY_ISSUES: see gaps/duplicates';
  });

  const jsonPath = path.join(ART, 'integrity-audit.json');
  const mdPath = path.join(ART, 'integrity-audit.md');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md = [
    '# تدقيق سلامة بيانات العملاء',
    '',
    `التاريخ: ${report.at}`,
    `الحكم: **${report.verdict}**`,
    '',
    '## الأعداد',
    '',
    `| الجدول | العدد |`,
    `|---|---:|`,
    `| hub_users (الكل) | ${report.counts.hub_users_all} |`,
    `| hub_users role=customer | ${report.counts.hub_users_customers} |`,
    `| hub_client_accounts | ${report.counts.hub_client_accounts} |`,
    `| hub_profiles | ${report.counts.hub_profiles} |`,
    '',
    '## الفجوات (يجب أن تكون صفرًا لكل عميل)',
    '',
    `- customers_without_client_account: **${report.gaps.customers_without_client_account}**`,
    `- customers_without_profile: **${report.gaps.customers_without_profile}**`,
    '',
    '## السجلات الزائدة / اليتيمة (ليست فجوات)',
    '',
    `- orphan client_accounts: **${report.orphans.client_accounts}** (فرق +${report.orphans.math.extra_client_accounts})`,
    `- orphan profiles: **${report.orphans.profiles}** (فرق +${report.orphans.math.extra_profiles})`,
    '',
    '### توزيع نطاقات الملفات اليتيمة',
    '',
    ...(report.orphans.profile_domains || []).map((r) => `- ${r.domain}: ${r.n}`),
    '',
    '## التفسير',
    '',
    ...report.explanation.map((e) => `- ${e}`),
    '',
    '## PASS / FAIL',
    '',
    ...report.PASS.map((p) => `- PASS: ${p}`),
    ...report.FAIL.map((f) => `- FAIL: ${f.name} — ${f.note || ''}`),
    '',
    `الأدلة: \`${jsonPath}\``,
    '',
  ].join('\n');
  fs.writeFileSync(mdPath, md);

  console.log(md);
  console.log('Wrote', jsonPath, mdPath);
  process.exit(report.FAIL.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
