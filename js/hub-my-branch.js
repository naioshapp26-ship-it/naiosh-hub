/**
 * واجهة فرعي — فرع المستخدم فقط، ليست شبكة الفروع العامة
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-my-branch]');
  if (!root) return;

  const mount = root.querySelector('[data-branch-root]');
  const meta = root.querySelector('[data-branch-meta]');
  const emailInput = root.querySelector('[data-branch-email]');
  const lookupBtn = root.querySelector('[data-branch-lookup]');

  const esc = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const normEmail = (v) => String(v || '').trim().toLowerCase();
  const userEmail = () => normEmail(window.HubAuth?.getUser?.()?.email);

  const renderHelp = () => {
    if (!mount) return;
    mount.innerHTML = `<div class="hub-mine-steps">
      <h2><i class="fas fa-circle-info"></i> فرعي يفتح فرعك فقط</h2>
      <ol>
        <li>اكتبي <strong>نفس الإيميل</strong> المستخدم في التسجيل أو حجز الحاضنة/المنصة.</li>
        <li>اضغطي <strong>عرض فرعي</strong>.</li>
        <li>سيظهر <strong>فرع المستخدم فقط</strong> — كتالوج كل الفروع يبقى في زر <strong>الفروع</strong> بالهيدر.</li>
      </ol>
      <div class="hub-mine-actions">
        <a class="is-primary" href="book-incubator.html?from=branch"><i class="fas fa-seedling"></i> اربط فرعك بحاضنة</a>
        <a href="branches.html"><i class="fas fa-globe"></i> تصفح كل الفروع</a>
      </div>
    </div>`;
    if (meta) meta.textContent = 'أدخلي إيميل الحجز ثم اضغطي عرض فرعي';
  };

  const renderCard = (row) => {
    const article = document.createElement('article');
    article.className = 'hub-mine-card';
    const bookHref = `book-incubator.html?from=branch&branch=${encodeURIComponent(row.branch || '')}&email=${encodeURIComponent(
      row.email || ''
    )}`;
    const flag = row.flag
      ? `<img class="branch-flag" alt="" src="${esc(row.flag)}" style="width:42px;height:42px;border-radius:10px;object-fit:cover" />`
      : '';
    article.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <h3>${esc(row.branchLabel || row.branch)} ${
          row.nameEn ? `<span style="color:#6b7280;font-size:13px">${esc(row.nameEn)}</span>` : ''
        }</h3>
        ${flag}
      </div>
      <p><span class="hub-mine-status is-active">فرع المستخدم</span></p>
      <p>الإيميل: <strong dir="ltr">${esc(row.email)}</strong></p>
      ${row.type ? `<p>النوع: <strong>${esc(row.type)}</strong></p>` : ''}
      ${row.hours ? `<p><i class="fas fa-clock"></i> ${esc(row.hours)}</p>` : ''}
      <div class="hub-mine-actions">
        <a class="is-primary" href="${esc(bookHref)}"><i class="fas fa-seedling"></i> احجز حاضنة من هذا الفرع</a>
      </div>`;
    return article;
  };

  const renderNotFound = (email) => {
    if (!mount) return;
    mount.innerHTML = `<div class="hub-mine-empty">
      <p><strong>لا يوجد فرع مرتبط بهذا العميل</strong> على الإيميل <span dir="ltr">${esc(email)}</span>.</p>
      <p style="margin-top:10px">فرعي يعرض فقط الفرع المربوط بتسجيلك أو حجزك — ليست قائمة الفروع العامة في الهيدر.</p>
      <div class="hub-mine-actions" style="margin-top:14px">
        <a class="is-primary" href="register.html"><i class="fas fa-user-plus"></i> سجّل واختر فرعك</a>
        <a href="branches.html"><i class="fas fa-globe"></i> تصفح كل الفروع</a>
      </div>
    </div>`;
    if (meta) meta.textContent = `لا فرع مرتبط بـ ${email}`;
  };

  const showForEmail = (emailRaw) => {
    const email = normEmail(emailRaw);
    if (!email) {
      renderHelp();
      return;
    }
    if (emailInput && emailInput.value.trim().toLowerCase() !== email) emailInput.value = email;
    window.HubClientBranches?.rememberEmail?.(email);
    const rows = window.HubClientBranches?.listForEmail?.(email) || [];
    if (!rows.length) {
      renderNotFound(email);
      return;
    }
    if (meta) meta.textContent = `فرع المستخدم فقط · ${email} · ${rows.length} فرع`;
    const wrap = document.createElement('div');
    wrap.className = 'hub-mine-grid';
    rows.forEach((row) => wrap.appendChild(renderCard(row)));
    mount.innerHTML = '';
    mount.appendChild(wrap);
  };

  const boot = () => {
    const fromSession = userEmail();
    const fromQuery = normEmail(new URLSearchParams(window.location.search).get('email'));
    const fromStore = window.HubClientBranches?.rememberedEmail?.() || '';
    const preset = fromSession || fromQuery || fromStore;
    if (emailInput && preset) emailInput.value = preset;
    if (preset) showForEmail(preset);
    else renderHelp();
  };

  lookupBtn?.addEventListener('click', () => showForEmail(emailInput?.value));
  emailInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      showForEmail(emailInput.value);
    }
  });
  root.querySelector('[data-branch-refresh]')?.addEventListener('click', () =>
    showForEmail(emailInput?.value || userEmail() || window.HubClientBranches?.rememberedEmail?.())
  );

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
