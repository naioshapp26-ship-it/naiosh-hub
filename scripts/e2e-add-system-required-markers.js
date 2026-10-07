/**
 * Problem #4 — Add System required-field markers + FE/BE validation.
 * Run: node scripts/e2e-add-system-required-markers.js
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });

const out = { results: {}, remaining: [], requiredFields: [], optionalFields: [], extraIssues: [], fixed: [] };

function mark(name, pass, detail = '') {
  out.results[name] = pass ? 'PASS' : 'FAIL';
  if (!pass) out.remaining.push(`${name}: ${detail}`);
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
}

function api(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, BASE);
    const payload = body != null ? JSON.stringify(body) : null;
    const headers = { Accept: 'application/json' };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const r = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let data = {};
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch {
            data = { raw };
          }
          resolve({ status: res.statusCode, data });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function openAddForm(page) {
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  // First-time path: home → systems registry (apps)
  const clicked = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find((el) => {
      const t = (el.textContent || '').trim();
      const href = el.getAttribute('href') || '';
      return t === 'الأنظمة' || /apps\.html/.test(href);
    });
    if (a) {
      a.click();
      return a.href || a.getAttribute('href');
    }
    return '';
  });
  if (clicked) {
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {});
  }
  if (!/apps\.html/.test(page.url())) {
    await page.goto(`${BASE}/apps.html`, { waitUntil: 'networkidle0' });
  }
  await page.waitForSelector('[data-hub-act="add"][data-entity="apps"]', { timeout: 15000 });
  await page.click('[data-hub-act="add"][data-entity="apps"]');
  await page.waitForSelector('#hub-erp-modal.open #hub-add-nameAr', { timeout: 10000 });
}

async function main() {
  const consoleErrors = [];
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', (e) => consoleErrors.push(String(e.message || e)));

    await openAddForm(page);
    mark('الوصول إلى "إضافة نظام"', true, page.url());

    const formInfo = await page.evaluate(() => {
      const labels = [...document.querySelectorAll('#hub-erp-modal .hub-field-label')].map((l) =>
        l.textContent.replace(/\s+/g, ' ').trim()
      );
      const legend = document.querySelector('[data-req-legend]')?.textContent?.trim() || '';
      const required = labels.filter((l) => l.includes('*'));
      const optional = labels.filter((l) => /\(اختياري\)/.test(l));
      const rtl = document.documentElement.getAttribute('dir') === 'rtl';
      return { labels, legend, required, optional, rtl, title: document.querySelector('#hub-erp-modal-title')?.textContent };
    });
    out.requiredFields = formInfo.required;
    out.optionalFields = formInfo.optional;

    mark(
      'تمييز جميع الحقول المطلوبة بـ *',
      formInfo.required.length >= 12 &&
        formInfo.required.some((l) => /اسم النظام/.test(l)) &&
        formInfo.required.some((l) => /رمز النظام/.test(l)) &&
        formInfo.required.some((l) => /اسم الشركة/.test(l)),
      `count=${formInfo.required.length}`
    );
    mark(
      'تمييز الحقول الاختيارية',
      formInfo.optional.some((l) => /التصنيف/.test(l)) &&
        formInfo.optional.some((l) => /رابط/.test(l)) &&
        formInfo.optional.some((l) => /مستند|صورة|فيديو/.test(l)),
      `count=${formInfo.optional.length}`
    );
    mark('توضيح معنى * أعلى النموذج', /مطلوبة/.test(formInfo.legend) && /\*/.test(formInfo.legend), formInfo.legend);
    mark('RTL', formInfo.rtl, `dir=${formInfo.rtl}`);

    await page.screenshot({ path: path.join(ART, 'add-system-required-markers-desktop.png') });

    // Empty submit — clear defaults and save
    await page.evaluate(() => {
      document.querySelectorAll('#hub-erp-modal input, #hub-erp-modal select, #hub-erp-modal textarea').forEach((el) => {
        if (el.type === 'file' || el.type === 'checkbox' || el.type === 'radio' || el.type === 'hidden') return;
        if (el.tagName === 'SELECT') el.selectedIndex = 0;
        else el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
    await page.click('#hub-add-save');
    await new Promise((r) => setTimeout(r, 400));
    const emptyErrs = await page.evaluate(() =>
      [...document.querySelectorAll('#hub-erp-modal .hub-field-error')]
        .filter((e) => !e.hidden && e.textContent.trim())
        .map((e) => e.textContent.trim())
    );
    mark(
      'Frontend Validation',
      emptyErrs.length >= 1 && emptyErrs.every((m) => /مطلوب/.test(m)) && !emptyErrs.some((m) => /Required|Invalid/i.test(m)),
      emptyErrs.join(' | ')
    );
    mark('رسائل الأخطاء بالعربية', emptyErrs.length >= 1 && emptyErrs.every((m) => /[\u0600-\u06FF]/.test(m)), emptyErrs[0] || '');

    // Per-field: fill all then clear one required
    const fillAll = async () => {
      await page.evaluate(() => {
        const set = (id, v) => {
          const el = document.getElementById(id);
          if (!el) return;
          el.value = v;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        set('hub-add-nameAr', 'نظام اختبار علامات');
        set('hub-add-code', 'MARKTEST1');
        set('hub-add-category', 'أنظمة نايوش');
        set('hub-field-companyName', 'شركة اختبار');
        set('hub-field-companyAddress', 'الرياض');
        set('hub-field-party1Name', 'طرف أ');
        set('hub-field-party1Phone', '0501111111');
        set('hub-field-party2Name', 'طرف ب');
        set('hub-field-party2Phone', '0502222222');
        const pick = (id) => {
          const el = document.getElementById(id);
          if (!el || !el.options) return;
          for (let i = 0; i < el.options.length; i++) {
            if (el.options[i].value) {
              el.selectedIndex = i;
              el.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        };
        pick('hub-field-branch');
        pick('hub-field-incubator');
        pick('hub-field-platform');
        pick('hub-field-office');
      });
    };

    const requiredIds = [
      ['hub-add-nameAr', 'nameAr', /اسم النظام/],
      ['hub-add-code', 'code', /رمز النظام/],
      ['hub-field-companyName', 'companyName', /اسم الشركة/],
      ['hub-field-party1Phone', 'party1Phone', /جوال|هاتف|طرف/],
    ];
    let perFieldOk = true;
    for (const [inputId, field, re] of requiredIds) {
      await fillAll();
      await page.evaluate((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        document.querySelectorAll('.hub-field-error').forEach((e) => {
          e.hidden = true;
          e.textContent = '';
        });
      }, inputId);
      await page.click('#hub-add-save');
      await new Promise((r) => setTimeout(r, 500));
      const msg = await page.evaluate(
        (fid) => document.querySelector(`[data-err-for="${fid}"]`)?.textContent?.trim() || '',
        field
      );
      if (!re.test(msg) || !/مطلوب/.test(msg)) {
        perFieldOk = false;
        out.remaining.push(`per-field ${field}: ${msg}`);
      }
    }
    mark('تطابق * مع الحقول Required الحقيقية', perFieldOk, perFieldOk ? 'matched sample fields' : 'mismatch');

    // Backend validation
    const beEmpty = await api('POST', '/api/hub/apps', {});
    const beNoCompany = await api('POST', '/api/hub/apps', { nameAr: 'س', code: 'X2' });
    const stamp = Date.now().toString(36).toUpperCase();
    const beOk = await api('POST', '/api/hub/apps', {
      nameAr: 'نظام خادم اختبار',
      code: `BE${stamp}`.slice(0, 12),
      companyName: 'شركة',
      companyAddress: 'عنوان',
      party1Name: 'أ',
      party1Phone: '0501111111',
      party2Name: 'ب',
      party2Phone: '0502222222',
      branch: 'المقر الرئيسي',
      incubator: 'حاضنة تقنية',
      platform: 'النظام التشغيلي الموحد',
      office: 'المكتب الرئيسي',
    });
    mark(
      'Backend Validation',
      beEmpty.status === 400 &&
        beEmpty.data.field === 'nameAr' &&
        beNoCompany.status === 400 &&
        beNoCompany.data.field === 'companyName' &&
        beOk.status === 201 &&
        beOk.data.ok,
      `empty=${beEmpty.status}/${beEmpty.data.field} noCo=${beNoCompany.data.field} ok=${beOk.status}`
    );

    // Successful FE journey
    await openAddForm(page);
    await fillAll();
    await page.evaluate((c) => {
      document.getElementById('hub-add-code').value = c;
      document.getElementById('hub-add-code').dispatchEvent(new Event('input', { bubbles: true }));
    }, `FE${stamp}`.slice(0, 12));
    const postWait = page.waitForResponse(
      (r) => /\/api\/hub\/apps/.test(r.url()) && r.request().method() === 'POST',
      { timeout: 20000 }
    );
    await page.click('#hub-add-save');
    const postRes = await postWait;
    const postData = await postRes.json();
    await new Promise((r) => setTimeout(r, 500));
    const modalClosed = await page.evaluate(() => !document.querySelector('#hub-erp-modal.open'));
    mark(
      'First-Time User Journey',
      postRes.status() === 201 && postData.ok && modalClosed,
      `status=${postRes.status()} closed=${modalClosed}`
    );
    await page.screenshot({ path: path.join(ART, 'add-system-submit-success.png') });

    // Mobile
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await openAddForm(page);
    const mobileOk = await page.evaluate(() => {
      const legend = document.querySelector('[data-req-legend]');
      const errSample = document.querySelector('.hub-field-label');
      const lr = legend?.getBoundingClientRect();
      const overlapping = lr && lr.width > 0 && lr.height > 0;
      const starsVisible = [...document.querySelectorAll('.hub-field-label .hub-req')].every((s) => {
        const r = s.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      return {
        overlapping: !!overlapping,
        starsVisible,
        labelSample: errSample?.textContent?.trim() || '',
        rtl: getComputedStyle(document.documentElement).direction === 'rtl',
      };
    });
    await page.screenshot({ path: path.join(ART, 'add-system-required-markers-mobile.png') });
    mark(
      'Mobile/Responsive',
      mobileOk.overlapping && mobileOk.starsVisible && /\*/.test(mobileOk.labelSample),
      JSON.stringify(mobileOk)
    );

    const serious = consoleErrors.filter((e) => !/favicon|ResizeObserver|net::ERR/i.test(e));
    mark('Console/API Errors', serious.length === 0, serious.slice(0, 3).join(' || '));

    fs.writeFileSync(path.join(ART, 'e2e-add-system-required-markers.json'), JSON.stringify(out, null, 2));
    console.log('\n=== SUMMARY ===');
    console.log(JSON.stringify(out.results, null, 2));
    const critical = Object.entries(out.results).filter(([, v]) => v !== 'PASS');
    if (critical.length) {
      console.error('FAILS:', critical.map(([k]) => k).join(', '));
      process.exit(1);
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
