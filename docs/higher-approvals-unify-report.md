# تقرير توحيد موافقات المدير الأعلى

تاريخ: 2026-10-14T22:13:51.839Z

## السبب الجذري

Higher Approvals كانت تُحفظ في localStorage بالمتصفح فقط؛ طلبات /api/hub/register-requests تُنشئ المنحة على السيرفر دون سجل موافقة دائم، فيظهر «بانتظار الموافقة» للعميل بينما صندوق القائد يبقى صفرًا على جهاز/جلسة أخرى.

## الإصلاح

- جدول Postgres `hub_higher_approvals` + `hub_higher_approval_decisions`
- مكتبة `lib/hub-higher-approvals.js` كمصدر حقيقة (ملف + DB)
- `/api/hub/register-requests` ينشئ سجل موافقة ذريًا مع التراجع عند الفشل
- واجهة الصفحة تسحب من `/api/hub/higher-approvals` مع backfill للأيتام
- قرارات موافقة/رفض/تعديل/إحالة تُحفظ في سجل تدقيق دائم

## نتائج الاختبار (محلي/سيرفر)

| الاختبار | النتيجة | تفاصيل |
|---|---|---|
| register_returns_approval_id | PASS | APR-2026-00005 |
| register_status_pending_label | PASS | بانتظار موافقة المدير الأعلى |
| approval_appears_in_inbox | PASS | APR-2026-00005 |
| kpis_pending_gt_zero | PASS | {"pending":2,"underReview":0,"approved":1,"rejected":1,"needsRevision":0,"referred":1,"all":5} |
| register_dedupe | PASS | approval=APR-2026-00005 |
| no_duplicate_open_approvals | PASS | count=1 |
| approve_ok | PASS | approved |
| approve_status | PASS | approved |
| decision_audit | PASS |  |
| grant_activated_on_approve | PASS | active |
| backfill_ok | PASS | created=1 scanned=5 |
| no_auto_reopen_after_backfill | PASS | approved |
| customer_cannot_decide | PASS |  |
| reject_ok | PASS | rejected |
| reject_reason_persisted | PASS |  |
| refer_ok | PASS | referred |
| system_rental_enqueue | PASS | APR-2026-00009 |

## مصفوفة أنواع الموافقات

| القسم | العملية | من يرسل | من يعتمد | أين يظهر | اختُبر؟ | النتيجة |
|---|---|---|---|---|---|---|
| سجل معنا / منح المنصات | platform_grant | ضيف/عميل عبر register | القائد الأعلى / SUPER_ADMIN | موافقات المدير الأعلى (API + صفحة rent-admin) | YES | PASS |
| استئجار الأنظمة | system_rental | عميل/ضيف | القائد الأعلى | موافقات المدير الأعلى | PARTIAL | NOT TESTED |
| فريق العمل والصلاحيات | role_grant / role_change | موظف مخوّل | القائد الأعلى | موافقات المدير الأعلى (client sync → API) | CLIENT_E2E | NOT TESTED |
| الهوية | identity_suspend | موظف مخوّل | القائد الأعلى | موافقات المدير الأعلى | CLIENT_E2E | NOT TESTED |
| القوى العاملة | reward_approval | مدير | القائد الأعلى | موافقات المدير الأعلى | CLIENT_E2E | NOT TESTED |
| استئجار الأنظمة | system_rental | عميل/ضيف | القائد الأعلى | موافقات المدير الأعلى | YES | PASS |

## الحكم: **PASS_CORE** (ليس FULL PASS على الإنتاج)

productionTested: false

لا يوجد طلب بحالة بانتظار موافقة المدير الأعلى دون سجل محفوظ يظهر في صندوق الموافقات — ثبت لـ platform_grant عبر createRegisterRequest.
