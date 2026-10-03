# تقرير اختبار مرفقات «سجل معنا»

تاريخ: 2026-10-03

## الملفات التي تم تعديلها/إضافتها

| ملف | الدور |
|---|---|
| `register.html` | قسم المرفقات (صور/ملفات/فيديو) داخل نموذج التسجيل |
| `js/hub-register.js` | منطق الاختيار، المعاينة، Progress، إلغاء/إعادة، إنشاء Request ID ثم الرفع |
| `css/hub-register-attachments.css` | تصميم مناطق السحب/الإفلات وقوائم الملفات |
| `js/hub-upload-limits.js` | رفع الحد إلى **1500MB** + دعم `signal`/`headers`/`url` للإلغاء والرفع المخصص |
| `lib/hub-uploads.js` | حد التخزين الفعلي 1500MB + تصدير `safeOriginalName` |
| `lib/hub-register-attachments.js` | **جديد** — metadata المرفقات وربطها بـ Request ID |
| `server.js` | APIs للطلبات/المرفقات + حماية الروابط العامة للمرفقات الخاصة |
| `js/hub-platform-grants.js` | حفظ `attachments` و`REG-REQ-*` في مسار الموافقة |
| `js/hub-rent-admin.js` | عرض/معاينة/تنزيل المرفقات في لوحة الإدارة |
| `js/hub-higher-approvals.js` / `hub-higher-approvals-ui.js` | تمرير وعرض المرفقات في موافقات المدير الأعلى |
| `js/hub-store.js` | `maxUploadMb` الافتراضي/الأقصى = 1500 |
| `js/hub-search-catalog.js` | fallback الحجم 1500MB |
| `rent-admin.html` | تحديث إصدارات السكربتات |
| `scripts/test-upload-limit-150mb.js` | التحقق من حد 1500MB |
| `scripts/e2e-register-attachments.js` | اختبارات E2E 1–8 |

## الـ API التي أُضيفت/عُدّلت

| Method | Path | ملاحظات |
|---|---|---|
| GET | `/api/hub/upload-limits` | يعيد `maxMb: 1500` (+ `videoMaxMb`) |
| POST | `/api/hub/register-requests` | إنشاء طلب تسجيل عام → `REG-REQ-…` + `uploadToken` |
| GET | `/api/hub/register-requests/:id` | تفاصيل الطلب + المرفقات (Staff أو uploadToken) |
| POST | `/api/hub/register-requests/:id/attachments` | رفع مرفق مرتبط بنفس Request ID |
| DELETE | `/api/hub/register-requests/:id/attachments/:attId` | حذف/إلغاء مرفق |
| GET | `/api/hub/register-attachments/:id` | metadata |
| GET | `/api/hub/register-attachments/:id/content` | معاينة/تنزيل محمي بالصلاحيات |
| GET | `/uploads/:id` | **يرفض** مرفقات التسجيل الخاصة (403) |

## طريقة تخزين المرفقات

- الملفات على القرص: `data/uploads/<safe-id>.<ext>` (streaming، **ليس** Base64، **ليس** داخل DB).
- Metadata: `data/register-attachments.json` (Request ID، Attachment ID، أسماء، MIME، حجم، storageRef، حالة الرفع).
- مرآة للوحة الإدارة: `data/platform-grants.json` مع نفس Request ID وقائمة `attachments`.

## الحد الفعلي الذي تم اختباره للفيديو

| طبقة | القيمة المختبرة | النتيجة |
|---|---|---|
| Frontend `HubUploadLimits.MAX_FILE_MB` | 1500 | PASS |
| Backend `hubUploads.MAX_UPLOAD_MB` | 1500 | PASS |
| `GET /api/hub/upload-limits` | 1500 / 1572864000 bytes | PASS |
| `validateUploadMeta` عند 1500MB بالضبط | مسموح | PASS |
| رفض Content-Length > 1500MB | 413 + رسالة عربية | PASS |
| رفع فعلي لفيديو | 2MB + 8MB streamed | PASS |
| مهلة السيرفر | `requestTimeout = 30 * 60 * 1000` | موجودة |

> ملاحظة: لم يُرفع ملف بحجم 1.5GB كاملًا في هذه البيئة لتوفير الوقت/الموارد؛ تم التحقق من أن **كل طبقات الحد** تسمح بـ 1500MB وترفض ما فوقه فعليًا، مع رفع تدريجي حتى 8MB عبر نفس مسار الرفع.

## نتائج الاختبارات

| الاختبار | النتيجة | التفصيل |
|---|---|---|
| TEST 1 صورة + Request ID + عرض من الإدارة | **PASS** | `REG-REQ-…` + معاينة محتوى الصورة للـ staff |
| TEST 2 PDF + تنزيل/فتح من الإدارة | **PASS** | `Content-Type: application/pdf` |
| TEST 3 فيديو + ربط بنفس Request ID | **PASS** | مرفق `video` في `platform-grants.json` |
| TEST 4 حد 1500MB + رفع تدريجي | **PASS** | meta + 8MB + exact 1500MB allowed |
| TEST 5 أكبر من الحد | **PASS** | 413 «حجم الملف أكبر من 1500MB…» |
| TEST 6 نوع غير مسموح (Backend) | **PASS** | `.exe` → 400 رسالة أمنية عربية |
| TEST 7 صلاحيات الوصول | **PASS** | client/anon/public URL → 403 |
| TEST 8 جاهزية الموبايل (markup) | **PASS** | `capture` + accept + drag/drop + منع الإرسال أثناء الرفع |
| لا Base64 للفيديو في التخزين | **PASS** | storageRef فقط |
| `scripts/test-upload-limit-150mb.js` | **PASS** | حد النظام 1500MB |

ملف JSON التفصيلي: `docs/register-attachments-e2e-report.json`
