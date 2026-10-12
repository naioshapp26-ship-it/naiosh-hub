# تقرير الرفع المجزأ والأحجام — نايوش هوب 360

التاريخ: 2026-10-12T16:02:16.839Z
السلم: 1000, 1500 MB
PASS: 13 · FAIL: 0 · NOT_TESTED: 0

| الحجم (MB) | العملية | النتيجة | ملاحظة |
|---|---|---|---|
| — | staff_login | **PASS** | supreme_leader |
| 6 | interrupt_after_1_chunk | **PASS** | uploadId=upl-mv5fwcny-3e42df8424a2 |
| 6 | status_shows_missing | **PASS** | missing=2 |
| 6 | resume_complete | **PASS** | id=mv5fwcoj-f66832eb7212.bin;ms=35 |
| 6 | file_readable | **PASS** | bytes=6291456 |
| 1000 | mem_before_rss_mb | **INFO** | 74 |
| 1000 | create_file | **PASS** | bytes=1048576000;path=/workspace/data/tmp-upload-probes/probe-1000mb.bin |
| 1000 | chunked_upload_complete | **PASS** | ms=4235;id=mv5fwesm-a38b3d68464b.bin;stage=complete;err= |
| 1000 | integrity_open | **PASS** | http=200;bytes=1048576000 |
| 1500 | mem_before_rss_mb | **INFO** | 2078 |
| 1500 | create_file | **PASS** | bytes=1572864000;path=/workspace/data/tmp-upload-probes/probe-1500mb.bin |
| 1500 | chunked_upload_complete | **PASS** | ms=7437;id=mv5fwm3x-6696e3a0996c.bin;stage=complete;err= |
| 1500 | integrity_open | **PASS** | http=200;bytes=1572864000 |
| 1500 | persist_path | **PASS** | /workspace/data/uploads/mv5fwm3x-6696e3a0996c.bin |
| 1500 | after_restart_readable | **PASS** | http=200;bytes=1572864000 |

## ملاحظات
- الاستئناف بعد انقطاع مُنفَّذ عبر جلسات `.chunk-sessions` + `/chunk` + `/complete`.
- الملفات الكبيرة لا تُنسخ إلى PostgreSQL BYTEA (حد 10MB للمرآة); المصدر الدائم هو مجلد الرفع / Volume.
- 1500MB يعتمد على مساحة القرص والمهلة والذاكرة؛ إن لم يُدرج في السلم يبقى NOT_TESTED.
