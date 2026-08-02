# Railway — ربط Postgres + متغيرات البيئة + الجداول

## 1) ربط قاعدة البيانات بخدمة naiosh-hub

1. افتح مشروع Railway → خدمة **naiosh-hub** (مش Postgres).
2. تبويب **Variables**.
3. **Add Variable** → **Add Reference** (أو Raw):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `DATABASE_PRIVATE_URL` | `${{Postgres.DATABASE_PRIVATE_URL}}` |
| `NODE_ENV` | `production` |
| `APP_NAME` | `naiosh-hub` |
| `HUB_AUTO_MIGRATE` | `true` |
| `HUB_DEMO_AUTH` | `true` |
| `SESSION_SECRET` | أي نص طويل عشوائي |
| `APP_URL` | رابط الدومين العام للخدمة |
| `CORS_ORIGIN` | `*` |

> اسم مرجع Postgres قد يختلف (`Postgres` / `Postgres-xxxxx`). اختر الخدمة من قائمة References.

4. احفظ — Railway هيعمل Redeploy تلقائي.
5. عند الإقلاع السيرفر يشغّل الترحيل وينشئ الجداول من `db/schema.sql` + البذرة `db/seed.sql`.

## 2) اختبار البيئة بعد النشر

- صحة عامة: `/api/health`
- فحص المتغيرات: `/api/env-check`
- قائمة الجداول: `/api/db/tables`
- إعادة ترحيل يدوي: `/api/db/migrate`

## 3) الجداول التي تُنشأ

`hub_users` · `hub_countries` · `hub_branches` · `hub_incubators` · `hub_platforms` · `hub_apps` · `hub_products` · `hub_store_items` · `hub_store_orders` · `hub_ads` · `hub_events` · `hub_employees` · `hub_employee_rewards` · `hub_tasks` · `hub_policies` · `hub_wallet_wallets` · `hub_wallet_ledger` · `hub_feed` · `hub_meta` · `hub_env_checks` · `schema_migrations`

## 4) ملاحظات

- خدمة **Postgres** نفسها ما تحتاج Variables إضافية للتطبيق — الربط يكون على **naiosh-hub**.
- High Availability في Postgres اختياري ومكلف؛ للتطوير يكفي Replica واحدة.
- الحسابات التجريبية تُزرع في `hub_users` (نفس leader / malika).
