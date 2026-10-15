# جاهزية دمج إصلاح مودال موافقات المدير الأعلى (PR #240)

## نطاق الإصلاح
ملف واحد للسلوك الإنتاجي: `js/hub-higher-approvals-ui.js`.

| التغيير | التأثير على باقي لوحة التحكم |
|---|---|
| إزالة `onclick="event.stopPropagation()"` من `.ha-modal` | **محلي لواجهة HA فقط** — لا يوجد هذا النمط في نوافذ dashboard الأخرى |
| `data-action="ha-modal-noop"` | يُعالج فقط داخل `HubHigherApprovalsUI` / `HubRentAdminWS` (`ha-` prefix) |
| `ha-modal-noop` يعيد `false` | **لا يعيد رسم** لوحة التحكم — لا يمس النوافذ/الأزرار خارج صندوق الموافقات |
| قفل `busy` + تعطيل زر التأكيد | يمنع التنفيذ المزدوج من الواجهة |
| نجاح وهمي | لا يُعرض toast نجاح إلا إذا `res.ok === true` صراحةً |
| الخادم | `409` إذا تكرر القرار على طلب مغلق أصلًا |

## ما لم يتغيّر
- لا حذف/تعديل لطلبات Postgres الحالية.
- لا تغيير في `DECIDER_ROLES` أو مسارات API.
- لا إعادة بناء لنظام الموافقات.

## مطلوب من صاحب الصلاحية
1. مراجعة ودمج PR #240 إلى `main`.
2. نشر Railway / الإنتاج.
3. بعد النشر يجب أن يظهر في  
   `https://naiosh-hub-production.up.railway.app/js/hub-higher-approvals-ui.js`  
   النص `ha-modal-noop` وألا يظهر `stopPropagation` على `.ha-modal`.

## اختبار ما بعد النشر (بدون أي ترقيع DOM)
```bash
node scripts/e2e-higher-approvals-prod-ui-unpatched.js
```
لا يُعلن FULL PASS إلا إذا نجح هذا السكربت على الإنتاج المنشور.
