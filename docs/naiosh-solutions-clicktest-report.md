# Click Test Report — حلول نايوش

## Root cause (production/main)
`origin/main` still contains `onclick="event.stopPropagation()"` on `.so-card-actions`, which blocks delegated clicks on #so-app. PR branch removes it.

## Summary
- Cards tested: 22
- Details clicks: 24
- Choose clicks: 23
- Quote clicks: 23
- PASS: 74 / FAIL: 0
- Request ID: SOL-REQ-2026-00001
- Quote ID: QT-2026-00001

| الحل | الزر | النتيجة المتوقعة | النتيجة الفعلية | PASS/FAIL |
|---|---|---|---|---|
| المرافق والصيانة | عرض التفاصيل (زائر) | فتح تفاصيل SOL-2026-00001 | view=detail id=SOL-2026-00001 | PASS |
| المرافق والصيانة | اختيار الحل (زائر) | يرجى تسجيل الدخول للمتابعة | يرجى تسجيل الدخول للمتابعة. | PASS |
| المرافق والصيانة | طلب عرض سعر (زائر) | يرجى تسجيل الدخول للمتابعة | يرجى تسجيل الدخول للمتابعة. | PASS |
| المرافق والصيانة | عرض التفاصيل | فتح تفاصيل SOL-2026-00001 | view=detail id=SOL-2026-00001 click=true | PASS |
| المرافق والصيانة | اختيار الحل | اختيار SOL-2026-00001 + ملخص | view=selected selected=SOL-2026-00001 | PASS |
| المرافق والصيانة | طلب عرض سعر | نموذج عرض سعر SOL-2026-00001 | view=wizard wiz=SOL-2026-00001 | PASS |
| الاستشارات | عرض التفاصيل | فتح تفاصيل SOL-2026-00002 | view=detail id=SOL-2026-00002 click=true | PASS |
| الاستشارات | اختيار الحل | اختيار SOL-2026-00002 + ملخص | view=selected selected=SOL-2026-00002 | PASS |
| الاستشارات | طلب عرض سعر | نموذج عرض سعر SOL-2026-00002 | view=wizard wiz=SOL-2026-00002 | PASS |
| الإعلام والحملات | عرض التفاصيل | فتح تفاصيل SOL-2026-00003 | view=detail id=SOL-2026-00003 click=true | PASS |
| الإعلام والحملات | اختيار الحل | اختيار SOL-2026-00003 + ملخص | view=selected selected=SOL-2026-00003 | PASS |
| الإعلام والحملات | طلب عرض سعر | نموذج عرض سعر SOL-2026-00003 | view=wizard wiz=SOL-2026-00003 | PASS |
| أغذية ومشروبات | عرض التفاصيل | فتح تفاصيل SOL-2026-00004 | view=detail id=SOL-2026-00004 click=true | PASS |
| أغذية ومشروبات | اختيار الحل | اختيار SOL-2026-00004 + ملخص | view=selected selected=SOL-2026-00004 | PASS |
| أغذية ومشروبات | طلب عرض سعر | نموذج عرض سعر SOL-2026-00004 | view=wizard wiz=SOL-2026-00004 | PASS |
| المقاولات | عرض التفاصيل | فتح تفاصيل SOL-2026-00005 | view=detail id=SOL-2026-00005 click=true | PASS |
| المقاولات | اختيار الحل | اختيار SOL-2026-00005 + ملخص | view=selected selected=SOL-2026-00005 | PASS |
| المقاولات | طلب عرض سعر | نموذج عرض سعر SOL-2026-00005 | view=wizard wiz=SOL-2026-00005 | PASS |
| تسويق وإعلان | عرض التفاصيل | فتح تفاصيل SOL-2026-00006 | view=detail id=SOL-2026-00006 click=true | PASS |
| تسويق وإعلان | اختيار الحل | اختيار SOL-2026-00006 + ملخص | view=selected selected=SOL-2026-00006 | PASS |
| تسويق وإعلان | طلب عرض سعر | نموذج عرض سعر SOL-2026-00006 | view=wizard wiz=SOL-2026-00006 | PASS |
| تجزئة وتجارة | عرض التفاصيل | فتح تفاصيل SOL-2026-00007 | view=detail id=SOL-2026-00007 click=true | PASS |
| تجزئة وتجارة | اختيار الحل | اختيار SOL-2026-00007 + ملخص | view=selected selected=SOL-2026-00007 | PASS |
| تجزئة وتجارة | طلب عرض سعر | نموذج عرض سعر SOL-2026-00007 | view=wizard wiz=SOL-2026-00007 | PASS |
| التصنيع | عرض التفاصيل | فتح تفاصيل SOL-2026-00008 | view=detail id=SOL-2026-00008 click=true | PASS |
| التصنيع | اختيار الحل | اختيار SOL-2026-00008 + ملخص | view=selected selected=SOL-2026-00008 | PASS |
| التصنيع | طلب عرض سعر | نموذج عرض سعر SOL-2026-00008 | view=wizard wiz=SOL-2026-00008 | PASS |
| التعليم | عرض التفاصيل | فتح تفاصيل SOL-2026-00009 | view=detail id=SOL-2026-00009 click=true | PASS |
| التعليم | اختيار الحل | اختيار SOL-2026-00009 + ملخص | view=selected selected=SOL-2026-00009 | PASS |
| التعليم | طلب عرض سعر | نموذج عرض سعر SOL-2026-00009 | view=wizard wiz=SOL-2026-00009 | PASS |
| SaaS والسحابة | عرض التفاصيل | فتح تفاصيل SOL-2026-00010 | view=detail id=SOL-2026-00010 click=true | PASS |
| SaaS والسحابة | اختيار الحل | اختيار SOL-2026-00010 + ملخص | view=selected selected=SOL-2026-00010 | PASS |
| SaaS والسحابة | طلب عرض سعر | نموذج عرض سعر SOL-2026-00010 | view=wizard wiz=SOL-2026-00010 | PASS |
| أسطول وشحن | عرض التفاصيل | فتح تفاصيل SOL-2026-00011 | view=detail id=SOL-2026-00011 click=true | PASS |
| أسطول وشحن | اختيار الحل | اختيار SOL-2026-00011 + ملخص | view=selected selected=SOL-2026-00011 | PASS |
| أسطول وشحن | طلب عرض سعر | نموذج عرض سعر SOL-2026-00011 | view=wizard wiz=SOL-2026-00011 | PASS |
| موظفون وتشغيل | عرض التفاصيل | فتح تفاصيل SOL-2026-00012 | view=detail id=SOL-2026-00012 click=true | PASS |
| موظفون وتشغيل | اختيار الحل | اختيار SOL-2026-00012 + ملخص | view=selected selected=SOL-2026-00012 | PASS |
| موظفون وتشغيل | طلب عرض سعر | نموذج عرض سعر SOL-2026-00012 | view=wizard wiz=SOL-2026-00012 | PASS |
| رعاية صحية | عرض التفاصيل | فتح تفاصيل SOL-2026-00013 | view=detail id=SOL-2026-00013 click=true | PASS |
| رعاية صحية | اختيار الحل | اختيار SOL-2026-00013 + ملخص | view=selected selected=SOL-2026-00013 | PASS |
| رعاية صحية | طلب عرض سعر | نموذج عرض سعر SOL-2026-00013 | view=wizard wiz=SOL-2026-00013 | PASS |
| سفر ورحلات | عرض التفاصيل | فتح تفاصيل SOL-2026-00014 | view=detail id=SOL-2026-00014 click=true | PASS |
| سفر ورحلات | اختيار الحل | اختيار SOL-2026-00014 + ملخص | view=selected selected=SOL-2026-00014 | PASS |
| سفر ورحلات | طلب عرض سعر | نموذج عرض سعر SOL-2026-00014 | view=wizard wiz=SOL-2026-00014 | PASS |
| الضيافة | عرض التفاصيل | فتح تفاصيل SOL-2026-00015 | view=detail id=SOL-2026-00015 click=true | PASS |
| الضيافة | اختيار الحل | اختيار SOL-2026-00015 + ملخص | view=selected selected=SOL-2026-00015 | PASS |
| الضيافة | طلب عرض سعر | نموذج عرض سعر SOL-2026-00015 | view=wizard wiz=SOL-2026-00015 | PASS |
| ميدان ووقود | عرض التفاصيل | فتح تفاصيل SOL-2026-00016 | view=detail id=SOL-2026-00016 click=true | PASS |
| ميدان ووقود | اختيار الحل | اختيار SOL-2026-00016 + ملخص | view=selected selected=SOL-2026-00016 | PASS |
| ميدان ووقود | طلب عرض سعر | نموذج عرض سعر SOL-2026-00016 | view=wizard wiz=SOL-2026-00016 | PASS |
| تطوير عقاري | عرض التفاصيل | فتح تفاصيل SOL-2026-00017 | view=detail id=SOL-2026-00017 click=true | PASS |
| تطوير عقاري | اختيار الحل | اختيار SOL-2026-00017 + ملخص | view=selected selected=SOL-2026-00017 | PASS |
| تطوير عقاري | طلب عرض سعر | نموذج عرض سعر SOL-2026-00017 | view=wizard wiz=SOL-2026-00017 | PASS |
| فعاليات | عرض التفاصيل | فتح تفاصيل SOL-2026-00018 | view=detail id=SOL-2026-00018 click=true | PASS |
| فعاليات | اختيار الحل | اختيار SOL-2026-00018 + ملخص | view=selected selected=SOL-2026-00018 | PASS |
| فعاليات | طلب عرض سعر | نموذج عرض سعر SOL-2026-00018 | view=wizard wiz=SOL-2026-00018 | PASS |
| حكومي | عرض التفاصيل | فتح تفاصيل SOL-2026-00019 | view=detail id=SOL-2026-00019 click=true | PASS |
| حكومي | اختيار الحل | اختيار SOL-2026-00019 + ملخص | view=selected selected=SOL-2026-00019 | PASS |
| حكومي | طلب عرض سعر | نموذج عرض سعر SOL-2026-00019 | view=wizard wiz=SOL-2026-00019 | PASS |
| غير ربحي | عرض التفاصيل | فتح تفاصيل SOL-2026-00020 | view=detail id=SOL-2026-00020 click=true | PASS |
| غير ربحي | اختيار الحل | اختيار SOL-2026-00020 + ملخص | view=selected selected=SOL-2026-00020 | PASS |
| غير ربحي | طلب عرض سعر | نموذج عرض سعر SOL-2026-00020 | view=wizard wiz=SOL-2026-00020 | PASS |
| استثمار | عرض التفاصيل | فتح تفاصيل SOL-2026-00021 | view=detail id=SOL-2026-00021 click=true | PASS |
| استثمار | اختيار الحل | اختيار SOL-2026-00021 + ملخص | view=selected selected=SOL-2026-00021 | PASS |
| استثمار | طلب عرض سعر | نموذج عرض سعر SOL-2026-00021 | view=wizard wiz=SOL-2026-00021 | PASS |
| خفض التكاليف | عرض التفاصيل | فتح تفاصيل SOL-2026-00022 | view=detail id=SOL-2026-00022 click=true | PASS |
| خفض التكاليف | اختيار الحل | اختيار SOL-2026-00022 + ملخص | view=selected selected=SOL-2026-00022 | PASS |
| خفض التكاليف | طلب عرض سعر | نموذج عرض سعر SOL-2026-00022 | view=wizard wiz=SOL-2026-00022 | PASS |
| الاستشارات | إرسال طلب عرض السعر | نجاح + SOL-REQ | success SOL-REQ-2026-00001 | PASS |
| Backend/Store | إنشاء Request | سجل في HubCustomerRequests | {"id":"SOL-REQ-2026-00001","solutionId":"SOL-2026-00002","solutionName":"حلول مالية للشركات الاستشارية","customerId":"NAI-CLIENT-001","sourceModule":"حلول نايوش","requestType":"Quote Request","status":"Pending Review"} | PASS |
| الإدارة | إعداد عرض السعر | QT مرتبط بالطلب | QT-2026-00001 | PASS |
| طلباتي | ظهور عرض السعر | نفس Request ID + السعر | ظاهر | PASS |
| المرافق والصيانة | عرض التفاصيل بعد Refresh | يعمل | view=detail | PASS |
