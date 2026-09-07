/**
 * المدونة العامة — تعرض المقالات المنشورة من تشغيل الأنظمة.
 */
(() => {
  'use strict';

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return String(iso).slice(0, 10);
    }
  };

  const fallbackCards = () => `
        <article class="hub-feature-card hub-feature-card--featured">
          <div class="hub-feature-card-top">
            <span class="hub-feature-icon"><i class="fas fa-code-branch"></i></span>
            <h3>شغّل فرعك خلال 24 ساعة</h3>
          </div>
          <p>NAIOSH ID · باقة التشغيل · ربط الإعلانات والمنتجات · مراقبة من غرفة العمليات.</p>
          <div class="hub-feature-actions">
            <a class="btn btn-primary" href="branches.html">الفروع</a>
            <a class="btn btn-secondary" href="packages.html">الباقات</a>
          </div>
        </article>
        <article class="hub-feature-card">
          <div class="hub-feature-card-top">
            <span class="hub-feature-icon"><i class="fas fa-coins"></i></span>
            <h3>اقتصاد النقاط</h3>
          </div>
          <p>لماذا يبدأ كل حساب بـ 300 نقطة مجانية، وكيف تربط الشحن بالمحفظة داخل هوب.</p>
          <div class="hub-feature-actions">
            <a class="btn btn-primary" href="index.html#charge">إشحن من الرئيسية</a>
            <a class="btn btn-secondary" href="membership.html">العضوية</a>
          </div>
        </article>
        <article class="hub-feature-card">
          <div class="hub-feature-card-top">
            <span class="hub-feature-icon"><i class="fas fa-comments"></i></span>
            <h3>الدردشة الداخلية للفرق</h3>
          </div>
          <p>تنسيق لحظي بين الفروع والدعم وغرفة العمليات — داخل قناة تشغيل واحدةة.</p>
          <div class="hub-feature-actions">
            <a class="btn btn-primary" href="chat.html">افتح الدردشة</a>
          </div>
        </article>
        <article class="hub-feature-card">
          <div class="hub-feature-card-top">
            <span class="hub-feature-icon"><i class="fas fa-layer-group"></i></span>
            <h3>خريطة المنصات الـ 18</h3>
          </div>
          <p>من الدماغ المركزي إلى السلطة العليا — ماذا تعني كل منصة لتشغيل الإمبراطورية.</p>
          <div class="hub-feature-actions">
            <a class="btn btn-primary" href="platforms.html">المنصات</a>
            <a class="btn btn-secondary" href="info-center.html">مركز المعلومات</a>
          </div>
        </article>`;

  const renderAttachments = (files) => {
    if (!Array.isArray(files) || !files.length) return '';
    return `<div class="hub-feature-actions" style="margin-top:10px;flex-wrap:wrap;gap:8px">
      ${files
        .map((f) => {
          const label = esc(f.name || 'مرفق');
          if (f.url) {
            return `<a class="btn btn-secondary" href="${esc(f.url)}" target="_blank" rel="noopener"><i class="fas fa-paperclip"></i> ${label}</a>`;
          }
          return `<span class="btn btn-secondary" style="pointer-events:none">${label}</span>`;
        })
        .join('')}
    </div>`;
  };

  const renderPost = (post, index) => {
    const featured = index === 0 ? ' hub-feature-card--featured' : '';
    const body = esc(post.body || 'بدون محتوى تفصيلي');
    const title = esc(post.title || 'مقال');
    const meta = [post.systemCode, formatDate(post.at)].filter(Boolean).join(' · ');
    return `<article class="hub-feature-card${featured}" data-blog-id="${esc(post.id || '')}">
      <div class="hub-feature-card-top">
        <span class="hub-feature-icon"><i class="fas fa-newspaper"></i></span>
        <h3>${title}</h3>
      </div>
      <p>${body}</p>
      <small style="display:block;margin-top:8px;color:#6b7280;font-weight:700">${esc(meta)}</small>
      ${renderAttachments(post.attachments)}
      <div class="hub-feature-actions" style="margin-top:12px">
        <a class="btn btn-primary" href="operating.html">آلية التشغيل</a>
        <a class="btn btn-secondary" href="system-ops.html?tab=blog">تشغيل الأنظمة</a>
      </div>
    </article>`;
  };

  const paint = () => {
    const grid = document.querySelector('[data-blog-posts]');
    if (!grid) return;
    const posts =
      typeof window.HubSystemOps?.listPublishedPosts === 'function'
        ? window.HubSystemOps.listPublishedPosts(40)
        : window.HubSystemOps?.read?.()?.blogPosts || [];

    const publishCta = document.querySelector('[data-blog-publish-cta]');
    if (publishCta) {
      publishCta.hidden = false;
    }

    if (!posts.length) {
      grid.innerHTML =
        fallbackCards() +
        `<aside class="hub-feature-purpose" style="grid-column:1/-1;margin-top:8px">
          <span class="hub-feature-purpose-mark"><i class="fas fa-pen-to-square"></i></span>
          <div>
            <strong>لم يُنشر مقال بعد من لوحة التشغيل</strong>
            <p>ارفع مقالك من <a href="system-ops.html?tab=blog">تشغيل الأنظمة ← المدونة</a> وسيظهر هنا فورًا.</p>
          </div>
        </aside>`;
      return;
    }

    grid.innerHTML = posts.map(renderPost).join('');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', paint, { once: true });
  } else {
    paint();
  }

  window.HubBlog = { paint };
})();
