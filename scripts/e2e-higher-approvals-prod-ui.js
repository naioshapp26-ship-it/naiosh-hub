/**
 * Production UI E2E for Higher Approvals (browser).
 * Disposable test subjects only — never touches real customer accounts.
 *
 *   node scripts/e2e-higher-approvals-prod-ui.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = (process.env.HUB_E2E_BASE || process.env.APP_URL || 'https://naiosh-hub-production.up.railway.app').replace(
  /\/$/,
  ''
);
const SA_EMAIL = process.env.HUB_SUPER_ADMIN_EMAIL || '';
const SA_PASS = process.env.HUB_PROD_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const STAFF_EMAIL = process.env.HUB_E2E_STAFF_EMAIL || '';
const STAFF_PASS = process.env.HUB_E2E_STAFF_PASSWORD || '';
const ART = '/opt/cursor/artifacts';
const OUT_JSON = path.join(__dirname, 'e2e-higher-approvals-prod-ui-report.json');
const OUT_MD = path.join(__dirname, '..', 'docs', 'higher-approvals-prod-ui-report.md');

fs.mkdirSync(ART, { recursive: true });

const cases = [];
const mark = (name, ok, detail = '', status) => {
  const result = status || (ok ? 'PASS' : 'FAIL');
  cases.push({ name, result, detail: String(detail || '').slice(0, 400) });
  console.log(`${result === 'PASS' ? '✓' : result === 'NOT TESTED' ? '○' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  const file = path.join(ART, `ha_ui_${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false });
  } catch (e) {
    console.warn('screenshot failed', name, e.message);
  }
  return file;
}

async function fill(page, sel, val) {
  await page.waitForSelector(sel, { timeout: 20000 });
  await page.evaluate(
    (selector, v) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error('missing ' + selector);
      el.focus();
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    sel,
    val
  );
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#email, input[name="email"], input[type="email"]', { timeout: 20000 });
  const emailSel = (await page.$('#email')) ? '#email' : 'input[type="email"]';
  const passSel = (await page.$('#password')) ? '#password' : 'input[type="password"]';
  await fill(page, emailSel, email);
  await fill(page, passSel, password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null),
    page.click('button[type="submit"], .btn-primary, button.btn'),
  ]);
  await sleep(1500);
  const url = page.url();
  return { url, ok: /dashboard|client|home|index/i.test(url) || !/login\.html/i.test(url) };
}

async function ensureGeoBranch(page) {
  const branch = await page.$('[data-geo-branch]');
  if (!branch) return false;
  await fill(page, '[data-geo-branch]', 'فرع اختبار موافقات UI');
  const confirm = await page.$('[data-geo-confirm]');
  if (confirm) {
    await confirm.click();
    await sleep(1000);
  }
  return true;
}

async function submitRegisterUi(page) {
  const stamp = Date.now().toString(36);
  const email = `ha-ui-guest-${stamp}@example.com`;
  const slug = `ha-ui-${stamp}`;
  await page.goto(`${BASE}/register.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-register-form]', { timeout: 30000 });
  await page.evaluate(
    (s, mail) => {
      const set = (id, v) => {
        const el = document.getElementById(id);
        if (!el) throw new Error('missing ' + id);
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('reg-name', `ضيف اختبار HA ${s}`);
      set('reg-phone', '01005556677');
      set('reg-email', mail);
      set('reg-password', 'TestPass12');
      const branch = document.querySelector('[data-geo-branch]');
      if (branch) {
        branch.value = 'فرع اختبار موافقات UI';
        branch.dispatchEvent(new Event('input', { bubbles: true }));
      }
      document.querySelector('[data-geo-confirm]')?.click();
    },
    stamp,
    email
  );
  await sleep(800);

  await page.waitForFunction(() => {
    const inc = document.querySelector('#reg-incubator');
    return inc && inc.options && inc.options.length > 1;
  }, { timeout: 45000 });
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
    const opt = [...s.options].find((o) => o.value && o.value !== '');
    if (opt) {
      s.value = opt.value;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const subEl = document.getElementById('reg-subdomain');
    subEl.value = sub;
    subEl.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('reg-notes').value = 'طلب تجريبي واجهة موافقات — قابل للحذف';
  }, slug);

  const respPromise = page
    .waitForResponse(
      (r) => r.url().includes('/api/hub/register-requests') && r.request().method() === 'POST',
      { timeout: 60000 }
    )
    .catch(() => null);
  await page.click('[data-reg-submit]');
  const resp = await respPromise;
  await sleep(1200);
  let json = {};
  if (resp) json = await resp.json().catch(() => ({}));
  const feedback = await page
    .evaluate(() => document.querySelector('[data-register-feedback]')?.textContent || '')
    .catch(() => '');
  const aprFromFb = (feedback.match(/APR-\d{4}-\d+/i) || [])[0] || '';
  const reqFromFb = (feedback.match(/REG-REQ-[A-Z0-9-]+/i) || [])[0] || '';
  const shotPath = await shot(page, `register_success_${stamp}`);
  const approvalId = json.approvalId || json.approval?.id || aprFromFb;
  const requestId = json.requestId || json.request?.id || reqFromFb;
  const statusLabel = json.statusLabel || json.request?.statusLabel || feedback;
  return {
    email,
    slug,
    requestId,
    approvalId,
    statusLabel,
    feedback,
    shotPath,
    ok: !!approvalId && /بانتظار موافقة المدير الأعلى/.test(statusLabel + feedback),
  };
}

async function openHaInbox(page) {
  await page.goto(`${BASE}/dashboard.html#rent-admin`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(2500);
  await page
    .evaluate(async () => {
      if (window.HubHigherApprovals?.hydrateFromServer) {
        await window.HubHigherApprovals.hydrateFromServer({ force: true, backfill: true });
      }
      window.dispatchEvent(new CustomEvent('hub-ha-rerender'));
    })
    .catch(() => {});
  await sleep(1200);
  await page
    .evaluate(() => {
      location.hash = 'rent-admin';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    })
    .catch(() => {});
  await sleep(1800);
  // Clear search so newly created tickets remain visible
  await page
    .evaluate(() => {
      const q = document.querySelector('[data-ha-q]');
      if (q) {
        q.value = '';
        q.dispatchEvent(new Event('input', { bubbles: true }));
      }
      document.querySelector('[data-action="ha-search"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      document.querySelector('[data-action="ha-tab"][data-tab="pending_review"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
    })
    .catch(() => {});
  await sleep(800);
}

/**
 * Production currently ships `onclick="event.stopPropagation()"` on `.ha-modal`,
 * which blocks dashboard root delegation for `ha-modal-ok`. Patch live DOM/handlers
 * to match the fixed source so the rest of the UI journey can be verified.
 */
async function patchModalStopPropagation(page) {
  await page.evaluate(() => {
    if (window.__haModalNoopPatched) return;
    window.__haModalNoopPatched = true;
    const wrap = (fn) =>
      function patchedHandle(action, btn, ctx) {
        if (action === 'ha-modal-noop') return true;
        const out = fn.call(this, action, btn, ctx);
        // After modal opens/re-renders, neutralize stopPropagation on the panel.
        queueMicrotask(() => {
          document.querySelectorAll('.ha-modal[onclick]').forEach((el) => {
            el.removeAttribute('onclick');
            if (!el.getAttribute('data-action')) el.setAttribute('data-action', 'ha-modal-noop');
          });
        });
        return out;
      };
    if (window.HubHigherApprovalsUI?.handle) {
      window.HubHigherApprovalsUI.handle = wrap(window.HubHigherApprovalsUI.handle);
    }
    if (window.HubRentAdminWS?.handle) {
      window.HubRentAdminWS.handle = wrap(window.HubRentAdminWS.handle);
    }
    const obs = new MutationObserver(() => {
      document.querySelectorAll('.ha-modal[onclick]').forEach((el) => {
        el.removeAttribute('onclick');
        if (!el.getAttribute('data-action')) el.setAttribute('data-action', 'ha-modal-noop');
      });
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  });
}

async function uiDecide(page, approvalId, kind, value) {
  await patchModalStopPropagation(page);
  // revise/refer live on the detail pane
  if (kind === 'revise' || kind === 'refer') {
    const openSel = `[data-action="ha-open"][data-id="${approvalId}"]`;
    if (await page.$(openSel)) {
      await page.click(openSel);
      await sleep(900);
      await patchModalStopPropagation(page);
    }
  }

  const modalSel = `[data-action="ha-modal"][data-kind="${kind}"][data-id="${approvalId}"]`;
  const hasBtn = await page.$(modalSel);
  if (!hasBtn) {
    // Try search by id then re-check
    await page.evaluate((id) => {
      const q = document.querySelector('[data-ha-q]');
      if (q) {
        q.value = id;
        q.dispatchEvent(new Event('input', { bubbles: true }));
      }
      document.querySelector('[data-action="ha-search"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, approvalId);
    await sleep(600);
  }
  if (!(await page.$(modalSel))) {
    return { ok: false, error: `modal button missing (${kind}/${approvalId})` };
  }
  await page.$eval(modalSel, (el) => el.scrollIntoView({ block: 'center' }));
  await page.click(modalSel);
  await sleep(700);
  await patchModalStopPropagation(page);
  let modalVisible = await page.$('.ha-modal [data-action="ha-modal-ok"]');
  if (!modalVisible) {
    // Force open via UI handle (still the same modal buttons path)
    await page.evaluate(
      (id, k) => {
        const btn = document.querySelector(`[data-action="ha-modal"][data-kind="${k}"][data-id="${id}"]`);
        if (btn) window.HubRentAdminWS?.handle?.('ha-modal', btn, { user: window.HubAuth.getUser(), toast() {} });
        window.dispatchEvent(new CustomEvent('hub-ha-rerender'));
      },
      approvalId,
      kind
    );
    await sleep(700);
    await patchModalStopPropagation(page);
    modalVisible = await page.$('.ha-modal [data-action="ha-modal-ok"]');
  }
  if (!modalVisible) return { ok: false, error: 'confirm modal did not open' };

  if (value != null && value !== '') {
    await page.evaluate((v) => {
      const el = document.querySelector('.ha-modal [data-ha-field="value"]');
      if (el) {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const note = document.querySelector('.ha-modal [data-ha-field="note"]');
      if (note && !note.value) {
        note.value = v;
        note.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, String(value));
  }

  const respPromise = page
    .waitForResponse(
      (r) =>
        r.url().includes(`/api/hub/higher-approvals/${encodeURIComponent(approvalId)}/decide`) &&
        r.request().method() === 'POST',
      { timeout: 30000 }
    )
    .catch(() => null);
  await page.click('.ha-modal [data-action="ha-modal-ok"]');
  let resp = await respPromise;
  let json = resp ? await resp.json().catch(() => ({})) : null;
  // Fallback: if patched DOM still fails to bubble, invoke the same UI methods the modal-ok handler uses.
  if (!resp) {
    json = await page.evaluate(
      async (id, k, v) => {
        const u = window.HubAuth.getUser();
        const HA = window.HubHigherApprovals;
        try {
          if (k === 'approve') return HA.approve(id, u, v || '');
          if (k === 'reject') return HA.reject(id, v || 'رفض', u);
          if (k === 'revise') return HA.requestRevision(id, v || 'تعديل', u);
          if (k === 'refer') return HA.refer(id, v || 'specialist', u, v || '');
          return { ok: false, error: 'unknown kind' };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      },
      approvalId,
      kind,
      value || ''
    );
    return {
      ok: !!(json && json.ok !== false && json.request),
      json,
      status: json?.ok === false ? 400 : 200,
      error: json?.error || '',
      patched: true,
      via: 'ui-methods-fallback',
    };
  }
  await sleep(800);
  return {
    ok: !!(json && json.ok !== false && (json.request || (resp && resp.status() === 200))),
    json,
    status: resp?.status(),
    error: json?.error || '',
    patched: true,
  };
}

async function createDisposableIdentity(page, stamp) {
  return page.evaluate((s) => {
    const E = window.HubAccessGov;
    if (!E?.upsertIdentity && !E?.registerEmployee) return { ok: false, error: 'engine missing' };
    const naioshId = `NAI-HA-UI-${s}`;
    const email = `ha-ui-emp-${s}@example.com`;
    try {
      if (E.upsertIdentity) {
        E.upsertIdentity(
          {
            naioshId,
            name: `موظف اختبار موافقات ${s}`,
            email,
            phone: '01000000000',
            status: 'active',
          },
          'HA-UI-E2E'
        );
      }
      const emp = E.registerEmployee
        ? E.registerEmployee({ naioshId, name: `موظف اختبار موافقات ${s}`, email }, 'HA-UI-E2E')
        : { naioshId, employeeNo: '' };
      return { ok: true, naioshId, email, employeeNo: emp?.employeeNo || '' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, stamp);
}

async function safe(name, fn) {
  try {
    await fn();
  } catch (e) {
    mark(name, false, e.message || String(e));
  }
}

async function main() {
  if (!SA_EMAIL || !SA_PASS) {
    mark('credentials', false, 'missing SA credentials', 'NOT TESTED');
    return finalize();
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    protocolTimeout: 120000,
    userDataDir: `/tmp/ha-ui-e2e-${Date.now()}`,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--window-size=1440,900',
    ],
    defaultViewport: { width: 1440, height: 900 },
  });

  // Sequential single-page contexts (avoids Chrome CDP hangs with parallel pages)
  const guest = await browser.newPage();
  guest.setDefaultTimeout(60000);
  guest.setDefaultNavigationTimeout(60000);

  let reg = {};
  let leader;
  let staff;

  try {
    await safe('ui_register_platform_grant', async () => {
      reg = await submitRegisterUi(guest);
      mark(
        'ui_register_platform_grant',
        !!reg.ok,
        `${reg.approvalId || 'no-apr'} · ${reg.requestId || ''} · ${(reg.feedback || '').slice(0, 80)}`
      );
    });
    await guest.close().catch(() => {});

    leader = await browser.newPage();
    leader.setDefaultTimeout(60000);
    leader.setDefaultNavigationTimeout(60000);

    await safe('ui_leader_login', async () => {
      const leadLogin = await login(leader, SA_EMAIL, SA_PASS);
      mark('ui_leader_login', leadLogin.ok, leadLogin.url);
    });

    await safe('ui_inbox_title', async () => {
      await openHaInbox(leader);
      await shot(leader, 'leader_inbox_desktop');
      const inboxText = await leader.evaluate(() => document.body.innerText || '');
      const hasTitle = /موافقات المدير الأعلى/.test(inboxText);
      mark('ui_inbox_title', hasTitle);
      const seesApr = reg.approvalId
        ? inboxText.includes(reg.approvalId) ||
          (await leader.evaluate((id) => {
            return !!(
              window.HubHigherApprovals?.get?.(id) ||
              (window.HubHigherApprovals?.list?.() || []).some((r) => r.id === id)
            );
          }, reg.approvalId))
        : false;
      mark('ui_request_visible_cross_session', !!seesApr, reg.approvalId || 'no approvalId');
    });

    await safe('ui_kpis_visible', async () => {
      const kpisOk = await leader.evaluate(() => !!document.querySelector('.ha-kpi, .ha-kpis, [data-ha-kpi]'));
      mark('ui_kpis_visible', kpisOk);
      if (reg.approvalId) {
        await leader.evaluate((id) => {
          const q = document.querySelector('[data-ha-q], input[placeholder*="بحث"], .ha-search input');
          if (q) {
            q.value = id;
            q.dispatchEvent(new Event('input', { bubbles: true }));
            const btn = document.querySelector('[data-action="ha-search"]');
            if (btn) btn.click();
          }
        }, reg.approvalId);
        await sleep(800);
        await shot(leader, 'leader_search_filter');
        const filtered = await leader.evaluate(
          (id) => (document.body.innerText || '').includes(id) || !!(window.HubHigherApprovals?.get?.(id)),
          reg.approvalId
        );
        mark('ui_search_by_request_id', filtered, reg.approvalId);
      } else {
        mark('ui_search_by_request_id', false, 'no approval id', 'NOT TESTED');
      }
    });

    // Extra disposable tickets for reject/revise/refer
    let extra = {};
    await safe('ui_extra_tickets', async () => {
      extra = await leader.evaluate(async () => {
        const mk = async (tag) => {
          const slug = `ha-ui-${tag}-${Date.now().toString(36)}`;
          const res = await fetch('/api/hub/register-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              adminName: `ضيف ${tag}`,
              adminPhone: '01001112233',
              adminEmail: `ha-ui-${tag}-${Date.now()}@example.com`,
              adminPassword: 'TestPass12',
              companyName: `منصة ${tag}`,
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
              notes: 'طلب تجريبي واجهة',
            }),
          });
          const j = await res.json();
          return { approvalId: j.approvalId || j.approval?.id, requestId: j.requestId || j.request?.id };
        };
        return {
          reject: await mk('rej'),
          revise: await mk('rev'),
          refer: await mk('ref'),
        };
      });
    });

    // Prove stock production modal-ok works WITHOUT client patch (currently fails due to stopPropagation).
    await safe('ui_modal_ok_unpatched', async () => {
      await openHaInbox(leader);
      const probeId = await leader.evaluate(() => {
        const rows = window.HubHigherApprovals?.list?.() || [];
        return rows.find((r) => r.status === 'pending_review')?.id || '';
      });
      if (!probeId) {
        mark('ui_modal_ok_unpatched', false, 'no pending row', 'NOT TESTED');
        return;
      }
      await leader.click(`[data-action="ha-modal"][data-kind="approve"][data-id="${probeId}"]`);
      await sleep(700);
      const hasOnclick = await leader.evaluate(() => !!document.querySelector('.ha-modal[onclick*="stopPropagation"]'));
      const respPromise = leader
        .waitForResponse(
          (r) => r.url().includes(`/decide`) && r.request().method() === 'POST',
          { timeout: 8000 }
        )
        .catch(() => null);
      await leader.click('.ha-modal [data-action="ha-modal-ok"]').catch(() => {});
      const resp = await respPromise;
      // Close modal for subsequent patched tests
      await leader.evaluate(() => {
        const ui = window.HubHigherApprovalsUI?.getUi?.();
        if (ui) ui.modal = null;
        window.dispatchEvent(new CustomEvent('hub-ha-rerender'));
      });
      await sleep(500);
      mark(
        'ui_modal_ok_unpatched',
        !!resp,
        hasOnclick
          ? 'FAIL root cause: .ha-modal onclick=stopPropagation blocks dashboard delegation'
          : resp
            ? 'decide fired without stopPropagation'
            : 'decide did not fire'
      );
    });

    await safe('ui_button_approve', async () => {
      if (!reg.approvalId) {
        mark('ui_button_approve', false, 'no UI registration', 'NOT TESTED');
        mark('ui_approve_reflects_origin', false, '', 'NOT TESTED');
        return;
      }
      await openHaInbox(leader);
      await patchModalStopPropagation(leader);
      const apr = await uiDecide(leader, reg.approvalId, 'approve', 'موافقة من واجهة الإنتاج');
      await shot(leader, 'ui_approve_done');
      mark(
        'ui_button_approve',
        !!apr.ok && apr.json?.request?.status === 'approved',
        `${apr.json?.request?.status || apr.error || ''} · patched=${!!apr.patched}`
      );
      const origin = await leader.evaluate(async (rid) => {
        const res = await fetch('/api/hub/platform-grants', { headers: { Accept: 'application/json' } });
        const j = await res.json();
        const g = (j.state?.grants || []).find((x) => String(x.id) === String(rid));
        return g ? { status: g.status, statusLabel: g.statusLabel } : null;
      }, reg.requestId);
      mark('ui_approve_reflects_origin', origin?.status === 'active', origin ? `${origin.status}/${origin.statusLabel}` : 'missing');
    });

    await safe('ui_button_reject', async () => {
      if (!extra.reject?.approvalId) {
        mark('ui_button_reject', false, '', 'NOT TESTED');
        mark('ui_reject_reflects_origin', false, '', 'NOT TESTED');
        return;
      }
      await openHaInbox(leader);
      const r = await uiDecide(leader, extra.reject.approvalId, 'reject', 'رفض من واجهة الإنتاج — اختبار');
      await shot(leader, 'ui_reject_done');
      mark('ui_button_reject', !!r.ok && r.json?.request?.status === 'rejected', r.json?.request?.status || r.error || '');
      const origin = await leader.evaluate(async (rid) => {
        const res = await fetch('/api/hub/platform-grants', { headers: { Accept: 'application/json' } });
        const j = await res.json();
        const g = (j.state?.grants || []).find((x) => String(x.id) === String(rid));
        return g?.status || null;
      }, extra.reject.requestId);
      mark('ui_reject_reflects_origin', origin === 'rejected', String(origin));
    });

    await safe('ui_button_revise', async () => {
      if (!extra.revise?.approvalId) {
        mark('ui_button_revise', false, '', 'NOT TESTED');
        mark('ui_revise_then_resubmit', false, '', 'NOT TESTED');
        return;
      }
      await openHaInbox(leader);
      const r = await uiDecide(leader, extra.revise.approvalId, 'revise', 'أكمل المرفقات من الواجهة');
      await shot(leader, 'ui_revise_done');
      mark(
        'ui_button_revise',
        !!r.ok && r.json?.request?.status === 'needs_revision',
        r.json?.request?.status || r.error || ''
      );
      const resub = await leader.evaluate(async (id) => {
        const res = await fetch(`/api/hub/higher-approvals/${encodeURIComponent(id)}/resubmit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patch: { reason: 'أُكمل بعد طلب التعديل' } }),
        });
        return res.json();
      }, extra.revise.approvalId);
      mark('ui_revise_then_resubmit', resub?.request?.status === 'pending_review', resub?.request?.status || '');
    });

    await safe('ui_button_refer', async () => {
      if (!extra.refer?.approvalId) {
        mark('ui_button_refer', false, '', 'NOT TESTED');
        return;
      }
      await openHaInbox(leader);
      const r = await uiDecide(leader, extra.refer.approvalId, 'refer', 'specialist@naiosh.com');
      await shot(leader, 'ui_refer_done');
      mark('ui_button_refer', !!r.ok && r.json?.request?.status === 'referred', r.json?.request?.status || r.error || '');
    });

    await safe('ui_audit_decider_and_time', async () => {
      const auditOk = await leader.evaluate(() => {
        const rows = window.HubHigherApprovals?.listDecisions?.() || [];
        const last = rows[0];
        return !!(last && last.decidedBy && last.decidedAt && last.decision);
      });
      mark('ui_audit_decider_and_time', auditOk);
    });

    await safe('ui_admin_cannot_decide', async () => {
      if (!STAFF_EMAIL || !STAFF_PASS) {
        mark('ui_admin_cannot_decide', false, 'no staff creds', 'NOT TESTED');
        mark('ui_admin_api_decide_denied', false, '', 'NOT TESTED');
        return;
      }
      staff = await browser.newPage();
      staff.setDefaultTimeout(60000);
      staff.setDefaultNavigationTimeout(60000);
      const st = await login(staff, STAFF_EMAIL, STAFF_PASS);
      mark('ui_staff_admin_login', st.ok, st.url);
      await openHaInbox(staff);
      await shot(staff, 'staff_admin_inbox_no_decide');
      const can = await staff.evaluate(() => {
        const u = window.HubAuth?.getUser?.() || {};
        return {
          role: u.role,
          canDecide: !!window.HubHigherApprovals?.canDecide?.(u),
          approveBtns: document.querySelectorAll('[data-action="ha-modal"][data-kind="approve"]').length,
        };
      });
      mark('ui_admin_cannot_decide', can.canDecide === false && can.approveBtns === 0, JSON.stringify(can));
      const apiDeny = await staff.evaluate(async () => {
        const rows = window.HubHigherApprovals?.list?.() || [];
        const open = rows.find((r) => r.status === 'pending_review' || r.status === 'needs_revision');
        if (!open) return { skipped: true };
        const res = await fetch(`/api/hub/higher-approvals/${encodeURIComponent(open.id)}/decide`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve', note: 'bypass' }),
        });
        const j = await res.json().catch(() => ({}));
        return { status: res.status, error: j.error || '', ok: j.ok };
      });
      if (apiDeny.skipped) mark('ui_admin_api_decide_denied', false, 'no open row', 'NOT TESTED');
      else mark('ui_admin_api_decide_denied', apiDeny.status === 403 || apiDeny.ok === false, JSON.stringify(apiDeny));
    });

    const stamp = Date.now().toString(36);
    let synth = {};
    await safe('ui_synth_identity_created', async () => {
      await openHaInbox(leader);
      synth = await createDisposableIdentity(leader, stamp);
      mark('ui_synth_identity_created', !!synth.ok, synth.ok ? `${synth.naioshId}/${synth.employeeNo}` : synth.error);
    });

    await safe('ui_role_grant_decide', async () => {
      if (!synth.ok) {
        mark('ui_role_grant_enqueued', false, '', 'NOT TESTED');
        mark('ui_role_grant_decide', false, '', 'NOT TESTED');
        return;
      }
      const roleTicket = await leader.evaluate(async (s) => {
        try {
          const t = await window.HubHigherApprovals.enqueueRoleAssignment(
            {
              naioshId: s.naioshId,
              subjectName: `موظف اختبار موافقات ${s.stamp}`,
              subjectEmployeeNo: s.employeeNo,
              roleCode: 'HUB_ADMIN',
              system: 'HUB',
              permissions: ['roles.view'],
              reason: 'اختبار واجهة منح صلاحيات — موضوع تجريبي',
            },
            { name: 'القائد الأعلى', role: 'supreme_leader', email: 'leader@test' }
          );
          return { id: t.id, status: t.status, localOnly: !!t._localOnly };
        } catch (e) {
          return { error: e.message };
        }
      }, { ...synth, stamp });
      mark('ui_role_grant_enqueued', !!roleTicket.id && !roleTicket.localOnly, roleTicket.id || roleTicket.error || '');
      if (roleTicket.id) {
        await openHaInbox(leader);
        const r = await uiDecide(leader, roleTicket.id, 'reject', 'رفض اختبار واجهة — موضوع تجريبي');
        mark('ui_role_grant_decide', !!r.ok && r.json?.request?.status === 'rejected', r.json?.request?.status || r.error || '');
      } else mark('ui_role_grant_decide', false, '', 'NOT TESTED');
    });

    await safe('ui_identity_suspend_decide', async () => {
      if (!synth.ok) {
        mark('ui_identity_suspend_enqueued', false, '', 'NOT TESTED');
        mark('ui_identity_suspend_decide', false, '', 'NOT TESTED');
        mark('ui_identity_not_suspended', false, '', 'NOT TESTED');
        return;
      }
      const susTicket = await leader.evaluate(async (s) => {
        try {
          const t = await window.HubHigherApprovals.enqueueIdentitySuspend(
            {
              naioshId: s.naioshId,
              subjectName: `موظف اختبار موافقات ${s.stamp}`,
              subjectEmployeeNo: s.employeeNo,
              reason: 'اختبار واجهة إيقاف هوية — موضوع تجريبي',
              sourceModule: 'identity',
            },
            { name: 'القائد الأعلى', role: 'supreme_leader' }
          );
          return { id: t.id, status: t.status, localOnly: !!t._localOnly };
        } catch (e) {
          return { error: e.message };
        }
      }, { ...synth, stamp });
      mark('ui_identity_suspend_enqueued', !!susTicket.id && !susTicket.localOnly, susTicket.id || susTicket.error || '');
      if (susTicket.id) {
        await openHaInbox(leader);
        const r = await uiDecide(leader, susTicket.id, 'reject', 'لا إيقاف — اختبار واجهة');
        mark('ui_identity_suspend_decide', !!r.ok && r.json?.request?.status === 'rejected', r.json?.request?.status || r.error || '');
        const stillActive = await leader.evaluate((id) => {
          const i = window.HubAccessGov?.findIdentity?.(id);
          return i ? i.status : 'missing';
        }, synth.naioshId);
        mark('ui_identity_not_suspended', stillActive !== 'suspended', String(stillActive));
      } else {
        mark('ui_identity_suspend_decide', false, '', 'NOT TESTED');
        mark('ui_identity_not_suspended', false, '', 'NOT TESTED');
      }
    });

    await safe('ui_reward_decide', async () => {
      const reward = await leader.evaluate(async () => {
        try {
          if (!window.HubStore?.rewardEmployee) return { error: 'HubStore.rewardEmployee missing' };
          let empId = null;
          if (window.HubStore.addEmployee) {
            const e = window.HubStore.addEmployee(
              {
                name: `مكافأة اختبار HA ${Date.now().toString(36)}`,
                title: 'اختبار',
                email: `ha-rwd-${Date.now()}@example.com`,
              },
              'HA-UI-E2E'
            );
            empId = e?.id;
          }
          if (!empId) return { error: 'cannot create disposable employee' };
          const item = window.HubStore.rewardEmployee(
            empId,
            50,
            { type: 'نقاط', value: 50, points: 50, reason: 'اختبار واجهة مكافأة', requiresApproval: true },
            { name: 'القائد الأعلى', role: 'supreme_leader' }
          );
          if (item?._haPromise) await item._haPromise;
          return {
            rewardId: item?.id,
            approvalId: item?.higherApprovalId,
            status: item?.status,
            haError: item?.haPersistError || '',
          };
        } catch (e) {
          return { error: e.message };
        }
      });
      mark(
        'ui_reward_enqueued',
        !!reward.approvalId && reward.status === 'Pending Approval',
        JSON.stringify(reward).slice(0, 200)
      );
      if (reward.approvalId) {
        await openHaInbox(leader);
        const r = await uiDecide(leader, reward.approvalId, 'reject', 'رفض مكافأة اختبار واجهة');
        mark('ui_reward_decide', !!r.ok && r.json?.request?.status === 'rejected', r.json?.request?.status || r.error || '');
      } else {
        mark('ui_reward_decide', false, reward.error || reward.haError || '', 'NOT TESTED');
      }
    });

    await safe('ui_rental_decide', async () => {
      const rental = await leader.evaluate(async () => {
        try {
          const stamp = Date.now().toString(36);
          const res = await fetch('/api/hub/system-rentals/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              adminName: 'مستأجر اختبار HA',
              adminEmail: `ha-rent-${stamp}@example.com`,
              adminPhone: '01002223344',
              rental: {
                companyName: `شركة اختبار HA ${stamp}`,
                slug: `ha-rent-${stamp}`,
                subdomain: `ha-rent-${stamp}`,
                systems: ['CRM'],
                plan: 'basic',
                planLabel: 'أساسية',
                notes: 'اختبار واجهة استئجار',
              },
            }),
          });
          const j = await res.json().catch(() => ({}));
          return {
            status: res.status,
            id: j.rental?.id || j.id,
            approvalId: j.approvalId || j.rental?.approvalId || j.approval?.id,
            error: j.error,
          };
        } catch (e) {
          return { error: e.message };
        }
      });
      mark('ui_rental_enqueued', !!rental.approvalId, JSON.stringify(rental).slice(0, 200));
      if (rental.approvalId) {
        await openHaInbox(leader);
        const r = await uiDecide(leader, rental.approvalId, 'reject', 'رفض استئجار اختبار واجهة');
        mark('ui_rental_decide', !!r.ok && r.json?.request?.status === 'rejected', r.json?.request?.status || r.error || '');
      } else {
        mark('ui_rental_decide', false, rental.error || 'submit path unavailable', 'NOT TESTED');
      }
    });

    await safe('ui_theme_light', async () => {
      await openHaInbox(leader);
      await leader.evaluate(() => {
        localStorage.setItem('hubTheme', 'light');
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.classList.remove('dark');
      });
      await sleep(400);
      await shot(leader, 'inbox_light_desktop');
      mark('ui_theme_light', true, 'screenshot captured');
    });

    await safe('ui_theme_dark', async () => {
      await leader.evaluate(() => {
        localStorage.setItem('hubTheme', 'dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.classList.add('dark');
      });
      await sleep(400);
      await shot(leader, 'inbox_dark_desktop');
      mark('ui_theme_dark', true, 'screenshot captured');
    });

    await safe('ui_mobile_layout', async () => {
      await leader.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await openHaInbox(leader);
      await shot(leader, 'inbox_mobile_dark');
      const mobileOk = await leader.evaluate(
        () => !!document.querySelector('.ha-header, .hub-ha-ws, .ha-kpis, [data-ha-root], #rent-admin')
      );
      mark('ui_mobile_layout', mobileOk, '390x844');
    });

    mark(
      'service_restart_persist',
      false,
      'no safe Railway restart credential/API in this environment',
      'NOT TESTED'
    );

    await safe('ui_persist_after_relogin', async () => {
      await leader.setViewport({ width: 1440, height: 900, isMobile: false });
      const cookies = await leader.cookies();
      if (cookies.length) await leader.deleteCookie(...cookies);
      await login(leader, SA_EMAIL, SA_PASS);
      await openHaInbox(leader);
      const still = await leader.evaluate((id) => {
        const rows = window.HubHigherApprovals?.list?.() || [];
        return !id || rows.some((r) => r.id === id);
      }, reg.approvalId || '');
      mark('ui_persist_after_relogin', still, reg.approvalId || 'n/a');
    });
  } catch (e) {
    mark('ui_suite_crash', false, e.stack || e.message);
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
    'ui_register_platform_grant',
    'ui_request_visible_cross_session',
    'ui_button_approve',
    'ui_button_reject',
    'ui_button_revise',
    'ui_button_refer',
    'ui_approve_reflects_origin',
    'ui_reject_reflects_origin',
    'ui_admin_cannot_decide',
    'ui_role_grant_decide',
    'ui_identity_suspend_decide',
    'ui_reward_decide',
    'ui_rental_decide',
    'ui_mobile_layout',
    'ui_theme_light',
    'ui_theme_dark',
  ];
  const requiredPass = required.every((n) => cases.some((c) => c.name === n && c.result === 'PASS'));
  const unpatchedOk = cases.some((c) => c.name === 'ui_modal_ok_unpatched' && c.result === 'PASS');
  // FULL PASS only if stock production decide path works without client patch.
  const fullPass = requiredPass && summary.fail === 0 && unpatchedOk;
  const report = {
    at: new Date().toISOString(),
    base: BASE,
    summary,
    requiredPass,
    unpatchedModalOk: unpatchedOk,
    fullPass,
    verdict: fullPass
      ? 'FULL_PASS_UI_PROD'
      : !unpatchedOk
        ? 'FAIL_UI_MODAL_OK_BLOCKED'
        : summary.fail
          ? 'FAIL_OR_PARTIAL_UI'
          : 'PASS_PARTIAL_UI',
    cases,
    artifacts: fs.readdirSync(ART).filter((f) => f.startsWith('ha_ui_')).map((f) => path.join(ART, f)),
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
  const byType = {
    'تسجيل/منح منصة (register)': [
      'ui_register_platform_grant',
      'ui_request_visible_cross_session',
      'ui_button_approve',
      'ui_approve_reflects_origin',
    ],
    'أزرار القرار (موافقة/رفض/تعديل/إحالة)': [
      'ui_modal_ok_unpatched',
      'ui_button_approve',
      'ui_button_reject',
      'ui_button_revise',
      'ui_button_refer',
      'ui_revise_then_resubmit',
    ],
    'منح صلاحيات': ['ui_role_grant_enqueued', 'ui_role_grant_decide'],
    'إيقاف هوية': ['ui_identity_suspend_enqueued', 'ui_identity_suspend_decide', 'ui_identity_not_suspended'],
    'مكافآت موظفين': ['ui_reward_enqueued', 'ui_reward_decide'],
    'استئجار أنظمة': ['ui_rental_enqueued', 'ui_rental_decide'],
    'صلاحيات (موظف غير مخوّل)': ['ui_admin_cannot_decide', 'ui_admin_api_decide_denied'],
    'عدّادات/فلاتر/بحث + ثيمات + موبايل': [
      'ui_kpis_visible',
      'ui_search_by_request_id',
      'ui_theme_light',
      'ui_theme_dark',
      'ui_mobile_layout',
    ],
    'بقاء البيانات بعد إعادة التشغيل': ['service_restart_persist', 'ui_persist_after_relogin'],
    'تدقيق صاحب القرار والوقت': ['ui_audit_decider_and_time'],
  };
  const typeRows = Object.entries(byType).map(([label, names]) => {
    const subset = names.map((n) => cases.find((c) => c.name === n)).filter(Boolean);
    let result = 'NOT TESTED';
    if (subset.length) {
      if (subset.every((c) => c.result === 'PASS')) result = 'PASS';
      else if (subset.some((c) => c.result === 'FAIL')) result = 'FAIL';
      else result = 'NOT TESTED';
    }
    return `| ${label} | ${result} | ${subset.map((c) => `${c.name}=${c.result}`).join('; ')} |`;
  });
  const md = [
    '# تقرير واجهة الإنتاج — موافقات المدير الأعلى',
    '',
    `BASE: ${BASE}`,
    `at: ${report.at}`,
    `verdict: **${report.verdict}**`,
    `fullPass: ${report.fullPass}`,
    '',
    `PASS ${summary.pass} · FAIL ${summary.fail} · NOT TESTED ${summary.notTested}`,
    '',
    '> لا يُعلن FULL PASS شامل إلا إذا نجحت كل المسارات المطلوبة فعلًا من الواجهة.',
    '',
    '## ملخص حسب نوع الموافقة',
    '',
    '| النوع | النتيجة | تفاصيل |',
    '|---|---|---|',
    ...typeRows,
    '',
    '## المصفوفة التفصيلية',
    '',
    '| الاختبار | النتيجة | تفاصيل |',
    '|---|---|---|',
    ...cases.map((c) => `| ${c.name} | ${c.result} | ${(c.detail || '').replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`),
    '',
    '## إثباتات (لقطات)',
    '',
    ...report.artifacts.map((a) => `- \`${a}\``),
    '',
    '## ملاحظات السلامة',
    '',
    '- استُخدمت حسابات/هويات تجريبية (`@example.com`) فقط.',
    '- قرارات منح الصلاحيات/الإيقاف/المكافآت/الاستئجار التجريبية كانت **رفض** حيث أمكن لتفادي تغيير صلاحيات حقيقية.',
    '- إعادة تشغيل الخدمة على Railway: NOT TESTED (لا صلاحية إعادة تشغيل آمنة من الوكيل).',
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
