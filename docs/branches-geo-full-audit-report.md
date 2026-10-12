# تقرير مراجعة كاملة — الفروع والموقع

صفوف المراجعة: 26 · PASS: 26 · FAIL: 0

| الصفحة | النموذج | أُزيل الكتالوج؟ | كتابة | تلقائي | خريطة | حفظ | إعادة فتح | كمبيوتر | موبايل | ثيم | النتيجة | ملاحظة |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| API | geo/config | n/a | n/a | NO | DISABLED | n/a | n/a | n/a | n/a | n/a | **PASS** | خدمات Google Maps غير مفعّلة — يمكن كتابة اسم الفرع يدويًا دون خريطة. |
| API | platform-bookings حفظ+إعادة فتح | YES | YES | n/a | n/a | YES | YES | n/a | n/a | n/a | **PASS** | {"status":201,"id":"pb-mv5n3zrj-ayneu","reopenOk":true} |
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
| js/hub-identity-ui.js | سجل الهوية — فرع | YES | YES | n/a | n/a | n/a | n/a | code | code | n/a | **PASS** | {"identityFree":true,"identityFilterInput":true,"identityNoWipe":true,"identityDeptFree":true} |
| js/hub-row-actions.js | أهداف إعلان + إضافة/تعديل فرع | YES | YES | n/a | n/a | n/a | n/a | code | code | n/a | **PASS** | {"adsFree":true,"adsNoGroup":true,"editCountryText":true,"addBranchGeo":true} |
| js/hub-booking.js + hub-register.js | إزالة unlockBranch كتالوج | YES | YES | n/a | n/a | n/a | n/a | code | code | n/a | **PASS** | {"bookingNoCatalogUnlock":true,"registerNoCatalogUnlock":true} |
| js/hub-access-governance-engine.js | إيقاف حقن كتالوج الفروع في الهيكل | YES | n/a | n/a | n/a | n/a | n/a | code | code | n/a | **PASS** | no HubBranchesData slice inject |
| js/hub-ops-workspaces.js + solutions | مهام / حلول — فرع نص | YES | YES | n/a | n/a | n/a | n/a | code | code | n/a | **PASS** | {"tasksFree":true,"tasksPrefill":true,"solutionsFree":true} |
| side-projects.html | تسجيل مشروع جانبي — دولة قانونية | n/a (دولة لا فرع) | select دولة | n/a | n/a | n/a | n/a | reviewed | reviewed | n/a | **PASS** | حقل دولة تشغيلية/قانونية — لم يُستبدل لأنه ليس اختيار فرع كتالوج |

## إيه شغال
- صفحات العميل الحرجة: فروع · حجز حاضنة/منصة/مكتب · تسجيل — بدون select فرع وبدون بطاقات دول، والنماذج كاملة الحقول (لم تُمسح).
- حفظ API لفرع حر + إحداثيات + إعادة قراءة من `platform-bookings.json`.
- رفض إذن الموقع → إكمال يدوي.
- هوية: كتابة حرة بدون مسح القيمة ضد الكتالوج؛ قسم نص حر.
- إعلانات/إضافة فرع/تعديل فرع/مهام/حلول: فرع نص حر + geo اختياري للإضافة/التعديل.
- حذف `unlockBranch` من booking/register حتى لا تُعاد قوائم الكتالوج.

## إيه ناقص
- **خرائط Google غير مفعّلة** (لا مفاتيح في البيئة). الكتابة اليدوية تعمل؛ الخريطة تعرض صراحة «غير مفعّلة» — **لا يُعلن أنها شغّالة**.
- اختبار متصفح تفاعلي كامل لنوافذ الهوية/الإعلانات داخل dashboard (مراجعة كود PASS؛ التأكيد البصري يحتاج جلسة موظف).

## إيه محتاج منك
1. في Google Cloud: فعّل Maps JavaScript API + Geocoding API.
2. أنشئ مفتاح متصفح (HTTP referrers) → `GOOGLE_MAPS_BROWSER_KEY`.
3. أنشئ مفتاح خادم (Geocoding فقط) → `GOOGLE_MAPS_SERVER_KEY`.
4. ضعهما على Railway Variables وأعد النشر.
5. تحقق: `GET /api/hub/geo/config` → `mapsEnabled: true`.

التفاصيل: `docs/google-maps-setup.md`

**لا FULL PASS** — الخريطة ليست شغّالة فعليًا حتى تُضبط المفاتيح وتُراجع النوافذ الإدارية بصريًا.
