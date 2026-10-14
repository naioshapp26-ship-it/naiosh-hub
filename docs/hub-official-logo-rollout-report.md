# تقرير استبدال الشعار الرسمي — NAIOSH HUB 360

تاريخ: 2026-10-14  
الفرع: `cursor/hub-official-logo-ee32`  
الأصل المركزي: `assets/brand/naiosh-hub-360-official.jpg`  
مسار التوافق: `assets/logo-hub.jpeg` / `assets/logo-hub.jpg` (نفس البايتات)  
إصدار الكاش: `?v=official1` · Service Worker: `hub-shell-v6-official1`

## ما تمت مراجعته

| الفئة | العدد |
|---|---|
| صفحات HTML في الجذر + `systems/` | 100 |
| صفحات تحتوي هوية عامة (شعار/أيقونة) بعد التحديث | ~98 |
| ملفات محدّثة بمسارات كاش الشعار | 103+ |
| وحدات مشتركة (JS/lib/manifest/sw) | 8+ |

## أين استُبدل الشعار

- جميع الصفحات التي كانت تستخدم `assets/logo-hub.jpeg|jpg` أو `hub-icon-192/512`
- Header / Footer / Login / Register / Forgot password / Client / Dashboard sidebar icon
- Packages / Studios / Branches / Store / Booking pages / systems/*
- Favicon + Apple touch + PWA icons (`manifest.json`)
- Defaults في `js/hub-settings-center.js` و`lib/hub-client-portal.js` وغيرها

## استثناءات (مقصودة)

| الصفحة / الأصل | السبب |
|---|---|
| `assets/logo-naiosh-ai.jpg` | شعار متخصص لنظام تحليل البيانات — لم يُمس |
| `info-center.html` | تحويل فوري إلى `hub-checklist.html` (لا واجهة شعار) |
| `events-studio-main.html` | تحويل فوري إلى `events.html` |
| شعارات أنظمة/خدمات أخرى مستقلة | ليست الهوية العامة لنايوش هوب |

## مصدر مركزي

- `assets/brand/` + `assets/brand/README.md`
- `js/hub-brand.js` — ثوابت المسارات وإصدار الكاش

## اختبار الإنتاج (يُملأ بعد النشر)

| # | الاختبار | النتيجة |
|---|---|---|
| 1 | الشعار الجديد في الصفحات العامة | قيد الانتظار |
| 2 | لا نسخة قديمة للهوية العامة | قيد الانتظار |
| 3 | لا صور مكسورة | قيد الانتظار |
| 4 | كمبيوتر / موبايل | قيد الانتظار |
| 5 | فاتح / داكن | قيد الانتظار |
| 6 | عدم تغيير توزيع الصفحات | قيد الانتظار |
| 7 | روابط الشعار تعمل | قيد الانتظار |
| 8 | كاش محدّث (`?v=official1`) | قيد الانتظار |

**لا FULL PASS قبل التحقق على الإنتاج.**
