/**
 * Headless Chrome E2E: settings save → hard reload → restore (persistent CDP).
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8090';
const OUT = process.env.ARTIFACTS_DIR || '/opt/cursor/artifacts/screenshots';
const USER_DATA = '/tmp/hub-settings-chrome-profile2';
const DEBUG_PORT = 9333;

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(USER_DATA, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
  }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.once('open', resolve);
      this.ws.once('error', reject);
    });
    this.ws.on('message', (buf) => {
      const msg = JSON.parse(String(buf));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`timeout ${method}`));
      }, 30000);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails));
    }
    return result.result?.value;
  }
  async screenshot(name) {
    const result = await this.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const file = path.join(OUT, name);
    fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
    return file;
  }
  close() {
    try {
      this.ws.close();
    } catch (_) {}
  }
}

async function waitCdp() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch (_) {}
    await sleep(200);
  }
  throw new Error('CDP not ready');
}

async function main() {
  try {
    require('child_process').execSync(`fuser -k ${DEBUG_PORT}/tcp`, { stdio: 'ignore' });
  } catch (_) {}

  const chrome = spawn(
    'google-chrome',
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${USER_DATA}`,
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--window-size=1440,1100',
      'about:blank',
    ],
    { stdio: 'ignore', detached: true }
  );
  chrome.unref();

  const wsUrl = await waitCdp();
  const cdp = new Cdp(wsUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  await cdp.send('Page.navigate', { url: `${BASE}/login.html` });
  await sleep(1500);

  const login = await cdp.evaluate(`
    (async () => {
      const email = document.getElementById('email');
      const password = document.getElementById('password');
      if (!email || !password) return { ok:false, href: location.href, html: document.body.innerText.slice(0,200) };
      email.value = 'leader@naiosh.com';
      password.value = 'Hub@360';
      email.dispatchEvent(new Event('input', { bubbles:true }));
      password.dispatchEvent(new Event('input', { bubbles:true }));
      const btn = document.querySelector('button[type=submit], .login-btn, #login-btn');
      const form = email.closest('form');
      if (form?.requestSubmit) form.requestSubmit();
      else if (btn) btn.click();
      else form?.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true }));
      for (let i=0;i<40;i++){
        await new Promise(r=>setTimeout(r,250));
        if (location.href.includes('dashboard') || localStorage.hubAuthToken || sessionStorage.hubAuthToken) {
          return { ok:true, href: location.href, token: !!(localStorage.hubAuthToken||sessionStorage.hubAuthToken) };
        }
      }
      return { ok:false, href: location.href, token: !!(localStorage.hubAuthToken||sessionStorage.hubAuthToken) };
    })()
  `);

  if (!login?.token && !String(login?.href || '').includes('dashboard')) {
    // Force session then navigate
    await cdp.evaluate(`
      (() => {
        const user = { email:'leader@naiosh.com', name:'القائد الأعلى', role:'supreme_leader', platform:'naiosh-hub-360' };
        const token = 'hub360.' + btoa('leader@naiosh.com') + '.' + Date.now();
        localStorage.setItem('hubAuthToken', token);
        localStorage.setItem('hubUser', JSON.stringify(user));
        return true;
      })()
    `);
  }

  await cdp.send('Page.navigate', { url: `${BASE}/dashboard.html#settings` });
  await sleep(2800);

  const before = await cdp.evaluate(`
    (async () => {
      for (let i=0;i<40;i++){
        if (document.querySelector('[data-set=\"orgNameAr\"]')) break;
        await new Promise(r=>setTimeout(r,200));
      }
      const el = document.querySelector('[data-set=\"orgNameAr\"]');
      return {
        href: location.href,
        hasField: !!el,
        value: el ? el.value : null,
        hasSave: !!document.querySelector('[data-action=\"save-settings\"]'),
        sectionSaves: document.querySelectorAll('.sac-section-save [data-action=\"save-settings\"]').length,
        sticky: !!document.querySelector('#sac-sticky-save'),
        brand: document.querySelector('.sidebar-brand strong')?.textContent || null,
      };
    })()
  `);
  const shot1 = await cdp.screenshot('settings-before-edit.png');

  const edited = await cdp.evaluate(`
    (async () => {
      const el = document.querySelector('[data-set=\"orgNameAr\"]');
      if (!el) return { ok:false };
      el.focus();
      el.value = 'نايوش هوب اختبار الحفظ';
      el.dispatchEvent(new Event('input', { bubbles:true }));
      await new Promise(r=>setTimeout(r,400));
      return {
        ok:true,
        value: el.value,
        dirty: document.querySelector('#settings-admin-center')?.dataset?.dirty,
        dirtyBarHidden: document.querySelector('#sac-dirty-bar')?.classList?.contains('hidden'),
      };
    })()
  `);
  const shot2 = await cdp.screenshot('settings-dirty-unsaved.png');

  const saved = await cdp.evaluate(`
    (async () => {
      const btn = document.querySelector('#sac-save-main') || document.querySelector('[data-action=\"save-settings\"]');
      if (!btn) return { ok:false, reason:'no-save' };
      btn.click();
      for (let i=0;i<50;i++){
        await new Promise(r=>setTimeout(r,200));
        const toast = document.getElementById('toast')?.textContent || '';
        if (toast.includes('تم حفظ') || toast.includes('تعذر')) {
          return {
            ok: toast.includes('تم حفظ'),
            toast,
            dirty: document.querySelector('#settings-admin-center')?.dataset?.dirty,
            value: document.querySelector('[data-set=\"orgNameAr\"]')?.value,
          };
        }
      }
      return {
        ok:false,
        toast: document.getElementById('toast')?.textContent || '',
        dirty: document.querySelector('#settings-admin-center')?.dataset?.dirty,
        value: document.querySelector('[data-set=\"orgNameAr\"]')?.value,
      };
    })()
  `);
  await sleep(800);
  const shot3 = await cdp.screenshot('settings-after-save.png');

  // Hard reload
  await cdp.send('Page.reload', { ignoreCache: true });
  await sleep(3200);
  // Ensure hash
  await cdp.evaluate(`location.hash = 'settings'`);
  await sleep(1500);

  const afterReload = await cdp.evaluate(`
    (async () => {
      for (let i=0;i<50;i++){
        if (document.querySelector('[data-set=\"orgNameAr\"]')) break;
        await new Promise(r=>setTimeout(r,200));
      }
      await new Promise(r=>setTimeout(r,1200));
      return {
        href: location.href,
        value: document.querySelector('[data-set=\"orgNameAr\"]')?.value || null,
        brand: document.querySelector('.sidebar-brand strong')?.textContent || null,
        tag: document.querySelector('.sidebar-brand span')?.textContent || null,
      };
    })()
  `);
  const shot4 = await cdp.screenshot('settings-after-hard-reload.png');

  const token = `hub360.${Buffer.from('leader@naiosh.com').toString('base64')}.${Date.now()}`;
  const apiMid = await fetch(`${BASE}/api/hub/system-settings`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Hub-User-Role': 'supreme_leader' },
  }).then((r) => r.json());

  const restoreToast = await cdp.evaluate(`
    (async () => {
      const el = document.querySelector('[data-set=\"orgNameAr\"]');
      if (!el) return 'no-field';
      el.value = 'نايوش هوب';
      el.dispatchEvent(new Event('input', { bubbles:true }));
      (document.querySelector('#sac-save-main') || document.querySelector('[data-action=\"save-settings\"]')).click();
      for (let i=0;i<50;i++){
        await new Promise(r=>setTimeout(r,200));
        const t = document.getElementById('toast')?.textContent || '';
        if (t.includes('تم حفظ') || t.includes('تعذر')) return t;
      }
      return document.getElementById('toast')?.textContent || '';
    })()
  `);
  await sleep(900);
  await cdp.send('Page.reload', { ignoreCache: true });
  await sleep(2800);
  await cdp.evaluate(`location.hash = 'settings'`);
  await sleep(1500);
  const restored = await cdp.evaluate(`
    (async () => {
      await new Promise(r=>setTimeout(r,1000));
      return document.querySelector('[data-set=\"orgNameAr\"]')?.value || null;
    })()
  `);
  const shot5 = await cdp.screenshot('settings-restored.png');

  const report = {
    ok:
      !!before?.hasField &&
      !!before?.hasSave &&
      !!edited?.ok &&
      edited?.dirty === '1' &&
      !!saved?.ok &&
      afterReload?.value === 'نايوش هوب اختبار الحفظ' &&
      apiMid?.settings?.orgNameAr === 'نايوش هوب اختبار الحفظ' &&
      String(restoreToast || '').includes('تم حفظ') &&
      restored === 'نايوش هوب',
    login,
    before,
    edited,
    saved,
    afterReload,
    apiMidOrgNameAr: apiMid?.settings?.orgNameAr,
    auditSample: (apiMid?.settings?.settingsChangeLog || []).slice(0, 2),
    restoreToast,
    restored,
    screenshots: { shot1, shot2, shot3, shot4, shot5 },
  };

  console.log(JSON.stringify(report, null, 2));
  cdp.close();
  try {
    require('child_process').execSync(`fuser -k ${DEBUG_PORT}/tcp`, { stdio: 'ignore' });
  } catch (_) {}
  if (!report.ok) process.exit(1);
}

main().catch((err) => {
  console.error('FAIL', err);
  try {
    require('child_process').execSync(`fuser -k ${DEBUG_PORT}/tcp`, { stdio: 'ignore' });
  } catch (_) {}
  process.exit(1);
});
