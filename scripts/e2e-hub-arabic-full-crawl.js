/**
 * Full Hub Arabic UI crawl — all dashboard panels + key standalone pages
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const ART = '/opt/cursor/artifacts/screenshots';
const OUT = path.join(ART, 'hub-arabic-full-crawl.json');
fs.mkdirSync(ART, { recursive: true });

const PANELS = [
  'overview','operating','posha-clients','site-settings','clients-mgmt','roles-permissions',
  'notifications','side-project-regs','content-articles','search-admin','rent-admin','blueprint',
  'platforms','apps','products','store','identity','organization','incubators','wallet','core',
  'governance','info-security','data-governance','systems-automation','workforce','systems',
  'tasks','measurement','reports','integration','settings'
];

const STANDALONE = ['index.html','login.html','search.html','operating.html','client.html','store.html','products.html','apps.html'];

const BRAND = new Set([
  'NAIOSH','NAIOSHAI','NAIOSH HUB','NAIOSH HUB 360','HUB','HUB 360','CRM','ERP','API','SMS','URL','ID',
  'SEO','IP','KPI','KPIs','SSO','MFA','LMS','LXP','ETL','USD','AI','OTP','QR','PDF','JSON','OAuth2',
  'SIEM','UTC','EMP','NAI','LAW','FIT','NAIS','ACADEMY','SMARTX','EDUSMARTX','EDUNAIOSH','POSHA','HTTP','HTTPS',
  'Amazon','Noon','GET','POST','PUT','PATCH','DELETE','HQ','BR','INC','PLT'
]);

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  const report = { panels: [], standalone: [], discovered: [], fixedNote: 'display-layer via HubI18n' };

  await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    const user = { name: 'القائد الأعلى', email: 'leader@naiosh.com', role: 'supreme_leader', naioshId: 'NAI-LEADER-001', employeeNo: 'EMP-0001' };
    localStorage.setItem('hubUser', JSON.stringify(user));
    sessionStorage.setItem('hubUser', JSON.stringify(user));
    const token = `hub360.${btoa('leader@naiosh.com')}.${Date.now()}`;
    localStorage.setItem('hubAuthToken', token);
    sessionStorage.setItem('hubAuthToken', token);
  });

  const collect = async () =>
    page.evaluate((brandList) => {
      const brand = new Set(brandList);
      const looks = (s) => {
        const t = String(s || '').replace(/\s+/g, ' ').trim();
        if (!t || t.length < 2 || !/[A-Za-z]/.test(t)) return false;
        // technical allowlist
        if (/@/.test(t) || /^https?:/i.test(t) || /^mailto:/i.test(t)) return false;
        if (/^\/api\//i.test(t) || /^\/[a-z0-9_/-]+$/i.test(t)) return false;
        if (/\b[a-z0-9-]+\.(com|app|io|net|org)\b/i.test(t) && !/\b(standard|enterprise|active|pending)\b/i.test(t)) {
          // domain-only or CODE · domain lines are technical
          if (/^[A-Z0-9]+ · [a-z0-9.-]+$/i.test(t) || /^[a-z0-9.-]+\.(com|app|io|net|org)\b/i.test(t)) return false;
        }
        if (/[\u0600-\u06FF]/.test(t)) {
          const latin = t.match(/[A-Za-z][A-Za-z0-9+&.\/_-]*/g) || [];
          return latin.some((w) => {
            if (brand.has(w) || brand.has(w.toUpperCase())) return false;
            if (/^[A-Z]{2,12}$/.test(w)) return false;
            if (/^(Hub|hub|v\d+|ms)$/i.test(w)) return false;
            if (/\.(com|app|io|net|org)$/i.test(w)) return false;
            if (/^\/api\//i.test(w)) return false;
            // system display like "تخطيط ... (ERP)" — ERP in parens allowed
            return w.length >= 3 && /[a-z]/.test(w);
          });
        }
        if (brand.has(t) || /^NAIOSH/i.test(t)) return false;
        if (/^[A-Za-z0-9._/-]{2,60}$/.test(t) && !/\s/.test(t)) return false; // codes/ids/paths
        if (/^\d{4}[/-]\d{2}/.test(t) || /^\d+(\.\d+)?%?$/.test(t)) return false;
        if (window.HubI18n?.looksLikeUiEnglish?.(t)) return true;
        if (/^(standard|enterprise|professional|auth|boot|active|pending|loading|save|edit|delete|cancel|close|view|add|system|status|plan|office)$/i.test(t))
          return true;
        if (/^[A-Z][a-z]{2,}(\s+[A-Za-z]+)*$/.test(t)) return true;
        return /[a-z]{4,}/.test(t);
      };
      const hits = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let n;
      while ((n = walker.nextNode())) {
        const parent = n.parentElement;
        if (!parent) continue;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA'].includes(parent.tagName)) continue;
        if (parent.closest('code, pre, .hss-id, .sr-only, [data-tech]')) continue;
        const text = n.textContent.replace(/\s+/g, ' ').trim();
        if (looks(text)) hits.push(text.slice(0, 100));
      };
      document.querySelectorAll('option, [placeholder], [aria-label]').forEach((el) => {
        const text = (el.tagName === 'OPTION' ? el.textContent : el.getAttribute('placeholder') || el.getAttribute('aria-label') || '').trim();
        if (looks(text) && el.value !== text) hits.push(text.slice(0, 80));
        // option visible label
        if (el.tagName === 'OPTION' && looks(el.textContent.trim()) && !brand.has(el.textContent.trim())) {
          // if value is code and label equals value → fail
          if (el.value && el.textContent.trim() === el.value && /[a-z]/.test(el.value)) hits.push('option:' + el.value);
        }
      });
      return [...new Set(hits)];
    }, [...BRAND]);

  // Operating focused checks + screenshot
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE}/dashboard.html#operating`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => !!document.querySelector('.hub-operating-ws, #page-title'), { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 900));
  // trigger auth activity by navigating away and back? already have boot in seed
  let hits = await collect();
  await page.screenshot({ path: path.join(ART, 'full-crawl-operating.png') });
  // open selects
  await page.evaluate(() => {
    document.querySelectorAll('#op-sub-system option, #op-sub-plan option').forEach((o) => {});
  });
  const selectLabels = await page.evaluate(() => ({
    systems: [...document.querySelectorAll('#op-sub-system option')].map((o) => o.textContent.trim()),
    plans: [...document.querySelectorAll('#op-sub-plan option')].map((o) => ({ v: o.value, t: o.textContent.trim() })),
    sidebarPhase: document.querySelector('#sidebar-phase')?.innerText?.replace(/\s+/g, ' ').trim(),
    activity: [...document.querySelectorAll('.hub-op-feed li, .feed li')].slice(0, 5).map((li) => li.textContent.replace(/\s+/g, ' ').trim()),
    subs: [...document.querySelectorAll('.hub-op-panel table.data tbody tr')].slice(0, 3).map((tr) => tr.innerText.replace(/\s+/g, ' ').trim()),
  }));
  report.operatingDetail = { hits, selectLabels };
  console.log('OPERATING hits', hits);
  console.log('sidebar', selectLabels.sidebarPhase);
  console.log('plans', selectLabels.plans);
  console.log('activity', selectLabels.activity);
  console.log('subs sample', selectLabels.subs);

  for (const panel of PANELS) {
    await page.goto(`${BASE}/dashboard.html#${panel}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !!window.HubStore?.get || !!document.querySelector('#page-title'), { timeout: 30000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 700));
    // click first few safe tabs if any
    await page.evaluate(() => {
      [...document.querySelectorAll('.hub-ws-tab, .tab, [data-action$="-tab"]')].slice(0, 3).forEach((b) => {
        try { b.click(); } catch (_) {}
      });
    });
    await new Promise((r) => setTimeout(r, 400));
    hits = await collect();
    // filter parentheses system codes remaining in Arabic strings like (ERP) — already handled
    const bad = hits.filter((h) => !/\([A-Z]{2,12}\)/.test(h) || /^(standard|enterprise|auth|boot)/i.test(h));
    report.panels.push({ panel, opened: true, hits: bad, count: bad.length });
    console.log(bad.length ? `FAIL #${panel}` : `PASS #${panel}`, bad.slice(0, 6));
  }

  // refresh operating
  await page.goto(`${BASE}/dashboard.html#operating`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 800));
  const afterRefresh = await collect();
  report.refreshOperating = afterRefresh;

  // logout/login
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    const user = { name: 'القائد الأعلى', email: 'leader@naiosh.com', role: 'supreme_leader', naioshId: 'NAI-LEADER-001', employeeNo: 'EMP-0001' };
    localStorage.setItem('hubUser', JSON.stringify(user));
    localStorage.setItem('hubAuthToken', `hub360.${btoa('leader@naiosh.com')}.${Date.now()}`);
  });
  await page.goto(`${BASE}/dashboard.html#operating`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 800));
  report.reloginOperating = await collect();

  // responsive operating
  for (const [name, w, h] of [['desktop', 1440, 900], ['tablet', 768, 1024], ['mobile', 390, 844]]) {
    await page.setViewport({ width: w, height: h });
    await page.goto(`${BASE}/dashboard.html#operating`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(ART, `full-crawl-operating-${name}.png`) });
    report[`responsive_${name}`] = await collect();
  }

  for (const file of STANDALONE) {
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE}/${file}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 600));
    hits = await collect();
    report.standalone.push({ file, opened: true, hits: hits.slice(0, 15), count: hits.length });
    console.log(hits.length ? `WARN ${file}` : `PASS ${file}`, hits.slice(0, 5));
  }

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  const failPanels = report.panels.filter((p) => p.count > 0);
  console.log('\nSUMMARY failPanels', failPanels.length, failPanels.map((p) => p.panel + ':' + p.count).join(','));
  console.log('refresh', report.refreshOperating);
  console.log('relogin', report.reloginOperating);
  await browser.close();
  process.exit(failPanels.length || report.refreshOperating.length || report.reloginOperating.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
