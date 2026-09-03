/**
 * واجهة مكتبي — مكاتب العميل فقط
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-my-office]');
  if (!root) return;

  const mount = root.querySelector('[data-office-root]');
  const meta = root.querySelector('[data-office-meta]');
  const emailInput = root.querySelector('[data-office-email]');
  const lookupBtn = root.querySelector('[data-office-lookup]');

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
      <h2><i class="fas fa-circle-info"></i> مكتبي يفتح مكاتبك فقط</h2>
      <ol>
        <li>اكتبي <strong>نفس الإيميل</strong> من حجز المكتب عبر منصة/حاضنة/فرع أو المكتب الرئيسي.</li>
        <li>اضغطي <strong>عرض مكاتبي</strong>.</li>
        <li>ستظهر <strong>مكاتب العميل فقط</strong> مع أنظمتها حسب حاجة العمل — ليست قائمة عامة.</li>
      </ol>
      <div class="hub-mine-actions">
        <a class="is-primary" href="book-office.html"><i class="fas fa-briefcase"></i> إحجز مكتب</a>
        <a href="my-platform.html"><i class="fas fa-layer-group"></i> منصتي</a>
      </div>
    </div>`;
    if (meta) meta.textContent = 'أدخلي إيميل الحجز ثم اضغطي عرض مكاتبي';
  };

  const renderCard = (row) => {
    const article = document.createElement('article');
    article.className = 'hub-mine-card';
    const systems = Array.isArray(row.systems) ? row.systems : [];
    article.innerHTML = `<h3>${esc(row.officeName || 'مكتبي')} <span class="hub-mine-status is-active">مكتب المستخدم</span></h3>
      <p>الإيميل: <strong dir="ltr">${esc(row.email)}</strong></p>
      <p>المصدر: <strong>${esc(
        row.source === 'freelancer'
          ? 'فريلانسر · المكتب الرئيسي'
          : row.source === 'hq'
            ? 'المكتب الرئيسي'
            : 'منصة / حاضنة / فرع'
      )}</strong></p>
      ${
        row.kind === 'freelancer' || row.source === 'freelancer'
          ? '<p><span class="hub-mine-status is-active">مكتب فقط · بدون منصة · بدون نظام</span></p><p>التشغيل حسب حاجة المنصات من المقر.</p>'
          : ''
      }
      <p>الفرع: <strong>${esc(row.branchLabel || row.branch || '—')}</strong></p>
      <p>الحاضنة: <strong>${esc(row.incubatorLabel || row.incubator || '—')}</strong></p>
      <p>المنصة: <strong>${esc(row.platformLabel || row.platform || '—')}</strong></p>
      ${row.host ? `<div class="hub-mine-host"><i class="fas fa-globe"></i> ${esc(row.host)}</div>` : ''}
      ${
        systems.length
          ? `<p>الأنظمة: <strong>${esc(systems.map((s) => s.code || s).join(' · '))}</strong></p>`
          : ''
      }
      <div class="hub-mine-actions">
        <a class="is-primary" href="office.html"><i class="fas fa-door-open"></i> ادخل مساحة المكتب</a>
        <a href="ads.html"><i class="fas fa-bullhorn"></i> إعلاناتي</a>
      </div>`;
    return article;
  };

  const renderNotFound = (email) => {
    if (!mount) return;
    mount.innerHTML = `<div class="hub-mine-empty">
      <p><strong>لا توجد مكاتب لهذا العميل</strong> على الإيميل <span dir="ltr">${esc(email)}</span>.</p>
      <p style="margin-top:10px">مكتبي يعرض فقط المكاتب الممنوحة عبر منصة تابعة لحاضنة وفرع، أو من المكتب الرئيسي.</p>
      <div class="hub-mine-actions" style="margin-top:14px">
        <a class="is-primary" href="book-office.html"><i class="fas fa-briefcase"></i> إحجز مكتب</a>
      </div>
    </div>`;
    if (meta) meta.textContent = `لا مكاتب مرتبطة بـ ${email}`;
  };

  const showForEmail = (emailRaw) => {
    const email = normEmail(emailRaw);
    if (!email) {
      renderHelp();
      return;
    }
    if (emailInput && emailInput.value.trim().toLowerCase() !== email) emailInput.value = email;
    window.HubClientOffices?.rememberEmail?.(email);
    const rows = window.HubClientOffices?.listForEmail?.(email) || [];
    if (!rows.length) {
      renderNotFound(email);
      return;
    }
    if (meta) meta.textContent = `مكاتب العميل فقط · ${email} · ${rows.length} مكتب`;
    const wrap = document.createElement('div');
    wrap.className = 'hub-mine-grid';
    rows.forEach((row) => wrap.appendChild(renderCard(row)));
    mount.innerHTML = '';
    mount.appendChild(wrap);
  };

  const boot = () => {
    const preset =
      userEmail() ||
      normEmail(new URLSearchParams(window.location.search).get('email')) ||
      window.HubClientOffices?.rememberedEmail?.() ||
      '';
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
  root.querySelector('[data-office-refresh]')?.addEventListener('click', () =>
    showForEmail(emailInput?.value || userEmail() || window.HubClientOffices?.rememberedEmail?.())
  );

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
