/**
 * مساحة المستأجر — أنظمتي / دوميناتي / فتح بـ SSO
 */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  const statusAr = {
    active: 'مفعّل',
    pending: 'بانتظار الاعتماد',
    provisioning: 'قيد التجهيز',
    rejected: 'مرفوض',
  };

  const esc = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const currentEmail = () => {
    const fromInput = String($('[data-mine-email]')?.value || '').trim().toLowerCase();
    if (fromInput) return fromInput;
    return String(window.HubAuth?.getUser?.()?.email || '').trim().toLowerCase();
  };

  const render = () => {
    const root = $('[data-mine-list]');
    if (!root || !window.HubRentStore) return;
    const email = currentEmail();
    const rows = window.HubRentStore.listMine(email);
    const meta = $('[data-mine-meta]');
    if (meta) {
      meta.textContent = email
        ? `عرض أنظمة المستأجر: ${email} · ${rows.length} عنصر`
        : `كل الطلبات المحلية على هذا الجهاز · ${rows.length} عنصر`;
    }
    if (!rows.length) {
      root.innerHTML = `<div class="hub-mine-empty">لا أنظمة مستأجرة بعد — ابدأ من <a href="rent-system.html">استأجر نظامًا</a>.</div>`;
      return;
    }
    root.innerHTML = rows
      .map((r) => {
        const st = statusAr[r.status] || r.status;
        const stClass = r.status === 'active' ? 'is-active' : r.status === 'pending' || r.status === 'provisioning' ? 'is-pending' : '';
        const systems = (r.systems || []).join(' · ');
        return `<article class="hub-mine-card" data-rental-id="${esc(r.id)}">
          <h3>${esc(r.companyName)} <span class="hub-mine-status ${stClass}">${esc(st)}</span></h3>
          <p>الأنظمة: ${esc(systems)}</p>
          <p>الخطة: ${esc(r.planLabel || r.plan)} · ${esc(r.adminEmail || '—')}</p>
          <div class="hub-mine-host"><i class="fas fa-globe"></i> ${esc(r.host)}</div>
          ${r.erp?.loginUrl ? `<p dir="ltr">ERP: ${esc(r.erp.loginUrl)}</p>` : ''}
          <div class="hub-mine-actions">
            ${
              r.status === 'active'
                ? `<button type="button" class="is-primary" data-open-rental="${esc(r.id)}"><i class="fas fa-right-to-bracket"></i> فتح بـ SSO من هوب</button>`
                : ''
            }
            <a class="is-secondary" href="rent-system.html?system=${encodeURIComponent(r.systems?.[0] || 'ERP')}"><i class="fas fa-plus"></i> استأجر المزيد</a>
          </div>
        </article>`;
      })
      .join('');

    root.querySelectorAll('[data-open-rental]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-open-rental');
        const rental = window.HubRentStore.getRental(id);
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> تجهيز الدخول…';
        const res = await window.HubRentStore.buildOpenUrl(rental);
        if (!res.ok) {
          alert(res.error || 'تعذّر فتح النظام');
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-right-to-bracket"></i> فتح بـ SSO من هوب';
          return;
        }
        window.open(res.url, '_blank', 'noopener');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-right-to-bracket"></i> فتح بـ SSO من هوب';
      });
    });
  };

  document.addEventListener('DOMContentLoaded', async () => {
    if (!$('[data-mine-list]')) return;
    await window.HubRentStore?.hydrate?.();
    const userEmail = window.HubAuth?.getUser?.()?.email;
    if (userEmail && $('[data-mine-email]')) $('[data-mine-email]').value = userEmail;
    render();
    $('[data-mine-refresh]')?.addEventListener('click', render);
    $('[data-mine-email]')?.addEventListener('change', render);
  });
})();
