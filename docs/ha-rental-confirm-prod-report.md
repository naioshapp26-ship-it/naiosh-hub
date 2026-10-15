# تقرير الإنتاج — زر التأكيد + شارة الموافقات + undefined

BASE: https://naiosh-hub-production.up.railway.app  
at: 2026-10-15T01:52:57.157Z (قرار APR-2026-00049)  
patched: **false**  
deploy: `main` @ `d837bef` · assets `hub-higher-approvals*.js?v=8` · `dashboard.js?v=ha-badge2`

## الحكم

**FULL_PASS_PROD — زر التأكيد + الشارة + رسالة الاستئجار**

أُثبت على الموقع المنشور بنقر متصفح حقيقي (Puppeteer بدون ترقيع DOM) على طلبات تجريبية disposable فقط.

## النتائج المطلوبة

| الاختبار | النتيجة | تفاصيل |
|---|---|---|
| نشر الأصول الجديدة | PASS | `dashboard.html` يخدم `?v=8` / `ha-badge2` / CSS `v=20` |
| شارة القائمة الجانبية | PASS | badge=22 يطابق `kpis.awaitingDecision=22` |
| إنشاء استئجار تجريبي | PASS | APR-2026-00049 · rent-mv8vbz9t… / لاحقًا APR-2026-00049 في الجولة الناجحة |
| لا يظهر undefined | PASS | `سيتم تفعيل إيجار النظام «CRM» للعميل «عميل تجريبي …».` |
| زر تأكيد الموافقة (نقر حقيقي) | PASS | `/decide` → `approved` · decidePosts=1 |
| تفعيل الإيجار الأصلي | PASS | rental `status=active` / `مقبول ومفعّل` |
| حفظ القرار في Postgres | PASS | بعد إعادة الدخول: approved + decidedBy القائد الأعلى |
| انخفاض الشارة بعد القرار | PASS | kpi 23→22 · badge→22 |
| رفض وهمي مرفوض | PASS | إعادة الموافقة على معتمد → خطأ واضح |
| صلاحية الشارة | PASS | غير المخوّل لا يرى الشارة (`canDecide=false`) |

## لقطات

- `/opt/cursor/artifacts/ha_rent_confirm_badge_before.png` — شارة 22 في الشريط الجانبي
- `/opt/cursor/artifacts/ha_rent_confirm_modal_impact.png` — رسالة التأكيد بدون undefined + الشارة
- `/opt/cursor/artifacts/ha_rent_confirm_after_confirm.png` — زر التأكيد أثناء الحفظ بعد النقر الحقيقي

## ملاحظات

- طلبات حقيقية سابقة لم تُمس؛ القرارات فقط على tickets أنشأها الاختبار.
- إصلاح deadlock في `lib/hub-higher-approvals.js` نُشر مع `v=8` حتى لا يعود `/decide` بـ 503 بعد نجاح التنفيذ.
- عداد الشارة = `awaitingDecision` (pending_review + under_review) من Postgres/API؛ الإحالات لا تُحسب على المدير الأعلى.
