/**
 * Layout E2E: roles-permissions team table — no desktop H-scroll
 * node scripts/e2e-team-table-layout.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const ART = path.join(ROOT, '.tmp', 'team-layout');
const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
fs.mkdirSync(ART, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop-1366', width: 1366, height: 900, mode: 'desktop' },
  { name: 'desktop-1440', width: 1440, height: 900, mode: 'desktop' },
  { name: 'desktop-1920', width: 1920, height: 1080, mode: 'desktop' },
  { name: 'tablet-900', width: 900, height: 1024, mode: 'tablet' },
  { name: 'mobile-390', width: 390, height: 844, mode: 'mobile' },
];

const COLS = ['الموظف', 'رقم الموظف', 'رقم نايوش', 'مكان العمل', 'النظام', 'الدور', 'الصلاحيات', 'الحالة', 'آخر تعديل', 'الإجراءات'];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  const tests = [];
  const push = (n, ok, d) => tests.push({ n, ok: !!ok, d: d == null ? '' : String(d) });

  await page.setViewport({ width: 1366, height: 900 });
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    const user = {
      name: 'القائد الأعلى',
      email: 'leader@naiosh.com',
      role: 'supreme_leader',
      naioshId: 'NAI-LEADER-001',
      employeeNo: 'EMP-0001',
    };
    localStorage.setItem('hubUser', JSON.stringify(user));
    sessionStorage.setItem('hubUser', JSON.stringify(user));
    const token = `hub360.${btoa('leader@naiosh.com')}.${Date.now()}`;
    localStorage.setItem('hubAuthToken', token);
    sessionStorage.setItem('hubAuthToken', token);
  });
  await page.goto(`${BASE}/dashboard.html#roles-permissions`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!document.querySelector('.hto-table-team, [data-hto-root]'), { timeout: 45000 });
  await new Promise((r) => setTimeout(r, 1000));

  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise((r) => setTimeout(r, 400));
    const shot = path.join(ART, `${vp.name}.png`);
    await page.screenshot({ path: shot, fullPage: true });

    const metrics = await page.evaluate(() => {
      const wrap = document.querySelector('.hto-table-wrap--team');
      const table = document.querySelector('.hto-table-team');
      const cards = document.querySelector('.hto-team-cards');
      const root = document.querySelector('.hto-root') || document.querySelector('.hub-team-ops-ws');
      const main = document.querySelector('.main');
      const panel = document.querySelector('.hto-panel-team');
      const actions = document.querySelector('.hto-table-team td.col-act .hto-actions');
      const ths = [...document.querySelectorAll('.hto-table-team thead th')].map((th) => th.textContent.trim());
      const wrapStyle = wrap ? getComputedStyle(wrap) : null;
      const cardsStyle = cards ? getComputedStyle(cards) : null;
      const tableVisible = !!(table && wrap && wrapStyle && wrapStyle.display !== 'none');
      const cardsVisible = !!(cards && cardsStyle && cardsStyle.display !== 'none' && cardsStyle.display !== '');
      let scrollW = 0;
      let clientW = 0;
      let hasHScroll = false;
      if (wrap && tableVisible) {
        scrollW = wrap.scrollWidth;
        clientW = wrap.clientWidth;
        hasHScroll = scrollW > clientW + 1;
      }
      let actionsVisible = false;
      let actionsClipped = false;
      if (actions && tableVisible) {
        const r = actions.getBoundingClientRect();
        const wrapR = wrap.getBoundingClientRect();
        actionsVisible = r.width > 0 && r.right <= window.innerWidth + 1 && r.left >= -1;
        actionsClipped = r.right > wrapR.right + 2 || r.left < wrapR.left - 2;
        // also verify primary buttons exist
        const btns = [...actions.querySelectorAll('button')];
        actionsVisible = actionsVisible && btns.length >= 2 && btns.every((b) => {
          const br = b.getBoundingClientRect();
          return br.width > 0 && br.height > 0 && br.right <= wrapR.right + 2;
        });
      }
      // Prefer table scrollWidth vs clientWidth only when overflow is scrollable
      const canScrollX = wrap && tableVisible ? wrap.scrollWidth > wrap.clientWidth + 1 && getComputedStyle(wrap).overflowX !== 'hidden' && getComputedStyle(wrap).overflowX !== 'clip' : false;
      const contentOverflow = wrap && tableVisible ? wrap.scrollWidth > wrap.clientWidth + 2 : false;
      const rootW = root?.getBoundingClientRect().width || 0;
      const mainW = main?.getBoundingClientRect().width || 0;
      const panelW = panel?.getBoundingClientRect().width || 0;
      const wasted = mainW && panelW ? mainW - panelW : 0;
      return {
        tableVisible,
        cardsVisible,
        hasHScroll: canScrollX || (contentOverflow && actionsClipped),
        contentOverflow,
        actionsClipped,
        scrollW,
        clientW,
        actionsVisible,
        ths,
        rootW,
        mainW,
        panelW,
        wasted,
        dir: document.documentElement.dir,
        rowCount: document.querySelectorAll('.hto-table-team tbody tr').length,
        cardCount: document.querySelectorAll('.hto-staff-card').length,
      };
    });

    push(`${vp.name}-rtl`, metrics.dir === 'rtl', metrics.dir);
    if (vp.mode === 'desktop') {
      push(`${vp.name}-table-visible`, metrics.tableVisible, JSON.stringify({ tableVisible: metrics.tableVisible }));
      push(`${vp.name}-no-hscroll`, !metrics.hasHScroll, `scroll=${metrics.scrollW} client=${metrics.clientW} overflow=${metrics.contentOverflow} clipped=${metrics.actionsClipped}`);
      push(`${vp.name}-all-cols`, COLS.every((c) => metrics.ths.includes(c)), metrics.ths.join('|'));
      push(`${vp.name}-actions-visible`, metrics.actionsVisible && !metrics.actionsClipped, `clipped=${metrics.actionsClipped}`);
      push(`${vp.name}-full-width`, metrics.wasted < 48, `main=${Math.round(metrics.mainW)} panel=${Math.round(metrics.panelW)} waste=${Math.round(metrics.wasted)}`);
      push(`${vp.name}-cards-hidden`, !metrics.cardsVisible, '');
    } else if (vp.mode === 'mobile') {
      push(`${vp.name}-cards-visible`, metrics.cardsVisible || metrics.cardCount > 0, JSON.stringify(metrics));
      push(`${vp.name}-table-hidden`, !metrics.tableVisible, '');
    } else {
      // tablet at 900px uses cards per CSS max-width 900
      push(`${vp.name}-layout-ok`, metrics.cardsVisible || (metrics.tableVisible && !metrics.hasHScroll), JSON.stringify(metrics));
    }
  }

  const failed = tests.filter((t) => !t.ok);
  const report = { ok: failed.length === 0, failed: failed.length, total: tests.length, tests, art: ART };
  fs.writeFileSync(path.join(ART, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
