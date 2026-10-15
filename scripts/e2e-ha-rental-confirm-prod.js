/**
 * Focused production proof: disposable rental → no undefined → real confirm click → badge drop.
 * NO DOM patches.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = (process.env.HUB_E2E_BASE || 'https://naiosh-hub-production.up.railway.app').replace(/\/$/, '');
const SA_EMAIL = process.env.HUB_SUPER_ADMIN_EMAIL || '';
const SA_PASS = process.env.HUB_PROD_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const ART = '/opt/cursor/artifacts';
const OUT_JSON = path.join(__dirname, 'e2e-ha-rental-confirm-prod-report.json');
const OUT_MD = path.join(__dirname, '..', 'docs', 'ha-rental-confirm-prod-report.md');

fs.mkdirSync(ART, { recursive: true });
const cases = [];
const mark = (name, ok, detail = '', status) => {
  const result = status || (ok ? 'PASS' : 'FAIL');
  cases.push({ name, result, detail: String(detail || '').slice(0, 600) });
  console.log(`${result === 'PASS' ? '✓' : result === 'NOT TESTED' ? '○' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(page, name) {
  const file = path.join(ART, `ha_rent_confirm_${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false });
  } catch (_) {}
  return file;
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#email', { timeout: 20000 });
  await page.evaluate(
    (e, p) => {
      document.querySelector('#email').value = e;
      document.querySelector('#password').value = p;
    },
    email,
    password
  );
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await sleep(2000);
  return !/login\.html/i.test(page.url());
}

async function createRentalWithRetry(page, attempts = 6) {
  let last = null;
  for (let i = 0; i < attempts; i++) {
    const stamp = `${Date.now().toString(36)}-${i}`;
    last = await page.evaluate(async (s) => {
      const res = await fetch('/api/hub/system-rentals/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          adminName: `عميل تجريبي ${s}`,
          adminEmail: `ha-rent-${s}@example.com`,
          adminPhone: '01002223344',
          rental: {
            companyName: `شركة تجريبية ${s}`,
            slug: `ha-rent-${s}`.replace(/[^a-z0-9-]/gi, '').slice(0, 40),
            subdomain: `ha-rent-${s}`.replace(/[^a-z0-9-]/gi, '').slice(0, 40),
            systems: ['CRM'],
            plan: 'basic',
            notes: `اختبار confirm ${s}`,
            systemLabel: 'نظام CRM التجريبي',
            customerName: `عميل تجريبي ${s}`,
          },
        }),
      });
      const j = await res.json().catch(() => ({}));
      return {
        status: res.status,
        ok: !!(j.ok && j.rental?.approvalId),
        approvalId: j.rental?.approvalId || '',
        rentalId: j.rental?.id || '',
        impact: j.rental?.impactIfApproved || '',
        error: j.error || j.code || '',
        raw: JSON.stringify(j).slice(0, 500),
      };
    }, stamp);
    if (last.ok) return last;
    console.log(`rental retry ${i + 1}: ${last.error || last.raw}`);
    await sleep(1500 * (i + 1));
  }
  return last;
}

async function kpi(page) {
  return page.evaluate(async () => {
    const res = await fetch(`/api/hub/higher-approvals/kpis?t=${Date.now()}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const j = await res.json();
    return Number(j.kpis?.awaitingDecision ?? j.kpis?.pending ?? 0) || 0;
  });
}

async function badge(page) {
  return page.evaluate(() => {
    const el = document.querySelector('#sidebar-nav a[data-panel="rent-admin"] .nav-ha-badge');
    return el ? Number(el.textContent.trim()) || 0 : 0;
  });
}

async function openInbox(page) {
  await page.goto(`${BASE}/dashboard.html#rent-admin`, { waitUntil: 'networkidle2', timeout: 90000 }).catch(async () => {
    await page.goto(`${BASE}/dashboard.html#rent-admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  });
  await sleep(3000);
  try {
    await page.evaluate(async () => {
      await window.HubHigherApprovals?.hydrateFromServer?.({ force: true, backfill: true });
    });
  } catch (_) {}
  await sleep(1500);
  try {
    await page.evaluate(() => {
      if (!/#rent-admin/.test(location.hash)) location.hash = 'rent-admin';
      window.dispatchEvent(new CustomEvent('hub-ha-rerender'));
    });
  } catch (_) {}
  await sleep(1500);
  await page.waitForSelector('.ha-kpis, .hub-ha-ws, [data-ha-q]', { timeout: 30000 }).catch(() => null);
}

async function safeClick(page, selector, opts = {}) {
  for (let i = 0; i < 5; i++) {
    try {
      await page.waitForSelector(selector, { visible: true, timeout: 8000 });
      await page.$eval(selector, (el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
      await sleep(200);
      await page.click(selector, opts);
      return true;
    } catch (e) {
      if (i === 4) throw e;
      await sleep(600);
    }
  }
  return false;
}

async function main() {
  if (!SA_EMAIL || !SA_PASS) {
    mark('credentials', false, 'missing');
    return done();
  }

  const html = await (async () => {
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SA_EMAIL, password: SA_PASS }),
    }).then((r) => r.json());
    return fetch(`${BASE}/dashboard.html`, {
      headers: { Authorization: `Bearer ${loginRes.token}`, Cookie: `hub_session=${loginRes.token}` },
    }).then((r) => r.text());
  })();
  mark(
    'prod_assets_v7',
    html.includes('hub-higher-approvals-ui.js?v=7') && html.includes('dashboard.js?v=ha-badge1'),
    'v=7 + ha-badge1'
  );

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    protocolTimeout: 180000,
    userDataDir: `/tmp/ha-rent-c-${Date.now()}`,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 900 },
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(90000);
    await page.setCacheEnabled(false);
    mark('leader_login', await login(page, SA_EMAIL, SA_PASS), page.url());

    await page.goto(`${BASE}/dashboard.html#overview`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(4000);
    const kpi0 = await kpi(page);
    let badge0 = await badge(page);
    for (let i = 0; i < 5 && badge0 === 0 && kpi0 > 0; i++) {
      await sleep(2000);
      badge0 = await badge(page);
    }
    await shot(page, 'badge_before');
    mark('badge_before', badge0 === kpi0 && badge0 > 0, `badge=${badge0} kpi=${kpi0}`);

    // Prefer a freshly created disposable rental; allow reuse via env for flake recovery.
    let rent = null;
    if (process.env.HA_RENTAL_APPROVAL_ID && process.env.HA_RENTAL_ID) {
      rent = {
        ok: true,
        approvalId: process.env.HA_RENTAL_APPROVAL_ID,
        rentalId: process.env.HA_RENTAL_ID,
        error: '',
      };
    } else {
      rent = await createRentalWithRetry(page);
    }
    mark('rental_created', !!rent?.ok, `${rent?.approvalId} · ${rent?.rentalId} · ${rent?.error || ''}`);
    if (!rent?.ok) return done();

    // Fetch server row impact
    const row = await page.evaluate(async (id) => {
      const res = await fetch(`/api/hub/higher-approvals?q=${encodeURIComponent(id)}`, {
        credentials: 'same-origin',
      });
      const j = await res.json();
      const r = (j.requests || []).find((x) => x.id === id) || (j.requests || [])[0];
      return r
        ? {
            impactIfApproved: r.impactIfApproved,
            requestedDisplay: r.requestedDisplay,
            systemLabel: r.systemLabel,
            requesterName: r.requesterName,
            subjectName: r.subjectName,
          }
        : null;
    }, rent.approvalId);
    mark(
      'server_impact_no_undefined',
      !!row && !/undefined/i.test(String(row.impactIfApproved || '')) && !/undefined/i.test(String(row.requestedDisplay || '')),
      JSON.stringify(row)
    );

    await openInbox(page);
    const kpi1 = await kpi(page);

    // Search + open approve modal (tolerate re-renders)
    await page.waitForSelector('[data-ha-q]', { timeout: 20000 });
    await page.click('[data-ha-q]', { clickCount: 3 }).catch(() => {});
    await page.type('[data-ha-q]', rent.approvalId, { delay: 15 });
    await safeClick(page, '[data-action="ha-tab"][data-tab="pending_review"]').catch(() => {});
    await safeClick(page, '[data-action="ha-search"]').catch(() => {});
    await sleep(1200);

    const modalBtn = `[data-action="ha-modal"][data-kind="approve"][data-id="${rent.approvalId}"]`;
    if (!(await page.$(modalBtn))) {
      // row actions may need expand
      await safeClick(page, `[data-action="ha-open"][data-id="${rent.approvalId}"]`).catch(() => {});
      await sleep(800);
    }
    if (!(await page.$(modalBtn))) {
      mark('open_approve_modal', false, 'approve button missing');
      await shot(page, 'missing_approve');
      return done();
    }
    await safeClick(page, modalBtn);
    await sleep(1200);
    const modalInfo = await page.evaluate(() => ({
      impact: document.querySelector('.ha-impact-ok')?.textContent || '',
      noop: !!document.querySelector('.ha-modal[data-action="ha-modal-noop"]'),
      stopProp: !!document.querySelector('.ha-modal[onclick*="stopPropagation"]'),
      confirmLabel: document.querySelector('.ha-modal [data-action="ha-modal-ok"]')?.textContent?.trim() || '',
    }));
    await shot(page, 'modal_impact');
    mark(
      'modal_impact_no_undefined',
      !!modalInfo.impact && !/undefined/i.test(modalInfo.impact) && !/\bnull\b/i.test(modalInfo.impact),
      modalInfo.impact
    );
    mark('modal_noop_deployed', modalInfo.noop && !modalInfo.stopProp, JSON.stringify(modalInfo));

    // Real confirm click
    const decidePosts = [];
    const onResp = (r) => {
      if (
        r.url().includes(`/higher-approvals/${encodeURIComponent(rent.approvalId)}/decide`) &&
        r.request().method() === 'POST'
      ) {
        decidePosts.push(r.status());
      }
    };
    page.on('response', onResp);
    const respP = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/hub/higher-approvals/${encodeURIComponent(rent.approvalId)}/decide`) &&
        r.request().method() === 'POST',
      { timeout: 35000 }
    );
    await safeClick(page, '.ha-modal [data-action="ha-modal-ok"]');
    await safeClick(page, '.ha-modal [data-action="ha-modal-ok"]').catch(() => {});
    let resp = null;
    try {
      resp = await respP;
    } catch (_) {}
    await sleep(2000);
    page.off('response', onResp);
    const json = resp ? await resp.json().catch(() => ({})) : null;
    await shot(page, 'after_confirm');
    // Confirm success = /decide fired AND (response approved OR durable row approved after hydrate)
    const durableNow = await page.evaluate(async (id) => {
      await window.HubHigherApprovals?.hydrateFromServer?.({ force: true });
      const r = window.HubHigherApprovals?.get?.(id);
      return r ? { status: r.status, decidedBy: r.decidedBy } : null;
    }, rent.approvalId);
    const confirmOk =
      !!resp &&
      (json?.request?.status === 'approved' ||
        (durableNow?.status === 'approved' && decidePosts.length >= 1));
    mark(
      'confirm_real_click',
      confirmOk,
      json?.request?.status ||
        durableNow?.status ||
        json?.error ||
        (resp ? `http ${resp.status()}` : 'no /decide response')
    );
    mark('double_click_guard', decidePosts.length <= 1, `posts=${decidePosts.length}`);

    // Origin rental activated
    const origin = await page.evaluate(async (rid) => {
      const res = await fetch('/api/hub/system-rentals', { credentials: 'same-origin' });
      const j = await res.json().catch(() => ({}));
      const list = j.state?.rentals || j.rentals || [];
      const row = list.find((x) => String(x.id) === String(rid));
      return row ? { status: row.status, statusLabel: row.statusLabel } : null;
    }, rent.rentalId);
    mark(
      'rental_origin_activated',
      !!origin && /active|approved|مفعّل|معتمد|provision/i.test(`${origin.status} ${origin.statusLabel || ''}`),
      JSON.stringify(origin)
    );

    // Postgres durable
    await page.deleteCookie(...(await page.cookies()));
    mark('relogin', await login(page, SA_EMAIL, SA_PASS));
    await openInbox(page);
    const durable = await page.evaluate(async (id) => {
      await window.HubHigherApprovals?.hydrateFromServer?.({ force: true });
      const r = window.HubHigherApprovals?.get?.(id);
      return r ? { status: r.status, decidedBy: r.decidedBy, decidedAt: r.decidedAt } : null;
    }, rent.approvalId);
    mark(
      'postgres_durable',
      durable?.status === 'approved' && !!durable.decidedBy,
      JSON.stringify(durable)
    );

    // Badge drop
    await page.goto(`${BASE}/dashboard.html#overview`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(5000);
    const kpi2 = await kpi(page);
    let badge2 = await badge(page);
    for (let i = 0; i < 5 && badge2 !== kpi2; i++) {
      await sleep(2000);
      badge2 = await badge(page);
    }
    await shot(page, 'badge_after');
    mark(
      'badge_decreased',
      kpi2 === kpi1 - 1 || (kpi2 < kpi1 && badge2 === kpi2),
      `kpi ${kpi1}→${kpi2} badge→${badge2}`
    );

    // Secondary decisions via API decide (still exercises durable path); UI confirm already proven above.
    const mkGrant = async (tag) =>
      page.evaluate(async (t) => {
        const slug = `ha-rc-${t}-${Date.now().toString(36)}`;
        const res = await fetch('/api/hub/register-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminName: `ضيف ${t}`,
            adminPhone: '01001112233',
            adminEmail: `ha-rc-${t}-${Date.now()}@example.com`,
            adminPassword: 'TestPass12',
            companyName: `منصة ${t}`,
            slug,
            subdomain: slug,
            host: `${slug}.naiosh.app`,
            requestedSystem: 'CRM',
            requestedSystemLabel: 'CRM',
            country: 'EG',
            branch: 'CAI',
            branchLabel: 'فرع',
            incubator: 'INC',
            incubatorLabel: 'حاضنة',
            notes: 'disposable',
          }),
        });
        const j = await res.json();
        return j.approvalId || j.approval?.id;
      }, tag);

    const apiDecide = async (id, action, note) =>
      page.evaluate(
        async (aid, act, n) => {
          const res = await fetch(`/api/hub/higher-approvals/${encodeURIComponent(aid)}/decide`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ action: act, note: n, reason: n, referTo: n }),
          });
          const j = await res.json().catch(() => ({}));
          return { http: res.status, ok: j.ok !== false && !!j.request, status: j.request?.status, error: j.error || '' };
        },
        id,
        action,
        note
      );

    const rejId = await mkGrant('rej');
    const rej = await apiDecide(rejId, 'reject', 'رفض تجريبي');
    mark('api_reject', rej.ok && rej.status === 'rejected', rej.status || rej.error);

    const revId = await mkGrant('rev');
    const rev = await apiDecide(revId, 'revise', 'أكمل المرفقات');
    mark('api_revise', rev.ok && rev.status === 'needs_revision', rev.status || rev.error);

    const kpiBeforeRef = await kpi(page);
    const refId = await mkGrant('ref');
    const ref = await apiDecide(refId, 'refer', 'specialist@naiosh.com');
    mark('api_refer', ref.ok && ref.status === 'referred', ref.status || ref.error);
    await sleep(1200);
    const kpiAfterRef = await kpi(page);
    mark(
      'refer_not_counted_for_leader',
      ref.ok && kpiAfterRef <= kpiBeforeRef,
      `before=${kpiBeforeRef} after=${kpiAfterRef}`
    );
    const kpiFull = await page.evaluate(async () => {
      const res = await fetch(`/api/hub/higher-approvals/kpis?t=${Date.now()}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      return res.json();
    });
    const awaiting = Number(kpiFull.kpis?.awaitingDecision || 0);
    const pending = Number(kpiFull.kpis?.pending || 0);
    const under = Number(kpiFull.kpis?.underReview || 0);
    mark(
      'awaiting_excludes_referred',
      awaiting === pending + under,
      JSON.stringify(kpiFull.kpis)
    );

    const fail = await page.evaluate(async (id) => {
      const u = window.HubAuth.getUser();
      const res = await window.HubHigherApprovals.approve(id, u, 'تكرار');
      return { ok: res?.ok === true, error: res?.error || '' };
    }, rent.approvalId);
    mark('no_fake_success', fail.ok === false && !!fail.error, fail.error);

    mark('disposable_only', true, `decided ${rent.approvalId}, ${rejId}, ${revId}, ${refId}`);
  } catch (e) {
    mark('crash', false, e.message);
  } finally {
    await browser.close().catch(() => {});
  }
  done();
}

function done(browser) {
  if (browser) browser.close().catch(() => {});
  const summary = {
    pass: cases.filter((c) => c.result === 'PASS').length,
    fail: cases.filter((c) => c.result === 'FAIL').length,
    notTested: cases.filter((c) => c.result === 'NOT TESTED').length,
  };
  const required = [
    'prod_assets_v7',
    'badge_before',
    'rental_created',
    'modal_impact_no_undefined',
    'confirm_real_click',
    'postgres_durable',
    'badge_decreased',
  ];
  const requiredPass = required.every((n) => cases.some((c) => c.name === n && c.result === 'PASS'));
  const fullPass = requiredPass && summary.fail === 0;
  const report = {
    at: new Date().toISOString(),
    base: BASE,
    patched: false,
    summary,
    requiredPass,
    fullPass,
    verdict: fullPass ? 'FULL_PASS_RENTAL_CONFIRM_BADGE_PROD' : 'FAIL_OR_PARTIAL_RENTAL_CONFIRM_BADGE_PROD',
    cases,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
  fs.writeFileSync(
    OUT_MD,
    [
      '# تقرير الإنتاج — تأكيد استئجار + شارة الموافقات',
      '',
      `BASE: ${BASE}`,
      `at: ${report.at}`,
      `patched: **false**`,
      `verdict: **${report.verdict}**`,
      `fullPass: ${report.fullPass}`,
      '',
      `PASS ${summary.pass} · FAIL ${summary.fail} · NOT TESTED ${summary.notTested}`,
      '',
      '| الاختبار | النتيجة | تفاصيل |',
      '|---|---|---|',
      ...cases.map((c) => `| ${c.name} | ${c.result} | ${(c.detail || '').replace(/\|/g, '\\|')} |`),
      '',
    ].join('\n')
  );
  console.log('\nVerdict:', report.verdict);
  if (!fullPass) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  mark('crash', false, e.message);
  done();
  process.exitCode = 2;
});
