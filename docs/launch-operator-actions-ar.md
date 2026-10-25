# إجراءات المشغّل — إغلاق عوائق الإطلاق (بدون مشاركة أسرار في الشات)

## أ) Railway — الأسرار (إلزامي)

1. افتح Railway → خدمة **naiosh-hub** الإنتاجية → **Variables**.
2. نفّذ محليًا (لا تلصق الناتج في GitHub/الشات):

```bash
openssl rand -hex 32   # → SESSION_SECRET
openssl rand -hex 32   # → HUB_SSO_SECRET (قيمة مختلفة)
```

3. أضف المتغيرين كقيم سرية مستقلة.
4. **Redeploy**.
5. في محادثة الوكيل اكتب فقط: `secrets set and redeployed`.

التحقق المتوقع بعد النشر:

- `GET /api/health` → `environment.ok: true` و`failed` لا يتضمن `SESSION_SECRET`
- دخول عميل يعمل ورمز الجلسة يحمل `.s`
- `POST /api/hub/sso/issue` بدون دخول → 401
- موظف مسجّل يمكنه إصدار SSO لنفسه فقط عندما يكون السر مضبوطًا

## ب) دمج PR #253

1. راجع وادمج: https://github.com/naioshapp26-ship-it/naiosh-hub/pull/253
2. انتظر Redeploy.
3. اكتب في الشات: `253 merged`

## ج) قرار المدير الأعلى (بدون لصق كلمة المرور في الشات)

الخيار المفضل — حقن أسرار الاختبار:

- أضف في بيئة الوكيل (Secrets) وليس في الشات:
  - `HUB_E2E_HA_EMAIL` = بريد حساب بدور `supreme_leader` أو `super_admin`
  - `HUB_E2E_HA_PASSWORD` = كلمة مرور ذلك الحساب
- ثم اطلب من الوكيل إعادة تشغيل اختبار القرار على `APR-2026-00073` / `00074` أو طلبات معزولة جديدة.

الخيار البديل — تنفيذ يدوي آمن من لوحة الإنتاج (الأهداف الحالية):

1. سجّل دخول المدير الأعلى بنفسك في الإنتاج.
2. افتح صندوق الموافقات العليا.
3. **وافق** على `APR-2026-00079` (`platform_grant` / أصل `REG-REQ-MVMZZHWI-3C8F`) وتأكد أن المنحة أصبحت **مفعّل/active**.
4. **ارفض** `APR-2026-00080` (`system_rental` / أصل `rent-mvmzzikp-617c43`) بسبب واضح وتأكد الحالة **مرفوض/rejected**.
5. أعد فتح الموافق عليه وتأكد أن القرار لا يُعاد تنفيذه.
6. في الشات فقط (بدون كلمات مرور):
   `HA done: APR-2026-00079 approved; APR-2026-00080 rejected`

الوكيل يشغّل `scripts/verify-ha-manual-targets.js` و**لا** يسجّل PASS قبل نجاح التحقق من الآثار.

## د) النسخ الاحتياطي / الاستعادة — الخيار (أ) restore-lab

الخطوات التفصيلية بالنقرات: [`docs/restore-lab-railway-steps-ar.md`](./restore-lab-railway-steps-ar.md)

ملخص:

1. Railway → New → Database → PostgreSQL → سمّها `naiosh-hub-restore-lab`.
2. Postgres الإنتاج → Backups → Create backup.
3. استعد النسخة **على restore-lab فقط** (ليس الإنتاج).
4. لا تربط تطبيق الإنتاج بـ restore-lab ولا تضع SMTP/Paymob/Webhooks عليها.
5. احقن سر الوكيل `RESTORE_LAB_DATABASE_URL` = رابط **restore-lab** فقط.
6. في الشات: `restore lab ready`

التحقق: `node scripts/verify-restore-lab.js` (قراءة فقط، بدون إشعارات).

لا تُفعَّل أعلام الاستعادة التجريبية على الإنتاج (`HUB_SAFE_RESTORE_TWO_BOOKINGS` يجب أن يبقى غير مفعّل).
