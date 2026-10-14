# تقرير استبدال الشعار الرسمي — NAIOSH HUB 360

تاريخ: 2026-10-14  
دمج: `main` · `6a629fc`  
الأصل المركزي: `assets/brand/naiosh-hub-360-official.jpg` (بايتات الصورة المرفقة حرفيًا)  
مسار التوافق: `assets/logo-hub.jpeg` / `assets/logo-hub.jpg`  
إصدار الكاش: `?v=official1` · Service Worker: `hub-shell-v6-official1`  
ثابت المسارات: `js/hub-brand.js`

## ما تمت مراجعته

| الفئة | العدد |
|---|---|
| صفحات HTML (جذر + `systems/`) | **100** |
| صفحات حُدّثت بهوية عامة / كاش شعار | **~98** (+ redirects بلا واجهة) |
| ملفات في الـ commit | **124** |
| عيّنة إنتاج مباشرة بعد النشر | **16/16 PASS** |

## أين استُبدل الشعار

- Header / Footer / Login / Register / Forgot password / Client / Packages / Store / Services / Branches / Profile 360 / Studios / Systems / Checklist …
- Favicon + Apple touch + PWA (`manifest.json` + `hub-icon-192/512`)
- Defaults في `js/hub-settings-center.js` و`lib/hub-client-portal.js` ووحدات مشتركة
- أيقونة الشريط الجانبي للإدارة (`dashboard.html` → `hub-icon-192` مشتق من الدرع)

## استثناءات

| العنصر | السبب |
|---|---|
| `assets/logo-naiosh-ai.jpg` | شعار متخصص «نظام تحليل البيانات» — محفوظ ومتحقق على الإنتاج |
| `info-center.html` / `events-studio-main.html` | تحويل فوري بلا واجهة شعار |
| لوحة الإدارة بعد تسجيل الدخول | **NOT TESTED** على الإنتاج (توجيه إلى login) — مسار الدخول والأيقونة الجديدة مؤكدان |

## نتائج اختبار الإنتاج

| # | الاختبار | النتيجة |
|---|---|---|
| 1 | الشعار الجديد في الصفحات العامة (عيّنة 16 صفحة) | **PASS** |
| 2 | لا مسار قديم بدون `?v=official1` في العيّنة | **PASS** |
| 3 | أصل الشعار 155089 بايت · md5 مطابق للمرفق | **PASS** |
| 4 | كمبيوتر / موبايل (الرئيسية) | **PASS** |
| 5 | فاتح / داكن (الرئيسية) | **PASS** |
| 6 | عدم تغيير توزيع الصفحات (تعديل حجم الشعار فقط) | **PASS** |
| 7 | روابط الشعار → الرئيسية | **PASS** |
| 8 | كاش `official1` + SW v6 | **PASS** |
| — | لوحة الإدارة وهي مفتوحة بجلسة موظف | **NOT TESTED** |

شعار تحليل البيانات المتخصص ما زال ظاهرًا ومنفصلًا عن الهوية العامة.

## لقطات

- `/opt/cursor/artifacts/screenshots/logo-home-desktop-light.png`
- `/opt/cursor/artifacts/screenshots/logo-home-desktop-dark.png`
- `/opt/cursor/artifacts/screenshots/logo-home-mobile-light.png`
- `/opt/cursor/artifacts/screenshots/logo-login-desktop.png`
- `/opt/cursor/artifacts/screenshots/logo-client-desktop.png`
- `/opt/cursor/artifacts/screenshots/logo-packages-desktop.png`

**لا FULL PASS مطلق لكل صفحة جلسة موظفين** — التحقق الشامل للملفات تم محليًا؛ الإنتاج عُيّن على الصفحات العامة + العميل + الدخول. لوحة الإدارة داخل الجلسة تحتاج اختبارًا بعد تسجيل دخول موظف.
