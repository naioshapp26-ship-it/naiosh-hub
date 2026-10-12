# متابعة مستقلة — دخول القائد / الحجوزات / GPS

التاريخ: 2026-10-12  
الإنتاج: `https://naiosh-hub-production.up.railway.app`  
الفرع: `cursor/sa-login-bookings-gps-followup-ee32`

---

## 1) دخول القائد الأعلى `naioshhub@example.com`

| الفحص | النتيجة | دليل |
|---|---|---|
| الحساب موجود + `HUB_SUPER_ADMIN_INITIAL_PASSWORD` | **401 متوقع** | الهاش في Postgres لا يطابق INITIAL — لم يُغيَّر شيء |
| دخول بكلمة المرور الحقيقية `HUB_PROD_SA_PASSWORD` | **غير مثبت** | السر غير متوفر في بيئة الوكيل |
| تغيير كلمة المرور / FORCE reset / صلاحيات | **لم يُنفَّذ** | ممنوع بدون موافقة |

**الحكم:** لا PASS لدخول القائد. التشخيص يثبت أن INITIAL لا يدخل ولا يستبدل الهاش (سلوك صحيح). لإثبات الدخول يلزم إضافة سر `HUB_PROD_SA_PASSWORD` (كلمة المرور الحالية فقط) ثم إعادة تشغيل `scripts/diagnose-sa-login-prod.js`.

---

## 2) الحجوزات القديمة — فقدان؟ استعادة؟

| البند | القيمة |
|---|---|
| عدد الحجوزات الحالية على الإنتاج | **2** (`pb-mv5qntbb-en01k`, `pb-mv5qjl4a-pzd05`) |
| مرشحو الخزنة المحلية | 9 |
| فقدان مُثبت كان على الإنتاج (201 سابقًا) | **2** — `pb-mv5po1cv-x1he3`, `pb-mv5oximx-9f46e` |
| استعادة طُبّقت؟ | **لا** |
| كتابة فوق البيانات الحالية؟ | **لا** |

**الحكم:** الفقدان **ليس طبيعيًا**. حجوزان أُنشئا على الإنتاج (تقارير OSM live + prod submit) اختفيا بعد إعادة النشر قبل ثبات `hub_meta`. الخزنة المحلية تحتفظ بنسخ مرشّحة.

**خطة استعادة آمنة (بانتظار موافقتك):**
1. نسخة احتياطية من `hub_meta.platform_bookings_v1` + ملف القرص.
2. Dry-run اتحاد بالمعرّف (الإنتاج يفوز عند التعارض) — جاهز عبر `scripts/bookings-recovery-dryrun.js`.
3. تطبيق **فقط** معرّفات `proven_prod_e2e` (أو قائمة تعتمدها)، بدون استبدال المصفوفة كاملة.
4. إعادة قراءة القائمة والتأكد أن الحجوزات الحالية الـ2 ما زالت موجودة.

**إصلاح وقائي منفّذ:** `hydratePlatformBookings` يدمج ملف القرص ∪ قاعدة البيانات حسب `id` (لا يمسح المجموعة الأكبر بالمجموعة الأصغر). اختبار وحدة: `scripts/test-bookings-merge-by-id.js`.

---

## 3) موافقة GPS الحقيقية

| الفحص | النتيجة |
|---|---|
| مسار الكود بعد منح الإذن (`getCurrentPosition` + إحداثيات) | **PASS** (Chromium `overridePermissions`) |
| رفض GPS + متابعة يدوية | **PASS** |
| نقرة مستخدم على حوار نظام التشغيل Allow | **غير مثبت** — FAIL صريح |

**الحكم:** لا PASS كامل لموافقة GPS من متصفح فعلي/حوار OS. مسار ما بعد الموافقة مثبت؛ حوار OS يحتاج متصفحًا تفاعليًا بموافقة يدوية.

---

## أدوات

- `scripts/diagnose-sa-login-prod.js`
- `scripts/bookings-recovery-dryrun.js` (قراءة فقط)
- `scripts/test-bookings-merge-by-id.js`
- `scripts/e2e-gps-real-permission.js`
- آثار: `/opt/cursor/artifacts/sa-login-diagnose-*.json`, `bookings-recovery-dryrun-*.json`, `gps-real-permission/`
