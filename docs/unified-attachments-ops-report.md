# تقرير توحيد المرفقات — نايوش هوب 360

التاريخ: 2026-10-12T14:26:58.938Z
PASS: 18 · FAIL: 0

| الوظيفة | العملية | رقم السجل | مكان الحفظ | النتيجة | ملاحظة |
|---|---|---|---|---|---|
| health | GET /api/health | — | server | **PASS** | up |
| staff_login | POST /api/auth/login | naioshhub@example.com | staff-credentials | **PASS** | supreme_leader |
| component_multi_zones | HubFormAttachments blockHtml | — | js/hub-form-attachments.js | **PASS** | multi+persist |
| dashboard_loads_component | dashboard.html script | — | dashboard.html | **PASS** |  |
| employee_form_has_attach_host | hto-employee-attachments | — | hub-team-ops-forms.js | **PASS** | URL-only photo removed |
| upload_image | POST /uploads | mv5cim52-bcbbbf34f938.png | data/uploads | **PASS** | {"ok":true,"id":"mv5cim52-bcbbbf34f938.png","url":"/uploads/mv5cim52-bcbbbf34f938.png","name":"emp-p |
| link_employee_attachment | POST /entity-attachments | EATT-000002 | entity-attachments.json | **PASS** |  |
| idempotent_no_duplicate | POST same key | EATT-000002 | entity-attachments | **PASS** | {"reused":true,"id":"EATT-000002"} |
| list_employee_attachments | GET entity-attachments | EMP-ATT-MV5CIM57 | entity-attachments.json | **PASS** | count=1 |
| content_download | GET …/content | EATT-000002 | uploads | **PASS** | bytes=70 |
| isolation_customer_no_staff_files | GET as customer | EMP-ATT-MV5CIM57 | entity-attachments | **PASS** | seen=0 |
| limit_1500mb_policy | HubUploadLimits.MAX_FILE_MB | 1500 | hub-upload-limits.js | **PASS** |  |
| staff_admin_has_attachments | sa-add-attachments | — | hub-staff-admin.js | **PASS** |  |
| workforce_has_attachments | wf-employee-attachments | — | hub-workforce.js | **PASS** |  |
| solutions_wizard_attachments | so-wizard-attachments + persistToEntity | — | hub-solutions-ui.js | **PASS** |  |
| solutions_pages_load_component | hub-form-attachments.js | — | naiosh-solutions.html + cost-reduction.html | **PASS** |  |
| identity_form_attachments | idn-user-attachments + persist | — | hub-identity-ui.js | **PASS** |  |
| clients_form_attachments | cl-attachments + persist | — | hub-clients-workspaces.js | **PASS** |  |
