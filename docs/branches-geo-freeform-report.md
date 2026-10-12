# تقرير قبول — الفروع والموقع الجغرافي (كتابة حرة)

نماذج/أسطح مكتشفة في الجرد: **12+** · صفوف مختبرة هنا: **9** · PASS: **9** · FAIL: **0**

| الصفحة | النموذج | أُزيل الاختيار القديم؟ | كتابة يدوية | تحديد تلقائي | خريطة | حفظ دائم | إعادة فتح | النتيجة | دليل |
|---|---|---|---|---|---|---|---|---|---|
| API | geo/config | n/a | n/a | NO (expected without keys) | NO | n/a | n/a | **PASS** | خدمات Google Maps غير مفعّلة — يمكن كتابة اسم الفرع يدويًا دون خريطة. |
| API | platform-bookings | YES | YES | n/a | n/a | YES | YES | **PASS** | {"status":201,"branch":"فرعي في عمّان — كتابة حرة"} |
| branches.html | صفحة الفروع العامة | YES | YES | UI | UI | n/a | n/a | **PASS** | {"cards":0,"grid":false,"geo":true,"title":"حدد موقعك أو اكتب الفرع التابع لك","selectBranch":false} |
| book-incubator.html | حجز حاضنة | YES | YES | UI | UI | manual-ok | n/a | **PASS** | {"geo":true,"sel":false,"countrySel":false,"val":"فرعي التجريبي — إربد"} |
| book-platform.html | حجز منصة | YES | YES | UI | UI | n/a | n/a | **PASS** | {"geo":true,"sel":false} |
| book-office.html | حجز مكتب | YES | YES | UI | UI | n/a | n/a | **PASS** | {"geo":true,"sel":false} |
| register.html | سجل معنا | YES | YES | UI | UI | n/a | n/a | **PASS** | {"geo":true,"sel":false,"countrySel":false} |
| branches.html | رفض إذن الموقع + كتابة يدوية | YES | YES | denied→manual | n/a | confirm | n/a | **PASS** | تم تأكيد الموقع — سيُحفظ مع إرسال النموذج / فرع يدوي بعد رفض الموقع |
| branches.html | موبايل | YES | YES | n/a | n/a | n/a | n/a | **PASS** | screenshot |

## ملاحظات
- بدون مفاتيح `GOOGLE_MAPS_*` الخريطة تُعرض معطّلة صراحة والكتابة اليدوية تعمل (لا ادعاء تكامل وهمي).
- بيانات الفروع القديمة (HubBranchesData / worldBranches) تبقى للتوافق الإداري ولا تُعرض كبطاقات اختيار للعميل.
- لم يُختبر هنا كل نموذج إداري/إعلانات على الإنتاج الحي؛ راجع الجرد في وصف PR للقائمة الكاملة.

**الحكم: النماذج الحرجة المختبرة نجحت؛ ليس إعلان FULL PASS لكل نموذج في المنصة.**
