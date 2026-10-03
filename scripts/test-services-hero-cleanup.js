/**
 * Verify services.html hero cleanup + cards + multi-viewport.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8090';
const OUT = '/opt/cursor/artifacts/screenshots';
const PORT = 9340;
const USER_DATA = '/tmp/services-hero-chrome';

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(USER_DATA, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.id = 1;
    this.pending = new Map();
  }
  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((res, rej) => {
      this.ws.once('open', res);
      this.ws.once('error', rej);
    });
    this.ws.on('message', (buf) => {
      const msg = JSON.parse(String(buf));
      if (msg.id && this.pending.has(msg.id)) {
        const { res, rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((res, rej) => {
      const t = setTimeout(() => {
        this.pending.delete(id);
        rej(new Error('timeout ' + method));
      }, 25000);
      this.pending.set(id, {
        res: (v) => {
          clearTimeout(t);
          res(v);
        },
        rej: (e) => {
          clearTimeout(t);
          rej(e);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result?.value;
  }
  async screenshot(name) {
    const r = await this.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const file = path.join(OUT, name);
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  }
  close() {
    try {
      this.ws.close();
    } catch (_) {}
  }
}

async function waitWs() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch (_) {}
    await sleep(200);
  }
  throw new Error('CDP not ready');
}

async function setViewport(cdp, width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 900,
  });
}

async function inspectHero(cdp) {
  return cdp.evaluate(`
    (() => {
      const hero = document.querySelector('.hub-feature-hero');
      const actions = hero?.querySelector('.hub-feature-actions');
      const links = [...(actions?.querySelectorAll('a') || [])].map((a) => ({
        text: (a.textContent || '').replace(/\\s+/g, ' ').trim(),
        href: a.getAttribute('href'),
      }));
      const hasCostBtn = links.some((l) => /خفض التكاليف/.test(l.text) || l.href === 'cost-reduction.html');
      const hasConsultBtn = links.some((l) => /اطلب استشارة/.test(l.text) || l.href === 'consultation.html');
      const hasSolutions = links.some((l) => /حلول نايوش/.test(l.text) && l.href === 'naiosh-solutions.html');
      const rect = actions?.getBoundingClientRect();
      const heroRect = hero?.getBoundingClientRect();
      const cards = [...document.querySelectorAll('[data-ns-grid] a, .ns-grid a, .ns-card a, [data-ns-grid] [href]')];
      // cards may be the card itself
      const cardEls = [...document.querySelectorAll('.ns-grid a, .ns-card, [data-ns-card]')];
      const gridLinks = [...document.querySelectorAll('.ns-grid a[href], .ns-card[href], a.ns-card')].map((a) => a.getAttribute('href'));
      // also clickable cards
      const nsItems = [...document.querySelectorAll('.ns-grid > *')].map((el) => ({
        tag: el.tagName,
        href: el.getAttribute('href') || el.querySelector('a')?.getAttribute('href') || null,
        title: (el.querySelector('strong, h3, .ns-card-title')?.textContent || el.textContent || '').replace(/\\s+/g,' ').trim().slice(0,60),
      }));
      return {
        heroH: heroRect?.height || 0,
        actionsH: rect?.height || 0,
        actionsTopGap: rect && heroRect ? Math.round(rect.top - heroRect.top) : null,
        links,
        linkCount: links.length,
        hasCostBtn,
        hasConsultBtn,
        hasSolutions,
        nsCount: nsItems.length,
        nsSample: nsItems.slice(0, 6),
        gridLinks: gridLinks.slice(0, 8),
      };
    })()
  `);
}

async function clickCardAndCheck(cdp, index) {
  return cdp.evaluate(`
    (async () => {
      const items = [...document.querySelectorAll('.ns-grid > a, .ns-grid > * a, a.ns-card')];
      const el = items[${index}];
      if (!el) return { ok:false, reason:'no-card' };
      const href = el.getAttribute('href') || el.closest('a')?.getAttribute('href');
      const title = (el.textContent || '').replace(/\\s+/g,' ').trim().slice(0,40);
      if (!href || href === '#' || href.startsWith('javascript')) {
        // may open modal / no link — still ok if interactive
        el.click();
        await new Promise(r => setTimeout(r, 400));
        return { ok:true, mode:'click-no-nav', title, href: href || null, url: location.href };
      }
      // verify file exists via fetch instead of full nav to keep session
      const res = await fetch(href, { method:'GET' });
      return { ok: res.ok || res.status === 200, status: res.status, title, href, mode:'fetch' };
    })()
  `);
}

async function collectConsole(cdp) {
  // enable and drain is hard after-the-fact; check page errors via evaluate
  return cdp.evaluate(`
    (() => {
      const scripts = [...document.scripts].map(s => s.src).filter(Boolean);
      return { scriptCount: scripts.length, ready: document.readyState };
    })()
  `);
}

async function main() {
  try {
    require('child_process').execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' });
  } catch (_) {}

  spawn(
    'google-chrome',
    [
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${USER_DATA}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--window-size=1440,1100',
      'about:blank',
    ],
    { stdio: 'ignore', detached: true }
  ).unref();

  const cdp = new Cdp(await waitWs());
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  const consoleErrors = [];
  cdp.ws.on('message', (buf) => {
    try {
      const msg = JSON.parse(String(buf));
      if (msg.method === 'Runtime.exceptionThrown') {
        consoleErrors.push(msg.params?.exceptionDetails?.text || 'exception');
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
        consoleErrors.push((msg.params.args || []).map((a) => a.value || a.description || '').join(' '));
      }
    } catch (_) {}
  });
  await cdp.send('Runtime.enable');

  const viewports = [
    { name: 'desktop', w: 1440, h: 1100 },
    { name: 'tablet', w: 768, h: 1024 },
    { name: 'mobile', w: 390, h: 844 },
  ];

  const report = { viewports: {}, cards: [], consoleErrors: [], ok: false };

  for (const vp of viewports) {
    await setViewport(cdp, vp.w, vp.h);
    await cdp.send('Page.navigate', { url: `${BASE}/services.html` });
    await sleep(2200);
    const info = await inspectHero(cdp);
    const shot = await cdp.screenshot(`services-hero-${vp.name}.png`);
    report.viewports[vp.name] = {
      ...info,
      shot,
      pass:
        info.hasSolutions &&
        !info.hasCostBtn &&
        !info.hasConsultBtn &&
        info.linkCount === 1 &&
        info.nsCount > 5 &&
        info.heroH > 120,
    };
  }

  // card link checks (desktop)
  await setViewport(cdp, 1440, 1100);
  await cdp.send('Page.navigate', { url: `${BASE}/services.html` });
  await sleep(2200);
  const cardCount = await cdp.evaluate(`document.querySelectorAll('.ns-grid > a, .ns-grid a.ns-card, a.ns-card').length || document.querySelectorAll('.ns-grid > *').length`);
  const indices = [0, 1, 2, 3, 4].filter((i) => i < cardCount);
  for (const i of indices) {
    const r = await clickCardAndCheck(cdp, i);
    report.cards.push(r);
  }

  // ensure dedicated pages still exist
  const pages = await Promise.all(
    ['cost-reduction.html', 'consultation.html', 'naiosh-solutions.html'].map(async (p) => {
      const res = await fetch(`${BASE}/${p}`);
      return { page: p, status: res.status, ok: res.ok };
    })
  );
  report.pages = pages;

  // static source assert
  const html = fs.readFileSync(path.join(__dirname, '..', 'services.html'), 'utf8');
  const heroChunk = html.match(/hub-feature-hero[\s\S]*?<\/section>/)?.[0] || '';
  report.source = {
    heroHasCostBtn: /cost-reduction\.html/.test(heroChunk) && /برنامج خفض التكاليف/.test(heroChunk),
    heroHasConsultBtn: /consultation\.html/.test(heroChunk) && /اطلب استشارة/.test(heroChunk),
    heroHasSolutions: /naiosh-solutions\.html/.test(heroChunk) && /حلول نايوش/.test(heroChunk),
    offersSectionKeepsCost: /so-entry-btn[\s\S]*cost-reduction\.html/.test(html),
  };

  report.consoleErrors = consoleErrors.filter(Boolean).slice(0, 10);
  report.ok =
    report.viewports.desktop?.pass &&
    report.viewports.tablet?.pass &&
    report.viewports.mobile?.pass &&
    report.cards.every((c) => c.ok) &&
    report.pages.every((p) => p.ok) &&
    report.source.heroHasSolutions &&
    !report.source.heroHasCostBtn &&
    !report.source.heroHasConsultBtn &&
    report.consoleErrors.length === 0;

  console.log(JSON.stringify(report, null, 2));
  cdp.close();
  try {
    require('child_process').execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' });
  } catch (_) {}
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error('FAIL', e);
  try {
    require('child_process').execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' });
  } catch (_) {}
  process.exit(1);
});
