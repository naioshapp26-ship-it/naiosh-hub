/**
 * NAIOSH HUB 360 — shared Enterprise Workspace kit
 * Used by Batch A (Command & Ops) and later batches.
 */
(() => {
  'use strict';

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fmtTime = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return String(iso);
    }
  };

  const bar = (pct) => {
    const n = Math.max(0, Math.min(100, Number(pct) || 0));
    return `<div class="bar" aria-hidden="true"><i style="width:${n}%"></i></div>`;
  };

  const badge = (text, cls = 'badge-outline') =>
    `<span class="badge ${cls}">${esc(text || '—')}</span>`;

  const actorName = (user) => user?.name || user?.email || user?.displayName || 'مشغّل هوب';

  const canAdmin = (user) => {
    const role = String(user?.role || '').toLowerCase();
    return !role || ['supreme_leader', 'admin', 'chief_engineer', 'manager'].includes(role);
  };

  const paginate = (arr, page, pageSize) => {
    const total = arr.length;
    const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
    const p = Math.min(Math.max(1, page), pages);
    const start = (p - 1) * pageSize;
    return { rows: arr.slice(start, start + pageSize), total, pages, page: p };
  };

  const qVal = (id) => {
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (!el) return '';
    return el.type === 'checkbox' ? !!el.checked : String(el.value || '').trim();
  };

  const renderHeader = ({ prefix, title, subtitle, icon, actionsHtml = '' }) => `
    <div class="hub-ws-header toolbar" style="justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:12px">
      <div>
        <div class="empire-banner-kicker"><i class="fas ${esc(icon || 'fa-layer-group')}"></i> NAIOSH HUB · WORKSPACE</div>
        <h2 style="margin:4px 0 2px;font-size:1.35rem">${esc(title)}</h2>
        <p class="muted" style="margin:0;max-width:52ch">${esc(subtitle || '')}</p>
      </div>
      <div class="toolbar" style="margin:0;gap:6px;flex-wrap:wrap">${actionsHtml}</div>
    </div>`;

  const renderTabs = (prefix, tabs, active) => `
    <div class="tabs hub-ws-tabs" role="tablist">
      ${tabs
        .map(
          (t) =>
            `<button type="button" class="tab ${active === t.id ? 'active' : ''}" data-action="${esc(prefix)}-tab" data-tab="${esc(t.id)}" role="tab">
              ${t.icon ? `<i class="fas ${esc(t.icon)}"></i> ` : ''}${esc(t.label)}
            </button>`
        )
        .join('')}
    </div>`;

  const renderKpis = (prefix, items, focusKey) => `
    <div class="kpi-grid hub-ws-kpis">
      ${items
        .map(
          (k) => `<article class="kpi ${focusKey === k.key ? 'is-focus' : ''}" ${
            k.action !== false
              ? `data-action="${esc(prefix)}-kpi" data-key="${esc(k.key)}" ${k.tab ? `data-tab="${esc(k.tab)}"` : ''}`
              : ''
          }>
            <span>${esc(k.label)}</span>
            <strong>${esc(String(k.value))}</strong>
            <small>${esc(k.hint || '')}</small>
          </article>`
        )
        .join('')}
    </div>`;

  const renderNeeds = (prefix, items) => {
    if (!items?.length) {
      return `<article class="card" style="margin-top:12px"><h3><span class="title-left"><i class="fas fa-circle-check icon"></i> Needs Action</span></h3>
        <p class="empty" style="text-align:right">لا عناصر تحتاج إجراء الآن.</p></article>`;
    }
    return `<article class="card" style="margin-top:12px;border-right:4px solid var(--red)">
      <h3><span class="title-left"><i class="fas fa-bolt icon"></i> Needs Action · ${items.length}</span></h3>
      <ul class="feed" style="margin:0">
        ${items
          .slice(0, 10)
          .map(
            (it) => `<li>
              <b>${esc(it.text)}</b>
              ${
                it.tab
                  ? `<button type="button" class="btn btn-sm btn-ghost" data-action="${esc(prefix)}-tab" data-tab="${esc(it.tab)}" ${it.id ? `data-id="${esc(it.id)}"` : ''}>فتح</button>`
                  : ''
              }
            </li>`
          )
          .join('')}
      </ul>
    </article>`;
  };

  const renderHelp = (prefix, { title, bodyHtml, dismissed, open }) => {
    if (dismissed && !open) {
      return `<div class="toolbar" style="margin-top:8px">
        <button type="button" class="btn btn-ghost btn-sm" data-action="${esc(prefix)}-help-open"><i class="fas fa-circle-question"></i> مساعدة</button>
      </div>`;
    }
    return `<article class="card hub-ws-help" style="margin-top:12px;border-right:4px solid var(--red)">
      <h3><span class="title-left"><i class="fas fa-circle-question icon"></i> ${esc(title || 'دليل الاستخدام')}</span>
        <button type="button" class="btn btn-sm btn-ghost" data-action="${esc(prefix)}-help-dismiss">إخفاء</button>
      </h3>
      ${bodyHtml || ''}
    </article>`;
  };

  const renderPager = (prefix, page, pages, total) => `
    <div class="toolbar" style="justify-content:space-between;margin-top:10px">
      <small class="muted">${total} سجل · صفحة ${page} / ${pages}</small>
      <div class="toolbar" style="margin:0;gap:4px">
        <button type="button" class="btn btn-sm btn-ghost" data-action="${esc(prefix)}-page" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>السابق</button>
        <button type="button" class="btn btn-sm btn-ghost" data-action="${esc(prefix)}-page" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>التالي</button>
      </div>
    </div>`;

  const renderModal = (prefix, { title, bodyHtml, footerHtml }) => `
    <div class="hub-ws-modal-overlay" data-action="${esc(prefix)}-modal-close" style="position:fixed;inset:0;background:rgba(10,10,10,.45);z-index:80;display:flex;align-items:center;justify-content:center;padding:16px">
      <article class="card hub-ws-modal" style="width:min(640px,96vw);max-height:90vh;overflow:auto;margin:0" onclick="event.stopPropagation()">
        <h3><span class="title-left">${esc(title)}</span>
          <button type="button" class="btn btn-sm btn-ghost" data-action="${esc(prefix)}-modal-close"><i class="fas fa-xmark"></i></button>
        </h3>
        ${bodyHtml || ''}
        <div class="toolbar" style="margin-top:12px;justify-content:flex-end">${footerHtml || ''}</div>
      </article>
    </div>`;

  const renderDrawer = (prefix, { title, bodyHtml }) => `
    <div class="hub-ws-drawer-backdrop" data-action="${esc(prefix)}-drawer-close" style="position:fixed;inset:0;background:rgba(10,10,10,.35);z-index:70"></div>
    <aside class="hub-ws-drawer card" style="position:fixed;inset-block:0;inset-inline-start:0;width:min(420px,92vw);z-index:71;margin:0;border-radius:0;overflow:auto;padding:16px">
      <h3><span class="title-left">${esc(title)}</span>
        <button type="button" class="btn btn-sm btn-ghost" data-action="${esc(prefix)}-drawer-close"><i class="fas fa-xmark"></i></button>
      </h3>
      ${bodyHtml || ''}
    </aside>`;

  const renderAuditTable = (rows, fmt = fmtTime) => `
    <div class="table-wrap"><table class="data">
      <thead><tr><th>الوقت</th><th>الإجراء</th><th>التفاصيل</th><th>بواسطة</th><th>المصدر</th></tr></thead>
      <tbody>
        ${
          rows?.length
            ? rows
                .slice(0, 50)
                .map(
                  (a) => `<tr>
                    <td>${esc(fmt(a.at))}</td>
                    <td>${esc(a.action || a.kind || '—')}</td>
                    <td>${esc(a.detail || a.text || '—')}</td>
                    <td>${esc(a.by || '—')}</td>
                    <td>${esc(a.source || '—')}</td>
                  </tr>`
                )
                .join('')
            : '<tr><td colspan="5" class="empty">لا سجل بعد</td></tr>'
        }
      </tbody>
    </table></div>`;

  const sourceBadge = (src) => badge(src || 'إدخال يدوي', 'badge-outline');

  window.HubWsKit = {
    esc,
    fmtTime,
    bar,
    badge,
    actorName,
    canAdmin,
    paginate,
    qVal,
    renderHeader,
    renderTabs,
    renderKpis,
    renderNeeds,
    renderHelp,
    renderPager,
    renderModal,
    renderDrawer,
    renderAuditTable,
    sourceBadge,
  };
})();
