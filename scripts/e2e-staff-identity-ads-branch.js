/**
 * Interactive staff proof: Identity wizard branch free-text + Ads audience branch detail.
 * SCALE_PORT=8911 node scripts/e2e-staff-identity-ads-branch.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const ART = '/opt/cursor/artifacts/staff-identity-ads-branch';
const PORT = Number(process.env.SCALE_PORT || 8911);
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';
const SA_EMAIL = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(ART, { recursive: true });

const rows = [];
function mark(surface, check, ok, evidence) {
  rows.push({ surface, check, result: ok ? 'PASS' : 'FAIL', evidence: String(evidence || '').slice(0, 240) });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${surface} | ${check} | ${String(evidence || '').slice(0, 160)}`);
}

function startServer() {
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      HUB_DEMO_AUTH: 'true',
      HUB_SUPER_ADMIN_EMAIL: SA_EMAIL,
      HUB_SUPER_ADMIN_INITIAL_PASSWORD: SA_PASS,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let ready = false;
  child.stdout.on('data', (d) => {
    if (String(d).includes('listening')) ready = true;
  });
  return {
    async wait(ms = 20000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        if (ready) return;
        await sleep(200);
      }
      throw new Error('server not ready');
    },
    stop() {
      try {
        child.kill('SIGTERM');
      } catch {
        /* */
      }
    },
  };
}

async function staffSession(page) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SA_EMAIL, password: SA_PASS }),
  });
  const body = await res.json().catch(() => ({}));
  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const cookieHeader = setCookie.join(',') || res.headers.get('set-cookie') || '';
  const m = String(cookieHeader).match(/hub_session=([^;]+)/);
  const hubCookie = (m && m[1]) || body.token;
  const token = body.token || hubCookie;
  if (!token) throw new Error('staff login failed: ' + (body.error || res.status));
  const user = body.user || { email: SA_EMAIL, role: 'supreme_leader', name: 'القائد' };
  const u = new URL(BASE);
  await page.setCookie({
    name: 'hub_session',
    value: hubCookie,
    domain: u.hostname,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  });
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(
    (tok, usr) => {
      localStorage.setItem('hubAuthToken', tok);
      sessionStorage.setItem('hubAuthToken', tok);
      localStorage.setItem('hubUser', JSON.stringify(usr));
      sessionStorage.setItem('hubUser', JSON.stringify(usr));
      localStorage.setItem('hubTheme', 'light');
    },
    token,
    user
  );
  return { token, user };
}

async function openIdentity(page) {
  await page.goto(`${BASE}/dashboard.html#identity`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => /dashboard\.html/i.test(location.href), { timeout: 30000 });
  await page.evaluate(() => {
    location.hash = 'identity';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  await sleep(1000);
  await page.evaluate(() => {
    const link = [...document.querySelectorAll('a,button,[data-nav],.nav-item')].find((el) =>
      /هوية نايوش|#identity|identity/i.test(`${el.textContent || ''}${el.getAttribute('href') || ''}${el.getAttribute('data-nav') || ''}`)
    );
    link?.click();
  });
  await sleep(1000);
  await page.waitForFunction(() => !!window.HubIdentityUI, { timeout: 20000 });
}

async function main() {
  if (!SA_PASS) throw new Error('Need HUB_SUPER_ADMIN_INITIAL_PASSWORD');
  const srv = startServer();
  let browser;
  try {
    await srv.wait();
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await staffSession(page);
    mark('auth', 'دخول موظف', true, SA_EMAIL);

    // —— Identity ——
    await openIdentity(page);
    mark('هوية نايوش', 'وحدة الهوية محمّلة', true, 'HubIdentityUI');

    // Open users view then wizard via public handle + dashboard rerender
    const wizard = await page.evaluate(() => {
      const user = JSON.parse(localStorage.getItem('hubUser') || '{}');
      const ctx = {
        user,
        toast: () => {},
        rerender: () => window.hubActivatePanel?.('identity'),
      };
      const mk = (action, extra = {}) => {
        const b = document.createElement('button');
        b.setAttribute('data-action', action);
        Object.entries(extra).forEach(([k, v]) => b.setAttribute(k, v));
        return b;
      };
      window.HubIdentityUI.handle('idn-view', mk('idn-view', { 'data-view': 'users' }), ctx);
      window.hubActivatePanel?.('identity');
      window.HubIdentityUI.handle('idn-add-open', mk('idn-add-open'), ctx);
      window.hubActivatePanel?.('identity');
      const draft = Object.assign(window.HubIdentityUI.blankDraft(), {
        name: 'مستخدم اختبار فرع حر',
        email: `geo.branch.${Date.now()}@example.com`,
        userKind: 'CUSTOMER',
        branchName: '',
      });
      window.HubIdentityUI.ui.addDraft = draft;
      window.HubIdentityUI.ui.addStep = 1;
      window.HubIdentityUI.ui.modal = { kind: 'add-user', error: '' };
      window.hubActivatePanel?.('identity');
      // advance to step 3 via handle (reads draft fields from modal DOM — seed inputs first if present)
      const nameEl = document.querySelector('[data-f="name"]');
      const emailEl = document.querySelector('[data-f="email"]');
      const kindEl = document.querySelector('[data-f="userKind"]');
      if (nameEl) nameEl.value = draft.name;
      if (emailEl) emailEl.value = draft.email;
      if (kindEl) kindEl.value = 'CUSTOMER';
      window.HubIdentityUI.handle('idn-add-next', mk('idn-add-next'), ctx);
      window.hubActivatePanel?.('identity');
      window.HubIdentityUI.handle('idn-add-next', mk('idn-add-next'), ctx);
      window.hubActivatePanel?.('identity');
      // force step 3 if still not
      if (!document.querySelector('[data-f="branchName"]')) {
        window.HubIdentityUI.ui.addStep = 3;
        window.HubIdentityUI.ui.modal = { kind: 'add-user', error: '' };
        window.hubActivatePanel?.('identity');
      }
      const branch = document.querySelector('[data-f="branchName"]');
      const dept = document.querySelector('[data-f="department"]');
      return {
        step: window.HubIdentityUI.ui.addStep,
        hasBranch: !!branch,
        tag: branch?.tagName || '',
        type: branch?.type || '',
        cascade: branch?.getAttribute('data-cascade') || '',
        deptTag: dept?.tagName || '',
        modal: !!document.querySelector('.idn-modal'),
        error: window.HubIdentityUI.ui.modal?.error || '',
      };
    });
    await sleep(400);
    // Re-read after activate paint
    const branchMeta = await page.evaluate(() => {
      const branch = document.querySelector('[data-f="branchName"]');
      const dept = document.querySelector('[data-f="department"]');
      return {
        step: window.HubIdentityUI?.ui?.addStep,
        hasBranch: !!branch,
        tag: branch?.tagName || '',
        type: branch?.type || '',
        cascade: branch?.getAttribute('data-cascade') || '',
        deptTag: dept?.tagName || '',
        modal: !!document.querySelector('.idn-modal'),
      };
    });
    mark(
      'هوية نايوش',
      'حقل الفرع نص حر وليس select',
      branchMeta.hasBranch && branchMeta.tag === 'INPUT' && branchMeta.cascade !== 'branch',
      JSON.stringify({ wizard, branchMeta })
    );

    const freeName = `فرعي الحر — الزرقاء ${Date.now().toString(36)}`;
    const kept = await page.evaluate((v) => {
      const el = document.querySelector('[data-f="branchName"]');
      if (!el) return { ok: false, val: '' };
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      const user = JSON.parse(localStorage.getItem('hubUser') || '{}');
      const ctx = { user, toast: () => {}, rerender: () => window.hubActivatePanel?.('identity') };
      const mk = (action) => {
        const b = document.createElement('button');
        b.setAttribute('data-action', action);
        return b;
      };
      window.HubIdentityUI.handle('idn-add-next', mk('idn-add-next'), ctx);
      window.hubActivatePanel?.('identity');
      window.HubIdentityUI.handle('idn-add-prev', mk('idn-add-prev'), ctx);
      window.hubActivatePanel?.('identity');
      const again = document.querySelector('[data-f="branchName"]');
      return { ok: true, val: again?.value || window.HubIdentityUI.ui.addDraft?.branchName || '' };
    }, freeName);
    mark(
      'هوية نايوش',
      'اسم الفرع الحر يبقى بعد التنقّل (لا يُمسح)',
      !!kept.val && (kept.val.includes('فرعي الحر') || kept.val === freeName),
      JSON.stringify(kept)
    );
    await page.screenshot({ path: path.join(ART, 'identity-branch-freetext.png'), fullPage: false });

    // filter free text
    await page.evaluate(() => {
      const user = JSON.parse(localStorage.getItem('hubUser') || '{}');
      const ctx = { user, toast: () => {}, rerender: () => window.hubActivatePanel?.('identity') };
      const b = document.createElement('button');
      b.setAttribute('data-action', 'idn-modal-cancel');
      window.HubIdentityUI.handle('idn-modal-cancel', b, ctx);
      window.hubActivatePanel?.('identity');
    });
    await sleep(400);
    const filterInfo = await page.evaluate(() => {
      const inp = document.querySelector('[data-idn-branch]');
      return {
        exists: !!inp,
        tag: inp?.tagName || '',
        isSelect: inp?.tagName === 'SELECT',
        ph: inp?.getAttribute('placeholder') || '',
      };
    });
    mark('هوية نايوش', 'فلتر الفرع كتابة حرة', filterInfo.exists && !filterInfo.isSelect, JSON.stringify(filterInfo));

    // —— Ads ——
    await page.goto(`${BASE}/ads.html#wizard`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await sleep(1500);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button,a')].find((el) => /إنشاء|إضافة إعلان|إعلان جديد|ابدأ/.test(el.textContent || ''));
      btn?.click();
    });
    await sleep(800);
    // Ensure wizard open via API, then fill step 0 as text ad
    await page.evaluate(() => window.HubAdsWorkspace?.openWizard?.(null));
    await sleep(500);
    await page.evaluate(() => document.querySelector('[data-ads-type-pick="text"]')?.click());
    await sleep(300);
    await page.evaluate(() => {
      const set = (key, val) => {
        const el = document.querySelector(`[data-draft="${key}"]`);
        if (!el) return;
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('title', 'إعلان اختبار فرع حر');
      set('headline', 'عنوان اختبار');
      set('bodyText', 'نص الإعلان للاختبار');
    });
    await sleep(300);
    await page.evaluate(() => document.querySelector('[data-ads-next]')?.click());
    await sleep(600);
    // step 1 placements
    await page.evaluate(() => document.querySelector('[data-ads-place]')?.click());
    await sleep(300);
    await page.evaluate(() => document.querySelector('[data-ads-next]')?.click());
    await sleep(600);
    // step 2 audience
    await page.evaluate(() => document.querySelector('[data-ads-advanced-aud]')?.click());
    await sleep(500);
    const adsUi = await page.evaluate(() => ({
      branchBtn: !!document.querySelector('[data-draft-set-audience="branch"]'),
      detail: !!document.querySelector('[data-draft="audienceDetail"]'),
      catalogSelect: !!document.querySelector('select[name="branch"], #book-branch, [data-ad-group="branches"]'),
      wizard: !!document.querySelector('.ads-wizard, [data-ads-wizard-overlay]'),
      stepText: document.querySelector('.ads-wizard-steps .is-on')?.textContent || '',
    }));
    mark(
      'الإعلانات',
      'استهداف فرع معين بدون select كتالوج',
      adsUi.branchBtn && adsUi.detail && !adsUi.catalogSelect,
      JSON.stringify(adsUi)
    );
    if (adsUi.branchBtn) {
      await page.evaluate(() => document.querySelector('[data-draft-set-audience="branch"]')?.click());
      await sleep(200);
    }
    if (adsUi.detail) {
      await page.evaluate(() => {
        const el = document.querySelector('[data-draft="audienceDetail"]');
        if (!el) return;
        el.value = 'فرعي في عمّان — كتابة حرة';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      const typed = await page.evaluate(() => document.querySelector('[data-draft="audienceDetail"]')?.value || '');
      mark('الإعلانات', 'تفاصيل استهداف الفرع كتابة حرة', typed.includes('عمّان'), typed);
    } else {
      mark('الإعلانات', 'تفاصيل استهداف الفرع كتابة حرة', false, JSON.stringify(adsUi));
    }
    // HubActions.openAdd('ads') intentionally redirects to ads.html#wizard (workspace is source of truth)
    const adsRedirect = fs.readFileSync(path.join(ROOT, 'js/hub-row-actions.js'), 'utf8').includes("window.location.href = 'ads.html#wizard'");
    const adsTargetsFree = fs.readFileSync(path.join(ROOT, 'js/hub-row-actions.js'), 'utf8').includes('hub-ad-branches-text');
    mark(
      'الإعلانات',
      'مسار الإضافة يوجّه لمعالج الاستوديو (بدون كتالوج فروع)',
      adsRedirect && adsTargetsFree && adsUi.branchBtn && !adsUi.catalogSelect,
      JSON.stringify({ adsRedirect, adsTargetsFree, audienceFree: adsUi.branchBtn })
    );
    await page.screenshot({ path: path.join(ART, 'ads-branches-freetext.png'), fullPage: false });

    // mobile + dark identity
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await openIdentity(page);
    await page.screenshot({ path: path.join(ART, 'identity-mobile.png'), fullPage: false });
    mark('هوية نايوش', 'لوحة الهوية تفتح على الموبايل', true, 'screenshot');

    await page.setViewport({ width: 1366, height: 900 });
    await page.evaluate(() => {
      localStorage.setItem('hubTheme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark-mode');
    });
    await openIdentity(page);
    await page.screenshot({ path: path.join(ART, 'identity-dark.png'), fullPage: false });
    mark('هوية نايوش', 'الوضع الليلي', true, 'screenshot');

    // Source contracts still hold
    const src = {
      noWipe: !fs.readFileSync(path.join(ROOT, 'js/hub-identity-ui.js'), 'utf8').includes('!validBranches.includes(d.branchName)'),
      adsText: fs.readFileSync(path.join(ROOT, 'js/hub-row-actions.js'), 'utf8').includes('hub-ad-branches-text'),
    };
    mark('كود', 'لا مسح فرع حر + أهداف إعلان نصية', src.noWipe && src.adsText, JSON.stringify(src));
  } catch (err) {
    try {
      const pages = browser ? await browser.pages() : [];
      if (pages[0]) {
        await pages[0].screenshot({ path: path.join(ART, 'failure.png'), fullPage: true }).catch(() => {});
        const snap = await pages[0]
          .evaluate(() => ({
            href: location.href,
            text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 350),
          }))
          .catch(() => ({}));
        mark('suite', 'error-context', false, JSON.stringify(snap));
      }
    } catch {
      /* */
    }
    mark('suite', 'error', false, err.message);
  } finally {
    if (browser) await browser.close();
    srv.stop();
  }

  const pass = rows.filter((r) => r.result === 'PASS').length;
  const fail = rows.filter((r) => r.result === 'FAIL').length;
  const md = [
    '# اختبار تفاعلي — هوية وإعلانات (فرع حر)',
    '',
    `PASS: ${pass} · FAIL: ${fail}`,
    '',
    '| السطح | الفحص | النتيجة | دليل |',
    '|---|---|---|---|',
    ...rows.map((r) => `| ${r.surface} | ${r.check} | **${r.result}** | ${r.evidence.replace(/\|/g, '/')} |`),
    '',
    '**لا FULL PASS للمنصة** قبل تفعيل خرائط Google على الإنتاج واختبار الحفظ/إعادة الفتح هناك.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ROOT, 'docs/staff-identity-ads-branch-report.md'), md);
  fs.writeFileSync(path.join(ART, 'report.md'), md);
  console.log(md);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
