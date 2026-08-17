/**
 * منصتي — عرض حالة طلب سجل معنا (بالإيميل أو بعد تسجيل الدخول)
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

  const grantFromLocal = (email) => {
    if (!email || !window.HubPlatformGrants) return null;
    return (
      window.HubPlatformGrants.listGrants().find((g) => normEmail(g.adminEmail) === email) || null
    );
  };

  const grantFromServer = async (email) => {
    const res = await fetch(`/api/hub/my-grant?email=${encodeURIComponent(email)}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (data?.ok && data?.grant) return data.grant;
    return null;
  };

  const resolveGrant = async (email) => {
    if (!email) return null;
    await window.HubPlatformGrants?.hydrate?.().catch(() => null);
    return grantFromLocal(email) || (await grantFromServer(email));
  };

  const renderHelp = () => {
    if (!mount) return;
    mount.innerHTML = `<div class="hub-mine-steps">
      <h2><i class="fas fa-circle-info"></i> كيف ترى طلبك؟</h2>
      <ol>
        <li>اكتبي <strong>نفس الإيميل</strong> الذي استخدمتيه في «سجل معنا» في الحقل بالأعلى.</li>
        <li>اضغطي <strong>عرض طلبي</strong>.</li>
        <li>إذا ظهر <strong>مفعّل</strong> — سجّلي الدخول بنفس الإيميل وكلمة المرور لفتح النظام.</li>
      </ol>
      <div class="hub-mine-actions">
        <a class="is-primary" href="login.html?next=my-platform.html"><i class="fas fa-right-to-bracket"></i> تسجيل الدخول</a>
        <a class="is-secondary" href="register.html"><i class="fas fa-user-plus"></i> سجل معنا</a>
      </div>
    </div>`;
    if (meta) meta.textContent = 'أدخلي إيميل «سجل معنا» ثم اضغطي عرض طلبي';
  };

  const renderGrant = (grant, email) => {
    if (!mount || !grant) return;

    const stClass =
      grant.status === 'active' ? 'is-active' : grant.status === 'pending' ? 'is-pending' : '';
    const systemCode = grant.grantedSystemCode || grant.requestedSystem || '';
    const systemLabel = grant.requestedSystemLabel || systemCode || '—';
    const loggedIn = window.HubAuth?.isLoggedIn?.();
    const sameUser = loggedIn && userEmail() === email;

    mount.innerHTML = `<article class="hub-mine-card">
      <h3>${esc(grant.adminName || grant.companyName)} <span class="hub-mine-status ${stClass}">${esc(statusAr[grant.status] || grant.status)}</span></h3>
      <p>الإيميل: <strong dir="ltr">${esc(email)}</strong></p>
      <p>الفرع: <strong>${esc(grant.branchLabel || grant.branch || '—')}</strong></p>
      <p>الحاضنة: <strong>${esc(grant.incubatorLabel || grant.incubator || '—')}</strong></p>
      <p>المنصة: <strong>${esc(grant.platformLabel || grant.platform || '—')}</strong></p>
      <p>النظام: <strong>${esc(systemLabel)}</strong>${systemCode ? ` <span dir="ltr">(${esc(systemCode)})</span>` : ''}</p>
      <div class="hub-mine-host"><i class="fas fa-globe"></i> ${esc(grant.host || '—')}</div>
      <p>الخطة: ${esc(grant.planLabel || 'باقة مجانية')}${grant.status === 'active' ? ` · متبقي مجاني: ${esc(String(grant.freeRemaining ?? grant.freeQuota ?? '—'))}` : ''}</p>
      ${
        grant.status === 'pending'
          ? `<p class="hub-mine-note is-pending">طلبك عند السوبر أدمن — ارجعي لهذه الصفحة بعد الموافقة.</p>`
          : ''
      }
      ${
        grant.status === 'rejected'
          ? `<p class="hub-mine-note is-rejected">تم رفض الطلب. تواصلي مع الدعم أو أرسلي طلبًا جديدًا.</p>`
          : ''
      }
      ${
        grant.status === 'active' && !sameUser
          ? `<p class="hub-mine-note is-info">لتشغيل النظام: سجّلي الدخول بنفس الإيميل <strong dir="ltr">${esc(email)}</strong> وكلمة المرور من «سجل معنا».</p>`
          : ''
      }
      <div class="hub-mine-actions">
        ${
          grant.status === 'active' && systemCode && sameUser
            ? `<button type="button" class="is-primary" data-open-system="${esc(systemCode)}"><i class="fas fa-rocket"></i> فتح النظام ${esc(systemCode)}</button>`
            : ''
        }
        ${
          grant.status === 'active' && !sameUser
            ? `<a class="is-primary" href="login.html?next=my-platform.html"><i class="fas fa-right-to-bracket"></i> تسجيل الدخول لفتح النظام</a>`
            : ''
        }
        ${
          grant.status === 'active' && sameUser
            ? `<a class="is-secondary" href="office.html"><i class="fas fa-briefcase"></i> مكتبي</a>
               <a class="is-secondary" href="apps.html"><i class="fas fa-cubes"></i> الأنظمة</a>`
            : ''
        }
      </div>
    </article>`;

    mount.querySelector('[data-open-system]')?.addEventListener('click', (event) => {
      const code = event.currentTarget.getAttribute('data-open-system');
      if (window.HubLauncher?.launch) {
        window.HubLauncher.launch(code, { mode: 'hub', force: Boolean(window.HubLiveSystems?.isLive?.(code)) });
      } else {
        window.location.href = `apps.html#${String(code).toLowerCase()}`;
      }
    });
  };

  const renderNotFound = (email) => {
    if (!mount) return;
    mount.innerHTML = `<div class="hub-mine-empty">
      <p><strong>لا يوجد طلب «سجل معنا»</strong> للإيميل <span dir="ltr">${esc(email)}</span>.</p>
      <p style="margin-top:10px">تأكّدي أنك كتبتِ نفس الإيميل من النموذج. إذا وافق السوبر أدمن للتو، اضغطي تحديث بعد دقيقة.</p>
      <div class="hub-mine-actions" style="margin-top:14px">
        <a class="is-primary" href="register.html"><i class="fas fa-user-plus"></i> سجل معنا</a>
        <a class="is-secondary" href="login.html?next=my-platform.html"><i class="fas fa-right-to-bracket"></i> تسجيل الدخول</a>
      </div>
    </div>`;
    if (meta) meta.textContent = `لا طلب مرتبط بـ ${email}`;
  };

  const showGrant = async (emailRaw) => {
    const email = normEmail(emailRaw);
    if (!email) {
      renderHelp();
      return;
    }
    if (emailInput && emailInput.value.trim().toLowerCase() !== email) emailInput.value = email;
    if (meta) meta.textContent = `جاري البحث عن طلب ${email}…`;
    mount.innerHTML = `<div class="hub-mine-empty"><i class="fas fa-spinner fa-spin"></i> جاري تحميل طلبك…</div>`;

    const grant = await resolveGrant(email);
    if (!grant) {
      renderNotFound(email);
      return;
    }
    if (meta) meta.textContent = `طلب ${email} · ${statusAr[grant.status] || grant.status}`;
    renderGrant(grant, email);
  };

  const boot = async () => {
    const fromSession = userEmail();
    const fromQuery = normEmail(new URLSearchParams(window.location.search).get('email'));
    const preset = fromSession || fromQuery;
    if (emailInput && preset) emailInput.value = preset;
    if (preset) await showGrant(preset);
    else renderHelp();
  };

  lookupBtn?.addEventListener('click', () => showGrant(emailInput?.value));
  emailInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      showGrant(emailInput.value);
    }
  });
  root.querySelector('[data-platform-refresh]')?.addEventListener('click', () =>
    showGrant(emailInput?.value || userEmail())
  );

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
