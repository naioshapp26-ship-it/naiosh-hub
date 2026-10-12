# تفعيل خرائط Google لفروع نايوش هوب

بدون المفاتيح التالية تبقى **الكتابة اليدوية لاسم الفرع تعمل**، وتظهر رسالة أن الخريطة غير مفعّلة. لا يُعلن أن الخريطة شغّالة حتى تُضبط المفاتيح.

## المطلوب من حسابك (Google Cloud)

1. افتح [Google Cloud Console](https://console.cloud.google.com/) وأنشئ مشروعًا (أو استخدم مشروعًا موجودًا).
2. فعّل الـ APIs:
   - **Maps JavaScript API**
   - **Geocoding API**
3. أنشئ مفتاحين منفصليْن (موصى به):

### أ) مفتاح المتصفح `GOOGLE_MAPS_BROWSER_KEY`
- Application restrictions: **HTTP referrers**
- أضف مثلًا:
  - `https://www.naioshai.com/*`
  - `https://naiosh-hub-production.up.railway.app/*`
  - `http://localhost:*/*` (للتطوير فقط إن لزم)
- API restrictions: قيّده بـ Maps JavaScript API (+ Places إن رغبت)

### ب) مفتاح الخادم `GOOGLE_MAPS_SERVER_KEY`
- Application restrictions: **IP addresses** (عناوين خروج Railway إن أمكن) أو بدون IP مع تقييد API فقط
- API restrictions: **Geocoding API فقط**
- هذا المفتاح **لا يُرسل للمتصفح** — يُستخدم فقط عبر `/api/hub/geo/reverse` و `/api/hub/geo/geocode`

## أين تضعها

على خدمة Railway `naiosh-hub` → Variables:

```
GOOGLE_MAPS_BROWSER_KEY=...
GOOGLE_MAPS_SERVER_KEY=...
```

ثم أعد نشر الخدمة.

## التحقق

```
GET /api/hub/geo/config
```

المتوقع عند التفعيل:

```json
{
  "mapsEnabled": true,
  "browserMapsEnabled": true,
  "geocodeEnabled": true
}
```

`browserKey` قد يظهر في الاستجابة لأنه مفتاح متصفح مقيّد بالـ referrer (هذا طبيعي). مفتاح الخادم لا يظهر أبدًا.
