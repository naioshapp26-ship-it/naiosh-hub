# جرد شامل لنماذج المرفقات — نايوش هوب 360

تاريخ: 2026-10-12 · الفرع: `cursor/unified-attachments-full-audit-ee32`  
المكوّن: `HubFormAttachments` + `/api/hub/uploads` + `/api/hub/entity-attachments`  
حد السياسة: **1500MB/ملف** (`HubUploadLimits`) · الاستئناف المجزأ: **IMPLEMENTED** (`lib/hub-upload-sessions.js` + `/api/hub/uploads/:id/chunk|complete`)  
المصفوفة النهائية صفًا بصف: `docs/unified-attachments-58-final-matrix.md` · تقرير الأحجام: `docs/unified-attachments-resumable-sizes-report.md`

## ملخص الأعداد

| المقياس | العدد |
|---|---:|
| إجمالي النماذج/النوافذ المفحوصة | **118** |
| تحتاج مرفقات (`yes`) | **58** (كلها مصنّفة نهائيًا في المصفوفة) |
| ربما تحتاج (`maybe`) | **18** |
| لا تحتاج (`no`) | **42** |
| مربوطة بـ `HubFormAttachments` | **21** |
| رفع مخصص (كامل / جزئي / استثناء مبرر) | **~33** |
| REDIRECT / عرض فقط | **4** |
| كانت بلا رفع حقيقي وأُصلحت في هذا الفرع | أمن، حوكمة بيانات، حوكمة، Posha، إعلانات→HubUpload، تحويلات اللوحة |
| سلم 100/500/1000/1500MB + استئناف | **PASS محلي** — انظر تقرير الأحجام |
| مختبرة برفع حقيقي (API lifecycle) | انظر `docs/unified-attachments-real-ops-report.md` |
| مختبرة UI متصفح | موظف + إعلان smoke؛ الباقي **NOT_TESTED** |

**لا يُعلن FULL PASS** — انظر المصفوفة النهائية وأعمدة الاختبار.

### دلالة عمود «موحّد؟»
- **نعم** = `HubFormAttachments` mount/bind + (عادة) `persistToEntity`
- **جزئي** = عرض/تحميل فقط أو جمع بدون كل المناطق
- **مخصص** = رفع عامل عبر `HubUploadLimits` / `/api/hub/uploads` / `/api/client/attachments` / register APIs — **ليس** المكوّن الموحد لكنه يدعم وسائط
- **لا** = لا رفع حقيقي

### دلالة عمود «مختبر؟»
- **API-REAL** = رفع+ربط+جلب في `e2e-unified-attachments-real.js`
- **UI** = ظهور الحقول فقط
- **SRC** = فحص مصدر الكود في الجرد
- **PREV** = اختبارات سابقة في المستودع (مخصصة)
- **لا** = لم يُختبر بعد

---

## أ) نماذج مربوطة بالمكوّن الموحد

| الصفحة / الرابط | النموذج | يحتاج؟ | صورة | ملف | فيديو | موحّد؟ | مختبر؟ | نتيجة |
|---|---|---|---|---|---|---|---|---|
| `services.html` | طلب خدمة · المرفقات | نعم | نعم | نعم | نعم | نعم | PREV/SRC | PASS (مسبق) |
| `consultation.html` | طلب استشارة | نعم | نعم | نعم | نعم | نعم | PREV/SRC | PASS (مسبق) |
| `suggestions.html` | مقترح | نعم | نعم | نعم | نعم | نعم | PREV/SRC | PASS (مسبق) |
| `complaints.html` | شكوى | نعم | نعم | نعم | نعم | نعم | PREV/SRC | PASS (مسبق) |
| `support.html` | تذكرة دعم | نعم | نعم | نعم | نعم | نعم | PREV/SRC | PASS (مسبق) |
| `naiosh-solutions.html` | معالج طلب حل | نعم | نعم | نعم | نعم | نعم | SRC | NOT_TESTED (رفع حقيقي) |
| `cost-reduction.html` | خفض التكاليف | نعم | نعم | نعم | نعم | نعم | SRC | NOT_TESTED (رفع حقيقي) |
| `dashboard.html#roles-permissions` | إضافة/تعديل موظف | نعم | نعم | نعم | نعم | نعم | API-REAL + UI | PASS lifecycle / UI |
| `dashboard.html#roles-permissions` | درج مرفقات موظف | نعم | نعم | نعم | نعم | جزئي | API-REAL | PASS list/content |
| `dashboard.html#workforce` | معالج موظف | نعم | نعم | نعم | نعم | نعم | SRC | NOT_TESTED |
| `dashboard.html#staff-admins` | إضافة/تعديل إداري | نعم | نعم | نعم | نعم | نعم | SRC | NOT_TESTED |
| `dashboard.html#identity` | إضافة/تعديل مستخدم | نعم | نعم | نعم | نعم | نعم | SRC | NOT_TESTED |
| `dashboard.html#clients-mgmt` | إضافة/تعديل عميل | نعم | نعم | نعم | نعم | نعم | SRC | NOT_TESTED |
| `dashboard.html#info-security` | حادث أمني · مرفقات | نعم | نعم | نعم | نعم | نعم | SRC | NOT_TESTED |
| `dashboard.html#data-governance` | أصل بيانات · مرفقات | نعم | نعم | نعم | نعم | نعم | SRC | NOT_TESTED |
| `dashboard.html#governance` | عقد · مرفقات | نعم | نعم | نعم | نعم | نعم | SRC | NOT_TESTED |
| `dashboard.html#governance` | دليل/مستند · مرفقات | نعم | نعم | نعم | نعم | نعم | SRC | NOT_TESTED |
| `dashboard.html#clients-mgmt` (Posha طلب) | مرفقات طلب | نعم | نعم | نعم | نعم | نعم | SRC | NOT_TESTED |

---

## ب) نماذج برفع مخصص عامل (ليست HFA — لا تُعاد كتابتها هنا)

| الصفحة / الرابط | النموذج | يحتاج؟ | صورة | ملف | فيديو | موحّد؟ | مختبر؟ | نتيجة |
|---|---|---|---|---|---|---|---|---|
| `register.html` | سجل معنا | نعم | نعم | نعم | نعم | مخصص | PREV | PASS (مسبق) |
| `register-freelancer.html` | فريلانسر | نعم | نعم | نعم | نعم | مخصص | SRC | NOT_TESTED |
| `book-platform.html` | حجز منصة | نعم | نعم | نعم | نعم | مخصص | PREV | انظر تقارير الحجز |
| `book-office.html` | حجز مكتب | نعم | نعم | نعم | نعم | مخصص | PREV | انظر تقارير الحجز |
| `book-incubator.html` | حجز حاضنة | نعم | نعم | نعم | نعم | مخصص | PREV | انظر تقارير الحجز |
| `side-projects.html#sp-registrations` | تسجيل مشروع | نعم | نعم | نعم | نعم | مخصص | SRC | NOT_TESTED |
| `publish-research.html` | نشر بحث | نعم | نعم | نعم | نعم | مخصص | SRC | NOT_TESTED |
| `search-admin.html` | محتوى بحث | نعم | نعم | نعم | نعم | مخصص | SRC | NOT_TESTED |
| `policies.html` | سياسة PDF | نعم | لا | نعم | لا | مخصص | SRC | NOT_TESTED |
| `store.html#upload` | رفع منتج | نعم | نعم | نعم | لا | مخصص | SRC | NOT_TESTED |
| `store.html` | شعار متجر | نعم | نعم | لا | لا | مخصص | SRC | NOT_TESTED |
| `ads.html` | إعلان | نعم | نعم | نعم | نعم | مخصص | PREV | انظر تقارير الإعلانات |
| `events.html` | فعالية / مرفقات / مقاطع | نعم | نعم | نعم | نعم | مخصص | PREV | studio ops |
| `marketing-campaigns-studio.html` | حملة / محتوى / ريلز | نعم | نعم | نعم | نعم | مخصص | PREV | studio ops |
| `blog.html` | مقال | نعم | نعم | نعم | نعم | مخصص | PREV | articles e2e |
| `system-ops.html` | مدونة نظام | نعم | نعم | نعم | نعم | مخصص | SRC | NOT_TESTED |
| `roles-permissions.html` | هوية صفحة (شعار/هيرو/فيديو) | نعم | نعم | لا | نعم | مخصص | SRC | NOT_TESTED |
| `client.html#support/#complaints/#requests` | بوابة العميل | نعم | نعم | نعم | نعم | مخصص | PREV | client attachments e2e |
| `client.html` / `profile-360.html` | أفاتار/وثائق 360 | نعم | نعم | نعم | نعم | مخصص | PREV | profile-360 e2e |
| `dashboard.html#tasks` | مهمة · `#tk-files` | نعم | نعم | نعم | نعم | مخصص | PREV | tasks e2e |
| `dashboard.html#settings` | شعارات / بنر | نعم | نعم | لا | لا* | مخصص | SRC | NOT_TESTED |
| `dashboard.html#site-settings` | شعار متجر | نعم | نعم | لا | لا | مخصص | SRC | NOT_TESTED |
| HubActions (`hub-row-actions.js`) | كيان/منتج/إعلان | نعم | نعم | نعم | نعم | مخصص | SRC | NOT_TESTED |

\* فيديو البنر عبر رابط URL وليس رفع ملف في بعض المسارات.

---

## ج) نماذج لا تحتاج مرفقات (عيّنة)

دخول، نسيت كلمة المرور، إنشاء حساب، دفع، نشرة، بحث، فلاتر، مؤشرات، موصلات، تقارير نصية، SSO، صلاحيات إداري فقط، إلخ — **42** نموذجًا مصنّفة `no` في الجرد التفصيلي للمساعد.

---

## د) فجوات متبقية (تحتاج مرفقات ولم تُوحَّد / لم تُختبر رفعًا حقيقيًا)

| الصفحة | النموذج | الحالة | إجراء مطلوب |
|---|---|---|---|
| معظم صفوف القسم (ب) | رفع مخصص عامل | وسائط موجودة لكن ليست HFA | ترحيل تدريجي اختياري؛ **ليست بلا مرفقات** |
| `dashboard.html#store` إضافة منتج سريع | بلا ملف | فجوة UX | ربط HFA أو توجيه لـ store upload |
| `dashboard.html` إعلان/فعالية سريع | بلا ملف | فجوة UX | توجيه لصفحات الاستوديو |
| حلول admin إضافة حل | maybe | نص فقط | تقييم لاحق |
| رحلات الإنتاج متعددة الأدوار | — | **NOT_TESTED** | بعد النشر |

---

## هـ) اختبارات إلزامية — حالة

| # | المطلوب | الحالة |
|---|---|---|
| 1 | رفع صورة وحفظها | **PASS** (API-REAL على كيان موظف) |
| 2 | رفع ملف وحفظه | **PASS** |
| 3 | رفع فيديو وحفظه | **PASS** (ملف فيديو اختباري صغير + probe أكبر) |
| 4 | إعادة فتح السجل وظهور المرفقات | **PASS** |
| 5 | تحديث/إعادة دخول | **PASS** (token جديد + list) |
| 6 | ظهور للمخوَل | **PASS** (staff) |
| 7 | منع غير المخوَل | **PASS** (عميل يرى 0) |
| 8 | فشل ثم إعادة محاولة دون فقد | **PASS** |
| 9 | عدم تكرار (Idempotency-Key) | **PASS** |
| 10 | رفع فيديو 1500MB فعلي | **NOT_TESTED** |
| 11 | استئناف بعد انقطاع | **NOT_IMPLEMENTED** |
| 12 | إنتاج: عميل/موظف/مدير/ممنوع + جوال + ليلي/نهاري | **NOT_TESTED** حتى نشر الفرع |

التفاصيل: `docs/unified-attachments-real-ops-report.md`.
