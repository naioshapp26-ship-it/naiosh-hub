/**
 * إدارة استئجار الأنظمة — صلاحيات الظهور + اعتماد الطلبات
 */
(() => {
  'use strict';

  const store = () => window.HubRentStore;
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

  const renderList = () => {
    const root = $('[data-rent-admin-list]');
    if (!root) return;
    const rows = store().listRentals();
    if (!rows.length) {
      root.innerHTML = '<p class="hub-rent-hint">لا طلبات بعد — ابدأ من صفحة استأجر نظامًا.</p>';
      return;
    }
    root.innerHTML = rows
      .map(
        (r) => `<article class="hub-rent-admin-item" data-id="${r.id}">
        <h3>${escapeHtml(r.companyName)} <span class="hub-rent-status ${statusClass(r.status)}">${statusAr[r.status] || r.status}</span></h3>
        <p>المسؤول: ${escapeHtml(r.adminName)} · ${escapeHtml(r.adminEmail || '—')}</p>
        <p>النطاق: <span dir="ltr">${escapeHtml(r.host)}</span></p>
        <p>الخطة: ${escapeHtml(r.planLabel || r.plan)} · الأنظمة: ${escapeHtml((r.systems || []).join(' · '))}</p>
        <div class="hub-rent-admin-actions">
          ${r.status === 'pending' || r.status === 'provisioning' ? `<button type="button" class="hub-rent-btn hub-rent-btn-primary" style="width:auto;margin:0;padding:8px 14px" data-approve="${r.id}"><i class="fas fa-check"></i> اعتماد وتفعيل</button>` : ''}
          ${r.status === 'pending' ? `<button type="button" class="hub-rent-btn hub-rent-btn-secondary" style="width:auto;margin:0;padding:8px 14px" data-reject="${r.id}"><i class="fas fa-xmark"></i> رفض</button>` : ''}
          ${r.status === 'active' ? `<a class="hub-rent-btn hub-rent-btn-secondary" style="width:auto;margin:0;padding:8px 14px;text-decoration:none" href="apps.html#${String(r.systems?.[0] || 'erp').toLowerCase()}"><i class="fas fa-arrow-up-right-from-square"></i> فتح</a>` : ''}
        </div>
      </article>`
      )
      .join('');

    root.querySelectorAll('[data-approve]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = store().activateRental(btn.getAttribute('data-approve'));
        if (!res.ok) return alert(res.error || 'فشل الاعتماد');
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

  const escapeHtml = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  document.addEventListener('DOMContentLoaded', async () => {
    if (!$('[data-rent-admin-list]')) return;
    await store()?.hydrate?.();
    renderVisGrid();
    renderList();
    $('[data-vis-save]')?.addEventListener('click', saveVisibility);
    $('#vis-email')?.addEventListener('change', loadVisibility);
    $('#vis-email')?.addEventListener('blur', loadVisibility);
  });
})();
