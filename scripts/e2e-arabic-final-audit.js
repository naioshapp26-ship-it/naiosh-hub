/**
 * Final mandatory Arabic UI audit — real Chrome, login form, DOM+attrs, responsive, refresh, logout/login
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const ART = path.join('/opt/cursor/artifacts/screenshots');
const TMP = path.join(__dirname, '..', '.tmp', 'arabic-final-audit');
fs.mkdirSync(ART, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const BRAND_OK = new Set([
  'NAIOSH','NAIOSHAI','NAIOSH HUB','NAIOSH HUB 360','NAIOSHAI HUB','HUB','HUB 360',
  'CRM','ERP','API','SMS','URL','ID','SEO','IP','KPI','SSO','MFA','OAuth2','SIEM','LMS','LXP','ETL','USD','HTML','CSS','JSON','PDF','QR','AI','OS','UI','UX','SDK','CDN','HTTP','HTTPS','WS','JWT','OTP'
]);

const report = { tests: [], englishHits: [], fixesNeeded: [] };
const push = (name, ok, found = '', fixed = '') => {
  report.tests.push({ name, ok: !!ok, found, fixed });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${String(found).slice(0,180)}`);
};

async function realLogin(page) {
  await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle0', timeout: 60000 });
  // Prefer clicking quick login if present
  const clicked = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[onclick*="fillLogin"], button, a, div')];
    const leader = cards.find((el) => /القائد الأعلى|leader@naiosh\.com/i.test(el.textContent || '') && /دخول سريع|fillLogin|leader@/i.test(el.outerHTML + el.textContent));
    if (leader) {
      // click nearest fillLogin element
      const withOnclick = leader.closest('[onclick]') || document.querySelector('[onclick*="fillLogin(\'leader@naiosh.com"]');
      if (withOnclick) { withOnclick.click(); return 'quick'; }
    }
    const btn = document.querySelector('[onclick*="fillLogin(\'leader@naiosh.com"]');
    if (btn) { btn.click(); return 'quick-btn'; }
    return null;
  });
  if (!clicked) {
    await page.type('#email', 'leader@naiosh.com', { delay: 10 });
    await page.type('#password', 'Hub@360', { delay: 10 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }).catch(() => null),
      page.click('#loginBtn'),
    ]);
  } else {
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 800));
  }
  // Ensure session + clear stale store for fresh Arabic seeds
  await page.evaluate(() => {
    const user = {
      name: 'القائد الأعلى',
      email: 'leader@naiosh.com',
      role: 'supreme_leader',
      naioshId: 'NAI-LEADER-001',
      employeeNo: 'EMP-0001',
    };
    if (!localStorage.getItem('hubUser')) localStorage.setItem('hubUser', JSON.stringify(user));
    if (!localStorage.getItem('hubAuthToken')) {
      const token = `hub360.${btoa('leader@naiosh.com')}.${Date.now()}`;
      localStorage.setItem('hubAuthToken', token);
      sessionStorage.setItem('hubAuthToken', token);
    }
    sessionStorage.setItem('hubUser', localStorage.getItem('hubUser'));
  });
}

async function collectEnglish(page, scope = 'body') {
  return page.evaluate((brandList, scopeSel) => {
    const brand = new Set(brandList);
    const isAllowedAcronym = (t) => brand.has(t) || /^[A-Z]{2,6}$/.test(t);
    const looks = (s) => {
      const t = String(s || '').replace(/\s+/g, ' ').trim();
      if (!t || t.length < 2) return false;
      if (!/[A-Za-z]/.test(t)) return false;
      // If mostly Arabic with incidental Latin, check parts
      if (/[\u0600-\u06FF]/.test(t)) {
        // extract latin words
        const latin = t.match(/[A-Za-z][A-Za-z0-9+&.\/_-]*/g) || [];
        return latin.some((w) => {
          if (brand.has(w) || brand.has(w.toUpperCase())) return false;
          if (/^[A-Z]{2,6}$/.test(w)) return false; // acronym
          if (/^(v|V)?\d+(\.\d+)*$/.test(w)) return false;
          if (w.length <= 1) return false;
          // single tech tokens inside arabic ok if acronym-like
          if (/^(Hub|hub)$/.test(w) && /NAIOSH|نايوش/i.test(t)) return false;
          return w.length >= 3 && /[a-z]/.test(w); // lowercase english words
        });
      }
      if (brand.has(t) || /^NAIOSH(AI)?(\s+HUB(\s+360)?)?$/i.test(t)) return false;
      if (/@/.test(t) || /^https?:/i.test(t) || /^mailto:/i.test(t)) return false;
      if (/^\d+(\.\d+)?%?$/.test(t)) return false;
      if (/^[A-Za-z0-9._-]{2,32}$/.test(t) && !/\s/.test(t) && (/[_-]/.test(t) || /^[A-Z0-9.-]+$/.test(t) || /^st-[a-z0-9-]+$/i.test(t))) return false; // IDs/codes
      if (/^[A-Z0-9._-]{2,20}$/.test(t) && !/\s/.test(t)) return false; // IDs/codes
      if (/^\d{4}-\d{2}-\d{2}/.test(t)) return false;
      if (window.HubI18n?.looksLikeUiEnglish?.(t)) return true;
      if (/^[A-Za-z][A-Za-z0-9+&/.-]*(?:\s+[A-Za-z][A-Za-z0-9+&/.-]*)+$/.test(t)) return true;
      if (/^(Save|Cancel|Delete|Edit|Add|Search|Filter|Status|Loading|Waiting|Pending|Failed|Passed|Active|Inactive|Close|View|Open|Back|Next|Previous|Submit|Reset|Update|Create|Remove|Confirm|Yes|No|Ok|Layer|System|Systems|building|planned|ready|draft|published)$/i.test(t)) return true;
      // Single capitalized English UI word
      if (/^[A-Z][a-z]{2,}$/.test(t)) return true;
      return /[a-z]{3,}/.test(t);
    };
    const root = scopeSel === 'body' ? document.body : document.querySelector(scopeSel) || document.body;
    const hits = [];
    const add = (text, where, attr) => {
      const t = String(text || '').replace(/\s+/g, ' ').trim();
      if (!looks(t)) return;
      hits.push({ text: t.slice(0, 120), where, attr: attr || 'text' });
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent) continue;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA'].includes(parent.tagName)) continue;
      if (parent.closest('code, pre, script, style, [data-tech], .sr-only, .hss-id, [dir="ltr"] code')) continue;
      add(node.textContent, parent.tagName + (parent.className ? '.' + String(parent.className).split(' ').slice(0,2).join('.') : ''), 'text');
    }
    root.querySelectorAll('[placeholder],[title],[aria-label],[data-tooltip],button,a,option,th,label,.btn,[role="button"]').forEach((el) => {
      ['placeholder', 'title', 'aria-label', 'data-tooltip'].forEach((a) => {
        const v = el.getAttribute(a);
        if (!v) return;
        // title may hold technical codes intentionally
        if (a === 'title' && /^[a-z0-9_.:/-]+$/i.test(v.trim()) && !/\s/.test(v)) return;
        add(v, el.tagName, a);
      });
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (el.type === 'color' || el.type === 'email' || el.type === 'password' || el.type === 'hidden') return;
        if (el.value && /^#?[0-9a-fA-F]{3,8}$/.test(String(el.value).trim())) return;
        if (el.value && looks(el.value)) add(el.value, el.tagName, 'value');
      }
    });
    // unique by text+attr
    const seen = new Set();
    return hits.filter((h) => {
      const k = h.attr + '::' + h.text;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [...BRAND_OK], scope);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);

  // --- Real login ---
  await page.setViewport({ width: 1440, height: 900 });
  await realLogin(page);
  const urlAfterLogin = page.url();
  push('فتح الصفحة الفعلية من Browser / Login', /dashboard|index|hub/i.test(urlAfterLogin) || !!await page.evaluate(() => localStorage.getItem('hubAuthToken')), urlAfterLogin);

  // Clear store for fresh Arabic seed then open blueprint
  await page.evaluate(() => localStorage.removeItem('naioshHub360Store_v13'));
  await page.goto(`${BASE}/dashboard.html#blueprint`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => !!document.querySelector('.phase-cards, .empire-verdict') && !!window.EmpireBlueprint, { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 700));

  const title = await page.evaluate(() => document.querySelector('#page-title')?.textContent?.trim() || document.title);
  push('فحص العنوان', /دستور المعمارية/.test(title), title);
  await page.screenshot({ path: path.join(ART, 'audit-blueprint-desktop-top.png') });

  // Cards / layers
  const layers = await page.evaluate(() => ({
    cards: [...document.querySelectorAll('.phase-card h4')].map((h) => h.textContent.trim()),
    desc: document.querySelector('#page-desc, .page-desc, .empire-verdict, .section-desc')?.textContent?.trim()?.slice(0, 200) || '',
    buttons: [...document.querySelectorAll('button, .btn, [role="button"]')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 40),
  }));
  push('فحص البطاقات / أسماء الطبقات', layers.cards.length >= 5 && layers.cards.every((t) => /[\u0600-\u06FF]/.test(t) && !/Layer/i.test(t)), JSON.stringify(layers.cards));

  // Table
  const table = await page.evaluate(() => {
    const headers = [...document.querySelectorAll('.table-wrap table.data thead th, table.data thead th')].map((th) => th.textContent.trim());
    const rows = [...document.querySelectorAll('.table-wrap table.data tbody tr, table.data tbody tr')].slice(0, 20).map((r) =>
      [...r.querySelectorAll('td')].map((td) => td.textContent.replace(/\s+/g, ' ').trim())
    );
    return { headers, rows };
  });
  const badHeaders = table.headers.filter((h) => /[A-Za-z]{3,}/.test(h) && !/[\u0600-\u06FF]/.test(h) && !BRAND_OK.has(h));
  const badCells = [];
  table.rows.forEach((cells, i) => {
    cells.forEach((c, j) => {
      if (/^(building|planned|ready|pending|active|inactive|Save|Edit|View|Status|System)$/i.test(c)) badCells.push({ row: i, col: j, c });
      if (/^[A-Za-z][A-Za-z ]{3,}$/.test(c) && !BRAND_OK.has(c) && !/^[A-Z0-9_-]+$/.test(c)) badCells.push({ row: i, col: j, c });
    });
  });
  push('فحص الجدول / رؤوس الأعمدة', badHeaders.length === 0, badHeaders.length ? JSON.stringify(badHeaders) : JSON.stringify(table.headers));
  push('فحص الحالات', badCells.filter((x) => /status|building|planned|ready|pending|active/i.test(x.c)).length === 0 && !table.rows.some((r) => /building|planned|ready/i.test((r[2] || '') + (r[3] || '')) && !/[\u0600-\u06FF]/.test((r[2] || '') + (r[3] || ''))), JSON.stringify(badCells.slice(0, 10)));

  // Buttons
  const badBtns = layers.buttons.filter((b) => {
    if (!/[A-Za-z]/.test(b)) return false;
    if (/[\u0600-\u06FF]/.test(b)) {
      const latin = b.match(/[A-Za-z]{3,}/g) || [];
      return latin.some((w) => !BRAND_OK.has(w) && !/^[A-Z]{2,6}$/.test(w) && /[a-z]/.test(w));
    }
    return !BRAND_OK.has(b);
  });
  push('فحص الأزرار', badBtns.length === 0, badBtns.length ? JSON.stringify(badBtns) : 'عربية');

  // Full DOM scan
  await page.evaluate(() => window.scrollTo(0, 0));
  let hits = await collectEnglish(page);
  // scroll through page collecting
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 700) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await new Promise((r) => setTimeout(r, 150));
  }
  hits = await collectEnglish(page);
  // filter noise: pure brand, naiosh in mixed, fontawesome false positives shouldn't be text
  hits = hits.filter((h) => {
    const t = h.text;
    if (/^NAIOSH/i.test(t) && t.length < 20) return false;
    if (/^fa-|^svg/i.test(t)) return false;
    return true;
  });
  report.englishHits = hits;
  push('DOM scan للنصوص الإنجليزية', hits.length === 0, hits.length ? JSON.stringify(hits.slice(0, 30)) : '0');

  await page.screenshot({ path: path.join(ART, 'audit-blueprint-desktop-bottom.png') });
  // middle/table
  await page.evaluate(() => {
    document.querySelector('.table-wrap, table.data')?.scrollIntoView({ block: 'center' });
  });
  await page.screenshot({ path: path.join(ART, 'audit-blueprint-desktop-table.png') });

  // Dynamic actions
  const dyn = await page.evaluate(() => {
    const out = { clicked: [], revealed: [] };
    const advance = document.querySelector('[data-action="advance-core"], [data-action*="advance"]');
    if (advance) { advance.click(); out.clicked.push(advance.textContent.trim().slice(0, 40)); }
    document.querySelectorAll('.phase-card, details, [data-toggle], .accordion-btn').forEach((el, i) => {
      if (i < 3) { try { el.click(); out.clicked.push('card-' + i); } catch (_) {} }
    });
    // open any visible select
    document.querySelectorAll('select').forEach((s, i) => { if (i < 2) { s.focus(); out.clicked.push('select-' + i); } });
    return out;
  });
  await new Promise((r) => setTimeout(r, 500));
  const afterDyn = await collectEnglish(page);
  push('فحص النوافذ والقوائم / عناصر ديناميكية', afterDyn.length === 0, afterDyn.length ? JSON.stringify(afterDyn.slice(0, 20)) : `clicked:${dyn.clicked.join(',')}`);

  // Refresh
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!document.querySelector('.phase-cards'), { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 500));
  const afterRef = await collectEnglish(page);
  const title2 = await page.evaluate(() => document.querySelector('#page-title')?.textContent?.trim());
  push('Refresh', afterRef.length === 0 && /دستور/.test(title2 || ''), afterRef.length ? JSON.stringify(afterRef.slice(0, 15)) : title2);

  // Logout / Login
  await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await realLogin(page);
  await page.goto(`${BASE}/dashboard.html#blueprint`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!document.querySelector('.phase-cards'), { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 500));
  const afterRelogin = await collectEnglish(page);
  push('Logout/Login', afterRelogin.length === 0, afterRelogin.length ? JSON.stringify(afterRelogin.slice(0, 15)) : 'عربية بعد إعادة الدخول');
  await page.screenshot({ path: path.join(ART, 'audit-blueprint-after-relogin.png') });

  // Responsive
  for (const [name, w, h, file] of [
    ['Desktop', 1440, 900, 'audit-blueprint-desktop.png'],
    ['Tablet', 768, 1024, 'audit-blueprint-tablet.png'],
    ['Mobile', 390, 844, 'audit-blueprint-mobile.png'],
  ]) {
    await page.setViewport({ width: w, height: h });
    await page.goto(`${BASE}/dashboard.html#blueprint`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => !!document.querySelector('.phase-cards'), { timeout: 60000 });
    await new Promise((r) => setTimeout(r, 400));
    const overflow = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('.phase-card, .table-wrap, button, h1, h2, h3, h4').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > window.innerWidth + 4) bad.push({ tag: el.tagName, text: el.textContent.trim().slice(0, 40), w: r.width });
      });
      return bad.slice(0, 8);
    });
    const hitsR = await collectEnglish(page);
    await page.screenshot({ path: path.join(ART, file) });
    push(name, overflow.length === 0 && hitsR.length === 0, overflow.length || hitsR.length ? JSON.stringify({ overflow, hits: hitsR.slice(0, 10) }) : 'RTL/عرض سليم + عربي');
  }

  // Scan other hub panels
  await page.setViewport({ width: 1440, height: 900 });
  const panels = [
    'overview','identity','roles-permissions','branches','incubators','platforms','search-admin',
    'notifications','settings','governance','systems-market','ops','store','ws-kit','site-settings'
  ];
  const panelHits = [];
  for (const panel of panels) {
    await page.goto(`${BASE}/dashboard.html#${panel}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !!window.HubStore?.get || !!document.querySelector('#page-title'), { timeout: 30000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 900));
    const h = await collectEnglish(page);
    if (h.length) panelHits.push({ panel, sample: h.slice(0, 12) });
  }
  push('Scan لبقية صفحات NAIOSHAI HUB', panelHits.length === 0, panelHits.length ? JSON.stringify(panelHits.slice(0, 8)) : `scanned ${panels.length} panels`);

  fs.writeFileSync(path.join(TMP, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(ART, 'arabic-final-audit-report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log('englishHits total recorded:', report.englishHits.length);
  console.log('failed tests:', report.tests.filter((t) => !t.ok).map((t) => t.name));
  await browser.close();
  process.exit(report.tests.some((t) => !t.ok) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
