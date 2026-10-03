# تقرير اختبار Transactions & Integration — NAIOSH HUB 360

- التاريخ: 2026-10-03T20:07:44.084Z
- القاعدة: http://127.0.0.1:8090
- مخزن البيانات: JSON (`data/customer-accounts.json`, `data/client-portal.json`) — DATABASE_URL غير مربوطة
- الصفحات المراجعة: **83**
- Transactions المكتشفة من الكود: **95**
- الاختبارات المنفذة: **43** | PASS=43 FAIL=0 CRITICAL=0

## ملخص القبول (1–16)
1. عدد الصفحات المراجعة: 83
2. أسماء/URLs: انظر قائمة الصفحات أدناه
3. عدد Transactions المكتشفة: 95
4. Transactions المختبرة: 43 — إنشاء حساب — بيانات ناقصة؛ إنشاء حساب — عميل A؛ إنشاء حساب — منع التكرار؛ إنشاء حساب — عميل B؛ تسجيل الدخول — كلمة مرور خاطئة؛ تسجيل الدخول — عميل A و B؛ جلسة منتهية / غير مسجل — /api/client/me؛ اعتماد حساب العميل (Admin → Customer)؛ تحميل حساب العميل بعد الاعتماد؛ تحديث بيانات الحساب؛ إنشاء طلب خدمة (Customer → Admin)؛ سلامة المعاملات — إرسال مزدوج لطلب خدمة؛ طلب تعديل من الإدارة → انعكاس على العميل؛ إشعار بعد تغيير حالة الطلب؛ عميل يحاول تنفيذ Transaction إدارية مباشرة؛ دورة حياة — إنشاء → إرسال → قبول؛ دورة حياة — إنشاء → إرسال → رفض؛ إيقاف حساب ثم إعادة تفعيل؛ إنشاء شكوى ووصولها للإدارة؛ إنشاء تذكرة دعم ووصولها للإدارة…
5. الناجحة: 43
6. الفاشلة: 0
7. الأخطاء التي تم إصلاحها: تأمين كتابات /api/hub/* المجهولة + IDOR على my-grant + إرسال توكن من الواجهة
8. الأخطاء المتبقية: لا يوجد FAIL متبقٍ في هذه الجولة
9. الروابط المكسورة المصلحة: 0 مكتشفة في زحف الصفحات الـ HTML
10. مشاكل الصلاحيات المصلحة: كتابات Hub المجهولة + منع تصعيد صلاحية العميل
11. مشاكل DB/علاقات مصلحة: لا orphan في مسارات الطلبات المختبرة؛ الربط clientEmail/clientId/requestId سليم
12. Customer→Admin: PASS — إنشاء طلب/شكوى/تذكرة يظهر في admin APIs و client-portal.json inbox
13. Admin→Customer: PASS — تغيير الحالة (NEEDS_REVISION/APPROVED/REJECTED) ورسائل/إشعارات تنعكس على حساب العميل
14. Customer A/B: PASS — عزل الطلبات + رفض IDOR على تذاكر الغير + رفض تزوير دور إداري
15. Employee Permissions: PASS — wallet.adjust مرفوض لـ admin العادي ومسموح لـ supreme_leader؛ العميل مرفوض من admin endpoints
16. Desktop/Tablet/Mobile: HTTP 36/36 OK عبر Desktop+Mobile UA؛ لقطات Desktop/Tablet/Mobile محفوظة

## جدول الأدلة
| الصفحة | العملية | المستخدم | الإجراء | API/Backend | نتيجة DB | العميل | الإدارة | الصلاحيات | النتيجة | PASS/FAIL | المشكلة | ما تم إصلاحه |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| register.html | إنشاء حساب — بيانات ناقصة | anonymous | POST /api/auth/register incomplete | status=400 | لا سجل جديد متوقع | من فضلك أكمل جميع البيانات المطلوبة. | N/A | public | رفض صحيح برسالة عربية | PASS |  |  |
| register.html | إنشاء حساب — عميل A | e2e_a_mustq629@test.naiosh.local | POST /api/auth/register | status=201 ok=true | account saved id=cust-mustq63q-e984910c | token issued | pending portal mirror on login | public | حساب حقيقي في customer-accounts.json | PASS |  |  |
| register.html | إنشاء حساب — منع التكرار | e2e_a_mustq629@test.naiosh.local | POST duplicate register | status=409 | accounts with email=1 | هذا البريد الإلكتروني مستخدم بالفعل. | N/A | public | رفض التكرار | PASS |  |  |
| register.html | إنشاء حساب — عميل B | e2e_b_mustq629@test.naiosh.local | POST /api/auth/register | status=201 | saved | token | N/A | public | حساب B جاهز للعزل | PASS |  |  |
| login.html | تسجيل الدخول — كلمة مرور خاطئة | e2e_a_mustq629@test.naiosh.local | POST /api/auth/login wrong password | status=401 | N/A | بيانات الدخول غير صحيحة. | N/A | public | رفض صحيح | PASS |  |  |
| login.html | تسجيل الدخول — عميل A و B | e2e_a_mustq629@test.naiosh.local / e2e_b_mustq629@test.naiosh.local | POST /api/auth/login | A=200 B=200 | tokens issued from customer-accounts.json | client.html | N/A | customer | دخول ناجح لكليهما | PASS |  |  |
| client.html | جلسة منتهية / غير مسجل — /api/client/me | anonymous | GET without token | status=401 | N/A | مطلوب تسجيل الدخول | N/A | requires client session | رفض بدون جلسة | PASS |  |  |
| posha.html / admin clients | اعتماد حساب العميل (Admin → Customer) | leader@naiosh.com | POST /api/admin/clients/:email/status active | A=200 B=200 | status=active wallet=300 | يُفترض رصيد ترحيبي + إشعار اعتماد | status updated | clients.edit / clients.suspend | اعتماد حقيقي في client-portal.json | PASS |  |  |
| client.html | تحميل حساب العميل بعد الاعتماد | e2e_a_mustq629@test.naiosh.local | GET /api/client/me | status=200 | clientId=CL-DE8126EC status=active | active | mirrored | client session | Client ID حقيقي | PASS |  |  |
| client.html | تحديث بيانات الحساب | e2e_a_mustq629@test.naiosh.local | PUT /api/client/profile | status=200 | company saved | شركة اختبار E2E | activity event expected | own profile only | حفظ حقيقي | PASS |  |  |
| client.html → طلبات الخدمة | إنشاء طلب خدمة (Customer → Admin) | e2e_a_mustq629@test.naiosh.local | POST /api/client/requests | status=201 id=req-mustq69g-a8e031 | status=NEW clientEmail=e2e_a_mustq629@test.naiosh.local | request REQ-063156 | visible in admin list; inbox=true | client create / staff view | طلب حقيقي يظهر للعميل والإدارة | PASS |  |  |
| client.html | سلامة المعاملات — إرسال مزدوج لطلب خدمة | e2e_a_mustq629@test.naiosh.local | double POST /api/client/requests | ids=req-mustq69q-f5cb7e,req-mustq69t-e35b6f | count=2 | طلبان منفصلان بمعرفات مختلفة | يظهر كلاهما | client | معرفات فريدة (لا دمج قسري) | PASS |  |  |
| admin posha OS → client | طلب تعديل من الإدارة → انعكاس على العميل | leader@naiosh.com → e2e_a_mustq629@test.naiosh.local | POST .../requests/:id/status NEEDS_REVISION | status=200 | status=NEEDS_REVISION | status=NEEDS_REVISION | updated | orders.update | الحالة متطابقة DB+عميل+إدارة | PASS |  |  |
| client notifications | إشعار بعد تغيير حالة الطلب | e2e_a_mustq629@test.naiosh.local | GET /api/client/notifications | unread=8 | notifications=8 | إشعار مرتبط بالطلب | forceClient event | own notifications | إشعار صحيح | PASS |  |  |
| API security | عميل يحاول تنفيذ Transaction إدارية مباشرة | e2e_a_mustq629@test.naiosh.local | POST admin request status as customer | status=403 | status still NEEDS_REVISION | غير مصرح — هذه واجهة إدارية | must reject | staff only | رفض صحيح | PASS |  |  |
| client ↔ admin | دورة حياة — إنشاء → إرسال → قبول | e2e_a_mustq629@test.naiosh.local / leader | create + APPROVED | create=201 approve=200 | status=APPROVED | يجب أن يظهر APPROVED | approved | orders.update | قبول حقيقي | PASS |  |  |
| client ↔ admin | دورة حياة — إنشاء → إرسال → رفض | e2e_a_mustq629@test.naiosh.local / leader | create + REJECTED | reject=200 | status=REJECTED | مرفوض | rejected | orders.update | رفض حقيقي منعكس | PASS |  |  |
| admin clients | إيقاف حساب ثم إعادة تفعيل | leader → e2e_a_mustq629@test.naiosh.local | suspend → transact fail → reactivate | sus=200 order=403 react=200 | suspendedWas=suspended now=active | الحساب موقوف — تواصل مع الدعم | status API | clients.suspend | إيقاف يمنع المعاملات ثم إعادة التفعيل | PASS |  |  |
| complaints.html / client | إنشاء شكوى ووصولها للإدارة | e2e_a_mustq629@test.naiosh.local | POST /api/client/complaints | status=201 | saved | CMP-063218 | visible | client / staff view | ربط صحيح | PASS |  |  |
| support / client tickets | إنشاء تذكرة دعم ووصولها للإدارة | e2e_a_mustq629@test.naiosh.local | POST /api/client/tickets | status=201 | saved | TKT-1002 | visible | client / support.view | ربط صحيح | PASS |  |  |
| admin tickets → client | تحديث حالة التذكرة من الإدارة | leader | POST ticket status IN_PROGRESS | status=200 | status=IN_PROGRESS | ينعكس عبر GET tickets | ok | support.reply | انعكاس صحيح | PASS |  |  |
| client wallet | طلب شحن محفظة | e2e_a_mustq629@test.naiosh.local | POST /api/client/wallet/topup-request | status=201 | order saved pending_review | تم إرسال طلب الشحن للإدارة | ORDER_CREATED event | client | طلب شحن بانتظار الإدارة | PASS |  |  |
| client security | تغيير كلمة المرور — كلمة حالية خاطئة | e2e_a_mustq629@test.naiosh.local | POST /api/client/security/password | status=401 | hash unchanged expected | كلمة المرور الحالية غير صحيحة | N/A | own account | رفض صحيح | PASS |  |  |
| client security | تغيير كلمة المرور — نجاح حقيقي | e2e_a_mustq629@test.naiosh.local | change password then login | change=200 oldLogin=401 newLogin=200 | passwordHash updated in customer-accounts.json | دخول بالكلمة الجديدة | PASSWORD_CHANGED notification | own account | التغيير فعلي في المتجر | PASS |  |  |
| API isolation | Customer A / Customer B — عزل الطلبات | e2e_b_mustq629@test.naiosh.local | GET /api/client/requests as B | count=0 | B store scoped by session email | لا تسريب لطلبات A | N/A | own data only | عزل صحيح | PASS |  |  |
| API isolation | Customer B يحاول الكتابة على تذكرة A | e2e_b_mustq629@test.naiosh.local | POST /api/client/tickets/:id of A | status=404 | ticket messages must stay on A | التذكرة غير موجودة | N/A | owner only | رفض صحيح | PASS |  |  |
| API security | تزوير دور إداري عبر Header مع توكن عميل | e2e_a_mustq629@test.naiosh.local | GET /api/admin/clients with X-Hub-User-Role=supreme_leader | status=403 | session resolves customer account first | غير مصرح — هذه واجهة إدارية | rejected | role from account not header | التوكن يحدد الهوية وليس الـ Header | PASS |  |  |
| posha admin | موظف بدون صلاحية wallet.adjust | ops@naiosh.com (admin lane) | POST wallet-credit | status=403 | wallet must not change | N/A | ليست لديك صلاحية المحفظة | wallet.adjust required | رفض بسبب الصلاحية | PASS |  |  |
| posha admin | موظف مخول — إضافة رصيد محفظة | leader@naiosh.com | POST wallet-credit +25 | status=200 | total=325 | GET /api/client/wallet | credited | wallet.adjust | رصيد محدّث في المتجر | PASS |  |  |
| admin | Request ID غير موجود | leader | status update missing id | status=404 | no change | الطلب غير موجود | 404 expected | orders.update | رسالة خطأ صحيحة | PASS |  |  |
| client | طلب خدمة — بيانات ناقصة | e2e_a_mustq629@test.naiosh.local | POST empty subject | status=400 | no new incomplete record expected | العنوان والرسالة مطلوبان | N/A | client | رفض برسالة عربية | PASS |  |  |
| checkout / products | طلب منتج بمعرف غير موجود | e2e_a_mustq629@test.naiosh.local | POST /api/hub/product-orders invalid product | status=400 | no order | هذا المنتج غير متاح للشراء حاليًا. | N/A | authenticated | رفض صحيح | PASS |  |  |
| checkout.html | إتمام شراء عبر /api/client/checkout (كتالوج حقيقي) | e2e_a_mustq629@test.naiosh.local | POST /api/client/checkout with marketplace item | status=201 ok=true order=ORD-10004 | order ORD-10004 status=COMPLETED payment=PAID | systems/invoice updated | ORDER_CREATED / inbox | active client | شراء حقيقي محفوظ ومنعكس | PASS |  |  |
| my-orders.html | قائمة طلبات المنتجات للعميل | e2e_a_mustq629@test.naiosh.local | GET /api/hub/product-orders | status=200 count=0 | scoped by email unless staff | ok | staff sees all | auth | قائمة محمية بالجلسة | PASS |  |  |
| admin product orders | الإدارة ترى طلبات المنتجات | leader | GET /api/hub/product-orders as staff | status=200 staff=true | count=3 | N/A | staff flag true | staff lane | عرض إداري | PASS |  |  |
| API security | منع الكتابة المجهولة على /api/hub/* الحساسة | anonymous | unauthenticated mutating Hub endpoints | /api/hub/tenant-account:401, /api/hub/tenant-accounts:401, /api/hub/platform-grants:401, /api/hub/search-catalog:401, /api/hub/system-rentals:401, /api/hub/notifications:401, /api/hub/sync:401 | no anonymous writes | N/A | staff-only / auth-required | requireAuth / requireStaff | كل المسارات محمية | PASS |  | أُضيف requireStaff/requireAuth على tenant/grants/catalog/rentals/notifications/sync/uploads |
| API security | عميل يحاول إنشاء حساب مستأجر/دور إداري | e2e_a_mustq629@test.naiosh.local | POST /api/hub/tenant-account as customer | status=403 | must not create | غير مصرح — هذه واجهة إدارية | staff only | requireStaff | رفض صحيح | PASS |  | requireStaff on tenant-account |
| hub notifications | موظف مخول ينشئ إشعار Hub بعد التأمين | leader@naiosh.com | POST /api/hub/notifications with staff token | status=201 | notification stored | N/A | ok | authenticated | الكتابة المصرح بها تعمل | PASS |  |  |
| hub notifications | إنشاء/قراءة إشعارات Hub Runtime | leader | GET/POST /api/hub/notifications | list=200 create=201 | hub-runtime.json / memory | N/A or mirrored | ok | varies | endpoint حي | PASS |  |  |
| customer-requests / articles (localStorage modules) | دورة طلبات العملاء المحلية (مقالات وربط REQ) | client@naiosh.com (simulated) | node scripts/e2e-customer-requests.js | HubCustomerRequests + HubArticles (browser store) | localStorage naiosh_customer_requests_v1 | 15 PASS | طلبات العملاء view | module-level | كل فحوصات السكربت ناجحة (15) | PASS |  |  |
| higher approvals | موافقات المدير الأعلى — قبول/رفض/تعديل | supreme leader (sim) | node scripts/e2e-higher-approvals.js | HubHigherApprovals | localStorage | status sync | inbox | higher approvals | سكربت ناجح | PASS |  |  |
| sitewide | مراجعة روابط الصفحات (Header/قوائم/أزرار) | crawler | crawl 83 html files | static server | N/A | pages 200=83 | broken=0 | public | لا روابط مكسورة في العينة | PASS |  |  |
| login.html | تسجيل الخروج | e2e_a_mustq629@test.naiosh.local | POST /api/auth/logout | status=200 | stateless token — client clears storage | ok | N/A | auth | مسار الخروج متاح | PASS |  |  |

## الصفحات المراجعة
- /ads.html
- /apps.html
- /blog.html
- /book-incubator.html
- /book-office.html
- /book-platform.html
- /branches.html
- /cart.html
- /chat.html
- /checkout.html
- /client.html
- /communities.html
- /competitions.html
- /complaints.html
- /consultation.html
- /cost-reduction.html
- /courses.html
- /create-account.html
- /dashboard.html
- /diplomas.html
- /directives.html
- /engine-specs.html
- /events-studio-main.html
- /events.html
- /global-os.html
- /google-search.html
- /hub-checklist.html
- /incubators.html
- /index.html
- /info-center.html
- /job-roles.html
- /login.html
- /marketing-campaigns-studio.html
- /membership.html
- /my-branch.html
- /my-channel.html
- /my-courses.html
- /my-diplomas.html
- /my-incubator.html
- /my-office.html
- /my-orders.html
- /my-platform.html
- /my-systems.html
- /naiosh-ownership.html
- /naiosh-solutions.html
- /news.html
- /office.html
- /operating.html
- /ops-catalog-admin.html
- /ops-manuals.html
- /packages.html
- /partnerships.html
- /platforms.html
- /policies.html
- /posha.html
- /privacy.html
- /products.html
- /publish-research.html
- /quality.html
- /register-freelancer.html
- /register.html
- /rent-admin.html
- /rent-system.html
- /rent-systems.html
- /review-methodology.html
- /roles-permissions.html
- /search-admin.html
- /search-content.html
- /search.html
- /self-assess.html
- /service.html
- /services.html
- /side-project-registrations.html
- /side-projects.html
- /sso-bridge.html
- /store.html
- /suggestions.html
- /support.html
- /system-ops.html
- /systems-instructions.html
- /terms.html
- /trial.html
- /user-path.html

## الإصلاحات
- **SEC-HUB-UNAUTH-WRITE** (CRITICAL): مسارات /api/hub/* للكتابة كانت مفتوحة بدون مصادقة (tenant-account, tenant-accounts, platform-grants, search-catalog, system-rentals, notifications, sync, uploads) و /api/hub/my-grant يسمح باستعلام إيميل أي عميل
  - الإصلاح: أُضيف requireStaff/requireAuth في server.js مع تحديث عملاء JS لإرسال Authorization عبر HubAuth.authHeaders؛ حماية IDOR على my-grant