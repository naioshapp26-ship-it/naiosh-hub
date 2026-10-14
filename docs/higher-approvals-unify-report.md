# تقرير توحيد موافقات المدير الأعلى

تاريخ: 2026-10-14

## السبب الجذري

Higher Approvals كانت تُحفظ في `localStorage` بالمتصفح فقط (`naiosh_hub_higher_approvals_v1`).  
مسار `/api/hub/register-requests` يحفظ طلب التسجيل/المنحة على السيرفر ويعرض للعميل «بانتظار موافقة المدير الأعلى»، **دون** إنشاء سجل موافقة دائم. لذلك صندوق القائد على جلسة/جهاز آخر يبقى بعدادات صفر.

## الإصلاح

- جداول Postgres: `hub_higher_approvals` + `hub_higher_approval_decisions`
- مكتبة `lib/hub-higher-approvals.js` كمصدر حقيقة (ملف + DB)
- `/api/hub/register-requests` و`system-rentals/submit` ينشئان سجل موافقة ذريًا مع التراجع عند الفشل
- منع التكرار عبر `(source_type, source_id)` للحالات المفتوحة/المُحالة
- الواجهة تسحب من `/api/hub/higher-approvals` مع backfill للأيتام
- قرارات: موافقة / رفض مع السبب / إعادة للتعديل / إحالة للمختص + سجل تدقيق + إشعارات
- منح المنصات تُمرَّر أيضًا إلى `hub_meta.platform_grants_v1` للبقاء بعد إعادة النشر

## إثبات HTTP محلي (سيرفر حقيقي)

| الخطوة | النتيجة |
|---|---|
| POST `/api/hub/register-requests` | `ok=true` · `requestId=REG-REQ-MV8O4U1Y-BA16` · `approvalId=APR-2026-00011` · الحالة: بانتظار موافقة المدير الأعلى |
| GET `/api/hub/higher-approvals` (قائد) | الطلب ظاهر في الصندوق · KPIs > 0 |
| POST `.../APR-2026-00011/decide` approve | `status=approved` · `decidedBy=القائد الأعلى` |

ملفات الإثبات: `/opt/cursor/artifacts/ha-http-proof-summary.json`

## نتائج الاختبار الآلي

| الاختبار | النتيجة |
|---|---|
| `scripts/e2e-higher-approvals-server.js` | PASS_CORE |
| `scripts/e2e-higher-approvals.js` | 27/27 PASS |
| `scripts/e2e-higher-approvals-inbox.js` | 4/4 PASS |

## مصفوفة أنواع الموافقات

| القسم | العملية | من يرسل | من يعتمد | أين يظهر | اختُبر؟ | النتيجة |
|---|---|---|---|---|---|---|
| سجل معنا / منح المنصات | platform_grant | ضيف/عميل عبر register | القائد الأعلى / SUPER_ADMIN | موافقات المدير الأعلى (API + صفحة rent-admin) | YES (HTTP+unit) | PASS |
| استئجار الأنظمة | system_rental | عميل/ضيف | القائد الأعلى | موافقات المدير الأعلى | YES (enqueue) | PASS |
| فريق العمل والصلاحيات | role_grant / role_change | موظف مخوّل | القائد الأعلى | موافقات المدير الأعلى (client→API) | CLIENT_E2E | PASS |
| الهوية | identity_suspend | موظف مخوّل | القائد الأعلى | موافقات المدير الأعلى | CLIENT_E2E | PASS |
| القوى العاملة | reward_approval | مدير | القائد الأعلى | موافقات المدير الأعلى | CLIENT_E2E | PASS |
| مقالات/محتوى | content review | محرر | مكتب المحتوى (ليس المدير الأعلى) | مقالات — ليس صندوق المدير الأعلى عمدًا | YES | PASS (معزول) |
| إعلانات/منتجات | specialist review | عميل | موظف مختص | صناديق المراجعة المختصة | NOT TESTED | NOT TESTED |

## الحكم

**PASS_CORE** على البيئة المحلية/HTTP — **ليس FULL PASS على الإنتاج**.

معيار النجاح النهائي يتحقق بعد النشر على الإنتاج: لا يوجد طلب بحالة «بانتظار موافقة المدير الأعلى» دون سجل محفوظ يظهر في صندوق الموافقات.
