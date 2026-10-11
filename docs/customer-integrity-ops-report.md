# تقرير اعتماد نظام العملاء — PR #212

التاريخ: 2026-10-11T21:15:00Z  
الفرع: `cursor/customer-integrity-ops-ee32`  
الأدلة: `/opt/cursor/artifacts/customer-integrity/`

## الحكم النهائي

**NOT READY** لإعلان جاهزية واسعة / مليون عميل متزامن.

ما ثبت: سلامة فجوات الهوية للعملاء، جلسة عبر النسخ بلا sticky، رحلة متصفح كاملة (محلي + إنتاج حالي)، مرفقات DB بعد إعادة التشغيل، بروفة نسخ احتياطي/استعادة/ترحيل على بيئة اختبار.

ما لم يثبت: عتبات الضغط 100–1000 متزامن على مضيف 4 vCPU، نشر **هذا** الفرع على Railway مع ترحيل الجداول العلائقية على إنتاج، وقطع S3 حي.

---

## 1) سلامة البيانات — PASS

| المقياس | القيمة |
|---|---:|
| hub_users (الكل) | 35468 |
| hub_users role=customer | 35466 |
| hub_client_accounts | 35467 |
| hub_profiles | 37667 |
| customers_without_client_account | **0** |
| customers_without_profile | **0** |
| تكرارات email/client_id/account_no | **0** |

### لماذا الأعداد تختلف مع «فجوات صفر»؟

- **فجوة = عميل بلا سجل مطلوب.** كل `role=customer` يملك `hub_client_accounts` و`hub_profiles`.
- **+1 client_account:** يتيم `direct_*@t.local` بلا مستخدم customer (بقايا اختبار مباشر) — ليس عميلًا ناقصًا.
- **+2201 profiles:** يتامى اختبار ضغط/تشخيص:
  - scale-test.naiosh.local: 1112
  - t.local: 1031
  - naiosh-test.com: 55
  - example.com: 3  
  منها personas: client 2194 / member 6 / employee 1 — **لم تُحذف** (ليست بيانات عملاء ناقصة).

الأدلة: `integrity-audit.json`, `integrity-audit.md`  
السكربت: `scripts/audit-customer-integrity.js` (قراءة فقط).

| البند | الحالة |
|---|---|
| customers_have_required_portal_and_profile | PASS |
| no_duplicate_identity_keys | PASS |
| orphan_extras_documented_not_deleted | PASS |

---

## 2) رحلة العميل من المتصفح — PASS

أداة: Puppeteer + Chrome (desktop 1440 + mobile 390).

### محلي (فرع هذا PR) — 17/17 PASS

`http://127.0.0.1:8835` — تسجيل، دخول، مركز عميل، Profile 360، صورة، تعديل، كلمة مرور، طلب+تذكرة، خروج/دخول، استمرارية، عزل حسابين.

### إنتاج Railway الحالي — 17/17 PASS

`https://naiosh-hub-production.up.railway.app` — نفس الرحلة على النشر الحالي (ليس بالضرورة كود #212 بعد الدمج).

الأدلة: `browser/browser-journey-report.json`, لقطات `browser/01_*.png` … `09_*.png`, سجلات `browser-local-run2.log`, `browser-prod-run2.log`.

| البند | الحالة |
|---|---|
| ui_desktop_mobile_full_journey_local | PASS |
| ui_desktop_mobile_full_journey_production_current | PASS |
| api_only_as_substitute | غير مقبول كبديل — وتم تجاوزه بتنفيذ المتصفح |

---

## 3) النشر / Railway — جزئي

| البند | الحالة | دليل |
|---|---|---|
| backup `pg_dump -Fc` قابل للاستعادة | PASS | `rehearsal-backup-*.dump` (~11MB) → clone restore `hub_users` count OK |
| migrate schema idempotent (env اختبار) | PASS | `prod-migrate-dryrun.json` |
| restore clone verify | PASS | |
| خطة نشر آمنة + رجوع (blobs محفوظة) | PASS (موثّقة) | في `prod-migrate-dryrun.json` |
| نشر **هذا الفرع** + ترحيل علائقي على إنتاج Railway | **NOT TESTED** | يحتاج `HUB_ALLOW_PROD_MIGRATE=1` + redeploy + smoke حسابات معروفة بعد الدمج |
| اختبار حسابات معروفة قبل/بعد نشر الفرع الجديد | **NOT TESTED** لنشر #212؛ رحلة إنتاج حالية PASS على الكود المنشور الآن |

---

## 4) الأداء والتوسع — FAIL (على هذا المضيف)

المضيف: **4 vCPU**, ~16 GiB RAM.

### جذر البطء (أرقام)

| مصدر | قياس |
|---|---|
| scrypt N=16384 (عملية واحدة) | p50≈42ms, p95≈46ms |
| DB `SELECT 1` | p95≈1ms |
| `COUNT(*)` customers | ≈14ms |
| burst متزامن register+login@10 | login p95≈3275ms, reg p95≈4690ms, أخطاء 0 |
| burst@100 | login p95≈25743ms, reg p95≈36240ms, أخطاء 0 |

**الخلاصة:** عنق الزجاجة = **CPU / طابور scrypt (libuv threadpool)** تحت تزامن التسجيل+التحقق، وليس قفل معاملات Postgres ولا زمن استعلام بسيط. لم تُضعَف حماية كلمات المرور.

### k6 multi-instance (2 replicas + LB round-robin، بدون sticky)

| VUs | أخطاء | login P95 | register P95 | عتبة 100-VU SLO | النتيجة |
|---|---:|---:|---:|---|---|
| 50 | 0% | ~9963ms | ~17413ms | login&lt;2000 / reg&lt;3000 | **FAIL** latency |
| 100 | 0% | ~17463ms | ~32772ms | نفس العتبات | **FAIL** latency |

### السعة الآمنة المعلنة على هذا العتاد

- **لا تُعلن** جاهزية 100/200/500/1000 متزامن وفق العتبات المطلوبة على 4 vCPU بعد التزويد العلائقي الكامل.
- أقرب سلوك سابق موثّق (#211): multi-instance light @100 بأخطاء 0% وP95 أعلى قليلًا من العتبة؛ بعد الحمل العلائقي الحالي على نفس المضيف، التسجيل أثقل.
- خطة رفع: الإبقاء على scrypt N=16384؛ توسعة أفقية (≥8 vCPU / 2–4 replicas لهدف ~200؛ ≥16–32 vCPU + PgBouncer لـ 500–1000) ثم إعادة k6 على staging قبل أي إعلان.

الأدلة: `perf-root-cause.json`, `k6-mi-light-50.json`, `k6-mi-light-100.json`.

| البند | الحالة |
|---|---|
| root_cause_cpu_scrypt_vs_db | PASS (مقاس) |
| k6_100_200_500_1000_declared_slos | **FAIL** |
| million_concurrent_claim | **FAIL / غير مثبت** |

---

## 5) الجلسات بين النسخ — PASS

2 replicas + LB round-robin (لا sticky):

1. تسجيل/دخول عبر LB  
2. `/api/client/me` على A و`/api/hub/profiles/me` على B بنفس التوكن  
3. logout على A (انتظار Postgres `hub_revoked_tokens`)  
4. فورًا 401 على B وA  
5. إعادة دخول ناجحة  

الأدلة: `cross-replica-session.json` — كل الخطوات PASS.

---

## 6) المرفقات / التخزين — PASS (DB) / NOT TESTED (S3 حي)

| البند | الحالة |
|---|---|
| رفع + ربط صورة + تذكرة | PASS |
| بقاء الملف بعد إعادة تشغيل السيرفر | PASS |
| adapter get BYTEA (مفاتيح آمنة ومتداخلة) | PASS |
| `deleteOldCopies=false` | PASS |
| S3 dual-write حي على بيئة اختبار كاملة الإعداد | **NOT TESTED** (لا `HUB_S3_*`) |

الأدلة: `object-storage-durability.json`.

---

## 7) جدول الاعتماد النهائي

| # | البند | الحالة |
|---|---|---|
| 1 | تفسير فروقات الأعداد + فجوات العملاء = 0 | **PASS** |
| 2 | رحلة متصفح desktop+mobile (محلي) | **PASS** |
| 2b | رحلة متصفح على إنتاج الحالي | **PASS** |
| 3 | بروفة backup/migrate/restore | **PASS** |
| 3b | نشر فرع #212 + ترحيل علائقي على Railway | **NOT TESTED** |
| 4 | عتبات ضغط 100–1000 | **FAIL** |
| 4b | تشخيص جذر البطء بالأرقام | **PASS** |
| 5 | logout عبر النسخ بلا sticky | **PASS** |
| 6 | استمرارية المرفقات (DB) بعد restart | **PASS** |
| 6b | S3 cutover حي | **NOT TESTED** |
| — | جاهزية مليون عميل / إعلان واسع | **FAIL (غير مثبت)** |

---

## تغييرات هذا الفرع (ملخص)

- `requireAuthAsync` / `isRevokedAsync` / `revokeTokenAsync` عبر الجلسة، البوابة، Profile 360، logout، وتغيير كلمة المرور.
- قراءة object-storage من BYTEA مباشرة للمفاتيح غير المطابقة لصيغة ملف الرفع.
- سكربتات: `audit-customer-integrity`, `e2e-cross-replica-session`, `e2e-customer-browser-full-journey`, `e2e-object-storage-durability`, `perf-root-cause-probe`, `prod-migrate-dryrun`.
