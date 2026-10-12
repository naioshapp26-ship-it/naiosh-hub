# جرد نماذج المرفقات — نايوش هوب 360

> **الجرد الشامل والتقرير التنفيذي انتقل إلى:**
> - `docs/unified-attachments-full-inventory.md` (118 نموذجًا)
> - `docs/unified-attachments-executive-summary.md`
> - `docs/unified-attachments-real-ops-report.md` (اختبار رفع حقيقي — ليس ظهور الحقول فقط)

## المكوّن الموحّد
- `js/hub-form-attachments.js` — عنوان **المرفقات** · رفع صورة / ملف / فيديو · متعدد · معاينة · إزالة · تقدم · إعادة محاولة
- `js/hub-upload-limits.js` — حد **1500 ميجابايت** للملف مع XHR progress
- `lib/hub-entity-attachments.js` + `POST/GET/DELETE /api/hub/entity-attachments` — ربط دائم بمالك السجل

## حد 1500MB (صراحة)
- حد السياسة في الكود: 1500MB
- رفع فعلي 1500MB: **NOT_TESTED**
- استئناف مجزأ: **NOT_IMPLEMENTED** بدون Object Storage
