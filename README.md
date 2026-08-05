# Naiosh Hub 360

**نظام التشغيل العالمي لإمبراطورية نايوش** — Central Digital Hub / Global Digital Hub  
ليس موقعًا إلكترونيًا، بل منصة تشغيل مركزية تربط الفروع والحاضنات والمنصات والمكاتب والأنظمة.

## التشغيل

```bash
npm start
# أو
node server.js
```

ثم افتح: http://localhost:8080 (محليًا الافتراضي 8080، وعلى Railway يستخدم `PORT`)

## Railway + Postgres

راجع: [`db/RAILWAY.md`](db/RAILWAY.md)

باختصار على خدمة **naiosh-hub** أضف:

- `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- `DATABASE_PRIVATE_URL=${{Postgres.DATABASE_PRIVATE_URL}}`
- `NODE_ENV=production`
- `HUB_AUTO_MIGRATE=true`

الجداول تُنشأ تلقائيًا من `db/schema.sql` عند الإقلاع.

اختبارات سريعة بعد النشر:

- `/api/health`
- `/api/env-check`
- `/api/db/tables`

## الصفحات

- `index.html` — الواجهة الرئيسية
- `login.html` — تسجيل الدخول
- `dashboard.html` — غرفة العمليات / مركز التحكم

## دستور المعمارية (مصدر القوة)

الملف التشغيلي: `js/empire-blueprint.js`

يشمل:
- الفلسفة: عاصمة رقمية + مدن متخصصة (ERP / LAW / FIT…)
- 5 طبقات: Core · Business · Collaboration · Knowledge · Governance
- 12 محورًا (من الهوية حتى الحوكمة والتحليلات)
- Core Platform components (NAIOSH ID, SSO, IAM, Multi-Tenant…)
- أولويات أول 6 أشهر
- وثائق ما قبل الكود

هذه المعمارية تُغذّي `HubStore` واللوحات في الداشبورد — ليست نصًا للعرض فقط.

## لوحات غرفة العمليات

| اللوحة | الوظيفة |
|--------|---------|
| مركز التحكم | مؤشرات الإمبراطورية اللحظية |
| إشعارات هوب | صندوق موحّد لكل تنبيهات الأنظمة |
| دستور المعمارية | الطبقات · المحاور · الأولويات · Core |
| سجل الأنظمة | فتح مباشر للنظام · تشغيل عبر هوب أو منفرد |
| NAIOSH ID | SSO · الأدوار · MFA |
| الهيكل العالمي | دولة ← فرع ← حاضنة ← منصة ← مكتب |
| الحاضنات | إنشاء ومتابعة الحاضنات القطاعية |
| محفظة النقاط | شحن · استهلاك · تسعير |
| + الطبقات التشغيلية السابقة | عقل · حوكمة · مهام · قياس · تقارير · تكامل |

## تشغيل الأنظمة عبر هوب

- اضغط ERP (أو أي نظام) من `apps.html` أو غرفة العمليات → انتقال مباشر إلى `systems/erp.html`
- نفس النظام يعمل **منفردًا** عبر زر «منفرد» أو `?mode=standalone`
- من داخل النظام: **رفع المعلومات على هوب** + **إرسال إشعار لهوب**
- APIs: `POST /api/hub/sync` · `POST/GET /api/hub/notifications` · `GET /api/hub/apps`

## حسابات تجريبية

| الحساب | كلمة المرور |
|--------|-------------|
| leader@naiosh.com | Hub@360 |
| malika@naiosh.com | Hub@360 |

## الهوية

ألوان المنصة فقط: **أحمر / أبيض / أسود** + شعار Hub 360.
