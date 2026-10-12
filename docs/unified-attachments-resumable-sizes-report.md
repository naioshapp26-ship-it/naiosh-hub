# تقرير الرفع المجزأ والأحجام — نايوش هوب 360

التاريخ: 2026-10-12 · البيئة: وكيل محلي · Volume/`data/uploads`  
**لا يُعلن نجاح إنتاجي لـ 1500MB** — النتائج أدناه محلية خلف نفس خادم Node.

## ملخص النتائج المطلوبة

| الحجم | اكتمل الرفع؟ | زمن الرفع | موارد (RSS قبل) | سليم وقابل للفتح؟ | باقٍ بعد إعادة تشغيل؟ | استئناف بعد قطع؟ |
|---:|---|---:|---:|---|---|---|
| 6MB (استئناف فقط) | نعم | ~49ms | — | نعم | — | **PASS** |
| **100MB** | **PASS** | 372ms | ~375MB | **PASS** | **PASS** | **PASS** (قطع بعد chunk واحد) |
| **500MB** | **PASS** | 1889ms | ~628MB | **PASS** | **PASS** | **NOT_TESTED** عند 500 (مثبت عند 6 و100) |
| **1000MB** | **PASS** | 4235ms | ~74→2078MB أثناء السلم | **PASS** | **PASS** (ضمن سلم سابق) | **NOT_TESTED** عند 1000 |
| **1500MB** | **PASS** | 7437ms | ~2078MB | **PASS** | **PASS** | **NOT_TESTED** عند 1500 |

PASS مجمّع للعمليات المفحوصة في الجولتين · FAIL: 0

## تفاصيل الجولة أ — استئناف + 100 + 500 (2026-10-12T16:07:14Z)

| الحجم (MB) | العملية | النتيجة | ملاحظة |
|---|---|---|---|
| — | staff_login | **PASS** | supreme_leader |
| 6 | interrupt_after_1_chunk | **PASS** | uploadId=upl-mv5g2g76-c0d5eb86561e |
| 6 | status_shows_missing | **PASS** | missing=2 |
| 6 | resume_complete | **PASS** | id=mv5g2g85-dc5326c45b04.bin;ms=49 |
| 6 | file_readable | **PASS** | bytes=6291456 |
| 100 | interrupt_after_1_chunk | **PASS** | uploadId=upl-mv5g2g9r-e8b99a1507e8 |
| 100 | status_shows_missing | **PASS** | missing=49 |
| 100 | resume_complete | **PASS** | id=mv5g2giy-b70b52de60bd.bin;ms=434 |
| 100 | file_readable | **PASS** | bytes=104857600 |
| 100 | chunked_upload_complete | **PASS** | ms=372;id=mv5g2h26-bd7864203c1e.bin |
| 100 | integrity_open | **PASS** | http=200;bytes=104857600 |
| 100 | after_restart_readable | **PASS** | http=200;bytes=104857600 |
| 500 | chunked_upload_complete | **PASS** | ms=1889;id=mv5g2ypf-c272aa94e10a.bin |
| 500 | integrity_open | **PASS** | http=200;bytes=524288000 |
| 500 | after_restart_readable | **PASS** | http=200;bytes=524288000 |

## تفاصيل الجولة ب — 1000 + 1500 (2026-10-12T16:02:16Z)

| الحجم (MB) | العملية | النتيجة | ملاحظة |
|---|---|---|---|
| 1000 | chunked_upload_complete | **PASS** | ms=4235;id=mv5fwesm-a38b3d68464b.bin |
| 1000 | integrity_open | **PASS** | http=200;bytes=1048576000 |
| 1500 | chunked_upload_complete | **PASS** | ms=7437;id=mv5fwm3x-6696e3a0996c.bin |
| 1500 | integrity_open | **PASS** | http=200;bytes=1572864000 |
| 1500 | persist_path | **PASS** | /workspace/data/uploads/mv5fwm3x-6696e3a0996c.bin |
| 1500 | after_restart_readable | **PASS** | http=200;bytes=1572864000 |

## ملاحظات وحدود
- الاستئناف: جلسات دائمة تحت `data/uploads/.chunk-sessions` + `PUT …/chunk` + `POST …/complete` + `GET …/status`.
- الملفات الكبيرة **لا** تُنسخ إلى PostgreSQL BYTEA (حد مرآة ~10MB)؛ المصدر الدائم Volume/القرص.
- قرص الوكيل: ~241GB متاح وقت الاختبار — كافٍ لـ 1500MB.
- **إنتاج Railway**: قد يفرض reverse-proxy/مهلة/حجم Volume حدودًا مختلفة — إعادة السلم على الإنتاج بعد النشر = **NOT_TESTED**.
- استئناف عند 500/1000/1500MB = **NOT_TESTED** (مثبت عند 6MB و100MB).
- السكربت: `scripts/e2e-resumable-upload-sizes.js`
