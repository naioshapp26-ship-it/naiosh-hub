const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const BASE = (process.env.HUB_E2E_BASE || 'https://naiosh-hub-production.up.railway.app').replace(/\/$/, '');
const ART = '/opt/cursor/artifacts';
const AV = fs.existsSync(path.join(ART,'avatar_ui_test.png')) ? path.join(ART,'avatar_ui_test.png') : path.join(ART,'p360_test_avatar.png');

(async () => {
  const stamp = Date.now().toString(36);
  const email = `avui.${stamp}@naiosh-test.com`;
  const pass = 'AvatarUI360!';
  const reg = await fetch(BASE + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'عميل صورة واجهة', email, phone: `+9665${String(Date.now()).slice(-8)}`, password: pass, confirmPassword: pass, termsAccepted: true }),
  });
  const rj = await reg.json();
  console.log('REG', reg.status, rj.ok, rj.profile360);
  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });
  const lj = await login.json();
  const token = lj.token;
  console.log('LOGIN', !!token);

  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const logs = [];
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => logs.push('ERR ' + e.message));
  const net = [];
  page.on('response', async (res) => {
    const u = res.url();
    if (/\/api\/hub\/(uploads|profiles)/i.test(u)) {
      let body = '';
      try { body = (await res.text()).slice(0, 400); } catch {}
      net.push({ status: res.status(), path: u.replace(BASE, ''), body });
    }
  });

  await page.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t, u) => {
    localStorage.clear();
    localStorage.setItem('hubAuthToken', t);
    localStorage.setItem('hubUser', JSON.stringify(u));
  }, token, lj.user || { email, role: 'customer', name: 'عميل صورة واجهة' });
  await page.goto(BASE + '/client.html#profile360', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => /ACC-/.test(document.body.innerText), { timeout: 25000 });
  await page.screenshot({ path: path.join(ART, 'avatar_bug_01_before.png') });

  console.log('STATE', await page.evaluate(() => ({
    hasLimits: !!window.HubUploadLimits?.uploadFile,
    hasBtn: !!document.getElementById('p360-avatar-btn'),
    hasFile: !!document.getElementById('p360-avatar-file'),
    hubAuthHeaders: typeof window.HubAuth?.authHeaders,
    authSample: window.HubAuth?.authHeaders?.() || null,
  })));

  const [chooser] = await Promise.all([
    page.waitForFileChooser({ timeout: 10000 }),
    page.click('#p360-avatar-btn'),
  ]);
  await chooser.accept([AV]);
  await new Promise((r) => setTimeout(r, 5000));
  await page.screenshot({ path: path.join(ART, 'avatar_bug_02_after_upload.png') });

  console.log('AFTER', await page.evaluate(() => ({
    imgSrc: document.querySelector('.p360-avatar img')?.getAttribute('src') || null,
    wrap: document.querySelector('.p360-avatar-wrap')?.innerHTML?.slice(0, 400),
    toasts: Array.from(document.querySelectorAll('[class*="toast"], .p360-toast')).map((e) => e.textContent),
  })));
  console.log('NET', JSON.stringify(net, null, 2));
  console.log('LOGS', logs.filter((l) => /error|fail|رفع|upload|avatar|Auth/i.test(l)).slice(0, 40));

  const me = await fetch(BASE + '/api/hub/profiles/me', { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json());
  console.log('ME', me.header?.avatarUrl, me.header?.accountNo);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { location.hash = 'profile360'; });
  await page.waitForFunction(() => /ACC-/.test(document.body.innerText), { timeout: 25000 }).catch(() => null);
  await new Promise((r) => setTimeout(r, 1500));
  console.log('RELOAD', await page.evaluate(() => document.querySelector('.p360-avatar img')?.getAttribute('src') || null));
  await page.screenshot({ path: path.join(ART, 'avatar_bug_03_reload.png') });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
