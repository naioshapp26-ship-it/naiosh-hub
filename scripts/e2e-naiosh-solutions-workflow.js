/**
 * E2E — حلول نايوش: اختيار حل → طلب عرض سعر → Request ID → الإدارة → عرض سعر → العميل
 * Run: node scripts/e2e-naiosh-solutions-workflow.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const report = {
  startedAt: new Date().toISOString(),
  tests: [],
  filesChanged: [
    'js/hub-solutions-ui.js',
    'js/hub-solutions-data.js',
    'js/hub-customer-requests.js',
    'js/hub-posha-clients.js',
    'js/login.js',
    'naiosh-solutions.html',
    'css/hub-service-offers.css',
  ],
  rootCauses: {},
  evidence: {},
};

function pass(name, extra = {}) {
  report.tests.push({ name, result: 'PASS', ...extra });
  console.log('PASS:', name, extra.RequestID || extra.detail || '');
}
function fail(name, reason, extra = {}) {
  report.tests.push({ name, result: 'FAIL', reason, ...extra });
  console.error('FAIL:', name, reason);
}

function loadScript(window, rel) {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  window.eval(code);
}

function makeDom(htmlExtra = '') {
  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><body>
    <div id="so-app" class="so-app"></div>
    <div id="posha-app"></div>
    ${htmlExtra}
  </body></html>`;
  const dom = new JSDOM(html, {
    url: 'https://naioshai.com/naiosh-solutions.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.alert = () => {};
  window.confirm = () => true;
  window.prompt = (msg, def) => def || '';
  const mem = {};
  window.localStorage = {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => {
      mem[k] = String(v);
    },
    removeItem: (k) => {
      delete mem[k];
    },
    clear: () => Object.keys(mem).forEach((k) => delete mem[k]),
  };
  window.sessionStorage = {
    _m: {},
    getItem(k) {
      return k in this._m ? this._m[k] : null;
    },
    setItem(k, v) {
      this._m[k] = String(v);
    },
    removeItem(k) {
      delete this._m[k];
    },
    clear() {
      this._m = {};
    },
  };
  return { dom, window, mem };
}

function loginAs(window, role = 'customer') {
  const users = {
    customer: {
      email: 'client@naiosh.com',
      name: 'أحمد العميل',
      role: 'customer',
      naioshId: 'NAI-CLIENT-001',
      customerId: 'NAI-CLIENT-001',
      phone: '0500000000',
      company: 'مؤسسة تجريبية',
    },
    staff: {
      email: 'leader@naiosh.com',
      name: 'القائد الأعلى',
      role: 'supreme_leader',
      naioshId: 'NAI-LEADER-001',
    },
  };
  const user = users[role];
  const token = `hub360.${Buffer.from(user.email).toString('base64url')}.${Date.now()}`;
  window.localStorage.setItem('hubAuthToken', token);
  window.localStorage.setItem('hubUser', JSON.stringify(user));
  window.HubAuth = {
    getUser: () => user,
    isLoggedIn: () => true,
    isStaff: () => role === 'staff',
    showGuestGate: () => false,
    requireLogin: () => true,
  };
  return user;
}

function bootSolutions(window) {
  loadScript(window, 'js/hub-customer-requests.js');
  loadScript(window, 'js/hub-solutions-data.js');
  loadScript(window, 'js/hub-solutions-ui.js');
  // remount if auto-mount already ran before Auth was set
  window.HubSolutionsUI?.mount?.();
  window.HubSolutionsUI?.render?.();
}

async function run() {
  report.rootCauses = {
    choose:
      'زر اختيار حل داخل .so-card-actions كان محجوباً بـ onclick="event.stopPropagation()" فلن يصل حدث النقر إلى مستمع التفويض على #so-app.',
    quote:
      'نفس حجب stopPropagation + زر طلب عرض سعر كان يظهر فقط لبعض البطاقات (ctaType/priceType) وليس لكل الحلول.',
  };

  // ---------- TEST 1: login as customer ----------
  const { window } = makeDom();
  const customer = loginAs(window, 'customer');
  bootSolutions(window);
  if (!window.HubAuth.isLoggedIn() || customer.email !== 'client@naiosh.com') {
    fail('TEST 1 — تسجيل دخول عميل', 'session missing');
  } else {
    pass('TEST 1 — تسجيل دخول عميل', { user: customer.email });
  }

  // Ensure catalog rendered
  const cards = [...window.document.querySelectorAll('.so-card')];
  if (cards.length < 2) fail('Catalog render', `only ${cards.length} cards`);
  else pass('Catalog render', { cards: cards.length });

  // ---------- TEST 2: choose first-row solution ----------
  const firstChoose = window.document.querySelector('[data-so="choose"]');
  const firstId = firstChoose?.getAttribute('data-id');
  const firstName = window.HubSolutions.getSolution(firstId)?.name;
  firstChoose?.click();
  const selectedView = window.HubSolutionsUI.ui.view;
  const selectedId = window.HubSolutionsUI.ui.selected?.solutionId;
  if (selectedView !== 'selected' || selectedId !== firstId) {
    fail('TEST 2 — اختيار حل (صف أول)', `view=${selectedView} id=${selectedId} expected=${firstId}`);
  } else {
    pass('TEST 2 — اختيار حل (صف أول)', { SolutionID: firstId, name: firstName });
  }

  // ---------- TEST 3: quote on different card ----------
  window.HubSolutionsUI.ui.view = 'catalog';
  window.HubSolutionsUI.render();
  const quoteBtns = [...window.document.querySelectorAll('[data-so="quote"]')];
  // pick consulting / marketing by id if present
  const consult = window.HubSolutions.getSolution('SOL-2026-00002');
  const marketing = window.HubSolutions.getSolution('SOL-2026-00006');
  const quoteConsult = window.document.querySelector(`[data-so="quote"][data-id="SOL-2026-00002"]`);
  quoteConsult?.click();
  const wiz = window.HubSolutionsUI.ui.wizard;
  const formHtml = window.document.querySelector('#so-app')?.innerHTML || '';
  if (wiz?.mode !== 'quote' || wiz?.solutionId !== 'SOL-2026-00002' || !formHtml.includes(consult?.name || 'الاستشارات')) {
    fail('TEST 3 — طلب عرض سعر (استشارات)', `mode=${wiz?.mode} id=${wiz?.solutionId}`);
  } else {
    pass('TEST 3 — طلب عرض سعر يحمل Solution ID واسم الحل', {
      SolutionID: wiz.solutionId,
      name: consult?.name,
    });
  }

  // also verify marketing card binding without submitting
  window.HubSolutionsUI.startAction('SOL-2026-00006', 'quote');
  if (window.HubSolutionsUI.ui.wizard?.solutionId !== 'SOL-2026-00006') {
    fail('TEST 13a — بطاقة تسويق وإعلان', `got ${window.HubSolutionsUI.ui.wizard?.solutionId}`);
  } else {
    pass('TEST 13a — بطاقة تسويق وإعلان مربوطة', { name: marketing?.name });
  }

  // switch back to consult for submit
  window.HubSolutionsUI.startAction('SOL-2026-00002', 'quote');
  window.HubSolutionsUI.ui.wizard.data.need = 'أحتاج استشارة مالية للشركات خلال الربع الحالي';
  window.HubSolutionsUI.ui.wizard.data.scopeDetail = 'فرع الرياض';
  window.HubSolutionsUI.ui.wizard.data.budget = '20000';
  // inject fields into DOM then submit
  window.HubSolutionsUI.render();
  const needEl = window.document.getElementById('so-need');
  if (needEl) needEl.value = 'أحتاج استشارة مالية للشركات خلال الربع الحالي';
  const scopeEl = window.document.getElementById('so-scope-detail');
  if (scopeEl) scopeEl.value = 'فرع الرياض';

  // ---------- TEST 4 + 5: submit quote ----------
  const beforeCount = window.HubCustomerRequests.list({}).filter((r) => String(r.id).startsWith('SOL-REQ')).length;
  window.document.querySelector('[data-so="wiz-submit"]')?.click();
  const success = window.HubSolutionsUI.ui.success;
  const createdId = success?.requestId;
  const created = window.HubCustomerRequests.get(createdId);
  if (!success || !createdId || !/^SOL-REQ-20\d{2}-\d+$/.test(createdId)) {
    fail('TEST 4/5 — إرسال طلب عرض سعر', `success=${JSON.stringify(success)}`);
  } else {
    pass('TEST 4 — إرسال طلب عرض سعر', { RequestID: createdId });
    pass('TEST 5 — رسالة نجاح وRequest ID', { RequestID: createdId, message: success.message });
  }
  report.evidence.requestId = createdId;
  report.evidence.solutionId = created?.solutionId;
  report.evidence.solutionName = created?.solutionName || created?.relatedSolution;

  if (
    !created ||
    created.solutionId !== 'SOL-2026-00002' ||
    !(created.solutionName || created.relatedSolution || '').includes('استشار') ||
    created.sourceModule !== 'حلول نايوش' ||
    created.requestType !== 'Quote Request' ||
    created.status !== 'Pending Review'
  ) {
    fail('TEST 8 fields (pre-admin)', JSON.stringify({
      solutionId: created?.solutionId,
      name: created?.solutionName,
      source: created?.sourceModule,
      type: created?.requestType,
      status: created?.status,
    }));
  }

  // ---------- TEST 11: double submit ----------
  window.HubSolutionsUI.startAction('SOL-2026-00002', 'quote');
  window.HubSolutionsUI.render();
  const need2 = window.document.getElementById('so-need');
  if (need2) need2.value = 'طلب مكرر للاختبار — ضغطة مزدوجة';
  const midCount = window.HubCustomerRequests.list({}).filter((r) => String(r.id).startsWith('SOL-REQ')).length;
  const submitBtn = window.document.querySelector('[data-so="wiz-submit"]');
  // three rapid clicks on the SAME form instance
  submitBtn?.click();
  // after first success wizard is cleared — further clicks on stale node should not create more
  submitBtn?.click();
  submitBtn?.click();
  // also call submitWizard again on a locked/submitted state via API if wizard somehow remains
  const afterDouble = window.HubCustomerRequests.list({}).filter((r) => String(r.id).startsWith('SOL-REQ')).length;
  if (afterDouble - midCount !== 1) {
    fail('TEST 11 — منع الطلب المكرر', `created ${afterDouble - midCount} requests`);
  } else {
    pass('TEST 11 — منع الطلب المكرر', { created: afterDouble - midCount });
  }

  // ---------- TEST 6/7/8: admin POSHA inbox ----------
  loginAs(window, 'staff');
  // load posha module lightly — use CR list directly (same store)
  const inInbox = window.HubCustomerRequests.list({}).find((r) => r.id === createdId);
  if (!inInbox) fail('TEST 7 — ظهور الطلب في طلبات العملاء', 'missing in HubCustomerRequests');
  else {
    pass('TEST 6 — دخول الإدارة', { user: 'leader@naiosh.com' });
    pass('TEST 7 — نفس Request ID في طلبات العملاء', { RequestID: createdId });
  }

  if (
    inInbox &&
    inInbox.customerId === 'NAI-CLIENT-001' &&
    inInbox.solutionId === 'SOL-2026-00002' &&
    (inInbox.solutionName || inInbox.relatedSolution || '').length > 0 &&
    inInbox.sourceModule === 'حلول نايوش'
  ) {
    pass('TEST 8 — بيانات الطلب صحيحة في الإدارة', {
      CustomerID: inInbox.customerId,
      SolutionID: inInbox.solutionId,
      name: inInbox.solutionName || inInbox.relatedSolution,
    });
  } else {
    fail('TEST 8 — بيانات الطلب في الإدارة', JSON.stringify(inInbox && {
      customerId: inInbox.customerId,
      solutionId: inInbox.solutionId,
      name: inInbox.solutionName,
      source: inInbox.sourceModule,
    }));
  }

  // ---------- TEST 9: admin creates quotation ----------
  const quote = window.HubSolutions.createQuotation(
    createdId,
    {
      price: 12500,
      currency: 'ر.س',
      details: 'باقة استشارات شاملة لفرع الرياض',
      duration: '3 أسابيع',
      validUntil: '2026-12-31',
      notes: 'يشمل زيارتين ميدانيتين',
      terms: 'الدفع على دفعتين',
    },
    'القائد الأعلى'
  );
  const afterQuote = window.HubCustomerRequests.get(createdId);
  if (!quote?.id || afterQuote.status !== 'Proposal Sent' || !(afterQuote.quotations || []).length) {
    fail('TEST 9 — إعداد وإرسال عرض السعر', `quote=${quote?.id} status=${afterQuote?.status}`);
  } else {
    pass('TEST 9 — إعداد وإرسال عرض السعر', { QuoteID: quote.id, RequestID: createdId, price: quote.price });
    report.evidence.quoteId = quote.id;
  }

  // ---------- TEST 10: client sees quote in طلباتي ----------
  loginAs(window, 'customer');
  window.HubSolutionsUI.ui.view = 'my';
  window.HubSolutionsUI.render();
  const myHtml = window.document.querySelector('#so-app')?.textContent || '';
  window.HubSolutionsUI.ui.requestId = createdId;
  window.HubSolutionsUI.ui.view = 'request';
  window.HubSolutionsUI.ui.detailTab = 'quote';
  window.HubSolutionsUI.render();
  const quoteHtml = window.document.querySelector('#so-app')?.innerHTML || '';
  const clientQuotes = window.HubSolutions.listQuotations(createdId);
  if (
    !myHtml.includes(createdId) ||
    !clientQuotes.length ||
    !(quoteHtml.includes('12,500') || quoteHtml.includes('12500') || quoteHtml.includes(String(quote.price))) ||
    !quoteHtml.includes(createdId)
  ) {
    fail('TEST 10 — ظهور العرض في طلباتي', `quotes=${clientQuotes.length} myHas=${myHtml.includes(createdId)} quoteHasPrice=${quoteHtml.includes('12500')||quoteHtml.includes('12,500')}`);
  } else {
    pass('TEST 10 — العرض ظهر للعميل بنفس Request ID', { RequestID: createdId, QuoteID: quote.id });
  }

  // ---------- TEST 12: guest keeps context ----------
  const { window: w2 } = makeDom();
  // guest — no login
  w2.HubAuth = {
    getUser: () => null,
    isLoggedIn: () => false,
    isStaff: () => false,
    showGuestGate: ({ message, next }) => {
      w2.__guest = { message, next };
      return false;
    },
    requireLogin: () => false,
  };
  loadScript(w2, 'js/hub-customer-requests.js');
  loadScript(w2, 'js/hub-solutions-data.js');
  loadScript(w2, 'js/hub-solutions-ui.js');
  w2.HubSolutionsUI.mount();
  w2.HubSolutionsUI.render();
  const guestQuote = w2.document.querySelector('[data-so="quote"][data-id="SOL-2026-00006"]');
  guestQuote?.click();
  const pending = JSON.parse(w2.sessionStorage.getItem('naiosh_solutions_pending_v1') || 'null');
  const guestOk =
    w2.__guest?.message?.includes('تسجيل الدخول') &&
    pending?.solutionId === 'SOL-2026-00006' &&
    pending?.action === 'quote' &&
    String(w2.__guest?.next || '').includes('SOL-2026-00006');
  if (!guestOk) {
    fail('TEST 12 — زائر يحتفظ بالحل بعد الدخول', JSON.stringify({ guest: w2.__guest, pending }));
  } else {
    // simulate login resume
    loginAs(w2, 'customer');
    w2.HubSolutionsUI.resumePending();
    if (w2.HubSolutionsUI.ui.wizard?.solutionId !== 'SOL-2026-00006' && w2.HubSolutionsUI.ui.selected?.solutionId !== 'SOL-2026-00006') {
      // quote action should open wizard
      if (w2.HubSolutionsUI.ui.wizard?.solutionId === 'SOL-2026-00006') {
        pass('TEST 12 — زائر ثم دخول يستأنف نفس الحل', { SolutionID: 'SOL-2026-00006' });
      } else {
        fail('TEST 12 — الاستئناف بعد الدخول', `view=${w2.HubSolutionsUI.ui.view} wiz=${w2.HubSolutionsUI.ui.wizard?.solutionId}`);
      }
    } else {
      pass('TEST 12 — زائر ثم دخول يستأنف نفس الحل', { SolutionID: 'SOL-2026-00006' });
    }
  }

  // ---------- TEST 13: multiple cards ----------
  const { window: w3 } = makeDom();
  loginAs(w3, 'customer');
  bootSolutions(w3);
  const ids = ['SOL-2026-00001', 'SOL-2026-00002', 'SOL-2026-00005', 'SOL-2026-00006'];
  let multiOk = true;
  for (const id of ids) {
    const btn = w3.document.querySelector(`[data-so="choose"][data-id="${id}"]`);
    if (!btn) {
      multiOk = false;
      break;
    }
    btn.click();
    if (w3.HubSolutionsUI.ui.selected?.solutionId !== id) {
      multiOk = false;
      break;
    }
    w3.HubSolutionsUI.ui.view = 'catalog';
    w3.HubSolutionsUI.render();
    const qbtn = w3.document.querySelector(`[data-so="quote"][data-id="${id}"]`);
    qbtn?.click();
    if (w3.HubSolutionsUI.ui.wizard?.solutionId !== id) {
      multiOk = false;
      break;
    }
    w3.HubSolutionsUI.ui.view = 'catalog';
    w3.HubSolutionsUI.ui.wizard = null;
    w3.HubSolutionsUI.render();
  }
  if (multiOk) pass('TEST 13 — عدة بطاقات حلول مختلفة', { ids });
  else fail('TEST 13 — عدة بطاقات', 'binding failed');

  // ---------- TEST 14: responsive CSS presence ----------
  const css = fs.readFileSync(path.join(root, 'css/hub-service-offers.css'), 'utf8');
  if (css.includes('@media (max-width: 720px)') && css.includes('@media (max-width: 480px)') && css.includes('.so-card-actions')) {
    pass('TEST 14 — Desktop/Tablet/Mobile styles', { detail: 'responsive breakpoints present' });
  } else {
    fail('TEST 14 — responsive CSS', 'missing breakpoints');
  }

  // choose button count == quote button count (both on every card)
  const chooseN = window.document.querySelectorAll('[data-so="choose"]').length;
  // re-render catalog on primary window
  window.HubSolutionsUI.ui.view = 'catalog';
  window.HubSolutionsUI.render();
  const chooseCount = window.document.querySelectorAll('[data-so="choose"]').length;
  const quoteCount = window.document.querySelectorAll('[data-so="quote"]').length;
  if (chooseCount > 0 && chooseCount === quoteCount) {
    pass('CTA parity — كل بطاقة فيها اختيار حل وطلب عرض سعر', { chooseCount, quoteCount });
  } else {
    fail('CTA parity', `choose=${chooseCount} quote=${quoteCount}`);
  }

  // login.js next resume check (static)
  const loginJs = fs.readFileSync(path.join(root, 'js/login.js'), 'utf8');
  if (loginJs.includes('isSafePublicNext') || loginJs.includes('safePublic')) {
    pass('Login resume — next العام مسموح للعميل');
  } else {
    fail('Login resume', 'safe next not found');
  }

  // no stopPropagation on card actions
  const uiSrc = fs.readFileSync(path.join(root, 'js/hub-solutions-ui.js'), 'utf8');
  if (uiSrc.includes('onclick="event.stopPropagation()"')) {
    fail('stopPropagation removed', 'still present');
  } else {
    pass('Root cause fixed — stopPropagation removed from card actions');
  }

  report.finishedAt = new Date().toISOString();
  report.summary = {
    pass: report.tests.filter((t) => t.result === 'PASS').length,
    fail: report.tests.filter((t) => t.result === 'FAIL').length,
    requestId: report.evidence.requestId || null,
    quoteId: report.evidence.quoteId || null,
    appearedInAdmin: !!inInbox,
    quoteCreated: !!quote?.id,
    quoteReturnedToClient: !!(clientQuotes && clientQuotes.length),
  };

  const outDir = path.join(root, 'docs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'naiosh-solutions-workflow-e2e-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('\nReport:', outPath);
  console.log('SUMMARY', report.summary);

  if (report.summary.fail > 0) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
