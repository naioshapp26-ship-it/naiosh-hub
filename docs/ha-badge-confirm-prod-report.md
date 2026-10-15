# تقرير الإنتاج — شارة الموافقات + زر التأكيد

BASE: https://naiosh-hub-production.up.railway.app
at: 2026-10-15T01:34:52.605Z
patched: **false**
verdict: **FAIL_BADGE_CONFIRM_PROD**
fullPass: false

PASS 10 · FAIL 8 · NOT TESTED 1

| الاختبار | النتيجة | تفاصيل |
|---|---|---|
| prod_assets_v7 | PASS | dashboard.html serves v=7 / ha-badge1 / css v=19 |
| leader_login | PASS | https://naiosh-hub-production.up.railway.app/dashboard.html#overview |
| badge_visible_matches_kpi | PASS | badge=16 kpi=16 href=#rent-admin?new=1 hot=true |
| badge_nav_opens_new_first | PASS | #rent-admin?new=1 |
| rental_create_disposable | FAIL |  ·  · {"ok":false,"error":"فشل الحفظ الدائم للموافقات: deadlock detected","code":"DURABLE_PERSIST_FAILED"} |
| rental_impact_no_undefined | FAIL | no approval id |
| modal_uses_noop_not_stopprop | FAIL | {} |
| confirm_approve_real_click | FAIL | skipped |
| confirm_double_click_guard | PASS | decidePosts=undefined |
| rental_origin_activated | NOT TESTED | no rentalId |
| badge_decreases_after_decide | FAIL | before kpi=17 badge=17 → after kpi=17 badge=17 |
| ui_reject | PASS | rejected |
| ui_revise | FAIL | under_review |
| ui_refer | FAIL | ha-open missing |
| refer_drops_from_leader_count | FAIL | before=19 after=19 referred=4 |
| badge_dark_theme | PASS | count=19 |
| badge_mobile | PASS | count=19 |
| staff_no_ha_badge | PASS | canDecide=false badge=(none) role check |
| existing_rows_untouched_policy | PASS | only disposable tickets created by this script were decided |
