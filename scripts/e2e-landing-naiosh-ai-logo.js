#!/usr/bin/env node
/**
 * Landing hero NAIOSH AI logo → quality-analysis.html
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const ART = '/opt/cursor/artifacts/landing-naiosh-ai-logo';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const PORT = Number(process.env.SCALE_PORT || 8860);
const BASE = (process.env.HUB_E2E_BASE || `http://127.0.0.1:${PORT}`).replace(/\/$/, '');
const OWN = !process.env.HUB_E2E_BASE;

const rows = [];
const mark = (c, p, e) => {
  rows.push({ check: c, result: p ? 'PASS' : 'FAIL', evidence: String(e || '').slice(0, 500) });
  console.log(`${p ? 'PASS' : 'FAIL'} | ${c} | ${String(e || '').slice(0, 220)}`);
};

function startServer() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      DATABASE_URL: process.env.DATABASE_URL || '',
      AUTO_MIGRATE: '0',
      HUB_CUSTOMER_BACKFILL_BG: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => {
    log += d;
  });
  child.stderr.on('data', (d) => {
    log += d;
  });
  return {
    stop: () => {
      try {
        child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    },
    log: () => log,
  };
}

function health() {
  return new Promise((resolve) => {
    const r = http.get({ hostname: '127.0.0.1', port: PORT, path: '/api/health', timeout: 2000 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    r.on('error', () => resolve(false));
    r.on('timeout', () => {
      r.destroy();
      resolve(false);
    });
  });
}

async function waitHealth(ms = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await health()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('health timeout');
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  let srv = null;
  if (OWN) {
    srv = startServer();
    await waitHealth();
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('a.hero-naiosh-ai-logo', { timeout: 15000 });

    const meta = await page.evaluate(() => {
      const a = document.querySelector('a.hero-naiosh-ai-logo');
      const img = a && a.querySelector('img');
      const navLogo = document.querySelector('#site-logo-header, .site-header-logo');
      const cs = a ? getComputedStyle(a) : null;
      return {
        href: a ? a.getAttribute('href') : null,
        aria: a ? a.getAttribute('aria-label') : null,
        title: a ? a.getAttribute('title') : null,
        imgSrc: img ? img.getAttribute('src') : null,
        cursor: cs ? cs.cursor : null,
        navLogoSrc: navLogo ? navLogo.getAttribute('src') : null,
        inTitleRow: !!(a && a.closest('.hero-title-row')),
      };
    });

    mark('logo_present_in_title_row', meta.inTitleRow, JSON.stringify(meta));
    mark('logo_uses_original_asset', /logo-naiosh-ai\.jpg/.test(meta.imgSrc || ''), meta.imgSrc);
    mark('logo_href_quality_analysis', /quality-analysis\.html/.test(meta.href || ''), meta.href);
    mark('aria_label_quality', meta.aria === 'الانتقال إلى تحليل الجودة', meta.aria);
    mark('title_quality', meta.title === 'الانتقال إلى تحليل الجودة', meta.title);
    mark('cursor_pointer', meta.cursor === 'pointer', meta.cursor);
    mark('nav_logo_unchanged', /logo-hub/.test(meta.navLogoSrc || ''), meta.navLogoSrc);

    await page.screenshot({ path: path.join(ART, 'landing-desktop-with-logo.png'), fullPage: false });

    // Keyboard focus
    await page.focus('a.hero-naiosh-ai-logo');
    const focused = await page.evaluate(() => document.activeElement?.classList?.contains('hero-naiosh-ai-logo'));
    mark('keyboard_focusable', focused, 'focus()');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
      page.click('a.hero-naiosh-ai-logo'),
    ]);
    const afterUrl = page.url();
    const qaOk = /quality-analysis\.html/.test(afterUrl);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const noAuthBlock = !/غير مصرح|مطلوب تسجيل الدخول|403|ليس لديك صلاحية/i.test(bodyText);
    mark('click_opens_quality_analysis', qaOk, afterUrl);
    mark('quality_page_loads_no_auth_error', qaOk && noAuthBlock && /تحليل الجودة/.test(bodyText), bodyText.slice(0, 200));
    await page.screenshot({ path: path.join(ART, 'quality-analysis-after-click.png'), fullPage: false });

    // Mobile
    const mob = await browser.newPage();
    await mob.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await mob.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await mob.waitForSelector('a.hero-naiosh-ai-logo', { timeout: 15000 });
    await mob.screenshot({ path: path.join(ART, 'landing-mobile-with-logo.png'), fullPage: false });
    await Promise.all([
      mob.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
      mob.tap('a.hero-naiosh-ai-logo').catch(() => mob.click('a.hero-naiosh-ai-logo')),
    ]);
    mark('mobile_tap_opens_quality_analysis', /quality-analysis\.html/.test(mob.url()), mob.url());
    await mob.screenshot({ path: path.join(ART, 'quality-analysis-mobile.png'), fullPage: false });

    // Light theme still shows logo
    await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('hubTheme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');
      document.body.classList.remove('dark-mode');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const lightVisible = await page.evaluate(() => {
      const a = document.querySelector('a.hero-naiosh-ai-logo');
      if (!a) return false;
      const r = a.getBoundingClientRect();
      return r.width > 40 && r.height > 40;
    });
    mark('light_theme_logo_visible', lightVisible, 'theme=light');
    await page.screenshot({ path: path.join(ART, 'landing-light-with-logo.png'), fullPage: false });
  } catch (err) {
    mark('suite_error', false, err.stack || err.message);
  } finally {
    await browser.close().catch(() => null);
    if (srv) {
      fs.writeFileSync(path.join(ART, 'server.log'), srv.log());
      srv.stop();
    }
  }

  const report = {
    at: new Date().toISOString(),
    base: BASE,
    finalLink: 'quality-analysis.html',
    rows,
    PASS: rows.filter((r) => r.result === 'PASS').map((r) => r.check),
    FAIL: rows.filter((r) => r.result === 'FAIL').map((r) => r.check),
  };
  fs.writeFileSync(path.join(ART, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ PASS: report.PASS.length, FAIL: report.FAIL.length, finalLink: report.finalLink }, null, 2));
  process.exit(report.FAIL.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
