# نماذج الإدارة — فروع على الإنتاج

PASS: 9 · FAIL: 0

| المنطقة | الفحص | النتيجة | دليل |
|---|---|---|---|
| auth | دخول موظف الاختبار | **PASS** | {"status":200,"email":"e2e-branches@naiosh.test"} |
| bookings | حجوزات ببيانات geo ظاهرة للمسؤول | **PASS** | {"count":1,"withGeo":1,"sample":[{"id":"pb-mv5qjl4a-pzd05","branch":"فرع رحلة مسؤول — mv5qjl31","country":"الأردن","city":"عمّان","lat":31.9539}]} |
| tasks | حقل فرع نص حر بدون select | **PASS** | {"hasFreeBranch":true,"hasSelect":false,"value":"فرع مهام حر — الزرقاء","tag":"INPUT"} |
| tasks | حفظ مهمة مع فرع حر وإعادة ظهورها | **PASS** | {"hasTitle":true,"submitted":true,"titleOnPage":true,"branchOnPage":true,"feedback":"تم حفظ المهمة."} |
| branches-admin | إضافة/تحديد فرع حر + خريطة على صفحة الفروع | **PASS** | {"geo":true,"select":false,"leaflet":true,"branchVal":"فرع إدارة حر — إربد","country":""} |
| branches-erp | إضافة فرع حر بدون كتالوج + حفظ | **PASS** | {"modal":true,"geo":true,"freeName":true,"select":false,"nameVal":"فرع ERP حر — العقبة mv5qn7v6","countryVal":"الأردن","savedVisible":true,"toast":""} |
| clients | لا قائمة فروع جاهزة في واجهة العملاء | **PASS** | {"selects":0,"free":0,"text":false} |
| identity | فلتر/حقل فرع حر في الهوية/الموظفين | **PASS** | {"filterTag":null,"filterType":null,"filterPh":"","selects":0} |
| theme | الوضع الليلي يفتح بعد الجلسة | **PASS** | screenshot |
