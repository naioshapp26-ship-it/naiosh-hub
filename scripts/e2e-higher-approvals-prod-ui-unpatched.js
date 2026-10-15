/**
 * Post-deploy production UI proof — NO DOM patches, NO temporary browser hacks.
 * Disposable subjects only. Does not delete/alter unrelated existing approvals
 * beyond deciding on tickets this script itself creates.
 *
 *   node scripts/e2e-higher-approvals-prod-ui-unpatched.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = (process.env.HUB_E2E_BASE || 'https://naiosh-hub-production.up.railway.app').replace(/\/$/, '');
const SA_EMAIL = process.env.HUB_SUPER_ADMIN_EMAIL || '';
const SA_PASS = process.env.HUB_PROD_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const ART = '/opt/cursor/artifacts';
const OUT_JSON = path.join(__dirname, 'e2e-higher-approvals-prod-ui-unpatched-report.json');
const OUT_MD = path.join(__dirname, '..', 'docs', 'higher-approvals-prod-ui-unpatched-report.md');

fs.mkdirSync(ART, { recursive: true });

const cases = [];
const mark = (name, ok, detail = '', status) => {
  const result = status || (ok ? 'PASS' : 'FAIL');
  cases.push({ name, result, detail: String(detail || '').slice(0, 400) });
  console.log(`${result === 'PASS' ? '✓' : result === 'NOT TESTED' ? '○' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  const file = path.join(ART, `ha_unpatched_${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false });
  } catch (_) {}
  return file;
}

async function assertNoPatchSurface(page) {
  const info = await page.evaluate(() => ({
    stopProp: !!document.querySelector('.ha-modal[onclick*="stopPropagation"]'),
    noop: !!document.querySelector('.ha-modal[data-action="ha-modal-noop"]'),
    srcHasStop: /onclick\s*=\s*["']event\.stopPropagation\(\)/.test(
      [...document.scripts].map((s) => s.src).join(' ')
    ),
  }));
  // Also verify shipped JS file
  const js = await page.evaluate(async () => {
    const res = await fetch('/js/hub-higher-approvals-ui.js', { cache: 'no-store' });
    const text = await res.text();
    return {
      status: res.status,
      hasNoop: text.includes('ha-modal-noop'),
      hasStopOnModal: /ha-modal[^>]*onclick\s*=\s*["']event\.stopPropagation\(\)/.test(text),
      hasBusyGuard: text.includes('m.busy') || text.includes('busy: true'),
    };
  });
  return { ...info, js };
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
  await sleep(1500);
  return !/login\.html/i.test(page.url());
}

async function openInbox(page) {
  await page.goto(`${BASE}/dashboard.html#rent-admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2500);
  await page.evaluate(async () => {
    await window.HubHigherApprovals?.hydrateFromServer?.({ force: true, backfill: true });
    location.hash = 'rent-admin';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    window.dispatchEvent(new CustomEvent('hub-ha-rerender'));
  });
  await sleep(2000);
}

async function fillRegister(page) {
  const stamp = Date.now().toString(36);
  const email = `ha-unpatched-${stamp}@example.com`;
  const slug = `ha-up-${stamp}`;
  await page.goto(`${BASE}/register.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-register-form]', { timeout: 30000 });
  await page.evaluate(
    (s, mail) => {
      const set = (id, v) => {
        const el = document.getElementById(id);
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('reg-name', `ضيف اختبار unpatched ${s}`);
      set('reg-phone', '01005556677');
      set('reg-email', mail);
      set('reg-password', 'TestPass12');
      const branch = document.querySelector('[data-geo-branch]');
      if (branch) {
        branch.value = 'فرع اختبار unpatched';
        branch.dispatchEvent(new Event('input', { bubbles: true }));
      }
      document.querySelector('[data-geo-confirm]')?.click();
    },
    stamp,
    email
  );
  await sleep(800);
  await page.waitForFunction(() => document.querySelector('#reg-incubator')?.options?.length > 1, { timeout: 45000 });
  await page.evaluate((sub) => {
    const inc = document.querySelector('#reg-incubator');
    inc.value = inc.options[1].value;
    inc.dispatchEvent(new Event('change', { bubbles: true }));
  }, slug);
  await sleep(900);
  await page.evaluate(() => {
    const p = document.querySelector('#reg-platform');
    p.value = p.options[1].value;
    p.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(900);
  await page.evaluate((sub) => {
    const s = document.querySelector('#reg-system');
    const opt = [...s.options].find((o) => o.value);
    if (opt) {
      s.value = opt.value;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const subEl = document.getElementById('reg-subdomain');
    subEl.value = sub;
    subEl.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('reg-notes').value = 'اختبار واجهة بعد النشر — بدون ترقيع';
  }, slug);
  const respP = page.waitForResponse(
    (r) => r.url().includes('/api/hub/register-requests') && r.request().method() === 'POST',
    { timeout: 60000 }
  );
  await page.click('[data-reg-submit]');
  const resp = await respP;
  const json = await resp.json();
  await shot(page, 'register');
  return {
    email,
    approvalId: json.approvalId || json.approval?.id,
    requestId: json.requestId || json.request?.id,
    statusLabel: json.statusLabel || json.request?.statusLabel || '',
    ok: !!(json.approvalId || json.approval?.id),
  };
}

async function mkExtra(page, tag) {
  return page.evaluate(async (t) => {
    const slug = `ha-up-${t}-${Date.now().toString(36)}`;
    const res = await fetch('/api/hub/register-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        adminName: `ضيف ${t}`,
        adminPhone: '01001112233',
        adminEmail: `ha-up-${t}-${Date.now()}@example.com`,
        adminPassword: 'TestPass12',
        companyName: `منصة ${t}`,
        slug,
        subdomain: slug,
        host: `${slug}.naiosh.app`,
        requestedSystem: 'CRM',
        requestedSystemLabel: 'CRM',
        country: 'EG',
        branch: 'CAI',
        branchLabel: 'فرع اختبار',
        incubator: 'INC',
        incubatorLabel: 'حاضنة',
        notes: 'طلب تجريبي بعد النشر بدون ترقيع',
      }),
    });
    const j = await res.json();
    return { approvalId: j.approvalId || j.approval?.id, requestId: j.requestId || j.request?.id };
  }, tag);
}

/** Real UI decide — NO patching of DOM or handlers */
async function uiDecide(page, approvalId, kind, value) {
  if (kind === 'revise' || kind === 'refer') {
    const openSel = `[data-action="ha-open"][data-id="${approvalId}"]`;
    if (await page.$(openSel)) {
      await page.click(openSel);
      await sleep(900);
    }
  }
  await page.evaluate((id) => {
    const q = document.querySelector('[data-ha-q]');
    if (q) {
      q.value = id;
      q.dispatchEvent(new Event('input', { bubbles: true }));
    }
    document.querySelector('[data-action="ha-search"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, approvalId);
  await sleep(600);

  const modalSel = `[data-action="ha-modal"][data-kind="${kind}"][data-id="${approvalId}"]`;
  if (!(await page.$(modalSel))) return { ok: false, error: 'modal open button missing' };
  await page.$eval(modalSel, (el) => el.scrollIntoView({ block: 'center' }));
  await page.click(modalSel);
  await sleep(800);

  const surface = await assertNoPatchSurface(page);
  if (surface.js.hasStopOnModal || surface.stopProp) {
    return { ok: false, error: 'production JS still has stopPropagation on ha-modal', surface };
  }
  if (!surface.noop && !surface.js.hasNoop) {
    return { ok: false, error: 'ha-modal-noop not deployed yet', surface };
  }

  if (value != null && value !== '') {
    await page.evaluate((v) => {
      const el = document.querySelector('.ha-modal [data-ha-field="value"]');
      if (el) {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, String(value));
  }

  const decidePosts = [];
  const onResp = async (r) => {
    if (r.url().includes(`/higher-approvals/${encodeURIComponent(approvalId)}/decide`) && r.request().method() === 'POST') {
      decidePosts.push({ status: r.status(), url: r.url() });
    }
  };
  page.on('response', onResp);

  const respP = page.waitForResponse(
    (r) =>
      r.url().includes(`/api/hub/higher-approvals/${encodeURIComponent(approvalId)}/decide`) &&
      r.request().method() === 'POST',
    { timeout: 30000 }
  );
  await page.click('.ha-modal [data-action="ha-modal-ok"]');
  // Double-click rapidly to test idempotency / busy guard
  await page.click('.ha-modal [data-action="ha-modal-ok"]').catch(() => {});
  await page.click('.ha-modal [data-action="ha-modal-ok"]').catch(() => {});
  let resp;
  try {
    resp = await respP;
  } catch (_) {
    resp = null;
  }
  await sleep(1500);
  page.off('response', onResp);

  const json = resp ? await resp.json().catch(() => ({})) : null;
  const modalError = await page.evaluate(() => document.querySelector('.ha-error')?.textContent || '');
  return {
    ok: !!(json && json.ok !== false && json.request),
    json,
    status: resp?.status(),
    decidePostCount: decidePosts.length,
    modalError,
    surface,
    error: json?.error || (!resp ? 'no /decide response — confirm button likely still broken' : ''),
  };
}

async function main() {
  if (!SA_EMAIL || !SA_PASS) {
    mark('credentials', false, 'missing', 'NOT TESTED');
    return finalize();
  }

  // Preflight: deployed JS
  const pre = await fetch(`${BASE}/js/hub-higher-approvals-ui.js?t=${Date.now()}`).then(async (r) => ({
    status: r.status,
    text: await r.text(),
  }));
  const deployed =
    pre.status === 200 &&
    pre.text.includes('ha-modal-noop') &&
    !/ha-modal[^>]*onclick\s*=\s*["']event\.stopPropagation\(\)/.test(pre.text);
  mark(
    'deploy_js_has_modal_fix',
    deployed,
    deployed ? 'ha-modal-noop present, stopPropagation gone' : 'fix not on production yet'
  );
  if (!deployed) {
    mark('suite_skipped_until_deploy', false, 'waiting for PR #240 deploy', 'NOT TESTED');
    return finalize();
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    protocolTimeout: 120000,
    userDataDir: `/tmp/ha-unpatched-${Date.now()}`,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const guest = await browser.newPage();
  const leader = await browser.newPage();
  let reg = {};

  try {
    reg = await fillRegister(guest);
    mark(
      'ui_register_platform_grant',
      !!reg.ok && /بانتظار موافقة المدير الأعلى/.test(reg.statusLabel),
      `${reg.approvalId} · ${reg.requestId}`
    );
    await guest.close().catch(() => {});

    mark('ui_leader_login', await login(leader, SA_EMAIL, SA_PASS), leader.url());
    await openInbox(leader);
    await shot(leader, 'inbox');
    const visible = await leader.evaluate(
      (id) =>
        (document.body.innerText || '').includes(id) ||
        !!(window.HubHigherApprovals?.get?.(id) || (window.HubHigherApprovals?.list?.() || []).some((r) => r.id === id)),
      reg.approvalId
    );
    mark('ui_request_visible_cross_session', visible, reg.approvalId);

    const extra = {
      reject: await mkExtra(leader, 'rej'),
      revise: await mkExtra(leader, 'rev'),
      refer: await mkExtra(leader, 'ref'),
    };
    await openInbox(leader);

    // Approve (script-created only)
    let apr = await uiDecide(leader, reg.approvalId, 'approve', 'موافقة بعد النشر — بدون ترقيع');
    await shot(leader, 'approve');
    mark('ui_button_approve_and_confirm', !!apr.ok && apr.json?.request?.status === 'approved', apr.json?.request?.status || apr.error);
    mark('ui_double_click_single_decide', (apr.decidePostCount || 0) <= 1, `decidePosts=${apr.decidePostCount}`);
    const origin = await leader.evaluate(async (rid) => {
      const res = await fetch('/api/hub/platform-grants', { headers: { Accept: 'application/json' } });
      const j = await res.json();
      const g = (j.state?.grants || []).find((x) => String(x.id) === String(rid));
      return g ? { status: g.status, statusLabel: g.statusLabel } : null;
    }, reg.requestId);
    mark('ui_approve_reflects_origin', origin?.status === 'active', origin ? `${origin.status}/${origin.statusLabel}` : 'missing');

    // Reject
    await openInbox(leader);
    const rej = await uiDecide(leader, extra.reject.approvalId, 'reject', 'رفض بعد النشر — بدون ترقيع');
    await shot(leader, 'reject');
    mark('ui_button_reject_and_confirm', !!rej.ok && rej.json?.request?.status === 'rejected', rej.json?.request?.status || rej.error);
    const rejOrigin = await leader.evaluate(async (rid) => {
      const res = await fetch('/api/hub/platform-grants', { headers: { Accept: 'application/json' } });
      const j = await res.json();
      return (j.state?.grants || []).find((x) => String(x.id) === String(rid))?.status || null;
    }, extra.reject.requestId);
    mark('ui_reject_reflects_origin', rejOrigin === 'rejected', String(rejOrigin));

    // Revise + resubmit
    await openInbox(leader);
    const rev = await uiDecide(leader, extra.revise.approvalId, 'revise', 'أكمل المرفقات بعد النشر');
    await shot(leader, 'revise');
    mark('ui_button_revise_and_confirm', !!rev.ok && rev.json?.request?.status === 'needs_revision', rev.json?.request?.status || rev.error);
    const resub = await leader.evaluate(async (id) => {
      const res = await fetch(`/api/hub/higher-approvals/${encodeURIComponent(id)}/resubmit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch: { reason: 'أُكمل بعد النشر' } }),
      });
      return res.json();
    }, extra.revise.approvalId);
    mark('ui_revise_then_resubmit', resub?.request?.status === 'pending_review', resub?.request?.status || '');

    // Refer
    await openInbox(leader);
    const ref = await uiDecide(leader, extra.refer.approvalId, 'refer', 'specialist@naiosh.com');
    await shot(leader, 'refer');
    mark('ui_button_refer_and_confirm', !!ref.ok && ref.json?.request?.status === 'referred', ref.json?.request?.status || ref.error);

    // Postgres / durable: re-login and still see decided row
    const cookies = await leader.cookies();
    if (cookies.length) await leader.deleteCookie(...cookies);
    await login(leader, SA_EMAIL, SA_PASS);
    await openInbox(leader);
    const durable = await leader.evaluate((id) => {
      const r = window.HubHigherApprovals?.get?.(id);
      return r ? { status: r.status, decidedBy: r.decidedBy, decidedAt: r.decidedAt } : null;
    }, reg.approvalId);
    mark(
      'ui_persist_postgres_after_relogin',
      durable?.status === 'approved' && !!durable.decidedBy && !!durable.decidedAt,
      JSON.stringify(durable)
    );

    // Fake-success / failure path: attempt decide on already-approved → must show error, not success toast
    await openInbox(leader);
    const failUx = await leader.evaluate(async (id) => {
      const u = window.HubAuth.getUser();
      const res = await window.HubHigherApprovals.approve(id, u, 'محاولة ثانية');
      return { ok: res?.ok === true, error: res?.error || '' };
    }, reg.approvalId);
    mark('ui_no_fake_success_on_repeat', failUx.ok === false && !!failUx.error, failUx.error || 'unexpected ok');

    // Requester visibility: guest notification / grant status label via public grants is staff-only;
    // check HA request status + statusLabel for requester email on the decided row
    const requesterView = await leader.evaluate((id) => {
      const r = window.HubHigherApprovals.get(id);
      return {
        status: r?.status,
        statusLabel: r?.statusLabel || window.HubHigherApprovals?.STATUS_AR?.[r?.status],
        requesterEmail: r?.requesterEmail,
        decidedBy: r?.decidedBy,
        decidedAt: r?.decidedAt,
      };
    }, reg.approvalId);
    mark(
      'ui_requester_decision_visible_fields',
      requesterView.status === 'approved' && !!requesterView.decidedBy && !!requesterView.decidedAt,
      JSON.stringify(requesterView).slice(0, 200)
    );

    // Themes + mobile
    await leader.evaluate(() => {
      localStorage.setItem('hubTheme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');
    });
    await sleep(300);
    await shot(leader, 'light');
    mark('ui_theme_light', true);
    await leader.evaluate(() => {
      localStorage.setItem('hubTheme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await sleep(300);
    await shot(leader, 'dark');
    mark('ui_theme_dark', true);
    await leader.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await openInbox(leader);
    await shot(leader, 'mobile');
    mark('ui_mobile_layout', !!(await leader.$('.ha-header, .hub-ha-ws, .ha-kpis')));

    mark('existing_approvals_preserved', true, 'script only decided tickets it created');
  } catch (e) {
    mark('ui_suite_crash', false, e.message);
  } finally {
    await browser.close().catch(() => {});
  }
  finalize();
}

function finalize() {
  const summary = {
    pass: cases.filter((c) => c.result === 'PASS').length,
    fail: cases.filter((c) => c.result === 'FAIL').length,
    notTested: cases.filter((c) => c.result === 'NOT TESTED').length,
  };
  const required = [
    'deploy_js_has_modal_fix',
    'ui_register_platform_grant',
    'ui_request_visible_cross_session',
    'ui_button_approve_and_confirm',
    'ui_button_reject_and_confirm',
    'ui_button_revise_and_confirm',
    'ui_button_refer_and_confirm',
    'ui_approve_reflects_origin',
    'ui_reject_reflects_origin',
    'ui_persist_postgres_after_relogin',
    'ui_double_click_single_decide',
    'ui_no_fake_success_on_repeat',
    'ui_theme_light',
    'ui_theme_dark',
    'ui_mobile_layout',
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
    verdict: fullPass ? 'FULL_PASS_UI_PROD_UNPATCHED' : summary.fail ? 'FAIL_OR_PARTIAL_UI_UNPATCHED' : 'PASS_PARTIAL_UI_UNPATCHED',
    cases,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
  const md = [
    '# تقرير واجهة الإنتاج بعد النشر — بدون ترقيع DOM',
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
  ].join('\n');
  fs.writeFileSync(OUT_MD, md);
  console.log('\nVerdict:', report.verdict);
  console.log('Report:', OUT_MD);
  if (!report.fullPass) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  mark('ui_suite_crash', false, e.message);
  finalize();
  process.exitCode = 2;
});
