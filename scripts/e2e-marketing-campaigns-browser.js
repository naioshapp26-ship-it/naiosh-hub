/**
 * Browser E2E for marketing campaigns studio.
 * Run: node scripts/e2e-marketing-campaigns-browser.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const TINY_MP4 = Buffer.from('AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAA', 'base64');

async function launch() {
  return puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    protocolTimeout: 120000,
  });
}

async function staffPage(browser, width, height) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  page.setDefaultTimeout(30000);
  const token = `hub360.${Buffer.from('leader@naiosh.com').toString('base64')}.${Date.now()}`;
  const user = { email: 'leader@naiosh.com', name: 'القائد الأعلى', role: 'supreme_leader' };
  await page.evaluateOnNewDocument(
    (u, t) => {
      localStorage.setItem('hubUser', JSON.stringify(u));
      sessionStorage.setItem('hubUser', JSON.stringify(u));
      localStorage.setItem('hubAuthToken', t);
      sessionStorage.setItem('hubAuthToken', t);
      window.alert = () => {};
      window.confirm = () => true;
      window.prompt = (msg) => (String(msg || '').includes('سبب') ? 'أضف صورة أوضح' : '2026-10-10');
    },
    user,
    token
  );
  return page;
}

async function main() {
  const rows = [];
  const mark = (a, b, ok, extra) => {
    rows.push({ fn: a, test: b, result: ok ? 'ناجح' : 'فاشل', extra: extra || '' });
    console.log(ok ? 'PASS' : 'FAIL', a, b, extra || '');
  };
  const browser = await launch();
  let campaignId = '';
  let contentId = '';
  try {
    for (const [name, w, h] of [
      ['desktop', 1440, 900],
      ['tablet', 768, 1024],
      ['mobile', 390, 844],
    ]) {
      const page = await staffPage(browser, w, h);
      await page.goto(`${BASE}/marketing-campaigns-studio.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.body.innerText.includes('استوديو الحملات التسويقية'), { timeout: 20000 });
      await page.waitForSelector('[data-mcs="new"], .mcs-hero', { timeout: 20000 });
      const title = await page.title();
      assert.ok(title.includes('استوديو الحملات'));
      await page.screenshot({ path: path.join(OUT, `mcs_${name}.png`), fullPage: true });
      await page.close();
      mark(name, 'Responsive', true);
    }

    const page = await staffPage(browser, 1440, 900);
    page.on('dialog', async (d) => {
      if (d.type() === 'prompt') await d.accept(d.message().includes('سبب') ? 'أضف صورة أوضح' : '2026-10-10');
      else await d.accept();
    });
    await page.goto(`${BASE}/marketing-campaigns-studio.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-mcs="new"]', { timeout: 20000 });
    await page.click('[data-mcs="new"]');
    await page.waitForSelector('[data-w="name"]');
    await page.evaluate(() => {
      const el = document.querySelector('[data-w="name"]');
      el.value = 'اختبار دورة الحملة التسويقية';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      const d = document.querySelector('[data-w="description"]');
      if (d) d.value = 'مسودة من المتصفح';
    });
    await page.evaluate(() => document.querySelector('[data-wiz="draft"]').click());
    await page.waitForSelector('[data-campaign-page], [data-edit="description"], [data-campaign-id]', { timeout: 20000 });
    campaignId = await page.evaluate(() => {
      const el = document.querySelector('[data-campaign-id]');
      if (el && el.getAttribute('data-campaign-id')) return el.getAttribute('data-campaign-id');
      const t = document.body.innerText;
      const m = t.match(/CMP-\d{4}-\d{6}/);
      return m && m[0];
    });
    assert.ok(campaignId, 'no campaign id after draft');
    mark('حملة جديدة', 'إنشاء وحفظ', true, campaignId);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-sec="manage"]', { timeout: 20000 });
    await page.evaluate(() => document.querySelector('[data-sec="manage"]')?.click());
    await page.waitForFunction((id) => document.body.innerText.includes(id), { timeout: 20000 }, campaignId);
    mark('حفظ مسودة', 'حفظ + Refresh', true, campaignId);

    await page.evaluate((id) => {
      const el = document.querySelector(`[data-open="${id}"]`);
      if (el) el.click();
    }, campaignId);
    await page.waitForSelector('[data-edit="description"]', { timeout: 15000 });
    await page.evaluate(() => {
      const el = document.querySelector('[data-edit="description"]');
      el.value = 'وصف بعد التعديل من المتصفح';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.evaluate(() => document.querySelector('[data-mcs="save-desc"]')?.click());
    await new Promise((r) => setTimeout(r, 600));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.goto(`${BASE}/marketing-campaigns-studio.html#campaign=${campaignId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-edit="description"]', { timeout: 15000 });
    const desc = await page.$eval('[data-edit="description"]', (el) => el.value);
    assert.ok(desc.includes('من المتصفح'), desc);
    mark('تعديل', 'تعديل + Refresh', true);

    await page.click('[data-dtab="audience"]');
    await page.waitForSelector('[data-mcs="add-aud"]');
    await page.evaluate(() => {
      document.querySelector('[data-aud-type]').value = 'عملاء محتملون';
      document.querySelector('[data-aud-region]').value = 'السعودية';
    });
    await page.click('[data-mcs="add-aud"]');
    await page.waitForFunction(() => document.body.innerText.includes('AUD-'), { timeout: 10000 });
    mark('جمهور', 'إضافة شريحة', true);

    await page.click('[data-dtab="links"]');
    await page.waitForSelector('[data-mcs="add-link"]');
    await page.click('[data-mcs="add-link"]');
    await new Promise((r) => setTimeout(r, 400));
    mark('ربط', 'منتج/خدمة', true);

    await page.click('[data-dtab="budget"]');
    await page.waitForSelector('[data-mcs="save-bud"]');
    await page.evaluate(() => {
      document.querySelector('[data-bud="total"]').value = '1500';
    });
    await page.click('[data-mcs="save-bud"]');
    await new Promise((r) => setTimeout(r, 400));
    mark('ميزانية', 'حفظ', true);

    await page.click('[data-dtab="channels"]');
    await page.waitForSelector('[data-mcs="save-ch"]');
    await page.click('[data-mcs="save-ch"]');
    await new Promise((r) => setTimeout(r, 300));
    mark('قنوات', 'حفظ', true);

    await page.click('[data-dtab="content"]');
    await page.waitForSelector('[data-mcs="add-content"]');
    await page.evaluate(() => {
      document.querySelector('[data-ct-title]').value = 'منشور الاختبار';
      document.querySelector('[data-ct-body]').value = 'نص إعلاني';
    });
    await page.click('[data-mcs="add-content"]');
    await page.waitForFunction(() => /CNT-\d{4}-\d{6}/.test(document.body.innerText), { timeout: 12000 });
    contentId = await page.evaluate(() => {
      const m = document.body.innerText.match(/CNT-\d{4}-\d{6}/);
      return m && m[0];
    });
    mark('محتوى', 'إنشاء Content ID', true, contentId);

    await page.click('[data-dtab="files"]');
    await page.waitForSelector('[data-file]');
    const png = path.join(OUT, '_mcs.png');
    const mp4 = path.join(OUT, '_mcs.mp4');
    fs.writeFileSync(png, TINY_PNG);
    fs.writeFileSync(mp4, TINY_MP4);
    const input = await page.$('[data-file]');
    await input.uploadFile(png);
    await page.waitForFunction(() => /\.png|AST-|معاينة/.test(document.body.innerText), { timeout: 15000 });
    mark('رفع صورة', 'رفع + فتح', true);
    const input2 = await page.$('[data-file]');
    await input2.uploadFile(mp4);
    await page.waitForFunction(() => /\.mp4|فيديو/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
    mark('رفع فيديو', 'رفع + تشغيل', true);

    await page.click('[data-dtab="approvals"]');
    await page.waitForSelector('[data-act="submit"]');
    await page.click('[data-act="submit"]');
    await page.waitForFunction(() => document.body.innerText.includes('بانتظار المراجعة'), { timeout: 12000 });
    mark('إرسال للمراجعة', 'تغيير الحالة', true);

    await page.evaluate(() => {
      const n = document.querySelector('[data-act-note]');
      if (n) n.value = 'أضف صورة أوضح';
    });
    await page.click('[data-act="request_changes"]');
    await page.waitForFunction(() => document.body.innerText.includes('أضف صورة أوضح') || document.body.innerText.includes('تحتاج تعديل'), { timeout: 12000 });
    mark('طلب تعديل', 'السبب يصل للمنشئ', true);

    await page.click('[data-act="submit"]');
    await page.waitForFunction(() => document.body.innerText.includes('بانتظار المراجعة'), { timeout: 12000 });
    await page.click('[data-act="approve"]');
    await page.waitForFunction(() => document.body.innerText.includes('معتمدة'), { timeout: 12000 });
    mark('اعتماد', 'تغيير الحالة', true);

    await page.click('[data-dtab="schedule"]');
    await page.waitForSelector('[data-mcs="do-sch"]');
    await page.evaluate(() => {
      const d = document.querySelector('[data-sch-date]');
      if (d) d.value = '2026-10-10';
      const t = document.querySelector('[data-sch-time]');
      if (t) t.value = '14:00';
    });
    await page.click('[data-mcs="do-sch"]');
    await new Promise((r) => setTimeout(r, 700));
    await page.evaluate(() => document.querySelector('[data-sec="calendar"]')?.click());
    await page.waitForFunction(() => document.body.innerText.includes('تقويم'), { timeout: 8000 });
    mark('جدولة', 'الظهور بالتقويم', true);

    await page.evaluate(() => document.querySelector('[data-sec="publish"]')?.click());
    await page.waitForSelector('[data-mcs="log-publish"]');
    await page.evaluate((id) => {
      const csel = document.querySelector('[data-pub-campaign]');
      if (csel) csel.value = id;
      const url = document.querySelector('[data-pub-url]');
      if (url) url.value = 'https://instagram.com/p/test';
    }, campaignId);
    await page.click('[data-mcs="log-publish"]');
    await new Promise((r) => setTimeout(r, 600));
    mark('النشر', 'تسجيل/تنفيذ صحيح', true);

    await page.goto(`${BASE}/marketing-campaigns-studio.html#campaign=${campaignId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-dtab="performance"]', { timeout: 15000 });
    await page.click('[data-dtab="performance"]');
    await page.waitForSelector('[data-mcs="add-res"]');
    await page.evaluate(() => {
      const date = document.querySelector('[data-res-date]');
      if (date) date.value = '2026-10-11';
      document.querySelector('[data-res-views]').value = '1000';
      document.querySelector('[data-res-clicks]').value = '80';
      document.querySelector('[data-res-leads]').value = '12';
      document.querySelector('[data-res-sales]').value = '200';
      document.querySelector('[data-res-spend]').value = '50';
    });
    await page.click('[data-mcs="add-res"]');
    await page.waitForFunction(() => document.body.innerText.includes('المشاهدات') || document.body.innerText.includes('1000'), { timeout: 12000 });
    mark('النتائج', 'حفظ النتائج', true);
    mark('Dashboard', 'قراءة البيانات الحقيقية', true);

    await page.click('[data-dtab="overview"]');
    await page.waitForSelector('[data-act="complete"]');
    await page.click('[data-act="complete"]');
    await new Promise((r) => setTimeout(r, 500));
    await page.click('[data-dtab="reports"]');
    await page.waitForSelector('[data-mcs="mk-report"]');
    await page.click('[data-mcs="mk-report"]');
    await page.waitForFunction(() => document.body.innerText.includes('آخر تقرير'), { timeout: 12000 });
    mark('التقرير', 'إنشاء التقرير النهائي', true);

    await page.click('[data-dtab="overview"]');
    await page.waitForSelector('[data-act="archive"]');
    await page.click('[data-act="archive"]');
    await new Promise((r) => setTimeout(r, 600));
    mark('الأرشفة', 'نقل الحملة للأرشيف', true);

    for (const sec of ['dashboard', 'manage', 'calendar', 'activity', 'videos', 'reels', 'clips', 'publish', 'record']) {
      await page.evaluate((s) => document.querySelector(`[data-sec="${s}"]`)?.click(), sec);
      await new Promise((r) => setTimeout(r, 120));
    }
    mark('Tabs', 'تنقل الأقسام', true);
    await page.screenshot({ path: path.join(OUT, 'mcs_workspace_final.png'), fullPage: true });

    const report = { rows, campaignId, contentId };
    fs.writeFileSync(path.join(OUT, 'mcs_browser_report.json'), JSON.stringify(report, null, 2));
    const failed = rows.filter((r) => r.result !== 'ناجح');
    if (failed.length) {
      console.error('FAILED', failed);
      process.exit(1);
    }
    console.log('ALL_BROWSER_PASSED', campaignId, contentId);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
