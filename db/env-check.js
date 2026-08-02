/**
 * Environment checks for Naiosh Hub on Railway / local.
 * Required vars must be present in production.
 */

const REQUIRED = [
  {
    key: 'PORT',
    requiredInProd: false,
    description: 'منفذ الاستماع (Railway يضبطه تلقائيًا)',
  },
  {
    key: 'DATABASE_URL',
    requiredInProd: true,
    description: 'سلسلة اتصال Postgres العامة — من خدمة Postgres على Railway',
    altKeys: ['DATABASE_PRIVATE_URL'],
  },
  {
    key: 'NODE_ENV',
    requiredInProd: true,
    description: 'production على Railway',
    expected: 'production',
  },
];

const RECOMMENDED = [
  {
    key: 'DATABASE_PRIVATE_URL',
    description: 'اتصال خاص داخل شبكة Railway (أسرع وآمن بين الخدمات)',
  },
  {
    key: 'APP_NAME',
    description: 'اسم الخدمة',
    defaultValue: 'naiosh-hub',
  },
  {
    key: 'APP_URL',
    description: 'رابط الدومين العام للخدمة',
  },
  {
    key: 'CORS_ORIGIN',
    description: 'أصول مسموحة للـ API (اختياري)',
    defaultValue: '*',
  },
  {
    key: 'SESSION_SECRET',
    description: 'سر جلسات/JWT — غيّره في الإنتاج',
  },
  {
    key: 'HUB_DEMO_AUTH',
    description: 'تفعيل الدخول التجريبي (true/false)',
    defaultValue: 'true',
  },
  {
    key: 'HUB_AUTO_MIGRATE',
    description: 'تشغيل ترحيل الجداول عند الإقلاع (true/false)',
    defaultValue: 'true',
  },
  {
    key: 'PGSSLMODE',
    description: 'وضع SSL لـ Postgres عند الحاجة',
  },
];

function hasAny(keys) {
  return keys.some((k) => Boolean(process.env[k] && String(process.env[k]).trim()));
}

function checkEnvironment() {
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const results = [];

  for (const item of REQUIRED) {
    const keys = [item.key, ...(item.altKeys || [])];
    const present = hasAny(keys);
    const required = item.requiredInProd ? isProd : item.requiredInProd === true;
    let status = present ? 'ok' : required ? 'missing' : 'optional-missing';
    if (present && item.expected && process.env[item.key] !== item.expected && isProd) {
      status = 'unexpected';
    }
    results.push({
      key: item.key,
      group: 'required',
      status,
      description: item.description,
      present,
      valuePreview: present ? mask(process.env[item.key] || process.env[(item.altKeys || [])[0]]) : null,
    });
  }

  for (const item of RECOMMENDED) {
    const present = Boolean(process.env[item.key] && String(process.env[item.key]).trim());
    results.push({
      key: item.key,
      group: 'recommended',
      status: present ? 'ok' : 'recommended-missing',
      description: item.description,
      present,
      defaultValue: item.defaultValue || null,
      valuePreview: present ? mask(process.env[item.key]) : null,
    });
  }

  const failed = results.filter((r) => r.status === 'missing' || r.status === 'unexpected');
  return {
    ok: failed.length === 0,
    production: isProd,
    failed: failed.map((f) => f.key),
    checks: results,
    railwayHints: {
      linkPostgres: 'في خدمة naiosh-hub ← Variables ← Add Variable Reference من Postgres',
      requiredRefs: [
        'DATABASE_URL = ${{Postgres.DATABASE_URL}}',
        'DATABASE_PRIVATE_URL = ${{Postgres.DATABASE_PRIVATE_URL}}',
      ],
      alsoSet: [
        'NODE_ENV=production',
        'APP_NAME=naiosh-hub',
        'HUB_AUTO_MIGRATE=true',
        'HUB_DEMO_AUTH=true',
        'SESSION_SECRET=<random-long-string>',
      ],
    },
  };
}

function mask(value) {
  const v = String(value || '');
  if (!v) return null;
  if (v.length <= 8) return '***';
  if (v.includes('://')) {
    return v.replace(/:\/\/([^:@/]+):([^@/]+)@/, '://$1:***@');
  }
  return `${v.slice(0, 4)}…${v.slice(-2)}`;
}

module.exports = {
  REQUIRED,
  RECOMMENDED,
  checkEnvironment,
};
