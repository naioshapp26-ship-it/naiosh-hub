/**
 * Admin — Incoming articles (filtered view of HubCustomerRequests)
 * Same Request IDs / Status as عملاء هوب → طلبات العملاء
 */
(() => {
  'use strict';

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fmt = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return String(iso).slice(0, 16);
    }
  };

  const state = { id: '' };
  const CR = () => window.HubCustomerRequests;
  const actor = () => {
    try {
      const u = window.HubAuth?.getUser?.() || JSON.parse(localStorage.getItem('hubUser') || '{}');
      return u?.name || u?.email || 'مشغّل محتوى';
    } catch {
      return 'مشغّل محتوى';
    }
  };

  const articleRows = () => {
    CR()?.syncFromModules?.();
    window.HubArticles?.linkCustomerRequests?.();
    return (CR()?.list({ view: 'articles' }) || []).sort((a, b) =>
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    );
  };

  function renderList() {
    const rows = articleRows();
    const k = CR()?.kpis?.() || {};
    return `<div class="card" style="padding:14px">
      <p class="muted">نفس سجلات <strong>طلبات العملاء</strong> — مفلترة على نوع المقال. Request ID مشترك.</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin:10px 0 14px">
        <span class="chip">مقالات في الصندوق: ${k.articles || rows.length}</span>
        <span class="chip">بانتظار المراجعة: ${k.pendingReview || 0}</span>
        <a class="btn btn-ghost btn-sm" href="#posha-clients">فتح طلبات العملاء</a>
      </div>
      <div class="table-wrap"><table class="data" style="width:100%">
        <thead><tr>
          <th>Request ID</th><th>Article ID</th><th>العنوان</th><th>الكاتب</th><th>الحالة</th><th>تاريخ</th><th>الإجراءات</th>
        </tr></thead>
        <tbody>
          ${
            rows
              .map(
                (r) => `<tr>
              <td><code>${esc(r.id)}</code></td>
              <td><code>${esc(r.referenceId || '—')}</code></td>
              <td>${esc(r.articleSnapshot?.title || r.title)}</td>
              <td>${esc(r.customerName || '—')}</td>
              <td>${esc((CR().STATUS_AR || {})[r.status] || r.status)}</td>
              <td>${fmt(r.createdAt)}</td>
              <td>
                <button type="button" class="btn btn-primary btn-sm" data-aopen="${esc(r.id)}">عرض</button>
                ${
                  !['Published', 'Rejected', 'Archived'].includes(r.status)
                    ? `<button type="button" class="btn btn-dark btn-sm" data-apub="${esc(r.id)}">موافقة ونشر</button>`
                    : ''
                }
              </td>
            </tr>`
              )
              .join('') ||
            '<tr><td colspan="7">لا مقالات واردة — عند إرسال مقال من blog.html يظهر هنا وداخل طلبات العملاء معاً.</td></tr>'
          }
        </tbody>
      </table></div>
    </div>`;
  }

  function renderDetail(id) {
    const r = CR()?.get(id);
    if (!r) return `<p>غير موجود</p><button class="btn btn-ghost" data-aback>رجوع</button>`;
    const art = r.referenceId ? window.HubArticles?.get?.(r.referenceId) : null;
    const snap = art || r.articleSnapshot || {};
    return `<div class="card" style="padding:16px">
      <button type="button" class="btn btn-ghost btn-sm" data-aback>← رجوع</button>
      <h3>${esc(r.id)} · ${esc(snap.title || r.title)}</h3>
      <p><code>${esc(r.referenceId)}</code> · ${esc((CR().STATUS_AR || {})[r.status] || r.status)}</p>
      <ul class="feed">
        <li><b>الكاتب:</b> ${esc(r.customerName)}</li>
        <li><b>التصنيف:</b> ${esc(snap.category || '—')}</li>
        <li><b>الملخص:</b> ${esc(snap.summary || r.description || '—')}</li>
        <li><b>المصدر:</b> ${esc(r.sourceModule)} · ${esc(r.sourcePage)}</li>
      </ul>
      ${snap.body ? `<div style="white-space:pre-wrap;background:#f9fafb;padding:12px;border-radius:10px">${esc(snap.body)}</div>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">
        ${!['Published', 'Rejected'].includes(r.status) ? `<button type="button" class="btn btn-primary" data-apub="${esc(r.id)}">موافقة ونشر</button>` : ''}
        <button type="button" class="btn btn-dark" data-achg="${esc(r.id)}">طلب تعديل</button>
        <button type="button" class="btn btn-ghost" data-arej="${esc(r.id)}">رفض</button>
        <a class="btn btn-ghost" href="#posha-clients">فتح في طلبات العملاء</a>
      </div>
    </div>`;
  }

  function paintBody() {
    const body = document.getElementById('art-admin-body');
    if (!body) return;
    body.innerHTML = state.id ? renderDetail(state.id) : renderList();
    body.querySelectorAll('[data-aopen]').forEach((b) => {
      b.onclick = () => {
        state.id = b.getAttribute('data-aopen');
        paintBody();
      };
    });
    body.querySelector('[data-aback]')?.addEventListener('click', () => {
      state.id = '';
      paintBody();
    });
    body.querySelectorAll('[data-apub]').forEach((b) => {
      b.onclick = () => {
        const id = b.getAttribute('data-apub');
        const r = CR()?.get(id);
        if (!window.confirm(`اعتماد ونشر؟\n${r?.id}\n${r?.referenceId}`)) return;
        CR()?.approveAndPublish?.(id, actor());
        paintBody();
      };
    });
    body.querySelectorAll('[data-achg]').forEach((b) => {
      b.onclick = () => {
        const note = window.prompt('سبب التعديل؟');
        if (!note) return;
        CR()?.updateStatus(b.getAttribute('data-achg'), 'Needs Changes', actor(), note);
        paintBody();
      };
    });
    body.querySelectorAll('[data-arej]').forEach((b) => {
      b.onclick = () => {
        const note = window.prompt('سبب الرفض؟');
        if (!note) return;
        CR()?.updateStatus(b.getAttribute('data-arej'), 'Rejected', actor(), note);
        paintBody();
      };
    });
  }

  function mount(root) {
    if (!root) return;
    if (!CR()) {
      root.innerHTML = '<p class="empty">وحدة الطلبات المركزية غير محمّلة.</p>';
      return;
    }
    root.innerHTML = `<div class="art-admin" id="art-admin">
      <div style="margin-bottom:12px">
        <h2 style="margin:0"><i class="fas fa-newspaper"></i> المقالات الواردة</h2>
        <p style="margin:6px 0 0;color:#6b7280;font-weight:600">عرض متخصص من نفس Customer Requests Registry</p>
      </div>
      <div id="art-admin-body"></div>
    </div>`;
    paintBody();
  }

  window.HubArticlesAdmin = { mount, state };
})();
