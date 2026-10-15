# تقرير الإنتاج — تأكيد استئجار + شارة الموافقات

BASE: https://naiosh-hub-production.up.railway.app
at: 2026-10-15T01:48:17.902Z
patched: **false**
verdict: **FAIL_OR_PARTIAL_RENTAL_CONFIRM_BADGE_PROD**
fullPass: false

PASS 14 · FAIL 6 · NOT TESTED 0

| الاختبار | النتيجة | تفاصيل |
|---|---|---|
| prod_assets_v7 | PASS | v=7 + ha-badge1 |
| leader_login | PASS | https://naiosh-hub-production.up.railway.app/dashboard.html#overview |
| badge_before | PASS | badge=21 kpi=21 |
| rental_created | PASS | APR-2026-00045 · rent-mv8vbz9t-c84ea3 ·  |
| server_impact_no_undefined | PASS | {"impactIfApproved":"سيتم تفعيل إيجار النظام «CRM» للعميل «عميل تجريبي mv8vbz8k-0».","requestedDisplay":"تفعيل: CRM · خطة: Basic (مجاني)","systemLabel":"CRM","requesterName":"عميل تجريبي mv8vbz8k-0","subjectName":"CRM"} |
| modal_impact_no_undefined | PASS | سيتم تفعيل إيجار النظام «CRM» للعميل «عميل تجريبي mv8vbz8k-0». |
| modal_noop_deployed | PASS | {"impact":"سيتم تفعيل إيجار النظام «CRM» للعميل «عميل تجريبي mv8vbz8k-0».","noop":true,"stopProp":false,"confirmLabel":"تأكيد الموافقة وتنفيذ العملية"} |
| confirm_real_click | FAIL | فشل الحفظ الدائم للموافقات: deadlock detected |
| double_click_guard | PASS | posts=1 |
| rental_origin_activated | PASS | {"status":"active","statusLabel":"مقبول ومفعّل"} |
| relogin | PASS |  |
| postgres_durable | PASS | {"status":"approved","decidedBy":"القائد الأعلى","decidedAt":"2026-10-15T01:39:46.505Z"} |
| badge_decreased | PASS | kpi 21→20 badge→20 |
| ui_reject | FAIL | no decide |
| ui_revise | FAIL | no revise button |
| ui_refer | FAIL | no refer button |
| refer_not_counted_for_leader | FAIL | beforeCreateDecide≈21 afterRefer=22 (expect not higher than before+0 if refer cleared the new one) |
| awaiting_excludes_referred | FAIL | {"pending":22,"awaitingDecision":22,"underReview":3,"approved":8,"rejected":14,"needsRevision":0,"referred":4,"all":48} |
| no_fake_success | PASS | لا يمكن الموافقة على هذا الطلب في حالته الحالية |
| disposable_only | PASS | decided APR-2026-00045, undefined, undefined, APR-2026-00048 |
