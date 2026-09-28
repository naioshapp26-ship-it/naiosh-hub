/**
 * E2E: POSHA clients overview tables — profile columns + request linkage
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8080';
const ART = '/opt/cursor/artifacts/screenshots';
fs.mkdirSync(ART, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  const report = { tests: [] };

  const add = (name, ok, data, notes) => {
    report.tests.push({ name, ok, data, notes });
    console.log(ok ? 'PASS' : 'FAIL', name, data || '', notes || '');
  };

  // seed profile via API using staff session after login storage
  await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    const user = {
      name: 'القائد الأعلى',
      email: 'leader@naiosh.com',
      role: 'supreme_leader',
      naioshId: 'NAI-LEADER-001',
      employeeNo: 'EMP-0001',
    };
    localStorage.setItem('hubUser', JSON.stringify(user));
    sessionStorage.setItem('hubUser', JSON.stringify(user));
    const token = `hub360.${btoa('leader@naiosh.com')}.${Date.now()}`;
    localStorage.setItem('hubAuthToken', token);
    sessionStorage.setItem('hubAuthToken', token);
  });

  // ensure demo client profile fields via admin profile endpoint
  const profileRes = await page.evaluate(async () => {
    const token = localStorage.getItem('hubAuthToken');
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Hub-User-Role': 'supreme_leader',
      'X-Hub-User-Email': 'leader@naiosh.com',
    };
    // touch clients list to migrate store
    await fetch('/api/admin/posha/clients', { headers });
    const put = await fetch('/api/admin/posha/clients/' + encodeURIComponent('client@naiosh.com') + '/profile', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'أحمد العميل',
        company: 'مؤسسة تجريبية',
        country: 'السعودية',
        city: 'الرياض',
        clientType: 'مؤسسة',
        activityType: 'تعليم',
        naioshId: 'NAI-CLIENT-001',
        phone: '0500000000',
      }),
    });
    const body = await put.json().catch(() => ({}));
    // create linked request in HubCustomerRequests via localStorage store if available after dashboard load
    return { status: put.status, body };
  });
  add('تحديث ملف عميل الاختبار', profileRes.status === 200 && profileRes.body?.ok !== false, profileRes, '');

  await page.goto(`${BASE}/dashboard.html#posha-clients`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => !!document.querySelector('.posha-panel-clients, #page-title'), { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));

  // Create a customer request linked to demo client after HubCustomerRequests is ready
  await page.evaluate(() => {
    const CR = window.HubCustomerRequests;
    if (!CR?.create) return;
    const existing = (CR.list?.({}) || []).find((r) => String(r.email || '').toLowerCase() === 'client@naiosh.com');
    if (existing) return;
    CR.create(
      {
        requestType: 'Project Registration',
        title: 'طلب اختبار ربط العميل',
        email: 'client@naiosh.com',
        customerName: 'أحمد العميل',
        company: 'مؤسسة تجريبية',
        clientId: '',
        sourceModule: 'عملاء هوب',
        sourcePage: 'عملاء هوب',
        assignedTo: 'فريق المشاريع',
      },
      'leader@naiosh.com'
    );
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!document.querySelector('.posha-panel-clients'), { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1000));

  const clientsInfo = await page.evaluate(() => {
    const table = document.querySelector('.posha-panel-clients .posha-clients-table');
    if (!table) return { ok: false, reason: 'no clients table' };
    const headers = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    const row = [...table.querySelectorAll('tbody tr')].find((tr) => /أحمد/.test(tr.textContent));
    const cells = row ? [...row.children].map((td) => td.innerText.replace(/\s+/g, ' ').trim()) : [];
    return { ok: !!row, headers, cells, headerCount: headers.length };
  });
  add(
    'أحدث العملاء يظهر أحمد مع أعمدة الهوية',
    clientsInfo.ok &&
      clientsInfo.headers.includes('الدولة') &&
      clientsInfo.headers.includes('المدينة') &&
      clientsInfo.headers.includes('نوع النشاط') &&
      clientsInfo.headers.includes('نوع العميل') &&
      clientsInfo.cells.some((c) => c.includes('السعودية')) &&
      clientsInfo.cells.some((c) => c.includes('الرياض')) &&
      clientsInfo.cells.some((c) => c.includes('تعليم')) &&
      clientsInfo.cells.some((c) => c.includes('مؤسسة')),
    clientsInfo,
    ''
  );

  const reqInfo = await page.evaluate(() => {
    const table = document.querySelector('.posha-panel-requests .posha-req-overview-table, .posha-panel-requests table');
    if (!table) return { ok: false, reason: 'no requests table' };
    const headers = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    const row = [...table.querySelectorAll('tbody tr')].find((tr) => /أحمد|client@naiosh|اختبار/.test(tr.textContent));
    const cells = row ? [...row.children].map((td) => td.innerText.replace(/\s+/g, ' ').trim()) : [];
    return { ok: !!row, headers, cells };
  });
  add(
    'أحدث الطلبات يعرض بيانات العميل المرتبطة',
    reqInfo.ok &&
      reqInfo.headers.includes('الدولة') &&
      reqInfo.cells.some((c) => c.includes('السعودية') || c.includes('أحمد')),
    reqInfo,
    ''
  );

  await page.screenshot({ path: path.join(ART, 'posha-clients-overview-tables.png'), fullPage: true });

  // open client
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('[data-open-posha="client@naiosh.com"]')][0];
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  const drawer = await page.evaluate(() => {
    const d = document.getElementById('posha-drawer');
    const text = d?.innerText?.replace(/\s+/g, ' ') || '';
    return {
      visible: d && !d.hidden,
      hasCountry: /السعودية/.test(text),
      hasCity: /الرياض/.test(text),
      hasActivity: /تعليم/.test(text),
    };
  });
  add('فتح ملف العميل يعرض الدولة/المدينة/النشاط', drawer.visible && drawer.hasCountry && drawer.hasCity && drawer.hasActivity, drawer, '');
  await page.screenshot({ path: path.join(ART, 'posha-client-drawer-profile.png') });

  // refresh
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1000));
  const afterRefresh = await page.evaluate(() => {
    const text = document.querySelector('.posha-panel-clients')?.innerText || '';
    return /السعودية/.test(text) && /الرياض/.test(text);
  });
  add('Refresh يحافظ على بيانات الدولة/المدينة', afterRefresh, {}, '');

  // responsive
  for (const [name, w, h] of [
    ['desktop', 1600, 1000],
    ['tablet', 900, 1024],
    ['mobile', 390, 844],
  ]) {
    await page.setViewport({ width: w, height: h });
    await page.goto(`${BASE}/dashboard.html#posha-clients`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: path.join(ART, `posha-clients-${name}.png`) });
    add(`Screenshot ${name}`, true, { file: `posha-clients-${name}.png` }, '');
  }

  fs.writeFileSync(path.join(ART, 'posha-clients-tables-report.json'), JSON.stringify(report, null, 2));
  const failed = report.tests.filter((t) => !t.ok);
  console.log('SUMMARY failed', failed.length);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
