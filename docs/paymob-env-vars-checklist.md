# قائمة متغيرات Paymob — يجب أن تطابق الكود حرفيًا

لا تضع القيم السرية في الشات أو Git. ضعها في Railway Variables فقط.

## إلزامية لتشغيل Test (بدون مال حقيقي)

| المتغير | مطلوب؟ | ملاحظات |
|---|---|---|
| `PAYMOB_API_KEY` | نعم | مفتاح **Test** من لوحة Paymob |
| `PAYMOB_INTEGRATION_ID` | نعم | رقم التكامل |
| `PAYMOB_IFRAME_ID` | نعم للواجهة الحية | مطلوب لمسار iframe الحقيقي (ليس Stub) |
| `PAYMOB_HMAC_SECRET` | نعم | سر توقيع الـ webhook |
| `APP_URL` | نعم | رابط الموقع المنشور (لروابط العودة) |
| `HUB_PAYMOB_MODE` | مستحسن | `test` (افتراضي منطقيًا إن لم يُضبط Live) |

## اختيارية / تحكم

| المتغير | افتراضي | متى تستخدمه |
|---|---|---|
| `HUB_PAYMOB_CHARGE_CURRENCY` | `EGP` | عملة التحصيل الأساسية |
| `HUB_PAYMOB_SETTLEMENT_CURRENCIES` | `EGP,AED,SAR` | عملات مقبولة للتحصيل |
| `PAYMOB_API_HOST` | `accept.paymob.com` | لا تغيّره إلا بتعليمات Paymob |
| `HUB_PAYMOB_STUB` | off | محلي فقط — **ممنوع** على الإنتاج |
| `HUB_PAYMOB_LIVE` | off | `1` فقط بعد موافقتك على التحصيل الحقيقي |
| `HUB_PAYMOB_MODE=live` | — | مع `HUB_PAYMOB_LIVE=1` فقط |

## Webhook

`POST {APP_URL}/api/hub/packages/paymob/webhook`

## بدون هذه المفاتيح

`payment.available === false` → العملاء يرون «الدفع غير متاح» ويمكنهم فقط طلب مراجعة إدارية (بدون نقاط مدفوعة).
