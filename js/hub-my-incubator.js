/**
 * حاضنتي — حاضنات العميل فقط (الممنوحة عبر الفرع التابع له عند التسجيل)
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-my-incubator]');
  if (!root) return;

  const mount = root.querySelector('[data-incubator-root]');
  const meta = root.querySelector('[data-incubator-meta]');
  const emailInput = root.querySelector('[data-incubator-email]');
  const lookupBtn = root.querySelector('[data-incubator-lookup]');

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
      <h2><i class="fas fa-circle-info"></i> حاضنتي تفتح حاضناتك فقط</h2>
      <ol>
        <li>اكتبي <strong>نفس الإيميل</strong> من نموذج «احجز حاضنة من فرع».</li>
        <li>اضغطي <strong>عرض حاضناتي</strong>.</li>
        <li>ستظهر <strong>حاضنات العميل فقط</strong> — أيقونة واحدة في المنيو على يمين الشاشة.</li>
      </ol>
      <div class="hub-mine-actions">
        <a class="is-primary" href="book-incubator.html?from=branch"><i class="fas fa-code-branch"></i> احجز حاضنة من فرع</a>
      </div>
    </div>`;
    if (meta) meta.textContent = 'أدخلي إيميل الحجز ثم اضغطي عرض حاضناتي';
  };

  const renderCard = (row) => {
    const article = document.createElement('article');
    article.className = 'hub-mine-card';
    const bookHref = `book-platform.html?from=incubator&incubator=${encodeURIComponent(row.incubator || '')}&branch=${encodeURIComponent(
      row.branch || ''
    )}&email=${encodeURIComponent(row.email || '')}`;
    article.innerHTML = `<h3>${esc(row.incubatorLabel || row.incubator)} <span class="hub-mine-status is-active">مفعّل — ممنوحة عبر الفرع</span></h3>
      <p>الإيميل: <strong dir="ltr">${esc(row.email)}</strong></p>
      <p>الفرع التابع له عند التسجيل: <strong>${esc(row.branchLabel || row.branch || '—')}</strong></p>
      <p>الدولة: <strong>${esc(row.country || '—')}</strong></p>
      <p>القطاع: <strong>${esc(row.sectorName || '—')}</strong></p>
      ${row.grantId ? `<p>رقم المنح: <strong>${esc(row.grantId)}</strong></p>` : ''}
      ${row.host ? `<div class="hub-mine-host"><i class="fas fa-globe"></i> ${esc(row.host)}</div>` : ''}
      <div class="hub-mine-actions">
        <a class="is-primary" href="${esc(bookHref)}"><i class="fas fa-layer-group"></i> إحجز منصة من هذه الحاضنة</a>
      </div>`;
    return article;
  };

  const renderNotFound = (email) => {
    if (!mount) return;
    mount.innerHTML = `<div class="hub-mine-empty">
      <p><strong>لا توجد حاضنات لهذا العميل</strong> على الإيميل <span dir="ltr">${esc(email)}</span>.</p>
      <p style="margin-top:10px">حاضنتي تعرض فقط الحاضنات الممنوحة عبر الفرع التابع له عند التسجيل — ليست قائمة الحاضنات العامة.</p>
      <div class="hub-mine-actions" style="margin-top:14px">
        <a class="is-primary" href="book-incubator.html?from=branch"><i class="fas fa-code-branch"></i> احجز حاضنة من فرع</a>
      </div>
    </div>`;
    if (meta) meta.textContent = `لا حاضنات مرتبطة بـ ${email}`;
  };

  const showForEmail = (emailRaw) => {
    const email = normEmail(emailRaw);
    if (!email) {
      renderHelp();
      return;
    }
    if (emailInput && emailInput.value.trim().toLowerCase() !== email) emailInput.value = email;
    window.HubClientIncubators?.rememberEmail?.(email);
    const rows = window.HubClientIncubators?.listForEmail?.(email) || [];
    if (!rows.length) {
      renderNotFound(email);
      return;
    }
    if (meta) meta.textContent = `حاضنات العميل فقط · ${email} · ${rows.length} حاضنة`;
    const wrap = document.createElement('div');
    wrap.className = 'hub-mine-grid';
    rows.forEach((row) => wrap.appendChild(renderCard(row)));
    mount.innerHTML = '';
    mount.appendChild(wrap);
  };

  const boot = () => {
    const fromSession = userEmail();
    const fromQuery = normEmail(new URLSearchParams(window.location.search).get('email'));
    const fromStore = window.HubClientIncubators?.rememberedEmail?.() || '';
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
  root.querySelector('[data-incubator-refresh]')?.addEventListener('click', () =>
    showForEmail(emailInput?.value || userEmail() || window.HubClientIncubators?.rememberedEmail?.())
  );

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
