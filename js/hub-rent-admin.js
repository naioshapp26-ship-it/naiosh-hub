/**
 * موافقة السوبر أدمن على طلبات سجل معنا + استئجار الأنظمة
 */
(() => {
  'use strict';

  const store = () => window.HubRentStore;
  const platforms = () => window.HubPlatformGrants;
  const $ = (sel) => document.querySelector(sel);

  const statusClass = (s) => {
    if (s === 'active') return 'is-active';
    if (s === 'pending' || s === 'provisioning') return 'is-pending';
    return '';
  };

  const statusAr = {
    pending: 'بانتظار الاعتماد',
    provisioning: 'قيد التجهيز',
    active: 'مفعّل',
    rejected: 'مرفوض',
  };

  const escapeHtml = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const renderPlatformList = () => {
    const root = $('[data-platform-admin-list]');
    if (!root || !platforms()) return;
    const rows = platforms().listGrants();
    if (!rows.length) {
      root.innerHTML =
        '<p class="hub-rent-hint">لا طلبات بعد — صاحب المنصة يرسل من أيقونة <a href="register.html">سجل معنا</a> في الرئيسية.</p>';
      return;
    }
    root.innerHTML = rows
      .map(
        (r) => `<article class="hub-rent-admin-item" data-platform-id="${escapeHtml(r.id)}">
        <h3>${escapeHtml(r.adminName || r.companyName)} <span class="hub-rent-status ${statusClass(r.status)}">${statusAr[r.status] || r.status}</span></h3>
        <p>الفرع: <strong>${escapeHtml(r.branchLabel || r.branch || '—')}</strong></p>
        <p>الحاضنة: <strong>${escapeHtml(r.incubatorLabel || r.incubator || '—')}</strong></p>
        <p>المنصة: <strong>${escapeHtml(r.platformLabel || r.platform || '—')}</strong></p>
        <p>النظام المطلوب: <strong>${escapeHtml(r.requestedSystemLabel || r.requestedSystem || '—')}</strong></p>
        <p>المسؤول: ${escapeHtml(r.adminName)} · ${escapeHtml(r.adminEmail || '—')} · ${escapeHtml(r.adminPhone || '')}</p>
        <p>النطاق: <span dir="ltr">${escapeHtml(r.host)}</span></p>
        ${r.notes ? `<p>ملاحظات: ${escapeHtml(r.notes)}</p>` : ''}
        <p>الخطة: ${escapeHtml(r.planLabel || 'باقة مجانية')} · متبقي مجاني: ${escapeHtml(String(r.freeRemaining ?? r.freeQuota ?? '—'))}</p>
        <div class="hub-rent-admin-actions">
          ${
            r.status === 'pending'
              ? `<button type="button" class="hub-rent-btn hub-rent-btn-primary" style="width:auto;margin:0;padding:8px 14px" data-approve-platform="${escapeHtml(r.id)}"><i class="fas fa-check"></i> اعتماد ومنح النظام</button>
                 <button type="button" class="hub-rent-btn hub-rent-btn-secondary" style="width:auto;margin:0;padding:8px 14px" data-reject-platform="${escapeHtml(r.id)}"><i class="fas fa-xmark"></i> رفض</button>`
              : ''
          }
          ${
            r.status === 'active'
              ? `<a class="hub-rent-btn hub-rent-btn-secondary" style="width:auto;margin:0;padding:8px 14px;text-decoration:none" href="roles-permissions.html"><i class="fas fa-user-shield"></i> الأدوار والصلاحيات</a>`
              : ''
          }
        </div>
      </article>`
      )
      .join('');

    root.querySelectorAll('[data-approve-platform]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = platforms().approveGrant(btn.getAttribute('data-approve-platform'));
        if (!res.ok) return alert(res.error || 'فشل الاعتماد');
        const g = res.grant;
        if (g?.adminEmail && (g.requestedSystem || g.platform)) {
          try {
            window.HubStore?.grantSubscription?.({
              email: g.adminEmail,
              systemCode: g.requestedSystem || g.platform,
              plan: 'standard',
              permissions: ['read', 'write'],
              source: 'signup-approve',
            });
          } catch {
            /* store grant is best-effort */
          }
        }
        renderPlatformList();
      });
    });
    root.querySelectorAll('[data-reject-platform]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = platforms().rejectGrant(btn.getAttribute('data-reject-platform'));
        if (!res.ok) return alert(res.error || 'فشل الرفض');
        renderPlatformList();
      });
    });
  };

  const renderList = () => {
    const root = $('[data-rent-admin-list]');
    if (!root) return;
    const rows = store().listRentals();
    if (!rows.length) {
      root.innerHTML = '<p class="hub-rent-hint">لا طلبات أنظمة بعد — ابدأ من صفحة استأجر نظامًا.</p>';
      return;
    }
    root.innerHTML = rows
      .map(
        (r) => `<article class="hub-rent-admin-item" data-id="${r.id}">
        <h3>${escapeHtml(r.companyName)} <span class="hub-rent-status ${statusClass(r.status)}">${statusAr[r.status] || r.status}</span></h3>
        <p>المسؤول: ${escapeHtml(r.adminName)} · ${escapeHtml(r.adminEmail || '—')}</p>
        <p>النطاق: <span dir="ltr">${escapeHtml(r.host)}</span></p>
        ${r.erp?.loginUrl ? `<p>ERP: <a href="${escapeHtml(r.erp.loginUrl)}" target="_blank" rel="noopener" dir="ltr">${escapeHtml(r.erp.loginUrl)}</a></p>` : r.erpError ? `<p style="color:#b91c1c">ERP: ${escapeHtml(r.erpError)}</p>` : ''}
        <p>الخطة: ${escapeHtml(r.planLabel || r.plan)} · الأنظمة: ${escapeHtml((r.systems || []).join(' · '))}</p>
        <div class="hub-rent-admin-actions">
          ${r.status === 'pending' || r.status === 'provisioning' ? `<button type="button" class="hub-rent-btn hub-rent-btn-primary" style="width:auto;margin:0;padding:8px 14px" data-approve="${r.id}"><i class="fas fa-check"></i> اعتماد وربط ERP</button>` : ''}
          ${r.status === 'pending' ? `<button type="button" class="hub-rent-btn hub-rent-btn-secondary" style="width:auto;margin:0;padding:8px 14px" data-reject="${r.id}"><i class="fas fa-xmark"></i> رفض</button>` : ''}
          ${r.status === 'active' && r.erp?.loginUrl ? `<a class="hub-rent-btn hub-rent-btn-secondary" style="width:auto;margin:0;padding:8px 14px;text-decoration:none" href="${escapeHtml(r.erp.loginUrl)}" target="_blank" rel="noopener"><i class="fas fa-arrow-up-right-from-square"></i> فتح ERP</a>` : ''}
          ${r.status === 'active' && !r.erp?.loginUrl ? `<a class="hub-rent-btn hub-rent-btn-secondary" style="width:auto;margin:0;padding:8px 14px;text-decoration:none" href="apps.html#${String(r.systems?.[0] || 'erp').toLowerCase()}"><i class="fas fa-arrow-up-right-from-square"></i> فتح</a>` : ''}
        </div>
      </article>`
      )
      .join('');

    root.querySelectorAll('[data-approve]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ الربط…';
        const res = await store().activateRentalAsync(btn.getAttribute('data-approve'));
        if (!res.ok) {
          alert(res.error || 'فشل الاعتماد / ربط ERP');
          renderList();
          return;
        }
        renderList();
      });
    });
    root.querySelectorAll('[data-reject]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = store().rejectRental(btn.getAttribute('data-reject'));
        if (!res.ok) return alert(res.error || 'فشل الرفض');
        renderList();
      });
    });
  };

  const renderVisGrid = () => {
    const grid = $('[data-vis-grid]');
    if (!grid) return;
    const systems = store().catalogSystems();
    grid.innerHTML = systems
      .map(
        (s) => `<label><input type="checkbox" value="${s.code}" data-vis-code /> <i class="fas ${s.icon}"></i> ${escapeHtml(s.nameAr)}</label>`
      )
      .join('');
  };

  const loadVisibility = () => {
    const email = String($('#vis-email')?.value || '').trim().toLowerCase();
    const codes = new Set(email ? store().visibleCodesFor(email) : store().RENTABLE_CODES);
    document.querySelectorAll('[data-vis-code]').forEach((cb) => {
      cb.checked = codes.has(cb.value);
    });
  };

  const saveVisibility = () => {
    const email = String($('#vis-email')?.value || '').trim().toLowerCase();
    const feedback = $('[data-vis-feedback]');
    if (!email) {
      if (feedback) {
        feedback.hidden = false;
        feedback.textContent = 'أدخل بريد العميل أولًا';
      }
      return;
    }
    const codes = [...document.querySelectorAll('[data-vis-code]:checked')].map((c) => c.value);
    const res = store().setVisibility({ email, codes, mode: 'allow' });
    if (feedback) {
      feedback.hidden = false;
      feedback.textContent = res.ok
        ? `تم حفظ الظهور لـ ${email}: ${codes.join(' · ') || 'لا أنظمة'}`
        : res.error || 'فشل الحفظ';
    }
  };

  document.addEventListener('DOMContentLoaded', async () => {
    if (!$('[data-rent-admin-list]') && !$('[data-platform-admin-list]')) return;
    await store()?.hydrate?.();
    await platforms()?.hydrate?.();
    void platforms()?.syncAccountsFromGrants?.();
    renderVisGrid();
    renderList();
    renderPlatformList();
    $('[data-vis-save]')?.addEventListener('click', saveVisibility);
    $('#vis-email')?.addEventListener('change', loadVisibility);
    $('#vis-email')?.addEventListener('blur', loadVisibility);
  });
})();
