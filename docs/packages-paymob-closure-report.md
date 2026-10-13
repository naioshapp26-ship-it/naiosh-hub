# تقرير إغلاق الجانب البرمجي — باقات / Paymob

تاريخ: 2026-10-13  
PR: https://github.com/naioshapp26-ship-it/naiosh-hub/pull/235  
**لا FULL PASS.**

## جاهز للنشر (برمجيًا)

| البند | الحالة |
|---|---|
| كتالوج الباقات 300 / 6000@$15 / 16000@$35 | جاهز |
| FX + عرض كل العملات + مبلغ التحصيل EGP قبل الدفع | جاهز |
| محفظة قديمة `{paid,free,total,ledger}` | لم تُكسر |
| حجوزات / bookings | لم تُمس |
| صلاحيات الإدارة (`requireStaff` + `wallet.adjust`) | جاهزة |
| إيصال + سجل نقاط (`packages-receipts.html` / محفظة العميل) | جاهز |
| حفظ طلبات الباقات في Postgres `hub_package_orders` + استعادة بعد إعادة التشغيل | جاهز |
| الدفع مغلق بدون مفاتيح تاجر | جاهز (متعمد) |
| Live مقفول بدون `HUB_PAYMOB_LIVE=1` | جاهز |

## يحتاج حساب Paymob منك (خارج الكود)

1. فتح حساب تاجر + KYC  
2. مفاتيح **Test** في Railway (الأسماء في `docs/paymob-env-vars-checklist.md`)  
3. Webhook إلى `/api/hub/packages/paymob/webhook`  
4. اختبار Test على الموقع المنشور  
5. موافقتك الصريحة قبل Live  

## اختبارات محلية مثبتة

- `scripts/e2e-packages-postgres-durability.js` — استمرار Postgres + الدفع غير متاح بدون مفاتيح  
- `scripts/e2e-paymob-packages-sandbox.js` — فشل / تكرار / استرداد جزئي (Stub محلي فقط)  
- `scripts/e2e-subscription-packages.js` — بدون بوابات  

## ما لن يُعلن

لا FULL PASS حتى تكتمل رحلة Test مصرّح بها على الإنتاج بمفاتيح التاجر، ثم موافقة Live منفصلة.
