# تسليم إنتاج — إرسال نموذج + خريطة OSM

BASE: http://127.0.0.1:8921
PASS: 7 · FAIL: 1

| الفحص | النتيجة | دليل |
|---|---|---|
| geo/config OSM live | **PASS** | {"provider":"osm-leaflet","geocodeProvider":"nominatim","leafletEnabled":true} |
| reverse Nominatim | **PASS** | {"country":"الأردن","city":"عمان","provider":"nominatim"} |
| book-incubator geo UI + no catalog | **PASS** | {"geo":true,"branchSel":false,"leaflet":true,"mapReady":true} |
| map pick fills country/city | **PASS** | {"leaflet":true,"mapReady":true,"country":"الأردن","city":"عمان","lat":31.9539,"lng":35.9106} |
| form fields filled before submit | **PASS** | {"sector":"energy","subdomain":"osm-sub-5pnzy0","fullName":"عميل تسليم خريطة","incubator":"inc-001","incubatorDisabled":false,"incubatorOptions":81,"branch":"فرع تسليم حي — mv5pnzxv","country":"الأردن","feedback":""} |
| UI feedback after submit | **PASS** | {"feedback":"تم منح الحاضنة 1. التعليم والتعلم — التعليم والتحول الرقمي من خلال الفرع التابعة له وربطها بحاضنتي. افتح حاضنتي — حاضناتك فقط","feedbackOk":true,"feedbackErr":false,"invalid":[]} |
| browser submit saves branch+coords | **PASS** | {"status":201,"id":"pb-mv5po1cv-x1he3","branch":"فرع تسليم حي — mv5pnzxv","country":"الأردن","city":"عمان","lat":31.9539,"lng":35.9106,"source":"mixed"} |
| suite error | **FAIL** | fetch failed |

**ليس FULL PASS** — يوجد فشل.
