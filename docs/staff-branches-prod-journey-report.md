# رحلة موظف الإنتاج — فروع / حجوزات

BASE: https://naiosh-hub-production.up.railway.app
موظف الاختبار: e2e-branches@naiosh.test
PASS: 16 · FAIL: 0

| المنطقة | الفحص | النتيجة | دليل |
|---|---|---|---|
| diagnosis | سبب فشل دخول Super Admin بمتغير البيئة | **PASS** | {"status":401,"message":"بيانات الدخول غير صحيحة.","note":"الحساب موجود والهاش في Postgres لا يطابق HUB_SUPER_ADMIN_INITIAL_PASSWORD (كلمة المرور تغيّرت بعد التهيئة). لم نُعد ضبطها."} |
| auth | دخول موظف اختبار محدود | **PASS** | {"status":200,"email":"e2e-branches@naiosh.test","role":"admin","employeeNo":"EMP-E2E-BR","message":"تم تسجيل الدخول بنجاح"} |
| bookings | إنشاء حجز تجريبي بفرع+إحداثيات | **PASS** | {"status":201,"id":"pb-mv5qjl4a-pzd05","branch":"فرع رحلة مسؤول — mv5qjl31","lat":31.9539} |
| bookings | إعادة فتح الحجز كمسؤول (API) | **PASS** | {"status":200,"branch":"فرع رحلة مسؤول — mv5qjl31","country":"الأردن","city":"عمّان","lat":31.9539,"lng":35.9106} |
| bookings | قائمة الحجوزات للمسؤول (بيانات سابقة لا تُمسح) | **PASS** | {"status":200,"count":1,"sampleId":"pb-mv5qjl4a-pzd05"} |
| dashboard | لوحة التحكم تفتح بجلسة الموظف | **PASS** | {"title":"غرفة العمليات — نايوش هوب","bodyClass":"","hasCatalogBranchSelect":false,"geoHosts":0} |
| branches.html | لا كتالوج فروع إجبارية + حقل حر أو geo | **PASS** | {"branchSelects":0,"countrySelects":0,"geo":1,"freeBranchInputs":1,"leaflet":true} |
| operating.html | لا كتالوج فروع إجبارية + حقل حر أو geo | **PASS** | {"branchSelects":0,"countrySelects":0,"geo":0,"freeBranchInputs":0,"leaflet":false} |
| system-ops.html | لا كتالوج فروع إجبارية + حقل حر أو geo | **PASS** | {"branchSelects":0,"countrySelects":0,"geo":0,"freeBranchInputs":0,"leaflet":false} |
| dashboard | فتح وحدات مرتبطة بالفروع | **PASS** | {"clicked":["المهام","العملاء","الفروع"]} |
| admin-forms | لا select كتالوج فرع ظاهر في اللوحة بعد الفتح | **PASS** | {"branchSelects":[],"free":1,"geo":0,"modals":2} |
| code | هوية: فلتر فرع حر | **PASS** | js/hub-identity-ui.js |
| code | row-actions يتضمن HubGeoBranch للفروع | **PASS** | js/hub-row-actions.js |
| code | مهام: فرع نص حر | **PASS** | js/hub-ops-workspaces.js |
| code | خريطة Leaflet في الأصل المنشور | **PASS** | js/hub-geo-branch.js |
| dashboard | موبايل: اللوحة تفتح | **PASS** | screenshot |

اجتازت فحوصات هذه الجولة لموظف الاختبار. FULL PASS فقط إذا شملت كل نماذج الإدارة التفاعلية المطلوبة.
