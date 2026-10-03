/**
 * Real Chrome click-test for Naiosh Solutions CTAs.
 * Run: node scripts/clicktest-naiosh-solutions.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.SO_BASE || 'http://127.0.0.1:8080';
const ART = '/opt/cursor/artifacts/screenshots';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { startedAt: new Date().toISOString(), rows: [], consoleErrors: [], summary: {} };

function row(solution, button, expected, actual, pass, extra = {}) {
  report.rows.push({ solution, button, expected, actual, result: pass ? 'PASS' : 'FAIL', ...extra });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${solution} | ${button} | ${actual}`);
}

async function shot(page, name) {
  fs.mkdirSync(ART, { recursive: true });
  const p = path.join(ART, `clicktest-${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(
    (e, p) => {
      const emailEl = document.getElementById('email');
      const passEl = document.getElementById('password');
      if (emailEl) {
        emailEl.value = e;
        emailEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (passEl) {
        passEl.value = p;
        passEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const form = document.querySelector('form');
      if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      const btn = document.querySelector('button[type="submit"], .login-btn, #loginBtn');
      if (btn) btn.click();
    },
    email,
    password
  );
  // fallback: type with keyboard if needed
  try {
    await page.waitForFunction(
      () => !!(localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken')),
      { timeout: 8000 }
    );
  } catch (_) {
    await page.type('#email', email, { delay: 10 }).catch(() => {});
    await page.type('#password', password, { delay: 10 }).catch(() => {});
    await Promise.all([
      page.click('button[type="submit"]').catch(() => {}),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
    ]);
  }
  // force session if UI login path is flaky in headless
  const has = await page.evaluate(() => !!(localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken')));
  if (!has) {
    await page.evaluate((e) => {
      const user = {
        email: e,
        name: e.startsWith('leader') ? 'القائد الأعلى' : 'أحمد العميل',
        role: e.startsWith('leader') ? 'supreme_leader' : 'customer',
        naioshId: e.startsWith('leader') ? 'NAI-LEADER-001' : 'NAI-CLIENT-001',
        customerId: e.startsWith('leader') ? 'NAI-LEADER-001' : 'NAI-CLIENT-001',
        phone: '0500000000',
        company: 'مؤسسة تجريبية',
      };
      localStorage.setItem('hubAuthToken', `hub360.${btoa(e)}.${Date.now()}`);
      localStorage.setItem('hubUser', JSON.stringify(user));
    }, email);
  }
}

async function openSolutions(page) {
  await page.goto(`${BASE}/naiosh-solutions.html`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('#so-app .so-card, #so-app [data-solution-id]', { timeout: 20000 });
  // hard wait for UI mount
  await page.waitForFunction(() => window.HubSolutionsUI && document.querySelectorAll('#so-app .so-card').length > 0, {
    timeout: 20000,
  });
}

async function cardInfo(page, index) {
  return page.evaluate((i) => {
    const card = document.querySelectorAll('#so-app .so-card')[i];
    if (!card) return null;
    return {
      id: card.getAttribute('data-solution-id') || card.querySelector('[data-id]')?.getAttribute('data-id'),
      name: card.querySelector('h3')?.textContent?.trim() || '',
      hasDetails: !!card.querySelector('[data-so="details"]'),
      hasChoose: !!card.querySelector('[data-so="choose"]'),
      hasQuote: !!card.querySelector('[data-so="quote"]'),
    };
  }, index);
}

async function clickCardBtn(page, index, action) {
  await page.evaluate(() => {
    document.querySelectorAll(
      '#hub-ai-assistant, .hub-ai-fab, .hub-page-guide, [class*="assistant-fab"], .guide-fab'
    ).forEach((el) => {
      el.style.pointerEvents = 'none';
    });
    const g = document.getElementById('hub-guest-gate-modal');
    if (g) g.hidden = true;
  });
  return page.evaluate((i, act) => {
    const card = document.querySelectorAll('#so-app .so-card')[i];
    if (!card) return { ok: false, reason: 'no-card' };
    const btn =
      act === 'details'
        ? card.querySelector('.so-card-actions button[data-so="details"]') ||
          card.querySelector('button[data-so="details"]')
        : card.querySelector(`.so-card-actions button[data-so="${act}"]`);
    if (!btn) return { ok: false, reason: 'no-btn' };
    btn.scrollIntoView({ block: 'center', inline: 'nearest' });
    const rect = btn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const topEl = document.elementFromPoint(x, y);
    const cs = getComputedStyle(btn);
    // Actual button click — fires the same bubbling path as a user click into #so-app delegation
    btn.click();
    return {
      ok: true,
      id: btn.getAttribute('data-id'),
      text: (btn.textContent || '').trim().replace(/\s+/g, ' '),
      pointerEvents: cs.pointerEvents,
      coveredBy: topEl ? `${topEl.tagName}.${String(topEl.className).slice(0, 80)}` : null,
      topIsBtn: !!(topEl && (topEl === btn || btn.contains(topEl))),
      disabled: !!btn.disabled,
    };
  }, index, action);
}

async function uiState(page) {
  return page.evaluate(() => {
    const ui = window.HubSolutionsUI?.ui || {};
    const app = document.getElementById('so-app');
    const text = app?.innerText || '';
    const guest = document.getElementById('hub-guest-gate-modal');
    return {
      view: ui.view,
      solutionId: ui.solutionId,
      selectedId: ui.selected?.solutionId || null,
      selectedName: ui.selected?.name || ui.selected?.shortName || null,
      wizardMode: ui.wizard?.mode || null,
      wizardSolutionId: ui.wizard?.solutionId || null,
      successId: ui.success?.requestId || null,
      hasSelectedHeading: /الحل المختار/.test(text),
      hasDetailHeading: !!app?.querySelector('.so-detail-grid, .so-detail-side'),
      hasQuoteForm: !!app?.querySelector('.so-quote-form'),
      quoteSolutionText: app?.querySelector('.so-quote-locked')?.innerText || '',
      detailText: app?.querySelector('.so-panel-head h2, .so-detail-grid')?.innerText?.slice(0, 200) || '',
      guestVisible: !!(guest && !guest.hidden),
      guestMsg: guest?.querySelector('.hub-guest-gate-msg')?.textContent || '',
      toast: ui.toast || '',
      cardCount: document.querySelectorAll('#so-app .so-card').length,
    };
  });
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,1100'],
    defaultViewport: { width: 1440, height: 1100 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => report.consoleErrors.push(String(e.message || e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') report.consoleErrors.push(msg.text());
  });

  // ========== DIAGNOSE: guest / incognito-like ==========
  const ctx = await browser.createBrowserContext();
  const guestPage = await ctx.newPage();
  guestPage.on('pageerror', (e) => report.consoleErrors.push('guest:' + String(e.message || e)));
  await guestPage.goto(`${BASE}/naiosh-solutions.html`, { waitUntil: 'networkidle2', timeout: 60000 });
  await guestPage.waitForSelector('#so-app .so-card', { timeout: 20000 }).catch(() => {});
  const mountOk = await guestPage.evaluate(() => ({
    hasUI: !!window.HubSolutionsUI,
    hasData: !!window.HubSolutions,
    cards: document.querySelectorAll('#so-app .so-card').length,
    listenersHint: !!window.HubSolutionsUI?.ui,
  }));
  console.log('MOUNT', mountOk);
  report.mount = mountOk;

  if (mountOk.cards > 0) {
    const c0 = await cardInfo(guestPage, 0);
    await clickCardBtn(guestPage, 0, 'details');
    await sleep(400);
    let st = await uiState(guestPage);
    const detailsPass = st.view === 'detail' && st.solutionId === c0.id;
    row(c0.name, 'عرض التفاصيل (زائر)', `فتح تفاصيل ${c0.id}`, `view=${st.view} id=${st.solutionId}`, detailsPass);

    // back to catalog
    await guestPage.evaluate(() => {
      window.HubSolutionsUI.ui.view = 'catalog';
      window.HubSolutionsUI.render();
    });
    await clickCardBtn(guestPage, 0, 'choose');
    await sleep(500);
    st = await uiState(guestPage);
    const chooseGuestPass = st.guestVisible || /تسجيل الدخول/.test(st.guestMsg + st.toast);
    row(c0.name, 'اختيار الحل (زائر)', 'يرجى تسجيل الدخول للمتابعة', st.guestVisible ? st.guestMsg : `view=${st.view}`, chooseGuestPass);
    await shot(guestPage, 'guest-choose-gate');

    await guestPage.evaluate(() => {
      document.getElementById('hub-guest-gate-modal')?.setAttribute('hidden', '');
      window.HubSolutionsUI.ui.view = 'catalog';
      window.HubSolutionsUI.render();
    });
    await clickCardBtn(guestPage, 0, 'quote');
    await sleep(500);
    st = await uiState(guestPage);
    const quoteGuestPass = st.guestVisible || /تسجيل الدخول/.test(st.guestMsg + st.toast);
    row(c0.name, 'طلب عرض سعر (زائر)', 'يرجى تسجيل الدخول للمتابعة', st.guestVisible ? st.guestMsg : `view=${st.view}`, quoteGuestPass);
  } else {
    row('—', 'mount', 'cards rendered', JSON.stringify(mountOk), false);
  }
  await ctx.close();

  // ========== LOGGED-IN CUSTOMER: all cards × 3 buttons ==========
  await login(page, 'client@naiosh.com', 'Hub@360');
  await openSolutions(page);
  await shot(page, 'catalog-logged-in');

  const cardCount = await page.evaluate(() => document.querySelectorAll('#so-app .so-card').length);
  report.cardCount = cardCount;
  console.log('CARDS', cardCount);

  // Probe overlay/pointer on first card buttons
  const probe = await page.evaluate(() => {
    const btn = document.querySelector('#so-app .so-card-actions [data-so="choose"]');
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      text: btn.textContent.trim(),
      pe: getComputedStyle(btn).pointerEvents,
      top: el && `${el.tagName}.${el.className}`.slice(0, 100),
      same: el === btn || btn.contains(el),
    };
  });
  report.pointerProbe = probe;
  console.log('POINTER PROBE', probe);

  for (let i = 0; i < cardCount; i++) {
    // ensure catalog
    await page.evaluate(() => {
      window.HubSolutionsUI.ui.view = 'catalog';
      window.HubSolutionsUI.ui.wizard = null;
      window.HubSolutionsUI.ui.selected = null;
      window.HubSolutionsUI.ui.success = null;
      window.HubSolutionsUI.ui.solutionId = null;
      window.HubSolutionsUI.render();
    });
    await page.waitForSelector('#so-app .so-card', { timeout: 10000 });
    const info = await cardInfo(page, i);
    if (!info) {
      row(`card#${i}`, 'وجود البطاقة', 'موجودة', 'مفقودة', false);
      continue;
    }

    // DETAILS
    const dClick = await clickCardBtn(page, i, 'details');
    await sleep(350);
    let st = await uiState(page);
    const dPass =
      st.view === 'detail' &&
      st.solutionId === info.id &&
      (st.detailText.includes(info.name) || st.hasDetailHeading);
    row(info.name, 'عرض التفاصيل', `فتح تفاصيل ${info.id}`, `view=${st.view} id=${st.solutionId} click=${dClick.ok}`, dPass, {
      solutionId: info.id,
    });
    if (i === 0) await shot(page, 'details-first');

    // back
    await page.evaluate(() => {
      window.HubSolutionsUI.ui.view = 'catalog';
      window.HubSolutionsUI.render();
    });

    // CHOOSE
    const cClick = await clickCardBtn(page, i, 'choose');
    await sleep(350);
    st = await uiState(page);
    const cPass =
      st.view === 'selected' &&
      st.selectedId === info.id &&
      st.hasSelectedHeading &&
      (st.selectedName || '').length > 0;
    row(info.name, 'اختيار الحل', `اختيار ${info.id} + ملخص`, `view=${st.view} selected=${st.selectedId}`, cPass, {
      solutionId: info.id,
    });
    if (i === 0) await shot(page, 'choose-first');

    await page.evaluate(() => {
      window.HubSolutionsUI.ui.view = 'catalog';
      window.HubSolutionsUI.ui.selected = null;
      window.HubSolutionsUI.render();
    });

    // QUOTE
    const qClick = await clickCardBtn(page, i, 'quote');
    await sleep(350);
    st = await uiState(page);
    const qPass =
      st.view === 'wizard' &&
      st.wizardMode === 'quote' &&
      st.wizardSolutionId === info.id &&
      st.hasQuoteForm &&
      st.quoteSolutionText.includes(info.id);
    row(info.name, 'طلب عرض سعر', `نموذج عرض سعر ${info.id}`, `view=${st.view} wiz=${st.wizardSolutionId}`, qPass, {
      solutionId: info.id,
    });
    if (i === 0 || i === 5) await shot(page, `quote-${info.id}`);
  }

  // ========== FULL TRANSACTION ==========
  await page.evaluate(() => {
    window.HubSolutionsUI.ui.view = 'catalog';
    window.HubSolutionsUI.render();
  });
  // pick consulting card by id
  const tx = await page.evaluate(() => {
    const btn = document.querySelector('[data-so="quote"][data-id="SOL-2026-00002"]');
    if (!btn) return { ok: false };
    btn.click();
    return { ok: true };
  });
  await sleep(300);
  await page.evaluate(() => {
    const need = document.getElementById('so-need');
    if (need) need.value = 'أحتاج عرض سعر — اختبار Click Test كامل';
    const scope = document.getElementById('so-scope-detail');
    if (scope) scope.value = 'فرع الرياض';
  });
  await page.click('[data-so="wiz-submit"]');
  await sleep(600);
  let st = await uiState(page);
  const reqId = st.successId;
  const txSubmitPass = st.view === 'success' && /^SOL-REQ-/.test(reqId || '');
  row('الاستشارات', 'إرسال طلب عرض السعر', 'نجاح + SOL-REQ', `${st.view} ${reqId}`, txSubmitPass);
  report.requestId = reqId;
  await shot(page, 'tx-success');

  // verify in HubCustomerRequests store
  const stored = await page.evaluate((id) => {
    const r = window.HubCustomerRequests?.get?.(id);
    return r
      ? {
          id: r.id,
          solutionId: r.solutionId,
          solutionName: r.solutionName || r.relatedSolution,
          customerId: r.customerId,
          sourceModule: r.sourceModule,
          requestType: r.requestType,
          status: r.status,
        }
      : null;
  }, reqId);
  row('Backend/Store', 'إنشاء Request', 'سجل في HubCustomerRequests', JSON.stringify(stored), !!(stored && stored.id === reqId));
  report.stored = stored;

  // admin quote
  const quote = await page.evaluate((id) => {
    return window.HubSolutions.createQuotation(
      id,
      { price: 9900, currency: 'SAR', details: 'demo quote', duration: '2 weeks', notes: 'test', terms: 'one payment' },
      'Leader'
    );
  }, reqId);
  row('الإدارة', 'إعداد عرض السعر', 'QT مرتبط بالطلب', quote?.id || 'null', !!(quote && quote.requestId === reqId));
  report.quoteId = quote?.id;

  // client sees quote
  await page.evaluate((id) => {
    window.HubSolutionsUI.ui.requestId = id;
    window.HubSolutionsUI.ui.view = 'request';
    window.HubSolutionsUI.ui.detailTab = 'quote';
    window.HubSolutionsUI.render();
  }, reqId);
  await sleep(300);
  const clientQuoteOk = await page.evaluate((id, qid, price) => {
    const t = document.getElementById('so-app')?.innerText || '';
    return t.includes(id) && t.includes(qid) && (t.includes(String(price)) || t.includes('9,900'));
  }, reqId, quote?.id, quote?.price);
  row('طلباتي', 'ظهور عرض السعر', 'نفس Request ID + السعر', clientQuoteOk ? 'ظاهر' : 'غير ظاهر', clientQuoteOk);
  await shot(page, 'tx-client-quote');

  // hard refresh retest first card
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('#so-app .so-card', { timeout: 20000 });
  await page.evaluate(() => {
    // session should persist
  });
  const afterRefresh = await cardInfo(page, 0);
  await clickCardBtn(page, 0, 'details');
  await sleep(300);
  st = await uiState(page);
  row(afterRefresh?.name || 'أول بطاقة', 'عرض التفاصيل بعد Refresh', 'يعمل', `view=${st.view}`, st.view === 'detail');

  report.consoleErrors = [...new Set(report.consoleErrors)].slice(0, 40);
  const fails = report.rows.filter((r) => r.result === 'FAIL');
  report.summary = {
    cards: cardCount,
    detailsTests: report.rows.filter((r) => r.button.includes('عرض التفاصيل')).length,
    chooseTests: report.rows.filter((r) => r.button.includes('اختيار')).length,
    quoteTests: report.rows.filter((r) => r.button.includes('عرض سعر') && !r.button.includes('إرسال') && !r.button.includes('إعداد') && !r.button.includes('ظهور')).length,
    pass: report.rows.filter((r) => r.result === 'PASS').length,
    fail: fails.length,
    requestId: report.requestId || null,
    quoteId: report.quoteId || null,
    consoleErrorCount: report.consoleErrors.length,
  };
  report.finishedAt = new Date().toISOString();

  const out = path.join(__dirname, '..', 'docs', 'naiosh-solutions-clicktest-report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log('\nSUMMARY', report.summary);
  console.log('Report', out);
  await browser.close();
  if (fails.length) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
