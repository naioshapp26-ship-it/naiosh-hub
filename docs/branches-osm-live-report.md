# تقرير اختبار حي — فروع + خريطة OSM/Leaflet

BASE: http://127.0.0.1:8920
PASS: 24 · FAIL: 0 · TOTAL الصفوف: 24

| الصفحة | الفحص | النتيجة | دليل |
|---|---|---|---|
| API | geo/config maps enabled (OSM or Google) | **PASS** | {"mapsEnabled":true,"provider":"osm-leaflet","geocodeProvider":"nominatim","leafletEnabled":true} |
| API | reverse geocode returns country/city | **PASS** | {"status":200,"provider":"nominatim","country":"الأردن","city":"عمان"} |
| branches.html | map interactive (desktop-light) | **PASS** | {"leaflet":true,"country":"الأردن","city":"عمان","mapReady":true} |
| branches.html | no catalog + geo UI (desktop-light) | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"fields":0,"leaflet":true,"google":false,"mapReady":true,"fallbackHidden":false,"fallbackText":""} |
| branches.html | no catalog + geo UI (mobile-light) | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"fields":0,"leaflet":true,"google":false,"mapReady":true,"fallbackHidden":false,"fallbackText":""} |
| branches.html | no catalog + geo UI (desktop-dark) | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"fields":0,"leaflet":true,"google":false,"mapReady":true,"fallbackHidden":false,"fallbackText":""} |
| book-incubator.html | map interactive (desktop-light) | **PASS** | {"leaflet":true,"country":"الأردن","city":"عمان","mapReady":true} |
| book-incubator.html | no catalog + geo UI (desktop-light) | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"fields":28,"leaflet":true,"google":false,"mapReady":true,"fallbackHidden":false,"fallbackText":""} |
| book-incubator.html | no catalog + geo UI (mobile-light) | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"fields":28,"leaflet":true,"google":false,"mapReady":true,"fallbackHidden":false,"fallbackText":""} |
| book-incubator.html | no catalog + geo UI (desktop-dark) | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"fields":28,"leaflet":true,"google":false,"mapReady":true,"fallbackHidden":false,"fallbackText":""} |
| book-platform.html | map interactive (desktop-light) | **PASS** | {"leaflet":true,"country":"الأردن","city":"عمان","mapReady":true} |
| book-platform.html | no catalog + geo UI (desktop-light) | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"fields":34,"leaflet":true,"google":false,"mapReady":true,"fallbackHidden":false,"fallbackText":""} |
| book-platform.html | no catalog + geo UI (mobile-light) | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"fields":34,"leaflet":true,"google":false,"mapReady":true,"fallbackHidden":false,"fallbackText":""} |
| book-platform.html | no catalog + geo UI (desktop-dark) | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"fields":34,"leaflet":true,"google":false,"mapReady":true,"fallbackHidden":false,"fallbackText":""} |
| book-office.html | map interactive (desktop-light) | **PASS** | {"leaflet":true,"country":"الأردن","city":"عمان","mapReady":true} |
| book-office.html | no catalog + geo UI (desktop-light) | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"fields":29,"leaflet":true,"google":false,"mapReady":true,"fallbackHidden":false,"fallbackText":""} |
| book-office.html | no catalog + geo UI (mobile-light) | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"fields":29,"leaflet":true,"google":false,"mapReady":true,"fallbackHidden":false,"fallbackText":""} |
| book-office.html | no catalog + geo UI (desktop-dark) | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"fields":29,"leaflet":true,"google":false,"mapReady":true,"fallbackHidden":false,"fallbackText":""} |
| register.html | map interactive (desktop-light) | **PASS** | {"leaflet":true,"country":"الأردن","city":"عمان","mapReady":true} |
| register.html | no catalog + geo UI (desktop-light) | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"fields":27,"leaflet":true,"google":false,"mapReady":true,"fallbackHidden":false,"fallbackText":""} |
| register.html | no catalog + geo UI (mobile-light) | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"fields":27,"leaflet":true,"google":false,"mapReady":true,"fallbackHidden":false,"fallbackText":""} |
| register.html | no catalog + geo UI (desktop-dark) | **PASS** | {"geo":true,"branchSel":false,"countrySel":false,"fields":27,"leaflet":true,"google":false,"mapReady":true,"fallbackHidden":false,"fallbackText":""} |
| API | حفظ حجز بفرع+إحداثيات | **PASS** | {"status":201,"id":"pb-mv5oximx-9f46e","branch":"فرع حفظ حي — mv5oximt","lat":31.9539} |
| API | إعادة فتح/استجابة الحفظ تحتوي الإحداثيات | **PASS** | {"lat":31.9539,"lng":35.9106,"source":"map"} |

اختبارات هذه الجولة نجحت. FULL PASS للمنصة فقط إذا شملت كل النماذج الإدارية المطلوبة على الإنتاج أيضًا.
