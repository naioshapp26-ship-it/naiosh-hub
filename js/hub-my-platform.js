/**
 * منصتي — منصات العميل فقط (الممنوحة عبر حاضنة تابعة لفرع أو سجل معنا)
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-my-platform]');
  if (!root) return;

  const mount = root.querySelector('[data-platform-root]');
  const meta = root.querySelector('[data-platform-meta]');
  const emailInput = root.querySelector('[data-platform-email]');
  const lookupBtn = root.querySelector('[data-platform-lookup]');

  const statusAr = {
    pending: 'بانتظار موافقة السوبر أدمن',
    active: 'مفعّل — جاهز للتشغيل',
    granted: 'مفعّل — جاهز للتشغيل',
    rejected: 'مرفوض',
  };

  const esc = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const normEmail = (v) => String(v || '').trim().toLowerCase();

  const userEmail = () => normEmail(window.HubAuth?.getUser?.()?.email);

  const signupGrantsForEmail = (email) => {
    if (!email || !window.HubPlatformGrants) return [];
    return (window.HubPlatformGrants.listGrants() || []).filter((g) => normEmail(g.adminEmail) === email);
  };

  const openSystem = (systemCode, grant) => {
    const code = String(systemCode || grant?.grantedSystemCode || grant?.requestedSystem || '').toUpperCase();
    if (!code) return;
    const slug = String(grant?.slug || '').toLowerCase();
    const app = window.HubLauncher?.findApp?.(code);
    if (!app) {
      window.location.href = `apps.html#${code.toLowerCase()}`;
      return;
    }
    const base = app.liveUrl || app.launchUrl || app.url || 'apps.html';
    const href = window.HubLauncher?.withLaunchParams
      ? window.HubLauncher.withLaunchParams(base, {
          from: 'hub',
          systemCode: app.code,
          subdomain: slug,
          tenant: slug,
          returnUrl: `${window.location.pathname}${window.location.search}`,
        })
      : base;
    window.HubStore?.recordLaunch?.(app.code, 'hub');
    window.open(href, '_blank', 'noopener');
  };

  const bindOpenActions = (scope, grant) => {
    scope.querySelectorAll('[data-open-system]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        openSystem(btn.getAttribute('data-open-system'), grant);
      });
    });
  };

  const renderHelp = () => {
    if (!mount) return;
    mount.innerHTML = `<div class="hub-mine-steps">
      <h2><i class="fas fa-circle-info"></i> منصتي تفتح منصاتك فقط</h2>
      <ol>
        <li>اكتبي <strong>نفس الإيميل</strong> من «إحجز منصة من حاضنة» أو «احجز منصة من المكتب الرئيسي».</li>
        <li>اضغطي <strong>عرض منصاتي</strong>.</li>
        <li>ستظهر <strong>منصات العميل فقط</strong> — ليست كتالوج منصات هوب العامة.</li>
      </ol>
      <div class="hub-mine-actions">
        <a class="is-primary" href="book-platform.html?from=incubator"><i class="fas fa-seedling"></i> إحجز منصة من حاضنة</a>
        <a class="is-secondary" href="book-platform.html?from=hq"><i class="fas fa-building"></i> من المكتب الرئيسي</a>
      </div>
    </div>`;
    if (meta) meta.textContent = 'أدخلي إيميل الحجز ثم اضغطي عرض منصاتي';
  };

  const systemsHtml = (systems) => {
    const list = Array.isArray(systems) ? systems : [];
    if (!list.length) return '<p>لم تُمنح أنظمة تشغيلية بعد.</p>';
    return `<div class="hub-mine-sys-list">${list
      .map(
        (s) =>
          `<button type="button" class="hub-mine-sys-chip" data-open-system="${esc(s.code)}"><i class="fas fa-cube"></i> ${esc(
            s.label || s.code
          )} <span dir="ltr">${esc(s.code)}</span></button>`
      )
      .join('')}</div>`;
  };

  const renderClientCard = (row) => {
    const article = document.createElement('article');
    article.className = 'hub-mine-card';
    const isHq = String(row.source || '').toLowerCase() === 'hq';
    const sourceLabel = isHq ? 'المكتب الرئيسي — بدون فروع ولا حاضنات' : 'حاضنة تابعة لفرع';
    article.innerHTML = `<h3>${esc(row.platformName)} <span class="hub-mine-status is-active">${esc(
      statusAr[row.status] || 'مفعّل'
    )}</span></h3>
      <p>الإيميل: <strong dir="ltr">${esc(row.email)}</strong></p>
      ${
        isHq
          ? `<p>الفرع: <strong>بدون فرع</strong></p>
      <p>الحاضنة: <strong>بدون حاضنة</strong></p>`
          : `<p>الفرع: <strong>${esc(row.branchLabel || row.branch || '—')}</strong></p>
      <p>الحاضنة التابعة للفرع: <strong>${esc(row.incubatorLabel || row.incubator || '—')}</strong></p>`
      }
      <p>المصدر: <strong>${esc(sourceLabel)}</strong>${row.grantId ? ` · ${esc(row.grantId)}` : ''}</p>
      ${
        row.host
          ? `<div class="hub-mine-host"><i class="fas fa-globe"></i> ${esc(row.host)}</div>`
          : ''
      }
      <p>الأنظمة التشغيلية حسب حاجة العمل:</p>
      ${systemsHtml(row.systems)}`;
    bindOpenActions(article, row);
    return article;
  };

  const renderSignupCard = (grant, email) => {
    const article = document.createElement('article');
    article.className = 'hub-mine-card';
    const stClass =
      grant.status === 'active' ? 'is-active' : grant.status === 'pending' ? 'is-pending' : '';
    const systemCode = grant.grantedSystemCode || grant.requestedSystem || '';
    const systemLabel = grant.requestedSystemLabel || systemCode || '—';
    article.innerHTML = `<h3>${esc(grant.platformLabel || grant.platform || grant.companyName)} <span class="hub-mine-status ${stClass}">${esc(
      statusAr[grant.status] || grant.status
    )}</span></h3>
      <p>الإيميل: <strong dir="ltr">${esc(email)}</strong></p>
      <p>الفرع: <strong>${esc(grant.branchLabel || grant.branch || '—')}</strong></p>
      <p>الحاضنة: <strong>${esc(grant.incubatorLabel || grant.incubator || '—')}</strong></p>
      <p>المصدر: <strong>سجل معنا</strong></p>
      <p>النظام: <strong>${esc(systemLabel)}</strong>${systemCode ? ` <span dir="ltr">(${esc(systemCode)})</span>` : ''}</p>
      ${
        grant.status === 'active' && grant.host
          ? `<button type="button" class="hub-mine-host is-clickable" data-open-system="${esc(systemCode)}">
               <i class="fas fa-globe"></i> ${esc(grant.host)} <i class="fas fa-arrow-up-right-from-square"></i>
             </button>`
          : `<div class="hub-mine-host"><i class="fas fa-globe"></i> ${esc(grant.host || '—')}</div>`
      }`;
    bindOpenActions(article, grant);
    return article;
  };

  const renderNotFound = (email) => {
    if (!mount) return;
    mount.innerHTML = `<div class="hub-mine-empty">
      <p><strong>لا توجد منصات لهذا العميل</strong> على الإيميل <span dir="ltr">${esc(email)}</span>.</p>
      <p style="margin-top:10px">منصتي تعرض فقط منصاتك الممنوحة من حاضنة تابعة لفرع أو من المكتب الرئيسي — ليست منصات هوب العامة.</p>
      <div class="hub-mine-actions" style="margin-top:14px">
        <a class="is-primary" href="book-platform.html?from=incubator"><i class="fas fa-seedling"></i> إحجز منصة من حاضنة</a>
        <a class="is-secondary" href="book-platform.html?from=hq"><i class="fas fa-building"></i> من المكتب الرئيسي</a>
      </div>
    </div>`;
    if (meta) meta.textContent = `لا منصات مرتبطة بـ ${email}`;
  };

  const showForEmail = async (emailRaw) => {
    const email = normEmail(emailRaw);
    if (!email) {
      renderHelp();
      return;
    }
    if (emailInput && emailInput.value.trim().toLowerCase() !== email) emailInput.value = email;
    window.HubClientPlatforms?.rememberEmail?.(email);
    if (meta) meta.textContent = `جاري تحميل منصات ${email}…`;
    if (mount) mount.innerHTML = `<div class="hub-mine-empty"><i class="fas fa-spinner fa-spin"></i> جاري تحميل منصاتك…</div>`;

    await window.HubPlatformGrants?.hydrate?.().catch(() => null);

    const client = window.HubClientPlatforms?.listForEmail?.(email) || [];
    const signup = signupGrantsForEmail(email);

    if (!client.length && !signup.length) {
      renderNotFound(email);
      return;
    }

    if (meta) {
      meta.textContent = `منصات العميل فقط · ${email} · ${client.length} منصة${
        signup.length ? ` · ${signup.length} من سجل معنا` : ''
      }`;
    }

    const wrap = document.createElement('div');
    wrap.className = 'hub-mine-grid';
    client.forEach((row) => wrap.appendChild(renderClientCard(row)));
    signup.forEach((grant) => wrap.appendChild(renderSignupCard(grant, email)));
    mount.innerHTML = '';
    mount.appendChild(wrap);
  };

  const boot = async () => {
    const fromSession = userEmail();
    const fromQuery = normEmail(new URLSearchParams(window.location.search).get('email'));
    const fromStore = window.HubClientPlatforms?.rememberedEmail?.() || '';
    const preset = fromSession || fromQuery || fromStore;
    if (emailInput && preset) emailInput.value = preset;
    if (preset) await showForEmail(preset);
    else renderHelp();
  };

  lookupBtn?.addEventListener('click', () => showForEmail(emailInput?.value));
  emailInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      showForEmail(emailInput.value);
    }
  });
  root.querySelector('[data-platform-refresh]')?.addEventListener('click', () =>
    showForEmail(emailInput?.value || userEmail() || window.HubClientPlatforms?.rememberedEmail?.())
  );

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
