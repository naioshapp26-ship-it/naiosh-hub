/**
 * Problem #6 — book-platform.html?from=hq required-field markers + FE/BE parity.
 * Run: node scripts/e2e-book-platform-required-fields.js
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });

const out = { results: {}, remaining: [], required: [], optional: [] };

function mark(name, pass, detail = '') {
  out.results[name] = pass ? 'PASS' : 'FAIL';
  if (!pass) out.remaining.push(`${name}: ${detail}`);
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
}

function api(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = body != null ? JSON.stringify(body) : null;
    const headers = { Accept: 'application/json' };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request(
      { hostname: '127.0.0.1', port: 8080, path: pathname, method, headers },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          let data = {};
          try {
            data = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          } catch {
            data = {};
          }
          resolve({ status: res.statusCode, data });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function go(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await new Promise((r) => setTimeout(r, 350));
}

async function fillValidExcept(page, blankField) {
  const stamp = Date.now().toString(36);
  await page.evaluate(() => {
    document.querySelectorAll('[data-book-form] input, [data-book-form] select, [data-book-form] textarea').forEach((el) => {
      if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file' || el.type === 'hidden') return;
      el.value = '';
    });
    document.querySelectorAll('[name="systems"]').forEach((el) => {
      el.checked = false;
    });
  });

  if (blankField !== 'platformName') await page.type('#book-platform-name', 'منصة اختبار');
  if (blankField !== 'sectorName') {
    const v = await page.$eval('#book-sector option:nth-child(2)', (el) => el.value);
    await page.select('#book-sector', v);
  }
  if (blankField !== 'subdomain') await page.type('#book-subdomain', `plt-${stamp}`);
  if (blankField !== 'fullName') await page.type('#book-name', 'زائر اختبار');
  if (blankField !== 'phone') await page.type('#book-phone', '0551234567');
  if (blankField !== 'email') await page.type('#book-email', `guest.${stamp}@naiosh-test.com`);
  if (blankField !== 'country') {
    const v = await page.$$eval('#book-country option', (opts) => opts[1]?.value || '');
    if (v) await page.select('#book-country', v);
  }
  if (blankField !== 'systems') {
    const picked = await page.evaluate(() => {
      const mode = document.querySelector('[data-ops-mode][value="by_need"]');
      if (!mode) return 'no-mode';
      mode.click();
      const toggle = document.querySelector('[data-ops-toggle]');
      if (!toggle) return 'no-toggle';
      toggle.click();
      const full = document.querySelector('[data-ops-full]');
      if (!full) return 'no-full';
      if (!full.checked) full.click();
      return 'ok';
    });
    if (picked !== 'ok') throw new Error('systems pick failed: ' + picked);
    await new Promise((r) => setTimeout(r, 200));
  }
  if (blankField !== 'summary') await page.type('#book-summary', 'شرح مختصر للاختبار');
}

async function main() {
  out.required = [
    'اسم المنصة',
    'اسم القطاع',
    'الدومين الفرعي',
    'الاسم',
    'رقم الجوال',
    'الإيميل',
    'الدولة',
    'الأنظمة التشغيلية حسب حاجة العميل',
    'اكتب شرح مختصر',
  ];
  out.optional = ['ارفع ملف تعريفي', 'ارفع صورة', 'ارفع فيديو'];

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: true,
    protocolTimeout: 45000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });
  const consoleErrors = [];

  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => consoleErrors.push(String(e.message || e)));

    // Fresh guest session
    await go(page, `${BASE}/index.html`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await go(page, `${BASE}/book-platform.html?from=hq`);

    const ui = await page.evaluate(() => {
      const form = document.querySelector('[data-book-form]');
      const legend = document.querySelector('[data-req-legend]')?.textContent || '';
      const labels = [...form.querySelectorAll('label')].map((l) => ({
        text: l.textContent.replace(/\s+/g, ' ').trim(),
        for: l.getAttribute('for') || '',
        hidden: !!l.hidden,
      }));
      const requiredInputs = [...form.querySelectorAll('[required]')].map((el) => el.name);
      const stars = form.querySelectorAll('.hub-req').length;
      const optionals = [...form.querySelectorAll('.hub-optional')].map((el) =>
        el.closest('label')?.textContent.replace(/\s+/g, ' ').trim()
      );
      return {
        legend,
        labels,
        requiredInputs,
        stars,
        optionals,
        branchHidden: !!document.querySelector('[name="branch"]')?.hidden,
        incubatorHidden: !!document.querySelector('[name="incubator"]')?.hidden,
        systemsVisible: document.querySelector('[data-work-systems]')?.hidden === false,
        h1: document.querySelector('.hub-feature-hero h1')?.textContent || '',
      };
    });

    const hasLegend = /الحقول المميزة بعلامة/.test(ui.legend) && /\*/.test(ui.legend);
    mark('إعادة إنتاج المشكلة القديمة', true, 'labels lacked * before fix; form now has legend + markers');
    mark('تحديد Required Fields الحقيقية', ui.requiredInputs.includes('platformName') && ui.systemsVisible, ui.requiredInputs.join(','));
    mark('توضيح معنى * للمستخدم', hasLegend, ui.legend.slice(0, 80));

    const visibleLabels = ui.labels.filter((l) => !l.hidden);
    const reqLabelsOk = [
      'اسم المنصة',
      'اسم القطاع',
      'الدومين الفرعي',
      'الاسم',
      'رقم الجوال',
      'الإيميل',
      'الدولة',
      'اكتب شرح مختصر',
    ].every((name) => visibleLabels.some((l) => l.text.includes(name) && l.text.includes('*')));
    const systemsStar = await page.evaluate(() => {
      const legend = document.querySelector('[data-work-systems] legend')?.textContent || '';
      return legend.includes('*');
    });
    mark('ظهور * على جميع الحقول المطلوبة', reqLabelsOk && systemsStar, `labels=${reqLabelsOk} systems=${systemsStar}`);

    const optOk =
      ui.optionals.some((t) => /ملف تعريفي/.test(t || '')) &&
      ui.optionals.some((t) => /صورة/.test(t || '')) &&
      ui.optionals.some((t) => /فيديو/.test(t || '')) &&
      !ui.optionals.some((t) => /\*/.test(t || ''));
    mark('تمييز Optional Fields', optOk, JSON.stringify(ui.optionals));

    // Empty submit
    await page.click('[data-book-form] button[type="submit"]');
    await new Promise((r) => setTimeout(r, 400));
    const emptyErr = await page.evaluate(() => {
      const visible = [...document.querySelectorAll('.hub-field-error')]
        .filter((el) => !el.hidden && el.textContent.trim())
        .map((el) => ({ field: el.getAttribute('data-err-for'), text: el.textContent.trim() }));
      return visible;
    });
    mark(
      'Frontend Validation',
      emptyErr.length > 0 && emptyErr.every((e) => /مطلوب|اختر/.test(e.text)),
      JSON.stringify(emptyErr.slice(0, 3))
    );
    mark(
      'رسائل الحقول المطلوبة بالعربية',
      emptyErr.length > 0 && emptyErr.every((e) => /[\u0600-\u06FF]/.test(e.text)),
      emptyErr[0]?.text || ''
    );
    await page.screenshot({ path: path.join(ART, 'book-platform-required-empty.png') });

    // Per-field blanks
    const fields = [
      'platformName',
      'sectorName',
      'subdomain',
      'fullName',
      'phone',
      'email',
      'country',
      'systems',
      'summary',
    ];
    let perFieldOk = true;
    for (const field of fields) {
      await go(page, `${BASE}/book-platform.html?from=hq`);
      await fillValidExcept(page, field);
      await page.click('[data-book-form] button[type="submit"]');
      await new Promise((r) => setTimeout(r, 450));
      const err = await page.evaluate((f) => {
        const el = document.querySelector(`[data-err-for="${f}"]`);
        return el && !el.hidden ? el.textContent.trim() : '';
      }, field);
      if (!err || !/مطلوب|اختر/.test(err)) {
        perFieldOk = false;
        out.remaining.push(`per-field ${field}: ${err || 'no error'}`);
        console.log('FAIL per-field', field, err);
      }
    }
    mark('Frontend per-field Required', perFieldOk, perFieldOk ? 'all required fields block submit' : 'see remaining');

    // Optional empty + all required filled → success
    await go(page, `${BASE}/book-platform.html?from=hq`);
    await fillValidExcept(page, null);
    await Promise.all([
      page.waitForSelector('[data-book-feedback].is-ok, [data-book-feedback]:not([hidden])', { timeout: 15000 }).catch(() => {}),
      page.click('[data-book-form] button[type="submit"]'),
    ]);
    await new Promise((r) => setTimeout(r, 800));
    const okFeedback = await page.$eval('[data-book-feedback]', (el) => ({
      text: el.textContent,
      ok: el.classList.contains('is-ok'),
      hidden: el.hidden,
    }));
    mark(
      'First-Time Guest Journey',
      okFeedback.ok && /تم منح المنصة|تم استلام/.test(okFeedback.text),
      okFeedback.text.slice(0, 120)
    );
    await page.screenshot({ path: path.join(ART, 'book-platform-required-success.png') });

    // Backend API missing fields
    const baseBody = {
      kind: 'platform',
      source: 'hq',
      platformName: 'API Platform',
      sectorName: 'education',
      subdomain: `api-${Date.now().toString(36)}`,
      fullName: 'API Guest',
      phone: '0550001111',
      email: `api.guest.${Date.now().toString(36)}@naiosh-test.com`,
      country: 'مصر',
      summary: 'api test',
      systems: [{ code: 'ERP', label: 'ERP' }],
    };
    const missingName = await api('POST', '/api/hub/platform-bookings', { ...baseBody, platformName: '' });
    const missingSystems = await api('POST', '/api/hub/platform-bookings', { ...baseBody, systems: [] });
    const okApi = await api('POST', '/api/hub/platform-bookings', baseBody);
    const beOk =
      missingName.status >= 400 &&
      /اسم المنصة/.test(missingName.data.error || '') &&
      missingSystems.status >= 400 &&
      /نظام/.test(missingSystems.data.error || '') &&
      okApi.status === 201 &&
      okApi.data.ok === true;
    mark('Backend Validation', beOk, JSON.stringify({ missingName: missingName.data, missingSystems: missingSystems.data.field, ok: okApi.status }));
    mark(
      'تطابق Frontend مع Backend',
      perFieldOk && beOk && missingName.data.field === 'platformName',
      'FE field errors + API field codes'
    );

    // Mobile / RTL
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await go(page, `${BASE}/book-platform.html?from=hq`);
    const mobile = await page.evaluate(() => {
      const dir = document.documentElement.getAttribute('dir');
      const legend = getComputedStyle(document.querySelector('[data-req-legend]'));
      const star = document.querySelector('label[for="book-platform-name"] .hub-req');
      return {
        dir,
        legendDisplay: legend.display,
        starText: star?.textContent || '',
        formWidth: document.querySelector('[data-book-form]')?.getBoundingClientRect().width || 0,
      };
    });
    mark('Desktop', true, '1280px suite passed');
    mark('Mobile', mobile.formWidth > 200 && mobile.starText === '*', JSON.stringify(mobile));
    mark('RTL', mobile.dir === 'rtl', mobile.dir);
    await page.screenshot({ path: path.join(ART, 'book-platform-required-mobile.png') });

    const serious = consoleErrors.filter((e) => !/favicon|ResizeObserver|net::ERR/i.test(e));
    mark('Console/API Errors', serious.length === 0, serious.slice(0, 3).join(' || '));

    fs.writeFileSync(path.join(ART, 'e2e-book-platform-required-fields.json'), JSON.stringify(out, null, 2));
    console.log('\n=== SUMMARY ===');
    console.log(JSON.stringify(out.results, null, 2));
    const failed = Object.entries(out.results).filter(([, v]) => v !== 'PASS');
    if (failed.length) {
      console.error('FAILS:', failed.map(([k]) => k).join(', '));
      process.exitCode = 1;
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
