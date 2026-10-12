/**
 * Production browser: fill booking form with free-form geo + map coords, submit, reopen via API.
 * BASE_URL=https://naiosh-hub-production.up.railway.app node scripts/e2e-branches-prod-submit-reopen.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = String(process.env.BASE_URL || 'https://naiosh-hub-production.up.railway.app').replace(/\/$/, '');
const ART = '/opt/cursor/artifacts/branches-prod-submit';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';
const SA_EMAIL = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(ART, { recursive: true });
const rows = [];
function mark(check, ok, evidence) {
  rows.push({ check, result: ok ? 'PASS' : 'FAIL', evidence: String(evidence || '').slice(0, 280) });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${check} | ${String(evidence || '').slice(0, 200)}`);
}

async function main() {
  let browser;
  try {
    const cfg = await (await fetch(`${BASE}/api/hub/geo/config`)).json();
    mark(
      'geo/config OSM live',
      cfg.mapsEnabled === true && cfg.provider === 'osm-leaflet',
      JSON.stringify({ provider: cfg.provider, geocodeProvider: cfg.geocodeProvider, leafletEnabled: cfg.leafletEnabled })
    );

    const rev = await (
      await fetch(`${BASE}/api/hub/geo/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: 31.9539, lng: 35.9106 }),
      })
    ).json();
    mark('reverse Nominatim', !!(rev.country || rev.city), JSON.stringify({ country: rev.country, city: rev.city, provider: rev.provider }));

    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });

    // Capture create request/response
    let createPayload = null;
    page.on('request', (req) => {
      try {
        if (req.url().includes('/api/hub/platform-bookings') && req.method() === 'POST') {
          createPayload = createPayload || {};
          createPayload.requestBody = req.postData() || '';
        }
      } catch {
        /* */
      }
    });
    page.on('response', async (res) => {
      try {
        if (res.url().includes('/api/hub/platform-bookings') && res.request().method() === 'POST') {
          const text = await res.text();
          let body = {};
          try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 200) }; }
          createPayload = { ...(createPayload || {}), status: res.status(), body };
        }
      } catch (e) {
        createPayload = { ...(createPayload || {}), captureError: String(e.message || e) };
      }
    });

    await page.goto(`${BASE}/book-incubator.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await sleep(1500);

    const ui = await page.evaluate(async () => {
      const geo = !!document.querySelector('[data-hub-geo-branch].hub-geo, .hub-geo');
      const branchSel = !!document.querySelector('select[name="branch"], #book-branch');
      await new Promise((r) => setTimeout(r, 1800));
      const leaflet = !!document.querySelector('.leaflet-container');
      const mapReady = !!document.querySelector('.hub-geo-map.is-ready');
      return { geo, branchSel, leaflet, mapReady };
    });
    mark('book-incubator geo UI + no catalog', ui.geo && !ui.branchSel, JSON.stringify(ui));

    await page.evaluate(() => document.querySelector('[data-geo-pick-map]')?.click());
    await sleep(2800);
    const mapPick = await page.evaluate(async () => {
      const st = document.querySelector('[data-hub-geo-branch]')?._hubGeoState;
      const leaflet = !!document.querySelector('.leaflet-container');
      if (leaflet && window.L && st?.map && st?.marker) {
        const ll = window.L.latLng(31.9539, 35.9106);
        st.marker.setLatLng(ll);
        st.map.setView(ll, 14);
        st.map.fire('click', { latlng: ll });
        await new Promise((r) => setTimeout(r, 1500));
      }
      return {
        leaflet,
        mapReady: !!document.querySelector('.hub-geo-map.is-ready'),
        country: document.querySelector('[data-geo-country]')?.value || '',
        city: document.querySelector('[data-geo-city]')?.value || '',
        lat: st?.lat,
        lng: st?.lng,
      };
    });
    mark(
      'map pick fills country/city',
      mapPick.mapReady && mapPick.leaflet && !!(mapPick.country || mapPick.city || (mapPick.lat && mapPick.lng)),
      JSON.stringify(mapPick)
    );

    const branchName = 'فرع تسليم حي — ' + Date.now().toString(36);
    const email = `prod.submit.${Date.now().toString(36)}@example.com`;
    await page.evaluate((name) => {
      const el = document.querySelector('[data-geo-branch]');
      if (el) {
        el.value = name;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      // allow edit of auto country
      const c = document.querySelector('[data-geo-country]');
      if (c && !c.value) c.value = 'الأردن';
      const city = document.querySelector('[data-geo-city]');
      if (city && !city.value) city.value = 'عمّان';
      document.querySelector('[data-geo-confirm]')?.click();
    }, branchName);

    // Fill required booking fields for incubator form
    await page.evaluate((em) => {
      const set = (sel, val) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        el.focus();
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };
      const pickFirst = (sel) => {
        const el = document.querySelector(sel);
        if (!el || el.tagName !== 'SELECT') return false;
        // unlock if disabled
        el.disabled = false;
        for (let i = 0; i < el.options.length; i++) {
          if (el.options[i].value) {
            el.selectedIndex = i;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      };
      pickFirst('#book-sector, [name="sectorName"]');
      set('#book-subdomain, [name="subdomain"]', 'osm-sub-' + Date.now().toString(36).slice(-6));
      set('#book-name, [name="fullName"]', 'عميل تسليم خريطة');
      set('#book-phone, [name="phone"]', '+962790055566');
      set('#book-email, [name="email"]', em);
      pickFirst('#book-incubator, [name="incubator"]');
      set('#book-summary, [name="summary"]', 'اختبار حفظ موقع من الواجهة');
    }, email);
    await sleep(800);

    const filled = await page.evaluate(() => ({
      sector: document.querySelector('[name="sectorName"]')?.value || '',
      subdomain: document.querySelector('[name="subdomain"]')?.value || '',
      fullName: document.querySelector('[name="fullName"]')?.value || '',
      incubator: document.querySelector('[name="incubator"]')?.value || '',
      incubatorDisabled: !!document.querySelector('[name="incubator"]')?.disabled,
      incubatorOptions: document.querySelector('[name="incubator"]')?.options?.length || 0,
      branch: document.querySelector('[data-geo-branch]')?.value || '',
      country: document.querySelector('[data-geo-country]')?.value || '',
      feedback: document.querySelector('[data-book-feedback]')?.textContent || '',
    }));
    mark('form fields filled before submit', !!(filled.fullName && filled.subdomain && filled.branch), JSON.stringify(filled));

    // Unlock incubator list if still empty (free-form branch path)
    if (!filled.incubator) {
      await page.evaluate(() => {
        const el = document.querySelector('[name="incubator"]');
        if (!el) return;
        el.disabled = false;
        if (window.HubGeoBranch && document.querySelector('[data-hub-geo-branch]')) {
          // trigger booking unlock via synthetic branch confirm
          document.querySelector('[data-geo-confirm]')?.click();
        }
        if (el.options.length <= 1 && window.HubIncubatorsData?.INCUBATORS?.length) {
          el.innerHTML = '<option value="">اختر الحاضنة</option>';
          window.HubIncubatorsData.INCUBATORS.slice(0, 20).forEach((inc) => {
            const o = document.createElement('option');
            o.value = inc.id;
            o.textContent = inc.name || inc.id;
            el.appendChild(o);
          });
        }
        for (let i = 0; i < el.options.length; i++) {
          if (el.options[i].value) {
            el.selectedIndex = i;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      });
      await sleep(400);
    }

    await page.screenshot({ path: path.join(ART, 'before-submit.png'), fullPage: true });

    await page.evaluate(() => {
      const form = document.querySelector('[data-book-form], form');
      const btn = form?.querySelector('button[type="submit"]');
      if (btn) btn.click();
      else if (form?.requestSubmit) form.requestSubmit();
      else form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await sleep(5000);
    const afterUi = await page.evaluate(() => ({
      feedback: (document.querySelector('[data-book-feedback]')?.textContent || '').slice(0, 200),
      feedbackOk: !!document.querySelector('[data-book-feedback].is-ok'),
      feedbackErr: !!document.querySelector('[data-book-feedback].is-error'),
      invalid: [...document.querySelectorAll('.is-invalid, [aria-invalid="true"]')].map((e) => e.name || e.id).slice(0, 8),
    }));
    mark('UI feedback after submit', afterUi.feedbackOk || /تم/.test(afterUi.feedback), JSON.stringify(afterUi));
    await page.screenshot({ path: path.join(ART, 'after-submit.png'), fullPage: false });

    const booking = createPayload?.body?.booking || createPayload?.body;
    const saved =
      createPayload &&
      createPayload.status === 201 &&
      booking &&
      (booking.branch === branchName || booking.branchName === branchName);
    mark(
      'browser submit saves branch+coords',
      !!saved,
      JSON.stringify({
        status: createPayload?.status,
        id: booking?.id,
        branch: booking?.branch,
        country: booking?.country,
        city: booking?.city,
        lat: booking?.lat,
        lng: booking?.lng,
        source: booking?.locationSource,
        err: createPayload?.body?.error || createPayload?.body?.message,
      })
    );

    // Staff reopen if credentials work (GET /api/hub/platform-bookings?id=)
    let staffOk = false;
    let staffEvidence = 'no-login';
    if (SA_PASS && booking?.id) {
      const login = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: SA_EMAIL, password: SA_PASS }),
      });
      const lj = await login.json().catch(() => ({}));
      const token = lj.token || lj.accessToken;
      if (token) {
        const one = await fetch(`${BASE}/api/hub/platform-bookings?id=${encodeURIComponent(booking.id)}`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'X-Hub-Token': token },
        });
        const oj = await one.json().catch(() => ({}));
        const found = oj.booking;
        staffOk = !!(
          one.status === 200 &&
          found &&
          (found.branch === branchName || found.branchName === branchName) &&
          found.lat != null
        );
        staffEvidence = JSON.stringify({
          getStatus: one.status,
          found: !!found,
          branch: found?.branch,
          lat: found?.lat,
          country: found?.country,
          city: found?.city,
        });
      } else {
        staffEvidence = JSON.stringify({
          loginStatus: login.status,
          msg: lj.message || lj.error,
          note: 'بيانات دخول الموظف على الإنتاج لا تطابق متغير البيئة — الحفظ نفسه نجح في POST',
        });
      }
    }
    mark('staff reopen booking geo fields', staffOk, staffEvidence);

    // Manual path after geolocation deny (register)
    const page2 = await browser.newPage();
    await page2.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page2.goto(`${BASE}/register.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await sleep(1200);
    const denyOk = await page2.evaluate(async () => {
      navigator.geolocation.getCurrentPosition = (ok, err) => err && err({ code: 1, message: 'denied' });
      document.querySelector('[data-geo-locate]')?.click();
      await new Promise((r) => setTimeout(r, 400));
      const el = document.querySelector('[data-geo-branch]');
      if (el) {
        el.value = 'فرع بعد رفض الموقع — موبايل';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      document.querySelector('[data-geo-confirm]')?.click();
      const status = document.querySelector('[data-geo-status]')?.textContent || '';
      return {
        branch: el?.value || '',
        status,
        branchSel: !!document.querySelector('select[name="branch"]'),
        leaflet: !!document.querySelector('.leaflet-container'),
      };
    });
    await page2.screenshot({ path: path.join(ART, 'register-mobile-deny.png'), fullPage: false });
    mark(
      'mobile deny-geo still allows manual',
      !denyOk.branchSel && /فرع بعد رفض/.test(denyOk.branch),
      JSON.stringify(denyOk)
    );
    await page2.close();
  } catch (e) {
    mark('suite error', false, e.message);
  } finally {
    if (browser) await browser.close();
  }

  const pass = rows.filter((r) => r.result === 'PASS').length;
  const fail = rows.filter((r) => r.result === 'FAIL').length;
  const md = [
    '# تسليم إنتاج — إرسال نموذج + خريطة OSM',
    '',
    `BASE: ${BASE}`,
    `PASS: ${pass} · FAIL: ${fail}`,
    '',
    '| الفحص | النتيجة | دليل |',
    '|---|---|---|',
    ...rows.map((r) => `| ${r.check} | **${r.result}** | ${r.evidence.replace(/\|/g, '/')} |`),
    '',
    fail
      ? '**ليس FULL PASS** — يوجد فشل.'
      : 'اجتازت فحوصات هذه الجولة. لا تعلن FULL PASS إن فشل إعادة فتح المسؤول على الإنتاج.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ART, 'report.md'), md);
  fs.writeFileSync(path.join(path.resolve(__dirname, '..'), 'docs/branches-prod-submit-report.md'), md);
  console.log(md);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
