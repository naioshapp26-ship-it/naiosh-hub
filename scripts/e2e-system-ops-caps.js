/**
 * E2E: system-ops capability cards → open section + scroll
 * Run: node scripts/e2e-system-ops-caps.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

const REPORT = [];

async function seedStaff(page) {
  await page.evaluateOnNewDocument(() => {
    const user = { email: 'leader@naiosh.com', name: 'Leader', role: 'supreme_leader' };
    const token = `hub360.${btoa('leader@naiosh.com')}.seed`;
    localStorage.setItem('hubAuthToken', token);
    localStorage.setItem('hubUser', JSON.stringify(user));
  });
}

async function openOps(page, url = `${BASE}/system-ops.html?tab=access`) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const user = { email: 'leader@naiosh.com', name: 'Leader', role: 'supreme_leader' };
    localStorage.setItem('hubAuthToken', `hub360.${btoa('leader@naiosh.com')}.${Date.now()}`);
    localStorage.setItem('hubUser', JSON.stringify(user));
  });
  if (!/system-ops\.html/i.test(page.url())) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }
  await page.waitForSelector('[data-ops-caps] .sysops-cap', { timeout: 15000 });
}

async function main() {
  const ui = fs.readFileSync(path.join(__dirname, '../js/hub-system-ops-ui.js'), 'utf8');
  assert.ok(ui.includes('CAP_TARGETS'));
  assert.ok(ui.includes('scrollToTarget'));
  assert.ok(ui.includes('openCapability'));

  const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  await seedStaff(page);
  await openOps(page);

  const caps = await page.$$eval('[data-ops-caps] .sysops-cap', (els) =>
    els.map((el) => ({
      id: el.getAttribute('data-cap'),
      section: el.getAttribute('data-cap-section') || '',
      label: el.querySelector('strong')?.textContent?.trim() || '',
    }))
  );
  assert.ok(caps.length >= 16, `expected many caps, got ${caps.length}`);

  for (const cap of caps) {
    if (cap.id === 'subdomain-center' || cap.id === 'subdomain-grant') {
      await openOps(page);
      const navigated = await page.evaluate((id) => {
        const el = document.querySelector(`[data-cap="${id}"]`);
        if (!el) return false;
        el.click();
        return true;
      }, cap.id);
      assert.ok(navigated);
      await page.waitForFunction(() => /rent-admin\.html/i.test(location.pathname), { timeout: 10000 });
      REPORT.push({
        card: cap.label,
        id: cap.id,
        target: 'rent-admin.html',
        opened: true,
        scrolled: 'n/a-external',
        desktop: true,
        mobile: false,
      });
      continue;
    }

    await openOps(page);
    assert.ok(cap.section, `cap ${cap.id} must have section`);

    await page.evaluate((id) => {
      window.scrollTo({ top: 0, behavior: 'auto' });
      document.querySelector(`[data-cap="${id}"]`)?.click();
    }, cap.id);

    await page.waitForSelector(`#${cap.section}`, { timeout: 10000 });
    await page.waitForFunction(
      (sectionId, capId) => {
        const el = document.getElementById(sectionId);
        const active = document.querySelector('.sysops-cap.is-active');
        if (!el || !active || active.getAttribute('data-cap') !== capId) return false;
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight || 800;
        return rect.bottom > 48 && rect.top < vh - 16;
      },
      { timeout: 10000 },
      cap.section,
      cap.id
    );

    REPORT.push({
      card: cap.label,
      id: cap.id,
      target: `#${cap.section}`,
      opened: true,
      scrolled: true,
      desktop: true,
      mobile: false,
    });
  }

  await openOps(page);
  await page.screenshot({ path: path.join(OUT, 'system_ops_caps_desktop.png'), fullPage: false });

  await page.setViewport({ width: 390, height: 844 });
  await openOps(page);
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.querySelector('[data-cap="roles-perms"]')?.click();
  });
  await page.waitForSelector('#sysops-access-roles');
  await page.waitForFunction(() => {
    const r = document.getElementById('sysops-access-roles').getBoundingClientRect();
    return r.bottom > 48 && r.top < window.innerHeight - 16;
  });
  await page.screenshot({ path: path.join(OUT, 'system_ops_caps_mobile.png') });
  REPORT.forEach((r) => {
    if (r.id === 'roles-perms') r.mobile = true;
  });

  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.querySelector('[data-cap="membership"]')?.click();
  });
  await page.waitForSelector('#sysops-access-membership');
  await page.waitForFunction(() => {
    const r = document.getElementById('sysops-access-membership').getBoundingClientRect();
    return r.bottom > 48 && r.top < window.innerHeight - 16;
  });
  REPORT.forEach((r) => {
    if (r.id === 'membership') r.mobile = true;
  });

  await openOps(page, `${BASE}/system-ops.html?tab=access#sysops-access-membership`);
  await page.waitForSelector('#sysops-access-membership');
  await page.waitForFunction(() => {
    const r = document.getElementById('sysops-access-membership').getBoundingClientRect();
    return r.bottom > 48 && r.top < window.innerHeight - 16;
  });

  console.log('CARD_REPORT');
  REPORT.forEach((r) => {
    console.log(
      `- ${r.card} → ${r.target} | open=${r.opened} scroll=${r.scrolled} desktop=${r.desktop} mobile=${r.mobile}`
    );
  });
  console.log(`ok: tested ${REPORT.length} capability cards`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
