# PR #235 — جاهز لمراجعة ودمج صاحب الصلاحية

PR: https://github.com/naioshapp26-ship-it/naiosh-hub/pull/235  
الفرع: `cursor/paymob-packages-checkout-ee32`  
الحالة: **Ready for review · MERGEABLE · ليس Draft**  
**لا تفعيل Paymob Live · لا FULL PASS للدفع.**

## 1) إصلاح `persistPackageOrderPg is not defined`

في الفرع يوجد alias صريح:

```js
async function persistPackageOrderPg(order) {
  return persistPackageOrderRow(order);
}
```

على `main` الحالي تُستدعى `persistPackageOrderPg` بدون تعريف → HTTP 500 عند `claim-free` / `manual_review`.  
بعد الدمج: المنح يعيد **200** ويحفظ صف الطلب في Postgres.

## 2) إثبات منح 300 من أول محاولة (محلي)

| السكربت | نتيجة `claim-free` الأولى | منع التكرار |
|---|---|---|
| `e2e-subscription-packages.js` | **PASS** `status=200` · `free=300` · `ref=PKG-…` | **PASS** `409` |
| `e2e-packages-postgres-durability.js` | **PASS** `status=200` + صف Postgres `credited=true` | **PASS** `409` |
| `e2e-paymob-packages-sandbox.js` | **PASS** `status=200` · `free=300` | **PASS** `409` |

الاختبارات تشترط الآن صراحةً `status === 200` و`ok === true` ووجود `order.ref` — لن تمر إذا عاد 500 مع رصيد.

## 3) سلامة الدمج على البيانات الحالية

| المجال | الحكم |
|---|---|
| أرصدة العملاء `{paid,free,total,ledger}` | **لا كسر** — إضافات اختيارية فقط؛ المنح مجاني مرة واحدة للحسابات الجديدة/غير المطالبة |
| الحجوزات / bookings | **لم تُمس** في هذا الـ PR |
| بيانات المستخدمين / العملاء | `readStore` يحفظ `packageOrders` بدل إسقاطها (إصلاح فقدان) — لا حذف ولا إعادة ضبط أرصدة |
| جداول Postgres | `UPSERT` على `hub_package_orders` + hydrate عند الإقلاع — بلا `DELETE`/`TRUNCATE` لأرصدة أو حجوزات |
| الدفع الإلكتروني | يبقى **غير متاح** بدون مفاتيح تاجر؛ Live مقفول بدون `HUB_PAYMOB_LIVE=1` |

## 4) ما يفعله صاحب الصلاحية

1. مراجعة ودمج PR #235 إلى `main`
2. انتظار Redeploy على Railway
3. **بدون** وضع مفاتيح Paymob Live
4. بعد النشر: إعادة اختبار المنح/409/Postgres/الإيصالات/الإدارة (ينفّذها الوكيل بعد إشعار الدمج)

## 5) ما لن يُعلن بعد الدمج

- لا **FULL PASS** للدفع الإلكتروني قبل تفعيل بوابة Test واختبارها لاحقًا بموافقة صريحة.
