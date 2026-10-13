# تكامل Paymob لباقات نايوش هوب 360

تاريخ: 2026-10-13  
الفرع: `cursor/paymob-packages-checkout-ee32`

## 1) اختيار البوابة (مصر أولًا)

| البوابة | ملاءمة لحساب تجاري مصري | ملاحظات |
|---|---|---|
| **Paymob (المختارة للانطلاق)** | مناسبة غالبًا للشركات المسجّلة في مصر مع بطاقات/محافظ محلية | رسوم SME تقريبية ≈ 2.75% + 3 ج.م (تحقق من عقدك). تدعم لاحقًا UAE/KSA/OMAN حسب تفعيل التاجر |
| Tap Payments | بديل خليجي قوي + مصر | جيد للتوسع الخليجي لاحقًا |
| Moyasar | مركّز على السعودية (مدى) | بديل/مكمل عند تركيز KSA |
| Stripe | ليس الحل الأمثل وحده لمصر | مفيد إن كان الكيان في دولة يدعمها Stripe (مثل الإمارات) |

**الخلاصة:** Paymob مناسبة كبوابة انطلاق من مصر لحساب تاجر حقيقي. لا نعلن أن الدفع «متاح» في الإنتاج قبل وضع مفاتيح التاجر في Railway.

### هل Paymob مناسبة لحسابكم؟

- **نعم كمسار افتراضي** إذا كان الكيان التجاري مسجّلًا في مصر (أو لديه حساب Paymob Accept جاهز) وتريدون بطاقات/محافظ محلية وتحصيل EGP.
- **تحققوا تجاريًا** من: أهلية KYC، عملات التسوية (EGP/AED/SAR)، ونسبة الرسوم في عقدكم — الأرقام أعلاه تخطيطية فقط.
- **بدائل** إن لم تُقبلوا أو كانت الشروط غير مناسبة: Tap (خليج+مصر)، Moyasar (سعودية)، Stripe (كيان في دولة مدعومة).

## 2) المتغيرات (ضعوها في Railway — لا تُرسل في الشات)

### للنشر والاختبار على الإنتاج بمفاتيح Test فقط (بدون مال حقيقي)

```
PAYMOB_API_KEY=          # من لوحة Paymob → Test
PAYMOB_INTEGRATION_ID=
PAYMOB_IFRAME_ID=
PAYMOB_HMAC_SECRET=
HUB_PAYMOB_MODE=test
HUB_PAYMOB_CHARGE_CURRENCY=EGP
HUB_PAYMOB_SETTLEMENT_CURRENCIES=EGP,AED,SAR
APP_URL=https://your-production-host
# لا تضبط HUB_PAYMOB_LIVE إلا بعد موافقة صريحة على التحصيل الحقيقي
```

### Live (ممنوع قبل موافقة المالك)

```
HUB_PAYMOB_MODE=live
HUB_PAYMOB_LIVE=1
# + مفاتيح Live من Paymob
```

### Stub محلي فقط (ممنوع على الإنتاج / Railway production)

```
HUB_PAYMOB_STUB=1
PAYMOB_API_KEY=test_stub_...
...
```

دليل فتح حساب التاجر والمستندات: `docs/paymob-merchant-onboarding-ar.md`

Webhook الإنتاج:

`POST {APP_URL}/api/hub/packages/paymob/webhook?hmac=...`

## 3) مسار التشغيل

1. العميل يختار باقة مدفوعة → `POST /api/hub/packages/checkout` method=`paymob`
2. الخادم ينشئ طلبًا + جلسة Paymob (auth→order→payment_key→iframe) أو stub محلي
3. **لا تُضاف نقاط من صفحة العودة**
4. إشعار Paymob الموقّع HMAC → `fulfillOrder` مرة واحدة (idempotent)
5. فشل الدفع → `payment_failed` بدون رصيد
6. تكرار الإشعار → لا مضاعفة نقاط
7. الاسترداد → خصم النقاط + (اختياري) استدعاء Paymob refund

## 4) الأسعار المعتمدة (لا تُغيَّر من المتصفح)

- مجاني: **300** نقطة مرة واحدة
- مدفوع: **6,000** نقطة = **15 USD**
- مدفوع: **16,000** نقطة = **35 USD**

عرض العملة محليًا للعرض فقط؛ التحصيل عبر Paymob عادة **EGP** (أو عملة تسوية مفعّلة).

## 5) الاختبار

```bash
node scripts/e2e-paymob-packages-sandbox.js
```

يثبت محليًا: نجاح → credit → شراء خدمة → debit → إدارة؛ رفض؛ HMAC باطل؛ إعادة إشعار؛ عدم credit قبل webhook.

**لا FULL PASS إنتاجي** قبل مفاتيح تاجر حقيقية + اختبار Test mode على Paymob ثم Live.
