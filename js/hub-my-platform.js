/**
 * منصتي — عرض حالة طلب سجل معنا للعميل (بانتظار / مفعّل)
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-my-platform]');
  if (!root) return;

  const mount = root.querySelector('[data-platform-root]');
  const meta = root.querySelector('[data-platform-meta]');

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

  const userEmail = () => String(window.HubAuth?.getUser?.()?.email || '').trim().toLowerCase();

  const latestGrantFor = (email) => {
    if (!email || !window.HubPlatformGrants) return null;
    const rows = window.HubPlatformGrants.listGrants().filter(
      (g) => String(g.adminEmail || '').toLowerCase() === email
    );
    return rows[0] || null;
  };

  const render = () => {
    if (!mount) return;
    const email = userEmail();

    if (!window.HubAuth?.isLoggedIn?.()) {
      mount.innerHTML = `<div class="hub-mine-empty">
        سجّل الدخول بنفس إيميل «سجل معنا» لترى حالة طلبك والدومين والنظام بعد الموافقة.
        <div class="hub-mine-actions" style="margin-top:14px">
          <a class="is-primary" href="login.html?next=my-platform.html"><i class="fas fa-right-to-bracket"></i> تسجيل الدخول</a>
          <a class="is-secondary" href="register.html"><i class="fas fa-user-plus"></i> سجل معنا</a>
        </div>
      </div>`;
      if (meta) meta.textContent = 'يجب تسجيل الدخول أولًا';
      return;
    }

    const grant = latestGrantFor(email);
    if (meta) {
      meta.textContent = grant
        ? `طلب ${email} · ${statusAr[grant.status] || grant.status}`
        : `لا يوجد طلب «سجل معنا» مرتبط بـ ${email}`;
    }

    if (!grant) {
      mount.innerHTML = `<div class="hub-mine-empty">
        لا يوجد طلب منصة مسجّل لهذا الإيميل. ابدأ من <a href="register.html">سجل معنا</a>.
      </div>`;
      return;
    }

    const stClass =
      grant.status === 'active' ? 'is-active' : grant.status === 'pending' ? 'is-pending' : '';
    const systemCode = grant.grantedSystemCode || grant.requestedSystem || '';
    const systemLabel = grant.requestedSystemLabel || systemCode || '—';

    mount.innerHTML = `<article class="hub-mine-card">
      <h3>${esc(grant.adminName || grant.companyName)} <span class="hub-mine-status ${stClass}">${esc(statusAr[grant.status] || grant.status)}</span></h3>
      <p>الفرع: <strong>${esc(grant.branchLabel || grant.branch || '—')}</strong></p>
      <p>الحاضنة: <strong>${esc(grant.incubatorLabel || grant.incubator || '—')}</strong></p>
      <p>المنصة: <strong>${esc(grant.platformLabel || grant.platform || '—')}</strong></p>
      <p>النظام: <strong>${esc(systemLabel)}</strong>${systemCode ? ` <span dir="ltr">(${esc(systemCode)})</span>` : ''}</p>
      <div class="hub-mine-host"><i class="fas fa-globe"></i> ${esc(grant.host || '—')}</div>
      <p>الخطة: ${esc(grant.planLabel || 'باقة مجانية')}${grant.status === 'active' ? ` · متبقي مجاني: ${esc(String(grant.freeRemaining ?? grant.freeQuota ?? '—'))}` : ''}</p>
      ${
        grant.status === 'pending'
          ? `<p style="color:#b45309;font-weight:800">طلبك عند السوبر أدمن — بعد الاعتماد ارجع لهذه الصفحة أو سجّل الدخول من جديد.</p>`
          : ''
      }
      ${
        grant.status === 'rejected'
          ? `<p style="color:#b91c1c;font-weight:800">تم رفض الطلب. تواصل مع الدعم أو أرسل طلبًا جديدًا.</p>`
          : ''
      }
      <div class="hub-mine-actions">
        ${
          grant.status === 'active' && systemCode
            ? `<button type="button" class="is-primary" data-open-system="${esc(systemCode)}"><i class="fas fa-rocket"></i> فتح النظام ${esc(systemCode)}</button>`
            : ''
        }
        ${
          grant.status === 'active'
            ? `<a class="is-secondary" href="office.html"><i class="fas fa-briefcase"></i> مكتبي</a>
               <a class="is-secondary" href="apps.html"><i class="fas fa-cubes"></i> الأنظمة</a>`
            : ''
        }
        <a class="is-secondary" href="register.html"><i class="fas fa-plus"></i> طلب جديد</a>
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

  const boot = async () => {
    if (!window.HubAuth?.isLoggedIn?.()) {
      render();
      return;
    }
    await window.HubPlatformGrants?.hydrate?.();
    render();
  };

  root.querySelector('[data-platform-refresh]')?.addEventListener('click', boot);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
