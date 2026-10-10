#!/usr/bin/env node
/**
 * Verify dashboard #integration is labeled «بوابات التكامل» everywhere in the section UI.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.HUB_E2E_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const SA = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const ART = '/opt/cursor/artifacts';
const OUT = path.join(ART, `integration-label-${Date.now()}.json`);
const OLD = 'التكامل والبوابة';
const NEW = 'بوابات التكامل';

const rows = [];
function mark(check, pass, evidence) {
  rows.push({ check, result: pass ? 'PASS' : 'FAIL', evidence: String(evidence || '').slice(0, 400) });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${evidence}`);
}

async function login(page) {
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#email, input[type="email"]', { timeout: 15000 });
  await page.evaluate(
    (e, p) => {
      const email = document.querySelector('#email, input[type="email"]');
      const pass = document.querySelector('#password, input[type="password"]');
      if (email) email.value = e;
      if (pass) pass.value = p;
    },
    SA,
    SA_PASS
  );
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => null),
    page.click('button[type="submit"], #loginBtn, .btn-primary'),
  ]);
  await page.waitForFunction(() => /dashboard\.html/i.test(location.pathname), { timeout: 20000 }).catch(() => null);
}

async function main() {
  if (!SA_PASS) {
    console.error('Need HUB_SUPER_ADMIN_INITIAL_PASSWORD');
    process.exit(2);
  }
  fs.mkdirSync(ART, { recursive: true });

  // Static source guard
  const dash = fs.readFileSync(path.join(__dirname, '../js/dashboard.js'), 'utf8');
  const ops = fs.readFileSync(path.join(__dirname, '../js/hub-ops-workspaces.js'), 'utf8');
  mark('المصدر: لا يظهر الاسم القديم في dashboard.js', !dash.includes(OLD), OLD);
  mark('المصدر: لا يظهر الاسم القديم في hub-ops-workspaces.js', !ops.includes(OLD), OLD);
  mark('المصدر: NAV label = بوابات التكامل', /label:\s*'بوابات التكامل'/.test(dash), 'NAV');
  mark('المصدر: TITLES = بوابات التكامل', /integration:\s*\['بوابات التكامل'/.test(dash), 'TITLES');
  mark('الرابط #integration محفوظ', /key:\s*'integration'/.test(dash), 'key');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  });

  try {
    for (const vp of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile', width: 390, height: 844, isMobile: true },
    ]) {
      const page = await browser.newPage();
      await page.setViewport({
        width: vp.width,
        height: vp.height,
        isMobile: !!vp.isMobile,
        hasTouch: !!vp.isMobile,
      });
      await login(page);

      // Open via hash
      await page.goto(`${BASE}/dashboard.html#integration`, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForFunction(
        () => (document.getElementById('page-title')?.textContent || '').includes('بوابات التكامل'),
        { timeout: 25000 }
      );
      await new Promise((r) => setTimeout(r, 800));

      const viaHash = await page.evaluate((oldName, newName) => {
        const title = (document.getElementById('page-title')?.textContent || '').trim();
        const sub = (document.getElementById('page-sub')?.textContent || '').trim();
        const body = document.body.innerText || '';
        const hash = location.hash;
        const nav = Array.from(document.querySelectorAll('#sidebar-nav a, .sidebar a, nav a')).find((a) =>
          (a.textContent || '').includes(newName)
        );
        const wsTitle = (document.querySelector('.hub-integration-ws h1, .hub-integration-ws .ws-title, .hub-ops-ws h2, .hub-ops-ws h1')?.textContent || '').trim();
        return {
          title,
          sub,
          hash,
          navText: nav ? (nav.textContent || '').replace(/\s+/g, ' ').trim() : '',
          navHref: nav ? nav.getAttribute('href') || nav.getAttribute('data-panel') || '' : '',
          hasOld: body.includes(oldName),
          hasNew: body.includes(newName),
          wsTitle,
        };
      }, OLD, NEW);

      await page.screenshot({
        path: path.join(ART, `integration-label-${vp.name}.png`),
        fullPage: false,
      });

      mark(`${vp.name}: عنوان الصفحة = بوابات التكامل`, viaHash.title === NEW, viaHash.title);
      mark(`${vp.name}: لا يظهر الاسم القديم`, !viaHash.hasOld, viaHash.hasOld ? OLD : 'clean');
      mark(`${vp.name}: يظهر الاسم الجديد`, viaHash.hasNew, NEW);
      mark(`${vp.name}: الهاش #integration`, viaHash.hash === '#integration', viaHash.hash);
      mark(
        `${vp.name}: عنصر القائمة الجانبية`,
        !!(viaHash.navText && viaHash.navText.includes(NEW)),
        viaHash.navText
      );

      // Click sidebar item from overview
      await page.goto(`${BASE}/dashboard.html#overview`, { waitUntil: 'networkidle2', timeout: 45000 });
      await new Promise((r) => setTimeout(r, 600));
      if (vp.isMobile) {
        await page.evaluate(() => {
          document.body.classList.add('nav-open');
          document.querySelector('.menu-toggle, #menu-toggle, [data-nav-toggle]')?.click();
        });
        await new Promise((r) => setTimeout(r, 300));
      }
      const clicked = await page.evaluate((newName) => {
        const a = Array.from(document.querySelectorAll('#sidebar-nav a, .sidebar a')).find((el) =>
          (el.textContent || '').includes(newName)
        );
        if (!a) return { ok: false };
        a.click();
        return { ok: true, href: a.getAttribute('href') || '', panel: a.getAttribute('data-panel') || '' };
      }, NEW);
      await new Promise((r) => setTimeout(r, 900));
      const afterClick = await page.evaluate((newName) => ({
        hash: location.hash,
        title: (document.getElementById('page-title')?.textContent || '').trim(),
        hasNew: (document.body.innerText || '').includes(newName),
      }), NEW);
      mark(
        `${vp.name}: النقر على القائمة يفتح #integration`,
        clicked.ok && afterClick.hash === '#integration' && afterClick.title === NEW,
        JSON.stringify({ clicked, afterClick })
      );

      // Refresh keeps label
      await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
      await page.waitForFunction(
        () => (document.getElementById('page-title')?.textContent || '').includes('بوابات التكامل'),
        { timeout: 20000 }
      );
      const afterReload = await page.evaluate((oldName, newName) => ({
        title: (document.getElementById('page-title')?.textContent || '').trim(),
        hash: location.hash,
        hasOld: (document.body.innerText || '').includes(oldName),
      }), OLD, NEW);
      mark(
        `${vp.name}: بعد التحديث يبقى بوابات التكامل`,
        afterReload.title === NEW && afterReload.hash === '#integration' && !afterReload.hasOld,
        JSON.stringify(afterReload)
      );

      await page.close();
    }
  } catch (err) {
    mark('e2e', false, err.stack || err.message);
  } finally {
    await browser.close().catch(() => null);
  }

  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), base: BASE, rows }, null, 2));
  console.log('Report:', OUT);
  const failed = rows.filter((r) => r.result === 'FAIL').length;
  console.log(`Summary: ${rows.length - failed} PASS / ${failed} FAIL / ${rows.length} total`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
