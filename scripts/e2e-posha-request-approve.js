/**
 * E2E: Customer Request approve/reject for Ads (+ generic)
 * Run: node scripts/e2e-posha-request-approve.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function makeSb() {
  const local = { _d: Object.create(null) };
  const sb = {
    console,
    URL,
    localStorage: {
      getItem(k) {
        return Object.prototype.hasOwnProperty.call(local._d, k) ? local._d[k] : null;
      },
      setItem(k, v) {
        local._d[k] = String(v);
      },
      removeItem(k) {
        delete local._d[k];
      },
    },
    document: {
      readyState: 'complete',
      body: { dataset: {} },
      addEventListener() {},
      dispatchEvent() {},
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      getElementById() {
        return null;
      },
    },
    window: null,
    CustomEvent: function (n) {
      this.type = n;
    },
  };
  sb.window = sb;
  sb.window.dispatchEvent = () => {};
  sb.window.addEventListener = () => {};
  sb.window.HubAuth = { getUser: () => ({ email: 'admin@test.com', name: 'Admin' }), isStaff: () => true };
  vm.createContext(sb);
  return sb;
}

function boot(sb) {
  const empire = { adsStudio: { listings: [] } };
  const nowIso = () => new Date().toISOString();
  sb.window.HubStore = {
    get: () => ({ empire }),
    setAdWorkflowStatus(id, workflowStatus, extra = {}, actor = 'Admin') {
      const ad = empire.adsStudio.listings.find((x) => x.id === id || x.adCode === id);
      if (!ad) return null;
      Object.assign(ad, extra);
      if (workflowStatus === 'active' || workflowStatus === 'approved') {
        const start = ad.adStartDate ? new Date(ad.adStartDate) : null;
        const startIsFuture = start && !Number.isNaN(start.getTime()) && start.getTime() > Date.now();
        ad.approvedBy = extra.approvedBy || actor;
        ad.approvedAt = extra.approvedAt || nowIso();
        if (startIsFuture) {
          ad.workflowStatus = 'scheduled';
          ad.publishStatus = 'deferred';
          ad.status = 'paused';
        } else {
          ad.workflowStatus = 'active';
          ad.publishStatus = 'published';
          ad.status = 'active';
        }
      } else if (workflowStatus === 'paused') {
        ad.workflowStatus = 'paused';
        ad.status = 'paused';
      } else if (workflowStatus === 'rejected') {
        ad.workflowStatus = 'rejected';
        ad.status = 'paused';
        ad.publishStatus = 'draft';
        ad.rejectionReason = extra.rejectionReason || '';
      } else if (workflowStatus === 'pending_review') {
        ad.workflowStatus = 'pending_review';
        ad.status = 'paused';
        ad.publishStatus = 'draft';
      } else {
        ad.workflowStatus = workflowStatus;
      }
      ad.updatedAt = nowIso();
      return ad;
    },
  };
  vm.runInContext(read('js/hub-customer-requests.js'), sb);
  return empire;
}

function createAdRequest(sb, empire, title) {
  const ad = {
    id: 'ad-' + Math.random().toString(16).slice(2, 8),
    adCode: 'AD-2026-00099',
    title,
    headline: title,
    contentType: 'image',
    mediaDataUrl: 'data:image/png;base64,xx',
    placements: ['home'],
    audience: 'all',
    adStartDate: '',
    adEndDate: '',
    destinationUrl: 'https://example.com',
    ctaLabel: 'اعرف المزيد',
    workflowStatus: 'pending_review',
    publishStatus: 'draft',
    status: 'paused',
    createdBy: 'client@test.com',
  };
  empire.adsStudio.listings.unshift(ad);
  const req = sb.window.HubCustomerRequests.ensureForAd(ad, 'client@test.com');
  return { ad, req };
}

function run() {
  const results = [];
  const pass = (n) => results.push({ name: n, ok: true });
  const fail = (n, e) => results.push({ name: n, ok: false, err: String(e.message || e) });

  try {
    const sb = makeSb();
    const empire = boot(sb);
    const { ad, req } = createAdRequest(sb, empire, 'نايوش فيت');
    assert.ok(req);
    assert.strictEqual(req.status, 'Pending Review');
    assert.strictEqual(req.requestType, 'Ad Submission');
    const pending = sb.window.HubCustomerRequests.list({ view: 'pending_review' });
    assert.ok(pending.some((r) => r.id === req.id));
    pass('1 create ad → pending customer request');
  } catch (e) {
    fail('1 create ad → pending customer request', e);
  }

  try {
    const sb = makeSb();
    const empire = boot(sb);
    const { ad, req } = createAdRequest(sb, empire, 'Ad Approve');
    assert.ok(sb.window.HubCustomerRequests.isPendingReview(req));
    const approved = sb.window.HubCustomerRequests.approveRequest(req.id, 'Admin');
    assert.strictEqual(approved.status, 'Approved');
    assert.ok(approved.approvedBy);
    assert.ok(approved.approvedAt);
    assert.strictEqual(ad.workflowStatus, 'active');
    assert.strictEqual(ad.status, 'active');
    const pending = sb.window.HubCustomerRequests.list({ view: 'pending_review' });
    assert.ok(!pending.some((r) => r.id === req.id));
    const accepted = sb.window.HubCustomerRequests.list({ view: 'approved' });
    assert.ok(accepted.some((r) => r.id === req.id));
    const notes = JSON.parse(sb.localStorage.getItem('naiosh_hub_notifications_v1') || '{"items":[]}');
    assert.ok((notes.items || []).some((n) => String(n.title).includes('الموافقة')));
    pass('2 approve → accepted + ad active + notify');
  } catch (e) {
    fail('2 approve → accepted + ad active + notify', e);
  }

  try {
    const sb = makeSb();
    const empire = boot(sb);
    const { ad, req } = createAdRequest(sb, empire, 'Ad Scheduled');
    const future = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    ad.adStartDate = future;
    ad.scheduleMode = 'scheduled';
    sb.window.HubCustomerRequests.approveRequest(req.id, 'Admin');
    assert.strictEqual(ad.workflowStatus, 'scheduled');
    assert.strictEqual(req.status, 'Approved');
    assert.ok(ad.approvedBy);
    pass('2b approve future start → scheduled');
  } catch (e) {
    fail('2b approve future start → scheduled', e);
  }

  try {
    const sb = makeSb();
    const empire = boot(sb);
    const { ad, req } = createAdRequest(sb, empire, 'Ad Reject');
    sb.window.HubCustomerRequests.rejectRequest(req.id, 'Admin', 'الصورة غير مناسبة', { allowResubmit: true });
    assert.strictEqual(req.status, 'Rejected');
    assert.strictEqual(req.rejectionReason, 'الصورة غير مناسبة');
    assert.strictEqual(ad.workflowStatus, 'rejected');
    assert.ok(req.allowResubmit);
    const notes = JSON.parse(sb.localStorage.getItem('naiosh_hub_notifications_v1') || '{"items":[]}');
    assert.ok((notes.items || []).some((n) => String(n.title).includes('رفض')));
    // resubmit
    ad.title = 'Ad Reject Fixed';
    sb.window.HubStore.setAdWorkflowStatus(ad.id, 'pending_review', {}, 'client@test.com');
    sb.window.HubCustomerRequests.ensureForAd(ad, 'client@test.com');
    assert.strictEqual(req.status, 'Pending Review');
    const pending2 = sb.window.HubCustomerRequests.list({ view: 'pending_review' });
    assert.ok(pending2.some((r) => r.id === req.id));
    pass('3 reject → reason + notify + resubmit to pending');
  } catch (e) {
    fail('3 reject → reason + notify + resubmit to pending', e);
  }

  try {
    const sb = makeSb();
    boot(sb);
    const generic = sb.window.HubCustomerRequests.create(
      {
        requestType: 'Service Request',
        requestTypeLabel: 'طلب خدمة',
        title: 'طلب دعم',
        status: 'Pending Review',
        customerName: 'عميل',
      },
      'عميل'
    );
    sb.window.HubCustomerRequests.approveRequest(generic.id, 'Admin');
    assert.strictEqual(generic.status, 'Approved');
    pass('4 generic request approve works');
  } catch (e) {
    fail('4 generic request approve works', e);
  }

  try {
    const js = read('js/hub-posha-clients.js');
    assert.ok(js.includes('data-req-approve'));
    assert.ok(js.includes('data-req-reject'));
    assert.ok(js.includes('عرض التفاصيل'));
    assert.ok(js.includes('قبول ونشر') || js.includes('✓ قبول'));
    assert.ok(!js.includes('data-req-status="${esc(r.id)}">الحالة</button>') || js.includes('primaryReqActionsHtml'));
    // table should not rely only on status button for pending
    assert.ok(js.includes('primaryReqActionsHtml'));
    pass('5 UI exposes approve/reject/details');
  } catch (e) {
    fail('5 UI exposes approve/reject/details', e);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  if (failed.length) process.exit(1);
}

run();
