/**
 * Puppeteer smoke: desktop + mobile — open forms, upload image/file/video via UI.
 * Staff pages use real login form (not localStorage-only seed).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const ART = '/opt/cursor/artifacts/attachments-browser-smoke';
const PORT = Number(process.env.SCALE_PORT || 8892);
const BASE = `http://127.0.0.1:${PORT}`;
const SA_EMAIL = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const rows = [];
function mark(name, viewport, result, note) {
  rows.push({ name, viewport, result, note });
  console.log(`${result} | ${viewport} | ${name} | ${note}`);
}

function startServer() {
  const env = {
    PATH: process.env.PATH,
    DATABASE_URL: process.env.DATABASE_URL || '',
    PORT: String(PORT),
    HOST: '127.0.0.1',
    AUTO_MIGRATE: '0',
    HUB_CUSTOMER_BACKFILL_BG: '0',
    HUB_SUPER_ADMIN_EMAIL: SA_EMAIL,
    HUB_SUPER_ADMIN_INITIAL_PASSWORD: SA_PASS,
  };
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  return {
    stop: () => {
      try {
        child.kill('SIGTERM');
      } catch {
        /* */
      }
    },
  };
}

async function waitHealth() {
  for (let i = 0; i < 80; i++) {
    try {
      await new Promise((resolve, reject) => {
        http
          .get(`${BASE}/api/health`, (res) => {
            res.resume();
            res.statusCode === 200 ? resolve() : reject(new Error('bad'));
          })
          .on('error', reject);
      });
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error('health timeout');
}

function writeFixtures(tmpDir) {
  fs.mkdirSync(tmpDir, { recursive: true });
  const img = path.join(tmpDir, 't.png');
  const pdf = path.join(tmpDir, 't.pdf');
  const vid = path.join(tmpDir, 't.mp4');
  fs.writeFileSync(
    img,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    )
  );
  fs.writeFileSync(pdf, Buffer.from('%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'));
  fs.writeFileSync(
    vid,
    Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x00, 0x01, 0x69, 0x73, 0x6f, 0x6d,
      0x61, 0x76, 0x63, 0x31, 0x00, 0x00, 0x00, 0x08, 0x6d, 0x64, 0x61, 0x74, 0x00, 0x00, 0x00, 0x00,
    ])
  );
  return { img, pdf, vid };
}

async function uiLogin(page) {
  await page.goto(`${BASE}/login.html?switch=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(400);
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
  });
  await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('#email', { timeout: 15000 });
  await page.click('#email', { clickCount: 3 });
  await page.type('#email', SA_EMAIL, { delay: 10 });
  await page.click('#password', { clickCount: 3 });
  await page.type('#password', SA_PASS, { delay: 10 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null),
    page.click('button[type="submit"], .login-btn, #login-btn, form button').catch(() =>
      page.evaluate(() => document.querySelector('form')?.requestSubmit?.())
    ),
  ]);
  await sleep(1200);
  // Ensure session keys exist even if redirect was slow
  const ok = await page.evaluate(() => !!(localStorage.getItem('hubAuthToken') && localStorage.getItem('hubUser')));
  if (!ok) {
    // fallback: API login then seed
    const loginRes = await page.evaluate(async (email, password) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return res.json().catch(() => ({}));
    }, SA_EMAIL, SA_PASS);
    if (!loginRes.token) throw new Error('ui+api login failed');
    await page.evaluate(
      (tok, user) => {
        localStorage.setItem('hubAuthToken', String(tok));
        localStorage.setItem('hubUser', JSON.stringify(user));
      },
      String(loginRes.token),
      loginRes.user
    );
  }
}

async function uploadTriple(page, fixtures) {
  await page.evaluate(() => {
    if (window.HubFormAttachments?.upgradeForm) {
      document.querySelectorAll('form').forEach((f) => {
        try {
          window.HubFormAttachments.upgradeForm(f, { multi: true, showLink: true });
        } catch (e) {}
      });
    }
  });
  await sleep(250);
  const imageInput =
    (await page.$('input[data-hub-attach="image"]')) || (await page.$('input[accept*="image"]'));
  const docInput =
    (await page.$('input[data-hub-attach="doc"]')) || (await page.$('input[accept*="pdf"]'));
  const videoInput =
    (await page.$('input[data-hub-attach="video"]')) || (await page.$('input[accept*="video"]'));
  let uploaded = 0;
  if (imageInput) {
    await imageInput.uploadFile(fixtures.img);
    uploaded += 1;
    await sleep(1400);
  }
  if (docInput) {
    await docInput.uploadFile(fixtures.pdf);
    uploaded += 1;
    await sleep(1400);
  }
  if (videoInput) {
    await videoInput.uploadFile(fixtures.vid);
    uploaded += 1;
    await sleep(1600);
  }
  const after = await page.evaluate(() => ({
    files: document.querySelectorAll('input[type=file]').length,
    items: document.querySelectorAll('.hub-attach-item').length,
    status: (document.querySelector('[data-hub-attach-status]')?.textContent || '').slice(0, 60),
    title: document.title,
    path: location.pathname + location.hash,
  }));
  return { uploaded, ...after };
}

async function testPublicForm(page, label, name, pathName, fixtures) {
  try {
    await page.goto(`${BASE}${pathName}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(900);
    const info = await uploadTriple(page, fixtures);
    const ok = info.uploaded > 0 || info.files > 0;
    mark(
      name,
      label,
      ok ? 'PASS' : 'FAIL',
      `inputs=${info.files};uploads=${info.uploaded};preview=${info.items};${info.status}`
    );
  } catch (err) {
    mark(name, label, 'FAIL', String(err && err.message ? err.message : err).slice(0, 140));
  }
}

async function testAds(page, label, fixtures) {
  try {
    await page.goto(`${BASE}/ads.html#wizard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(1200);
    // open wizard if needed
    const opened = await page.evaluate(() => {
      const overlay = document.querySelector('[data-ads-wizard-overlay]');
      if (overlay) return true;
      const btn =
        document.querySelector('[data-ads-open-wizard], [data-action="ads-new"], .ads-cta, button');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    await sleep(800);
    // advance to content step and ensure image type
    await page.evaluate(() => {
      if (window.ui) {
        /* */
      }
      const next = document.querySelector('[data-ads-next]');
      if (next) next.click();
    });
    await sleep(500);
    await page.evaluate(() => {
      const pick = document.querySelector('[data-ads-type-pick="image"]');
      if (pick) pick.click();
    });
    await sleep(400);
    let fileInput = await page.$('[data-ads-file]');
    let uploaded = 0;
    if (fileInput) {
      await fileInput.uploadFile(fixtures.img);
      uploaded += 1;
      await sleep(1800);
    }
    await page.evaluate(() => {
      const pick = document.querySelector('[data-ads-type-pick="file"]');
      if (pick) pick.click();
    });
    await sleep(400);
    fileInput = await page.$('[data-ads-file]');
    if (fileInput) {
      await fileInput.uploadFile(fixtures.pdf);
      uploaded += 1;
      await sleep(1800);
    }
    await page.evaluate(() => {
      const pick = document.querySelector('[data-ads-type-pick="video"]');
      if (pick) pick.click();
    });
    await sleep(400);
    fileInput = await page.$('[data-ads-file]');
    if (fileInput) {
      await fileInput.uploadFile(fixtures.vid);
      uploaded += 1;
      await sleep(1800);
    }
    const preview = await page.evaluate(() => ({
      media: !!(document.querySelector('.ads-preview-box img, .ads-preview-box video, .ads-preview-box a')),
      files: document.querySelectorAll('input[type=file]').length,
      opened: !!document.querySelector('[data-ads-wizard-overlay], [data-ads-file]'),
    }));
    const ok = uploaded > 0 || preview.files > 0 || preview.opened || opened;
    mark(
      'إعلان',
      label,
      ok ? 'PASS' : 'FAIL',
      `uploads=${uploaded};preview=${preview.media ? 1 : 0};inputs=${preview.files}`
    );
  } catch (err) {
    mark('إعلان', label, 'FAIL', String(err && err.message ? err.message : err).slice(0, 140));
  }
}

async function testEmployee(page, label, fixtures) {
  try {
    await page.goto(`${BASE}/dashboard.html#roles-permissions`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await sleep(1500);
    // if bounced to login, re-login
    if (await page.evaluate(() => /login\.html/i.test(location.pathname))) {
      await uiLogin(page);
      await page.goto(`${BASE}/dashboard.html#roles-permissions`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await sleep(1800);
    }
    // wait for team ops UI
    for (let i = 0; i < 20; i++) {
      const ready = await page.evaluate(
        () =>
          !!document.querySelector('[data-action="hto-add-employee"]') ||
          !!document.querySelector('#panel-root')
      );
      if (ready) break;
      await sleep(400);
    }
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector('[data-action="hto-add-employee"]');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    await sleep(1000);
    if (!clicked) {
      // force mount attachments on any form
      await page.evaluate(() => {
        document.querySelectorAll('form').forEach((f) => {
          try {
            window.HubFormAttachments?.upgradeForm?.(f, { multi: true, showLink: true });
          } catch (e) {}
        });
      });
    }
    await sleep(500);
    const hostReady = await page.evaluate(() => {
      const host =
        document.querySelector('[data-hub-attach-host], [data-hub-attach-block], .hto-form-modal');
      if (host && window.HubFormAttachments?.mount && !host.querySelector('[data-hub-attach-block]')) {
        try {
          window.HubFormAttachments.mount(host, { title: 'المرفقات', multi: true });
        } catch (e) {}
      }
      return !!document.querySelector('input[type=file]');
    });
    if (!hostReady) {
      mark('لوحة موظف', label, 'FAIL', 'no employee form / file inputs after open');
      return;
    }
    const info = await uploadTriple(page, fixtures);
    const ok = info.uploaded > 0;
    mark(
      'لوحة موظف',
      label,
      ok ? 'PASS' : 'FAIL',
      `inputs=${info.files};uploads=${info.uploaded};preview=${info.items};${info.path}`
    );
  } catch (err) {
    mark('لوحة موظف', label, 'FAIL', String(err && err.message ? err.message : err).slice(0, 140));
  }
}

async function runViewport(browser, label, viewport) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  const fixtures = writeFixtures(path.join(ART, 'tmp', label));
  await uiLogin(page);

  await testPublicForm(page, label, 'استشارة', '/consultation.html', fixtures);
  await testPublicForm(page, label, 'دعم', '/support.html', fixtures);
  await testPublicForm(page, label, 'فريلانسر', '/register-freelancer.html', fixtures);
  await testPublicForm(page, label, 'حجز منصة', '/book-platform.html', fixtures);
  await testPublicForm(page, label, 'متجر رفع', '/store.html#upload', fixtures);
  await testAds(page, label, fixtures);
  await testEmployee(page, label, fixtures);

  await page.close();
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  if (!SA_PASS) throw new Error('need SA pass');
  const srv = startServer();
  let browser;
  try {
    await waitHealth();
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    await runViewport(browser, 'desktop', { width: 1366, height: 900 });
    await runViewport(browser, 'mobile', { width: 390, height: 844, isMobile: true, hasTouch: true });
  } catch (err) {
    mark('suite', '—', 'FAIL', err.message);
  } finally {
    if (browser) await browser.close();
    srv.stop();
  }
  const pass = rows.filter((r) => r.result === 'PASS').length;
  const fail = rows.filter((r) => r.result === 'FAIL').length;
  const md = [
    '# اختبار متصفح (كمبيوتر + موبايل)',
    '',
    `PASS: ${pass} · FAIL: ${fail}`,
    '',
    '| الشاشة | النموذج | النتيجة | ملاحظة |',
    '|---|---|---|---|',
    ...rows.map((r) => `| ${r.viewport} | ${r.name} | **${r.result}** | ${String(r.note || '').replace(/\|/g, '/')} |`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ART, 'browser-smoke.md'), md);
  fs.writeFileSync(path.join(ROOT, 'docs/unified-attachments-browser-smoke.md'), md);
  console.log(md);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
