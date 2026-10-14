# تقرير إنتاج — موافقات المدير الأعلى

BASE: `https://naiosh-hub-production.up.railway.app`  
PR الأصلي: [#237](https://github.com/naioshapp26-ship-it/naiosh-hub/pull/237) (merged)  
إصلاح انعكاس المنحة: فرع `cursor/ha-grant-status-reflect-ee32`  
آخر تحديث: 2026-10-14

## الحكم الحالي

**ليس FULL PASS بعد.**  
المسار الأساسي (تسجيل → صندوق → موافقة → استمرار) نجح على الإنتاج بعد نشر #237.  
**فشل جزئي:** رفض الطلب حدّث سجل الموافقات لكن المنحة الأصلية بقيت `pending` في `/api/hub/platform-grants` (ملف فقط دون `hub_meta`/ذاكرة السيرفر). أُصلح في الفرع اللاحق وبانتظار إعادة النشر وإعادة الاختبار.

## مصفوفة PASS / FAIL / NOT TESTED

| المسار | النتيجة | إثبات / ملاحظة |
|---|---|---|
| Health + DB | **PASS** | `/api/health` connected |
| منع `/data/higher-approvals.json` | **PASS** | HTTP 403 بعد النشر |
| GET HA بدون جلسة | **PASS** | 401 |
| دخول المدير الأعلى | **PASS** | `role=supreme_leader` |
| API الصندوق من Postgres | **PASS** | KPIs/list JSON حقيقي |
| تسجيل عميل مختلف → `approvalId` + «بانتظار موافقة المدير الأعلى» | **PASS** | `REG-REQ-MV8QS8VR-76B5` / `APR-2026-00001` |
| ظهور فوري في صندوق القائد | **PASS** | `pending_review` |
| موافقة تنعكس على الأصل | **PASS** | grant → `active/مفعّل` |
| استمرار بعد إعادة التحميل/إعادة الدخول | **PASS** | الطلبات 00002–00004 باقية بعد relogin |
| رفض → حالة HA | **PASS** | `APR-2026-00002` rejected |
| رفض → انعكاس المنحة الأصلية | **FAIL** (قبل الإصلاح) | grant بقي `pending` — يُعاد اختباره بعد نشر `ha-grant-status-reflect` |
| إعادة للتعديل + resubmit | **PASS** | needs_revision → pending_review |
| إحالة للمختص | **PASS** | referred |
| غير مخوّل لا يقرر عبر API | **PASS** | guest 401؛ `admin` ممنوع محليًا |
| عدّادات/فلاتر من السيرفر | **PASS** | `/kpis` يعيد أرقامًا متسقة |
| إعادة تشغيل الخدمة | **NOT TESTED** | لم نُعد تشغيل Railway يدويًا؛ الاستمرار بعد redeploy #237 يدل على Postgres |
| رحلة UI متصفح كاملة | **NOT TESTED** | الاختبار كان HTTP API |
| role/identity/reward على الإنتاج | **NOT TESTED** | لم تُنشأ من حساب موظف عبر الواجهة على prod |

## طلبات إنتاج أُنشئت أثناء التحقق

| APR | الحالة في الصندوق | المنحة |
|---|---|---|
| APR-2026-00001 | approved | active |
| APR-2026-00002 | rejected | pending (**فجوة**) |
| APR-2026-00003 | pending_review (بعد resubmit) | pending |
| APR-2026-00004 | referred | pending (متوقع حتى قرار نهائي) |

## الخطوة التالية

1. دمج ونشر `cursor/ha-grant-status-reflect-ee32`
2. إعادة اختبار رفض → `grant.status=rejected`
3. عند النجاح فقط: رفع الحكم إلى **FULL PASS** للمسارات المختبرة (مع الإبقاء على NOT TESTED لما لم يُختبر بالواجهة)
