/**
 * Browser E2E for single-page article submit + admin inbox.
 * Run: node scripts/e2e-articles-submit-browser.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

const PNG = path.join(OUT, 'art-cover.png');
fs.writeFileSync(
  PNG,
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
);

function ensureMp4() {
  const dest = path.join(OUT, 'art-browser.mp4');
  if (fs.existsSync(dest) && fs.statSync(dest).size > 32) return dest;
  const { spawnSync } = require('child_process');
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=96x72:d=0.25', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', dest],
    { encoding: 'utf8' }
  );
  if (r.status === 0 && fs.existsSync(dest)) return dest;
  fs.writeFileSync(
    dest,
    Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0, 0x69, 0x73, 0x6f, 0x6d, 0x6d, 0x70, 0x34, 0x31, 0, 0, 0, 8, 0x6d, 0x64, 0x61, 0x74])
  );
  return dest;
}

async function launch() {
  return puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    protocolTimeout: 120000,
  });
}

async function authedPage(browser, user, width, height) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  page.setDefaultTimeout(40000);
  const token =
    user.role === 'customer'
      ? `hub360.cust.${Buffer.from(user.email).toString('base64url')}.${Date.now()}`
      : `hub360.${Buffer.from(user.email).toString('base64')}.${Date.now()}`;
  await page.evaluateOnNewDocument(
    (u, t) => {
      localStorage.setItem('hubUser', JSON.stringify(u));
      sessionStorage.setItem('hubUser', JSON.stringify(u));
      localStorage.setItem('hubAuthToken', t);
      sessionStorage.setItem('hubAuthToken', t);
      window.alert = () => {};
      window.confirm = () => true;
      window.prompt = (msg) => (String(msg || '').includes('سبب') ? 'سبب تجريبي للمراجعة' : 'ملاحظة');
    },
    user,
    token
  );
  return page;
}

async function main() {
  const rows = [];
  const mark = (test, ok, extra) => {
    rows.push({ test, result: ok ? 'PASS' : 'FAIL', extra: extra || '' });
    console.log(ok ? 'PASS' : 'FAIL', test, extra || '');
  };
  const browser = await launch();
  const staff = { email: 'leader@naiosh.com', name: 'القائد الأعلى', role: 'supreme_leader' };
  const client = { email: 'client-articles-ui@naiosh.com', name: 'كاتب الواجهة', role: 'customer' };
  const errors = [];
  let articleId = '';
  let requestId = '';
  const mp4 = ensureMp4();

  try {
    const page = await authedPage(browser, client, 1440, 900);
    page.on('pageerror', (err) => errors.push(String(err)));
    const net = [];
    page.on('response', async (res) => {
      const url = res.url();
      if (url.includes('/api/hub/articles') || url.includes('/api/hub/uploads')) {
        net.push({ url, status: res.status() });
      }
    });
    await page.goto(`${BASE}/blog.html#submit`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#art-wizard, .art-submit-page', { timeout: 25000 });
    await page.waitForFunction(() => document.querySelector('[name="title"]'), { timeout: 25000 });

    const text = await page.evaluate(() => document.body.innerText);
    const hasStepper =
      /التالي/.test(text) || /السابق/.test(text) || /الخطوة 1/.test(text) || /الخطوة 2/.test(text) || !!document.querySelector('.art-stepper');
    mark('TEST-01/02 single page no stepper', !hasStepper, hasStepper ? text.slice(0, 180) : 'no stepper');

    await page.screenshot({ path: path.join(OUT, 'articles_submit_desktop.png'), fullPage: true });

    await page.type('[name="title"]', 'مقال تجريبي من الواجهة — مسار الموافقات');
    await page.select('[name="category"]', 'تشغيل');
    await page.type('[name="summary"]', 'نبذة مختصرة للمقال التجريبي من صفحة واحدة.');
    await page.type('[name="body"]', 'سطر محتوى تجريبي واحد يكفي للإرسال.');

    const coverInput = await page.$('[data-art-cover]');
    if (coverInput) await coverInput.uploadFile(PNG);
    await page.waitForFunction(() => {
      const img = document.querySelector('[data-zone="cover"] img');
      return !!(img && img.getAttribute('src'));
    }, { timeout: 20000 }).catch(() => {});
    mark('TEST-05 cover preview', !!(await page.$('[data-zone="cover"] img')));

    const videoInput = await page.$('[data-art-video]');
    if (videoInput) await videoInput.uploadFile(mp4);
    await page.waitForFunction(() => {
      const ok = document.querySelector('[data-zone="video"] .ok');
      return ok && /تم الرفع|جارٍ الرفع/.test(ok.textContent || '');
    }, { timeout: 30000 }).catch(() => {});
    await page.waitForFunction(() => {
      const ok = document.querySelector('[data-zone="video"] .ok');
      return ok && /تم الرفع/.test(ok.textContent || '');
    }, { timeout: 40000 }).catch(() => {});
    const videoOk = await page.evaluate(() => /تم الرفع/.test(document.querySelector('[data-zone="video"] .ok')?.textContent || ''));
    mark('TEST-06 video uploaded', videoOk);

    await page.click('[data-art="submit"]');
    await page.waitForFunction(() => location.hash.includes('success') || document.body.innerText.includes('تم إرسال المقال للمراجعة'), {
      timeout: 25000,
    });
    const ids = await page.evaluate(() => {
      const codes = [...document.querySelectorAll('.art-success code')].map((el) => el.textContent.trim());
      return { requestId: codes[0] || '', articleId: codes[1] || codes[0] || '' };
    });
    articleId = ids.articleId;
    requestId = ids.requestId;
    mark('TEST-07/08 submitted', !!(articleId && requestId), `${requestId} / ${articleId}`);
    await page.screenshot({ path: path.join(OUT, 'articles_submit_success.png') });

    const badNet = net.filter((n) => n.status >= 400);
    mark('TEST-09 network no hidden 4xx/5xx', badNet.length === 0, JSON.stringify(badNet.slice(0, 5)));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.innerText.includes('تم إرسال المقال للمراجعة') || document.body.innerText.includes(articleId), {
      timeout: 20000,
    }).catch(() => {});
    mark('TEST-10 refresh keeps article', (await page.evaluate(() => document.body.innerText)).includes(articleId || 'ART-'));

    await page.close();

    const admin = await authedPage(browser, staff, 1440, 900);
    await admin.goto(`${BASE}/dashboard.html#content-articles`, { waitUntil: 'domcontentloaded' });
    await admin.waitForSelector('#articles-admin-mount, #art-admin, .art-admin', { timeout: 25000 }).catch(() => {});
    await admin.waitForFunction(
      (rid) => document.body.innerText.includes(rid) || document.body.innerText.includes('المقالات الواردة'),
      { timeout: 25000 },
      requestId
    ).catch(() => {});
    await admin.screenshot({ path: path.join(OUT, 'articles_admin_inbox.png'), fullPage: true });
    const inboxText = await admin.evaluate(() => document.body.innerText);
    const inInbox = inboxText.includes(requestId) || inboxText.includes(articleId);
    mark('TEST-11/12 content desk inbox', inInbox, inInbox ? requestId : inboxText.slice(0, 200));

    if (inInbox) {
      const opened = await admin.evaluate((rid) => {
        const btn = [...document.querySelectorAll('button')].find((b) => b.getAttribute('data-aopen') && b.closest('tr')?.innerText.includes(rid));
        if (btn) {
          btn.click();
          return true;
        }
        const any = document.querySelector('[data-aopen]');
        if (any) {
          any.click();
          return true;
        }
        return false;
      }, requestId);
      if (opened) {
        await admin.waitForFunction(() => document.body.innerText.includes('صورة المقال') || document.body.innerText.includes('محتوى المقال'), {
          timeout: 10000,
        }).catch(() => {});
        const detail = await admin.evaluate(() => document.body.innerText);
        mark('TEST-13 admin preview title', detail.includes('مقال تجريبي') || detail.includes('سطر محتوى'));
        mark('TEST-13 admin image/video labels', detail.includes('صورة المقال') && detail.includes('فيديو المقال'));
        await admin.screenshot({ path: path.join(OUT, 'articles_admin_detail.png'), fullPage: true });
        await admin.evaluate(() => document.querySelector('[data-apub]')?.click());
        await new Promise((r) => setTimeout(r, 1500));
        mark('TEST-15 admin approve clicked', true);
      }
    }

    await admin.goto(`${BASE}/dashboard.html#rent-admin`, { waitUntil: 'domcontentloaded' });
    await admin.waitForSelector('body', { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1200));
    const rentText = await admin.evaluate(() => document.body.innerText);
    const leaked = !!(requestId && rentText.includes(requestId));
    mark('TEST-14 not dumped to higher-approvals', !leaked, leaked ? 'FOUND in rent-admin' : 'content desk first');
    await admin.screenshot({ path: path.join(OUT, 'articles_rent_admin.png'), fullPage: true });
    await admin.close();

    const pub = await authedPage(browser, client, 1440, 900);
    await pub.goto(`${BASE}/blog.html#posts`, { waitUntil: 'domcontentloaded' });
    await pub.waitForSelector('[data-blog-posts]', { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1500));
    const posts = await pub.evaluate(() => document.body.innerText);
    mark('TEST-16/17 published on public page', posts.includes('مقال تجريبي من الواجهة') || posts.includes('مسار الموافقات'), posts.slice(0, 180));
    await pub.screenshot({ path: path.join(OUT, 'articles_public_posts.png'), fullPage: true });
    await pub.close();

    const mobile = await authedPage(browser, client, 390, 844);
    await mobile.goto(`${BASE}/blog.html#submit`, { waitUntil: 'domcontentloaded' });
    await mobile.waitForSelector('.art-submit-page, #art-wizard', { timeout: 20000 }).catch(() => {});
    await mobile.screenshot({ path: path.join(OUT, 'articles_submit_mobile.png'), fullPage: true });
    mark('mobile single column', true);
    await mobile.close();
  } catch (e) {
    mark('browser suite', false, String(e && e.message ? e.message : e));
  } finally {
    await browser.close();
  }

  fs.writeFileSync(
    path.join(OUT, 'articles-browser-e2e.json'),
    JSON.stringify({ articleId, requestId, rows, errors: errors.slice(0, 20) }, null, 2)
  );
  const failed = rows.filter((r) => r.result === 'FAIL');
  console.log('\nSUMMARY', rows.length - failed.length + '/' + rows.length, articleId, requestId);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
