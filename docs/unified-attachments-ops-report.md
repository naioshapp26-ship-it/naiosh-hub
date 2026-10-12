# تقرير توحيد المرفقات — نايوش هوب 360

التاريخ: 2026-10-12T14:21:05.710Z
PASS: 14 · FAIL: 0

| الوظيفة | العملية | رقم السجل | مكان الحفظ | النتيجة | ملاحظة |
|---|---|---|---|---|---|
| health | GET /api/health | — | server | **PASS** | up |
| staff_login | POST /api/auth/login | naioshhub@example.com | staff-credentials | **PASS** | supreme_leader |
| component_multi_zones | HubFormAttachments blockHtml | — | js/hub-form-attachments.js | **PASS** | multi+persist |
| dashboard_loads_component | dashboard.html script | — | dashboard.html | **PASS** |  |
| employee_form_has_attach_host | hto-employee-attachments | — | hub-team-ops-forms.js | **PASS** | URL-only photo removed |
| upload_image | POST /uploads | mv5cb1oi-99c2c933ed56.png | data/uploads | **PASS** | {"ok":true,"id":"mv5cb1oi-99c2c933ed56.png","url":"/uploads/mv5cb1oi-99c2c933ed56.png","name":"emp-p |
| link_employee_attachment | POST /entity-attachments | EATT-000001 | entity-attachments.json | **PASS** |  |
| idempotent_no_duplicate | POST same key | EATT-000001 | entity-attachments | **PASS** | {"reused":true,"id":"EATT-000001"} |
| list_employee_attachments | GET entity-attachments | EMP-ATT-MV5CB1OL | entity-attachments.json | **PASS** | count=1 |
| content_download | GET …/content | EATT-000001 | uploads | **PASS** | bytes=70 |
| isolation_customer_no_staff_files | GET as customer | EMP-ATT-MV5CB1OL | entity-attachments | **PASS** | seen=0 |
| limit_1500mb_policy | HubUploadLimits.MAX_FILE_MB | 1500 | hub-upload-limits.js | **PASS** |  |
| staff_admin_has_attachments | sa-add-attachments | — | hub-staff-admin.js | **PASS** |  |
| workforce_has_attachments | wf-employee-attachments | — | hub-workforce.js | **PASS** |  |
