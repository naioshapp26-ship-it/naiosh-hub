# تقرير اختبار المرفقات الحقيقي — نايوش هوب 360

التاريخ: 2026-10-12T15:35:17.965Z
سجل الموظف الاختباري: `EMP-REAL-MV5EY3VE`
PASS: 27 · FAIL: 0 · NOT_TESTED: 2 · NOT_IMPLEMENTED: 1

| الوظيفة | العملية | رقم السجل | مكان الحفظ | النتيجة | ملاحظة |
|---|---|---|---|---|---|
| info_security_host | source_wired | — | js/hub-info-security.js | **PASS** |  |
| data_gov_host | source_wired | — | js/hub-data-governance.js | **PASS** |  |
| governance_contract_host | source_wired | — | js/hub-governance.js | **PASS** |  |
| governance_doc_host | source_wired | — | js/hub-governance.js | **PASS** |  |
| posha_req_host | source_wired | — | js/hub-posha-clients.js | **PASS** |  |
| employee_host | source_wired | — | js/hub-team-ops-forms.js | **PASS** |  |
| entity_types_extended | source_wired | — | lib/hub-entity-attachments.js | **PASS** |  |
| health_local | GET /api/health | — | 127.0.0.1:8875 | **PASS** | up |
| staff_login | POST /api/auth/login | naioshhub@example.com | staff-credentials | **PASS** | supreme_leader |
| upload_image | POST /uploads | mv5eyhjd-bd0f2c510f1e.bin | data/uploads | **PASS** | status=201;{"ok":true,"id":"mv5eyhjd-bd0f2c510f1e.bin","url":"/uploads/mv5eyhjd-bd0f2c510f1e.bin","name":"file","mime":"multipart/form-data","size":315 |
| upload_file | POST /uploads | mv5eyhjr-e79ab654f967.bin | data/uploads | **PASS** | status=201;{"ok":true,"id":"mv5eyhjr-e79ab654f967.bin","url":"/uploads/mv5eyhjr-e79ab654f967.bin","name":"file","mime":"multipart/form-data","size":294 |
| upload_video | POST /uploads | mv5eyhjt-fa91083cbb3d.bin | data/uploads | **PASS** | status=201;{"ok":true,"id":"mv5eyhjt-fa91083cbb3d.bin","url":"/uploads/mv5eyhjt-fa91083cbb3d.bin","name":"file","mime":"multipart/form-data","size":231 |
| link_image | POST /entity-attachments | EATT-000011 | entity-attachments | **PASS** | status=201; |
| link_file | POST /entity-attachments | EATT-000012 | entity-attachments | **PASS** | status=201; |
| link_video | POST /entity-attachments | EATT-000013 | entity-attachments | **PASS** | status=201; |
| reopen_list | GET entity-attachments | EMP-REAL-MV5EY3VE | entity-attachments | **PASS** | count=3 |
| content_download | GET …/content | EATT-000013 | uploads | **PASS** | bytes=2319;cat=video |
| content_download | GET …/content | EATT-000012 | uploads | **PASS** | bytes=294;cat=file |
| content_download | GET …/content | EATT-000011 | uploads | **PASS** | bytes=315;cat=image |
| after_relogin_list | GET entity-attachments | EMP-REAL-MV5EY3VE | entity-attachments | **PASS** | count=3 |
| authorized_staff_sees | GET as staff | EMP-REAL-MV5EY3VE | entity-attachments | **PASS** |  |
| isolation_customer_blocked | GET as customer | EMP-REAL-MV5EY3VE | entity-attachments | **PASS** | seen=0;status=401 |
| upload_fail_unauthorized | POST /uploads bad token | — | uploads | **PASS** | status=401 |
| retry_then_persist | upload+link after fail | EMP-REAL-MV5EY3VE | entity-attachments | **PASS** | count=4 |
| idempotent_no_duplicate | POST same Idempotency-Key | EATT-000011 | entity-attachments | **PASS** | {"reused":true,"id":"EATT-000011"} |
| large_video_8mb | POST /uploads | mv5eyhoh-777078d968d2.bin | data/uploads | **PASS** | bytes=8388608;ms=23;status=201;storage=/uploads/mv5eyhoh-777078d968d2.bin;err= |
| video_1500mb_real_upload | full 1500MB byte upload | — | object-storage / reverse-proxy | **NOT_TESTED** | Environment policy: do not stream 1.5GB in CI agent; resumable chunking across reverse-proxy NOT IMPLEMENTED without external object storage. Policy limit 1500M |
| resumable_chunked_upload | resume after disconnect | — | object-storage | **NOT_IMPLEMENTED** | Requires external object storage multipart; stream+retry from UI is live for connected uploads only. |
| prod_health | GET production /api/health | https://naiosh-hub-production.up.railway.app | railway | **PASS** | {"ok":true,"service":"naiosh-hub","env":"production","database":{"linked":true,"status":"connected","message":"قاعدة البيانات متصلة","ok":true,"tables":42,"hubO |
| prod_browser_journeys | client/staff/manager/unauthorized + mobile/dark | https://naiosh-hub-production.up.railway.app | production | **NOT_TESTED** | Requires deployed revision of this branch + dedicated test accounts on production; local lifecycle tests above cover API durability. Mark NOT_TESTED until relea |

## ملاحظات صريحة
- رفع صورة/ملف/فيديو + الربط بكيان موظف + إعادة الجلب بعد إعادة الدخول + العزل + عدم التكرار: مغطاة أعلاه.
- **1500MB فعليًا: NOT_TESTED** في هذه البيئة؛ تم فحص حد السياسة في الكود واختبار حجم عملي أصغر (`HUB_ATTACH_LARGE_MB`).
- **استئناف مجزأ بعد انقطاع: NOT_IMPLEMENTED** بدون Object Storage خارجي.
- **رحلات الإنتاج متعددة الأدوار/الجوال/الوضع الليلي: NOT_TESTED** حتى ينشر هذا الفرع على الإنتاج بحسابات اختبار.
