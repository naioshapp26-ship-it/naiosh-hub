#!/usr/bin/env node
'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.HUB_E2E_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const SA = process.env.HUB_SUPER_ADMIN_EMAIL || 'naioshhub@example.com';
const SA_PASS = process.env.HUB_E2E_SA_PASSWORD || process.env.HUB_SUPER_ADMIN_INITIAL_PASSWORD || '';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';

const rows = [];
function mark(check, pass, evidence) {
  rows.push({ check, result: pass ? 'PASS' : 'FAIL', evidence: String(evidence || '') });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${evidence}`);
}

function req(method, p, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(p, BASE);
    const lib = u.protocol === 'https:' ? https : http;
    const payload = body != null ? JSON.stringify(body) : null;
    const r = lib.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        headers: {
          Accept: 'application/json',
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...(token ? { Authorization: `Bearer ${token}`, 'X-Hub-Token': token } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch {
            /* */
          }
          resolve({ status: res.statusCode, json, raw });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function main() {
  if (!SA_PASS) {
    console.error('Need HUB_SUPER_ADMIN_INITIAL_PASSWORD');
    process.exit(2);
  }
  const login = await req('POST', '/api/auth/login', { body: { email: SA, password: SA_PASS } });
  const tok = login.json?.token;
  mark('دخول القائد الأعلى', !!tok, login.json?.employeeNo);

  const list = await req('GET', '/api/admin/staff', { token: tok });
  const leader = (list.json?.staff || []).find((s) => s.email === SA);
  mark('ظهور القائد وبياناته', !!(leader && leader.employeeNo === 'EMP-0001' && leader.accountId === 'NAI-LEADER-001'), JSON.stringify({ emp: leader?.employeeNo, acc: leader?.accountId, role: leader?.roleLabel, aff: leader?.affiliationLabel }));
  mark('دور عربي للقائد', leader?.roleLabel === 'القائد الأعلى', leader?.roleLabel);
  mark('إحصاءات حقيقية', !!(list.json?.stats && list.json.stats.total >= 1), JSON.stringify(list.json?.stats));

  const stamp = Date.now().toString(36);
  const naioshEmail = `adm.naiosh.${stamp}@example.com`;
  const extEmail = `adm.ext.${stamp}@example.com`;

  const createN = await req('POST', '/api/admin/staff', {
    token: tok,
    body: {
      name: 'إداري نايوش',
      email: naioshEmail,
      phone: '+970591234567',
      affiliationKind: 'naiosh',
      orgName: 'نايوش',
      department: 'التشغيل',
      role: 'admin',
      temporaryPassword: '2468',
      permissions: ['clients.view', 'orders.view'],
    },
  });
  mark('إضافة إداري نايوش', !!(createN.json?.ok && createN.json?.staff?.employeeNo && createN.json?.staff?.accountId), `${createN.json?.staff?.employeeNo}|${createN.json?.staff?.accountId}|${createN.json?.staff?.affiliationLabel}`);

  const createE = await req('POST', '/api/admin/staff', {
    token: tok,
    body: {
      name: 'إداري خارجي',
      email: extEmail,
      phone: '+970597654321',
      affiliationKind: 'external',
      orgName: 'مؤسسة الأفق',
      department: 'الشراكات',
      role: 'admin',
      temporaryPassword: '1357',
      permissions: ['clients.view'],
    },
  });
  mark('إضافة إداري جهة خارجية', !!(createE.json?.ok && createE.json?.staff?.affiliationKind === 'external' && createE.json?.staff?.orgName === 'مؤسسة الأفق'), `${createE.json?.staff?.orgName}|${createE.json?.error || ''}`);

  const perms = await req('POST', `/api/admin/staff/${encodeURIComponent(naioshEmail)}/permissions`, {
    token: tok,
    body: { permissions: ['clients.view', 'orders.view', 'reports.view'] },
  });
  mark('تحديد صلاحيات', !!(perms.json?.ok && perms.json.permissions?.includes('reports.view')), String(perms.json?.permissions?.length));

  const admLogin = await req('POST', '/api/auth/login', { body: { email: naioshEmail, password: '2468' } });
  const admTok = admLogin.json?.token;
  mark('دخول الإداري الجديد', !!admTok, admLogin.json?.employeeNo);
  const me = await req('GET', '/api/auth/me', { token: admTok });
  const admPerms = me.json?.permissions || admLogin.json?.permissions || [];
  mark('يرى الصلاحيات الممنوحة فقط في الجلسة', admPerms.includes('clients.view') && !admPerms.includes('permissions.manage'), String(admPerms.length));
  const deny = await req('GET', '/api/admin/staff', { token: admTok });
  mark('API مرفوض بدون permissions.manage', deny.status === 403 || deny.json?.ok === false, String(deny.status));

  const edit = await req('PATCH', `/api/admin/staff/${encodeURIComponent(extEmail)}`, {
    token: tok,
    body: { phone: '+970590000001', department: 'التطوير', affiliationKind: 'external', orgName: 'مؤسسة الأفق' },
  });
  mark('تعديل بيانات إداري', !!(edit.json?.ok && edit.json?.staff?.phone === '+970590000001'), edit.json?.staff?.department || edit.json?.error);

  const disabled = await req('POST', `/api/admin/staff/${encodeURIComponent(naioshEmail)}/disable`, { token: tok, body: {} });
  mark('إيقاف إداري', !!disabled.json?.ok, disabled.json?.message);
  const oldSess = await req('GET', '/api/auth/me', { token: admTok });
  mark('منع الجلسة القديمة بعد الإيقاف', !oldSess.json?.ok || oldSess.status === 401 || oldSess.status === 403, String(oldSess.status));

  const enabled = await req('POST', `/api/admin/staff/${encodeURIComponent(naioshEmail)}/enable`, { token: tok, body: {} });
  mark('إعادة تفعيل', !!enabled.json?.ok, enabled.json?.message);
  const relogin = await req('POST', '/api/auth/login', { body: { email: naioshEmail, password: '2468' } });
  mark('دخول بعد التفعيل', !!relogin.json?.ok, relogin.json?.employeeNo);

  const revoke = await req('POST', `/api/admin/staff/${encodeURIComponent(extEmail)}/revoke`, { token: tok, body: {} });
  mark('إلغاء تكليف مع بقاء السجل', !!revoke.json?.ok, revoke.json?.message);
  const afterRevoke = await req('GET', '/api/admin/staff', { token: tok });
  const revokedRow = (afterRevoke.json?.staff || []).find((s) => s.email === extEmail);
  mark('السجل محفوظ بعد إلغاء التكليف', !!(revokedRow && revokedRow.assignmentStatus === 'revoked'), revokedRow?.statusLabel);

  const audit = await req('GET', '/api/admin/staff/audit', { token: tok });
  mark('سجل تدقيق', (audit.json?.audit || []).length > 0, String((audit.json?.audit || []).length));

  // UI
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--disable-gpu'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle2' });
    await page.type('#email', SA, { delay: 8 });
    await page.type('#password', SA_PASS, { delay: 8 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null),
      page.click('#loginBtn'),
    ]);
    await page.goto(`${BASE}/dashboard.html#staff-admins`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.sa-admins-panel', { timeout: 20000 });
    const ui = await page.evaluate(() => {
      const t = document.body.innerText || '';
      return {
        stats: /إجمالي الإداريين/.test(t) && /تابعون لنايوش/.test(t),
        search: !!document.getElementById('sa-q'),
        leader: /EMP-0001/.test(t) && /NAI-LEADER-001/.test(t) && /القائد الأعلى/.test(t),
        cols: /جهة العمل/.test(t) && /رقم الحساب/.test(t) && /الصلاحيات/.test(t),
        teamLink: /إدارة فريق العمل والصلاحيات/.test(t),
      };
    });
    mark('واجهة الكمبيوتر', ui.stats && ui.search && ui.leader && ui.cols && ui.teamLink, JSON.stringify(ui));
    const art = '/opt/cursor/artifacts/screenshots';
    fs.mkdirSync(art, { recursive: true });
    await page.screenshot({ path: path.join(art, 'admins-mgmt-desktop.png'), fullPage: true });
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('.sa-admins-panel', { timeout: 20000 });
    await page.screenshot({ path: path.join(art, 'admins-mgmt-mobile.png'), fullPage: true });
    mark('واجهة الموبايل', true, 'admins-mgmt-mobile.png');
  } catch (err) {
    mark('واجهة', false, err.message);
  } finally {
    if (browser) await browser.close().catch(() => null);
  }

  const fail = rows.filter((r) => r.result === 'FAIL').length;
  const out = { at: new Date().toISOString(), base: BASE, checks: rows };
  const file = path.join(__dirname, '../docs/admins-mgmt-rebuild-report.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`\nRESULT: ${fail ? 'FAIL' : 'PASS'} (${rows.length - fail}/${rows.length})`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
