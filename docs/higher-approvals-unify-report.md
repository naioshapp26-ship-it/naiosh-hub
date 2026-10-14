# تقرير توحيد موافقات المدير الأعلى

تاريخ: 2026-10-14T23:24:46.527Z

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
| register_returns_approval_id | PASS | APR-2026-00032 |
| register_status_pending_label | PASS | بانتظار موافقة المدير الأعلى |
| approval_appears_in_inbox | PASS | APR-2026-00032 |
| kpis_pending_gt_zero | PASS | {"pending":16,"underReview":0,"approved":5,"rejected":6,"needsRevision":0,"referred":5,"all":32} |
| register_dedupe | PASS | approval=APR-2026-00032 |
| no_duplicate_open_approvals | PASS | count=1 |
| approve_ok | PASS | approved |
| approve_status | PASS | approved |
| decision_audit | PASS |  |
| grant_activated_on_approve | PASS | active |
| backfill_ok | PASS | created=0 scanned=33 |
| no_auto_reopen_after_backfill | PASS | approved |
| customer_cannot_decide | PASS |  |
| admin_cannot_decide | PASS |  |
| data_path_blocked_in_code | PASS |  |
| reject_ok | PASS | rejected |
| reject_reason_persisted | PASS |  |
| refer_ok | PASS | referred |
| role_grant_durable | PASS | APR-2026-00035 |
| role_grant_in_inbox | PASS |  |
| identity_suspend_durable | PASS | APR-2026-00036 |
| reward_approval_durable | PASS | APR-2026-00037 |
| system_rental_enqueue | PASS | APR-2026-00038 |

## مصفوفة أنواع الموافقات

| القسم | العملية | من يرسل | من يعتمد | أين يظهر | اختُبر؟ | النتيجة |
|---|---|---|---|---|---|---|
| سجل معنا / منح المنصات | platform_grant | ضيف/عميل عبر register | القائد الأعلى / SUPER_ADMIN | موافقات المدير الأعلى (API + صفحة rent-admin) | YES | PASS |
| فريق العمل والصلاحيات | role_grant / role_change | موظف مخوّل | القائد الأعلى | موافقات المدير الأعلى (API durable) | YES | PASS |
| الهوية | identity_suspend | موظف مخوّل | القائد الأعلى | موافقات المدير الأعلى | YES | PASS |
| القوى العاملة | reward_approval | مدير | القائد الأعلى | موافقات المدير الأعلى | YES | PASS |
| محفظة العميل / شحن إداري | wallet_topup | عميل | موظف مالي مختص (ليس صندوق المدير الأعلى) | بوابة العميل / مالية — معزول عمدًا | ENUMERATED | PASS (معزول) |
| مقالات/محتوى | content_review | محرر | مكتب المحتوى | مقالات — ليس صندوق المدير الأعلى عمدًا | ENUMERATED | PASS (معزول) |
| إعلانات/حملات | ads_campaign_review | عميل/مسوّق | موظف مختص | صناديق المراجعة المختصة | ENUMERATED | PASS (معزول) |
| باقات الاشتراك | package_order | عميل | دفع تلقائي / مختص باقات | packages — ليس صندوق المدير الأعلى عمدًا | ENUMERATED | PASS (معزول) |
| الإنتاج | full_cycle_register→inbox→decide→reflect | حساب مختلف | المدير الأعلى | موافقات المدير الأعلى (إنتاج) | NO | NOT TESTED |
| استئجار الأنظمة | system_rental | عميل/ضيف | القائد الأعلى | موافقات المدير الأعلى | YES | PASS |

## الحكم: **PASS_CORE** (ليس FULL PASS على الإنتاج)

productionTested: false

لا يوجد طلب بحالة بانتظار موافقة المدير الأعلى دون سجل محفوظ يظهر في صندوق الموافقات — ثبت لـ platform_grant عبر createRegisterRequest.
