/**
 * E2E: موافقات المدير الأعلى — 3 مصادر حقيقية → ظهور → قرار → انعكاس على المصدر
 * node scripts/e2e-higher-approvals-inbox.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const report = [];
const push = (row) => {
  report.push(row);
  const mark = row.result === 'PASS' ? '✓' : '✗';
  console.log(`${mark} ${row.source} | ${row.aprId || '—'} | ${row.action} | inbox=${row.appeared} | reflect=${row.reflected} | ${row.result}`);
};

function makeCtx() {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  const notifications = [];
  const windowObj = {
    localStorage,
    HubStore: null,
    HubAuth: {
      getUser: () => ({
        name: 'المدير الأعلى',
        email: 'leader@naiosh.com',
        role: 'supreme_leader',
        employeeNo: 'EMP-0001',
        naioshId: 'NAI-LEADER-001',
      }),
    },
    dispatchEvent: () => {},
    addEventListener: () => {},
    CustomEvent: function CustomEvent(name, init) {
      this.type = name;
      this.detail = init?.detail;
    },
    fetch: async () => ({ ok: false, json: async () => ({}) }),
  };
  const document = {
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: () => null,
    addEventListener: () => {},
    body: { appendChild: () => {}, dataset: {} },
  };
  const ctx = { window: windowObj, localStorage, document, console, CustomEvent: windowObj.CustomEvent, URL, setTimeout, clearTimeout };
  vm.createContext(ctx);
  ctx.window.document = document;
  ctx.window.HubStore = {
    pushNotification: (p) => {
      notifications.push(p);
      return p;
    },
    createHubNotification: (p) => {
      notifications.push(p);
      return p;
    },
    grantSubscription: () => ({}),
    pushFeed: () => {},
    rewardEmployee: null,
    decideReward: null,
    _notifications: notifications,
  };
  return { ctx, notifications, localStorage };
}

function boot(ctx) {
  const files = [
    'js/hub-access-governance-store.js',
    'js/hub-access-governance-engine.js',
    'js/hub-platform-grants.js',
    'js/hub-rent-store.js',
    'js/hub-higher-approvals.js',
    'js/hub-higher-approvals-ui.js',
  ];
  for (const f of files) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  }
  // Minimal HubStore reward APIs for workforce source
  const rewards = [];
  ctx.window.HubStore.rewardEmployee = (id, amount, extras = {}, actor = 'مشغّل هوب') => {
    const item = {
      id: `RWD-${rewards.length + 1}`,
      employeeId: id,
      employee: extras.subjectName || 'موظف تجريبي',
      type: extras.type || 'مالية',
      value: Number(extras.value ?? amount),
      points: Number(extras.points || 0),
      reason: extras.reason || 'مكافأة',
      status: extras.requiresApproval && !extras.forceGrant ? 'Pending Approval' : 'Approved',
      pointsApplied: false,
    };
    rewards.push(item);
    if (item.status === 'Pending Approval' && ctx.window.HubHigherApprovals?.enqueueRewardApproval) {
      const ticket = ctx.window.HubHigherApprovals.enqueueRewardApproval(
        {
          rewardId: item.id,
          subjectName: item.employee,
          subjectEmployeeNo: extras.subjectEmployeeNo || id,
          employeeId: id,
          rewardType: item.type,
          value: item.value,
          points: item.points,
          reason: item.reason,
          priority: 'high',
        },
        typeof actor === 'string' ? { name: actor } : actor
      );
      item.higherApprovalId = ticket.id;
    }
    return item;
  };
  ctx.window.HubStore.decideReward = (id, decision, comment = '', actor = 'مشغّل هوب') => {
    const r = rewards.find((x) => x.id === id);
    if (!r) return null;
    if (decision === 'approve') {
      r.status = 'Approved';
      r.approvedBy = actor;
      r.pointsApplied = true;
    } else {
      r.status = 'Rejected';
      r.rejectReason = comment;
    }
    return r;
  };
  ctx.window.__rewards = rewards;
}

function main() {
  const { ctx, notifications } = makeCtx();
  boot(ctx);
  const HA = ctx.window.HubHigherApprovals;
  const E = ctx.window.HubAccessGov;
  const S = ctx.window.HubAccessGovStore;
  const PG = ctx.window.HubPlatformGrants;
  const boss = {
    name: 'المدير الأعلى',
    email: 'leader@naiosh.com',
    role: 'supreme_leader',
    employeeNo: 'EMP-0001',
    naioshId: 'NAI-LEADER-001',
  };
  const staff = { name: 'أحمد محمد', email: 'ahmed@naiosh.test', employeeNo: 'EMP-0014', naioshId: 'NAI-AHMED', role: 'admin' };

  S.get();
  const emp = E.registerEmployee(
    { name: 'سارة علي', email: 'sara@naiosh.test', naioshId: 'NAI-SARA-APR' },
    staff.name
  );

  // ——— Source 1: Team ops role grant ———
  const beforeGrants = (S.get().grants || []).filter((g) => g.naioshId === emp.naioshId && g.roleCode === 'HUB_ADMIN').length;
  const t1 = HA.enqueueRoleAssignment(
    {
      naioshId: emp.naioshId,
      subjectName: emp.name,
      subjectEmployeeNo: emp.employeeNo,
      roleCode: 'HUB_ADMIN',
      system: 'HUB',
      permissions: ['roles.assign', 'users.manage'],
      reason: 'منح الموظف صلاحيات تشغيلية جديدة',
    },
    staff
  );
  const midGrants = (S.get().grants || []).filter((g) => g.naioshId === emp.naioshId && g.roleCode === 'HUB_ADMIN').length;
  const appeared1 = !!HA.list({ q: t1.id }).find((r) => r.id === t1.id);
  assert.strictEqual(midGrants, beforeGrants, 'role must NOT apply before approval');
  assert.ok(t1.sourceModuleLabel && /فريق العمل|صلاحيات/.test(t1.sourceModuleLabel), 'source label');
  assert.ok(/صلاحيات|دور|موظف/.test(t1.operationLabel), 'operation label');
  const a1 = HA.approve(t1.id, boss);
  assert.ok(a1.ok, a1.error);
  const afterGrants = (S.get().grants || []).filter((g) => g.naioshId === emp.naioshId && g.roleCode === 'HUB_ADMIN' && g.status !== 'revoked').length;
  push({
    source: 'إدارة فريق العمل والصلاحيات',
    aprId: t1.id,
    action: 'تفعيل دور HUB_ADMIN',
    appeared: appeared1 ? 'نعم' : 'لا',
    decision: 'موافقة',
    reflected: afterGrants > beforeGrants ? 'نعم' : 'لا',
    result: a1.ok && afterGrants > beforeGrants && appeared1 ? 'PASS' : 'FAIL',
  });

  // ——— Source 2: Platform grant ———
  // Bypass subdomain uniqueness by direct createRequest via enqueue after synthetic grant
  const grantState = JSON.parse(ctx.localStorage.getItem('naiosh_hub_platform_grants_v1') || '{"grants":[]}');
  const grant = {
    id: 'pgrant-e2e-001',
    kind: 'signup',
    source: 'register',
    companyName: 'شركة اختبار',
    slug: 'e2e-apr',
    host: 'e2e-apr.naiosh.local',
    adminName: 'خالد منصة',
    adminPhone: '0500000000',
    adminEmail: 'khaled.platform@test.naiosh',
    adminPassword: 'password123',
    country: 'SA',
    branch: 'RYD',
    branchLabel: 'الرياض',
    incubator: 'INC1',
    incubatorLabel: 'حاضنة 1',
    platform: 'TEST',
    platformLabel: 'منصة اختبار',
    requestedSystem: 'HUB',
    requestedSystemLabel: 'نايوش هوب',
    notes: 'طلب منصة للاختبار',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  grantState.grants = grantState.grants || [];
  grantState.grants.unshift(grant);
  ctx.localStorage.setItem('naiosh_hub_platform_grants_v1', JSON.stringify(grantState));
  const t2 = HA.enqueuePlatformGrant(grant, { name: grant.adminName, email: grant.adminEmail });
  const appeared2 = !!HA.get(t2.id);
  assert.ok(/منصات|سجل/.test(t2.sourceModuleLabel), t2.sourceModuleLabel);
  assert.strictEqual(PG.getGrant?.(grant.id)?.status || PG.listGrants?.().find((g) => g.id === grant.id)?.status, 'pending');
  const r2 = HA.reject(t2.id, 'بيانات المنصة غير مكتملة', boss);
  assert.ok(r2.ok, r2.error);
  const grantAfter = PG.listGrants().find((g) => g.id === grant.id);
  push({
    source: 'سجل معنا / منح المنصات',
    aprId: t2.id,
    action: 'اعتماد إضافة منصة',
    appeared: appeared2 ? 'نعم' : 'لا',
    decision: 'رفض',
    reflected: grantAfter?.status === 'rejected' ? 'نعم' : 'لا',
    result: r2.ok && grantAfter?.status === 'rejected' && appeared2 ? 'PASS' : 'FAIL',
  });

  // ——— Source 3: Workforce reward ———
  const reward = ctx.window.HubStore.rewardEmployee(
    'EMP-TEST-1',
    500,
    {
      type: 'مالية',
      value: 500,
      points: 0,
      reason: 'مكافأة أداء ربع سنوي',
      requiresApproval: true,
      subjectName: 'نورة أحمد',
      subjectEmployeeNo: 'EMP-0022',
    },
    staff
  );
  const t3id = reward.higherApprovalId;
  const t3 = HA.get(t3id);
  assert.ok(t3, 'reward must create HA ticket');
  assert.strictEqual(t3.sourceModule, 'workforce', `sourceModule=${t3.sourceModule} label=${t3.sourceModuleLabel}`);
  assert.ok(t3.operationLabel, 'operation label present');
  const revise = HA.requestRevision(t3.id, 'وضح قيمة المكافأة والمبرر المالي', boss);
  assert.ok(revise.ok, revise.error);
  assert.strictEqual(HA.get(t3.id).status, 'needs_revision');
  // resubmit then approve
  HA.resubmit(t3.id, { reason: 'مكافأة أداء ربع سنوي — قيمة معتمدة 500' }, staff);
  const a3 = HA.approve(t3.id, boss);
  assert.ok(a3.ok, a3.error);
  const rewardAfter = ctx.window.__rewards.find((x) => x.id === reward.id);
  push({
    source: 'القوى العاملة',
    aprId: t3.id,
    action: 'اعتماد مكافأة موظف',
    appeared: t3 ? 'نعم' : 'لا',
    decision: 'طلب تعديل ثم موافقة',
    reflected: rewardAfter?.status === 'Approved' ? 'نعم' : 'لا',
    result: a3.ok && rewardAfter?.status === 'Approved' ? 'PASS' : 'FAIL',
  });

  // ——— Source 4 bonus: identity suspend appear + reject keeps active ———
  const t4 = HA.enqueueIdentitySuspend(
    {
      naioshId: emp.naioshId,
      subjectName: emp.name,
      subjectEmployeeNo: emp.employeeNo,
      reason: 'إيقاف مؤقت للاختبار',
      sourceModule: 'identity',
    },
    staff
  );
  const beforeSus = E.findIdentity(emp.naioshId)?.status;
  const rej4 = HA.reject(t4.id, 'لا مبرر كافٍ للإيقاف', boss);
  const afterSus = E.findIdentity(emp.naioshId)?.status;
  push({
    source: 'هوية نايوش',
    aprId: t4.id,
    action: 'إيقاف حساب موظف',
    appeared: !!HA.get(t4.id) ? 'نعم' : 'لا',
    decision: 'رفض',
    reflected: beforeSus === afterSus ? 'نعم (لم يُوقف)' : 'لا',
    result: rej4.ok && beforeSus === afterSus ? 'PASS' : 'FAIL',
  });

  // Notifications + audit
  const notifOk = notifications.some((n) => /موافقة|اعتماد|موافقتك/.test(`${n.title || ''}${n.body || ''}`));
  const decisions = HA.listDecisions();
  assert.ok(decisions.length >= 4, 'decisions logged');
  assert.ok(notifOk, 'notifications created');
  assert.ok(HA.canDecide(boss), 'boss can decide');
  assert.strictEqual(HA.canDecide({ name: 'visitor', role: 'customer' }), false, 'customer cannot decide');

  // UI smoke
  const html = ctx.window.HubHigherApprovalsUI.render({ user: boss });
  assert.ok(html.includes('موافقات المدير الأعلى'));
  assert.ok(html.includes('المصدر') || html.includes('ha-source') || html.includes('sourceModule'));
  assert.ok(/رقم الطلب|الطلب|العملية|الأولوية/.test(html));

  const failed = report.filter((r) => r.result !== 'PASS');
  console.log('\n=== تقرير اختبار موافقات المدير الأعلى ===');
  console.table(report);
  console.log(`الإشعارات: ${notifications.length} · قرارات السجل: ${decisions.length}`);
  if (failed.length) {
    console.error('FAILED', failed);
    process.exit(1);
  }
  console.log('PASS e2e-higher-approvals-inbox');
}

main();
