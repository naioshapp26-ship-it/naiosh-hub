# تقرير تشغيل استوديو التسويق والفعاليات

التاريخ: 2026-10-11T21:52:11.312Z
الأساس: http://127.0.0.1:8870

PASS: 41 · FAIL: 0 (API 33 + UI 8)

## التكاملات

### متصلة فعليًا
- website (internal)
- inapp (internal)
- ffmpeg reel processor
- hub uploads / media library

### تحتاج ربطًا خارجيًا / موافقات
- Instagram
- Facebook
- YouTube
- TikTok
- LinkedIn
- X
- WhatsApp
- Google
- email SMTP publish

## جدول الوظائف

| الوظيفة | العملية | رقم السجل | مكان الحفظ | النتيجة | ملاحظة |
|---|---|---|---|---|---|
| health | GET /api/health | — | server | **PASS** | up |
| staff_login | POST /api/auth/login | naioshhub@example.com | staff-credentials | **PASS** | supreme_leader |
| reels_capabilities | ffmpeg available | — | server | **PASS** | {"ok":true,"ffmpeg":true,"maxDurationSec":90,"aspects":["9:16","1:1","16:9"],"aiFeatures":{"autoCaptions":false,"voiceOv |
| create_campaign | POST /marketing-campaigns | CMP-2026-000003 | data/marketing-campaigns.json | **PASS** |  |
| upload_image | POST /uploads | mv4czrxu-3b8d1ef61b38.png | data/uploads + hub_upload_blobs | **PASS** | {"ok":true,"id":"mv4czrxu-3b8d1ef61b38.png","url":"/uploads/mv4czrxu-3b8d1ef61b38.png","name":"sample.png","mime":"image |
| upload_video | POST /uploads | mv4czry0-bdf00fcc5ddb.mp4 | data/uploads + hub_upload_blobs | **PASS** | {"ok":true,"id":"mv4czry0-bdf00fcc5ddb.mp4","url":"/uploads/mv4czry0-bdf00fcc5ddb.mp4","name":"sample-source.mp4","mime" |
| media_library_image | POST /media | MED-000010 | data/hub-media-library.json | **PASS** |  |
| media_library_video | POST /media | MED-000011 | data/hub-media-library.json | **PASS** |  |
| create_ad_content | POST …/contents | CNT-2026-000003 | marketing-campaigns.json | **PASS** |  |
| process_reel_ffmpeg | POST /reels/process | MED-000012 | uploads + hub-media-library | **PASS** |  |
| reel_file_on_disk | fs.exists | mv4czrzt-31e02ca5cdfe.mp4 | data/uploads | **PASS** | /workspace/data/uploads/mv4czrzt-31e02ca5cdfe.mp4 |
| link_reel_to_campaign | POST …/clips | CLIP-2026-000003 | marketing-campaigns.json | **PASS** |  |
| create_event | POST /events | EVT-2026-00003 | data/hub-events.json | **PASS** |  |
| link_campaign_to_event | PUT campaign.links | CMP-2026-000003 | marketing-campaigns.json | **PASS** | [{"id":"lnk-1-20f2","kind":"event","refId":"EVT-2026-00003","label":"فعالية EVT-2026-00003","url":"events.html#event=EVT |
| catalog_live_events | GET catalogs includes EVT-* | EVT-2026-00003 | hub-events.json → catalogs | **PASS** | count=3 |
| reverse_link_event_to_campaign | event.linkedCampaignIds | EVT-2026-00003 | hub-events.json | **PASS** | ["CMP-2026-000003"] |
| submit_campaign_review | action=submit | CMP-REQ-2026-000003 | marketing-campaigns.requests | **PASS** | pending_review |
| submit_event_review | action=submit | EVT-REQ-2026-00003 | hub-events.requests | **PASS** | pending_review |
| campaign_in_client_requests_api | GET /marketing-campaigns/requests | CMP-REQ-2026-000003 | POSHA ingest source | **PASS** | items=3 |
| event_in_client_requests_api | GET /events/requests | EVT-REQ-2026-00003 | POSHA ingest source | **PASS** | items=3 |
| approve_campaign | action=approve | CMP-2026-000003 | marketing-campaigns.json | **PASS** | approved |
| approve_publish_event | action=approve/publish | EVT-2026-00003 | hub-events.json | **PASS** | published |
| schedule_campaign | action=schedule_campaign | CMP-2026-000003 | marketing-campaigns.json | **PASS** | scheduled |
| publish_internal_website | POST …/publish website | PUB-2026-000007 | publications[] | **PASS** | {"id":"PUB-2026-000007","platform":"website","platformLabel":"الموقع","mode":"internal","connected":true,"status":"publi |
| publish_disconnected_no_fake_success | POST …/publish instagram | PUB-2026-000008 | publications[] | **PASS** | {"id":"PUB-2026-000008","platform":"instagram","platformLabel":"Instagram","mode":"manual","connected":false,"status":"e |
| publish_manual_url_logged | POST …/publish with url | PUB-2026-000009 | publications[] | **PASS** | https://instagram.com/p/test-ops |
| persist_after_reauth | GET campaign+event | CMP-2026-000003 | json stores | **PASS** | camp=active ev=published |
| customer_a_login | register+login | studio.a.mv4czc4t@naiosh-test.com | customer-accounts | **PASS** |  |
| customer_b_login | register+login | studio.b.mv4czc4t@naiosh-test.com | customer-accounts | **PASS** |  |
| media_isolation_two_clients | GET /media as B | — | hub-media-library.json | **PASS** | B sees 0 items |
| reel_error_missing_source | POST /reels/process | — | reel-processor | **PASS** | ملف المصدر غير موجود على القرص — ارفع الفيديو أولاً |
| studio_pages_load | GET html shells | — | static | **PASS** | mcs=200 ev=200 |
| idempotent_resubmit_safe | action=submit twice | CMP-2026-000003 | marketing-campaigns.json | **PASS** | لا يمكن نقل الحالة من نشطة إلى بانتظار المراجعة |

## اختبار الواجهة (متصفح)

| الوظيفة | العملية | رقم السجل | مكان الحفظ | النتيجة | ملاحظة |
|---|---|---|---|---|---|
| marketing_studio_desktop | تحميل RTL بعرض كامل + تبويبات | — | marketing-campaigns-studio.html | **PASS** | لقطة marketing-studio-desktop.webp |
| marketing_reels_tab | data-sec=reels + alias clipmaker | — | js/hub-marketing-campaigns.js | **PASS** | hash #section=reels · ffmpeg UI |
| marketing_publish_tab | data-sec=publish | — | js/hub-marketing-campaigns.js | **PASS** | قنوات داخلية + تصدير يدوي |
| events_studio_desktop | تحميل RTL بعرض كامل | — | events.html | **PASS** | لقطة events-studio-desktop.webp |
| events_clipmaker_tab | data-sec=clipmaker | — | js/hub-events-studio.js | **PASS** | صانع المقاطع الحقيقي |
| events_videos_tab | data-sec=videos | — | js/hub-events-studio.js | **PASS** | مكتبة الفيديو |
| events_mobile_390 | عرض هاتف 390×844 | — | events.html | **PASS** | لقطة events-studio-mobile.webp |
| marketing_back_public | رجوع العامة للرئيسية | — | heroBackHtml | **PASS** | ليس لوحة القائد عند دخول عام |

