/**
 * E2E: Events Center — register + create → admin approve → published
 * Run: node scripts/e2e-events-workspace.js
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
    sessionStorage: {
      _d: Object.create(null),
      getItem(k) {
        return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null;
      },
      setItem(k, v) {
        this._d[k] = String(v);
      },
      removeItem(k) {
        delete this._d[k];
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
  sb.window.HubAuth = {
    getUser: () => ({ email: 'client@test.com', name: 'عميل تجريبي', role: 'customer' }),
    isStaff: () => false,
    isLoggedIn: () => true,
  };
  sb.window.HubMarketplaceData = {
    EVENTS: [
      {
        id: 'ev-1',
        name: 'قمة القيادة',
        description: 'وصف',
        date: '2026-10-12',
        time: '19:00',
        status: 'قادمة',
        type: 'مؤتمرات',
        workflowStatus: 'published',
        pricing: 'free',
        attendanceType: 'online',
      },
    ],
  };
  vm.createContext(sb);
  return sb;
}

function boot(sb) {
  const empire = {
    eventsStudio: {
      events: JSON.parse(JSON.stringify(sb.window.HubMarketplaceData.EVENTS)),
    },
  };
  const nowIso = () => new Date().toISOString();
  const today = () => nowIso().slice(0, 10);
  const HubStore = {
    get: () => ({ empire }),
    save() {},
    addEvent(payload = {}) {
      const year = new Date().getFullYear();
      const event = Object.assign(
        {
          id: 'ev-' + Math.random().toString(16).slice(2, 8),
          eventCode: `EVT-${year}-00099`,
          createdAt: nowIso(),
          seatsTaken: 0,
        },
        payload,
        { updatedAt: nowIso(), date: payload.date || today() }
      );
      empire.eventsStudio.events.unshift(event);
      return event;
    },
    updateEvent(id, patch = {}) {
      const idx = empire.eventsStudio.events.findIndex((e) => e.id === id || e.eventCode === id);
      if (idx < 0) return null;
      Object.assign(empire.eventsStudio.events[idx], patch, { updatedAt: nowIso() });
      return empire.eventsStudio.events[idx];
    },
    setEventWorkflowStatus(id, workflowStatus, extra = {}) {
      return this.updateEvent(id, Object.assign({ workflowStatus }, extra));
    },
  };
  sb.HubStore = HubStore;
  sb.window.HubStore = HubStore;
  sb.globalThis = sb;
  vm.runInContext(read('js/hub-customer-requests.js'), sb);
  return empire;
}

function run() {
  const results = [];
  const pass = (n) => results.push({ name: n, ok: true });
  const fail = (n, e) => results.push({ name: n, ok: false, err: String(e.message || e) });

  try {
    const html = read('events.html');
    assert.ok(html.includes('hub-events-workspace.js'));
    assert.ok(!html.includes('hub-ops-path.js'));
    assert.ok(!html.includes('market-pages.js'));
    const js = read('js/hub-events-workspace.js');
    assert.ok(!js.includes('اشتر الآن'));
    assert.ok(js.includes('سجل مجانًا') || js.includes('سجل مجانا'));
    assert.ok(js.includes('احجز الآن'));
    assert.ok(js.includes('ensureForEvent'));
    pass('1 page shell + no ops buy CTA');
  } catch (e) {
    fail('1 page shell + no ops buy CTA', e);
  }

  try {
    const sb = makeSb();
    boot(sb);
    const ev = sb.window.HubStore.addEvent({
      name: 'فعالية اختبار',
      category: 'تدريب',
      summary: 'ملخص',
      description: 'وصف كامل',
      date: '2026-11-01',
      startTime: '18:00',
      attendanceType: 'online',
      pricing: 'free',
      workflowStatus: 'pending_review',
      createdBy: 'عميل تجريبي',
      organizerEmail: 'client@test.com',
    });
    const req = sb.window.HubCustomerRequests.ensureForEvent(ev, 'عميل تجريبي');
    assert.ok(req);
    assert.strictEqual(req.requestType, 'Event Submission');
    assert.strictEqual(req.status, 'Pending Review');
    assert.strictEqual(req.sourceModule, 'الفعاليات');
    const pending = sb.window.HubCustomerRequests.list({ view: 'pending_review' });
    assert.ok(pending.some((r) => r.id === req.id));
    pass('2 create event → customer request pending');
  } catch (e) {
    fail('2 create event → customer request pending', e);
  }

  try {
    const sb = makeSb();
    boot(sb);
    const ev = sb.window.HubStore.addEvent({
      name: 'فعالية للنشر',
      workflowStatus: 'pending_review',
      createdBy: 'عميل',
    });
    const req = sb.window.HubCustomerRequests.ensureForEvent(ev, 'عميل');
    const approved = sb.window.HubCustomerRequests.approveRequest(req.id, 'Admin');
    assert.strictEqual(approved.status, 'Approved');
    assert.strictEqual(ev.workflowStatus, 'published');
    const accepted = sb.window.HubCustomerRequests.list({ view: 'approved' });
    assert.ok(accepted.some((r) => r.id === req.id));
    pass('3 admin approve → published + accepted inbox');
  } catch (e) {
    fail('3 admin approve → published + accepted inbox', e);
  }

  try {
    const sb = makeSb();
    boot(sb);
    const ev = sb.window.HubStore.addEvent({
      name: 'للرفض',
      workflowStatus: 'pending_review',
      createdBy: 'عميل',
    });
    const req = sb.window.HubCustomerRequests.ensureForEvent(ev, 'عميل');
    sb.window.HubCustomerRequests.rejectRequest(req.id, 'Admin', 'الوصف ناقص', { allowResubmit: true });
    assert.strictEqual(req.status, 'Rejected');
    assert.strictEqual(ev.workflowStatus, 'rejected');
    assert.strictEqual(ev.rejectionReason, 'الوصف ناقص');
    pass('4 admin reject → event rejected with reason');
  } catch (e) {
    fail('4 admin reject → event rejected with reason', e);
  }

  try {
    const posha = read('js/hub-posha-clients.js');
    assert.ok(posha.includes("=== 'event'") || posha.includes('Event Submission'));
    pass('5 posha recognizes event requests');
  } catch (e) {
    fail('5 posha recognizes event requests', e);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  if (failed.length) process.exit(1);
}

run();
