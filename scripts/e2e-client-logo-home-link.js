/**
 * Client portal sidebar brand → public homepage.
 * Run: node scripts/e2e-client-logo-home-link.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const HOME = 'https://www.naioshai.com/';
const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });

const CLIENT = {
  name: 'أحمد العميل',
  email: 'client@naiosh.com',
  role: 'customer',
  naioshId: 'NAI-CLIENT-001',
  customerId: 'CL-450885C4',
};

const SECTIONS = ['home', 'systems', 'orders', 'subscriptions', 'wallet', 'invoices', 'requests', 'complaints', 'support', 'notifications', 'marketplace', 'profile', 'security'];

async function launch() {
  return puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

async function loginClient(page) {
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((user) => {
    localStorage.setItem('hubUser', JSON.stringify(user));
    sessionStorage.setItem('hubUser', JSON.stringify(user));
    const token = `hub360.${btoa(user.email)}.${Date.now()}`;
    localStorage.setItem('hubAuthToken', token);
    sessionStorage.setItem('hubAuthToken', token);
  }, CLIENT);
}

async function brandInfo(page) {
  return page.evaluate(() => {
    const a = document.querySelector('a.cp-brand');
    if (!a) return null;
    const cs = getComputedStyle(a);
    return {
      href: a.getAttribute('href'),
      target: a.getAttribute('target'),
      rel: a.getAttribute('rel'),
      aria: a.getAttribute('aria-label'),
      title: a.getAttribute('title'),
      cursor: cs.cursor,
      text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
    };
  });
}

(async () => {
  const browser = await launch();
  const report = { checks: [], ok: true };
  const push = (name, ok, extra) => {
    report.checks.push({ name, ok, extra });
    if (!ok) report.ok = false;
    console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`);
  };

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await loginClient(page);
    await page.goto(`${BASE}/client.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('a.cp-brand', { timeout: 15000 });

    const desktop = await brandInfo(page);
    push('desktop brand exists', !!desktop);
    push('href is public home', desktop && desktop.href === HOME, desktop && desktop.href);
    push('same tab (no target=_blank)', desktop && !desktop.target);
    push('aria-label Arabic', desktop && /الانتقال إلى الصفحة الرئيسية لنايوش هوب/.test(desktop.aria || ''));
    push('cursor pointer', desktop && desktop.cursor === 'pointer', desktop && desktop.cursor);
    push('not dashboard.html', desktop && !/dashboard\.html/i.test(desktop.href || ''));
    push('not client.html home', desktop && !/client\.html/i.test(desktop.href || ''));
    await page.screenshot({ path: path.join(ART, 'client_logo_desktop.png') });

    const sessionBefore = await page.evaluate(() => ({
      user: localStorage.getItem('hubUser'),
      token: localStorage.getItem('hubAuthToken'),
    }));
    push('client session before click', !!(sessionBefore.user && sessionBefore.token));

    for (const section of SECTIONS) {
      await page.goto(`${BASE}/client.html#${section}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('a.cp-brand', { timeout: 10000 });
      const info = await brandInfo(page);
      push(`section #${section} href`, info && info.href === HOME, info && info.href);
    }

    const navPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.click('a.cp-brand');
    await navPromise;
    const afterUrl = page.url();
    push('click navigates to naioshai.com', /^https:\/\/(www\.)?naioshai\.com\/?/.test(afterUrl), afterUrl);
    push('click stayed in same tab', (await browser.pages()).length === 1);
    await page.screenshot({ path: path.join(ART, 'client_logo_after_click.png') });

    await page.goto(`${BASE}/client.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const sessionAfter = await page.evaluate(() => ({
      user: JSON.parse(localStorage.getItem('hubUser') || 'null'),
      token: localStorage.getItem('hubAuthToken'),
    }));
    push(
      'session still present after return',
      !!(sessionAfter.user && sessionAfter.token && sessionAfter.user.role === 'customer'),
      sessionAfter.user && sessionAfter.user.role
    );

    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 800));
    const dashUrl = page.url();
    const onDashboard = /dashboard\.html/i.test(dashUrl);
    push('client cannot stay on admin dashboard', !onDashboard, dashUrl);

    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE}/client.html#wallet`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('a.cp-brand', { timeout: 10000 });
    const menu = await page.$('#cp-menu');
    if (menu) {
      await menu.click();
      await new Promise((r) => setTimeout(r, 400));
    }
    const mobile = await brandInfo(page);
    push('mobile href is public home', mobile && mobile.href === HOME, mobile && mobile.href);
    push('mobile cursor pointer', mobile && mobile.cursor === 'pointer');
    await page.screenshot({ path: path.join(ART, 'client_logo_mobile.png') });

    const mobileNav = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.click('a.cp-brand');
    await mobileNav;
    push('mobile click → naioshai.com', /^https:\/\/(www\.)?naioshai\.com\/?/.test(page.url()), page.url());
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(ART, 'client_logo_home_link_report.json'), JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
