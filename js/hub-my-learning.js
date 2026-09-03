/**
 * واجهة دوراتي / دبلوماتي — برامج المستخدم فقط
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-my-learning]');
  if (!root) return;

  const kind = root.getAttribute('data-my-learning') === 'diploma' ? 'diploma' : 'course';
  const mount = root.querySelector('[data-learning-root]');
  const meta = root.querySelector('[data-learning-meta]');
  const emailInput = root.querySelector('[data-learning-email]');
  const enrollSelect = root.querySelector('[data-learning-enroll]');
  const labelMine = kind === 'diploma' ? 'دبلوماتي' : 'دوراتي';
  const catalogHref = kind === 'diploma' ? 'diplomas.html' : 'courses.html';
  const academyHash = kind === 'diploma' ? 'diplomas' : 'courses';

  const esc = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const normEmail = (v) => String(v || '').trim().toLowerCase();
  const userEmail = () => normEmail(window.HubAuth?.getUser?.()?.email);

  const catalog = () =>
    kind === 'diploma'
      ? window.HubLearningCatalog?.DIPLOMAS || []
      : window.HubLearningCatalog?.COURSES || [];

  const fillSelect = () => {
    if (!enrollSelect) return;
    enrollSelect.innerHTML =
      `<option value="">— سجّل ${kind === 'diploma' ? 'دبلومًا' : 'دورة'} من كتالوجك —</option>` +
      catalog()
        .map((item) => `<option value="${esc(item.id)}">${esc(item.title)}</option>`)
        .join('');
  };

  const renderHelp = () => {
    if (!mount) return;
    mount.innerHTML = `<div class="hub-mine-steps">
      <h2><i class="fas fa-circle-info"></i> ${esc(labelMine)} تعرض برامجك فقط</h2>
      <ol>
        <li>اكتبي إيميل التسجيل/الشراء.</li>
        <li>اضغطي <strong>عرض ${esc(labelMine)}</strong>.</li>
        <li>ستظهر فقط ${kind === 'diploma' ? 'دبلوماتك' : 'دوراتك'} الخاصة — الكتالوج العام يبقى في <a href="${catalogHref}">${kind === 'diploma' ? 'الدبلومات' : 'الدورات'}</a>.</li>
      </ol>
    </div>`;
    if (meta) meta.textContent = `أدخلي الإيميل ثم اضغطي عرض ${labelMine}`;
  };

  const renderCard = (row) => {
    const article = document.createElement('article');
    article.className = 'hub-mine-card';
    article.innerHTML = `<h3><i class="fas ${esc(row.icon || 'fa-book')}"></i> ${esc(row.title)}
        <span class="hub-mine-status is-active">${kind === 'diploma' ? 'دبلومي' : 'دورتي'}</span></h3>
      <p>المستوى: <strong>${esc(row.level || '—')}</strong> · المدة: <strong>${esc(row.duration || '—')}</strong></p>
      <p>الإيميل: <strong dir="ltr">${esc(row.email)}</strong></p>
      <div class="hub-mine-actions">
        <a class="is-primary" href="systems/academy.html?from=hub&return=${kind === 'diploma' ? 'my-diplomas' : 'my-courses'}.html#${academyHash}"><i class="fas fa-chalkboard-user"></i> افتح الأكاديمية</a>
      </div>`;
    return article;
  };

  const renderNotFound = (email) => {
    if (!mount) return;
    mount.innerHTML = `<div class="hub-mine-empty">
      <p><strong>لا ${kind === 'diploma' ? 'دبلومات' : 'دورات'} مسجّلة</strong> على <span dir="ltr">${esc(email)}</span>.</p>
      <p style="margin-top:10px">يمكنك التسجيل من الكتالوج العام ثم العودة هنا لترى ${kind === 'diploma' ? 'دبلوماتك' : 'دوراتك'} فقط.</p>
      <div class="hub-mine-actions" style="margin-top:14px">
        <a class="is-primary" href="${catalogHref}"><i class="fas fa-list"></i> تصفّح الكتالوج</a>
      </div>
    </div>`;
    if (meta) meta.textContent = `لا برامج مرتبطة بـ ${email}`;
  };

  const showForEmail = (emailRaw) => {
    const email = normEmail(emailRaw);
    if (!email) {
      renderHelp();
      return;
    }
    if (emailInput && emailInput.value.trim().toLowerCase() !== email) emailInput.value = email;
    window.HubClientLearning?.rememberEmail?.(email);
    const rows = window.HubClientLearning?.listForEmail?.(email, kind) || [];
    if (!rows.length) {
      renderNotFound(email);
      return;
    }
    if (meta) meta.textContent = `${labelMine} فقط · ${email} · ${rows.length}`;
    const wrap = document.createElement('div');
    wrap.className = 'hub-mine-grid';
    rows.forEach((row) => wrap.appendChild(renderCard(row)));
    mount.innerHTML = '';
    mount.appendChild(wrap);
  };

  const enrollSelected = () => {
    const email = normEmail(emailInput?.value);
    const itemId = enrollSelect?.value;
    if (!email || !itemId) {
      if (meta) meta.textContent = 'اختري البرنامج وأدخلي الإيميل أولًا';
      return;
    }
    const res = window.HubClientLearning?.enroll?.({ email, kind, itemId, source: 'mine-page' });
    if (!res?.ok) {
      if (meta) meta.textContent = res?.error || 'تعذر التسجيل';
      return;
    }
    showForEmail(email);
  };

  root.querySelector('[data-learning-lookup]')?.addEventListener('click', () => showForEmail(emailInput?.value));
  root.querySelector('[data-learning-enroll-btn]')?.addEventListener('click', enrollSelected);
  root.querySelector('[data-learning-refresh]')?.addEventListener('click', () =>
    showForEmail(emailInput?.value || userEmail() || window.HubClientLearning?.rememberedEmail?.())
  );
  emailInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      showForEmail(emailInput.value);
    }
  });

  const boot = () => {
    fillSelect();
    const preset =
      userEmail() ||
      normEmail(new URLSearchParams(window.location.search).get('email')) ||
      window.HubClientLearning?.rememberedEmail?.() ||
      '';
    if (emailInput && preset) emailInput.value = preset;
    if (preset) showForEmail(preset);
    else renderHelp();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
