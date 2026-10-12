#!/usr/bin/env node
/**
 * GPS permission path test.
 *
 * Modes:
 *  - GRANT_VIA_OVERRIDE=1 (default): Chromium overridePermissions + setGeolocation
 *    proves code path after permission is granted (NOT the OS dialog click).
 *  - GRANT_VIA_OVERRIDE=0: no override — expects prompt/denied handling; cannot
 *    click the real OS Allow dialog from headless automation.
 *
 * Usage:
 *   HUB_E2E_BASE=https://naiosh-hub-production.up.railway.app \
 *   node scripts/e2e-gps-real-permission.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.HUB_E2E_BASE || 'https://naiosh-hub-production.up.railway.app').replace(
  /\/$/,
  ''
);
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const USE_OVERRIDE = String(process.env.GRANT_VIA_OVERRIDE || '1') !== '0';
const OUT_DIR = '/opt/cursor/artifacts/gps-real-permission';
const PAGE = `${BASE}/book-platform.html`;

const rows = [];
function mark(check, pass, evidence) {
  rows.push({ check, result: pass ? 'PASS' : 'FAIL', evidence: String(evidence || '').slice(0, 600) });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${evidence}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-fake-ui-for-media-stream'],
  });

  try {
    // --- Path A: granted (override or fake UI) ---
    const pageGrant = await browser.newPage();
    const ctx = browser.defaultBrowserContext();
    if (USE_OVERRIDE) {
      await ctx.overridePermissions(new URL(BASE).origin, ['geolocation']);
      await pageGrant.setGeolocation({ latitude: 31.9539, longitude: 35.9106 });
    }
    await pageGrant.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
    await pageGrant.waitForSelector('[data-geo-locate]', { timeout: 20000 });

    const permState = await pageGrant.evaluate(async () => {
      try {
        if (!navigator.permissions?.query) return 'permissions-api-unavailable';
        const r = await navigator.permissions.query({ name: 'geolocation' });
        return r.state;
      } catch (e) {
        return `error:${e.message}`;
      }
    });
    mark(
      'geolocation permission state (grant context)',
      USE_OVERRIDE ? permState === 'granted' : ['prompt', 'denied', 'granted'].includes(permState),
      permState
    );

    await pageGrant.click('[data-geo-locate]');
    await sleep(3000);
    const afterGrant = await pageGrant.evaluate(() => {
      const host = document.querySelector('[data-hub-geo-branch]') || document.body;
      const status = host.querySelector('[data-geo-status]')?.textContent?.trim() || '';
      const lat =
        host.querySelector('[data-geo-hidden="lat"]')?.value ||
        host.querySelector('input[name="lat"]')?.value ||
        '';
      const lng =
        host.querySelector('[data-geo-hidden="lng"]')?.value ||
        host.querySelector('input[name="lng"]')?.value ||
        '';
      const branch = host.querySelector('[data-geo-branch]')?.value;
      const country = host.querySelector('[data-geo-country]')?.value;
      const city = host.querySelector('[data-geo-city]')?.value;
      const source =
        host.querySelector('[data-geo-hidden="locationSource"]')?.value ||
        host.querySelector('input[name="locationSource"]')?.value ||
        '';
      const leaflet = !!host.querySelector('.leaflet-container');
      const statusKind = host.querySelector('[data-geo-status]')?.className || '';
      return { status, country, city, branch, lat, lng, source, leaflet, statusKind };
    });
    await pageGrant.screenshot({ path: path.join(OUT_DIR, 'gps-granted-locate.png'), fullPage: true });
    const grantOk =
      USE_OVERRIDE &&
      (String(afterGrant.lat).startsWith('31.95') ||
        afterGrant.source === 'geolocation' ||
        /تم تحديد الموقع|is-ok/i.test(`${afterGrant.status} ${afterGrant.statusKind}`));
    mark(
      'locate button fills coords via granted GPS',
      USE_OVERRIDE ? grantOk : /إذن|رفض|تعذّر|بانتظار/i.test(afterGrant.status),
      JSON.stringify(afterGrant)
    );

    // --- Path B: deny ---
    const pageDeny = await browser.newPage();
    await ctx.clearPermissionOverrides();
    await ctx.overridePermissions(new URL(BASE).origin, []); // deny geolocation
    await pageDeny.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
    await pageDeny.waitForSelector('[data-geo-locate]', { timeout: 20000 });
    await pageDeny.click('[data-geo-locate]');
    await sleep(2500);
    // Manual continue still possible
    await pageDeny.evaluate(() => {
      const host = document.querySelector('[data-hub-geo-branch]') || document.body;
      const branch = host.querySelector('[data-geo-branch]');
      const country = host.querySelector('[data-geo-country]');
      const city = host.querySelector('[data-geo-city]');
      if (branch) branch.value = 'فرع بعد رفض GPS';
      if (country) country.value = 'الأردن';
      if (city) city.value = 'عمّان';
      branch?.dispatchEvent(new Event('input', { bubbles: true }));
      const confirm = host.querySelector('[data-geo-confirm]');
      confirm?.click();
    });
    await sleep(500);
    const afterDeny = await pageDeny.evaluate(() => {
      const host = document.querySelector('[data-hub-geo-branch]') || document.body;
      const status = host.querySelector('[data-geo-status]')?.textContent?.trim() || '';
      const branch = host.querySelector('[data-geo-branch]')?.value;
      return {
        status,
        branch,
        canContinue: !!branch && branch.length > 2,
      };
    });
    await pageDeny.screenshot({ path: path.join(OUT_DIR, 'gps-denied-manual.png'), fullPage: true });
    mark(
      'deny GPS still allows manual continue',
      afterDeny.canContinue && afterDeny.branch === 'فرع بعد رفض GPS',
      JSON.stringify(afterDeny)
    );

    mark(
      'OS Allow dialog clicked by real user',
      false,
      USE_OVERRIDE
        ? 'NOT PROVEN — used Chromium overridePermissions (same getCurrentPosition path after grant)'
        : 'NOT PROVEN — headless cannot click OS geolocation Allow'
    );
  } finally {
    await browser.close();
  }

  const pass = rows.filter((r) => r.result === 'PASS').length;
  const fail = rows.filter((r) => r.result === 'FAIL').length;
  const md = [
    '# اختبار إذن الموقع GPS',
    '',
    `PASS: ${pass} · FAIL: ${fail}`,
    '',
    '| الفحص | النتيجة | دليل |',
    '|---|---|---|',
    ...rows.map((r) => `| ${r.check} | **${r.result}** | ${r.evidence.replace(/\|/g, '\\|')} |`),
    '',
    USE_OVERRIDE
      ? 'ملاحظة: مسار المنح استُخدم عبر Chromium مع `overridePermissions(geolocation)` + إحداثيات جهاز — يمر بنفس مسار كود `navigator.geolocation.getCurrentPosition` بعد الموافقة. ليس نقرة مستخدم على حوار نظام التشغيل الأصلي.'
      : 'ملاحظة: بدون override — لا يمكن إثبات نقرة Allow على حوار OS من الأتمتة الرأسية.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);
  fs.writeFileSync(
    path.join(OUT_DIR, 'report.json'),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        base: BASE,
        useOverride: USE_OVERRIDE,
        osDialogProven: false,
        pass,
        fail,
        rows,
      },
      null,
      2
    )
  );
  console.log(`\nWrote ${path.join(OUT_DIR, 'report.md')}`);
  // Do not exit non-zero solely because OS dialog is unproven — that row is intentionally FAIL
  const criticalFail = rows.some(
    (r) => r.result === 'FAIL' && r.check !== 'OS Allow dialog clicked by real user'
  );
  process.exit(criticalFail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
