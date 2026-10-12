# اختبار تفاعلي — هوية وإعلانات (فرع حر)

PASS: 11 · FAIL: 0

| السطح | الفحص | النتيجة | دليل |
|---|---|---|---|
| auth | دخول موظف | **PASS** | naioshhub@example.com |
| هوية نايوش | وحدة الهوية محمّلة | **PASS** | HubIdentityUI |
| هوية نايوش | حقل الفرع نص حر وليس select | **PASS** | {"wizard":{"step":3,"hasBranch":true,"tag":"INPUT","type":"text","cascade":"","deptTag":"INPUT","modal":true,"error":""},"branchMeta":{"step":3,"hasBranch":true,"tag":"INPUT","type":"text","cascade":"","deptTag":"INPUT","modal":true}} |
| هوية نايوش | اسم الفرع الحر يبقى بعد التنقّل (لا يُمسح) | **PASS** | {"ok":true,"val":"فرعي الحر — الزرقاء mv5nw4u5"} |
| هوية نايوش | فلتر الفرع كتابة حرة | **PASS** | {"exists":true,"tag":"INPUT","isSelect":false,"ph":"تصفية باسم الفرع (كتابة حرة)"} |
| الإعلانات | استهداف فرع معين بدون select كتالوج | **PASS** | {"branchBtn":true,"detail":true,"catalogSelect":false,"wizard":true,"stepText":"3. الجمهور"} |
| الإعلانات | تفاصيل استهداف الفرع كتابة حرة | **PASS** | فرعي في عمّان — كتابة حرة |
| الإعلانات | مسار الإضافة يوجّه لمعالج الاستوديو (بدون كتالوج فروع) | **PASS** | {"adsRedirect":true,"adsTargetsFree":true,"audienceFree":true} |
| هوية نايوش | لوحة الهوية تفتح على الموبايل | **PASS** | screenshot |
| هوية نايوش | الوضع الليلي | **PASS** | screenshot |
| كود | لا مسح فرع حر + أهداف إعلان نصية | **PASS** | {"noWipe":true,"adsText":true} |

**لا FULL PASS للمنصة** قبل تفعيل خرائط Google على الإنتاج واختبار الحفظ/إعادة الفتح هناك.
