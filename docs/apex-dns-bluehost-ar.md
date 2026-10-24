# ربط naioshhub.com (بدون www) → الإنتاج

الوضع الحالي (فحص DNS):
- `www.naioshhub.com` → CNAME إلى `nqt1hob7.up.railway.app` (يعمل)
- `naioshhub.com` → **لا يوجد سجل A/AAAA/ALIAS** (لا يُحل)

Nameservers: `ns1.bluehost.com` / `ns2.bluehost.com`

## عند صاحب حساب Bluehost (خطوة DNS)

1. افتح [Bluehost → Domains → naioshhub.com → DNS / Zone Editor](https://www.bluehost.com/my-account/login).
2. أضف سجلًا للـ **apex** (`@` / `naioshhub.com`):
   - إن وُجد **ALIAS / ANAME / CNAME Flattening**: وجّهه إلى `nqt1hob7.up.railway.app`
   - وإلا **A record** إلى عنوان Railway الظاهر في لوحة الدومين المخصص (غالبًا نفس IP الحالي لـ www: تحقق من Railway → Networking بعد إضافة الدومين).
3. احفظ وانتظر الانتشار (قد يستغرق دقائق إلى ساعات).

## في Railway (إن لم يكن الدومين مضافًا)

1. مشروع الإنتاج → خدمة `naiosh-hub` → **Settings → Networking → Custom Domains**.
2. أضف `naioshhub.com` و`www.naioshhub.com`.
3. اجعل **www** هو العنوان الأساسي إن وفّرت Railway خيار primary، أو اترك تحويل apex→www عبر إعداد الدومين.

## التحقق المتوقع

```bash
dig +short naioshhub.com A
curl -sI https://naioshhub.com | head -5   # 301/308 → www أو 200
curl -sI https://www.naioshhub.com/api/health
```

لا تُلصق أسرار Railway في الشات.
