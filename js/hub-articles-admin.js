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

  const L = (k, fb) => window.HubI18n?.label?.(k, fb) || fb || k;

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

  function mediaPreview(file, kind) {
    if (!file) return `<p class="muted">لا ${kind === 'video' ? 'فيديو' : 'صورة'} مرفقة</p>`;
    const url = file.url || '';
    const meta = `<div style="margin-top:6px;font-weight:700">${esc(file.name || '')} · ${esc(String(file.size ? Math.round(file.size / 1024) + ' KB' : ''))}</div>`;
    if (kind === 'video' && url) {
      return `<video src="${esc(url)}" controls style="max-width:100%;max-height:320px;border-radius:12px;background:#111"></video>${meta}`;
    }
    if (url) {
      return `<img src="${esc(url)}" alt="" style="max-width:100%;max-height:280px;border-radius:12px;object-fit:contain" />${meta}`;
    }
    return `<p class="muted">الملف غير متاح للمعاينة (${esc(file.name || 'ملف')})</p>`;
  }

  function renderList() {
    const rows = articleRows();
    const k = CR()?.kpis?.() || {};
    return `<div class="card" style="padding:14px">
      <p class="muted">صندوق مكتب المحتوى — نفس سجلات <strong>طلبات العملاء</strong>. المقالات لا تُرسل مباشرة إلى موافقات المدير الأعلى.</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin:10px 0 14px">
        <span class="chip">مقالات في الصندوق: ${k.articles || rows.length}</span>
        <span class="chip">بانتظار المراجعة: ${k.pendingReview || 0}</span>
        <a class="btn btn-ghost btn-sm" href="#clients-mgmt">فتح طلبات العملاء</a>
      </div>
      <div class="table-wrap"><table class="data" style="width:100%">
        <thead><tr>
          <th>${esc(L('Request ID', 'رقم الطلب'))}</th><th>${esc(L('Article ID', 'رقم المقال'))}</th><th>العنوان</th><th>الكاتب</th><th>الحالة</th><th>تاريخ</th><th>الإجراءات</th>
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
              <td>${esc((CR().STATUS_AR || {})[r.status] || window.HubI18n?.status?.(r.status) || r.status)}</td>
              <td>${fmt(r.createdAt)}</td>
              <td>
                <button type="button" class="btn btn-primary btn-sm" data-aopen="${esc(r.id)}">عرض</button>
                ${
                  !['Published', 'Rejected', 'Archived'].includes(r.status)
                    ? `<button type="button" class="btn btn-dark btn-sm" data-apub="${esc(r.id)}">قبول ونشر</button>`
                    : ''
                }
              </td>
            </tr>`
              )
              .join('') ||
            '<tr><td colspan="7">لا مقالات واردة — عند إرسال مقال من صفحة المدونة يظهر هنا وداخل طلبات العملاء معاً.</td></tr>'
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
    const closed = ['Published', 'Rejected', 'Archived'].includes(r.status);
    return `<div class="card" style="padding:16px">
      <button type="button" class="btn btn-ghost btn-sm" data-aback>← رجوع</button>
      <h3>${esc(snap.title || r.title)}</h3>
      <ul class="feed">
        <li><b>رقم الطلب:</b> <code>${esc(r.id)}</code></li>
        <li><b>رقم المقال:</b> <code>${esc(r.referenceId || snap.articleId || '—')}</code></li>
        <li><b>العميل / صاحب الطلب:</b> ${esc(r.customerName || snap.authorName || '—')} · ${esc(r.email || '')}</li>
        <li><b>عنوان المقال:</b> ${esc(snap.title || '—')}</li>
        <li><b>التصنيف:</b> ${esc(snap.category || '—')}</li>
        <li><b>الكاتب:</b> ${esc(snap.authorName || '—')}</li>
        <li><b>النبذة:</b> ${esc(snap.summary || r.description || '—')}</li>
        <li><b>تاريخ ووقت الإرسال:</b> ${fmt(snap.submittedAt || r.createdAt)}</li>
        <li><b>مصدر الطلب:</b> ${esc(r.sourceModule || 'المقالات')}</li>
        <li><b>نوع العملية:</b> ${esc(r.requestTypeLabel || 'طلب نشر مقال')}</li>
        <li><b>الحالة الحالية:</b> ${esc((CR().STATUS_AR || {})[r.status] || r.status)}</li>
        <li><b>مرحلة الموافقة الحالية:</b> مكتب المحتوى (مراجعة ونشر المقالات)</li>
        <li><b>المسؤول عن المراجعة:</b> ${esc(r.assignedTo || 'Content Desk')}</li>
        ${r.changeRequestNote ? `<li><b>سبب التعديل:</b> ${esc(r.changeRequestNote)}</li>` : ''}
        ${r.rejectionReason ? `<li><b>سبب الرفض:</b> ${esc(r.rejectionReason)}</li>` : ''}
      </ul>
      <h4>محتوى المقال</h4>
      ${snap.body ? `<div style="white-space:pre-wrap;background:#f9fafb;padding:12px;border-radius:10px">${esc(snap.body)}</div>` : '<p>لا محتوى</p>'}
      <h4 style="margin-top:16px">صورة المقال</h4>
      ${mediaPreview(snap.coverImage, 'image')}
      <h4 style="margin-top:16px">فيديو المقال</h4>
      ${mediaPreview(snap.video, 'video')}
      <h4 style="margin-top:16px">المرفقات</h4>
      ${
        (snap.attachments || []).length
          ? (snap.attachments || [])
              .map((f) =>
                f.url
                  ? `<p><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.name)}</a></p>`
                  : `<p>${esc(f.name)}</p>`
              )
              .join('')
          : '<p class="muted">لا مرفقات إضافية</p>'
      }
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:16px">
        <a class="btn btn-ghost" href="blog.html#mine/${esc(r.referenceId || '')}" target="_blank" rel="noopener">معاينة المقال</a>
        ${!closed ? `<button type="button" class="btn btn-primary" data-apub="${esc(r.id)}">قبول ونشر</button>` : ''}
        ${!closed ? `<button type="button" class="btn btn-dark" data-achg="${esc(r.id)}">طلب تعديل</button>` : ''}
        ${!closed ? `<button type="button" class="btn btn-ghost" data-arej="${esc(r.id)}">رفض</button>` : ''}
        <a class="btn btn-ghost" href="#clients-mgmt">فتح في طلبات العملاء</a>
      </div>
    </div>`;
  }

  async function decide(id, action, note) {
    const r = CR()?.get(id);
    const articleId = r?.referenceId;
    if (articleId && window.HubArticles?.doAction) {
      await window.HubArticles.doAction(articleId, action, { note, idempotencyKey: `art-admin-${action}-${articleId}` });
      await window.HubArticles.refreshFromApi?.();
      const art = window.HubArticles.get(articleId);
      if (art) CR()?.ensureForArticle?.(art, actor());
      return;
    }
    if (action === 'publish') CR()?.approveAndPublish?.(id, actor());
    else if (action === 'request_changes') CR()?.updateStatus(id, 'Needs Changes', actor(), note);
    else if (action === 'reject') CR()?.updateStatus(id, 'Rejected', actor(), note);
  }

  function paintBody() {
    const body = document.getElementById('art-admin-body');
    if (!body) return;
    body.innerHTML = state.id ? renderDetail(state.id) : renderList();
    body.querySelectorAll('[data-aopen]').forEach((b) => {
      b.onclick = () => {
        state.id = b.getAttribute('data-aopen');
        const r = CR()?.get(state.id);
        if (r?.referenceId && window.HubArticles?.doAction) {
          window.HubArticles.doAction(r.referenceId, 'start_review', { idempotencyKey: `art-review-${r.referenceId}` }).catch(
            () => {}
          );
        }
        paintBody();
      };
    });
    body.querySelector('[data-aback]')?.addEventListener('click', () => {
      state.id = '';
      paintBody();
    });
    body.querySelectorAll('[data-apub]').forEach((b) => {
      b.onclick = async () => {
        const id = b.getAttribute('data-apub');
        const r = CR()?.get(id);
        if (!window.confirm(`قبول ونشر؟\n${r?.id}\n${r?.referenceId}`)) return;
        try {
          await decide(id, 'publish');
        } catch (e) {
          alert(e?.message || 'تعذر النشر');
          return;
        }
        paintBody();
      };
    });
    body.querySelectorAll('[data-achg]').forEach((b) => {
      b.onclick = async () => {
        const note = window.prompt('سبب التعديل؟');
        if (!note) return;
        try {
          await decide(b.getAttribute('data-achg'), 'request_changes', note);
        } catch (e) {
          alert(e?.message || 'تعذر طلب التعديل');
          return;
        }
        paintBody();
      };
    });
    body.querySelectorAll('[data-arej]').forEach((b) => {
      b.onclick = async () => {
        const note = window.prompt('سبب الرفض؟');
        if (!note) return;
        try {
          await decide(b.getAttribute('data-arej'), 'reject', note);
        } catch (e) {
          alert(e?.message || 'تعذر الرفض');
          return;
        }
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
        <p style="margin:6px 0 0;color:#6b7280;font-weight:600">عرض متخصص من نفس ${esc(L('Customer Requests Registry', 'سجل طلبات العملاء'))} — مكتب المحتوى</p>
      </div>
      <div id="art-admin-body"></div>
    </div>`;
    paintBody();
    window.HubArticles?.refreshFromApi?.().then(() => {
      window.HubArticles.linkCustomerRequests?.();
      paintBody();
    });
  }

  window.HubArticlesAdmin = { mount, state };
})();
