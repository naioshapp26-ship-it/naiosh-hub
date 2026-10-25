# إنشاء بيئة الاستعادة المعزولة `naiosh-hub-restore-lab`

الهدف: استعادة نسخة من Postgres الإنتاج على قاعدة **منفصلة** ثم التحقق منها بسكربت القراءة فقط.  
**ممنوع** الاستعادة فوق الإنتاج أو ربط تطبيق الإنتاج بهذه القاعدة.

## أ) إنشاء قاعدة الاستعادة

1. افتح [Railway Dashboard](https://railway.app/dashboard).
2. ادخل مشروع **naiosh-hub**.
3. **New** → **Database** → **Add PostgreSQL**.
4. بعد الإنشاء: Settings → غيّر اسم الخدمة إلى: `naiosh-hub-restore-lab`.
5. تأكد أن خدمة التطبيق `naiosh-hub` **لا** تحتوي Variable Reference يشير إلى `naiosh-hub-restore-lab`.
6. لا تضف Webhooks / Workers / Cron على restore-lab.

## ب) أخذ Backup من الإنتاج

1. افتح خدمة **Postgres الإنتاج** (ليست restore-lab).
2. تبويب **Backups** (أو Data → Backups حسب الواجهة).
3. **Create backup** وانتظر اكتماله.

## ج) الاستعادة إلى restore-lab

### إن وُجد «Restore to another database»
1. من Backup الإنتاج اختر **Restore**.
2. الهدف: `naiosh-hub-restore-lab` فقط.
3. أكّد أن المصدر إنتاج والهدف lab.

### إن لم تتوفر الاستعادة المباشرة
من جهازك المحلي فقط (لا تلصق الروابط في الشات):

```bash
# 1) صدّر من الإنتاج (استخدم رابط الإنتاج محليًا لديك)
pg_dump "$PROD_DATABASE_URL" -Fc -f /tmp/naiosh-prod.dump

# 2) استعد على lab فقط
pg_restore --clean --if-exists --no-owner -d "$RESTORE_LAB_DATABASE_URL" /tmp/naiosh-prod.dump
rm -f /tmp/naiosh-prod.dump
```

## د) تسليم رابط lab للوكيل (سر فقط)

1. افتح `naiosh-hub-restore-lab` → **Variables**.
2. انسخ **DATABASE_URL الخاص بـ restore-lab** (ليس الإنتاج).
3. احقنه في أسرار جلسة الوكيل باسم: `RESTORE_LAB_DATABASE_URL`.
4. في الشات اكتب فقط: `restore lab ready`

## هـ) ما الذي يفعله الوكيل بعدها

يشغّل:

```bash
RESTORE_LAB_DATABASE_URL=… node scripts/verify-restore-lab.js
```

السكربت:

- يرفض عناوين تشبه الإنتاج ما لم يتضح أنها lab.
- يتصل **للقراءة فقط**.
- لا يستدعي APIs هوب ولا يرسل إشعارات.
- يتحقق من الجداول الأساسية والعلاقات وعينات العدّ.

## عزل إضافي موصى به

- لا تضف `APP_URL` / مفاتيح Paymob / SMTP على restore-lab.
- لا تشغّل `naiosh-hub` app مقابل restore-lab في الإنتاج.
- احذف خدمة restore-lab بعد انتهاء التحقق إن رغبت.
