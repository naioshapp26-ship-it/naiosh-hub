/**
 * Headless E2E: سجل معنا → موافقة السوبر أدمن → دخول المستأجر
 */
import puppeteer from 'puppeteer-core';

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:8080';
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
const slug = `testtenant${Date.now().toString(36).slice(-6)}`;
const email = `tenant.${slug}@naiosh.app`;
const password = 'Tenant@123';

const results = [];
const note = (step, ok, detail) => {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step} — ${detail}`);
};

const pickFirstValue = async (page, selector) => {
  return page.$eval(selector, (el) => {
    const opt = [...el.options].find((o) => o.value);
    if (!opt) return '';
    el.value = opt.value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { value: opt.value, label: opt.textContent.trim() };
  });
};

const textOf = async (page, selector) => {
  const el = await page.$(selector);
  if (!el) return '';
  return page.evaluate((node) => (node.innerText || node.textContent || '').trim(), el);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1400,900'],
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  await page.setViewport({ width: 1400, height: 900 });
  page.on('pageerror', (err) => console.log('PAGEERROR', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('CONSOLE', msg.text());
  });

  // 1) Homepage CTA
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle0' });
  const homeCta = await page.$('a.hero-cta-register[href="register.html"]');
  const homeCtaText = homeCta ? await page.evaluate((n) => n.textContent.trim(), homeCta) : '';
  note('homepage-cta', Boolean(homeCta) && homeCtaText.includes('سجل معنا'), homeCtaText || 'CTA missing');

  // 2) Register form
  await page.goto(`${BASE}/register.html`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-register-form]');
  const labels = await page.$$eval('label', (els) => els.map((e) => e.textContent.trim()));
  const needed = ['الاسم', 'رقم الجوال', 'الإيميل', 'كلمة المرور', 'الدولة', 'اسم الفرع', 'اسم الحاضنة', 'اسم المنصة', 'النظام الذي تريد تشغيله', 'الدومين الفرعي'];
  const missing = needed.filter((l) => !labels.some((x) => x.includes(l)));
  note('register-fields', missing.length === 0, missing.length ? `missing: ${missing.join(' · ')}` : 'all required labels present');

  const branchDisabledBefore = await page.$eval('#reg-branch', (el) => el.disabled);
  note('branch-locked', branchDisabledBefore, branchDisabledBefore ? 'branch disabled until country' : 'branch was already enabled');

  await page.type('#reg-name', 'أحمد المنصة');
  await page.type('#reg-phone', '0501234567');
  await page.type('#reg-email', email);
  await page.type('#reg-password', password);

  const country = await pickFirstValue(page, '#reg-country');
  await page.waitForFunction(() => {
    const el = document.querySelector('#reg-branch');
    return el && !el.disabled && [...el.options].some((o) => o.value);
  });
  const branch = await pickFirstValue(page, '#reg-branch');
  const incubator = await pickFirstValue(page, '#reg-incubator');
  const platform = await pickFirstValue(page, '#reg-platform');
  const system = await pickFirstValue(page, '#reg-system');
  note(
    'register-selects',
    Boolean(country?.value && branch?.value && incubator?.value && platform?.value && system?.value),
    `country=${country.label} | branch=${branch.label} | incubator=${incubator.label} | platform=${platform.label} | system=${system.label}`
  );

  const branchFitsCountry =
    String(branch.label || '').includes(String(country.label || '')) ||
    String(branch.label || '').includes('فرع');
  note('branch-matches-country', branchFitsCountry, `country ${country.label} → branch ${branch.label}`);

  await page.click('#reg-subdomain', { clickCount: 3 });
  await page.type('#reg-subdomain', slug);
  await page.waitForFunction(() => document.querySelector('[data-subdomain-status]')?.classList.contains('is-ok'), {
    timeout: 8000,
  });
  const subStatus = await textOf(page, '[data-subdomain-status]');
  note('subdomain-available', /متاح/.test(subStatus), subStatus);

  await page.click('[data-register-form] button[type="submit"]');
  await page.waitForSelector('[data-register-feedback]:not([hidden])');
  const feedback = await textOf(page, '[data-register-feedback]');
  const submitted = /سوبر أدمن|الموافقة/.test(feedback) && !/تعذّر|خطأ/.test(feedback);
  note('register-submit', submitted, feedback);

  const pending = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('naiosh_hub_platform_grants_v1') || '{}');
    return (raw.grants || []).find((g) => g.status === 'pending') || null;
  });
  note(
    'pending-stored',
    Boolean(pending?.id && pending.requestedSystem),
    pending
      ? `${pending.adminEmail} · ${pending.host} · ${pending.requestedSystem} · ${pending.status}`
      : 'no pending grant in localStorage'
  );

  // 3) Super-admin approve
  await page.goto(`${BASE}/rent-admin.html`, { waitUntil: 'networkidle0' });
  const adminTitle = await textOf(page, 'h1');
  note('admin-title', /سوبر أدمن|موافقة/.test(adminTitle), adminTitle);
  await page.waitForSelector('[data-approve-platform]');
  const cardText = await page.$eval('[data-platform-admin-list]', (el) => el.innerText);
  note(
    'admin-sees-request',
    cardText.includes(email) && /الفرع|الحاضنة|المنصة|النظام/.test(cardText),
    cardText.replace(/\s+/g, ' ').slice(0, 280)
  );
  await page.click('[data-approve-platform]');
  await page.waitForFunction(() => /مفعّل/.test(document.querySelector('[data-platform-admin-list]')?.innerText || ''));
  const afterApprove = await page.$eval('[data-platform-admin-list]', (el) => el.innerText);
  note('admin-approve', /مفعّل/.test(afterApprove), afterApprove.replace(/\s+/g, ' ').slice(0, 220));

  const granted = await page.evaluate(() => {
    const grants = JSON.parse(localStorage.getItem('naiosh_hub_platform_grants_v1') || '{}').grants || [];
    const g = grants.find((x) => x.status === 'active') || null;
    const email = g?.adminEmail || '';
    const subs = JSON.parse(localStorage.getItem('naioshHub360Store_v13') || '{}');
    const list = subs.empire?.operating?.subscriptions || [];
    const sub = list.find((s) => String(s.email).toLowerCase() === String(email).toLowerCase()) || null;
    const accounts = JSON.parse(localStorage.getItem('naiosh_hub_tenant_accounts_v1') || '[]');
    const acc = accounts.find((a) => a.email === email) || null;
    return { g, sub, acc, subCount: list.length };
  });
  note(
    'grant-subscription',
    Boolean(granted.sub?.systemCode && granted.acc?.status === 'active'),
    `system=${granted.sub?.systemCode || 'none'} account=${granted.acc?.email || 'none'} host=${granted.g?.host || 'none'} grantErr=${granted.g?.systemGrantError || 'none'} systemGranted=${granted.g?.systemGranted} subs=${granted.subCount}`
  );

  // 4) system-ops grants tab has no fill form
  await page.goto(`${BASE}/system-ops.html?tab=grants`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-ops-main]');
  const opsText = await page.$eval('[data-ops-main]', (el) => el.innerText);
  const hasGrantForm = await page.$('form[data-form="subdomain"]');
  note(
    'ops-no-grant-form',
    !hasGrantForm && /سجل معنا/.test(opsText) && /سوبر أدمن/.test(opsText),
    hasGrantForm ? 'subdomain grant form still present' : opsText.replace(/\s+/g, ' ').slice(0, 240)
  );

  // 5) Tenant login
  await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle0' });
  await page.type('#email', email);
  await page.type('#password', password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 12000 }).catch(() => null),
    page.click('#loginBtn'),
  ]);
  const url = page.url();
  const alertText = await textOf(page, '#alertMessage').catch(() => '');
  const loggedIn = /dashboard\.html/.test(url) || /نجاح/.test(alertText);
  note('tenant-login', loggedIn, `url=${url} alert=${alertText || '(none)'}`);
} catch (error) {
  note('crash', false, error.stack || error.message);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log('\n--- summary ---');
console.log(`passed ${results.filter((r) => r.ok).length}/${results.length}`);
if (failed.length) {
  process.exitCode = 1;
}
