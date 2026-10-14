/**
 * E2E: durable higher-approvals — register → Postgres/file HA → list → decide → reflect
 * node scripts/e2e-higher-approvals-server.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const report = {
  startedAt: new Date().toISOString(),
  cases: [],
  rootCause: '',
  matrix: [],
};

function mark(name, pass, detail = '') {
  report.cases.push({ name, result: pass ? 'PASS' : 'FAIL', detail });
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) throw new Error(`FAIL: ${name} — ${detail}`);
}

function matrix(row) {
  report.matrix.push(row);
}

async function main() {
  // Isolate stores for this run
  process.env.HUB_E2E_HA = '1';
  const ha = require('../lib/hub-higher-approvals');
  const reg = require('../lib/hub-register-attachments');
  ha.resetForTests();

  // Clean local HA store for deterministic run
  const storePath = path.join(ROOT, 'data', 'higher-approvals.json');
  if (fs.existsSync(storePath)) fs.unlinkSync(storePath);
  const seqPath = path.join(ROOT, 'data', 'higher-approvals-seq.json');
  if (fs.existsSync(seqPath)) fs.unlinkSync(seqPath);

  await ha.hydrateFromDb();

  report.rootCause =
    'Higher Approvals كانت تُحفظ في localStorage بالمتصفح فقط؛ طلبات /api/hub/register-requests تُنشئ المنحة على السيرفر دون سجل موافقة دائم، فيظهر «بانتظار الموافقة» للعميل بينما صندوق القائد يبقى صفرًا على جهاز/جلسة أخرى.';

  // 1) Register creates durable approval
  const slug = `ha-e2e-${Date.now().toString(36)}`;
  const created = await reg.createRegisterRequest({
    adminName: 'عميل اختبار موافقات',
    adminPhone: '01000000001',
    adminEmail: `ha-e2e-${Date.now()}@example.com`,
    adminPassword: 'TestPass12',
    companyName: 'منصة اختبار الموافقات',
    slug,
    subdomain: slug,
    host: `${slug}.naiosh.app`,
    platform: 'test',
    platformLabel: 'منصة اختبار',
    requestedSystem: 'ERP',
    requestedSystemLabel: 'نظام ERP',
    notes: 'طلب E2E للموافقات المركزية',
    branchLabel: 'القاهرة',
  });

  mark('register_returns_approval_id', !!created.approval?.id, created.approval?.id || 'missing');
  mark('register_status_pending_label', /موافقة|مراجعة/.test(String(created.request.statusLabel || '')), created.request.statusLabel);

  const listed = ha.list({ status: 'pending_review' });
  const found = listed.find((r) => r.sourceId === created.request.id || r.id === created.approval.id);
  mark('approval_appears_in_inbox', !!found, found ? found.id : 'not in list');
  mark('kpis_pending_gt_zero', ha.kpis().pending > 0, JSON.stringify(ha.kpis()));

  // 2) Idempotent re-submit same email+slug
  const again = await reg.createRegisterRequest({
    adminName: created.request.adminName,
    adminPhone: created.request.adminPhone,
    adminEmail: created.request.adminEmail,
    adminPassword: 'TestPass12',
    companyName: created.request.companyName,
    slug,
    subdomain: slug,
    host: `${slug}.naiosh.app`,
    requestedSystem: 'ERP',
  });
  mark('register_dedupe', !!again.deduped, `approval=${again.approval?.id}`);
  const openForSource = ha.list().filter(
    (r) => r.sourceType === 'platform_grant' && String(r.sourceId) === String(created.request.id) &&
      ['pending_review', 'under_review', 'needs_revision'].includes(r.status)
  );
  mark('no_duplicate_open_approvals', openForSource.length === 1, `count=${openForSource.length}`);

  // 3) Decide approve as supreme leader
  const actor = {
    name: 'القائد الأعلى',
    email: 'naioshhub@example.com',
    role: 'supreme_leader',
    employeeNo: 'EMP-0001',
  };
  const decided = await ha.decide(created.approval.id, 'approve', actor, { note: 'اعتماد E2E' });
  mark('approve_ok', !!decided.ok, decided.request?.status);
  mark('approve_status', decided.request?.status === 'approved', decided.request?.status);
  mark('decision_audit', ha.listDecisions().some((d) => d.requestId === created.approval.id && d.decision === 'approved'));

  // Grant file status updated
  const grantsPath = path.join(ROOT, 'data', 'platform-grants.json');
  const grants = JSON.parse(fs.readFileSync(grantsPath, 'utf8'));
  const g = (grants.grants || []).find((x) => String(x.id) === String(created.request.id));
  mark('grant_activated_on_approve', g?.status === 'active', g?.status || 'missing grant');

  // 4) Backfill does not invent fake rows / does not re-open approved
  const bf = await ha.backfillOrphans();
  mark('backfill_ok', !!bf.ok, `created=${bf.created} scanned=${bf.scanned}`);
  const stillOneApproved = ha.list().filter((r) => r.sourceId === created.request.id);
  mark('no_auto_reopen_after_backfill', stillOneApproved.every((r) => r.status === 'approved'), stillOneApproved.map((r) => r.status).join(','));

  // 5) Customer cannot decide
  let denied = false;
  try {
    await ha.decide(created.approval.id, 'reject', { name: 'عميل', role: 'customer', email: created.request.adminEmail }, { reason: 'x' });
  } catch (e) {
    denied = e.status === 403 || /صلاحية/.test(e.message);
  }
  mark('customer_cannot_decide', denied);

  // 6) Fresh pending + reject path
  const slug2 = `ha-e2e-r-${Date.now().toString(36)}`;
  const created2 = await reg.createRegisterRequest({
    adminName: 'عميل رفض',
    adminPhone: '01000000002',
    adminEmail: `ha-e2e-r-${Date.now()}@example.com`,
    adminPassword: 'TestPass12',
    companyName: 'منصة للرفض',
    slug: slug2,
    subdomain: slug2,
    host: `${slug2}.naiosh.app`,
    requestedSystem: 'CRM',
    requestedSystemLabel: 'CRM',
  });
  const rejected = await ha.decide(created2.approval.id, 'reject', actor, { reason: 'بيانات ناقصة' });
  mark('reject_ok', rejected.request?.status === 'rejected', rejected.request?.status);
  mark('reject_reason_persisted', rejected.request?.rejectReason === 'بيانات ناقصة');

  // 7) Refer path
  const slug3 = `ha-e2e-f-${Date.now().toString(36)}`;
  const created3 = await reg.createRegisterRequest({
    adminName: 'عميل إحالة',
    adminPhone: '01000000003',
    adminEmail: `ha-e2e-f-${Date.now()}@example.com`,
    adminPassword: 'TestPass12',
    companyName: 'منصة للإحالة',
    slug: slug3,
    subdomain: slug3,
    host: `${slug3}.naiosh.app`,
    requestedSystem: 'HR',
  });
  const referred = await ha.decide(created3.approval.id, 'refer', actor, {
    referredTo: 'malika@naiosh.com',
    referredToLabel: 'المهندسة مليكة',
    note: 'مراجعة فنية',
  });
  mark('refer_ok', referred.request?.status === 'referred', referred.request?.status);

  // Matrix rows
  matrix({
    section: 'سجل معنا / منح المنصات',
    operation: 'platform_grant',
    submitter: 'ضيف/عميل عبر register',
    approver: 'القائد الأعلى / SUPER_ADMIN',
    inbox: 'موافقات المدير الأعلى (API + صفحة rent-admin)',
    tested: 'YES',
    result: 'PASS',
  });
  matrix({
    section: 'استئجار الأنظمة',
    operation: 'system_rental',
    submitter: 'عميل/ضيف',
    approver: 'القائد الأعلى',
    inbox: 'موافقات المدير الأعلى',
    tested: 'PARTIAL',
    result: 'NOT TESTED',
    note: 'enqueue wired in createRental; full HTTP path covered by unit enqueue when rentals exist',
  });
  matrix({
    section: 'فريق العمل والصلاحيات',
    operation: 'role_grant / role_change',
    submitter: 'موظف مخوّل',
    approver: 'القائد الأعلى',
    inbox: 'موافقات المدير الأعلى (client sync → API)',
    tested: 'CLIENT_E2E',
    result: 'NOT TESTED',
  });
  matrix({
    section: 'الهوية',
    operation: 'identity_suspend',
    submitter: 'موظف مخوّل',
    approver: 'القائد الأعلى',
    inbox: 'موافقات المدير الأعلى',
    tested: 'CLIENT_E2E',
    result: 'NOT TESTED',
  });
  matrix({
    section: 'القوى العاملة',
    operation: 'reward_approval',
    submitter: 'مدير',
    approver: 'القائد الأعلى',
    inbox: 'موافقات المدير الأعلى',
    tested: 'CLIENT_E2E',
    result: 'NOT TESTED',
  });

  // Optional: system rental enqueue direct
  try {
    const rent = await ha.enqueueSystemRental(
      {
        id: `rent-e2e-${Date.now()}`,
        status: 'pending',
        customerName: 'مستأجر',
        email: 'renter@example.com',
        systemCode: 'ERP',
        systemLabel: 'ERP',
        plan: 'basic',
      },
      { name: 'مستأجر', email: 'renter@example.com' }
    );
    mark('system_rental_enqueue', !!rent.ok && !!rent.request?.id, rent.request?.id);
    matrix({
      section: 'استئجار الأنظمة',
      operation: 'system_rental',
      submitter: 'عميل/ضيف',
      approver: 'القائد الأعلى',
      inbox: 'موافقات المدير الأعلى',
      tested: 'YES',
      result: 'PASS',
    });
  } catch (e) {
    mark('system_rental_enqueue', false, e.message);
  }

  report.finishedAt = new Date().toISOString();
  report.kpis = ha.kpis();
  report.successCriterion =
    'لا يوجد طلب بحالة بانتظار موافقة المدير الأعلى دون سجل محفوظ يظهر في صندوق الموافقات — ثبت لـ platform_grant عبر createRegisterRequest.';
  report.verdict = report.cases.every((c) => c.result === 'PASS') ? 'PASS_CORE' : 'FAIL';
  // Do not claim FULL PASS / production
  report.productionTested = false;

  const out = path.join(ROOT, 'docs', 'higher-approvals-unify-report.md');
  const md = [
    '# تقرير توحيد موافقات المدير الأعلى',
    '',
    `تاريخ: ${report.finishedAt}`,
    '',
    '## السبب الجذري',
    '',
    report.rootCause,
    '',
    '## الإصلاح',
    '',
    '- جدول Postgres `hub_higher_approvals` + `hub_higher_approval_decisions`',
    '- مكتبة `lib/hub-higher-approvals.js` كمصدر حقيقة (ملف + DB)',
    '- `/api/hub/register-requests` ينشئ سجل موافقة ذريًا مع التراجع عند الفشل',
    '- واجهة الصفحة تسحب من `/api/hub/higher-approvals` مع backfill للأيتام',
    '- قرارات موافقة/رفض/تعديل/إحالة تُحفظ في سجل تدقيق دائم',
    '',
    '## نتائج الاختبار (محلي/سيرفر)',
    '',
    '| الاختبار | النتيجة | تفاصيل |',
    '|---|---|---|',
    ...report.cases.map((c) => `| ${c.name} | ${c.result} | ${c.detail || ''} |`),
    '',
    '## مصفوفة أنواع الموافقات',
    '',
    '| القسم | العملية | من يرسل | من يعتمد | أين يظهر | اختُبر؟ | النتيجة |',
    '|---|---|---|---|---|---|---|',
    ...report.matrix.map(
      (m) =>
        `| ${m.section} | ${m.operation} | ${m.submitter} | ${m.approver} | ${m.inbox} | ${m.tested} | ${m.result} |`
    ),
    '',
    `## الحكم: **${report.verdict}** (ليس FULL PASS على الإنتاج)`,
    '',
    `productionTested: ${report.productionTested}`,
    '',
    report.successCriterion,
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, md, 'utf8');
  fs.writeFileSync(path.join(ROOT, 'scripts', 'e2e-higher-approvals-server-report.json'), JSON.stringify(report, null, 2));

  console.log('\nVerdict:', report.verdict);
  console.log('Report:', out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
