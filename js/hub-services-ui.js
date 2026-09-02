/**
 * واجهة خدماتنا: الشبكة + إضافة خدمة برابط وملف وصورة وفيديو.
 */
(() => {
  'use strict';

  const api = window.HubServicesCatalog;
  if (!api) return;

  const esc = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const grid = document.querySelector('[data-ns-grid]');
  const dialog = document.querySelector('[data-ns-dialog]');
  const form = document.querySelector('[data-ns-form]');
  const feedback = document.querySelector('[data-ns-feedback]');
  const countEl = document.querySelector('[data-ns-count]');
  const openBtns = document.querySelectorAll('[data-ns-open]');
  const closeBtns = document.querySelectorAll('[data-ns-close]');

  const showFeedback = (msg, isError = false) => {
    if (!feedback) return;
    feedback.hidden = false;
    feedback.textContent = msg;
    feedback.style.background = isError ? '#fef2f2' : '#ecfdf5';
    feedback.style.color = isError ? '#991b1b' : '#065f46';
  };

  const storedMedia = () => window.HubFormAttachments?.toStored?.(window.HubFormAttachments.collect(form)) || {};

  const renderGrid = () => {
    if (!grid) return;
    const items = api.list();
    if (countEl) countEl.textContent = `+${items.length} خدمة`;
    grid.innerHTML = items
      .map((svc) => {
        const media = svc.imageUrl
          ? `<span class="ns-card-media"><img src="${esc(svc.imageUrl)}" alt="" /></span>`
          : svc.videoUrl
            ? `<span class="ns-card-media"><video src="${esc(svc.videoUrl)}" muted></video></span>`
            : `<span class="ns-card-icon"><i class="fas ${esc(svc.icon)}"></i></span>`;
        const del = svc.custom
          ? `<button type="button" class="ns-card-del" data-ns-del="${esc(svc.id)}" aria-label="حذف الخدمة"><i class="fas fa-xmark"></i></button>`
          : '';
        return `<a class="ns-card" href="${esc(svc.href)}" data-ns-id="${esc(svc.id)}">
          ${del}
          ${media}
          <strong>${esc(svc.title)}</strong>
          <p class="ns-card-lead">${esc(svc.description)}</p>
          <span class="ns-card-arrows" aria-hidden="true"><i class="fas fa-chevron-right"></i><i class="fas fa-chevron-left"></i></span>
        </a>`;
      })
      .join('');
  };

  const openDialog = () => {
    form?.reset();
    window.HubFormAttachments?.reset?.(form);
    if (feedback) feedback.hidden = true;
    dialog?.showModal();
  };

  const closeDialog = () => dialog?.close();

  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog();
  });

  openBtns.forEach((btn) => btn.addEventListener('click', openDialog));
  closeBtns.forEach((btn) => btn.addEventListener('click', closeDialog));

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const media = storedMedia();
    const result = api.add({
      title: data.get('title'),
      description: data.get('description'),
      icon: data.get('icon') || 'fa-concierge-bell',
      linkUrl: media.attachLink,
      docUrl: media.attachDocUrl,
      docName: media.attachDocName,
      imageUrl: media.attachImageUrl,
      videoUrl: media.attachVideoUrl,
    });
    if (!result.ok) {
      showFeedback(result.error || 'تعذر إضافة الخدمة', true);
      return;
    }
    closeDialog();
    renderGrid();
  });

  grid?.addEventListener('click', (event) => {
    const del = event.target.closest('[data-ns-del]');
    if (!del) return;
    event.preventDefault();
    event.stopPropagation();
    if (!confirm('حذف هذه الخدمة؟')) return;
    api.remove(del.getAttribute('data-ns-del'));
    renderGrid();
  });

  const bindRequestForm = (root, svc) => {
    const reqForm = root.querySelector('[data-service-request]');
    if (!reqForm) return;
    window.HubFormAttachments?.bind?.(reqForm);
    reqForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!reqForm.checkValidity()) {
        reqForm.reportValidity();
        return;
      }
      const data = new FormData(reqForm);
      const stored = window.HubFormAttachments?.toStored?.(window.HubFormAttachments.collect(reqForm)) || {};
      const item = window.HubServiceRequests?.create?.({
        kind: 'consultation',
        title: data.get('title'),
        body: data.get('body'),
        system: 'HUB',
        category: 'خدمة',
        fullName: data.get('fullName'),
        phone: data.get('phone'),
        email: data.get('email'),
        serviceId: svc.id,
        serviceTitle: svc.title,
        ...stored,
      });
      const box = root.querySelector('[data-service-request-feedback]');
      if (!item) {
        if (box) {
          box.hidden = false;
          box.textContent = 'أدخل عنوانًا واضحًا للطلب';
          box.style.background = '#fef2f2';
          box.style.color = '#991b1b';
        }
        return;
      }
      if (box) {
        box.hidden = false;
        box.textContent = 'تم استلام طلبك وربطه بالنظام. فريق هوب بيتابعه من غرفة العمليات.';
        box.style.background = '#ecfdf5';
        box.style.color = '#065f46';
      }
      reqForm.reset();
      window.HubFormAttachments?.reset?.(reqForm);
    });
  };

  const extraMedia = (svc) => {
    const bits = [];
    if (svc.linkUrl) {
      bits.push(
        `<p><a class="hub-attach-chip" href="${esc(svc.linkUrl)}" target="_blank" rel="noopener noreferrer">رابط الخدمة</a></p>`
      );
    }
    if (svc.docUrl) {
      bits.push(
        `<p><a class="hub-attach-chip" href="${esc(svc.docUrl)}" target="_blank" rel="noopener noreferrer">ملف: ${esc(
          svc.docName || 'مستند'
        )}</a></p>`
      );
    }
    return bits.join('');
  };

  const detailRoot = document.querySelector('[data-ns-detail]');
  if (detailRoot) {
    const id = new URLSearchParams(location.search).get('id');
    const svc = api.get(id);
    if (!svc) {
      detailRoot.innerHTML = '<p class="hub-service-empty">الخدمة غير موجودة. <a href="services.html">رجوع لخدماتنا</a></p>';
    } else {
      document.title = `${svc.title} | خدمات نايوش هوب`;
      const media = [];
      if (svc.imageUrl) media.push(`<img src="${esc(svc.imageUrl)}" alt="${esc(svc.title)}" />`);
      if (svc.videoUrl) media.push(`<video src="${esc(svc.videoUrl)}" controls playsinline></video>`);
      const points = (svc.points || []).map((p) => `<li>${esc(p)}</li>`).join('');
      const steps = (svc.steps || []).map((p) => `<li>${esc(p)}</li>`).join('');
      const fields = window.HubFormAttachments?.FIELDS_HTML || '';
      detailRoot.innerHTML = `
        <section class="hub-feature-hero">
          <p class="hub-feature-kicker"><i class="fas ${esc(svc.icon)}"></i> خدماتنا · صفحة مستقلة</p>
          <h1>${esc(svc.title)}</h1>
          <p>${esc(svc.description)}</p>
        </section>
        ${media.length ? `<div class="ns-detail-media">${media.join('')}</div>` : ''}
        ${extraMedia(svc)}
        <div class="ns-detail-grid">
          <article class="ns-detail-panel">
            <h2>ماذا تشمل الخدمة</h2>
            <ul>${points}</ul>
          </article>
          <article class="ns-detail-panel">
            <h2>كيف تحصل عليها</h2>
            <ol>${steps}</ol>
          </article>
          <article class="ns-detail-panel">
            <h2>لمن هذه الخدمة</h2>
            <p>${esc(svc.audience)}</p>
          </article>
        </div>
        <section class="ns-detail-request">
          <h2>اطلب هذه الخدمة</h2>
          <p>أرفق رابطًا أو ملف نص / PDF أو صورة أو فيديو مع طلبك.</p>
          <form class="hub-service-form" data-service-request>
            <div class="hub-service-grid-2">
              <label>الاسم بالكامل <input name="fullName" required autocomplete="name" /></label>
              <label>الجوال <input name="phone" type="tel" required autocomplete="tel" /></label>
            </div>
            <label>البريد الإلكتروني <input name="email" type="email" required autocomplete="email" /></label>
            <label>عنوان الطلب <input name="title" required value="طلب خدمة: ${esc(svc.title)}" /></label>
            <label>التفاصيل <textarea name="body" rows="4" required placeholder="اشرح احتياجك من هذه الخدمة"></textarea></label>
            ${fields}
            <button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> إرسال الطلب</button>
            <p class="hub-service-feedback" data-service-request-feedback hidden role="status"></p>
          </form>
        </section>
        <div class="hub-feature-actions">
          ${svc.relatedHref ? `<a class="btn btn-primary" href="${esc(svc.relatedHref)}">فتح الصفحة المرتبطة</a>` : ''}
          <a class="btn btn-secondary" href="consultation.html">نموذج الاستشارة الكامل</a>
          <a class="btn btn-secondary" href="services.html">رجوع لخدماتنا</a>
        </div>`;
      bindRequestForm(detailRoot, svc);
    }
  }

  if (form) window.HubFormAttachments?.bind?.(form);
  renderGrid();
})();
