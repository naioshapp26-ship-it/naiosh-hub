/**
 * E2E Customer Requests — programmatic journey + persistence checks
 * Simulates the same store APIs the UI uses, then asserts refresh/idempotency.
 * Run: node scripts/e2e-customer-requests.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const report = { tests: [], startedAt: new Date().toISOString() };

function pass(name, extra = {}) {
  report.tests.push({ name, result: 'PASS', ...extra });
  console.log('PASS:', name, extra.RequestID || extra.ArticleID || '');
}
function fail(name, reason, extra = {}) {
  report.tests.push({ name, result: 'FAIL', reason, ...extra });
  console.error('FAIL:', name, reason);
}

const mem = {};
const localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => {
    mem[k] = String(v);
  },
  removeItem: (k) => {
    delete mem[k];
  },
};
const ctx = {
  console,
  Date,
  Math,
  JSON,
  String,
  Number,
  Array,
  Object,
  localStorage,
  window: {},
  CustomEvent: function (n, o) {
    this.type = n;
    this.detail = o && o.detail;
  },
};
ctx.window = ctx;
vm.createContext(ctx);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx);
}

load('js/hub-customer-requests.js');
load('js/hub-articles.js');
load('js/hub-solutions-data.js');

// —— TEST 1 Article
try {
  const draft = ctx.HubArticles.createDraft(
    {
      title: 'TEST - مقال تجريبي لاختبار الربط',
      category: 'تشغيل',
      summary: 'ملخص اختبار الربط بين المقال وطلبات العملاء',
      authorName: 'أحمد العميل',
      authorEmail: 'client@naiosh.com',
      company: 'شركة المدى',
      body: 'محتوى تجريبي كامل لاختبار End-to-End في نايوش هوب.',
    },
    'أحمد العميل'
  );
  const sub = ctx.HubArticles.submit(draft.id, 'أحمد العميل');
  const artId = sub.article.id;
  const reqId = sub.article.requestId;
  const req = ctx.HubCustomerRequests.get(reqId);
  const dup = ctx.HubCustomerRequests.list({ view: 'articles' }).filter((r) => r.referenceId === artId);

  if (!sub.ok) fail('TEST 1 — Article Submission', 'submit failed');
  else if (!reqId || !String(reqId).startsWith('REQ-')) fail('TEST 1 — Article Submission', 'missing REQ id', { ArticleID: artId });
  else if (!req || req.referenceId !== artId) fail('TEST 1 — Article Submission', 'not linked', { ArticleID: artId, RequestID: reqId });
  else if (req.status !== 'Pending Review') fail('TEST 1 — Article Submission', `bad status ${req.status}`, { RequestID: reqId });
  else if (dup.length !== 1) fail('TEST 1 — Article Submission', `duplicates ${dup.length}`, { ArticleID: artId });
  else
    pass('TEST 1 — Article Submission', {
      ArticleID: artId,
      RequestID: reqId,
      AdminRequestVisible: true,
      Status: req.status,
      Source: req.sourceModule,
    });

  // persistence snapshot
  const snapArticles = mem['naiosh_articles_v1'];
  const snapReqs = mem['naiosh_customer_requests_v1'];

  // reload stores (simulates refresh)
  load('js/hub-customer-requests.js');
  load('js/hub-articles.js');
  const afterReload = ctx.HubCustomerRequests.findByReference('Article', artId);
  if (!afterReload || afterReload.id !== reqId) fail('TEST 1b — Persistence after reload', 'request missing after reload', { ArticleID: artId });
  else pass('TEST 1b — Persistence after reload', { RequestID: reqId });

  // idempotent sync
  ctx.HubCustomerRequests.syncFromModules();
  ctx.HubArticles.linkCustomerRequests();
  const afterSync = ctx.HubCustomerRequests.list({ view: 'articles' }).filter((r) => r.referenceId === artId);
  if (afterSync.length !== 1) fail('TEST 1c — No Duplicate Records', `count=${afterSync.length}`);
  else pass('TEST 1c — No Duplicate Records', { RequestID: reqId });

  // open detail fields
  const detailOk =
    afterReload.customerName &&
    afterReload.referenceId &&
    afterReload.sourceModule === 'المقالات' &&
    afterReload.sourcePage &&
    afterReload.articleSnapshot;
  if (!detailOk) fail('TEST 2 — Open Request Detail', 'missing detail fields');
  else pass('TEST 2 — Open Request Detail', { RequestID: reqId, Source: afterReload.sourceModule });

  // approve publish
  const beforeK = ctx.HubCustomerRequests.kpis();
  ctx.HubCustomerRequests.approveAndPublish(reqId, 'Admin Tester');
  const art = ctx.HubArticles.get(artId);
  const pubReq = ctx.HubCustomerRequests.get(reqId);
  const afterK = ctx.HubCustomerRequests.kpis();
  const inApproved = ctx.HubCustomerRequests.list({ view: 'approved' }).some((r) => r.id === reqId);
  const inActive = ctx.HubCustomerRequests.list({ view: 'active' }).some((r) => r.id === reqId);
  const publishedList = ctx.HubArticles.listPublished().some((p) => p.id === artId || p.articleId === artId);

  if (art.status !== 'Published' || pubReq.status !== 'Published')
    fail('TEST 3 — Approve & Publish', `art=${art.status} req=${pubReq.status}`);
  else if (inActive) fail('TEST 3 — Approve & Publish', 'still in active');
  else if (!inApproved) fail('TEST 3 — Approve & Publish', 'not in approved');
  else if (!publishedList) fail('TEST 3 — Approve & Publish', 'not in published list');
  else
    pass('TEST 3 — Approve & Publish', {
      RequestID: reqId,
      AcceptedRequestVisible: true,
      PublishedVisible: true,
      Counters: { beforePending: beforeK.pendingReview, afterApproved: afterK.approved },
    });

  // accepted list fields
  if (!pubReq.approvedBy || !pubReq.approvedAt) fail('TEST 4 — Accepted Requests', 'missing approvedBy/At');
  else pass('TEST 4 — Accepted Requests', { RequestID: reqId, ApprovedBy: pubReq.approvedBy });

  // edit after publish
  ctx.HubCustomerRequests.editLinkedArticle(
    reqId,
    {
      title: 'TEST - مقال تجريبي تم تعديله',
      summary: 'ملخص بعد التعديل',
      body: 'محتوى بعد التعديل',
    },
    'Admin Tester'
  );
  const edited = ctx.HubArticles.get(artId);
  const auditEdit = ctx.HubCustomerRequests.listAudit().find((a) => a.action === 'Published Article Updated' && a.requestId === reqId);
  if (edited.title !== 'TEST - مقال تجريبي تم تعديله' || !auditEdit)
    fail('TEST 5 — Edit After Publish', `title=${edited.title} audit=${!!auditEdit}`);
  else pass('TEST 5 — Edit After Publish', { RequestID: reqId, NewTitle: edited.title, AuditVisible: true });

  // pause
  ctx.HubCustomerRequests.pauseRequest(reqId, 'Admin Tester');
  const paused = ctx.HubCustomerRequests.get(reqId);
  const artPaused = ctx.HubArticles.get(artId);
  const stillPublished = ctx.HubArticles.listPublished().some((p) => p.id === artId);
  if (paused.status !== 'Unpublished' || artPaused.status !== 'Unpublished' || stillPublished)
    fail('TEST 6 — Pause/Unpublish', `req=${paused.status} art=${artPaused.status} listed=${stillPublished}`);
  else pass('TEST 6 — Pause/Unpublish', { RequestID: reqId });

  // resume
  ctx.HubCustomerRequests.resumeRequest(reqId, 'Admin Tester');
  const resumed = ctx.HubCustomerRequests.get(reqId);
  const artResumed = ctx.HubArticles.get(artId);
  if (resumed.status !== 'Published' || artResumed.status !== 'Published')
    fail('TEST 6b — Resume', `req=${resumed.status} art=${artResumed.status}`);
  else pass('TEST 6b — Resume', { RequestID: reqId });

  // archive
  ctx.HubCustomerRequests.archiveRequest(reqId, 'Admin Tester');
  const archived = ctx.HubCustomerRequests.get(reqId);
  const inArchived = ctx.HubCustomerRequests.list({ view: 'archived' }).some((r) => r.id === reqId);
  const historyKept = !!ctx.HubCustomerRequests.get(reqId);
  if (archived.status !== 'Archived' || !inArchived || !historyKept)
    fail('TEST 7 — Archive', `status=${archived.status}`);
  else pass('TEST 7 — Archive', { RequestID: reqId, HistoryKept: true });

  // keep mem for solution test - restore from snap for clean? continue with new requests
} catch (e) {
  fail('TEST 1 — Article Submission', e.message);
}

// —— TEST 8 Solution
try {
  const sols = ctx.HubSolutions.listSolutions();
  const sreq = ctx.HubSolutions.createRequest(
    {
      solutionId: sols[0].id,
      customer: { name: 'أحمد العميل', company: 'شركة المدى', email: 'client@naiosh.com', phone: '0500000000' },
      need: 'TEST - طلب حل للربط المركزي',
      priority: 'عادي',
      requestType: 'Solution Request',
    },
    'أحمد العميل'
  );
  const central = ctx.HubCustomerRequests.get(sreq.id);
  if (!central || central.requestType !== 'Solution Request')
    fail('TEST 8 — Solution Request', 'not in central inbox', { RequestID: sreq.id });
  else
    pass('TEST 8 — Solution Request', {
      RequestID: sreq.id,
      AdminRequestVisible: true,
      Source: central.sourceModule,
      Type: central.requestType,
    });

  ctx.HubCustomerRequests.updateStatus(sreq.id, 'Approved', 'Admin Tester', 'قبول طلب الحل');
  const accepted = ctx.HubCustomerRequests.list({ view: 'approved' }).some((r) => r.id === sreq.id);
  const stillPending = ctx.HubCustomerRequests.list({ view: 'pending_review' }).some((r) => r.id === sreq.id);
  if (!accepted || stillPending) fail('TEST 9 — Accept Solution', `accepted=${accepted} pending=${stillPending}`);
  else pass('TEST 9 — Accept Solution', { RequestID: sreq.id, AcceptedRequestVisible: true });
} catch (e) {
  fail('TEST 8 — Solution Request', e.message);
}

// —— TEST 10 Cost Reduction
try {
  const cost = ctx.HubCustomerRequests.create(
    {
      requestType: 'Cost Reduction Assessment',
      title: 'TEST - خفض تكاليف التشغيل',
      description: 'طلب اختبار من برنامج خفض التكاليف',
      sourceModule: 'برنامج خفض التكاليف',
      sourcePage: 'cost-reduction.html',
      sourceUrl: 'cost-reduction.html',
      sourceAction: 'بدء التقييم',
      status: 'New',
      customerName: 'أحمد العميل',
      company: 'شركة المدى',
      email: 'client@naiosh.com',
      customer: { name: 'أحمد العميل', company: 'شركة المدى', email: 'client@naiosh.com' },
    },
    'أحمد العميل'
  );
  const found = ctx.HubCustomerRequests.get(cost.id);
  if (!found || !String(found.id).startsWith('COST'))
    fail('TEST 10 — Cost Reduction', `id=${found?.id}`);
  else
    pass('TEST 10 — Cost Reduction', {
      RequestID: found.id,
      AdminRequestVisible: true,
      Source: found.sourceModule,
      Type: found.requestType,
    });
} catch (e) {
  fail('TEST 10 — Cost Reduction', e.message);
}

// —— TEST Support + Project samples
try {
  const support = ctx.HubCustomerRequests.create(
    {
      requestType: 'Support Request',
      title: 'TEST - تذكرة دعم',
      sourceModule: 'الدعم',
      sourcePage: 'support',
      sourceAction: 'فتح تذكرة',
      email: 'client@naiosh.com',
      customerName: 'أحمد العميل',
    },
    'أحمد العميل'
  );
  const project = ctx.HubCustomerRequests.create(
    {
      requestType: 'Project Registration',
      title: 'TEST - تسجيل مشروع',
      sourceModule: 'طلبات تسجيل المشاريع',
      sourcePage: 'side-projects',
      sourceAction: 'تسجيل',
      email: 'client@naiosh.com',
      customerName: 'أحمد العميل',
    },
    'أحمد العميل'
  );
  const consult = ctx.HubCustomerRequests.create(
    {
      requestType: 'Consultation Request',
      title: 'TEST - استشارة',
      sourceModule: 'الاستشارات',
      sourcePage: 'consulting',
      sourceAction: 'طلب استشارة',
      email: 'client@naiosh.com',
      customerName: 'أحمد العميل',
    },
    'أحمد العميل'
  );
  const allIn = [support, project, consult].every((r) => !!ctx.HubCustomerRequests.get(r.id));
  if (!allIn) fail('TEST 11 — Multi-source samples', 'missing rows');
  else
    pass('TEST 11 — Multi-source samples', {
      Support: support.id,
      Project: project.id,
      Consultation: consult.id,
    });
} catch (e) {
  fail('TEST 11 — Multi-source samples', e.message);
}

// Audit presence
try {
  const audits = ctx.HubCustomerRequests.listAudit();
  const needed = ['Request Created', 'Approved', 'Published', 'Published Article Updated', 'Request Paused'];
  const missing = needed.filter((a) => !audits.some((x) => x.action === a));
  if (missing.length) fail('TEST 18 — Audit Log', `missing ${missing.join(',')}`);
  else pass('TEST 18 — Audit Log', { AuditVisible: true, Count: audits.length });
} catch (e) {
  fail('TEST 18 — Audit Log', e.message);
}

const failed = report.tests.filter((t) => t.result === 'FAIL').length;
report.finishedAt = new Date().toISOString();
report.summary = {
  total: report.tests.length,
  passed: report.tests.filter((t) => t.result === 'PASS').length,
  failed,
};
const out = path.join(root, 'scripts', '_e2e-customer-requests-report.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
console.log('\nReport:', out);
console.log(JSON.stringify(report.summary));
process.exit(failed ? 1 : 0);
