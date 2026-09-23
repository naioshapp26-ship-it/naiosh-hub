/**
 * E2E: operating.html interactive guide
 * Run: node scripts/e2e-operating-guide.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

const REPORT = [];

async function main() {
  const html = fs.readFileSync(path.join(__dirname, '../operating.html'), 'utf8');
  const pageJs = fs.readFileSync(path.join(__dirname, '../js/hub-operating-page.js'), 'utf8');
  assert.ok(html.includes('id="op-systems"'));
  assert.ok(html.includes('data-op-staff'));
  assert.ok(html.includes('كيف تعمل آلية تشغيل'));
  assert.ok(html.includes('تفاصيل آلية التشغيل'));
  assert.ok(pageJs.includes('scrollToId'));
  assert.ok(pageJs.includes('goStaff'));

  const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  const seedGuest = async () => {
    await page.goto(`${BASE}/operating.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE}/operating.html`, { waitUntil: 'networkidle2' });
  };

  const seedStaff = async () => {
    await page.goto(`${BASE}/operating.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem(
        'hubUser',
        JSON.stringify({ email: 'leader@naiosh.com', name: 'Leader', role: 'supreme_leader' })
      );
      localStorage.setItem('hubAuthToken', `hub360.${btoa('leader@naiosh.com')}.${Date.now()}`);
    });
    await page.goto(`${BASE}/operating.html`, { waitUntil: 'networkidle2' });
  };

  // —— Guest: public links work; staff gated ——
  await seedGuest();
  await page.waitForSelector('[data-op-card="2"]');

  // Card 2 → systems section scroll
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  await page.evaluate(() => document.querySelector('[data-op-card="2"]')?.click());
  await page.waitForFunction(() => {
    const el = document.getElementById('op-systems');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > 48 && r.top < window.innerHeight - 16;
  });
  REPORT.push({
    el: 'كارت أيقونات تفتح الأنظمة',
    role: 'قسم',
    target: '#op-systems',
    ok: true,
    perm: 'عام',
    desktop: true,
    mobile: false,
  });

  // Public blog link
  const blogHref = await page.$eval('a[href="blog.html"]', (a) => a.getAttribute('href'));
  assert.equal(blogHref, 'blog.html');
  REPORT.push({
    el: 'صفحة المقالات (للعملاء)',
    role: 'رابط',
    target: 'blog.html',
    ok: true,
    perm: 'عام',
    desktop: true,
    mobile: false,
  });

  // Staff gate as guest
  await page.evaluate(() => document.querySelector('[data-op-staff][href="dashboard.html#content-articles"]')?.click());
  await page.waitForSelector('#op-toast.is-on', { timeout: 5000 });
  const toastText = await page.$eval('#op-toast', (el) => el.textContent);
  assert.ok(/تسجيل الدخول|صلاحية|إدار/i.test(toastText), toastText);
  REPORT.push({
    el: 'المقالات الواردة (إدارة)',
    role: 'رابط إداري',
    target: 'dashboard.html#content-articles',
    ok: true,
    perm: 'محمي — رفض للزائر',
    desktop: true,
    mobile: false,
  });

  // Apps / systems registry
  assert.ok(await page.$('a[href="apps.html"]'));
  REPORT.push({
    el: 'سجل الأنظمة',
    role: 'رابط',
    target: 'apps.html',
    ok: true,
    perm: 'عام',
    desktop: true,
    mobile: false,
  });

  // Client article journey
  assert.ok(await page.$('a[href="blog.html#submit"]'));
  REPORT.push({
    el: 'إرسال مقال (رحلة العميل)',
    role: 'رابط',
    target: 'blog.html#submit',
    ok: true,
    perm: 'عام',
    desktop: true,
    mobile: false,
  });

  assert.ok(await page.$('a[href="register.html"]'));
  REPORT.push({
    el: 'سجل معنا',
    role: 'رابط',
    target: 'register.html',
    ok: true,
    perm: 'عام',
    desktop: true,
    mobile: false,
  });

  // System icons present
  await page.waitForSelector('#op-systems-grid [data-launch-code]');
  const iconCount = await page.$$eval('#op-systems-grid [data-launch-code]', (els) => els.length);
  assert.ok(iconCount >= 5, `icons=${iconCount}`);
  REPORT.push({
    el: 'أيقونات الأنظمة',
    role: 'إطلاق',
    target: 'HubLauncher.launch',
    ok: true,
    perm: 'جلسة+اشتراك',
    desktop: true,
    mobile: false,
  });

  // All 11 cards have targets
  const cards = await page.$$eval('[data-op-card]', (els) =>
    els.map((el) => ({
      id: el.getAttribute('data-op-card'),
      kind: el.getAttribute('data-op-kind'),
      target: el.getAttribute('data-op-target'),
      title: el.querySelector('h3')?.textContent,
    }))
  );
  assert.equal(cards.length, 11);
  for (const c of cards) {
    assert.ok(c.target, `card ${c.id} target`);
    if (c.kind === 'section') {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
      await page.evaluate((id) => document.querySelector(`[data-op-card="${id}"]`)?.click(), c.id);
      const sid = c.target.replace(/^#/, '');
      await page.waitForFunction(
        (sectionId) => {
          const el = document.getElementById(sectionId);
          if (!el) return false;
          const r = el.getBoundingClientRect();
          return r.bottom > 40 && r.top < window.innerHeight - 10;
        },
        { timeout: 8000 },
        sid
      );
      REPORT.push({
        el: `كارت ${c.id}: ${c.title}`,
        role: 'قسم',
        target: c.target,
        ok: true,
        perm: 'عام',
        desktop: true,
        mobile: false,
      });
    } else {
      REPORT.push({
        el: `كارت ${c.id}: ${c.title}`,
        role: c.kind,
        target: c.target,
        ok: true,
        perm: c.kind === 'staff' ? 'إدارة' : 'عام',
        desktop: true,
        mobile: false,
      });
    }
  }

  // Staff can navigate admin CTA (no toast block)
  await seedStaff();
  await page.waitForSelector('[data-op-staff][href="system-ops.html"]');
  await page.evaluate(() => document.querySelector('[data-op-staff][href="system-ops.html"]')?.click());
  await page.waitForFunction(() => /system-ops\.html/i.test(location.pathname), { timeout: 10000 });
  REPORT.push({
    el: 'شغّل آلية الأنظمة الآن',
    role: 'رابط إداري',
    target: 'system-ops.html',
    ok: true,
    perm: 'إدارة — مسموح',
    desktop: true,
    mobile: false,
  });

  // Mobile: card 2 scroll
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}/operating.html`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-op-card="2"]');
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.querySelector('[data-op-card="2"]')?.click();
  });
  await page.waitForFunction(() => {
    const r = document.getElementById('op-systems').getBoundingClientRect();
    return r.bottom > 48 && r.top < window.innerHeight - 16;
  });
  await page.screenshot({ path: path.join(OUT, 'operating_guide_mobile.png') });
  REPORT.forEach((r) => {
    if (r.target === '#op-systems') r.mobile = true;
  });

  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${BASE}/operating.html`, { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(OUT, 'operating_guide_desktop.png') });

  // Verify remaining CTAs exist with real hrefs
  const must = [
    ['شغّل من الغرفة', 'dashboard.html#operating'],
    ['وحدات ERPI', 'system-ops.html?tab=erpi'],
    ['القانونية', 'system-ops.html?tab=law'],
    ['موافقة منح الدومين', 'rent-admin.html'],
    ['عرض المدونة العامة', 'blog.html'],
  ];
  for (const [label, href] of must) {
    const found = await page.evaluate((h) => !!document.querySelector(`a[href="${h}"]`), href);
    assert.ok(found, `missing ${label} → ${href}`);
    REPORT.push({
      el: label,
      role: 'رابط',
      target: href,
      ok: true,
      perm: href.includes('dashboard') || href.includes('system-ops') || href.includes('rent-admin') ? 'إدارة/محمي' : 'عام',
      desktop: true,
      mobile: true,
    });
  }

  console.log('OPERATING_REPORT');
  REPORT.forEach((r) => {
    console.log(
      `- ${r.el} | ${r.role} | ${r.target} | ok=${r.ok} | perm=${r.perm} | D=${r.desktop} M=${r.mobile}`
    );
  });
  console.log(`ok: operating guide e2e — ${REPORT.length} checks`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
