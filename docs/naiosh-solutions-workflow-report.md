# تقرير إصلاح مسار «حلول نايوش»

## سبب عدم عمل زر «اختيار حل»
الأزرار داخل `.so-card-actions` كانت محاطة بـ `onclick="event.stopPropagation()"`. مستمع النقر مفوّض على `#so-app`، فـ `stopPropagation` منع وصول الحدث إلى الـ handler — والضغط كان لا يفعل شيئاً.

## سبب عدم عمل زر «طلب عرض سعر»
1. نفس مشكلة `stopPropagation`.
2. الزر كان يُعرض فقط عندما `ctaType === 'Request Quote'` أو `priceType === 'quote'` (~11 من 22 بطاقة)، وليس على كل الحلول.

## الملفات التي تم تعديلها
- `js/hub-solutions-ui.js` — مسار اختيار/عرض سعر، ملخص الحل، استئناف الزائر، نموذج العرض، منع التكرار، حالات عربية
- `js/hub-solutions-data.js` — `Pending Review`، `customerId`، ربط `createQuotation` بالمخزن المركزي
- `js/hub-customer-requests.js` — حالات عربية، `createQuotation` / `decideQuotation` / `listQuotations`
- `js/hub-posha-clients.js` — نوع `solution`، إجراءات عرض/قبول/إعداد عرض سعر/طلب تعديل/رفض، نموذج عرض السعر
- `js/login.js` — السماح لـ `next` العام بعد دخول العميل (استئناف الحل)
- `naiosh-solutions.html` — تحديث إصدارات السكربت/الـ CSS
- `css/hub-service-offers.css` — ملخص الحل، نموذج العرض، النجاح، تجاوب
- `scripts/e2e-naiosh-solutions-workflow.js` — اختبارات 1–14
- `docs/naiosh-solutions-workflow-e2e-report.json` — تقرير آلي

## APIs التي تم إصلاحها/إضافتها
- `HubSolutions.createRequest` → يكتب في `HubCustomerRequests` بحالة `بانتظار المراجعة` + `Solution ID` + `Customer ID` + المصدر `حلول نايوش`
- `HubCustomerRequests.createQuotation(requestId, payload, actor)`
- `HubCustomerRequests.decideQuotation(qid, accept|reject|revise, actor, note)`
- `HubCustomerRequests.listQuotations(requestId)`
- `HubSolutions.createQuotation` / `decideQuotation` / `listQuotations` مربوطة بالمخزن المركزي

## ربط Solution ID بالطلب
كل زر يحمل `data-id="{SOL-…}"`. عند الإرسال يُمرَّر `solutionId` إلى `createRequest` ويُحفظ في الطلب المركزي كـ `solutionId` + `referenceType: Solution` + `referenceId`.

## نتائج الاختبار (E2E)
| الاختبار | النتيجة |
|---|---|
| TEST 1 تسجيل دخول عميل | PASS |
| TEST 2 اختيار حل (صف أول) | PASS |
| TEST 3 طلب عرض سعر بحل مختلف | PASS |
| TEST 4 إرسال طلب عرض سعر | PASS |
| TEST 5 رسالة نجاح + Request ID | PASS |
| TEST 6 دخول الإدارة | PASS |
| TEST 7 ظهور الطلب في طلبات العملاء | PASS |
| TEST 8 تطابق Customer/Solution/البيانات | PASS |
| TEST 9 إعداد وإرسال عرض السعر | PASS |
| TEST 10 ظهور العرض في طلباتي | PASS |
| TEST 11 منع الطلب المكرر | PASS |
| TEST 12 زائر ثم دخول يستأنف الحل | PASS |
| TEST 13 عدة بطاقات | PASS |
| TEST 14 Desktop/Tablet/Mobile styles | PASS |

## أدلة التشغيل
- **Request ID:** `SOL-REQ-2026-00001`
- **Quote ID:** `QT-2026-00001`
- **ظهر في الإدارة؟** نعم (`HubCustomerRequests` / عملاء بوشا ← طلبات العملاء)
- **تم إنشاء عرض سعر؟** نعم (12500 ر.س، مرتبط بنفس Request ID)
- **عاد العرض للعميل؟** نعم داخل «طلباتي» → تبويب العرض المالي
