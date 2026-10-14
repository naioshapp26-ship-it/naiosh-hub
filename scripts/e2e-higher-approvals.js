/**
 * E2E: موافقات المدير الأعلى — إنشاء · عدم التنفيذ · موافقة · رفض · طلب تعديل
 * node scripts/e2e-higher-approvals.js
 *
 * Staff enqueue paths await durable POST /api/hub/higher-approvals (mocked here).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const localStorage = (() => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
})();

const notifications = [];
const serverStore = { requests: [], decisions: [], seq: 0 };

const mockFetch = async (url, opts = {}) => {
  const u = String(url);
  const method = String(opts.method || 'GET').toUpperCase();
  if (u.includes('/api/hub/higher-approvals') && method === 'POST' && !u.includes('/decide')) {
    const body = JSON.parse(opts.body || '{}');
    if (body.sourceType && body.sourceId) {
      const existing = serverStore.requests.find(
        (r) =>
          r.sourceType === body.sourceType &&
          String(r.sourceId) === String(body.sourceId) &&
          ['pending_review', 'under_review', 'needs_revision', 'referred'].includes(r.status)
      );
      if (existing) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, request: existing, deduped: true }),
        };
      }
    }
    serverStore.seq += 1;
    const id = body.id || `APR-2026-${String(serverStore.seq).padStart(5, '0')}`;
    const row = {
      ...body,
      id,
      status: body.status || 'pending_review',
      _localOnly: false,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: body.history || [{ at: new Date().toISOString(), action: 'created', by: 'mock' }],
    };
    serverStore.requests.unshift(row);
    return {
      ok: true,
      status: 201,
      json: async () => ({ ok: true, request: row, deduped: false }),
    };
  }
  if (u.includes('/api/hub/higher-approvals') && method === 'GET') {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        requests: serverStore.requests,
        decisions: serverStore.decisions,
        kpis: { pending: serverStore.requests.filter((r) => r.status === 'pending_review').length },
      }),
    };
  }
  if (u.includes('/decide') && method === 'POST') {
    const id = decodeURIComponent(u.split('/higher-approvals/')[1]?.split('/')[0] || '');
    const body = JSON.parse(opts.body || '{}');
    const row = serverStore.requests.find((r) => r.id === id);
    if (row) {
      if (body.action === 'approve') row.status = 'approved';
      else if (body.action === 'reject') {
        row.status = 'rejected';
        row.rejectReason = body.reason || body.note || '';
      } else if (body.action === 'revise' || body.action === 'needs_revision') {
        row.status = 'needs_revision';
        row.revisionNote = body.note || body.reason || '';
      } else if (body.action === 'refer') row.status = 'referred';
      else if (body.action === 'start_review') row.status = 'under_review';
      row.updatedAt = new Date().toISOString();
      row.decidedAt = row.updatedAt;
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, request: row || null }) };
  }
  if (u.includes('/backfill')) {
    return { ok: true, status: 200, json: async () => ({ ok: true, created: 0 }) };
  }
  return { ok: false, status: 404, json: async () => ({ ok: false, error: 'not found' }) };
};

const windowObj = {
  localStorage,
  fetch: mockFetch,
  HubStore: {
    pushNotification: (p) => {
      notifications.push(p);
      return p;
    },
    createHubNotification: (p) => {
      notifications.push(p);
      return p;
    },
    grantSubscription: () => ({}),
  },
  dispatchEvent: () => {},
  addEventListener: () => {},
  CustomEvent: function CustomEvent(name, init) {
    this.type = name;
    this.detail = init?.detail;
  },
};

const document = {
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: () => null,
  addEventListener: () => {},
  body: { appendChild: () => {} },
};

const ctx = {
  window: windowObj,
  localStorage,
  document,
  console,
  fetch: mockFetch,
  setTimeout,
  CustomEvent: windowObj.CustomEvent,
};
vm.createContext(ctx);
ctx.window.document = document;

for (const f of [
  'js/hub-access-governance-store.js',
  'js/hub-access-governance-engine.js',
  'js/hub-higher-approvals.js',
  'js/hub-higher-approvals-ui.js',
]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
}

const E = ctx.window.HubAccessGov;
const S = ctx.window.HubAccessGovStore;
const HA = ctx.window.HubHigherApprovals;
const UI = ctx.window.HubHigherApprovalsUI;
const actorStaff = { name: 'موظف طلب', email: 'staff@test.naiosh', employeeNo: 'EMP-0099' };
const actorBoss = { name: 'المدير الأعلى', email: 'boss@test.naiosh', employeeNo: 'EMP-0001', role: 'supreme_leader' };
const tests = [];
const push = (n, ok, d) => tests.push({ n, ok: !!ok, d: d == null ? '' : String(d) });

(async () => {
  S.get();

  const emp = E.registerEmployee(
    { name: 'محمد حسن', email: 'mohamed.hassan@naiosh.test', naioshId: 'NAI-MH-APPROVAL' },
    actorStaff.name
  );
  push('T0-employee', !!emp?.employeeNo, emp?.employeeNo);

  const needs = HA.requiresHigherManagerApproval({
    type: 'role_grant',
    roleCode: 'HUB_ADMIN',
    permissions: ['roles.assign', 'users.manage'],
  });
  push('T1-requires-approval', needs === true);

  const beforeGrants = (S.get().grants || []).filter((g) => g.naioshId === emp.naioshId && g.roleCode === 'HUB_ADMIN').length;

  const ticket = await HA.enqueueRoleAssignment(
    {
      naioshId: emp.naioshId,
      subjectName: emp.name,
      subjectEmployeeNo: emp.employeeNo,
      roleCode: 'HUB_ADMIN',
      system: 'HUB',
      permissions: ['roles.assign', 'users.manage', 'roles.view'],
      reason: 'يحتاج صلاحيات إدارية للمحتوى',
      currentRoleCode: '',
      currentPermissions: [],
    },
    actorStaff
  );

  push('T2-ticket-created', /^APR-\d{4}-\d{5}$/.test(ticket.id), ticket.id);
  push('T2-status-pending', ticket.status === HA.STATUS.PENDING, ticket.status);
  push('T2-durable-not-local-only', ticket._localOnly !== true, String(ticket._localOnly));
  push(
    'T2-not-applied-yet',
    (S.get().grants || []).filter((g) => g.naioshId === emp.naioshId && g.roleCode === 'HUB_ADMIN').length === beforeGrants
  );
  push('T2-notify-boss', notifications.length >= 1 && !!notifications[0]?.title, notifications.map((n) => n.title).join('|'));
  push('T2-on-mock-server', serverStore.requests.some((r) => r.id === ticket.id));

  const pending = HA.list({ status: HA.STATUS.PENDING });
  push('T3-in-pending-list', pending.some((r) => r.id === ticket.id));
  push('T3-has-compare', !!(ticket.currentDisplay && ticket.requestedDisplay));
  push('T3-has-reason', ticket.reason.includes('إدارية'));

  push('T4-admin-cannot-decide', HA.canDecide({ name: 'مشرف', role: 'admin', employeeNo: 'EMP-0099' }) === false);
  const deniedAdmin = await HA.approve(ticket.id, { name: 'مشرف', role: 'admin', employeeNo: 'EMP-0099' }, 'bypass');
  push('T4-admin-approve-blocked', deniedAdmin.ok === false);

  const apr = await HA.approve(ticket.id, actorBoss, 'موافقة E2E');
  push('T4-approve-ok', apr.ok === true, apr.error || '');
  push('T4-status-approved', HA.get(ticket.id)?.status === HA.STATUS.APPROVED);
  push(
    'T4-applied',
    (S.get().grants || []).some(
      (g) => g.naioshId === emp.naioshId && g.roleCode === 'HUB_ADMIN' && String(g.status || 'ACTIVE').toUpperCase() !== 'REVOKED'
    )
  );
  push('T4-decision-log', HA.listDecisions().some((d) => d.requestId === ticket.id && d.decision === 'approved'));
  push('T4-notify-requester', notifications.some((n) => n.title && n.title.includes('تمت الموافقة')));

  const ticket2 = await HA.enqueueRoleAssignment(
    {
      naioshId: emp.naioshId,
      subjectName: emp.name,
      subjectEmployeeNo: emp.employeeNo,
      roleCode: 'SUPER_ADMIN',
      system: 'HUB',
      permissions: ['access_governance.manage', 'roles.manage'],
      reason: 'طلب صلاحية عليا للتجربة',
      currentRoleCode: 'HUB_ADMIN',
      currentPermissions: ['roles.assign'],
    },
    actorStaff
  );
  const rej = await HA.reject(ticket2.id, '', actorBoss);
  push('T5-reject-requires-reason', rej.ok === false);
  const rej2 = await HA.reject(ticket2.id, 'الصلاحيات أعلى من المطلوب', actorBoss);
  push('T5-reject-ok', rej2.ok === true, rej2.error || '');
  push(
    'T5-not-applied',
    !(S.get().grants || []).some(
      (g) => g.naioshId === emp.naioshId && g.roleCode === 'SUPER_ADMIN' && String(g.status || '').toUpperCase() === 'ACTIVE'
    )
  );
  push('T5-reason-visible', HA.get(ticket2.id)?.rejectReason === 'الصلاحيات أعلى من المطلوب');
  push('T5-notify-reject', notifications.some((n) => n.title && n.title.includes('رُفض')));

  const ticket3 = await HA.enqueueRoleAssignment(
    {
      naioshId: emp.naioshId,
      subjectName: emp.name,
      subjectEmployeeNo: emp.employeeNo,
      roleCode: 'BRANCH_MANAGER',
      system: 'HUB',
      permissions: ['users.manage', 'roles.view'],
      reason: 'إدارة فرع',
    },
    actorStaff
  );
  const rev = await HA.requestRevision(ticket3.id, 'قلّل الصلاحيات وأعد الإرسال', actorBoss);
  push('T6-revise-ok', rev.ok === true);
  push('T6-status-needs', HA.get(ticket3.id)?.status === HA.STATUS.NEEDS_REVISION);
  const resub = HA.resubmit(
    ticket3.id,
    {
      reason: 'إدارة فرع — بعد التعديل',
      requestedDisplay: 'الدور: مدير فرع\nصلاحيات مخفّضة',
    },
    actorStaff
  );
  push('T6-resubmit-ok', resub.ok === true);
  push('T6-back-pending', HA.get(ticket3.id)?.status === HA.STATUS.PENDING);

  const suspend = await HA.enqueueIdentitySuspend(
    {
      naioshId: emp.naioshId,
      subjectName: emp.name,
      subjectEmployeeNo: emp.employeeNo,
      reason: 'E2E suspend',
    },
    actorStaff
  );
  push('T8-identity-suspend-durable', !!suspend?.id && suspend._localOnly !== true, suspend?.id);
  push('T8-identity-on-server', serverStore.requests.some((r) => r.id === suspend.id && r.type === 'identity_suspend'));

  const reward = await HA.enqueueRewardApproval(
    {
      rewardId: 'RWD-E2E-1',
      subjectName: emp.name,
      subjectEmployeeNo: emp.employeeNo,
      rewardType: 'نقاط',
      value: 50,
      points: 50,
      reason: 'E2E reward',
    },
    actorStaff
  );
  push('T9-reward-durable', !!reward?.id && reward._localOnly !== true, reward?.id);
  push('T9-reward-on-server', serverStore.requests.some((r) => r.id === reward.id && r.type === 'reward_approval'));

  const html = UI.render({ user: actorBoss, toast: () => {} });
  push('T7-ui-title', html.includes('موافقات المدير الأعلى'));
  push('T7-ui-no-super-admin-label', !html.includes('موافقة السوبر أدمن'));
  push('T7-ui-tabs', html.includes('بانتظار المراجعة') && html.includes('سجل الموافقات'));
  push('T7-kpis', html.includes('ha-kpi'));

  const failed = tests.filter((t) => !t.ok);
  const report = {
    at: new Date().toISOString(),
    passed: tests.filter((t) => t.ok).length,
    failed: failed.length,
    tests,
    sampleTicket: ticket.id,
  };
  fs.writeFileSync(path.join(root, 'scripts/e2e-higher-approvals-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, sampleTicket: ticket.id }, null, 2));
  if (failed.length) {
    console.error('FAILED', failed);
    process.exit(1);
  }
  console.log('PASS higher-approvals e2e');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
