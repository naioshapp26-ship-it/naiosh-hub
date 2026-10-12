# تقرير مراجعة كاملة — الفروع والموقع

صفوف المراجعة: 25 · PASS: 25 · FAIL: 0

| الصفحة | النموذج | أُزيل الكتالوج؟ | كتابة | تلقائي | خريطة | حفظ | إعادة فتح | كمبيوتر | موبايل | ثيم | النتيجة | ملاحظة |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| API | geo/config | n/a | n/a | NO | DISABLED | n/a | n/a | n/a | n/a | n/a | **PASS** | خدمات Google Maps غير مفعّلة — يمكن كتابة اسم الفرع يدويًا دون خريطة. |
| API | platform-bookings حفظ+إعادة فتح | YES | YES | n/a | n/a | YES | YES | n/a | n/a | n/a | **PASS** | {"status":201,"id":"pb-mv5mx6bs-mpnbe","reopenOk":true} |
| branches.html | تحديد الموقع العام | YES | YES | deny→manual | DISABLED | UI | n/a | YES | n/a | light | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"cards":0,"forms":0,"fields":26,"submit":false,"hasName":true,"mapFallb |
| branches.html | تحديد الموقع العام | YES | YES | deny→manual | DISABLED | UI | n/a | n/a | YES | light | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"cards":0,"forms":0,"fields":26,"submit":false,"hasName":true,"mapFallb |
| branches.html | تحديد الموقع العام | YES | YES | deny→manual | DISABLED | UI | n/a | YES | n/a | dark | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"cards":0,"forms":0,"fields":26,"submit":false,"hasName":true,"mapFallb |
| book-incubator.html | حجز حاضنة | YES | YES | deny→manual | DISABLED | UI | n/a | YES | n/a | light | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"cards":0,"forms":1,"fields":35,"submit":true,"hasName":true,"mapFallba |
| book-incubator.html | حجز حاضنة | YES | YES | deny→manual | DISABLED | UI | n/a | n/a | YES | light | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"cards":0,"forms":1,"fields":35,"submit":true,"hasName":true,"mapFallba |
| book-incubator.html | حجز حاضنة | YES | YES | deny→manual | DISABLED | UI | n/a | YES | n/a | dark | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"cards":0,"forms":1,"fields":35,"submit":true,"hasName":true,"mapFallba |
| book-platform.html | حجز منصة | YES | YES | deny→manual | DISABLED | UI | n/a | YES | n/a | light | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"cards":0,"forms":1,"fields":41,"submit":true,"hasName":true,"mapFallba |
| book-platform.html | حجز منصة | YES | YES | deny→manual | DISABLED | UI | n/a | n/a | YES | light | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"cards":0,"forms":1,"fields":41,"submit":true,"hasName":true,"mapFallba |
| book-platform.html | حجز منصة | YES | YES | deny→manual | DISABLED | UI | n/a | YES | n/a | dark | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"cards":0,"forms":1,"fields":41,"submit":true,"hasName":true,"mapFallba |
| book-office.html | حجز مكتب | YES | YES | deny→manual | DISABLED | UI | n/a | YES | n/a | light | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"cards":0,"forms":1,"fields":36,"submit":true,"hasName":true,"mapFallba |
| book-office.html | حجز مكتب | YES | YES | deny→manual | DISABLED | UI | n/a | n/a | YES | light | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"cards":0,"forms":1,"fields":36,"submit":true,"hasName":true,"mapFallba |
| book-office.html | حجز مكتب | YES | YES | deny→manual | DISABLED | UI | n/a | YES | n/a | dark | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"cards":0,"forms":1,"fields":36,"submit":true,"hasName":true,"mapFallba |
| register.html | سجل معنا | YES | YES | deny→manual | DISABLED | UI | n/a | YES | n/a | light | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"cards":0,"forms":1,"fields":34,"submit":true,"hasName":true,"mapFallba |
| register.html | سجل معنا | YES | YES | deny→manual | DISABLED | UI | n/a | n/a | YES | light | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"cards":0,"forms":1,"fields":34,"submit":true,"hasName":true,"mapFallba |
| register.html | سجل معنا | YES | YES | deny→manual | DISABLED | UI | n/a | YES | n/a | dark | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"cards":0,"forms":1,"fields":34,"submit":true,"hasName":true,"mapFallba |
| my-branch.html | فرعي (عرض منح المستخدم) | YES | YES | n/a | DISABLED | UI | n/a | YES | n/a | light | **PASS** | {"geo":false,"branchSel":false,"countrySel":false,"cards":0,"forms":0,"fields":10,"submit":false,"hasName":false,"mapFal |
| my-branch.html | فرعي (عرض منح المستخدم) | YES | YES | n/a | DISABLED | UI | n/a | n/a | YES | light | **PASS** | {"geo":false,"branchSel":false,"countrySel":false,"cards":0,"forms":0,"fields":10,"submit":false,"hasName":false,"mapFal |
| my-branch.html | فرعي (عرض منح المستخدم) | YES | YES | n/a | DISABLED | UI | n/a | YES | n/a | dark | **PASS** | {"geo":false,"branchSel":false,"countrySel":false,"cards":0,"forms":0,"fields":10,"submit":false,"hasName":false,"mapFal |
| js/hub-identity-ui.js | سجل الهوية — فرع | YES | YES | n/a | n/a | n/a | n/a | code | code | n/a | **PASS** | {"identityFree":true,"identityFilterInput":true,"adsFree":true,"adsNoGroup":true,"editCountryText":true,"noBranchInject" |
| js/hub-row-actions.js | أهداف إعلان + تعديل فرع | YES | YES | n/a | n/a | n/a | n/a | code | code | n/a | **PASS** | {"adsFree":true,"adsNoGroup":true,"editCountryText":true} |
| js/hub-access-governance-engine.js | إيقاف حقن كتالوج الفروع في الهيكل | YES | n/a | n/a | n/a | n/a | n/a | code | code | n/a | **PASS** | no HubBranchesData slice inject |
| js/hub-ops-workspaces.js + solutions | مهام / حلول — فرع نص | YES | YES | n/a | n/a | n/a | n/a | code | code | n/a | **PASS** | {"tasksFree":true,"solutionsFree":true} |
| side-projects.html | تسجيل مشروع جانبي — دولة قانونية | n/a (دولة لا فرع) | select دولة | n/a | n/a | n/a | n/a | reviewed | reviewed | n/a | **PASS** | حقل دولة تشغيلية/قانونية — لم يُستبدل لأنه ليس اختيار فرع كتالوج |

## إيه شغال
- صفحات العميل الحرجة: فروع · حجز حاضنة/منصة/مكتب · تسجيل — بدون select فرع وبدون بطاقات دول، والنماذج كاملة الحقول.
- حفظ API لفرع حر + إحداثيات + إعادة قراءة من `platform-bookings.json`.
- رفض إذن الموقع → إكمال يدوي.
- هوية/إعلانات/تعديل فرع/مهام: تحويل لكتابة حرة في الكود.

## إيه ناقص
- **خرائط Google غير مفعّلة** في هذه البيئة (لا مفاتيح). الكتابة اليدوية تعمل؛ الخريطة تعرض «غير مفعّلة».
- اختبار متصفح كامل لنوافذ الهوية/الإعلانات داخل dashboard (مراجعة كود + منطق؛ يحتاج جلسة موظف على الواجهة للتأكيد البصري النهائي).

## إيه محتاج منك
- ضع GOOGLE_MAPS_BROWSER_KEY + GOOGLE_MAPS_SERVER_KEY على Railway — انظر docs/google-maps-setup.md
- التفاصيل: `docs/google-maps-setup.md`

**لا FULL PASS** — الخريطة ليست شغّالة فعليًا حتى تُضبط المفاتيح.
